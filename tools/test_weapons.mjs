/**
 * Legendary Weapons - offline smoke test.
 *
 *     node tools/test_weapons.mjs
 *
 * Loads the real behavior pack scripts against a fake world and fires every
 * ability and every passive, checking cooldowns, PvP protection, durability
 * cost and the power multiplier.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCRIPTS = path.join(ROOT, "weapons_BP", "scripts");

const STUBS = {
  "@minecraft/server": `
export const world = globalThis.__wm_world;
export const system = globalThis.__wm_system;
export const BlockPermutation = globalThis.__wm_BlockPermutation;
export const EntityDamageCause = { entityAttack: "entityAttack" };
export const EquipmentSlot = { Mainhand: "Mainhand" };
`,
  "@minecraft/server-ui": `
export const ActionFormData = globalThis.__wm_ActionFormData;
export const ModalFormData = globalThis.__wm_ModalFormData;
export const MessageFormData = globalThis.__wm_ModalFormData;
`
};

function writeStubs() {
  for (const [name, source] of Object.entries(STUBS)) {
    const dir = path.join(ROOT, "node_modules", name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.js"), source);
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name, version: "0.0.0-stub", type: "module", main: "index.js" }, null, 2)
    );
  }
}

const log = {
  warnings: [],
  commands: [],
  particles: 0,
  sounds: 0,
  explosions: 0,
  damage: 0,
  damaged: [],
  effects: [],
  lightning: 0,
  impulses: 0,
  heals: 0,
  teleports: 0
};

let nextId = 1;

class FakeEntity {
  constructor(dimension, typeId, location, families = ["mob"]) {
    this.dimension = dimension;
    this.typeId = typeId;
    this.location = { ...location };
    this.families = families;
    this.id = `e${nextId++}`;
    this.removed = false;
    this.health = 40;
    this.onFire = 0;
  }
  isValid() {
    return !this.removed;
  }
  remove() {
    this.removed = true;
    this.dimension.entities = this.dimension.entities.filter((e) => e !== this);
  }
  applyDamage(amount, options) {
    if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) throw new Error(`bad damage ${amount}`);
    log.damage += amount;
    log.damaged.push({ id: this.id, typeId: this.typeId, amount, cause: options?.cause });
    this.health -= amount;
    return true;
  }
  applyImpulse(vector) {
    if (this.typeId === "minecraft:player") throw new Error("applyImpulse is not valid on players");
    if ([vector.x, vector.y, vector.z].some((n) => typeof n !== "number" || Number.isNaN(n))) {
      throw new Error("bad impulse");
    }
    log.impulses++;
  }
  applyKnockback(a, b, c) {
    if (typeof a === "number" && typeof c !== "number") throw new Error("bad knockback args");
    log.impulses++;
  }
  addEffect(effect, duration, options) {
    if (typeof effect !== "string" || typeof duration !== "number") throw new Error("bad effect");
    log.effects.push({ id: this.id, effect, duration, amplifier: options?.amplifier ?? 0 });
    return true;
  }
  setOnFire(seconds) {
    this.onFire = seconds;
    return true;
  }
  getComponent(id) {
    if (id === "minecraft:health") {
      return {
        currentValue: this.health,
        defaultValue: 40,
        effectiveMax: 40,
        setCurrentValue: (value) => {
          if (value > this.health) log.heals++;
          this.health = value;
        }
      };
    }
    return undefined;
  }
  teleport(location) {
    if (!location || Number.isNaN(location.x)) throw new Error("bad teleport");
    this.location = { ...location };
    log.teleports++;
  }
  getViewDirection() {
    return { x: 0, y: 0, z: 1 };
  }
  getHeadLocation() {
    return { x: this.location.x, y: this.location.y + 1.62, z: this.location.z };
  }
  runCommand(command) {
    log.commands.push(command);
    return { successCount: 1 };
  }
}

class FakeItemStack {
  constructor(typeId, maxDurability = 1000) {
    this.typeId = typeId;
    this.durability = { damage: 0, maxDurability };
  }
  getComponent(id) {
    if (id === "minecraft:durability") return this.durability;
    return undefined;
  }
}

class FakePlayer extends FakeEntity {
  constructor(dimension, name, location) {
    super(dimension, "minecraft:player", location, ["player", "mob"]);
    this.name = name;
    this.isSneaking = false;
    this.mainhand = undefined;
    this.messages = [];
    this.actionBars = [];
    this.cooldowns = new Map();
    this.onScreenDisplay = {
      setActionBar: (text) => this.actionBars.push(text),
      setTitle: () => {}
    };
  }
  hold(typeId) {
    this.mainhand = typeId ? new FakeItemStack(typeId) : undefined;
    return this.mainhand;
  }
  sendMessage(text) {
    this.messages.push(text);
  }
  playSound() {
    log.sounds++;
  }
  startItemCooldown(category, ticks) {
    if (typeof category !== "string" || typeof ticks !== "number") throw new Error("bad cooldown");
    this.cooldowns.set(category, ticks);
  }
  getItemCooldown(category) {
    return this.cooldowns.get(category) ?? 0;
  }
  getComponent(id) {
    if (id === "minecraft:equippable") {
      return {
        getEquipment: () => this.mainhand,
        setEquipment: (slot, stack) => {
          this.mainhand = stack;
          return true;
        }
      };
    }
    return super.getComponent(id);
  }
}

class FakeDimension {
  constructor(id) {
    this.id = id;
    this.overrides = new Map();
    this.entities = [];
    this.heightRange = { min: -64, max: 320 };
  }
  getTypeId(x, y, z) {
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    if (this.overrides.has(key)) return this.overrides.get(key);
    if (y < -64 || y > 319) return "minecraft:air";
    if (y <= 63) return "minecraft:stone";
    return "minecraft:air";
  }
  getBlock(location) {
    if (!location || Number.isNaN(location.x)) throw new Error("bad location");
    if (location.y < -64 || location.y > 319) throw new Error("out of world");
    const dimension = this;
    return {
      typeId: dimension.getTypeId(location.x, location.y, location.z),
      setPermutation() {}
    };
  }
  getEntities(options = {}) {
    let list = this.entities.slice();
    if (options.type) list = list.filter((e) => e.typeId === options.type);
    if (options.excludeFamilies) {
      list = list.filter((e) => !options.excludeFamilies.some((f) => e.families.includes(f)));
    }
    if (options.location && typeof options.maxDistance === "number") {
      list = list.filter((entity) => {
        const dx = entity.location.x - options.location.x;
        const dy = entity.location.y - options.location.y;
        const dz = entity.location.z - options.location.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz) <= options.maxDistance;
      });
    }
    return list;
  }
  getPlayers(options = {}) {
    return this.getEntities(options).filter((e) => e.typeId === "minecraft:player");
  }
  spawnEntity(identifier, location) {
    if (identifier === "minecraft:lightning_bolt") log.lightning++;
    const entity = new FakeEntity(this, identifier, location);
    this.entities.push(entity);
    return entity;
  }
  spawnParticle(id, location) {
    if (!id.includes(":")) throw new Error(`bad particle id ${id}`);
    if (!location || Number.isNaN(location.x) || Number.isNaN(location.y)) throw new Error("bad particle location");
    log.particles++;
  }
  createExplosion(location, power, options) {
    if (Number.isNaN(location.x) || typeof power !== "number") throw new Error("bad explosion");
    if (options && options.source && !options.source.typeId) throw new Error("bad explosion source");
    log.explosions++;
    return true;
  }
  runCommand(command) {
    log.commands.push(command);
    return { successCount: 1 };
  }
}

const overworld = new FakeDimension("minecraft:overworld");

const listeners = { itemUse: [], itemUseOn: [], entityHurt: [], playerSpawn: [], scriptEvent: [] };

const fakeWorld = {
  properties: new Map(),
  getDimension: () => overworld,
  getAllPlayers: () => overworld.entities.filter((e) => e.typeId === "minecraft:player"),
  sendMessage: () => {},
  playSound: () => {
    log.sounds++;
  },
  getDynamicProperty(id) {
    return this.properties.get(id);
  },
  setDynamicProperty(id, value) {
    this.properties.set(id, value);
  },
  afterEvents: {
    itemUse: { subscribe: (fn) => listeners.itemUse.push(fn) },
    itemUseOn: { subscribe: (fn) => listeners.itemUseOn.push(fn) },
    entityHurt: { subscribe: (fn) => listeners.entityHurt.push(fn) },
    playerSpawn: { subscribe: (fn) => listeners.playerSpawn.push(fn) }
  }
};

const intervals = new Map();
const timeouts = [];
let pendingRuns = [];
let nextHandle = 1;

const fakeSystem = {
  currentTick: 0,
  run(fn) {
    pendingRuns.push(fn);
  },
  runTimeout(fn, delay) {
    timeouts.push({ fn, at: fakeSystem.currentTick + (delay ?? 1) });
  },
  runInterval(fn, period) {
    const handle = nextHandle++;
    intervals.set(handle, { fn, period: Math.max(1, period ?? 1) });
    return handle;
  },
  clearRun(handle) {
    intervals.delete(handle);
  },
  afterEvents: {
    scriptEventReceive: { subscribe: (fn) => listeners.scriptEvent.push(fn) }
  }
};

globalThis.__wm_world = fakeWorld;
globalThis.__wm_system = fakeSystem;
globalThis.__wm_BlockPermutation = { resolve: (id) => ({ typeId: id }) };

class FakeForm {
  constructor() {
    this.buttons = [];
  }
  title() {
    return this;
  }
  body() {
    return this;
  }
  button(text, icon) {
    this.buttons.push({ text, icon });
    return this;
  }
  toggle() {
    return this;
  }
  slider() {
    return this;
  }
  show() {
    FakeForm.shown++;
    return Promise.resolve({ canceled: true, cancelationReason: "UserClosed" });
  }
}
FakeForm.shown = 0;

globalThis.__wm_ActionFormData = FakeForm;
globalThis.__wm_ModalFormData = FakeForm;

const originalWarn = console.warn;
console.warn = (...args) => {
  log.warnings.push(args.join(" "));
};

function tick(count) {
  for (let i = 0; i < count; i++) {
    fakeSystem.currentTick++;
    for (const player of fakeWorld.getAllPlayers()) {
      for (const [category, remaining] of player.cooldowns) {
        if (remaining > 0) player.cooldowns.set(category, remaining - 1);
      }
    }
    const runs = pendingRuns;
    pendingRuns = [];
    for (const fn of runs) fn();
    for (let t = timeouts.length - 1; t >= 0; t--) {
      if (timeouts[t].at <= fakeSystem.currentTick) timeouts.splice(t, 1)[0].fn();
    }
    for (const [, interval] of [...intervals]) {
      if (fakeSystem.currentTick % interval.period === 0) interval.fn();
    }
  }
}

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, ok: !!condition, detail });
}

function spawnDummies(count, at) {
  const made = [];
  for (let i = 0; i < count; i++) {
    const entity = new FakeEntity(overworld, "minecraft:zombie", {
      x: at.x + (i - count / 2) * 1.5,
      y: at.y,
      z: at.z + 3
    });
    overworld.entities.push(entity);
    made.push(entity);
  }
  return made;
}

function useItem(player, typeId) {
  // The pack debounces taps for a few ticks, so leave a gap before each use.
  tick(10);
  player.hold(typeId);
  for (const fn of listeners.itemUse) fn({ source: player, itemStack: { typeId } });
  tick(4);
}

async function main() {
  writeStubs();

  const player = new FakePlayer(overworld, "Tester", { x: 0, y: 64, z: 0 });
  overworld.entities.push(player);

  await import(pathToFileURL(path.join(SCRIPTS, "main.js")).href);
  tick(5);
  check("main.js loads and boots", log.warnings.some((w) => w.includes("loaded with 6 weapons")), log.warnings.join(" | "));

  const config = await import(pathToFileURL(path.join(SCRIPTS, "config.js")).href);
  const keys = config.WEAPON_KEYS;
  check("six weapons registered", keys.length === 6, keys.join(","));

  // Every ability, one at a time, with something to hit.
  for (const key of keys) {
    const before = {
      damage: log.damage,
      particles: log.particles,
      warnings: log.warnings.length
    };
    const dummies = spawnDummies(4, player.location);
    player.cooldowns.clear();
    useItem(player, `wm:${key}`);
    tick(90); // long enough for the singularity to hold and implode

    check(`${key}: ability runs`, log.warnings.length === before.warnings, log.warnings.slice(before.warnings).join(" | "));
    check(`${key}: hits something`, log.damage > before.damage, `${log.damage - before.damage} damage`);
    check(`${key}: makes particles`, log.particles > before.particles, String(log.particles - before.particles));
    for (const dummy of dummies) if (dummy.isValid()) dummy.remove();
  }

  check("thunder blade calls lightning", log.lightning > 0, String(log.lightning));
  check("inferno cannon explodes", log.explosions > 0, String(log.explosions));
  check("void ripper teleports the player", log.teleports > 0, String(log.teleports));
  check("earthshaker shakes the screen", log.commands.some((c) => c.startsWith("camerashake")), "");
  check("frost scythe applies slowness", log.effects.some((e) => e.effect === "slowness"), "");

  // Cooldowns.
  player.cooldowns.clear();
  spawnDummies(2, player.location);
  useItem(player, "wm:thunder_blade");
  const lightningAfterFirst = log.lightning;
  useItem(player, "wm:thunder_blade");
  check("cooldown blocks a second use", log.lightning === lightningAfterFirst, `${lightningAfterFirst} -> ${log.lightning}`);
  check(
    "cooldown tells the player how long is left",
    player.actionBars.some((text) => text.includes("ready in")),
    ""
  );

  // Durability.
  player.cooldowns.clear();
  tick(10);
  player.hold("wm:earthshaker");
  for (const fn of listeners.itemUse) fn({ source: player, itemStack: { typeId: "wm:earthshaker" } });
  tick(5);
  check("abilities cost durability", player.mainhand && player.mainhand.durability.damage > 0,
    String(player.mainhand?.durability?.damage ?? "item gone"));

  // Sneak + tap opens the codex instead of firing.
  const formsBefore = FakeForm.shown;
  player.isSneaking = true;
  player.cooldowns.clear();
  useItem(player, "wm:void_ripper");
  check("sneak + tap opens the codex", FakeForm.shown > formsBefore, `${formsBefore} -> ${FakeForm.shown}`);
  player.isSneaking = false;

  // Melee passives via entityHurt.
  const victim = spawnDummies(1, player.location)[0];
  const healsBefore = log.heals;
  player.hold("wm:void_ripper");
  player.health = 10;
  for (const fn of listeners.entityHurt) {
    fn({ hurtEntity: victim, damage: 10, damageSource: { cause: "entityAttack", damagingEntity: player } });
  }
  tick(3);
  check("void ripper lifesteal heals the attacker", log.heals > healsBefore, `${healsBefore} -> ${log.heals}`);

  player.hold("wm:frost_scythe");
  const effectsBefore = log.effects.length;
  for (const fn of listeners.entityHurt) {
    fn({ hurtEntity: victim, damage: 8, damageSource: { cause: "entityAttack", damagingEntity: player } });
  }
  tick(3);
  check("frost scythe chills on hit", log.effects.length > effectsBefore, "");

  player.hold("wm:inferno_cannon");
  for (const fn of listeners.entityHurt) {
    fn({ hurtEntity: victim, damage: 4, damageSource: { cause: "entityAttack", damagingEntity: player } });
  }
  tick(3);
  check("inferno cannon burns on hit", victim.onFire > 0, String(victim.onFire));

  // A plain vanilla sword must not trigger anything.
  player.hold("minecraft:diamond_sword");
  const damageBeforeVanilla = log.damage;
  for (const fn of listeners.entityHurt) {
    fn({ hurtEntity: victim, damage: 7, damageSource: { cause: "entityAttack", damagingEntity: player } });
  }
  tick(3);
  check("vanilla weapons are untouched", log.damage === damageBeforeVanilla, "");

  // PvP protection.
  // Place the friend next to wherever the player ended up (Blink Strike moved them).
  const other = new FakePlayer(overworld, "Friend", {
    x: player.location.x + 1,
    y: player.location.y,
    z: player.location.z + 2
  });
  overworld.entities.push(other);
  config.setSetting("hurtPlayers", false);
  player.cooldowns.clear();
  const friendHealth = other.health;
  useItem(player, "wm:earthshaker");
  tick(10);
  check("PvP off spares other players", other.health === friendHealth, `${friendHealth} -> ${other.health}`);

  config.setSetting("hurtPlayers", true);
  player.cooldowns.clear();
  useItem(player, "wm:earthshaker");
  tick(10);
  check("PvP on hits other players", other.health < friendHealth, `${friendHealth} -> ${other.health}`);
  check("abilities never hit the user", !log.damaged.some((d) => d.id === player.id), "");

  // Power multiplier.
  config.setSetting("powerPercent", 200);
  const dummy = spawnDummies(1, player.location)[0];
  player.cooldowns.clear();
  const before200 = log.damage;
  useItem(player, "wm:frost_scythe");
  tick(10);
  const at200 = log.damage - before200;
  config.setSetting("powerPercent", 100);
  player.cooldowns.clear();
  const before100 = log.damage;
  useItem(player, "wm:frost_scythe");
  tick(10);
  const at100 = log.damage - before100;
  check("power multiplier scales damage", at200 > at100, `200% -> ${at200}, 100% -> ${at100}`);
  if (dummy.isValid()) dummy.remove();

  // scriptevents.
  const fire = (id, message = "") => {
    for (const fn of listeners.scriptEvent) fn({ id, message, sourceEntity: player, sourceType: "Entity" });
    tick(3);
  };
  fire("wm:help");
  fire("wm:list");
  fire("wm:give");
  check("wm:give hands out every weapon", log.commands.filter((c) => c.startsWith("give")).length >= 6, "");
  fire("wm:give", "thunder_blade");
  fire("wm:power", "150");
  check("wm:power changes the setting", config.getSetting("powerPercent") === 150, String(config.getSetting("powerPercent")));
  fire("wm:blocks", "on");
  fire("wm:pvp", "off");
  fire("wm:codex");
  fire("wm:settings");
  config.setSetting("powerPercent", 100);
  config.setSetting("hurtPlayers", true);
  config.setSetting("blockDamage", false);

  // Soak: fire everything repeatedly with mobs around.
  for (let round = 0; round < 6; round++) {
    spawnDummies(3, player.location);
    for (const key of keys) {
      player.cooldowns.clear();
      useItem(player, `wm:${key}`);
      tick(30);
    }
  }
  tick(120);

  const crashes = log.warnings.filter((w) => w.includes("ability") || w.includes("singularity") || w.includes("Error"));
  check("no crashes during the soak", crashes.length === 0, crashes.slice(0, 3).join(" | "));
  check("singularity cleans up its loop", intervals.size === 0, `${intervals.size} intervals left running`);
  check("sounds were played", log.sounds > 0, String(log.sounds));

  console.warn = originalWarn;

  let failed = 0;
  for (const result of results) {
    if (!result.ok) failed++;
    console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.detail ? `  -> ${result.detail}` : ""}`);
  }
  console.log(
    `\n${results.length - failed}/${results.length} checks passed ` +
      `(damage: ${Math.round(log.damage)}, particles: ${log.particles}, explosions: ${log.explosions})`
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.warn = originalWarn;
  console.error(error);
  process.exitCode = 1;
});
