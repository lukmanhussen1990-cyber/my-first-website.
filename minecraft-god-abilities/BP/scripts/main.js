/**
 * God Abilities - Bedrock (mobile friendly) add-on
 * 5 god-tier ability items, activated by holding the item and tapping/long-pressing
 * (right-click on PC, "use" button / long press on Android).
 *
 * Target: Minecraft Bedrock 1.21.x, @minecraft/server 1.11.0 (stable, no experiment needed).
 */

import { world, system, EntityDamageCause } from "@minecraft/server";

const ITEM = {
  WRATH: "godmod:divine_wrath",
  GENESIS: "godmod:genesis_core",
  WINGS: "godmod:heaven_wings",
  VOID: "godmod:void_ripper",
  CHRONO: "godmod:chrono_scepter",
};

const ALL_ITEMS = [ITEM.WRATH, ITEM.GENESIS, ITEM.WINGS, ITEM.VOID, ITEM.CHRONO];

/** Never let one failing API call kill an ability. */
function safe(fn) {
  try {
    return fn();
  } catch (e) {
    return undefined;
  }
}

function msg(player, text) {
  safe(() => player.onScreenDisplay.setActionBar(text));
}

function sound(player, id) {
  safe(() => player.playSound(id, { location: player.location }));
}

function particle(dimension, id, location) {
  safe(() => dimension.spawnParticle(id, location));
}

function effect(entity, type, seconds, amplifier) {
  safe(() => entity.addEffect(type, Math.max(1, Math.floor(seconds * 20)), { amplifier, showParticles: true }));
}

/** applyKnockback changed signature across versions - support both. */
function knockback(entity, dirX, dirZ, horizontal, vertical) {
  try {
    entity.applyKnockback(dirX, dirZ, horizontal, vertical);
  } catch (e) {
    safe(() => entity.applyKnockback({ x: dirX * horizontal, z: dirZ * horizontal }, vertical));
  }
}

/** isValid is a method on 1.21.0 and a property on later builds. */
function isValid(entity) {
  try {
    const v = entity.isValid;
    if (typeof v === "function") return v.call(entity);
    if (typeof v === "boolean") return v;
    return true;
  } catch (e) {
    return false;
  }
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

/** Where the player is looking: first solid block, otherwise a point out in the air. */
function aimPoint(player, maxDistance) {
  const head = safe(() => player.getHeadLocation()) ?? player.location;
  const dir = safe(() => player.getViewDirection()) ?? { x: 0, y: 0, z: 1 };
  const hit = safe(() => player.dimension.getBlockFromRay(head, dir, { maxDistance }));
  if (hit && hit.block) {
    const l = hit.block.location;
    return { x: l.x + 0.5, y: l.y + 1, z: l.z + 0.5 };
  }
  return add(head, scale(dir, maxDistance));
}

function nearbyEntities(dimension, location, radius, includePlayers) {
  const options = { location, maxDistance: radius };
  if (!includePlayers) options.excludeTypes = ["minecraft:player", "minecraft:item", "minecraft:xp_orb"];
  else options.excludeTypes = ["minecraft:item", "minecraft:xp_orb"];
  return safe(() => dimension.getEntities(options)) ?? [];
}

function ring(dimension, center, radius, particleId, points) {
  for (let i = 0; i < points; i++) {
    const angle = (Math.PI * 2 * i) / points;
    particle(dimension, particleId, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + 0.2,
      z: center.z + Math.sin(angle) * radius,
    });
  }
}

/* ------------------------------------------------------------------ */
/* 1. DIVINE WRATH - call down the storm on whatever you are looking at */
/* ------------------------------------------------------------------ */
function abilityDivineWrath(player) {
  const dim = player.dimension;
  const target = aimPoint(player, 64);

  safe(() => dim.spawnEntity("minecraft:lightning_bolt", target));
  // Three extra bolts around the impact point for a storm effect.
  const offsets = [
    { x: 2.5, z: 0 },
    { x: -1.5, z: 2 },
    { x: -1.5, z: -2 },
  ];
  system.runTimeout(() => {
    for (const o of offsets) {
      safe(() => dim.spawnEntity("minecraft:lightning_bolt", { x: target.x + o.x, y: target.y, z: target.z + o.z }));
    }
  }, 6);

  for (const e of nearbyEntities(dim, target, 7, false)) {
    safe(() => e.applyDamage(35, { cause: EntityDamageCause.lightning, damagingEntity: player }));
    const d = { x: e.location.x - target.x, z: e.location.z - target.z };
    const len = Math.hypot(d.x, d.z) || 1;
    knockback(e, d.x / len, d.z / len, 1.6, 0.8);
  }

  ring(dim, target, 3, "minecraft:large_explosion", 12);
  sound(player, "ambient.weather.thunder");
  msg(player, "§e⚡ §6DIVINE WRATH §e⚡");
}

/* ------------------------------------------------------------------ */
/* 2. GENESIS CORE - full restore + divine protection for you and allies */
/* ------------------------------------------------------------------ */
function abilityGenesisCore(player) {
  const dim = player.dimension;

  const bless = (target) => {
    safe(() => {
      const health = target.getComponent("minecraft:health");
      if (health) health.setCurrentValue(health.effectiveMax ?? 20);
    });
    safe(() => target.extinguishFire(true));
    effect(target, "regeneration", 12, 4);
    effect(target, "absorption", 90, 3);
    effect(target, "resistance", 25, 2);
    effect(target, "fire_resistance", 60, 0);
    effect(target, "saturation", 3, 4);
    effect(target, "health_boost", 120, 2);
    effect(target, "night_vision", 300, 0);
  };

  bless(player);
  for (const ally of nearbyEntities(dim, player.location, 14, true)) {
    if (ally.typeId === "minecraft:player" && ally.id !== player.id) bless(ally);
  }

  ring(dim, player.location, 2.5, "minecraft:heart_particle", 10);
  ring(dim, player.location, 4, "minecraft:totem_particle", 16);
  sound(player, "beacon.activate");
  msg(player, "§a✚ §2GENESIS CORE §a- life restored ✚");
}

/* ------------------------------------------------------------------ */
/* 3. WINGS OF HEAVEN - launch skyward, land safely, move like a god    */
/* ------------------------------------------------------------------ */
function abilityHeavenWings(player) {
  const dim = player.dimension;
  const dir = safe(() => player.getViewDirection()) ?? { x: 0, y: 0, z: 1 };

  knockback(player, dir.x, dir.z, 2.2, 1.9);
  effect(player, "slow_falling", 25, 0);
  effect(player, "speed", 45, 2);
  effect(player, "jump_boost", 45, 3);
  effect(player, "resistance", 25, 1);

  // Fallback in case addEffect is unavailable on this build.
  safe(() => player.runCommand("effect @s slow_falling 25 0 true"));

  ring(dim, player.location, 1.5, "minecraft:egg_destroy_emitter", 10);
  particle(dim, "minecraft:knockback_roar_particle", player.location);
  sound(player, "mob.enderdragon.flap");
  msg(player, "§b☁ §fWINGS OF HEAVEN §b☁");
}

/* ------------------------------------------------------------------ */
/* 4. VOID RIPPER - drag everything in, then erase it                   */
/* ------------------------------------------------------------------ */
function abilityVoidRipper(player) {
  const dim = player.dimension;
  const center = player.location;
  const victims = nearbyEntities(dim, center, 18, false);

  for (const e of victims) {
    const d = { x: center.x - e.location.x, z: center.z - e.location.z };
    const len = Math.hypot(d.x, d.z) || 1;
    knockback(e, d.x / len, d.z / len, 2.4, 0.35);
    effect(e, "slowness", 4, 3);
    particle(dim, "minecraft:dragon_breath_trail", e.location);
  }

  ring(dim, center, 6, "minecraft:dragon_breath_trail", 20);
  sound(player, "mob.endermen.portal");
  msg(player, "§5✹ §dVOID RIPPER §5- the void answers ✹");

  system.runTimeout(() => {
    if (!isValid(player)) return;
    for (const e of nearbyEntities(dim, center, 10, false)) {
      particle(dim, "minecraft:huge_explosion_emitter", e.location);
      safe(() => e.applyDamage(120, { cause: EntityDamageCause.entityAttack, damagingEntity: player }));
    }
    ring(dim, center, 3, "minecraft:large_explosion", 12);
    sound(player, "random.explode");
  }, 25);
}

/* ------------------------------------------------------------------ */
/* 5. CHRONO SCEPTER - stop time for everything except you              */
/* ------------------------------------------------------------------ */
function abilityChronoScepter(player) {
  const dim = player.dimension;
  const frozen = nearbyEntities(dim, player.location, 22, false);

  for (const e of frozen) {
    effect(e, "slowness", 15, 20);
    effect(e, "weakness", 15, 10);
    effect(e, "mining_fatigue", 15, 5);
    particle(dim, "minecraft:snowflake_particle", e.location);
  }

  effect(player, "speed", 25, 4);
  effect(player, "haste", 25, 4);
  effect(player, "resistance", 25, 1);
  effect(player, "night_vision", 60, 0);

  ring(dim, player.location, 5, "minecraft:snowflake_particle", 22);
  sound(player, "beacon.power");
  msg(player, "§3⧗ §bCHRONO SCEPTER §3- time frozen (" + frozen.length + ") ⧗");
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */
const ABILITIES = {
  [ITEM.WRATH]: abilityDivineWrath,
  [ITEM.GENESIS]: abilityGenesisCore,
  [ITEM.WINGS]: abilityHeavenWings,
  [ITEM.VOID]: abilityVoidRipper,
  [ITEM.CHRONO]: abilityChronoScepter,
};

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;
  if (!player || !item) return;
  const ability = ABILITIES[item.typeId];
  if (!ability) return;
  try {
    ability(player);
  } catch (e) {
    safe(() => player.sendMessage("§cAbility failed: §7" + e));
  }
});

/** /scriptevent godmod:give  -> all 5 god items, /scriptevent godmod:help -> tips */
system.afterEvents.scriptEventReceive.subscribe((event) => {
  const id = event.id.toLowerCase();
  const source = event.sourceEntity;

  if (id === "godmod:give") {
    const targets = source && source.typeId === "minecraft:player" ? [source] : world.getAllPlayers();
    for (const player of targets) {
      for (const itemId of ALL_ITEMS) safe(() => player.runCommand("give @s " + itemId + " 1"));
      safe(() => player.sendMessage("§6✦ You received all 5 god abilities. ✦"));
    }
  }

  if (id === "godmod:help") {
    const targets = source && source.typeId === "minecraft:player" ? [source] : world.getAllPlayers();
    for (const player of targets) safe(() => player.sendMessage(helpText()));
  }
});

function helpText() {
  return [
    "§6§l=== GOD ABILITIES ===§r",
    "§7Hold an item and use it (long press on mobile).",
    "§e⚡ Divine Wrath§7 - lightning storm where you aim",
    "§a✚ Genesis Core§7 - full heal + shields for you and allies",
    "§b☁ Wings of Heaven§7 - launch + safe landing + speed",
    "§d✹ Void Ripper§7 - pull mobs in, then annihilate them",
    "§b⧗ Chrono Scepter§7 - freeze time for nearby mobs",
    "§7Get them all: §f/scriptevent godmod:give",
  ].join("\n");
}

world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  safe(() => event.player.sendMessage(helpText()));
});
