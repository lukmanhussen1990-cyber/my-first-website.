#!/usr/bin/env python3
"""Emits the templated JSON content: items, blocks, attachables, particles and
the two texture atlases.

These files are highly repetitive, so generating them keeps every schema
decision in one reviewable place instead of spread over 25 near-identical
files. Entities, geometry and the mansion functions are authored elsewhere.

Run: python3 tools/gen_content.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "src" / "resource_pack"
BP = ROOT / "src" / "behavior_pack"

ITEM_FORMAT = "1.20.50"
BLOCK_FORMAT = "1.20.60"


def dump(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


# =============================================================== items =====
def item(identifier: str, texture: str, *, category: str = "items",
         stack: int = 64, extra: dict | None = None) -> dict:
    components: dict = {
        "minecraft:icon": texture,
        "minecraft:max_stack_size": stack,
    }
    components.update(extra or {})
    return {
        "format_version": ITEM_FORMAT,
        "minecraft:item": {
            "description": {
                "identifier": identifier,
                "menu_category": {"category": category},
            },
            "components": components,
        },
    }


# `minecraft:use_modifiers` makes an otherwise-inert item explicitly usable so
# the ItemUse event fires reliably when a mobile player taps with it held.
USABLE = {"minecraft:use_modifiers": {"use_duration": 0.2, "movement_modifier": 0.6}}

ITEMS = {
    "scanner": item(
        "myc:scanner", "myc_scanner", category="equipment", stack=1,
        extra={
            **USABLE,
            "minecraft:hand_equipped": True,
            "minecraft:durability": {"max_durability": 400},
            "minecraft:tags": {"tags": ["myc:equipment", "myc:tool"]},
        },
    ),
    "contamination_detector": item(
        "myc:contamination_detector", "myc_contamination_detector",
        category="equipment", stack=1,
        extra={
            **USABLE,
            "minecraft:hand_equipped": True,
            "minecraft:durability": {"max_durability": 300},
            "minecraft:tags": {"tags": ["myc:equipment", "myc:tool"]},
        },
    ),
    "medkit": item(
        "myc:medkit", "myc_medkit", category="items", stack=8,
        extra={
            "minecraft:use_modifiers": {"use_duration": 1.6, "movement_modifier": 0.35},
            "minecraft:tags": {"tags": ["myc:equipment", "myc:medical"]},
        },
    ),
    "suppressant": item(
        "myc:suppressant", "myc_suppressant", category="items", stack=16,
        extra={
            "minecraft:use_modifiers": {"use_duration": 1.2, "movement_modifier": 0.5},
            "minecraft:tags": {"tags": ["myc:equipment", "myc:medical"]},
        },
    ),
    "biofilter": item(
        "myc:biofilter", "myc_biofilter", category="items", stack=16,
        extra={
            **USABLE,
            "minecraft:tags": {"tags": ["myc:equipment"]},
        },
    ),
    "spore_sample": item(
        "myc:spore_sample", "myc_spore_sample", category="nature", stack=32,
        extra={"minecraft:tags": {"tags": ["myc:material"]}},
    ),
    "spore_mask": item(
        "myc:spore_mask", "myc_spore_mask", category="equipment", stack=1,
        extra={
            "minecraft:wearable": {"slot": "slot.armor.head", "protection": 3},
            "minecraft:durability": {"max_durability": 320},
            "minecraft:repairable": {
                "repair_items": [
                    {"items": ["myc:biofilter"], "repair_amount": 120}
                ]
            },
            "minecraft:tags": {"tags": ["myc:equipment", "myc:protective"]},
        },
    ),
    "protective_suit": item(
        "myc:protective_suit", "myc_protective_suit", category="equipment", stack=1,
        extra={
            "minecraft:wearable": {"slot": "slot.armor.chest", "protection": 6},
            "minecraft:durability": {"max_durability": 480},
            "minecraft:repairable": {
                "repair_items": [
                    {"items": ["myc:biofilter"], "repair_amount": 150}
                ]
            },
            "minecraft:tags": {"tags": ["myc:equipment", "myc:protective"]},
        },
    ),
}


# ============================================================== blocks =====
def block(identifier: str, texture: str, *, category: str = "construction",
          hardness: float = 1.2, resistance: float = 12.0,
          light: int = 0, map_color: str = "#9AA0A8",
          friction: float | None = None) -> dict:
    components: dict = {
        "minecraft:material_instances": {
            "*": {"texture": texture, "render_method": "opaque"}
        },
        "minecraft:geometry": "minecraft:geometry.full_block",
        "minecraft:destructible_by_mining": {"seconds_to_destroy": hardness},
        "minecraft:destructible_by_explosion": {"explosion_resistance": resistance},
        "minecraft:map_color": map_color,
    }
    if light:
        components["minecraft:light_emission"] = light
    if friction is not None:
        components["minecraft:friction"] = friction
    return {
        "format_version": BLOCK_FORMAT,
        "minecraft:block": {
            "description": {
                "identifier": identifier,
                "menu_category": {"category": category},
            },
            "components": components,
        },
    }


BLOCKS = {
    # --- smart-home hardware -------------------------------------------------
    "clean_panel": block("myc:clean_panel", "myc_clean_panel",
                         hardness=1.0, map_color="#D8DCE2"),
    "screen": block("myc:screen", "myc_screen",
                    hardness=0.8, light=7, map_color="#12202A"),
    "server_rack": block("myc:server_rack", "myc_server_rack",
                         hardness=1.6, light=5, map_color="#1C1E24"),
    "lab_panel": block("myc:lab_panel", "myc_lab_panel",
                       hardness=1.0, light=3, map_color="#ECF0F4"),
    "control_panel": block("myc:control_panel", "myc_screen",
                           hardness=1.2, light=6, map_color="#16323C"),
    # Alarm lights and emergency lights come in off/on pairs. Lockdown swaps
    # them with a handful of `fill ... replace` commands, so the alarm system
    # costs nothing while idle.
    "alarm_light": block("myc:alarm_light", "myc_alarm_light",
                         hardness=0.8, light=0, map_color="#5A2020"),
    "alarm_light_on": block("myc:alarm_light_on", "myc_alarm_light_on",
                            hardness=0.8, light=14, map_color="#D03E3E"),
    "emergency_light": block("myc:emergency_light", "myc_emergency_light",
                             hardness=0.6, light=12, map_color="#C04040"),
    # --- contamination -------------------------------------------------------
    "fungal_growth": block("myc:fungal_growth", "myc_fungal_growth",
                           category="nature", hardness=0.4, resistance=2.0,
                           light=3, map_color="#6A2A8A"),
    "infected_block": block("myc:infected_block", "myc_infected_block",
                            category="nature", hardness=1.8, resistance=10.0,
                            map_color="#4E4E56"),
    "nest": block("myc:nest", "myc_nest", category="nature",
                  hardness=1.0, resistance=4.0, light=6, map_color="#3A1A50"),
    "spore_vent": block("myc:spore_vent", "myc_spore_vent", category="nature",
                        hardness=1.4, resistance=8.0, light=4,
                        map_color="#2A2A32"),
}


# ========================================================= attachables =====
def attachable(identifier: str, geometry: str, layer_var: str) -> dict:
    """Armour attachable so worn protective gear actually renders on the player."""
    return {
        "format_version": "1.10.0",
        "minecraft:attachable": {
            "description": {
                "identifier": identifier,
                "materials": {
                    "default": "armor",
                    "enchanted": "armor_enchanted",
                },
                "textures": {
                    "default": "textures/models/armor/myc_suit_1",
                    "enchanted": "textures/misc/enchanted_actor_glint",
                },
                "geometry": {"default": geometry},
                "scripts": {"parent_setup": f"variable.{layer_var} = 0.0;"},
                "render_controllers": ["controller.render.armor"],
            }
        },
    }


ATTACHABLES = {
    "myc_spore_mask": attachable(
        "myc:spore_mask", "geometry.humanoid.armor.helmet", "helmet_layer_visible"
    ),
    "myc_protective_suit": attachable(
        "myc:protective_suit", "geometry.humanoid.armor.chestplate", "chest_layer_visible"
    ),
}


# =========================================================== particles =====
def particle(identifier: str, *, count: int, radius: float, lifetime: float,
             speed: float, size: float, uv: list[int], color: list[float],
             gravity: float) -> dict:
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {
                "identifier": identifier,
                "basic_render_parameters": {
                    "material": "particles_alpha",
                    "texture": "textures/particle/myc_spores",
                },
            },
            "components": {
                # One-shot emitters only. Nothing in this pack leaves a
                # permanently-emitting particle source running on mobile.
                "minecraft:emitter_rate_instant": {"num_particles": count},
                "minecraft:emitter_lifetime_once": {"active_time": 0.5},
                "minecraft:emitter_shape_sphere": {
                    "radius": radius,
                    "direction": "outwards",
                },
                "minecraft:particle_lifetime_expression": {"max_lifetime": lifetime},
                "minecraft:particle_initial_speed": speed,
                "minecraft:particle_motion_dynamic": {
                    "linear_acceleration": [0.0, gravity, 0.0],
                    "linear_drag_coefficient": 1.4,
                },
                "minecraft:particle_appearance_billboard": {
                    "size": [size, size],
                    "facing_camera_mode": "lookat_xyz",
                    "uv": {
                        "texture_width": 16,
                        "texture_height": 16,
                        "uv": uv,
                        "uv_size": [8, 8],
                    },
                },
                "minecraft:particle_appearance_tinting": {"color": color},
            },
        },
    }


PARTICLES = {
    "myc_spores": particle(
        "myc:spores", count=6, radius=0.9, lifetime=1.4, speed=0.35,
        size=0.09, uv=[0, 0], color=[0.62, 0.38, 0.82, 0.9], gravity=-0.9,
    ),
    "myc_contamination_burst": particle(
        "myc:contamination_burst", count=18, radius=1.4, lifetime=1.8, speed=0.9,
        size=0.13, uv=[8, 0], color=[0.48, 0.24, 0.70, 1.0], gravity=-1.4,
    ),
    "myc_scan_ping": particle(
        "myc:scan_ping", count=10, radius=1.1, lifetime=0.9, speed=0.55,
        size=0.07, uv=[8, 8], color=[0.29, 0.84, 0.81, 1.0], gravity=0.2,
    ),
    "myc_alarm_flare": particle(
        "myc:alarm_flare", count=8, radius=0.6, lifetime=1.1, speed=0.3,
        size=0.11, uv=[0, 8], color=[0.90, 0.24, 0.24, 1.0], gravity=0.35,
    ),
}


# ============================================================== atlases ====
def item_atlas() -> dict:
    return {
        "resource_pack_name": "luxury_tech_mycelium_x",
        "texture_name": "atlas.items",
        "texture_data": {
            key: {"textures": f"textures/items/{key}"}
            for key in sorted(
                {c["minecraft:item"]["components"]["minecraft:icon"]
                 for c in ITEMS.values()}
            )
        },
    }


def terrain_atlas() -> dict:
    keys = sorted(
        {
            inst["texture"]
            for b in BLOCKS.values()
            for inst in b["minecraft:block"]["components"]["minecraft:material_instances"].values()
        }
    )
    return {
        "resource_pack_name": "luxury_tech_mycelium_x",
        "texture_name": "atlas.terrain",
        "padding": 8,
        "num_mip_levels": 4,
        "texture_data": {
            key: {"textures": f"textures/blocks/{key}"} for key in keys
        },
    }


def sound_definitions() -> dict:
    """Custom sound events aliased onto vanilla audio files.

    Referencing vanilla paths means the pack ships no .ogg data at all, which
    keeps the download small for mobile.
    """
    def defn(category: str, sounds: list[str]) -> dict:
        return {"category": category, "sounds": sounds}

    return {
        "format_version": "1.14.0",
        "sound_definitions": {
            "myc.scanner.ping": defn("player", ["sounds/random/orb"]),
            "myc.scanner.alert": defn("player", ["sounds/note/pling"]),
            "myc.alarm": defn("ambient", ["sounds/mob/wither/shoot"]),
            "myc.lockdown": defn("ambient", ["sounds/random/anvil_land"]),
            "myc.infect": defn("player", ["sounds/mob/slime/attack1"]),
            "myc.cure": defn("player", ["sounds/random/drink"]),
            "myc.build": defn("neutral", ["sounds/random/levelup"]),
        },
    }


def main() -> None:
    for name, data in ITEMS.items():
        dump(BP / "items" / f"{name}.json", data)
    for name, data in BLOCKS.items():
        dump(BP / "blocks" / f"{name}.json", data)
    for name, data in ATTACHABLES.items():
        dump(RP / "attachables" / f"{name}.json", data)
    for name, data in PARTICLES.items():
        dump(RP / "particles" / f"{name}.json", data)

    dump(RP / "textures" / "item_texture.json", item_atlas())
    dump(RP / "textures" / "terrain_texture.json", terrain_atlas())
    dump(RP / "sounds" / "sound_definitions.json", sound_definitions())

    print(
        f"wrote {len(ITEMS)} items, {len(BLOCKS)} blocks, "
        f"{len(ATTACHABLES)} attachables, {len(PARTICLES)} particles, 2 atlases, "
        f"sound_definitions"
    )


if __name__ == "__main__":
    main()
