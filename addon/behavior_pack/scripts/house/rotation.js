// @ts-check
// Orientation of the Luxury Base (SPEC §6): which way the house is turned, where its
// rotated box lands, and the runtime calibration of the engine's Rotate90 direction.
//
// Conventions (Bedrock): +x east, +z south, +y up. "Clockwise" is viewed from above
// (north at the top): north -> east -> south -> west.
//
// Geometry is computed in "quarter turns clockwise" (q = 0..3), which is what the house
// really needs. Only the final StructureRotation value depends on how the engine
// interprets Rotate90; that is measured once per session by a tiny probe structure
// (see runProbe) instead of being assumed.

import { world, BlockPermutation, StructureRotation, StructureSaveMode } from "@minecraft/server";
import { logError } from "../lib/util.js";
import { HOUSE } from "./blueprint_meta.js";

/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("../lib/util.js").Cardinal} Cardinal */
/** @typedef {"cw" | "ccw"} Convention how the engine turns StructureRotation.Rotate90, viewed from above */
/** @typedef {{ x: number, y: number, z: number }} Vec3i */

/**
 * @typedef {object} Placement
 * @property {Cardinal} facing the player's facing = direction the house extends away from them
 * @property {number} q clockwise quarter turns applied to the canonical (entrance south) house
 * @property {Vec3i} size canonical structure size (HOUSE.size)
 * @property {Vec3i} rotatedSize size of the rotated box in world axes
 * @property {Vec3i} origin world min corner of the rotated box (= StructureManager.place location)
 * @property {Vec3i} min same as origin
 * @property {Vec3i} max inclusive world max corner of the box
 * @property {Vec3i} anchorLocal local cell that lands on the clicked column
 * @property {Vec3i} ground the clicked ground block (local y -1 under the anchor)
 */

/** Rotation values by clockwise quarter turns under the "cw" convention. */
const ROTATIONS_CW = Object.freeze([
  StructureRotation.None,
  StructureRotation.Rotate90,
  StructureRotation.Rotate180,
  StructureRotation.Rotate270,
]);

/** /structure load rotation argument for each StructureRotation (mojang-commands.json enum "Rotation"). */
export const ROTATION_DEGREES = Object.freeze({
  [StructureRotation.None]: "0_degrees",
  [StructureRotation.Rotate90]: "90_degrees",
  [StructureRotation.Rotate180]: "180_degrees",
  [StructureRotation.Rotate270]: "270_degrees",
});

/**
 * Clockwise quarter turns that make the canonical house (entrance on the SOUTH side)
 * extend in `facing` with its entrance facing back toward the player (opposite of `facing`).
 * north -> 0 (canonical: house to the north, door facing south), east -> 1, south -> 2, west -> 3.
 * @param {Cardinal} facing
 * @returns {number}
 */
export function quarterTurnsForFacing(facing) {
  switch (facing) {
    case "north":
      return 0;
    case "east":
      return 1;
    case "south":
      return 2;
    default:
      return 3;
  }
}

/**
 * StructureRotation that turns the structure `q` quarter turns clockwise, given how the
 * engine interprets Rotate90.
 * @param {number} q
 * @param {Convention} convention
 * @returns {StructureRotation}
 */
export function apiRotation(q, convention) {
  const k = ((q % 4) + 4) % 4;
  return ROTATIONS_CW[convention === "ccw" ? (4 - k) % 4 : k];
}

/**
 * @param {Vec3i} size
 * @param {number} q
 * @returns {Vec3i}
 */
export function rotatedSize(size, q) {
  return q % 2 ? { x: size.z, y: size.y, z: size.x } : { x: size.x, y: size.y, z: size.z };
}

/**
 * Offset (from the rotated box's min corner) of a local structure cell after turning
 * the structure q quarter turns clockwise. The rotated box keeps its min corner at the
 * placement location (StructureManager.place / /structure load semantics).
 * @param {Vec3i} local
 * @param {Vec3i} size canonical size
 * @param {number} q
 * @returns {Vec3i}
 */
export function localToOffset(local, size, q) {
  const { x, y, z } = local;
  switch (((q % 4) + 4) % 4) {
    case 1: // (dx, dz) -> (-dz, dx)
      return { x: size.z - 1 - z, y, z: x };
    case 2:
      return { x: size.x - 1 - x, y, z: size.z - 1 - z };
    case 3: // (dx, dz) -> (dz, -dx)
      return { x: z, y, z: size.x - 1 - x };
    default:
      return { x, y, z };
  }
}

/**
 * Inverse of localToOffset.
 * @param {Vec3i} off
 * @param {Vec3i} size canonical size
 * @param {number} q
 * @returns {Vec3i}
 */
export function offsetToLocal(off, size, q) {
  const { x, y, z } = off;
  switch (((q % 4) + 4) % 4) {
    case 1:
      return { x: z, y, z: size.z - 1 - x };
    case 2:
      return { x: size.x - 1 - x, y, z: size.z - 1 - z };
    case 3:
      return { x: size.x - 1 - z, y, z: x };
    default:
      return { x, y, z };
  }
}

/**
 * Local cell that is put on the clicked ground column: the outer terrace cell directly in
 * front of the entrance cell (HOUSE.entrance + 1 toward the entrance side). So, seen from
 * the player: front steps row, then the clicked column, then the entrance cell, then the door.
 * @param {typeof HOUSE} [house]
 * @returns {Vec3i}
 */
export function anchorLocal(house = HOUSE) {
  return { x: house.entrance.x, y: 0, z: Math.min(house.entrance.z + 1, house.size.z - 1) };
}

/**
 * Where the house goes for a click on `ground` by a player facing `facing`.
 * The foundation (local y 0) sits on top of the ground block (y + 1).
 * @param {Vector3} ground clicked ground block location
 * @param {Cardinal} facing
 * @param {typeof HOUSE} [house]
 * @returns {Placement}
 */
export function computePlacement(ground, facing, house = HOUSE) {
  const g = { x: Math.floor(ground.x), y: Math.floor(ground.y), z: Math.floor(ground.z) };
  const q = quarterTurnsForFacing(facing);
  const size = { x: house.size.x, y: house.size.y, z: house.size.z };
  const rs = rotatedSize(size, q);
  const a = anchorLocal(house);
  const ao = localToOffset(a, size, q);
  const origin = { x: g.x - ao.x, y: g.y + 1, z: g.z - ao.z };
  return {
    facing,
    q,
    size,
    rotatedSize: rs,
    origin,
    min: { ...origin },
    max: { x: origin.x + rs.x - 1, y: origin.y + rs.y - 1, z: origin.z + rs.z - 1 },
    anchorLocal: a,
    ground: g,
  };
}

/**
 * World location of a local structure cell for a placement.
 * @param {Placement} pl
 * @param {Vec3i} local
 * @returns {Vec3i}
 */
export function toWorld(pl, local) {
  const o = localToOffset(local, pl.size, pl.q);
  return { x: pl.origin.x + o.x, y: pl.origin.y + o.y, z: pl.origin.z + o.z };
}

/**
 * Local structure cell of a world location (may be outside the structure bounds).
 * @param {Placement} pl
 * @param {Vector3} loc
 * @returns {Vec3i}
 */
export function toLocal(pl, loc) {
  const off = { x: Math.floor(loc.x) - pl.origin.x, y: Math.floor(loc.y) - pl.origin.y, z: Math.floor(loc.z) - pl.origin.z };
  return offsetToLocal(off, pl.size, pl.q);
}

/**
 * Whether two inclusive boxes intersect.
 * @param {{min: Vec3i, max: Vec3i}} a
 * @param {{min: Vec3i, max: Vec3i}} b
 * @returns {boolean}
 */
export function boxesOverlap(a, b) {
  return (
    a.min.x <= b.max.x &&
    b.min.x <= a.max.x &&
    a.min.y <= b.max.y &&
    b.min.y <= a.max.y &&
    a.min.z <= b.max.z &&
    b.min.z <= a.max.z
  );
}

// ---------------------------------------------------------------------------
// Rotation calibration (SPEC §6)
// ---------------------------------------------------------------------------

export const PROBE_ID = "pas:rotation_probe";
export const PROBE_MARKER = "minecraft:glass";
/** Probe structure size and the local cell holding the marker. */
export const PROBE_SIZE = Object.freeze({ x: 2, y: 1, z: 2 });
export const PROBE_MARKER_LOCAL = Object.freeze({ x: 1, y: 0, z: 0 });
/** After this many failed probes in a session the fallback convention is cached. */
export const MAX_CALIBRATION_ATTEMPTS = 3;
/** Ticks to keep re-reading the probe cells if the placement is not visible immediately. */
const PROBE_READ_TRIES = 3;
/** Yield value meaning "continue on the next tick" (see placement.js job runner). */
export const WAIT = 0;

/**
 * @typedef {object} Calibration
 * @property {Convention} convention
 * @property {"probe" | "fallback"} source
 * @property {string} [detail]
 * @property {number} [tick]
 */

/** @type {Calibration | undefined} */
let calibration;
let failedAttempts = 0;
let probeRunning = false;
/**
 * Diagnostics: every probe run (tests read this).
 * @type {{tick: number, origin: Vec3i, cells: Vec3i[], result: string, markerAt?: Vec3i, restored: boolean}[]}
 */
export const calibrationLog = [];

/** Cached calibration, or undefined while unknown. @returns {Calibration | undefined} */
export function getCalibration() {
  return calibration;
}

/** Whether a probe is currently running (another job should wait for it). @returns {boolean} */
export function isProbeRunning() {
  return probeRunning;
}

/** Forget the cached calibration (tests; a new session starts empty anyway). */
export function resetCalibration() {
  calibration = undefined;
  failedAttempts = 0;
  probeRunning = false;
  calibrationLog.length = 0;
}

/**
 * The convention to use now: the calibrated one, else the documented fallback
 * ("Rotate90 = clockwise viewed from above").
 * @returns {Convention}
 */
export function currentConvention() {
  return calibration ? calibration.convention : "cw";
}

/**
 * Record a failed probe. The fallback is used for this placement; after
 * MAX_CALIBRATION_ATTEMPTS failures it is cached so we stop probing.
 * @param {string} reason
 * @param {number} tick
 * @returns {Calibration}
 */
export function noteCalibrationFailure(reason, tick) {
  failedAttempts++;
  logError("house.calibration", new Error(`rotation probe failed (${reason}); using fallback: Rotate90 = clockwise viewed from above`));
  /** @type {Calibration} */
  const fb = { convention: "cw", source: "fallback", detail: reason, tick };
  if (failedAttempts >= MAX_CALIBRATION_ATTEMPTS) calibration = fb;
  return fb;
}

/**
 * The 4x1x4 cells checked/restored around a probe at `origin` (the 2x1x2 probe cells
 * plus a one-cell ring, so a probe that lands off by one is still found and cleaned up).
 * @param {Vec3i} origin
 * @returns {Vec3i[]}
 */
export function probeArea(origin) {
  /** @type {Vec3i[]} */
  const out = [];
  for (let dx = -1; dx <= PROBE_SIZE.x; dx++)
    for (let dz = -1; dz <= PROBE_SIZE.z; dz++) out.push({ x: origin.x + dx, y: origin.y, z: origin.z + dz });
  return out;
}

/**
 * typeId at p, or undefined when unreadable (unloaded, out of range). Never throws.
 * @param {Dimension} dim
 * @param {Vec3i} p
 * @returns {string | undefined}
 */
function typeAt(dim, p) {
  try {
    const b = dim.getBlock(p);
    return b ? b.typeId : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Set p to air if it is not air. Never throws. @returns {boolean} success
 * @param {Dimension} dim
 * @param {Vec3i} p
 */
function clearToAir(dim, p) {
  try {
    const b = dim.getBlock(p);
    if (!b) return false;
    if (b.typeId !== "minecraft:air") b.setType("minecraft:air");
    return true;
  } catch {
    return false;
  }
}

/**
 * Measure how the engine turns Rotate90 with a 2x1x2 in-memory probe placed at `origin`.
 * The probe area (probeArea(origin), 16 cells) must be plain air inside the already-verified
 * empty build volume. Every probe cell is restored to air and the probe structure is deleted.
 * Generator for the placement job runner: yields the number of getBlock calls it is about
 * to make (budget) or WAIT to continue next tick. Returns the calibration (also cached on success).
 * @param {Dimension} dim
 * @param {Vec3i} origin
 * @param {() => number} nowTick
 * @returns {Generator<number, Calibration, void>}
 */
export function* runProbe(dim, origin, nowTick) {
  const area = probeArea(origin);
  /** @type {{tick: number, origin: Vec3i, cells: Vec3i[], result: string, markerAt?: Vec3i, restored: boolean}} */
  const entry = { tick: nowTick(), origin: { ...origin }, cells: area, result: "pending", restored: false };
  calibrationLog.push(entry);
  probeRunning = true;
  try {
    // 1. the probe area must be plain air (it was verified by the scan; re-check right now)
    yield area.length;
    for (const p of area) {
      const t = typeAt(dim, p);
      if (t !== "minecraft:air") {
        entry.result = `probe area not empty (${t ?? "unloaded"} at ${p.x} ${p.y} ${p.z})`;
        entry.restored = true; // nothing was changed
        return noteCalibrationFailure(entry.result, nowTick());
      }
    }
    // 2. build the probe structure in memory
    const sm = world.structureManager;
    try {
      sm.delete(PROBE_ID); // left over from an interrupted probe (memory structures live for the session)
    } catch {
      // not present
    }
    /** @type {import("@minecraft/server").Structure} */
    let probe;
    try {
      probe = sm.createEmpty(PROBE_ID, PROBE_SIZE, StructureSaveMode.Memory);
      probe.setBlockPermutation(PROBE_MARKER_LOCAL, BlockPermutation.resolve(PROBE_MARKER));
    } catch (e) {
      try {
        sm.delete(PROBE_ID);
      } catch {
        // ignore
      }
      entry.result = `probe structure could not be created (${errText(e)})`;
      entry.restored = true;
      return noteCalibrationFailure(entry.result, nowTick());
    }
    // 3. place it with Rotate90 and read back where the marker went
    /** @type {Vec3i[]} */
    let markers = [];
    let placeError = "";
    try {
      sm.place(probe, dim, origin, { rotation: StructureRotation.Rotate90, includeEntities: false, waterlogged: false });
    } catch (e) {
      placeError = errText(e);
    }
    if (!placeError) {
      for (let attempt = 0; attempt < PROBE_READ_TRIES; attempt++) {
        yield area.length;
        markers = area.filter((p) => typeAt(dim, p) === PROBE_MARKER);
        if (markers.length) break;
        yield WAIT;
      }
    }
    // 4. restore every probe cell to air, then verify, then drop the structure
    yield area.length;
    for (const p of area) clearToAir(dim, p);
    yield area.length;
    entry.restored = area.every((p) => typeAt(dim, p) === "minecraft:air");
    try {
      sm.delete(PROBE_ID);
    } catch (e) {
      logError("house.calibration.delete", e);
    }
    if (!entry.restored) logError("house.calibration.restore", new Error(`probe cells near ${origin.x} ${origin.y} ${origin.z} could not all be restored to air`));
    if (placeError) {
      entry.result = `probe placement failed (${placeError})`;
      return noteCalibrationFailure(entry.result, nowTick());
    }
    // 5. interpret: local (1,0,0) -> (1,0,1) when turned clockwise, -> (0,0,0) when counter-clockwise
    const cw = { x: origin.x + 1, z: origin.z + 1 };
    const ccw = { x: origin.x, z: origin.z };
    if (markers.length === 1) {
      const m = markers[0];
      entry.markerAt = m;
      if (m.x === cw.x && m.z === cw.z) {
        entry.result = "cw";
        calibration = { convention: "cw", source: "probe", tick: nowTick() };
        return calibration;
      }
      if (m.x === ccw.x && m.z === ccw.z) {
        entry.result = "ccw";
        calibration = { convention: "ccw", source: "probe", tick: nowTick() };
        return calibration;
      }
    }
    entry.result = `unexpected probe result (${markers.length} marker(s)${markers.length ? ` at ${markers.map((m) => `${m.x} ${m.y} ${m.z}`).join(", ")}` : ""})`;
    return noteCalibrationFailure(entry.result, nowTick());
  } finally {
    probeRunning = false;
  }
}

/** @param {unknown} e @returns {string} */
function errText(e) {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}
