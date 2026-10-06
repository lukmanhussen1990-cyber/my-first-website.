#!/usr/bin/env python3
"""Consistency checks for the pas:parasite client files (complements tools/validate.py).

  * every bone an animation touches exists in the geometry
  * every animation / controller short name used by scripts.animate or a
    controller state is declared in the client entity's "animations"
  * Molang: every query.* and math.* name appears in the reference build's
    documentation/Molang.html; every variable.* is either set by our
    pre_animation scripts or is an engine variable that vanilla client files
    of this build read without setting (variable.attack_time)
  * format versions are ones the reference build's vanilla files use
  * texture: 128x128 RGBA, alpha only 255 or 3, and the alpha-3 (emissive)
    texels are exactly the texels the eye cubes sample
  * materials are vanilla names (spider / spider_invisible)

Usage: python3 tools/art/parasite/check_parasite.py      (exit 1 on failure)
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
RP = ROOT / "addon" / "resource_pack"
sys.path.insert(0, str(HERE))
import model  # noqa: E402

REF = Path(os.environ.get(
    "PAS_VANILLA_REF",
    "/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441/scratchpad/ref/bedrock-samples-1.21.0.26"))
ENGINE_VARIABLES = {"attack_time"}

FILES = {
    "entity": RP / "entity" / "pas_parasite.entity.json",
    "geo": RP / "models" / "entity" / "pas_parasite.geo.json",
    "anim": RP / "animations" / "pas_parasite.animation.json",
    "ctrl": RP / "animation_controllers" / "pas_parasite.animation_controllers.json",
    "rc": RP / "render_controllers" / "pas_parasite.render_controllers.json",
    "tex": RP / "textures" / "entity" / "pas" / "parasite.png",
}

errors: list[str] = []


def err(msg):
    errors.append(msg)
    print("ERROR", msg)


def strings(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for k, v in o.items():
            yield k
            yield from strings(v)
    elif isinstance(o, list):
        for v in o:
            yield from strings(v)


def molang_names(texts):
    q, m, v = set(), set(), set()
    for t in texts:
        q |= set(re.findall(r"\bquery\.([a-z_0-9]+)", t))
        m |= set(re.findall(r"\bmath\.([a-z_0-9]+)", t))
        v |= set(re.findall(r"\bvariable\.([a-z_0-9]+)", t))
    return q, m, v


def main():
    data = {k: json.loads(p.read_text()) for k, p in FILES.items() if k != "tex"}
    desc = data["entity"]["minecraft:client_entity"]["description"]
    geo = data["geo"]["minecraft:geometry"][0]
    bones = {b["name"] for b in geo["bones"]}
    anims = data["anim"]["animations"]
    ctrls = data["ctrl"]["animation_controllers"]

    # box-UV cubes must have whole-unit sizes (UV strips are laid out from the size)
    for b in geo["bones"]:
        for c in b.get("cubes", []):
            if isinstance(c.get("uv"), list) and any(abs(x - round(x)) > 1e-6 for x in c["size"]):
                err(f"bone {b['name']}: box-UV cube with fractional size {c['size']}")
    # bones
    for an, a in anims.items():
        for b in a.get("bones", {}):
            if b not in bones:
                err(f"{an}: bone {b} not in geometry")
    # short names
    short = desc["animations"]
    for full in short.values():
        if full not in anims and full not in ctrls:
            err(f"entity animations: {full} not defined in our files")
    for entry in desc["scripts"]["animate"]:
        n = entry if isinstance(entry, str) else next(iter(entry))
        if n not in short:
            err(f"scripts.animate: {n} not in description.animations")
    for cn, c in ctrls.items():
        for sn, st in c["states"].items():
            for a in st.get("animations", []):
                n = a if isinstance(a, str) else next(iter(a))
                if n not in short:
                    err(f"{cn}.{sn}: animation {n} not in the entity's animations")
            for tr in st.get("transitions", []):
                for target in tr:
                    if target not in c["states"]:
                        err(f"{cn}.{sn}: transition to unknown state {target}")
    # Molang
    texts = list(strings(data["anim"])) + list(strings(data["ctrl"])) + list(strings(data["rc"])) + list(strings(desc["scripts"]))
    q, m, v = molang_names(texts)
    doc = REF / "documentation" / "Molang.html"
    if doc.is_file():
        dt = doc.read_text(errors="replace")
        dq = set(re.findall(r"query\.([a-z_0-9]+)", dt))
        dm = set(re.findall(r"math\.([a-z_0-9]+)", dt))
        for n in sorted(q - dq):
            err(f"query.{n} is not documented in this build's Molang.html")
        for n in sorted(m - dm):
            err(f"math.{n} is not documented in this build's Molang.html")
        print(f"ok   Molang: {len(q)} queries, {len(m)} math functions, all documented in Molang.html")
    else:
        print("skip Molang documentation check (reference missing)")
    set_vars = set()
    for s in desc["scripts"].get("pre_animation", []) + desc["scripts"].get("initialize", []):
        set_vars |= set(re.findall(r"variable\.([a-z_0-9]+)\s*=", s))
    for n in sorted(v - set_vars):
        if n not in ENGINE_VARIABLES:
            err(f"variable.{n} is read but never set")
    if (REF / "resource_pack").is_dir():
        vt = "".join(p.read_text(errors="replace") for p in (REF / "resource_pack" / "entity").glob("*.json"))
        vt += "".join(p.read_text(errors="replace") for p in (REF / "resource_pack" / "animation_controllers").glob("*.json"))
        for n in ENGINE_VARIABLES & v:
            if f"variable.{n}" not in vt:
                err(f"engine variable.{n} is not used by any vanilla client file of this build")
        # format versions used by vanilla
        def fv_set(sub):
            out = set()
            for p in (REF / "resource_pack" / sub).rglob("*.json"):
                mm = re.search(r'"format_version"\s*:\s*"([^"]+)"', p.read_text(errors="replace"))
                if mm:
                    out.add(mm.group(1))
            return out
        for k, sub in (("entity", "entity"), ("geo", "models"), ("anim", "animations"),
                       ("ctrl", "animation_controllers"), ("rc", "render_controllers")):
            fv = data[k]["format_version"]
            if fv not in fv_set(sub):
                err(f"{FILES[k].name}: format_version {fv} not used by vanilla {sub}/")
        print("ok   format versions are used by vanilla files of this build")
        vm = set()
        for p in (REF / "resource_pack" / "entity").glob("*.json"):
            d = json.loads(re.sub(r",(\s*[}\]])", r"\1", p.read_text(errors="replace")))
            vm |= set((d.get("minecraft:client_entity", {}).get("description", {}).get("materials") or {}).values())
        for k, mat in desc["materials"].items():
            if mat not in vm:
                err(f"material {mat} not used by a vanilla client entity")
    # texture / emissive mask
    img = np.array(Image.open(FILES["tex"]))
    if img.shape != (128, 128, 4):
        err(f"texture shape {img.shape} != (128, 128, 4)")
    alphas = set(np.unique(img[..., 3]).tolist())
    if not alphas <= {3, 255}:
        err(f"texture alpha values {sorted(alphas)} (expected only 3 and 255)")
    bl = model.build_bones()
    regions, swatches = model.pack_layout(bl)
    eye_mask = np.zeros(img.shape[:2], dtype=bool)
    for sw in ("eye_front", "eye_side"):
        u, vv, w, h = swatches[sw]
        eye_mask[vv * 2:(vv + h) * 2, u * 2:(u + w) * 2] = True
    em = img[..., 3] < 128
    if not np.array_equal(em, eye_mask):
        err(f"emissive texels ({em.sum()}) do not match the eye cube faces ({eye_mask.sum()})")
    else:
        print(f"ok   {em.sum()} emissive texels (alpha 3), exactly the eye cube faces")
    # every UV rect inside the texture, no overlap between regions
    used = np.zeros((model.UV_H, model.UV_W), dtype=int)
    for name, (u, vv, w, h, d) in regions.items():
        used[vv:vv + d + h, u:u + 2 * (d + w)] += 1
    for name, (u, vv, w, h) in swatches.items():
        used[vv:vv + h, u:u + w] += 1
    if used.max() > 1:
        err("UV regions overlap")
    print(f"ok   {len(regions)} box-UV regions + {len(swatches)} swatches, no overlap, "
          f"{(used > 0).mean() * 100:.0f}% of the 64x64 UV space used")
    print("ok   bones, animation names and controller states consistent" if not errors else "")
    print(f"check_parasite: {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
