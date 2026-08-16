import { KNOWN_BLOCKS, world, system, players, pump, commandLog } from "@minecraft/server";
import { B, ALT } from "../src/luxury_tech_house_bp/scripts/config.js";

for (const k of Object.keys(B)) { KNOWN_BLOCKS.add(B[k]); for (const a of ALT[k] ?? []) KNOWN_BLOCKS.add(a); }
KNOWN_BLOCKS.add("minecraft:air");

const dimension = world.getDimension("minecraft:overworld");
const chat = [];
function mkPlayer(id) {
  return { id, typeId: "minecraft:player", dimension, location: { x: 100, y: 70, z: 100 },
    sendMessage: (m) => chat.push(m),
    onScreenDisplay: { setActionBar: () => {}, setTitle: () => {} },
    playSound: () => {}, teleport: () => {} };
}
const player = mkPlayer("p1");
players.push(player);
await import("../src/luxury_tech_house_bp/scripts/main.js");
pump(1);

function reset() { chat.length = 0; commandLog.length = 0; }
function fills() { return commandLog.filter((c) => c.startsWith("fill ") || c.startsWith("setblock ")).length; }

const results = [];
function check(name, ok, detail = "") { results.push([ok, name, detail]); }

// 1. itemUse (mid-air long press)
reset();
world.afterEvents.itemUse.emit({ source: player, itemStack: { typeId: "lux:house_builder" } });
pump(4000);
check("itemUse triggers build", fills() > 2000, `${fills()} block ops`);

// 2. itemUseOn (tap a block on touch) - fresh player to dodge the debounce
const p2 = mkPlayer("p2"); players.push(p2);
reset();
world.afterEvents.itemUseOn.emit({ source: p2, itemStack: { typeId: "lux:house_builder" },
  block: { location: { x: 100, y: 69, z: 100 }, typeId: "minecraft:grass_block" } });
pump(4000);
check("itemUseOn triggers build", fills() > 2000, `${fills()} block ops`);

// 3. playerInteractWithBlock (absent on 1.21.0 / @minecraft/server 1.11.0)
const hasInteract = !!world.beforeEvents.playerInteractWithBlock;
if (hasInteract) {
  const p3 = mkPlayer("p3"); players.push(p3);
  reset();
  world.beforeEvents.playerInteractWithBlock.emit({ player: p3, itemStack: { typeId: "lux:house_builder" },
    block: { location: { x: 100, y: 69, z: 100 }, typeId: "minecraft:grass_block" }, cancel: false });
  pump(4000);
  check("playerInteractWithBlock triggers build", fills() > 2000, `${fills()} block ops`);
} else {
  check("missing playerInteractWithBlock does not break loading", true, "signal absent, module still loaded");
}

// 4. /scriptevent lux:build
const p4 = mkPlayer("p4"); players.push(p4);
reset();
system.afterEvents.scriptEventReceive.emit({ id: "lux:build", sourceEntity: p4 });
pump(4000);
check("scriptevent lux:build triggers build", fills() > 2000, `${fills()} block ops`);

// 5. debounce: one tap delivered on three channels must build once
const p5 = mkPlayer("p5"); players.push(p5);
reset();
const stack = { typeId: "lux:house_builder" };
const blk = { location: { x: 100, y: 69, z: 100 }, typeId: "minecraft:grass_block" };
world.afterEvents.itemUse.emit({ source: p5, itemStack: stack });
world.afterEvents.itemUseOn.emit({ source: p5, itemStack: stack, block: blk });
if (hasInteract) {
  world.beforeEvents.playerInteractWithBlock.emit({ player: p5, itemStack: stack, block: blk, cancel: false });
}
pump(4000);
const n5 = fills();
check("triple-delivered tap builds exactly once", n5 > 2000 && n5 < 4000, `${n5} block ops (one build ~2300)`);

// 6. commands blocked -> player is told why
const p6 = mkPlayer("p6");
p6.dimension = { id: "minecraft:overworld", runCommand() { throw new Error("commands are disabled"); },
                 getBlock: () => null };
players.push(p6);
reset();
world.afterEvents.itemUse.emit({ source: p6, itemStack: { typeId: "lux:house_builder" } });
pump(4000);
const told = chat.some((m) => m.includes("Build failed")) && chat.some((m) => m.includes("Cheats"));
check("blocked commands produce a clear message", told, chat.filter(m=>m.includes("Build")||m.includes("Cheats")).join(" ").slice(0,110));

// 7. a non-tool item is ignored
const p7 = mkPlayer("p7"); players.push(p7);
reset();
world.afterEvents.itemUse.emit({ source: p7, itemStack: { typeId: "minecraft:diamond_sword" } });
pump(50);
check("unrelated item ignored", fills() === 0, `${fills()} block ops`);

console.log(`\n--- @minecraft/server ${process.env.MC_API ?? "current"} ---`);
let pass = 0;
for (const [ok, name, detail] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  [" + detail + "]" : ""}`);
  if (ok) pass++;
}
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
