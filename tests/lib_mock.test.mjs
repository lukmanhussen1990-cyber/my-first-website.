// Self-test of the @minecraft/server mock (tests/mock): checks that it behaves
// like the game where the add-on depends on it. Vanilla-registry tests skip
// when the bedrock-samples reference (PAS_VANILLA_REF) is not available.

import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { mock, ui, buildMcstructure, hasVanillaRef, refPath } from "./mock/testkit.mjs";
import { runScenario } from "./mock/harness.mjs";
import {
  world,
  system,
  BlockPermutation,
  ItemStack,
  Direction,
  StructureRotation,
  EntityDamageCause,
  GameMode,
  Player,
} from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";

const OW = "minecraft:overworld";
const REF = hasVanillaRef();
const skipNoRef = REF ? false : `vanilla reference not found at ${refPath()} (set PAS_VANILLA_REF)`;

beforeEach(() => {
  mock.reset();
  mock.setOptions({ throwHandlerErrors: true, unloadedGetBlock: "undefined" });
});

// ---------------------------------------------------------------------------
describe("BlockPermutation.resolve against mojang-blocks.json (1.21.0.26)", () => {
  test("light_block block_light_level 15 resolves; 16 throws", { skip: skipNoRef }, () => {
    const p = BlockPermutation.resolve("minecraft:light_block", { block_light_level: 15 });
    assert.equal(p.type.id, "minecraft:light_block");
    assert.equal(p.getState("block_light_level"), 15);
    assert.throws(() => BlockPermutation.resolve("minecraft:light_block", { block_light_level: 16 }));
    assert.throws(() => BlockPermutation.resolve("minecraft:light_block", { block_light_level: "15" }), "type is checked");
    assert.throws(() => BlockPermutation.resolve("minecraft:light_block_15"), "no flattened light blocks in 1.21.0");
    assert.equal(BlockPermutation.resolve("minecraft:light_block").getState("block_light_level"), 0, "default = first value");
  });

  test("dark_oak_door states", { skip: skipNoRef }, () => {
    const d = BlockPermutation.resolve("minecraft:dark_oak_door", { direction: 3, upper_block_bit: true });
    assert.deepEqual(d.getAllStates(), { direction: 3, door_hinge_bit: false, open_bit: false, upper_block_bit: true });
    assert.ok(d.matches("minecraft:dark_oak_door", { direction: 3 }));
    assert.ok(!d.matches("minecraft:dark_oak_door", { direction: 2 }));
    assert.equal(d.withState("open_bit", true).getState("open_bit"), true);
    assert.throws(() => d.withState("direction", 4));
    assert.throws(() => d.withState("facing_direction", 2), "unknown state name");
    assert.throws(() => BlockPermutation.resolve("minecraft:dark_oak_door", { open_bit: 1 }), "bool must be boolean");
    assert.throws(() => BlockPermutation.resolve("minecraft:not_a_block"));
    assert.equal(BlockPermutation.resolve("stone").type.id, "minecraft:stone", "namespace defaults to minecraft:");
    assert.equal(
      BlockPermutation.resolve("minecraft:chest", { "minecraft:cardinal_direction": "west" }).getState("minecraft:cardinal_direction"),
      "west",
    );
  });

  test("ItemStack / spawnEntity / addEffect validate ids against the reference", { skip: skipNoRef }, () => {
    assert.throws(() => new ItemStack("minecraft:not_an_item"));
    assert.throws(() => new ItemStack("minecraft:stone", 0));
    assert.equal(new ItemStack("minecraft:stone", 99).amount, 64, "clamped to max stack");
    const dim = world.getDimension("overworld");
    assert.throws(() => dim.spawnEntity("minecraft:not_a_mob", { x: 0, y: 64, z: 0 }));
    assert.throws(() => dim.spawnEntity("pas:not_a_mob", { x: 0, y: 64, z: 0 }));
    const cow = dim.spawnEntity("minecraft:cow", { x: 0, y: 64, z: 0 });
    cow.addEffect("slowness", 40, { amplifier: 1 });
    assert.equal(cow.getEffect("minecraft:slowness")?.amplifier, 1);
    assert.throws(() => cow.addEffect("not_an_effect", 20));
    mock.tick(40);
    assert.equal(cow.getEffect("slowness"), undefined, "effects expire");
  });
});

// ---------------------------------------------------------------------------
describe("dimensions, blocks, chunks", () => {
  test("height range and out-of-world errors", () => {
    const ow = world.getDimension("overworld");
    assert.deepEqual(ow.heightRange, { min: -64, max: 320 });
    assert.deepEqual(world.getDimension("minecraft:nether").heightRange, { min: 0, max: 128 });
    assert.throws(() => ow.getBlock({ x: 0, y: 400, z: 0 }), { name: "LocationOutOfWorldBoundariesError" });
    assert.throws(() => ow.spawnEntity("minecraft:pig", { x: 0, y: -70, z: 0 }), { name: "LocationOutOfWorldBoundariesError" });
    assert.throws(() => world.getDimension("minecraft:moon"));
  });

  test("unloaded chunks: getBlock undefined (or throws when configured), spawn throws, entities invalid", () => {
    const ow = world.getDimension("overworld");
    const pig = ow.spawnEntity("minecraft:pig", { x: 40.5, y: 64, z: 40.5 });
    let removed = 0;
    let loaded = 0;
    world.afterEvents.entityRemove.subscribe(() => removed++);
    world.afterEvents.entityLoad.subscribe(() => loaded++);
    mock.unloadAt(OW, { x: 40, y: 0, z: 40 });
    mock.tick();
    assert.equal(ow.getBlock({ x: 40, y: 64, z: 40 }), undefined);
    assert.throws(() => ow.spawnEntity("minecraft:pig", { x: 41, y: 64, z: 41 }), { name: "LocationInUnloadedChunkError" });
    assert.equal(pig.isValid(), false);
    assert.equal(world.getEntity(pig.id), undefined);
    assert.equal(ow.getEntities({ type: "minecraft:pig" }).length, 0);
    assert.equal(removed, 1, "unload is reported through entityRemove");
    mock.loadAt(OW, { x: 40, y: 0, z: 40 });
    mock.tick();
    assert.equal(loaded, 1, "reload fires entityLoad");
    assert.equal(pig.isValid(), true);
    mock.setLoadedPredicate(OW, (cx, cz) => Math.abs(cx) < 2 && Math.abs(cz) < 2);
    assert.ok(ow.getBlock({ x: 31, y: 0, z: 31 }));
    assert.equal(ow.getBlock({ x: 32, y: 0, z: 0 }), undefined);
  });

  test("Block API: setPermutation/setType, neighbours, container blocks", () => {
    const ow = world.getDimension("overworld");
    const b = ow.getBlock({ x: 1, y: 70, z: 1 });
    assert.ok(b.isAir);
    b.setType("minecraft:chest");
    assert.equal(b.typeId, "minecraft:chest");
    const inv = b.getComponent("minecraft:inventory");
    assert.equal(inv.container.size, 27);
    inv.container.setItem(0, new ItemStack("minecraft:bread", 5));
    assert.equal(mock.containerAt(OW, { x: 1, y: 70, z: 1 }).getItem(0).amount, 5);
    assert.equal(b.above().location.y, 71);
    assert.equal(b.north().location.z, 0);
    assert.equal(b.east(2).location.x, 3);
    assert.equal(b.offset({ x: -1, y: -1, z: 0 }).location.x, 0);
    b.setPermutation(BlockPermutation.resolve("minecraft:water"));
    assert.ok(b.isLiquid);
    assert.equal(b.getComponent("inventory"), undefined, "container removed with the block");
    assert.deepEqual(b.center(), { x: 1.5, y: 70.5, z: 1.5 });
  });

  test("read-only mode: world changes inside a before-event throw (like the game)", () => {
    const p = mock.addPlayer({ name: "RO" });
    mock.tick();
    mock.setMainhand(p, "minecraft:stick");
    let error;
    let readWorked = false;
    const cb = world.beforeEvents.itemUse.subscribe((ev) => {
      readWorked = ev.source.dimension.getBlock({ x: 0, y: 64, z: 0 }) !== undefined;
      try {
        ev.source.dimension.getBlock({ x: 0, y: 64, z: 0 }).setType("minecraft:stone");
      } catch (e) {
        error = e;
      }
      world.setDynamicProperty("pas:ok_in_before", true); // allowed (read_only privilege)
      system.run(() => ev.source.dimension.getBlock({ x: 0, y: 64, z: 0 }).setType("minecraft:stone"));
    });
    mock.useItem(p);
    world.beforeEvents.itemUse.unsubscribe(cb);
    assert.ok(readWorked);
    assert.match(String(error), /does not have required privileges/);
    assert.equal(mock.blockName(OW, { x: 0, y: 64, z: 0 }), "minecraft:air");
    mock.tick();
    assert.equal(mock.blockName(OW, { x: 0, y: 64, z: 0 }), "minecraft:stone", "deferred write works");
  });

  test("dynamic properties: types, limits, world/entity", () => {
    world.setDynamicProperty("a", 1.5);
    world.setDynamicProperty("b", true);
    world.setDynamicProperty("c", { x: 1, y: 2, z: 3 });
    assert.deepEqual(world.getDynamicProperty("c"), { x: 1, y: 2, z: 3 });
    assert.throws(() => world.setDynamicProperty("d", { a: 1 }));
    assert.throws(() => world.setDynamicProperty("e", "é".repeat(20000)), "UTF-8 bytes > 32767");
    world.setDynamicProperty("a", undefined);
    assert.equal(world.getDynamicProperty("a"), undefined);
    const pig = world.getDimension("overworld").spawnEntity("minecraft:pig", { x: 0, y: 64, z: 0 });
    pig.setDynamicProperty("pas:inc_ticks", 400);
    assert.equal(pig.getDynamicProperty("pas:inc_ticks"), 400);
    assert.deepEqual(pig.getDynamicPropertyIds(), ["pas:inc_ticks"]);
  });
});

// ---------------------------------------------------------------------------
describe("getBlockFromRay (DDA)", () => {
  test("hits, faces, faceLocation, passable/liquid flags, maxDistance", () => {
    const ow = world.getDimension("overworld");
    mock.fill(OW, { x: -2, y: 60, z: -2 }, { x: 12, y: 63, z: 2 }, "minecraft:stone");
    mock.setBlock(OW, { x: 10, y: 64, z: 0 }, "minecraft:stone");
    mock.setBlock(OW, { x: 5, y: 64, z: 0 }, "minecraft:short_grass");
    mock.setBlock(OW, { x: 3, y: 64, z: 0 }, "minecraft:light_block", { block_light_level: 15 });
    mock.setBlock(OW, { x: 7, y: 64, z: 0 }, "minecraft:water");
    const o = { x: 0.5, y: 64.5, z: 0.5 };
    const east = { x: 1, y: 0, z: 0 };
    let h = ow.getBlockFromRay(o, east, { maxDistance: 24 });
    assert.equal(h.block.typeId, "minecraft:stone", "light block, grass and water are skipped by default");
    assert.deepEqual(h.block.location, { x: 10, y: 64, z: 0 });
    assert.equal(h.face, Direction.West);
    assert.deepEqual(h.faceLocation, { x: 0, y: 0.5, z: 0.5 });
    h = ow.getBlockFromRay(o, east, { includePassableBlocks: true });
    assert.equal(h.block.typeId, "minecraft:light_block");
    h = ow.getBlockFromRay(o, east, { includeLiquidBlocks: true });
    assert.equal(h.block.typeId, "minecraft:water");
    assert.equal(ow.getBlockFromRay(o, east, { maxDistance: 9 }), undefined, "stone face is 9.5 away");
    assert.ok(ow.getBlockFromRay(o, east, { maxDistance: 9.5 }));
    // straight down onto the floor
    h = ow.getBlockFromRay({ x: 0.5, y: 70, z: 0.5 }, { x: 0, y: -2, z: 0 });
    assert.deepEqual(h.block.location, { x: 0, y: 63, z: 0 });
    assert.equal(h.face, Direction.Up);
    assert.deepEqual(h.faceLocation, { x: 0.5, y: 1, z: 0.5 });
    // diagonal ray, negative axes
    mock.setBlock(OW, { x: -1, y: 66, z: -4 }, "minecraft:stone");
    h = ow.getBlockFromRay({ x: 2.5, y: 66.5, z: -0.5 }, { x: -1, y: 0, z: -1 });
    assert.deepEqual(h.block.location, { x: -1, y: 66, z: -4 });
    assert.ok([Direction.East, Direction.South].includes(h.face));
    // nothing within range / leaving the world
    assert.equal(ow.getBlockFromRay({ x: 0.5, y: 100, z: 0.5 }, { x: 0, y: 1, z: 0 }), undefined);
    // includeTypes / excludeTypes filters
    h = ow.getBlockFromRay(o, east, { excludeTypes: ["minecraft:stone"], includeLiquidBlocks: true });
    assert.equal(h.block.typeId, "minecraft:water");
  });

  test("an unloaded chunk stops the ray", () => {
    const ow = world.getDimension("overworld");
    mock.setBlock(OW, { x: 40, y: 64, z: 0 }, "minecraft:stone");
    assert.ok(ow.getBlockFromRay({ x: 0.5, y: 64.5, z: 0.5 }, { x: 1, y: 0, z: 0 }));
    mock.unloadChunk(OW, 2, 0);
    assert.equal(ow.getBlockFromRay({ x: 0.5, y: 64.5, z: 0.5 }, { x: 1, y: 0, z: 0 }), undefined);
  });

  test("player view direction follows rotation (yaw 0 = +z, pitch 90 = down) unless overridden", () => {
    const p = mock.addPlayer({ name: "Eye", location: { x: 0.5, y: 64, z: 0.5 } });
    mock.tick();
    const close = (a, b) => ["x", "y", "z"].every((k) => Math.abs(a[k] - b[k]) < 1e-9);
    p.setRotation({ x: 0, y: 0 });
    assert.ok(close(p.getViewDirection(), { x: 0, y: 0, z: 1 }));
    p.setRotation({ x: 0, y: 90 });
    assert.ok(close(p.getViewDirection(), { x: -1, y: 0, z: 0 }));
    p.setRotation({ x: 90, y: 0 });
    assert.ok(close(p.getViewDirection(), { x: 0, y: -1, z: 0 }));
    assert.deepEqual(p.getHeadLocation(), { x: 0.5, y: 65.62, z: 0.5 });
    mock.setView(p, { viewDirection: { x: 1, y: 0, z: 0 }, headLocation: { x: 0, y: 70, z: 0 } });
    assert.deepEqual(p.getViewDirection(), { x: 1, y: 0, z: 0 });
    assert.deepEqual(p.getHeadLocation(), { x: 0, y: 70, z: 0 });
  });
});

// ---------------------------------------------------------------------------
describe("entities", () => {
  test("vanilla families come from the reference entity files", { skip: skipNoRef }, () => {
    const ow = world.getDimension("overworld");
    const expect = {
      "minecraft:villager_v2": ["villager", "mob"],
      "minecraft:wandering_trader": ["wandering_trader", "mob"],
      "minecraft:mooshroom": ["mushroomcow", "mob"],
      "minecraft:zombie": ["zombie", "undead", "monster", "mob"],
      "minecraft:iron_golem": ["irongolem", "mob"],
    };
    for (const [type, fam] of Object.entries(expect)) {
      const e = ow.spawnEntity(type, { x: 0, y: 64, z: 0 });
      assert.deepEqual(e.getComponent("minecraft:type_family").getTypeFamilies(), fam, type);
    }
    const p = mock.addPlayer({ name: "Fam" });
    assert.deepEqual(p.getComponent("type_family").getTypeFamilies(), ["player"]);
    assert.ok(p instanceof Player);
  });

  test("pas:* horde entities: families, groups, events, dormant/active, triggerEvent validation", () => {
    const ow = world.getDimension("overworld");
    for (const type of ["pas:parasite", "pas:infected_villager", "pas:infected_cow", "pas:infected_pig", "pas:infected_sheep", "pas:infected_chicken", "pas:infected_human"]) {
      const e = ow.spawnEntity(type, { x: 0, y: 64, z: 0 });
      const fam = e.getComponent("minecraft:type_family").getTypeFamilies();
      for (const f of ["pas_horde", "monster", "mob"]) assert.ok(fam.includes(f), `${type} lacks ${f}`);
      for (const f of ["villager", "cow", "pig", "sheep", "chicken", "player"]) assert.ok(!fam.includes(f), `${type} must not have ${f}`);
      assert.ok(mock.groups(e).includes("pas:hunting"), `${type}: entity_spawned adds pas:hunting`);
      e.triggerEvent("pas:become_dormant");
      assert.ok(mock.groups(e).includes("pas:dormant") && !mock.groups(e).includes("pas:hunting"), type);
      e.triggerEvent("pas:become_active");
      assert.ok(mock.groups(e).includes("pas:hunting") && !mock.groups(e).includes("pas:dormant"), type);
      assert.throws(() => e.triggerEvent("pas:definitely_not_an_event"));
    }
    assert.ok(mock.triggered().includes("pas:become_dormant"));
  });

  test("damage, hurt/die events, horde friendly fire cancelled, death removal", () => {
    const ow = world.getDimension("overworld");
    const parasite = ow.spawnEntity("pas:parasite", { x: 0, y: 64, z: 0 });
    const other = ow.spawnEntity("pas:infected_pig", { x: 1, y: 64, z: 0 });
    const pig = ow.spawnEntity("minecraft:pig", { x: 2, y: 64, z: 0 });
    const hurts = [];
    const deaths = [];
    world.afterEvents.entityHurt.subscribe((ev) => hurts.push([ev.hurtEntity.typeId, ev.damage, ev.damageSource.cause, ev.damageSource.damagingEntity?.typeId]));
    world.afterEvents.entityDie.subscribe((ev) => deaths.push(ev.deadEntity.typeId));
    assert.equal(other.applyDamage(4, { cause: EntityDamageCause.entityAttack, damagingEntity: parasite }), false, "no friendly fire (damage_sensor)");
    const maxHp = pig.getComponent("health").effectiveMax; // 10 with the vanilla pig definition
    assert.equal(pig.applyDamage(4, { cause: EntityDamageCause.entityAttack, damagingEntity: parasite }), true);
    assert.equal(pig.getComponent("health").currentValue, maxHp - 4);
    mock.tick();
    assert.deepEqual(hurts, [["minecraft:pig", 4, "entityAttack", "pas:parasite"]]);
    pig.applyDamage(100, { cause: EntityDamageCause.entityAttack, damagingEntity: parasite });
    mock.flush();
    assert.deepEqual(deaths, ["minecraft:pig"]);
    assert.ok(pig.isValid(), "dying mob stays valid for the death animation");
    mock.tick(mock.options.deathRemovalTicks);
    assert.equal(pig.isValid(), false);
    // kill() fires entityDie; remove() does not
    const cow = ow.spawnEntity("minecraft:cow", { x: 3, y: 64, z: 0 });
    assert.equal(cow.kill(), true);
    const sheep = ow.spawnEntity("minecraft:sheep", { x: 4, y: 64, z: 0 });
    sheep.remove();
    assert.equal(sheep.isValid(), false);
    assert.throws(() => sheep.location);
    mock.flush();
    assert.deepEqual(deaths, ["minecraft:pig", "minecraft:cow"]);
    // creative players are not damaged
    const p = mock.addPlayer({ name: "Cr", gameMode: GameMode.creative });
    assert.equal(p.applyDamage(5), false);
  });

  test("getEntities query options", () => {
    const ow = world.getDimension("overworld");
    const a = ow.spawnEntity("pas:parasite", { x: 0, y: 64, z: 0 });
    const b = ow.spawnEntity("pas:parasite", { x: 10, y: 64, z: 0 });
    const c = ow.spawnEntity("minecraft:villager_v2", { x: 5, y: 64, z: 0 });
    c.addTag("pas_incubating");
    world.getDimension("nether").spawnEntity("pas:parasite", { x: 0, y: 64, z: 0 });
    assert.equal(ow.getEntities({ families: ["pas_horde"] }).length, 2);
    assert.equal(ow.getEntities({ type: "pas:parasite", location: { x: 0, y: 64, z: 0 }, maxDistance: 5 }).length, 1);
    assert.deepEqual(ow.getEntities({ location: { x: 9, y: 64, z: 0 }, closest: 1 }).map((e) => e.id), [b.id]);
    assert.deepEqual(ow.getEntities({ tags: ["pas_incubating"] }).map((e) => e.id), [c.id]);
    assert.equal(ow.getEntities({ excludeTags: ["pas_incubating"], excludeFamilies: ["pas_horde"] }).length, 0);
    assert.equal(ow.getEntities({ excludeTypes: ["pas:parasite"] }).length, 1);
    assert.ok(a.matches({ families: ["pas_parasite"] }));
    assert.ok(!a.matches({ families: ["pas_parasite"], tags: ["x"] }));
    assert.throws(() => ow.getEntities({ maxDistance: 3 }), "distance needs a location");
  });

  test("spawn with <event> runs that event instead of minecraft:entity_spawned", () => {
    const ow = world.getDimension("overworld");
    const e = ow.spawnEntity("pas:infected_cow<pas:become_dormant>", { x: 0, y: 64, z: 0 });
    assert.deepEqual(mock.groups(e).filter((g) => g === "pas:hunting" || g === "pas:dormant"), ["pas:dormant"]);
  });

  test("components set by tests: variant, color, is_baby, is_sheared, inventory/equippable", () => {
    const ow = world.getDimension("overworld");
    const v = ow.spawnEntity("minecraft:villager_v2", { x: 0, y: 64, z: 0 });
    assert.equal(v.getComponent("minecraft:variant"), undefined);
    mock.setComponent(v, "minecraft:variant", 3);
    mock.setComponent(v, "minecraft:is_baby", true);
    assert.equal(v.getComponent("minecraft:variant").value, 3);
    assert.ok(v.getComponent("minecraft:is_baby"));
    const s = ow.spawnEntity("minecraft:sheep", { x: 0, y: 64, z: 0 });
    mock.setComponent(s, "minecraft:color", 14);
    assert.equal(s.getComponent("color").value, 14);
    assert.equal(s.getComponent("minecraft:is_sheared"), undefined);
    const p = mock.addPlayer({ name: "Inv" });
    assert.equal(p.getComponent("inventory").container.size, 36);
    const eq = p.getComponent("equippable");
    eq.setEquipment("Mainhand", new ItemStack("minecraft:apple", 3));
    assert.equal(p.getComponent("inventory").container.getItem(p.selectedSlotIndex).amount, 3);
    p.selectedSlotIndex = 1;
    assert.equal(eq.getEquipment("Mainhand"), undefined);
    eq.setEquipment("Offhand", new ItemStack("minecraft:shield"));
    assert.equal(eq.getEquipment("Offhand").typeId, "minecraft:shield");
  });

  test("players: join/spawn/leave events, game mode, screen display", () => {
    const log = [];
    world.afterEvents.playerJoin.subscribe((ev) => log.push(`join:${ev.playerName}`));
    world.afterEvents.playerSpawn.subscribe((ev) => log.push(`spawn:${ev.player.name}:${ev.initialSpawn}`));
    world.beforeEvents.playerLeave.subscribe((ev) => log.push(`beforeLeave:${ev.player.name}`));
    world.afterEvents.playerLeave.subscribe((ev) => log.push(`leave:${ev.playerName}`));
    world.afterEvents.playerDimensionChange.subscribe((ev) => log.push(`dim:${ev.fromDimension.id}->${ev.toDimension.id}`));
    const p = mock.addPlayer({ name: "Ann" });
    assert.deepEqual(log, [], "queued until the next tick");
    mock.tick();
    p.teleport({ x: 0, y: 64, z: 0 }, { dimension: world.getDimension("nether") });
    mock.tick();
    mock.removePlayer(p);
    mock.tick();
    assert.deepEqual(log, ["join:Ann", "spawn:Ann:true", "dim:minecraft:overworld->minecraft:nether", "beforeLeave:Ann", "leave:Ann"]);
    assert.equal(world.getAllPlayers().length, 0);
  });
});

// ---------------------------------------------------------------------------
describe("structures", () => {
  function marker(size) {
    // a structure with a gold block at the local +x end (east) and a chest facing south
    const s = world.structureManager.createEmpty(`test:m${Math.random().toString(36).slice(2)}`, size);
    s.setBlockPermutation({ x: size.x - 1, y: 0, z: 0 }, BlockPermutation.resolve("minecraft:gold_block"));
    s.setBlockPermutation({ x: 0, y: 0, z: 0 }, BlockPermutation.resolve("minecraft:chest", { "minecraft:cardinal_direction": "south" }));
    return s;
  }

  test("place() rotations are clockwise viewed from above (Rotate90 maps east -> south)", () => {
    const ow = world.getDimension("overworld");
    const expected = {
      [StructureRotation.None]: { gold: { x: 2, z: 0 }, chestFacing: "south" },
      [StructureRotation.Rotate90]: { gold: { x: 0, z: 2 }, chestFacing: "west" },
      [StructureRotation.Rotate180]: { gold: { x: 0, z: 0 }, chestFacing: "north" },
      [StructureRotation.Rotate270]: { gold: { x: 0, z: 0 }, chestFacing: "east" },
    };
    for (const [rotation, exp] of Object.entries(expected)) {
      mock.reset();
      const s = marker({ x: 3, y: 1, z: 1 });
      world.structureManager.place(s, ow, { x: 0, y: 64, z: 0 }, { rotation });
      const gold = mock.listBlocks(OW, "minecraft:gold_block");
      assert.deepEqual(gold.map((b) => ({ x: b.x, z: b.z })), [exp.gold], rotation);
      const chest = mock.listBlocks(OW, "minecraft:chest");
      assert.equal(chest[0].states["minecraft:cardinal_direction"], exp.chestFacing, rotation);
    }
    // Rotate270: east end goes north; with a 3x1x1 box at the origin both ends sit at z=0/x=0..; check box extents
    mock.reset();
    const s = marker({ x: 3, y: 1, z: 1 });
    world.structureManager.place(s, ow, { x: 0, y: 64, z: 0 }, { rotation: StructureRotation.Rotate270 });
    const all = mock.listBlocks(OW).map((b) => `${b.name}@${b.x},${b.z}`).sort();
    assert.deepEqual(all, ["minecraft:chest@0,2", "minecraft:gold_block@0,0"]);
  });

  test("place() errors: unknown structure, out of world, unloaded, bad integrity; read-only", () => {
    const ow = world.getDimension("overworld");
    const s = marker({ x: 2, y: 2, z: 2 });
    assert.throws(() => world.structureManager.place("test:nope", ow, { x: 0, y: 0, z: 0 }), { name: "InvalidStructureError" });
    assert.throws(() => world.structureManager.place(s, ow, { x: 0, y: 319, z: 0 }), { name: "LocationOutOfWorldBoundariesError" });
    mock.unloadChunk(OW, 0, 0);
    assert.throws(() => world.structureManager.place(s, ow, { x: 0, y: 64, z: 0 }), { name: "LocationInUnloadedChunkError" });
    mock.loadChunk(OW, 0, 0);
    assert.throws(() => world.structureManager.place(s, ow, { x: 0, y: 64, z: 0 }, { integrity: 2 }));
    assert.throws(() => world.structureManager.createEmpty("nonamespace", { x: 1, y: 1, z: 1 }));
    assert.throws(() => s.setBlockPermutation({ x: 5, y: 0, z: 0 }, BlockPermutation.resolve("minecraft:stone")));
    assert.throws(() => s.setBlockPermutation({ x: 0, y: 0, z: 0 }, BlockPermutation.resolve("minecraft:structure_void")));
  });

  test("runCommand('structure load ...') fallback places like structureManager.place (both overloads)", () => {
    const ow = world.getDimension("overworld");
    const s = world.structureManager.createEmpty("test:cmd", { x: 3, y: 1, z: 1 });
    s.setBlockPermutation({ x: 2, y: 0, z: 0 }, BlockPermutation.resolve("minecraft:gold_block"));
    const r = ow.runCommand("structure load test:cmd 10 64 10 90_degrees none layer_by_layer 1 false true");
    assert.equal(r.successCount, 1);
    mock.tick(25);
    assert.deepEqual(mock.listBlocks(OW, "minecraft:gold_block").map((b) => [b.x, b.y, b.z]), [[10, 64, 12]]);
    ow.runCommand("structure load test:cmd 20 64 20 180_degrees none false true");
    assert.deepEqual(mock.listBlocks(OW, "minecraft:gold_block").map((b) => [b.x, b.z]).sort(), [[10, 12], [20, 20]]);
    assert.throws(() => ow.runCommand("structure load test:cmd 1 2 3 45_degrees"), { name: "CommandError" });
    assert.equal(mock.records.commands.length, 3);
    mock.setCommandHandler((cmd) => (cmd.startsWith("say") ? { successCount: 1 } : undefined));
    assert.equal(ow.runCommand("say hi").successCount, 1);
    mock.setCommandHandler(undefined);
  });

  test("animated placement (Layers) builds bottom-up over animationSeconds", () => {
    const ow = world.getDimension("overworld");
    const s = world.structureManager.createEmpty("test:tower", { x: 1, y: 4, z: 1 });
    for (let y = 0; y < 4; y++) s.setBlockPermutation({ x: 0, y, z: 0 }, BlockPermutation.resolve("minecraft:stone"));
    world.structureManager.place(s, ow, { x: 0, y: 64, z: 0 }, { animationMode: "Layers", animationSeconds: 2 });
    assert.equal(mock.countBlocks(OW, "minecraft:stone"), 0);
    mock.tick(1);
    assert.equal(mock.countBlocks(OW, "minecraft:stone"), 1);
    mock.tick(40);
    assert.equal(mock.countBlocks(OW, "minecraft:stone"), 4);
    assert.equal(mock.structureAnimationsPending(), 0);
  });

  test(".mcstructure round trip through the NBT writer/parser (+ -1 indices, structure_void, chest NBT)", { skip: skipNoRef }, () => {
    const buf = buildMcstructure({
      size: { x: 2, y: 1, z: 2 },
      palette: [
        { name: "minecraft:stone" },
        { name: "minecraft:structure_void", states: { structure_void_type: "void" } },
        { name: "minecraft:dark_oak_door", states: { direction: 1, door_hinge_bit: false, open_bit: false, upper_block_bit: false } },
        { name: "minecraft:chest", states: { "minecraft:cardinal_direction": "north" } },
      ],
      // index = (x * sizeY + y) * sizeZ + z
      indices: [0, -1, 2, 3],
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pas-mcs-"));
    const file = path.join(dir, "t.mcstructure");
    fs.writeFileSync(file, buf);
    mock.loadStructureFile("test:file", file);
    const ow = world.getDimension("overworld");
    mock.setBlock(OW, { x: 0, y: 64, z: 1 }, "minecraft:dirt");
    world.structureManager.place("test:file", ow, { x: 0, y: 64, z: 0 });
    assert.equal(mock.blockName(OW, { x: 0, y: 64, z: 0 }), "minecraft:stone");
    assert.equal(mock.blockName(OW, { x: 0, y: 64, z: 1 }), "minecraft:dirt", "-1 keeps the world block");
    assert.equal(mock.blockPerm(OW, { x: 1, y: 64, z: 0 }).getState("direction"), 1);
    assert.equal(mock.blockPerm(OW, { x: 1, y: 64, z: 0 }).getState("door_hinge_bit"), false, "byte -> boolean");
    assert.equal(mock.blockName(OW, { x: 1, y: 64, z: 1 }), "minecraft:chest");
    // invalid state in a file is reported like a broken structure
    const bad = buildMcstructure({ size: { x: 1, y: 1, z: 1 }, palette: [{ name: "minecraft:light_block", states: { block_light_level: 16 } }], indices: [0] });
    assert.throws(() => mock.parseStructure(bad), /block_light_level/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("the add-on's luxury_base.mcstructure parses against the 1.21.0 block registry (if present)", { skip: skipNoRef }, (t) => {
    const s = world.structureManager.get("pas:luxury_base");
    if (!s) return t.skip("addon/behavior_pack/structures/pas/luxury_base.mcstructure not present yet");
    assert.ok(s.size.x > 0 && s.size.y > 0 && s.size.z > 0);
  });
});

// ---------------------------------------------------------------------------
describe("server-ui mock", () => {
  test("ActionFormData / ModalFormData / MessageFormData with queued responses", async () => {
    const p = mock.addPlayer({ name: "UI" });
    mock.tick();
    ui.reset();
    ui.respond({ selection: 1 }, p);
    const r1 = await new ActionFormData().title("Outbreak").body("status").button("Pause").button("Settings").show(p);
    assert.equal(r1.canceled, false);
    assert.equal(r1.selection, 1);
    assert.deepEqual(ui.last().buttons.map((b) => b.text), ["Pause", "Settings"]);
    ui.respond({ values: { "Population cap": 100 } });
    const r2 = await new ModalFormData().title("Settings").slider("Population cap", 4, 200, 1, 64).toggle("Infect players", true).show(p);
    assert.deepEqual(r2.formValues, [100, true]);
    const r3 = await new MessageFormData().body("Sure?").button1("Yes").button2("No").show(p);
    assert.equal(r3.canceled, true, "no queued response = closed");
    ui.pressButton(/Settings/);
    const r4 = await new ActionFormData().button("Pause").button("Settings").show(p);
    assert.equal(r4.selection, 1);
    ui.respond({ values: { "Population cap": 500 } });
    await assert.rejects(new ModalFormData().slider("Population cap", 4, 200, 1).show(p), /invalid/);
  });
});

// ---------------------------------------------------------------------------
describe("save / reload", () => {
  test("in-process saveWorld/loadWorld round trip", () => {
    const ow = world.getDimension("overworld");
    mock.setBlock(OW, { x: 1, y: 64, z: 1 }, "minecraft:light_block", { block_light_level: 13 });
    mock.setBlock(OW, { x: 2, y: 64, z: 2 }, "minecraft:barrel");
    mock.containerAt(OW, { x: 2, y: 64, z: 2 }).setItem(3, new ItemStack("minecraft:bread", 7));
    world.setDynamicProperty("pas:outbreak", '{"v":1}');
    const e = ow.spawnEntity("pas:infected_sheep", { x: 3, y: 64, z: 3 });
    e.triggerEvent("pas:become_dormant");
    e.addTag("pas_dormant");
    e.setDynamicProperty("pas:epoch", 2);
    e.nameTag = "Dolly";
    const p = mock.addPlayer({ name: "Saver" });
    mock.tick();
    p.addTag("pas_incubating");
    p.setDynamicProperty("pas:stage", 1);
    mock.setMainhand(p, "pas:tactical_torchlight_on");
    const snap = mock.saveWorld();
    const json = JSON.stringify(snap);

    mock.reset();
    assert.equal(world.getEntity(e.id), undefined);
    mock.loadWorld(JSON.parse(json));
    mock.startup();
    mock.tick();
    const e2 = world.getEntity(e.id);
    assert.ok(e2, "entity restored with the same id");
    assert.deepEqual(mock.groups(e2).includes("pas:dormant"), true);
    assert.ok(e2.hasTag("pas_dormant"));
    assert.equal(e2.getDynamicProperty("pas:epoch"), 2);
    assert.equal(e2.nameTag, "Dolly");
    assert.equal(world.getDynamicProperty("pas:outbreak"), '{"v":1}');
    assert.equal(mock.blockPerm(OW, { x: 1, y: 64, z: 1 }).getState("block_light_level"), 13);
    assert.equal(mock.containerAt(OW, { x: 2, y: 64, z: 2 }).getItem(3).amount, 7);
    const p2 = world.getAllPlayers()[0];
    assert.equal(p2.name, "Saver");
    assert.ok(p2.hasTag("pas_incubating"));
    assert.equal(p2.getComponent("equippable").getEquipment("Mainhand").typeId, "pas:tactical_torchlight_on");
  });

  test("two processes: the add-on runs, saves, and a fresh process reloads the world", async () => {
    const a = await runScenario({
      source: `
        const { scenario } = await import(process.env.PAS_HARNESS);
        const sc = await scenario.begin();
        const { mock } = sc;
        const { world } = sc.server;
        const store = await import(${JSON.stringify(new URL("../addon/behavior_pack/scripts/lib/store.js", import.meta.url).href)});
        const p = mock.addPlayer({ name: "Reloader" });
        mock.tick(2);
        const big = Array.from({ length: 5000 }, (_, i) => ["minecraft:overworld", i, 64, i]);
        store.saveJSON("pas:torch_cells", big);
        const inv = mock.inventory(p);
        const kit = [];
        for (let i = 0; i < inv.size; i++) if (inv.getItem(i)) kit.push(inv.getItem(i).typeId);
        sc.end({ kit, kitProp: p.getDynamicProperty("pas:kit_v1"), tick: mock.currentTick });
      `,
    });
    assert.equal(a.result.kit.length, 4, "kit given on first join");
    assert.equal(a.result.kitProp, true);
    const b = await runScenario({
      load: a.world,
      source: `
        const { scenario } = await import(process.env.PAS_HARNESS);
        const sc = await scenario.begin();
        const { mock } = sc;
        const store = await import(${JSON.stringify(new URL("../addon/behavior_pack/scripts/lib/store.js", import.meta.url).href)});
        mock.tick(2);
        const p = sc.server.world.getAllPlayers()[0];
        const inv = mock.inventory(p);
        let count = 0;
        for (let i = 0; i < inv.size; i++) if (inv.getItem(i)) count++;
        sc.end({ loaded: sc.loaded, name: p.name, count, cells: store.loadJSON("pas:torch_cells", []).length, tick: mock.currentTick });
      `,
    });
    assert.equal(b.result.loaded, true);
    assert.equal(b.result.name, "Reloader");
    assert.equal(b.result.count, 4, "kit not given twice after reload");
    assert.equal(b.result.cells, 5000, "chunked store survives reload");
    assert.ok(b.result.tick > a.result.tick, "clock continues");
  });
});
