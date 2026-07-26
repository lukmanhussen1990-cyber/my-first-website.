#!/usr/bin/env python3
"""Check the Atmos fog pack against the documented fog schema.

Schema: learn.microsoft.com/en-us/minecraft/creator/documents/foginresourcepacks

A malformed fog file is silently skipped by the game, and a fog_identifier that
points at nothing just falls through to the vanilla fog, so neither failure is
visible in-game. Both are caught here instead.

Run from the repo root:  python3 tools/verify_atmos.py
"""

import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, "ATM_RP")

HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
CAMERA_LOCATIONS = {"air", "weather", "water", "lava", "lava_resistance"}
RENDER_TYPES = {"fixed", "render"}

errors = []


def check_layer(where, layer):
    for key in ("fog_start", "fog_end", "fog_color", "render_distance_type"):
        if key not in layer:
            errors.append(f"{where}: missing {key}")
    rdt = layer.get("render_distance_type")
    if rdt not in RENDER_TYPES:
        errors.append(f"{where}.render_distance_type: {rdt!r} must be one of {sorted(RENDER_TYPES)}")

    start, end = layer.get("fog_start"), layer.get("fog_end")
    if isinstance(start, (int, float)) and isinstance(end, (int, float)):
        if start > end:
            errors.append(f"{where}: fog_start {start} is beyond fog_end {end}")
        if rdt == "render":
            # fractions of render distance; over 1.0 means fog never completes
            for name, val in (("fog_start", start), ("fog_end", end)):
                if not 0.0 <= val <= 1.0:
                    errors.append(f'{where}.{name}: {val} is outside 0.0-1.0 for render_distance_type "render"')
        elif rdt == "fixed":
            for name, val in (("fog_start", start), ("fog_end", end)):
                if val < 0:
                    errors.append(f"{where}.{name}: {val} cannot be negative")

    color = layer.get("fog_color")
    if not isinstance(color, str) or not HEX_RE.match(color):
        errors.append(f"{where}.fog_color: {color!r} is not a 6-digit hex colour")


def main():
    identifiers = {}
    fog_files = sorted(glob.glob(os.path.join(PACK, "fogs", "*.json")))
    if not fog_files:
        errors.append("ATM_RP/fogs/ contains no fog definitions")

    for path in fog_files:
        rel = os.path.relpath(path, ROOT)
        doc = json.load(open(path, encoding="utf-8"))
        if doc.get("format_version") != "1.16.100":
            errors.append(f"{rel}: format_version should be 1.16.100, got {doc.get('format_version')!r}")
        settings = doc["minecraft:fog_settings"]
        ident = settings["description"]["identifier"]
        if ":" not in ident:
            errors.append(f"{rel}: identifier {ident!r} needs a namespace")
        if ident.startswith("minecraft:"):
            errors.append(f"{rel}: the minecraft namespace is reserved for vanilla packs")
        if ident in identifiers:
            errors.append(f"{rel}: identifier {ident} already used by {identifiers[ident]}")
        identifiers[ident] = rel

        for location, layer in settings["distance"].items():
            if location not in CAMERA_LOCATIONS:
                errors.append(f"{rel}: {location!r} is not a valid camera location")
                continue
            check_layer(f"{rel}:{location}", layer)
            if "transition_fog" in layer:
                if location != "water":
                    errors.append(f"{rel}:{location}: transition_fog only works on water")
                check_layer(f"{rel}:{location}.transition_fog.init_fog",
                            layer["transition_fog"]["init_fog"])

    # Every biome assignment has to point at a fog that exists in this pack.
    biomes = json.load(open(os.path.join(PACK, "biomes_client.json"), encoding="utf-8"))
    if "biomes" not in biomes:
        errors.append('biomes_client.json: top level must be {"biomes": {...}}')
    else:
        for biome, cfg in biomes["biomes"].items():
            ident = cfg.get("fog_identifier")
            if ident is None:
                errors.append(f"biomes_client.json: {biome} has no fog_identifier")
            elif ident not in identifiers:
                errors.append(f"biomes_client.json: {biome} points at {ident}, which is not defined")
        if "default" not in biomes["biomes"]:
            errors.append('biomes_client.json: no "default" entry, so most biomes keep vanilla fog')

    unused = set(identifiers) - {
        c.get("fog_identifier") for c in biomes.get("biomes", {}).values()
    }
    for ident in sorted(unused):
        errors.append(f"{identifiers[ident]}: {ident} is never assigned to a biome")

    if errors:
        print("FAILED fog pack verification:")
        for err in errors:
            print("  -", err)
        return 1
    print(f"fog pack verified: {len(identifiers)} fog definitions, "
          f"{len(biomes['biomes'])} biome assignments, all resolving")
    return 0


if __name__ == "__main__":
    sys.exit(main())
