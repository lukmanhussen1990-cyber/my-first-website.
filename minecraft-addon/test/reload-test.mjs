// Simulates re-opening a world that was closed while holding a torch:
// the add-on must remove its own leftover light blocks - and only its own.
import assert from "node:assert/strict";
import * as MC from "@minecraft/server";

const { T, advance, setBlock, blockAt, overworld, Player } = MC;
const OW = "minecraft:overworld";

setBlock(OW, 4, 65, 4, "minecraft:light_block", { block_light_level: 14 }); // left over by us
setBlock(OW, 9, 65, 9, "minecraft:light_block", { block_light_level: 7 }); // a map maker's light
setBlock(OW, 400, 65, 0, "minecraft:light_block", { block_light_level: 14 }); // ours, chunk not loaded yet
T.worldProps.set("arcane:light_blocks", JSON.stringify([[OW, 4, 65, 4], [OW, 400, 65, 0]]));

await import("../packs/ArcaneArsenal_BP/scripts/main.js");
new Player("Alex", overworld, { x: 0.5, y: 64, z: 0.5 });
advance(45);

assert.equal(blockAt(4, 65, 4)._name, "minecraft:air", "leftover light removed");
assert.equal(blockAt(9, 65, 9)._name, "minecraft:light_block", "foreign light untouched");
assert.deepEqual(JSON.parse(T.worldProps.get("arcane:light_blocks")), [[OW, 400, 65, 0]], "unloaded one remembered");

T.unloadedBeyond = 1000; // player travels there, chunk loads
advance(45);
assert.equal(blockAt(400, 65, 0)._name, "minecraft:air", "removed once loaded");
assert.deepEqual(JSON.parse(T.worldProps.get("arcane:light_blocks")), []);
assert.deepEqual(T.errors.map(String), []);
console.log("  ✔ reload cleanup: leftovers removed, foreign lights kept");
