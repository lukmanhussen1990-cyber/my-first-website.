/**
 * Meteor - a burning rock (plus a small shower of smaller ones) that falls out
 * of the sky and explodes on impact.
 */

import { TUNING, getSetting } from "../config.js";
import { SOUNDS } from "../sounds.js";
import {
  blockIdAt,
  entitiesNear,
  heightRange,
  isAirId,
  isProtectedId,
  isReplaceableId,
  playSoundAt,
  randFloat,
  randInt,
  removeEntitySafe,
  setBlockSafe,
  spawnEntitySafe,
  spawnParticleSafe,
  teleportSafe,
  normalize,
  sub,
  scale
} from "../util.js";

export const meteor = {
  key: "meteor",
  name: "Meteor",
  color: "§c",
  icon: "textures/ui/nd_icon_meteor",
  description: "A burning rock falls from the sky and explodes.",
  warning: "A meteor has entered the atmosphere!",

  create(dimension, location, options = {}) {
    const cfg = TUNING.meteor;
    const rocks = [];

    const makeRock = (target, power, delay, scaleHint) => {
      const start = {
        x: target.x + randFloat(-25, 25),
        y: Math.min(target.y + cfg.spawnHeight, heightRange(dimension).max - 2),
        z: target.z + randFloat(-25, 25)
      };
      const velocity = scale(normalize(sub(target, start)), cfg.speed);
      return {
        pos: start,
        vel: velocity,
        power,
        delay,
        life: cfg.maxFlightTicks,
        entity: undefined,
        scaleHint,
        done: false
      };
    };

    const showerCount = options.shower === false ? 0 : cfg.showerCount;
    rocks.push(makeRock({ ...location }, options.power ?? cfg.explosionPower, 0, 1));
    for (let i = 0; i < showerCount; i++) {
      const target = {
        x: location.x + randFloat(-cfg.showerSpread, cfg.showerSpread),
        y: location.y,
        z: location.z + randFloat(-cfg.showerSpread, cfg.showerSpread)
      };
      rocks.push(makeRock(target, cfg.showerExplosionPower, randInt(10, 90), 0.5));
    }

    playSoundAt(dimension, location, SOUNDS.meteorFly.custom, SOUNDS.meteorFly.vanilla, {
      volume: 1.6,
      pitch: 0.6
    });

    return {
      getLocation() {
        const alive = rocks.find((rock) => !rock.done);
        return alive ? { ...alive.pos } : { ...location };
      },

      tick(age) {
        let remaining = 0;
        for (const rock of rocks) {
          if (rock.done) continue;
          remaining++;

          if (rock.delay > 0) {
            rock.delay--;
            continue;
          }
          if (!rock.entity) {
            rock.entity = spawnEntitySafe(dimension, "nd:meteor", rock.pos);
          }

          rock.life--;
          if (rock.life <= 0) {
            impact(dimension, rock);
            continue;
          }

          // Move in a few small steps so fast meteors cannot tunnel through walls.
          const steps = 3;
          const step = scale(rock.vel, 1 / steps);
          for (let s = 0; s < steps; s++) {
            rock.pos = { x: rock.pos.x + step.x, y: rock.pos.y + step.y, z: rock.pos.z + step.z };
            if (hasHitSomething(dimension, rock.pos)) {
              impact(dimension, rock);
              break;
            }
          }
          if (rock.done) continue;

          teleportSafe(rock.entity, rock.pos);
          spawnParticleSafe(dimension, "nd:meteor_trail", rock.pos);
          spawnParticleSafe(dimension, "nd:meteor_trail", {
            x: rock.pos.x - rock.vel.x * 0.5,
            y: rock.pos.y - rock.vel.y * 0.5,
            z: rock.pos.z - rock.vel.z * 0.5
          });

          if (age % 12 === 0) {
            playSoundAt(dimension, rock.pos, SOUNDS.meteorFly.custom, SOUNDS.meteorFly.vanilla, {
              volume: 1.1,
              pitch: randFloat(0.5, 0.8)
            });
          }
        }
        return remaining === 0;
      },

      stop() {
        for (const rock of rocks) {
          removeEntitySafe(rock.entity);
          rock.done = true;
        }
      }
    };

    /** True when the meteor reached a solid block, a liquid or the world floor. */
    function hasHitSomething(dim, pos) {
      const range = heightRange(dim);
      if (pos.y <= range.min + 1) return true;
      const id = blockIdAt(dim, pos);
      if (id === undefined) return false; // unloaded chunk: keep flying
      if (!isAirId(id) && !isReplaceableId(id)) return true;
      if (id === "minecraft:water" || id === "minecraft:lava") return true;
      const hits = entitiesNear(dim, pos, 1.6, { excludeFamilies: ["nd_disaster"] });
      return hits.length > 0;
    }

    function impact(dim, rock) {
      rock.done = true;
      const at = { ...rock.pos };
      removeEntitySafe(rock.entity);
      rock.entity = undefined;

      try {
        dim.createExplosion(at, rock.power, {
          breaksBlocks: getSetting("blockDamage"),
          causesFire: true,
          allowUnderwater: true
        });
      } catch {
        // Explosions can fail in unloaded chunks - the effects below still run.
      }

      playSoundAt(dim, at, SOUNDS.meteorImpact.custom, SOUNDS.meteorImpact.vanilla, {
        volume: 2,
        pitch: randFloat(0.6, 0.9)
      });
      for (let i = 0; i < 12; i++) {
        spawnParticleSafe(dim, "nd:meteor_trail", {
          x: at.x + randFloat(-1.5, 1.5),
          y: at.y + randFloat(0, 2),
          z: at.z + randFloat(-1.5, 1.5)
        });
      }
      spawnParticleSafe(dim, "minecraft:huge_explosion_emitter", at);

      if (getSetting("blockDamage")) burnCrater(dim, at, rock.power);
    }

    /** Scatters fire and a little magma inside the fresh crater. */
    function burnCrater(dim, at, power) {
      const radius = Math.max(2, Math.round(power));
      for (let i = 0; i < radius * 6; i++) {
        const x = Math.floor(at.x + randFloat(-radius, radius));
        const z = Math.floor(at.z + randFloat(-radius, radius));
        for (let dy = 2; dy >= -2; dy--) {
          const below = { x, y: Math.floor(at.y) + dy - 1, z };
          const here = { x, y: Math.floor(at.y) + dy, z };
          const belowId = blockIdAt(dim, below);
          const hereId = blockIdAt(dim, here);
          if (!belowId || !hereId) continue;
          if (isProtectedId(belowId)) continue;
          if (!isAirId(belowId) && !isReplaceableId(belowId) && isAirId(hereId)) {
            if (Math.random() < 0.5) setBlockSafe(dim, here, "minecraft:fire", { age: 0 });
            else if (Math.random() < 0.25) setBlockSafe(dim, below, "minecraft:magma");
            break;
          }
        }
      }
    }
  }
};
