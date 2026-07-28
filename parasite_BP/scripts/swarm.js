/**
 * Parasite - the swarm engine.
 *
 * Every parasite in the world is tracked here. On the swarm tick each one:
 *
 *   1. swallows dropped items around it
 *   2. bites anything alive that is not a parasite
 *   3. chews the blocks around it, leaving infested flesh behind
 *   4. grows a stage when it has eaten enough, and finally splits in two
 *
 * A parasite that has just spawned feeds in a frenzy for a few seconds, which is
 * what makes a fresh spawn strip its surroundings almost instantly.
 */

import { system, world } from "@minecraft/server";
import { TUNING, PARASITE_ID, FLESH_ID, getSetting } from "./config.js";
import { SOUNDS } from "./sounds.js";
import {
  blockIdAt,
  damageEntity,
  distance,
  entitiesNear,
  getEntityProp,
  groundY,
  healEntity,
  isEdibleId,
  isValidEntity,
  playSoundAt,
  randFloat,
  randInt,
  removeEntitySafe,
  setBlockSafe,
  setEntityProp,
  spawnEntitySafe,
  spawnParticleSafe,
  triggerEvent
} from "./util.js";

const STAGES = ["small", "large", "apex"];
const DIMENSION_IDS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

/** entity id -> tracked parasite */
const swarm = new Map();

let loopId = undefined;
let resyncIndex = 0;
let tickCounter = 0;

/* ------------------------------------------------------------------ set up -- */

export function initSwarm() {
  if (loopId !== undefined) return;
  loopId = system.runInterval(() => {
    try {
      swarmTick();
    } catch (error) {
      console.warn(`[Parasite] swarm tick: ${error}`);
    }
  }, TUNING.tickInterval);
}

/**
 * Starts tracking a parasite. Returns false when the population cap is full,
 * in which case the entity is told to despawn again.
 */
export function register(entity, options = {}) {
  if (!isValidEntity(entity)) return false;
  let id;
  try {
    id = entity.id;
  } catch {
    return false;
  }
  if (swarm.has(id)) return true;

  if (swarm.size >= getSetting("maxPopulation")) {
    triggerEvent(entity, "pm:despawn");
    removeEntitySafe(entity);
    return false;
  }

  const biomass = getEntityProp(entity, "pm:biomass", 0);
  const stage = getEntityProp(entity, "pm:stage", "small");

  const entry = {
    entity,
    id,
    biomass: typeof biomass === "number" ? biomass : 0,
    stage: STAGES.includes(stage) ? stage : "small",
    frenzyUntil: system.currentTick + (options.fresh === false ? 0 : 60),
    lastSplitTick: 0,
    biteBudget: 0
  };
  swarm.set(id, entry);

  if (options.fresh !== false) {
    try {
      const loc = entity.location;
      const dim = entity.dimension;
      playSoundAt(dim, loc, SOUNDS.spawn.custom, SOUNDS.spawn.vanilla, { volume: 1.2, pitch: randFloat(0.7, 1.1) });
      playSoundAt(dim, loc, SOUNDS.screech.custom, SOUNDS.screech.vanilla, { volume: 1.0, pitch: randFloat(0.6, 0.9) });
      for (let i = 0; i < 6; i++) {
        spawnParticleSafe(dim, "pm:parasite_spore", {
          x: loc.x + randFloat(-0.6, 0.6),
          y: loc.y + randFloat(0.1, 1.2),
          z: loc.z + randFloat(-0.6, 0.6)
        });
      }
    } catch {
      // the entity vanished between spawning and this call
    }
  }
  return true;
}

export function forget(entityId) {
  swarm.delete(entityId);
}

export function population() {
  return swarm.size;
}

/** Biomass reward when a parasite kills something. */
export function awardKill(killerId, victimTypeId) {
  const entry = swarm.get(killerId);
  if (!entry) return;
  const food = victimTypeId === "minecraft:player" ? TUNING.food.player : TUNING.food.mob;
  gain(entry, food);
  try {
    const loc = entry.entity.location;
    playSoundAt(entry.entity.dimension, loc, SOUNDS.bite.custom, SOUNDS.bite.vanilla, {
      volume: 1.1,
      pitch: randFloat(0.5, 0.8)
    });
    for (let i = 0; i < 8; i++) {
      spawnParticleSafe(entry.entity.dimension, "pm:parasite_gore", {
        x: loc.x + randFloat(-0.8, 0.8),
        y: loc.y + randFloat(0.2, 1.4),
        z: loc.z + randFloat(-0.8, 0.8)
      });
    }
  } catch {
    // ignore
  }
}

/** Removes every parasite in the world. Returns how many were killed. */
export function purgeAll() {
  let removed = 0;
  for (const entry of [...swarm.values()]) {
    if (isValidEntity(entry.entity)) {
      purgeEffect(entry.entity);
      removeEntitySafe(entry.entity);
    }
    swarm.delete(entry.id);
    removed++;
  }
  // Catch anything that was never tracked (loaded from an old save).
  for (const dimensionId of DIMENSION_IDS) {
    let dimension;
    try {
      dimension = world.getDimension(dimensionId);
    } catch {
      continue;
    }
    for (const entity of safeQuery(dimension)) {
      purgeEffect(entity);
      removeEntitySafe(entity);
      removed++;
    }
  }
  return removed;
}

/** Removes parasites close to a point. */
export function purgeNear(dimension, location, radius) {
  let removed = 0;
  for (const entity of entitiesNear(dimension, location, radius, { type: PARASITE_ID })) {
    try {
      swarm.delete(entity.id);
    } catch {
      // ignore
    }
    purgeEffect(entity);
    removeEntitySafe(entity);
    removed++;
  }
  return removed;
}

export function statusText() {
  if (swarm.size === 0) return "§7No parasites are alive.";
  const counts = { small: 0, large: 0, apex: 0 };
  let biomass = 0;
  for (const entry of swarm.values()) {
    counts[entry.stage] = (counts[entry.stage] ?? 0) + 1;
    biomass += entry.biomass;
  }
  return (
    `§c${swarm.size}§f alive §7(cap ${getSetting("maxPopulation")})\n` +
    `§7small: §f${counts.small}  §7large: §f${counts.large}  §7apex: §f${counts.apex}\n` +
    `§7total biomass eaten: §f${Math.round(biomass)}`
  );
}

/* ------------------------------------------------------------------- ticks -- */

function swarmTick() {
  tickCounter++;

  // Rotate through the dimensions so parasites loaded from disk get picked up.
  if (tickCounter % 4 === 0) resync();

  for (const entry of [...swarm.values()]) {
    if (!isValidEntity(entry.entity)) {
      swarm.delete(entry.id);
      continue;
    }
    try {
      feed(entry);
    } catch (error) {
      console.warn(`[Parasite] feed: ${error}`);
    }
  }
}

function resync() {
  const dimensionId = DIMENSION_IDS[resyncIndex % DIMENSION_IDS.length];
  resyncIndex++;
  let dimension;
  try {
    dimension = world.getDimension(dimensionId);
  } catch {
    return;
  }
  for (const entity of safeQuery(dimension)) {
    let id;
    try {
      id = entity.id;
    } catch {
      continue;
    }
    if (!swarm.has(id)) register(entity, { fresh: false });
  }
}

function safeQuery(dimension) {
  try {
    return dimension.getEntities({ type: PARASITE_ID });
  } catch {
    return [];
  }
}

/* ----------------------------------------------------------------- feeding -- */

function feed(entry) {
  const entity = entry.entity;
  let loc;
  let dimension;
  try {
    loc = entity.location;
    dimension = entity.dimension;
  } catch {
    swarm.delete(entry.id);
    return;
  }

  const frenzy = system.currentTick < entry.frenzyUntil;
  const radius = TUNING.radius[entry.stage] * (frenzy ? 1.35 : 1);
  let ateSomething = false;

  // 1. Dropped items get swallowed whole.
  for (const item of entitiesNear(dimension, loc, radius, { type: "minecraft:item" })) {
    if (removeEntitySafe(item)) {
      gain(entry, TUNING.food.item);
      ateSomething = true;
    }
  }
  for (const orb of entitiesNear(dimension, loc, radius, { type: "minecraft:xp_orb" })) {
    removeEntitySafe(orb);
  }

  // 2. Anything alive nearby gets bitten, on top of the normal melee attack.
  entry.biteBudget++;
  if (entry.biteBudget >= 4) {
    entry.biteBudget = 0;
    const damage = entry.stage === "apex" ? 4 : entry.stage === "large" ? 2 : 1;
    for (const victim of entitiesNear(dimension, loc, radius * 0.55, { excludeFamilies: ["parasite"] })) {
      let typeId;
      try {
        typeId = victim.typeId;
      } catch {
        continue;
      }
      if (typeId === "minecraft:item" || typeId === "minecraft:xp_orb" || typeId === "minecraft:lightning_bolt") {
        continue;
      }
      if (damageEntity(victim, damage, "entityAttack", entity)) ateSomething = true;
    }
  }

  // 3. Blocks.
  if (getSetting("eatBlocks")) {
    const perTick = biteCount(entry, frenzy);
    if (eatBlocks(entry, dimension, loc, radius, perTick)) ateSomething = true;
  }

  if (ateSomething) {
    healEntity(entity, TUNING.regenPerTick);
    if (Math.random() < 0.35) {
      playSoundAt(dimension, loc, SOUNDS.chew.custom, SOUNDS.chew.vanilla, {
        volume: 0.8,
        pitch: randFloat(0.5, 0.9)
      });
    }
    spawnParticleSafe(dimension, "pm:parasite_feed", { x: loc.x, y: loc.y + 0.4, z: loc.z });
  }

  if (Math.random() < 0.25) {
    spawnParticleSafe(dimension, "pm:parasite_spore", {
      x: loc.x + randFloat(-0.5, 0.5),
      y: loc.y + randFloat(0.2, 1.0),
      z: loc.z + randFloat(-0.5, 0.5)
    });
  }

  checkGrowth(entry);
  checkSplit(entry, dimension, loc);
}

/** How many blocks this parasite may eat on this swarm tick. */
function biteCount(entry, frenzy) {
  const perSecond = getSetting("biteRate");
  const stageFactor = entry.stage === "apex" ? 2.2 : entry.stage === "large" ? 1.3 : 0.7;
  const base = (perSecond * TUNING.tickInterval) / 20;
  const total = base * stageFactor * (frenzy ? 3 : 1);
  const whole = Math.floor(total);
  return whole + (Math.random() < total - whole ? 1 : 0);
}

function eatBlocks(entry, dimension, loc, radius, count) {
  let eaten = 0;
  let attempts = 0;

  while (eaten < count && attempts < count * 10 + 10) {
    attempts++;
    // Sample below as well as above: a feeding parasite burrows a crater into
    // whatever it is standing on instead of chewing at empty air.
    const angle = randFloat(0, Math.PI * 2);
    const dist = randFloat(0, radius);
    const down = Math.max(1, Math.round(radius * 0.8));
    const up = Math.max(1, Math.round(radius * 0.6));
    const target = {
      x: Math.floor(loc.x + Math.cos(angle) * dist),
      y: Math.floor(loc.y + randInt(-down, up)),
      z: Math.floor(loc.z + Math.sin(angle) * dist)
    };

    const id = blockIdAt(dimension, target);
    if (!isEdibleId(id)) continue;

    // Flesh is left on the ground, everything higher up just vanishes.
    const ground = groundY(dimension, target.x, target.z, loc.y + 2, 6);
    const isFloorLevel = ground !== undefined && target.y <= ground;
    const replacement = getSetting("leaveFlesh") && isFloorLevel && Math.random() < 0.45 ? FLESH_ID : "minecraft:air";

    if (setBlockSafe(dimension, target, replacement)) {
      eaten++;
      gain(entry, TUNING.food.block);
      spawnParticleSafe(dimension, "pm:parasite_feed", {
        x: target.x + 0.5,
        y: target.y + 0.5,
        z: target.z + 0.5
      });
    }
  }
  return eaten > 0;
}

function gain(entry, amount) {
  entry.biomass += amount;
  setEntityProp(entry.entity, "pm:biomass", entry.biomass);
}

/* ---------------------------------------------------------- growth & split -- */

function checkGrowth(entry) {
  const next =
    entry.stage === "small" && entry.biomass >= TUNING.growth.large
      ? { stage: "large", event: "pm:grow_large" }
      : entry.stage === "large" && entry.biomass >= TUNING.growth.apex
        ? { stage: "apex", event: "pm:grow_apex" }
        : undefined;
  if (!next) return;

  entry.stage = next.stage;
  setEntityProp(entry.entity, "pm:stage", next.stage);
  triggerEvent(entry.entity, next.event);

  try {
    const loc = entry.entity.location;
    const dimension = entry.entity.dimension;
    playSoundAt(dimension, loc, SOUNDS.grow.custom, SOUNDS.grow.vanilla, { volume: 1.3, pitch: 0.7 });
    for (let i = 0; i < 14; i++) {
      spawnParticleSafe(dimension, "pm:parasite_gore", {
        x: loc.x + randFloat(-1, 1),
        y: loc.y + randFloat(0, 1.6),
        z: loc.z + randFloat(-1, 1)
      });
    }
  } catch {
    // ignore
  }
}

function checkSplit(entry, dimension, loc) {
  if (!getSetting("breeding")) return;
  if (entry.stage !== "apex") return;
  if (entry.biomass < TUNING.growth.apex + TUNING.splitCost) return;
  if (system.currentTick - entry.lastSplitTick < TUNING.splitCooldownSeconds * 20) return;
  if (swarm.size >= getSetting("maxPopulation")) return;

  entry.lastSplitTick = system.currentTick;
  entry.biomass -= TUNING.splitCost;
  setEntityProp(entry.entity, "pm:biomass", entry.biomass);

  const spot = {
    x: loc.x + randFloat(-1.6, 1.6),
    y: loc.y + 0.2,
    z: loc.z + randFloat(-1.6, 1.6)
  };
  const child = spawnEntitySafe(dimension, PARASITE_ID, spot);
  if (!child) return;

  register(child);
  playSoundAt(dimension, loc, SOUNDS.split.custom, SOUNDS.split.vanilla, { volume: 1.2, pitch: 0.8 });
  for (let i = 0; i < 12; i++) {
    spawnParticleSafe(dimension, "pm:parasite_gore", {
      x: spot.x + randFloat(-0.7, 0.7),
      y: spot.y + randFloat(0, 1.2),
      z: spot.z + randFloat(-0.7, 0.7)
    });
  }
}

function purgeEffect(entity) {
  try {
    const loc = entity.location;
    const dimension = entity.dimension;
    playSoundAt(dimension, loc, SOUNDS.die.custom, SOUNDS.die.vanilla, { volume: 1, pitch: randFloat(0.8, 1.2) });
    for (let i = 0; i < 10; i++) {
      spawnParticleSafe(dimension, "pm:parasite_gore", {
        x: loc.x + randFloat(-0.6, 0.6),
        y: loc.y + randFloat(0, 1.2),
        z: loc.z + randFloat(-0.6, 0.6)
      });
    }
  } catch {
    // ignore
  }
}

/** Distance from a point to the closest parasite, for the warning readout. */
export function nearestParasite(dimension, location) {
  let best = undefined;
  for (const entry of swarm.values()) {
    try {
      if (entry.entity.dimension.id !== dimension.id) continue;
      const dist = distance(entry.entity.location, location);
      if (!best || dist < best.dist) best = { entry, dist };
    } catch {
      // ignore
    }
  }
  return best;
}
