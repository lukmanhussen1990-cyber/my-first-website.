#!/usr/bin/env python3
"""Validate and package the Cursed Eyeball Guardian add-on.

Run from the add-on root (cursed-eyeball-guardian/):

    python3 tools/build.py                 # validate, then write dist/
    python3 tools/build.py --strict        # validation warnings also block the build
    python3 tools/build.py --dry-run       # validate + build + verify in a temp dir, leave dist/ alone
    python3 tools/build.py --out DIR       # write somewhere else

Outputs (deterministic: sorted entries, fixed timestamps/permissions):
    dist/Cursed_Eyeball_Guardian.mcaddon     zip root = Cursed_Eyeball_Guardian_BP/ + Cursed_Eyeball_Guardian_RP/
    dist/Cursed_Eyeball_Guardian_BP.mcpack   behaviour pack contents at the zip root
    dist/Cursed_Eyeball_Guardian_RP.mcpack   resource pack contents at the zip root

Dev/junk files (.DS_Store, __pycache__, *.py, *.ts, *.md, tools/, tests/, node_modules/, dotfiles ...)
are never packaged.  Exit status: 0 ok, 1 validation or packaging failure, 2 usage error.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import shutil
import sys
import tempfile
import zipfile
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import validate  # noqa: E402  (same folder)

ROOT = validate.ROOT
ADDON_NAME = "Cursed_Eyeball_Guardian"
FIXED_DATE = (2024, 6, 11, 0, 0, 0)       # Bedrock 1.21.0 release day; any constant keeps zips reproducible
FILE_ATTR = (0o100644 << 16)
DIR_ATTR = (0o040755 << 16) | 0x10
MOBILE_BUDGET = 10 * 1024 * 1024


def is_excluded(name, is_dir):
    if name.startswith("."):
        return True
    if is_dir:
        return name in validate.JUNK_DIRS
    ext = os.path.splitext(name)[1].lower()
    return name in validate.JUNK_NAMES or ext in validate.JUNK_EXT or name.endswith("~")


def collect(pack_dir):
    """Return (sorted relative file paths, sorted relative dirs, skipped paths)."""
    files, dirs, skipped = [], [], []
    for dp, dns, fns in os.walk(pack_dir):
        keep = []
        for d in sorted(dns):
            rel = os.path.relpath(os.path.join(dp, d), pack_dir).replace(os.sep, "/")
            if is_excluded(d, True):
                skipped.append(rel + "/")
            else:
                keep.append(d)
                dirs.append(rel)
        dns[:] = keep
        for fn in sorted(fns):
            rel = os.path.relpath(os.path.join(dp, fn), pack_dir).replace(os.sep, "/")
            full = os.path.join(dp, fn)
            if is_excluded(fn, False) or os.path.islink(full):
                skipped.append(rel)
            else:
                files.append(rel)
    # drop directories that ended up empty after exclusions
    used = set()
    for f in files:
        parts = f.split("/")[:-1]
        for i in range(1, len(parts) + 1):
            used.add("/".join(parts[:i]))
    dirs = [d for d in dirs if d in used]
    return files, dirs, skipped


def _sort_key(arc):
    return arc.rstrip("/").split("/")


def zip_bytes(entries):
    """entries: list of (arcname, source path or None for a directory).  Returns zip bytes."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", allowZip64=False) as zf:
        for arc, src in sorted(entries, key=lambda e: _sort_key(e[0])):
            if src is None:
                zi = zipfile.ZipInfo(arc.rstrip("/") + "/", FIXED_DATE)
                zi.create_system = 3
                zi.external_attr = DIR_ATTR
                zi.compress_type = zipfile.ZIP_STORED
                zf.writestr(zi, b"")
                continue
            with open(src, "rb") as f:
                data = f.read()
            zi = zipfile.ZipInfo(arc, FIXED_DATE)
            zi.create_system = 3
            zi.external_attr = FILE_ATTR
            co = zlib.compressobj(9, zlib.DEFLATED, -15)
            deflated = len(co.compress(data) + co.flush())
            zi.compress_type = zipfile.ZIP_DEFLATED if deflated < len(data) else zipfile.ZIP_STORED
            zf.writestr(zi, data, compresslevel=9 if zi.compress_type == zipfile.ZIP_DEFLATED else None)
    return buf.getvalue()


def pack_entries(pack_dir, prefix=""):
    files, dirs, skipped = collect(pack_dir)
    entries = [((prefix + d + "/"), None) for d in dirs]
    entries += [(prefix + f, os.path.join(pack_dir, f)) for f in files]
    if prefix:
        entries.append((prefix, None))
    return entries, files, skipped


def verify_zip(data, expected, label):
    """expected: {arcname: source path or None}.  Returns list of problems."""
    probs = []
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as e:
        return ["%s: not a valid zip (%s)" % (label, e)]
    with zf:
        bad = zf.testzip()
        if bad:
            probs.append("%s: CRC error in %s" % (label, bad))
        names = zf.namelist()
        if len(names) != len(set(names)):
            probs.append("%s: duplicate entries" % label)
        want = {k.rstrip("/") + ("/" if v is None else ""): v for k, v in expected.items()}
        if set(names) != set(want):
            missing = sorted(set(want) - set(names))[:5]
            extra = sorted(set(names) - set(want))[:5]
            probs.append("%s: entry mismatch (missing %s, extra %s)" % (label, missing, extra))
        for n in names:
            info = zf.getinfo(n)
            if info.date_time != FIXED_DATE:
                probs.append("%s: %s has a non-fixed timestamp" % (label, n))
            if n.startswith("/") or ".." in n.split("/") or "\\" in n:
                probs.append("%s: unsafe entry name %s" % (label, n))
            src = want.get(n)
            if src:
                with open(src, "rb") as f:
                    if zlib.crc32(f.read()) & 0xFFFFFFFF != info.CRC:
                        probs.append("%s: %s differs from %s" % (label, n, src))
        manifests = [n for n in names if n.endswith("manifest.json") and n.count("/") <= 1]
        if not manifests:
            probs.append("%s: no manifest.json at the expected depth" % label)
        for m in manifests:
            try:
                json.loads(zf.read(m).decode("utf-8"))
            except ValueError as e:
                probs.append("%s: %s does not parse (%s)" % (label, m, e))
    return probs


def human(n):
    for unit in ("B", "KB", "MB"):
        if n < 1024 or unit == "MB":
            return ("%d %s" % (n, unit)) if unit == "B" else ("%.1f %s" % (n, unit))
        n /= 1024.0
    return str(n)


def category(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in (".png", ".tga", ".jpg", ".jpeg"):
        return "textures"
    if ext in (".ogg", ".wav", ".fsb"):
        return "sounds"
    if ext == ".js":
        return "scripts"
    if ext == ".json":
        return "json"
    if ext == ".lang":
        return "lang"
    return "other"


def size_summary(packs, outputs):
    lines = ["", "Package contents"]
    lines.append("  %-30s %6s %11s %11s" % ("pack", "files", "raw", "zipped"))
    cats = {}
    largest = []
    for name, (files, root, zdata) in packs.items():
        raw = 0
        for f in files:
            sz = os.path.getsize(os.path.join(root, f))
            raw += sz
            c = cats.setdefault(category(f), [0, 0])
            c[0] += 1
            c[1] += sz
            largest.append((sz, "%s/%s" % (name.rsplit("_", 1)[-1], f)))
        lines.append("  %-30s %6d %11s %11s" % (name, len(files), human(raw), human(len(zdata))))
    lines.append("  by type: " + ", ".join("%s %d (%s)" % (k, v[0], human(v[1])) for k, v in sorted(cats.items())))
    lines.append("  largest: " + ", ".join("%s %s" % (p, human(s)) for s, p in sorted(largest, reverse=True)[:5]))
    lines.append("")
    lines.append("Outputs")
    for path, data in outputs:
        rel = os.path.relpath(path, os.getcwd())
        shown = rel if not rel.startswith("..") else path
        lines.append("  %-44s %10s bytes  sha256 %s" % (shown, "{:,}".format(len(data)),
                                                        hashlib.sha256(data).hexdigest()[:16]))
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument("--bp", default=validate.DEFAULT_BP)
    ap.add_argument("--rp", default=validate.DEFAULT_RP)
    ap.add_argument("--out", default=os.path.join(ROOT, "dist"))
    ap.add_argument("--ref", default=None, help="reference folder for validate.py")
    ap.add_argument("--strict", action="store_true", help="treat validation warnings as errors")
    ap.add_argument("--no-spec", action="store_true", help="skip the SPEC.md contract checks")
    ap.add_argument("--dry-run", action="store_true", help="build + verify in a temp dir only")
    ap.add_argument("-v", "--verbose", action="store_true", help="full validation report incl. info lines")
    args = ap.parse_args(argv)

    bp, rp = os.path.abspath(args.bp), os.path.abspath(args.rp)
    for p in (bp, rp):
        if not os.path.isdir(p):
            print("build: pack folder not found: %s" % p, file=sys.stderr)
            return 2

    # 1. validate ---------------------------------------------------------------
    print("== Validating ==")
    report = validate.run(bp, rp, args.ref, spec=not args.no_spec)
    report.print(sys.stdout, verbose=args.verbose, color=sys.stdout.isatty())
    ne, nw = report.count("error"), report.count("warning")
    print("Validation: %d error(s), %d warning(s)" % (ne, nw))
    if ne or (args.strict and nw):
        print("\nBUILD ABORTED - fix the %s above (dist/ was not touched)."
              % ("errors" if ne else "warnings (--strict)"), file=sys.stderr)
        return 1

    # 2. package ----------------------------------------------------------------
    print("\n== Packaging ==")
    bp_name, rp_name = ADDON_NAME + "_BP", ADDON_NAME + "_RP"
    plan = {}
    skipped_all = []
    for name, root in ((bp_name, bp), (rp_name, rp)):
        entries_root, files, skipped = pack_entries(root)
        entries_pref, _, _ = pack_entries(root, name + "/")
        plan[name] = (root, files, entries_root, entries_pref)
        skipped_all += ["%s/%s" % (name, s) for s in skipped]
    if skipped_all:
        print("left out (dev/junk): " + ", ".join(skipped_all))

    outputs = []
    addon_entries = plan[bp_name][3] + plan[rp_name][3]
    addon = zip_bytes(addon_entries)
    outputs.append((ADDON_NAME + ".mcaddon", addon, addon_entries))
    packs_summary = {}
    for name in (bp_name, rp_name):
        root, files, entries_root, _ = plan[name]
        data = zip_bytes(entries_root)
        outputs.append((name + ".mcpack", data, entries_root))
        packs_summary[name] = (files, root, data)

    # 3. verify (before anything is written) -----------------------------------
    problems = []
    for fname, data, entries in outputs:
        problems += verify_zip(data, dict(entries), fname)
        if zip_bytes(entries) != data:
            problems.append("%s: packaging is not deterministic" % fname)
    with zipfile.ZipFile(io.BytesIO(addon)) as zf:
        tops = sorted({n.split("/")[0] for n in zf.namelist()})
        if tops != [bp_name, rp_name]:
            problems.append("mcaddon top level is %r, expected [%s, %s]" % (tops, bp_name, rp_name))
        for name in (bp_name, rp_name):
            if name + "/manifest.json" not in zf.namelist():
                problems.append("mcaddon lacks %s/manifest.json" % name)
    for name in (bp_name, rp_name):
        with zipfile.ZipFile(io.BytesIO(packs_summary[name][2])) as zf:
            if "manifest.json" not in zf.namelist():
                problems.append("%s.mcpack lacks manifest.json at its root" % name)
    if problems:
        for p in problems:
            print("PACKAGING ERROR: " + p, file=sys.stderr)
        return 1

    # 4. write ------------------------------------------------------------------
    out_dir = tempfile.mkdtemp(prefix="ceg_build_") if args.dry_run else os.path.abspath(args.out)
    os.makedirs(out_dir, exist_ok=True)
    written = []
    try:
        for fname, data, _ in outputs:
            path = os.path.join(out_dir, fname)
            tmp = path + ".tmp"
            with open(tmp, "wb") as f:
                f.write(data)
            os.replace(tmp, path)
            with open(path, "rb") as f:
                if f.read() != data:
                    print("PACKAGING ERROR: %s did not read back identically" % path, file=sys.stderr)
                    return 1
            written.append((path, data))
        print(size_summary(packs_summary, written))
        if len(addon) > MOBILE_BUDGET:
            print("\nWARNING: the .mcaddon is %s - large for a mobile import" % human(len(addon)))
    finally:
        if args.dry_run:
            shutil.rmtree(out_dir, ignore_errors=True)
    print("\nBUILD OK%s - %d warning(s)." % (" (dry run, nothing written)" if args.dry_run else "", nw))
    return 0


if __name__ == "__main__":
    sys.exit(main())
