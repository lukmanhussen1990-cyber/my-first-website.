#!/usr/bin/env python3
"""Build the Horizon Glow resource pack and package .mcaddon / .mcpack files.

    python3 -I tools/build.py --vanilla /path/to/bedrock-samples/resource_pack

The vanilla pack (Mojang's public bedrock-samples, tag v1.21.0.26-preview) is only
*read* as the source for derived textures / fog tables; it is never copied verbatim.
"""
from __future__ import annotations

import argparse
import shutil
import sys
import time
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np

from common import PACK_DIR, ROOT, PRESETS, write_json, env_vanilla, read_rgba
import gen_atmosphere, gen_sky, gen_water, gen_ui, gen_ambient, gen_consistency

try:
    import gen_textures
except ImportError:                       # textures pass is optional while developing
    gen_textures = None

# Stable identifiers => re-importing a newer build replaces the old one.
RP_UUID = "9d1b6c4e-5a3f-4e0b-8c27-71f0a4b2d3e5"
RP_MODULE_UUID = "2f8e0a7b-6c14-49d2-b5a3-0e9d7c1f4a68"
VERSION = [1, 1, 2]

# Short names: the game prints them under the pack-settings slider on a narrow phone screen.
SUBPACKS = [
    {"folder_name": "lite",     "name": "Lite",     "memory_tier": 1},
    {"folder_name": "standard", "name": "Standard", "memory_tier": 2},
    {"folder_name": "ultra",    "name": "Ultra",    "memory_tier": 3},
]


def manifest():
    return {
        "format_version": 2,
        "header": {
            "name": "§bHorizon Glow§r Graphics",
            "description": "§7Shader-style look for Minecraft 1.21.0.x (mobile): haze, glowing sun & moon, soft clouds, vivid water. "
                           "Tap the gear on this pack to choose Lite / Standard / Ultra.",
            "uuid": RP_UUID,
            "version": VERSION,
            "min_engine_version": [1, 21, 0],
        },
        "modules": [
            {"description": "Horizon Glow resources", "type": "resources", "uuid": RP_MODULE_UUID, "version": VERSION}
        ],
        "subpacks": SUBPACKS,
        "metadata": {
            "authors": ["Horizon Glow (generated with Claude Code)"],
            "license": "Personal use. Contains modified derivatives of Minecraft assets (c) Mojang AB; not affiliated with Mojang or Microsoft.",
            "generated_with": {"horizon_glow_build": [".".join(map(str, VERSION))]},
        },
    }


def prune_unchanged(vanilla: Path, pack: Path):
    """Delete textures whose pixels equal Mojang's own file.  A re-encoded copy changes nothing
    on screen, but it would still ship Mojang's art verbatim and pin that file to this game
    version.  A file is kept when the pack also holds its other-extension twin (.png/.tga),
    because which twin wins is decided by the engine, not by us."""
    removed = []
    for f in sorted((pack / "textures").rglob("*")):
        if f.suffix.lower() not in (".png", ".tga"):
            continue
        rel = f.relative_to(pack)
        vp = vanilla / rel
        if not vp.exists():
            continue
        if any(f.with_suffix(e).exists() for e in (".png", ".tga") if e != f.suffix.lower()):
            continue
        if np.array_equal(read_rgba(f), read_rgba(vp)):
            f.unlink()
            removed.append(rel.as_posix())
    return removed


def build_pack(vanilla: Path, verbose=True):
    t0 = time.time()
    if PACK_DIR.exists():
        shutil.rmtree(PACK_DIR)
    PACK_DIR.mkdir(parents=True)

    def log(msg):
        if verbose:
            print(f"[{time.time() - t0:6.1f}s] {msg}", flush=True)

    # ---- base pack == "Standard"
    log("base: atmosphere (fog / water colours / colormaps)")
    gen_atmosphere.generate(vanilla, PACK_DIR, "standard")
    log("base: sky bodies + weather + clouds")
    gen_sky.generate(vanilla, PACK_DIR, "standard")
    log("base: animated water")
    gen_water.generate(vanilla, PACK_DIR)
    if gen_textures is not None:
        log("base: texture grading")
        gen_textures.generate(vanilla, PACK_DIR, log=log)
        log("base: consistency pass (mobs, armour, particle sprites)")
        gen_consistency.generate(vanilla, PACK_DIR, log=log)
        dropped = prune_unchanged(vanilla, PACK_DIR)
        log(f"base: dropped {len(dropped)} texture(s) that came out pixel-identical to vanilla: {', '.join(dropped) or '-'}")
    gen_ui.write_icon(PACK_DIR)
    write_json(PACK_DIR / "manifest.json", manifest())

    # ---- presets (subpacks): only the things that differ
    for preset in PRESETS:
        sp = PACK_DIR / "subpacks" / preset
        log(f"subpack {preset}")
        gen_atmosphere.generate(vanilla, sp, preset, own_fogs=(preset != "standard"))
        gen_sky.generate(vanilla, sp, preset)
        if preset == "ultra":
            gen_ui.write_overlay(sp)
    log("pack tree done")

    # ---- optional second pack (separate on purpose, see gen_ambient.py)
    amb = ROOT / "pack" / gen_ambient.AMBIENT_RP_NAME
    if amb.exists():
        shutil.rmtree(amb)
    gen_ambient.generate(vanilla, amb)
    log("ambient FX pack done")


def _zip_dir(zf: zipfile.ZipFile, src: Path, arc_prefix: str):
    for f in sorted(src.rglob("*")):
        if f.is_file():
            zf.write(f, f"{arc_prefix}{f.relative_to(src).as_posix()}")


def package(dist: Path):
    dist.mkdir(parents=True, exist_ok=True)
    for old in dist.glob("*"):
        old.unlink()
    amb_dir = ROOT / "pack" / gen_ambient.AMBIENT_RP_NAME
    out = {
        # .mcaddon = zip containing the pack folder(s); the game imports every pack inside
        "main_addon": dist / "HorizonGlow_Graphics_1.21.0.mcaddon",
        "full_addon": dist / "HorizonGlow_Graphics_and_AmbientFX_1.21.0.mcaddon",
        # .mcpack = pack contents directly at the zip root
        "main_pack": dist / "HorizonGlow_Graphics_1.21.0.mcpack",
        "ambient_pack": dist / "HorizonGlow_AmbientFX_OPTIONAL_1.21.0.x.mcpack",
    }
    with zipfile.ZipFile(out["main_addon"], "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        _zip_dir(zf, PACK_DIR, f"{PACK_DIR.name}/")
    with zipfile.ZipFile(out["full_addon"], "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        _zip_dir(zf, PACK_DIR, f"{PACK_DIR.name}/")
        _zip_dir(zf, amb_dir, f"{amb_dir.name}/")
    with zipfile.ZipFile(out["main_pack"], "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        _zip_dir(zf, PACK_DIR, "")
    with zipfile.ZipFile(out["ambient_pack"], "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        _zip_dir(zf, amb_dir, "")
    return list(out.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vanilla", help="path to bedrock-samples/resource_pack (or set VANILLA_RP)")
    ap.add_argument("--no-package", action="store_true")
    ap.add_argument("-q", "--quiet", action="store_true")
    args = ap.parse_args()
    vanilla = env_vanilla(args.vanilla)
    build_pack(vanilla, verbose=not args.quiet)
    if not args.no_package:
        for f in package(ROOT / "dist"):
            print(f"packaged {f.relative_to(ROOT)}  {f.stat().st_size / 1024:.0f} KiB")


if __name__ == "__main__":
    main()
