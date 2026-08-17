#!/usr/bin/env python3
"""Entities for Lost Island: Abandoned - Bedrock 1.21.0 (Beta 1.21.0.26).

Generates, for each creature:
  BP  entities/<n>.json          behaviour definition (format_version 1.20.60)
      spawn_rules/<n>.json       natural spawning (1.8.0)
      loot_tables/entities/<n>.json
  RP  entity/<n>.json            client entity (1.10.0)
      models/entity/<n>.json     original geometry (1.12.0)
      animations/<n>.json        walk / idle / attack (1.8.0)
      animation_controllers/<n>.json                    (1.10.0)
      textures/entity/li_<n>.png 64x64, painted from the SAME cube UV data
                                 that the geometry uses, so UVs always match

Only components that shipped before 1.21.0 and are non-experimental are used.
Audio is vanilla sound events only (the pack ships no .ogg files).
"""
import json
import os
import random

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "build", "Lost_Island_BP")
RP = os.path.join(ROOT, "build", "Lost_Island_RP")
OUT = os.path.join(ROOT, "tools", "out")

def uv_extent(bones):
    """Largest u/v a box-UV cube reaches, so the texture can be sized to fit."""
    mu = mv = 0
    for b in bones:
        for c in b["cubes"]:
            u, v = c["uv"]
            w, h, d = c["size"]
            mu = max(mu, u + 2 * (w + d))
            mv = max(mv, v + h + d)
    return mu, mv


def tex_size_for(bones):
    mu, mv = uv_extent(bones)
    size = 32
    while size < max(mu, mv):
        size *= 2
    return size


# ---------------------------------------------------------------------------
# Cube helper. Each cube: (bone, parent, pivot, origin, size, uv, palette_key)
# ---------------------------------------------------------------------------
def bone(name, pivot, cubes, parent=None):
    b = {"name": name, "pivot": pivot, "cubes": cubes}
    if parent:
        b["parent"] = parent
    return b


def cube(origin, size, uv, tint="body", inflate=None):
    c = {"origin": origin, "size": size, "uv": uv}
    if inflate:
        c["inflate"] = inflate
    c["__tint"] = tint          # stripped before writing; drives the texture
    return c


# ---------------------------------------------------------------------------
# MODELS - all original designs
# ---------------------------------------------------------------------------
def model_humanoid(scale=1.0, ragged=True):
    """Feral survivor / watcher base: a lean humanoid, not a player model."""
    return [
        bone("body", [0, 12, 0], [
            cube([-4, 12, -2], [8, 12, 4], [16, 16], "cloth"),
        ]),
        bone("head", [0, 24, 0], [
            cube([-4, 24, -4], [8, 8, 8], [0, 0], "skin"),
            cube([-4, 30, -4], [8, 4, 8], [0, 20], "hair"),
        ], "body"),
        bone("arm_r", [-5, 22, 0], [
            cube([-8, 12, -2], [3, 11, 4], [40, 16], "skin"),
        ], "body"),
        bone("arm_l", [5, 22, 0], [
            cube([5, 12, -2], [3, 11, 4], [40, 32], "skin"),
        ], "body"),
        bone("leg_r", [-2, 12, 0], [
            cube([-4, 0, -2], [4, 12, 4], [0, 32], "cloth" if ragged else "skin"),
        ], "body"),
        bone("leg_l", [2, 12, 0], [
            cube([0, 0, -2], [4, 12, 4], [16, 32], "cloth" if ragged else "skin"),
        ], "body"),
    ]


def model_stalker(big=False):
    """Long-limbed nocturnal hunter: low slung body, forward-thrust head."""
    s = 1.4 if big else 1.0
    W = int(6 * s)
    L = int(14 * s)
    H = int(7 * s)
    y = int(9 * s)
    return [
        bone("body", [0, y, 0], [
            cube([-W // 2, y, -L // 2], [W, H, L], [16, 16], "hide"),
            cube([-2, y + H, -4], [4, 2, 9], [0, 44], "spine"),
        ]),
        bone("head", [0, y + H - 1, -L // 2], [
            cube([-3, y + 1, -L // 2 - 6], [6, 6, 6], [0, 0], "hide"),
            cube([-2, y + 1, -L // 2 - 9], [4, 3, 3], [24, 0], "maw"),
        ], "body"),
        bone("leg_fr", [-W // 2, y, -L // 2 + 2], [
            cube([-W // 2 - 2, 0, -L // 2 + 1], [3, y, 3], [40, 16], "hide"),
        ], "body"),
        bone("leg_fl", [W // 2, y, -L // 2 + 2], [
            cube([W // 2 - 1, 0, -L // 2 + 1], [3, y, 3], [40, 32], "hide"),
        ], "body"),
        bone("leg_br", [-W // 2, y, L // 2 - 3], [
            cube([-W // 2 - 2, 0, L // 2 - 4], [3, y, 3], [52, 16], "hide"),
        ], "body"),
        bone("leg_bl", [W // 2, y, L // 2 - 3], [
            cube([W // 2 - 1, 0, L // 2 - 4], [3, y, 3], [52, 32], "hide"),
        ], "body"),
        bone("tail", [0, y + 2, L // 2], [
            cube([-1, y + 1, L // 2], [2, 2, 8], [24, 10], "spine"),
        ], "body"),
    ]


def model_crawler():
    """Cave crawler: flat six-legged thing that scuttles along tunnel floors."""
    return [
        bone("body", [0, 4, 0], [
            cube([-4, 3, -6], [8, 4, 12], [16, 16], "chitin"),
            cube([-3, 7, -2], [6, 2, 6], [0, 40], "plate"),
        ]),
        bone("head", [0, 5, -6], [
            cube([-3, 3, -9], [6, 4, 3], [0, 0], "chitin"),
            cube([-2, 4, -11], [1, 1, 2], [24, 0], "eye"),
            cube([1, 4, -11], [1, 1, 2], [28, 0], "eye"),
        ], "body"),
        bone("leg_fr", [-4, 3, -4], [
            cube([-8, 0, -5], [4, 3, 2], [40, 16], "chitin"),
        ], "body"),
        bone("leg_fl", [4, 3, -4], [
            cube([4, 0, -5], [4, 3, 2], [40, 22], "chitin"),
        ], "body"),
        bone("leg_mr", [-4, 3, 0], [
            cube([-8, 0, -1], [4, 3, 2], [40, 28], "chitin"),
        ], "body"),
        bone("leg_ml", [4, 3, 0], [
            cube([4, 0, -1], [4, 3, 2], [40, 34], "chitin"),
        ], "body"),
        bone("leg_br", [-4, 3, 4], [
            cube([-8, 0, 3], [4, 3, 2], [40, 40], "chitin"),
        ], "body"),
        bone("leg_bl", [4, 3, 4], [
            cube([4, 0, 3], [4, 3, 2], [40, 46], "chitin"),
        ], "body"),
    ]


def model_boar():
    """Island boar: stocky wild pig with tusks."""
    return [
        bone("body", [0, 11, 0], [
            cube([-4, 8, -7], [8, 8, 14], [16, 16], "hide"),
            cube([-3, 15, -4], [6, 2, 8], [0, 44], "mane"),
        ]),
        bone("head", [0, 13, -7], [
            cube([-3, 9, -11], [6, 6, 5], [0, 0], "hide"),
            cube([-2, 9, -13], [4, 3, 2], [24, 0], "snout"),
            cube([-3, 10, -12], [1, 1, 1], [30, 0], "tusk"),
            cube([2, 10, -12], [1, 1, 1], [30, 2], "tusk"),
        ], "body"),
        bone("leg_fr", [-3, 8, -4], [
            cube([-4, 0, -5], [3, 8, 3], [40, 16], "hide"),
        ], "body"),
        bone("leg_fl", [3, 8, -4], [
            cube([1, 0, -5], [3, 8, 3], [40, 28], "hide"),
        ], "body"),
        bone("leg_br", [-3, 8, 4], [
            cube([-4, 0, 3], [3, 8, 3], [52, 16], "hide"),
        ], "body"),
        bone("leg_bl", [3, 8, 4], [
            cube([1, 0, 3], [3, 8, 3], [52, 28], "hide"),
        ], "body"),
        bone("tail", [0, 14, 7], [
            cube([0, 13, 7], [1, 1, 3], [34, 0], "hide"),
        ], "body"),
    ]


def model_bird():
    """Island bird: small shore bird, cheap to render."""
    return [
        bone("body", [0, 4, 0], [
            cube([-2, 3, -3], [4, 4, 6], [16, 16], "feather"),
        ]),
        bone("head", [0, 7, -3], [
            cube([-2, 6, -5], [4, 4, 4], [0, 0], "feather"),
            cube([-1, 7, -7], [2, 1, 2], [20, 0], "beak"),
        ], "body"),
        bone("wing_r", [-2, 6, -1], [
            cube([-3, 3, -3], [1, 3, 6], [40, 16], "wing"),
        ], "body"),
        bone("wing_l", [2, 6, -1], [
            cube([2, 3, -3], [1, 3, 6], [40, 26], "wing"),
        ], "body"),
        bone("tail", [0, 5, 3], [
            cube([-2, 4, 3], [4, 1, 4], [0, 32], "wing"),
        ], "body"),
        bone("leg_r", [-1, 3, 0], [
            cube([-2, 0, -1], [1, 3, 1], [52, 16], "beak"),
        ], "body"),
        bone("leg_l", [1, 3, 0], [
            cube([1, 0, -1], [1, 3, 1], [52, 22], "beak"),
        ], "body"),
    ]


# ---------------------------------------------------------------------------
# Palettes: keyed by the tint names used above
# ---------------------------------------------------------------------------
PALETTES = {
    "feral_survivor": {
        "skin": (176, 150, 122), "cloth": (84, 74, 54), "hair": (48, 40, 32),
    },
    "island_stalker": {
        "hide": (112, 124, 104), "spine": (74, 84, 68), "maw": (150, 92, 88),
    },
    "alpha_stalker": {
        "hide": (78, 92, 74), "spine": (128, 74, 40), "maw": (168, 72, 66),
    },
    "cave_crawler": {
        "chitin": (68, 76, 86), "plate": (46, 52, 60), "eye": (206, 176, 90),
    },
    "watcher": {
        "skin": (22, 24, 28), "cloth": (14, 15, 18), "hair": (10, 11, 13),
    },
    "island_boar": {
        "hide": (98, 76, 54), "mane": (62, 48, 34), "snout": (150, 116, 100),
        "tusk": (226, 220, 200),
    },
    "island_bird": {
        "feather": (168, 170, 164), "wing": (118, 120, 116),
        "beak": (196, 152, 62),
    },
}


# ---------------------------------------------------------------------------
# Texture painting: derive the six face rects from each cube's box UV, so the
# texture is guaranteed to line up with the geometry.
# ---------------------------------------------------------------------------
def face_rects(uv, size):
    u, v = uv
    w, h, d = size
    return {
        "top":    (u + d,         v,     w, d),
        "bottom": (u + d + w,     v,     w, d),
        "east":   (u,             v + d, d, h),
        "north":  (u + d,         v + d, w, h),
        "west":   (u + d + w,     v + d, d, h),
        "south":  (u + d + w + d, v + d, w, h),
    }


def paint(im, rnd, rect_, base, detail=0.16):
    x0, y0, w, h = rect_
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if not (0 <= x < im.width and 0 <= y < im.height):
                continue
            j = rnd.randint(-int(255 * detail * 0.14), int(255 * detail * 0.14))
            # subtle top-down shading so the cubes read as volumes
            sh = 1.0 + 0.10 * (1.0 - (y - y0) / max(1.0, h - 1.0))
            c = tuple(max(0, min(255, int(v * sh) + j)) for v in base)
            im.putpixel((x, y), c + (255,))


def grime(im, rnd, rect_, colour, n):
    x0, y0, w, h = rect_
    for _ in range(n):
        x = rnd.randint(x0, x0 + w - 1)
        y = rnd.randint(y0, y0 + h - 1)
        if 0 <= x < im.width and 0 <= y < im.height:
            im.putpixel((x, y), colour + (255,))


def build_texture(name, bones, eyes=(255, 232, 180), seed=5):
    pal = PALETTES[name]
    rnd = random.Random(seed)
    size = tex_size_for(bones)
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    head_face = None
    for b in bones:
        for c in b["cubes"]:
            base = pal.get(c["__tint"], (128, 128, 128))
            rects = face_rects(c["uv"], c["size"])
            for fname, r in rects.items():
                paint(im, rnd, r, base)
                # weathering / dirt on the upward and side faces
                if fname in ("top", "east", "west"):
                    grime(im, rnd, r, tuple(int(v * 0.72) for v in base),
                          max(1, (r[2] * r[3]) // 12))
            if b["name"] == "head" and head_face is None:
                head_face = rects["north"]
    # eyes and a mouth line on the head's front face
    if head_face:
        x0, y0, w, h = head_face
        ey = y0 + max(1, h // 3)
        for dx in (max(1, w // 4), w - 1 - max(1, w // 4)):
            im.putpixel((x0 + dx, ey), eyes + (255,))
            if w >= 6:
                im.putpixel((x0 + dx, ey + 1), tuple(int(v * 0.6) for v in eyes) + (255,))
        if h >= 6:
            my = y0 + int(h * 0.68)
            for dx in range(max(1, w // 4), w - max(1, w // 4)):
                im.putpixel((x0 + dx, my), (38, 28, 26, 255))
    return im


# ---------------------------------------------------------------------------
# Animations built from the bone names that are actually present
# ---------------------------------------------------------------------------
def animations_for(name, bones, biped, speed=1.0):
    names = [b["name"] for b in bones]
    anims = {}
    swing = "math.cos(query.anim_time * 360 * %s) * %s"

    walk_bones = {}
    if biped:
        for i, bn in enumerate(("leg_r", "leg_l", "arm_r", "arm_l")):
            if bn in names:
                amp = 34 if bn.startswith("leg") else 26
                phase = "" if i % 2 == 0 else " * -1"
                walk_bones[bn] = {"rotation": [
                    (swing % (1.4 * speed, amp)) + phase, 0, 0]}
        if "body" in names:
            walk_bones["body"] = {"rotation": [
                "math.cos(query.anim_time * 360 * %s) * 2" % (2.8 * speed), 0, 0]}
    else:
        pairs = [("leg_fr", 1), ("leg_fl", -1), ("leg_mr", -1), ("leg_ml", 1),
                 ("leg_br", -1), ("leg_bl", 1)]
        for bn, sign in pairs:
            if bn in names:
                walk_bones[bn] = {"rotation": [
                    "math.cos(query.anim_time * 360 * %s) * %s" %
                    (1.7 * speed, 30 * sign), 0, 0]}
        if "tail" in names:
            walk_bones["tail"] = {"rotation": [
                0, "math.cos(query.anim_time * 360 * %s) * 12" % (1.7 * speed), 0]}
    anims["animation.li_%s.walk" % name] = {
        "loop": True, "animation_length": 1.0, "bones": walk_bones}

    idle_bones = {}
    if "body" in names:
        idle_bones["body"] = {"rotation": [
            "math.sin(query.anim_time * 90) * 1.2", 0, 0]}
    if "head" in names:
        idle_bones["head"] = {"rotation": [
            0, "math.sin(query.anim_time * 42) * 7", 0]}
    if "tail" in names:
        idle_bones["tail"] = {"rotation": [
            0, "math.sin(query.anim_time * 120) * 6", 0]}
    anims["animation.li_%s.idle" % name] = {
        "loop": True, "animation_length": 2.5, "bones": idle_bones}

    atk = {}
    if biped:
        if "arm_r" in names:
            atk["arm_r"] = {"rotation": [
                "-110 * math.sin(variable.attack_time * 180)", 0, 0]}
        if "arm_l" in names:
            atk["arm_l"] = {"rotation": [
                "-40 * math.sin(variable.attack_time * 180)", 0, 0]}
    else:
        if "head" in names:
            atk["head"] = {"rotation": [
                "-28 * math.sin(variable.attack_time * 180)", 0, 0]}
        if "body" in names:
            atk["body"] = {"rotation": [
                "-10 * math.sin(variable.attack_time * 180)", 0, 0]}
    anims["animation.li_%s.attack" % name] = {
        "loop": False, "animation_length": 0.75, "bones": atk}
    return anims


def controller_for(name, has_attack=True):
    states = {
        "idle": {
            "animations": ["idle"],
            "blend_transition": 0.2,
            "transitions": [{"walk": "query.modified_move_speed > 0.1"}],
        },
        "walk": {
            "animations": ["walk"],
            "blend_transition": 0.2,
            "transitions": [{"idle": "query.modified_move_speed <= 0.1"}],
        },
    }
    if has_attack:
        states["idle"]["transitions"].append({"attack": "variable.attack_time > 0.0"})
        states["walk"]["transitions"].append({"attack": "variable.attack_time > 0.0"})
        states["attack"] = {
            "animations": ["attack"],
            "blend_transition": 0.1,
            "transitions": [{"idle": "variable.attack_time <= 0.0"}],
        }
    return {"controller.animation.li_%s.general" % name: {
        "initial_state": "idle", "states": states}}


# ---------------------------------------------------------------------------
# Entity definitions
# ---------------------------------------------------------------------------
def w(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)
        f.write("\n")


def strip_tints(bones):
    out = []
    for b in bones:
        nb = {k: v for k, v in b.items() if k != "cubes"}
        nb["cubes"] = [{k: v for k, v in c.items() if k != "__tint"}
                       for c in b["cubes"]]
        out.append(nb)
    return out


def hostile_behaviours(damage, radius=20, speed_mult=1.1, priority_base=1):
    return {
        "minecraft:attack": {"damage": damage},
        "minecraft:behavior.hurt_by_target": {"priority": priority_base},
        "minecraft:behavior.melee_attack": {
            "priority": priority_base + 1,
            "speed_multiplier": speed_mult,
            "track_target": True,
            "reach_multiplier": 1.4,
        },
        "minecraft:behavior.nearest_attackable_target": {
            "priority": priority_base + 2,
            "must_see": True,
            "must_see_forget_duration": 8.0,
            "reselect_targets": True,
            "within_radius": radius,
            "entity_types": [{
                "filters": {"test": "is_family", "subject": "other",
                            "value": "player"},
                "max_dist": radius,
            }],
        },
    }


def common_components(hp, movement, box, loot, families, ambient=None,
                      ambient_range=14):
    c = {
        "minecraft:type_family": {"family": families},
        "minecraft:health": {"value": hp, "max": hp},
        "minecraft:movement": {"value": movement},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:physics": {},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
        "minecraft:collision_box": {"width": box[0], "height": box[1]},
        "minecraft:loot": {"table": "loot_tables/entities/%s.json" % loot},
        "minecraft:conditional_bandwidth_optimization": {
            "default_values": {
                "max_optimized_distance": 80,
                "max_dropped_ticks": 10,
                "use_motion_prediction_hints": True,
            }
        },
        "minecraft:hurt_on_condition": {
            "damage_conditions": [{
                "filters": {"test": "in_lava", "subject": "self",
                            "operator": "==", "value": True},
                "cause": "lava",
                "damage_per_tick": 4,
            }]
        },
        # every creature floats rather than drowning in the rivers and lakes
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.random_look_around": {"priority": 9},
        "minecraft:behavior.look_at_player": {
            "priority": 8, "look_distance": 8.0, "probability": 0.02},
    }
    if ambient:
        c["minecraft:ambient_sound_interval"] = {
            "value": ambient, "range": ambient_range, "event_name": "ambient"}
    return c


def despawn_far(minr=42, maxr=58):
    return {"minecraft:despawn": {
        "despawn_from_distance": {"min_distance": minr, "max_distance": maxr},
        "min_range_random_chance": 4,
    }}


ENTITIES = {}


def define_entities():
    # ---------------------------------------------------------- feral survivor
    ENTITIES["feral_survivor"] = {
        "model": model_humanoid(),
        "biped": True,
        "egg": ("#6b6552", "#33302a"),
        "hp": 24, "movement": 0.235, "box": (0.62, 1.9),
        "sounds": {"ambient": "mob.villager.idle", "hurt": "mob.villager.hurt",
                   "death": "mob.zombie.death", "attack": "mob.zombie.say"},
        "extra": dict(
            hostile_behaviours(4, 18, 1.05),
            **{
                "minecraft:navigation.walk": {
                    "can_path_over_water": False, "avoid_water": True,
                    "avoid_damage_blocks": True},
                "minecraft:behavior.random_stroll": {
                    "priority": 6, "speed_multiplier": 0.6, "xz_dist": 12},
                "minecraft:behavior.avoid_mob_type": {
                    "priority": 5,
                    "entity_types": [{
                        "filters": {"test": "is_family", "subject": "other",
                                    "value": "li_alpha"},
                        "max_dist": 8, "walk_speed_multiplier": 1.4,
                        "sprint_speed_multiplier": 1.5}],
                },
                "minecraft:can_climb": {},
                "minecraft:knockback_resistance": {"value": 0.0},
            }),
        "groups": {"li:despawn_now": {"minecraft:instant_despawn": {}}},
        "spawned": [],
        "families": ["li_hostile", "li_survivor", "monster", "mob"],
        "ambient": 18,
        "spawn": {"surface": True, "light": (0, 12), "weight": 14,
                  "density": 2, "height": (58, 120), "herd": (1, 2)},
    }
    # ---------------------------------------------------------- island stalker
    ENTITIES["island_stalker"] = {
        "model": model_stalker(),
        "biped": False,
        "egg": ("#707c68", "#c8b05a"),
        "hp": 18, "movement": 0.325, "box": (0.8, 1.2),
        "sounds": {"ambient": "mob.wolf.growl", "hurt": "mob.wolf.hurt",
                   "death": "mob.wolf.death", "attack": "mob.wolf.bark"},
        "extra": dict(
            hostile_behaviours(5, 22, 1.25),
            **{
                "minecraft:navigation.walk": {
                    "can_path_over_water": False, "avoid_water": True},
                # Seeks shade instead of burning: keeps them alive but pushes
                # them out of open daylight, which is the intended behaviour.
                "minecraft:behavior.restrict_sun": {"priority": 4},
                "minecraft:behavior.flee_sun": {
                    "priority": 5, "speed_multiplier": 1.2},
                "minecraft:behavior.random_stroll": {
                    "priority": 7, "speed_multiplier": 0.8, "xz_dist": 14},
                "minecraft:can_climb": {},
                "minecraft:knockback_resistance": {"value": 0.1},
            }),
        "groups": {"li:despawn_now": {"minecraft:instant_despawn": {}}},
        "spawned": [],
        "families": ["li_hostile", "li_stalker", "monster", "mob"],
        "ambient": 16,
        "spawn": {"surface": True, "light": (0, 4), "weight": 12,
                  "density": 2, "height": (58, 120), "herd": (1, 2)},
    }
    # ------------------------------------------------------------ cave crawler
    ENTITIES["cave_crawler"] = {
        "model": model_crawler(),
        "biped": False,
        "egg": ("#444c56", "#cbb05a"),
        "hp": 14, "movement": 0.3, "box": (0.8, 0.6),
        "sounds": {"ambient": "mob.silverfish.say",
                   "hurt": "mob.silverfish.hurt",
                   "death": "mob.spider.death", "attack": "mob.spider.say"},
        "extra": dict(
            hostile_behaviours(3, 16, 1.3),
            **{
                "minecraft:navigation.walk": {
                    "can_path_over_water": False, "avoid_water": True},
                "minecraft:can_climb": {},
                "minecraft:behavior.random_stroll": {
                    "priority": 7, "speed_multiplier": 0.9, "xz_dist": 10},
                "minecraft:knockback_resistance": {"value": 0.0},
            }),
        "groups": {"li:despawn_now": {"minecraft:instant_despawn": {}}},
        "spawned": [],
        "families": ["li_hostile", "li_crawler", "monster", "mob"],
        "ambient": 14,
        "spawn": {"underground": True, "light": (0, 7), "weight": 16,
                  "density": 3, "height": (12, 52), "herd": (1, 3)},
    }
    # ----------------------------------------------------------------- watcher
    ENTITIES["watcher"] = {
        "model": model_humanoid(ragged=False),
        "biped": True,
        "egg": ("#15171b", "#8fa0a8"),
        "hp": 30, "movement": 0.34, "box": (0.6, 2.2),
        "sounds": {"ambient": "mob.enderman.idle",
                   "hurt": "mob.enderman.portal",
                   "death": "mob.enderman.portal"},
        "extra": {
            "minecraft:navigation.walk": {
                "can_path_over_water": True, "avoid_water": False},
            # Never attacks. Retreats as soon as the player closes in, then the
            # timer below removes it entirely.
            "minecraft:behavior.avoid_mob_type": {
                "priority": 1,
                "entity_types": [{
                    "filters": {"test": "is_family", "subject": "other",
                                "value": "player"},
                    "max_dist": 12, "walk_speed_multiplier": 1.4,
                    "sprint_speed_multiplier": 1.9}],
            },
            "minecraft:behavior.random_stroll": {
                "priority": 6, "speed_multiplier": 0.35, "xz_dist": 6},
            "minecraft:knockback_resistance": {"value": 1.0},
            "minecraft:pushable": {"is_pushable": False,
                                   "is_pushable_by_piston": False},
        },
        "groups": {
            "li:watch_timer": {
                "minecraft:timer": {
                    "looping": False, "time": [22.0, 48.0],
                    "time_down_event": {"event": "li:vanish"}}
            },
            "li:despawn_now": {"minecraft:instant_despawn": {}},
        },
        "spawned": ["li:watch_timer"],
        "events_extra": {"li:vanish": {"add": {"component_groups": ["li:despawn_now"]}}},
        "families": ["li_watcher", "mob"],
        "ambient": 30,
        "spawn": None,          # story/encounter spawned only
    }
    # ------------------------------------------------------------ alpha stalker
    ENTITIES["alpha_stalker"] = {
        "model": model_stalker(big=True),
        "biped": False,
        "egg": ("#4e5c4a", "#a8482c"),
        "hp": 60, "movement": 0.29, "box": (1.2, 1.8),
        "sounds": {"ambient": "mob.ravager.ambient",
                   "hurt": "mob.ravager.hurt",
                   "death": "mob.ravager.death", "attack": "mob.ravager.roar"},
        "extra": dict(
            hostile_behaviours(8, 26, 1.15),
            **{
                "minecraft:navigation.walk": {
                    "can_path_over_water": False, "avoid_water": True,
                    "can_break_doors": False},
                "minecraft:can_climb": {},
                "minecraft:knockback_resistance": {"value": 0.7},
                "minecraft:behavior.random_stroll": {
                    "priority": 7, "speed_multiplier": 0.7, "xz_dist": 12},
            }),
        "groups": {"li:despawn_now": {"minecraft:instant_despawn": {}}},
        "spawned": [],
        "families": ["li_hostile", "li_alpha", "monster", "mob"],
        "ambient": 20,
        "spawn": None,          # Forbidden Zone only, spawned by function
    }
    # -------------------------------------------------------------- boar (wild)
    ENTITIES["island_boar"] = {
        "model": model_boar(),
        "biped": False,
        "egg": ("#624c36", "#8c6a4a"),
        "hp": 10, "movement": 0.25, "box": (0.9, 0.9),
        "sounds": {"ambient": "mob.pig.say", "hurt": "mob.pig.say",
                   "death": "mob.pig.death"},
        "extra": {
            "minecraft:navigation.walk": {
                "can_path_over_water": False, "avoid_water": True},
            "minecraft:attack": {"damage": 2},
            # Neutral: peaceful until provoked.
            "minecraft:behavior.hurt_by_target": {"priority": 1},
            "minecraft:behavior.melee_attack": {
                "priority": 2, "speed_multiplier": 1.2, "track_target": False},
            "minecraft:behavior.panic": {
                "priority": 3, "speed_multiplier": 1.35},
            "minecraft:behavior.random_stroll": {
                "priority": 6, "speed_multiplier": 0.55, "xz_dist": 10},
            "minecraft:behavior.tempt": {
                "priority": 4, "speed_multiplier": 1.0,
                "items": ["minecraft:wheat", "minecraft:beetroot"]},
        },
        "groups": {},
        "spawned": [],
        "families": ["li_wildlife", "li_boar", "mob"],
        "ambient": 22,
        "spawn": {"surface": True, "light": (7, 15), "weight": 10,
                  "density": 3, "height": (62, 110), "herd": (2, 3),
                  "population": "animal"},
    }
    # -------------------------------------------------------------------- bird
    ENTITIES["island_bird"] = {
        "model": model_bird(),
        "biped": False,
        "egg": ("#a8aaa4", "#c4983e"),
        "hp": 4, "movement": 0.28, "box": (0.4, 0.5),
        "sounds": {"ambient": "mob.chicken.say", "hurt": "mob.chicken.hurt",
                   "death": "mob.chicken.hurt"},
        "extra": {
            # Ground navigation with hops rather than full flight AI: much
            # cheaper on mobile, and shore birds read fine walking the beach.
            "minecraft:navigation.walk": {
                "can_path_over_water": False, "avoid_water": True},
            "minecraft:behavior.panic": {
                "priority": 1, "speed_multiplier": 1.5},
            "minecraft:behavior.random_stroll": {
                "priority": 5, "speed_multiplier": 0.9, "xz_dist": 8},
            "minecraft:behavior.float": {"priority": 0},
        },
        "groups": {},
        "spawned": [],
        "families": ["li_wildlife", "li_bird", "mob"],
        "ambient": 12,
        "spawn": {"surface": True, "light": (8, 15), "weight": 8,
                  "density": 2, "height": (62, 80), "herd": (2, 4),
                  "population": "ambient"},
    }


# ---------------------------------------------------------------------------
def loot_for(name):
    def item(nm, weight, cmin=1, cmax=1):
        e = {"type": "item", "name": nm, "weight": weight}
        if (cmin, cmax) != (1, 1):
            e["functions"] = [{"function": "set_count",
                               "count": {"min": cmin, "max": cmax}}]
        return e

    tables = {
        "feral_survivor": [
            {"rolls": {"min": 1, "max": 2}, "entries": [
                item("li:cloth", 20, 1, 2), item("li:scrap", 14),
                item("li:rope", 10), item("li:bandage", 8),
                item("li:canned_beans", 8), {"type": "empty", "weight": 16}]}],
        "island_stalker": [
            {"rolls": 1, "entries": [
                item("li:cloth", 18), item("li:scrap", 10),
                item("minecraft:bone", 16, 1, 2),
                {"type": "empty", "weight": 20}]}],
        "cave_crawler": [
            {"rolls": 1, "entries": [
                item("li:scrap", 16), item("minecraft:string", 14, 1, 2),
                item("minecraft:bone", 10), {"type": "empty", "weight": 22}]}],
        "watcher": [{"rolls": 1, "entries": [{"type": "empty", "weight": 1}]}],
        "alpha_stalker": [
            # Guaranteed keycard: this drop is a progression gate.
            {"rolls": 1, "entries": [item("li:keycard", 1)]},
            {"rolls": {"min": 1, "max": 2}, "entries": [
                item("li:first_aid", 10), item("li:scrap", 14, 1, 3),
                item("li:documents", 10), item("li:battery", 10)]}],
        "island_boar": [
            {"rolls": {"min": 1, "max": 2}, "entries": [
                item("minecraft:porkchop", 20, 1, 3),
                item("minecraft:leather", 12, 1, 2)]}],
        "island_bird": [
            {"rolls": 1, "entries": [
                item("minecraft:feather", 20, 1, 2),
                item("minecraft:chicken", 10),
                {"type": "empty", "weight": 8}]}],
    }
    return {"pools": tables[name]}


def spawn_rules(name, spec, families):
    conds = {
        "minecraft:weight": {"default": spec["weight"]},
        "minecraft:herd": {"min_size": spec["herd"][0],
                           "max_size": spec["herd"][1]},
        "minecraft:brightness_filter": {
            "min": spec["light"][0], "max": spec["light"][1],
            "adjust_for_weather": False},
        "minecraft:height_filter": {"min": spec["height"][0],
                                    "max": spec["height"][1]},
        "minecraft:density_limit": {},
        "minecraft:difficulty_filter": {"min": "easy", "max": "hard"},
    }
    if spec.get("surface"):
        conds["minecraft:spawns_on_surface"] = {}
        conds["minecraft:density_limit"]["surface"] = spec["density"]
    if spec.get("underground"):
        conds["minecraft:spawns_underground"] = {}
        conds["minecraft:density_limit"]["underground"] = spec["density"]
    return {
        "format_version": "1.8.0",
        "minecraft:spawn_rules": {
            "description": {
                "identifier": "li:" + name,
                "population_control": spec.get("population", "monster"),
            },
            "conditions": [conds],
        },
    }


def main():
    define_entities()
    os.makedirs(OUT, exist_ok=True)
    lang = []
    sounds = {"format_version": "1.14.0", "entity_sounds": {"entities": {}}}

    for name, spec in ENTITIES.items():
        ident = "li:" + name
        bones = spec["model"]

        # ------------------------------------------------------------- BP entity
        comps = common_components(
            spec["hp"], spec["movement"], spec["box"], name, spec["families"],
            ambient=spec.get("ambient"))
        comps.update(spec["extra"])
        groups = dict(spec["groups"])
        if "li_hostile" in spec["families"]:
            comps.update(despawn_far(*( (64, 90) if name == "alpha_stalker"
                                        else (42, 58) )))
        events = {}
        if spec["spawned"]:
            events["minecraft:entity_spawned"] = {
                "add": {"component_groups": spec["spawned"]}}
        events.update(spec.get("events_extra", {}))
        ent = {
            "format_version": "1.20.60",
            "minecraft:entity": {
                "description": {
                    "identifier": ident,
                    "is_spawnable": True,
                    "is_summonable": True,
                    "is_experimental": False,
                },
                "component_groups": groups,
                "components": comps,
            },
        }
        if events:
            ent["minecraft:entity"]["events"] = events
        w(os.path.join(BP, "entities", name + ".json"), ent)

        # ------------------------------------------------------------ spawn rule
        if spec["spawn"]:
            w(os.path.join(BP, "spawn_rules", name + ".json"),
              spawn_rules(name, spec["spawn"], spec["families"]))

        # ------------------------------------------------------------ loot table
        w(os.path.join(BP, "loot_tables", "entities", name + ".json"),
          loot_for(name))

        # -------------------------------------------------------------- geometry
        geo = {
            "format_version": "1.12.0",
            "minecraft:geometry": [{
                "description": {
                    "identifier": "geometry.li_" + name,
                    "texture_width": tex_size_for(bones),
                    "texture_height": tex_size_for(bones),
                    "visible_bounds_width": 3,
                    "visible_bounds_height": 3.5,
                    "visible_bounds_offset": [0, 1.2, 0],
                },
                "bones": strip_tints(bones),
            }],
        }
        w(os.path.join(RP, "models", "entity", name + ".json"), geo)

        # ------------------------------------------------------------ animations
        has_attack = any(k == "minecraft:attack" for k in spec["extra"])
        w(os.path.join(RP, "animations", name + ".json"),
          {"format_version": "1.8.0",
           "animations": animations_for(name, bones, spec["biped"])})
        w(os.path.join(RP, "animation_controllers", name + ".json"),
          {"format_version": "1.10.0",
           "animation_controllers": controller_for(name, has_attack)})

        # --------------------------------------------------------- client entity
        anim_map = {
            "idle": "animation.li_%s.idle" % name,
            "walk": "animation.li_%s.walk" % name,
        }
        if has_attack:
            anim_map["attack"] = "animation.li_%s.attack" % name
        anim_map["general"] = "controller.animation.li_%s.general" % name
        client = {
            "format_version": "1.10.0",
            "minecraft:client_entity": {
                "description": {
                    "identifier": ident,
                    "materials": {"default": "entity_alphatest"},
                    "textures": {"default": "textures/entity/li_" + name},
                    "geometry": {"default": "geometry.li_" + name},
                    "animations": anim_map,
                    "scripts": {"animate": ["general"]},
                    "render_controllers": ["controller.render.li_default"],
                    "spawn_egg": {
                        "base_colour": spec["egg"][0],
                        "overlay_colour": spec["egg"][1],
                    },
                },
            },
        }
        w(os.path.join(RP, "entity", name + ".json"), client)

        # ---------------------------------------------------------------- texture
        eyes = (206, 176, 90) if name == "cave_crawler" else (
            (176, 196, 200) if name == "watcher" else (255, 232, 180))
        tex = build_texture(name, bones, eyes=eyes,
                            seed=abs(hash(name)) % 9999)
        d = os.path.join(RP, "textures", "entity")
        os.makedirs(d, exist_ok=True)
        tex.save(os.path.join(d, "li_" + name + ".png"))

        # ----------------------------------------------------------------- sounds
        sounds["entity_sounds"]["entities"][ident] = {
            "volume": 0.85,
            "pitch": [0.85, 1.05],
            "events": spec["sounds"],
        }

        pretty = name.replace("_", " ").title()
        lang.append(("entity.%s.name" % ident, pretty))
        lang.append(("item.spawn_egg.entity.%s.name" % ident, "Spawn " + pretty))

    # one shared render controller for every creature
    w(os.path.join(RP, "render_controllers", "li_default.json"), {
        "format_version": "1.0.0",
        "render_controllers": {
            "controller.render.li_default": {
                "geometry": "Geometry.default",
                "materials": [{"*": "Material.default"}],
                "textures": ["Texture.default"],
            }
        },
    })
    w(os.path.join(RP, "sounds.json"), sounds)

    with open(os.path.join(OUT, "entity_lang.txt"), "w") as f:
        for k, v in lang:
            f.write("%s=%s\n" % (k, v))

    print("entities       : %d" % len(ENTITIES))
    print("spawn rules    : %d" % len([e for e in ENTITIES.values() if e["spawn"]]))
    for n, sp in ENTITIES.items():
        print("  %-16s tex %dx%d  bones %d" % (
            n, tex_size_for(sp["model"]), tex_size_for(sp["model"]),
            len(sp["model"])))


if __name__ == "__main__":
    main()
