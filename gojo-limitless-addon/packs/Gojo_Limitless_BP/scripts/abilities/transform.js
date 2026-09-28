import { system } from "@minecraft/server";
import { registerAbility } from "../core/cast.js";
import { flash, saveToggles } from "../core/state.js";
import { refreshBuffs } from "../core/buffs.js";
import { grantLoadout, removeLoadout, equipBlindfold, unequipBlindfold } from "../core/items.js";
import { bodyCenter } from "../core/targets.js";
import { particle, sound, shake, pose, cinematicTitle, screenFlash, playersNear } from "../lib/fx.js";
import { setInfinity } from "./infinity.js";
import { setSixEyes } from "./sixeyes.js";
import { openMainMenu } from "../core/menu.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("../core/state.js").PlayerState} PlayerState */

registerAbility("transformation", (player, st, ctx) => {
  // Sneak + tap (or tapping while already transformed) opens the menu instead.
  if (ctx.trigger !== "menu" && (player.isSneaking || st.transformed)) {
    system.run(() => openMainMenu(player));
    return false;
  }
  if (st.transformed) return false;
  transform(player, st);
  return true;
});

/**
 * @param {Player} player
 * @param {PlayerState} st
 */
export function transform(player, st) {
  st.transformed = true;
  const { placed, missing } = grantLoadout(player);
  if (equipBlindfold(player, st.sixEyes)) st.gaveBlindfold = true;
  saveToggles(player, st);
  if (!st.infinity) setInfinity(player, st, true, true);
  refreshBuffs(player, st, true);

  const dim = player.dimension;
  const c = bodyCenter(player);
  particle(dim, "gojo:transform_burst", c);
  particle(dim, "gojo:infinity_toggle", c);
  sound(dim, "gojo.transform", c, { radius: 48 });
  shake(playersNear(dim, c, 16), 0.3, 0.6);
  screenFlash(player, { red: 0.85, green: 0.95, blue: 1 }, 0.05, 0.15, 0.7);
  cinematicTitle(player, "§b§lTHE HONORED ONE", "§f§oI alone am the honored one.", 50);
  pose(player, "animation.gojo.transform");
  flash(st, `§bLimitless §8» §f${placed} techniques ready §7| §b∞ Infinity ON`, 80);
  try {
    player.sendMessage(
      "§b§lLimitless§r §7» Tap a technique on your hotbar to cast it (tapping a mob or a block works too). " +
        "§fSneak + tap§7 the Transformation item for settings, the guide, or to release the form."
    );
    if (missing > 0) {
      player.sendMessage(`§c${missing} technique(s) did not fit - free some inventory space and use the menu's §fRe-equip techniques§c.`);
    }
  } catch {
    // ignore
  }
}

/**
 * @param {Player} player
 * @param {PlayerState} st
 */
export function release(player, st) {
  st.transformed = false;
  removeLoadout(player);
  if (st.gaveBlindfold) {
    unequipBlindfold(player);
    st.gaveBlindfold = false;
  }
  if (st.sixEyes) setSixEyes(player, st, false, true);
  if (st.infinity) setInfinity(player, st, false, true);
  saveToggles(player, st);
  refreshBuffs(player, st, true);
  const c = bodyCenter(player);
  particle(player.dimension, "gojo:infinity_off", c);
  sound(player.dimension, "gojo.revert", c, { radius: 24 });
  flash(st, "§7Transformation released", 40);
}

/**
 * Ambient Limitless aura while transformed (called every 10 ticks).
 * @param {Player} player
 */
export function auraTick(player) {
  particle(player.dimension, "gojo:aura", player.location);
}
