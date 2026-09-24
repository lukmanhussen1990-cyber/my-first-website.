"""Generate the JSON/lang/function files of the Arcane Arsenal packs.

Everything that is repetitive (item definitions, recipes, particle
effects, names) is described once in the tables below and written out
here, so the behavior pack, resource pack and scripts can't drift apart.

Run:  python3 tools/make_packs.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "packs", "ArcaneArsenal_BP")
RP = os.path.join(ROOT, "packs", "ArcaneArsenal_RP")
NS = "arcane"

TIER_COLOR = {1: "§b", 2: "§d", 3: "§6"}

# cooldown is in seconds and must match COOLDOWN_TICKS in scripts/weapons.js
WEAPONS = [
    {"id": "frostbite_blade", "name": "Frostbite Blade", "tier": 1, "damage": 8, "durability": 1800,
     "repair": "minecraft:diamond", "cooldown": 6, "button": "Frost Nova",
     "recipe": ([" P ", "PSP", " P "], {"P": "minecraft:packed_ice", "S": "minecraft:diamond_sword"})},
    {"id": "inferno_sword", "name": "Inferno Sword", "tier": 1, "damage": 8, "durability": 1800,
     "repair": "minecraft:diamond", "cooldown": 5, "button": "Flame Wave",
     "recipe": ([" B ", "MSM", " B "], {"B": "minecraft:blaze_rod", "M": "minecraft:magma",
                                         "S": "minecraft:diamond_sword"})},
    {"id": "venom_fang", "name": "Venom Fang", "tier": 1, "damage": 6, "durability": 1600,
     "repair": "minecraft:diamond", "cooldown": 8, "button": "Toxic Cloud",
     "recipe": ([" E ", "FSF", " E "], {"E": "minecraft:spider_eye", "F": "minecraft:fermented_spider_eye",
                                         "S": "minecraft:iron_sword"})},
    {"id": "storm_hammer", "name": "Storm Hammer", "tier": 1, "damage": 10, "durability": 2000,
     "repair": "minecraft:copper_block", "cooldown": 8, "button": "Thunder Call",
     "recipe": (["CLC", "CDC", " K "], {"C": "minecraft:copper_block", "L": "minecraft:lightning_rod",
                                         "D": "minecraft:diamond", "K": "minecraft:stick"})},
    {"id": "shadow_reaper", "name": "Shadow Reaper", "tier": 2, "damage": 11, "durability": 3200,
     "repair": "minecraft:netherite_ingot", "cooldown": 5, "button": "Shadow Dash",
     "recipe": ([" E ", "OVO", " N "], {"E": "minecraft:ender_eye", "O": "minecraft:crying_obsidian",
                                         "V": "arcane:venom_fang", "N": "minecraft:netherite_ingot"})},
    {"id": "arcane_staff", "name": "Arcane Staff", "tier": 2, "damage": 5, "durability": 3200,
     "repair": "minecraft:amethyst_shard", "cooldown": 1.25, "button": "Arcane Missile",
     "recipe": ([" A ", "FDI", " B "], {"A": "minecraft:amethyst_block", "F": "arcane:frostbite_blade",
                                         "D": "minecraft:diamond_block", "I": "arcane:inferno_sword",
                                         "B": "minecraft:blaze_rod"})},
    {"id": "tempest_blade", "name": "Tempest Blade", "tier": 2, "damage": 10, "durability": 3200,
     "repair": "minecraft:netherite_ingot", "cooldown": 7, "button": "Cyclone",
     "recipe": ([" F ", "MHM", " N "], {"F": "minecraft:feather", "M": "minecraft:phantom_membrane",
                                         "H": "arcane:storm_hammer", "N": "minecraft:netherite_ingot"})},
    {"id": "celestial_godslayer", "name": "Celestial Godslayer", "tier": 3, "damage": 25, "durability": None,
     "repair": None, "cooldown": 10, "button": "Judgement",
     "recipe": ([" S ", "RBA", " T "], {"S": "minecraft:nether_star", "R": "arcane:shadow_reaper",
                                         "B": "minecraft:beacon", "A": "arcane:arcane_staff",
                                         "T": "arcane:tempest_blade"})},
]

TORCH = {"id": "radiant_torch", "name": "Radiant Torch", "cooldown": 0.4, "button": "Toggle Beam",
         "recipe": ([" G ", "GTG", " I "], {"G": "minecraft:glowstone_dust", "T": "minecraft:torch",
                                             "I": "minecraft:gold_ingot"})}

# ------------------------------------------------------------ particles
ATLAS = "textures/particle/arcane_particles"
CELL = {"sparkle": (0, 0), "dot": (8, 0), "ember": (16, 0), "flame": (24, 0),
        "smoke": (0, 8), "streak": (8, 8), "rune": (16, 8), "shard": (24, 8)}

# element: (start rgb, end rgb)
ELEMENTS = {
    "frost":  ((0.88, 0.98, 1.00), (0.17, 0.53, 0.81)),
    "fire":   ((1.00, 0.95, 0.55), (0.85, 0.20, 0.05)),
    "venom":  ((0.82, 1.00, 0.50), (0.18, 0.56, 0.20)),
    "storm":  ((1.00, 1.00, 0.85), (0.95, 0.80, 0.15)),
    "shadow": ((0.78, 0.48, 1.00), (0.22, 0.05, 0.32)),
    "arcane": ((1.00, 0.78, 1.00), (0.55, 0.20, 0.90)),
    "wind":   ((1.00, 1.00, 1.00), (0.45, 0.85, 0.80)),
    "holy":   ((1.00, 1.00, 0.88), (1.00, 0.72, 0.18)),
}
EMBERS = {
    "torch_ember":   ((1.00, 0.92, 0.55), (0.90, 0.25, 0.05)),
    "soul_ember":    ((0.75, 1.00, 1.00), (0.10, 0.60, 0.72)),
    "radiant_ember": ((1.00, 1.00, 0.92), (1.00, 0.78, 0.30)),
}


def lerp_color(c0, c1):
    t = "variable.particle_age / variable.particle_lifetime"
    return [f"math.lerp({a}, {b}, {t})" for a, b in zip(c0, c1)] + [1.0]


def billboard(sprite, size, mode="lookat_xyz"):
    u, v = CELL[sprite]
    return {
        "size": [size, size],
        "facing_camera_mode": mode,
        "uv": {"texture_width": 32, "texture_height": 16, "uv": [u, v], "uv_size": [8, 8]},
    }


def particle(identifier, components, material="particles_alpha"):
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {
                "identifier": identifier,
                "basic_render_parameters": {"material": material, "texture": ATLAS},
            },
            "components": components,
        },
    }


SHRINK = "(1 - variable.particle_age / variable.particle_lifetime)"


def burst(elem, colors):
    rising = elem in ("fire", "holy", "arcane")
    return particle(f"{NS}:{elem}_burst", {
        "minecraft:emitter_rate_instant": {"num_particles": 10},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.25, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.4 + variable.particle_random_1 * 0.35"},
        "minecraft:particle_initial_speed": "2.5 + variable.particle_random_2 * 2.0",
        "minecraft:particle_initial_spin": {"rotation": "variable.particle_random_3 * 360", "rotation_rate": 0},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.2 if rising else -1.8, 0],
                                              "linear_drag_coefficient": 3.5},
        "minecraft:particle_appearance_billboard": billboard("sparkle", f"0.13 * {SHRINK} + 0.02"),
        "minecraft:particle_appearance_tinting": {"color": lerp_color(*colors)},
    })


def mote(elem, colors, sprite="sparkle", size=0.075, life=0.7, name=None):
    return particle(f"{NS}:{name or elem + '_mote'}", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"direction": ["variable.particle_random_1 - 0.5", 0.6,
                                                        "variable.particle_random_2 - 0.5"]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": f"{life * 0.6} + variable.particle_random_3 * {life * 0.6}"},
        "minecraft:particle_initial_speed": 0.35,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.35, 0], "linear_drag_coefficient": 1.5},
        "minecraft:particle_appearance_billboard": billboard(sprite, f"{size} * {SHRINK} + 0.01"),
        "minecraft:particle_appearance_tinting": {"color": lerp_color(*colors)},
    })


def rune(elem, colors):
    return particle(f"{NS}:{elem}_rune", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.7},
        "minecraft:particle_initial_speed": 0,
        "minecraft:particle_initial_spin": {"rotation": 0, "rotation_rate": 120},
        "minecraft:particle_motion_dynamic": {},
        "minecraft:particle_appearance_billboard": billboard(
            "rune", "0.9 + 1.1 * variable.particle_age / variable.particle_lifetime", "emitter_transform_xz"),
        "minecraft:particle_appearance_tinting": {"color": lerp_color(colors[0], colors[1])},
    })


def ember(name, colors, sprite="ember"):
    return particle(f"{NS}:{name}", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"direction": ["(variable.particle_random_1 - 0.5) * 0.6", 1,
                                                        "(variable.particle_random_2 - 0.5) * 0.6"]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.45 + variable.particle_random_3 * 0.5"},
        "minecraft:particle_initial_speed": "0.35 + variable.particle_random_4 * 0.4",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.8, 0], "linear_drag_coefficient": 1.8},
        "minecraft:particle_appearance_billboard": billboard(sprite, f"0.017 * {SHRINK} + 0.005"),
        "minecraft:particle_appearance_tinting": {"color": lerp_color(*colors)},
    })


def glint(elem, colors):
    """Tiny sparkle drifting off a held weapon (first-person friendly size)."""
    return particle(f"{NS}:{elem}_glint", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"direction": ["variable.particle_random_1 - 0.5", 0.8,
                                                        "variable.particle_random_2 - 0.5"]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.35 + variable.particle_random_3 * 0.3"},
        "minecraft:particle_initial_speed": 0.2,
        "minecraft:particle_initial_spin": {"rotation": "variable.particle_random_4 * 90", "rotation_rate": 0},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.25, 0], "linear_drag_coefficient": 2},
        "minecraft:particle_appearance_billboard": billboard("sparkle", f"0.022 * {SHRINK} + 0.004"),
        "minecraft:particle_appearance_tinting": {"color": lerp_color(*colors)},
    })


def special_particles():
    out = {}
    out["torch_smoke"] = particle(f"{NS}:torch_smoke", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"direction": ["(variable.particle_random_1 - 0.5) * 0.4", 1,
                                                        "(variable.particle_random_2 - 0.5) * 0.4"]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.9 + variable.particle_random_3 * 0.6"},
        "minecraft:particle_initial_speed": 0.15,
        "minecraft:particle_initial_spin": {"rotation": "variable.particle_random_4 * 360", "rotation_rate": 20},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.45, 0], "linear_drag_coefficient": 1.2},
        "minecraft:particle_appearance_billboard": billboard(
            "smoke", "0.022 + 0.04 * variable.particle_age / variable.particle_lifetime"),
        "minecraft:particle_appearance_tinting": {"color": [0.55, 0.55, 0.55, 1.0]},
        "minecraft:particle_appearance_lighting": {},
    })
    out["fire_flame"] = particle(f"{NS}:fire_flame", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"direction": ["variable.particle_random_1 - 0.5", 1,
                                                        "variable.particle_random_2 - 0.5"]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.35 + variable.particle_random_3 * 0.3"},
        "minecraft:particle_initial_speed": 0.4,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.4, 0], "linear_drag_coefficient": 1.0},
        "minecraft:particle_appearance_billboard": billboard("flame", f"0.2 * {SHRINK} + 0.05"),
    })
    out["frost_shards"] = particle(f"{NS}:frost_shards", {
        "minecraft:emitter_rate_instant": {"num_particles": 12},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.4, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.5 + variable.particle_random_1 * 0.3"},
        "minecraft:particle_initial_speed": "3 + variable.particle_random_2 * 2",
        "minecraft:particle_initial_spin": {"rotation": "variable.particle_random_3 * 360",
                                            "rotation_rate": "(variable.particle_random_4 - 0.5) * 720"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -9, 0], "linear_drag_coefficient": 1.0},
        "minecraft:particle_appearance_billboard": billboard("shard", "0.14"),
        "minecraft:particle_appearance_tinting": {"color": lerp_color(*ELEMENTS["frost"])},
    })
    out["holy_pillar"] = particle(f"{NS}:holy_pillar", {
        "minecraft:emitter_rate_instant": {"num_particles": 36},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_box": {"offset": [0, 4, 0], "half_dimensions": [0.35, 4, 0.35],
                                        "direction": [0, -1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.4 + variable.particle_random_1 * 0.4"},
        "minecraft:particle_initial_speed": "6 + variable.particle_random_2 * 4",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.5},
        "minecraft:particle_appearance_billboard": billboard("sparkle", f"0.16 * {SHRINK} + 0.04"),
        "minecraft:particle_appearance_tinting": {"color": lerp_color(*ELEMENTS["holy"])},
    })
    out["venom_cloud"] = particle(f"{NS}:venom_cloud", {
        "minecraft:emitter_rate_instant": {"num_particles": 22},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_disc": {"radius": 3.2, "plane_normal": [0, 1, 0], "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "1.0 + variable.particle_random_1 * 0.8"},
        "minecraft:particle_initial_speed": 0.25,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.3, 0], "linear_drag_coefficient": 1.0},
        "minecraft:particle_appearance_billboard": billboard("dot", f"0.2 * {SHRINK} + 0.05"),
        "minecraft:particle_appearance_tinting": {"color": lerp_color(*ELEMENTS["venom"])},
    })
    out["wind_streak"] = mote("wind", ELEMENTS["wind"], sprite="streak", size=0.22, life=0.5, name="wind_streak")
    out["storm_spark"] = mote("storm", ELEMENTS["storm"], sprite="dot", size=0.06, life=0.3, name="storm_spark")
    return out


def all_particles():
    out = {}
    for elem, colors in ELEMENTS.items():
        out[f"{elem}_burst"] = burst(elem, colors)
        out[f"{elem}_mote"] = mote(elem, colors)
        out[f"{elem}_rune"] = rune(elem, colors)
        out[f"{elem}_glint"] = glint(elem, colors)
    for name, colors in EMBERS.items():
        out[name] = ember(name, colors, "sparkle" if name == "radiant_ember" else "ember")
    out.update(special_particles())
    return out


# ------------------------------------------------------------ writers
def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


def item_json(w):
    ident = f"{NS}:{w['id']}"
    comps = {
        "minecraft:icon": {"texture": f"{NS}_{w['id']}"},
        "minecraft:display_name": {"value": f"item.{ident}.name"},
        "minecraft:max_stack_size": 1,
        "minecraft:hand_equipped": True,
        "minecraft:damage": w["damage"],
        "minecraft:enchantable": {"slot": "sword", "value": 14 + w["tier"] * 4},
        "minecraft:can_destroy_in_creative": False,
        "minecraft:cooldown": {"category": ident, "duration": w["cooldown"]},
        "minecraft:interact_button": w["button"],
        "minecraft:glint": w["tier"] >= 2,
        "minecraft:tags": {"tags": [f"{NS}:weapon", f"{NS}:tier_{w['tier']}"]},
    }
    if w["durability"]:
        comps["minecraft:durability"] = {"max_durability": w["durability"]}
        comps["minecraft:repairable"] = {"repair_items": [
            {"items": [w["repair"]], "repair_amount": w["durability"] // 4},
            {"items": [ident],
             "repair_amount": "context.other->query.remaining_durability + 0.12 * context.other->query.max_durability"},
        ]}
    return {
        "format_version": "1.20.50",
        "minecraft:item": {
            "description": {"identifier": ident, "menu_category": {"category": "equipment"}},
            "components": comps,
        },
    }


def torch_json():
    ident = f"{NS}:{TORCH['id']}"
    return {
        "format_version": "1.20.50",
        "minecraft:item": {
            "description": {"identifier": ident, "menu_category": {"category": "equipment"}},
            "components": {
                "minecraft:icon": {"texture": f"{NS}_{TORCH['id']}"},
                "minecraft:display_name": {"value": f"item.{ident}.name"},
                "minecraft:max_stack_size": 1,
                "minecraft:allow_off_hand": True,
                "minecraft:cooldown": {"category": ident, "duration": TORCH["cooldown"]},
                "minecraft:interact_button": TORCH["button"],
                "minecraft:tags": {"tags": [f"{NS}:light_source"]},
            },
        },
    }


def recipe_json(item_id, pattern, key):
    return {
        "format_version": "1.12",
        "minecraft:recipe_shaped": {
            "description": {"identifier": f"{NS}:{item_id}"},
            "tags": ["crafting_table"],
            "pattern": pattern,
            "key": {k: {"item": v} for k, v in key.items()},
            "result": {"item": f"{NS}:{item_id}", "count": 1},
        },
    }


def lang():
    lines = ["## Arcane Arsenal - item names"]
    for w in WEAPONS:
        color = TIER_COLOR[w["tier"]] + ("§l" if w["tier"] == 3 else "")
        for key in (f"item.{NS}:{w['id']}.name", f"item.{NS}:{w['id']}"):
            lines.append(f"{key}={color}{w['name']}")
    for key in (f"item.{NS}:{TORCH['id']}.name", f"item.{NS}:{TORCH['id']}"):
        lines.append(f"{key}=§e{TORCH['name']}")
    return "\n".join(lines) + "\n"


LANGUAGES = [
    "en_US", "en_GB", "de_DE", "es_ES", "es_MX", "fr_FR", "fr_CA", "it_IT", "ja_JP", "ko_KR", "pt_BR", "pt_PT",
    "ru_RU", "zh_CN", "zh_TW", "nl_NL", "bg_BG", "cs_CZ", "da_DK", "el_GR", "fi_FI", "hu_HU", "id_ID", "nb_NO",
    "pl_PL", "sk_SK", "sv_SE", "tr_TR", "uk_UA",
]


FUNCTIONS = {
    "give_all": ["# Gives every Arcane Arsenal item to the player running it"]
    + [f"give @s {NS}:{w['id']}" for w in WEAPONS] + [f"give @s {NS}:{TORCH['id']}",
                                                    "scriptevent arcane:help"],
    "help": ["scriptevent arcane:help"],
    "lights_on": ["scriptevent arcane:config lights on"],
    "lights_off": ["scriptevent arcane:config lights off"],
    "flicker_on": ["scriptevent arcane:config flicker on"],
    "flicker_off": ["scriptevent arcane:config flicker off"],
    "particles_on": ["scriptevent arcane:config particles on"],
    "particles_off": ["scriptevent arcane:config particles off"],
    "hud_on": ["scriptevent arcane:config hud on"],
    "hud_off": ["scriptevent arcane:config hud off"],
}


def main():
    items = {w["id"]: item_json(w) for w in WEAPONS}
    items[TORCH["id"]] = torch_json()
    for item_id, data in items.items():
        write_json(os.path.join(BP, "items", item_id + ".json"), data)
    for w in WEAPONS + [TORCH]:
        pattern, key = w["recipe"]
        write_json(os.path.join(BP, "recipes", w["id"] + ".json"), recipe_json(w["id"], pattern, key))
    for name, lines in FUNCTIONS.items():
        write_text(os.path.join(BP, "functions", "arcane", name + ".mcfunction"), "\n".join(lines) + "\n")

    write_json(os.path.join(RP, "textures", "item_texture.json"), {
        "resource_pack_name": "arcane_arsenal",
        "texture_name": "atlas.items",
        "texture_data": {f"{NS}_{i}": {"textures": f"textures/items/{i}"} for i in items},
    })
    # English names for every game language, so no one ever sees raw "item.arcane:..." keys.
    write_json(os.path.join(RP, "texts", "languages.json"), LANGUAGES)
    for code in LANGUAGES:
        write_text(os.path.join(RP, "texts", code + ".lang"), lang())
    for name, data in all_particles().items():
        write_json(os.path.join(RP, "particles", name + ".json"), data)
    print("packs written:", len(items), "items,", len(WEAPONS) + 1, "recipes,",
          len(all_particles()), "particles,", len(FUNCTIONS), "functions")


if __name__ == "__main__":
    main()
