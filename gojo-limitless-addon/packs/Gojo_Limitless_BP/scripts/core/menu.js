import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData, FormCancelationReason } from "@minecraft/server-ui";
import { ITEMS } from "../data/abilities.js";
import { getState, flash } from "./state.js";
import { grantLoadout } from "./items.js";
import { worldSettings, setWorldSetting, playerPref, setPlayerPref } from "./settings.js";
import { cooldownLeft, tryCast } from "./cast.js";
import { transform, release } from "../abilities/transform.js";
import { logError, secondsText } from "../lib/util.js";

/** @typedef {import("@minecraft/server").Player} Player */

/**
 * Show a form, retrying while the player has another screen open
 * (the chat box, inventory...), for up to ~5 seconds.
 * @template {{ canceled: boolean, cancelationReason?: FormCancelationReason }} R
 * @param {Player} player
 * @param {{ show: (p: Player) => Promise<R> }} form
 * @param {(response: R) => void} onResponse
 * @param {number} [attempt]
 */
function present(player, form, onResponse, attempt = 0) {
  form
    .show(player)
    .then((response) => {
      if (response.canceled && response.cancelationReason === FormCancelationReason.UserBusy && attempt < 25) {
        system.runTimeout(() => present(player, form, onResponse, attempt + 1), 4);
        return;
      }
      onResponse(response);
    })
    .catch((e) => logError("menu.show", e));
}

/** @param {boolean} v */
const onOff = (v) => (v ? "§aON" : "§cOFF");

/** @param {Player} player */
export function openMainMenu(player) {
  const st = getState(player);
  const status = [
    `§7Form: ${st.transformed ? "§bGojo Satoru" : "§8human"}`,
    `§7Infinity: ${onOff(st.infinity)}   §7Six Eyes: ${onOff(st.sixEyes)}`,
    `§7Domain: ${st.domain ? "§dexpanded" : "§8none"}`,
  ];
  const cds = [];
  for (const key of ["lapse_blue", "reversal_red", "hollow_purple", "unlimited_void", "reverse_cursed_technique"]) {
    const left = cooldownLeft(st, key);
    if (left > 0) cds.push(`${ITEMS[key].color}${ITEMS[key].short}§7 ${secondsText(left)}`);
  }
  if (cds.length) status.push("§7Recharging: " + cds.join("§7, "));

  /** @type {Array<() => void>} */
  const actions = [];
  const form = new ActionFormData().title("§l§bLimitless").body(status.join("\n"));
  if (st.transformed) {
    form.button("§cRelease Transformation", ITEMS.transformation.icon);
    actions.push(() => release(player, st));
    form.button("§fRe-equip techniques\n§8organise hotbar", ITEMS.lapse_blue.icon);
    actions.push(() => {
      const r = grantLoadout(player);
      flash(st, `§b${r.placed} techniques on your hotbar${r.missing ? ` §c(${r.missing} did not fit)` : ""}`, 50);
    });
  } else {
    form.button("§bTransform into Gojo Satoru", ITEMS.transformation.icon);
    actions.push(() => transform(player, st));
  }
  form.button(`§3Infinity: ${onOff(st.infinity)}`, ITEMS.infinity.icon);
  actions.push(() => tryCast(player, "infinity", { trigger: "menu" }));
  form.button(`§3Six Eyes: ${onOff(st.sixEyes)}`, ITEMS.six_eyes.icon);
  actions.push(() => tryCast(player, "six_eyes", { trigger: "menu" }));
  form.button("§eSettings\n§8performance, PvP, terrain", "textures/ui/settings_glyph_color_2x");
  actions.push(() => openSettings(player));
  form.button("§aTechnique Guide", "textures/ui/infobulb");
  actions.push(() => openGuide(player));

  present(player, form, (r) => {
    if (r.canceled || r.selection === undefined) return;
    const act = actions[r.selection];
    if (!act) return;
    try {
      act();
    } catch (e) {
      logError("menu.action", e);
    }
  });
}

/** @param {Player} player */
function openSettings(player) {
  const ws = worldSettings();
  const form = new ModalFormData()
    .title("§l§eLimitless Settings")
    .dropdown(
      "§fParticle quality §8(world)\n§7Use Low on older phones for the best FPS.",
      ["Low", "Medium (recommended)", "High"],
      ws.quality
    )
    .toggle("§fTerrain destruction §8(world)\n§7Blue, Red and Hollow Purple erase blocks.", ws.destruction)
    .toggle("§fTechniques hit other players §8(world)", ws.pvp)
    .toggle("§fSpare pets & villagers §8(world)", ws.spareFriendly)
    .toggle("§fCinematic titles §8(you)", playerPref(player, "titles"))
    .toggle("§fCamera shake & screen flashes §8(you)", playerPref(player, "shake"))
    .toggle("§fAction bar HUD §8(you)", playerPref(player, "hud"));
  present(player, form, (r) => {
    if (r.canceled || !r.formValues) return;
    const [quality, destruction, pvp, spare, titles, shake, hud] = r.formValues;
    setWorldSetting("quality", Number(quality));
    setWorldSetting("destruction", !!destruction);
    setWorldSetting("pvp", !!pvp);
    setWorldSetting("spareFriendly", !!spare);
    setPlayerPref(player, "titles", !!titles);
    setPlayerPref(player, "shake", !!shake);
    setPlayerPref(player, "hud", !!hud);
    flash(getState(player), "§aLimitless settings saved", 40);
  });
}

const GUIDE = [
  ["transformation", "Tap to become Gojo: all nine techniques go to your hotbar, Infinity turns on and you gain Speed, Strength, Resistance, Jump Boost and Haste. Sneak + tap opens this menu."],
  ["infinity", "Toggle. Enemies slow down as they approach and can't cross the barrier; arrows, fireballs and other projectiles stop in mid-air. Attacks that still connect are nullified."],
  ["lapse_blue", "Creates a point of attraction where you look (or on the mob you tap). Everything within 10 blocks is dragged in and crushed for 4 seconds, then it collapses."],
  ["reversal_red", "Charges a repelling orb in your hand and fires it. On impact it explodes with huge knockback and heavy area damage."],
  ["hollow_purple", "Blue and Red form at your sides and collide into imaginary mass that flies 90 blocks, erasing every enemy in its path. Aim while it charges."],
  ["unlimited_void", "Expands your domain (14 blocks) for 12 seconds. Everyone inside is paralysed by infinite information, can't fight back and takes damage. You get stronger inside."],
  ["six_eyes", "Toggle. Night vision, +25% technique damage, target analysis on your HUD and blue eye markers above nearby enemies - even invisible ones."],
  ["teleport", "Blink up to 32 blocks to where you look. Look at (or tap) an enemy to appear right behind it."],
  ["reverse_cursed_technique", "Regenerates 10 hearts over 2 seconds and cleanses poison, wither, slowness and other harmful effects."],
  ["black_flash", "Tap near an enemy (or hit it) to dash in and strike with distorted cursed energy. Chain Black Flashes within 8 seconds to enter the Zone for more damage."],
];

/** @param {Player} player */
function openGuide(player) {
  const form = new ActionFormData()
    .title("§l§aTechnique Guide")
    .body(
      "§7Every technique is an item: select it and §ftap the screen§7 (or right-click). " +
        "Tapping a mob or a block also casts it, so it always works with touch controls. " +
        "The white sweep on the hotbar icon and the action bar show the cooldown."
    );
  for (const [key] of GUIDE) form.button(ITEMS[key].name, ITEMS[key].icon);
  present(player, form, (r) => {
    if (r.canceled || r.selection === undefined) return;
    const entry = GUIDE[r.selection];
    if (!entry) return;
    const def = ITEMS[entry[0]];
    const cd = def.cooldown ? `\n\n§7Cooldown: §f${def.cooldown}s` : "";
    const detail = new ActionFormData().title(def.name).body(`§f${entry[1]}${cd}`).button("§7< Back");
    present(player, detail, (r2) => {
      if (!r2.canceled) openGuide(player);
    });
  });
}
