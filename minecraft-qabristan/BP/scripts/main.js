/**
 * Qabristan (graveyard) - Bedrock (mobile friendly) add-on
 *
 * Gravedigger's Shovel  - builds a whole walled graveyard with a tomb and a crypt
 * Cursed Lantern        - wakes the undead that sleep there
 * Soul Bell             - banishes every undead around you and shields you
 * Spirit Compass        - finds your graveyard again and counts the undead near you
 *
 * Target: Minecraft Bedrock 1.21.x, @minecraft/server 1.11.0 (stable, no experiment needed).
 */

import { world, system } from "@minecraft/server";

const ITEM = {
  SHOVEL: "qabr:gravedigger_shovel",
  LANTERN: "qabr:cursed_lantern",
  BELL: "qabr:soul_bell",
  COMPASS: "qabr:spirit_compass",
};

const ALL_ITEMS = [ITEM.SHOVEL, ITEM.LANTERN, ITEM.BELL, ITEM.COMPASS];

const UNDEAD = [
  "minecraft:zombie",
  "minecraft:zombie_villager",
  "minecraft:husk",
  "minecraft:drowned",
  "minecraft:skeleton",
  "minecraft:stray",
  "minecraft:wither_skeleton",
  "minecraft:zombie_pigman",
  "minecraft:phantom",
];

const GUARDIAN_NAME = "§5Qabristan Guardian";
const COMMANDS_PER_TICK = 24;

/** Remembered graveyard entrance, per player. Backed by a world dynamic property. */
const siteMemory = new Map();

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

function rememberSite(player, location) {
  siteMemory.set(player.id, location);
  safe(() => world.setDynamicProperty("qabr:site:" + player.id, JSON.stringify(location)));
}

function recallSite(player) {
  if (siteMemory.has(player.id)) return siteMemory.get(player.id);
  const stored = safe(() => world.getDynamicProperty("qabr:site:" + player.id));
  if (typeof stored === "string") {
    const parsed = safe(() => JSON.parse(stored));
    if (parsed) siteMemory.set(player.id, parsed);
    return parsed;
  }
  return undefined;
}

function undeadNear(dimension, location, radius) {
  const found = [];
  for (const type of UNDEAD) {
    const list = safe(() => dimension.getEntities({ location, maxDistance: radius, type })) ?? [];
    for (const entity of list) found.push(entity);
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* The graveyard blueprint                                             */
/* ------------------------------------------------------------------ */
function planGraveyard(ox, oy, oz) {
  const cmds = [];
  const fill = (x1, y1, z1, x2, y2, z2, block, mode) =>
    cmds.push(`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${block}${mode ? " " + mode : ""}`);
  const set = (x, y, z, block) => cmds.push(`setblock ${x} ${y} ${z} ${block}`);
  const loot = (x, y, z, slot, item, count) =>
    cmds.push(`replaceitem block ${x} ${y} ${z} slot.container ${slot} ${item} ${count}`);

  const X0 = ox - 12;
  const X1 = ox + 12;
  const Z0 = oz - 10; // gate wall
  const Z1 = oz + 10;
  const FY = oy - 1;

  const CRYPT_FLOOR = oy - 8;
  const CRYPT_Y0 = oy - 7;
  const CRYPT_Y1 = oy - 4;
  const CRYPT_CEIL = oy - 3;

  // ---- 1. clear the ground and level it --------------------------------
  fill(X0 - 1, FY + 1, Z0 - 1, X1 + 1, oy + 12, Z1 + 1, "minecraft:air");
  fill(X0 - 1, FY - 3, Z0 - 1, X1 + 1, FY, Z1 + 1, "minecraft:stone", "replace minecraft:air");
  fill(X0 - 1, FY, Z0 - 1, X1 + 1, FY, Z1 + 1, "minecraft:grass_block");
  // patchy, neglected ground
  fill(X0 + 2, FY, Z0 + 2, ox - 4, FY, oz - 4, "minecraft:podzol");
  fill(ox + 4, FY, oz + 4, X1 - 2, FY, Z1 - 2, "minecraft:podzol");

  // ---- 2. the wall ------------------------------------------------------
  for (const [a, b, c, d] of [
    [X0, Z0, X1, Z0],
    [X0, Z1, X1, Z1],
    [X0, Z0, X0, Z1],
    [X1, Z0, X1, Z1],
  ]) {
    fill(a, oy, b, c, oy + 2, d, "minecraft:stone_bricks");
    fill(a, oy + 3, b, c, oy + 3, d, "minecraft:stone_brick_slab");
  }
  // age it - mossy patches along the wall
  fill(X0, oy, oz - 4, X0, oy + 1, oz + 4, "minecraft:mossy_stone_bricks");
  fill(X1, oy, oz - 4, X1, oy + 1, oz + 4, "minecraft:mossy_stone_bricks");
  fill(ox - 8, oy, Z1, ox - 4, oy + 1, Z1, "minecraft:mossy_stone_bricks");

  // ---- 3. the gate ------------------------------------------------------
  fill(ox - 1, oy, Z0, ox + 1, oy + 2, Z0, "minecraft:air");
  for (const gx of [ox - 2, ox + 2]) {
    fill(gx, oy, Z0, gx, oy + 4, Z0, "minecraft:polished_andesite");
    set(gx, oy + 5, Z0, "minecraft:soul_lantern");
  }
  fill(ox - 1, oy + 3, Z0, ox + 1, oy + 3, Z0, "minecraft:stone_brick_slab");
  fill(ox - 1, FY, Z0 - 4, ox + 1, FY, Z0, "minecraft:gravel");

  // ---- 4. the path to the tomb -----------------------------------------
  fill(ox - 1, FY, Z0, ox + 1, FY, oz - 4, "minecraft:gravel");

  // ---- 5. lantern posts along the wall ----------------------------------
  for (const pz of [oz - 6, oz, oz + 6]) {
    for (const px of [X0, X1]) {
      fill(px, oy, pz, px, oy + 4, pz, "minecraft:polished_andesite");
      set(px, oy + 5, pz, "minecraft:soul_lantern");
    }
  }

  // ---- 6. the graves ----------------------------------------------------
  // Headstones are full blocks capped with a slab - every id here exists on
  // every 1.21 build, so no grave can come out missing.
  const headstones = [
    "minecraft:stone_bricks",
    "minecraft:mossy_stone_bricks",
    "minecraft:cobblestone",
    "minecraft:mossy_cobblestone",
    "minecraft:polished_andesite",
  ];
  const columns = [ox - 11, ox - 8, ox - 5, ox + 5, ox + 8, ox + 11];
  const rows = [oz - 7, oz - 3, oz + 1, oz + 5];
  let graveIndex = 0;
  for (const gx of columns) {
    for (const gz of rows) {
      set(gx, oy, gz, headstones[graveIndex % headstones.length]);
      set(gx, oy + 1, gz, "minecraft:stone_brick_slab");
      fill(gx, FY, gz + 1, gx, FY, gz + 2, graveIndex % 2 ? "minecraft:podzol" : "minecraft:dirt");
      if (graveIndex % 3 === 0) set(gx, oy, gz + 2, "minecraft:stone_brick_slab");
      graveIndex++;
    }
  }

  // ---- 7. the tomb in the middle ---------------------------------------
  fill(ox - 3, FY, oz - 3, ox + 3, FY, oz + 3, "minecraft:quartz_block");
  fill(ox - 3, oy, oz - 3, ox + 3, oy, oz + 3, "minecraft:air");
  for (const [px, pz] of [
    [ox - 3, oz - 3],
    [ox + 3, oz - 3],
    [ox - 3, oz + 3],
    [ox + 3, oz + 3],
  ]) {
    fill(px, oy, pz, px, oy + 3, pz, "minecraft:quartz_pillar");
  }
  fill(ox - 4, oy + 4, oz - 4, ox + 4, oy + 4, oz + 4, "minecraft:quartz_slab");
  fill(ox - 2, oy + 5, oz - 2, ox + 2, oy + 5, oz + 2, "minecraft:quartz_block");
  fill(ox - 1, oy + 6, oz - 1, ox + 1, oy + 6, oz + 1, "minecraft:quartz_block");
  set(ox, oy + 7, oz, "minecraft:chiseled_quartz_block");
  set(ox, oy + 3, oz, "minecraft:soul_lantern");
  // the tomb itself
  fill(ox - 1, oy, oz - 1, ox + 1, oy, oz + 1, "minecraft:chiseled_quartz_block");
  set(ox, oy + 1, oz, "minecraft:quartz_slab");

  // ---- 8. the crypt below ----------------------------------------------
  fill(ox - 4, CRYPT_Y0, oz - 3, ox + 4, CRYPT_Y1, oz + 3, "minecraft:air");
  fill(ox - 5, CRYPT_FLOOR, oz - 4, ox + 5, CRYPT_FLOOR, oz + 4, "minecraft:mossy_cobblestone");
  fill(ox - 5, CRYPT_CEIL, oz - 4, ox + 5, CRYPT_CEIL, oz + 4, "minecraft:stone_bricks");
  fill(ox - 5, CRYPT_Y0, oz - 4, ox - 5, CRYPT_Y1, oz + 4, "minecraft:mossy_cobblestone");
  fill(ox + 5, CRYPT_Y0, oz - 4, ox + 5, CRYPT_Y1, oz + 4, "minecraft:mossy_cobblestone");
  fill(ox - 5, CRYPT_Y0, oz - 4, ox + 5, CRYPT_Y1, oz - 4, "minecraft:mossy_cobblestone");
  fill(ox - 5, CRYPT_Y0, oz + 4, ox + 5, CRYPT_Y1, oz + 4, "minecraft:mossy_cobblestone");

  // stairs down from the edge of the tomb (carved after the shell exists)
  for (let i = 0; i <= 7; i++) {
    const sz = oz - 3 + i;
    const sy = FY - i;
    set(ox + 4, sy, sz, "minecraft:stone_bricks");
    fill(ox + 4, sy + 1, sz, ox + 4, sy + 3, sz, "minecraft:air");
  }
  fill(ox + 4, CRYPT_Y0, oz + 3, ox + 5, CRYPT_Y0 + 1, oz + 3, "minecraft:air");

  // crypt furnishing
  for (const [cx, cz] of [
    [ox - 4, oz - 2],
    [ox - 4, oz],
    [ox - 4, oz + 2],
  ]) {
    set(cx, CRYPT_Y0, cz, "minecraft:chest");
  }
  const buried = [
    ["minecraft:bone", 16],
    ["minecraft:rotten_flesh", 24],
    ["minecraft:gold_ingot", 6],
    ["minecraft:emerald", 4],
    ["minecraft:golden_apple", 2],
    ["minecraft:iron_ingot", 8],
    ["minecraft:soul_sand", 12],
    ["minecraft:diamond", 2],
  ];
  buried.forEach(([item, count], slot) => loot(ox - 4, CRYPT_Y0, oz, slot, item, count));

  for (const [wx, wz] of [
    [ox - 3, oz - 3],
    [ox + 3, oz - 3],
    [ox - 3, oz + 3],
    [ox + 3, oz + 3],
    [ox, oz - 3],
  ]) {
    set(wx, CRYPT_Y1, wz, "minecraft:web");
  }
  for (const [lx, lz] of [
    [ox - 2, oz - 2],
    [ox + 2, oz - 2],
    [ox - 2, oz + 2],
    [ox + 2, oz + 2],
  ]) {
    set(lx, CRYPT_Y1, lz, 'minecraft:soul_lantern ["hanging"=true]');
  }
  fill(ox, CRYPT_Y0, oz - 1, ox, CRYPT_Y0, oz + 1, "minecraft:bone_block");

  // ---- 9. old trees in the corners --------------------------------------
  for (const [tx, tz] of [
    [ox - 10, oz + 9],
    [ox + 10, oz + 9],
    [ox - 10, oz - 9],
    [ox + 10, oz - 9],
  ]) {
    fill(tx, oy, tz, tx, oy + 5, tz, "minecraft:spruce_log");
    fill(tx - 1, oy + 3, tz - 1, tx + 1, oy + 5, tz + 1, 'minecraft:spruce_leaves ["persistent_bit"=true]');
    set(tx, oy + 6, tz, 'minecraft:spruce_leaves ["persistent_bit"=true]');
    fill(tx, oy, tz, tx, oy + 5, tz, "minecraft:spruce_log");
  }

  return {
    cmds,
    gate: { x: ox + 0.5, y: oy, z: Z0 - 2.5 },
  };
}

/* ------------------------------------------------------------------ */
/* Gravedigger's Shovel                                                */
/* ------------------------------------------------------------------ */
function buildGraveyard(player) {
  const dim = player.dimension;
  const ox = Math.floor(player.location.x);
  const oy = Math.floor(player.location.y);
  const oz = Math.floor(player.location.z);

  const plan = planGraveyard(ox, oy, oz);
  const total = plan.cmds.length;
  let index = 0;
  let failed = 0;

  safe(() => player.sendMessage("§8Digging the qabristan... §7(" + total + " steps)"));
  safe(() => player.playSound("dig.gravel", { location: player.location }));

  const runner = system.runInterval(() => {
    for (let i = 0; i < COMMANDS_PER_TICK && index < total; i++, index++) {
      try {
        dim.runCommand(plan.cmds[index]);
      } catch (e) {
        failed++;
      }
    }

    if (index < total) {
      safe(() =>
        player.onScreenDisplay.setActionBar("§8Digging graves... §7" + Math.floor((index / total) * 100) + "%")
      );
      return;
    }

    system.clearRun(runner);
    if (!isValid(player)) return;

    rememberSite(player, { x: plan.gate.x, y: plan.gate.y, z: plan.gate.z });
    safe(() => player.teleport(plan.gate, { dimension: dim }));
    safe(() => player.playSound("ambient.cave", { location: player.location }));
    safe(() => player.onScreenDisplay.setActionBar("§8The qabristan is ready."));
    safe(() =>
      player.sendMessage(
        "§8✦ Qabristan complete.§r\n" +
          "§7Gate is in front of you. 24 graves, a tomb, and a crypt with buried treasure below it.\n" +
          "§7Stairs down are at the right side of the tomb.\n" +
          (failed ? "§8(" + failed + " of " + total + " steps were skipped by this version)" : "")
      )
    );
  }, 1);
}

/* ------------------------------------------------------------------ */
/* Cursed Lantern - wake the dead                                      */
/* ------------------------------------------------------------------ */
function summonUndead(player) {
  const dim = player.dimension;
  const center = player.location;

  const wave = [
    ["minecraft:zombie", 6],
    ["minecraft:skeleton", 4],
    ["minecraft:husk", 2],
  ];

  let spawned = 0;
  let slot = 0;
  const totalSlots = wave.reduce((sum, [, n]) => sum + n, 0);

  for (const [type, count] of wave) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * slot) / totalSlots;
      const radius = 7 + (slot % 3);
      const spot = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y,
        z: center.z + Math.sin(angle) * radius,
      };
      slot++;
      const mob = safe(() => dim.spawnEntity(type, spot));
      if (!mob) continue;
      spawned++;
      safe(() => mob.addEffect("fire_resistance", 20 * 600, { amplifier: 0, showParticles: false }));
      safe(() => mob.addEffect("strength", 20 * 600, { amplifier: 0, showParticles: false }));
      safe(() => dim.spawnParticle("minecraft:soul_particle", spot));
    }
  }

  // one named guardian leads the wave
  const guardian = safe(() =>
    dim.spawnEntity("minecraft:wither_skeleton", { x: center.x + 4, y: center.y, z: center.z + 4 })
  );
  if (guardian) {
    safe(() => (guardian.nameTag = GUARDIAN_NAME));
    safe(() => guardian.addEffect("health_boost", 20 * 900, { amplifier: 4, showParticles: false }));
    safe(() => guardian.addEffect("resistance", 20 * 900, { amplifier: 1, showParticles: false }));
    safe(() => guardian.addEffect("strength", 20 * 900, { amplifier: 1, showParticles: false }));
    safe(() => guardian.addEffect("fire_resistance", 20 * 900, { amplifier: 0, showParticles: false }));
    spawned++;
  }

  safe(() => player.playSound("mob.wither.spawn", { location: center }));
  safe(() => player.onScreenDisplay.setActionBar("§8The dead are awake... §7(" + spawned + ")"));
  safe(() => player.sendMessage("§8☠ §7The qabristan stirs. §f" + spawned + "§7 undead have risen."));
}

/* ------------------------------------------------------------------ */
/* Soul Bell - send them back                                          */
/* ------------------------------------------------------------------ */
function ringSoulBell(player) {
  const dim = player.dimension;
  const victims = undeadNear(dim, player.location, 24);

  for (const mob of victims) {
    safe(() => dim.spawnParticle("minecraft:soul_particle", mob.location));
    safe(() => dim.spawnParticle("minecraft:large_explosion", mob.location));
    safe(() => mob.applyDamage(200, { cause: "magic", damagingEntity: player }));
  }

  safe(() => player.addEffect("resistance", 20 * 20, { amplifier: 2, showParticles: false }));
  safe(() => player.addEffect("regeneration", 20 * 10, { amplifier: 1, showParticles: false }));
  safe(() => player.addEffect("night_vision", 20 * 120, { amplifier: 0, showParticles: false }));

  for (let i = 0; i < 24; i++) {
    const angle = (Math.PI * 2 * i) / 24;
    safe(() =>
      dim.spawnParticle("minecraft:soul_particle", {
        x: player.location.x + Math.cos(angle) * 4,
        y: player.location.y + 1,
        z: player.location.z + Math.sin(angle) * 4,
      })
    );
  }

  safe(() => player.playSound("block.bell.hit", { location: player.location }));
  safe(() => player.onScreenDisplay.setActionBar("§e🔔 §fSoul Bell §7- banished " + victims.length));
}

/* ------------------------------------------------------------------ */
/* Spirit Compass - find your graveyard, count what walks near you     */
/* ------------------------------------------------------------------ */
function useSpiritCompass(player) {
  const dim = player.dimension;
  const nearby = undeadNear(dim, player.location, 40).length;
  const site = recallSite(player);

  if (!site) {
    safe(() =>
      player.sendMessage("§7No qabristan remembered yet. Build one with the §fGravedigger's Shovel§7 first.")
    );
    safe(() => player.onScreenDisplay.setActionBar("§7Undead within 40 blocks: §f" + nearby));
    return;
  }

  safe(() => dim.spawnParticle("minecraft:soul_particle", player.location));
  safe(() => player.teleport({ x: site.x, y: site.y, z: site.z }, { dimension: dim }));
  safe(() => player.playSound("mob.endermen.portal", { location: player.location }));
  safe(() => player.onScreenDisplay.setActionBar("§8At the gate. §7Undead within 40 blocks: §f" + nearby));
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */
const ACTIONS = {
  [ITEM.SHOVEL]: buildGraveyard,
  [ITEM.LANTERN]: summonUndead,
  [ITEM.BELL]: ringSoulBell,
  [ITEM.COMPASS]: useSpiritCompass,
};

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;
  if (!player || !item) return;
  const action = ACTIONS[item.typeId];
  if (!action) return;
  try {
    action(player);
  } catch (e) {
    safe(() => player.sendMessage("§cQabristan error: §7" + e));
  }
});

/** The guardian leaves something behind for whoever puts it down. */
world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  if (!dead || safe(() => dead.nameTag) !== GUARDIAN_NAME) return;
  const killer = event.damageSource && event.damageSource.damagingEntity;
  if (!killer || killer.typeId !== "minecraft:player") return;
  for (const reward of ["minecraft:diamond 3", "minecraft:emerald 5", "minecraft:golden_apple 2", "minecraft:bone 16"]) {
    safe(() => killer.runCommand("give @s " + reward));
  }
  safe(() => killer.sendMessage("§8The §5Qabristan Guardian §8falls. §7Its grave goods are yours."));
});

function helpText() {
  return [
    "§8§l=== QABRISTAN ===§r",
    "§7Hold an item and use it (long press on mobile).",
    "§f⛏ Gravedigger's Shovel§7 - builds a whole walled graveyard around you",
    "§f🏮 Cursed Lantern§7 - wakes 13 undead, led by a named guardian",
    "§f🔔 Soul Bell§7 - banishes every undead within 24 blocks and shields you",
    "§f🧭 Spirit Compass§7 - takes you back to your graveyard gate",
    "§cThe shovel replaces the ground around you - use it on empty land.",
    "§7Get them all: §f/scriptevent qabr:give",
  ].join("\n");
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const id = event.id.toLowerCase();
  const source = event.sourceEntity;
  const targets = source && source.typeId === "minecraft:player" ? [source] : world.getAllPlayers();

  if (id === "qabr:give") {
    for (const player of targets) {
      for (const itemId of ALL_ITEMS) safe(() => player.runCommand("give @s " + itemId + " 1"));
      safe(() => player.sendMessage("§8✦ The keys to the qabristan are yours. ✦"));
    }
  }

  if (id === "qabr:build") {
    for (const player of targets) safe(() => buildGraveyard(player));
  }

  if (id === "qabr:help") {
    for (const player of targets) safe(() => player.sendMessage(helpText()));
  }
});

world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  safe(() => event.player.sendMessage(helpText()));
});
