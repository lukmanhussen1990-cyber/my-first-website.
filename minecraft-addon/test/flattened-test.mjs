// Later Minecraft versions split the light block into light_block_0..15.
// Run with MOCK_FLATTENED_LIGHTS=1 to prove the add-on still works there.
import assert from "node:assert/strict";
import * as MC from "@minecraft/server";

const { T, advance, blockAt, overworld, Player, ItemStack } = MC;
assert.ok(process.env.MOCK_FLATTENED_LIGHTS, "run with MOCK_FLATTENED_LIGHTS=1");

await import("../packs/ArcaneArsenal_BP/scripts/main.js");
const p = new Player("Alex", overworld, { x: 0.5, y: 64, z: 0.5 });
p.hold(new ItemStack("minecraft:torch"));
advance(3);
assert.match(blockAt(0, 65, 0)._name, /^minecraft:light_block_1[34]$/, "flattened light placed");
p.location = { x: 3.5, y: 64, z: 0.5 };
advance(2);
assert.equal(blockAt(0, 65, 0)._name, "minecraft:air", "old flattened light removed");
p.hold(undefined);
advance(2);
assert.equal(blockAt(3, 65, 0)._name, "minecraft:air");
assert.deepEqual(T.errors.map(String), []);
console.log("  ✔ newer versions: works with light_block_0..15 ids");
