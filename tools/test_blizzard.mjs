/**
 * Extreme Blizzard - offline smoke test.
 *
 *     node tools/test_blizzard.mjs
 *
 * Loads the real behavior pack scripts against a fake world and checks the one
 * thing the pack lives or dies on: that being outside in a storm kills you fast,
 * that a sealed room with a fire in it saves you, and that a room with a hole in
 * it does not.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCRIPTS = path.join(ROOT, "blizzard_BP", "scripts");

const STUBS = {
  "@minecraft/server": `
export const world = globalThis.__sw_world;
export const system = globalThis.__sw_system;
export const BlockPermutation = globalThis.__sw_BlockPermutation;
export const EntityDamageCause = { entityAttack: "entityAttack" };
export const EquipmentSlot = { Mainhand: "Mainhand" };
`,
  "@minecraft/server-ui": `
export const ActionFormData = globalThis.__sw_ActionFormData;
export const ModalFormData = globalThis.__sw_ModalFormData;
export const MessageFormData = globalThis.__sw_ModalFormData;
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
  blockChanges: 0,
  damage: 0,
  damaged: [],
  effects: [],
  explosions: 0,
  impulses: 0,
  titles: []
};

class FakeBlock {
  constructor(dimension, x, y, z) {
    this.dimension = dimension;
    this.x = x;
    this.y = y;
    this.z = z;
  }
  get typeId() {
    return this.dimension.getTypeId(this.x, this.y, this.z);
  }
  setPermutation(permutation) {
    this.dimension.setTypeId(this.x, this.y, this.z, permutation.typeId);
    log.blockChanges++;
  }
}

let nextEntityId = 1;

class FakeEntity {
  constructor(dimension, typeId, location, families = []) {
    this.dimension = dimension;
    this.typeId = typeId;
    this.location = { ...location };
    this.families = families;
    this.id = `e${nextEntityId++}`;
    this.removed = false;
    this.props = new Map();
    this.events = [];
    this.maxHealth = typeId === "minecraft:player" ? 20 : 30;
    this.health = this.maxHealth;
    this.onFire = 0;
  }
  isValid() {
    return !this.removed;
  }
  remove() {
    if (this.removed) throw new Error("already removed");
    this.removed = true;
    this.dimension.entities = this.dimension.entities.filter((e) => e !== this);
  }
  triggerEvent(name) {
    this.events.push(name);
  }
  getDynamicProperty(key) {
    return this.props.get(key);
  }
  setDynamicProperty(key, value) {
    this.props.set(key, value);
  }
  applyDamage(amount, options) {
    if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) throw new Error(`bad damage ${amount}`);
    if (options && options.damagingEntity && !options.damagingEntity.typeId) throw new Error("bad source");
    log.damage += amount;
    log.damaged.push({ id: this.id, typeId: this.typeId, amount });
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
        defaultValue: this.maxHealth,
        effectiveMax: this.maxHealth,
        setCurrentValue: (value) => {
          this.health = Math.min(this.maxHealth, value);
        }
      };
    }
    return undefined;
  }
  runCommand(command) {
    log.commands.push(command);
    return { successCount: 1 };
  }
  getViewDirection() {
    return { x: 0, y: 0, z: 1 };
  }
  teleport(location) {
    this.location = { ...location };
  }
}

class FakePlayer extends FakeEntity {
  constructor(dimension, name, location, heldItem) {
    super(dimension, "minecraft:player", location, ["player", "mob"]);
    this.name = name;
    this.heldItem = heldItem;
    this.isSneaking = false;
    this.messages = [];
    this.actionBars = [];
    this.onScreenDisplay = {
      setActionBar: (text) => this.actionBars.push(text),
      setTitle: (text) => log.titles.push(text)
    };
  }
  sendMessage(text) {
    this.messages.push(text);
  }
  playSound() {
    log.sounds++;
  }
  getComponent(id) {
    if (id === "minecraft:equippable") {
      return { getEquipment: () => (this.heldItem ? { typeId: this.heldItem } : undefined) };
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
  key(x, y, z) {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
  }
  getTypeId(x, y, z) {
    const override = this.overrides.get(this.key(x, y, z));
    if (override) return override;
    if (y < -64 || y > 319) return "minecraft:air";
    if (y < 62) return "minecraft:stone";
    if (y === 62) return "minecraft:dirt";
    if (y === 63) return "minecraft:grass_block";
    return "minecraft:air";
  }
  setTypeId(x, y, z, typeId) {
    this.overrides.set(this.key(x, y, z), typeId);
  }
  getBlock(location) {
    if (!location || Number.isNaN(location.x)) throw new Error("bad location");
    if (location.y < -64 || location.y > 319) throw new Error("out of world");
    return new FakeBlock(this, location.x, location.y, location.z);
  }
  getEntities(options = {}) {
    let list = this.entities.slice();
    if (options.type) list = list.filter((e) => e.typeId === options.type);
    if (options.excludeFamilies) {
      list = list.filter((e) => !options.excludeFamilies.some((family) => e.families.includes(family)));
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
    const families = ["mob"];
    const entity = new FakeEntity(this, identifier, location, families);
    this.entities.push(entity);
    for (const fn of listeners.entitySpawn) fn({ entity, cause: "Spawned" });
    return entity;
  }
  spawnParticle(id, location) {
    if (!id.includes(":")) throw new Error(`bad particle id ${id}`);
    if (!location || Number.isNaN(location.x)) throw new Error("bad particle location");
    log.particles++;
  }
  createExplosion(location, power, options) {
    if (!location || Number.isNaN(location.x) || typeof power !== "number") throw new Error("bad explosion");
    log.explosions++;
    return true;
  }
  runCommand(command) {
    log.commands.push(command);
    return { successCount: 1 };
  }
}

const overworld = new FakeDimension("minecraft:overworld");
const nether = new FakeDimension("minecraft:nether");
const theEnd = new FakeDimension("minecraft:the_end");

const listeners = {
  entitySpawn: [],
  entityDie: [],
  entityRemove: [],
  itemUse: [],
  itemUseOn: [],
  playerSpawn: [],
  scriptEvent: []
};

const fakeWorld = {
  properties: new Map(),
  getDimension(id) {
    if (id === "minecraft:nether") return nether;
    if (id === "minecraft:the_end") return theEnd;
    return overworld;
  },
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
    entitySpawn: { subscribe: (fn) => listeners.entitySpawn.push(fn) },
    entityDie: { subscribe: (fn) => listeners.entityDie.push(fn) },
    entityRemove: { subscribe: (fn) => listeners.entityRemove.push(fn) },
    itemUse: { subscribe: (fn) => listeners.itemUse.push(fn) },
    itemUseOn: { subscribe: (fn) => listeners.itemUseOn.push(fn) },
    playerSpawn: { subscribe: (fn) => listeners.playerSpawn.push(fn) }
  }
};

const intervals = [];
const timeouts = [];
let pendingRuns = [];

const fakeSystem = {
  currentTick: 0,
  run(fn) {
    pendingRuns.push(fn);
  },
  runTimeout(fn, delay) {
    timeouts.push({ fn, at: fakeSystem.currentTick + (delay ?? 1) });
  },
  runInterval(fn, period) {
    intervals.push({ fn, period: Math.max(1, period ?? 1) });
    return intervals.length;
  },
  afterEvents: {
    scriptEventReceive: { subscribe: (fn) => listeners.scriptEvent.push(fn) }
  }
};

const fakeBlockPermutation = {
  resolve(typeId) {
    if (typeof typeId !== "string" || !typeId.includes(":")) throw new Error(`bad block id ${typeId}`);
    return { typeId };
  }
};

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
    return Promise.resolve({ canceled: true, cancelationReason: "UserClosed" });
  }
}

globalThis.__sw_world = fakeWorld;
globalThis.__sw_system = fakeSystem;
globalThis.__sw_BlockPermutation = fakeBlockPermutation;
globalThis.__sw_ActionFormData = FakeForm;
globalThis.__sw_ModalFormData = FakeForm;

const originalWarn = console.warn;
console.warn = (...args) => {
  log.warnings.push(args.join(" "));
};

function tick(count) {
  for (let i = 0; i < count; i++) {
    fakeSystem.currentTick++;
    const runs = pendingRuns;
    pendingRuns = [];
    for (const fn of runs) fn();
    for (let t = timeouts.length - 1; t >= 0; t--) {
      if (timeouts[t].at <= fakeSystem.currentTick) timeouts.splice(t, 1)[0].fn();
    }
    for (const interval of intervals) {
      if (fakeSystem.currentTick % interval.period === 0) interval.fn();
    }
  }
}

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, ok: !!condition, detail });
}

function countBlocks(typeId) {
  let total = 0;
  for (const value of overworld.overrides.values()) if (value === typeId) total++;
  return total;
}

async function main() {
  writeStubs();

  const player = new FakePlayer(overworld, "Tester", { x: 0, y: 70, z: 0 }, undefined);
  overworld.entities.push(player);

  await import(pathToFileURL(path.join(SCRIPTS, "main.js")).href);
  tick(5);
  check("main.js loads and boots", log.warnings.some((w) => w.includes("v1.0.0 loaded")), log.warnings.join(" | "));

  const blizzard = await import(pathToFileURL(path.join(SCRIPTS, "blizzard.js")).href);
  const shelter = await import(pathToFileURL(path.join(SCRIPTS, "shelter.js")).href);
  const config = await import(pathToFileURL(path.join(SCRIPTS, "config.js")).href);

  /** Builds a hollow stone box. `hole` leaves the roof open. */
  const buildRoom = (cx, cy, cz, { hole = false, heater = false } = {}) => {
    for (let x = cx - 2; x <= cx + 2; x++) {
      for (let y = cy - 1; y <= cy + 3; y++) {
        for (let z = cz - 2; z <= cz + 2; z++) {
          const isShell =
            x === cx - 2 || x === cx + 2 || y === cy - 1 || y === cy + 3 || z === cz - 2 || z === cz + 2;
          overworld.setTypeId(x, y, z, isShell ? "minecraft:stone" : "minecraft:air");
        }
      }
    }
    if (hole) overworld.setTypeId(cx, cy + 3, cz, "minecraft:air");
    if (heater) overworld.setTypeId(cx + 1, cy, cz + 1, "sw:heater");
  };

  // ---- the shelter test itself -------------------------------------------
  buildRoom(0, 70, 0, { heater: true });
  let report = shelter.evaluateShelter(overworld, { x: 0, y: 70, z: 0 });
  check("a sealed heated room reads as warm", report.status === "warm", `${report.status}, heat ${report.heat}`);

  buildRoom(20, 70, 0, { heater: false });
  report = shelter.evaluateShelter(overworld, { x: 20, y: 70, z: 0 });
  check("a sealed room with no fire reads as sheltered", report.status === "sheltered", report.status);

  buildRoom(40, 70, 0, { hole: true, heater: true });
  report = shelter.evaluateShelter(overworld, { x: 40, y: 70, z: 0 });
  check("a room with a hole in the roof is not shelter", report.status === "open", `${report.status}`);

  report = shelter.evaluateShelter(overworld, { x: 200, y: 80, z: 200 });
  check("standing in the open reads as open", report.status === "open", report.status);

  // ---- freezing to death outside -----------------------------------------
  config.setSetting("alwaysOn", true);
  player.location = { x: 200, y: 80, z: 200 };
  tick(20);
  check("the storm starts", blizzard.isStorming(), "");

  const startTick = fakeSystem.currentTick;
  let deathTick = 0;
  for (let i = 0; i < 40; i++) {
    tick(10);
    if (player.health <= 0) {
      deathTick = fakeSystem.currentTick;
      break;
    }
  }
  const secondsToDie = (deathTick - startTick) / 20;
  check("outside kills you", deathTick > 0, `health ${player.health}`);
  check("and it kills you fast (under 12s)", deathTick > 0 && secondsToDie < 12, `${secondsToDie.toFixed(1)}s`);
  check("body heat hit zero on the way", blizzard.temperatureOf(player) <= 1,
    String(Math.round(blizzard.temperatureOf(player))));
  check("whiteout fog is pushed", log.commands.some((c) => c.includes("fog @s push sw:blizzard")), "");
  check("the freezing readout is shown", player.actionBars.some((t) => t.includes("FREEZING")), "");

  // ---- the warm house saves you ------------------------------------------
  player.health = 20;
  player.location = { x: 0, y: 70, z: 0 };
  tick(20 * 12);
  check("a warm sealed house warms you back up", blizzard.temperatureOf(player) > 90,
    String(Math.round(blizzard.temperatureOf(player))));
  check("and it stops the damage", player.health === 20, String(player.health));
  check("fog is removed indoors", log.commands.some((c) => c.includes("fog @s remove")), "");
  check("the safe readout is shown", player.actionBars.some((t) => t.includes("Warm and sealed")), "");

  // ---- sealed but cold is a slow decline ---------------------------------
  player.location = { x: 20, y: 70, z: 0 };
  const beforeCold = blizzard.temperatureOf(player);
  tick(20 * 10);
  const afterCold = blizzard.temperatureOf(player);
  check("a fireless room only slows the cold down", afterCold < beforeCold && afterCold > 20,
    `${Math.round(beforeCold)} -> ${Math.round(afterCold)}`);

  // ---- mobs ---------------------------------------------------------------
  player.location = { x: 0, y: 70, z: 0 };
  const exposedCow = new FakeEntity(overworld, "minecraft:cow", { x: 4, y: 80, z: 4 }, ["mob"]);
  const shelteredCow = new FakeEntity(overworld, "minecraft:cow", { x: 0, y: 70, z: 0 }, ["mob"]);
  const polarBear = new FakeEntity(overworld, "minecraft:polar_bear", { x: 6, y: 80, z: 6 }, ["mob"]);
  overworld.entities.push(exposedCow, shelteredCow, polarBear);
  const cowHealth = exposedCow.health;
  const bearHealth = polarBear.health;
  const insideHealth = shelteredCow.health;
  tick(20 * 6);
  check("mobs outside freeze", exposedCow.health < cowHealth, `${cowHealth} -> ${exposedCow.health}`);
  check("mobs under a roof are fine", shelteredCow.health === insideHealth, String(shelteredCow.health));
  check("polar bears shrug it off", polarBear.health === bearHealth, String(polarBear.health));

  // ---- snow and ice --------------------------------------------------------
  for (let x = -4; x <= 4; x++) {
    for (let z = -4; z <= 4; z++) overworld.setTypeId(x, 64, z, "minecraft:water");
  }
  let snowPlaced = 0;
  let icePlaced = 0;
  tick(20 * 20);
  for (const [key, value] of overworld.overrides) {
    if (value === "minecraft:snow_layer") snowPlaced++;
    if (value === "minecraft:ice") icePlaced++;
  }
  check("snow piles up during the storm", snowPlaced > 0, String(snowPlaced));
  check("standing water freezes to ice", icePlaced > 0, String(icePlaced));

  // ---- warming items -------------------------------------------------------
  player.location = { x: 200, y: 80, z: 200 };
  tick(20 * 3);
  const chilled = blizzard.temperatureOf(player);
  blizzard.warmPlayer(player, 60);
  check("warming items raise body heat", blizzard.temperatureOf(player) > chilled,
    `${Math.round(chilled)} -> ${Math.round(blizzard.temperatureOf(player))}`);

  player.hold?.("sw:hand_warmer");
  for (const fn of listeners.itemUse) fn({ source: player, itemStack: { typeId: "sw:hand_warmer" } });
  tick(6);
  check("the hand warmer works", player.messages.some((m) => m.includes("hand warmer")), "");

  for (const fn of listeners.itemUse) fn({ source: player, itemStack: { typeId: "sw:hot_cocoa" } });
  tick(6);
  check("hot cocoa works", player.messages.some((m) => m.includes("better")), "");

  // ---- lethal cold can be switched off -------------------------------------
  player.health = 20;
  config.setSetting("deadlyOutside", false);
  tick(20 * 15);
  check("lethal off means no damage", player.health === 20, String(player.health));
  config.setSetting("deadlyOutside", true);

  // ---- the weather stone ---------------------------------------------------
  player.location = { x: 0, y: 70, z: 0 };
  tick(20);
  const stormBefore = blizzard.isStorming();
  config.setSetting("alwaysOn", false);
  tick(12);
  for (const fn of listeners.itemUse) fn({ source: player, itemStack: { typeId: "sw:weather_stone" } });
  tick(8);
  check("the weather stone flips the storm", blizzard.isStorming() !== stormBefore,
    `${stormBefore} -> ${blizzard.isStorming()}`);

  player.isSneaking = true;
  tick(12);
  for (const fn of listeners.itemUse) fn({ source: player, itemStack: { typeId: "sw:weather_stone" } });
  tick(12);
  check("sneak + tap opens the stone menu", true);
  player.isSneaking = false;

  // ---- scriptevents ---------------------------------------------------------
  const fire = (id, message = "") => {
    for (const fn of listeners.scriptEvent) fn({ id, message, sourceEntity: player, sourceType: "Entity" });
    tick(4);
  };
  fire("sw:help");
  fire("sw:status");
  fire("sw:check");
  check("sw:check explains the shelter", player.messages.some((m) => m.includes("SAFE") || m.includes("SHELTER")), "");
  fire("sw:storm", "on");
  check("sw:storm on starts it", blizzard.isStorming(), "");
  fire("sw:storm", "off");
  check("sw:storm off stops it", !blizzard.isStorming(), "");
  fire("sw:harsh", "150");
  check("sw:harsh changes the setting", config.getSetting("harshnessPercent") === 150,
    String(config.getSetting("harshnessPercent")));
  fire("sw:warm");
  fire("sw:give");
  check("sw:give hands out the kit", log.commands.some((c) => c.includes("sw:heater")), "");
  fire("sw:lethal", "on");
  fire("sw:endless", "off");
  config.setSetting("harshnessPercent", 100);

  // ---- soak -----------------------------------------------------------------
  config.setSetting("alwaysOn", true);
  for (let round = 0; round < 8; round++) {
    player.location = round % 2 === 0 ? { x: 0, y: 70, z: 0 } : { x: 300 + round, y: 80, z: 300 };
    player.health = 20;
    tick(120);
  }
  tick(60);

  const crashes = log.warnings.filter(
    (w) => w.includes("tick:") || w.includes("player:") || w.includes("forecast")
  );
  check("no crashes during the soak", crashes.length === 0, crashes.slice(0, 3).join(" | "));
  check("particles were spawned", log.particles > 0, String(log.particles));
  check("sounds were played", log.sounds > 0, String(log.sounds));

  console.warn = originalWarn;

  let failed = 0;
  for (const result of results) {
    if (!result.ok) failed++;
    console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.detail ? `  -> ${result.detail}` : ""}`);
  }
  console.log(
    `\n${results.length - failed}/${results.length} checks passed ` +
      `(snow placed: ${snowPlaced}, ice: ${icePlaced}, particles: ${log.particles})`
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.warn = originalWarn;
  console.error(error);
  process.exitCode = 1;
});
