#!/usr/bin/env python3
"""Static checks for the generated pack and the packaged .mcaddon / .mcpack.

    python3 -I tools/validate.py --vanilla <bedrock-samples>/resource_pack

Exit code 1 if anything is wrong.  (Nothing here can replace testing in the game,
but it catches every class of mistake that makes Minecraft silently drop a pack.)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import uuid
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from PIL import Image
from common import PACK_DIR, ROOT, load_json_lenient, env_vanilla

HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
errors: list[str] = []
warnings: list[str] = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def check_manifest(pack: Path):
    m = json.loads((pack / "manifest.json").read_text(encoding="utf-8"))
    assert m["format_version"] == 2
    h = m["header"]
    for k in ("name", "description", "uuid", "version", "min_engine_version"):
        if k not in h:
            err(f"manifest header missing {k}")
    ids = [h["uuid"]] + [mod["uuid"] for mod in m["modules"]]
    for i in ids:
        try:
            if str(uuid.UUID(i)) != i.lower():
                err(f"uuid not canonical: {i}")
        except ValueError:
            err(f"bad uuid {i}")
    if len(set(ids)) != len(ids):
        err("duplicate uuids in manifest")
    if h["version"] != m["modules"][0]["version"]:
        warn("header/module version differ")
    if h["min_engine_version"] != [1, 21, 0]:
        err("min_engine_version should be [1,21,0] for the 1.21.0.26 target")
    for sp in m.get("subpacks", []):
        d = pack / "subpacks" / sp["folder_name"]
        if not d.is_dir():
            err(f"subpack folder missing: {d}")
        if not isinstance(sp["memory_tier"], int):
            err("memory_tier must be an int")
        if len(sp["name"]) > 40:
            warn(f"subpack name long: {sp['name']}")
    return m


def check_json_tree(pack: Path):
    n = 0
    for f in pack.rglob("*.json"):
        n += 1
        try:
            json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            err(f"invalid JSON {f.relative_to(pack)}: {e}")
    return n


def check_fogs(root: Path, label: str, vanilla: Path):
    fog_ids = set()
    files = sorted((root / "fogs").glob("*.json"))
    for f in files:
        d = json.loads(f.read_text(encoding="utf-8"))
        if d.get("format_version") != "1.16.100":
            err(f"{label}/{f.name}: format_version")
        ident = d["minecraft:fog_settings"]["description"]["identifier"]
        if ":" not in ident:
            err(f"{label}/{f.name}: identifier needs a namespace")
        if ident in fog_ids:
            err(f"{label}: duplicate fog identifier {ident}")
        fog_ids.add(ident)
        for sect, v in d["minecraft:fog_settings"].get("distance", {}).items():
            objs = [v] + ([v["transition_fog"]["init_fog"]] if "transition_fog" in v else [])
            for o in objs:
                if not HEX.match(o["fog_color"]):
                    err(f"{label}/{f.name}:{sect} colour {o['fog_color']}")
                if o["fog_start"] > o["fog_end"]:
                    err(f"{label}/{f.name}:{sect} start>end")
                if o["render_distance_type"] not in ("fixed", "render"):
                    err(f"{label}/{f.name}:{sect} render_distance_type")
                if o["render_distance_type"] == "render" and o["fog_end"] > 1.0:
                    err(f"{label}/{f.name}:{sect} dynamic end > 1")
    # biomes_client references
    bc = json.loads((root / "biomes_client.json").read_text(encoding="utf-8"))["biomes"]
    vanilla_ids = set()
    for f in (vanilla / "fogs").glob("*.json"):
        vanilla_ids.add(load_json_lenient(f)["minecraft:fog_settings"]["description"]["identifier"])
    for b, v in bc.items():
        fid = v["fog_identifier"]
        if fid not in fog_ids and fid not in vanilla_ids:
            err(f"{label}: biome {b} -> unknown fog {fid}")
        if fid not in fog_ids:
            warn(f"{label}: biome {b} uses vanilla fog {fid} (not overridden)")
        if not HEX.match(v["water_surface_color"]):
            err(f"{label}: biome {b} water colour")
        if not (0.0 <= v["water_surface_transparency"] <= 1.0):
            err(f"{label}: biome {b} transparency")
    if "default" not in bc:
        err(f"{label}: biomes_client lacks default")
    return len(files), len(bc)


def image_size(p: Path):
    with Image.open(p) as im:
        im.load()
        return im.size, im.mode


def check_images(pack: Path, vanilla: Path):
    """Every texture that overrides a vanilla file must keep its exact size
    (atlas/flipbook/UV layouts depend on it)."""
    checked = 0
    new_ok = {"textures/ui/hg_vignette.png", "pack_icon.png"}
    seen = {}
    for f in sorted(pack.rglob("*")):
        if f.suffix.lower() not in (".png", ".tga"):
            continue
        rel = f.relative_to(pack).as_posix()
        key = re.sub(r"^subpacks/[^/]+/", "", rel)
        stem = re.sub(r"\.(png|tga)$", "", rel, flags=re.I)
        if stem in seen and seen[stem] != f.suffix.lower():
            twin = [(vanilla / (re.sub(r"^subpacks/[^/]+/", "", stem) + e)).exists() for e in (".png", ".tga")]
            if all(twin):
                warn(f"both .png and .tga for {stem} (vanilla ships both too)")
            else:
                err(f"both .png and .tga for {stem}")
        seen[stem] = f.suffix.lower()
        try:
            size, mode = image_size(f)
        except Exception as e:  # noqa: BLE001
            err(f"unreadable image {rel}: {e}")
            continue
        checked += 1
        if key in new_ok:
            continue
        vp = vanilla / key
        if not vp.exists():
            # same stem, other extension?
            alt = [vanilla / (re.sub(r"\.(png|tga)$", "", key, flags=re.I) + e) for e in (".png", ".tga")]
            alt = [a for a in alt if a.exists()]
            if not alt:
                warn(f"no vanilla counterpart for {rel}")
                continue
            vp = alt[0]
            err(f"extension differs from vanilla for {rel} (vanilla has {vp.name})")
        vsize, vmode = image_size(vp)
        if vsize != size:
            err(f"size mismatch {rel}: pack {size} vs vanilla {vsize}")
        if ("A" in vmode) != ("A" in mode) and key.endswith(".png") and vmode != "P":
            warn(f"alpha channel differs {rel}: {vmode} -> {mode}")
    return checked


def check_zip(path: Path, expect_prefix: str):
    with zipfile.ZipFile(path) as zf:
        bad = zf.testzip()
        if bad:
            err(f"{path.name}: corrupt member {bad}")
        names = zf.namelist()
        if any("\\" in n or n.startswith("/") or ".." in n.split("/") for n in names):
            err(f"{path.name}: bad member path")
        if f"{expect_prefix}manifest.json" not in names:
            err(f"{path.name}: {expect_prefix}manifest.json missing")
        top = {n.split("/")[0] for n in names}
        if expect_prefix and top != {expect_prefix.rstrip("/")}:
            err(f"{path.name}: unexpected top-level entries {top}")
        longest = max(len(n) for n in names)
        total = sum(i.file_size for i in zf.infolist())
        return len(names), longest, total


def check_ui(root: Path):
    f = root / "ui" / "hud_screen.json"
    if not f.exists():
        return False
    d = json.loads(f.read_text(encoding="utf-8"))
    assert d["namespace"] == "hud"
    mod = d["root_panel"]["modifications"][0]
    assert mod["array_name"] == "controls" and mod["operation"] == "insert_front"
    ref = list(mod["value"][0])[0]
    assert ref == "hg_vignette@hud.hg_vignette", ref
    tex = d["hg_vignette"]["texture"]
    if not (root / (tex + ".png")).exists():
        err(f"HUD overlay texture missing: {tex}")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vanilla")
    args = ap.parse_args()
    vanilla = env_vanilla(args.vanilla)
    pack = PACK_DIR
    m = check_manifest(pack)
    n_json = check_json_tree(pack)
    print(f"manifest ok; {n_json} json files parse")
    for label, root in [("base", pack)] + [(sp["folder_name"], pack / "subpacks" / sp["folder_name"]) for sp in m["subpacks"]]:
        nf, nb = check_fogs(root, label, vanilla)
        has_ui = check_ui(root)
        print(f"{label:9s}: {nf} fogs, {nb} biome entries, hud overlay: {has_ui}")
    n_img = check_images(pack, vanilla)
    print(f"{n_img} images checked against vanilla sizes")
    dist = ROOT / "dist"
    for z, pre in sorted([(p, f"{PACK_DIR.name}/") for p in dist.glob("*.mcaddon")] + [(p, "") for p in dist.glob("*.mcpack")]):
        n, longest, total = check_zip(z, pre)
        print(f"{z.name}: {n} entries, longest path {longest}, {total / 1024:.0f} KiB unpacked")
    for w in warnings[:40]:
        print("WARN ", w)
    if len(warnings) > 40:
        print(f"... {len(warnings) - 40} more warnings")
    for e in errors:
        print("ERROR", e)
    print(f"{len(errors)} errors, {len(warnings)} warnings")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
