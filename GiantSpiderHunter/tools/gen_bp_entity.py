#!/usr/bin/env python3
"""Generate the behavior-pack side of the Giant Spider Hunter entity.

Writes (deterministically, sorted nothing / stable insertion order):
  packs/GiantSpiderHunter_BP/entities/giant_spider.json
  packs/GiantSpiderHunter_BP/loot_tables/entities/giant_spider.json
  packs/GiantSpiderHunter_BP/texts/en_US.lang
  packs/GiantSpiderHunter_BP/texts/languages.json

Implements docs/DESIGN.md sections 6 and 7 (see docs/ENTITY.md for the group/event table).
Every component and parameter name used here was checked against the vanilla 1.21.0.26
behavior pack (bedrock-samples tag v1.21.0.26-preview) and the BDS 1.21.0.26 binary strings.

Rules enforced by construction:
  * no component appears both in base "components" and in a component group;
  * every state transition removes all six state groups and adds exactly one, so the entity
    always carries exactly one state group and exactly one form group;
  * every state transition sets horror:state (and horror:giant when the form changes).

Usage:  python3 tools/gen_bp_entity.py [--check]
        --check  only compare the generated output with the files on disk (exit 1 if stale)
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "packs", "GiantSpiderHunter_BP")

ENTITY_ID = "horror:giant_spider"
LOOT_TABLE = "loot_tables/entities/giant_spider.json"

# --------------------------------------------------------------------------- tunables
# Base walking attribute. Measured on BDS 1.21.0.26 (tools/bds_test/scenarios/speed_calib.py):
# ground speed is NOT linear: v = movement * speed_multiplier gives about 43 * v^2 blocks/s
# (v 0.31 -> 4.0, 0.37 -> 6.0, 0.48 -> 9.8, 1.02 -> 44.9 blocks/s).
MOVEMENT = 0.3
# Health buffer (DESIGN §7): real HP = health - 500; at <= 500 the entity enters "dying"
# instead of dying through vanilla. The script sets current health = 500 + config.health.
HEALTH_MAX = 1000
HEALTH_DYING_THRESHOLD = 500
# Chase speed (state_hunting): melee_box_attack speed multiplier on top of MOVEMENT.
# 0.3 * 1.55 = 0.465 -> ~9.3 blocks/s: faster than a sprinting player (5.6) or sprint-jumping (~7).
HUNT_SPEED_MULTIPLIER = 1.55
STALK_STROLL_SPEED = 0.6
IDLE_STROLL_SPEED = 0.5
COOLDOWN_STROLL_SPEED = 1.0
COOLDOWN_FLEE_WALK = 1.1
COOLDOWN_FLEE_SPRINT = 1.3
TARGET_RADIUS = 72
FOLLOW_RANGE = 96
GROWTH_TIMEOUT_S = 25
DEATH_TIMEOUT_S = 8

STATES = ["idle", "stalking", "growing", "hunting", "cooldown", "dying"]
STATE_GROUPS = [f"horror:state_{s}" for s in STATES]
FORM_SMALL = "horror:form_small"
FORM_GIANT = "horror:form_giant"
DESPAWN_GROUP = "horror:despawn"


# --------------------------------------------------------------------------- helpers
def player_filter():
    return {"test": "is_family", "subject": "other", "value": "player"}


def immune_fall_suffocation():
    return {
        "minecraft:damage_sensor": {
            "triggers": [
                {"cause": "fall", "deals_damage": False},
                {"cause": "suffocation", "deals_damage": False},
            ]
        }
    }


def immune_all():
    return {"minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": False}]}}


def floats():
    return {"minecraft:behavior.float": {"priority": 0}}


def one_shot_timer(seconds, event):
    return {
        "minecraft:timer": {
            "looping": False,
            "time": seconds,
            "randomInterval": False,
            "time_down_event": {"event": event, "target": "self"},
        }
    }


# --------------------------------------------------------------------------- description
def properties():
    props = {
        "horror:state": {"type": "enum", "values": STATES, "default": "idle", "client_sync": True},
        "horror:giant": {"type": "bool", "default": False, "client_sync": True},
        "horror:small_scale": {"type": "float", "range": [0.02, 0.5], "default": 0.075, "client_sync": True},
        "horror:giant_scale": {"type": "float", "range": [0.25, 3.0], "default": 1.4, "client_sync": True},
        "horror:grow_time": {"type": "float", "range": [0.5, 20.0], "default": 4.0, "client_sync": True},
        "horror:attack_id": {"type": "int", "range": [0, 1000000], "default": 0, "client_sync": True},
        "horror:attack_kind": {"type": "int", "range": [0, 2], "default": 0, "client_sync": True},
    }
    for i in range(8):
        props[f"horror:foot_{i}"] = {"type": "float", "range": [-24.0, 24.0], "default": 0.0, "client_sync": True}
    props["horror:difficulty"] = {"type": "int", "range": [0, 3], "default": 2, "client_sync": False}
    return props


# --------------------------------------------------------------------------- base components
def environment_sensor():
    triggers = [
        # 1. Peaceful: monsters may not exist -> despawn (the script backs off its spawner).
        {"filters": {"test": "is_difficulty", "value": "peaceful"}, "event": "horror:peaceful_despawn"},
        # 2. Health buffer exhausted -> dying state instead of a vanilla death.
        {
            "filters": {
                "all_of": [
                    {"test": "actor_health", "subject": "self", "operator": "<=", "value": HEALTH_DYING_THRESHOLD},
                    {"test": "enum_property", "subject": "self", "domain": "horror:state", "operator": "!=", "value": "dying"},
                ]
            },
            "event": "horror:start_dying",
        },
    ]
    # 3. Mirror the world difficulty into an int property (Script API 1.10 has no getDifficulty).
    for level, name in ((1, "easy"), (2, "normal"), (3, "hard")):
        triggers.append({
            "filters": {
                "all_of": [
                    {"test": "is_difficulty", "value": name},
                    {"test": "int_property", "subject": "self", "domain": "horror:difficulty", "operator": "!=", "value": level},
                ]
            },
            "event": f"horror:set_difficulty_{level}",
        })
    return {"triggers": triggers}


def base_components():
    return {
        "minecraft:type_family": {"family": ["giant_spider", "monster", "arthropod", "mob"]},
        "minecraft:health": {"value": HEALTH_MAX, "max": HEALTH_MAX},
        "minecraft:movement": {"value": MOVEMENT},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:navigation.walk": {
            "can_path_over_water": True,
            "avoid_damage_blocks": True,
            "can_walk": True,
            "can_jump": True,
            "can_pass_doors": True,
        },
        # Step up a full block (+1 px) without jumping: hills and roots do not stall the chase.
        "minecraft:variable_max_auto_step": {"base_value": 1.0625, "jump_prevented_value": 0.5625},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:breathable": {
            "breathes_air": True,
            "breathes_water": True,
            "suffocate_time": 0,
            "total_supply": 15,
        },
        "minecraft:nameable": {},
        "minecraft:persistent": {},
        "minecraft:follow_range": {"value": FOLLOW_RANGE, "max": FOLLOW_RANGE},
        # Full-rate position updates while moving (the giant is visible from far away and its
        # procedural gait reads q.modified_distance_moved); vanilla throttling when standing.
        "minecraft:conditional_bandwidth_optimization": {
            "default_values": {
                "max_optimized_distance": 80.0,
                "max_dropped_ticks": 7,
                "use_motion_prediction_hints": True,
            },
            "conditional_values": [
                {
                    "max_optimized_distance": 0.0,
                    "max_dropped_ticks": 0,
                    "use_motion_prediction_hints": True,
                    "conditional_values": [
                        {"test": "is_moving", "subject": "self", "operator": "==", "value": True}
                    ],
                }
            ],
        },
        "minecraft:is_hidden_when_invisible": {},
        "minecraft:loot": {"table": LOOT_TABLE},
        # Only used if something bypasses the health buffer (e.g. /kill); the normal dying path
        # spawns xp orbs from the script.
        "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 40 : 0"},
        "minecraft:environment_sensor": environment_sensor(),
    }


# --------------------------------------------------------------------------- component groups
def component_groups():
    g = {}
    g[FORM_SMALL] = {
        "minecraft:collision_box": {"width": 0.9, "height": 0.7},
        "minecraft:custom_hit_test": {"hitboxes": [{"pivot": [0, 0.45, 0], "width": 1.2, "height": 0.9}]},
    }
    g[FORM_GIANT] = {
        # Physically player-sized so the path-finder fits between and under forest canopies
        # (a 2.9-tall box got stuck under leaves on BDS 1.21.0.26); the visual legs pass through trees.
        "minecraft:collision_box": {"width": 1.0, "height": 1.9},
        "minecraft:custom_hit_test": {
            "hitboxes": [
                {"pivot": [0, 1.5, 0], "width": 3.0, "height": 3.0},   # ground core (legs/feet area)
                {"pivot": [0, 18, 0], "width": 8.0, "height": 7.0},    # body high above the canopy (giant scale 1.4)
            ]
        },
    }
    # idle: nobody around -> wander slowly but often.
    g["horror:state_idle"] = {
        **floats(),
        "minecraft:behavior.random_stroll": {
            "priority": 6, "speed_multiplier": IDLE_STROLL_SPEED, "interval": 40, "xz_dist": 10, "y_dist": 7,
        },
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 16, "probability": 0.05},
        "minecraft:behavior.random_look_around": {"priority": 8},
        **immune_fall_suffocation(),
    }
    # stalking: small form, stares at the player for long stretches, creeps rarely
    # (the script relocates it to hidden spots and turns it toward the focus player).
    g["horror:state_stalking"] = {
        **floats(),
        "minecraft:behavior.look_at_player": {
            "priority": 5, "look_distance": 64, "probability": 0.8, "look_time": [8, 16],
        },
        "minecraft:behavior.random_stroll": {
            "priority": 6, "speed_multiplier": STALK_STROLL_SPEED, "interval": 200, "xz_dist": 6, "y_dist": 4,
        },
        "minecraft:behavior.random_look_around": {"priority": 8},
        **immune_fall_suffocation(),
    }
    # growing: invulnerable, stationary, only turns its head; timer is a fallback in case the
    # script is not running (it normally sends horror:to_hunting after growthDurationSeconds).
    g["horror:state_growing"] = {
        **immune_all(),
        "minecraft:behavior.look_at_player": {
            "priority": 5, "look_distance": 64, "probability": 1.0, "look_time": [4, 8],
        },
        **one_shot_timer(GROWTH_TIMEOUT_S, "horror:growth_timeout"),
    }
    # hunting: vanilla pursuit; the script is the single damage authority (attack damage 0).
    g["horror:state_hunting"] = {
        **floats(),
        "minecraft:behavior.hurt_by_target": {
            "priority": 1,
            "entity_types": [{"filters": player_filter()}],
        },
        "minecraft:behavior.nearest_attackable_target": {
            "priority": 2,
            "must_see": False,
            "must_reach": False,
            "reselect_targets": True,
            "within_radius": TARGET_RADIUS,
            "scan_interval": 10,
            "entity_types": [{"filters": player_filter(), "max_dist": TARGET_RADIUS}],
        },
        "minecraft:behavior.melee_box_attack": {
            "priority": 3,
            "track_target": True,
            "require_complete_path": False,
            "speed_multiplier": HUNT_SPEED_MULTIPLIER,
            "melee_fov": 360,
        },
        "minecraft:attack": {"damage": 0},
        **immune_fall_suffocation(),
    }
    # cooldown: shrunk back, harmless, walks away from players and keeps moving.
    g["horror:state_cooldown"] = {
        **floats(),
        "minecraft:behavior.avoid_mob_type": {
            "priority": 2,
            "entity_types": [
                {
                    "filters": player_filter(),
                    "max_dist": 32,
                    "walk_speed_multiplier": COOLDOWN_FLEE_WALK,
                    "sprint_speed_multiplier": COOLDOWN_FLEE_SPRINT,
                    "sprint_distance": 12,
                }
            ],
        },
        "minecraft:behavior.random_stroll": {
            "priority": 4, "speed_multiplier": COOLDOWN_STROLL_SPEED, "interval": 2, "xz_dist": 16, "y_dist": 7,
        },
        "minecraft:behavior.random_look_around": {"priority": 8},
        **immune_fall_suffocation(),
    }
    # dying: invulnerable, no behaviors; script plays the death and despawns it after ~3 s,
    # the timer is the fallback.
    g["horror:state_dying"] = {
        **immune_all(),
        **one_shot_timer(DEATH_TIMEOUT_S, "horror:death_timeout"),
    }
    g[DESPAWN_GROUP] = {"minecraft:instant_despawn": {}}
    return g


# --------------------------------------------------------------------------- events
def to_state(state, form):
    """Event body: remove every state group (+ the other form), add one state (+ form)."""
    remove = list(STATE_GROUPS)
    add = [f"horror:state_{state}"]
    props = {"horror:state": state}
    if form == "small":
        remove.append(FORM_GIANT)
        add.append(FORM_SMALL)
        props["horror:giant"] = False
    elif form == "giant":
        remove.append(FORM_SMALL)
        add.append(FORM_GIANT)
        props["horror:giant"] = True
    return {
        "remove": {"component_groups": remove},
        "add": {"component_groups": add},
        "set_property": props,
    }


def despawn():
    return {"add": {"component_groups": [DESPAWN_GROUP]}}


def events():
    e = {}
    e["minecraft:entity_spawned"] = to_state("stalking", "small")
    e["horror:to_idle"] = to_state("idle", "small")
    e["horror:to_stalking"] = to_state("stalking", "small")
    e["horror:to_growing"] = to_state("growing", "giant")
    e["horror:to_hunting"] = to_state("hunting", "giant")
    e["horror:to_cooldown"] = to_state("cooldown", "small")
    e["horror:to_dying"] = to_state("dying", None)
    e["horror:start_dying"] = to_state("dying", None)
    e["horror:growth_timeout"] = to_state("hunting", "giant")
    e["horror:death_timeout"] = despawn()
    e["horror:peaceful_despawn"] = despawn()
    e["horror:despawn"] = despawn()
    for level in (1, 2, 3):
        e[f"horror:set_difficulty_{level}"] = {"set_property": {"horror:difficulty": level}}
    e["horror:spawn_giant"] = to_state("hunting", "giant")
    return e


def entity():
    base = base_components()
    groups = component_groups()
    for name, comps in groups.items():
        clash = set(comps) & set(base)
        if clash:
            raise SystemExit(f"component(s) {sorted(clash)} in base AND group {name}")
    return {
        "format_version": "1.21.0",
        "minecraft:entity": {
            "description": {
                "identifier": ENTITY_ID,
                "spawn_category": "monster",
                "is_spawnable": True,
                "is_summonable": True,
                "properties": properties(),
            },
            "component_groups": groups,
            "components": base,
            "events": events(),
        },
    }


# --------------------------------------------------------------------------- loot
def count(lo, hi):
    return {"min": lo, "max": hi}


def loot_table():
    # No killed_by_player conditions: the normal death path spawns this table with
    # "/loot spawn ... loot entities/giant_spider" (no killer context).
    return {
        "pools": [
            {
                "rolls": 1,
                "entries": [
                    {
                        "type": "item",
                        "name": "minecraft:string",
                        "weight": 1,
                        "functions": [
                            {"function": "set_count", "count": count(6, 12)},
                            {"function": "looting_enchant", "count": count(0, 3)},
                        ],
                    }
                ],
            },
            {
                "rolls": 1,
                "entries": [
                    {
                        "type": "item",
                        "name": "minecraft:spider_eye",
                        "weight": 1,
                        "functions": [
                            {"function": "set_count", "count": count(2, 4)},
                            {"function": "looting_enchant", "count": count(0, 1)},
                        ],
                    }
                ],
            },
            {
                "rolls": 1,
                "entries": [
                    {
                        "type": "item",
                        "name": "minecraft:web",
                        "weight": 3,
                        "functions": [{"function": "set_count", "count": count(1, 3)}],
                    },
                    {"type": "empty", "weight": 2},
                ],
            },
        ]
    }


# --------------------------------------------------------------------------- texts
LANG = """## Giant Spider Hunter - behavior pack strings
pack.name=Giant Spider Hunter (Behavior)
pack.description=A spider stalks you from the trees. Once its eyes are on you, it grows into a giant and hunts you.
entity.horror:giant_spider.name=Giant Spider Hunter
item.spawn_egg.entity.horror:giant_spider.name=Giant Spider Hunter
"""


def outputs():
    def dump(obj):
        return json.dumps(obj, indent=2, ensure_ascii=False) + "\n"

    return {
        os.path.join(BP, "entities", "giant_spider.json"): dump(entity()),
        os.path.join(BP, "loot_tables", "entities", "giant_spider.json"): dump(loot_table()),
        os.path.join(BP, "texts", "en_US.lang"): LANG,
        os.path.join(BP, "texts", "languages.json"): dump(["en_US"]),
    }


def main():
    check = "--check" in sys.argv[1:]
    stale = []
    for path, text in outputs().items():
        if check:
            try:
                with open(path, encoding="utf-8") as fh:
                    if fh.read() != text:
                        stale.append(path)
            except FileNotFoundError:
                stale.append(path)
            continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        print(f"wrote {os.path.relpath(path, ROOT)}")
    if check:
        for p in stale:
            print(f"stale: {os.path.relpath(p, ROOT)}")
        sys.exit(1 if stale else 0)


if __name__ == "__main__":
    main()
