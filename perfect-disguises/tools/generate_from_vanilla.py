#!/usr/bin/env python3
"""
Perfect Disguises - generator for the vanilla-derived pack files.

The behavior/resource packs override the vanilla player entity.  To stay
faithful to the exact game version, the override files and the disguise
models are generated from Mojang's official "bedrock-samples" for the
targeted build (v1.21.0.26-preview) instead of being written by hand.

What this script writes (everything else in the packs is hand written):

  RP  entity/player.entity.json                    vanilla player + disguise layer
  RP  models/entity/pd_<mob>.geo.json              vanilla mob models, bones renamed
  RP  animations/pd_disguises.animation.json       vanilla mob animations, bones renamed
  RP  render_controllers/pd_disguises.render_controllers.json
  BP  entities/player.json                         vanilla player + disguise groups/events

Usage:
  git clone --depth 1 --branch v1.21.0.26-preview \
      https://github.com/Mojang/bedrock-samples.git /tmp/bedrock-samples
  python3 tools/generate_from_vanilla.py /tmp/bedrock-samples

Model notes
-----------
* Every mob bone is renamed with a "pd_" prefix so the player's own
  animations (which target "head", "body", "rightArm", ...) never touch the
  disguise model.
* Every bone name the game uses to attach things to a player (armor,
  capes, held items, shields, spyglass...) is added as an empty bone under
  "pd_hidden", which an animation scales to 0.  Anything attached to those
  bones collapses to nothing, so armor/capes/items do not float around the
  disguise.
* Zombie and skeleton keep real "rightItem"/"leftItem" bones on their arms,
  so weapons and bows are visible in their hands like vanilla mobs.
"""

import copy
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lenient_json import load as load_lenient  # noqa: E402

ROOT = os.path.dirname(HERE)
BP = os.path.join(ROOT, "packs", "PerfectDisguises_BP")
RP = os.path.join(ROOT, "packs", "PerfectDisguises_RP")

# ---------------------------------------------------------------------------
# Disguise table (must match scripts/disguises.js in the behavior pack)
# ---------------------------------------------------------------------------
DISGUISES = [
    # key,        id, families (mob families the disguise pretends to have)
    ("zombie",    1,  ["zombie", "undead", "monster", "mob"]),
    ("skeleton",  2,  ["skeleton", "undead", "monster", "mob"]),
    ("creeper",   3,  ["creeper", "monster", "mob"]),
    ("spider",    4,  ["spider", "monster", "mob", "arthropod"]),
    ("enderman",  5,  ["enderman", "monster", "mob"]),
    ("villager",  6,  ["villager", "peasant", "farmer", "mob"]),
    ("pig",       7,  ["pig", "mob"]),
    ("cow",       8,  ["cow", "mob"]),
    ("sheep",     9,  ["sheep", "mob"]),
    ("wolf",      10, ["wolf", "mob"]),
    ("chicken",   11, ["chicken", "mob"]),
    ("bee",       12, ["bee", "mob", "arthropod"]),
]
ID = {key: did for key, did, _ in DISGUISES}

# Extra behavior components per disguise (no overlap with the vanilla
# player's base components, so adding/removing them is always clean).
EXTRA_COMPONENTS = {
    "creeper": {
        "minecraft:damage_sensor": {
            "triggers": [
                {"cause": "entity_explosion", "deals_damage": False},
                {"cause": "block_explosion", "deals_damage": False},
            ]
        }
    },
    # Wool cushions falls but burns easily (+1 damage per fire hit).
    "sheep": {
        "minecraft:damage_sensor": {
            "triggers": [
                {"cause": "fall", "deals_damage": False},
                {"cause": "fire", "damage_modifier": 1.0},
                {"cause": "fire_tick", "damage_modifier": 1.0},
            ]
        }
    },
    "chicken": {
        "minecraft:damage_sensor": {
            "triggers": [{"cause": "fall", "deals_damage": False}]
        }
    },
    # Bees are fragile: every hit deals +1 damage.
    "bee": {
        "minecraft:damage_sensor": {
            "triggers": [{"cause": "all", "damage_modifier": 1.0}]
        }
    },
}

# Every bone name the engine / vanilla attachables use on a player model.
PLAYER_BONES = [
    "root", "waist", "body", "head", "hat", "cape",
    "leftArm", "rightArm", "leftItem", "rightItem", "leftLeg", "rightLeg",
    "leftSleeve", "rightSleeve", "leftPants", "rightPants", "jacket",
    "helmet", "bodyArmor", "belt", "rightArmArmor", "leftArmArmor",
    "rightLegging", "leftLegging", "rightBoot", "leftBoot", "rightSock", "leftSock",
]

# key -> (source file, source geometry identifier, keep item bones visible)
MODELS = {
    "zombie":          ("zombie.geo.json", "geometry.zombie.v1.8", True),
    "skeleton":        ("skeleton.geo.json", "geometry.skeleton.v1.8", True),
    "creeper":         ("creeper.geo.json", "geometry.creeper.v1.8", False),
    "creeper_charged": ("creeper.geo.json", "geometry.creeper.charged.v1.8", False),
    "spider":          ("spider.geo.json", "geometry.spider.v1.8", False),
    "enderman":        ("enderman.geo.json", "geometry.enderman.v1.8", False),
    "villager":        ("villager_v2.geo.json", "geometry.villager_v2", False),
    "pig":             ("pig.geo.json", "geometry.pig.v1.8", False),
    "cow":             ("cow.geo.json", "geometry.cow.v1.8", False),
    "sheep":           ("sheep.geo.json", "SHEEP_MERGED", False),
    "wolf":            ("wolf.geo.json", "geometry.wolf", False),
    "chicken":         ("chicken.geo.json", "geometry.chicken.v1.12", False),
    "bee":             ("bee.geo.json", "geometry.bee", False),
}

# Client entity resources for each disguise (short name -> vanilla resource)
MATERIALS = {
    "pd_zombie": "zombie",
    "pd_skeleton": "skeleton",
    "pd_creeper": "creeper",
    "pd_creeper_charged": "charged_creeper",
    "pd_spider": "spider",
    "pd_enderman": "enderman",
    "pd_villager": "villager_v2",
    "pd_villager_masked": "villager_v2_masked",
    "pd_pig": "pig",
    "pd_cow": "cow",
    "pd_sheep": "sheep",
    "pd_wolf": "wolf",
    "pd_chicken": "chicken",
    "pd_chicken_legs": "chicken_legs",
    "pd_bee": "bee",
}
TEXTURES = {
    "pd_zombie": "textures/entity/zombie/zombie",
    "pd_skeleton": "textures/entity/skeleton/skeleton",
    "pd_creeper": "textures/entity/creeper/creeper",
    "pd_creeper_charged": "textures/entity/creeper/creeper_armor",
    "pd_spider": "textures/entity/spider/spider",
    "pd_enderman": "textures/entity/enderman/enderman",
    "pd_villager_base": "textures/entity/villager2/villager",
    "pd_villager_biome": "textures/entity/villager2/biomes/biome_plains",
    "pd_villager_profession": "textures/entity/villager2/professions/farmer",
    "pd_pig": "textures/entity/pig/pig",
    "pd_cow": "textures/entity/cow/cow",
    "pd_sheep": "textures/entity/sheep/sheep",
    "pd_wolf": "textures/entity/wolf/wolf",
    "pd_chicken": "textures/entity/chicken",
    "pd_bee": "textures/entity/bee/bee",
}


def geo_id(key):
    return "geometry.pd." + key


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------
def find_geometry(doc, identifier):
    """Return (format_version, geometry_dict, is_modern_format)."""
    if "minecraft:geometry" in doc:
        for g in doc["minecraft:geometry"]:
            if g["description"]["identifier"] == identifier:
                return doc["format_version"], g, True
    for k, v in doc.items():
        if k == "format_version":
            continue
        if k.split(":")[0] == identifier:
            return doc["format_version"], v, False
    raise KeyError(identifier)


def merged_sheep(doc):
    """Woolly sheep = sheared body + wool layer (legacy geometry inheritance)."""
    base = copy.deepcopy(doc["geometry.sheep.sheared.v1.8"])
    wool = doc["geometry.sheep.v1.8:geometry.sheep.sheared.v1.8"]
    by_name = {b["name"]: b for b in base["bones"]}
    for wb in wool["bones"]:
        target = by_name[wb["name"]]
        target.setdefault("cubes", []).extend(copy.deepcopy(wb.get("cubes", [])))
    return doc["format_version"], base, False


def derive_bones(bones, keep_items):
    keep = {"rightItem", "leftItem"} if keep_items else set()

    def rn(name):
        return name if name in keep else "pd_" + name

    out = []
    for b in copy.deepcopy(bones):
        b["name"] = rn(b["name"])
        if "parent" in b:
            b["parent"] = rn(b["parent"])
        out.append(b)

    taken = {b["name"].lower() for b in out}
    out.append({"name": "pd_hidden", "pivot": [0.0, 8.0, 0.0]})
    for name in PLAYER_BONES:
        if name.lower() in taken:
            continue
        out.append({"name": name, "parent": "pd_hidden", "pivot": [0.0, 8.0, 0.0]})
    return out


def build_model(samples, key):
    src, ident, keep_items = MODELS[key]
    doc = load_lenient(os.path.join(samples, "resource_pack", "models", "entity", src))
    if ident == "SHEEP_MERGED":
        fmt, geo, modern = merged_sheep(doc)
    else:
        fmt, geo, modern = find_geometry(doc, ident)
    geo = copy.deepcopy(geo)
    geo["bones"] = derive_bones(geo["bones"], keep_items)

    if modern:
        desc = geo["description"]
        desc["identifier"] = geo_id(key)
        desc.setdefault("texture_width", 64)
        desc.setdefault("texture_height", 64)
        desc["visible_bounds_width"] = 3
        desc["visible_bounds_height"] = 4
        desc["visible_bounds_offset"] = [0, 1.5, 0]
        return {"format_version": fmt, "minecraft:geometry": [geo]}

    # Legacy (1.8.0 / 1.10.0) format: keep it exactly as the game ships it.
    geo.setdefault("texturewidth", 64)
    geo.setdefault("textureheight", 64)
    geo["visible_bounds_width"] = 3
    geo["visible_bounds_height"] = 4
    geo["visible_bounds_offset"] = [0, 1.5, 0]
    return {"format_version": fmt, geo_id(key): geo}


# ---------------------------------------------------------------------------
# Animations (vanilla animations with bones renamed for the disguise models)
# ---------------------------------------------------------------------------
def vanilla_animations(samples):
    anims = {}
    folder = os.path.join(samples, "resource_pack", "animations")
    for name in os.listdir(folder):
        if not name.endswith(".json"):
            continue
        try:
            doc = load_lenient(os.path.join(folder, name))
        except Exception:  # dressing room files etc. are not needed
            continue
        anims.update(doc.get("animations", {}))
    return anims


def rename_anim(anim, mapping, replace=None):
    """Copy a vanilla animation, renaming bones and substituting Molang text."""
    out = copy.deepcopy(anim)
    bones = {}
    for bone, data in out.get("bones", {}).items():
        new = mapping.get(bone.lower())
        if new is None:
            continue
        bones[new] = data
    out["bones"] = bones
    if replace:
        text = json.dumps(out)
        for old, new in replace.items():
            text = text.replace(old, new)
        out = json.loads(text)
    return out


def bone_map(names):
    return {n.lower(): "pd_" + n for n in names}


HUMANOID = bone_map(["head", "body", "waist", "hat", "rightArm", "leftArm", "rightLeg", "leftLeg"])
QUAD = bone_map(["head", "body", "leg0", "leg1", "leg2", "leg3"])
SPIDER = bone_map(["head", "body0", "body1"] + ["leg%d" % i for i in range(8)])
VILLAGER = bone_map(["head", "body", "arms", "leg0", "leg1", "nose"])
WOLF = bone_map(["head", "body", "upperBody", "leg0", "leg1", "leg2", "leg3", "tail"])
CHICKEN = bone_map(["head", "body", "leg0", "leg1", "wing0", "wing1", "beak", "comb"])
BEE = bone_map(["body", "stinger", "rightwing_bone", "leftwing_bone", "leg_front", "leg_mid", "leg_back"])


def build_animations(samples):
    v = vanilla_animations(samples)
    a = {}

    # Shared helpers --------------------------------------------------------
    a["animation.pd.hidden"] = {"loop": True, "bones": {"pd_hidden": {"scale": 0.0}}}
    a["animation.pd.look_at_target"] = rename_anim(v["animation.common.look_at_target"], QUAD)

    # Humanoids (zombie, skeleton, enderman share the renamed bone names) ----
    a["animation.pd.humanoid.look_at_target"] = rename_anim(v["animation.humanoid.look_at_target.default"], HUMANOID)
    a["animation.pd.humanoid.move"] = rename_anim(v["animation.humanoid.move"], HUMANOID)
    a["animation.pd.humanoid.riding.arms"] = rename_anim(v["animation.humanoid.riding.arms"], HUMANOID)
    a["animation.pd.humanoid.riding.legs"] = rename_anim(v["animation.humanoid.riding.legs"], HUMANOID)
    a["animation.pd.humanoid.holding"] = rename_anim(v["animation.humanoid.holding"], HUMANOID)
    a["animation.pd.humanoid.attack.rotations"] = rename_anim(v["animation.humanoid.attack.rotations"], HUMANOID)
    a["animation.pd.humanoid.bob"] = rename_anim(v["animation.humanoid.bob"], HUMANOID)
    a["animation.pd.humanoid.bow_and_arrow"] = rename_anim(v["animation.humanoid.bow_and_arrow"], HUMANOID)
    a["animation.pd.zombie.arms"] = rename_anim(v["animation.zombie.attack_bare_hand"], HUMANOID)

    a["animation.pd.enderman.move"] = rename_anim(
        v["animation.humanoid.move"], HUMANOID, {"variable.tcos0": "variable.pd_tcos0_ender"})
    a["animation.pd.enderman.base_pose"] = rename_anim(v["animation.enderman.base_pose"], HUMANOID)
    a["animation.pd.enderman.arms_legs"] = rename_anim(v["animation.enderman.arms_legs"], HUMANOID)

    # Creeper ----------------------------------------------------------------
    a["animation.pd.creeper.legs"] = rename_anim(
        v["animation.creeper.legs"], QUAD, {"variable.leg_rot": "variable.pd_leg_rot"})
    a["animation.pd.creeper.swelling"] = rename_anim(
        v["animation.creeper.swelling"], QUAD,
        {"variable.swelling_scale1": "variable.pd_swell_scale1",
         "variable.swelling_scale2": "variable.pd_swell_scale2"})

    # Spider -----------------------------------------------------------------
    a["animation.pd.spider.default_leg_pose"] = rename_anim(v["animation.spider.default_leg_pose"], SPIDER)
    a["animation.pd.spider.walk"] = rename_anim(v["animation.spider.walk"], SPIDER)
    a["animation.pd.spider.look_at_target"] = rename_anim(v["animation.spider.look_at_target"], SPIDER)

    # Villager ---------------------------------------------------------------
    a["animation.pd.villager.general"] = rename_anim(v["animation.villager.general"], VILLAGER)
    a["animation.pd.villager.move"] = rename_anim(v["animation.villager.move"], VILLAGER)

    # Pig / cow / sheep ------------------------------------------------------
    a["animation.pd.quadruped.setup"] = rename_anim(v["animation.pig.setup"], QUAD)
    a["animation.pd.quadruped.walk"] = rename_anim(v["animation.quadruped.walk"], QUAD)
    a["animation.pd.sheep.setup"] = rename_anim(v["animation.sheep.setup"], QUAD)
    a["animation.pd.sheep.grazing"] = rename_anim(v["animation.sheep.grazing"], QUAD)

    # Wolf -------------------------------------------------------------------
    a["animation.pd.wolf.setup"] = rename_anim(v["animation.wolf.setup"], WOLF)
    a["animation.pd.wolf.leg_default"] = rename_anim(v["animation.wolf.leg_default"], WOLF)
    a["animation.pd.wolf.tail"] = rename_anim(
        v["animation.wolf.tail_default"], WOLF,
        # A wild wolf's tail angle (0.6283 rad) and no shake roll.
        {"query.tail_angle * 57.3": "36.0", "variable.tail_rot_z": "0.0"})
    a["animation.pd.wolf.tail_wag"] = rename_anim(
        v["animation.wolf.angry"], WOLF, {"query.is_angry ?": "0.0 ?"})

    # Chicken ----------------------------------------------------------------
    a["animation.pd.chicken.general"] = rename_anim(
        v["animation.chicken.general"], CHICKEN, {"variable.wing_flap": "variable.pd_wing_flap"})
    a["animation.pd.chicken.move"] = rename_anim(v["animation.chicken.move"], CHICKEN)

    # Bee --------------------------------------------------------------------
    a["animation.pd.bee.flying"] = rename_anim(v["animation.bee.flying"], BEE)
    a["animation.pd.bee.bobbing"] = rename_anim(v["animation.bee.fly.bobbing"], BEE)
    a["animation.pd.bee.sting"] = rename_anim(v["animation.bee.sting"], BEE)

    for name, anim in a.items():
        if not anim.get("bones"):
            raise SystemExit("animation %s ended up without bones" % name)
    return {"format_version": "1.8.0", "animations": a}


# Short name -> (animation id, blend/condition expression).  Order matters:
# it mirrors the order the vanilla mobs apply their own animations in.
def V(*ids):
    return "(" + " || ".join("query.variant == %d" % ID[k] for k in ids) + ")"


ANIMATE = [
    ("pd_hidden", "animation.pd.hidden", "query.variant > 0"),
    # zombie / skeleton / enderman
    ("pd_hum_look", "animation.pd.humanoid.look_at_target", V("zombie", "skeleton", "enderman")),
    ("pd_hum_move", "animation.pd.humanoid.move", V("zombie", "skeleton")),
    ("pd_ender_move", "animation.pd.enderman.move", V("enderman")),
    ("pd_hum_riding_arms", "animation.pd.humanoid.riding.arms", V("zombie", "skeleton") + " && query.is_riding"),
    ("pd_hum_riding_legs", "animation.pd.humanoid.riding.legs", V("zombie", "skeleton") + " && query.is_riding"),
    ("pd_hum_holding", "animation.pd.humanoid.holding", V("zombie", "skeleton")),
    ("pd_hum_attack", "animation.pd.humanoid.attack.rotations", V("zombie", "skeleton", "enderman") + " && variable.attack_time >= 0.0"),
    ("pd_hum_bob", "animation.pd.humanoid.bob", V("zombie", "skeleton", "enderman")),
    ("pd_zombie_arms", "animation.pd.zombie.arms", V("zombie") + " && !query.is_riding"),
    ("pd_skeleton_bow", "animation.pd.humanoid.bow_and_arrow",
     V("skeleton") + " && query.get_equipped_item_name == 'bow' && variable.item_use_normalized > 0.0 && variable.item_use_normalized < 1.0"),
    ("pd_ender_base_pose", "animation.pd.enderman.base_pose", V("enderman")),
    ("pd_ender_arms_legs", "animation.pd.enderman.arms_legs", V("enderman")),
    # creeper
    ("pd_look", "animation.pd.look_at_target",
     V("creeper", "villager", "pig", "cow", "sheep", "wolf", "chicken") + " && !query.is_sleeping"),
    ("pd_creeper_legs", "animation.pd.creeper.legs", V("creeper")),
    ("pd_creeper_swelling", "animation.pd.creeper.swelling", V("creeper")),
    # spider
    ("pd_spider_legs", "animation.pd.spider.default_leg_pose", V("spider")),
    ("pd_spider_walk", "animation.pd.spider.walk", V("spider") + " ? query.modified_move_speed : 0.0"),
    ("pd_spider_look", "animation.pd.spider.look_at_target", V("spider")),
    # villager
    ("pd_villager_general", "animation.pd.villager.general", V("villager")),
    ("pd_villager_move", "animation.pd.villager.move", V("villager") + " ? query.modified_move_speed : 0.0"),
    # pig / cow / sheep
    ("pd_quad_setup", "animation.pd.quadruped.setup", V("pig", "cow")),
    ("pd_sheep_setup", "animation.pd.sheep.setup", V("sheep")),
    ("pd_quad_walk", "animation.pd.quadruped.walk", V("pig", "cow", "sheep") + " ? query.modified_move_speed : 0.0"),
    ("pd_sheep_grazing", "animation.pd.sheep.grazing", V("sheep") + " && query.mark_variant == 2"),
    # wolf
    ("pd_wolf_setup", "animation.pd.wolf.setup", V("wolf")),
    ("pd_wolf_tail", "animation.pd.wolf.tail", V("wolf")),
    ("pd_wolf_tail_wag", "animation.pd.wolf.tail_wag", V("wolf")),
    ("pd_wolf_legs", "animation.pd.wolf.leg_default", V("wolf")),
    # chicken
    ("pd_chicken_general", "animation.pd.chicken.general", V("chicken")),
    ("pd_chicken_move", "animation.pd.chicken.move", V("chicken") + " ? query.modified_move_speed : 0.0"),
    # bee
    ("pd_bee_flying", "animation.pd.bee.flying", V("bee")),
    ("pd_bee_bobbing", "animation.pd.bee.bobbing", V("bee")),
    ("pd_bee_sting", "animation.pd.bee.sting", V("bee")),
]

PRE_ANIMATION = [
    "variable.pd_tcos0_ender = variable.tcos0 * 0.5;",
    "variable.pd_fuse_time = (query.variant == %d && query.mark_variant == 1) ? variable.pd_fuse_time + query.delta_time : 0.0;" % ID["creeper"],
    "variable.pd_swell = math.clamp(variable.pd_fuse_time / 1.5, 0.0, 1.0);",
    "variable.pd_wobble = math.sin(variable.pd_swell * 5730.0) * variable.pd_swell * 0.01 + 1.0;",
    "variable.pd_swell_scale1 = (math.pow(variable.pd_swell, 4.0) * 0.4 + 1.0) * variable.pd_wobble;",
    "variable.pd_swell_scale2 = (math.pow(variable.pd_swell, 4.0) * 0.1 + 1.0) / variable.pd_wobble;",
    "variable.pd_flash = math.mod(math.round(variable.pd_swell * 10.0), 2.0);",
    "variable.pd_leg_rot = math.cos(query.modified_distance_moved * 38.17326) * 80.22 * query.modified_move_speed;",
    "variable.pd_wing_flap = query.is_on_ground ? 0.0 : (math.sin(query.life_time * 1800.0) + 1.0) * 40.0;",
]


# ---------------------------------------------------------------------------
# Render controllers
# ---------------------------------------------------------------------------
SHOW = "!variable.is_first_person && !variable.map_face_icon && !query.is_spectator && !query.is_invisible"


def simple_rc(geometry, material, texture):
    return {
        "rebuild_animation_matrices": True,
        "geometry": "Geometry." + geometry,
        "materials": [{"*": "Material." + material}],
        "textures": ["Texture." + texture],
    }


def build_render_controllers():
    rc = {}
    for key in ["zombie", "skeleton", "spider", "enderman", "pig", "cow", "sheep", "wolf", "bee"]:
        rc["controller.render.pd." + key] = simple_rc("pd_" + key, "pd_" + key, "pd_" + key)

    creeper = simple_rc("pd_creeper", "pd_creeper", "pd_creeper")
    flash = "variable.pd_flash > 0.0 ? 1.0 : this"
    creeper["overlay_color"] = {"r": flash, "g": flash, "b": flash, "a": flash}
    rc["controller.render.pd.creeper"] = creeper

    rc["controller.render.pd.creeper_charged"] = {
        "rebuild_animation_matrices": True,
        "geometry": "Geometry.pd_creeper_charged",
        "part_visibility": [{"*": "query.is_powered"}],
        "materials": [{"*": "Material.pd_creeper_charged"}],
        "textures": ["Texture.pd_creeper_charged"],
        "overlay_color": {"r": 1.0, "g": 1.0, "b": 1.0, "a": 1.0},
        "uv_anim": {
            "offset": [
                "(query.is_powered) ? (Math.floor(query.life_time * 20.0) + query.frame_alpha) * 0.01 : 0.0",
                "(query.is_powered) ? (Math.floor(query.life_time * 20.0) + query.frame_alpha) * 0.01 : 0.0",
            ],
            "scale": [1.0, 1.0],
        },
        "light_color_multiplier": 0.5,
        "ignore_lighting": True,
    }

    rc["controller.render.pd.villager_base"] = simple_rc("pd_villager", "pd_villager", "pd_villager_base")
    rc["controller.render.pd.villager_clothes"] = {
        "rebuild_animation_matrices": True,
        "geometry": "Geometry.pd_villager",
        "materials": [{"*": "Material.pd_villager_masked"}],
        "textures": ["Texture.pd_villager_biome", "Texture.pd_villager_profession"],
    }

    rc["controller.render.pd.chicken"] = {
        "rebuild_animation_matrices": True,
        "geometry": "Geometry.pd_chicken",
        "materials": [{"*": "Material.pd_chicken"}, {"pd_leg*": "Material.pd_chicken_legs"}],
        "textures": ["Texture.pd_chicken"],
    }
    return {"format_version": "1.8.0", "render_controllers": rc}


RENDER_LIST = [
    ("controller.render.pd.zombie", "zombie", ""),
    ("controller.render.pd.skeleton", "skeleton", ""),
    ("controller.render.pd.creeper", "creeper", ""),
    ("controller.render.pd.creeper_charged", "creeper", " && query.is_powered"),
    ("controller.render.pd.spider", "spider", ""),
    ("controller.render.pd.enderman", "enderman", ""),
    ("controller.render.pd.villager_base", "villager", ""),
    ("controller.render.pd.villager_clothes", "villager", ""),
    ("controller.render.pd.pig", "pig", ""),
    ("controller.render.pd.cow", "cow", ""),
    ("controller.render.pd.sheep", "sheep", ""),
    ("controller.render.pd.wolf", "wolf", ""),
    ("controller.render.pd.chicken", "chicken", ""),
    ("controller.render.pd.bee", "bee", ""),
]


# ---------------------------------------------------------------------------
# Resource pack player override
# ---------------------------------------------------------------------------
def build_player_client_entity(samples):
    doc = load_lenient(os.path.join(samples, "resource_pack", "entity", "player.entity.json"))
    desc = doc["minecraft:client_entity"]["description"]

    for short, mat in MATERIALS.items():
        assert short not in desc["materials"]
        desc["materials"][short] = mat
    for short, tex in TEXTURES.items():
        assert short not in desc["textures"]
        desc["textures"][short] = tex
    for key in MODELS:
        desc["geometry"]["pd_" + key] = geo_id(key)

    scripts = desc["scripts"]
    # Disguises use the vanilla mob size (the villager is the only vanilla mob
    # that shares the player's 0.9375 render scale).
    scripts["scale"] = "(query.variant > 0 && query.variant != %d && !variable.is_first_person) ? 1.0 : 0.9375" % ID["villager"]
    scripts["initialize"].append("variable.pd_fuse_time = 0.0;")
    scripts["pre_animation"].extend(PRE_ANIMATION)
    for short, anim_id, cond in ANIMATE:
        assert short not in desc["animations"]
        desc["animations"][short] = anim_id
        scripts["animate"].append({short: cond})

    # Hide the normal player body while disguised; add the disguise passes.
    new_list = []
    for entry in desc["render_controllers"]:
        if isinstance(entry, dict) and "controller.render.player.third_person" in entry:
            cond = entry["controller.render.player.third_person"]
            entry = {"controller.render.player.third_person": "(%s) && query.variant == 0" % cond}
        new_list.append(entry)
    for rc_name, key, extra in RENDER_LIST:
        new_list.append({rc_name: "%s && query.variant == %d%s" % (SHOW, ID[key], extra)})
    desc["render_controllers"] = new_list
    return doc


# ---------------------------------------------------------------------------
# Behavior pack player override
# ---------------------------------------------------------------------------
def build_player_behavior(samples):
    doc = load_lenient(os.path.join(samples, "behavior_pack", "entities", "player.json"))
    ent = doc["minecraft:entity"]
    groups = ent["component_groups"]
    events = ent["events"]
    comps = ent["components"]

    disguise_groups = ["pd:none"] + ["pd:" + key for key, _, _ in DISGUISES] + ["pd:charged"]
    mark_groups = ["pd:mark_0", "pd:mark_1", "pd:mark_2"]
    wet_groups = ["pd:wet", "pd:dry"]

    groups["pd:none"] = {
        "minecraft:variant": {"value": 0},
        "minecraft:type_family": copy.deepcopy(comps["minecraft:type_family"]),
    }
    for key, did, fams in DISGUISES:
        g = {
            "minecraft:variant": {"value": did},
            "minecraft:type_family": {"family": fams + ["pd_disguised"]},
        }
        g.update(copy.deepcopy(EXTRA_COMPONENTS.get(key, {})))
        groups["pd:" + key] = g
    groups["pd:charged"] = {"minecraft:is_charged": {}}
    for i in range(3):
        groups["pd:mark_%d" % i] = {"minecraft:mark_variant": {"value": i}}
    groups["pd:wet"] = {"minecraft:skin_id": {"value": 1}}
    groups["pd:dry"] = {"minecraft:skin_id": {"value": 0}}

    def seq(remove, add):
        steps = []
        if remove:
            steps.append({"remove": {"component_groups": remove}})
        if add:
            steps.append({"add": {"component_groups": add}})
        return {"sequence": steps}

    for key, _, _ in DISGUISES:
        events["pd:set_" + key] = seq(disguise_groups, ["pd:" + key])
    events["pd:remove_disguise"] = seq(disguise_groups + mark_groups + wet_groups,
                                       ["pd:none", "pd:mark_0", "pd:dry"])
    for i in range(3):
        events["pd:mark_%d" % i] = seq(mark_groups, ["pd:mark_%d" % i])
    events["pd:charge_on"] = {"add": {"component_groups": ["pd:charged"]}}
    events["pd:charge_off"] = {"remove": {"component_groups": ["pd:charged"]}}
    events["pd:sensor_wet"] = seq(wet_groups, ["pd:wet"])
    events["pd:sensor_dry"] = seq(wet_groups, ["pd:dry"])

    # Water/rain sensor used by the script (rain stops sun burning, hurts
    # endermen, grounds bees).  Edge triggered thanks to the skin_id check.
    sensor = comps["minecraft:environment_sensor"]
    triggers = sensor["triggers"]
    if isinstance(triggers, dict):
        triggers = [triggers]
    triggers.append({
        "filters": {"all_of": [
            {"test": "is_variant", "subject": "self", "operator": "!=", "value": 0},
            {"test": "in_contact_with_water", "subject": "self", "operator": "==", "value": True},
            {"test": "is_skin_id", "subject": "self", "operator": "!=", "value": 1},
        ]},
        "event": "pd:sensor_wet",
    })
    triggers.append({
        "filters": {"all_of": [
            {"test": "in_contact_with_water", "subject": "self", "operator": "!=", "value": True},
            {"test": "is_skin_id", "subject": "self", "operator": "==", "value": 1},
        ]},
        "event": "pd:sensor_dry",
    })
    sensor["triggers"] = triggers
    return doc


# ---------------------------------------------------------------------------
def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("wrote", os.path.relpath(path, ROOT))


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    samples = os.path.abspath(sys.argv[1])

    for key in MODELS:
        write_json(os.path.join(RP, "models", "entity", "pd_%s.geo.json" % key), build_model(samples, key))
    write_json(os.path.join(RP, "animations", "pd_disguises.animation.json"), build_animations(samples))
    write_json(os.path.join(RP, "render_controllers", "pd_disguises.render_controllers.json"), build_render_controllers())
    write_json(os.path.join(RP, "entity", "player.entity.json"), build_player_client_entity(samples))
    write_json(os.path.join(BP, "entities", "player.json"), build_player_behavior(samples))


if __name__ == "__main__":
    main()
