// Flying Guardian - combat & companion enhancements.
//
// Uses only the stable @minecraft/server 1.10.0 API, so no experimental toggles are needed.
// Every feature here is an extra layer on top of the entity JSON: taming, following, sitting
// and the basic claw attacks all work from the behavior pack alone.
//
//  * Claw strikes hit harder: strong knockback, ember sparks and an impact sound.
//  * Infernal Dive: once engaged with a foe, the guardian periodically launches itself through
//    the air at it, dealing bonus damage plus a shockwave that only affects hostile mobs.
//  * Long-range catch-up: if its owner gets far away (elytra, fast boat over the ocean...),
//    the guardian teleports back beside them.
//
// Safety rules: a tamed guardian never treats a player as a foe, and the dive shockwave only
// touches mobs in the "monster"/"hoglin" families, so the owner and friendly players can never be
// hurt by these effects.

import { world, system } from "@minecraft/server";

const GUARDIAN_ID = "fguard:flying_guardian";
const DIMENSION_IDS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
const HOSTILE_FAMILIES = ["monster", "hoglin"];

const CLAW_KNOCKBACK = { horizontal: 1.15, vertical: 0.4 };
const CLAW_KNOCKBACK_PLAYER = { horizontal: 0.6, vertical: 0.3 };

const DIVE = {
  minDistance: 4.5, // only dive at foes at least this far away...
  maxDistance: 18, // ...and no farther than this
  speed: 1.1, // blocks per tick while diving
  impactDistance: 2.6,
  maxTicks: 30,
  cooldownTicks: 110,
  bonusDamage: 10,
  shockRadius: 3.5,
  shockDamage: 6,
};

const FOE_MEMORY_TICKS = 240; // forget a foe after 12 seconds without contact
const OWNER_TELEPORT_DISTANCE = 28; // blocks; the JSON follow_owner teleport handles shorter gaps
const SCAN_INTERVAL = 5; // ticks between guardian scans
const OWNER_PROPERTY = "fguard:owner";
const DIVING_PROPERTY = "fguard:diving";

/** Per-guardian combat memory: guardian id -> { foe, foeTick, nextDive, seenTick } */
const brains = new Map();
/** Guardians currently diving: guardian id -> { guardian, foe, endTick } */
const dives = new Map();
/** Entity id -> last tick in which hit effects are suppressed (damage dealt by this script). */
const suppressed = new Map();

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

function isValid(entity) {
  try {
    return entity !== undefined && entity.isValid();
  } catch {
    return false;
  }
}

function isAlive(entity) {
  if (!isValid(entity)) return false;
  try {
    const health = entity.getComponent("minecraft:health");
    return health === undefined || health.currentValue > 0;
  } catch {
    return false;
  }
}

function isGuardian(entity) {
  return isValid(entity) && entity.typeId === GUARDIAN_ID;
}

function isPlayer(entity) {
  return isValid(entity) && entity.typeId === "minecraft:player";
}

function isTamed(guardian) {
  try {
    return guardian.getComponent("minecraft:variant")?.value === 1;
  } catch {
    return false;
  }
}

function isStaying(guardian) {
  try {
    return guardian.getComponent("minecraft:mark_variant")?.value === 1;
  } catch {
    return false;
  }
}

// The entity JSON sets skin_id to 1 while the guardian is on a lead (see "fguard:leashed").
function isLeashed(guardian) {
  try {
    return guardian.getComponent("minecraft:skin_id")?.value === 1;
  } catch {
    return false;
  }
}

function isHostile(entity) {
  try {
    return HOSTILE_FAMILIES.some((family) => entity.matches({ families: [family] }));
  } catch {
    return false;
  }
}

function center(entity) {
  const feet = entity.location;
  try {
    const head = entity.getHeadLocation();
    return { x: feet.x, y: (feet.y + head.y) / 2, z: feet.z };
  } catch {
    return { x: feet.x, y: feet.y + 0.9, z: feet.z };
  }
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function length(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function horizontalDirection(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.0001) return { x: 0, z: 1 };
  return { x: dx / len, z: dz / len };
}

function spawnParticle(dimension, effect, location) {
  try {
    dimension.spawnParticle(effect, location);
  } catch {
    // The chunk may be unloading; particles are purely cosmetic.
  }
}

function playSound(soundId, location, volume, pitch) {
  try {
    world.playSound(soundId, location, { volume, pitch });
  } catch {
    // Cosmetic only.
  }
}

function setDiving(guardian, value) {
  try {
    guardian.setProperty(DIVING_PROPERTY, value);
  } catch {
    // Entity may have been removed.
  }
}

function suppressHitEffects(entity) {
  suppressed.set(entity.id, system.currentTick + 2);
}

function hitEffectsSuppressed(entity, now) {
  const until = suppressed.get(entity.id);
  return until !== undefined && now <= until;
}

function getBrain(guardian) {
  let brain = brains.get(guardian.id);
  if (!brain) {
    brain = { foe: undefined, foeTick: 0, nextDive: 0, seenTick: system.currentTick };
    brains.set(guardian.id, brain);
  }
  return brain;
}

function rememberFoe(guardian, foe, now) {
  if (!isValid(foe) || foe.id === guardian.id || isGuardian(foe)) return;
  // A tamed guardian never treats a player as a foe.
  if (isPlayer(foe) && isTamed(guardian)) return;
  const brain = getBrain(guardian);
  brain.foe = foe;
  brain.foeTick = now;
}

function getOwnerId(guardian) {
  try {
    const id = guardian.getDynamicProperty(OWNER_PROPERTY);
    return typeof id === "string" ? id : undefined;
  } catch {
    return undefined;
  }
}

function findPlayer(id) {
  for (const player of world.getAllPlayers()) {
    if (player.id === id) return player;
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// Claw strikes
// ---------------------------------------------------------------------------------------------

function clawImpact(guardian, victim) {
  const dir = horizontalDirection(guardian.location, victim.location);
  const kb = isPlayer(victim) ? CLAW_KNOCKBACK_PLAYER : CLAW_KNOCKBACK;
  try {
    victim.applyKnockback(dir.x, dir.z, kb.horizontal, kb.vertical);
  } catch {
    // Some entities (e.g. bosses) refuse knockback.
  }
  const hitPoint = center(victim);
  spawnParticle(victim.dimension, "fguard:claw_impact", hitPoint);
  playSound("fguard.claw_impact", hitPoint, 1.0, 0.85 + Math.random() * 0.25);
}

world.afterEvents.entityHurt.subscribe((event) => {
  const victim = event.hurtEntity;
  const source = event.damageSource;
  const attacker = source.damagingEntity;
  const now = system.currentTick;

  // 1) A guardian landed a melee hit.
  if (isGuardian(attacker) && isValid(victim)) {
    if (source.cause !== "entityAttack") return;
    if (isPlayer(victim) && isTamed(attacker)) return;
    rememberFoe(attacker, victim, now);
    if (!hitEffectsSuppressed(victim, now)) clawImpact(attacker, victim);
    return;
  }

  // 2) A guardian got hurt: remember who did it (players never count for tamed guardians).
  if (isGuardian(victim)) {
    if (isValid(attacker)) rememberFoe(victim, attacker, now);
    return;
  }

  // 3) A player got hurt by a mob: nearby tamed guardians get ready to dive at the attacker.
  //    Hostile mobs always qualify; any other mob only if it hurt that guardian's own owner.
  if (isPlayer(victim) && isValid(attacker) && !isPlayer(attacker) && !isGuardian(attacker)) {
    const hostile = isHostile(attacker);
    let nearby = [];
    try {
      nearby = victim.dimension.getEntities({ type: GUARDIAN_ID, location: victim.location, maxDistance: 24 });
    } catch {
      return;
    }
    for (const guardian of nearby) {
      if (!isTamed(guardian) || isStaying(guardian)) continue;
      if (hostile || getOwnerId(guardian) === victim.id) rememberFoe(guardian, attacker, now);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Infernal Dive (flying attack)
// ---------------------------------------------------------------------------------------------

function hasClearPath(dimension, from, to, distance) {
  try {
    const hit = dimension.getBlockFromRay(from, scale(sub(to, from), 1 / distance), {
      maxDistance: distance,
      includeLiquidBlocks: false,
      includePassableBlocks: false,
    });
    return hit === undefined;
  } catch {
    return false;
  }
}

function startDive(guardian, foe, brain, now) {
  brain.nextDive = now + DIVE.cooldownTicks;
  dives.set(guardian.id, { guardian, foe, endTick: now + DIVE.maxTicks });
  setDiving(guardian, true);
  const origin = center(guardian);
  playSound("fguard.dive", origin, 1.2, 0.8 + Math.random() * 0.2);
  spawnParticle(guardian.dimension, "fguard:dive_burst", origin);
}

function endDive(id, guardian) {
  dives.delete(id);
  if (isValid(guardian)) setDiving(guardian, false);
}

function diveImpact(guardian, foe) {
  const dimension = guardian.dimension;
  const hitPoint = center(foe);
  const dir = horizontalDirection(guardian.location, foe.location);

  suppressHitEffects(foe);
  if (isPlayer(foe)) {
    // Only provoked wild guardians ever dive at players; keep it a shove, not an execution.
    try {
      foe.applyKnockback(dir.x, dir.z, 0.9, 0.35);
    } catch {}
  } else {
    try {
      foe.applyDamage(DIVE.bonusDamage, { cause: "entityAttack", damagingEntity: guardian });
    } catch {}
    try {
      foe.applyKnockback(dir.x, dir.z, 2.2, 0.55);
    } catch {}
  }

  // Shockwave: hostile mobs only. Players, pets, villagers and animals are never touched.
  for (const family of HOSTILE_FAMILIES) {
    let near = [];
    try {
      near = dimension.getEntities({ location: hitPoint, maxDistance: DIVE.shockRadius, families: [family] });
    } catch {}
    for (const mob of near) {
      if (mob.id === foe.id || isPlayer(mob) || isGuardian(mob)) continue;
      suppressHitEffects(mob);
      try {
        mob.applyDamage(DIVE.shockDamage, { cause: "entityAttack", damagingEntity: guardian });
      } catch {}
      const away = horizontalDirection(hitPoint, mob.location);
      try {
        mob.applyKnockback(away.x, away.z, 1.4, 0.45);
      } catch {}
    }
  }

  const ground = { x: hitPoint.x, y: foe.location.y + 0.15, z: hitPoint.z };
  spawnParticle(dimension, "fguard:shockwave", ground);
  spawnParticle(dimension, "fguard:shockwave_smoke", ground);
  spawnParticle(dimension, "fguard:claw_impact", hitPoint);
  playSound("fguard.dive_impact", hitPoint, 1.6, 0.75 + Math.random() * 0.15);
  playSound("fguard.shockwave", hitPoint, 1.0, 0.9 + Math.random() * 0.2);

  // Recoil upward after the strike.
  try {
    guardian.clearVelocity();
    guardian.applyImpulse({ x: -dir.x * 0.35, y: 0.45, z: -dir.z * 0.35 });
  } catch {}
}

function updateDive(id, dive, now) {
  const { guardian, foe } = dive;
  if (!isValid(guardian) || !isAlive(foe) || now > dive.endTick || foe.dimension.id !== guardian.dimension.id) {
    endDive(id, guardian);
    return;
  }
  const from = center(guardian);
  const offset = sub(center(foe), from);
  const distance = length(offset);
  if (distance <= DIVE.impactDistance) {
    diveImpact(guardian, foe);
    endDive(id, guardian);
    return;
  }
  const dir = scale(offset, 1 / distance);
  try {
    guardian.clearVelocity();
    guardian.applyImpulse(scale(dir, DIVE.speed));
    guardian.setRotation({
      x: (-Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) * 180) / Math.PI,
      y: (-Math.atan2(dir.x, dir.z) * 180) / Math.PI,
    });
  } catch {
    endDive(id, guardian);
    return;
  }
  if (now % 2 === 0) spawnParticle(guardian.dimension, "fguard:dive_trail", from);
}

function tryDive(guardian, tamed, now) {
  const brain = brains.get(guardian.id);
  if (!brain || !brain.foe) return;
  const foe = brain.foe;
  if (!isAlive(foe) || now - brain.foeTick > FOE_MEMORY_TICKS || foe.dimension.id !== guardian.dimension.id) {
    brain.foe = undefined;
    return;
  }
  if (tamed && (isStaying(guardian) || isPlayer(foe))) return;
  if (isLeashed(guardian) || now < brain.nextDive) return;

  const from = center(guardian);
  const to = center(foe);
  const distance = length(sub(to, from));
  if (distance < DIVE.minDistance || distance > DIVE.maxDistance) return;
  if (!hasClearPath(guardian.dimension, from, to, distance)) return;
  startDive(guardian, foe, brain, now);
}

// ---------------------------------------------------------------------------------------------
// Long-range catch-up teleport
// ---------------------------------------------------------------------------------------------

function catchUpWithOwner(guardian) {
  if (isStaying(guardian) || isLeashed(guardian) || dives.has(guardian.id)) return;
  const ownerId = getOwnerId(guardian);
  if (!ownerId) return;
  const owner = findPlayer(ownerId);
  if (!owner || owner.dimension.id !== guardian.dimension.id) return;
  if (length(sub(owner.location, guardian.location)) < OWNER_TELEPORT_DISTANCE) return;

  const view = owner.getViewDirection();
  const flat = Math.hypot(view.x, view.z) || 1;
  const behind = {
    x: owner.location.x - (view.x / flat) * 3,
    y: owner.location.y + 2.5,
    z: owner.location.z - (view.z / flat) * 3,
  };
  let moved = false;
  try {
    moved = guardian.tryTeleport(behind, { checkForBlocks: true });
  } catch {}
  if (!moved) {
    try {
      moved = guardian.tryTeleport({ x: owner.location.x, y: owner.location.y + 1, z: owner.location.z }, { checkForBlocks: true });
    } catch {}
  }
  if (moved) spawnParticle(guardian.dimension, "fguard:dive_burst", center(guardian));
}

// ---------------------------------------------------------------------------------------------
// Taming: remember the owner (for catch-up) and explain the controls once.
// ---------------------------------------------------------------------------------------------

world.afterEvents.dataDrivenEntityTrigger.subscribe(
  (event) => {
    const guardian = event.entity;
    if (!isGuardian(guardian)) return;
    let players = [];
    try {
      players = guardian.dimension.getPlayers({ location: guardian.location, maxDistance: 8 });
    } catch {
      return;
    }
    // Only record the owner when the taming player is unambiguous.
    if (players.length !== 1) return;
    const owner = players[0];
    try {
      guardian.setDynamicProperty(OWNER_PROPERTY, owner.id);
    } catch {}
    try {
      owner.sendMessage(
        "§6[Flying Guardian]§r It is now bound to you! Tap it with an empty hand: §eSit§r = stay, §eStand§r = follow. Feed it meat or emeralds to heal it."
      );
    } catch {}
  },
  { entityTypes: [GUARDIAN_ID], eventTypes: ["fguard:on_tame"] }
);

// ---------------------------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------------------------

world.afterEvents.entityRemove.subscribe((event) => {
  dives.delete(event.removedEntityId);
  brains.delete(event.removedEntityId);
});

function forgetStaleState(now) {
  for (const [id, brain] of brains) {
    if (now - brain.seenTick > 600) brains.delete(id);
  }
  for (const [id, until] of suppressed) {
    if (now > until) suppressed.delete(id);
  }
}

system.runInterval(() => {
  const now = system.currentTick;

  for (const [id, dive] of dives) {
    try {
      updateDive(id, dive, now);
    } catch {
      dives.delete(id);
    }
  }

  if (now % SCAN_INTERVAL !== 0) return;

  for (const dimensionId of DIMENSION_IDS) {
    let guardians = [];
    try {
      guardians = world.getDimension(dimensionId).getEntities({ type: GUARDIAN_ID });
    } catch {
      continue;
    }
    for (const guardian of guardians) {
      try {
        const tamed = isTamed(guardian);
        const brain = brains.get(guardian.id);
        if (brain) brain.seenTick = now;
        if (tamed) catchUpWithOwner(guardian);
        if (!dives.has(guardian.id)) tryDive(guardian, tamed, now);
      } catch {
        // Never let one entity break the loop for the others.
      }
    }
  }

  if (now % 100 === 0) forgetStaleState(now);
}, 1);
