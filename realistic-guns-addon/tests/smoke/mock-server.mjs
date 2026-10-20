// Minimal mock of @minecraft/server for smoke-testing the add-on script in Node.
export const log = [];
function signal(name) {
  const subs = [];
  return { subs, subscribe(cb) { subs.push(cb); return cb; }, unsubscribe() {}, fire(ev) { for (const s of subs) s(ev); } };
}
export const EntityDamageCause = { projectile: "projectile", entityAttack: "entityAttack" };
export const GameMode = { Creative: "Creative", Survival: "Survival", Adventure: "Adventure", Spectator: "Spectator" };
export class MolangVariableMap {
  constructor() { this.vars = {}; }
  setFloat(n, v) { if (typeof v !== "number" || Number.isNaN(v)) throw new Error("bad float " + n); this.vars[n] = v; }
  setVector3(n, v) { for (const k of ["x","y","z"]) if (Number.isNaN(v[k])) throw new Error("NaN vector " + n); this.vars[n] = v; }
}
let nextId = 1;
export class Entity {
  constructor(typeId, dimension, location) {
    this.id = String(nextId++); this.typeId = typeId; this.dimension = dimension; this.location = location; this.isValid = true;
    this.components = {};
  }
  getComponent(id) { return this.components[id]; }
  remove() { this.isValid = false; }
  getHeadLocation() { return { x: this.location.x, y: this.location.y + 1.6, z: this.location.z }; }
  applyDamage(amount, opts) {
    const h = this.components["minecraft:health"];
    if (!h) return true;
    const now = system.currentTick;
    if (this.lastHurt !== undefined && now - this.lastHurtTick < 10) {
      if (amount <= this.lastHurt) return false;
      const d = amount - this.lastHurt; this.lastHurt = amount; h.currentValue = Math.max(0, h.currentValue - d); return true;
    }
    this.lastHurt = amount; this.lastHurtTick = now; h.currentValue = Math.max(0, h.currentValue - amount); return true;
  }
}
export class Player extends Entity {
  constructor(dimension) {
    super("minecraft:player", dimension, { x: 0, y: 64, z: 0 });
    this.selectedSlotIndex = 0; this.isSneaking = false; this.isOnGround = true; this.props = {};
    this.slots = new Array(36).fill(undefined); this.rotation = { x: 0, y: 0 }; this.gameMode = "Survival";
    this.cooldowns = {}; this.commands = []; this.actionbar = ""; this.particles = 0; this.sounds = [];
    const self = this;
    this.components["minecraft:inventory"] = { container: { size: 36,
      getItem(i) { const it = self.slots[i]; return it ? { ...it } : undefined; },
      setItem(i, it) { self.slots[i] = it ? { ...it } : undefined; } } };
    this.components["minecraft:health"] = { currentValue: 20, setCurrentValue(v) { this.currentValue = v; return true; } };
    this.onScreenDisplay = { setActionBar: (t) => { self.actionbar = typeof t === "string" ? t : JSON.stringify(t); } };
  }
  getDynamicProperty(k) { return this.props[k]; }
  setDynamicProperty(k, v) { this.props[k] = v; }
  getViewDirection() { const p = this.rotation.x * Math.PI/180, y = this.rotation.y * Math.PI/180; return { x: -Math.sin(y)*Math.cos(p), y: -Math.sin(p), z: Math.cos(y)*Math.cos(p) }; }
  getVelocity() { return { x: 0, y: 0, z: 0 }; }
  getRotation() { return { ...this.rotation }; }
  setRotation(r) { this.rotation = { ...r }; }
  runCommand(c) { this.commands.push(c); return { successCount: 1 }; }
  playSound(id, o) { this.sounds.push(id); }
  spawnParticle(id, loc, vars) { if ([loc.x, loc.y, loc.z].some(Number.isNaN)) throw new Error("NaN particle pos " + id); this.particles++; }
  startItemCooldown(cat, t) { this.cooldowns[cat] = t; }
  getGameMode() { return this.gameMode; }
  sendMessage(m) { log.push("msg:" + m); }
}
export class Dimension {
  constructor() { this.id = "minecraft:overworld"; this.entities = []; this.commands = []; this.sounds = []; this.blocks = {}; }
  getBlock(p) { return { isAir: true, isLiquid: false, typeId: "minecraft:air" }; }
  getBlockFromRay(origin, dir, opts) { return this.rayHit ? this.rayHit : undefined; }
  spawnEntity(id, loc) {
    const e = new Entity(id, this, loc);
    if (id.endsWith(":bullet")) e.components["minecraft:projectile"] = { owner: undefined, shoot(v) { if ([v.x,v.y,v.z].some(Number.isNaN)) throw new Error("NaN velocity"); this.velocity = v; } };
    this.entities.push(e); return e;
  }
  getPlayers() { return world.players; }
  playSound(id, loc, o) { this.sounds.push(id); }
  spawnParticle(id, loc, vars) { if ([loc.x, loc.y, loc.z].some(Number.isNaN)) throw new Error("NaN particle " + id); }
  runCommand(c) { this.commands.push(c); return { successCount: 1 }; }
}
const timeouts = [];
const intervals = [];
export const system = {
  currentTick: 0,
  runInterval(cb, n) { intervals.push(cb); return intervals.length; },
  runTimeout(cb, n) { timeouts.push({ at: this.currentTick + (n || 1), cb }); return timeouts.length; },
  afterEvents: { scriptEventReceive: signal("scriptEventReceive") },
  step() {
    this.currentTick++;
    for (const t of timeouts.filter((t) => t.at <= this.currentTick)) { timeouts.splice(timeouts.indexOf(t), 1); t.cb(); }
    for (const cb of intervals) cb();
  },
};
const names = ["itemStartUse","itemUse","itemStopUse","itemReleaseUse","itemCompleteUse","itemStartUseOn","itemStopUseOn",
  "projectileHitEntity","projectileHitBlock","playerLeave","playerSpawn"];
const afterEvents = {}; for (const n of names) afterEvents[n] = signal(n);
export const world = {
  players: [], props: {}, gameRules: { pvp: true },
  afterEvents,
  getAllPlayers() { return this.players; },
  getDynamicProperty(k) { return this.props[k]; },
  setDynamicProperty(k, v) { this.props[k] = v; },
  sendMessage(m) { log.push("world:" + m); },
};
