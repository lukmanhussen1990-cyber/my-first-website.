#!/usr/bin/env python3
"""
The Hollow Bride - packager.

Zips BP/ and RP/ into dist/hollow_bride.mcaddon (and, with --mcworld, an
importable world stub layout description). Run make_textures.py first so the
PNGs exist.

Usage:
    python3 tools/build_mcaddon.py
    python3 tools/build_mcaddon.py --out dist/my_name.mcaddon
"""

import argparse
import os
import zipfile

SKIP_NAMES = {".DS_Store", "Thumbs.db"}
SKIP_DIRS = {"__pycache__", ".git"}


def add_tree(zf, root, arc_prefix):
    total = 0
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in sorted(files):
            if name in SKIP_NAMES:
                continue
            full = os.path.join(base, name)
            rel = os.path.relpath(full, root)
            zf.write(full, os.path.join(arc_prefix, rel).replace(os.sep, "/"))
            total += os.path.getsize(full)
    return total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".", help="directory holding BP/ and RP/")
    ap.add_argument("--out", default="dist/hollow_bride.mcaddon")
    args = ap.parse_args()

    bp = os.path.join(args.root, "BP")
    rp = os.path.join(args.root, "RP")
    for d in (bp, rp):
        if not os.path.isdir(d):
            raise SystemExit("missing directory: " + d)

    out_dir = os.path.dirname(args.out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    with zipfile.ZipFile(args.out, "w", zipfile.ZIP_DEFLATED) as zf:
        bp_bytes = add_tree(zf, bp, "hollow_bride_BP")
        rp_bytes = add_tree(zf, rp, "hollow_bride_RP")

    size = os.path.getsize(args.out)
    print("packed %s" % args.out)
    print("  behaviour pack raw: %.2f MB" % (bp_bytes / 1048576.0))
    print("  resource pack raw:  %.2f MB" % (rp_bytes / 1048576.0))
    print("  archive:            %.2f MB" % (size / 1048576.0))
    if rp_bytes > 20 * 1048576:
        print("  WARNING: resource pack exceeds the 20 MB mobile budget")


if __name__ == "__main__":
    main()
