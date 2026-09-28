import { registerAbility } from "../core/cast.js";
import { flash } from "../core/state.js";
import { addTask } from "../core/tasks.js";
import { aimPoint } from "../core/aim.js";
import { hurt, setVelocity } from "../core/combat.js";
import { everythingNear, isHostileTarget, targetsNear, bodyCenter, lookTarget, LOOSE, PROJECTILES } from "../core/targets.js";
import { eraseSphere } from "../core/terrain.js";
import { particle, sound, shake, pose, playersNear } from "../lib/fx.js";
import { alive, rand } from "../lib/util.js";

const DURATION = 80; // 4 seconds
const PULL_RADIUS = 10;
const CORE_RADIUS = 2.0;

registerAbility("lapse_blue", (player, st, ctx) => {
  const dim = player.dimension;
  const target = ctx.target && isHostileTarget(ctx.target, player) ? ctx.target : lookTarget(player, 18);
  const center = target ? bodyCenter(target) : aimPoint(player, 14, 8, 3);
  pose(player, "animation.gojo.cast_blue");
  particle(dim, "gojo:blue_singularity", center);
  sound(dim, "gojo.blue.cast", center, { radius: 48 });
  shake([player], 0.15, 0.35);
  flash(st, "§9§lLapse: Blue", 30);
  addTask(blueTask(player, center));
  return true;
});

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Vector3} center
 * @returns {import("../core/tasks.js").Task}
 */
function blueTask(player, center) {
  const dim = player.dimension;
  const casterId = player.id;
  let age = 0;
  /** @type {Map<string, number>} last damage tick per entity */
  const lastHit = new Map();
  return {
    name: "blue",
    ownerId: casterId,
    update(tick) {
      age++;
      if (age > DURATION || !alive(player)) return false;
      if (age % 2 === 0) pull(tick);
      if (age % 10 === 0) particle(dim, "gojo:blue_pulse", center);
      if (age % 20 === 5) sound(dim, "gojo.blue.hum", center, { radius: 24, volume: 0.9 });
      return true;
    },
    end() {
      particle(dim, "gojo:blue_collapse", center);
      sound(dim, "gojo.blue.collapse", center, { radius: 40 });
      shake(playersNear(dim, center, 16), 0.2, 0.4);
      if (alive(player)) {
        for (const e of targetsNear(dim, center, CORE_RADIUS + 1.5, player)) hurt(e, 6, player);
        eraseSphere(dim, center, 2.5, { safeCenter: player.location, safeRadius: 4, budget: 40 });
      }
    },
  };

  /** @param {number} tick */
  function pull(tick) {
    for (const e of everythingNear(dim, center, PULL_RADIUS)) {
      if (e.id === casterId) continue;
      let type;
      try {
        type = e.typeId;
      } catch {
        continue;
      }
      const loose = LOOSE.has(type) || PROJECTILES.has(type);
      if (!loose && !isHostileTarget(e, player)) continue;
      const c = loose ? e.location : bodyCenter(e);
      const tx = center.x - c.x;
      const ty = center.y - c.y;
      const tz = center.z - c.z;
      const d = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (d < CORE_RADIUS) {
        // Trapped: churn around inside the singularity.
        setVelocity(e, {
          x: tx * 0.3 + rand(-0.12, 0.12) - tz * 0.15,
          y: ty * 0.3 + 0.05,
          z: tz * 0.3 + rand(-0.12, 0.12) + tx * 0.15,
        });
      } else {
        const speed = Math.min(1.25, 0.35 + (1 - d / PULL_RADIUS) * 0.95);
        setVelocity(e, { x: (tx / d) * speed, y: (ty / d) * speed + 0.07, z: (tz / d) * speed });
      }
      if (loose) continue;
      const last = lastHit.get(e.id) ?? -1000;
      if (d < CORE_RADIUS + 0.6) {
        if (tick - last >= 10) {
          lastHit.set(e.id, tick);
          hurt(e, 4, player);
          particle(dim, "gojo:blue_spark", c);
        }
      } else if (tick - last >= 20) {
        lastHit.set(e.id, tick);
        hurt(e, 1, player);
      }
    }
  }
}
