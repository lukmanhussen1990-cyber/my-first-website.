// Outbreak save/reload across two processes (SPEC §7 "Save/reload").
// Test 10 of the outbreak workstream.
//   A (tests/outbreak_scenarios/reload_a.mjs)  outbreak at generation 2, a villager mid-incubation,
//                                              a stage-1 player, changed config -> world saved
//   B (tests/outbreak_scenarios/reload_b.mjs)  fresh process loads the world and keeps playing
// Times in B are ticks after the world was loaded (paused mode: after resume()).

import test from "node:test";
import assert from "node:assert/strict";
import { runScenario } from "./mock/harness.mjs";

const A = new URL("./outbreak_scenarios/reload_a.mjs", import.meta.url);
const B = new URL("./outbreak_scenarios/reload_b.mjs", import.meta.url);
const CONFIG = { replicationSeconds: 30, incubationSeconds: 20, playerIncubationSeconds: 60, populationCap: 48, infectPlayers: true, showHud: true };

test("mid-outbreak save -> reload: timers resume from the saved remaining ticks, config persists", { timeout: 120000 }, async () => {
  const a = await runScenario({ script: A });
  assert.equal(a.result.parasites, 4);
  assert.equal(a.result.stored.generation, 2);
  assert.equal(a.result.stored.active, true);
  assert.ok(a.result.stored.ticksToNext > 0 && a.result.stored.ticksToNext < 600);
  assert.ok(a.result.stored.ticksToNext - a.result.live.ticksToNext < 20, "state saved at least every second");
  assert.deepEqual(a.result.villager.tags, ["pas_incubating"]);
  assert.ok(a.result.villager.inc > 0 && a.result.villager.inc < 400, "villager mid-incubation");
  assert.equal(a.result.steve.stage, 1);
  assert.ok(a.result.steve.inc > 0 && a.result.steve.inc < 1200, "player mid-incubation");
  assert.deepEqual(a.result.storedConfig, CONFIG);
  assert.deepEqual(a.result.errors, []);

  const b = await runScenario({ script: B, load: a.world });
  const r = b.result;
  assert.deepEqual(r.saved, a.result.stored, "world property survived the save");
  // state rebuilt from the world on the first tick, nothing lost
  assert.deepEqual(r.first.state, a.result.stored);
  assert.deepEqual(r.first.config, CONFIG, "config persisted");
  assert.equal(r.first.parasites, 4);
  assert.equal(r.first.horde, 4);
  assert.deepEqual(r.first.steveTags, ["pas_incubating"], "player rejoined still incubating");
  assert.equal(r.first.steveStage, 1);
  assert.equal(r.first.dormantTags, 0);
  // the next doubling happens exactly ticksToNext ticks after the load tick
  assert.equal(r.events.doubled, a.result.stored.ticksToNext + 1);
  assert.equal(r.events.generationAfter, 3);
  // incubations continue from the saved pas:inc_ticks (1 Hz steps; conversion one tick after the step)
  const vi = a.result.villager.inc;
  assert.ok(r.events.villagerConverted >= vi && r.events.villagerConverted <= vi + 21, `villager converted at +${r.events.villagerConverted} (saved ${vi})`);
  const si = a.result.steve.inc;
  assert.ok(r.events.steveStage2 >= si && r.events.steveStage2 <= si + 20, `stage 2 at +${r.events.steveStage2} (saved ${si})`);
  assert.equal(r.infectedVillager.origin, "minecraft:villager_v2");
  assert.equal(r.infectedVillager.data.variant, 1, "farmer profession captured after the reload");
  assert.deepEqual(r.stats, { births: 7, infections: 2, conversions: 1, deaths: 0 });
  assert.deepEqual(r.errors, []);
  assert.equal(r.mockErrors, 0);
});

test("a paused outbreak stays paused and frozen across a reload, then resumes exactly", { timeout: 120000 }, async () => {
  const env = { PAS_MODE: "paused" };
  const a = await runScenario({ script: A, env });
  assert.equal(a.result.stored.paused, true);
  assert.equal(a.result.stored.ticksToNext, a.result.live.ticksToNext, "pause saves immediately");
  const b = await runScenario({ script: B, load: a.world, env });
  const r = b.result;
  assert.equal(r.first.state.paused, true);
  assert.equal(r.first.dormantTags, 4, "horde still dormant after the reload");
  // 30 s after the reload nothing has moved
  assert.deepEqual(r.pausedCheck, {
    ticksToNext: a.result.stored.ticksToNext,
    parasites: 4,
    villagerInc: a.result.villager.inc,
    inc0: a.result.villager.inc,
  });
  // after resume(): the doubling comes exactly after the frozen remaining time
  assert.equal(r.events.doubled, a.result.stored.ticksToNext);
  const vi = a.result.villager.inc;
  assert.ok(r.events.villagerConverted >= vi && r.events.villagerConverted <= vi + 21);
  assert.deepEqual(r.errors, []);
  assert.equal(r.mockErrors, 0);
});
