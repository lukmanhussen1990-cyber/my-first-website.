// Disaster manager: starts/stops instances, drives them on a staggered interval, enforces caps, cleans up.
import { system } from '@minecraft/server';
import { stats, resetTickStats, foldPeaks } from './stats.js';
import { qualityTier, snapshotSettings, getSettings } from './settings.js';
import { startJob, cancelJobsOf, cancelAllJobs, stepJobs } from './jobs.js';
import * as fx from './fx.js';
import * as ent from './entities.js';
import * as blk from './blocks.js';
import { warn, info, mulberry32, errMsg, getDimension, clamp } from './util.js';
import { DISASTER_IDS, STRENGTH_MUL, CAPS } from '../config.js';
import { DISASTERS } from '../disasters/index.js';

/** @typedef {import('@minecraft/server').Vector3} Vector3 */
/** @typedef {import('@minecraft/server').Dimension} Dimension */
/** @typedef {import('@minecraft/server').Player} Player */
/** @typedef {import('@minecraft/server').Entity} Entity */

/**
 * @typedef {Object} Ctx
 * @property {number} id instance id (owner of entities/blocks/jobs)
 * @property {string} disaster @property {string} variant
 * @property {Dimension} dim @property {Vector3} origin @property {Player|undefined} source
 * @property {Readonly<import('../config.js').Settings>} settings
 * @property {number} strength 1..5 @property {number} mul strength multiplier
 * @property {number} durationTicks @property {number} startTick
 * @property {number} dt ticks since previous update() call
 * @property {() => number} rng
 * @property {import('../config.js').QualityTier} q
 * @property {() => number} age ticks since start
 * @property {() => number} progress 0..1 of the planned duration
 * @property {(type: string, loc: Vector3, ttl?: number, max?: number) => Entity|undefined} spawn tracked temp entity
 * @property {(x: number, y: number, z: number, id: string, opts?: any) => string} setBlock
 * @property {(fn: () => Generator<any, any, any>) => any} job time-sliced job owned by this instance
 * @property {(r?: number) => Entity[]} victims
 * @property {() => void} finish ask the manager to end this disaster normally
 * @property {(text: string) => void} say action-bar message for everyone nearby
 */

/**
 * @typedef {Object} Instance
 * @property {number} id @property {string} disaster @property {any} mod @property {Ctx} ctx
 * @property {{update: (n: number) => boolean|void, dispose: (reason: string) => void}} handle
 * @property {number} lastUpdate @property {number} updates @property {number} errors @property {boolean} wantEnd
 * @property {boolean} disposed
 */

/** @type {Instance[]} */
let active = [];
let nextId = 1;
let started = false;

/** Ids of active disasters for the status command. */
export function activeList() {
  return active.map((i) => i.disaster + '#' + i.id + '(' + i.ctx.variant + ', ' + Math.round(i.ctx.age() / 20) + 's)');
}
export function activeCount() { return active.length; }

/**
 * Start a disaster. @returns {{ok: boolean, reason?: string, id?: number}}
 * @param {string} disasterId @param {string} variant @param {Dimension} dim @param {Vector3} origin @param {Player} [source]
 */
export function startDisaster(disasterId, variant, dim, origin, source) {
  const mod = DISASTERS[disasterId];
  if (!mod) return { ok: false, reason: 'Unknown disaster: ' + disasterId };
  const q = qualityTier();
  if (active.length >= q.maxConcurrent) {
    stats.disastersRejected++;
    return { ok: false, reason: 'Too many disasters active (' + active.length + '/' + q.maxConcurrent + '). Use STOP ALL DISASTERS or wait.' };
  }
  let same = 0;
  for (let i = 0; i < active.length; i++) if (active[i].disaster === disasterId) same++;
  if (same >= 2) {
    stats.disastersRejected++;
    return { ok: false, reason: 'Two ' + disasterId + ' disasters are already running.' };
  }
  const settings = snapshotSettings();
  const id = nextId++;
  const startTick = system.currentTick;
  const mul = STRENGTH_MUL[settings.strength] || 1;
  const durationTicks = Math.max(100, Math.round(mod.defaultDurationSec * 20 * (settings.durationPct / 100)));
  const rng = mulberry32((startTick * 2654435761 + id * 97) >>> 0);
  /** @type {Ctx} */
  const ctx = {
    id, disaster: disasterId, variant: variant || 'default', dim, origin, source, settings,
    strength: settings.strength, mul, durationTicks, startTick, dt: 1, rng, q,
    age: () => system.currentTick - startTick,
    progress: () => clamp((system.currentTick - startTick) / durationTicks, 0, 1),
    spawn: (type, loc, ttl, max) => ent.spawnTemp(dim, type, loc, { owner: id, ttlTicks: ttl, maxOwned: max }),
    setBlock: (x, y, z, bid, opts) => blk.setBlock(id, dim, x, y, z, bid, opts),
    job: (fn) => startJob(id, fn),
    victims: (r) => ent.victims(dim, origin, r || 48, { key: 'i' + id }),
    finish: () => { const inst = find(id); if (inst) inst.wantEnd = true; },
    say: (text) => fx.actionBarAll(dim, text),
  };
  /** @type {any} */
  let handle;
  try {
    handle = mod.create(ctx);
  } catch (e) {
    warn(disasterId + ' create failed: ' + errMsg(e));
    stats.disastersRejected++;
    try { cleanupOwner(id); } catch (err) { /* ignore */ }
    return { ok: false, reason: 'Could not start ' + disasterId + ' (see log).' };
  }
  if (!handle || typeof handle.update !== 'function') return { ok: false, reason: 'Broken module ' + disasterId };
  active.push({ id, disaster: disasterId, mod, ctx, handle, lastUpdate: startTick - q.updateInterval, updates: 0, errors: 0, wantEnd: false, disposed: false });
  stats.disastersStarted++;
  stats.activeDisasters = active.length;
  info('started ' + disasterId + '/' + ctx.variant + ' #' + id + ' strength ' + settings.strength + ' duration ' + Math.round(durationTicks / 20) + 's');
  return { ok: true, id };
}

/** @param {number} id */
function find(id) {
  for (let i = 0; i < active.length; i++) if (active[i].id === id) return active[i];
  return undefined;
}

/** @param {number} owner */
function cleanupOwner(owner) {
  cancelJobsOf(owner);
  ent.removeOwned(owner);
  ent.clearScanCache('i' + owner);
  blk.releaseOwner(owner);
}

/** @param {Instance} inst @param {string} reason */
function endInstance(inst, reason) {
  if (inst.disposed) return;
  inst.disposed = true;
  try { inst.handle.dispose(reason); } catch (e) { warn(inst.disaster + ' dispose failed: ' + errMsg(e)); }
  try { cleanupOwner(inst.id); } catch (e) { warn('cleanup failed: ' + errMsg(e)); }
  stats.disastersFinished++;
  info('ended ' + inst.disaster + ' #' + inst.id + ' (' + reason + ')');
}

/** Global cleanup after the last disaster ended (or STOP ALL). */
function globalCleanup() {
  fx.cleanupFx(DISASTER_IDS, getDimension('overworld'));
  ent.clearAllProtection();
}

/**
 * Immediately end every disaster and remove all temporary entities/particles/effects. Block edits restore over the next ticks.
 * @param {string} [reason]
 * @returns {{disasters: number, entities: number, blocks: number}}
 */
export function stopAll(reason) {
  const n = active.length;
  const list = active.slice();
  active = [];
  for (let i = 0; i < list.length; i++) endInstance(list[i], reason || 'stopped');
  cancelAllJobs();
  const removed = ent.removeAllTemp();
  const queued = blk.releaseOwner(0);
  blk.stepRestore(1200);
  globalCleanup();
  stats.activeDisasters = 0;
  return { disasters: n, entities: removed, blocks: queued };
}

// ---- main loop ---------------------------------------------------------------------------------------------------
function tick() {
  const now = system.currentTick;
  resetTickStats(now);
  const q = qualityTier();
  try {
    if (active.length > 0) {
      const list = active.slice();
      for (let i = 0; i < list.length; i++) {
        const inst = list[i];
        if (inst.disposed) continue;
        const age = now - inst.ctx.startTick;
        const hardEnd = inst.ctx.durationTicks * CAPS.hardEndFactor + CAPS.hardEndSlackTicks;
        if (age > hardEnd) { endInstance(inst, 'hardend'); continue; }
        if (inst.wantEnd) { endInstance(inst, 'finished'); continue; }
        if ((now + inst.id) % q.updateInterval !== 0 && now - inst.lastUpdate < q.updateInterval * 2) continue;
        if (age > 60 && (now + inst.id) % 40 === 0 && fx.nearestPlayerDist(inst.ctx.dim, inst.ctx.origin) > 220) {
          endInstance(inst, 'abandoned');
          continue;
        }
        inst.ctx.dt = Math.max(1, now - inst.lastUpdate);
        inst.lastUpdate = now;
        try {
          const r = inst.handle.update(inst.updates++);
          if (r === false) endInstance(inst, 'finished');
        } catch (e) {
          inst.errors++;
          stats.updateErrors++;
          warn(inst.disaster + ' update error: ' + errMsg(e));
          if (inst.errors >= 3) endInstance(inst, 'error');
        }
      }
      const before = active.length;
      active = active.filter((i) => !i.disposed);
      stats.activeDisasters = active.length;
      if (before > 0 && active.length === 0) globalCleanup();
    }
    if (now % 10 === 0) ent.tickTracked();
    stepJobs(q.blockOpsPerTick, q.blockOpsPerTick);
    if (blk.pendingRestore() > 0) blk.stepRestore(Math.max(60, Math.floor(q.blockOpsPerTick / 2)));
    blk.flushJournal(false);
  } catch (e) {
    warn('manager tick error: ' + errMsg(e));
  }
  foldPeaks();
}

/** Start the tick loop (once). */
export function initManager() {
  if (started) return;
  started = true;
  system.runInterval(tick, 1);
}

/** World-load cleanup: leftover temp entities, stale fog/shake, recover persisted block journal. */
export function recoverWorld() {
  try {
    const removed = ent.sweepLeftovers();
    const queued = blk.recoverJournal();
    fx.clearAllFogs(DISASTER_IDS);
    if (removed > 0 || queued > 0) info('recovered: removed ' + removed + ' temp entities, ' + queued + ' blocks queued for restore');
  } catch (e) {
    warn('recoverWorld failed: ' + errMsg(e));
  }
}

/** One-line status for /scriptevent nd:status. */
export function statusText() {
  const s = getSettings();
  return 'Active: ' + (active.length ? activeList().join(', ') : 'none') +
    ' | temp entities ' + stats.trackedEntities + ' | journal ' + stats.journalSize + ' (restoring ' + blk.pendingRestore() + ')' +
    ' | particles/tick peak ' + stats.particlesPeak + ' | strength ' + s.strength + ' | destruction ' + (s.blockDestruction ? 'ON' : 'OFF') +
    ' | errors ' + stats.errors;
}
