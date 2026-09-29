// @ts-check
// Launching a weapon at a target: cooldowns, protection and the effect itself.
import { system } from "@minecraft/server";
import { EFFECTS } from "./effects.js";
import { startEffect } from "./scheduler.js";
import { notify, protect, tell } from "./util.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").ItemStack} ItemStack */
/** @typedef {import("@minecraft/server").ItemCooldownComponent} ItemCooldownComponent */
/** @typedef {import("./config.js").Weapon} Weapon */
/** @typedef {import("./settings.js").Settings} Settings */
/** @typedef {import("./targeting.js").Target} Target */

/** player id + weapon id -> tick when it can fire again */
const readyAt = new Map();

/** @param {Player} player @param {Weapon} w @param {boolean} [say] */
export function isReady(player, w, say = true) {
  const at = readyAt.get(player.id + w.id) ?? 0;
  const now = system.currentTick;
  if (at <= now) return true;
  if (say) notify(player, `§c${w.name} is recharging... §f${((at - now) / 20).toFixed(1)}s`, 30);
  return false;
}

/**
 * Fires `w` at `target`. Returns true when the strike started.
 * @param {Player} player @param {Weapon} w @param {Target} target @param {number} power
 * @param {Settings} s @param {ItemStack} [item] the weapon item, to show its cooldown
 */
export function launchStrike(player, w, target, power, s, item) {
  const fx = EFFECTS[w.key];
  if (!fx) return false;
  const ctx = {
    dim: target.dim,
    pos: target.pos,
    core: target.core,
    power,
    breakBlocks: s.breakBlocks,
    fire: s.fire,
    protect: s.protect,
    ownerId: player.id,
  };
  if (!startEffect(fx.run(ctx), w.key)) {
    tell(player, "§cToo much destruction at once! §7Wait a few seconds or use §fSTOP ALL§7 on the tablet.");
    return false;
  }
  readyAt.set(player.id + w.id, system.currentTick + w.cooldown);
  if (item) {
    try {
      /** @type {ItemCooldownComponent | undefined} */ (item.getComponent("minecraft:cooldown"))?.startCooldown(player);
    } catch {
      // cosmetic only
    }
  }
  if (s.protect) protect(player, fx.protectTicks(power));
  notify(player, `${w.color}§l${w.name}§r §7-> §f${target.label} §7(power ${power})`);
  return true;
}
