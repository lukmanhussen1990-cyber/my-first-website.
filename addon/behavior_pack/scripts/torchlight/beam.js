// @ts-check
// Beam geometry of the Tactical Torchlight (SPEC §5): raycast from the eyes along the
// view direction, then three light anchors (spot / mid / near) along that ray, each
// moved to a nearby air cell (or dropped) so that only air is ever replaced.
//
// Everything here only READS the world; writes happen in lights.js.

import { safeGetBlock, floorVec, add, sub, len, logError } from "../lib/util.js";
import {
  MAX_DISTANCE,
  SPOT_LEVEL,
  MID_LEVEL,
  NEAR_LEVEL,
  MID_FRACTION,
  NEAR_DISTANCE,
  WALL_MARGIN,
  WALK_BACK_STEP,
  WALK_BACK_STEPS,
  isLightBlockId,
  stopsBeam,
} from "./constants.js";

/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */

/**
 * Result of casting the beam.
 * @typedef {object} Beam
 * @property {number} dist distance from the eyes to the hit point, or to the beam end
 * @property {Vector3 | undefined} hitCell block that stopped the beam (undefined: nothing within range / unloaded)
 * @property {Vector3 | undefined} normal outward normal of the face that was hit
 * @property {"api" | "dda"} method getBlockFromRay or the manual fallback
 */

/**
 * A light anchor before it is checked against the world.
 * @typedef {object} RawAnchor
 * @property {"spot" | "mid" | "near"} kind
 * @property {number} level light level 0-15
 * @property {Vector3} cell block cell the anchor wants
 * @property {number} t distance along the ray where the anchor sits (walk-back starts here)
 */

/**
 * A light anchor resolved to a usable cell.
 * @typedef {object} Anchor
 * @property {Vector3} cell
 * @property {number} level
 */

/** Options for Dimension.getBlockFromRay (names verified against the 1.11.0 typings: BlockRaycastOptions). */
const RAY_OPTIONS_BASE = Object.freeze({ includeLiquidBlocks: false, includePassableBlocks: false });

/** Outward normal per block face (the cell in front of the face is hitCell + normal). */
const FACE_NORMALS = Object.freeze({
  Up: Object.freeze({ x: 0, y: 1, z: 0 }),
  Down: Object.freeze({ x: 0, y: -1, z: 0 }),
  North: Object.freeze({ x: 0, y: 0, z: -1 }),
  South: Object.freeze({ x: 0, y: 0, z: 1 }),
  East: Object.freeze({ x: 1, y: 0, z: 0 }),
  West: Object.freeze({ x: -1, y: 0, z: 0 }),
});

/** The 6 neighbours tried when neither the anchor cell nor the cells behind it are air. */
const NEIGHBOURS = Object.freeze([
  FACE_NORMALS.Up,
  FACE_NORMALS.Down,
  FACE_NORMALS.North,
  FACE_NORMALS.South,
  FACE_NORMALS.East,
  FACE_NORMALS.West,
]);

/** @type {readonly ("x" | "y" | "z")[]} */
const AXES = Object.freeze(["x", "y", "z"]);

/**
 * Outward normal of a block face, or undefined for an unknown value.
 * @param {string | undefined} face Direction enum value ("Up", "North", ...)
 * @returns {Vector3 | undefined}
 */
export function faceNormal(face) {
  if (typeof face !== "string" || !Object.prototype.hasOwnProperty.call(FACE_NORMALS, face)) return undefined;
  return FACE_NORMALS[/** @type {keyof typeof FACE_NORMALS} */ (face)];
}

/**
 * Point at distance t along the ray.
 * @param {Vector3} origin
 * @param {Vector3} dir unit vector
 * @param {number} t
 * @returns {Vector3}
 */
export function pointAt(origin, dir, t) {
  return { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t };
}

/**
 * Distance at which the ray enters the unit cube of `cell` (slab method), clamped to >= 0.
 * Independent of how a build reports faceLocation. Also returns the normal of the entry face.
 * @param {Vector3} origin
 * @param {Vector3} dir unit vector
 * @param {Vector3} cell
 * @returns {{t: number, normal: Vector3} | undefined} undefined if the ray misses the cell
 */
export function rayEntry(origin, dir, cell) {
  let tNear = -Infinity;
  let tFar = Infinity;
  /** @type {"x" | "y" | "z"} */
  let axis = "y";
  for (const a of AXES) {
    const o = origin[a];
    const d = dir[a];
    const lo = cell[a];
    const hi = cell[a] + 1;
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return undefined;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tNear) {
      tNear = t1;
      axis = a;
    }
    if (t2 < tFar) tFar = t2;
  }
  if (tNear > tFar + 1e-9 || tFar < 0) return undefined;
  const normal = { x: 0, y: 0, z: 0 };
  normal[axis] = dir[axis] > 0 ? -1 : 1;
  return { t: Math.max(0, tNear), normal };
}

/**
 * Normal used when the beam starts inside a solid cell: the face that points back along the
 * dominant axis of the ray (same convention as the game: the side the ray leaves through is
 * not hit, the opposite side is).
 * @param {Vector3} dir
 * @returns {Vector3}
 */
function startNormal(dir) {
  const ax = Math.abs(dir.x);
  const ay = Math.abs(dir.y);
  const az = Math.abs(dir.z);
  if (ax >= ay && ax >= az) return { x: dir.x >= 0 ? -1 : 1, y: 0, z: 0 };
  if (ay >= az) return { x: 0, y: dir.y >= 0 ? -1 : 1, z: 0 };
  return { x: 0, y: 0, z: dir.z >= 0 ? -1 : 1 };
}

/**
 * Cast the beam with Dimension.getBlockFromRay; on any exception (or if a build reports one of
 * our own light blocks as a hit) fall back to a manual voxel walk.
 * @param {Dimension} dim
 * @param {Vector3} origin eye location
 * @param {Vector3} dir unit view direction
 * @param {number} [maxDistance]
 * @returns {Beam}
 */
export function castBeam(dim, origin, dir, maxDistance = MAX_DISTANCE) {
  try {
    const hit = dim.getBlockFromRay(origin, dir, { ...RAY_OPTIONS_BASE, maxDistance });
    if (!hit) return { dist: maxDistance, hitCell: undefined, normal: undefined, method: "api" };
    const block = hit.block;
    if (isLightBlockId(block.typeId)) throw new Error("raycast stopped at a light block");
    const cell = floorVec(block.location);
    const entry = rayEntry(origin, dir, cell);
    const normal = faceNormal(hit.face) ?? entry?.normal ?? startNormal(dir);
    let dist = entry ? entry.t : len(sub(add(cell, { x: 0.5, y: 0.5, z: 0.5 }), origin)) - 0.5;
    dist = Math.min(maxDistance, Math.max(0, dist));
    return { dist, hitCell: cell, normal, method: "api" };
  } catch (e) {
    if (!(e instanceof Error && e.message === "raycast stopped at a light block")) logError("torch.getBlockFromRay", e);
    return castBeamManual(dim, origin, dir, maxDistance);
  }
}

/**
 * Manual voxel walk (Amanatides & Woo DDA) used when getBlockFromRay throws. Air, light
 * blocks, liquids and known collision-less blocks let the beam pass; an unloaded or
 * out-of-world cell ends the beam there. At most ~3 cells per block of distance are read.
 * @param {Dimension} dim
 * @param {Vector3} origin
 * @param {Vector3} dir unit vector
 * @param {number} [maxDistance]
 * @returns {Beam}
 */
export function castBeamManual(dim, origin, dir, maxDistance = MAX_DISTANCE) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const sx = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
  const sy = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0;
  const sz = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;
  const tdx = sx !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tdy = sy !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tdz = sz !== 0 ? Math.abs(1 / dir.z) : Infinity;
  let tmx = sx > 0 ? (x + 1 - origin.x) / dir.x : sx < 0 ? (origin.x - x) / -dir.x : Infinity;
  let tmy = sy > 0 ? (y + 1 - origin.y) / dir.y : sy < 0 ? (origin.y - y) / -dir.y : Infinity;
  let tmz = sz > 0 ? (z + 1 - origin.z) / dir.z : sz < 0 ? (origin.z - z) / -dir.z : Infinity;
  /** @type {Vector3} */
  let normal = startNormal(dir);
  let t = 0;
  const maxSteps = Math.ceil(maxDistance * 3) + 3;
  for (let i = 0; i <= maxSteps && t <= maxDistance; i++) {
    const cell = { x, y, z };
    const block = safeGetBlock(dim, cell);
    if (!block) return { dist: t, hitCell: undefined, normal: undefined, method: "dda" };
    let typeId;
    try {
      typeId = block.typeId;
    } catch {
      return { dist: t, hitCell: undefined, normal: undefined, method: "dda" };
    }
    if (stopsBeam(typeId)) return { dist: t, hitCell: cell, normal, method: "dda" };
    if (tmx <= tmy && tmx <= tmz) {
      x += sx;
      t = tmx;
      tmx += tdx;
      normal = { x: -sx, y: 0, z: 0 };
    } else if (tmy <= tmz) {
      y += sy;
      t = tmy;
      tmy += tdy;
      normal = { x: 0, y: -sy, z: 0 };
    } else {
      z += sz;
      t = tmz;
      tmz += tdz;
      normal = { x: 0, y: 0, z: -sz };
    }
  }
  return { dist: maxDistance, hitCell: undefined, normal: undefined, method: "dda" };
}

/**
 * The three anchors the beam wants, before checking the world:
 *  * spot: the cell in front of the hit face (hitCell + face normal), or the beam end, level 15
 *  * mid: ~45 % of the beam length, level 13
 *  * near: ~2.5 blocks ahead, level 11
 * Mid and near never go past the hit point, so light never ends up behind the wall.
 * @param {Vector3} origin
 * @param {Vector3} dir unit vector
 * @param {Beam} beam
 * @returns {RawAnchor[]}
 */
export function rawAnchors(origin, dir, beam) {
  const d = Math.max(0, beam.dist);
  /** @type {RawAnchor[]} */
  const out = [];
  if (beam.hitCell && beam.normal) {
    out.push({ kind: "spot", level: SPOT_LEVEL, cell: add(beam.hitCell, beam.normal), t: d });
  } else {
    out.push({ kind: "spot", level: SPOT_LEVEL, cell: floorVec(pointAt(origin, dir, Math.max(0, d - 0.01))), t: d });
  }
  const limit = Math.max(0, d - WALL_MARGIN);
  const tMid = Math.min(d * MID_FRACTION, limit);
  out.push({ kind: "mid", level: MID_LEVEL, cell: floorVec(pointAt(origin, dir, tMid)), t: tMid });
  const tNear = Math.min(NEAR_DISTANCE, limit);
  out.push({ kind: "near", level: NEAR_LEVEL, cell: floorVec(pointAt(origin, dir, tNear)), t: tNear });
  return out;
}

/**
 * Cheap change detector: dimension + raw anchor cells + levels.
 * @param {string} dimId
 * @param {RawAnchor[]} raw
 * @returns {string}
 */
export function anchorSignature(dimId, raw) {
  let s = dimId;
  for (const a of raw) s += `|${a.cell.x},${a.cell.y},${a.cell.z}:${a.level}`;
  return s;
}

/** @param {Vector3} c @returns {string} */
function cellId(c) {
  return `${c.x},${c.y},${c.z}`;
}

/**
 * First usable cell for an anchor: the anchor cell itself, else walking back along the ray
 * towards the eyes (up to 3 blocks), else one of its 6 neighbours. Undefined if none.
 * @param {Vector3} origin
 * @param {Vector3} dir
 * @param {RawAnchor} a
 * @param {(cell: Vector3) => boolean} isFree
 * @returns {Vector3 | undefined}
 */
export function findFreeCell(origin, dir, a, isFree) {
  if (isFree(a.cell)) return a.cell;
  const seen = new Set([cellId(a.cell)]);
  for (let k = 1; k <= WALK_BACK_STEPS; k++) {
    const t = a.t - k * WALK_BACK_STEP;
    if (t < 0) break;
    const c = floorVec(pointAt(origin, dir, t));
    const id = cellId(c);
    if (seen.has(id)) continue;
    seen.add(id);
    if (isFree(c)) return c;
  }
  for (const n of NEIGHBOURS) {
    const c = add(a.cell, n);
    const id = cellId(c);
    if (seen.has(id)) continue;
    seen.add(id);
    if (isFree(c)) return c;
  }
  return undefined;
}

/**
 * Resolve raw anchors to usable cells and collapse anchors that share a cell (max level wins).
 * @param {Vector3} origin
 * @param {Vector3} dir
 * @param {RawAnchor[]} raw
 * @param {(cell: Vector3) => boolean} isFree
 * @param {(cell: Vector3) => string} keyOf
 * @returns {Map<string, Anchor>} cell key -> anchor (at most raw.length entries)
 */
export function resolveAnchors(origin, dir, raw, isFree, keyOf) {
  /** @type {Map<string, Anchor>} */
  const out = new Map();
  for (const a of raw) {
    const cell = findFreeCell(origin, dir, a, isFree);
    if (!cell) continue;
    const key = keyOf(cell);
    const prev = out.get(key);
    if (!prev || prev.level < a.level) out.set(key, { cell, level: a.level });
  }
  return out;
}
