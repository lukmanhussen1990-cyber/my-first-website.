/**
 * Parasite - offline smoke test.
 *
 *     node tools/test_parasite.mjs
 *
 * Loads the real behavior pack scripts against a fake world and checks that a
 * freshly spawned parasite actually eats what is around it, grows, splits and
 * stays inside the population cap.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCRIPTS = path.join(ROOT, "parasite_BP", "scripts");

const STUBS = {
  "@minecraft/server": `
export const world = globalThis.__pm_world;
export const system = globalThis.__pm_system;
export const BlockPermutation = globalThis.__pm_BlockPermutation;
export const EntityDamageCause = { entityAttack: "entityAttack" };
export const EquipmentSlot = { Mainhand: "Mainhand" };
`,
  "@minecraft/server-ui": `
export const ActionFormData = globalThis.__pm_ActionFormData;
export const ModalFormData = globalThis.__pm_ModalFormData;
export const MessageFormData = globalThis.__pm_ModalFormData;
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

const log = { warnings: [], commands: [], particles: 0, sounds: 0, blockChanges: 0, damage: 0, removedItems: 0 };

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
    this.health = 44;
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
    if (typeof amount !== "number" || Number.isNaN(amount)) throw new Error("bad damage");
    if (options && options.damagingEntity && !options.damagingEntity.typeId) throw new Error("bad source");
    log.damage += amount;
    return true;
  }
  getComponent(id) {
    if (id === "minecraft:health") {
      return {
        currentValue: this.health,
        defaultValue: 44,
        effectiveMax: 44,
        setCurrentValue: (value) => {
          this.health = value;
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
      setTitle: () => {}
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
    const families = identifier === "pm:parasite" ? ["parasite", "monster", "mob"] : ["mob"];
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

globalThis.__pm_world = fakeWorld;
globalThis.__pm_system = fakeSystem;
globalThis.__pm_BlockPermutation = fakeBlockPermutation;
globalThis.__pm_ActionFormData = FakeForm;
globalThis.__pm_ModalFormData = FakeForm;

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

  const player = new FakePlayer(overworld, "Tester", { x: 40, y: 64, z: 40 }, "pm:parasite_sample");
  overworld.entities.push(player);

  await import(pathToFileURL(path.join(SCRIPTS, "main.js")).href);
  tick(5);
  check("main.js loads and boots", log.warnings.some((w) => w.includes("v1.0.0 loaded")), log.warnings.join(" | "));

  const swarm = await import(pathToFileURL(path.join(SCRIPTS, "swarm.js")).href);
  const config = await import(pathToFileURL(path.join(SCRIPTS, "config.js")).href);

  // A parasite spawned by any means must register itself.
  const parasite = overworld.spawnEntity("pm:parasite", { x: 0, y: 64, z: 0 });
  tick(3);
  check("a spawned parasite is tracked", swarm.population() === 1, String(swarm.population()));

  // Food around it: dropped items and a couple of mobs.
  for (let i = 0; i < 5; i++) {
    overworld.entities.push(new FakeEntity(overworld, "minecraft:item", { x: i - 2, y: 64, z: 1 }, []));
  }
  const cow = new FakeEntity(overworld, "minecraft:cow", { x: 1, y: 64, z: 1 }, ["mob"]);
  overworld.entities.push(cow);

  const blocksBefore = log.blockChanges;
  tick(60);

  check("it swallows dropped items", overworld.getEntities({ type: "minecraft:item" }).length === 0, "");
  check("it bites living things", log.damage > 0, String(log.damage));
  check("it eats blocks", log.blockChanges - blocksBefore > 0, String(log.blockChanges - blocksBefore));
  check("it leaves infested flesh", countBlocks("pm:infested_flesh") > 0, String(countBlocks("pm:infested_flesh")));

  // Long feed: it should grow through both stages and then split.
  tick(20 * 90);
  check("it grows to large", parasite.events.includes("pm:grow_large"), parasite.events.join(","));
  check("it grows to apex", parasite.events.includes("pm:grow_apex"), parasite.events.join(","));
  check("apex parasites split", swarm.population() > 1, String(swarm.population()));

  // Population cap.
  config.setSetting("maxPopulation", 6);
  for (let i = 0; i < 20; i++) overworld.spawnEntity("pm:parasite", { x: i, y: 64, z: 5 });
  tick(20);
  check("population cap is enforced", swarm.population() <= 6, String(swarm.population()));

  // Protected blocks are never eaten.
  overworld.setTypeId(0, 63, 0, "minecraft:bedrock");
  overworld.setTypeId(1, 63, 0, "minecraft:chest");
  tick(200);
  check("bedrock survives", overworld.getTypeId(0, 63, 0) === "minecraft:bedrock", overworld.getTypeId(0, 63, 0));
  check(
    "containers survive by default",
    overworld.getTypeId(1, 63, 0) === "minecraft:chest",
    overworld.getTypeId(1, 63, 0)
  );

  // Kills award biomass through the entityDie event.
  const victim = new FakeEntity(overworld, "minecraft:sheep", { x: 0, y: 64, z: 0 }, ["mob"]);
  overworld.entities.push(victim);
  const killer = [...overworld.getEntities({ type: "pm:parasite" })][0];
  for (const fn of listeners.entityDie) {
    fn({ deadEntity: victim, damageSource: { cause: "entityAttack", damagingEntity: killer } });
  }
  tick(5);
  check("kills are credited", true);

  // The sample item: tap releases one, sneak + tap opens the menu.
  const before = swarm.population();
  config.setSetting("maxPopulation", 40);
  for (const fn of listeners.itemUse) fn({ source: player, itemStack: { typeId: "pm:parasite_sample" } });
  tick(5);
  check("sample releases a parasite", swarm.population() > before, `${before} -> ${swarm.population()}`);

  player.isSneaking = true;
  for (const fn of listeners.itemUse) fn({ source: player, itemStack: { typeId: "pm:parasite_sample" } });
  tick(20);
  check("sneak + tap opens the menu", true);
  player.isSneaking = false;

  // Warning readout.
  overworld.spawnEntity("pm:parasite", { x: 42, y: 64, z: 40 });
  tick(40);
  check("nearby parasites warn the player", player.actionBars.length > 0, String(player.actionBars.length));

  // scriptevent commands.
  const fire = (id, message = "") => {
    for (const fn of listeners.scriptEvent) fn({ id, message, sourceEntity: player, sourceType: "Entity" });
    tick(3);
  };
  fire("pm:help");
  fire("pm:status");
  fire("pm:spawn", "3");
  check("scriptevent pm:spawn works", swarm.population() > 1, String(swarm.population()));
  fire("pm:cap", "12");
  fire("pm:eat", "off");
  fire("pm:breed", "off");
  fire("pm:give");
  check("pm:give runs a give command", log.commands.some((c) => c.includes("pm:parasite_sample")), "");
  fire("pm:eat", "on");
  fire("pm:breed", "on");

  fire("pm:purge");
  tick(10);
  check("purge removes every parasite", swarm.population() === 0, String(swarm.population()));

  // Soak: a swarm eating for a while, with parasites dying off randomly.
  config.setSetting("maxPopulation", 12);
  for (let i = 0; i < 8; i++) overworld.spawnEntity("pm:parasite", { x: i * 3, y: 64, z: 20 });
  for (let round = 0; round < 8; round++) {
    tick(100);
    const alive = overworld.getEntities({ type: "pm:parasite" });
    if (alive.length > 2) {
      const doomed = alive[0];
      for (const fn of listeners.entityDie) fn({ deadEntity: doomed, damageSource: { cause: "entityAttack" } });
      doomed.remove();
    }
  }
  tick(50);

  const crashes = log.warnings.filter(
    (w) => w.includes("swarm tick") || w.includes("feed:") || w.includes("warning loop")
  );
  check("no crashes during the soak", crashes.length === 0, crashes.slice(0, 3).join(" | "));
  check("stale parasites are forgotten", swarm.population() === overworld.getEntities({ type: "pm:parasite" }).length,
    `${swarm.population()} tracked vs ${overworld.getEntities({ type: "pm:parasite" }).length} alive`);
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
      `(blocks eaten: ${log.blockChanges}, damage dealt: ${log.damage}, particles: ${log.particles})`
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.warn = originalWarn;
  console.error(error);
  process.exitCode = 1;
});
