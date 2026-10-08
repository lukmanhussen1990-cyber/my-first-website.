#!/usr/bin/env python3
"""Static checks for the generated pack and the packaged .mcaddon / .mcpack.

    python3 -I tools/validate.py --vanilla <bedrock-samples>/resource_pack

Exit code 1 if anything is wrong.  (Nothing here can replace testing in the game,
but it catches every class of mistake that makes Minecraft silently drop a pack.)
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
import uuid
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np
from PIL import Image
from common import PACK_DIR, ROOT, load_json_lenient, env_vanilla, read_rgba

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
        if len(sp["name"]) > 12:            # shown under the settings slider on a phone
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


def check_fogs(root: Path, label: str, vanilla: Path, extra_ids=frozenset()):
    fog_ids = set()
    files = sorted((root / "fogs").glob("*.json"))
    for f in files:
        d = json.loads(f.read_text(encoding="utf-8"))
        if d.get("format_version") != "1.16.100":
            err(f"{label}/{f.name}: format_version")
        ident = d["minecraft:fog_settings"]["description"]["identifier"]
        if ":" not in ident:
            err(f"{label}/{f.name}: identifier needs a namespace")
        if not ident.startswith("hg:"):
            err(f"{label}/{f.name}: fog identifier must be in our own namespace (vanilla fogs cannot be overwritten): {ident}")
        if not f.name.startswith("hg_"):
            err(f"{label}/{f.name}: fog file name should start with hg_ (never shadow a vanilla file)")
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
    vb = load_json_lenient(vanilla / "biomes_client.json")["biomes"]
    for b, v in bc.items():
        fid = v["fog_identifier"]
        if fid not in fog_ids and fid not in extra_ids:
            err(f"{label}: biome {b} -> fog {fid} is not defined by this pack")
        if v.get("fog_ids_to_merge") != [fid]:
            err(f"{label}: biome {b} fog_ids_to_merge should mirror fog_identifier")
        if v.get("inherit_from_prior_fog") is not False:
            err(f"{label}: biome {b} inherit_from_prior_fog should be false")
        if not HEX.match(v["water_surface_color"]):
            err(f"{label}: biome {b} water colour")
        if not (0.0 <= v["water_surface_transparency"] <= 1.0):
            err(f"{label}: biome {b} transparency")
    missing = sorted(set(vb) - set(bc))
    if missing:
        err(f"{label}: biomes_client lacks vanilla biome entries (would keep vanilla fog ids): {missing}")
    if "default" not in bc:
        err(f"{label}: biomes_client lacks default")
    if label != "base" and files:
        err(f"{label}: fog definitions must live in the base pack (a preset must not depend on the game loading fog files "
            f"out of a subpack folder); found {len(files)}")
    return len(files), len(bc), fog_ids, {v["fog_identifier"] for v in bc.values()}


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
        elif vp.suffix.lower() == f.suffix.lower() and rel == key:
            # base-pack file with exactly Mojang's pixels: redundant, and ships their art verbatim
            if np.array_equal(read_rgba(f), read_rgba(vp)):
                err(f"{rel} is pixel-identical to vanilla (build.prune_unchanged should have dropped it)")
        if ("A" in vmode) != ("A" in mode) and key.endswith(".png") and vmode != "P":
            warn(f"alpha channel differs {rel}: {vmode} -> {mode}")
    return checked


def check_zip(path: Path, expect_tops: list[str]):
    """expect_tops: pack folder names at the zip root ([""] => manifest.json directly at the root)."""
    with zipfile.ZipFile(path) as zf:
        bad = zf.testzip()
        if bad:
            err(f"{path.name}: corrupt member {bad}")
        names = zf.namelist()
        if any("\\" in n or n.startswith("/") or ".." in n.split("/") for n in names):
            err(f"{path.name}: bad member path")
        for top in expect_tops:
            prefix = f"{top}/" if top else ""
            if f"{prefix}manifest.json" not in names:
                err(f"{path.name}: {prefix}manifest.json missing")
        roots = {n.split("/")[0] for n in names}
        if expect_tops != [""] and roots != set(expect_tops):
            err(f"{path.name}: unexpected top-level entries {roots}")
        # content check straight from the archive (what the phone will actually unpack)
        for info in zf.infolist():
            if info.is_dir():
                continue
            data = zf.read(info)
            low = info.filename.lower()
            try:
                if low.endswith(".json"):
                    json.loads(data.decode("utf-8"))
                elif low.endswith((".png", ".tga")):
                    with Image.open(io.BytesIO(data)) as im:
                        im.load()
            except Exception as e:  # noqa: BLE001
                err(f"{path.name}: unreadable member {info.filename}: {e}")
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


def check_ambient(vanilla: Path, main_manifest: dict):
    amb = ROOT / "pack" / "HorizonGlow_AmbientFX_RP"
    if not amb.exists():
        warn("ambient FX pack missing")
        return
    m = json.loads((amb / "manifest.json").read_text(encoding="utf-8"))
    ids = {m["header"]["uuid"], m["modules"][0]["uuid"]}
    main_ids = {main_manifest["header"]["uuid"], main_manifest["modules"][0]["uuid"]}
    if len(ids) != 2 or ids & main_ids:
        err("ambient pack uuids must be unique and differ from the main pack")
    for f in amb.rglob("*.json"):
        json.loads(f.read_text(encoding="utf-8"))
    # the only change to Mojang's player entity may be our three additions
    van = load_json_lenient(vanilla / "entity" / "player.entity.json")
    new = json.loads((amb / "entity" / "player.entity.json").read_text(encoding="utf-8"))
    vd, nd = van["minecraft:client_entity"]["description"], new["minecraft:client_entity"]["description"]
    for k in vd:
        if k in ("animations", "scripts", "particle_effects"):
            continue
        if vd[k] != nd[k]:
            err(f"ambient player.entity.json: unexpected change in description.{k}")
    if {k: v for k, v in nd["animations"].items() if k != "hg_ambient"} != vd["animations"]:
        err("ambient player.entity.json: animations changed beyond hg_ambient")
    if {k: v for k, v in nd["scripts"].items() if k != "animate"} != {k: v for k, v in vd["scripts"].items() if k != "animate"}:
        err("ambient player.entity.json: scripts changed beyond animate")
    # particle references resolve
    pe = nd["particle_effects"]
    ids_defined = {json.loads(f.read_text(encoding="utf-8"))["particle_effect"]["description"]["identifier"]
                   for f in (amb / "particles").glob("*.json")}
    for short, ident in pe.items():
        if ident not in ids_defined:
            err(f"ambient: {short} -> {ident} has no particle file")
    anim = json.loads((amb / "animations" / "hg_ambient.animation.json").read_text(encoding="utf-8"))
    for kf in anim["animations"]["animation.hg.ambient"]["particle_effects"].values():
        if kf["effect"] not in pe:
            err(f"ambient animation uses unknown effect {kf['effect']}")
    print(f"ambient FX pack ok ({len(ids_defined)} particles)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vanilla")
    args = ap.parse_args()
    vanilla = env_vanilla(args.vanilla)
    pack = PACK_DIR
    m = check_manifest(pack)
    n_json = check_json_tree(pack)
    print(f"manifest ok; {n_json} json files parse")
    base_ids: set = set()
    seen_ids: dict = {}
    all_refs: set = set()
    for label, root in [("base", pack)] + [(sp["folder_name"], pack / "subpacks" / sp["folder_name"]) for sp in m["subpacks"]]:
        if not root.is_dir():
            err(f"{label}: folder {root} is missing")
            continue
        try:
            nf, nb, ids, refs = check_fogs(root, label, vanilla, extra_ids=base_ids if label != "base" else frozenset())
        except Exception as e:  # noqa: BLE001 - a broken file must be reported, not crash the whole validator
            err(f"{label}: could not check fogs/biomes_client: {type(e).__name__}: {e}")
            continue
        if label == "base":
            base_ids = set(ids)
        all_refs |= refs
        for i in ids:
            if i in seen_ids:
                err(f"fog identifier {i} defined in both '{seen_ids[i]}' and '{label}' (a first-wins registry would ignore one)")
            seen_ids[i] = label
        has_ui = check_ui(root)
        print(f"{label:9s}: {nf} fog definitions, {nb} biome entries, hud overlay: {has_ui}")
    unused = sorted(set(seen_ids) - all_refs)
    if unused:
        warn(f"fog definitions that no biomes_client.json (base or subpack) references: {unused}")
    n_img = check_images(pack, vanilla)
    print(f"{n_img} images checked against vanilla sizes")
    check_ambient(vanilla, m)
    dist = ROOT / "dist"
    expect = {
        "HorizonGlow_Graphics_1.21.0.mcaddon": [PACK_DIR.name],
        "HorizonGlow_Graphics_and_AmbientFX_1.21.0.mcaddon": [PACK_DIR.name, "HorizonGlow_AmbientFX_RP"],
        "HorizonGlow_Graphics_1.21.0.mcpack": [""],
        "HorizonGlow_AmbientFX_OPTIONAL_1.21.0.x.mcpack": [""],
    }
    for z in sorted(dist.glob("*")):
        if z.name not in expect:
            err(f"unexpected file in dist/: {z.name}")
            continue
        n, longest, total = check_zip(z, expect[z.name])
        print(f"{z.name}: {n} entries, longest path {longest}, {total / 1024:.0f} KiB unpacked, zip {z.stat().st_size / 1024:.0f} KiB")
    for name in expect:
        if not (dist / name).exists():
            err(f"missing dist/{name}")
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
