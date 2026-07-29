/**
 * Imran Security House - the deployer and totem menus.
 */

import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { getSetting, resetSettings, setSetting } from "./config.js";
import { SOUNDS } from "./sounds.js";
import { buildHouse, houseCount, houseStatus, removeLastHouse } from "./house.js";
import { hordeStatus, isActive, startHorde, stopHorde } from "./horde.js";
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
      console.warn(`[Imran] form error: ${error}`);
    });
}

export function openDeployerMenu(player) {
  playSoundForPlayer(player, SOUNDS.menu.custom, SOUNDS.menu.vanilla, { volume: 0.7, pitch: 1.2 });

  const form = new ActionFormData()
    .title("§l§6IMRAN")
    .body(`${hordeStatus()}\n\n§6Houses (${houseCount()}):\n${houseStatus()}`)
    .button("§6Build the house\n§812 blocks in front of you", "textures/ui/ih_icon_house")
    .button("§7Remove the last house\n§8Clears it back to air", "textures/ui/ih_icon_remove")
    .button(
      isActive() ? "§aStop the disaster\n§8Clears every zombie" : "§4Zombie disaster\n§8Send the horde",
      isActive() ? "textures/ui/ih_icon_stop" : "textures/ui/ih_icon_horde"
    )
    .button("§bSettings\n§8Horde size, bombers, security", "textures/ui/ih_icon_settings");

  form.__onResponse = (response) => {
    if (response.canceled || response.selection === undefined) return;
    switch (response.selection) {
      case 0: {
        const result = buildHouse(player);
        if (!result.ok) sendMessage(player, `§c[Imran] ${result.reason}`);
        return;
      }
      case 1: {
        sendMessage(
          player,
          removeLastHouse(player.dimension)
            ? "§b[Imran] §fThe last house has been cleared away."
            : "§c[Imran] There is no house to remove."
        );
        return;
      }
      case 2: {
        if (isActive()) {
          const removed = stopHorde();
          sendMessage(player, `§b[Imran] §fCalled it off, ${removed} cleared.`);
        } else {
          startHorde();
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
    .title("§lImran Settings")
    .slider("Zombies per disaster", 50, 5000, 50, getSetting("hordeTotal"))
    .slider("Alive at once (lower = smoother)", 20, 600, 10, getSetting("hordeMaxAlive"))
    .slider("Zombies per wave", 2, 40, 2, getSetting("hordeWaveSize"))
    .slider("Exploding zombies (%)", 0, 100, 5, getSetting("bomberPercent"))
    .toggle("Their explosions break blocks", getSetting("bomberBreaksBlocks"))
    .toggle('Chat trigger ("zombie disaster")', getSetting("chatTrigger"))
    .toggle("House security system", getSetting("securitySystem"))
    .toggle("Reset everything to defaults", false);

  form.__onResponse = (response) => {
    if (response.canceled || !response.formValues) return;
    const [total, alive, wave, bombers, breaks, chat, security, reset] = response.formValues;

    if (reset) {
      resetSettings();
      sendMessage(player, "§b[Imran] §fSettings reset to defaults.");
      return;
    }

    setSetting("hordeTotal", Math.max(1, Number(total)));
    setSetting("hordeMaxAlive", Math.max(10, Number(alive)));
    setSetting("hordeWaveSize", Math.max(1, Number(wave)));
    setSetting("bomberPercent", Math.max(0, Number(bombers)));
    setSetting("bomberBreaksBlocks", !!breaks);
    setSetting("chatTrigger", !!chat);
    setSetting("securitySystem", !!security);

    sendMessage(
      player,
      `§b[Imran] §fSaved. §e${Math.max(1, Number(total))}§f per disaster, §e${Math.max(
        10,
        Number(alive)
      )}§f alive at once.` + (Number(alive) > 300 ? " §7That will hurt on a phone." : "")
    );
  };

  showForm(player, form);
}
