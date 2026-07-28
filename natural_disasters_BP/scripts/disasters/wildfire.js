/**
 * Wildfire - fire that races outwards from a starting point, jumping across the
 * surface far faster than vanilla fire ever would.
 */

import { TUNING, getSetting } from "../config.js";
import { SOUNDS } from "../sounds.js";
import {
  blockIdAt,
  entitiesNear,
  groundY,
  igniteEntity,
  isAirId,
  isProtectedId,
  pickRandom,
  playSoundAt,
  randFloat,
  randInt,
  setBlockSafe,
  spawnParticleSafe
} from "../util.js";

export const wildfire = {
  key: "wildfire",
  name: "Wildfire",
  color: "§e",
  icon: "textures/ui/nd_icon_wildfire",
  description: "Fire spreads outwards and burns everything in its path.",
  warning: "A wildfire has broken out!",

  create(dimension, location, options = {}) {
    const cfg = TUNING.wildfire;
    const state = {
      center: { ...location },
      ticksLeft: options.durationTicks ?? cfg.durationTicks,
      /** "x,z" of every cell already set alight. */
      burning: new Set(),
      /** Cells the fire can still spread from. */
      frontier: [],
      fireCount: 0
    };

    // Seed the fire.
    for (let dx = -cfg.startRadius; dx <= cfg.startRadius; dx++) {
      for (let dz = -cfg.startRadius; dz <= cfg.startRadius; dz++) {
        if (dx * dx + dz * dz > cfg.startRadius * cfg.startRadius) continue;
        ignite(dimension, state, Math.floor(location.x) + dx, Math.floor(location.z) + dz);
      }
    }

    playSoundAt(dimension, location, SOUNDS.wildfireIgnite.custom, SOUNDS.wildfireIgnite.vanilla, {
      volume: 1.4,
      pitch: 0.8
    });

    return {
      getLocation() {
        return state.center;
      },

      tick(age) {
        state.ticksLeft--;
        if (state.ticksLeft <= 0) return true;

        spread(dimension, state, cfg);

        if (age % 3 === 0 && state.frontier.length > 0) {
          for (let i = 0; i < 3; i++) {
            const cell = pickRandom(state.frontier);
            if (!cell) break;
            spawnParticleSafe(dimension, "nd:fire_ember", {
              x: cell.x + 0.5,
              y: cell.y + randFloat(0.5, 2.5),
              z: cell.z + 0.5
            });
          }
        }

        if (age % 10 === 0) burnEntities(dimension, state, cfg);

        if (age % 40 === 0) {
          playSoundAt(dimension, state.center, SOUNDS.wildfireBurn.custom, SOUNDS.wildfireBurn.vanilla, {
            volume: 1.3,
            pitch: randFloat(0.7, 1.1)
          });
        }
        return false;
      },

      stop() {
        // Existing fire is left to burn itself out, exactly like vanilla fire.
      }
    };
  }
};

/** Sets one column alight. Returns true when a new fire block was placed. */
function ignite(dimension, state, x, z) {
  const key = `${x},${z}`;
  if (state.burning.has(key)) return false;
  if (state.fireCount >= TUNING.wildfire.maxFires) return false;

  const ground = groundY(dimension, x, z, state.center.y + 24);
  if (ground === undefined) return false;

  const groundId = blockIdAt(dimension, { x, y: ground, z });
  if (!groundId || isProtectedId(groundId)) return false;

  const aboveLoc = { x, y: ground + 1, z };
  const aboveId = blockIdAt(dimension, aboveLoc);
  if (!aboveId) return false;

  state.burning.add(key);
  state.frontier.push({ x, y: ground + 1, z });

  if (!getSetting("blockDamage")) {
    spawnParticleSafe(dimension, "nd:fire_ember", { x: x + 0.5, y: ground + 1.2, z: z + 0.5 });
    return true;
  }
  if (!isAirId(aboveId)) return true; // still counts as burning, just no room for fire

  if (setBlockSafe(dimension, aboveLoc, "minecraft:fire", { age: randInt(0, 4) })) {
    state.fireCount++;
    return true;
  }
  return false;
}

/** Grows the burning area outwards from random points on the frontier. */
function spread(dimension, state, cfg) {
  if (state.frontier.length === 0) return;
  let placed = 0;
  let attempts = 0;

  while (placed < cfg.spreadPerTick && attempts < cfg.spreadPerTick * 6) {
    attempts++;
    const index = randInt(0, state.frontier.length - 1);
    const from = state.frontier[index];
    const x = from.x + randInt(-2, 2);
    const z = from.z + randInt(-2, 2);

    const dx = x - state.center.x;
    const dz = z - state.center.z;
    if (dx * dx + dz * dz > cfg.maxRadius * cfg.maxRadius) {
      // This cell can no longer grow outwards - retire it.
      state.frontier.splice(index, 1);
      if (state.frontier.length === 0) return;
      continue;
    }
    if (ignite(dimension, state, x, z)) placed++;
  }

  // Keep the frontier list small so the loop above stays cheap on phones.
  if (state.frontier.length > 400) {
    state.frontier.splice(0, state.frontier.length - 400);
  }
}

/** Anything standing in the flames catches fire. */
function burnEntities(dimension, state, cfg) {
  const radius = Math.min(cfg.maxRadius, 8 + state.burning.size / 20);
  const targets = entitiesNear(dimension, state.center, radius, {
    excludeFamilies: ["nd_disaster"]
  });
  for (const entity of targets) {
    let loc;
    try {
      loc = entity.location;
    } catch {
      continue;
    }
    const key = `${Math.floor(loc.x)},${Math.floor(loc.z)}`;
    if (!state.burning.has(key)) continue;
    const isPlayer = entity.typeId === "minecraft:player";
    if (isPlayer && !getSetting("playerDamage")) continue;
    if (entity.typeId === "minecraft:item") continue;
    igniteEntity(entity, 6);
  }
}
