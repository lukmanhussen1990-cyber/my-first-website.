#!/usr/bin/env python3
"""Zip the two packs into the files Minecraft imports on a phone.

    dist/LuxuryHouse.mcaddon        both packs, one tap to install
    dist/LuxuryHouse_BP.mcpack      behaviour pack on its own
    dist/LuxuryHouse_RP.mcpack      resource pack on its own

Run:  python3 tools/package.py
"""

import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

BP = os.path.join(ROOT, "behavior_packs", "luxury_house_bp")
RP = os.path.join(ROOT, "resource_packs", "luxury_house_rp")


def files_in(folder):
    for directory, _, names in os.walk(folder):
        for name in sorted(names):
            if name.startswith("."):
                continue
            yield os.path.join(directory, name)


def zip_pack(zf, folder, prefix):
    for path in files_in(folder):
        arcname = os.path.join(prefix, os.path.relpath(path, folder)) if prefix \
            else os.path.relpath(path, folder)
        # zip entries always use forward slashes
        zf.write(path, arcname.replace(os.sep, "/"))


def build(name, packs):
    os.makedirs(DIST, exist_ok=True)
    path = os.path.join(DIST, name)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        for folder, prefix in packs:
            zip_pack(zf, folder, prefix)
    size = os.path.getsize(path)
    print("%-28s %6.1f KB" % (os.path.relpath(path, ROOT), size / 1024.0))


def main():
    build("LuxuryHouse.mcaddon", [(BP, "luxury_house_bp"), (RP, "luxury_house_rp")])
    build("LuxuryHouse_BP.mcpack", [(BP, "")])
    build("LuxuryHouse_RP.mcpack", [(RP, "")])


if __name__ == "__main__":
    main()
