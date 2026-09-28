import { registerAbility } from "../core/cast.js";
import { flash } from "../core/state.js";
import { addTask } from "../core/tasks.js";
import { effect } from "../core/combat.js";
import { bodyCenter } from "../core/targets.js";
import { particle, sound, pose } from "../lib/fx.js";
import { alive } from "../lib/util.js";

const DURATION = 40; // 2 seconds
const HEAL_EVERY = 4;
const HEAL_AMOUNT = 2; // one heart every 0.2 s -> 10 hearts total

/** Harmful effects removed by the reversed cursed energy. */
const CLEANSE = [
  "poison",
  "fatal_poison",
  "wither",
  "slowness",
  "weakness",
  "mining_fatigue",
  "nausea",
  "blindness",
  "darkness",
  "hunger",
  "levitation",
  "infested",
  "oozing",
  "weaving",
  "wind_charged",
];

registerAbility("reverse_cursed_technique", (player, st) => {
  const dim = player.dimension;
  const c = bodyCenter(player);
  let cleansed = 0;
  for (const id of CLEANSE) {
    try {
      if (player.getEffect(id) && player.removeEffect(id)) cleansed++;
    } catch {
      // ignore
    }
  }
  try {
    player.extinguishFire(false);
  } catch {
    // ignore
  }
  effect(player, "regeneration", DURATION + 20, 1);
  pose(player, "animation.gojo.rct");
  particle(dim, "gojo:rct_burst", c);
  sound(dim, "gojo.rct.start", c, { radius: 24 });
  flash(st, cleansed > 0 ? `§aReverse Cursed Technique §7» cleansed ${cleansed}` : "§aReverse Cursed Technique", 40);
  addTask(rctTask(player, st));
  return true;
});

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("../core/state.js").PlayerState} st
 * @returns {import("../core/tasks.js").Task}
 */
function rctTask(player, st) {
  let age = 0;
  let healed = 0;
  return {
    name: "rct",
    ownerId: player.id,
    update() {
      age++;
      if (age > DURATION || !alive(player)) return false;
      const dim = player.dimension;
      const c = bodyCenter(player);
      if (age % 3 === 0) particle(dim, "gojo:rct_aura", player.location);
      if (age % HEAL_EVERY === 0) {
        try {
          const hp = /** @type {import("@minecraft/server").EntityHealthComponent | undefined} */ (
            player.getComponent("minecraft:health")
          );
          if (hp && hp.currentValue > 0 && hp.currentValue < hp.effectiveMax) {
            const next = Math.min(hp.effectiveMax, hp.currentValue + HEAL_AMOUNT);
            healed += next - hp.currentValue;
            hp.setCurrentValue(next);
            particle(dim, "gojo:rct_heal", c);
          }
        } catch {
          // ignore
        }
      }
      if (age % 10 === 0) sound(dim, "gojo.rct.pulse", c, { radius: 16, volume: 0.6 });
      return true;
    },
    end() {
      if (!alive(player)) return;
      const c = bodyCenter(player);
      particle(player.dimension, "gojo:rct_burst", c);
      sound(player.dimension, "gojo.rct.end", c, { radius: 20 });
      if (healed > 0) flash(st, `\u00a7aRegenerated \u00a7f${(healed / 2).toFixed(1)} \u00a7ahearts`, 40);
    },
  };
}
