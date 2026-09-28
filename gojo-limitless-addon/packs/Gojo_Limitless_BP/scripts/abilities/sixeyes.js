import { registerAbility } from "../core/cast.js";
import { flash, saveToggles } from "../core/state.js";
import { refreshBuffs } from "../core/buffs.js";
import { setBlindfoldLifted } from "../core/items.js";
import { bodyCenter, lookTarget, coneTarget, HOSTILE_FAMILIES } from "../core/targets.js";
import { particle, sound, pose, screenFlash } from "../lib/fx.js";
import { displayName } from "../lib/util.js";
import { addScaled, rightOf, distance } from "../lib/vec.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("../core/state.js").PlayerState} PlayerState */

registerAbility("six_eyes", (player, st) => {
  setSixEyes(player, st, !st.sixEyes, false);
});

/**
 * @param {Player} player
 * @param {PlayerState} st
 * @param {boolean} on
 * @param {boolean} silent
 */
export function setSixEyes(player, st, on, silent) {
  st.sixEyes = on;
  st.focusText = "";
  saveToggles(player, st);
  refreshBuffs(player, st, true);
  setBlindfoldLifted(player, on);
  if (silent) return;
  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  if (on) {
    particle(player.dimension, "gojo:six_eyes_open", addScaled(eye, dir, 1.6));
    screenFlash(player, { red: 0.35, green: 0.8, blue: 1 }, 0.05, 0.05, 0.35);
  }
  sound(player.dimension, on ? "gojo.six_eyes.on" : "gojo.six_eyes.off", eye, { radius: 20 });
  pose(player, "animation.gojo.six_eyes");
  flash(st, on ? "§3◉ Six Eyes §a§lUNVEILED" : "§3◉ Six Eyes §7sealed", 40);
}

/**
 * Every 5 ticks while Six Eyes is active: eye trails, target analysis and
 * hostile markers (blue eye particles above enemies, even invisible ones).
 * @param {Player} player
 * @param {PlayerState} st
 * @param {number} tick
 */
export function sixEyesTick(player, st, tick) {
  const dim = player.dimension;
  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  const right = rightOf(dir);
  // Blue light trailing from both eyes (placed at the temples, so it is visible
  // to others and in third person without blocking your own first-person view).
  if (tick % 10 === 0) {
    for (const side of [-1, 1]) {
      particle(dim, "gojo:six_eyes_trail", {
        x: eye.x + right.x * 0.27 * side + dir.x * 0.12,
        y: eye.y + 0.02,
        z: eye.z + right.z * 0.27 * side + dir.z * 0.12,
      });
    }
  }
  // Target analysis for the HUD.
  const target = lookTarget(player, 40) ?? coneTarget(player, 24, 0.94);
  if (target) {
    let hpText = "";
    try {
      const hp = /** @type {import("@minecraft/server").EntityHealthComponent | undefined} */ (
        target.getComponent("minecraft:health")
      );
      if (hp) hpText = ` §c${Math.ceil(hp.currentValue)}§7/§c${Math.ceil(hp.effectiveMax)} HP`;
    } catch {
      // ignore
    }
    const d = distance(eye, target.location);
    st.focusText = `§3◉ §f${displayName(target)}${hpText} §8(${d.toFixed(0)}m)`;
    if (tick % 10 === 0) {
      const c = bodyCenter(target);
      particle(dim, "gojo:six_eyes_focus", { x: c.x, y: target.getHeadLocation().y + 0.9, z: c.z });
    }
  } else {
    st.focusText = "";
  }
  // Mark nearby hostiles every second.
  if (tick % 20 === 0) {
    let hostiles = [];
    try {
      hostiles = dim.getEntities({ location: eye, maxDistance: 24, families: HOSTILE_FAMILIES, closest: 10 });
    } catch {
      hostiles = [];
    }
    for (const h of hostiles) {
      if (target && h.id === target.id) continue;
      try {
        const head = h.getHeadLocation();
        particle(dim, "gojo:six_eyes_mark", { x: head.x, y: head.y + 0.8, z: head.z });
      } catch {
        // ignore
      }
    }
    // Reveal invisible players/mobs that are not hostile-family (e.g. invisible players).
    try {
      for (const p of dim.getPlayers({ location: eye, maxDistance: 24 })) {
        if (p.id === player.id) continue;
        if (p.getEffect("invisibility")) {
          const head = p.getHeadLocation();
          particle(dim, "gojo:six_eyes_mark", { x: head.x, y: head.y + 0.8, z: head.z });
        }
      }
    } catch {
      // ignore
    }
  }
}
