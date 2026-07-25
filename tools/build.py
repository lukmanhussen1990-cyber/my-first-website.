#!/usr/bin/env python3
"""Validate the packs and bundle them into dist/OnePunchMan.mcaddon.

Run from the repo root:  python3 tools/build.py
"""

import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKS = ["OPM_BP", "OPM_RP"]
OUT = os.path.join(ROOT, "dist", "OnePunchMan.mcaddon")


def validate():
    errors = []
    json_files = []
    for pack in PACKS:
        pack_dir = os.path.join(ROOT, pack)
        if not os.path.isfile(os.path.join(pack_dir, "manifest.json")):
            errors.append(f"{pack}: missing manifest.json")
        if not os.path.isfile(os.path.join(pack_dir, "pack_icon.png")):
            errors.append(f"{pack}: missing pack_icon.png")
        for dirpath, _, names in os.walk(pack_dir):
            for name in names:
                if name.endswith(".json"):
                    json_files.append(os.path.join(dirpath, name))

    uuids = {}
    for path in json_files:
        rel = os.path.relpath(path, ROOT)
        try:
            data = json.loads(open(path, encoding="utf-8").read())
        except ValueError as exc:
            errors.append(f"{rel}: invalid JSON - {exc}")
            continue
        if os.path.basename(path) == "manifest.json":
            ids = [data["header"]["uuid"]] + [m["uuid"] for m in data["modules"]]
            for uid in ids:
                if uid in uuids:
                    errors.append(f"{rel}: duplicate UUID {uid} (also in {uuids[uid]})")
                uuids[uid] = rel

    # The behavior pack's referenced projectile entities must exist.
    entity_dir = os.path.join(ROOT, "OPM_BP", "entities")
    defined = set()
    for name in os.listdir(entity_dir):
        data = json.loads(open(os.path.join(entity_dir, name), encoding="utf-8").read())
        defined.add(data["minecraft:entity"]["description"]["identifier"])

    item_dir = os.path.join(ROOT, "OPM_BP", "items")
    for name in os.listdir(item_dir):
        data = json.loads(open(os.path.join(item_dir, name), encoding="utf-8").read())
        proj = data["minecraft:item"]["components"].get("minecraft:projectile", {})
        target = proj.get("projectile_entity")
        if target and target not in defined:
            errors.append(f"items/{name}: projectile_entity {target} is not defined")

    # Every custom entity needs a client-side definition or it renders as an error box.
    client_dir = os.path.join(ROOT, "OPM_RP", "entity")
    client_ids = set()
    for name in os.listdir(client_dir):
        data = json.loads(open(os.path.join(client_dir, name), encoding="utf-8").read())
        client_ids.add(data["minecraft:client_entity"]["description"]["identifier"])
    for ident in sorted(defined - client_ids):
        errors.append(f"OPM_RP/entity: no client entity definition for {ident}")

    # Item icons must resolve through item_texture.json to a real PNG.
    atlas = json.loads(
        open(os.path.join(ROOT, "OPM_RP", "textures", "item_texture.json"), encoding="utf-8").read()
    )["texture_data"]
    for name in os.listdir(item_dir):
        data = json.loads(open(os.path.join(item_dir, name), encoding="utf-8").read())
        icon = data["minecraft:item"]["components"].get("minecraft:icon")
        key = icon if isinstance(icon, str) else (icon or {}).get("texture")
        if key not in atlas:
            errors.append(f"items/{name}: icon '{key}' missing from item_texture.json")
            continue
        png = os.path.join(ROOT, "OPM_RP", atlas[key]["textures"] + ".png")
        if not os.path.isfile(png):
            errors.append(f"items/{name}: texture file {os.path.relpath(png, ROOT)} not found")

    return errors, len(json_files)


def bundle():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in PACKS:
            for dirpath, _, names in os.walk(os.path.join(ROOT, pack)):
                for name in sorted(names):
                    full = os.path.join(dirpath, name)
                    zf.write(full, os.path.relpath(full, ROOT))
    return OUT


def main():
    errors, count = validate()
    if errors:
        print("FAILED validation:")
        for err in errors:
            print("  -", err)
        return 1
    print(f"validated {count} JSON files across {', '.join(PACKS)}")
    out = bundle()
    print(f"built {os.path.relpath(out, ROOT)} ({os.path.getsize(out)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
