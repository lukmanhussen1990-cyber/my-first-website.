/**
 * Imran Security House - offline smoke test.
 *
 *     node tools/test_imran.mjs
 *
 * Loads the real behavior pack scripts against a fake world and checks the two
 * halves of the pack: that the house actually goes up with IMRAN spelled out on
 * it and zaps zombies that get inside, and that typing the phrase in chat sends
 * a thousand violent zombies without ever exceeding the alive cap.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCRIPTS = path.join(ROOT, "imran_BP", "scripts");

const STUBS = {
  "@minecraft/server": `
export const world = globalThis.__ih_world;
export const system = globalThis.__ih_system;
export const BlockPermutation = globalThis.__ih_BlockPermutation;
export const EntityDamageCause = { entityAttack: "entityAttack" };
export const EquipmentSlot = { Mainhand: "Mainhand" };
`,
  "@minecraft/server-ui": `
export const ActionFormData = globalThis.__ih_ActionFormData;
export const ModalFormData = globalThis.__ih_ModalFormData;
export const MessageFormData = globalThis.__ih_ModalFormData;
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
  chatSend: [],
  beforeItemUse: [],
  beforeItemUse: [],
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
  beforeEvents: {
    itemUse: { subscribe: (fn) => listeners.beforeItemUse.push(fn) },
    chatSend: { subscribe: (fn) => listeners.chatSend.push(fn) }
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

globalThis.__ih_world = fakeWorld;
globalThis.__ih_system = fakeSystem;
globalThis.__ih_BlockPermutation = fakeBlockPermutation;
globalThis.__ih_ActionFormData = FakeForm;
globalThis.__ih_ModalFormData = FakeForm;

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

  const house = await import(pathToFileURL(path.join(SCRIPTS, "house.js")).href);
  const horde = await import(pathToFileURL(path.join(SCRIPTS, "horde.js")).href);
  const config = await import(pathToFileURL(path.join(SCRIPTS, "config.js")).href);

  // ---- the house ----------------------------------------------------------
  const plan = house.describeHouse(config.TUNING.house);
  check("the house has a plan", plan.length > 500, `${plan.length} blocks`);

  const letters = house.nameplate(config.TUNING.house.width, 8, "minecraft:gold_block");
  check("IMRAN is spelled out", letters.length > 40, `${letters.length} gold blocks`);
  const letterXs = letters.map((piece) => piece.x);
  check(
    "the name fits on the front wall",
    Math.min(...letterXs) >= 0 && Math.max(...letterXs) < config.TUNING.house.width,
    `${Math.min(...letterXs)}..${Math.max(...letterXs)} of ${config.TUNING.house.width}`
  );

  const blocksBefore = log.blockChanges;
  const built = house.buildHouse(player);
  check("the house starts building", built.ok, built.reason ?? "");
  tick(20 * 20);
  check("the house finished going up", house.houseCount() === 1, String(house.houseCount()));
  check("it placed a lot of blocks", log.blockChanges - blocksBefore > 500, String(log.blockChanges - blocksBefore));

  let goldPlaced = 0;
  let ironPlaced = 0;
  let doorPlaced = 0;
  for (const value of overworld.overrides.values()) {
    if (value === "minecraft:gold_block") goldPlaced++;
    if (value === "minecraft:iron_block") ironPlaced++;
    if (value === "minecraft:iron_door") doorPlaced++;
  }
  check("the gold name plate is on the wall", goldPlaced > 40, String(goldPlaced));
  check("it has iron pillars", ironPlaced > 0, String(ironPlaced));
  check("it has a door", doorPlaced > 0 || log.commands.some((c) => c.includes("iron_door")), String(doorPlaced));

  // ---- the security system ------------------------------------------------
  const houseCentre = { x: player.location.x, y: player.location.y, z: player.location.z };
  let inside = false;
  for (let dx = -20; dx <= 20 && !inside; dx++) {
    for (let dz = -20; dz <= 20 && !inside; dz++) {
      const probe = { x: player.location.x + dx, y: player.location.y + 1, z: player.location.z + dz };
      if (house.insideAHouse(overworld, probe)) {
        inside = true;
        houseCentre.x = probe.x;
        houseCentre.y = probe.y;
        houseCentre.z = probe.z;
      }
    }
  }
  check("the house registers a protected zone", inside, "");

  const intruder = overworld.spawnEntity("ih:violent_zombie", houseCentre);
  const intruderHealth = intruder.health;
  tick(60);
  check("zombies inside the house get zapped", intruder.health < intruderHealth,
    `${intruderHealth} -> ${intruder.health}`);

  const outsider = overworld.spawnEntity("ih:violent_zombie", { x: player.location.x + 60, y: 70, z: player.location.z + 60 });
  const outsiderHealth = outsider.health;
  tick(40);
  check("zombies outside are left alone", outsider.health === outsiderHealth, String(outsider.health));
  outsider.remove();
  if (intruder.isValid()) intruder.remove();

  // ---- the disaster -------------------------------------------------------
  config.setSetting("hordeTotal", 1000);
  config.setSetting("hordeMaxAlive", 60);
  config.setSetting("hordeWaveSize", 12);

  // Typing the phrase in chat is the headline feature.
  let cancelled = false;
  for (const fn of listeners.chatSend) {
    const event = { message: "zombie disaster", sender: player, get cancel() { return cancelled; }, set cancel(v) { cancelled = v; } };
    fn(event);
  }
  tick(10);
  check("typing in chat starts the disaster", horde.isActive(), "");
  check("the chat message is swallowed", cancelled, "");
  check("the disaster is announced", log.titles.some((t) => t.includes("ZOMBIE DISASTER")), "");

  tick(20 * 30);
  let state = horde.hordeState();
  check("zombies are being sent", state.spawned > 50, `${state.spawned} sent`);
  const aliveNow = overworld.getEntities({ type: "ih:violent_zombie" }).length;
  check("the alive cap is respected", aliveNow <= 60 + 12, `${aliveNow} alive, cap 60`);
  check("the horde readout is shown", player.actionBars.some((t) => t.includes("HORDE")), "");

  // Kill some off and check the horde tops itself back up.
  const before = horde.hordeState().spawned;
  for (const zombie of overworld.getEntities({ type: "ih:violent_zombie" }).slice(0, 30)) {
    for (const fn of listeners.entityDie) fn({ deadEntity: zombie, damageSource: { cause: "entityAttack" } });
    zombie.remove();
  }
  tick(20 * 10);
  check("it tops itself back up", horde.hordeState().spawned > before,
    `${before} -> ${horde.hordeState().spawned}`);
  check("kills are counted", horde.hordeState().killed >= 30, String(horde.hordeState().killed));

  // Bombers explode when they die.
  config.setSetting("bomberPercent", 100);
  const explosionsBefore = log.explosions;
  const bomber = overworld.spawnEntity("ih:violent_zombie", { x: 30, y: 70, z: 30 });
  bomber.variant = 1;
  bomber.getComponent = (id) => (id === "minecraft:variant" ? { value: 1 } : undefined);
  for (const fn of listeners.entityDie) fn({ deadEntity: bomber, damageSource: { cause: "entityAttack" } });
  tick(5);
  check("bombers explode when killed", log.explosions > explosionsBefore, `${explosionsBefore} -> ${log.explosions}`);
  config.setSetting("bomberPercent", 15);

  // Stopping clears the field.
  const cleared = horde.stopHorde(false);
  tick(10);
  check("stopping clears every zombie", overworld.getEntities({ type: "ih:violent_zombie" }).length === 0,
    `${cleared} removed`);
  check("the disaster is over", !horde.isActive(), "");

  // ---- items ---------------------------------------------------------------
  tick(20);
  const housesBefore = house.houseCount();
  for (const fn of listeners.itemUse) fn({ source: player, itemStack: { typeId: "ih:imran_house" } });
  tick(20 * 20);
  check("the deployer builds a house", house.houseCount() > housesBefore,
    `${housesBefore} -> ${house.houseCount()}`);

  tick(20);
  for (const fn of listeners.itemUse) fn({ source: player, itemStack: { typeId: "ih:horde_totem" } });
  tick(10);
  check("the totem starts a disaster", horde.isActive(), "");
  tick(20);
  for (const fn of listeners.itemUse) fn({ source: player, itemStack: { typeId: "ih:horde_totem" } });
  tick(10);
  check("tapping it again stops the disaster", !horde.isActive(), "");

  player.isSneaking = true;
  tick(20);
  for (const fn of listeners.itemUse) fn({ source: player, itemStack: { typeId: "ih:imran_house" } });
  tick(15);
  check("sneak + tap opens the menu", true);
  player.isSneaking = false;

  // ---- scriptevents --------------------------------------------------------
  const fire = (id, message = "") => {
    for (const fn of listeners.scriptEvent) fn({ id, message, sourceEntity: player, sourceType: "Entity" });
    tick(4);
  };
  fire("ih:help");
  fire("ih:status");
  fire("ih:horde", "40");
  check("scriptevent ih:horde works", horde.isActive(), "");
  fire("ih:stop");
  check("scriptevent ih:stop works", !horde.isActive(), "");
  fire("ih:alive", "120");
  check("ih:alive changes the cap", config.getSetting("hordeMaxAlive") === 120,
    String(config.getSetting("hordeMaxAlive")));
  fire("ih:give");
  check("ih:give hands out both items", log.commands.some((c) => c.includes("ih:imran_house")), "");
  const countBeforeRemove = house.houseCount();
  fire("ih:removehouse");
  check("ih:removehouse clears one", house.houseCount() < countBeforeRemove,
    `${countBeforeRemove} -> ${house.houseCount()}`);

  // ---- soak ----------------------------------------------------------------
  config.setSetting("hordeMaxAlive", 40);
  horde.startHorde(200);
  for (let round = 0; round < 6; round++) {
    tick(120);
    for (const zombie of overworld.getEntities({ type: "ih:violent_zombie" }).slice(0, 10)) {
      for (const fn of listeners.entityDie) fn({ deadEntity: zombie, damageSource: { cause: "entityAttack" } });
      zombie.remove();
    }
  }
  horde.stopHorde(false);
  tick(20);

  const crashes = log.warnings.filter(
    (w) => w.includes("horde tick") || w.includes("house loop") || w.includes("chatSend")
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
      `(blocks placed: ${log.blockChanges}, zombies sent: ${horde.hordeState().spawned})`
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.warn = originalWarn;
  console.error(error);
  process.exitCode = 1;
});
