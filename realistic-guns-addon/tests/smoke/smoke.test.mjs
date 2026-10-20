// Smoke test for the gameplay script: run `node --import ./tests/smoke/register.mjs tests/smoke/smoke.test.mjs`
// (after `python3 tools/build.py`). Uses a small mock of @minecraft/server (mock-server.mjs).
import { world, system, Player, Dimension, Entity, log } from "@minecraft/server";
const dim = new Dimension();
const p = new Player(dim);
world.players.push(p);
await import("../../packs/RealisticGuns_BP/scripts/main.js");
const { GUNS } = await import("../../packs/RealisticGuns_BP/scripts/gun_data.js");
let failures = 0;
function check(cond, msg) { if (!cond) { failures++; console.log("FAIL:", msg); } else console.log("ok:", msg); }
function hold(id) { p.slots[0] = { typeId: id, amount: 1 }; }
function step(n = 1) { for (let i = 0; i < n; i++) system.step(); }
// --- AK-47 full auto ---
hold("rg:ak47"); step(6);
world.afterEvents.itemStartUse.fire({ source: p, itemStack: { typeId: "rg:ak47" } });
world.afterEvents.itemUse.fire({ source: p, itemStack: { typeId: "rg:ak47" } });
step(20);
world.afterEvents.itemStopUse.fire({ source: p, itemStack: { typeId: "rg:ak47" } });
const ak = p.getDynamicProperty("rg:ammo_ak47");
check(ak === 30 - 11, `AK fired 11 rounds in 1s at 600rpm (ammo now ${ak})`);
check(dim.entities.filter(e => e.typeId === "rg:bullet").length === 11, "11 bullet entities spawned");
check(p.cooldowns["rg_kick"] === 3, "kick cooldown started");
check(p.rotation.x < 0, `recoil raised aim (pitch ${p.rotation.x.toFixed(2)})`);
check(dim.sounds.includes("rg.ak47.fire"), "fire sound played");
step(30);
check(dim.entities.filter(e => e.typeId === "rg:bullet" && e.isValid).length === 0, "bullets despawn after their range");
// --- reload: needs a magazine in survival ---
p.isSneaking = true;
world.afterEvents.itemStartUse.fire({ source: p, itemStack: { typeId: "rg:ak47" } });
world.afterEvents.itemStopUse.fire({ source: p, itemStack: { typeId: "rg:ak47" } });
check(/No AK-47 Magazine/.test(p.actionbar), "reload without magazine shows hint: " + p.actionbar);
p.slots[5] = { typeId: "rg:mag_ak47", amount: 2 };
step(40);
world.afterEvents.itemStartUse.fire({ source: p, itemStack: { typeId: "rg:ak47" } });
world.afterEvents.itemStopUse.fire({ source: p, itemStack: { typeId: "rg:ak47" } });
check(p.cooldowns["rg_reload"] === 50, "reload started (cooldown 50 ticks)");
step(51);
check(p.getDynamicProperty("rg:ammo_ak47") === 30, "magazine refilled to 30");
check(p.slots[5]?.amount === 1, "one magazine consumed");
p.isSneaking = false;
// --- semi auto pistol: one shot per press ---
hold("rg:deagle"); step(6);
world.afterEvents.itemStartUse.fire({ source: p, itemStack: { typeId: "rg:deagle" } });
step(20);
world.afterEvents.itemStopUse.fire({ source: p, itemStack: { typeId: "rg:deagle" } });
check(p.getDynamicProperty("rg:ammo_deagle") === 6, "deagle semi-auto fired exactly once while held");
// pulse mode (no chargeable events): repeated itemUse taps
for (let i = 0; i < 3; i++) { world.afterEvents.itemUse.fire({ source: p, itemStack: { typeId: "rg:deagle" } }); step(6); }
check(p.getDynamicProperty("rg:ammo_deagle") === 3, `deagle fired once per tap in pulse mode (${p.getDynamicProperty("rg:ammo_deagle")})`);
// --- hits: entity damage incl. hurt immunity ---
const zombie = new Entity("minecraft:zombie", dim, { x: 0, y: 64, z: 5 });
zombie.components["minecraft:health"] = { currentValue: 20, setCurrentValue(v) { this.currentValue = v; return true; } };
hold("rg:m4a1"); step(6);
world.afterEvents.itemStartUse.fire({ source: p, itemStack: { typeId: "rg:m4a1" } });
step(1);
const shots = dim.entities.filter(e => e.typeId === "rg:bullet" && e.isValid);
let hits = 0;
for (const b of shots.slice(0, 3)) {
  world.afterEvents.projectileHitEntity.fire({ projectile: b, source: p, dimension: dim, location: { x: 0, y: 64.8, z: 5 }, hitVector: {x:0,y:0,z:1}, getEntityHit: () => ({ entity: zombie }) });
  hits++;
}
world.afterEvents.itemStopUse.fire({ source: p, itemStack: { typeId: "rg:m4a1" } });
check(Math.abs(zombie.components["minecraft:health"].currentValue - (20 - 3 * 6)) < 0.01,
  `3 rapid M4 hits deal full damage despite hurt immunity (hp ${zombie.components["minecraft:health"].currentValue})`);
// --- block damage ---
const glass = { typeId: "minecraft:glass", location: { x: 3, y: 64, z: 9 }, dimension: dim, center: () => ({x:3.5,y:64.5,z:9.5}), setType() {} };
hold("rg:glock17"); step(6);
world.afterEvents.itemStartUse.fire({ source: p, itemStack: { typeId: "rg:glock17" } });
world.afterEvents.itemStopUse.fire({ source: p, itemStack: { typeId: "rg:glock17" } });
step(1);
const gb = dim.entities.filter(e => e.typeId === "rg:bullet" && e.isValid).pop();
world.afterEvents.projectileHitBlock.fire({ projectile: gb, source: p, dimension: dim, location: { x: 3.5, y: 64.5, z: 9 }, hitVector: {x:0,y:0,z:1}, getBlockHit: () => ({ block: glass, face: "North", faceLocation: { x: 0.5, y: 0.5, z: 0 } }) });
check(dim.commands.some(c => c === "setblock 3 64 9 air destroy"), "glass shatters from one bullet");
const stone = { typeId: "minecraft:stone", location: { x: 4, y: 64, z: 9 }, dimension: dim, center: () => ({x:4.5,y:64.5,z:9.5}), setType() {} };
let broke = 0;
for (let i = 0; i < 6; i++) {
  hold("rg:glock17"); step(5);
  world.afterEvents.itemStartUse.fire({ source: p, itemStack: { typeId: "rg:glock17" } });
  world.afterEvents.itemStopUse.fire({ source: p, itemStack: { typeId: "rg:glock17" } });
  step(1);
  const b = dim.entities.filter(e => e.typeId === "rg:bullet" && e.isValid).pop();
  if (!b) continue;
  world.afterEvents.projectileHitBlock.fire({ projectile: b, source: p, dimension: dim, location: { x: 4.5, y: 64.5, z: 9 }, hitVector: {x:0,y:0,z:1}, getBlockHit: () => ({ block: stone, face: "North", faceLocation: { x: 0.5, y: 0.5, z: 0 } }) });
  if (dim.commands.includes("setblock 4 64 9 air destroy")) { broke = i + 1; break; }
}
check(broke === 5, `stone breaks after 5 Glock hits (broke after ${broke})`);
const bedrock = { typeId: "minecraft:bedrock", location: { x: 5, y: 64, z: 9 }, dimension: dim, center: () => ({x:5.5,y:64.5,z:9.5}), setType() {} };
hold("rg:barrett"); step(6);
world.afterEvents.itemStartUse.fire({ source: p, itemStack: { typeId: "rg:barrett" } });
world.afterEvents.itemStopUse.fire({ source: p, itemStack: { typeId: "rg:barrett" } });
step(1);
const bb = dim.entities.filter(e => e.typeId === "rg:bullet" && e.isValid).pop();
world.afterEvents.projectileHitBlock.fire({ projectile: bb, source: p, dimension: dim, location: { x: 5.5, y: 64.5, z: 9 }, hitVector: {x:0,y:0,z:1}, getBlockHit: () => ({ block: bedrock, face: "North", faceLocation: { x: 0.5, y: 0.5, z: 0 } }) });
check(!dim.commands.some(c => c.startsWith("setblock 5 64 9")), "bedrock is immune");
// toggle
system.afterEvents.scriptEventReceive.fire({ id: "rg:blockdamage", message: "off", sourceEntity: p });
check(world.props["rg:block_damage"] === false, "block damage can be switched off");
system.afterEvents.scriptEventReceive.fire({ id: "rg:blockdamage", message: "on", sourceEntity: p });
// --- sniper zoom ---
hold("rg:awp"); step(6);
p.isSneaking = true; step(2);
check(p.commands.some(c => c.startsWith("camera @s fov_set 24")), "AWP zooms in while sneaking");
p.isSneaking = false; step(2);
check(p.commands.some(c => c.startsWith("camera @s fov_clear")), "AWP zooms out when standing up");
// --- shotgun: 8 pellets, shell reload ---
hold("rg:spas12"); step(6);
const before = dim.entities.length;
world.afterEvents.itemStartUse.fire({ source: p, itemStack: { typeId: "rg:spas12" } });
world.afterEvents.itemStopUse.fire({ source: p, itemStack: { typeId: "rg:spas12" } });
check(dim.entities.length - before === 8, "SPAS-12 fires 8 pellets");
p.slots[6] = { typeId: "rg:shell_12g", amount: 5 };
p.isSneaking = true; step(15);
world.afterEvents.itemStartUse.fire({ source: p, itemStack: { typeId: "rg:spas12" } });
world.afterEvents.itemStopUse.fire({ source: p, itemStack: { typeId: "rg:spas12" } });
p.isSneaking = false;
step(13);
check(p.getDynamicProperty("rg:ammo_spas12") === 8 && p.slots[6].amount === 4, `one shell loaded per cycle (ammo ${p.getDynamicProperty("rg:ammo_spas12")}, shells ${p.slots[6]?.amount})`);
// --- every gun can fire without throwing ---
for (const id of Object.keys(GUNS)) {
  hold(id); step(8);
  p.props["rg:ammo_" + GUNS[id].id] = GUNS[id].capacity;
  world.afterEvents.itemStartUse.fire({ source: p, itemStack: { typeId: id } });
  step(3);
  world.afterEvents.itemStopUse.fire({ source: p, itemStack: { typeId: id } });
  check(p.getDynamicProperty("rg:ammo_" + GUNS[id].id) < GUNS[id].capacity, id + " fires");
}
console.log(failures ? `${failures} FAILURES` : "ALL SMOKE TESTS PASSED");
process.exitCode = failures ? 1 : 0;
console.log("hud sample:", p.actionbar);
