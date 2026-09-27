"""Generate, validate and package Ancient Ruins Expedition.

    python3 tools/build.py                 # generate + validate + zip
    python3 tools/build.py --ref DIR       # also check vanilla block states /
                                           # sounds / items against reference data
Reference data (optional) in DIR:
    blockStates.json            PrismarineJS minecraft-data bedrock/1.21.0
    sound_definitions.json      Mojang bedrock-samples resource_pack/sounds
    mojang-items.json           Mojang bedrock-samples metadata/vanilladata_modules
"""
import argparse
import glob
import json
import os
import re
import struct
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import packgen  # noqa: E402
import structures  # noqa: E402
import textures  # noqa: E402
from nbt import loads  # noqa: E402

BP = os.path.join(ROOT, "packs", "AncientRuins_BP")
RP = os.path.join(ROOT, "packs", "AncientRuins_RP")
DIST = os.path.join(ROOT, "dist")
NS = packgen.NS

errors = []


def err(msg):
    errors.append(msg)


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    return struct.unpack(">II", head[16:24])


def generate():
    packgen.build(BP, RP)
    textures.build_all(BP, RP)
    structures.build_all(os.path.join(BP, "structures", NS))


def validate(ref):
    # 1. every JSON parses (strict)
    for path in glob.glob(os.path.join(ROOT, "packs", "**", "*.json"), recursive=True):
        try:
            load_json(path)
        except Exception as e:  # noqa: BLE001
            err(f"JSON parse {os.path.relpath(path, ROOT)}: {e}")

    # 2. manifests
    bpm, rpm = load_json(os.path.join(BP, "manifest.json")), load_json(os.path.join(RP, "manifest.json"))
    uuids = [bpm["header"]["uuid"], rpm["header"]["uuid"]] + [m["uuid"] for m in bpm["modules"] + rpm["modules"]]
    if len(set(uuids)) != len(uuids):
        err("manifest UUIDs are not unique")
    if not any(d.get("uuid") == rpm["header"]["uuid"] for d in bpm["dependencies"]):
        err("BP does not depend on RP")
    if not any(d.get("uuid") == bpm["header"]["uuid"] for d in rpm["dependencies"]):
        err("RP does not depend on BP")
    entry = next(m["entry"] for m in bpm["modules"] if m["type"] == "script")
    if not os.path.exists(os.path.join(BP, entry)):
        err(f"script entry missing: {entry}")

    # 3. blocks -> terrain atlas -> png
    terrain = load_json(os.path.join(RP, "textures", "terrain_texture.json"))["texture_data"]
    block_ids = set()
    for path in glob.glob(os.path.join(BP, "blocks", "*.json")):
        b = load_json(path)["minecraft:block"]
        ident = b["description"]["identifier"]
        block_ids.add(ident)
        if os.path.splitext(os.path.basename(path))[0] != ident.split(":")[1]:
            err(f"block file name mismatch {path}")
        for face, mat in b["components"]["minecraft:material_instances"].items():
            tex = mat["texture"]
            if tex not in terrain:
                err(f"{ident}: texture key {tex} missing from terrain_texture.json")
            else:
                png = os.path.join(RP, terrain[tex]["textures"] + ".png")
                if not os.path.exists(png):
                    err(f"{ident}: missing {png}")
                elif png_size(png) != (16, 16):
                    err(f"{png} is not 16x16")
    blocks_json = load_json(os.path.join(RP, "blocks.json"))
    for ident in block_ids:
        if ident not in blocks_json:
            err(f"blocks.json lacks {ident}")

    # 4. items -> item atlas -> png
    item_atlas = load_json(os.path.join(RP, "textures", "item_texture.json"))["texture_data"]
    item_ids = set()
    for path in glob.glob(os.path.join(BP, "items", "*.json")):
        it = load_json(path)["minecraft:item"]
        ident = it["description"]["identifier"]
        item_ids.add(ident)
        key = it["components"]["minecraft:icon"]["texture"]
        if key not in item_atlas:
            err(f"{ident}: icon {key} missing from item_texture.json")
        else:
            png = os.path.join(RP, item_atlas[key]["textures"] + ".png")
            if not os.path.exists(png) or png_size(png) != (16, 16):
                err(f"{ident}: icon png missing or not 16x16")

    # 5. entities (behaviour) <-> client entities, models, animations
    geo_ids = set()
    for path in glob.glob(os.path.join(RP, "models", "entity", "*.json")):
        for g in load_json(path)["minecraft:geometry"]:
            geo_ids.add(g["description"]["identifier"])
    anim_ids = set()
    for path in glob.glob(os.path.join(RP, "animations", "*.json")):
        anim_ids.update(load_json(path)["animations"].keys())
    rc_ids = set()
    for path in glob.glob(os.path.join(RP, "render_controllers", "*.json")):
        rc_ids.update(load_json(path)["render_controllers"].keys())
    entity_events = {}
    bp_entities = set()
    for path in glob.glob(os.path.join(BP, "entities", "*.json")):
        e = load_json(path)["minecraft:entity"]
        ident = e["description"]["identifier"]
        bp_entities.add(ident)
        entity_events[ident] = set(e.get("events", {}).keys())
        comps = dict(e.get("components", {}))
        for grp in e.get("component_groups", {}).values():
            comps.update(grp)
        loot = comps.get("minecraft:loot", {}).get("table")
        if loot and not os.path.exists(os.path.join(BP, loot)):
            err(f"{ident}: loot table {loot} missing")
        for ev_name, ev in e.get("events", {}).items():
            for action in ("add", "remove"):
                for grp in ev.get(action, {}).get("component_groups", []):
                    if grp not in e.get("component_groups", {}):
                        err(f"{ident}: event {ev_name} references unknown group {grp}")
        for grp in e.get("component_groups", {}).values():
            timer = grp.get("minecraft:timer")
            if timer and timer["time_down_event"]["event"] not in entity_events[ident]:
                err(f"{ident}: timer event missing")
        timer = comps.get("minecraft:timer")
        if timer and timer["time_down_event"]["event"] not in entity_events[ident]:
            err(f"{ident}: timer event {timer['time_down_event']['event']} missing")
        if "minecraft:health" in comps and comps["minecraft:health"]["value"] > 40 and "minecraft:boss" not in comps:
            err(f"{ident}: guardian above 40 HP")
        if "minecraft:boss" in comps and comps["minecraft:health"]["value"] != 150:
            err(f"{ident}: boss must have 150 HP")
    for path in glob.glob(os.path.join(RP, "entity", "*.json")):
        c = load_json(path)["minecraft:client_entity"]["description"]
        ident = c["identifier"]
        if ident not in bp_entities:
            err(f"client entity {ident} has no behaviour entity")
        for tex in c["textures"].values():
            png = os.path.join(RP, tex + ".png")
            if not os.path.exists(png):
                err(f"{ident}: texture {tex} missing")
            else:
                w, h = png_size(png)
                if w > 64 or h > 64:
                    err(f"{ident}: texture larger than 64x64")
        for geo in c["geometry"].values():
            if geo not in geo_ids:
                err(f"{ident}: geometry {geo} missing")
        for a in c.get("animations", {}).values():
            if a not in anim_ids:
                err(f"{ident}: animation {a} missing")
        for name in c.get("scripts", {}).get("animate", []):
            key = name if isinstance(name, str) else next(iter(name))
            if key not in c.get("animations", {}):
                err(f"{ident}: animate refers to unknown {key}")
        for rc in c["render_controllers"]:
            if rc not in rc_ids:
                err(f"{ident}: render controller {rc} missing")

    # 6. spawn rules, loot tables, recipes
    for path in glob.glob(os.path.join(BP, "spawn_rules", "*.json")):
        s = load_json(path)["minecraft:spawn_rules"]
        if s["description"]["identifier"] not in bp_entities:
            err(f"spawn rule for unknown entity {s['description']['identifier']}")
        for cond in s["conditions"]:
            for b in cond.get("minecraft:spawns_on_block_filter", []):
                if b.startswith(NS) and b not in block_ids:
                    err(f"spawn rule block {b} unknown")
    vanilla_items = None
    if ref and os.path.exists(os.path.join(ref, "mojang-items.json")):
        vanilla_items = {i["name"] for i in load_json(os.path.join(ref, "mojang-items.json"))["data_items"]}
    for path in glob.glob(os.path.join(BP, "loot_tables", "**", "*.json"), recursive=True):
        for pool in load_json(path)["pools"]:
            for entry in pool["entries"]:
                name = entry.get("name")
                if not name:
                    continue
                if name.startswith(NS):
                    if name not in item_ids:
                        err(f"loot {path}: unknown item {name}")
                elif vanilla_items is not None and name not in vanilla_items:
                    err(f"loot {path}: vanilla item {name} does not exist in 1.21.0")
    for path in glob.glob(os.path.join(BP, "recipes", "*.json")):
        text = open(path, encoding="utf-8").read()
        for name in re.findall(r'"item":\s*"([^"]+)"', text):
            if name.startswith(NS) and name not in item_ids:
                err(f"recipe {path}: unknown item {name}")
            elif not name.startswith(NS) and vanilla_items is not None and name not in vanilla_items:
                err(f"recipe {path}: vanilla item {name} missing")

    # 7. world generation chain: rule -> feature -> structure file
    features = {}
    for path in glob.glob(os.path.join(BP, "features", "*.json")):
        f = load_json(path)["minecraft:structure_template_feature"]
        ident = f["description"]["identifier"]
        features[ident] = f
        if os.path.splitext(os.path.basename(path))[0] != ident.split(":")[1]:
            err(f"feature file name must match identifier: {path}")
        ns, name = f["structure_name"].split(":")
        if not os.path.exists(os.path.join(BP, "structures", ns, name + ".mcstructure")):
            err(f"{ident}: structure {f['structure_name']} missing")
    for path in glob.glob(os.path.join(BP, "feature_rules", "*.json")):
        r = load_json(path)["minecraft:feature_rules"]
        ident = r["description"]["identifier"]
        if os.path.splitext(os.path.basename(path))[0] != ident.split(":")[1]:
            err(f"feature rule file name must match identifier: {path}")
        if r["description"]["places_feature"] not in features:
            err(f"{ident}: feature {r['description']['places_feature']} missing")

    # 8. structures
    valid_states = None
    if ref and os.path.exists(os.path.join(ref, "blockStates.json")):
        valid_states = set()
        for e in load_json(os.path.join(ref, "blockStates.json")):
            st = tuple(sorted((k, (v["type"], v["value"])) for k, v in e["states"].items()))
            valid_states.add(("minecraft:" + e["name"], st))
    be_block = {"Chest": "minecraft:chest", "Dispenser": "minecraft:dispenser", "CommandBlock": "minecraft:command_block"}
    for path in glob.glob(os.path.join(BP, "structures", "**", "*.mcstructure"), recursive=True):
        root = loads(open(path, "rb").read())
        sx, sy, sz = [int(v) for v in root["size"]]
        if max(sx, sy, sz) >= 32:
            err(f"{path}: structure must stay under 32 blocks per side")
        st = root["structure"]
        pal = st["palette"]["default"]["block_palette"]
        layers = st["block_indices"]
        for layer in layers:
            if len(layer) != sx * sy * sz or any(i < -1 or i >= len(pal) for i in layer):
                err(f"{path}: bad block index layer")
        for p in pal:
            name = str(p["name"])
            if name.startswith(NS):
                if name not in block_ids:
                    err(f"{path}: unknown custom block {name}")
                continue
            if valid_states is not None:
                def typed(v):
                    t = type(v).__name__
                    if t == "Byte":
                        return ("byte", bool(v))
                    if t == "Int":
                        return ("int", int(v))
                    return ("string", str(v))
                state = tuple(sorted((k, typed(v)) for k, v in p["states"].items()))
                if (name, state) not in valid_states:
                    err(f"{path}: invalid 1.21.0 block state {name} {dict(state)}")
        for idx, data in st["palette"]["default"]["block_position_data"].items():
            be = data["block_entity_data"]
            actual = str(pal[layers[0][int(idx)]]["name"])
            if be_block.get(str(be["id"])) != actual:
                err(f"{path}: block entity {be['id']} sits on {actual}")
            loot = be.get("LootTable")
            if loot and not os.path.exists(os.path.join(BP, str(loot))):
                err(f"{path}: chest loot table {loot} missing")
        for ent in st["entities"]:
            if str(ent["identifier"]) not in bp_entities:
                err(f"{path}: unknown entity {ent['identifier']}")

    # 9. lang keys
    lang = open(os.path.join(RP, "texts", "en_US.lang"), encoding="utf-8").read()
    for ident in block_ids:
        if f"tile.{ident}.name=" not in lang:
            err(f"lang missing tile.{ident}.name")
    for ident in item_ids:
        if f"item.{ident}.name=" not in lang:
            err(f"lang missing item.{ident}.name")
    for ident in bp_entities:
        if f"entity.{ident}.name=" not in lang:
            err(f"lang missing entity.{ident}.name")

    # 10. scripts reference only things that exist
    particle_ids = {load_json(p)["particle_effect"]["description"]["identifier"]
                    for p in glob.glob(os.path.join(RP, "particles", "*.json"))}
    known = block_ids | item_ids | bp_entities | particle_ids
    events = set().union(*entity_events.values())
    script_text = ""
    for path in glob.glob(os.path.join(BP, "scripts", "*.js")):
        script_text += open(path, encoding="utf-8").read()
    for ident in sorted(set(re.findall(r'"(ancient_ruins:[a-z0-9_]+)"', script_text))):
        if ident in known or ident in events:
            continue
        if re.match(r"ancient_ruins:(track|welcomed|ruin|enraged|ruins_|ruin_shards|list|reset)$", ident):
            continue  # dynamic property / script event ids
        err(f"scripts reference unknown id {ident}")
    for ev in ("ancient_ruins:special_attack", "ancient_ruins:cast_done", "ancient_ruins:enrage"):
        for boss in ("ancient_ruins:jade_idol", "ancient_ruins:sand_pharaoh", "ancient_ruins:abyssal_admiral"):
            if ev not in entity_events.get(boss, set()):
                err(f"{boss} lacks event {ev}")

    # 11. sounds (sounds.json + scripts) exist in vanilla
    if ref and os.path.exists(os.path.join(ref, "sound_definitions.json")):
        raw = open(os.path.join(ref, "sound_definitions.json"), encoding="utf-8").read()
        defs = set(json.loads(re.sub(r"//[^\n]*", "", raw))["sound_definitions"].keys())
        used = set()
        for m in re.finditer(r"\b(playNear|playSound)\(", script_text):
            depth, i = 1, m.end()
            while depth and i < len(script_text):
                depth += {"(": 1, ")": -1}.get(script_text[i], 0)
                i += 1
            used |= set(re.findall(r'"([a-z0-9_]+\.[a-z0-9_.]+)"', script_text[m.end():i]))
        sounds = load_json(os.path.join(RP, "sounds.json"))
        for ent in sounds["entity_sounds"]["entities"].values():
            for v in ent["events"].values():
                used.add(v if isinstance(v, str) else v["sound"])
        for s in sorted(used):
            if s not in defs:
                err(f"sound '{s}' is not a vanilla sound event")
    return errors


def package():
    os.makedirs(DIST, exist_ok=True)
    outputs = {
        "Ancient_Ruins_Expedition.mcaddon": [("AncientRuins_BP", BP), ("AncientRuins_RP", RP)],
        "Ancient_Ruins_Expedition_BP.mcpack": [("", BP)],
        "Ancient_Ruins_Expedition_RP.mcpack": [("", RP)],
    }
    for name, parts in outputs.items():
        path = os.path.join(DIST, name)
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for prefix, src in parts:
                for dirpath, _, files in sorted(os.walk(src)):
                    for fn in sorted(files):
                        full = os.path.join(dirpath, fn)
                        rel = os.path.relpath(full, src).replace(os.sep, "/")
                        arc = f"{prefix}/{rel}" if prefix else rel
                        info = zipfile.ZipInfo(arc, date_time=(2026, 1, 1, 0, 0, 0))
                        info.compress_type = zipfile.ZIP_DEFLATED
                        info.external_attr = 0o644 << 16
                        with open(full, "rb") as f:
                            z.writestr(info, f.read())
        print(f"packaged {os.path.relpath(path, ROOT)} ({os.path.getsize(path) // 1024} KB)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", help="directory with vanilla reference data")
    ap.add_argument("--no-generate", action="store_true")
    args = ap.parse_args()
    if not args.no_generate:
        generate()
    problems = validate(args.ref)
    if problems:
        print(f"{len(problems)} validation problem(s):")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print("validation passed" + (" (with vanilla reference data)" if args.ref else ""))
    package()


if __name__ == "__main__":
    main()
