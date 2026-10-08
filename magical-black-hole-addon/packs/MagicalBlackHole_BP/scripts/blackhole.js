// The black hole itself: growth, pulling, swallowing, devouring blocks and collapsing.
import { world, ItemStack, MolangVariableMap, EntityDamageCause, GameMode } from "@minecraft/server";
import {
  ENTITY_ID,
  SIZE_PROPERTY,
  HOLE_DATA_KEY,
  HOLE_TALLY_KEY,
  PLAYER_ACTIVE_KEY,
  PARTICLE_VORTEX,
  PARTICLE_SPARK,
  PARTICLE_BURST,
  LIFETIME_OPTIONS,
  DEFAULT_SETTINGS,
  MIN_SIZE,
  MAX_SIZE,
  TUNING,
  NEVER_PULL,
  ITEMIZE,
  UNBREAKABLE,
} from "./config.js";
import { queueDelivery } from "./delivery.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Container} Container */
/** @typedef {import("@minecraft/server").EntityItemComponent} EntityItemComponent */
/** @typedef {import("@minecraft/server").EntityHealthComponent} EntityHealthComponent */
/** @typedef {import("@minecraft/server").EntityInventoryComponent} EntityInventoryComponent */

/**
 * @typedef {Object} HoleConfig
 * @property {number} maxSize
 * @property {number} lifetimeTicks 0 means "until recalled"
 * @property {boolean} devourBlocks
 * @property {boolean} pullPlayers
 * @property {boolean} protectPets
 */

/** All black holes that are currently loaded, by entity id. */
export const holes = new Map();

// ------------------------------------------------------------------ vectors
/** @param {Vector3} a @param {Vector3} b */
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
/** @param {Vector3} a @param {Vector3} b */
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
/** @param {Vector3} a @param {number} s */
const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
/** @param {Vector3} a */
const length = (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function randomUnitVector() {
  const u = Math.random() * 2 - 1;
  const t = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return { x: r * Math.cos(t), y: u, z: r * Math.sin(t) };
}

// Block offsets around the centre, nearest first, so craters grow outwards evenly.
const BLOCK_OFFSETS = (() => {
  const list = [];
  const r = TUNING.maxBlockRadius;
  for (let x = -r; x <= r; x++) {
    for (let y = -r; y <= r; y++) {
      for (let z = -r; z <= r; z++) {
        const d = Math.sqrt(x * x + y * y + z * z);
        if (d <= r) list.push({ x, y, z, d });
      }
    }
  }
  return list.sort((a, b) => a.d - b.d);
})();

/**
 * @param {{devourBlocks:boolean,maxSize:number,lifetime:number,pullPlayers:boolean,protectPets:boolean}} settings
 * @returns {HoleConfig}
 */
export function configFromSettings(settings) {
  const option = LIFETIME_OPTIONS[settings.lifetime] ?? LIFETIME_OPTIONS[DEFAULT_SETTINGS.lifetime];
  return {
    maxSize: clamp(settings.maxSize, MIN_SIZE, MAX_SIZE),
    lifetimeTicks: option.ticks,
    devourBlocks: settings.devourBlocks,
    pullPlayers: settings.pullPlayers,
    protectPets: settings.protectPets,
  };
}

export class Hole {
  /** @param {Entity} entity */
  constructor(entity) {
    this.entity = entity;
    this.id = entity.id;
    /** @type {Dimension} */
    this.dimension = entity.dimension;
    this.center = { ...entity.location };
    this.ownerId = "";
    this.ownerName = "";
    /** @type {HoleConfig} */
    this.config = configFromSettings(DEFAULT_SETTINGS);
    this.mass = 0;
    this.age = 0;
    this.xp = 0;
    this.size = MIN_SIZE;
    this.stats = { items: 0, mobs: 0, blocks: 0 };
    /** @type {Map<string, number>} plain items stored as typeId -> count */
    this.tally = new Map();
    this.blockCursor = 0;
    this.lastRescan = 0;
    this.lastSentSize = -1;
    this.lastPopTick = -10;
    /** @type {Map<string, number>} entities we already killed -> age when killed */
    this.killed = new Map();
    /** @type {Map<string, number>} player id -> age of last damage */
    this.lastHurt = new Map();
    /** @type {{start:number, fromSize:number, recipientId:string, reason:string} | undefined} */
    this.collapse = undefined;
    this.dirty = true;
  }

  pullRadius() {
    return TUNING.pullRadiusBase + this.size * TUNING.pullRadiusPerSize;
  }

  absorbRadius() {
    return TUNING.absorbRadiusBase + this.size * TUNING.absorbRadiusPerSize;
  }

  /** @returns {Container | undefined} */
  container() {
    const inv = /** @type {EntityInventoryComponent | undefined} */ (this.entity.getComponent("minecraft:inventory"));
    return inv?.container;
  }

  load() {
    try {
      const raw = this.entity.getDynamicProperty(HOLE_DATA_KEY);
      if (typeof raw === "string") {
        const data = JSON.parse(raw);
        this.ownerId = String(data.ownerId ?? "");
        this.ownerName = String(data.ownerName ?? "");
        if (data.config) this.config = { ...this.config, ...data.config };
        this.mass = Number(data.mass) || 0;
        this.age = Number(data.age) || 0;
        this.xp = Number(data.xp) || 0;
        if (data.stats) this.stats = { ...this.stats, ...data.stats };
        if (data.center) this.center = { x: data.center.x, y: data.center.y, z: data.center.z };
      }
      const tally = this.entity.getDynamicProperty(HOLE_TALLY_KEY);
      if (typeof tally === "string") {
        for (const [typeId, count] of Object.entries(JSON.parse(tally))) {
          if (typeof count === "number" && count > 0) this.tally.set(typeId, count);
        }
      }
    } catch (error) {
      console.warn(`[Black Hole] Could not read saved data: ${error}`);
    }
    this.size = this.targetSize();
  }

  save() {
    if (!this.entity.isValid()) return;
    try {
      this.entity.setDynamicProperty(
        HOLE_DATA_KEY,
        JSON.stringify({
          ownerId: this.ownerId,
          ownerName: this.ownerName,
          config: this.config,
          mass: Math.round(this.mass * 1000) / 1000,
          age: this.age,
          xp: this.xp,
          stats: this.stats,
          center: this.center,
        })
      );
      this.entity.setDynamicProperty(HOLE_TALLY_KEY, JSON.stringify(Object.fromEntries(this.tally)));
      this.dirty = false;
    } catch (error) {
      console.warn(`[Black Hole] Could not save: ${error}`);
    }
  }

  targetSize() {
    return clamp(MIN_SIZE + TUNING.growthFactor * Math.sqrt(this.mass), MIN_SIZE, this.config.maxSize);
  }

  /** @param {number} value */
  setVisualSize(value) {
    const v = clamp(Math.round(value * 100) / 100, 0, 10);
    if (Math.abs(v - this.lastSentSize) < 0.02 && !(v === 0 && this.lastSentSize !== 0)) return;
    try {
      this.entity.setProperty(SIZE_PROPERTY, v);
      this.lastSentSize = v;
    } catch {
      // property missing (old pack version) - visuals only
    }
  }

  // -------------------------------------------------------------- storage
  /** @param {string} typeId @param {number} amount */
  addToTally(typeId, amount) {
    if (amount <= 0) return;
    this.tally.set(typeId, (this.tally.get(typeId) ?? 0) + amount);
    this.dirty = true;
  }

  /** Stores a swallowed item stack, keeping enchantments/names/durability when possible. */
  /** @param {ItemStack} stack */
  store(stack) {
    let plain = false;
    if (stack.maxAmount > 1) {
      try {
        plain = new ItemStack(stack.typeId, 1).isStackableWith(stack);
      } catch {
        plain = false;
      }
    }
    if (plain) {
      this.addToTally(stack.typeId, stack.amount);
      return;
    }
    /** @type {ItemStack | undefined} */
    let leftover = stack;
    const container = this.container();
    if (container) {
      try {
        leftover = container.addItem(stack);
      } catch {
        leftover = stack;
      }
    }
    if (leftover) this.addToTally(leftover.typeId, leftover.amount);
    this.dirty = true;
  }

  /** Empties the black hole into a list of item stacks. @returns {ItemStack[]} */
  takeContents() {
    /** @type {ItemStack[]} */
    const stacks = [];
    const container = this.container();
    if (container) {
      for (let slot = 0; slot < container.size; slot++) {
        const item = container.getItem(slot);
        if (item) {
          stacks.push(item);
          container.setItem(slot);
        }
      }
    }
    for (const [typeId, total] of this.tally) {
      let max = 64;
      try {
        max = new ItemStack(typeId, 1).maxAmount;
      } catch {
        continue; // unknown item id, cannot be recreated
      }
      let left = total;
      while (left > 0) {
        const amount = Math.min(max, left);
        stacks.push(new ItemStack(typeId, amount));
        left -= amount;
      }
    }
    this.tally.clear();
    this.dirty = true;
    return stacks;
  }

  // -------------------------------------------------------------- effects
  /** @param {string} soundId @param {number} volume @param {number} pitch */
  sound(soundId, volume, pitch) {
    // world.playSound ignores dimensions, so play it only for players near the hole
    try {
      for (const player of this.dimension.getPlayers({ location: this.center, maxDistance: 64 })) {
        player.playSound(soundId, { location: this.center, volume, pitch });
      }
    } catch {
      // sound outside loaded area
    }
  }

  /** @param {string} effect @param {Vector3} location @param {(map: MolangVariableMap) => void} [fill] */
  particle(effect, location, fill) {
    try {
      const map = new MolangVariableMap();
      if (fill) fill(map);
      this.dimension.spawnParticle(effect, location, map);
    } catch {
      // unloaded chunk or particle limit
    }
  }

  /** A spark that flies from `from` into the black hole. @param {Vector3} from */
  spark(from) {
    const dir = sub(this.center, from);
    this.particle(PARTICLE_SPARK, from, (map) => map.setVector3("variable.dir", dir));
  }

  burst() {
    this.particle(PARTICLE_BURST, this.center, (map) => map.setFloat("variable.size", Math.max(1, this.size)));
  }

  ambientEffects() {
    if (this.age % 4 === 0) {
      const visual = Math.max(0.2, this.lastSentSize);
      this.particle(PARTICLE_VORTEX, this.center, (map) => map.setFloat("variable.size", visual));
    }
    if (this.age % 3 === 0) {
      const r = this.pullRadius() * (0.35 + Math.random() * 0.35);
      this.spark(add(this.center, scale(randomUnitVector(), r)));
    }
    if (this.age % 40 === 0) this.sound("beacon.ambient", 1.5, 0.5);
  }

  /** @param {Vector3} at */
  popEffect(at) {
    this.spark(at);
    if (this.age - this.lastPopTick >= 3) {
      this.lastPopTick = this.age;
      this.sound("mob.endermen.portal", 0.5, 1.4 + Math.random() * 0.4);
    }
  }

  // -------------------------------------------------------------- per tick
  tick() {
    const entity = this.entity;
    if (!entity.isValid()) {
      holes.delete(this.id);
      return;
    }
    this.age++;

    if (this.collapse) {
      this.tickCollapse();
      return;
    }
    if (this.config.lifetimeTicks > 0 && this.age >= this.config.lifetimeTicks) {
      this.beginCollapse("evaporated", this.ownerId);
      return;
    }

    this.mass += TUNING.massPerTick;
    this.size = this.targetSize();
    const opening = Math.min(1, this.age / TUNING.openTicks);
    this.setVisualSize(this.size * opening);

    // Keep it floating exactly where it formed
    if (length(sub(entity.location, this.center)) > 0.05) {
      try {
        entity.teleport(this.center);
      } catch {
        // ignore
      }
    }

    this.pullEntities();
    if (this.config.pullPlayers) this.pullPlayers();
    if (
      this.config.devourBlocks &&
      this.age >= TUNING.devourDelay &&
      this.age % TUNING.devourEvery === 0
    ) {
      this.devourBlocks();
    }
    this.ambientEffects();

    if (this.age % 100 === 0) this.forgetOldKills();
    if (this.dirty && this.age % TUNING.saveEvery === 0) this.save();
  }

  /** @param {Entity} target */
  isProtected(target) {
    if (target.id === this.ownerId) return true;
    if (!this.config.protectPets) return false;
    if (target.typeId === "minecraft:item" || target.typeId === "minecraft:xp_orb") return false;
    if (target.getComponent("minecraft:is_tamed")) return true;
    return typeof target.nameTag === "string" && target.nameTag.length > 0;
  }

  pullEntities() {
    const radius = this.pullRadius();
    const absorb = this.absorbRadius();
    /** @type {Entity[]} */
    let targets;
    try {
      targets = this.dimension.getEntities({ location: this.center, maxDistance: radius, excludeTypes: NEVER_PULL });
    } catch {
      return;
    }
    let processed = 0;
    for (const target of targets) {
      if (processed++ >= TUNING.maxEntitiesPerTick) break;
      try {
        if (!target.isValid() || this.isProtected(target)) continue;
        if (this.killed.has(target.id)) {
          // already killed: let the death animation play, then clean up leftovers
          if (this.age - (this.killed.get(target.id) ?? 0) > TUNING.forgetKilledAfter) target.remove();
          continue;
        }
        const isItem = target.typeId === "minecraft:item" || target.typeId === "minecraft:xp_orb";
        const point = isItem ? target.location : add(target.location, { x: 0, y: 0.5, z: 0 });
        const offset = sub(this.center, point);
        const distance = length(offset);
        if (distance <= absorb) {
          this.swallow(target);
          continue;
        }
        this.pull(target, offset, distance, radius);
      } catch {
        // entity changed or vanished mid-tick
      }
    }
  }

  /**
   * @param {Entity} target
   * @param {Vector3} offset vector from target to centre
   * @param {number} distance
   * @param {number} radius
   */
  pull(target, offset, distance, radius) {
    const dir = scale(offset, 1 / distance);
    const closeness = 1 - Math.min(1, distance / radius);
    const speed = Math.min(TUNING.maxPullSpeed, TUNING.pullSpeed * this.size * (1 + 2 * closeness));
    // horizontal swirl so things spiral in instead of flying straight
    let tx = -dir.z;
    let tz = dir.x;
    const tl = Math.sqrt(tx * tx + tz * tz) || 1;
    tx /= tl;
    tz /= tl;
    const swirl = TUNING.swirl * (1 - closeness) * speed;
    const desired = { x: dir.x * speed + tx * swirl, y: dir.y * speed, z: dir.z * speed + tz * swirl };

    const velocity = target.getVelocity();
    const blend = 0.25 + 0.5 * closeness;
    const next = {
      x: velocity.x + (desired.x - velocity.x) * blend,
      y: velocity.y + (desired.y - velocity.y) * blend + 0.04,
      z: velocity.z + (desired.z - velocity.z) * blend,
    };
    target.clearVelocity();
    target.applyImpulse(next);
  }

  pullPlayers() {
    const radius = this.pullRadius();
    const absorb = this.absorbRadius();
    let players;
    try {
      players = this.dimension.getPlayers({
        location: this.center,
        maxDistance: radius,
        excludeGameModes: [GameMode.creative, GameMode.spectator],
      });
    } catch {
      return;
    }
    for (const player of players) {
      try {
        if (player.id === this.ownerId) continue;
        const offset = sub(this.center, add(player.location, { x: 0, y: 0.9, z: 0 }));
        const distance = Math.max(0.001, length(offset));
        if (distance <= absorb) {
          const last = this.lastHurt.get(player.id) ?? -100;
          if (this.age - last >= TUNING.playerDamageEvery) {
            this.lastHurt.set(player.id, this.age);
            player.applyDamage(TUNING.playerDamage, { cause: EntityDamageCause.magic });
          }
        }
        if (this.age % 2 !== 0) continue;
        const closeness = 1 - Math.min(1, distance / radius);
        const speed = Math.min(TUNING.maxPullSpeed, TUNING.pullSpeed * this.size * (1 + 2 * closeness));
        const horizontal = Math.sqrt(offset.x * offset.x + offset.z * offset.z);
        const hx = horizontal > 0.01 ? offset.x / horizontal : 0;
        const hz = horizontal > 0.01 ? offset.z / horizontal : 0;
        const hStrength = horizontal > 0.01 ? Math.min(1.2, speed * 1.3 * (horizontal / distance)) : 0;
        const vStrength = clamp((offset.y / distance) * speed + 0.05, -0.5, 0.6);
        player.applyKnockback(hx, hz, hStrength, vStrength);
      } catch {
        // player left or died
      }
    }
  }

  /** Swallows one entity. @param {Entity} target */
  swallow(target) {
    const type = target.typeId;
    const at = target.location;

    if (type === "minecraft:item") {
      const item = /** @type {EntityItemComponent | undefined} */ (target.getComponent("minecraft:item"));
      const stack = item?.itemStack;
      if (stack) {
        this.store(stack);
        this.stats.items += stack.amount;
        this.mass += stack.maxAmount > 1 ? TUNING.massPerItem * stack.amount : TUNING.massPerUnstackable;
      }
      target.remove();
      this.dirty = true;
      this.popEffect(at);
      return;
    }

    if (type === "minecraft:xp_orb") {
      this.xp += TUNING.xpPerOrb;
      this.mass += TUNING.massPerItem;
      target.remove();
      this.dirty = true;
      return;
    }

    const asItem = ITEMIZE[type];
    if (asItem) {
      this.addToTally(asItem, 1);
      this.stats.items += 1;
      this.mass += TUNING.massPerItem;
      target.remove();
      this.popEffect(at);
      return;
    }

    const health = /** @type {EntityHealthComponent | undefined} */ (target.getComponent("minecraft:health"));
    if (health && health.currentValue <= 0) return; // already dying
    this.killed.set(target.id, this.age);
    let killed = false;
    try {
      killed = target.kill();
    } catch {
      killed = false;
    }
    if (!killed) target.remove();
    if (health) {
      this.stats.mobs += 1;
      this.mass += TUNING.massPerMobBase + health.effectiveMax / 20;
    } else {
      this.mass += TUNING.massPerUnstackable;
    }
    this.dirty = true;
    this.popEffect(at);
  }

  forgetOldKills() {
    for (const [id, when] of this.killed) {
      if (this.age - when > TUNING.forgetKilledAfter * 3) this.killed.delete(id);
    }
  }

  devourBlocks() {
    const radius = Math.min(TUNING.maxBlockRadius, this.size * TUNING.blockRadiusPerSize);
    const base = { x: Math.floor(this.center.x), y: Math.floor(this.center.y), z: Math.floor(this.center.z) };
    let checks = 0;
    let eaten = 0;
    while (
      this.blockCursor < BLOCK_OFFSETS.length &&
      checks < TUNING.blockChecksPerStep &&
      eaten < TUNING.blocksPerStep
    ) {
      const offset = BLOCK_OFFSETS[this.blockCursor];
      if (offset.d > radius) break;
      this.blockCursor++;
      checks++;
      const location = { x: base.x + offset.x, y: base.y + offset.y, z: base.z + offset.z };
      let block;
      try {
        block = this.dimension.getBlock(location);
      } catch {
        continue; // outside the world
      }
      if (!block || block.isAir || block.isLiquid) continue;
      // Block type ids are beta-only in this API version, so identify blocks by their item form.
      // Technical blocks with no item (portals, fire, piston arms...) are skipped too.
      let itemId;
      try {
        itemId = block.getItemStack(1, false)?.typeId;
      } catch {
        itemId = undefined;
      }
      if (!itemId || UNBREAKABLE.has(itemId) || itemId.startsWith("minecraft:light_block")) continue;
      try {
        // "destroy" drops the block's loot (and container contents) which then gets swallowed
        this.dimension.runCommand(`setblock ${location.x} ${location.y} ${location.z} air destroy`);
      } catch {
        continue;
      }
      eaten++;
      this.stats.blocks++;
      this.mass += TUNING.massPerBlock;
      this.dirty = true;
      if (eaten <= 2) this.spark({ x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 });
    }
    const done = this.blockCursor >= BLOCK_OFFSETS.length || BLOCK_OFFSETS[this.blockCursor].d > radius;
    if (done && this.age - this.lastRescan >= TUNING.rescanEvery) {
      // look again from the middle for blocks that fell in (sand, gravel...)
      this.blockCursor = 0;
      this.lastRescan = this.age;
    }
  }

  // -------------------------------------------------------------- collapse
  /** @param {string} reason @param {string} recipientId */
  beginCollapse(reason, recipientId) {
    if (this.collapse) return;
    this.collapse = { start: this.age, fromSize: Math.max(this.lastSentSize, 0.2), recipientId, reason };
    this.sound("beacon.deactivate", 2, 0.6);
    this.save();
  }

  tickCollapse() {
    const collapse = this.collapse;
    if (!collapse) return;
    const t = (this.age - collapse.start) / TUNING.collapseTicks;
    if (t < 1) {
      this.setVisualSize(collapse.fromSize * (1 - t) * (1 - t));
      if (this.age % 2 === 0) {
        this.particle(PARTICLE_VORTEX, this.center, (map) => map.setFloat("variable.size", collapse.fromSize));
      }
      return;
    }
    this.finishCollapse();
  }

  finishCollapse() {
    const collapse = this.collapse;
    if (!collapse) return;
    this.burst();
    this.sound("mob.warden.sonic_boom", 1.2, 1.3);

    const stacks = this.takeContents();
    const recipient = world.getAllPlayers().find((p) => p.id === collapse.recipientId);
    if (recipient) {
      queueDelivery(stacks, recipient.id, this.dimension, this.center);
      if (this.xp > 0) recipient.addExperience(this.xp);
      const verb = collapse.reason === "recalled" ? "recalled" : "evaporated";
      recipient.sendMessage(
        `§5[Black Hole]§r §dYour black hole ${verb}!§r §7It swallowed §f${this.stats.items}§7 items, §f${this.stats.mobs}§7 mobs and §f${this.stats.blocks}§7 blocks.` +
          (stacks.length > 0 ? " §aEverything inside was sent to your inventory." : "")
      );
      recipient.playSound("random.levelup", { volume: 0.8, pitch: 1.2 });
      try {
        if (recipient.getDynamicProperty(PLAYER_ACTIVE_KEY) === this.id) recipient.setDynamicProperty(PLAYER_ACTIVE_KEY);
      } catch {
        // ignore
      }
    } else {
      // Nobody to give it to: spit everything back out
      queueDelivery(stacks, undefined, this.dimension, this.center);
    }

    holes.delete(this.id);
    try {
      this.entity.remove();
    } catch {
      // already gone
    }
  }
}

/** @param {Entity} entity @returns {Hole} */
export function registerHole(entity) {
  const existing = holes.get(entity.id);
  if (existing) return existing;
  const hole = new Hole(entity);
  hole.load();
  holes.set(entity.id, hole);
  return hole;
}

/** Finds the black hole that belongs to this player, if it is loaded. @param {Player} player */
export function findHoleOf(player) {
  for (const hole of holes.values()) {
    if (hole.ownerId === player.id && hole.entity.isValid()) return hole;
  }
  try {
    const id = player.getDynamicProperty(PLAYER_ACTIVE_KEY);
    if (typeof id === "string") {
      const entity = world.getEntity(id);
      if (entity && entity.isValid() && entity.typeId === ENTITY_ID) return registerHole(entity);
    }
  } catch {
    // ignore
  }
  return undefined;
}

/** Picks up black holes that were loaded from the world save (or summoned with /summon). */
export function scanForHoles() {
  for (const id of ["overworld", "nether", "the_end"]) {
    try {
      for (const entity of world.getDimension(id).getEntities({ type: ENTITY_ID })) {
        if (!holes.has(entity.id)) registerHole(entity);
      }
    } catch {
      // dimension not available
    }
  }
}
