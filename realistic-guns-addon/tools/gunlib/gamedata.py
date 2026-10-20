"""Writes scripts/gun_data.js (gameplay constants) for the behavior pack."""
import json

from .specs import NS, GUNS, AMMO, fire_interval_ticks

AMMO_BY_ID = {a["id"]: a for a in AMMO}

# Blocks bullets never break (exact ids, without the "minecraft:" prefix).
IMMUNE_BLOCKS = [
    "air", "cave_air", "void_air", "allow", "deny", "border_block", "barrier", "bedrock", "jigsaw",
    "structure_block", "structure_void", "command_block", "chain_command_block",
    "repeating_command_block", "fire", "soul_fire", "water", "flowing_water", "lava", "flowing_lava",
    "portal", "end_portal", "end_portal_frame", "end_gateway", "obsidian", "crying_obsidian",
    "reinforced_deepslate", "respawn_anchor", "ancient_debris", "netherite_block", "beacon",
    "conduit", "enchanting_table", "mob_spawner", "trial_spawner", "vault", "creaking_heart",
    "chest", "trapped_chest", "ender_chest", "barrel", "hopper", "dropper", "dispenser", "crafter",
    "furnace", "lit_furnace", "blast_furnace", "lit_blast_furnace", "smoker", "lit_smoker",
    "brewing_stand", "lectern", "jukebox", "chiseled_bookshelf", "decorated_pot", "dragon_egg",
    "anvil", "chipped_anvil", "damaged_anvil", "bell", "lodestone",
]

# (substring, hits-worth of damage) - first match wins, so specific names come first.
# Rough guide: fragile 0.5 (any bullet), soft 3-6, wood 12, stone 24-36, metal 60+.
BLOCK_TOUGHNESS = [
    ("shulker_box", float("inf")), ("light_block", float("inf")), ("copper_chest", float("inf")),
    ("glass", 0.5), ("leaves", 0.5), ("ice", 0.6), ("torch", 0.5), ("lantern", 0.5),
    ("candle", 0.5), ("cake", 0.5), ("web", 0.5), ("vine", 0.5), ("sapling", 0.5),
    ("flower", 0.5), ("tallgrass", 0.5), ("short_grass", 0.5), ("tall_grass", 0.5), ("fern", 0.5),
    ("seagrass", 0.5), ("kelp", 0.5), ("reeds", 0.5), ("sugar_cane", 0.5), ("wheat", 0.5),
    ("carrots", 0.5), ("potatoes", 0.5), ("beetroot", 0.5), ("sweet_berry", 0.5),
    ("melon_stem", 0.5), ("pumpkin_stem", 0.5), ("crimson_stem", 14), ("warped_stem", 14),
    ("dandelion", 0.5), ("poppy", 0.5), ("tulip", 0.5), ("orchid", 0.5), ("allium", 0.5),
    ("bluet", 0.5), ("daisy", 0.5), ("cornflower", 0.5), ("lily", 0.5), ("rose", 0.5),
    ("lilac", 0.5), ("peony", 0.5), ("sunflower", 0.5), ("pitcher", 0.5), ("eyeblossom", 0.5),
    ("bush", 0.5), ("dripleaf", 0.5), ("hanging_roots", 0.5), ("cocoa", 0.5), ("sprouts", 0.5),
    ("crimson_roots", 0.5), ("warped_roots", 0.5), ("fungus", 0.5), ("frog_spawn", 0.5),
    ("turtle_egg", 0.5), ("scaffolding", 0.5), ("ladder", 0.5), ("rail", 1.5), ("button", 0.5),
    ("pressure_plate", 1.5), ("lever", 0.5), ("tripwire", 0.5), ("redstone_wire", 0.5),
    ("repeater", 0.5), ("comparator", 0.5), ("skull", 1.0), ("banner", 0.5), ("carpet", 0.5),
    ("snow_layer", 0.5), ("pointed_dripstone", 1.0), ("amethyst_cluster", 1.0), ("_bud", 0.5),
    ("sea_pickle", 0.5), ("glow_lichen", 0.5), ("moss_carpet", 0.5), ("pink_petals", 0.5),
    ("spore_blossom", 0.5), ("chorus", 2.0), ("end_rod", 0.5), ("lightning_rod", 2.0),
    ("bamboo_planks", 12), ("bamboo_block", 12), ("bamboo_mosaic", 12), ("bamboo", 0.5),
    ("mud_bricks", 18), ("packed_mud", 10), ("dirt_with_roots", 3), ("rooted_dirt", 3),
    ("sandstone", 24), ("concrete_powder", 4), ("suspicious", 3), ("soul_sand", 3),
    ("soul_soil", 3), ("sand", 3), ("gravel", 3), ("clay", 4), ("dirt", 3), ("grass", 3),
    ("mycelium", 3), ("podzol", 3), ("farmland", 3), ("mud", 3), ("netherrack", 4),
    ("glowstone", 2), ("sea_lantern", 2), ("shroomlight", 2), ("wool", 5), ("bed", 2),
    ("target", 3), ("hay_block", 4), ("sponge", 4), ("slime", 4), ("honey_block", 4),
    ("snow", 2), ("melon", 4), ("pumpkin", 4), ("dried_kelp", 4), ("moss_block", 2),
    ("wart_block", 5), ("sculk", 3), ("cactus", 3), ("mushroom", 6),
    ("deepslate_", 36), ("deepslate", 32), ("_ore", 30), ("coal_block", 30),
    ("iron", 70), ("gold_block", 60), ("diamond_block", 90), ("emerald_block", 90),
    ("copper", 40), ("chain", 40), ("cauldron", 40), ("grindstone", 40), ("redstone_lamp", 4),
    ("lapis_block", 30), ("redstone_block", 30), ("obsidian", float("inf")),
    ("planks", 12), ("log", 14), ("wood", 14), ("hyphae", 14),
    ("oak_", 12), ("spruce_", 12), ("birch_", 12), ("jungle_", 12), ("acacia_", 12),
    ("mangrove_", 12), ("cherry_", 12), ("crimson_", 12), ("warped_", 12), ("fence", 12), ("door", 12),
    ("trapdoor", 10), ("sign", 8), ("bookshelf", 10), ("crafting_table", 12),
    ("cartography_table", 12), ("fletching_table", 12), ("smithing_table", 20), ("loom", 12),
    ("composter", 10), ("beehive", 10), ("bee_nest", 6), ("noteblock", 12),
    ("terracotta", 14), ("hardened_clay", 14), ("calcite", 10), ("dripstone_block", 16),
    ("amethyst", 16), ("bone_block", 18), ("quartz", 14), ("prismarine", 18), ("tuff", 20),
    ("basalt", 16), ("end_stone", 26), ("purpur", 20), ("magma", 8), ("blackstone", 24),
    ("concrete", 20), ("brick", 24), ("cobble", 24), ("andesite", 22), ("diorite", 22),
    ("granite", 22), ("stone", 22), ("observer", 22), ("piston", 18),
]
BLOCK_TOUGHNESS_DEFAULT = 20

SOUND_VOLUME = {"Pistol": 2.5, "Submachine Gun": 2.5, "Assault Rifle": 3.5, "Light Machine Gun": 3.5,
                "Shotgun": 3.5, "Sniper Rifle": 5.0, "Heavy Sniper": 6.0}
FLASH = {"Pistol": 0.09, "Submachine Gun": 0.1, "Assault Rifle": 0.13, "Light Machine Gun": 0.14,
         "Shotgun": 0.17, "Sniper Rifle": 0.16, "Heavy Sniper": 0.22}
BLOCK_DAMAGE_MULT = {"awp": 0.6, "spas12": 0.5}


def _vec(a):
    return {"x": round(float(a[0]), 4), "y": round(float(a[1]), 4), "z": round(float(a[2]), 4)}


def gun_data_js(built):
    guns = {}
    for bg in built:
        s = bg.spec
        ammo = AMMO_BY_ID[s["ammo"]]
        entry = {
            "id": s["id"],
            "name": s["name"],
            "kind": s["kind"],
            "mag": f"{NS}:{s['mag']}",
            "magName": s.get("mag_name") or ammo["name"],
            "ammoName": ammo["name"] if s.get("mag_name") else "paper, gunpowder and copper",
            "capacity": s["capacity"],
            "damage": s["damage"],
            "pellets": s["pellets"],
            "headshot": s["headshot"],
            "interval": round(fire_interval_ticks(s), 4),
            "auto": s["auto"],
            "spread": s["spread"],
            "range": s["range"],
            "velocity": s["velocity"],
            "recoilPitch": s["recoil"][0],
            "recoilYaw": s["recoil"][1],
            "shake": s["shake"],
            "reloadTicks": s["reload_ticks"],
            "shellReload": bool(s.get("shell_reload")),
            "kickTicks": s["kick"][2],
            "cycleTicks": s.get("cycle_ticks", 0),
            "zoomFov": s.get("zoom_fov", 0),
            "sound": f"{NS}.{s['id']}.fire",
            "volume": SOUND_VOLUME[s["kind"]],
            "flash": FLASH[s["kind"]],
            "blockDamage": BLOCK_DAMAGE_MULT.get(s["id"], 1.0),
            "muzzleFP": _vec(bg.muzzle_fp),
            "muzzleTP": _vec(bg.muzzle_tp),
            "portFP": _vec(bg.port_fp),
        }
        if "spread_scoped" in s:
            entry["spreadScoped"] = s["spread_scoped"]
        guns[f"{NS}:{s['id']}"] = entry
    tough = [[p, (1e9 if v == float("inf") else v)] for p, v in BLOCK_TOUGHNESS]
    js = [
        "// Generated by tools/build.py from tools/gunlib/specs.py - do not edit by hand.",
        f"export const NS = {json.dumps(NS)};",
        "",
        "/** Gun stats keyed by item id. muzzleFP/portFP are first-person offsets from the eye",
        " *  (blocks: x right, y up, z forward); muzzleTP is relative to the player's feet. */",
        "export const GUNS = " + json.dumps(guns, indent=2) + ";",
        "",
        "/** Blocks that bullets never break (ids without the minecraft: prefix). */",
        "export const IMMUNE_BLOCKS = " + json.dumps(IMMUNE_BLOCKS) + ";",
        "",
        "/** [substring, damage needed to break] - first match wins. */",
        "export const BLOCK_TOUGHNESS = " + json.dumps(tough) + ";",
        f"export const BLOCK_TOUGHNESS_DEFAULT = {BLOCK_TOUGHNESS_DEFAULT};",
        "",
    ]
    return "\n".join(js)
