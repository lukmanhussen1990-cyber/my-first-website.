"""Soul Reaper - a tall scythe with a crescent blade burning with green soul-fire."""
import math

from ..modelkit import *  # noqa: F401,F403
from ..parts import ring, shaft
from ..anim import Key
from ..kinematics import Pose
from ..icons import scythe_icon

TOP = 45.0
R = 15.0
SEGMENTS = 9
SWEEP = 104.0


def build():
    m = Model('soul_scythe', 256, 256)
    m.bone('root', None, (0, 24, 0), binding='q.item_slot_to_bone_name(c.item_slot)')
    m.bone('weapon', 'root', (0, 24, 0))
    for n in ('shaft', 'trim', 'heel'):
        m.bone(n, 'weapon', (0, 24, 0))
    ebony = wood_grain(EBONY, seed=111)
    ebony_cap = slab(EBONY, bevel=1, seed=112)
    wrap = leather_wrap(SHADOW, 3, seed=113)
    bone = slab(BONE, bevel=1, noise=0.05, seed=114)
    bone_dark = slab(BONE, bevel=1, noise=0.09, vgrad=-0.5, seed=115)
    blade_m = blade_face(DARKSTEEL, fuller=True, edge_pal=BONE, seed=116)
    edge_in = edge_strip(SOUL, seed=117)
    edge_out = edge_strip(DARKSTEEL, seed=119)
    cap_m = slab(DARKSTEEL, bevel=1, seed=118)

    shaft(m, 'shaft', 2.0, 44.0, 1.0, ebony, ebony_cap)
    m.box('shaft', (-1.15, 19.0, -1.15), (2.3, 10.0, 2.3), x=wrap, z=wrap, y=ebony_cap)
    for ry, rh in ((2.2, 1.1), (11.0, 0.9), (18.6, 0.9), (29.2, 0.9), (41.6, 1.2)):
        ring(m, 'trim', ry, 1.3, rh, bone)
    m.box('trim', (-0.7, -0.6, -0.7), (1.4, 3.0, 1.4), x=bone_dark, z=bone_dark, y=bone)
    # heel bracket where the blade meets the shaft
    m.box('heel', (-1.5, 43.0, -1.9), (3.0, 2.6, 3.8), x=bone, z=bone, y=bone)

    # crescent blade: arc of rotated segments (cutting edge on the inside of the curve, facing -Z/down)
    glow_edges = []
    for i in range(SEGMENTS):
        phi = SWEEP * (i + 0.5) / SEGMENTS
        cy = TOP - R
        py = cy + R * math.cos(math.radians(phi))
        pz = -R * math.sin(math.radians(phi))
        width = 5.0 - 4.1 * (i / (SEGMENTS - 1)) ** 1.2      # taper heel -> tip
        seglen = (2 * math.pi * R * SWEEP / 360.0) / SEGMENTS + 0.5
        nm = 'blade_%d' % i
        m.bone(nm, 'weapon', (0, py, pz), rotation=[90.0 + phi, 0, 0])
        m.box(nm, (-0.7, py - seglen / 2, pz - width / 2), (1.4, seglen, width), x=blade_m, z=(edge_in, edge_out), y=cap_m)
        glow_edges.append((nm, py, pz, seglen, width))

    # ---------- glow layers ----------
    edge_glow = strip_glow(SOUL, fade=False)
    for i, (nm, py, pz, seglen, width) in enumerate(glow_edges):
        gn = 'glow_edge_%d' % i
        m.bone(gn, nm, (0, py, pz))
        # inner (concave) edge is the local -Z face
        m.box(gn, (-0.5, py - seglen / 2 + 0.1, pz - width / 2 - 0.07), (1.0, seglen - 0.2, 0.07), z=edge_glow)
    m.bone('glow_soul', 'weapon', (0, 44, -1.5))
    soul_gem = gem(SOUL, seed=15)
    m.box('glow_soul', (-1.5, 42.4, -3.2), (3.0, 3.0, 3.0), x=soul_gem, z=soul_gem, y=soul_gem)
    for nm in ('glow_wisp_a', 'glow_wisp_b'):
        m.bone(nm, 'weapon', (0, 47, -8))
    wisp_a = flame_cutout(SOUL, seed=121, tongues=2, core=False)
    wisp_b = flame_cutout(SOUL, seed=122, tongues=2, core=False)
    m.box('glow_wisp_a', (-0.05, 44.5, -13.0), (0.1, 6.0, 9.0), x=wisp_a)
    m.box('glow_wisp_b', (-3.5, 44.5, -8.55), (7.0, 6.0, 0.1), z=wisp_b)
    return m


SPEC = dict(
    id='soul_scythe', name='Soul Reaper', title='§aSoul Reaper', element='soul',
    damage=9, durability=1800, enchant=15,
    repair=['minecraft:soul_sand'],
    cooldown=14.0, cast_len=1.3,
    hold=dict(first=[8, -6, -52, (3.5, -6.5, 2.5)], third=[10, 6, 0, (0.3, 0, 0.5)]),
    flicker=[('glow_wisp_a', 4.5, 0.18, 0), ('glow_wisp_b', 5.2, 0.2, 80)],
    spin=[],
    fp_swing=[
        Pose(0.00, 8, -6, -52, (3.5, -6.5, 2.5), 'out2'),
        Pose(0.12, 6, 20, -38, (6.0, -3.0, 3.5), 'in'),
        Pose(0.30, 24, -52, -82, (-3.5, -6.5, 6.0), 'out'),
        Pose(0.46, 30, -68, -92, (-6.5, -7.5, 6.5), 'smooth'),
        Pose(0.70, 16, -34, -66, (-1.0, -6.8, 4.0), 'smooth'),
        Pose(0.90, 9, -10, -54, (3.0, -6.6, 2.8), 'smooth'),
        Pose(1.00, 8, -6, -52, (3.5, -6.5, 2.5)),
    ],
    fp_cast=[
        Pose(0.00, 8, -6, -52, (3.5, -6.5, 2.5), 'out'),
        Pose(0.30, -6, 24, -34, (5.0, -2.0, 3.5), 'smooth'),
        Pose(0.56, -10, 30, -30, (5.5, 0.5, 4.0), 'in'),
        Pose(0.70, 26, -62, -86, (-6.0, -6.8, 7.0), 'out'),       # wide sweep across
        Pose(0.86, 34, -74, -96, (-7.0, -7.8, 7.5), 'smooth'),
        Pose(1.04, 18, -36, -68, (-1.5, -6.8, 4.5), 'smooth'),
        Pose(1.30, 8, -6, -52, (3.5, -6.5, 2.5)),
    ],
    tp_swing={'weapon': [
        Key(0.00, (0, 0, 0), (0, 0, 0), 'out2'),
        Key(0.10, (-14, 34, -6), (0, 0.6, 1.0), 'in'),
        Key(0.28, (30, -52, 8), (0, -1.0, -2.8), 'out'),
        Key(0.44, (40, -78, 10), (0, -1.6, -3.6), 'smooth'),
        Key(0.68, (16, -30, 4), (0, -0.6, -1.2), 'smooth'),
        Key(0.90, (-3, 4, -1), (0, 0.1, 0.2), 'smooth'),
        Key(1.00, (0, 0, 0), (0, 0, 0)),
    ]},
    tp_cast={'weapon': [
        Key(0.00, (0, 0, 0), (0, 0, 0), 'out'),
        Key(0.30, (-24, 52, 6), (0, 2.0, 2.5), 'smooth'),
        Key(0.56, (-30, 70, 8), (0, 3.0, 3.0), 'in'),
        Key(0.70, (30, -90, 8), (0, -2.0, -5.0), 'out'),
        Key(0.86, (36, -150, 10), (0, -2.5, -6.0), 'smooth'),
        Key(1.04, (16, -60, 4), (0, -1.0, -2.0), 'smooth'),
        Key(1.30, (0, 0, 0), (0, 0, 0)),
    ]},
    recipe=dict(
        pattern=['SSS', ' H ', ' B '],
        key={'S': 'minecraft:soul_sand', 'H': 'minecraft:diamond_hoe', 'B': 'minecraft:blaze_rod'},
        unlock='minecraft:soul_sand'),
    icon=lambda: scythe_icon(DARKSTEEL, SOUL, EBONY, BONE),
)
