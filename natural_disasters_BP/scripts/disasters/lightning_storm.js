/**
 * Lightning Storm - the sky turns black and bolt after bolt hammers the area,
 * with some of them hunting the players.
 */

import { TUNING, getSetting } from "../config.js";
import { SOUNDS } from "../sounds.js";
import {
  playSoundAt,
  playersNear,
  pickRandom,
  randFloat,
  runCommand,
  spawnEntitySafe,
  spawnParticleSafe,
  surfaceY
} from "../util.js";

export const lightningStorm = {
  key: "lightning_storm",
  name: "Lightning Storm",
  color: "§9",
  icon: "textures/ui/nd_icon_storm",
  description: "Dozens of lightning bolts hammer the area.",
  warning: "A lightning storm is closing in!",

  create(dimension, location, options = {}) {
    const cfg = TUNING.lightningStorm;
    const state = {
      center: { ...location },
      ticksLeft: options.durationTicks ?? cfg.durationTicks,
      radius: options.radius ?? cfg.radius,
      changedWeather: false
    };

    if (cfg.setThunderWeather) {
      const seconds = Math.ceil(state.ticksLeft / 20) + 5;
      state.changedWeather = runCommand(dimension, `weather thunder ${seconds}`);
    }

    playSoundAt(dimension, state.center, SOUNDS.stormCharge.custom, SOUNDS.stormCharge.vanilla, {
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

        if (age % cfg.strikeInterval === 0) strike(dimension, state, cfg);

        if (age % 5 === 0) {
          spawnParticleSafe(dimension, "nd:storm_spark", {
            x: state.center.x + randFloat(-state.radius, state.radius),
            y: state.center.y + randFloat(6, 18),
            z: state.center.z + randFloat(-state.radius, state.radius)
          });
        }
        return false;
      },

      stop() {
        if (state.changedWeather) runCommand(dimension, "weather clear");
      }
    };
  }
};

function strike(dimension, state, cfg) {
  let x;
  let z;

  const nearby = playersNear(dimension, state.center, state.radius + 10);
  if (nearby.length > 0 && Math.random() < cfg.huntPlayerChance) {
    const target = pickRandom(nearby);
    let loc;
    try {
      loc = target.location;
    } catch {
      loc = state.center;
    }
    const angle = randFloat(0, Math.PI * 2);
    // Never strike exactly on the player unless player damage is enabled.
    const min = getSetting("playerDamage") ? 0 : cfg.huntMinDistance;
    const dist = randFloat(min, cfg.huntMinDistance + 4);
    x = loc.x + Math.cos(angle) * dist;
    z = loc.z + Math.sin(angle) * dist;
  } else {
    const angle = randFloat(0, Math.PI * 2);
    const dist = randFloat(0, state.radius);
    x = state.center.x + Math.cos(angle) * dist;
    z = state.center.z + Math.sin(angle) * dist;
  }

  const y = surfaceY(dimension, Math.floor(x), Math.floor(z), state.center.y + 40);
  if (y === undefined) return;

  const at = { x: Math.floor(x) + 0.5, y, z: Math.floor(z) + 0.5 };
  spawnEntitySafe(dimension, "minecraft:lightning_bolt", at);
  spawnParticleSafe(dimension, "nd:storm_spark", { x: at.x, y: at.y + 1, z: at.z });
  playSoundAt(dimension, at, SOUNDS.stormThunder.custom, SOUNDS.stormThunder.vanilla, {
    volume: 1.2,
    pitch: randFloat(0.8, 1.2)
  });
}
