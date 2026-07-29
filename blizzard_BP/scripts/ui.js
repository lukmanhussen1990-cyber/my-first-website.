/**
 * Extreme Blizzard - the Weather Stone menus.
 */

import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { getSetting, resetSettings, setSetting } from "./config.js";
import { SOUNDS } from "./sounds.js";
import { isStorming, setStorm, statusText } from "./blizzard.js";
import { evaluateShelter } from "./shelter.js";
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
      console.warn(`[Blizzard] form error: ${error}`);
    });
}

/** Tells the player exactly why their shelter is or is not safe. */
export function shelterReport(player) {
  let report;
  try {
    report = evaluateShelter(player.dimension, player.location);
  } catch {
    return "§7Could not read your surroundings.";
  }

  if (report.status === "warm") {
    return (
      `§a✔ SAFE§r\n§7This room is sealed (${report.cells} blocks of air) and has ` +
      `§f${report.heat}§7 heat nearby. You will warm up in here.`
    );
  }
  if (report.status === "sheltered") {
    return (
      "§e⚠ SEALED BUT COLD§r\n§7The room is closed in, but there is no fire in it. " +
      "§7Put a §fHeater§7, campfire, lit furnace or torch inside."
    );
  }
  return (
    "§c✘ NOT SHELTERED§r\n§7The air around you runs straight to the outside. " +
    "§7Close every gap - walls, roof, floor and the door - then light a fire inside."
  );
}

export function openStoneMenu(player) {
  playSoundForPlayer(player, SOUNDS.menu.custom, SOUNDS.menu.vanilla, { volume: 0.7, pitch: 1.2 });

  const form = new ActionFormData()
    .title("§l§bWeather Stone")
    .body(`${statusText()}\n\n${shelterReport(player)}`)
    .button(
      isStorming() ? "§aEnd the blizzard\n§8Back to calm weather" : "§bStart a blizzard\n§8Right now",
      isStorming() ? "textures/ui/sw_icon_calm" : "textures/ui/sw_icon_storm"
    )
    .button("§fCheck my shelter\n§8Is this room actually safe?", "textures/ui/sw_icon_shelter")
    .button("§bSettings\n§8Cycle, harshness, snow", "textures/ui/sw_icon_settings");

  form.__onResponse = (response) => {
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 0) {
      setStorm(!isStorming());
      sendMessage(player, isStorming() ? "§b[Blizzard] §fThe storm rolls in." : "§b[Blizzard] §fThe storm dies down.");
      return;
    }
    if (response.selection === 1) {
      sendMessage(player, `§b[Blizzard]\n${shelterReport(player)}`);
      return;
    }
    openSettingsMenu(player);
  };

  showForm(player, form);
}

export function openSettingsMenu(player) {
  const form = new ModalFormData()
    .title("§lBlizzard Settings")
    .toggle("Storms come and go on their own", getSetting("enabled"))
    .toggle("Endless winter (never stops)", getSetting("alwaysOn"))
    .slider("Calm minutes between storms", 1, 30, 1, getSetting("calmMinutes"))
    .slider("Storm minutes", 1, 30, 1, getSetting("stormMinutes"))
    .slider("Harshness (%)", 25, 200, 5, getSetting("harshnessPercent"))
    .toggle("Being outside is lethal", getSetting("deadlyOutside"))
    .toggle("Mobs freeze outside", getSetting("mobsFreeze"))
    .toggle("Snow piles up and water freezes", getSetting("snowBuildUp"))
    .toggle("Whiteout fog", getSetting("fog"))
    .toggle("Reset everything to defaults", false);

  form.__onResponse = (response) => {
    if (response.canceled || !response.formValues) return;
    const [enabled, alwaysOn, calmMinutes, stormMinutes, harshness, deadly, mobs, snow, fog, reset] =
      response.formValues;

    if (reset) {
      resetSettings();
      sendMessage(player, "§b[Blizzard] §fSettings reset to defaults.");
      return;
    }

    setSetting("enabled", !!enabled);
    setSetting("alwaysOn", !!alwaysOn);
    setSetting("calmMinutes", Math.max(1, Number(calmMinutes)));
    setSetting("stormMinutes", Math.max(1, Number(stormMinutes)));
    setSetting("harshnessPercent", Math.max(25, Number(harshness)));
    setSetting("deadlyOutside", !!deadly);
    setSetting("mobsFreeze", !!mobs);
    setSetting("snowBuildUp", !!snow);
    setSetting("fog", !!fog);

    sendMessage(
      player,
      `§b[Blizzard] §fSaved. Harshness §e${Math.max(25, Number(harshness))}%§f, lethal ${
        deadly ? "§aon" : "§coff"
      }§f, endless winter ${alwaysOn ? "§aon" : "§coff"}§f.`
    );
  };

  showForm(player, form);
}
