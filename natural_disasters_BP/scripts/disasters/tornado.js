/**
 * Tornado - a funnel that wanders across the ground, sucking in mobs, players
 * and dropped items and throwing them into the sky.
 */

import { TUNING, getSetting } from "../config.js";
import { SOUNDS } from "../sounds.js";
import {
  add,
  blockIdAt,
  damageEntity,
  distance2d,
  entitiesNear,
  isProtectedId,
  isReplaceableId,
  normalize,
  playSoundAt,
  pushEntity,
  randFloat,
  randInt,
  removeEntitySafe,
  setBlockSafe,
  spawnEntitySafe,
  spawnParticleSafe,
  sub,
  surfaceY,
  teleportSafe
} from "../util.js";

export const tornado = {
  key: "tornado",
  name: "Tornado",
  color: "§7",
  icon: "textures/ui/nd_icon_tornado",
  description: "A wandering funnel that pulls in mobs and items.",
  warning: "A tornado is forming nearby!",

  create(dimension, location, options = {}) {
    const cfg = TUNING.tornado;
    const state = {
      x: location.x,
      y: location.y,
      z: location.z,
      heading: randFloat(0, Math.PI * 2),
      ticksLeft: options.durationTicks ?? cfg.durationTicks,
      spin: 0,
      entity: undefined
    };

    // Snap to the surface before spawning the visual funnel.
    const surface = surfaceY(dimension, Math.floor(state.x), Math.floor(state.z), state.y + 12);
    if (surface !== undefined) state.y = surface;

    state.entity = spawnEntitySafe(dimension, "nd:tornado", { x: state.x, y: state.y, z: state.z });

    playSoundAt(dimension, location, SOUNDS.tornadoLoop.custom, SOUNDS.tornadoLoop.vanilla, {
      volume: 1.4,
      pitch: 0.7
    });

    return {
      getLocation() {
        return { x: state.x, y: state.y, z: state.z };
      },

      tick(age) {
        state.ticksLeft--;
        if (state.ticksLeft <= 0) return true;

        moveFunnel(dimension, state, cfg);
        if (age % 4 === 0) followGround(dimension, state);
        drawFunnel(dimension, state, cfg);
        pullEntities(dimension, state, cfg, age);

        if (getSetting("blockDamage") && Math.random() < cfg.blockRipChance) {
          ripBlock(dimension, state, cfg);
        }

        if (age % 20 === 0) {
          playSoundAt(dimension, this.getLocation(), SOUNDS.tornadoLoop.custom, SOUNDS.tornadoLoop.vanilla, {
            volume: 1.2,
            pitch: randFloat(0.6, 0.85)
          });
        }
        return false;
      },

      stop() {
        removeEntitySafe(state.entity);
      }
    };
  }
};

function moveFunnel(dimension, state, cfg) {
  state.heading += randFloat(-cfg.turnAmount, cfg.turnAmount);
  state.x += Math.cos(state.heading) * cfg.moveSpeed;
  state.z += Math.sin(state.heading) * cfg.moveSpeed;
  state.spin += 0.35;
  if (state.entity) {
    teleportSafe(state.entity, { x: state.x, y: state.y, z: state.z });
  }
}

function followGround(dimension, state) {
  const surface = surfaceY(dimension, Math.floor(state.x), Math.floor(state.z), state.y + 10);
  if (surface !== undefined) {
    // Ease towards the new height so the funnel does not jump up cliffs.
    state.y += Math.max(-2, Math.min(2, surface - state.y));
  }
}

function drawFunnel(dimension, state, cfg) {
  const center = { x: state.x, y: state.y, z: state.z };
  for (let layer = 0; layer < 14; layer++) {
    const height = layer * 1.6;
    const radius = 0.9 + (layer / 14) * cfg.radius * 0.8;
    const spokes = layer < 4 ? 2 : 3;
    for (let s = 0; s < spokes; s++) {
      const angle = state.spin * (1.4 - layer * 0.05) + (s / spokes) * Math.PI * 2;
      const point = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + height,
        z: center.z + Math.sin(angle) * radius
      };
      spawnParticleSafe(dimension, "nd:tornado_debris", point);
    }
  }
  spawnParticleSafe(dimension, "nd:tornado_core", { x: center.x, y: center.y + 0.2, z: center.z });
}

function pullEntities(dimension, state, cfg, age) {
  const center = { x: state.x, y: state.y, z: state.z };
  const targets = entitiesNear(dimension, center, cfg.liftRadius, {
    excludeFamilies: ["nd_disaster"]
  });

  for (const entity of targets) {
    let loc;
    try {
      loc = entity.location;
    } catch {
      continue;
    }

    const flat = distance2d(loc, center);
    if (flat > cfg.liftRadius) continue;

    const isPlayer = entity.typeId === "minecraft:player";
    if (isPlayer && !getSetting("playerDamage") && flat < 2) continue;

    // Inward pull + a tangent so everything spirals instead of falling straight in.
    const inward = normalize(sub({ x: center.x, y: loc.y, z: center.z }, loc));
    const tangent = { x: -inward.z, y: 0, z: inward.x };
    const closeness = 1 - flat / cfg.liftRadius;

    const push = {
      x: (inward.x * 0.6 + tangent.x * 0.9) * cfg.pullStrength * (0.4 + closeness),
      y: cfg.liftStrength * (0.35 + closeness * 0.9),
      z: (inward.z * 0.6 + tangent.z * 0.9) * cfg.pullStrength * (0.4 + closeness)
    };

    // Dropped items are light: they get yanked much harder.
    if (entity.typeId === "minecraft:item") {
      push.x *= 1.8;
      push.y *= 1.6;
      push.z *= 1.8;
    }

    pushEntity(entity, push);

    if (age % 20 === 0 && flat < cfg.radius * 0.6) {
      if (!isPlayer || getSetting("playerDamage")) {
        damageEntity(entity, TUNING.tornado.damagePerSecond, "fall");
      }
    }
  }
}

function ripBlock(dimension, state, cfg) {
  const angle = randFloat(0, Math.PI * 2);
  const radius = randFloat(0, cfg.radius);
  const x = Math.floor(state.x + Math.cos(angle) * radius);
  const z = Math.floor(state.z + Math.sin(angle) * radius);
  const surface = surfaceY(dimension, x, z, state.y + 20);
  if (surface === undefined) return;

  const top = { x, y: surface, z };
  const topId = blockIdAt(dimension, top);
  if (topId && !isProtectedId(topId) && isReplaceableId(topId) && topId !== "minecraft:air") {
    setBlockSafe(dimension, top, "minecraft:air");
    spawnParticleSafe(dimension, "nd:tornado_debris", add(top, { x: 0.5, y: 0.5, z: 0.5 }));
    return;
  }

  // Occasionally tear the surface block itself out of the ground.
  if (Math.random() < 0.25) {
    const ground = { x, y: surface - 1, z };
    const groundId = blockIdAt(dimension, ground);
    if (groundId && !isProtectedId(groundId) && groundId !== "minecraft:air") {
      if (setBlockSafe(dimension, ground, "minecraft:air")) {
        spawnParticleSafe(dimension, "nd:tornado_debris", add(ground, { x: 0.5, y: 1, z: 0.5 }));
        if (randInt(0, 6) === 0) {
          playSoundAt(dimension, ground, SOUNDS.tornadoDebris.custom, SOUNDS.tornadoDebris.vanilla, {
            volume: 0.6,
            pitch: randFloat(0.7, 1.1)
          });
        }
      }
    }
  }
}
