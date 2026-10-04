// Offline logic test: loads the real add-on scripts against the stub runtime and exercises the main flows.
import fs from "node:fs"; import path from "node:path"; import url from "node:url";
const here = path.dirname(url.fileURLToPath(import.meta.url));
const src = path.join(here, "..", "..", "addon", "BunkerArsenal_BP", "scripts"), pkg = path.join(here, "pkg");
fs.rmSync(pkg, { recursive: true, force: true }); fs.cpSync(src, pkg, { recursive: true });
const S = await import("@minecraft/server"); const UI = await import("@minecraft/server-ui");
const { world, state, Player, ItemStack, BlockPermutation, overworld, advance, Entity } = S;
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; throw new Error(m); } else console.log("ok  -", m); };
await import(path.join(pkg, "main.js"));
const p = new Player("Tester", overworld); world.players.push(p); overworld.entities.push(p);
const zombie = new Entity("minecraft:zombie", { x: 0.5, y: 70, z: 8.5 }, overworld); overworld.entities.push(zombie);
// ---- firing a semi-auto pistol
const pistol = new ItemStack("bunker:service_pistol"); p.inv.setItem(0, pistol); p.inv.setItem(1, new ItemStack("bunker:light_magazine", 3));
world.afterEvents.itemUse.emit({ source: p, itemStack: pistol }); await advance(1);
assert(state.damage.some((d) => d[0] === "minecraft:zombie" && d[1] === 4), "pistol hit-scan damaged the zombie for 4");
let held = p.inv.getItem(0); assert(held.getDynamicProperty("bunker:ammo") === 11 && held.lore[0].includes("11/12"), "ammo decremented to 11 with lore");
// ---- empty magazine triggers auto reload consuming one magazine
held.setDynamicProperty("bunker:ammo", 1); await advance(6); world.afterEvents.itemUse.emit({ source: p, itemStack: held }); await advance(40);
assert(p.inv.getItem(1).amount === 2 && p.inv.getItem(0).getDynamicProperty("bunker:ammo") === 12, "auto reload refilled magazine and consumed one Light Magazine");
// ---- automatic weapon: hold to fire, release to stop
const smg = new ItemStack("bunker:wasp_smg"); p.selectedSlotIndex = 2; p.inv.setItem(2, smg); const before = state.damage.length;
world.afterEvents.itemStartUse.emit({ source: p, itemStack: smg }); await advance(10); world.afterEvents.itemStopUse.emit({ source: p, itemStack: smg }); const during = state.damage.length; await advance(10);
assert(during - before >= 4 && state.damage.length === during, `SMG fired ${during - before} rounds while held and stopped on release`);
// ---- shotgun pellets, railgun charge, rocket launcher projectile
p.selectedSlotIndex = 3; p.inv.setItem(3, new ItemStack("bunker:thumper_launcher")); world.afterEvents.itemUse.emit({ source: p, itemStack: p.inv.getItem(3) }); await advance(2);
assert(overworld.entities.some((e) => e.typeId === "bunker:rocket" && e.shotWith), "rocket entity spawned and shot");
p.selectedSlotIndex = 4; p.inv.setItem(4, new ItemStack("bunker:railgun")); const d0 = state.damage.length; world.afterEvents.itemUse.emit({ source: p, itemStack: p.inv.getItem(4) }); await advance(1);
assert(state.damage.length === d0, "railgun does not fire before its charge"); await advance(14); assert(state.damage.length === d0 + 1 && state.damage.at(-1)[1] === 22, "railgun fired after charge for 22");
// ---- attachments via Armory UI (toggle extended magazine on the pistol)
p.selectedSlotIndex = 0; p.inv.setItem(5, new ItemStack("bunker:extended_magazine")); p.inv.setItem(6, new ItemStack("bunker:field_terminal"));
UI.script.queue.push({ canceled: false, selection: 2 }, { canceled: false, formValues: [true] }); world.afterEvents.itemUse.emit({ source: p, itemStack: p.inv.getItem(6) }); await advance(5);
held = p.inv.getItem(0); assert(JSON.parse(held.getDynamicProperty("bunker:atts")).includes("extended_magazine") && held.lore[0].includes("/18"), "extended magazine attached: mag 12 -> 18");
assert(!p.inv.getItem(5), "attachment item consumed from inventory");
// ---- blast door placement, toggle, auto-close, lockdown
const doorPerm = BlockPermutation.resolve("bunker:blast_door", { "minecraft:cardinal_direction": "north", "bunker:half": "lower", "bunker:open": false });
overworld.blocks.set("5,70,5", doorPerm); const doorBlock = overworld.getBlock({ x: 5, y: 70, z: 5 });
world.afterEvents.playerPlaceBlock.emit({ block: doorBlock, player: p }); await advance(1);
assert(overworld.getBlock({ x: 5, y: 71, z: 5 }).permutation.getState("bunker:half") === "upper", "upper door half placed automatically");
world.beforeEvents.playerInteractWithBlock.emit({ block: overworld.getBlock({ x: 5, y: 71, z: 5 }), player: p, cancel: false }); await advance(2);
assert(overworld.getBlock({ x: 5, y: 70, z: 5 }).permutation.getState("bunker:open") === true && overworld.getBlock({ x: 5, y: 71, z: 5 }).permutation.getState("bunker:open") === true, "tapping the upper half opens both halves");
await advance(125); assert(overworld.getBlock({ x: 5, y: 70, z: 5 }).permutation.getState("bunker:open") === false, "door auto-closed after 6 s");
overworld.blocks.set("7,70,7", BlockPermutation.resolve("bunker:control_panel", { "minecraft:cardinal_direction": "north" }));
UI.script.nextResponse = { canceled: false, selection: 2 }; world.beforeEvents.playerInteractWithBlock.emit({ block: overworld.getBlock({ x: 7, y: 70, z: 7 }), player: p, cancel: false }); await advance(40);
assert(JSON.parse(world.getDynamicProperty("bunker:locks")).length === 1, "lockdown registered the door");
world.beforeEvents.playerInteractWithBlock.emit({ block: overworld.getBlock({ x: 5, y: 70, z: 5 }), player: p, cancel: false }); await advance(2);
assert(overworld.getBlock({ x: 5, y: 70, z: 5 }).permutation.getState("bunker:open") === false && p.actionBars.at(-1).includes("LOCKDOWN"), "locked door refuses to open without keycard");
// ---- crate loot
overworld.blocks.set("9,70,9", BlockPermutation.resolve("bunker:weapon_crate", { "bunker:opened": false })); const free = p.inv.emptySlotsCount;
world.beforeEvents.playerInteractWithBlock.emit({ block: overworld.getBlock({ x: 9, y: 70, z: 9 }), player: p, cancel: false }); await advance(2);
assert(p.inv.emptySlotsCount < free && overworld.getBlock({ x: 9, y: 70, z: 9 }).permutation.getState("bunker:opened") === true, "weapon crate gave loot and switched to opened");
// ---- blueprint build (command fails in the stub -> fallback RLE builder) 
p.inv.setItem(7, new ItemStack("bunker:bunker_blueprint")); UI.script.queue.push({ canceled: false, formValues: [1, 8, true] }, { canceled: false, selection: 0 });
const b0 = state.blocksSet; world.afterEvents.itemUse.emit({ source: p, itemStack: p.inv.getItem(7) }); await advance(60);
assert(state.blocksSet - b0 >= 27 * 6 * 13 && !p.inv.getItem(7), `fallback builder placed ${state.blocksSet - b0} blocks (outpost) and consumed the blueprint`);
assert([...overworld.blocks.values()].some((pm) => pm.type.id === "minecraft:trapdoor"), "entrance hatch placed");
assert([...overworld.blocks.values()].some((pm) => pm.type.id === "minecraft:barrel"), "barrels placed by fallback builder");
// ---- welcome kit + medkit
world.afterEvents.playerSpawn.emit({ player: p, initialSpawn: true }); await advance(61);
assert(p.props.get("bunker:kit") === true, "starter kit issued once");
world.afterEvents.itemCompleteUse.emit({ source: p, itemStack: new ItemStack("bunker:medkit") }); await advance(1);
assert(p.health.currentValue === 18, "medkit healed +8");
console.log(`\nALL CHECKS PASSED  (sounds: ${state.sounds.length}, particles: ${state.particles}, blocks set: ${state.blocksSet})`);
