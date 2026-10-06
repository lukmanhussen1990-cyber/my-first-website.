// Behavioural mock of @minecraft/server 1.11.0 (Bedrock 1.21.0.26) for node:test.
//
// Loaded in place of the real module by tests/mock/register.mjs (resolve hook).
// Only the API surface the add-on needs is implemented, but what exists tries
// to behave like the game: read-only mode in before-events, unloaded chunks,
// height limits, block-state validation against mojang-blocks.json, entity
// families/events/component groups from the real entity JSON, etc.
// Test-only controls live on the extra export `__mock` (re-exported as `mock`
// by tests/mock/testkit.mjs). See tests/mock/README.md.

import fs from "node:fs";
import * as V from "./vanilla.mjs";
import { readNbt } from "./nbt.mjs";
import * as E from "./enums.mjs";

export * from "./enums.mjs";

const ST = Symbol("pas.mock.state");
const INTERNAL = Symbol("pas.mock.internal");

// ===========================================================================
// Errors and constants
// ===========================================================================

function defineError(name) {
  const C = class extends Error {
    constructor(message) {
      super(message);
      this.name = name;
    }
  };
  Object.defineProperty(C, "name", { value: name });
  return C;
}

export const CommandError = defineError("CommandError");
export const EnchantmentLevelOutOfBoundsError = defineError("EnchantmentLevelOutOfBoundsError");
export const EnchantmentTypeNotCompatibleError = defineError("EnchantmentTypeNotCompatibleError");
export const EnchantmentTypeUnknownIdError = defineError("EnchantmentTypeUnknownIdError");
export const InvalidContainerSlotError = defineError("InvalidContainerSlotError");
export const InvalidStructureError = defineError("InvalidStructureError");
export const LocationInUnloadedChunkError = defineError("LocationInUnloadedChunkError");
export const LocationOutOfWorldBoundariesError = defineError("LocationOutOfWorldBoundariesError");

export const HudElementsCount = 13;
export const HudVisibilityCount = 2;
export const MoonPhaseCount = 8;
export const TicksPerSecond = 20;

export class MinecraftDimensionTypes {
  static nether = "minecraft:nether";
  static overworld = "minecraft:overworld";
  static theEnd = "minecraft:the_end";
}

// Functions that "can't be called in read-only mode" (privilege != read_only in
// metadata/script_modules/@minecraft/server_1.11.0.json) are guarded with assertWritable().

// ===========================================================================
// Global mock state
// ===========================================================================

const DEFAULT_OPTIONS = Object.freeze({
  /** Rethrow errors that escaped event handlers / scheduled jobs at the end of tick()/fire*(). */
  throwHandlerErrors: true,
  /** Ticks a dead mob stays (valid, health 0) before it is removed, like the death animation. */
  deathRemovalTicks: 20,
  /** Run minecraft:entity_spawned for vanilla mobs (random babies/professions). Off = deterministic. */
  runVanillaSpawnEvents: false,
  /** Structure placement with animationMode Layers/Blocks is spread over animationSeconds. */
  animateStructures: true,
  /** Dimension.getBlock in an unloaded chunk: "undefined" (documented return) or "throw" (LocationInUnloadedChunkError). */
  unloadedGetBlock: "undefined",
  /** triggerEvent() throws when the entity definition does not define the event (documented behaviour). */
  strictTriggerEvent: true,
  /** Default maxDistance for getBlockFromRay when none is given. */
  defaultRayDistance: 1000,
  /** Seed of the deterministic RNG (randomize events, integrity). */
  seed: 12345,
});

function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyRecords() {
  return {
    sounds: [],
    particles: [],
    commands: [],
    messages: [],
    actionbars: [],
    titles: [],
    triggered: [],
    structurePlacements: [],
    spawned: [],
    music: [],
    explosions: [],
  };
}

function freshState(options) {
  const opts = { ...DEFAULT_OPTIONS, ...(options || {}) };
  return {
    options: opts,
    tick: 0,
    jobs: new Map(),
    nextJobId: 1,
    queue: [],
    readOnlyDepth: 0,
    dims: new Map(),
    entities: new Map(),
    offlinePlayers: new Map(),
    nextEntityId: 1,
    worldProps: new Map(),
    structures: new Map(),
    animations: [],
    records: emptyRecords(),
    errors: [],
    warnings: [],
    rng: makeRng(opts.seed),
    commandHandler: undefined,
    timeOfDay: 1000,
    absoluteTime: 0,
    defaultSpawn: { x: 0, y: 64, z: 0 },
    pendingStartup: { worldInitialize: true, entityLoad: false, players: [] },
  };
}

let S = freshState();

function warn(msg) {
  S.warnings.push(msg);
}

function assertWritable(fn) {
  if (S.readOnlyDepth > 0) {
    throw new Error(`Native function [${fn}] does not have required privileges. (mock: called in read-only mode, e.g. inside a before-event)`);
  }
}

function recordError(where, error) {
  S.errors.push({ where, error, tick: S.tick });
}

function copyVec(v) {
  return { x: v.x, y: v.y, z: v.z };
}

function floor3(v) {
  if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
    throw new TypeError(`Invalid Vector3 ${JSON.stringify(v)}`);
  }
  return { x: Math.floor(v.x), y: Math.floor(v.y), z: Math.floor(v.z) };
}

function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function utf8Bytes(s) {
  return Buffer.byteLength(s, "utf8");
}

const MAX_DYNPROP_STRING = 32767;

function checkDynamicValue(identifier, value) {
  if (typeof identifier !== "string" || identifier.length === 0) throw new TypeError("Dynamic property identifier must be a non-empty string");
  if (value === undefined) return undefined;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    // The game limits dynamic-property strings to 32767; the mock enforces it on
    // UTF-8 bytes (>= characters) so code that passes here passes in game.
    if (utf8Bytes(value) > MAX_DYNPROP_STRING) {
      throw new Error(`Dynamic property '${identifier}' string value too long (${value.length} chars / ${utf8Bytes(value)} bytes > ${MAX_DYNPROP_STRING})`);
    }
    return value;
  }
  if (value && typeof value === "object" && ["x", "y", "z"].every((k) => typeof value[k] === "number")) return copyVec(value);
  throw new TypeError(`Unsupported dynamic property value type for '${identifier}': ${typeof value}`);
}

function dynPropBytes(map) {
  let n = 0;
  for (const [k, v] of map) {
    n += utf8Bytes(k);
    if (typeof v === "string") n += utf8Bytes(v);
    else if (typeof v === "number") n += 8;
    else if (typeof v === "boolean") n += 1;
    else n += 24;
  }
  return n;
}

function cloneDynValue(v) {
  return v && typeof v === "object" ? copyVec(v) : v;
}

// ===========================================================================
// Event signals
// ===========================================================================

const ENTITY_FIELD = {
  entityHurt: "hurtEntity",
  entityDie: "deadEntity",
  entityHealthChanged: "entity",
  dataDrivenEntityTrigger: "entity",
  effectAdd: "entity",
  entityHitEntity: "damagingEntity",
  entityHitBlock: "damagingEntity",
};

function passesOptions(signalName, options, ev) {
  if (!options) return true;
  if (signalName === "scriptEventReceive") {
    if (options.namespaces && options.namespaces.length) {
      const ns = String(ev.id).split(":")[0];
      return options.namespaces.includes(ns);
    }
    return true;
  }
  if (signalName === "entityRemove") {
    if (options.entityTypes && !options.entityTypes.map(V.normalizeId).includes(ev.typeId)) return false;
    if (options.entities && !options.entities.some((e) => e.id === ev.removedEntityId)) return false;
    return true;
  }
  const field = ENTITY_FIELD[signalName];
  if (!field) return true;
  const ent = ev[field];
  if (options.entities && options.entities.length && !options.entities.some((e) => e && ent && e.id === ent.id)) return false;
  if (options.entityTypes && options.entityTypes.length && !(ent && options.entityTypes.map(V.normalizeId).includes(ent.typeId))) return false;
  if (options.eventTypes && options.eventTypes.length && !options.eventTypes.includes(ev.eventId)) return false;
  return true;
}

class Signal {
  constructor(name, kind) {
    this[INTERNAL] = { name, kind, subs: [] };
  }
  subscribe(callback, options) {
    if (typeof callback !== "function") throw new TypeError("subscribe: callback must be a function");
    this[INTERNAL].subs.push({ callback, options });
    return callback;
  }
  unsubscribe(callback) {
    const subs = this[INTERNAL].subs;
    const i = subs.findIndex((s) => s.callback === callback);
    if (i >= 0) subs.splice(i, 1);
  }
}

function deliver(signal, ev) {
  const { name, kind, subs } = signal[INTERNAL];
  const before = kind === "before";
  if (before) S.readOnlyDepth++;
  try {
    for (const s of [...subs]) {
      if (!passesOptions(name, s.options, ev)) continue;
      try {
        s.callback(ev);
      } catch (e) {
        recordError(`${kind}Events.${name}`, e);
      }
    }
  } finally {
    if (before) S.readOnlyDepth--;
  }
  return ev;
}

const AFTER_NAMES = [
  "buttonPush", "dataDrivenEntityTrigger", "effectAdd", "entityDie", "entityHealthChanged", "entityHitBlock",
  "entityHitEntity", "entityHurt", "entityLoad", "entityRemove", "entitySpawn", "explosion", "gameRuleChange",
  "itemCompleteUse", "itemReleaseUse", "itemStartUse", "itemStartUseOn", "itemStopUse", "itemStopUseOn", "itemUse",
  "itemUseOn", "leverAction", "pistonActivate", "playerBreakBlock", "playerDimensionChange", "playerGameModeChange",
  "playerJoin", "playerLeave", "playerPlaceBlock", "playerSpawn", "pressurePlatePop", "pressurePlatePush",
  "projectileHitBlock", "projectileHitEntity", "targetBlockHit", "tripWireTrip", "weatherChange", "worldInitialize",
];
const BEFORE_NAMES = [
  "effectAdd", "entityRemove", "explosion", "itemUse", "itemUseOn", "playerBreakBlock", "playerGameModeChange",
  "playerLeave", "weatherChange",
];

class WorldAfterEvents {}
class WorldBeforeEvents {}
class SystemAfterEvents {}

const afterEvents = new WorldAfterEvents();
for (const n of AFTER_NAMES) Object.defineProperty(afterEvents, n, { value: new Signal(n, "after"), enumerable: true });
const beforeEvents = new WorldBeforeEvents();
for (const n of BEFORE_NAMES) Object.defineProperty(beforeEvents, n, { value: new Signal(n, "before"), enumerable: true });
const systemAfterEvents = new SystemAfterEvents();
Object.defineProperty(systemAfterEvents, "scriptEventReceive", { value: new Signal("scriptEventReceive", "after"), enumerable: true });

/** Queue an after-event (delivered at the end of the current/next tick or on flush()). */
function queueAfter(name, ev) {
  S.queue.push({ signal: afterEvents[name], ev });
}

function flushQueue() {
  let guard = 0;
  while (S.queue.length) {
    if (++guard > 100000) throw new Error("mock: event queue did not drain (infinite event loop?)");
    const { signal, ev } = S.queue.shift();
    deliver(signal, ev);
  }
}

// ===========================================================================
// System / scheduler
// ===========================================================================

function addJob(cb, delay, interval) {
  if (typeof cb !== "function") throw new TypeError("callback must be a function");
  const id = S.nextJobId++;
  S.jobs.set(id, { id, cb, due: S.tick + delay, interval });
  return id;
}

export class System {
  constructor(token) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
  }
  get afterEvents() {
    return systemAfterEvents;
  }
  get currentTick() {
    return S.tick;
  }
  run(callback) {
    return addJob(callback, 1, 0);
  }
  runTimeout(callback, tickDelay = 1) {
    const d = Math.max(1, Math.floor(Number(tickDelay) || 0));
    return addJob(callback, d, 0);
  }
  runInterval(callback, tickInterval = 1) {
    const d = Math.max(1, Math.floor(Number(tickInterval) || 0));
    return addJob(callback, d, d);
  }
  clearRun(runId) {
    S.jobs.delete(runId);
  }
}

export const system = new System(INTERNAL);

function tickOnce() {
  S.tick++;
  S.absoluteTime++;
  S.timeOfDay = (S.timeOfDay + 1) % 24000;
  const due = [...S.jobs.values()].filter((j) => j.due <= S.tick).sort((a, b) => a.due - b.due || a.id - b.id);
  for (const j of due) {
    if (!S.jobs.has(j.id)) continue;
    if (j.interval) j.due = S.tick + j.interval;
    else S.jobs.delete(j.id);
    try {
      j.cb();
    } catch (e) {
      recordError(`job#${j.id}`, e);
    }
  }
  simulateWorld();
  flushQueue();
}

function simulateWorld() {
  // effects
  for (const ent of S.entities.values()) {
    const st = ent[ST];
    if (st.removed) continue;
    for (const [k, eff] of st.effects) {
      eff.duration--;
      if (eff.duration <= 0) st.effects.delete(k);
    }
    if (st.dead && !st.isPlayer && S.tick >= st.removeAtTick) removeEntityInternal(ent, true);
  }
  // structure animations
  for (const anim of [...S.animations]) {
    const batch = anim.steps.get(S.tick - anim.startTick);
    if (batch) for (const op of batch) applyStructureOp(anim.dim, op);
    if (S.tick - anim.startTick >= anim.lastStep) S.animations.splice(S.animations.indexOf(anim), 1);
  }
}

// ===========================================================================
// Blocks: types, permutations
// ===========================================================================

export class BlockType {
  constructor(token, id) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this.id = id;
  }
}
const blockTypeCache = new Map();
function blockTypeObj(id) {
  if (!blockTypeCache.has(id)) blockTypeCache.set(id, new BlockType(INTERNAL, id));
  return blockTypeCache.get(id);
}

export class BlockTypes {
  static get(typeName) {
    const id = V.normalizeId(typeName);
    const reg = V.blockRegistry();
    if (reg.available && !reg.blocks.has(id)) return undefined;
    return blockTypeObj(id);
  }
  static getAll() {
    return [...V.blockRegistry().blocks.keys()].map(blockTypeObj);
  }
}

export class BlockStateType {
  constructor(token, id, validValues) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this.id = id;
    this.validValues = validValues;
  }
}
export class BlockStates {
  static get(stateName) {
    const t = V.blockStateTypes().find((s) => s.id === stateName);
    return t ? new BlockStateType(INTERNAL, t.id, [...t.validValues]) : undefined;
  }
  static getAll() {
    return V.blockStateTypes().map((t) => new BlockStateType(INTERNAL, t.id, [...t.validValues]));
  }
}

const permCache = new Map();

function permKey(name, states) {
  const keys = Object.keys(states).sort();
  return `${name}[${keys.map((k) => `${k}=${JSON.stringify(states[k])}`).join(",")}]`;
}

function stateTypeOk(prop, v) {
  if (prop.type === "bool") return typeof v === "boolean";
  if (prop.type === "int") return Number.isInteger(v) && prop.values.includes(v);
  if (prop.type === "string") return typeof v === "string" && prop.values.includes(v);
  return prop.values.includes(v);
}

/** Resolve a permutation, validating against mojang-blocks.json (throws like the game). */
function resolvePerm(blockName, states) {
  if (typeof blockName !== "string" || !blockName) throw new TypeError("BlockPermutation.resolve: block name must be a string");
  const name = V.normalizeId(blockName);
  const reg = V.blockRegistry();
  const given = states || {};
  let full;
  if (reg.available) {
    const def = reg.blocks.get(name);
    if (!def) throw new Error(`Failed to resolve block "${blockName}": unknown block type`);
    full = {};
    for (const p of def.props) full[p.name] = p.values[0];
    for (const [k, v] of Object.entries(given)) {
      const prop = def.props.find((p) => p.name === k);
      if (!prop) throw new Error(`Failed to resolve block "${name}": block has no state "${k}"`);
      if (!stateTypeOk(prop, v)) {
        throw new Error(`Failed to resolve block "${name}": invalid value ${JSON.stringify(v)} for state "${k}" (${prop.type}: ${JSON.stringify(prop.values)})`);
      }
      full[k] = v;
    }
  } else {
    full = { ...given };
  }
  const key = permKey(name, full);
  let p = permCache.get(key);
  if (!p) {
    p = new BlockPermutation(INTERNAL, name, Object.freeze(full));
    permCache.set(key, p);
  }
  return p;
}

export class BlockPermutation {
  constructor(token, name, states) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this[ST] = { name, states };
  }
  get type() {
    return blockTypeObj(this[ST].name);
  }
  getAllStates() {
    return { ...this[ST].states };
  }
  getState(stateName) {
    return this[ST].states[stateName];
  }
  getItemStack(amount = 1) {
    return V.isKnownItem(this[ST].name) ? new ItemStack(this[ST].name, amount) : undefined;
  }
  matches(blockName, states) {
    if (V.normalizeId(blockName) !== this[ST].name) return false;
    if (states) for (const [k, v] of Object.entries(states)) if (this[ST].states[k] !== v) return false;
    return true;
  }
  withState(name, value) {
    return resolvePerm(this[ST].name, { ...this[ST].states, [name]: value });
  }
  static resolve(blockName, states) {
    return resolvePerm(blockName, states);
  }
  toString() {
    return permKey(this[ST].name, this[ST].states);
  }
}

let AIR;
function air() {
  if (!AIR) AIR = resolvePerm("minecraft:air", {});
  return AIR;
}

// ===========================================================================
// Items and containers
// ===========================================================================

export class ItemType {
  constructor(token, id) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this.id = id;
  }
}

export class ItemStack {
  constructor(itemType, amount = 1) {
    const raw = typeof itemType === "string" ? itemType : itemType?.id;
    if (typeof raw !== "string" || !raw) throw new TypeError("ItemStack: invalid item type");
    const id = V.normalizeId(raw);
    if (!V.isKnownItem(id)) throw new Error(`ItemStack: invalid item identifier '${raw}'`);
    if (!Number.isInteger(amount) || amount < 1 || amount > 255) throw new RangeError(`ItemStack amount ${amount} outside 1-255`);
    const max = V.itemMaxStack(id);
    this[ST] = {
      typeId: id,
      amount: Math.min(amount, max),
      nameTag: undefined,
      lore: [],
      keepOnDeath: false,
      lockMode: E.ItemLockMode.none,
      props: new Map(),
      canDestroy: [],
      canPlaceOn: [],
    };
  }
  get typeId() {
    return this[ST].typeId;
  }
  get type() {
    return new ItemType(INTERNAL, this[ST].typeId);
  }
  get amount() {
    return this[ST].amount;
  }
  set amount(v) {
    assertWritable("ItemStack::amount");
    if (!Number.isInteger(v) || v < 1 || v > 255) throw new RangeError(`ItemStack amount ${v} outside 1-255`);
    this[ST].amount = Math.min(v, this.maxAmount);
  }
  get maxAmount() {
    return V.itemMaxStack(this[ST].typeId);
  }
  get isStackable() {
    return this.maxAmount > 1 && this[ST].props.size === 0;
  }
  get keepOnDeath() {
    return this[ST].keepOnDeath;
  }
  set keepOnDeath(v) {
    assertWritable("ItemStack::keepOnDeath");
    this[ST].keepOnDeath = !!v;
  }
  get lockMode() {
    return this[ST].lockMode;
  }
  set lockMode(v) {
    assertWritable("ItemStack::lockMode");
    if (!Object.values(E.ItemLockMode).includes(v)) throw new TypeError(`invalid lockMode ${v}`);
    this[ST].lockMode = v;
  }
  get nameTag() {
    return this[ST].nameTag;
  }
  set nameTag(v) {
    assertWritable("ItemStack::nameTag");
    if (v !== undefined && typeof v !== "string") throw new TypeError("nameTag must be a string");
    if (v !== undefined && v.length > 255) throw new Error("ItemStack nameTag longer than 255 characters");
    this[ST].nameTag = v === "" ? undefined : v;
  }
  clone() {
    const c = new ItemStack(this[ST].typeId, 1);
    const s = this[ST];
    c[ST] = { ...s, lore: [...s.lore], props: new Map([...s.props].map(([k, v]) => [k, cloneDynValue(v)])), canDestroy: [...s.canDestroy], canPlaceOn: [...s.canPlaceOn] };
    return c;
  }
  getLore() {
    return [...this[ST].lore];
  }
  setLore(loreList) {
    assertWritable("ItemStack::setLore");
    if (loreList === undefined) {
      this[ST].lore = [];
      return;
    }
    if (!Array.isArray(loreList) || loreList.some((l) => typeof l !== "string")) throw new TypeError("setLore expects string[]");
    this[ST].lore = [...loreList];
  }
  getCanDestroy() {
    return [...this[ST].canDestroy];
  }
  getCanPlaceOn() {
    return [...this[ST].canPlaceOn];
  }
  setCanDestroy(ids) {
    assertWritable("ItemStack::setCanDestroy");
    this[ST].canDestroy = [...(ids || [])];
  }
  setCanPlaceOn(ids) {
    assertWritable("ItemStack::setCanPlaceOn");
    this[ST].canPlaceOn = [...(ids || [])];
  }
  getComponent() {
    return undefined;
  }
  getComponents() {
    return [];
  }
  hasComponent() {
    return false;
  }
  getTags() {
    return [];
  }
  hasTag() {
    return false;
  }
  isStackableWith(other) {
    if (!(other instanceof ItemStack)) return false;
    const a = this[ST];
    const b = other[ST];
    return (
      this.isStackable &&
      other.isStackable &&
      a.typeId === b.typeId &&
      a.nameTag === b.nameTag &&
      JSON.stringify(a.lore) === JSON.stringify(b.lore) &&
      a.keepOnDeath === b.keepOnDeath &&
      a.lockMode === b.lockMode
    );
  }
  matches(itemName) {
    return V.normalizeId(itemName) === this[ST].typeId;
  }
  getDynamicProperty(id) {
    return cloneDynValue(this[ST].props.get(id));
  }
  setDynamicProperty(id, value) {
    if (this.maxAmount > 1) throw new Error("ItemStack.setDynamicProperty: dynamic properties are not supported on stackable items");
    const v = checkDynamicValue(id, value);
    if (v === undefined) this[ST].props.delete(id);
    else this[ST].props.set(id, v);
  }
  getDynamicPropertyIds() {
    return [...this[ST].props.keys()];
  }
  getDynamicPropertyTotalByteCount() {
    return dynPropBytes(this[ST].props);
  }
  clearDynamicProperties() {
    this[ST].props.clear();
  }
}

function serializeItem(it) {
  if (!it) return null;
  const s = it[ST];
  return {
    typeId: s.typeId,
    amount: s.amount,
    nameTag: s.nameTag,
    lore: [...s.lore],
    keepOnDeath: s.keepOnDeath,
    lockMode: s.lockMode,
    props: [...s.props],
  };
}
function deserializeItem(o) {
  if (!o) return undefined;
  const it = new ItemStack(o.typeId, 1);
  Object.assign(it[ST], {
    amount: o.amount,
    nameTag: o.nameTag ?? undefined,
    lore: o.lore || [],
    keepOnDeath: !!o.keepOnDeath,
    lockMode: o.lockMode || "none",
    props: new Map(o.props || []),
  });
  return it;
}

class ContainerState {
  constructor(size) {
    this.size = size;
    this.slots = new Array(size).fill(undefined);
    this.valid = true;
  }
}

function checkSlot(cs, slot) {
  if (!cs.valid) throw new Error("Container is invalid");
  if (!Number.isInteger(slot) || slot < 0 || slot >= cs.size) throw new RangeError(`Slot ${slot} out of bounds (size ${cs.size})`);
}

export class Container {
  constructor(token, cs) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this[ST] = cs;
  }
  get size() {
    if (!this[ST].valid) throw new Error("Container is invalid");
    return this[ST].size;
  }
  get emptySlotsCount() {
    if (!this[ST].valid) throw new Error("Container is invalid");
    return this[ST].slots.filter((s) => !s).length;
  }
  isValid() {
    return this[ST].valid;
  }
  getItem(slot) {
    checkSlot(this[ST], slot);
    return this[ST].slots[slot]?.clone();
  }
  setItem(slot, itemStack) {
    assertWritable("Container::setItem");
    checkSlot(this[ST], slot);
    this[ST].slots[slot] = itemStack ? itemStack.clone() : undefined;
  }
  getSlot(slot) {
    checkSlot(this[ST], slot);
    return new ContainerSlot(INTERNAL, this[ST], slot);
  }
  addItem(itemStack) {
    assertWritable("Container::addItem");
    const cs = this[ST];
    if (!cs.valid) throw new Error("Container is invalid");
    const item = itemStack.clone();
    let left = item.amount;
    for (let i = 0; i < cs.size && left > 0; i++) {
      const s = cs.slots[i];
      if (s && s.isStackableWith(item) && s.amount < s.maxAmount) {
        const n = Math.min(left, s.maxAmount - s.amount);
        s[ST].amount += n;
        left -= n;
      }
    }
    for (let i = 0; i < cs.size && left > 0; i++) {
      if (!cs.slots[i]) {
        const c = item.clone();
        const n = Math.min(left, c.maxAmount);
        c[ST].amount = n;
        cs.slots[i] = c;
        left -= n;
      }
    }
    if (left <= 0) return undefined;
    const rest = item.clone();
    rest[ST].amount = left;
    return rest;
  }
  clearAll() {
    assertWritable("Container::clearAll");
    if (!this[ST].valid) throw new Error("Container is invalid");
    this[ST].slots.fill(undefined);
  }
  swapItems(slot, otherSlot, otherContainer) {
    assertWritable("Container::swapItems");
    const a = this[ST];
    const b = otherContainer[ST];
    checkSlot(a, slot);
    checkSlot(b, otherSlot);
    const t = a.slots[slot];
    a.slots[slot] = b.slots[otherSlot];
    b.slots[otherSlot] = t;
  }
  moveItem(fromSlot, toSlot, toContainer) {
    assertWritable("Container::moveItem");
    const a = this[ST];
    const b = toContainer[ST];
    checkSlot(a, fromSlot);
    checkSlot(b, toSlot);
    const it = a.slots[fromSlot];
    if (!it) return;
    const dst = b.slots[toSlot];
    if (!dst) {
      b.slots[toSlot] = it;
      a.slots[fromSlot] = undefined;
    } else if (dst.isStackableWith(it)) {
      const n = Math.min(it.amount, dst.maxAmount - dst.amount);
      dst[ST].amount += n;
      it[ST].amount -= n;
      if (it.amount <= 0) a.slots[fromSlot] = undefined;
    }
  }
  transferItem(fromSlot, toContainer) {
    assertWritable("Container::transferItem");
    const a = this[ST];
    checkSlot(a, fromSlot);
    const it = a.slots[fromSlot];
    if (!it) return undefined;
    a.slots[fromSlot] = undefined;
    return toContainer.addItem(it);
  }
}

export class ContainerSlot {
  constructor(token, cs, slot) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this[ST] = { cs, slot };
  }
  _item(required = true) {
    const { cs, slot } = this[ST];
    if (!cs.valid) throw new InvalidContainerSlotError("Container is invalid");
    const it = cs.slots[slot];
    if (!it && required) throw new InvalidContainerSlotError("Slot is empty");
    return it;
  }
  isValid() {
    return this[ST].cs.valid;
  }
  hasItem() {
    return !!this._item(false);
  }
  getItem() {
    return this._item(false)?.clone();
  }
  setItem(itemStack) {
    assertWritable("ContainerSlot::setItem");
    this._item(false);
    this[ST].cs.slots[this[ST].slot] = itemStack ? itemStack.clone() : undefined;
  }
  get typeId() {
    return this._item().typeId;
  }
  get type() {
    return this._item().type;
  }
  get amount() {
    return this._item().amount;
  }
  set amount(v) {
    this._item().amount = v;
  }
  get maxAmount() {
    return this._item().maxAmount;
  }
  get isStackable() {
    return this._item().isStackable;
  }
  get nameTag() {
    return this._item().nameTag;
  }
  set nameTag(v) {
    this._item().nameTag = v;
  }
  get keepOnDeath() {
    return this._item().keepOnDeath;
  }
  set keepOnDeath(v) {
    this._item().keepOnDeath = v;
  }
  get lockMode() {
    return this._item().lockMode;
  }
  set lockMode(v) {
    this._item().lockMode = v;
  }
  getLore() {
    return this._item().getLore();
  }
  setLore(l) {
    this._item().setLore(l);
  }
  getTags() {
    return [];
  }
  hasTag() {
    return false;
  }
  isStackableWith(o) {
    return this._item().isStackableWith(o);
  }
  getCanDestroy() {
    return this._item().getCanDestroy();
  }
  getCanPlaceOn() {
    return this._item().getCanPlaceOn();
  }
  setCanDestroy(v) {
    this._item().setCanDestroy(v);
  }
  setCanPlaceOn(v) {
    this._item().setCanPlaceOn(v);
  }
  getDynamicProperty(id) {
    return this._item().getDynamicProperty(id);
  }
  setDynamicProperty(id, v) {
    this._item().setDynamicProperty(id, v);
  }
  getDynamicPropertyIds() {
    return this._item().getDynamicPropertyIds();
  }
  getDynamicPropertyTotalByteCount() {
    return this._item().getDynamicPropertyTotalByteCount();
  }
  clearDynamicProperties() {
    this._item().clearDynamicProperties();
  }
}

// ===========================================================================
// Dimensions and block storage
// ===========================================================================

const DIM_DEFS = [
  { id: "minecraft:overworld", min: -64, max: 320 },
  { id: "minecraft:nether", min: 0, max: 128 },
  { id: "minecraft:the_end", min: 0, max: 256 },
];

class DimState {
  constructor(id, min, max) {
    this.id = id;
    this.min = min;
    this.max = max;
    this.blocks = new Map();
    this.containers = new Map();
    this.unloaded = new Set();
    this.loadedPredicate = undefined;
    this.api = new Dimension(INTERNAL, this);
  }
}

// Dimension objects are created once per process and cleared in place on
// reset/load, so add-on modules that cached world.getDimension(...) at import
// time keep working across mock.reset() / mock.loadWorld().
let DIMS;
function initDims() {
  if (!DIMS) {
    DIMS = new Map();
    for (const d of DIM_DEFS) DIMS.set(d.id, new DimState(d.id, d.min, d.max));
  }
  for (const ds of DIMS.values()) {
    ds.blocks = new Map();
    for (const c of ds.containers.values()) c.state.valid = false;
    ds.containers = new Map();
    ds.unloaded = new Set();
    ds.loadedPredicate = undefined;
  }
  S.dims = DIMS;
}

function dimState(idOrDim) {
  if (idOrDim instanceof Dimension) return idOrDim[ST];
  if (idOrDim instanceof DimState) return idOrDim;
  const id = V.normalizeId(String(idOrDim ?? "minecraft:overworld"));
  const d = S.dims.get(id);
  if (!d) throw new Error(`Unknown dimension '${idOrDim}'`);
  return d;
}

const bkey = (x, y, z) => `${x},${y},${z}`;

function chunkLoaded(ds, x, z) {
  const cx = Math.floor(x) >> 4;
  const cz = Math.floor(z) >> 4;
  if (ds.unloaded.has(`${cx},${cz}`)) return false;
  if (ds.loadedPredicate) return !!ds.loadedPredicate(cx, cz);
  return true;
}

function inHeight(ds, y) {
  return y >= ds.min && y < ds.max;
}

function getPerm(ds, x, y, z) {
  return ds.blocks.get(bkey(x, y, z)) ?? air();
}

function setPermRaw(ds, x, y, z, perm) {
  const k = bkey(x, y, z);
  const name = perm[ST].name;
  if (name === "minecraft:air") ds.blocks.delete(k);
  else ds.blocks.set(k, perm);
  const size = V.containerSize(name);
  const existing = ds.containers.get(k);
  if (size > 0) {
    if (!existing || existing.blockName !== name.replace(/^minecraft:lit_/, "minecraft:")) {
      if (existing) existing.state.valid = false;
      const cs = new ContainerState(size);
      ds.containers.set(k, { blockName: name.replace(/^minecraft:lit_/, "minecraft:"), state: cs });
    }
  } else if (existing) {
    existing.state.valid = false;
    ds.containers.delete(k);
  }
}

function assertBlockAccessible(ds, x, y, z) {
  if (!inHeight(ds, y)) throw new LocationOutOfWorldBoundariesError(`Location (${x}, ${y}, ${z}) is outside the height range of ${ds.id}`);
  if (!chunkLoaded(ds, x, z)) throw new LocationInUnloadedChunkError(`Location (${x}, ${y}, ${z}) is in an unloaded chunk of ${ds.id}`);
}

export class Block {
  constructor(token, ds, x, y, z) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this[ST] = { ds, x, y, z };
  }
  _check() {
    const { ds, x, y, z } = this[ST];
    assertBlockAccessible(ds, x, y, z);
    return this[ST];
  }
  get dimension() {
    return this[ST].ds.api;
  }
  get x() {
    return this[ST].x;
  }
  get y() {
    return this[ST].y;
  }
  get z() {
    return this[ST].z;
  }
  get location() {
    return { x: this[ST].x, y: this[ST].y, z: this[ST].z };
  }
  get permutation() {
    const { ds, x, y, z } = this._check();
    return getPerm(ds, x, y, z);
  }
  get type() {
    return this.permutation.type;
  }
  get typeId() {
    return this.permutation[ST].name;
  }
  get isAir() {
    return this.typeId === "minecraft:air";
  }
  get isLiquid() {
    return V.LIQUIDS.has(this.typeId);
  }
  isValid() {
    const { ds, x, y, z } = this[ST];
    return inHeight(ds, y) && chunkLoaded(ds, x, z);
  }
  setPermutation(permutation) {
    assertWritable("Block::setPermutation");
    if (!(permutation instanceof BlockPermutation)) throw new TypeError("setPermutation expects a BlockPermutation");
    const { ds, x, y, z } = this._check();
    setPermRaw(ds, x, y, z, permutation);
  }
  setType(blockType) {
    assertWritable("Block::setType");
    const id = typeof blockType === "string" ? blockType : blockType?.id;
    const perm = resolvePerm(id, {});
    const { ds, x, y, z } = this._check();
    setPermRaw(ds, x, y, z, perm);
  }
  _rel(dx, dy, dz) {
    const { ds, x, y, z } = this[ST];
    return ds.api.getBlock({ x: x + dx, y: y + dy, z: z + dz });
  }
  above(steps = 1) {
    return this._rel(0, steps, 0);
  }
  below(steps = 1) {
    return this._rel(0, -steps, 0);
  }
  north(steps = 1) {
    return this._rel(0, 0, -steps);
  }
  south(steps = 1) {
    return this._rel(0, 0, steps);
  }
  east(steps = 1) {
    return this._rel(steps, 0, 0);
  }
  west(steps = 1) {
    return this._rel(-steps, 0, 0);
  }
  offset(o) {
    return this._rel(o.x, o.y, o.z);
  }
  center() {
    return { x: this[ST].x + 0.5, y: this[ST].y + 0.5, z: this[ST].z + 0.5 };
  }
  bottomCenter() {
    return { x: this[ST].x + 0.5, y: this[ST].y, z: this[ST].z + 0.5 };
  }
  getComponent(componentId) {
    const id = V.normalizeId(componentId);
    const { ds, x, y, z } = this._check();
    if (id === "minecraft:inventory") {
      const c = ds.containers.get(bkey(x, y, z));
      if (!c) return undefined;
      return new BlockInventoryComponent(INTERNAL, this, c.state);
    }
    return undefined;
  }
  getItemStack(amount = 1) {
    const name = this.typeId;
    return V.isKnownItem(name) ? new ItemStack(name, amount) : undefined;
  }
  getTags() {
    this._check();
    return [];
  }
  hasTag() {
    this._check();
    return false;
  }
  matches(blockName, states) {
    return this.permutation.matches(blockName, states);
  }
}

export class Component {
  constructor(token) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
  }
}
export class BlockComponent extends Component {}
export class BlockInventoryComponent extends BlockComponent {
  static componentId = "minecraft:inventory";
  constructor(token, block, cs) {
    super(token);
    this[ST] = { block, cs };
  }
  get typeId() {
    return "minecraft:inventory";
  }
  get block() {
    return this[ST].block;
  }
  get container() {
    return new Container(INTERNAL, this[ST].cs);
  }
  isValid() {
    return this[ST].cs.valid;
  }
}

// --- raycast -----------------------------------------------------------------

const FACE_NAMES = {
  "+x": E.Direction.West,
  "-x": E.Direction.East,
  "+y": E.Direction.Down,
  "-y": E.Direction.Up,
  "+z": E.Direction.North,
  "-z": E.Direction.South,
};

function rayHittable(perm, opts) {
  const name = perm[ST].name;
  if (name === "minecraft:air") return false;
  if (V.LIQUIDS.has(name)) {
    if (!opts.includeLiquidBlocks) return false;
  } else if (V.isPassable(name) && !opts.includePassableBlocks) return false;
  if (opts.includeTypes && opts.includeTypes.length && !opts.includeTypes.map(V.normalizeId).includes(name)) return false;
  if (opts.excludeTypes && opts.excludeTypes.map(V.normalizeId).includes(name)) return false;
  if (opts.includePermutations && opts.includePermutations.length && !opts.includePermutations.some((p) => p === perm)) return false;
  if (opts.excludePermutations && opts.excludePermutations.some((p) => p === perm)) return false;
  if (opts.includeTags && opts.includeTags.length) return false; // mock has no block tags
  return true;
}

function raycast(ds, origin, direction, options = {}) {
  const L = Math.hypot(direction.x, direction.y, direction.z);
  if (!(L > 0)) throw new Error("getBlockFromRay: direction must be non-zero");
  const d = { x: direction.x / L, y: direction.y / L, z: direction.z / L };
  const maxD = options.maxDistance ?? S.options.defaultRayDistance;
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const step = { x: Math.sign(d.x), y: Math.sign(d.y), z: Math.sign(d.z) };
  const tDelta = {
    x: d.x !== 0 ? Math.abs(1 / d.x) : Infinity,
    y: d.y !== 0 ? Math.abs(1 / d.y) : Infinity,
    z: d.z !== 0 ? Math.abs(1 / d.z) : Infinity,
  };
  const tMax = {
    x: d.x > 0 ? (x + 1 - origin.x) / d.x : d.x < 0 ? (origin.x - x) / -d.x : Infinity,
    y: d.y > 0 ? (y + 1 - origin.y) / d.y : d.y < 0 ? (origin.y - y) / -d.y : Infinity,
    z: d.z > 0 ? (z + 1 - origin.z) / d.z : d.z < 0 ? (origin.z - z) / -d.z : Infinity,
  };
  // face for a hit in the start cell: the side the ray points away from
  const ad = { x: Math.abs(d.x), y: Math.abs(d.y), z: Math.abs(d.z) };
  const major = ad.x >= ad.y && ad.x >= ad.z ? "x" : ad.y >= ad.z ? "y" : "z";
  let face = FACE_NAMES[(d[major] >= 0 ? "+" : "-") + major];
  let t = 0;
  for (let guard = 0; guard < 100000; guard++) {
    if (t > maxD) return undefined;
    if (inHeight(ds, y)) {
      if (!chunkLoaded(ds, x, z)) return undefined;
      const perm = getPerm(ds, x, y, z);
      if (rayHittable(perm, options)) {
        const hit = { x: origin.x + d.x * t, y: origin.y + d.y * t, z: origin.z + d.z * t };
        return {
          block: new Block(INTERNAL, ds, x, y, z),
          face,
          faceLocation: { x: hit.x - x, y: hit.y - y, z: hit.z - z },
        };
      }
    } else if ((y < ds.min && step.y <= 0) || (y >= ds.max && step.y >= 0)) {
      return undefined; // left the world and not coming back
    }
    if (tMax.x <= tMax.y && tMax.x <= tMax.z) {
      x += step.x;
      t = tMax.x;
      tMax.x += tDelta.x;
      face = FACE_NAMES[(step.x > 0 ? "+" : "-") + "x"];
    } else if (tMax.y <= tMax.z) {
      y += step.y;
      t = tMax.y;
      tMax.y += tDelta.y;
      face = FACE_NAMES[(step.y > 0 ? "+" : "-") + "y"];
    } else {
      z += step.z;
      t = tMax.z;
      tMax.z += tDelta.z;
      face = FACE_NAMES[(step.z > 0 ? "+" : "-") + "z"];
    }
  }
  return undefined;
}

// --- commands ----------------------------------------------------------------

function defaultCommand(ds, command, source) {
  const parts = command.trim().replace(/^\//, "").split(/\s+/);
  if (parts[0] === "structure" && parts[1] === "load") {
    // Overloads (metadata/command_modules/mojang-commands.json, 1.21.0.26):
    //   structure load <name> <x y z> [rotation] [mirror] [includeEntities] [includeBlocks] [waterlogged] [integrity] [seed]
    //   structure load <name> <x y z> [rotation] [mirror] [animationMode] [animationSeconds] [includeEntities] [includeBlocks] [waterlogged] [integrity] [seed]
    const [, , name, xs, ys, zs, rot = "0_degrees", mirror = "none", ...rest] = parts;
    const base = source?.location ?? { x: 0, y: 0, z: 0 };
    const coord = (s, b) => (s && s.startsWith("~") ? b + (Number(s.slice(1)) || 0) : Number(s));
    const rotation = { "0_degrees": "None", "90_degrees": "Rotate90", "180_degrees": "Rotate180", "270_degrees": "Rotate270" }[rot];
    const mirrorAxis = { none: "None", x: "X", z: "Z", xz: "XZ" }[mirror];
    let animationMode = "None";
    let animationSeconds = 0;
    if (rest[0] === "layer_by_layer" || rest[0] === "block_by_block") {
      animationMode = rest[0] === "layer_by_layer" ? "Layers" : "Blocks";
      animationSeconds = rest[1] !== undefined ? Number(rest[1]) : 0;
      rest.splice(0, 2);
    }
    const [inclEnt, inclBlocks, waterlogged, integrity] = rest;
    const pos = { x: coord(xs, base.x), y: coord(ys, base.y), z: coord(zs, base.z) };
    if (!name || !rotation || !mirrorAxis || ![pos.x, pos.y, pos.z].every(Number.isFinite)) throw new CommandError(`Syntax error: ${command}`);
    for (const b of [inclEnt, inclBlocks, waterlogged]) if (b !== undefined && b !== "true" && b !== "false") throw new CommandError(`Syntax error: ${command}`);
    structureManager.place(name, ds.api, pos, {
      rotation,
      mirror: mirrorAxis,
      animationMode,
      animationSeconds,
      includeEntities: inclEnt !== "false",
      includeBlocks: inclBlocks !== "false",
      waterlogged: waterlogged === "true",
      integrity: integrity !== undefined ? Number(integrity) : 1,
    });
    return { successCount: 1 };
  }
  return { successCount: 0 };
}

function runCommandImpl(ds, command, source) {
  S.records.commands.push({ command, dimension: ds.id, source: source?.id, tick: S.tick });
  const res = S.commandHandler ? S.commandHandler(command, { dimension: ds.api, source }) : undefined;
  if (res === undefined) return new CommandResult(INTERNAL, defaultCommand(ds, command, source).successCount);
  return new CommandResult(INTERNAL, res.successCount ?? 0);
}

export class CommandResult {
  constructor(token, successCount) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this.successCount = successCount;
  }
}

export class Dimension {
  constructor(token, ds) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this[ST] = ds;
  }
  get id() {
    return this[ST].id;
  }
  get heightRange() {
    return { min: this[ST].min, max: this[ST].max };
  }
  getBlock(location) {
    const ds = this[ST];
    const p = floor3(location);
    if (!inHeight(ds, p.y)) throw new LocationOutOfWorldBoundariesError(`Location (${p.x}, ${p.y}, ${p.z}) is outside the height range of ${ds.id}`);
    if (!chunkLoaded(ds, p.x, p.z)) {
      if (S.options.unloadedGetBlock === "throw") throw new LocationInUnloadedChunkError(`Location (${p.x}, ${p.y}, ${p.z}) is in an unloaded chunk`);
      return undefined;
    }
    return new Block(INTERNAL, ds, p.x, p.y, p.z);
  }
  getBlockFromRay(location, direction, options) {
    return raycast(this[ST], location, direction, options || {});
  }
  getEntities(options) {
    return queryEntities(options, this[ST]);
  }
  getEntitiesAtBlockLocation(location) {
    const p = floor3(location);
    return queryEntities(undefined, this[ST]).filter((e) => {
      const l = e[ST].loc;
      return Math.floor(l.x) === p.x && Math.floor(l.y) === p.y && Math.floor(l.z) === p.z;
    });
  }
  getEntitiesFromRay(location, direction, options = {}) {
    const L = Math.hypot(direction.x, direction.y, direction.z) || 1;
    const d = { x: direction.x / L, y: direction.y / L, z: direction.z / L };
    const maxD = options.maxDistance ?? S.options.defaultRayDistance;
    const out = [];
    for (const e of queryEntities(options, this[ST])) {
      const c = e[ST].loc;
      const v = { x: c.x - location.x, y: c.y + 0.9 - location.y, z: c.z - location.z };
      const t = v.x * d.x + v.y * d.y + v.z * d.z;
      if (t < 0 || t > maxD) continue;
      const perp = distSq(v, { x: d.x * t, y: d.y * t, z: d.z * t });
      if (perp <= 0.8 * 0.8) out.push({ entity: e, distance: t });
    }
    return out.sort((a, b) => a.distance - b.distance);
  }
  getPlayers(options) {
    return queryEntities(options, this[ST]).filter((e) => e instanceof Player);
  }
  spawnEntity(identifier, location) {
    assertWritable("Dimension::spawnEntity");
    return spawnEntityImpl(this[ST], identifier, location, "Spawned");
  }
  spawnItem(itemStack, location) {
    assertWritable("Dimension::spawnItem");
    const ent = spawnEntityImpl(this[ST], "minecraft:item", location, "Spawned", { item: itemStack.clone() });
    return ent;
  }
  spawnParticle(effectName, location, molangVariables) {
    assertWritable("Dimension::spawnParticle");
    const ds = this[ST];
    const p = floor3(location);
    assertBlockAccessible(ds, p.x, p.y, p.z);
    S.records.particles.push({ id: effectName, dimension: ds.id, location: copyVec(location), molang: molangVariables?.[ST], tick: S.tick });
  }
  playSound(soundId, location, soundOptions) {
    assertWritable("Dimension::playSound");
    if (soundOptions?.volume !== undefined && soundOptions.volume < 0) throw new RangeError("volume < 0");
    if (soundOptions?.pitch !== undefined && soundOptions.pitch < 0.01) throw new RangeError("pitch < 0.01");
    S.records.sounds.push({ kind: "dimension", id: soundId, dimension: this[ST].id, location: copyVec(location), options: soundOptions ? { ...soundOptions } : undefined, tick: S.tick });
  }
  runCommand(commandString) {
    assertWritable("Dimension::runCommand");
    return runCommandImpl(this[ST], commandString, undefined);
  }
  runCommandAsync(commandString) {
    try {
      return Promise.resolve(runCommandImpl(this[ST], commandString, undefined));
    } catch (e) {
      return Promise.reject(e);
    }
  }
  createExplosion(location, radius, options) {
    assertWritable("Dimension::createExplosion");
    S.records.explosions.push({ dimension: this[ST].id, location: copyVec(location), radius, options, tick: S.tick });
    return true;
  }
  setWeather(weatherType, duration) {
    assertWritable("Dimension::setWeather");
    S.weather = { weatherType, duration };
  }
}

export class DimensionType {
  constructor(token, typeId) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this.typeId = typeId;
  }
}
export class DimensionTypes {
  static get(id) {
    const n = V.normalizeId(id);
    return DIM_DEFS.some((d) => d.id === n) ? new DimensionType(INTERNAL, n) : undefined;
  }
  static getAll() {
    return DIM_DEFS.map((d) => new DimensionType(INTERNAL, d.id));
  }
}

// ===========================================================================
// Entities
// ===========================================================================

const VILLAGERISH = /^minecraft:(villager|villager_v2|wandering_trader|player|zombie|husk|drowned|zombie_villager.*|pillager|vindicator|evocation_illager|witch)$/;
function defaultHeadHeight(typeId) {
  if (typeId === "minecraft:player") return 1.62;
  if (VILLAGERISH.test(typeId) || typeId === "pas:infected_villager" || typeId === "pas:infected_human") return 1.62;
  if (typeId === "minecraft:chicken" || typeId === "pas:infected_chicken") return 0.6;
  if (typeId === "pas:parasite") return 0.35;
  return 1.0;
}

function healthFromComponents(comps) {
  const h = comps["minecraft:health"];
  if (!h) return undefined;
  const pick = (v) => (typeof v === "number" ? v : v && typeof v === "object" ? v.range_max ?? v.range_min ?? v.max ?? v.value : undefined);
  const value = pick(h.value);
  const max = h.max !== undefined ? pick(h.max) : value;
  return { value: value ?? max ?? 20, max: max ?? value ?? 20 };
}

function recomputeComponents(st) {
  const def = st.def;
  const comps = { ...(def?.components || {}) };
  for (const g of st.groups) Object.assign(comps, def?.groups?.[g] || {});
  st.comps = comps;
  const h = healthFromComponents(comps);
  if (h && st.health.max !== h.max) {
    st.health.max = h.max;
    if (st.health.cur > h.max) st.health.cur = h.max;
  }
}

function familiesOf(st) {
  if (st.familyOverride) return [...st.familyOverride];
  const tf = st.comps["minecraft:type_family"];
  return tf && Array.isArray(tf.family) ? [...tf.family] : [];
}

function newEntityState(typeId, ds, loc, extra = {}) {
  const id = String(extra.id ?? S.nextEntityId++);
  const def = V.entityDef(typeId);
  const st = {
    id,
    typeId,
    def,
    ds,
    loc: { ...loc },
    rot: { x: 0, y: 0 },
    nameTag: "",
    tags: new Set(),
    props: new Map(),
    health: { cur: 20, max: 20 },
    groups: [],
    comps: {},
    overrides: new Map(),
    effects: new Map(),
    removed: false,
    dead: false,
    removeAtTick: Infinity,
    isSneaking: false,
    velocity: { x: 0, y: 0, z: 0 },
    isPlayer: typeId === "minecraft:player",
    item: extra.item,
    headLocation: undefined,
    viewDirection: undefined,
    familyOverride: undefined,
  };
  recomputeComponents(st);
  const h = healthFromComponents(st.comps);
  if (h) st.health = { cur: h.value, max: h.max };
  else if (typeId === "minecraft:item") st.health = { cur: 5, max: 5 };
  const invDef = st.comps["minecraft:inventory"];
  if (invDef && typeId !== "minecraft:player") st.inventory = new ContainerState(Math.max(1, invDef.inventory_size ?? 5));
  return st;
}

function entityChunkLoaded(st) {
  if (st.isPlayer) return true;
  return chunkLoaded(st.ds, st.loc.x, st.loc.z);
}

function entityValid(st) {
  return !st.removed && !st.offline && entityChunkLoaded(st);
}

function assertEntityValid(ent, fn) {
  if (!entityValid(ent[ST])) throw new Error(`Failed to call function '${fn}' on an invalid entity (${ent[ST].typeId} #${ent[ST].id})`);
}

// --- filters (entity JSON filters + EntityQueryOptions) --------------------------

function compareOp(a, op = "==", b) {
  switch (op) {
    case "==":
    case "=":
    case "equals":
      return a === b;
    case "!=":
    case "<>":
    case "not":
      return a !== b;
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    default:
      warn(`mock: unsupported filter operator '${op}'`);
      return false;
  }
}

function componentValue(st, id) {
  if (st.overrides.has(id)) return st.overrides.get(id);
  const c = st.comps[id];
  if (c === undefined) return undefined;
  return typeof c === "object" && c !== null && "value" in c ? c.value : true;
}

function evalFilter(f, ctx) {
  if (!f) return true;
  if (Array.isArray(f)) return f.every((x) => evalFilter(x, ctx));
  if (f.all_of) return [].concat(f.all_of).every((x) => evalFilter(x, ctx));
  if (f.any_of) return [].concat(f.any_of).some((x) => evalFilter(x, ctx));
  if (f.none_of) return ![].concat(f.none_of).some((x) => evalFilter(x, ctx));
  if (!f.test) return true;
  const subj = f.subject ?? "self";
  const st = subj === "self" ? ctx.self : subj === "other" ? ctx.other : subj === "target" ? ctx.target ?? ctx.other : undefined;
  const op = f.operator ?? "==";
  if (!st) return op === "!=" || op === "not" || op === "<>";
  switch (f.test) {
    case "has_tag":
      return compareOp(st.tags.has(f.value), op, true);
    case "is_family":
      return compareOp(familiesOf(st).includes(f.value), op, true);
    case "has_component":
      return compareOp(componentValue(st, V.normalizeId(f.value)) !== undefined && componentValue(st, V.normalizeId(f.value)) !== false, op, true);
    case "is_variant":
      return compareOp(componentValue(st, "minecraft:variant") ?? 0, op, f.value);
    case "is_mark_variant":
      return compareOp(componentValue(st, "minecraft:mark_variant") ?? 0, op, f.value);
    case "is_skin_id":
      return compareOp(componentValue(st, "minecraft:skin_id") ?? 0, op, f.value);
    case "is_color":
      return compareOp(componentValue(st, "minecraft:color") ?? 0, op, f.value);
    case "is_baby":
      return compareOp(componentValue(st, "minecraft:is_baby") !== undefined && componentValue(st, "minecraft:is_baby") !== false, op, f.value ?? true);
    case "is_game_mode":
      return compareOp(st.gameMode, op, f.value);
    default:
      warn(`mock: unsupported filter test '${f.test}' (treated as false)`);
      return false;
  }
}

function queryMatches(st, o) {
  if (!o) return true;
  const fam = () => familiesOf(st);
  if (o.type !== undefined && V.normalizeId(o.type) !== st.typeId) return false;
  if (o.excludeTypes && o.excludeTypes.map(V.normalizeId).includes(st.typeId)) return false;
  if (o.families && !o.families.every((f) => fam().includes(f))) return false;
  if (o.excludeFamilies && o.excludeFamilies.some((f) => fam().includes(f))) return false;
  if (o.tags && !o.tags.every((t) => st.tags.has(t))) return false;
  if (o.excludeTags && o.excludeTags.some((t) => st.tags.has(t))) return false;
  const nm = st.isPlayer ? st.name : st.nameTag;
  if (o.name !== undefined && nm !== o.name) return false;
  if (o.excludeNames && o.excludeNames.includes(nm)) return false;
  if (o.gameMode !== undefined && (!st.isPlayer || st.gameMode !== o.gameMode)) return false;
  if (o.excludeGameModes && st.isPlayer && o.excludeGameModes.includes(st.gameMode)) return false;
  if (o.minLevel !== undefined && (!st.isPlayer || (st.level ?? 0) < o.minLevel)) return false;
  if (o.maxLevel !== undefined && (!st.isPlayer || (st.level ?? 0) > o.maxLevel)) return false;
  if (o.minHorizontalRotation !== undefined && st.rot.y < o.minHorizontalRotation) return false;
  if (o.maxHorizontalRotation !== undefined && st.rot.y > o.maxHorizontalRotation) return false;
  if (o.minVerticalRotation !== undefined && st.rot.x < o.minVerticalRotation) return false;
  if (o.maxVerticalRotation !== undefined && st.rot.x > o.maxVerticalRotation) return false;
  if (o.scoreOptions) throw new Error("mock: EntityQueryOptions.scoreOptions is not supported (scoreboard not mocked)");
  if (o.maxDistance !== undefined || o.minDistance !== undefined || o.volume !== undefined) {
    if (!o.location) throw new Error("mock: maxDistance/minDistance/volume require EntityQueryOptions.location");
  }
  if (o.location) {
    const d2 = distSq(st.loc, o.location);
    if (o.maxDistance !== undefined && d2 > o.maxDistance * o.maxDistance) return false;
    if (o.minDistance !== undefined && d2 < o.minDistance * o.minDistance) return false;
    if (o.volume) {
      const lo = { x: Math.min(o.location.x, o.location.x + o.volume.x), y: Math.min(o.location.y, o.location.y + o.volume.y), z: Math.min(o.location.z, o.location.z + o.volume.z) };
      const hi = { x: Math.max(o.location.x, o.location.x + o.volume.x) + 1, y: Math.max(o.location.y, o.location.y + o.volume.y) + 1, z: Math.max(o.location.z, o.location.z + o.volume.z) + 1 };
      const l = st.loc;
      if (l.x < lo.x || l.x >= hi.x || l.y < lo.y || l.y >= hi.y || l.z < lo.z || l.z >= hi.z) return false;
    }
  }
  return true;
}

function queryEntities(options, ds) {
  const o = options || {};
  if (o.closest !== undefined && !(o.closest > 0)) throw new Error("EntityQueryOptions.closest must be > 0");
  if (o.farthest !== undefined && !(o.farthest > 0)) throw new Error("EntityQueryOptions.farthest must be > 0");
  if ((o.closest !== undefined || o.farthest !== undefined) && !o.location) throw new Error("mock: closest/farthest require location");
  let out = [];
  for (const ent of S.entities.values()) {
    const st = ent[ST];
    if (ds && st.ds !== ds) continue;
    if (!entityValid(st)) continue;
    if (st.typeId === "minecraft:item" && o.type === undefined && !o.families) {
      // items are entities too; keep them (the game returns them as well)
    }
    if (!queryMatches(st, o)) continue;
    out.push(ent);
  }
  if (o.location) {
    out.sort((a, b) => distSq(a[ST].loc, o.location) - distSq(b[ST].loc, o.location));
    if (o.closest !== undefined) out = out.slice(0, o.closest);
    else if (o.farthest !== undefined) out = out.reverse().slice(0, o.farthest);
  }
  return out;
}

// --- entity events / component groups --------------------------------------------

function addGroup(st, g) {
  if (!st.def?.groups?.[g]) warn(`mock: ${st.typeId} event adds unknown component group '${g}'`);
  st.groups = st.groups.filter((x) => x !== g);
  st.groups.push(g);
}
function removeGroup(st, g) {
  st.groups = st.groups.filter((x) => x !== g);
}

function applyEventDef(ent, evDef, depth, mods) {
  const st = ent[ST];
  if (!evDef || depth > 16) return;
  if (evDef.filters && !evalFilter(evDef.filters, { self: st })) return;
  if (Array.isArray(evDef.sequence)) for (const e of evDef.sequence) applyEventDef(ent, e, depth + 1, mods);
  if (Array.isArray(evDef.randomize) && evDef.randomize.length) {
    const total = evDef.randomize.reduce((a, e) => a + (e.weight ?? 1), 0);
    let r = S.rng() * total;
    let pick = evDef.randomize[evDef.randomize.length - 1];
    for (const e of evDef.randomize) {
      r -= e.weight ?? 1;
      if (r < 0) {
        pick = e;
        break;
      }
    }
    applyEventDef(ent, pick, depth + 1, mods);
  }
  for (const g of evDef.remove?.component_groups || []) {
    removeGroup(st, g);
    mods.removed.push(g);
  }
  for (const g of evDef.add?.component_groups || []) {
    addGroup(st, g);
    mods.added.push(g);
  }
  recomputeComponents(st);
  if (evDef.trigger) {
    const t = typeof evDef.trigger === "string" ? { event: evDef.trigger, target: "self" } : evDef.trigger;
    if ((t.target ?? "self") === "self" && t.event) runEntityEvent(ent, t.event, depth + 1, false);
  }
  if (evDef.queue_command) S.records.commands.push({ command: evDef.queue_command.command, source: st.id, tick: S.tick, queued: true });
}

function runEntityEvent(ent, eventName, depth = 0, strict = true) {
  const st = ent[ST];
  const def = st.def;
  const evDef = def?.events?.[eventName];
  if (!evDef) {
    if (strict && def && S.options.strictTriggerEvent) {
      throw new Error(`Entity event '${eventName}' is not defined for ${st.typeId} (${def.source} definition)`);
    }
    if (!strict) warn(`mock: ${st.typeId} triggers undefined event '${eventName}'`);
    return { added: [], removed: [] };
  }
  const mods = { added: [], removed: [] };
  applyEventDef(ent, evDef, depth, mods);
  return mods;
}

function spawnEntityImpl(ds, identifier, location, cause, extra = {}) {
  if (typeof identifier !== "string" || !identifier) throw new TypeError("spawnEntity: identifier must be a string");
  const m = /^([^<]+)(?:<([^>]+)>)?$/.exec(identifier.trim());
  if (!m) throw new Error(`Invalid entity identifier '${identifier}'`);
  const typeId = V.normalizeId(m[1]);
  const spawnEvent = m[2];
  if (typeId === "minecraft:player") throw new Error("Cannot spawn a player");
  if (typeId !== "minecraft:item" && !V.isKnownEntityType(typeId)) throw new Error(`Invalid entity identifier '${identifier}' (unknown entity type)`);
  const p = floor3(location);
  if (!inHeight(ds, p.y)) throw new LocationOutOfWorldBoundariesError(`Cannot spawn '${typeId}' outside the height range at (${p.x}, ${p.y}, ${p.z})`);
  if (!chunkLoaded(ds, p.x, p.z)) throw new LocationInUnloadedChunkError(`Cannot spawn '${typeId}' in an unloaded chunk at (${p.x}, ${p.y}, ${p.z})`);
  const st = newEntityState(typeId, ds, copyVec(location), extra);
  const ent = new Entity(INTERNAL, st);
  S.entities.set(st.id, ent);
  const runEvents = st.def && (st.def.source !== "vanilla" || S.options.runVanillaSpawnEvents || spawnEvent);
  if (runEvents) {
    // A spawn event given as "type<event>" replaces minecraft:entity_spawned (like /summon).
    const evName = spawnEvent ?? "minecraft:entity_spawned";
    if (st.def.events?.[evName]) runEntityEvent(ent, evName, 0, false);
    else if (spawnEvent) throw new Error(`Spawn event '${spawnEvent}' is not defined for ${typeId}`);
  }
  S.records.spawned.push({ id: st.id, typeId, dimension: ds.id, location: copyVec(location), event: spawnEvent, tick: S.tick });
  queueAfter("entitySpawn", { entity: ent, cause });
  return ent;
}

function killImpl(ent, damageSource) {
  const st = ent[ST];
  if (st.dead) return;
  st.dead = true;
  st.health.cur = 0;
  st.removeAtTick = S.tick + Math.max(0, S.options.deathRemovalTicks);
  queueAfter("entityDie", { deadEntity: ent, damageSource });
}

function removeEntityInternal(ent, fireBefore = true) {
  const st = ent[ST];
  if (st.removed) return;
  if (fireBefore) deliver(beforeEvents.entityRemove, { removedEntity: ent });
  st.removed = true;
  S.entities.delete(st.id);
  queueAfter("entityRemove", { removedEntityId: st.id, typeId: st.typeId });
}

function damageSensorCancels(st, cause, damager) {
  const ds = st.comps["minecraft:damage_sensor"];
  if (!ds) return false;
  const triggers = Array.isArray(ds.triggers) ? ds.triggers : ds.triggers ? [ds.triggers] : [];
  for (const t of triggers) {
    if (t.cause && t.cause !== "all" && t.cause !== cause && !(t.cause === "entity_attack" && cause === "entityAttack")) continue;
    const filters = t.on_damage?.filters;
    if (filters && !evalFilter(filters, { self: st, other: damager?.[ST] })) continue;
    if (t.deals_damage === false || t.deals_damage === "no") return true;
    return false;
  }
  return false;
}

export class EntityType {
  constructor(token, id) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this.id = id;
  }
}
export class EntityTypes {
  static get(identifier) {
    const id = V.normalizeId(identifier);
    return V.isKnownEntityType(id) ? new EntityType(INTERNAL, id) : undefined;
  }
  static getAll() {
    return [...V.vanillaEntityIds().ids].map((id) => new EntityType(INTERNAL, id));
  }
}

export class Effect {
  constructor(token, st, key) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this[ST] = { st, key };
  }
  _e() {
    const e = this[ST].st.effects.get(this[ST].key);
    if (!e) throw new Error("Effect is no longer valid");
    return e;
  }
  get typeId() {
    return this[ST].key;
  }
  get amplifier() {
    return this._e().amplifier;
  }
  get duration() {
    return this._e().duration;
  }
  get displayName() {
    const k = this[ST].key;
    return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  isValid() {
    return this[ST].st.effects.has(this[ST].key);
  }
}
export class EffectType {
  constructor(token, id) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this[ST] = id;
  }
  getName() {
    return this[ST];
  }
}
export class EffectTypes {
  static get(identifier) {
    const n = String(identifier).replace(/^minecraft:/, "");
    const v = V.vanillaEffects();
    return !v.available || v.effects.has(n) ? new EffectType(INTERNAL, n) : undefined;
  }
  static getAll() {
    return [...V.vanillaEffects().effects].map((n) => new EffectType(INTERNAL, n));
  }
}

function effectKey(effectType) {
  const raw = effectType instanceof EffectType ? effectType[ST] : String(effectType);
  return raw.replace(/^minecraft:/, "");
}

// --- entity components -------------------------------------------------------------

export class EntityComponent extends Component {
  constructor(token, ent, typeId) {
    super(token);
    this[ST] = { ent, typeId };
  }
  get typeId() {
    return this[ST].typeId;
  }
  get entity() {
    return this[ST].ent;
  }
  isValid() {
    return entityValid(this[ST].ent[ST]);
  }
}

export class EntityAttributeComponent extends EntityComponent {
  get currentValue() {
    return this[ST].ent[ST].health.cur;
  }
  get defaultValue() {
    return this[ST].ent[ST].health.max;
  }
  get effectiveMax() {
    return this[ST].ent[ST].health.max;
  }
  get effectiveMin() {
    return 0;
  }
  setCurrentValue(value) {
    assertWritable("EntityAttributeComponent::setCurrentValue");
    const ent = this[ST].ent;
    assertEntityValid(ent, "setCurrentValue");
    const st = ent[ST];
    const old = st.health.cur;
    st.health.cur = Math.max(0, Math.min(st.health.max, value));
    if (old !== st.health.cur) queueAfter("entityHealthChanged", { entity: ent, oldValue: old, newValue: st.health.cur });
    if (st.health.cur <= 0 && !st.dead) killImpl(ent, { cause: E.EntityDamageCause.none });
    return true;
  }
  resetToDefaultValue() {
    this.setCurrentValue(this.defaultValue);
  }
  resetToMaxValue() {
    this.setCurrentValue(this.effectiveMax);
  }
  resetToMinValue() {
    this.setCurrentValue(0);
  }
}
export class EntityHealthComponent extends EntityAttributeComponent {
  static componentId = "minecraft:health";
}

export class EntityTypeFamilyComponent extends EntityComponent {
  static componentId = "minecraft:type_family";
  getTypeFamilies() {
    return familiesOf(this[ST].ent[ST]);
  }
  hasTypeFamily(f) {
    return familiesOf(this[ST].ent[ST]).includes(f);
  }
}

class ValueComponent extends EntityComponent {
  get value() {
    return componentValue(this[ST].ent[ST], this[ST].typeId);
  }
  set value(v) {
    this[ST].ent[ST].overrides.set(this[ST].typeId, v);
  }
}
export class EntityVariantComponent extends ValueComponent {
  static componentId = "minecraft:variant";
}
export class EntityMarkVariantComponent extends ValueComponent {
  static componentId = "minecraft:mark_variant";
}
export class EntitySkinIdComponent extends ValueComponent {
  static componentId = "minecraft:skin_id";
}
export class EntityColorComponent extends ValueComponent {
  static componentId = "minecraft:color";
}
export class EntityScaleComponent extends ValueComponent {
  static componentId = "minecraft:scale";
}
export class EntityIsBabyComponent extends EntityComponent {
  static componentId = "minecraft:is_baby";
}
export class EntityIsShearedComponent extends EntityComponent {
  static componentId = "minecraft:is_sheared";
}
export class EntityIsTamedComponent extends EntityComponent {
  static componentId = "minecraft:is_tamed";
}
export class EntityInventoryComponent extends EntityComponent {
  static componentId = "minecraft:inventory";
  get container() {
    return new Container(INTERNAL, this[ST].ent[ST].inventory);
  }
  get inventorySize() {
    return this[ST].ent[ST].inventory.size;
  }
  get containerType() {
    return this[ST].ent[ST].isPlayer ? "inventory" : "container";
  }
  get additionalSlotsPerStrength() {
    return 0;
  }
  get canBeSiphonedFrom() {
    return false;
  }
  get private() {
    return false;
  }
  get restrictToOwner() {
    return false;
  }
}
export class EntityItemComponent extends EntityComponent {
  static componentId = "minecraft:item";
  get itemStack() {
    return this[ST].ent[ST].item.clone();
  }
}

// Non-mainhand equipment lives in a 5-slot container on the player state.
const EQUIP_INDEX = { Offhand: 0, Head: 1, Chest: 2, Legs: 3, Feet: 4 };

export class EntityEquippableComponent extends EntityComponent {
  static componentId = "minecraft:equippable";
  getEquipment(equipmentSlot) {
    const st = this[ST].ent[ST];
    assertEntityValid(this[ST].ent, "getEquipment");
    if (equipmentSlot === E.EquipmentSlot.Mainhand) return st.inventory.slots[st.selectedSlot]?.clone();
    if (equipmentSlot in EQUIP_INDEX) return st.equipment.slots[EQUIP_INDEX[equipmentSlot]]?.clone();
    throw new TypeError(`Invalid equipment slot '${equipmentSlot}'`);
  }
  setEquipment(equipmentSlot, itemStack) {
    assertWritable("EntityEquippableComponent::setEquipment");
    const st = this[ST].ent[ST];
    assertEntityValid(this[ST].ent, "setEquipment");
    const v = itemStack ? itemStack.clone() : undefined;
    if (equipmentSlot === E.EquipmentSlot.Mainhand) st.inventory.slots[st.selectedSlot] = v;
    else if (equipmentSlot in EQUIP_INDEX) st.equipment.slots[EQUIP_INDEX[equipmentSlot]] = v;
    else throw new TypeError(`Invalid equipment slot '${equipmentSlot}'`);
    return true;
  }
  getEquipmentSlot(equipmentSlot) {
    const st = this[ST].ent[ST];
    if (equipmentSlot === E.EquipmentSlot.Mainhand) return new ContainerSlot(INTERNAL, st.inventory, st.selectedSlot);
    if (equipmentSlot in EQUIP_INDEX) return new ContainerSlot(INTERNAL, st.equipment, EQUIP_INDEX[equipmentSlot]);
    throw new TypeError(`Invalid equipment slot '${equipmentSlot}'`);
  }
}

const VALUE_COMPONENTS = {
  "minecraft:variant": EntityVariantComponent,
  "minecraft:mark_variant": EntityMarkVariantComponent,
  "minecraft:skin_id": EntitySkinIdComponent,
  "minecraft:color": EntityColorComponent,
  "minecraft:scale": EntityScaleComponent,
};
const FLAG_COMPONENTS = {
  "minecraft:is_baby": EntityIsBabyComponent,
  "minecraft:is_sheared": EntityIsShearedComponent,
  "minecraft:is_tamed": EntityIsTamedComponent,
};

function getEntityComponent(ent, componentId) {
  const st = ent[ST];
  const id = V.normalizeId(componentId);
  if (id === "minecraft:health") {
    if (st.typeId === "minecraft:item") return undefined;
    return new EntityHealthComponent(INTERNAL, ent, id);
  }
  if (id === "minecraft:type_family") return familiesOf(st).length ? new EntityTypeFamilyComponent(INTERNAL, ent, id) : undefined;
  if (id === "minecraft:inventory") return st.inventory ? new EntityInventoryComponent(INTERNAL, ent, id) : undefined;
  if (id === "minecraft:equippable") return st.isPlayer ? new EntityEquippableComponent(INTERNAL, ent, id) : undefined;
  if (id === "minecraft:item") return st.item ? new EntityItemComponent(INTERNAL, ent, id) : undefined;
  if (VALUE_COMPONENTS[id]) {
    const v = componentValue(st, id);
    return v === undefined || v === null ? undefined : new VALUE_COMPONENTS[id](INTERNAL, ent, id);
  }
  if (FLAG_COMPONENTS[id]) {
    const v = componentValue(st, id);
    return v === undefined || v === false || v === null ? undefined : new FLAG_COMPONENTS[id](INTERNAL, ent, id);
  }
  if (st.overrides.has(id) || id in st.comps) return new EntityComponent(INTERNAL, ent, id);
  return undefined;
}

// --- Entity ------------------------------------------------------------------------

export class Entity {
  constructor(token, st) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this[ST] = st;
  }
  get id() {
    return this[ST].id;
  }
  get typeId() {
    return this[ST].typeId;
  }
  get dimension() {
    assertEntityValid(this, "dimension");
    return this[ST].ds.api;
  }
  get location() {
    assertEntityValid(this, "location");
    return copyVec(this[ST].loc);
  }
  get nameTag() {
    return this[ST].nameTag;
  }
  set nameTag(v) {
    this[ST].nameTag = String(v ?? "");
  }
  get isSneaking() {
    return this[ST].isSneaking;
  }
  set isSneaking(v) {
    this[ST].isSneaking = !!v;
  }
  get isClimbing() {
    return false;
  }
  get isFalling() {
    return false;
  }
  get isInWater() {
    return false;
  }
  get isOnGround() {
    return true;
  }
  get isSleeping() {
    return false;
  }
  get isSprinting() {
    return false;
  }
  get isSwimming() {
    return false;
  }
  get scoreboardIdentity() {
    return undefined;
  }
  isValid() {
    return entityValid(this[ST]);
  }
  addEffect(effectType, duration, options = {}) {
    assertWritable("Entity::addEffect");
    assertEntityValid(this, "addEffect");
    const key = effectKey(effectType);
    const v = V.vanillaEffects();
    if (v.available && !v.effects.has(key)) throw new Error(`Invalid effect type '${effectType}'`);
    if (!Number.isInteger(duration) || duration < 1 || duration > 20000000) throw new RangeError(`Invalid effect duration ${duration}`);
    const amplifier = options.amplifier ?? 0;
    if (!Number.isInteger(amplifier) || amplifier < 0 || amplifier > 255) throw new RangeError(`Invalid amplifier ${amplifier}`);
    this[ST].effects.set(key, { duration, amplifier, showParticles: options.showParticles ?? true });
    queueAfter("effectAdd", { entity: this, effect: new Effect(INTERNAL, this[ST], key) });
  }
  getEffect(effectType) {
    assertEntityValid(this, "getEffect");
    const key = effectKey(effectType);
    return this[ST].effects.has(key) ? new Effect(INTERNAL, this[ST], key) : undefined;
  }
  getEffects() {
    assertEntityValid(this, "getEffects");
    return [...this[ST].effects.keys()].map((k) => new Effect(INTERNAL, this[ST], k));
  }
  removeEffect(effectType) {
    assertWritable("Entity::removeEffect");
    assertEntityValid(this, "removeEffect");
    return this[ST].effects.delete(effectKey(effectType));
  }
  addTag(tag) {
    assertWritable("Entity::addTag");
    assertEntityValid(this, "addTag");
    if (typeof tag !== "string" || !tag) throw new TypeError("addTag: tag must be a non-empty string");
    if (this[ST].tags.has(tag)) return false;
    this[ST].tags.add(tag);
    return true;
  }
  removeTag(tag) {
    assertWritable("Entity::removeTag");
    assertEntityValid(this, "removeTag");
    return this[ST].tags.delete(tag);
  }
  hasTag(tag) {
    assertEntityValid(this, "hasTag");
    return this[ST].tags.has(tag);
  }
  getTags() {
    assertEntityValid(this, "getTags");
    return [...this[ST].tags];
  }
  applyDamage(amount, options) {
    assertWritable("Entity::applyDamage");
    assertEntityValid(this, "applyDamage");
    const st = this[ST];
    if (st.dead || !(amount > 0)) return false;
    if (st.isPlayer && (st.gameMode === E.GameMode.creative || st.gameMode === E.GameMode.spectator)) return false;
    const damagingEntity = options?.damagingEntity;
    const damagingProjectile = options?.damagingProjectile;
    const cause = options?.cause ?? (damagingProjectile ? E.EntityDamageCause.projectile : E.EntityDamageCause.none);
    if (damageSensorCancels(st, cause, damagingEntity)) return false;
    const old = st.health.cur;
    st.health.cur = Math.max(0, old - amount);
    /** @type {any} */
    const damageSource = { cause };
    if (damagingEntity) damageSource.damagingEntity = damagingEntity;
    if (damagingProjectile) damageSource.damagingProjectile = damagingProjectile;
    queueAfter("entityHurt", { hurtEntity: this, damage: amount, damageSource });
    queueAfter("entityHealthChanged", { entity: this, oldValue: old, newValue: st.health.cur });
    if (st.health.cur <= 0) killImpl(this, damageSource);
    return true;
  }
  applyImpulse(v) {
    assertWritable("Entity::applyImpulse");
    assertEntityValid(this, "applyImpulse");
    const s = this[ST].velocity;
    s.x += v.x;
    s.y += v.y;
    s.z += v.z;
  }
  applyKnockback() {
    assertWritable("Entity::applyKnockback");
    assertEntityValid(this, "applyKnockback");
  }
  clearVelocity() {
    assertWritable("Entity::clearVelocity");
    this[ST].velocity = { x: 0, y: 0, z: 0 };
  }
  getVelocity() {
    return copyVec(this[ST].velocity);
  }
  extinguishFire() {
    assertWritable("Entity::extinguishFire");
    return true;
  }
  setOnFire() {
    assertWritable("Entity::setOnFire");
    return true;
  }
  getBlockFromViewDirection(options) {
    assertEntityValid(this, "getBlockFromViewDirection");
    return raycast(this[ST].ds, this.getHeadLocation(), this.getViewDirection(), options || {});
  }
  getEntitiesFromViewDirection(options) {
    return this[ST].ds.api.getEntitiesFromRay(this.getHeadLocation(), this.getViewDirection(), options).filter((h) => h.entity !== this);
  }
  getComponent(componentId) {
    if (!entityValid(this[ST])) return undefined;
    return getEntityComponent(this, componentId);
  }
  getComponents() {
    const ids = new Set([
      "minecraft:health",
      "minecraft:type_family",
      "minecraft:inventory",
      "minecraft:equippable",
      "minecraft:item",
      ...Object.keys(this[ST].comps),
      ...this[ST].overrides.keys(),
    ]);
    return [...ids].map((id) => getEntityComponent(this, id)).filter(Boolean);
  }
  hasComponent(componentId) {
    return !!this.getComponent(componentId);
  }
  getDynamicProperty(identifier) {
    return cloneDynValue(this[ST].props.get(identifier));
  }
  setDynamicProperty(identifier, value) {
    assertEntityValid(this, "setDynamicProperty");
    const v = checkDynamicValue(identifier, value);
    if (v === undefined) this[ST].props.delete(identifier);
    else this[ST].props.set(identifier, v);
  }
  getDynamicPropertyIds() {
    return [...this[ST].props.keys()];
  }
  getDynamicPropertyTotalByteCount() {
    return dynPropBytes(this[ST].props);
  }
  clearDynamicProperties() {
    this[ST].props.clear();
  }
  getHeadLocation() {
    assertEntityValid(this, "getHeadLocation");
    const st = this[ST];
    if (st.headLocation) return copyVec(st.headLocation);
    return { x: st.loc.x, y: st.loc.y + defaultHeadHeight(st.typeId), z: st.loc.z };
  }
  getViewDirection() {
    assertEntityValid(this, "getViewDirection");
    const st = this[ST];
    if (st.viewDirection) return copyVec(st.viewDirection);
    const yaw = (st.rot.y * Math.PI) / 180;
    const pitch = (st.rot.x * Math.PI) / 180;
    return { x: -Math.sin(yaw) * Math.cos(pitch), y: -Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
  }
  getRotation() {
    assertEntityValid(this, "getRotation");
    return { x: this[ST].rot.x, y: this[ST].rot.y };
  }
  setRotation(rotation) {
    assertWritable("Entity::setRotation");
    assertEntityValid(this, "setRotation");
    this[ST].rot = { x: rotation.x, y: rotation.y };
  }
  getProperty() {
    return undefined;
  }
  setProperty(identifier) {
    assertWritable("Entity::setProperty");
    throw new Error(`mock: entity property '${identifier}' is not defined`);
  }
  resetProperty(identifier) {
    assertWritable("Entity::resetProperty");
    throw new Error(`mock: entity property '${identifier}' is not defined`);
  }
  kill() {
    assertWritable("Entity::kill");
    assertEntityValid(this, "kill");
    if (this[ST].dead) return false;
    killImpl(this, { cause: E.EntityDamageCause.override });
    return true;
  }
  remove() {
    assertWritable("Entity::remove");
    assertEntityValid(this, "remove");
    if (this[ST].isPlayer) throw new Error("Players cannot be removed");
    removeEntityInternal(this, true);
  }
  matches(options) {
    return entityValid(this[ST]) && queryMatches(this[ST], options);
  }
  playAnimation(animationName, options) {
    assertWritable("Entity::playAnimation");
    S.records.commands.push({ animation: animationName, options, source: this[ST].id, tick: S.tick });
  }
  runCommand(commandString) {
    assertWritable("Entity::runCommand");
    assertEntityValid(this, "runCommand");
    return runCommandImpl(this[ST].ds, commandString, this);
  }
  runCommandAsync(commandString) {
    try {
      return Promise.resolve(runCommandImpl(this[ST].ds, commandString, this));
    } catch (e) {
      return Promise.reject(e);
    }
  }
  teleport(location, teleportOptions = {}) {
    assertWritable("Entity::teleport");
    assertEntityValid(this, "teleport");
    teleportImpl(this, location, teleportOptions);
  }
  tryTeleport(location, teleportOptions = {}) {
    assertWritable("Entity::tryTeleport");
    assertEntityValid(this, "tryTeleport");
    const ds = teleportOptions.dimension ? teleportOptions.dimension[ST] : this[ST].ds;
    const p = floor3(location);
    if (!inHeight(ds, p.y) || !chunkLoaded(ds, p.x, p.z)) return false;
    if (teleportOptions.checkForBlocks !== false) {
      const perm = getPerm(ds, p.x, p.y, p.z);
      if (perm[ST].name !== "minecraft:air" && !V.isPassable(perm[ST].name)) return false;
    }
    teleportImpl(this, location, teleportOptions);
    return true;
  }
  triggerEvent(eventName) {
    assertWritable("Entity::triggerEvent");
    assertEntityValid(this, "triggerEvent");
    const st = this[ST];
    const mods = runEntityEvent(this, eventName, 0, true);
    S.records.triggered.push({ entityId: st.id, typeId: st.typeId, event: eventName, tick: S.tick, added: mods.added, removed: mods.removed });
    const ev = {
      entity: this,
      eventId: eventName,
      getModifiers: () => [{ addedComponentGroups: [...mods.added], removedComponentGroups: [...mods.removed] }],
    };
    queueAfter("dataDrivenEntityTrigger", ev);
  }
}

function teleportImpl(ent, location, opts) {
  const st = ent[ST];
  const toDs = opts.dimension ? opts.dimension[ST] : st.ds;
  const p = floor3(location);
  if (!inHeight(toDs, p.y)) throw new LocationOutOfWorldBoundariesError(`Teleport target (${p.x}, ${p.y}, ${p.z}) outside ${toDs.id}`);
  const fromDs = st.ds;
  const fromLoc = copyVec(st.loc);
  st.ds = toDs;
  st.loc = copyVec(location);
  if (opts.rotation) st.rot = { x: opts.rotation.x, y: opts.rotation.y };
  if (opts.facingLocation) {
    const d = { x: opts.facingLocation.x - st.loc.x, y: opts.facingLocation.y - st.loc.y, z: opts.facingLocation.z - st.loc.z };
    st.rot = { x: (-Math.atan2(d.y, Math.hypot(d.x, d.z)) * 180) / Math.PI, y: (Math.atan2(-d.x, d.z) * 180) / Math.PI };
  }
  if (!opts.keepVelocity) st.velocity = { x: 0, y: 0, z: 0 };
  if (st.isPlayer && fromDs !== toDs) {
    queueAfter("playerDimensionChange", { player: ent, fromDimension: fromDs.api, fromLocation: fromLoc, toDimension: toDs.api, toLocation: copyVec(st.loc) });
  }
}

// --- Player ------------------------------------------------------------------------

export class ScreenDisplay {
  constructor(token, player) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this[ST] = player;
  }
  isValid() {
    return entityValid(this[ST][ST]);
  }
  setActionBar(text) {
    assertWritable("ScreenDisplay::setActionBar");
    S.records.actionbars.push({ player: this[ST].name, playerId: this[ST].id, text, tick: S.tick });
  }
  setTitle(title, options) {
    assertWritable("ScreenDisplay::setTitle");
    if (options && !(Number.isFinite(options.fadeInDuration) && Number.isFinite(options.stayDuration) && Number.isFinite(options.fadeOutDuration))) {
      throw new TypeError("TitleDisplayOptions requires fadeInDuration, stayDuration and fadeOutDuration");
    }
    S.records.titles.push({ player: this[ST].name, playerId: this[ST].id, title, subtitle: options?.subtitle, options, tick: S.tick });
  }
  updateSubtitle(subtitle) {
    assertWritable("ScreenDisplay::updateSubtitle");
    S.records.titles.push({ player: this[ST].name, playerId: this[ST].id, title: undefined, subtitle, tick: S.tick });
  }
  getHiddenHudElements() {
    return [];
  }
  hideAllExcept() {}
  isForcedHidden() {
    return false;
  }
  resetHudElements() {}
  setHudVisibility() {}
}

export class Camera {
  constructor(token, player) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this[ST] = player;
  }
  clear() {
    assertWritable("Camera::clear");
  }
  fade() {
    assertWritable("Camera::fade");
  }
  setCamera() {
    assertWritable("Camera::setCamera");
  }
}

export class Player extends Entity {
  get name() {
    return this[ST].name;
  }
  get onScreenDisplay() {
    return new ScreenDisplay(INTERNAL, this);
  }
  get camera() {
    return new Camera(INTERNAL, this);
  }
  get level() {
    return this[ST].level ?? 0;
  }
  get totalXpNeededForNextLevel() {
    return 7;
  }
  get xpEarnedAtCurrentLevel() {
    return 0;
  }
  get isEmoting() {
    return false;
  }
  get isFlying() {
    return false;
  }
  get isGliding() {
    return false;
  }
  get isJumping() {
    return false;
  }
  get selectedSlotIndex() {
    return this[ST].selectedSlot;
  }
  set selectedSlotIndex(v) {
    if (!Number.isInteger(v) || v < 0 || v > 8) throw new RangeError(`selectedSlotIndex ${v} outside 0-8`);
    this[ST].selectedSlot = v;
  }
  addExperience(amount) {
    assertWritable("Player::addExperience");
    this[ST].xp = (this[ST].xp ?? 0) + amount;
    return this[ST].xp;
  }
  addLevels(amount) {
    assertWritable("Player::addLevels");
    this[ST].level = (this[ST].level ?? 0) + amount;
    return this[ST].level;
  }
  getTotalXp() {
    return this[ST].xp ?? 0;
  }
  resetLevel() {
    assertWritable("Player::resetLevel");
    this[ST].level = 0;
    this[ST].xp = 0;
  }
  getGameMode() {
    return this[ST].gameMode;
  }
  setGameMode(gameMode) {
    assertWritable("Player::setGameMode");
    const gm = gameMode ?? E.GameMode.survival;
    if (!Object.values(E.GameMode).includes(gm)) throw new TypeError(`Invalid game mode ${gm}`);
    const from = this[ST].gameMode;
    if (from === gm) return;
    this[ST].gameMode = gm;
    queueAfter("playerGameModeChange", { player: this, fromGameMode: from, toGameMode: gm });
  }
  getItemCooldown(category) {
    const c = this[ST].cooldowns?.get(category);
    return c ? Math.max(0, c - S.tick) : 0;
  }
  startItemCooldown(category, ticks) {
    assertWritable("Player::startItemCooldown");
    if (!this[ST].cooldowns) this[ST].cooldowns = new Map();
    this[ST].cooldowns.set(category, S.tick + ticks);
  }
  getSpawnPoint() {
    const sp = this[ST].spawnPoint;
    return sp ? { ...sp } : undefined;
  }
  setSpawnPoint(spawnPoint) {
    assertWritable("Player::setSpawnPoint");
    this[ST].spawnPoint = spawnPoint ? { ...spawnPoint } : undefined;
  }
  playSound(soundId, soundOptions) {
    assertWritable("Player::playSound");
    S.records.sounds.push({ kind: "player", id: soundId, player: this[ST].name, playerId: this[ST].id, location: soundOptions?.location, options: soundOptions ? { ...soundOptions } : undefined, tick: S.tick });
  }
  playMusic(trackId, opts) {
    assertWritable("Player::playMusic");
    S.records.music.push({ player: this[ST].name, trackId, opts, tick: S.tick });
  }
  queueMusic(trackId, opts) {
    assertWritable("Player::queueMusic");
    S.records.music.push({ player: this[ST].name, trackId, opts, queued: true, tick: S.tick });
  }
  stopMusic() {
    assertWritable("Player::stopMusic");
  }
  sendMessage(message) {
    S.records.messages.push({ player: this[ST].name, playerId: this[ST].id, message, tick: S.tick });
  }
}

function newPlayerState(name, ds, loc, opts = {}) {
  const st = newEntityState("minecraft:player", ds, loc, opts);
  Object.assign(st, {
    name,
    gameMode: opts.gameMode ?? E.GameMode.survival,
    selectedSlot: 0,
    inventory: new ContainerState(36),
    equipment: new ContainerState(5),
    level: 0,
    xp: 0,
    isPlayer: true,
  });
  st.nameTag = name;
  if (!healthFromComponents(st.comps)) st.health = { cur: 20, max: 20 };
  return st;
}

// ===========================================================================
// Structures
// ===========================================================================

class StructData {
  constructor(id, size, saveMode) {
    this.id = id;
    this.size = { ...size };
    const n = size.x * size.y * size.z;
    this.blocks = new Array(n).fill(undefined);
    this.water = new Array(n).fill(false);
    this.blockEntities = new Map();
    this.saveMode = saveMode ?? E.StructureSaveMode.World;
    this.fromFile = false;
    this.valid = true;
  }
  index(x, y, z) {
    return (x * this.size.y + y) * this.size.z + z;
  }
  inBounds(l) {
    return l.x >= 0 && l.y >= 0 && l.z >= 0 && l.x < this.size.x && l.y < this.size.y && l.z < this.size.z;
  }
}

function convertPaletteStates(name, states) {
  const reg = V.blockRegistry();
  const def = reg.available ? reg.blocks.get(name) : undefined;
  const out = {};
  for (const [k, v] of Object.entries(states || {})) {
    const prop = def?.props.find((p) => p.name === k);
    if (typeof v === "number" && (prop ? prop.type === "bool" : false)) out[k] = v !== 0;
    else if (typeof v === "bigint") out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}

/** Parse a .mcstructure buffer into StructData (throws on invalid blocks/states). */
function parseMcstructure(id, buf) {
  const { value: root } = readNbt(buf);
  if (root.format_version !== 1) throw new Error(`${id}: unsupported format_version ${root.format_version}`);
  const [sx, sy, sz] = root.size;
  const sd = new StructData(id, { x: sx, y: sy, z: sz }, E.StructureSaveMode.World);
  sd.fromFile = true;
  const layers = root.structure.block_indices;
  const pal = root.structure.palette?.default;
  if (!pal) throw new Error(`${id}: missing palette.default`);
  const n = sx * sy * sz;
  if (layers[0].length !== n) throw new Error(`${id}: block_indices[0] has ${layers[0].length} entries, expected ${n}`);
  const palette = pal.block_palette.map((e, i) => {
    if (e.name === "minecraft:structure_void") return null;
    try {
      return resolvePerm(e.name, convertPaletteStates(e.name, e.states));
    } catch (err) {
      throw new Error(`${id}: palette entry ${i} (${e.name} ${JSON.stringify(e.states)}): ${err.message}`);
    }
  });
  sd.palette = pal.block_palette;
  for (let i = 0; i < n; i++) {
    const pi = layers[0][i];
    if (pi < 0) continue;
    if (pi >= palette.length) throw new Error(`${id}: palette index ${pi} out of range at ${i}`);
    sd.blocks[i] = palette[pi] ?? "void";
    const wi = layers[1]?.[i];
    if (wi !== undefined && wi >= 0) sd.water[i] = true;
  }
  for (const [k, v] of Object.entries(pal.block_position_data || {})) {
    if (v.block_entity_data) sd.blockEntities.set(Number(k), v.block_entity_data);
  }
  return sd;
}

function getStructData(identifier) {
  if (S.structures.has(identifier)) return S.structures.get(identifier);
  const file = V.structureFile(identifier);
  if (!file) return undefined;
  const sd = parseMcstructure(identifier, fs.readFileSync(file));
  S.structures.set(identifier, sd);
  return sd;
}

// rotation of block states (clockwise when viewed from above, per 90 degrees)
const CW_CARDINAL = { north: "east", east: "south", south: "west", west: "north" };
const CW_FACING = { 0: 0, 1: 1, 2: 5, 5: 3, 3: 4, 4: 2 }; // facing_direction: 0 down 1 up 2 N 3 S 4 W 5 E
const CW_WEIRDO = { 0: 2, 2: 1, 1: 3, 3: 0 }; // weirdo_direction / trapdoor direction: 0 E 1 W 2 S 3 N
const CW_TORCH = { north: "east", east: "south", south: "west", west: "north", top: "top", unknown: "unknown" };

const CW_LEVER = {
  east: "south", south: "west", west: "north", north: "east",
  down_east_west: "down_north_south", down_north_south: "down_east_west",
  up_east_west: "up_north_south", up_north_south: "up_east_west",
};

function rotateStatesCW(name, states) {
  const out = { ...states };
  for (const [k, v] of Object.entries(states)) {
    if (k === "minecraft:cardinal_direction" || k === "minecraft:facing_direction" || k === "minecraft:block_face") {
      if (v in CW_CARDINAL) out[k] = CW_CARDINAL[v];
    } else if (k === "facing_direction") out[k] = CW_FACING[v] ?? v;
    else if (k === "lever_direction") out[k] = CW_LEVER[v] ?? v;
    else if (k === "portal_axis") out[k] = v === "x" ? "z" : v === "z" ? "x" : v;
    else if (k === "weirdo_direction") out[k] = CW_WEIRDO[v] ?? v;
    else if (k === "direction") out[k] = /trapdoor$/.test(name) ? CW_WEIRDO[v] ?? v : (v + 1) % 4;
    else if (k === "pillar_axis") out[k] = v === "x" ? "z" : v === "z" ? "x" : v;
    else if (k === "torch_facing_direction") out[k] = CW_TORCH[v] ?? v;
    else if (k === "ground_sign_direction") out[k] = (v + 4) % 16;
  }
  return out;
}

function rotatePerm(perm, quarterTurns) {
  if (!quarterTurns) return perm;
  let states = perm[ST].states;
  for (let i = 0; i < quarterTurns; i++) states = rotateStatesCW(perm[ST].name, states);
  try {
    return resolvePerm(perm[ST].name, states);
  } catch {
    warn(`mock: rotated states invalid for ${perm[ST].name}; kept unrotated`);
    return perm;
  }
}

const ROT_TURNS = { None: 0, Rotate90: 1, Rotate180: 2, Rotate270: 3 };

/** Map a local structure position to its offset inside the rotated/mirrored box. */
export function structureTransform(local, size, rotation = "None", mirror = "None") {
  let { x, z } = local;
  const { y } = local;
  if (mirror === "X" || mirror === "XZ") z = size.z - 1 - z;
  if (mirror === "Z" || mirror === "XZ") x = size.x - 1 - x;
  switch (rotation) {
    case "Rotate90": // clockwise from above: (dx,dz) -> (-dz,dx)
      return { x: size.z - 1 - z, y, z: x };
    case "Rotate180":
      return { x: size.x - 1 - x, y, z: size.z - 1 - z };
    case "Rotate270":
      return { x: z, y, z: size.x - 1 - x };
    default:
      return { x, y, z };
  }
}

function applyStructureOp(ds, op) {
  if (!inHeight(ds, op.y) || !chunkLoaded(ds, op.x, op.z)) return;
  setPermRaw(ds, op.x, op.y, op.z, op.perm);
  if (op.blockEntity) fillBlockEntity(ds, op);
}

function fillBlockEntity(ds, op) {
  const c = ds.containers.get(bkey(op.x, op.y, op.z));
  const items = op.blockEntity?.Items;
  if (!c || !Array.isArray(items)) return;
  for (const it of items) {
    const slot = it.Slot ?? 0;
    const name = it.Name;
    if (!name || slot < 0 || slot >= c.state.size) continue;
    try {
      const st = new ItemStack(name, Math.max(1, Math.min(255, it.Count ?? 1)));
      c.state.slots[slot] = st;
    } catch (e) {
      warn(`mock: structure chest item '${name}' rejected: ${e.message}`);
    }
  }
}

export class Structure {
  constructor(token, sd) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this[ST] = sd;
  }
  _sd() {
    if (!this[ST].valid) throw new InvalidStructureError(`Structure '${this[ST].id}' has been deleted`);
    return this[ST];
  }
  get id() {
    return this[ST].id;
  }
  get size() {
    return { ...this._sd().size };
  }
  isValid() {
    return this[ST].valid;
  }
  getBlockPermutation(location) {
    const sd = this._sd();
    if (!sd.inBounds(location)) throw new Error(`InvalidArgumentError: location ${JSON.stringify(location)} outside structure bounds`);
    const b = sd.blocks[sd.index(location.x, location.y, location.z)];
    if (b === "void") return resolvePerm("minecraft:structure_void", {});
    return b;
  }
  getIsWaterlogged(location) {
    const sd = this._sd();
    if (!sd.inBounds(location)) throw new Error(`InvalidArgumentError: location ${JSON.stringify(location)} outside structure bounds`);
    return sd.water[sd.index(location.x, location.y, location.z)];
  }
  setBlockPermutation(location, blockPermutation) {
    assertWritable("Structure::setBlockPermutation");
    const sd = this._sd();
    if (!sd.inBounds(location)) throw new Error(`InvalidArgumentError: location ${JSON.stringify(location)} outside structure bounds`);
    if (blockPermutation && blockPermutation[ST].name === "minecraft:structure_void") throw new Error("InvalidArgumentError: cannot set StructureVoid");
    sd.blocks[sd.index(location.x, location.y, location.z)] = blockPermutation;
  }
  saveAs(identifier, saveMode) {
    assertWritable("Structure::saveAs");
    const sd = this._sd();
    if (!identifier.includes(":")) throw new Error("InvalidArgumentError: identifier needs a namespace");
    const copy = new StructData(identifier, sd.size, saveMode);
    copy.blocks = [...sd.blocks];
    copy.water = [...sd.water];
    copy.blockEntities = new Map(sd.blockEntities);
    S.structures.set(identifier, copy);
    return new Structure(INTERNAL, copy);
  }
  saveToWorld() {
    assertWritable("Structure::saveToWorld");
    this._sd().saveMode = E.StructureSaveMode.World;
  }
}

export class StructureManager {
  constructor(token) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
  }
  createEmpty(identifier, size, saveMode) {
    assertWritable("StructureManager::createEmpty");
    if (typeof identifier !== "string" || !identifier.includes(":")) throw new Error(`InvalidArgumentError: invalid structure identifier '${identifier}'`);
    if (getStructData(identifier)) throw new Error(`InvalidArgumentError: structure '${identifier}' already exists`);
    if (![size.x, size.y, size.z].every((v) => Number.isInteger(v) && v > 0 && v <= 64 * 1024)) throw new Error("InvalidArgumentError: invalid size");
    const sd = new StructData(identifier, size, saveMode ?? E.StructureSaveMode.Memory);
    S.structures.set(identifier, sd);
    return new Structure(INTERNAL, sd);
  }
  createFromWorld(identifier, dimension, from, to, options = {}) {
    assertWritable("StructureManager::createFromWorld");
    if (typeof identifier !== "string" || !identifier.includes(":")) throw new Error(`InvalidArgumentError: invalid structure identifier '${identifier}'`);
    if (getStructData(identifier)) throw new Error(`InvalidArgumentError: structure '${identifier}' already exists`);
    const ds = dimension[ST];
    const lo = { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), z: Math.min(from.z, to.z) };
    const hi = { x: Math.max(from.x, to.x), y: Math.max(from.y, to.y), z: Math.max(from.z, to.z) };
    const size = { x: hi.x - lo.x + 1, y: hi.y - lo.y + 1, z: hi.z - lo.z + 1 };
    const sd = new StructData(identifier, size, options.saveMode ?? E.StructureSaveMode.World);
    if (options.includeBlocks !== false) {
      for (let x = 0; x < size.x; x++)
        for (let y = 0; y < size.y; y++)
          for (let z = 0; z < size.z; z++) {
            const wx = lo.x + x;
            const wy = lo.y + y;
            const wz = lo.z + z;
            if (!inHeight(ds, wy)) throw new Error("InvalidArgumentError: structure bounds outside the world");
            sd.blocks[sd.index(x, y, z)] = getPerm(ds, wx, wy, wz);
          }
    }
    S.structures.set(identifier, sd);
    return new Structure(INTERNAL, sd);
  }
  delete(structure) {
    assertWritable("StructureManager::delete");
    const id = typeof structure === "string" ? structure : structure.id;
    const sd = S.structures.get(id) ?? getStructData(id);
    if (!sd) return false;
    if (sd.fromFile) throw new Error(`InvalidArgumentError: structure '${id}' comes from a behavior pack and cannot be deleted`);
    sd.valid = false;
    S.structures.delete(id);
    return true;
  }
  get(identifier) {
    assertWritable("StructureManager::get");
    const sd = getStructData(identifier);
    return sd ? new Structure(INTERNAL, sd) : undefined;
  }
  getWorldStructureIds() {
    assertWritable("StructureManager::getWorldStructureIds");
    return [...S.structures.values()].filter((s) => s.saveMode === E.StructureSaveMode.World && !s.fromFile).map((s) => s.id);
  }
  place(structure, dimension, location, options = {}) {
    assertWritable("StructureManager::place");
    const sd = typeof structure === "string" ? getStructData(structure) : structure?.[ST];
    if (!sd) throw new InvalidStructureError(`Structure '${typeof structure === "string" ? structure : structure?.id}' not found`);
    if (!sd.valid) throw new InvalidStructureError(`Structure '${sd.id}' has been deleted`);
    const ds = dimension[ST];
    const integrity = options.integrity ?? 1;
    if (!(integrity >= 0 && integrity <= 1)) throw new RangeError("ArgumentOutOfBoundsError: integrity must be within [0, 1]");
    const rotation = options.rotation ?? E.StructureRotation.None;
    if (!(rotation in ROT_TURNS)) throw new TypeError(`Invalid rotation ${rotation}`);
    const mirror = options.mirror ?? E.StructureMirrorAxis.None;
    const mode = options.animationMode ?? E.StructureAnimationMode.None;
    if (!Object.values(E.StructureAnimationMode).includes(mode)) throw new TypeError(`Invalid animationMode ${mode}`);
    const turns = ROT_TURNS[rotation];
    const rs = turns % 2 ? { x: sd.size.z, y: sd.size.y, z: sd.size.x } : { ...sd.size };
    const origin = floor3(location);
    if (origin.y < ds.min || origin.y + rs.y > ds.max) {
      throw new LocationOutOfWorldBoundariesError(`Structure '${sd.id}' placed at y=${origin.y} (height ${rs.y}) exceeds ${ds.id} height range`);
    }
    for (let cx = origin.x >> 4; cx <= (origin.x + rs.x - 1) >> 4; cx++)
      for (let cz = origin.z >> 4; cz <= (origin.z + rs.z - 1) >> 4; cz++)
        if (!chunkLoaded(ds, cx * 16, cz * 16)) throw new LocationInUnloadedChunkError(`Structure '${sd.id}' overlaps unloaded chunk ${cx},${cz}`);
    const ops = [];
    if (options.includeBlocks !== false) {
      const rng = makeRng(options.integritySeed ? [...String(options.integritySeed)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) : S.options.seed);
      for (let x = 0; x < sd.size.x; x++)
        for (let y = 0; y < sd.size.y; y++)
          for (let z = 0; z < sd.size.z; z++) {
            const idx = sd.index(x, y, z);
            const b = sd.blocks[idx];
            if (!b || b === "void") continue;
            if (integrity < 1 && rng() >= integrity) continue;
            const t = structureTransform({ x, y, z }, sd.size, rotation, mirror);
            ops.push({ x: origin.x + t.x, y: origin.y + t.y, z: origin.z + t.z, perm: rotatePerm(b, turns), blockEntity: sd.blockEntities.get(idx), order: idx, layer: y });
          }
    }
    const secs = options.animationSeconds ?? 0;
    S.records.structurePlacements.push({ id: sd.id, dimension: ds.id, location: copyVec(origin), options: { ...options }, rotatedSize: rs, blocks: ops.length, tick: S.tick });
    if (mode !== E.StructureAnimationMode.None && secs > 0 && S.options.animateStructures && ops.length) {
      const totalTicks = Math.max(1, Math.round(secs * 20));
      const steps = new Map();
      if (mode === E.StructureAnimationMode.Layers) {
        const layers = [...new Set(ops.map((o) => o.layer))].sort((a, b) => a - b);
        layers.forEach((ly, i) => {
          const at = 1 + Math.floor((i * totalTicks) / layers.length);
          const list = steps.get(at) ?? [];
          list.push(...ops.filter((o) => o.layer === ly));
          steps.set(at, list);
        });
      } else {
        ops.sort((a, b) => a.order - b.order);
        ops.forEach((o, i) => {
          const at = 1 + Math.floor((i * totalTicks) / ops.length);
          const list = steps.get(at) ?? [];
          list.push(o);
          steps.set(at, list);
        });
      }
      S.animations.push({ dim: ds, startTick: S.tick, steps, lastStep: Math.max(...steps.keys()) });
    } else {
      for (const op of ops) applyStructureOp(ds, op);
    }
  }
}

export const structureManager = new StructureManager(INTERNAL);

// ===========================================================================
// World
// ===========================================================================

class GameRules {
  constructor() {
    Object.assign(this, {
      commandBlockOutput: true, commandBlocksEnabled: true, doDayLightCycle: true, doEntityDrops: true, doFireTick: true,
      doImmediateRespawn: false, doInsomnia: true, doLimitedCrafting: false, doMobLoot: true, doMobSpawning: true,
      doTileDrops: true, doWeatherCycle: true, drowningDamage: true, fallDamage: true, fireDamage: true, freezeDamage: true,
      functionCommandLimit: 10000, keepInventory: false, maxCommandChainLength: 65535, mobGriefing: true,
      naturalRegeneration: true, playersSleepingPercentage: 100, projectilesCanBreakBlocks: true, pvp: true,
      randomTickSpeed: 1, recipesUnlock: true, respawnBlocksExplode: true, sendCommandFeedback: true,
      showBorderEffect: true, showCoordinates: false, showDeathMessages: true, showRecipeMessages: true, showTags: true,
      spawnRadius: 5, tntExplodes: true, tntExplosionDropDecay: false,
    });
  }
}

export class Scoreboard {
  constructor(token) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
  }
  getObjectives() {
    return [];
  }
  getObjective() {
    return undefined;
  }
  getParticipants() {
    return [];
  }
  getObjectiveAtDisplaySlot() {
    return undefined;
  }
  addObjective() {
    throw new Error("mock: scoreboard is not implemented");
  }
  removeObjective() {
    throw new Error("mock: scoreboard is not implemented");
  }
  setObjectiveAtDisplaySlot() {
    throw new Error("mock: scoreboard is not implemented");
  }
  clearObjectiveAtDisplaySlot() {
    return undefined;
  }
}

export class World {
  constructor(token) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
    this[ST] = { gameRules: new GameRules(), scoreboard: new Scoreboard(INTERNAL) };
  }
  get afterEvents() {
    return afterEvents;
  }
  get beforeEvents() {
    return beforeEvents;
  }
  get gameRules() {
    return this[ST].gameRules;
  }
  get scoreboard() {
    return this[ST].scoreboard;
  }
  get structureManager() {
    return structureManager;
  }
  getDimension(dimensionId) {
    const id = V.normalizeId(String(dimensionId));
    const ds = S.dims.get(id);
    if (!ds) throw new Error(`Dimension '${dimensionId}' is invalid`);
    return ds.api;
  }
  getAllPlayers() {
    return [...S.entities.values()].filter((e) => e instanceof Player && entityValid(e[ST]));
  }
  getPlayers(options) {
    return queryEntities(options, undefined).filter((e) => e instanceof Player);
  }
  getEntity(id) {
    if (typeof id !== "string") throw new TypeError("getEntity: id must be a string");
    const e = S.entities.get(id);
    return e && entityValid(e[ST]) ? e : undefined;
  }
  getDynamicProperty(identifier) {
    return cloneDynValue(S.worldProps.get(identifier));
  }
  setDynamicProperty(identifier, value) {
    const v = checkDynamicValue(identifier, value);
    if (v === undefined) S.worldProps.delete(identifier);
    else S.worldProps.set(identifier, v);
  }
  getDynamicPropertyIds() {
    return [...S.worldProps.keys()];
  }
  getDynamicPropertyTotalByteCount() {
    return dynPropBytes(S.worldProps);
  }
  clearDynamicProperties() {
    S.worldProps.clear();
  }
  getAbsoluteTime() {
    return S.absoluteTime;
  }
  setAbsoluteTime(t) {
    assertWritable("World::setAbsoluteTime");
    S.absoluteTime = t;
  }
  getTimeOfDay() {
    return S.timeOfDay;
  }
  setTimeOfDay(t) {
    assertWritable("World::setTimeOfDay");
    S.timeOfDay = ((t % 24000) + 24000) % 24000;
  }
  getDay() {
    return Math.floor(S.absoluteTime / 24000);
  }
  getMoonPhase() {
    return this.getDay() % 8;
  }
  getDefaultSpawnLocation() {
    return copyVec(S.defaultSpawn);
  }
  setDefaultSpawnLocation(l) {
    assertWritable("World::setDefaultSpawnLocation");
    S.defaultSpawn = copyVec(l);
  }
  playSound(soundId, location, soundOptions) {
    assertWritable("World::playSound");
    S.records.sounds.push({ kind: "world", id: soundId, location: copyVec(location), options: soundOptions ? { ...soundOptions } : undefined, tick: S.tick });
  }
  playMusic(trackId, o) {
    assertWritable("World::playMusic");
    S.records.music.push({ trackId, o, tick: S.tick });
  }
  queueMusic(trackId, o) {
    assertWritable("World::queueMusic");
    S.records.music.push({ trackId, o, queued: true, tick: S.tick });
  }
  stopMusic() {
    assertWritable("World::stopMusic");
  }
  sendMessage(message) {
    S.records.messages.push({ player: undefined, message, tick: S.tick });
  }
}

export const world = new World(INTERNAL);

// --- small API classes ----------------------------------------------------------------

export class MolangVariableMap {
  constructor() {
    this[ST] = {};
  }
  setColorRGB(n, c) {
    this[ST][n] = { ...c };
  }
  setColorRGBA(n, c) {
    this[ST][n] = { ...c };
  }
  setFloat(n, v) {
    this[ST][n] = v;
  }
  setSpeedAndDirection(n, speed, direction) {
    this[ST][n] = { speed, direction: { ...direction } };
  }
  setVector3(n, v) {
    this[ST][n] = copyVec(v);
  }
}

export class BlockVolumeBase {
  constructor(token) {
    if (token !== INTERNAL) throw new TypeError("Illegal constructor");
  }
}
export class ListBlockVolume extends BlockVolumeBase {
  constructor(locations) {
    super(INTERNAL);
    this[ST] = new Map();
    this.add(locations);
  }
  add(locations) {
    for (const l of locations) this[ST].set(bkey(l.x, l.y, l.z), copyVec(l));
  }
  remove(locations) {
    for (const l of locations) this[ST].delete(bkey(l.x, l.y, l.z));
  }
  getCapacity() {
    return this[ST].size;
  }
  isInside(l) {
    return this[ST].has(bkey(Math.floor(l.x), Math.floor(l.y), Math.floor(l.z)));
  }
  getMin() {
    const v = [...this[ST].values()];
    return { x: Math.min(...v.map((p) => p.x)), y: Math.min(...v.map((p) => p.y)), z: Math.min(...v.map((p) => p.z)) };
  }
  getMax() {
    const v = [...this[ST].values()];
    return { x: Math.max(...v.map((p) => p.x)), y: Math.max(...v.map((p) => p.y)), z: Math.max(...v.map((p) => p.z)) };
  }
  getSpan() {
    const a = this.getMin();
    const b = this.getMax();
    return { x: b.x - a.x + 1, y: b.y - a.y + 1, z: b.z - a.z + 1 };
  }
  translate(d) {
    const pts = [...this[ST].values()].map((p) => ({ x: p.x + d.x, y: p.y + d.y, z: p.z + d.z }));
    this[ST].clear();
    this.add(pts);
  }
}

export class EnchantmentType {
  constructor(id) {
    this.id = id;
    this.maxLevel = 5;
  }
}
export class EnchantmentTypes {
  static get(id) {
    return new EnchantmentType(id);
  }
}

// Event classes exist so `instanceof`-free code that only imports them still loads.
export class ItemUseAfterEvent {}
export class ItemUseOnAfterEvent {}
export class ItemUseOnBeforeEvent {}
export class EntityHurtAfterEvent {}
export class EntityDieAfterEvent {}
export class PlayerSpawnAfterEvent {}
export class ScriptEventCommandMessageAfterEvent {}

// ===========================================================================
// Test control API (__mock)
// ===========================================================================

class MockHandlerError extends Error {
  constructor(errors) {
    const first = errors[0];
    super(
      `mock: ${errors.length} uncaught error(s) in event handlers / scheduled jobs. First (${first.where} @tick ${first.tick}): ${first.error?.stack ?? first.error}`,
    );
    this.name = "MockHandlerError";
    this.errors = errors;
    this.cause = first.error;
  }
}

function guarded(fn) {
  const before = S.errors.length;
  const r = fn();
  if (S.options.throwHandlerErrors && S.errors.length > before) throw new MockHandlerError(S.errors.slice(before));
  return r;
}

function entState(e) {
  if (!e || !e[ST]) throw new TypeError("expected a mock Entity/Player");
  return e[ST];
}

function serializeEntity(ent) {
  const st = ent[ST];
  const o = {
    id: st.id,
    typeId: st.typeId,
    dimension: st.ds.id,
    location: copyVec(st.loc),
    rotation: { ...st.rot },
    nameTag: st.nameTag,
    tags: [...st.tags],
    props: [...st.props],
    health: { ...st.health },
    groups: [...st.groups],
    overrides: [...st.overrides],
    effects: [...st.effects],
    dead: st.dead,
    familyOverride: st.familyOverride,
    item: serializeItem(st.item),
  };
  if (st.isPlayer) {
    Object.assign(o, {
      isPlayer: true,
      name: st.name,
      gameMode: st.gameMode,
      selectedSlot: st.selectedSlot,
      inventory: st.inventory.slots.map(serializeItem),
      equipment: st.equipment.slots.map(serializeItem),
      level: st.level,
      xp: st.xp,
      spawnPoint: st.spawnPoint ? { dimension: st.spawnPoint.dimension?.id, x: st.spawnPoint.x, y: st.spawnPoint.y, z: st.spawnPoint.z } : undefined,
    });
  }
  return o;
}

function deserializeEntity(o) {
  const ds = dimState(o.dimension);
  let st;
  if (o.isPlayer) {
    st = newPlayerState(o.name, ds, o.location, { id: o.id, gameMode: o.gameMode });
    st.selectedSlot = o.selectedSlot ?? 0;
    o.inventory.forEach((it, i) => (st.inventory.slots[i] = deserializeItem(it)));
    (o.equipment || []).forEach((it, i) => (st.equipment.slots[i] = deserializeItem(it)));
    st.level = o.level ?? 0;
    st.xp = o.xp ?? 0;
    if (o.spawnPoint) st.spawnPoint = { ...o.spawnPoint, dimension: o.spawnPoint.dimension ? dimState(o.spawnPoint.dimension).api : undefined };
  } else {
    st = newEntityState(o.typeId, ds, o.location, { id: o.id, item: deserializeItem(o.item) });
  }
  st.rot = { ...o.rotation };
  st.nameTag = o.nameTag ?? "";
  st.tags = new Set(o.tags);
  st.props = new Map(o.props);
  st.groups = [...o.groups];
  st.overrides = new Map(o.overrides);
  st.effects = new Map(o.effects);
  st.familyOverride = o.familyOverride;
  recomputeComponents(st);
  st.health = { ...o.health };
  st.dead = !!o.dead;
  if (st.dead && !st.isPlayer) st.removeAtTick = S.tick + S.options.deathRemovalTicks;
  return st.isPlayer ? new Player(INTERNAL, st) : new Entity(INTERNAL, st);
}

function setChunkState(dimId, cx, cz, loaded) {
  const ds = dimState(dimId);
  const k = `${cx},${cz}`;
  const was = chunkLoaded(ds, cx * 16, cz * 16);
  const inChunk = (st) => !st.isPlayer && !st.removed && st.ds === ds && Math.floor(st.loc.x) >> 4 === cx && Math.floor(st.loc.z) >> 4 === cz;
  if (!loaded) {
    if (was) {
      // The game reports unloading entities through entityRemove: the before-event
      // while the entity is still valid, the after-event once it is gone.
      for (const ent of S.entities.values()) {
        if (!inChunk(ent[ST])) continue;
        deliver(beforeEvents.entityRemove, { removedEntity: ent });
        queueAfter("entityRemove", { removedEntityId: ent[ST].id, typeId: ent[ST].typeId });
      }
    }
    ds.unloaded.add(k);
    return;
  }
  ds.unloaded.delete(k);
  const now = chunkLoaded(ds, cx * 16, cz * 16);
  if (!was && now) {
    // entities in a chunk that becomes loaded fire entityLoad
    for (const ent of S.entities.values()) if (inChunk(ent[ST])) queueAfter("entityLoad", { entity: ent });
  }
}

initDims();

export const __mock = {
  /** Live state (read-mostly; prefer the helpers below). */
  get state() {
    return S;
  },
  get options() {
    return S.options;
  },
  get records() {
    return S.records;
  },
  get errors() {
    return S.errors;
  },
  get warnings() {
    return S.warnings;
  },
  /** Current tick (same as system.currentTick). */
  get currentTick() {
    return S.tick;
  },
  vanilla: V,
  ST,
  structureTransform,

  /**
   * Reset the world. Subscriptions made by already-imported add-on modules are kept
   * (they cannot be re-imported in the same process) unless keepSubscriptions=false.
   */
  reset({ keepSubscriptions = true, options, resetClock = false } = {}) {
    const subs = keepSubscriptions ? undefined : true;
    // Time and entity ids stay monotonic across resets by default: add-on modules
    // imported once per process may keep tick- or id-keyed state between tests.
    const tick = S.tick;
    const nextId = S.nextEntityId;
    const jobs = S.jobs;
    const nextJobId = S.nextJobId;
    S = freshState(options);
    if (!resetClock) {
      S.tick = tick;
      S.absoluteTime = tick;
      S.nextEntityId = nextId;
    }
    if (keepSubscriptions) {
      // intervals registered by already-imported modules keep running (as they would in game)
      S.jobs = jobs;
      S.nextJobId = nextJobId;
      if (resetClock) for (const j of S.jobs.values()) j.due = Math.max(1, j.interval || 1);
    }
    initDims();
    if (subs) {
      for (const sig of [...Object.values(afterEvents), ...Object.values(beforeEvents), systemAfterEvents.scriptEventReceive]) sig[INTERNAL].subs.length = 0;
    }
    return this;
  },
  setOptions(o) {
    Object.assign(S.options, o);
    if (o.seed !== undefined) S.rng = makeRng(o.seed);
    return this;
  },

  /** Advance the game by n ticks (jobs -> world simulation -> queued after-events, per tick). */
  tick(n = 1) {
    return guarded(() => {
      for (let i = 0; i < n; i++) tickOnce();
      return S.tick;
    });
  },
  /** Tick until pred() is true (checked after each tick); returns ticks advanced. Throws after max ticks. */
  runUntil(pred, max = 2000) {
    for (let i = 1; i <= max; i++) {
      this.tick(1);
      if (pred()) return i;
    }
    throw new Error(`mock.runUntil: condition not met within ${max} ticks`);
  },
  /** Deliver queued after-events now, without advancing time. */
  flush() {
    return guarded(() => flushQueue());
  },
  /** Await pending promise callbacks (e.g. form.show().then(...)). */
  async settle(rounds = 5) {
    for (let i = 0; i < rounds; i++) await new Promise((r) => setImmediate(r));
  },
  jobs() {
    return [...S.jobs.values()].map((j) => ({ id: j.id, due: j.due, interval: j.interval }));
  },

  // --- dimensions / blocks ---------------------------------------------------------
  dimension(id = "minecraft:overworld") {
    return dimState(id).api;
  },
  setBlock(dimId, loc, nameOrPerm, states) {
    const ds = dimState(dimId);
    const p = floor3(loc);
    if (!inHeight(ds, p.y)) throw new LocationOutOfWorldBoundariesError(`y=${p.y} outside ${ds.id}`);
    const perm = nameOrPerm instanceof BlockPermutation ? nameOrPerm : resolvePerm(nameOrPerm, states);
    setPermRaw(ds, p.x, p.y, p.z, perm);
    return perm;
  },
  /** Block name at loc regardless of loaded state ("minecraft:air" by default). */
  blockName(dimId, loc) {
    const p = floor3(loc);
    return getPerm(dimState(dimId), p.x, p.y, p.z)[ST].name;
  },
  blockPerm(dimId, loc) {
    const p = floor3(loc);
    return getPerm(dimState(dimId), p.x, p.y, p.z);
  },
  fill(dimId, from, to, nameOrPerm, states) {
    const ds = dimState(dimId);
    const perm = nameOrPerm instanceof BlockPermutation ? nameOrPerm : resolvePerm(nameOrPerm, states);
    const a = floor3(from);
    const b = floor3(to);
    let n = 0;
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++)
      for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++)
        for (let z = Math.min(a.z, b.z); z <= Math.max(a.z, b.z); z++) {
          if (!inHeight(ds, y)) continue;
          setPermRaw(ds, x, y, z, perm);
          n++;
        }
    return n;
  },
  /** Non-air blocks of a dimension: [{x,y,z,name,states}] (optionally filtered by name). */
  listBlocks(dimId = "minecraft:overworld", name) {
    const out = [];
    for (const [k, p] of dimState(dimId).blocks) {
      if (name && p[ST].name !== V.normalizeId(name)) continue;
      const [x, y, z] = k.split(",").map(Number);
      out.push({ x, y, z, name: p[ST].name, states: { ...p[ST].states } });
    }
    return out;
  },
  countBlocks(dimId, name) {
    return this.listBlocks(dimId, name).length;
  },
  containerAt(dimId, loc) {
    const p = floor3(loc);
    const c = dimState(dimId).containers.get(bkey(p.x, p.y, p.z));
    return c ? new Container(INTERNAL, c.state) : undefined;
  },
  // --- chunks -----------------------------------------------------------------------
  unloadChunk(dimId, cx, cz) {
    setChunkState(dimId, cx, cz, false);
  },
  loadChunk(dimId, cx, cz) {
    setChunkState(dimId, cx, cz, true);
  },
  /** Unload/load the chunk containing block location loc. */
  unloadAt(dimId, loc) {
    setChunkState(dimId, Math.floor(loc.x) >> 4, Math.floor(loc.z) >> 4, false);
  },
  loadAt(dimId, loc) {
    setChunkState(dimId, Math.floor(loc.x) >> 4, Math.floor(loc.z) >> 4, true);
  },
  /** Custom loaded predicate (cx, cz) => boolean, or undefined for "everything loaded". */
  setLoadedPredicate(dimId, pred) {
    dimState(dimId).loadedPredicate = pred;
  },
  isChunkLoaded(dimId, loc) {
    return chunkLoaded(dimState(dimId), loc.x, loc.z);
  },

  // --- entities / players -----------------------------------------------------------------
  /**
   * Add a player. Queues playerJoin + playerSpawn(initialSpawn) (delivered on next tick/flush).
   * A player that left earlier (removePlayer) with the same name rejoins with its saved data.
   */
  addPlayer({ name = "Steve", dimension, location, gameMode, rotation, spawn = true } = {}) {
    let ent = S.offlinePlayers.get(name);
    if (ent) {
      S.offlinePlayers.delete(name);
      ent[ST].offline = false;
      if (location) ent[ST].loc = copyVec(location);
      if (dimension) ent[ST].ds = dimState(dimension);
    } else {
      const st = newPlayerState(name, dimState(dimension ?? "minecraft:overworld"), copyVec(location ?? { x: 0.5, y: 64, z: 0.5 }), { gameMode });
      ent = new Player(INTERNAL, st);
    }
    if (gameMode) ent[ST].gameMode = gameMode;
    if (rotation) ent[ST].rot = { ...rotation };
    S.entities.set(ent[ST].id, ent);
    queueAfter("playerJoin", { playerId: ent[ST].id, playerName: name });
    if (spawn) queueAfter("playerSpawn", { player: ent, initialSpawn: true });
    return ent;
  },
  /** Player leaves: beforeEvents.playerLeave (sync, read-only) then afterEvents.playerLeave (queued). */
  removePlayer(player) {
    const st = entState(player);
    return guarded(() => {
      deliver(beforeEvents.playerLeave, { player });
      st.offline = true;
      S.entities.delete(st.id);
      S.offlinePlayers.set(st.name, player);
      queueAfter("playerLeave", { playerId: st.id, playerName: st.name });
    });
  },
  /** Respawn a (dead) player: full health, queues playerSpawn(initialSpawn=false). */
  respawnPlayer(player, { location } = {}) {
    const st = entState(player);
    st.dead = false;
    st.health.cur = st.health.max;
    st.effects.clear();
    if (location) st.loc = copyVec(location);
    queueAfter("playerSpawn", { player, initialSpawn: false });
  },
  /** Spawn an entity as the game would (bypasses read-only checks). */
  spawn(typeId, location, { dimension = "minecraft:overworld", cause = "Spawned" } = {}) {
    return spawnEntityImpl(dimState(dimension), typeId, location, cause);
  },
  /** Set a component value seen by getComponent(): variant/mark_variant/skin_id/color/scale numbers; is_baby/is_sheared booleans; null removes. */
  setComponent(entity, componentId, value) {
    const st = entState(entity);
    const id = V.normalizeId(componentId);
    if (value === null) st.overrides.delete(id);
    else st.overrides.set(id, value);
  },
  setHealth(entity, current, max) {
    const st = entState(entity);
    if (max !== undefined) st.health.max = max;
    st.health.cur = current;
  },
  setFamilies(entity, families) {
    entState(entity).familyOverride = families ? [...families] : undefined;
  },
  setView(player, { headLocation, viewDirection, rotation } = {}) {
    const st = entState(player);
    if (headLocation !== undefined) st.headLocation = headLocation ? copyVec(headLocation) : undefined;
    if (viewDirection !== undefined) st.viewDirection = viewDirection ? copyVec(viewDirection) : undefined;
    if (rotation) st.rot = { ...rotation };
  },
  move(entity, location, dimension) {
    const st = entState(entity);
    st.loc = copyVec(location);
    if (dimension) st.ds = dimState(dimension);
  },
  /** Active component groups (in activation order). */
  groups(entity) {
    return [...entState(entity).groups];
  },
  isDead(entity) {
    return !!entState(entity).dead;
  },
  /** Every entity incl. invalid/unloaded ones (not removed). */
  allEntities() {
    return [...S.entities.values()];
  },
  triggered(entity) {
    return S.records.triggered.filter((t) => !entity || t.entityId === entity.id).map((t) => t.event);
  },
  give(player, itemOrId, amount = 1, slot) {
    const st = entState(player);
    const it = typeof itemOrId === "string" ? new ItemStack(itemOrId, amount) : itemOrId.clone();
    if (slot !== undefined) st.inventory.slots[slot] = it;
    else new Container(INTERNAL, st.inventory).addItem(it);
    return it;
  },
  setMainhand(player, itemOrId, amount = 1) {
    const st = entState(player);
    st.inventory.slots[st.selectedSlot] = itemOrId ? (typeof itemOrId === "string" ? new ItemStack(itemOrId, amount) : itemOrId.clone()) : undefined;
  },
  setOffhand(player, itemOrId, amount = 1) {
    entState(player).equipment.slots[0] = itemOrId ? (typeof itemOrId === "string" ? new ItemStack(itemOrId, amount) : itemOrId.clone()) : undefined;
  },
  inventory(player) {
    return new Container(INTERNAL, entState(player).inventory);
  },

  // --- events -------------------------------------------------------------------------
  /** Fire an after-event synchronously: mock.fireAfter("entityHurt", {...}). */
  fireAfter(name, ev = {}) {
    const sig = afterEvents[name];
    if (!sig) throw new Error(`unknown after-event '${name}'`);
    return guarded(() => deliver(sig, ev));
  },
  /** Fire a before-event synchronously in read-only mode; returns the event (check .cancel). */
  fireBefore(name, ev = {}) {
    const sig = beforeEvents[name];
    if (!sig) throw new Error(`unknown before-event '${name}'`);
    if (!("cancel" in ev)) ev.cancel = false;
    return guarded(() => deliver(sig, ev));
  },
  fireSystemAfter(name, ev = {}) {
    const sig = systemAfterEvents[name];
    if (!sig) throw new Error(`unknown system after-event '${name}'`);
    return guarded(() => deliver(sig, ev));
  },
  /** Queue an after-event (delivered on next tick/flush). */
  queueAfter(name, ev = {}) {
    if (!afterEvents[name]) throw new Error(`unknown after-event '${name}'`);
    queueAfter(name, ev);
  },
  /** /scriptevent <id> <message> */
  scriptEvent(id, message = "", { sourceEntity, sourceBlock, sourceType } = {}) {
    return this.fireSystemAfter("scriptEventReceive", {
      id,
      message,
      sourceEntity,
      initiator: undefined,
      sourceBlock,
      sourceType: sourceType ?? (sourceEntity ? E.ScriptEventSource.Entity : E.ScriptEventSource.Server),
    });
  },
  /**
   * Use the held item in the air: beforeEvents.itemUse then afterEvents.itemUse (both synchronous).
   * Returns false if no item is held or a before-handler cancelled.
   */
  useItem(player, { stack } = {}) {
    const st = entState(player);
    const s = stack ?? st.inventory.slots[st.selectedSlot];
    if (!s) return false;
    const be = this.fireBefore("itemUse", { source: player, itemStack: s.clone() });
    if (be.cancel) return false;
    this.fireAfter("itemUse", { source: player, itemStack: s.clone() });
    return true;
  },
  /**
   * Use the held item on a block face: beforeEvents.itemUseOn then afterEvents.itemUseOn,
   * and with {withItemUse: true} also the itemUse pair a real tap may produce.
   */
  useItemOn(player, block, face = E.Direction.Up, { faceLocation = { x: 0.5, y: 1, z: 0.5 }, stack, withItemUse = false } = {}) {
    const st = entState(player);
    const s = stack ?? st.inventory.slots[st.selectedSlot];
    if (!s) return false;
    const blk = block instanceof Block ? block : new Block(INTERNAL, st.ds, Math.floor(block.x), Math.floor(block.y), Math.floor(block.z));
    const ev = { source: player, itemStack: s.clone(), block: blk, blockFace: face, faceLocation: { ...faceLocation } };
    const be = this.fireBefore("itemUseOn", { ...ev, itemStack: s.clone() });
    if (be.cancel) return false;
    this.fireAfter("itemUseOn", ev);
    if (withItemUse) this.useItem(player, { stack: s });
    return true;
  },
  /**
   * Hold the use button for `ticks` ticks: an item-use event every `every` ticks
   * (on `block` if given, otherwise in the air), advancing the clock.
   */
  holdUse(player, { ticks = 20, every = 4, block, face } = {}) {
    for (let t = 0; t < ticks; t++) {
      if (t % every === 0) {
        if (block) this.useItemOn(player, block, face);
        else this.useItem(player);
      }
      this.tick(1);
    }
  },
  setCommandHandler(fn) {
    S.commandHandler = fn;
  },
  clearRecords() {
    S.records = emptyRecords();
  },
  lastActionBar(player) {
    const r = S.records.actionbars.filter((a) => !player || a.playerId === player.id);
    return r.length ? r[r.length - 1].text : undefined;
  },
  messagesTo(player) {
    return S.records.messages.filter((m) => m.playerId === player.id).map((m) => m.message);
  },

  // --- structures -------------------------------------------------------------------
  /** Load a .mcstructure file under an identifier (parsed + validated). */
  loadStructureFile(identifier, file) {
    const sd = parseMcstructure(identifier, fs.readFileSync(file));
    S.structures.set(identifier, sd);
    return new Structure(INTERNAL, sd);
  },
  /** Parse a .mcstructure buffer without registering it: {size, blocks(perm|undefined|"void")[], blockEntities}. */
  parseStructure(buffer, identifier = "test:structure") {
    return parseMcstructure(identifier, buffer);
  },
  structureAnimationsPending() {
    return S.animations.length;
  },

  // --- startup / save / reload --------------------------------------------------------------
  /**
   * Simulate world start after the add-on was imported: queues worldInitialize,
   * entityLoad for every loaded non-player entity restored by loadWorld(), and
   * playerJoin + playerSpawn(initialSpawn=true) for players restored by loadWorld().
   * Delivered on the next tick()/flush().
   */
  startup({ entityLoad = true } = {}) {
    queueAfter("worldInitialize", {});
    if (S.pendingStartup.entityLoad && entityLoad) {
      for (const ent of S.entities.values()) if (!ent[ST].isPlayer && entityValid(ent[ST])) queueAfter("entityLoad", { entity: ent });
    }
    for (const name of S.pendingStartup.players) {
      const p = S.offlinePlayers.get(name);
      if (p) this.addPlayer({ name, location: p[ST].loc, dimension: p[ST].ds.id });
    }
    S.pendingStartup = { worldInitialize: false, entityLoad: false, players: [] };
  },
  /** Serialize the complete world (blocks, containers, entities, players, world props, structures). */
  saveWorld() {
    const dims = [...S.dims.values()].map((ds) => ({
      id: ds.id,
      blocks: [...ds.blocks].map(([k, p]) => [...k.split(",").map(Number), p[ST].name, { ...p[ST].states }]),
      containers: [...ds.containers].map(([k, c]) => [...k.split(",").map(Number), c.state.slots.map(serializeItem)]),
      unloaded: [...ds.unloaded],
    }));
    const players = [...S.entities.values(), ...S.offlinePlayers.values()].filter((e) => e[ST].isPlayer);
    return JSON.parse(
      JSON.stringify({
        format: "pas-mock-world",
        version: 1,
        tick: S.tick,
        absoluteTime: S.absoluteTime,
        timeOfDay: S.timeOfDay,
        nextEntityId: S.nextEntityId,
        worldProps: [...S.worldProps],
        dims,
        entities: [...S.entities.values()].filter((e) => !e[ST].isPlayer && !e[ST].removed).map(serializeEntity),
        players: players.map(serializeEntity),
        structures: [...S.structures.values()]
          .filter((s) => s.saveMode === E.StructureSaveMode.World && !s.fromFile && s.valid)
          .map((s) => ({ id: s.id, size: s.size, blocks: s.blocks.map((b) => (b && b !== "void" ? [b[ST].name, { ...b[ST].states }] : b === "void" ? "void" : null)) })),
      }),
    );
  },
  /**
   * Replace the world with a snapshot from saveWorld(). Players come back offline;
   * call startup() after importing the add-on to make them join and spawn.
   * The tick counter continues from the saved value (like a reloaded world).
   */
  loadWorld(snap, { options } = {}) {
    if (!snap || snap.format !== "pas-mock-world") throw new Error("not a pas-mock-world snapshot");
    const keep = S.options;
    S = freshState(options ?? keep);
    initDims();
    S.tick = snap.tick;
    S.absoluteTime = snap.absoluteTime ?? snap.tick;
    S.timeOfDay = snap.timeOfDay ?? 1000;
    S.nextEntityId = snap.nextEntityId;
    S.worldProps = new Map(snap.worldProps);
    for (const d of snap.dims) {
      const ds = dimState(d.id);
      for (const [x, y, z, name, states] of d.blocks) setPermRaw(ds, x, y, z, resolvePerm(name, states));
      for (const [x, y, z, slots] of d.containers) {
        const c = ds.containers.get(bkey(x, y, z));
        if (c) slots.forEach((it, i) => (c.state.slots[i] = deserializeItem(it)));
      }
      ds.unloaded = new Set(d.unloaded);
    }
    for (const o of snap.entities) {
      const ent = deserializeEntity(o);
      S.entities.set(ent[ST].id, ent);
    }
    for (const o of snap.players) {
      const p = deserializeEntity(o);
      p[ST].offline = true;
      S.offlinePlayers.set(p[ST].name, p);
      S.pendingStartup.players.push(p[ST].name);
    }
    for (const s of snap.structures || []) {
      const sd = new StructData(s.id, s.size, E.StructureSaveMode.World);
      sd.blocks = s.blocks.map((b) => (b === "void" ? "void" : b ? resolvePerm(b[0], b[1]) : undefined));
      S.structures.set(s.id, sd);
    }
    S.pendingStartup.entityLoad = true;
    return this;
  },
};
