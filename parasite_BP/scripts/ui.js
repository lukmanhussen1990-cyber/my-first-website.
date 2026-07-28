/**
 * Parasite - the Parasite Sample menus.
 *
 * Touch friendly: every action is a button, nothing needs to be typed.
 */

import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { PARASITE_ID, SETTINGS_DEFAULTS, getSetting, resetSettings, setSetting } from "./config.js";
import { SOUNDS } from "./sounds.js";
import { population, purgeAll, purgeNear, register, statusText } from "./swarm.js";
import { groundY, playSoundForPlayer, randFloat, spawnEntitySafe } from "./util.js";

/** How far in front of the player a released parasite lands. */
const RELEASE_DISTANCE = 5;

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
      console.warn(`[Parasite] form error: ${error}`);
    });
}

/** Drops one parasite in front of the player. Returns the entity or undefined. */
export function releaseParasite(player, spread = 0) {
  let origin;
  let dimension;
  let view = { x: 0, y: 0, z: 1 };
  try {
    origin = player.location;
    dimension = player.dimension;
    view = player.getViewDirection();
  } catch {
    return undefined;
  }

  const flat = Math.hypot(view.x, view.z) || 1;
  const spot = {
    x: origin.x + (view.x / flat) * RELEASE_DISTANCE + randFloat(-spread, spread),
    y: origin.y,
    z: origin.z + (view.z / flat) * RELEASE_DISTANCE + randFloat(-spread, spread)
  };
  const ground = groundY(dimension, Math.floor(spot.x), Math.floor(spot.z), origin.y + 6, 10);
  if (ground !== undefined) spot.y = ground + 1;

  const entity = spawnEntitySafe(dimension, PARASITE_ID, spot);
  if (!entity) {
    try {
      player.sendMessage("§c[Parasite] No room to release it there.");
    } catch {
      // ignore
    }
    return undefined;
  }
  if (!register(entity)) {
    try {
      player.sendMessage(
        `§c[Parasite] Population cap reached (${getSetting("maxPopulation")}). Purge some first.`
      );
    } catch {
      // ignore
    }
    return undefined;
  }
  playSoundForPlayer(player, SOUNDS.sampleUse.custom, SOUNDS.sampleUse.vanilla, { volume: 1, pitch: 0.9 });
  return entity;
}

/** Main menu, opened by sneaking and tapping with the sample. */
export function openSampleMenu(player) {
  const form = new ActionFormData()
    .title("§l§cParasite Sample")
    .body(`${statusText()}\n\n§7Tap without sneaking to release one instantly.`)
    .button("§cRelease One\n§85 blocks in front of you", "textures/ui/pm_icon_release")
    .button("§4Release a Swarm\n§8Five at once", "textures/ui/pm_icon_swarm")
    .button("§ePurge Nearby\n§832 block radius", "textures/ui/pm_icon_purge")
    .button("§6Purge Everything\n§8Every parasite in the world", "textures/ui/pm_icon_purge_all")
    .button("§bSettings\n§8Eating, breeding, population", "textures/ui/pm_icon_settings");

  form.__onResponse = (response) => {
    if (response.canceled || response.selection === undefined) return;
    switch (response.selection) {
      case 0: {
        releaseParasite(player);
        return;
      }
      case 1: {
        let released = 0;
        for (let i = 0; i < 5; i++) if (releaseParasite(player, 2.5)) released++;
        try {
          player.sendMessage(`§c[Parasite] §fReleased ${released}. Population: ${population()}.`);
        } catch {
          // ignore
        }
        return;
      }
      case 2: {
        let removed = 0;
        try {
          removed = purgeNear(player.dimension, player.location, 32);
        } catch {
          removed = 0;
        }
        playSoundForPlayer(player, SOUNDS.purge.custom, SOUNDS.purge.vanilla, { volume: 1, pitch: 1.2 });
        try {
          player.sendMessage(`§b[Parasite] §fPurged ${removed} nearby.`);
        } catch {
          // ignore
        }
        return;
      }
      case 3: {
        const removed = purgeAll();
        playSoundForPlayer(player, SOUNDS.purge.custom, SOUNDS.purge.vanilla, { volume: 1, pitch: 0.9 });
        try {
          player.sendMessage(`§b[Parasite] §fPurged ${removed} parasite${removed === 1 ? "" : "s"}.`);
        } catch {
          // ignore
        }
        return;
      }
      default:
        openSettingsMenu(player);
    }
  };

  showForm(player, form);
}

export function openSettingsMenu(player) {
  const form = new ModalFormData()
    .title("§lParasite Settings")
    .toggle("Parasites eat blocks", getSetting("eatBlocks"))
    .toggle("They may eat chests and furnaces", getSetting("eatContainers"))
    .toggle("They grow and split in two", getSetting("breeding"))
    .slider("Maximum population", 1, 60, 1, getSetting("maxPopulation"))
    .slider("Blocks eaten per second", 1, 20, 1, getSetting("biteRate"))
    .toggle("Leave infested flesh behind", getSetting("leaveFlesh"))
    .toggle("Reset everything to defaults", false);

  form.__onResponse = (response) => {
    if (response.canceled || !response.formValues) return;
    const [eatBlocks, eatContainers, breeding, maxPopulation, biteRate, leaveFlesh, reset] = response.formValues;

    if (reset) {
      resetSettings();
      try {
        player.sendMessage("§b[Parasite] §fSettings reset to defaults.");
      } catch {
        // ignore
      }
      return;
    }

    setSetting("eatBlocks", !!eatBlocks);
    setSetting("eatContainers", !!eatContainers);
    setSetting("breeding", !!breeding);
    setSetting("maxPopulation", Math.max(1, Number(maxPopulation)));
    setSetting("biteRate", Math.max(1, Number(biteRate)));
    setSetting("leaveFlesh", !!leaveFlesh);

    try {
      player.sendMessage(
        `§b[Parasite] §fSaved. Eating: ${eatBlocks ? "§aon" : "§coff"}§f, breeding: ${
          breeding ? "§aon" : "§coff"
        }§f, cap: §e${Math.max(1, Number(maxPopulation))}§f.`
      );
    } catch {
      // ignore
    }
  };

  showForm(player, form);
}

export { SETTINGS_DEFAULTS };
