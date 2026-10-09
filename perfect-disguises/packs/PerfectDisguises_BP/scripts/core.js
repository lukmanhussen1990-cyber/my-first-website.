// Perfect Disguises - shared state and the disguise on/off logic.
import { system, world, EquipmentSlot, GameMode, ItemStack } from "@minecraft/server";
import { BY_ID } from "./disguises.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("./disguises.js").Disguise} Disguise */

export const WAND_ID = "pd:disguise_wand";
export const TAG_DISGUISED = "pd_disguised";

// Effects we keep on a disguised player are refreshed to this length and are
// only removed again if they still look like ours (short enough, same level).
const EFFECT_TICKS = 600;
const EFFECT_REFRESH_BELOW = 400;

// Short effects the abilities give (climbing, flying, scared, carrot speed).
/** @type {[string, number][]} */
const TEMP_EFFECTS = [
  ["levitation", 20],
  ["slow_falling", 20],
  ["slowness", 45],
  ["weakness", 45],
  ["speed", 45],
];

export const BEE_MAX_WINGS = 60;

// ---------------------------------------------------------------------------
// Per-player runtime state (rebuilt from the saved entity data when needed)
// ---------------------------------------------------------------------------
/**
 * @typedef {object} PlayerState
 * @property {number} disguiseId  current disguise (0 = none)
 * @property {boolean} synced     state was matched with the saved entity data
 * @property {number} phase       spreads periodic work over different ticks
 * @property {number} cooldownUntil
 * @property {number} fuseEnd     creeper fuse end tick (0 = no fuse)
 * @property {number} wings       bee flight energy
 * @property {number} lastWandUse
 * @property {number} messageUntil
 * @property {number} verifyAt    tick to check that the disguise really applied
 * @property {number} verifyFrom  saved variant before the change (to spot add-on conflicts)
 * @property {boolean} warnedConflict
 * @property {boolean} creative
 * @property {boolean} spectator
 * @property {number} grazeEnd
 * @property {boolean} died
 */

/** @type {Map<string, PlayerState>} */
const states = new Map();

/** @param {Entity} player */
export function readVariant(player) {
  try {
    const comp = /** @type {import("@minecraft/server").EntityVariantComponent | undefined} */ (
      player.getComponent("minecraft:variant")
    );
    return comp ? comp.value : 0;
  } catch {
    return 0;
  }
}

/**
 * @param {Player} player
 * @returns {PlayerState}
 */
export function getState(player) {
  let s = states.get(player.id);
  if (!s) {
    s = {
      disguiseId: readVariant(player),
      synced: false,
      phase: Math.floor(Math.random() * 20),
      cooldownUntil: 0,
      fuseEnd: 0,
      wings: BEE_MAX_WINGS,
      lastWandUse: -100,
      messageUntil: 0,
      verifyAt: 0,
      verifyFrom: 0,
      warnedConflict: false,
      creative: false,
      spectator: false,
      grazeEnd: 0,
      died: false,
    };
    states.set(player.id, s);
  }
  return s;
}

/** @param {string} entityId */
export function peekState(entityId) {
  return states.get(entityId);
}

/** @param {string} entityId */
export function dropState(entityId) {
  states.delete(entityId);
}

/**
 * @param {Player} player
 * @returns {Disguise | undefined}
 */
export function currentDisguise(player) {
  return BY_ID.get(getState(player).disguiseId);
}

// ---------------------------------------------------------------------------
// Settings (saved on the player with dynamic properties)
// ---------------------------------------------------------------------------
export const SETTINGS = {
  hideName: { key: "pd:hide_name", def: true, label: "Hide my name tag while disguised" },
  sounds: { key: "pd:mob_sounds", def: true, label: "Make mob sounds while disguised" },
  hud: { key: "pd:hud", def: true, label: "Show ability timer and bee wings above the hotbar" },
  griefing: { key: "pd:creeper_griefing", def: false, label: "Creeper explosions break blocks" },
};

/**
 * @param {Player} player
 * @param {keyof typeof SETTINGS} name
 * @returns {boolean}
 */
export function getSetting(player, name) {
  const s = SETTINGS[name];
  try {
    const v = player.getDynamicProperty(s.key);
    return typeof v === "boolean" ? v : s.def;
  } catch {
    return s.def;
  }
}

/**
 * @param {Player} player
 * @param {keyof typeof SETTINGS} name
 * @param {boolean} value
 */
export function setSetting(player, name, value) {
  try {
    player.setDynamicProperty(SETTINGS[name].key, value);
  } catch {
    // ignore - settings are a convenience only
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
/**
 * Runs `fn`, returning undefined instead of throwing (entities can become
 * invalid at any time, e.g. when a player leaves).
 * @template T
 * @param {() => T} fn
 * @returns {T | undefined}
 */
export function tryRun(fn) {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

/**
 * @param {Player} player
 * @param {string} text
 */
export function say(player, text) {
  tryRun(() => player.sendMessage("§d[Disguises]§r " + text));
}

/**
 * Shows a message above the hotbar for a moment (the status line waits).
 * @param {Player} player
 * @param {string} text
 */
export function flash(player, text, ticks = 40) {
  const s = getState(player);
  s.messageUntil = system.currentTick + ticks;
  tryRun(() => player.onScreenDisplay.setActionBar(text));
}

/**
 * Plays a sound at a position for every player close enough to hear it.
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {string} sound
 * @param {Vector3} location
 */
export function soundAt(dimension, sound, location, volume = 1, pitch = 1) {
  const listeners = tryRun(() => dimension.getPlayers({ location, maxDistance: 16 * Math.max(1, volume) })) ?? [];
  for (const listener of listeners) {
    tryRun(() => listener.playSound(sound, { location, volume, pitch }));
  }
}

/**
 * @param {Player} player
 * @param {string} sound
 */
export function playAt(player, sound, volume = 1, pitch = 1) {
  soundAt(player.dimension, sound, player.location, volume, pitch);
}

/**
 * @param {Player} player
 * @param {string} effect
 */
export function particleAt(player, effect, yOffset = 1) {
  const l = player.location;
  tryRun(() => player.dimension.spawnParticle(effect, { x: l.x, y: l.y + yOffset, z: l.z }));
}

/**
 * @param {Player} player
 * @param {Disguise | undefined} def
 * @param {"ambient" | "hurt" | "death"} kind
 */
export function mobSound(player, def, kind, volume = 1) {
  const id = def && def.sounds && def.sounds[kind];
  if (!id || !getSetting(player, "sounds")) return;
  playAt(player, id, volume, 0.9 + Math.random() * 0.2);
}

/** @param {Player} player */
export function isWet(player) {
  if (tryRun(() => player.isInWater)) return true;
  // Set by the behavior pack's water/rain sensor (minecraft:skin_id 1 = wet).
  return (
    tryRun(() => {
      const skin = /** @type {import("@minecraft/server").EntitySkinIdComponent | undefined} */ (
        player.getComponent("minecraft:skin_id")
      );
      return skin?.value === 1;
    }) === true
  );
}

/**
 * @param {Player} player
 * @param {EquipmentSlot} slot
 */
export function equipment(player, slot) {
  return tryRun(() => {
    const eq = /** @type {import("@minecraft/server").EntityEquippableComponent | undefined} */ (
      player.getComponent("minecraft:equippable")
    );
    return eq?.getEquipment(slot);
  });
}

/** @param {Player} player */
export function mainHandId(player) {
  return equipment(player, EquipmentSlot.Mainhand)?.typeId;
}

/**
 * @param {Player} player
 * @param {PlayerState} state
 */
export function refreshGameMode(player, state) {
  state.creative = tryRun(() => player.matches({ gameMode: GameMode.creative })) === true;
  state.spectator = tryRun(() => player.matches({ gameMode: GameMode.spectator })) === true;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
/**
 * Keeps a long, hidden effect on the player (refreshed before it runs out so
 * night vision never flickers).
 * @param {Player} player
 * @param {string} id
 * @param {number} amplifier
 */
export function keepEffect(player, id, amplifier) {
  tryRun(() => {
    const cur = player.getEffect(id);
    if (cur && cur.amplifier > amplifier) return; // a stronger potion is active
    if (cur && cur.amplifier === amplifier && cur.duration > EFFECT_REFRESH_BELOW) return;
    player.addEffect(id, EFFECT_TICKS, { amplifier, showParticles: false });
  });
}

/**
 * @param {Entity} entity
 * @param {string} id
 * @param {number} amplifier
 * @param {number} ticks
 */
export function shortEffect(entity, id, amplifier, ticks) {
  tryRun(() => {
    const cur = entity.getEffect(id);
    if (cur && cur.amplifier > amplifier) return;
    entity.addEffect(id, ticks, { amplifier, showParticles: false });
  });
}

/**
 * @param {Player} player
 * @param {Disguise} def
 */
export function applyDisguiseEffects(player, def) {
  for (const [id, amp] of def.effects) keepEffect(player, id, amp);
  if (def.aquatic) {
    keepEffect(player, "water_breathing", 0);
    keepEffect(player, "conduit_power", 0);
  }
}

/**
 * @param {Player} player
 * @param {string} id
 * @param {number | undefined} amplifier
 * @param {number} maxTicks
 */
function removeOurEffect(player, id, amplifier, maxTicks) {
  tryRun(() => {
    const cur = player.getEffect(id);
    if (!cur) return;
    if (amplifier !== undefined && cur.amplifier !== amplifier) return;
    if (cur.duration > maxTicks) return;
    player.removeEffect(id);
  });
}

/**
 * @param {Player} player
 * @param {Disguise} def
 * @param {Disguise | undefined} nextDef
 */
function stripDisguiseEffects(player, def, nextDef) {
  const keep = new Set();
  if (nextDef) {
    for (const [id, amp] of nextDef.effects) keep.add(id + ":" + amp);
    if (nextDef.aquatic) {
      keep.add("water_breathing:0");
      keep.add("conduit_power:0");
    }
  }
  /** @type {[string, number][]} */
  const ours = [...def.effects];
  if (def.aquatic) ours.push(["water_breathing", 0], ["conduit_power", 0]);
  for (const [id, amp] of ours) {
    if (!keep.has(id + ":" + amp)) removeOurEffect(player, id, amp, EFFECT_TICKS + 40);
  }
  for (const [id, maxTicks] of TEMP_EFFECTS) {
    if (!keep.has(id + ":0") && !keep.has(id + ":1")) removeOurEffect(player, id, undefined, maxTicks);
  }
}

// ---------------------------------------------------------------------------
// Name tag hiding
// ---------------------------------------------------------------------------
/** @param {Player} player */
export function hideNameTag(player) {
  tryRun(() => {
    if (player.getDynamicProperty("pd:name_hidden") !== true) {
      player.setDynamicProperty("pd:saved_name", player.nameTag);
      player.setDynamicProperty("pd:name_hidden", true);
    }
    if (player.nameTag !== "") player.nameTag = "";
  });
}

/** @param {Player} player */
export function restoreNameTag(player) {
  tryRun(() => {
    if (player.getDynamicProperty("pd:name_hidden") !== true) return;
    const saved = player.getDynamicProperty("pd:saved_name");
    player.nameTag = typeof saved === "string" && saved.length > 0 ? saved : player.name;
    player.setDynamicProperty("pd:name_hidden", false);
  });
}

// ---------------------------------------------------------------------------
// Tags (handy for command blocks: @a[tag=pd_zombie])
// ---------------------------------------------------------------------------
/**
 * @param {Player} player
 * @param {Disguise | undefined} def
 */
function updateTags(player, def) {
  tryRun(() => {
    for (const tag of player.getTags()) {
      if (tag.startsWith("pd_") && tag !== "pd_wand_given") player.removeTag(tag);
    }
    if (def) {
      player.addTag(TAG_DISGUISED);
      player.addTag("pd_" + def.key);
    }
  });
}

// ---------------------------------------------------------------------------
// Turning disguises on and off
// ---------------------------------------------------------------------------
/**
 * @param {Player} player
 * @param {PlayerState} state
 */
export function cancelFuse(player, state) {
  if (!state.fuseEnd) return;
  state.fuseEnd = 0;
  tryRun(() => player.triggerEvent("pd:mark_0"));
}

/**
 * @param {Player} player
 * @param {Disguise} def
 * @param {{ silent?: boolean }} [options]
 */
export function applyDisguise(player, def, options = {}) {
  const state = getState(player);
  const previous = BY_ID.get(state.disguiseId);
  cancelFuse(player, state);
  state.grazeEnd = 0;
  if (previous) stripDisguiseEffects(player, previous, def);

  state.verifyFrom = readVariant(player);
  try {
    player.triggerEvent("pd:set_" + def.key);
    player.triggerEvent("pd:mark_0");
  } catch {
    // The verify step in the main loop explains the problem to the player.
  }

  state.disguiseId = def.id;
  state.synced = true;
  state.wings = BEE_MAX_WINGS;
  state.cooldownUntil = 0;
  state.verifyAt = system.currentTick + 20;

  updateTags(player, def);
  if (getSetting(player, "hideName")) hideNameTag(player);
  else restoreNameTag(player);
  applyDisguiseEffects(player, def);

  if (!options.silent) {
    particleAt(player, "pd:disguise_poof", 1);
    particleAt(player, "pd:disguise_sparkle", 1);
    playAt(player, "random.pop", 0.8, 0.8);
    mobSound(player, def, "ambient", 1);
    tryRun(() =>
      player.onScreenDisplay.setTitle(def.color + "§l" + def.name, {
        subtitle: "§fDisguise on!",
        fadeInDuration: 4,
        stayDuration: 30,
        fadeOutDuration: 10,
      })
    );
    const tip = def.ability ? `Crouch + use the wand: §e${def.ability.name}§r.` : "Open the wand menu to see your powers.";
    say(player, `You are now a ${def.color}${def.name}§r! ${tip}`);
  }
}

/**
 * @param {Player} player
 * @param {{ silent?: boolean, reason?: string }} [options]
 */
export function removeDisguise(player, options = {}) {
  const state = getState(player);
  const def = BY_ID.get(state.disguiseId);
  cancelFuse(player, state);
  state.grazeEnd = 0;

  tryRun(() => player.triggerEvent("pd:remove_disguise"));
  state.disguiseId = 0;
  state.synced = true;
  state.verifyAt = 0;
  state.wings = BEE_MAX_WINGS;

  if (def) stripDisguiseEffects(player, def, undefined);
  if (def && def.burnsInSun) tryRun(() => player.extinguishFire(false));
  restoreNameTag(player);
  updateTags(player, undefined);

  if (!options.silent && def) {
    particleAt(player, "pd:disguise_poof", 1);
    playAt(player, "random.pop", 0.8, 1.2);
    tryRun(() =>
      player.onScreenDisplay.setTitle("§fBack to normal", {
        subtitle: "§7Disguise removed",
        fadeInDuration: 4,
        stayDuration: 25,
        fadeOutDuration: 10,
      })
    );
    if (options.reason) say(player, options.reason);
  }
}

/**
 * Called when the saved disguise differs from what the script knows (world
 * reload, /reload, or someone used /event on the player directly).
 * @param {Player} player
 * @param {number} variant
 */
export function adoptDisguise(player, variant) {
  const state = getState(player);
  const old = BY_ID.get(state.disguiseId);
  const def = BY_ID.get(variant);
  if (old && old !== def) stripDisguiseEffects(player, old, def);
  state.disguiseId = def ? def.id : 0;
  state.synced = true;
  updateTags(player, def);
  if (def) {
    if (getSetting(player, "hideName")) hideNameTag(player);
    else restoreNameTag(player);
    applyDisguiseEffects(player, def);
  } else {
    restoreNameTag(player);
  }
}

// ---------------------------------------------------------------------------
// Wand
// ---------------------------------------------------------------------------
/** @param {Player} player */
export function giveWand(player) {
  const wand = new ItemStack(WAND_ID, 1);
  tryRun(() => {
    wand.keepOnDeath = true;
  });
  const inventory = /** @type {import("@minecraft/server").EntityInventoryComponent | undefined} */ (
    tryRun(() => player.getComponent("minecraft:inventory"))
  );
  const container = inventory?.container;
  let leftover = wand;
  if (container) {
    try {
      leftover = container.addItem(wand);
    } catch {
      leftover = wand;
    }
  }
  if (leftover) tryRun(() => player.dimension.spawnItem(leftover, player.location));
}

export function worldPlayers() {
  return tryRun(() => world.getAllPlayers()) ?? [];
}
