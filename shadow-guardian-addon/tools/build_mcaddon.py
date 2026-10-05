#!/usr/bin/env python3
"""
Packs ShadowGuardian_BP and ShadowGuardian_RP into one ShadowGuardian.mcaddon file.
(A .mcaddon is just a zip file with both pack folders inside.)

Run:  python3 tools/build_mcaddon.py
"""
import os
import zipfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PACKS = ["ShadowGuardian_BP", "ShadowGuardian_RP"]
OUTPUT = os.path.join(ROOT, "ShadowGuardian.mcaddon")
FIXED_TIME = (2024, 6, 13, 0, 0, 0)    # fixed date so the file is identical on every build


def main():
    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in PACKS:
            for folder, dirs, files in os.walk(os.path.join(ROOT, pack)):
                dirs.sort()
                for name in sorted(files):
                    if name.startswith("."):
                        continue
                    path = os.path.join(folder, name)
                    arcname = os.path.relpath(path, ROOT).replace(os.sep, "/")
                    info = zipfile.ZipInfo(arcname, FIXED_TIME)
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info.external_attr = 0o644 << 16
                    with open(path, "rb") as f:
                        zf.writestr(info, f.read())
                    print("added", arcname)
    print("\nwrote", os.path.normpath(OUTPUT), os.path.getsize(OUTPUT), "bytes")


if __name__ == "__main__":
    main()
