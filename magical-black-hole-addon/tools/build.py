#!/usr/bin/env python3
"""Packs the behavior + resource packs into dist/MagicalBlackHole.mcaddon.

Run from anywhere:  python3 tools/build.py
"""
import json
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKS = os.path.join(ROOT, "packs")
DIST = os.path.join(ROOT, "dist")
OUTPUT = os.path.join(DIST, "MagicalBlackHole.mcaddon")
PACK_DIRS = ["MagicalBlackHole_BP", "MagicalBlackHole_RP"]


def check_json(path):
    with open(path, encoding="utf-8") as f:
        json.load(f)


def main():
    os.makedirs(DIST, exist_ok=True)
    files = 0
    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in PACK_DIRS:
            pack_root = os.path.join(PACKS, pack)
            for folder, _, names in sorted(os.walk(pack_root)):
                for name in sorted(names):
                    path = os.path.join(folder, name)
                    if name.endswith(".json"):
                        check_json(path)
                    arcname = os.path.relpath(path, PACKS).replace(os.sep, "/")
                    info = zipfile.ZipInfo(arcname, date_time=(2024, 6, 1, 0, 0, 0))
                    info.compress_type = zipfile.ZIP_DEFLATED
                    with open(path, "rb") as f:
                        zf.writestr(info, f.read())
                    files += 1
    print(f"Built {os.path.relpath(OUTPUT, ROOT)} ({files} files, {os.path.getsize(OUTPUT)} bytes)")


if __name__ == "__main__":
    main()
