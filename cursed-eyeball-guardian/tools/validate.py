#!/usr/bin/env python3
"""Static cross-reference validator for the Cursed Eyeball Guardian add-on.

Run from the add-on root (cursed-eyeball-guardian/):

    python3 tools/validate.py                  # validate packs/ (the default)
    python3 tools/validate.py -v               # also print info lines
    python3 tools/validate.py --strict         # warnings count as errors
    python3 tools/validate.py --json report.json
    python3 tools/validate.py --bp DIR --rp DIR --no-spec   # any other add-on / fixture
    python3 tools/validate.py --ref DIR        # reference data (see below)
    python3 tools/validate.py --list-checks

Exit status: 0 = no errors, 1 = errors (or warnings with --strict), 2 = usage error.

Reference data (vanilla ids, script API metadata, item component schema) is the
Mojang bedrock-samples checkout for v1.21.0.26-preview plus the vanilla behaviour
pack.  It is looked up via --ref, then $CEG_REF, then a few default locations.
Without it every pack-internal cross-reference check still runs; checks against
vanilla ids / the script API surface are skipped and a warning says so.

Only the Python standard library and Pillow are used.  If `node` is on PATH the
scripts are also syntax-checked with `node --check` (skipped otherwise).
"""

from __future__ import annotations

import argparse
import fnmatch
import glob
import json
import math
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from collections import defaultdict

try:
    from PIL import Image
except Exception:  # pragma: no cover - reported as a warning at run time
    Image = None

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_BP = os.path.join(ROOT, "packs", "Cursed_Eyeball_Guardian_BP")
DEFAULT_RP = os.path.join(ROOT, "packs", "Cursed_Eyeball_Guardian_RP")
REF_CANDIDATES = [
    os.path.join(ROOT, "ref"),
    os.path.join(ROOT, ".ref"),
    "/tmp/claude-0/-home-user-my-first-website-/87ace694-908b-56db-9952-9c3a56cfbc62/scratchpad/ref",
]

ENGINE = (1, 21, 0)                      # Bedrock 1.21.0.26 preview
SCRIPT_MODULES = {"@minecraft/server": "1.10.0", "@minecraft/server-ui": "1.1.0"}
NEWER_API = [("@minecraft/server", "1.11.0"), ("@minecraft/server", "1.12.0-beta"),
             ("@minecraft/server-ui", "1.2.0-beta")]

# --------------------------------------------------------------------------
# Build contract (docs/SPEC.md).  Checked by the "spec" check (--no-spec skips).
# --------------------------------------------------------------------------
SKINS = ["crimson", "void", "frost", "toxic"]
SPEC = {
    "bp_uuid": "7908374d-1c7b-4aa2-af5f-76aa33c217ed",
    "bp_modules": {"data": "2b095ec2-2e53-4327-a4b9-571a94f1d331",
                   "script": "e836fbfe-b5f4-4ec2-86a9-d1edc1b0127e"},
    "rp_uuid": "60958aba-15ae-4c05-8ff4-398050736e62",
    "rp_modules": {"resources": "e4e61f1a-164c-427a-8cf1-1d6bde7d7c0d"},
    "version": [1, 0, 0],
    "min_engine_version": [1, 21, 0],
    "script_entry": "scripts/main.js",
    "entity": "ceg:eyeball_guardian",
    "items": {  # id: (file, icon key, max stack, glint, hand_equipped)
        "ceg:eyeball_summoner": ("items/eyeball_summoner.json", "ceg_eyeball_summoner", 1, True, False),
        "ceg:eyeball_upgrade": ("items/eyeball_upgrade.json", "ceg_eyeball_upgrade", 16, True, False),
        "ceg:eyeball_controller": ("items/eyeball_controller.json", "ceg_eyeball_controller", 1, False, True),
    },
    "properties": {
        "ceg:rage": ("bool", None, False),
        "ceg:skin": ("int", [0, 3], 0),
        "ceg:level": ("int", [1, 5], 1),
        "ceg:mode": ("int", [0, 4], 0),
    },
    "level_health": {1: 40, 2: 55, 3: 70, 4: 85, 5: 100},
    "events": ["minecraft:entity_spawned", "ceg:set_level_1", "ceg:set_level_2", "ceg:set_level_3",
               "ceg:set_level_4", "ceg:set_level_5", "ceg:despawn", "ceg:rage_on", "ceg:rage_off"],
    "families_required": ["ceg_guardian", "eyeball", "mob"],
    "families_forbidden": ["monster", "player"],
    "loot_table": "loot_tables/entities/eyeball_guardian.json",
    "loot_items": ["minecraft:redstone", "minecraft:spider_eye", "minecraft:ender_pearl"],
    "recipes": {
        "ceg:eyeball_summoner": (["RSR", "SES", "RGR"], {"R": "minecraft:redstone", "S": "minecraft:spider_eye",
                                                          "E": "minecraft:ender_pearl", "G": "minecraft:gold_ingot"}),
        "ceg:eyeball_upgrade": ([" D ", "RER", " D "], {"D": "minecraft:diamond", "R": "minecraft:redstone_block",
                                                         "E": "minecraft:ender_eye"}),
        "ceg:eyeball_controller": ([" RE", " SR", "S  "], {"R": "minecraft:redstone", "E": "minecraft:spider_eye",
                                                           "S": "minecraft:stick"}),
    },
    "geometry": "geometry.ceg.eyeball_guardian",
    "texture_wh": (64, 64),
    "entity_png_wh": (128, 128),
    "bones": ["root", "eye", "sclera", "iris", "pupil", "spikes", "spikes_extra"],
    "locators": ["center", "lens"],
    "entity_textures": (["textures/entity/ceg/eyeball_guardian_%s" % s for s in SKINS]
                        + ["textures/entity/ceg/eyeball_guardian_%s_glow" % s for s in SKINS]
                        + ["textures/entity/ceg/eyeball_guardian_%s_rage" % s for s in SKINS]),
    "animations": ["animation.ceg.eyeball_guardian.%s" % a for a in
                   ("float", "look", "spikes", "spin", "iris", "summon", "attack")],
    "animation_controller": "controller.animation.ceg.eyeball_guardian.fx",
    "render_controller": "controller.render.ceg.eyeball_guardian",
    "client_particles": {"aura": "ceg:aura", "rage_aura": "ceg:rage_aura"},
    "particles": ["ceg:%s" % p for p in ("aura", "rage_aura", "laser_segment", "laser_charge", "impact",
                                          "rage_burst", "shield_dome", "shield_hit", "heal", "teleport",
                                          "summon", "block_break", "level_up")],
    "particle_atlas": ("textures/particle/ceg_particles", (64, 64)),
    "sounds": {
        "ceg.guardian.ambient": ["ambient_1", "ambient_2", "ambient_3"],
        "ceg.guardian.hurt": ["hurt_1", "hurt_2"],
        "ceg.guardian.death": ["death"], "ceg.guardian.summon": ["summon"],
        "ceg.guardian.laser": ["laser_1", "laser_2"], "ceg.guardian.impact": ["impact"],
        "ceg.guardian.rage": ["rage"], "ceg.guardian.teleport": ["teleport"],
        "ceg.guardian.shield": ["shield"], "ceg.guardian.shield_hit": ["shield_hit"],
        "ceg.guardian.heal": ["heal"], "ceg.guardian.destroy": ["destroy"],
        "ceg.guardian.levelup": ["levelup"], "ceg.guardian.mode": ["mode"], "ceg.guardian.menu": ["menu"],
    },
    "entity_sound_events": {"ambient": "ceg.guardian.ambient", "hurt": "ceg.guardian.hurt",
                            "death": "ceg.guardian.death"},
    "item_textures": {"ceg_eyeball_summoner": "textures/items/ceg/eyeball_summoner",
                      "ceg_eyeball_upgrade": "textures/items/ceg/eyeball_upgrade",
                      "ceg_eyeball_controller": "textures/items/ceg/eyeball_controller"},
    "ui_icons": ["follow", "attack", "shield", "destroy", "passive", "teleport", "night_vision", "heal",
                 "look", "status", "fire", "dismiss", "summon"],
    "lang": {
        "entity.ceg:eyeball_guardian.name": "Cursed Floating Eyeball Guardian",
        "item.spawn_egg.entity.ceg:eyeball_guardian.name": "Spawn Cursed Eyeball Guardian",
        "item.ceg:eyeball_summoner.name": "Cursed Summoning Eye",
        "item.ceg:eyeball_upgrade.name": "Eyeball Upgrade Core",
        "item.ceg:eyeball_controller.name": "Eyeball Ability Controller",
    },
    "spawn_egg": ("#E8E2DC", "#B3000C"),
    # free-form ids the script contract defines (dynamic properties, /scriptevent ids)
    "script_ids": ["ceg:data", "ceg:owner", "ceg:token", "ceg:menu", "ceg:summon", "ceg:recall", "ceg:dismiss",
                   "ceg:mode", "ceg:level", "ceg:skin", "ceg:fire", "ceg:status"],
}

# --------------------------------------------------------------------------
# Built-in knowledge that is small enough to keep here (works without --ref)
# --------------------------------------------------------------------------
SOUND_CATEGORIES = {"ambient", "block", "bottle", "bucket", "hostile", "music", "neutral", "player",
                    "record", "ui", "weather"}
PARTICLE_MATERIALS = {"particles_alpha", "particles_blend", "particles_add", "particles_opaque"}
MOLANG_MATH = {"abs", "acos", "asin", "atan", "atan2", "ceil", "clamp", "cos", "die_roll", "die_roll_integer",
               "exp", "floor", "hermite_blend", "lerp", "lerprotate", "ln", "max", "min", "min_angle", "mod",
               "pi", "pow", "random", "random_integer", "round", "sin", "sqrt", "trunc"}
MOLANG_QUERIES_BASE = {
    "property", "has_property", "life_time", "delta_time", "anim_time", "target_x_rotation",
    "target_y_rotation", "is_alive", "health", "max_health", "time_stamp", "frame_alpha", "modified_distance_moved",
    "modified_move_speed", "ground_speed", "vertical_speed", "is_on_ground", "is_moving", "is_in_water",
    "is_sneaking", "is_sprinting", "is_baby", "is_angry", "variant", "mark_variant", "skin_id", "yaw_speed",
    "head_x_rotation", "head_y_rotation", "body_y_rotation", "body_x_rotation", "position", "position_delta",
    "distance_from_camera", "camera_rotation", "is_first_person", "time_of_day", "is_using_item",
    "is_invisible", "is_on_fire", "is_riding", "out_of_control", "is_delayed_attacking", "is_charging",
    "all_animations_finished", "any_animation_finished", "scale", "eye_target_x_rotation",
    "eye_target_y_rotation", "is_casting", "is_powered", "is_tamed", "is_sitting", "owner_identifier",
    "has_target", "has_owner", "is_selected_item", "main_hand_item_use_duration", "is_in_ui",
}
MOLANG_ENGINE_VARIABLES = {"attack_time", "is_first_person", "is_paperdoll", "is_enchanted", "short_arm_offset_left",
                           "short_arm_offset_right", "swim_amount", "gliding_speed_value", "attack_body_rot_y",
                           "tcos0", "tcos1", "is_brandishing_spear", "is_holding_left", "is_holding_right",
                           "is_using_vr", "player_x_rotation", "item_slot", "item_use_normalized",
                           "is_horizontal_splitscreen", "is_vertical_splitscreen"}
ENTITY_COMPONENTS_EXTRA = {  # valid 1.21.0 entity components that no vanilla entity happens to use
    "minecraft:instant_despawn", "minecraft:custom_hit_test", "minecraft:transient", "minecraft:is_stackable",
    "minecraft:hide", "minecraft:anger_level", "minecraft:heartbeat", "minecraft:suspect_tracking",
    "minecraft:vibration_listener", "minecraft:entity_sensor", "minecraft:timer", "minecraft:mob_effect",
    "minecraft:damage_over_time", "minecraft:inside_block_notifier", "minecraft:out_of_control",
    "minecraft:is_hidden_when_invisible", "minecraft:fire_immune", "minecraft:conditional_bandwidth_optimization",
    "minecraft:ambient_sound_interval", "minecraft:navigation.hover", "minecraft:movement.hover",
    "minecraft:hurt_on_condition", "minecraft:area_attack", "minecraft:cannot_be_attacked",
    "minecraft:ignore_cannot_be_attacked", "minecraft:knockback_resistance", "minecraft:balloonable",
    "minecraft:buoyant", "minecraft:spell_effects", "minecraft:fall_damage", "minecraft:body_rotation_blocked",
}
ITEM_COMPONENTS_1_20_80 = {
    "minecraft:allow_off_hand", "minecraft:block_placer", "minecraft:can_destroy_in_creative",
    "minecraft:cooldown", "minecraft:custom_components", "minecraft:damage", "minecraft:digger",
    "minecraft:display_name", "minecraft:durability", "minecraft:enchantable", "minecraft:entity_placer",
    "minecraft:food", "minecraft:fuel", "minecraft:glint", "minecraft:hand_equipped",
    "minecraft:hover_text_color", "minecraft:icon", "minecraft:interact_button", "minecraft:item_storage",
    "minecraft:liquid_clipped", "minecraft:max_stack_size", "minecraft:projectile", "minecraft:record",
    "minecraft:repairable", "minecraft:shooter", "minecraft:should_despawn", "minecraft:stacked_by_data",
    "minecraft:tags", "minecraft:throwable", "minecraft:use_animation", "minecraft:use_modifiers",
    "minecraft:wearable",
}
MENU_CATEGORIES = {"construction", "equipment", "items", "nature", "none", "commands"}
RECIPE_TYPES = {"minecraft:recipe_shaped", "minecraft:recipe_shapeless", "minecraft:recipe_furnace",
                "minecraft:recipe_brewing_mix", "minecraft:recipe_brewing_container",
                "minecraft:recipe_smithing_transform", "minecraft:recipe_smithing_trim",
                "minecraft:recipe_material_reduction"}
LOOT_FUNCTIONS = {"set_count", "set_data", "set_damage", "looting_enchant", "enchant_randomly",
                  "enchant_with_levels", "enchant_book_for_trading", "enchant_random_gear", "set_name",
                  "set_lore", "furnace_smelt", "exploration_map", "random_aux_value", "random_block_state",
                  "set_book_contents", "fill_container", "trader_material_type", "specific_enchants",
                  "set_actor_id", "set_banner_details", "random_dye", "set_potion", "set_ominous_bottle_amplifier",
                  "set_armor_trim", "set_stew_effect"}
LOOT_CONDITIONS = {"random_chance", "random_chance_with_looting", "random_difficulty_chance",
                   "random_regional_difficulty_chance", "killed_by_player", "killed_by_player_or_pets",
                   "killed_by_entity", "entity_properties", "has_mark_variant", "has_variant",
                   "match_tool", "random_chance_with_looting_and_difficulty"}
JUNK_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini", ".gitignore", ".gitkeep", ".gitattributes",
              "package.json", "package-lock.json", "tsconfig.json", "jsconfig.json"}
JUNK_DIRS = {"__pycache__", ".git", ".svn", ".idea", ".vscode", "node_modules", "tools", "tests", ".github"}
JUNK_EXT = {".py", ".pyc", ".pyo", ".ts", ".map", ".md", ".bak", ".tmp", ".swp", ".orig", ".rej", ".log",
            ".psd", ".xcf", ".kra", ".aseprite", ".ase", ".blend", ".bbmodel", ".zip", ".mcpack", ".mcaddon"}
PACK_EXT = {".json", ".png", ".tga", ".jpg", ".jpeg", ".ogg", ".wav", ".fsb", ".lang", ".js", ".material",
            ".mcfunction", ".mcstructure", ".txt", ".vertex", ".fragment"}

JS_BUILTIN_MEMBERS = set("""
length prototype constructor name toString toLocaleString valueOf hasOwnProperty isPrototypeOf
propertyIsEnumerable __proto__ toJSON call apply bind arguments caller
push pop shift unshift slice splice map filter reduce reduceRight forEach find findIndex findLast
findLastIndex includes indexOf lastIndexOf join concat sort reverse some every fill flat flatMap keys
values entries at copyWithin toSorted toReversed toSpliced with from of isArray
charAt charCodeAt codePointAt startsWith endsWith slice substring substr split trim trimStart trimEnd
trimLeft trimRight padStart padEnd toLowerCase toUpperCase toLocaleLowerCase toLocaleUpperCase replace
replaceAll match matchAll search repeat normalize localeCompare raw fromCharCode fromCodePoint
toFixed toPrecision toExponential isFinite isNaN isInteger isSafeInteger parseFloat parseInt
MAX_SAFE_INTEGER MIN_SAFE_INTEGER EPSILON MAX_VALUE MIN_VALUE POSITIVE_INFINITY NEGATIVE_INFINITY NaN
abs acos acosh asin asinh atan atan2 atanh cbrt ceil clz32 cos cosh exp expm1 floor fround hypot imul log
log10 log1p log2 max min pow random round sign sin sinh sqrt tan tanh trunc E LN10 LN2 LOG10E LOG2E PI
SQRT1_2 SQRT2 parse stringify
assign freeze isFrozen seal isSealed create defineProperty defineProperties getOwnPropertyNames
getOwnPropertyDescriptor getOwnPropertyDescriptors getOwnPropertySymbols getPrototypeOf setPrototypeOf
fromEntries is preventExtensions isExtensible groupBy
get set has delete clear size add
then catch finally resolve reject all allSettled race any
message stack cause errors
now getTime getFullYear getMonth getDate getDay getHours getMinutes getSeconds getMilliseconds
toISOString toDateString toTimeString getTimezoneOffset setTime UTC
iterator asyncIterator description for keyFor
test exec source flags lastIndex global ignoreCase multiline sticky unicode
log warn error info debug trace
next return throw done value
ownKeys default
""".split())


# ==========================================================================
# Small utilities
# ==========================================================================
class JsonProblem(Exception):
    pass


def load_json_strict(path):
    """Parse strictly: no comments, no trailing commas, no NaN, no duplicate keys.
    Returns (obj, [(level, msg)])."""
    with open(path, "rb") as f:
        raw = f.read()
    problems = []
    if raw.startswith(b"\xef\xbb\xbf"):
        problems.append(("error", "starts with a UTF-8 BOM (remove it; some Bedrock parsers reject it)"))
        raw = raw[3:]
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as e:
        raise JsonProblem("not valid UTF-8 (%s)" % e)
    dups = []

    def hook(pairs):
        d = {}
        for k, v in pairs:
            if k in d:
                dups.append(k)
            d[k] = v
        return d

    def bad_const(c):
        raise ValueError("non-standard JSON constant %s" % c)

    try:
        obj = json.loads(text, object_pairs_hook=hook, parse_constant=bad_const)
    except json.JSONDecodeError as e:
        hint = ""
        rest = text[e.pos:e.pos + 2]
        before = text[:e.pos].rstrip()
        if rest.startswith("//") or rest.startswith("/*"):
            hint = " (comments are not allowed in strict JSON)"
        elif before.endswith(",") and rest[:1] in ("}", "]"):
            hint = " (trailing comma)"
        raise JsonProblem("line %d col %d: %s%s" % (e.lineno, e.colno, e.msg, hint))
    except ValueError as e:
        raise JsonProblem(str(e))
    for k in dups:
        problems.append(("error", 'duplicate key "%s" (only the last value is used)' % k))
    return obj, problems


_COMMENT_RE = re.compile(r'"(?:\\.|[^"\\])*"|//[^\n]*|/\*.*?\*/', re.S)


def load_json_lenient(path):
    """Vanilla files sometimes contain comments / trailing commas."""
    try:
        with open(path, encoding="utf-8-sig") as f:
            text = f.read()
    except (OSError, UnicodeDecodeError):
        return None
    text = _COMMENT_RE.sub(lambda m: m.group(0) if m.group(0).startswith('"') else "", text)
    text = re.sub(r",(\s*[}\]])", r"\1", text)
    try:
        return json.loads(text)
    except ValueError:
        return None


def parse_version(v):
    if isinstance(v, (int, float)):
        return tuple(int(x) for x in str(v).split("."))
    if not isinstance(v, str):
        return None
    m = re.match(r"^(\d+)(?:\.(\d+))?(?:\.(\d+))?", v)
    if not m:
        return None
    return tuple(int(x or 0) for x in m.groups())


UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
NSID_RE = re.compile(r"^[a-z0-9_.-]+:[a-z0-9_./-]+$")


def edit_distance(a, b, cap=3):
    if abs(len(a) - len(b)) > cap:
        return cap + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i] + [0] * len(b)
        for j, cb in enumerate(b, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb))
        prev = cur
    return prev[-1]


def close_match(name, candidates, maxd=2, minlen=6):
    if len(name) < minlen:
        return None
    best = None
    for c in candidates:
        if c == name:
            return None
        d = edit_distance(name, c, maxd)
        if d <= maxd and (best is None or d < best[0]):
            best = (d, c)
    return best[1] if best else None


def walk_json(obj, path=()):
    """Yield (path_tuple, key, value) for every dict entry / list item."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield path, k, v
            yield from walk_json(v, path + (k,))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield path, i, v
            yield from walk_json(v, path + (i,))


def iter_strings(obj, path=()):
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from iter_strings(v, path + (k,))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from iter_strings(v, path + (i,))


def is_num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def fmt_path(path):
    return "/".join(str(p) for p in path)


def image_info(path):
    """(size, mode) of an image, or None if Pillow is missing / the file is unreadable."""
    if Image is None:
        return None
    try:
        with Image.open(path) as im:
            return im.size, im.mode
    except Exception:
        return None


# ==========================================================================
# Report
# ==========================================================================
class Report:
    def __init__(self):
        self.items = []
        self._seen = set()
        self.checks_run = []
        self.meta = {}

    def add(self, level, check, where, msg):
        key = (level, check, where, msg)
        if key not in self._seen:
            self._seen.add(key)
            self.items.append(key)

    def error(self, check, where, msg):
        self.add("error", check, where, msg)

    def warn(self, check, where, msg):
        self.add("warning", check, where, msg)

    def info(self, check, where, msg):
        self.add("info", check, where, msg)

    def count(self, level):
        return sum(1 for it in self.items if it[0] == level)

    def by_check(self):
        out = defaultdict(lambda: {"error": 0, "warning": 0, "info": 0})
        for lvl, chk, _, _ in self.items:
            out[chk][lvl] += 1
        return out

    def print(self, out=sys.stdout, verbose=False, color=False):
        def c(code, s):
            return "\033[%sm%s\033[0m" % (code, s) if color else s
        for k, v in self.meta.items():
            out.write("  %-10s %s\n" % (k + ":", v))
        for level, title, code in (("error", "ERRORS", "1;31"), ("warning", "WARNINGS", "33"),
                                   ("info", "INFO", "36")):
            if level == "info" and not verbose:
                continue
            rows = [it for it in self.items if it[0] == level]
            if not rows:
                continue
            out.write("\n%s (%d)\n" % (c(code, title), len(rows)))
            for _, chk, where, msg in rows:
                out.write("  [%s] %s%s\n" % (chk, (where + ": ") if where else "", msg))
        stats = self.by_check()
        out.write("\nChecks run (%d): " % len(self.checks_run))
        parts = []
        for chk in self.checks_run:
            s = stats.get(chk)
            if s and (s["error"] or s["warning"]):
                parts.append("%s(%dE/%dW)" % (chk, s["error"], s["warning"]))
            else:
                parts.append("%s ok" % chk)
        out.write(", ".join(parts) + "\n")

    def to_json(self):
        return {
            "meta": self.meta,
            "checks_run": self.checks_run,
            "errors": self.count("error"),
            "warnings": self.count("warning"),
            "items": [{"level": l, "check": c, "where": w, "message": m} for l, c, w, m in self.items],
        }


# ==========================================================================
# Reference data (vanilla ids, script API, schemas)
# ==========================================================================
class ApiModule:
    def __init__(self, data):
        self.name = data.get("name")
        self.version = data.get("version")
        self.classes = {}
        for c in (data.get("classes") or []):
            funcs = {f["name"] for f in (c.get("functions") or [])}
            props = {p["name"] for p in (c.get("properties") or [])}
            consts = {k["name"] for k in (c.get("constants") or [])}
            static = ({f["name"] for f in (c.get("functions") or []) if f.get("is_static")}
                      | {p["name"] for p in (c.get("properties") or []) if p.get("is_static")} | consts)
            self.classes[c["name"]] = {
                "members": (funcs | props | consts) - {"constructor"},
                "static": static,
                "ctor": "constructor" in funcs,
                "bases": [b["name"] for b in (c.get("base_types") or [])],
                "componentId": [k.get("value") for k in (c.get("constants") or []) if k["name"] == "componentId"],
            }
        self.enums = {e["name"]: {k["name"]: k.get("value") for k in (e.get("constants") or [])}
                      for e in (data.get("enums") or [])}
        self.interfaces = {i["name"]: {p["name"] for p in (i.get("properties") or [])}
                           for i in (data.get("interfaces") or [])}
        self.objects = {o["name"]: o["type"]["name"] for o in (data.get("objects") or [])}
        self.constants = {k["name"] for k in (data.get("constants") or [])}
        self.functions = {f["name"] for f in (data.get("functions") or [])}
        self.errors = {e["name"] for e in (data.get("errors") or [])}
        self.type_aliases = {t["name"] for t in (data.get("type_aliases") or [])}

    def exports(self):
        return (set(self.classes) | set(self.enums) | set(self.objects) | self.constants
                | self.functions | self.errors)

    def ts_only(self):
        return set(self.interfaces) | self.type_aliases

    def members_of(self, cls, _seen=None):
        _seen = _seen or set()
        if cls in _seen or cls not in self.classes:
            return set()
        _seen.add(cls)
        c = self.classes[cls]
        out = set(c["members"])
        for b in c["bases"]:
            out |= self.members_of(b, _seen)
        return out

    def all_member_names(self):
        out = set()
        for c in self.classes.values():
            out |= c["members"]
        for e in self.enums.values():
            out |= set(e)
        for i in self.interfaces.values():
            out |= i
        return out

    def component_ids(self):
        out = set()
        for c in self.classes.values():
            out |= {v for v in c["componentId"] if v}
        for name, consts in self.enums.items():
            if name.endswith("ComponentTypes"):
                out |= {v for v in consts.values() if isinstance(v, str)}
        return out


class Ref:
    def __init__(self, path):
        self.path = path
        self.ok = bool(path)
        self.items, self.blocks, self.entities, self.effects = set(), set(), set(), set()
        self.dimensions, self.enchantments, self.biomes, self.cooldowns = set(), set(), set(), set()
        self.commands = set()
        self.api = {}
        self.item_schema = None
        self.particles, self.sounds, self.animations, self.anim_controllers = set(), set(), set(), set()
        self.render_controllers, self.geometries, self.materials = set(), set(), set()
        self.particle_components, self.particle_materials = set(), set(PARTICLE_MATERIALS)
        self.queries, self.maths = set(MOLANG_QUERIES_BASE), set(MOLANG_MATH)
        self.client_entities = set()
        self.bp_components, self.bp_events, self.families = set(), set(), set()
        self.damage_causes = {"all", "none"}
        self.loot_tables = set()
        if path:
            self._load(path)

    def _vd(self, name):
        p = os.path.join(self.path, "samples", "metadata", "vanilladata_modules", name)
        d = load_json_lenient(p) or {}
        return [x.get("name") for x in d.get("data_items", []) if isinstance(x, dict)]

    def _load(self, path):
        s = os.path.join(path, "samples")
        self.items = set(self._vd("mojang-items.json"))
        self.blocks = set(self._vd("mojang-blocks.json"))
        self.entities = {"minecraft:" + n if ":" not in n else n for n in self._vd("mojang-entities.json")}
        self.effects = set(self._vd("mojang-effects.json"))
        self.dimensions = {"minecraft:" + n if ":" not in n else n for n in self._vd("mojang-dimensions.json")}
        self.enchantments = set(self._vd("mojang-enchantments.json"))
        self.biomes = set(self._vd("mojang-biomes.json"))
        self.cooldowns = set(self._vd("mojang-cooldown-category.json"))
        cmd = load_json_lenient(os.path.join(s, "metadata", "command_modules", "mojang-commands.json")) or {}
        for c in cmd.get("commands", []):
            self.commands.add(c["name"])
            for a in c.get("aliases", []) or []:
                self.commands.add(a["name"])
        sm = os.path.join(s, "metadata", "script_modules", "@minecraft")
        for f in glob.glob(os.path.join(sm, "*.json")):
            d = load_json_lenient(f)
            if d and "name" in d:
                self.api[(d["name"], d.get("version"))] = ApiModule(d)
        self.item_schema = load_json_lenient(os.path.join(s, "metadata", "json_schemas", "Components v1.20.80.json"))
        rp = os.path.join(s, "resource_pack")
        for f in glob.glob(os.path.join(rp, "particles", "*.json")):
            d = load_json_lenient(f)
            if not d:
                continue
            pe = d.get("particle_effect", {})
            ident = pe.get("description", {}).get("identifier")
            if ident:
                self.particles.add(ident)
            mat = pe.get("description", {}).get("basic_render_parameters", {}).get("material")
            if mat:
                self.particle_materials.add(mat)
            self.particle_components |= set(pe.get("components", {}))
            self._molang_names(d)
        sd = load_json_lenient(os.path.join(rp, "sounds", "sound_definitions.json")) or {}
        self.sounds = set(sd.get("sound_definitions", sd))
        for sub, attr, key in (("animations", "animations", "animations"),
                               ("animation_controllers", "anim_controllers", "animation_controllers"),
                               ("render_controllers", "render_controllers", "render_controllers")):
            for f in glob.glob(os.path.join(rp, sub, "*.json")):
                d = load_json_lenient(f)
                if d:
                    getattr(self, attr).update(d.get(key, {}).keys())
                    self._molang_names(d)
        for f in glob.glob(os.path.join(rp, "models", "**", "*.json"), recursive=True):
            d = load_json_lenient(f)
            if not d:
                continue
            for g in d.get("minecraft:geometry", []) or []:
                self.geometries.add(g.get("description", {}).get("identifier"))
            for k in d:
                if k.startswith("geometry."):
                    self.geometries.add(k.split(":")[0])
        for sub in ("entity", "attachables"):
            for f in glob.glob(os.path.join(rp, sub, "*.json")):
                d = load_json_lenient(f)
                if not d:
                    continue
                for top in ("minecraft:client_entity", "minecraft:attachable"):
                    desc = d.get(top, {}).get("description", {})
                    self.materials |= set(v for v in desc.get("materials", {}).values() if isinstance(v, str))
                    if top == "minecraft:client_entity" and desc.get("identifier"):
                        self.client_entities.add(desc["identifier"])
                self._molang_names(d)
        for bp in (os.path.join(path, "vanilla_bp"), os.path.join(path, "vanilla_bp_1.21.0"),
                   os.path.join(s, "behavior_pack")):
            for f in glob.glob(os.path.join(bp, "entities", "*.json")):
                d = load_json_lenient(f)
                if not d:
                    continue
                e = d.get("minecraft:entity", {})
                comps = [e.get("components", {})] + list(e.get("component_groups", {}).values())
                for c in comps:
                    if isinstance(c, dict):
                        self.bp_components |= set(c)
                        fam = c.get("minecraft:type_family", {}).get("family", [])
                        self.families |= set(fam)
                self.bp_events |= set(e.get("events", {}))
                for _, k, v in walk_json(e):
                    if k == "cause" and isinstance(v, str):
                        self.damage_causes.add(v)
            for f in glob.glob(os.path.join(bp, "loot_tables", "**", "*.json"), recursive=True):
                self.loot_tables.add(os.path.relpath(f, bp).replace(os.sep, "/"))
        srv = self.api.get(("@minecraft/server", "1.10.0"))
        if srv:
            for v in srv.enums.get("EntityDamageCause", {}).values():
                if isinstance(v, str):
                    self.damage_causes.add(re.sub(r"(?<!^)([A-Z])", r"_\1", v).lower())

    def _molang_names(self, d):
        for _, s in iter_strings(d):
            if "." not in s:
                continue
            for m in re.finditer(r"\b(?:query|q)\.([a-z_][a-z0-9_]*)", s, re.I):
                self.queries.add(m.group(1).lower())
            for m in re.finditer(r"\bmath\.([a-z_][a-z0-9_]*)", s, re.I):
                self.maths.add(m.group(1).lower())

    def module(self, name, version):
        return self.api.get((name, version))


def find_ref(explicit):
    cands = []
    if explicit:
        cands.append(explicit)
    if os.environ.get("CEG_REF"):
        cands.append(os.environ["CEG_REF"])
    cands += REF_CANDIDATES
    for c in cands:
        if c and os.path.isdir(os.path.join(c, "samples", "metadata")):
            return os.path.abspath(c)
    return None


# ==========================================================================
# Molang helpers
# ==========================================================================
MOLANG_PROP_RE = re.compile(r"\b(?:query|q)\.(property|has_property)\s*\(\s*'([^']*)'\s*\)", re.I)
MOLANG_QUOTE_RE = re.compile(r"'[^']*'")


def molang_scan(expr):
    """Return dict(props, queries, maths, reads, writes, error)."""
    res = {"props": [], "queries": set(), "maths": set(), "reads": set(), "writes": set(), "error": None}
    if not isinstance(expr, str):
        return res
    for m in MOLANG_PROP_RE.finditer(expr):
        res["props"].append((m.group(1).lower(), m.group(2)))
    # balance + quotes
    depth = {"(": 0, "[": 0, "{": 0}
    pairs = {")": "(", "]": "[", "}": "{"}
    inq = False
    for ch in expr:
        if ch == "'":
            inq = not inq
            continue
        if inq:
            continue
        if ch in depth:
            depth[ch] += 1
        elif ch in pairs:
            depth[pairs[ch]] -= 1
            if depth[pairs[ch]] < 0:
                res["error"] = "unbalanced '%s'" % ch
                break
    if not res["error"]:
        if inq:
            res["error"] = "unterminated string literal"
        elif any(depth.values()):
            res["error"] = "unbalanced brackets/parentheses"
    bare = MOLANG_QUOTE_RE.sub("''", expr)
    for m in re.finditer(r"(?<![\w.])(query|q|math|variable|v)\.([A-Za-z_][A-Za-z0-9_]*)", bare):
        kind, name = m.group(1).lower(), m.group(2)
        if kind in ("query", "q"):
            res["queries"].add(name.lower())
        elif kind == "math":
            res["maths"].add(name.lower())
        else:
            res["reads"].add(name.lower())
    for m in re.finditer(r"(?<![\w.])(?:variable|v)\.([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)", bare):
        res["writes"].add(m.group(1).lower())
    return res


class MolangUnknown(Exception):
    pass


class MolangEval:
    """Evaluate a *simple* Molang expression (numbers, arithmetic, comparisons,
    logic, ternary, query.property and a few math functions)."""
    TOK = re.compile(r"\s*(?:(\d+\.?\d*|\.\d+)|('[^']*')|([A-Za-z_][A-Za-z0-9_.]*)|"
                     r"(&&|\|\||==|!=|<=|>=|\?\?|[-+*/()?:<>!,]))")
    FUNCS = {"min": min, "max": max, "abs": abs, "floor": math.floor, "ceil": math.ceil,
             "round": lambda x: math.floor(x + 0.5), "trunc": math.trunc, "sqrt": math.sqrt,
             "pow": math.pow, "mod": math.fmod, "clamp": lambda x, a, b: max(a, min(b, x)),
             "lerp": lambda a, b, t: a + (b - a) * t,
             "sin": lambda d: math.sin(math.radians(d)), "cos": lambda d: math.cos(math.radians(d))}

    def __init__(self, text, props):
        self.props = props
        self.toks = []
        pos = 0
        text = text.strip().rstrip(";")
        while pos < len(text):
            m = self.TOK.match(text, pos)
            if not m or m.end() == pos:
                if text[pos:].strip() == "":
                    break
                raise MolangUnknown("cannot tokenize")
            pos = m.end()
            for kind, g in zip(("num", "str", "id", "op"), m.groups()):
                if g is not None:
                    self.toks.append((kind, g))
                    break
        self.i = 0

    def peek(self):
        return self.toks[self.i] if self.i < len(self.toks) else (None, None)

    def take(self, op=None):
        t = self.peek()
        if op is not None and t[1] != op:
            raise MolangUnknown("expected %s" % op)
        self.i += 1
        return t

    def run(self):
        v = self.ternary()
        if self.i != len(self.toks):
            raise MolangUnknown("trailing tokens")
        return v

    def ternary(self):
        c = self.orx()
        if self.peek()[1] == "?":
            self.take()
            a = self.ternary()
            if self.peek()[1] == ":":
                self.take()
                b = self.ternary()
                return a if c else b
            return a if c else 0.0
        return c

    def orx(self):
        v = self.andx()
        while self.peek()[1] == "||":
            self.take()
            r = self.andx()
            v = 1.0 if (v or r) else 0.0
        return v

    def andx(self):
        v = self.cmp()
        while self.peek()[1] == "&&":
            self.take()
            r = self.cmp()
            v = 1.0 if (v and r) else 0.0
        return v

    def cmp(self):
        v = self.add()
        while self.peek()[1] in ("<", ">", "<=", ">=", "==", "!="):
            op = self.take()[1]
            r = self.add()
            v = 1.0 if {"<": v < r, ">": v > r, "<=": v <= r, ">=": v >= r, "==": v == r, "!=": v != r}[op] else 0.0
        return v

    def add(self):
        v = self.mul()
        while self.peek()[1] in ("+", "-"):
            op = self.take()[1]
            r = self.mul()
            v = v + r if op == "+" else v - r
        return v

    def mul(self):
        v = self.unary()
        while self.peek()[1] in ("*", "/"):
            op = self.take()[1]
            r = self.unary()
            if op == "/":
                v = v / r if r else 0.0
            else:
                v = v * r
        return v

    def unary(self):
        t = self.peek()
        if t[1] == "-":
            self.take()
            return -self.unary()
        if t[1] == "!":
            self.take()
            return 0.0 if self.unary() else 1.0
        return self.primary()

    def primary(self):
        kind, val = self.take()
        if kind == "num":
            return float(val)
        if val == "(":
            v = self.ternary()
            self.take(")")
            return v
        if kind == "id":
            low = val.lower()
            if low in ("true", "false"):
                return 1.0 if low == "true" else 0.0
            if low in ("query.property", "q.property"):
                self.take("(")
                k, s = self.take()
                if k != "str":
                    raise MolangUnknown("property arg")
                self.take(")")
                name = s.strip("'")
                if name not in self.props:
                    raise MolangUnknown("unknown property")
                return float(self.props[name])
            if low.startswith("math."):
                fn = self.FUNCS.get(low[5:])
                if not fn:
                    raise MolangUnknown(low)
                self.take("(")
                args = []
                if self.peek()[1] != ")":
                    args.append(self.ternary())
                    while self.peek()[1] == ",":
                        self.take()
                        args.append(self.ternary())
                self.take(")")
                return float(fn(*args))
        raise MolangUnknown("unsupported token %r" % (val,))


def molang_range(expr, prop_defs, max_combos=4096):
    """Evaluate expr over every combination of the entity property values it
    uses.  Returns (min, max) or None when the expression is not simple."""
    if is_num(expr):
        return (float(expr), float(expr))
    if not isinstance(expr, str):
        return None
    names = sorted({p for _, p in MOLANG_PROP_RE.findall(expr)})
    domains = []
    for n in names:
        d = prop_defs.get(n)
        if not d:
            return None
        t = d.get("type")
        if t == "bool":
            domains.append([0, 1])
        elif t == "int" and isinstance(d.get("range"), list) and len(d["range"]) == 2:
            lo, hi = int(d["range"][0]), int(d["range"][1])
            if hi - lo > 256:
                return None
            domains.append(list(range(lo, hi + 1)))
        elif t == "float" and isinstance(d.get("range"), list) and len(d["range"]) == 2:
            domains.append([float(d["range"][0]), float(d["range"][1])])
        else:
            return None
    combos = [[]]
    for dom in domains:
        combos = [c + [v] for c in combos for v in dom]
        if len(combos) > max_combos:
            return None
    vals = []
    try:
        for c in combos:
            vals.append(MolangEval(expr, dict(zip(names, c))).run())
    except (MolangUnknown, ValueError, TypeError, ZeroDivisionError, OverflowError):
        return None
    return (min(vals), max(vals)) if vals else None


# ==========================================================================
# JavaScript lexer (enough to find string literals, calls and member access)
# ==========================================================================
class JsTok:
    __slots__ = ("kind", "value", "line", "parts", "inner")

    def __init__(self, kind, value, line):
        self.kind, self.value, self.line = kind, value, line
        self.parts = None
        self.inner = None

    def __repr__(self):
        return "%s:%r" % (self.kind, self.value)


class JsLexError(Exception):
    pass


JS_PUNCTS = sorted(""">>>= ... === !== **= <<= >>= >>> &&= ||= ??= => == != <= >= && || ?? ?. ++ -- += -= *= /= %=
&= |= ^= ** << >> { } ( ) [ ] ; , < > + - * / % & | ^ ! ~ ? : = . @ #""".split(), key=len, reverse=True)
REGEX_KW = {"return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do",
            "else", "yield", "await"}
_NUM_RE = re.compile(r"0[xX][0-9a-fA-F_]+n?|0[oO][0-7_]+n?|0[bB][01_]+n?|"
                     r"(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?n?")
_IDENT_RE = re.compile(r"[A-Za-z_$\u0080-\uffff][\w$\u0080-\uffff]*")
_ESC = {"n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f", "v": "\v", "0": "\0"}


def _js_unescape(s):
    def rep(m):
        e = m.group(1)
        if e[0] == "u":
            h = e[1:].strip("{}")
            try:
                return chr(int(h, 16))
            except ValueError:
                return ""
        if e[0] == "x":
            return chr(int(e[1:], 16))
        if e == "\n":
            return ""
        return _ESC.get(e, e)
    return re.sub(r"\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\n|.)", rep, s, flags=re.S)


class JsLexer:
    def __init__(self, src):
        self.s, self.n, self.i, self.line = src, len(src), 0, 1

    def run(self):
        return self._lex(False)

    @staticmethod
    def _regex_ok(toks):
        if not toks:
            return True
        t = toks[-1]
        if t.kind in ("num", "str", "tmpl", "regex"):
            return False
        if t.kind == "ident":
            return t.value in REGEX_KW
        return t.value not in (")", "]", "}", "++", "--")

    def _lex(self, in_tmpl):
        toks = []
        s = self.s
        depth = 0
        while self.i < self.n:
            c = s[self.i]
            if c == "\n":
                self.line += 1
                self.i += 1
                continue
            if c in " \t\r\f\v\u00a0\ufeff\u2028\u2029":
                self.i += 1
                continue
            if s.startswith("//", self.i):
                j = s.find("\n", self.i)
                self.i = self.n if j < 0 else j
                continue
            if s.startswith("/*", self.i):
                j = s.find("*/", self.i + 2)
                if j < 0:
                    raise JsLexError("line %d: unterminated /* comment" % self.line)
                self.line += s.count("\n", self.i, j)
                self.i = j + 2
                continue
            if c in "'\"":
                toks.append(self._string(c))
                continue
            if c == "`":
                toks.append(self._template())
                continue
            if c.isdigit() or (c == "." and self.i + 1 < self.n and s[self.i + 1].isdigit()):
                m = _NUM_RE.match(s, self.i)
                toks.append(JsTok("num", m.group(0), self.line))
                self.i = m.end()
                continue
            m = _IDENT_RE.match(s, self.i)
            if m:
                toks.append(JsTok("ident", m.group(0), self.line))
                self.i = m.end()
                continue
            if c == "/" and self._regex_ok(toks):
                toks.append(self._regex())
                continue
            if in_tmpl and c == "}" and depth == 0:
                self.i += 1
                return toks
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
            if s.startswith("?.", self.i) and self.i + 2 < self.n and s[self.i + 2].isdigit():
                toks.append(JsTok("punct", "?", self.line))
                self.i += 1
                continue
            for p in JS_PUNCTS:
                if s.startswith(p, self.i):
                    toks.append(JsTok("punct", p, self.line))
                    self.i += len(p)
                    break
            else:
                raise JsLexError("line %d: unexpected character %r" % (self.line, c))
        if in_tmpl:
            raise JsLexError("unterminated ${...} in template literal")
        return toks

    def _string(self, q):
        s, j, line = self.s, self.i + 1, self.line
        while j < self.n:
            ch = s[j]
            if ch == "\\":
                if j + 1 < self.n and s[j + 1] == "\n":
                    self.line += 1
                j += 2
                continue
            if ch == q:
                break
            if ch == "\n":
                raise JsLexError("line %d: unterminated string literal" % line)
            j += 1
        else:
            raise JsLexError("line %d: unterminated string literal" % line)
        tok = JsTok("str", _js_unescape(s[self.i + 1:j]), line)
        self.i = j + 1
        return tok

    def _template(self):
        s = self.s
        tok = JsTok("tmpl", "", self.line)
        tok.parts, tok.inner = [], []
        j = self.i + 1
        cur = []
        while True:
            if j >= self.n:
                raise JsLexError("line %d: unterminated template literal" % tok.line)
            ch = s[j]
            if ch == "\\":
                cur.append(s[j:j + 2])
                j += 2
                continue
            if ch == "`":
                j += 1
                break
            if ch == "$" and s.startswith("${", j):
                tok.parts.append(_js_unescape("".join(cur)))
                cur = []
                self.i = j + 2
                tok.inner.append(self._lex(True))
                j = self.i
                continue
            if ch == "\n":
                self.line += 1
            cur.append(ch)
            j += 1
        tok.parts.append(_js_unescape("".join(cur)))
        tok.value = "\x00".join(tok.parts)
        self.i = j
        return tok

    def _regex(self):
        s, j, in_class = self.s, self.i + 1, False
        while j < self.n:
            ch = s[j]
            if ch == "\\":
                j += 2
                continue
            if ch == "\n":
                raise JsLexError("line %d: unterminated regular expression" % self.line)
            if in_class:
                if ch == "]":
                    in_class = False
            elif ch == "[":
                in_class = True
            elif ch == "/":
                break
            j += 1
        j += 1
        while j < self.n and (s[j].isalnum() or s[j] == "_"):
            j += 1
        tok = JsTok("regex", s[self.i:j], self.line)
        self.i = j
        return tok


def token_lists(toks):
    """Yield the top-level token list and every template-expression list."""
    yield toks
    for t in toks:
        if t.kind == "tmpl":
            for inner in t.inner:
                yield from token_lists(inner)


def all_tokens(toks):
    for lst in token_lists(toks):
        yield from lst


def split_args(toks, k):
    """toks[k] is '(' -> list of argument token lists up to the matching ')'."""
    args, cur, depth = [], [], 0
    j = k + 1
    while j < len(toks):
        t = toks[j]
        if t.kind == "punct":
            if t.value in ("(", "[", "{"):
                depth += 1
            elif t.value in (")", "]", "}"):
                if depth == 0:
                    if cur:
                        args.append(cur)
                    return args
                depth -= 1
            elif t.value == "," and depth == 0:
                args.append(cur)
                cur = []
                j += 1
                continue
        cur.append(t)
        j += 1
    return args


def literal(arg):
    """Single literal token -> ('str'|'tmpl'|'num'|'bool', value, tok) or None."""
    if not arg:
        return None
    if len(arg) == 1:
        t = arg[0]
        if t.kind in ("str", "tmpl"):
            return (t.kind, t.value, t)
        if t.kind == "num":
            try:
                return ("num", float(t.value.replace("_", "").rstrip("n")), t)
            except ValueError:
                return None
        if t.kind == "ident" and t.value in ("true", "false"):
            return ("bool", t.value == "true", t)
    if len(arg) == 2 and arg[0].value == "-" and arg[1].kind == "num":
        try:
            return ("num", -float(arg[1].value), arg[1])
        except ValueError:
            return None
    return None


def template_regex(value):
    parts = value.split("\x00")
    return re.compile("^" + ".+".join(re.escape(p) for p in parts) + "$")


class Script:
    def __init__(self, label, rel, src):
        self.label, self.rel, self.src = label, rel, src
        self.error = None
        try:
            self.toks = JsLexer(src).run()
        except JsLexError as e:
            self.toks = []
            self.error = str(e)

    def method_calls(self, names):
        for lst in token_lists(self.toks):
            for k, t in enumerate(lst):
                if (t.kind == "ident" and t.value in names and k > 0 and lst[k - 1].value in (".", "?.")
                        and k + 1 < len(lst) and lst[k + 1].value == "("):
                    yield t.value, split_args(lst, k + 1), t.line

    def new_calls(self, names):
        for lst in token_lists(self.toks):
            for k, t in enumerate(lst):
                if (t.kind == "ident" and t.value == "new" and k + 2 < len(lst) and lst[k + 1].kind == "ident"
                        and lst[k + 1].value in names and lst[k + 2].value == "("):
                    yield lst[k + 1].value, split_args(lst, k + 2), t.line

    def strings(self):
        for t in all_tokens(self.toks):
            if t.kind in ("str", "tmpl"):
                yield t


# ==========================================================================
# Add-on model
# ==========================================================================
class Geometry:
    def __init__(self, ident, label, desc, bones):
        self.id, self.label = ident, label
        self.tw = desc.get("texture_width", desc.get("texturewidth", 64))
        self.th = desc.get("texture_height", desc.get("textureheight", 64))
        self.desc = desc
        self.bones = bones if isinstance(bones, list) else []
        self.bone_names = [b.get("name") for b in self.bones if isinstance(b, dict)]
        self.locators = {}
        for b in self.bones:
            if isinstance(b, dict) and isinstance(b.get("locators"), dict):
                for ln in b["locators"]:
                    self.locators[ln] = b.get("name")


class Addon:
    def __init__(self, bp, rp, ref, report, spec=True):
        self.bp, self.rp, self.ref, self.r, self.spec = bp, rp, ref, report, spec
        self.roots = {"BP": bp, "RP": rp}
        self.files = {"BP": [], "RP": []}
        self.fileset = {"BP": set(), "RP": set()}
        self.junk = []
        self.data = {}
        self.manifest = {}
        self.bp_entities, self.items, self.recipes, self.loot = {}, {}, {}, {}
        self.client_entities, self.attachables, self.geos = {}, {}, {}
        self.animations, self.acs, self.rcs, self.particles = {}, {}, {}, {}
        self.sound_defs, self.sounds_json, self.item_tex, self.terrain_tex = {}, None, {}, {}
        self.lang = {"BP": {}, "RP": {}}
        self.scripts = {}
        self.functions = {}
        self.tex_refs = defaultdict(set)    # texture path (no ext) -> referrers
        self.tex_prefix_refs = set()        # template prefixes used by scripts
        self.sound_refs = set()
        self.anim_used = defaultdict(set)   # animation id -> entity ids
        self.ac_used = defaultdict(set)
        self.rc_used = defaultdict(set)
        self.particle_used = set()
        self.loot_refs = set()
        self.script_vars = set()
        self.entity_effect_vars = set()

    # ---------------------------------------------------------------- utils
    @staticmethod
    def label(pack, rel):
        return "%s/%s" % (pack, rel)

    def exists(self, pack, rel):
        return rel in self.fileset[pack]

    def get(self, pack, rel):
        return self.data.get(self.label(pack, rel))

    def find_texture(self, path):
        """'textures/x' -> ('textures/x.png' | '.tga' | None)."""
        if not isinstance(path, str):
            return None
        p = path.strip().lstrip("/")
        if os.path.splitext(p)[1].lower() in (".png", ".tga", ".jpg", ".jpeg"):
            return p if self.exists("RP", p) else None
        for ext in (".png", ".tga", ".jpg", ".jpeg"):
            if self.exists("RP", p + ext):
                return p + ext
        return None

    def ref_texture(self, path, where, check="texture", level="error"):
        if not isinstance(path, str):
            self.r.error(check, where, "texture path is not a string: %r" % (path,))
            return None
        base = os.path.splitext(path)[0] if path.lower().endswith((".png", ".tga")) else path
        self.tex_refs[base].add(where)
        found = self.find_texture(path)
        if not found:
            self.r.add(level, check, where, "texture '%s' not found (looked for %s.png/.tga, case-sensitive)"
                       % (path, base))
        elif found.endswith(".tga") or found.endswith((".jpg", ".jpeg")):
            self.r.warn(check, where, "texture '%s' resolves to %s; .png is recommended" % (path, found))
        return found

    def bp_props(self, entity_id=None):
        out = {}
        for eid, (_, ent) in self.bp_entities.items():
            if entity_id and eid != entity_id:
                continue
            props = ent.get("description", {}).get("properties", {})
            if isinstance(props, dict):
                out.update(props)
        return out

    def bp_events(self):
        out = set()
        for _, ent in self.bp_entities.values():
            ev = ent.get("events", {})
            if isinstance(ev, dict):
                out |= set(ev)
        return out

    def known_entity(self, ident):
        if ident in self.bp_entities:
            return True
        full = ident if ":" in ident else "minecraft:" + ident
        if self.ref.ok:
            return full in self.ref.entities
        return None

    def known_item(self, ident):
        if not isinstance(ident, str):
            return False
        parts = ident.split(":")
        if len(parts) == 3 and parts[2].isdigit():
            ident = parts[0] + ":" + parts[1]
        if ":" not in ident:
            ident = "minecraft:" + ident
        if ident in self.items:
            return True
        if ident.endswith("_spawn_egg") and ident[:-len("_spawn_egg")] in self.bp_entities:
            return True
        if self.ref.ok:
            return ident in self.ref.items or ident in self.ref.blocks
        return None

    def known_particle(self, ident):
        if ident in self.particles:
            return True
        return (ident in self.ref.particles) if self.ref.ok else None

    def known_sound(self, ident):
        if ident in self.sound_defs:
            return True
        return (ident in self.ref.sounds) if self.ref.ok else None

    def known_animation(self, ident):
        if ident in self.animations or ident in self.acs:
            return True
        return (ident in self.ref.animations or ident in self.ref.anim_controllers) if self.ref.ok else None

    def geos_for_entity(self, ce):
        g = ce.get("description", {}).get("geometry", {})
        ids = list(g.values()) if isinstance(g, dict) else []
        return [self.geos[i] for i in ids if isinstance(i, str) and i in self.geos]

    def bones_for(self, geos):
        out = set()
        for g in geos:
            out |= set(n for n in g.bone_names if n)
        return out

    def locators_for(self, geos):
        out = set()
        for g in geos:
            out |= set(g.locators)
        return out

    # ---------------------------------------------------------------- index
    def scan_files(self):
        for pack, root in self.roots.items():
            if not os.path.isdir(root):
                continue
            for dp, dns, fns in os.walk(root):
                keep = []
                for d in sorted(dns):
                    if d in JUNK_DIRS or d.startswith("."):
                        self.junk.append(self.label(pack, os.path.relpath(os.path.join(dp, d), root)
                                                    .replace(os.sep, "/") + "/"))
                    else:
                        keep.append(d)
                dns[:] = keep
                for fn in sorted(fns):
                    rel = os.path.relpath(os.path.join(dp, fn), root).replace(os.sep, "/")
                    ext = os.path.splitext(fn)[1].lower()
                    if fn in JUNK_NAMES or fn.startswith(".") or ext in JUNK_EXT or fn.endswith("~"):
                        self.junk.append(self.label(pack, rel))
                        continue
                    self.files[pack].append(rel)
                    self.fileset[pack].add(rel)

    def index(self):
        r = self.r
        # JSON parse (strict) -------------------------------------------------
        for pack in ("BP", "RP"):
            for rel in self.files[pack]:
                if not rel.lower().endswith(".json"):
                    continue
                lab = self.label(pack, rel)
                try:
                    obj, probs = load_json_strict(os.path.join(self.roots[pack], rel))
                except JsonProblem as e:
                    r.error("json", lab, "invalid JSON: %s" % e)
                    self.data[lab] = None
                    continue
                except OSError as e:
                    r.error("json", lab, "cannot read: %s" % e)
                    self.data[lab] = None
                    continue
                for lvl, msg in probs:
                    r.add(lvl, "json", lab, msg)
                self.data[lab] = obj
        self.manifest = {p: self.get(p, "manifest.json") for p in ("BP", "RP")}

        def files_in(pack, prefix, ext=".json"):
            return [f for f in self.files[pack] if f.startswith(prefix) and f.lower().endswith(ext)]

        def top(pack, rel, key, kind):
            d = self.get(pack, rel)
            if d is None:
                return None
            if not isinstance(d, dict) or not isinstance(d.get(key), dict):
                r.error(kind, self.label(pack, rel), "missing top-level object '%s'" % key)
                return None
            return d[key]

        def ident_of(pack, rel, body, kind):
            ident = body.get("description", {}).get("identifier") if isinstance(body.get("description"), dict) else None
            if not isinstance(ident, str) or not ident:
                r.error(kind, self.label(pack, rel), "missing description.identifier")
                return None
            return ident

        for rel in files_in("BP", "entities/"):
            body = top("BP", rel, "minecraft:entity", "bp_entity")
            if body is not None:
                ident = ident_of("BP", rel, body, "bp_entity")
                if ident:
                    if ident in self.bp_entities:
                        r.error("bp_entity", self.label("BP", rel), "duplicate entity identifier %s (also in %s)"
                                % (ident, self.bp_entities[ident][0]))
                    self.bp_entities[ident] = (self.label("BP", rel), body)
        for rel in files_in("BP", "items/"):
            body = top("BP", rel, "minecraft:item", "item")
            if body is not None:
                ident = ident_of("BP", rel, body, "item")
                if ident:
                    if ident in self.items:
                        r.error("item", self.label("BP", rel), "duplicate item identifier %s" % ident)
                    self.items[ident] = (self.label("BP", rel), body)
        for rel in files_in("BP", "recipes/"):
            d = self.get("BP", rel)
            if d is not None:
                self.recipes[self.label("BP", rel)] = d
        for rel in files_in("BP", "loot_tables/"):
            d = self.get("BP", rel)
            if d is not None:
                self.loot[rel] = d
        for rel in files_in("RP", "entity/"):
            body = top("RP", rel, "minecraft:client_entity", "client_entity")
            if body is not None:
                ident = ident_of("RP", rel, body, "client_entity")
                if ident:
                    if ident in self.client_entities:
                        r.error("client_entity", self.label("RP", rel), "duplicate client entity %s" % ident)
                    self.client_entities[ident] = (self.label("RP", rel), body)
        for rel in files_in("RP", "attachables/"):
            body = top("RP", rel, "minecraft:attachable", "attachable")
            if body is not None:
                ident = ident_of("RP", rel, body, "attachable")
                if ident:
                    self.attachables[ident] = (self.label("RP", rel), body)
        for rel in files_in("RP", "models/"):
            self._index_geo(rel)
        for rel in files_in("RP", "animations/"):
            d = top("RP", rel, "animations", "animation")
            for k, v in (d or {}).items():
                if k in self.animations:
                    r.error("animation", self.label("RP", rel), "duplicate animation id %s (also in %s)"
                            % (k, self.animations[k][0]))
                self.animations[k] = (self.label("RP", rel), v)
        for rel in files_in("RP", "animation_controllers/"):
            d = top("RP", rel, "animation_controllers", "animation_controller")
            for k, v in (d or {}).items():
                if k in self.acs:
                    r.error("animation_controller", self.label("RP", rel), "duplicate controller id %s" % k)
                self.acs[k] = (self.label("RP", rel), v)
        for rel in files_in("RP", "render_controllers/"):
            d = top("RP", rel, "render_controllers", "render_controller")
            for k, v in (d or {}).items():
                if k in self.rcs:
                    r.error("render_controller", self.label("RP", rel), "duplicate render controller id %s" % k)
                self.rcs[k] = (self.label("RP", rel), v)
        for rel in files_in("RP", "particles/"):
            body = top("RP", rel, "particle_effect", "particle")
            if body is not None:
                ident = ident_of("RP", rel, body, "particle")
                if ident:
                    if ident in self.particles:
                        r.error("particle", self.label("RP", rel), "duplicate particle identifier %s (also in %s)"
                                % (ident, self.particles[ident][0]))
                    self.particles[ident] = (self.label("RP", rel), body)
        sd = self.get("RP", "sounds/sound_definitions.json")
        if isinstance(sd, dict):
            defs = sd.get("sound_definitions") if "sound_definitions" in sd else sd
            if isinstance(defs, dict):
                self.sound_defs = {k: v for k, v in defs.items() if k != "format_version"}
        self.sounds_json = self.get("RP", "sounds.json")
        it = self.get("RP", "textures/item_texture.json")
        if isinstance(it, dict) and isinstance(it.get("texture_data"), dict):
            self.item_tex = it["texture_data"]
        tt = self.get("RP", "textures/terrain_texture.json")
        if isinstance(tt, dict) and isinstance(tt.get("texture_data"), dict):
            self.terrain_tex = tt["texture_data"]
        for pack in ("BP", "RP"):
            for rel in files_in(pack, "texts/", ".lang"):
                self.lang[pack][os.path.basename(rel)[:-5]] = self._parse_lang(pack, rel)
        for rel in files_in("BP", "scripts/", ".js"):
            try:
                with open(os.path.join(self.bp, rel), encoding="utf-8") as f:
                    src = f.read()
            except (OSError, UnicodeDecodeError) as e:
                r.error("script", self.label("BP", rel), "cannot read as UTF-8: %s" % e)
                continue
            self.scripts[rel] = Script(self.label("BP", rel), rel, src)
        for rel in files_in("BP", "functions/", ".mcfunction"):
            try:
                with open(os.path.join(self.bp, rel), encoding="utf-8") as f:
                    self.functions[rel] = f.read()
            except (OSError, UnicodeDecodeError) as e:
                r.error("function", self.label("BP", rel), "cannot read: %s" % e)
        # usage maps
        for eid, (lab, ce) in self.client_entities.items():
            desc = ce.get("description", {})
            for v in (desc.get("animations") or {}).values():
                if isinstance(v, str):
                    (self.ac_used if v.startswith("controller.") else self.anim_used)[v].add(eid)
            for rc in desc.get("render_controllers") or []:
                rid = rc if isinstance(rc, str) else (next(iter(rc)) if isinstance(rc, dict) and rc else None)
                if rid:
                    self.rc_used[rid].add(eid)
            for v in (desc.get("particle_effects") or {}).values():
                if isinstance(v, str):
                    self.particle_used.add(v)

    def _index_geo(self, rel):
        d = self.get("RP", rel)
        if not isinstance(d, dict):
            return
        lab = self.label("RP", rel)
        found = False
        if isinstance(d.get("minecraft:geometry"), list):
            for g in d["minecraft:geometry"]:
                desc = g.get("description", {}) if isinstance(g, dict) else {}
                ident = desc.get("identifier")
                if not ident:
                    self.r.error("geometry", lab, "geometry without description.identifier")
                    continue
                found = True
                self._add_geo(Geometry(ident, lab, desc, g.get("bones", [])))
        for k, v in d.items():
            if k.startswith("geometry.") and isinstance(v, dict):
                found = True
                self._add_geo(Geometry(k.split(":")[0], lab, v, v.get("bones", [])))
        if not found:
            self.r.error("geometry", lab, "no geometry definitions found")

    def _add_geo(self, g):
        if g.id in self.geos:
            self.r.error("geometry", g.label, "duplicate geometry id %s (also in %s)" % (g.id, self.geos[g.id].label))
        self.geos[g.id] = g

    def _parse_lang(self, pack, rel):
        lab = self.label(pack, rel)
        out = {}
        try:
            with open(os.path.join(self.roots[pack], rel), "rb") as f:
                raw = f.read()
        except OSError as e:
            self.r.error("lang", lab, "cannot read: %s" % e)
            return out
        if raw.startswith(b"\xef\xbb\xbf"):
            self.r.warn("lang", lab, "UTF-8 BOM at start of file (the first key may not resolve)")
            raw = raw[3:]
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as e:
            self.r.error("lang", lab, "not valid UTF-8: %s" % e)
            return out
        for n, line in enumerate(text.splitlines(), 1):
            s = line.strip()
            if not s or s.startswith("##"):
                continue
            if "=" not in line:
                self.r.warn("lang", lab, "line %d is not key=value: %r" % (n, line[:60]))
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.split("\t#")[0].rstrip("\r")
            if k in out:
                self.r.warn("lang", lab, "duplicate key %s (line %d)" % (k, n))
            if not v.strip():
                self.r.warn("lang", lab, "empty value for %s (line %d)" % (k, n))
            out[k] = v
        return out


# ==========================================================================
# Checks
# ==========================================================================
CHECKS = []


def check(name, desc):
    def deco(fn):
        CHECKS.append((name, desc, fn))
        return fn
    return deco


@check("files", "pack folders exist, no junk / empty / oddly named files, path length, file types")
def check_files(a):
    r = a.r
    for pack, root in a.roots.items():
        if not os.path.isdir(root):
            r.error("files", pack, "pack folder not found: %s" % root)
            continue
        if not a.exists(pack, "manifest.json"):
            r.error("files", pack, "manifest.json missing at pack root")
        for rel in a.files[pack]:
            lab = a.label(pack, rel)
            full = os.path.join(root, rel)
            ext = os.path.splitext(rel)[1].lower()
            try:
                size = os.path.getsize(full)
            except OSError:
                size = -1
            if size == 0:
                r.error("files", lab, "file is empty")
            if any(ord(ch) > 127 for ch in rel) or " " in rel:
                r.warn("files", lab, "path contains spaces or non-ASCII characters (fragile on Android)")
            if len(rel) > 80:
                r.warn("files", lab, "relative path is %d chars (> 80 can fail on some platforms)" % len(rel))
            if ext not in PACK_EXT:
                r.warn("files", lab, "unexpected file type '%s' in a pack" % ext)
            if ext == ".js" and not rel.startswith("scripts/") and pack == "BP":
                r.warn("files", lab, ".js file outside scripts/ is never loaded")
    for j in a.junk:
        r.warn("files", j, "junk/dev file inside a pack folder (build.py leaves it out of the .mcaddon)")


@check("json", "every .json parses strictly (no comments, trailing commas, NaN, BOM, duplicate keys); "
               "format_version not newer than the 1.21.0 engine")
def check_json(a):
    for lab, obj in a.data.items():
        if not isinstance(obj, dict):
            if obj is not None and not lab.endswith("languages.json"):
                a.r.error("json", lab, "top level must be a JSON object")
            continue
        fv = obj.get("format_version")
        if fv is None:
            if not lab.endswith(("manifest.json", "sounds.json", "item_texture.json", "terrain_texture.json",
                                 "languages.json", "flipbook_textures.json", "blocks.json",
                                 "_ui_defs.json", "_global_variables.json")) and "/loot_tables/" not in lab \
                    and "/texts/" not in lab and "/ui/" not in lab:
                a.r.warn("json", lab, "no format_version")
            continue
        if lab.endswith("manifest.json"):
            continue
        v = parse_version(fv)
        if v is None:
            a.r.error("json", lab, "unparseable format_version %r" % (fv,))
        elif v > ENGINE:
            a.r.error("json", lab, "format_version %s is newer than the target engine %s (file will be rejected)"
                      % (fv, ".".join(map(str, ENGINE))))


@check("manifest", "manifest structure, uuids (valid, unique, == SPEC), versions, BP<->RP dependencies, "
                   "script module + entry, @minecraft/server 1.10.0 + server-ui 1.1.0, pack icon")
def check_manifest(a):
    r = a.r
    uuids = {}
    mans = {}
    for pack in ("BP", "RP"):
        m = a.manifest.get(pack)
        lab = a.label(pack, "manifest.json")
        if not isinstance(m, dict):
            if a.exists(pack, "manifest.json") and a.get(pack, "manifest.json") is not None:
                r.error("manifest", lab, "manifest is not a JSON object")
            continue
        mans[pack] = m
        if m.get("format_version") != 2:
            r.error("manifest", lab, "format_version must be 2 (got %r)" % (m.get("format_version"),))
        h = m.get("header")
        if not isinstance(h, dict):
            r.error("manifest", lab, "missing header")
            continue
        for k in ("name", "description", "uuid", "version"):
            if k not in h:
                r.error("manifest", lab, "header.%s missing" % k)
        if not isinstance(h.get("uuid"), str) or not UUID_RE.match(h.get("uuid", "")):
            r.error("manifest", lab, "header.uuid is not a lowercase RFC-4122 uuid: %r" % (h.get("uuid"),))
        else:
            uuids.setdefault(h["uuid"], []).append(lab + " header")
        v = h.get("version")
        if not (isinstance(v, list) and len(v) == 3 and all(isinstance(x, int) and x >= 0 for x in v)):
            r.error("manifest", lab, "header.version must be [major, minor, patch] (got %r)" % (v,))
        mev = h.get("min_engine_version")
        if not (isinstance(mev, list) and len(mev) == 3 and all(isinstance(x, int) for x in mev)):
            r.error("manifest", lab, "header.min_engine_version must be a 3-int list (got %r)" % (mev,))
        elif tuple(mev) > ENGINE:
            r.error("manifest", lab, "min_engine_version %s is newer than the target engine %s" % (mev, list(ENGINE)))
        elif tuple(mev) < (1, 20, 0):
            r.warn("manifest", lab, "min_engine_version %s is old; entity/item formats may be interpreted "
                                    "with legacy behaviour" % (mev,))
        for k in ("name", "description"):
            val = h.get(k)
            if isinstance(val, str) and re.match(r"^[\w.]+$", val) and "." in val and " " not in val:
                if val not in a.lang[pack].get("en_US", {}):
                    r.error("manifest", lab, "header.%s uses lang key '%s' but %s/texts/en_US.lang lacks it"
                            % (k, val, pack))
        mods = m.get("modules")
        if not isinstance(mods, list) or not mods:
            r.error("manifest", lab, "modules must be a non-empty list")
            mods = []
        types = []
        for i, mod in enumerate(mods):
            if not isinstance(mod, dict):
                r.error("manifest", lab, "modules[%d] is not an object" % i)
                continue
            t = mod.get("type")
            types.append(t)
            u = mod.get("uuid")
            if not isinstance(u, str) or not UUID_RE.match(u):
                r.error("manifest", lab, "modules[%d].uuid invalid: %r" % (i, u))
            else:
                uuids.setdefault(u, []).append("%s module %s" % (lab, t))
            mv = mod.get("version")
            if not (isinstance(mv, list) and len(mv) == 3) and not (t == "script" and isinstance(mv, str)):
                r.error("manifest", lab, "modules[%d].version must be [x, y, z] (got %r)" % (i, mv))
            if t == "script":
                if mod.get("language") != "javascript":
                    r.error("manifest", lab, "script module language must be 'javascript'")
                entry = mod.get("entry")
                if not isinstance(entry, str) or not entry:
                    r.error("manifest", lab, "script module has no entry")
                elif not a.exists("BP", entry.lstrip("/")):
                    r.error("manifest", lab, "script entry '%s' does not exist in the BP" % entry)
                elif not entry.startswith("scripts/"):
                    r.error("manifest", lab, "script entry must live under scripts/ (got %s)" % entry)
        if pack == "BP":
            if "data" not in types:
                r.error("manifest", lab, "BP needs a 'data' module")
            if a.scripts and "script" not in types:
                r.error("manifest", lab, "scripts/ present but no 'script' module declared")
            for t in types:
                if t not in ("data", "script"):
                    r.warn("manifest", lab, "unexpected BP module type %r" % (t,))
        else:
            if "resources" not in types:
                r.error("manifest", lab, "RP needs a 'resources' module")
            for t in types:
                if t != "resources":
                    r.warn("manifest", lab, "unexpected RP module type %r" % (t,))
        if "capabilities" in m:
            caps = m["capabilities"]
            if not isinstance(caps, list) or any(c not in ("script_eval", "chemistry", "editorExtension",
                                                           "experimental_custom_ui", "raytraced", "pbr")
                                                 for c in caps):
                r.warn("manifest", lab, "unusual capabilities %r" % (caps,))
    for u, where in uuids.items():
        if len(where) > 1:
            r.error("manifest", "", "uuid %s used more than once: %s" % (u, "; ".join(where)))
    # dependencies
    if "BP" in mans and "RP" in mans:
        for pack, other in (("BP", "RP"), ("RP", "BP")):
            m, o = mans[pack], mans[other]
            lab = a.label(pack, "manifest.json")
            oh = o.get("header", {}) if isinstance(o.get("header"), dict) else {}
            deps = m.get("dependencies", [])
            if not isinstance(deps, list):
                r.error("manifest", lab, "dependencies must be a list")
                deps = []
            match = [d for d in deps if isinstance(d, dict) and d.get("uuid") == oh.get("uuid")]
            if not match:
                r.error("manifest", lab, "no dependency on the %s (uuid %s)" % (other, oh.get("uuid")))
            else:
                if match[0].get("version") != oh.get("version"):
                    r.error("manifest", lab, "dependency on %s has version %r but %s header.version is %r"
                            % (other, match[0].get("version"), other, oh.get("version")))
            for d in deps:
                if isinstance(d, dict) and "uuid" in d and d.get("uuid") not in (oh.get("uuid"),):
                    r.warn("manifest", lab, "dependency on unknown pack uuid %s" % d.get("uuid"))
    bpm = mans.get("BP")
    if bpm is not None:
        lab = a.label("BP", "manifest.json")
        mods = {}
        for d in bpm.get("dependencies", []) or []:
            if isinstance(d, dict) and "module_name" in d:
                if d["module_name"] in mods:
                    r.error("manifest", lab, "module %s listed twice" % d["module_name"])
                mods[d["module_name"]] = d.get("version")
        has_script = any(isinstance(x, dict) and x.get("type") == "script" for x in bpm.get("modules", []) or [])
        for name, ver in mods.items():
            if name in SCRIPT_MODULES:
                if ver != SCRIPT_MODULES[name]:
                    r.error("manifest", lab, "%s version must be exactly \"%s\" for 1.21.0.26 without experiments "
                                             "(got %r)" % (name, SCRIPT_MODULES[name], ver))
            else:
                r.warn("manifest", lab, "dependency on unexpected script module %s %r" % (name, ver))
            if isinstance(ver, str) and ("beta" in ver or "rc" in ver or "preview" in ver):
                r.error("manifest", lab, "%s %s is a beta/rc module and needs experiments" % (name, ver))
        if has_script:
            for name in SCRIPT_MODULES:
                if name not in mods:
                    r.error("manifest", lab, "missing module dependency %s %s" % (name, SCRIPT_MODULES[name]))
    # pack icons
    for pack in ("BP", "RP"):
        lab = a.label(pack, "pack_icon.png")
        if not a.exists(pack, "pack_icon.png"):
            r.warn("manifest", a.label(pack, ""), "pack_icon.png missing (pack shows a blank icon)")
        elif Image is not None:
            try:
                with Image.open(os.path.join(a.roots[pack], "pack_icon.png")) as im:
                    if im.size[0] != im.size[1]:
                        r.warn("manifest", lab, "pack icon is not square: %dx%d" % im.size)
                    elif im.size[0] > 512:
                        r.warn("manifest", lab, "pack icon %dx%d is larger than needed (256x256)" % im.size)
            except Exception as e:
                r.error("manifest", lab, "pack icon unreadable: %s" % e)


@check("lang", "languages.json, en_US.lang syntax, keys for entities / spawn eggs / items / pack name, "
               "translate keys used by scripts")
def check_lang(a):
    r = a.r
    for pack in ("BP", "RP"):
        if not os.path.isdir(a.roots[pack]):
            continue
        lj = a.get(pack, "texts/languages.json")
        lab = a.label(pack, "texts/languages.json")
        if not a.exists(pack, "texts/languages.json"):
            r.warn("lang", a.label(pack, "texts/"), "texts/languages.json missing")
        elif lj is not None:
            if not isinstance(lj, list) or not all(isinstance(x, str) for x in lj):
                r.error("lang", lab, "must be a JSON list of language codes")
            else:
                for code in lj:
                    if not a.exists(pack, "texts/%s.lang" % code):
                        r.error("lang", lab, "lists %s but texts/%s.lang is missing" % (code, code))
                if "en_US" not in lj:
                    r.warn("lang", lab, "en_US not listed")
        if "en_US" not in a.lang[pack]:
            r.error("lang", a.label(pack, "texts/en_US.lang"), "missing")
    rp_en = a.lang["RP"].get("en_US", {})
    lab = a.label("RP", "texts/en_US.lang")
    for eid, (_, ent) in a.bp_entities.items():
        key = "entity.%s.name" % eid
        if key not in rp_en:
            r.error("lang", lab, "missing %s (entity shows its raw id)" % key)
        desc = ent.get("description", {})
        if desc.get("is_spawnable", False):
            key = "item.spawn_egg.entity.%s.name" % eid
            if key not in rp_en:
                r.error("lang", lab, "missing %s (spawn egg shows its raw key)" % key)
    for iid, (ilab, item) in a.items.items():
        comps = item.get("components", {}) if isinstance(item.get("components"), dict) else {}
        dn = comps.get("minecraft:display_name")
        if isinstance(dn, dict) and isinstance(dn.get("value"), str):
            v = dn["value"]
            if re.match(r"^[\w.:]+$", v) and "." in v and v not in rp_en:
                r.error("lang", ilab, "display_name lang key %s missing from RP en_US.lang" % v)
            continue
        key = "item.%s.name" % iid
        if key not in rp_en:
            r.error("lang", lab, "missing %s (item shows its raw key)" % key)
    for rel, sc in a.scripts.items():
        for lst in token_lists(sc.toks):
            for k, t in enumerate(lst):
                if (t.kind == "ident" and t.value == "translate" and k + 2 < len(lst) and lst[k + 1].value == ":"
                        and lst[k + 2].kind == "str"):
                    key = lst[k + 2].value
                    if key not in rp_en and not key.startswith(("commands.", "item.minecraft", "tile.", "entity.minecraft")):
                        r.warn("lang", sc.label, "line %d: translate key %s not in RP en_US.lang" % (t.line, key))


@check("bp_entity", "BP entity description, properties, component groups, events (add/remove/set_property/"
                    "trigger), component event refs, loot tables, damage causes, components known")
def check_bp_entities(a):
    r = a.r
    for eid, (lab, ent) in a.bp_entities.items():
        desc = ent.get("description", {})
        if not NSID_RE.match(eid):
            r.error("bp_entity", lab, "identifier %s is not namespace:name" % eid)
        if desc.get("is_experimental"):
            r.error("bp_entity", lab, "is_experimental is true (needs experiments)")
        props = desc.get("properties", {})
        if props and not isinstance(props, dict):
            r.error("bp_entity", lab, "description.properties must be an object")
            props = {}
        for pn, pd in props.items():
            where = "%s property %s" % (lab, pn)
            if not NSID_RE.match(pn):
                r.error("bp_entity", where, "property names must be namespace:name")
            if not isinstance(pd, dict):
                r.error("bp_entity", where, "definition must be an object")
                continue
            t = pd.get("type")
            if t not in ("bool", "int", "float", "enum"):
                r.error("bp_entity", where, "type must be bool/int/float/enum (got %r)" % (t,))
                continue
            dflt = pd.get("default")
            if t in ("int", "float"):
                rng = pd.get("range")
                if not (isinstance(rng, list) and len(rng) == 2 and all(is_num(x) for x in rng)):
                    r.error("bp_entity", where, "%s property needs range [min, max]" % t)
                    rng = None
                elif rng[0] > rng[1]:
                    r.error("bp_entity", where, "range min > max")
                if t == "int" and rng and not all(float(x).is_integer() for x in rng):
                    r.error("bp_entity", where, "int range must be integers")
                if is_num(dflt) and rng and not (rng[0] <= dflt <= rng[1]):
                    r.error("bp_entity", where, "default %r outside range %r" % (dflt, rng))
                if dflt is None:
                    r.warn("bp_entity", where, "no default")
                if t == "int" and is_num(dflt) and not float(dflt).is_integer():
                    r.error("bp_entity", where, "int default is not an integer")
            elif t == "bool":
                if not isinstance(dflt, (bool, str)):
                    r.error("bp_entity", where, "bool property default must be true/false (got %r)" % (dflt,))
            elif t == "enum":
                vals = pd.get("values")
                if not (isinstance(vals, list) and vals and all(isinstance(x, str) for x in vals)):
                    r.error("bp_entity", where, "enum needs a non-empty list of string values")
                else:
                    if len(vals) > 16:
                        r.warn("bp_entity", where, "more than 16 enum values")
                    if isinstance(dflt, str) and dflt not in vals and not dflt.startswith(("q.", "query.")):
                        r.error("bp_entity", where, "default %r not in values" % dflt)
            if "client_sync" in pd and not isinstance(pd["client_sync"], bool):
                r.error("bp_entity", where, "client_sync must be a boolean")
        groups = ent.get("component_groups", {})
        if not isinstance(groups, dict):
            r.error("bp_entity", lab, "component_groups must be an object")
            groups = {}
        events = ent.get("events", {})
        if not isinstance(events, dict):
            r.error("bp_entity", lab, "events must be an object")
            events = {}
        comps = ent.get("components", {})
        if not isinstance(comps, dict):
            r.error("bp_entity", lab, "components must be an object")
            comps = {}

        def check_event_body(ename, body, path):
            where = "%s event %s" % (lab, ename)
            if isinstance(body, list):
                for i, b in enumerate(body):
                    check_event_body(ename, b, path + [i])
                return
            if not isinstance(body, dict):
                return
            for op in ("add", "remove"):
                if op in body:
                    cg = body[op].get("component_groups", []) if isinstance(body[op], dict) else None
                    if not isinstance(cg, list):
                        r.error("bp_entity", where, "%s.component_groups must be a list" % op)
                        continue
                    for g in cg:
                        if g not in groups:
                            r.error("bp_entity", where, "%s references undefined component group %s" % (op, g))
            if "set_property" in body:
                sp = body["set_property"]
                if not isinstance(sp, dict):
                    r.error("bp_entity", where, "set_property must be an object")
                else:
                    for pn, val in sp.items():
                        if pn not in props:
                            r.error("bp_entity", where, "set_property on undefined property %s" % pn)
                            continue
                        pt = props[pn].get("type") if isinstance(props[pn], dict) else None
                        if isinstance(val, str):
                            if pt == "enum" and not any(x in val for x in ("q.", "query.", "math.", "(")):
                                if val not in (props[pn].get("values") or []):
                                    r.error("bp_entity", where, "%s = %r not an enum value" % (pn, val))
                            continue
                        if pt == "bool" and not isinstance(val, bool):
                            r.error("bp_entity", where, "%s is bool but set to %r" % (pn, val))
                        if pt in ("int", "float"):
                            if not is_num(val):
                                r.error("bp_entity", where, "%s is %s but set to %r" % (pn, pt, val))
                            else:
                                rng = props[pn].get("range")
                                if isinstance(rng, list) and len(rng) == 2 and not (rng[0] <= val <= rng[1]):
                                    r.error("bp_entity", where, "%s = %r outside range %r" % (pn, val, rng))
            trig = body.get("trigger")
            if trig is not None:
                tname = trig if isinstance(trig, str) else (trig.get("event") if isinstance(trig, dict) else None)
                target = trig.get("target", "self") if isinstance(trig, dict) else "self"
                if tname and target == "self" and tname not in events:
                    r.error("bp_entity", where, "trigger references undefined event %s" % tname)
            for key in ("sequence", "randomize"):
                if key in body:
                    if not isinstance(body[key], list):
                        r.error("bp_entity", where, "%s must be a list" % key)
                    else:
                        for i, b in enumerate(body[key]):
                            check_event_body(ename, b, path + [key, i])
            if "queue_command" in body:
                qc = body["queue_command"]
                cmds = qc.get("command") if isinstance(qc, dict) else None
                for c in ([cmds] if isinstance(cmds, str) else cmds or []):
                    check_command_text(a, c, where, "bp_entity")

        for en, body in events.items():
            check_event_body(en, body, [])

        all_comp_sets = [("components", comps)] + [("component_groups/" + g, c) for g, c in groups.items()
                                                    if isinstance(c, dict)]
        for gname, cset in all_comp_sets:
            where = "%s %s" % (lab, gname)
            for cn in cset:
                if a.ref.ok and a.ref.bp_components and cn not in a.ref.bp_components and cn.startswith("minecraft:") \
                        and cn not in ENTITY_COMPONENTS_EXTRA:
                    r.warn("bp_entity", where, "component %s is not used by any vanilla 1.21.0 entity (typo?)" % cn)
            for path, k, v in walk_json(cset):
                if k == "event" and isinstance(v, str):
                    parent = cset
                    for p in path:
                        parent = parent[p]
                    target = parent.get("target", "self") if isinstance(parent, dict) else "self"
                    if target == "self" and v not in events:
                        r.error("bp_entity", where, "%s references undefined event %s" % (fmt_path(path), v))
                if k == "cause" and isinstance(v, str) and a.ref.ok and v not in a.ref.damage_causes:
                    r.error("bp_entity", where, "%s: unknown damage cause '%s'" % (fmt_path(path), v))
                if k in ("table", "loot_table") and isinstance(v, str) and v.endswith(".json"):
                    a.loot_refs.add(v)
                    if not a.exists("BP", v) and not (a.ref.ok and v in a.ref.loot_tables):
                        r.error("bp_entity", where, "%s: loot table %s not found" % (fmt_path(path), v))
            asi = cset.get("minecraft:ambient_sound_interval")
            if isinstance(asi, dict):
                evn = asi.get("event_name", "ambient")
                sj = a.sounds_json if isinstance(a.sounds_json, dict) else {}
                ents = sj.get("entity_sounds", {}).get("entities", {}) if isinstance(sj.get("entity_sounds"), dict) else {}
                if eid not in ents or evn not in (ents.get(eid, {}).get("events") or {}):
                    r.warn("bp_entity", where, "ambient_sound_interval event '%s' has no sound in RP sounds.json"
                           % evn)
        if eid not in a.client_entities:
            r.error("bp_entity", lab, "no RP client entity with identifier %s (entity is invisible)" % eid)
    for rel in a.files["BP"]:
        if not (rel.startswith("spawn_rules/") and rel.endswith(".json")):
            continue
        d = a.get("BP", rel)
        sr = d.get("minecraft:spawn_rules") if isinstance(d, dict) else None
        ident = sr.get("description", {}).get("identifier") if isinstance(sr, dict) and \
            isinstance(sr.get("description"), dict) else None
        if not ident:
            r.error("bp_entity", a.label("BP", rel), "spawn rules without description.identifier")
        elif a.known_entity(ident) is False:
            r.error("bp_entity", a.label("BP", rel), "spawn rules for unknown entity %s" % ident)


@check("item", "BP items: identifiers, menu_category, components known in the 1.20.80 schema and "
               "schema-valid, icon key exists in item_texture.json")
def check_items(a):
    r = a.r
    schema = a.ref.item_schema if a.ref.ok else None
    known = set(schema.get("properties", {})) if schema else ITEM_COMPONENTS_1_20_80
    for iid, (lab, item) in a.items.items():
        doc = a.data.get(lab, {})
        fv = parse_version(doc.get("format_version"))
        if fv is None:
            r.error("item", lab, "missing/invalid format_version")
        elif fv < (1, 20, 50):
            r.warn("item", lab, "format_version %s < 1.20.50: icon/menu_category handling differs"
                   % doc.get("format_version"))
        if not NSID_RE.match(iid):
            r.error("item", lab, "identifier %s is not namespace:name" % iid)
        desc = item.get("description", {})
        mc = desc.get("menu_category")
        if mc is not None:
            cat = mc.get("category") if isinstance(mc, dict) else None
            if cat not in MENU_CATEGORIES:
                r.error("item", lab, "menu_category.category %r invalid (one of %s)" % (cat, sorted(MENU_CATEGORIES)))
        comps = item.get("components", {})
        if not isinstance(comps, dict):
            r.error("item", lab, "components must be an object")
            continue
        for cn, cv in comps.items():
            if cn not in known:
                r.error("item", lab, "component %s is not in the 1.20.80 item schema (unknown on 1.21.0 "
                                     "without experiments)" % cn)
                continue
            if schema:
                sub = schema["properties"][cn]
                errs = schema_validate(cv, sub, schema, cn)
                for e in errs[:4]:
                    r.error("item", lab, "component %s: %s" % (cn, e))
        icon = comps.get("minecraft:icon")
        keys = []
        if icon is None:
            r.error("item", lab, "no minecraft:icon (item renders as a missing texture)")
        elif isinstance(icon, str):
            keys = [icon]
        elif isinstance(icon, dict):
            if isinstance(icon.get("textures"), dict):
                keys = [v for v in icon["textures"].values() if isinstance(v, str)]
                if "default" not in icon["textures"]:
                    r.error("item", lab, "minecraft:icon.textures needs a 'default' key")
            elif isinstance(icon.get("texture"), str):
                keys = [icon["texture"]]
        for k in keys:
            if k not in a.item_tex:
                r.error("item", lab, "icon key '%s' not found in RP textures/item_texture.json" % k)
        if "minecraft:custom_components" in comps:
            r.warn("item", lab, "minecraft:custom_components require a script registration in worldInitialize")


def _schema_resolve(sub, root):
    seen = 0
    while isinstance(sub, dict) and "$ref" in sub and seen < 20:
        ref = sub["$ref"]
        if not ref.startswith("#/"):
            return {}
        node = root
        for part in ref[2:].split("/"):
            node = node.get(part, {}) if isinstance(node, dict) else {}
        sub = node
        seen += 1
    return sub if isinstance(sub, dict) else {}


def schema_validate(val, sub, root, path):
    """Minimal JSON-schema validator for the Mojang item component schemas."""
    sub = _schema_resolve(sub, root)
    errs = []
    if "oneOf" in sub or "anyOf" in sub:
        opts = sub.get("oneOf") or sub.get("anyOf")
        results = [schema_validate(val, o, root, path) for o in opts]
        if all(res for res in results):
            best = min(results, key=len)
            return ["%s does not match any allowed form (%s)" % (path, best[0] if best else "?")]
        return []
    t = sub.get("type")
    if t:
        types = t if isinstance(t, list) else [t]
        ok = False
        for ty in types:
            if ty == "object" and isinstance(val, dict) or ty == "array" and isinstance(val, list) \
                    or ty == "string" and isinstance(val, str) or ty == "boolean" and isinstance(val, bool) \
                    or ty == "integer" and isinstance(val, int) and not isinstance(val, bool) \
                    or ty == "number" and is_num(val) or ty == "null" and val is None:
                ok = True
        if not ok:
            return ["%s should be %s (got %s)" % (path, "/".join(types), type(val).__name__)]
    if "enum" in sub and val not in sub["enum"]:
        errs.append("%s must be one of %s" % (path, sub["enum"]))
    if is_num(val):
        if "minimum" in sub and val < sub["minimum"]:
            errs.append("%s = %s below minimum %s" % (path, val, sub["minimum"]))
        if "maximum" in sub and val > sub["maximum"]:
            errs.append("%s = %s above maximum %s" % (path, val, sub["maximum"]))
    if isinstance(val, str):
        if "minLength" in sub and len(val) < sub["minLength"]:
            errs.append("%s shorter than %d" % (path, sub["minLength"]))
        if "maxLength" in sub and len(val) > sub["maxLength"]:
            errs.append("%s longer than %d" % (path, sub["maxLength"]))
        if "pattern" in sub:
            try:
                if not re.search(sub["pattern"], val):
                    errs.append("%s does not match pattern %s" % (path, sub["pattern"]))
            except re.error:
                pass
    if isinstance(val, dict):
        props = sub.get("properties", {})
        for req in sub.get("required", []) or []:
            if req not in val:
                errs.append("%s missing required '%s'" % (path, req))
        addl = sub.get("additionalProperties", True)
        for k, v in val.items():
            if k in props:
                errs += schema_validate(v, props[k], root, "%s.%s" % (path, k))
            elif addl is False:
                errs.append("%s has unknown property '%s'" % (path, k))
            elif isinstance(addl, dict):
                errs += schema_validate(v, addl, root, "%s.%s" % (path, k))
    if isinstance(val, list) and isinstance(sub.get("items"), dict):
        for i, v in enumerate(val):
            errs += schema_validate(v, sub["items"], root, "%s[%d]" % (path, i))
    return errs


def _item_desc(v):
    if isinstance(v, str):
        return v
    if isinstance(v, dict):
        return v.get("item") or (("#tag:" + v["tag"]) if "tag" in v else None)
    return None


@check("recipe", "recipe type/identifier/tags, shaped pattern <-> key consistency, every ingredient and "
                 "result item exists (custom or vanilla 1.21.0)")
def check_recipes(a):
    r = a.r
    ids = {}
    for lab, doc in a.recipes.items():
        if not isinstance(doc, dict):
            continue
        kinds = [k for k in doc if k.startswith("minecraft:recipe_")]
        if len(kinds) != 1:
            r.error("recipe", lab, "must contain exactly one minecraft:recipe_* object (found %s)" % kinds)
            continue
        kind = kinds[0]
        if kind not in RECIPE_TYPES:
            r.error("recipe", lab, "unknown recipe type %s" % kind)
        body = doc[kind]
        if not isinstance(body, dict):
            r.error("recipe", lab, "%s must be an object" % kind)
            continue
        rid = body.get("description", {}).get("identifier") if isinstance(body.get("description"), dict) else None
        if not rid:
            r.error("recipe", lab, "missing description.identifier")
        else:
            if rid in ids:
                r.error("recipe", lab, "duplicate recipe identifier %s (also %s)" % (rid, ids[rid]))
            ids[rid] = lab
            if not NSID_RE.match(rid):
                r.error("recipe", lab, "identifier %s is not namespace:name" % rid)
        tags = body.get("tags")
        if not (isinstance(tags, list) and tags and all(isinstance(t, str) for t in tags)):
            r.error("recipe", lab, "tags must be a non-empty list (e.g. [\"crafting_table\"])")

        def chk_item(desc, where):
            name = _item_desc(desc)
            if name is None:
                r.error("recipe", lab, "%s: item descriptor %r invalid" % (where, desc))
                return
            if name.startswith("#tag:"):
                return
            k = a.known_item(name)
            if k is False:
                hint = close_match(name, set(a.items) | (a.ref.items if a.ref.ok else set()))
                r.error("recipe", lab, "%s: unknown item %s%s" % (where, name, (" (did you mean %s?)" % hint)
                                                                   if hint else ""))

        if kind == "minecraft:recipe_shaped":
            pat, key = body.get("pattern"), body.get("key")
            if not (isinstance(pat, list) and 1 <= len(pat) <= 3 and all(isinstance(p, str) and 1 <= len(p) <= 3
                                                                         for p in pat)):
                r.error("recipe", lab, "pattern must be 1-3 strings of 1-3 characters")
                pat = [p for p in pat if isinstance(p, str)] if isinstance(pat, list) else []
            elif len(set(len(p) for p in pat)) > 1:
                r.error("recipe", lab, "pattern rows have different lengths: %r" % pat)
            if not isinstance(key, dict):
                r.error("recipe", lab, "key must be an object")
                key = {}
            used = set("".join(pat)) - {" "}
            for ch in sorted(used):
                if ch not in key:
                    r.error("recipe", lab, "pattern symbol '%s' has no key entry" % ch)
            for ch, desc in key.items():
                if len(ch) != 1:
                    r.error("recipe", lab, "key '%s' must be a single character" % ch)
                if ch not in used:
                    r.warn("recipe", lab, "key '%s' is not used in the pattern" % ch)
                chk_item(desc, "key %s" % ch)
        elif kind == "minecraft:recipe_shapeless":
            ing = body.get("ingredients")
            if not isinstance(ing, list) or not ing or len(ing) > 9:
                r.error("recipe", lab, "ingredients must be a list of 1-9 items")
            for i, desc in enumerate(ing or []):
                chk_item(desc, "ingredient %d" % i)
        elif kind == "minecraft:recipe_furnace":
            chk_item(body.get("input"), "input")
        res = body.get("result") if kind != "minecraft:recipe_furnace" else body.get("output")
        if res is None:
            r.error("recipe", lab, "no result")
        for i, desc in enumerate(res if isinstance(res, list) else [res] if res is not None else []):
            chk_item(desc, "result")
            if isinstance(desc, dict) and "count" in desc:
                c = desc["count"]
                if not (isinstance(c, int) and 1 <= c <= 64):
                    r.error("recipe", lab, "result count %r invalid" % (c,))
                name = _item_desc(desc)
                if name in a.items:
                    mss = a.items[name][1].get("components", {}).get("minecraft:max_stack_size")
                    mss = mss.get("value") if isinstance(mss, dict) else mss
                    if is_num(mss) and c > mss:
                        r.warn("recipe", lab, "result count %d > max_stack_size %d" % (c, mss))


@check("loot", "loot tables: pools/entries structure, item names exist, counts sane, nested loot_table refs, "
               "referenced tables exist and every table is referenced")
def check_loot(a):
    r = a.r
    for rel, doc in a.loot.items():
        lab = a.label("BP", rel)
        if not isinstance(doc, dict):
            continue
        pools = doc.get("pools")
        if not isinstance(pools, list):
            r.error("loot", lab, "pools must be a list")
            continue
        for pi, pool in enumerate(pools):
            where = "pool %d" % pi
            if not isinstance(pool, dict):
                r.error("loot", lab, "%s is not an object" % where)
                continue
            rolls = pool.get("rolls", 1)
            if not (isinstance(rolls, int) or (isinstance(rolls, dict) and is_num(rolls.get("min"))
                                               and is_num(rolls.get("max")) and rolls["min"] <= rolls["max"])):
                r.error("loot", lab, "%s: rolls must be an int or {min,max} (got %r)" % (where, rolls))
            entries = pool.get("entries")
            if not isinstance(entries, list) or not entries:
                r.error("loot", lab, "%s: entries must be a non-empty list" % where)
                entries = []
            for cond in pool.get("conditions", []) or []:
                cn = cond.get("condition") if isinstance(cond, dict) else None
                if cn not in LOOT_CONDITIONS:
                    r.warn("loot", lab, "%s: unknown condition %r" % (where, cn))
                if cn == "random_chance" and not (is_num(cond.get("chance")) and 0 <= cond["chance"] <= 1):
                    r.error("loot", lab, "%s: random_chance.chance must be 0..1" % where)
            for ei, e in enumerate(entries):
                ew = "%s entry %d" % (where, ei)
                if not isinstance(e, dict):
                    r.error("loot", lab, "%s is not an object" % ew)
                    continue
                t = e.get("type")
                if t == "item":
                    if a.known_item(e.get("name")) is False:
                        r.error("loot", lab, "%s: unknown item %r" % (ew, e.get("name")))
                elif t == "loot_table":
                    n = e.get("name") or e.get("value")
                    if isinstance(n, str):
                        a.loot_refs.add(n)
                        if not a.exists("BP", n) and not (a.ref.ok and n in a.ref.loot_tables):
                            r.error("loot", lab, "%s: nested loot table %s not found" % (ew, n))
                elif t != "empty":
                    r.error("loot", lab, "%s: type must be item/loot_table/empty (got %r)" % (ew, t))
                w = e.get("weight", 1)
                if not (isinstance(w, int) and w > 0):
                    r.error("loot", lab, "%s: weight must be a positive int" % ew)
                for fn in e.get("functions", []) or []:
                    fname = fn.get("function") if isinstance(fn, dict) else None
                    if fname and fname.startswith("minecraft:"):
                        fname = fname[10:]
                    if fname not in LOOT_FUNCTIONS:
                        r.warn("loot", lab, "%s: unknown function %r" % (ew, fname))
                    cnt = fn.get("count") if isinstance(fn, dict) else None
                    if isinstance(cnt, dict) and is_num(cnt.get("min")) and is_num(cnt.get("max")) \
                            and cnt["min"] > cnt["max"]:
                        r.error("loot", lab, "%s: %s count min > max" % (ew, fname))
                for cond in e.get("conditions", []) or []:
                    cn = cond.get("condition") if isinstance(cond, dict) else None
                    if cn not in LOOT_CONDITIONS:
                        r.warn("loot", lab, "%s: unknown condition %r" % (ew, cn))
                    if cn == "random_chance" and not (is_num(cond.get("chance")) and 0 <= cond["chance"] <= 1):
                        r.error("loot", lab, "%s: random_chance.chance must be 0..1" % ew)
    for rel in a.loot:
        if rel not in a.loot_refs:
            r.warn("loot", a.label("BP", rel), "loot table is not referenced by any entity/loot table/script")


def molang_strings(obj, skip_keys=("identifier",)):
    for path, s in iter_strings(obj):
        if path and path[-1] in skip_keys:
            continue
        yield path, s


def check_molang_block(a, obj, lab, check, entity_ids=None):
    """Molang sanity for every string in obj: balanced brackets, known queries/math,
    query.property names exist on the BP entity.  Returns (reads, writes)."""
    r = a.r
    reads, writes = set(), set()
    props = {}
    for eid in (entity_ids or [None]):
        props.update(a.bp_props(eid))
    known_q = a.ref.queries if a.ref.ok else MOLANG_QUERIES_BASE
    known_m = a.ref.maths if a.ref.ok else MOLANG_MATH
    for path, s in molang_strings(obj):
        if not any(ch in s for ch in "()[].") or s.startswith(("textures/", "animation.", "controller.",
                                                               "geometry.", "sounds/")):
            continue
        res = molang_scan(s)
        where = "%s %s" % (lab, fmt_path(path))
        if res["error"]:
            r.error(check, where, "Molang %s: %s" % (res["error"], s[:80]))
        for kind, pn in res["props"]:
            if a.bp_entities and pn not in props:
                hint = close_match(pn, props)
                r.error(check, where, "query.%s('%s'): property not defined on the BP entity%s"
                        % (kind, pn, (" (did you mean %s?)" % hint) if hint else ""))
        for q in res["queries"]:
            if q not in known_q:
                r.warn(check, where, "query.%s is not used anywhere in vanilla 1.21.0 (typo?)" % q)
        for m in res["maths"]:
            if m not in known_m:
                lvl = "warning" if m.startswith("ease") else "error"
                r.add(lvl, check, where, "math.%s is not a Molang function in 1.21.0" % m)
        reads |= res["reads"]
        writes |= res["writes"]
    return reads, writes


@check("client_entity", "client entity <-> BP entity ids, materials, textures, geometry, animations, animate "
                        "list, render controllers, particle/sound effects, spawn egg, Molang + variables; attachables")
def check_client_entities(a):
    r = a.r
    for iid, (lab, at) in a.attachables.items():
        desc = at.get("description", {}) if isinstance(at.get("description"), dict) else {}
        base_id = iid.split(".")[0]
        if a.known_item(base_id) is False:
            r.error("client_entity", lab, "attachable for unknown item %s" % iid)
        for k, p in (desc.get("textures") or {}).items():
            if p != "textures/misc/enchanted_item_glint":
                a.ref_texture(p, "%s textures.%s" % (lab, k), "client_entity")
        for k, g in (desc.get("geometry") or {}).items():
            if g not in a.geos and not (a.ref.ok and g in a.ref.geometries):
                r.error("client_entity", lab, "geometry.%s = %s not defined" % (k, g))
        for rc in desc.get("render_controllers") or []:
            rid = rc if isinstance(rc, str) else (next(iter(rc)) if isinstance(rc, dict) and rc else None)
            if not rid or (rid not in a.rcs and not (a.ref.ok and rid in a.ref.render_controllers)):
                r.error("client_entity", lab, "render controller %r not defined" % (rid,))
            elif rid in a.rcs:
                a.rc_used[rid].add(iid)
    for eid, (lab, ce) in a.client_entities.items():
        desc = ce.get("description", {})
        doc = a.data.get(lab, {})
        if doc.get("format_version") not in ("1.8.0", "1.10.0"):
            r.warn("client_entity", lab, "format_version %r (vanilla uses 1.8.0 / 1.10.0)" % doc.get("format_version"))
        if eid not in a.bp_entities and not (a.ref.ok and eid in a.ref.entities):
            r.error("client_entity", lab, "identifier %s has no matching BP entity" % eid)
        mats = desc.get("materials", {})
        rp_mats = set()
        for f in a.files["RP"]:
            if f.startswith("materials/") and f.endswith(".material"):
                d = load_json_lenient(os.path.join(a.rp, f)) or {}
                for k in (d.get("materials", {}) or {}):
                    rp_mats.add(k.split(":")[0])
        for k, m in (mats or {}).items():
            if a.ref.ok and m not in a.ref.materials and m.split(":")[0] not in rp_mats:
                r.warn("client_entity", lab, "material %s=%s is not used by any vanilla entity" % (k, m))
        texs = desc.get("textures", {}) or {}
        for k, p in texs.items():
            a.ref_texture(p, "%s textures.%s" % (lab, k), "client_entity")
        geos = desc.get("geometry", {}) or {}
        for k, g in geos.items():
            if g not in a.geos and not (a.ref.ok and g in a.ref.geometries):
                r.error("client_entity", lab, "geometry.%s = %s not defined in RP models/" % (k, g))
        anims = desc.get("animations", {}) or {}
        for k, v in anims.items():
            if not isinstance(v, str):
                r.error("client_entity", lab, "animations.%s must be a string id" % k)
                continue
            if v.startswith("controller.animation."):
                if v not in a.acs and not (a.ref.ok and v in a.ref.anim_controllers):
                    r.error("client_entity", lab, "animation controller %s (%s) not defined" % (v, k))
            elif v.startswith("animation."):
                if v not in a.animations and not (a.ref.ok and v in a.ref.animations):
                    hint = close_match(v, a.animations)
                    r.error("client_entity", lab, "animation %s (%s) not defined%s"
                            % (v, k, (" (did you mean %s?)" % hint) if hint else ""))
            else:
                r.error("client_entity", lab, "animations.%s = %s must start with animation. or "
                                              "controller.animation." % (k, v))
        scripts = desc.get("scripts", {}) or {}
        for entry in scripts.get("animate", []) or []:
            names = [entry] if isinstance(entry, str) else list(entry) if isinstance(entry, dict) else []
            for n in names:
                if n not in anims:
                    r.error("client_entity", lab, "scripts.animate uses '%s' which is not a key in animations" % n)
        rcs = desc.get("render_controllers", []) or []
        if not rcs:
            r.error("client_entity", lab, "no render_controllers (entity is invisible)")
        for rc in rcs:
            rid = rc if isinstance(rc, str) else (next(iter(rc)) if isinstance(rc, dict) and rc else None)
            if not rid or (rid not in a.rcs and not (a.ref.ok and rid in a.ref.render_controllers)):
                r.error("client_entity", lab, "render controller %r not defined" % (rid,))
        for k, v in (desc.get("particle_effects", {}) or {}).items():
            if a.known_particle(v) is False:
                r.error("client_entity", lab, "particle_effects.%s = %s not defined" % (k, v))
        for k, v in (desc.get("sound_effects", {}) or {}).items():
            sid = v.get("effect") if isinstance(v, dict) else v
            a.sound_refs.add(sid)
            if a.known_sound(sid) is False:
                r.error("client_entity", lab, "sound_effects.%s = %s not in sound_definitions" % (k, sid))
        egg = desc.get("spawn_egg")
        if egg is not None:
            if not isinstance(egg, dict):
                r.error("client_entity", lab, "spawn_egg must be an object")
            elif "texture" in egg:
                if egg["texture"] not in a.item_tex:
                    r.error("client_entity", lab, "spawn_egg.texture %s not in item_texture.json" % egg["texture"])
            else:
                for k in ("base_color", "overlay_color"):
                    if not (isinstance(egg.get(k), str) and re.match(r"^#[0-9a-fA-F]{6}$", egg[k])):
                        r.error("client_entity", lab, "spawn_egg.%s must be #RRGGBB (got %r)" % (k, egg.get(k)))
        # Molang + variables (entity, its controllers and animations, render controllers)
        reads, writes = check_molang_block(a, desc.get("scripts", {}), lab + " scripts", "client_entity", [eid])
        for vn in (scripts.get("variables") or {}):
            writes.add(vn.split(".", 1)[-1].lower())
        pe_writes = set()
        for v in anims.values():
            if v in a.acs:
                acl, ac = a.acs[v]
                rd, wr = check_molang_block(a, ac, acl + " " + v, "animation_controller", [eid])
                reads |= rd
                writes |= wr
                for st in (ac.get("states") or {}).values():
                    for pe in (st.get("particle_effects") or []) if isinstance(st, dict) else []:
                        if isinstance(pe, dict):
                            pe_writes |= molang_scan(pe.get("pre_effect_script", ""))["writes"]
            elif v in a.animations:
                al, an = a.animations[v]
                rd, wr = check_molang_block(a, an, al + " " + v, "animation", [eid])
                reads |= rd
                writes |= wr
        for rc in rcs:
            rid = rc if isinstance(rc, str) else (next(iter(rc)) if isinstance(rc, dict) and rc else None)
            if rid in a.rcs:
                rl, rcb = a.rcs[rid]
                rd, wr = check_molang_block(a, rcb, rl + " " + rid, "render_controller", [eid])
                reads |= rd
                if isinstance(rc, dict):
                    rd2, _ = check_molang_block(a, rc, lab + " render_controllers", "client_entity", [eid])
                    reads |= rd2
        a.entity_effect_vars |= pe_writes | writes
        for vn in sorted(reads - writes - MOLANG_ENGINE_VARIABLES):
            r.warn("client_entity", lab, "variable.%s is read but never assigned (evaluates to 0)" % vn)


def _geo_extent(g):
    """Approximate model extents (pixels) with bone + cube rotations applied."""
    def rot(rv):
        rx, ry, rz = [math.radians(x) for x in rv]
        rx, rz = -rx, -rz

        def mx(a_):
            c, s = math.cos(a_), math.sin(a_)
            return [[1, 0, 0], [0, c, -s], [0, s, c]]

        def my(a_):
            c, s = math.cos(a_), math.sin(a_)
            return [[c, 0, s], [0, 1, 0], [-s, 0, c]]

        def mz(a_):
            c, s = math.cos(a_), math.sin(a_)
            return [[c, -s, 0], [s, c, 0], [0, 0, 1]]

        def mm(p, q):
            return [[sum(p[i][k] * q[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
        return mm(mz(rz), mm(my(ry), mx(rx)))

    def apply(m, t, p):
        return [sum(m[i][k] * p[k] for k in range(3)) + t[i] for i in range(3)]

    def compose(m1, t1, m2, t2):
        m = [[sum(m1[i][k] * m2[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
        return m, apply(m1, t1, t2)

    def local(pivot, rv):
        R = rot(rv or [0, 0, 0])
        pv = list(pivot or [0, 0, 0])
        t = [pv[i] - sum(R[i][k] * pv[k] for k in range(3)) for i in range(3)]
        return R, t

    bones = {b.get("name"): b for b in g.bones if isinstance(b, dict)}
    cache = {}

    def world(name, depth=0):
        if name in cache:
            return cache[name]
        b = bones.get(name)
        if b is None or depth > 64:
            return [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [0, 0, 0]
        m, t = local(b.get("pivot"), b.get("rotation"))
        if b.get("parent") in bones:
            pm, pt = world(b["parent"], depth + 1)
            m, t = compose(pm, pt, m, t)
        cache[name] = (m, t)
        return m, t

    lo, hi = [1e9] * 3, [-1e9] * 3
    for name, b in bones.items():
        bm, bt = world(name)
        for c in b.get("cubes", []) or []:
            o, s = c.get("origin"), c.get("size")
            if not (isinstance(o, list) and isinstance(s, list) and len(o) == 3 and len(s) == 3):
                continue
            inf = c.get("inflate", 0) if is_num(c.get("inflate", 0)) else 0
            cm, ct = local(c.get("pivot", [o[i] + s[i] / 2 for i in range(3)]), c.get("rotation"))
            m, t = compose(bm, bt, cm, ct)
            for dx in (0, 1):
                for dy in (0, 1):
                    for dz in (0, 1):
                        p = [o[0] - inf + dx * (s[0] + 2 * inf), o[1] - inf + dy * (s[1] + 2 * inf),
                             o[2] - inf + dz * (s[2] + 2 * inf)]
                        w = apply(m, t, p)
                        for i in range(3):
                            lo[i] = min(lo[i], w[i])
                            hi[i] = max(hi[i], w[i])
    return (lo, hi) if lo[0] < 1e9 else None


@check("geometry", "geometry ids unique, bones unique with valid parents (no cycles), cube data valid, "
                   "per-face/box UVs inside texture_width/height, locators, cube budget, visible bounds")
def check_geometry(a):
    r = a.r
    for gid, g in a.geos.items():
        lab = "%s %s" % (g.label, gid)
        if not gid.startswith("geometry."):
            r.error("geometry", lab, "identifier must start with 'geometry.'")
        tw, th = g.tw, g.th
        if not (is_num(tw) and is_num(th) and tw > 0 and th > 0):
            r.error("geometry", lab, "texture_width/height invalid (%r x %r)" % (tw, th))
            tw = th = None
        names = {}
        for b in g.bones:
            if not isinstance(b, dict) or not isinstance(b.get("name"), str):
                r.error("geometry", lab, "bone without a name")
                continue
            if b["name"] in names:
                r.error("geometry", lab, "duplicate bone name %s" % b["name"])
            names[b["name"]] = b
        for n, b in names.items():
            p = b.get("parent")
            if p is not None and p not in names:
                r.error("geometry", lab, "bone %s has unknown parent %s" % (n, p))
            seen, cur = set(), n
            while cur is not None and cur in names:
                if cur in seen:
                    r.error("geometry", lab, "parent cycle involving bone %s" % n)
                    break
                seen.add(cur)
                cur = names[cur].get("parent")
            for key in ("pivot", "rotation"):
                v = b.get(key)
                if v is not None and not (isinstance(v, list) and len(v) == 3 and all(is_num(x) for x in v)):
                    r.error("geometry", lab, "bone %s %s must be 3 numbers" % (n, key))
            if b.get("poly_mesh") is not None:
                r.warn("geometry", lab, "bone %s uses poly_mesh (heavy on mobile)" % n)
        cubes = 0
        loc_seen = {}
        for b in g.bones:
            if not isinstance(b, dict):
                continue
            bn = b.get("name")
            for ln in (b.get("locators") or {}) if isinstance(b.get("locators"), dict) else {}:
                if ln in loc_seen:
                    r.warn("geometry", lab, "locator %s defined on both %s and %s" % (ln, loc_seen[ln], bn))
                loc_seen[ln] = bn
            for ci, c in enumerate(b.get("cubes", []) or []):
                cubes += 1
                where = "bone %s cube %d" % (bn, ci)
                o, s = c.get("origin"), c.get("size")
                if not (isinstance(o, list) and len(o) == 3 and all(is_num(x) for x in o)):
                    r.error("geometry", lab, "%s origin must be 3 numbers" % where)
                    continue
                if not (isinstance(s, list) and len(s) == 3 and all(is_num(x) for x in s)):
                    r.error("geometry", lab, "%s size must be 3 numbers" % where)
                    continue
                if any(x < 0 for x in s):
                    r.warn("geometry", lab, "%s has a negative size %r" % (where, s))
                uv = c.get("uv")
                if tw is None or uv is None:
                    if uv is None:
                        r.warn("geometry", lab, "%s has no uv" % where)
                    continue
                eps = 1e-6
                if isinstance(uv, list):
                    if not (len(uv) == 2 and all(is_num(x) for x in uv)):
                        r.error("geometry", lab, "%s box uv must be [u, v]" % where)
                        continue
                    u0, v0 = uv
                    w = 2 * (abs(s[0]) + abs(s[2]))
                    h = abs(s[2]) + abs(s[1])
                    if u0 < -eps or v0 < -eps or u0 + w > tw + eps or v0 + h > th + eps:
                        r.error("geometry", lab, "%s box UV footprint [%g,%g]-[%g,%g] exceeds texture %gx%g"
                                % (where, u0, v0, u0 + w, v0 + h, tw, th))
                elif isinstance(uv, dict):
                    for face, fd in uv.items():
                        if face not in ("north", "south", "east", "west", "up", "down"):
                            r.error("geometry", lab, "%s unknown uv face %r" % (where, face))
                            continue
                        if not isinstance(fd, dict) or not (isinstance(fd.get("uv"), list) and len(fd["uv"]) == 2):
                            r.error("geometry", lab, "%s face %s needs uv [u, v]" % (where, face))
                            continue
                        us = fd.get("uv_size")
                        if not (isinstance(us, list) and len(us) == 2 and all(is_num(x) for x in us)):
                            r.error("geometry", lab, "%s face %s needs uv_size [w, h]" % (where, face))
                            continue
                        u, v = fd["uv"]
                        if not (is_num(u) and is_num(v)):
                            r.error("geometry", lab, "%s face %s uv must be numbers" % (where, face))
                            continue
                        umin, umax = sorted((u, u + us[0]))
                        vmin, vmax = sorted((v, v + us[1]))
                        if umin < -eps or vmin < -eps or umax > tw + eps or vmax > th + eps:
                            r.error("geometry", lab, "%s face %s UV rect [%g,%g]-[%g,%g] outside %gx%g texture"
                                    % (where, face, umin, vmin, umax, vmax, tw, th))
                else:
                    r.error("geometry", lab, "%s uv must be [u,v] or a per-face object" % where)
        if cubes > 300:
            r.warn("geometry", lab, "%d cubes - heavy for a mobile entity (aim for < 150)" % cubes)
        r.info("geometry", lab, "%d bones, %d cubes, %d locators" % (len(names), cubes, len(loc_seen)))
        # visible bounds
        vbw, vbh = g.desc.get("visible_bounds_width"), g.desc.get("visible_bounds_height")
        vbo = g.desc.get("visible_bounds_offset", [0, 0, 0])
        if is_num(vbw) and is_num(vbh) and isinstance(vbo, list) and len(vbo) == 3:
            ext = _geo_extent(g)
            if ext:
                scale = 1.0
                for eid, (_, ce) in a.client_entities.items():
                    if gid in (ce.get("description", {}).get("geometry", {}) or {}).values():
                        sc = (ce.get("description", {}).get("scripts", {}) or {}).get("scale")
                        rg = molang_range(sc, a.bp_props(eid)) if sc is not None else None
                        if rg:
                            scale = max(scale, rg[1])
                lo, hi = [x / 16.0 * scale for x in ext[0]], [x / 16.0 * scale for x in ext[1]]
                half = vbw / 2.0
                margin = 1.1
                if (max(abs(lo[0] - vbo[0]), abs(hi[0] - vbo[0]), abs(lo[2] - vbo[2]), abs(hi[2] - vbo[2]))
                        > half * margin or hi[1] > vbo[1] + vbh / 2.0 * margin or lo[1] < vbo[1] - vbh / 2.0 * margin):
                    r.warn("geometry", lab, "model extents x[%.2f,%.2f] y[%.2f,%.2f] z[%.2f,%.2f] (scale %.2f) "
                           "exceed visible bounds %gx%g @%r - it will pop out at screen edges"
                           % (lo[0], hi[0], lo[1], hi[1], lo[2], hi[2], scale, vbw, vbh, vbo))


@check("render_controller", "controller ids exist, arrays/Texture./Material./Geometry. keys defined on the "
                            "entity, part_visibility/material bone patterns match geometry bones, array index range")
def check_render_controllers(a):
    r = a.r
    for rid, (lab, rc) in a.rcs.items():
        where0 = "%s %s" % (lab, rid)
        if not rid.startswith("controller.render."):
            r.error("render_controller", where0, "id must start with controller.render.")
        users = a.rc_used.get(rid, set())
        if not users:
            r.warn("render_controller", where0, "not used by any client entity")
        if not isinstance(rc, dict):
            r.error("render_controller", where0, "must be an object")
            continue
        arrays = rc.get("arrays", {}) or {}
        arr_defs = {}
        for kind, prefix in (("textures", "Texture."), ("geometries", "Geometry."), ("materials", "Material.")):
            for an, lst in (arrays.get(kind, {}) or {}).items():
                if not an.startswith("Array."):
                    r.error("render_controller", where0, "array name %s must start with 'Array.'" % an)
                if not isinstance(lst, list) or not lst:
                    r.error("render_controller", where0, "%s must be a non-empty list" % an)
                    continue
                arr_defs[an] = (kind, lst)
                for el in lst:
                    if not (isinstance(el, str) and el.startswith(prefix)):
                        r.error("render_controller", where0, "%s element %r must be a %s* reference" % (an, el, prefix))
        for eid in sorted(users):
            if eid not in a.client_entities:
                continue  # attachable: keys checked against its own description below are skipped
            elab, ce = a.client_entities[eid]
            desc = ce.get("description", {})
            defined = {"Texture.": set(desc.get("textures", {}) or {}),
                       "Geometry.": set(desc.get("geometry", {}) or {}),
                       "Material.": set(desc.get("materials", {}) or {})}
            where = "%s (for %s)" % (where0, eid)
            props = a.bp_props(eid)

            def chk_ref(expr, prefix, arr_kind):
                if not isinstance(expr, str):
                    r.error("render_controller", where, "reference %r is not a string" % (expr,))
                    return
                m = re.match(r"^\s*(Array\.[\w]+)\s*\[(.*)\]\s*$", expr, re.S)
                if m:
                    an, idx = m.group(1), m.group(2)
                    if an not in arr_defs or arr_defs[an][0] != arr_kind:
                        r.error("render_controller", where, "%s is not defined in arrays.%s" % (an, arr_kind))
                        return
                    lst = arr_defs[an][1]
                    for el in lst:
                        if isinstance(el, str) and el.startswith(prefix) and el[len(prefix):] not in defined[prefix]:
                            r.error("render_controller", where, "%s element %s not defined in the client entity "
                                    "%s" % (an, el, prefix.rstrip(".").lower()))
                    rg = molang_range(idx, props)
                    if rg and (rg[0] < 0 or math.floor(rg[1]) > len(lst) - 1):
                        r.warn("render_controller", where, "%s index %s ranges %g..%g but the array has %d "
                               "entries" % (an, idx.strip(), rg[0], rg[1], len(lst)))
                    return
                m = re.match(r"^\s*(%s)([\w]+)\s*$" % re.escape(prefix), expr)
                if m:
                    if m.group(2) not in defined[prefix]:
                        r.error("render_controller", where, "%s%s not defined in the client entity" % (prefix, m.group(2)))
                    return
                r.error("render_controller", where, "cannot parse reference %r (expected %s* or Array.*[...])"
                        % (expr, prefix))

            if "geometry" in rc:
                chk_ref(rc["geometry"], "Geometry.", "geometries")
            else:
                r.error("render_controller", where, "no geometry")
            texl = rc.get("textures")
            if not isinstance(texl, list) or not texl:
                r.error("render_controller", where, "textures must be a non-empty list")
            for t in texl or []:
                chk_ref(t, "Texture.", "textures")
            bones = a.bones_for(a.geos_for_entity(ce))
            mlist = rc.get("materials")
            if not isinstance(mlist, list) or not mlist:
                r.error("render_controller", where, "materials must be a non-empty list")
            for md in mlist or []:
                if not isinstance(md, dict):
                    r.error("render_controller", where, "materials entries must be objects")
                    continue
                for pat, ref in md.items():
                    chk_ref(ref, "Material.", "materials")
                    _chk_bone_pattern(a, pat, bones, where, "materials")
            for pv in rc.get("part_visibility", []) or []:
                if not isinstance(pv, dict):
                    r.error("render_controller", where, "part_visibility entries must be objects")
                    continue
                for pat, cond in pv.items():
                    _chk_bone_pattern(a, pat, bones, where, "part_visibility")
                    if not isinstance(cond, (bool, str, int, float)):
                        r.error("render_controller", where, "part_visibility %s value must be bool/Molang" % pat)
        if isinstance(rc.get("ignore_lighting"), str):
            r.warn("render_controller", where0, "ignore_lighting should be a boolean")


def _chk_bone_pattern(a, pat, bones, where, what):
    if not bones:
        return
    if any(ch in pat for ch in "*?["):
        if not any(fnmatch.fnmatchcase(b, pat) for b in bones):
            a.r.warn("render_controller", where, "%s pattern '%s' matches no bone" % (what, pat))
    elif pat not in bones:
        hint = close_match(pat, bones, 2, 3)
        a.r.error("render_controller", where, "%s bone '%s' not in geometry%s"
                  % (what, pat, (" (did you mean %s?)" % hint) if hint else ""))


def _effect_names(desc):
    return set((desc.get("particle_effects") or {})), set((desc.get("sound_effects") or {}))


@check("animation", "animation ids, loop/length, every animated bone exists in the geometry, channel shapes, "
                    "timeline particle/sound effects + locators defined, unused animations")
def check_animations(a):
    r = a.r
    played = set()
    for sc in a.scripts.values():
        for _, args, _ in sc.method_calls({"playAnimation"}):
            lit = literal(args[0]) if args else None
            if lit and lit[0] == "str":
                played.add(lit[1])
    all_bones = set()
    for g in a.geos.values():
        all_bones |= set(n for n in g.bone_names if n)
    for aid, (lab, an) in a.animations.items():
        where = "%s %s" % (lab, aid)
        if not aid.startswith("animation."):
            r.error("animation", where, "id must start with 'animation.'")
        if not isinstance(an, dict):
            r.error("animation", where, "must be an object")
            continue
        users = a.anim_used.get(aid, set())
        if not users and aid not in played:
            r.warn("animation", where, "not referenced by any client entity or script")
        loop = an.get("loop", False)
        if loop not in (True, False, "hold_on_last_frame"):
            r.error("animation", where, "loop must be true/false/\"hold_on_last_frame\" (got %r)" % (loop,))
        alen = an.get("animation_length")
        if alen is not None and not (is_num(alen) and alen >= 0):
            r.error("animation", where, "animation_length must be a non-negative number")
        geos, pe_names, se_names, locs = [], set(), set(), set()
        for eid in users:
            ce = a.client_entities[eid][1]
            geos += a.geos_for_entity(ce)
            p, s = _effect_names(ce.get("description", {}))
            pe_names |= p
            se_names |= s
        bones = a.bones_for(geos) if geos else all_bones
        locs = a.locators_for(geos) if geos else set().union(*[set(g.locators) for g in a.geos.values()]) \
            if a.geos else set()
        for bn, chans in (an.get("bones") or {}).items():
            if bones and bn not in bones:
                hint = close_match(bn, bones, 2, 3)
                r.error("animation", where, "bone '%s' not in geometry%s" % (bn, (" (did you mean %s?)" % hint)
                                                                            if hint else ""))
            if not isinstance(chans, dict):
                r.error("animation", where, "bone %s channels must be an object" % bn)
                continue
            for ch, val in chans.items():
                if ch not in ("rotation", "position", "scale", "relative_to"):
                    r.warn("animation", where, "bone %s unknown channel %s" % (bn, ch))
                    continue
                if ch == "relative_to":
                    continue
                _chk_channel(r, where, "%s.%s" % (bn, ch), val, ch == "scale", alen if loop is not True else None)
        for key, names in (("particle_effects", pe_names), ("sound_effects", se_names)):
            tl = an.get(key)
            if tl is None:
                continue
            if not isinstance(tl, dict):
                r.error("animation", where, "%s must be a {time: effect} object" % key)
                continue
            for t, effs in tl.items():
                try:
                    float(t)
                except ValueError:
                    r.error("animation", where, "%s time key %r is not a number" % (key, t))
                for e in effs if isinstance(effs, list) else [effs]:
                    if not isinstance(e, dict):
                        continue
                    en = e.get("effect")
                    if users and en not in names:
                        r.error("animation", where, "%s effect '%s' not declared in the client entity" % (key, en))
                    loc = e.get("locator")
                    if loc and locs and loc not in locs and loc not in bones:
                        r.error("animation", where, "locator '%s' not in geometry" % loc)
        tl = an.get("timeline")
        if tl is not None and not isinstance(tl, dict):
            r.error("animation", where, "timeline must be an object")
        if not users:
            check_molang_block(a, an, where, "animation")
    for aid in played:
        if a.known_animation(aid) is False:
            r.error("animation", "BP/scripts", "script plays %s which is not defined" % aid)


def _chk_channel(r, where, name, val, is_scale, alen):
    def chk_vec(v, ctx):
        if is_num(v) or isinstance(v, str):
            return
        if isinstance(v, list):
            if len(v) != 3 or not all(is_num(x) or isinstance(x, str) for x in v):
                r.error("animation", where, "%s%s must be 3 numbers/Molang strings (got %r)" % (name, ctx, v))
            return
        r.error("animation", where, "%s%s has invalid value %r" % (name, ctx, v))

    if isinstance(val, dict):
        for t, kv in val.items():
            try:
                tf = float(t)
            except ValueError:
                r.error("animation", where, "%s keyframe time %r is not a number" % (name, t))
                continue
            if alen is not None and is_num(alen) and tf > alen + 1e-6:
                r.warn("animation", where, "%s keyframe at %s s is after animation_length %s" % (name, t, alen))
            if isinstance(kv, dict) and any(k in kv for k in ("pre", "post", "lerp_mode")):
                for k in ("pre", "post"):
                    if k in kv:
                        chk_vec(kv[k], "@%s.%s" % (t, k))
                if kv.get("lerp_mode", "linear") not in ("linear", "catmullrom", "step"):
                    r.error("animation", where, "%s@%s lerp_mode invalid" % (name, t))
            else:
                chk_vec(kv, "@%s" % t)
    else:
        chk_vec(val, "")


@check("animation_controller", "initial_state + transitions target existing states, state animations are "
                               "entity animation keys, particle/sound effects + locators defined, unreachable states")
def check_animation_controllers(a):
    r = a.r
    for cid, (lab, ac) in a.acs.items():
        where = "%s %s" % (lab, cid)
        if not cid.startswith("controller.animation."):
            r.error("animation_controller", where, "id must start with 'controller.animation.'")
        if not isinstance(ac, dict):
            continue
        users = a.ac_used.get(cid, set())
        if not users:
            r.warn("animation_controller", where, "not used by any client entity")
        states = ac.get("states")
        if not isinstance(states, dict) or not states:
            r.error("animation_controller", where, "states must be a non-empty object")
            continue
        init = ac.get("initial_state", "default")
        if init not in states:
            r.error("animation_controller", where, "initial_state '%s' is not a state" % init)
        anim_keys, pe_names, se_names, geos = set(), set(), set(), []
        for eid in users:
            ce = a.client_entities[eid][1]
            d = ce.get("description", {})
            anim_keys |= set(d.get("animations", {}) or {})
            p, s = _effect_names(d)
            pe_names |= p
            se_names |= s
            geos += a.geos_for_entity(ce)
        locs, bones = a.locators_for(geos), a.bones_for(geos)
        reach = {init}
        frontier = [init]
        while frontier:
            s = frontier.pop()
            st = states.get(s, {})
            for tr in (st.get("transitions") or []) if isinstance(st, dict) else []:
                for tgt in (tr if isinstance(tr, dict) else {}):
                    if tgt in states and tgt not in reach:
                        reach.add(tgt)
                        frontier.append(tgt)
        for sn, st in states.items():
            sw = "%s state %s" % (where, sn)
            if not isinstance(st, dict):
                r.error("animation_controller", sw, "state must be an object")
                continue
            if sn not in reach:
                r.warn("animation_controller", sw, "state is unreachable from %s" % init)
            trs = st.get("transitions", [])
            if not isinstance(trs, list):
                r.error("animation_controller", sw, "transitions must be a list of {state: condition}")
                trs = []
            for tr in trs:
                if not isinstance(tr, dict) or len(tr) != 1:
                    r.error("animation_controller", sw, "each transition must be a single {state: condition}")
                    continue
                for tgt, cond in tr.items():
                    if tgt not in states:
                        r.error("animation_controller", sw, "transition to undefined state '%s'" % tgt)
                    if not isinstance(cond, (str, bool, int, float)):
                        r.error("animation_controller", sw, "transition condition must be Molang")
            for an in st.get("animations", []) or []:
                names = [an] if isinstance(an, str) else list(an) if isinstance(an, dict) else []
                for n in names:
                    if users and n not in anim_keys:
                        r.error("animation_controller", sw, "animation '%s' is not a key in the client entity "
                                                            "animations" % n)
            for key, names in (("particle_effects", pe_names), ("sound_effects", se_names)):
                effs = st.get(key, [])
                if not isinstance(effs, list):
                    r.error("animation_controller", sw, "%s must be a list" % key)
                    continue
                for e in effs:
                    if not isinstance(e, dict) or "effect" not in e:
                        r.error("animation_controller", sw, "%s entries need an 'effect'" % key)
                        continue
                    if users and e["effect"] not in names:
                        r.error("animation_controller", sw, "%s effect '%s' not declared in the client entity"
                                % (key, e["effect"]))
                    loc = e.get("locator")
                    if loc and geos and loc not in locs and loc not in bones:
                        r.error("animation_controller", sw, "locator '%s' not in geometry" % loc)
                    if e.get("bind_to_actor") is False and key == "particle_effects":
                        pass
        if not users:
            check_molang_block(a, ac, where, "animation_controller")


def _max_of(expr):
    if is_num(expr):
        return float(expr)
    if isinstance(expr, str):
        m = re.match(r"^\s*math\.random(?:_integer)?\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)\s*$", expr)
        if m:
            return max(float(m.group(1)), float(m.group(2)))
        try:
            return float(expr)
        except ValueError:
            return None
    return None


@check("particle", "particle ids unique, material, texture exists (+aspect), components known, literal UVs "
                   "inside the atlas, events, mobile budget, variables provided by spawner")
def check_particles(a):
    r = a.r
    provided = set(a.script_vars) | set(a.entity_effect_vars)
    script_spawned = set()
    for sc in a.scripts.values():
        for _, args, _ in sc.method_calls({"spawnParticle"}):
            lit = literal(args[0]) if args else None
            if lit and lit[0] == "str":
                script_spawned.add(lit[1])
        for t in sc.strings():
            if t.kind == "str" and t.value in a.particles:
                script_spawned.add(t.value)
    for pid, (lab, pe) in a.particles.items():
        where = "%s %s" % (lab, pid)
        if not NSID_RE.match(pid):
            r.error("particle", where, "identifier must be namespace:name")
        doc = a.data.get(lab, {})
        if doc.get("format_version") != "1.10.0":
            r.warn("particle", where, "format_version %r (vanilla particles use 1.10.0)" % doc.get("format_version"))
        brp = pe.get("description", {}).get("basic_render_parameters", {})
        mat = brp.get("material")
        if mat not in (a.ref.particle_materials if a.ref.ok else PARTICLE_MATERIALS):
            r.error("particle", where, "material %r is not a particle material" % (mat,))
        tex = brp.get("texture")
        found = a.ref_texture(tex, where, "particle") if tex is not None else None
        if tex is None:
            r.error("particle", where, "basic_render_parameters.texture missing")
        comps = pe.get("components", {})
        if not isinstance(comps, dict) or not comps:
            r.error("particle", where, "components must be a non-empty object")
            comps = {}
        known = a.ref.particle_components if a.ref.ok else set()
        for cn in comps:
            if known and cn not in known:
                r.warn("particle", where, "component %s is not used by any vanilla particle (typo?)" % cn)
        if not any(k.startswith("minecraft:emitter_lifetime") for k in comps):
            r.warn("particle", where, "no emitter_lifetime component (emitter may never expire)")
        if not any(k.startswith("minecraft:emitter_rate") for k in comps):
            r.error("particle", where, "no emitter_rate component (nothing is emitted)")
        # UVs
        img_wh = None
        if found and Image is not None and found.endswith(".png"):
            try:
                with Image.open(os.path.join(a.rp, found)) as im:
                    img_wh = im.size
            except Exception:
                img_wh = None
        for ak in ("minecraft:particle_appearance_billboard",):
            bb = comps.get(ak)
            if not isinstance(bb, dict):
                continue
            uv = bb.get("uv")
            if not isinstance(uv, dict):
                continue
            tw, th = uv.get("texture_width", 1), uv.get("texture_height", 1)
            if not (is_num(tw) and is_num(th) and tw > 0 and th > 0):
                r.error("particle", where, "uv texture_width/height must be positive numbers")
                continue
            if img_wh and abs(img_wh[0] / img_wh[1] - tw / th) > 1e-6:
                r.error("particle", where, "uv texture %gx%g aspect != image %dx%d" % (tw, th, img_wh[0], img_wh[1]))
            fb = uv.get("flipbook")
            if isinstance(fb, dict):
                base, size = fb.get("base_UV"), fb.get("size_UV")
                step = fb.get("step_UV", [0, 0])
                mf = fb.get("max_frame", 1)
                if (isinstance(base, list) and isinstance(size, list) and all(is_num(x) for x in base + size)
                        and isinstance(step, list) and all(is_num(x) for x in step) and is_num(mf)):
                    for fr in (0, int(mf) - 1):
                        u0, v0 = base[0] + step[0] * fr, base[1] + step[1] * fr
                        if u0 < 0 or v0 < 0 or u0 + size[0] > tw or v0 + size[1] > th:
                            r.error("particle", where, "flipbook frame %d UV outside %gx%g" % (fr, tw, th))
            else:
                u, us = uv.get("uv"), uv.get("uv_size")
                if isinstance(u, list) and isinstance(us, list) and len(u) == 2 and len(us) == 2:
                    for i, lim in ((0, tw), (1, th)):
                        if is_num(u[i]) and is_num(us[i]):
                            lo_, hi_ = sorted((u[i], u[i] + us[i]))
                            if lo_ < 0 or hi_ > lim + 1e-6:
                                r.error("particle", where, "uv %s outside 0..%g" % ("uv"[i], lim))
                        elif isinstance(u[i], str) and is_num(us[i]):
                            # ternary expressions: check every numeric literal candidate
                            for num in re.findall(r"(?<![\w.])(-?\d+(?:\.\d+)?)(?![\w.])", u[i]):
                                if float(num) + us[i] > lim + 1e-6 and float(num) != 0:
                                    r.warn("particle", where, "uv candidate %s + size %g exceeds %g" % (num, us[i], lim))
        # budget
        inst = comps.get("minecraft:emitter_rate_instant")
        if isinstance(inst, dict):
            n = _max_of(inst.get("num_particles"))
            if n is not None and n > 40:
                r.warn("particle", where, "emitter_rate_instant %g particles > 40 (mobile budget)" % n)
        steady = comps.get("minecraft:emitter_rate_steady")
        if isinstance(steady, dict):
            n = _max_of(steady.get("max_particles"))
            if n is not None and n > 100:
                r.warn("particle", where, "emitter_rate_steady max_particles %g > 100 (mobile budget)" % n)
        lt = comps.get("minecraft:particle_lifetime_expression")
        if isinstance(lt, dict):
            n = _max_of(lt.get("max_lifetime"))
            if n is None and isinstance(lt.get("max_lifetime"), str):
                nums = [float(x) for x in re.findall(r"(?<![\w.])(\d+(?:\.\d+)?)", lt["max_lifetime"])]
                n = max(nums) if nums else None
            if n is not None and n > 1.5 and pid in script_spawned:
                r.warn("particle", where, "max_lifetime up to %g s > 1.5 s (mobile budget)" % n)
        # events
        events = pe.get("events", {}) or {}
        for path, k, v in walk_json(comps):
            if k in ("creation_event", "expiration_event", "events") and path and \
                    any(str(p).endswith("_events") for p in path + (k,)):
                for ev in ([v] if isinstance(v, str) else v if isinstance(v, list) else []):
                    if isinstance(ev, str) and ev not in events:
                        r.error("particle", where, "event '%s' used but not defined in events" % ev)
            if k == "timeline" and isinstance(v, dict):
                for ev in v.values():
                    for e in ([ev] if isinstance(ev, str) else ev if isinstance(ev, list) else []):
                        if isinstance(e, str) and e not in events:
                            r.error("particle", where, "timeline event '%s' not defined" % e)
        for en, ev in events.items():
            if not isinstance(ev, dict):
                continue
            for _, k, v in walk_json(ev):
                if k == "effect" and isinstance(v, str) and a.known_particle(v) is False:
                    r.error("particle", where, "event %s spawns unknown particle %s" % (en, v))
                if k == "event_name" and isinstance(v, str):
                    a.sound_refs.add(v)
                    if a.known_sound(v) is False:
                        r.error("particle", where, "event %s plays unknown sound %s" % (en, v))
        # Molang + external variables
        reads, writes = check_molang_block(a, pe, where, "particle")
        for ck in (pe.get("curves") or {}):
            writes.add(ck.split(".", 1)[-1].lower())
        external = {v for v in reads - writes if not v.startswith(("particle_", "emitter_", "entity_scale"))}
        if pid in a.particles and (pid in script_spawned or pid in a.particle_used):
            for v in sorted(external):
                if v not in provided:
                    r.warn("particle", where, "reads variable.%s which no MolangVariableMap / pre_effect_script "
                           "provides (it will be 0)" % v)
        if pid not in script_spawned and pid not in a.particle_used:
            used_by_event = any(pid in json.dumps(p[1]) for q, p in a.particles.items() if q != pid)
            if not used_by_event:
                r.warn("particle", where, "not used by the client entity, scripts or other particles")


SOUND_EXTS = (".ogg", ".wav", ".fsb")


def ogg_info(path):
    with open(path, "rb") as f:
        data = f.read()
    if not data.startswith(b"OggS"):
        return {"error": "not an Ogg file (missing OggS header)"}
    if b"OpusHead" in data[:512]:
        return {"error": "Ogg Opus is not supported by Bedrock (use Vorbis)"}
    i = data.find(b"\x01vorbis")
    if i < 0:
        return {"error": "Ogg stream is not Vorbis"}
    try:
        _ver, ch, rate = struct.unpack_from("<IBI", data, i + 7)
    except struct.error:
        return {"error": "truncated Vorbis header"}
    last = data.rfind(b"OggS")
    gran = struct.unpack_from("<q", data, last + 6)[0] if last + 14 <= len(data) else 0
    return {"channels": ch, "rate": rate, "duration": (gran / rate) if rate and gran > 0 else None,
            "size": len(data)}


@check("sound", "sound_definitions structure + categories, every sound file exists and is valid Ogg Vorbis "
                "(mono/44.1 kHz expected), sounds.json events resolve, unused definitions/files")
def check_sounds(a):
    r = a.r
    sd_lab = a.label("RP", "sounds/sound_definitions.json")
    sd = a.get("RP", "sounds/sound_definitions.json")
    if a.exists("RP", "sounds/sound_definitions.json") and isinstance(sd, dict):
        if "sound_definitions" in sd and sd.get("format_version") is None:
            r.warn("sound", sd_lab, "no format_version (vanilla uses 1.20.20)")
    used_files = set()
    for sid, d in a.sound_defs.items():
        where = "%s %s" % (sd_lab, sid)
        if not isinstance(d, dict):
            r.error("sound", where, "definition must be an object")
            continue
        cat = d.get("category")
        if cat is not None and cat not in SOUND_CATEGORIES:
            r.error("sound", where, "category %r invalid (%s)" % (cat, ", ".join(sorted(SOUND_CATEGORIES))))
        if cat is None:
            r.warn("sound", where, "no category (defaults to neutral)")
        sounds = d.get("sounds")
        if not isinstance(sounds, list) or not sounds:
            r.error("sound", where, "sounds must be a non-empty list")
            continue
        for s in sounds:
            name = s if isinstance(s, str) else s.get("name") if isinstance(s, dict) else None
            if not isinstance(name, str):
                r.error("sound", where, "sound entry without a name: %r" % (s,))
                continue
            if isinstance(s, dict):
                for k in ("volume", "pitch", "weight"):
                    if k in s and not (is_num(s[k]) and s[k] >= 0):
                        r.error("sound", where, "%s must be a non-negative number" % k)
                for k in ("stream", "load_on_low_memory", "is3D"):
                    if k in s and not isinstance(s[k], bool):
                        r.error("sound", where, "%s must be a boolean" % k)
                if s.get("type") == "event":
                    continue
            hit = [name + e for e in SOUND_EXTS if a.exists("RP", name + e)]
            if os.path.splitext(name)[1].lower() in SOUND_EXTS and a.exists("RP", name):
                hit = [name]
            if not hit:
                r.error("sound", where, "file %s(.ogg/.wav/.fsb) not found (case-sensitive)" % name)
            used_files |= set(hit)
    sj = a.sounds_json
    sj_lab = a.label("RP", "sounds.json")
    if isinstance(sj, dict):
        for path, k, v in walk_json(sj):
            if k == "sound" and isinstance(v, str) and v:
                a.sound_refs.add(v)
                if a.known_sound(v) is False:
                    r.error("sound", sj_lab, "%s: sound id %s not in sound_definitions" % (fmt_path(path), v))
            elif isinstance(v, str) and path and path[-1] == "events" and v:
                a.sound_refs.add(v)
                if a.known_sound(v) is False:
                    r.error("sound", sj_lab, "%s.%s: sound id %s not in sound_definitions" % (fmt_path(path), k, v))
        ents = sj.get("entity_sounds", {}).get("entities", {}) if isinstance(sj.get("entity_sounds"), dict) else {}
        for eid in ents:
            if a.known_entity(eid) is False:
                r.warn("sound", sj_lab, "entity_sounds for unknown entity %s" % eid)
    # script + command references (collected by check_scripts which runs earlier)
    for sid in sorted(a.sound_defs):
        if sid not in a.sound_refs:
            r.warn("sound", sd_lab, "sound %s is never used (sounds.json, client entity, particles, scripts)" % sid)
    for f in a.files["RP"]:
        if os.path.splitext(f)[1].lower() in SOUND_EXTS:
            lab = a.label("RP", f)
            if f not in used_files:
                r.warn("sound", lab, "sound file not referenced by sound_definitions.json")
            full = os.path.join(a.rp, f)
            if f.lower().endswith(".ogg"):
                info = ogg_info(full)
                if "error" in info:
                    r.error("sound", lab, info["error"])
                    continue
                if info["channels"] != 1:
                    r.warn("sound", lab, "%d channels (mono is expected for positional sounds)" % info["channels"])
                if info["rate"] not in (44100, 48000, 22050, 32000):
                    r.warn("sound", lab, "unusual sample rate %d Hz" % info["rate"])
                elif info["rate"] != 44100:
                    r.info("sound", lab, "sample rate %d Hz (SPEC says 44.1 kHz)" % info["rate"])
                if info["duration"] and info["duration"] > 20:
                    r.warn("sound", lab, "%.1f s long - consider stream:true or shortening" % info["duration"])
                if info["size"] > 400 * 1024:
                    r.warn("sound", lab, "%d KB - large for a mobile add-on" % (info["size"] // 1024))
            elif f.lower().endswith(".wav"):
                with open(full, "rb") as fh:
                    head = fh.read(12)
                if not (head.startswith(b"RIFF") and head[8:12] == b"WAVE"):
                    r.error("sound", lab, "not a RIFF/WAVE file")


@check("texture", "every PNG decodes, power-of-two/size sanity, item_texture/terrain_texture paths exist, "
                  "entity textures match geometry UV aspect, unreferenced textures")
def check_textures(a):
    r = a.r
    if Image is None:
        r.warn("texture", "", "Pillow not installed - image checks skipped (pip install Pillow)")
    it_lab = a.label("RP", "textures/item_texture.json")
    it = a.get("RP", "textures/item_texture.json")
    if isinstance(it, dict):
        if it.get("texture_name") != "atlas.items":
            r.error("texture", it_lab, "texture_name must be \"atlas.items\"")
        if not isinstance(it.get("texture_data"), dict):
            r.error("texture", it_lab, "texture_data must be an object")
        for k, v in a.item_tex.items():
            paths = _texture_data_paths(v)
            if not paths:
                r.error("texture", it_lab, "%s has no textures path" % k)
            for p in paths:
                found = a.ref_texture(p, "%s %s" % (it_lab, k), "texture")
                if found and Image is not None and found.endswith(".png"):
                    try:
                        with Image.open(os.path.join(a.rp, found)) as im:
                            w, h = im.size
                        if w != h or w > 64:
                            r.warn("texture", a.label("RP", found), "item icon %dx%d (expected square, <= 64)" % (w, h))
                    except Exception:
                        pass
    tt = a.get("RP", "textures/terrain_texture.json")
    if isinstance(tt, dict):
        for k, v in a.terrain_tex.items():
            for p in _texture_data_paths(v):
                a.ref_texture(p, "%s %s" % (a.label("RP", "textures/terrain_texture.json"), k), "texture")
    # image sanity
    sizes = {}
    for pack in ("BP", "RP"):
        for f in a.files[pack]:
            if not f.lower().endswith(".png"):
                continue
            lab = a.label(pack, f)
            if Image is None:
                continue
            try:
                with Image.open(os.path.join(a.roots[pack], f)) as im:
                    im.verify()
                with Image.open(os.path.join(a.roots[pack], f)) as im:
                    sizes[(pack, f)] = (im.size, im.mode, im.info)
                    w, h = im.size
                    if im.mode not in ("RGBA", "RGB", "LA", "L", "P"):
                        r.warn("texture", lab, "unusual PNG mode %s" % im.mode)
                    if im.mode == "P":
                        r.info("texture", lab, "palette PNG (fine, RGBA is safest)")
                    if (w & (w - 1)) or (h & (h - 1)):
                        r.warn("texture", lab, "%dx%d is not power-of-two (mip-mapping/atlas issues on mobile)"
                               % (w, h))
                    if max(w, h) > 1024:
                        r.warn("texture", lab, "%dx%d is large for mobile GPUs" % (w, h))
            except Exception as e:
                r.error("texture", lab, "PNG cannot be decoded: %s" % e)
    # entity texture <-> geometry aspect
    for eid, (lab, ce) in a.client_entities.items():
        desc = ce.get("description", {})
        geos = a.geos_for_entity(ce)
        if not geos:
            continue
        for k, p in (desc.get("textures", {}) or {}).items():
            found = a.find_texture(p)
            if not found or ("RP", found) not in sizes:
                continue
            (w, h), _, _ = sizes[("RP", found)]
            for g in geos:
                if not (is_num(g.tw) and is_num(g.th)):
                    continue
                if abs(w / h - g.tw / g.th) > 1e-6:
                    r.error("texture", a.label("RP", found), "%dx%d does not match %s UV aspect %gx%g"
                            % (w, h, g.id, g.tw, g.th))
                elif w % g.tw:
                    r.warn("texture", a.label("RP", found), "%d px is not an integer multiple of %s "
                           "texture_width %g (blurry sampling)" % (w, g.id, g.tw))
                elif w < g.tw:
                    r.warn("texture", a.label("RP", found), "smaller than the geometry's UV space")
    # unreferenced textures
    referenced = set()
    for base in a.tex_refs:
        f = a.find_texture(base)
        if f:
            referenced.add(f)
    for f in a.files["RP"]:
        if not f.startswith("textures/") or not f.lower().endswith((".png", ".tga")):
            continue
        base = os.path.splitext(f)[0]
        if f in referenced or any(base.startswith(p) for p in a.tex_prefix_refs):
            continue
        r.warn("texture", a.label("RP", f), "texture is not referenced anywhere (dead weight in the pack)")


def _texture_data_paths(v):
    t = v.get("textures") if isinstance(v, dict) else v
    out = []
    for x in (t if isinstance(t, list) else [t]):
        if isinstance(x, str):
            out.append(x)
        elif isinstance(x, dict) and isinstance(x.get("path"), str):
            out.append(x["path"])
    return out


# ---------------------------------------------------------------- scripts
TYPED_RECEIVERS = {"world": "World", "system": "System", "dimension": "Dimension", "dim": "Dimension",
                   "player": "Player", "owner": "Player", "block": "Block", "entity": "Entity",
                   "guardian": "Entity"}
SIGNAL_CONTAINERS = {("world", "afterEvents"): "WorldAfterEvents", ("world", "beforeEvents"): "WorldBeforeEvents",
                     ("system", "afterEvents"): "SystemAfterEvents", ("system", "beforeEvents"): "SystemBeforeEvents"}


def check_command_text(a, text, where, chk, line=None):
    """Validate a slash-command string (placeholders = \\x00)."""
    r = a.r
    if not isinstance(text, str):
        return
    w = "%s%s" % (where, (" line %d" % line) if line else "")
    toks = text.strip().lstrip("/").split()
    if not toks:
        return
    cmd = toks[0].lower()
    if "\x00" in cmd:
        return
    if a.ref.ok and cmd not in a.ref.commands:
        hint = close_match(cmd, a.ref.commands, 2, 3)
        r.error(chk, w, "unknown command '/%s'%s" % (cmd, (" (did you mean %s?)" % hint) if hint else ""))
        return

    def tok(i):
        return toks[i] if i < len(toks) and "\x00" not in toks[i] else None

    def ns(x):
        return x if ":" in x else "minecraft:" + x

    if cmd == "execute":
        if " run " in text:
            check_command_text(a, text.split(" run ", 1)[1], where, chk, line)
    elif cmd == "setblock":
        b = tok(4)
        if b and a.ref.ok and ns(b.split("[")[0]) not in a.ref.blocks:
            r.error(chk, w, "setblock: unknown block %s" % b)
        last = tok(len(toks) - 1)
        if len(toks) >= 6 and last and last not in ("replace", "destroy", "keep") and not last.startswith("["):
            r.warn(chk, w, "setblock: last argument %r is not replace/destroy/keep" % last)
    elif cmd in ("clear", "give"):
        it = tok(2)
        if it and a.known_item(it) is False:
            r.error(chk, w, "%s: unknown item %s" % (cmd, it))
    elif cmd == "summon":
        e = tok(1)
        if e and a.known_entity(e) is False:
            r.error(chk, w, "summon: unknown entity %s" % e)
    elif cmd == "effect":
        e = tok(2)
        if e and e != "clear" and a.ref.ok and e.replace("minecraft:", "") not in a.ref.effects:
            r.error(chk, w, "effect: unknown effect %s" % e)
    elif cmd == "playsound":
        s = tok(1)
        if s:
            a.sound_refs.add(s)
            if a.known_sound(s) is False:
                r.error(chk, w, "playsound: unknown sound %s" % s)
    elif cmd == "particle":
        p = tok(1)
        if p and a.known_particle(p) is False:
            r.error(chk, w, "particle: unknown particle %s" % p)
    elif cmd == "playanimation":
        an = tok(2)
        if an and a.known_animation(an) is False:
            r.error(chk, w, "playanimation: unknown animation %s" % an)
    elif cmd == "scriptevent":
        sid = tok(1)
        if sid and ":" not in sid:
            r.error(chk, w, "scriptevent id %s must be namespaced" % sid)
    for m in re.finditer(r"(?<![\w.:])(ceg):([a-z0-9_]+)", text):
        _check_ns_literal(a, m.group(0), w, chk)


def _typed_ceg_ids(a):
    out = set(a.bp_entities) | set(a.items) | set(a.particles) | set(a.bp_props()) | a.bp_events()
    for _, ent in a.bp_entities.values():
        out |= set(ent.get("component_groups", {}) or {})
    return out


def _check_ns_literal(a, s, where, chk):
    r = a.r
    if s.startswith("ceg:"):
        typed = _typed_ceg_ids(a)
        if s in typed or s in SPEC["script_ids"] or s.endswith("_spawn_egg") and s[:-10] in a.bp_entities:
            return
        recipe_ids = set()
        for doc in a.recipes.values():
            for k, v in (doc or {}).items():
                if k.startswith("minecraft:recipe_") and isinstance(v, dict):
                    recipe_ids.add(v.get("description", {}).get("identifier"))
        if s in recipe_ids:
            return
        hint = close_match(s, typed, 2, 6)
        if hint:
            r.error(chk, where, "'%s' is not defined anywhere - typo of %s?" % (s, hint))
        else:
            r.warn(chk, where, "'%s' is not an entity/item/particle/property/event id (ok if it is a dynamic "
                               "property or /scriptevent id)" % s)
    elif s.startswith("minecraft:") and a.ref.ok:
        ref = a.ref
        if s in ref.items or s in ref.blocks or s in ref.entities or s in ref.particles or s in ref.dimensions \
                or s in ref.bp_events or s in a.bp_events() or s in ref.bp_components or s in ref.cooldowns:
            return
        comp_ids = set()
        for (mn, mv), mod in ref.api.items():
            if mn == "@minecraft/server" and mv == "1.10.0":
                comp_ids = mod.component_ids()
        if s in comp_ids or s.replace("minecraft:", "") in ref.effects:
            return
        hint = close_match(s, ref.items | ref.blocks | ref.entities, 2, 8)
        if hint:
            r.error(chk, where, "'%s' is not a vanilla 1.21.0 id - typo of %s?" % (s, hint))
        else:
            r.warn(chk, where, "'%s' is not a known vanilla 1.21.0 id" % s)


@check("script", "scripts lex + `node --check`, imports resolve (.js ext) and exist in @minecraft/server "
                 "1.10.0 / server-ui 1.1.0, event signals, enum members, API members (newer-API misuse), "
                 "events/properties/animations/particles/sounds/effects/items/entities/textures/commands "
                 "used by scripts exist")
def check_scripts(a):
    r = a.r
    bpm = a.manifest.get("BP") if isinstance(a.manifest.get("BP"), dict) else {}
    entry = None
    for mod in bpm.get("modules", []) or []:
        if isinstance(mod, dict) and mod.get("type") == "script":
            entry = (mod.get("entry") or "").lstrip("/")
    declared = {d.get("module_name"): d.get("version") for d in bpm.get("dependencies", []) or []
                if isinstance(d, dict) and d.get("module_name")}
    if not a.scripts:
        if entry:
            r.error("script", "BP/scripts", "manifest declares a script module but no .js files exist")
        return
    api = {}
    if a.ref.ok:
        for name, ver in declared.items():
            mod = a.ref.module(name, ver)
            if mod:
                api[name] = mod
            elif name in SCRIPT_MODULES:
                r.warn("script", "BP/manifest.json", "no API metadata for %s %s in the reference" % (name, ver))
    else:
        r.warn("script", "", "reference data missing: script API surface checks skipped")
    newer = [a.ref.module(n, v) for n, v in NEWER_API] if a.ref.ok else []
    newer = [m for m in newer if m]
    all_api_members = set()
    for m in api.values():
        all_api_members |= m.all_member_names()
    newer_members = set()
    for m in newer:
        newer_members |= m.all_member_names()
    newer_members -= all_api_members

    node = shutil.which("node")
    if not node:
        r.info("script", "", "node not found - syntax check skipped")
    graph = defaultdict(set)
    defined_idents = set()
    assigned_members = set()
    for sc in a.scripts.values():
        lst_all = list(all_tokens(sc.toks))
        for k, t in enumerate(lst_all):
            if t.kind != "ident":
                continue
            prev = lst_all[k - 1].value if k > 0 else None
            nxt = lst_all[k + 1].value if k + 1 < len(lst_all) else None
            if prev not in (".", "?."):
                defined_idents.add(t.value)
            elif nxt in ("=", "+=", "-=", "*=", "/=", "||=", "&&=", "??=", "++", "--"):
                assigned_members.add(t.value)
    script_known = defined_idents | assigned_members

    for rel, sc in sorted(a.scripts.items()):
        lab = sc.label
        if sc.error:
            r.error("script", lab, "cannot tokenize: %s" % sc.error)
            continue
        if node:
            _node_check(a, sc, node)
        # imports ----------------------------------------------------------
        imported = {}   # local name -> (module, export name or '*')
        toks = sc.toks
        for k, t in enumerate(toks):
            if t.kind != "ident" or t.value not in ("import", "export") or (k > 0 and toks[k - 1].value in (".", "?.")):
                continue
            if t.value == "import" and k + 1 < len(toks) and toks[k + 1].value == "(":
                args = split_args(toks, k + 1)
                lit = literal(args[0]) if args else None
                if lit and lit[0] == "str":
                    _resolve_import(a, sc, lit[1], t.line, declared, graph)
                continue
            if t.value == "import" and k + 1 < len(toks) and toks[k + 1].kind == "str":
                _resolve_import(a, sc, toks[k + 1].value, t.line, declared, graph)
                continue
            j = k + 1
            clause = []
            while j < len(toks) and not (toks[j].kind == "ident" and toks[j].value == "from") \
                    and toks[j].value != ";" and j - k < 200:
                clause.append(toks[j])
                j += 1
            if j < len(toks) and toks[j].value == "from" and j + 1 < len(toks) and toks[j + 1].kind == "str":
                spec = toks[j + 1].value
                _resolve_import(a, sc, spec, t.line, declared, graph)
                if t.value == "import":
                    for local, exp in _parse_import_clause(clause):
                        imported[local] = (spec, exp)
                        mod = api.get(spec)
                        if exp == "default" and spec.startswith("@minecraft/"):
                            r.error("script", lab, "line %d: @minecraft modules have no default export" % t.line)
                        elif mod and exp not in ("*", "default"):
                            if exp in mod.ts_only():
                                r.error("script", lab, "line %d: '%s' is a TypeScript-only interface/type in %s - "
                                        "importing it fails at load time" % (t.line, exp, spec))
                            elif exp not in mod.exports():
                                newer_has = any(exp in m.exports() for m in newer if m.name == spec)
                                r.error("script", lab, "line %d: %s does not export '%s' in %s%s"
                                        % (t.line, spec, exp, mod.version,
                                           " (it exists only in newer versions)" if newer_has else ""))
        # event signals / enum members / receivers / members ----------------
        guarded = {t.value for t in sc.strings()}
        lst_iter = list(token_lists(sc.toks))
        for lst in lst_iter:
            for k, t in enumerate(lst):
                if t.kind != "ident":
                    continue
                prev = lst[k - 1].value if k > 0 else None
                nxt = lst[k + 1].value if k + 1 < len(lst) else None
                # signals: world.afterEvents.X
                if (t.value in ("afterEvents", "beforeEvents") and prev in (".", "?.") and k >= 2
                        and lst[k - 2].kind == "ident" and nxt in (".", "?.") and k + 2 < len(lst)
                        and lst[k + 2].kind == "ident"):
                    owner = lst[k - 2].value
                    cname = SIGNAL_CONTAINERS.get((owner, t.value))
                    srv = api.get("@minecraft/server")
                    if cname and srv:
                        sig = lst[k + 2].value
                        if cname not in srv.classes:
                            r.error("script", lab, "line %d: %s.%s does not exist in @minecraft/server %s"
                                    % (t.line, owner, t.value, srv.version))
                        elif sig not in srv.members_of(cname):
                            nn = any(sig in m.members_of(cname) for m in newer)
                            r.error("script", lab, "line %d: %s.%s.%s is not available in @minecraft/server %s%s"
                                    % (t.line, owner, t.value, sig, srv.version,
                                       " (newer API only)" if nn else ""))
                if prev in (".", "?."):
                    continue
                # Enum / class static members on imported names
                if t.value in imported and nxt == "." and k + 2 < len(lst) and lst[k + 2].kind == "ident":
                    spec, exp = imported[t.value]
                    mod = api.get(spec)
                    member = lst[k + 2].value
                    if mod and exp == "*":
                        if member not in mod.exports():
                            r.error("script", lab, "line %d: %s.%s is not exported by %s %s"
                                    % (t.line, t.value, member, spec, mod.version))
                    elif mod and exp in mod.enums:
                        if member not in mod.enums[exp]:
                            r.error("script", lab, "line %d: %s.%s is not a member of enum %s in %s %s"
                                    % (t.line, t.value, member, exp, spec, mod.version))
                    elif mod and exp in mod.classes and member not in ("prototype", "name"):
                        if member not in mod.classes[exp]["static"]:
                            r.error("script", lab, "line %d: %s.%s is not a static member of %s"
                                    % (t.line, t.value, member, exp))
                # new X()
                if t.value == "new" and nxt in imported:
                    spec, exp = imported[nxt]
                    mod = api.get(spec)
                    if mod and exp in mod.classes and not mod.classes[exp]["ctor"]:
                        r.error("script", lab, "line %d: %s has no constructor in %s %s (cannot use new)"
                                % (t.line, exp, spec, mod.version))
        srv = api.get("@minecraft/server")
        if srv:
            for lst in lst_iter:
                for k, t in enumerate(lst):
                    if t.kind != "ident" or k + 2 >= len(lst) or lst[k + 1].value not in (".", "?.") \
                            or lst[k + 2].kind != "ident":
                        continue
                    cls = TYPED_RECEIVERS.get(t.value)
                    if t.value == "world" and "world" not in imported:
                        cls = None
                    if t.value == "system" and "system" not in imported:
                        cls = None
                    if not cls:
                        continue
                    member = lst[k + 2].value
                    if member in ("afterEvents", "beforeEvents") and cls in ("World", "System"):
                        pass
                    members = srv.members_of(cls)
                    if cls == "Entity":
                        members = members | srv.members_of("Player")
                    if member in members or member in assigned_members or member in JS_BUILTIN_MEMBERS:
                        continue
                    nmembers = set()
                    for m in newer:
                        nmembers |= m.members_of(cls)
                    if member in nmembers:
                        lvl = "warning" if (member in guarded or _typeof_guarded(lst, member)) else "error"
                        r.add(lvl, "script", lab, "line %d: %s.%s does not exist on %s in @minecraft/server %s "
                              "(newer API only)%s" % (t.line, t.value, member, cls, srv.version,
                                                     " - feature-detected" if lvl == "warning" else ""))
                    else:
                        r.warn("script", lab, "line %d: %s.%s is not a member of %s in @minecraft/server %s"
                               % (t.line, t.value, member, cls, srv.version))
            # global member names
            for lst in lst_iter:
                for k, t in enumerate(lst):
                    if t.kind != "ident" or k == 0 or lst[k - 1].value not in (".", "?."):
                        continue
                    m = t.value
                    if m in all_api_members or m in JS_BUILTIN_MEMBERS or m in script_known:
                        continue
                    if m in newer_members:
                        lvl = "warning" if (m in guarded or _typeof_guarded(lst, m)) else "error"
                        r.add(lvl, "script", lab, "line %d: .%s exists only in newer @minecraft API versions%s"
                              % (t.line, m, " - feature-detected" if lvl == "warning" else ""))
                    else:
                        r.warn("script", lab, "line %d: .%s is not an API member, JS builtin or script-defined "
                                              "name (typo?)" % (t.line, m))
        _check_script_literals(a, sc)
    # reachability
    if entry and entry in a.scripts:
        seen, stack = {entry}, [entry]
        while stack:
            cur = stack.pop()
            for nxt in graph.get(cur, ()):
                if nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
        for rel in a.scripts:
            if rel not in seen:
                r.warn("script", a.label("BP", rel), "not imported (directly or indirectly) by %s" % entry)
    # dynamic properties
    setk, getk = set(), set()
    for sc in a.scripts.values():
        for name, args, line in sc.method_calls({"setDynamicProperty", "getDynamicProperty"}):
            lit = literal(args[0]) if args else None
            if lit and lit[0] == "str":
                (setk if name == "setDynamicProperty" else getk).add((lit[1], sc.label, line))
    set_names = {x[0] for x in setk}
    for name, lab, line in sorted(getk):
        if name not in set_names:
            r.warn("script", lab, "line %d: dynamic property '%s' is read but never written" % (line, name))


def _typeof_guarded(lst, member):
    for k, t in enumerate(lst):
        if t.kind == "ident" and t.value == "typeof":
            for j in range(k + 1, min(k + 8, len(lst))):
                if lst[j].kind == "ident" and lst[j].value == member:
                    return True
        if t.kind == "str" and t.value == member and k + 1 < len(lst) and lst[k + 1].value == "in":
            return True
    return False


def _parse_import_clause(clause):
    out = []
    i = 0
    while i < len(clause):
        t = clause[i]
        if t.value == "*" and i + 2 < len(clause) and clause[i + 1].value == "as":
            out.append((clause[i + 2].value, "*"))
            i += 3
            continue
        if t.value == "{":
            j = i + 1
            while j < len(clause) and clause[j].value != "}":
                if clause[j].kind in ("ident", "str"):
                    exp = clause[j].value
                    local = exp
                    if j + 2 < len(clause) and clause[j + 1].value == "as":
                        local = clause[j + 2].value
                        j += 2
                    if exp != "type":
                        out.append((local, exp))
                    elif j + 1 < len(clause) and clause[j + 1].kind == "ident":
                        pass
                j += 1
            i = j + 1
            continue
        if t.kind == "ident" and t.value not in ("type",):
            out.append((t.value, "default"))
        i += 1
    return out


def _resolve_import(a, sc, spec, line, declared, graph):
    r = a.r
    lab = sc.label
    if spec.startswith("."):
        if not spec.endswith(".js"):
            r.error("script", lab, "line %d: relative import '%s' must include the .js extension (Bedrock does not "
                                   "resolve extensions)" % (line, spec))
            target = spec + ".js"
        else:
            target = spec
        path = os.path.normpath(os.path.join(os.path.dirname(sc.rel), target)).replace(os.sep, "/")
        if path not in a.scripts:
            r.error("script", lab, "line %d: import '%s' does not resolve (looked for BP/%s, case-sensitive)"
                    % (line, spec, path))
        else:
            graph[sc.rel].add(path)
    elif spec.startswith("/"):
        r.error("script", lab, "line %d: absolute import '%s' is not supported" % (line, spec))
    else:
        if spec not in declared:
            r.error("script", lab, "line %d: imports '%s' which is not a dependency in the BP manifest"
                    % (line, spec))


def _node_check(a, sc, node):
    tmpdir = tempfile.mkdtemp(prefix="ceg_validate_")
    try:
        p = os.path.join(tmpdir, "check.mjs")
        with open(p, "w", encoding="utf-8") as f:
            f.write(sc.src)
        try:
            res = subprocess.run([node, "--check", p], capture_output=True, text=True, timeout=30)
        except (OSError, subprocess.TimeoutExpired) as e:
            a.r.info("script", sc.label, "node --check could not run: %s" % e)
            return
        if res.returncode != 0:
            msg = (res.stderr or res.stdout).strip().replace(p, sc.label)
            lines = [l for l in msg.splitlines() if l.strip()]
            a.r.error("script", sc.label, "syntax error (node --check): %s" % " | ".join(lines[:4]))
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _match_template(value, candidates):
    rx = template_regex(value)
    return [c for c in candidates if rx.match(c)]


def _check_script_literals(a, sc):
    r = a.r
    lab = sc.label
    props = a.bp_props()
    events = a.bp_events()

    def where(line):
        return "%s line %d" % (lab, line)

    def first(args):
        return literal(args[0]) if args else None

    def check_id(lit, line, what, known_fn, candidates):
        if not lit:
            return
        kind, val, _ = lit
        if kind == "str":
            k = known_fn(val)
            if k is False:
                hint = close_match(val, candidates)
                r.error("script", where(line), "%s '%s' is not defined%s" % (what, val,
                                                                           (" (did you mean %s?)" % hint) if hint else ""))
        elif kind == "tmpl":
            if not _match_template(val, candidates):
                r.error("script", where(line), "%s template `%s` matches no defined id"
                        % (what, val.replace("\x00", "${...}")))

    for name, args, line in sc.method_calls({"triggerEvent"}):
        check_id(first(args), line, "entity event", lambda v: v in events or (
            a.ref.ok and v.startswith("minecraft:") and v in a.ref.bp_events) or (False if a.bp_entities else None),
            events)
    for name, args, line in sc.method_calls({"setProperty", "getProperty", "resetProperty"}):
        lit = first(args)
        check_id(lit, line, "entity property", lambda v: (v in props) if a.bp_entities else None, props)
        if name == "setProperty" and lit and lit[0] == "str" and lit[1] in props and len(args) > 1:
            vl = literal(args[1])
            pd = props[lit[1]] if isinstance(props[lit[1]], dict) else {}
            if vl:
                t = pd.get("type")
                if t == "bool" and vl[0] != "bool":
                    r.error("script", where(line), "setProperty('%s') is bool but given %r" % (lit[1], vl[1]))
                elif t in ("int", "float"):
                    if vl[0] != "num":
                        r.error("script", where(line), "setProperty('%s') is %s but given %r" % (lit[1], t, vl[1]))
                    else:
                        rng = pd.get("range")
                        if isinstance(rng, list) and len(rng) == 2 and not (rng[0] <= vl[1] <= rng[1]):
                            r.error("script", where(line), "setProperty('%s', %g) outside range %r"
                                    % (lit[1], vl[1], rng))
                elif t == "enum" and vl[0] == "str" and vl[1] not in (pd.get("values") or []):
                    r.error("script", where(line), "setProperty('%s', '%s') not an enum value" % (lit[1], vl[1]))
    for name, args, line in sc.method_calls({"playAnimation"}):
        check_id(first(args), line, "animation", a.known_animation, set(a.animations) | set(a.acs))
    for name, args, line in sc.method_calls({"spawnParticle"}):
        lit = first(args)
        check_id(lit, line, "particle", a.known_particle, set(a.particles))
        if lit and lit[0] == "str":
            a.particle_used.add(lit[1])
    for name, args, line in sc.method_calls({"playSound", "queueMusic", "playMusic"}):
        lit = first(args)
        if lit and lit[0] == "str":
            a.sound_refs.add(lit[1])
        elif lit and lit[0] == "tmpl":
            a.sound_refs |= set(_match_template(lit[1], a.sound_defs))
        check_id(lit, line, "sound", a.known_sound, set(a.sound_defs))
    for name, args, line in sc.method_calls({"addEffect", "removeEffect", "getEffect"}):
        lit = first(args)
        if lit and lit[0] == "str" and a.ref.ok:
            e = lit[1].replace("minecraft:", "")
            if e not in a.ref.effects:
                hint = close_match(e, a.ref.effects, 2, 4)
                r.error("script", where(line), "%s('%s'): unknown effect%s" % (name, lit[1],
                                                                           (" (did you mean %s?)" % hint) if hint else ""))
    for name, args, line in sc.method_calls({"spawnEntity"}):
        check_id(first(args), line, "entity type", a.known_entity,
                 set(a.bp_entities) | (a.ref.entities if a.ref.ok else set()))
    for name, args, line in sc.new_calls({"ItemStack"}):
        check_id(first(args), line, "item type", a.known_item,
                 set(a.items) | (a.ref.items if a.ref.ok else set()))
    comp_ids = set()
    if a.ref.ok:
        srv = a.ref.module("@minecraft/server", SCRIPT_MODULES["@minecraft/server"])
        comp_ids = srv.component_ids() if srv else set()
    for name, args, line in sc.method_calls({"getComponent", "hasComponent"}):
        lit = first(args)
        if lit and lit[0] == "str" and comp_ids:
            v = lit[1] if ":" in lit[1] else "minecraft:" + lit[1]
            if v not in comp_ids:
                r.error("script", where(line), "%s('%s'): no such component in @minecraft/server %s (returns "
                                               "undefined)" % (name, lit[1], SCRIPT_MODULES["@minecraft/server"]))
    for name, args, line in sc.method_calls({"runCommand", "runCommandAsync"}):
        lit = first(args)
        if lit and lit[0] in ("str", "tmpl"):
            check_command_text(a, lit[1], lab, "script", line)
    for name, args, line in sc.method_calls({"hasTypeFamily"}):
        lit = first(args)
        if lit and lit[0] == "str" and a.ref.ok:
            fams = set(a.ref.families)
            for _, ent in a.bp_entities.values():
                for c in [ent.get("components", {})] + list((ent.get("component_groups") or {}).values()):
                    fams |= set((c or {}).get("minecraft:type_family", {}).get("family", []) or [])
            if lit[1] not in fams:
                r.warn("script", where(line), "family '%s' is not used by any entity" % lit[1])
    for name, args, line in sc.method_calls({"setColorRGB", "setColorRGBA", "setFloat", "setVector3",
                                             "setSpeedAndDirection"}):
        lit = first(args)
        if lit and lit[0] == "str":
            v = lit[1]
            if not v.startswith("variable."):
                r.error("script", where(line), "%s('%s'): Molang variable names must start with 'variable.'"
                        % (name, v))
            a.script_vars.add(v.split(".", 1)[-1].lower())
    # families / types in entity query option objects
    fams_known = set(a.ref.families) if a.ref.ok else set()
    for _, ent in a.bp_entities.values():
        for c in [ent.get("components", {})] + list((ent.get("component_groups") or {}).values()):
            fams_known |= set((c or {}).get("minecraft:type_family", {}).get("family", []) or [])
    for lst in token_lists(sc.toks):
        for k, t in enumerate(lst):
            if t.kind == "ident" and t.value in ("families", "excludeFamilies", "type", "excludeTypes") \
                    and k + 2 < len(lst) and lst[k + 1].value == ":":
                vals = []
                if lst[k + 2].kind == "str":
                    vals = [lst[k + 2].value]
                elif lst[k + 2].value == "[":
                    j = k + 3
                    while j < len(lst) and lst[j].value != "]":
                        if lst[j].kind == "str":
                            vals.append(lst[j].value)
                        j += 1
                for v in vals:
                    if t.value in ("families", "excludeFamilies"):
                        if a.ref.ok and v not in fams_known:
                            r.warn("script", where(t.line), "family '%s' is not used by any entity" % v)
                    elif a.known_entity(v) is False:
                        r.error("script", where(t.line), "%s: unknown entity type '%s'" % (t.value, v))
    # catch-all literals
    for t in sc.strings():
        val = t.value
        if t.kind == "tmpl":
            head = t.parts[0]
            if head.startswith("textures/"):
                prefix = head
                a.tex_prefix_refs.add(prefix)
                if not any(f.startswith(prefix) and f.endswith((".png", ".tga")) for f in a.files["RP"]):
                    r.error("script", where(t.line), "texture template `%s` matches no file in the RP"
                            % val.replace("\x00", "${...}"))
            if re.match(r"^ceg:[a-z0-9_]*$", head):
                pool = _typed_ceg_ids(a) | set(SPEC["script_ids"])
                if not _match_template(val, pool) and not re.match(r"^ceg:\x00$", val):
                    r.error("script", where(t.line), "template `%s` matches no defined ceg: id"
                            % val.replace("\x00", "${...}"))
            if head.startswith("minecraft:") and len(head) > 10 and a.ref.ok:
                pool = a.ref.items | a.ref.blocks | a.ref.entities
                if not _match_template(val, pool):
                    r.info("script", where(t.line), "template `%s` matches no vanilla 1.21.0 id (fine if it "
                           "targets newer versions)" % val.replace("\x00", "${...}"))
            if head.startswith("ceg.guardian.") or head.startswith("animation.") and head.count(".") > 1:
                pool = set(a.sound_defs) if head.startswith("ceg.guardian.") else set(a.animations)
                if not _match_template(val, pool):
                    r.error("script", where(t.line), "template `%s` matches no defined id"
                            % val.replace("\x00", "${...}"))
                elif head.startswith("ceg.guardian."):
                    a.sound_refs |= set(_match_template(val, pool))
            continue
        if val.startswith("textures/") and " " not in val:
            a.ref_texture(val, where(t.line), "script")
        elif re.match(r"^ceg\.guardian\.[a-z0-9_.]+$", val):
            a.sound_refs.add(val)
            if val not in a.sound_defs:
                hint = close_match(val, a.sound_defs)
                r.error("script", where(t.line), "sound id '%s' not in sound_definitions%s"
                        % (val, (" (did you mean %s?)" % hint) if hint else ""))
        elif re.match(r"^(animation|controller\.animation)\.[\w.]+$", val):
            if a.known_animation(val) is False:
                hint = close_match(val, set(a.animations) | set(a.acs))
                r.error("script", where(t.line), "animation id '%s' not defined%s"
                        % (val, (" (did you mean %s?)" % hint) if hint else ""))
        elif re.match(r"^(ceg|minecraft):[a-z0-9_.]+$", val):
            _check_ns_literal(a, val, where(t.line), "script")
        elif val.startswith("loot_tables/") and val.endswith(".json"):
            a.loot_refs.add(val)
            if not a.exists("BP", val):
                r.error("script", where(t.line), "loot table %s not found" % val)
        elif re.match(r"^/?(loot|setblock|fill|summon|effect|clear|give|playsound|particle|tp|teleport|execute|"
                      r"camerashake|scriptevent|kill|tag|playanimation) ", val):
            pass  # validated at call sites; free-floating command strings are checked below
    for t in sc.strings():
        if t.kind == "str" and re.match(r"^/?(setblock|summon|effect|clear|give|playsound|particle|playanimation) ",
                                        t.value):
            check_command_text(a, t.value, lab, "script", t.line)


@check("function", "mcfunction command names and ids (if any .mcfunction files exist)")
def check_functions(a):
    for rel, text in a.functions.items():
        for n, line in enumerate(text.splitlines(), 1):
            s = line.strip()
            if s and not s.startswith("#"):
                check_command_text(a, s, a.label("BP", rel), "function", n)


@check("spec", "build contract from docs/SPEC.md: uuids, ids, properties, events, health groups, families, "
               "items, recipes, loot, geometry bones, textures, animations, particles, sounds, UI icons, lang")
def check_spec(a):
    if not a.spec:
        return
    r, S = a.r, SPEC
    for pack, hu, mods in (("BP", S["bp_uuid"], S["bp_modules"]), ("RP", S["rp_uuid"], S["rp_modules"])):
        m = a.manifest.get(pack)
        lab = a.label(pack, "manifest.json")
        if not isinstance(m, dict):
            r.error("spec", lab, "manifest missing")
            continue
        h = m.get("header", {}) or {}
        if h.get("uuid") != hu:
            r.error("spec", lab, "header uuid %r != SPEC %s" % (h.get("uuid"), hu))
        if h.get("version") != S["version"]:
            r.error("spec", lab, "header version %r != SPEC %r" % (h.get("version"), S["version"]))
        if h.get("min_engine_version") != S["min_engine_version"]:
            r.error("spec", lab, "min_engine_version %r != SPEC %r" % (h.get("min_engine_version"),
                                                                      S["min_engine_version"]))
        if h.get("name") != "pack.name" or h.get("description") != "pack.description":
            r.warn("spec", lab, "SPEC: header name/description should be the lang keys pack.name / pack.description")
        for t, u in mods.items():
            got = [x.get("uuid") for x in m.get("modules", []) or [] if isinstance(x, dict) and x.get("type") == t]
            if got != [u]:
                r.error("spec", lab, "%s module uuid %r != SPEC %s" % (t, got, u))
            for x in m.get("modules", []) or []:
                if isinstance(x, dict) and x.get("type") == t and x.get("version") != S["version"]:
                    r.error("spec", lab, "%s module version %r != SPEC %r" % (t, x.get("version"), S["version"]))
        if pack == "BP":
            ent = [x.get("entry") for x in m.get("modules", []) or [] if isinstance(x, dict) and x.get("type") == "script"]
            if ent != [S["script_entry"]]:
                r.error("spec", lab, "script entry %r != SPEC %s" % (ent, S["script_entry"]))
    for pack in ("BP", "RP"):
        en = a.lang[pack].get("en_US", {})
        for k in ("pack.name", "pack.description"):
            if k not in en:
                r.error("spec", a.label(pack, "texts/en_US.lang"), "missing %s" % k)
        lj = a.get(pack, "texts/languages.json")
        if lj != ["en_US"]:
            r.warn("spec", a.label(pack, "texts/languages.json"), "SPEC expects [\"en_US\"] (got %r)" % (lj,))
    # entity
    eid = S["entity"]
    if eid not in a.bp_entities:
        r.error("spec", "BP/entities/eyeball_guardian.json", "BP entity %s missing" % eid)
    else:
        lab, ent = a.bp_entities[eid]
        if lab != "BP/entities/eyeball_guardian.json":
            r.warn("spec", lab, "SPEC file name is BP/entities/eyeball_guardian.json")
        doc = a.data.get(lab, {})
        if doc.get("format_version") not in ("1.21.0", "1.20.80"):
            r.warn("spec", lab, "format_version %r (SPEC: 1.21.0, fallback 1.20.80)" % doc.get("format_version"))
        desc = ent.get("description", {})
        for k, v in (("is_spawnable", True), ("is_summonable", True), ("is_experimental", False)):
            if desc.get(k) is not v:
                r.error("spec", lab, "description.%s must be %s" % (k, str(v).lower()))
        props = desc.get("properties", {}) or {}
        for pn, (t, rng, dflt) in S["properties"].items():
            pd = props.get(pn)
            if not isinstance(pd, dict):
                r.error("spec", lab, "property %s missing" % pn)
                continue
            if pd.get("type") != t:
                r.error("spec", lab, "property %s type %r != %s" % (pn, pd.get("type"), t))
            if rng is not None and pd.get("range") != rng:
                r.error("spec", lab, "property %s range %r != %r" % (pn, pd.get("range"), rng))
            if pd.get("default") != dflt:
                r.error("spec", lab, "property %s default %r != %r" % (pn, pd.get("default"), dflt))
            if pd.get("client_sync") is not True:
                r.error("spec", lab, "property %s needs client_sync: true (render controllers read it)" % pn)
        groups = ent.get("component_groups", {}) or {}
        for lvl, hp in S["level_health"].items():
            g = groups.get("ceg:lvl_%d" % lvl)
            if not isinstance(g, dict):
                r.error("spec", lab, "component group ceg:lvl_%d missing" % lvl)
                continue
            h = g.get("minecraft:health")
            if not (isinstance(h, dict) and h.get("value") == hp and h.get("max") == hp):
                r.error("spec", lab, "ceg:lvl_%d must contain minecraft:health {value:%d,max:%d} (got %r)"
                        % (lvl, hp, hp, h))
            if set(g) - {"minecraft:health"}:
                r.warn("spec", lab, "ceg:lvl_%d contains more than minecraft:health: %s" % (lvl, sorted(g)))
        if "minecraft:instant_despawn" not in (groups.get("ceg:despawn") or {}):
            r.error("spec", lab, "component group ceg:despawn with minecraft:instant_despawn missing")
        comps = ent.get("components", {}) or {}
        if "minecraft:health" in comps:
            r.error("spec", lab, "minecraft:health must live only in the ceg:lvl_N groups (SPEC 3.2)")
        evs = ent.get("events", {}) or {}
        for ev in S["events"]:
            if ev not in evs:
                r.error("spec", lab, "event %s missing" % ev)
        for n in range(1, 6):
            body = evs.get("ceg:set_level_%d" % n)
            if not isinstance(body, dict):
                continue
            adds = (body.get("add") or {}).get("component_groups", [])
            rems = (body.get("remove") or {}).get("component_groups", [])
            sp = body.get("set_property", {}) or {}
            if adds != ["ceg:lvl_%d" % n]:
                r.error("spec", lab, "ceg:set_level_%d must add [ceg:lvl_%d] (got %r)" % (n, n, adds))
            if sorted(rems) != sorted("ceg:lvl_%d" % i for i in range(1, 6) if i != n):
                r.error("spec", lab, "ceg:set_level_%d must remove the other 4 level groups (got %r)" % (n, rems))
            if sp.get("ceg:level") != n:
                r.error("spec", lab, "ceg:set_level_%d must set ceg:level = %d" % (n, n))
        for ev, val in (("ceg:rage_on", True), ("ceg:rage_off", False)):
            body = evs.get(ev)
            if isinstance(body, dict) and (body.get("set_property") or {}).get("ceg:rage") is not val:
                r.error("spec", lab, "%s must set ceg:rage = %s" % (ev, str(val).lower()))
        spawned = evs.get("minecraft:entity_spawned")
        if isinstance(spawned, dict) and "ceg:lvl_1" not in ((spawned.get("add") or {}).get("component_groups") or []):
            r.error("spec", lab, "minecraft:entity_spawned must add ceg:lvl_1")
        fam = (comps.get("minecraft:type_family") or {}).get("family", [])
        for f in S["families_required"]:
            if f not in fam:
                r.error("spec", lab, "type_family must include %s" % f)
        for f in S["families_forbidden"]:
            if f in fam:
                r.error("spec", lab, "type_family must NOT include %s" % f)
        phys = comps.get("minecraft:physics") or {}
        if phys.get("has_gravity") is not False:
            r.error("spec", lab, "minecraft:physics.has_gravity must be false")
        cb = comps.get("minecraft:collision_box") or {}
        if cb.get("width") != 0.9 or cb.get("height") != 1.0:
            r.warn("spec", lab, "collision_box %r != width 0.9 height 1.0" % cb)
        for c in list(comps) + [c for g in groups.values() if isinstance(g, dict) for c in g]:
            if c.startswith("minecraft:behavior.") or c.startswith("minecraft:navigation.") \
                    or c.startswith("minecraft:movement.") or c == "minecraft:follow_range":
                r.warn("spec", lab, "SPEC 3.3 says no AI goals / navigation / move control (found %s)" % c)
        for c in ("minecraft:persistent", "minecraft:fire_immune", "minecraft:can_fly", "minecraft:breathable",
                  "minecraft:damage_sensor", "minecraft:knockback_resistance", "minecraft:pushable",
                  "minecraft:nameable", "minecraft:ambient_sound_interval", "minecraft:loot",
                  "minecraft:conditional_bandwidth_optimization", "minecraft:movement", "minecraft:flying_speed"):
            if c not in comps:
                r.warn("spec", lab, "SPEC 3.3 component %s missing" % c)
        br = comps.get("minecraft:breathable") or {}
        if br and not (br.get("breathes_water") is True and br.get("breathes_air") is True
                       and br.get("suffocate_time") == 0):
            r.warn("spec", lab, "minecraft:breathable should never suffocate/drown (SPEC 3.3)")
        loot = (comps.get("minecraft:loot") or {}).get("table")
        if loot != S["loot_table"]:
            r.error("spec", lab, "minecraft:loot.table %r != %s" % (loot, S["loot_table"]))
        ds = json.dumps(comps.get("minecraft:damage_sensor", {}))
        for cause in ("fall", "suffocation", "drowning", "fire", "fire_tick", "lava", "magma", "fly_into_wall",
                      "freezing", "contact", "entity_explosion", "block_explosion"):
            if '"%s"' % cause not in ds:
                r.warn("spec", lab, "damage_sensor does not mention cause %s (SPEC 3.3)" % cause)
        if '"player"' not in ds:
            r.warn("spec", lab, "damage_sensor should block damage from family player (SPEC 3.3)")
    # loot table
    lt = a.loot.get(S["loot_table"])
    if lt is None:
        r.error("spec", "BP/" + S["loot_table"], "loot table missing")
    else:
        dump = json.dumps(lt)
        for it in S["loot_items"]:
            if it not in dump:
                r.error("spec", "BP/" + S["loot_table"], "should drop %s" % it)
    # items
    for iid, (fn, icon, stack, glint, hand) in S["items"].items():
        if iid not in a.items:
            r.error("spec", "BP/" + fn, "item %s missing" % iid)
            continue
        lab, item = a.items[iid]
        if lab != "BP/" + fn:
            r.warn("spec", lab, "SPEC file name is BP/%s" % fn)
        doc = a.data.get(lab, {})
        if doc.get("format_version") != "1.20.80":
            r.warn("spec", lab, "format_version %r (SPEC: 1.20.80)" % doc.get("format_version"))
        mc = (item.get("description", {}) or {}).get("menu_category") or {}
        if mc.get("category") != "equipment":
            r.warn("spec", lab, "menu_category.category should be equipment")
        comps = item.get("components", {}) or {}
        ic = comps.get("minecraft:icon")
        keys = [ic] if isinstance(ic, str) else list((ic or {}).get("textures", {}).values()) \
            if isinstance(ic, dict) and isinstance(ic.get("textures"), dict) else \
            [ic.get("texture")] if isinstance(ic, dict) else []
        if icon not in keys:
            r.error("spec", lab, "icon key should be %s (got %r)" % (icon, keys))
        mss = comps.get("minecraft:max_stack_size")
        mss = mss.get("value") if isinstance(mss, dict) else mss
        if mss != stack:
            r.error("spec", lab, "max_stack_size %r != %d" % (mss, stack))
        g = comps.get("minecraft:glint")
        gv = g.get("value") if isinstance(g, dict) else g
        if bool(gv) != glint:
            r.warn("spec", lab, "glint %r (SPEC: %s)" % (gv, glint))
        he = comps.get("minecraft:hand_equipped")
        hv = he.get("value") if isinstance(he, dict) else he
        if bool(hv) != hand:
            r.warn("spec", lab, "hand_equipped %r (SPEC: %s)" % (hv, hand))
    # recipes
    found = {}
    for lab, doc in a.recipes.items():
        for k, body in (doc or {}).items():
            if k.startswith("minecraft:recipe_") and isinstance(body, dict):
                found[(body.get("description") or {}).get("identifier")] = (lab, k, body, doc)
    for rid, (pat, key) in S["recipes"].items():
        if rid not in found:
            r.error("spec", "BP/recipes", "recipe %s missing" % rid)
            continue
        lab, kind, body, doc = found[rid]
        if kind != "minecraft:recipe_shaped":
            r.error("spec", lab, "recipe %s must be shaped" % rid)
            continue
        if doc.get("format_version") != "1.20.10":
            r.warn("spec", lab, "format_version %r (SPEC: 1.20.10)" % doc.get("format_version"))
        if body.get("tags") != ["crafting_table"]:
            r.warn("spec", lab, "tags %r (SPEC: [\"crafting_table\"])" % body.get("tags"))
        if body.get("pattern") != pat:
            r.error("spec", lab, "pattern %r != SPEC %r" % (body.get("pattern"), pat))
        got = {k: _item_desc(v) for k, v in (body.get("key") or {}).items()}
        if got != key:
            r.error("spec", lab, "key %r != SPEC %r" % (got, key))
        res = body.get("result")
        res = res[0] if isinstance(res, list) and res else res
        if _item_desc(res) != rid:
            r.error("spec", lab, "result %r should be %s" % (res, rid))
    # client side
    if eid not in a.client_entities:
        r.error("spec", "RP/entity/eyeball_guardian.entity.json", "client entity %s missing" % eid)
    else:
        lab, ce = a.client_entities[eid]
        desc = ce.get("description", {})
        if a.data.get(lab, {}).get("format_version") != "1.10.0":
            r.warn("spec", lab, "format_version should be 1.10.0")
        texs = set((desc.get("textures") or {}).values())
        for t in S["entity_textures"]:
            if t not in texs:
                r.error("spec", lab, "texture %s not declared" % t)
        if (desc.get("geometry") or {}).get("default") != S["geometry"]:
            r.error("spec", lab, "geometry.default must be %s" % S["geometry"])
        anims = desc.get("animations") or {}
        for aid in S["animations"]:
            if aid not in anims.values():
                r.error("spec", lab, "animation %s not declared" % aid)
        if S["animation_controller"] not in anims.values():
            r.error("spec", lab, "animation controller %s not declared" % S["animation_controller"])
        rcs = [x if isinstance(x, str) else next(iter(x)) for x in desc.get("render_controllers") or [] if x]
        if S["render_controller"] not in rcs:
            r.error("spec", lab, "render controller %s not used" % S["render_controller"])
        if len(rcs) < 2:
            r.warn("spec", lab, "SPEC wants a second emissive glow render controller")
        if (desc.get("particle_effects") or {}) != S["client_particles"]:
            r.error("spec", lab, "particle_effects %r != %r" % (desc.get("particle_effects"), S["client_particles"]))
        sc = (desc.get("scripts") or {}).get("scale")
        if not (isinstance(sc, str) and "ceg:level" in sc):
            r.warn("spec", lab, "scale should be 0.85 + 0.05 * query.property('ceg:level') (got %r)" % (sc,))
        egg = desc.get("spawn_egg") or {}
        if (str(egg.get("base_color", "")).upper(), str(egg.get("overlay_color", "")).upper()) != S["spawn_egg"]:
            r.warn("spec", lab, "spawn_egg colours %r != SPEC %r" % (egg, S["spawn_egg"]))
        if "attack" not in anims or anims.get("attack") != "animation.ceg.eyeball_guardian.attack":
            r.warn("spec", lab, "attack animation should be declared (played from script)")
    for aid in S["animations"]:
        if aid not in a.animations:
            r.error("spec", "RP/animations/eyeball_guardian.animation.json", "animation %s missing" % aid)
    if S["animation_controller"] not in a.acs:
        r.error("spec", "RP/animation_controllers", "%s missing" % S["animation_controller"])
    if S["render_controller"] not in a.rcs:
        r.error("spec", "RP/render_controllers", "%s missing" % S["render_controller"])
    g = a.geos.get(S["geometry"])
    if not g:
        r.error("spec", "RP/models/entity", "geometry %s missing" % S["geometry"])
    else:
        if (g.tw, g.th) != S["texture_wh"]:
            r.error("spec", g.label, "texture_width/height %r != %r" % ((g.tw, g.th), S["texture_wh"]))
        if a.data.get(g.label, {}).get("format_version") != "1.12.0":
            r.warn("spec", g.label, "format_version should be 1.12.0")
        for b in S["bones"]:
            if b not in g.bone_names:
                r.error("spec", g.label, "required bone %s missing" % b)
        for l in S["locators"]:
            if l not in g.locators:
                r.error("spec", g.label, "required locator %s missing" % l)
            elif g.locators[l] != "eye":
                r.warn("spec", g.label, "locator %s should be on bone eye (is on %s)" % (l, g.locators[l]))
        bones = {b.get("name"): b for b in g.bones if isinstance(b, dict)}
        if (bones.get("root") or {}).get("pivot") != [0, 8, 0]:
            r.warn("spec", g.label, "root pivot should be [0, 8, 0]")
        if not any(re.match(r"^spike_\d+$", n or "") for n in g.bone_names):
            r.error("spec", g.label, "no spike_NN bones")
        for n in g.bone_names:
            if n and re.match(r"^spike_x?\d+$", n) and n + "_t" not in g.bone_names:
                r.warn("spec", g.label, "spike bone %s has no %s_t tilt child" % (n, n))
    for t in S["entity_textures"]:
        f = a.find_texture(t)
        if not f:
            r.error("spec", "RP/" + t + ".png", "entity texture missing")
        else:
            info = image_info(os.path.join(a.rp, f))
            if info:
                if info[0] != S["entity_png_wh"]:
                    r.error("spec", a.label("RP", f), "%dx%d != SPEC %dx%d" % (info[0] + S["entity_png_wh"]))
                if t.endswith(("_glow", "_rage")) and info[1] not in ("RGBA", "LA", "P"):
                    r.error("spec", a.label("RP", f), "emissive overlay needs an alpha channel")
    pa, pwh = S["particle_atlas"]
    f = a.find_texture(pa)
    if not f:
        r.error("spec", "RP/" + pa + ".png", "particle atlas missing")
    else:
        info = image_info(os.path.join(a.rp, f))
        if info and info[0] != pwh:
            r.error("spec", a.label("RP", f), "%dx%d != SPEC %dx%d" % (info[0] + pwh))
    for pid in S["particles"]:
        if pid not in a.particles:
            r.error("spec", "RP/particles", "particle %s missing" % pid)
        else:
            tex = a.particles[pid][1].get("description", {}).get("basic_render_parameters", {}).get("texture")
            if tex != pa:
                r.warn("spec", a.particles[pid][0], "texture %r (SPEC: single atlas %s)" % (tex, pa))
    for sid, files in S["sounds"].items():
        d = a.sound_defs.get(sid)
        if not isinstance(d, dict):
            r.error("spec", "RP/sounds/sound_definitions.json", "sound %s missing" % sid)
            continue
        names = sorted(set((s if isinstance(s, str) else s.get("name", "")) for s in d.get("sounds", []) or []))
        want = sorted("sounds/ceg/" + f for f in files)
        if names != want:
            r.warn("spec", "RP/sounds/sound_definitions.json", "%s files %r != SPEC %r" % (sid, names, want))
        cat = d.get("category")
        if cat not in ("neutral", "ui"):
            r.warn("spec", "RP/sounds/sound_definitions.json", "%s category %r (SPEC: neutral/ui)" % (sid, cat))
    sj = a.sounds_json if isinstance(a.sounds_json, dict) else {}
    evs = ((sj.get("entity_sounds") or {}).get("entities") or {}).get(eid, {}).get("events", {}) or {}
    for ev, sid in S["entity_sound_events"].items():
        v = evs.get(ev)
        v = v.get("sound") if isinstance(v, dict) else v
        if v != sid:
            r.error("spec", "RP/sounds.json", "entity event %s -> %r (SPEC: %s)" % (ev, v, sid))
    for k, p in S["item_textures"].items():
        v = a.item_tex.get(k)
        if v is None:
            r.error("spec", "RP/textures/item_texture.json", "key %s missing" % k)
        elif p not in _texture_data_paths(v):
            r.error("spec", "RP/textures/item_texture.json", "%s should point at %s" % (k, p))
        f = a.find_texture(p)
        info = image_info(os.path.join(a.rp, f)) if f else None
        if info and info[0] != (32, 32):
            r.warn("spec", a.label("RP", f), "item icon %dx%d (SPEC 32x32)" % info[0])
    it = a.get("RP", "textures/item_texture.json") or {}
    if isinstance(it, dict) and it.get("resource_pack_name") != "ceg":
        r.warn("spec", "RP/textures/item_texture.json", "resource_pack_name should be \"ceg\"")
    for n in S["ui_icons"]:
        p = "textures/ceg/ui/%s" % n
        f = a.find_texture(p)
        if not f:
            r.error("spec", "RP/%s.png" % p, "UI icon missing")
        else:
            info = image_info(os.path.join(a.rp, f))
            if info and info[0] != (32, 32):
                r.warn("spec", a.label("RP", f), "UI icon %dx%d (SPEC 32x32)" % info[0])
    en = a.lang["RP"].get("en_US", {})
    for k, v in S["lang"].items():
        if k not in en:
            r.error("spec", "RP/texts/en_US.lang", "missing %s" % k)
        elif en[k].strip() != v:
            r.warn("spec", "RP/texts/en_US.lang", "%s = %r (SPEC: %r)" % (k, en[k], v))
    for pack in ("BP", "RP"):
        info = image_info(os.path.join(a.roots[pack], "pack_icon.png")) if a.exists(pack, "pack_icon.png") else None
        if info and info[0] != (256, 256):
            r.warn("spec", a.label(pack, "pack_icon.png"), "%dx%d (SPEC 256x256)" % info[0])
    if S["script_entry"] not in a.scripts:
        r.error("spec", "BP/" + S["script_entry"], "script entry missing")


# ==========================================================================
# Runner
# ==========================================================================
ORDER = ["files", "json", "manifest", "lang", "bp_entity", "item", "recipe", "client_entity", "geometry",
         "render_controller", "animation", "animation_controller", "script", "function", "particle", "sound",
         "loot", "texture", "spec"]


def run(bp=DEFAULT_BP, rp=DEFAULT_RP, ref=None, spec=True, only=None, use_ref=True):
    """Validate and return a Report (importable by build.py).  `only` limits what is
    reported (all checks still run because later checks use data gathered by earlier ones)."""
    report = Report()
    ref_path = find_ref(ref) if use_ref else None
    reference = Ref(ref_path)
    report.meta["BP"] = os.path.relpath(bp, os.getcwd()) if os.path.isabs(bp) else bp
    report.meta["RP"] = os.path.relpath(rp, os.getcwd()) if os.path.isabs(rp) else rp
    report.meta["reference"] = ref_path or ("NOT FOUND" if use_ref else "disabled") + \
        " (vanilla id / script API checks skipped)"
    if not ref_path and use_ref:
        report.warn("files", "", "reference data not found (use --ref or $CEG_REF): vanilla id and script API "
                                 "checks are skipped")
    a = Addon(bp, rp, reference, report, spec=spec)
    a.scan_files()
    a.index()
    report.meta["files"] = "BP %d, RP %d" % (len(a.files["BP"]), len(a.files["RP"]))
    checks = {name: fn for name, _, fn in CHECKS}
    for name in ORDER:
        if name == "spec" and not spec:
            continue
        try:
            checks[name](a)
        except Exception as e:  # never let a checker bug hide other results
            import traceback
            report.error(name, "validator", "internal error in check '%s': %s: %s\n%s"
                         % (name, type(e).__name__, e, traceback.format_exc(limit=3)))
        report.checks_run.append(name)
    if only:
        report.items = [it for it in report.items if it[1] in only or it[2] == "validator"]
        report.checks_run = [c for c in report.checks_run if c in only]
    return report


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument("--bp", default=DEFAULT_BP, help="behavior pack folder")
    ap.add_argument("--rp", default=DEFAULT_RP, help="resource pack folder")
    ap.add_argument("--ref", default=None, help="reference folder (contains samples/ and vanilla_bp/)")
    ap.add_argument("--no-spec", action="store_true", help="skip the SPEC.md contract assertions")
    ap.add_argument("--no-ref", action="store_true", help="ignore reference data even if it is found")
    ap.add_argument("--only", default=None, help="comma separated subset of checks to run")
    ap.add_argument("--strict", action="store_true", help="treat warnings as errors")
    ap.add_argument("-v", "--verbose", action="store_true", help="print info lines too")
    ap.add_argument("-q", "--quiet", action="store_true", help="print only the summary line")
    ap.add_argument("--json", default=None, help="also write a machine-readable report here")
    ap.add_argument("--list-checks", action="store_true")
    args = ap.parse_args(argv)
    if args.list_checks:
        for name in ORDER:
            desc = next(d for n, d, _ in CHECKS if n == name)
            print("%-21s %s" % (name, desc))
        return 0
    only = set(args.only.split(",")) if args.only else None
    if only:
        bad = only - set(ORDER)
        if bad:
            print("unknown check(s): %s" % ", ".join(sorted(bad)), file=sys.stderr)
            return 2
    report = run(os.path.abspath(args.bp), os.path.abspath(args.rp), args.ref, spec=not args.no_spec, only=only,
                 use_ref=not args.no_ref)
    print("Cursed Eyeball Guardian - static validation")
    if not args.quiet:
        report.print(sys.stdout, verbose=args.verbose, color=sys.stdout.isatty())
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(report.to_json(), f, indent=2)
    ne, nw = report.count("error"), report.count("warning")
    failed = ne > 0 or (args.strict and nw > 0)
    print("\nResult: %s - %d error(s), %d warning(s)%s" % ("FAILED" if failed else "OK", ne, nw,
                                                         " (strict)" if args.strict else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
