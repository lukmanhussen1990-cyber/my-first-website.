#!/usr/bin/env python3
"""Package the SCP-096 addon into installable files.

  downloads/SCP-096.mcaddon        both packs, one tap to install
  downloads/SCP-096_BP.mcpack      behavior pack only
  downloads/SCP-096_RP.mcpack      resource pack only

Zip entries are written with a fixed timestamp so rebuilding an unchanged
addon produces a byte-identical file (no pointless git churn).
"""

import json
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADDON = os.path.join(ROOT, "addon")
OUT = os.path.join(ROOT, "downloads")
PACKS = ["SCP096_BP", "SCP096_RP"]
FIXED_DATE = (2024, 1, 1, 0, 0, 0)
SKIP = {".DS_Store", "Thumbs.db"}


def files_in(pack):
    base = os.path.join(ADDON, pack)
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames.sort()
        for name in sorted(filenames):
            if name in SKIP:
                continue
            full = os.path.join(dirpath, name)
            yield full, os.path.relpath(full, base).replace(os.sep, "/")


def add(zf, source, arcname):
    info = zipfile.ZipInfo(arcname, date_time=FIXED_DATE)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    with open(source, "rb") as fh:
        zf.writestr(info, fh.read())


def validate():
    """Fail loudly on malformed JSON before shipping a broken pack."""
    ok = True
    for pack in PACKS:
        for full, rel in files_in(pack):
            if rel.endswith(".json"):
                try:
                    with open(full, encoding="utf-8") as fh:
                        json.load(fh)
                except ValueError as exc:
                    ok = False
                    print("INVALID JSON: %s/%s -> %s" % (pack, rel, exc))
        if not os.path.exists(os.path.join(ADDON, pack, "manifest.json")):
            ok = False
            print("MISSING manifest.json in %s" % pack)
    if not ok:
        raise SystemExit(1)


def build():
    validate()
    os.makedirs(OUT, exist_ok=True)

    addon_path = os.path.join(OUT, "SCP-096.mcaddon")
    with zipfile.ZipFile(addon_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in PACKS:
            for full, rel in files_in(pack):
                add(zf, full, "%s/%s" % (pack, rel))
    print("built %s (%d bytes)" % (os.path.relpath(addon_path, ROOT), os.path.getsize(addon_path)))

    for pack, out_name in ((PACKS[0], "SCP-096_BP.mcpack"), (PACKS[1], "SCP-096_RP.mcpack")):
        path = os.path.join(OUT, out_name)
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
            for full, rel in files_in(pack):
                add(zf, full, rel)
        print("built %s (%d bytes)" % (os.path.relpath(path, ROOT), os.path.getsize(path)))


if __name__ == "__main__":
    build()
