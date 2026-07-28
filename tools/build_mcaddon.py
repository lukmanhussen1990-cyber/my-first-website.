#!/usr/bin/env python3
"""
Packer for every addon in this repository.

Validates all JSON, checks that no two manifests share a UUID, then zips each
addon's packs into an installable `.mcaddon` in the repository root:

    python3 tools/build_mcaddon.py            # build everything
    python3 tools/build_mcaddon.py parasite   # build one addon by name

A .mcaddon is just a zip containing the pack folders. Minecraft opens it
directly on Android and iOS.
"""

import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ADDONS = {
    "natural_disasters": {
        "output": "NaturalDisasters.mcaddon",
        "packs": ["natural_disasters_BP", "natural_disasters_RP"],
    },
    "parasite": {
        "output": "Parasite.mcaddon",
        "packs": ["parasite_BP", "parasite_RP"],
    },
}

# Documentation that should not ship inside the addon.
SKIP_NAMES = {"README.md", ".DS_Store", "Thumbs.db", "desktop.ini"}


def all_packs(selected):
    for name in selected:
        for pack in ADDONS[name]["packs"]:
            yield pack


def validate_json(selected):
    problems = []
    checked = 0
    for pack in all_packs(selected):
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


def check_uuids(selected):
    """UUIDs must be unique across every pack, not just within one addon."""
    seen = {}
    problems = []
    for pack in all_packs(selected):
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


def check_dependencies(selected):
    """Each behavior pack must point at its own resource pack."""
    problems = []
    for name in selected:
        packs = ADDONS[name]["packs"]
        behavior, resource = packs[0], packs[1]
        with open(os.path.join(ROOT, behavior, "manifest.json"), "r", encoding="utf-8") as handle:
            bp = json.load(handle)
        with open(os.path.join(ROOT, resource, "manifest.json"), "r", encoding="utf-8") as handle:
            rp = json.load(handle)
        wanted = rp["header"]["uuid"]
        found = [d.get("uuid") for d in bp.get("dependencies", [])]
        if wanted not in found:
            problems.append(f"{behavior} does not depend on {resource} ({wanted})")
    return problems


def build(name):
    spec = ADDONS[name]
    output = os.path.join(ROOT, spec["output"])
    if os.path.exists(output):
        os.remove(output)
    count = 0
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for pack in spec["packs"]:
            base = os.path.join(ROOT, pack)
            for folder, _, files in os.walk(base):
                for filename in sorted(files):
                    if filename in SKIP_NAMES:
                        continue
                    full = os.path.join(folder, filename)
                    arcname = os.path.join(pack, os.path.relpath(full, base))
                    archive.write(full, arcname)
                    count += 1
    size_kb = os.path.getsize(output) / 1024
    print(f"packed {count} files into {spec['output']} ({size_kb:.1f} KB)")


def main(argv):
    selected = argv[1:] or list(ADDONS)
    unknown = [name for name in selected if name not in ADDONS]
    if unknown:
        print(f"unknown addon(s): {', '.join(unknown)}")
        print(f"available: {', '.join(ADDONS)}")
        return 2

    problems = validate_json(selected) + check_uuids(selected) + check_dependencies(selected)
    if problems:
        print("\nBuild failed:")
        for problem in problems:
            print(f"  - {problem}")
        return 1

    for name in selected:
        build(name)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
