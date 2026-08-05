#!/usr/bin/env python3
"""Validate the packs and zip them into dist/SecondSightGodMode.mcaddon.

An .mcaddon is just a zip holding both pack folders; Minecraft on Android/iOS
imports it when you tap the file. Run:  python3 tools/build.py
"""

import json
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.dirname(ROOT)
PACKS = ["SecondSight_BP", "SecondSight_RP"]
DIST = os.path.join(REPO, "dist")
OUT = os.path.join(DIST, "SecondSightGodMode.mcaddon")

# Every function referenced by a command must exist, or Minecraft silently
# skips the call at runtime and the addon looks "broken but no errors".
FUNCTION_DIR = os.path.join(ROOT, "SecondSight_BP", "functions")


def fail(msg):
    print("ERROR: " + msg)
    return 1


def check_json():
    errors = 0
    for pack in PACKS:
        for dirpath, _dirnames, filenames in os.walk(os.path.join(ROOT, pack)):
            for name in filenames:
                if not name.endswith(".json"):
                    continue
                path = os.path.join(dirpath, name)
                try:
                    with open(path, encoding="utf-8") as fh:
                        json.load(fh)
                except ValueError as exc:
                    errors += fail("%s: %s" % (os.path.relpath(path, REPO), exc))
    return errors


def check_manifests():
    errors = 0
    uuids = set()
    for pack in PACKS:
        path = os.path.join(ROOT, pack, "manifest.json")
        with open(path, encoding="utf-8") as fh:
            manifest = json.load(fh)
        uuids.add(manifest["header"]["uuid"])
        for module in manifest["modules"]:
            uuids.add(module["uuid"])
        if not os.path.exists(os.path.join(ROOT, pack, "pack_icon.png")):
            errors += fail("%s is missing pack_icon.png" % pack)
    # 2 headers + 2 modules, all distinct, or Minecraft rejects the import.
    if len(uuids) != 4:
        errors += fail("manifest UUIDs are not all unique: %s" % sorted(uuids))

    bp = json.load(open(os.path.join(ROOT, "SecondSight_BP", "manifest.json"), encoding="utf-8"))
    rp = json.load(open(os.path.join(ROOT, "SecondSight_RP", "manifest.json"), encoding="utf-8"))
    dep = bp.get("dependencies", [{}])[0].get("uuid")
    if dep != rp["header"]["uuid"]:
        errors += fail("BP dependency %s does not point at the RP header UUID" % dep)
    return errors


def known_functions():
    names = set()
    for dirpath, _dirnames, filenames in os.walk(FUNCTION_DIR):
        for name in filenames:
            if name.endswith(".mcfunction"):
                rel = os.path.relpath(os.path.join(dirpath, name), FUNCTION_DIR)
                names.add(rel[: -len(".mcfunction")].replace(os.sep, "/"))
    return names


def check_function_refs():
    errors = 0
    names = known_functions()

    with open(os.path.join(FUNCTION_DIR, "tick.json"), encoding="utf-8") as fh:
        for value in json.load(fh)["values"]:
            if value not in names:
                errors += fail("tick.json references missing function '%s'" % value)

    for dirpath, _dirnames, filenames in os.walk(FUNCTION_DIR):
        for name in filenames:
            if not name.endswith(".mcfunction"):
                continue
            path = os.path.join(dirpath, name)
            with open(path, encoding="utf-8") as fh:
                for lineno, line in enumerate(fh, 1):
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    parts = line.split()
                    if "function" not in parts:
                        continue
                    target = parts[parts.index("function") + 1]
                    if target not in names:
                        errors += fail(
                            "%s:%d calls missing function '%s'"
                            % (os.path.relpath(path, REPO), lineno, target)
                        )
    return errors


def check_item_textures():
    errors = 0
    rp = os.path.join(ROOT, "SecondSight_RP")
    with open(os.path.join(rp, "textures", "item_texture.json"), encoding="utf-8") as fh:
        data = json.load(fh)["texture_data"]
    declared = {}
    for key, entry in data.items():
        declared[key] = entry["textures"]
        if not os.path.exists(os.path.join(rp, entry["textures"] + ".png")):
            errors += fail("item_texture.json points at missing %s.png" % entry["textures"])

    items_dir = os.path.join(ROOT, "SecondSight_BP", "items")
    for name in sorted(os.listdir(items_dir)):
        with open(os.path.join(items_dir, name), encoding="utf-8") as fh:
            item = json.load(fh)["minecraft:item"]
        icon = item["components"]["minecraft:icon"]
        icon = icon["texture"] if isinstance(icon, dict) else icon
        if icon not in declared:
            errors += fail("%s uses icon '%s' which item_texture.json does not define" % (name, icon))
        entity = item["components"].get("minecraft:projectile", {}).get("projectile_entity")
        if entity:
            short = entity.split(":", 1)[1]
            for folder, suffix in (("SecondSight_BP/entities", ".json"),
                                   ("SecondSight_RP/entity", ".entity.json")):
                if not os.path.exists(os.path.join(ROOT, folder, short + suffix)):
                    errors += fail("%s throws '%s' but %s/%s%s is missing"
                                   % (name, entity, folder, short, suffix))
    return errors


def build():
    os.makedirs(DIST, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in PACKS:
            base = os.path.join(ROOT, pack)
            for dirpath, _dirnames, filenames in os.walk(base):
                for name in sorted(filenames):
                    path = os.path.join(dirpath, name)
                    arc = os.path.join(pack, os.path.relpath(path, base))
                    zf.write(path, arc.replace(os.sep, "/"))
    size = os.path.getsize(OUT)
    print("built %s (%d bytes)" % (os.path.relpath(OUT, REPO), size))


def main():
    errors = check_json() + check_manifests() + check_function_refs() + check_item_textures()
    if errors:
        print("%d problem(s) found - not building." % errors)
        return 1
    print("all checks passed")
    build()
    return 0


if __name__ == "__main__":
    sys.exit(main())
