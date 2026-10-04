"""Packages the behavior + resource packs into dist/FlyingGuardian.mcaddon.

    python3 tools/package.py

A .mcaddon is a zip with one folder per pack (each holding its manifest.json). Opening the
file on Android/iOS/Windows imports both packs into Minecraft.
"""

import os
import zipfile

ADDON = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DIST = os.path.join(ADDON, "dist")
PACKS = ("FlyingGuardian_BP", "FlyingGuardian_RP")


def main():
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, "FlyingGuardian.mcaddon")
    count = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for pack in PACKS:
            root = os.path.join(ADDON, pack)
            for dirpath, dirnames, filenames in os.walk(root):
                dirnames.sort()
                for name in sorted(filenames):
                    if name.startswith(".") or name.endswith(".pyc"):
                        continue
                    full = os.path.join(dirpath, name)
                    arc = os.path.relpath(full, ADDON).replace(os.sep, "/")
                    info = zipfile.ZipInfo(arc, date_time=(2024, 5, 15, 0, 0, 0))
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info.external_attr = 0o644 << 16
                    with open(full, "rb") as f:
                        z.writestr(info, f.read())
                    count += 1
    print(f"wrote {os.path.relpath(out, ADDON)} ({count} files, {os.path.getsize(out) // 1024} KiB)")


if __name__ == "__main__":
    main()
