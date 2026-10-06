"""Client entity / render controller / animation JSON for the infected creatures.

Every vanilla id used here (geometry, textures, animations, animation controllers,
render controllers, materials) exists in bedrock-samples v1.21.0.26-preview; formats
follow the vanilla file each entity is modelled on:
  cow/pig/sheep/chicken  -> client entity "1.10.0" with scripts.animate (like vanilla cow.entity.json)
  villager/human         -> client entity "1.8.0" with animation_controllers (like villager_v2 / zombie)
"""
from __future__ import annotations

import os

from infected_lib import write_json

TWITCH_T = "query.life_time"
ATTACK_T = "math.clamp(variable.attack_time, 0.0, 1.0)"

OVERLAY_RC = "controller.render.pas_infected_overlay"
SHEEP_OVERLAY_RC = "controller.render.pas_infected_sheep_overlay"
COW_BASE_RC = "controller.render.pas_infected_cow"
COW_MUSH_RC = "controller.render.pas_infected_cow_mushrooms"
ATTACK_AC = "controller.animation.pas_infected.attack"
TWITCH_AC = "controller.animation.pas_infected.twitch"

OVERLAY_MATERIALS = {"overlay": "entity_alphatest", "glow": "spider"}


def anim_id(key: str, what: str) -> str:
    return f"animation.pas_infected.{key}.{what}"


# ---------------------------------------------------------------------------
# render controllers / animation controllers (shared)
# ---------------------------------------------------------------------------

def render_controllers() -> dict:
    overlay_mats = [{"*": "Material.overlay"}, {"glow*": "Material.glow"}]
    return {
        "format_version": "1.8.0",
        "render_controllers": {
            OVERLAY_RC: {
                "rebuild_animation_matrices": True,
                "geometry": "Geometry.overlay",
                "materials": overlay_mats,
                "textures": ["Texture.overlay"],
            },
            SHEEP_OVERLAY_RC: {
                "rebuild_animation_matrices": True,
                "arrays": {"geometries": {"Array.overlays": ["Geometry.overlay", "Geometry.overlay_sheared"]}},
                "geometry": "Array.overlays[query.is_sheared]",
                "materials": overlay_mats,
                "textures": ["Texture.overlay"],
            },
            COW_BASE_RC: {
                "arrays": {"textures": {"Array.skins": ["Texture.default", "Texture.red", "Texture.brown"]}},
                "geometry": "Geometry.default",
                "materials": [{"*": "Material.default"}],
                "textures": ["Array.skins[query.variant]"],
            },
            COW_MUSH_RC: {
                "rebuild_animation_matrices": True,
                "arrays": {"textures": {"Array.mushrooms": ["Texture.mushroom_red", "Texture.mushroom_brown"]}},
                "geometry": "Geometry.mushrooms",
                "materials": [{"*": "Material.mushroom"}],
                "textures": ["Array.mushrooms[query.variant == 2]"],
            },
        },
    }


def animation_controllers() -> dict:
    return {
        "format_version": "1.10.0",
        "animation_controllers": {
            # same pattern as vanilla warden (attack while variable.attack_time > 0)
            ATTACK_AC: {
                "initial_state": "default",
                "states": {
                    "default": {"transitions": [{"attacking": "variable.attack_time > 0.0"}]},
                    "attacking": {
                        "animations": ["attack"],
                        "transitions": [{"default": "variable.attack_time <= 0.0"}],
                    },
                },
            },
            TWITCH_AC: {
                "initial_state": "default",
                "states": {"default": {"animations": ["twitch"]}},
            },
        },
    }


# ---------------------------------------------------------------------------
# animations
# ---------------------------------------------------------------------------

def _f(x: float) -> str:
    return "%g" % round(float(x), 4)


def wobble(speed: float, phase: float, amp: float) -> str:
    return f"math.sin({TWITCH_T} * {_f(speed)} + {_f(phase)}) * {_f(amp)}"


def spike(speed: float, phase: float, amp: float) -> str:
    """Short jerks: sin^9 is near 0 most of the time and snaps to +-1 twice per period."""
    return f"math.pow(math.sin({TWITCH_T} * {_f(speed)} + {_f(phase)}), 9.0) * {_f(amp)}"


AGITATION = "(1.0 + variable.has_target * 0.8)"


def twitch_animation(sp, extra: dict | None = None) -> dict:
    """Idle parasitic twitching of the growths (loops forever, additive)."""
    bones: dict = {}
    gb = sp.growth_bones
    for i, chain in enumerate(gb.get("tendrils", [])):
        ph = 37.0 * i
        for j, bn in enumerate(chain):
            amp_z = (4.0, 7.0, 10.0, 12.0)[j]
            amp_x = (3.0, 5.0, 6.0, 6.0)[j]
            spd = 140.0 + 23.0 * i + 35.0 * j
            bones[bn] = {"rotation": [
                f"({wobble(spd * 0.7, ph + 20 * j, amp_x)}) * {AGITATION}",
                0.0,
                f"({wobble(spd, ph + 40 * j, amp_z)} + {spike(61.0 + 7 * i, ph, 9.0 + 3 * j)}) * {AGITATION}",
            ]}
    for i, hn in enumerate(gb.get("heads", [])):
        ph = 71.0 * i + 13.0
        bones[hn] = {"rotation": [
            f"{spike(47.0 + 11 * i, ph, 16.0)}",
            f"{wobble(55.0 + 9 * i, ph, 14.0)}",
            f"{wobble(83.0 + 5 * i, ph + 90, 5.0)}",
        ]}
    if gb.get("jaw"):
        bones[gb["jaw"]] = {"rotation": [f"{wobble(420.0, 0.0, 2.5)} + {spike(53.0, 30.0, 10.0)}", 0.0, 0.0]}
    for k, v in (extra or {}).items():
        bones[k] = v
    return {"loop": True, "bones": bones}


def _kf(points: dict) -> dict:
    """{time: [x,y,z]} keyframes with linear interpolation."""
    return {_f(t): v for t, v in sorted(points.items())}


def attack_animation(sp, kind: str) -> dict:
    """Driven by variable.attack_time (0..1 during a melee swing), keyframed via anim_time_update."""
    gb = sp.growth_bones
    b: dict = {}
    if kind == "quadruped":
        b["head"] = {
            "rotation": _kf({0: [0, 0, 0], 0.25: [-24, 0, 0], 0.5: [20, 0, 0], 0.75: [8, 0, 0], 1: [0, 0, 0]}),
            "position": _kf({0: [0, 0, 0], 0.25: [0, 0.5, 1], 0.5: [0, -1, -3], 0.75: [0, -0.5, -1.5], 1: [0, 0, 0]}),
        }
        b["body"] = {"position": _kf({0: [0, 0, 0], 0.5: [0, 0, -1.2], 1: [0, 0, 0]})}
        if gb.get("jaw"):
            b[gb["jaw"]] = {"rotation": _kf({0: [0, 0, 0], 0.25: [32, 0, 0], 0.45: [-12, 0, 0], 0.7: [6, 0, 0], 1: [0, 0, 0]})}
    elif kind == "chicken":
        b["head"] = {
            "rotation": _kf({0: [0, 0, 0], 0.25: [-20, 0, 0], 0.5: [48, 0, 0], 0.75: [15, 0, 0], 1: [0, 0, 0]}),
            "position": _kf({0: [0, 0, 0], 0.25: [0, 0.5, 1], 0.5: [0, -1, -2.5], 1: [0, 0, 0]}),
        }
        b["wing0"] = {"rotation": _kf({0: [0, 0, 0], 0.3: [0, 0, 70], 0.6: [0, 0, 30], 1: [0, 0, 0]})}
        b["wing1"] = {"rotation": _kf({0: [0, 0, 0], 0.3: [0, 0, -70], 0.6: [0, 0, -30], 1: [0, 0, 0]})}
    elif kind == "villager":
        b["arms"] = {
            "rotation": _kf({0: [0, 0, 0], 0.3: [-100, 0, 0], 0.55: [28, 0, 0], 0.8: [10, 0, 0], 1: [0, 0, 0]}),
            "position": _kf({0: [0, 0, 0], 0.3: [0, 2, 0], 0.55: [0, -1, -1], 1: [0, 0, 0]}),
        }
        b["head"] = {"rotation": _kf({0: [0, 0, 0], 0.3: [-12, 0, 0], 0.55: [16, 0, 0], 1: [0, 0, 0]}),
                     "position": _kf({0: [0, 0, 0], 0.55: [0, 0, -1.5], 1: [0, 0, 0]})}
        b["body"] = {"rotation": _kf({0: [0, 0, 0], 0.3: [-3, 0, 0], 0.55: [7, 0, 0], 1: [0, 0, 0]})}
    elif kind == "human":
        b["head"] = {"rotation": _kf({0: [0, 0, 0], 0.4: [16, 0, 0], 1: [0, 0, 0]}),
                     "position": _kf({0: [0, 0, 0], 0.4: [0, 0, -1.5], 1: [0, 0, 0]})}
        b["body"] = {"rotation": _kf({0: [0, 0, 0], 0.4: [9, 0, 0], 1: [0, 0, 0]})}
    # growths lunge with the bite / swipe
    for i, chain in enumerate(gb.get("tendrils", [])):
        b[chain[0]] = {"rotation": _kf({0: [0, 0, 0], 0.3: [-18, 0, 0], 0.55: [34, 0, 0], 1: [0, 0, 0]})}
        if len(chain) > 1:
            sgn = -1 if i % 2 else 1
            b[chain[1]] = {"rotation": _kf({0: [0, 0, 0], 0.3: [0, 0, 12 * sgn], 0.55: [22, 0, -16 * sgn], 1: [0, 0, 0]})}
    for hn in gb.get("heads", []):
        b[hn] = {"rotation": _kf({0: [0, 0, 0], 0.3: [-14, 0, 0], 0.55: [26, 0, 0], 1: [0, 0, 0]})}
    return {"loop": True, "animation_length": 1.0, "anim_time_update": ATTACK_T, "bones": b}


def animations(specs: dict) -> dict:
    out = {}
    kinds = {"cow": "quadruped", "pig": "quadruped", "sheep": "quadruped", "chicken": "chicken",
             "villager": "villager", "human": "human"}
    for key, sp in specs.items():
        extra = None
        if key == "chicken":
            extra = {"wing0": {"rotation": [0.0, 0.0, spike(57.0, 10.0, 12.0)]},
                     "wing1": {"rotation": [0.0, 0.0, spike(57.0, 40.0, -12.0)]}}
        if key in ("villager", "human"):
            extra = {"head": {"rotation": [spike(43.0, 5.0, 7.0), 0.0, wobble(37.0, 0.0, 3.0)]}}
        else:
            extra = dict(extra or {})
            extra["head"] = {"rotation": [spike(43.0, 5.0, 6.0), 0.0, wobble(37.0, 0.0, 2.5)]}
        out[anim_id(key, "twitch")] = twitch_animation(sp, extra)
        out[anim_id(key, "attack")] = attack_animation(sp, kinds[key])
    return {"format_version": "1.8.0", "animations": out}


# ---------------------------------------------------------------------------
# client entities
# ---------------------------------------------------------------------------

def _entity(fmt: str, desc: dict) -> dict:
    return {"format_version": fmt, "minecraft:client_entity": {"description": desc}}


def entity_cow(tex) -> dict:
    return _entity("1.10.0", {
        "identifier": "pas:infected_cow",
        "materials": {"default": "cow", **OVERLAY_MATERIALS, "mushroom": "entity_alphatest"},
        "textures": {
            "default": "textures/entity/cow/cow",
            "red": "textures/entity/cow/mooshroom",
            "brown": "textures/entity/cow/brown_mooshroom",
            "overlay": tex("cow"),
            "mushroom_red": "textures/blocks/mushroom_red",
            "mushroom_brown": "textures/blocks/mushroom_brown",
        },
        "geometry": {"default": "geometry.cow.v1.8", "overlay": "geometry.pas.infected_cow",
                     "mushrooms": "geometry.pas.infected_cow.mushrooms"},
        "animations": {
            "setup": "animation.cow.setup",
            "walk": "animation.quadruped.walk",
            "look_at_target": "animation.common.look_at_target",
            "baby_transform": "animation.cow.baby_transform",
            "twitch": anim_id("cow", "twitch"),
            "attack": anim_id("cow", "attack"),
            "attack_controller": ATTACK_AC,
        },
        "scripts": {"animate": ["setup", {"walk": "query.modified_move_speed"}, "look_at_target", "twitch",
                                "attack_controller", {"baby_transform": "query.is_baby"}]},
        "render_controllers": [COW_BASE_RC, OVERLAY_RC, {COW_MUSH_RC: "query.variant > 0"}],
        "enable_attachables": False,
    })


def entity_pig(tex) -> dict:
    return _entity("1.10.0", {
        "identifier": "pas:infected_pig",
        "materials": {"default": "pig", **OVERLAY_MATERIALS},
        "textures": {"default": "textures/entity/pig/pig", "saddled": "textures/entity/pig/pig_saddle",
                     "overlay": tex("pig")},
        "geometry": {"default": "geometry.pig.v1.8", "overlay": "geometry.pas.infected_pig"},
        "animations": {
            "setup": "animation.pig.setup",
            "walk": "animation.quadruped.walk",
            "look_at_target": "animation.common.look_at_target",
            "baby_transform": "animation.pig.baby_transform",
            "twitch": anim_id("pig", "twitch"),
            "attack": anim_id("pig", "attack"),
            "attack_controller": ATTACK_AC,
        },
        "scripts": {"animate": ["setup", {"walk": "query.modified_move_speed"}, "look_at_target", "twitch",
                                "attack_controller", {"baby_transform": "query.is_baby"}]},
        "render_controllers": ["controller.render.pig", OVERLAY_RC],
        "enable_attachables": False,
    })


def entity_sheep(tex) -> dict:
    return _entity("1.10.0", {
        "identifier": "pas:infected_sheep",
        "materials": {"default": "sheep", **OVERLAY_MATERIALS},
        "textures": {"default": "textures/entity/sheep/sheep", "overlay": tex("sheep")},
        "geometry": {"default": "geometry.sheep.v1.8", "sheared": "geometry.sheep.sheared.v1.8",
                     "overlay": "geometry.pas.infected_sheep", "overlay_sheared": "geometry.pas.infected_sheep.sheared"},
        "animations": {
            "setup": "animation.sheep.setup",
            "grazing": "animation.sheep.grazing",
            "walk": "animation.quadruped.walk",
            "look_at_target": "animation.common.look_at_target",
            "baby_transform": "animation.sheep.baby_transform",
            "move": "controller.animation.sheep.move",
            "twitch": anim_id("sheep", "twitch"),
            "attack": anim_id("sheep", "attack"),
            "attack_controller": ATTACK_AC,
        },
        "scripts": {"animate": ["setup", "look_at_target", "move", "twitch", "attack_controller",
                                {"baby_transform": "query.is_baby"}]},
        "render_controllers": ["controller.render.sheep", SHEEP_OVERLAY_RC],
        "enable_attachables": False,
    })


def entity_chicken(tex) -> dict:
    return _entity("1.10.0", {
        "identifier": "pas:infected_chicken",
        "materials": {"default": "chicken", "legs": "chicken_legs", **OVERLAY_MATERIALS},
        "textures": {"default": "textures/entity/chicken", "overlay": tex("chicken")},
        "geometry": {"default": "geometry.chicken.v1.12", "overlay": "geometry.pas.infected_chicken"},
        "scripts": {
            # vanilla chickens get variable.wing_flap from the engine; a custom entity sets its own
            "pre_animation": [
                "variable.wing_flap = query.is_on_ground ? 0.0 : (math.sin(query.life_time * 1600.0) + 1.0) * 40.0;"
            ],
            "animate": ["general", {"move": "query.modified_move_speed"}, "look_at_target", "twitch",
                        "attack_controller", {"baby_transform": "query.is_baby"}],
        },
        "animations": {
            "move": "animation.chicken.move",
            "general": "animation.chicken.general",
            "look_at_target": "animation.common.look_at_target",
            "baby_transform": "animation.chicken.baby_transform",
            "twitch": anim_id("chicken", "twitch"),
            "attack": anim_id("chicken", "attack"),
            "attack_controller": ATTACK_AC,
        },
        "render_controllers": ["controller.render.chicken", OVERLAY_RC],
        "enable_attachables": False,
    })


VILLAGER_TEXTURES = {
    "base": "textures/entity/villager2/villager",
    "base2": "textures/entity/villager2/villager",
    "base3": "textures/entity/villager2/villager",
    "base4": "textures/entity/villager2/villager",
    "base5": "textures/entity/villager2/villager",
    "base6": "textures/entity/villager2/villager",
    "desert": "textures/entity/villager2/biomes/biome_desert",
    "jungle": "textures/entity/villager2/biomes/biome_jungle",
    "plains": "textures/entity/villager2/biomes/biome_plains",
    "savanna": "textures/entity/villager2/biomes/biome_savanna",
    "snow": "textures/entity/villager2/biomes/biome_snow",
    "swamp": "textures/entity/villager2/biomes/biome_swamp",
    "taiga": "textures/entity/villager2/biomes/biome_taiga",
    "armorer": "textures/entity/villager2/professions/armorer",
    "butcher": "textures/entity/villager2/professions/butcher",
    "cartographer": "textures/entity/villager2/professions/cartographer",
    "cleric": "textures/entity/villager2/professions/cleric",
    "farmer": "textures/entity/villager2/professions/farmer",
    "fisherman": "textures/entity/villager2/professions/fisherman",
    "fletcher": "textures/entity/villager2/professions/fletcher",
    "leatherworker": "textures/entity/villager2/professions/leatherworker",
    "librarian": "textures/entity/villager2/professions/librarian",
    "shepherd": "textures/entity/villager2/professions/shepherd",
    "tool_smith": "textures/entity/villager2/professions/toolsmith",
    "weapon_smith": "textures/entity/villager2/professions/weaponsmith",
    "stonemason": "textures/entity/villager2/professions/stonemason",
    "nitwit": "textures/entity/villager2/professions/nitwit",
    "unskilled": "textures/entity/villager2/professions/unskilled",
}


def entity_villager(tex) -> dict:
    return _entity("1.8.0", {
        "identifier": "pas:infected_villager",
        "materials": {"default": "villager_v2", "masked": "villager_v2_masked", **OVERLAY_MATERIALS},
        "textures": {**VILLAGER_TEXTURES, "overlay": tex("villager")},
        "geometry": {"default": "geometry.villager_v2", "overlay": "geometry.pas.infected_villager"},
        "scripts": {
            "scale": "0.9375",
            # identical to vanilla villager_v2: controller.render.villager_v2_masked reads variable.profession_index
            "pre_animation": [
                "variable.num_professions = 15;",
                "variable.profession_index = (query.variant < variable.num_professions ? query.variant : 0);",
            ],
        },
        "animations": {
            "general": "animation.villager.general",
            "look_at_target": "animation.common.look_at_target",
            "move": "animation.villager.move",
            "baby_transform": "animation.villager.baby_transform",
            "get_in_bed": "animation.villager.get_in_bed",
            "twitch": anim_id("villager", "twitch"),
            "attack": anim_id("villager", "attack"),
        },
        "animation_controllers": [
            {"general": "controller.animation.villager_v2.general"},
            {"move": "controller.animation.villager_v2.move"},
            {"baby": "controller.animation.villager_v2.baby"},
            {"pas_attack": ATTACK_AC},
            {"pas_twitch": TWITCH_AC},
        ],
        "render_controllers": ["controller.render.villager_v2_base", "controller.render.villager_v2_masked", OVERLAY_RC],
        "enable_attachables": False,
    })


def entity_human(tex) -> dict:
    return _entity("1.8.0", {
        "identifier": "pas:infected_human",
        "materials": {"default": "entity_alphatest", **OVERLAY_MATERIALS},
        "textures": {"default": "textures/entity/steve", "overlay": tex("human")},
        "geometry": {"default": "geometry.humanoid.custom", "overlay": "geometry.pas.infected_human"},
        "scripts": {
            "pre_animation": [
                "variable.tcos0 = (Math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed / variable.gliding_speed_value) * 57.3;"
            ],
        },
        "animations": {
            "look_at_target_default": "animation.humanoid.look_at_target.default",
            "look_at_target_gliding": "animation.humanoid.look_at_target.gliding",
            "look_at_target_swimming": "animation.humanoid.look_at_target.swimming",
            "move": "animation.humanoid.move",
            "attack.rotations": "animation.humanoid.attack.rotations",
            "bob": "animation.humanoid.bob",
            "zombie_attack_bare_hand": "animation.zombie.attack_bare_hand",
            "swimming": "animation.zombie.swimming",
            "twitch": anim_id("human", "twitch"),
            "attack": anim_id("human", "attack"),
        },
        "animation_controllers": [
            {"look_at_target": "controller.animation.humanoid.look_at_target"},
            {"move": "controller.animation.humanoid.move"},
            {"attack": "controller.animation.humanoid.attack"},
            {"bob": "controller.animation.humanoid.bob"},
            {"zombie_attack_bare_hand": "controller.animation.zombie.attack_bare_hand"},
            {"swimming": "controller.animation.zombie.swimming"},
            {"pas_attack": ATTACK_AC},
            {"pas_twitch": TWITCH_AC},
        ],
        "render_controllers": ["controller.render.zombie", OVERLAY_RC],
        "enable_attachables": False,
    })


ENTITY_BUILDERS = {
    "villager": entity_villager, "cow": entity_cow, "pig": entity_pig,
    "sheep": entity_sheep, "chicken": entity_chicken, "human": entity_human,
}


def write_all(rp: str, specs: dict, texture_path) -> None:
    for key in specs:
        write_json(os.path.join(rp, "entity", f"pas_infected_{key}.entity.json"), ENTITY_BUILDERS[key](texture_path))
    write_json(os.path.join(rp, "render_controllers", "pas_infected.render_controllers.json"), render_controllers())
    write_json(os.path.join(rp, "animations", "pas_infected.animation.json"), animations(specs))
    write_json(os.path.join(rp, "animation_controllers", "pas_infected.animation_controllers.json"),
               animation_controllers())
