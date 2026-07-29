/**
 * Legendary Weapons - the abilities.
 *
 * Every weapon has an active ability (tap while holding it) and a passive that
 * fires whenever you land a melee hit. Both live in this file: `useAbility()`
 * dispatches the active one, `onHit()` runs the passive.
 */

import { system } from "@minecraft/server";
import { WEAPONS, getSetting, power } from "./config.js";
import { SOUNDS } from "./sounds.js";
import {
  actionBar,
  add,
  addEffectSafe,
  blockIdAt,
  cameraShake,
  damageEntity,
  distance,
  entitiesNear,
  groundY,
  healEntity,
  igniteEntity,
  isPassableId,
  isValidEntity,
  length,
  normalize,
  particleLine,
  particleRing,
  playSoundAt,
  playSoundForPlayer,
  pushEntity,
  randFloat,
  rayScan,
  scale,
  spawnEntitySafe,
  spawnParticleSafe,
  sub,
  teleportSafe
} from "./util.js";

/* ------------------------------------------------------------------ shared -- */

/** Eye level position of a player. */
function eyeOf(player) {
  const loc = player.location;
  try {
    const head = player.getHeadLocation?.();
    if (head) return head;
  } catch {
    // fall through
  }
  return { x: loc.x, y: loc.y + 1.6, z: loc.z };
}

function viewOf(player) {
  try {
    return normalize(player.getViewDirection());
  } catch {
    return { x: 0, y: 0, z: 1 };
  }
}

/** Everything an ability is allowed to hit around a point. */
function collectTargets(dimension, center, radius, caster) {
  const hurtPlayers = getSetting("hurtPlayers");
  const out = [];
  for (const entity of entitiesNear(dimension, center, radius)) {
    let typeId;
    try {
      typeId = entity.typeId;
      if (caster && entity.id === caster.id) continue;
    } catch {
      continue;
    }
    if (typeId === "minecraft:item" || typeId === "minecraft:xp_orb" || typeId === "minecraft:lightning_bolt") {
      continue;
    }
    if (typeId === "minecraft:player" && !hurtPlayers) continue;
    out.push(entity);
  }
  return out;
}

function announce(player, weapon) {
  if (!getSetting("showAbilityText")) return;
  actionBar(player, `${weapon.color}${weapon.ability}§r §8- ${weapon.name}`);
}

/* ----------------------------------------------------------------- active -- */

/**
 * Runs a weapon's active ability.
 * @returns {boolean} true when the ability actually fired.
 */
export function useAbility(player, weapon) {
  const handler = ACTIVE[weapon.key];
  if (!handler) return false;
  let dimension;
  try {
    dimension = player.dimension;
  } catch {
    return false;
  }
  const fired = handler(player, dimension, weapon);
  if (fired) announce(player, weapon);
  return fired;
}

const ACTIVE = {
  /** Thunder Blade: lightning where you are looking, arcing to nearby enemies. */
  thunder_blade(player, dimension, weapon) {
    const cfg = weapon.tuning;
    const origin = eyeOf(player);
    const hit = rayScan(dimension, origin, viewOf(player), cfg.range, { ignore: player });

    // Drop the bolt onto the ground under the impact point.
    const target = { ...hit.point };
    const ground = groundY(dimension, Math.floor(target.x), Math.floor(target.z), target.y + 3, 12);
    if (ground !== undefined) target.y = ground + 1;

    spawnEntitySafe(dimension, "minecraft:lightning_bolt", target);
    playSoundAt(dimension, target, SOUNDS.thunderCast.custom, SOUNDS.thunderCast.vanilla, { volume: 1.4 });
    particleLine(dimension, add(origin, { x: 0, y: -0.3, z: 0 }), target, "wm:thunder_arc", 0.6);
    particleRing(dimension, target, 1.5, "wm:thunder_arc", 14, 0.3);

    const struck = collectTargets(dimension, target, cfg.strikeRadius, player);
    for (const entity of struck) damageEntity(entity, power(cfg.strikeDamage), { by: player, cause: "lightning" });

    chainLightning(dimension, target, player, cfg, struck);
    return true;
  },

  /** Frost Scythe: a nova of ice that freezes everything around you. */
  frost_scythe(player, dimension, weapon) {
    const cfg = weapon.tuning;
    const center = player.location;

    playSoundAt(dimension, center, SOUNDS.frostCast.custom, SOUNDS.frostCast.vanilla, { volume: 1.3, pitch: 0.8 });

    // The ring expands over half a second.
    for (let step = 0; step < 5; step++) {
      system.runTimeout(() => {
        const radius = (cfg.radius / 5) * (step + 1);
        particleRing(dimension, center, radius, "wm:frost_shard", 20 + step * 6, 0.4);
        particleRing(dimension, center, radius * 0.7, "wm:frost_shard", 12, 1.2);
      }, step * 2);
    }

    for (const entity of collectTargets(dimension, center, cfg.radius, player)) {
      damageEntity(entity, power(cfg.damage), { by: player, cause: "freezing" });
      addEffectSafe(entity, "slowness", cfg.slownessSeconds, cfg.slownessLevel);
      addEffectSafe(entity, "weakness", cfg.slownessSeconds, 1);
      addEffectSafe(entity, "mining_fatigue", cfg.slownessSeconds, 1, false);
      try {
        spawnParticleSafe(dimension, "wm:frost_shard", add(entity.location, { x: 0, y: 1, z: 0 }));
      } catch {
        // ignore
      }
    }
    return true;
  },

  /** Inferno Cannon: a bolt of fire that explodes where it lands. */
  inferno_cannon(player, dimension, weapon) {
    const cfg = weapon.tuning;
    const origin = eyeOf(player);
    const direction = viewOf(player);

    playSoundAt(dimension, origin, SOUNDS.infernoShot.custom, SOUNDS.infernoShot.vanilla, { volume: 1.2 });

    const hit = rayScan(dimension, origin, direction, cfg.range, { ignore: player });
    particleLine(dimension, origin, hit.point, "wm:inferno_bolt", 0.4);

    const impact = hit.point;
    playSoundAt(dimension, impact, SOUNDS.infernoBlast.custom, SOUNDS.infernoBlast.vanilla, { volume: 1.5 });
    for (let i = 0; i < 14; i++) {
      spawnParticleSafe(dimension, "wm:inferno_bolt", {
        x: impact.x + randFloat(-1.2, 1.2),
        y: impact.y + randFloat(-0.6, 1.4),
        z: impact.z + randFloat(-1.2, 1.2)
      });
    }
    spawnParticleSafe(dimension, "minecraft:huge_explosion_emitter", impact);

    try {
      dimension.createExplosion(impact, cfg.explosionPower, {
        breaksBlocks: getSetting("blockDamage"),
        causesFire: true,
        allowUnderwater: true,
        source: player
      });
    } catch {
      // Explosions can fail in unloaded chunks; the direct damage below still lands.
    }

    if (hit.entity && isValidEntity(hit.entity)) {
      damageEntity(hit.entity, power(cfg.directDamage), { by: player, cause: "fire" });
      igniteEntity(hit.entity, cfg.burnSeconds);
    }
    for (const entity of collectTargets(dimension, impact, cfg.splashRadius, player)) {
      if (hit.entity && entity.id === hit.entity.id) continue;
      damageEntity(entity, power(cfg.splashDamage), { by: player, cause: "fire" });
      igniteEntity(entity, cfg.burnSeconds);
    }
    return true;
  },

  /** Void Ripper: blink forward, cutting everything on the way through. */
  void_ripper(player, dimension, weapon) {
    const cfg = weapon.tuning;
    const start = player.location;
    const eye = eyeOf(player);
    const direction = viewOf(player);

    // Stop at the first wall so the player never lands inside terrain.
    const hit = rayScan(dimension, eye, direction, cfg.distance, { ignoreEntities: true });
    const travel = Math.max(1, hit.distance - (hit.hitBlock ? 1.2 : 0));
    const destination = add(start, scale({ x: direction.x, y: 0, z: direction.z }, travel));

    const ground = groundY(dimension, Math.floor(destination.x), Math.floor(destination.z), start.y + 3, 8);
    if (ground !== undefined) destination.y = ground + 1;
    const headId = blockIdAt(dimension, add(destination, { x: 0, y: 1, z: 0 }));
    if (headId !== undefined && !isPassableId(headId)) destination.y = start.y;

    playSoundAt(dimension, start, SOUNDS.voidBlink.custom, SOUNDS.voidBlink.vanilla, { volume: 1.1 });
    particleLine(dimension, add(start, { x: 0, y: 1, z: 0 }), add(destination, { x: 0, y: 1, z: 0 }), "wm:void_rift", 0.35);

    // Everything close to the line takes the hit.
    const cut = new Set();
    const steps = Math.max(2, Math.floor(travel));
    for (let i = 0; i <= steps; i++) {
      const point = add(start, scale(direction, (travel / steps) * i));
      for (const entity of collectTargets(dimension, point, cfg.pathRadius, player)) {
        if (cut.has(entity.id)) continue;
        cut.add(entity.id);
        damageEntity(entity, power(cfg.pathDamage), { by: player, cause: "entityAttack" });
        addEffectSafe(entity, "slowness", 2, 1, false);
      }
    }

    teleportSafe(player, destination);
    playSoundAt(dimension, destination, SOUNDS.voidHit.custom, SOUNDS.voidHit.vanilla, { volume: 1, pitch: 1.2 });
    particleRing(dimension, destination, 1.2, "wm:void_rift", 16, 0.5);
    return true;
  },

  /** Earthshaker: slam the ground and launch everything nearby. */
  earthshaker(player, dimension, weapon) {
    const cfg = weapon.tuning;
    const center = { ...player.location };
    const ground = groundY(dimension, Math.floor(center.x), Math.floor(center.z), center.y + 2, 8);
    if (ground !== undefined) center.y = ground + 1;

    playSoundAt(dimension, center, SOUNDS.quakeSlam.custom, SOUNDS.quakeSlam.vanilla, { volume: 1.6, pitch: 0.6 });
    playSoundAt(dimension, center, SOUNDS.quakeRumble.custom, SOUNDS.quakeRumble.vanilla, { volume: 1.2, pitch: 0.5 });
    cameraShake(dimension, center, cfg.shakeIntensity, 0.8, cfg.radius + 8);

    for (let ring = 1; ring <= 3; ring++) {
      system.runTimeout(() => {
        particleRing(dimension, center, (cfg.radius / 3) * ring, "wm:quake_dust", 18 + ring * 8, 0.3);
      }, (ring - 1) * 2);
    }

    for (const entity of collectTargets(dimension, center, cfg.radius, player)) {
      let loc;
      try {
        loc = entity.location;
      } catch {
        continue;
      }
      const away = normalize(sub(loc, center));
      const falloff = 1 - Math.min(1, distance(loc, center) / cfg.radius) * 0.5;
      damageEntity(entity, power(cfg.damage) * falloff, { by: player, cause: "entityAttack" });
      pushEntity(entity, {
        x: away.x * 0.6 * falloff,
        y: cfg.launch * falloff,
        z: away.z * 0.6 * falloff
      });
    }
    return true;
  },

  /** Singularity Staff: a black hole that drags everything in, then implodes. */
  singularity_staff(player, dimension, weapon) {
    const cfg = weapon.tuning;
    const origin = eyeOf(player);
    const hit = rayScan(dimension, origin, viewOf(player), cfg.range, { ignore: player });
    const center = add(hit.point, { x: 0, y: hit.hitBlock ? 1.5 : 0, z: 0 });

    playSoundAt(dimension, center, SOUNDS.singularityOpen.custom, SOUNDS.singularityOpen.vanilla, { volume: 1.4 });

    let age = 0;
    const handle = system.runInterval(() => {
      age++;
      try {
        // The core, drawn as a shrinking shell of particles.
        const shell = 1.6 * (1 - age / cfg.holdTicks) + 0.4;
        for (let i = 0; i < 10; i++) {
          const theta = randFloat(0, Math.PI * 2);
          const phi = randFloat(0, Math.PI);
          spawnParticleSafe(dimension, "wm:singularity_core", {
            x: center.x + Math.sin(phi) * Math.cos(theta) * shell,
            y: center.y + Math.cos(phi) * shell,
            z: center.z + Math.sin(phi) * Math.sin(theta) * shell
          });
        }
        if (age % 10 === 0) {
          particleRing(dimension, center, cfg.pullRadius * 0.5, "wm:singularity_core", 20, 0);
          playSoundAt(dimension, center, SOUNDS.singularityPull.custom, SOUNDS.singularityPull.vanilla, {
            volume: 0.9,
            pitch: 0.6 + age / cfg.holdTicks
          });
        }

        for (const entity of collectTargets(dimension, center, cfg.pullRadius, player)) {
          let loc;
          try {
            loc = entity.location;
          } catch {
            continue;
          }
          const toCenter = sub(center, loc);
          const dist = length(toCenter);
          if (dist < 0.6) continue;
          const pull = normalize(toCenter);
          const strength = cfg.pullStrength * (1 - Math.min(1, dist / cfg.pullRadius) * 0.4);
          pushEntity(entity, { x: pull.x * strength, y: pull.y * strength + 0.12, z: pull.z * strength });
        }

        if (age >= cfg.holdTicks) {
          system.clearRun(handle);
          implode(dimension, center, player, cfg);
        }
      } catch (error) {
        console.warn(`[Weapons] singularity: ${error}`);
        try {
          system.clearRun(handle);
        } catch {
          // ignore
        }
      }
    }, 1);
    return true;
  }
};

function implode(dimension, center, player, cfg) {
  playSoundAt(dimension, center, SOUNDS.singularityBoom.custom, SOUNDS.singularityBoom.vanilla, { volume: 1.6 });
  for (let i = 0; i < 30; i++) {
    spawnParticleSafe(dimension, "wm:singularity_core", {
      x: center.x + randFloat(-3, 3),
      y: center.y + randFloat(-2, 2.5),
      z: center.z + randFloat(-3, 3)
    });
  }
  spawnParticleSafe(dimension, "minecraft:huge_explosion_emitter", center);
  cameraShake(dimension, center, 0.16, 0.7, cfg.implodeRadius + 10);

  for (const entity of collectTargets(dimension, center, cfg.implodeRadius, player)) {
    damageEntity(entity, power(cfg.implodeDamage), { by: player, cause: "magic" });
    let loc;
    try {
      loc = entity.location;
    } catch {
      continue;
    }
    const away = normalize(sub(loc, center));
    pushEntity(entity, { x: away.x * 0.9, y: 0.7, z: away.z * 0.9 });
  }
}

/** Thunder Blade helper: arcs from one target to the next. */
function chainLightning(dimension, from, player, cfg, alreadyHit = []) {
  const hitIds = new Set();
  for (const entity of alreadyHit) {
    try {
      hitIds.add(entity.id);
    } catch {
      // ignore
    }
  }

  let source = from;
  for (let i = 0; i < cfg.chainTargets; i++) {
    const candidates = collectTargets(dimension, source, cfg.chainRadius, player).filter((entity) => {
      try {
        return !hitIds.has(entity.id);
      } catch {
        return false;
      }
    });
    if (candidates.length === 0) return;

    const next = candidates[0];
    let loc;
    try {
      loc = next.location;
      hitIds.add(next.id);
    } catch {
      return;
    }
    const chest = add(loc, { x: 0, y: 1, z: 0 });
    particleLine(dimension, add(source, { x: 0, y: 1, z: 0 }), chest, "wm:thunder_arc", 0.35);
    damageEntity(next, power(cfg.chainDamage), { by: player, cause: "lightning" });
    addEffectSafe(next, "slowness", 2, 0, false);
    playSoundAt(dimension, chest, SOUNDS.thunderArc.custom, SOUNDS.thunderArc.vanilla, { volume: 0.8, pitch: 1.4 });
    source = loc;
  }
}

/* ---------------------------------------------------------------- passives -- */

/**
 * Runs the passive effect of a weapon after a successful melee hit.
 * @param {object} player the attacker
 * @param {object} weapon the weapon definition
 * @param {object} victim the entity that was hit
 * @param {number} damage how much damage the hit dealt
 */
export function onHit(player, weapon, victim, damage) {
  if (!victim || !isValidEntity(victim)) return;
  let dimension;
  let loc;
  try {
    dimension = victim.dimension;
    loc = victim.location;
  } catch {
    return;
  }
  const cfg = weapon.tuning;

  switch (weapon.key) {
    case "thunder_blade": {
      particleRing(dimension, loc, 0.8, "wm:thunder_arc", 8, 1);
      chainLightning(dimension, loc, player, cfg, [victim]);
      return;
    }
    case "frost_scythe": {
      addEffectSafe(victim, "slowness", cfg.hitSlownessSeconds, 1);
      addEffectSafe(victim, "weakness", cfg.hitSlownessSeconds, 0);
      spawnParticleSafe(dimension, "wm:frost_shard", add(loc, { x: 0, y: 1, z: 0 }));
      playSoundAt(dimension, loc, SOUNDS.frostHit.custom, SOUNDS.frostHit.vanilla, { volume: 0.7, pitch: 1.5 });
      return;
    }
    case "inferno_cannon": {
      igniteEntity(victim, cfg.burnSeconds);
      spawnParticleSafe(dimension, "wm:inferno_bolt", add(loc, { x: 0, y: 1, z: 0 }));
      return;
    }
    case "void_ripper": {
      const stolen = Math.max(1, (damage * cfg.lifestealPercent) / 100);
      healEntity(player, stolen);
      spawnParticleSafe(dimension, "wm:void_rift", add(loc, { x: 0, y: 1, z: 0 }));
      playSoundForPlayer(player, SOUNDS.voidHit.custom, SOUNDS.voidHit.vanilla, { volume: 0.6, pitch: 1.6 });
      return;
    }
    case "earthshaker": {
      let playerLoc;
      try {
        playerLoc = player.location;
      } catch {
        return;
      }
      const away = normalize(sub(loc, playerLoc));
      pushEntity(victim, { x: away.x * cfg.knockbackBonus, y: 0.45, z: away.z * cfg.knockbackBonus });
      particleRing(dimension, loc, 1.0, "wm:quake_dust", 10, 0.2);
      return;
    }
    default:
      spawnParticleSafe(dimension, "wm:singularity_core", add(loc, { x: 0, y: 1, z: 0 }));
  }
}

/** Used by the codex screen. */
export function weaponSummary(key) {
  const weapon = WEAPONS[key];
  if (!weapon) return "";
  return (
    `${weapon.color}§l${weapon.name}§r\n` +
    `§7Melee damage: §f${weapon.melee}\n` +
    `§7Durability: §f${weapon.durability}\n` +
    `§7Cooldown: §f${weapon.cooldownSeconds}s\n\n` +
    `§6Ability - ${weapon.ability}\n§7${weapon.abilityText}\n\n` +
    `§6Passive\n§7${weapon.passive}`
  );
}
