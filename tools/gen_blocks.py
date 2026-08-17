#!/usr/bin/env python3
"""Custom blocks for Lost Island: Abandoned.

All blocks are plain full cubes: minecraft:geometry is deliberately omitted so
the engine uses its built-in full-block model. Only components that are stable
in Bedrock 1.21.0 are used.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "build", "Lost_Island_BP")
OUT = os.path.join(ROOT, "tools", "out")

BLOCK_FV = "1.20.50"

# identifier suffix, display name, map colour, hardness, light, category
BLOCKS = [
    ("rusted_metal",             "Rusted Metal",            "#7a6b5c", 2.5, 0, "construction"),
    ("damaged_concrete",         "Damaged Concrete",        "#8f8f8b", 2.0, 0, "construction"),
    ("mossy_concrete",           "Mossy Concrete",          "#6e7a5c", 2.0, 0, "construction"),
    ("lab_panel",               "Laboratory Panel",         "#c2c4c6", 1.8, 0, "construction"),
    ("lab_vent",                "Laboratory Vent",          "#54565a", 1.8, 0, "construction"),
    ("emergency_light",         "Emergency Light",          "#c48424", 1.2, 9, "construction"),
    ("warning_sign_quarantine", "Quarantine Sign",          "#d6b020", 1.0, 0, "construction"),
    ("warning_sign_keepout",    "Keep Out Sign",            "#c6c6c2", 1.0, 0, "construction"),
    ("warning_sign_handwritten", "Handwritten Warning",     "#926c3e", 1.0, 0, "construction"),
    ("notice_board",            "Notice Board",             "#7c5c36", 1.0, 0, "construction"),
]


def main():
    os.makedirs(os.path.join(BP, "blocks"), exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    lang = []
    for ident, name, mapcol, hardness, light, cat in BLOCKS:
        comp = {
            "minecraft:material_instances": {
                "*": {
                    "texture": "li_" + ident,
                    "render_method": "opaque",
                    "face_dimming": True,
                    "ambient_occlusion": True,
                }
            },
            "minecraft:destructible_by_mining": {"seconds_to_destroy": hardness},
            "minecraft:destructible_by_explosion": {"explosion_resistance": 15},
            "minecraft:map_color": mapcol,
            "minecraft:friction": 0.6,
        }
        if light:
            comp["minecraft:light_emission"] = light
        blk = {
            "format_version": BLOCK_FV,
            "minecraft:block": {
                "description": {
                    "identifier": "li:" + ident,
                    "menu_category": {"category": cat},
                },
                "components": comp,
            },
        }
        with open(os.path.join(BP, "blocks", ident + ".json"), "w") as f:
            json.dump(blk, f, indent=2)
            f.write("\n")
        lang.append(("tile.li:%s.name" % ident, name))

    with open(os.path.join(OUT, "block_lang.txt"), "w") as f:
        for k, v in lang:
            f.write("%s=%s\n" % (k, v))
    print("blocks         : %d" % len(BLOCKS))


if __name__ == "__main__":
    main()
