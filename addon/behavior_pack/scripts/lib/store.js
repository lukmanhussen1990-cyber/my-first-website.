// @ts-check
// JSON store on top of world dynamic properties (SPEC §4).
//
// A dynamic-property string is limited to 32767 characters, so large values
// are chunked transparently:
//   key      -> "#pas-chunks:<n>#" + part 0      (only when n > 1)
//   key#1    -> part 1
//   key#2    -> part 2 ...
// Small values are stored as plain JSON in `key` (a JSON text never starts
// with '#', so the two forms cannot be confused). Each part is at most
// CHUNK_BYTES bytes of UTF-8, which also keeps it below 32767 characters.

import { world, system } from "@minecraft/server";
import { logError } from "./util.js";

/** Max UTF-8 bytes per stored part (safe whether the engine counts chars or bytes). */
export const CHUNK_BYTES = 30000;
/** scheduleSave writes each key at most once per this many ticks. */
export const SAVE_INTERVAL_TICKS = 20;

const HEADER_PREFIX = "#pas-chunks:";

/**
 * @param {string} key
 * @param {number} i
 * @returns {string}
 */
function partKey(key, i) {
  return `${key}#${i}`;
}

/**
 * UTF-8 byte length of a code point.
 * @param {number} cp
 * @returns {number}
 */
function utf8Len(cp) {
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

/**
 * Split a string into parts of at most `maxBytes` UTF-8 bytes without
 * cutting surrogate pairs.
 * @param {string} s
 * @param {number} maxBytes
 * @returns {string[]}
 */
export function splitUtf8(s, maxBytes) {
  /** @type {string[]} */
  const parts = [];
  // fast path: pure ASCII
  if (/^[\x00-\x7f]*$/.test(s)) {
    for (let i = 0; i < s.length; i += maxBytes) parts.push(s.slice(i, i + maxBytes));
    if (parts.length === 0) parts.push("");
    return parts;
  }
  let start = 0;
  let bytes = 0;
  let i = 0;
  while (i < s.length) {
    const cp = /** @type {number} */ (s.codePointAt(i));
    const units = cp > 0xffff ? 2 : 1;
    const b = utf8Len(cp);
    if (bytes + b > maxBytes) {
      parts.push(s.slice(start, i));
      start = i;
      bytes = 0;
    }
    bytes += b;
    i += units;
  }
  parts.push(s.slice(start));
  return parts;
}

/**
 * Number of chunk parts recorded in the header of `head`, or 1 for plain values.
 * @param {unknown} head
 * @returns {number}
 */
function partCount(head) {
  if (typeof head !== "string" || !head.startsWith(HEADER_PREFIX)) return 1;
  const end = head.indexOf("#", HEADER_PREFIX.length);
  const n = Number(head.slice(HEADER_PREFIX.length, end));
  return end > 0 && Number.isInteger(n) && n > 0 ? n : 1;
}

/**
 * Read the raw (joined) string stored under `key`, or undefined.
 * @param {string} key
 * @returns {string | undefined}
 */
export function loadRaw(key) {
  const head = world.getDynamicProperty(key);
  if (typeof head !== "string") return undefined;
  if (!head.startsWith(HEADER_PREFIX)) return head;
  const end = head.indexOf("#", HEADER_PREFIX.length);
  const n = partCount(head);
  let out = head.slice(end + 1);
  for (let i = 1; i < n; i++) {
    const part = world.getDynamicProperty(partKey(key, i));
    if (typeof part !== "string") throw new Error(`store: missing chunk ${i}/${n} of "${key}"`);
    out += part;
  }
  return out;
}

/**
 * Store a raw string under `key`, chunking as needed and deleting stale parts.
 * @param {string} key
 * @param {string} text
 */
export function saveRaw(key, text) {
  const oldCount = partCount(world.getDynamicProperty(key));
  const parts = splitUtf8(text, CHUNK_BYTES);
  // Write continuation parts first, then the head, so a crash mid-save leaves
  // either the old head (with its own old parts mostly intact) or the new one.
  for (let i = 1; i < parts.length; i++) world.setDynamicProperty(partKey(key, i), parts[i]);
  if (parts.length === 1) world.setDynamicProperty(key, parts[0]);
  else world.setDynamicProperty(key, `${HEADER_PREFIX}${parts.length}#${parts[0]}`);
  // clear parts no longer used (also sweeps leftovers beyond the old header count)
  for (let i = parts.length; i < Math.max(oldCount, parts.length) + 64; i++) {
    const k = partKey(key, i);
    if (i >= oldCount && world.getDynamicProperty(k) === undefined) break;
    world.setDynamicProperty(k, undefined);
  }
}

/**
 * Parse the JSON stored under `key`; returns `fallback` when absent or corrupt.
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
export function loadJSON(key, fallback) {
  try {
    const raw = loadRaw(key);
    if (raw === undefined) return fallback;
    return /** @type {T} */ (JSON.parse(raw));
  } catch (e) {
    logError(`store.load(${key})`, e);
    return fallback;
  }
}

/**
 * Serialize `value` as JSON under `key` (chunked when large).
 * Passing `undefined` deletes the key and all its parts.
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean} success
 */
export function saveJSON(key, value) {
  try {
    if (value === undefined) {
      deleteKey(key);
      return true;
    }
    const text = JSON.stringify(value);
    if (text === undefined) throw new Error("value is not JSON-serialisable");
    saveRaw(key, text);
    return true;
  } catch (e) {
    logError(`store.save(${key})`, e);
    return false;
  }
}

/**
 * Remove `key` and its chunk parts.
 * @param {string} key
 */
export function deleteKey(key) {
  const n = partCount(world.getDynamicProperty(key));
  world.setDynamicProperty(key, undefined);
  for (let i = 1; i < n + 64; i++) {
    const k = partKey(key, i);
    if (i >= n && world.getDynamicProperty(k) === undefined) break;
    world.setDynamicProperty(k, undefined);
  }
}

/**
 * @typedef {object} PendingSave
 * @property {() => unknown} getter
 * @property {boolean} pending
 * @property {number} lastSave tick of the last write (or -Infinity)
 * @property {number | undefined} runId
 */

/** @type {Map<string, PendingSave>} */
const pendingSaves = new Map();

/**
 * @param {string} key
 * @param {PendingSave} st
 */
function doScheduledSave(key, st) {
  st.pending = false;
  st.runId = undefined;
  st.lastSave = system.currentTick;
  let value;
  try {
    value = st.getter();
  } catch (e) {
    logError(`store.scheduleSave getter(${key})`, e);
    return;
  }
  saveJSON(key, value);
}

/**
 * Save `getter()` under `key` soon, at most once per SAVE_INTERVAL_TICKS.
 * Many calls in a burst collapse into a single write that uses the latest
 * getter. The first write happens on the next tick (or when the interval
 * since the previous write has elapsed).
 * @param {string} key
 * @param {() => unknown} getter
 */
export function scheduleSave(key, getter) {
  let st = pendingSaves.get(key);
  if (!st) {
    st = { getter, pending: false, lastSave: -Infinity, runId: undefined };
    pendingSaves.set(key, st);
  }
  st.getter = getter;
  if (st.pending) return;
  st.pending = true;
  const wait = Math.max(1, st.lastSave + SAVE_INTERVAL_TICKS - system.currentTick);
  const s = st;
  try {
    st.runId = system.runTimeout(() => doScheduledSave(key, s), wait);
  } catch (e) {
    st.pending = false;
    logError(`store.scheduleSave(${key})`, e);
  }
}

/**
 * Write every pending scheduled save now (e.g. before a big state change).
 * Note: must not be called from inside a before-event.
 */
export function flushSaves() {
  for (const [key, st] of pendingSaves) {
    if (!st.pending) continue;
    if (st.runId !== undefined) {
      try {
        system.clearRun(st.runId);
      } catch {
        // already ran
      }
    }
    doScheduledSave(key, st);
  }
}

/** @returns {boolean} whether any scheduled save is still waiting. */
export function hasPendingSaves() {
  for (const st of pendingSaves.values()) if (st.pending) return true;
  return false;
}
