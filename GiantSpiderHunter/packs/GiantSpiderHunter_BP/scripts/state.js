// Persistent world state (world dynamic properties):
//   gsh:config  - config overrides (JSON object, see config.js)
//   gsh:active  - the active auto encounter {serial, entityId, focusId, focusName, pos, dim, missing}
//   gsh:spawner - spawner bookkeeping {nextSerial, cooldown, peacefulBackoff, retired[]}
import { world } from '@minecraft/server';
import { applyOverrides, serializeOverrides } from './config.js';
import { warn } from './effects.js';

export const DP_CONFIG = 'gsh:config';
export const DP_ACTIVE = 'gsh:active';
export const DP_SPAWNER = 'gsh:spawner';

// Entity / player dynamic properties
export const DP_ENCOUNTER = 'gsh:encounter'; // number: encounter serial of an auto spider
export const DP_FOCUS = 'gsh:focus'; // string: focus player id
export const DP_HP_INIT = 'gsh:hp_init'; // boolean: health buffer initialised
export const DP_LOOT_DONE = 'gsh:loot_done'; // boolean: death loot already dropped
export const DP_CH_GIVEN = 'gsh:ch_given'; // boolean: challenge kit given to this player
export const DP_CH_LIVES = 'gsh:ch_lives'; // number: challenge lives left
export const DP_CH_OUT = 'gsh:ch_out'; // boolean: out of lives (spectator)

export const AUTO_TAG = 'gsh_auto';
export const ENTITY_ID = 'horror:giant_spider';

export const store = {
  active: null,
  nextSerial: 1,
  cooldown: 0,
  peacefulBackoff: 0,
  retired: [],
};

let dirtyActive = false;
let dirtySpawner = false;

function readJson(id) {
  try {
    const raw = world.getDynamicProperty(id);
    if (typeof raw !== 'string' || raw.length === 0) return undefined;
    return JSON.parse(raw);
  } catch (e) {
    warn(`could not read ${id}: ${e}`);
    return undefined;
  }
}

function writeJson(id, value) {
  try {
    world.setDynamicProperty(id, value === undefined || value === null ? undefined : JSON.stringify(value));
    return true;
  } catch (e) {
    warn(`could not write ${id}: ${e}`);
    return false;
  }
}

/** Load config overrides and spawner/encounter state. Returns a short summary string. */
export function loadAll() {
  const cfg = readJson(DP_CONFIG);
  const dropped = applyOverrides(cfg || {});
  if (dropped.length) warn(`ignored invalid config overrides: ${dropped.join(', ')}`);
  const sp = readJson(DP_SPAWNER);
  if (sp && typeof sp === 'object') {
    store.nextSerial = Number.isFinite(sp.nextSerial) ? Math.max(1, Math.floor(sp.nextSerial)) : 1;
    store.cooldown = Number.isFinite(sp.cooldown) ? Math.max(0, sp.cooldown) : 0;
    store.peacefulBackoff = Number.isFinite(sp.peacefulBackoff) ? Math.max(0, sp.peacefulBackoff) : 0;
    store.retired = Array.isArray(sp.retired) ? sp.retired.filter((n) => Number.isFinite(n)).slice(-32) : [];
  }
  const act = readJson(DP_ACTIVE);
  if (act && typeof act === 'object' && Number.isFinite(act.serial)) {
    store.active = {
      serial: act.serial,
      entityId: typeof act.entityId === 'string' ? act.entityId : '',
      focusId: typeof act.focusId === 'string' ? act.focusId : '',
      focusName: typeof act.focusName === 'string' ? act.focusName : '',
      pos: act.pos && Number.isFinite(act.pos.x) ? act.pos : null,
      dim: typeof act.dim === 'string' ? act.dim : 'minecraft:overworld',
      missing: 0,
    };
    if (store.active.serial >= store.nextSerial) store.nextSerial = store.active.serial + 1;
  } else {
    store.active = null;
  }
  return `overrides=${Object.keys(cfg || {}).length} active=${store.active ? store.active.serial : 'none'} cooldown=${Math.round(store.cooldown)}s`;
}

export function saveConfig() {
  return writeJson(DP_CONFIG, JSON.parse(serializeOverrides()));
}

export function markActiveDirty() {
  dirtyActive = true;
}

export function markSpawnerDirty() {
  dirtySpawner = true;
}

/** Write dirty state. Called periodically and after important changes. */
export function flush() {
  if (dirtyActive) {
    const a = store.active;
    writeJson(
      DP_ACTIVE,
      a
        ? {
            serial: a.serial,
            entityId: a.entityId,
            focusId: a.focusId,
            focusName: a.focusName,
            pos: a.pos ? { x: Math.round(a.pos.x * 10) / 10, y: Math.round(a.pos.y * 10) / 10, z: Math.round(a.pos.z * 10) / 10 } : null,
            dim: a.dim,
          }
        : null
    );
    dirtyActive = false;
  }
  if (dirtySpawner) {
    writeJson(DP_SPAWNER, {
      nextSerial: store.nextSerial,
      cooldown: Math.round(store.cooldown),
      peacefulBackoff: Math.round(store.peacefulBackoff),
      retired: store.retired.slice(-32),
    });
    dirtySpawner = false;
  }
}

export function isRetired(serial) {
  return store.retired.includes(serial);
}

export function retire(serial) {
  if (!Number.isFinite(serial) || store.retired.includes(serial)) return;
  store.retired.push(serial);
  if (store.retired.length > 32) store.retired.splice(0, store.retired.length - 32);
  dirtySpawner = true;
}

export function allocateSerial() {
  const s = store.nextSerial;
  store.nextSerial = s + 1;
  dirtySpawner = true;
  return s;
}

/** Forget everything about encounters (gsh:reset). Config overrides are kept. */
export function resetState() {
  store.active = null;
  store.cooldown = 0;
  store.peacefulBackoff = 0;
  dirtyActive = true;
  dirtySpawner = true;
  flush();
}
