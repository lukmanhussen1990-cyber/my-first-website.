"""Per-species overlay definitions for the six infected creatures.

Vanilla cube boxes below are rest-pose axis-aligned boxes derived from the
1.21.0.26 vanilla geometries (bind_pose / cube rotations of 90 degrees already
applied), so the overlay cubes need no bind-pose rotation of their own.  Bone
names, parents and pivots are copied from the vanilla geometry so the vanilla
animations (setup, walk, look_at_target, baby transforms, ...) move the overlay
exactly like the base model.  ``VANILLA_CHECK`` lets gen_infected.py re-derive
the boxes from the reference and assert they still match.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from infected_lib import PAL, Model, Part
from painters import Eye, Mouth, Site, SkinConfig

DELTA = 0.2          # overlay inflate on top of the vanilla cube's own inflate
GLOW_GAP = 0.06      # glow quads sit this far in front of the overlay surface

# crossed plane showing a whole 16x16 block texture; the south face is mirrored so both
# sides show the same texel at the same point (no visible z-fight if the material is two-sided)
MUSHROOM_UV = {"north": {"uv": [0, 0], "uv_size": [16, 16]}, "south": {"uv": [16, 0], "uv_size": [-16, 16]}}

WHITE = PAL["glow_white"]
RED = PAL["glow_red"]


@dataclass
class Spec:
    key: str                      # cow, pig, ...
    tex_size: tuple
    models: list = field(default_factory=list)       # overlay Models sharing one texture
    skin_cfgs: list = field(default_factory=list)    # (model, SkinConfig) per model
    extra_models: list = field(default_factory=list) # models with other textures (mushrooms)
    growth_bones: dict = field(default_factory=dict) # role -> [bone names] for animations
    vanilla_bones: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def skin(m: Model, bone: str, lo, size, vinf: float = 0.0, tag: str = "") -> Part:
    p = Part(origin=tuple(lo), size=tuple(size), inflate=vinf + DELTA, kind="skin", tag=tag or bone)
    m.get(bone).parts.append(p)
    return p


def glow_eyes(m: Model, parent: str, pivot, eyes, cols, name="glow_eyes", front_inflate=DELTA):
    """Zero-depth glow quads in front of the vanilla eye texels (emissive 'spider' material)."""
    b = m.bone(name, pivot, parent=parent)
    for e, c in zip(eyes, cols):
        p = Part(origin=(e.x0, e.y0, e.z - front_inflate - GLOW_GAP), size=(e.x1 - e.x0, e.y1 - e.y0, 0.0),
                 kind="glow", glow_face="north", meta={"cols": c})
        b.parts.append(p)
    return b


def parasite_head(m: Model, parent: str, name: str, base, rot, head=(5, 4, 4), stalk=(2, 3, 2), seed=1):
    """A small pale parasite head on a fleshy stalk, rooted at ``base`` (on the host surface)
    and pointing along the bone's local +Y, face toward local -Z."""
    bx, by, bz = base
    b = m.bone(name, base, parent=parent, rotation=rot)
    sx, sy, sz = stalk
    b.parts.append(Part(origin=(bx - sx / 2, by - 1.0, bz - sz / 2), size=(sx, sy + 1.0, sz), kind="stalk",
                        meta={"seed": seed}))
    hx, hy, hz = head
    hy0 = by + sy
    b.parts.append(Part(origin=(bx - hx / 2, hy0, bz - hz / 2), size=(hx, hy, hz), kind="head", meta={"seed": seed + 7}))
    # glow eyes on the head's front face, matching paint_parasite_head's layout
    ey = 1 if hy >= 4 else 0
    left_eye = 1 if hx >= 4 else 0
    right_eye = hx - 2 if hx >= 4 else hx - 1
    gb = m.bone("glow_" + name, base, parent=name)
    x0 = bx - hx / 2
    ytop = hy0 + hy
    for fx in (left_eye, right_eye):
        gb.parts.append(Part(origin=(x0 + fx, ytop - ey - 1, bz - hz / 2 - GLOW_GAP), size=(1.0, 1.0, 0.0),
                             kind="glow", glow_face="north", meta={"cols": [WHITE]}))
    return b


def tendril(m: Model, parent: str, name: str, base, rots, lens, thick=(2, 1, 1), claw=True, seed=1):
    """Angular spider-like limb: a chain of bones (name+'a', 'b', 'c'...), each segment along local +Y."""
    names = []
    par = parent
    x, y, z = base
    for i, (rot, L, t) in enumerate(zip(rots, lens, thick)):
        bn = f"{name}{'abcd'[i]}"
        b = m.bone(bn, (x, y, z), parent=par, rotation=rot)
        ov = 1.0 if i == 0 else 0.5
        last = i == len(lens) - 1
        b.parts.append(Part(origin=(x - t / 2, y - ov, z - t / 2), size=(t, L + ov, t),
                            kind="claw" if (claw and last) else "tendril", meta={"seed": seed + i}))
        names.append(bn)
        y += L
        par = bn
    return names


# ---------------------------------------------------------------------------
# cow
# ---------------------------------------------------------------------------

def build_cow() -> Spec:
    sp = Spec("cow", (128, 64))
    m = Model("geometry.pas.infected_cow", 128, 64, visible=(3.0, 2.5, (0.0, 1.0, 0.0)))
    m.bone("body", (0, 19, 2))
    m.bone("head", (0, 20, -8), parent="body")
    for i, (px, pz) in enumerate([(-4, 7), (4, 7), (-4, -6), (4, -6)]):
        m.bone(f"leg{i}", (px, 12, pz), parent="body")
    skin(m, "body", (-6, 12, -8), (12, 10, 18), tag="body")
    skin(m, "body", (-2, 11, 4), (4, 1, 6), tag="udder")
    skin(m, "head", (-4, 16, -14), (8, 8, 6), tag="head")
    skin(m, "head", (-5, 22, -12), (1, 3, 1), tag="horn")
    skin(m, "head", (4, 22, -12), (1, 3, 1), tag="horn")
    for i, (x, z) in enumerate([(-6, 5), (2, 5), (-6, -7), (2, -7)]):
        skin(m, f"leg{i}", (x, 0, z), (4, 12, 4), tag="leg")
    eyes = [Eye(-4, -2, 20, 21, -14, inner=+1), Eye(2, 4, 20, 21, -14, inner=-1)]
    glow_eyes(m, "head", (0, 20, -8), eyes, [[WHITE, RED], [RED, WHITE]])
    # parasitic lower jaw + fangs
    jaw = m.bone("pas_jaw", (0, 16, -10), parent="head", rotation=(14, 0, 0))
    jaw.parts.append(Part(origin=(-3, 14, -14), size=(6, 2, 4), kind="jaw", meta={"seed": 31}))
    head = m.get("head")
    head.parts.append(Part(origin=(-3, 14.5, -14.25), size=(1, 1.5, 1), kind="tooth"))
    head.parts.append(Part(origin=(2, 14.5, -14.25), size=(1, 1.5, 1), kind="tooth"))
    # growths
    parasite_head(m, "body", "pas_g0", (2, 22, 0), (18, 0, 22), head=(5, 4, 4), stalk=(2, 3, 2), seed=11)
    parasite_head(m, "body", "pas_g1", (-2.5, 22, 6), (-32, 0, -28), head=(3, 3, 3), stalk=(2, 2, 2), seed=21)
    t0 = tendril(m, "body", "pas_t0", (5, 21.5, -5), [(-10, 0, 62), (0, 0, 62), (0, 0, 34)], [6, 6, 3], seed=41)
    t1 = tendril(m, "body", "pas_t1", (-5, 21.5, -5), [(-10, 0, -62), (0, 0, -62), (0, 0, -34)], [6, 6, 3], seed=45)
    t2 = tendril(m, "body", "pas_t2", (5, 21.5, 6), [(22, 0, 55), (0, 0, 70), (0, 0, 30)], [5, 5, 3], seed=49)
    t3 = tendril(m, "body", "pas_t3", (-5, 21.5, 6), [(22, 0, -55), (0, 0, -70), (0, 0, -30)], [5, 5, 3], seed=53)
    sp.models.append(m)
    sp.growth_bones = {"heads": ["pas_g0", "pas_g1"], "tendrils": [t0, t1, t2, t3], "jaw": "pas_jaw"}
    cfg = SkinConfig(
        seed=101,
        sites=[Site((2, 22, 0), 3.0, veins=6, vein_len=10), Site((-2.5, 22, 6), 1.8, veins=4),
               Site((-6, 17, 3), 1.7, veins=4), Site((5, 21.5, -5), 1.2, flesh=False, veins=3, vein_len=6),
               Site((-5, 21.5, -5), 1.2, flesh=False, veins=3, vein_len=6)],
        eyes=eyes,
        mouths=[Mouth((-3, 15.9, -14.1), (3, 17.1, -11.5), drips=3, max_drip=2)],
        mottle=0.12, vein_walks=10, sores=9, fur_dark=True,
    )
    sp.skin_cfgs.append((m, cfg))
    # mooshroom mushrooms (vanilla block textures referenced by path, 16x16)
    mm = Model("geometry.pas.infected_cow.mushrooms", 16, 16, visible=(3.0, 2.5, (0.0, 1.0, 0.0)))
    mm.bone("body", (0, 19, 2))
    mm.bone("head", (0, 20, -8), parent="body")
    for i, (pos, par) in enumerate([((-3, 22, -4), "body"), ((3.5, 22, 5), "body"), ((-1, 24, -10), "head")]):
        for j, ry in enumerate((45, -45)):
            b = mm.bone(f"mushroom{i}{'ab'[j]}", pos, parent=par, rotation=(0, ry, 0))
            b.parts.append(Part(origin=(pos[0] - 5, pos[1], pos[2]), size=(10, 10, 0), kind="mush",
                                meta={"uv_json": MUSHROOM_UV}))
    sp.extra_models.append(mm)
    return sp


# ---------------------------------------------------------------------------
# pig
# ---------------------------------------------------------------------------

def build_pig() -> Spec:
    sp = Spec("pig", (128, 64))
    m = Model("geometry.pas.infected_pig", 128, 64, visible=(3.0, 2.0, (0.0, 0.75, 0.0)))
    m.bone("body", (0, 13, 2))
    m.bone("head", (0, 12, -6), parent="body")
    for i, (px, pz) in enumerate([(-3, 7), (3, 7), (-3, -5), (3, -5)]):
        m.bone(f"leg{i}", (px, 6, pz), parent="body")
    skin(m, "body", (-5, 6, -8), (10, 8, 16), tag="body")
    skin(m, "head", (-4, 8, -14), (8, 8, 8), tag="head")
    skin(m, "head", (-2, 9, -15), (4, 3, 1), tag="snout")
    for i, (x, z) in enumerate([(-5, 5), (1, 5), (-5, -7), (1, -7)]):
        skin(m, f"leg{i}", (x, 0, z), (4, 6, 4), tag="leg")
    eyes = [Eye(-4, -2, 12, 13, -14, inner=+1), Eye(2, 4, 12, 13, -14, inner=-1)]
    glow_eyes(m, "head", (0, 12, -6), eyes, [[WHITE, RED], [RED, WHITE]])
    jaw = m.bone("pas_jaw", (0, 8, -10), parent="head", rotation=(14, 0, 0))
    jaw.parts.append(Part(origin=(-3, 6, -14), size=(6, 2, 4), kind="jaw", meta={"seed": 32}))
    head = m.get("head")
    head.parts.append(Part(origin=(-3, 6.5, -14.25), size=(1, 1.5, 1), kind="tooth"))
    head.parts.append(Part(origin=(2, 6.5, -14.25), size=(1, 1.5, 1), kind="tooth"))
    parasite_head(m, "body", "pas_g0", (-1.5, 14, 1), (-12, 0, -18), head=(5, 4, 4), stalk=(2, 3, 2), seed=12)
    parasite_head(m, "body", "pas_g1", (2.5, 14, 5.5), (-38, 0, 30), head=(3, 3, 3), stalk=(2, 2, 2), seed=22)
    t0 = tendril(m, "body", "pas_t0", (4, 13.5, -4), [(-8, 0, 60), (0, 0, 66), (0, 0, 32)], [5, 5, 2], seed=42)
    t1 = tendril(m, "body", "pas_t1", (-4, 13.5, -4), [(-8, 0, -60), (0, 0, -66), (0, 0, -32)], [5, 5, 2], seed=46)
    t2 = tendril(m, "body", "pas_t2", (4, 13.5, 5), [(24, 0, 52), (0, 0, 70), (0, 0, 30)], [4, 5, 2], seed=50)
    t3 = tendril(m, "body", "pas_t3", (-4, 13.5, 5), [(24, 0, -52), (0, 0, -70), (0, 0, -30)], [4, 5, 2], seed=54)
    sp.models.append(m)
    sp.growth_bones = {"heads": ["pas_g0", "pas_g1"], "tendrils": [t0, t1, t2, t3], "jaw": "pas_jaw"}
    cfg = SkinConfig(
        seed=202,
        sites=[Site((-1.5, 14, 1), 2.6, veins=5, vein_len=9), Site((2.5, 14, 5.5), 1.6, veins=3),
               Site((5, 10, -2), 1.6, veins=3), Site((4, 13.5, -4), 1.0, flesh=False, veins=3, vein_len=6),
               Site((-4, 13.5, -4), 1.0, flesh=False, veins=3, vein_len=6)],
        eyes=eyes,
        mouths=[Mouth((-2.5, 7.9, -14.1), (2.5, 8.95, -12.0), drips=2, max_drip=2),
                Mouth((-2.05, 8.95, -15.1), (-0.95, 10.0, -14.9), drips=0),
                Mouth((0.95, 8.95, -15.1), (2.05, 10.0, -14.9), drips=0)],
        mottle=0.11, vein_walks=14, sores=9,
    )
    sp.skin_cfgs.append((m, cfg))
    return sp


# ---------------------------------------------------------------------------
# sheep (wool + sheared overlays share one texture)
# ---------------------------------------------------------------------------

def _sheep_model(identifier: str, sheared: bool, seed: int):
    m = Model(identifier, 128, 128, visible=(3.0, 2.5, (0.0, 1.0, 0.0)))
    m.bone("body", (0, 19, 2))
    m.bone("head", (0, 18, -8))
    for i, (px, pz) in enumerate([(-3, 7), (3, 7), (-3, -5), (3, -5)]):
        m.bone(f"leg{i}", (px, 12, pz), parent="body")
    skin(m, "head", (-3, 16, -14), (6, 6, 8), tag="face")
    if sheared:
        skin(m, "body", (-4, 12, -8), (8, 6, 16), tag="body")
        top = 18.0
        side = 4.0
    else:
        skin(m, "head", (-3, 16, -12), (6, 6, 6), vinf=0.6, tag="wool")
        skin(m, "body", (-4, 12, -8), (8, 6, 16), vinf=1.75, tag="wool")
        top = 19.75
        side = 5.75
    for i, (x, z) in enumerate([(-5, 5), (1, 5), (-5, -7), (1, -7)]):
        skin(m, f"leg{i}", (x, 0, z), (4, 12, 4), tag="leg")
        if not sheared:
            skin(m, f"leg{i}", (x, 6, z), (4, 6, 4), vinf=0.5, tag="wool")
    eyes = [Eye(-3, -1, 19, 20, -14, inner=+1), Eye(1, 3, 19, 20, -14, inner=-1)]
    glow_eyes(m, "head", (0, 18, -8), eyes, [[WHITE, RED], [RED, WHITE]])
    gy = top - 0.4
    parasite_head(m, "body", "pas_g0", (1, gy, 0.5), (16, 0, 20), head=(5, 4, 4), stalk=(2, 3, 2), seed=13)
    parasite_head(m, "body", "pas_g1", (-2, gy, 6), (-34, 0, -26), head=(3, 3, 3), stalk=(2, 2, 2), seed=23)
    s = side - 1.2
    t0 = tendril(m, "body", "pas_t0", (s, gy, -4), [(-10, 0, 60), (0, 0, 64), (0, 0, 32)], [5, 6, 3], seed=43)
    t1 = tendril(m, "body", "pas_t1", (-s, gy, -4), [(-10, 0, -60), (0, 0, -64), (0, 0, -32)], [5, 6, 3], seed=47)
    t2 = tendril(m, "body", "pas_t2", (s, gy, 5), [(24, 0, 54), (0, 0, 68), (0, 0, 30)], [4, 5, 3], seed=51)
    t3 = tendril(m, "body", "pas_t3", (-s, gy, 5), [(24, 0, -54), (0, 0, -68), (0, 0, -30)], [4, 5, 3], seed=55)
    gb = {"heads": ["pas_g0", "pas_g1"], "tendrils": [t0, t1, t2, t3]}
    cfg = SkinConfig(
        seed=seed,
        sites=[Site((1, top, 0.5), 2.8, veins=5, vein_len=10), Site((-2, top, 6), 1.8, veins=3),
               Site((-side, 14.5, -3), 1.8, veins=3), Site((s, top, -4), 1.0, flesh=False, veins=3, vein_len=6),
               Site((-s, top, -4), 1.0, flesh=False, veins=3, vein_len=6)],
        eyes=eyes,
        mouths=[Mouth((-1.6, 15.9, -14.1), (1.6, 17.2, -12.5), drips=3, max_drip=2)],
        mottle=0.10, vein_walks=14, sores=9,
    )
    return m, cfg, gb


def build_sheep() -> Spec:
    sp = Spec("sheep", (128, 128))
    m, cfg, gb = _sheep_model("geometry.pas.infected_sheep", False, 303)
    ms, cfgs, _ = _sheep_model("geometry.pas.infected_sheep.sheared", True, 304)
    sp.models += [m, ms]
    sp.skin_cfgs += [(m, cfg), (ms, cfgs)]
    sp.growth_bones = gb
    return sp


# ---------------------------------------------------------------------------
# chicken
# ---------------------------------------------------------------------------

def build_chicken() -> Spec:
    sp = Spec("chicken", (64, 64))
    m = Model("geometry.pas.infected_chicken", 64, 64, visible=(2.0, 1.75, (0.0, 0.6, 0.0)))
    m.bone("body", (0, 8, 0))
    m.bone("head", (0, 9, -4))
    m.bone("comb", (0, 9, -4), parent="head")
    m.bone("beak", (0, 9, -4), parent="head")
    m.bone("leg0", (-2, 5, 1))
    m.bone("leg1", (1, 5, 1))
    m.bone("wing0", (-3, 11, 0))
    m.bone("wing1", (3, 11, 0))
    skin(m, "body", (-3, 5, -4), (6, 6, 8), tag="body")
    skin(m, "head", (-2, 9, -6), (4, 6, 3), tag="head")
    skin(m, "comb", (-1, 9, -7), (2, 2, 2), tag="wattle")
    skin(m, "beak", (-2, 11, -8), (4, 2, 2), tag="beak")
    skin(m, "wing0", (-4, 7, -3), (1, 4, 6), tag="wing")
    skin(m, "wing1", (3, 7, -3), (1, 4, 6), tag="wing")
    eyes = [Eye(-2, -1, 13, 14, -6, inner=+1), Eye(1, 2, 13, 14, -6, inner=-1)]
    glow_eyes(m, "head", (0, 9, -4), eyes, [[RED], [RED]])   # white would vanish on white feathers
    parasite_head(m, "body", "pas_g0", (0.5, 11, 1.5), (-34, 0, 14), head=(3, 3, 3), stalk=(1, 2, 1), seed=14)
    t0 = tendril(m, "body", "pas_t0", (2.5, 10.5, 2.5), [(20, 0, 50), (0, 0, 70), (0, 0, 28)], [3, 3, 2],
                 thick=(1, 1, 1), seed=44)
    t1 = tendril(m, "body", "pas_t1", (-2.5, 10.5, 2.5), [(20, 0, -50), (0, 0, -70), (0, 0, -28)], [3, 3, 2],
                 thick=(1, 1, 1), seed=48)
    sp.models.append(m)
    sp.growth_bones = {"heads": ["pas_g0"], "tendrils": [t0, t1]}
    cfg = SkinConfig(
        seed=404,
        sites=[Site((0.5, 11, 1.5), 2.2, veins=5, vein_len=7), Site((3, 8, -1), 1.3, veins=3, vein_len=5)],
        eyes=eyes,
        mouths=[Mouth((-1.1, 10.9, -8.1), (1.1, 11.95, -7.3), drips=1, max_drip=1)],
        mottle=0.10, vein_walks=8, vein_len=5, sores=5, brows=True, tears=False,
    )
    sp.skin_cfgs.append((m, cfg))
    return sp


# ---------------------------------------------------------------------------
# villager (villager_v2 rig)
# ---------------------------------------------------------------------------

def build_villager() -> Spec:
    sp = Spec("villager", (128, 128))
    m = Model("geometry.pas.infected_villager", 128, 128, visible=(2.0, 3.0, (0.0, 1.25, 0.0)))
    m.bone("body", (0, 0, 0))
    m.bone("head", (0, 24, 0), parent="body")
    m.bone("nose", (0, 26, 0), parent="head")
    m.bone("arms", (0, 22, 0), parent="body")
    m.bone("leg0", (-2, 12, 0), parent="body")
    m.bone("leg1", (2, 12, 0), parent="body")
    skin(m, "head", (-4, 24, -4), (8, 10, 8), tag="head")
    skin(m, "nose", (-1, 23, -6), (2, 4, 2), tag="nose")
    skin(m, "body", (-4, 6, -3), (8, 18, 6), vinf=0.5, tag="robe")
    skin(m, "arms", (-4, 16, -2), (8, 4, 4), tag="arm")
    skin(m, "arms", (-8, 16, -2), (4, 8, 4), tag="arm")
    skin(m, "arms", (4, 16, -2), (4, 8, 4), tag="arm")
    skin(m, "leg0", (-4, 0, -2), (4, 12, 4), tag="leg")
    skin(m, "leg1", (0, 0, -2), (4, 12, 4), tag="leg")
    eyes = [Eye(-3, -1, 27, 28, -4, inner=+1), Eye(1, 3, 27, 28, -4, inner=-1)]
    glow_eyes(m, "head", (0, 24, 0), eyes, [[WHITE, RED], [RED, WHITE]])
    parasite_head(m, "body", "pas_g0", (-2.5, 22.5, 3.5), (-38, 0, -24), head=(5, 4, 4), stalk=(2, 3, 2), seed=15)
    parasite_head(m, "body", "pas_g1", (3.0, 24.0, 1.0), (-8, 0, 30), head=(3, 3, 3), stalk=(2, 2, 2), seed=25)
    t0 = tendril(m, "body", "pas_t0", (3, 22, 3.5), [(-30, 0, 48), (0, 0, 72), (0, 0, 32)], [6, 6, 3], seed=60)
    t1 = tendril(m, "body", "pas_t1", (-3, 21.5, 3.5), [(-30, 0, -48), (0, 0, -72), (0, 0, -32)], [6, 6, 3], seed=64)
    t2 = tendril(m, "body", "pas_t2", (2.5, 16, 3.5), [(-80, 0, 40), (0, 0, 60), (0, 0, 30)], [4, 5, 3], seed=68)
    t3 = tendril(m, "body", "pas_t3", (-2.5, 16, 3.5), [(-80, 0, -40), (0, 0, -60), (0, 0, -30)], [4, 5, 3], seed=72)
    sp.models.append(m)
    sp.growth_bones = {"heads": ["pas_g0", "pas_g1"], "tendrils": [t0, t1, t2, t3]}
    cfg = SkinConfig(
        seed=505,
        sites=[Site((-2.5, 22.5, 3.5), 3.0, veins=6, vein_len=10), Site((3, 24, 1), 2.0, veins=4),
               Site((3, 22, 3.5), 1.4, flesh=False, veins=3), Site((-3, 21.5, 3.5), 1.4, flesh=False, veins=3),
               Site((4.5, 12, -3.5), 2.0, veins=4)],
        eyes=eyes,
        mouths=[Mouth((-2.05, 24.95, -4.1), (2.05, 26.05, -3.0), drips=3, max_drip=2),
                Mouth((-1.1, 22.9, -6.1), (1.1, 24.3, -4.0), drips=1, max_drip=1)],
        mottle=0.09, vein_walks=9, sores=9,
    )
    sp.skin_cfgs.append((m, cfg))
    return sp


# ---------------------------------------------------------------------------
# human (geometry.humanoid.custom rig + steve texture)
# ---------------------------------------------------------------------------

def build_human() -> Spec:
    sp = Spec("human", (128, 128))
    m = Model("geometry.pas.infected_human", 128, 128, visible=(2.0, 3.0, (0.0, 1.25, 0.0)))
    m.bone("root", (0, 0, 0))
    m.bone("waist", (0, 12, 0), parent="root")
    m.bone("body", (0, 24, 0), parent="waist")
    m.bone("head", (0, 24, 0), parent="body")
    m.bone("rightArm", (-5, 22, 0), parent="body")
    m.bone("leftArm", (5, 22, 0), parent="body")
    m.bone("rightLeg", (-1.9, 12, 0), parent="root")
    m.bone("leftLeg", (1.9, 12, 0), parent="root")
    skin(m, "head", (-4, 24, -4), (8, 8, 8), tag="head")
    skin(m, "body", (-4, 12, -2), (8, 12, 4), tag="body")
    skin(m, "rightArm", (-8, 12, -2), (4, 12, 4), tag="arm")
    skin(m, "leftArm", (4, 12, -2), (4, 12, 4), tag="arm")
    skin(m, "rightLeg", (-3.9, 0, -2), (4, 12, 4), tag="leg")
    skin(m, "leftLeg", (-0.1, 0, -2), (4, 12, 4), tag="leg")
    eyes = [Eye(-3, -1, 27, 28, -4, inner=+1), Eye(1, 3, 27, 28, -4, inner=-1)]
    glow_eyes(m, "head", (0, 24, 0), eyes, [[WHITE, RED], [RED, WHITE]])
    parasite_head(m, "body", "pas_g0", (2.5, 23.5, 0.5), (-6, 0, 34), head=(5, 4, 4), stalk=(2, 3, 2), seed=16)
    parasite_head(m, "body", "pas_g1", (-1.5, 21, 2), (-58, 0, -18), head=(3, 3, 3), stalk=(2, 2, 2), seed=26)
    t0 = tendril(m, "body", "pas_t0", (3, 22, 2), [(-30, 0, 48), (0, 0, 72), (0, 0, 32)], [6, 6, 3], seed=61)
    t1 = tendril(m, "body", "pas_t1", (-3, 21.5, 2), [(-30, 0, -48), (0, 0, -72), (0, 0, -32)], [6, 6, 3], seed=65)
    t2 = tendril(m, "body", "pas_t2", (2.5, 16, 2), [(-80, 0, 40), (0, 0, 60), (0, 0, 30)], [4, 5, 3], seed=69)
    t3 = tendril(m, "body", "pas_t3", (-2.5, 16, 2), [(-80, 0, -40), (0, 0, -60), (0, 0, -30)], [4, 5, 3], seed=73)
    sp.models.append(m)
    sp.growth_bones = {"heads": ["pas_g0", "pas_g1"], "tendrils": [t0, t1, t2, t3]}
    cfg = SkinConfig(
        seed=606,
        sites=[Site((2.5, 23.5, 0.5), 2.2, veins=3, vein_len=8), Site((-1.5, 21, 2), 2.4, veins=4, vein_len=9),
               Site((-2, 17, -2), 1.5, veins=3), Site((2.5, 16, 2), 1.2, flesh=False, veins=2),
               Site((-6, 9, -2), 1.3, veins=2)],
        eyes=eyes,
        mouths=[Mouth((-2.05, 24.95, -4.1), (2.05, 26.05, -3.0), drips=3, max_drip=2)],
        mottle=0.08, vein_walks=9, sores=9,
    )
    sp.skin_cfgs.append((m, cfg))
    return sp


BUILDERS = {
    "cow": build_cow, "pig": build_pig, "sheep": build_sheep,
    "chicken": build_chicken, "villager": build_villager, "human": build_human,
}

# vanilla geometry each species' boxes were derived from: (file under models/, geometry id, {bone: [box,...]})
VANILLA_CHECK = {
    "cow": ("entity/cow.geo.json", "geometry.cow.v1.8"),
    "pig": ("entity/pig.geo.json", "geometry.pig.v1.8"),
    "sheep": ("entity/sheep.geo.json", "geometry.sheep.v1.8"),
    "chicken": ("entity/chicken.geo.json", "geometry.chicken.v1.12"),
    "villager": ("entity/villager_v2.geo.json", "geometry.villager_v2"),
    "human": ("mobs.json", "geometry.humanoid.custom"),
}
