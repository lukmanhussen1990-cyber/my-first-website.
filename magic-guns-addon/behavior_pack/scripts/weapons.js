// @ts-check
/**
 * Weapon definitions.  Every gun is data (stats, visuals, sounds) plus a few
 * optional hooks the projectile engine in main.js calls.
 *
 * Units: cooldown in ticks (20 = 1 s), speed in blocks per tick, range in blocks.
 */
import { EntityDamageCause } from "@minecraft/server";
import * as V from "./vec.js";
import { fx, hurt, heal, nearbyTargets, safeTeleport, isUndead, sound } from "./fx.js";
import { shatter, crater, freeze, corrupt, isFragile, breakable } from "./terrain.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").BlockRaycastHit} BlockRaycastHit */
/** @typedef {import("@minecraft/server").RGB} RGB */

/**
 * @typedef {object} Shot
 * @property {Player} owner
 * @property {string} ownerId
 * @property {Dimension} dim
 * @property {Vector3} pos
 * @property {Vector3} vel
 * @property {Weapon} weapon
 * @property {number} traveled
 * @property {number} pierceLeft
 * @property {Set<string>} hitIds
 * @property {number} age
 * @property {boolean} done
 * @property {{ hits: Map<string, { entity: Entity, damage: number }>, struck: boolean }} volley
 * @property {{ damage: number, punch: number, flame: boolean }} mods  bow enchantments on the gun
 */

/**
 * @typedef {object} Weapon
 * @property {string} id
 * @property {string} name
 * @property {string} chat        colour code used for the HUD
 * @property {RGB} color
 * @property {number} cooldown
 * @property {number} damage
 * @property {number} speed
 * @property {number} range
 * @property {number} gravity
 * @property {number} pellets
 * @property {number} spread      degrees
 * @property {number} pierce      extra entities a shot may pass through
 * @property {number} homing      0..1 steering strength per tick
 * @property {number} knockback
 * @property {number} trailEvery  blocks between trail particles
 * @property {string} trail
 * @property {string} impact
 * @property {string} fireSound
 * @property {string} hitSound
 * @property {EntityDamageCause} cause
 * @property {boolean} [liquids]  stop on water/lava (frost rifle freezes water)
 * @property {number} [recoil]
 * @property {(shot: Shot, target: Entity, at: Vector3) => void} [onHitEntity]
 * @property {(shot: Shot, hit: BlockRaycastHit, at: Vector3) => void} [onHitBlock]
 * @property {(shot: Shot) => void} [onExpire]
 * @property {(shot: Shot) => void} [onTick]
 */

/** Shared impact flash. @param {Shot} shot @param {Vector3} at */
function impactFlash(shot, at) {
  fx(shot.dim, shot.weapon.impact, at, shot.weapon.color);
  sound(shot.dim, shot.weapon.hitSound, at, 0.9 + Math.random() * 0.2);
}

/**
 * Radial blast that hurts everything but the shooter (no block damage, so
 * the guns are safe to use around builds).
 * @param {Shot} shot @param {Vector3} at @param {number} radius @param {number} damage
 * @param {(e: Entity, falloff: number) => void} [extra]
 */
function blast(shot, at, radius, damage, extra) {
  for (const e of nearbyTargets(shot.dim, at, radius, shot.ownerId)) {
    const c = V.bodyCenter(e);
    const d = V.dist(c, at);
    const falloff = Math.max(0.35, 1 - d / radius);
    hurt(shot, e, damage * falloff);
    const push = V.norm(V.sub(c, at));
    try {
      e.applyKnockback(push.x, push.z, 0.9 * falloff, 0.35 * falloff);
    } catch {}
    if (extra) extra(e, falloff);
  }
}

/** @type {Weapon[]} */
const LIST = [
  {
    id: "magic_guns:arcane_revolver",
    name: "Arcane Revolver",
    chat: "§d",
    color: { red: 0.78, green: 0.38, blue: 1.0 },
    cooldown: 8,
    damage: 7,
    speed: 3.2,
    range: 56,
    gravity: 0,
    pellets: 1,
    spread: 0.4,
    pierce: 0,
    homing: 0.22,
    knockback: 0.3,
    trailEvery: 0.55,
    trail: "magic_guns:arcane_trail",
    impact: "magic_guns:arcane_impact",
    fireSound: "magic_guns.arcane.fire",
    hitSound: "magic_guns.arcane.hit",
    cause: EntityDamageCause.magic,
    onHitBlock(shot, hit) {
      // Arcane disintegration: the block crumbles into amethyst dust (and drops).
      shatter(shot.dim, hit.block, { particle: "magic_guns:arcane_impact", color: shot.weapon.color });
    },
  },
  {
    id: "magic_guns:inferno_blaster",
    name: "Inferno Blaster",
    chat: "§6",
    color: { red: 1.0, green: 0.5, blue: 0.1 },
    cooldown: 18,
    damage: 6,
    speed: 1.7,
    range: 42,
    gravity: 0.025,
    pellets: 1,
    spread: 0.8,
    pierce: 0,
    homing: 0,
    knockback: 0.5,
    trailEvery: 0.4,
    trail: "magic_guns:fire_trail",
    impact: "magic_guns:fire_impact",
    fireSound: "magic_guns.inferno.fire",
    hitSound: "magic_guns.inferno.hit",
    cause: EntityDamageCause.fire,
    recoil: 0.25,
    onHitEntity(shot, target, at) {
      try {
        target.setOnFire(6, true);
      } catch {}
      this.onExpire?.({ ...shot, pos: at });
    },
    onHitBlock(shot, hit, at) {
      this.onExpire?.({ ...shot, pos: at });
    },
    onExpire(shot) {
      const at = shot.pos;
      fx(shot.dim, "minecraft:large_explosion", at);
      sound(shot.dim, "random.explode", at, 1.2, 0.7);
      blast(shot, at, 3.2, 7, (e) => {
        try {
          e.setOnFire(4, true);
        } catch {}
      });
      // Fire crater - never right under the shooter's feet.
      if (V.dist(at, shot.owner.location) > 3.5) {
        crater(shot.dim, at, 2.3, { dropChance: 0.3, fireChance: 0.3, particle: "magic_guns:fire_impact", color: shot.weapon.color });
      }
    },
  },
  {
    id: "magic_guns:frostbite_rifle",
    name: "Frostbite Rifle",
    chat: "§b",
    color: { red: 0.55, green: 0.92, blue: 1.0 },
    cooldown: 26,
    damage: 13,
    speed: 5.5,
    range: 96,
    gravity: 0,
    pellets: 1,
    spread: 0,
    pierce: 2,
    homing: 0,
    knockback: 0.2,
    trailEvery: 0.7,
    trail: "magic_guns:frost_trail",
    impact: "magic_guns:frost_impact",
    fireSound: "magic_guns.frost.fire",
    hitSound: "magic_guns.frost.hit",
    cause: EntityDamageCause.freezing,
    liquids: true,
    onHitEntity(shot, target) {
      try {
        target.addEffect("slowness", 100, { amplifier: 3, showParticles: true });
        target.addEffect("mining_fatigue", 100, { amplifier: 1, showParticles: false });
        target.extinguishFire(true);
      } catch {}
      fx(shot.dim, "minecraft:snowflake_particle", V.bodyCenter(target));
    },
    onHitBlock(shot, hit) {
      // Glass, ice and plants shatter; everything else is frozen over: water ->
      // frosted ice (melts back like Frost Walker), lava -> obsidian, fire out, snow.
      const b = hit.block;
      if (breakable(b) && isFragile(b)) {
        shatter(shot.dim, b, { particle: "magic_guns:frost_impact", color: shot.weapon.color });
      } else {
        freeze(shot.dim, b, 2.2);
      }
      sound(shot.dim, "random.glass", b.location, 1.4, 0.7);
    },
  },
  {
    id: "magic_guns:stormcaller",
    name: "Stormcaller",
    chat: "§9",
    color: { red: 0.4, green: 0.7, blue: 1.0 },
    cooldown: 24,
    damage: 4,
    speed: 3.4,
    range: 24,
    gravity: 0,
    pellets: 7,
    spread: 7,
    pierce: 0,
    homing: 0,
    knockback: 0.25,
    trailEvery: 0.8,
    trail: "magic_guns:storm_trail",
    impact: "magic_guns:storm_impact",
    fireSound: "magic_guns.storm.fire",
    hitSound: "magic_guns.storm.hit",
    cause: EntityDamageCause.lightning,
    recoil: 0.35,
    onHitEntity(shot, target, at) {
      // Only the first pellet of a volley that connects calls the storm.
      if (shot.volley.struck) return;
      shot.volley.struck = true;
      const tc = V.bodyCenter(target);
      // Never drop a bolt right on top of the shooter.
      if (V.dist(tc, shot.owner.location) > 5) {
        try {
          shot.dim.spawnEntity("minecraft:lightning_bolt", target.location);
        } catch {}
      } else {
        fx(shot.dim, "magic_guns:storm_impact", tc, shot.weapon.color);
      }
      // Chain lightning: arc to up to 3 more nearby enemies.
      let from = tc;
      let jumps = 0;
      for (const e of nearbyTargets(shot.dim, tc, 6, shot.ownerId)) {
        if (e.id === target.id || jumps >= 3) continue;
        const to = V.bodyCenter(e);
        arc(shot.dim, from, to);
        hurt(shot, e, 4);
        from = to;
        jumps++;
      }
      if (jumps) sound(shot.dim, "magic_guns.storm.hit", tc, 1.3);
    },
    onHitBlock(shot, hit, at) {
      if (isFragile(hit.block)) shatter(shot.dim, hit.block, { particle: "magic_guns:storm_impact", color: shot.weapon.color });
      // The first pellet that lands far enough away calls lightning onto the spot.
      if (shot.volley.struck || V.dist(at, shot.owner.location) < 7) return;
      shot.volley.struck = true;
      try {
        shot.dim.spawnEntity("minecraft:lightning_bolt", at);
      } catch {}
    },
  },
  {
    id: "magic_guns:soul_reaper",
    name: "Soul Reaper",
    chat: "§3",
    color: { red: 0.3, green: 0.95, blue: 0.92 },
    cooldown: 4,
    damage: 3.5,
    speed: 3.0,
    range: 36,
    gravity: 0,
    pellets: 1,
    spread: 2.2,
    pierce: 0,
    homing: 0,
    knockback: 0.1,
    trailEvery: 0.6,
    trail: "magic_guns:soul_trail",
    impact: "magic_guns:soul_impact",
    fireSound: "magic_guns.soul.fire",
    hitSound: "magic_guns.soul.hit",
    cause: EntityDamageCause.magic,
    onHitEntity(shot, target) {
      try {
        target.addEffect("wither", 60, { amplifier: 0, showParticles: true });
      } catch {}
      // Life steal: 30 % of the damage flows back to the shooter as soul energy.
      heal(shot.owner, shot.weapon.damage * 0.3);
      fx(shot.dim, "minecraft:soul_particle", V.bodyCenter(target));
    },
    onHitBlock(shot, hit) {
      // Soul corruption: grass and dirt rot into soul soil, sand into soul sand,
      // flowers wither, leaves and grass crumble.
      if (isFragile(hit.block)) shatter(shot.dim, hit.block, { drop: false, particle: "magic_guns:soul_impact", color: shot.weapon.color });
      else corrupt(shot.dim, hit.block, 1.5);
    },
  },
  {
    id: "magic_guns:void_phaser",
    name: "Void Phaser",
    chat: "§5",
    color: { red: 0.85, green: 0.3, blue: 1.0 },
    cooldown: 30,
    damage: 8,
    speed: 2.6,
    range: 48,
    gravity: 0,
    pellets: 1,
    spread: 0,
    pierce: 0,
    homing: 0,
    knockback: 0,
    trailEvery: 0.5,
    trail: "magic_guns:void_trail",
    impact: "magic_guns:void_impact",
    fireSound: "magic_guns.void.fire",
    hitSound: "magic_guns.void.hit",
    cause: EntityDamageCause.magic,
    onHitEntity(shot, target) {
      // Phase the victim: random short-range blink + levitation.
      try {
        target.addEffect("levitation", 40, { amplifier: 1, showParticles: true });
      } catch {}
      const p = target.location;
      for (let i = 0; i < 6; i++) {
        const dest = {
          x: p.x + (Math.random() * 2 - 1) * 6,
          y: p.y + Math.random() * 2,
          z: p.z + (Math.random() * 2 - 1) * 6,
        };
        if (safeTeleport(target, dest)) {
          fx(shot.dim, "minecraft:portal_reverse_particle", dest);
          break;
        }
      }
    },
    onHitBlock(shot, hit, at) {
      // Void erasure: the struck block is swallowed by the void (no drops)...
      shatter(shot.dim, hit.block, { drop: false, particle: "magic_guns:void_impact", color: shot.weapon.color });
      // ...and the shooter rift-walks to where the orb landed.
      const owner = shot.owner;
      if (!owner.isValid()) return;
      const face = faceOffset(hit.face);
      const dest = V.add(at, V.scale(face, 0.6));
      dest.y = face.y < 0 ? dest.y - 1.8 : dest.y;
      fx(shot.dim, "magic_guns:void_impact", owner.location, shot.weapon.color);
      if (safeTeleport(owner, dest)) {
        sound(shot.dim, "mob.endermen.portal", dest, 1);
        fx(shot.dim, "minecraft:portal_reverse_particle", dest);
      }
    },
  },
  {
    id: "magic_guns:celestial_cannon",
    name: "Celestial Cannon",
    chat: "§e",
    color: { red: 1.0, green: 0.88, blue: 0.45 },
    cooldown: 50,
    damage: 10,
    speed: 1.5,
    range: 44,
    gravity: 0,
    pellets: 1,
    spread: 0,
    pierce: 0,
    homing: 0.08,
    knockback: 0.9,
    trailEvery: 0.35,
    trail: "magic_guns:holy_trail",
    impact: "magic_guns:holy_impact",
    fireSound: "magic_guns.holy.fire",
    hitSound: "magic_guns.holy.hit",
    cause: EntityDamageCause.magic,
    recoil: 0.7,
    onHitEntity(shot, target, at) {
      this.onExpire?.({ ...shot, pos: at });
    },
    onHitBlock(shot, hit, at) {
      this.onExpire?.({ ...shot, pos: at });
    },
    onExpire(shot) {
      const at = shot.pos;
      fx(shot.dim, "magic_guns:holy_impact", at, shot.weapon.color);
      fx(shot.dim, "minecraft:totem_particle", at);
      sound(shot.dim, "magic_guns.holy.hit", at, 1);
      // Radiant burst: smites monsters (double vs undead), mends nearby players.
      blast(shot, at, 4.5, 12, (e) => {
        if (isUndead(e)) hurt(shot, e, 8);
      });
      for (const p of shot.dim.getPlayers({ location: at, maxDistance: 4.5 })) {
        heal(p, 4);
      }
      // Holy crater: stone and earth dissolve into light.
      if (V.dist(at, shot.owner.location) > 4.5) {
        crater(shot.dim, at, 3.2, { dropChance: 0.2, particle: "magic_guns:holy_impact", color: shot.weapon.color });
      }
    },
  },
];

/** Electric arc drawn as a jagged particle line. @param {Dimension} dim @param {Vector3} a @param {Vector3} b */
function arc(dim, a, b) {
  const n = Math.min(10, Math.ceil(V.dist(a, b) / 0.6));
  for (let i = 1; i <= n; i++) {
    const p = V.lerp(a, b, i / n);
    const j = i === n ? 0 : 0.25;
    fx(dim, "minecraft:electric_spark_particle", {
      x: p.x + (Math.random() * 2 - 1) * j,
      y: p.y + (Math.random() * 2 - 1) * j,
      z: p.z + (Math.random() * 2 - 1) * j,
    });
  }
}

/** @param {import("@minecraft/server").Direction} face @returns {Vector3} */
function faceOffset(face) {
  switch (face) {
    case "Up":
      return { x: 0, y: 1, z: 0 };
    case "Down":
      return { x: 0, y: -1, z: 0 };
    case "North":
      return { x: 0, y: 0, z: -1 };
    case "South":
      return { x: 0, y: 0, z: 1 };
    case "East":
      return { x: 1, y: 0, z: 0 };
    case "West":
      return { x: -1, y: 0, z: 0 };
    default:
      return { x: 0, y: 1, z: 0 };
  }
}

/** @type {Map<string, Weapon>} */
export const WEAPONS = new Map(LIST.map((w) => [w.id, w]));

export { impactFlash };
