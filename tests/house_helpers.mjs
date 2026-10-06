// Shared helpers for tests/house*.test.mjs (not a test file itself).
// Expected positions are computed here independently of the add-on's rotation math:
// from the player's facing (forward / left unit vectors) and the documented anchoring
// (docs/LUXURY_BASE.md): seen from the player, the front-steps row is right before the
// clicked column, the clicked column is the outer terrace row, then the entrance cell,
// then the double front door.

import assert from "node:assert/strict";
import { mock } from "./mock/testkit.mjs";
import { world, Direction } from "@minecraft/server";
import { HOUSE } from "../addon/behavior_pack/scripts/house/blueprint_meta.js";

export const OW = "minecraft:overworld";
export const SPAWNER = "pas:luxury_base_spawner";

/** Bedrock yaw for each facing (util.cardinalFromYaw: 0 south, 90 west, 180 north, -90 east). */
export const YAW = { south: 0, west: 90, north: 180, east: -90 };
export const FWD = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, east: { x: 1, z: 0 }, west: { x: -1, z: 0 } };
/** The player's left-hand side for each facing. */
export const LEFT = { north: { x: -1, z: 0 }, south: { x: 1, z: 0 }, east: { x: 0, z: -1 }, west: { x: 0, z: 1 } };
/** dark_oak_door `direction` (0 E, 1 S, 2 W, 3 N) of a door entered while walking toward `facing`. */
export const DOOR_DIR = { east: 0, south: 1, west: 2, north: 3 };
/** stairs `weirdo_direction` (0 E, 1 W, 2 S, 3 N): you walk up toward this side. */
export const STAIR_DIR = { east: 0, west: 1, south: 2, north: 3 };
export const FACINGS = ["north", "east", "south", "west"];

/** Ticks until the build is finished (animation + 1 s) plus slack for scan/calibration. */
export const BUILD_TICKS = (HOUSE.buildSeconds + 1) * 20 + 60;

/**
 * World cell at `fwd` steps forward and `left` steps to the left of `c` (y given separately).
 * @param {{x:number,z:number}} c
 * @param {string} facing
 * @param {number} fwd
 * @param {number} left
 * @param {number} y
 */
export function rel(c, facing, fwd, left, y) {
  const f = FWD[facing];
  const l = LEFT[facing];
  return { x: c.x + f.x * fwd + l.x * left, y, z: c.z + f.z * fwd + l.z * left };
}

/**
 * Expected box of the house for a click at ground column c (ground y = gy):
 * depth -1 .. 13 forward, lateral: local x 0..17 with the anchor at local x 9 ->
 * 9 cells to the left, 8 to the right.
 */
export function expectedBox(c, gy, facing) {
  const pts = [];
  for (const fwd of [-1, HOUSE.size.z - 2]) for (const left of [9, -8]) pts.push(rel(c, facing, fwd, left, 0));
  return {
    min: { x: Math.min(...pts.map((p) => p.x)), y: gy + 1, z: Math.min(...pts.map((p) => p.z)) },
    max: { x: Math.max(...pts.map((p) => p.x)), y: gy + HOUSE.size.y, z: Math.max(...pts.map((p) => p.z)) },
  };
}

export function inBox(p, box) {
  return p.x >= box.min.x && p.x <= box.max.x && p.y >= box.min.y && p.y <= box.max.y && p.z >= box.min.z && p.z <= box.max.z;
}

/** Flat grass plane (top at y) around a centre. */
export function grassPlane(center = { x: 0, z: 0 }, y = 63, half = 32) {
  mock.fill(OW, { x: center.x - half, y, z: center.z - half }, { x: center.x + half, y, z: center.z + half }, "minecraft:grass_block");
}

/**
 * Add a survival (default) player standing `back` blocks behind the click, facing `facing`,
 * holding `count` spawners. No playerSpawn event, so the starting kit is not given.
 */
export function addBuilder({ name = "Builder", click, groundY = 63, facing = "north", back = 4, count = 2, gameMode } = {}) {
  const f = FWD[facing];
  const loc = { x: click.x - f.x * back + 0.5, y: groundY + 1, z: click.z - f.z * back + 0.5 };
  const p = mock.addPlayer({ name, location: loc, rotation: { x: 30, y: YAW[facing] }, spawn: false, gameMode });
  if (count > 0) mock.setMainhand(p, SPAWNER, count);
  mock.flush();
  return p;
}

/** Number of spawners the player holds (main hand). */
export function spawnerCount(p) {
  const inv = mock.inventory(p);
  let n = 0;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it && it.typeId === SPAWNER) n += it.amount;
  }
  return n;
}

/** Tap the spawner on the top face of the ground block at `click` and let the dispatcher run. */
export function useOn(p, click) {
  assert.ok(mock.useItemOn(p, click, Direction.Up), "useItemOn fired");
}

export function messages(p) {
  return mock.messagesTo(p);
}

export function lastMessage(p) {
  const m = mock.messagesTo(p);
  return m[m.length - 1];
}

/** Run until the player got a message matching re (returns the message). */
export function runUntilMessage(p, re, max = BUILD_TICKS + 200) {
  mock.runUntil(() => messages(p).some((m) => re.test(m)), max);
  return messages(p).find((m) => re.test(m));
}

/** Snapshot of every non-air block in the overworld (sorted). */
export function snapshot() {
  return mock
    .listBlocks(OW)
    .map((b) => `${b.x},${b.y},${b.z}=${b.name}${JSON.stringify(b.states)}`)
    .sort();
}

/** Non-air, non-void cells of the house structure (what the placement writes as blocks). */
export function houseSolidCellCount() {
  const s = world.structureManager.get(HOUSE.structureId);
  let n = 0;
  for (let x = 0; x < s.size.x; x++)
    for (let y = 0; y < s.size.y; y++)
      for (let z = 0; z < s.size.z; z++) {
        const p = s.getBlockPermutation({ x, y, z });
        if (p && p.type.id !== "minecraft:air" && p.type.id !== "minecraft:structure_void") n++;
      }
  return n;
}

/** Wrap overworld getBlock to count calls made from the house scripts, per tick. */
export function instrumentGetBlock() {
  const dim = world.getDimension("overworld");
  const orig = dim.getBlock;
  const perTick = new Map();
  let total = 0;
  dim.getBlock = function (loc) {
    const stack = new Error().stack ?? "";
    if (stack.includes("/scripts/house/")) {
      total++;
      perTick.set(mock.currentTick, (perTick.get(mock.currentTick) ?? 0) + 1);
    }
    return orig.call(this, loc);
  };
  return {
    perTick,
    get total() {
      return total;
    },
    restore() {
      delete dim.getBlock;
    },
  };
}
