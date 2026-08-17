#!/usr/bin/env python3
"""Package the two packs into dist/Lost_Island_Abandoned.mcaddon.

A .mcaddon is a plain ZIP whose ROOT contains one folder per pack. Getting this
shape wrong is the usual reason an add-on will not import on Android, so the
archive is re-opened and verified after writing.
"""
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
DIST = os.path.join(ROOT, "dist")
NAME = "Lost_Island_Abandoned.mcaddon"
PACKS = ("Lost_Island_BP", "Lost_Island_RP")

SKIP_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}
SKIP_EXT = {".py", ".pyc", ".zip", ".mcpack", ".mcaddon", ".md"}


def collect():
    files = []
    for pack in PACKS:
        base = os.path.join(BUILD, pack)
        if not os.path.isdir(base):
            sys.exit("missing pack directory: %s" % base)
        for d, subs, names in os.walk(base):
            subs[:] = sorted(s for s in subs if s != "__pycache__")
            for n in sorted(names):
                if n in SKIP_NAMES:
                    continue
                if os.path.splitext(n)[1].lower() in SKIP_EXT:
                    continue
                full = os.path.join(d, n)
                arc = os.path.relpath(full, BUILD).replace(os.sep, "/")
                files.append((full, arc))
    return files


def verify(path, expected):
    with zipfile.ZipFile(path) as z:
        bad = z.testzip()
        if bad:
            sys.exit("corrupt entry in archive: %s" % bad)
        names = z.namelist()
        if len(names) != expected:
            sys.exit("archive has %d entries, expected %d"
                     % (len(names), expected))
        for n in names:
            if not n.startswith(PACKS):
                sys.exit("entry outside a pack folder: %s" % n)
            if n.lower().endswith((".zip", ".mcpack", ".mcaddon")):
                sys.exit("nested archive found: %s" % n)
            if n.startswith("/") or ".." in n.split("/"):
                sys.exit("unsafe path in archive: %s" % n)
        for pack in PACKS:
            man = pack + "/manifest.json"
            if man not in names:
                sys.exit("missing %s at the archive root level" % man)
            # manifest must be exactly one level deep
            if man.count("/") != 1:
                sys.exit("manifest nested too deeply: %s" % man)
        for pack in PACKS:
            if pack + "/pack_icon.png" not in names:
                sys.exit("missing %s/pack_icon.png" % pack)
    return True


def main():
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, NAME)
    if os.path.exists(out):
        os.remove(out)
    files = collect()
    # deterministic order, fixed timestamps -> reproducible archive
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED,
                         compresslevel=9) as z:
        for full, arc in files:
            zi = zipfile.ZipInfo(arc, date_time=(2024, 5, 21, 12, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            with open(full, "rb") as f:
                z.writestr(zi, f.read())

    verify(out, len(files))
    size = os.path.getsize(out)
    assert out.endswith(".mcaddon") and not out.endswith(".mcaddon.zip")

    per_pack = {}
    for _f, arc in files:
        per_pack.setdefault(arc.split("/")[0], 0)
        per_pack[arc.split("/")[0]] += 1

    print("=" * 66)
    print("packaged: dist/%s" % NAME)
    print("=" * 66)
    for pack, n in sorted(per_pack.items()):
        print("  %-20s %4d files" % (pack, n))
    print("  %-20s %4d files" % ("total", len(files)))
    print("  %-20s %.2f MB" % ("archive size", size / 1048576.0))
    print("  verified: root-level pack folders, both manifests, no nesting")


if __name__ == "__main__":
    main()
