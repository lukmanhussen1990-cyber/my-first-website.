import { EntityDamageCause } from "@minecraft/server";
import { registerAbility } from "../core/cast.js";
import { flash } from "../core/state.js";
import { addTask } from "../core/tasks.js";
import { hurt, knock, effect } from "../core/combat.js";
import { targetsNear, bodyCenter } from "../core/targets.js";
import { eraseSphere } from "../core/terrain.js";
import { qualityScale } from "../core/settings.js";
import { particle, sound, shake, pose, playersNear, cinematicTitle, screenFlash } from "../lib/fx.js";
import { alive } from "../lib/util.js";
import { add, addScaled, rightOf, lerp } from "../lib/vec.js";

const SPLIT_TICKS = 18; // Blue and Red form on either side
const MERGE_TICKS = 30; // ...then collide
const FIRE_TICK = 34;
const SPEED = 2.0; // blocks per tick
const FLIGHT_TICKS = 45; // 90 blocks
const HIT_RADIUS = 3.6;
const ERASE_RADIUS = 2.6;

registerAbility("hollow_purple", (player, st) => {
  st.busy = "Hollow Purple";
  pose(player, "animation.gojo.hollow_purple");
  cinematicTitle(player, "§5§lHOLLOW PURPLE", "§7Imaginary Technique", 34);
  sound(player.dimension, "gojo.purple.charge", player.getHeadLocation(), { radius: 48 });
  effect(player, "slowness", FIRE_TICK, 2);
  flash(st, "§9Blue §7+ §cRed §7= §5§lPurple", 40);
  addTask(purpleTask(player, st));
  return true;
});

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("../core/state.js").PlayerState} st
 * @returns {import("../core/tasks.js").Task}
 */
function purpleTask(player, st) {
  const dim = player.dimension;
  let age = 0;
  let fired = false;
  let flight = 0;
  /** @type {import("@minecraft/server").Vector3} */
  let pos = player.getHeadLocation();
  /** @type {import("@minecraft/server").Vector3} */
  let dir = player.getViewDirection();
  /** @type {Set<string>} */
  const hit = new Set();
  /** @type {Set<string>} */
  const visited = new Set();
  const ringEvery = qualityScale() >= 1.5 ? 2 : qualityScale() >= 1 ? 3 : 5;

  return {
    name: "purple",
    ownerId: player.id,
    update() {
      age++;
      if (!fired) {
        if (!alive(player)) return false;
        charge();
        if (age >= FIRE_TICK) fire();
        return true;
      }
      return travel();
    },
    end() {
      if (st.busy === "Hollow Purple") st.busy = "";
      if (fired) {
        particle(dim, "gojo:purple_burst", pos);
        sound(dim, "gojo.purple.end", pos, { radius: 64 });
        shake(playersNear(dim, pos, 28), 0.5, 0.6);
      }
    },
  };

  function charge() {
    const eye = player.getHeadLocation();
    const d = player.getViewDirection();
    const right = rightOf(d);
    const drop = { x: 0, y: -0.2, z: 0 };
    const merge = addScaled(eye, d, 2.3);
    let blue = add(addScaled(addScaled(eye, d, 1.8), right, -1.35), drop);
    let red = add(addScaled(addScaled(eye, d, 1.8), right, 1.35), drop);
    if (age > SPLIT_TICKS) {
      const k = Math.min(1, (age - SPLIT_TICKS) / (MERGE_TICKS - SPLIT_TICKS));
      blue = lerp(blue, merge, k * k);
      red = lerp(red, merge, k * k);
    }
    if (age <= MERGE_TICKS) {
      particle(dim, "gojo:purple_charge_blue", blue);
      particle(dim, "gojo:purple_charge_red", red);
      if (age === 2) sound(dim, "gojo.blue.cast", blue, { radius: 24, volume: 0.6 });
      if (age === 8) sound(dim, "gojo.red.charge", red, { radius: 24, volume: 0.6 });
    }
    if (age === MERGE_TICKS) {
      particle(dim, "gojo:purple_merge", merge);
      sound(dim, "gojo.purple.merge", merge, { radius: 48 });
      shake([player], 0.3, 0.4);
    } else if (age > MERGE_TICKS) {
      particle(dim, "gojo:purple_charge_core", merge);
    }
  }

  function fire() {
    fired = true;
    st.busy = "";
    dir = player.getViewDirection();
    pos = addScaled(player.getHeadLocation(), dir, 2.6);
    sound(dim, "gojo.purple.fire", pos, { radius: 96 });
    shake(playersNear(dim, pos, 40), 0.7, 0.9);
    screenFlash(player, { red: 0.55, green: 0.1, blue: 0.85 }, 0.05, 0.1, 0.45);
    flash(st, "§5§lHollow Technique: Purple", 50);
  }

  /** @returns {boolean} keep flying */
  function travel() {
    flight++;
    if (flight > FLIGHT_TICKS) return false;
    const next = addScaled(pos, dir, SPEED);
    if (!particle(dim, "gojo:purple_orb", next)) return false; // unloaded / out of world
    pos = next;
    particle(dim, "gojo:purple_trail", pos);
    if (flight % ringEvery === 0) particle(dim, "gojo:purple_ring", pos);
    if (flight % 6 === 1) sound(dim, "gojo.purple.travel", pos, { radius: 48, volume: 1 });
    // Everything the imaginary mass touches is erased.
    if (alive(player)) {
      for (const e of targetsNear(dim, pos, HIT_RADIUS, player)) {
        if (hit.has(e.id)) continue;
        hit.add(e.id);
        let max = 20;
        try {
          const hp = /** @type {import("@minecraft/server").EntityHealthComponent | undefined} */ (
            e.getComponent("minecraft:health")
          );
          max = hp?.effectiveMax ?? 20;
        } catch {
          // keep default
        }
        hurt(e, Math.max(80, max * 0.45), player, EntityDamageCause.magic);
        const c = bodyCenter(e);
        const side = { x: c.x - pos.x, z: c.z - pos.z };
        const l = Math.sqrt(side.x * side.x + side.z * side.z) || 1;
        knock(e, side.x / l + dir.x * 0.6, side.z / l + dir.z * 0.6, 1.8, 0.7);
      }
      eraseSphere(dim, pos, ERASE_RADIUS, {
        safeCenter: player.location,
        safeRadius: 4.5,
        budget: 50,
        visited,
      });
    }
    // Keep going until range runs out; it passes through blocks and entities.
    return true;
  }
}
