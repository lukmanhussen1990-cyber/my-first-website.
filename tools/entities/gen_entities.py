#!/usr/bin/env python3
"""Generate the BP entity definitions for the Parasite Apocalypse horde.

Outputs (all strict JSON / Markdown, deterministic, safe to re-run):

* addon/behavior_pack/entities/pas_<name>.json      7 horde entities
* addon/behavior_pack/loot_tables/pas/*.json        their loot tables
* tools/entities/contract.json                      machine-readable summary
                                                    (ids, families, groups,
                                                    events, stats) for tests
* docs/ENTITIES.md                                  human documentation

Every format detail was checked against the Mojang bedrock-samples tag
v1.21.0.26-preview (documentation/Entities.html, "Entity Events.html" and
the vanilla behavior_pack/entities/*.json of that build).  Run
tools/entities/check_entities.py afterwards; it re-validates the output
against that reference.

Usage:  python3 tools/entities/gen_entities.py [--check]
        --check  only verify that the files on disk are up to date
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BP = REPO / "addon" / "behavior_pack"
ENTITY_DIR = BP / "entities"
LOOT_DIR = BP / "loot_tables" / "pas"
CONTRACT = REPO / "tools" / "entities" / "contract.json"
DOC = REPO / "docs" / "ENTITIES.md"

# Every vanilla entity of this build that uses the current schema declares
# "format_version": "1.21.0" (spider, zombie, villager_v2, cow, sheep, ...).
FORMAT_VERSION = "1.21.0"

# ---------------------------------------------------------------------------
# Shared identifiers (must match addon/behavior_pack/scripts/lib/ids.js)
# ---------------------------------------------------------------------------
FAM_HORDE = "pas_horde"
FAM_PARASITE = "pas_parasite"
FAM_INFECTED = "pas_infected"
TAG_INCUBATING = "pas_incubating"
TAG_INFECTED_PLAYER = "pas_infected_player"

G_HUNTING = "pas:hunting"
G_DORMANT = "pas:dormant"
G_BABY = "pas:baby"
G_SHEARED = "pas:sheared"
G_NEWBORN = "pas:newborn"
G_JUVENILE = "pas:juvenile"

E_SPAWNED = "minecraft:entity_spawned"
E_BORN_VANILLA = "minecraft:entity_born"
E_TRANSFORMED = "minecraft:entity_transformed"
E_DORMANT = "pas:become_dormant"
E_ACTIVE = "pas:become_active"
E_MAKE_BABY = "pas:make_baby"
E_SET_SHEARED = "pas:set_sheared"
E_BORN = "pas:born"
E_NEWBORN_GROW = "pas:newborn_grow"
E_NEWBORN_DONE = "pas:newborn_done"

# Vanilla families the horde hunts (verified in the 1.21.0.26 vanilla BP:
# player.json "player", villager(_v2).json "villager", wandering_trader.json
# "wandering_trader", cow.json "cow", mooshroom.json "mushroomcow",
# pig.json "pig", sheep.json "sheep", chicken.json "chicken").
TARGET_FAMILIES = [
    "player", "villager", "wandering_trader", "cow",
    "mushroomcow", "pig", "sheep", "chicken",
]

# Targeting / retaliation reach (SPEC §3: ~within_radius 24).
TARGET_RADIUS = 24.0


def target_filter() -> dict:
    """The exact SPEC §3 targeting filter."""
    return {
        "all_of": [
            {"any_of": [
                {"test": "is_family", "subject": "other", "value": fam}
                for fam in TARGET_FAMILIES
            ]},
            {"test": "is_family", "subject": "other", "operator": "!=", "value": FAM_HORDE},
            {"test": "has_tag", "subject": "other", "operator": "!=", "value": TAG_INCUBATING},
            {"test": "has_tag", "subject": "other", "operator": "!=", "value": TAG_INFECTED_PLAYER},
        ]
    }


# ---------------------------------------------------------------------------
# Indexed variant kinds:  kind -> (component, group prefix, event prefix)
# ---------------------------------------------------------------------------
VARIANT_KINDS = {
    "variant": ("minecraft:variant", "pas:variant_", "pas:set_variant_"),
    "mark": ("minecraft:mark_variant", "pas:mark_", "pas:set_mark_"),
    "skin": ("minecraft:skin_id", "pas:skin_", "pas:set_skin_"),
    "color": ("minecraft:color", "pas:color_", "pas:set_color_"),
}

# Human-readable labels for documentation only.
VILLAGER_PROFESSIONS = [
    "unskilled", "farmer", "fisherman", "shepherd", "fletcher", "librarian",
    "cartographer", "cleric", "armorer", "weaponsmith", "toolsmith",
    "butcher", "leatherworker", "mason", "nitwit",
]  # same order as vanilla villager_v2.json minecraft:variant 0..14
VILLAGER_MARKS = ["plains", "desert", "jungle", "savanna", "snow", "swamp", "taiga"]
# vanilla villager_v2.json: desert 1, jungle 2, savanna 3, snow 4, swamp 5, taiga 6
COW_VARIANTS = ["cow", "red mooshroom", "brown mooshroom"]
SHEEP_COLORS = [
    "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink",
    "gray", "light_gray", "cyan", "purple", "blue", "brown", "green", "red",
    "black",
]  # palette index used by minecraft:color / query.color

BREATH_LAND = {"total_supply": 15, "suffocate_time": 0}            # vanilla animals/spider
BREATH_ZOMBIE = {"total_supply": 15, "suffocate_time": 0,
                 "breathes_air": True, "breathes_water": True}     # vanilla zombie


# ---------------------------------------------------------------------------
# Entity table
# ---------------------------------------------------------------------------
# chase = melee speed_multiplier, stroll = random_stroll speed_multiplier
ENTITIES = [
    {
        "key": "parasite", "id": "pas:parasite", "species": None,
        "name": "Parasite",
        "families": [FAM_HORDE, FAM_PARASITE, "monster", "mob", "arthropod"],
        "health": 12, "attack": 3, "movement": 0.32, "chase": 1.15, "stroll": 0.8,
        "collision": (0.8, 0.6), "collision_src": "own design (spider 1.4x0.9, cave spider 0.7x0.5)",
        "nav": "climb", "amphibious": False, "breath": BREATH_LAND,
        "leap": True, "fall_immune": True, "baby": False, "sheared": False,
        "variants": {}, "newborn": True,
        "xp": "query.last_hit_by_player ? 5 : 0",
        "loot": "parasite",
        "vanilla_ref": "spider / cave_spider",
        "vanilla_speed": "spider 0.30",
    },
    {
        "key": "infected_villager", "id": "pas:infected_villager", "species": "villager",
        "name": "Infected Villager",
        "health": 24, "attack": 4, "movement": 0.32, "chase": 1.1, "stroll": 0.7,
        "collision": (0.6, 1.9), "collision_src": "villager_v2.json",
        "nav": "walk", "amphibious": False, "breath": BREATH_LAND,
        "leap": False, "fall_immune": False, "baby": True, "sheared": False,
        "variants": {"variant": 15, "mark": 7, "skin": 6}, "newborn": False,
        "xp": "query.last_hit_by_player ? 5 : 0",
        "loot": "infected_villager",
        "vanilla_ref": "villager_v2",
        "vanilla_speed": "villager 0.5 x 0.6 (stroll/panic) = 0.30",
    },
    {
        "key": "infected_cow", "id": "pas:infected_cow", "species": "cow",
        "name": "Infected Cow",
        "health": 14, "attack": 4, "movement": 0.28, "chase": 1.15, "stroll": 0.8,
        "collision": (0.9, 1.3), "collision_src": "cow.json / mooshroom.json",
        "nav": "walk", "amphibious": False, "breath": BREATH_LAND,
        "leap": False, "fall_immune": False, "baby": True, "sheared": False,
        "variants": {"variant": 3}, "newborn": False,
        "xp": "query.last_hit_by_player ? Math.Random(2,4) : 0",
        "loot": "infected_cow",
        "vanilla_ref": "cow / mooshroom",
        "vanilla_speed": "cow 0.25 (panic x1.25 = 0.31)",
    },
    {
        "key": "infected_pig", "id": "pas:infected_pig", "species": "pig",
        "name": "Infected Pig",
        "health": 14, "attack": 3, "movement": 0.28, "chase": 1.15, "stroll": 0.9,
        "collision": (0.9, 0.9), "collision_src": "pig.json",
        "nav": "walk", "amphibious": False, "breath": BREATH_LAND,
        "leap": False, "fall_immune": False, "baby": True, "sheared": False,
        "variants": {}, "newborn": False,
        "xp": "query.last_hit_by_player ? Math.Random(2,4) : 0",
        "loot": "infected_pig",
        "vanilla_ref": "pig",
        "vanilla_speed": "pig 0.25 (panic x1.25 = 0.31)",
    },
    {
        "key": "infected_sheep", "id": "pas:infected_sheep", "species": "sheep",
        "name": "Infected Sheep",
        "health": 12, "attack": 3, "movement": 0.28, "chase": 1.15, "stroll": 0.8,
        "collision": (0.9, 1.3), "collision_src": "sheep.json",
        "nav": "walk", "amphibious": False, "breath": BREATH_LAND,
        "leap": False, "fall_immune": False, "baby": True, "sheared": True,
        "variants": {"color": 16}, "newborn": False,
        "xp": "query.last_hit_by_player ? Math.Random(2,4) : 0",
        "loot": "infected_sheep",
        "vanilla_ref": "sheep",
        "vanilla_speed": "sheep 0.25 (panic x1.25 = 0.31)",
    },
    {
        "key": "infected_chicken", "id": "pas:infected_chicken", "species": "chicken",
        "name": "Infected Chicken",
        "health": 6, "attack": 2, "movement": 0.28, "chase": 1.2, "stroll": 1.0,
        "collision": (0.6, 0.8), "collision_src": "chicken.json",
        "nav": "walk", "amphibious": False, "breath": BREATH_LAND,
        "leap": False, "fall_immune": True, "baby": True, "sheared": False,
        "variants": {}, "newborn": False,
        "xp": "query.last_hit_by_player ? Math.Random(1,3) : 0",
        "loot": "infected_chicken",
        "vanilla_ref": "chicken",
        "vanilla_speed": "chicken 0.25 (panic x1.5 = 0.375)",
        # vanilla chicken.json also declares this (flap game events for sculk)
        "extra": {"minecraft:game_event_movement_tracking": {"emit_flap": True}},
    },
    {
        "key": "infected_human", "id": "pas:infected_human", "species": "human",
        "name": "Infected Human",
        "health": 26, "attack": 5, "movement": 0.26, "chase": 1.1, "stroll": 1.0,
        "collision": (0.6, 1.9), "collision_src": "zombie.json",
        "nav": "walk", "amphibious": True, "breath": BREATH_ZOMBIE,
        "leap": False, "fall_immune": False, "baby": False, "sheared": False,
        "variants": {}, "newborn": False,
        "xp": "query.last_hit_by_player ? 6 : 0",
        "loot": "infected_human",
        "vanilla_ref": "zombie",
        "vanilla_speed": "zombie 0.23",
    },
]

for _e in ENTITIES:
    if _e["species"] is not None:
        _e["families"] = [FAM_HORDE, FAM_INFECTED, f"{FAM_INFECTED}_{_e['species']}", "monster", "mob"]
    _e["file"] = "pas_" + _e["key"] + ".json"


# ---------------------------------------------------------------------------
# Builders
# ---------------------------------------------------------------------------
def ev_add(*groups: str) -> dict:
    return {"add": {"component_groups": list(groups)}}


def ev_swap(remove: list[str], add: list[str]) -> dict:
    out: dict = {}
    if remove:
        out["remove"] = {"component_groups": list(remove)}
    if add:
        out["add"] = {"component_groups": list(add)}
    return out


def navigation(e: dict) -> tuple[str, dict]:
    nav = {
        "can_path_over_water": True,
        "avoid_damage_blocks": True,
        # Doors: a path may go through an OPEN door, but closed doors stay
        # closed: no opening (no annotation.open_door / behavior.open_door)
        # and no breaking (no annotation.break_door).
        "can_pass_doors": True,
        "can_open_doors": False,
        "can_break_doors": False,
    }
    if e["amphibious"]:
        nav["is_amphibious"] = True
    key = "minecraft:navigation.climb" if e["nav"] == "climb" else "minecraft:navigation.walk"
    return key, nav


def damage_sensor(e: dict) -> dict:
    triggers = [
        {   # no friendly fire: any damage whose source is a horde entity
            "on_damage": {
                "filters": {"test": "is_family", "subject": "other", "value": FAM_HORDE}
            },
            "deals_damage": False,
        }
    ]
    if e["fall_immune"]:
        triggers.append({"cause": "fall", "deals_damage": False})
    return {"triggers": triggers}


def hunting_group(e: dict) -> dict:
    g = {
        # Required: removing a group removes its components even when the
        # base "components" declare the same one (verified on BDS 1.21.0.26).
        # pas:become_active removes pas:dormant (movement 0), so pas:hunting
        # must bring the movement back.
        "minecraft:movement": {"value": e["movement"]},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.hurt_by_target": {
            "priority": 1,
            "entity_types": [{
                "filters": {"test": "is_family", "subject": "other", "operator": "!=", "value": FAM_HORDE},
                "max_dist": TARGET_RADIUS,
            }],
        },
        "minecraft:behavior.nearest_attackable_target": {
            "priority": 2,
            "must_see": False,
            "reselect_targets": True,
            "within_radius": TARGET_RADIUS,
            "entity_types": [{
                "filters": target_filter(),
                "max_dist": TARGET_RADIUS,
                "must_see": False,
                # drop a target as soon as it gets pas_incubating /
                # pas_infected_player (vanilla piglin.json uses this field)
                "reevaluate_description": True,
            }],
        },
        "minecraft:behavior.melee_box_attack": {
            "priority": 3,
            "speed_multiplier": e["chase"],
            "track_target": True,
        },
    }
    if e["leap"]:
        # same values as vanilla spider.json "minecraft:spider_angry"
        g["minecraft:behavior.leap_at_target"] = {
            "priority": 4,
            "yd": 0.4,
            "must_be_on_ground": False,
        }
    g["minecraft:behavior.random_stroll"] = {"priority": 6, "speed_multiplier": e["stroll"]}
    g["minecraft:behavior.look_at_player"] = {"priority": 7, "look_distance": 8.0, "probability": 0.02}
    g["minecraft:behavior.random_look_around"] = {"priority": 8}
    return g


def dormant_group(e: dict) -> dict:
    return {
        "minecraft:movement": {"value": 0.0},
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8.0, "probability": 0.02},
    }


def variant_groups(e: dict) -> tuple[dict, dict]:
    groups: dict = {}
    events: dict = {}
    for kind, count in e["variants"].items():
        comp, gprefix, eprefix = VARIANT_KINDS[kind]
        names = [f"{gprefix}{i}" for i in range(count)]
        for i in range(count):
            groups[names[i]] = {comp: {"value": i}}
        for i in range(count):
            events[f"{eprefix}{i}"] = ev_swap([n for n in names if n != names[i]], [names[i]])
    return groups, events


def build_entity(e: dict) -> dict:
    nav_key, nav = navigation(e)
    w, h = e["collision"]
    comps: dict = {
        "minecraft:is_hidden_when_invisible": {},
        "minecraft:type_family": {"family": list(e["families"])},
        "minecraft:nameable": {},
        "minecraft:persistent": {},
        "minecraft:collision_box": {"width": w, "height": h},
        "minecraft:health": {"value": e["health"], "max": e["health"]},
        "minecraft:attack": {"damage": e["attack"]},
        "minecraft:movement": {"value": e["movement"]},
        "minecraft:movement.basic": {},
        nav_key: nav,
        "minecraft:jump.static": {},
        "minecraft:can_climb": {},
        "minecraft:breathable": dict(e["breath"]),
        "minecraft:hurt_on_condition": {
            "damage_conditions": [{
                "filters": {"test": "in_lava", "subject": "self", "operator": "==", "value": True},
                "cause": "lava",
                "damage_per_tick": 4,
            }]
        },
        "minecraft:damage_sensor": damage_sensor(e),
        "minecraft:loot": {"table": f"loot_tables/pas/{e['loot']}.json"},
        "minecraft:experience_reward": {"on_death": e["xp"]},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:conditional_bandwidth_optimization": {},
    }
    if e["newborn"]:
        comps["minecraft:scale"] = {"value": 1.0}
    # explicit defaults so query.* is well defined before any set_* event
    for kind in e["variants"]:
        comps[VARIANT_KINDS[kind][0]] = {"value": 0}
    comps.update(e.get("extra", {}))

    groups: dict = {G_HUNTING: hunting_group(e), G_DORMANT: dormant_group(e)}
    events: dict = {
        E_SPAWNED: ev_add(G_HUNTING),
        E_BORN_VANILLA: ev_add(G_HUNTING),
        E_TRANSFORMED: ev_add(G_HUNTING),
        E_DORMANT: ev_swap([G_HUNTING], [G_DORMANT]),
        # idempotent: only (re)adds pas:hunting when it is not active, so a
        # periodic sync sweep does not restart the AI goals every time.
        E_ACTIVE: {
            "sequence": [{
                "filters": {
                    "test": "has_component", "subject": "self", "operator": "!=",
                    "value": "minecraft:behavior.nearest_attackable_target",
                },
                "remove": {"component_groups": [G_DORMANT]},
                "add": {"component_groups": [G_HUNTING]},
            }]
        },
    }
    if e["baby"]:
        groups[G_BABY] = {
            "minecraft:is_baby": {},
            # minecraft:scale also scales the collision box in Bedrock, so the
            # effective box is exactly half of the adult box (vanilla babies
            # do the same; see docs/ENTITIES.md).  No minecraft:ageable, so
            # the baby never grows up.
            "minecraft:scale": {"value": 0.5},
            "minecraft:loot": {"table": "loot_tables/pas/infected_baby.json"},
        }
        events[E_MAKE_BABY] = ev_add(G_BABY)
    vg, ve = variant_groups(e)
    groups.update(vg)
    events.update(ve)
    if e["sheared"]:
        groups[G_SHEARED] = {
            "minecraft:is_sheared": {},
            "minecraft:loot": {"table": "loot_tables/pas/infected_sheep_sheared.json"},
        }
        events[E_SET_SHEARED] = ev_add(G_SHEARED)
    if e["newborn"]:
        groups[G_NEWBORN] = {
            "minecraft:scale": {"value": 0.5},
            "minecraft:timer": {
                "looping": False, "time": 1.0,
                "time_down_event": {"event": E_NEWBORN_GROW, "target": "self"},
            },
        }
        groups[G_JUVENILE] = {
            "minecraft:scale": {"value": 0.75},
            "minecraft:timer": {
                "looping": False, "time": 1.0,
                "time_down_event": {"event": E_NEWBORN_DONE, "target": "self"},
            },
        }
        events[E_BORN] = ev_swap([G_JUVENILE], [G_NEWBORN])
        events[E_NEWBORN_GROW] = ev_swap([G_NEWBORN], [G_JUVENILE])
        events[E_NEWBORN_DONE] = ev_swap([G_NEWBORN, G_JUVENILE], [])

    return {
        "format_version": FORMAT_VERSION,
        "minecraft:entity": {
            "description": {
                "identifier": e["id"],
                "is_spawnable": False,
                "is_summonable": True,
            },
            "component_groups": groups,
            "components": comps,
            "events": events,
        },
    }


# ---------------------------------------------------------------------------
# Loot tables (item ids verified in metadata/vanilladata_modules/mojang-items.json;
# functions/conditions as used by the vanilla loot tables of this build)
# ---------------------------------------------------------------------------
def item(name: str, lo: int, hi: int, looting: bool = True) -> dict:
    fns: list = [{"function": "set_count", "count": {"min": lo, "max": hi}}]
    if looting:
        fns.append({"function": "looting_enchant", "count": {"min": 0, "max": 1}})
    return {"type": "item", "name": name, "weight": 1, "functions": fns}


def pool(entry: dict, conditions: list | None = None) -> dict:
    p: dict = {"rolls": 1, "entries": [entry]}
    if conditions:
        p["conditions"] = conditions
    return p


KILLED_BY_PLAYER = [{"condition": "killed_by_player"}]

LOOT = {
    "parasite": {"pools": [
        pool(item("minecraft:string", 0, 2)),
        pool(item("minecraft:spider_eye", 0, 1), KILLED_BY_PLAYER),
    ]},
    "infected_villager": {"pools": [
        pool(item("minecraft:rotten_flesh", 0, 2)),
        pool({"type": "item", "name": "minecraft:emerald", "weight": 1},
             [{"condition": "killed_by_player"},
              {"condition": "random_chance_with_looting", "chance": 0.05, "looting_multiplier": 0.02}]),
    ]},
    "infected_cow": {"pools": [
        pool(item("minecraft:rotten_flesh", 0, 2)),
        pool(item("minecraft:leather", 0, 1)),
    ]},
    "infected_pig": {"pools": [
        pool(item("minecraft:rotten_flesh", 0, 2)),
        pool(item("minecraft:bone", 0, 1)),
    ]},
    "infected_sheep": {"pools": [
        pool(item("minecraft:rotten_flesh", 0, 2)),
        pool({"type": "item", "name": "minecraft:wool", "weight": 1,
              "functions": [{"function": "minecraft:set_data_from_color_index"}]}),
    ]},
    "infected_sheep_sheared": {"pools": [
        pool(item("minecraft:rotten_flesh", 0, 2)),
        pool(item("minecraft:bone", 0, 1)),
    ]},
    "infected_chicken": {"pools": [
        pool(item("minecraft:feather", 0, 2)),
        pool(item("minecraft:rotten_flesh", 0, 1)),
    ]},
    "infected_human": {"pools": [
        pool(item("minecraft:rotten_flesh", 0, 2)),
        pool(item("minecraft:bone", 0, 2)),
    ]},
    "infected_baby": {"pools": [
        pool(item("minecraft:rotten_flesh", 0, 1, looting=False)),
    ]},
}


# ---------------------------------------------------------------------------
# Contract + docs
# ---------------------------------------------------------------------------
def build_contract(defs: dict) -> dict:
    out: dict = {"format_version": FORMAT_VERSION, "target_filter": target_filter(), "entities": {}}
    for e in ENTITIES:
        ent = defs[e["id"]]["minecraft:entity"]
        out["entities"][e["id"]] = {
            "file": f"addon/behavior_pack/entities/{e['file']}",
            "families": e["families"],
            "health": e["health"],
            "attack": e["attack"],
            "movement": e["movement"],
            "collision_box": {"width": e["collision"][0], "height": e["collision"][1]},
            "loot_table": f"loot_tables/pas/{e['loot']}.json",
            "component_groups": sorted(ent["component_groups"]),
            "events": sorted(ent["events"]),
            "variant_ranges": {
                VARIANT_KINDS[k][0]: [0, n - 1] for k, n in e["variants"].items()
            },
            "has_baby": e["baby"],
            "has_sheared": e["sheared"],
        }
    return out


def _range(prefix: str, n: int) -> str:
    return f"`{prefix}0` … `{prefix}{n - 1}`"


def build_doc() -> str:
    L: list[str] = []
    a = L.append
    a("# Horde entities (BP)")
    a("")
    a("Generated by `tools/entities/gen_entities.py` — do not edit by hand; change the generator and re-run it, then run `tools/entities/check_entities.py`.")
    a("")
    a(f"All seven files live in `addon/behavior_pack/entities/`, use `\"format_version\": \"{FORMAT_VERSION}\"` (the version every current vanilla entity of Bedrock 1.21.0.26 uses) and contain only components, fields and event nodes that appear in that build's `documentation/Entities.html`, `documentation/Entity Events.html` or its vanilla `behavior_pack/entities/*.json`. The checker re-verifies this field by field.")
    a("")
    a("## Stats")
    a("")
    a("| id | file | health | attack | movement | chase speed (movement × melee multiplier) | vanilla speed for comparison | collision w × h (source) | navigation | loot table |")
    a("|---|---|---|---|---|---|---|---|---|---|")
    for e in ENTITIES:
        w, h = e["collision"]
        chase = round(e["movement"] * e["chase"], 3)
        nav = "climb (walls, like spider)" if e["nav"] == "climb" else ("walk, amphibious" if e["amphibious"] else "walk")
        a(f"| `{e['id']}` | `{e['file']}` | {e['health']} | {e['attack']} | {e['movement']} | {chase} | {e['vanilla_speed']} | {w} × {h} ({e['collision_src']}) | {nav} | `loot_tables/pas/{e['loot']}.json` |")
    a("")
    a("Families (`minecraft:type_family`):")
    a("")
    for e in ENTITIES:
        a(f"* `{e['id']}`: " + ", ".join(f"`{f}`" for f in e["families"]))
    a("")
    a("No vanilla species family (`villager`, `cow`, `zombie`, `spider`, …) is used, so vanilla AI that selects by family (zombies hunting `villager`, wolves hunting `sheep`, our own SPEC targeting filter, …) never treats a horde entity as its source species. `monster` is kept on purpose: vanilla `iron_golem.json` targets `is_family monster` (except creepers), so golems defend against the horde.")
    a("")
    a("Common to all seven: `is_spawnable: false`, `is_summonable: true`, `minecraft:persistent` (and no `minecraft:despawn`), `minecraft:nameable`, `minecraft:physics`, `minecraft:pushable`, `minecraft:can_climb` (ladders), `minecraft:jump.static`, `minecraft:movement.basic`, lava damage like vanilla, `minecraft:experience_reward.on_death`, **no** `minecraft:burns_in_daylight`, **no** `minecraft:ageable`/`breedable`, no door opening or breaking.")
    a("")
    a("Special cases:")
    a("")
    a("* **Parasite** – wall climbing uses the same two components as vanilla `spider.json` and `cave_spider.json`: `minecraft:navigation.climb` (paths over vertical walls) and `minecraft:can_climb`. Neither vanilla file declares anything else for climbing. It pounces with `minecraft:behavior.leap_at_target` using the vanilla spider values (`yd` 0.4, `must_be_on_ground` false). It takes no fall damage, using the vanilla `breeze.json` pattern (`damage_sensor` trigger `cause: fall`, `deals_damage: false`).")
    a("* **Infected chicken** – no fall damage, like vanilla `chicken.json`. The vanilla chicken's slow, flapping fall is hard-coded in the engine for `minecraft:chicken`, **not** a component, so a custom entity cannot get it from JSON. The wing-flap look is a resource-pack animation concern. The vanilla `minecraft:game_event_movement_tracking {emit_flap: true}` is copied.")
    a("* **Infected human** – zombie-like: zombie collision box, `breathes_water` and `is_amphibious` like `zombie.json`, but no sun burning, no door breaking and no equipment pickup.")
    a("* **Doors** – every navigation component sets `can_pass_doors: true`, `can_open_doors: false`, `can_break_doors: false`, and no entity has `minecraft:annotation.open_door`, `minecraft:annotation.break_door`, `minecraft:behavior.open_door`, `minecraft:behavior.door_interact` or `minecraft:behavior.break_door`. Open doors can be walked through; closed doors keep the horde out.")
    a("")
    a("## Component groups")
    a("")
    a("| group | entities | contents |")
    a("|---|---|---|")
    a(f"| `{G_HUNTING}` | all | **all** AI: `behavior.float` (0), `behavior.hurt_by_target` (1, never a `{FAM_HORDE}` attacker), `behavior.nearest_attackable_target` (2, SPEC filter, see below), `behavior.melee_box_attack` (3), parasite only `behavior.leap_at_target` (4), `behavior.random_stroll` (6), `behavior.look_at_player` (7), `behavior.random_look_around` (8), plus `minecraft:movement` at the normal speed. The base `components` contain no `behavior.*` at all. |")
    a(f"| `{G_DORMANT}` | all | frozen: `minecraft:movement` 0 and only `behavior.look_at_player`. No targeting, no attacking, no strolling, no floating. |")
    a(f"| `{G_BABY}` | villager, cow, pig, sheep, chicken | `minecraft:is_baby`, `minecraft:scale` 0.5, smaller loot (`infected_baby.json`). No `minecraft:ageable`, so it stays a baby forever. |")
    a("| `pas:variant_<n>` | villager 0–14, cow 0–2 | `minecraft:variant {value: n}` |")
    a("| `pas:mark_<n>` | villager 0–6 | `minecraft:mark_variant {value: n}` |")
    a("| `pas:skin_<n>` | villager 0–5 | `minecraft:skin_id {value: n}` |")
    a("| `pas:color_<n>` | sheep 0–15 | `minecraft:color {value: n}` |")
    a(f"| `{G_SHEARED}` | sheep | `minecraft:is_sheared`, wool-less loot (`infected_sheep_sheared.json`) |")
    a(f"| `{G_NEWBORN}` → `{G_JUVENILE}` | parasite | birth flourish: scale 0.5 for 1 s, then 0.75 for 1 s, then back to the base scale 1.0 (each step is a non-looping `minecraft:timer`) |")
    a("")
    a("Base components also declare `minecraft:variant`/`mark_variant`/`skin_id`/`color` = 0 where that entity has the kind, so the defaults are explicit. With no event the entity is an adult, variant 0 (villager: unskilled, plains, skin 0; cow: plain cow; sheep: white, unsheared).")
    a("")
    a("## Events")
    a("")
    a("| event | entities | effect |")
    a("|---|---|---|")
    a(f"| `{E_SPAWNED}` | all | add `{G_HUNTING}` |")
    a(f"| `{E_BORN_VANILLA}` | all | add `{G_HUNTING}` (breeding is not used; kept for completeness) |")
    a(f"| `{E_TRANSFORMED}` | all | add `{G_HUNTING}` |")
    a(f"| `{E_DORMANT}` | all | remove `{G_HUNTING}`, add `{G_DORMANT}` (safe to repeat) |")
    a(f"| `{E_ACTIVE}` | all | only if `behavior.nearest_attackable_target` is absent (filter `has_component … !=`, as vanilla `parrot.json` does): remove `{G_DORMANT}`, add `{G_HUNTING}`. Safe to repeat; it does not restart the AI of an already active entity. |")
    a(f"| `{E_MAKE_BABY}` | villager, cow, pig, sheep, chicken | add `{G_BABY}` |")
    a(f"| {_range('pas:set_variant_', 15)} | villager | remove every other `pas:variant_*`, add `pas:variant_<n>` (vanilla villager_v2 profession order) |")
    a(f"| {_range('pas:set_mark_', 7)} | villager | remove every other `pas:mark_*`, add `pas:mark_<n>` (vanilla biome order) |")
    a(f"| {_range('pas:set_skin_', 6)} | villager | remove every other `pas:skin_*`, add `pas:skin_<n>` |")
    a(f"| {_range('pas:set_variant_', 3)} | cow | 0 cow, 1 red mooshroom, 2 brown mooshroom |")
    a(f"| {_range('pas:set_color_', 16)} | sheep | remove every other `pas:color_*`, add `pas:color_<n>` |")
    a(f"| `{E_SET_SHEARED}` | sheep | add `{G_SHEARED}` |")
    a(f"| `{E_BORN}` | parasite | add `{G_NEWBORN}` (birth flourish; purely visual) |")
    a(f"| `{E_NEWBORN_GROW}`, `{E_NEWBORN_DONE}` | parasite | internal timer events of the flourish; scripts never need them |")
    a("")
    a("A `set_*` event removes only the *other* groups of its kind and then adds its own, so it can be re-sent at any time. Re-adding a group that is already active just re-initialises it, as described in Entity Events.html.")
    a("")
    a("Mapping tables (script → RP):")
    a("")
    a("* villager `minecraft:variant` / `query.variant`: " + ", ".join(f"{i} {n}" for i, n in enumerate(VILLAGER_PROFESSIONS)))
    a("* villager `minecraft:mark_variant` / `query.mark_variant`: " + ", ".join(f"{i} {n}" for i, n in enumerate(VILLAGER_MARKS)))
    a("* villager `minecraft:skin_id` / `query.skin_id`: 0–5 (vanilla villager_v2 skin index)")
    a("* cow `minecraft:variant` / `query.variant`: " + ", ".join(f"{i} {n}" for i, n in enumerate(COW_VARIANTS)) + " (vanilla mooshroom uses 0 red / 1 brown, so the script adds 1)")
    a("* sheep `minecraft:color` / `query.color`: the vanilla palette index copied unchanged from the source sheep's `minecraft:color` (" + ", ".join(f"{i} {n}" for i, n in enumerate(SHEEP_COLORS)) + "). This is the Bedrock dye-colour id order, the same as PocketMine 5.16 `DyeColorIdMap` and the wool data value that `set_data_from_color_index` drops. The group *names* `sheep_gray` (8) and `sheep_light_gray` (7) in vanilla sheep.json are swapped relative to it, but only the numbers matter. `query.is_sheared` comes from `pas:sheared`. The vanilla RP tints sheep wool through engine/material logic and its render controller only switches geometry on `query.is_sheared`, so our RP must map `query.color` to a tint or texture itself.")
    a("* `query.is_baby` from `pas:baby` (villager, cow, pig, sheep, chicken)")
    a("")
    a("## Targeting filter and why")
    a("")
    a("`minecraft:behavior.nearest_attackable_target` in `pas:hunting`: `must_see` false, `reselect_targets` true, `within_radius` 24, one `entity_types` entry with `max_dist` 24, `must_see` false, `reevaluate_description` true and this filter (SPEC §3, verbatim):")
    a("")
    a("```json")
    a(json.dumps(target_filter(), indent=2))
    a("```")
    a("")
    a("* `any_of` families: only the species that can be infected (`CONVERSIONS` in ids.js) plus players. Every family name was checked in the vanilla 1.21.0.26 BP (`mooshroom.json` is `mushroomcow`, `wandering_trader.json` is `wandering_trader`, and both `villager.json` and `villager_v2.json` are `villager`).")
    a(f"* `is_family != {FAM_HORDE}`: horde entities never hunt each other.")
    a(f"* `has_tag != {TAG_INCUBATING}` / `!= {TAG_INFECTED_PLAYER}`: an already infected mob or player is left alone so the horde spreads to new hosts. `reevaluate_description: true` (also used by vanilla `piglin.json`) makes the attacker drop its current target as soon as the script tags it, instead of chasing it to death.")
    a("* `must_see: false`: they hunt by smell through walls, which is why the closed doors of the luxury base matter.")
    a("")
    a(f"`minecraft:behavior.hurt_by_target` retaliates against anything except `{FAM_HORDE}` (filter `is_family != {FAM_HORDE}`).")
    a("")
    a("Friendly fire: the base `minecraft:damage_sensor` has a `triggers` **array** whose first entry is")
    a("`{\"on_damage\": {\"filters\": {\"test\": \"is_family\", \"subject\": \"other\", \"value\": \"pas_horde\"}}, \"deals_damage\": false}`.")
    a("This matches the schema of this build: `triggers` is a list, `deals_damage` is a Boolean, and filters sit under `on_damage`, as in vanilla `allay.json`. The string enum form of `deals_damage` comes from later versions and is not used.")
    a("")
    a("## Notes for the script and RP workstreams")
    a("")
    a("* Spawn with the plain identifier (`dim.spawnEntity(\"pas:infected_cow\", loc)`). That fires `minecraft:entity_spawned`, which adds `pas:hunting`. Then send the `pas:set_*` / `pas:make_baby` / `pas:set_sheared` events, and `pas:become_dormant` if the outbreak is paused. If you use the `id<event>` spawn syntax, the given event **replaces** `entity_spawned`, so `pas:hunting` is not added: also send `pas:become_active` or `pas:become_dormant`. This was verified on BDS 1.21.0.26: `pas:infected_pig<pas:make_baby>` spawned as a baby that never attacked.")
    a("* `pas:become_active` and `pas:become_dormant` are idempotent, so the 5-second sync sweep may send them blindly. One caveat: event filters are evaluated when the event is *received* and group changes apply on the entity's next tick (Entity Events.html). If `pas:become_dormant` and then `pas:become_active` reach a hunting entity in the **same tick**, the second one still sees `pas:hunting` and does nothing, so the entity ends up dormant. Do not send both to the same entity in the same tick. Pause and resume driven by the UI or a command are always several ticks apart.")
    a("* The `pas_dormant` tag is managed by the scripts. These JSON files never touch tags. Scripts cannot see the state any other way: `entity.hasComponent(\"minecraft:behavior.nearest_attackable_target\")` always returns false in script API 1.11.0 (verified), and `minecraft:movement` is not exposed either. Use the tag.")
    a("* Origin data for cure (script API 1.11.0): `getComponent(\"minecraft:variant\").value`, `\"minecraft:mark_variant\"`, `\"minecraft:skin_id\"`, `\"minecraft:color\"`, plus `hasComponent(\"minecraft:is_sheared\")` and `hasComponent(\"minecraft:is_baby\")`. Old `minecraft:villager` (v1) uses a different variant numbering (0 farmer-type … 4 butcher-type). The script must map it to the v2 index before sending `pas:set_variant_<n>`.")
    a("* **Baby collision**: `minecraft:scale` scales the collision box in Bedrock, so `pas:baby` deliberately does **not** also set a halved `minecraft:collision_box`, which would make the box a quarter of the adult size. Evidence: vanilla `villager_v2.json`/`cow.json` baby groups only set `scale` 0.5, and the wiki-measured Bedrock baby boxes are exactly half the adult box (cow 0.45 × 0.65 vs 0.9 × 1.3). Vanilla `turtle.json`'s baby group sets `collision_box` 0.6 × 0.2 with `scale` 0.16, and the measured Bedrock baby turtle box is 0.096 × 0.032 = 0.6 × 0.16 by 0.2 × 0.16 (https://minecraft.wiki/w/Turtle, https://minecraft.wiki/w/Cow, https://minecraft.wiki/w/Villager). The effective baby box is therefore half the adult box on both axes. Measured on BDS 1.21.0.26 by ray-casting the hitbox: adult infected pig 0.9 × 0.9, baby 0.45 × 0.45; baby infected cow 0.45 wide × 0.65 high.")
    a("* Melee uses `minecraft:behavior.melee_box_attack`, which every vanilla 1.21.0-format attacker uses (zombie, spider, husk, …). Its bounding-box reach also works for the small chicken and parasite. `minecraft:behavior.melee_attack` only survives in the 1.16-format creeper.")
    a("* Group removal semantics (verified on BDS): removing a group removes its components outright and does **not** fall back to a value declared in the base `components`. After the birth flourish the parasite therefore has no `minecraft:scale` component at all (`getComponent` returns undefined), and the engine uses scale 1, so the measured hitbox is back to 0.8 × 0.6. The same rule is why `pas:hunting` re-declares `minecraft:movement`.")
    a("* Dormant creep: walking entities stop dead when they become dormant (measured displacement 0.00). A **parasite** caught mid-chase may finish a few blocks of its current climb path (measured 1.7–3.9 blocks) and then stays still. It never attacks while dormant. No `minecraft:navigation.*` override or `movement max 0` in `pas:dormant` was found that fixes this without breaking resume, so it is accepted.")
    a("* Peaceful difficulty does not remove the horde (verified: 7/7 survive while a vanilla zombie is removed).")
    a("")
    a("## Verification")
    a("")
    a("* `python3 tools/entities/check_entities.py` is a static check against SPEC and the 1.21.0.26 reference: every component name and field must be documented or used by vanilla, filters must be well formed, the event and group graph must be closed, families and stats are checked, and so are loot items, functions and conditions.")
    a("* `python3 tools/entities/engine_test/run_engine_test.py --bds <dir>` is an in-engine test on a Bedrock Dedicated Server 1.21.0.26 preview, which you download yourself from minecraft.net (doing so accepts the Minecraft EULA). It loads these entity files plus a throwaway script pack and fails on any `[Json]`/`[Actor]` content-log error for our pack. It checks families, health, every variant/mark/skin/colour/sheared/baby event (including re-setting), the birth flourish, hitbox sizes, friendly-fire cancellation, fall immunity, sun immunity, targeting (attacks vanilla mobs, ignores `pas_incubating`/`pas_infected_player`, never attacks horde), wall climbing versus a non-climbing control, closed doors keeping humanoids out versus an open-door control, dormant/active toggling including repeats, loot drops (including colour-indexed wool and the sheared table) and survival in peaceful. Last run against BDS `1.21.0-beta26` (build 24622416) on 2026-10-06: 90/90 checks passed with no content-log errors. As a control, a deliberately broken copy (a string `deals_damage`, an unknown component) did produce `[Json]`/`[Actor]` errors, so a clean log is meaningful.")
    a("")
    return "\n".join(L)


# ---------------------------------------------------------------------------
def dump(obj) -> str:
    return json.dumps(obj, indent=2, ensure_ascii=False) + "\n"


def outputs() -> dict[Path, str]:
    files: dict[Path, str] = {}
    defs = {}
    for e in ENTITIES:
        d = build_entity(e)
        defs[e["id"]] = d
        files[ENTITY_DIR / e["file"]] = dump(d)
    for name, table in LOOT.items():
        files[LOOT_DIR / f"{name}.json"] = dump(table)
    files[CONTRACT] = dump(build_contract(defs))
    files[DOC] = build_doc()
    return files


def main(argv: list[str]) -> int:
    check_only = "--check" in argv
    stale = []
    for path, text in outputs().items():
        old = path.read_text(encoding="utf-8") if path.exists() else None
        if old == text:
            continue
        if check_only:
            stale.append(path)
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        print(f"wrote {path.relative_to(REPO)}")
    if check_only:
        if stale:
            for p in stale:
                print(f"STALE {p.relative_to(REPO)}")
            return 1
        print("entity outputs up to date")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
