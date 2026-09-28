import { ITEMS, ITEM_BY_ID } from "../data/abilities.js";
import { cooldownLeft } from "./cast.js";
import { playerPref } from "./settings.js";
import { bar, secondsText } from "../lib/util.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("./state.js").PlayerState} PlayerState */

/**
 * Action bar HUD. Only drawn while a Gojo item is held, a message is pending,
 * Six Eyes is analysing a target or a domain is up - so it never fights other
 * add-ons for the action bar the rest of the time.
 * @param {Player} player
 * @param {PlayerState} st
 * @param {string | undefined} heldId
 * @param {number} tick
 */
export function drawHud(player, st, heldId, tick) {
  if (!playerPref(player, "hud")) return;
  const def = heldId ? ITEM_BY_ID[heldId] : undefined;
  const parts = [];

  if (st.messageUntil > tick) {
    parts.push(st.message);
  } else if (def && def.kind !== "wearable") {
    parts.push(abilityLine(st, def));
  }
  const flags = [];
  if (st.infinity) flags.push("§b∞");
  if (st.sixEyes) flags.push("§3◉");
  if (st.domain && st.domain.endTick > tick) {
    flags.push(`§dVoid ${secondsText(st.domain.endTick - tick)}`);
  }
  if (st.flowStacks > 0 && tick - st.lastBlackFlashTick < 160) flags.push(`§4Zone x${st.flowStacks + 1}`);
  if (st.sixEyes && st.focusText) parts.push(st.focusText);
  if (parts.length === 0 && !def && !(st.domain && st.domain.endTick > tick)) return;
  if (flags.length) parts.push(flags.join(" "));

  const text = parts.join("  §8|  ");
  if (!text) return;
  // Re-send identical text only every 1.5 s to keep it visible.
  if (text === st.lastHudText && tick - st.lastHudTick < 30) return;
  st.lastHudText = text;
  st.lastHudTick = tick;
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch {
    // player left
  }
}

/**
 * @param {PlayerState} st
 * @param {import("../data/abilities.js").GojoItem} def
 */
function abilityLine(st, def) {
  if (def.kind === "toggle") {
    const on = def.key === "infinity" ? st.infinity : st.sixEyes;
    return `${def.color}${def.short} §8» ${on ? "§a§lON" : "§c§lOFF"}`;
  }
  const left = cooldownLeft(st, def.key);
  if (left <= 0) {
    if (st.busy) return `${def.color}${def.short} §8» §eChannelling ${st.busy}`;
    return `${def.color}${def.short} §8» §a§lREADY`;
  }
  const total = Math.max(1, Math.round((ITEMS[def.key]?.cooldown ?? 1) * 20));
  return `${def.color}${def.short} §8» ${bar(1 - left / total, 12, "§b")} §c${secondsText(left)}`;
}
