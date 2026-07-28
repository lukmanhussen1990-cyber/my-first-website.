/**
 * Natural Disasters - the disaster registry and the master tick loop.
 *
 * Every disaster is a small object with a `tick()` method. `tick()` returns true
 * when the disaster is finished. The registry runs them all once per game tick
 * inside a try/catch so one broken disaster can never stop the others.
 */

import { system } from "@minecraft/server";
import { TUNING } from "./config.js";
import { DISASTERS, DISASTER_KEYS } from "./disasters/index.js";
import { broadcast } from "./util.js";

/** @type {Array<{key:string,label:string,instance:object,age:number}>} */
const active = [];

let masterLoopId = undefined;
let nextHandle = 1;

/** Every disaster definition, keyed by its short name. */
export function getDefinitions() {
  return DISASTERS;
}

export function getDefinition(key) {
  return DISASTERS[key];
}

export function getDisasterKeys() {
  return DISASTER_KEYS;
}

/** Disasters running right now. */
export function getActiveDisasters() {
  return active;
}

export function isAnythingActive() {
  return active.length > 0;
}

/**
 * Starts a disaster.
 * @param {string} key one of DISASTER_KEYS
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {{x:number,y:number,z:number}} location
 * @param {object} [options] extra options forwarded to the disaster
 * @returns {{ok:boolean,reason?:string}}
 */
export function startDisaster(key, dimension, location, options = {}) {
  const definition = DISASTERS[key];
  if (!definition) return { ok: false, reason: `Unknown disaster: ${key}` };
  if (active.length >= TUNING.maxActiveDisasters) {
    return { ok: false, reason: "Too many disasters are already running." };
  }

  let instance;
  try {
    instance = definition.create(dimension, { ...location }, options);
  } catch (error) {
    console.warn(`[NaturalDisasters] failed to start ${key}: ${error}`);
    return { ok: false, reason: "This disaster could not start here." };
  }
  if (!instance) return { ok: false, reason: "This disaster could not start here." };

  active.push({
    key,
    handle: nextHandle++,
    label: definition.name,
    color: definition.color,
    dimension,
    origin: { ...location },
    instance,
    age: 0
  });
  ensureMasterLoop();
  return { ok: true };
}

/** Stops every running disaster and cleans up whatever it placed. */
export function stopAllDisasters(announce = true) {
  const count = active.length;
  while (active.length > 0) {
    const entry = active.pop();
    try {
      entry.instance.stop?.();
    } catch (error) {
      console.warn(`[NaturalDisasters] cleanup failed for ${entry.key}: ${error}`);
    }
  }
  if (announce && count > 0) {
    broadcast(`§b[Natural Disasters] §fStopped ${count} active disaster${count === 1 ? "" : "s"}.`);
  }
  return count;
}

/** Current position of a running disaster, used by the Disaster Detector. */
export function disasterLocation(entry) {
  try {
    const loc = entry.instance.getLocation?.();
    if (loc) return loc;
  } catch {
    // fall through
  }
  return entry.origin;
}

function ensureMasterLoop() {
  if (masterLoopId !== undefined) return;
  masterLoopId = system.runInterval(() => {
    for (let i = active.length - 1; i >= 0; i--) {
      const entry = active[i];
      entry.age++;
      let done = false;
      try {
        done = entry.instance.tick(entry.age) === true;
      } catch (error) {
        console.warn(`[NaturalDisasters] ${entry.key} crashed: ${error}`);
        done = true;
      }
      if (done) {
        try {
          entry.instance.stop?.();
        } catch (error) {
          console.warn(`[NaturalDisasters] cleanup failed for ${entry.key}: ${error}`);
        }
        active.splice(i, 1);
      }
    }
  }, 1);
}

/** Called once from main.js so the loop exists even before the first disaster. */
export function initRegistry() {
  ensureMasterLoop();
}
