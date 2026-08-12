#!/usr/bin/env python3
"""Bridges the mansion generator's output into the runtime.

Reads src/behavior_pack/functions/mansion/_index.json and writes:

  - src/behavior_pack/scripts/mansion_data.js   (parts, anchors, seals, bounds)
  - src/behavior_pack/functions/mansion/build_all.mcfunction

`build_all` is the no-script fallback: run directly by a player it builds the
whole mansion at their feet in one tick, because a function invoked from chat
executes at the player's position and every part uses relative coordinates.
The normal path (/function tech_house) is paced by the script instead.

Run: python3 tools/gen_mansion_data.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANSION = ROOT / "src" / "behavior_pack" / "functions" / "mansion"
SCRIPTS = ROOT / "src" / "behavior_pack" / "scripts"

HEADER = """// GENERATED FILE — do not edit by hand.
// Rebuilt by tools/gen_mansion_data.py from
// src/behavior_pack/functions/mansion/_index.json
//
// PARTS   : function paths, run one per tick so mobile devices keep their frame budget
// ANCHORS : named room offsets from the mansion origin
// SEALS   : envelope openings that lockdown fills solid and unlock re-opens
// BOUNDS  : the full build volume, used for the alarm/emergency-light fill sweeps
"""


def main() -> None:
    index_path = MANSION / "_index.json"
    if not index_path.exists():
        raise SystemExit("mansion/_index.json is missing — run tools/gen_mansion.py first")

    index = json.loads(index_path.read_text())
    parts = index["parts"]
    anchors = index["anchors"]
    seals = index["seals"]
    bounds = index["bounds"]

    for name in (
        "entrance", "garage", "pool", "master_bedroom", "cinema", "gym",
        "gaming_room", "server_room", "security_room", "laboratory",
        "quarantine", "bunker", "tunnel_exit", "rooftop", "control_panel",
    ):
        if name not in anchors:
            raise SystemExit(f"_index.json is missing the required anchor {name!r}")

    for part in parts:
        if not (ROOT / "src" / "behavior_pack" / "functions" / f"{part}.mcfunction").exists():
            raise SystemExit(f"_index.json lists {part!r}, which has no .mcfunction file")

    body = [
        HEADER,
        f"export const PARTS = {json.dumps(parts, indent=2)};",
        "",
        f"export const ANCHORS = {json.dumps(anchors, indent=2)};",
        "",
        f"export const SEALS = {json.dumps(seals, indent=2)};",
        "",
        f"export const BOUNDS = {json.dumps(bounds, indent=2)};",
        "",
    ]
    (SCRIPTS / "mansion_data.js").write_text("\n".join(body))

    fallback = [
        "# Build the whole mansion in one tick at the position this function runs at.",
        "# Run by a player from chat, that is the player's feet.",
        "#",
        "# This is the fallback path: /function tech_house is preferred because the",
        "# script paces the build one part per tick, which is far kinder to a phone.",
        "# This version does not record the mansion origin, so lockdown, quarantine",
        "# and the room systems will not know where the building is.",
        "",
    ]
    fallback += [f"function {part}" for part in parts]
    (MANSION / "build_all.mcfunction").write_text("\n".join(fallback) + "\n")

    print(
        f"mansion_data.js: {len(parts)} parts, {len(anchors)} anchors, "
        f"{len(seals)} seals, bounds {bounds['from']}..{bounds['to']}"
    )
    print(f"build_all.mcfunction: {len(parts)} part calls")


if __name__ == "__main__":
    main()
