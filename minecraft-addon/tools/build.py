"""Build Arcane Arsenal.

Regenerates textures and pack files, then writes to dist/:
  ArcaneArsenal_vX.Y.Z.mcaddon   - both packs, open this on your phone
  ArcaneArsenal_BP_vX.Y.Z.mcpack - behavior pack only (fallback)
  ArcaneArsenal_RP_vX.Y.Z.mcpack - resource pack only (fallback)

Run:  python3 tools/build.py
"""
import json
import os
import sys
import zipfile

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
PACKS = os.path.join(ROOT, "packs")
DIST = os.path.join(ROOT, "dist")
PACK_NAMES = ("ArcaneArsenal_BP", "ArcaneArsenal_RP")
FIXED_TIME = (2026, 1, 1, 0, 0, 0)  # reproducible zips


def pack_files(pack):
    base = os.path.join(PACKS, pack)
    for dirpath, dirnames, files in os.walk(base):
        dirnames.sort()
        for name in sorted(files):
            full = os.path.join(dirpath, name)
            yield full, os.path.relpath(full, base).replace(os.sep, "/")


def add(zf, full, arcname):
    info = zipfile.ZipInfo(arcname, FIXED_TIME)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    with open(full, "rb") as fh:
        zf.writestr(info, fh.read())


def main():
    sys.path.insert(0, TOOLS)
    import make_packs
    import make_textures

    make_textures.main()
    make_packs.main()

    with open(os.path.join(PACKS, "ArcaneArsenal_BP", "manifest.json"), encoding="utf-8") as fh:
        version = ".".join(str(v) for v in json.load(fh)["header"]["version"])
    os.makedirs(DIST, exist_ok=True)
    for old in os.listdir(DIST):
        if old.endswith((".mcaddon", ".mcpack")):
            os.remove(os.path.join(DIST, old))

    addon = os.path.join(DIST, f"ArcaneArsenal_v{version}.mcaddon")
    with zipfile.ZipFile(addon, "w") as zf:
        for pack in PACK_NAMES:
            for full, rel in pack_files(pack):
                add(zf, full, f"{pack}/{rel}")
    outputs = [addon]
    for pack in PACK_NAMES:
        path = os.path.join(DIST, f"{pack}_v{version}.mcpack")
        with zipfile.ZipFile(path, "w") as zf:
            for full, rel in pack_files(pack):
                add(zf, full, rel)
        outputs.append(path)
    for path in outputs:
        print(f"built {os.path.relpath(path, ROOT)} ({os.path.getsize(path) // 1024} KB)")


if __name__ == "__main__":
    main()
