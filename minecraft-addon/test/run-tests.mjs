// Runs Arcane Arsenal against the fake @minecraft/server and checks behaviour.
//   node --import ./test/register.mjs ./test/run-tests.mjs
import assert from "node:assert/strict";
import * as MC from "@minecraft/server";

const { T, advance, fire, world, system, ItemStack, Player, Entity, overworld, setBlock, blockAt } = MC;

const warnings = [];
console.warn = (...a) => warnings.push(a.join(" "));

await import("../packs/ArcaneArsenal_BP/scripts/main.js");

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, e });
  }
}

// ------------------------------------------------------------------ helpers
function reset() {
  for (const e of T.entities) e.valid = false;
  advance(3); // let the add-on remove lights of vanished players
  T.entities = [];
  T.blocks.clear();
  T.particles.clear();
  T.sounds = [];
  T.lightning = [];
  T.commands = [];
  advance(45); // cooldown-free, stale lights retried
}
function lightsAt() {
  const out = [];
  for (const [k, p] of T.blocks) {
    if (p._name.startsWith("minecraft:light_block")) {
      const [, x, y, z] = k.split("|").map(Number);
      out.push({ x, y, z, level: p._states.block_light_level ?? Number(p._name.split("_").pop()) });
    }
  }
  return out;
}
function light(x, y, z) {
  const p = blockAt(x, y, z);
  if (!p._name.startsWith("minecraft:light_block")) return 0;
  return p._states.block_light_level ?? Number(p._name.split("_").pop());
}
function player(x = 0.5, y = 64, z = 0.5) {
  return new Player("Steve", overworld, { x, y, z });
}
function mob(type, x, y, z, opts) {
  return new Entity(type, overworld, { x, y, z }, opts);
}
function use(p, item) {
  fire(world.afterEvents.itemUse, { source: p, itemStack: item });
}
function hit(p, target) {
  fire(world.afterEvents.entityHitEntity, { damagingEntity: p, hitEntity: target });
}
/** face east (+x) */
const EAST = { x: 0, y: -90 };

// ================================================================== LIGHTS
await test("held torch lights the head block with torch brightness", () => {
  reset();
  const p = player();
  p.hold(new ItemStack("minecraft:torch"));
  advance(2);
  assert.ok([13, 14].includes(light(0, 65, 0)), `light at head: ${light(0, 65, 0)}`);
  assert.equal(lightsAt().length, 1);
});

await test("light follows the player; the old spot goes dark", () => {
  const p = T.entities.find((e) => e instanceof Player);
  p.location = { x: 6.5, y: 64, z: 0.5 };
  advance(1);
  assert.equal(light(0, 65, 0), 0);
  assert.ok(light(6, 65, 0) >= 13);
  assert.equal(lightsAt().length, 1);
});

await test("putting the torch away removes the light", () => {
  const p = T.entities.find((e) => e instanceof Player);
  p.hold(undefined);
  advance(1);
  assert.equal(lightsAt().length, 0);
});

await test("real flames flicker (13-14) but glowstone is steady (15)", () => {
  reset();
  const p = player();
  p.hold(new ItemStack("minecraft:torch"));
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    advance(1);
    seen.add(light(0, 65, 0));
  }
  assert.deepEqual([...seen].sort(), [13, 14]);
  p.hold(new ItemStack("minecraft:glowstone"));
  const steady = new Set();
  for (let i = 0; i < 100; i++) {
    advance(1);
    steady.add(light(0, 65, 0));
  }
  assert.deepEqual([...steady], [15]);
});

await test("a torch gives no light under water", () => {
  reset();
  const p = player();
  setBlock("minecraft:overworld", 0, 65, 0, "minecraft:water");
  setBlock("minecraft:overworld", 0, 64, 0, "minecraft:water");
  p.hold(new ItemStack("minecraft:torch"));
  advance(3);
  assert.equal(lightsAt().length, 0);
});

await test("never touches a light block someone else placed", () => {
  reset();
  setBlock("minecraft:overworld", 0, 65, 0, "minecraft:light_block", { block_light_level: 5 });
  const p = player();
  p.hold(new ItemStack("minecraft:torch"));
  advance(3);
  assert.equal(light(0, 65, 0), 5, "foreign light kept");
  assert.ok(light(0, 64, 0) >= 13, "our light moved to the feet block");
  p.hold(undefined);
  advance(2);
  assert.equal(light(0, 65, 0), 5, "foreign light still there after cleanup");
});

await test("Radiant Torch works in the off-hand and its beam lights the wall you look at", () => {
  reset();
  for (let y = 64; y < 70; y++) for (let z = -3; z <= 3; z++) setBlock("minecraft:overworld", 12, y, z, "minecraft:stone");
  const p = player();
  p.rotation = { ...EAST };
  p.hold(new ItemStack("arcane:radiant_torch"), "Offhand");
  advance(2);
  assert.ok(light(0, 65, 0) >= 14, `hand light ${light(0, 65, 0)}`);
  assert.equal(light(11, 65, 0), 15, "beam spot in front of the wall");
});

await test("the beam leaves building range alone (no light right in front of you)", () => {
  reset();
  for (let y = 64; y < 70; y++) for (let z = -3; z <= 3; z++) setBlock("minecraft:overworld", 4, y, z, "minecraft:stone");
  const p = player();
  p.rotation = { ...EAST };
  p.hold(new ItemStack("arcane:radiant_torch"), "Offhand");
  advance(2);
  assert.equal(light(3, 65, 0), 0, "no beam light at a wall 3.5 blocks away");
  assert.ok(light(0, 65, 0) >= 14, "hand light still on");
});

await test("tapping the Radiant Torch toggles the beam", () => {
  reset();
  for (let y = 64; y < 70; y++) for (let z = -3; z <= 3; z++) setBlock("minecraft:overworld", 12, y, z, "minecraft:stone");
  const p = player();
  p.rotation = { ...EAST };
  const torch = new ItemStack("arcane:radiant_torch");
  p.hold(torch, "Mainhand");
  p.hold(undefined, "Offhand");
  use(p, torch);
  advance(2);
  assert.equal(p.getDynamicProperty("arcane:beam"), false);
  assert.equal(light(11, 65, 0), 0, "beam off");
  advance(10);
  use(p, torch);
  advance(2);
  assert.equal(light(11, 65, 0), 15, "beam back on");
});

await test("a dropped torch keeps glowing on the ground", () => {
  reset();
  player();
  mob("minecraft:item", 8.5, 64, 3.5, { itemStack: new ItemStack("minecraft:torch") });
  advance(12);
  assert.ok(light(8, 64, 3) >= 13, `dropped light ${light(8, 64, 3)}`);
});

await test("lights setting off removes every light, on brings them back", () => {
  reset();
  const p = player();
  p.hold(new ItemStack("minecraft:glowstone"));
  advance(2);
  assert.equal(lightsAt().length, 1);
  fire(system.afterEvents.scriptEventReceive, { id: "arcane:config", message: "lights off", sourceEntity: p });
  advance(2);
  assert.equal(lightsAt().length, 0);
  assert.ok(p.messages.some((m) => m.includes("lights") && m.includes("OFF")));
  fire(system.afterEvents.scriptEventReceive, { id: "arcane:config", message: "lights on", sourceEntity: p });
  advance(2);
  assert.equal(lightsAt().length, 1);
});

await test("light positions are saved so a quit never leaves stray lights", () => {
  advance(5);
  const saved = JSON.parse(T.worldProps.get("arcane:light_blocks"));
  assert.deepEqual(saved, [["minecraft:overworld", 0, 65, 0]]);
});

await test("embers and smoke come from a held torch", () => {
  reset();
  const p = player();
  p.hold(new ItemStack("minecraft:torch"));
  advance(40);
  assert.ok((T.particles.get("arcane:torch_ember") ?? 0) >= 10);
  assert.ok((T.particles.get("arcane:torch_smoke") ?? 0) >= 2);
  p.hold(new ItemStack("minecraft:soul_torch"));
  advance(20);
  assert.ok((T.particles.get("arcane:soul_ember") ?? 0) >= 5);
});

// ================================================================== SPELLS
function arena() {
  reset();
  const p = player();
  const near = [mob("minecraft:zombie", 2.5, 64, 4.0), mob("minecraft:skeleton", -3.5, 64, 2.5)]; // off the aim line (east)
  const villager = mob("minecraft:villager_v2", 1.5, 64, -2.5);
  const wolf = mob("minecraft:wolf", -1.5, 64, -1.5, { tamed: true });
  const cow = mob("minecraft:cow", 2.5, 64, 2.5);
  return { p, near, villager, wolf, cow };
}
function assertFriendsSafe(a) {
  assert.equal(a.villager.damageTaken, 0, "villager hurt");
  assert.equal(a.wolf.damageTaken, 0, "tamed wolf hurt");
  assert.equal(a.cow.damageTaken, 0, "cow hurt by area spell");
  assert.equal(a.p.damageTaken, 0, "caster hurt");
}

await test("Frost Nova freezes and hurts nearby monsters only", () => {
  const a = arena();
  const blade = new ItemStack("arcane:frostbite_blade");
  a.p.hold(blade);
  use(a.p, blade);
  advance(10);
  for (const z of a.near) {
    assert.ok(z.damageTaken >= 6, "hurt");
    assert.equal(z.getEffect("slowness")?.amplifier, 3);
  }
  assertFriendsSafe(a);
  assert.equal(blade.cooldownStarted, 1, "hotbar cooldown overlay started");
});

await test("spells respect their cooldown and show the recharge time", () => {
  const p = T.entities.find((e) => e instanceof Player);
  const z = mob("minecraft:zombie", 2.5, 64, 0.5, { health: 200 });
  const blade = p.equipment.Mainhand;
  advance(5);
  use(p, blade);
  advance(5);
  assert.equal(z.damageTaken, 0, "cast while recharging");
  assert.ok(p.actionbars.some((t) => t.includes("recharging")));
  advance(120);
  assert.ok(p.actionbars.some((t) => t.includes("ready!")), "ready message");
  use(p, blade);
  advance(5);
  assert.ok(z.damageTaken >= 6, "cast after cooldown");
});

await test("Flame Wave burns monsters in front, not behind", () => {
  const a = arena();
  a.p.rotation = { ...EAST };
  const front = mob("minecraft:zombie", 6.5, 64, 0.8);
  const behind = mob("minecraft:zombie", -6.5, 64, 0.5);
  const sword = new ItemStack("arcane:inferno_sword");
  a.p.hold(sword);
  use(a.p, sword);
  advance(12);
  assert.ok(front.damageTaken >= 7 && front.fire >= 6, "front burned");
  assert.equal(behind.damageTaken, 0, "behind untouched");
  assertFriendsSafe(a);
});

await test("Toxic Cloud poisons (and withers undead) over time", () => {
  const a = arena();
  a.p.rotation = { ...EAST };
  const spider = mob("minecraft:spider", 3.5, 64, 1.5);
  const fang = new ItemStack("arcane:venom_fang");
  a.p.hold(fang);
  use(a.p, fang);
  advance(30);
  assert.ok(spider.getEffect("poison"), "spider poisoned");
  assert.ok(a.near[0].getEffect("wither"), "zombie withered (undead)");
  assertFriendsSafe(a);
});

await test("Thunder Call strikes real lightning at a far target", () => {
  const a = arena();
  a.p.rotation = { ...EAST };
  const far = mob("minecraft:zombie", 15.5, 64, 0.5);
  const hammer = new ItemStack("arcane:storm_hammer");
  a.p.hold(hammer);
  use(a.p, hammer);
  advance(5);
  assert.equal(T.lightning.length, 1, "one bolt");
  assert.ok(far.damageTaken >= 10);
  assert.ok(T.commands.some((c) => c.startsWith("camerashake")), "screen shake");
});

await test("Thunder Call never drops real lightning next to a villager", () => {
  const a = arena();
  a.p.rotation = { ...EAST };
  const far = mob("minecraft:zombie", 15.5, 64, 0.5);
  mob("minecraft:villager_v2", 16.5, 64, 1.5);
  const hammer = new ItemStack("arcane:storm_hammer");
  a.p.hold(hammer);
  use(a.p, hammer);
  advance(5);
  assert.equal(T.lightning.length, 0, "no bolt near villager");
  assert.ok(far.damageTaken >= 10, "still damaged by the spark bolt");
});

await test("lightning fire is cleaned up so it can't burn your base", () => {
  const a = arena();
  a.p.rotation = { ...EAST };
  mob("minecraft:zombie", 15.5, 64, 0.5);
  const hammer = new ItemStack("arcane:storm_hammer");
  a.p.hold(hammer);
  use(a.p, hammer);
  setBlock("minecraft:overworld", 15, 64, 0, "minecraft:fire");
  advance(45);
  assert.equal(blockAt(15, 64, 0)._name, "minecraft:air");
});

await test("Shadow Dash blinks forward and slashes foes on the way", () => {
  const a = arena();
  a.p.rotation = { ...EAST };
  const inPath = mob("minecraft:zombie", 5.5, 64, 0.5);
  const reaper = new ItemStack("arcane:shadow_reaper");
  a.p.hold(reaper);
  use(a.p, reaper);
  advance(3);
  assert.ok(a.p.location.x > 9, `moved to ${a.p.location.x}`);
  assert.ok(inPath.damageTaken >= 10 && inPath.getEffect("blindness"));
});

await test("Shadow Dash into a wall does nothing and keeps the cooldown free", () => {
  const a = arena();
  a.p.rotation = { ...EAST };
  for (let y = 64; y < 67; y++) setBlock("minecraft:overworld", 1, y, 0, "minecraft:stone");
  const reaper = new ItemStack("arcane:shadow_reaper");
  a.p.hold(reaper);
  use(a.p, reaper);
  advance(2);
  assert.equal(a.p.teleported ?? 0, 0);
  assert.equal(reaper.cooldownStarted, 0);
  assert.ok(a.p.actionbars.some((t) => t.includes("blocked")));
});

await test("Arcane Missile flies, homes in and hits", () => {
  const a = arena();
  a.p.rotation = { ...EAST };
  const target = mob("minecraft:zombie", 14.5, 64, 1.8, { health: 100 });
  const staff = new ItemStack("arcane:arcane_staff");
  a.p.hold(staff);
  use(a.p, staff);
  advance(20);
  assert.ok(target.damageTaken >= 12, `missile damage ${target.damageTaken}`);
  assert.ok((T.particles.get("arcane:arcane_mote") ?? 0) > 10, "trail");
});

await test("Arcane Missile passes villagers by", () => {
  const a = arena();
  a.p.rotation = { ...EAST };
  const v = mob("minecraft:villager_v2", 5.5, 64.5, 0.5);
  const staff = new ItemStack("arcane:arcane_staff");
  a.p.hold(staff);
  use(a.p, staff);
  advance(30);
  assert.equal(v.damageTaken, 0);
});

await test("Cyclone throws monsters away and lifts you with slow falling", () => {
  const a = arena();
  const blade = new ItemStack("arcane:tempest_blade");
  a.p.hold(blade);
  use(a.p, blade);
  advance(15);
  for (const z of a.near) assert.ok(z.damageTaken >= 7 && z.knockbacks.length > 0);
  assert.ok(a.p.knockbacks.some((k) => k.v > 0.5), "player lifted");
  assert.ok(a.p.getEffect("slow_falling"));
  assertFriendsSafe(a);
});

await test("Divine Judgement smites every monster in range and blesses you", () => {
  const a = arena();
  const foes = [];
  for (let i = 0; i < 6; i++) foes.push(mob("minecraft:zombie", 8 + i * 2.5, 64, 5.5, { health: 20 }));
  const dragon = mob("minecraft:ender_dragon", -15.5, 70, 0.5, { health: 200 });
  const god = new ItemStack("arcane:celestial_godslayer");
  a.p.hold(god);
  a.p.hp = 10;
  use(a.p, god);
  advance(40);
  for (const f of [...foes, ...a.near]) assert.ok(f.damageTaken >= 40, "smitten");
  assert.ok(dragon.damageTaken >= 40, "the Ender Dragon counts as a foe");
  assert.ok(T.lightning.length >= 1 && T.lightning.length <= 8, `bolts: ${T.lightning.length}`);
  assert.equal(a.p.getEffect("resistance")?.amplifier, 2);
  assert.ok(a.p.hp > 10, "healed");
  assertFriendsSafe(a);
});

await test("Thunder Call aimed at the open sky strikes the ground below", () => {
  reset();
  const p = player();
  p.rotation = { x: -30, y: -90 }; // looking up and east
  const hammer = new ItemStack("arcane:storm_hammer");
  p.hold(hammer);
  use(p, hammer);
  advance(3);
  assert.equal(T.lightning.length, 1);
  assert.ok(Math.abs(T.lightning[0].y - 64) < 0.05, `strike height ${T.lightning[0].y}`);
});

// ================================================================== ON HIT & PASSIVES
await test("every weapon has its on-hit power", () => {
  const cases = {
    "arcane:frostbite_blade": (t) => t.getEffect("slowness"),
    "arcane:inferno_sword": (t) => t.fire >= 5,
    "arcane:venom_fang": (t) => t.getEffect("wither") && t.getEffect("weakness"),
    "arcane:storm_hammer": (t) => t.knockbacks.length > 0,
    "arcane:shadow_reaper": (t) => t.getEffect("wither")?.amplifier === 1,
    "arcane:arcane_staff": (t) => t.knockbacks.some((k) => k.h >= 1.4),
    "arcane:tempest_blade": (t) => t.knockbacks.some((k) => k.v >= 0.7),
    "arcane:celestial_godslayer": (t) => t.fire >= 8 && t.getEffect("wither"),
    "arcane:radiant_torch": (t) => t.fire >= 3,
  };
  for (const [id, check] of Object.entries(cases)) {
    reset();
    const p = player();
    p.hold(new ItemStack(id));
    const z = mob("minecraft:zombie", 1.5, 64, 0.5, { health: 100 });
    hit(p, z);
    assert.ok(check(z), `${id} on-hit`);
  }
});

await test("Venom Fang poisons living foes", () => {
  reset();
  const p = player();
  p.hold(new ItemStack("arcane:venom_fang"));
  const s = mob("minecraft:spider", 1.5, 64, 0.5);
  hit(p, s);
  assert.equal(s.getEffect("poison")?.amplifier, 1);
});

await test("Godslayer hits chain holy damage to two more foes", () => {
  reset();
  const p = player();
  p.hold(new ItemStack("arcane:celestial_godslayer"));
  const t = mob("minecraft:zombie", 1.5, 64, 0.5, { health: 100 });
  const others = [mob("minecraft:zombie", 3.5, 64, 0.5, { health: 100 }), mob("minecraft:zombie", 4.5, 64, 2.5, { health: 100 }),
    mob("minecraft:zombie", 5.5, 64, -2.5, { health: 100 })];
  hit(p, t);
  assert.equal(others.filter((o) => o.damageTaken >= 12).length, 2);
});

await test("Shadow Reaper life steal and Soul Harvest on kill", () => {
  reset();
  const p = player();
  p.hp = 10;
  p.hold(new ItemStack("arcane:shadow_reaper"));
  const z = mob("minecraft:zombie", 1.5, 64, 0.5, { health: 5 });
  hit(p, z);
  assert.equal(p.hp, 12, "life steal");
  z.applyDamage(10, { cause: "entityAttack", damagingEntity: p });
  assert.equal(p.hp, 16, "soul harvest heal");
  assert.ok(p.getEffect("absorption"));
});

await test("passives: Godslayer buffs + regen, Tempest speed/jump, Inferno fire resistance", () => {
  reset();
  const p = player();
  p.hold(new ItemStack("arcane:celestial_godslayer"));
  p.hp = 10;
  advance(45);
  assert.equal(p.getEffect("strength")?.amplifier, 1);
  assert.equal(p.getEffect("resistance")?.amplifier, 1);
  assert.ok(p.getEffect("fire_resistance") && p.getEffect("speed"));
  assert.ok(p.hp >= 12, `regen hp ${p.hp}`);
  p.hold(new ItemStack("arcane:tempest_blade"));
  advance(20);
  assert.ok(p.getEffect("jump_boost"));
  p.effects.clear();
  p.hold(new ItemStack("arcane:inferno_sword"));
  advance(20);
  assert.ok(p.getEffect("fire_resistance"));
});

await test("weapon passives fade within a few seconds after switching away", () => {
  reset();
  const p = player();
  p.hold(new ItemStack("arcane:celestial_godslayer"));
  advance(30);
  assert.ok(p.getEffect("strength"));
  p.hold(undefined);
  advance(65);
  assert.equal(p.getEffect("strength"), undefined);
});

await test("Frostbite Blade: Frost Walker freezes water you walk next to", () => {
  reset();
  for (let x = 1; x <= 3; x++) for (let z = -1; z <= 1; z++) setBlock("minecraft:overworld", x, 63, z, "minecraft:water");
  const p = player();
  p.hold(new ItemStack("arcane:frostbite_blade"));
  advance(6);
  assert.equal(blockAt(1, 63, 0)._name, "minecraft:frosted_ice");
  assert.equal(blockAt(3, 63, 0)._name, "minecraft:water", "outside radius stays water");
});

// ================================================================== UI & EVENTS
await test("every item gets its tooltip (lore) in the inventory", () => {
  reset();
  const p = player();
  const ids = ["arcane:frostbite_blade", "arcane:inferno_sword", "arcane:venom_fang", "arcane:storm_hammer",
    "arcane:shadow_reaper", "arcane:arcane_staff", "arcane:tempest_blade", "arcane:celestial_godslayer", "arcane:radiant_torch"];
  ids.forEach((id, i) => (p.inv.items[i + 1] = new ItemStack(id)));
  p.equipment.Offhand = new ItemStack("arcane:radiant_torch");
  advance(45);
  for (let i = 1; i <= ids.length; i++) assert.ok(p.inv.items[i].getLore().length >= 4, `lore for ${ids[i - 1]}`);
  assert.ok(p.equipment.Offhand.getLore().length >= 4, "off-hand lore");
});

await test("tapping a block casts, but tapping a chest just opens it", () => {
  const a = arena();
  const blade = new ItemStack("arcane:frostbite_blade");
  a.p.hold(blade);
  setBlock("minecraft:overworld", 1, 64, 0, "minecraft:chest");
  fire(world.beforeEvents.itemUseOn, { source: a.p, itemStack: blade, block: overworld.getBlock({ x: 1, y: 64, z: 0 }) }, true);
  advance(3);
  assert.equal(a.near[0].damageTaken, 0, "no cast on chest");
  fire(world.beforeEvents.itemUseOn, { source: a.p, itemStack: blade, block: overworld.getBlock({ x: 0, y: 63, z: 0 }) }, true);
  advance(10);
  assert.ok(a.near[0].damageTaken >= 6, "cast on stone");
});

await test("welcome guide is shown once", () => {
  reset();
  const p = player();
  fire(world.afterEvents.playerSpawn, { player: p, initialSpawn: true });
  advance(110);
  const n = p.messages.length;
  assert.ok(n >= 5 && p.hasTag("arcane_welcomed"));
  fire(world.afterEvents.playerSpawn, { player: p, initialSpawn: true });
  advance(110);
  assert.equal(p.messages.length, n);
});

await test("settings commands validate input", () => {
  const p = T.entities.find((e) => e instanceof Player);
  fire(system.afterEvents.scriptEventReceive, { id: "arcane:config", message: "banana on", sourceEntity: p });
  assert.ok(p.messages.at(-1).includes("Usage"));
  fire(system.afterEvents.scriptEventReceive, { id: "arcane:config", message: "hud off", sourceEntity: p });
  assert.ok(p.messages.at(-1).includes("OFF"));
  fire(system.afterEvents.scriptEventReceive, { id: "arcane:config", message: "hud on", sourceEntity: p });
});

await test("no script errors, warnings or unknown particles in any scenario", () => {
  assert.deepEqual(T.errors.map(String), []);
  assert.deepEqual(warnings, []);
  assert.deepEqual([...T.unknownParticles], []);
});

// ------------------------------------------------------------------ report
let failed = 0;
for (const r of results) {
  if (r.ok) console.log(`  ✔ ${r.name}`);
  else {
    failed++;
    console.log(`  ✘ ${r.name}\n      ${String(r.e && r.e.stack || r.e).split("\n").slice(0, 3).join("\n      ")}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
