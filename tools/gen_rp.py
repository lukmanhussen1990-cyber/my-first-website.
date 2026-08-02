"""Generates the NPC Kingdom resource pack."""

import json
import os

import gen_textures
from npck_data import (ALL_MOBS, BOSSES, ENEMIES, ITEMS, MARKERS, ROLES,
                       SPAWN_EGG_COLORS, pretty)

FORMAT_CLIENT = "1.10.0"
FORMAT_GEO = "1.12.0"
FORMAT_ANIM = "1.8.0"
FORMAT_AC = "1.10.0"
FORMAT_RC = "1.10.0"


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------
def _cube(origin, size, uv, inflate=None, mirror=False):
    c = {"origin": origin, "size": size, "uv": uv}
    if inflate:
        c["inflate"] = inflate
    if mirror:
        c["mirror"] = True
    return c


def humanoid_geometry():
    """Standard 64x64 player-style humanoid with an overlay (clothing) layer."""
    return {
        "description": {
            "identifier": "geometry.npck.humanoid",
            "texture_width": 64,
            "texture_height": 64,
            "visible_bounds_width": 2,
            "visible_bounds_height": 3,
            "visible_bounds_offset": [0, 1.5, 0],
        },
        "bones": [
            {"name": "root", "pivot": [0, 0, 0]},
            {
                "name": "body", "parent": "root", "pivot": [0, 24, 0],
                "cubes": [
                    _cube([-4, 12, -2], [8, 12, 4], [16, 16]),
                    _cube([-4, 12, -2], [8, 12, 4], [16, 32], inflate=0.25),
                ],
            },
            {
                "name": "head", "parent": "body", "pivot": [0, 24, 0],
                "cubes": [
                    _cube([-4, 24, -4], [8, 8, 8], [0, 0]),
                    _cube([-4, 24, -4], [8, 8, 8], [32, 0], inflate=0.5),
                ],
                "locators": {"head_top": [0, 32, 0]},
            },
            {
                "name": "rightArm", "parent": "body", "pivot": [-5, 22, 0],
                "cubes": [
                    _cube([-8, 12, -2], [4, 12, 4], [40, 16]),
                    _cube([-8, 12, -2], [4, 12, 4], [40, 32], inflate=0.25),
                ],
                "locators": {"right_hand": [-6, 13, 1]},
            },
            {
                "name": "leftArm", "parent": "body", "pivot": [5, 22, 0],
                "cubes": [
                    _cube([4, 12, -2], [4, 12, 4], [32, 48]),
                    _cube([4, 12, -2], [4, 12, 4], [48, 48], inflate=0.25),
                ],
                "locators": {"left_hand": [6, 13, 1]},
            },
            {
                "name": "rightLeg", "parent": "root", "pivot": [-1.9, 12, 0],
                "cubes": [
                    _cube([-3.9, 0, -2], [4, 12, 4], [0, 16]),
                    _cube([-3.9, 0, -2], [4, 12, 4], [0, 32], inflate=0.25),
                ],
            },
            {
                "name": "leftLeg", "parent": "root", "pivot": [1.9, 12, 0],
                "cubes": [
                    _cube([-0.1, 0, -2], [4, 12, 4], [16, 48]),
                    _cube([-0.1, 0, -2], [4, 12, 4], [0, 48], inflate=0.25),
                ],
            },
        ],
    }


def core_geometry():
    return {
        "description": {
            "identifier": "geometry.npck.kingdom_core",
            "texture_width": 64,
            "texture_height": 64,
            "visible_bounds_width": 2,
            "visible_bounds_height": 2.5,
            "visible_bounds_offset": [0, 1, 0],
        },
        "bones": [
            {"name": "root", "pivot": [0, 0, 0]},
            {"name": "base", "parent": "root", "pivot": [0, 0, 0],
             "cubes": [_cube([-6, 0, -6], [12, 3, 12], [0, 0])]},
            {"name": "shaft", "parent": "base", "pivot": [0, 3, 0],
             "cubes": [_cube([-4, 3, -4], [8, 10, 8], [0, 16])]},
            {"name": "gem", "parent": "shaft", "pivot": [0, 16, 0],
             "cubes": [_cube([-3, 13, -3], [6, 6, 6], [32, 16])]},
            {"name": "cap", "parent": "shaft", "pivot": [0, 19, 0],
             "cubes": [_cube([-5, 19, -5], [10, 2, 10], [0, 36])]},
        ],
    }


def empty_geometry():
    return {
        "description": {
            "identifier": "geometry.npck.empty",
            "texture_width": 8,
            "texture_height": 8,
            "visible_bounds_width": 1,
            "visible_bounds_height": 1,
            "visible_bounds_offset": [0, 0, 0],
        },
        "bones": [{"name": "root", "pivot": [0, 0, 0]}],
    }


def crown_geometry():
    """Worn on the player's head; mapped to a small all-gold 32x32 sheet."""
    band_y = 31.6
    spikes = []
    for i, x in enumerate((-4.0, -1.5, 1.0, 3.5)):
        spikes.append(_cube([x, band_y + 2.4, -4.6], [1.2, 1.6, 1.2], [0, 12]))
        spikes.append(_cube([x, band_y + 2.4, 3.4], [1.2, 1.6, 1.2], [0, 12]))
    for i, z in enumerate((-2.0, 0.5)):
        spikes.append(_cube([-4.6, band_y + 2.4, z], [1.2, 1.6, 1.2], [0, 12]))
        spikes.append(_cube([3.4, band_y + 2.4, z], [1.2, 1.6, 1.2], [0, 12]))
    return {
        "description": {
            "identifier": "geometry.npck.crown",
            "texture_width": 32,
            "texture_height": 32,
            "visible_bounds_width": 2,
            "visible_bounds_height": 2,
            "visible_bounds_offset": [0, 1, 0],
        },
        "bones": [
            {"name": "root", "pivot": [0, 0, 0]},
            {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
            {"name": "body", "parent": "waist", "pivot": [0, 24, 0]},
            {
                "name": "head", "parent": "body", "pivot": [0, 24, 0],
                "cubes": [
                    _cube([-4.6, band_y, -4.6], [9.2, 2.6, 1.0], [0, 0]),
                    _cube([-4.6, band_y, 3.6], [9.2, 2.6, 1.0], [0, 0]),
                    _cube([-4.6, band_y, -3.6], [1.0, 2.6, 7.2], [0, 6]),
                    _cube([3.6, band_y, -3.6], [1.0, 2.6, 7.2], [0, 6]),
                ] + spikes,
            },
        ],
    }


def armor_geometry(identifier, pieces):
    """pieces: list of (bone, parent, pivot, origin, size, uv, inflate, mirror)."""
    bones = [
        {"name": "root", "pivot": [0, 0, 0]},
        {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
    ]
    by_name = {}
    for bone, parent, pivot, origin, size, uv, inflate, mirror in pieces:
        entry = by_name.setdefault(
            bone, {"name": bone, "parent": parent, "pivot": pivot, "cubes": []})
        entry["cubes"].append(_cube(origin, size, uv, inflate, mirror))
    # body has to exist before the arms that hang off it
    order = ["body", "head", "rightArm", "leftArm", "rightLeg", "leftLeg"]
    for name in order:
        if name in by_name:
            bones.append(by_name[name])
    return {
        "description": {
            "identifier": identifier,
            "texture_width": 64,
            "texture_height": 32,
            "visible_bounds_width": 2,
            "visible_bounds_height": 3,
            "visible_bounds_offset": [0, 1.5, 0],
        },
        "bones": bones,
    }


def armor_chest_geometry():
    return armor_geometry("geometry.npck.armor_chest", [
        ("body", "waist", [0, 24, 0], [-4, 12, -2], [8, 12, 4], [16, 16], 1.0, False),
        ("rightArm", "body", [-5, 22, 0], [-8, 12, -2], [4, 12, 4], [40, 16], 1.0, False),
        ("leftArm", "body", [5, 22, 0], [4, 12, -2], [4, 12, 4], [40, 16], 1.0, True),
    ])


def armor_legs_geometry():
    return armor_geometry("geometry.npck.armor_legs", [
        ("body", "waist", [0, 24, 0], [-4, 12, -2], [8, 12, 4], [16, 16], 0.45, False),
        ("rightLeg", "root", [-1.9, 12, 0], [-3.9, 0, -2], [4, 12, 4], [0, 16], 0.45, False),
        ("leftLeg", "root", [1.9, 12, 0], [-0.1, 0, -2], [4, 12, 4], [0, 16], 0.45, True),
    ])


def armor_boots_geometry():
    return armor_geometry("geometry.npck.armor_boots", [
        ("rightLeg", "root", [-1.9, 12, 0], [-3.9, 0, -2], [4, 5, 4], [0, 23], 1.0, False),
        ("leftLeg", "root", [1.9, 12, 0], [-0.1, 0, -2], [4, 5, 4], [0, 23], 1.0, True),
    ])


# ---------------------------------------------------------------------------
# Animations
# ---------------------------------------------------------------------------
def animations():
    swing = "query.modified_distance_moved * 38.17"
    speed = "query.modified_move_speed"
    return {
        "format_version": FORMAT_ANIM,
        "animations": {
            "animation.npck.humanoid.look_at_target": {
                "loop": True,
                "bones": {
                    "head": {
                        "rotation": [
                            "this - query.target_x_rotation",
                            "this - query.target_y_rotation",
                            0,
                        ]
                    }
                },
            },
            "animation.npck.humanoid.idle": {
                "loop": True,
                "bones": {
                    "rightArm": {"rotation": [0, 0, "2 + math.cos(query.life_time * 103) * 2"]},
                    "leftArm": {"rotation": [0, 0, "-2 - math.cos(query.life_time * 97) * 2"]},
                    "body": {"rotation": ["math.sin(query.life_time * 62) * 0.7", 0, 0]},
                },
            },
            "animation.npck.humanoid.walk": {
                "loop": True,
                "bones": {
                    "rightLeg": {"rotation": ["math.cos(%s) * 42 * %s" % (swing, speed), 0, 0]},
                    "leftLeg": {"rotation": ["math.cos(%s + 180) * 42 * %s" % (swing, speed), 0, 0]},
                    "rightArm": {"rotation": ["math.cos(%s + 180) * 32 * %s" % (swing, speed), 0, 0]},
                    "leftArm": {"rotation": ["math.cos(%s) * 32 * %s" % (swing, speed), 0, 0]},
                    "body": {"rotation": [0, "math.cos(%s) * 3 * %s" % (swing, speed), 0]},
                },
            },
            "animation.npck.humanoid.attack": {
                "loop": True,
                "bones": {
                    "rightArm": {
                        "rotation": ["-70 - math.sin(query.life_time * 420) * 60", 0, -8]
                    },
                    "leftArm": {"rotation": [-18, 0, 8]},
                    "body": {"rotation": [0, "math.sin(query.life_time * 420) * 8", 0]},
                },
            },
            "animation.npck.humanoid.work": {
                "loop": True,
                "bones": {
                    "rightArm": {
                        "rotation": ["-58 + math.sin(query.life_time * 320) * 52", 0, 0]
                    },
                    "leftArm": {
                        "rotation": ["-34 + math.sin(query.life_time * 320 + 45) * 22", 0, 0]
                    },
                    "body": {"rotation": ["7 + math.sin(query.life_time * 320) * 4", 0, 0]},
                },
            },
            "animation.npck.humanoid.build": {
                "loop": True,
                "bones": {
                    "rightArm": {
                        "rotation": ["-112 + math.sin(query.life_time * 210) * 26", 0, -6]
                    },
                    "leftArm": {
                        "rotation": ["-112 + math.sin(query.life_time * 210 + 180) * 26", 0, 6]
                    },
                    "head": {"rotation": [-12, 0, 0]},
                },
            },
            "animation.npck.humanoid.celebrate": {
                "loop": True,
                "bones": {
                    "rightArm": {
                        "rotation": ["-158 + math.sin(query.life_time * 300) * 16", 0, -22]
                    },
                    "leftArm": {
                        "rotation": ["-158 + math.sin(query.life_time * 300 + 180) * 16", 0, 22]
                    },
                    "root": {
                        "position": [0, "math.abs(math.sin(query.life_time * 300)) * 2.6", 0]
                    },
                    "head": {"rotation": ["-8 + math.sin(query.life_time * 300) * 6", 0, 0]},
                },
            },
            "animation.npck.humanoid.sleep": {
                "loop": True,
                "bones": {
                    "root": {"position": [0, -6.5, 0]},
                    "rightLeg": {"rotation": [-82, 0, 0], "position": [0, 0, -2]},
                    "leftLeg": {"rotation": [-82, 0, 0], "position": [0, 0, -2]},
                    "body": {"rotation": [9, 0, 0]},
                    "head": {
                        "rotation": ["24 + math.sin(query.life_time * 50) * 3", 0, 0]
                    },
                    "rightArm": {"rotation": [-9, 0, 4]},
                    "leftArm": {"rotation": [-9, 0, -4]},
                },
            },
            "animation.npck.humanoid.hurt": {
                "loop": True,
                "bones": {
                    "body": {"rotation": [0, 0, "math.sin(query.life_time * 900) * 7"]},
                    "head": {"rotation": [-6, 0, 0]},
                },
            },
            "animation.npck.core.pulse": {
                "loop": True,
                "bones": {
                    "gem": {
                        "rotation": [0, "query.life_time * 45", 0],
                        "position": [0, "math.sin(query.life_time * 90) * 0.6", 0],
                        "scale": ["1 + math.sin(query.life_time * 120) * 0.04"],
                    },
                    "cap": {"rotation": [0, "-query.life_time * 20", 0]},
                },
            },
        },
    }


def animation_controllers():
    anims = {
        "controller.animation.npck.humanoid.move": {
            "initial_state": "default",
            "states": {
                "default": {
                    "animations": [
                        "look_at_target",
                        "idle",
                        {"walk": "query.modified_move_speed"},
                    ]
                }
            },
        },
        "controller.animation.npck.humanoid.state": {
            "initial_state": "normal",
            "states": {
                "normal": {
                    "transitions": [
                        {"work": "query.mark_variant == 1"},
                        {"celebrate": "query.mark_variant == 2"},
                        {"sleep": "query.mark_variant == 3"},
                        {"build": "query.mark_variant == 4"},
                        {"combat": "query.mark_variant == 5"},
                    ]
                },
                "work": {
                    "animations": ["work"],
                    "blend_transition": 0.25,
                    "transitions": [{"normal": "query.mark_variant != 1"}],
                },
                "celebrate": {
                    "animations": ["celebrate"],
                    "blend_transition": 0.25,
                    "transitions": [{"normal": "query.mark_variant != 2"}],
                },
                "sleep": {
                    "animations": ["sleep"],
                    "blend_transition": 0.5,
                    "transitions": [{"normal": "query.mark_variant != 3"}],
                },
                "build": {
                    "animations": ["build"],
                    "blend_transition": 0.25,
                    "transitions": [{"normal": "query.mark_variant != 4"}],
                },
                "combat": {
                    "animations": ["attack"],
                    "blend_transition": 0.15,
                    "transitions": [{"normal": "query.mark_variant != 5"}],
                },
            },
        },
        "controller.animation.npck.humanoid.hurt": {
            "initial_state": "none",
            "states": {
                "none": {"transitions": [{"hurt": "query.hurt_time > 0"}]},
                "hurt": {
                    "animations": ["hurt"],
                    "blend_transition": 0.1,
                    "transitions": [{"none": "query.hurt_time <= 0"}],
                },
            },
        },
    }
    return {"format_version": FORMAT_AC, "animation_controllers": anims}


def render_controllers():
    return {
        "format_version": FORMAT_RC,
        "render_controllers": {
            "controller.render.npck_humanoid": {
                "geometry": "Geometry.default",
                "materials": [{"*": "Material.default"}],
                "textures": ["Texture.default"],
            },
            "controller.render.npck_core": {
                "geometry": "Geometry.default",
                "materials": [{"*": "Material.default"}],
                "textures": ["Texture.default"],
            },
            "controller.render.npck_armor": {
                "geometry": "Geometry.default",
                "materials": [{"*": "Material.default"}],
                "textures": ["Texture.default"],
            },
        },
    }


# ---------------------------------------------------------------------------
# Client entities
# ---------------------------------------------------------------------------
HUMANOID_ANIMS = {
    "look_at_target": "animation.npck.humanoid.look_at_target",
    "idle": "animation.npck.humanoid.idle",
    "walk": "animation.npck.humanoid.walk",
    "attack": "animation.npck.humanoid.attack",
    "work": "animation.npck.humanoid.work",
    "build": "animation.npck.humanoid.build",
    "celebrate": "animation.npck.humanoid.celebrate",
    "sleep": "animation.npck.humanoid.sleep",
    "hurt": "animation.npck.humanoid.hurt",
    "move_controller": "controller.animation.npck.humanoid.move",
    "state_controller": "controller.animation.npck.humanoid.state",
    "hurt_controller": "controller.animation.npck.humanoid.hurt",
}


def humanoid_client(identifier, texture, egg=None):
    desc = {
        "identifier": identifier,
        "min_engine_version": "1.21.0",
        "materials": {"default": "entity_alphatest"},
        "textures": {"default": "textures/entity/npck/" + texture},
        "geometry": {"default": "geometry.npck.humanoid"},
        "animations": dict(HUMANOID_ANIMS),
        "scripts": {
            "animate": ["move_controller", "state_controller", "hurt_controller"]
        },
        "render_controllers": ["controller.render.npck_humanoid"],
        "enable_attachables": True,
    }
    if egg:
        desc["spawn_egg"] = {"base_color": egg[0], "overlay_color": egg[1]}
    return {"format_version": FORMAT_CLIENT, "minecraft:client_entity": {"description": desc}}


def core_client():
    return {
        "format_version": FORMAT_CLIENT,
        "minecraft:client_entity": {
            "description": {
                "identifier": "npck:kingdom_core",
                "min_engine_version": "1.21.0",
                "materials": {"default": "entity_alphatest"},
                "textures": {"default": "textures/entity/npck/kingdom_core"},
                "geometry": {"default": "geometry.npck.kingdom_core"},
                "animations": {"pulse": "animation.npck.core.pulse"},
                "scripts": {"animate": ["pulse"]},
                "render_controllers": ["controller.render.npck_core"],
                "spawn_egg": {"base_color": "#2E86C8", "overlay_color": "#E7C43F"},
            }
        },
    }


def marker_client(identifier):
    return {
        "format_version": FORMAT_CLIENT,
        "minecraft:client_entity": {
            "description": {
                "identifier": identifier,
                "min_engine_version": "1.21.0",
                "materials": {"default": "entity_alphatest"},
                "textures": {"default": "textures/entity/npck/invisible"},
                "geometry": {"default": "geometry.npck.empty"},
                "render_controllers": ["controller.render.npck_humanoid"],
            }
        },
    }


def attachable(identifier, texture, geometry):
    return {
        "format_version": FORMAT_CLIENT,
        "minecraft:attachable": {
            "description": {
                "identifier": identifier,
                "materials": {"default": "armor", "enchanted": "armor_enchanted"},
                "textures": {
                    "default": texture,
                    "enchanted": "textures/misc/enchanted_actor_glint",
                },
                "geometry": {"default": geometry},
                "render_controllers": ["controller.render.npck_armor"],
            }
        },
    }


# ---------------------------------------------------------------------------
# Language
# ---------------------------------------------------------------------------
def lang_lines():
    lines = [
        "pack.name=NPC Kingdom Resources",
        "pack.description=Textures, models and animations for NPC Kingdom.",
        "",
        "## Items",
    ]
    for item in ITEMS:
        lines.append("item.%s.name=%s" % (item["id"], item["name"]))
    lines += ["", "## Entities"]
    for mob in ALL_MOBS:
        lines.append("entity.npck:%s.name=%s" % (mob, pretty(mob)))
    lines.append("entity.npck:kingdom_core.name=Kingdom Core")
    lines += ["", "## Spawn eggs"]
    for mob in ALL_MOBS:
        lines.append("item.spawn_egg.entity.npck:%s.name=Spawn %s" % (mob, pretty(mob)))
    lines.append("item.spawn_egg.entity.npck:kingdom_core.name=Kingdom Core (Spawn)")
    lines += [
        "",
        "## Interaction prompts",
        "action.interact.npck.command=Give Order",
        "action.interact.npck.rally=Rally Order",
        "action.interact.npck.talk=Talk",
        "action.interact.npck.recruit=Recruit",
        "action.interact.npck.core=Use Kingdom Core",
        "action.interact.npck.sit=Sit on Throne",
        "",
        "## Trading",
        "entity.npck:merchant.trade=Kingdom Merchant",
        "entity.npck:blacksmith.trade=Kingdom Blacksmith",
        "",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
def generate(root, uuids):
    write_json(os.path.join(root, "manifest.json"), {
        "format_version": 2,
        "header": {
            "name": "NPC Kingdom Resources",
            "description": "Textures, models, animations and sounds for the NPC Kingdom add-on.",
            "uuid": uuids["rp_header"],
            "version": [1, 0, 0],
            "min_engine_version": [1, 21, 0],
        },
        "modules": [{
            "type": "resources",
            "description": "NPC Kingdom resources",
            "uuid": uuids["rp_module"],
            "version": [1, 0, 0],
        }],
        "dependencies": [{"uuid": uuids["bp_header"], "version": [1, 0, 0]}],
        "metadata": {
            "authors": ["NPC Kingdom"],
            "license": "MIT",
            "product_type": "addon",
        },
    })

    # models
    write_json(os.path.join(root, "models", "entity", "npck_humanoid.geo.json"),
               {"format_version": FORMAT_GEO, "minecraft:geometry": [humanoid_geometry()]})
    write_json(os.path.join(root, "models", "entity", "npck_kingdom_core.geo.json"),
               {"format_version": FORMAT_GEO, "minecraft:geometry": [core_geometry()]})
    write_json(os.path.join(root, "models", "entity", "npck_empty.geo.json"),
               {"format_version": FORMAT_GEO, "minecraft:geometry": [empty_geometry()]})
    write_json(os.path.join(root, "models", "entity", "npck_royal_gear.geo.json"), {
        "format_version": FORMAT_GEO,
        "minecraft:geometry": [
            crown_geometry(),
            armor_chest_geometry(),
            armor_legs_geometry(),
            armor_boots_geometry(),
        ],
    })

    write_json(os.path.join(root, "animations", "npck_humanoid.animation.json"), animations())
    write_json(os.path.join(root, "animation_controllers",
                            "npck_humanoid.animation_controllers.json"),
               animation_controllers())
    write_json(os.path.join(root, "render_controllers", "npck.render_controllers.json"),
               render_controllers())

    # client entities
    for mob in ROLES + ENEMIES + BOSSES:
        write_json(os.path.join(root, "entity", "npck_%s.entity.json" % mob),
                   humanoid_client("npck:" + mob, mob, SPAWN_EGG_COLORS[mob]))
    write_json(os.path.join(root, "entity", "npck_kingdom_core.entity.json"), core_client())
    for marker in MARKERS:
        write_json(os.path.join(root, "entity", "npck_%s.entity.json" % marker),
                   marker_client("npck:" + marker))

    # attachables for the royal gear
    write_json(os.path.join(root, "attachables", "npck_royal_crown.json"),
               attachable("npck:royal_crown", "textures/models/armor/npck_crown",
                          "geometry.npck.crown"))
    for piece, geo in (("royal_chestplate", "geometry.npck.armor_chest"),
                       ("royal_leggings", "geometry.npck.armor_legs"),
                       ("royal_boots", "geometry.npck.armor_boots")):
        write_json(os.path.join(root, "attachables", "npck_%s.json" % piece),
                   attachable("npck:" + piece,
                              "textures/models/armor/npck_royal_armor", geo))

    # texture atlas entries
    texture_data = {}
    for item in ITEMS:
        if item.get("texture"):
            texture_data["npck_" + item["texture"]] = {
                "textures": "textures/items/npck/" + item["texture"]
            }
    write_json(os.path.join(root, "textures", "item_texture.json"), {
        "resource_pack_name": "npck",
        "texture_name": "atlas.items",
        "texture_data": texture_data,
    })

    write_json(os.path.join(root, "texts", "languages.json"), ["en_US"])
    os.makedirs(os.path.join(root, "texts"), exist_ok=True)
    with open(os.path.join(root, "texts", "en_US.lang"), "w", encoding="utf-8") as fh:
        fh.write(lang_lines())

    gen_textures.generate(root)
