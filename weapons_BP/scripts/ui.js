/**
 * Legendary Weapons - the codex and settings screens.
 *
 * Sneak + tap with any legendary weapon opens the codex, so nothing has to be
 * typed on a touch screen.
 */

import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { WEAPONS, WEAPON_KEYS, getSetting, resetSettings, setSetting } from "./config.js";
import { weaponSummary } from "./abilities.js";
import { SOUNDS } from "./sounds.js";
import { playSoundForPlayer, sendMessage } from "./util.js";

function showForm(player, form, attempt = 0) {
  form
    .show(player)
    .then((response) => {
      if (response.canceled && response.cancelationReason === "UserBusy" && attempt < 20) {
        system.runTimeout(() => showForm(player, form, attempt + 1), 10);
        return;
      }
      if (form.__onResponse) form.__onResponse(response);
    })
    .catch((error) => {
      console.warn(`[Weapons] form error: ${error}`);
    });
}

/** The weapon list. */
export function openCodex(player, highlightKey) {
  playSoundForPlayer(player, SOUNDS.codex.custom, SOUNDS.codex.vanilla, { volume: 0.7, pitch: 1.3 });

  const form = new ActionFormData()
    .title("§l§6Weapon Codex")
    .body(
      highlightKey && WEAPONS[highlightKey]
        ? `§7Holding: ${WEAPONS[highlightKey].color}${WEAPONS[highlightKey].name}\n§7Pick a weapon to read its ability.`
        : "§7Pick a weapon to read its ability."
    );

  for (const key of WEAPON_KEYS) {
    const weapon = WEAPONS[key];
    form.button(`${weapon.color}${weapon.name}\n§8${weapon.ability}`, weapon.icon);
  }
  form.button("§bSettings\n§8Power, block damage, PvP", "textures/ui/wm_icon_settings");

  form.__onResponse = (response) => {
    if (response.canceled || response.selection === undefined) return;
    if (response.selection < WEAPON_KEYS.length) {
      openWeaponPage(player, WEAPON_KEYS[response.selection]);
      return;
    }
    openSettingsMenu(player);
  };

  showForm(player, form);
}

/** One weapon's stat sheet. */
export function openWeaponPage(player, key) {
  const weapon = WEAPONS[key];
  if (!weapon) return;

  const form = new ActionFormData()
    .title(`§l${weapon.color}${weapon.name}`)
    .body(weaponSummary(key))
    .button("§7Back to the codex", weapon.icon)
    .button("§aClose", "textures/ui/wm_icon_settings");

  form.__onResponse = (response) => {
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 0) openCodex(player, key);
  };

  showForm(player, form);
}

export function openSettingsMenu(player) {
  const form = new ModalFormData()
    .title("§lWeapon Settings")
    .slider("Ability power (%)", 25, 300, 5, getSetting("powerPercent"))
    .toggle("Abilities may break blocks", getSetting("blockDamage"))
    .toggle("Abilities may hit other players", getSetting("hurtPlayers"))
    .toggle("Abilities cost durability", getSetting("abilityDurability"))
    .toggle("Show ability name on screen", getSetting("showAbilityText"))
    .toggle("Reset everything to defaults", false);

  form.__onResponse = (response) => {
    if (response.canceled || !response.formValues) return;
    const [powerPercent, blockDamage, hurtPlayers, abilityDurability, showAbilityText, reset] = response.formValues;

    if (reset) {
      resetSettings();
      sendMessage(player, "§6[Weapons] §fSettings reset to defaults.");
      return;
    }

    setSetting("powerPercent", Math.max(25, Number(powerPercent)));
    setSetting("blockDamage", !!blockDamage);
    setSetting("hurtPlayers", !!hurtPlayers);
    setSetting("abilityDurability", !!abilityDurability);
    setSetting("showAbilityText", !!showAbilityText);

    sendMessage(
      player,
      `§6[Weapons] §fSaved. Power §e${Math.max(25, Number(powerPercent))}%§f, block damage ${
        blockDamage ? "§aon" : "§coff"
      }§f, PvP ${hurtPlayers ? "§aon" : "§coff"}§f.`
    );
  };

  showForm(player, form);
}
