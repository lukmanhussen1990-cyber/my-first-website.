#!/usr/bin/env python3
"""Generate geometry.horror.giant_spider (DESIGN.md section 4).

Output: packs/GiantSpiderHunter_RP/models/entity/giant_spider.geo.json  (format 1.12.0)

Built at giant scale 1.0 (model px, 16 px = 1 block). +Y up, ground y = 0, forward = -Z,
+X = the spider's LEFT. Bind pose: every leg segment straight and horizontal with zero
bone rotations, so the IK animation writes absolute angles.

Bones (39): root > body > {torso > {head > fang_l, fang_r}, abdomen},
            hip_xn > femur_xn > tibia_xn > foot_xn  (x in l/r, n in 1..4, legs under body).

Every cube uses per-face UVs that point into named regions of the texture atlas defined in
tools/gen_texture.py (imported here, so geometry and texture never disagree).

Run:  python3 tools/gen_geometry.py          (writes the file, then runs verify())
      python3 tools/gen_geometry.py --check  (only verify the existing file)
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_texture  # noqa: E402  (atlas layout authority)

ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "packs", "GiantSpiderHunter_RP", "models", "entity",
                   "giant_spider.geo.json")
TEX = gen_texture.OUT

IDENTIFIER = "geometry.horror.giant_spider"

# ---------------------------------------------------------------------------- DESIGN constants
BODY_PIVOT = (0, 208, 0)
TORSO_PIVOT = (0, 208, 0)
HEAD_PIVOT = (0, 212, -34)
FANG_L_PIVOT = (8, 202, -48)
FANG_R_PIVOT = (-8, 202, -48)
ABDOMEN_PIVOT = (0, 214, 16)
HIP_X = 22
HIP_Y = 206
HIP_Z = [-26, -12, 2, 14]
K = [1.08, 1.00, 0.96, 1.04]
L1_BASE, L2_BASE, L3_BASE = 150.0, 270.0, 50.0
NEUTRAL_R_BASE = 170.0
NEUTRAL_A = [52.0, 20.0, -16.0, -48.0]

ABDOMEN_HANG = -30.0  # cube X rotation about the abdomen pivot (negative = rear end down)

LEG_SIDES = (("l", 1), ("r", -1))  # side suffix, X sign (+X = left)


def rnd(x):
    """Round to 4 decimals and drop '.0' so the JSON stays readable and exact."""
    r = round(float(x), 4)
    if r == int(r):
        return int(r)
    return r


def vec(*xs):
    return [rnd(x) for x in xs]


def leg_lengths(n):
    k = K[n - 1]
    return L1_BASE * k, L2_BASE * k, L3_BASE * k


def leg_points(side_sign, n):
    """DESIGN formulas: hip, knee (tibia pivot), ankle (foot pivot), tip (locator)."""
    L1, L2, L3 = leg_lengths(n)
    z = HIP_Z[n - 1]
    hx = side_sign * HIP_X
    return {
        "hip": (hx, HIP_Y, z),
        "knee": (hx + side_sign * L1, HIP_Y, z),
        "ankle": (hx + side_sign * (L1 + L2), HIP_Y, z),
        "tip": (hx + side_sign * (L1 + L2 + L3), HIP_Y, z),
    }


def neutral_foot(side_sign, n):
    k = K[n - 1]
    R = NEUTRAL_R_BASE * k
    a = math.radians(NEUTRAL_A[n - 1])
    z = HIP_Z[n - 1]
    return (side_sign * (HIP_X + R * math.cos(a)), 0.0, z - R * math.sin(a))


# ---------------------------------------------------------------------------- cube helpers
LAYOUT = gen_texture.layout()
FACES = ("north", "south", "east", "west", "up", "down")


def face_uv(region):
    u, v, w, h = LAYOUT[region]
    return {"uv": [u, v], "uv_size": [w, h]}


def cube(x0, x1, y0, y1, z0, z1, faces, pivot=None, rotation=None):
    """Axis-aligned cube from min/max corners. `faces` maps every face to a region name."""
    lo = (min(x0, x1), min(y0, y1), min(z0, z1))
    hi = (max(x0, x1), max(y0, y1), max(z0, z1))
    c = {
        "origin": vec(*lo),
        "size": vec(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]),
    }
    if rotation is not None:
        c["pivot"] = vec(*pivot)
        c["rotation"] = vec(*rotation)
    missing = [f for f in FACES if f not in faces]
    if missing:
        raise ValueError(f"cube missing faces {missing}")
    c["uv"] = {f: face_uv(faces[f]) for f in FACES}
    return c


def limb_faces(side, top, end, under=None):
    """X-aligned limb: long faces N/S use `side`, U/D use `top` (D: `under` if given),
    ends E/W use `end`."""
    return {"north": side, "south": side, "up": top, "down": under or top, "east": end, "west": end}


def box_faces(n, s, e, w, u, d):
    return {"north": n, "south": s, "east": e, "west": w, "up": u, "down": d}


def xspan(sign, a, b, base):
    """Return (lo, hi) for an X-extent measured outward from `base` by a..b (a<b)."""
    p, q = base + sign * a, base + sign * b
    return (min(p, q), max(p, q))


# ---------------------------------------------------------------------------- body parts
def torso_cubes():
    return [
        # main cephalothorax block (42 x 20 x 52)
        cube(-21, 21, 195, 215, -34, 18,
             box_faces("tor_end", "tor_end", "tor_side", "tor_side", "cara_top", "tor_under")),
        # carapace plate overhanging the sides (46 x 8 x 42)
        cube(-23, 23, 211, 219, -30, 12,
             box_faces("cara_end", "cara_end", "cara_side", "cara_side", "cara_top", "tor_under")),
        # raised dorsal ridge (14 x 4 x 32)
        cube(-7, 7, 219, 223, -26, 6,
             box_faces("ridge_end", "ridge_end", "ridge_side", "ridge_side", "ridge_top", "ridge_top")),
        # plated underside / sternum (30 x 4 x 34)
        cube(-15, 15, 191, 195, -24, 10,
             box_faces("stern_end", "stern_end", "stern_side", "stern_side", "stern_down", "stern_down")),
    ]


def head_cubes():
    return [
        # head block (28 x 22 x 20); eyes on the north (front) face
        cube(-14, 14, 197, 219, -52, -32,
             box_faces("head_front", "head_side", "head_side", "head_side", "head_top", "head_under")),
        # chelicera base under the front of the head (22 x 8 x 12)
        cube(-11, 11, 191, 199, -53, -41,
             box_faces("jaw_front", "jaw_front", "jaw_side", "jaw_side", "jaw_under", "jaw_under")),
    ]


def fang_cubes(sign):
    px, py, pz = FANG_L_PIVOT if sign > 0 else FANG_R_PIVOT
    fang = {"north": "fang_side", "south": "fang_side", "east": "fang_side",
            "west": "fang_side", "up": "fang_end", "down": "fang_end"}
    tip = {"north": "fangtip_side", "south": "fangtip_side", "east": "fangtip_side",
           "west": "fangtip_side", "up": "fangtip_end", "down": "fangtip_end"}
    return [
        # fang base hanging from the chelicera (8 x 22 x 8)
        cube(px - 4, px + 4, py - 20, py + 2, pz - 4, pz + 4, fang),
        # hooked tip: tilted back (+X rot) and inward (Z rot towards the centre line)
        cube(px - 2.5, px + 2.5, py - 34, py - 18, pz - 2.5, pz + 2.5, tip,
             pivot=(px, py - 19, pz), rotation=(20, 0, 15 * sign)),
    ]


def abdomen_cubes():
    p = ABDOMEN_PIVOT
    rot = (ABDOMEN_HANG, 0, 0)

    def ac(x0, x1, y0, y1, z0, z1, faces):
        return cube(x0, x1, y0, y1, z0, z1, faces, pivot=p, rotation=rot)

    pet = {f: "petiole" for f in FACES}
    spin = {f: "spinner" for f in FACES}
    return [
        # petiole (waist) joining the cephalothorax (18 x 14 x 12)
        ac(-9, 9, 203, 217, 12, 24, pet),
        # front block (36 x 32 x 14)
        ac(-18, 18, 190, 222, 22, 36,
           box_faces("abd_front", "abd_front", "abd1_side", "abd1_side", "abd1_top", "abd1_under")),
        # main bulb, upper widest tier (64 x 30 x 56)
        ac(-32, 32, 196, 226, 34, 90,
           box_faces("abd_end", "abd_end", "abd_side", "abd_side", "abd_top", "abd_under")),
        # hanging belly, middle tier (50 x 24 x 48)
        ac(-25, 25, 174, 198, 38, 86,
           box_faces("belly_end", "belly_end", "belly_side", "belly_side", "belly_down", "belly_down")),
        # ventral keel, lowest tier -> teardrop / inverted-V silhouette (28 x 14 x 32)
        ac(-14, 14, 162, 176, 46, 78,
           box_faces("keel_end", "keel_end", "keel_side", "keel_side", "keel_down", "keel_down")),
        # rear taper (44 x 40 x 16)
        ac(-22, 22, 182, 222, 88, 104,
           box_faces("abd_rear", "abd_rear", "abd3_side", "abd3_side", "abd1_top", "abd1_under")),
        # spinnerets (18 x 14 x 10)
        ac(-9, 9, 188, 202, 102, 112, spin),
        # dorsal shield plate (40 x 4 x 40)
        ac(-20, 20, 225, 229, 44, 84,
           box_faces("abd_plate_side", "abd_plate_side", "abd_plate_side", "abd_plate_side",
                     "abd_plate", "abd_plate")),
    ]


# ---------------------------------------------------------------------------- legs
def femur_thickness(n):
    return 24.0 if n == 1 else 22.0


def leg_bones(side, sign, n):
    pts = leg_points(sign, n)
    L1, L2, L3 = leg_lengths(n)
    hx, hy, z = pts["hip"]
    kx = pts["knee"][0]
    ax = pts["ankle"][0]
    tf = femur_thickness(n)
    h = tf / 2

    femur = [
        # main femur beam: starts 8 px inside the body, ends under the knee block
        cube(*xspan(sign, -8, L1 - 6, hx), hy - h, hy + h, z - h, z + h,
             limb_faces("fem_side", "fem_top", "fem_end", "fem_under")),
        # dorsal crest along the middle of the femur (angular stepped profile)
        cube(*xspan(sign, 0.16 * L1, L1 - 18, hx), hy + h - 1, hy + h + 6, z - h + 4, z + h - 4,
             limb_faces("crest_side", "crest_top", "crest_end")),
        # chunky knee joint block (28 x 26 x 26) centred on the knee
        cube(*xspan(sign, L1 - 14, L1 + 12, hx), hy - 13, hy + 13, z - 13, z + 13,
             limb_faces("knee", "knee", "knee")),
    ]
    split = 0.5 * L2
    tibia = [
        # upper tibia (14 thick)
        cube(*xspan(sign, -2, split, kx), hy - 7, hy + 7, z - 7, z + 7,
             limb_faces("tib1_side", "tib1_side", "tib1_end")),
        # lower tibia (11 thick) down to the ankle
        cube(*xspan(sign, split, L2 + 1, kx), hy - 5.5, hy + 5.5, z - 5.5, z + 5.5,
             limb_faces("tib2_side", "tib2_side", "tib2_end")),
    ]
    foot = [
        # dark ankle joint (8 x 13 x 13)
        cube(*xspan(sign, -4, 4, ax), hy - 6.5, hy + 6.5, z - 6.5, z + 6.5,
             limb_faces("ankle_side", "ankle_side", "ankle_end")),
        # foot (9 thick)
        cube(*xspan(sign, 0, 0.6 * L3, ax), hy - 4.5, hy + 4.5, z - 4.5, z + 4.5,
             limb_faces("foot_side", "foot_side", "foot_end")),
        # claw (6 thick) to the tip
        cube(*xspan(sign, 0.6 * L3, L3, ax), hy - 3, hy + 3, z - 3, z + 3,
             limb_faces("claw_side", "claw_side", "claw_end")),
    ]
    sfx = f"{side}{n}"
    return [
        {"name": f"hip_{sfx}", "parent": "body", "pivot": vec(*pts["hip"])},
        {"name": f"femur_{sfx}", "parent": f"hip_{sfx}", "pivot": vec(*pts["hip"]), "cubes": femur},
        {"name": f"tibia_{sfx}", "parent": f"femur_{sfx}", "pivot": vec(*pts["knee"]), "cubes": tibia},
        {"name": f"foot_{sfx}", "parent": f"tibia_{sfx}", "pivot": vec(*pts["ankle"]), "cubes": foot,
         "locators": {f"foot_tip_{sfx}": vec(*pts["tip"])}},
    ]


def build():
    bones = [
        {"name": "root", "pivot": [0, 0, 0]},
        {"name": "body", "parent": "root", "pivot": vec(*BODY_PIVOT)},
        {"name": "torso", "parent": "body", "pivot": vec(*TORSO_PIVOT), "cubes": torso_cubes()},
        {"name": "head", "parent": "torso", "pivot": vec(*HEAD_PIVOT), "cubes": head_cubes()},
        {"name": "fang_l", "parent": "head", "pivot": vec(*FANG_L_PIVOT), "cubes": fang_cubes(1)},
        {"name": "fang_r", "parent": "head", "pivot": vec(*FANG_R_PIVOT), "cubes": fang_cubes(-1)},
        {"name": "abdomen", "parent": "torso", "pivot": vec(*ABDOMEN_PIVOT), "cubes": abdomen_cubes()},
    ]
    for side, sign in LEG_SIDES:
        for n in range(1, 5):
            bones.extend(leg_bones(side, sign, n))
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": IDENTIFIER,
                "texture_width": gen_texture.SIZE,
                "texture_height": gen_texture.SIZE,
                "visible_bounds_width": 72,
                "visible_bounds_height": 60,
                "visible_bounds_offset": [0, 28, 0],
            },
            "bones": bones,
        }],
    }


# ---------------------------------------------------------------------------- serialisation
def dumps(geo):
    """Compact but readable JSON: one line per cube / small dict."""
    def enc(o, ind):
        pad = "  " * ind
        if isinstance(o, dict):
            if all(not isinstance(v, (dict, list)) or (isinstance(v, list) and all(
                    not isinstance(x, (dict, list)) for x in v)) for v in o.values()) and len(o) <= 3:
                return "{" + ", ".join(f"{json.dumps(k)}: {json.dumps(v)}" for k, v in o.items()) + "}"
            if "origin" in o:  # cube: keep on few lines
                head = ", ".join(f"{json.dumps(k)}: {json.dumps(v)}" for k, v in o.items() if k != "uv")
                faces = ",\n".join(f"{pad}    {json.dumps(f)}: {json.dumps(v)}" for f, v in o["uv"].items())
                return "{" + head + ",\n" + pad + '  "uv": {\n' + faces + "\n" + pad + "  }}"
            items = [f"{pad}  {json.dumps(k)}: {enc(v, ind + 1)}" for k, v in o.items()]
            return "{\n" + ",\n".join(items) + "\n" + pad + "}"
        if isinstance(o, list):
            if all(not isinstance(x, (dict, list)) for x in o):
                return json.dumps(o)
            items = [f"{pad}  {enc(v, ind + 1)}" for v in o]
            return "[\n" + ",\n".join(items) + "\n" + pad + "]"
        return json.dumps(o)
    return enc(geo, 0) + "\n"


# ---------------------------------------------------------------------------- verification
EXPECTED_BONES = (["root", "body", "torso", "head", "fang_l", "fang_r", "abdomen"] +
                  [f"{part}_{s}{n}" for s in "lr" for n in range(1, 5)
                   for part in ("hip", "femur", "tibia", "foot")])
EXPECTED_PARENTS = {"root": None, "body": "root", "torso": "body", "head": "torso",
                    "fang_l": "head", "fang_r": "head", "abdomen": "torso"}
for _s in "lr":
    for _n in range(1, 5):
        EXPECTED_PARENTS[f"hip_{_s}{_n}"] = "body"
        EXPECTED_PARENTS[f"femur_{_s}{_n}"] = f"hip_{_s}{_n}"
        EXPECTED_PARENTS[f"tibia_{_s}{_n}"] = f"femur_{_s}{_n}"
        EXPECTED_PARENTS[f"foot_{_s}{_n}"] = f"tibia_{_s}{_n}"


def expected_pivots():
    """Independent re-statement of the DESIGN.md section 4 pivot formulas."""
    e = {"root": (0, 0, 0), "body": (0, 208, 0), "torso": (0, 208, 0),
         "head": (0, 212, -34), "fang_l": (8, 202, -48), "fang_r": (-8, 202, -48),
         "abdomen": (0, 214, 16)}
    loc = {}
    for s, sg in (("l", 1), ("r", -1)):
        for n in range(1, 5):
            k = [1.08, 1.00, 0.96, 1.04][n - 1]
            L1, L2, L3 = 150 * k, 270 * k, 50 * k
            hip = (sg * 22, 206, [-26, -12, 2, 14][n - 1])
            e[f"hip_{s}{n}"] = hip
            e[f"femur_{s}{n}"] = hip
            e[f"tibia_{s}{n}"] = (hip[0] + sg * L1, hip[1], hip[2])
            e[f"foot_{s}{n}"] = (hip[0] + sg * (L1 + L2), hip[1], hip[2])
            loc[f"foot_tip_{s}{n}"] = (f"foot_{s}{n}", (hip[0] + sg * (L1 + L2 + L3), hip[1], hip[2]))
    return e, loc


def verify(path=OUT, tex_path=TEX, quiet=False):
    """Structural + DESIGN-formula + UV checks. Returns list of error strings."""
    errs = []
    with open(path) as fh:
        geo = json.load(fh)  # (1) valid JSON
    if geo.get("format_version") != "1.12.0":
        errs.append("format_version must be 1.12.0")
    gl = geo.get("minecraft:geometry", [])
    if len(gl) != 1:
        errs.append("expected exactly one geometry")
        return errs
    g = gl[0]
    d = g["description"]
    if d.get("identifier") != IDENTIFIER:
        errs.append("identifier mismatch")
    if (d.get("texture_width"), d.get("texture_height")) != (128, 128):
        errs.append("texture size must be 128x128")
    if (d.get("visible_bounds_width"), d.get("visible_bounds_height"),
            d.get("visible_bounds_offset")) != (72, 60, [0, 28, 0]):
        errs.append("visible bounds mismatch")
    bones = g["bones"]
    names = [b["name"] for b in bones]
    if sorted(names) != sorted(EXPECTED_BONES) or len(names) != 39:
        errs.append(f"bone set mismatch: {sorted(set(names) ^ set(EXPECTED_BONES))} count={len(names)}")
    seen = set()
    for b in bones:  # parents valid and declared before children
        par = b.get("parent")
        if par != EXPECTED_PARENTS.get(b["name"], "?"):
            errs.append(f"{b['name']}: parent {par} != {EXPECTED_PARENTS.get(b['name'])}")
        if par is not None and par not in seen:
            errs.append(f"{b['name']}: parent {par} not declared before it")
        seen.add(b["name"])
        if "rotation" in b and any(abs(x) > 1e-9 for x in b["rotation"]):
            errs.append(f"{b['name']}: bind pose must have zero bone rotation")
    piv, locs = expected_pivots()
    by = {b["name"]: b for b in bones}
    for n, p in piv.items():
        got = by.get(n, {}).get("pivot")
        if got is None or any(abs(a - b) > 1e-6 for a, b in zip(got, p)):
            errs.append(f"{n}: pivot {got} != expected {p}")
    all_locs = {}
    for b in bones:
        for ln, lp in (b.get("locators") or {}).items():
            all_locs[ln] = (b["name"], lp)
    if set(all_locs) != set(locs):
        errs.append(f"locator set mismatch {sorted(set(all_locs) ^ set(locs))}")
    for ln, (bn, lp) in locs.items():
        if ln in all_locs:
            gb, gp = all_locs[ln]
            if gb != bn or any(abs(a - b) > 1e-6 for a, b in zip(gp, lp)):
                errs.append(f"locator {ln}: {gb} {gp} != {bn} {lp}")
    # (2) UVs inside the atlas and on painted regions
    from PIL import Image
    import numpy as np
    img = np.array(Image.open(tex_path).convert("RGBA"))
    if img.shape != (128, 128, 4):
        errs.append(f"texture shape {img.shape}")
    rects = {(u, v, w, h): name for name, (u, v, w, h) in LAYOUT.items()}
    ncubes = 0
    ratios = []
    for b in bones:
        for c in b.get("cubes", []):
            ncubes += 1
            sx, sy, sz = c["size"]
            dims = {"north": (sx, sy), "south": (sx, sy), "east": (sz, sy), "west": (sz, sy),
                    "up": (sx, sz), "down": (sx, sz)}
            uv = c.get("uv")
            if not isinstance(uv, dict) or set(uv) != set(FACES):
                errs.append(f"{b['name']}: cube without 6 per-face UVs")
                continue
            for f, fv in uv.items():
                u, v = fv["uv"]
                w, h = fv["uv_size"]
                if not (0 <= u and u + w <= 128 and 0 <= v and v + h <= 128 and w > 0 and h > 0):
                    errs.append(f"{b['name']}.{f}: uv rect {u},{v},{w},{h} outside atlas")
                    continue
                if (u, v, w, h) not in rects:
                    errs.append(f"{b['name']}.{f}: uv rect {u},{v},{w},{h} is not a painted region")
                    continue
                a = img[v:v + h, u:u + w, 3]
                if not np.isin(a, (3, 255)).all():
                    errs.append(f"{b['name']}.{f}: samples transparent texels")
                fu, fv_ = dims[f]
                ratios.append((fu / w, fv_ / h, b["name"], f, rects[(u, v, w, h)]))
    if ncubes > 90:
        errs.append(f"{ncubes} cubes > 90")
    # density sanity: no face absurdly stretched (> 3.5 px/texel) or squashed (< 1.0)
    for ru, rv, bn, f, reg in ratios:
        if not (0.9 <= ru <= 3.6 and 0.9 <= rv <= 3.6):
            errs.append(f"{bn}.{f} ({reg}) density {ru:.2f}x{rv:.2f} px/texel out of range")
    # eyes glow (alpha 3) and nothing else is translucent
    a = img[..., 3]
    eyes = gen_texture.eye_texels(LAYOUT)
    if int((a == 3).sum()) != len(eyes) or any(a[y, x] != 3 for x, y in eyes):
        errs.append("eye alpha texels mismatch")
    if int(((a != 3) & (a != 255)).sum()):
        errs.append("texture has alpha values other than 3/255")
    if not quiet:
        us = [r[0] for r in ratios] + [r[1] for r in ratios]
        print(f"verify: bones={len(names)} cubes={ncubes} locators={len(all_locs)} "
              f"faces={len(ratios)} px/texel min={min(us):.2f} max={max(us):.2f} "
              f"-> {'OK' if not errs else str(len(errs)) + ' ERRORS'}")
    return errs


def main():
    if "--check" not in sys.argv:
        geo = build()
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        text = dumps(geo)
        json.loads(text)
        with open(OUT, "w") as fh:
            fh.write(text)
        print(f"wrote {os.path.relpath(OUT, ROOT)}")
    errs = verify()
    for e in errs:
        print("ERROR:", e)
    if errs:
        sys.exit(1)


if __name__ == "__main__":
    main()
