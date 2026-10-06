// Tactical Torchlight crash recovery across game restarts (SPEC §5 persistence), run as
// three separate Node processes through tests/mock/harness.mjs:
//   A (tests/torch_scenarios/crash_a.mjs)   lights placed, world saved WITHOUT cleanup (crash)
//   B (tests/torch_scenarios/reload_b.mjs)  restart with the far chunk unloaded: startup clears what it can reach
//   C (tests/torch_scenarios/reload_c.mjs)  second restart: still-pending cells are cleared once the chunk loads

import test from "node:test";
import assert from "node:assert/strict";

import { runScenario } from "./mock/harness.mjs";
import { hasVanillaRef } from "./mock/testkit.mjs";

const OW = "minecraft:overworld";
const NEEDS_REF = hasVanillaRef() ? false : "vanilla reference (mojang-blocks.json) not available";

const ALPHA = { "0,62,9": 15, "0,62,4": 13, "0,62,3": 11 };
const BRAVO = { "200,62,9": 15, "200,62,4": 13, "200,62,3": 11 };
const asEntries = (lights) => Object.keys(lights).map((k) => JSON.stringify([OW, ...k.split(",").map(Number)]));
const sameSet = (a, b, msg) => assert.deepEqual(new Set(a.map((e) => (typeof e === "string" ? e : JSON.stringify(e)))), new Set(b), msg);

test("crash recovery: recorded light blocks are removed on the next start, unloaded ones once loaded", { skip: NEEDS_REF, timeout: 120000 }, async () => {
  const a = await runScenario({ script: new URL("./torch_scenarios/crash_a.mjs", import.meta.url) });
  assert.deepEqual(a.result.lights, { ...ALPHA, ...BRAVO }, "session 1 lit both rooms");
  sameSet(a.result.stored, asEntries({ ...ALPHA, ...BRAVO }), "every light cell was persisted");
  assert.deepEqual(a.result.errors, []);

  // --- restart 1: far chunk unloaded ---------------------------------------------------
  const b = await runScenario({ script: new URL("./torch_scenarios/reload_b.mjs", import.meta.url), load: a.world });
  assert.deepEqual(b.result.afterStartup.lights, BRAVO, "startup removed every reachable recorded light block");
  assert.equal(b.result.afterStartup.stone, "minecraft:stone", "a recorded cell a player had replaced with stone is left alone");
  assert.equal(b.result.afterStartup.pending, 3);
  assert.deepEqual(b.result.lights, BRAVO, "unloaded cells wait");
  assert.equal(b.result.pending, 3);
  sameSet(b.result.stored, asEntries(BRAVO), "pending cells stay persisted for the next restart");
  assert.deepEqual(b.result.errors, []);

  // --- restart 2: still unloaded at first, then the chunk loads --------------------------
  const c = await runScenario({ script: new URL("./torch_scenarios/reload_c.mjs", import.meta.url), load: b.world });
  assert.equal(c.result.atStart.loaded, false);
  assert.deepEqual(c.result.atStart.lights, BRAVO);
  assert.equal(c.result.atStart.pending, 3, "the second restart still knows the pending cells");
  assert.deepEqual(c.result.afterLoad.lights, {}, "cleared once the chunk is loaded");
  assert.equal(c.result.afterLoad.pending, 0);
  assert.deepEqual(c.result.storedAfterCleanup, [], "persisted list is empty after the cleanup");
  // and the torch works normally after all that
  assert.deepEqual(c.result.relit, { "9,62,0": 15, "4,62,0": 13, "3,62,0": 11 });
  sameSet(c.result.storedRelit, asEntries(c.result.relit));
  assert.deepEqual(c.result.errors, []);
});
