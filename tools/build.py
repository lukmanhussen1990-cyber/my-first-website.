#!/usr/bin/env python3
"""Builds the NPC Kingdom .mcaddon.

    python3 tools/build.py

Writes the pack sources to ``packs/`` and the importable add-on to
``dist/NPC_Kingdom.mcaddon``.
"""

import json
import os
import shutil
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import gen_bp  # noqa: E402
import gen_rp  # noqa: E402

# Fixed so rebuilding never invalidates an installed copy of the add-on.
UUIDS = {
    "bp_header": "6f1a2c40-5d3b-4e77-9a10-3c2b8f4d1e01",
    "bp_module": "6f1a2c40-5d3b-4e77-9a10-3c2b8f4d1e02",
    "rp_header": "6f1a2c40-5d3b-4e77-9a10-3c2b8f4d1e03",
    "rp_module": "6f1a2c40-5d3b-4e77-9a10-3c2b8f4d1e04",
}

BP_DIR = os.path.join(ROOT, "packs", "NPC_Kingdom_BP")
RP_DIR = os.path.join(ROOT, "packs", "NPC_Kingdom_RP")
DIST = os.path.join(ROOT, "dist")
MCADDON = os.path.join(DIST, "NPC_Kingdom.mcaddon")


def count(root, ext):
    n = 0
    for _dirpath, _dirnames, files in os.walk(root):
        n += sum(1 for f in files if f.endswith(ext))
    return n


def validate_json(root):
    """Every .json we ship must parse; a single typo breaks the whole pack."""
    bad = []
    for dirpath, _dirnames, files in os.walk(root):
        for f in files:
            if not f.endswith(".json"):
                continue
            path = os.path.join(dirpath, f)
            try:
                with open(path, encoding="utf-8") as fh:
                    json.load(fh)
            except Exception as exc:  # pragma: no cover - build-time guard
                bad.append("%s: %s" % (os.path.relpath(path, ROOT), exc))
    return bad


def zip_addon():
    os.makedirs(DIST, exist_ok=True)
    if os.path.exists(MCADDON):
        os.remove(MCADDON)
    with zipfile.ZipFile(MCADDON, "w", zipfile.ZIP_DEFLATED) as zf:
        for src, label in ((BP_DIR, "NPC_Kingdom_BP"), (RP_DIR, "NPC_Kingdom_RP")):
            for dirpath, _dirnames, files in os.walk(src):
                for f in sorted(files):
                    full = os.path.join(dirpath, f)
                    rel = os.path.join(label, os.path.relpath(full, src))
                    zf.write(full, rel.replace(os.sep, "/"))
    return os.path.getsize(MCADDON)


def main():
    for d in (BP_DIR, RP_DIR):
        if os.path.exists(d):
            shutil.rmtree(d)
        os.makedirs(d)

    gen_rp.generate(RP_DIR, UUIDS)
    gen_bp.generate(BP_DIR, UUIDS)

    problems = validate_json(BP_DIR) + validate_json(RP_DIR)
    if problems:
        print("JSON validation FAILED:")
        for p in problems:
            print("  " + p)
        return 1

    size = zip_addon()
    print("Behavior pack : %d json, %d mcfunction, %d png"
          % (count(BP_DIR, ".json"), count(BP_DIR, ".mcfunction"), count(BP_DIR, ".png")))
    print("Resource pack : %d json, %d png"
          % (count(RP_DIR, ".json"), count(RP_DIR, ".png")))
    print("Built %s (%.1f KB)" % (os.path.relpath(MCADDON, ROOT), size / 1024.0))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
