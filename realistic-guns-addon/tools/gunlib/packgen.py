"""Generates every file of the Realistic Guns behavior + resource packs."""
import json
import math
import os
import shutil

import numpy as np

from .model import layout_uvs, export_geometry, FACES
from .texture import paint_atlas, save_png
from .hold import first_person_pose, third_person_pose, camera_orientation
from .rig import (vanilla_player, player_rig_matrices, binding_matrix, first_person_camera,
                  PLAYER_SCALE)
from .specs import NS, GUNS, AMMO, fire_interval_ticks

MIN_ENGINE = [1, 21, 100]
PACK_VERSION = [1, 0, 0]
SCRIPT_API = "2.0.0"  # stable in 1.21.90+, incl. 1.21.100 release and 1.21.100.2x previews
ITEM_FORMAT = "1.21.100"

UUIDS = {
    "bp_header": "1d4b4684-1525-42b8-a008-930061290ac3",
    "bp_data": "57739d44-9ff4-48e2-a27d-ea27a090bed8",
    "bp_script": "1cbfdcb6-65fb-4170-b92d-34532d02062c",
    "rp_header": "4534fe80-3b41-4ac4-8258-1347dadc9298",
    "rp_resources": "8d8eff7a-e424-4902-aa2b-76443845289d",
}

TEX = 128
PX_TO_BLOCKS = PLAYER_SCALE / 16.0


def _r(v, nd=3):
    v = round(float(v), nd)
    return 0.0 if v == 0 else v


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


# ---------------------------------------------------------------------------
# Gun models, textures, attachables, animations
# ---------------------------------------------------------------------------
class BuiltGun:
    def __init__(self, spec, model, tex, geo, fp, tp, muzzle_fp, muzzle_tp, port_fp, density):
        self.spec = spec
        self.model = model
        self.tex = tex
        self.geo = geo
        self.fp = fp
        self.tp = tp
        self.muzzle_fp = muzzle_fp
        self.muzzle_tp = muzzle_tp
        self.port_fp = port_fp
        self.density = density


def _front_f(model):
    lo, hi = model.bounds()
    return -lo[2]  # internal z is -f


def build_gun(spec, player):
    model = spec["builder"]()
    density = layout_uvs(model, TEX, TEX)
    tex = paint_atlas(model, TEX, TEX, seed_base=sum(map(ord, spec["id"])))
    geo = export_geometry(model, f"geometry.{NS}.{spec['id']}", TEX, TEX,
                          recoil_pivot=spec["recoil_pivot"])
    fpp = spec["fp"]
    fp_pos, fp_rot = first_person_pose(player, fpp["grip"], fpp["aim"], fpp["bore"], fpp["roll"])
    tp_pos, tp_rot = third_person_pose(player)
    # muzzle / ejection port positions for the script (blocks)
    bore = fpp["bore"]
    front = _front_f(model)
    grip = np.asarray(fpp["grip"], dtype=float)
    target = np.array([0.0, 0.0, fpp["aim"]])
    fwd = target - (grip + np.array([0, bore, 0]))
    R_cam = camera_orientation(fwd, fpp["roll"])
    muzzle_int = np.array([0.0, bore, -(front + 0.6)])
    port_int = np.array([0.8, bore, -1.0])
    muzzle_cam = (grip + R_cam @ muzzle_int) * PX_TO_BLOCKS
    port_cam = (grip + R_cam @ port_int) * PX_TO_BLOCKS
    # third person: model space (x right, y up, -z forward) relative to the feet
    mats = player_rig_matrices(player, False)
    ri = player.bones["rightItem"].pivot
    hand = (mats["rightItem"] @ np.append(ri, 1.0))[:3] + np.array([0.0, -0.6, 0.6])
    m_tp = hand + muzzle_int
    muzzle_tp = np.array([m_tp[0], m_tp[1], -m_tp[2]]) * PX_TO_BLOCKS
    return BuiltGun(spec, model, tex, geo, (fp_pos, fp_rot), (tp_pos, tp_rot),
                    muzzle_cam, muzzle_tp, port_cam, density)


def gun_animations(bg):
    s = bg.spec
    gid = s["id"]
    pre = f"animation.{NS}.{gid}"
    fp_pos, fp_rot = bg.fp
    tp_pos, tp_rot = bg.tp
    back, up, _ = s["kick"]
    drop = s.get("mag_drop", 5.0)
    anims = {
        f"{pre}.first_person": {
            "loop": True,
            "bones": {"gun": {"position": [_r(v) for v in fp_pos],
                              "rotation": [_r(v) for v in fp_rot]}},
        },
        f"{pre}.third_person": {
            "loop": True,
            "bones": {"gun": {"position": [_r(v) for v in tp_pos],
                              "rotation": [_r(v) for v in tp_rot]}},
        },
        f"{pre}.kick": {
            "loop": True,
            "bones": {"recoil": {
                "position": [0.0, f"v.kick * {_r(back * 0.12)}", f"v.kick * {_r(back)}"],
                "rotation": [f"-v.kick * {_r(up)}", 0.0, f"v.kick * {_r(up * 0.15)}"],
            }},
        },
    }
    if "slide" in bg.model.bone_pivots:
        # pistols: the slide blows back and returns with every shot
        anims[f"{pre}.kick"]["bones"]["slide"] = {"position": [0.0, 0.0, "v.kick * 1.15"]}
    if s.get("shell_reload"):
        # shell-by-shell: tilt the gun and push a shell up into the loading port
        anims[f"{pre}.reload"] = {
            "loop": True,
            "bones": {
                "recoil": {"rotation": ["-6.0 * v.rw", "-4.0 * v.rw", "18.0 * v.rw"],
                           "position": [0.0, "-0.6 * v.rw", 0.0]},
                "mag": {"position": [0.0, "-2.2 * (1.0 - v.rt)", "0.6 * (1.0 - v.rt)"],
                        "scale": "v.rt > 0.08 && v.rt < 0.9 ? 1.0 : 0.0"},
            },
        }
    else:
        anims[f"{pre}.reload"] = {
            "loop": True,
            "bones": {
                "recoil": {"rotation": ["-9.0 * v.rw", "-6.0 * v.rw", "26.0 * v.rw"],
                           "position": [0.0, "-1.0 * v.rw", "0.4 * v.rw"]},
                "mag": {"position": [0.0, f"-{_r(drop)} * v.md", "0.4 * v.md"],
                        "scale": "v.md > 0.97 ? 0.0 : 1.0"},
            },
        }
    if gid == "awp":
        anims[f"{pre}.cycle"] = {
            "loop": True,
            "bones": {"bolt": {
                "rotation": [0.0, 0.0, "62.0 * math.clamp(math.min(v.cp / 0.16, (1.0 - v.cp) / 0.16), 0.0, 1.0)"],
                "position": [0.0, 0.0, "1.6 * math.clamp(math.min((v.cp - 0.16) / 0.3, (0.84 - v.cp) / 0.3), 0.0, 1.0)"],
            }},
        }
    if gid == "spas12":
        anims[f"{pre}.cycle"] = {
            "loop": True,
            "bones": {"pump": {
                "position": [0.0, 0.0, "1.5 * math.clamp(math.min(v.cp / 0.4, (1.0 - v.cp) / 0.4), 0.0, 1.0)"],
            }},
        }
    if s.get("zoom_fov"):
        anims[f"{pre}.scoped"] = {
            "loop": True,
            "bones": {"gun": {"scale": 0.0}},
        }
    return {"format_version": "1.10.0", "animations": anims}


def gun_attachable(bg):
    s = bg.spec
    gid = s["id"]
    pre = f"animation.{NS}.{gid}"
    kick_s = s["kick"][2] / 20.0
    reload_s = s["reload_ticks"] / 20.0
    pre_anim = [
        f"v.kick = math.clamp(q.cooldown_time_remaining('{NS}_kick') / {_r(kick_s)}, 0.0, 1.0);",
        f"v.rl = q.cooldown_time_remaining('{NS}_reload');",
        f"v.rt = v.rl > 0.0 ? 1.0 - math.clamp(v.rl / {_r(reload_s)}, 0.0, 1.0) : 0.0;",
        "v.rw = v.rl > 0.0 ? math.clamp(math.min(v.rt / 0.18, (1.0 - v.rt) / 0.18), 0.0, 1.0) : 0.0;",
        "v.md = v.rl > 0.0 ? (v.rt < 0.5 ? math.clamp((v.rt - 0.12) / 0.22, 0.0, 1.0) : "
        "math.clamp(1.0 - (v.rt - 0.55) / 0.22, 0.0, 1.0)) : 0.0;",
    ]
    animations = {
        "first_person": f"{pre}.first_person",
        "third_person": f"{pre}.third_person",
        "kick": f"{pre}.kick",
        "reload": f"{pre}.reload",
    }
    animate = [
        {"first_person": "c.is_first_person"},
        {"third_person": "!c.is_first_person"},
        "kick",
        "reload",
    ]
    if s.get("cycle_ticks"):
        cyc = s["cycle_ticks"] / 20.0
        pre_anim.append(f"v.cy = q.cooldown_time_remaining('{NS}_cycle');")
        pre_anim.append(f"v.cp = v.cy > 0.0 ? 1.0 - math.clamp(v.cy / {_r(cyc)}, 0.0, 1.0) : 0.0;")
        animations["cycle"] = f"{pre}.cycle"
        animate.append("cycle")
    if s.get("zoom_fov"):
        animations["scoped"] = f"{pre}.scoped"
        animate.append({"scoped": "c.is_first_person && q.is_sneaking && v.rl <= 0.0"})
    return {
        "format_version": "1.10.0",
        "minecraft:attachable": {
            "description": {
                "identifier": f"{NS}:{gid}",
                "materials": {"default": "entity_alphatest", "enchanted": "entity_alphatest_glint"},
                "textures": {"default": f"textures/{NS}/guns/{gid}",
                             "enchanted": "textures/misc/enchanted_item_glint"},
                "geometry": {"default": f"geometry.{NS}.{gid}"},
                "animations": animations,
                "scripts": {"pre_animation": pre_anim, "animate": animate},
                "render_controllers": [f"controller.render.{NS}.gun"],
            }
        },
    }


def render_controllers():
    return {
        "format_version": "1.10.0",
        "render_controllers": {
            f"controller.render.{NS}.gun": {
                "geometry": "Geometry.default",
                "materials": [{"*": "variable.is_enchanted ? Material.enchanted : Material.default"}],
                "textures": ["Texture.default", "Texture.enchanted"],
            },
            f"controller.render.{NS}.bullet": {
                "geometry": "Geometry.default",
                "materials": [{"*": "Material.default"}],
                "textures": ["Texture.default"],
                "filter_lighting": True,
            },
        },
    }


# ---------------------------------------------------------------------------
# Bullet entity
# ---------------------------------------------------------------------------
def bullet_entity_bp():
    # format/fields mirror the vanilla 1.21.100 arrow so the projectile parses identically
    return {
        "format_version": "1.21.40",
        "minecraft:entity": {
            "description": {
                "identifier": f"{NS}:bullet",
                "is_spawnable": False,
                "is_summonable": True,
            },
            "component_groups": {
                f"{NS}:expire": {"minecraft:instant_despawn": {}},
            },
            "components": {
                "minecraft:collision_box": {"width": 0.15, "height": 0.15},
                "minecraft:projectile": {
                    "on_hit": {"remove_on_hit": {}},
                    "gravity": 0.0,
                    "inertia": 1.0,
                    "liquid_inertia": 0.55,
                    "uncertainty_base": 0.0,
                    "uncertainty_multiplier": 0.0,
                },
                "minecraft:physics": {},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
                "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
                "minecraft:timer": {
                    "looping": False,
                    "time": 4.0,
                    "randomInterval": False,
                    "time_down_event": {"event": f"{NS}:expire", "target": "self"},
                },
                "minecraft:conditional_bandwidth_optimization": {
                    "default_values": {"max_optimized_distance": 80.0, "max_dropped_ticks": 2,
                                       "use_motion_prediction_hints": True}
                },
                "minecraft:type_family": {"family": [f"{NS}_bullet", "projectile", "inanimate"]},
            },
            "events": {
                f"{NS}:expire": {"add": {"component_groups": [f"{NS}:expire"]}},
            },
        },
    }


def bullet_entity_rp():
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": f"{NS}:bullet",
                "materials": {"default": "entity_alphatest"},
                "textures": {"default": f"textures/{NS}/entity/bullet"},
                "geometry": {"default": f"geometry.{NS}.bullet"},
                "particle_effects": {"trail": f"{NS}:bullet_trail"},
                "animations": {"move": f"animation.{NS}.bullet.move",
                               "trail": f"animation.{NS}.bullet.trail"},
                "scripts": {"animate": ["move", "trail"]},
                "render_controllers": [f"controller.render.{NS}.bullet"],
            }
        },
    }


def bullet_geometry():
    return {
        "format_version": "1.16.0",
        "minecraft:geometry": [{
            "description": {"identifier": f"geometry.{NS}.bullet", "texture_width": 16,
                            "texture_height": 16, "visible_bounds_width": 1,
                            "visible_bounds_height": 1, "visible_bounds_offset": [0, 0.25, 0]},
            "bones": [{
                "name": "body", "pivot": [0, 0, 0],
                "cubes": [{"origin": [-0.35, -0.35, -1.5], "size": [0.7, 0.7, 3.0],
                           "uv": {"north": {"uv": [0, 0], "uv_size": [2, 2]},
                                  "south": {"uv": [2, 0], "uv_size": [2, 2]},
                                  "east": {"uv": [0, 2], "uv_size": [6, 2]},
                                  "west": {"uv": [0, 4], "uv_size": [6, 2]},
                                  "up": {"uv": [0, 6], "uv_size": [2, 6]},
                                  "down": {"uv": [2, 6], "uv_size": [2, 6]}}}],
            }],
        }],
    }


def bullet_animations():
    return {
        "format_version": "1.10.0",
        "animations": {
            f"animation.{NS}.bullet.move": {
                "loop": True,
                "bones": {"body": {"rotation": ["-query.target_x_rotation", "-query.target_y_rotation", 0.0]}},
            },
            f"animation.{NS}.bullet.trail": {
                "loop": "hold_on_last_frame",
                "animation_length": 0.05,
                "particle_effects": {"0.0": {"effect": "trail"}},
            },
        },
    }


# ---------------------------------------------------------------------------
# Items, recipes, catalog
# ---------------------------------------------------------------------------
RARITY = {"Pistol": "uncommon", "Submachine Gun": "uncommon", "Shotgun": "uncommon",
          "Assault Rifle": "rare", "Light Machine Gun": "rare", "Sniper Rifle": "epic",
          "Heavy Sniper": "epic"}


def gun_item(spec):
    return {
        "format_version": ITEM_FORMAT,
        "minecraft:item": {
            "description": {"identifier": f"{NS}:{spec['id']}"},
            "components": {
                "minecraft:display_name": {"value": spec["name"]},
                "minecraft:icon": {"textures": {"default": f"{NS}_{spec['id']}"}},
                "minecraft:max_stack_size": 1,
                "minecraft:hand_equipped": True,
                "minecraft:allow_off_hand": False,
                "minecraft:can_destroy_in_creative": False,
                "minecraft:damage": {"value": spec["melee"]},
                "minecraft:use_modifiers": {"use_duration": 3600, "movement_modifier": 1.0},
                "minecraft:interact_button": "Fire",
                "minecraft:rarity": RARITY.get(spec["kind"], "common"),
                "minecraft:tags": {"tags": [f"{NS}:gun", f"{NS}:{spec['kind'].lower().replace(' ', '_')}"]},
            },
        },
    }


def mag_item(spec):
    return {
        "format_version": ITEM_FORMAT,
        "minecraft:item": {
            "description": {"identifier": f"{NS}:{spec['mag']}"},
            "components": {
                "minecraft:display_name": {"value": spec["mag_name"]},
                "minecraft:icon": {"textures": {"default": f"{NS}_{spec['mag']}"}},
                "minecraft:max_stack_size": 16,
                "minecraft:tags": {"tags": [f"{NS}:magazine"]},
            },
        },
    }


def ammo_item(a):
    return {
        "format_version": ITEM_FORMAT,
        "minecraft:item": {
            "description": {"identifier": f"{NS}:{a['id']}"},
            "components": {
                "minecraft:display_name": {"value": a["name"]},
                "minecraft:icon": {"textures": {"default": f"{NS}_{a['id']}"}},
                "minecraft:max_stack_size": 64,
                "minecraft:tags": {"tags": [f"{NS}:ammo"]},
            },
        },
    }


def _ing(name):
    if name == "planks":
        return {"tag": "minecraft:planks"}
    return {"item": f"minecraft:{name}"}


def gun_recipe(spec):
    key = {k: _ing(v) for k, v in spec["recipe_key"].items()}
    return {
        "format_version": "1.20.10",
        "minecraft:recipe_shaped": {
            "description": {"identifier": f"{NS}:craft_{spec['id']}"},
            "tags": ["crafting_table"],
            "pattern": spec["recipe"],
            "key": key,
            "unlock": [{"item": "minecraft:iron_ingot"}],
            "result": {"item": f"{NS}:{spec['id']}", "count": 1},
        },
    }


def mag_recipe(spec):
    ingredients = [{"item": f"{NS}:{spec['ammo']}"}] * spec["mag_ammo_cost"] + [{"item": "minecraft:iron_ingot"}]
    return {
        "format_version": "1.20.10",
        "minecraft:recipe_shapeless": {
            "description": {"identifier": f"{NS}:craft_{spec['mag']}"},
            "tags": ["crafting_table"],
            "ingredients": ingredients,
            "unlock": [{"item": f"{NS}:{spec['ammo']}"}],
            "result": {"item": f"{NS}:{spec['mag']}", "count": 1},
        },
    }


def ammo_recipe(a):
    return {
        "format_version": "1.20.10",
        "minecraft:recipe_shapeless": {
            "description": {"identifier": f"{NS}:craft_{a['id']}"},
            "tags": ["crafting_table"],
            "ingredients": [_ing(n) for n in a["recipe"]],
            "unlock": [{"item": "minecraft:gunpowder"}],
            "result": {"item": f"{NS}:{a['id']}", "count": a["count"]},
        },
    }


def crafting_catalog():
    guns = [f"{NS}:{g['id']}" for g in GUNS]
    mags = [f"{NS}:{g['mag']}" for g in GUNS if g.get("mag_name")]
    ammo = [f"{NS}:{a['id']}" for a in AMMO]
    return {
        "format_version": "1.21.60",
        "minecraft:crafting_items_catalog": {
            "categories": [{
                "category_name": "equipment",
                "groups": [
                    {"group_identifier": {"icon": f"{NS}:ak47", "name": f"{NS}:itemGroup.name.guns"},
                     "items": guns},
                    {"group_identifier": {"icon": f"{NS}:mag_ak47", "name": f"{NS}:itemGroup.name.gun_ammo"},
                     "items": mags + ammo},
                ],
            }],
        },
    }


# ---------------------------------------------------------------------------
# Manifests, languages
# ---------------------------------------------------------------------------
def bp_manifest():
    return {
        "format_version": 2,
        "header": {
            "name": "Realistic Guns BP",
            "description": "10 realistic guns: shooting, reloading, recoil, scopes, ammo & block damage.",
            "uuid": UUIDS["bp_header"],
            "version": PACK_VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [
            {"type": "data", "uuid": UUIDS["bp_data"], "version": PACK_VERSION},
            {"type": "script", "language": "javascript", "uuid": UUIDS["bp_script"],
             "version": PACK_VERSION, "entry": "scripts/main.js"},
        ],
        "dependencies": [
            {"uuid": UUIDS["rp_header"], "version": PACK_VERSION},
            {"module_name": "@minecraft/server", "version": SCRIPT_API},
        ],
        "metadata": {"authors": ["Realistic Guns"]},
    }


def rp_manifest():
    return {
        "format_version": 2,
        "header": {
            "name": "Realistic Guns RP",
            "description": "3D models, HD textures, sounds and effects for the 10 Realistic Guns.",
            "uuid": UUIDS["rp_header"],
            "version": PACK_VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [
            {"type": "resources", "uuid": UUIDS["rp_resources"], "version": PACK_VERSION},
        ],
        "dependencies": [
            {"uuid": UUIDS["bp_header"], "version": PACK_VERSION},
        ],
        "metadata": {"authors": ["Realistic Guns"]},
    }


def rp_lang():
    lines = [
        "pack.name=Realistic Guns RP",
        "pack.description=10 realistic 3D guns: models, textures, sounds and effects.",
        f"{NS}:itemGroup.name.guns=Guns",
        f"{NS}:itemGroup.name.gun_ammo=Gun Ammo & Magazines",
        f"entity.{NS}:bullet.name=Bullet",
    ]
    for g in GUNS:
        lines.append(f"item.{NS}:{g['id']}={g['name']}")
        if g.get("mag_name"):
            lines.append(f"item.{NS}:{g['mag']}={g['mag_name']}")
    for a in AMMO:
        lines.append(f"item.{NS}:{a['id']}={a['name']}")
    return "\n".join(lines) + "\n"


def bp_lang():
    return ("pack.name=Realistic Guns BP\n"
            "pack.description=10 realistic guns with shooting, reloading, recoil, scopes and ammo.\n")
