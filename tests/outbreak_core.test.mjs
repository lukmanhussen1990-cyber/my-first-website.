// Outbreak: start, replication, population cap, robustness (SPEC §7).
// Tests 1, 2, 3 and 12 of the outbreak workstream.

import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { GameMode, LocationInUnloadedChunkError } from "@minecraft/server";
import {
  mock,
  api,
  world,
  ENTITIES,
  PROPS,
  TAGS,
  ITEMS,
  OW,
  fresh,
  dim,
  count,
  parasites,
  hit,
  release,
  newOutbreakErrors,
  errorsLogged,
  maxPerTick,
  perTick,
  storedState,
} from "./outbreak_helpers.mjs";

/** Tick until the countdown reaches the generation boundary minus `before` ticks. */
function tickToGeneration(before = 0) {
  const t = api.getState().ticksToNext;
  mock.tick(t - before);
}

// ---------------------------------------------------------------------------
describe("1. start via the pas:parasite_outbreak item", () => {
  beforeEach(() => fresh());

  test("use on a block: exactly 1 parasite on top, active, generation 0, item consumed in survival", () => {
    const p = mock.addPlayer({ name: "Steve", location: { x: 0.5, y: 64, z: 0.5 } });
    mock.tick();
    mock.setMainhand(p, ITEMS.OUTBREAK, 2);
    mock.clearRecords();
    assert.equal(api.getState().active, false);
    mock.useItemOn(p, { x: 3, y: 63, z: 3 }, "Up", { withItemUse: true });
    mock.tick(); // dispatch runs on the next tick
    const list = dim().getEntities({ type: ENTITIES.PARASITE });
    assert.equal(list.length, 1);
    assert.deepEqual(list[0].location, { x: 3.5, y: 64, z: 3.5 });
    assert.equal(list[0].getDynamicProperty(PROPS.EPOCH), 0);
    assert.ok(mock.groups(list[0]).includes("pas:hunting"), "plain spawn ran minecraft:entity_spawned");
    const st = api.getState();
    assert.equal(st.active, true);
    assert.equal(st.paused, false);
    assert.equal(st.generation, 0);
    assert.equal(st.ticksToNext, 600);
    assert.equal(storedState().active, true, "state persisted");
    assert.ok(mock.records.titles.some((t) => t.playerId === p.id && String(t.title).includes("☣ PARASITE OUTBREAK ☣")));
    assert.ok(mock.records.sounds.some((s) => s.id === "pas.outbreak.start"));
    assert.ok(mock.records.particles.some((r) => r.id === "pas:birth_splatter"));
    assert.equal(mock.inventory(p).getItem(0)?.amount, 1, "one item consumed");
    assert.deepEqual(newOutbreakErrors(), []);
  });

  test("a second use adds another parasite; creative does not consume", () => {
    const p = mock.addPlayer({ name: "Cre", location: { x: 0.5, y: 64, z: 0.5 }, gameMode: GameMode.creative });
    mock.tick();
    mock.setMainhand(p, ITEMS.OUTBREAK, 1);
    mock.useItemOn(p, { x: 3, y: 63, z: 3 });
    mock.tick(10);
    mock.useItemOn(p, { x: -3, y: 63, z: -3 });
    mock.tick();
    assert.equal(parasites(), 2);
    assert.equal(api.getState().generation, 0);
    assert.equal(mock.inventory(p).getItem(0)?.amount, 1, "creative: not consumed");
  });

  test("use in the air: raycast to the ground (<= 10 blocks), else ask to aim at the ground", () => {
    const p = mock.addPlayer({ name: "Air", location: { x: 0.5, y: 64, z: 0.5 } });
    mock.tick();
    mock.setMainhand(p, ITEMS.OUTBREAK, 3);
    // looking straight up: nothing within 10 blocks
    mock.setView(p, { rotation: { x: -90, y: 0 } });
    mock.useItem(p);
    mock.tick();
    assert.equal(parasites(), 0);
    assert.ok(mock.messagesTo(p).some((m) => m.includes("Aim at the ground")));
    assert.equal(mock.inventory(p).getItem(0)?.amount, 3);
    // looking down at 45 degrees towards +z: the ray hits the grass at (0,63,1) -> parasite on top
    mock.setView(p, { rotation: { x: 45, y: 0 } });
    mock.tick(10);
    mock.useItem(p);
    mock.tick();
    const list = dim().getEntities({ type: ENTITIES.PARASITE });
    assert.equal(list.length, 1);
    assert.equal(list[0].location.y, 64);
    assert.equal(mock.inventory(p).getItem(0)?.amount, 2);
  });

  test("cap check: no parasite and no consumption at the cap", () => {
    api.setConfig({ populationCap: 4 });
    for (let i = 0; i < 4; i++) release({ x: i * 2 + 0.5, y: 64, z: 10.5 });
    assert.equal(api.hordeCount(), 4);
    const p = mock.addPlayer({ name: "Cap", location: { x: 0.5, y: 64, z: 0.5 } });
    mock.tick();
    mock.setMainhand(p, ITEMS.OUTBREAK, 1);
    mock.useItemOn(p, { x: 3, y: 63, z: 3 });
    mock.tick();
    assert.equal(parasites(), 4);
    assert.equal(mock.inventory(p).getItem(0)?.amount, 1);
    assert.ok(mock.messagesTo(p).some((m) => m.includes("population cap")));
  });

  test("a clicked plant on the ground: released inside its cell", () => {
    const p = mock.addPlayer({ name: "Plant", location: { x: 0.5, y: 64, z: 0.5 } });
    mock.tick();
    mock.setMainhand(p, ITEMS.OUTBREAK, 1);
    mock.setBlock(OW, { x: 7, y: 64, z: 7 }, "minecraft:short_grass");
    mock.useItemOn(p, { x: 7, y: 64, z: 7 }, "Up");
    mock.tick();
    const list = dim().getEntities({ type: ENTITIES.PARASITE });
    assert.equal(list.length, 1);
    assert.deepEqual(list[0].location, { x: 7.5, y: 64, z: 7.5 });
  });

  test("blocked top: released in front of the clicked face; fully blocked: message, nothing consumed", () => {
    const p = mock.addPlayer({ name: "Wall", location: { x: 0.5, y: 64, z: 0.5 } });
    mock.tick();
    mock.setMainhand(p, ITEMS.OUTBREAK, 2);
    mock.setBlock(OW, { x: 5, y: 64, z: 5 }, "minecraft:stone");
    mock.setBlock(OW, { x: 5, y: 65, z: 5 }, "minecraft:stone");
    // click the north face of the lower wall block: the top (5,65,5) is stone -> (5,64,4)
    mock.useItemOn(p, { x: 5, y: 64, z: 5 }, "North");
    mock.tick();
    const list = dim().getEntities({ type: ENTITIES.PARASITE });
    assert.equal(list.length, 1);
    assert.deepEqual(list[0].location, { x: 5.5, y: 64, z: 4.5 });
    // enclosed: top and front are stone
    mock.setBlock(OW, { x: 5, y: 64, z: 6 }, "minecraft:stone");
    mock.tick(10);
    mock.useItemOn(p, { x: 5, y: 64, z: 5 }, "Up");
    mock.tick();
    assert.equal(parasites(), 1);
    assert.equal(mock.inventory(p).getItem(0)?.amount, 1);
    assert.ok(mock.messagesTo(p).some((m) => m.includes("no room")));
  });
});

// ---------------------------------------------------------------------------
describe("2. replication doubles exactly every replicationSeconds", () => {
  beforeEach(() => fresh());

  test("1 -> 2 -> 4 -> 8 at 30/60/90 s, nothing before, offspring next to parents", () => {
    const first = release();
    const t0 = mock.currentTick;
    assert.equal(parasites(), 1);
    mock.tick(599);
    assert.equal(parasites(), 1, "nothing before 30 s");
    assert.equal(api.getState().generation, 0);
    assert.equal(api.getState().ticksToNext, 1);
    mock.tick(1);
    assert.equal(mock.currentTick - t0, 600);
    assert.equal(parasites(), 2, "30 s -> 2");
    assert.equal(api.getState().generation, 1);
    assert.equal(api.getState().ticksToNext, 600);
    const child = dim().getEntities({ type: ENTITIES.PARASITE }).find((e) => e.id !== first.id);
    const d = Math.hypot(child.location.x - first.location.x, child.location.z - first.location.z);
    assert.ok(d > 0.9 && d < 1.5, `offspring next to the parent (distance ${d})`);
    assert.equal(child.location.y, 64);
    assert.equal(child.getDynamicProperty(PROPS.EPOCH), 0);
    assert.ok(mock.triggered(child).includes("pas:born"));
    assert.ok(mock.records.particles.some((r) => r.id === "pas:birth_splatter" && r.tick === mock.currentTick));
    assert.ok(mock.records.sounds.some((s) => s.id === "pas.parasite.birth" && s.tick === mock.currentTick));
    mock.tick(599);
    assert.equal(parasites(), 2);
    mock.tick(1);
    assert.equal(parasites(), 4, "60 s -> 4");
    mock.tick(599);
    assert.equal(parasites(), 4);
    mock.tick(1);
    assert.equal(parasites(), 8, "90 s -> 8");
    assert.equal(mock.currentTick - t0, 1800);
    assert.equal(api.getState().generation, 3);
    assert.equal(api.getState().stats.births, 7);
    assert.deepEqual(newOutbreakErrors(), []);
  });

  test("spawns are spread over ticks at <= 8 per tick (16 -> 32 takes two ticks)", () => {
    api.setConfig({ replicationSeconds: 10 });
    release();
    for (let g = 0; g < 4; g++) tickToGeneration();
    assert.equal(parasites(), 16);
    mock.clearRecords();
    tickToGeneration(1);
    mock.tick(1);
    assert.equal(parasites(), 24, "8 offspring in the generation tick");
    assert.equal(api.hordeCount(), 32, "8 still pending are counted");
    assert.equal(api.runtimeInfo().pendingSpawns, 8);
    mock.tick(1);
    assert.equal(parasites(), 32);
    assert.equal(api.runtimeInfo().pendingSpawns, 0);
    const spawned = mock.records.spawned.filter((s) => s.typeId === ENTITIES.PARASITE);
    assert.equal(spawned.length, 16);
    assert.equal(maxPerTick(spawned), 8);
    assert.deepEqual([...perTick(spawned).values()], [8, 8]);
  });
});

// ---------------------------------------------------------------------------
describe("3. population cap", () => {
  beforeEach(() => fresh());

  test("default cap 64 is reached exactly and never exceeded", () => {
    api.setConfig({ replicationSeconds: 10 });
    assert.equal(api.getConfig().populationCap, 64);
    release();
    const seen = [];
    for (let g = 0; g < 8; g++) {
      tickToGeneration();
      mock.tick(5); // let the queue drain (32 offspring = 4 ticks)
      seen.push(parasites());
      assert.ok(api.hordeCount() <= 64);
    }
    assert.deepEqual(seen, [2, 4, 8, 16, 32, 64, 64, 64]);
    assert.equal(api.getState().generation, 8);
  });

  test("cap 6: 1 -> 2 -> 4 -> 6 -> 6", () => {
    api.setConfig({ populationCap: 6 });
    release();
    const seen = [];
    for (let g = 0; g < 4; g++) {
      tickToGeneration();
      seen.push(parasites());
    }
    assert.deepEqual(seen, [2, 4, 6, 6]);
  });

  test("the cap counts infected creatures (all dimensions) too", () => {
    api.setConfig({ populationCap: 8 });
    release();
    mock.spawn(ENTITIES.INFECTED_COW, { x: 10.5, y: 64, z: 10.5 });
    mock.spawn(ENTITIES.INFECTED_PIG, { x: 12.5, y: 64, z: 10.5 });
    mock.spawn(ENTITIES.INFECTED_VILLAGER, { x: 5.5, y: 64, z: 5.5 }, { dimension: "minecraft:nether" });
    assert.equal(api.hordeCount(), 4);
    const seen = [];
    for (let g = 0; g < 4; g++) {
      tickToGeneration();
      seen.push(parasites());
    }
    // budgets: 8-4=4 (1 parent) -> 2, 8-5=3 (2 parents) -> 4, 8-7=1 -> 5, 0 -> 5
    assert.deepEqual(seen, [2, 4, 5, 5]);
    assert.equal(api.hordeCount(), 8);
  });

  test("conversion holds at 0 at the cap and completes once a slot frees", () => {
    api.setConfig({ populationCap: 4, replicationSeconds: 300, incubationSeconds: 5 });
    const ps = [release(), release({ x: 2.5, y: 64, z: 0.5 }), release({ x: 4.5, y: 64, z: 0.5 }), release({ x: 6.5, y: 64, z: 0.5 })];
    assert.equal(api.hordeCount(), 4);
    const cow = mock.spawn("minecraft:cow", { x: 10.5, y: 64, z: 10.5 });
    hit(cow, ps[0]);
    assert.ok(cow.hasTag(TAGS.INCUBATING));
    mock.tick(200);
    assert.ok(cow.isValid(), "still a cow: held at the cap");
    assert.equal(cow.getDynamicProperty(PROPS.INC_TICKS), 0);
    assert.equal(api.getStatus().held, 1);
    assert.equal(cow.getEffect("slowness")?.amplifier, 4, "dormant feedback (almost frozen)");
    assert.equal(count(ENTITIES.INFECTED_COW), 0);
    // a parasite dies: its slot frees immediately (dying entities are not counted)
    ps[1].kill();
    mock.flush();
    assert.equal(api.hordeCount(), 3);
    mock.tick(21);
    assert.equal(cow.isValid(), false);
    assert.equal(count(ENTITIES.INFECTED_COW), 1);
    assert.equal(api.hordeCount(), 4);
    assert.equal(api.getStatus().held, 0);
  });

  test("an infected-human spawn respects the cap", () => {
    api.setConfig({ populationCap: 2, replicationSeconds: 300 });
    assert.equal(api.getConfig().populationCap, 4, "clamped to the minimum");
    const a = release();
    for (let i = 1; i < 4; i++) release({ x: 3.5 * i, y: 64, z: 0.5 });
    assert.equal(api.hordeCount(), 4);
    const p = mock.addPlayer({ name: "Victim", location: { x: 8.5, y: 64, z: 8.5 } });
    mock.tick();
    hit(p, a, 100); // killed by the horde at the cap
    assert.equal(count(ENTITIES.INFECTED_HUMAN), 0);
    assert.ok(mock.messagesTo(p).some((m) => m.includes("population cap")));
    api.setConfig({ populationCap: 8 });
    mock.respawnPlayer(p);
    mock.tick();
    hit(p, a, 100);
    assert.equal(count(ENTITIES.INFECTED_HUMAN), 1);
    assert.equal(dim().getEntities({ type: ENTITIES.INFECTED_HUMAN })[0].nameTag, "Infected Victim");
  });
});

// ---------------------------------------------------------------------------
describe("12. robustness", () => {
  beforeEach(() => fresh());

  test("spawnEntity throwing does not crash and does not leak pending counts", () => {
    api.setConfig({ replicationSeconds: 10 });
    release();
    const d = dim();
    const orig = d.spawnEntity;
    let thrown = 0;
    d.spawnEntity = function (id, loc) {
      if (id === ENTITIES.PARASITE) {
        thrown++;
        throw new LocationInUnloadedChunkError("mock: chunk unloaded right now");
      }
      return orig.call(this, id, loc);
    };
    try {
      tickToGeneration(); // must not throw (mock would rethrow escaped errors)
      mock.tick(3);
    } finally {
      d.spawnEntity = orig;
    }
    assert.equal(thrown, 1);
    assert.equal(api.runtimeInfo().pendingSpawns, 0);
    assert.equal(api.hordeCount(), 1);
    assert.equal(parasites(), 1);
    assert.equal(api.getState().generation, 1);
    assert.equal(errorsLogged("outbreak.offspring.spawn"), 1);
    tickToGeneration();
    assert.equal(parasites(), 2, "next generation works again");
    assert.deepEqual(mock.errors, []);
  });

  for (const mode of ["undefined", "throw"]) {
    test(`parent chunk unloaded between snapshot and spawn (getBlock ${mode})`, () => {
      mock.setOptions({ unloadedGetBlock: mode });
      api.setConfig({ replicationSeconds: 300 });
      const far = release({ x: 100.5, y: 64, z: 100.5 });
      assert.ok(far);
      assert.equal(api.runGeneration(), 1);
      assert.equal(api.hordeCount(), 2, "pending counted");
      mock.unloadAt(OW, { x: 100, y: 0, z: 100 });
      mock.tick(2);
      assert.equal(api.runtimeInfo().pendingSpawns, 0);
      assert.equal(api.hordeCount(), 0, "the unloaded parasite is not counted, no pending left");
      mock.loadAt(OW, { x: 100, y: 0, z: 100 });
      mock.tick();
      assert.equal(api.hordeCount(), 1);
      assert.deepEqual(newOutbreakErrors(), []);
    });
  }

  test("conversion spawn failure keeps the mob incubating and retries", () => {
    api.setConfig({ replicationSeconds: 300, incubationSeconds: 5 });
    const p = release();
    const cow = mock.spawn("minecraft:cow", { x: 6.5, y: 64, z: 6.5 });
    hit(cow, p);
    const d = dim();
    const orig = d.spawnEntity;
    d.spawnEntity = function (id, loc) {
      if (id === ENTITIES.INFECTED_COW) throw new Error("mock spawn failure");
      return orig.call(this, id, loc);
    };
    try {
      mock.tick(140);
    } finally {
      d.spawnEntity = orig;
    }
    assert.ok(cow.isValid());
    assert.ok(cow.hasTag(TAGS.INCUBATING));
    assert.ok(errorsLogged("outbreak.convert.spawn") >= 1);
    mock.tick(21);
    assert.equal(cow.isValid(), false);
    assert.equal(count(ENTITIES.INFECTED_COW), 1);
  });

  test("400 incubating mobs are processed within the per-tick budgets", () => {
    api.setConfig({ populationCap: 200, incubationSeconds: 5, replicationSeconds: 300 });
    const p = release({ x: 0.5, y: 64, z: -30.5 });
    const cows = [];
    for (let i = 0; i < 400; i++) cows.push(mock.spawn("minecraft:cow", { x: (i % 20) * 2 - 19.5, y: 64, z: Math.floor(i / 20) * 2 - 19.5 }));
    let infected = 0;
    for (const c of cows) if (api.infect(c, p)) infected++;
    assert.equal(infected, 400);
    mock.clearRecords();
    // align to the start of a 1 Hz incubation cycle, then watch the whole 20-tick window
    mock.runUntil(() => mock.records.particles.some((r) => r.id === "pas:infection_spores"), 40);
    mock.tick(19);
    const spores = mock.records.particles.filter((r) => r.id === "pas:infection_spores");
    assert.equal(perTick(spores).size, 13, "400 mobs spread over 13 ticks (32 per tick)");
    assert.equal(spores.length, 400, "every incubating mob was processed once in the cycle");
    assert.ok(maxPerTick(spores) <= 32, `<= 32 per tick (got ${maxPerTick(spores)})`);
    assert.ok(cows.every((c) => c.getDynamicProperty(PROPS.INC_TICKS) === 80));
    mock.tick(200);
    const bursts = mock.records.particles.filter((r) => r.id === "pas:conversion_burst");
    const spawns = mock.records.spawned.filter((r) => r.typeId === ENTITIES.INFECTED_COW);
    assert.equal(spawns.length, 199, "cap 200 - 1 parasite");
    assert.ok(maxPerTick(spawns) <= 8, `<= 8 conversions per tick (got ${maxPerTick(spawns)})`);
    assert.equal(bursts.length, 199);
    assert.equal(count(ENTITIES.INFECTED_COW), 199);
    assert.equal(api.hordeCount(), 200);
    const left = cows.filter((c) => c.isValid());
    assert.equal(left.length, 201);
    assert.ok(left.every((c) => c.hasTag(TAGS.INCUBATING) && c.getDynamicProperty(PROPS.INC_TICKS) === 0));
    assert.equal(api.getStatus().held, 201);
    assert.deepEqual(newOutbreakErrors(), []);
    assert.deepEqual(mock.errors, []);
  });
});
