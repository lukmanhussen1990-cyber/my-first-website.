import { world } from "@minecraft/server";
import { logError } from "../lib/util.js";

/**
 * World-wide settings (shared by everyone in the world, saved in the world).
 * Particle quality 0 = Low (older phones), 1 = Medium (default), 2 = High.
 */
export const WORLD_DEFAULTS = Object.freeze({
  quality: 1,
  destruction: false,
  pvp: true,
  spareFriendly: true,
});

/** Per-player preferences (saved on the player). */
export const PLAYER_DEFAULTS = Object.freeze({
  titles: true,
  shake: true,
  hud: true,
});

const WORLD_KEYS = {
  quality: "gojo:cfg_quality",
  destruction: "gojo:cfg_destruction",
  pvp: "gojo:cfg_pvp",
  spareFriendly: "gojo:cfg_spare",
};

const PLAYER_KEYS = {
  titles: "gojo:pref_titles",
  shake: "gojo:pref_shake",
  hud: "gojo:pref_hud",
};

/** @type {{quality: number, destruction: boolean, pvp: boolean, spareFriendly: boolean}} */
const cache = { ...WORLD_DEFAULTS };
let loaded = false;

function loadWorld() {
  if (loaded) return;
  loaded = true;
  try {
    const q = world.getDynamicProperty(WORLD_KEYS.quality);
    if (typeof q === "number" && q >= 0 && q <= 2) cache.quality = Math.round(q);
    for (const key of /** @type {const} */ (["destruction", "pvp", "spareFriendly"])) {
      const v = world.getDynamicProperty(WORLD_KEYS[key]);
      if (typeof v === "boolean") cache[key] = v;
    }
  } catch (e) {
    loaded = false; // world not ready yet; try again next time
    logError("settings.load", e);
  }
}

/** @returns {{quality: number, destruction: boolean, pvp: boolean, spareFriendly: boolean}} */
export function worldSettings() {
  loadWorld();
  return cache;
}

/**
 * @param {"quality" | "destruction" | "pvp" | "spareFriendly"} key
 * @param {number | boolean} value
 */
export function setWorldSetting(key, value) {
  loadWorld();
  if (key === "quality") cache.quality = /** @type {number} */ (value);
  else cache[key] = /** @type {boolean} */ (value);
  try {
    world.setDynamicProperty(WORLD_KEYS[key], value);
  } catch (e) {
    logError("settings.save", e);
  }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {"titles" | "shake" | "hud"} key
 * @returns {boolean}
 */
export function playerPref(player, key) {
  try {
    const v = player.getDynamicProperty(PLAYER_KEYS[key]);
    if (typeof v === "boolean") return v;
  } catch {
    // fall through to default
  }
  return PLAYER_DEFAULTS[key];
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {"titles" | "shake" | "hud"} key
 * @param {boolean} value
 */
export function setPlayerPref(player, key, value) {
  try {
    player.setDynamicProperty(PLAYER_KEYS[key], value);
  } catch (e) {
    logError("settings.pref", e);
  }
}

/** Quality suffix used by the heavy particle variants. */
export function qualitySuffix() {
  const q = worldSettings().quality;
  return q <= 0 ? "_low" : q >= 2 ? "_high" : "_med";
}

/** Multiplier for how many script-side particle bursts to send. */
export function qualityScale() {
  const q = worldSettings().quality;
  return q <= 0 ? 0.5 : q >= 2 ? 1.5 : 1;
}
