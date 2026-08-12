/**
 * The Mycelium-X infection model.
 *
 * Mycelium-X is entirely fictional: a made-up in-game status effect measured
 * 0..100 and driven by contact with the pack's own mobs and blocks. It has no
 * real-world referent and models nothing outside this add-on.
 *
 * Progression: HEALTHY -> EXPOSED (10) -> INFECTED (40) -> CRITICAL (75).
 * Below INFECTED the body clears it slowly on its own; at or above INFECTED it
 * climbs until treated, which is what makes the medkit and suppressant matter.
 */

import { system, world } from "@minecraft/server";
import { playerState, writeInfection } from "./state.js";
import { stageIndex, STAGES } from "./ui.js";

/** Bite strength per infected type. Also the set membership test. */
export const INFECTED_TYPES = {
  "myc:infected_walker": 8,
  "myc:infected_runner": 6,
  "myc:fungal_brute": 16,
  "myc:spore_crawler": 5,
  "myc:mycelium_stalker": 14,
};

/** Contamination weight per block type, used for both exposure and scanning. */
export const CONTAMINANT_WEIGHT = {
  "myc:fungal_growth": 2,
  "myc:infected_block": 1,
  "myc:nest": 5,
  "myc:spore_vent": 3,
  "minecraft:mycelium": 1,
};

const DECAY_INTERVAL_SECONDS = 15; // natural clearance below INFECTED
const PROGRESS_INTERVAL_SECONDS = 8; // self-progression at or above INFECTED

let secondsCounter = 0;

export function safeBlock(dimension, location) {
  try {
    return dimension.getBlock(location);
  } catch {
    return undefined; // unloaded chunk
  }
}

// ------------------------------------------------------------ exposure ----

/**
 * @param kind "contact" for bites, "airborne" for spores and contaminated air.
 * Returns the amount actually applied after protective equipment.
 */
export function addInfection(player, amount, kind = "airborne") {
  const record = playerState(player);
  if (amount > 0) {
    if (record.immuneUntil > system.currentTick) return 0;
    if (record.sealedUntil > system.currentTick) return 0; // inside the bunker

    let multiplier = 1;
    if (kind === "airborne" && record.masked) {
      multiplier *= record.filterUntil > system.currentTick ? 0.1 : 0.3;
    }
    if (kind === "contact" && record.suited) {
      multiplier *= 0.4;
    }
    // A full rig is meant to feel decisive without being total immunity.
    if (record.masked && record.suited) multiplier *= 0.6;
    amount *= multiplier;
  }

  const before = record.infection;
  record.infection = Math.max(0, Math.min(100, record.infection + amount));
  const applied = record.infection - before;
  if (Math.round(before) !== Math.round(record.infection)) {
    writeInfection(player, record.infection);
  }
  return applied;
}

export function setInfection(player, value) {
  const record = playerState(player);
  record.infection = Math.max(0, Math.min(100, value));
  writeInfection(player, record.infection);
}

// ---------------------------------------------------------- environment --

/** One block sample at the feet and one at the head — cheap enough per second. */
function environmentalExposure(player) {
  const dimension = player.dimension;
  const origin = player.location;
  let weight = 0;
  for (const dy of [0, 1]) {
    const block = safeBlock(dimension, {
      x: Math.floor(origin.x),
      y: Math.floor(origin.y) + dy,
      z: Math.floor(origin.z),
    });
    if (block) weight += CONTAMINANT_WEIGHT[block.typeId] ?? 0;
  }
  // Standing directly on fungal ground counts too.
  const under = safeBlock(dimension, {
    x: Math.floor(origin.x),
    y: Math.floor(origin.y) - 1,
    z: Math.floor(origin.z),
  });
  if (under) weight += (CONTAMINANT_WEIGHT[under.typeId] ?? 0) * 0.5;
  return weight;
}

/**
 * Sparse lattice sample around a point. Used on demand by the scanner and the
 * detector, never on a tick path.
 */
export function sampleContamination(dimension, origin, radius = 6, step = 3) {
  let score = 0;
  let sampled = 0;
  for (let dx = -radius; dx <= radius; dx += step) {
    for (let dy = -2; dy <= 2; dy += 2) {
      for (let dz = -radius; dz <= radius; dz += step) {
        sampled++;
        const block = safeBlock(dimension, {
          x: Math.floor(origin.x) + dx,
          y: Math.floor(origin.y) + dy,
          z: Math.floor(origin.z) + dz,
        });
        if (block) score += CONTAMINANT_WEIGHT[block.typeId] ?? 0;
      }
    }
  }
  return { score, sampled };
}

export function countInfectedNear(dimension, location, maxDistance = 24) {
  try {
    return dimension.getEntities({
      families: ["myc_infected"],
      location,
      maxDistance,
    }).length;
  } catch {
    return 0;
  }
}

export function nestsNear(dimension, location, maxDistance = 48) {
  try {
    return dimension.getEntities({
      type: "myc:nest_core",
      location,
      maxDistance,
    });
  } catch {
    return [];
  }
}

// ------------------------------------------------------------- symptoms ---

function applyStageEffects(player, stage) {
  const opts = { showParticles: false };
  switch (stage) {
    case 1: // EXPOSED — barely noticeable
      if (secondsCounter % 20 === 0) {
        spawnSpores(player, 3);
        try {
          player.playSound("myc.infect", { volume: 0.25, pitch: 1.4 });
        } catch {}
      }
      break;
    case 2: // INFECTED — visibly impaired
      player.addEffect("weakness", 120, { ...opts, amplifier: 0 });
      if (secondsCounter % 25 === 0) {
        player.addEffect("nausea", 70, { showParticles: true, amplifier: 0 });
        spawnSpores(player, 6);
      }
      break;
    case 3: // CRITICAL — actively dying without treatment
      player.addEffect("weakness", 120, { ...opts, amplifier: 1 });
      player.addEffect("mining_fatigue", 120, { ...opts, amplifier: 0 });
      player.addEffect("slowness", 120, { ...opts, amplifier: 0 });
      if (secondsCounter % 10 === 0) {
        player.addEffect("wither", 40, { showParticles: true, amplifier: 0 });
        spawnSpores(player, 10);
      }
      if (secondsCounter % 30 === 0) {
        player.addEffect("blindness", 40, { showParticles: false, amplifier: 0 });
      }
      break;
    default:
      break;
  }
}

export function spawnSpores(entity, count = 6) {
  const effect = count >= 10 ? "myc:contamination_burst" : "myc:spores";
  try {
    const { x, y, z } = entity.location;
    entity.dimension.runCommandAsync(
      `particle ${effect} ${x.toFixed(2)} ${(y + 1).toFixed(2)} ${z.toFixed(2)}`
    ).catch(() => {});
  } catch {
    /* entity gone */
  }
}

function announceStage(player, record, index) {
  if (record.warnedStage === index) return;
  record.warnedStage = index;
  const stage = STAGES[index];
  const messages = [
    "§aYour bloodwork is clean. No Mycelium-X detected.",
    "§eSpore exposure detected. You feel a faint itch in your throat.",
    "§6Mycelium-X has taken hold. Your limbs are heavy — find treatment.",
    "§c§lCRITICAL INFECTION. §r§cThe fungus is spreading. You need a medkit now.",
  ];
  player.sendMessage(`${stage.colour}§l[MYCELIUM-X] §r${messages[index]}`);
  try {
    player.playSound(index >= 2 ? "myc.scanner.alert" : "myc.infect", {
      volume: 0.7,
      pitch: index >= 2 ? 0.7 : 1.1,
    });
  } catch {}
}

// -------------------------------------------------------------- per tick --

/** Called once per second for every online player. */
export function updatePlayer(player) {
  const record = playerState(player);

  // Environmental exposure.
  const exposure = environmentalExposure(player);
  if (exposure > 0) {
    addInfection(player, exposure * 0.35, "airborne");
  }

  // Self-progression above the INFECTED threshold, slow clearance below it.
  if (record.infection >= 40) {
    if (secondsCounter % PROGRESS_INTERVAL_SECONDS === 0) {
      addInfection(player, 1, "internal");
    }
  } else if (record.infection > 0 && exposure === 0) {
    if (secondsCounter % DECAY_INTERVAL_SECONDS === 0) {
      addInfection(player, -1);
    }
  }

  const index = stageIndex(record.infection);
  record.stage = index;
  announceStage(player, record, index);
  applyStageEffects(player, index);
}

export function tickInfection(players) {
  secondsCounter++;
  for (const player of players) {
    try {
      updatePlayer(player);
    } catch {
      /* player left mid-tick */
    }
  }
}

export function currentSecond() {
  return secondsCounter;
}

/** Bites from the pack's own mobs are the primary infection vector. */
export function registerCombatHooks() {
  world.afterEvents.entityHurt.subscribe((event) => {
    try {
      const victim = event.hurtEntity;
      if (!victim || victim.typeId !== "minecraft:player") return;
      const attacker = event.damageSource?.damagingEntity;
      if (!attacker) return;
      const bite = INFECTED_TYPES[attacker.typeId];
      if (!bite) return;
      const applied = addInfection(victim, bite, "contact");
      if (applied > 0.5) {
        spawnSpores(victim, 4);
        try {
          victim.playSound("myc.infect", { volume: 0.5, pitch: 0.9 });
        } catch {}
      }
    } catch {
      /* ignore */
    }
  });

  // A crawler bursting leaves a contaminated patch behind it.
  world.afterEvents.entityDie.subscribe((event) => {
    try {
      const dead = event.deadEntity;
      if (!dead || dead.typeId !== "myc:spore_crawler") return;
      spawnSpores(dead, 12);
      for (const player of dead.dimension.getEntities({
        type: "minecraft:player",
        location: dead.location,
        maxDistance: 3,
      })) {
        addInfection(player, 4, "airborne");
      }
    } catch {
      /* ignore */
    }
  });
}
