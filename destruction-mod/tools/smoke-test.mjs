// Smoke test: runs the real add-on scripts against a fake Minecraft world
// (tools/mock) and drives every weapon, target mode and menu.
//
//   node tools/smoke-test.mjs
//
// It can't prove how things look in game, but it catches crashes, bad API
// input, broken menus and runaway per-tick work.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const src = path.join(root, "packs", "DestructionMod_BP", "scripts");
const out = path.join(root, "build", "test-scripts");
const serverUrl = pathToFileURL(path.join(here, "mock", "server.mjs")).href;
const uiUrl = pathToFileURL(path.join(here, "mock", "server-ui.mjs")).href;

// copy the scripts, pointing their imports at the mocks
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "package.json"), '{"type":"module"}');
for (const f of fs.readdirSync(src)) {
  const code = fs
    .readFileSync(path.join(src, f), "utf8")
    .replaceAll('"@minecraft/server-ui"', JSON.stringify(uiUrl))
    .replaceAll('"@minecraft/server"', JSON.stringify(serverUrl));
  fs.writeFileSync(path.join(out, f), code);
}

const warnings = [];
console.warn = (...a) => warnings.push(a.join(" "));

const S = await import(serverUrl);
const UI = await import(uiUrl);
const mod = (f) => import(pathToFileURL(path.join(out, f)).href);
await mod("main.js");
const sched = await mod("scheduler.js");
const cfg = await mod("config.js");

let failures = 0;
function check(ok, what) {
  if (ok) {
    console.log(`  ok   ${what}`);
  } else {
    failures++;
    console.log(`  FAIL ${what}`);
  }
}
function noWarnings(what) {
  check(warnings.length === 0, `${what}: no script errors${warnings.length ? ` (${warnings.join(" | ")})` : ""}`);
  warnings.length = 0;
}
async function idle(max = 5000) {
  let t = 0;
  while (sched.activeCount() > 0 && t < max) {
    await S.advance(1);
    t++;
  }
  return t;
}
const settingsOf = (p) => JSON.parse(p.getDynamicProperty("destruct:settings") ?? "{}");

const overworld = S.world.getDimension("overworld");
const alex = new S.Player("Alex", overworld, { x: 0.5, y: 64, z: 0.5 });
S.players.push(alex);

/** Uses an item like a tap would (both use events fire, like on a block). */
async function use(player, id, { sneak = false } = {}) {
  player.isSneaking = sneak;
  const stack = new S.ItemStack(id);
  player.mainhand = stack;
  await S.advance(8); // past the double-event guard
  // worst case: the game reports the tap through all four use events
  if (player.lookAt) {
    const block = player.dimension.getBlock(player.lookAt);
    S.world.beforeEvents.itemUseOn.fire({ source: player, itemStack: stack, block, cancel: false });
    S.world.afterEvents.itemUseOn.fire({ source: player, itemStack: stack, block });
  }
  S.world.beforeEvents.itemUse.fire({ source: player, itemStack: stack, cancel: false });
  S.world.afterEvents.itemUse.fire({ source: player, itemStack: stack });
  await S.advance(1);
  player.isSneaking = false;
}

// ------------------------------------------------------------------ first join
console.log("first join");
S.world.afterEvents.playerSpawn.fire({ player: alex, initialSpawn: true });
await S.advance(70);
const kit = alex.inventory.slots.filter(Boolean).map((s) => s.typeId);
check(kit.length === 12, `kit has 12 items (${kit.length})`);
check(kit[0] === cfg.TABLET_ID && kit.includes(cfg.MARKER_ID), "tablet first, marker included");
check(alex.hasTag(cfg.KIT_TAG), "kit tag set");
check(alex.messages.some((m) => m.includes("Sneak + tap")), "welcome explains sneak + tap");
noWarnings("first join");

// ------------------------------------------------------------------ every weapon, crosshair
console.log("every weapon at the crosshair (power 3 and 5)");
const report = [];
for (const power of [3, 5]) {
  for (const w of cfg.WEAPONS) {
    const s = settingsOf(alex);
    s.weapons = { ...(s.weapons ?? {}), [w.id]: { mode: "look", power } };
    alex.setDynamicProperty("destruct:settings", JSON.stringify(s));
    // fresh, untouched ground for every run
    alex.lookAt = { x: 200 + cfg.WEAPONS.indexOf(w) * 90, y: 63, z: power === 5 ? 600 : 300 };
    S.resetStats();
    await use(alex, w.id);
    check(sched.activeCount() === 1, `${w.name} p${power}: exactly one strike from a tap`);
    const ticks = await idle();
    check(sched.activeCount() === 0 && ticks < 5000, `${w.name} p${power}: finishes (${ticks} ticks)`);
    const did = S.stats.explosions + S.stats.blocksSet + S.stats.spawned.length;
    check(did > 0 && S.stats.particles > 0, `${w.name} p${power}: does damage + particles`);
    check(alex.effects.some((e) => e.id === "resistance"), `${w.name} p${power}: owner protected`);
    report.push([w.name, power, ticks, S.stats.explosions, S.stats.blocksSet, S.stats.spawned.length, S.stats.peak.blocks, S.stats.peak.particles, S.stats.peak.explosions]);
    alex.effects.length = 0;
    await S.advance(w.cooldown + 2);
    noWarnings(`${w.name} p${power}`);
  }
}
console.log("\n  weapon              pow ticks expl blocks spawn | peak/tick: blocks particles expl");
for (const r of report) {
  console.log(`  ${r[0].padEnd(19)} ${String(r[1]).padStart(3)} ${String(r[2]).padStart(5)} ${String(r[3]).padStart(4)} ${String(r[4]).padStart(6)} ${String(r[5]).padStart(5)} | ${String(r[6]).padStart(16)} ${String(r[7]).padStart(9)} ${String(r[8]).padStart(4)}`);
}
check(report.every((r) => r[6] <= 400), "never more than 400 block edits in one tick");
const carved = (name, power) => report.find((r) => r[0] === name && r[1] === power)[4];
for (const [name, min] of [["Black Hole Orb", 1000], ["Crater Wand", 5000], ["Sky Beam Staff", 1000], ["Earthquake Hammer", 300], ["Tornado Wand", 300]]) {
  check(carved(name, 5) >= min, `${name} p5 carves real terrain (${carved(name, 5)} blocks, want >= ${min})`);
}
check(report.every((r) => r[8] <= 20), "never more than 20 explosions in one tick");

// ------------------------------------------------------------------ before-events only
console.log("tap reported only through before-events");
{
  const w = cfg.WEAPON_BY_ID.get("destruct:shockwave_core");
  alex.lookAt = { x: 900, y: 63, z: 900 };
  alex.mainhand = new S.ItemStack(w.id);
  await S.advance(8);
  S.world.beforeEvents.itemUse.fire({ source: alex, itemStack: alex.mainhand, cancel: false });
  S.world.beforeEvents.itemUseOn.fire({ source: alex, itemStack: alex.mainhand, block: overworld.getBlock(alex.lookAt), cancel: false });
  await S.advance(2);
  check(sched.activeCount() === 1, "strike starts once from before-events alone");
  await idle();
  await S.advance(w.cooldown + 2);
  noWarnings("before-events");
}

// ------------------------------------------------------------------ cooldown
console.log("cooldown");
const tnt = cfg.WEAPON_BY_ID.get("destruct:mega_tnt_wand");
alex.lookAt = { x: 30, y: 63, z: 0 };
await use(alex, tnt.id);
await use(alex, tnt.id);
check(sched.activeCount() === 1, "second tap during cooldown does nothing");
check(alex.actionbar.some((m) => m.includes("recharging")), "player told it is recharging");
check(S.stats.cooldowns > 0, "item cooldown bar started");
sched.stopAll();
await S.advance(100);
noWarnings("cooldown");

// ------------------------------------------------------------------ sneak + tap settings, marker
console.log("choose where: settings, marker, coordinates, player, random");
UI.answers.push(() => ({ formValues: [1, 5] })); // My Target Marker, power 5
await use(alex, tnt.id, { sneak: true });
await S.advance(2);
check(settingsOf(alex).weapons[tnt.id]?.mode === "marker" && settingsOf(alex).weapons[tnt.id]?.power === 5, "sneak + tap saves where + power");

alex.lookAt = { x: -40, y: 63, z: 12 };
await use(alex, cfg.MARKER_ID);
const marker = alex.getDynamicProperty("destruct:marker");
check(marker && marker.x === -39.5 && marker.y === 64 && marker.z === 12.5, `marker set on the aimed block (${JSON.stringify(marker)})`);

alex.lookAt = { x: 30, y: 63, z: 0 }; // aiming elsewhere: must still hit the marker
S.resetStats();
await use(alex, tnt.id);
await idle();
const first = S.stats.explosionList[0];
check(first && Math.abs(first.loc.x + 39.5) < 0.01 && Math.abs(first.loc.z - 12.5) < 0.01, "strike lands on the marker, not the crosshair");
await S.advance(tnt.cooldown + 2);

// coordinates
const meteor = cfg.WEAPON_BY_ID.get("destruct:meteor_staff");
UI.answers.push(() => ({ formValues: [2, 1] })); // Type coordinates, power 1
await use(alex, meteor.id, { sneak: true });
await S.advance(2);
UI.answers.push(() => ({ formValues: ["~100", "200", "~-50"] }));
S.resetStats();
await use(alex, meteor.id);
await idle();
const ex = S.stats.explosionList;
check(ex.length > 0 && ex.every((e) => Math.abs(e.loc.x - 100.5) < 11 && Math.abs(e.loc.z + 49.5) < 11), "coordinates: meteors land around ~100 ~ ~-50");
check(ex.every((e) => e.loc.y <= 70), "coordinates: y=200 in the air drops to the ground");
await S.advance(meteor.cooldown + 2);

UI.answers.push(() => ({ formValues: ["abc", "1", "2"] }));
await use(alex, meteor.id);
await S.advance(2);
check(alex.messages.at(-1).includes("don't look right") && sched.activeCount() === 0, "bad coordinates are rejected politely");

UI.answers.push(() => ({ formValues: ["5000", "64", "5000"] }));
await use(alex, meteor.id);
await S.advance(2);
check(alex.messages.at(-1).includes("isn't loaded") && sched.activeCount() === 0, "unloaded coordinates are rejected politely");

// on a player
const steve = new S.Player("Steve", overworld, { x: 200.5, y: 64, z: -80.5 });
S.players.push(steve);
const thunder = cfg.WEAPON_BY_ID.get("destruct:thunder_staff");
UI.answers.push(() => ({ formValues: [3, 2] }));
await use(alex, thunder.id, { sneak: true });
await S.advance(2);
UI.answers.push((form) => ({ selection: form.buttons.findIndex((b) => b.text.includes("Steve")) }));
S.resetStats();
await use(alex, thunder.id);
await idle();
check(S.stats.explosionList.length > 0 && S.stats.explosionList.every((e) => Math.hypot(e.loc.x - 200.5, e.loc.z + 80.5) < 12), "on a player: lightning storm lands on Steve");
await S.advance(thunder.cooldown + 2);

// random spot
const rain = cfg.WEAPON_BY_ID.get("destruct:tnt_rain_wand");
UI.answers.push(() => ({ formValues: [4, 1] }));
await use(alex, rain.id, { sneak: true });
await S.advance(2);
S.resetStats();
await use(alex, rain.id);
await idle();
check(S.stats.spawned.filter((id) => id === "minecraft:tnt").length === 8, "random spot: TNT rain drops 8 TNT at power 1");
await S.advance(rain.cooldown + 2);
noWarnings("target modes");

// ------------------------------------------------------------------ tablet
console.log("destruction tablet");
alex.lookAt = { x: 10, y: 63, z: 10 };
UI.answers.push(() => ({ selection: 0 })); // Launch a Strike
UI.answers.push(() => ({ selection: 3 })); // Black Hole Orb
UI.answers.push(() => ({ selection: 0 })); // Where I'm looking
UI.answers.push(() => ({ formValues: [2, true] })); // power 2, remember
await use(alex, cfg.TABLET_ID);
await S.advance(5);
check(sched.activeCount() === 0, "tablet waits for the 3-2-1 aim countdown");
await S.advance(70);
check(sched.activeCount() === 1, "tablet launch: strike started after countdown");
check(settingsOf(alex).weapons["destruct:black_hole_orb"]?.power === 2, "tablet launch remembered the power");
await idle();

UI.answers.push(() => ({ selection: 4 })); // Game Settings
UI.answers.push(() => ({ formValues: [false, false, true, 96] }));
await use(alex, cfg.TABLET_ID);
await S.advance(3);
const gs = settingsOf(alex);
check(gs.breakBlocks === false && gs.fire === false && gs.range === 96, "game settings saved");
S.resetStats();
const crater = cfg.WEAPON_BY_ID.get("destruct:crater_wand");
alex.setDynamicProperty("destruct:settings", JSON.stringify({ ...gs, weapons: { [crater.id]: { mode: "look", power: 5 }, [tnt.id]: { mode: "look", power: 3 } } }));
await use(alex, crater.id);
await idle();
check(S.stats.blocksSet === 0, "block damage OFF: crater wand changes no blocks");
await S.advance(tnt.cooldown);
S.resetStats();
await use(alex, tnt.id);
await idle();
check(S.stats.explosionList.length > 0 && S.stats.explosionList.every((e) => !e.opts.breaksBlocks && !e.opts.causesFire), "block damage OFF: explosions don't break blocks or burn");
S.resetStats();
await use(alex, rain.id);
await idle();
check(S.stats.spawned.includes("minecraft:tnt") && S.stats.explosionList.length > 0 && S.stats.explosionList.every((e) => !e.opts.breaksBlocks), "block damage OFF: TNT rain is set off safely");
alex.setDynamicProperty("destruct:settings", JSON.stringify({ ...gs, breakBlocks: true, fire: true }));

// stop all
for (const id of ["destruct:tornado_wand", "destruct:black_hole_orb", "destruct:earthquake_hammer"]) await use(alex, id);
check(sched.activeCount() === 3, "three effects running");
UI.answers.push(() => ({ selection: 5 })); // STOP ALL
await use(alex, cfg.TABLET_ID);
await S.advance(2);
check(sched.activeCount() === 0, "STOP ALL cancels everything");

// get all weapons
alex.inventory.slots.fill(undefined);
alex.inventory.slots[0] = new S.ItemStack("destruct:crater_wand");
UI.answers.push(() => ({ selection: 3 }));
await use(alex, cfg.TABLET_ID);
await S.advance(2);
check(alex.inventory.slots.filter(Boolean).length === 12, "Get All Weapons fills in the missing 11");

// weapon settings, set marker, help
UI.answers.push(() => ({ selection: 2 }), () => ({ selection: 5 }), () => ({ formValues: [0, 4] }));
await use(alex, cfg.TABLET_ID);
await S.advance(3);
check(settingsOf(alex).weapons["destruct:tornado_wand"]?.power === 4, "tablet weapon settings saved");
alex.lookAt = { x: 7, y: 63, z: -7 };
UI.answers.push(() => ({ selection: 1 }));
await use(alex, cfg.TABLET_ID);
await S.advance(70);
check(alex.getDynamicProperty("destruct:marker")?.x === 7.5, "tablet Set Marker Here works after countdown");
UI.answers.push(() => ({ selection: 6 }), () => ({ selection: 0 }));
await use(alex, cfg.TABLET_ID);
await S.advance(3);
check(UI.shown.at(-1).titleText.includes("How to use"), "help screen opens");
await idle();
noWarnings("tablet");

// ------------------------------------------------------------------ aim read-out, scriptevents
console.log("aim read-out and /scriptevent");
alex.mainhand = new S.ItemStack("destruct:sky_beam_staff");
alex.lookAt = { x: 12, y: 63, z: 3 };
alex.actionbar.length = 0;
await S.advance(70);
check(alex.actionbar.some((m) => m.includes("Sky Beam Staff") && m.includes("12 63 3")), "holding a weapon shows where it will hit");
alex.mainhand = undefined;

await use(alex, "destruct:earthquake_hammer");
S.system.afterEvents.scriptEventReceive.fire({ id: "destruct:stop", sourceEntity: alex, message: "" });
check(sched.activeCount() === 0, "/scriptevent destruct:stop");
alex.inventory.slots.fill(undefined);
S.system.afterEvents.scriptEventReceive.fire({ id: "destruct:kit", sourceEntity: alex, message: "" });
check(alex.inventory.slots.filter(Boolean).length === 12, "/scriptevent destruct:kit");
S.system.afterEvents.scriptEventReceive.fire({ id: "destruct:menu", sourceEntity: alex, message: "" });
await S.advance(2);
check(UI.shown.at(-1).titleText.includes("DESTRUCTION TABLET"), "/scriptevent destruct:menu opens the tablet");
noWarnings("script events");

// ------------------------------------------------------------------ protected blocks, nether
console.log("world safety");
const deep = { x: 60, y: 40, z: 60 }; // command block layer is at y=33 in the mock
alex.lookAt = deep;
alex.setDynamicProperty("destruct:settings", JSON.stringify({ breakBlocks: true, fire: true, protect: true, range: 160, weapons: { [crater.id]: { mode: "look", power: 5 } } }));
await S.advance(crater.cooldown);
await use(alex, crater.id);
await idle();
check(overworld.typeAt(60, 33, 60) === "minecraft:command_block", "crater wand never removes command blocks");
check(overworld.typeAt(60, 40, 60) === "minecraft:air", "crater wand removed the terrain");

const nether = S.world.getDimension("nether");
const nia = new S.Player("Nia", nether, { x: 0.5, y: 41, z: 0.5 });
S.players.push(nia);
nia.setDynamicProperty("destruct:settings", JSON.stringify({ breakBlocks: true, fire: true, protect: true, range: 160, weapons: Object.fromEntries(cfg.WEAPONS.map((w) => [w.id, { mode: "look", power: 5 }])) }));
for (const w of cfg.WEAPONS) {
  nia.lookAt = { x: 20, y: 6, z: 0 }; // near the bedrock floor
  await use(nia, w.id);
  nia.lookAt = { x: -20, y: 118, z: 0 }; // near the roof (we aim at a solid block up there)
  nether.blocks.set("-20,118,0", "minecraft:netherrack");
  await S.advance(w.cooldown + 1);
  await use(nia, w.id);
  await idle();
}
let bedrockLost = 0;
for (const [k, v] of nether.blocks) {
  const y = Number(k.split(",")[1]);
  if (v === "minecraft:air" && (y <= 0 || y >= 123)) bedrockLost++;
}
check(bedrockLost === 0, "nether bedrock floor and roof stay intact");
noWarnings("nether");

console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
