// Smoke test of the script entry point: main.js imports every subsystem, each
// init is wrapped in safe(), and a short session produces no uncaught errors.

import test from "node:test";
import assert from "node:assert/strict";

import { mock } from "./mock/testkit.mjs";
import { world } from "@minecraft/server";
import { getErrorCounts } from "../addon/behavior_pack/scripts/lib/util.js";
import { KIT_ITEMS } from "../addon/behavior_pack/scripts/lib/kit.js";
import { PROPS } from "../addon/behavior_pack/scripts/lib/ids.js";

test("main.js loads, all inits run, a short session is error free", async () => {
  mock.reset();
  mock.fill("minecraft:overworld", { x: -8, y: 60, z: -8 }, { x: 8, y: 63, z: 8 }, "minecraft:grass_block");
  await import("../addon/behavior_pack/scripts/main.js");
  mock.startup();
  const initFailures = [...getErrorCounts().keys()].filter((k) => k.startsWith("init:"));
  assert.deepEqual(initFailures, [], `subsystem init failed: ${initFailures.join(", ")}`);
  const p = mock.addPlayer({ name: "Smoke", location: { x: 0.5, y: 64, z: 0.5 } });
  mock.tick(5);
  assert.equal(p.getDynamicProperty(PROPS.KIT), true);
  const inv = mock.inventory(p);
  const ids = [];
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it) ids.push(it.typeId);
  }
  assert.deepEqual(ids, [...KIT_ITEMS]);
  mock.tick(200);
  assert.equal(world.getAllPlayers().length, 1);
  assert.deepEqual(mock.errors.map((e) => `${e.where}: ${e.error}`), []);
});
