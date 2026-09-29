// A small fake of @minecraft/server (1.10.0 surface) for the smoke test.
// It only implements what the add-on calls, and it throws where the real
// game throws (impulse on players, blocks outside the world, bad input).

export const stats = newStats();
function newStats() {
  return {
    explosions: 0,
    explosionList: [],
    particles: 0,
    blocksSet: 0,
    commands: [],
    spawned: [],
    cooldowns: 0,
    worldMessages: [],
    peak: { blocks: 0, particles: 0, explosions: 0 },
    tick: { blocks: 0, particles: 0, explosions: 0 },
  };
}
export function resetStats() {
  Object.assign(stats, newStats());
}

function finite(v, what) {
  if (![v.x, v.y, v.z].every(Number.isFinite)) throw new Error(`${what}: non-finite vector ${JSON.stringify(v)}`);
}

// ------------------------------------------------------------------ events
function signal() {
  const subs = [];
  return {
    subscribe(cb) {
      subs.push(cb);
      return cb;
    },
    unsubscribe(cb) {
      const i = subs.indexOf(cb);
      if (i >= 0) subs.splice(i, 1);
    },
    fire(ev) {
      for (const cb of subs) cb(ev);
    },
  };
}

// ------------------------------------------------------------------ system
let tick = 0;
let nextId = 1;
const intervals = [];
const timeouts = [];
export const system = {
  get currentTick() {
    return tick;
  },
  run(cb) {
    return system.runTimeout(cb, 1);
  },
  runTimeout(cb, delay = 1) {
    const id = nextId++;
    timeouts.push({ cb, at: tick + Math.max(1, delay), id });
    return id;
  },
  runInterval(cb, every = 1) {
    const id = nextId++;
    intervals.push({ cb, every: Math.max(1, every), start: tick, id });
    return id;
  },
  clearRun(id) {
    for (const list of [intervals, timeouts]) {
      const i = list.findIndex((r) => r.id === id);
      if (i >= 0) list.splice(i, 1);
    }
  },
  afterEvents: { scriptEventReceive: signal() },
};

const flush = () => new Promise((r) => setImmediate(r));

/** Advances the game by n ticks, running timers and letting promises settle. */
export async function advance(n = 1) {
  for (let i = 0; i < n; i++) {
    tick++;
    stats.tick = { blocks: 0, particles: 0, explosions: 0 };
    for (const t of timeouts.filter((t) => t.at <= tick)) {
      timeouts.splice(timeouts.indexOf(t), 1);
      t.cb();
    }
    for (const iv of intervals.slice()) if ((tick - iv.start) % iv.every === 0) iv.cb();
    for (const k of Object.keys(stats.peak)) stats.peak[k] = Math.max(stats.peak[k], stats.tick[k]);
    await flush();
  }
}

// ------------------------------------------------------------------ blocks
export class BlockPermutation {
  constructor(id) {
    this.id = id;
  }
  static resolve(id) {
    if (typeof id !== "string" || !id.startsWith("minecraft:")) throw new Error(`bad block id ${id}`);
    return new BlockPermutation(id);
  }
  matches(name) {
    return name === this.id;
  }
}

class Block {
  constructor(dim, x, y, z) {
    Object.assign(this, { dimension: dim, x, y, z, location: { x, y, z } });
  }
  get type() {
    return this.dimension.typeAt(this.x, this.y, this.z);
  }
  get isAir() {
    return this.type === "minecraft:air";
  }
  get isLiquid() {
    return this.type === "minecraft:water" || this.type === "minecraft:lava";
  }
  get permutation() {
    return new BlockPermutation(this.type);
  }
  setPermutation(p) {
    if (!(p instanceof BlockPermutation)) throw new Error("setPermutation needs a BlockPermutation");
    this.dimension.blocks.set(`${this.x},${this.y},${this.z}`, p.id);
    stats.blocksSet++;
    stats.tick.blocks++;
  }
  center() {
    return { x: this.x + 0.5, y: this.y + 0.5, z: this.z + 0.5 };
  }
  isValid() {
    return true;
  }
}

// ------------------------------------------------------------------ dimension
export class Dimension {
  constructor(id) {
    this.id = id;
    this.heightRange = id === "minecraft:nether" ? { min: 0, max: 128 } : { min: -64, max: 320 };
    this.blocks = new Map();
    this.entities = [];
    this.surface = id === "minecraft:nether" ? 40 : 63;
  }
  typeAt(x, y, z) {
    const k = `${x},${y},${z}`;
    if (this.blocks.has(k)) return this.blocks.get(k);
    if (y <= this.heightRange.min) return "minecraft:bedrock";
    if (this.id === "minecraft:nether" && y >= 123) return "minecraft:bedrock";
    if (y > this.surface) return "minecraft:air";
    if (y === this.surface) return "minecraft:grass";
    if (y === this.surface - 20) return "minecraft:water";
    return y === this.surface - 30 ? "minecraft:command_block" : "minecraft:stone";
  }
  getBlock(loc) {
    finite(loc, "getBlock");
    const x = Math.floor(loc.x);
    const y = Math.floor(loc.y);
    const z = Math.floor(loc.z);
    if (y < this.heightRange.min || y >= this.heightRange.max) throw new Error("LocationOutOfWorldBoundariesError");
    if (Math.abs(x) > 3000 || Math.abs(z) > 3000) return undefined; // unloaded
    return new Block(this, x, y, z);
  }
  getBlockFromRay(loc, dir, opts = {}) {
    finite(loc, "getBlockFromRay");
    if (loc.y < this.heightRange.min || loc.y > this.heightRange.max) throw new Error("ray starts outside the world");
    const max = opts.maxDistance ?? 64;
    for (let d = 0; d <= max; d += 0.25) {
      const p = { x: loc.x + dir.x * d, y: loc.y + dir.y * d, z: loc.z + dir.z * d };
      if (p.y < this.heightRange.min || p.y >= this.heightRange.max) return undefined;
      const b = this.getBlock(p);
      if (!b) return undefined;
      if (b.isAir || (b.isLiquid && !opts.includeLiquidBlocks)) continue;
      return { block: b, face: "Up", faceLocation: { x: 0.5, y: 1, z: 0.5 } };
    }
    return undefined;
  }
  createExplosion(loc, radius, opts = {}) {
    finite(loc, "createExplosion");
    if (!(radius > 0)) throw new Error("bad radius");
    stats.explosions++;
    stats.tick.explosions++;
    if (stats.explosionList.length < 2000) stats.explosionList.push({ loc: { ...loc }, radius, opts: { ...opts } });
    if (opts.breaksBlocks) {
      const r = Math.floor(radius / 2);
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++)
          for (let dz = -r; dz <= r; dz++) {
            const y = Math.floor(loc.y) + dy;
            if (y <= this.heightRange.min || y >= this.heightRange.max) continue;
            const was = this.typeAt(Math.floor(loc.x) + dx, y, Math.floor(loc.z) + dz);
            if (was === "minecraft:bedrock" || was === "minecraft:command_block") continue; // blast-proof in game
            this.blocks.set(`${Math.floor(loc.x) + dx},${y},${Math.floor(loc.z) + dz}`, "minecraft:air");
          }
    }
    return true;
  }
  #near(opts) {
    return (e) => {
      if (!e.valid) return false;
      if (opts.location && opts.maxDistance !== undefined) {
        const d = Math.hypot(e.location.x - opts.location.x, e.location.y - opts.location.y, e.location.z - opts.location.z);
        if (d > opts.maxDistance) return false;
      }
      if (opts.excludeTypes?.includes(e.typeId)) return false;
      if (opts.type && opts.type !== e.typeId) return false;
      return true;
    };
  }
  getEntities(opts = {}) {
    if (opts.location) finite(opts.location, "getEntities");
    return this.entities.filter(this.#near(opts));
  }
  getPlayers(opts = {}) {
    return this.getEntities(opts).filter((e) => e instanceof Player);
  }
  spawnEntity(id, loc) {
    finite(loc, "spawnEntity");
    if (!this.getBlock(loc)) throw new Error("LocationInUnloadedChunkError");
    const e = new Entity(id, this, loc);
    this.entities.push(e);
    stats.spawned.push(id);
    return e;
  }
  spawnItem(stack, loc) {
    const e = this.spawnEntity("minecraft:item", loc);
    e.stack = stack;
    return e;
  }
  spawnParticle(id, loc) {
    finite(loc, `spawnParticle(${id})`);
    if (typeof id !== "string" || !id.includes(":")) throw new Error(`bad particle ${id}`);
    stats.particles++;
    stats.tick.particles++;
  }
  runCommand(cmd) {
    stats.commands.push(cmd);
    return { successCount: 1 };
  }
}

// ------------------------------------------------------------------ entities
let eid = 1;
export class Entity {
  constructor(typeId, dim, loc) {
    this.typeId = typeId;
    this.id = String(-eid++);
    this.dimension = dim;
    this.location = { ...loc };
    this.valid = true;
    this.tags = new Set();
    this.props = new Map();
    this.effects = [];
    this.damage = 0;
    this.pushes = 0;
  }
  isValid() {
    return this.valid;
  }
  remove() {
    if (!this.valid) throw new Error("entity already removed");
    this.valid = false;
  }
  applyImpulse(v) {
    if (this.typeId === "minecraft:player") throw new Error("applyImpulse can't be used on players");
    finite(v, "applyImpulse");
    this.pushes++;
  }
  applyKnockback(dx, dz, h, v) {
    if (![dx, dz, h, v].every(Number.isFinite)) throw new Error("applyKnockback: non-finite");
    this.pushes++;
  }
  applyDamage(n) {
    if (!Number.isFinite(n)) throw new Error("applyDamage: non-finite");
    this.damage += n;
    return true;
  }
  setOnFire() {
    return true;
  }
  addEffect(id, duration, opts) {
    if (!Number.isInteger(duration) || duration <= 0) throw new Error(`addEffect: bad duration ${duration}`);
    this.effects.push({ id, duration, opts });
  }
  addTag(t) {
    this.tags.add(t);
    return true;
  }
  hasTag(t) {
    return this.tags.has(t);
  }
  getDynamicProperty(k) {
    return this.props.get(k);
  }
  setDynamicProperty(k, v) {
    if (v === undefined) this.props.delete(k);
    else if (typeof v === "string" && v.length > 32767) throw new Error("dynamic property too long");
    else this.props.set(k, typeof v === "object" ? { ...v } : v);
  }
  runCommand(cmd) {
    stats.commands.push(cmd);
    return { successCount: 1 };
  }
  getComponent() {
    return undefined;
  }
}

class Container {
  constructor(size) {
    this.size = size;
    this.slots = new Array(size).fill(undefined);
  }
  getItem(i) {
    return this.slots[i];
  }
  addItem(stack) {
    const i = this.slots.findIndex((s) => !s);
    if (i < 0) return stack;
    this.slots[i] = stack;
    return undefined;
  }
}

export class Player extends Entity {
  constructor(name, dim, loc) {
    super("minecraft:player", dim, loc);
    this.name = name;
    this.isSneaking = false;
    this.messages = [];
    this.actionbar = [];
    this.titles = [];
    this.sounds = [];
    this.inventory = new Container(36);
    this.mainhand = undefined;
    this.lookAt = undefined;
    this.onScreenDisplay = {
      setActionBar: (t) => this.actionbar.push(String(t)),
      setTitle: (t, o) => this.titles.push([String(t), o]),
    };
    dim.entities.push(this);
  }
  sendMessage(m) {
    this.messages.push(String(m));
  }
  playSound(id, opts = {}) {
    if (opts.location) finite(opts.location, "playSound");
    this.sounds.push(id);
  }
  getBlockFromViewDirection() {
    if (!this.lookAt) return undefined;
    const b = this.dimension.getBlock(this.lookAt);
    return b ? { block: b, face: "Up", faceLocation: { x: 0.5, y: 1, z: 0.5 } } : undefined;
  }
  getComponent(id) {
    if (id === "minecraft:inventory") return { container: this.inventory };
    if (id === "minecraft:equippable") return { getEquipment: (slot) => (slot === "Mainhand" ? this.mainhand : undefined) };
    return undefined;
  }
}

export class ItemStack {
  constructor(typeId, amount = 1) {
    if (typeof typeId !== "string" || !typeId.includes(":")) throw new Error(`bad item id ${typeId}`);
    this.typeId = typeId;
    this.amount = amount;
  }
  getComponent(id) {
    if (id === "minecraft:cooldown") return { startCooldown: () => stats.cooldowns++ };
    return undefined;
  }
}

// ------------------------------------------------------------------ world
const dims = {};
export const players = [];
export const world = {
  afterEvents: { itemUse: signal(), itemUseOn: signal(), playerSpawn: signal() },
  beforeEvents: { itemUse: signal(), itemUseOn: signal() },
  getDimension(id) {
    const key = id.startsWith("minecraft:") ? id : `minecraft:${id}`;
    return (dims[key] ??= new Dimension(key));
  },
  getAllPlayers() {
    return players.filter((p) => p.valid);
  },
  sendMessage(m) {
    stats.worldMessages.push(String(m));
  },
};

export const EquipmentSlot = { Mainhand: "Mainhand", Offhand: "Offhand", Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet" };
export const EntityDamageCause = { entityExplosion: "entityExplosion", lightning: "lightning", magic: "magic" };
export const TicksPerSecond = 20;
