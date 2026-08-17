#!/usr/bin/env python3
"""Support content: the day/night sensor entity, custom fog definitions and the
invisible helper model. All 1.21.0-safe.

The sensor exists because Bedrock command syntax cannot read the world time.
An entity CAN test the time with minecraft:environment_sensor and swap its own
type_family, and commands CAN test families - so one tiny invisible entity per
player becomes a readable day/night flag.
"""
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "build", "Lost_Island_BP")
RP = os.path.join(ROOT, "build", "Lost_Island_RP")


def w(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)
        f.write("\n")


def main():
    # ------------------------------------------------------------ BP sensor
    w(os.path.join(BP, "entities", "sensor.json"), {
        "format_version": "1.20.60",
        "minecraft:entity": {
            "description": {
                "identifier": "li:sensor",
                "is_spawnable": False,
                "is_summonable": True,
                "is_experimental": False,
            },
            "component_groups": {
                "li:is_day": {
                    "minecraft:type_family": {
                        "family": ["li_sensor", "li_day", "inanimate"]}
                },
                "li:is_night": {
                    "minecraft:type_family": {
                        "family": ["li_sensor", "li_night", "inanimate"]}
                },
                "li:gone": {"minecraft:instant_despawn": {}},
            },
            "components": {
                "minecraft:type_family": {
                    "family": ["li_sensor", "inanimate"]},
                "minecraft:health": {"value": 200, "max": 200},
                "minecraft:collision_box": {"width": 0.1, "height": 0.1},
                "minecraft:physics": {"has_gravity": False,
                                      "has_collision": False},
                "minecraft:knockback_resistance": {"value": 1.0},
                "minecraft:pushable": {"is_pushable": False,
                                       "is_pushable_by_piston": False},
                "minecraft:fire_immune": True,
                # Self-cleaning: the atmosphere system teleports the sensor to
                # its player every 5s, so it only ever despawns once its owner
                # is gone for good.
                "minecraft:despawn": {
                    "despawn_from_distance": {"min_distance": 40,
                                              "max_distance": 72},
                    "despawn_from_inactivity": False,
                },
                "minecraft:environment_sensor": {
                    "triggers": [
                        {"filters": {"test": "is_daytime", "subject": "self",
                                     "operator": "==", "value": True},
                         "event": "li:became_day"},
                        {"filters": {"test": "is_daytime", "subject": "self",
                                     "operator": "==", "value": False},
                         "event": "li:became_night"},
                    ]
                },
            },
            "events": {
                "minecraft:entity_spawned": {
                    "add": {"component_groups": ["li:is_day"]}},
                "li:became_day": {
                    "remove": {"component_groups": ["li:is_night"]},
                    "add": {"component_groups": ["li:is_day"]}},
                "li:became_night": {
                    "remove": {"component_groups": ["li:is_day"]},
                    "add": {"component_groups": ["li:is_night"]}},
                "li:remove": {"add": {"component_groups": ["li:gone"]}},
            },
        },
    })

    # ------------------------------------------------------------ RP sensor
    w(os.path.join(RP, "entity", "sensor.json"), {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": "li:sensor",
                "materials": {"default": "entity_alphatest"},
                "textures": {"default": "textures/entity/li_empty"},
                "geometry": {"default": "geometry.li_empty"},
                "render_controllers": ["controller.render.li_default"],
            }
        },
    })
    w(os.path.join(RP, "models", "entity", "empty.json"), {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": "geometry.li_empty",
                "texture_width": 8, "texture_height": 8,
                "visible_bounds_width": 1, "visible_bounds_height": 1,
                "visible_bounds_offset": [0, 0, 0],
            },
            "bones": [{"name": "root", "pivot": [0, 0, 0]}],
        }],
    })
    d = os.path.join(RP, "textures", "entity")
    os.makedirs(d, exist_ok=True)
    Image.new("RGBA", (8, 8), (0, 0, 0, 0)).save(
        os.path.join(d, "li_empty.png"))

    # ---------------------------------------------------------------- fogs
    fogs = {
        "swamp_fog": ("#46523c", 6, 34),
        "night_fog": ("#0d1218", 16, 90),
        "facility_fog": ("#14181c", 4, 26),
        "storm_fog": ("#3d444a", 10, 52),
    }
    for name, (col, start, end) in fogs.items():
        w(os.path.join(RP, "fogs", name + ".json"), {
            "format_version": "1.16.100",
            "minecraft:fog_settings": {
                "description": {"identifier": "li:" + name},
                "distance": {
                    "air": {
                        "fog_start": start, "fog_end": end,
                        "fog_color": col,
                        "render_distance_type": "fixed",
                    },
                },
            },
        })
    print("support        : sensor entity, empty model, %d fogs" % len(fogs))


if __name__ == "__main__":
    main()
