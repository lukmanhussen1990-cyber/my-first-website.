#!/usr/bin/env python3
"""
Natural Disasters - packer.

Validates every JSON file, then zips both packs into a single installable
`NaturalDisasters.mcaddon` in the repository root:

    python3 tools/build_mcaddon.py

The .mcaddon file is just a zip that contains the two pack folders. Minecraft
opens it directly on Android and iOS.
"""

import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKS = ["natural_disasters_BP", "natural_disasters_RP"]
OUTPUT = os.path.join(ROOT, "NaturalDisasters.mcaddon")

# Files that are documentation only and do not belong in the shipped addon.
SKIP_NAMES = {"README.md", ".DS_Store", "Thumbs.db", "desktop.ini"}


def validate_json():
    """Parses every .json file so a typo never ships as a broken pack."""
    problems = []
    checked = 0
    for pack in PACKS:
        for folder, _, files in os.walk(os.path.join(ROOT, pack)):
            for name in files:
                if not name.endswith(".json"):
                    continue
                path = os.path.join(folder, name)
                checked += 1
                try:
                    with open(path, "r", encoding="utf-8") as handle:
                        json.load(handle)
                except json.JSONDecodeError as error:
                    problems.append(f"{os.path.relpath(path, ROOT)}: {error}")
    print(f"checked {checked} json files")
    return problems


def check_uuids():
    """Every manifest UUID in the addon has to be unique."""
    seen = {}
    problems = []
    for pack in PACKS:
        manifest_path = os.path.join(ROOT, pack, "manifest.json")
        with open(manifest_path, "r", encoding="utf-8") as handle:
            manifest = json.load(handle)
        uuids = [manifest["header"]["uuid"]]
        uuids += [module["uuid"] for module in manifest.get("modules", [])]
        for uuid in uuids:
            if uuid in seen:
                problems.append(f"duplicate uuid {uuid} in {pack} and {seen[uuid]}")
            seen[uuid] = pack
    print(f"checked {len(seen)} manifest uuids")
    return problems


def build():
    if os.path.exists(OUTPUT):
        os.remove(OUTPUT)
    count = 0
    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as archive:
        for pack in PACKS:
            base = os.path.join(ROOT, pack)
            for folder, _, files in os.walk(base):
                for name in sorted(files):
                    if name in SKIP_NAMES:
                        continue
                    full = os.path.join(folder, name)
                    arcname = os.path.join(pack, os.path.relpath(full, base))
                    archive.write(full, arcname)
                    count += 1
    size_kb = os.path.getsize(OUTPUT) / 1024
    print(f"packed {count} files into {os.path.relpath(OUTPUT, ROOT)} ({size_kb:.1f} KB)")


def main():
    problems = validate_json() + check_uuids()
    if problems:
        print("\nBuild failed:")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    build()
    return 0


if __name__ == "__main__":
    sys.exit(main())
