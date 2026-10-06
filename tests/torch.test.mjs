// Tactical Torchlight (SPEC §5): toggle, real light blocks along the view ray, never
// overwriting anything but air, cleanup paths, shared ownership, robustness, performance.
// The crash-recovery/reload test lives in tests/torch_reload.test.mjs (child processes).
//
// Run: node --import ./tests/mock/register.mjs --test tests/torch.test.mjs

import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { mock, mc, hasVanillaRef } from "./mock/testkit.mjs";
import { world, ItemStack, BlockPermutation, Direction } from "@minecraft/server";

import { initTorchlight, __torchInternals as T } from "../addon/behavior_pack/scripts/torchlight/index.js";
import { castBeam, castBeamManual, rawAnchors } from "../addon/behavior_pack/scripts/torchlight/beam.js";
import { lightPermutation } from "../addon/behavior_pack/scripts/torchlight/lights.js";
import { isLightBlockId } from "../addon/behavior_pack/scripts/torchlight/constants.js";
import { __itemsInternals } from "../addon/behavior_pack/scripts/lib/items.js";
import { getErrorCounts } from "../addon/behavior_pack/scripts/lib/util.js";
import { ITEMS, PROPS, SOUNDS } from "../addon/behavior_pack/scripts/lib/ids.js";

// Only the torchlight subsystem is initialised here (main.js also wires the other
// subsystems; tests/lib_main.test.mjs covers that). initTorchlight registers the item
// handlers through the shared dispatcher, exactly as in the game.
initTorchlight();
initTorchlight(); // idempotent

const OW = "minecraft:overworld";
const NE = "minecraft:nether";
const LIGHT = "minecraft:light_block";
const NEEDS_REF = hasVanillaRef() ? false : "vanilla reference (mojang-blocks.json) not available";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Light blocks of a dimension as {"x,y,z": level}. */
function lights(dimId = OW) {
  const out = {};
  for (const b of mock.listBlocks(dimId, LIGHT)) out[`${b.x},${b.y},${b.z}`] = b.states.block_light_level;
  return out;
}

/** Hollow stone box (walls/floor/ceiling stone, inside air). */
function room(dimId, min, max, wall = "minecraft:stone") {
  mock.fill(dimId, min, max, wall);
  mock.fill(dimId, { x: min.x + 1, y: min.y + 1, z: min.z + 1 }, { x: max.x - 1, y: max.y - 1, z: max.z - 1 }, "minecraft:air");
}

/** The standard dark room: stone shell -10..10 (x/z), floor y=60, ceiling y=70. */
function standardRoom(dimId = OW) {
  room(dimId, { x: -10, y: 60, z: -10 }, { x: 10, y: 70, z: 10 });
}

/** Yaw (degrees) for a cardinal look direction (mock: yaw 0 = +z, 90 = -x). */
const YAW = { south: 0, west: 90, north: 180, east: -90 };

/**
 * Add a player standing at `feet`, looking with `yaw`/`pitch`, holding `item` in `hand`
 * (`item: null` = empty hands).
 * Head = feet + 1.62 (so the eyes in the standard room are at y=62.62 -> light row y=62).
 */
function addTorchPlayer(name, { feet = { x: 0.5, y: 61, z: 0.5 }, yaw = 0, pitch = 0, dimension = OW, item = ITEMS.TORCH_ON, hand = "main" } = {}) {
  const p = mock.addPlayer({ name, location: feet, dimension, rotation: { x: pitch, y: yaw } });
  if (item) {
    if (hand === "main") mock.setMainhand(p, item);
    else mock.setOffhand(p, item);
  }
  mock.tick(); // deliver join + spawn
  return p;
}

function look(p, yaw, pitch = 0) {
  mock.setView(p, { rotation: { x: pitch, y: yaw } });
}

/** Errors swallowed (logged) by the torch code since `since` (a snapshot of counts). */
function torchErrorsSince(since) {
  const out = {};
  for (const [k, n] of getErrorCounts()) if (k.startsWith("torch") && n !== (since.get(k) ?? 0)) out[k] = n - (since.get(k) ?? 0);
  return out;
}

/** Count calls of a prototype method while `fn` runs. */
function countCalls(proto, name, fn) {
  const orig = proto[name];
  let n = 0;
  proto[name] = function (...args) {
    n++;
    return orig.apply(this, args);
  };
  try {
    fn();
  } finally {
    proto[name] = orig;
  }
  return n;
}

function storedCells() {
  const raw = world.getDynamicProperty(PROPS.TORCH_CELLS);
  return raw === undefined ? undefined : JSON.parse(raw);
}

let errorSnapshot;
beforeEach(() => {
  mock.reset();
  mock.setOptions({ throwHandlerErrors: true });
  __itemsInternals.resetDebounce();
  T.reset();
  errorSnapshot = new Map(getErrorCounts());
});

// The rooms used below (standard room, player at (0.5, 61, 0.5), eyes at y = 62.62):
//   looking south (+z): wall z=10 hit at distance 9.5 -> spot (0,62,9) 15,
//                       mid at 0.45*9.5 = 4.275 -> z=4.775 -> (0,62,4) 13,
//                       near at 2.5 -> z=3.0 -> (0,62,3) 11.
const SOUTH_LIGHTS = { "0,62,9": 15, "0,62,4": 13, "0,62,3": 11 };
const EAST_LIGHTS = { "9,62,0": 15, "4,62,0": 13, "3,62,0": 11 };

// ---------------------------------------------------------------------------
describe("1. toggle", () => {
  test("use in the air swaps the main-hand stack in the same slot, keeping nameTag/lore/item data", { skip: NEEDS_REF }, () => {
    const p = addTorchPlayer("Toggler", { item: null });
    p.selectedSlotIndex = 4;
    const s = new ItemStack(ITEMS.TORCH_OFF);
    s.nameTag = "Lumen";
    s.setLore(["Squad 7", "Serial 0042"]);
    s.keepOnDeath = true;
    s.setDynamicProperty("pas:test_owner", "Toggler");
    mock.setMainhand(p, s);

    assert.ok(mock.useItem(p));
    mock.tick();
    const on = mock.inventory(p).getItem(4);
    assert.equal(on?.typeId, ITEMS.TORCH_ON);
    assert.equal(on.nameTag, "Lumen");
    assert.deepEqual(on.getLore(), ["Squad 7", "Serial 0042"]);
    assert.equal(on.keepOnDeath, true);
    assert.equal(on.getDynamicProperty("pas:test_owner"), "Toggler");
    assert.equal(mock.lastActionBar(p), "Torchlight ON");
    assert.deepEqual(
      mock.records.sounds.filter((r) => r.id.startsWith("pas.torch")).map((r) => r.id),
      [SOUNDS.TORCH_ON],
    );
    for (let i = 0; i < 9; i++) if (i !== 4) assert.equal(mock.inventory(p).getItem(i), undefined, `slot ${i} untouched`);

    mock.tick(10); // beyond the 6-tick debounce
    assert.ok(mock.useItem(p));
    mock.tick();
    const off = mock.inventory(p).getItem(4);
    assert.equal(off?.typeId, ITEMS.TORCH_OFF);
    assert.equal(off.nameTag, "Lumen");
    assert.deepEqual(off.getLore(), ["Squad 7", "Serial 0042"]);
    assert.equal(mock.lastActionBar(p), "Torchlight OFF");
    assert.deepEqual(
      mock.records.sounds.filter((r) => r.id.startsWith("pas.torch")).map((r) => r.id),
      [SOUNDS.TORCH_ON, SOUNDS.TORCH_OFF],
    );
    assert.deepEqual(torchErrorsSince(errorSnapshot), {});
  });

  test("off-hand torch toggles in the off hand; the main hand is untouched", () => {
    const p = addTorchPlayer("Lefty", { item: ITEMS.TORCH_OFF, hand: "off" });
    mock.setMainhand(p, "minecraft:cobblestone", 12);
    const off = new ItemStack(ITEMS.TORCH_OFF);
    off.nameTag = "Backup";
    mock.setOffhand(p, off);
    assert.ok(mock.useItem(p, { stack: off }));
    mock.tick();
    const eq = p.getComponent("minecraft:equippable");
    assert.equal(eq.getEquipment("Offhand")?.typeId, ITEMS.TORCH_ON);
    assert.equal(eq.getEquipment("Offhand")?.nameTag, "Backup");
    assert.equal(eq.getEquipment("Mainhand")?.typeId, "minecraft:cobblestone");
    assert.equal(eq.getEquipment("Mainhand")?.amount, 12);
    assert.equal(mock.lastActionBar(p), "Torchlight ON");
    mock.tick(10);
    assert.ok(mock.useItem(p, { stack: eq.getEquipment("Offhand") }));
    mock.tick();
    assert.equal(eq.getEquipment("Offhand")?.typeId, ITEMS.TORCH_OFF);
    assert.equal(mock.lastActionBar(p), "Torchlight OFF");
  });

  test("a block tap (itemUseOn + itemUse) toggles once", () => {
    const p = addTorchPlayer("Tapper", { item: ITEMS.TORCH_OFF });
    mock.setBlock(OW, { x: 0, y: 60, z: 0 }, "minecraft:stone");
    assert.ok(mock.useItemOn(p, { x: 0, y: 60, z: 0 }, Direction.Up, { withItemUse: true }));
    mock.tick();
    assert.equal(mock.inventory(p).getItem(0)?.typeId, ITEMS.TORCH_ON);
    assert.equal(mock.records.sounds.filter((r) => r.id === SOUNDS.TORCH_ON).length, 1);
    assert.equal(mock.records.sounds.filter((r) => r.id === SOUNDS.TORCH_OFF).length, 0);
  });

  test("holding the use button (repeated events inside the debounce window) toggles exactly once", () => {
    const p = addTorchPlayer("Holder", { item: ITEMS.TORCH_OFF });
    mock.holdUse(p, { ticks: 40, every: 4 });
    assert.equal(mock.inventory(p).getItem(0)?.typeId, ITEMS.TORCH_ON);
    assert.equal(mock.records.sounds.filter((r) => r.id.startsWith("pas.torch")).length, 1);
    assert.equal(mock.records.actionbars.filter((a) => a.text.startsWith("Torchlight")).length, 1);
  });
});

// ---------------------------------------------------------------------------
describe("2. real illumination", { skip: NEEDS_REF }, () => {
  test("light blocks 15/13/11 in front of the wall the player looks at; they follow the view", () => {
    standardRoom();
    const p = addTorchPlayer("Caver", { yaw: YAW.south });
    mock.tick(2);
    assert.deepEqual(lights(), SOUTH_LIGHTS);
    // exact permutation: the 1.21.0.26 light block with its level state
    const spot = mock.blockPerm(OW, { x: 0, y: 62, z: 9 });
    assert.equal(spot.type.id, LIGHT);
    assert.deepEqual(spot.getAllStates(), { block_light_level: 15 });
    assert.equal(spot, BlockPermutation.resolve(LIGHT, { block_light_level: 15 }));
    assert.equal(mock.blockName(OW, { x: 0, y: 62, z: 10 }), "minecraft:stone", "wall untouched");

    look(p, YAW.east);
    mock.tick(2);
    assert.deepEqual(lights(), EAST_LIGHTS, "lights moved with the view; old cells are air again");
    for (const k of Object.keys(SOUTH_LIGHTS)) {
      const [x, y, z] = k.split(",").map(Number);
      assert.equal(mock.blockName(OW, { x, y, z }), "minecraft:air");
    }
    look(p, YAW.north);
    mock.tick(2);
    // north: wall face z=-9 (distance 9.5); mid z=-3.775 -> -4; near z=-2.0 -> -2 (cells are floor()ed)
    assert.deepEqual(lights(), { "0,62,-9": 15, "0,62,-4": 13, "0,62,-2": 11 });
    assert.deepEqual(torchErrorsSince(errorSnapshot), {});
  });

  test("looking down at the floor: spot above the hit face, anchors in one cell collapse (max level)", () => {
    standardRoom();
    addTorchPlayer("Floor", { yaw: YAW.south, pitch: 45 });
    mock.tick(2);
    // ray (0,-1,1)/sqrt2 from y=62.62 meets the floor top (y=61) at z=2.12 -> block (0,60,2), face Up
    // spot (0,61,2); mid t=1.03 -> (0,61,1); near t=min(2.5, 2.29-0.25) -> (0,61,1) as well -> 13 kept
    assert.deepEqual(lights(), { "0,61,2": 15, "0,61,1": 13 });
  });

  test("nothing hit within 24 blocks: the spot is the beam end", () => {
    // empty (all-air) loaded world
    addTorchPlayer("Open", { yaw: YAW.east });
    mock.tick(2);
    assert.deepEqual(lights(), { "24,62,0": 15, "11,62,0": 13, "3,62,0": 11 });
  });

  test("anchors never end up behind a thin wall", () => {
    mock.fill(OW, { x: -3, y: 60, z: 3 }, { x: 3, y: 66, z: 3 }, "minecraft:stone");
    addTorchPlayer("Thin", { yaw: YAW.south });
    mock.tick(2);
    // wall face at z=3, distance 2.5: spot (0,62,2); mid 1.125 -> (0,62,1); near clamped to 2.25 -> (0,62,2)
    assert.deepEqual(lights(), { "0,62,2": 15, "0,62,1": 13 });
    assert.ok(mock.listBlocks(OW, LIGHT).every((b) => b.z < 3));
  });

  test("sweeping the view: never more than 3 light blocks, all of them owned and persisted", () => {
    standardRoom();
    const p = addTorchPlayer("Sweeper", { yaw: 0 });
    for (let yaw = 0; yaw < 360; yaw += 7) {
      for (const pitch of [-60, -20, 0, 30, 70]) {
        look(p, yaw, pitch);
        mock.tick(2);
        const ls = mock.listBlocks(OW, LIGHT);
        assert.ok(ls.length >= 1 && ls.length <= 3, `yaw ${yaw} pitch ${pitch}: ${ls.length} light blocks`);
        const owned = T.cellsOf(p.id);
        assert.deepEqual(new Set(ls.map((b) => `${OW}|${b.x}|${b.y}|${b.z}`)), new Set(owned.keys()));
      }
    }
    mock.tick(25);
    const stored = storedCells();
    assert.equal(stored.length, mock.listBlocks(OW, LIGHT).length);
    assert.deepEqual(torchErrorsSince(errorSnapshot), {});
  });

  test("the light cells are persisted as [[dimId,x,y,z],...]", () => {
    standardRoom();
    addTorchPlayer("Saver", { yaw: YAW.south });
    mock.tick(3);
    const stored = storedCells();
    assert.deepEqual(
      new Set(stored.map((e) => JSON.stringify(e))),
      new Set([[OW, 0, 62, 9], [OW, 0, 62, 4], [OW, 0, 62, 3]].map((e) => JSON.stringify(e))),
    );
  });

  test("a light block removed by someone else is restored within a second", () => {
    standardRoom();
    addTorchPlayer("Restorer", { yaw: YAW.south });
    mock.tick(2);
    mock.setBlock(OW, { x: 0, y: 62, z: 4 }, "minecraft:air");
    mock.tick(22);
    assert.deepEqual(lights(), SOUTH_LIGHTS);
  });
});

// ---------------------------------------------------------------------------
describe("3. never overwrite anything but air", { skip: NEEDS_REF }, () => {
  test("water in the spot cell: the spot walks back along the ray to air", () => {
    standardRoom();
    const w9 = mock.setBlock(OW, { x: 0, y: 62, z: 9 }, "minecraft:water");
    const w8 = mock.setBlock(OW, { x: 0, y: 62, z: 8 }, "minecraft:water");
    addTorchPlayer("Diver", { yaw: YAW.south });
    mock.tick(2);
    assert.deepEqual(lights(), { "0,62,7": 15, "0,62,4": 13, "0,62,3": 11 });
    assert.equal(mock.blockPerm(OW, { x: 0, y: 62, z: 9 }), w9);
    assert.equal(mock.blockPerm(OW, { x: 0, y: 62, z: 8 }), w8);
  });

  test("short grass / torch in anchor cells: relocated, the original blocks are untouched", () => {
    standardRoom();
    const grass = mock.setBlock(OW, { x: 0, y: 62, z: 9 }, "minecraft:short_grass");
    const torch = mock.setBlock(OW, { x: 0, y: 62, z: 3 }, "minecraft:torch", { torch_facing_direction: "south" });
    addTorchPlayer("Gardener", { yaw: YAW.south });
    mock.tick(2);
    // spot (0,62,9) is grass -> walk back -> (0,62,8); near (0,62,3) is a torch -> walk back -> (0,62,2)
    assert.deepEqual(lights(), { "0,62,8": 15, "0,62,4": 13, "0,62,2": 11 });
    assert.equal(mock.blockPerm(OW, { x: 0, y: 62, z: 9 }), grass);
    assert.equal(mock.blockPerm(OW, { x: 0, y: 62, z: 3 }), torch);
    assert.equal(mock.blockPerm(OW, { x: 0, y: 62, z: 3 }).getState("torch_facing_direction"), "south");
  });

  test("ray blocked behind: the 6 neighbours are tried (chest/torch/grass/stone/water skipped)", () => {
    standardRoom();
    const placed = {
      "0,62,9": mock.setBlock(OW, { x: 0, y: 62, z: 9 }, "minecraft:short_grass"),
      "0,62,8": mock.setBlock(OW, { x: 0, y: 62, z: 8 }, "minecraft:water"),
      "0,62,7": mock.setBlock(OW, { x: 0, y: 62, z: 7 }, "minecraft:water"),
      "0,63,9": mock.setBlock(OW, { x: 0, y: 63, z: 9 }, "minecraft:chest", { "minecraft:cardinal_direction": "north" }),
      "0,61,9": mock.setBlock(OW, { x: 0, y: 61, z: 9 }, "minecraft:torch", { torch_facing_direction: "top" }),
      "1,62,9": mock.setBlock(OW, { x: 1, y: 62, z: 9 }, "minecraft:short_grass"),
    };
    mock.containerAt(OW, { x: 0, y: 63, z: 9 }).setItem(0, new ItemStack("minecraft:bread", 3));
    const p = addTorchPlayer("Neighbour", { yaw: YAW.south });
    mock.tick(2);
    // up = chest, down = torch, north = water, south = wall, east = grass -> west (-1,62,9) is air
    assert.deepEqual(lights(), { "-1,62,9": 15, "0,62,4": 13, "0,62,3": 11 });

    // now block the west neighbour too: the spot is skipped entirely
    mock.setMainhand(p, "minecraft:stone");
    mock.tick(2);
    assert.deepEqual(lights(), {});
    placed["-1,62,9"] = mock.setBlock(OW, { x: -1, y: 62, z: 9 }, "minecraft:water");
    mock.setMainhand(p, ITEMS.TORCH_ON);
    mock.tick(2);
    assert.deepEqual(lights(), { "0,62,4": 13, "0,62,3": 11 });
    for (const [k, perm] of Object.entries(placed)) {
      const [x, y, z] = k.split(",").map(Number);
      assert.equal(mock.blockPerm(OW, { x, y, z }), perm, `block at ${k} unchanged`);
    }
    assert.equal(mock.containerAt(OW, { x: 0, y: 63, z: 9 }).getItem(0)?.typeId, "minecraft:bread", "chest contents kept");
  });

  test("underwater (no air anywhere near the anchors): no light at all, water untouched", () => {
    standardRoom();
    mock.fill(OW, { x: -9, y: 61, z: -9 }, { x: 9, y: 69, z: 9 }, "minecraft:water");
    const before = mock.countBlocks(OW, "minecraft:water");
    addTorchPlayer("Submarine", { yaw: YAW.south });
    mock.tick(4);
    assert.deepEqual(lights(), {});
    assert.equal(mock.countBlocks(OW, "minecraft:water"), before);
  });

  test("a foreign light block (not placed by the torch) is neither reused nor removed", () => {
    standardRoom();
    mock.setBlock(OW, { x: 0, y: 62, z: 9 }, LIGHT, { block_light_level: 7 });
    const p = addTorchPlayer("Guest", { yaw: YAW.south });
    mock.tick(2);
    assert.deepEqual(lights(), { "0,62,9": 7, "0,62,8": 15, "0,62,4": 13, "0,62,3": 11 });
    mock.setMainhand(p, undefined);
    mock.tick(2);
    assert.deepEqual(lights(), { "0,62,9": 7 });
  });
});

// ---------------------------------------------------------------------------
describe("4. cleanup", { skip: NEEDS_REF }, () => {
  /** Player in the standard room with the south lights placed. */
  function lit(name = "Cleaner") {
    standardRoom();
    const p = addTorchPlayer(name, { yaw: YAW.south });
    mock.tick(2);
    assert.deepEqual(lights(), SOUTH_LIGHTS);
    return p;
  }
  const lastReason = (p) => T.releaseLog.filter((r) => r.playerId === p.id).at(-1)?.reason;

  test("switching to another item removes all light blocks; the persisted list empties", () => {
    const p = lit();
    p.selectedSlotIndex = 1;
    mock.tick(2);
    assert.deepEqual(lights(), {});
    assert.equal(lastReason(p), "not-held");
    mock.tick(25);
    assert.deepEqual(storedCells(), []);
  });

  test("turning the torch off removes the lights immediately", () => {
    const p = lit();
    mock.tick(8);
    mock.useItem(p);
    mock.tick();
    assert.equal(mock.inventory(p).getItem(0)?.typeId, ITEMS.TORCH_OFF);
    assert.deepEqual(lights(), {});
    assert.equal(lastReason(p), "turned-off");
    mock.tick(10);
    mock.useItem(p);
    mock.tick();
    assert.deepEqual(lights(), SOUTH_LIGHTS, "turning on lights up immediately");
  });

  test("death removes the lights; dark while dead even if still holding; lit again after respawn", () => {
    const p = lit();
    p.kill();
    mock.tick();
    assert.deepEqual(lights(), {});
    assert.equal(lastReason(p), "death");
    mock.tick(20);
    assert.deepEqual(lights(), {}, "no light while dead");
    mock.respawnPlayer(p);
    mock.tick(3);
    assert.deepEqual(lights(), SOUTH_LIGHTS);
  });

  test("leaving: the before-event path alone (deferred with system.run) removes the lights", () => {
    const p = lit();
    T.options.sweepOffline = false;
    mock.removePlayer(p, { after: false });
    assert.deepEqual(lights(), SOUTH_LIGHTS, "nothing is written inside the read-only before-event");
    mock.tick();
    assert.deepEqual(lights(), {});
    assert.equal(lastReason(p), "leave-before");
  });

  test("leaving: the after-event path alone (by playerId) removes the lights", () => {
    const p = lit();
    T.options.sweepOffline = false;
    mock.removePlayer(p, { before: false });
    mock.flush();
    assert.deepEqual(lights(), {});
    assert.equal(lastReason(p), "leave-after");
  });

  test("leaving: both events together, and the offline sweep as a last resort", () => {
    const p = lit();
    mock.removePlayer(p);
    mock.tick();
    assert.deepEqual(lights(), {});
    const q = lit("Ghost");
    mock.removePlayer(q, { before: false, after: false }); // events lost
    mock.tick(41);
    assert.deepEqual(lights(), {});
    assert.equal(lastReason(q), "offline");
  });

  test("dimension change event releases the cells in fromDimension; the beam continues in the new one", () => {
    const p = lit();
    standardRoom(NE);
    p.teleport({ x: 0.5, y: 61, z: 0.5 }, { dimension: world.getDimension("nether") });
    mock.flush(); // deliver playerDimensionChange before any update runs
    assert.deepEqual(lights(OW), {});
    assert.equal(lastReason(p), "dimension-change");
    mock.tick(2);
    assert.deepEqual(lights(NE), SOUTH_LIGHTS);
    assert.deepEqual(lights(OW), {});
  });

  test("dimension mismatch noticed by the update itself (no event)", () => {
    const p = lit();
    standardRoom(NE);
    mock.move(p, { x: 0.5, y: 61, z: 0.5 }, NE);
    mock.tick(2);
    assert.deepEqual(lights(OW), {});
    assert.deepEqual(lights(NE), SOUTH_LIGHTS);
    assert.equal(lastReason(p), "dimension-mismatch");
  });

  test("a light cell a player replaced with stone is not removed", () => {
    const p = lit();
    mock.setBlock(OW, { x: 0, y: 62, z: 3 }, "minecraft:stone");
    mock.setMainhand(p, "minecraft:dirt");
    mock.tick(2);
    assert.equal(mock.blockName(OW, { x: 0, y: 62, z: 3 }), "minecraft:stone");
    assert.deepEqual(lights(), {});
  });

  test("a replaced spot cell while still lighting: stone stays, the spot moves in front of it", () => {
    const p = lit();
    mock.setBlock(OW, { x: 0, y: 62, z: 9 }, "minecraft:stone");
    mock.tick(2);
    assert.equal(mock.blockName(OW, { x: 0, y: 62, z: 9 }), "minecraft:stone");
    // new wall face at z=9 (distance 8.5): spot (0,62,8), mid 3.825 -> z=4.325 -> (0,62,4), near (0,62,3)
    assert.deepEqual(lights(), { "0,62,8": 15, "0,62,4": 13, "0,62,3": 11 });
    mock.setMainhand(p, undefined);
    mock.tick(2);
    assert.equal(mock.blockName(OW, { x: 0, y: 62, z: 9 }), "minecraft:stone");
    assert.deepEqual(lights(), {});
  });

  test("release while the chunk is unloaded: kept pending (and persisted), cleared once loaded", () => {
    standardRoom();
    // looking west from x=8.5: spot (-9,62,0) lies in chunk (-1,0); mid/near in chunk (0,0)
    const p = addTorchPlayer("Pending", { feet: { x: 8.5, y: 61, z: 0.5 }, yaw: YAW.west });
    mock.tick(2);
    assert.deepEqual(lights(), { "-9,62,0": 15, "0,62,0": 13, "6,62,0": 11 });
    mock.unloadChunk(OW, -1, 0);
    mock.setMainhand(p, undefined);
    mock.tick(2);
    assert.deepEqual(lights(), { "-9,62,0": 15 }, "unreachable cell is still there");
    assert.equal(T.pendingCount(), 1);
    mock.tick(41);
    assert.deepEqual(storedCells(), [[OW, -9, 62, 0]]);
    mock.loadChunk(OW, -1, 0);
    mock.tick(41);
    assert.deepEqual(lights(), {});
    assert.equal(T.pendingCount(), 0);
    mock.tick(21);
    assert.deepEqual(storedCells(), []);
  });
});

// ---------------------------------------------------------------------------
describe("5. shared cells", { skip: NEEDS_REF }, () => {
  test("two players lighting the same cells: reference counting keeps them until both release", () => {
    standardRoom();
    const a = addTorchPlayer("Alpha", { yaw: YAW.south });
    const b = addTorchPlayer("Bravo", { yaw: YAW.south });
    mock.tick(2);
    assert.deepEqual(lights(), SOUTH_LIGHTS);
    const cell = T.lights.cells.get(`${OW}|0|62|9`);
    assert.deepEqual(new Set(cell.owners.keys()), new Set([a.id, b.id]));
    mock.setMainhand(a, undefined);
    mock.tick(2);
    assert.deepEqual(lights(), SOUTH_LIGHTS, "still owned by Bravo");
    mock.setMainhand(b, undefined);
    mock.tick(2);
    assert.deepEqual(lights(), {});
  });

  test("shared cell with different wanted levels shows the max and re-levels when one owner leaves", () => {
    standardRoom();
    const a = addTorchPlayer("Ash", { yaw: YAW.south }); // spot 9:15, mid 4:13, near 3:11
    const b = addTorchPlayer("Birch", { feet: { x: 0.5, y: 61, z: 1.5 }, yaw: YAW.south }); // spot 9:15, mid 5:13, near 4:11
    mock.tick(2);
    assert.deepEqual(lights(), { "0,62,9": 15, "0,62,5": 13, "0,62,4": 13, "0,62,3": 11 });
    mock.setMainhand(a, undefined);
    mock.tick(2);
    assert.deepEqual(lights(), { "0,62,9": 15, "0,62,5": 13, "0,62,4": 11 }, "(0,62,4) drops to Birch's level");
    mock.setMainhand(b, undefined);
    mock.tick(2);
    assert.deepEqual(lights(), {});
  });
});

// ---------------------------------------------------------------------------
describe("7. robustness and performance", { skip: NEEDS_REF }, () => {
  test("no light block is ever placed for players not holding the lit torch", () => {
    standardRoom();
    const p1 = addTorchPlayer("Empty", { item: null, yaw: YAW.south });
    const p2 = addTorchPlayer("Off", { item: ITEMS.TORCH_OFF, yaw: YAW.east });
    const p3 = addTorchPlayer("Stone", { item: "minecraft:stone", yaw: YAW.north });
    const p4 = addTorchPlayer("Pocket", { item: null, yaw: YAW.west });
    mock.give(p4, ITEMS.TORCH_ON, 1, 5); // lit torch in the inventory but not in a hand
    const writes = countCalls(mc.Block.prototype, "setPermutation", () => {
      const reads = countCalls(mc.Dimension.prototype, "getBlock", () => mock.tick(40));
      assert.equal(reads, 0, "no block reads for players without the lit torch");
    });
    assert.equal(writes, 0);
    assert.deepEqual(lights(), {});
    assert.deepEqual(T.cellsOf(p1.id).size + T.cellsOf(p2.id).size + T.cellsOf(p3.id).size + T.cellsOf(p4.id).size, 0);
  });

  test("standing still: no block writes and only periodic re-validation reads", () => {
    standardRoom();
    addTorchPlayer("Still", { yaw: YAW.south });
    mock.tick(2);
    let reads = 0;
    const writes = countCalls(mc.Block.prototype, "setPermutation", () => {
      reads = countCalls(mc.Dimension.prototype, "getBlock", () => mock.tick(40));
    });
    assert.equal(writes, 0);
    assert.ok(reads <= 2 * 3, `at most one 3-cell re-validation per 20 ticks, got ${reads}`);
    assert.deepEqual(lights(), SOUTH_LIGHTS);
  });

  test("at most 6 block writes per update while the view moves", () => {
    standardRoom();
    const p = addTorchPlayer("Spinner", { yaw: 0 });
    let max = 0;
    for (let i = 0; i < 120; i++) {
      look(p, i * 23, ((i * 37) % 140) - 70);
      const w = countCalls(mc.Block.prototype, "setPermutation", () => mock.tick(2));
      max = Math.max(max, w);
    }
    assert.ok(max <= 6, `max writes per update ${max}`);
    assert.ok(mock.listBlocks(OW, LIGHT).length <= 3);
  });

  test("player in the void, above the world, or in unloaded chunks: no lights, no errors", () => {
    const p = addTorchPlayer("Voider", { feet: { x: 0.5, y: -100, z: 0.5 }, yaw: 0, pitch: -80 });
    mock.tick(6);
    mock.move(p, { x: 0.5, y: 400, z: 0.5 });
    look(p, 0, 90);
    mock.tick(6);
    assert.deepEqual(lights(), {});
    // everything around unloaded, both getBlock behaviours
    mock.move(p, { x: 0.5, y: 61, z: 0.5 });
    look(p, YAW.south);
    mock.setLoadedPredicate(OW, () => false);
    mock.tick(6);
    mock.setOptions({ unloadedGetBlock: "throw" });
    mock.tick(6);
    assert.deepEqual(lights(), {});
    mock.setOptions({ unloadedGetBlock: "undefined" });
    mock.setLoadedPredicate(OW, undefined);
    standardRoom();
    mock.tick(22);
    assert.deepEqual(lights(), SOUTH_LIGHTS, "works again once the area is loaded");
    assert.deepEqual(torchErrorsSince(errorSnapshot), {});
    assert.deepEqual(mock.errors, []);
  });

  test("getBlockFromRay throwing: the manual DDA fallback produces the same lights", () => {
    standardRoom();
    const dim = world.getDimension("overworld");
    dim.getBlockFromRay = () => {
      throw new Error("simulated native failure");
    };
    try {
      addTorchPlayer("Fallback", { yaw: YAW.south });
      mock.tick(2);
      assert.deepEqual(lights(), SOUTH_LIGHTS);
    } finally {
      delete dim.getBlockFromRay;
    }
    assert.ok((getErrorCounts().get("torch.getBlockFromRay") ?? 0) > (errorSnapshot.get("torch.getBlockFromRay") ?? 0));
  });

  test("a build that rejects excludeTypes: the filter is dropped once, the API raycast keeps working", () => {
    standardRoom();
    const dim = world.getDimension("overworld");
    const orig = mc.Dimension.prototype.getBlockFromRay;
    let calls = 0;
    dim.getBlockFromRay = function (o, d, opts) {
      calls++;
      if (opts?.excludeTypes) throw new TypeError("unsupported option excludeTypes");
      return orig.call(this, o, d, opts);
    };
    try {
      addTorchPlayer("OldApi", { yaw: YAW.south });
      mock.tick(2);
      assert.deepEqual(lights(), SOUTH_LIGHTS);
      assert.equal(T.beam.rayFilter.excludeLights, false);
      const before = calls;
      mock.tick(2);
      assert.equal(calls - before, 1, "one plain raycast per update afterwards");
    } finally {
      delete dim.getBlockFromRay;
    }
  });

  test("a raycast that reports our own light blocks as hits (filter ignored) still yields stable anchors", () => {
    standardRoom();
    const dim = world.getDimension("overworld");
    const orig = mc.Dimension.prototype.getBlockFromRay;
    // light blocks count as hits, excludeTypes is ignored
    dim.getBlockFromRay = function (o, d, opts) {
      return orig.call(this, o, d, { ...opts, excludeTypes: undefined, includePassableBlocks: true });
    };
    try {
      const p = addTorchPlayer("Solid", { yaw: YAW.south });
      for (let i = 0; i < 30; i++) {
        mock.tick(2);
        assert.deepEqual(lights(), SOUTH_LIGHTS, `update ${i}`);
      }
      look(p, YAW.east);
      mock.tick(2);
      assert.deepEqual(lights(), EAST_LIGHTS);
    } finally {
      delete dim.getBlockFromRay;
    }
  });

  test("manual DDA agrees with getBlockFromRay (hit cell, face normal, distance) in a random cave", () => {
    let seed = 99;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < 900; i++) {
      const x = Math.floor(rnd() * 30) - 15;
      const y = 50 + Math.floor(rnd() * 30);
      const z = Math.floor(rnd() * 30) - 15;
      const r = rnd();
      mock.setBlock(OW, { x, y, z }, r < 0.75 ? "minecraft:stone" : r < 0.9 ? "minecraft:water" : "minecraft:short_grass");
    }
    const dim = world.getDimension("overworld");
    let hits = 0;
    for (let i = 0; i < 400; i++) {
      const origin = { x: rnd() * 6 - 3, y: 62 + rnd() * 6, z: rnd() * 6 - 3 };
      if (mock.blockName(OW, origin) !== "minecraft:air") continue;
      const th = rnd() * Math.PI * 2;
      const ph = rnd() * Math.PI - Math.PI / 2;
      const dir = { x: Math.cos(ph) * Math.cos(th), y: Math.sin(ph), z: Math.cos(ph) * Math.sin(th) };
      const a = castBeam(dim, origin, dir);
      const b = castBeamManual(dim, origin, dir);
      assert.equal(a.method, "api");
      assert.equal(b.method, "dda");
      assert.deepEqual(b.hitCell, a.hitCell, `ray ${i}`);
      if (a.hitCell) {
        hits++;
        assert.deepEqual({ ...b.normal }, { ...a.normal }, `normal ${i}`);
        assert.ok(Math.abs(a.dist - b.dist) < 1e-9, `dist ${i}: ${a.dist} vs ${b.dist}`);
      }
      assert.deepEqual(rawAnchors(origin, dir, a).map((x) => x.cell), rawAnchors(origin, dir, b).map((x) => x.cell));
    }
    assert.ok(hits > 50, `enough hits to be meaningful (${hits})`);
  });

  test("light block permutation: 1.21.0 state form, with the light_block_<N> fallback for newer builds", () => {
    assert.equal(lightPermutation(15), BlockPermutation.resolve(LIGHT, { block_light_level: 15 }));
    assert.equal(lightPermutation(11).getState("block_light_level"), 11);
    assert.ok(isLightBlockId(LIGHT) && isLightBlockId("minecraft:light_block_7") && !isLightBlockId("minecraft:light_gray_wool"));
    const orig = BlockPermutation.resolve;
    const calls = [];
    T.lights.resetPermCache();
    BlockPermutation.resolve = (name, states) => {
      calls.push(name);
      if (name === LIGHT) throw new Error("unknown block (simulated newer build)");
      const m = /^minecraft:light_block_(\d+)$/.exec(name);
      if (m) return orig.call(BlockPermutation, LIGHT, { block_light_level: Number(m[1]) }); // stand-in permutation
      return orig.call(BlockPermutation, name, states);
    };
    try {
      assert.equal(lightPermutation(14)?.getState("block_light_level"), 14);
      assert.deepEqual(calls, [LIGHT, "minecraft:light_block_14"]);
      calls.length = 0;
      assert.equal(lightPermutation(12)?.getState("block_light_level"), 12);
      assert.deepEqual(calls, ["minecraft:light_block_12"], "the working form is cached");
      calls.length = 0;
      lightPermutation(12);
      assert.deepEqual(calls, [], "permutations are cached");
    } finally {
      BlockPermutation.resolve = orig;
      T.lights.resetPermCache();
    }
    assert.equal(lightPermutation(15), BlockPermutation.resolve(LIGHT, { block_light_level: 15 }));
  });
});
