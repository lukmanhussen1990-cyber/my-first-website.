import { MolangVariableMap } from "@minecraft/server";
import { playerPref } from "../core/settings.js";
import { logError } from "./util.js";

/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Player} Player */

/**
 * Spawn a particle effect. Never throws: locations in unloaded chunks or
 * outside the world are simply skipped.
 * @param {Dimension} dimension
 * @param {string} id
 * @param {Vector3} location
 * @param {MolangVariableMap} [vars]
 * @returns {boolean} false if the particle could not be spawned
 */
export function particle(dimension, id, location, vars) {
  try {
    if (vars) dimension.spawnParticle(id, location, vars);
    else dimension.spawnParticle(id, location);
    return true;
  } catch {
    return false;
  }
}

/**
 * Molang variables for the generic tinted particles.
 * @param {{r: number, g: number, b: number, a?: number}} [color]
 * @param {Vector3} [direction]
 * @param {number} [size]
 */
export function vars(color, direction, size) {
  const map = new MolangVariableMap();
  if (color) map.setColorRGBA("variable.color", { red: color.r, green: color.g, blue: color.b, alpha: color.a ?? 1 });
  if (direction) map.setVector3("variable.direction", direction);
  if (size !== undefined) map.setFloat("variable.size", size);
  return map;
}

/**
 * Play a sound for every player in the same dimension within `radius`.
 * @param {Dimension} dimension
 * @param {string} soundId
 * @param {Vector3} location
 * @param {{volume?: number, pitch?: number, radius?: number}} [opts]
 */
export function sound(dimension, soundId, location, opts = {}) {
  const radius = opts.radius ?? 48;
  let players;
  try {
    players = dimension.getPlayers({ location, maxDistance: radius });
  } catch {
    return;
  }
  for (const p of players) {
    try {
      p.playSound(soundId, { location, volume: opts.volume ?? 1, pitch: opts.pitch ?? 1 });
    } catch {
      // player left mid-loop
    }
  }
}

/**
 * Camera shake for players (respects the per-player "shake & flash" preference).
 * @param {Player[]} players
 * @param {number} intensity 0..4
 * @param {number} seconds
 */
export function shake(players, intensity, seconds) {
  for (const p of players) {
    try {
      if (!playerPref(p, "shake")) continue;
      p.runCommandAsync(`camerashake add @s ${intensity.toFixed(2)} ${seconds.toFixed(2)} positional`).catch(() => {});
    } catch {
      // ignore
    }
  }
}

/**
 * Players near a point (for shared effects like shake / titles).
 * @param {Dimension} dimension
 * @param {Vector3} location
 * @param {number} radius
 * @returns {Player[]}
 */
export function playersNear(dimension, location, radius) {
  try {
    return dimension.getPlayers({ location, maxDistance: radius });
  } catch {
    return [];
  }
}

/**
 * Full screen colour flash (respects the "shake & flash" preference).
 * @param {Player} player
 * @param {{red: number, green: number, blue: number}} color 0..1
 * @param {number} fadeIn seconds
 * @param {number} hold seconds
 * @param {number} fadeOut seconds
 */
export function screenFlash(player, color, fadeIn, hold, fadeOut) {
  try {
    if (!playerPref(player, "shake")) return;
    player.camera.fade({ fadeColor: color, fadeTime: { fadeInTime: fadeIn, holdTime: hold, fadeOutTime: fadeOut } });
  } catch (e) {
    logError("fx.fade", e);
  }
}

/**
 * Big cinematic title (respects the per-player "titles" preference).
 * @param {Player} player
 * @param {string} title
 * @param {string} subtitle
 * @param {number} [stayTicks]
 */
export function cinematicTitle(player, title, subtitle, stayTicks = 40) {
  try {
    if (!playerPref(player, "titles")) return;
    player.onScreenDisplay.setTitle(title, {
      subtitle,
      fadeInDuration: 4,
      stayDuration: stayTicks,
      fadeOutDuration: 10,
    });
  } catch (e) {
    logError("fx.title", e);
  }
}

/**
 * Third-person cast pose (see RP/animations/gojo.player.animation.json).
 * @param {import("@minecraft/server").Entity} entity
 * @param {string} animation
 */
export function pose(entity, animation) {
  try {
    entity.playAnimation(animation, { blendOutTime: 0.25 });
  } catch (e) {
    logError("fx.pose", e);
  }
}
