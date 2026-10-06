// Outbreak: infection chain, infection rules, players (SPEC §7).
// Tests 4, 5 and 6 of the outbreak workstream.

import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { GameMode } from "@minecraft/server";
import {
  mock,
  api,
  ENTITIES,
  PROPS,
  TAGS,
  OW,
  fresh,
  dim,
  count,
  hit,
  release,
  newOutbreakErrors,
} from "./outbreak_helpers.mjs";

function only(typeId) {
  const list = dim().getEntities({ type: typeId });
  assert.equal(list.length, 1, `exactly one ${typeId}`);
  return list[0];
}

function origin(e) {
  return JSON.parse(e.getDynamicProperty(PROPS.ORIGIN_DATA));
}

// ---------------------------------------------------------------------------
describe("4. infection chain over 3 generations: parasite -> villager -> cow -> pig", () => {
  beforeEach(() => fresh({ config: { replicationSeconds: 300 } }));

  test("each victim incubates, converts with its origin data, and spreads further", () => {
    const P = release({ x: 0.5, y: 64, z: 0.5 });
    // a named jungle librarian (profession 5, biome 2, skin 3), facing west
    const V = mock.spawn("minecraft:villager_v2", { x: 5.5, y: 64, z: 5.5 });
    V.triggerEvent("minecraft:become_librarian");
    mock.setComponent(V, "minecraft:mark_variant", 2);
    mock.setComponent(V, "minecraft:skin_id", 3);
    V.nameTag = "Bob";
    V.setRotation({ x: 0, y: 90 });
    const vLoc = V.location;
    mock.clearRecords();

    // --- generation 1: parasite bites the villager
    hit(V, P, 2);
    const tInf = mock.currentTick;
    assert.ok(V.hasTag(TAGS.INCUBATING));
    assert.equal(V.getDynamicProperty(PROPS.INC_TICKS), 400);
    assert.equal(V.getDynamicProperty(PROPS.INC_TOTAL), 400);
    assert.equal(V.getDynamicProperty(PROPS.INC_EPOCH), 0);
    const spore = mock.records.particles.find((r) => r.id === "pas:infection_spores");
    assert.deepEqual(spore?.location, vLoc, "spores at the feet");
    assert.ok(mock.records.sounds.some((s) => s.id === "pas.infection.start"));
    assert.equal(V.getEffect("slowness")?.amplifier, 1);
    assert.equal(api.getState().stats.infections, 1);
    mock.tick(40);
    assert.equal(V.getDynamicProperty(PROPS.INC_TICKS), 360, "1 Hz decrement");
    const ticks = mock.runUntil(() => !V.isValid(), 500);
    const elapsed = mock.currentTick - tInf;
    assert.ok(elapsed >= 381 && elapsed <= 401, `converted after ~20 s (${elapsed} ticks, ${ticks})`);
    const IV = only(ENTITIES.INFECTED_VILLAGER);
    assert.deepEqual(IV.location, vLoc);
    assert.deepEqual(IV.getRotation(), { x: 0, y: 90 });
    assert.equal(IV.nameTag, "Bob");
    const ivEvents = mock.triggered(IV);
    for (const ev of ["pas:set_variant_5", "pas:set_mark_2", "pas:set_skin_3"]) assert.ok(ivEvents.includes(ev), ev);
    assert.equal(IV.getComponent("minecraft:variant").value, 5);
    assert.equal(IV.getComponent("minecraft:mark_variant").value, 2);
    assert.equal(IV.getComponent("minecraft:skin_id").value, 3);
    assert.equal(IV.getDynamicProperty(PROPS.ORIGIN), "minecraft:villager_v2");
    assert.deepEqual(origin(IV), { v: 1, type: "minecraft:villager_v2", baby: false, name: "Bob", variant: 5, mark: 2, skin: 3 });
    assert.equal(IV.getDynamicProperty(PROPS.EPOCH), 0);
    assert.ok(mock.groups(IV).includes("pas:hunting"));
    assert.ok(mock.records.particles.some((r) => r.id === "pas:conversion_burst"));
    assert.ok(mock.records.sounds.some((s) => s.id === "pas.infection.convert"));

    // --- generation 2: the infected villager bites a cow
    const C = mock.spawn("minecraft:cow", { x: 10.5, y: 64, z: 5.5 });
    hit(C, IV);
    assert.ok(C.hasTag(TAGS.INCUBATING));
    mock.runUntil(() => !C.isValid(), 500);
    const IC = only(ENTITIES.INFECTED_COW);
    assert.ok(mock.triggered(IC).includes("pas:set_variant_0"));
    assert.equal(IC.getDynamicProperty(PROPS.ORIGIN), "minecraft:cow");

    // --- generation 3: the infected cow bites a pig
    const G = mock.spawn("minecraft:pig", { x: 15.5, y: 64, z: 5.5 });
    hit(G, IC);
    assert.ok(G.hasTag(TAGS.INCUBATING));
    mock.runUntil(() => !G.isValid(), 500);
    const IG = only(ENTITIES.INFECTED_PIG);
    assert.equal(IG.getDynamicProperty(PROPS.ORIGIN), "minecraft:pig");

    // originals are gone (removed, no death -> no drops), stats count the chain
    assert.equal(count("minecraft:villager_v2"), 0);
    assert.equal(count("minecraft:cow"), 0);
    assert.equal(count("minecraft:pig"), 0);
    assert.equal(count("minecraft:item"), 0, "no drops");
    const st = api.getState();
    assert.equal(st.stats.infections, 3);
    assert.equal(st.stats.conversions, 3);
    assert.equal(st.stats.deaths, 0);
    assert.equal(api.hordeCount(), 4);
    assert.deepEqual(newOutbreakErrors(), []);
  });

  test("origin data of mooshrooms, sheep, babies and old villagers", () => {
    const P = release();
    const brown = mock.spawn("minecraft:mooshroom", { x: 4.5, y: 64, z: 0.5 });
    brown.triggerEvent("minecraft:become_brown");
    const red = mock.spawn("minecraft:mooshroom", { x: 6.5, y: 64, z: 0.5 });
    red.triggerEvent("minecraft:become_red");
    const sheep = mock.spawn("minecraft:sheep", { x: 8.5, y: 64, z: 0.5 });
    mock.setComponent(sheep, "minecraft:color", 11);
    sheep.triggerEvent("minecraft:on_sheared");
    const calf = mock.spawn("minecraft:cow", { x: 10.5, y: 64, z: 0.5 });
    calf.triggerEvent("minecraft:entity_born");
    const old = mock.spawn("minecraft:villager", { x: 12.5, y: 64, z: 0.5 });
    old.triggerEvent("minecraft:spawn_cleric"); // v1 variant 2 -> v2 cleric (7)
    const trader = mock.spawn("minecraft:wandering_trader", { x: 14.5, y: 64, z: 0.5 });
    const chick = mock.spawn("minecraft:chicken", { x: 16.5, y: 64, z: 0.5 });
    const all = [brown, red, sheep, calf, old, trader, chick];
    for (const e of all) assert.equal(api.convertNow(e), "converted");
    const at = (x) => dim().getEntities({ location: { x, y: 64, z: 0.5 }, maxDistance: 0.1 }).find((e) => e.typeId.startsWith("pas:"));
    const b = at(4.5);
    assert.equal(b.typeId, ENTITIES.INFECTED_COW);
    assert.ok(mock.triggered(b).includes("pas:set_variant_2"), "brown mooshroom -> variant 2");
    assert.equal(b.getComponent("minecraft:variant").value, 2);
    assert.equal(origin(b).moo, 1);
    const r = at(6.5);
    assert.ok(mock.triggered(r).includes("pas:set_variant_1"), "red mooshroom -> variant 1");
    assert.equal(origin(r).moo, 0);
    const s = at(8.5);
    assert.equal(s.typeId, ENTITIES.INFECTED_SHEEP);
    assert.ok(mock.triggered(s).includes("pas:set_color_11"));
    assert.ok(mock.triggered(s).includes("pas:set_sheared"));
    assert.ok(s.hasComponent("minecraft:is_sheared"));
    const c = at(10.5);
    assert.ok(mock.triggered(c).includes("pas:make_baby"));
    assert.ok(c.hasComponent("minecraft:is_baby"));
    assert.equal(origin(c).baby, true);
    const o = at(12.5);
    assert.equal(o.typeId, ENTITIES.INFECTED_VILLAGER);
    assert.ok(mock.triggered(o).includes("pas:set_variant_7"));
    assert.equal(origin(o).v1variant, 2);
    const t = at(14.5);
    assert.equal(t.typeId, ENTITIES.INFECTED_VILLAGER);
    assert.equal(t.getDynamicProperty(PROPS.ORIGIN), "minecraft:wandering_trader");
    assert.equal(at(16.5).typeId, ENTITIES.INFECTED_CHICKEN);
    assert.ok(P.isValid());
    assert.deepEqual(newOutbreakErrors(), []);
  });
});

// ---------------------------------------------------------------------------
describe("5. infection rules", () => {
  beforeEach(() => fresh({ config: { replicationSeconds: 300 } }));

  test("no horde-on-horde infection", () => {
    const P = release();
    const IC = mock.spawn(ENTITIES.INFECTED_COW, { x: 3.5, y: 64, z: 0.5 });
    assert.equal(IC.applyDamage(2, { damagingEntity: P, cause: "entityAttack" }), false, "damage sensor: no friendly fire");
    // even if a hurt event arrives, horde targets are never infected
    mock.fireAfter("entityHurt", { hurtEntity: IC, damage: 2, damageSource: { cause: "entityAttack", damagingEntity: P } });
    assert.equal(IC.hasTag(TAGS.INCUBATING), false);
    assert.equal(IC.getDynamicProperty(PROPS.INC_TICKS), undefined);
    assert.equal(api.infect(IC, P), false);
    assert.equal(api.getState().stats.infections, 0);
  });

  test("an incubating target is not re-infected; zero damage and healthy attackers do not infect", () => {
    const P = release();
    const cow = mock.spawn("minecraft:cow", { x: 5.5, y: 64, z: 0.5 });
    hit(cow, P);
    mock.tick(40);
    assert.equal(cow.getDynamicProperty(PROPS.INC_TICKS), 360);
    hit(cow, P);
    assert.equal(cow.getDynamicProperty(PROPS.INC_TICKS), 360, "timer not reset");
    assert.equal(cow.getDynamicProperty(PROPS.INC_TOTAL), 400);
    assert.equal(api.getState().stats.infections, 1);
    const pig = mock.spawn("minecraft:pig", { x: 7.5, y: 64, z: 0.5 });
    mock.fireAfter("entityHurt", { hurtEntity: pig, damage: 0, damageSource: { cause: "entityAttack", damagingEntity: P } });
    assert.equal(pig.hasTag(TAGS.INCUBATING), false, "damage 0");
    const healthy = mock.addPlayer({ name: "Healthy", location: { x: 9.5, y: 64, z: 0.5 } });
    mock.tick();
    hit(pig, healthy);
    assert.equal(pig.hasTag(TAGS.INCUBATING), false, "a healthy player does not spread it");
    const zombie = mock.spawn("minecraft:zombie", { x: 11.5, y: 64, z: 0.5 });
    hit(zombie, P);
    assert.equal(zombie.hasTag(TAGS.INCUBATING), false, "not infectable");
  });

  test("creative players are immune; infectPlayers=false is respected", () => {
    const P = release();
    const creative = mock.addPlayer({ name: "Builder", location: { x: 5.5, y: 64, z: 5.5 }, gameMode: GameMode.creative });
    mock.tick();
    mock.fireAfter("entityHurt", { hurtEntity: creative, damage: 3, damageSource: { cause: "entityAttack", damagingEntity: P } });
    assert.equal(creative.hasTag(TAGS.INCUBATING), false);
    assert.equal(api.infect(creative, P), false);
    const adv = mock.addPlayer({ name: "Adventurer", location: { x: 7.5, y: 64, z: 5.5 }, gameMode: GameMode.adventure });
    mock.tick();
    hit(adv, P);
    assert.ok(adv.hasTag(TAGS.INCUBATING), "adventure players can be infected");
    api.setConfig({ infectPlayers: false });
    const surv = mock.addPlayer({ name: "Survivor", location: { x: 9.5, y: 64, z: 5.5 } });
    mock.tick();
    hit(surv, P);
    assert.equal(surv.hasTag(TAGS.INCUBATING), false);
    assert.equal(surv.getDynamicProperty(PROPS.STAGE), undefined);
    const cow = mock.spawn("minecraft:cow", { x: 11.5, y: 64, z: 5.5 });
    hit(cow, P);
    assert.ok(cow.hasTag(TAGS.INCUBATING), "mobs are still infected");
  });

  test("no infection when the outbreak is inactive", () => {
    const cow = mock.spawn("minecraft:cow", { x: 5.5, y: 64, z: 0.5 });
    const stray = mock.spawn(ENTITIES.PARASITE, { x: 3.5, y: 64, z: 0.5 });
    hit(cow, stray);
    assert.equal(cow.hasTag(TAGS.INCUBATING), false);
  });
});

// ---------------------------------------------------------------------------
describe("6. players", () => {
  beforeEach(() => fresh({ config: { replicationSeconds: 300 } }));

  test("stage 1 countdown -> stage 2 -> spreads by attacking -> dies -> infected human; respawns healthy", () => {
    const P = release();
    const alex = mock.addPlayer({ name: "Alex", location: { x: 6.5, y: 64, z: 6.5 } });
    mock.tick();
    mock.clearRecords();
    hit(alex, P, 2);
    // stage 1
    assert.ok(alex.hasTag(TAGS.INCUBATING));
    assert.equal(alex.getDynamicProperty(PROPS.STAGE), 1);
    assert.equal(alex.getDynamicProperty(PROPS.INC_TICKS), 900);
    assert.ok(mock.records.titles.some((t) => t.playerId === alex.id && String(t.title).includes("INFECTED")));
    assert.ok(alex.getEffect("nausea"), "nausea pulse");
    mock.tick(20);
    assert.equal(alex.getDynamicProperty(PROPS.INC_TICKS), 880);
    assert.match(mock.lastActionBar(alex), /Infection incubating: .*44s/);
    assert.ok(mock.records.sounds.some((s) => s.id === "pas.infection.heartbeat" && s.playerId === alex.id));
    // a stage-1 player already spreads it
    const cow = mock.spawn("minecraft:cow", { x: 20.5, y: 64, z: 20.5 });
    hit(cow, alex);
    assert.ok(cow.hasTag(TAGS.INCUBATING), "stage-1 attacks infect");
    // stage 2 after 45 s
    mock.tick(880);
    assert.equal(alex.hasTag(TAGS.INCUBATING), false);
    assert.ok(alex.hasTag(TAGS.INFECTED_PLAYER));
    assert.equal(alex.getDynamicProperty(PROPS.STAGE), 2);
    assert.equal(alex.getDynamicProperty(PROPS.INC_TICKS), undefined);
    assert.equal(alex.getDynamicProperty(PROPS.INC_EPOCH), 0);
    assert.ok(alex.getEffect("hunger"));
    assert.ok(alex.getEffect("nausea"));
    assert.ok(mock.lastActionBar(alex).includes("☣ INFECTED — your attacks spread the parasite"));
    // recurring pulses: hunger 5 s every 10 s, nausea 4 s every 15 s (sampled over 30 s)
    mock.tick(300);
    let hungerTicks = 0;
    let nauseaTicks = 0;
    for (let i = 0; i < 600; i++) {
      mock.tick();
      if (alex.getEffect("hunger")) hungerTicks++;
      if (alex.getEffect("nausea")) nauseaTicks++;
    }
    assert.ok(hungerTicks >= 290 && hungerTicks <= 310, `hunger pulses (${hungerTicks}/600 ticks)`);
    assert.ok(nauseaTicks >= 150 && nauseaTicks <= 170, `nausea pulses (${nauseaTicks}/600 ticks)`);
    assert.ok(mock.lastActionBar(alex).includes("☣ INFECTED — your attacks spread the parasite"));
    // stage-2 attack infects a sheep
    const sheep = mock.spawn("minecraft:sheep", { x: 24.5, y: 64, z: 20.5 });
    hit(sheep, alex);
    assert.ok(sheep.hasTag(TAGS.INCUBATING));
    const before = api.hordeCount();
    // death -> infected human at the death location
    const deathLoc = alex.location;
    hit(alex, undefined, 100);
    const humans = dim().getEntities({ type: ENTITIES.INFECTED_HUMAN });
    assert.equal(humans.length, 1);
    assert.equal(humans[0].nameTag, "Infected Alex");
    assert.deepEqual(humans[0].location, deathLoc);
    assert.equal(humans[0].getDynamicProperty(PROPS.ORIGIN), "minecraft:player");
    assert.equal(humans[0].getDynamicProperty(PROPS.EPOCH), 0);
    assert.equal(api.hordeCount(), before + 1);
    // the player is cleared
    assert.equal(alex.hasTag(TAGS.INFECTED_PLAYER), false);
    assert.equal(alex.hasTag(TAGS.INCUBATING), false);
    assert.equal(alex.getDynamicProperty(PROPS.STAGE), 0);
    assert.equal(alex.getEffect("hunger"), undefined);
    assert.equal(alex.getEffect("nausea"), undefined);
    mock.respawnPlayer(alex, { location: { x: 0.5, y: 64, z: -20.5 } });
    mock.tick(40);
    assert.equal(api.stageOf(alex), 0, "respawned healthy");
    assert.equal(count(ENTITIES.INFECTED_COW), 1, "the cow Alex infected in stage 1 converted");
    assert.equal(api.getState().stats.conversions, 2, "cow + infected human");
    assert.equal(api.getState().stats.infections, 3, "Alex, cow, sheep");
    assert.deepEqual(newOutbreakErrors(), []);
  });

  test("a healthy player killed by the horde turns; a player killed by something else does not", () => {
    const P = release();
    const bob = mock.addPlayer({ name: "Bob", location: { x: 6.5, y: 64, z: 6.5 } });
    const eve = mock.addPlayer({ name: "Eve", location: { x: -6.5, y: 64, z: 6.5 } });
    mock.tick();
    hit(eve, undefined, 100);
    assert.equal(count(ENTITIES.INFECTED_HUMAN), 0);
    hit(bob, P, 100);
    assert.equal(count(ENTITIES.INFECTED_HUMAN), 1);
    assert.equal(dim().getEntities({ type: ENTITIES.INFECTED_HUMAN })[0].nameTag, "Infected Bob");
  });

  test("Cure me clears only the user", () => {
    const P = release();
    const a = mock.addPlayer({ name: "A", location: { x: 6.5, y: 64, z: 6.5 } });
    const b = mock.addPlayer({ name: "B", location: { x: -6.5, y: 64, z: 6.5 } });
    mock.tick();
    hit(a, P);
    hit(b, P);
    assert.equal(api.curePlayer(a), true);
    assert.equal(api.stageOf(a), 0);
    assert.equal(a.getDynamicProperty(PROPS.INC_TICKS), undefined);
    assert.equal(api.stageOf(b), 1);
    assert.equal(api.curePlayer(a), false);
  });

  test("an offline stage-1 player keeps incubating after rejoining", () => {
    const P = release();
    const q = mock.addPlayer({ name: "Quinn", location: { x: 6.5, y: 64, z: 6.5 } });
    mock.tick();
    hit(q, P);
    mock.tick(100);
    const left = q.getDynamicProperty(PROPS.INC_TICKS);
    mock.removePlayer(q);
    mock.tick(200);
    const q2 = mock.addPlayer({ name: "Quinn" });
    mock.tick(1);
    assert.equal(q2.getDynamicProperty(PROPS.INC_TICKS), left, "frozen while offline");
    assert.equal(api.stageOf(q2), 1);
    mock.tick(40);
    assert.equal(q2.getDynamicProperty(PROPS.INC_TICKS), left - 40);
  });
});
