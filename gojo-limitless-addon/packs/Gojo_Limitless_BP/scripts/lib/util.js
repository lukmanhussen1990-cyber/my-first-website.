import { system } from "@minecraft/server";

const loggedErrors = new Map();

/**
 * Logs an error to the content log at most once every 10 seconds per tag, so a
 * repeating failure can never flood the log or cost frame time on mobile.
 * @param {string} tag
 * @param {unknown} error
 */
export function logError(tag, error) {
  const now = system.currentTick;
  const last = loggedErrors.get(tag);
  if (last !== undefined && now - last < 200) return;
  loggedErrors.set(tag, now);
  const text = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  console.warn(`[Gojo Limitless] ${tag}: ${text}`);
}

/**
 * Entity#isValid() safely (entities can be unloaded or removed at any time).
 * @param {import("@minecraft/server").Entity | undefined} entity
 * @returns {boolean}
 */
export function alive(entity) {
  try {
    return !!entity && entity.isValid();
  } catch {
    return false;
  }
}

/** @param {number} value @param {number} min @param {number} max */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** @param {number} min @param {number} max */
export function rand(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * "minecraft:zombie_villager_v2" -> "Zombie Villager"
 * @param {import("@minecraft/server").Entity} entity
 */
export function displayName(entity) {
  try {
    if (entity.typeId === "minecraft:player") return /** @type {any} */ (entity).name ?? "Player";
    if (entity.nameTag) return entity.nameTag;
    const raw = entity.typeId.split(":")[1] ?? entity.typeId;
    return raw
      .replace(/_v\d+$/, "")
      .split("_")
      .filter((p) => p.length > 0)
      .map((p) => p[0].toUpperCase() + p.slice(1))
      .join(" ");
  } catch {
    return "Unknown";
  }
}

/** Seconds with one decimal for the HUD. @param {number} ticks */
export function secondsText(ticks) {
  return (Math.max(0, ticks) / 20).toFixed(1) + "s";
}

/**
 * Coloured ASCII progress bar (safe on every font / platform).
 * @param {number} fraction 0..1 filled
 * @param {number} width
 * @param {string} fillColor
 */
export function bar(fraction, width, fillColor) {
  const filled = Math.round(clamp(fraction, 0, 1) * width);
  return fillColor + "|".repeat(filled) + "§8" + "|".repeat(width - filled);
}
