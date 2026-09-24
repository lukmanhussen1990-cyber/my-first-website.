// World settings, changed with /function arcane/<setting>_on|off
// (or /scriptevent arcane:config <setting> on|off). Saved in the world.
import { world } from "@minecraft/server";

/** @type {Record<string, boolean>} */
export const DEFAULTS = {
  lights: true, //   dynamic hand-held / dropped-item light
  flicker: true, //  flame light sources flicker like real fire
  particles: true, // embers, smoke and weapon auras near your hand
  hud: true, //      spell cooldown text above the hotbar
};

/** @type {Record<string, boolean>} */
const cache = {};

/** @param {string} key */
export function setting(key) {
  if (key in cache) return cache[key];
  let value;
  try {
    value = world.getDynamicProperty("arcane:cfg_" + key);
  } catch {
    value = undefined;
  }
  cache[key] = typeof value === "boolean" ? value : !!DEFAULTS[key];
  return cache[key];
}

/** @param {string} key @param {boolean} value */
export function setSetting(key, value) {
  cache[key] = value;
  try {
    world.setDynamicProperty("arcane:cfg_" + key, value);
  } catch {
    // ignore
  }
}
