// Tests for the shared script library (addon/behavior_pack/scripts/lib).
// Run: npm test   (node --import ./tests/mock/register.mjs --test "tests/**/*.test.mjs")

import test, { describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { mock } from "./mock/testkit.mjs";
import { world, system, ItemStack, GameMode, Direction } from "@minecraft/server";

import * as util from "../addon/behavior_pack/scripts/lib/util.js";
import * as store from "../addon/behavior_pack/scripts/lib/store.js";
import { registerItemHandler, DEBOUNCE_TICKS, __itemsInternals } from "../addon/behavior_pack/scripts/lib/items.js";
import { initKit, giveKit, KIT_ITEMS } from "../addon/behavior_pack/scripts/lib/kit.js";
import { ITEMS, PROPS } from "../addon/behavior_pack/scripts/lib/ids.js";

const OW = "minecraft:overworld";

function freshWorld() {
  mock.reset();
  mock.setOptions({ throwHandlerErrors: true });
  __itemsInternals.resetDebounce();
}

// ---------------------------------------------------------------------------
describe("util", () => {
  beforeEach(freshWorld);

  test("vector helpers", () => {
    assert.deepEqual(util.add(util.vec(1, 2, 3), util.vec(1, 1, 1)), { x: 2, y: 3, z: 4 });
    assert.deepEqual(util.sub(util.vec(1, 2, 3), util.vec(1, 1, 1)), { x: 0, y: 1, z: 2 });
    assert.deepEqual(util.scale(util.vec(1, -2, 3), 2), { x: 2, y: -4, z: 6 });
    assert.equal(util.dot(util.vec(1, 2, 3), util.vec(4, 5, 6)), 32);
    assert.equal(util.len(util.vec(3, 4, 0)), 5);
    assert.deepEqual(util.normalize(util.vec(0, 0, 0)), { x: 0, y: 0, z: 0 });
    assert.ok(Math.abs(util.len(util.normalize(util.vec(3, 4, 12))) - 1) < 1e-12);
    assert.deepEqual(util.floorVec(util.vec(-0.5, 1.9, -3.01)), { x: -1, y: 1, z: -4 });
    assert.deepEqual(util.center(util.vec(-1.2, 5, 2.9)), { x: -1.5, y: 5.5, z: 2.5 });
  });

  test("blockKey / parseBlockKey round trip (negative + fractional coords)", () => {
    const k = util.blockKey(OW, { x: -1.5, y: -64, z: 7.99 });
    assert.equal(k, "minecraft:overworld|-2|-64|7");
    assert.deepEqual(util.parseBlockKey(k), { dimId: OW, x: -2, y: -64, z: 7 });
    assert.equal(util.parseBlockKey("garbage"), undefined);
    assert.equal(util.parseBlockKey("a|1|2|x"), undefined);
  });

  test("cardinalFromYaw follows Bedrock yaw (0 = south, 90 = west)", () => {
    assert.equal(util.cardinalFromYaw(0), "south");
    assert.equal(util.cardinalFromYaw(90), "west");
    assert.equal(util.cardinalFromYaw(-90), "east");
    assert.equal(util.cardinalFromYaw(180), "north");
    assert.equal(util.cardinalFromYaw(-180), "north");
    assert.equal(util.cardinalFromYaw(44.9), "south");
    assert.equal(util.cardinalFromYaw(45), "west");
    assert.equal(util.cardinalFromYaw(270), "east");
    assert.equal(util.cardinalFromYaw(-450), "east");
    assert.equal(util.cardinalFromYaw(-45), "south");
    assert.equal(util.cardinalFromYaw(-45.1), "east");
    for (const c of ["north", "south", "east", "west"]) {
      assert.equal(util.oppositeCardinal(util.oppositeCardinal(c)), c);
    }
  });

  test("safe() returns a wrapper that swallows errors and rejected promises", async () => {
    let called = 0;
    const ok = util.safe((a, b) => {
      called++;
      return a + b;
    }, "t.ok");
    assert.equal(ok(2, 3), 5);
    const bad = util.safe(() => {
      throw new Error("boom");
    }, "t.bad");
    assert.equal(bad(), undefined);
    const before = util.getErrorCounts().get("t.reject") ?? 0;
    util.safe(async () => {
      throw new Error("async boom");
    }, "t.reject")();
    await mock.settle();
    assert.equal(util.getErrorCounts().get("t.reject"), before + 1);
    assert.equal(util.runSafe(() => 7, "t.run"), 7);
    assert.equal(called, 1);
  });

  test("safeGetBlock / isLoaded: loaded, unloaded (both API behaviours) and out of world", () => {
    const dim = world.getDimension("overworld");
    mock.setBlock(OW, { x: 3, y: 64, z: 3 }, "minecraft:stone");
    assert.equal(util.safeGetBlock(dim, { x: 3.7, y: 64.2, z: 3.1 })?.typeId, "minecraft:stone");
    assert.equal(util.isLoaded(dim, { x: 3, y: 64, z: 3 }), true);
    // out of the height range: getBlock throws LocationOutOfWorldBoundariesError
    assert.throws(() => dim.getBlock({ x: 0, y: 320, z: 0 }), { name: "LocationOutOfWorldBoundariesError" });
    assert.equal(util.safeGetBlock(dim, { x: 0, y: 320, z: 0 }), undefined);
    assert.equal(util.safeGetBlock(dim, { x: 0, y: -65, z: 0 }), undefined);
    assert.ok(util.safeGetBlock(dim, { x: 0, y: -64, z: 0 }));
    assert.ok(util.safeGetBlock(dim, { x: 0, y: 319, z: 0 }));
    // unloaded chunk: documented return value undefined ...
    mock.unloadAt(OW, { x: 3, y: 0, z: 3 });
    assert.equal(dim.getBlock({ x: 3, y: 64, z: 3 }), undefined);
    assert.equal(util.safeGetBlock(dim, { x: 3, y: 64, z: 3 }), undefined);
    assert.equal(util.isLoaded(dim, { x: 3, y: 64, z: 3 }), false);
    // ... and the throwing variant (LocationInUnloadedChunkError) is handled as well
    mock.setOptions({ unloadedGetBlock: "throw" });
    assert.throws(() => dim.getBlock({ x: 3, y: 64, z: 3 }), { name: "LocationInUnloadedChunkError" });
    assert.equal(util.safeGetBlock(dim, { x: 3, y: 64, z: 3 }), undefined);
    mock.setOptions({ unloadedGetBlock: "undefined" });
    // a Block handle whose chunk unloads afterwards throws on access; safe helpers do not
    mock.loadAt(OW, { x: 3, y: 0, z: 3 });
    const b = dim.getBlock({ x: 3, y: 64, z: 3 });
    mock.unloadAt(OW, { x: 3, y: 0, z: 3 });
    assert.equal(b.isValid(), false);
    assert.throws(() => b.typeId, { name: "LocationInUnloadedChunkError" });
    assert.equal(util.blockTypeAt(dim, { x: 3, y: 64, z: 3 }), undefined);
  });

  test("getHeld / setHeld / findHeld: main hand first, then off hand", () => {
    const p = mock.addPlayer({ name: "H" });
    mock.tick();
    assert.equal(util.getHeld(p), undefined);
    mock.setOffhand(p, ITEMS.TORCH_ON);
    assert.deepEqual(
      { id: util.getHeld(p)?.stack.typeId, hand: util.getHeld(p)?.hand },
      { id: ITEMS.TORCH_ON, hand: "Offhand" },
    );
    mock.setMainhand(p, "minecraft:stone", 5);
    assert.equal(util.getHeld(p)?.hand, "Mainhand");
    assert.equal(util.getHeld(p)?.stack.typeId, "minecraft:stone");
    assert.equal(util.findHeld(p, [ITEMS.TORCH_ON, ITEMS.TORCH_OFF])?.hand, "Offhand");
    // setHeld writes through equippable; Mainhand mirrors the selected hotbar slot
    p.selectedSlotIndex = 3;
    assert.ok(util.setHeld(p, "Mainhand", new ItemStack(ITEMS.TORCH_OFF)));
    assert.equal(mock.inventory(p).getItem(3)?.typeId, ITEMS.TORCH_OFF);
    assert.ok(util.setHeld(p, "Offhand", undefined));
    assert.equal(util.getHand(p, "Offhand"), undefined);
    // swap keeps nameTag + lore when the caller copies them
    const s = new ItemStack(ITEMS.TORCH_OFF);
    s.nameTag = "Lumen";
    s.setLore(["a", "b"]);
    util.setHeld(p, "Mainhand", s);
    const back = util.getHand(p, "Mainhand");
    assert.equal(back?.nameTag, "Lumen");
    assert.deepEqual(back?.getLore(), ["a", "b"]);
  });

  test("consumeHeld: one item in survival/adventure, nothing in creative", () => {
    const p = mock.addPlayer({ name: "C", gameMode: GameMode.survival });
    mock.tick();
    mock.setMainhand(p, ITEMS.OUTBREAK, 2);
    assert.equal(util.isSurvivalLike(p), true);
    assert.equal(util.consumeHeld(p, "Mainhand"), true);
    assert.equal(util.getHand(p, "Mainhand")?.amount, 1);
    assert.equal(util.consumeHeld(p, "Mainhand"), true);
    assert.equal(util.getHand(p, "Mainhand"), undefined);
    assert.equal(util.consumeHeld(p, "Mainhand"), false);
    p.setGameMode(GameMode.creative);
    mock.setMainhand(p, ITEMS.OUTBREAK, 2);
    assert.equal(util.isSurvivalLike(p), false);
    assert.equal(util.consumeHeld(p, "Mainhand"), false);
    assert.equal(util.getHand(p, "Mainhand")?.amount, 2);
    p.setGameMode(GameMode.adventure);
    assert.equal(util.consumeHeld(p, "Mainhand"), true);
  });

  test("giveOrDrop drops what does not fit", () => {
    const p = mock.addPlayer({ name: "G", location: { x: 5.5, y: 70, z: 5.5 } });
    mock.tick();
    const inv = mock.inventory(p);
    for (let i = 0; i < inv.size; i++) inv.setItem(i, new ItemStack("minecraft:dirt", 64));
    assert.equal(util.giveOrDrop(p, new ItemStack(ITEMS.CONTROL)), false);
    const items = world.getDimension("overworld").getEntities({ type: "minecraft:item" });
    assert.equal(items.length, 1);
    assert.equal(items[0].getComponent("minecraft:item")?.itemStack.typeId, ITEMS.CONTROL);
    inv.setItem(0);
    assert.equal(util.giveOrDrop(p, new ItemStack(ITEMS.CONTROL)), true);
    assert.equal(inv.getItem(0)?.typeId, ITEMS.CONTROL);
  });

  test("feedback helpers record actionbar/title/sound/particle and never throw", () => {
    const p = mock.addPlayer({ name: "F" });
    mock.tick();
    const dim = world.getDimension("overworld");
    assert.ok(util.actionbar(p, "Torchlight ON"));
    assert.equal(mock.lastActionBar(p), "Torchlight ON");
    assert.ok(util.title(p, "☣ PARASITE OUTBREAK ☣", "run"));
    assert.equal(mock.records.titles.at(-1).subtitle, "run");
    assert.ok(util.tell(p, "hi"));
    assert.deepEqual(mock.messagesTo(p), ["hi"]);
    assert.ok(util.playSound(dim, "pas.torch.on", { x: 0, y: 64, z: 0 }));
    assert.ok(util.playSoundTo(p, "pas.ui.open"));
    assert.ok(util.spawnParticle(dim, "pas:infection_spores", { x: 0, y: 64, z: 0 }));
    mock.unloadAt(OW, { x: 100, y: 0, z: 100 });
    assert.equal(util.spawnParticle(dim, "pas:infection_spores", { x: 100, y: 64, z: 100 }), false);
    assert.equal(util.allDimensions().length, 3);
    assert.equal(util.getDimension("nope:dim"), undefined);
  });
});

// ---------------------------------------------------------------------------
describe("store", () => {
  beforeEach(freshWorld);

  test("small values are plain JSON under the key", () => {
    assert.ok(store.saveJSON("pas:test", { a: 1, b: [1, 2] }));
    assert.equal(world.getDynamicProperty("pas:test"), '{"a":1,"b":[1,2]}');
    assert.deepEqual(store.loadJSON("pas:test", null), { a: 1, b: [1, 2] });
    assert.deepEqual(store.loadJSON("pas:missing", { def: true }), { def: true });
  });

  test("the mock enforces the 32767 limit, so big values must be chunked", () => {
    assert.throws(() => world.setDynamicProperty("pas:raw", "x".repeat(32768)));
    world.setDynamicProperty("pas:raw", "x".repeat(32767));
  });

  test("values > 30k chars are chunked into key, key#1, key#2 ... and read back", () => {
    const cells = [];
    for (let i = 0; i < 6000; i++) cells.push([OW, i, 64, -i - 1]);
    const json = JSON.stringify(cells);
    assert.ok(json.length > 90000);
    assert.ok(store.saveJSON("pas:torch_cells", cells));
    const ids = world.getDynamicPropertyIds().filter((k) => k.startsWith("pas:torch_cells")).sort();
    assert.ok(ids.length >= 4, `expected >= 4 parts, got ${ids}`);
    for (const id of ids) {
      const v = world.getDynamicProperty(id);
      assert.equal(typeof v, "string");
      assert.ok(Buffer.byteLength(v, "utf8") <= 32767);
    }
    assert.deepEqual(store.loadJSON("pas:torch_cells", null), cells);
    // shrinking removes stale parts
    assert.ok(store.saveJSON("pas:torch_cells", [[OW, 1, 2, 3]]));
    assert.deepEqual(
      world.getDynamicPropertyIds().filter((k) => k.startsWith("pas:torch_cells")),
      ["pas:torch_cells"],
    );
    assert.deepEqual(store.loadJSON("pas:torch_cells", null), [[OW, 1, 2, 3]]);
    // delete
    assert.ok(store.saveJSON("pas:torch_cells", cells));
    assert.ok(store.saveJSON("pas:torch_cells", undefined));
    assert.deepEqual(world.getDynamicPropertyIds().filter((k) => k.startsWith("pas:torch_cells")), []);
  });

  test("multi-byte text is chunked by UTF-8 bytes without splitting characters", () => {
    const text = "☣ Infected Steve 🧟 ".repeat(4000);
    const value = { names: [text, "ü".repeat(20000)] };
    assert.ok(store.saveJSON("pas:unicode", value));
    assert.deepEqual(store.loadJSON("pas:unicode", null), value);
    const parts = store.splitUtf8("a🧟b", 4);
    assert.deepEqual(parts, ["a", "🧟", "b"]);
  });

  test("corrupt data falls back", () => {
    world.setDynamicProperty("pas:bad", "{not json");
    assert.equal(store.loadJSON("pas:bad", 42), 42);
    world.setDynamicProperty("pas:bad2", "#pas-chunks:3#[1,");
    assert.equal(store.loadJSON("pas:bad2", "fb"), "fb");
  });

  test("scheduleSave writes at most once per 20 ticks, with the latest getter", () => {
    let writes = 0;
    const realSet = world.setDynamicProperty.bind(world);
    world.setDynamicProperty = (k, v) => {
      if (k === "pas:sched") writes++;
      realSet(k, v);
    };
    try {
      let value = 0;
      for (let i = 0; i < 5; i++) store.scheduleSave("pas:sched", () => ({ value: ++value }));
      assert.equal(writes, 0, "never synchronous");
      mock.tick(1);
      assert.equal(writes, 1);
      assert.deepEqual(store.loadJSON("pas:sched", null), { value: 1 });
      const t0 = system.currentTick;
      // a burst right after a write waits for the 20-tick window
      for (let i = 0; i < 10; i++) {
        store.scheduleSave("pas:sched", () => ({ value: 100 + i }));
        mock.tick(1);
      }
      assert.equal(writes, 1, "throttled");
      mock.runUntil(() => writes === 2, 40);
      assert.ok(system.currentTick - t0 >= 20 - 1, `second write at +${system.currentTick - t0}`);
      assert.deepEqual(store.loadJSON("pas:sched", null), { value: 109 });
      // flushSaves forces a pending write now
      store.scheduleSave("pas:sched", () => ({ value: "flushed" }));
      assert.ok(store.hasPendingSaves());
      store.flushSaves();
      assert.equal(writes, 3);
      assert.deepEqual(store.loadJSON("pas:sched", null), { value: "flushed" });
      mock.tick(40);
      assert.equal(writes, 3, "cleared run does not write again");
    } finally {
      delete world.setDynamicProperty;
    }
  });
});

// ---------------------------------------------------------------------------
describe("items dispatcher (edge debounce)", () => {
  /** @type {any[]} */
  const calls = [];
  const TEST_ITEM = ITEMS.CONTROL;
  registerItemHandler(TEST_ITEM, {
    onUse: (player, stack, ctx) => calls.push({ kind: "use", player: player.name, item: stack.typeId, ctx }),
    onUseOn: (player, block, face, stack, ctx) =>
      calls.push({ kind: "useOn", player: player.name, block: block.typeId, face, item: stack.typeId, ctx }),
  });
  registerItemHandler(ITEMS.TORCH_OFF, {
    onUse: () => calls.push({ kind: "torch" }),
  });

  /** @returns {import("@minecraft/server").Player} */
  function setup() {
    freshWorld();
    calls.length = 0;
    const p = mock.addPlayer({ name: "U" });
    mock.tick();
    mock.setMainhand(p, TEST_ITEM);
    mock.fill(OW, { x: -3, y: 60, z: -3 }, { x: 3, y: 63, z: 3 }, "minecraft:grass_block");
    return p;
  }

  test("DEBOUNCE_TICKS is 6", () => assert.equal(DEBOUNCE_TICKS, 6));

  test("a tap in the air gives exactly one onUse, on the next tick", () => {
    const p = setup();
    mock.useItem(p);
    assert.equal(calls.length, 0, "deferred");
    mock.tick();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, "use");
    assert.equal(calls[0].item, TEST_ITEM);
    assert.equal(calls[0].ctx.hand, "Mainhand");
  });

  test("a block tap firing before+after itemUseOn AND itemUse gives one onUseOn", () => {
    const p = setup();
    const block = world.getDimension("overworld").getBlock({ x: 0, y: 63, z: 0 });
    mock.useItemOn(p, block, Direction.Up, { withItemUse: true });
    mock.tick(10);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, "useOn");
    assert.equal(calls[0].block, "minecraft:grass_block");
    assert.equal(calls[0].face, Direction.Up);
    assert.deepEqual(calls[0].ctx.sources.sort(), ["beforeItemUseOn", "itemUse", "itemUseOn"]);
  });

  test("itemUse arriving before itemUseOn in the same tick still dispatches onUseOn", () => {
    const p = setup();
    const block = world.getDimension("overworld").getBlock({ x: 0, y: 63, z: 0 });
    mock.useItem(p);
    mock.fireAfter("itemUseOn", { source: p, itemStack: new ItemStack(TEST_ITEM), block, blockFace: Direction.North, faceLocation: { x: 0.5, y: 0.5, z: 0 } });
    mock.tick(3);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, "useOn");
    assert.equal(calls[0].face, Direction.North);
  });

  test("holding the button (events every 1-5 ticks) gives exactly one action", () => {
    for (const every of [1, 2, 4, 5, 6]) {
      const p = setup();
      mock.holdUse(p, { ticks: 60, every });
      mock.tick(10);
      assert.equal(calls.length, 1, `every=${every}: ${calls.length} actions`);
    }
    const p = setup();
    const block = world.getDimension("overworld").getBlock({ x: 1, y: 63, z: 1 });
    mock.holdUse(p, { ticks: 60, every: 4, block });
    mock.tick(10);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, "useOn");
  });

  test("taps more than 6 ticks apart are separate actions; within 6 ticks they are one", () => {
    let p = setup();
    mock.useItem(p);
    mock.tick(7);
    mock.useItem(p);
    mock.tick(2);
    assert.equal(calls.length, 2, "7 ticks apart -> 2 actions");
    p = setup();
    mock.useItem(p);
    mock.tick(6);
    mock.useItem(p);
    mock.tick(2);
    assert.equal(calls.length, 1, "6 ticks apart -> 1 action");
    // ... and every rejected event refreshes the window
    p = setup();
    mock.useItem(p);
    mock.tick(5);
    mock.useItem(p); // rejected, refreshes
    mock.tick(5);
    mock.useItem(p); // 10 ticks after the first, but only 5 after the last event -> rejected
    mock.tick(7);
    mock.useItem(p); // 7 after the last event -> accepted
    mock.tick(2);
    assert.equal(calls.length, 2);
  });

  test("debounce is per player and handlers run outside the before-event read-only mode", () => {
    const p = setup();
    const q = mock.addPlayer({ name: "V" });
    mock.tick();
    mock.setMainhand(q, TEST_ITEM);
    // a handler that modifies the world: would throw if run inside the before-event
    registerItemHandler(ITEMS.BASE_SPAWNER, {
      onUseOn: (player, block) => {
        block.above()?.setType("minecraft:stone");
        calls.push({ kind: "placed" });
      },
    });
    mock.setMainhand(p, ITEMS.BASE_SPAWNER);
    const block = world.getDimension("overworld").getBlock({ x: 2, y: 63, z: 2 });
    mock.useItemOn(p, block, Direction.Up); // before-event (read-only) + after-event
    mock.useItem(q);
    mock.tick(2);
    assert.deepEqual(calls.map((c) => c.kind).sort(), ["placed", "use"]);
    assert.equal(mock.blockName(OW, { x: 2, y: 64, z: 2 }), "minecraft:stone");
    assert.equal(mock.errors.length, 0);
  });

  test("events for items without handlers are ignored; handler errors do not escape", () => {
    const p = setup();
    mock.setMainhand(p, "minecraft:stick");
    mock.useItem(p);
    mock.tick(2);
    assert.equal(calls.length, 0);
    registerItemHandler(ITEMS.OUTBREAK, {
      onUse: () => {
        throw new Error("handler bug");
      },
    });
    mock.setMainhand(p, ITEMS.OUTBREAK);
    mock.tick(10);
    mock.useItem(p);
    mock.tick(2); // must not throw MockHandlerError: the dispatcher catches it
    assert.equal(mock.errors.length, 0);
  });

  test("the torch item id routes to its own handler", () => {
    const p = setup();
    mock.setMainhand(p, ITEMS.TORCH_OFF);
    mock.useItem(p);
    mock.tick();
    assert.deepEqual(calls.map((c) => c.kind), ["torch"]);
  });
});

// ---------------------------------------------------------------------------
describe("kit", () => {
  before(() => {
    initKit();
    initKit(); // idempotent: must not double-subscribe
  });

  test("initial spawn gives the 4 kit items once and sets pas:kit_v1", () => {
    freshWorld();
    const p = mock.addPlayer({ name: "K" });
    mock.tick();
    const inv = mock.inventory(p);
    const ids = [];
    for (let i = 0; i < inv.size; i++) {
      const it = inv.getItem(i);
      if (it) ids.push([it.typeId, it.amount]);
    }
    assert.deepEqual(ids, KIT_ITEMS.map((id) => [id, 1]));
    assert.equal(p.getDynamicProperty(PROPS.KIT), true);
    // respawn (initialSpawn=false) and a second initial spawn (rejoin) give nothing
    mock.respawnPlayer(p);
    mock.tick();
    mock.removePlayer(p);
    mock.tick();
    const again = mock.addPlayer({ name: "K" });
    mock.tick();
    assert.equal(again.id, p.id, "rejoin restores the same player");
    let count = 0;
    for (let i = 0; i < inv.size; i++) if (mock.inventory(again).getItem(i)) count++;
    assert.equal(count, 4);
    assert.equal(giveKit(again), false);
  });

  test("kit items exist and match SPEC §4 order", () => {
    assert.deepEqual([...KIT_ITEMS], [ITEMS.TORCH_OFF, ITEMS.BASE_SPAWNER, ITEMS.OUTBREAK, ITEMS.CONTROL]);
    for (const id of KIT_ITEMS) assert.equal(new ItemStack(id).maxAmount >= 1, true);
    assert.equal(new ItemStack(ITEMS.TORCH_OFF).maxAmount, 1);
    assert.equal(new ItemStack(ITEMS.BASE_SPAWNER).maxAmount, 16);
  });

  test("a full inventory drops the kit at the player's feet", () => {
    freshWorld();
    const p = mock.addPlayer({ name: "Full", spawn: false });
    const inv = mock.inventory(p);
    for (let i = 0; i < inv.size; i++) inv.setItem(i, new ItemStack("minecraft:dirt", 64));
    assert.equal(giveKit(p), true);
    mock.tick();
    assert.equal(world.getDimension("overworld").getEntities({ type: "minecraft:item" }).length, 4);
  });
});
