"""Validates both packs and zips them into dist/UrbanLegendsHorror.mcaddon.

Usage:  python3 tools/build.py
"""
import glob
import json
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "UrbanLegends_BP")
RP = os.path.join(ROOT, "UrbanLegends_RP")
OUT = os.path.join(ROOT, "dist", "UrbanLegendsHorror.mcaddon")
errors = []


def load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:  # noqa: BLE001
        errors.append(f"{os.path.relpath(path, ROOT)}: invalid JSON ({e})")
        return {}


def check_json_and_refs():
    for path in glob.glob(os.path.join(ROOT, "UrbanLegends_*", "**", "*.json"), recursive=True):
        load(path)

    geos = {}
    for path in glob.glob(os.path.join(RP, "models", "entity", "*.json")):
        for geo in load(path).get("minecraft:geometry", []):
            desc = geo["description"]
            geos[desc["identifier"]] = geo
            tw, th = desc["texture_width"], desc["texture_height"]
            for bone in geo["bones"]:
                for c in bone.get("cubes", []):
                    w, h, d = c["size"]
                    u, v = c["uv"]
                    if u + 2 * (w + d) > tw or v + d + h > th:
                        errors.append(f"{desc['identifier']}: cube in bone {bone['name']} has UV outside the texture")
            names = {b["name"] for b in geo["bones"]}
            for bone in geo["bones"]:
                if bone.get("parent") and bone["parent"] not in names:
                    errors.append(f"{desc['identifier']}: bone {bone['name']} has unknown parent")

    anims = {}
    for path in glob.glob(os.path.join(RP, "animations", "*.json")):
        anims.update(load(path).get("animations", {}))

    items_atlas = load(os.path.join(RP, "textures", "item_texture.json")).get("texture_data", {})
    for key, entry in items_atlas.items():
        if not os.path.isfile(os.path.join(RP, entry["textures"] + ".png")):
            errors.append(f"item_texture.json: missing texture for {key}")

    client_ids = set()
    for path in glob.glob(os.path.join(RP, "entity", "*.json")):
        desc = load(path)["minecraft:client_entity"]["description"]
        client_ids.add(desc["identifier"])
        for geo_id in desc["geometry"].values():
            if geo_id not in geos:
                errors.append(f"{desc['identifier']}: unknown geometry {geo_id}")
        for tex in desc["textures"].values():
            if not os.path.isfile(os.path.join(RP, tex + ".png")):
                errors.append(f"{desc['identifier']}: missing texture {tex}.png")
        for anim_id in desc["animations"].values():
            if anim_id not in anims:
                errors.append(f"{desc['identifier']}: unknown animation {anim_id}")
                continue
            bones = {b["name"] for g in geos.values() for b in g["bones"]}
            for bone in anims[anim_id].get("bones", {}):
                if bone not in bones:
                    errors.append(f"{anim_id}: animates unknown bone {bone}")

    for path in glob.glob(os.path.join(BP, "entities", "*.json")):
        ent = load(path)["minecraft:entity"]
        ident = ent["description"]["identifier"]
        if ident not in client_ids:
            errors.append(f"{ident}: no client entity in the resource pack")
        groups = set(ent.get("component_groups", {}))
        for name, event in ent.get("events", {}).items():
            for op in ("add", "remove"):
                for g in event.get(op, {}).get("component_groups", []):
                    if g not in groups:
                        errors.append(f"{ident}: event {name} uses unknown group {g}")
        loot = ent["components"].get("minecraft:loot", {}).get("table")
        if loot and not os.path.isfile(os.path.join(BP, loot)):
            errors.append(f"{ident}: missing loot table {loot}")

    for path in glob.glob(os.path.join(BP, "items", "*.json")):
        item = load(path)["minecraft:item"]
        icon = item["components"]["minecraft:icon"]
        if icon not in items_atlas:
            errors.append(f"{item['description']['identifier']}: icon {icon} not in item_texture.json")

    scripts = os.path.join(BP, "scripts")
    for path in glob.glob(os.path.join(scripts, "*.js")):
        with open(path, encoding="utf-8") as f:
            for mod in re.findall(r'from "(\./[^"]+)"', f.read()):
                if not os.path.isfile(os.path.join(scripts, mod)):
                    errors.append(f"{os.path.basename(path)}: import {mod} not found")

    bp_manifest = load(os.path.join(BP, "manifest.json"))
    rp_manifest = load(os.path.join(RP, "manifest.json"))
    dep_uuids = {d.get("uuid") for d in bp_manifest.get("dependencies", [])}
    if rp_manifest["header"]["uuid"] not in dep_uuids:
        errors.append("BP manifest does not depend on the RP")
    entry = next(m["entry"] for m in bp_manifest["modules"] if m["type"] == "script")
    if not os.path.isfile(os.path.join(BP, entry)):
        errors.append(f"script entry {entry} missing")


def build():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for pack in (BP, RP):
            for folder, _, files in os.walk(pack):
                for name in sorted(files):
                    full = os.path.join(folder, name)
                    z.write(full, os.path.relpath(full, ROOT))
    print(f"built {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    check_json_and_refs()
    if errors:
        print("\n".join("ERROR: " + e for e in errors))
        sys.exit(1)
    print("validation passed")
    build()
