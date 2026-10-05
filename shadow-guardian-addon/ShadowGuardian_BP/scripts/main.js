// =============================================================================
//  SHADOW GUARDIAN - script powers
//  Minecraft Bedrock 1.21.0 - uses only the STABLE @minecraft/server API
//  (version 1.10.0 in the manifest; it also works with 1.11.0).
//  No "Beta APIs" or other experimental switch is needed.
//
//  The entity itself (flying, health, taming, following, fighting, sit/stay,
//  immunities) lives in entities/shadow_guardian.json.
//  This script adds: teleport to owner, self heal, lightning, and the NUKE.
//  Test the nuke any time (cheats on):   /scriptevent sg:nuke
// =============================================================================
import { world, system, Player } from "@minecraft/server";

// =============================================================================
//  SETTINGS  -  change the numbers below, save the file, then re-open the world
// =============================================================================

// ---- The special attack (the "nuke") ----------------------------------------
const EXPLOSION_SIZE = 15;           // Blast radius in blocks. TNT = 4, default = 15, huge = 25. Max = 50.
const BREAK_BLOCKS = true;           // true  = the blast breaks blocks and makes a crater
                                     // false = the blast does NOT break any blocks
const EXPLOSION_FIRE = true;         // true  = the blast sets fires
const NUKE_COOLDOWN_SECONDS = 60;    // seconds to wait between two nukes
const NUKE_MIN_ENEMIES = 6;          // use the nuke when this many enemies are near you ...
const NUKE_SAVE_ME_HEARTS = 3;       // ... or when you have this many hearts (or less) and an enemy is close

// ---- Other powers -------------------------------------------------------------
const LIGHTNING_ENABLED = true;      // true = the guardian calls lightning on enemies
const LIGHTNING_COOLDOWN_SECONDS = 5;
const LIGHTNING_RANGE = 24;          // how far (blocks) it can see enemies for lightning
const HEAL_AMOUNT = 4;               // health points it heals ...   (1 heart = 2 health points)
const HEAL_EVERY_SECONDS = 5;        // ... every this many seconds
const TELEPORT_DISTANCE = 16;        // if you are farther than this many blocks, it teleports to you
const SHOW_MESSAGES = true;          // true = short messages above your hotbar

// =============================================================================
//  CODE  -  you do not need to change anything below this line
// =============================================================================

const GUARDIAN_ID = "sg:shadow_guardian";
const OWNER_KEY = "sg:owner";                       // saved on the guardian: who owns it
const DIMENSIONS = ["overworld", "nether", "the_end"];
const MAX_EXPLOSION_SIZE = 50;                      // safety limit, bigger blasts can freeze the game
const SIZE = Math.max(1, Math.min(MAX_EXPLOSION_SIZE, EXPLOSION_SIZE));
const TICKS = (seconds) => Math.round(seconds * 20);

// Monsters that stay calm until you hit them. The guardian leaves them alone.
const NEUTRAL_TYPES = ["minecraft:enderman", "minecraft:piglin", "minecraft:zombie_pigman"];
// Big threats: when one of these is near you, the guardian can use the nuke.
const BOSS_TYPES = ["minecraft:wither", "minecraft:warden", "minecraft:ender_dragon", "minecraft:elder_guardian", "minecraft:ravager"];
// Lightning must never hit these (it would turn them into something else, or charge them).
const LIGHTNING_UNSAFE_TYPES = [
  "minecraft:villager", "minecraft:villager_v2", "minecraft:wandering_trader",
  "minecraft:pig", "minecraft:mooshroom", "minecraft:creeper",
];

const nextLightning = new Map();   // guardian id -> tick when lightning is ready again
const nextNuke = new Map();        // guardian id -> tick when the nuke is ready again
const nextTeleport = new Map();    // guardian id -> tick when it may teleport again
const nukeRunning = new Set();     // guardians that are charging / firing right now
const seenErrors = new Set();

// ----------------------------------------------------------------------------
//  Small helpers
// ----------------------------------------------------------------------------
function report(error) {
  const text = String(error && error.stack ? error.stack : error);
  if (seenErrors.has(text)) return;          // print each different error only once
  seenErrors.add(text);
  console.warn("[ShadowGuardian] " + text);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function say(player, text) {
  if (!SHOW_MESSAGES || !player) return;
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch (e) {
    report(e);
  }
}

// Plays a sound for every player near a spot.
function playSoundNear(dimension, location, sound, volume, pitch) {
  for (const p of world.getAllPlayers()) {
    if (p.dimension.id === dimension.id && distance(p.location, location) < 160) {
      p.playSound(sound, { location, volume, pitch });
    }
  }
}

function allGuardians() {
  const found = [];
  for (const id of DIMENSIONS) {
    try {
      for (const g of world.getDimension(id).getEntities({ type: GUARDIAN_ID })) found.push(g);
    } catch (e) {
      report(e);
    }
  }
  return found;
}

function isTamed(guardian) {
  return guardian.hasComponent("minecraft:is_tamed");
}

// The entity file adds the family "sg_staying" while the guardian is told to stay.
function isStaying(guardian) {
  const families = guardian.getComponent("minecraft:type_family");
  return !!families && families.hasTypeFamily("sg_staying");
}

function nearestPlayer(entity, maxDistance) {
  let best;
  let bestDistance = maxDistance;
  for (const p of world.getAllPlayers()) {
    if (p.dimension.id !== entity.dimension.id) continue;
    const d = distance(p.location, entity.location);
    if (d <= bestDistance) {
      best = p;
      bestDistance = d;
    }
  }
  return best;
}

// Who owns this guardian? (The player who tamed it.)
function getOwner(guardian) {
  const savedId = guardian.getDynamicProperty(OWNER_KEY);
  if (typeof savedId === "string") {
    return world.getAllPlayers().find((p) => p.id === savedId);   // undefined when the owner is offline
  }
  const player = nearestPlayer(guardian, 32);                      // old guardian without a saved owner
  if (player) guardian.setDynamicProperty(OWNER_KEY, player.id);
  return player;
}

// ----------------------------------------------------------------------------
//  Who is an enemy?  (hostile monsters, but not the calm ones)
// ----------------------------------------------------------------------------
function enemiesNear(dimension, center, radius) {
  const options = { location: center, maxDistance: radius, families: ["monster"], excludeTypes: NEUTRAL_TYPES };
  const list = dimension.getEntities(options);
  for (const dragon of dimension.getEntities({ location: center, maxDistance: radius, type: "minecraft:ender_dragon" })) {
    list.push(dragon);
  }
  return list;
}

// Make a creature immune to damage for a few seconds, and to fire for longer
// (used for the nuke and lightning, so fires left behind cannot hurt anyone).
function shield(entity, damageTicks, fireTicks) {
  try {
    entity.addEffect("resistance", damageTicks, { amplifier: 255, showParticles: false });
    entity.addEffect("fire_resistance", fireTicks, { amplifier: 0, showParticles: false });
  } catch (e) {
    // some entities cannot get effects - that is fine
  }
}

// Shield everyone who is NOT an enemy: players, pets, villagers, animals.
function shieldFriends(dimension, center, radius, damageTicks, fireTicks) {
  const friends = dimension.getEntities({ location: center, maxDistance: radius, excludeFamilies: ["monster", "dragon"] });
  for (const e of friends) {
    if (e.hasComponent("minecraft:health")) shield(e, damageTicks, fireTicks);
  }
}

// ----------------------------------------------------------------------------
//  Heal, teleport
// ----------------------------------------------------------------------------
function heal(guardian) {
  const health = guardian.getComponent("minecraft:health");
  if (!health || health.currentValue >= health.effectiveMax) return;
  health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + HEAL_AMOUNT));
}

function keepCloseToOwner(guardian, owner, now) {
  const sameWorld = guardian.dimension.id === owner.dimension.id;
  if (sameWorld && distance(guardian.location, owner.location) <= TELEPORT_DISTANCE) return;
  if (now < (nextTeleport.get(guardian.id) ?? 0)) return;
  nextTeleport.set(guardian.id, now + TICKS(2));
  const angle = Math.random() * Math.PI * 2;
  const spot = {
    x: owner.location.x + Math.cos(angle) * 2.5,
    y: owner.location.y + 1,
    z: owner.location.z + Math.sin(angle) * 2.5,
  };
  guardian.teleport(spot, { dimension: owner.dimension, keepVelocity: false });
}

// ----------------------------------------------------------------------------
//  Lightning
// ----------------------------------------------------------------------------
function isSafeForLightning(target) {
  const nearby = target.dimension.getEntities({ location: target.location, maxDistance: 5 });
  for (const e of nearby) {
    if (e.id === target.id) continue;
    if (LIGHTNING_UNSAFE_TYPES.includes(e.typeId)) return false;
    if (e.hasComponent("minecraft:is_tamed") && e.typeId !== GUARDIAN_ID) return false;   // pets
  }
  return true;
}

function strikeLightning(guardian, target, now) {
  if (target.typeId === "minecraft:creeper") return false;          // lightning would charge it
  if (!isSafeForLightning(target)) return false;
  const dimension = target.dimension;
  for (const p of world.getAllPlayers()) {                          // keep players safe from the bolt
    if (p.dimension.id === dimension.id && distance(p.location, target.location) < 8) shield(p, TICKS(3), TICKS(10));
  }
  dimension.spawnEntity("minecraft:lightning_bolt", target.location);
  nextLightning.set(guardian.id, now + TICKS(LIGHTNING_COOLDOWN_SECONDS));
  return true;
}

function lightningTick(guardian, center, now) {
  if (!LIGHTNING_ENABLED) return;
  if (now < (nextLightning.get(guardian.id) ?? 0)) return;
  const enemies = enemiesNear(guardian.dimension, center, LIGHTNING_RANGE);
  enemies.sort((a, b) => distance(a.location, guardian.location) - distance(b.location, guardian.location));
  for (const enemy of enemies) {
    if (strikeLightning(guardian, enemy, now)) return;
  }
}

// When an enemy hurts the owner, the guardian punishes it with lightning right away.
world.afterEvents.entityHurt.subscribe((event) => {
  try {
    if (!LIGHTNING_ENABLED || event.hurtEntity.typeId !== "minecraft:player") return;
    const attacker = event.damageSource.damagingEntity;
    if (!attacker || attacker.typeId === "minecraft:player") return;
    if (!attacker.getComponent("minecraft:type_family")?.hasTypeFamily("monster")) return;
    if (NEUTRAL_TYPES.includes(attacker.typeId)) return;
    for (const g of allGuardians()) {
      if (!isTamed(g) || isStaying(g) || g.getDynamicProperty(OWNER_KEY) !== event.hurtEntity.id) continue;
      if (g.dimension.id !== attacker.dimension.id || distance(g.location, attacker.location) > 40) continue;
      if (system.currentTick < (nextLightning.get(g.id) ?? 0)) continue;
      strikeLightning(g, attacker, system.currentTick);
    }
  } catch (e) {
    report(e);
  }
});

// ----------------------------------------------------------------------------
//  The NUKE
// ----------------------------------------------------------------------------
const CHARGE_TICKS = 30;     // 1.5 seconds of charging before the blast

// A ring of particles around a point (the effects are only for show).
function ring(dimension, particle, center, radius, points, y) {
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    dimension.spawnParticle(particle, { x: center.x + Math.cos(a) * radius, y: y ?? center.y + 0.5, z: center.z + Math.sin(a) * radius });
  }
}

function pushAway(entity, center, reach) {
  const dx = entity.location.x - center.x;
  const dz = entity.location.z - center.z;
  const length = Math.hypot(dx, dz);
  const closeness = Math.max(0, 1 - length / reach);
  const dirX = length < 0.1 ? 1 : dx / length;
  const dirZ = length < 0.1 ? 0 : dz / length;
  entity.applyKnockback(dirX, dirZ, 1.2 + 2.2 * closeness, 0.7 + 0.8 * closeness);
}

// The shockwave: a ring that grows outward and throws every enemy away.
function shockwave(dimension, center) {
  const reach = SIZE * 3;
  const steps = 10;
  const thrown = new Set();
  let step = 0;
  const id = system.runInterval(() => {
    try {
      step++;
      const radius = (reach * step) / steps;
      for (const enemy of enemiesNear(dimension, center, radius)) {
        if (thrown.has(enemy.id)) continue;
        thrown.add(enemy.id);
        pushAway(enemy, center, reach);
      }
      if (step % 2 === 0) ring(dimension, "minecraft:explosion_particle", center, radius, Math.min(36, Math.ceil(radius * 2)));
    } catch (e) {
      report(e);
    }
    if (step >= steps) system.clearRun(id);
  }, 1);
}

// The mushroom cloud: a rising stem, then a wide cap.
function mushroomCloud(dimension, center) {
  const height = SIZE * 1.6;
  const steps = 40;
  let step = 0;
  const id = system.runInterval(() => {
    try {
      step++;
      const t = step / steps;
      const y = center.y + t * height;
      const spread = SIZE * 0.12;
      for (let i = 0; i < 3; i++) {
        const at = { x: center.x + (Math.random() - 0.5) * spread, y, z: center.z + (Math.random() - 0.5) * spread };
        dimension.spawnParticle("minecraft:large_explosion", at);
        dimension.spawnParticle("minecraft:basic_flame_particle", at);
      }
      dimension.spawnParticle("minecraft:lava_particle", { x: center.x, y: center.y + 1 + Math.random() * 3, z: center.z });
      if (t > 0.6) {
        const radius = SIZE * 0.7 * ((t - 0.6) / 0.4);
        ring(dimension, "minecraft:large_explosion", { x: center.x, y: 0, z: center.z }, radius, 8, center.y + height);
        ring(dimension, "minecraft:basic_smoke_particle", { x: center.x, y: 0, z: center.z }, radius * 0.8, 10, center.y + height - 1);
      }
    } catch (e) {
      report(e);
    }
    if (step >= steps) system.clearRun(id);
  }, 1);
}

function detonate(guardian, owner, center) {
  const dimension = guardian.dimension;
  const zone = SIZE * 2 + 6;

  // 1. Protect everyone who is not an enemy (you, other players, pets, villagers, animals).
  shieldFriends(dimension, center, zone, TICKS(8), TICKS(40));

  // 2. The blast. The OWNER is the "source" of the explosion, and the game never
  //    hurts or pushes the source of an explosion - so the owner is 100% safe.
  const source = owner && owner.isValid() ? owner : guardian;
  dimension.createExplosion(center, SIZE, {
    source,
    breaksBlocks: BREAK_BLOCKS,
    causesFire: EXPLOSION_FIRE,
    allowUnderwater: true,
  });

  // 3. Fire on the enemies, the shockwave, the cloud, the sounds.
  if (EXPLOSION_FIRE) {
    for (const enemy of enemiesNear(dimension, center, SIZE * 1.5)) enemy.setOnFire(10, true);
  }
  shockwave(dimension, center);
  mushroomCloud(dimension, center);
  dimension.spawnParticle("minecraft:huge_explosion_emitter", center);
  ring(dimension, "minecraft:huge_explosion_emitter", center, SIZE * 0.5, 6);
  playSoundNear(dimension, center, "random.explode", 10, 0.5);
  playSoundNear(dimension, center, "mob.warden.sonic_boom", 10, 0.6);
  playSoundNear(dimension, center, "ambient.weather.thunder", 10, 0.7);
}

function startNuke(guardian, owner, center, now) {
  const guardianId = guardian.id;
  if (nukeRunning.has(guardianId)) return;
  nukeRunning.add(guardianId);
  nextNuke.set(guardianId, now + TICKS(NUKE_COOLDOWN_SECONDS));
  say(owner, "§c§lShadow Guardian is charging a NUKE!");
  const dimension = guardian.dimension;
  playSoundNear(dimension, guardian.location, "mob.warden.sonic_charge", 8, 0.8);

  let tick = 0;
  const id = system.runInterval(() => {
    tick++;
    if (!guardian.isValid()) {                                       // the guardian is gone: cancel the nuke
      system.clearRun(id);
      nukeRunning.delete(guardianId);
      return;
    }
    try {
      const squeeze = 1 - tick / CHARGE_TICKS;                       // the ring shrinks to the guardian
      ring(dimension, "minecraft:endrod", guardian.location, 0.5 + 3.5 * squeeze, 10, guardian.location.y + 1);
      if (tick % 6 === 0) ring(dimension, "minecraft:basic_flame_particle", center, SIZE, Math.min(48, SIZE * 3), center.y + 0.3);
      if (tick >= CHARGE_TICKS) {
        system.clearRun(id);
        nukeRunning.delete(guardianId);
        detonate(guardian, owner, center);
      }
    } catch (e) {
      system.clearRun(id);
      nukeRunning.delete(guardianId);
      report(e);
    }
  }, 1);
}

// The densest group of enemies is the best place for the blast.
function bestTarget(enemies) {
  let best = enemies[0];
  let bestCount = -1;
  for (const a of enemies) {
    let count = 0;
    for (const b of enemies) if (distance(a.location, b.location) < 6) count++;
    if (count > bestCount) {
      best = a;
      bestCount = count;
    }
  }
  return { x: best.location.x, y: best.location.y, z: best.location.z };
}

function nukeTick(guardian, owner, now) {
  if (nukeRunning.has(guardian.id) || now < (nextNuke.get(guardian.id) ?? 0)) return;
  const enemies = enemiesNear(owner.dimension, owner.location, 20);
  if (enemies.length === 0) return;
  const hearts = (owner.getComponent("minecraft:health")?.currentValue ?? 20) / 2;
  const crowd = enemies.length >= NUKE_MIN_ENEMIES;
  const boss = enemies.some((e) => BOSS_TYPES.includes(e.typeId));
  const inDanger = hearts <= NUKE_SAVE_ME_HEARTS && enemies.some((e) => distance(e.location, owner.location) < 10);
  if (crowd || boss || inDanger) startNuke(guardian, owner, bestTarget(enemies), now);
}

// ----------------------------------------------------------------------------
//  Main loop: runs twice every second for every tamed guardian
// ----------------------------------------------------------------------------
const HEAL_EVERY_LOOPS = Math.max(1, Math.round((HEAL_EVERY_SECONDS * 20) / 10));
let loops = 0;

system.runInterval(() => {
  loops++;
  const now = system.currentTick;
  for (const guardian of allGuardians()) {
    try {
      if (!guardian.isValid() || !isTamed(guardian)) continue;
      if (loops % HEAL_EVERY_LOOPS === 0) heal(guardian);
      const owner = getOwner(guardian);
      if (isStaying(guardian)) {
        lightningTick(guardian, guardian.location, now);          // standing guard: only strikes nearby enemies
      } else if (owner) {
        keepCloseToOwner(guardian, owner, now);
        lightningTick(guardian, owner.location, now);
        nukeTick(guardian, owner, now);
      }
    } catch (e) {
      report(e);
    }
  }
}, 10);

// ----------------------------------------------------------------------------
//  Messages when you tame it or tell it to stay / follow
// ----------------------------------------------------------------------------
world.afterEvents.dataDrivenEntityTrigger.subscribe((event) => {
  try {
    const guardian = event.entity;
    if (guardian.typeId !== GUARDIAN_ID) return;
    const player = nearestPlayer(guardian, 12);
    if (event.eventId === "sg:on_tame") {
      if (player) guardian.setDynamicProperty(OWNER_KEY, player.id);
      say(player, "§bShadow Guardian is yours! §fSneak + tap it to make it stay or follow.");
    } else if (event.eventId === "sg:stay") {
      say(player, "§bShadow Guardian: §fI will stay here.");
    } else if (event.eventId === "sg:follow") {
      say(player, "§bShadow Guardian: §fI am following you.");
    } else if (event.eventId === "sg:hint") {
      say(player, "§bShadow Guardian: §fSneak + tap me to make me stay.");
    }
  } catch (e) {
    report(e);
  }
});

// ----------------------------------------------------------------------------
//  Test command:  /scriptevent sg:nuke   -> your guardian nukes the spot you look at
// ----------------------------------------------------------------------------
system.afterEvents.scriptEventReceive.subscribe((event) => {
  try {
    if (event.id !== "sg:nuke") return;
    const source = event.sourceEntity;
    const player = source instanceof Player ? source : world.getAllPlayers()[0];
    if (!player) return;
    let guardian;
    let bestDistance = 64;
    for (const g of allGuardians()) {
      if (!isTamed(g) || g.dimension.id !== player.dimension.id) continue;
      if (g.getDynamicProperty(OWNER_KEY) !== player.id) continue;
      const d = distance(g.location, player.location);
      if (d < bestDistance) {
        guardian = g;
        bestDistance = d;
      }
    }
    if (!guardian) {
      say(player, "§cYou have no tamed Shadow Guardian near you.");
      return;
    }
    const look = player.getViewDirection();
    const center = { x: player.location.x + look.x * 14, y: player.location.y, z: player.location.z + look.z * 14 };
    startNuke(guardian, player, center, system.currentTick);
  } catch (e) {
    report(e);
  }
});

console.warn("[ShadowGuardian] loaded. Explosion size " + SIZE + ", break blocks " + BREAK_BLOCKS + ".");
