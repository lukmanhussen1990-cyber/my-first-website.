// Luxury Base placement (SPEC §6) against the behavioural mock with the REAL
// addon/behavior_pack/structures/pas/luxury_base.mcstructure.
// Expected cells are derived from the player's facing (house_helpers.mjs), not from the
// add-on's own rotation code.

import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { mock, hasVanillaRef, refPath } from "./mock/testkit.mjs";
import { world, BlockPermutation, CommandError } from "@minecraft/server";
import { initHouse } from "../addon/behavior_pack/scripts/house/index.js";
import { __houseState, MSG } from "../addon/behavior_pack/scripts/house/placement.js";
import { SCAN_BUDGET_PER_TICK, REPLACEABLE, LIQUIDS } from "../addon/behavior_pack/scripts/house/checks.js";
import { getCalibration } from "../addon/behavior_pack/scripts/house/rotation.js";
import { HOUSE } from "../addon/behavior_pack/scripts/house/blueprint_meta.js";
import { __itemsInternals } from "../addon/behavior_pack/scripts/lib/items.js";
import {
  OW,
  FACINGS,
  BUILD_TICKS,
  rel,
  expectedBox,
  grassPlane,
  addBuilder,
  spawnerCount,
  useOn,
  messages,
  runUntilMessage,
  snapshot,
  instrumentGetBlock,
  assertHouse,
} from "./house_helpers.mjs";

const REF = hasVanillaRef();
const skipNoRef = REF ? false : `vanilla reference not found at ${refPath()} (set PAS_VANILLA_REF)`;

initHouse();

beforeEach(() => {
  __houseState.reset();
  mock.reset();
  mock.setOptions({ throwHandlerErrors: true, unloadedGetBlock: "undefined", rotate90: "cw" });
  mock.setCommandHandler(undefined);
  __itemsInternals.resetDebounce();
});

const xyz = (p) => `${p.x} ${p.y} ${p.z}`;

/** Wait until a blocked/failed message arrives (the scan takes a few ticks). */
function runUntilBlocked(p, max = 60) {
  return runUntilMessage(p, /Can't build here|could not be placed|no longer have/, max);
}

// ---------------------------------------------------------------------------
describe("placement on flat ground (test 1)", { skip: skipNoRef }, () => {
  for (const facing of FACINGS) {
    test(`facing ${facing}: house extends away, door faces the player, item consumed once`, () => {
      const c = { x: 5, y: 63, z: -7 };
      grassPlane(c);
      const p = addBuilder({ click: c, facing, count: 2 });
      useOn(p, c);
      const started = runUntilMessage(p, /Building your Luxury Base|Can't build/, 60);
      assert.match(started, /Building your Luxury Base/);
      assert.equal(spawnerCount(p), 1, "one spawner consumed at the start");
      // placement record: the official API with the Layers animation
      const rec = mock.records.structurePlacements.filter((r) => r.id === HOUSE.structureId);
      assert.equal(rec.length, 1);
      assert.equal(rec[0].options.animationMode, "Layers");
      assert.equal(rec[0].options.animationSeconds, HOUSE.buildSeconds);
      assert.equal(rec[0].options.includeEntities, false);
      assert.equal(rec[0].options.waterlogged, false);
      assert.ok(mock.records.sounds.some((s) => s.id === "pas.base.build"), "build sound");
      assert.ok(mock.records.particles.some((s) => s.id === "pas:build_sparkle"), "build sparkle");
      // still animating: the door is not there yet
      assert.equal(mock.blockName(OW, rel(c, facing, 2, 0, 65 + 1)), "minecraft:air");
      runUntilMessage(p, /Luxury Base complete!/, BUILD_TICKS);
      assert.ok(mock.records.sounds.some((s) => s.id === "pas.base.done"), "done sound");
      assertHouse(c, 63, facing);
      assert.equal(spawnerCount(p), 1, "consumed exactly once");
      assert.equal(__houseState.jobs.size, 0, "reservation released");
      assert.deepEqual(mock.errors, []);
    });
  }

  test("creative: nothing consumed; in the air the spawner raycasts to the ground (<= 12 blocks)", () => {
    const c = { x: 0, y: 63, z: 0 };
    grassPlane(c);
    const p = addBuilder({ click: c, facing: "north", back: 5, count: 1, gameMode: "creative" });
    // look 45 degrees down: from eye height 65.62 the ray meets the ground ~2.3 blocks ahead
    mock.setView(p, { rotation: { x: 45, y: 180 } });
    const hit = p.getBlockFromViewDirection({ maxDistance: 12 });
    assert.ok(hit && hit.block.y === 63, "the view ray reaches the ground");
    const hitCol = { x: hit.block.x, z: hit.block.z };
    assert.ok(mock.useItem(p));
    const msg = runUntilMessage(p, /Building your Luxury Base|Can't build|Aim at/, 60);
    assert.match(msg, /Building your Luxury Base/);
    assert.equal(spawnerCount(p), 1, "creative keeps the item");
    runUntilMessage(p, /Luxury Base complete!/, BUILD_TICKS);
    assertHouse(hitCol, 63, "north");
  });

  test("in the air with nothing within 12 blocks: 'Aim at the ground'", () => {
    grassPlane({ x: 0, z: 0 });
    const p = addBuilder({ click: { x: 0, z: 0 }, facing: "north" });
    mock.setView(p, { rotation: { x: -30, y: 180 } }); // looking up
    assert.ok(mock.useItem(p));
    mock.tick(3);
    assert.ok(messages(p).includes(MSG.aim), messages(p).join(" | "));
    assert.match(MSG.aim, /Aim at the ground \(within 12 blocks\)/);
    assert.equal(spawnerCount(p), 2);
    assert.equal(mock.records.structurePlacements.length, 0);
  });
});

// ---------------------------------------------------------------------------
describe("blocked sites (test 2)", { skip: skipNoRef }, () => {
  function blockedCase(setup, { facing = "north", click = { x: 3, y: 63, z: 4 }, mode } = {}) {
    grassPlane(click);
    if (mode) mock.setOptions({ unloadedGetBlock: mode });
    setup?.(click);
    const p = addBuilder({ click, facing, count: 3 });
    const before = snapshot();
    mock.clearRecords();
    useOn(p, click);
    const msg = runUntilBlocked(p);
    mock.tick(20);
    assert.deepEqual(snapshot(), before, "no block changed anywhere");
    assert.equal(spawnerCount(p), 3, "item not consumed");
    assert.equal(mock.records.structurePlacements.length, 0, "nothing placed (no probe either)");
    assert.equal(__houseState.jobs.size, 0, "no reservation left");
    assert.ok(mock.lastActionBar(p), "actionbar feedback");
    assert.ok(mock.records.sounds.some((s) => s.kind !== "dimension" && s.id === "note.bass"), "error sound to the player");
    return msg;
  }

  test("stone pillar in the box: message names the block and its coordinates", () => {
    let pillar;
    const msg = blockedCase((c) => {
      pillar = rel(c, "north", 5, 0, 64);
      mock.fill(OW, pillar, { ...pillar, y: 70 }, "minecraft:stone");
    });
    assert.equal(
      msg,
      `§cCan't build here: stone at ${xyz(pillar)} is in the way. Clear a 18×15 area (13 high) or pick flatter ground.`,
    );
  });

  test("an existing small build (oak logs): the first one in scan order is reported", () => {
    let first;
    const msg = blockedCase(
      (c) => {
        // two logs side by side, 3 rows into the box; scan goes front row first, then left to right
        first = rel(c, "east", 3, 1, 64);
        mock.setBlock(OW, first, "minecraft:oak_log");
        mock.setBlock(OW, rel(c, "east", 3, 0, 64), "minecraft:oak_log");
        mock.setBlock(OW, rel(c, "east", 3, 0, 65), "minecraft:oak_planks");
      },
      { facing: "east" },
    );
    assert.match(msg, new RegExp(`oak_log at ${xyz(first)} is in the way`));
  });

  test("water in the box", () => {
    let w;
    const msg = blockedCase((c) => {
      w = rel(c, "south", 6, 2, 64);
      mock.setBlock(OW, w, "minecraft:water");
    }, { facing: "south" });
    assert.match(msg, new RegExp(`Can't build here: water at ${xyz(w)}`));
  });

  test("water even in a structure-void cell (top of the roof) blocks", () => {
    // y 12 inside the parapet is structure void: local (9, 12, 7) -> 6 rows beyond the click
    let w;
    const msg = blockedCase((c) => {
      w = rel(c, "north", 13 - 7, 0, 64 + 12);
      mock.setBlock(OW, w, "minecraft:flowing_water");
    });
    assert.match(msg, new RegExp(`flowing_water at ${xyz(w)}`));
  });

  test("a solid block in a structure-void cell (inside the roof parapet) does not block and is kept", () => {
    const c = { x: 3, y: 63, z: 4 };
    grassPlane(c);
    const keep = rel(c, "north", 13 - 5, 9 - 5, 64 + 12); // local (5, 12, 5): void
    mock.setBlock(OW, keep, "minecraft:stone");
    const p = addBuilder({ click: c, facing: "north" });
    useOn(p, c);
    runUntilMessage(p, /Luxury Base complete!|Can't build/, 400);
    assert.ok(messages(p).includes(MSG.done), messages(p).join(" | "));
    assert.equal(mock.blockName(OW, keep), "minecraft:stone", "void cells keep the world block");
  });

  test("cliff: less than 80% solid ground under the footprint", () => {
    let gap;
    const msg = blockedCase((c) => {
      // remove the ground under the 4 back rows (11 of 15 rows stay = 73%)
      for (let fwd = 10; fwd <= 13; fwd++) for (let left = -8; left <= 9; left++) mock.setBlock(OW, rel(c, "north", fwd, left, 63), "minecraft:air");
      gap = rel(c, "north", 10, 9, 63); // first gap: nearest row, leftmost cell
    });
    assert.equal(
      msg,
      `§cCan't build here: not enough solid ground (73% of the footprint, need 80%). First gap: air at ${xyz(gap)}. Pick flatter ground.`,
    );
  });

  test("cliff edge at exactly 80% solid ground is accepted", () => {
    const c = { x: 3, y: 63, z: 4 };
    grassPlane(c);
    for (let fwd = 11; fwd <= 13; fwd++) for (let left = -8; left <= 9; left++) mock.setBlock(OW, rel(c, "north", fwd, left, 63), "minecraft:air");
    const p = addBuilder({ click: c, facing: "north" });
    useOn(p, c);
    assert.match(runUntilMessage(p, /Building your Luxury Base|Can't build/, 60), /Building your Luxury Base/);
  });

  for (const mode of ["undefined", "throw"]) {
    test(`unloaded chunk inside the box (getBlock ${mode === "throw" ? "throws" : "returns undefined"})`, () => {
      // click (8, 63, 8) facing north: box x -1..16, z -5..9 -> chunk (1, 0) holds x = 16
      const msg = blockedCase(() => mock.unloadChunk(OW, 1, 0), { click: { x: 8, y: 63, z: 8 }, mode });
      assert.equal(msg, "§cCan't build here: area not fully loaded (16 64 9). Move closer and try again.");
    });
  }

  test("top of the box above the height range", () => {
    const c = { x: 0, y: 310, z: 0 };
    const msg = blockedCase(() => {}, { click: c });
    assert.match(msg, /would reach above the build limit \(y 319\)/);
  });

  test("player standing inside the build area", () => {
    const c = { x: 0, y: 63, z: 0 };
    grassPlane(c);
    const p = addBuilder({ click: c, facing: "north", back: 1 }); // on the front-steps row
    useOn(p, c);
    mock.tick(2);
    assert.ok(messages(p).includes(MSG.inside));
    assert.equal(spawnerCount(p), 2);
  });
});

// ---------------------------------------------------------------------------
describe("vegetation (test 3)", { skip: skipNoRef }, () => {
  test("grass, flowers, snow layers, tall grass and torchlight light blocks are replaced", () => {
    const c = { x: -4, y: 63, z: 2 };
    grassPlane(c);
    const f = "west";
    const veg = [
      [rel(c, f, 2, 0, 64), "minecraft:short_grass", {}],
      [rel(c, f, 5, 3, 64), "minecraft:poppy", {}],
      [rel(c, f, 6, -4, 64), "minecraft:yellow_flower", {}],
      [rel(c, f, 7, -2, 64), "minecraft:snow_layer", { height: 2 }],
      [rel(c, f, 9, 1, 64), "minecraft:tall_grass", { upper_block_bit: false }],
      [rel(c, f, 9, 1, 65), "minecraft:tall_grass", { upper_block_bit: true }],
      [rel(c, f, 1, 0, 65), "minecraft:light_block", { block_light_level: 15 }],
      [rel(c, f, 1, 0, 64 + 3), "minecraft:vine", {}],
    ];
    for (const [p, name, states] of veg) mock.setBlock(OW, p, name, states);
    // the player taps the grass plant on the clicked column: the real ground below is used
    const plant = rel(c, f, 0, 0, 64);
    mock.setBlock(OW, plant, "minecraft:short_grass");
    const p = addBuilder({ click: c, facing: f, count: 1 });
    useOn(p, plant);
    assert.match(runUntilMessage(p, /Building your Luxury Base|Can't build/, 60), /Building your Luxury Base/);
    runUntilMessage(p, /Luxury Base complete!/, BUILD_TICKS);
    assertHouse(c, 63, f);
    const s = world.structureManager.get(HOUSE.structureId);
    for (const [pos, name] of veg) {
      const now = mock.blockName(OW, pos);
      assert.notEqual(now, name, `${name} at ${xyz(pos)} was replaced`);
    }
    assert.equal(mock.blockName(OW, plant), "minecraft:quartz_block", "the clicked plant became terrace");
    assert.equal(spawnerCount(p), 0);
    assert.ok(s);
  });

  test("the replaceable and liquid lists are valid 1.21.0.26 block names", { skip: skipNoRef }, () => {
    for (const name of [...REPLACEABLE, ...LIQUIDS]) assert.doesNotThrow(() => BlockPermutation.resolve(name), name);
    for (const name of ["minecraft:short_grass", "minecraft:poppy", "minecraft:snow_layer", "minecraft:deadbush"]) assert.ok(REPLACEABLE.has(name));
    for (const name of ["minecraft:sweet_berry_bush", "minecraft:oak_log", "minecraft:water", "minecraft:seagrass"]) assert.ok(!REPLACEABLE.has(name));
  });
});

// ---------------------------------------------------------------------------
describe("concurrency (test 5) and debounce", { skip: skipNoRef }, () => {
  test("two players: an overlapping box is blocked while the first base is still animating", () => {
    const c1 = { x: 0, y: 63, z: 0 };
    grassPlane(c1, 63, 48);
    const a = addBuilder({ name: "A", click: c1, facing: "north" });
    useOn(a, c1);
    runUntilMessage(a, /Building your Luxury Base/, 60);
    mock.tick(20); // animating
    assert.ok(mock.structureAnimationsPending() > 0, "first base still animating");
    // B targets a box 10 blocks east: overlaps A's box (x -9..8 vs 1..18)
    const c2 = { x: 10, y: 63, z: 0 };
    const b = addBuilder({ name: "B", click: c2, facing: "north", count: 1 });
    useOn(b, c2);
    mock.tick(2);
    const msg = messages(b).find((m) => /Can't build here/.test(m));
    assert.match(msg, /another Luxury Base is being built in this area/);
    assert.equal(spawnerCount(b), 1, "B keeps the item");
    // A finishes normally
    runUntilMessage(a, /Luxury Base complete!/, BUILD_TICKS);
    assertHouse(c1, 63, "north");
  });

  test("same player: second use while scanning or building gets a 'please wait' message", () => {
    const c = { x: 0, y: 63, z: 0 };
    grassPlane(c, 63, 40);
    const p = addBuilder({ click: c, facing: "north", count: 3 });
    useOn(p, c);
    mock.tick(1); // dispatched: the scan has started
    assert.equal(__houseState.activeByPlayer.get(p.id)?.phase, "scan");
    __itemsInternals.resetDebounce();
    useOn(p, rel(c, "north", -20, 0, 63));
    mock.tick(1);
    assert.ok(messages(p).includes(MSG.scanning), messages(p).join(" | "));
    runUntilMessage(p, /Building your Luxury Base/, 60);
    mock.tick(10);
    __itemsInternals.resetDebounce();
    useOn(p, rel(c, "north", -20, 0, 63));
    mock.tick(1);
    assert.ok(messages(p).some((m) => /still being built \(\d+s left\)/.test(m)));
    runUntilMessage(p, /Luxury Base complete!/, BUILD_TICKS);
    assert.equal(spawnerCount(p), 2, "only the first use consumed an item");
    assert.equal(mock.records.structurePlacements.filter((r) => r.id === HOUSE.structureId).length, 1);
  });

  test("holding the use button builds once (edge debounce)", () => {
    const c = { x: 0, y: 63, z: 0 };
    grassPlane(c);
    const p = addBuilder({ click: c, facing: "north", count: 3 });
    mock.holdUse(p, { ticks: 30, every: 4, block: c });
    runUntilMessage(p, /Luxury Base complete!/, BUILD_TICKS);
    assert.equal(spawnerCount(p), 2);
    assert.equal(mock.records.structurePlacements.filter((r) => r.id === HOUSE.structureId).length, 1);
  });
});

// ---------------------------------------------------------------------------
describe("fallback to /structure load (test 6)", { skip: skipNoRef }, () => {
  function patchPlace({ commandWorks }) {
    const sm = world.structureManager;
    const orig = sm.place;
    let allow = false;
    sm.place = function (s, ...rest) {
      if (s === HOUSE.structureId && !allow) throw new Error("engine refused the placement");
      allow = false;
      return orig.call(this, s, ...rest);
    };
    mock.setCommandHandler((cmd) => {
      if (!cmd.startsWith("structure load")) return undefined;
      if (!commandWorks) throw new CommandError("Structure load failed");
      allow = true;
      return undefined; // run the mock's own /structure load
    });
    return () => {
      delete sm.place;
      mock.setCommandHandler(undefined);
    };
  }

  test("structureManager.place throws -> runCommand('structure load ...') with the right rotation and coordinates", () => {
    const c = { x: 2, y: 63, z: 3 };
    grassPlane(c);
    const p = addBuilder({ click: c, facing: "east", count: 1 });
    const restore = patchPlace({ commandWorks: true });
    try {
      useOn(p, c);
      runUntilMessage(p, /Building your Luxury Base|could not be placed/, 60);
      const cmds = mock.records.commands.map((r) => r.command).filter((s) => s.startsWith("structure load"));
      assert.equal(cmds.length, 1);
      // facing east = 1 clockwise quarter turn; the calibrated convention decides the rotation value
      const conv = getCalibration()?.convention ?? "cw";
      const rot = conv === "cw" ? "90_degrees" : "270_degrees";
      const box = expectedBox(c, 63, "east");
      assert.equal(cmds[0], `structure load pas:luxury_base ${box.min.x} ${box.min.y} ${box.min.z} ${rot} none layer_by_layer 7 false true`);
      runUntilMessage(p, /Luxury Base complete!/, BUILD_TICKS);
      assertHouse(c, 63, "east");
      assert.equal(spawnerCount(p), 0);
    } finally {
      restore();
    }
  });

  test("both placement paths fail -> message, item refunded, reservation released, nothing changed", () => {
    const c = { x: 2, y: 63, z: 3 };
    grassPlane(c);
    const p = addBuilder({ click: c, facing: "south", count: 1 });
    const before = snapshot();
    const restore = patchPlace({ commandWorks: false });
    try {
      useOn(p, c);
      const msg = runUntilMessage(p, /could not be placed/, 60);
      assert.match(msg, /engine refused the placement/);
      assert.match(msg, /Your spawner was returned\./);
      assert.equal(spawnerCount(p), 1, "refunded");
      assert.equal(__houseState.jobs.size, 0, "reservation released");
      mock.tick(5);
      assert.deepEqual(snapshot(), before, "nothing changed (probe cells restored)");
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
describe("tick budget (test 7)", { skip: skipNoRef }, () => {
  test(`the site scan never makes more than ${SCAN_BUDGET_PER_TICK} getBlock calls per tick`, () => {
    const c = { x: 0, y: 63, z: 0 };
    grassPlane(c);
    const p = addBuilder({ click: c, facing: "west" });
    const probe = instrumentGetBlock();
    try {
      useOn(p, c);
      runUntilMessage(p, /Luxury Base complete!/, BUILD_TICKS);
    } finally {
      probe.restore();
    }
    const counts = [...probe.perTick.values()];
    const cells = HOUSE.size.x * HOUSE.size.y * HOUSE.size.z + HOUSE.size.x * HOUSE.size.z;
    assert.ok(probe.total >= cells, `scanned every cell (${probe.total} >= ${cells})`);
    assert.ok(Math.max(...counts) <= SCAN_BUDGET_PER_TICK, `max per tick ${Math.max(...counts)}`);
    assert.ok(probe.perTick.size >= Math.ceil(cells / SCAN_BUDGET_PER_TICK), `spread over ${probe.perTick.size} ticks`);
  });

  test("two simultaneous scans share the per-tick budget", () => {
    const c1 = { x: 0, y: 63, z: 0 };
    const c2 = { x: 60, y: 63, z: 0 };
    grassPlane(c1, 63, 20);
    grassPlane(c2, 63, 20);
    const a = addBuilder({ name: "A", click: c1, facing: "north" });
    const b = addBuilder({ name: "B", click: c2, facing: "south" });
    const probe = instrumentGetBlock();
    try {
      useOn(a, c1);
      useOn(b, c2);
      runUntilMessage(a, /Luxury Base complete!/, BUILD_TICKS);
      runUntilMessage(b, /Luxury Base complete!/, BUILD_TICKS);
    } finally {
      probe.restore();
    }
    assert.ok(Math.max(...probe.perTick.values()) <= SCAN_BUDGET_PER_TICK);
    assertHouse(c1, 63, "north", 25);
    assertHouse(c2, 63, "south", 25);
  });
});
