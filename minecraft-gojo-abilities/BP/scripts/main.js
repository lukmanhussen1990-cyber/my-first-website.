/**
 * Gojo Abilities - Bedrock (mobile friendly) add-on
 * Satoru Gojo's cursed techniques as usable items.
 *
 * Target: Minecraft Bedrock 1.21.x, @minecraft/server 1.11.0 (stable, no experiment needed).
 * Every API call is wrapped so one unsupported call can never break the pack.
 */

import { world, system, EntityDamageCause } from "@minecraft/server";

const ITEM = {
  BLUE: "gojo:blue",
  RED: "gojo:red",
  PURPLE: "gojo:hollow_purple",
  INFINITY: "gojo:infinity",
  VOID: "gojo:unlimited_void",
  EYES: "gojo:six_eyes",
};

const ALL_ITEMS = [ITEM.EYES, ITEM.INFINITY, ITEM.BLUE, ITEM.RED, ITEM.PURPLE, ITEM.VOID];

/** Blocks Hollow Purple refuses to erase, so it cannot ruin a world's foundations. */
const PROTECTED_BLOCKS = new Set([
  "minecraft:air",
  "minecraft:bedrock",
  "minecraft:barrier",
  "minecraft:command_block",
  "minecraft:chain_command_block",
  "minecraft:repeating_command_block",
  "minecraft:structure_block",
  "minecraft:jigsaw",
  "minecraft:end_portal",
  "minecraft:end_portal_frame",
  "minecraft:light_block",
]);

/** Player ids that currently have Infinity switched on (resets on world reload). */
const infinityOn = new Set();

function safe(fn) {
  try {
    return fn();
  } catch (e) {
    return undefined;
  }
}

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

function msg(player, text) {
  safe(() => player.onScreenDisplay.setActionBar(text));
}

function sound(player, id) {
  safe(() => player.playSound(id, { location: player.location }));
}

function particle(dimension, id, location) {
  safe(() => dimension.spawnParticle(id, location));
}

function effect(entity, type, seconds, amplifier, particles) {
  safe(() =>
    entity.addEffect(type, Math.max(1, Math.floor(seconds * 20)), {
      amplifier,
      showParticles: particles !== false,
    })
  );
}

/** applyKnockback changed signature across versions - support both. */
function knockback(entity, dirX, dirZ, horizontal, vertical) {
  try {
    entity.applyKnockback(dirX, dirZ, horizontal, vertical);
  } catch (e) {
    safe(() => entity.applyKnockback({ x: dirX * horizontal, z: dirZ * horizontal }, vertical));
  }
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scaleVec(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function viewDirection(player) {
  return safe(() => player.getViewDirection()) ?? { x: 0, y: 0, z: 1 };
}

function headLocation(player) {
  return safe(() => player.getHeadLocation()) ?? player.location;
}

/** First solid block along the player's aim, otherwise a point out in the air. */
function aimPoint(player, maxDistance) {
  const head = headLocation(player);
  const dir = viewDirection(player);
  const hit = safe(() => player.dimension.getBlockFromRay(head, dir, { maxDistance }));
  if (hit && hit.block) {
    const l = hit.block.location;
    return { x: l.x + 0.5, y: l.y + 1, z: l.z + 0.5 };
  }
  return add(head, scaleVec(dir, maxDistance));
}

function mobsNear(dimension, location, radius) {
  return (
    safe(() =>
      dimension.getEntities({
        location,
        maxDistance: radius,
        excludeTypes: ["minecraft:player", "minecraft:item", "minecraft:xp_orb"],
      })
    ) ?? []
  );
}

function sphereParticles(dimension, center, radius, particleId, points) {
  for (let i = 0; i < points; i++) {
    const theta = Math.acos(1 - (2 * (i + 0.5)) / points);
    const phi = Math.PI * (1 + Math.sqrt(5)) * i;
    particle(dimension, particleId, {
      x: center.x + radius * Math.sin(theta) * Math.cos(phi),
      y: center.y + radius * Math.cos(theta),
      z: center.z + radius * Math.sin(theta) * Math.sin(phi),
    });
  }
}

function ringParticles(dimension, center, radius, particleId, points, yOffset) {
  for (let i = 0; i < points; i++) {
    const angle = (Math.PI * 2 * i) / points;
    particle(dimension, particleId, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + (yOffset ?? 0.2),
      z: center.z + Math.sin(angle) * radius,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Cursed Technique Lapse: BLUE - attraction, crushes everything inward */
/* ------------------------------------------------------------------ */
function techniqueBlue(player) {
  const dim = player.dimension;
  const center = aimPoint(player, 40);

  sound(player, "mob.warden.sonic_charge");
  msg(player, "§9術式順転『蒼』 §bCursed Technique Lapse: BLUE");

  let step = 0;
  const pull = system.runInterval(() => {
    step++;
    sphereParticles(dim, center, 2.5 - step * 0.3, "minecraft:dragon_breath_trail", 26);
    for (const mob of mobsNear(dim, center, 10)) {
      const d = { x: center.x - mob.location.x, z: center.z - mob.location.z };
      const len = Math.hypot(d.x, d.z) || 1;
      knockback(mob, d.x / len, d.z / len, 2.6, 0.2);
      effect(mob, "slowness", 3, 4, false);
    }
    if (step >= 5) {
      system.clearRun(pull);
      for (const mob of mobsNear(dim, center, 7)) {
        safe(() => mob.applyDamage(45, { cause: EntityDamageCause.entityAttack, damagingEntity: player }));
        particle(dim, "minecraft:large_explosion", mob.location);
      }
      sphereParticles(dim, center, 1, "minecraft:huge_explosion_emitter", 3);
      sound(player, "random.explode");
    }
  }, 4);
}

/* ------------------------------------------------------------------ */
/* Cursed Technique Reversal: RED - repulsion, blows everything away    */
/* ------------------------------------------------------------------ */
function techniqueRed(player) {
  const dim = player.dimension;
  const center = aimPoint(player, 40);

  sphereParticles(dim, center, 2, "minecraft:large_explosion", 18);
  sphereParticles(dim, center, 4.5, "minecraft:huge_explosion_emitter", 4);

  for (const mob of mobsNear(dim, center, 14)) {
    const d = { x: mob.location.x - center.x, z: mob.location.z - center.z };
    const len = Math.hypot(d.x, d.z) || 1;
    safe(() => mob.applyDamage(70, { cause: EntityDamageCause.entityExplosion, damagingEntity: player }));
    knockback(mob, d.x / len, d.z / len, 5.5, 1.4);
  }

  // Gojo's own recoil - a small push backwards.
  const back = viewDirection(player);
  knockback(player, -back.x, -back.z, 0.9, 0.35);
  effect(player, "resistance", 4, 4, false);

  sound(player, "random.explode");
  msg(player, "§c術式反転『赫』 §6Cursed Technique Reversal: RED");
}

/* ------------------------------------------------------------------ */
/* HOLLOW PURPLE - an imaginary mass that erases a tunnel through both  */
/* the terrain and everything living in its path.                       */
/* ------------------------------------------------------------------ */
function eraseBlock(dim, x, y, z) {
  const block = safe(() => dim.getBlock({ x, y, z }));
  if (!block) return;
  if (PROTECTED_BLOCKS.has(block.typeId)) return;
  try {
    block.setType("minecraft:air");
  } catch (e) {
    safe(() => dim.runCommand("setblock " + x + " " + y + " " + z + " air destroy"));
  }
}

function techniquePurple(player) {
  const dim = player.dimension;
  const dir = viewDirection(player);
  const start = headLocation(player);
  const maxRange = 60;
  const hitAlready = new Set();

  sound(player, "mob.warden.sonic_boom");
  msg(player, "§5虚式『茈』 §dHOLLOW PURPLE");

  let travelled = 0;
  const beam = system.runInterval(() => {
    if (!isValid(player)) {
      system.clearRun(beam);
      return;
    }
    // Two blocks of travel per tick keeps it fast but still readable as a beam.
    for (let s = 0; s < 2 && travelled < maxRange; s++) {
      travelled += 1;
      const point = add(start, scaleVec(dir, travelled));
      const bx = Math.floor(point.x);
      const by = Math.floor(point.y);
      const bz = Math.floor(point.z);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            eraseBlock(dim, bx + dx, by + dy, bz + dz);
          }
        }
      }

      particle(dim, "minecraft:dragon_breath_trail", point);
      ringParticles(dim, point, 1.2, "minecraft:large_explosion", 5, 0);

      for (const mob of mobsNear(dim, point, 4)) {
        if (hitAlready.has(mob.id)) continue;
        hitAlready.add(mob.id);
        safe(() => mob.applyDamage(250, { cause: EntityDamageCause.entityAttack, damagingEntity: player }));
        particle(dim, "minecraft:huge_explosion_emitter", mob.location);
      }
    }

    if (travelled >= maxRange) {
      system.clearRun(beam);
      const end = add(start, scaleVec(dir, maxRange));
      sphereParticles(dim, end, 3, "minecraft:huge_explosion_emitter", 6);
      sound(player, "random.explode");
    }
  }, 1);
}

/* ------------------------------------------------------------------ */
/* INFINITY - nothing ever reaches Gojo. Toggle on and off.             */
/* ------------------------------------------------------------------ */
function toggleInfinity(player) {
  if (infinityOn.has(player.id)) {
    infinityOn.delete(player.id);
    safe(() => player.runCommand("effect @s resistance 0"));
    sound(player, "random.orb");
    msg(player, "§7無下限 §fINFINITY: §cOFF");
    return;
  }
  infinityOn.add(player.id);
  sound(player, "beacon.activate");
  msg(player, "§b無下限 §fINFINITY: §aON §7(nothing can touch you)");
}

/** Refreshed a few times a second for everyone with Infinity on. */
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    if (!infinityOn.has(player.id)) continue;
    if (!isValid(player)) {
      infinityOn.delete(player.id);
      continue;
    }

    effect(player, "resistance", 2, 250, false);
    effect(player, "fire_resistance", 2, 0, false);
    effect(player, "slow_falling", 2, 0, false);

    const dim = player.dimension;
    // Anything that comes close is pushed straight back out.
    for (const mob of mobsNear(dim, player.location, 4)) {
      const d = { x: mob.location.x - player.location.x, z: mob.location.z - player.location.z };
      const len = Math.hypot(d.x, d.z) || 1;
      knockback(mob, d.x / len, d.z / len, 1.8, 0.35);
      particle(dim, "minecraft:knockback_roar_particle", mob.location);
    }
    ringParticles(dim, player.location, 1.6, "minecraft:snowflake_particle", 6, 1.0);
  }
}, 10);

/* ------------------------------------------------------------------ */
/* DOMAIN EXPANSION: UNLIMITED VOID - a sure-hit domain that stops      */
/* every mob around you with an overload of information.                */
/* ------------------------------------------------------------------ */
function domainUnlimitedVoid(player) {
  const dim = player.dimension;
  const center = { x: player.location.x, y: player.location.y, z: player.location.z };
  const radius = 28;
  const durationTicks = 12 * 20;

  sound(player, "mob.warden.sonic_boom");
  safe(() => player.runCommand('title @a title §8§l領域展開'));
  safe(() => player.runCommand('title @a subtitle §7Domain Expansion: §fUnlimited Void'));
  msg(player, "§8領域展開 §fUNLIMITED VOID");

  let elapsed = 0;
  const domain = system.runInterval(() => {
    elapsed += 10;

    sphereParticles(dim, center, radius * 0.5, "minecraft:endrod", 40);
    sphereParticles(dim, center, radius * 0.25, "minecraft:dragon_breath_trail", 24);

    for (const mob of mobsNear(dim, center, radius)) {
      effect(mob, "slowness", 4, 25, false);
      effect(mob, "weakness", 4, 10, false);
      effect(mob, "blindness", 4, 0, false);
      effect(mob, "mining_fatigue", 4, 5, false);
      effect(mob, "nausea", 4, 0, false);
      safe(() => mob.applyDamage(4, { cause: EntityDamageCause.magic, damagingEntity: player }));
      particle(dim, "minecraft:endrod", mob.location);
    }

    if (isValid(player)) {
      effect(player, "resistance", 2, 4, false);
      effect(player, "speed", 2, 2, false);
      effect(player, "night_vision", 2, 0, false);
      effect(player, "regeneration", 2, 2, false);
    }

    if (elapsed >= durationTicks) {
      system.clearRun(domain);
      if (isValid(player)) {
        sound(player, "beacon.deactivate");
        msg(player, "§7Domain closed.");
      }
    }
  }, 10);
}

/* ------------------------------------------------------------------ */
/* SIX EYES - instant movement to whatever you look at, plus the        */
/* awareness buffs the Six Eyes give.                                   */
/* ------------------------------------------------------------------ */
function sixEyes(player) {
  const dim = player.dimension;
  const target = aimPoint(player, 60);
  const from = player.location;

  ringParticles(dim, from, 1, "minecraft:endrod", 10, 1);
  safe(() => player.teleport({ x: target.x, y: target.y, z: target.z }, { dimension: dim }));
  ringParticles(dim, target, 1, "minecraft:endrod", 10, 1);

  effect(player, "night_vision", 300, 0, false);
  effect(player, "speed", 60, 1, false);
  effect(player, "haste", 60, 1, false);
  effect(player, "jump_boost", 60, 1, false);
  effect(player, "slow_falling", 8, 0, false);

  // Reveal every mob nearby - the Six Eyes see everything.
  for (const mob of mobsNear(dim, target, 30)) {
    particle(dim, "minecraft:villager_happy", { x: mob.location.x, y: mob.location.y + 1.5, z: mob.location.z });
  }

  sound(player, "mob.endermen.portal");
  msg(player, "§f六眼 §bSIX EYES §7- " + Math.round(distance(from, target)) + " blocks");
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */
const TECHNIQUES = {
  [ITEM.BLUE]: techniqueBlue,
  [ITEM.RED]: techniqueRed,
  [ITEM.PURPLE]: techniquePurple,
  [ITEM.INFINITY]: toggleInfinity,
  [ITEM.VOID]: domainUnlimitedVoid,
  [ITEM.EYES]: sixEyes,
};

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;
  if (!player || !item) return;
  const technique = TECHNIQUES[item.typeId];
  if (!technique) return;
  try {
    technique(player);
  } catch (e) {
    safe(() => player.sendMessage("§cTechnique failed: §7" + e));
  }
});

function helpText() {
  return [
    "§b§l=== GOJO ABILITIES ===§r",
    "§7Hold an item and use it (long press on mobile).",
    "§f六眼 Six Eyes§7 - teleport to what you look at + vision buffs",
    "§f無下限 Infinity§7 - toggle: nothing can touch you",
    "§9蒼 Blue§7 - crushes everything toward one point",
    "§c赫 Red§7 - blasts everything away from one point",
    "§5茈 Hollow Purple§7 - erases a tunnel through anything",
    "§8領域展開 Unlimited Void§7 - freezes every mob around you",
    "§7Get them all: §f/scriptevent gojo:give",
  ].join("\n");
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const id = event.id.toLowerCase();
  const source = event.sourceEntity;
  const targets = source && source.typeId === "minecraft:player" ? [source] : world.getAllPlayers();

  if (id === "gojo:give") {
    for (const player of targets) {
      for (const itemId of ALL_ITEMS) safe(() => player.runCommand("give @s " + itemId + " 1"));
      safe(() => player.sendMessage("§b✦ You are the honored one. All 6 techniques received. ✦"));
    }
  }

  if (id === "gojo:help") {
    for (const player of targets) safe(() => player.sendMessage(helpText()));
  }

  if (id === "gojo:infinity") {
    for (const player of targets) safe(() => toggleInfinity(player));
  }
});

world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  safe(() => event.player.sendMessage(helpText()));
});
