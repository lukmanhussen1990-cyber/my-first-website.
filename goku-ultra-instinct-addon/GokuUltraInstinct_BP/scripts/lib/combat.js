// Targeting, damage and explosions.
import { EntityDamageCause } from '@minecraft/server';
import { add, along, bodyCenter, distance, segmentDistance, scale } from './vec.js';

const NOT_TARGETS = new Set([
  'minecraft:item',
  'minecraft:xp_orb',
  'minecraft:arrow',
  'minecraft:thrown_trident',
  'minecraft:snowball',
  'minecraft:egg',
  'minecraft:ender_pearl',
  'minecraft:fishing_hook',
  'minecraft:painting',
  'minecraft:leash_knot',
  'minecraft:tnt',
  'minecraft:falling_block',
  'minecraft:armor_stand',
  'minecraft:boat',
  'minecraft:chest_boat',
  'minecraft:minecart',
  'minecraft:npc',
  'minecraft:agent',
  'goku:nimbus',
]);

/** Living things the attacks may hit: never the caster and never tamed pets. */
export function isTarget(entity, caster) {
  try {
    if (!entity.isValid() || entity.id === caster.id) return false;
    if (NOT_TARGETS.has(entity.typeId) || entity.typeId.endsWith('minecart')) return false;
    if (!entity.hasComponent('minecraft:health')) return false;
    if (entity.hasComponent('minecraft:is_tamed')) return false;
    return true;
  } catch {
    return false;
  }
}

export function targetsNear(dimension, location, radius, caster) {
  try {
    return dimension.getEntities({ location, maxDistance: radius }).filter((e) => isTarget(e, caster));
  } catch {
    return [];
  }
}

/** Targets whose body is within `radius` of the segment a-b. */
export function targetsAlong(dimension, a, b, radius, caster) {
  const mid = scale(add(a, b), 0.5);
  const reach = distance(a, b) / 2 + radius + 1;
  return targetsNear(dimension, mid, reach, caster).filter(
    (e) => segmentDistance(bodyCenter(e), a, b) <= radius + 0.5
  );
}

export function hit(target, caster, amount) {
  try {
    return target.applyDamage(amount, { cause: EntityDamageCause.entityAttack, damagingEntity: caster });
  } catch {
    return false;
  }
}

export function knock(target, dir, horizontal, vertical) {
  try {
    target.applyKnockback(dir.x, dir.z, horizontal, vertical);
  } catch {
    // some entities cannot be knocked back
  }
}

/** Damage + knockback for everyone in a sphere, weaker at the edge. */
export function blast(dimension, location, radius, damage, caster, push = 1.2) {
  for (const e of targetsNear(dimension, location, radius, caster)) {
    const c = bodyCenter(e);
    const d = distance(c, location);
    const falloff = Math.max(0.35, 1 - d / (radius + 0.5));
    hit(e, caster, damage * falloff);
    const away = { x: c.x - location.x, y: 0, z: c.z - location.z };
    const h = Math.hypot(away.x, away.z) || 1;
    knock(e, { x: away.x / h, y: 0, z: away.z / h }, push * falloff, 0.35 * falloff + 0.1);
  }
}

/** Vanilla explosion (terrain + sound); the caster is shielded from its own blast. */
export function explode(dimension, location, radius, caster, breaksBlocks) {
  try {
    if (caster.isValid() && distance(caster.location, location) < radius * 2 + 2) {
      caster.addEffect('resistance', 12, { amplifier: 4, showParticles: false });
    }
  } catch {
    // ignore
  }
  try {
    dimension.createExplosion(location, radius, {
      breaksBlocks,
      causesFire: false,
      allowUnderwater: true,
      source: caster.isValid() ? caster : undefined,
    });
  } catch {
    // unloaded chunk
  }
}

/** First solid block along a ray: {block, face, point, distance} or undefined. */
export function rayBlock(dimension, origin, dir, maxDistance) {
  try {
    const hitInfo = dimension.getBlockFromRay(origin, dir, {
      maxDistance,
      includeLiquidBlocks: false,
      includePassableBlocks: false,
    });
    if (!hitInfo) return undefined;
    const point = add(hitInfo.block.location, hitInfo.faceLocation);
    return { block: hitInfo.block, face: hitInfo.face, point, distance: distance(origin, point) };
  } catch {
    return undefined;
  }
}

const WALK_THROUGH = new Set([
  'minecraft:tallgrass',
  'minecraft:short_grass',
  'minecraft:tall_grass',
  'minecraft:fern',
  'minecraft:yellow_flower',
  'minecraft:red_flower',
  'minecraft:double_plant',
  'minecraft:deadbush',
  'minecraft:vine',
  'minecraft:torch',
  'minecraft:snow_layer',
  'minecraft:light_block',
  'minecraft:redstone_wire',
  'minecraft:rail',
]);

/** True when the block at `location` lets a player stand inside it. */
export function isOpen(dimension, location) {
  try {
    const block = dimension.getBlock(location);
    if (!block) return false;
    if (block.isAir) return true;
    if (block.isLiquid) return false;
    const permutation = block.permutation;
    for (const id of WALK_THROUGH) {
      try {
        if (permutation.matches(id)) return true;
      } catch {
        // block name unknown in this game version
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * The point under the caster's crosshair: the first block or creature it looks
 * at. With `dir` given, aims along that direction instead (blocks only).
 */
export function aimPoint(caster, maxDistance, dir) {
  const eye = caster.getHeadLocation();
  const look = dir ?? caster.getViewDirection();
  const wall = rayBlock(caster.dimension, eye, look, maxDistance);
  let reach = wall ? wall.distance : maxDistance;
  if (!dir) {
    try {
      for (const seen of caster.getEntitiesFromViewDirection({ maxDistance: reach })) {
        if (seen.distance < reach && isTarget(seen.entity, caster)) reach = seen.distance;
      }
    } catch {
      // ignore
    }
  }
  return along(eye, look, reach);
}
