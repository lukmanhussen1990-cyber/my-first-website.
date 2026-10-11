"""Packs ChaseCam_BP + ChaseCam_RP into dist/ChaseCam.mcaddon.

Run from anywhere:  python3 build.py
Checks that every .json file parses first, so a typo can't ship.
"""
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent
PACKS = ["ChaseCam_BP", "ChaseCam_RP"]
OUT = ROOT / "dist" / "ChaseCam.mcaddon"
# Fixed timestamp so rebuilding unchanged files gives an identical file.
STAMP = (2024, 6, 1, 0, 0, 0)

files = sorted(p for pack in PACKS for p in (ROOT / pack).rglob("*") if p.is_file())
for path in files:
    if path.suffix == ".json":
        json.loads(path.read_text(encoding="utf-8"))

OUT.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
    for path in files:
        info = zipfile.ZipInfo(path.relative_to(ROOT).as_posix(), STAMP)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        zf.writestr(info, path.read_bytes())

print(f"Built {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB, {len(files)} files)")
