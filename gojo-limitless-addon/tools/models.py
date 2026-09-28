"""Generate the blindfold geometry, attachables, render controller, fog and
third-person cast animations.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "packs", "Gojo_Limitless_RP")


def write(rel, data):
    path = os.path.join(RP, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")


# Texture patches (see tools/art.py tex_blindfold): [u, v, w, h]
BAND = [0, 0, 16, 8]
KNOT = [16, 0, 8, 8]
HAIR = [0, 8, 16, 16]
HAIR_TOP = [16, 8, 8, 8]
EYE = [32, 0, 4, 4]


def faces(side, top=None, bottom=None):
    top = top or side
    bottom = bottom or side
    f = {}
    for name in ("north", "south", "east", "west"):
        f[name] = {"uv": side[:2], "uv_size": side[2:]}
    f["up"] = {"uv": top[:2], "uv_size": top[2:]}
    f["down"] = {"uv": bottom[:2], "uv_size": bottom[2:]}
    return f


def cube(origin, size, uv, pivot=None, rotation=None, inflate=None):
    c = {"origin": origin, "size": size, "uv": uv}
    if pivot is not None:
        c["pivot"] = pivot
    if rotation is not None:
        c["rotation"] = rotation
    if inflate is not None:
        c["inflate"] = inflate
    return c


def hair_cubes():
    """Upswept white hair (Gojo's blindfolded look)."""
    hair = faces(HAIR, HAIR_TOP, HAIR)
    top = faces(HAIR, HAIR_TOP, HAIR)
    cubes = [
        cube([-4.9, 29.8, -4.9], [9.8, 2.9, 9.8], hair),
        cube([-1.25, 32.2, -1.6], [2.5, 4.6, 2.5], top, pivot=[0, 32.2, -0.35], rotation=[6, 0, 0]),
        cube([-4.2, 32.2, -4.0], [3.0, 3.2, 3.0], top, pivot=[-2.7, 32.2, -2.5], rotation=[14, 0, 16]),
        cube([1.2, 32.2, -4.0], [3.0, 3.8, 3.0], top, pivot=[2.7, 32.2, -2.5], rotation=[12, 0, -15]),
        cube([-4.3, 32.2, 1.0], [3.0, 3.4, 3.0], top, pivot=[-2.8, 32.2, 2.5], rotation=[-14, 0, 14]),
        cube([1.3, 32.2, 1.0], [3.0, 3.0, 3.0], top, pivot=[2.8, 32.2, 2.5], rotation=[-12, 0, -14]),
        cube([-1.5, 32.0, 2.0], [3.0, 2.6, 3.0], top, pivot=[0, 32.0, 3.5], rotation=[-18, 0, 0]),
        cube([-5.2, 28.5, -3.5], [1.2, 2.0, 7.0], hair),
        cube([4.0, 28.5, -3.5], [1.2, 2.0, 7.0], hair),
    ]
    return cubes


def geometry(identifier, lifted):
    band_y = 29.25 if lifted else 26.25
    band = faces(BAND, KNOT, KNOT)
    cubes = [cube([-4.75, band_y, -4.75], [9.5, 3.4 if not lifted else 2.6, 9.5], band)]
    # knot at the back of the head
    cubes.append(cube([-1.0, band_y + 0.6, 4.75], [2.0, 2.0, 1.0], faces(KNOT)))
    cubes.append(cube([-1.3, band_y - 3.0, 5.0], [1.0, 3.2, 0.4], faces(KNOT), pivot=[-0.8, band_y + 0.2, 5.2], rotation=[12, 0, 8]))
    cubes.append(cube([0.3, band_y - 3.2, 5.0], [1.0, 3.4, 0.4], faces(KNOT), pivot=[0.8, band_y + 0.2, 5.2], rotation=[12, 0, -8]))
    cubes += hair_cubes() if not lifted else [c for c in hair_cubes()[1:]] + [cube([-4.9, 31.2, -4.9], [9.8, 1.8, 9.8], faces(HAIR, HAIR_TOP, HAIR))]
    if lifted:
        # Six Eyes: glowing blue eyes (translucent texels glow with entity_emissive_alpha)
        eye = faces(EYE)
        cubes.append(cube([-2.6, 27.0, -4.65], [1.6, 1.0, 0.05], eye))
        cubes.append(cube([1.0, 27.0, -4.65], [1.6, 1.0, 0.05], eye))
    return {
        "description": {
            "identifier": identifier,
            "texture_width": 64,
            "texture_height": 32,
            "visible_bounds_width": 2,
            "visible_bounds_height": 2.5,
            "visible_bounds_offset": [0, 1.75, 0],
        },
        "bones": [
            {"name": "waist", "pivot": [0, 12, 0]},
            {"name": "body", "parent": "waist", "pivot": [0, 24, 0]},
            {"name": "head", "parent": "body", "pivot": [0, 24, 0], "cubes": cubes},
        ],
    }


def empty_geometry(identifier):
    return {
        "description": {"identifier": identifier, "texture_width": 64, "texture_height": 32},
        "bones": [{"name": "root", "pivot": [0, 0, 0]}],
    }


def attachable(identifier, geometry, material):
    # Held in the hand -> render nothing (the icon still shows in the hotbar);
    # worn on the head -> render the blindfold on the player's head bone.
    held_query = f"query.is_item_name_any('slot.weapon.mainhand', 0, '{identifier}')"
    return {
        "format_version": "1.10.0",
        "minecraft:attachable": {
            "description": {
                "identifier": identifier,
                "materials": {"default": material},
                "textures": {"default": "textures/models/gojo/blindfold"},
                "geometry": {"default": geometry, "held": "geometry.gojo.empty"},
                "scripts": {
                    "pre_animation": [f"variable.gojo_held = {held_query};"],
                    "animate": ["offset"],
                },
                "animations": {"offset": "animation.armor.helmet.offset"},
                "render_controllers": ["controller.render.gojo.head_item"],
            }
        },
    }


# ---------------------------------------------------------------- animations
def fp_guard(expr):
    """Only animate in third person - first-person arms stay vanilla."""
    return f"variable.is_first_person ? 0 : ({expr})"


def rot(x, y, z):
    return [fp_guard(x) if isinstance(x, str) else x, fp_guard(y) if isinstance(y, str) else y, fp_guard(z) if isinstance(z, str) else z]


def keyed(frames):
    """frames: {time: [x, y, z]} -> keyframed rotation with third-person guard."""
    return {f"{t:.2f}": [fp_guard(str(v)) for v in xyz] for t, xyz in frames.items()}


ANIMATIONS = {
    "animation.gojo.cast_blue": (1.0, {
        "rightarm": {"rotation": keyed({0.0: [0, 0, 0], 0.12: [-110, 10, 0], 0.7: [-100, 12, 5], 1.0: [0, 0, 0]})},
        "leftarm": {"rotation": keyed({0.0: [0, 0, 0], 0.15: [-20, 0, -10], 1.0: [0, 0, 0]})},
    }),
    "animation.gojo.cast_red": (0.9, {
        "rightarm": {"rotation": keyed({0.0: [0, 0, 0], 0.1: [-60, 20, 0], 0.4: [-95, 0, 0], 0.55: [-100, -5, 0], 0.9: [0, 0, 0]})},
    }),
    "animation.gojo.hollow_purple": (2.1, {
        "rightarm": {"rotation": keyed({0.0: [0, 0, 0], 0.2: [-80, -30, 20], 0.9: [-85, -35, 20], 1.5: [-90, 15, 0], 1.75: [-100, 0, 0], 2.1: [0, 0, 0]})},
        "leftarm": {"rotation": keyed({0.0: [0, 0, 0], 0.2: [-80, 30, -20], 0.9: [-85, 35, -20], 1.5: [-90, -15, 0], 1.7: [-40, 0, 0], 2.1: [0, 0, 0]})},
        "body": {"rotation": keyed({0.0: [0, 0, 0], 1.5: [0, 0, 0], 1.7: [8, 0, 0], 2.1: [0, 0, 0]})},
    }),
    "animation.gojo.domain": (1.6, {
        "rightarm": {"rotation": keyed({0.0: [0, 0, 0], 0.25: [-115, 25, 0], 1.3: [-115, 25, 0], 1.6: [0, 0, 0]})},
        "leftarm": {"rotation": keyed({0.0: [0, 0, 0], 0.3: [-10, 0, -8], 1.6: [0, 0, 0]})},
        "head": {"rotation": keyed({0.0: [0, 0, 0], 0.3: [-8, 0, 0], 1.3: [-8, 0, 0], 1.6: [0, 0, 0]})},
    }),
    "animation.gojo.six_eyes": (0.9, {
        "rightarm": {"rotation": keyed({0.0: [0, 0, 0], 0.2: [-155, 25, 0], 0.55: [-160, 20, 0], 0.9: [0, 0, 0]})},
    }),
    "animation.gojo.infinity": (0.8, {
        "leftarm": {"rotation": keyed({0.0: [0, 0, 0], 0.15: [-90, 20, -10], 0.55: [-90, 20, -10], 0.8: [0, 0, 0]})},
    }),
    "animation.gojo.teleport": (0.45, {
        "body": {"rotation": keyed({0.0: [12, 0, 0], 0.45: [0, 0, 0]})},
        "rightarm": {"rotation": keyed({0.0: [30, 0, 10], 0.45: [0, 0, 0]})},
        "leftarm": {"rotation": keyed({0.0: [30, 0, -10], 0.45: [0, 0, 0]})},
    }),
    "animation.gojo.rct": (1.6, {
        "rightarm": {"rotation": keyed({0.0: [0, 0, 0], 0.3: [-30, 0, 35], 1.3: [-30, 0, 35], 1.6: [0, 0, 0]})},
        "leftarm": {"rotation": keyed({0.0: [0, 0, 0], 0.3: [-30, 0, -35], 1.3: [-30, 0, -35], 1.6: [0, 0, 0]})},
        "head": {"rotation": keyed({0.0: [0, 0, 0], 0.3: [-15, 0, 0], 1.3: [-15, 0, 0], 1.6: [0, 0, 0]})},
    }),
    "animation.gojo.black_flash": (0.6, {
        "rightarm": {"rotation": keyed({0.0: [30, 0, 0], 0.08: [40, -20, 0], 0.18: [-95, 10, 0], 0.35: [-90, 0, 0], 0.6: [0, 0, 0]})},
        "body": {"rotation": keyed({0.0: [0, 20, 0], 0.18: [0, -15, 0], 0.6: [0, 0, 0]})},
    }),
    "animation.gojo.transform": (1.4, {
        "rightarm": {"rotation": keyed({0.0: [0, 0, 0], 0.3: [-150, 0, 20], 1.0: [-150, 0, 20], 1.4: [0, 0, 0]})},
        "leftarm": {"rotation": keyed({0.0: [0, 0, 0], 0.3: [-20, 0, -30], 1.0: [-20, 0, -30], 1.4: [0, 0, 0]})},
        "head": {"rotation": keyed({0.0: [0, 0, 0], 0.3: [-12, 0, 0], 1.0: [-12, 0, 0], 1.4: [0, 0, 0]})},
    }),
}


def main():
    write("models/entity/gojo_blindfold.geo.json", {
        "format_version": "1.12.0",
        "minecraft:geometry": [
            geometry("geometry.gojo.blindfold", False),
            geometry("geometry.gojo.blindfold_lifted", True),
            empty_geometry("geometry.gojo.empty"),
        ],
    })
    write("attachables/gojo_blindfold.json", attachable("gojo:blindfold", "geometry.gojo.blindfold", "entity_alphatest"))
    write("attachables/gojo_blindfold_lifted.json", attachable("gojo:blindfold_lifted", "geometry.gojo.blindfold_lifted", "entity_emissive_alpha"))
    write("render_controllers/gojo.render_controllers.json", {
        "format_version": "1.8.0",
        "render_controllers": {
            "controller.render.gojo.head_item": {
                "arrays": {"geometries": {"Array.gojo_geo": ["Geometry.default", "Geometry.held"]}},
                "geometry": "Array.gojo_geo[variable.gojo_held]",
                "materials": [{"*": "Material.default"}],
                "textures": ["Texture.default"],
            }
        },
    })
    write("fogs/gojo_unlimited_void.json", {
        "format_version": "1.16.100",
        "minecraft:fog_settings": {
            "description": {"identifier": "gojo:unlimited_void"},
            "distance": {
                "air": {"fog_start": 6.0, "fog_end": 30.0, "fog_color": "#07031A", "render_distance_type": "fixed"},
                "water": {"fog_start": 2.0, "fog_end": 18.0, "fog_color": "#07031A", "render_distance_type": "fixed"},
            },
        },
    })
    anims = {}
    for name, (length, bones) in ANIMATIONS.items():
        anims[name] = {"animation_length": length, "bones": bones}
    write("animations/gojo.player.animation.json", {"format_version": "1.8.0", "animations": anims})
    print("models/animations generated:", len(anims), "animations")


if __name__ == "__main__":
    main()
