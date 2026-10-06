#!/usr/bin/env python3
"""Preview renders of the infected creatures with tools/georender.

Two modes:

  python3 tools/art/infected/preview_infected.py repo
      docs/images/infected_<species>.png : OUR overlay + growth layers only, on a neutral grey
      stand-in built from our own skin boxes (no Mojang texture in the image).  The pose comes
      from the same animations the game plays (vanilla animation JSON from the reference is
      used for posing only, when available).

  python3 tools/art/infected/preview_infected.py scratch --out DIR
      Full client-entity renders (vanilla textures from the bedrock-samples reference, so the
      images must stay OUT of the repo): vanilla vs infected, walk and attack frame sheets,
      twitch frames, villager professions x biomes, mooshroom variants, sheep colours / sheared,
      baby forms.

Environment: PAS_VANILLA_REF (default: the scratchpad reference used by tools/validate.py).
"""
from __future__ import annotations

import argparse
import copy
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from infected_lib import REPO  # noqa: E402

sys.path.insert(0, os.path.join(REPO, "tools", "georender"))
import georender as g  # noqa: E402

from gen_infected import DEFAULT_REF  # noqa: E402

RP = os.path.join(REPO, "addon", "resource_pack")
SPECIES = ("villager", "cow", "pig", "sheep", "chicken", "human")
VANILLA_OF = {"villager": "minecraft:villager_v2", "cow": "minecraft:cow", "pig": "minecraft:pig",
              "sheep": "minecraft:sheep", "chicken": "minecraft:chicken", "human": None}
# Bedrock dye colours (sheep wool tint is applied by the engine from minecraft:color)
DYE = ["f9fffe", "f9801d", "c74ebd", "3ab3da", "fed83d", "80c71f", "f38baa", "474f52",
       "9d9d97", "169c9c", "8932b8", "3c44aa", "835432", "5e7c16", "b02e26", "1d1d21"]
BG = (58, 60, 64, 255)


def ref_root() -> str:
    return os.environ.get("PAS_VANILLA_REF", DEFAULT_REF)


def label(img: Image.Image, text: str) -> Image.Image:
    out = Image.new("RGBA", (img.width, img.height + 18), (32, 32, 34, 255))
    out.alpha_composite(img, (0, 18))
    ImageDraw.Draw(out).text((4, 3), text, fill=(235, 235, 235, 255), font=g._font(12))
    return out


def grid(images, cols: int, pad: int = 4, bg=(24, 24, 26, 255)) -> Image.Image:
    rows = (len(images) + cols - 1) // cols
    w = max(i.width for i in images)
    h = max(i.height for i in images)
    out = Image.new("RGBA", (cols * w + (cols + 1) * pad, rows * h + (rows + 1) * pad), bg)
    for k, im in enumerate(images):
        r, c = divmod(k, cols)
        out.alpha_composite(im, (pad + c * (w + pad), pad + r * (h + pad)))
    return out


def render_entity(rp: g.ResourcePack, ident: str, view="iso", size=300, queries=None, variables=None,
                  time=0.0, framing=None, skip_layers=(), tint=None, label_text=None, info=None, cam=None):
    layers, plays, vars_out, notes = g.entity_layers(rp, ident, queries or {}, variables or {}, time)
    layers = [l for l in layers if l.name not in skip_layers]
    if tint is not None and layers:
        layers[0].tint = tint
    img = g.render(layers, cam or g.Camera.view(view), size=size, background=BG, plays=plays, time=time,
                   queries=queries, variables=vars_out, framing=framing, info=info)
    return label(img, label_text) if label_text else img


# ---------------------------------------------------------------------------
# repo previews (our layers only)
# ---------------------------------------------------------------------------

def standin_geometry(overlay: g.Geometry) -> g.Geometry:
    """Grey stand-in: our skin boxes with the overlay's own inflate removed (= vanilla cube shape)."""
    from species import DELTA
    geo = copy.deepcopy(overlay)
    geo.identifier += ".standin"
    for b in geo.bones:
        keep = []
        for c in b.cubes:
            # skin copies carry inflate >= DELTA; growth parts have none
            if c.inflate is not None and c.inflate >= DELTA - 1e-6:
                c.inflate = c.inflate - DELTA
                c.uv = [0, 0]
                keep.append(c)
        b.cubes = keep
    geo.texture_width = geo.texture_height = 64
    return geo


def grey_texture() -> np.ndarray:
    t = np.zeros((64, 64, 4), np.uint8)
    t[..., :3] = 150
    t[..., 3] = 255
    yy, xx = np.mgrid[0:64, 0:64]
    t[((xx + yy) % 2) == 0, :3] = 142
    return t


def repo_previews(out_dir: str) -> list[str]:
    ref = ref_root()
    rp_roots = [RP] + ([os.path.join(ref, "resource_pack")] if os.path.isdir(ref) else [])
    rp = g.ResourcePack(rp_roots)   # textures resolved from our pack only for layers we keep
    written = []
    for key in SPECIES:
        ident = f"pas:infected_{key}"
        path, desc = rp.entities[ident]
        geo_ids = desc["geometry"]
        cases = [("adult", {}, {})]
        if key == "sheep":
            cases.append(("sheared", {"is_sheared": 1}, {}))
        frames = []
        for case, q, v in cases:
            q = dict(q)
            ov_id = geo_ids["overlay_sheared"] if q.get("is_sheared") else geo_ids["overlay"]
            ov_geo = rp.geos.get(ov_id)
            tex = g.load_texture(desc["textures"]["overlay"], [RP])
            ov = g.Layer(ov_geo, tex, name="overlay")
            ov.bone_flags = {b.key: g.material_flags("spider") for b in ov_geo.bones if b.key.startswith("glow")}
            stand = g.Layer(standin_geometry(ov_geo), grey_texture(), name="standin")
            _, plays, vars_out, _ = g.entity_layers(rp, ident, q, v, 0.0)
            for view in ("front", "iso", "iso_back"):
                img = g.render([stand, ov], g.Camera.view(view), size=300, background=BG, plays=plays,
                               queries=q, variables=vars_out)
                frames.append(label(img, f"{case} {view}"))
            vv = dict(vars_out)
            vv["attack_time"] = 0.45
            _, plays_a, vars_a, _ = g.entity_layers(rp, ident, q, {"attack_time": 0.45}, 0.0)
            img = g.render([stand, ov], g.Camera.view("iso"), size=300, background=BG, plays=plays_a,
                           queries=q, variables=vars_a)
            frames.append(label(img, f"{case} attack"))
        sheet = grid(frames, 4)
        title = Image.new("RGBA", (sheet.width, 26), (24, 24, 26, 255))
        ImageDraw.Draw(title).text((6, 6), f"pas:infected_{key} - infection overlay + growths only (grey = stand-in for the "
                                           f"vanilla base pass)", fill=(240, 240, 240, 255), font=g._font(13))
        full = Image.new("RGBA", (sheet.width, sheet.height + 26))
        full.alpha_composite(title)
        full.alpha_composite(sheet, (0, 26))
        p = os.path.join(out_dir, f"infected_{key}.png")
        full.convert("RGB").save(p, optimize=True)
        written.append(p)
    return written


# ---------------------------------------------------------------------------
# scratch previews (vanilla textures - never commit)
# ---------------------------------------------------------------------------

def scratch_previews(out_dir: str) -> list[str]:
    ref = ref_root()
    vrp = os.path.join(ref, "resource_pack")
    if not os.path.isdir(vrp):
        raise SystemExit(f"vanilla reference not found at {ref}")
    os.makedirs(out_dir, exist_ok=True)
    rp = g.ResourcePack([RP, vrp])
    written = []

    def save(img, name):
        p = os.path.join(out_dir, name)
        img.save(p)
        written.append(p)

    # 1) vanilla vs infected
    for key in SPECIES:
        ident = f"pas:infected_{key}"
        q = {"variant": 1, "mark_variant": 0} if key == "villager" else {}
        tiles = []
        for view in ("front", "iso", "iso_back"):
            if VANILLA_OF[key]:
                tiles.append(render_entity(rp, VANILLA_OF[key], view, 300, dict(q), label_text=f"vanilla {view}"))
            else:
                tiles.append(render_entity(rp, ident, view, 300, dict(q), skip_layers=("controller.render.pas_infected_overlay",),
                                           label_text=f"base pass only {view}"))
            tiles.append(render_entity(rp, ident, view, 300, dict(q), label_text=f"infected {view}"))
        save(grid(tiles, 6), f"cmp_{key}.png")

    # 2) walk, 3) attack, 4) twitch
    walk_q = {"modified_distance_moved": "t*9.43", "modified_move_speed": 0.7}
    for key in SPECIES:
        ident = f"pas:infected_{key}"
        q = {"variant": 1} if key == "villager" else {}
        tiles = []
        for t in np.linspace(0, 0.66, 6):
            qq = dict(q, **walk_q)
            tiles.append(render_entity(rp, ident, "right", 260, qq, time=float(t), label_text=f"walk t={t:.2f}",
                                       cam=g.Camera.view("right", ortho=True)))
        save(grid(tiles, 6), f"walk_{key}.png")
        tiles = []
        for at in (0.0, 0.15, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9):
            tiles.append(render_entity(rp, ident, "iso", 260, dict(q), {"attack_time": at},
                                       label_text=f"attack_time={at:.2f}"))
        save(grid(tiles, 8), f"attack_{key}.png")
        tiles = []
        for t in (0.0, 0.3, 0.7, 1.1, 1.6, 2.2):
            tiles.append(render_entity(rp, ident, "iso_back", 260, dict(q), {"has_target": 1}, time=t,
                                       label_text=f"twitch t={t:.1f}"))
        save(grid(tiles, 6), f"twitch_{key}.png")

    # 5) variants
    profs = [(1, "farmer"), (5, "librarian"), (8, "armorer")]
    biomes = [(0, "plains"), (4, "snow")]
    tiles = []
    for bi, bn in biomes:
        for pi, pn in profs:
            tiles.append(render_entity(rp, "pas:infected_villager", "iso", 260, {"variant": pi, "mark_variant": bi},
                                       label_text=f"{pn} / {bn}"))
    tiles.append(render_entity(rp, "pas:infected_villager", "iso", 260, {"variant": 0, "mark_variant": 2, "skin_id": 3},
                               label_text="unskilled / jungle"))
    tiles.append(render_entity(rp, "pas:infected_villager", "iso", 260, {"variant": 3, "mark_variant": 1, "is_baby": 1},
                               label_text="baby shepherd / desert"))
    save(grid(tiles, 4), "variants_villager.png")
    tiles = [render_entity(rp, "pas:infected_cow", "iso", 280, {"variant": v}, label_text=n)
             for v, n in ((0, "variant 0 cow"), (1, "variant 1 red mooshroom"), (2, "variant 2 brown mooshroom"))]
    tiles.append(render_entity(rp, "pas:infected_cow", "iso", 280, {"variant": 1, "is_baby": 1}, label_text="baby red mooshroom"))
    save(grid(tiles, 4), "variants_cow.png")
    tiles = []
    for ci in (0, 1, 3, 10, 14, 15):
        col = tuple(int(DYE[ci][i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)
        tiles.append(render_entity(rp, "pas:infected_sheep", "iso", 260, {"color": ci}, tint=col,
                                   label_text=f"color {ci} (engine tint simulated)"))
    tiles.append(render_entity(rp, "pas:infected_sheep", "iso", 260, {"is_sheared": 1}, label_text="sheared"))
    tiles.append(render_entity(rp, "pas:infected_sheep", "iso", 260, {"is_baby": 1}, label_text="baby"))
    save(grid(tiles, 4), "variants_sheep.png")
    # 6) babies next to adults (same framing per pair)
    tiles = []
    for key in ("villager", "cow", "pig", "sheep", "chicken"):
        ident = f"pas:infected_{key}"
        q = {"variant": 1} if key == "villager" else {}
        info = {}
        adult = render_entity(rp, ident, "iso", 260, dict(q), info=info)
        fr = info["framing"]
        baby = render_entity(rp, ident, "iso", 260, dict(q, is_baby=1), framing=fr)
        tiles += [label(adult, f"{key} adult"), label(baby, f"{key} baby (scale 0.5 not applied)")]
    save(grid(tiles, 4), "babies.png")
    return written


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["repo", "scratch"])
    ap.add_argument("--out", help="output dir (scratch mode; repo mode writes docs/images)")
    a = ap.parse_args(argv)
    if a.mode == "repo":
        out = a.out or os.path.join(REPO, "docs", "images")
        os.makedirs(out, exist_ok=True)
        for p in repo_previews(out):
            print("wrote", os.path.relpath(p, REPO))
    else:
        if not a.out:
            raise SystemExit("scratch mode needs --out (outside the repo)")
        if os.path.abspath(a.out).startswith(os.path.abspath(REPO) + os.sep):
            raise SystemExit("scratch previews contain vanilla textures: write them outside the repo")
        for p in scratch_previews(a.out):
            print("wrote", p)
    return 0


if __name__ == "__main__":
    sys.exit(main())
