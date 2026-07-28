/**
 * Earthquake - shakes the screen of everyone nearby, tears open fissures in the
 * ground and crumbles blocks off buildings.
 */

import { TUNING, getSetting } from "../config.js";
import { SOUNDS } from "../sounds.js";
import {
  blockIdAt,
  cameraShake,
  damageEntity,
  entitiesNear,
  groundY,
  isProtectedId,
  playSoundAt,
  randFloat,
  randInt,
  setBlockSafe,
  spawnParticleSafe
} from "../util.js";

export const earthquake = {
  key: "earthquake",
  name: "Earthquake",
  color: "§6",
  icon: "textures/ui/nd_icon_earthquake",
  description: "The ground shakes, cracks open and swallows what stands on it.",
  warning: "The ground is starting to shake!",

  create(dimension, location, options = {}) {
    const cfg = TUNING.earthquake;
    const state = {
      center: { ...location },
      ticksLeft: options.durationTicks ?? cfg.durationTicks,
      radius: options.radius ?? cfg.radius
    };

    playSoundAt(dimension, state.center, SOUNDS.earthquakeRumble.custom, SOUNDS.earthquakeRumble.vanilla, {
      volume: 1.5,
      pitch: 0.55
    });

    return {
      getLocation() {
        return state.center;
      },

      tick(age) {
        state.ticksLeft--;
        if (state.ticksLeft <= 0) return true;

        // Refresh the shake every second so it never stops mid quake.
        if (age % 20 === 1) {
          cameraShake(dimension, state.center, cfg.shakeIntensity, 1.4, state.radius + 12);
          playSoundAt(dimension, state.center, SOUNDS.earthquakeRumble.custom, SOUNDS.earthquakeRumble.vanilla, {
            volume: 1.2,
            pitch: randFloat(0.5, 0.7)
          });
        }

        // Dust drifting off the ground.
        if (age % 2 === 0) {
          for (let i = 0; i < 4; i++) {
            const angle = randFloat(0, Math.PI * 2);
            const dist = randFloat(0, state.radius);
            const x = state.center.x + Math.cos(angle) * dist;
            const z = state.center.z + Math.sin(angle) * dist;
            const ground = groundY(dimension, Math.floor(x), Math.floor(z), state.center.y + 16);
            if (ground !== undefined) {
              spawnParticleSafe(dimension, "nd:earth_dust", { x, y: ground + 1.1, z });
            }
          }
        }

        const fissureEvery = Math.max(1, Math.floor(20 / cfg.fissuresPerSecond));
        if (getSetting("blockDamage") && age % fissureEvery === 0) {
          openFissure(dimension, state, cfg);
        }
        if (getSetting("blockDamage") && age % 10 === 0) {
          crumbleBlocks(dimension, state, cfg);
        }
        if (age % 20 === 0) {
          shakeEntities(dimension, state, cfg);
        }
        return false;
      },

      stop() {
        // Nothing to clean up: fissures are meant to stay.
      }
    };
  }
};

/** Rips a jagged crack through the ground. */
function openFissure(dimension, state, cfg) {
  const startAngle = randFloat(0, Math.PI * 2);
  const startDist = randFloat(0, state.radius);
  let x = state.center.x + Math.cos(startAngle) * startDist;
  let z = state.center.z + Math.sin(startAngle) * startDist;
  let heading = randFloat(0, Math.PI * 2);

  let budget = TUNING.maxBlockOpsPerTick;
  const length = cfg.fissureLength + randInt(-2, 4);

  for (let step = 0; step < length && budget > 0; step++) {
    heading += randFloat(-0.4, 0.4);
    x += Math.cos(heading);
    z += Math.sin(heading);

    const bx = Math.floor(x);
    const bz = Math.floor(z);
    const ground = groundY(dimension, bx, bz, state.center.y + 24);
    if (ground === undefined) continue;

    const width = randInt(0, 1);
    for (let w = -width; w <= width; w++) {
      const offsetX = bx + Math.round(Math.cos(heading + Math.PI / 2) * w);
      const offsetZ = bz + Math.round(Math.sin(heading + Math.PI / 2) * w);
      const depth = cfg.fissureDepth + randInt(-2, 2);
      for (let d = 0; d < depth && budget > 0; d++) {
        const target = { x: offsetX, y: ground - d, z: offsetZ };
        const id = blockIdAt(dimension, target);
        if (!id || isProtectedId(id)) continue;
        if (setBlockSafe(dimension, target, "minecraft:air")) budget--;
      }
    }

    if (step % 3 === 0) {
      spawnParticleSafe(dimension, "nd:earth_dust", { x: bx + 0.5, y: ground + 1.2, z: bz + 0.5 });
    }
  }

  playSoundAt(dimension, { x, y: state.center.y, z }, SOUNDS.earthquakeCrack.custom, SOUNDS.earthquakeCrack.vanilla, {
    volume: 1.1,
    pitch: randFloat(0.5, 0.8)
  });
}

/** Knocks loose blocks off whatever is standing above ground level. */
function crumbleBlocks(dimension, state, cfg) {
  let budget = Math.floor(TUNING.maxBlockOpsPerTick / 4);
  for (let attempt = 0; attempt < 12 && budget > 0; attempt++) {
    if (Math.random() > cfg.crumbleChance) continue;
    const angle = randFloat(0, Math.PI * 2);
    const dist = randFloat(0, state.radius);
    const x = Math.floor(state.center.x + Math.cos(angle) * dist);
    const z = Math.floor(state.center.z + Math.sin(angle) * dist);
    const ground = groundY(dimension, x, z, state.center.y + 30);
    if (ground === undefined) continue;

    // Only remove blocks that sit above the local surface (walls, roofs, trees).
    const y = ground + randInt(1, 5);
    const id = blockIdAt(dimension, { x, y, z });
    if (!id || id === "minecraft:air" || isProtectedId(id)) continue;
    if (setBlockSafe(dimension, { x, y, z }, "minecraft:air")) {
      budget--;
      spawnParticleSafe(dimension, "nd:earth_dust", { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    }
  }
}

/** Everything standing on the shaking ground takes a little damage. */
function shakeEntities(dimension, state, cfg) {
  const targets = entitiesNear(dimension, state.center, state.radius, {
    excludeFamilies: ["nd_disaster"]
  });
  for (const entity of targets) {
    const isPlayer = entity.typeId === "minecraft:player";
    if (isPlayer && !getSetting("playerDamage")) continue;
    if (entity.typeId === "minecraft:item") continue;
    damageEntity(entity, cfg.damagePerSecond, "fall");
  }
}
