"""Generates every .mcfunction in the NPC Kingdom behavior pack.

Design notes
------------
* No scripting API and no experimental toggles are used. All state lives in
  scoreboards and entity tags, so a kingdom survives closing and reopening the
  world.
* ``tick.json`` runs one tiny dispatcher. Everything expensive is gated behind
  a 2 second "slow" pulse that only runs while a Kingdom Core exists, which
  keeps the add-on cheap on phones.
"""

import json
import os

from npck_data import (BUILDINGS, DIALOGUE, LEVELS, ORDERS, RESOURCES,
                       RESOURCE_LABELS, ROLES, ROLE_STATS)

FUNCS = {}

RES_PLAYER = {
    "food": "Food", "wood": "Wood", "stone": "Stone",
    "iron": "Iron", "gold": "Gold", "emerald": "Emeralds",
}

# Palette. All identifiers are the flattened 1.21 block names.
PLANK = "oak_planks"
LOG = "oak_log"
DARKPLANK = "dark_oak_planks"
BRICK = "stone_bricks"
COBBLE = "cobblestone"
ROOF = "bricks"
GLASS = "glass_pane"
LIGHT = "glowstone"
FENCE = "oak_fence"
BARS = "iron_bars"
GOLDB = "gold_block"


def fn(path, lines):
    FUNCS[path] = [ln for ln in lines if ln is not None]


def raw(target, parts):
    return "tellraw %s %s" % (
        target, json.dumps({"rawtext": parts}, separators=(",", ":")))


def say(target, text):
    return raw(target, [{"text": text}])


def actionbar(target, text):
    return "titleraw %s actionbar %s" % (
        target, json.dumps({"rawtext": [{"text": text}]}, separators=(",", ":")))


def title(target, text):
    return "titleraw %s title %s" % (
        target, json.dumps({"rawtext": [{"text": text}]}, separators=(",", ":")))


def score_part(player, objective="npck.res"):
    return {"score": {"name": player, "objective": objective}}


# ===========================================================================
# Structures
# ===========================================================================
def site(hw, hd, clear_h, floor):
    """Level the plot: clear the air above and lay a solid plinth below."""
    return [
        "fill ~-%d ~1 ~-%d ~%d ~%d ~%d air" % (hw, hd, hw, clear_h, hd),
        "fill ~-%d ~-4 ~-%d ~%d ~0 ~%d %s" % (hw, hd, hw, hd, floor),
    ]


def shell(hw, hd, h, wall):
    return ["fill ~-%d ~1 ~-%d ~%d ~%d ~%d %s hollow" % (hw, hd, hw, h, hd, wall)]


def flat_roof(hw, hd, h, block):
    return ["fill ~-%d ~%d ~-%d ~%d ~%d ~%d %s" % (hw, h, hd, hw, h, hd, block)]


def doorway(hd, wide=1):
    """Carve a doorway in the -Z wall and hang a door in it."""
    out = ["fill ~-%d ~1 ~-%d ~%d ~2 ~-%d air" % (wide, hd, wide, hd)]
    out.append('setblock ~ ~1 ~-%d oak_door["direction"=0,"upper_block_bit"=false]' % hd)
    out.append('setblock ~ ~2 ~-%d oak_door["direction"=0,"upper_block_bit"=true]' % hd)
    return out


def windows(hw, hd, y=2):
    out = []
    for x in (-hw, hw):
        for z in (-1, 1):
            out.append("setblock ~%d ~%d ~%d %s" % (x, y, z, GLASS))
    for z in (-hd, hd):
        for x in (-1, 1):
            out.append("setblock ~%d ~%d ~%d %s" % (x, y, z, GLASS))
    return out


def bed(x, z, block="bed"):
    """Beds are two blocks in Bedrock; place foot and head so they render."""
    return [
        'setblock ~%d ~1 ~%d %s["direction"=0,"head_piece_bit"=false]' % (x, z, block),
        'setblock ~%d ~1 ~%d %s["direction"=0,"head_piece_bit"=true]' % (x, z + 1, block),
    ]


def corner_posts(hw, hd, h, block=LOG):
    out = []
    for x in (-hw, hw):
        for z in (-hd, hd):
            out.append("fill ~%d ~1 ~%d ~%d ~%d ~%d %s" % (x, z, x, h - 1, z, block))
    return out


def lights(hw, hd, h):
    out = []
    for x in (-hw + 1, hw - 1):
        for z in (-hd + 1, hd - 1):
            out.append("setblock ~%d ~%d ~%d %s" % (x, h - 1, z, LIGHT))
    return out


def struct_house_small():
    hw = hd = 3
    h = 4
    out = site(hw, hd, h + 3, COBBLE)
    out += shell(hw, hd, h, PLANK)
    out += corner_posts(hw, hd, h)
    out += flat_roof(hw + 1, hd + 1, h + 1, ROOF)
    out += ["fill ~-%d ~%d ~-%d ~%d ~%d ~%d %s" % (hw - 1, h + 2, hd - 1, hw - 1, h + 2, hd - 1, ROOF)]
    out += doorway(hd)
    out += windows(hw, hd)
    out += lights(hw, hd, h)
    out += [
        "setblock ~-2 ~1 ~2 crafting_table",
        "setblock ~2 ~1 ~2 chest",
    ]
    out += bed(-2, -2)
    return out


def struct_storage():
    hw = hd = 4
    h = 4
    out = site(hw, hd, h + 3, COBBLE)
    out += shell(hw, hd, h, PLANK)
    out += corner_posts(hw, hd, h)
    out += flat_roof(hw + 1, hd + 1, h + 1, DARKPLANK)
    out += doorway(hd, wide=1)
    out += lights(hw, hd, h)
    for x in (-3, -1, 1, 3):
        out.append("fill ~%d ~1 ~3 ~%d ~2 ~3 barrel" % (x, x))
    out += [
        "fill ~-3 ~1 ~-2 ~-3 ~2 ~2 chest",
        "fill ~3 ~1 ~-2 ~3 ~2 ~2 chest",
        "setblock ~ ~1 ~ hay_block",
    ]
    return out


def struct_farm():
    hw = hd = 5
    out = site(hw, hd, 6, "dirt")
    out += [
        "fill ~-%d ~ ~-%d ~%d ~ ~%d farmland" % (hw - 1, hd - 1, hw - 1, hd - 1),
        "setblock ~ ~ ~ water",
        "fill ~-4 ~1 ~-4 ~4 ~1 ~4 wheat",
        "setblock ~ ~1 ~ air",
        "fill ~-2 ~1 ~-4 ~-2 ~1 ~4 carrots",
        "fill ~2 ~1 ~-4 ~2 ~1 ~4 potatoes",
    ]
    # fence the plot so animals stay out
    out += [
        "fill ~-%d ~1 ~-%d ~%d ~1 ~-%d %s" % (hw, hd, hw, hd, FENCE),
        "fill ~-%d ~1 ~%d ~%d ~1 ~%d %s" % (hw, hd, hw, hd, FENCE),
        "fill ~-%d ~1 ~-%d ~-%d ~1 ~%d %s" % (hw, hd, hw, hd, FENCE),
        "fill ~%d ~1 ~-%d ~%d ~1 ~%d %s" % (hw, hd, hw, hd, FENCE),
        "setblock ~ ~1 ~-%d air" % hd,
        "setblock ~-4 ~1 ~-4 %s" % LIGHT,
        "setblock ~4 ~1 ~4 %s" % LIGHT,
        "setblock ~4 ~2 ~-4 hay_block",
    ]
    return out


def struct_town_hall():
    hw = hd = 5
    h = 6
    out = site(hw, hd, h + 4, BRICK)
    out += shell(hw, hd, h, BRICK)
    out += corner_posts(hw, hd, h, LOG)
    out += flat_roof(hw + 1, hd + 1, h + 1, DARKPLANK)
    out += flat_roof(hw - 1, hd - 1, h + 2, DARKPLANK)
    out += doorway(hd, wide=1)
    out += windows(hw, hd, 3)
    out += lights(hw, hd, h)
    out += [
        "setblock ~ ~1 ~4 lectern",
        "fill ~-3 ~1 ~3 ~-2 ~1 ~3 bookshelf",
        "fill ~2 ~1 ~3 ~3 ~1 ~3 bookshelf",
        "setblock ~ ~%d ~ bell" % (h + 3),
        "setblock ~-4 ~1 ~-4 chest",
    ]
    return out


def struct_market():
    hw = hd = 5
    out = site(hw, hd, 6, COBBLE)
    stalls = [(-3, -3), (3, -3), (-3, 3), (3, 3)]
    for x, z in stalls:
        out += [
            "fill ~%d ~1 ~%d ~%d ~3 ~%d %s" % (x - 1, z, x - 1, z, FENCE),
            "fill ~%d ~1 ~%d ~%d ~3 ~%d %s" % (x + 1, z, x + 1, z, FENCE),
            "fill ~%d ~4 ~%d ~%d ~4 ~%d %s" % (x - 1, z - 1, x + 1, z + 1, "red_wool"),
            "setblock ~%d ~1 ~%d barrel" % (x, z),
            "setblock ~%d ~2 ~%d %s" % (x, z, LIGHT),
        ]
    out += [
        "setblock ~ ~1 ~ %s" % LIGHT,
        "setblock ~ ~2 ~ hay_block",
        "setblock ~-1 ~1 ~ composter",
        "setblock ~1 ~1 ~ cartography_table",
    ]
    return out


def struct_blacksmith():
    hw = hd = 4
    h = 5
    out = site(hw, hd, h + 3, COBBLE)
    out += shell(hw, hd, h, COBBLE)
    out += corner_posts(hw, hd, h, LOG)
    out += flat_roof(hw + 1, hd + 1, h + 1, DARKPLANK)
    out += doorway(hd)
    out += windows(hw, hd)
    out += lights(hw, hd, h)
    out += [
        "setblock ~-2 ~1 ~2 furnace",
        "setblock ~-1 ~1 ~2 blast_furnace",
        "setblock ~1 ~1 ~2 anvil",
        "setblock ~2 ~1 ~2 smithing_table",
        "setblock ~2 ~1 ~-2 grindstone",
        "setblock ~-2 ~1 ~-2 cauldron",
        "setblock ~ ~1 ~3 %s" % LIGHT,
    ]
    return out


def struct_guard_tower():
    hw = hd = 2
    h = 11
    out = site(hw + 1, hd + 1, h + 3, BRICK)
    out += shell(hw, hd, h, BRICK)
    out += [
        "fill ~-%d ~%d ~-%d ~%d ~%d ~%d air" % (hw - 1, h, hd - 1, hw - 1, h, hd - 1),
        "fill ~-%d ~%d ~-%d ~%d ~%d ~%d cobblestone_wall" % (hw, h + 1, hd, hw, h + 1, hd),
        "fill ~-%d ~%d ~-%d ~%d ~%d ~%d air" % (hw - 1, h + 1, hd - 1, hw - 1, h + 1, hd - 1),
        "setblock ~ ~%d ~ %s" % (h - 1, LIGHT),
    ]
    out += ['fill ~ ~1 ~%d ~ ~%d ~%d ladder["facing_direction"=3]'
            % (hd - 1, h - 1, hd - 1)]
    out += doorway(hd)
    out += ["setblock ~-1 ~1 ~-1 %s" % LIGHT]
    return out


def struct_barracks():
    hw, hd, h = 5, 4, 5
    out = site(hw, hd, h + 3, COBBLE)
    out += shell(hw, hd, h, BRICK)
    out += corner_posts(hw, hd, h, LOG)
    out += flat_roof(hw + 1, hd + 1, h + 1, DARKPLANK)
    out += doorway(hd)
    out += windows(hw, hd)
    out += lights(hw, hd, h)
    for x in (-3, 0, 3):
        out += bed(x, 2)
    out += [
        "setblock ~-4 ~1 ~-3 chest",
        "setblock ~4 ~1 ~-3 chest",
        "setblock ~ ~1 ~-3 crafting_table",
    ]
    return out


def struct_training_ground():
    hw = hd = 5
    out = site(hw, hd, 6, COBBLE)
    out += [
        "fill ~-%d ~1 ~-%d ~%d ~1 ~-%d %s" % (hw, hd, hw, hd, FENCE),
        "fill ~-%d ~1 ~%d ~%d ~1 ~%d %s" % (hw, hd, hw, hd, FENCE),
        "fill ~-%d ~1 ~-%d ~-%d ~1 ~%d %s" % (hw, hd, hw, hd, FENCE),
        "fill ~%d ~1 ~-%d ~%d ~1 ~%d %s" % (hw, hd, hw, hd, FENCE),
        "setblock ~ ~1 ~-%d air" % hd,
    ]
    for x in (-3, 0, 3):
        out += [
            "fill ~%d ~1 ~3 ~%d ~3 ~3 hay_block" % (x, x),
            "setblock ~%d ~4 ~3 target" % x,
        ]
    out += [
        "setblock ~-3 ~1 ~-3 %s" % LIGHT,
        "setblock ~3 ~1 ~-3 %s" % LIGHT,
        "setblock ~ ~1 ~ crafting_table",
    ]
    return out


def struct_hospital():
    hw = hd = 4
    h = 5
    out = site(hw, hd, h + 3, COBBLE)
    out += shell(hw, hd, h, "quartz_block")
    out += corner_posts(hw, hd, h, LOG)
    out += flat_roof(hw + 1, hd + 1, h + 1, "red_wool")
    out += doorway(hd)
    out += windows(hw, hd)
    out += lights(hw, hd, h)
    for x in (-2, 2):
        out += bed(x, 1)
    out += [
        "setblock ~ ~1 ~3 brewing_stand",
        "setblock ~-3 ~1 ~-2 cauldron",
        "setblock ~3 ~1 ~-2 chest",
    ]
    return out


def struct_stable():
    hw, hd, h = 5, 3, 4
    out = site(hw, hd, h + 3, COBBLE)
    out += shell(hw, hd, h, PLANK)
    out += corner_posts(hw, hd, h, LOG)
    out += flat_roof(hw + 1, hd + 1, h + 1, DARKPLANK)
    out += ["fill ~-3 ~1 ~-%d ~3 ~2 ~-%d air" % (hd, hd)]
    out += lights(hw, hd, h)
    for x in (-2, 2):
        out.append("fill ~%d ~1 ~-1 ~%d ~2 ~2 %s" % (x, x, FENCE))
    out += [
        "setblock ~-4 ~1 ~2 hay_block",
        "setblock ~4 ~1 ~2 hay_block",
        "setblock ~ ~1 ~2 hay_block",
    ]
    return out


def struct_prison():
    hw = hd = 4
    h = 5
    out = site(hw, hd, h + 3, COBBLE)
    out += shell(hw, hd, h, COBBLE)
    out += flat_roof(hw + 1, hd + 1, h + 1, BRICK)
    out += doorway(hd)
    out += lights(hw, hd, h)
    out += [
        "fill ~-3 ~1 ~ ~3 ~3 ~ %s" % BARS,
        "setblock ~ ~1 ~ air",
        "setblock ~ ~2 ~ air",
        "fill ~-3 ~1 ~3 ~-3 ~3 ~3 %s" % BARS,
        "setblock ~-2 ~1 ~2 hay_block",
        "setblock ~2 ~1 ~2 hay_block",
    ]
    return out


def struct_treasury():
    hw = hd = 3
    h = 4
    out = site(hw, hd, h + 3, BRICK)
    out += shell(hw, hd, h, BRICK)
    out += flat_roof(hw + 1, hd + 1, h + 1, GOLDB)
    out += doorway(hd)
    out += lights(hw, hd, h)
    out += [
        "fill ~-2 ~1 ~2 ~2 ~1 ~2 %s" % GOLDB,
        "fill ~-2 ~2 ~2 ~2 ~2 ~2 emerald_block",
        "setblock ~-2 ~1 ~-1 chest",
        "setblock ~2 ~1 ~-1 chest",
        "setblock ~ ~1 ~ %s" % GOLDB,
    ]
    return out


def struct_castle():
    hw = hd = 7
    h = 12
    out = site(hw + 1, hd + 1, h + 5, BRICK)
    out += shell(hw, hd, h, BRICK)
    out += flat_roof(hw, hd, h, BRICK)
    # corner turrets
    for x in (-hw, hw):
        for z in (-hd, hd):
            out += [
                "fill ~%d ~1 ~%d ~%d ~%d ~%d %s" % (x, z, x, h + 3, z, BRICK),
                "setblock ~%d ~%d ~%d %s" % (x, h + 4, z, LIGHT),
            ]
    # battlements
    out += [
        "fill ~-%d ~%d ~-%d ~%d ~%d ~%d cobblestone_wall" % (hw, h + 1, hd, hw, h + 1, hd),
        "fill ~-%d ~%d ~-%d ~%d ~%d ~%d air" % (hw - 1, h + 1, hd - 1, hw - 1, h + 1, hd - 1),
    ]
    # great doorway
    out += [
        "fill ~-1 ~1 ~-%d ~1 ~3 ~-%d air" % (hd, hd),
        'setblock ~ ~1 ~-%d oak_door["direction"=0,"upper_block_bit"=false]' % hd,
        'setblock ~ ~2 ~-%d oak_door["direction"=0,"upper_block_bit"=true]' % hd,
    ]
    for z in (-3, 0, 3):
        out.append("fill ~-%d ~4 ~%d ~-%d ~5 ~%d %s" % (hw, z, hw, z, GLASS))
        out.append("fill ~%d ~4 ~%d ~%d ~5 ~%d %s" % (hw, z, hw, z, GLASS))
    out += [
        "setblock ~-5 ~%d ~-5 %s" % (h - 1, LIGHT),
        "setblock ~5 ~%d ~-5 %s" % (h - 1, LIGHT),
        "setblock ~-5 ~%d ~5 %s" % (h - 1, LIGHT),
        "setblock ~5 ~%d ~5 %s" % (h - 1, LIGHT),
    ]
    return out


def struct_throne_room():
    out = [
        "fill ~-6 ~1 ~-6 ~6 ~1 ~6 %s" % "polished_andesite",
        "fill ~-2 ~1 ~-6 ~2 ~1 ~5 red_carpet",
        "fill ~-2 ~1 ~5 ~2 ~1 ~5 %s" % GOLDB,
        "fill ~-1 ~2 ~5 ~1 ~2 ~5 %s" % GOLDB,
        "setblock ~ ~3 ~5 %s" % GOLDB,
        "setblock ~-2 ~2 ~5 %s" % LIGHT,
        "setblock ~2 ~2 ~5 %s" % LIGHT,
        "fill ~-4 ~1 ~4 ~-4 ~4 ~4 %s" % GOLDB,
        "fill ~4 ~1 ~4 ~4 ~4 ~4 %s" % GOLDB,
        "setblock ~-4 ~5 ~4 %s" % LIGHT,
        "setblock ~4 ~5 ~4 %s" % LIGHT,
        "fill ~-6 ~2 ~-2 ~-6 ~4 ~2 red_wool",
        "fill ~6 ~2 ~-2 ~6 ~4 ~2 red_wool",
        "setblock ~-5 ~1 ~-4 chest",
        "setblock ~5 ~1 ~-4 chest",
        "execute unless entity @e[type=npck:throne_seat,r=8] run summon npck:throne_seat ~ ~1.55 ~5",
    ]
    return out


def struct_walls():
    r = 38
    out = []
    for y0, y1, block in ((-3, 0, BRICK), (1, 5, BRICK)):
        out += [
            "fill ~-%d ~%d ~-%d ~%d ~%d ~-%d %s" % (r, y0, r, r, y1, r, block),
            "fill ~-%d ~%d ~%d ~%d ~%d ~%d %s" % (r, y0, r, r, y1, r, block),
            "fill ~-%d ~%d ~-%d ~-%d ~%d ~%d %s" % (r, y0, r - 1, r, y1, r - 1, block),
            "fill ~%d ~%d ~-%d ~%d ~%d ~%d %s" % (r, y0, r - 1, r, y1, r - 1, block),
        ]
    out += [
        "fill ~-%d ~6 ~-%d ~%d ~6 ~-%d cobblestone_wall" % (r, r, r, r),
        "fill ~-%d ~6 ~%d ~%d ~6 ~%d cobblestone_wall" % (r, r, r, r),
        "fill ~-%d ~6 ~-%d ~-%d ~6 ~%d cobblestone_wall" % (r, r - 1, r, r - 1),
        "fill ~%d ~6 ~-%d ~%d ~6 ~%d cobblestone_wall" % (r, r - 1, r, r - 1),
        # gate opening in the north wall
        "fill ~-3 ~1 ~-%d ~3 ~4 ~-%d air" % (r, r),
    ]
    for x in (-30, -15, 0, 15, 30):
        out.append("setblock ~%d ~7 ~-%d %s" % (x, r, LIGHT))
        out.append("setblock ~%d ~7 ~%d %s" % (x, r, LIGHT))
    for z in (-30, -15, 0, 15, 30):
        out.append("setblock ~-%d ~7 ~%d %s" % (r, z, LIGHT))
        out.append("setblock ~%d ~7 ~%d %s" % (r, z, LIGHT))
    return out


def struct_main_gate():
    out = [
        "fill ~-6 ~1 ~-2 ~6 ~11 ~2 air",
        "fill ~-6 ~-3 ~-2 ~6 ~0 ~2 %s" % BRICK,
        "fill ~-6 ~1 ~-2 ~-4 ~9 ~2 %s" % BRICK,
        "fill ~4 ~1 ~-2 ~6 ~9 ~2 %s" % BRICK,
        "fill ~-3 ~5 ~-2 ~3 ~7 ~2 %s" % BRICK,
        "fill ~-3 ~1 ~-2 ~3 ~4 ~2 air",
        "fill ~-3 ~8 ~-2 ~3 ~8 ~2 %s" % DARKPLANK,
        "fill ~-6 ~10 ~-2 ~6 ~10 ~2 cobblestone_wall",
        "fill ~-5 ~10 ~-1 ~5 ~10 ~1 air",
        "fill ~-3 ~5 ~ ~3 ~5 ~ %s" % BARS,
        "setblock ~-5 ~9 ~ %s" % LIGHT,
        "setblock ~5 ~9 ~ %s" % LIGHT,
        "setblock ~-4 ~4 ~-2 %s" % LIGHT,
        "setblock ~4 ~4 ~-2 %s" % LIGHT,
        "fill ~-6 ~6 ~-3 ~-4 ~8 ~-3 red_wool",
        "fill ~4 ~6 ~-3 ~6 ~8 ~-3 red_wool",
    ]
    return out


def struct_bandit_camp():
    out = site(7, 7, 8, "coarse_dirt")
    out += [
        "setblock ~ ~1 ~ campfire",
        "fill ~-5 ~1 ~-5 ~5 ~1 ~-5 %s" % FENCE,
        "fill ~-5 ~1 ~5 ~5 ~1 ~5 %s" % FENCE,
        "fill ~-5 ~1 ~-4 ~-5 ~1 ~4 %s" % FENCE,
        "fill ~5 ~1 ~-4 ~5 ~1 ~4 %s" % FENCE,
        "setblock ~ ~1 ~-5 air",
        "fill ~-4 ~1 ~-3 ~-2 ~3 ~-1 %s hollow" % DARKPLANK,
        "fill ~2 ~1 ~1 ~4 ~3 ~3 %s hollow" % DARKPLANK,
        "setblock ~-3 ~1 ~-3 chest",
        "setblock ~3 ~1 ~3 chest",
        "setblock ~-4 ~2 ~4 %s" % LIGHT,
    ]
    return out


STRUCTS = {
    "house_small": struct_house_small,
    "storage": struct_storage,
    "farm": struct_farm,
    "town_hall": struct_town_hall,
    "market": struct_market,
    "blacksmith": struct_blacksmith,
    "guard_tower": struct_guard_tower,
    "barracks": struct_barracks,
    "training_ground": struct_training_ground,
    "hospital": struct_hospital,
    "stable": struct_stable,
    "prison": struct_prison,
    "treasury": struct_treasury,
    "castle": struct_castle,
    "throne_room": struct_throne_room,
    "walls": struct_walls,
    "main_gate": struct_main_gate,
    "bandit_camp": struct_bandit_camp,
}

BUILDING_STRUCT = {
    "house_1": "house_small", "house_2": "house_small",
    "house_3": "house_small", "house_4": "house_small",
    "storage": "storage", "farm": "farm", "town_hall": "town_hall",
    "market": "market", "blacksmith": "blacksmith",
    "guard_tower": "guard_tower", "barracks": "barracks",
    "training_ground": "training_ground", "hospital": "hospital",
    "stable": "stable", "prison": "prison", "walls": "walls",
    "main_gate": "main_gate", "castle": "castle",
    "throne_room": "throne_room", "treasury": "treasury",
}


# ===========================================================================
# Core loop
# ===========================================================================
def build_core_functions():
    fn("npck/tick", [
        "# One tiny dispatcher; everything heavy hangs off the 2s pulse.",
        "execute as @e[family=npck_marker] at @s run function npck/sys/marker",
        "execute as @e[type=npck:kingdom_core,tag=!npck_init] at @s run function npck/kingdom/found",
        "execute if entity @e[type=npck:kingdom_core,tag=npck_init] run function npck/sys/clock",
    ])

    fn("npck/sys/clock", [
        "scoreboard players add #clock npck.sys 1",
        "execute if score #clock npck.sys matches 40.. run function npck/sys/slow",
    ])

    setup = [
        "# Objectives are created once and then persist with the world.",
        'scoreboard objectives add npck.res dummy "§6§lKINGDOM STORAGE"',
        "scoreboard objectives add npck.sys dummy npckSystem",
        "scoreboard objectives add npck.order dummy npckOrder",
        "scoreboard objectives add npck.job dummy npckJob",
        "scoreboard objectives add npck.rec dummy npckRecruit",
    ]
    for res in RESOURCES:
        setup.append("scoreboard players add %s npck.res 0" % RES_PLAYER[res])
    for key in ("#founded", "#level", "#clock", "#buildq", "#buildt", "#jobt",
                "#raidt", "#raidlen", "#raidactive", "#wave", "#dir",
                "#bossdue", "#daystate", "#celebt", "#repairq",
                "#ord", "#prodmsg", "#buildwarn"):
        setup.append("scoreboard players add %s npck.sys 0" % key)
    setup += [
        "scoreboard players set #c3 npck.sys 3",
        "scoreboard players set #c4 npck.sys 4",
        "scoreboard objectives setdisplay sidebar npck.res",
    ]
    fn("npck/sys/setup", setup)

    fn("npck/setup", [
        "function npck/sys/setup",
        say("@s", "§6[NPC Kingdom] §fSystem ready. Place a §eKingdom Core§f to begin."),
        "function npck/help",
    ])

    fn("npck/sys/slow", [
        "scoreboard players set #clock npck.sys 0",
        "# housekeeping that does not need the core's position",
        "execute as @e[family=npck] unless score @s npck.order matches 0.. run function npck/npc/register",
        "execute as @a at @s run tp @e[family=npck_recruited,scores={npck.order=1},rm=40] ~ ~1 ~",
        "execute as @a at @s run tp @e[family=npck,scores={npck.order=1},rm=20] ~ ~1 ~",
        "execute if score #celebt npck.sys matches 1.. run scoreboard players remove #celebt npck.sys 1",
        "execute if score #celebt npck.sys matches 0 run function npck/kingdom/celebrate_end",
        "execute as @e[type=npck:kingdom_core,tag=npck_init] at @s run function npck/sys/pulse",
    ])

    fn("npck/sys/pulse", [
        "# runs as/at the Kingdom Core every 2 seconds",
        "function npck/npc/maintain",
        "function npck/npc/jobs",
        "execute if entity @e[type=npck:kingdom_core,family=npck_night] run function npck/npc/night",
        "execute if entity @e[type=npck:kingdom_core,family=npck_day] run function npck/npc/day",
        "function npck/kingdom/upgrade_check",
        "function npck/kingdom/build_step",
        "function npck/raid/timer",
    ])

    fn("npck/sys/marker", [
        "execute if entity @s[type=npck:m_tap] run function npck/orders/tap",
        "execute if entity @s[type=npck:m_rally] run function npck/orders/rally",
        "execute if entity @s[type=npck:m_talk] run function npck/npc/talk",
        "execute if entity @s[type=npck:m_core] run function npck/kingdom/core_use",
        "kill @s",
    ])


# ===========================================================================
# Founding
# ===========================================================================
def build_kingdom_functions():
    fn("npck/kingdom/found", [
        "tag @s add npck_init",
        "function npck/sys/setup",
        "execute if score #founded npck.sys matches 1.. run function npck/kingdom/reject",
        "execute unless score #founded npck.sys matches 1.. run function npck/kingdom/establish",
    ])

    fn("npck/kingdom/reject", [
        say("@a[r=48]", "§c[Kingdom] §fYour realm already has a Kingdom Core. Only one may stand."),
        "particle minecraft:large_explosion ~ ~1 ~",
        "playsound random.fizz @a[r=16] ~ ~ ~",
        "give @p[r=16] npck:kingdom_core 1",
        "kill @s",
    ])

    fn("npck/kingdom/establish", [
        "scoreboard players set #founded npck.sys 1",
        "scoreboard players set #level npck.sys 1",
        "scoreboard players set #buildq npck.sys 0",
        "scoreboard players set #daystate npck.sys 1",
        "scoreboard players set #celebt npck.sys -1",
        "scoreboard objectives setdisplay sidebar npck.res",
        "fill ~-5 ~ ~-5 ~5 ~5 ~5 air",
        "fill ~-5 ~-1 ~-5 ~5 ~-1 ~5 %s" % BRICK,
        "fill ~-2 ~-1 ~-2 ~2 ~-1 ~2 polished_andesite",
        "setblock ~ ~-1 ~ %s" % GOLDB,
        "setblock ~-5 ~ ~-5 %s" % LIGHT,
        "setblock ~5 ~ ~-5 %s" % LIGHT,
        "setblock ~-5 ~ ~5 %s" % LIGHT,
        "setblock ~5 ~ ~5 %s" % LIGHT,
        "particle minecraft:totem_particle ~ ~1 ~",
        "playsound beacon.activate @a[r=48] ~ ~ ~",
        title("@a[r=48]", "§6§lA KINGDOM IS BORN"),
        say("@a", "§6§l[KINGDOM] §r§eYour §fCamp §ehas been founded! You are its ruler."),
        say("@a[r=48]", "§7Tap the Core with the §eRoyal Ledger§7 for a full report."),
        "function npck/kingdom/starter_kit",
        "function npck/help",
    ])

    fn("npck/kingdom/starter_kit", [
        "give @p[r=24] npck:command_staff 1",
        "give @p[r=24] npck:command_banner 1",
        "give @p[r=24] npck:royal_ledger 1",
        "give @p[r=24] npck:celebration_horn 1",
        "give @p[r=24] npck:royal_crown 1",
        "give @p[r=24] minecraft:emerald 8",
        "summon npck:builder ~2 ~1 ~2",
        "summon npck:farmer ~-2 ~1 ~2",
        "summon npck:lumberjack ~2 ~1 ~-2",
        "summon npck:guard ~-2 ~1 ~-2",
        say("@a[r=48]", "§a[Kingdom] §fFour settlers have joined you. Give them an §aemerald§f to recruit them."),
    ])

    # ---- status report ----------------------------------------------------
    status = [
        say("@a[r=24]", "§6§l===== KINGDOM REPORT ====="),
    ]
    for lvl, (name, _req) in LEVELS.items():
        status.append(
            "execute if score #level npck.sys matches %d run %s"
            % (lvl, say("@a[r=24]", "§eRank: §f%s §7(Level %d/5)" % (name, lvl))))
    for res in RESOURCES:
        status.append(raw("@a[r=24]", [
            {"text": "§7 - §f%s: §a" % RESOURCE_LABELS[res]},
            score_part(RES_PLAYER[res]),
        ]))
    status.append(say("@a[r=24]", "§7Live storage is always shown on the sidebar."))
    for lvl in (1, 2, 3, 4):
        req = LEVELS[lvl][1]
        need = ", ".join("%d %s" % (v, RESOURCE_LABELS[k])
                         for k, v in req.items() if v)
        status.append(
            "execute if score #level npck.sys matches %d run %s"
            % (lvl, say("@a[r=24]", "§eNext (%s): §f%s" % (LEVELS[lvl + 1][0], need))))
    status.append(
        "execute if score #level npck.sys matches 5 run %s"
        % say("@a[r=24]", "§6Your realm has reached its greatest form."))
    status.append("execute if score Emeralds npck.res matches 8.. run function npck/kingdom/tax")
    status.append("playsound random.orb @a[r=16] ~ ~ ~")
    fn("npck/kingdom/status", status)

    fn("npck/kingdom/tax", [
        "scoreboard players remove Emeralds npck.res 8",
        "give @p[r=24] minecraft:emerald 8",
        say("@a[r=24]", "§6[Treasury] §fTaxes collected: §a8 emeralds§f delivered to the crown."),
        "playsound random.levelup @a[r=16] ~ ~ ~",
    ])

    # ---- upgrades ---------------------------------------------------------
    check = ["# only the core runs this, every 2 seconds"]
    for lvl in (1, 2, 3, 4):
        req = LEVELS[lvl][1]
        conds = "".join(
            " if score %s npck.res matches %d.." % (RES_PLAYER[k], v)
            for k, v in req.items() if v)
        check.append(
            "execute if score #level npck.sys matches %d%s run function npck/kingdom/up_%d"
            % (lvl, conds, lvl + 1))
    fn("npck/kingdom/upgrade_check", check)

    for lvl in (1, 2, 3, 4):
        req = LEVELS[lvl][1]
        nxt = lvl + 1
        lines = []
        for k, v in req.items():
            if v:
                lines.append("scoreboard players remove %s npck.res %d" % (RES_PLAYER[k], v))
        lines += [
            "scoreboard players set #level npck.sys %d" % nxt,
            title("@a", "§6§l%s" % LEVELS[nxt][0].upper()),
            say("@a", "§6§l[KINGDOM] §r§aYour %s has grown into a §e%s§a!"
                % (LEVELS[lvl][0], LEVELS[nxt][0].upper())),
            say("@a", "§7New buildings will be raised over the next few minutes."),
            "playsound random.levelup @a ~ ~ ~",
            "particle minecraft:totem_particle ~ ~2 ~",
            "summon minecraft:fireworks_rocket ~ ~3 ~",
            "function npck/kingdom/celebrate",
        ]
        fn("npck/kingdom/up_%d" % nxt, lines)

    # ---- gradual construction --------------------------------------------
    fn("npck/kingdom/build_step", [
        "scoreboard players add #buildt npck.sys 1",
        "execute if score #buildt npck.sys matches 4.. run function npck/kingdom/build_gate",
    ])
    fn("npck/kingdom/build_gate", [
        "scoreboard players set #buildt npck.sys 0",
        "execute if entity @e[family=npck_builder,r=72] run function npck/kingdom/build_next",
        "execute unless entity @e[family=npck_builder,r=72] run function npck/kingdom/need_builder",
    ])
    fn("npck/kingdom/need_builder", [
        "scoreboard players add #buildwarn npck.sys 1",
        "execute if score #buildwarn npck.sys matches 30.. run scoreboard players set #buildwarn npck.sys 0",
        "execute if score #buildwarn npck.sys matches 1 if score #buildq npck.sys matches ..19 run "
        + say("@a[r=64]", "§e[Kingdom] §fNo Builder is present - construction has stopped."),
    ])

    nxt = []
    for idx, (bid, label, level, _dx, _dz) in enumerate(BUILDINGS):
        nxt.append(
            "execute if score #buildq npck.sys matches %d if score #level npck.sys matches %d.. "
            "run function npck/build/%s" % (idx, level, bid))
    fn("npck/kingdom/build_next", nxt)

    for idx, (bid, label, level, dx, dz) in enumerate(BUILDINGS):
        fn("npck/build/%s" % bid, [
            "scoreboard players add #buildq npck.sys 1",
            "function npck/place/%s" % bid,
            say("@a[r=80]", "§6[Kingdom] §fThe builders have completed the §e%s§f." % label),
            "playsound random.anvil_use @a[r=64] ~ ~ ~",
            "execute as @e[family=npck_builder,r=48] at @s run particle minecraft:villager_happy ~ ~2 ~",
        ])
        fn("npck/place/%s" % bid, [
            "execute positioned ~%d ~-1 ~%d run function npck/struct/%s"
            % (dx, dz, BUILDING_STRUCT[bid]),
        ])

    # repairs walk the finished buildings one at a time
    repair = [
        "scoreboard players add #repairq npck.sys 1",
        "execute if score #repairq npck.sys matches 20.. run scoreboard players set #repairq npck.sys 0",
    ]
    for idx, (bid, _label, _level, _dx, _dz) in enumerate(BUILDINGS):
        repair.append(
            "execute if score #repairq npck.sys matches %d if score #buildq npck.sys matches %d.. "
            "run function npck/place/%s" % (idx, idx + 1, bid))
    repair.append("playsound random.anvil_land @a[r=48] ~ ~ ~")
    fn("npck/kingdom/repair_step", repair)

    fn("npck/kingdom/repair", [
        "execute at @e[type=npck:kingdom_core,c=1] run function npck/kingdom/repair_step",
        say("@s", "§6[Kingdom] §fRepair crews dispatched."),
    ])

    # ---- celebrations -----------------------------------------------------
    fn("npck/kingdom/celebrate", [
        say("@a", "§6§l[KINGDOM] §r§eLet the celebration begin!"),
        "playsound firework.launch @a[r=64] ~ ~ ~",
        "summon minecraft:fireworks_rocket ~2 ~2 ~2",
        "summon minecraft:fireworks_rocket ~-2 ~2 ~-2",
        "particle minecraft:totem_particle ~ ~2 ~",
        "execute as @e[family=npck,r=64] run scoreboard players set @s npck.order 11",
        "execute as @e[family=npck,r=64] at @s run function npck/orders/apply_silent",
        "scoreboard players set #celebt npck.sys 15",
    ])
    fn("npck/kingdom/celebrate_end", [
        "scoreboard players set #celebt npck.sys -1",
        "execute as @e[family=npck,scores={npck.order=11}] run scoreboard players set @s npck.order 0",
        "execute as @e[family=npck,scores={npck.order=0}] at @s run function npck/orders/apply_silent",
        say("@a[r=64]", "§7[Kingdom] §fThe festivities end. Back to work!"),
    ])

    # ---- core interactions -------------------------------------------------
    held = lambda i: "{item=%s,location=slot.weapon.mainhand}" % i
    fn("npck/kingdom/core_use", [
        "execute if entity @p[r=6,hasitem=%s] run function npck/kingdom/celebrate" % held("npck:celebration_horn"),
        "execute if entity @p[r=6,hasitem=%s] run function npck/raid/declare" % held("npck:war_horn"),
        "execute if entity @p[r=6,hasitem=%s] run function npck/kingdom/repair_step" % held("npck:command_staff"),
        "execute unless entity @p[r=6,hasitem=[%s,%s,%s]] run function npck/kingdom/status"
        % (held("npck:celebration_horn"), held("npck:war_horn"), held("npck:command_staff")),
    ])


# ===========================================================================
# NPC behaviour helpers
# ===========================================================================
def build_npc_functions():
    fn("npck/npc/register", [
        "scoreboard players set @s npck.order 0",
        "scoreboard players set @s npck.job 0",
        "event entity @s npck:order_work",
    ])

    fn("npck/npc/maintain", [
        "# stragglers, lava and stuck pathing - all resolved from the core",
        "execute as @e[family=npck,r=200,rm=90,scores={npck.order=!1}] at @s run tag @s add npck_recall",
        "execute as @e[family=npck,r=200] at @s if block ~ ~ ~ lava run tag @s add npck_recall",
        "execute as @e[family=npck,r=200] at @s if block ~ ~ ~ flowing_lava run tag @s add npck_recall",
        "execute as @e[family=npck,r=200] at @s if block ~ ~ ~ fire run tag @s add npck_recall",
        "tp @e[family=npck,tag=npck_recall] ~ ~1 ~",
        "effect @e[family=npck,tag=npck_recall] fire_resistance 6 0 true",
        "tag @e[family=npck,tag=npck_recall] remove npck_recall",
        "execute as @e[family=npck_recruited,r=96] unless score @s npck.rec matches 1 run function npck/npc/recruited",
        "# soldiers react to danger without being told",
        "execute as @e[family=npck_soldier,r=80,scores={npck.order=0}] at @s if entity @e[family=npck_enemy,r=16] run function npck/npc/alert",
        "execute as @e[family=npck_soldier,r=80,scores={npck.order=0}] at @s if entity @e[family=monster,r=16] run function npck/npc/alert",
        "execute as @e[family=npck_soldier,r=80,scores={npck.order=4},tag=npck_alerted] at @s unless entity @e[family=npck_enemy,r=28] unless entity @e[family=monster,r=28] run function npck/npc/stand_down",
    ])

    fn("npck/npc/alert", [
        "tag @s add npck_alerted",
        "scoreboard players set @s npck.order 4",
        "event entity @s npck:order_defend",
        "execute if entity @s[tag=!npck_shouted] run function npck/npc/alert_shout",
    ])
    fn("npck/npc/alert_shout", [
        "tag @s add npck_shouted",
        say("@a[r=24]", "§c[Guard] §f\"Enemy spotted!\""),
        "playsound note.bass @a[r=24] ~ ~ ~",
    ])
    fn("npck/npc/stand_down", [
        "tag @s remove npck_alerted",
        "tag @s remove npck_shouted",
        "scoreboard players set @s npck.order 0",
        "event entity @s npck:order_work",
    ])

    fn("npck/npc/recruited", [
        "scoreboard players set @s npck.rec 1",
        "execute at @s run particle minecraft:heart_particle ~ ~2 ~",
        "execute at @s run playsound random.levelup @a[r=16] ~ ~ ~",
        say("@a[r=24]", "§a[Kingdom] §fA citizen has sworn loyalty to the crown."),
    ])

    # ---- day / night -------------------------------------------------------
    fn("npck/npc/night", [
        "execute if score #daystate npck.sys matches 1 run function npck/npc/night_start",
        "scoreboard players set #daystate npck.sys 0",
    ])
    fn("npck/npc/night_start", [
        say("@a[r=96]", "§9[Kingdom] §fNight falls. The workers return to their homes."),
        "execute as @e[family=npck_worker,r=96,scores={npck.order=0}] run scoreboard players set @s npck.order 12",
        "execute as @e[family=npck_worker,r=96,scores={npck.order=7}] run scoreboard players set @s npck.order 12",
        "execute as @e[family=npck_civilian,r=96,scores={npck.order=0}] run scoreboard players set @s npck.order 12",
        "execute as @e[family=npck_support,r=96,scores={npck.order=0}] run scoreboard players set @s npck.order 12",
        "execute as @e[family=npck,scores={npck.order=12}] run event entity @s npck:order_sleep",
        "tp @e[family=npck,r=96,rm=24,scores={npck.order=12}] ~ ~1 ~",
        "execute as @e[family=npck_soldier,r=96,scores={npck.order=0}] run scoreboard players set @s npck.order 3",
        "execute as @e[family=npck_soldier,scores={npck.order=3}] run event entity @s npck:order_patrol",
    ])
    fn("npck/npc/day", [
        "execute if score #daystate npck.sys matches 0 run function npck/npc/day_start",
        "scoreboard players set #daystate npck.sys 1",
    ])
    fn("npck/npc/day_start", [
        say("@a[r=96]", "§e[Kingdom] §fDawn breaks. \"Back to work for the kingdom!\""),
        "execute as @e[family=npck,scores={npck.order=12}] run scoreboard players set @s npck.order 0",
        "execute as @e[family=npck,scores={npck.order=0}] run event entity @s npck:order_work",
        "playsound random.orb @a[r=48] ~ ~ ~",
    ])

    # ---- jobs / production -------------------------------------------------
    fn("npck/npc/jobs", [
        "scoreboard players add #jobt npck.sys 1",
        "execute if score #jobt npck.sys matches 5.. run function npck/npc/produce",
        "execute as @e[family=npck_healer,r=80] at @s run function npck/npc/heal",
    ])

    produce = ["scoreboard players set #jobt npck.sys 0"]
    yields = {
        "farmer": [("Food", 3)],
        "lumberjack": [("Wood", 3)],
        "miner": [("Stone", 3), ("Iron", 1)],
        "builder": [("Stone", 1)],
        "blacksmith": [("Iron", 2)],
        "merchant": [("Emeralds", 1)],
        "advisor": [("Gold", 1)],
    }
    for role, gains in yields.items():
        for player, amount in gains:
            produce.append(
                "execute as @e[family=npck_%s,r=72,scores={npck.order=0}] run "
                "scoreboard players add %s npck.res %d" % (role, player, amount))
            produce.append(
                "execute as @e[family=npck_%s,r=72,scores={npck.order=7}] run "
                "scoreboard players add %s npck.res %d" % (role, player, amount * 2))
    produce += [
        "execute as @e[family=npck_lumberjack,r=72,scores={npck.order=!12}] at @s run function npck/npc/chop",
        "execute as @e[family=npck_miner,r=72,scores={npck.order=!12}] at @s run function npck/npc/mine",
        "execute as @e[family=npck_farmer,r=72,scores={npck.order=!12}] at @s run function npck/npc/farm",
        "execute as @e[family=npck_builder,r=72,scores={npck.order=9}] run function npck/kingdom/repair_step",
        "scoreboard players add #prodmsg npck.sys 1",
        "execute if score #prodmsg npck.sys matches 12.. run function npck/npc/report",
    ]
    fn("npck/npc/produce", produce)

    fn("npck/npc/report", [
        "scoreboard players set #prodmsg npck.sys 0",
        "execute if entity @e[family=npck_farmer,r=72] run "
        + say("@a[r=48]", "§a[Farmer] §f\"The harvest is ready.\""),
        "execute if entity @e[family=npck_worker,r=72] run "
        + say("@a[r=48]", "§a[Kingdom] §f\"Our kingdom is growing!\""),
    ])

    chop = []
    for dx, dz in ((2, 0), (-2, 0), (0, 2), (0, -2)):
        for wood in ("oak_log", "birch_log", "spruce_log"):
            chop.append("execute if block ~%d ~1 ~%d %s run setblock ~%d ~1 ~%d air destroy"
                        % (dx, dz, wood, dx, dz))
    chop.append("particle minecraft:basic_crit_particle ~ ~1 ~")
    fn("npck/npc/chop", chop)

    mine = []
    for dx, dz in ((2, 0), (-2, 0), (0, 2), (0, -2)):
        for ore in ("stone", "coal_ore", "iron_ore", "deepslate_coal_ore",
                    "deepslate_iron_ore", "gold_ore"):
            mine.append("execute if block ~%d ~-1 ~%d %s run setblock ~%d ~-1 ~%d air destroy"
                        % (dx, dz, ore, dx, dz))
    mine.append("particle minecraft:basic_crit_particle ~ ~ ~")
    fn("npck/npc/mine", mine)

    farm = []
    for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (0, 2)):
        farm.append('execute if block ~%d ~ ~%d wheat["growth"=7] run setblock ~%d ~ ~%d air destroy'
                    % (dx, dz, dx, dz))
        farm.append("execute if block ~%d ~-1 ~%d farmland if block ~%d ~ ~%d air run setblock ~%d ~ ~%d wheat"
                    % (dx, dz, dx, dz, dx, dz))
    farm.append("particle minecraft:villager_happy ~ ~1 ~")
    fn("npck/npc/farm", farm)

    fn("npck/npc/heal", [
        "effect @e[family=npck_friendly,r=8] regeneration 4 0 true",
        "effect @a[r=8] regeneration 4 0 true",
        "particle minecraft:heart_particle ~ ~2 ~",
    ])

    # ---- dialogue ----------------------------------------------------------
    talk = ["execute as @e[family=npck,c=1] at @s run function npck/npc/say"]
    fn("npck/npc/talk", talk)

    say_lines = [
        "scoreboard players add @s npck.job 1",
        "execute if score @s npck.job matches 3.. run scoreboard players set @s npck.job 0",
    ]
    for role in ROLES:
        say_lines.append(
            "execute if entity @s[family=npck_%s] run function npck/npc/say/%s" % (role, role))
    say_lines.append("execute if entity @s[family=npck_advisor] run function npck/kingdom/status")
    say_lines.append("playsound note.harp @a[r=12] ~ ~ ~")
    fn("npck/npc/say", say_lines)

    from npck_data import pretty
    for role in ROLES:
        lines = []
        for i, text in enumerate(DIALOGUE[role]):
            lines.append(
                "execute if score @s npck.job matches %d run %s"
                % (i, say("@a[r=16]", "§b<%s> §f\"%s\"" % (pretty(role), text))))
        fn("npck/npc/say/%s" % role, lines)


# ===========================================================================
# Orders
# ===========================================================================
def build_order_functions():
    fn("npck/orders/tap", [
        "# the marker spawned on the NPC that was tapped; it is the nearest one",
        "scoreboard players add @e[family=npck,c=1] npck.order 1",
        "execute as @e[family=npck,c=1] run function npck/orders/wrap",
        "execute as @e[family=npck,c=1] at @s run function npck/orders/apply",
    ])
    fn("npck/orders/wrap", [
        "execute if score @s npck.order matches 12.. run scoreboard players set @s npck.order 0",
        "execute if score @s npck.order matches ..-1 run scoreboard players set @s npck.order 0",
    ])

    fn("npck/orders/rally", [
        "scoreboard players operation #ord npck.sys = @e[family=npck,c=1] npck.order",
        "execute as @e[family=npck,r=32] run scoreboard players operation @s npck.order = #ord npck.sys",
        "execute as @e[family=npck,r=32] at @s run function npck/orders/apply_silent",
        "playsound note.bell @a[r=32] ~ ~ ~",
        "particle minecraft:villager_happy ~ ~1 ~",
        say("@a[r=32]", "§6[Kingdom] §fThe banner is raised - every citizen in range obeys the order."),
    ])

    silent = []
    announce = []
    for oid, key, label, _mv in ORDERS:
        silent.append("execute if score @s npck.order matches %d run event entity @s npck:order_%s"
                      % (oid, key))
        announce.append(
            "execute if score @s npck.order matches %d run %s"
            % (oid, actionbar("@a[r=16]", "§6Order: §f%s" % label)))
        announce.append(
            "execute if score @s npck.order matches %d run %s"
            % (oid, say("@a[r=16]", "§b<Citizen> §f\"%s\" §7(%s)" % (
                ORDER_REPLY[key], label))))
    silent.append("execute if score @s npck.order matches 12 run event entity @s npck:order_sleep")
    fn("npck/orders/apply_silent", silent)

    apply_lines = ["function npck/orders/apply_silent"] + announce + [
        "playsound note.pling @a[r=16] ~ ~ ~",
        "execute if score @s npck.order matches 1 unless entity @s[family=npck_recruited] run "
        + say("@a[r=16]", "§b<Citizen> §f\"Give me an §aemerald§f to recruit me, my king.\""),
        "execute if score @s npck.order matches 10 run function npck/orders/go_home",
        "execute if score @s npck.order matches 5 run effect @s speed 12 0 true",
        "execute if score @s npck.order matches 6 run effect @s speed 10 1 true",
        "execute if score @s npck.order matches 11 run particle minecraft:totem_particle ~ ~2 ~",
    ]
    fn("npck/orders/apply", apply_lines)

    fn("npck/orders/go_home", [
        "execute at @e[type=npck:kingdom_core,c=1] unless entity @s[r=24] run tp @s ~ ~1 ~",
        "execute at @e[type=npck:kingdom_core,c=1] unless entity @s[r=24] run particle minecraft:villager_happy ~ ~1 ~",
    ])

    # player-callable versions of every order
    for oid, key, label, _mv in ORDERS:
        fn("npck/orders/%s" % key, [
            "execute as @e[family=npck,r=32] run scoreboard players set @s npck.order %d" % oid,
            "execute as @e[family=npck,r=32] at @s run function npck/orders/apply_silent",
            "execute at @s run playsound note.bell @a[r=16] ~ ~ ~",
            say("@a[r=32]", "§6[Kingdom] §fOrder issued to all nearby citizens: §e%s" % label),
        ])


ORDER_REPLY = {
    "work": "Back to work, my king.",
    "follow": "My king, what are your orders?",
    "stay": "I will hold this ground.",
    "patrol": "I'll walk the perimeter.",
    "defend": "For the kingdom!",
    "attack": "The enemy will fall!",
    "retreat": "Falling back, my king!",
    "gather": "I'll gather resources.",
    "build": "The walls need repairs.",
    "repair": "I'll patch it up.",
    "home": "Returning home.",
    "celebrate": "Victory is ours!",
}


# ===========================================================================
# Raids
# ===========================================================================
def build_raid_functions():
    fn("npck/raid/timer", [
        "execute if score #level npck.sys matches 2.. unless score #raidactive npck.sys matches 1 run "
        "scoreboard players add #raidt npck.sys 1",
        "execute if score #raidactive npck.sys matches 1 run function npck/raid/check",
        "execute unless score #raidactive npck.sys matches 1 if score #raidt npck.sys matches 200.. run "
        "function npck/raid/start",
        "execute if score #raidt npck.sys matches 170 run "
        + say("@a[r=96]", "§e[Scouts] §fDust on the horizon... an attack may be coming."),
    ])

    fn("npck/raid/start", [
        "scoreboard players set #raidt npck.sys 0",
        "scoreboard players set #raidlen npck.sys 0",
        "scoreboard players set #raidactive npck.sys 1",
        "scoreboard players add #wave npck.sys 1",
        "scoreboard players operation #dir npck.sys = #wave npck.sys",
        "scoreboard players operation #dir npck.sys %= #c4 npck.sys",
        "scoreboard players operation #bossdue npck.sys = #wave npck.sys",
        "scoreboard players operation #bossdue npck.sys %= #c3 npck.sys",
        title("@a", "§4§lTHE KINGDOM IS UNDER ATTACK!"),
        say("@a", "§4§l[WAR] §r§cEnemy army approaching!"),
        "playsound mob.wither.spawn @a[r=96] ~ ~ ~ 0.7",
        "execute if score #dir npck.sys matches 0 run "
        + say("@a", "§c[WAR] §fDefend the northern gate!"),
        "execute if score #dir npck.sys matches 1 run "
        + say("@a", "§c[WAR] §fDefend the eastern gate!"),
        "execute if score #dir npck.sys matches 2 run "
        + say("@a", "§c[WAR] §fDefend the southern gate!"),
        "execute if score #dir npck.sys matches 3 run "
        + say("@a", "§c[WAR] §fDefend the western gate!"),
        "execute as @e[family=npck_soldier,r=96] run scoreboard players set @s npck.order 4",
        "execute as @e[family=npck_soldier,r=96] at @s run function npck/orders/apply_silent",
        "execute as @e[family=npck_worker,r=96] run scoreboard players set @s npck.order 6",
        "execute as @e[family=npck_worker,r=96] at @s run function npck/orders/apply_silent",
        "execute if score #dir npck.sys matches 0 positioned ~ ~ ~-44 run function npck/raid/wave",
        "execute if score #dir npck.sys matches 1 positioned ~44 ~ ~ run function npck/raid/wave",
        "execute if score #dir npck.sys matches 2 positioned ~ ~ ~44 run function npck/raid/wave",
        "execute if score #dir npck.sys matches 3 positioned ~-44 ~ ~ run function npck/raid/wave",
    ])

    fn("npck/raid/wave", [
        "summon npck:bandit ~ ~3 ~",
        "summon npck:bandit ~3 ~3 ~2",
        "summon npck:bandit ~-3 ~3 ~-2",
        "execute if score #level npck.sys matches 3.. run function npck/raid/wave3",
        "execute if score #level npck.sys matches 4.. run function npck/raid/wave4",
        "execute if score #level npck.sys matches 5 run function npck/raid/wave5",
        "execute if score #bossdue npck.sys matches 0 if score #level npck.sys matches 3.. run "
        "function npck/raid/boss",
    ])
    fn("npck/raid/wave3", [
        "summon npck:raider ~2 ~3 ~-3",
        "summon npck:raider ~-2 ~3 ~3",
        "summon npck:undead_soldier ~4 ~3 ~",
        "summon npck:enemy_archer ~-4 ~3 ~",
    ])
    fn("npck/raid/wave4", [
        "summon npck:raider ~5 ~3 ~3",
        "summon npck:undead_soldier ~-5 ~3 ~-3",
        "summon npck:enemy_archer ~ ~3 ~5",
        "summon npck:dark_knight ~ ~3 ~-5",
    ])
    fn("npck/raid/wave5", [
        "summon npck:dark_knight ~6 ~3 ~2",
        "summon npck:enemy_wizard ~-6 ~3 ~-2",
        "summon npck:undead_soldier ~6 ~3 ~-2",
        "summon npck:raider ~-6 ~3 ~2",
    ])
    fn("npck/raid/boss", [
        "execute if score #level npck.sys matches 3 run summon npck:bandit_king ~ ~4 ~",
        "execute if score #level npck.sys matches 4 run summon npck:dark_wizard ~ ~4 ~",
        "execute if score #level npck.sys matches 5.. run summon npck:undead_emperor ~ ~4 ~",
        say("@a", "§4§l[WAR] §r§4A champion leads the enemy army! Rally the knights!"),
        "playsound mob.enderdragon.growl @a ~ ~ ~ 0.6",
    ])

    fn("npck/raid/check", [
        "scoreboard players add #raidlen npck.sys 1",
        "execute unless entity @e[family=npck_enemy,r=120] run function npck/raid/victory",
        "execute if score #raidlen npck.sys matches 300.. run function npck/raid/timeout",
    ])
    fn("npck/raid/victory", [
        "scoreboard players set #raidactive npck.sys 0",
        "scoreboard players set #raidlen npck.sys 0",
        "scoreboard players set #raidt npck.sys 0",
        title("@a", "§a§lVICTORY!"),
        say("@a", "§a§l[VICTORY] §r§aVictory! The enemy has retreated!"),
        "scoreboard players add Emeralds npck.res 12",
        "scoreboard players add Gold npck.res 16",
        "scoreboard players add Iron npck.res 24",
        "function npck/kingdom/celebrate",
    ])
    fn("npck/raid/timeout", [
        "scoreboard players set #raidactive npck.sys 0",
        "scoreboard players set #raidlen npck.sys 0",
        "scoreboard players set #raidt npck.sys 0",
        "kill @e[family=npck_enemy,r=200]",
        say("@a", "§a[WAR] §fThe enemy has withdrawn into the wilderness."),
        "execute as @e[family=npck,r=96] run scoreboard players set @s npck.order 0",
        "execute as @e[family=npck,r=96] at @s run function npck/orders/apply_silent",
    ])

    # player-declared assault on an enemy camp
    fn("npck/raid/declare", [
        "execute if score #raidactive npck.sys matches 1 run "
        + say("@a[r=24]", "§c[War] §fYour kingdom is already under attack!"),
        "execute unless score #raidactive npck.sys matches 1 run function npck/raid/declare_go",
    ])
    fn("npck/raid/declare_go", [
        say("@a", "§4§l[WAR] §r§eYou have declared war on the enemy camp!"),
        title("@a", "§6§lWAR DECLARED"),
        "playsound mob.wither.spawn @a ~ ~ ~ 0.8",
        "scoreboard players set #raidactive npck.sys 1",
        "scoreboard players set #raidlen npck.sys 0",
        "scoreboard players add #wave npck.sys 1",
        "execute positioned ~ ~-1 ~70 run function npck/struct/bandit_camp",
        "execute positioned ~ ~ ~70 run function npck/raid/camp_force",
        say("@a", "§e[War] §fAn enemy camp stands §c70 blocks south§f. Lead your army!"),
        "execute as @e[family=npck_soldier,r=96] run scoreboard players set @s npck.order 1",
        "execute as @e[family=npck_soldier,r=96] at @s run function npck/orders/apply_silent",
    ])
    fn("npck/raid/camp_force", [
        "summon npck:bandit ~2 ~3 ~2",
        "summon npck:bandit ~-2 ~3 ~-2",
        "summon npck:raider ~3 ~3 ~-3",
        "summon npck:enemy_archer ~-3 ~3 ~3",
        "execute if score #level npck.sys matches 3.. run summon npck:dark_knight ~ ~3 ~4",
        "execute if score #level npck.sys matches 4.. run summon npck:enemy_wizard ~ ~3 ~-4",
        "execute if score #level npck.sys matches 3.. run summon npck:bandit_king ~ ~4 ~",
    ])


# ===========================================================================
# Help / utilities
# ===========================================================================
def build_help():
    H = "@a[r=48]"
    lines = [
        say(H, "§6§l===== NPC KINGDOM ====="),
        say(H, "§e1.§f Craft or grab a §eKingdom Core§f and place it on the ground."),
        say(H, "§e2.§f Spawn citizens with the custom §espawn eggs§f (Creative) or let them join."),
        say(H, "§e3.§f Give an NPC an §aemerald§f to §arecruit§f it (recruited NPCs can follow you)."),
        say(H, "§e4.§f Tap an NPC with the §eRoyal Command Staff§f to cycle its order."),
        say(H, "§e5.§f Tap an NPC with the §eRoyal Command Banner§f to give that order to everyone nearby."),
        say(H, "§e6.§f Tap an NPC with an empty hand to talk. Advisors read out the full report."),
        say(H, "§e7.§f Tap the §eKingdom Core§f with the §eRoyal Ledger§f for a report and to collect taxes."),
        say(H, "§e8.§f Tap the Core with the §eCelebration Horn§f to party, or the §eWar Horn§f to declare war."),
        say(H, "§7Orders: work, follow, stay, patrol, defend, attack, retreat, gather, build, repair, home, celebrate"),
        say(H, "§7Commands: §f/function npck/orders/<order>§7, §f/function npck/kingdom/status§7, §f/function npck/give_kit"),
    ]
    fn("npck/help", lines)

    fn("npck/give_kit", [
        "give @s npck:kingdom_core 1",
        "give @s npck:command_staff 1",
        "give @s npck:command_banner 1",
        "give @s npck:royal_ledger 1",
        "give @s npck:celebration_horn 1",
        "give @s npck:war_horn 1",
        "give @s npck:royal_crown 1",
        "give @s npck:royal_chestplate 1",
        "give @s npck:royal_leggings 1",
        "give @s npck:royal_boots 1",
        say("@s", "§6[NPC Kingdom] §fRoyal regalia delivered."),
    ])


# ===========================================================================
def generate(root):
    FUNCS.clear()
    build_core_functions()
    build_kingdom_functions()
    build_npc_functions()
    build_order_functions()
    build_raid_functions()
    build_help()
    for name, builder in STRUCTS.items():
        fn("npck/struct/%s" % name, builder())

    fdir = os.path.join(root, "functions")
    os.makedirs(fdir, exist_ok=True)
    with open(os.path.join(fdir, "tick.json"), "w", encoding="utf-8") as fh:
        json.dump({"values": ["npck/tick"]}, fh, indent=2)
        fh.write("\n")

    for path, lines in FUNCS.items():
        full = os.path.join(fdir, path + ".mcfunction")
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines) + "\n")
    return len(FUNCS)
