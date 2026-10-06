// @ts-check
// Player-specific parts of the outbreak (SPEC §7): stage-2 pulses, death
// (infected humanoid NPC fallback), respawn/join handling and "Cure me".
//
// A human-controlled player cannot be taken over by AI from Bedrock scripting,
// so a player who dies infected (or is killed by the horde) leaves a
// pas:infected_human named "Infected <name>" behind, and respawns healthy.

import { world, system } from "@minecraft/server";
import { ENTITIES, PROPS, SOUNDS, TAGS } from "../lib/ids.js";
import { logError, playSound, runSafe, tell } from "../lib/util.js";
import { getConfig } from "./config.js";
import { S, markDirty } from "./state.js";
import { hordeCount, isAlive, isHorde } from "./horde.js";
import { applySpawnDormancy } from "./dormancy.js";
import { addEffect, bar, conversionBurst, spores, EFFECTS } from "./fx.js";
import {
  clearInfection,
  hudOwnsActionbar,
  infectionIsStale,
  infectionStage,
  purgeInfectionHolder,
  INFECTED_BAR_TEXT,
} from "./infection.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").EntityDamageSource} EntityDamageSource */

/** Hunger pulse every N seconds for stage-2 players. */
export const HUNGER_PULSE_SECONDS = 10;
/** Nausea pulse every N seconds for stage-2 players. */
export const NAUSEA_PULSE_SECONDS = 15;

/**
 * 1 Hz: recurring hunger + nausea pulses and the actionbar for stage-2 players.
 * Stale (purged) infections are cleared.
 * @returns {number} players processed
 */
export function infectedPlayersTick() {
  /** @type {Player[]} */
  let players;
  try {
    players = world.getPlayers({ tags: [TAGS.INFECTED_PLAYER] });
  } catch {
    return 0;
  }
  const sec = Math.floor(system.currentTick / 20);
  for (const p of players) {
    runSafe(() => {
      if (infectionIsStale(p)) {
        purgeInfectionHolder(p);
        return;
      }
      if (!isAlive(p)) return;
      if (!hudOwnsActionbar(p)) bar(p, `§c${INFECTED_BAR_TEXT}`);
      if (sec % HUNGER_PULSE_SECONDS === 0) addEffect(p, EFFECTS.HUNGER, 100, 1);
      if (sec % NAUSEA_PULSE_SECONDS === 0) addEffect(p, EFFECTS.NAUSEA, 80);
      if (sec % 2 === 0) spores(p);
    }, "outbreak.stage2");
  }
  return players.length;
}

/**
 * Spawn the infected humanoid NPC for a dead player (if the cap allows).
 * @param {Player} p
 * @returns {Entity | undefined}
 */
export function spawnInfectedHuman(p) {
  const cfg = getConfig();
  if (hordeCount() >= cfg.populationCap) {
    tell(p, "§e☣ The horde is at its population cap - your body did not turn.");
    return undefined;
  }
  const dim = p.dimension;
  const loc = p.location;
  /** @type {Entity} */
  let h;
  try {
    h = dim.spawnEntity(ENTITIES.INFECTED_HUMAN, loc);
  } catch (err) {
    logError("outbreak.human.spawn", err);
    return undefined;
  }
  try {
    h.nameTag = `Infected ${p.name}`;
    h.setDynamicProperty(PROPS.EPOCH, S().epoch);
    h.setDynamicProperty(PROPS.ORIGIN, "minecraft:player");
    h.setDynamicProperty(PROPS.ORIGIN_DATA, JSON.stringify({ v: 1, type: "minecraft:player", baby: false, name: p.name }));
  } catch (err) {
    logError("outbreak.human.props", err);
  }
  applySpawnDormancy(h);
  conversionBurst(dim, loc);
  playSound(dim, SOUNDS.INFECTION_CONVERT, loc);
  S().stats.conversions++;
  markDirty();
  try {
    world.sendMessage(`§4☣ ${p.name} has turned.`);
  } catch {
    // ignore
  }
  return h;
}

/**
 * entityDie for a player: an infected player (stage 1/2) or a victim of the
 * horde turns into an infected human; the player's infection is cleared.
 * @param {Player} p
 * @param {EntityDamageSource | undefined} source
 * @returns {Entity | undefined} the infected human, if one was spawned
 */
export function onPlayerDeath(p, source) {
  const st = S();
  const stage = infectionStage(p);
  /** @type {Entity | undefined} */
  let killer;
  try {
    killer = source?.damagingEntity;
  } catch {
    killer = undefined;
  }
  const killedByHorde = killer !== undefined && isHorde(killer);
  /** @type {Entity | undefined} */
  let human;
  if (st.active && (stage >= 1 || killedByHorde)) human = spawnInfectedHuman(p);
  if (stage >= 1) clearInfection(p);
  return human;
}

/**
 * playerSpawn: a respawned player is always healthy; a joining player whose
 * infection was purged while offline is cleared lazily.
 * @param {Player} p
 * @param {boolean} initialSpawn
 */
export function onPlayerSpawn(p, initialSpawn) {
  if (infectionStage(p) === 0) return;
  if (!initialSpawn) {
    clearInfection(p);
    return;
  }
  if (infectionIsStale(p)) purgeInfectionHolder(p);
}

/**
 * "Cure me": clear the player's own infection.
 * @param {Player} p
 * @returns {boolean} whether the player was infected
 */
export function curePlayer(p) {
  if (infectionStage(p) === 0) {
    tell(p, "§a☣ You are not infected.");
    return false;
  }
  clearInfection(p);
  tell(p, "§a☣ You have been cured of the parasite.");
  addEffect(p, "regeneration", 60);
  return true;
}
