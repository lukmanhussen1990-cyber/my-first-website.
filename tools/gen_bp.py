"""Generates the NPC Kingdom behavior pack."""

import json
import os

import gen_functions
import gen_textures
from npck_data import (BOSSES, BOSS_STATS, ENEMIES, ENEMY_STATS, ITEMS,
                       MARKERS, ORDERS, ROLES, ROLE_STATS, hostile_filter)

FORMAT_ENTITY = "1.21.0"
FORMAT_ITEM = "1.21.0"
FORMAT_RECIPE = "1.20.10"
FORMAT_LOOT = "1.20.10"
FORMAT_SPAWN = "1.8.0"
FORMAT_TRADE = "1.18.0"


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")


HOSTILE = hostile_filter()
KINGDOM_TARGETS = {
    "any_of": [
        {"test": "is_family", "subject": "other", "value": "player"},
        {"test": "is_family", "subject": "other", "value": "npck_friendly"},
        {"test": "is_family", "subject": "other", "value": "villager"},
        {"test": "is_family", "subject": "other", "value": "irongolem"},
    ]
}

NAVIGATION = {
    "can_path_over_water": False,
    "avoid_water": True,
    "avoid_damage_blocks": True,
    "can_open_doors": True,
    "can_pass_doors": True,
    "can_break_doors": False,
    "avoid_portals": True,
    "can_walk": True,
    "can_sink": False,
    "can_jump": True,
}


# ---------------------------------------------------------------------------
# Friendly kingdom NPCs
# ---------------------------------------------------------------------------
def order_component_group(key, mark_variant, role, cls):
    """Movement/behaviour package for one order. Only one is ever active."""
    g = {"minecraft:mark_variant": {"value": mark_variant}}
    stroll = lambda p, s, d, i=120: {
        "priority": p, "speed_multiplier": s, "xz_distance": d,
        "y_distance": 5, "interval": i,
    }
    if key in ("work", "gather"):
        g["minecraft:behavior.random_stroll"] = stroll(7, 0.85, 10)
        if role == "farmer":
            g["minecraft:behavior.harvest_farm_block"] = {
                "priority": 6, "speed_multiplier": 0.6, "search_range": 12,
                "max_seconds_before_search": 20, "seconds_until_new_task": 10,
            }
    elif key == "follow":
        g["minecraft:behavior.follow_owner"] = {
            "priority": 4, "speed_multiplier": 1.25,
            "start_distance": 4, "stop_distance": 2,
        }
        g["minecraft:behavior.random_stroll"] = stroll(10, 0.7, 4)
    elif key == "stay":
        pass
    elif key == "patrol":
        g["minecraft:behavior.random_stroll"] = stroll(7, 1.0, 18, 60)
    elif key == "defend":
        g["minecraft:behavior.random_stroll"] = stroll(8, 1.0, 6, 80)
        g["minecraft:behavior.nearest_attackable_target"] = {
            "priority": 3, "within_radius": 24, "must_see": False,
            "must_see_forget_duration": 20, "reselect_targets": True,
            "entity_types": [{"filters": HOSTILE, "max_dist": 24}],
        }
    elif key == "attack":
        g["minecraft:behavior.random_stroll"] = stroll(9, 1.2, 12, 40)
        g["minecraft:behavior.nearest_attackable_target"] = {
            "priority": 2, "within_radius": 40, "must_see": False,
            "must_see_forget_duration": 30, "reselect_targets": True,
            "entity_types": [{"filters": HOSTILE, "max_dist": 40}],
        }
    elif key == "retreat":
        g["minecraft:behavior.avoid_mob_type"] = {
            "priority": 2,
            "entity_types": [{
                "filters": HOSTILE, "max_dist": 20,
                "walk_speed_multiplier": 1.5, "sprint_speed_multiplier": 1.6,
            }],
        }
        g["minecraft:behavior.random_stroll"] = stroll(9, 1.3, 8, 40)
    elif key in ("build", "repair"):
        g["minecraft:behavior.random_stroll"] = stroll(8, 0.7, 6, 100)
    elif key == "home":
        g["minecraft:behavior.random_stroll"] = stroll(8, 1.1, 6, 100)
    elif key == "celebrate":
        g["minecraft:behavior.random_stroll"] = stroll(7, 1.2, 6, 20)
    elif key == "sleep":
        pass
    return g


def interact_component(role):
    player = {"test": "is_family", "subject": "other", "value": "player"}

    def holding(item):
        return {"test": "has_equipment", "subject": "other",
                "domain": "hand", "value": item}

    return {
        "interactions": [
            {
                "on_interact": {"filters": {"all_of": [player, holding("npck:command_staff")]}},
                "interact_text": "action.interact.npck.command",
                "spawn_entities": "npck:m_tap",
                "play_sounds": "note.pling",
                "swing": True,
                "use_item": False,
                "cooldown": 0.4,
            },
            {
                "on_interact": {"filters": {"all_of": [player, holding("npck:command_banner")]}},
                "interact_text": "action.interact.npck.rally",
                "spawn_entities": "npck:m_rally",
                "play_sounds": "note.bell",
                "swing": True,
                "use_item": False,
                "cooldown": 0.8,
            },
            {
                "on_interact": {"filters": {"all_of": [
                    player,
                    {"test": "has_equipment", "subject": "other",
                     "domain": "hand", "operator": "!=", "value": "emerald"},
                ]}},
                "interact_text": "action.interact.npck.talk",
                "spawn_entities": "npck:m_talk",
                "use_item": False,
                "cooldown": 1.2,
            },
        ]
    }


def npc_entity(role):
    hp, dmg, speed, cls, _work = ROLE_STATS[role]
    is_trader = role in ("merchant", "blacksmith")

    components = {
        "minecraft:type_family": {
            "family": ["npck", "npck_friendly", "npck_" + cls, "npck_" + role]
        },
        "minecraft:collision_box": {"width": 0.6, "height": 1.85},
        "minecraft:health": {"value": hp, "max": hp},
        "minecraft:movement": {"value": speed},
        "minecraft:navigation.walk": dict(NAVIGATION),
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:can_climb": {},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:knockback_resistance": {"value": 0.25},
        "minecraft:nameable": {"allow_name_tag_renaming": True},
        "minecraft:persistent": {},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
        "minecraft:attack": {"damage": dmg},
        "minecraft:mark_variant": {"value": 1},
        "minecraft:scale": {"value": 1.0},
        "minecraft:annotation.open_door": {},
        "minecraft:conditional_bandwidth_optimization": {},
        "minecraft:loot": {"table": "loot_tables/entities/npck_%s.json" % cls},
        "minecraft:equipment": {"table": "loot_tables/equipment/npck_%s.json" % role},
        "minecraft:damage_sensor": {
            "triggers": [
                {"cause": "fall", "deals_damage": False},
                {"cause": "suffocation", "deals_damage": False},
            ]
        },
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.panic": {"priority": 1, "speed_multiplier": 1.5},
        "minecraft:behavior.hurt_by_target": {
            "priority": 2,
            "entity_types": [{"filters": HOSTILE, "max_dist": 16}],
            "alert_same_type": True,
        },
        "minecraft:behavior.melee_attack": {
            "priority": 6, "speed_multiplier": 1.1,
            "track_target": True, "reach_multiplier": 1.6,
        },
        "minecraft:behavior.look_at_player": {
            "priority": 11, "look_distance": 8, "probability": 0.04,
        },
        "minecraft:behavior.random_look_around": {"priority": 12},
    }

    if cls == "soldier":
        components["minecraft:behavior.nearest_attackable_target"] = {
            "priority": 4, "within_radius": 18, "must_see": True,
            "must_see_forget_duration": 20, "reselect_targets": True,
            "entity_types": [{"filters": HOSTILE, "max_dist": 18}],
        }
    else:
        components["minecraft:behavior.avoid_mob_type"] = {
            "priority": 3,
            "entity_types": [{
                "filters": HOSTILE, "max_dist": 10,
                "walk_speed_multiplier": 1.4, "sprint_speed_multiplier": 1.5,
            }],
        }

    if role in ("archer",):
        components["minecraft:shooter"] = {"def": "minecraft:arrow"}
        components["minecraft:behavior.ranged_attack"] = {
            "priority": 4, "attack_interval_min": 1.2, "attack_interval_max": 2.4,
            "attack_radius": 16, "charge_shoot_trigger": 1, "burst_shots": 1,
            "speed_multiplier": 1.1,
        }

    if role == "farmer":
        components["minecraft:inventory"] = {"inventory_size": 8, "private": True}

    if is_trader:
        table = "trading/npck_%s.json" % role
        components["minecraft:trade_table"] = {
            "display_name": "entity.npck:%s.trade" % role,
            "table": table,
            "convert_trades_economy": False,
        }
        components["minecraft:behavior.trade_with_player"] = {"priority": 1}
    else:
        components["minecraft:interact"] = interact_component(role)
        components["minecraft:tameable"] = {
            "probability": 1.0,
            "tame_items": ["minecraft:emerald"],
            "tame_event": {"event": "npck:on_recruited", "target": "self"},
        }

    order_groups = {}
    order_keys = [o[1] for o in ORDERS] + ["sleep"]
    for oid, key, _label, mv in ORDERS:
        order_groups["npck:o_" + key] = order_component_group(key, mv, role, cls)
    order_groups["npck:o_sleep"] = order_component_group("sleep", 3, role, cls)
    order_groups["npck:recruited"] = {
        "minecraft:is_tamed": {},
        "minecraft:type_family": {
            "family": ["npck", "npck_friendly", "npck_" + cls,
                       "npck_" + role, "npck_recruited"]
        },
    }

    events = {
        "minecraft:entity_spawned": {
            "add": {"component_groups": ["npck:o_work"]}
        },
        "npck:on_recruited": {"add": {"component_groups": ["npck:recruited"]}},
    }
    all_order_groups = ["npck:o_" + k for k in order_keys]
    for key in order_keys:
        events["npck:order_" + key] = {
            "remove": {"component_groups": all_order_groups},
            "add": {"component_groups": ["npck:o_" + key]},
        }

    return {
        "format_version": FORMAT_ENTITY,
        "minecraft:entity": {
            "description": {
                "identifier": "npck:" + role,
                "is_spawnable": True,
                "is_summonable": True,
            },
            "component_groups": order_groups,
            "components": components,
            "events": events,
        },
    }


# ---------------------------------------------------------------------------
# Enemies & bosses
# ---------------------------------------------------------------------------
def enemy_entity(name, hp, dmg, speed, projectile, scale=1.0, boss_name=None):
    components = {
        "minecraft:type_family": {
            "family": ["npck_enemy", "monster", "mob", "npck_e_" + name]
        },
        "minecraft:collision_box": {"width": 0.6, "height": 1.9},
        "minecraft:health": {"value": hp, "max": hp},
        "minecraft:movement": {"value": speed},
        "minecraft:navigation.walk": dict(NAVIGATION, can_break_doors=bool(boss_name)),
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:can_climb": {},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:knockback_resistance": {"value": 0.6 if boss_name else 0.1},
        "minecraft:nameable": {},
        "minecraft:persistent": {},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
        "minecraft:attack": {"damage": dmg},
        "minecraft:mark_variant": {"value": 5},
        "minecraft:scale": {"value": scale},
        "minecraft:annotation.open_door": {},
        "minecraft:conditional_bandwidth_optimization": {},
        "minecraft:loot": {
            "table": "loot_tables/entities/npck_%s.json" % (
                "boss" if boss_name else "enemy")
        },
        "minecraft:equipment": {"table": "loot_tables/equipment/npck_%s.json" % name},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.nearest_attackable_target": {
            "priority": 2, "within_radius": 40, "must_see": False,
            "must_see_forget_duration": 30, "reselect_targets": True,
            "entity_types": [{"filters": KINGDOM_TARGETS, "max_dist": 40}],
        },
        "minecraft:behavior.hurt_by_target": {"priority": 1, "alert_same_type": True},
        "minecraft:behavior.melee_attack": {
            "priority": 4, "speed_multiplier": 1.15,
            "track_target": True, "reach_multiplier": 1.7,
        },
        "minecraft:behavior.random_stroll": {
            "priority": 7, "speed_multiplier": 1.0, "xz_distance": 16, "interval": 60,
        },
        "minecraft:behavior.look_at_player": {"priority": 9, "look_distance": 10},
        "minecraft:behavior.random_look_around": {"priority": 10},
        # raid stragglers eventually clean themselves up so worlds stay tidy
        "minecraft:timer": {
            "looping": False, "time": 1200.0,
            "time_down_event": {"event": "npck:expire"},
        },
    }
    if projectile:
        components["minecraft:shooter"] = {"def": projectile}
        components["minecraft:behavior.ranged_attack"] = {
            "priority": 3, "attack_interval_min": 1.4, "attack_interval_max": 2.8,
            "attack_radius": 18, "charge_shoot_trigger": 1, "burst_shots": 1,
            "speed_multiplier": 1.0,
        }
    if boss_name:
        components["minecraft:boss"] = {
            "should_darken_sky": False, "hud_range": 64, "name": boss_name,
        }
        components["minecraft:fire_immune"] = {}
        components["minecraft:damage_sensor"] = {
            "triggers": [{"cause": "fall", "deals_damage": False}]
        }

    return {
        "format_version": FORMAT_ENTITY,
        "minecraft:entity": {
            "description": {
                "identifier": "npck:" + name,
                "is_spawnable": True,
                "is_summonable": True,
            },
            "component_groups": {
                "npck:despawned": {"minecraft:instant_despawn": {}}
            },
            "components": components,
            "events": {
                "npck:expire": {"add": {"component_groups": ["npck:despawned"]}}
            },
        },
    }


# ---------------------------------------------------------------------------
# Support entities
# ---------------------------------------------------------------------------
def marker_entity(name):
    return {
        "format_version": FORMAT_ENTITY,
        "minecraft:entity": {
            "description": {
                "identifier": "npck:" + name,
                "is_spawnable": False,
                "is_summonable": True,
            },
            "component_groups": {
                "npck:despawned": {"minecraft:instant_despawn": {}}
            },
            "components": {
                "minecraft:type_family": {"family": ["npck_marker", "npck_" + name]},
                "minecraft:collision_box": {"width": 0.1, "height": 0.1},
                "minecraft:health": {"value": 1, "max": 1},
                "minecraft:physics": {"has_gravity": False, "has_collision": False},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
                "minecraft:knockback_resistance": {"value": 1.0},
                "minecraft:fire_immune": {},
                "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": False}]},
                "minecraft:conditional_bandwidth_optimization": {},
                "minecraft:timer": {
                    "looping": False, "time": 4.0,
                    "time_down_event": {"event": "npck:expire"},
                },
            },
            "events": {
                "npck:expire": {"add": {"component_groups": ["npck:despawned"]}}
            },
        },
    }


def throne_seat_entity():
    return {
        "format_version": FORMAT_ENTITY,
        "minecraft:entity": {
            "description": {
                "identifier": "npck:throne_seat",
                "is_spawnable": False,
                "is_summonable": True,
            },
            "components": {
                "minecraft:type_family": {"family": ["npck_seat"]},
                "minecraft:collision_box": {"width": 0.4, "height": 0.4},
                "minecraft:health": {"value": 1, "max": 1},
                "minecraft:physics": {"has_gravity": False, "has_collision": False},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
                "minecraft:knockback_resistance": {"value": 1.0},
                "minecraft:fire_immune": {},
                "minecraft:persistent": {},
                "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": False}]},
                "minecraft:conditional_bandwidth_optimization": {},
                "minecraft:rideable": {
                    "seat_count": 1,
                    "family_types": ["player"],
                    "interact_text": "action.interact.npck.sit",
                    "pull_in_entities": False,
                    "seats": {"position": [0.0, 0.1, 0.0]},
                },
            },
        },
    }


def kingdom_core_entity():
    return {
        "format_version": FORMAT_ENTITY,
        "minecraft:entity": {
            "description": {
                "identifier": "npck:kingdom_core",
                "is_spawnable": True,
                "is_summonable": True,
            },
            "component_groups": {
                "npck:daytime": {
                    "minecraft:type_family": {"family": ["npck_core", "npck_day"]}
                },
                "npck:nighttime": {
                    "minecraft:type_family": {"family": ["npck_core", "npck_night"]}
                },
            },
            "components": {
                "minecraft:type_family": {"family": ["npck_core"]},
                "minecraft:collision_box": {"width": 0.9, "height": 1.4},
                "minecraft:health": {"value": 400, "max": 400},
                "minecraft:physics": {"has_gravity": True, "has_collision": True},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
                "minecraft:knockback_resistance": {"value": 1.0},
                "minecraft:persistent": {},
                "minecraft:fire_immune": {},
                "minecraft:nameable": {"allow_name_tag_renaming": True},
                "minecraft:conditional_bandwidth_optimization": {},
                "minecraft:damage_sensor": {
                    "triggers": [
                        {
                            "cause": "entity_attack",
                            "deals_damage": True,
                            "on_damage": {"filters": {
                                "test": "is_family", "subject": "other", "value": "player"
                            }},
                        },
                        {"cause": "all", "deals_damage": False},
                    ]
                },
                "minecraft:environment_sensor": {
                    "triggers": [
                        {
                            "filters": {"test": "is_daytime", "subject": "self",
                                        "operator": "==", "value": True},
                            "event": "npck:daytime",
                        },
                        {
                            "filters": {"test": "is_daytime", "subject": "self",
                                        "operator": "==", "value": False},
                            "event": "npck:nighttime",
                        },
                    ]
                },
                "minecraft:interact": {
                    "interactions": [{
                        "on_interact": {"filters": {
                            "test": "is_family", "subject": "other", "value": "player"
                        }},
                        "interact_text": "action.interact.npck.core",
                        "spawn_entities": "npck:m_core",
                        "play_sounds": "beacon.activate",
                        "use_item": False,
                        "cooldown": 0.6,
                    }]
                },
            },
            "events": {
                "npck:daytime": {
                    "remove": {"component_groups": ["npck:nighttime"]},
                    "add": {"component_groups": ["npck:daytime"]},
                },
                "npck:nighttime": {
                    "remove": {"component_groups": ["npck:daytime"]},
                    "add": {"component_groups": ["npck:nighttime"]},
                },
            },
        },
    }


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------
PLACER_ENTITY = {
    "npck:kingdom_core": "npck:kingdom_core",
}


def item_json(item):
    comps = {
        "minecraft:icon": {"texture": "npck_" + item["texture"]},
        "minecraft:display_name": {"value": item["name"]},
        "minecraft:max_stack_size": {"value": item.get("stack", 64)},
    }
    if item.get("hand"):
        comps["minecraft:hand_equipped"] = {"value": True}
    if item["id"] in PLACER_ENTITY:
        comps["minecraft:entity_placer"] = {"entity": PLACER_ENTITY[item["id"]]}
        comps["minecraft:use_modifiers"] = {"use_duration": 0.1, "movement_modifier": 1.0}
    if item.get("armor"):
        slot, protection, durability, ench_slot = item["armor"]
        comps["minecraft:wearable"] = {"slot": slot, "protection": protection}
        comps["minecraft:durability"] = {"max_durability": durability}
        comps["minecraft:repairable"] = {
            "repair_items": [{"items": ["minecraft:gold_ingot"], "repair_amount": 60}]
        }
        comps["minecraft:enchantable"] = {"value": 18, "slot": ench_slot}
    return {
        "format_version": FORMAT_ITEM,
        "minecraft:item": {
            "description": {
                "identifier": item["id"],
                "menu_category": {
                    "category": item["category"],
                    "group": item["group"],
                },
            },
            "components": comps,
        },
    }


# ---------------------------------------------------------------------------
# Loot / equipment / trading / recipes
# ---------------------------------------------------------------------------
def loot_table(entries):
    return {
        "pools": [{
            "rolls": 1,
            "entries": [dict({"type": "item", "weight": 1}, **e) for e in entries],
        }]
    }


def simple_equipment(item):
    if not item:
        return {"pools": []}
    return {
        "pools": [{
            "rolls": 1,
            "entries": [{"type": "item", "name": item, "weight": 1}],
        }]
    }


EQUIPMENT = {
    "builder": "minecraft:iron_shovel",
    "farmer": "minecraft:iron_hoe",
    "miner": "minecraft:iron_pickaxe",
    "lumberjack": "minecraft:iron_axe",
    "guard": "minecraft:iron_sword",
    "archer": "minecraft:bow",
    "knight": "minecraft:iron_sword",
    "healer": None,
    "merchant": None,
    "blacksmith": "minecraft:iron_axe",
    "royal_guard": "minecraft:golden_sword",
    "general": "minecraft:diamond_sword",
    "advisor": None,
    "bandit": "minecraft:stone_sword",
    "raider": "minecraft:iron_axe",
    "dark_knight": "minecraft:iron_sword",
    "undead_soldier": "minecraft:stone_sword",
    "enemy_archer": "minecraft:bow",
    "enemy_wizard": None,
    "bandit_king": "minecraft:golden_sword",
    "dark_wizard": None,
    "undead_emperor": "minecraft:diamond_sword",
}


def merchant_trades():
    def trade(want, want_n, give, give_n, uses=16):
        return {
            "wants": [{"item": want, "quantity": want_n, "price_multiplier": 0.05}],
            "gives": [{"item": give, "quantity": give_n}],
            "max_uses": uses, "trader_exp": 2, "reward_exp": False,
        }
    return {
        "tiers": [{
            "trades": [
                trade("minecraft:emerald", 1, "minecraft:bread", 6),
                trade("minecraft:emerald", 2, "minecraft:cooked_beef", 5),
                trade("minecraft:emerald", 3, "minecraft:golden_carrot", 3),
                trade("minecraft:wheat", 20, "minecraft:emerald", 1),
                trade("minecraft:oak_log", 24, "minecraft:emerald", 1),
                trade("minecraft:cobblestone", 32, "minecraft:emerald", 1),
                trade("minecraft:emerald", 4, "minecraft:torch", 16),
                trade("minecraft:emerald", 6, "minecraft:oak_planks", 32),
            ]
        }]
    }


def blacksmith_trades():
    def trade(want, want_n, give, give_n, uses=8):
        return {
            "wants": [{"item": want, "quantity": want_n, "price_multiplier": 0.05}],
            "gives": [{"item": give, "quantity": give_n}],
            "max_uses": uses, "trader_exp": 3, "reward_exp": False,
        }
    return {
        "tiers": [{
            "trades": [
                trade("minecraft:iron_ingot", 6, "minecraft:iron_sword", 1),
                trade("minecraft:iron_ingot", 8, "minecraft:iron_chestplate", 1),
                trade("minecraft:iron_ingot", 7, "minecraft:iron_leggings", 1),
                trade("minecraft:iron_ingot", 5, "minecraft:iron_helmet", 1),
                trade("minecraft:iron_ingot", 4, "minecraft:iron_boots", 1),
                trade("minecraft:iron_ingot", 3, "minecraft:shield", 1),
                trade("minecraft:emerald", 5, "minecraft:iron_ingot", 4),
                trade("minecraft:emerald", 12, "minecraft:diamond", 1, 4),
            ]
        }]
    }


RECIPES = [
    ("kingdom_core", ["GDG", "DED", "GDG"], {
        "G": "minecraft:gold_ingot", "D": "minecraft:diamond",
        "E": "minecraft:emerald_block"}),
    ("command_staff", [" DG", " SG", "S  "], {
        "D": "minecraft:diamond", "G": "minecraft:gold_ingot",
        "S": "minecraft:stick"}),
    ("command_banner", ["WWW", "WGW", " S "], {
        "W": "minecraft:red_wool", "G": "minecraft:gold_ingot",
        "S": "minecraft:stick"}),
    ("royal_ledger", [" G ", "PBP", " G "], {
        "G": "minecraft:gold_ingot", "P": "minecraft:paper",
        "B": "minecraft:book"}),
    ("celebration_horn", ["  G", " GN", "G  "], {
        "G": "minecraft:gold_ingot", "N": "minecraft:note_block"}),
    ("war_horn", ["  G", " GR", "G  "], {
        "G": "minecraft:gold_ingot", "R": "minecraft:redstone_block"}),
    ("royal_crown", ["DGD", "GGG", "   "], {
        "G": "minecraft:gold_ingot", "D": "minecraft:diamond"}),
    ("royal_chestplate", ["G G", "GDG", "GGG"], {
        "G": "minecraft:gold_ingot", "D": "minecraft:diamond"}),
    ("royal_leggings", ["GDG", "G G", "G G"], {
        "G": "minecraft:gold_ingot", "D": "minecraft:diamond"}),
    ("royal_boots", ["   ", "G G", "D D"], {
        "G": "minecraft:gold_ingot", "D": "minecraft:diamond"}),
]


def recipe_json(name, pattern, key):
    return {
        "format_version": FORMAT_RECIPE,
        "minecraft:recipe_shaped": {
            "description": {"identifier": "npck:%s_recipe" % name},
            "tags": ["crafting_table"],
            "pattern": pattern,
            "key": {k: {"item": v} for k, v in key.items()},
            "unlock": [{"item": v} for v in sorted(set(key.values()))],
            "result": {"item": "npck:" + name, "count": 1},
        },
    }


def spawn_rules(name, weight, night_only=True):
    conditions = {
        "minecraft:spawns_on_surface": {},
        "minecraft:difficulty_filter": {"min": "easy", "max": "hard"},
        "minecraft:weight": {"default": weight},
        "minecraft:herd": {"min_size": 1, "max_size": 2},
        "minecraft:biome_filter": {
            "test": "has_biome_tag", "operator": "==", "value": "overworld"
        },
    }
    if night_only:
        conditions["minecraft:brightness_filter"] = {
            "min": 0, "max": 7, "adjust_for_weather": False
        }
    return {
        "format_version": FORMAT_SPAWN,
        "minecraft:spawn_rules": {
            "description": {
                "identifier": "npck:" + name,
                "population_control": "monster",
            },
            "conditions": [conditions],
        },
    }


# ---------------------------------------------------------------------------
def lang_lines():
    from npck_data import ALL_MOBS, pretty
    lines = [
        "pack.name=NPC Kingdom",
        "pack.description=Rule a living kingdom of working, fighting NPCs.",
        "",
    ]
    for item in ITEMS:
        lines.append("item.%s.name=%s" % (item["id"], item["name"]))
    for mob in ALL_MOBS:
        lines.append("entity.npck:%s.name=%s" % (mob, pretty(mob)))
    lines.append("entity.npck:kingdom_core.name=Kingdom Core")
    lines.append("")
    return "\n".join(lines)


def generate(root, uuids):
    write_json(os.path.join(root, "manifest.json"), {
        "format_version": 2,
        "header": {
            "name": "NPC Kingdom",
            "description": "Found a kingdom, recruit NPC workers and soldiers, upgrade from Camp to Kingdom and survive enemy raids.",
            "uuid": uuids["bp_header"],
            "version": [1, 0, 0],
            "min_engine_version": [1, 21, 0],
        },
        "modules": [{
            "type": "data",
            "description": "NPC Kingdom behaviours",
            "uuid": uuids["bp_module"],
            "version": [1, 0, 0],
        }],
        "dependencies": [{"uuid": uuids["rp_header"], "version": [1, 0, 0]}],
        "metadata": {
            "authors": ["NPC Kingdom"],
            "license": "MIT",
            "product_type": "addon",
        },
    })

    for role in ROLES:
        write_json(os.path.join(root, "entities", "npck_%s.json" % role),
                   npc_entity(role))
    for name in ENEMIES:
        hp, dmg, speed, proj, _tier = ENEMY_STATS[name]
        write_json(os.path.join(root, "entities", "npck_%s.json" % name),
                   enemy_entity(name, hp, dmg, speed, proj))
    for name in BOSSES:
        hp, dmg, speed, scale, proj, label = BOSS_STATS[name]
        write_json(os.path.join(root, "entities", "npck_%s.json" % name),
                   enemy_entity(name, hp, dmg, speed, proj, scale, label))
    for marker in MARKERS:
        if marker == "throne_seat":
            write_json(os.path.join(root, "entities", "npck_throne_seat.json"),
                       throne_seat_entity())
        else:
            write_json(os.path.join(root, "entities", "npck_%s.json" % marker),
                       marker_entity(marker))
    write_json(os.path.join(root, "entities", "npck_kingdom_core.json"),
               kingdom_core_entity())

    for item in ITEMS:
        short = item["id"].split(":", 1)[1]
        write_json(os.path.join(root, "items", "npck_%s.json" % short), item_json(item))

    # loot
    write_json(os.path.join(root, "loot_tables", "entities", "npck_worker.json"),
               loot_table([{"name": "minecraft:bread"}, {"name": "minecraft:stick"}]))
    write_json(os.path.join(root, "loot_tables", "entities", "npck_soldier.json"),
               loot_table([{"name": "minecraft:iron_ingot"}]))
    write_json(os.path.join(root, "loot_tables", "entities", "npck_support.json"),
               loot_table([{"name": "minecraft:glistering_melon_slice"}]))
    write_json(os.path.join(root, "loot_tables", "entities", "npck_civilian.json"),
               loot_table([{"name": "minecraft:emerald"}]))
    write_json(os.path.join(root, "loot_tables", "entities", "npck_enemy.json"), {
        "pools": [
            {"rolls": {"min": 0, "max": 2}, "entries": [
                {"type": "item", "name": "minecraft:emerald", "weight": 3},
                {"type": "item", "name": "minecraft:iron_ingot", "weight": 3},
                {"type": "item", "name": "minecraft:gold_ingot", "weight": 2},
                {"type": "item", "name": "minecraft:bone", "weight": 2},
            ]}
        ]
    })
    write_json(os.path.join(root, "loot_tables", "entities", "npck_boss.json"), {
        "pools": [
            {"rolls": 1, "entries": [
                {"type": "item", "name": "minecraft:diamond",
                 "functions": [{"function": "set_count", "count": {"min": 3, "max": 7}}]}
            ]},
            {"rolls": 1, "entries": [
                {"type": "item", "name": "minecraft:emerald_block",
                 "functions": [{"function": "set_count", "count": {"min": 2, "max": 5}}]}
            ]},
            {"rolls": 1, "entries": [
                {"type": "item", "name": "minecraft:gold_block",
                 "functions": [{"function": "set_count", "count": {"min": 2, "max": 4}}]}
            ]},
            {"rolls": 1, "entries": [
                {"type": "item", "name": "minecraft:enchanted_golden_apple", "weight": 1},
                {"type": "item", "name": "minecraft:golden_apple", "weight": 3},
            ]},
        ]
    })

    for name, item in EQUIPMENT.items():
        write_json(os.path.join(root, "loot_tables", "equipment", "npck_%s.json" % name),
                   simple_equipment(item))

    write_json(os.path.join(root, "trading", "npck_merchant.json"), merchant_trades())
    write_json(os.path.join(root, "trading", "npck_blacksmith.json"), blacksmith_trades())

    for name, pattern, key in RECIPES:
        write_json(os.path.join(root, "recipes", "npck_%s.json" % name),
                   recipe_json(name, pattern, key))

    write_json(os.path.join(root, "spawn_rules", "npck_bandit.json"),
               spawn_rules("bandit", 3))
    write_json(os.path.join(root, "spawn_rules", "npck_undead_soldier.json"),
               spawn_rules("undead_soldier", 2))

    os.makedirs(os.path.join(root, "texts"), exist_ok=True)
    with open(os.path.join(root, "texts", "en_US.lang"), "w", encoding="utf-8") as fh:
        fh.write(lang_lines())
    write_json(os.path.join(root, "texts", "languages.json"), ["en_US"])

    gen_functions.generate(root)
    gen_textures.generate_bp_icon(root)
