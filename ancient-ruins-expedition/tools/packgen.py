"""Writes every JSON file of the behavior pack (BP) and resource pack (RP).

Formats target Minecraft Bedrock 1.21.0 (tested against the 1.21.0.26
preview documentation/metadata) and use no experimental features.
"""
import json
import os

NS = "ancient_ruins"
VERSION = [1, 0, 0]
MIN_ENGINE = [1, 21, 0]

UUIDS = {
    "bp_header": "2e351bf7-cbe7-4259-9c6f-c8a3354b4f31",
    "bp_data": "1e731878-fbf8-4998-82b7-e89dd497edce",
    "bp_script": "da1d0132-8f0c-4a9d-85d5-64ef55382c7b",
    "rp_header": "b2ebd391-2568-4941-b8b5-9719226906b1",
    "rp_resources": "c6179d03-1a45-4206-a021-324d4f3142a4",
}

SCRIPT_MODULES = {"@minecraft/server": "1.10.0", "@minecraft/server-ui": "1.1.0"}


def write_json(root, rel, data):
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    return path


def write_text(root, rel, text):
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    return path


# ---------------------------------------------------------------------------
# Blocks
# ---------------------------------------------------------------------------
UNBREAKABLE = None

BLOCKS = {}


def block(name, display, textures, sound, seconds, resistance, light=0, color="#7a7f70",
          category="construction"):
    BLOCKS[name] = dict(display=display, textures=textures, sound=sound, seconds=seconds,
                        resistance=resistance, light=light, color=color, category=category)


block("temple_floor", "Temple Floor Tiles", "temple_floor", "stone", 1.5, 6, color="#5d6b4f")
block("crumbling_temple_floor", "Crumbling Temple Tiles", "crumbling_temple_floor", "stone", 0.5, 1, color="#5d6b4f")
block("crypt_floor", "Crypt Floor Tiles", "crypt_floor", "stone", 1.2, 4, color="#d8c48a")
block("crumbling_sandstone", "Crumbling Sandstone", "crumbling_sandstone", "stone", 0.5, 1, color="#d8c48a")
block("ship_floor", "Barnacled Planks", "ship_floor", "wood", 1.2, 3, color="#4a3421")
block("rotten_planks", "Rotten Planks", "rotten_planks", "wood", 0.4, 1, color="#3c2d1d")
GLYPH_NAMES = {
    "temple": ["Sun", "Serpent", "Moon", "Eye"],
    "crypt": ["Ankh", "Eye of Horus", "Scarab", "Feather"],
    "ship": ["Anchor", "Star", "Wave", "Skull"],
}
THEME_TITLE = {"temple": "Temple", "crypt": "Crypt", "ship": "Tide"}
for theme, names in GLYPH_NAMES.items():
    for i, gname in enumerate(names, start=1):
        block(f"{theme}_glyph_{i}", f"{THEME_TITLE[theme]} Glyph: {gname}", f"{theme}_glyph_{i}",
              "wood" if theme == "ship" else "stone", UNBREAKABLE, UNBREAKABLE, light=4,
              color={"temple": "#3ee07c", "crypt": "#f2c23b", "ship": "#46e6e0"}[theme])
for theme, title in (("temple", "Jade Altar"), ("crypt", "Pharaoh's Sarcophagus"), ("ship", "Captain's Reliquary")):
    block(f"{theme}_altar", title, {"*": f"{theme}_altar_side", "up": f"{theme}_altar_top"},
          "wood" if theme == "ship" else "stone", UNBREAKABLE, UNBREAKABLE, light=9, color="#e3b341")
block("dormant_altar", "Dormant Altar", "dormant_altar", "stone", UNBREAKABLE, UNBREAKABLE, light=2, color="#5f615c")
block("vault_seal", "Vault Seal", "vault_seal", "stone", UNBREAKABLE, UNBREAKABLE, light=3, color="#2e2d3a")
block("trap_mechanism", "Trap Mechanism", "trap_mechanism", "stone", 3.0, 8, color="#7b7d74")
block("miasma_vent", "Miasma Vent", "miasma_vent", "metal", 2.5, 6, light=3, color="#30342d")


def block_json(name, b):
    tex = b["textures"]
    if isinstance(tex, str):
        mats = {"*": {"texture": f"{NS}_{tex}", "render_method": "opaque"}}
    else:
        mats = {face: {"texture": f"{NS}_{t}", "render_method": "opaque"} for face, t in tex.items()}
    comps = {
        "minecraft:display_name": f"tile.{NS}:{name}.name",
        "minecraft:material_instances": mats,
        "minecraft:map_color": b["color"],
    }
    if b["seconds"] is UNBREAKABLE:
        comps["minecraft:destructible_by_mining"] = False
        comps["minecraft:destructible_by_explosion"] = False
    else:
        comps["minecraft:destructible_by_mining"] = {"seconds_to_destroy": b["seconds"]}
        comps["minecraft:destructible_by_explosion"] = {"explosion_resistance": b["resistance"]}
    if b["light"]:
        comps["minecraft:light_emission"] = b["light"]
    return {
        "format_version": "1.20.80",
        "minecraft:block": {
            "description": {
                "identifier": f"{NS}:{name}",
                "menu_category": {"category": b["category"]},
            },
            "components": comps,
        },
    }


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------
ITEMS = {
    "ruin_compass": dict(display="Ruin Compass", category="equipment", cooldown=1.0),
    "cursed_ring": dict(display="Cursed Ring", category="equipment", cooldown=None),
    "ancient_map": dict(display="Ancient Map", category="items", cooldown=1.0),
}


def item_json(name, it):
    comps = {
        "minecraft:icon": {"texture": f"{NS}_{name}"},
        "minecraft:display_name": {"value": f"item.{NS}:{name}.name"},
        "minecraft:max_stack_size": 1,
        "minecraft:allow_off_hand": True,
        "minecraft:hand_equipped": False,
        "minecraft:tags": {"tags": [f"{NS}:relic"]},
    }
    if it["cooldown"]:
        comps["minecraft:cooldown"] = {"category": f"{NS}_{name}", "duration": it["cooldown"]}
    return {
        "format_version": "1.20.50",
        "minecraft:item": {
            "description": {"identifier": f"{NS}:{name}", "menu_category": {"category": it["category"]}},
            "components": comps,
        },
    }


# ---------------------------------------------------------------------------
# Entities (behavior)
# ---------------------------------------------------------------------------
def player_target(radius):
    return {
        "priority": 2,
        "must_see": True,
        "reselect_targets": True,
        "within_radius": radius,
        "entity_types": [{
            "filters": {"test": "is_family", "subject": "other", "value": "player"},
            "max_dist": radius,
        }],
    }


LAVA_HURT = {
    "damage_conditions": [{
        "filters": {"test": "in_lava", "subject": "self", "operator": "==", "value": True},
        "cause": "lava",
        "damage_per_tick": 4,
    }]
}


def land_movement(speed):
    return {
        "minecraft:movement": {"value": speed},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_water": True,
                                      "can_pass_doors": True, "avoid_damage_blocks": True},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:can_climb": {},
        "minecraft:behavior.float": {"priority": 0},
    }


def water_movement(speed, swim):
    return {
        "minecraft:movement": {"value": speed},
        "minecraft:underwater_movement": {"value": swim},
        "minecraft:navigation.generic": {"is_amphibious": True, "can_path_over_water": False,
                                         "can_swim": True, "can_walk": True, "can_breach": True,
                                         "can_sink": True, "avoid_sun": False},
        "minecraft:movement.generic": {},
        "minecraft:jump.static": {},
        "minecraft:can_climb": {},
        "minecraft:behavior.random_swim": {"priority": 7, "speed_multiplier": 1.0, "interval": 120,
                                           "xz_dist": 8, "y_dist": 4},
    }


GUARDIANS = {
    "temple_guardian": dict(
        name="Temple Guardian", hp=30, damage=5, families=["temple_guardian", "ruin_guardian", "monster", "mob"],
        move=land_movement(0.25), xp=10, knockback=0.3, size=(0.6, 1.95), attack_extra={},
        breath={"total_supply": 15, "suffocate_time": 0},
    ),
    "crypt_mummy": dict(
        name="Crypt Mummy", hp=26, damage=4, families=["crypt_mummy", "ruin_guardian", "undead", "monster", "mob"],
        move=land_movement(0.22), xp=10, knockback=0.2, size=(0.6, 1.95),
        attack_extra={"effect_name": "hunger", "effect_duration": 6},
        breath={"total_supply": 15, "suffocate_time": 0, "breathes_water": True},
    ),
    "drowned_captain": dict(
        name="Drowned Captain", hp=36, damage=6, families=["drowned_captain", "ruin_guardian", "undead", "monster", "mob"],
        move=water_movement(0.24, 0.07), xp=12, knockback=0.35, size=(0.6, 1.95), attack_extra={},
        breath={"total_supply": 15, "suffocate_time": 0, "breathes_air": True, "breathes_water": True},
    ),
}

BOSSES = {
    "jade_idol": dict(
        name="Jade Idol", damage=8, families=["jade_idol", "ruin_boss", "monster", "mob"],
        move=land_movement(0.23), enraged_speed=0.3, scale=1.6, size=(1.0, 3.0), fire_immune=True,
        attack_extra={}, breath={"total_supply": 15, "suffocate_time": 0, "breathes_water": True},
    ),
    "sand_pharaoh": dict(
        name="Sand Pharaoh", damage=6, families=["sand_pharaoh", "ruin_boss", "undead", "monster", "mob"],
        move=land_movement(0.24), enraged_speed=0.3, scale=1.5, size=(0.9, 2.9), fire_immune=True,
        attack_extra={"effect_name": "wither", "effect_duration": 3},
        breath={"total_supply": 15, "suffocate_time": 0, "breathes_water": True},
    ),
    "abyssal_admiral": dict(
        name="Abyssal Admiral", damage=7, families=["abyssal_admiral", "ruin_boss", "undead", "monster", "mob"],
        move=water_movement(0.24, 0.08), enraged_speed=0.3, scale=1.6, size=(1.0, 3.0), fire_immune=False,
        attack_extra={}, breath={"total_supply": 15, "suffocate_time": 0, "breathes_air": True, "breathes_water": True},
    ),
}


def guardian_json(name, g):
    comps = {
        "minecraft:type_family": {"family": g["families"]},
        "minecraft:health": {"value": g["hp"], "max": g["hp"]},
        "minecraft:attack": {"damage": g["damage"], **g["attack_extra"]},
        "minecraft:collision_box": {"width": g["size"][0], "height": g["size"][1]},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:breathable": g["breath"],
        "minecraft:nameable": {},
        "minecraft:is_hidden_when_invisible": {},
        "minecraft:conditional_bandwidth_optimization": {},
        "minecraft:despawn": {"despawn_from_distance": {}},
        "minecraft:hurt_on_condition": LAVA_HURT,
        "minecraft:knockback_resistance": {"value": g["knockback"]},
        "minecraft:follow_range": {"value": 20},
        "minecraft:loot": {"table": f"loot_tables/entities/{NS}/{name}.json"},
        "minecraft:experience_reward": {"on_death": f"query.last_hit_by_player ? {g['xp']} : 0"},
        **g["move"],
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": player_target(16),
        "minecraft:behavior.melee_box_attack": {"priority": 3, "speed_multiplier": 1.15, "track_target": True},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8, "interval": 120},
        "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 8, "probability": 0.02},
        "minecraft:behavior.random_look_around": {"priority": 9},
    }
    return {
        "format_version": "1.21.0",
        "minecraft:entity": {
            "description": {"identifier": f"{NS}:{name}", "spawn_category": "monster",
                            "is_spawnable": True, "is_summonable": True},
            "component_groups": {
                f"{NS}:persistent": {"minecraft:persistent": {}},
            },
            "components": comps,
            "events": {
                f"{NS}:make_persistent": {"add": {"component_groups": [f"{NS}:persistent"]}},
            },
        },
    }


def boss_json(name, b):
    move = dict(b["move"])
    base_speed = move["minecraft:movement"]["value"]
    move.pop("minecraft:movement")
    comps = {
        "minecraft:type_family": {"family": b["families"]},
        "minecraft:health": {"value": 150, "max": 150},
        "minecraft:boss": {"hud_range": 32, "name": b["name"], "should_darken_sky": False},
        "minecraft:attack": {"damage": b["damage"], **b["attack_extra"]},
        "minecraft:scale": {"value": b["scale"]},
        "minecraft:collision_box": {"width": b["size"][0], "height": b["size"][1]},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:persistent": {},
        "minecraft:breathable": b["breath"],
        "minecraft:nameable": {},
        "minecraft:is_hidden_when_invisible": {},
        "minecraft:knockback_resistance": {"value": 0.9},
        "minecraft:follow_range": {"value": 28},
        "minecraft:damage_sensor": {"triggers": [
            {"cause": "fall", "deals_damage": False},
            {"cause": "suffocation", "deals_damage": False},
            {"cause": "drowning", "deals_damage": False},
        ]},
        "minecraft:loot": {"table": f"loot_tables/entities/{NS}/{name}.json"},
        "minecraft:experience_reward": {"on_death": "150"},
        **move,
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": player_target(24),
        "minecraft:behavior.melee_box_attack": {"priority": 3, "speed_multiplier": 1.2, "track_target": True,
                                                "horizontal_reach": 1.2},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.7, "interval": 160},
        "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 12, "probability": 0.05},
    }
    if b["fire_immune"]:
        comps["minecraft:fire_immune"] = {}
    special = {"event": f"{NS}:special_attack", "target": "self"}
    return {
        "format_version": "1.21.0",
        "minecraft:entity": {
            "description": {"identifier": f"{NS}:{name}", "spawn_category": "monster",
                            "is_spawnable": True, "is_summonable": True},
            "component_groups": {
                f"{NS}:calm": {
                    "minecraft:movement": {"value": base_speed},
                    "minecraft:timer": {"looping": True, "randomInterval": True, "time": [6.0, 9.0],
                                        "time_down_event": special},
                },
                f"{NS}:casting": {
                    "minecraft:mark_variant": {"value": 1},
                },
                f"{NS}:enraged": {
                    "minecraft:movement": {"value": b["enraged_speed"]},
                    "minecraft:timer": {"looping": True, "randomInterval": True, "time": [4.0, 6.0],
                                        "time_down_event": special},
                },
            },
            "components": comps,
            "events": {
                "minecraft:entity_spawned": {"add": {"component_groups": [f"{NS}:calm"]}},
                f"{NS}:special_attack": {"add": {"component_groups": [f"{NS}:casting"]}},
                f"{NS}:cast_done": {"remove": {"component_groups": [f"{NS}:casting"]}},
                f"{NS}:enrage": {
                    "remove": {"component_groups": [f"{NS}:calm"]},
                    "add": {"component_groups": [f"{NS}:enraged"]},
                },
            },
        },
    }


def marker_json():
    return {
        "format_version": "1.21.0",
        "minecraft:entity": {
            "description": {"identifier": f"{NS}:ruin_marker", "is_spawnable": False, "is_summonable": True},
            "component_groups": {
                f"{NS}:despawn": {"minecraft:instant_despawn": {}},
            },
            "components": {
                "minecraft:type_family": {"family": [f"{NS}_marker", "inanimate"]},
                "minecraft:collision_box": {"width": 0.1, "height": 0.1},
                "minecraft:physics": {"has_collision": False, "has_gravity": False},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
                "minecraft:damage_sensor": {"triggers": {"cause": "all", "deals_damage": False}},
                "minecraft:health": {"value": 1, "max": 1},
                "minecraft:persistent": {},
                "minecraft:timer": {"looping": False, "time": 120.0,
                                    "time_down_event": {"event": f"{NS}:expire", "target": "self"}},
            },
            "events": {
                f"{NS}:expire": {"add": {"component_groups": [f"{NS}:despawn"]}},
            },
        },
    }


# ---------------------------------------------------------------------------
# Loot tables
# ---------------------------------------------------------------------------
def entry(name, weight, lo=1, hi=1, functions=None, data=None):
    e = {"type": "item", "name": name, "weight": weight}
    fns = []
    if (lo, hi) != (1, 1):
        fns.append({"function": "set_count", "count": {"min": lo, "max": hi}})
    if data is not None:
        fns.append({"function": "set_data", "data": data})
    if functions:
        fns.extend(functions)
    if fns:
        e["functions"] = fns
    return e


EMPTY = {"type": "empty", "weight": 1}
ENCHANT_BOOK = [{"function": "enchant_randomly"}]
ENCHANT_GEAR = [{"function": "enchant_with_levels", "levels": {"min": 20, "max": 30}, "treasure": True}]
MAP = f"{NS}:ancient_map"
COMPASS = f"{NS}:ruin_compass"
RING = f"{NS}:cursed_ring"

CHEST_LOOT = {
    "temple_chest": [
        {"rolls": {"min": 3, "max": 6}, "entries": [
            entry("minecraft:gold_ingot", 30, 2, 6), entry("minecraft:emerald", 20, 1, 4),
            entry("minecraft:iron_ingot", 20, 1, 5), entry("minecraft:bone", 20, 2, 6),
            entry("minecraft:arrow", 15, 4, 12), entry("minecraft:cocoa_beans", 10, 2, 5),
            entry("minecraft:bamboo", 10, 3, 8), entry("minecraft:diamond", 4, 1, 2),
            entry("minecraft:book", 6, functions=ENCHANT_BOOK), entry("minecraft:golden_apple", 4),
            entry(MAP, 6), entry(COMPASS, 3),
        ]},
    ],
    "temple_vault": [
        {"rolls": {"min": 4, "max": 7}, "entries": [
            entry("minecraft:diamond", 20, 1, 4), entry("minecraft:emerald", 25, 3, 9),
            entry("minecraft:gold_block", 10, 1, 2), entry("minecraft:gold_ingot", 25, 4, 10),
            entry("minecraft:book", 12, functions=ENCHANT_BOOK), entry("minecraft:golden_apple", 8, 1, 2),
            entry("minecraft:enchanted_golden_apple", 2), entry("minecraft:diamond_sword", 3, functions=ENCHANT_GEAR),
            entry("minecraft:experience_bottle", 10, 3, 8), entry(MAP, 5), entry(RING, 3),
        ]},
    ],
    "crypt_chest": [
        {"rolls": {"min": 3, "max": 6}, "entries": [
            entry("minecraft:gold_ingot", 30, 2, 6), entry("minecraft:gold_nugget", 20, 4, 12),
            entry("minecraft:bone", 25, 2, 6), entry("minecraft:rotten_flesh", 20, 2, 6),
            entry("minecraft:lapis_lazuli", 15, 3, 9), entry("minecraft:paper", 10, 2, 6),
            entry("minecraft:emerald", 12, 1, 3), entry("minecraft:diamond", 4, 1, 2),
            entry("minecraft:book", 6, functions=ENCHANT_BOOK), entry("minecraft:golden_apple", 4),
            entry(MAP, 6), entry(COMPASS, 3),
        ]},
    ],
    "crypt_vault": [
        {"rolls": {"min": 4, "max": 7}, "entries": [
            entry("minecraft:diamond", 20, 1, 4), entry("minecraft:gold_block", 15, 1, 3),
            entry("minecraft:emerald", 20, 3, 8), entry("minecraft:lapis_block", 10, 1, 2),
            entry("minecraft:book", 12, functions=ENCHANT_BOOK), entry("minecraft:golden_apple", 8, 1, 2),
            entry("minecraft:enchanted_golden_apple", 2), entry("minecraft:totem_of_undying", 2),
            entry("minecraft:golden_helmet", 4, functions=ENCHANT_GEAR), entry(MAP, 5), entry(RING, 3),
        ]},
    ],
    "ship_chest": [
        {"rolls": {"min": 3, "max": 6}, "entries": [
            entry("minecraft:iron_ingot", 25, 1, 5), entry("minecraft:gold_nugget", 20, 4, 12),
            entry("minecraft:emerald", 15, 1, 4), entry("minecraft:paper", 15, 2, 6),
            entry("minecraft:prismarine_crystals", 12, 2, 6), entry("minecraft:prismarine_shard", 12, 2, 6),
            entry("minecraft:potion", 12, data=19), entry("minecraft:nautilus_shell", 4),
            entry("minecraft:diamond", 3, 1, 2), entry("minecraft:book", 6, functions=ENCHANT_BOOK),
            entry(MAP, 6), entry(COMPASS, 3),
        ]},
    ],
    "ship_vault": [
        {"rolls": {"min": 4, "max": 7}, "entries": [
            entry("minecraft:diamond", 20, 1, 4), entry("minecraft:emerald", 25, 3, 9),
            entry("minecraft:gold_ingot", 20, 4, 10), entry("minecraft:heart_of_the_sea", 4),
            entry("minecraft:nautilus_shell", 10, 1, 3), entry("minecraft:trident", 3),
            entry("minecraft:book", 12, functions=ENCHANT_BOOK), entry("minecraft:potion", 10, data=20),
            entry("minecraft:golden_apple", 8, 1, 2), entry(MAP, 5), entry(RING, 3),
        ]},
    ],
}

MAP_DROP = {"rolls": 1, "entries": [entry(MAP, 1)], "conditions": [
    {"condition": "killed_by_player"},
    {"condition": "random_chance_with_looting", "chance": 0.03, "looting_multiplier": 0.01},
]}

ENTITY_LOOT = {
    "temple_guardian": [
        {"rolls": 1, "entries": [entry("minecraft:mossy_cobblestone", 1, 0, 2)]},
        {"rolls": 1, "entries": [entry("minecraft:emerald", 1)], "conditions": [
            {"condition": "killed_by_player"},
            {"condition": "random_chance_with_looting", "chance": 0.25, "looting_multiplier": 0.05}]},
        MAP_DROP,
    ],
    "crypt_mummy": [
        {"rolls": 1, "entries": [entry("minecraft:rotten_flesh", 2, 0, 2), entry("minecraft:bone", 1, 0, 2)]},
        {"rolls": 1, "entries": [entry("minecraft:gold_nugget", 1, 1, 3)], "conditions": [
            {"condition": "killed_by_player"},
            {"condition": "random_chance_with_looting", "chance": 0.35, "looting_multiplier": 0.05}]},
        MAP_DROP,
    ],
    "drowned_captain": [
        {"rolls": 1, "entries": [entry("minecraft:rotten_flesh", 1, 0, 2)]},
        {"rolls": 1, "entries": [entry("minecraft:gold_ingot", 2), entry("minecraft:prismarine_shard", 1, 1, 3)],
         "conditions": [{"condition": "killed_by_player"},
                        {"condition": "random_chance_with_looting", "chance": 0.4, "looting_multiplier": 0.05}]},
        MAP_DROP,
    ],
}


def boss_loot(extra):
    return [
        {"rolls": 1, "entries": [entry(RING, 1)]},
        {"rolls": 1, "entries": [entry("minecraft:diamond", 1, 2, 4)]},
        {"rolls": 1, "entries": [entry("minecraft:emerald", 1, 3, 8)]},
        {"rolls": 1, "entries": [entry(MAP, 1)]},
        {"rolls": 1, "entries": extra},
    ]


ENTITY_LOOT["jade_idol"] = boss_loot([entry("minecraft:emerald_block", 2), entry("minecraft:golden_apple", 1, 1, 2)])
ENTITY_LOOT["sand_pharaoh"] = boss_loot([entry("minecraft:gold_block", 2, 1, 2), entry("minecraft:totem_of_undying", 1)])
ENTITY_LOOT["abyssal_admiral"] = boss_loot([entry("minecraft:heart_of_the_sea", 1), entry("minecraft:trident", 1)])


# ---------------------------------------------------------------------------
# World generation
# ---------------------------------------------------------------------------
RUINS = {
    "jungle_temple": dict(
        biome=[{"test": "has_biome_tag", "operator": "==", "value": "jungle"}],
        y="query.heightmap(variable.worldx, variable.worldz) - 3", chance=120),
    "desert_crypt": dict(
        biome=[{"test": "has_biome_tag", "operator": "==", "value": "desert"}],
        y="query.heightmap(variable.worldx, variable.worldz) - 10", chance=150),
    "sunken_ship": dict(
        biome=[{"test": "has_biome_tag", "operator": "==", "value": "ocean"},
               {"test": "has_biome_tag", "operator": "!=", "value": "deep"},
               {"test": "has_biome_tag", "operator": "!=", "value": "frozen"}],
        y="query.above_top_solid(variable.worldx, variable.worldz) - 2", chance=180),
}


def feature_json(name):
    return {
        "format_version": "1.13.0",
        "minecraft:structure_template_feature": {
            "description": {"identifier": f"{NS}:{name}_feature"},
            "structure_name": f"{NS}:{name}",
            "adjustment_radius": 4,
            "facing_direction": "random",
            "constraints": {"grounded": {}},
        },
    }


def feature_rule_json(name, r):
    return {
        "format_version": "1.13.0",
        "minecraft:feature_rules": {
            "description": {"identifier": f"{NS}:{name}_rule", "places_feature": f"{NS}:{name}_feature"},
            "conditions": {"placement_pass": "before_surface_pass", "minecraft:biome_filter": r["biome"]},
            "distribution": {
                "iterations": 1,
                "scatter_chance": {"numerator": 1, "denominator": r["chance"]},
                "x": {"distribution": "uniform", "extent": [0, 15]},
                "y": r["y"],
                "z": {"distribution": "uniform", "extent": [0, 15]},
            },
        },
    }


SPAWNS = {
    "temple_guardian": dict(floor="temple_floor", biome="jungle", water=False, weight=60),
    "crypt_mummy": dict(floor="crypt_floor", biome="desert", water=False, weight=60),
    "drowned_captain": dict(floor="ship_floor", biome="ocean", water=True, weight=50),
}


def spawn_rule_json(name, s):
    cond = {}
    if s["water"]:
        cond["minecraft:spawns_underwater"] = {}
    else:
        cond["minecraft:spawns_on_surface"] = {}
        cond["minecraft:spawns_underground"] = {}
    cond.update({
        "minecraft:spawns_on_block_filter": [f"{NS}:{s['floor']}"],
        "minecraft:brightness_filter": {"min": 0, "max": 11, "adjust_for_weather": False},
        "minecraft:difficulty_filter": {"min": "easy", "max": "hard"},
        "minecraft:weight": {"default": s["weight"]},
        "minecraft:herd": {"min_size": 1, "max_size": 2},
        "minecraft:density_limit": {"surface": 3, "underground": 3},
        "minecraft:biome_filter": {"test": "has_biome_tag", "operator": "==", "value": s["biome"]},
    })
    return {
        "format_version": "1.8.0",
        "minecraft:spawn_rules": {
            "description": {"identifier": f"{NS}:{name}", "population_control": "monster"},
            "conditions": [cond],
        },
    }


RECIPES = {
    "ruin_compass": {
        "format_version": "1.20.10",
        "minecraft:recipe_shaped": {
            "description": {"identifier": f"{NS}:ruin_compass"},
            "tags": ["crafting_table"],
            "pattern": [" G ", "GCG", " M "],
            "key": {"G": {"item": "minecraft:gold_ingot"}, "C": {"item": "minecraft:compass"},
                    "M": {"item": "minecraft:mossy_cobblestone"}},
            "unlock": [{"item": "minecraft:compass"}],
            "result": {"item": COMPASS},
        },
    },
    "ancient_map": {
        "format_version": "1.20.10",
        "minecraft:recipe_shapeless": {
            "description": {"identifier": f"{NS}:ancient_map"},
            "tags": ["crafting_table"],
            "ingredients": [{"item": "minecraft:empty_map"}, {"item": "minecraft:gold_ingot"},
                            {"item": "minecraft:ink_sac"}],
            "unlock": [{"item": "minecraft:empty_map"}],
            "result": {"item": MAP},
        },
    },
}


# ---------------------------------------------------------------------------
# Resource pack: client entities, models, animations, particles, sounds
# ---------------------------------------------------------------------------
CLIENT = {
    "temple_guardian": dict(geo="temple", anims="walker", egg=("#4b5a3f", "#3ee07c")),
    "crypt_mummy": dict(geo="mummy", anims="mummy", egg=("#d9cfae", "#5d4a2e")),
    "drowned_captain": dict(geo="captain", anims="walker", egg=("#23305c", "#4d8c82")),
    "jade_idol": dict(geo="temple", anims="walker", egg=("#2eab66", "#e7b73e")),
    "sand_pharaoh": dict(geo="pharaoh", anims="mummy", egg=("#e7b53c", "#2548ad")),
    "abyssal_admiral": dict(geo="captain", anims="walker", egg=("#15182a", "#86fbff")),
}


def client_entity_json(name, c):
    if c["anims"] == "mummy":
        animations = {
            "legs": f"animation.{NS}.walk_legs",
            "arms": f"animation.{NS}.mummy_arms",
            "attack": f"animation.{NS}.attack",
            "look": f"animation.{NS}.look_at_target",
        }
        animate = ["legs", "arms", "attack", "look"]
    else:
        animations = {
            "walk": f"animation.{NS}.walk",
            "attack": f"animation.{NS}.attack",
            "look": f"animation.{NS}.look_at_target",
        }
        animate = ["walk", "attack", "look"]
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": f"{NS}:{name}",
                "materials": {"default": "entity_alphatest"},
                "textures": {"default": f"textures/entity/{NS}/{name}"},
                "geometry": {"default": f"geometry.{NS}.{c['geo']}"},
                "scripts": {
                    "pre_animation": [
                        "variable.tcos0 = (math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed) * 57.3;"
                    ],
                    "animate": animate,
                },
                "animations": animations,
                "render_controllers": [f"controller.render.{NS}.default"],
                "spawn_egg": {"base_color": c["egg"][0], "overlay_color": c["egg"][1]},
            }
        },
    }


def marker_client_json():
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": f"{NS}:ruin_marker",
                "materials": {"default": "entity_alphatest"},
                "textures": {"default": f"textures/entity/{NS}/ruin_marker"},
                "geometry": {"default": f"geometry.{NS}.empty"},
                "render_controllers": [f"controller.render.{NS}.default"],
            }
        },
    }


def humanoid_bones(extra=()):
    bones = [
        {"name": "root", "pivot": [0, 0, 0]},
        {"name": "body", "parent": "root", "pivot": [0, 24, 0],
         "cubes": [{"origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}]},
        {"name": "head", "parent": "body", "pivot": [0, 24, 0],
         "cubes": [{"origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]}]},
        {"name": "rightArm", "parent": "body", "pivot": [-5, 22, 0],
         "cubes": [{"origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}]},
        {"name": "leftArm", "parent": "body", "pivot": [5, 22, 0], "mirror": True,
         "cubes": [{"origin": [4, 12, -2], "size": [4, 12, 4], "uv": [40, 16], "mirror": True}]},
        {"name": "rightLeg", "parent": "root", "pivot": [-1.9, 12, 0],
         "cubes": [{"origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]}]},
        {"name": "leftLeg", "parent": "root", "pivot": [1.9, 12, 0], "mirror": True,
         "cubes": [{"origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [0, 16], "mirror": True}]},
    ]
    bones.extend(extra)
    return bones


GEOMETRIES = {
    "temple": humanoid_bones([
        {"name": "plume", "parent": "head", "pivot": [0, 32, 0],
         "cubes": [{"origin": [-5, 30, 3], "size": [10, 6, 1], "uv": [32, 0]}]},
    ]),
    "mummy": humanoid_bones(),
    "captain": humanoid_bones([
        {"name": "hatBrim", "parent": "head", "pivot": [0, 32, 0],
         "cubes": [{"origin": [-5, 31, -5], "size": [10, 1, 10], "uv": [0, 32]}]},
        {"name": "hatTop", "parent": "head", "pivot": [0, 32, 0],
         "cubes": [{"origin": [-4, 32, -4], "size": [8, 3, 8], "uv": [0, 44]}]},
    ]),
    "pharaoh": humanoid_bones([
        {"name": "nemes", "parent": "head", "pivot": [0, 24, 0],
         "cubes": [{"origin": [-4.5, 21.5, -4.5], "size": [9, 11, 9], "uv": [0, 32]}]},
        {"name": "beard", "parent": "head", "pivot": [0, 24, 0],
         "cubes": [{"origin": [-1, 20, -5], "size": [2, 4, 1], "uv": [40, 32]}]},
    ]),
}


def geometry_json(name, bones):
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": f"geometry.{NS}.{name}",
                "texture_width": 64,
                "texture_height": 64,
                "visible_bounds_width": 3,
                "visible_bounds_height": 4,
                "visible_bounds_offset": [0, 2, 0],
            },
            "bones": bones,
        }],
    }


def empty_geometry_json():
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {"identifier": f"geometry.{NS}.empty", "texture_width": 16, "texture_height": 16,
                            "visible_bounds_width": 1, "visible_bounds_height": 1,
                            "visible_bounds_offset": [0, 0.5, 0]},
            "bones": [{"name": "root", "pivot": [0, 0, 0]}],
        }],
    }


ANIMATIONS = {
    "format_version": "1.8.0",
    "animations": {
        f"animation.{NS}.walk": {
            "loop": True,
            "bones": {
                "rightArm": {"rotation": ["-variable.tcos0", 0.0, 0.0]},
                "leftArm": {"rotation": ["variable.tcos0", 0.0, 0.0]},
                "rightLeg": {"rotation": ["variable.tcos0 * 1.4", 0.0, 0.0]},
                "leftLeg": {"rotation": ["-variable.tcos0 * 1.4", 0.0, 0.0]},
            },
        },
        f"animation.{NS}.walk_legs": {
            "loop": True,
            "bones": {
                "rightLeg": {"rotation": ["variable.tcos0 * 1.4", 0.0, 0.0]},
                "leftLeg": {"rotation": ["-variable.tcos0 * 1.4", 0.0, 0.0]},
            },
        },
        f"animation.{NS}.mummy_arms": {
            "loop": True,
            "bones": {
                "rightArm": {"rotation": ["-85.0 + math.sin(query.life_time * 90.0) * 3.0", 5.0, 0.0]},
                "leftArm": {"rotation": ["-85.0 - math.sin(query.life_time * 90.0) * 3.0", -5.0, 0.0]},
            },
        },
        f"animation.{NS}.attack": {
            "loop": True,
            "bones": {
                "rightArm": {"rotation": ["-math.sin(variable.attack_time * 180.0) * 70.0", 0.0, 0.0]},
                "leftArm": {"rotation": ["-math.sin(variable.attack_time * 180.0) * 35.0", 0.0, 0.0]},
                "body": {"rotation": [0.0, "math.sin(math.sqrt(variable.attack_time) * 360.0) * 8.0", 0.0]},
            },
        },
        f"animation.{NS}.look_at_target": {
            "loop": True,
            "bones": {
                "head": {"relative_to": {"rotation": "entity"},
                         "rotation": ["query.target_x_rotation", "query.target_y_rotation", 0.0]},
            },
        },
    },
}

RENDER_CONTROLLERS = {
    "format_version": "1.8.0",
    "render_controllers": {
        f"controller.render.{NS}.default": {
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            "textures": ["Texture.default"],
        }
    },
}


def particle(identifier, material, components):
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {
                "identifier": f"{NS}:{identifier}",
                "basic_render_parameters": {"material": material, "texture": "textures/particle/particles"},
            },
            "components": components,
        },
    }


SMOKE_UV = {"texture_width": 128, "texture_height": 128,
            "flipbook": {"base_UV": [56, 0], "size_UV": [8, 8], "step_UV": [-8, 0], "frames_per_second": 6,
                         "max_frame": 8, "stretch_to_lifetime": True, "loop": False}}
SPARK_UV = {"texture_width": 128, "texture_height": 128, "uv": [16, 40], "uv_size": [8, 8]}
SPELL_UV = {"texture_width": 128, "texture_height": 128,
            "flipbook": {"base_UV": [64, 64], "size_UV": [8, 8], "step_UV": [-8, 0], "frames_per_second": 8,
                         "max_frame": 8, "stretch_to_lifetime": True, "loop": False}}
TINT = {"color": ["variable.color.r", "variable.color.g", "variable.color.b", 1.0]}

PARTICLES = {
    "poison_gas": particle("poison_gas", "particles_alpha", {
        "minecraft:emitter_rate_instant": {"num_particles": 4},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_box": {"offset": [0, 0.3, 0], "half_dimensions": [0.7, 0.2, 0.7], "direction": [0, 1, 0]},
        "minecraft:particle_initial_speed": 0.2,
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.2, 2.2)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.2, 0], "linear_drag_coefficient": 0.6},
        "minecraft:particle_appearance_billboard": {
            "size": ["0.25 + variable.particle_age * 0.15", "0.25 + variable.particle_age * 0.15"],
            "facing_camera_mode": "lookat_xyz", "uv": SMOKE_UV},
        "minecraft:particle_appearance_tinting": {"color": [0.36, 0.86, 0.28, 0.85]},
        "minecraft:particle_appearance_lighting": {},
    }),
    "rune_spark": particle("rune_spark", "particles_alpha", {
        "minecraft:emitter_rate_instant": {"num_particles": 6},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_sphere": {"radius": 0.6, "direction": "outwards"},
        "minecraft:particle_initial_speed": 0.6,
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.6, 1.1)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.8, 0], "linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_billboard": {"size": [0.14, 0.14], "facing_camera_mode": "lookat_xyz", "uv": SPARK_UV},
        "minecraft:particle_appearance_tinting": TINT,
    }),
    "compass_trail": particle("compass_trail", "particles_alpha", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"direction": [0, 0.2, 0]},
        "minecraft:particle_initial_speed": 0.1,
        "minecraft:particle_lifetime_expression": {"max_lifetime": 1.2},
        "minecraft:particle_appearance_billboard": {"size": [0.18, 0.18], "facing_camera_mode": "lookat_xyz", "uv": SPARK_UV},
        "minecraft:particle_appearance_tinting": {"color": [1.0, 0.82, 0.3, 1.0]},
    }),
    "shockwave": particle("shockwave", "particles_alpha", {
        "minecraft:emitter_rate_instant": {"num_particles": 14},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_disc": {"radius": 0.8, "plane_normal": "y", "direction": "outwards"},
        "minecraft:particle_initial_speed": 5.0,
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.8},
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 3.0},
        "minecraft:particle_appearance_billboard": {"size": [0.35, 0.35], "facing_camera_mode": "lookat_xyz", "uv": SMOKE_UV},
        "minecraft:particle_appearance_tinting": TINT,
    }),
    "dust_burst": particle("dust_burst", "particles_alpha", {
        "minecraft:emitter_rate_instant": {"num_particles": 5},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_box": {"offset": [0, 0.1, 0], "half_dimensions": [0.5, 0.1, 0.5], "direction": [0, 1, 0]},
        "minecraft:particle_initial_speed": 0.5,
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 1.0)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -1.0, 0], "linear_drag_coefficient": 1.0},
        "minecraft:particle_appearance_billboard": {"size": [0.2, 0.2], "facing_camera_mode": "lookat_xyz", "uv": SPELL_UV},
        "minecraft:particle_appearance_tinting": TINT,
    }),
}

SOUNDS = {
    "entity_sounds": {
        "entities": {
            f"{NS}:temple_guardian": {"volume": 1.0, "pitch": [0.7, 0.9], "events": {
                "ambient": "mob.zombie.say", "hurt": "mob.irongolem.hit", "death": "mob.irongolem.death",
                "step": {"sound": "mob.irongolem.walk", "volume": 0.4, "pitch": 1.2}}},
            f"{NS}:crypt_mummy": {"volume": 1.0, "pitch": [0.7, 0.9], "events": {
                "ambient": "mob.husk.ambient", "hurt": "mob.husk.hurt", "death": "mob.husk.death",
                "step": {"sound": "mob.husk.step", "volume": 0.35}}},
            f"{NS}:drowned_captain": {"volume": 1.0, "pitch": [0.8, 0.95], "events": {
                "ambient": "mob.drowned.say", "hurt": "mob.drowned.hurt", "death": "mob.drowned.death",
                "step": {"sound": "mob.drowned.step", "volume": 0.35}}},
            f"{NS}:jade_idol": {"volume": 1.2, "pitch": [0.5, 0.6], "events": {
                "hurt": "mob.irongolem.hit", "death": "mob.elderguardian.death",
                "step": {"sound": "mob.irongolem.walk", "volume": 0.8, "pitch": 0.7}}},
            f"{NS}:sand_pharaoh": {"volume": 1.2, "pitch": [0.5, 0.6], "events": {
                "ambient": "mob.husk.ambient", "hurt": "mob.husk.hurt", "death": "mob.elderguardian.death",
                "step": {"sound": "mob.husk.step", "volume": 0.6}}},
            f"{NS}:abyssal_admiral": {"volume": 1.2, "pitch": [0.5, 0.6], "events": {
                "ambient": "mob.drowned.say", "hurt": "mob.drowned.hurt", "death": "mob.elderguardian.death",
                "step": {"sound": "mob.drowned.step", "volume": 0.6}}},
        }
    }
}


# ---------------------------------------------------------------------------
# Language
# ---------------------------------------------------------------------------
def lang_lines():
    lines = ["## Ancient Ruins Expedition", "pack.name=Ancient Ruins Expedition",
             "pack.description=Explore jungle temples, desert crypts and sunken ships.", ""]
    lines.append("## Blocks")
    for name, b in BLOCKS.items():
        lines.append(f"tile.{NS}:{name}.name={b['display']}")
    lines.append("")
    lines.append("## Items")
    for name, it in ITEMS.items():
        lines.append(f"item.{NS}:{name}.name={it['display']}")
    lines.append("")
    lines.append("## Entities")
    for name, g in GUARDIANS.items():
        lines.append(f"entity.{NS}:{name}.name={g['name']}")
        lines.append(f"item.spawn_egg.entity.{NS}:{name}.name=Spawn {g['name']}")
    for name, b in BOSSES.items():
        lines.append(f"entity.{NS}:{name}.name={b['name']}")
        lines.append(f"item.spawn_egg.entity.{NS}:{name}.name=Spawn {b['name']}")
    lines.append(f"entity.{NS}:ruin_marker.name=Ruin Marker")
    return "\n".join(lines) + "\n"


def manifest_bp():
    return {
        "format_version": 2,
        "header": {
            "name": "Ancient Ruins Expedition BP",
            "description": "Jungle temples, desert crypts and sunken ships with puzzles, traps, guardians and bosses. Mobile optimized. Bedrock 1.21+",
            "uuid": UUIDS["bp_header"],
            "version": VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [
            {"type": "data", "uuid": UUIDS["bp_data"], "version": VERSION},
            {"type": "script", "language": "javascript", "uuid": UUIDS["bp_script"], "version": VERSION,
             "entry": "scripts/main.js"},
        ],
        "dependencies": [
            {"uuid": UUIDS["rp_header"], "version": VERSION},
            *({"module_name": m, "version": v} for m, v in SCRIPT_MODULES.items()),
        ],
        "metadata": {"authors": ["Ancient Ruins Expedition"]},
    }


def manifest_rp():
    return {
        "format_version": 2,
        "header": {
            "name": "Ancient Ruins Expedition RP",
            "description": "Textures, models, particles and sounds for Ancient Ruins Expedition. Small 16px/64px textures for mobile.",
            "uuid": UUIDS["rp_header"],
            "version": VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [{"type": "resources", "uuid": UUIDS["rp_resources"], "version": VERSION}],
        "dependencies": [{"uuid": UUIDS["bp_header"], "version": VERSION}],
        "metadata": {"authors": ["Ancient Ruins Expedition"]},
    }


def texture_atlases():
    terrain = {}
    for name, b in BLOCKS.items():
        tex = b["textures"]
        for t in ([tex] if isinstance(tex, str) else tex.values()):
            terrain[f"{NS}_{t}"] = {"textures": f"textures/blocks/{NS}/{t}"}
    items = {f"{NS}_{name}": {"textures": f"textures/items/{NS}/{name}"} for name in ITEMS}
    return (
        {"resource_pack_name": NS, "texture_name": "atlas.terrain", "padding": 8, "num_mip_levels": 4,
         "texture_data": dict(sorted(terrain.items()))},
        {"resource_pack_name": NS, "texture_name": "atlas.items", "texture_data": items},
    )


def blocks_json():
    data = {"format_version": [1, 1, 0]}
    for name, b in BLOCKS.items():
        data[f"{NS}:{name}"] = {"sound": b["sound"]}
    return data


def build(bp, rp):
    written = []
    w = written.append
    w(write_json(bp, "manifest.json", manifest_bp()))
    w(write_json(rp, "manifest.json", manifest_rp()))
    for name, b in BLOCKS.items():
        w(write_json(bp, f"blocks/{name}.json", block_json(name, b)))
    for name, it in ITEMS.items():
        w(write_json(bp, f"items/{name}.json", item_json(name, it)))
    for name, g in GUARDIANS.items():
        w(write_json(bp, f"entities/{name}.json", guardian_json(name, g)))
    for name, b in BOSSES.items():
        w(write_json(bp, f"entities/{name}.json", boss_json(name, b)))
    w(write_json(bp, "entities/ruin_marker.json", marker_json()))
    for name, pools in CHEST_LOOT.items():
        w(write_json(bp, f"loot_tables/chests/{NS}/{name}.json", {"pools": pools}))
    for name, pools in ENTITY_LOOT.items():
        w(write_json(bp, f"loot_tables/entities/{NS}/{name}.json", {"pools": pools}))
    for name, r in RUINS.items():
        w(write_json(bp, f"features/{name}_feature.json", feature_json(name)))
        w(write_json(bp, f"feature_rules/{name}_rule.json", feature_rule_json(name, r)))
    for name, s in SPAWNS.items():
        w(write_json(bp, f"spawn_rules/{name}.json", spawn_rule_json(name, s)))
    for name, recipe in RECIPES.items():
        w(write_json(bp, f"recipes/{name}.json", recipe))
    w(write_text(bp, "texts/en_US.lang", "pack.name=Ancient Ruins Expedition BP\npack.description=Behavior pack for Ancient Ruins Expedition.\n"))
    w(write_json(bp, "texts/languages.json", ["en_US"]))

    for name, c in CLIENT.items():
        w(write_json(rp, f"entity/{name}.entity.json", client_entity_json(name, c)))
    w(write_json(rp, "entity/ruin_marker.entity.json", marker_client_json()))
    for name, bones in GEOMETRIES.items():
        w(write_json(rp, f"models/entity/{name}.geo.json", geometry_json(name, bones)))
    w(write_json(rp, "models/entity/empty.geo.json", empty_geometry_json()))
    w(write_json(rp, f"animations/{NS}.animation.json", ANIMATIONS))
    w(write_json(rp, f"render_controllers/{NS}.render_controllers.json", RENDER_CONTROLLERS))
    for name, p in PARTICLES.items():
        w(write_json(rp, f"particles/{name}.json", p))
    w(write_json(rp, "sounds.json", SOUNDS))
    terrain, items = texture_atlases()
    w(write_json(rp, "textures/terrain_texture.json", terrain))
    w(write_json(rp, "textures/item_texture.json", items))
    w(write_json(rp, "blocks.json", blocks_json()))
    w(write_text(rp, "texts/en_US.lang", lang_lines()))
    w(write_json(rp, "texts/languages.json", ["en_US"]))
    return written


if __name__ == "__main__":
    import sys
    files = build(sys.argv[1], sys.argv[2])
    print(len(files), "json/lang files written")
