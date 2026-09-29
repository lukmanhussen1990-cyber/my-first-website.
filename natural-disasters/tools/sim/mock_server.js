// Strict headless mock of the @minecraft/server 1.10.0 surface that the add-on uses.
// It is deliberately unforgiving: unknown particle/sound/block ids, NaN vectors, players getting applyImpulse,
// bad damage causes and access to invalid entities all throw or are recorded, so the simulation catches real bugs.

export const CAUSES = ['anvil', 'blockExplosion', 'campfire', 'charging', 'contact', 'drowning', 'entityAttack', 'entityExplosion', 'fall', 'fallingBlock', 'fire', 'fireTick', 'fireworks', 'flyIntoWall', 'freezing', 'lava', 'lightning', 'magic', 'magma', 'none', 'override', 'piston', 'projectile', 'ramAttack', 'selfDestruct', 'sonicBoom', 'soulCampfire', 'stalactite', 'stalagmite', 'starve', 'suffocation', 'suicide', 'temperature', 'thorns', 'wither'];
export const EntityDamageCause = Object.fromEntries(CAUSES.map((c) => [c, c]));
export const WeatherType = { Clear: 'Clear', Rain: 'Rain', Thunder: 'Thunder' };
const EFFECTS = new Set(['slowness', 'weakness', 'nausea', 'slow_falling', 'resistance', 'blindness', 'mining_fatigue', 'poison']);
const ENTITY_TYPES = new Set(['nd:debris', 'nd:lava_bomb', 'nd:meteor', 'minecraft:lightning_bolt', 'minecraft:zombie', 'minecraft:cow', 'minecraft:item']);
const KNOWN_BLOCKS = new Set(['air', 'water', 'flowing_water', 'lava', 'flowing_lava', 'ice', 'snow_layer', 'magma', 'fire', 'stone', 'dirt', 'grass_block', 'sand', 'oak_log', 'oak_leaves', 'tallgrass', 'bedrock']);
const SEA = 62;

export const S = {
  tick: 1000, runId: 0, nextId: 1, timers: new Map(), entities: new Map(), players: [], dyn: new Map(), overrides: new Map(),
  chat: [], weather: 'Clear', weatherUntil: 0, lightning: 0, explosions: [], knownParticles: new Set(), knownSounds: new Set(),
  particles: { total: 0, byName: new Map(), unknown: new Map(), badVars: new Set(), peakTick: 0, cur: 0, curTick: -1 },
  sounds: { total: 0, unknown: new Map() }, blockOps: { total: 0, peakTick: 0, cur: 0, curTick: -1 },
  commands: [], maxKnock: 0, maxImpulse: 0, damage: { player: 0, mob: 0, byCause: new Map() }, deaths: 0, entombed: 0,
  recentSolid: new Map(), fog: new Map(), shakeOn: new Set(), actionBars: 0, events: new Map(), errors: [],
};

// ---- terrain ---------------------------------------------------------------------------------------------------------
const hash = (x, z) => (((x * 73856093) ^ (z * 19349663)) >>> 0);
export function H(x, z) {
  x = Math.floor(x); z = Math.floor(z);
  if (z > 120) return 55;
  return Math.round(64 + 5 * Math.sin(x * 0.04) + 4 * Math.cos(z * 0.05) + 2 * Math.sin((x + z) * 0.13));
}
const isTrunk = (x, z) => hash(x, z) % 89 === 0 && H(x, z) > SEA;
function baseBlock(x, y, z) {
  const h = H(x, z);
  if (y < -60) return 'bedrock';
  if (y <= h - 4) return 'stone';
  if (y < h) return 'dirt';
  if (y === h) return h <= SEA ? 'sand' : 'grass_block';
  if (y <= SEA) return 'water';
  if (isTrunk(x, z) && y <= h + 4) return 'oak_log';
  if (isTrunk(x, z) && y === h + 5) return 'oak_leaves';
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if ((dx || dz) && isTrunk(x + dx, z + dz)) {
        const th = H(x + dx, z + dz);
        if (y >= th + 3 && y <= th + 4) return 'oak_leaves';
      }
    }
  }
  if (y === h + 1 && hash(x, z) % 5 === 0 && h > SEA) return 'tallgrass';
  return 'air';
}
const bkey = (x, y, z) => x + ',' + y + ',' + z;
export function idAt(x, y, z) {
  const o = S.overrides.get(bkey(x, y, z));
  return o !== undefined ? o : baseBlock(x, y, z);
}
function checkLoaded(x, z) {
  if (Math.abs(x) > 300 || Math.abs(z) > 300) throw new Error('LocationInUnloadedChunkError');
}
const isSolidId = (id) => !(id === 'air' || id === 'tallgrass' || id === 'fire' || id === 'snow_layer' || id === 'lava' || id === 'flowing_lava');
const isLiquidId = (id) => id === 'water' || id === 'flowing_water' || id === 'lava' || id === 'flowing_lava';

// ---- blocks ----------------------------------------------------------------------------------------------------------
export class BlockPermutation {
  constructor(id) { this._id = id; }
  static resolve(id, states) {
    const n = id.startsWith('minecraft:') ? id.slice(10) : id;
    if (!KNOWN_BLOCKS.has(n)) throw new Error('Unknown block type ' + id);
    return new BlockPermutation(n);
  }
  getItemStack() { return (this._id === 'air' || isLiquidId(this._id) || this._id === 'fire') ? undefined : { typeId: 'minecraft:' + this._id }; }
  matches(name) { return name === 'minecraft:' + this._id; }
  getState() { return undefined; }
}
class Block {
  constructor(dim, x, y, z) { this.dimension = dim; this.x = x; this.y = y; this.z = z; }
  get _id() { return idAt(this.x, this.y, this.z); }
  get isAir() { return this._id === 'air'; }
  get isLiquid() { return isLiquidId(this._id); }
  get permutation() { return new BlockPermutation(this._id); }
  get location() { return { x: this.x, y: this.y, z: this.z }; }
  setPermutation(p) {
    if (!(p instanceof BlockPermutation)) throw new Error('bad permutation');
    const k = bkey(this.x, this.y, this.z);
    if (isSolidId(p._id) && !isSolidId(this._id)) S.recentSolid.set(k, S.tick);
    if (p._id === baseBlock(this.x, this.y, this.z)) S.overrides.delete(k); else S.overrides.set(k, p._id);
    const b = S.blockOps;
    if (b.curTick !== S.tick) { b.peakTick = Math.max(b.peakTick, b.cur); b.cur = 0; b.curTick = S.tick; }
    b.cur++; b.total++;
  }
}

// ---- molang / particles --------------------------------------------------------------------------------------------------
export class MolangVariableMap {
  constructor() { this.vars = {}; }
  _n(name) { if (!/^variable\.[a-z_]+$/.test(name)) throw new Error('bad molang variable ' + name); }
  setFloat(n, v) { this._n(n); if (!Number.isFinite(v)) throw new Error('NaN molang ' + n); this.vars[n] = v; }
  setVector3(n, v) { this._n(n); for (const k of ['x', 'y', 'z']) if (!Number.isFinite(v[k])) throw new Error('NaN molang vec ' + n); this.vars[n] = v; }
  setColorRGB(n, c) { this._n(n); this.vars[n] = c; }
}

// ---- entities --------------------------------------------------------------------------------------------------------------
const finite = (v, what) => { if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) throw new Error('non-finite vector for ' + what); };

export class Entity {
  constructor(typeId, loc, dim) {
    finite(loc, 'spawn');
    this.id = String(S.nextId++); this.typeId = typeId; this._loc = { x: loc.x, y: loc.y, z: loc.z }; this.dimension = dim;
    this.tags = new Set(); this.vel = { x: 0, y: 0, z: 0 }; this.removed = false; this.effects = new Map(); this.health = 20;
    this.fire = 0; this.peakY = loc.y; this.airborne = false; this.born = S.tick; this.mob = true;
    S.entities.set(this.id, this);
  }
  _chk() { if (this.removed) throw new Error('Entity ' + this.id + ' is invalid'); }
  get location() { this._chk(); return { ...this._loc }; }
  get isOnGround() { this._chk(); return !this.airborne; }
  get isSneaking() { return false; }
  isValid() { return !this.removed; }
  remove() { this._chk(); this.removed = true; S.entities.delete(this.id); }
  kill() { this._chk(); this.removed = true; S.entities.delete(this.id); return true; }
  teleport(loc) { this._chk(); finite(loc, 'teleport'); this._loc = { x: loc.x, y: loc.y, z: loc.z }; this.vel = { x: 0, y: 0, z: 0 }; this.peakY = loc.y; }
  getVelocity() { this._chk(); return { ...this.vel }; }
  clearVelocity() { this._chk(); this.vel = { x: 0, y: 0, z: 0 }; }
  applyImpulse(v) {
    this._chk(); finite(v, 'impulse');
    if (this.typeId === 'minecraft:player') throw new Error('applyImpulse is not supported for players');
    const m = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
    S.maxImpulse = Math.max(S.maxImpulse, m);
    this.vel.x += v.x; this.vel.y += v.y; this.vel.z += v.z;
  }
  applyKnockback(dx, dz, h, v) {
    this._chk();
    if (![dx, dz, h, v].every(Number.isFinite)) throw new Error('non-finite knockback');
    S.maxKnock = Math.max(S.maxKnock, Math.abs(h));
    this.vel.x += dx * h * 0.6; this.vel.z += dz * h * 0.6; this.vel.y += v * 0.5;
  }
  addEffect(type, dur, opts) {
    this._chk();
    if (!EFFECTS.has(type)) throw new Error('unknown effect ' + type);
    if (!Number.isFinite(dur) || dur < 0 || !Number.isInteger(dur)) throw new Error('bad effect duration ' + dur);
    if (opts && opts.amplifier !== undefined && (opts.amplifier < 0 || opts.amplifier > 255)) throw new Error('bad amplifier');
    this.effects.set(type, { duration: dur, amplifier: (opts && opts.amplifier) || 0 });
    return {};
  }
  getEffect(type) { this._chk(); return this.effects.has(type) ? { typeId: type, duration: this.effects.get(type).duration } : undefined; }
  removeEffect(type) { this._chk(); return this.effects.delete(type); }
  setOnFire(sec) { this._chk(); if (!(sec > 0 && sec <= 2 ** 31)) throw new Error('bad fire seconds'); this.fire = Math.max(this.fire, Math.round(sec * 20)); return true; }
  addTag(t) { this._chk(); this.tags.add(t); return true; }
  removeTag(t) { this._chk(); return this.tags.delete(t); }
  hasTag(t) { this._chk(); return this.tags.has(t); }
  getTags() { this._chk(); return [...this.tags]; }
  getComponent(id) {
    this._chk();
    if (id === 'minecraft:health') { const self = this; return { get currentValue() { return self.health; }, effectiveMax: 20, setCurrentValue(v) { self.health = v; } }; }
    return undefined;
  }
  runCommand() { this._chk(); return { successCount: 1 }; }
  applyDamage(amount, opts) {
    this._chk();
    if (!(amount > 0) || !Number.isFinite(amount)) throw new Error('bad damage ' + amount);
    if (!opts || !CAUSES.includes(opts.cause)) throw new Error('bad damage cause ' + (opts && opts.cause));
    this._damage(amount, opts.cause);
    return true;
  }
  _damage(amount, cause) {
    if (this.typeId.startsWith('nd:')) return;
    const kind = this.typeId === 'minecraft:player' ? 'player' : 'mob';
    if (cause === 'fall' && S.debugFall) S.debugFall.push({ t: S.tick, type: this.typeId, id: this.id, amount, fx: [...this.effects.entries()].map(([k, v]) => k + ':' + v.duration + '/' + v.amplifier).join(','), y: this._loc.y });
    if (this.effects.has('resistance') && this.effects.get('resistance').amplifier >= 4) return;
    S.damage[kind] += amount;
    S.damage.byCause.set(cause, (S.damage.byCause.get(cause) || 0) + amount);
    this.health -= amount;
    if (this.health <= 0) {
      S.deaths++;
      if (this.typeId === 'minecraft:player') { this.health = 20; this.vel = { x: 0, y: 0, z: 0 }; } else { this.removed = true; S.entities.delete(this.id); }
    }
  }
}

export class Player extends Entity {
  constructor(name, loc, dim, yaw) {
    super('minecraft:player', loc, dim);
    this.name = name; this.mob = false; this.yaw = yaw || 0; this.pitch = 0;
    this.onScreenDisplay = { setActionBar: (t) => { if (typeof t !== 'string') throw new Error('bad actionbar'); S.actionBars++; } };
    this.messages = [];
  }
  getViewDirection() { this._chk(); const cp = Math.cos(this.pitch); return { x: Math.cos(this.yaw) * cp, y: Math.sin(this.pitch), z: Math.sin(this.yaw) * cp }; }
  getBlockFromViewDirection(opts) {
    this._chk();
    const d = this.getViewDirection();
    return this.dimension.getBlockFromRay({ x: this._loc.x, y: this._loc.y + 1.62, z: this._loc.z }, d, { maxDistance: (opts && opts.maxDistance) || 8, includeLiquidBlocks: !!(opts && opts.includeLiquidBlocks) });
  }
  playSound(id, opts) {
    this._chk();
    if (typeof id !== 'string') throw new Error('bad sound id');
    if (opts && opts.location) finite(opts.location, 'sound location');
    if (opts && opts.volume !== undefined && !(opts.volume >= 0)) throw new Error('bad volume');
    if (opts && opts.pitch !== undefined && !(opts.pitch > 0)) throw new Error('bad pitch');
    S.sounds.total++;
    if (S.knownSounds.size && !S.knownSounds.has(id)) S.sounds.unknown.set(id, (S.sounds.unknown.get(id) || 0) + 1);
  }
  sendMessage(m) { this._chk(); this.messages.push(String(m)); }
  runCommand(cmd) {
    this._chk();
    S.commands.push(cmd);
    let m;
    if ((m = /^fog @s push (nd:[a-z_]+) (nd_[a-z_]+)$/.exec(cmd))) { if (!S.knownFogs || !S.knownFogs.has(m[1])) throw new Error('unknown fog ' + m[1]); const s = S.fog.get(this.id) || new Set(); s.add(m[2]); S.fog.set(this.id, s); }
    else if ((m = /^fog @s remove (nd_[a-z_]+)$/.exec(cmd))) { const s = S.fog.get(this.id); if (s) s.delete(m[1]); }
    else if ((m = /^camerashake add @s ([0-9.]+) ([0-9.]+) positional$/.exec(cmd))) { const i = Number(m[1]); if (!(i > 0 && i <= 4)) throw new Error('bad shake intensity'); S.shakeOn.add(this.id); }
    else if (/^camerashake stop @s$/.test(cmd)) S.shakeOn.delete(this.id);
    else throw new Error('unexpected command: ' + cmd);
    return { successCount: 1 };
  }
}

// ---- dimension ---------------------------------------------------------------------------------------------------------------
class Dimension {
  constructor(name) { this.id = 'minecraft:' + name; this.name = name; }
  getBlock(loc) {
    finite(loc, 'getBlock'); checkLoaded(loc.x, loc.z);
    return new Block(this, Math.floor(loc.x), Math.floor(loc.y), Math.floor(loc.z));
  }
  getBlockFromRay(from, dir, opts) {
    finite(from, 'ray'); finite(dir, 'ray dir');
    const max = (opts && opts.maxDistance) || 16;
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z) || 1;
    for (let t = 0; t <= max; t += 0.5) {
      const x = from.x + (dir.x / len) * t, y = from.y + (dir.y / len) * t, z = from.z + (dir.z / len) * t;
      try { checkLoaded(x, z); } catch (e) { return undefined; }
      const id = idAt(Math.floor(x), Math.floor(y), Math.floor(z));
      const liquid = isLiquidId(id);
      if (id === 'air' || id === 'tallgrass' || id === 'fire' || id === 'snow_layer') continue;
      if (liquid && !(opts && opts.includeLiquidBlocks)) continue;
      return { block: new Block(this, Math.floor(x), Math.floor(y), Math.floor(z)), face: 'Up', faceLocation: { x: 0.5, y: 1, z: 0.5 } };
    }
    return undefined;
  }
  getEntities(o) {
    const opt = o || {};
    let list = [...S.entities.values()].filter((e) => !e.removed && e.dimension === this);
    if (opt.location && opt.maxDistance !== undefined) {
      finite(opt.location, 'getEntities'); const r2 = opt.maxDistance * opt.maxDistance, l = opt.location;
      list = list.filter((e) => { const dx = e._loc.x - l.x, dy = e._loc.y - l.y, dz = e._loc.z - l.z; return dx * dx + dy * dy + dz * dz <= r2; });
    }
    if (opt.excludeTypes) list = list.filter((e) => !opt.excludeTypes.includes(e.typeId));
    if (opt.excludeTags) list = list.filter((e) => !opt.excludeTags.some((t) => e.tags.has(t)));
    if (opt.tags) list = list.filter((e) => opt.tags.every((t) => e.tags.has(t)));
    if (opt.type) list = list.filter((e) => e.typeId === opt.type);
    if (opt.closest && opt.location) {
      const l = opt.location;
      list.sort((a, b) => (Math.hypot(a._loc.x - l.x, a._loc.y - l.y, a._loc.z - l.z)) - (Math.hypot(b._loc.x - l.x, b._loc.y - l.y, b._loc.z - l.z)));
      list = list.slice(0, opt.closest);
    }
    return list;
  }
  getPlayers() { return S.players.filter((p) => !p.removed && p.dimension === this); }
  spawnEntity(type, loc) {
    if (!ENTITY_TYPES.has(type)) throw new Error('unknown entity type ' + type);
    finite(loc, 'spawnEntity'); checkLoaded(loc.x, loc.z);
    const e = new Entity(type, loc, this);
    if (type === 'minecraft:lightning_bolt') S.lightning++;
    return e;
  }
  spawnParticle(name, loc, vars) {
    if (typeof name !== 'string') throw new Error('bad particle name');
    finite(loc, 'spawnParticle');
    if (vars !== undefined && !(vars instanceof MolangVariableMap)) throw new Error('particle vars must be a MolangVariableMap');
    const P = S.particles;
    if (P.curTick !== S.tick) { P.peakTick = Math.max(P.peakTick, P.cur); P.cur = 0; P.curTick = S.tick; }
    P.cur++; P.total++;
    if (process.env.DEBUG_PART && P.cur === Number(process.env.DEBUG_PART) && !P.dbg) { P.dbg = true; console.log('particle burst tick', S.tick, new Error().stack.split('\n').slice(2, 7).join('\n')); }
    P.byName.set(name, (P.byName.get(name) || 0) + 1);
    if (S.knownParticles.size && !S.knownParticles.has(name)) P.unknown.set(name, (P.unknown.get(name) || 0) + 1);
    if (vars) for (const k of Object.keys(vars.vars)) if (!['variable.size', 'variable.life', 'variable.vel'].includes(k)) P.badVars.add(k);
  }
  setWeather(type, duration) {
    if (!(type in WeatherType)) throw new Error('bad weather ' + type);
    if (duration !== undefined && !(duration >= 1 && duration <= 1000000)) throw new Error('bad weather duration ' + duration);
    S.weather = type; S.weatherUntil = S.tick + (duration || 6000);
  }
  createExplosion(loc, radius, opts) {
    finite(loc, 'explosion');
    if (!(radius > 0 && radius <= 100)) throw new Error('bad explosion radius');
    S.explosions.push({ loc, radius, breaks: !!(opts && opts.breaksBlocks) });
    if (opts && opts.breaksBlocks) {
      const r = Math.ceil(radius);
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
        const x = Math.floor(loc.x) + dx, y = Math.floor(loc.y) + dy, z = Math.floor(loc.z) + dz;
        const id = idAt(x, y, z);
        if (id !== 'air' && id !== 'bedrock') S.overrides.set(bkey(x, y, z), 'air');
      }
    }
    for (const e of this.getEntities({ location: loc, maxDistance: radius })) if (!e.removed) e._damage(Math.max(1, radius - Math.hypot(e._loc.x - loc.x, e._loc.z - loc.z)), 'entityExplosion');
    return true;
  }
  runCommand(cmd) { S.commands.push(cmd); return { successCount: 1 }; }
}
const DIMS = { overworld: new Dimension('overworld'), nether: new Dimension('nether'), the_end: new Dimension('the_end') };
export const overworld = DIMS.overworld;

// ---- events / world / system --------------------------------------------------------------------------------------------
class Signal {
  constructor(name) { this.name = name; this.subs = []; }
  subscribe(cb, opts) { this.subs.push({ cb, opts }); return cb; }
  unsubscribe(cb) { this.subs = this.subs.filter((s) => s.cb !== cb); }
  emit(ev) { for (const s of this.subs.slice()) s.cb(ev); }
}
const SIG = {
  itemUse: new Signal('itemUse'), itemUseOn: new Signal('itemUseOn'), playerSpawn: new Signal('playerSpawn'),
  playerLeave: new Signal('playerLeave'), worldInitialize: new Signal('worldInitialize'), scriptEventReceive: new Signal('scriptEventReceive'),
};
export const world = {
  afterEvents: { itemUse: SIG.itemUse, itemUseOn: SIG.itemUseOn, playerSpawn: SIG.playerSpawn, playerLeave: SIG.playerLeave, worldInitialize: SIG.worldInitialize },
  getAllPlayers() { return S.players.filter((p) => !p.removed); },
  getDimension(n) { const d = DIMS[n]; if (!d) throw new Error('unknown dimension ' + n); return d; },
  sendMessage(m) { S.chat.push(String(m)); },
  getDynamicProperty(k) { return S.dyn.get(k); },
  setDynamicProperty(k, v) {
    if (v === undefined) { S.dyn.delete(k); return; }
    if (!['string', 'number', 'boolean'].includes(typeof v)) throw new Error('bad dynamic property type');
    if (typeof v === 'string' && v.length > 32767) throw new Error('dynamic property too long: ' + v.length);
    S.dyn.set(k, v);
  },
};
export const system = {
  get currentTick() { return S.tick; },
  runInterval(fn, n) { const id = ++S.runId; const e = Math.max(1, n || 1); S.timers.set(id, { fn, every: e, next: S.tick + e, repeat: true }); return id; },
  runTimeout(fn, n) { const id = ++S.runId; S.timers.set(id, { fn, every: 0, next: S.tick + Math.max(1, n || 1), repeat: false }); return id; },
  run(fn) { return system.runTimeout(fn, 1); },
  clearRun(id) { S.timers.delete(id); },
  afterEvents: { scriptEventReceive: SIG.scriptEventReceive },
};

// ---- harness controls --------------------------------------------------------------------------------------------------
export const sim = {
  S, SIG,
  freeSpot(x, z) {
    for (let i = 0; i < 30; i++) {
      const ok = [0, 1, 2].every((dy) => { const id = idAt(Math.floor(x + i), H(x + i, z) + 1 + dy, Math.floor(z)); return id === 'air' || id === 'tallgrass'; });
      if (ok) return { x: x + i, z };
    }
    return { x, z };
  },
  spawnPlayer(name, x, z, yaw) { const f = sim.freeSpot(x, z); const p = new Player(name, { x: f.x, y: H(f.x, f.z) + 1, z: f.z }, DIMS.overworld, yaw); S.players.push(p); return p; },
  spawnMob(type, x, z) { const f = sim.freeSpot(x, z); return new Entity(type, { x: f.x, y: H(f.x, f.z) + 1, z: f.z }, DIMS.overworld); },
  emit(name, ev) { SIG[name].emit(ev); },
  resetTimers() { S.timers.clear(); for (const s of Object.values(SIG)) s.subs = []; },
  step(n = 1) {
    for (let i = 0; i < n; i++) {
      S.tick++;
      const due = [...S.timers.entries()].filter(([, t]) => t.next <= S.tick);
      for (const [id, t] of due) {
        if (!S.timers.has(id)) continue;
        if (t.repeat) t.next = S.tick + t.every; else S.timers.delete(id);
        try { t.fn(); } catch (e) { S.errors.push('timer threw: ' + (e && e.stack || e)); }
      }
      if (S.weather !== 'Clear' && S.tick >= S.weatherUntil) S.weather = 'Clear';
      physics();
    }
  },
};

function groundBelow(x, y, z) {
  const fx = Math.floor(x), fz = Math.floor(z);
  for (let yy = Math.floor(y + 0.5); yy > y - 60; yy--) {
    const id = idAt(fx, yy, fz);
    if (isSolidId(id) && !(id === 'lava')) return { y: yy + 1, water: id === 'water' || id === 'flowing_water' };
  }
  return { y: -60, water: false };
}

function physics() {
  for (const e of [...S.entities.values()]) {
    if (e.removed) continue;
    if (e.typeId === 'minecraft:lightning_bolt') { if (S.tick - e.born > 20) { e.removed = true; S.entities.delete(e.id); } continue; }
    for (const [k, v] of e.effects) { v.duration--; if (v.duration <= 0) e.effects.delete(k); }
    if (e.fire > 0) { e.fire--; if (e.fire % 20 === 0) e._damage(1, 'fireTick'); }
    if (e.removed) continue;
    const noGrav = e.typeId === 'nd:meteor';
    const l = e._loc;
    if (!noGrav) e.vel.y -= 0.08;
    const drag = e.airborne ? 0.91 : 0.6;
    e.vel.x *= drag; e.vel.z *= drag; e.vel.y *= 0.98;
    const slow = e.effects.has('slow_falling') ? 0.2 : 1;
    if (e.vel.y < 0) e.vel.y = Math.max(e.vel.y, -3.9 * slow);
    if (e.typeId !== 'minecraft:player' && e.typeId !== 'minecraft:zombie' && e.typeId !== 'minecraft:cow' && e.typeId !== 'minecraft:item' && !noGrav) { /* props fly freely */ }
    l.x += e.vel.x; l.y += e.vel.y; l.z += e.vel.z;
    if (Math.abs(l.x) > 290 || Math.abs(l.z) > 290) { l.x = Math.max(-290, Math.min(290, l.x)); l.z = Math.max(-290, Math.min(290, l.z)); }
    if (noGrav) continue;
    const g = groundBelow(l.x, l.y, l.z);
    const feet = idAt(Math.floor(l.x), Math.floor(l.y + 0.1), Math.floor(l.z));
    if (isSolidId(feet) && feet !== 'water' && feet !== 'flowing_water' && l.y < g.y - 0.2) {
      const rt = S.recentSolid.get(bkey(Math.floor(l.x), Math.floor(l.y + 0.1), Math.floor(l.z)));
      if (rt !== undefined && S.tick - rt < 40) S.entombed++;
    }
    if (l.y <= g.y) {
      const drop = e.peakY - g.y;
      if (e.airborne && drop > 3 && !g.water && !e.effects.has('slow_falling') && e.mob !== undefined) e._damage(Math.floor(drop - 3), 'fall');
      l.y = g.y; e.vel.y = 0; e.airborne = false; e.peakY = g.y;
    } else {
      if (!e.airborne) { e.airborne = true; e.peakY = l.y; }
      e.peakY = Math.max(e.peakY, l.y);
    }
  }
}
