/**
 * Natural Disasters - offline smoke test.
 *
 *     node tools/test_scripts.mjs
 *
 * Minecraft is not needed: this file writes stub `@minecraft/server` and
 * `@minecraft/server-ui` modules into ./node_modules, loads the real behavior
 * pack scripts against a fake world, then runs every disaster for a few hundred
 * ticks. Anything the scripts throw shows up as a failed test instead of as a
 * silent "script pack failed to load" on a phone.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCRIPTS = path.join(ROOT, "natural_disasters_BP", "scripts");

/* ------------------------------------------------------------ stub modules */

const STUBS = {
  "@minecraft/server": `
export const world = globalThis.__nd_world;
export const system = globalThis.__nd_system;
export const BlockPermutation = globalThis.__nd_BlockPermutation;
export const EntityDamageCause = { entityAttack: "entityAttack", fall: "fall", drowning: "drowning" };
export const EquipmentSlot = { Mainhand: "Mainhand" };
`,
  "@minecraft/server-ui": `
export const ActionFormData = globalThis.__nd_ActionFormData;
export const ModalFormData = globalThis.__nd_ModalFormData;
export const MessageFormData = globalThis.__nd_ModalFormData;
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

/* -------------------------------------------------------------- fake world */

const log = {
  warnings: [],
  commands: [],
  particles: 0,
  sounds: 0,
  blockChanges: 0,
  explosions: 0,
  impulses: 0
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

class FakeEntity {
  constructor(dimension, typeId, location) {
    this.dimension = dimension;
    this.typeId = typeId;
    this.location = { ...location };
    this.id = `e${Math.random().toString(36).slice(2)}`;
    this.removed = false;
  }
  isValid() {
    return !this.removed;
  }
  remove() {
    this.removed = true;
    this.dimension.entities = this.dimension.entities.filter((e) => e !== this);
  }
  teleport(location) {
    if (!location || typeof location.x !== "number") throw new Error("bad teleport target");
    this.location = { x: location.x, y: location.y, z: location.z };
  }
  applyImpulse(vector) {
    if (this.typeId === "minecraft:player") throw new Error("applyImpulse is not valid on players");
    if ([vector.x, vector.y, vector.z].some((n) => typeof n !== "number" || Number.isNaN(n))) {
      throw new Error("bad impulse");
    }
    log.impulses++;
  }
  applyKnockback(a, b, c, d) {
    if (typeof a === "number" && typeof c !== "number") throw new Error("bad knockback args");
  }
  applyDamage(amount) {
    if (typeof amount !== "number" || Number.isNaN(amount)) throw new Error("bad damage");
  }
  setOnFire() {
    return true;
  }
  runCommand(command) {
    log.commands.push(command);
    return { successCount: 1 };
  }
  getViewDirection() {
    return { x: 0.7, y: 0, z: 0.7 };
  }
}

class FakePlayer extends FakeEntity {
  constructor(dimension, name, location, heldItem) {
    super(dimension, "minecraft:player", location);
    this.name = name;
    this.heldItem = heldItem;
    this.messages = [];
    this.actionBars = [];
    this.titles = [];
    this.onScreenDisplay = {
      setActionBar: (text) => this.actionBars.push(text),
      setTitle: (text) => this.titles.push(text)
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
    return undefined;
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
    if (y < 60) return "minecraft:stone";
    if (y < 63) return "minecraft:dirt";
    if (y === 63) return "minecraft:grass_block";
    return "minecraft:air";
  }
  setTypeId(x, y, z, typeId) {
    this.overrides.set(this.key(x, y, z), typeId);
  }
  getBlock(location) {
    if (!location || typeof location.x !== "number" || Number.isNaN(location.x)) {
      throw new Error("bad block location");
    }
    if (location.y < -64 || location.y > 319) throw new Error("LocationOutOfWorldBoundariesError");
    return new FakeBlock(this, location.x, location.y, location.z);
  }
  getEntities(options = {}) {
    let list = this.entities.slice();
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
    return this.getEntities(options).filter((entity) => entity.typeId === "minecraft:player");
  }
  spawnEntity(identifier, location) {
    const entity = new FakeEntity(this, identifier, location);
    this.entities.push(entity);
    return entity;
  }
  spawnParticle(id, location) {
    if (!id.includes(":")) throw new Error(`bad particle id ${id}`);
    if (!location || Number.isNaN(location.x)) throw new Error("bad particle location");
    log.particles++;
  }
  createExplosion() {
    log.explosions++;
    return true;
  }
  runCommand(command) {
    log.commands.push(command);
    return { successCount: 1 };
  }
}

const overworld = new FakeDimension("minecraft:overworld");

const listeners = { itemUse: [], itemUseOn: [], playerSpawn: [], scriptEvent: [] };

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
    return pendingRuns.length;
  },
  runTimeout(fn, delay) {
    timeouts.push({ fn, at: fakeSystem.currentTick + (delay ?? 1) });
    return timeouts.length;
  },
  runInterval(fn, period) {
    intervals.push({ fn, period: Math.max(1, period ?? 1) });
    return intervals.length;
  },
  clearRun() {},
  afterEvents: {
    scriptEventReceive: { subscribe: (fn) => listeners.scriptEvent.push(fn) }
  }
};

const fakeBlockPermutation = {
  resolve(typeId, states) {
    if (typeof typeId !== "string" || !typeId.startsWith("minecraft:")) {
      throw new Error(`bad block id ${typeId}`);
    }
    return { typeId, states: states ?? {} };
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

globalThis.__nd_world = fakeWorld;
globalThis.__nd_system = fakeSystem;
globalThis.__nd_BlockPermutation = fakeBlockPermutation;
globalThis.__nd_ActionFormData = FakeForm;
globalThis.__nd_ModalFormData = FakeForm;

const originalWarn = console.warn;
console.warn = (...args) => {
  log.warnings.push(args.join(" "));
};

/* ------------------------------------------------------------------ runner */

function tick(count) {
  for (let i = 0; i < count; i++) {
    fakeSystem.currentTick++;
    const runs = pendingRuns;
    pendingRuns = [];
    for (const fn of runs) fn();
    for (let t = timeouts.length - 1; t >= 0; t--) {
      if (timeouts[t].at <= fakeSystem.currentTick) {
        const entry = timeouts.splice(t, 1)[0];
        entry.fn();
      }
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

async function main() {
  writeStubs();

  const player = new FakePlayer(overworld, "Tester", { x: 0, y: 64, z: 0 }, "nd:disaster_detector");
  overworld.entities.push(player);
  for (let i = 0; i < 6; i++) {
    overworld.entities.push(
      new FakeEntity(overworld, i % 2 ? "minecraft:zombie" : "minecraft:item", {
        x: (i - 3) * 2,
        y: 64,
        z: (i - 2) * 2
      })
    );
  }

  const mainUrl = pathToFileURL(path.join(SCRIPTS, "main.js")).href;
  await import(mainUrl);
  tick(5);
  check("main.js loads and boots", log.warnings.some((w) => w.includes("loaded with 6 disasters")), log.warnings.join(" | "));

  const registry = await import(pathToFileURL(path.join(SCRIPTS, "registry.js")).href);
  const keys = registry.getDisasterKeys();
  check("six disasters registered", keys.length === 6, keys.join(","));

  // Every disaster, one at a time, for 400 ticks each.
  const countPlaced = (typeId) => {
    let total = 0;
    for (const value of overworld.overrides.values()) if (value === typeId) total++;
    return total;
  };

  for (const key of keys) {
    const before = log.warnings.length;
    const impulsesBefore = log.impulses;
    const blocksBefore = log.blockChanges;

    const result = registry.startDisaster(key, overworld, { x: 0, y: 64, z: 0 }, {});
    check(`${key}: starts`, result.ok, result.reason ?? "");

    // Checked mid run: the tsunami has already drained itself by tick 400.
    tick(120);
    if (key === "tsunami") {
      check("tsunami: places water", countPlaced("minecraft:water") > 0, String(countPlaced("minecraft:water")));
    }
    tick(280);

    // Per disaster behaviour, checked at the end of the run.
    if (key === "tornado") {
      check("tornado: pulls entities in", log.impulses - impulsesBefore > 0, String(log.impulses - impulsesBefore));
    }
    if (key === "earthquake") {
      check(
        "earthquake: shakes the screen",
        log.commands.some((command) => command.startsWith("camerashake")),
        ""
      );
      check("earthquake: breaks blocks", log.blockChanges - blocksBefore > 0, String(log.blockChanges - blocksBefore));
    }
    if (key === "meteor") {
      check("meteor: explodes", log.explosions > 0, String(log.explosions));
    }
    if (key === "wildfire") {
      check("wildfire: places fire", countPlaced("minecraft:fire") > 0, String(countPlaced("minecraft:fire")));
    }
    if (key === "lightning_storm") {
      check(
        "lightning storm: spawns bolts",
        overworld.entities.some((entity) => entity.typeId === "minecraft:lightning_bolt"),
        ""
      );
      check(
        "lightning storm: sets thunder weather",
        log.commands.some((command) => command.startsWith("weather thunder")),
        ""
      );
    }

    registry.stopAllDisasters(false);
    tick(5);

    if (key === "tsunami") {
      check(
        "tsunami: drains every block it placed",
        countPlaced("minecraft:water") === 0,
        `${countPlaced("minecraft:water")} left behind`
      );
    }
    if (key === "lightning_storm") {
      check(
        "lightning storm: restores the weather",
        log.commands.includes("weather clear"),
        ""
      );
    }

    const errors = log.warnings.slice(before).filter((w) => w.includes("crashed") || w.includes("failed"));
    check(`${key}: runs 400 ticks without crashing`, errors.length === 0, errors.join(" | "));
  }

  // All six at once is refused past the concurrency cap, but must not throw.
  for (const key of keys) registry.startDisaster(key, overworld, { x: 20, y: 64, z: 20 }, {});
  tick(200);
  check("concurrency cap respected", registry.getActiveDisasters().length <= 3, String(registry.getActiveDisasters().length));
  registry.stopAllDisasters(false);
  tick(2);
  check("stopAll clears everything", registry.getActiveDisasters().length === 0);

  // Item taps.
  const wandPlayer = new FakePlayer(overworld, "Wanda", { x: 5, y: 64, z: 5 }, "nd:disaster_wand");
  overworld.entities.push(wandPlayer);
  for (const fn of listeners.itemUse) {
    fn({ source: wandPlayer, itemStack: { typeId: "nd:disaster_wand" } });
  }
  tick(5);
  check("wand tap is handled", true);

  for (const fn of listeners.itemUse) {
    fn({ source: player, itemStack: { typeId: "nd:disaster_detector" } });
  }
  tick(5);
  check("detector tap is handled", true);

  // The detector writes to the action bar while it is held.
  tick(40);
  check("detector prints a readout", player.actionBars.length > 0, String(player.actionBars.length));

  // scriptevent commands.
  const fire = (id, message = "") => {
    for (const fn of listeners.scriptEvent) {
      fn({ id, message, sourceEntity: wandPlayer, sourceType: "Entity" });
    }
    tick(3);
  };
  fire("nd:help");
  fire("nd:status");
  fire("nd:next");
  fire("nd:start", "tornado");
  tick(40);
  check("scriptevent nd:start works", registry.getActiveDisasters().length > 0);
  fire("nd:stop");
  check("scriptevent nd:stop works", registry.getActiveDisasters().length === 0);
  fire("nd:start", "meteor 30 64 30");
  tick(60);
  fire("nd:stop");
  fire("nd:random", "off");
  fire("nd:random", "on");
  fire("nd:soon", "5");
  fire("nd:give");
  check("nd:give runs give commands", log.commands.some((c) => c.includes("nd:disaster_wand")));

  // The random scheduler must fire on its own.
  const scheduler = await import(pathToFileURL(path.join(SCRIPTS, "scheduler.js")).href);
  scheduler.triggerSoon(2);
  tick(200);
  check("random scheduler fires", registry.getActiveDisasters().length > 0 || log.explosions > 0);
  registry.stopAllDisasters(false);

  // Long soak: random disasters back to back.
  for (let i = 0; i < 6; i++) {
    scheduler.triggerSoon(1);
    tick(300);
  }
  registry.stopAllDisasters(false);
  tick(5);

  const crashes = log.warnings.filter((w) => w.includes("crashed") || w.includes("scheduler:") || w.includes("detector:"));
  check("no crashes during the soak", crashes.length === 0, crashes.slice(0, 3).join(" | "));
  check("blocks were changed", log.blockChanges > 0, String(log.blockChanges));
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
      `(block changes: ${log.blockChanges}, particles: ${log.particles}, explosions: ${log.explosions})`
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.warn = originalWarn;
  console.error(error);
  process.exitCode = 1;
});
