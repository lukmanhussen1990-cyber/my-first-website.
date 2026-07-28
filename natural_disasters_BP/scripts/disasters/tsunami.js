/**
 * Tsunami - a wall of water that rolls across the landscape, shoves everything
 * along with it and then drains away again.
 *
 * Only blocks the wave itself placed are removed afterwards, so the world is
 * never left permanently flooded.
 */

import { TUNING, getSetting } from "../config.js";
import { SOUNDS } from "../sounds.js";
import {
  blockIdAt,
  damageEntity,
  entitiesNear,
  groundY,
  isProtectedId,
  isReplaceableId,
  playSoundAt,
  pushEntity,
  randFloat,
  setBlockSafe,
  spawnParticleSafe
} from "../util.js";

export const tsunami = {
  key: "tsunami",
  name: "Tsunami",
  color: "§b",
  icon: "textures/ui/nd_icon_tsunami",
  description: "A giant wave of water sweeps across the land.",
  warning: "A tsunami is rolling in!",

  create(dimension, location, options = {}) {
    const cfg = TUNING.tsunami;
    const heading = options.heading ?? randFloat(0, Math.PI * 2);

    const state = {
      origin: { ...location },
      dir: { x: Math.cos(heading), z: Math.sin(heading) },
      perp: { x: -Math.sin(heading), z: Math.cos(heading) },
      travelled: 0,
      /** Columns of water placed by the wave, newest last. */
      trail: [],
      front: { ...location }
    };

    // Start the wave a little behind the target so it rolls over it.
    state.origin = {
      x: location.x - state.dir.x * 12,
      y: location.y,
      z: location.z - state.dir.z * 12
    };

    playSoundAt(dimension, location, SOUNDS.tsunamiRoar.custom, SOUNDS.tsunamiRoar.vanilla, {
      volume: 1.6,
      pitch: 0.7
    });

    return {
      getLocation() {
        return { ...state.front };
      },

      tick(age) {
        if (age % cfg.ticksPerStep === 0) {
          state.travelled += cfg.stepBlocks;
          if (state.travelled > cfg.travelDistance) {
            // Let the trail drain before finishing.
            if (state.trail.length === 0) return true;
            drainOldest(dimension, state);
            drainOldest(dimension, state);
            return false;
          }
          advance(dimension, state, cfg);
        }

        if (age % 2 === 0) pushEntities(dimension, state, cfg, age);

        if (age % 25 === 0) {
          playSoundAt(dimension, state.front, SOUNDS.tsunamiSplash.custom, SOUNDS.tsunamiSplash.vanilla, {
            volume: 1.3,
            pitch: randFloat(0.6, 0.9)
          });
        }
        return false;
      },

      stop() {
        while (state.trail.length > 0) drainOldest(dimension, state);
      }
    };
  }
};

/** Places the next column of the wave front. */
function advance(dimension, state, cfg) {
  const front = {
    x: state.origin.x + state.dir.x * state.travelled,
    y: state.origin.y,
    z: state.origin.z + state.dir.z * state.travelled
  };
  state.front = front;

  let budget = TUNING.maxBlockOpsPerTick;
  const placed = [];

  for (let w = -cfg.halfWidth; w <= cfg.halfWidth && budget > 0; w++) {
    const x = Math.floor(front.x + state.perp.x * w);
    const z = Math.floor(front.z + state.perp.z * w);

    const ground = groundY(dimension, x, z, front.y + 24);
    if (ground === undefined) continue;

    // The crest is tallest in the middle and tapers to the edges.
    const edgeFactor = 1 - Math.abs(w) / (cfg.halfWidth + 1);
    const height = Math.max(2, Math.round(cfg.height * (0.45 + edgeFactor * 0.55)));

    for (let h = 1; h <= height && budget > 0; h++) {
      const target = { x, y: ground + h, z };
      const id = blockIdAt(dimension, target);
      if (id === undefined) break;
      if (isProtectedId(id)) continue;
      if (!isReplaceableId(id)) continue; // do not eat solid walls
      if (id === "minecraft:water") continue; // natural water, leave it alone
      if (setBlockSafe(dimension, target, "minecraft:water")) {
        placed.push(target);
        budget--;
      }
    }

    if (Math.abs(w) % 4 === 0) {
      spawnParticleSafe(dimension, "nd:water_spray", { x: x + 0.5, y: ground + cfg.height, z: z + 0.5 });
    }
  }

  state.trail.push(placed);
  if (state.trail.length > cfg.trailLength) drainOldest(dimension, state);
}

/** Removes the oldest column of wave water. */
function drainOldest(dimension, state) {
  const column = state.trail.shift();
  if (!column) return;
  for (const pos of column) {
    const id = blockIdAt(dimension, pos);
    if (id === "minecraft:water" || id === "minecraft:flowing_water") {
      setBlockSafe(dimension, pos, "minecraft:air");
    }
  }
}

/** Everything caught by the crest gets carried along and roughed up. */
function pushEntities(dimension, state, cfg, age) {
  const targets = entitiesNear(dimension, state.front, cfg.halfWidth + 6, {
    excludeFamilies: ["nd_disaster"]
  });
  for (const entity of targets) {
    const isPlayer = entity.typeId === "minecraft:player";
    if (isPlayer && !getSetting("playerDamage") && Math.random() < 0.5) continue;

    pushEntity(entity, {
      x: state.dir.x * cfg.pushStrength,
      y: 0.35,
      z: state.dir.z * cfg.pushStrength
    });

    if (age % 20 === 0 && (!isPlayer || getSetting("playerDamage"))) {
      if (entity.typeId !== "minecraft:item") {
        damageEntity(entity, cfg.damagePerSecond, "drowning");
      }
    }
  }
}
