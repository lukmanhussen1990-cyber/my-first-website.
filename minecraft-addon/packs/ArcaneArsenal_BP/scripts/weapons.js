// Arcane Arsenal - magic weapons: spells (use), on-hit powers and passives.
import { BlockPermutation, EquipmentSlot, system } from "@minecraft/server";
import {
  V, addEffect, alive, blockIs, bystanderNear, distToSegment, handPoint, hasFamily, heal, hitPoint, hostilesNear,
  hurt, inventory, isFriendly, isLiving, keepEffect, knockAway, logError, mainhand, offhand,
} from "./util.js";
import { actionbar, arc, later, line, particle, privateSound, ring, shake, sound } from "./fx.js";
import { setting } from "./config.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").ItemStack} ItemStack */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/**
 * @typedef {object} Weapon
 * @property {string} name
 * @property {string} color
 * @property {string} spell
 * @property {string} element
 * @property {string[]} lore
 * @property {(p: Player) => boolean | void} cast   return false = nothing happened, no cooldown
 * @property {(p: Player, target: Entity) => void} [hit]
 * @property {(p: Player, tick: number) => void} [passive]   called every 10 ticks while held
 * @property {(p: Player) => void} [fast]                    called every 3 ticks while held
 */

/** Must match "minecraft:cooldown" durations in the item files (seconds * 20). @type {Record<string, number>} */
export const COOLDOWN_TICKS = {
  "arcane:frostbite_blade": 120,
  "arcane:inferno_sword": 100,
  "arcane:venom_fang": 160,
  "arcane:storm_hammer": 160,
  "arcane:shadow_reaper": 100,
  "arcane:arcane_staff": 25,
  "arcane:tempest_blade": 140,
  "arcane:celestial_godslayer": 200,
  "arcane:radiant_torch": 8,
};

const T1 = "§7Tier I §8- §bEnchanted";
const T2 = "§7Tier II §8- §dLegendary";
const T3 = "§7Tier III §8- §6§lMythic";

// ------------------------------------------------------------------ helpers
let airPerm;
/** Remove fire started by our lightning so it can't burn down builds. @param {Dimension} dim @param {Vector3} at */
function clearFire(dim, at, r = 2) {
  try {
    airPerm = airPerm || BlockPermutation.resolve("minecraft:air");
  } catch {
    return;
  }
  const c = V.floor(at);
  for (let x = -r; x <= r; x++) {
    for (let y = -1; y <= 2; y++) {
      for (let z = -r; z <= r; z++) {
        try {
          const b = dim.getBlock({ x: c.x + x, y: c.y + y, z: c.z + z });
          if (b && blockIs(b, "minecraft:fire")) b.setPermutation(airPerm);
        } catch {
          // unloaded
        }
      }
    }
  }
}

/** Fake lightning made of sparks (used near villagers, pets or the caster). @param {Dimension} dim @param {Vector3} at */
function sparkBolt(dim, at) {
  let p = V.up(at, 14);
  for (let i = 0; i < 7; i++) {
    const n = { x: at.x + (Math.random() - 0.5) * 1.2, y: at.y + 14 - (i + 1) * 2, z: at.z + (Math.random() - 0.5) * 1.2 };
    arc(dim, p, i === 6 ? at : n);
    p = n;
  }
  particle(dim, "arcane:storm_burst", V.up(at, 0.5));
  sound("ambient.weather.lightning.impact", at, 0.9, 1.1);
}

/** @param {Dimension} dim @param {Vector3} at */
function strikeLightning(dim, at) {
  try {
    dim.spawnEntity("minecraft:lightning_bolt", at);
  } catch {
    sparkBolt(dim, at);
    return;
  }
  later(10, () => clearFire(dim, at));
  later(40, () => clearFire(dim, at));
}

/** Where the player is aiming: nearest mob or block within range. @param {Player} player */
function lookTarget(player, range) {
  const head = player.getHeadLocation();
  /** @type {{ point: Vector3, distance: number, entity?: Entity }} */
  let best = { point: V.add(head, V.scale(player.getViewDirection(), range * 0.6)), distance: Infinity };
  try {
    const hits = player.getEntitiesFromViewDirection({ maxDistance: range }).sort((a, b) => a.distance - b.distance);
    for (const h of hits) {
      if (h.entity.id === player.id || !alive(h.entity) || !isLiving(h.entity) || isFriendly(h.entity)) continue;
      best = { point: h.entity.location, distance: h.distance, entity: h.entity };
      break;
    }
  } catch {
    // ignore
  }
  try {
    const bh = player.getBlockFromViewDirection({ maxDistance: range, includeLiquidBlocks: true, includePassableBlocks: false });
    if (bh) {
      const p = hitPoint(bh);
      const d = V.dist(head, p);
      if (d < best.distance) best = { point: p, distance: d };
    }
  } catch {
    // ignore
  }
  if (best.distance === Infinity) {
    try {
      const down = player.dimension.getBlockFromRay(best.point, { x: 0, y: -1, z: 0 },
        { maxDistance: 48, includeLiquidBlocks: true, includePassableBlocks: false });
      if (down) best = { point: hitPoint(down), distance: V.dist(head, hitPoint(down)) };
    } catch {
      // ignore
    }
  }
  return best;
}

/** Sparkles around the body - kept below eye level so they never cover the first-person view.
 * @param {Dimension} dim @param {Vector3} at @param {string} id @param {number} count */
function aroundBody(dim, at, id, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.6 + Math.random() * 0.3;
    particle(dim, id, { x: at.x + Math.cos(a) * r, y: at.y + 0.1 + Math.random() * 0.9, z: at.z + Math.sin(a) * r });
  }
}

// ------------------------------------------------------------------ Tier I
/** @param {Player} player */
function frostNova(player) {
  const dim = player.dimension;
  const c = player.location;
  particle(dim, "arcane:frost_rune", V.up(c, 0.05));
  particle(dim, "arcane:frost_shards", V.up(c, 1.2));
  sound("random.glass", c, 1, 1.25);
  sound("random.glass", c, 0.7, 0.7);
  for (let s = 1; s <= 6; s++) {
    later(s, () => ring(dim, V.up(c, 0.25), s * 1.15, "arcane:frost_mote", 6 + s * 3, s * 0.4));
  }
  for (const e of hostilesNear(dim, c, 7)) {
    later(Math.max(1, Math.round(V.dist(e.location, c) / 1.15)), () => {
      if (!alive(e)) return;
      hurt(e, 6, player);
      addEffect(e, "slowness", 100, 3);
      addEffect(e, "weakness", 100, 0);
      particle(dim, "arcane:frost_shards", V.up(e.location, 1));
    });
  }
}

/** @param {Player} player @param {Entity} target */
function frostHit(player, target) {
  addEffect(target, "slowness", 60, 1);
  particle(target.dimension, "arcane:frost_burst", V.up(target.location, 1));
  if (Math.random() < 0.2) {
    addEffect(target, "slowness", 50, 5);
    particle(target.dimension, "arcane:frost_shards", V.up(target.location, 1));
    sound("random.glass", target.location, 0.8, 1.8);
  }
}

let frostedIce;
/** Frost Walker: freeze still water under your feet. @param {Player} player */
function frostWalk(player) {
  if (!player.isOnGround) return;
  try {
    frostedIce = frostedIce || BlockPermutation.resolve("minecraft:frosted_ice");
  } catch {
    return;
  }
  const dim = player.dimension;
  const f = V.floor(player.location);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (dx * dx + dz * dz > 5) continue;
      try {
        const b = dim.getBlock({ x: f.x + dx, y: f.y - 1, z: f.z + dz });
        if (!b || !blockIs(b, "minecraft:water") || b.permutation.getState("liquid_depth") !== 0) continue;
        const above = dim.getBlock({ x: f.x + dx, y: f.y, z: f.z + dz });
        if (above && above.isAir) b.setPermutation(frostedIce);
      } catch {
        // unloaded
      }
    }
  }
}

/** @param {Player} player */
function flameWave(player) {
  const dim = player.dimension;
  const o = player.location;
  const dir = V.flat(player.getViewDirection());
  const spread = (40 * Math.PI) / 180;
  particle(dim, "arcane:fire_rune", V.up(o, 0.05));
  sound("mob.blaze.shoot", o, 1, 0.9);
  sound("mob.ghast.fireball", o, 0.6, 1.2);
  for (let s = 1; s <= 7; s++) {
    later(s, () => {
      const d = s * 1.3;
      const n = 4 + s;
      for (let i = 0; i <= n; i++) {
        const a = -spread + (2 * spread * i) / n;
        const dx = dir.x * Math.cos(a) - dir.z * Math.sin(a);
        const dz = dir.x * Math.sin(a) + dir.z * Math.cos(a);
        const p = { x: o.x + dx * d, y: o.y + 0.35 + Math.random() * 0.7, z: o.z + dz * d };
        particle(dim, "arcane:fire_flame", p);
        if (i % 2 === 0) particle(dim, "minecraft:basic_flame_particle", p);
      }
    });
  }
  const minCos = Math.cos(spread + 0.15);
  for (const e of hostilesNear(dim, o, 9.5)) {
    const to = V.sub(e.location, o);
    const flatDist = Math.hypot(to.x, to.z);
    if (flatDist > 1 && V.dot(V.flat(to), dir) < minCos) continue;
    later(Math.max(1, Math.round(flatDist / 1.3)), () => {
      if (!alive(e)) return;
      hurt(e, 7, player);
      try {
        e.setOnFire(6, true);
      } catch {
        // fire immune
      }
      knockAway(e, o, 0.6, 0.25);
      particle(dim, "arcane:fire_burst", V.up(e.location, 1));
    });
  }
}

/** @param {Player} player @param {Entity} target */
function infernoHit(player, target) {
  try {
    target.setOnFire(5, true);
  } catch {
    // ignore
  }
  particle(target.dimension, "arcane:fire_burst", V.up(target.location, 1));
}

/** @param {Player} player */
function toxicCloud(player) {
  const dim = player.dimension;
  const fwd = V.flat(player.getViewDirection());
  const c = V.add(player.location, V.scale(fwd, 2.5));
  particle(dim, "arcane:venom_rune", V.up(player.location, 0.05));
  sound("random.fizz", c, 1, 0.6);
  sound("mob.slime.big", c, 0.8, 0.7);
  for (let pulse = 0; pulse < 8; pulse++) {
    later(1 + pulse * 10, () => {
      particle(dim, "arcane:venom_cloud", V.up(c, 0.3));
      for (const e of hostilesNear(dim, c, 4.5)) {
        if (pulse === 0) hurt(e, 4, player);
        if (hasFamily(e, "undead")) addEffect(e, "wither", 60, 1);
        else addEffect(e, "poison", 60, 2);
        addEffect(e, "slowness", 40, 0);
        if (pulse % 2 === 0) particle(dim, "arcane:venom_burst", V.up(e.location, 1));
      }
    });
  }
}

/** @param {Player} player @param {Entity} target */
function venomHit(player, target) {
  if (hasFamily(target, "undead")) addEffect(target, "wither", 80, 0);
  else addEffect(target, "poison", 80, 1);
  addEffect(target, "weakness", 80, 0);
  particle(target.dimension, "arcane:venom_burst", V.up(target.location, 1));
}

/** @param {Player} player */
function thunderCall(player) {
  const dim = player.dimension;
  const t = lookTarget(player, 40);
  const p = t.point;
  particle(dim, "arcane:storm_rune", V.up(player.location, 0.05));
  arc(dim, handPoint(player, 0.9, 0.35, 0.2), V.up(p, 0.6));
  const safe = V.dist(player.location, p) >= 6 && !bystanderNear(dim, p, 4, player);
  if (safe) strikeLightning(dim, p);
  else sparkBolt(dim, p);
  sound("item.trident.thunder", p, 1.2, 1);
  for (const e of hostilesNear(dim, p, 3.5)) {
    hurt(e, 10, player);
    knockAway(e, p, 1, 0.5);
    try {
      e.setOnFire(3, true);
    } catch {
      // ignore
    }
    particle(dim, "arcane:storm_burst", V.up(e.location, 1));
  }
  shake(player, 0.25, 0.3);
}

/** @param {Player} player @param {Entity} target */
function stormHit(player, target) {
  const dim = target.dimension;
  knockAway(target, player.location, 1.1, 0.35);
  particle(dim, "arcane:storm_burst", V.up(target.location, 1));
  if (Math.random() >= 0.3) return;
  const from = V.up(target.location, 1);
  let n = 0;
  for (const e of hostilesNear(dim, target.location, 6)) {
    if (e.id === target.id) continue;
    arc(dim, from, V.up(e.location, 1));
    hurt(e, 5, player);
    particle(dim, "arcane:storm_burst", V.up(e.location, 1));
    if (++n >= 3) break;
  }
  sound("ambient.weather.lightning.impact", target.location, 0.35, 1.6);
}

// ------------------------------------------------------------------ Tier II
/** @param {Player} player */
function shadowDash(player) {
  const dim = player.dimension;
  const dir = V.flat(player.getViewDirection());
  const start = player.location;
  let reach = 10;
  for (const h of [0.15, 1, 1.65]) {
    const o = V.up(start, h);
    try {
      const hit = dim.getBlockFromRay(o, dir, { maxDistance: 10, includePassableBlocks: false, includeLiquidBlocks: false });
      if (hit) {
        const hp = hitPoint(hit);
        reach = Math.min(reach, Math.hypot(hp.x - o.x, hp.z - o.z) - 0.65);
      }
    } catch {
      // ignore
    }
  }
  if (reach < 1.5) {
    actionbar(player, "§5Shadow Dash §7- path blocked");
    privateSound(player, "note.bass", 0.5, 0.6);
    return false;
  }
  const dest = { x: start.x + dir.x * reach, y: start.y, z: start.z + dir.z * reach };
  particle(dim, "arcane:shadow_rune", V.up(start, 0.05));
  particle(dim, "arcane:shadow_burst", V.up(start, 1));
  line(dim, V.up(start, 1), V.up(dest, 1), "arcane:shadow_mote", 0.35);
  sound("mob.endermen.portal", start, 1, 0.8);
  for (const e of hostilesNear(dim, V.lerp(start, dest, 0.5), reach / 2 + 2.5)) {
    if (distToSegment(e.location, start, dest) > 2.2) continue;
    hurt(e, 10, player);
    addEffect(e, "blindness", 60, 0);
    addEffect(e, "wither", 60, 0);
    particle(dim, "arcane:shadow_burst", V.up(e.location, 1));
  }
  try {
    player.teleport(dest, { dimension: dim, rotation: player.getRotation(), keepVelocity: false });
  } catch {
    return false;
  }
  later(1, () => {
    particle(dim, "arcane:shadow_burst", V.up(dest, 1));
    sound("mob.endermen.portal", dest, 1, 1.25);
  });
}

/** @param {Player} player @param {Entity} target */
function reaperHit(player, target) {
  addEffect(target, "wither", 60, 1);
  heal(player, 2);
  particle(target.dimension, "arcane:shadow_burst", V.up(target.location, 1));
}

/** Soul Harvest - called when the Reaper lands a killing blow. @param {Player} player @param {Entity} victim */
export function soulHarvest(player, victim) {
  heal(player, 4);
  addEffect(player, "absorption", 200, 0);
  sound("random.orb", player.location, 0.5, 0.5);
  try {
    const dim = victim.dimension;
    const from = V.up(victim.location, 1);
    line(dim, from, V.up(player.location, 1), "arcane:shadow_mote", 0.4);
    particle(dim, "minecraft:soul_particle", from);
  } catch {
    // the body is already gone
  }
}

const HITBOX = { "minecraft:ghast": 2.6, "minecraft:ender_dragon": 4.5, "minecraft:wither": 1.8, "minecraft:ravager": 1.8,
  "minecraft:elder_guardian": 1.8, "minecraft:warden": 1.6, "minecraft:iron_golem": 1.5, "minecraft:enderman": 1.6 };

/** @param {Player} player */
function arcaneMissile(player) {
  const dim = player.dimension;
  let pos = handPoint(player, 0.9, 0.28, 0.12);
  let dir = player.getViewDirection();
  particle(dim, "arcane:arcane_burst", pos);
  sound("mob.evocation_illager.cast_spell", pos, 0.7, 1.6);
  let ticks = 0;
  let done = false;
  /** @param {Vector3} at @param {Entity} [victim] */
  const impact = (at, victim) => {
    done = true;
    system.clearRun(run);
    particle(dim, "arcane:arcane_burst", at);
    particle(dim, "arcane:arcane_rune", at);
    sound("mob.shulker.bullet.hit", at, 0.9, 1.3);
    if (victim) {
      hurt(victim, 12, player);
      knockAway(victim, V.sub(at, dir), 0.8, 0.25);
    }
    for (const e of hostilesNear(dim, at, 2.5)) {
      if (!victim || e.id !== victim.id) hurt(e, 4, player);
    }
  };
  const run = system.runInterval(() => {
    if (done) return;
    try {
      ticks++;
      // gentle homing toward the nearest foe in front of the missile
      let target;
      let best = Infinity;
      for (const e of hostilesNear(dim, pos, 9)) {
        const to = V.sub(V.up(e.location, 0.9), pos);
        const d = V.len(to);
        if (d < 0.1 || V.dot(V.scale(to, 1 / d), dir) < 0.5) continue;
        if (d < best) {
          best = d;
          target = e;
        }
      }
      if (target) {
        dir = V.norm(V.add(V.scale(dir, 0.72), V.scale(V.norm(V.sub(V.up(target.location, 0.9), pos)), 0.28)));
      }
      const step = 0.55;
      for (let i = 0; i < 3; i++) {
        const bh = dim.getBlockFromRay(pos, dir, { maxDistance: step, includePassableBlocks: false, includeLiquidBlocks: false });
        if (bh) return impact(hitPoint(bh));
        pos = V.add(pos, V.scale(dir, step));
        particle(dim, "arcane:arcane_mote", pos);
        for (const e of dim.getEntities({ location: pos, maxDistance: 5 })) {
          if (e.id === player.id || !alive(e) || !isLiving(e) || isFriendly(e)) continue;
          const r = HITBOX[e.typeId] || 1.1;
          const dy = pos.y - e.location.y;
          if (Math.hypot(e.location.x - pos.x, e.location.z - pos.z) <= r && dy > -0.4 && dy < r + 1.4) {
            return impact(pos, e);
          }
        }
      }
      if (ticks >= 26) {
        done = true;
        system.clearRun(run);
        particle(dim, "arcane:arcane_burst", pos);
      }
    } catch (err) {
      done = true;
      system.clearRun(run);
      logError(err);
    }
  }, 1);
}

/** @param {Player} player @param {Entity} target */
function staffHit(player, target) {
  knockAway(target, player.location, 1.4, 0.4);
  particle(target.dimension, "arcane:arcane_burst", V.up(target.location, 1));
}

/** @param {Player} player */
function cyclone(player) {
  const dim = player.dimension;
  const c = player.location;
  particle(dim, "arcane:wind_rune", V.up(c, 0.05));
  particle(dim, "arcane:wind_burst", V.up(c, 1));
  sound("item.trident.riptide_3", c, 1, 1);
  for (let s = 0; s < 12; s++) {
    later(s + 1, () => {
      for (let arm = 0; arm < 3; arm++) {
        const a = s * 0.55 + (arm * Math.PI * 2) / 3;
        const r = 1.2 + s * 0.45;
        const p = { x: c.x + Math.cos(a) * r, y: c.y + 0.3 + s * 0.25, z: c.z + Math.sin(a) * r };
        particle(dim, "arcane:wind_streak", p);
        particle(dim, "arcane:wind_mote", p);
      }
    });
  }
  for (const e of hostilesNear(dim, c, 8)) {
    hurt(e, 7, player);
    knockAway(e, c, 2.2, 0.8);
    particle(dim, "arcane:wind_burst", V.up(e.location, 1));
  }
  const f = V.flat(player.getViewDirection());
  try {
    player.applyKnockback(f.x, f.z, 0.3, 0.9);
  } catch {
    // ignore
  }
  addEffect(player, "slow_falling", 100, 0);
  shake(player, 0.15, 0.3);
}

/** @param {Player} player @param {Entity} target */
function tempestHit(player, target) {
  const d = V.flat(V.sub(target.location, player.location));
  try {
    target.applyKnockback(d.x, d.z, 0.35, 0.7);
  } catch {
    // ignore
  }
  particle(target.dimension, "arcane:wind_burst", V.up(target.location, 1));
}

// ------------------------------------------------------------------ Tier III
/** @param {Player} player */
function divineJudgement(player) {
  const dim = player.dimension;
  const c = player.location;
  const foes = hostilesNear(dim, c, 24)
    .sort((a, b) => V.dist(a.location, c) - V.dist(b.location, c))
    .slice(0, 24);
  particle(dim, "arcane:holy_rune", V.up(c, 0.05));
  particle(dim, "arcane:holy_burst", V.up(c, 1));
  particle(dim, "minecraft:totem_particle", V.up(c, 1));
  sound("item.trident.thunder", c, 1.5, 0.8);
  sound("beacon.activate", c, 1, 1.2);
  shake(player, 0.4, 0.6);
  for (let s = 1; s <= 8; s++) later(s * 2, () => ring(dim, V.up(c, 0.2), s * 1.4, "arcane:holy_mote", 10 + s * 4, s));
  heal(player, 8);
  addEffect(player, "resistance", 120, 2);
  addEffect(player, "regeneration", 120, 1);
  addEffect(player, "absorption", 400, 1);
  let bolts = 0;
  foes.forEach((e, i) => {
    later(4 + i * 2, () => {
      if (!alive(e)) return;
      const p = e.location;
      particle(dim, "arcane:holy_pillar", p);
      particle(dim, "arcane:holy_burst", V.up(p, 1));
      const far = !alive(player) || V.dist(p, player.location) >= 6;
      if (far && bolts < 8 && !bystanderNear(dim, p, 4, player)) {
        bolts++;
        strikeLightning(dim, p);
      } else {
        sound("ambient.weather.lightning.impact", p, 0.5, 1.4);
      }
      hurt(e, 40, alive(player) ? player : undefined);
      try {
        e.setOnFire(8, true);
      } catch {
        // ignore
      }
    });
  });
  actionbar(player, foes.length
    ? `§6§lDIVINE JUDGEMENT! §r§e${foes.length} foe${foes.length === 1 ? "" : "s"} smitten`
    : "§6§lDIVINE JUDGEMENT! §r§eYou are blessed.");
}

/** @param {Player} player @param {Entity} target */
function godslayerHit(player, target) {
  const dim = target.dimension;
  try {
    target.setOnFire(8, true);
  } catch {
    // ignore
  }
  addEffect(target, "wither", 60, 1);
  addEffect(target, "weakness", 60, 1);
  heal(player, 2);
  particle(dim, "arcane:holy_burst", V.up(target.location, 1));
  sound("item.trident.hit", target.location, 0.7, 1.4);
  sound("chime.amethyst_block", target.location, 1, 1.2);
  let n = 0;
  for (const e of hostilesNear(dim, target.location, 6)) {
    if (e.id === target.id) continue;
    arc(dim, V.up(target.location, 1), V.up(e.location, 1), "arcane:holy_mote");
    hurt(e, 12, player);
    particle(dim, "arcane:holy_burst", V.up(e.location, 1));
    if (++n >= 2) break;
  }
}

/** @param {Player} player @param {number} tick */
function godslayerPassive(player, tick) {
  keepEffect(player, "strength", 1);
  keepEffect(player, "resistance", 1);
  keepEffect(player, "fire_resistance", 0);
  keepEffect(player, "speed", 0);
  if (tick % 20 === 0) heal(player, 1);
  if (setting("particles")) aroundBody(player.dimension, player.location, "arcane:holy_glint", 2);
}

// ------------------------------------------------------------------ Radiant Torch
/** @param {Player} player */
function toggleBeam(player) {
  let on = true;
  try {
    on = player.getDynamicProperty("arcane:beam") !== false;
    player.setDynamicProperty("arcane:beam", !on);
  } catch {
    // ignore
  }
  actionbar(player, !on ? "§eRadiant beam §aON §7- lights where you look" : "§eRadiant beam §7OFF");
  privateSound(player, "random.click", 0.6, !on ? 1.4 : 0.9);
}

/** @param {Player} player @param {Entity} target */
function torchHit(player, target) {
  try {
    target.setOnFire(3, true);
  } catch {
    // ignore
  }
  particle(target.dimension, "arcane:torch_ember", V.up(target.location, 1));
}

// ------------------------------------------------------------------ registry
/** @type {Record<string, Weapon>} */
export const WEAPONS = {
  "arcane:frostbite_blade": {
    name: "Frostbite Blade", color: "§b", spell: "Frost Nova", element: "frost",
    lore: [T1, "§9Spell (Use): §fFrost Nova", "§7 Freezes and hurts nearby foes", "§9On hit: §fChilling slowness",
      "§9Passive: §fFrost Walker"],
    cast: frostNova, hit: frostHit, fast: frostWalk,
  },
  "arcane:inferno_sword": {
    name: "Inferno Sword", color: "§b", spell: "Flame Wave", element: "fire",
    lore: [T1, "§9Spell (Use): §fFlame Wave", "§7 A cone of fire in front of you", "§9On hit: §fSets foes ablaze",
      "§9Passive: §fFire Resistance, glows"],
    cast: flameWave, hit: infernoHit, passive: (p) => keepEffect(p, "fire_resistance", 0),
  },
  "arcane:venom_fang": {
    name: "Venom Fang", color: "§b", spell: "Toxic Cloud", element: "venom",
    lore: [T1, "§9Spell (Use): §fToxic Cloud", "§7 A lingering cloud of poison", "§9On hit: §fPoison (Wither vs undead)",
      "§9Passive: §fSwiftness"],
    cast: toxicCloud, hit: venomHit, passive: (p) => keepEffect(p, "speed", 0),
  },
  "arcane:storm_hammer": {
    name: "Storm Hammer", color: "§b", spell: "Thunder Call", element: "storm",
    lore: [T1, "§9Spell (Use): §fThunder Call", "§7 Lightning strikes where you aim", "§9On hit: §fSmash + chain lightning"],
    cast: thunderCall, hit: stormHit,
  },
  "arcane:shadow_reaper": {
    name: "Shadow Reaper", color: "§d", spell: "Shadow Dash", element: "shadow",
    lore: [T2, "§9Spell (Use): §fShadow Dash", "§7 Blink forward through foes", "§9On hit: §fWither + life steal",
      "§9On kill: §fSoul Harvest"],
    cast: shadowDash, hit: reaperHit,
  },
  "arcane:arcane_staff": {
    name: "Arcane Staff", color: "§d", spell: "Arcane Missile", element: "arcane",
    lore: [T2, "§9Spell (Use): §fArcane Missile", "§7 Homing bolt, recharges fast", "§9On hit: §fArcane knockback"],
    cast: arcaneMissile, hit: staffHit,
  },
  "arcane:tempest_blade": {
    name: "Tempest Blade", color: "§d", spell: "Cyclone", element: "wind",
    lore: [T2, "§9Spell (Use): §fCyclone", "§7 Hurls foes away, lifts you up", "§9On hit: §fUpdraft",
      "§9Passive: §fSpeed and Jump Boost"],
    cast: cyclone, hit: tempestHit, passive: (p) => {
      keepEffect(p, "speed", 0);
      keepEffect(p, "jump_boost", 0);
    },
  },
  "arcane:celestial_godslayer": {
    name: "Celestial Godslayer", color: "§6", spell: "Divine Judgement", element: "holy",
    lore: [T3, "§9Spell (Use): §fDivine Judgement", "§7 Smites every foe in 24 blocks", "§9On hit: §fHoly fire + chain smite",
      "§9Passive: §fStrength II, Resistance II,", "§f Regeneration, Fire Res., Speed", "§6Unbreakable"],
    cast: divineJudgement, hit: godslayerHit, passive: godslayerPassive,
  },
};

/** Everything that gets lore/cooldowns, including the Radiant Torch. @type {Record<string, Weapon>} */
export const ITEMS = {
  ...WEAPONS,
  "arcane:radiant_torch": {
    name: "Radiant Torch", color: "§e", spell: "Radiant Beam", element: "light",
    lore: ["§7Magic torch §8- §eUncommon", "§9Light: §fBrightest hand-held light", "§9Use: §fToggle flashlight beam",
      "§7 Works in your off-hand too"],
    cast: toggleBeam, hit: torchHit,
  },
};

// ------------------------------------------------------------------ player state
/** @type {Map<string, { cooldowns: Map<string, number>, cooling: Set<string>, lastUse: number, lastNag: number }>} */
const states = new Map();
/** @param {Player} player */
function state(player) {
  let s = states.get(player.id);
  if (!s) {
    s = { cooldowns: new Map(), cooling: new Set(), lastUse: -100, lastNag: -100 };
    states.set(player.id, s);
  }
  return s;
}

/** @param {string} playerId */
export function forgetPlayer(playerId) {
  states.delete(playerId);
}

/**
 * Cast the spell of the held item (from the use / use-on events).
 * @param {Player} player @param {ItemStack | undefined} item
 */
export function useItem(player, item) {
  if (!item || !alive(player)) return;
  const def = ITEMS[item.typeId];
  if (!def) return;
  const now = system.currentTick;
  const st = state(player);
  if (now - st.lastUse < 4) return; // the same tap can fire two events
  st.lastUse = now;
  const readyAt = st.cooldowns.get(item.typeId) || 0;
  if (now < readyAt) {
    if (now - st.lastNag > 10 && item.typeId !== "arcane:radiant_torch") {
      st.lastNag = now;
      actionbar(player, `${def.color}${def.spell} §7recharging §f${((readyAt - now) / 20).toFixed(1)}s`);
    }
    return;
  }
  let ok = true;
  try {
    ok = def.cast(player) !== false;
  } catch (e) {
    logError(e);
    ok = false;
  }
  if (!ok) return;
  st.cooldowns.set(item.typeId, now + (COOLDOWN_TICKS[item.typeId] || 20));
  if (item.typeId !== "arcane:radiant_torch") st.cooling.add(item.typeId);
  try {
    const cd = /** @type {import("@minecraft/server").ItemCooldownComponent | undefined} */ (
      /** @type {any} */ (item.getComponent("minecraft:cooldown"))
    );
    cd?.startCooldown(player);
  } catch {
    // visual only
  }
}

/** @param {Player} player @param {Entity} target */
export function onHit(player, target) {
  const item = mainhand(player);
  const def = item && ITEMS[item.typeId];
  if (!def || !def.hit || !alive(target) || !isLiving(target)) return;
  try {
    def.hit(player, target);
  } catch (e) {
    logError(e);
  }
}

/** Cooldown text above the hotbar. @param {Player} player @param {ItemStack | undefined} item */
function hud(player, item) {
  const id = item && item.typeId;
  const def = id && WEAPONS[id];
  if (!def) return;
  const st = state(player);
  const now = system.currentTick;
  const readyAt = st.cooldowns.get(id) || 0;
  if (now < readyAt) {
    actionbar(player, `${def.color}${def.spell} §7recharging §f${((readyAt - now) / 20).toFixed(1)}s`);
  } else if (st.cooling.has(id)) {
    st.cooling.delete(id);
    actionbar(player, `${def.color}${def.spell} §aready!`);
    privateSound(player, "random.orb", 0.25, 1.9);
  }
}

/** @param {import("@minecraft/server").ContainerSlot} slot */
function fixLore(slot) {
  try {
    if (!slot.hasItem()) return;
    const def = ITEMS[slot.typeId];
    if (!def) return;
    const lore = slot.getLore();
    if (lore.length === def.lore.length && lore.every((l, i) => l === def.lore[i])) return;
    slot.setLore(def.lore);
  } catch {
    // ignore
  }
}

/** Give tooltips (lore) to our items anywhere in the inventory. @param {Player} player */
function syncLore(player) {
  const inv = inventory(player);
  if (inv) {
    for (let i = 0; i < inv.size; i++) {
      const it = inv.getItem(i);
      if (it && ITEMS[it.typeId]) {
        try {
          fixLore(inv.getSlot(i));
        } catch {
          // ignore
        }
      }
    }
  }
  const off = offhand(player);
  if (off && ITEMS[off.typeId]) {
    try {
      const eq = /** @type {import("@minecraft/server").EntityEquippableComponent | undefined} */ (
        /** @type {any} */ (player.getComponent("minecraft:equippable"))
      );
      if (eq) fixLore(eq.getEquipmentSlot(EquipmentSlot.Offhand));
    } catch {
      // ignore
    }
  }
}

/**
 * Per-tick work for one player (called from main.js).
 * @param {Player} player @param {number} tick @param {number} index  player index (spreads work over ticks)
 */
export function tickPlayer(player, tick, index) {
  const item = mainhand(player);
  const def = item && WEAPONS[item.typeId];
  if (def) {
    if (def.fast && tick % 3 === 0) def.fast(player);
    if (def.passive && tick % 10 === 0) def.passive(player, tick);
    if (tick % 4 === 0 && setting("particles")) {
      particle(player.dimension, `arcane:${def.element}_glint`, handPoint(player, 0.8, 0.4, 0.3));
    }
  }
  if (tick % 5 === 0 && setting("hud")) hud(player, item);
  if ((tick + index * 7) % 40 === 0) syncLore(player);
}

