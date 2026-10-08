// Per-player settings and the sneak + use settings menu.
import { system } from "@minecraft/server";
import { ModalFormData, FormCancelationReason } from "@minecraft/server-ui";
import { PLAYER_SETTINGS_KEY, DEFAULT_SETTINGS, LIFETIME_OPTIONS, MIN_SIZE, MAX_SIZE } from "./config.js";
import { configFromSettings, findHoleOf } from "./blackhole.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {typeof DEFAULT_SETTINGS} Settings */

/** @param {Player} player @returns {Settings} */
export function getSettings(player) {
  const settings = { ...DEFAULT_SETTINGS };
  try {
    const raw = player.getDynamicProperty(PLAYER_SETTINGS_KEY);
    if (typeof raw === "string") {
      const saved = JSON.parse(raw);
      if (typeof saved.devourBlocks === "boolean") settings.devourBlocks = saved.devourBlocks;
      if (typeof saved.pullPlayers === "boolean") settings.pullPlayers = saved.pullPlayers;
      if (typeof saved.protectPets === "boolean") settings.protectPets = saved.protectPets;
      if (typeof saved.maxSize === "number") settings.maxSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(saved.maxSize)));
      if (typeof saved.lifetime === "number" && LIFETIME_OPTIONS[saved.lifetime]) settings.lifetime = saved.lifetime;
    }
  } catch {
    // corrupted settings: fall back to defaults
  }
  return settings;
}

/** @param {Player} player @param {Settings} settings */
function saveSettings(player, settings) {
  player.setDynamicProperty(PLAYER_SETTINGS_KEY, JSON.stringify(settings));
}

/** @param {Player} player @param {number} [attempt] */
export function openSettings(player, attempt = 0) {
  if (!player.isValid()) return;
  const current = getSettings(player);
  const form = new ModalFormData()
    .title("§l§5Magical Black Hole")
    .toggle("§dDevour blocks§r\n§7Eats the ground around it (blocks come back as items)", current.devourBlocks)
    .slider("§dMaximum size", MIN_SIZE, MAX_SIZE, 1, current.maxSize)
    .dropdown(
      "§dLifetime",
      LIFETIME_OPTIONS.map((option) => option.label),
      current.lifetime
    )
    .toggle("§dPull other players", current.pullPlayers)
    .toggle("§dProtect pets and named mobs", current.protectPets);

  form
    .show(player)
    .then((response) => {
      if (response.canceled) {
        // The menu can't open while the player is still "using" the item - try again shortly
        if (response.cancelationReason === FormCancelationReason.UserBusy && attempt < 20) {
          system.runTimeout(() => openSettings(player, attempt + 1), 5);
        }
        return;
      }
      const values = response.formValues ?? [];
      /** @type {Settings} */
      const updated = {
        devourBlocks: Boolean(values[0]),
        maxSize: Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(Number(values[1]) || current.maxSize))),
        lifetime: LIFETIME_OPTIONS[Number(values[2])] ? Number(values[2]) : current.lifetime,
        pullPlayers: Boolean(values[3]),
        protectPets: Boolean(values[4]),
      };
      saveSettings(player, updated);

      const hole = findHoleOf(player);
      if (hole && !hole.collapse) {
        hole.config = configFromSettings(updated);
        hole.dirty = true;
      }
      player.sendMessage(
        `§5[Black Hole]§r §aSettings saved.§r §7Devour blocks: §f${updated.devourBlocks ? "ON" : "OFF"}§7, max size: §f${updated.maxSize}§7, lifetime: §f${LIFETIME_OPTIONS[updated.lifetime].label}`
      );
      player.playSound("random.click", { volume: 0.6, pitch: 1.2 });
    })
    .catch((error) => console.warn(`[Black Hole] Settings menu failed: ${error}`));
}
