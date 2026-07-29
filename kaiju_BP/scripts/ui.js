/**
 * Kaiju Rampage - the Kaiju Horn menus.
 */

import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { KAIJU_ID, getSetting, resetSettings, setSetting } from "./config.js";
import { SOUNDS } from "./sounds.js";
import { killAll, population, register, statusText } from "./rampage.js";
import { groundY, playSoundForPlayer, randFloat, sendMessage, spawnEntitySafe } from "./util.js";

/** How far in front of the player a summoned kaiju rises. */
const SUMMON_DISTANCE = 22;

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
      console.warn(`[Kaiju] form error: ${error}`);
    });
}

/** Wakes a kaiju in front of the player. */
export function summonKaiju(player) {
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

  if (population() >= getSetting("maxKaiju")) {
    sendMessage(player, `§c[Kaiju] Already ${population()} awake (cap ${getSetting("maxKaiju")}).`);
    return undefined;
  }

  const flat = Math.hypot(view.x, view.z) || 1;
  const spot = {
    x: origin.x + (view.x / flat) * SUMMON_DISTANCE + randFloat(-2, 2),
    y: origin.y,
    z: origin.z + (view.z / flat) * SUMMON_DISTANCE + randFloat(-2, 2)
  };
  const ground = groundY(dimension, Math.floor(spot.x), Math.floor(spot.z), origin.y + 12, 24);
  if (ground !== undefined) spot.y = ground + 1;

  const entity = spawnEntitySafe(dimension, KAIJU_ID, spot);
  if (!entity) {
    sendMessage(player, "§c[Kaiju] There is no room for it there. Try open ground.");
    return undefined;
  }
  if (!register(entity)) return undefined;

  playSoundForPlayer(player, SOUNDS.summon.custom, SOUNDS.summon.vanilla, { volume: 1, pitch: 0.6 });
  return entity;
}

export function openHornMenu(player) {
  playSoundForPlayer(player, SOUNDS.hornOpen.custom, SOUNDS.hornOpen.vanilla, { volume: 0.7, pitch: 0.8 });

  const form = new ActionFormData()
    .title("§l§4Kaiju Horn")
    .body(`${statusText()}\n\n§7Tap without sneaking to wake one instantly.`)
    .button("§4Wake the Kaiju\n§822 blocks in front of you", "textures/ui/kj_icon_summon")
    .button("§6Banish Them All\n§8Removes every kaiju", "textures/ui/kj_icon_banish")
    .button("§bSettings\n§8Destruction, targets, abilities", "textures/ui/kj_icon_settings");

  form.__onResponse = (response) => {
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 0) {
      summonKaiju(player);
      return;
    }
    if (response.selection === 1) {
      const removed = killAll();
      sendMessage(player, `§b[Kaiju] §fBanished ${removed} kaiju.`);
      return;
    }
    openSettingsMenu(player);
  };

  showForm(player, form);
}

export function openSettingsMenu(player) {
  const form = new ModalFormData()
    .title("§lKaiju Settings")
    .toggle("It smashes blocks and buildings", getSetting("destroyBlocks"))
    .toggle("It hunts players", getSetting("huntPlayers"))
    .toggle("Atomic breath", getSetting("atomicBreath"))
    .toggle("Roar (screen shake + nausea)", getSetting("roar"))
    .slider("Maximum kaiju at once", 1, 5, 1, getSetting("maxKaiju"))
    .slider("Destruction scale (%)", 25, 200, 5, getSetting("destructionPercent"))
    .slider("Block edits per tick (lower = smoother)", 40, 300, 10, getSetting("maxBlockOpsPerTick"))
    .toggle("Reset everything to defaults", false);

  form.__onResponse = (response) => {
    if (response.canceled || !response.formValues) return;
    const [destroyBlocks, huntPlayers, atomicBreath, roar, maxKaiju, destructionPercent, blockOps, reset] =
      response.formValues;

    if (reset) {
      resetSettings();
      sendMessage(player, "§b[Kaiju] §fSettings reset to defaults.");
      return;
    }

    setSetting("destroyBlocks", !!destroyBlocks);
    setSetting("huntPlayers", !!huntPlayers);
    setSetting("atomicBreath", !!atomicBreath);
    setSetting("roar", !!roar);
    setSetting("maxKaiju", Math.max(1, Number(maxKaiju)));
    setSetting("destructionPercent", Math.max(25, Number(destructionPercent)));
    setSetting("maxBlockOpsPerTick", Math.max(40, Number(blockOps)));

    sendMessage(
      player,
      `§b[Kaiju] §fSaved. Destruction ${destroyBlocks ? "§aon" : "§coff"}§f at §e${Math.max(
        25,
        Number(destructionPercent)
      )}%§f, cap §e${Math.max(1, Number(maxKaiju))}§f.`
    );
  };

  showForm(player, form);
}
