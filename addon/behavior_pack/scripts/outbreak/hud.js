// @ts-check
// Live actionbar status while the Outbreak Control is held (SPEC §7).
// updateHud() is called by the 1 Hz loop, so the HUD is throttled to one
// actionbar per player every 20 ticks; the world is only queried when at
// least one player holds the control and showHud is on.

import { world } from "@minecraft/server";
import { ITEMS } from "../lib/ids.js";
import { actionbar, findHeld } from "../lib/util.js";
import { getConfig } from "./config.js";
import { S } from "./state.js";
import { hordeCount } from "./horde.js";
import { infectionStage, incubationSecondsLeft } from "./infection.js";

/** @typedef {import("@minecraft/server").Player} Player */

/** The HUD refresh period in ticks (the 1 Hz loop). */
export const HUD_INTERVAL_TICKS = 20;

/** Outbreak part of the HUD line. @returns {string} */
export function outbreakStatusLine() {
  const st = S();
  if (!st.active) return "§7☣ No active outbreak";
  const cfg = getConfig();
  const secs = Math.max(0, Math.ceil(st.ticksToNext / 20));
  const mode = st.paused ? "§ePAUSED" : "§cACTIVE";
  return `§c☣ ${mode} §7| §fGen ${st.generation} §7| §fHorde ${hordeCount()}/${cfg.populationCap} §7| §fNext ${secs}s`;
}

/**
 * Personal suffix (infection state of the viewer).
 * @param {Player} p
 * @returns {string}
 */
export function playerStatusSuffix(p) {
  const stage = infectionStage(p);
  if (stage === 2) return " §7| §4YOU: INFECTED";
  if (stage === 1) return ` §7| §cYOU: incubating ${incubationSecondsLeft(p)}s`;
  return "";
}

/**
 * Show the HUD to every player holding the control item.
 * @returns {number} players updated
 */
export function updateHud() {
  if (!getConfig().showHud) return 0;
  /** @type {string | undefined} */
  let line;
  let n = 0;
  /** @type {Player[]} */
  let players;
  try {
    players = world.getAllPlayers();
  } catch {
    return 0;
  }
  for (const p of players) {
    if (!findHeld(p, ITEMS.CONTROL)) continue;
    if (line === undefined) line = outbreakStatusLine();
    if (actionbar(p, line + playerStatusSuffix(p))) n++;
  }
  return n;
}
