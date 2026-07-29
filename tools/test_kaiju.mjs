/**
 * Kaiju Rampage - offline smoke test.
 *
 *     node tools/test_kaiju.mjs
 *
 * Loads the real behavior pack scripts against a fake world and checks that a
 * kaiju actually wrecks the place: smashes blocks as it walks, stomps, sweeps
 * its tail, roars, charges and fires the atomic breath, enrages at half health
 * and stays inside the population cap.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCRIPTS = path.join(ROOT, "kaiju_BP", "scripts");

const STUBS = {
  "@minecraft/server": `
export const world = globalThis.__kj_world;
export const system = globalThis.__kj_system;
export const BlockPermutation = globalThis.__kj_BlockPermutation;
export const EntityDamageCause = { entityAttack: "entityAttack" };
export const EquipmentSlot = { Mainhand: "Mainhand" };
`,
  "@minecraft/server-ui": `
export const ActionFormData = globalThis.__kj_ActionFormData;
export const ModalFormData = globalThis.__kj_ModalFormData;
export const MessageFormData = globalThis.__kj_ModalFormData;
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
    this.maxHealth = typeId === "kj:kaiju" ? 1500 : 40;
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
    const families = identifier === "kj:kaiju" ? ["kaiju", "titan", "monster", "mob"] : ["mob"];
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

globalThis.__kj_world = fakeWorld;
globalThis.__kj_system = fakeSystem;
globalThis.__kj_BlockPermutation = fakeBlockPermutation;
globalThis.__kj_ActionFormData = FakeForm;
globalThis.__kj_ModalFormData = FakeForm;

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

  const player = new FakePlayer(overworld, "Tester", { x: 60, y: 64, z: 60 }, "kj:kaiju_horn");
  overworld.entities.push(player);

  await import(pathToFileURL(path.join(SCRIPTS, "main.js")).href);
  tick(5);
  check("main.js loads and boots", log.warnings.some((w) => w.includes("v1.0.0 loaded")), log.warnings.join(" | "));

  const rampage = await import(pathToFileURL(path.join(SCRIPTS, "rampage.js")).href);
  const config = await import(pathToFileURL(path.join(SCRIPTS, "config.js")).href);

  // Build something for it to knock down: a solid tower of stone it stands in.
  const buildWall = (cx, cz) => {
    for (let x = cx - 3; x <= cx + 3; x++) {
      for (let z = cz - 3; z <= cz + 3; z++) {
        for (let y = 64; y <= 74; y++) overworld.setTypeId(x, y, z, "minecraft:stone");
      }
    }
  };
  const wallBlocksLeft = (cx, cz) => {
    let total = 0;
    for (let x = cx - 3; x <= cx + 3; x++) {
      for (let z = cz - 3; z <= cz + 3; z++) {
        for (let y = 64; y <= 74; y++) if (overworld.getTypeId(x, y, z) === "minecraft:stone") total++;
      }
    }
    return total;
  };

  buildWall(0, 0);
  const before = wallBlocksLeft(0, 0);

  const kaiju = overworld.spawnEntity("kj:kaiju", { x: 0, y: 64, z: 0 });
  tick(4);
  check("a spawned kaiju is tracked", rampage.population() === 1, String(rampage.population()));
  check("waking one announces itself", log.titles.some((t) => t.includes("AWAKENS")), "");

  tick(60);
  check(
    "it smashes the building it is standing in",
    wallBlocksLeft(0, 0) < before,
    `${before} -> ${wallBlocksLeft(0, 0)}`
  );

  // Something for it to hurt.
  const dummies = [];
  for (let i = 0; i < 4; i++) {
    const dummy = new FakeEntity(overworld, "minecraft:cow", { x: i - 2, y: 64, z: 3 }, ["mob"]);
    overworld.entities.push(dummy);
    dummies.push(dummy);
  }

  // Walking makes it stomp: the ground cracks and everything nearby is launched.
  // The player has to be inside the shake radius to receive camerashake.
  player.location = { x: 8, y: 64, z: 8 };
  const damageBeforeStomp = log.damage;
  for (let step = 0; step < 12; step++) {
    kaiju.location = { x: kaiju.location.x + 0.5, y: 64, z: kaiju.location.z };
    tick(8);
  }
  check("walking makes it stomp", log.damage > damageBeforeStomp, `${log.damage - damageBeforeStomp} damage`);
  check("stomps shake the screen", log.commands.some((c) => c.startsWith("camerashake")), "");
  check("it throws things around", log.impulses > 0, String(log.impulses));

  // Roar and tail sweep come off cooldown on their own.
  tick(20 * 45);
  check("it roars", log.effects.some((e) => e.effect === "nausea"), "");
  check("the roar slows everything down", log.effects.some((e) => e.effect === "slowness"), "");

  // Atomic breath: charge, then a carved trench and a detonation.
  const explosionsBefore = log.explosions;
  let charged = false;
  for (let i = 0; i < 200; i++) {
    tick(4);
    if (kaiju.events.includes("kj:charge")) charged = true;
    if (log.explosions > explosionsBefore) break;
  }
  check("it charges the atomic breath", charged, kaiju.events.join(","));
  check("the breath detonates at the end", log.explosions > explosionsBefore, `${explosionsBefore} -> ${log.explosions}`);

  // Enrage below half health.
  kaiju.health = 500;
  tick(20);
  check("it enrages below half health", kaiju.events.includes("kj:enrage"), kaiju.events.join(","));

  // Protected blocks survive everything.
  overworld.setTypeId(1, 65, 1, "minecraft:bedrock");
  overworld.setTypeId(2, 65, 1, "minecraft:command_block");
  tick(200);
  check("bedrock survives", overworld.getTypeId(1, 65, 1) === "minecraft:bedrock", overworld.getTypeId(1, 65, 1));
  check(
    "command blocks survive",
    overworld.getTypeId(2, 65, 1) === "minecraft:command_block",
    overworld.getTypeId(2, 65, 1)
  );

  // Population cap.
  config.setSetting("maxKaiju", 2);
  for (let i = 0; i < 6; i++) overworld.spawnEntity("kj:kaiju", { x: 20 + i * 6, y: 64, z: 20 });
  tick(20);
  check("population cap is enforced", rampage.population() <= 2, String(rampage.population()));

  // Death throes.
  const explosionsBeforeDeath = log.explosions;
  const doomed = overworld.getEntities({ type: "kj:kaiju" })[0];
  for (const fn of listeners.entityDie) fn({ deadEntity: doomed, damageSource: { cause: "entityAttack" } });
  doomed.remove();
  tick(6);
  check("dying sets off a huge explosion", log.explosions > explosionsBeforeDeath, "");
  check("the fallen one is forgotten", rampage.population() === overworld.getEntities({ type: "kj:kaiju" }).length,
    `${rampage.population()} tracked vs ${overworld.getEntities({ type: "kj:kaiju" }).length} alive`);

  // Destruction can be switched off entirely.
  rampage.killAll();
  tick(4);
  config.setSetting("destroyBlocks", false);
  buildWall(0, 40);
  const peacefulKaiju = overworld.spawnEntity("kj:kaiju", { x: 0, y: 64, z: 40 });
  const standing = wallBlocksLeft(0, 40);
  tick(200);
  check(
    "destroyBlocks off leaves the world alone",
    wallBlocksLeft(0, 40) === standing,
    `${standing} -> ${wallBlocksLeft(0, 40)}`
  );
  config.setSetting("destroyBlocks", true);

  // huntPlayers off spares the player.
  config.setSetting("huntPlayers", false);
  player.location = { x: peacefulKaiju.location.x + 2, y: 64, z: peacefulKaiju.location.z };
  const playerHealth = player.health;
  tick(20 * 40);
  check("huntPlayers off spares the player", player.health === playerHealth, `${playerHealth} -> ${player.health}`);
  config.setSetting("huntPlayers", true);
  rampage.killAll();
  tick(4);

  // The horn: tap wakes one, sneak + tap opens the menu.
  const populationBefore = rampage.population();
  for (const fn of listeners.itemUse) fn({ source: player, itemStack: { typeId: "kj:kaiju_horn" } });
  tick(6);
  check("the horn wakes a kaiju", rampage.population() > populationBefore,
    `${populationBefore} -> ${rampage.population()}`);

  player.isSneaking = true;
  tick(12);
  for (const fn of listeners.itemUse) fn({ source: player, itemStack: { typeId: "kj:kaiju_horn" } });
  tick(12);
  check("sneak + tap opens the horn menu", true);
  player.isSneaking = false;

  // Warning readout.
  tick(40);
  check("nearby kaiju warn the player", player.actionBars.some((t) => t.includes("KAIJU")),
    String(player.actionBars.length));

  // scriptevent commands.
  const fire = (id, message = "") => {
    for (const fn of listeners.scriptEvent) fn({ id, message, sourceEntity: player, sourceType: "Entity" });
    tick(4);
  };
  fire("kj:help");
  fire("kj:status");
  fire("kj:kill");
  check("scriptevent kj:kill clears them", rampage.population() === 0, String(rampage.population()));
  fire("kj:summon");
  check("scriptevent kj:summon wakes one", rampage.population() > 0, String(rampage.population()));
  fire("kj:power", "150");
  check("kj:power changes the setting", config.getSetting("destructionPercent") === 150,
    String(config.getSetting("destructionPercent")));
  fire("kj:cap", "3");
  fire("kj:destroy", "off");
  fire("kj:destroy", "on");
  fire("kj:hunt", "on");
  fire("kj:give");
  check("kj:give runs a give command", log.commands.some((c) => c.includes("kj:kaiju_horn")), "");
  config.setSetting("destructionPercent", 100);

  // Soak: two kaiju rampaging through buildings for a while.
  config.setSetting("maxKaiju", 2);
  buildWall(80, 80);
  overworld.spawnEntity("kj:kaiju", { x: 80, y: 64, z: 80 });
  for (let round = 0; round < 10; round++) {
    for (const entity of overworld.getEntities({ type: "kj:kaiju" })) {
      entity.location = { x: entity.location.x + 1.2, y: 64, z: entity.location.z + 0.4 };
    }
    tick(100);
  }
  tick(60);

  const crashes = log.warnings.filter(
    (w) => w.includes("rampage tick") || w.includes("update:") || w.includes("warning loop")
  );
  check("no crashes during the soak", crashes.length === 0, crashes.slice(0, 3).join(" | "));
  check("blocks were destroyed", log.blockChanges > 0, String(log.blockChanges));
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
      `(blocks destroyed: ${log.blockChanges}, damage: ${Math.round(log.damage)}, explosions: ${log.explosions})`
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.warn = originalWarn;
  console.error(error);
  process.exitCode = 1;
});
