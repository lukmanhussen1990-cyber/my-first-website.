// Outbreak: pause/resume, cleanup, cure, UI/HUD/commands (SPEC §7).
// Tests 7, 8, 9 and 11 of the outbreak workstream.

import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  mock,
  ui,
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
  storedState,
  storedConfig,
} from "./outbreak_helpers.mjs";
import { UI_TEXT, BUSY_RETRY_TICKS } from "../addon/behavior_pack/scripts/outbreak/ui.js";
import { COMMAND_USAGE } from "../addon/behavior_pack/scripts/outbreak/commands.js";

const FAR = { x: 100.5, y: 64, z: 100.5 };
const FAR_CHUNK = { x: 100, y: 0, z: 100 };

function isDormant(e) {
  const g = mock.groups(e);
  return e.hasTag(TAGS.DORMANT) && g.includes("pas:dormant") && !g.includes("pas:hunting");
}
function isActive(e) {
  const g = mock.groups(e);
  return !e.hasTag(TAGS.DORMANT) && g.includes("pas:hunting") && !g.includes("pas:dormant");
}
function at(loc, typeId) {
  return dim().getEntities({ type: typeId, location: loc, maxDistance: 0.01 })[0];
}

// ---------------------------------------------------------------------------
describe("7. pause / resume", () => {
  beforeEach(() => fresh({ config: { replicationSeconds: 30, incubationSeconds: 20 } }));

  test("dormant events + tags, frozen timers, no new infections, late loads become dormant, resume continues", () => {
    const P1 = release();
    const P2 = release({ x: 3.5, y: 64, z: 0.5 });
    const far = release(FAR);
    const cow = mock.spawn("minecraft:cow", { x: 6.5, y: 64, z: 6.5 });
    hit(cow, P1);
    mock.tick(100);
    mock.unloadAt(OW, FAR_CHUNK);
    assert.equal(far.isValid(), false);
    const ttn = api.getState().ticksToNext;
    const inc = cow.getDynamicProperty(PROPS.INC_TICKS);
    assert.equal(ttn, 500);
    assert.ok(inc > 0 && inc < 400);
    mock.clearRecords();

    assert.equal(api.pause(), true);
    assert.equal(api.pause(), false, "already paused");
    for (const e of [P1, P2]) {
      assert.ok(mock.triggered(e).includes("pas:become_dormant"));
      assert.ok(isDormant(e));
    }
    assert.equal(storedState().paused, true);
    // frozen for 100 s
    const gen = api.getState().generation;
    mock.tick(2000);
    assert.equal(api.getState().ticksToNext, ttn);
    assert.equal(api.getState().generation, gen);
    assert.equal(cow.getDynamicProperty(PROPS.INC_TICKS), inc);
    assert.ok(cow.isValid(), "no conversion while paused");
    assert.equal(parasites(), 2);
    // no new infections while paused
    const pig = mock.spawn("minecraft:pig", { x: -6.5, y: 64, z: 6.5 });
    hit(pig, P1);
    assert.equal(pig.hasTag(TAGS.INCUBATING), false);
    // an entity that loads while paused becomes dormant
    mock.loadAt(OW, FAR_CHUNK);
    mock.tick();
    assert.ok(far.isValid());
    assert.ok(isDormant(far), "late-loaded entity synced on entityLoad");
    // resume: active again, timers continue from the frozen values
    mock.clearRecords();
    assert.equal(api.resume(), true);
    for (const e of [P1, P2, far]) {
      assert.ok(mock.triggered(e).includes("pas:become_active"));
      assert.ok(isActive(e));
    }
    const tResume = mock.currentTick;
    mock.tick(ttn - 1);
    assert.equal(parasites(), 3);
    mock.tick(1);
    assert.equal(parasites(), 6, "generation exactly after the frozen remaining time");
    assert.equal(mock.currentTick - tResume, ttn);
    assert.equal(cow.isValid(), false, "incubation finished after resuming");
    assert.equal(count(ENTITIES.INFECTED_COW), 1);
    assert.deepEqual(newOutbreakErrors(), []);
  });

  test("pause+resume in the same tick never leaves entities dormant; the sweep repairs missed events", () => {
    const P = release();
    mock.tick();
    api.pause();
    api.resume();
    mock.tick(2);
    assert.ok(isActive(P));
    assert.equal(api.getState().paused, false);
    // simulate a missed event: entity dormant while the outbreak is active
    P.triggerEvent("pas:become_dormant");
    assert.ok(!mock.groups(P).includes("pas:hunting"));
    mock.tick(101);
    assert.ok(isActive(P), "5 s sweep re-activated it");
    // and the reverse: paused, but an entity is hunting without the tag
    api.pause();
    P.triggerEvent("pas:become_active");
    P.removeTag(TAGS.DORMANT);
    mock.tick(101);
    assert.ok(isDormant(P));
  });

  test("offspring spawned while paused (queued before the pause) are dormant", () => {
    const P = release();
    for (let i = 0; i < 9; i++) release({ x: 2 * i + 3.5, y: 64, z: 0.5 });
    mock.tick(api.getState().ticksToNext - 1);
    api.runGeneration(); // queue 10, nothing spawned yet
    api.pause();
    mock.tick(3);
    assert.equal(parasites(), 20);
    assert.ok(dim().getEntities({ type: ENTITIES.PARASITE }).every(isDormant));
    assert.ok(P.isValid());
  });
});

// ---------------------------------------------------------------------------
describe("8. cleanup", () => {
  beforeEach(() => fresh({ config: { replicationSeconds: 300, playerIncubationSeconds: 60 } }));

  test("removes the horde, clears infections, inactive; unloaded entities are purged lazily on load", () => {
    const P = release();
    release({ x: 3.5, y: 64, z: 0.5 });
    const cow = mock.spawn("minecraft:cow", { x: 6.5, y: 64, z: 0.5 });
    assert.equal(api.convertNow(cow), "converted");
    const pig = mock.spawn("minecraft:pig", { x: 8.5, y: 64, z: 0.5 });
    hit(pig, P);
    const steve = mock.addPlayer({ name: "Steve", location: { x: 10.5, y: 64, z: 0.5 } });
    mock.tick();
    hit(steve, P);
    const far = release(FAR);
    const farSheep = mock.spawn("minecraft:sheep", { x: 102.5, y: 64, z: 100.5 });
    hit(farSheep, far);
    assert.ok(farSheep.hasTag(TAGS.INCUBATING));
    mock.tick(40);
    mock.unloadAt(OW, FAR_CHUNK);
    assert.equal(api.hordeCount(), 3);

    const n = api.cleanup();
    assert.equal(n, 5, "3 horde + pig + player");
    mock.flush();
    assert.equal(api.hordeCount(), 0);
    assert.equal(parasites(), 0);
    assert.equal(count(ENTITIES.INFECTED_COW), 0);
    assert.equal(count("minecraft:cow"), 0, "cleanup does not revert");
    assert.equal(pig.hasTag(TAGS.INCUBATING), false);
    assert.equal(pig.getDynamicProperty(PROPS.INC_TICKS), undefined);
    assert.equal(pig.getDynamicProperty(PROPS.INC_EPOCH), undefined);
    assert.equal(api.stageOf(steve), 0);
    assert.equal(steve.getDynamicProperty(PROPS.STAGE), 0);
    assert.ok(mock.messagesTo(steve).some((m) => m.includes("cleaned up")));
    const st = api.getState();
    assert.equal(st.active, false);
    assert.equal(st.generation, 0);
    assert.equal(st.epoch, 1);
    assert.deepEqual(st.purges, { 1: "cleanup" });
    assert.deepEqual(storedState().purges, { 1: "cleanup" });
    // nothing replicates any more
    mock.tick(400);
    assert.equal(parasites(), 0);
    // the unloaded parasite and sheep are handled when their chunk loads
    mock.loadAt(OW, FAR_CHUNK);
    mock.tick();
    assert.equal(far.isValid(), false, "stale epoch -> removed on load");
    assert.equal(farSheep.isValid(), true);
    assert.equal(farSheep.hasTag(TAGS.INCUBATING), false, "stale inc_epoch -> cleared on load");
    // a new outbreak starts in the new epoch
    const fresh1 = release();
    assert.equal(fresh1.getDynamicProperty(PROPS.EPOCH), 1);
    assert.equal(api.getState().active, true);
    assert.deepEqual(newOutbreakErrors(), []);
  });

  test("a large horde is purged at <= 32 entities per tick", () => {
    api.setConfig({ populationCap: 200 });
    for (let i = 0; i < 100; i++) release({ x: (i % 10) * 2 + 0.5, y: 64, z: Math.floor(i / 10) * 2 + 0.5 });
    assert.equal(api.cleanup(), 100);
    assert.equal(parasites(), 68);
    mock.tick();
    assert.equal(parasites(), 36);
    mock.tick(2);
    assert.equal(parasites(), 0);
  });
});

// ---------------------------------------------------------------------------
describe("9. cure", () => {
  beforeEach(() => fresh({ config: { replicationSeconds: 300, playerIncubationSeconds: 10 } }));

  test("reverts infected creatures with their origin data, removes parasites, cures players; unloaded ones lazily", () => {
    const P = release();
    const V = mock.spawn("minecraft:villager_v2", { x: 4.5, y: 64, z: 0.5 });
    V.triggerEvent("minecraft:become_librarian");
    mock.setComponent(V, "minecraft:mark_variant", 2);
    V.nameTag = "Bob";
    const vLoc = V.location;
    api.convertNow(V);
    const M = mock.spawn("minecraft:mooshroom", { x: 6.5, y: 64, z: 0.5 });
    M.triggerEvent("minecraft:become_brown");
    api.convertNow(M);
    const piglet = mock.spawn("minecraft:pig", { x: 8.5, y: 64, z: 0.5 });
    piglet.triggerEvent("minecraft:entity_born");
    api.convertNow(piglet);
    const S = mock.spawn("minecraft:sheep", { x: 10.5, y: 64, z: 0.5 });
    mock.setComponent(S, "minecraft:color", 11);
    S.triggerEvent("minecraft:on_sheared");
    api.convertNow(S);
    const nitwit = mock.spawn("minecraft:villager_v2", { x: 12.5, y: 64, z: 0.5 });
    mock.setComponent(nitwit, "minecraft:variant", 14);
    api.convertNow(nitwit);
    const alex = mock.addPlayer({ name: "Alex", location: { x: 0.5, y: 64, z: 8.5 } });
    const olly = mock.addPlayer({ name: "Olly", location: { x: 2.5, y: 64, z: 8.5 } });
    mock.tick();
    hit(alex, P);
    hit(olly, P);
    mock.tick(220);
    assert.equal(api.stageOf(alex), 2);
    mock.removePlayer(olly); // offline during the cure
    // a red mooshroom converted far away, then unloaded
    const farM = mock.spawn("minecraft:mooshroom", FAR);
    farM.triggerEvent("minecraft:become_red");
    api.convertNow(farM);
    mock.unloadAt(OW, FAR_CHUNK);
    assert.equal(count(ENTITIES.INFECTED_COW), 1);
    // reverted vanilla mobs run their spawn events like in game (random groups that the cure overrides)
    mock.setOptions({ runVanillaSpawnEvents: true });
    mock.clearRecords();

    const n = api.cure();
    assert.equal(n, 7, "1 parasite + 5 infected + 1 player");
    mock.tick(3); // deferred component writes
    assert.equal(api.hordeCount(), 0);
    assert.equal(parasites(), 0);
    // villager: profession through the vanilla become_<profession> event, biome + name restored
    const v2 = at(vLoc, "minecraft:villager_v2");
    assert.ok(v2, "villager back");
    assert.ok(mock.triggered(v2).includes("minecraft:become_librarian"));
    assert.equal(v2.getComponent("minecraft:variant").value, 5);
    assert.equal(v2.getComponent("minecraft:mark_variant").value, 2);
    assert.equal(v2.nameTag, "Bob");
    // brown mooshroom
    const m2 = at({ x: 6.5, y: 64, z: 0.5 }, "minecraft:mooshroom");
    assert.deepEqual(mock.triggered(m2).filter((e) => e.startsWith("minecraft:become")), ["minecraft:become_red_adult", "minecraft:become_brown"]);
    assert.equal(m2.getComponent("minecraft:variant").value, 1);
    assert.equal(m2.hasComponent("minecraft:is_baby"), false);
    // baby pig
    const p2 = at({ x: 8.5, y: 64, z: 0.5 }, "minecraft:pig");
    assert.ok(mock.triggered(p2).includes("minecraft:entity_born"));
    assert.ok(p2.hasComponent("minecraft:is_baby"));
    // sheared blue sheep
    const s2 = at({ x: 10.5, y: 64, z: 0.5 }, "minecraft:sheep");
    assert.ok(mock.triggered(s2).includes("minecraft:on_sheared"));
    assert.ok(s2.hasComponent("minecraft:is_sheared"));
    assert.equal(s2.getComponent("minecraft:color").value, 11);
    // nitwit: no become event exists, the villager comes back as spawned
    const n2 = at({ x: 12.5, y: 64, z: 0.5 }, "minecraft:villager_v2");
    assert.ok(n2);
    assert.equal(mock.triggered(n2).filter((e) => e.startsWith("minecraft:become")).length, 0);
    // players
    assert.equal(api.stageOf(alex), 0);
    assert.equal(alex.getEffect("hunger"), undefined);
    assert.ok(mock.messagesTo(alex).some((m) => m.includes("cured")));
    const st = api.getState();
    assert.equal(st.active, false);
    assert.deepEqual(st.purges, { 1: "cure" });
    // lazily: the unloaded infected mooshroom is reverted when it loads (red = variant 0)
    mock.loadAt(OW, FAR_CHUNK);
    mock.tick(3);
    assert.equal(count(ENTITIES.INFECTED_COW), 0);
    const m3 = at(FAR, "minecraft:mooshroom");
    assert.ok(m3, "far mooshroom cured on load");
    assert.ok(mock.triggered(m3).includes("minecraft:become_red_adult"));
    assert.equal(m3.getComponent("minecraft:variant").value, 0);
    // the offline player is cured when they come back
    const olly2 = mock.addPlayer({ name: "Olly" });
    mock.tick();
    assert.equal(api.stageOf(olly2), 0);
    assert.equal(olly2.getDynamicProperty(PROPS.INC_EPOCH), undefined);
    assert.ok(mock.messagesTo(olly2).some((m) => m.includes("cured")));
    assert.deepEqual(newOutbreakErrors(), []);
  });

  test("cleanup then cure: an entity unloaded during both gets the first purge after its epoch", () => {
    const far = release(FAR);
    const farCow = mock.spawn("minecraft:cow", { x: 103.5, y: 64, z: 100.5 });
    api.convertNow(farCow);
    mock.unloadAt(OW, FAR_CHUNK);
    api.cleanup(); // epoch 1: cleanup
    release();
    api.cure(); // epoch 2: cure
    assert.deepEqual(api.getState().purges, { 1: "cleanup", 2: "cure" });
    mock.loadAt(OW, FAR_CHUNK);
    mock.tick(2);
    assert.equal(far.isValid(), false);
    assert.equal(count(ENTITIES.INFECTED_COW), 0);
    assert.equal(count("minecraft:cow"), 0, "removed (cleanup), not reverted");
  });
});

// ---------------------------------------------------------------------------
describe("11. UI, HUD and commands", () => {
  beforeEach(() => fresh());

  /** Use the control item and let the form promises settle. */
  async function useControl(p) {
    mock.tick(7); // item debounce
    mock.useItem(p);
    mock.tick();
    await mock.settle();
    await mock.settle();
  }

  function newPlayer(name = "Ui") {
    const p = mock.addPlayer({ name, location: { x: 0.5, y: 64, z: 8.5 } });
    mock.tick();
    mock.setMainhand(p, ITEMS.CONTROL);
    return p;
  }

  test("menu: status body and buttons; pause via the menu; resume and Cure me appear when relevant", async () => {
    const p = newPlayer();
    const P = release();
    ui.pressButton(/Pause/);
    await useControl(p);
    const form = ui.shown.find((f) => f.kind === "ActionFormData");
    assert.equal(form.title, UI_TEXT.menuTitle);
    assert.deepEqual(
      form.buttons.map((b) => b.text),
      [UI_TEXT.pause, UI_TEXT.settings, UI_TEXT.cureAll, UI_TEXT.cleanup, UI_TEXT.close],
    );
    for (const s of ["ACTIVE", "Generation: 0", "Parasites: 1", "Population: 1 / 64", "Next generation in:", "You: healthy"]) {
      assert.ok(form.body.includes(s), `body has "${s}": ${form.body}`);
    }
    assert.equal(api.getState().paused, true);
    assert.ok(mock.records.sounds.some((s) => s.id === "pas.ui.open"));
    // paused + infected user: Resume and Cure me
    api.resume();
    hit(p, P);
    api.pause();
    ui.pressButton(/Cure me/);
    await useControl(p);
    const f2 = ui.last();
    assert.deepEqual(
      f2.buttons.map((b) => b.text),
      [UI_TEXT.resume, UI_TEXT.settings, UI_TEXT.cureAll, UI_TEXT.cleanup, UI_TEXT.cureMe, UI_TEXT.close],
    );
    assert.ok(f2.body.includes("PAUSED"));
    assert.ok(f2.body.includes("You: §cincubating"));
    assert.equal(api.stageOf(p), 0, "Cure me");
    ui.pressButton(/Resume/);
    await useControl(p);
    assert.equal(api.getState().paused, false);
  });

  test("settings: values are applied, persisted and clamped", async () => {
    const p = newPlayer();
    ui.pressButton(/Settings/);
    ui.respond({ values: { [UI_TEXT.cap]: 100, [UI_TEXT.replication]: 60, [UI_TEXT.infectPlayers]: false } });
    await useControl(p);
    const modal = ui.shown.find((f) => f.kind === "ModalFormData");
    assert.equal(modal.title, UI_TEXT.settingsTitle);
    assert.deepEqual(
      modal.controls.map((c) => [c.type, c.label, c.min, c.max, c.step, c.defaultValue]),
      [
        ["slider", UI_TEXT.replication, 10, 300, 5, 30],
        ["slider", UI_TEXT.incubation, 5, 120, 5, 20],
        ["slider", UI_TEXT.playerIncubation, 10, 300, 5, 45],
        ["slider", UI_TEXT.cap, 4, 200, 4, 64],
        ["toggle", UI_TEXT.infectPlayers, undefined, undefined, undefined, true],
        ["toggle", UI_TEXT.showHud, undefined, undefined, undefined, true],
      ],
    );
    const want = { replicationSeconds: 60, incubationSeconds: 20, playerIncubationSeconds: 45, populationCap: 100, infectPlayers: false, showHud: true };
    assert.deepEqual(api.getConfig(), want);
    assert.deepEqual(storedConfig(), want, "persisted in pas:config");
    assert.ok(mock.messagesTo(p).some((m) => m.includes("Settings saved")));
    // clamping (API / corrupt data)
    assert.deepEqual(api.setConfig({ populationCap: 1000, replicationSeconds: 1, incubationSeconds: 7.6, showHud: "yes" }), {
      ...want,
      populationCap: 200,
      replicationSeconds: 10,
      incubationSeconds: 8,
    });
    // a canceled settings form changes nothing
    ui.pressButton(/Settings/);
    ui.respond({ canceled: true });
    await useControl(p);
    assert.equal(api.getConfig().populationCap, 200);
  });

  test("cure needs confirmation; a canceled cleanup does nothing", async () => {
    const p = newPlayer();
    release();
    ui.pressButton(/Clean up/);
    ui.respond({ selection: 1 }); // Cancel
    await useControl(p);
    assert.equal(ui.last().kind, "MessageFormData");
    assert.equal(ui.last().button1, UI_TEXT.cleanup);
    assert.equal(api.getState().active, true);
    assert.equal(parasites(), 1);
    ui.pressButton(/Cure everything/);
    ui.respond({ canceled: true }); // closed
    await useControl(p);
    assert.equal(api.getState().active, true);
    ui.pressButton(/Cure everything/);
    ui.respond({ selection: 0 }); // confirm
    await useControl(p);
    assert.equal(api.getState().active, false);
    assert.deepEqual(api.getState().purges, { 1: "cure" });
    assert.equal(parasites(), 0);
    ui.pressButton(/Clean up/);
    ui.respond({ selection: 0 });
    await useControl(p);
    assert.deepEqual(api.getState().purges, { 1: "cure", 2: "cleanup" });
  });

  test("UserBusy: the menu is shown again a few ticks later", async () => {
    const p = newPlayer();
    ui.respond({ canceled: true, cancelationReason: "UserBusy" });
    ui.respond({ canceled: true, cancelationReason: "UserBusy" });
    ui.respond({ selection: 2 }); // Clean up outbreak (inactive outbreak: Settings, Cure, Clean up, Close)
    ui.respond({ selection: 1 }); // Cancel
    await useControl(p);
    assert.equal(ui.shown.length, 1);
    mock.tick(BUSY_RETRY_TICKS);
    await mock.settle();
    assert.equal(ui.shown.length, 2);
    mock.tick(BUSY_RETRY_TICKS);
    await mock.settle();
    await mock.settle();
    assert.deepEqual(
      ui.shown.map((f) => f.kind),
      ["ActionFormData", "ActionFormData", "ActionFormData", "MessageFormData"],
    );
    assert.deepEqual(newOutbreakErrors(), []);
  });

  test("HUD: throttled to every 20 ticks while the control is held, honours showHud", () => {
    const p = newPlayer("Hud");
    release();
    mock.clearRecords();
    mock.tick(100);
    const bars = mock.records.actionbars.filter((a) => a.playerId === p.id);
    assert.equal(bars.length, 5);
    for (let i = 1; i < bars.length; i++) assert.equal(bars[i].tick - bars[i - 1].tick, 20);
    assert.match(bars[4].text, /ACTIVE.*Gen 0.*Horde 1\/64.*Next \d+s/);
    api.setConfig({ showHud: false });
    mock.clearRecords();
    mock.tick(100);
    assert.equal(mock.records.actionbars.filter((a) => a.playerId === p.id).length, 0);
    api.setConfig({ showHud: true });
    mock.setMainhand(p, undefined);
    mock.setOffhand(p, ITEMS.CONTROL);
    mock.tick(20);
    assert.equal(mock.records.actionbars.filter((a) => a.playerId === p.id).length, 1, "offhand works too");
    mock.setOffhand(p, undefined);
    mock.clearRecords();
    mock.tick(100);
    assert.equal(mock.records.actionbars.filter((a) => a.playerId === p.id).length, 0, "not held");
  });

  test("/scriptevent pas:outbreak <status|pause|resume|start|cleanup|cure>", () => {
    const p = newPlayer("Op");
    const say = (msg) => {
      mock.scriptEvent("pas:outbreak", msg, { sourceEntity: p });
      const m = mock.messagesTo(p);
      return m[m.length - 1];
    };
    assert.match(say("status"), /Outbreak: inactive/);
    assert.match(say("start"), /Parasite released/);
    assert.equal(parasites(), 1);
    assert.deepEqual(dim().getEntities({ type: ENTITIES.PARASITE })[0].location, p.location);
    assert.equal(api.getState().active, true);
    assert.match(say("pause"), /paused/);
    assert.equal(api.getState().paused, true);
    assert.match(say("status"), /Outbreak: PAUSED \| Generation 0/);
    assert.match(say("resume"), /resumed/);
    assert.equal(api.getState().paused, false);
    assert.match(say("cleanup"), /cleaned up \(1 loaded/);
    assert.equal(parasites(), 0);
    assert.match(say("cure"), /cured/);
    assert.equal(api.getState().epoch, 2);
    assert.equal(say("dance"), COMMAND_USAGE);
    // other namespaces / ids are ignored; server-sourced commands answer everyone
    mock.scriptEvent("pas:other", "status", { sourceEntity: p });
    mock.scriptEvent("pas:outbreak", "status");
    assert.ok(mock.records.messages.some((m) => m.player === undefined && m.message.includes("Outbreak: inactive")));
    assert.match(world.getDimension("overworld").id, /overworld/);
    assert.deepEqual(newOutbreakErrors(), []);
  });
});
