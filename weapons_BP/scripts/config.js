/**
 * Legendary Weapons - configuration and persistent settings.
 *
 * WEAPONS is the single source of truth: stats shown in the codex, ability
 * cooldowns and the numbers each ability uses all come from here.
 */

import { world } from "@minecraft/server";

const PROP_PREFIX = "wm:";

export const SETTINGS_DEFAULTS = {
  /** Weapon abilities may break blocks (explosions, quakes). */
  blockDamage: false,
  /** Abilities may hit other players. Turn off for co-op worlds. */
  hurtPlayers: true,
  /** Abilities cost durability on top of the normal melee wear. */
  abilityDurability: true,
  /** Show the ability name on the action bar when it fires. */
  showAbilityText: true,
  /** Global multiplier on every ability's damage, in percent. */
  powerPercent: 100
};

/** Every weapon in the pack. `key` is the item id without the namespace. */
export const WEAPONS = {
  thunder_blade: {
    key: "thunder_blade",
    name: "Thunder Blade",
    color: "§e",
    icon: "textures/ui/wm_icon_thunder",
    melee: 9,
    durability: 1800,
    cooldownSeconds: 6,
    ability: "Call Lightning",
    abilityText: "Strikes where you look, then arcs to nearby enemies.",
    passive: "Every hit arcs lightning to up to 3 nearby enemies.",
    tuning: {
      range: 32,
      chainTargets: 3,
      chainRadius: 6,
      chainDamage: 5,
      strikeDamage: 8,
      strikeRadius: 3.5
    }
  },
  frost_scythe: {
    key: "frost_scythe",
    name: "Frost Scythe",
    color: "§b",
    icon: "textures/ui/wm_icon_frost",
    melee: 8,
    durability: 1600,
    cooldownSeconds: 8,
    ability: "Frost Nova",
    abilityText: "Freezes everything around you solid.",
    passive: "Hits chill the target: slowness and weakness.",
    tuning: {
      radius: 7,
      damage: 6,
      slownessSeconds: 7,
      slownessLevel: 3,
      hitSlownessSeconds: 4
    }
  },
  inferno_cannon: {
    key: "inferno_cannon",
    name: "Inferno Cannon",
    color: "§c",
    icon: "textures/ui/wm_icon_inferno",
    melee: 4,
    durability: 900,
    cooldownSeconds: 3,
    ability: "Fire Blast",
    abilityText: "Fires a bolt of fire that explodes where it lands.",
    passive: "Melee hits set the target on fire.",
    tuning: {
      range: 40,
      explosionPower: 2.5,
      directDamage: 10,
      splashDamage: 6,
      splashRadius: 4,
      burnSeconds: 6
    }
  },
  void_ripper: {
    key: "void_ripper",
    name: "Void Ripper",
    color: "§d",
    icon: "textures/ui/wm_icon_void",
    melee: 7,
    durability: 1200,
    cooldownSeconds: 4,
    ability: "Blink Strike",
    abilityText: "Teleports you forward, cutting everything you pass through.",
    passive: "Steals health equal to 30% of the damage you deal.",
    tuning: {
      distance: 12,
      pathDamage: 8,
      pathRadius: 2.2,
      lifestealPercent: 30
    }
  },
  earthshaker: {
    key: "earthshaker",
    name: "Earthshaker",
    color: "§6",
    icon: "textures/ui/wm_icon_quake",
    melee: 12,
    durability: 2200,
    cooldownSeconds: 7,
    ability: "Ground Slam",
    abilityText: "Slams the ground and launches everything nearby.",
    passive: "Heavy hits knock the target back hard.",
    tuning: {
      radius: 9,
      damage: 12,
      launch: 1.1,
      shakeIntensity: 0.2,
      knockbackBonus: 1.4
    }
  },
  singularity_staff: {
    key: "singularity_staff",
    name: "Singularity Staff",
    color: "§5",
    icon: "textures/ui/wm_icon_singularity",
    melee: 3,
    durability: 700,
    cooldownSeconds: 12,
    ability: "Singularity",
    abilityText: "Opens a black hole that drags everything in, then implodes.",
    passive: "Weak in melee. It is not a club.",
    tuning: {
      range: 26,
      pullRadius: 13,
      pullStrength: 0.55,
      holdTicks: 60,
      implodeDamage: 16,
      implodeRadius: 5
    }
  }
};

export const WEAPON_KEYS = Object.keys(WEAPONS);
export const CORE_ID = "wm:weapon_core";

/** Full item id for a weapon key. */
export function itemId(key) {
  return `wm:${key}`;
}

/** Weapon definition from a full item id, or undefined. */
export function weaponFromItemId(id) {
  if (!id || !id.startsWith("wm:")) return undefined;
  return WEAPONS[id.slice(3)];
}

const cache = { ...SETTINGS_DEFAULTS };
let loaded = false;

export function loadSettings() {
  for (const key of Object.keys(SETTINGS_DEFAULTS)) {
    try {
      const stored = world.getDynamicProperty(PROP_PREFIX + key);
      if (stored !== undefined && typeof stored === typeof SETTINGS_DEFAULTS[key]) cache[key] = stored;
    } catch {
      // keep the default
    }
  }
  loaded = true;
}

export function getSetting(key) {
  if (!loaded) loadSettings();
  return cache[key];
}

export function setSetting(key, value) {
  if (!(key in SETTINGS_DEFAULTS)) return;
  cache[key] = value;
  try {
    world.setDynamicProperty(PROP_PREFIX + key, value);
  } catch {
    // session only
  }
}

export function resetSettings() {
  for (const key of Object.keys(SETTINGS_DEFAULTS)) setSetting(key, SETTINGS_DEFAULTS[key]);
}

/** Applies the global power multiplier to an ability damage number. */
export function power(amount) {
  return (amount * getSetting("powerPercent")) / 100;
}
