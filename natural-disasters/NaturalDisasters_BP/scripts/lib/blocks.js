// Block service: guarded block edits with an undo journal (temporary edits are always restored).
// Same-session restore uses the original BlockPermutation (exact); crash recovery uses persisted ids (best effort).
import { world, system, BlockPermutation } from '@minecraft/server';
import { stats } from './stats.js';
import { qualityTier, getSettings } from './settings.js';
import { warn, getDimension, dimName, clamp } from './util.js';
import { isTerrainId, isProtectedId, isPassableId, isRestrictedPlacement, isForbiddenPlacement, normId, fullId } from './blocklists.js';
import { PROP, JOURNAL_CHUNK_CHARS, JOURNAL_MAX_ENTRIES, DIMENSION_IDS } from '../config.js';

/** @typedef {import('@minecraft/server').Vector3} Vector3 */
/** @typedef {import('@minecraft/server').Dimension} Dimension */
/** @typedef {import('@minecraft/server').Block} Block */

const MIN_Y = -64;
const MAX_Y = 319;

/**
 * @typedef {Object} Entry
 * @property {string} dim
 * @property {number} x @property {number} y @property {number} z
 * @property {BlockPermutation|null} perm original permutation (null after a reload)
 * @property {string} id original block id without namespace ('' when it cannot be resolved)
 * @property {boolean} solid original block was a solid (rescue entities on restore)
 * @property {number} owner disaster instance id
 * @property {number} tries
 */

/** @type {Map<string, Entry>} */
const journal = new Map();
/** @type {Entry[]} entries released for restoring (processed from the end = reverse order) */
let queue = [];
/** @type {Entry[]} entries whose chunk was not loaded, retried later */
let retry = [];
let nextRetryTick = 0;
let dirty = false;
let lastFlush = 0;

const key = (d, x, y, z) => d + '|' + x + '|' + y + '|' + z;

// ---- inspection ------------------------------------------------------------------------------------------------
/**
 * @param {Block} block
 * @returns {{kind: 'air'|'liquid'|'solid', id: string}} id is the block item id without namespace ('' if unknown)
 */
export function inspect(block) {
  try {
    if (block.isAir) return { kind: 'air', id: '' };
    if (block.isLiquid) return { kind: 'liquid', id: '' };
    const st = block.permutation.getItemStack(1);
    return { kind: 'solid', id: st ? normId(st.typeId) : '' };
  } catch (e) {
    return { kind: 'solid', id: '' };
  }
}

/** 'water' | 'lava' | '' for a liquid block. @param {Block} block */
function liquidId(block) {
  try {
    const p = block.permutation;
    if (p.matches('minecraft:water') || p.matches('minecraft:flowing_water')) return 'water';
    if (p.matches('minecraft:lava') || p.matches('minecraft:flowing_lava')) return 'lava';
  } catch (e) { /* unknown liquid */ }
  return '';
}

/** Block or undefined when the chunk is not loaded / out of world. @param {Dimension} dim */
export function getBlock(dim, x, y, z) {
  if (y < MIN_Y || y > MAX_Y) return undefined;
  try { return dim.getBlock({ x, y, z }) || undefined; } catch (e) { return undefined; }
}

/**
 * Find the ground surface of a column scanning downward from fromY (vegetation is skipped).
 * @param {Dimension} dim @param {number} x @param {number} z @param {number} fromY @param {number} [maxDown]
 * @returns {{y: number, liquid: boolean, id: string}|undefined} y = top solid/liquid block
 */
export function surface(dim, x, z, fromY, maxDown) {
  const bx = Math.floor(x), bz = Math.floor(z);
  const top = clamp(Math.floor(fromY), MIN_Y, MAX_Y);
  const bottom = Math.max(MIN_Y, top - (maxDown || 64));
  for (let y = top; y >= bottom; y--) {
    const b = getBlock(dim, bx, y, bz);
    if (!b) return undefined;
    if (b.isAir) continue;
    if (b.isLiquid) return { y, liquid: true, id: liquidId(b) };
    const info = inspect(b);
    if (info.id && isPassableId(info.id)) continue;
    return { y, liquid: false, id: info.id };
  }
  return undefined;
}

// ---- writing ---------------------------------------------------------------------------------------------------
/**
 * Set one block.
 * mode 'destructive' (default): permanent when blockDestruction is ON, otherwise temporary (journaled, restored later).
 * mode 'temporary': always journaled (water, snow, visual changes).
 * Returns 'ok' | 'refused' | 'unloaded' | 'budget'.
 * @param {number} owner @param {Dimension} dim @param {number} x @param {number} y @param {number} z
 * @param {string} id block id ("air", "water", "minecraft:stone", ...)
 * @param {{mode?: 'destructive'|'temporary', states?: Record<string, string|number|boolean>, onlyAir?: boolean}} [opts]
 * @returns {'ok'|'refused'|'unloaded'|'budget'}
 */
export function setBlock(owner, dim, x, y, z, id, opts) {
  const q = qualityTier();
  if (stats.blockOpsTick >= q.blockOpsPerTick) return 'budget';
  const o = opts || {};
  const s = getSettings();
  const destructive = (o.mode || 'destructive') === 'destructive';
  const permanent = destructive && s.blockDestruction;
  const nid = normId(id);
  const refuse = () => { stats.blockOpsRefused++; return /** @type {'refused'} */ ('refused'); };

  if (isForbiddenPlacement(nid) && !(nid === 'tnt')) return refuse();
  if (isRestrictedPlacement(nid) && !permanent) return refuse();

  const block = getBlock(dim, x, y, z);
  if (!block) return 'unloaded';
  const cur = inspect(block);
  if (o.onlyAir && cur.kind !== 'air') return refuse();
  if (cur.kind === 'solid') {
    if (!cur.id || isProtectedId(cur.id)) return refuse();
    if (!permanent && !isTerrainId(cur.id)) return refuse();
  }
  if (cur.kind === 'air' && nid === 'air') return 'ok';

  const dn = dimName(dim);
  const k = key(dn, x, y, z);
  if (!permanent && !journal.has(k)) {
    if (journal.size >= JOURNAL_MAX_ENTRIES) return refuse();
    let perm = null;
    try { perm = block.permutation; } catch (e) { return refuse(); }
    const solid = cur.kind === 'solid' && !isPassableId(cur.id);
    journal.set(k, { dim: dn, x, y, z, perm, id: cur.kind === 'air' ? 'air' : cur.kind === 'liquid' ? liquidId(block) : cur.id, solid, owner, tries: 0 });
    dirty = true;
    stats.journalSize = journal.size;
  }
  try {
    block.setPermutation(BlockPermutation.resolve(fullId(nid), o.states));
  } catch (e) {
    if (!permanent) { journal.delete(k); stats.journalSize = journal.size; }
    return refuse();
  }
  stats.blockOpsTick++;
  stats.blockOpsTotal++;
  return 'ok';
}

// ---- restoring -------------------------------------------------------------------------------------------------
/** Release all journaled edits of an owner for restoring (0 = every owner). @param {number} owner @returns {number} entries queued */
export function releaseOwner(owner) {
  let n = 0;
  for (const e of journal.values()) {
    if ((owner === 0 || e.owner === owner) && queue.indexOf(e) < 0) { queue.push(e); n++; }
  }
  return n;
}

export function pendingRestore() { return queue.length + retry.length; }
export function journalSize() { return journal.size; }

/** Move an entity out of a block that is about to become solid again. @param {Dimension} dim @param {number} x @param {number} y @param {number} z */
function rescueEntities(dim, x, y, z) {
  let list;
  try { list = dim.getEntities({ location: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, maxDistance: 1.6 }); } catch (e) { return; }
  for (let i = 0; i < list.length; i++) {
    const ent = list[i];
    try {
      const l = ent.location;
      if (Math.abs(l.x - (x + 0.5)) > 1.2 || Math.abs(l.z - (z + 0.5)) > 1.2 || l.y < y - 1.9 || l.y > y + 1.1) continue;
      let ty = y + 1;
      for (let n = 0; n < 48; n++) {
        const a = getBlock(dim, x, ty, z), b = getBlock(dim, x, ty + 1, z);
        if (!a || !b) break;
        if ((a.isAir || a.isLiquid) && (b.isAir || b.isLiquid)) break;
        ty++;
      }
      ent.teleport({ x: x + 0.5, y: ty + 0.05, z: z + 0.5 });
    } catch (e) { /* entity gone */ }
  }
}

/** @param {Entry} e @returns {'done'|'retry'|'skip'} */
function restoreOne(e) {
  const dim = getDimension(e.dim);
  if (!dim) return 'retry';
  const block = getBlock(dim, e.x, e.y, e.z);
  if (!block) return 'retry';
  const cur = inspect(block);
  if (cur.kind === 'solid' && cur.id && isProtectedId(cur.id)) return 'skip';
  let perm = e.perm;
  if (!perm) {
    if (!e.id) return 'skip';
    try { perm = BlockPermutation.resolve(fullId(e.id)); } catch (err) { return 'skip'; }
  }
  if (e.solid) rescueEntities(dim, e.x, e.y, e.z);
  try { block.setPermutation(perm); } catch (err) { return 'retry'; }
  return 'done';
}

/**
 * Restore up to `budget` entries. Called by the manager every tick (and by stopAll with a bigger budget).
 * @param {number} budget @returns {number} entries restored this call
 */
export function stepRestore(budget) {
  const now = system.currentTick;
  if (queue.length === 0 && retry.length > 0 && now >= nextRetryTick) {
    queue = retry; retry = []; nextRetryTick = now + 100;
  }
  let done = 0, ops = 0;
  while (queue.length > 0 && ops < budget) {
    const e = /** @type {Entry} */ (queue.pop());
    ops++;
    const r = restoreOne(e);
    if (r === 'retry') {
      e.tries++;
      if (e.tries > 30) { journal.delete(key(e.dim, e.x, e.y, e.z)); stats.blocksRestoreSkipped++; } else retry.push(e);
      continue;
    }
    journal.delete(key(e.dim, e.x, e.y, e.z));
    if (r === 'done') { stats.blocksRestored++; done++; } else stats.blocksRestoreSkipped++;
  }
  stats.restoreOpsTick += ops;
  if (ops > 0) { dirty = true; stats.journalSize = journal.size; }
  return done;
}

// ---- persistence (crash recovery) -------------------------------------------------------------------------------
/** Write the journal to world dynamic properties (throttled; force to write now). @param {boolean} [force] */
export function flushJournal(force) {
  const now = system.currentTick;
  if (!dirty || (!force && now - lastFlush < 100)) return;
  lastFlush = now;
  dirty = false;
  try {
    /** @type {string[]} */
    const chunks = [];
    let cur = '';
    for (const e of journal.values()) {
      if (!e.id) continue;
      const line = DIMENSION_IDS.indexOf(e.dim) + ',' + e.x + ',' + e.y + ',' + e.z + ',' + e.id + (e.solid ? ',1' : ',0') + ';';
      if (cur.length + line.length > JOURNAL_CHUNK_CHARS) { chunks.push(cur); cur = ''; }
      cur += line;
    }
    if (cur) chunks.push(cur);
    const prev = Number(world.getDynamicProperty(PROP.journalCount) || 0);
    for (let i = 0; i < chunks.length; i++) world.setDynamicProperty(PROP.journalPrefix + i, chunks[i]);
    for (let i = chunks.length; i < prev; i++) world.setDynamicProperty(PROP.journalPrefix + i, undefined);
    world.setDynamicProperty(PROP.journalCount, chunks.length);
  } catch (e) {
    warn('journal flush failed: ' + (e && e.message));
  }
}

/** After a crash/quit mid-disaster: queue persisted edits for restoring. @returns {number} entries loaded */
export function recoverJournal() {
  let n = 0;
  try {
    const count = Number(world.getDynamicProperty(PROP.journalCount) || 0);
    for (let i = 0; i < count; i++) {
      const raw = world.getDynamicProperty(PROP.journalPrefix + i);
      if (typeof raw !== 'string') continue;
      const lines = raw.split(';');
      for (let j = 0; j < lines.length; j++) {
        const p = lines[j].split(',');
        if (p.length < 6) continue;
        const dn = DIMENSION_IDS[Number(p[0])];
        if (!dn) continue;
        const e = { dim: dn, x: Number(p[1]), y: Number(p[2]), z: Number(p[3]), perm: null, id: p[4], solid: p[5] === '1', owner: -1, tries: 0 };
        const k = key(dn, e.x, e.y, e.z);
        if (journal.has(k)) continue;
        journal.set(k, e);
        queue.push(e);
        n++;
      }
    }
    if (n > 0) { dirty = true; stats.journalSize = journal.size; }
  } catch (e) {
    warn('journal recovery failed: ' + (e && e.message));
  }
  return n;
}
