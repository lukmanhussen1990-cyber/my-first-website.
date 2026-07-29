#!/usr/bin/env python3
"""
Kaiju Rampage - model generator.

Writes `kaiju_RP/models/entity/kaiju.geo.json` and the UV atlas map that
`generate_kaiju_textures.py` paints against, so the model and its texture can
never drift apart:

    python3 tools/generate_kaiju_model.py
    python3 tools/generate_kaiju_textures.py

The kaiju is built at full size (about 11 blocks tall, front facing -Z) and the
cubes are packed into a 256x256 atlas with a simple shelf packer.
"""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "kaiju_RP")
ATLAS = 512

# bone, name, origin, size, surface
CUBES = [
    # torso
    ("body", "torso", (-26, 66, -20), (52, 56, 42), "hide"),
    ("body", "chest", (-30, 110, -26), (60, 34, 46), "belly"),
    ("body", "gut", (-24, 60, -18), (48, 12, 38), "belly"),
    # neck and head
    ("neck", "neck", (-13, 136, -36), (26, 26, 28), "hide"),
    ("head", "skull", (-16, 146, -66), (32, 28, 34), "hide"),
    ("head", "brow", (-17, 172, -60), (34, 6, 24), "spine"),
    ("head", "snout", (-14, 148, -92), (28, 16, 28), "hide"),
    ("head", "teeth_upper", (-13, 146, -90), (26, 4, 24), "claw"),
    ("head", "eye_left", (6, 166, -68), (7, 7, 4), "eye"),
    ("head", "eye_right", (-13, 166, -68), (7, 7, 4), "eye"),
    ("jaw", "lower_jaw", (-12, 136, -90), (24, 10, 30), "belly"),
    ("jaw", "teeth_lower", (-11, 144, -88), (22, 4, 26), "claw"),
    # dorsal plates
    ("spines", "plate1", (-4, 140, -14), (8, 22, 14), "spine"),
    ("spines", "plate2", (-4, 140, 2), (8, 28, 16), "spine"),
    ("spines", "plate3", (-4, 134, 20), (8, 26, 16), "spine"),
    # arms
    ("arm_left", "arm_left_upper", (24, 88, -14), (16, 34, 18), "hide"),
    ("arm_left", "arm_left_fore", (26, 60, -18), (13, 30, 15), "hide"),
    ("arm_left", "arm_left_claw", (27, 52, -26), (11, 9, 15), "claw"),
    ("arm_right", "arm_right_upper", (-40, 88, -14), (16, 34, 18), "hide"),
    ("arm_right", "arm_right_fore", (-39, 60, -18), (13, 30, 15), "hide"),
    ("arm_right", "arm_right_claw", (-38, 52, -26), (11, 9, 15), "claw"),
    # legs
    ("leg_left", "leg_left_thigh", (6, 30, -16), (26, 42, 30), "hide"),
    ("leg_left", "leg_left_shin", (9, 4, -14), (20, 28, 24), "hide"),
    ("leg_left", "leg_left_foot", (7, 0, -30), (24, 9, 36), "hide"),
    ("leg_left", "leg_left_claws", (8, 0, -34), (22, 5, 8), "claw"),
    ("leg_right", "leg_right_thigh", (-32, 30, -16), (26, 42, 30), "hide"),
    ("leg_right", "leg_right_shin", (-29, 4, -14), (20, 28, 24), "hide"),
    ("leg_right", "leg_right_foot", (-31, 0, -30), (24, 9, 36), "hide"),
    ("leg_right", "leg_right_claws", (-30, 0, -34), (22, 5, 8), "claw"),
    # tail
    ("tail1", "tail1", (-16, 74, 20), (32, 30, 40), "hide"),
    ("tail1", "tail1_plate", (-3, 102, 26), (6, 20, 14), "spine"),
    ("tail2", "tail2", (-12, 72, 58), (24, 24, 40), "hide"),
    ("tail2", "tail2_plate", (-3, 94, 64), (6, 16, 12), "spine"),
    ("tail3", "tail3", (-8, 70, 96), (16, 16, 40), "hide"),
    ("tail4", "tail4", (-5, 70, 134), (10, 10, 40), "hide"),
]

BONES = {
    "root": {"parent": None, "pivot": (0, 0, 0)},
    "body": {"parent": "root", "pivot": (0, 66, 0)},
    "neck": {"parent": "body", "pivot": (0, 140, -18)},
    "head": {"parent": "neck", "pivot": (0, 152, -40)},
    "jaw": {"parent": "head", "pivot": (0, 150, -62)},
    "spines": {"parent": "body", "pivot": (0, 140, 0)},
    "arm_left": {"parent": "body", "pivot": (30, 118, -4)},
    "arm_right": {"parent": "body", "pivot": (-30, 118, -4)},
    "leg_left": {"parent": "root", "pivot": (18, 70, -4)},
    "leg_right": {"parent": "root", "pivot": (-18, 70, -4)},
    "tail1": {"parent": "body", "pivot": (0, 88, 22)},
    "tail2": {"parent": "tail1", "pivot": (0, 84, 58)},
    "tail3": {"parent": "tail2", "pivot": (0, 78, 96)},
    "tail4": {"parent": "tail3", "pivot": (0, 75, 134)},
}


def box_uv_size(size):
    """Width and height a box UV net needs for a cube of this size."""
    w, h, d = size
    return 2 * (w + d), h + d


def pack():
    """Shelf packs every cube's UV net into the atlas."""
    boxes = []
    for bone, name, origin, size, surface in CUBES:
        uw, uh = box_uv_size(size)
        boxes.append({"bone": bone, "name": name, "origin": origin, "size": size,
                      "surface": surface, "uw": uw, "uh": uh})
    boxes.sort(key=lambda b: -b["uh"])

    x = y = shelf_height = 0
    for box in boxes:
        if x + box["uw"] > ATLAS:
            x = 0
            y += shelf_height
            shelf_height = 0
        if y + box["uh"] > ATLAS:
            raise SystemExit(f"atlas too small for {box['name']} ({box['uw']}x{box['uh']})")
        box["uv"] = (x, y)
        x += box["uw"]
        shelf_height = max(shelf_height, box["uh"])
    return boxes


def main():
    boxes = pack()
    by_bone = {}
    for box in boxes:
        by_bone.setdefault(box["bone"], []).append(box)

    bones = []
    for name, spec in BONES.items():
        bone = {"name": name, "pivot": list(spec["pivot"])}
        if spec["parent"]:
            bone["parent"] = spec["parent"]
        cubes = []
        for box in by_bone.get(name, []):
            cubes.append({
                "origin": list(box["origin"]),
                "size": list(box["size"]),
                "uv": list(box["uv"]),
            })
        if cubes:
            bone["cubes"] = cubes
        bones.append(bone)

    geometry = {
        "format_version": "1.12.0",
        "minecraft:geometry": [
            {
                "description": {
                    "identifier": "geometry.kj_kaiju",
                    "texture_width": ATLAS,
                    "texture_height": ATLAS,
                    "visible_bounds_width": 16,
                    "visible_bounds_height": 14,
                    "visible_bounds_offset": [0, 6, 0],
                },
                "bones": bones,
            }
        ],
    }

    model_path = os.path.join(RP, "models/entity/kaiju.geo.json")
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    with open(model_path, "w") as fh:
        json.dump(geometry, fh, indent=2)
        fh.write("\n")
    print("wrote", os.path.relpath(model_path, ROOT))

    # The texture generator paints these rectangles.
    regions = [
        {"name": box["name"], "surface": box["surface"], "uv": list(box["uv"]),
         "size": [box["uw"], box["uh"]]}
        for box in boxes
    ]
    map_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kaiju_uv_map.json")
    with open(map_path, "w") as fh:
        json.dump({"atlas": ATLAS, "regions": regions}, fh, indent=2)
        fh.write("\n")
    print("wrote", os.path.relpath(map_path, ROOT))
    total = sum(box["uw"] * box["uh"] for box in boxes)
    print(f"{len(boxes)} cubes, atlas usage {total / (ATLAS * ATLAS) * 100:.0f}%")


if __name__ == "__main__":
    main()
