// Minimal in-memory stand-in for @minecraft/server 1.10.0, just enough of the
// API surface used by the add-on scripts so their logic can be exercised in
// Node against the real ruin layouts. Not a game simulation.

export const sim = {
  tick: 0,
  timers: [],
  intervals: [],
  queue: [],
  players: [],
  props: new Map(),
  messages: [],
  nextEntityId: 1,
  dims: {},
};

const AIR = "minecraft:air";
const NO_ITEM = new Set([AIR, "minecraft:water", "minecraft:lava"]);
const CONTAINERS = new Set(["minecraft:chest", "minecraft:dispenser", "minecraft:barrel"]);

function signal(name) {
  return {
    name,
    subs: [],
    subscribe(cb, options) {
      this.subs.push({ cb, options });
      return cb;
    },
    unsubscribe(cb) {
      this.subs = this.subs.filter((s) => s.cb !== cb);
    },
  };
}

export function fire(sig, ev, { entity, eventId } = {}) {
  for (const { cb, options } of sig.subs) {
    if (options?.entityTypes && entity && !options.entityTypes.includes(entity.typeId)) continue;
    if (options?.eventTypes && eventId && !options.eventTypes.includes(eventId)) continue;
    cb(ev);
  }
}

export class BlockPermutation {
  constructor(id, states = {}) {
    this.id = id;
    this.states = { ...states };
  }
  static resolve(id, states) {
    return new BlockPermutation(id, states ?? {});
  }
  matches(id, states) {
    if (this.id !== id) return false;
    if (states) for (const [k, v] of Object.entries(states)) if (this.states[k] !== v) return false;
    return true;
  }
  getItemStack(amount = 1) {
    return NO_ITEM.has(this.id) ? undefined : new ItemStack(this.id, amount);
  }
  getState(k) {
    return this.states[k];
  }
  getAllStates() {
    return { ...this.states };
  }
  withState(k, v) {
    return new BlockPermutation(this.id, { ...this.states, [k]: v });
  }
}

export class ItemStack {
  constructor(typeId, amount = 1) {
    this.typeId = typeId;
    this.amount = amount;
  }
}

export class MolangVariableMap {
  constructor() {
    this.vars = {};
  }
  setColorRGB(name, c) {
    this.vars[name] = c;
  }
  setFloat(name, v) {
    this.vars[name] = v;
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
    return this.dimension.permAt(this.x, this.y, this.z);
  }
  get isAir() {
    return this.permutation.id === AIR;
  }
  get isLiquid() {
    return this.permutation.id === "minecraft:water" || this.permutation.id === "minecraft:lava";
  }
  isValid() {
    return true;
  }
  setPermutation(p) {
    this.dimension.setPerm(this.x, this.y, this.z, p);
  }
  offset(o) {
    return this.dimension.getBlock({ x: this.x + o.x, y: this.y + o.y, z: this.z + o.z });
  }
  above(n = 1) { return this.offset({ x: 0, y: n, z: 0 }); }
  below(n = 1) { return this.offset({ x: 0, y: -n, z: 0 }); }
  north(n = 1) { return this.offset({ x: 0, y: 0, z: -n }); }
  south(n = 1) { return this.offset({ x: 0, y: 0, z: n }); }
  east(n = 1) { return this.offset({ x: n, y: 0, z: 0 }); }
  west(n = 1) { return this.offset({ x: -n, y: 0, z: 0 }); }
  center() { return { x: this.x + 0.5, y: this.y + 0.5, z: this.z + 0.5 }; }
  getComponent(name) {
    return name === "minecraft:inventory" && CONTAINERS.has(this.permutation.id) ? { container: {} } : undefined;
  }
}

class Dimension {
  constructor(id) {
    this.id = id;
    this.blocks = new Map();
    this.entities = [];
    this.particles = [];
    this.history = [];
  }
  k(x, y, z) {
    return `${x},${y},${z}`;
  }
  permAt(x, y, z) {
    return this.blocks.get(this.k(x, y, z)) ?? new BlockPermutation(AIR);
  }
  setPerm(x, y, z, p) {
    this.history.push({ tick: sim.tick, x, y, z, id: p.id });
    if (p.id === AIR) this.blocks.delete(this.k(x, y, z));
    else this.blocks.set(this.k(x, y, z), p);
  }
  getBlock(loc) {
    const x = Math.floor(loc.x);
    const y = Math.floor(loc.y);
    const z = Math.floor(loc.z);
    if (y < -64 || y >= 320) return undefined;
    return new Block(this, x, y, z);
  }
  inRange(e, o) {
    if (!o?.location) return true;
    const d = Math.hypot(e.location.x - o.location.x, e.location.y - o.location.y, e.location.z - o.location.z);
    return d <= (o.maxDistance ?? Infinity);
  }
  getPlayers(o) {
    return sim.players.filter((p) => p.valid && p.dimension === this && this.inRange(p, o));
  }
  getEntities(o) {
    return this.entities.filter((e) => e.valid && (!o?.type || e.typeId === o.type) && this.inRange(e, o));
  }
  spawnEntity(id, loc) {
    const e = new Entity(id, { ...loc }, this);
    this.entities.push(e);
    sim.queue.push(() => fire(world.afterEvents.entitySpawn, { entity: e, cause: "Spawned" }, { entity: e }));
    return e;
  }
  spawnParticle(id, loc, vars) {
    this.particles.push({ tick: sim.tick, id, loc, vars: vars?.vars });
  }
}

export class Entity {
  constructor(typeId, loc, dim) {
    this.typeId = typeId;
    this.id = String(-(sim.nextEntityId++));
    this.location = loc;
    this.dimension = dim;
    this.valid = true;
    this.effects = new Map();
    this.dyn = new Map();
    this.events = [];
    this.damage = [];
    this.knockbacks = [];
    const hp = { "ancient_ruins:jade_idol": 150, "ancient_ruins:sand_pharaoh": 150, "ancient_ruins:abyssal_admiral": 150 };
    this.maxHp = hp[typeId] ?? 20;
    this.hp = this.maxHp;
    this.gameMode = "survival";
    this.rotation = { x: 0, y: 0 };
    this.equipment = {};
  }
  isValid() {
    return this.valid;
  }
  remove() {
    this.valid = false;
  }
  triggerEvent(e) {
    this.events.push(e);
  }
  addEffect(t, duration, options = {}) {
    this.effects.set(t, { typeId: t, duration, amplifier: options.amplifier ?? 0 });
  }
  getEffect(t) {
    return this.effects.get(t);
  }
  applyDamage(n, options) {
    this.damage.push({ n, cause: options?.cause });
    this.hp -= n;
    return true;
  }
  applyKnockback(dx, dz, h, v) {
    this.knockbacks.push({ dx, dz, h, v });
  }
  getComponent(name) {
    if (name === "minecraft:health") {
      const self = this;
      return {
        get currentValue() { return self.hp; },
        get effectiveMax() { return self.maxHp; },
        setCurrentValue(v) { self.hp = v; return true; },
      };
    }
    if (name === "minecraft:equippable") {
      return { getEquipment: (slot) => (this.equipment[slot] ? new ItemStack(this.equipment[slot]) : undefined) };
    }
    return undefined;
  }
  getDynamicProperty(k) {
    return this.dyn.get(k);
  }
  setDynamicProperty(k, v) {
    if (v === undefined) this.dyn.delete(k);
    else this.dyn.set(k, v);
  }
  matches(o) {
    return !o.gameMode || o.gameMode === this.gameMode;
  }
  getRotation() {
    return this.rotation;
  }
  getHeadLocation() {
    return { x: this.location.x, y: this.location.y + 1.62, z: this.location.z };
  }
}

export class Player extends Entity {
  constructor(name, dim, loc) {
    super("minecraft:player", loc, dim);
    this.name = name;
    this.isSneaking = false;
    this.actionbar = [];
    this.titles = [];
    this.chat = [];
    this.sounds = [];
    this.onScreenDisplay = {
      setActionBar: (t) => this.actionbar.push(t),
      setTitle: (t, o) => this.titles.push({ t, o }),
    };
  }
  sendMessage(m) {
    this.chat.push(m);
  }
  playSound(id, o) {
    this.sounds.push(id);
  }
}

function schedule(cb, delay) {
  const id = sim.timers.length + 1;
  sim.timers.push({ id, at: sim.tick + Math.max(1, delay), cb, done: false });
  return id;
}

export const system = {
  get currentTick() {
    return sim.tick;
  },
  run(cb) {
    return schedule(cb, 1);
  },
  runTimeout(cb, delay = 1) {
    return schedule(cb, delay);
  },
  runInterval(cb, interval = 1) {
    sim.intervals.push({ cb, interval, next: sim.tick + interval });
    return sim.intervals.length;
  },
  clearRun() {},
  afterEvents: { scriptEventReceive: signal("scriptEventReceive") },
};

export const world = {
  afterEvents: Object.fromEntries([
    "entitySpawn", "entityLoad", "leverAction", "pressurePlatePush", "itemUse", "itemUseOn",
    "dataDrivenEntityTrigger", "entityHurt", "entityDie", "playerSpawn", "playerLeave",
  ].map((n) => [n, signal(n)])),
  getAllPlayers() {
    return sim.players.filter((p) => p.valid);
  },
  getDimension(id) {
    const full = id.includes(":") ? id : `minecraft:${id}`;
    if (!sim.dims[full]) sim.dims[full] = new Dimension(full);
    return sim.dims[full];
  },
  getDynamicProperty(k) {
    return sim.props.get(k);
  },
  setDynamicProperty(k, v) {
    if (typeof v === "string" && v.length > 32767) throw new Error(`dynamic property ${k} too long`);
    if (v === undefined) sim.props.delete(k);
    else sim.props.set(k, v);
  },
  sendMessage(m) {
    sim.messages.push(m);
  },
};

/** Advance the simulated world by n ticks. */
export function advance(n = 1) {
  for (let i = 0; i < n; i++) {
    sim.tick++;
    for (const t of sim.timers) {
      if (!t.done && t.at <= sim.tick) {
        t.done = true;
        t.cb();
      }
    }
    for (const it of sim.intervals) {
      if (it.next <= sim.tick) {
        it.next += it.interval;
        it.cb();
      }
    }
    while (sim.queue.length) sim.queue.shift()();
  }
}

export const GameMode = { adventure: "adventure", creative: "creative", spectator: "spectator", survival: "survival" };
export const EquipmentSlot = { Chest: "Chest", Feet: "Feet", Head: "Head", Legs: "Legs", Mainhand: "Mainhand", Offhand: "Offhand" };
export const EntityDamageCause = new Proxy({}, { get: (_, k) => String(k) });
export const EntityInitializationCause = { Born: "Born", Event: "Event", Loaded: "Loaded", Spawned: "Spawned", Transformed: "Transformed" };
