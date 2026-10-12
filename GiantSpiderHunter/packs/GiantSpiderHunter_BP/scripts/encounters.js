// The single automatic spawning system and its population control.
//
// * At most ONE auto-managed hunter exists (tag gsh_auto + encounter serial). The active encounter
//   is persisted in the world dynamic property gsh:active, the cooldown/back-offs/serials in
//   gsh:spawner, so world reloads never create a duplicate.
// * The first encounter for a player starts after 60-120 s in the Overworld (survival/adventure).
// * Spawn spots: 32-48 blocks away, surface with free headroom, loaded chunks, forest preferred.
// * Orphans (spider unloaded far away for long) and duplicates (an old serial reloading) are
//   retired / removed. Player death -> respawn grace; disconnect -> focus dropped.
import { world } from '@minecraft/server';
import { CONFIG } from './config.js';
import { neighboursLoaded, surfaceSpot, woodNearby } from './blocks.js';
import { forestRequired, spawnCandidate, viewYaw } from './geometry.js';
import { debug, log, warn } from './effects.js';
import { OVERWORLD, allPlayers, eligiblePlayers, findPlayerById, isEligible } from './players.js';
import {
  AUTO_TAG,
  DP_ENCOUNTER,
  DP_FOCUS,
  ENTITY_ID,
  allocateSerial,
  flush,
  isRetired,
  markActiveDirty,
  markSpawnerDirty,
  retire,
  store,
} from './state.js';
import { controllers, hooks, register } from './spider.js';
import { TPS, dist, randRange } from './util.js';

const rng = Math.random;

/** playerId -> {secs, need} : continuous eligible Overworld seconds and the randomised threshold */
const timers = new Map();
/** playerId -> tick until which the player is ignored (respawn grace) */
const grace = new Map();
/** current spawn search: {playerId, attempt, max} */
let search = null;
let searchBackoffUntil = 0;
let lastScan = -100000;

hooks.inGrace = (playerId) => {
  const until = grace.get(playerId);
  return until !== undefined && until > nowTick;
};

let nowTick = 0;

// ------------------------------------------------------------------ encounter lifecycle
function startCooldown() {
  store.cooldown = randRange(CONFIG.encounterCooldownMin, CONFIG.encounterCooldownMax, rng);
  markSpawnerDirty();
}

/** End the active auto encounter (spider died, despawned, vanished, orphaned...). */
export function endEncounter(reason, opts = {}) {
  const a = store.active;
  if (!a) return;
  retire(a.serial);
  store.active = null;
  markActiveDirty();
  if (opts.peaceful) {
    store.peacefulBackoff = CONFIG.peacefulBackoffSeconds;
    markSpawnerDirty();
  } else {
    startCooldown();
  }
  flush();
  log(`encounter #${a.serial} ended (${reason}); next encounter in ${Math.round(opts.peaceful ? store.peacefulBackoff : store.cooldown)} s`);
}

hooks.encounterEnded = (controller, reason) => {
  if (store.active && controller.serial === store.active.serial) endEncounter(reason);
};

/** Validate an auto spider that just appeared (spawned, loaded from disk, found by a scan). */
export function admitAutoSpider(entity, now) {
  let serial = 0;
  try {
    const s = entity.getDynamicProperty(DP_ENCOUNTER);
    serial = typeof s === 'number' ? s : 0;
  } catch (e) {
    serial = 0;
  }
  const a = store.active;
  if (!a || a.serial !== serial || isRetired(serial)) {
    // duplicate or orphan from an encounter that already ended: remove quietly
    debug(`removing stale auto spider (serial ${serial}, active ${a ? a.serial : 'none'})`);
    try {
      entity.triggerEvent('horror:despawn');
    } catch (e) {
      try {
        entity.remove();
      } catch (err) {
        // already gone
      }
    }
    return false;
  }
  if (a.entityId !== entity.id) {
    a.entityId = entity.id;
    markActiveDirty();
  }
  a.missing = 0;
  register(entity, now);
  return true;
}

// ------------------------------------------------------------------ spawning
function spawnAt(player, pos) {
  const dim = player.dimension;
  let entity;
  try {
    entity = dim.spawnEntity(ENTITY_ID, pos);
  } catch (e) {
    debug(`spawnEntity failed: ${e}`);
    return false;
  }
  const serial = allocateSerial();
  try {
    entity.addTag(AUTO_TAG);
    entity.setDynamicProperty(DP_ENCOUNTER, serial);
    entity.setDynamicProperty(DP_FOCUS, player.id);
    entity.setRotation({ x: 0, y: Math.atan2(-(player.location.x - pos.x), player.location.z - pos.z) * (180 / Math.PI) });
  } catch (e) {
    warn(`could not tag spawned spider: ${e}`);
  }
  store.active = {
    serial,
    entityId: entity.id,
    focusId: player.id,
    focusName: player.name,
    pos: { x: pos.x, y: pos.y, z: pos.z },
    dim: dim.id,
    missing: 0,
  };
  markActiveDirty();
  flush();
  const c = register(entity, nowTick);
  c.auto = true;
  c.serial = serial;
  c.focusId = player.id;
  log(`encounter #${serial} started near ${player.name} at ${Math.round(pos.x)} ${Math.round(pos.y)} ${Math.round(pos.z)}`);
  return true;
}

/** Test one candidate column around `player`; returns a spawn position or null. */
function testCandidate(player, attempt, max, forceAny) {
  const dim = player.dimension;
  let view;
  try {
    view = player.getViewDirection();
  } catch (e) {
    return null;
  }
  const pl = player.location;
  const c = spawnCandidate(rng, pl, viewYaw(view), attempt, max, CONFIG);
  for (const p of allPlayers()) {
    try {
      if (p.dimension.id === dim.id && Math.hypot(p.location.x - c.x, p.location.z - c.z) < CONFIG.spawnMinOtherPlayerDistance) return null;
    } catch (e) {
      // ignore
    }
  }
  const budget = { n: CONFIG.spawnColumnBudget };
  const spot = surfaceSpot(dim, c.x, c.z, Math.floor(pl.y) + 24, Math.floor(pl.y) - 24, 3, budget);
  if (!spot.ok) return null;
  if (!neighboursLoaded(dim, c.x, spot.groundY + 1, c.z, budget)) return null;
  const forest = spot.forest || woodNearby(dim, c.x, spot.groundY + 2, c.z, 3, budget);
  if (!forceAny && forestRequired(attempt, max, CONFIG.spawnForestPreference) && !forest) return null;
  return { x: c.x + 0.5, y: spot.groundY + 1, z: c.z + 0.5, forest };
}

/** Is any spider (auto or manual) already loaded near this player? */
function spiderNear(player, range) {
  try {
    return player.dimension.getEntities({ type: ENTITY_ID, location: player.location, maxDistance: range }).length > 0;
  } catch (e) {
    return false;
  }
}

function continueSearch(now) {
  const player = findPlayerById(search.playerId);
  if (!player || !isEligible(player) || hooks.inGrace(player.id)) {
    search = null;
    return;
  }
  for (let i = 0; i < CONFIG.spawnCandidatesPerSecond; i++) {
    if (search.attempt >= search.max) {
      debug(`spawn search near ${player.name} failed after ${search.max} candidates; backing off`);
      search = null;
      searchBackoffUntil = now + CONFIG.spawnSearchBackoffSeconds * TPS;
      return;
    }
    const pos = testCandidate(player, search.attempt, search.max, search.forceAny);
    search.attempt++;
    if (pos) {
      const ok = spawnAt(player, pos);
      search = null;
      if (!ok) searchBackoffUntil = now + CONFIG.spawnSearchBackoffSeconds * TPS;
      return;
    }
  }
}

/** Start a search immediately near `player` (used by /scriptevent gsh:spawn). */
export function forceSpawnSearch(player) {
  if (store.active) return 'an auto encounter is already active (use gsh:reset first)';
  if (!isEligible(player)) return 'you must be in survival/adventure in the Overworld';
  store.cooldown = 0;
  store.peacefulBackoff = 0;
  markSpawnerDirty();
  search = { playerId: player.id, attempt: 0, max: CONFIG.spawnMaxCandidates, forceAny: false };
  searchBackoffUntil = 0;
  return 'searching for a spawn spot near you...';
}

// ------------------------------------------------------------------ active encounter upkeep
function upkeepActive(now) {
  const a = store.active;
  if (!a) return;
  // the controller for this serial, if loaded
  let ctrl;
  for (const c of controllers.values()) {
    if (c.auto && c.serial === a.serial && c.isValid()) {
      ctrl = c;
      break;
    }
  }
  if (ctrl) {
    a.missing = 0;
    if (now % (5 * TPS) < TPS) {
      try {
        const l = ctrl.entity.location;
        a.pos = { x: l.x, y: l.y, z: l.z };
        a.entityId = ctrl.entity.id;
        a.focusId = ctrl.focusId || a.focusId;
        markActiveDirty();
      } catch (e) {
        // ignore
      }
    }
    return;
  }
  a.missing = (a.missing || 0) + 1;
  // try to find it by id (it may be loaded but not registered yet)
  if (a.entityId) {
    try {
      const e = world.getEntity(a.entityId);
      if (e && e.isValid() && e.typeId === ENTITY_ID) {
        admitAutoSpider(e, now);
        return;
      }
    } catch (err) {
      // not loaded
    }
  }
  let focusFar = true;
  const focus = findPlayerById(a.focusId);
  if (focus && a.pos) {
    try {
      focusFar = focus.dimension.id !== a.dim || dist(focus.location, a.pos) > CONFIG.orphanFarDistance;
    } catch (e) {
      focusFar = true;
    }
  }
  if ((a.missing >= CONFIG.orphanMissingSeconds && focusFar) || a.missing >= CONFIG.orphanMaxMissingSeconds) {
    endEncounter(`spider not loaded for ${a.missing} s`);
  }
}

/** Periodic scan for spiders that are loaded but not registered (cheap: type-filtered). */
function scan(now) {
  if (now - lastScan < 10 * TPS) return;
  lastScan = now;
  for (const id of ['overworld', 'nether', 'the_end']) {
    let list = [];
    try {
      list = world.getDimension(id).getEntities({ type: ENTITY_ID });
    } catch (e) {
      list = [];
    }
    for (const e of list) {
      if (controllers.has(e.id)) continue;
      admit(e, now);
    }
  }
}

/** Register any spider entity (auto spiders go through the population check). */
export function admit(entity, now) {
  try {
    if (!entity.isValid() || entity.typeId !== ENTITY_ID) return;
    if (entity.hasTag(AUTO_TAG)) admitAutoSpider(entity, now);
    else register(entity, now);
  } catch (e) {
    warn(`admit failed: ${e}`);
  }
}

// ------------------------------------------------------------------ per-second tick
export function onSecond(now) {
  nowTick = now;
  scan(now);
  const players = eligiblePlayers();
  const anyone = players.length > 0;
  if (anyone && store.cooldown > 0) {
    store.cooldown = Math.max(0, store.cooldown - 1);
    if (store.cooldown % 10 === 0) markSpawnerDirty();
  }
  if (anyone && store.peacefulBackoff > 0) {
    store.peacefulBackoff = Math.max(0, store.peacefulBackoff - 1);
    if (store.peacefulBackoff % 10 === 0) markSpawnerDirty();
  }
  // first-encounter timers
  const seen = new Set();
  for (const p of allPlayers()) {
    let t = timers.get(p.id);
    if (!t) {
      t = { secs: 0, need: randRange(CONFIG.firstEncounterMinSeconds, CONFIG.firstEncounterMaxSeconds, rng) };
      timers.set(p.id, t);
    }
    seen.add(p.id);
    if (isEligible(p) && !hooks.inGrace(p.id)) t.secs++;
    else if (!isEligible(p)) t.secs = 0;
  }
  for (const id of [...timers.keys()]) if (!seen.has(id)) timers.delete(id);
  for (const [id, until] of [...grace]) if (until <= now) grace.delete(id);

  upkeepActive(now);
  if (!CONFIG.autoSpawn || store.active) {
    if (store.active) search = null;
    return;
  }
  if (search) {
    continueSearch(now);
    return;
  }
  if (store.cooldown > 0 || store.peacefulBackoff > 0 || now < searchBackoffUntil) return;
  // pick the eligible player who has waited longest past their threshold
  let best = null;
  for (const p of players) {
    if (p.dimension.id !== OVERWORLD || hooks.inGrace(p.id)) continue;
    const t = timers.get(p.id);
    if (!t || t.secs < t.need) continue;
    if (spiderNear(p, 96)) continue; // a manual spider is already around this player
    if (!best || t.secs - t.need > best.extra) best = { p, extra: t.secs - t.need };
  }
  if (!best) return;
  search = { playerId: best.p.id, attempt: 0, max: CONFIG.spawnMaxCandidates, forceAny: false };
  continueSearch(now);
}

// ------------------------------------------------------------------ player / entity events
export function onPlayerDied(player, now) {
  grace.set(player.id, now + CONFIG.respawnGraceSeconds * TPS);
  const t = timers.get(player.id);
  if (t) {
    t.secs = 0;
    t.need = randRange(CONFIG.firstEncounterMinSeconds, CONFIG.firstEncounterMaxSeconds, rng);
  }
  for (const c of controllers.values()) {
    try {
      c.onFocusLost(player.id, now, 'focus died');
    } catch (e) {
      // ignore
    }
  }
}

export function onPlayerLeft(playerId, now) {
  timers.delete(playerId);
  if (search && search.playerId === playerId) search = null;
  for (const c of controllers.values()) {
    try {
      c.onFocusLost(playerId, now, 'focus left');
    } catch (e) {
      // ignore
    }
  }
}

export function onPeacefulDespawn(entity) {
  let serial = 0;
  try {
    const s = entity.getDynamicProperty(DP_ENCOUNTER);
    serial = typeof s === 'number' ? s : 0;
  } catch (e) {
    serial = 0;
  }
  const c = controllers.get(entity.id);
  if (c) c.removed = true;
  controllers.delete(entity.id);
  if (store.active && serial === store.active.serial) endEncounter('peaceful difficulty', { peaceful: true });
  else if (!store.active) {
    store.peacefulBackoff = Math.max(store.peacefulBackoff, CONFIG.peacefulBackoffSeconds);
    markSpawnerDirty();
  }
}

export function onSpiderDied(entityId, now) {
  const c = controllers.get(entityId);
  controllers.delete(entityId);
  if (c && c.auto && store.active && c.serial === store.active.serial) endEncounter('killed');
  else if (store.active && store.active.entityId === entityId) endEncounter('killed');
}

export function status() {
  const a = store.active;
  const lines = [];
  lines.push(`auto spawn: ${CONFIG.autoSpawn ? 'on' : 'off'}, challenge: ${CONFIG.challengeMode ? 'on' : 'off'}, relentless: ${CONFIG.relentless ? 'on' : 'off'}`);
  lines.push(a ? `active encounter #${a.serial} focus ${a.focusName || a.focusId} missing ${a.missing}s` : 'no active encounter');
  lines.push(`cooldown ${Math.round(store.cooldown)} s, peaceful back-off ${Math.round(store.peacefulBackoff)} s, search ${search ? `${search.attempt}/${search.max}` : 'idle'}`);
  for (const [id, t] of timers) {
    const p = findPlayerById(id);
    lines.push(`  ${p ? p.name : id}: ${t.secs}/${Math.round(t.need)} s${hooks.inGrace(id) ? ' (grace)' : ''}`);
  }
  for (const c of controllers.values()) {
    let pos = '?';
    try {
      const l = c.entity.location;
      pos = `${Math.round(l.x)} ${Math.round(l.y)} ${Math.round(l.z)}`;
    } catch (e) {
      // ignore
    }
    const f = c.focusId ? findPlayerById(c.focusId) : undefined;
    lines.push(`  spider ${c.auto ? `#${c.serial}` : 'manual'} ${c.state} at ${pos} focus ${f ? f.name : '-'}`);
  }
  return lines.join('\n');
}

/** gsh:reset - despawn every auto spider and forget encounter state (config kept). */
export function resetEncounters(now) {
  for (const c of [...controllers.values()]) {
    if (c.auto) {
      c.auto = false; // do not trigger encounterEnded again
      c.despawn(now, 'reset');
      controllers.delete(c.id);
    }
  }
  for (const id of ['overworld', 'nether', 'the_end']) {
    try {
      for (const e of world.getDimension(id).getEntities({ type: ENTITY_ID, tags: [AUTO_TAG] })) e.triggerEvent('horror:despawn');
    } catch (e) {
      // ignore
    }
  }
  search = null;
  searchBackoffUntil = 0;
  for (const t of timers.values()) t.secs = 0;
}
