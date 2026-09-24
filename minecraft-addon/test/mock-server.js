// A small fake of the @minecraft/server 1.10.0 API, just big enough to run
// Arcane Arsenal outside the game. It is deliberately strict:
//  - blocks have NO typeId (1.10.0 doesn't expose it)
//  - world edits throw inside before-events (read-only mode)
//  - unknown block ids / states throw in BlockPermutation.resolve
//  - unknown particle ids are recorded so tests can fail on typos
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------ enums
export const EquipmentSlot = { Chest: "Chest", Feet: "Feet", Head: "Head", Legs: "Legs", Mainhand: "Mainhand", Offhand: "Offhand" };
export const GameMode = { adventure: "adventure", creative: "creative", spectator: "spectator", survival: "survival" };
export const EntityDamageCause = new Proxy({}, { get: (_, k) => String(k) });
export const Direction = { Down: "Down", East: "East", North: "North", South: "South", Up: "Up", West: "West" };

// ------------------------------------------------------------------ test state
const LIGHT_LEVELS = [...Array(16).keys()];
const BLOCKS = {
  "minecraft:air": {},
  "minecraft:stone": {},
  "minecraft:dirt": {},
  "minecraft:chest": {},
  "minecraft:oak_door": {},
  ...(process.env.MOCK_FLATTENED_LIGHTS
    ? Object.fromEntries(LIGHT_LEVELS.map((n) => [`minecraft:light_block_${n}`, {}]))
    : { "minecraft:light_block": { block_light_level: LIGHT_LEVELS } }),
  "minecraft:frosted_ice": { age: [0, 1, 2, 3] },
  "minecraft:fire": { age: [...Array(16).keys()] },
  "minecraft:water": { liquid_depth: [...Array(16).keys()] },
  "minecraft:flowing_water": { liquid_depth: [...Array(16).keys()] },
  "minecraft:lava": { liquid_depth: [...Array(16).keys()] },
  "minecraft:short_grass": {},
};
const LIQUID = new Set(["minecraft:water", "minecraft:flowing_water", "minecraft:lava"]);
const PASSABLE = new Set(["minecraft:short_grass", "minecraft:fire", "minecraft:light_block", ...LIGHT_LEVELS.map((n) => `minecraft:light_block_${n}`)]);
const BLOCK_ITEM = { "minecraft:chest": "minecraft:chest", "minecraft:oak_door": "minecraft:wooden_door", "minecraft:stone": "minecraft:stone" };

function loadParticleIds() {
  const ids = new Set();
  const dir = join(here, "..", "packs", "ArcaneArsenal_RP", "particles");
  for (const f of readdirSync(dir)) {
    const json = JSON.parse(readFileSync(join(dir, f), "utf8"));
    ids.add(json.particle_effect.description.identifier);
  }
  return ids;
}
const VANILLA_PARTICLES = new Set(["minecraft:basic_flame_particle", "minecraft:totem_particle", "minecraft:soul_particle"]);

export const T = {
  tick: 0,
  readOnly: false,
  blocks: new Map(),
  unloadedBeyond: 300,
  entities: [],
  particles: new Map(),
  unknownParticles: new Set(),
  sounds: [],
  commands: [],
  lightning: [],
  errors: [],
  worldProps: new Map(),
  timers: [],
  nextTimer: 1,
  customIds: loadParticleIds(),
  nextEntityId: 1,
};

function bkey(dim, x, y, z) {
  return `${dim}|${x}|${y}|${z}`;
}

export function setBlock(dim, x, y, z, name, states = {}) {
  T.blocks.set(bkey(dim, x, y, z), BlockPermutation.resolve(name, states));
}
function permAt(dim, x, y, z) {
  const p = T.blocks.get(bkey(dim, x, y, z));
  if (p) return p;
  return BlockPermutation.resolve(y < 64 ? "minecraft:stone" : "minecraft:air");
}

// ------------------------------------------------------------------ blocks
export class BlockPermutation {
  constructor(name, states) {
    this._name = name;
    this._states = states;
  }
  static resolve(name, states = {}) {
    const def = BLOCKS[name];
    if (!def) throw new Error(`Failed to resolve block ${name}`);
    const full = {};
    for (const [k, values] of Object.entries(def)) full[k] = values[0];
    for (const [k, v] of Object.entries(states)) {
      if (!(k in def) || !def[k].includes(v)) throw new Error(`Bad state ${k}=${v} for ${name}`);
      full[k] = v;
    }
    return new BlockPermutation(name, full);
  }
  matches(name, states) {
    if (name !== this._name) return false;
    if (states) for (const [k, v] of Object.entries(states)) if (this._states[k] !== v) return false;
    return true;
  }
  getState(k) {
    return this._states[k];
  }
  getAllStates() {
    return { ...this._states };
  }
  withState(k, v) {
    return BlockPermutation.resolve(this._name, { ...this._states, [k]: v });
  }
  getItemStack() {
    return BLOCK_ITEM[this._name] ? new ItemStack(BLOCK_ITEM[this._name]) : undefined;
  }
}

class Block {
  constructor(dim, x, y, z) {
    this.dimension = dim;
    this.x = x;
    this.y = y;
    this.z = z;
  }
  get location() {
    return { x: this.x, y: this.y, z: this.z };
  }
  get permutation() {
    return permAt(this.dimension.id, this.x, this.y, this.z);
  }
  get isAir() {
    return this.permutation._name === "minecraft:air";
  }
  get isLiquid() {
    return LIQUID.has(this.permutation._name);
  }
  setPermutation(p) {
    if (T.readOnly) throw new Error("setPermutation in read-only mode");
    if (!(p instanceof BlockPermutation)) throw new Error("not a permutation");
    T.blocks.set(bkey(this.dimension.id, this.x, this.y, this.z), p);
  }
  getItemStack() {
    return this.permutation.getItemStack();
  }
  isValid() {
    return true;
  }
  above(n = 1) {
    return this.dimension.getBlock({ x: this.x, y: this.y + n, z: this.z });
  }
  below(n = 1) {
    return this.dimension.getBlock({ x: this.x, y: this.y - n, z: this.z });
  }
}

// ------------------------------------------------------------------ items
export class ItemStack {
  constructor(typeId, amount = 1) {
    if (typeof typeId !== "string") throw new Error("bad item id");
    this.typeId = typeId;
    this.amount = amount;
    this._lore = [];
    this.cooldownStarted = 0;
  }
  getLore() {
    return [...this._lore];
  }
  setLore(lines = []) {
    for (const l of lines) if (l.length > 50) throw new Error(`lore line too long (${l.length}): ${l}`);
    this._lore = [...lines];
  }
  getComponent(id) {
    if (id === "minecraft:cooldown") {
      return { startCooldown: (player) => { this.cooldownStarted++; T.lastCooldownPlayer = player; } };
    }
    return undefined;
  }
  clone() {
    const c = new ItemStack(this.typeId, this.amount);
    c._lore = [...this._lore];
    return c;
  }
}

class ContainerSlot {
  constructor(container, index) {
    this.c = container;
    this.i = index;
  }
  hasItem() {
    return !!this.c.items[this.i];
  }
  get typeId() {
    const it = this.c.items[this.i];
    if (!it) throw new Error("empty slot");
    return it.typeId;
  }
  getItem() {
    return this.c.items[this.i]?.clone();
  }
  getLore() {
    return this.c.items[this.i]?.getLore() ?? [];
  }
  setLore(l) {
    if (T.readOnly) throw new Error("setLore in read-only mode");
    this.c.items[this.i].setLore(l);
  }
  isValid() {
    return true;
  }
}

class Container {
  constructor(size, items) {
    this.size = size;
    this.items = items;
  }
  getItem(i) {
    return this.items[i]?.clone();
  }
  getSlot(i) {
    return new ContainerSlot(this, i);
  }
  setItem(i, it) {
    this.items[i] = it;
  }
  addItem(it) {
    const i = this.items.findIndex((x, n) => n < this.size && !x);
    if (i >= 0) this.items[i] = it;
    return undefined;
  }
  isValid() {
    return true;
  }
}

// ------------------------------------------------------------------ entities
const FAMILIES = {
  "minecraft:zombie": ["zombie", "undead", "monster", "mob"],
  "minecraft:skeleton": ["skeleton", "undead", "monster", "mob"],
  "minecraft:creeper": ["creeper", "monster", "mob"],
  "minecraft:spider": ["spider", "arthropod", "monster", "mob"],
  "minecraft:ender_dragon": ["dragon", "mob"],
  "minecraft:villager_v2": ["villager", "peasant", "mob"],
  "minecraft:wolf": ["wolf", "mob"],
  "minecraft:cow": ["cow", "mob"],
  "minecraft:player": ["player"],
  "minecraft:item": [],
  "minecraft:lightning_bolt": ["lightning"],
};

export class Entity {
  constructor(typeId, dimension, location, opts = {}) {
    this.id = String(T.nextEntityId++);
    this.typeId = typeId;
    this.dimension = dimension;
    this.location = { ...location };
    this.families = FAMILIES[typeId] ?? ["mob"];
    this.maxHealth = opts.health ?? 20;
    this.hp = this.maxHealth;
    this.effects = new Map();
    this.fire = 0;
    this.knockbacks = [];
    this.damageTaken = 0;
    this.tags = new Set();
    this.props = new Map();
    this.valid = true;
    this.tamed = !!opts.tamed;
    this.itemStack = opts.itemStack;
    this.isOnGround = true;
    this.isInWater = false;
    this.velocity = { x: 0, y: 0, z: 0 };
    T.entities.push(this);
  }
  isValid() {
    return this.valid;
  }
  getComponent(id) {
    if (id === "minecraft:type_family") return { hasTypeFamily: (f) => this.families.includes(f), getTypeFamilies: () => [...this.families] };
    if (id === "minecraft:health" && this.typeId !== "minecraft:item") {
      const e = this;
      return {
        get currentValue() { return e.hp; },
        get effectiveMax() { return e.maxHealth; },
        get effectiveMin() { return 0; },
        get defaultValue() { return e.maxHealth; },
        setCurrentValue(v) { if (T.readOnly) throw new Error("read-only"); e.hp = Math.max(0, Math.min(e.maxHealth, v)); return true; },
      };
    }
    if (id === "minecraft:is_tamed" && this.tamed) return {};
    if (id === "minecraft:item" && this.itemStack) return { itemStack: this.itemStack };
    return undefined;
  }
  addEffect(type, duration, opts = {}) {
    if (T.readOnly) throw new Error("addEffect in read-only mode");
    if (typeof type !== "string" || /[:A-Z]/.test(type)) throw new Error(`bad effect id ${type}`);
    this.effects.set(type, { typeId: type, duration, amplifier: opts.amplifier ?? 0 });
  }
  getEffect(type) {
    const e = this.effects.get(type);
    return e ? { ...e, isValid: () => true } : undefined;
  }
  applyDamage(amount, opts) {
    if (T.readOnly) throw new Error("applyDamage in read-only mode");
    if (!this.valid || this.typeId === "minecraft:item") return false;
    if (!opts || !opts.cause) throw new Error("applyDamage needs a cause");
    this.damageTaken += amount;
    this.hp -= amount;
    this.lastDamager = opts.damagingEntity;
    if (this.hp <= 0) {
      this.valid = false;
      fire(world.afterEvents.entityDie, { deadEntity: this, damageSource: { cause: opts.cause, damagingEntity: opts.damagingEntity } });
    }
    return true;
  }
  applyKnockback(dx, dz, h, v) {
    if (!Number.isFinite(dx + dz + h + v)) throw new Error("NaN knockback");
    this.knockbacks.push({ dx, dz, h, v });
  }
  setOnFire(seconds) {
    this.fire = Math.max(this.fire, seconds);
    return true;
  }
  extinguishFire() {
    this.fire = 0;
    return true;
  }
  teleport(loc, opts = {}) {
    if (T.readOnly) throw new Error("teleport in read-only mode");
    if (![loc.x, loc.y, loc.z].every(Number.isFinite)) throw new Error("bad teleport");
    this.location = { ...loc };
    if (opts.dimension) this.dimension = opts.dimension;
    this.teleported = (this.teleported ?? 0) + 1;
  }
  getHeadLocation() {
    return { x: this.location.x, y: this.location.y + 1.62, z: this.location.z };
  }
  getVelocity() {
    return { ...this.velocity };
  }
  hasTag(t) {
    return this.tags.has(t);
  }
  addTag(t) {
    this.tags.add(t);
    return true;
  }
  getDynamicProperty(k) {
    return this.props.get(k);
  }
  setDynamicProperty(k, v) {
    checkProp(v);
    if (v === undefined) this.props.delete(k);
    else this.props.set(k, v);
  }
  kill() {
    this.valid = false;
    return true;
  }
  remove() {
    this.valid = false;
  }
}

function checkProp(v) {
  const ok = v === undefined || typeof v === "boolean" || typeof v === "number" || typeof v === "string" ||
    (typeof v === "object" && ["x", "y", "z"].every((k) => typeof v[k] === "number"));
  if (!ok) throw new Error("bad dynamic property value");
  if (typeof v === "string" && v.length > 32767) throw new Error("dynamic property string too long");
}

export class Player extends Entity {
  constructor(name, dimension, location) {
    super("minecraft:player", dimension, location, { health: 20 });
    this.name = name;
    this.gameMode = GameMode.survival;
    this.rotation = { x: 0, y: 0 }; // pitch, yaw (0 = south)
    this.equipment = { Mainhand: undefined, Offhand: undefined };
    this.inv = new Container(36, new Array(36).fill(undefined));
    this.messages = [];
    this.actionbars = [];
    this.playerSounds = [];
    const self = this;
    this.onScreenDisplay = { setActionBar: (t) => self.actionbars.push(String(t)), isValid: () => true };
  }
  hold(item, slot = "Mainhand") {
    this.equipment[slot] = item;
    if (slot === "Mainhand") this.inv.items[0] = item;
  }
  getComponent(id) {
    if (id === "minecraft:equippable") {
      const self = this;
      return {
        getEquipment: (slot) => self.equipment[slot],
        setEquipment: (slot, it) => { self.equipment[slot] = it; return true; },
        getEquipmentSlot: (slot) => {
          const c = new Container(1, [self.equipment[slot]]);
          const s = new ContainerSlot(c, 0);
          const orig = s.setLore.bind(s);
          s.setLore = (l) => { orig(l); self.equipment[slot] = c.items[0]; };
          return s;
        },
      };
    }
    if (id === "minecraft:inventory") return { container: this.inv };
    return super.getComponent(id);
  }
  getViewDirection() {
    const pitch = (this.rotation.x * Math.PI) / 180;
    const yaw = (this.rotation.y * Math.PI) / 180;
    return { x: -Math.sin(yaw) * Math.cos(pitch), y: -Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
  }
  getRotation() {
    return { ...this.rotation };
  }
  matches(opts) {
    if (opts.gameMode && opts.gameMode !== this.gameMode) return false;
    return true;
  }
  sendMessage(m) {
    this.messages.push(String(m));
  }
  playSound(id, opts) {
    this.playerSounds.push(id);
  }
  runCommandAsync(cmd) {
    T.commands.push(cmd);
    return Promise.resolve({ successCount: 1 });
  }
  getBlockFromViewDirection(opts) {
    return this.dimension.getBlockFromRay(this.getHeadLocation(), this.getViewDirection(), opts);
  }
  getEntitiesFromViewDirection(opts = {}) {
    const o = this.getHeadLocation();
    const d = this.getViewDirection();
    const max = opts.maxDistance ?? 64;
    const out = [];
    for (const e of T.entities) {
      if (e === this || !e.valid || e.dimension !== this.dimension) continue;
      const c = { x: e.location.x - o.x, y: e.location.y + 0.9 - o.y, z: e.location.z - o.z };
      const t = c.x * d.x + c.y * d.y + c.z * d.z;
      if (t < 0 || t > max) continue;
      const px = c.x - d.x * t, py = c.y - d.y * t, pz = c.z - d.z * t;
      if (Math.hypot(px, py, pz) < 0.9) out.push({ entity: e, distance: t });
    }
    return out;
  }
}

// ------------------------------------------------------------------ dimensions
class Dimension {
  constructor(id) {
    this.id = id;
    this.heightRange = { min: -64, max: 320 };
  }
  getBlock(loc) {
    const x = Math.floor(loc.x), y = Math.floor(loc.y), z = Math.floor(loc.z);
    if (![x, y, z].every(Number.isFinite)) throw new Error("NaN block location");
    if (y < -64 || y >= 320) throw new Error("LocationOutOfWorldBoundariesError");
    if (Math.abs(x) > T.unloadedBeyond || Math.abs(z) > T.unloadedBeyond) return undefined;
    return new Block(this, x, y, z);
  }
  getEntities(opts = {}) {
    return T.entities.filter((e) => {
      if (!e.valid || e.dimension !== this) return false;
      if (opts.type && e.typeId !== opts.type) return false;
      if (opts.families && !opts.families.every((f) => e.families.includes(f))) return false;
      if (opts.excludeFamilies && opts.excludeFamilies.some((f) => e.families.includes(f))) return false;
      if (opts.location && opts.maxDistance !== undefined) {
        const l = opts.location;
        if (Math.hypot(e.location.x - l.x, e.location.y - l.y, e.location.z - l.z) > opts.maxDistance) return false;
      }
      return true;
    });
  }
  getPlayers(opts = {}) {
    return this.getEntities({ ...opts, type: "minecraft:player" });
  }
  spawnParticle(id, loc) {
    if (![loc.x, loc.y, loc.z].every(Number.isFinite)) throw new Error(`NaN particle location for ${id}`);
    if (!T.customIds.has(id) && !VANILLA_PARTICLES.has(id)) T.unknownParticles.add(id);
    T.particles.set(id, (T.particles.get(id) ?? 0) + 1);
  }
  spawnEntity(id, loc) {
    if (T.readOnly) throw new Error("spawnEntity in read-only mode");
    if (id === "minecraft:lightning_bolt") T.lightning.push({ ...loc });
    return new Entity(id, this, loc);
  }
  getBlockFromRay(origin, dir, opts = {}) {
    const max = opts.maxDistance ?? 64;
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const d = { x: dir.x / len, y: dir.y / len, z: dir.z / len };
    let prev = [Math.floor(origin.x), Math.floor(origin.y), Math.floor(origin.z)];
    for (let t = 0; t <= max; t += 0.02) {
      const p = { x: origin.x + d.x * t, y: origin.y + d.y * t, z: origin.z + d.z * t };
      const cell = [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)];
      if (cell[0] === prev[0] && cell[1] === prev[1] && cell[2] === prev[2] && t > 0) continue;
      const b = this.getBlock(p);
      if (!b) return undefined;
      const name = b.permutation._name;
      const solid = name !== "minecraft:air" && !(LIQUID.has(name) && !opts.includeLiquidBlocks) &&
        !(PASSABLE.has(name) && !opts.includePassableBlocks);
      if (solid) {
        let face = "Up";
        if (cell[0] > prev[0]) face = "West";
        else if (cell[0] < prev[0]) face = "East";
        else if (cell[1] > prev[1]) face = "Down";
        else if (cell[1] < prev[1]) face = "Up";
        else if (cell[2] > prev[2]) face = "North";
        else if (cell[2] < prev[2]) face = "South";
        return { block: b, face, faceLocation: { x: p.x - cell[0], y: p.y - cell[1], z: p.z - cell[2] } };
      }
      prev = cell;
    }
    return undefined;
  }
}

const dims = {
  "minecraft:overworld": new Dimension("minecraft:overworld"),
  "minecraft:nether": new Dimension("minecraft:nether"),
  "minecraft:the_end": new Dimension("minecraft:the_end"),
};

// ------------------------------------------------------------------ events & world
function signal() {
  const subs = [];
  return {
    subs,
    subscribe(cb) {
      subs.push(cb);
      return cb;
    },
    unsubscribe(cb) {
      const i = subs.indexOf(cb);
      if (i >= 0) subs.splice(i, 1);
    },
  };
}

export function fire(sig, payload, readOnly = false) {
  for (const cb of sig.subs) {
    T.readOnly = readOnly;
    try {
      cb(payload);
    } catch (e) {
      T.errors.push(e);
    } finally {
      T.readOnly = false;
    }
  }
}

export const world = {
  afterEvents: {
    itemUse: signal(), itemUseOn: signal(), entityHitEntity: signal(), entityDie: signal(), playerLeave: signal(),
    playerSpawn: signal(), playerJoin: signal(), entityHurt: signal(),
  },
  beforeEvents: { itemUseOn: signal(), itemUse: signal(), playerLeave: signal() },
  getAllPlayers: () => T.entities.filter((e) => e instanceof Player && e.valid),
  getDimension: (id) => {
    const d = dims[id] ?? dims["minecraft:" + id];
    if (!d) throw new Error("unknown dimension " + id);
    return d;
  },
  playSound: (id, loc, opts) => {
    if (![loc.x, loc.y, loc.z].every(Number.isFinite)) throw new Error("NaN sound location");
    T.sounds.push(id);
  },
  sendMessage: (m) => T.sounds.push("msg:" + m),
  getDynamicProperty: (k) => T.worldProps.get(k),
  setDynamicProperty: (k, v) => {
    checkProp(v);
    if (v === undefined) T.worldProps.delete(k);
    else T.worldProps.set(k, v);
  },
};

export const system = {
  get currentTick() {
    return T.tick;
  },
  afterEvents: { scriptEventReceive: signal() },
  runInterval(cb, n = 1) {
    const id = T.nextTimer++;
    T.timers.push({ id, cb, every: Math.max(1, n), due: T.tick + Math.max(1, n) });
    return id;
  },
  runTimeout(cb, n = 1) {
    const id = T.nextTimer++;
    T.timers.push({ id, cb, every: 0, due: T.tick + Math.max(1, n) });
    return id;
  },
  run(cb) {
    return this.runTimeout(cb, 1);
  },
  clearRun(id) {
    T.timers = T.timers.filter((t) => t.id !== id);
  },
};

/** Advance the fake game by n ticks. */
export function advance(n = 1) {
  for (let i = 0; i < n; i++) {
    T.tick++;
    const due = T.timers.filter((t) => t.due <= T.tick);
    for (const t of due) {
      if (!T.timers.includes(t)) continue;
      if (t.every) t.due += t.every;
      else T.timers.splice(T.timers.indexOf(t), 1);
      try {
        t.cb();
      } catch (e) {
        T.errors.push(e);
      }
    }
    for (const e of T.entities) {
      for (const [k, eff] of e.effects) {
        eff.duration--;
        if (eff.duration <= 0) e.effects.delete(k);
      }
    }
  }
}

export const overworld = dims["minecraft:overworld"];

/** Read a block name at a position (test helper). */
export function blockAt(x, y, z, dim = overworld) {
  return permAt(dim.id, x, y, z);
}
