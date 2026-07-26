#!/usr/bin/env python3
"""Generate the Atmos graphics pack: fog definitions plus biome assignments.

This is the graphics pack for Minecraft Bedrock 1.16.100 - 1.21.x, i.e. any
version from before Vibrant Visuals. Distance fog is the main lever the engine
gives a resource pack on those builds, so that is what this drives.

Schema: learn.microsoft.com/en-us/minecraft/creator/documents/foginresourcepacks

Run from the repo root:  python3 tools/make_atmos.py
"""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, "ATM_RP")

# fog_start / fog_end with render_distance_type "render" are fractions of the
# player's render distance, so they hold up at any view-distance setting.
# A lower fog_start means haze creeps in closer = moodier but less visible.


def air(start, end, color):
    return {"fog_start": start, "fog_end": end, "fog_color": color,
            "render_distance_type": "render"}


def water(end, color, *, start=0.0):
    """Underwater fog. Measured in blocks - vanilla is 60, higher is clearer."""
    return {
        "fog_start": start,
        "fog_end": end,
        "fog_color": color,
        "render_distance_type": "fixed",
        "transition_fog": {
            "init_fog": {"fog_start": 0.0, "fog_end": 0.02, "fog_color": color,
                         "render_distance_type": "fixed"},
            "min_percent": 0.2,
            "mid_seconds": 4,
            "mid_percent": 0.6,
            "max_seconds": 20,
        },
    }


LAVA = {"fog_start": 0.0, "fog_end": 0.7, "fog_color": "#B32B00",
        "render_distance_type": "fixed"}
LAVA_RESIST = {"fog_start": 2.0, "fog_end": 6.0, "fog_color": "#B32B00",
               "render_distance_type": "fixed"}

FOGS = {
    # The overworld baseline: gentle blue aerial haze in the distance, clearer
    # water than vanilla, heavy grey murk in the rain.
    "default": {
        "air": air(0.60, 1.0, "#A8C8E8"),
        "weather": air(0.12, 0.72, "#59636F"),
        "water": water(95.0, "#2E86C8"),
        "lava": LAVA,
        "lava_resistance": LAVA_RESIST,
    },
    "ocean": {
        "air": air(0.62, 1.0, "#9EC4E4"),
        "weather": air(0.12, 0.72, "#4E5966"),
        "water": water(140.0, "#1E78C8"),
        "lava": LAVA,
        "lava_resistance": LAVA_RESIST,
    },
    "warm_ocean": {
        "air": air(0.66, 1.0, "#B4DCEC"),
        "weather": air(0.14, 0.74, "#5A6A72"),
        "water": water(180.0, "#17A3C8"),
        "lava": LAVA,
        "lava_resistance": LAVA_RESIST,
    },
    "frozen_ocean": {
        "air": air(0.44, 1.0, "#C6DCEA"),
        "weather": air(0.10, 0.62, "#8FA2B0"),
        "water": water(80.0, "#3C7EA8"),
        "lava": LAVA,
        "lava_resistance": LAVA_RESIST,
    },
    # Thick, low, green murk.
    "swamp": {
        "air": air(0.34, 0.94, "#6A7A4A"),
        "weather": air(0.08, 0.60, "#4A5440"),
        "water": water(24.0, "#4C6626"),
        "lava": LAVA,
        "lava_resistance": LAVA_RESIST,
    },
    "desert": {
        "air": air(0.46, 1.0, "#E3C88C"),
        "weather": air(0.16, 0.76, "#9C8B66"),
        "water": water(70.0, "#2E86C8"),
        "lava": LAVA,
        "lava_resistance": LAVA_RESIST,
    },
    "mesa": {
        "air": air(0.42, 1.0, "#D19A5E"),
        "weather": air(0.14, 0.72, "#8E6A46"),
        "water": water(70.0, "#2E86C8"),
        "lava": LAVA,
        "lava_resistance": LAVA_RESIST,
    },
    "ice": {
        "air": air(0.42, 1.0, "#C6DCEA"),
        "weather": air(0.08, 0.58, "#9FB4C4"),
        "water": water(80.0, "#3C7EA8"),
        "lava": LAVA,
        "lava_resistance": LAVA_RESIST,
    },
    "jungle": {
        "air": air(0.40, 0.98, "#86A66A"),
        "weather": air(0.10, 0.66, "#5C6E4E"),
        "water": water(55.0, "#2E8C7A"),
        "lava": LAVA,
        "lava_resistance": LAVA_RESIST,
    },
    "nether": {
        "air": air(0.06, 0.62, "#4A1008"),
        "weather": air(0.06, 0.62, "#4A1008"),
        "lava": LAVA,
        "lava_resistance": LAVA_RESIST,
    },
    "end": {
        "air": air(0.20, 0.90, "#1A121F"),
        "weather": air(0.20, 0.90, "#1A121F"),
        "lava": LAVA,
        "lava_resistance": LAVA_RESIST,
    },
}

# Legacy biome names, which is what biomes_client.json keys on.
BIOME_FOG = {
    "default": "default",
    "ocean": "ocean",
    "deep_ocean": "ocean",
    "cold_ocean": "ocean",
    "deep_cold_ocean": "ocean",
    "lukewarm_ocean": "warm_ocean",
    "deep_lukewarm_ocean": "warm_ocean",
    "warm_ocean": "warm_ocean",
    "deep_warm_ocean": "warm_ocean",
    "frozen_ocean": "frozen_ocean",
    "deep_frozen_ocean": "frozen_ocean",
    "swampland": "swamp",
    "swampland_mutated": "swamp",
    "mangrove_swamp": "swamp",
    "desert": "desert",
    "desert_hills": "desert",
    "mesa": "mesa",
    "mesa_plateau": "mesa",
    "mesa_bryce": "mesa",
    "ice_plains": "ice",
    "ice_mountains": "ice",
    "frozen_river": "ice",
    "cold_taiga": "ice",
    "jungle": "jungle",
    "jungle_hills": "jungle",
    "bamboo_jungle": "jungle",
    "hell": "nether",
    "soulsand_valley": "nether",
    "crimson_forest": "nether",
    "warped_forest": "nether",
    "basalt_deltas": "nether",
    "the_end": "end",
}


def main():
    os.makedirs(os.path.join(PACK, "fogs"), exist_ok=True)
    for name, distance in FOGS.items():
        doc = {
            "format_version": "1.16.100",
            "minecraft:fog_settings": {
                "description": {"identifier": f"atmos:{name}"},
                "distance": distance,
            },
        }
        path = os.path.join(PACK, "fogs", f"{name}.json")
        with open(path, "w") as fh:
            json.dump(doc, fh, indent=2)
            fh.write("\n")
    print(f"wrote {len(FOGS)} fog definitions to ATM_RP/fogs/")

    biomes = {b: {"fog_identifier": f"atmos:{f}"} for b, f in BIOME_FOG.items()}
    path = os.path.join(PACK, "biomes_client.json")
    with open(path, "w") as fh:
        json.dump({"biomes": biomes}, fh, indent=2)
        fh.write("\n")
    print(f"wrote ATM_RP/biomes_client.json ({len(biomes)} biomes)")


if __name__ == "__main__":
    main()
