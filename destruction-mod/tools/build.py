#!/usr/bin/env python3
"""Builds the Destruction Mod add-on.

    python3 tools/build.py

1. writes the item, recipe, function, manifest and texture-atlas JSON files
2. draws the textures (tools/make_textures.py)
3. checks everything (JSON parses, textures exist, every particle/sound the
   scripts use exists in vanilla 1.21.0.26, items match scripts/config.js)
4. zips dist/DestructionMod.mcaddon (+ the two .mcpack files)

Weapon names, colours and cooldowns are read from scripts/config.js so the
inventory names and the menus never drift apart.
"""
import json
import os
import re
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "packs", "DestructionMod_BP")
RP = os.path.join(ROOT, "packs", "DestructionMod_RP")
DIST = os.path.join(ROOT, "dist")
VERSION = [1, 0, 0]
MIN_ENGINE = [1, 20, 80]  # script API 1.10.0 is stable from 1.20.80; tested target 1.21.0.26

UUID = {
    "bp": "4b5a87be-c1ff-4eeb-aa82-8311cd885013",
    "bp_data": "48161426-ec25-42ce-9b5d-95aba24c8cf7",
    "bp_script": "778ef538-fd1c-49eb-a7e5-9b7b1ba52890",
    "rp": "26bf7b7e-da06-4027-bdc5-37f6626226a9",
    "rp_res": "41840f73-21ba-4103-a5de-cae5e227636f",
}

# key: (hand_equipped, glint, shaped recipe pattern, recipe key)
ITEMS = {
    "mega_tnt_wand": (True, True, ["TTT", "TDT", " B "],
                      {"T": "minecraft:tnt", "D": "minecraft:diamond", "B": "minecraft:blaze_rod"}),
    "meteor_staff": (True, True, ["MFM", " B ", " B "],
                     {"M": "minecraft:magma", "F": "minecraft:fire_charge", "B": "minecraft:blaze_rod"}),
    "thunder_staff": (True, True, ["CLC", " I ", " I "],
                      {"C": "minecraft:copper_ingot", "L": "minecraft:lightning_rod", "I": "minecraft:iron_ingot"}),
    "black_hole_orb": (False, True, ["OPO", "PEP", "OPO"],
                       {"O": "minecraft:crying_obsidian", "P": "minecraft:ender_pearl", "E": "minecraft:echo_shard"}),
    "earthquake_hammer": (True, False, ["III", "IAI", " S "],
                          {"I": "minecraft:iron_block", "A": "minecraft:anvil", "S": "minecraft:stick"}),
    "tornado_wand": (True, True, ["WWW", " R ", " R "],
                     {"W": "minecraft:wind_charge", "R": "minecraft:breeze_rod"}),
    "sky_beam_staff": (True, True, ["ECE", " B ", " B "],
                       {"E": "minecraft:end_rod", "C": "minecraft:end_crystal", "B": "minecraft:blaze_rod"}),
    "tnt_rain_wand": (True, True, ["TPT", " B ", " B "],
                      {"T": "minecraft:tnt", "P": "minecraft:phantom_membrane", "B": "minecraft:blaze_rod"}),
    "shockwave_core": (False, True, ["AAA", "ATA", "AAA"],
                       {"A": "minecraft:amethyst_shard", "T": "minecraft:tnt"}),
    "crater_wand": (True, True, ["PEP", " O ", " O "],
                    {"P": "minecraft:ender_pearl", "E": "minecraft:ender_eye", "O": "minecraft:obsidian"}),
    "control_tablet": (False, False, ["IRI", "IGI", "III"],
                       {"I": "minecraft:iron_ingot", "R": "minecraft:redstone", "G": "minecraft:glass_pane"}),
    "target_marker": (True, False, [" R ", " S ", " S "],
                      {"R": "minecraft:redstone_torch", "S": "minecraft:stick"}),
}
TOOLS = {"control_tablet": "§aDestruction Tablet", "target_marker": "§2Target Marker"}


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def read_weapons():
    """[(key, name, colour, cooldown_ticks)] from scripts/config.js."""
    src = open(os.path.join(BP, "scripts", "config.js"), encoding="utf-8").read()
    rows = re.findall(r'\["([a-z_]+)", "([^"]+)", "(§.)", "[^"]*", (\d+)\]', src)
    if len(rows) < 6:
        sys.exit("could not read the weapon list from config.js")
    return [(k, n, c, int(t)) for k, n, c, t in rows]


def item_json(key, name, hand, glint, cooldown_s):
    comps = {
        "minecraft:icon": {"texture": f"destruct_{key}"},
        "minecraft:display_name": {"value": name},
        "minecraft:max_stack_size": 1,
    }
    if hand:
        comps["minecraft:hand_equipped"] = True
    if glint:
        comps["minecraft:glint"] = True
    if cooldown_s:
        comps["minecraft:cooldown"] = {"category": f"destruct_{key}", "duration": cooldown_s}
    return {
        "format_version": "1.20.50",
        "minecraft:item": {
            "description": {"identifier": f"destruct:{key}", "menu_category": {"category": "equipment"}},
            "components": comps,
        },
    }


def recipe_json(key, pattern, keymap):
    first = keymap[pattern[0].strip()[0]] if pattern[0].strip() else next(iter(keymap.values()))
    return {
        "format_version": "1.20.10",
        "minecraft:recipe_shaped": {
            "description": {"identifier": f"destruct:{key}"},
            "tags": ["crafting_table"],
            "pattern": pattern,
            "key": {k: {"item": v} for k, v in keymap.items()},
            "unlock": [{"item": first}],
            "result": {"item": f"destruct:{key}"},
        },
    }


def generate():
    weapons = read_weapons()
    missing = [k for k, *_ in weapons if k not in ITEMS]
    if missing:
        sys.exit(f"no item settings for: {missing}")

    names = {k: (c + n, t / 20) for k, n, c, t in weapons}
    names.update({k: (v, 0) for k, v in TOOLS.items()})
    for key, (hand, glint, pattern, keymap) in ITEMS.items():
        name, cooldown = names[key]
        write_json(os.path.join(BP, "items", f"{key}.json"), item_json(key, name, hand, glint, cooldown))
        write_json(os.path.join(BP, "recipes", f"{key}.json"), recipe_json(key, pattern, keymap))

    order = ["control_tablet", "target_marker"] + [k for k, *_ in weapons]
    fn = os.path.join(BP, "functions", "destruct")
    os.makedirs(fn, exist_ok=True)
    with open(os.path.join(fn, "kit.mcfunction"), "w") as fh:
        fh.write("# Gives every Destruction Mod item. Usage: /function destruct/kit\n")
        fh.writelines(f"give @s destruct:{k}\n" for k in order)
    with open(os.path.join(fn, "stop.mcfunction"), "w") as fh:
        fh.write("# Cancels all running destruction. Usage: /function destruct/stop\nscriptevent destruct:stop\n")
    with open(os.path.join(fn, "menu.mcfunction"), "w") as fh:
        fh.write("# Opens the Destruction Tablet menu. Usage: /function destruct/menu\nscriptevent destruct:menu\n")

    write_json(os.path.join(RP, "textures", "item_texture.json"), {
        "resource_pack_name": "destruction_mod",
        "texture_name": "atlas.items",
        "texture_data": {f"destruct_{k}": {"textures": f"textures/items/destruct/{k}"} for k in ITEMS},
    })

    desc = ("10 destruction weapons + Destruction Tablet. Tap: strike where you aim. "
            "Sneak+tap: choose WHERE it hits and the power. No experiments needed.")
    write_json(os.path.join(BP, "manifest.json"), {
        "format_version": 2,
        "header": {
            "name": "Destruction Mod",
            "description": desc,
            "uuid": UUID["bp"],
            "version": VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [
            {"type": "data", "uuid": UUID["bp_data"], "version": VERSION},
            {"type": "script", "language": "javascript", "uuid": UUID["bp_script"],
             "entry": "scripts/main.js", "version": VERSION},
        ],
        "dependencies": [
            {"uuid": UUID["rp"], "version": VERSION},
            {"module_name": "@minecraft/server", "version": "1.10.0"},
            {"module_name": "@minecraft/server-ui", "version": "1.1.0"},
        ],
    })
    write_json(os.path.join(RP, "manifest.json"), {
        "format_version": 2,
        "header": {
            "name": "Destruction Mod Textures",
            "description": "Item textures and menu icons for the Destruction Mod.",
            "uuid": UUID["rp"],
            "version": VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [{"type": "resources", "uuid": UUID["rp_res"], "version": VERSION}],
    })
    subprocess.run([sys.executable, os.path.join(ROOT, "tools", "make_textures.py")], check=True)
    return weapons


def check(weapons):
    problems = []
    for base in (BP, RP):
        for dirpath, _, files in os.walk(base):
            for f in files:
                if f.endswith(".json"):
                    path = os.path.join(dirpath, f)
                    try:
                        json.load(open(path, encoding="utf-8"))
                    except ValueError as e:
                        problems.append(f"bad JSON {path}: {e}")

    atlas = json.load(open(os.path.join(RP, "textures", "item_texture.json")))["texture_data"]
    for key in ITEMS:
        tex = atlas.get(f"destruct_{key}", {}).get("textures")
        if not tex or not os.path.exists(os.path.join(RP, tex + ".png")):
            problems.append(f"missing texture for {key}")

    scripts = ""
    for f in sorted(os.listdir(os.path.join(BP, "scripts"))):
        scripts += open(os.path.join(BP, "scripts", f), encoding="utf-8").read()
    for icon in set(re.findall(r'"(textures/[a-z_/]+)"', scripts)) | {
            f"textures/items/destruct/{k}" for k, *_ in weapons}:
        if not os.path.exists(os.path.join(RP, icon + ".png")):
            problems.append(f"menu icon missing: {icon}")

    vanilla = json.load(open(os.path.join(ROOT, "tools", "vanilla_ids_1.21.0.26.json")))
    known = set(vanilla["particles"]) | set(vanilla["blocks"]) | set(vanilla["entities"]) | set(vanilla["items"])
    # component and dimension ids used with getComponent()/dim.id
    known |= {"minecraft:cooldown", "minecraft:equippable", "minecraft:inventory",
              "minecraft:overworld", "minecraft:nether", "minecraft:the_end"}
    for mid in sorted(set(re.findall(r'"(minecraft:[a-z0-9_]+)"', scripts))):
        if mid not in known:
            problems.append(f"unknown id {mid} (not a 1.21.0.26 particle/block/entity/item)")
    for eid in sorted(set(re.findall(r'addEffect\("([a-z_]+)"', scripts))):
        if eid not in vanilla["effects"]:
            problems.append(f"unknown effect {eid}")
    for key, (_, _, _, keymap) in ITEMS.items():
        for item in keymap.values():
            if item not in vanilla["items"]:
                problems.append(f"recipe for {key} uses unknown item {item}")
    used_sounds = set(re.findall(r'sound\(\s*[a-zA-Z.]+,\s*"([a-z0-9_.]+)"', scripts))
    used_sounds |= set(re.findall(r'playSound\("([a-z0-9_.]+)"', scripts))
    for sid in sorted(used_sounds):
        if sid not in vanilla["sounds"]:
            problems.append(f"unknown sound {sid}")
    if not used_sounds:
        problems.append("sound check found nothing - regex out of date?")
    return problems, len(used_sounds)


def zip_dir(zf, src, arc_root):
    for dirpath, _, files in sorted(os.walk(src)):
        for f in sorted(files):
            full = os.path.join(dirpath, f)
            rel = os.path.relpath(full, src).replace(os.sep, "/")
            info = zipfile.ZipInfo(f"{arc_root}/{rel}" if arc_root else rel, date_time=(2024, 5, 15, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            with open(full, "rb") as fh:
                zf.writestr(info, fh.read())


def package():
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, "DestructionMod.mcaddon")
    with zipfile.ZipFile(out, "w") as zf:
        zip_dir(zf, BP, "DestructionMod_BP")
        zip_dir(zf, RP, "DestructionMod_RP")
    for name, src in (("DestructionMod_BP.mcpack", BP), ("DestructionMod_RP.mcpack", RP)):
        with zipfile.ZipFile(os.path.join(DIST, name), "w") as zf:
            zip_dir(zf, src, "")
    return out


def main():
    weapons = generate()
    problems, n_sounds = check(weapons)
    if problems:
        print("\n".join(problems))
        sys.exit(1)
    out = package()
    print(f"checks ok ({len(ITEMS)} items, {len(weapons)} weapons, {n_sounds} sounds verified)")
    print(f"built {os.path.relpath(out, ROOT)} ({os.path.getsize(out) // 1024} KB)")


if __name__ == "__main__":
    main()
