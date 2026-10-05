// Shared helpers for Magical Weapons. Uses only stable @minecraft/server 1.11.0 APIs.
import { EquipmentSlot, GameMode, MolangVariableMap, system } from '@minecraft/server';

// ---------------------------------------------------------------- vectors
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a) => Math.sqrt(dot(a, a));
export const dist = (a, b) => len(sub(a, b));
export const norm = (a) => {
  const l = len(a);
  return l > 1e-6 ? mul(a, 1 / l) : { x: 0, y: 0, z: 0 };
};
export const flat = (a) => norm({ x: a.x, y: 0, z: a.z });
export const rightOf = (dir) => norm({ x: -dir.z, y: 0, z: dir.x });   // player's right for a horizontal forward vector
export const lerpV = (a, b, t) => add(mul(a, 1 - t), mul(b, t));
export const rand = (min, max) => min + Math.random() * (max - min);

/** Rotate a horizontal-ish direction around the Y axis by `deg` degrees. */
export function yawRotate(dir, deg) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: dir.x * c - dir.z * s, y: dir.y, z: dir.x * s + dir.z * c };
}

// ---------------------------------------------------------------- safety
export function valid(e) {
  try {
    return !!e && e.isValid();
  } catch (err) {
    return false;
  }
}

export function safe(fn, label) {
  try {
    return fn();
  } catch (err) {
    console.warn(`[MagicalWeapons] ${label || 'error'}: ${err}`);
    return undefined;
  }
}

// ---------------------------------------------------------------- entity helpers
export const SKIP_TYPES = [
  'minecraft:item', 'minecraft:xp_orb', 'minecraft:armor_stand', 'minecraft:arrow', 'minecraft:thrown_trident',
  'minecraft:snowball', 'minecraft:egg', 'minecraft:fishing_hook', 'minecraft:painting', 'minecraft:boat',
  'minecraft:chest_boat', 'minecraft:minecart', 'minecraft:chest_minecart', 'minecraft:tnt', 'minecraft:tnt_minecart',
  'minecraft:falling_block', 'minecraft:fireball', 'minecraft:small_fireball', 'minecraft:lightning_bolt',
  'minecraft:ender_pearl', 'minecraft:xp_bottle', 'minecraft:fireworks_rocket', 'minecraft:area_effect_cloud',
  'minecraft:wind_charge_projectile', 'minecraft:breeze_wind_charge_projectile', 'minecraft:ender_crystal',
  'minecraft:villager', 'minecraft:villager_v2', 'minecraft:wandering_trader', 'minecraft:iron_golem',
  'minecraft:snow_golem', 'minecraft:npc', 'minecraft:agent',
];

export function head(e) {
  try {
    return e.getHeadLocation();
  } catch (err) {
    return { x: e.location.x, y: e.location.y + 1.6, z: e.location.z };
  }
}

export function center(e) {
  const l = e.location;
  return { x: l.x, y: l.y + 0.9, z: l.z };
}

export function aim(player) {
  return norm(player.getViewDirection());
}

export function hasHealth(e) {
  try {
    return !!e.getComponent('minecraft:health');
  } catch (err) {
    return false;
  }
}

/** Living entities around a point (excludes items, projectiles, villagers, golems and anything in `except`). */
export function livingNear(dim, loc, radius, except = []) {
  let list = [];
  try {
    list = dim.getEntities({ location: loc, maxDistance: radius, excludeTypes: SKIP_TYPES });
  } catch (err) {
    return [];
  }
  return list.filter((e) => valid(e) && !except.includes(e) && hasHealth(e));
}

export function hurt(target, amount, source, cause = 'magic') {
  if (!valid(target)) return false;
  try {
    target.applyDamage(amount, { cause, damagingEntity: source });
    return true;
  } catch (err) {
    return false;
  }
}

/** Knock `target` along the horizontal direction `dir`. */
export function push(target, dir, strength, vertical) {
  try {
    target.applyKnockback(dir.x, dir.z, strength, vertical);
  } catch (err) { /* entity may be immune or gone */ }
}

export function effect(target, id, ticks, amp = 0) {
  try {
    target.addEffect(id, ticks, { amplifier: amp, showParticles: true });
  } catch (err) { /* ignore */ }
}

export function heal(entity, amount) {
  try {
    const h = entity.getComponent('minecraft:health');
    if (h) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + amount));
  } catch (err) { /* ignore */ }
}

export function ignite(target, seconds) {
  try {
    target.setOnFire(seconds, true);
  } catch (err) { /* ignore */ }
}

// ---------------------------------------------------------------- world helpers
export function passable(dim, loc) {
  try {
    const b = dim.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });
    return !b || b.isAir;
  } catch (err) {
    return true;
  }
}

/** First hit point along the player's view: entity, block or max range. */
export function aimPoint(player, maxDistance) {
  const origin = head(player);
  const dir = aim(player);
  let best = { dist: maxDistance, entity: undefined };
  safe(() => {
    const hits = player.getEntitiesFromViewDirection({ maxDistance, excludeTypes: SKIP_TYPES });
    for (const h of hits) {
      if (h.entity !== player && hasHealth(h.entity) && h.distance < best.dist) {
        best = { dist: h.distance, entity: h.entity };
        break;
      }
    }
  }, 'raycast entities');
  const blockHit = safe(() => player.getBlockFromViewDirection({ maxDistance, includeLiquidBlocks: false }), 'raycast block');
  let point = add(origin, mul(dir, best.dist));
  if (blockHit && blockHit.block) {
    const b = blockHit.block;
    const bp = { x: b.x + 0.5, y: b.y + 1.0, z: b.z + 0.5 };
    const bd = dist(origin, bp);
    if (!best.entity || bd < best.dist) {
      best = { dist: bd, entity: undefined };
      point = bp;
    }
  }
  if (best.entity) point = center(best.entity);
  return { point, entity: best.entity, dist: best.dist, origin, dir };
}

// ---------------------------------------------------------------- effects
export const COLORS = {
  fire: { red: 1.0, green: 0.52, blue: 0.1 },
  ember: { red: 1.0, green: 0.8, blue: 0.3 },
  ice: { red: 0.55, green: 0.85, blue: 1.0 },
  frost: { red: 0.9, green: 0.98, blue: 1.0 },
  storm: { red: 0.6, green: 0.78, blue: 1.0 },
  bolt: { red: 0.92, green: 0.96, blue: 1.0 },
  arcane: { red: 0.72, green: 0.42, blue: 1.0 },
  lilac: { red: 0.86, green: 0.7, blue: 1.0 },
  shadow: { red: 0.52, green: 0.2, blue: 0.9 },
  dust: { red: 0.55, green: 0.45, blue: 0.33 },
  amber: { red: 1.0, green: 0.7, blue: 0.2 },
  soul: { red: 0.3, green: 1.0, blue: 0.6 },
};

/** A tinted, drifting spark (vanilla glow_particle accepts variable.color + variable.direction). */
export function spark(dim, loc, color, dir = { x: 0, y: 0.4, z: 0 }, id = 'minecraft:glow_particle') {
  try {
    const m = new MolangVariableMap();
    m.setColorRGB('variable.color', color);
    m.setVector3('variable.direction', dir);
    dim.spawnParticle(id, loc, m);
  } catch (err) { /* unloaded chunk etc. */ }
}

export function puff(dim, id, loc) {
  try {
    dim.spawnParticle(id, loc);
  } catch (err) { /* ignore */ }
}

export function burst(dim, loc, color, count = 10, speed = 1.0, id = 'minecraft:glow_particle') {
  for (let i = 0; i < count; i++) {
    const d = norm({ x: rand(-1, 1), y: rand(-0.3, 1), z: rand(-1, 1) });
    spark(dim, loc, color, mul(d, speed * rand(0.6, 1.2)), id);
  }
}

export function sfx(dim, sound, loc, volume = 1.0, pitch = 1.0) {
  try {
    dim.runCommand(`playsound ${sound} @a ${loc.x.toFixed(2)} ${loc.y.toFixed(2)} ${loc.z.toFixed(2)} ${volume} ${pitch}`);
  } catch (err) { /* ignore */ }
}

// ---------------------------------------------------------------- held item helpers
export function heldItem(player) {
  try {
    const eq = player.getComponent('minecraft:equippable');
    return eq ? eq.getEquipment(EquipmentSlot.Mainhand) : undefined;
  } catch (err) {
    return undefined;
  }
}

export function isCreative(player) {
  try {
    return player.matches({ gameMode: GameMode.creative });
  } catch (err) {
    return false;
  }
}

/** Wear down the main-hand weapon (spells cost durability in survival). */
export function wear(player, typeId, amount) {
  if (isCreative(player)) return;
  safe(() => {
    const eq = player.getComponent('minecraft:equippable');
    const item = eq.getEquipment(EquipmentSlot.Mainhand);
    if (!item || item.typeId !== typeId) return;
    const dur = item.getComponent('minecraft:durability');
    if (!dur) return;
    dur.damage = Math.min(dur.maxDurability, dur.damage + amount);
    if (dur.damage >= dur.maxDurability) {
      eq.setEquipment(EquipmentSlot.Mainhand, undefined);
      sfx(player.dimension, 'random.break', player.location, 1.0, 1.0);
    } else {
      eq.setEquipment(EquipmentSlot.Mainhand, item);
    }
  }, 'wear item');
}

export function actionBar(player, text) {
  safe(() => player.onScreenDisplay.setActionBar(text), 'action bar');
}

export const later = (fn, ticks) => system.runTimeout(fn, Math.max(1, ticks));
