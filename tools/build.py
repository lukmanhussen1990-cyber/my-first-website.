#!/usr/bin/env python3
"""
Packs addon/BP and addon/RP into installable files.

  dist/DevilVsAngel.mcaddon        <- tap this on your phone, installs both
  dist/DevilVsAngel_BP.mcpack      <- behaviour pack on its own
  dist/DevilVsAngel_RP.mcpack      <- resource pack on its own

Run:  python3 tools/build.py
"""

import json
import os
import shutil
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADDON = os.path.join(ROOT, "addon")
DIST = os.path.join(ROOT, "dist")


def check_json():
    """Fail loudly here rather than silently in game."""
    for base, _, files in os.walk(ADDON):
        for name in files:
            if name.endswith(".json"):
                path = os.path.join(base, name)
                with open(path) as fh:
                    json.load(fh)


def zip_dir(src, out, prefix=""):
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for base, _, files in os.walk(src):
            for name in files:
                full = os.path.join(base, name)
                rel = os.path.relpath(full, src)
                z.write(full, os.path.join(prefix, rel) if prefix else rel)
    print("built", os.path.relpath(out, ROOT))


def main():
    check_json()
    shutil.rmtree(DIST, ignore_errors=True)
    os.makedirs(DIST)

    zip_dir(os.path.join(ADDON, "BP"), os.path.join(DIST, "DevilVsAngel_BP.mcpack"))
    zip_dir(os.path.join(ADDON, "RP"), os.path.join(DIST, "DevilVsAngel_RP.mcpack"))

    # .mcaddon = one zip holding both pack folders
    out = os.path.join(DIST, "DevilVsAngel.mcaddon")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for pack in ("BP", "RP"):
            src = os.path.join(ADDON, pack)
            for base, _, files in os.walk(src):
                for name in files:
                    full = os.path.join(base, name)
                    z.write(full, os.path.join(
                        "DevilVsAngel_" + pack, os.path.relpath(full, src)))
    print("built", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    main()
