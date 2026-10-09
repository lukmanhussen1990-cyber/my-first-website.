// Perfect Disguises - passive powers, weaknesses and active abilities.
import { system, world, BlockPermutation, EntityDamageCause, EquipmentSlot, ItemStack } from "@minecraft/server";
import {
  BEE_MAX_WINGS,
  applyDisguiseEffects,
  cancelFuse,
  equipment,
  flash,
  getSetting,
  getState,
  isWet,
  mainHandId,
  mobSound,
  particleAt,
  playAt,
  shortEffect,
  soundAt,
  tryRun,
} from "./core.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("./disguises.js").Disguise} Disguise */
/** @typedef {import("./core.js").PlayerState} PlayerState */

const UP = { x: 0, y: 1, z: 0 };
const DOWN = { x: 0, y: -1, z: 0 };
/** @type {Record<string, Vector3>} */
const FACE = {
  Up: { x: 0, y: 1, z: 0 },
  Down: { x: 0, y: -1, z: 0 },
  North: { x: 0, y: 0, z: -1 },
  South: { x: 0, y: 0, z: 1 },
  East: { x: 1, y: 0, z: 0 },
  West: { x: -1, y: 0, z: 0 },
};

const CARROTS = new Set([
  "minecraft:carrot",
  "minecraft:carrot_on_a_stick",
  "minecraft:golden_carrot",
  "minecraft:potato",
  "minecraft:beetroot",
]);
// "grass" is the grass block's id in 1.21.0; newer versions call it "grass_block".
const GRASS_BLOCKS = ["minecraft:grass_block", "minecraft:grass"];
const GRASS_PLANTS = ["minecraft:short_grass", "minecraft:tallgrass", "minecraft:fern"];
const BAD_EFFECTS = [
  "poison", "fatal_poison", "wither", "slowness", "mining_fatigue", "nausea", "blindness",
  "hunger", "levitation", "darkness", "bad_omen", "infested", "oozing", "weaving", "wind_charged",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * @param {Block | undefined} block
 * @param {string[]} names
 */
function blockMatches(block, names) {
  if (!block) return false;
  for (const name of names) {
    if (tryRun(() => block.permutation.matches(name)) === true) return true;
  }
  return false;
}

/** @param {Player} player */
function facingFromYaw(player) {
  const yaw = (player.getRotation().y * Math.PI) / 180;
  return { x: -Math.sin(yaw), y: 0, z: Math.cos(yaw) };
}

/** @param {number} fraction */
function bar(fraction, size = 10) {
  const n = Math.max(0, Math.min(size, Math.round(fraction * size)));
  return "§e" + "|".repeat(n) + "§8" + "|".repeat(size - n);
}

/** @param {Player} player */
export function inDirectSunlight(player) {
  const dim = player.dimension;
  if (!dim.id.endsWith("overworld")) return false;
  const time = world.getTimeOfDay();
  if (time > 12540 && time < 23460) return false; // night
  if (isWet(player)) return false; // rain or water put the fire out
  const head = player.getHeadLocation();
  const roof = tryRun(() =>
    dim.getBlockFromRay(head, UP, { includeLiquidBlocks: true, includePassableBlocks: false, maxDistance: 400 })
  );
  return !roof;
}

// ---------------------------------------------------------------------------
// Passive behaviour, called every tick for disguised players
// ---------------------------------------------------------------------------
/**
 * @param {Player} player
 * @param {Disguise} def
 * @param {PlayerState} state
 * @param {number} tick
 */
export function tickDisguise(player, def, state, tick) {
  if (state.spectator) return;
  const slot = (tick + state.phase) % 20;

  // Every tick: movement powers and timers
  if (def.climbs) spiderClimb(player);
  if (def.flies) beeFlight(player, state, tick);
  if (state.fuseEnd && tick >= state.fuseEnd) creeperExplode(player, def, state, tick);
  if (state.grazeEnd && tick >= state.grazeEnd) {
    state.grazeEnd = 0;
    tryRun(() => player.triggerEvent("pd:mark_0"));
  }

  // Every 10 ticks: weaknesses that need quick reactions
  if (slot % 10 === 0) {
    if (def.waterHurts && isWet(player) && !state.creative) {
      tryRun(() => player.applyDamage(1, { cause: EntityDamageCause.drowning }));
      flash(player, "§bWater burns you! §fGet out of the water/rain.", 20);
    }
    if (def.fearsCats) creeperFear(player, state);
    if (def.lovesCarrots && CARROTS.has(mainHandId(player))) shortEffect(player, "speed", 1, 30);
  }

  // Every second: sunlight, effects, ambient sounds
  if (slot === 0) {
    if (def.burnsInSun && !state.creative && inDirectSunlight(player) && !equipment(player, EquipmentSlot.Head)) {
      tryRun(() => player.setOnFire(5, true));
      flash(player, "§6You are burning in the sun! §fFind shade or water, or wear a helmet.", 30);
    }
    if (def.weakInSun && inDirectSunlight(player)) shortEffect(player, "weakness", 0, 40);
    if ((tick + state.phase) % 40 === 0) applyDisguiseEffects(player, def);
    if (Math.random() < 0.08) mobSound(player, def, "ambient", 0.8);
  }

  // Twice a second: status line above the hotbar (ability recharge, bee wings)
  if ((def.ability || def.flies) && slot % 10 === 5 && tick >= state.messageUntil && getSetting(player, "hud")) {
    tryRun(() => player.onScreenDisplay.setActionBar(statusLine(def, state, tick)));
  }
}

/**
 * @param {Disguise} def
 * @param {PlayerState} state
 * @param {number} tick
 */
function statusLine(def, state, tick) {
  if (state.fuseEnd) return "§c§lSSSSSSSS...";
  let line = def.color + "§l" + def.name + "§r";
  if (def.ability) {
    const left = state.cooldownUntil - tick;
    line += left > 0
      ? " §7| " + def.ability.name + ": §c" + Math.ceil(left / 20) + "s"
      : " §7| " + def.ability.name + ": §aready §7(crouch + wand)";
  }
  if (def.flies) line += " §7| Wings " + bar(state.wings / BEE_MAX_WINGS);
  return line;
}

/**
 * Spider: walk into a wall to climb, crouch or look down to hold on.
 * @param {Player} player
 */
function spiderClimb(player) {
  if (tryRun(() => player.isFlying || player.isGliding || player.isSleeping)) return;
  const dir = facingFromYaw(player);
  const loc = player.location;
  const dim = player.dimension;
  const opts = { maxDistance: 0.55, includeLiquidBlocks: false, includePassableBlocks: false };
  let touching = false;
  for (const h of [0.2, 1.0, 1.6]) {
    if (tryRun(() => dim.getBlockFromRay({ x: loc.x, y: loc.y + h, z: loc.z }, dir, opts))) {
      touching = true;
      break;
    }
  }
  if (!touching) return;
  if (player.isSneaking || player.getRotation().x > 55) {
    shortEffect(player, "slow_falling", 0, 6); // cling and slide down slowly
  } else {
    shortEffect(player, "levitation", 1, 4); // climb up
  }
}

/**
 * Bee: hold jump in the air to fly while the wings have energy.
 * @param {Player} player
 * @param {PlayerState} state
 * @param {number} tick
 */
function beeFlight(player, state, tick) {
  if (tryRun(() => player.isFlying)) return;
  if (tryRun(() => player.isOnGround)) {
    state.wings = Math.min(BEE_MAX_WINGS, state.wings + 2);
    return;
  }
  if (!tryRun(() => player.isJumping) || state.wings <= 0) return;
  if (isWet(player)) {
    if (tick % 20 === 0) flash(player, "§bYour wings are wet - you cannot fly!", 20);
    return;
  }
  shortEffect(player, "levitation", 2, 3);
  state.wings -= 1;
  if (tick % 16 === 0) playAt(player, "mob.bee.loop", 0.5, 1.2);
  if (state.wings === 0) flash(player, "§eYour wings are tired! §fLand to rest them.", 30);
}

/**
 * Creeper: cats and ocelots are terrifying.
 * @param {Player} player
 * @param {PlayerState} state
 */
function creeperFear(player, state) {
  const dim = player.dimension;
  /** @param {string} type */
  const near = (type) =>
    tryRun(() => dim.getEntities({ location: player.location, maxDistance: 7, type }).length) || 0;
  if (near("minecraft:cat") + near("minecraft:ocelot") === 0) return;
  shortEffect(player, "slowness", 1, 30);
  shortEffect(player, "weakness", 0, 30);
  if (state.fuseEnd) {
    cancelFuse(player, state);
    flash(player, "§eToo scared to explode!", 30);
  } else {
    flash(player, "§eA cat! §fCreepers are terrified of cats!", 30);
  }
}

/**
 * @param {Player} player
 * @param {Disguise} def
 * @param {PlayerState} state
 * @param {number} tick
 */
function creeperExplode(player, def, state, tick) {
  state.fuseEnd = 0;
  tryRun(() => player.triggerEvent("pd:mark_0"));
  const charged = tryRun(() => player.hasComponent("minecraft:is_charged")) === true;
  const loc = player.location;
  tryRun(() =>
    player.dimension.createExplosion({ x: loc.x, y: loc.y + 0.5, z: loc.z }, charged ? 6 : 3, {
      breaksBlocks: getSetting(player, "griefing"),
      causesFire: false,
      source: player,
    })
  );
  if (charged) tryRun(() => player.triggerEvent("pd:charge_off"));
  state.cooldownUntil = tick + (def.ability ? def.ability.cooldown : 200);
}

// ---------------------------------------------------------------------------
// Active abilities (crouch + Disguise Wand, or the menu button)
// Each returns true when the ability was used (starts the recharge).
// ---------------------------------------------------------------------------
/** @type {Record<string, (player: Player, def: Disguise, state: PlayerState) => boolean>} */
const ABILITIES = {
  explode(player, def, state) {
    if (state.fuseEnd) {
      cancelFuse(player, state);
      playAt(player, "random.fizz", 0.7, 1.4);
      flash(player, "§aFuse cancelled.", 30);
      return false;
    }
    state.fuseEnd = system.currentTick + 30;
    tryRun(() => player.triggerEvent("pd:mark_1"));
    playAt(player, "random.fuse", 1, 0.5);
    flash(player, "§cSsssss... §7(use the wand again to cancel)", 30);
    return false; // the recharge starts when it blows up
  },

  teleport(player) {
    const dim = player.dimension;
    const head = player.getHeadLocation();
    const view = player.getViewDirection();
    const hit = tryRun(() =>
      dim.getBlockFromRay(head, view, { maxDistance: 16, includeLiquidBlocks: true, includePassableBlocks: false })
    );
    const reach = hit ? Math.max(1, Math.hypot(hit.block.x + 0.5 - head.x, hit.block.z + 0.5 - head.z)) : 16;
    for (const distance of [reach, reach * 0.75, reach * 0.5, reach * 0.25]) {
      if (distance < 1) break;
      let column;
      if (hit && distance === reach) {
        const n = FACE[hit.face] || UP;
        column = { x: hit.block.x + n.x + 0.5, y: hit.block.y + n.y + 0.5, z: hit.block.z + n.z + 0.5 };
      } else {
        column = { x: head.x + view.x * distance, y: head.y + view.y * distance, z: head.z + view.z * distance };
      }
      const spot = findLanding(dim, column);
      if (!spot) continue;
      const from = player.location;
      if (tryRun(() => player.tryTeleport(spot, { checkForBlocks: true, keepVelocity: false })) === true) {
        tryRun(() => dim.spawnParticle("pd:ender_burst", { x: from.x, y: from.y + 1, z: from.z }));
        soundAt(dim, "mob.endermen.portal", from);
        particleAt(player, "pd:ender_burst", 1);
        playAt(player, "mob.endermen.portal");
        return true;
      }
    }
    playAt(player, "note.bass", 0.6, 0.6);
    flash(player, "§7No safe place to teleport there.", 30);
    return false;
  },

  web(player) {
    const hit = tryRun(() =>
      player.getBlockFromViewDirection({ maxDistance: 12, includeLiquidBlocks: false, includePassableBlocks: false })
    );
    const target = hit && tryRun(() => hit.block.offset(FACE[hit.face] || UP));
    if (!target || !target.isAir) {
      flash(player, "§7Look at a nearby block to shoot a web.", 30);
      return false;
    }
    tryRun(() => target.setPermutation(BlockPermutation.resolve("minecraft:web")));
    playAt(player, "mob.spider.say", 0.8, 1.3);
    return true;
  },

  milk(player) {
    let removed = 0;
    for (const id of BAD_EFFECTS) {
      if (tryRun(() => player.getEffect(id))) {
        if (tryRun(() => player.removeEffect(id))) removed++;
      }
    }
    if (removed === 0) {
      flash(player, "§7You feel fine already - nothing to cleanse.", 30);
      return false;
    }
    playAt(player, "random.drink", 1, 1);
    particleAt(player, "pd:heal_sparkle", 1);
    flash(player, "§aMilk Cleanse: §fbad effects removed!", 40);
    return true;
  },

  graze(player, def, state) {
    const dim = player.dimension;
    const l = player.location;
    const x = Math.floor(l.x);
    const z = Math.floor(l.z);
    const feet = tryRun(() => dim.getBlock({ x, y: Math.floor(l.y), z }));
    const below = tryRun(() => dim.getBlock({ x, y: Math.floor(l.y - 0.2), z }));
    let ate = false;
    if (blockMatches(feet, GRASS_PLANTS)) {
      ate = tryRun(() => {
        feet.setPermutation(BlockPermutation.resolve("minecraft:air"));
        return true;
      }) === true;
    } else if (blockMatches(below, GRASS_BLOCKS)) {
      ate = tryRun(() => {
        below.setPermutation(BlockPermutation.resolve("minecraft:dirt"));
        return true;
      }) === true;
    }
    if (!ate) {
      flash(player, "§7Stand on a grass block (or in short grass) to graze.", 30);
      return false;
    }
    tryRun(() => {
      const hp = /** @type {import("@minecraft/server").EntityHealthComponent} */ (player.getComponent("minecraft:health"));
      hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + 4));
    });
    shortEffect(player, "saturation", 1, 2);
    tryRun(() => player.triggerEvent("pd:mark_2"));
    state.grazeEnd = system.currentTick + 40;
    playAt(player, "dig.grass", 1, 1);
    mobSound(player, def, "ambient", 0.8);
    particleAt(player, "pd:heal_sparkle", 1);
    return true;
  },

  egg(player) {
    const l = player.location;
    tryRun(() => player.dimension.spawnItem(new ItemStack("minecraft:egg", 1), { x: l.x, y: l.y + 0.3, z: l.z }));
    playAt(player, "mob.chicken.plop", 1, 1);
    return true;
  },

  howl(player) {
    const dim = player.dimension;
    const loc = player.location;
    const friends = tryRun(() => dim.getPlayers({ location: loc, maxDistance: 12 })) || [];
    for (const p of friends) {
      shortEffect(p, "strength", 0, 300);
      shortEffect(p, "speed", 0, 300);
    }
    const skeletons = tryRun(() => dim.getEntities({ location: loc, maxDistance: 16, families: ["skeleton"] })) || [];
    let scared = 0;
    for (const s of skeletons) {
      if (s.typeId === "minecraft:player") continue;
      tryRun(() => s.addEffect("weakness", 160, { amplifier: 1 }));
      tryRun(() => s.addEffect("slowness", 160, { amplifier: 1 }));
      scared++;
    }
    playAt(player, "mob.wolf.growl", 1.5, 0.6);
    playAt(player, "mob.wolf.bark", 1.5, 0.8);
    flash(player, `§fAWOOO! §7Pack boosted: ${friends.length}, skeletons scared: ${scared}`, 40);
    return true;
  },
};

/**
 * Finds a spot where a player fits (2 free blocks) on solid ground near `p`.
 * @param {Dimension} dim
 * @param {Vector3} p
 * @returns {Vector3 | undefined}
 */
function findLanding(dim, p) {
  const start = { x: p.x, y: p.y + 1.5, z: p.z };
  const ground = tryRun(() =>
    dim.getBlockFromRay(start, DOWN, { maxDistance: 12, includeLiquidBlocks: true, includePassableBlocks: false })
  );
  if (!ground || ground.face !== "Up") return undefined;
  if (tryRun(() => ground.block.isLiquid)) return undefined; // endermen hate water
  // faceLocation is relative to the block corner (guard against absolute values).
  const fy = ground.faceLocation.y;
  const top = fy > 1.01 || fy < -0.01 ? fy : ground.block.y + fy;
  const spot = {
    x: Math.floor(p.x) + 0.5,
    y: top + 0.01,
    z: Math.floor(p.z) + 0.5,
  };
  const headroom = tryRun(() =>
    dim.getBlockFromRay({ x: spot.x, y: spot.y + 0.05, z: spot.z }, UP, {
      maxDistance: 1.85,
      includeLiquidBlocks: true,
      includePassableBlocks: false,
    })
  );
  return headroom ? undefined : spot;
}

/**
 * @param {Player} player
 * @param {Disguise | undefined} def
 */
export function useAbility(player, def) {
  const state = getState(player);
  if (!def || !def.ability) {
    flash(player, "§7This disguise has no special ability - open the menu to see its powers.", 40);
    return;
  }
  if (state.spectator) return;
  const now = system.currentTick;
  if (now < state.cooldownUntil) {
    playAt(player, "note.bass", 0.5, 0.8);
    flash(player, `§c${def.ability.name} is recharging: ${Math.ceil((state.cooldownUntil - now) / 20)}s`, 30);
    return;
  }
  const fn = ABILITIES[def.ability.id];
  if (!fn) return;
  if (fn(player, def, state) === true) state.cooldownUntil = now + def.ability.cooldown;
}

/**
 * A creeper struck by lightning becomes a charged creeper.
 * @param {Player} player
 * @param {Disguise} def
 */
export function onLightning(player, def) {
  if (def.key !== "creeper") return;
  if (tryRun(() => player.hasComponent("minecraft:is_charged")) === true) return;
  tryRun(() => player.triggerEvent("pd:charge_on"));
  flash(player, "§b§lCHARGED! §r§fYour next explosion is twice as big.", 60);
}
