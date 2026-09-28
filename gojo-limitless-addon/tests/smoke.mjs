// Headless smoke test: loads the real addon scripts against a functional mock of
// the Script API and plays through every technique.
// Run: node tests/smoke.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const BP = path.join(ROOT, "packs", "Gojo_Limitless_BP");

// ---- sandbox: copy scripts next to a node_modules that maps the Script API to mocks
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gojo-smoke-"));
fs.cpSync(path.join(BP, "scripts"), path.join(tmp, "scripts"), { recursive: true });
for (const [mod, file] of [["server", "server.js"], ["server-ui", "server-ui.js"]]) {
  const dir = path.join(tmp, "node_modules", "@minecraft", mod);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: `@minecraft/${mod}`, type: "module", main: "index.js" }));
  fs.writeFileSync(path.join(dir, "index.js"), `export * from ${JSON.stringify(pathToFileURL(path.join(HERE, "mock", file)).href)};\n`);
}
fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ type: "module" }));

const warnings = [];
const origWarn = console.warn;
console.warn = (...a) => {
  warnings.push(a.join(" "));
};

const S = await import(pathToFileURL(path.join(HERE, "mock", "server.js")).href);
const UI = await import(pathToFileURL(path.join(HERE, "mock", "server-ui.js")).href);
const itemIds = fs.readdirSync(path.join(BP, "items")).map((f) => JSON.parse(fs.readFileSync(path.join(BP, "items", f), "utf8"))["minecraft:item"].description.identifier);
S.__registerItems(itemIds);
await import(pathToFileURL(path.join(tmp, "scripts", "main.js")).href);

const { __test, Player, Entity, world, system, log, ItemStack } = S;
const dim = __test.overworld;
let failures = 0;
let passes = 0;
function check(name, cond, extra = "") {
  if (cond) {
    passes++;
    console.log("  PASS", name);
  } else {
    failures++;
    console.log("  FAIL", name, extra);
  }
}
const tickAdvance = (n) => __test.advance(n);
const settle = () => new Promise((r) => setTimeout(r, 0));

// ---- world setup
const p = new Player("Gojo", { x: 0.5, y: 60, z: 0.5 }, dim);
p.yaw = 0; // looking +z
p.pitch = 0;
world.afterEvents.playerSpawn.__fire({ player: p, initialSpawn: true });
tickAdvance(25);
check("intro chat message on first join", log.messages.some((m) => m.m.includes("Limitless Addon")));

const selfHits = () => p.damageLog.filter((d) => d.by === p.id).length;
function hold(id) {
  p.inventory.setItem(p.selectedSlot, new ItemStack(id));
}
function use(id) {
  hold(id);
  world.afterEvents.itemUse.__fire({ itemStack: new ItemStack(id), source: p });
}
function zombies(n, z0, spread = 1.2, health = 20) {
  const list = [];
  for (let i = 0; i < n; i++) {
    list.push(new Entity("minecraft:zombie", { x: 0.5 + (i - n / 2) * spread, y: 60, z: z0 + (i % 2) }, dim, { families: ["mob", "monster", "zombie", "undead"], health }));
  }
  return list;
}
const particlesSince = (t, id) => log.particles.filter((x) => x.tick >= t && x.id === id).length;
const clearMobs = () => {
  for (const e of dim.entities) if (e.typeId !== "minecraft:player") e.valid = false;
};

// ---- 1. Transformation
console.log("Transformation");
let t0 = __test.tick;
use("gojo:transformation");
tickAdvance(2);
const LOADOUT = ["gojo:infinity", "gojo:lapse_blue", "gojo:reversal_red", "gojo:hollow_purple", "gojo:unlimited_void", "gojo:six_eyes", "gojo:teleport", "gojo:reverse_cursed_technique", "gojo:black_flash"];
check("nine techniques on the hotbar in order", LOADOUT.every((id, i) => p.inventory.slots[i]?.typeId === id), JSON.stringify(p.inventory.slots.slice(0, 9).map((s) => s?.typeId)));
check("transformation item kept in the inventory", p.inventory.slots.some((s) => s?.typeId === "gojo:transformation"));
check("techniques have lore + keepOnDeath", p.inventory.slots[1]?.lore.length > 0 && p.inventory.slots[1]?.keepOnDeath === true);
check("blindfold equipped on head", p.equipment.Head?.typeId === "gojo:blindfold");
check("buffs: speed II, strength II, jump, haste", p.getEffect("speed")?.amplifier === 1 && p.getEffect("strength")?.amplifier === 1 && p.getEffect("jump_boost") && p.getEffect("haste"));
check("Infinity auto-enabled (resistance IV)", p.getEffect("resistance")?.amplifier === 3 && p.getDynamicProperty("gojo:infinity") === true);
check("transform title + particles + cooldown overlay", log.titles.some((x) => x.title.includes("HONORED")) && particlesSince(t0, "gojo:transform_burst") === 1 && log.cooldowns.some((c) => c.item === "gojo:transformation"));
check("cast pose animation played", p.animations.includes("animation.gojo.transform"));
tickAdvance(5);
check("aura particles while transformed", particlesSince(t0, "gojo:aura") > 0);
check("HUD shows the held technique", log.actionbar.length > 0);

// ---- 2. Lapse: Blue
console.log("Lapse: Blue");
clearMobs();
let mobs = zombies(4, 7);
t0 = __test.tick;
p.selectedSlot = 1;
use("gojo:lapse_blue");
tickAdvance(10);
const pulledCloser = mobs.some((m) => m.velocity.z < -0.05 || m.location.z < 7);
tickAdvance(80);
check("singularity particle spawned", particlesSince(t0, "gojo:blue_singularity") === 1);
check("mobs were pulled toward the centre", pulledCloser);
check("mobs took crushing damage", mobs.every((m) => m.damageLog.length > 0), mobs.map((m) => m.health).join(","));
check("collapse effect at the end", particlesSince(t0, "gojo:blue_collapse") === 1);
check("cooldown overlay started", log.cooldowns.some((c) => c.item === "gojo:lapse_blue" && c.tick >= t0));
const blueParticlesBefore = particlesSince(t0, "gojo:blue_singularity");
use("gojo:lapse_blue");
tickAdvance(2);
check("second cast within cooldown is blocked", particlesSince(t0, "gojo:blue_singularity") === blueParticlesBefore);

// ---- 3. Reversal: Red
console.log("Reversal: Red");
clearMobs();
mobs = zombies(3, 12);
t0 = __test.tick;
p.selectedSlot = 2;
use("gojo:reversal_red");
tickAdvance(30);
check("red charge + orb particles", particlesSince(t0, "gojo:red_charge") >= 8 && particlesSince(t0, "gojo:red_orb") >= 1);
check("explosion on impact", particlesSince(t0, "gojo:red_explosion") === 1);
check("area damage to all targets", mobs.every((m) => m.damageLog.length > 0), mobs.map((m) => m.health).join(","));
check("massive knockback applied", mobs.some((m) => m.location.z > 13 || Math.abs(m.location.x) > 3));

// ---- 4. Hollow Purple
console.log("Hollow Purple");
clearMobs();
mobs = zombies(4, 25, 1.5);
const boss = new Entity("minecraft:warden", { x: 0.5, y: 60, z: 45 }, dim, { families: ["mob", "monster"], health: 500 });
t0 = __test.tick;
p.selectedSlot = 3;
use("gojo:hollow_purple");
tickAdvance(10);
use("gojo:reversal_red");
tickAdvance(1);
check("other techniques blocked while charging", particlesSince(t0, "gojo:red_charge") === 0);
tickAdvance(90);
check("blue + red charge orbs", particlesSince(t0, "gojo:purple_charge_blue") >= 20 && particlesSince(t0, "gojo:purple_charge_red") >= 20);
check("merge flash", particlesSince(t0, "gojo:purple_merge") === 1);
check("purple mass travelled", particlesSince(t0, "gojo:purple_orb") >= 30);
check("path mobs erased", mobs.every((m) => !m.isValid() || m.health <= 0), mobs.map((m) => m.health).join(","));
check("boss takes devastating damage (>=45%)", boss.health <= 500 - 225 + 0.01, String(boss.health));
check("final burst", particlesSince(t0, "gojo:purple_burst") === 1);
check("cinematic title", log.titles.some((x) => x.title.includes("HOLLOW PURPLE")));
check("caster never hit by own technique", selfHits() === 0);

// ---- 5. Unlimited Void
console.log("Unlimited Void");
clearMobs();
mobs = zombies(4, 5);
const dog = new Entity("minecraft:wolf", { x: 3, y: 60, z: 3 }, dim, { tamed: true });
t0 = __test.tick;
p.selectedSlot = 4;
use("gojo:unlimited_void");
tickAdvance(30);
check("domain title for everyone inside", log.titles.some((x) => x.title.includes("DOMAIN EXPANSION")));
check("enemies paralysed (slowness 255 + weakness 255)", mobs.every((m) => m.getEffect("slowness")?.amplifier === 255 && m.getEffect("weakness")?.amplifier === 255));
check("tamed pet spared", !dog.getEffect("slowness"));
check("void dome + stars + galaxy", particlesSince(t0, "gojo:void_dome_med") >= 1 && particlesSince(t0, "gojo:void_stars_med") >= 1 && particlesSince(t0, "gojo:void_galaxy") >= 1);
check("void fog pushed", log.commands.some((c) => c.cmd.startsWith("fog @s push gojo:unlimited_void")));
check("caster buffed inside the domain (strength III)", p.getEffect("strength")?.amplifier === 2);
const hpMid = mobs[0].health;
tickAdvance(260);
check("damage over time inside the domain", mobs[0].health < hpMid || !mobs[0].isValid());
check("domain collapsed after 12 s", particlesSince(t0, "gojo:void_collapse") === 1);
check("fog removed", log.commands.some((c) => c.cmd.startsWith("fog @s remove")));
check("caster buffs back to normal", p.getEffect("strength")?.amplifier === 1);

// ---- 6. Six Eyes
console.log("Six Eyes");
clearMobs();
mobs = zombies(2, 8);
t0 = __test.tick;
p.selectedSlot = 5;
use("gojo:six_eyes");
tickAdvance(25);
check("six eyes on: night vision", !!p.getEffect("night_vision"));
check("blindfold lifted (glowing eyes variant)", p.equipment.Head?.typeId === "gojo:blindfold_lifted");
check("eye sigil + eye trails + enemy markers", particlesSince(t0, "gojo:six_eyes_open") === 1 && particlesSince(t0, "gojo:six_eyes_trail") > 0 && particlesSince(t0, "gojo:six_eyes_mark") + particlesSince(t0, "gojo:six_eyes_focus") > 0);
check("target analysis on the HUD", log.actionbar.some((a) => a.tick >= t0 && a.text.includes("HP")));
tickAdvance(25);
use("gojo:six_eyes");
tickAdvance(2);
check("six eyes off: blindfold lowered", p.equipment.Head?.typeId === "gojo:blindfold");

// ---- 7. Teleport
console.log("Teleport");
clearMobs();
const before = { ...p.location };
t0 = __test.tick;
p.selectedSlot = 6;
use("gojo:teleport");
tickAdvance(2);
check("teleported forward", p.location.z > before.z + 10, JSON.stringify(p.location));
check("blue particles at departure and arrival", particlesSince(t0, "gojo:teleport_burst") === 2);
const target = new Entity("minecraft:zombie", { x: p.location.x, y: 60, z: p.location.z + 10 }, dim, { families: ["mob", "monster"] });
target.yaw = 180; // facing the player
tickAdvance(35);
use("gojo:teleport");
tickAdvance(2);
check("teleport behind the enemy", p.location.z > target.location.z, JSON.stringify(p.location));

// ---- 8. Reverse Cursed Technique
console.log("Reverse Cursed Technique");
p.getComponent("minecraft:health").setCurrentValue(4);
tickAdvance(1);
const low = p.health;
p.addEffect("poison", 200, { amplifier: 1 });
t0 = __test.tick;
p.selectedSlot = 7;
use("gojo:reverse_cursed_technique");
tickAdvance(45);
check("health regenerated (10 hearts)", p.health >= Math.min(20, low + 16), `${low} -> ${p.health}`);
check("poison cleansed", !p.getEffect("poison"));
check("healing particles", particlesSince(t0, "gojo:rct_aura") > 5 && particlesSince(t0, "gojo:rct_burst") === 2);

// ---- 9. Black Flash
console.log("Black Flash");
clearMobs();
p.yaw = 0;
p.pitch = 0;
const bf = new Entity("minecraft:zombie", { x: p.location.x, y: 60, z: p.location.z + 5 }, dim, { families: ["mob", "monster"], health: 60 });
t0 = __test.tick;
p.selectedSlot = 8;
use("gojo:black_flash");
tickAdvance(2);
check("dash + strike damage", bf.damageLog.some((d) => d.amount >= 16), JSON.stringify(bf.damageLog));
check("black/red flash particles", particlesSince(t0, "gojo:black_flash") === 1);
tickAdvance(81);
hold("gojo:black_flash");
world.afterEvents.entityHitEntity.__fire({ damagingEntity: p, hitEntity: bf });
tickAdvance(5);
check("melee hit triggers Black Flash (chain x2)", particlesSince(t0, "gojo:black_flash") === 2 && log.actionbar.some((a) => a.text.includes("x2")));

// ---- 10. Infinity
console.log("Infinity");
clearMobs();
p.yaw = 0;
p.pitch = 0;
const skeleton = new Entity("minecraft:skeleton", { x: p.location.x, y: 60, z: p.location.z + 12 }, dim, { families: ["mob", "monster"] });
const arrow = new Entity("minecraft:arrow", { x: p.location.x, y: 61, z: p.location.z + 6 }, dim, { noHealth: true, families: [], owner: skeleton });
arrow.velocity = { x: 0, y: 0, z: -1.2 };
t0 = __test.tick;
tickAdvance(8);
const arrowDist = Math.abs(arrow.location.z - p.location.z);
check("projectile slowed and stopped before contact", arrowDist > 1.2, String(arrowDist));
tickAdvance(40);
check("held projectile dissolves", !arrow.isValid());
check("ripple shown on the barrier", particlesSince(t0, "gojo:infinity_ripple") > 0);
const brute = new Entity("minecraft:zombie", { x: p.location.x, y: 60, z: p.location.z + 1.2 }, dim, { families: ["mob", "monster"] });
tickAdvance(4);
check("melee attacker pushed back / slowed", !!brute.getEffect("slowness") && (brute.velocity.z > 0 || brute.location.z - p.location.z > 1.2));
const hpBefore = p.health;
p.applyDamage(5, { cause: "entityAttack", damagingEntity: brute });
tickAdvance(1);
check("attack that connected is nullified", p.health === hpBefore, `${hpBefore} -> ${p.health}`);
p.applyDamage(2, { cause: "fall" });
tickAdvance(1);
check("environmental damage still applies (reduced)", p.health < hpBefore);
p.selectedSlot = 0;
use("gojo:infinity");
tickAdvance(2);
check("Infinity toggles off", p.getDynamicProperty("gojo:infinity") === false && p.getEffect("resistance")?.amplifier === 0);
tickAdvance(25);
use("gojo:infinity");
tickAdvance(2);
check("Infinity toggles back on", p.getDynamicProperty("gojo:infinity") === true);

// ---- 11. Touch fallbacks
console.log("Touch controls");
clearMobs();
p.yaw = 0;
p.pitch = 0;
const onBlock = new Entity("minecraft:zombie", { x: p.location.x, y: 60, z: p.location.z + 6 }, dim, { families: ["mob", "monster"] });
tickAdvance(200);
t0 = __test.tick;
hold("gojo:lapse_blue");
world.afterEvents.itemUseOn.__fire({ itemStack: new ItemStack("gojo:lapse_blue"), source: p, block: dim.getBlock({ x: 0, y: 59, z: 5 }), blockFace: "Up", faceLocation: { x: 0.5, y: 1, z: 0.5 } });
world.afterEvents.itemUse.__fire({ itemStack: new ItemStack("gojo:lapse_blue"), source: p });
tickAdvance(2);
check("tap on a block casts (and one tap = one cast)", particlesSince(t0, "gojo:blue_singularity") === 1);
tickAdvance(130);
const tapTarget = new Entity("minecraft:zombie", { x: p.location.x, y: 60, z: p.location.z + 3 }, dim, { families: ["mob", "monster"] });
hold("gojo:reversal_red");
world.afterEvents.entityHitEntity.__fire({ damagingEntity: p, hitEntity: tapTarget });
tickAdvance(20);
check("tap on a mob casts the held technique", particlesSince(t0, "gojo:red_explosion") === 1);
hold("gojo:six_eyes");
world.afterEvents.entityHitEntity.__fire({ damagingEntity: p, hitEntity: tapTarget });
tickAdvance(2);
check("hitting with a toggle does not toggle it", p.getDynamicProperty("gojo:six_eyes") === false);

// ---- 12. Menu, settings, release
console.log("Menu");
system.afterEvents.scriptEventReceive.__fire({ id: "gojo:menu", sourceEntity: p, message: "" });
await settle();
check("menu opens with technique icons", UI.uiLog.shown.some((f) => f.kind === "action" && f.buttons.some((b) => b.icon === "textures/items/gojo/transformation")));
UI.__respond({ canceled: false, selection: 4 }); // Settings
system.afterEvents.scriptEventReceive.__fire({ id: "gojo:menu", sourceEntity: p, message: "" });
UI.__respond({ canceled: false, formValues: [0, true, false, true, true, false, true] });
await settle();
await settle();
tickAdvance(1);
check("settings saved (quality Low, destruction on, pvp off)", world.getDynamicProperty("gojo:cfg_quality") === 0 && world.getDynamicProperty("gojo:cfg_destruction") === true && world.getDynamicProperty("gojo:cfg_pvp") === false);
p.isSneaking = true;
tickAdvance(80);
use("gojo:transformation");
tickAdvance(2);
await settle();
check("sneak + tap opens the menu", UI.uiLog.shown.length >= 3);
p.isSneaking = false;
system.afterEvents.scriptEventReceive.__fire({ id: "gojo:release", sourceEntity: p, message: "" });
tickAdvance(2);
check("release removes the techniques", !p.inventory.slots.some((s) => s && LOADOUT.includes(s.typeId)));
check("release removes the blindfold we equipped", !p.equipment.Head);
check("release removes buffs", !p.getEffect("speed") && !p.getEffect("strength"));

// ---- 13. Terrain destruction (enabled above) keeps a safe zone around the caster
console.log("Terrain destruction");
system.afterEvents.scriptEventReceive.__fire({ id: "gojo:transform", sourceEntity: p, message: "" });
tickAdvance(40);
clearMobs();
p.pitch = 20; // aim slightly down
const blocksBefore = log.blocks ?? 0;
hold("gojo:hollow_purple");
world.afterEvents.itemUse.__fire({ itemStack: new ItemStack("gojo:hollow_purple"), source: p });
tickAdvance(100);
const under = dim.getBlock({ x: Math.floor(p.location.x), y: 59, z: Math.floor(p.location.z) });
check("Hollow Purple carves terrain when enabled", (log.blocks ?? 0) > blocksBefore);
check("block under the caster is never erased", under && !under.isAir);
check("bedrock untouched", dim.blockAt({ x: 0, y: -64, z: 0 }) === "minecraft:bedrock");

// ---- 14. Death & safety
console.log("Safety");
check("caster never damaged by own techniques", selfHits() === 0);
check("no script errors logged", warnings.length === 0, "\n" + warnings.join("\n"));

console.warn = origWarn;
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
