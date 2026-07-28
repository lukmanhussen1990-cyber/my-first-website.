/**
 * Natural Disasters - the Disaster Wand menu.
 *
 * Built with @minecraft/server-ui so it works with touch controls: every option
 * is a big button, no chat commands needed.
 */

import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { SETTINGS_DEFAULTS, getSetting, resetSettings, setSetting } from "./config.js";
import {
  getActiveDisasters,
  getDefinition,
  getDisasterKeys,
  startDisaster,
  stopAllDisasters
} from "./registry.js";
import { scheduleNext, triggerSoon } from "./scheduler.js";
import { SOUNDS } from "./sounds.js";
import {
  formatTicks,
  pickRandom,
  playSoundForPlayer,
  surfaceY
} from "./util.js";

/** How far in front of the player a hand cast disaster appears. */
const CAST_DISTANCE = 18;

/**
 * Shows a form, retrying while the player still has another screen open.
 * Bedrock refuses to open a form while the inventory or chat is up.
 */
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
      console.warn(`[NaturalDisasters] form error: ${error}`);
    });
}

/** Entry point: called when a player uses the Disaster Wand. */
export function openWandMenu(player) {
  playSoundForPlayer(player, SOUNDS.wandOpen.custom, SOUNDS.wandOpen.vanilla, { volume: 0.8, pitch: 1.2 });

  const keys = getDisasterKeys();
  const active = getActiveDisasters();

  const form = new ActionFormData()
    .title("§lNatural Disasters")
    .body(
      active.length > 0
        ? `§7Running now: §f${active.map((entry) => entry.label).join(", ")}\n§7Tap a disaster to start it in front of you.`
        : "§7Tap a disaster to start it about 18 blocks in front of you."
    );

  for (const key of keys) {
    const definition = getDefinition(key);
    form.button(`${definition.color}${definition.name}\n§8${definition.description}`, definition.icon);
  }
  form.button("§dSurprise Me\n§8Random disaster", "textures/ui/nd_icon_random");
  form.button("§cStop All Disasters\n§8Clean everything up", "textures/ui/nd_icon_stop");
  form.button("§bSettings\n§8Random events, damage, warnings", "textures/ui/nd_icon_settings");

  form.__onResponse = (response) => {
    if (response.canceled || response.selection === undefined) return;
    const index = response.selection;

    if (index < keys.length) {
      castDisaster(player, keys[index]);
      return;
    }
    if (index === keys.length) {
      castDisaster(player, pickRandom(keys));
      return;
    }
    if (index === keys.length + 1) {
      const stopped = stopAllDisasters(false);
      player.sendMessage(
        stopped > 0
          ? `§b[Natural Disasters] §fStopped ${stopped} disaster${stopped === 1 ? "" : "s"}.`
          : "§b[Natural Disasters] §fNothing is running right now."
      );
      return;
    }
    openSettingsMenu(player);
  };

  showForm(player, form);
}

/** Starts a disaster in front of the player. */
export function castDisaster(player, key) {
  const definition = getDefinition(key);
  if (!definition) return;

  let origin;
  let dimension;
  let view = { x: 0, y: 0, z: 1 };
  try {
    origin = player.location;
    dimension = player.dimension;
    view = player.getViewDirection();
  } catch {
    return;
  }

  const flat = Math.hypot(view.x, view.z) || 1;
  const target = {
    x: origin.x + (view.x / flat) * CAST_DISTANCE,
    y: origin.y,
    z: origin.z + (view.z / flat) * CAST_DISTANCE
  };
  const ground = surfaceY(dimension, Math.floor(target.x), Math.floor(target.z), origin.y + 24);
  if (ground !== undefined) target.y = ground;

  const heading = Math.atan2(view.z, view.x);
  const result = startDisaster(key, dimension, target, { heading });

  if (result.ok) {
    playSoundForPlayer(player, SOUNDS.wandCast.custom, SOUNDS.wandCast.vanilla, { volume: 1, pitch: 0.9 });
    player.sendMessage(`§b[Natural Disasters] §f${definition.color}${definition.name} §fincoming!`);
  } else {
    player.sendMessage(`§c[Natural Disasters] ${result.reason}`);
  }
}

/** Settings screen. Everything here is saved into the world. */
export function openSettingsMenu(player) {
  const form = new ModalFormData()
    .title("§lDisaster Settings")
    .toggle("Random disasters while playing", getSetting("randomDisasters"))
    .slider("Shortest gap (minutes)", 1, 60, 1, getSetting("minMinutes"))
    .slider("Longest gap (minutes)", 1, 120, 1, getSetting("maxMinutes"))
    .toggle("Disasters may break blocks", getSetting("blockDamage"))
    .toggle("Disasters may hurt players", getSetting("playerDamage"))
    .slider("Public warning (seconds)", 0, 60, 1, getSetting("publicWarnSeconds"))
    .slider("Detector warning (seconds)", 5, 180, 5, getSetting("detectorWarnSeconds"))
    .toggle("Reset everything to defaults", false);

  form.__onResponse = (response) => {
    if (response.canceled || !response.formValues) return;
    const [
      randomDisasters,
      minMinutes,
      maxMinutes,
      blockDamage,
      playerDamage,
      publicWarnSeconds,
      detectorWarnSeconds,
      reset
    ] = response.formValues;

    if (reset) {
      resetSettings();
      scheduleNext();
      player.sendMessage("§b[Natural Disasters] §fSettings reset to defaults.");
      return;
    }

    setSetting("randomDisasters", !!randomDisasters);
    setSetting("minMinutes", Math.max(1, Number(minMinutes)));
    setSetting("maxMinutes", Math.max(Number(minMinutes), Number(maxMinutes)));
    setSetting("blockDamage", !!blockDamage);
    setSetting("playerDamage", !!playerDamage);
    setSetting("publicWarnSeconds", Number(publicWarnSeconds));
    setSetting("detectorWarnSeconds", Number(detectorWarnSeconds));
    scheduleNext();

    player.sendMessage(
      `§b[Natural Disasters] §fSaved. Random disasters: ${randomDisasters ? "§aon" : "§coff"}§f.`
    );
  };

  showForm(player, form);
}

/**
 * Detector screen: what is happening right now, plus a button to summon the next
 * random event early. ActionFormData is used instead of MessageFormData because
 * its button indexes are unambiguous.
 */
export function openInfoScreen(player, activeSummary) {
  const form = new ActionFormData()
    .title("§lDisaster Detector")
    .body(activeSummary)
    .button("§aClose", "textures/ui/nd_icon_settings")
    .button("§eTrigger one now\n§8In about 15 seconds", "textures/ui/nd_icon_random");

  form.__onResponse = (response) => {
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 1) {
      triggerSoon(15);
      player.sendMessage("§b[Natural Disasters] §fSomething is coming in about 15 seconds...");
    }
  };

  showForm(player, form);
}

/** Human readable summary of what is happening, shared by menu and chat. */
export function statusText() {
  const active = getActiveDisasters();
  if (active.length === 0) return "§7No disasters are running.";
  return active
    .map((entry) => {
      const definition = getDefinition(entry.key);
      return `${definition.color}${definition.name} §7(running ${formatTicks(entry.age)})`;
    })
    .join("\n");
}

export { SETTINGS_DEFAULTS };
