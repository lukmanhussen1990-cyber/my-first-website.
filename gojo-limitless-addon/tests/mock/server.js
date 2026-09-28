// Minimal functional mock of @minecraft/server 1.10.0 for headless smoke tests.
// It simulates entities, damage, effects, inventories, a flat world and the
// after-event queue closely enough to exercise every code path of the addon.

export const log = { particles: [], sounds: [], titles: [], actionbar: [], animations: [], commands: [], cooldowns: [], messages: [], fades: [] };

let tick = 0;
const intervals = [];
const timeouts = [];
const eventQueue = [];

function signal(name) {
  const subs = [];
  return {
    name,
    subscribe(cb, opts) {
      subs.push({ cb, opts });
      return cb;
    },
    unsubscribe(cb) {
      const i = subs.findIndex((s) => s.cb === cb);
      if (i >= 0) subs.splice(i, 1);
    },
    __fire(ev, entityForFilter) {
      for (const s of subs) {
        if (s.opts && s.opts.entityTypes && entityForFilter && !s.opts.entityTypes.includes(entityForFilter.typeId)) continue;
        if (s.opts && s.opts.namespaces && ev.id && !s.opts.namespaces.some((n) => ev.id.startsWith(n + ":"))) continue;
        s.cb(ev);
      }
    },
  };
}

function queue(sig, ev, entity) {
  eventQueue.push(() => sig.__fire(ev, entity));
}

export const EntityDamageCause = new Proxy({}, { get: (_, k) => String(k) });
export const GameMode = { adventure: "adventure", creative: "creative", spectator: "spectator", survival: "survival" };
export const EquipmentSlot = { Chest: "Chest", Feet: "Feet", Head: "Head", Legs: "Legs", Mainhand: "Mainhand", Offhand: "Offhand" };
export const Direction = { Down: "Down", East: "East", North: "North", South: "South", Up: "Up", West: "West" };
export const ItemLockMode = { inventory: "inventory", none: "none", slot: "slot" };
export const TicksPerSecond = 20;

export class MolangVariableMap {
  constructor() {
    this.vars = {};
  }
  setColorRGBA(n, c) {
    this.vars[n] = c;
  }
  setColorRGB(n, c) {
    this.vars[n] = c;
  }
  setVector3(n, v) {
    this.vars[n] = v;
  }
  setFloat(n, v) {
    this.vars[n] = v;
  }
  setSpeedAndDirection(n, s, d) {
    this.vars[n] = { s, d };
  }
}

export class BlockPermutation {
  constructor(name) {
    this.name = name;
  }
  matches(n) {
    return n === this.name;
  }
  static resolve(n) {
    return new BlockPermutation(n);
  }
}

const REGISTERED_ITEMS = new Set();
export function __registerItems(ids) {
  for (const id of ids) REGISTERED_ITEMS.add(id);
}

export class ItemStack {
  constructor(type, amount = 1) {
    if (!type.startsWith("minecraft:") && !REGISTERED_ITEMS.has(type)) throw new Error("unknown item " + type);
    this.typeId = type;
    this.amount = amount;
    this.lore = [];
    this.keepOnDeath = false;
    this.nameTag = undefined;
  }
  setLore(l) {
    this.lore = [...(l ?? [])];
  }
  getLore() {
    return [...this.lore];
  }
  getComponent(id) {
    if (id === "minecraft:cooldown" && this.typeId.startsWith("gojo:") && !this.typeId.includes("blindfold")) {
      const stack = this;
      return {
        startCooldown(player) {
          log.cooldowns.push({ tick, item: stack.typeId, player: player.id });
        },
      };
    }
    return undefined;
  }
  clone() {
    const c = new ItemStack(this.typeId, this.amount);
    c.lore = [...this.lore];
    c.keepOnDeath = this.keepOnDeath;
    return c;
  }
}

class Container {
  constructor(size) {
    this.size = size;
    this.slots = new Array(size).fill(undefined);
  }
  get emptySlotsCount() {
    return this.slots.filter((s) => !s).length;
  }
  getItem(i) {
    return this.slots[i] ? this.slots[i].clone() : undefined;
  }
  setItem(i, item) {
    this.slots[i] = item ? item.clone() : undefined;
  }
  swapItems(a, b, other) {
    const t = this.slots[a];
    this.slots[a] = other.slots[b];
    other.slots[b] = t;
  }
  addItem(item) {
    const i = this.slots.findIndex((s) => !s);
    if (i >= 0) this.slots[i] = item.clone();
    return i >= 0 ? undefined : item;
  }
  isValid() {
    return true;
  }
}

let nextId = 1;
const entities = new Map();

class Effect {
  constructor(typeId, duration, amplifier) {
    this.typeId = typeId;
    this.duration = duration;
    this.amplifier = amplifier;
  }
  isValid() {
    return true;
  }
}

export class Entity {
  constructor(typeId, location, dimension, opts = {}) {
    this.id = String(nextId++);
    this.typeId = typeId;
    this.location = { ...location };
    this.dimension = dimension;
    this.nameTag = "";
    this.velocity = { x: 0, y: 0, z: 0 };
    this.effects = new Map();
    this.tags = new Set(opts.tags ?? []);
    this.valid = true;
    this.isSneaking = false;
    this.maxHealth = opts.health ?? 20;
    this.health = this.maxHealth;
    this.families = opts.families ?? ["mob"];
    this.yaw = 0;
    this.pitch = 0;
    this.dynamic = {};
    this.gameMode = opts.gameMode;
    this.components = {};
    this.damageLog = [];
    this.animations = [];
    if (opts.owner) this.components["minecraft:projectile"] = { owner: opts.owner };
    if (opts.tamed) this.components["minecraft:is_tamed"] = {};
    const self = this;
    if (opts.health !== 0 && !opts.noHealth) {
      this.components["minecraft:health"] = {
        get currentValue() {
          return self.health;
        },
        get effectiveMax() {
          return self.maxHealth;
        },
        setCurrentValue(v) {
          const old = self.health;
          self.health = Math.max(0, Math.min(self.maxHealth, v));
          if (old !== self.health) queue(world.afterEvents.entityHealthChanged, { entity: self, oldValue: old, newValue: self.health }, self);
          return true;
        },
      };
    }
    entities.set(this.id, this);
    dimension.entities.push(this);
  }
  isValid() {
    return this.valid;
  }
  getHeadLocation() {
    return { x: this.location.x, y: this.location.y + 1.62, z: this.location.z };
  }
  getViewDirection() {
    const yaw = (this.yaw * Math.PI) / 180;
    const pitch = (this.pitch * Math.PI) / 180;
    return { x: -Math.sin(yaw) * Math.cos(pitch), y: -Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
  }
  getRotation() {
    return { x: this.pitch, y: this.yaw };
  }
  setRotation(r) {
    this.pitch = r.x;
    this.yaw = r.y;
  }
  getVelocity() {
    return { ...this.velocity };
  }
  clearVelocity() {
    this.velocity = { x: 0, y: 0, z: 0 };
  }
  applyImpulse(v) {
    if (this.typeId === "minecraft:player") throw new Error("applyImpulse is not supported on players");
    this.velocity.x += v.x;
    this.velocity.y += v.y;
    this.velocity.z += v.z;
  }
  applyKnockback(dx, dz, h, v) {
    this.velocity = { x: dx * h, y: v, z: dz * h };
  }
  applyDamage(amount, opts) {
    if (!this.valid) throw new Error("invalid entity");
    if (this.gameMode === "creative") return false;
    const res = this.effects.get("resistance");
    let dmg = amount;
    if (res) dmg *= Math.max(0, 1 - 0.2 * (res.amplifier + 1));
    const old = this.health;
    this.health = Math.max(0, this.health - dmg);
    this.damageLog.push({ tick, amount: dmg, cause: opts?.cause, by: opts?.damagingEntity?.id });
    queue(world.afterEvents.entityHurt, { hurtEntity: this, damage: dmg, damageSource: { cause: opts?.cause ?? "none", damagingEntity: opts?.damagingEntity } }, this);
    queue(world.afterEvents.entityHealthChanged, { entity: this, oldValue: old, newValue: this.health }, this);
    if (this.health <= 0) {
      const dead = this;
      queue(world.afterEvents.entityDie, { deadEntity: dead, damageSource: { cause: opts?.cause ?? "none" } }, dead);
      if (this.typeId !== "minecraft:player") this.valid = false;
    }
    return true;
  }
  addEffect(id, duration, opts) {
    if (!this.valid) throw new Error("invalid entity");
    const amp = opts?.amplifier ?? 0;
    if (amp < 0 || amp > 255) throw new Error("amplifier out of range");
    if (duration < 0 || duration > 20000000) throw new Error("duration out of range");
    this.effects.set(id, new Effect(id, duration, amp));
  }
  getEffect(id) {
    return this.effects.get(id);
  }
  getEffects() {
    return [...this.effects.values()];
  }
  removeEffect(id) {
    return this.effects.delete(id);
  }
  hasComponent(id) {
    return id in this.components;
  }
  getComponent(id) {
    return this.components[id];
  }
  hasTag(t) {
    return this.tags.has(t);
  }
  addTag(t) {
    this.tags.add(t);
    return true;
  }
  matches(opts) {
    if (opts.gameMode) return this.gameMode === opts.gameMode;
    return true;
  }
  teleport(loc, opts) {
    if (!this.valid) throw new Error("invalid entity");
    this.location = { ...loc };
    if (opts && opts.keepVelocity === false) this.clearVelocity();
    if (opts && opts.facingLocation) this.face(opts.facingLocation);
  }
  tryTeleport(loc, opts) {
    const feet = this.dimension.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });
    const head = this.dimension.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y) + 1, z: Math.floor(loc.z) });
    if (opts?.checkForBlocks && ((feet && !feet.isAir) || (head && !head.isAir))) return false;
    this.teleport(loc, opts);
    return true;
  }
  face(target) {
    const dx = target.x - this.location.x;
    const dz = target.z - this.location.z;
    this.yaw = (Math.atan2(-dx, dz) * 180) / Math.PI;
  }
  playAnimation(name, opts) {
    this.animations.push(name);
    log.animations.push({ tick, entity: this.id, name, opts });
  }
  runCommandAsync(cmd) {
    log.commands.push({ tick, entity: this.id, cmd });
    return Promise.resolve({ successCount: 1 });
  }
  runCommand(cmd) {
    log.commands.push({ tick, entity: this.id, cmd });
    return { successCount: 1 };
  }
  remove() {
    this.valid = false;
  }
  kill() {
    this.health = 0;
    this.valid = false;
    return true;
  }
  extinguishFire() {
    return true;
  }
  getEntitiesFromViewDirection(opts) {
    return this.dimension.getEntitiesFromRay(this.getHeadLocation(), this.getViewDirection(), opts, this);
  }
  getBlockFromViewDirection(opts) {
    return this.dimension.getBlockFromRay(this.getHeadLocation(), this.getViewDirection(), opts);
  }
  getDynamicProperty(k) {
    return this.dynamic[k];
  }
  setDynamicProperty(k, v) {
    this.dynamic[k] = v;
  }
}

export class Player extends Entity {
  constructor(name, location, dimension) {
    super("minecraft:player", location, dimension, { health: 20, families: ["player"], gameMode: "survival" });
    this.name = name;
    const inv = new Container(36);
    this.inventory = inv;
    this.selectedSlot = 0;
    const self = this;
    this.equipment = { Head: undefined, Chest: undefined, Legs: undefined, Feet: undefined, Offhand: undefined };
    this.components["minecraft:inventory"] = { container: inv };
    this.components["minecraft:equippable"] = {
      getEquipment(slot) {
        if (slot === "Mainhand") return inv.getItem(self.selectedSlot);
        return self.equipment[slot] ? self.equipment[slot].clone() : undefined;
      },
      setEquipment(slot, item) {
        if (slot === "Mainhand") inv.setItem(self.selectedSlot, item);
        else self.equipment[slot] = item ? item.clone() : undefined;
        return true;
      },
      getEquipmentSlot(slot) {
        const get = () => (slot === "Mainhand" ? inv.slots[self.selectedSlot] : self.equipment[slot]);
        return {
          hasItem: () => !!get(),
          get typeId() {
            return get()?.typeId;
          },
          getLore: () => get()?.getLore() ?? [],
          setLore: (l) => get()?.setLore(l),
          get keepOnDeath() {
            return get()?.keepOnDeath ?? false;
          },
          set keepOnDeath(v) {
            if (get()) get().keepOnDeath = v;
          },
        };
      },
    };
    this.onScreenDisplay = {
      setActionBar: (t) => log.actionbar.push({ tick, player: this.id, text: t }),
      setTitle: (t, o) => log.titles.push({ tick, player: this.id, title: t, subtitle: o?.subtitle }),
      updateSubtitle: () => {},
      isValid: () => true,
    };
    this.camera = { fade: (o) => log.fades.push({ tick, player: this.id, o }), clear() {}, setCamera() {} };
  }
  playSound(id, opts) {
    log.sounds.push({ tick, player: this.id, id, opts });
  }
  sendMessage(m) {
    log.messages.push({ tick, player: this.id, m });
  }
  applyKnockback(dx, dz, h, v) {
    this.velocity = { x: dx * h, y: v, z: dz * h };
  }
}

class Block {
  constructor(dim, loc) {
    this.dimension = dim;
    this.location = loc;
    this.x = loc.x;
    this.y = loc.y;
    this.z = loc.z;
  }
  get typeName() {
    return this.dimension.blockAt(this.location);
  }
  get isAir() {
    return this.typeName === "minecraft:air";
  }
  get isLiquid() {
    return this.typeName === "minecraft:water" || this.typeName === "minecraft:lava";
  }
  get permutation() {
    return new BlockPermutation(this.typeName);
  }
  getComponent(id) {
    if (id === "minecraft:inventory" && this.typeName === "minecraft:chest") return { container: new Container(27) };
    return undefined;
  }
  getItemStack() {
    if (this.isAir) return undefined;
    return { typeId: this.typeName };
  }
  setPermutation(p) {
    this.dimension.setBlockAt(this.location, p.name);
  }
  isValid() {
    return true;
  }
}

export class Dimension {
  constructor(id) {
    this.id = id;
    this.entities = [];
    this.heightRange = { min: -64, max: 320 };
    this.overrides = new Map();
    this.groundY = 60;
  }
  key(l) {
    return `${l.x},${l.y},${l.z}`;
  }
  blockAt(l) {
    const o = this.overrides.get(this.key(l));
    if (o) return o;
    return l.y < this.groundY ? (l.y === -64 ? "minecraft:bedrock" : "minecraft:stone") : "minecraft:air";
  }
  setBlockAt(l, name) {
    this.overrides.set(this.key(l), name);
    log.blocks = (log.blocks ?? 0) + 1;
  }
  alive() {
    this.entities = this.entities.filter((e) => e.valid);
    return this.entities;
  }
  getEntities(o = {}) {
    let list = this.alive();
    if (o.location && o.maxDistance !== undefined) {
      list = list.filter((e) => dist(e.location, o.location) <= o.maxDistance);
    }
    if (o.type) list = list.filter((e) => e.typeId === o.type);
    if (o.families) list = list.filter((e) => o.families.every((f) => e.families.includes(f)));
    if (o.excludeFamilies) list = list.filter((e) => !o.excludeFamilies.some((f) => e.families.includes(f)));
    if (o.excludeTypes) list = list.filter((e) => !o.excludeTypes.includes(e.typeId));
    if (o.excludeTags) list = list.filter((e) => !o.excludeTags.some((t) => e.tags.has(t)));
    if (o.excludeGameModes) list = list.filter((e) => !e.gameMode || !o.excludeGameModes.includes(e.gameMode));
    if (o.location) list.sort((a, b) => dist(a.location, o.location) - dist(b.location, o.location));
    if (o.closest) list = list.slice(0, o.closest);
    return list;
  }
  getPlayers(o = {}) {
    return this.getEntities(o).filter((e) => e.typeId === "minecraft:player");
  }
  spawnParticle(id, loc, vars) {
    if (!Number.isFinite(loc.x) || !Number.isFinite(loc.y) || !Number.isFinite(loc.z)) throw new Error("bad particle location");
    if (loc.y < -64 || loc.y > 320) throw new Error("LocationOutOfWorldBoundaries");
    log.particles.push({ tick, id, loc, vars: vars?.vars });
  }
  getBlock(l) {
    if (l.y < -64 || l.y > 319) return undefined;
    return new Block(this, { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) });
  }
  getBlockFromRay(from, dir, o = {}) {
    const max = o.maxDistance ?? 64;
    for (let t = 0; t <= max; t += 0.05) {
      const p = { x: from.x + dir.x * t, y: from.y + dir.y * t, z: from.z + dir.z * t };
      const b = this.getBlock(p);
      if (b && !b.isAir && !b.isLiquid) {
        const face = dir.y < -0.5 ? Direction.Up : Direction.North;
        return { block: b, face, faceLocation: { x: p.x - b.x, y: p.y - b.y, z: p.z - b.z } };
      }
    }
    return undefined;
  }
  getEntitiesFromRay(from, dir, o = {}, exclude) {
    const max = o.maxDistance ?? 64;
    const hits = [];
    for (const e of this.alive()) {
      if (exclude && e.id === exclude.id) continue;
      const c = { x: e.location.x, y: e.location.y + 0.9, z: e.location.z };
      const v = { x: c.x - from.x, y: c.y - from.y, z: c.z - from.z };
      const t = v.x * dir.x + v.y * dir.y + v.z * dir.z;
      if (t < 0 || t > max) continue;
      const px = from.x + dir.x * t - c.x;
      const py = from.y + dir.y * t - c.y;
      const pz = from.z + dir.z * t - c.z;
      if (Math.sqrt(px * px + py * py + pz * pz) < 0.9) hits.push({ entity: e, distance: t });
    }
    hits.sort((a, b) => a.distance - b.distance);
    return hits;
  }
  spawnEntity(id, loc) {
    return new Entity(id, loc, this);
  }
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

const overworld = new Dimension("minecraft:overworld");
const worldProps = {};

export const world = {
  afterEvents: {
    itemUse: signal("itemUse"),
    itemUseOn: signal("itemUseOn"),
    entityHitEntity: signal("entityHitEntity"),
    entityHurt: signal("entityHurt"),
    entityHealthChanged: signal("entityHealthChanged"),
    entityDie: signal("entityDie"),
    playerSpawn: signal("playerSpawn"),
    playerLeave: signal("playerLeave"),
    worldInitialize: signal("worldInitialize"),
  },
  beforeEvents: {},
  getAllPlayers: () => overworld.alive().filter((e) => e.typeId === "minecraft:player"),
  getPlayers: (o) => overworld.getPlayers(o),
  getEntity: (id) => {
    const e = entities.get(id);
    return e && e.valid ? e : undefined;
  },
  getDimension: () => overworld,
  getDynamicProperty: (k) => worldProps[k],
  setDynamicProperty: (k, v) => {
    worldProps[k] = v;
  },
};

export const system = {
  get currentTick() {
    return tick;
  },
  run(cb) {
    timeouts.push({ cb, at: tick + 1 });
    return timeouts.length;
  },
  runTimeout(cb, n = 1) {
    timeouts.push({ cb, at: tick + n });
    return timeouts.length;
  },
  runInterval(cb, n = 1) {
    intervals.push({ cb, n });
    return intervals.length;
  },
  clearRun() {},
  afterEvents: { scriptEventReceive: signal("scriptEventReceive") },
};

export const __test = {
  overworld,
  world,
  entities,
  flushEvents() {
    while (eventQueue.length) eventQueue.shift()();
  },
  queue,
  advance(n = 1) {
    for (let i = 0; i < n; i++) {
      tick++;
      // physics: integrate velocities, simple drag
      for (const e of overworld.alive()) {
        e.location.x += e.velocity.x;
        e.location.y += e.velocity.y;
        e.location.z += e.velocity.z;
        const drag = e.components["minecraft:projectile"] ? 0.99 : 0.6;
        e.velocity.x *= drag;
        e.velocity.y *= drag;
        e.velocity.z *= drag;
        for (const [k, eff] of e.effects) {
          eff.duration--;
          if (eff.duration <= 0) e.effects.delete(k);
        }
      }
      this.flushEvents();
      const due = timeouts.filter((t) => t.at <= tick);
      for (const t of due) timeouts.splice(timeouts.indexOf(t), 1);
      for (const t of due) t.cb();
      for (const iv of intervals) if (tick % iv.n === 0) iv.cb();
      this.flushEvents();
    }
  },
  get tick() {
    return tick;
  },
};
