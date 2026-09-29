// @ts-check
// Per-player settings, saved on the player (dynamic properties survive
// quitting and reloading the world).
import { MODES } from "./config.js";
import { clamp } from "./util.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("./config.js").ModeId} ModeId */

const KEY = "destruct:settings";

/**
 * @typedef {Object} Settings
 * @property {boolean} breakBlocks  false = effects only, no block damage
 * @property {boolean} fire
 * @property {boolean} protect      owner gets Resistance V and is not pushed
 * @property {number} range         max aim distance in blocks
 * @property {Record<string, {mode?: string, power?: number}>} weapons
 */

/** @returns {Settings} */
function defaults() {
  return { breakBlocks: true, fire: true, protect: true, range: 160, weapons: {} };
}

/** @param {Player} player @returns {Settings} */
export function loadSettings(player) {
  const s = defaults();
  try {
    const raw = player.getDynamicProperty(KEY);
    if (typeof raw === "string") {
      const saved = JSON.parse(raw);
      if (typeof saved.breakBlocks === "boolean") s.breakBlocks = saved.breakBlocks;
      if (typeof saved.fire === "boolean") s.fire = saved.fire;
      if (typeof saved.protect === "boolean") s.protect = saved.protect;
      if (typeof saved.range === "number") s.range = clamp(Math.round(saved.range), 32, 256);
      if (saved.weapons && typeof saved.weapons === "object") s.weapons = saved.weapons;
    }
  } catch {
    // corrupt or missing: use defaults
  }
  return s;
}

/** @param {Player} player @param {Settings} s */
export function saveSettings(player, s) {
  try {
    player.setDynamicProperty(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

/**
 * Where a weapon hits and how hard, for this player.
 * @param {Settings} s @param {string} weaponId @returns {{mode: ModeId, power: number}}
 */
export function weaponPrefs(s, weaponId) {
  const w = s.weapons[weaponId] ?? {};
  const mode = MODES.find((m) => m.id === w.mode)?.id ?? "look";
  const power = clamp(Math.round(Number(w.power ?? 3)) || 3, 1, 5);
  return { mode, power };
}
