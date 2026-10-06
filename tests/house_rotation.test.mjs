// Luxury Base orientation math and the runtime Rotate90 calibration (SPEC §6).
// The calibration is exercised against the mock configured BOTH ways
// (mock option rotate90: "cw" = Rotate90 clockwise viewed from above, "ccw" = counter-clockwise)
// to prove the add-on measures the direction instead of assuming it.

import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { mock, hasVanillaRef, refPath } from "./mock/testkit.mjs";
import { world, StructureRotation } from "@minecraft/server";
import { initHouse } from "../addon/behavior_pack/scripts/house/index.js";
import { __houseState } from "../addon/behavior_pack/scripts/house/placement.js";
import {
  quarterTurnsForFacing,
  apiRotation,
  rotatedSize,
  localToOffset,
  offsetToLocal,
  computePlacement,
  toWorld,
  toLocal,
  boxesOverlap,
  anchorLocal,
  ROTATION_DEGREES,
  runProbe,
  probeArea,
  getCalibration,
  resetCalibration,
  calibrationLog,
  currentConvention,
  MAX_CALIBRATION_ATTEMPTS,
  PROBE_ID,
  WAIT,
} from "../addon/behavior_pack/scripts/house/rotation.js";
import { HOUSE } from "../addon/behavior_pack/scripts/house/blueprint_meta.js";
import { getErrorCounts } from "../addon/behavior_pack/scripts/lib/util.js";
import { __itemsInternals } from "../addon/behavior_pack/scripts/lib/items.js";
import {
  OW,
  FACINGS,
  FWD,
  LEFT,
  BUILD_TICKS,
  rel,
  grassPlane,
  addBuilder,
  useOn,
  runUntilMessage,
  assertHouse,
} from "./house_helpers.mjs";

const REF = hasVanillaRef();
const skipNoRef = REF ? false : `vanilla reference not found at ${refPath()} (set PAS_VANILLA_REF)`;

initHouse();

beforeEach(() => {
  __houseState.reset();
  resetCalibration();
  mock.reset();
  mock.setOptions({ throwHandlerErrors: true, unloadedGetBlock: "undefined", rotate90: "cw" });
  mock.setCommandHandler(undefined);
  __itemsInternals.resetDebounce();
});

/** Run a job generator to completion, advancing the mock clock on WAIT. */
function drive(gen) {
  for (let i = 0; i < 10000; i++) {
    const r = gen.next();
    if (r.done) return r.value;
    if (r.value === WAIT) mock.tick();
  }
  throw new Error("generator did not finish");
}

const SIZE = HOUSE.size;

// ---------------------------------------------------------------------------
describe("orientation math", () => {
  test("facing -> clockwise quarter turns -> StructureRotation for both conventions", () => {
    assert.deepEqual(FACINGS.map(quarterTurnsForFacing), [0, 1, 2, 3]);
    assert.deepEqual([0, 1, 2, 3].map((q) => apiRotation(q, "cw")), ["None", "Rotate90", "Rotate180", "Rotate270"]);
    assert.deepEqual([0, 1, 2, 3].map((q) => apiRotation(q, "ccw")), ["None", "Rotate270", "Rotate180", "Rotate90"]);
    assert.deepEqual(rotatedSize(SIZE, 1), { x: SIZE.z, y: SIZE.y, z: SIZE.x });
    assert.deepEqual(rotatedSize(SIZE, 2), SIZE);
  });

  test("localToOffset is a bijection onto the rotated box and offsetToLocal inverts it", () => {
    for (let q = 0; q < 4; q++) {
      const rs = rotatedSize(SIZE, q);
      const seen = new Set();
      for (let x = 0; x < SIZE.x; x++)
        for (let z = 0; z < SIZE.z; z++) {
          const o = localToOffset({ x, y: 3, z }, SIZE, q);
          assert.ok(o.x >= 0 && o.x < rs.x && o.z >= 0 && o.z < rs.z && o.y === 3, `q${q} ${x},${z}`);
          seen.add(`${o.x},${o.z}`);
          assert.deepEqual(offsetToLocal(o, SIZE, q), { x, y: 3, z });
        }
      assert.equal(seen.size, SIZE.x * SIZE.z);
    }
  });

  test("clockwise geometry matches the mock's documented clockwise structure transform", () => {
    for (let q = 0; q < 4; q++)
      for (const local of [{ x: 0, y: 0, z: 0 }, { x: 17, y: 2, z: 0 }, { x: 9, y: 1, z: 12 }, { x: 4, y: 7, z: 14 }])
        assert.deepEqual(localToOffset(local, SIZE, q), mock.structureTransform(local, SIZE, apiRotation(q, "cw")), `q${q}`);
  });

  test("canonical south is turned to face back at the player for every facing", () => {
    // a step from the entrance toward local +z (canonical south) must point at the player (-forward)
    for (const facing of FACINGS) {
      const q = quarterTurnsForFacing(facing);
      const a = localToOffset({ x: 5, y: 0, z: 5 }, SIZE, q);
      const b = localToOffset({ x: 5, y: 0, z: 6 }, SIZE, q);
      const neg = (v) => ({ x: 0 - v.x || 0, z: 0 - v.z || 0 });
      assert.deepEqual({ x: b.x - a.x, z: b.z - a.z }, neg(FWD[facing]), facing);
      // local +x (canonical east) is the player's right-hand side
      const c = localToOffset({ x: 6, y: 0, z: 5 }, SIZE, q);
      assert.deepEqual({ x: c.x - a.x, z: c.z - a.z }, neg(LEFT[facing]), facing);
    }
  });

  test("placement: the clicked column is the outer terrace cell, entrance 1 beyond, steps on the player's side", () => {
    const click = { x: 11, y: 70, z: -23 };
    assert.deepEqual(anchorLocal(), { x: HOUSE.entrance.x, y: 0, z: HOUSE.entrance.z + 1 });
    for (const facing of FACINGS) {
      const pl = computePlacement(click, facing);
      assert.equal(pl.origin.y, click.y + 1, "foundation on top of the clicked block");
      const col = (local) => {
        const w = toWorld(pl, local);
        return { x: w.x, z: w.z };
      };
      assert.deepEqual(col(pl.anchorLocal), { x: click.x, z: click.z }, `${facing}: anchor on the click`);
      const e = HOUSE.entrance;
      assert.deepEqual(col(e), { x: click.x + FWD[facing].x, z: click.z + FWD[facing].z }, `${facing}: entrance 1 beyond`);
      assert.deepEqual(col({ x: e.x, y: 0, z: SIZE.z - 1 }), { x: click.x - FWD[facing].x, z: click.z - FWD[facing].z }, `${facing}: steps`);
      assert.deepEqual(col({ x: e.x, y: 0, z: 0 }), { x: click.x + 13 * FWD[facing].x, z: click.z + 13 * FWD[facing].z }, `${facing}: back`);
      assert.deepEqual(toLocal(pl, toWorld(pl, { x: 3, y: 4, z: 5 })), { x: 3, y: 4, z: 5 });
      assert.deepEqual(pl.max, { x: pl.min.x + pl.rotatedSize.x - 1, y: pl.min.y + SIZE.y - 1, z: pl.min.z + pl.rotatedSize.z - 1 });
    }
  });

  test("boxesOverlap", () => {
    const a = { min: { x: 0, y: 0, z: 0 }, max: { x: 5, y: 5, z: 5 } };
    assert.ok(boxesOverlap(a, { min: { x: 5, y: 5, z: 5 }, max: { x: 9, y: 9, z: 9 } }));
    assert.ok(!boxesOverlap(a, { min: { x: 6, y: 0, z: 0 }, max: { x: 9, y: 9, z: 9 } }));
    assert.ok(!boxesOverlap(a, { min: { x: 0, y: 6, z: 0 }, max: { x: 9, y: 9, z: 9 } }));
  });

  test("/structure load syntax matches mojang-commands.json for 1.21.0.26", { skip: skipNoRef }, () => {
    const j = JSON.parse(fs.readFileSync(path.join(refPath(), "metadata/command_modules/mojang-commands.json"), "utf8"));
    const enums = Object.fromEntries(j.command_enums.map((e) => [e.name, e.values.map((v) => v.value)]));
    for (const v of Object.values(ROTATION_DEGREES)) assert.ok(enums.Rotation.includes(v), v);
    assert.ok(enums.Mirror.includes("none"));
    assert.ok(enums.StructureAnimationMode.includes("layer_by_layer"));
    const cmd = j.commands.find((c) => c.name === "structure");
    const load = cmd.overloads.find((o) => o.params.some((p) => p.name === "animationMode"));
    assert.deepEqual(
      load.params.map((p) => p.name),
      ["action", "name", "to", "rotation", "mirror", "animationMode", "animationSeconds", "includeEntities", "includeBlocks", "waterlogged", "integrity", "seed"],
    );
  });
});

// ---------------------------------------------------------------------------
describe("rotation calibration probe (test 4)", { skip: skipNoRef }, () => {
  const ow = () => world.getDimension("overworld");
  const origin = { x: 10, y: 100, z: -6 };
  const allAir = () => probeArea(origin).every((p) => mock.blockName(OW, p) === "minecraft:air");

  for (const conv of ["cw", "ccw"]) {
    test(`mock rotate90 = ${conv}: the probe measures ${conv}, cells end up air, probe deleted, result cached`, () => {
      mock.setOptions({ rotate90: conv });
      const cal = drive(runProbe(ow(), origin, () => mock.currentTick));
      assert.equal(cal.convention, conv);
      assert.equal(cal.source, "probe");
      assert.ok(allAir(), "every probe cell restored to air");
      assert.deepEqual(mock.listBlocks(OW), [], "nothing left in the world");
      assert.equal(world.structureManager.get(PROBE_ID), undefined, "probe structure deleted");
      assert.deepEqual(getCalibration(), cal, "cached");
      assert.equal(currentConvention(), conv);
      const entry = calibrationLog[calibrationLog.length - 1];
      assert.equal(entry.result, conv);
      assert.equal(entry.restored, true);
      // the marker (local 1,0,0) went to (1,0,1) when clockwise, (0,0,0) when counter-clockwise
      assert.deepEqual(entry.markerAt, conv === "cw" ? { x: origin.x + 1, y: origin.y, z: origin.z + 1 } : origin);
      // the probe used Rotate90 at the requested origin
      const rec = mock.records.structurePlacements.find((r) => r.id === PROBE_ID);
      assert.equal(rec.options.rotation, StructureRotation.Rotate90);
      assert.deepEqual(rec.location, origin);
    });
  }

  test("a leftover probe structure from an interrupted run is replaced", () => {
    world.structureManager.createEmpty(PROBE_ID, { x: 1, y: 1, z: 1 });
    const cal = drive(runProbe(ow(), origin, () => mock.currentTick));
    assert.equal(cal.source, "probe");
    assert.ok(allAir());
  });

  test("probe area not empty -> nothing touched, fallback 'Rotate90 = clockwise', retried later", () => {
    const stone = { x: origin.x + 2, y: origin.y, z: origin.z - 1 }; // in the 4x4 ring
    mock.setBlock(OW, stone, "minecraft:stone");
    const cal = drive(runProbe(ow(), origin, () => mock.currentTick));
    assert.deepEqual([cal.convention, cal.source], ["cw", "fallback"]);
    assert.match(cal.detail, /probe area not empty \(minecraft:stone/);
    assert.equal(mock.blockName(OW, stone), "minecraft:stone");
    assert.equal(mock.records.structurePlacements.length, 0);
    assert.equal(getCalibration(), undefined, "a single failure is not cached");
  });

  test("createEmpty failing -> fallback; cached after MAX_CALIBRATION_ATTEMPTS failures; error logged", () => {
    const sm = world.structureManager;
    sm.createEmpty = () => {
      throw new Error("InvalidArgumentError: no structures today");
    };
    try {
      for (let i = 1; i <= MAX_CALIBRATION_ATTEMPTS; i++) {
        const cal = drive(runProbe(ow(), origin, () => mock.currentTick));
        assert.deepEqual([cal.convention, cal.source], ["cw", "fallback"]);
        assert.equal(getCalibration()?.source, i < MAX_CALIBRATION_ATTEMPTS ? undefined : "fallback");
      }
    } finally {
      delete sm.createEmpty;
    }
    assert.ok((getErrorCounts().get("house.calibration") ?? 0) >= 1, "logged");
    assert.ok(allAir());
  });

  test("an engine that ignores the rotation -> unexpected result -> fallback, cells restored", () => {
    const sm = world.structureManager;
    const orig = sm.place;
    sm.place = function (s, d, l, o) {
      return orig.call(this, s, d, l, { ...o, rotation: "None" });
    };
    try {
      const cal = drive(runProbe(ow(), origin, () => mock.currentTick));
      assert.equal(cal.source, "fallback");
      assert.match(cal.detail, /unexpected probe result \(1 marker\(s\) at 11 100 -6\)/);
    } finally {
      delete sm.place;
    }
    assert.ok(allAir(), "marker removed again");
    assert.equal(world.structureManager.get(PROBE_ID), undefined);
  });

  test("a probe placed off by one cell is still found and cleaned up (and rejected)", () => {
    // (a single marker cannot tell every shift apart: a (-1,-1) shift of a clockwise turn looks
    // exactly like a counter-clockwise one; see docs/LUXURY_BASE.md "Limitations")
    const sm = world.structureManager;
    const orig = sm.place;
    sm.place = function (s, d, l, o) {
      return orig.call(this, s, d, { x: l.x + 1, y: l.y, z: l.z }, o);
    };
    try {
      const cal = drive(runProbe(ow(), origin, () => mock.currentTick));
      assert.equal(cal.source, "fallback");
    } finally {
      delete sm.place;
    }
    assert.ok(allAir());
  });
});

// ---------------------------------------------------------------------------
describe("calibration inside real builds (test 4)", { skip: skipNoRef }, () => {
  for (const conv of ["cw", "ccw"]) {
    test(`engine Rotate90 = ${conv}: east and west builds are oriented correctly; calibrated once`, () => {
      mock.setOptions({ rotate90: conv });
      const sm = world.structureManager;
      const origCreate = sm.createEmpty;
      let creates = 0;
      sm.createEmpty = function (...a) {
        creates++;
        return origCreate.apply(this, a);
      };
      try {
        const c1 = { x: 0, y: 63, z: 0 };
        grassPlane(c1, 63, 30);
        const a = addBuilder({ name: "East", click: c1, facing: "east" });
        useOn(a, c1);
        runUntilMessage(a, /Building your Luxury Base/, 60);
        // the probe ran before the house placement, inside the box, and left only air behind
        assert.equal(calibrationLog.length, 1);
        const entry = calibrationLog[0];
        assert.equal(entry.result, conv);
        assert.ok(entry.cells.every((p) => mock.blockName(OW, p) === "minecraft:air"), "probe cells are air");
        const box = computePlacement(c1, "east");
        assert.ok(entry.cells.every((p) => p.x >= box.min.x && p.x <= box.max.x && p.z >= box.min.z && p.z <= box.max.z && p.y >= box.min.y && p.y <= box.max.y), "probe inside the verified box");
        const rec = mock.records.structurePlacements.filter((r) => r.id === HOUSE.structureId);
        assert.equal(rec[0].options.rotation, conv === "cw" ? "Rotate90" : "Rotate270");
        runUntilMessage(a, /Luxury Base complete!/, BUILD_TICKS);
        assertHouse(c1, 63, "east", 25);

        const c2 = { x: 0, y: 63, z: 60 };
        grassPlane(c2, 63, 30);
        const b = addBuilder({ name: "West", click: c2, facing: "west" });
        useOn(b, c2);
        runUntilMessage(b, /Luxury Base complete!/, BUILD_TICKS);
        assertHouse(c2, 63, "west", 25);
        assert.equal(calibrationLog.length, 1, "calibration cached: no second probe");
        assert.equal(creates, 1, "createEmpty called once (first build only)");
        assert.deepEqual(getCalibration(), { convention: conv, source: "probe", tick: getCalibration().tick });
      } finally {
        delete sm.createEmpty;
      }
    });
  }

  test("control: blindly using Rotate90 for 'east' on a counter-clockwise engine would face the door away", () => {
    mock.setOptions({ rotate90: "ccw" });
    const c = { x: 0, y: 63, z: 0 };
    const pl = computePlacement(c, "east");
    world.structureManager.place(HOUSE.structureId, world.getDimension("overworld"), pl.origin, { rotation: "Rotate90" });
    const door = rel(c, "east", 2, 0, 65);
    assert.notEqual(mock.blockName(OW, door), "minecraft:dark_oak_door", "door not where the player expects it");
  });
});
