#!/usr/bin/env python3
"""Block identifiers that are known-valid in Bedrock **1.21.0**.

Bedrock has been "flattening" block IDs since 1.16.100. Old identifiers are
kept as aliases forever, but NEW identifiers only work from the version that
introduced them. So the rule used here is:

  * a new-style ID is only used when its introduction version was verified to
    be <= 1.21.0
  * anything unverified uses the ORIGINAL pre-flattening identifier, which is
    always valid

Verified against https://minecraft.wiki/w/Bedrock_Edition_Flattening :
    oak_log / spruce_log / ...            1.20.0    OK
    oak_leaves / spruce_leaves / ...      1.20.70   OK
    oak_planks / ...                      1.20.50   OK
    oak_slab / ...                        1.20.70   OK
    oak_fence / ...                       1.19.80   OK
    grass_block (was grass)               1.20.70   OK
    white_wool / ... (was wool)           1.19.70   OK
    white_concrete / ... (was concrete)   1.20.10   OK
    andesite / granite / diorite          1.20.50   OK
    sugar_cane (was reeds)                1.16.100  OK

Deliberately kept as ORIGINAL ids because the rename was NOT confirmed to be
<= 1.21.0:  tallgrass, waterlily, snow_layer, stonebrick, web, sapling,
double_plant, dirt (with dirt_type states).

Deliberately AVOIDED: doors (heavy block-state churn between versions),
stained glass, coral, anything from 1.21.10+.
"""

# --- ground / stone -------------------------------------------------------
STONE = "minecraft:stone"
COBBLE = "minecraft:cobblestone"
MOSSY_COBBLE = "minecraft:mossy_cobblestone"
ANDESITE = "minecraft:andesite"
GRANITE = "minecraft:granite"
DIORITE = "minecraft:diorite"
DEEPSLATE = "minecraft:deepslate"
COBBLED_DEEPSLATE = "minecraft:cobbled_deepslate"
TUFF = "minecraft:tuff"
CALCITE = "minecraft:calcite"
DRIPSTONE = "minecraft:dripstone_block"
GRAVEL = "minecraft:gravel"
SAND = "minecraft:sand"
SANDSTONE = "minecraft:sandstone"
CLAY = "minecraft:clay"
DIRT = "minecraft:dirt"
COARSE_DIRT = 'minecraft:dirt["dirt_type":"coarse"]'
PODZOL = 'minecraft:dirt["dirt_type":"podzol"]'
GRASS = "minecraft:grass_block"
MOSS = "minecraft:moss_block"
MOSS_CARPET = "minecraft:moss_carpet"
MUD = "minecraft:mud"
PACKED_MUD = "minecraft:packed_mud"
STONEBRICK = "minecraft:stonebrick"
SNOW = "minecraft:snow_layer"
ICE = "minecraft:ice"
OBSIDIAN = "minecraft:obsidian"
BEDROCK_BLOCK = "minecraft:bedrock"
BLACKSTONE = "minecraft:blackstone"
BASALT = "minecraft:basalt"
SMOOTH_BASALT = "minecraft:smooth_basalt"
IRON_BLOCK = "minecraft:iron_block"
IRON_BARS = "minecraft:iron_bars"
BRICKS = "minecraft:brick_block"

# --- liquids / air --------------------------------------------------------
AIR = "minecraft:air"
WATER = "minecraft:water"
LAVA = "minecraft:lava"

# --- wood -----------------------------------------------------------------
OAK_LOG = "minecraft:oak_log"
SPRUCE_LOG = "minecraft:spruce_log"
BIRCH_LOG = "minecraft:birch_log"
JUNGLE_LOG = "minecraft:jungle_log"
DARK_OAK_LOG = "minecraft:dark_oak_log"
ACACIA_LOG = "minecraft:acacia_log"
MANGROVE_LOG = "minecraft:mangrove_log"
OAK_LEAVES = "minecraft:oak_leaves"
SPRUCE_LEAVES = "minecraft:spruce_leaves"
BIRCH_LEAVES = "minecraft:birch_leaves"
JUNGLE_LEAVES = "minecraft:jungle_leaves"
DARK_OAK_LEAVES = "minecraft:dark_oak_leaves"
ACACIA_LEAVES = "minecraft:acacia_leaves"
MANGROVE_LEAVES = "minecraft:mangrove_leaves"
OAK_PLANKS = "minecraft:oak_planks"
SPRUCE_PLANKS = "minecraft:spruce_planks"
DARK_OAK_PLANKS = "minecraft:dark_oak_planks"
OAK_SLAB = "minecraft:oak_slab"
OAK_STAIRS = "minecraft:oak_stairs"
OAK_FENCE = "minecraft:oak_fence"
SPRUCE_FENCE = "minecraft:spruce_fence"
STONE_BRICK_STAIRS = "minecraft:stone_brick_stairs"
LADDER = "minecraft:ladder"

# --- vegetation (original ids on purpose) ---------------------------------
TALLGRASS = "minecraft:tallgrass"
DEADBUSH = "minecraft:deadbush"
WATERLILY = "minecraft:waterlily"
SUGAR_CANE = "minecraft:sugar_cane"
VINE = "minecraft:vine"
BROWN_MUSHROOM = "minecraft:brown_mushroom"
RED_MUSHROOM = "minecraft:red_mushroom"
WEB = "minecraft:web"
MANGROVE_ROOTS = "minecraft:mangrove_roots"
MUDDY_MANGROVE_ROOTS = "minecraft:muddy_mangrove_roots"

# --- functional / props ---------------------------------------------------
CHEST = "minecraft:chest"
BARREL = "minecraft:barrel"
CRAFTING_TABLE = "minecraft:crafting_table"
FURNACE = "minecraft:furnace"
TORCH = "minecraft:torch"
LANTERN = "minecraft:lantern"
SOUL_LANTERN = "minecraft:soul_lantern"
CAMPFIRE = "minecraft:campfire"
GLASS = "minecraft:glass"
GLASS_PANE = "minecraft:glass_pane"
BED = "minecraft:bed"
CAULDRON = "minecraft:cauldron"
ANVIL = "minecraft:anvil"
RAIL = "minecraft:rail"
BOOKSHELF = "minecraft:bookshelf"
NOTEBLOCK = "minecraft:noteblock"
REDSTONE_LAMP = "minecraft:redstone_lamp"
LEVER = "minecraft:lever"
HOPPER = "minecraft:hopper"
CARTOGRAPHY = "minecraft:cartography_table"
LECTERN = "minecraft:lectern"
SMOKER = "minecraft:smoker"
BLAST_FURNACE = "minecraft:blast_furnace"
WHITE_WOOL = "minecraft:white_wool"
GRAY_WOOL = "minecraft:gray_wool"
BROWN_WOOL = "minecraft:brown_wool"
GREEN_WOOL = "minecraft:green_wool"
RED_WOOL = "minecraft:red_wool"
WHITE_CONCRETE = "minecraft:white_concrete"
GRAY_CONCRETE = "minecraft:gray_concrete"
LIGHT_GRAY_CONCRETE = "minecraft:light_gray_concrete"
CYAN_CONCRETE = "minecraft:cyan_concrete"
RED_CONCRETE = "minecraft:red_concrete"
YELLOW_CONCRETE = "minecraft:yellow_concrete"
BLACK_CONCRETE = "minecraft:black_concrete"
BLUE_CONCRETE = "minecraft:blue_concrete"

# --- ores -----------------------------------------------------------------
COAL_ORE = "minecraft:coal_ore"
IRON_ORE = "minecraft:iron_ore"
COPPER_ORE = "minecraft:copper_ore"
GOLD_ORE = "minecraft:gold_ore"
REDSTONE_ORE = "minecraft:redstone_ore"
LAPIS_ORE = "minecraft:lapis_ore"
DIAMOND_ORE = "minecraft:diamond_ore"

# --- custom blocks from this add-on --------------------------------------
LI_RUSTED = "li:rusted_metal"
LI_CONCRETE = "li:damaged_concrete"
LI_MOSSY_CONCRETE = "li:mossy_concrete"
LI_PANEL = "li:lab_panel"
LI_VENT = "li:lab_vent"
LI_LIGHT = "li:emergency_light"
LI_SIGN_QUAR = "li:warning_sign_quarantine"
LI_SIGN_KEEP = "li:warning_sign_keepout"
LI_SIGN_HAND = "li:warning_sign_handwritten"
LI_NOTICE = "li:notice_board"


def _collect():
    ids = set()
    for k, v in globals().items():
        if k.isupper() and isinstance(v, str) and v.startswith(("minecraft:", "li:")):
            ids.add(v.split("[")[0])
    return ids


WHITELIST = _collect()
