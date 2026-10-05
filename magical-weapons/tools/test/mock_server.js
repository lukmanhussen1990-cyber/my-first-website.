// Minimal in-memory mock of @minecraft/server (the stable API surface the add-on uses), just enough to
// exercise the spell logic in plain Node. run.mjs installs this file as node_modules/@minecraft/server
// inside a temp directory next to a copy of behavior_pack/scripts.
export const EquipmentSlot = { Mainhand: 'Mainhand', Offhand: 'Offhand', Head: 'Head' };
export const GameMode = { survival: 'survival', creative: 'creative', adventure: 'adventure', spectator: 'spectator' };
export const EntityDamageCause = { magic: 'magic', fire: 'fire', lightning: 'lightning', freezing: 'freezing', wither: 'wither', entityAttack: 'entityAttack' };

export class MolangVariableMap {
  constructor() { this.vars = {}; }
  setColorRGB(n, c) { if (!('red' in c)) throw new Error('bad color'); this.vars[n] = c; }
  setVector3(n, v) { if (!('x' in v)) throw new Error('bad vec'); this.vars[n] = v; }
  setFloat(n, v) { this.vars[n] = v; }
}

// ---- scheduler
const tasks = []; let nextId = 1;
export const system = {
  currentTick: 0,
  runTimeout(fn, ticks) { const id = nextId++; tasks.push({ id, fn, at: system.currentTick + ticks, every: 0 }); return id; },
  runInterval(fn, ticks) { const id = nextId++; tasks.push({ id, fn, at: system.currentTick + ticks, every: ticks }); return id; },
  run(fn) { return system.runTimeout(fn, 1); },
  clearRun(id) { const i = tasks.findIndex((t) => t.id === id); if (i >= 0) tasks.splice(i, 1); },
};
export function __advance(n) {
  for (let i = 0; i < n; i++) {
    system.currentTick++;
    for (const t of tasks.slice()) {
      if (!tasks.includes(t) || t.at > system.currentTick) continue;
      if (t.every) t.at += t.every; else tasks.splice(tasks.indexOf(t), 1);
      t.fn();
    }
  }
}
export function __pending() { return tasks.length; }

// ---- events
function signal() { const cbs = []; return { subscribe: (cb) => { cbs.push(cb); return cb; }, __emit: (ev) => cbs.forEach((cb) => cb(ev)) }; }
export const world = {
  afterEvents: { itemUse: signal(), itemUseOn: signal(), entityHitEntity: signal(), playerLeave: signal() },
  __players: [],
  getAllPlayers() { return world.__players; },
};

// ---- entities / items
export const log = { particles: [], commands: [], damage: [], knock: [], effects: [], teleports: [], actionbar: [], fire: [], heals: [] };
let eid = 100;
export class Dimension {
  constructor() { this.entities = []; this.solid = () => false; }
  getEntities(o = {}) {
    return this.entities.filter((e) => e.__alive && (!o.excludeTypes || !o.excludeTypes.includes(e.typeId)) &&
      (!o.location || Math.hypot(e.location.x - o.location.x, e.location.y - o.location.y, e.location.z - o.location.z) <= (o.maxDistance ?? 1e9)));
  }
  getBlock(l) { const solid = this.solid(l); return { isAir: !solid, isLiquid: false, x: l.x, y: l.y, z: l.z }; }
  spawnParticle(id, loc, vars) { log.particles.push({ id, loc, vars }); }
  runCommand(c) { log.commands.push(c); return { successCount: 1 }; }
}
export class Entity {
  constructor(typeId, loc, dim, hp = 20) {
    this.id = String(eid++); this.typeId = typeId; this.location = { ...loc }; this.dimension = dim; this.__alive = true;
    this.__hp = hp; dim.entities.push(this);
  }
  isValid() { return this.__alive; }
  getComponent(n) {
    if (n === 'minecraft:health') { const s = this; return { get currentValue() { return s.__hp; }, effectiveMax: 20, setCurrentValue(v) { log.heals.push([s.typeId, v]); s.__hp = v; } }; }
    return undefined;
  }
  applyDamage(a, o) { if (!o || !('cause' in o)) throw new Error('cause required'); log.damage.push({ to: this.typeId, a, cause: o.cause, by: o.damagingEntity && o.damagingEntity.typeId }); this.__hp -= a; return true; }
  applyKnockback(x, z, h, v) { log.knock.push({ to: this.typeId, x, z, h, v }); }
  addEffect(id, t, o) { log.effects.push({ to: this.typeId, id, t, o }); }
  setOnFire(s) { log.fire.push({ to: this.typeId, s }); }
  extinguishFire() {}
  getViewDirection() { return this.__view || { x: 0, y: 0, z: 1 }; }
  getHeadLocation() { return { x: this.location.x, y: this.location.y + 1.62, z: this.location.z }; }
  matches(o) { return o.gameMode ? this.__mode === o.gameMode : true; }
  teleport(loc, o) { log.teleports.push({ loc, o }); this.location = { ...loc }; }
}
export class ItemStack {
  constructor(typeId, cdTicks = 100, maxDur = 500) {
    this.typeId = typeId; this.__cd = {}; this.__dur = { damage: 0, maxDurability: maxDur }; this.__cdTicks = cdTicks;
  }
  getComponent(n) {
    const self = this;
    if (n === 'minecraft:cooldown') return {
      cooldownTicks: self.__cdTicks, cooldownCategory: 'x',
      getCooldownTicksRemaining(p) { const e = self.__cd[p.id]; return e ? Math.max(0, e - system.currentTick) : 0; },
      startCooldown(p) { self.__cd[p.id] = system.currentTick + self.__cdTicks; },
    };
    if (n === 'minecraft:durability') return self.__dur;
    return undefined;
  }
}
export class Player extends Entity {
  constructor(loc, dim) {
    super('minecraft:player', loc, dim); this.name = 'Tester'; this.__mode = 'survival'; this.__main = undefined;
    const self = this;
    this.onScreenDisplay = { setActionBar(t) { log.actionbar.push(t); } };
    this.__equip = { getEquipment: () => self.__main, setEquipment: (slot, item) => { self.__main = item; return true; } };
    this.__target = undefined; this.__blockHit = undefined;
  }
  getComponent(n) { return n === 'minecraft:equippable' ? this.__equip : super.getComponent(n); }
  getEntitiesFromViewDirection(o) { return this.__target ? [{ entity: this.__target, distance: 10 }] : []; }
  getBlockFromViewDirection(o) { return this.__blockHit; }
}
