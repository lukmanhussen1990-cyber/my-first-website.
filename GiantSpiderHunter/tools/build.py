#!/usr/bin/env python3
"""Package Giant Spider Hunter.

Creates:
  dist/GiantSpiderHunter_BP.mcpack   (behavior pack, manifest at archive root)
  dist/GiantSpiderHunter_RP.mcpack   (resource pack, manifest at archive root)
  dist/GiantSpiderHunter.mcaddon     (both .mcpack files)
  dist/GiantSpiderHunter-source.zip  (editable source: packs, tools, docs, README)

Usage:  python3 tools/build.py            (run from anywhere)
"""
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKS = os.path.join(ROOT, "packs")
DIST = os.path.join(ROOT, "dist")

# Files never shipped inside the packs or the source archive.
SKIP_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}
SKIP_DIRS = {"__pycache__", "node_modules", ".git", "proof", "runs", "out"}
# Fixed timestamp so rebuilding identical sources gives identical archives.
FIXED_TIME = (2024, 5, 15, 12, 0, 0)


def iter_files(base):
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for name in sorted(filenames):
            if name in SKIP_NAMES or name.endswith((".pyc", ".tmp", ".bak")):
                continue
            yield os.path.join(dirpath, name)


def add_file(zf, path, arcname):
    info = zipfile.ZipInfo(arcname.replace(os.sep, "/"), FIXED_TIME)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    with open(path, "rb") as fh:
        zf.writestr(info, fh.read())


def zip_dir(src_dir, out_path, prefix=""):
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in iter_files(src_dir):
            rel = os.path.relpath(path, src_dir)
            add_file(zf, path, os.path.join(prefix, rel) if prefix else rel)


def main():
    os.makedirs(DIST, exist_ok=True)
    bp_dir = os.path.join(PACKS, "GiantSpiderHunter_BP")
    rp_dir = os.path.join(PACKS, "GiantSpiderHunter_RP")
    for d in (bp_dir, rp_dir):
        if not os.path.isfile(os.path.join(d, "manifest.json")):
            sys.exit(f"missing manifest: {d}")

    bp_pack = os.path.join(DIST, "GiantSpiderHunter_BP.mcpack")
    rp_pack = os.path.join(DIST, "GiantSpiderHunter_RP.mcpack")
    zip_dir(bp_dir, bp_pack)
    zip_dir(rp_dir, rp_pack)

    addon = os.path.join(DIST, "GiantSpiderHunter.mcaddon")
    with zipfile.ZipFile(addon, "w", zipfile.ZIP_DEFLATED) as zf:
        add_file(zf, bp_pack, "GiantSpiderHunter_BP.mcpack")
        add_file(zf, rp_pack, "GiantSpiderHunter_RP.mcpack")

    source = os.path.join(DIST, "GiantSpiderHunter-source.zip")
    with zipfile.ZipFile(source, "w", zipfile.ZIP_DEFLATED) as zf:
        for top in ("README.md", "packs", "tools", "docs"):
            p = os.path.join(ROOT, top)
            if os.path.isfile(p):
                add_file(zf, p, os.path.join("GiantSpiderHunter", top))
            elif os.path.isdir(p):
                for path in iter_files(p):
                    rel = os.path.relpath(path, ROOT)
                    add_file(zf, path, os.path.join("GiantSpiderHunter", rel))

    for p in (bp_pack, rp_pack, addon, source):
        print(f"{os.path.relpath(p, ROOT):40s} {os.path.getsize(p):>10,d} bytes")


if __name__ == "__main__":
    main()
