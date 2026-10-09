// Perfect Disguises - touch friendly menus (big buttons with icons).
import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { DISGUISES } from "./disguises.js";
import {
  SETTINGS,
  applyDisguise,
  currentDisguise,
  getSetting,
  getState,
  hideNameTag,
  removeDisguise,
  restoreNameTag,
  say,
  setSetting,
} from "./core.js";
import { useAbility } from "./abilities.js";

const TITLE = "§l§5Perfect Disguises";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("./disguises.js").Disguise} Disguise */

/** @param {number} ticks */
function wait(ticks) {
  return new Promise((resolve) => system.runTimeout(() => resolve(undefined), ticks));
}

/**
 * Shows a form, retrying while the player is busy (chat open, etc.).
 * @param {Player} player
 * @param {ActionFormData | ModalFormData} form
 * @returns {Promise<any>}
 */
async function show(player, form) {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!player.isValid()) return undefined;
    let response;
    try {
      response = await form.show(player);
    } catch {
      return undefined;
    }
    if (!response.canceled || response.cancelationReason !== "UserBusy") return response;
    await wait(10);
  }
  return undefined;
}

/** @param {Player} player */
function abilityLine(player) {
  const left = getState(player).cooldownUntil - system.currentTick;
  return left > 0 ? `§c(recharging ${Math.ceil(left / 20)}s)` : "§2(ready)";
}

/** @param {Player} player */
export async function openMainMenu(player) {
  const current = currentDisguise(player);
  const form = new ActionFormData().title(TITLE);
  form.body(
    current
      ? `You are disguised as a ${current.color}§l${current.name}§r.\n\n§7Tip: crouch + use the wand to use your ability quickly.`
      : "Tap a mob to transform into it!\n\n§7Tip: open §fPowers & Help§7 to see what every disguise can do."
  );

  const actions = [];
  if (current && current.ability) {
    form.button(`§l${current.ability.name}\n${abilityLine(player)}`, "textures/pd/ui/ability");
    actions.push(() => useAbility(player, current));
  }
  if (current) {
    form.button("§l§4Remove Disguise\n§r§8Back to your normal self", "textures/pd/ui/remove");
    actions.push(() => removeDisguise(player));
  }
  for (const def of DISGUISES) {
    const mark = current === def ? "\n§2(your disguise)" : "";
    form.button(`§l${def.name}${mark}`, def.icon);
    actions.push(() => applyDisguise(player, def));
  }
  form.button("§lPowers & Help", "textures/pd/ui/help");
  actions.push(() => openHelp(player));
  form.button("§lSettings", "textures/pd/ui/settings");
  actions.push(() => openSettings(player));

  const response = await show(player, form);
  if (!response || response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action && player.isValid()) action();
}

/** @param {Player} player */
async function openHelp(player) {
  const form = new ActionFormData()
    .title(TITLE)
    .body(
      "§lHow to play§r\n" +
        "§f- Use the §dDisguise Wand§f to open this menu.\n" +
        "- Crouch + use the wand to use your disguise's ability.\n" +
        "- Mobs treat you like the mob you look like: most monsters ignore you, " +
        "but natural enemies (golems, wolves, foxes, zombies...) may hunt you.\n" +
        "- Mobs that are already chasing you may keep chasing!\n" +
        "- Your disguise falls off when you die.\n\n" +
        "§7Tap a mob to see its powers and weaknesses."
    );
  for (const def of DISGUISES) form.button(`§l${def.name}`, def.icon);
  form.button("§lBack", "textures/pd/ui/back");
  const response = await show(player, form);
  if (!response || response.canceled || response.selection === undefined) return;
  const def = DISGUISES[response.selection];
  if (def) await openInfo(player, def);
  else await openMainMenu(player);
}

/**
 * @param {Player} player
 * @param {Disguise} def
 */
async function openInfo(player, def) {
  const lines = [`${def.color}§l${def.name}§r\n`, "§2§lPowers§r"];
  for (const perk of def.perks) lines.push("§a+ §f" + perk);
  lines.push("", "§4§lWeaknesses§r");
  for (const weak of def.weaknesses) lines.push("§c- §f" + weak);
  const form = new ActionFormData()
    .title(TITLE)
    .body(lines.join("\n"))
    .button(`§lDisguise as ${def.name}`, def.icon)
    .button("§lBack", "textures/pd/ui/back");
  const response = await show(player, form);
  if (!response || response.canceled) return;
  if (response.selection === 0) applyDisguise(player, def);
  else if (response.selection === 1) await openHelp(player);
}

/** @param {Player} player */
async function openSettings(player) {
  const names = /** @type {(keyof typeof SETTINGS)[]} */ (Object.keys(SETTINGS));
  const form = new ModalFormData().title(TITLE);
  for (const name of names) form.toggle(SETTINGS[name].label, getSetting(player, name));
  const response = await show(player, form);
  if (!response || response.canceled || !response.formValues) return;
  names.forEach((name, i) => setSetting(player, name, response.formValues[i] === true));
  if (currentDisguise(player)) {
    if (getSetting(player, "hideName")) hideNameTag(player);
    else restoreNameTag(player);
  }
  say(player, "Settings saved.");
}
