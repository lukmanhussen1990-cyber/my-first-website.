#!/usr/bin/env python3
"""Generate geometry.horror.giant_spider (docs/MODEL.md; supersedes DESIGN.md section 4).

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

# ---------------------------------------------------------------------------- constants
# docs/MODEL.md is the authority for every number below (it supersedes DESIGN.md section 4).
BODY_PIVOT = (0, 208, 0)
TORSO_PIVOT = (0, 208, 0)
# The head, fangs and abdomen are designed at the original size and then scaled about
# BODY_PIVOT by BODY_SCALE in build() (pivots, cube origins, cube pivots and sizes).
BODY_SCALE = 1.4
HEAD_PIVOT = (0, 212, -50)          # -> (0, 213.6, -70) after scaling
FANG_L_PIVOT = (12, 182, -74)       # -> (16.8, 171.6, -103.6)
FANG_R_PIVOT = (-12, 182, -74)
ABDOMEN_PIVOT = (0, 214, 38)        # -> (0, 216.4, 53.2)

# Legs: three visible segments. The femur bone carries coxa + femur + knee, the tibia bone
# the tibia + the tibia/metatarsus joint, the foot bone the long metatarsus + tarsus + claw.
# MUST be identical to the constants block of tools/gen_client_anim.py.
HIP_X = 48
HIP_Y = 206
HIP_Z = [-34, -16, 2, 20]
K = [1.08, 1.00, 0.96, 1.04]
L1_BASE, L2_BASE, L3_BASE = 250.0, 327.0, 45.0
NEUTRAL_R_BASE = 256.0
NEUTRAL_A = [52.0, 20.0, -16.0, -48.0]

ABDOMEN_HANG = -14.0   # cube X rotation about the abdomen pivot (negative = rear end down)
VB_WIDTH, VB_HEIGHT, VB_OFFSET = 96, 72, [0, 34, 0]   # blocks; covers giant_scale 2.5
MAX_CUBES = 120                                       # phone budget

LEG_SIDES = (("l", 1), ("r", -1))  # side suffix, X sign (+X = left)


def rnd(x):
    """Round to 4 decimals and drop '.0' so the JSON stays readable and exact."""
    r = round(float(x), 4)
    if r == int(r):
        return int(r)
    return r


def vec(*xs):
    return [rnd(x) for x in xs]


def snap(x):
    """Round to 0.05 px (body scaling)."""
    return round(float(x) * 20.0) / 20.0


def body_scaled(p, s=BODY_SCALE, c=BODY_PIVOT):
    """p' = c + (p - c) * s, rounded to 0.05 (the BODY_SCALE step of build())."""
    return tuple(snap(c[i] + (p[i] - c[i]) * s) for i in range(3))


def leg_lengths(n):
    k = K[n - 1]
    return L1_BASE * k, L2_BASE * k, L3_BASE * k


def leg_points(side_sign, n):
    """Hip, knee (tibia pivot), ankle (foot pivot = tibia/metatarsus joint), tip (locator)."""
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
# Designed at the original size; build() scales torso/head/fangs/abdomen by BODY_SCALE.
def torso_cubes():
    """Cephalothorax: a wide plated block narrowing downward in steps (inverted pyramid seen
    from below, like the reference), an overhanging carapace shield, a low thoracic ridge
    and a sternum keel framed by the coxae of the eight legs."""
    return [
        # main cephalothorax block (80 x 46 x 88 -> 92 x 53 x 101)
        cube(-40, 40, 184, 230, -48, 40,
             box_faces("tor_end", "tor_end", "tor_side", "tor_side", "cara_top", "tor_under")),
        # lower taper: the cephalothorax narrows downward -> V cross-section (56 x 16 x 70)
        cube(-28, 28, 170, 186, -40, 30,
             box_faces("tor2_end", "tor2_end", "tor2_side", "tor2_side", "tor_under", "stern_down")),
        # carapace shield overhanging the sides (90 x 10 x 74 -> 104 wide)
        cube(-45, 45, 226, 236, -44, 30,
             box_faces("cara_end", "cara_end", "cara_side", "cara_side", "cara_top", "tor_under")),
        # low thoracic ridge behind the eye mound (22 x 7 x 54)
        cube(-11, 11, 235, 242, -40, 14,
             box_faces("ridge_end", "ridge_end", "ridge_side", "ridge_side", "ridge_top", "ridge_top")),
        # sternum keel (36 x 12 x 52)
        cube(-18, 18, 160, 172, -32, 20,
             box_faces("stern_end", "stern_end", "stern_side", "stern_side", "stern_down", "stern_down")),
    ]


PALP_HANG = 30.0   # length of the hanging pedipalp segment (px, before scaling)


def head_cubes():
    """Cephalic region: head block with the anterior eye row and two lens cubes (AME), a
    raised eye mound carrying the posterior row, and a pair of pedipalps (feelers) held
    forward-down beside the chelicerae."""
    cubes = [
        # head block (54 x 48 x 30 -> 62 x 55 x 35)
        cube(-27, 27, 188, 236, -78, -48,
             box_faces("head_front", "head_side", "head_side", "head_side", "head_top", "head_under")),
        # raised eye mound / ocular tubercle (34 x 12 x 18), posterior eye row on its front
        cube(-17, 17, 234, 246, -76, -58,
             box_faces("mound_front", "mound_top", "mound_side", "mound_side", "mound_top", "mound_top")),
    ]
    lens = box_faces("eye_bump", "bump_side", "bump_side", "bump_side", "bump_side", "bump_side")
    for sx in (1, -1):
        # anterior median eye: a small lens cube standing 3 px out of the head front (7 x 7 x 4)
        x0, x1 = sorted((sx * 3, sx * 10))
        cubes.append(cube(x0, x1, 216, 223, -81, -77, lens))
    for sx in (1, -1):
        # pedipalp: femur segment reaching forward-down, then the tibia/tarsus hanging and
        # pointing forward -> two small "feelers" in front of the fangs
        px, py, pz = sx * 26, 186, -62
        cubes.append(cube(px - 5, px + 5, py - 5, py + 5, pz - 38, pz,
                          box_faces("palp_end", "palp_end", "palp_long", "palp_long", "palp_vert",
                                    "palp_vert"),
                          pivot=(px, py, pz), rotation=(40, 0, 0)))
        ex = px
        ey = py - 36 * math.sin(math.radians(40))
        ez = pz - 36 * math.cos(math.radians(40))
        cubes.append(cube(ex - 4, ex + 4, ey - (PALP_HANG - 2), ey + 2, ez - 4, ez + 4,
                          box_faces("palp_vert", "palp_vert", "palp_vert", "palp_vert", "palp_end",
                                    "palp_end"),
                          pivot=(ex, ey, ez), rotation=(-28, 0, -8 * sx)))
    return cubes


def fang_cubes(sign):
    """Chelicera (hanging basal segment, moves with the fang bone) + a two-part fang hooking
    inward and back under it. Short, so the fangs read as fangs and not as a beard."""
    px, py, pz = FANG_L_PIVOT if sign > 0 else FANG_R_PIVOT
    chel = box_faces("chel_front", "chel_side", "chel_side", "chel_side", "chel_end", "chel_end")
    fang = {"north": "fang_side", "south": "fang_side", "east": "fang_side",
            "west": "fang_side", "up": "fang_end", "down": "fang_end"}
    tip = {"north": "fangtip_side", "south": "fangtip_side", "east": "fangtip_side",
           "west": "fangtip_side", "up": "fangtip_end", "down": "fangtip_end"}
    cx = px - sign * 0.5
    return [
        # chelicera (18 x 34 x 24), leaning forward a little at the bottom
        cube(cx - 9, cx + 9, py - 26, py + 8, pz - 14, pz + 10, chel,
             pivot=(px, py, pz), rotation=(-8, 0, 0)),
        # fang base folded inward under the chelicera (9 x 16 x 9)
        cube(cx - 4.5, cx + 4.5, py - 46, py - 30, pz - 13, pz - 4, fang,
             pivot=(cx, py - 32, pz - 8), rotation=(14, 0, 16 * sign)),
        # hooked tip, bent further inward/back (6 x 14 x 6); the two tips end ~2 px apart
        # at the midline instead of crossing
        cube(cx - 3 - sign * 2, cx + 3 - sign * 2, py - 58, py - 44, pz - 10, pz - 4, tip,
             pivot=(cx - sign * 2, py - 46, pz - 7), rotation=(26, 0, 30 * sign)),
    ]


def abdomen_cubes():
    p = ABDOMEN_PIVOT
    rot = (ABDOMEN_HANG, 0, 0)

    def ac(x0, x1, y0, y1, z0, z1, faces):
        return cube(x0, x1, y0, y1, z0, z1, faces, pivot=p, rotation=rot)

    pet = {f: "petiole" for f in FACES}
    spin = box_faces("spin_end", "spin_end", "spin_side", "spin_side", "spin_top", "spin_top")
    bulb = box_faces("abd_end", "abd_end", "abd_side", "abd_side", "abd_top", "abd_under")
    return [
        # petiole (waist) joining the cephalothorax (28 x 22 x 16)
        ac(-14, 14, 200, 222, 34, 50, pet),
        # front block (66 x 56 x 24)
        ac(-33, 33, 180, 236, 46, 70,
           box_faces("abd_front", "abd_front", "abd1_side", "abd1_side", "abd1_top", "abd1_under")),
        # main bulb, upper widest tier (100 x 62 x 104 -> 115 x 71 x 120)
        ac(-50, 50, 186, 248, 66, 170, bulb),
        # rounding slab through the bulb: wider and shorter, so the abdomen reads oval from
        # the front, back and top (110 x 46 x 80)
        ac(-55, 55, 194, 240, 78, 158, bulb),
        # belly, middle tier (80 x 32 x 90)
        ac(-40, 40, 156, 188, 74, 164,
           box_faces("belly_end", "belly_end", "belly_side", "belly_side", "belly_down", "belly_down")),
        # ventral keel, lowest tier -> teardrop / inverted-V silhouette (48 x 16 x 60)
        ac(-24, 24, 142, 158, 90, 150,
           box_faces("keel_end", "keel_end", "keel_side", "keel_side", "keel_down", "keel_down")),
        # rear taper (70 x 66 x 26)
        ac(-35, 35, 172, 238, 168, 194,
           box_faces("abd_rear", "abd_rear", "abd3_side", "abd3_side", "abd1_top", "abd1_under")),
        # dorsal shield plate with the folium (66 x 7 x 76)
        ac(-33, 33, 247, 254, 80, 156,
           box_faces("abd_plate_side", "abd_plate_side", "abd_plate_side", "abd_plate_side",
                     "abd_plate", "abd_plate")),
        # paired spinnerets at the rear tip (9 x 12 x 20 each)
        ac(-13, -4, 184, 196, 190, 210, spin),
        ac(4, 13, 184, 196, 190, 210, spin),
    ]


# ---------------------------------------------------------------------------- legs
# Cross-sections (px). Reference: a thick square upper leg rising steeply to a high knee and
# ONE long, straight, much thinner lower leg (tibia + short tip) standing almost vertically.
COXA = 52                     # coxa collar where the leg leaves the body
FEMUR_W = [48, 44, 44, 44]    # Z width per pair (pair 1 heavier)
FEMUR_H = [50, 46, 46, 46]    # Y height per pair
KNEE = 54                     # big overlapping knee block
TIB = 24                      # the long straight lower leg (~0.58 of the femur)
TIP = 18                      # tapering tip segments of the lower leg
TIP2 = 12
CLAW = 8


def limb_region(base, face, sign, mirrored=True):
    """Pick `base` or its mirror `base_f` so the region's high-U end is the DISTAL end.

    U grows toward +X on north/up/down faces and toward -X on south faces (per-face UV
    convention of the viewer/Blockbench); left legs extend toward +X (sign +1), right legs
    toward -X (sign -1)."""
    if not mirrored or face in ("east", "west"):
        return base
    distal_high = (sign > 0) if face in ("north", "up", "down") else (sign < 0)
    return base if distal_high else base + "_f"


def limb(sign, x0, x1, base_x, y0, y1, z0, z1, side, top, under, end, mirrored=True,
         pivot=None, rotation=None):
    """X-aligned limb cube from a..b outward of base_x; long faces use mirrored regions."""
    faces = {
        "north": limb_region(side, "north", sign, mirrored),
        "south": limb_region(side, "south", sign, mirrored),
        "up": limb_region(top, "up", sign, mirrored),
        "down": limb_region(under, "down", sign, mirrored),
        "east": end, "west": end,
    }
    return cube(*xspan(sign, x0, x1, base_x), y0, y1, z0, z1, faces, pivot=pivot,
                rotation=rotation)


def block(sign, centre, half, base_x, hy, z, side, end):
    """Cube of edge 2*half centred `centre` px outward of base_x (knee / joint blocks)."""
    return cube(*xspan(sign, centre - half, centre + half, base_x), hy - half, hy + half,
                z - half, z + half, limb_faces(side, side, end))


def leg_bones(side, sign, n):
    pts = leg_points(sign, n)
    L1, L2, L3 = leg_lengths(n)
    hx, hy, z = pts["hip"]
    kx = pts["knee"][0]
    ax = pts["ankle"][0]
    w2, h2 = FEMUR_W[n - 1] / 2, FEMUR_H[n - 1] / 2
    c2, t2, p2, q2, k2 = COXA / 2, TIB / 2, TIP / 2, TIP2 / 2, CLAW / 2

    femur = [
        # coxa collar where the leg leaves the body (46 long, 56 thick)
        limb(sign, -14, 32, hx, hy - c2, hy + c2, z - c2, z + c2,
             "coxa_side", "coxa_side", "coxa_side", "coxa_end"),
        # femur beam: from inside the coxa into the knee block (thick stripped-wood beam)
        limb(sign, 24, L1 + 10, hx, hy - h2, hy + h2, z - w2, z + w2,
             "fem_side", "fem_top", "fem_under", "fem_end"),
        # big knee block (60 cube) centred on the knee
        block(sign, L1, KNEE / 2, hx, hy, z, "knee", "knee_cap"),
    ]
    tibia = [
        # the long straight lower leg (30 thick): from inside the knee block to the tip joint
        limb(sign, -16, L2 + 6, kx, hy - t2, hy + t2, z - t2, z + t2,
             "tib_side", "tib_side", "tib_under", "tib_end"),
    ]
    foot = [
        # tip of the lower leg, continuing the same line and tapering to a point
        limb(sign, -4, 0.55 * L3, ax, hy - p2, hy + p2, z - p2, z + p2,
             "tar_side", "tar_side", "tar_side", "tar_end"),
        limb(sign, 0.5 * L3, 0.85 * L3, ax, hy - q2, hy + q2, z - q2, z + q2,
             "claw_side", "claw_side", "claw_side", "claw_end"),
        limb(sign, 0.8 * L3, L3, ax, hy - k2, hy + k2, z - k2, z + k2,
             "claw_side", "claw_side", "claw_side", "claw_end"),
    ]
    sfx = f"{side}{n}"
    return [
        {"name": f"hip_{sfx}", "parent": "body", "pivot": vec(*pts["hip"])},
        {"name": f"femur_{sfx}", "parent": f"hip_{sfx}", "pivot": vec(*pts["hip"]), "cubes": femur},
        {"name": f"tibia_{sfx}", "parent": f"femur_{sfx}", "pivot": vec(*pts["knee"]), "cubes": tibia},
        {"name": f"foot_{sfx}", "parent": f"tibia_{sfx}", "pivot": vec(*pts["ankle"]), "cubes": foot,
         "locators": {f"foot_tip_{sfx}": vec(*pts["tip"])}},
    ]


def scale_bone(b, s=BODY_SCALE):
    """Apply the BODY_SCALE step to one bone: pivot, cube origins, cube pivots and sizes."""
    b["pivot"] = vec(*body_scaled(b["pivot"], s))
    for c in b.get("cubes", []):
        c["origin"] = vec(*body_scaled(c["origin"], s))
        c["size"] = [rnd(snap(x * s)) for x in c["size"]]
        if "pivot" in c:
            c["pivot"] = vec(*body_scaled(c["pivot"], s))
    return b


SCALED_BONES = ("torso", "head", "fang_l", "fang_r", "abdomen")


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
    for b in bones:
        if b["name"] in SCALED_BONES:
            scale_bone(b)
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
                "visible_bounds_width": VB_WIDTH,
                "visible_bounds_height": VB_HEIGHT,
                "visible_bounds_offset": VB_OFFSET,
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
    """Independent re-statement of the docs/MODEL.md pivot formulas."""
    def bs(p):  # body scale 1.4 about (0, 208, 0), rounded to 0.05
        return tuple(round((c + (x - c) * 1.4) * 20) / 20 for x, c in zip(p, (0, 208, 0)))
    e = {"root": (0, 0, 0), "body": (0, 208, 0), "torso": (0, 208, 0),
         "head": bs((0, 212, -50)), "fang_l": bs((12, 182, -74)), "fang_r": bs((-12, 182, -74)),
         "abdomen": bs((0, 214, 38))}
    loc = {}
    for s, sg in (("l", 1), ("r", -1)):
        for n in range(1, 5):
            k = [1.08, 1.00, 0.96, 1.04][n - 1]
            L1, L2, L3 = 250 * k, 327 * k, 45 * k
            hip = (sg * 48, 206, [-34, -16, 2, 20][n - 1])
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
    S = gen_texture.SIZE
    if (d.get("texture_width"), d.get("texture_height")) != (S, S):
        errs.append(f"texture size must be {S}x{S}")
    if (d.get("visible_bounds_width"), d.get("visible_bounds_height"),
            d.get("visible_bounds_offset")) != (96, 72, [0, 34, 0]):
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
    if img.shape != (S, S, 4):
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
                if not (0 <= u and u + w <= S and 0 <= v and v + h <= S and w > 0 and h > 0):
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
    if ncubes > MAX_CUBES:
        errs.append(f"{ncubes} cubes > {MAX_CUBES} (phone budget)")
    # density sanity: no face absurdly stretched (> 6 px/texel on the giant) or squashed (< 0.9)
    for ru, rv, bn, f, reg in ratios:
        if not (0.9 <= ru <= 6.0 and 0.9 <= rv <= 6.0):
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
