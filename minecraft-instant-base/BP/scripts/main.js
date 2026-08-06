/**
 * Instant Base - Bedrock (mobile friendly) add-on
 *
 * Using the Base Blueprint builds a complete, finished starter base around you:
 * a 15x13 house with a stepped gable roof, a full workshop wall, a storage wall,
 * an enchanting corner, beds, a lit basement with a mine tunnel, a fenced yard
 * with a watered farm, and an animal pen with animals already in it.
 *
 * Target: Minecraft Bedrock 1.21.x, @minecraft/server 1.11.0 (stable, no experiment needed).
 */

import { world, system } from "@minecraft/server";

const BLUEPRINT = "base:blueprint";

/** Commands are run a few dozen per tick so phones never freeze mid-build. */
const COMMANDS_PER_TICK = 24;

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

/* ------------------------------------------------------------------ */
/* The blueprint itself                                                */
/* ------------------------------------------------------------------ */
function planBase(ox, oy, oz) {
  const cmds = [];

  const fill = (x1, y1, z1, x2, y2, z2, block, mode) =>
    cmds.push(`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${block}${mode ? " " + mode : ""}`);
  const set = (x, y, z, block) => cmds.push(`setblock ${x} ${y} ${z} ${block}`);
  const loot = (x, y, z, slot, item, count) =>
    cmds.push(`replaceitem block ${x} ${y} ${z} slot.container ${slot} ${item} ${count}`);

  // ---- reference points -------------------------------------------------
  const X0 = ox - 7;
  const X1 = ox + 7;
  const Z0 = oz - 6; // front wall (door side)
  const Z1 = oz + 6; // back wall
  const FY = oy - 1; // floor blocks
  const WY0 = oy; // first wall layer
  const WY1 = oy + 4; // last wall layer
  const CY = oy + 5; // ceiling / first roof tier

  const YARD_Z0 = Z0 - 9;
  const YARD_Z1 = Z0 - 1;

  const BASE_FLOOR = oy - 7; // basement floor blocks
  const BASE_Y0 = oy - 6; // basement air
  const BASE_Y1 = oy - 3;
  const BASE_CEIL = oy - 2;

  // ---- 1. clear the site and give it solid ground -----------------------
  fill(X0 - 1, FY + 1, YARD_Z0 - 1, X1 + 1, CY + 5, Z1 + 1, "minecraft:air");
  fill(X0 - 1, FY - 3, YARD_Z0 - 1, X1 + 1, FY, Z1 + 1, "minecraft:stone", "replace minecraft:air");
  fill(X0 - 1, FY, YARD_Z0 - 1, X1 + 1, FY, Z1 + 1, "minecraft:grass_block");

  // ---- 2. floors --------------------------------------------------------
  fill(X0, FY, Z0, X1, FY, Z1, "minecraft:stone_bricks");
  fill(X0 + 1, FY, Z0 + 1, X1 - 1, FY, Z1 - 1, "minecraft:oak_planks");
  // stone entry strip just inside the door
  fill(ox - 1, FY, Z0 + 1, ox + 1, FY, Z0 + 2, "minecraft:polished_andesite");

  // ---- 3. walls ---------------------------------------------------------
  fill(X0, WY0, Z0, X1, WY1, Z0, "minecraft:oak_planks");
  fill(X0, WY0, Z1, X1, WY1, Z1, "minecraft:oak_planks");
  fill(X0, WY0, Z0, X0, WY1, Z1, "minecraft:oak_planks");
  fill(X1, WY0, Z0, X1, WY1, Z1, "minecraft:oak_planks");
  fill(X0 + 1, WY0, Z0 + 1, X1 - 1, WY1, Z1 - 1, "minecraft:air");

  // corner posts and mid posts
  for (const [px, pz] of [
    [X0, Z0],
    [X1, Z0],
    [X0, Z1],
    [X1, Z1],
    [ox - 3, Z0],
    [ox + 3, Z0],
    [ox - 3, Z1],
    [ox + 3, Z1],
    [X0, oz - 2],
    [X0, oz + 2],
    [X1, oz - 2],
    [X1, oz + 2],
  ]) {
    fill(px, WY0, pz, px, WY1, pz, "minecraft:stripped_dark_oak_log");
  }
  // top plate all around
  fill(X0, WY1, Z0, X1, WY1, Z0, "minecraft:spruce_planks");
  fill(X0, WY1, Z1, X1, WY1, Z1, "minecraft:spruce_planks");
  fill(X0, WY1, Z0, X0, WY1, Z1, "minecraft:spruce_planks");
  fill(X1, WY1, Z0, X1, WY1, Z1, "minecraft:spruce_planks");

  // ---- 4. windows -------------------------------------------------------
  const window = (x1, y1, z1, x2, y2, z2) => fill(x1, y1, z1, x2, y2, z2, "minecraft:glass_pane");
  window(ox - 5, WY0 + 1, Z0, ox - 4, WY0 + 2, Z0);
  window(ox + 4, WY0 + 1, Z0, ox + 5, WY0 + 2, Z0);
  window(ox - 5, WY0 + 1, Z1, ox - 4, WY0 + 2, Z1);
  window(ox + 4, WY0 + 1, Z1, ox + 5, WY0 + 2, Z1);
  window(X0, WY0 + 1, oz - 4, X0, WY0 + 2, oz - 3);
  window(X0, WY0 + 1, oz + 3, X0, WY0 + 2, oz + 4);
  window(X1, WY0 + 1, oz - 4, X1, WY0 + 2, oz - 3);
  window(X1, WY0 + 1, oz + 3, X1, WY0 + 2, oz + 4);

  // ---- 5. door and porch ------------------------------------------------
  set(ox, WY0, Z0, 'minecraft:oak_door ["direction"=1,"door_hinge_bit"=false,"open_bit"=false,"upper_block_bit"=false]');
  set(ox, WY0 + 1, Z0, 'minecraft:oak_door ["direction"=1,"door_hinge_bit"=false,"open_bit"=false,"upper_block_bit"=true]');
  fill(ox - 1, FY, Z0 - 1, ox + 1, FY, Z0 - 1, "minecraft:polished_andesite");
  set(ox - 1, WY0, Z0 - 1, "minecraft:lantern");
  set(ox + 1, WY0, Z0 - 1, "minecraft:lantern");

  // ---- 6. stepped gable roof (no direction states, so it always looks right)
  fill(X0 - 1, CY, Z0 - 1, X1 + 1, CY, Z1 + 1, "minecraft:dark_oak_planks");
  fill(X0, CY + 1, Z0 + 2, X1, CY + 1, Z1 - 2, "minecraft:dark_oak_planks");
  fill(X0, CY + 2, Z0 + 4, X1, CY + 2, Z1 - 4, "minecraft:dark_oak_planks");
  fill(X0, CY + 3, oz, X1, CY + 3, oz, "minecraft:dark_oak_slab");
  // slab edging softens each step
  fill(X0, CY + 1, Z0 + 1, X1, CY + 1, Z0 + 1, "minecraft:dark_oak_slab");
  fill(X0, CY + 1, Z1 - 1, X1, CY + 1, Z1 - 1, "minecraft:dark_oak_slab");
  fill(X0, CY + 2, Z0 + 3, X1, CY + 2, Z0 + 3, "minecraft:dark_oak_slab");
  fill(X0, CY + 2, Z1 - 3, X1, CY + 2, Z1 - 3, "minecraft:dark_oak_slab");
  fill(X0, CY + 3, Z0 + 5, X1, CY + 3, Z0 + 5, "minecraft:dark_oak_slab");
  fill(X0, CY + 3, Z1 - 5, X1, CY + 3, Z1 - 5, "minecraft:dark_oak_slab");

  // ---- 7. workshop wall (east side) -------------------------------------
  const workshop = [
    "minecraft:crafting_table",
    "minecraft:furnace",
    "minecraft:furnace",
    "minecraft:blast_furnace",
    "minecraft:smoker",
    "minecraft:stonecutter",
    "minecraft:anvil",
    "minecraft:grindstone",
    "minecraft:cartography_table",
  ];
  workshop.forEach((block, i) => set(X1 - 1, WY0, oz - 4 + i, block));

  // ---- 8. storage wall (west side) --------------------------------------
  for (let i = 0; i < 8; i++) set(X0 + 1, WY0, oz - 4 + i, "minecraft:chest");
  set(X0 + 1, WY0, oz + 4, "minecraft:barrel");

  // starter kit in the first chest
  const kit = [
    ["minecraft:bread", 32],
    ["minecraft:torch", 64],
    ["minecraft:oak_log", 32],
    ["minecraft:cobblestone", 64],
    ["minecraft:iron_pickaxe", 1],
    ["minecraft:iron_axe", 1],
    ["minecraft:iron_shovel", 1],
    ["minecraft:iron_sword", 1],
    ["minecraft:water_bucket", 1],
    ["minecraft:bed", 2],
    ["minecraft:coal", 32],
    ["minecraft:wheat_seeds", 16],
  ];
  kit.forEach(([item, count], slot) => loot(X0 + 1, WY0, oz - 4, slot, item, count));

  // ---- 9. enchanting and brewing corner (back left) ---------------------
  set(ox - 4, WY0, Z1 - 1, "minecraft:enchanting_table");
  const shelves = [
    [ox - 6, Z1 - 1],
    [ox - 6, Z1 - 2],
    [ox - 5, Z1 - 3],
    [ox - 4, Z1 - 3],
    [ox - 3, Z1 - 3],
    [ox - 2, Z1 - 2],
    [ox - 2, Z1 - 1],
  ];
  for (const [bx, bz] of shelves) {
    set(bx, WY0, bz, "minecraft:bookshelf");
    set(bx, WY0 + 1, bz, "minecraft:bookshelf");
  }
  set(ox - 1, WY0, Z1 - 1, "minecraft:brewing_stand");
  set(ox, WY0, Z1 - 1, "minecraft:cauldron");

  // ---- 10. bedroom (back right) -----------------------------------------
  set(ox + 3, WY0, Z1 - 1, 'minecraft:bed ["direction"=0,"head_piece_bit"=true,"occupied_bit"=false]');
  set(ox + 3, WY0, Z1 - 2, 'minecraft:bed ["direction"=0,"head_piece_bit"=false,"occupied_bit"=false]');
  set(ox + 5, WY0, Z1 - 1, 'minecraft:bed ["direction"=0,"head_piece_bit"=true,"occupied_bit"=false]');
  set(ox + 5, WY0, Z1 - 2, 'minecraft:bed ["direction"=0,"head_piece_bit"=false,"occupied_bit"=false]');
  set(ox + 4, WY0, Z1 - 1, "minecraft:oak_fence");
  set(ox + 4, WY0 + 1, Z1 - 1, "minecraft:lantern");

  // ---- 11. kitchen corner (front right) ---------------------------------
  set(ox + 4, WY0, Z0 + 1, "minecraft:composter");
  set(ox + 5, WY0, Z0 + 1, "minecraft:barrel");
  set(ox + 3, WY0, Z0 + 1, "minecraft:campfire");
  // small table
  set(ox - 4, WY0, Z0 + 2, "minecraft:oak_fence");
  set(ox - 4, WY0 + 1, Z0 + 2, "minecraft:oak_pressure_plate");
  set(ox - 5, WY0, Z0 + 2, "minecraft:oak_stairs");
  set(ox - 3, WY0, Z0 + 2, "minecraft:oak_stairs");

  // ---- 12. interior lighting (hanging lanterns keep every corner mob free)
  for (const [lx, lz] of [
    [ox - 4, oz - 3],
    [ox + 4, oz - 3],
    [ox - 4, oz + 3],
    [ox + 4, oz + 3],
    [ox, oz],
  ]) {
    set(lx, WY1, lz, 'minecraft:lantern ["hanging"=true]');
  }

  // ---- 13. basement + mine tunnel ---------------------------------------
  // The room shell is built first, then the staircase is carved through it.
  fill(ox - 4, BASE_Y0, oz - 3, ox + 4, BASE_Y1, oz + 3, "minecraft:air");
  fill(ox - 5, BASE_FLOOR, oz - 4, ox + 5, BASE_FLOOR, oz + 4, "minecraft:stone_bricks");
  fill(ox - 5, BASE_CEIL, oz - 4, ox + 5, BASE_CEIL, oz + 4, "minecraft:stone_bricks");
  fill(ox - 5, BASE_Y0, oz - 4, ox - 5, BASE_Y1, oz + 4, "minecraft:stone_bricks");
  fill(ox + 5, BASE_Y0, oz - 4, ox + 5, BASE_Y1, oz + 4, "minecraft:stone_bricks");
  fill(ox - 5, BASE_Y0, oz - 4, ox + 5, BASE_Y1, oz - 4, "minecraft:stone_bricks");
  fill(ox - 5, BASE_Y0, oz + 4, ox + 5, BASE_Y1, oz + 4, "minecraft:stone_bricks");

  // stepped staircase down along the east side of the room
  for (let i = 0; i <= 6; i++) {
    const sz = oz - 4 + i;
    const sy = FY - i;
    set(ox + 5, sy, sz, "minecraft:stone_bricks");
    fill(ox + 5, sy + 1, sz, ox + 5, sy + 3, sz, "minecraft:air");
  }
  // doorway from the bottom of the stairs into the room
  fill(ox + 4, BASE_Y0, oz + 2, ox + 5, BASE_Y0 + 1, oz + 2, "minecraft:air");
  // basement storage and light (kept off the tunnel doorway)
  for (let i = 0; i < 5; i++) set(ox - 3 + i, BASE_Y0, oz - 3, "minecraft:chest");
  for (let i = 0; i < 3; i++) set(ox - 3 + i, BASE_Y0, oz + 3, "minecraft:barrel");
  set(ox + 3, BASE_Y0, oz - 3, "minecraft:furnace");
  set(ox + 3, BASE_Y0, oz + 3, "minecraft:crafting_table");
  for (const [lx, lz] of [
    [ox - 2, oz - 2],
    [ox + 2, oz - 2],
    [ox - 2, oz + 2],
    [ox + 2, oz + 2],
    [ox, oz],
  ]) {
    set(lx, BASE_Y1, lz, 'minecraft:lantern ["hanging"=true]');
  }
  // a lit 3x3 tunnel heading west, ready to mine from
  fill(ox - 14, BASE_Y0, oz - 1, ox - 6, BASE_Y0 + 2, oz + 1, "minecraft:air");
  fill(ox - 14, BASE_FLOOR, oz - 1, ox - 6, BASE_FLOOR, oz + 1, "minecraft:stone_bricks");
  // opening through the basement wall into the tunnel
  fill(ox - 5, BASE_Y0, oz - 1, ox - 5, BASE_Y0 + 1, oz + 1, "minecraft:air");
  for (let i = 0; i < 3; i++) set(ox - 8 - i * 3, BASE_Y0 + 2, oz, 'minecraft:lantern ["hanging"=true]');

  // ---- 14. yard, fence and path -----------------------------------------
  fill(X0, WY0, YARD_Z0, X1, WY0, YARD_Z0, "minecraft:oak_fence");
  fill(X0, WY0, YARD_Z0, X0, WY0, YARD_Z1, "minecraft:oak_fence");
  fill(X1, WY0, YARD_Z0, X1, WY0, YARD_Z1, "minecraft:oak_fence");
  set(ox, WY0, YARD_Z0, "minecraft:oak_fence_gate");
  fill(ox, FY, YARD_Z0, ox, FY, Z0 - 1, "minecraft:gravel");
  for (const fx of [X0, X1, ox - 4, ox + 4]) set(fx, WY0 + 1, YARD_Z0, "minecraft:lantern");
  for (const fz of [YARD_Z0 + 3, YARD_Z0 + 6]) {
    set(X0, WY0 + 1, fz, "minecraft:lantern");
    set(X1, WY0 + 1, fz, "minecraft:lantern");
  }

  // ---- 15. farm (west half of the yard) ---------------------------------
  fill(ox - 6, FY, YARD_Z0 + 1, ox - 2, FY, YARD_Z1 - 1, 'minecraft:farmland ["moisturized_amount"=7]');
  set(ox - 4, FY, YARD_Z0 + 4, "minecraft:water");
  const rows = [
    ['minecraft:wheat ["growth"=7]', YARD_Z0 + 1],
    ['minecraft:carrots ["growth"=7]', YARD_Z0 + 2],
    ['minecraft:potatoes ["growth"=7]', YARD_Z0 + 3],
    ['minecraft:wheat ["growth"=7]', YARD_Z0 + 5],
    ['minecraft:beetroot ["growth"=7]', YARD_Z0 + 6],
    ['minecraft:carrots ["growth"=7]', YARD_Z0 + 7],
  ];
  for (const [crop, cz] of rows) fill(ox - 6, WY0, cz, ox - 2, WY0, cz, crop);

  // ---- 16. animal pen (east half of the yard) ---------------------------
  fill(ox + 2, WY0, YARD_Z0 + 1, ox + 6, WY0, YARD_Z0 + 1, "minecraft:oak_fence");
  fill(ox + 2, WY0, YARD_Z1 - 1, ox + 6, WY0, YARD_Z1 - 1, "minecraft:oak_fence");
  fill(ox + 2, WY0, YARD_Z0 + 1, ox + 2, WY0, YARD_Z1 - 1, "minecraft:oak_fence");
  fill(ox + 6, WY0, YARD_Z0 + 1, ox + 6, WY0, YARD_Z1 - 1, "minecraft:oak_fence");
  set(ox + 4, WY0, YARD_Z1 - 1, "minecraft:oak_fence_gate");
  set(ox + 4, WY0, YARD_Z0 + 4, "minecraft:water");

  return {
    cmds,
    penCenter: { x: ox + 4, y: oy, z: (YARD_Z0 + YARD_Z1) / 2 },
    doorFront: { x: ox + 0.5, y: oy, z: Z0 - 1.5 },
    spawn: { x: ox + 4, y: oy, z: Z1 - 2 },
  };
}

/* ------------------------------------------------------------------ */
/* Runner - a few commands per tick so the game never stutters          */
/* ------------------------------------------------------------------ */
function buildBase(player) {
  const dim = player.dimension;
  const ox = Math.floor(player.location.x);
  const oy = Math.floor(player.location.y);
  const oz = Math.floor(player.location.z);

  const plan = planBase(ox, oy, oz);
  const total = plan.cmds.length;
  let index = 0;
  let failed = 0;

  safe(() => player.sendMessage("§6Building your base... §7(" + total + " steps)"));
  safe(() => player.playSound("random.anvil_use", { location: player.location }));

  const runner = system.runInterval(() => {
    for (let i = 0; i < COMMANDS_PER_TICK && index < total; i++, index++) {
      try {
        dim.runCommand(plan.cmds[index]);
      } catch (e) {
        failed++;
      }
    }

    if (index < total) {
      const percent = Math.floor((index / total) * 100);
      safe(() => player.onScreenDisplay.setActionBar("§6Building base... §e" + percent + "%"));
      return;
    }

    system.clearRun(runner);

    // Animals for the pen.
    for (const [type, count] of [
      ["minecraft:cow", 2],
      ["minecraft:sheep", 2],
      ["minecraft:chicken", 2],
    ]) {
      for (let i = 0; i < count; i++) {
        safe(() =>
          dim.spawnEntity(type, {
            x: plan.penCenter.x + (i - 0.5),
            y: plan.penCenter.y,
            z: plan.penCenter.z,
          })
        );
      }
    }

    if (isValid(player)) {
      safe(() => player.teleport(plan.doorFront, { dimension: dim }));
      safe(() => player.setSpawnPoint({ x: plan.spawn.x, y: plan.spawn.y, z: plan.spawn.z, dimension: dim }));
      safe(() => player.playSound("random.levelup", { location: player.location }));
      safe(() => player.onScreenDisplay.setActionBar("§aYour base is ready!"));
      safe(() =>
        player.sendMessage(
          "§a✔ Base complete!§r\n" +
            "§7Front door is right in front of you. Your world spawn is now this house.\n" +
            "§7Starter kit is in the first chest on the left wall.\n" +
            (failed ? "§8(" + failed + " of " + total + " steps were skipped by this version)" : "")
        )
      );
    }
  }, 1);
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */
world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;
  if (!player || !item || item.typeId !== BLUEPRINT) return;
  try {
    buildBase(player);
  } catch (e) {
    safe(() => player.sendMessage("§cBuild failed: §7" + e));
  }
});

function helpText() {
  return [
    "§6§l=== INSTANT BASE ===§r",
    "§7Stand where you want the base, hold the §fBase Blueprint§7 and use it",
    "§7(long press on mobile). Everything is built around you.",
    "§7You get: house, workshop wall, storage wall, enchanting corner, beds,",
    "§7basement + mine tunnel, fenced yard, watered farm and an animal pen.",
    "§cIt replaces the terrain around you - do not use it on top of a build.",
    "§7Get a blueprint: §f/scriptevent base:give",
    "§7Build without the item: §f/scriptevent base:build",
  ].join("\n");
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const id = event.id.toLowerCase();
  const source = event.sourceEntity;
  const targets = source && source.typeId === "minecraft:player" ? [source] : world.getAllPlayers();

  if (id === "base:give") {
    for (const player of targets) {
      safe(() => player.runCommand("give @s " + BLUEPRINT + " 1"));
      safe(() => player.sendMessage("§6✦ Base Blueprint received. Use it where you want your base. ✦"));
    }
  }

  if (id === "base:build") {
    for (const player of targets) safe(() => buildBase(player));
  }

  if (id === "base:help") {
    for (const player of targets) safe(() => player.sendMessage(helpText()));
  }
});

world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  safe(() => event.player.sendMessage(helpText()));
});
