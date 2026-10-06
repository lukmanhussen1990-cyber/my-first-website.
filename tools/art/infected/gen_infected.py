#!/usr/bin/env python3
"""Generate the client visuals of the six infected creatures (SPEC section 3).

Writes (all original content; vanilla assets are only referenced by id/path):
  addon/resource_pack/models/entity/pas_infected_<species>.geo.json     overlay geometry (+ cow mushrooms)
  addon/resource_pack/textures/entity/pas/infected_<species>.png        overlay + glow texture
  addon/resource_pack/entity/pas_infected_<species>.entity.json         client entities
  addon/resource_pack/render_controllers/pas_infected.render_controllers.json
  addon/resource_pack/animations/pas_infected.animation.json
  addon/resource_pack/animation_controllers/pas_infected.animation_controllers.json

Usage:  python3 tools/art/infected/gen_infected.py [--check-vanilla]
        (--check-vanilla re-derives the vanilla cube boxes copied into species.py from the
         bedrock-samples reference and fails if any differs)
"""
from __future__ import annotations

import argparse
import copy
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from infected_lib import REPO, Canvas, pack_parts, texels_of, write_geometry_file, write_json  # noqa: E402
from painters import (paint_flesh_rod, paint_glow, paint_jaw, paint_parasite_head, paint_skin,  # noqa: E402
                      paint_tooth)
import client_json  # noqa: E402
from species import BUILDERS, VANILLA_CHECK, Spec  # noqa: E402

RP = os.path.join(REPO, "addon", "resource_pack")
SPECIES = ("villager", "cow", "pig", "sheep", "chicken", "human")
DEFAULT_REF = ("/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441/scratchpad/ref/"
               "bedrock-samples-1.21.0.26")


def texture_path(key: str) -> str:
    return f"textures/entity/pas/infected_{key}"


def build(key: str) -> tuple[Spec, Canvas]:
    sp = BUILDERS[key]()
    parts = [p for m in sp.models for _, p in m.parts()]
    # smallest texture that fits (power-of-two sizes, width >= height)
    for w, h in ((64, 32), (64, 64), (128, 64), (128, 128), (256, 128), (256, 256)):
        try:
            pack_parts(parts, w, h, key)
            break
        except ValueError:
            continue
    sp.tex_size = (w, h)
    for m in sp.models:
        m.tex_w, m.tex_h = w, h
    cv = Canvas(w, h)
    for m, cfg in sp.skin_cfgs:
        skin_parts = [p for _, p in m.parts() if p.kind == "skin"]
        paint_skin(cv, texels_of(skin_parts), cfg)
    for p in parts:
        seed = p.meta.get("seed", 7)
        if p.kind == "head":
            paint_parasite_head(cv, p, seed)
        elif p.kind == "stalk":
            paint_flesh_rod(cv, p, seed, "stalk")
        elif p.kind == "tendril":
            paint_flesh_rod(cv, p, seed, "tendril")
        elif p.kind == "claw":
            paint_flesh_rod(cv, p, seed, "claw")
        elif p.kind == "jaw":
            paint_jaw(cv, p, seed)
        elif p.kind == "tooth":
            paint_tooth(cv, p)
        elif p.kind == "glow":
            paint_glow(cv, p, p.meta["cols"])
    return sp, cv


def write_species(key: str) -> Spec:
    sp, cv = build(key)
    geo_path = os.path.join(RP, "models", "entity", f"pas_infected_{key}.geo.json")
    write_geometry_file(geo_path, sp.models + sp.extra_models)
    tex_file = os.path.join(RP, texture_path(key) + ".png")
    os.makedirs(os.path.dirname(tex_file), exist_ok=True)
    Image.fromarray(cv.a, "RGBA").save(tex_file, optimize=True)
    return sp


def check_vanilla(ref: str) -> int:
    """Re-derive the rest-pose boxes / pivots / parents of the vanilla bones we copy and compare."""
    sys.path.insert(0, os.path.join(REPO, "tools", "georender"))
    import georender as g
    bad = 0
    for key, (f, gid) in VANILLA_CHECK.items():
        geo = g.load_geometries(os.path.join(ref, "resource_pack", "models", f)).get(gid)
        g2 = copy.deepcopy(geo)
        for b in g2.bones:
            b.inflate = 0.0
            for c in b.cubes:
                c.inflate = 0.0
        boxes = {}
        for q in g.build_mesh(g2):
            v = q.verts.copy()
            v[:, 0] *= -1
            boxes.setdefault(q.bone.lower(), []).append(v)
        vb = {}
        for bone, vs in boxes.items():
            pass
        sp = BUILDERS[key]()
        for m in sp.models[:1]:
            for b in m.bones:
                vbone = geo.bone(b.name)
                if vbone is None:
                    continue
                if tuple(vbone.pivot) != tuple(b.pivot) or ((vbone.parent or "").lower() != (b.parent or "").lower()):
                    print(f"[{key}] bone {b.name}: pivot/parent {b.pivot}/{b.parent} != vanilla {vbone.pivot}/{vbone.parent}")
                    bad += 1
                # every skin box must equal one vanilla cube box of that bone
                cubes = {}
                for q in g.build_mesh(g2):
                    if q.bone.lower() != b.name.lower():
                        continue
                    v = q.verts.copy()
                    v[:, 0] *= -1
                    cubes.setdefault(q.cube_index, []).append(v)
                vboxes = [(np.round(np.concatenate(v).min(0), 3), np.round(np.concatenate(v).max(0), 3)) for v in cubes.values()]
                for p in b.parts:
                    if p.kind != "skin":
                        continue
                    lo, hi = np.round(p.lo, 3), np.round(p.hi, 3)
                    if not any(np.allclose(lo, a) and np.allclose(hi, c) for a, c in vboxes):
                        print(f"[{key}] bone {b.name}: skin box {lo.tolist()}..{hi.tolist()} not a vanilla cube")
                        bad += 1
    print(f"check-vanilla: {bad} mismatch(es)")
    return bad


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check-vanilla", action="store_true")
    ap.add_argument("--only", help="comma list of species")
    a = ap.parse_args(argv)
    if a.check_vanilla:
        ref = os.environ.get("PAS_VANILLA_REF", DEFAULT_REF)
        if not os.path.isdir(ref):
            print(f"vanilla reference not found at {ref}")
            return 2
        return 1 if check_vanilla(ref) else 0
    keys = a.only.split(",") if a.only else SPECIES
    specs = {}
    for k in keys:
        specs[k] = write_species(k)
        print(f"wrote overlay geometry + texture for {k}")
    if not a.only:
        client_json.write_all(RP, {k: specs[k] for k in SPECIES}, texture_path)
        print("wrote client entities, render controllers, animations, animation controllers")
    return 0


if __name__ == "__main__":
    sys.exit(main())
