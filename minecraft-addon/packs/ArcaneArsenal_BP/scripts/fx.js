// Visual & audio helpers. Every call is wrapped so a missing particle, an
// unloaded chunk or a renamed sound can never break gameplay code.
import { system, world } from "@minecraft/server";
import { V, logError } from "./util.js";

/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Player} Player */

/** @param {Dimension} dim @param {string} id @param {Vector3} loc */
export function particle(dim, id, loc) {
  try {
    dim.spawnParticle(id, loc);
  } catch {
    // unloaded chunk or unknown particle
  }
}

/** Sound heard by everyone nearby. @param {string} id @param {Vector3} loc */
export function sound(id, loc, volume = 1, pitch = 1) {
  try {
    world.playSound(id, loc, { volume, pitch });
  } catch {
    // ignore
  }
}

/** Sound only this player hears. @param {Player} player @param {string} id */
export function privateSound(player, id, volume = 1, pitch = 1) {
  try {
    player.playSound(id, { volume, pitch });
  } catch {
    // ignore
  }
}

/** Run `fn` after `ticks` ticks, swallowing errors. @param {number} ticks @param {() => void} fn */
export function later(ticks, fn) {
  return system.runTimeout(() => {
    try {
      fn();
    } catch (e) {
      logError(e);
    }
  }, Math.max(1, Math.round(ticks)));
}

/** Horizontal ring of particles. @param {Dimension} dim @param {Vector3} center */
export function ring(dim, center, radius, id, count, phase = 0) {
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    particle(dim, id, { x: center.x + Math.cos(a) * radius, y: center.y, z: center.z + Math.sin(a) * radius });
  }
}

/** Particles along a line. @param {Dimension} dim @param {Vector3} from @param {Vector3} to */
export function line(dim, from, to, id, step = 0.5) {
  const d = V.dist(from, to);
  const n = Math.max(1, Math.min(80, Math.ceil(d / step)));
  for (let i = 0; i <= n; i++) particle(dim, id, V.lerp(from, to, i / n));
}

/**
 * Jagged electric arc between two points.
 * @param {Dimension} dim @param {Vector3} from @param {Vector3} to
 */
export function arc(dim, from, to, id = "arcane:storm_spark") {
  const d = V.dist(from, to);
  const n = Math.max(2, Math.min(40, Math.ceil(d / 0.4)));
  for (let i = 0; i <= n; i++) {
    const p = V.lerp(from, to, i / n);
    const j = i === 0 || i === n ? 0 : 0.35;
    particle(dim, id, { x: p.x + (Math.random() - 0.5) * j, y: p.y + (Math.random() - 0.5) * j, z: p.z + (Math.random() - 0.5) * j });
  }
}

/** Screen shake for one player (heavy spells). @param {Player} player */
export function shake(player, intensity = 0.3, seconds = 0.3) {
  try {
    player.runCommandAsync(`camerashake add @s ${intensity} ${seconds} positional`).catch(() => {});
  } catch {
    // ignore
  }
}

/** Actionbar text. @param {Player} player @param {string} text */
export function actionbar(player, text) {
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch {
    // ignore
  }
}
