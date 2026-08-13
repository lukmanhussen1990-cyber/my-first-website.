#!/usr/bin/env python3
"""Generates the Mycelium-X luxury tech mansion as Bedrock .mcfunction files.

Run: python3 tools/gen_mansion.py

Output: src/behavior_pack/functions/mansion/
    part_00.mcfunction .. part_NN.mcfunction   build order, <=180 commands each
    clear.mcfunction                           fills the whole build volume with air
    _index.json                                parts / count / anchors / seals / bounds

------------------------------------------------------------------------------
COORDINATES
------------------------------------------------------------------------------
Every emitted command uses RELATIVE coordinates only (`~x ~y ~z`). The caller
runs `execute positioned <x> <y> <z> run function mansion/part_NN`, so ~ ~ ~ is
the mansion origin.

Origin = centre of the ground-floor entrance portal, at ground-floor FLOOR LEVEL.
    +X east, +Z south, +Y up.
The entrance portal is on the mansion's south face, so the house body occupies
negative Z and the grounds (driveway, garden, pool, garage) occupy positive Z.

------------------------------------------------------------------------------
BEDROCK 1.21.0 CORRECTNESS NOTES  (verified, not guessed)
------------------------------------------------------------------------------
* Block identifiers: every `minecraft:` id used here is checked at generation
  time against VERIFIED_BLOCKS below, which was cross-checked against the
  Microsoft Learn Block enum AND against the Bedrock flattening timeline so
  that nothing flattened *after* 1.21.0 sneaks in.

  Specifically confirmed as valid in 1.21.0:
    - wool / carpet / concrete / stained_glass / stained_glass_pane / planks /
      leaves / wooden slabs / logs  -> all flattened by 1.20.70, so the split
      identifiers (white_concrete, dark_oak_slab, ...) are correct here.
    - short_grass + fern            (split from `tallgrass`  in 1.21.0.20)
    - tall_grass / large_fern / rose_bush / peony / lilac / sunflower
                                    (split from `double_plant` in 1.21.0.22)
    - smooth_stone_slab / cobblestone_slab / stone_brick_slab / quartz_slab
                                    (split from `stone_block_slab` in 1.21.0.23)

  Deliberately AVOIDED because they were only flattened AFTER 1.21.0 and so do
  not exist in the target build:
    - poppy / dandelion / allium / oxeye_daisy / blue_orchid / cornflower
      (the `red_flower` / `yellow_flower` split is not in the 1.21.0 changelog).
      The garden uses rose_bush / peony / lilac / sunflower / azalea /
      pink_petals instead, which ARE 1.21.0-valid.
    - `stone_block_slab2/3/4` members: smooth_quartz_slab, polished_andesite_slab,
      mossy_cobblestone_slab, end_stone_brick_slab, purpur_slab, prismarine_slab.
      Only the slab1 family was split in 1.21.0.

* `minecraft:barrier` EXISTS in Bedrock 1.21.0 and is used for the invisible
  pool-edge kerb and the hidden-door frames.
* `minecraft:light_block` is NOT used. The `light_block_0..15` split identifiers
  post-date 1.21.0, and the pre-split form needs a data value; real light
  sources (sea_lantern / glowstone / lantern / end_rod / shroomlight /
  copper_bulb / redstone_lamp) cover every case here.

* Block states use Bedrock syntax `["state":value]` - never Java `[facing=north]`.
  State names and value ranges taken from the Microsoft Learn block-state table:
      direction        0-3   0=South 1=West 2=North 3=East
      facing_direction 0-5   0=Down 1=Up 2=North 3=South 4=West 5=East
      weirdo_direction 0-3   stair rotation
      upside_down_bit / open_bit / upper_block_bit / door_hinge_bit / hanging
      persistent_bit / update_bit / head_piece_bit / fill_level / cauldron_liquid
  SLABS are always placed bottom-half with NO block state. The top-half state is
  ambiguous between the legacy `top_slot_bit` and the newer
  `minecraft:vertical_half` on the 1.21.0 line, so this generator simply never
  needs it - bottom is the default and is unambiguous.

* `fill` volume limit is 32768; fill() splits any larger box automatically.
* No /clone, no /structure, no command blocks, no entities, no spawners.

------------------------------------------------------------------------------
LOCKDOWN CONTRACT (consumed by scripts/main.js)
------------------------------------------------------------------------------
`seals` in _index.json lists the envelope openings the lockdown system fills
solid and clears back to air. Every seal volume is carved by seal_opening(),
which is the ONLY way a seal gets registered - so the recorded volume is exactly
the air gap by construction. verify() then re-scans every emitted command and
fails the build if anything non-air is ever placed inside a seal volume, which
guarantees unlock (fill -> air) can never destroy a door, a pane or furniture.

`minecraft:redstone_lamp` is reserved for script-swappable EMERGENCY lighting
(-> myc:emergency_light on lockdown). Decorative always-on light uses
sea_lantern / glowstone / lantern / soul_lantern / end_rod / shroomlight /
copper_bulb so that nothing turns red that should not.
"""

from __future__ import annotations

import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "behavior_pack" / "functions" / "mansion"

MAX_CMDS_PER_PART = 180

# Bedrock's own per-fill cap is 32768, but that is far too much to hand a phone
# in a single tick once lighting and chunk updates are counted. Cap a single
# fill well under it, and cap the total blocks a part may touch, so every tick
# of the build costs roughly the same bounded amount of work.
MAX_FILL_VOLUME = 8192
MAX_BLOCKS_PER_PART = 12000

# Build envelope, as offsets from origin. clear.mcfunction clears exactly this,
# and _index.json["bounds"] reports exactly this.
BOUNDS_FROM = (-40, -30, -40)
BOUNDS_TO = (40, 34, 40)


# ============================================================== palette =====
# Structure
DEEP = "minecraft:polished_deepslate"
DEEP_S = "minecraft:polished_deepslate_stairs"
DEEP_SL = "minecraft:polished_deepslate_slab"
TILE = "minecraft:deepslate_tiles"
TILE_S = "minecraft:deepslate_tile_stairs"
TILE_SL = "minecraft:deepslate_tile_slab"
DBRICK = "minecraft:deepslate_bricks"
BLACKST = "minecraft:polished_blackstone"
BLACKST_S = "minecraft:polished_blackstone_stairs"
BLACKST_SL = "minecraft:polished_blackstone_slab"
BLACKST_W = "minecraft:polished_blackstone_wall"

# Cladding / walls
WHITE = "minecraft:white_concrete"
LGREY = "minecraft:light_gray_concrete"
GREY = "minecraft:gray_concrete"
BLACK = "minecraft:black_concrete"
CYAN = "minecraft:cyan_concrete"
BLUE = "minecraft:blue_concrete"
RED = "minecraft:red_concrete"
LIME = "minecraft:lime_concrete"
ORANGE = "minecraft:orange_concrete"
YELLOW_MARK = "minecraft:yellow_concrete"

# Floors
QUARTZ = "minecraft:quartz_block"
QUARTZ_S = "minecraft:quartz_stairs"
QUARTZ_SL = "minecraft:quartz_slab"
SMOOTHQ = "minecraft:smooth_quartz"
QBRICK = "minecraft:quartz_bricks"
QPILLAR = 'minecraft:quartz_block["chisel_type":"lines"]'  # no quartz_pillar id in 1.21.0
CHISQ = "minecraft:chiseled_quartz_block"
SSTONE = "minecraft:smooth_stone"
SSTONE_SL = "minecraft:smooth_stone_slab"
SBRICK = "minecraft:stone_bricks"
SBRICK_S = "minecraft:stone_brick_stairs"
SBRICK_SL = "minecraft:stone_brick_slab"
CALCITE = "minecraft:calcite"
TUFF = "minecraft:polished_tuff"

# Metal / hard tech
IRON = "minecraft:iron_block"
NETHERITE = "minecraft:netherite_block"
OBSIDIAN = "minecraft:obsidian"
COPPER = "minecraft:copper_block"
CUTCOPPER = "minecraft:waxed_cut_copper"
CUTCOPPER_S = "minecraft:cut_copper_stairs"
CUTCOPPER_SL = "minecraft:cut_copper_slab"
REINF = "minecraft:reinforced_deepslate"
AMETHYST = "minecraft:amethyst_block"

# Glass
GLASS = "minecraft:glass"
TINTED = "minecraft:tinted_glass"
GLASS_LB = "minecraft:light_blue_stained_glass"
GLASS_GY = "minecraft:gray_stained_glass"
GLASS_BK = "minecraft:black_stained_glass"
GLASS_CY = "minecraft:cyan_stained_glass"
GLASS_WH = "minecraft:white_stained_glass"
GLASS_RD = "minecraft:red_stained_glass"
GLASS_LM = "minecraft:lime_stained_glass"
PANE = "minecraft:glass_pane"
PANE_GY = "minecraft:gray_stained_glass_pane"
PANE_BK = "minecraft:black_stained_glass_pane"
PANE_LG = "minecraft:light_gray_stained_glass_pane"
PANE_LB = "minecraft:light_blue_stained_glass_pane"
PANE_CY = "minecraft:cyan_stained_glass_pane"

# Wood
WOOD = "minecraft:dark_oak_planks"
WOOD_S = "minecraft:dark_oak_stairs"
WOOD_SL = "minecraft:dark_oak_slab"
WOOD_TD = "minecraft:dark_oak_trapdoor"
WOOD_DOOR = "minecraft:dark_oak_door"
WOOD_FENCE = "minecraft:dark_oak_fence"
LOG = "minecraft:dark_oak_log"
STRIPPED = "minecraft:stripped_dark_oak_log"
WARP = "minecraft:warped_planks"
WARP_S = "minecraft:warped_stairs"
WARP_SL = "minecraft:warped_slab"
WARP_TD = "minecraft:warped_trapdoor"
WARP_DOOR = "minecraft:warped_door"
BAMBOO = "minecraft:bamboo_planks"

# Soft
W_WHITE = "minecraft:white_wool"
W_LGREY = "minecraft:light_gray_wool"
W_GREY = "minecraft:gray_wool"
W_BLACK = "minecraft:black_wool"
W_RED = "minecraft:red_wool"
W_CYAN = "minecraft:cyan_wool"
W_BLUE = "minecraft:blue_wool"
C_WHITE = "minecraft:white_carpet"
C_GREY = "minecraft:gray_carpet"
C_LGREY = "minecraft:light_gray_carpet"
C_RED = "minecraft:red_carpet"
C_BLACK = "minecraft:black_carpet"
C_BLUE = "minecraft:blue_carpet"

# Light  (redstone_lamp is RESERVED for script-swappable emergency lighting)
LAMP = "minecraft:redstone_lamp"          # -> myc:emergency_light on lockdown
SEALANT = "minecraft:sea_lantern"
GLOW = "minecraft:glowstone"
LANTERN = "minecraft:lantern"
SOULLANT = "minecraft:soul_lantern"
SHROOM = "minecraft:shroomlight"
ENDROD = "minecraft:end_rod"
BULB = "minecraft:copper_bulb"

# Fittings
CHEST = "minecraft:chest"
BARREL = "minecraft:barrel"
BREW = "minecraft:brewing_stand"
CAULDRON = "minecraft:cauldron"
CRAFT = "minecraft:crafting_table"
SHELF = "minecraft:bookshelf"
CHISHELF = "minecraft:chiseled_bookshelf"
LADDER = "minecraft:ladder"
ANVIL = "minecraft:anvil"
BLAST = "minecraft:blast_furnace"
SMOKER = "minecraft:smoker"
FURNACE = "minecraft:furnace"
CARTO = "minecraft:cartography_table"
LECTERN = "minecraft:lectern"
POT = "minecraft:flower_pot"
CUTTER = "minecraft:stonecutter_block"
HOPPER = "minecraft:hopper"
OBSERVER = "minecraft:observer"
DAYLIGHT = "minecraft:daylight_detector"
TARGET = "minecraft:target"
COMPOSTER = "minecraft:composter"
BEACON = "minecraft:beacon"
BARS = "minecraft:iron_bars"
CHAIN = "minecraft:chain"
SCAFF = "minecraft:scaffolding"
DPOT = "minecraft:decorated_pot"
TRAPCHEST = "minecraft:trapped_chest"
ENDERCHEST = "minecraft:ender_chest"
JUKEBOX = "minecraft:jukebox"
NOTEBLOCK = "minecraft:noteblock"
IRON_DOOR = "minecraft:iron_door"
IRON_TD = "minecraft:iron_trapdoor"
OAK_TD = "minecraft:trapdoor"
BUTTON = "minecraft:stone_button"
LEVER = "minecraft:lever"
SPONGE = "minecraft:sponge"
KELP = "minecraft:dried_kelp_block"
BARRIER = "minecraft:barrier"
WATER = "minecraft:water"

# Terrain / garden
GRASS = "minecraft:grass_block"
DIRT = "minecraft:dirt"
PODZOL = "minecraft:podzol"
COARSE = 'minecraft:dirt["dirt_type":"coarse"]'  # no coarse_dirt id in 1.21.0
SAND = "minecraft:sand"
GRAVEL = "minecraft:gravel"
PATH = "minecraft:grass_path"
STONE = "minecraft:stone"
COBBLE = "minecraft:cobblestone"
LEAF = "minecraft:oak_leaves"
LEAF_AZ = "minecraft:azalea_leaves"
LEAF_SP = "minecraft:spruce_leaves"
AZALEA = "minecraft:azalea"
AZALEA_F = "minecraft:flowering_azalea"
MOSS = "minecraft:moss_block"
MOSS_C = "minecraft:moss_carpet"
PETALS = "minecraft:pink_petals"
SGRASS = "minecraft:short_grass"
FERN = "minecraft:fern"
TGRASS = "minecraft:tall_grass"
ROSE = "minecraft:rose_bush"
PEONY = "minecraft:peony"
LILAC = "minecraft:lilac"
SUNFLOWER = "minecraft:sunflower"
OAK_LOG = "minecraft:oak_log"
SPRUCE_LOG = "minecraft:spruce_log"
AIR = "minecraft:air"

# Custom blocks authored in parallel. Plain full cubes, no block states.
ALARM = "myc:alarm_light"        # -> myc:alarm_light_on during lockdown
PANEL = "myc:control_panel"
SCREEN = "myc:screen"
RACK = "myc:server_rack"
LABPANEL = "myc:lab_panel"
CLEAN = "myc:clean_panel"

CUSTOM_BLOCKS = {ALARM, PANEL, SCREEN, RACK, LABPANEL, CLEAN}

# Every minecraft: identifier confirmed to exist in Bedrock 1.21.0 (see header).
VERIFIED_BLOCKS = {
    "minecraft:air", "minecraft:stone", "minecraft:cobblestone", "minecraft:grass_block",
    "minecraft:dirt", "minecraft:podzol", "minecraft:sand",
    "minecraft:gravel", "minecraft:grass_path", "minecraft:polished_deepslate",
    "minecraft:polished_deepslate_stairs", "minecraft:polished_deepslate_slab",
    "minecraft:deepslate_tiles", "minecraft:deepslate_tile_stairs",
    "minecraft:deepslate_tile_slab", "minecraft:deepslate_bricks",
    "minecraft:deepslate_brick_stairs", "minecraft:cobbled_deepslate",
    "minecraft:cobbled_deepslate_wall", "minecraft:polished_blackstone",
    "minecraft:polished_blackstone_stairs", "minecraft:polished_blackstone_slab",
    "minecraft:polished_blackstone_wall", "minecraft:blackstone",
    "minecraft:white_concrete", "minecraft:light_gray_concrete", "minecraft:gray_concrete",
    "minecraft:black_concrete", "minecraft:cyan_concrete", "minecraft:blue_concrete",
    "minecraft:red_concrete", "minecraft:lime_concrete", "minecraft:orange_concrete",
    "minecraft:green_concrete", "minecraft:yellow_concrete", "minecraft:quartz_block",
    "minecraft:quartz_stairs", "minecraft:quartz_slab", "minecraft:smooth_quartz",
    "minecraft:smooth_quartz_stairs", "minecraft:chiseled_quartz_block",
    "minecraft:quartz_bricks", "minecraft:smooth_stone",
    "minecraft:smooth_stone_slab", "minecraft:stone_bricks", "minecraft:stone_brick_stairs",
    "minecraft:stone_brick_slab", "minecraft:iron_block", "minecraft:netherite_block",
    "minecraft:obsidian", "minecraft:crying_obsidian", "minecraft:reinforced_deepslate",
    "minecraft:copper_block", "minecraft:waxed_cut_copper", "minecraft:cut_copper_stairs",
    "minecraft:cut_copper_slab", "minecraft:copper_bulb", "minecraft:amethyst_block",
    "minecraft:calcite", "minecraft:tuff", "minecraft:polished_tuff", "minecraft:prismarine",
    "minecraft:dark_prismarine", "minecraft:prismarine_bricks", "minecraft:white_terracotta",
    "minecraft:gray_terracotta", "minecraft:black_terracotta", "minecraft:cyan_terracotta",
    "minecraft:light_gray_terracotta", "minecraft:glass", "minecraft:tinted_glass",
    "minecraft:white_stained_glass", "minecraft:light_blue_stained_glass",
    "minecraft:gray_stained_glass", "minecraft:black_stained_glass",
    "minecraft:cyan_stained_glass", "minecraft:blue_stained_glass",
    "minecraft:red_stained_glass", "minecraft:lime_stained_glass", "minecraft:glass_pane",
    "minecraft:white_stained_glass_pane", "minecraft:gray_stained_glass_pane",
    "minecraft:black_stained_glass_pane", "minecraft:light_gray_stained_glass_pane",
    "minecraft:light_blue_stained_glass_pane", "minecraft:cyan_stained_glass_pane",
    "minecraft:dark_oak_planks", "minecraft:dark_oak_stairs", "minecraft:dark_oak_slab",
    "minecraft:dark_oak_trapdoor", "minecraft:dark_oak_door", "minecraft:dark_oak_fence",
    "minecraft:dark_oak_log", "minecraft:stripped_dark_oak_log", "minecraft:warped_planks",
    "minecraft:warped_stairs", "minecraft:warped_slab", "minecraft:warped_trapdoor",
    "minecraft:warped_door", "minecraft:crimson_planks", "minecraft:bamboo_planks",
    "minecraft:bamboo_mosaic", "minecraft:white_wool", "minecraft:light_gray_wool",
    "minecraft:gray_wool", "minecraft:black_wool", "minecraft:red_wool",
    "minecraft:cyan_wool", "minecraft:blue_wool", "minecraft:white_carpet",
    "minecraft:gray_carpet", "minecraft:light_gray_carpet", "minecraft:red_carpet",
    "minecraft:black_carpet", "minecraft:blue_carpet", "minecraft:sea_lantern",
    "minecraft:glowstone", "minecraft:redstone_lamp", "minecraft:lantern",
    "minecraft:soul_lantern", "minecraft:shroomlight", "minecraft:end_rod",
    "minecraft:chest", "minecraft:barrel", "minecraft:brewing_stand", "minecraft:cauldron",
    "minecraft:crafting_table", "minecraft:bookshelf", "minecraft:chiseled_bookshelf",
    "minecraft:ladder", "minecraft:anvil", "minecraft:blast_furnace", "minecraft:smoker",
    "minecraft:furnace", "minecraft:cartography_table", "minecraft:lectern",
    "minecraft:flower_pot", "minecraft:stonecutter_block", "minecraft:hopper",
    "minecraft:observer", "minecraft:daylight_detector", "minecraft:target",
    "minecraft:composter", "minecraft:beacon", "minecraft:iron_bars", "minecraft:chain",
    "minecraft:scaffolding", "minecraft:decorated_pot", "minecraft:trapped_chest",
    "minecraft:ender_chest", "minecraft:jukebox", "minecraft:noteblock",
    "minecraft:iron_door", "minecraft:iron_trapdoor", "minecraft:trapdoor",
    "minecraft:stone_button", "minecraft:lever", "minecraft:sponge",
    "minecraft:dried_kelp_block", "minecraft:soul_sand", "minecraft:magma",
    "minecraft:water", "minecraft:flowing_water", "minecraft:barrier",
    "minecraft:oak_leaves", "minecraft:azalea_leaves", "minecraft:spruce_leaves",
    "minecraft:azalea", "minecraft:flowering_azalea", "minecraft:moss_block",
    "minecraft:moss_carpet", "minecraft:pink_petals", "minecraft:short_grass",
    "minecraft:fern", "minecraft:tall_grass", "minecraft:large_fern",
    "minecraft:rose_bush", "minecraft:peony", "minecraft:lilac", "minecraft:sunflower",
    "minecraft:oak_log", "minecraft:spruce_log", "minecraft:dripstone_block",
    "minecraft:oak_stairs", "minecraft:spruce_stairs",
}

# Stair rotation (weirdo_direction). Value = the direction the stair faces,
# i.e. the way a player sitting on it looks.
ST_E, ST_W, ST_S, ST_N = 0, 1, 2, 3
# direction state (doors, trapdoors)
DIR_S, DIR_W, DIR_N, DIR_E = 0, 1, 2, 3
# facing_direction state
FD_DOWN, FD_UP, FD_N, FD_S, FD_W, FD_E = 0, 1, 2, 3, 4, 5

# In 1.21.0 chests, furnaces and anvils orient with the string state
# `minecraft:cardinal_direction`; only some blocks still use the integer
# `facing_direction`. Verified against Mojang's 1.21.0 block metadata.
_CARDINAL = {FD_N: "north", FD_S: "south", FD_W: "west", FD_E: "east"}


def card(fd: int) -> str:
    return f'["minecraft:cardinal_direction":"{_CARDINAL[fd]}"]'



# ============================================================= geometry =====
# Mansion shell
MX1, MX2 = -19, 19          # outer wall x
MZ1, MZ2 = -27, 0           # outer wall z (z=0 is the entrance/front wall)
IX1, IX2 = MX1 + 1, MX2 - 1  # interior x
IZ1, IZ2 = MZ1 + 1, MZ2 - 1  # interior z

GF, GF_CEIL = -1, 7          # ground floor slab y, its ceiling y
F1, F1_CEIL = 7, 15
F2, F2_CEIL = 15, 23
ROOF = 23
PARAPET = 27

BAS_FLOOR, BAS_CEIL = -10, -3    # basement
BX1, BX2, BZ1, BZ2 = -17, 17, -25, -2

BUN_FLOOR, BUN_CEIL = -22, -15   # bunker
KX1, KX2, KZ1, KZ2 = -14, 14, -20, -4

TUN_FLOOR, TUN_CEIL = -21, -17   # escape tunnel
TUN_X1, TUN_X2 = -11, -9
TUN_Z_START, TUN_Z_END = -4, 34

GAR_X1, GAR_X2, GAR_Z1, GAR_Z2 = -38, -20, 6, 22   # garage
POOL_X1, POOL_X2, POOL_Z1, POOL_Z2 = 20, 38, 4, 26  # pool terrace

rng = random.Random(20240621)


# ============================================================== emitter =====
class Gen:
    """Collects commands plus a structured record of every block placement.

    The structured ops let verify() prove that no seal volume ever receives a
    non-air block after it is carved, which is what makes the lockdown
    fill-solid / fill-air cycle safe.
    """

    def __init__(self) -> None:
        self.sections: list[tuple[str, list[str]]] = []
        self.cur: list[str] | None = None
        self.ops: list[dict] = []
        self.anchors: dict[str, list[int]] = {}
        self.seals: list[dict] = []
        self.used_blocks: set[str] = set()

    # -- structure ---------------------------------------------------------
    def section(self, name: str) -> None:
        self.cur = []
        self.sections.append((name, self.cur))
        self.cur.append(f"# --- {name} ---")

    def note(self, text: str) -> None:
        self.cur.append(f"# {text}")

    def anchor(self, name: str, x: int, y: int, z: int) -> None:
        self.anchors[name] = [int(x), int(y), int(z)]

    # -- primitives --------------------------------------------------------
    def _check(self, block: str) -> None:
        # A few constants carry their block state inline, because 1.21.0 has no
        # flattened identifier for them (coarse dirt, quartz pillar). Check the
        # bare identifier.
        identifier = block.split("[", 1)[0]
        self.used_blocks.add(identifier)
        if identifier.startswith("minecraft:"):
            if identifier not in VERIFIED_BLOCKS:
                raise SystemExit(f"UNVERIFIED BLOCK IDENTIFIER: {identifier}")
        elif identifier not in CUSTOM_BLOCKS:
            raise SystemExit(f"UNKNOWN BLOCK IDENTIFIER: {identifier}")

    def _record(self, block: str, box: tuple[int, int, int, int, int, int]) -> None:
        self.ops.append({"block": block, "box": box, "i": len(self.ops)})

    def setb(self, x: int, y: int, z: int, block: str, states: str = "") -> None:
        self._check(block)
        self._record(block, (x, y, z, x, y, z))
        self.cur.append(f"setblock {rc(x)} {rc(y)} {rc(z)} {block}{states}")

    def fill(self, x1, y1, z1, x2, y2, z2, block: str, states: str = "") -> None:
        """fill with automatic splitting below Bedrock's 32768-block limit."""
        self._check(block)
        x1, x2 = min(x1, x2), max(x1, x2)
        y1, y2 = min(y1, y2), max(y1, y2)
        z1, z2 = min(z1, z2), max(z1, z2)
        self._record(block, (x1, y1, z1, x2, y2, z2))
        for a, b, c, d, e, f in split_box(x1, y1, z1, x2, y2, z2):
            self.cur.append(
                f"fill {rc(a)} {rc(b)} {rc(c)} {rc(d)} {rc(e)} {rc(f)} {block}{states}"
            )

    # -- seals -------------------------------------------------------------
    def seal_opening(self, name: str, x1, y1, z1, x2, y2, z2) -> None:
        """Carve an envelope opening to pure air and register it as a seal.

        This is the only path that registers a seal, so a seal volume is by
        construction exactly the air gap of a real opening.
        """
        self.fill(x1, y1, z1, x2, y2, z2, AIR)
        self.seals.append(
            {
                "name": name,
                "from": [min(x1, x2), min(y1, y2), min(z1, z2)],
                "to": [max(x1, x2), max(y1, y2), max(z1, z2)],
            }
        )


def rc(v: int) -> str:
    """Relative coordinate. Always ~-prefixed, never absolute."""
    return "~" if v == 0 else f"~{v}"


def command_volume(line: str) -> int:
    """Blocks a single emitted command touches, for the per-tick budget."""
    parts = line.split()
    if not parts:
        return 0
    if parts[0] == "setblock":
        return 1
    if parts[0] == "fill" and len(parts) >= 7:
        try:
            coords = []
            for token in parts[1:7]:
                token = token[1:] or "0" if token.startswith("~") else token
                coords.append(int(float(token)))
        except ValueError:
            return 1
        span = 1
        for i in range(3):
            span *= abs(coords[i + 3] - coords[i]) + 1
        return span
    return 1


def split_box(x1, y1, z1, x2, y2, z2):
    dx, dy, dz = x2 - x1 + 1, y2 - y1 + 1, z2 - z1 + 1
    if dx * dy * dz <= MAX_FILL_VOLUME:
        yield (x1, y1, z1, x2, y2, z2)
        return
    if dx >= dy and dx >= dz:
        m = (x1 + x2) // 2
        yield from split_box(x1, y1, z1, m, y2, z2)
        yield from split_box(m + 1, y1, z1, x2, y2, z2)
    elif dy >= dz:
        m = (y1 + y2) // 2
        yield from split_box(x1, y1, z1, x2, m, z2)
        yield from split_box(x1, m + 1, z1, x2, y2, z2)
    else:
        m = (z1 + z2) // 2
        yield from split_box(x1, y1, z1, x2, y2, m)
        yield from split_box(x1, y1, m + 1, x2, y2, z2)


g = Gen()


# ======================================================= shape helpers =====
def box(x1, y1, z1, x2, y2, z2, block, states=""):
    g.fill(x1, y1, z1, x2, y2, z2, block, states)


def hollow_box(x1, y1, z1, x2, y2, z2, block, states=""):
    """Six faces as explicit fills - never relies on fill's `hollow` keyword,
    whose argument position is ambiguous alongside block states in Bedrock."""
    g.fill(x1, y1, z1, x2, y1, z2, block, states)   # floor
    g.fill(x1, y2, z1, x2, y2, z2, block, states)   # ceiling
    g.fill(x1, y1, z1, x2, y2, z1, block, states)   # -z wall
    g.fill(x1, y1, z2, x2, y2, z2, block, states)   # +z wall
    g.fill(x1, y1, z1, x1, y2, z2, block, states)   # -x wall
    g.fill(x2, y1, z1, x2, y2, z2, block, states)   # +x wall


def walls(x1, y1, z1, x2, y2, z2, block, states=""):
    """Four vertical walls only, no floor or ceiling."""
    g.fill(x1, y1, z1, x2, y2, z1, block, states)
    g.fill(x1, y1, z2, x2, y2, z2, block, states)
    g.fill(x1, y1, z1, x1, y2, z2, block, states)
    g.fill(x2, y1, z1, x2, y2, z2, block, states)


def room(x1, z1, x2, z2, floor_y, ceil_y, wall, floor_b, ceil_b=None):
    """Interior partition: floor plate, ceiling plate and four walls."""
    g.fill(x1, floor_y, z1, x2, floor_y, z2, floor_b)
    g.fill(x1, ceil_y, z1, x2, ceil_y, z2, ceil_b or floor_b)
    walls(x1, floor_y + 1, z1, x2, ceil_y - 1, z2, wall)


def doorway(x1, y, z1, x2, z2, height=3):
    """Interior opening. NOT a seal - lockdown does not touch interior doors."""
    g.fill(x1, y, z1, x2, y + height - 1, z2, AIR)


def door(x, y, z, block, facing=DIR_N, hinge=False):
    g.setb(x, y, z, block,
           f'["direction":{facing},"door_hinge_bit":{str(hinge).lower()},'
           f'"open_bit":false,"upper_block_bit":false]')
    g.setb(x, y + 1, z, block,
           f'["direction":{facing},"door_hinge_bit":{str(hinge).lower()},'
           f'"open_bit":false,"upper_block_bit":true]')


def stair(x, y, z, block, facing=ST_N, upside=False):
    g.setb(x, y, z, block,
           f'["weirdo_direction":{facing},"upside_down_bit":{str(upside).lower()}]')


def stair_run(x, y, z, block, facing, count, axis="z", step=-1):
    """Rising flight of stairs; each tread climbs one block."""
    for i in range(count):
        if axis == "z":
            stair(x, y + i, z + step * i, block, facing)
        else:
            stair(x + step * i, y, z, block, facing)


def staircase(x1, x2, y, z, block, facing, count, step=-1):
    """Wide feature flight: a stair_run repeated across its width."""
    for x in range(x1, x2 + 1):
        stair_run(x, y, z, block, facing, count, "z", step)


def window_wall(x1, y1, z1, x2, y2, z2, glass=GLASS, mullion=BLACKST, spacing=4):
    """Curtain wall: full glass panel with vertical mullions at `spacing`."""
    g.fill(x1, y1, z1, x2, y2, z2, glass)
    if x1 == x2:                       # wall runs along z
        for z in range(z1, z2 + 1):
            if (z - z1) % spacing == 0:
                g.fill(x1, y1, z, x1, y2, z, mullion)
    else:                              # wall runs along x
        for x in range(x1, x2 + 1):
            if (x - x1) % spacing == 0:
                g.fill(x, y1, z1, x, y2, z1, mullion)


def railing(x1, y, z1, x2, z2, post=BLACKST_W, pane=PANE):
    """Glass balustrade: pane infill with posts at the corners and midpoints."""
    if x1 == x2:
        g.fill(x1, y, z1, x1, y, z2, pane)
        for z in (z1, z2, (z1 + z2) // 2):
            g.setb(x1, y, z, post)
    else:
        g.fill(x1, y, z1, x2, y, z1, pane)
        for x in (x1, x2, (x1 + x2) // 2):
            g.setb(x, y, z1, post)


def pillar(x, y1, z, y2, block=QPILLAR, cap=BLACKST_SL):
    g.fill(x, y1, z, x, y2, z, block)
    g.setb(x, y2 + 1, z, cap)


def desk(x1, y, z, x2, top=QUARTZ_SL, leg=BLACKST):
    """Worksurface: slab top on a solid plinth."""
    g.fill(x1, y, z, x2, y, z, leg)
    g.fill(x1, y + 1, z, x2, y + 1, z, top)


def counter(x1, y, z1, x2, z2, body=WARP, top=QUARTZ_SL):
    g.fill(x1, y, z1, x2, y, z2, body)
    g.fill(x1, y + 1, z1, x2, y + 1, z2, top)


def monitor_wall(x1, y1, z, x2, y2, frame=BLACK):
    """Grid of myc:screen inside a bezel."""
    g.fill(x1 - 1, y1 - 1, z, x2 + 1, y2 + 1, z, frame)
    g.fill(x1, y1, z, x2, y2, z, SCREEN)


def seating_row(x1, y, z, x2, facing, block=WOOD_S, arms=None):
    """Stair run used as a sofa/bench, with optional wool arms at each end."""
    for x in range(x1, x2 + 1):
        stair(x, y, z, block, facing)
    if arms:
        g.setb(x1 - 1, y, z, arms)
        g.setb(x2 + 1, y, z, arms)


def table(x1, y, z1, x2, z2, top=QUARTZ_SL, leg=WOOD_FENCE):
    for x in (x1, x2):
        for z in (z1, z2):
            g.setb(x, y, z, leg)
    g.fill(x1, y + 1, z1, x2, y + 1, z2, top)


def planter(x, y, z, soil=PODZOL, plant=AZALEA_F, kerb=CALCITE):
    g.setb(x, y, z, kerb)
    g.setb(x, y + 1, z, soil)
    g.setb(x, y + 2, z, plant)


def tree(x, y, z, trunk=OAK_LOG, leaves=LEAF, height=5, radius=2):
    lv = '["persistent_bit":true,"update_bit":false]'
    g.fill(x, y, z, x, y + height - 1, z, trunk)
    top = y + height
    g.fill(x - radius, top - 2, z - radius, x + radius, top - 1, z + radius, leaves, lv)
    g.fill(x - 1, top, z - 1, x + 1, top, z + 1, leaves, lv)
    g.setb(x, top + 1, z, leaves, lv)


def hedge(x1, y, z1, x2, z2, block=LEAF_AZ):
    g.fill(x1, y, z1, x2, y + 1, z2, block,
           '["persistent_bit":true,"update_bit":false]')


def light_strip(x1, y, z1, x2, z2, block=SEALANT, spacing=3):
    """Recessed ceiling lights at intervals - not a solid glowing plane."""
    if x1 == x2:
        for z in range(z1, z2 + 1, spacing):
            g.setb(x1, y, z, block)
    else:
        for x in range(x1, x2 + 1, spacing):
            g.setb(x, y, z1, block)


def server_row(x, y, z1, z2):
    for z in range(z1, z2 + 1):
        g.fill(x, y, z, x, y + 2, z, RACK)
    g.setb(x, y + 3, z1, PANE_BK)
    g.setb(x, y + 3, z2, PANE_BK)


def locker(x, y, z, facing=FD_S):
    g.fill(x, y, z, x, y + 1, z, IRON)
    g.setb(x, y + 2, z, BARREL, f'["facing_direction":{FD_UP},"open_bit":false]')


def bed_unit(x, y, z, length=3, headboard=WOOD, sheet=W_WHITE, pillow=W_LGREY):
    """Beds are built from blocks - `minecraft:bed` is a block entity and is
    unreliable via setblock, and the brief asks for block-built furniture."""
    g.fill(x, y, z, x + 1, y, z - length + 1, sheet)
    g.fill(x, y, z, x + 1, y, z, pillow)
    g.fill(x, y + 1, z + 1, x + 1, y + 1, z + 1, headboard)
    g.fill(x, y, z + 1, x + 1, y, z + 1, headboard)


def rug(x1, y, z1, x2, z2, block=C_GREY):
    g.fill(x1, y, z1, x2, y, z2, block)


def alarm(x, y, z):
    g.setb(x, y, z, ALARM)


# ======================================================================
# PART 00 - site clear and terrain
# ======================================================================
def sec_site():
    g.section("00 site clear + terrain pad")
    g.note("Clear the working envelope, then lay ground.")
    box(-40, -30, -40, 40, 34, 40, AIR)
    box(-40, -6, -40, 40, -3, 40, STONE)
    box(-40, -2, -40, 40, -2, 40, DIRT)
    box(-40, -1, -40, 40, -1, 40, GRASS)
    g.note("Landscaped mounding and texture in the outer garden band.")
    for _ in range(60):
        x = rng.randint(-39, 39)
        z = rng.randint(2, 39)
        if -20 <= x <= 20 and z < 6:
            continue
        g.setb(x, -1, z, rng.choice([PODZOL, COARSE, MOSS, GRASS]))
    g.anchor("entrance", 0, 0, 0)


# ======================================================================
# PART - foundation, basement and bunker excavation
# ======================================================================
def sec_foundation():
    g.section("01 foundation + substructure excavation")
    box(MX1 - 1, GF - 2, MZ1 - 1, MX2 + 1, GF, MZ2 + 1, DEEP)
    g.note("Basement void")
    box(BX1, BAS_FLOOR, BZ1, BX2, BAS_CEIL, BZ2, DEEP)
    box(BX1 + 1, BAS_FLOOR + 1, BZ1 + 1, BX2 - 1, BAS_CEIL - 1, BZ2 - 1, AIR)
    g.note("Bunker void, deeper and armoured")
    box(KX1 - 1, BUN_FLOOR - 1, KZ1 - 1, KX2 + 1, BUN_CEIL + 1, KZ2 + 1, REINF)
    box(KX1, BUN_FLOOR, KZ1, KX2, BUN_CEIL, KZ2, DEEP)
    box(KX1 + 1, BUN_FLOOR + 1, KZ1 + 1, KX2 - 1, BUN_CEIL - 1, KZ2 - 1, AIR)
    g.note("Basement and bunker floor finishes")
    box(BX1 + 1, BAS_FLOOR, BZ1 + 1, BX2 - 1, BAS_FLOOR, BZ2 - 1, TILE)
    box(KX1 + 1, BUN_FLOOR, KZ1 + 1, KX2 - 1, BUN_FLOOR, KZ2 - 1, TILE)


# ======================================================================
# PART - ground floor shell
# ======================================================================
def sec_shell_ground():
    g.section("02 ground floor shell")
    box(MX1, GF, MZ1, MX2, GF, MZ2, QUARTZ)
    walls(MX1, GF + 1, MZ1, MX2, GF_CEIL - 1, MZ2, WHITE)
    box(MX1, GF_CEIL, MZ1, MX2, GF_CEIL, MZ2, DEEP)
    g.note("Corner piers")
    for x in (MX1, MX2):
        for z in (MZ1, MZ2):
            pillar(x, GF + 1, z, GF_CEIL - 1, QPILLAR)
    g.note("Main entrance portal - PURE AIR, registered as a lockdown seal")
    g.seal_opening("entrance", -4, 0, 0, 4, 5, 0)
    g.note("Entrance reveal and threshold")
    box(-5, 0, 0, -5, 5, 0, BLACKST)
    box(5, 0, 0, 5, 5, 0, BLACKST)
    box(-4, GF, 0, 4, GF, 0, TILE)
    box(-4, 6, 0, 4, 6, 0, CLEAN)


def sec_shell_glazing():
    g.section("03 ground floor curtain walls")
    g.note("West and east elevations - full-height glazing between piers")
    window_wall(MX1, 1, -24, MX1, 5, -3, GLASS_LB, BLACKST, 4)
    window_wall(MX2, 1, -24, MX2, 5, -3, GLASS_LB, BLACKST, 4)
    g.note("North (rear) elevation glazing, split by the garden door")
    window_wall(-17, 1, MZ1, -4, 5, MZ1, GLASS_LB, BLACKST, 4)
    window_wall(4, 1, MZ1, 17, 5, MZ1, GLASS_LB, BLACKST, 4)
    g.note("Garden door opening - PURE AIR, seal")
    g.seal_opening("garden_door", -3, 0, MZ1, 3, 4, MZ1)
    box(-4, 0, MZ1, -4, 4, MZ1, BLACKST)
    box(4, 0, MZ1, 4, 4, MZ1, BLACKST)
    g.note("Front elevation glazing either side of the entrance")
    window_wall(-17, 1, 0, -6, 5, 0, GLASS_LB, BLACKST, 4)
    window_wall(6, 1, 0, 17, 5, 0, GLASS_LB, BLACKST, 4)
    g.note("Pool-side door on the east elevation - PURE AIR, seal")
    g.seal_opening("pool_door", MX2, 0, -8, MX2, 4, -4)
    box(MX2, 0, -9, MX2, 4, -9, BLACKST)
    box(MX2, 0, -3, MX2, 4, -3, BLACKST)


# ======================================================================
# PART - upper floor shells
# ======================================================================
def sec_shell_upper():
    g.section("04 first floor shell")
    box(MX1, F1, MZ1, MX2, F1, MZ2, WOOD)
    walls(MX1, F1 + 1, MZ1, MX2, F1_CEIL - 1, MZ2, WHITE)
    box(MX1, F1_CEIL, MZ1, MX2, F1_CEIL, MZ2, DEEP)
    window_wall(MX1, F1 + 2, -24, MX1, F1 + 5, -3, GLASS_LB, BLACKST, 4)
    window_wall(MX2, F1 + 2, -24, MX2, F1 + 5, -3, GLASS_LB, BLACKST, 4)
    window_wall(-17, F1 + 2, MZ1, 17, F1 + 5, MZ1, GLASS_LB, BLACKST, 4)
    window_wall(-17, F1 + 2, 0, -6, F1 + 5, 0, GLASS_LB, BLACKST, 4)
    window_wall(6, F1 + 2, 0, 17, F1 + 5, 0, GLASS_LB, BLACKST, 4)
    g.note("Balcony doors onto the front terrace (interior, not sealed)")
    doorway(-4, F1 + 1, 0, 4, 0, 4)

    g.section("05 second floor shell")
    box(MX1, F2, MZ1, MX2, F2, MZ2, WOOD)
    walls(MX1, F2 + 1, MZ1, MX2, F2_CEIL - 1, MZ2, WHITE)
    box(MX1, F2_CEIL, MZ1, MX2, F2_CEIL, MZ2, DEEP)
    window_wall(MX1, F2 + 2, -24, MX1, F2 + 5, -3, GLASS_GY, BLACKST, 4)
    window_wall(MX2, F2 + 2, -24, MX2, F2 + 5, -3, GLASS_GY, BLACKST, 4)
    window_wall(-17, F2 + 2, MZ1, 17, F2 + 5, MZ1, GLASS_GY, BLACKST, 4)
    window_wall(-17, F2 + 2, 0, 17, F2 + 5, 0, GLASS_GY, BLACKST, 4)


def sec_roof():
    g.section("06 roof deck + parapet")
    box(MX1, ROOF, MZ1, MX2, ROOF, MZ2, SSTONE)
    box(MX1 + 2, ROOF, MZ1 + 2, MX2 - 2, ROOF, MZ2 - 2, TILE)
    walls(MX1, ROOF + 1, MZ1, MX2, ROOF + 1, MZ2, BLACKST)
    g.note("Glass parapet above the solid upstand")
    for x in range(MX1, MX2 + 1, 2):
        g.fill(x, ROOF + 2, MZ1, x, ROOF + 3, MZ1, PANE_LG)
        g.fill(x, ROOF + 2, MZ2, x, ROOF + 3, MZ2, PANE_LG)
    for z in range(MZ1, MZ2 + 1, 2):
        g.fill(MX1, ROOF + 2, z, MX1, ROOF + 3, z, PANE_LG)
        g.fill(MX2, ROOF + 2, z, MX2, ROOF + 3, z, PANE_LG)
    g.note("Plant room / stair head")
    hollow_box(-4, ROOF + 1, -26, 4, ROOF + 4, -20, LGREY)
    doorway(-1, ROOF + 1, -20, 1, -20, 3)


# ======================================================================
# GROUND FLOOR INTERIOR
# ======================================================================
def sec_hall():
    g.section("07 entrance hall + feature staircase")
    g.note("Double-height hall: cut the first floor away over the hall")
    box(-6, F1, -12, 6, F1, -1, AIR)
    box(-6, GF, -12, 6, GF, -1, TILE)
    for x in (-7, 7):
        pillar(x, 1, -2, F1_CEIL - 1, QPILLAR)
        pillar(x, 1, -11, F1_CEIL - 1, QPILLAR)
    g.note("Feature staircase, ground -> first, three flights wide")
    staircase(-3, 3, 1, -4, QUARTZ_S, ST_N, 7, -1)
    box(-3, 0, -11, 3, 0, -5, DEEP)
    box(-3, 8, -12, 3, 8, -11, WOOD)
    railing(-4, 9, -12, -4, -5, BLACKST_W, PANE)
    railing(4, 9, -12, 4, -5, BLACKST_W, PANE)
    g.note("Hall dressing")
    rug(-3, 0, -2, 3, -3, C_RED)
    table(-2, 0, -3, 2, -3, QUARTZ_SL, WOOD_FENCE)
    for z in (-3, -6, -9):
        g.setb(-6, 3, z, ENDROD, f'["facing_direction":{FD_E}]')
        g.setb(6, 3, z, ENDROD, f'["facing_direction":{FD_W}]')
    monitor_wall(-5, 2, -12, -2, 4, BLACK)
    g.setb(-6, 1, -12, PANEL)
    light_strip(-5, F1_CEIL - 1, -11, 5, -11, SEALANT, 3)
    light_strip(-5, 6, -2, 5, -2, LAMP, 4)
    alarm(-5, 4, -1)
    alarm(5, 4, -1)


def sec_living():
    g.section("08 double-height living room")
    g.note("Void over the living room")
    box(IX1, F1, -14, -8, F1, -1, AIR)
    box(IX1, GF, -14, -8, GF, -1, WOOD)
    rug(-16, 0, -10, -10, -4, C_GREY)
    g.note("Sunken lounge seating - L-shaped sofa from stairs")
    seating_row(-16, 0, -11, -10, ST_S, WOOD_S, W_GREY)
    seating_row(-16, 0, -3, -10, ST_N, WOOD_S, W_GREY)
    for z in range(-10, -3):
        stair(-17, 0, z, WOOD_S, ST_E)
    table(-14, 0, -8, -12, -6, QUARTZ_SL, WOOD_FENCE)
    g.note("Media wall")
    monitor_wall(-16, 2, -14, -10, 5, BLACK)
    box(-17, 1, -14, -9, 1, -14, BLACKST_SL)
    g.setb(-17, 2, -14, PANEL)
    g.note("Feature fireplace band and shelving")
    box(-18, 1, -6, -18, 3, -4, CLEAN)
    for y in (1, 2, 3):
        g.setb(-18, y, -12, SHELF)
        g.setb(-18, y, -11, CHISHELF)
    g.note("Double-height lighting")
    light_strip(-16, F1_CEIL - 1, -13, -10, -13, SEALANT, 2)
    for z in (-12, -8, -4):
        g.setb(-9, 9, z, LANTERN, '["hanging":true]')
        g.setb(-15, 9, z, LANTERN, '["hanging":true]')
    light_strip(-16, 6, -12, -10, -12, LAMP, 3)
    alarm(-17, 4, -2)


def sec_kitchen():
    g.section("09 designer kitchen + dining")
    box(8, GF, -20, IX2, GF, -1, CALCITE)
    g.note("Perimeter run")
    counter(8, 0, -3, 17, -3, WARP, QUARTZ_SL)
    counter(17, 0, -3, 17, -10, WARP, QUARTZ_SL)
    g.setb(12, 0, -3, BLAST, card(FD_S))
    g.setb(13, 0, -3, SMOKER, card(FD_S))
    g.setb(17, 0, -6, FURNACE, card(FD_W))
    g.setb(9, 1, -3, CAULDRON, '["cauldron_liquid":"water","fill_level":6]')
    for x in range(10, 17, 2):
        g.setb(x, 1, -3, PANE_LG)
    g.note("Island with breakfast bar")
    counter(10, 0, -7, 15, -6, BLACKST, QUARTZ_SL)
    for x in range(10, 16):
        stair(x, 0, -8, WOOD_S, ST_N)
    g.setb(11, 1, -7, HOPPER)
    g.setb(14, 1, -6, CRAFT)
    g.note("Tall units and pantry")
    for x in range(8, 12):
        g.fill(x, 0, -2, x, 3, -2, WARP)
    g.setb(8, 0, -4, BARREL, f'["facing_direction":{FD_S},"open_bit":false]')
    g.setb(9, 0, -4, CHEST, card(FD_S))
    g.note("Dining area")
    table(10, 0, -16, 15, -13, QUARTZ_SL, WOOD_FENCE)
    for x in range(10, 16):
        stair(x, 0, -17, WOOD_S, ST_N)
        stair(x, 0, -12, WOOD_S, ST_S)
    rug(9, 0, -18, 16, -11, C_LGREY)
    g.setb(12, 1, -14, POT)
    g.setb(13, 1, -15, DPOT)
    light_strip(9, 6, -16, 16, -16, SEALANT, 3)
    light_strip(9, 6, -5, 16, -5, LAMP, 4)
    for z in (-14, -15):
        g.setb(12, 5, z, LANTERN, '["hanging":true]')
    alarm(17, 4, -2)


def sec_ground_misc():
    g.section("10 guest bathroom + utility")
    room(-18, -21, -12, -16, GF, GF_CEIL, LGREY, TILE)
    doorway(-14, 1, -16, -13, -16, 3)
    door(-14, 1, -16, WOOD_DOOR, DIR_N)
    g.note("Sanitary ware from blocks")
    g.setb(-17, 0, -20, CAULDRON, '["cauldron_liquid":"water","fill_level":6]')
    g.setb(-17, 1, -18, QUARTZ_SL)
    g.setb(-16, 1, -18, PANE_LG)
    stair(-13, 0, -20, QUARTZ_S, ST_W)
    g.setb(-13, 1, -20, OAK_TD, f'["direction":{DIR_W},"open_bit":false,"upside_down_bit":false]')
    box(-15, 0, -20, -14, 2, -20, GLASS_WH)
    g.setb(-17, 3, -19, SEALANT)
    g.setb(-14, 4, -17, LAMP)
    g.note("Utility / plant room")
    room(-18, -25, -13, -22, GF, GF_CEIL, LGREY, TILE)
    doorway(-16, 1, -22, -15, -22, 3)
    for x in range(-17, -13):
        g.setb(x, 0, -24, BARREL, f'["facing_direction":{FD_UP},"open_bit":false]')
    g.setb(-17, 0, -23, CHEST, card(FD_S))
    g.setb(-15, 1, -24, PANEL)
    alarm(-15, 4, -22)
    g.note("Rear hall linking garden door to the main hall")
    box(-3, GF, -26, 3, GF, -13, TILE)
    light_strip(-2, 6, -25, 2, -25, LAMP, 3)
    alarm(0, 4, -25)


# ======================================================================
# FIRST FLOOR
# ======================================================================
def sec_master():
    g.section("11 master bedroom + wardrobe + en-suite")
    g.anchor("master_bedroom", -11, F1 + 1, -8)
    box(IX1, F1, -13, -8, F1, -1, WOOD)
    walls(IX1 - 1, F1 + 1, -13, -7, F1_CEIL - 1, -1, WHITE)
    doorway(-7, F1 + 1, -6, -7, -4, 3)
    g.note("Bed platform and headboard")
    box(-15, F1, -10, -10, F1, -5, W_LGREY)
    bed_unit(-13, F1 + 1, -6, 4, WOOD, W_WHITE, W_LGREY)
    box(-14, F1 + 1, -3, -11, F1 + 3, -3, CLEAN)
    for x in (-14, -11):
        g.setb(x, F1 + 2, -4, LANTERN, '["hanging":false]')
    g.note("Seating and media")
    seating_row(-17, F1 + 1, -11, -13, ST_S, WOOD_S, W_GREY)
    monitor_wall(-16, F1 + 3, -13, -12, F1 + 5, BLACK)
    table(-17, F1 + 1, -8, -16, -7, QUARTZ_SL, WOOD_FENCE)
    rug(-16, F1, -9, -11, -4, C_GREY)
    g.note("Walk-in wardrobe")
    room(-18, -19, -13, -14, F1, F1_CEIL, LGREY, WOOD)
    doorway(-15, F1 + 1, -13, -14, -13, 3)
    for z in range(-18, -14):
        g.fill(-17, F1 + 1, z, -17, F1 + 3, z, WARP)
        g.setb(-16, F1 + 1, z, BARREL, f'["facing_direction":{FD_E},"open_bit":false]')
    g.setb(-14, F1 + 2, -18, SEALANT)
    g.note("En-suite")
    room(-12, -19, -8, -14, F1, F1_CEIL, LGREY, TILE)
    doorway(-10, F1 + 1, -13, -9, -13, 3)
    g.setb(-11, F1 + 1, -18, CAULDRON, '["cauldron_liquid":"water","fill_level":6]')
    box(-10, F1 + 1, -18, -9, F1 + 1, -17, QUARTZ_SL)
    box(-12, F1 + 1, -16, -12, F1 + 3, -15, GLASS_WH)
    stair(-9, F1 + 1, -15, QUARTZ_S, ST_W)
    g.setb(-10, F1 + 4, -17, SEALANT)
    light_strip(-16, F1_CEIL - 1, -12, -9, -12, SEALANT, 3)
    light_strip(-16, F1_CEIL - 1, -3, -9, -3, LAMP, 4)
    alarm(-8, F1 + 4, -2)


def sec_bedrooms():
    g.section("12 bedrooms 2 + 3, luxury bathroom, balcony")
    g.note("Bedroom 2")
    room(6, -1, 17, -10, F1, F1_CEIL, WHITE, WOOD)
    doorway(6, F1 + 1, -5, 6, -3, 3)
    door(6, F1 + 1, -4, WOOD_DOOR, DIR_E)
    bed_unit(9, F1 + 1, -4, 4, WOOD, W_WHITE, W_CYAN)
    table(13, F1 + 1, -8, 14, -7, QUARTZ_SL, WOOD_FENCE)
    stair(13, F1 + 1, -6, WOOD_S, ST_N)
    monitor_wall(12, F1 + 3, -10, 15, F1 + 4, BLACK)
    rug(8, F1, -8, 15, -3, C_BLUE)
    for z in range(-9, -2, 3):
        g.setb(16, F1 + 1, z, BARREL, f'["facing_direction":{FD_W},"open_bit":false]')
    g.setb(8, F1 + 4, -9, SEALANT)
    g.setb(14, F1 + 6, -5, LAMP)

    g.note("Bedroom 3")
    room(6, -11, 17, -19, F1, F1_CEIL, WHITE, WOOD)
    doorway(6, F1 + 1, -15, 6, -13, 3)
    door(6, F1 + 1, -14, WOOD_DOOR, DIR_E)
    bed_unit(9, F1 + 1, -14, 4, WOOD, W_WHITE, W_RED)
    table(13, F1 + 1, -18, 14, -17, QUARTZ_SL, WOOD_FENCE)
    stair(13, F1 + 1, -16, WOOD_S, ST_N)
    monitor_wall(12, F1 + 3, -19, 15, F1 + 4, BLACK)
    rug(8, F1, -18, 15, -13, C_RED)
    g.setb(16, F1 + 1, -18, CHEST, card(FD_W))
    g.setb(8, F1 + 4, -19, SEALANT)
    g.setb(14, F1 + 6, -15, LAMP)

    g.note("Luxury family bathroom")
    room(-4, -14, 4, -21, F1, F1_CEIL, LGREY, TILE)
    doorway(-1, F1 + 1, -14, 1, -14, 3)
    g.note("Sunken tub")
    box(-2, F1, -19, 2, F1, -17, DEEP)
    box(-2, F1 + 1, -19, 2, F1 + 1, -17, WATER)
    box(-3, F1 + 1, -20, 3, F1 + 1, -20, QUARTZ_SL)
    g.setb(-3, F1 + 1, -16, CAULDRON, '["cauldron_liquid":"water","fill_level":6]')
    g.setb(3, F1 + 1, -16, CAULDRON, '["cauldron_liquid":"water","fill_level":6]')
    box(-3, F1 + 1, -15, -2, F1 + 3, -15, GLASS_WH)
    for x in (-2, 2):
        g.setb(x, F1 + 4, -18, SEALANT)
    g.setb(0, F1 + 5, -16, LAMP)

    g.note("Front balcony with glass railing")
    box(-10, F1, 1, 10, F1, 4, SSTONE)
    box(-10, F1, 1, 10, F1, 1, TILE)
    railing(-10, F1 + 1, 4, 10, 4, BLACKST_W, PANE)
    railing(-10, F1 + 1, 1, -10, 4, BLACKST_W, PANE)
    railing(10, F1 + 1, 1, 10, 4, BLACKST_W, PANE)
    for x in range(-8, 9, 4):
        g.setb(x, F1 + 1, 3, POT)
    seating_row(-3, F1 + 1, 3, 3, ST_S, WOOD_S, W_GREY)
    table(-1, F1 + 1, 2, 1, 2, QUARTZ_SL, WOOD_FENCE)
    alarm(-10, F1 + 4, 0)
    alarm(10, F1 + 4, 0)
    light_strip(-9, F1 + 1, 1, 9, 1, LAMP, 4)


# ======================================================================
# SECOND FLOOR
# ======================================================================
def sec_cinema():
    g.section("13 home cinema")
    g.anchor("cinema", -11, F2 + 1, -9)
    room(IX1 - 1, -1, -6, -17, F2, F2_CEIL, BLACK, C_BLACK, DEEP)
    doorway(-6, F2 + 1, -4, -6, -2, 3)
    door(-6, F2 + 1, -3, WOOD_DOOR, DIR_E)
    g.note("Screen wall")
    monitor_wall(-16, F2 + 2, -17, -8, F2 + 5, BLACKST)
    box(-17, F2 + 1, -16, -17, F2 + 5, -16, CLEAN)
    box(-7, F2 + 1, -16, -7, F2 + 5, -16, CLEAN)
    g.note("Three tiers of seating, each one block higher")
    for tier, z in enumerate((-13, -10, -7)):
        y = F2 + 1 + tier
        box(-17, y - 1, z, -7, y - 1, z + 1, BLACKST)
        seating_row(-16, y, z, -8, ST_N, WOOD_S, W_RED)
        for x in range(-16, -7, 4):
            g.setb(x, y, z + 1, WOOD_SL)
    g.note("Aisle lighting and acoustic panelling")
    for z in range(-16, -2, 2):
        g.setb(-17, F2 + 1, z, LAMP)
    box(-17, F2 + 6, -16, -7, F2 + 6, -2, CLEAN)
    for x in range(-15, -7, 3):
        g.setb(x, F2 + 6, -5, SEALANT)
    g.setb(-8, F2 + 1, -2, PANEL)
    alarm(-7, F2 + 4, -2)


def sec_gym():
    g.section("14 gym")
    g.anchor("gym", 11, F2 + 1, -6)
    room(5, -1, 17, -11, F2, F2_CEIL, LGREY, WOOD)
    doorway(5, F2 + 1, -6, 5, -4, 3)
    g.note("Mirrored wall and rubber flooring")
    box(6, F2, -10, 16, F2, -2, C_BLACK)
    box(17, F2 + 1, -10, 17, F2 + 4, -2, GLASS_WH)
    g.note("Weight racks built from blocks")
    for x in range(7, 15, 3):
        g.fill(x, F2 + 1, -3, x, F2 + 2, -3, IRON)
        g.setb(x, F2 + 3, -3, BLACKST_SL)
        g.setb(x + 1, F2 + 1, -3, ANVIL,
           f'["damage":"undamaged","minecraft:cardinal_direction":"north"]')
    g.note("Benches")
    for z in (-6, -8):
        for x in range(7, 11):
            g.setb(x, F2 + 1, z, WOOD_SL)
        g.setb(6, F2 + 1, z, W_BLACK)
    g.note("Treadmills and cardio row")
    for x in range(12, 17, 2):
        g.setb(x, F2 + 1, -9, BLACKST)
        g.setb(x, F2 + 2, -9, SCREEN)
        g.setb(x, F2 + 1, -8, SSTONE_SL)
    g.note("Storage and hydration")
    for x in range(6, 9):
        g.setb(x, F2 + 1, -10, BARREL, f'["facing_direction":{FD_UP},"open_bit":false]')
    g.setb(16, F2 + 1, -3, CAULDRON, '["cauldron_liquid":"water","fill_level":6]')
    light_strip(6, F2 + 6, -9, 16, -9, SEALANT, 3)
    light_strip(6, F2 + 6, -3, 16, -3, LAMP, 4)
    alarm(5, F2 + 4, -2)


def sec_gaming():
    g.section("15 gaming room + lounge")
    g.anchor("gaming_room", 11, F2 + 1, -17)
    room(5, -12, 17, -22, F2, F2_CEIL, BLACK, C_BLACK, DEEP)
    doorway(5, F2 + 1, -17, 5, -15, 3)
    door(5, F2 + 1, -16, WARP_DOOR, DIR_E)
    g.note("Six-monitor primary battlestation")
    desk(7, F2 + 1, -21, 15, QUARTZ_SL, BLACKST)
    for x in range(7, 16, 3):
        monitor_wall(x, F2 + 3, -22, x + 1, F2 + 4, BLACK)
    g.setb(11, F2 + 2, -21, PANEL)
    for x in (8, 14):
        g.fill(x, F2 + 1, -20, x, F2 + 2, -20, RACK)
    g.note("Chairs")
    for x in (8, 11, 14):
        stair(x, F2 + 1, -20, WOOD_S, ST_N)
        g.setb(x, F2 + 2, -20, W_BLACK)
    g.note("Secondary consoles and streaming corner")
    desk(7, F2 + 1, -14, 10, WOOD_SL, BLACKST)
    monitor_wall(8, F2 + 3, -13, 9, F2 + 4, BLACK)
    g.setb(7, F2 + 2, -14, JUKEBOX)
    g.setb(10, F2 + 2, -14, NOTEBLOCK)
    g.note("Lounge seating")
    seating_row(13, F2 + 1, -14, 16, ST_N, WOOD_S, W_CYAN)
    table(14, F2 + 1, -16, 15, -15, QUARTZ_SL, WOOD_FENCE)
    rug(13, F2, -17, 16, -13, C_BLUE)
    g.note("RGB cove lighting")
    for x in range(6, 17, 2):
        g.setb(x, F2 + 6, -22, rng.choice([GLASS_CY, GLASS_RD, GLASS_LM]))
    light_strip(6, F2 + 6, -18, 16, -18, LAMP, 3)
    for z in (-21, -14):
        g.setb(6, F2 + 5, z, SEALANT)
    alarm(5, F2 + 4, -22)

    g.note("Central lounge between cinema and gym")
    box(-5, F2, -13, 4, F2, -2, WOOD)
    seating_row(-3, F2 + 1, -4, 2, ST_N, WOOD_S, W_GREY)
    seating_row(-3, F2 + 1, -11, 2, ST_S, WOOD_S, W_GREY)
    table(-2, F2 + 1, -8, 1, -7, QUARTZ_SL, WOOD_FENCE)
    rug(-4, F2, -12, 3, -3, C_LGREY)
    for x in (-4, 3):
        g.setb(x, F2 + 1, -12, SHELF)
        g.setb(x, F2 + 2, -12, CHISHELF)
    light_strip(-4, F2 + 6, -7, 3, -7, SEALANT, 3)
    g.note("Stair from first floor up to second, in the hall void")
    staircase(-3, 3, F1 + 1, -4, QUARTZ_S, ST_N, 7, -1)
    box(-3, F2, -12, 3, F2, -11, WOOD)


# ======================================================================
# ROOFTOP
# ======================================================================
def sec_rooftop():
    g.section("16 rooftop terrace")
    g.anchor("rooftop", 0, ROOF + 1, -10)
    g.note("Decking zones")
    box(-16, ROOF, -18, -6, ROOF, -4, WOOD)
    box(6, ROOF, -18, 16, ROOF, -4, SSTONE)
    g.note("Hot tub")
    box(-14, ROOF, -9, -9, ROOF, -5, DEEP)
    box(-13, ROOF, -8, -10, ROOF, -6, WATER)
    for x in range(-14, -8):
        stair(x, ROOF + 1, -10, QUARTZ_S, ST_N)
    g.setb(-14, ROOF + 1, -5, SEALANT)
    g.setb(-9, ROOF + 1, -9, PANEL)
    g.note("Lounge seating and fire table")
    seating_row(-15, ROOF + 1, -16, -8, ST_N, WOOD_S, W_GREY)
    seating_row(-15, ROOF + 1, -12, -8, ST_S, WOOD_S, W_GREY)
    table(-13, ROOF + 1, -14, -10, -14, QUARTZ_SL, WOOD_FENCE)
    g.setb(-12, ROOF + 2, -14, SHROOM)
    g.note("Helipad markings on the east deck")
    box(6, ROOF, -16, 16, ROOF, -6, BLACK)
    for x in range(7, 16):
        g.setb(x, ROOF, -15, WHITE)
        g.setb(x, ROOF, -7, WHITE)
    for z in range(-15, -6):
        g.setb(7, ROOF, z, WHITE)
        g.setb(15, ROOF, z, WHITE)
    g.note("H marking")
    for z in range(-14, -7):
        g.setb(10, ROOF, z, WHITE)
        g.setb(13, ROOF, z, WHITE)
    for x in range(10, 14):
        g.setb(x, ROOF, -11, WHITE)
    g.note("Approach lights - always-on, not emergency circuit")
    for x in (6, 16):
        for z in (-16, -11, -6):
            g.setb(x, ROOF + 1, z, ENDROD, f'["facing_direction":{FD_UP}]')
    g.note("Bar and planting")
    counter(-4, ROOF + 1, -20, 4, -20, WARP, QUARTZ_SL)
    for x in range(-3, 4, 2):
        stair(x, ROOF + 1, -19, WOOD_S, ST_N)
    for x in range(-16, 17, 6):
        planter(x, ROOF, -3, PODZOL, AZALEA_F, CALCITE)
    light_strip(-15, ROOF + 1, -18, 15, -18, LAMP, 5)
    alarm(-6, ROOF + 2, -19)
    alarm(6, ROOF + 2, -19)


# ======================================================================
# BASEMENT
# ======================================================================
def sec_basement_core():
    g.section("17 basement core + stair")
    g.note("Stair down from the utility corridor")
    box(-2, BAS_CEIL, -24, 0, GF - 1, -22, AIR)
    staircase(-2, 0, BAS_FLOOR + 1, -18, DEEP_S, ST_S, 7, 1)
    box(-2, GF, -24, 0, GF, -22, AIR)
    g.note("Central basement corridor")
    box(-4, BAS_FLOOR, -22, 4, BAS_FLOOR, -4, TILE)
    box(-4, BAS_CEIL - 1, -22, 4, BAS_CEIL - 1, -4, CLEAN)
    for z in range(-21, -4, 3):
        g.setb(-4, BAS_FLOOR + 4, z, LAMP)
        g.setb(4, BAS_FLOOR + 4, z, LAMP)
    for z in (-20, -12, -6):
        alarm(-4, BAS_FLOOR + 3, z)
        alarm(4, BAS_FLOOR + 3, z)
    g.note("Corridor cladding")
    box(-5, BAS_FLOOR + 1, -22, -5, BAS_FLOOR + 3, -4, CLEAN)
    box(5, BAS_FLOOR + 1, -22, 5, BAS_FLOOR + 3, -4, CLEAN)


def sec_server_room():
    g.section("18 server room")
    g.anchor("server_room", -11, BAS_FLOOR + 1, -8)
    room(BX1 + 1, -3, -6, -12, BAS_FLOOR, BAS_CEIL, DEEP, TILE)
    doorway(-6, BAS_FLOOR + 1, -8, -6, -6, 3)
    door(-6, BAS_FLOOR + 1, -7, IRON_DOOR, DIR_E)
    g.note("Raised access floor")
    box(-15, BAS_FLOOR, -11, -7, BAS_FLOOR, -4, BLACK)
    g.note("Four cold-aisle rack rows")
    for x in (-15, -13, -10, -8):
        server_row(x, BAS_FLOOR + 1, -11, -5)
    g.note("Aisle containment and cable trays")
    for x in (-14, -9):
        for z in range(-11, -4, 2):
            g.setb(x, BAS_FLOOR + 4, z, PANE_BK)
    box(-16, BAS_FLOOR + 4, -11, -16, BAS_FLOOR + 4, -4, CLEAN)
    g.note("Ops console")
    desk(-16, BAS_FLOOR + 1, -3, -12, QUARTZ_SL, BLACKST)
    monitor_wall(-15, BAS_FLOOR + 3, -3, -13, BAS_FLOOR + 4, BLACK)
    g.setb(-16, BAS_FLOOR + 2, -3, PANEL)
    stair(-14, BAS_FLOOR + 1, -4, WOOD_S, ST_N)
    g.note("Power and cooling plant")
    for z in (-11, -10):
        g.setb(-16, BAS_FLOOR + 1, z, BEACON)
    g.setb(-16, BAS_FLOOR + 1, -8, OBSERVER, '["minecraft:facing_direction":"east"]')
    light_strip(-15, BAS_CEIL - 1, -11, -7, -11, SEALANT, 3)
    light_strip(-15, BAS_CEIL - 1, -5, -7, -5, LAMP, 3)
    alarm(-6, BAS_FLOOR + 3, -4)


def sec_security_room():
    g.section("19 security room + secret room A")
    g.anchor("security_room", 11, BAS_FLOOR + 1, -8)
    g.anchor("control_panel", 11, BAS_FLOOR + 2, -4)
    room(6, -3, BX2 - 1, -12, BAS_FLOOR, BAS_CEIL, DEEP, TILE)
    doorway(6, BAS_FLOOR + 1, -8, 6, -6, 3)
    door(6, BAS_FLOOR + 1, -7, IRON_DOOR, DIR_E)
    g.note("Camera monitor wall - 3 high, 9 wide")
    monitor_wall(7, BAS_FLOOR + 3, -4, 15, BAS_FLOOR + 5, BLACK)
    g.note("Control desk with panels")
    desk(7, BAS_FLOOR + 1, -6, 15, QUARTZ_SL, BLACKST)
    for x in (8, 11, 14):
        g.setb(x, BAS_FLOOR + 2, -6, PANEL)
    for x in (9, 10, 12, 13):
        g.setb(x, BAS_FLOOR + 2, -6, SCREEN)
    for x in (8, 11, 14):
        stair(x, BAS_FLOOR + 1, -7, WOOD_S, ST_N)
    g.note("Equipment bays")
    for z in range(-11, -8):
        g.fill(16, BAS_FLOOR + 1, z, 16, BAS_FLOOR + 3, z, RACK)
    g.setb(7, BAS_FLOOR + 1, -11, TRAPCHEST, card(FD_S))
    g.setb(8, BAS_FLOOR + 1, -11, CHEST, card(FD_S))
    g.setb(16, BAS_FLOOR + 1, -4, LEVER, '["lever_direction":"west","open_bit":false]')
    g.note("SECRET ROOM A - behind the monitor wall, entered by a hidden door")
    room(7, -14, 15, -20, BAS_FLOOR, BAS_CEIL, DBRICK, TILE)
    g.note("Hidden door: flush deepslate panel with a concealed button")
    box(11, BAS_FLOOR + 1, -13, 12, BAS_FLOOR + 2, -13, AIR)
    door(11, BAS_FLOOR + 1, -13, IRON_DOOR, DIR_N)
    g.setb(13, BAS_FLOOR + 2, -13, BUTTON, f'["facing_direction":{FD_S}]')
    g.setb(10, BAS_FLOOR + 1, -13, BARRIER)
    g.note("Vault contents")
    for x in range(8, 15, 2):
        g.setb(x, BAS_FLOOR + 1, -19, CHEST, card(FD_S))
        g.setb(x, BAS_FLOOR + 2, -19, IRON)
    g.setb(9, BAS_FLOOR + 1, -16, ENDERCHEST)
    g.setb(13, BAS_FLOOR + 1, -16, BEACON)
    g.setb(11, BAS_FLOOR + 1, -17, PANEL)
    box(8, BAS_FLOOR + 1, -20, 14, BAS_FLOOR + 1, -20, NETHERITE)
    g.setb(11, BAS_CEIL - 1, -17, SEALANT)
    light_strip(8, BAS_CEIL - 1, -15, 14, -15, LAMP, 3)
    light_strip(7, BAS_CEIL - 1, -10, 15, -10, SEALANT, 4)
    light_strip(7, BAS_CEIL - 1, -5, 15, -5, LAMP, 4)
    alarm(6, BAS_FLOOR + 3, -4)
    alarm(16, BAS_FLOOR + 3, -12)


def sec_lab():
    g.section("20 laboratory + secret room B")
    g.anchor("laboratory", -9, BAS_FLOOR + 1, -18)
    room(BX1 + 1, -13, -6, -24, BAS_FLOOR, BAS_CEIL, DEEP, CALCITE)
    doorway(-6, BAS_FLOOR + 1, -18, -6, -16, 3)
    door(-6, BAS_FLOOR + 1, -17, IRON_DOOR, DIR_E)
    g.note("Clean-room cladding")
    box(-16, BAS_CEIL - 1, -23, -7, BAS_CEIL - 1, -14, CLEAN)
    box(-16, BAS_FLOOR + 1, -23, -16, BAS_FLOOR + 3, -14, LABPANEL)
    g.note("Benches with brewing and analysis")
    for z in (-16, -19, -22):
        desk(-15, BAS_FLOOR + 1, z, -9, QUARTZ_SL, CALCITE)
        for x in range(-14, -9, 2):
            g.setb(x, BAS_FLOOR + 2, z, BREW)
        g.setb(-15, BAS_FLOOR + 2, z, CAULDRON,
               '["cauldron_liquid":"water","fill_level":6]')
        g.setb(-9, BAS_FLOOR + 2, z, LABPANEL)
    for z in (-17, -20):
        for x in range(-14, -9, 2):
            stair(x, BAS_FLOOR + 1, z, WOOD_S, ST_N)
    g.note("Analysis wall and control")
    monitor_wall(-14, BAS_FLOOR + 3, -24, -10, BAS_FLOOR + 4, BLACK)
    g.setb(-15, BAS_FLOOR + 2, -24, PANEL)
    g.setb(-8, BAS_FLOOR + 2, -24, LABPANEL)
    g.setb(-8, BAS_FLOOR + 1, -14, CUTTER)
    g.setb(-8, BAS_FLOOR + 1, -15, COMPOSTER)
    g.setb(-8, BAS_FLOOR + 1, -16, CARTO)
    g.note("Specimen storage")
    for z in range(-22, -18, 2):
        g.setb(-16, BAS_FLOOR + 1, z, BARREL,
               f'["facing_direction":{FD_E},"open_bit":false]')
    g.note("SECRET ROOM B - hidden behind the lab's specimen wall")
    room(-16, -25, -10, -25, BAS_FLOOR, BAS_CEIL, DBRICK, TILE)
    box(-13, BAS_FLOOR + 1, -24, -12, BAS_FLOOR + 2, -24, AIR)
    door(-13, BAS_FLOOR + 1, -24, IRON_DOOR, DIR_N)
    g.setb(-11, BAS_FLOOR + 2, -24, BUTTON, f'["facing_direction":{FD_S}]')
    g.setb(-14, BAS_FLOOR + 1, -24, BARRIER)
    g.setb(-15, BAS_FLOOR + 1, -25, CHEST, card(FD_S))
    g.setb(-11, BAS_FLOOR + 1, -25, LABPANEL)
    g.setb(-13, BAS_FLOOR + 2, -25, SCREEN)
    light_strip(-15, BAS_CEIL - 1, -22, -9, -22, SEALANT, 3)
    light_strip(-15, BAS_CEIL - 1, -15, -9, -15, LAMP, 3)
    for z in (-16, -20):
        g.setb(-7, BAS_FLOOR + 3, z, SOULLANT, '["hanging":false]')
    alarm(-6, BAS_FLOOR + 3, -14)
    alarm(-16, BAS_FLOOR + 3, -24)


# ======================================================================
# BUNKER
# ======================================================================
def sec_bunker_core():
    g.section("21 bunker access shaft + quarters")
    g.anchor("bunker", 0, BUN_FLOOR + 1, -12)
    g.note("Armoured shaft from the basement down to the bunker")
    box(-1, BUN_CEIL, -20, 1, BAS_FLOOR - 1, -18, AIR)
    for y in range(BUN_FLOOR + 1, BAS_FLOOR):
        g.setb(0, y, -18, LADDER, f'["facing_direction":{FD_S}]')
    box(-1, BAS_FLOOR, -20, 1, BAS_FLOOR, -18, AIR)
    g.note("Bunker spine corridor")
    box(-1, BUN_FLOOR, -19, 1, BUN_FLOOR, -5, TILE)
    box(-2, BUN_FLOOR + 1, -19, -2, BUN_FLOOR + 3, -5, CLEAN)
    box(2, BUN_FLOOR + 1, -19, 2, BUN_FLOOR + 3, -5, CLEAN)
    for z in range(-18, -5, 3):
        g.setb(0, BUN_CEIL - 1, z, LAMP)
    for z in (-17, -12, -7):
        alarm(-2, BUN_FLOOR + 3, z)
        alarm(2, BUN_FLOOR + 3, z)

    g.note("Living quarters")
    room(KX1 + 1, -5, -3, -13, BUN_FLOOR, BUN_CEIL, DEEP, TILE)
    doorway(-3, BUN_FLOOR + 1, -10, -3, -8, 3)
    for i, z in enumerate((-6, -9, -12)):
        bed_unit(-12, BUN_FLOOR + 1, z, 3, WOOD, W_LGREY, W_GREY)
        bed_unit(-8, BUN_FLOOR + 1, z, 3, WOOD, W_LGREY, W_GREY)
        g.setb(-13, BUN_FLOOR + 1, z, LANTERN, '["hanging":false]')
    table(-6, BUN_FLOOR + 1, -8, -5, -7, QUARTZ_SL, WOOD_FENCE)
    stair(-6, BUN_FLOOR + 1, -9, WOOD_S, ST_N)
    stair(-5, BUN_FLOOR + 1, -9, WOOD_S, ST_N)
    g.setb(-4, BUN_FLOOR + 1, -12, CRAFT)
    g.setb(-4, BUN_FLOOR + 1, -11, FURNACE, card(FD_W))
    light_strip(-12, BUN_CEIL - 1, -7, -4, -7, SEALANT, 3)
    light_strip(-12, BUN_CEIL - 1, -12, -4, -12, LAMP, 3)

    g.note("Emergency supplies store")
    room(KX1 + 1, -14, -3, -19, BUN_FLOOR, BUN_CEIL, DEEP, TILE)
    doorway(-3, BUN_FLOOR + 1, -17, -3, -15, 3)
    for x in range(-12, -4, 2):
        for z in (-16, -18):
            g.setb(x, BUN_FLOOR + 1, z, BARREL,
                   f'["facing_direction":{FD_UP},"open_bit":false]')
            g.setb(x, BUN_FLOOR + 2, z, BARREL,
                   f'["facing_direction":{FD_UP},"open_bit":false]')
    for x in range(-13, -4, 3):
        g.setb(x, BUN_FLOOR + 1, -15, CHEST, card(FD_S))
    g.setb(-13, BUN_FLOOR + 1, -19, CAULDRON,
           '["cauldron_liquid":"water","fill_level":6]')
    g.setb(-4, BUN_FLOOR + 1, -19, COMPOSTER)
    light_strip(-12, BUN_CEIL - 1, -17, -4, -17, LAMP, 3)
    alarm(-3, BUN_FLOOR + 3, -14)


def sec_quarantine():
    g.section("22 quarantine cell + bunker control")
    g.anchor("quarantine", 8, BUN_FLOOR + 1, -8)
    g.note("Sealed glass-walled quarantine cell with its own door")
    room(4, -5, 12, -11, BUN_FLOOR, BUN_CEIL, DEEP, CALCITE)
    doorway(3, BUN_FLOOR + 1, -8, 3, -8, 3)
    g.note("Inner glass cell, airlocked from the anteroom")
    box(6, BUN_FLOOR, -6, 11, BUN_FLOOR, -10, CALCITE)
    walls(6, BUN_FLOOR + 1, -6, 11, BUN_FLOOR + 4, -10, GLASS_WH)
    box(6, BUN_FLOOR + 5, -6, 11, BUN_FLOOR + 5, -10, LABPANEL)
    g.note("Cell door - its own iron door in the glass wall")
    box(8, BUN_FLOOR + 1, -6, 8, BUN_FLOOR + 2, -6, AIR)
    door(8, BUN_FLOOR + 1, -6, IRON_DOOR, DIR_N)
    g.setb(7, BUN_FLOOR + 2, -6, BUTTON, f'["facing_direction":{FD_S}]')
    g.note("Cell interior")
    bed_unit(9, BUN_FLOOR + 1, -8, 3, WOOD, W_WHITE, W_LGREY)
    g.setb(7, BUN_FLOOR + 1, -9, CAULDRON,
           '["cauldron_liquid":"water","fill_level":6]')
    g.setb(7, BUN_FLOOR + 1, -7, LABPANEL)
    g.setb(10, BUN_FLOOR + 1, -10, LABPANEL)
    g.setb(8, BUN_FLOOR + 4, -8, SEALANT)
    g.note("Observation and medical bay outside the glass")
    desk(4, BUN_FLOOR + 1, -5, 5, QUARTZ_SL, CALCITE)
    g.setb(4, BUN_FLOOR + 2, -5, LABPANEL)
    g.setb(5, BUN_FLOOR + 2, -5, SCREEN)
    g.setb(12, BUN_FLOOR + 1, -8, BREW)
    g.setb(12, BUN_FLOOR + 1, -7, LABPANEL)
    g.setb(4, BUN_FLOOR + 1, -11, BARREL,
           f'["facing_direction":{FD_UP},"open_bit":false]')
    light_strip(5, BUN_CEIL - 1, -7, 11, -7, LAMP, 3)
    alarm(3, BUN_FLOOR + 3, -5)
    alarm(12, BUN_FLOOR + 3, -11)

    g.note("Bunker command room")
    room(4, -12, KX2 - 1, -19, BUN_FLOOR, BUN_CEIL, DEEP, TILE)
    doorway(3, BUN_FLOOR + 1, -16, 3, -14, 3)
    monitor_wall(5, BUN_FLOOR + 3, -19, 12, BUN_FLOOR + 5, BLACK)
    desk(5, BUN_FLOOR + 1, -17, 12, QUARTZ_SL, BLACKST)
    g.note("Bunker control panel bank")
    for x in (5, 8, 11):
        g.setb(x, BUN_FLOOR + 2, -17, PANEL)
    for x in (6, 7, 9, 10, 12):
        g.setb(x, BUN_FLOOR + 2, -17, SCREEN)
    for x in (6, 9, 12):
        stair(x, BUN_FLOOR + 1, -18, WOOD_S, ST_S)
    for z in range(-15, -12):
        g.fill(13, BUN_FLOOR + 1, z, 13, BUN_FLOOR + 3, z, RACK)
    g.setb(4, BUN_FLOOR + 1, -13, TRAPCHEST, card(FD_E))
    light_strip(5, BUN_CEIL - 1, -14, 12, -14, LAMP, 3)
    alarm(13, BUN_FLOOR + 3, -19)


def sec_tunnel():
    g.section("23 escape tunnel + concealed exit")
    g.note("Tunnel bore, 38 blocks south under the grounds")
    box(TUN_X1 - 1, TUN_FLOOR, TUN_Z_START, TUN_X2 + 1, TUN_CEIL,
        TUN_Z_END, DBRICK)
    box(TUN_X1, TUN_FLOOR + 1, TUN_Z_START, TUN_X2, TUN_CEIL - 1,
        TUN_Z_END, AIR)
    box(TUN_X1, TUN_FLOOR, TUN_Z_START, TUN_X2, TUN_FLOOR, TUN_Z_END, TILE)
    g.note("Tunnel mouth in the bunker's south wall - PURE AIR, seal")
    # Registered after the bore: a seal volume must be the final state of the
    # opening, so nothing may overwrite it once carved.
    g.seal_opening("tunnel_mouth", TUN_X1, TUN_FLOOR + 1, KZ2,
                   TUN_X2, TUN_CEIL - 1, KZ2)
    g.note("Tunnel services: lighting, alarms, ribs")
    for z in range(TUN_Z_START + 2, TUN_Z_END, 6):
        g.setb(TUN_X1, TUN_CEIL - 1, z, LAMP)
        g.setb(TUN_X2, TUN_CEIL - 1, z, LAMP)
    for z in range(TUN_Z_START + 4, TUN_Z_END, 8):
        alarm(TUN_X1 - 1, TUN_FLOOR + 2, z)
        g.fill(TUN_X1 - 1, TUN_FLOOR + 1, z + 1, TUN_X1 - 1,
               TUN_CEIL - 1, z + 1, CLEAN)
        g.fill(TUN_X2 + 1, TUN_FLOOR + 1, z + 1, TUN_X2 + 1,
               TUN_CEIL - 1, z + 1, CLEAN)
    g.note("Supply cache half way along")
    for z in (14, 16):
        g.setb(TUN_X1, TUN_FLOOR + 1, z, BARREL,
               f'["facing_direction":{FD_E},"open_bit":false]')
    g.setb(TUN_X2, TUN_FLOOR + 1, 15, CHEST, card(FD_W))
    g.note("Vertical exit shaft up to the garden, with a ladder")
    box(TUN_X1 - 1, TUN_FLOOR, TUN_Z_END - 1, TUN_X1 + 1, GF, TUN_Z_END + 1,
        DBRICK)
    box(TUN_X1, TUN_FLOOR + 1, TUN_Z_END - 1, TUN_X1, GF - 1, TUN_Z_END, AIR)
    for y in range(TUN_FLOOR + 1, GF):
        g.setb(TUN_X1, y, TUN_Z_END, LADDER, f'["facing_direction":{FD_S}]')
    g.note("Concealed hatch at the surface, hidden inside a hedge block")
    g.seal_opening("tunnel_exit", TUN_X1, GF, TUN_Z_END - 1, TUN_X1, GF,
                   TUN_Z_END)
    g.setb(TUN_X1, GF + 1, TUN_Z_END, OAK_TD,
           f'["direction":{DIR_S},"open_bit":false,"upside_down_bit":false]')
    g.anchor("tunnel_exit", TUN_X1, 0, TUN_Z_END)
    hedge(TUN_X1 - 2, 0, TUN_Z_END - 2, TUN_X1 + 2, TUN_Z_END - 2, LEAF_AZ)
    hedge(TUN_X1 - 2, 0, TUN_Z_END + 1, TUN_X1 + 2, TUN_Z_END + 1, LEAF_AZ)
    g.setb(TUN_X1 - 1, 0, TUN_Z_END, LEAF_AZ,
           '["persistent_bit":true,"update_bit":false]')
    g.setb(TUN_X1 + 1, 0, TUN_Z_END, LEAF_AZ,
           '["persistent_bit":true,"update_bit":false]')
    alarm(TUN_X1 + 1, TUN_FLOOR + 2, TUN_Z_END - 1)


# ======================================================================
# EXTERIOR
# ======================================================================
def sec_entrance_ext():
    g.section("24 entrance canopy + driveway")
    g.note("Canopy slab on pillars over the entrance")
    box(-8, 6, 1, 8, 6, 8, SSTONE)
    box(-8, 7, 1, 8, 7, 8, DEEP)
    box(-7, 5, 2, 7, 5, 7, CLEAN)
    for x in (-7, -3, 3, 7):
        for z in (2, 7):
            pillar(x, 0, z, 5, QPILLAR, BLACKST_SL)
    g.note("Canopy downlights - always on")
    for x in range(-6, 7, 3):
        for z in (3, 6):
            g.setb(x, 5, z, SEALANT)
    g.note("Entrance steps and threshold apron")
    box(-6, GF, 1, 6, GF, 9, TILE)
    for i in range(2):
        for x in range(-6, 7):
            stair(x, GF - i, 9 + i, DEEP_S, ST_S)
    g.note("Driveway")
    box(-6, GF, 10, 6, GF, 38, BLACKST)
    box(-5, GF, 10, 5, GF, 38, TILE)
    for z in range(12, 38, 4):
        g.setb(-6, GF + 1, z, ENDROD, f'["facing_direction":{FD_UP}]')
        g.setb(6, GF + 1, z, ENDROD, f'["facing_direction":{FD_UP}]')
    g.note("Turning circle island")
    box(-3, GF, 22, 3, GF, 28, GRASS)
    tree(0, 0, 25, OAK_LOG, LEAF_AZ, 5, 2)
    for x in (-2, 2):
        g.setb(x, 0, 23, ROSE)
        g.setb(x, 0, 27, PEONY)
    g.note("Gate piers")
    for x in (-7, 7):
        pillar(x, 0, 38, 4, DEEP, BLACKST_SL)
        g.setb(x, 5, 38, SEALANT)
    alarm(-7, 4, 1)
    alarm(7, 4, 1)
    alarm(-7, 3, 38)
    alarm(7, 3, 38)


def sec_garden():
    g.section("25 landscaped garden")
    g.note("Lawn edging and paths")
    box(-20, GF, 2, -8, GF, 34, GRASS)
    box(8, GF, 28, 20, GF, 34, GRASS)
    for z in range(4, 34, 2):
        g.setb(-9, GF, z, PATH)
        g.setb(-10, GF, z, PATH)
    box(-16, GF, 12, -12, GF, 12, PATH)
    g.note("Specimen trees")
    for (tx, tz, h) in ((-16, 6, 6), (-13, 16, 5), (-18, 24, 6),
                        (-11, 30, 5), (14, 31, 6), (10, 29, 5)):
        tree(tx, 0, tz, OAK_LOG if h % 2 else SPRUCE_LOG,
             LEAF if h % 2 else LEAF_SP, h, 2)
    g.note("Clipped hedging")
    hedge(-20, 0, 3, -20, 33, LEAF_AZ)
    hedge(-19, 0, 34, -9, 34, LEAF_AZ)
    hedge(-8, 0, 12, -8, 20, LEAF_AZ)
    g.note("Flower beds - 1.21.0-safe species only")
    beds = [(-18, 8), (-17, 9), (-16, 10), (-15, 8), (-14, 10),
            (-18, 18), (-17, 19), (-16, 20), (-15, 18), (-14, 19),
            (-13, 26), (-14, 27), (-15, 28), (-16, 26), (-17, 27)]
    for (bx, bz) in beds:
        g.setb(bx, GF, bz, PODZOL)
        g.setb(bx, 0, bz, rng.choice([ROSE, PEONY, LILAC, SUNFLOWER]))
    g.note("Ground cover and texture")
    for _ in range(70):
        x = rng.randint(-20, -9)
        z = rng.randint(3, 34)
        g.setb(x, 0, z, rng.choice([SGRASS, FERN, PETALS, AZALEA, AZALEA_F]))
    g.note("Ornamental water feature")
    box(-14, GF, 20, -11, GF, 23, CALCITE)
    box(-13, GF, 21, -12, GF, 22, WATER)
    for x in (-14, -11):
        for z in (20, 23):
            g.setb(x, 0, z, LANTERN, '["hanging":false]')
    g.note("Garden seating terrace")
    box(-19, GF, 28, -13, GF, 32, SSTONE)
    seating_row(-18, 0, 31, -14, ST_N, WOOD_S, W_GREY)
    table(-17, 0, 29, -15, 29, QUARTZ_SL, WOOD_FENCE)
    for x in range(-19, -12, 3):
        planter(x, GF, 27, PODZOL, AZALEA_F, CALCITE)


def sec_pool():
    g.section("26 swimming pool + deck")
    g.anchor("pool", 29, 0, 15)
    g.note("Pool deck")
    box(POOL_X1, GF, POOL_Z1, POOL_X2, GF, POOL_Z2, SSTONE)
    box(POOL_X1 + 1, GF, POOL_Z1 + 1, POOL_X2 - 1, GF, POOL_Z2 - 1, CALCITE)
    g.note("Pool basin, 3 deep")
    box(23, GF - 3, 8, 35, GF, 22, TILE)
    box(24, GF - 3, 9, 34, GF - 1, 21, WATER)
    box(24, GF - 4, 9, 34, GF - 4, 21, GLASS_LB)
    g.note("Coping and invisible safety kerb")
    for x in range(23, 36):
        g.setb(x, GF, 8, QUARTZ_SL)
        g.setb(x, GF, 22, QUARTZ_SL)
        g.setb(x, GF + 1, 8, BARRIER)
        g.setb(x, GF + 1, 22, BARRIER)
    for z in range(9, 22):
        g.setb(23, GF, z, QUARTZ_SL)
        g.setb(35, GF, z, QUARTZ_SL)
    g.note("Steps into the shallow end")
    for i in range(3):
        box(25 + i, GF - 3 + i, 10, 25 + i, GF - 3 + i, 12, QUARTZ_SL)
    g.note("Diving board")
    box(29, GF + 1, 6, 29, GF + 1, 7, BLACKST)
    box(28, GF + 2, 5, 30, GF + 2, 7, SSTONE_SL)
    box(28, GF + 2, 8, 30, GF + 2, 9, WOOD_SL)
    for x in (28, 30):
        g.setb(x, GF + 2, 6, WOOD_FENCE)
        g.setb(x, GF + 3, 6, WOOD_FENCE)
    g.note("Sun loungers")
    for z in range(11, 21, 3):
        stair(37, 0, z, QUARTZ_S, ST_W)
        g.setb(36, 0, z, QUARTZ_SL)
        g.setb(37, 1, z, W_WHITE)
    g.note("Poolside bar and pergola")
    counter(21, 0, 24, 27, 24, WARP, QUARTZ_SL)
    for x in range(22, 27, 2):
        stair(x, 0, 23, WOOD_S, ST_N)
    for x in (21, 27):
        pillar(x, 0, 25, 3, WOOD_FENCE, WOOD_SL)
    box(21, 4, 24, 27, 4, 26, WOOD_SL)
    for x in range(22, 27, 2):
        g.setb(x, 3, 25, LANTERN, '["hanging":true]')
    g.note("Pool lighting - deck lights are always-on")
    for z in range(10, 22, 4):
        g.setb(23, GF - 1, z, SEALANT)
        g.setb(35, GF - 1, z, SEALANT)
    for x in range(24, 35, 5):
        g.setb(x, GF + 1, 23, ENDROD, f'["facing_direction":{FD_UP}]')
    g.note("Changing cabana")
    hollow_box(31, GF + 1, 24, 35, GF + 4, 27, LGREY)
    doorway(33, GF + 1, 24, 33, 24, 3)
    g.setb(32, GF + 1, 26, BARREL, f'["facing_direction":{FD_UP},"open_bit":false]')
    g.setb(34, GF + 1, 26, LAMP)
    alarm(POOL_X1, 3, POOL_Z1)
    alarm(POOL_X2, 3, POOL_Z2)


def sec_garage():
    g.section("27 garage with three bays")
    g.anchor("garage", -29, 0, 14)
    g.note("Garage shell")
    box(GAR_X1, GF, GAR_Z1, GAR_X2, GF, GAR_Z2, TILE)
    walls(GAR_X1, GF + 1, GAR_Z1, GAR_X2, GF + 5, GAR_Z2, LGREY)
    box(GAR_X1, GF + 6, GAR_Z1, GAR_X2, GF + 6, GAR_Z2, DEEP)
    box(GAR_X1 + 1, GF + 1, GAR_Z1 + 1, GAR_X2 - 1, GF + 5, GAR_Z2 - 1, AIR)
    g.note("Three bay mouths on the south elevation - PURE AIR, each a seal")
    for i, bx in enumerate((-36, -30, -24)):
        g.seal_opening(f"garage_bay_{i + 1}", bx, 0, GAR_Z2, bx + 3, 4, GAR_Z2)
        box(bx - 1, 0, GAR_Z2, bx - 1, 4, GAR_Z2, BLACKST)
        box(bx + 4, 0, GAR_Z2, bx + 4, 4, GAR_Z2, BLACKST)
        box(bx, 5, GAR_Z2, bx + 3, 5, GAR_Z2, CLEAN)
        g.setb(bx + 1, 5, GAR_Z2 - 1, SEALANT)
        g.setb(bx + 2, 5, GAR_Z2 - 1, SEALANT)
        alarm(bx, 5, GAR_Z2 - 1)
    g.note("Bay floor markings")
    for bx in (-36, -30, -24):
        for z in range(GAR_Z1 + 2, GAR_Z2):
            g.setb(bx - 1, GF, z, YELLOW_MARK)
            g.setb(bx + 4, GF, z, YELLOW_MARK)
    g.note("Workshop wall")
    for x in range(GAR_X1 + 2, GAR_X1 + 10, 2):
        g.setb(x, 0, GAR_Z1 + 1, BARREL,
               f'["facing_direction":{FD_UP},"open_bit":false]')
        g.setb(x, 1, GAR_Z1 + 1, CLEAN)
    g.setb(GAR_X1 + 1, 0, GAR_Z1 + 1, CRAFT)
    g.setb(GAR_X1 + 2, 1, GAR_Z1 + 2, ANVIL,
           f'["damage":"undamaged","minecraft:cardinal_direction":"south"]')
    desk(GAR_X1 + 4, 0, GAR_Z1 + 2, GAR_X1 + 8, QUARTZ_SL, BLACKST)
    monitor_wall(GAR_X1 + 5, 2, GAR_Z1 + 1, GAR_X1 + 7, 3, BLACK)
    g.setb(GAR_X1 + 4, 1, GAR_Z1 + 2, PANEL)
    g.note("Charging points")
    for bx in (-36, -30, -24):
        g.setb(bx + 1, 0, GAR_Z1 + 1, LAMP)
        g.setb(bx + 2, 1, GAR_Z1 + 1, SCREEN)
    g.note("Apron connecting the bays to the driveway")
    box(GAR_X1, GF, GAR_Z2 + 1, GAR_X2, GF, GAR_Z2 + 6, BLACKST)
    box(GAR_X2 + 1, GF, GAR_Z2 + 2, -7, GF, GAR_Z2 + 5, BLACKST)
    light_strip(GAR_X1 + 2, 5, GAR_Z1 + 3, GAR_X2 - 2, GAR_Z1 + 3, LAMP, 4)


# ======================================================================
# DETAIL PASS
# ======================================================================
def sec_detail():
    g.section("28 detail pass - cladding, alarms, smart lighting")
    g.note("myc:clean_panel cladding bands through the circulation cores")
    box(-6, 6, -12, 6, 6, -1, CLEAN)
    box(-6, F1_CEIL - 1, -12, 6, F1_CEIL - 1, -1, CLEAN)
    box(-5, F2_CEIL - 1, -12, 4, F2_CEIL - 1, -2, CLEAN)
    box(IX1, 6, -26, IX1, 6, -1, CLEAN)
    box(IX2, 6, -26, IX2, 6, -1, CLEAN)
    g.note("Skirting and reveal detail on the main floors")
    for y in (1, F1 + 1, F2 + 1):
        g.fill(IX1, y - 1, IZ1, IX2, y - 1, IZ1, DEEP_SL)
        g.fill(IX1, y - 1, IZ2, IX2, y - 1, IZ2, DEEP_SL)
    g.note("Perimeter alarm lights near every exit and stair core")
    for (ax, ay, az) in ((-5, 4, -1), (5, 4, -1), (0, 4, -26),
                         (-18, 4, -13), (18, 4, -13),
                         (-5, F1 + 4, -1), (5, F1 + 4, -1),
                         (-5, F2 + 4, -1), (5, F2 + 4, -1),
                         (0, ROOF + 2, -20), (0, BAS_FLOOR + 3, -22),
                         (0, BUN_FLOOR + 3, -19)):
        alarm(ax, ay, az)
    g.note("Smart lighting spine - redstone_lamp only where the emergency "
           "circuit should visibly take over")
    for z in range(-25, 0, 4):
        g.setb(-6, 6, z, LAMP)
        g.setb(6, 6, z, LAMP)
    for z in range(-25, 0, 5):
        g.setb(-7, F1_CEIL - 1, z, LAMP)
        g.setb(7, F1_CEIL - 1, z, LAMP)
    g.note("Always-on architectural light so the house is never fully dark")
    for z in range(-24, 0, 6):
        g.setb(IX1, 5, z, SEALANT)
        g.setb(IX2, 5, z, SEALANT)
        g.setb(IX1, F1 + 5, z, SEALANT)
        g.setb(IX2, F1 + 5, z, SEALANT)
    g.note("Facade uplighting")
    for x in range(-16, 17, 4):
        g.setb(x, GF, 1, SEALANT)
    g.note("Screens and panels finishing the tech fit-out")
    g.setb(-6, 2, -6, SCREEN)
    g.setb(6, 2, -6, SCREEN)
    g.setb(-6, F1 + 2, -8, SCREEN)
    g.setb(6, F1 + 2, -8, SCREEN)
    g.setb(0, BAS_FLOOR + 2, -22, PANEL)
    g.setb(0, BUN_FLOOR + 2, -19, PANEL)


# ======================================================================
# ASSEMBLY
# ======================================================================
def verify() -> None:
    """Prove the lockdown contract holds: no seal volume ever receives a
    non-air block after it is carved."""
    seal_ops: list[tuple[dict, int]] = []
    # Recover the op index at which each seal was carved.
    for op in g.ops:
        if op["block"] != AIR:
            continue
        for s in g.seals:
            if (list(op["box"][:3]) == s["from"]
                    and list(op["box"][3:]) == s["to"]):
                seal_ops.append((s, op["i"]))
    seen = {id(s) for s, _ in seal_ops}
    for s in g.seals:
        if id(s) not in seen:
            raise SystemExit(f"seal {s['name']} was never carved to air")

    for s, carve_i in seal_ops:
        sf, st = s["from"], s["to"]
        for op in g.ops:
            if op["i"] <= carve_i or op["block"] == AIR:
                continue
            a = op["box"]
            if (a[0] <= st[0] and a[3] >= sf[0]
                    and a[1] <= st[1] and a[4] >= sf[1]
                    and a[2] <= st[2] and a[5] >= sf[2]):
                raise SystemExit(
                    f"seal {s['name']} {sf}..{st} would be blocked by "
                    f"{op['block']} at {a} (op {op['i']})"
                )


def write_output() -> tuple[int, int]:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.mcfunction"):
        old.unlink()

    # Flatten sections into parts budgeted by BLOCK VOLUME, not command count.
    #
    # The runtime runs one part per tick. A command count is a useless proxy for
    # cost here, because a single `fill` can touch thousands of blocks: pacing
    # by count alone put the whole half-million-block site clear into one tick
    # and hard-crashed Minecraft on mobile. Budget the blocks instead.
    parts: list[list[str]] = []
    cur: list[str] = []
    cmds = 0
    volume = 0
    total = 0
    for name, lines in g.sections:
        for line in lines:
            is_cmd = not line.startswith("#")
            cost = command_volume(line) if is_cmd else 0
            if is_cmd and cur and (
                cmds >= MAX_CMDS_PER_PART or volume + cost > MAX_BLOCKS_PER_PART
            ):
                parts.append(cur)
                cur, cmds, volume = [f"# (continued: {name})"], 0, 0
            cur.append(line)
            if is_cmd:
                cmds += 1
                volume += cost
                total += 1
    if cur:
        parts.append(cur)

    names = []
    for i, lines in enumerate(parts):
        n = f"part_{i:02d}"
        names.append(f"mansion/{n}")
        header = [
            f"# {n}.mcfunction - generated by tools/gen_mansion.py, do not edit",
            "# Relative coordinates only; run via execute positioned <x> <y> <z>",
        ]
        (OUT / f"{n}.mcfunction").write_text("\n".join(header + lines) + "\n")

    # Clearing the envelope is ~426k blocks — the same crash the build had, so
    # it gets the same treatment: budgeted parts the runtime paces one per tick.
    clear_names: list[str] = []
    clear_lines: list[str] = []
    clear_volume = 0

    def flush_clear() -> None:
        nonlocal clear_lines, clear_volume
        if not clear_lines:
            return
        n = f"clear_{len(clear_names):02d}"
        clear_names.append(f"mansion/{n}")
        header = [
            f"# {n}.mcfunction - generated by tools/gen_mansion.py, do not edit",
            "# One slice of the build-volume clear. Run via execute positioned.",
        ]
        (OUT / f"{n}.mcfunction").write_text("\n".join(header + clear_lines) + "\n")
        clear_lines, clear_volume = [], 0

    for a, b, c, d, e, f in split_box(*BOUNDS_FROM, *BOUNDS_TO):
        line = f"fill {rc(a)} {rc(b)} {rc(c)} {rc(d)} {rc(e)} {rc(f)} {AIR}"
        cost = command_volume(line)
        if clear_lines and clear_volume + cost > MAX_BLOCKS_PER_PART:
            flush_clear()
        clear_lines.append(line)
        clear_volume += cost
    flush_clear()

    index = {
        "parts": names,
        "count": len(names),
        "clear_parts": clear_names,
        "anchors": g.anchors,
        "seals": g.seals,
        "bounds": {"from": list(BOUNDS_FROM), "to": list(BOUNDS_TO)},
    }
    (OUT / "_index.json").write_text(json.dumps(index, indent=2) + "\n")
    return len(names), total


REQUIRED_ANCHORS = [
    "entrance", "garage", "pool", "master_bedroom", "cinema", "gym",
    "gaming_room", "server_room", "security_room", "laboratory",
    "quarantine", "bunker", "tunnel_exit", "rooftop", "control_panel",
]


def main() -> None:
    for fn in (
        sec_site, sec_foundation, sec_shell_ground, sec_shell_glazing,
        sec_shell_upper, sec_roof, sec_hall, sec_living, sec_kitchen,
        sec_ground_misc, sec_master, sec_bedrooms, sec_cinema, sec_gym,
        sec_gaming, sec_rooftop, sec_basement_core, sec_server_room,
        sec_security_room, sec_lab, sec_bunker_core, sec_quarantine,
        sec_entrance_ext, sec_garden, sec_pool, sec_garage,
        # The tunnel runs last of the structural sections: its concealed exit
        # hatch punches up through the finished lawn, so the lawn has to exist
        # first or the seal volume gets paved over.
        sec_tunnel,
        sec_detail,
    ):
        fn()

    missing = [a for a in REQUIRED_ANCHORS if a not in g.anchors]
    if missing:
        raise SystemExit(f"missing required anchors: {missing}")
    verify()
    n_parts, n_cmds = write_output()

    vanilla = sorted(b for b in g.used_blocks if b.startswith("minecraft:"))
    custom = sorted(b for b in g.used_blocks if not b.startswith("minecraft:"))
    print(f"parts:    {n_parts}")
    print(f"commands: {n_cmds}")
    print(f"seals:    {len(g.seals)}  ({', '.join(s['name'] for s in g.seals)})")
    print(f"anchors:  {len(g.anchors)}")
    for k in REQUIRED_ANCHORS:
        print(f"    {k:16s} {g.anchors[k]}")
    print(f"\nvanilla block identifiers used ({len(vanilla)}):")
    for b in vanilla:
        print(f"    {b}")
    print(f"\ncustom block identifiers used ({len(custom)}):")
    for b in custom:
        print(f"    {b}")


if __name__ == "__main__":
    main()
