import { registerAbility } from "../core/cast.js";
import { flash } from "../core/state.js";
import { addTask } from "../core/tasks.js";
import { hurt, knock, setVelocity } from "../core/combat.js";
import { isHostileTarget, targetsNear, everythingNear, bodyCenter, LOOSE } from "../core/targets.js";
import { eraseSphere } from "../core/terrain.js";
import { particle, sound, shake, pose, playersNear } from "../lib/fx.js";
import { alive } from "../lib/util.js";
import { add, addScaled, rightOf, distance, normalize } from "../lib/vec.js";

const CHARGE_TICKS = 8;
const SPEED = 2.4; // blocks per tick
const RANGE = 45;
const BLAST_RADIUS = 6.5;

registerAbility("reversal_red", (player, st, ctx) => {
  pose(player, "animation.gojo.cast_red");
  sound(player.dimension, "gojo.red.charge", player.getHeadLocation(), { radius: 32 });
  flash(st, "§c§lReversal: Red", 30);
  addTask(redTask(player, ctx.target && isHostileTarget(ctx.target, player) ? ctx.target : undefined));
  return true;
});

/** @param {import("@minecraft/server").Player} player */
function handPoint(player) {
  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  const right = rightOf(dir);
  return add(addScaled(addScaled(eye, dir, 1.1), right, 0.38), { x: 0, y: -0.28, z: 0 });
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Entity | undefined} lockedTarget
 * @returns {import("../core/tasks.js").Task}
 */
function redTask(player, lockedTarget) {
  const dim = player.dimension;
  let age = 0;
  /** @type {import("@minecraft/server").Vector3} */
  let pos = handPoint(player);
  /** @type {import("@minecraft/server").Vector3} */
  let dir = player.getViewDirection();
  let travelled = 0;
  let exploded = false;

  return {
    name: "red",
    ownerId: player.id,
    update() {
      age++;
      if (!alive(player)) return false;
      if (age <= CHARGE_TICKS) {
        pos = handPoint(player);
        particle(dim, "gojo:red_charge", pos);
        if (age === CHARGE_TICKS) {
          dir = lockedTarget && alive(lockedTarget) ? normalize({
            x: bodyCenter(lockedTarget).x - pos.x,
            y: bodyCenter(lockedTarget).y - pos.y,
            z: bodyCenter(lockedTarget).z - pos.z,
          }) : player.getViewDirection();
          sound(dim, "gojo.red.fire", pos, { radius: 48 });
          shake([player], 0.25, 0.3);
        }
        return true;
      }
      // Flight: sweep this tick's segment for blocks and entities.
      const hitAt = sweep(pos, dir, SPEED);
      if (hitAt) {
        explode(hitAt.point, hitAt.entity);
        return false;
      }
      pos = addScaled(pos, dir, SPEED);
      travelled += SPEED;
      particle(dim, "gojo:red_orb", pos);
      particle(dim, "gojo:red_trail", pos);
      if (travelled >= RANGE) {
        explode(pos, undefined);
        return false;
      }
      return true;
    },
    end() {
      // If the caster vanished mid-flight the blast simply fizzles out.
      if (!exploded && age > CHARGE_TICKS) particle(dim, "gojo:red_charge", pos);
    },
  };

  /**
   * @param {import("@minecraft/server").Vector3} from
   * @param {import("@minecraft/server").Vector3} d
   * @param {number} len
   * @returns {{point: import("@minecraft/server").Vector3, entity?: import("@minecraft/server").Entity} | undefined}
   */
  function sweep(from, d, len) {
    let best;
    let bestDist = len;
    try {
      const b = dim.getBlockFromRay(from, d, { maxDistance: len, includePassableBlocks: false, includeLiquidBlocks: false });
      if (b) {
        const p = add(b.block.location, b.faceLocation);
        const bd = distance(from, p);
        if (bd <= bestDist) {
          bestDist = bd;
          best = { point: addScaled(p, d, -0.4) };
        }
      }
    } catch {
      return { point: from }; // ran into unloaded chunks
    }
    try {
      for (const hit of dim.getEntitiesFromRay(from, d, { maxDistance: len })) {
        if (!isHostileTarget(hit.entity, player)) continue;
        if (hit.distance <= bestDist) {
          bestDist = hit.distance;
          best = { point: bodyCenter(hit.entity), entity: hit.entity };
        }
        break;
      }
    } catch {
      // ignore
    }
    if (!best) {
      const mid = addScaled(from, d, len * 0.5);
      const close = targetsNear(dim, mid, 1.6, player);
      if (close.length > 0) best = { point: bodyCenter(close[0]), entity: close[0] };
    }
    return best;
  }

  /**
   * @param {import("@minecraft/server").Vector3} at
   * @param {import("@minecraft/server").Entity | undefined} direct
   */
  function explode(at, direct) {
    exploded = true;
    particle(dim, "gojo:red_explosion", at);
    sound(dim, "gojo.red.impact", at, { radius: 64 });
    shake(playersNear(dim, at, 24), 0.45, 0.5);
    if (!alive(player)) return;
    for (const e of targetsNear(dim, at, BLAST_RADIUS, player)) {
      const c = bodyCenter(e);
      const d = distance(c, at);
      const f = Math.max(0, 1 - d / BLAST_RADIUS);
      hurt(e, 6 + 16 * f + (direct && e.id === direct.id ? 6 : 0), player);
      let hx = c.x - at.x;
      let hz = c.z - at.z;
      const hl = Math.sqrt(hx * hx + hz * hz);
      if (hl < 0.2) {
        hx = dir.x;
        hz = dir.z;
      } else {
        hx /= hl;
        hz /= hl;
      }
      knock(e, hx, hz, 1.3 + 1.7 * f, 0.55 + 0.35 * f);
    }
    for (const e of everythingNear(dim, at, BLAST_RADIUS)) {
      try {
        if (!LOOSE.has(e.typeId)) continue;
        const v = normalize({ x: e.location.x - at.x, y: 0.4, z: e.location.z - at.z });
        setVelocity(e, { x: v.x * 1.2, y: 0.5, z: v.z * 1.2 });
      } catch {
        // ignore
      }
    }
    eraseSphere(dim, at, 3, { safeCenter: player.location, safeRadius: 4.5, budget: 60 });
  }
}
