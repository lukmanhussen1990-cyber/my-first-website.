/**
 * The outbreak director.
 *
 * Everything here is budgeted. The pack never uses vanilla spawn rules for the
 * infected, so the only way one appears is through this file, which means the
 * mob population on a phone is bounded by construction rather than by luck:
 *
 *   - at most one spawn attempt per player per director tick (5s),
 *   - a hard local cap of 3 + 2*level infected within 48 blocks of a player,
 *   - spawn-point search costs ~13 block reads per attempt and gives up fast,
 *   - nests only tick when a player is within 48 blocks of them.
 */

import { world } from "@minecraft/server";
import { getGlobal, runCmd, setGlobal } from "./state.js";
import { countInfectedNear, nestsNear, safeBlock, spawnSpores } from "./infection.js";

const DIRECTOR_PERIOD_TICKS = 100; // 5 seconds
const TICKS_PER_MC_DAY = 24000;
const MAX_LEVEL = 5;

/** Weighted spawn tables per danger level. Higher level, nastier mix. */
const SPAWN_TABLE = {
  1: [["myc:infected_walker", 70], ["myc:spore_crawler", 30]],
  2: [["myc:infected_walker", 55], ["myc:spore_crawler", 25], ["myc:infected_runner", 20]],
  3: [["myc:infected_walker", 45], ["myc:spore_crawler", 20], ["myc:infected_runner", 25],
      ["myc:fungal_brute", 10]],
  4: [["myc:infected_walker", 35], ["myc:spore_crawler", 15], ["myc:infected_runner", 28],
      ["myc:fungal_brute", 15], ["myc:mycelium_stalker", 7]],
  5: [["myc:infected_walker", 28], ["myc:spore_crawler", 12], ["myc:infected_runner", 28],
      ["myc:fungal_brute", 20], ["myc:mycelium_stalker", 12]],
};

const DAY_HEADLINES = [
  "",
  "§eDay 1 — scattered carriers. The spores are spreading quietly.",
  "§eDay 2 — the infected are moving faster now. Runners sighted.",
  "§6Day 3 — fungal brutes have emerged. Stay behind walls.",
  "§cDay 4 — stalkers are hunting. Do not travel alone at night.",
  "§4Day 5 — full outbreak. The surface belongs to Mycelium-X.",
];

function pickWeighted(table) {
  const total = table.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [type, weight] of table) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return table[0][0];
}

/**
 * Walk downward from a little above the origin looking for solid ground with
 * two air blocks over it. One block read per Y step, so an attempt is cheap.
 */
function findSpawnSpot(dimension, origin, minDist, maxDist) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = minDist + Math.random() * (maxDist - minDist);
    const x = Math.floor(origin.x + Math.cos(angle) * distance);
    const z = Math.floor(origin.z + Math.sin(angle) * distance);

    let groundY;
    for (let dy = 5; dy >= -7; dy--) {
      const y = Math.floor(origin.y) + dy;
      const block = safeBlock(dimension, { x, y, z });
      if (!block) break; // unloaded chunk, abandon this attempt
      if (block.typeId !== "minecraft:air") {
        if (block.typeId.includes("water") || block.typeId.includes("lava")) break;
        groundY = y;
        break;
      }
    }
    if (groundY === undefined) continue;

    const feet = safeBlock(dimension, { x, y: groundY + 1, z });
    const head = safeBlock(dimension, { x, y: groundY + 2, z });
    if (feet?.typeId === "minecraft:air" && head?.typeId === "minecraft:air") {
      return { x: x + 0.5, y: groundY + 1, z: z + 0.5 };
    }
  }
  return undefined;
}

function spawnAround(player, level) {
  const dimension = player.dimension;
  if (dimension.id !== "minecraft:overworld") return 0;

  const cap = 3 + level * 2;
  if (countInfectedNear(dimension, player.location, 48) >= cap) return 0;

  const spot = findSpawnSpot(dimension, player.location, 18, 30);
  if (!spot) return 0;

  const type = pickWeighted(SPAWN_TABLE[level] ?? SPAWN_TABLE[1]);
  try {
    const entity = dimension.spawnEntity(type, spot);
    spawnSpores(entity, 4);
    return 1;
  } catch {
    return 0; // spawn point became invalid
  }
}

// ---------------------------------------------------------------- nests ---

/**
 * Stamps a contaminated zone: a fungal pad, some vents and infected stone, and
 * the nest core that anchors spawning. One-off command burst, no ticking cost.
 */
export function plantNest(dimension, location) {
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  const z = Math.floor(location.z);

  runCmd(`fill ${x - 4} ${y - 1} ${z - 4} ${x + 4} ${y - 1} ${z + 4} myc:fungal_growth replace minecraft:grass_block`);
  runCmd(`fill ${x - 3} ${y - 1} ${z - 3} ${x + 3} ${y - 1} ${z + 3} myc:fungal_growth replace minecraft:dirt`);
  runCmd(`fill ${x - 2} ${y - 1} ${z - 2} ${x + 2} ${y - 1} ${z + 2} myc:infected_block replace minecraft:stone`);
  runCmd(`setblock ${x} ${y} ${z} myc:nest`);
  runCmd(`setblock ${x + 3} ${y} ${z} myc:spore_vent`);
  runCmd(`setblock ${x - 3} ${y} ${z} myc:spore_vent`);
  runCmd(`setblock ${x} ${y} ${z + 3} myc:spore_vent`);
  runCmd(`setblock ${x} ${y} ${z - 3} myc:spore_vent`);
  runCmd(`summon myc:nest_core ${x} ${y + 1} ${z}`);
}

/** Nests only do work while a player is near enough to notice. */
function tickNests(player, level) {
  const dimension = player.dimension;
  const nests = nestsNear(dimension, player.location, 48);
  if (nests.length === 0) return 0;

  let spawned = 0;
  const cap = 3 + level * 2;
  for (const nest of nests) {
    if (Math.random() > 0.35) continue;
    if (countInfectedNear(dimension, nest.location, 24) >= cap) continue;
    const spot = findSpawnSpot(dimension, nest.location, 3, 8);
    if (!spot) continue;
    const type = pickWeighted(SPAWN_TABLE[level] ?? SPAWN_TABLE[1]);
    try {
      dimension.spawnEntity(type, spot);
      spawned++;
    } catch {
      /* blocked */
    }
    if (spawned >= 2) break;

    // Contamination creeps outward from a nest at high threat levels.
    if (level >= 3 && Math.random() < 0.25) {
      const nx = Math.floor(nest.location.x) + Math.floor(Math.random() * 13) - 6;
      const nz = Math.floor(nest.location.z) + Math.floor(Math.random() * 13) - 6;
      const ny = Math.floor(nest.location.y) - 1;
      runCmd(`fill ${nx} ${ny} ${nz} ${nx} ${ny} ${nz} myc:fungal_growth replace minecraft:grass_block`);
    }
  }
  return spawned;
}

// ------------------------------------------------------------- lifecycle --

export function startOutbreak(announcer) {
  if (getGlobal("outbreak") === 1) {
    announcer?.sendMessage("§eAn outbreak is already active. §7Use /function outbreak_status.");
    return;
  }
  setGlobal("outbreak", 1);
  setGlobal("elapsed", 0);
  setGlobal("day", 1);
  setGlobal("level", 1);
  world.sendMessage("§4§l[MYCELIUM-X] §r§cOutbreak declared. Containment has failed.");
  world.sendMessage(DAY_HEADLINES[1]);
  runCmd("playsound myc.alarm @a");
}

export function stopOutbreak() {
  setGlobal("outbreak", 0);
  setGlobal("day", 0);
  setGlobal("level", 0);
  setGlobal("elapsed", 0);
  runCmd("kill @e[family=myc_infected]");
  runCmd("kill @e[type=myc:nest_core]");
  world.sendMessage("§a§l[MYCELIUM-X] §r§aOutbreak contained. All hostile signatures cleared.");
}

/** Runs every DIRECTOR_PERIOD_TICKS. */
export function tickDirector(players) {
  if (getGlobal("outbreak") !== 1) return;

  const elapsed = getGlobal("elapsed") + DIRECTOR_PERIOD_TICKS;
  setGlobal("elapsed", elapsed);

  const day = Math.min(MAX_LEVEL, 1 + Math.floor(elapsed / TICKS_PER_MC_DAY));
  if (day !== getGlobal("day")) {
    setGlobal("day", day);
    setGlobal("level", day);
    world.sendMessage(DAY_HEADLINES[day] ?? "");
    runCmd("playsound myc.alarm @a");
  }

  const level = Math.max(1, Math.min(MAX_LEVEL, getGlobal("level")));
  for (const player of players) {
    try {
      const fromNests = tickNests(player, level);
      // Ambient spawning backs off once nests are already supplying pressure.
      if (fromNests === 0) spawnAround(player, level);
      if (level >= 4) spawnAround(player, level);
    } catch {
      /* player left */
    }
  }
}

export function directorPeriod() {
  return DIRECTOR_PERIOD_TICKS;
}
