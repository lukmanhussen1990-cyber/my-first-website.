#!/usr/bin/env python3
"""Validate every pack in the repo and bundle each addon into dist/.

Run from the repo root:  python3 tools/build.py
"""

import json
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# name, packs, bundle extension. A pack pair ships as .mcaddon; a lone
# resource pack ships as .mcpack. Both import the same way on mobile.
ADDONS = [
    ("OnePunchMan", ["OPM_BP", "OPM_RP"], "mcaddon"),
    ("SecurityHouse", ["SEC_BP", "SEC_RP"], "mcaddon"),
    ("VibrantPlusGraphics", ["VIS_RP"], "mcpack"),
]


def load(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as fh:
        return json.load(fh)


def json_files(pack):
    out = []
    for dirpath, _, names in os.walk(os.path.join(ROOT, pack)):
        for name in sorted(names):
            if name.endswith(".json"):
                out.append(os.path.join(dirpath, name))
    return out


def check_manifests(packs, errors):
    uuids = {}
    for pack in packs:
        pack_dir = os.path.join(ROOT, pack)
        for required in ("manifest.json", "pack_icon.png"):
            if not os.path.isfile(os.path.join(pack_dir, required)):
                errors.append(f"{pack}: missing {required}")
        try:
            data = load(pack, "manifest.json")
        except (OSError, ValueError):
            continue
        for uid in [data["header"]["uuid"]] + [m["uuid"] for m in data["modules"]]:
            if uid in uuids:
                errors.append(f"{pack}: duplicate UUID {uid} (also in {uuids[uid]})")
            uuids[uid] = pack


def check_items(bp, rp, errors):
    item_dir = os.path.join(ROOT, bp, "items")
    if not os.path.isdir(item_dir):
        return

    entities = set()
    entity_dir = os.path.join(ROOT, bp, "entities")
    for name in sorted(os.listdir(entity_dir)):
        entities.add(load(bp, "entities", name)["minecraft:entity"]["description"]["identifier"])

    client = set()
    for name in sorted(os.listdir(os.path.join(ROOT, rp, "entity"))):
        client.add(load(rp, "entity", name)["minecraft:client_entity"]["description"]["identifier"])
    for ident in sorted(entities - client):
        errors.append(f"{rp}/entity: no client entity definition for {ident}")

    atlas = load(rp, "textures", "item_texture.json")["texture_data"]
    for name in sorted(os.listdir(item_dir)):
        comps = load(bp, "items", name)["minecraft:item"]["components"]
        target = comps.get("minecraft:projectile", {}).get("projectile_entity")
        if target and target not in entities:
            errors.append(f"{bp}/items/{name}: projectile_entity {target} is not defined")
        icon = comps.get("minecraft:icon")
        key = icon if isinstance(icon, str) else (icon or {}).get("texture")
        if key not in atlas:
            errors.append(f"{bp}/items/{name}: icon '{key}' missing from item_texture.json")
        elif not os.path.isfile(os.path.join(ROOT, rp, atlas[key]["textures"] + ".png")):
            errors.append(f"{bp}/items/{name}: texture {atlas[key]['textures']}.png not found")


def check_blocks(bp, rp, errors):
    block_dir = os.path.join(ROOT, bp, "blocks")
    if not os.path.isdir(block_dir):
        return set()

    atlas = load(rp, "textures", "terrain_texture.json")["texture_data"]
    defined = set()
    for name in sorted(os.listdir(block_dir)):
        block = load(bp, "blocks", name)["minecraft:block"]
        defined.add(block["description"]["identifier"])
        for face, inst in block["components"]["minecraft:material_instances"].items():
            key = inst["texture"]
            if key not in atlas:
                errors.append(f"{bp}/blocks/{name}: texture '{key}' missing from terrain_texture.json")
            elif not os.path.isfile(os.path.join(ROOT, rp, atlas[key]["textures"] + ".png")):
                errors.append(f"{bp}/blocks/{name}: {atlas[key]['textures']}.png not found")
    return defined


def check_functions(bp, defined_blocks, errors):
    """Every custom block a function places has to actually exist."""
    func_dir = os.path.join(ROOT, bp, "functions")
    if not os.path.isdir(func_dir):
        return

    known_funcs = set()
    for dirpath, _, names in os.walk(func_dir):
        for name in names:
            if name.endswith(".mcfunction"):
                rel = os.path.relpath(os.path.join(dirpath, name), func_dir)
                known_funcs.add(rel[: -len(".mcfunction")].replace(os.sep, "/"))

    for dirpath, _, names in os.walk(func_dir):
        for name in sorted(names):
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, ROOT)
            with open(path, encoding="utf-8") as fh:
                for lineno, raw in enumerate(fh, 1):
                    line = raw.strip()
                    if not line or line.startswith("#"):
                        continue
                    parts = line.split()
                    if parts[0] == "function" and parts[1] not in known_funcs:
                        errors.append(f"{rel}:{lineno}: calls unknown function {parts[1]}")
                    for token in re.findall(r"\b[a-z_]+:[a-z_]+\b", line):
                        if token.startswith("minecraft:"):
                            continue
                        if token not in defined_blocks:
                            errors.append(f"{rel}:{lineno}: unknown custom block {token}")


def validate():
    errors = []
    all_packs = [p for _, packs, _ in ADDONS for p in packs]
    check_manifests(all_packs, errors)

    count = 0
    for pack in all_packs:
        for path in json_files(pack):
            count += 1
            try:
                json.load(open(path, encoding="utf-8"))
            except ValueError as exc:
                errors.append(f"{os.path.relpath(path, ROOT)}: invalid JSON - {exc}")

    for _, packs, _ in ADDONS:
        if len(packs) != 2:
            continue          # resource-pack-only addons have nothing to cross-check
        bp, rp = packs
        check_items(bp, rp, errors)
        blocks = check_blocks(bp, rp, errors)
        check_functions(bp, blocks, errors)

    return errors, count


def bundle(name, packs, ext):
    out = os.path.join(ROOT, "dist", f"{name}.{ext}")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in packs:
            for dirpath, _, names in os.walk(os.path.join(ROOT, pack)):
                for fname in sorted(names):
                    full = os.path.join(dirpath, fname)
                    zf.write(full, os.path.relpath(full, ROOT))
    return out


def main():
    errors, count = validate()
    if errors:
        print("FAILED validation:")
        for err in errors:
            print("  -", err)
        return 1
    print(f"validated {count} JSON files across {len([p for _, ps, _ in ADDONS for p in ps])} packs")
    for name, packs, ext in ADDONS:
        out = bundle(name, packs, ext)
        print(f"built dist/{os.path.basename(out)} ({os.path.getsize(out)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
