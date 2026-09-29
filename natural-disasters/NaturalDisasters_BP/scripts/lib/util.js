// Small shared helpers: vector math, seeded PRNG, safe wrappers, logging.
import { world, system } from '@minecraft/server';
import { stats } from './stats.js';

/** @typedef {import('@minecraft/server').Vector3} Vector3 */
/** @typedef {import('@minecraft/server').Dimension} Dimension */
/** @typedef {import('@minecraft/server').Entity} Entity */
/** @typedef {import('@minecraft/server').Player} Player */

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function isNum(v) { return typeof v === 'number' && isFinite(v); }

/** @param {Vector3} a @param {Vector3} b */
export function vadd(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
/** @param {Vector3} a @param {Vector3} b */
export function vsub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
/** @param {Vector3} a @param {number} s */
export function vscale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
/** @param {Vector3} a */
export function vlen(a) { return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z); }
/** @param {Vector3} a */
export function vnorm(a) {
  const l = vlen(a);
  return l > 1e-6 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: 0, z: 0 };
}
/** @param {Vector3} a @param {Vector3} b */
export function dist(a, b) { return vlen(vsub(a, b)); }
/** @param {Vector3} a @param {Vector3} b */
export function distXZ(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); }
/** @param {Vector3} a @param {Vector3} b */
export function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return dx * dx + dy * dy + dz * dz; }
/** @param {Vector3} a */
export function floorV(a) { return { x: Math.floor(a.x), y: Math.floor(a.y), z: Math.floor(a.z) }; }

/** Deterministic PRNG in [0,1). @param {number} seed */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function errMsg(e) {
  if (e === undefined || e === null) return 'unknown error';
  if (typeof e === 'string') return e;
  const m = e.message !== undefined ? String(e.message) : String(e);
  return e.name && e.name !== 'Error' ? e.name + ': ' + m : m;
}

// ---- logging -------------------------------------------------------------------------------------------------
let debugOn = false;
let chatBudget = 0;
let chatBudgetTick = -1;
/** @param {boolean} on */
export function setDebug(on) { debugOn = !!on; }
export function isDebug() { return debugOn; }

/** Always console.warn; chat only when the debug setting is on (max 4 messages per second). */
export function warn(msg) {
  stats.errors++;
  try { console.warn('[ND] ' + msg); } catch (e) { /* ignore */ }
  if (!debugOn) return;
  try {
    const t = system.currentTick;
    if (t - chatBudgetTick >= 20) { chatBudgetTick = t; chatBudget = 4; }
    if (chatBudget <= 0) return;
    chatBudget--;
    world.sendMessage('§7[ND] ' + msg);
  } catch (e) { /* ignore */ }
}

/** console.log; chat too when debug. */
export function info(msg) {
  try { console.log('[ND] ' + msg); } catch (e) { /* ignore */ }
  if (!debugOn) return;
  try { world.sendMessage('§7[ND] ' + msg); } catch (e) { /* ignore */ }
}

// ---- safe wrappers ---------------------------------------------------------------------------------------------
/** True when the entity handle can still be used. Never throws. @param {Entity|undefined|null} e */
export function isValidEntity(e) {
  try { return !!e && e.isValid(); } catch (err) { return false; }
}

/**
 * Run a command, never throws.
 * @param {{runCommand(c: string): {successCount: number}}} target Dimension or Entity
 * @param {string} cmd command WITHOUT leading slash
 * @returns {{ok: boolean, successCount: number}}
 */
export function safeCommand(target, cmd) {
  stats.commandsTotal++;
  stats.commandsTick++;
  try {
    const r = target.runCommand(cmd);
    const n = r && typeof r.successCount === 'number' ? r.successCount : 0;
    if (n <= 0) stats.commandFailures++;
    return { ok: n > 0, successCount: n };
  } catch (e) {
    stats.commandFailures++;
    return { ok: false, successCount: 0 };
  }
}

/** @type {Map<string, Dimension>} */
const dimCache = new Map();
/** @param {string} id 'overworld' | 'nether' | 'the_end' (with or without minecraft:) @returns {Dimension|undefined} */
export function getDimension(id) {
  const key = id.startsWith('minecraft:') ? id.slice(10) : id;
  let d = dimCache.get(key);
  if (!d) {
    try { d = world.getDimension(key); } catch (e) { return undefined; }
    if (d) dimCache.set(key, d);
  }
  return d;
}

/** Short dimension id without the "minecraft:" prefix. @param {Dimension} d */
export function dimName(d) {
  const id = d.id;
  return id.startsWith('minecraft:') ? id.slice(10) : id;
}

/** Promise that resolves after n ticks (uses system.runTimeout). @param {number} n */
export function sleepTicks(n) {
  return new Promise((resolve) => { system.runTimeout(() => resolve(undefined), Math.max(1, n | 0)); });
}

/** Position key for block maps. */
export function blockKey(dim, x, y, z) { return dim + '|' + x + '|' + y + '|' + z; }

export function fmt1(n) { return (Math.round(n * 10) / 10).toString(); }
