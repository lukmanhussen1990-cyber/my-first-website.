"""Frostbite - a two-handed ice greatsword with a crystalline blade."""
from ..modelkit import *  # noqa: F401,F403
from ..anim import Key
from ..kinematics import Pose
from ..icons import sword_icon


def build():
    m = Model('frostbite', 256, 256)
    m.bone('root', None, (0, 24, 0), binding='q.item_slot_to_bone_name(c.item_slot)')
    m.bone('weapon', 'root', (0, 24, 0))
    for n in ('grip', 'guard', 'blade', 'pommel'):
        m.bone(n, 'weapon', (0, 24, 0))

    blade_face_m = blade_face(FROST, fuller=True, edge_pal=ICE, seed=31, heat=ICE, heat_amount=0.6, heat_reach=0.55)
    trim_face = blade_face(SILVER, fuller=False, edge_pal=SILVER, seed=32)
    edge = edge_strip(FROST, seed=33)
    cap = slab(FROST, bevel=1, seed=34)
    silver = slab(SILVER, bevel=1, noise=0.04, seed=35)
    silver_dark = slab(SILVER, bevel=1, noise=0.07, vgrad=-0.5, seed=36)
    wrap = leather_wrap(NAVY, 3, seed=37)

    # grip (two-handed, 12 long)
    m.box('grip', (-1.1, 17.8, -1.1), (2.2, 12.0, 2.2), x=wrap, z=wrap, y=silver_dark)
    for gy in (17.6, 23.2, 29.0):
        m.box('grip', (-1.45, gy, -1.45), (2.9, 0.9, 2.9), x=silver, z=silver, y=silver)

    # pommel: silver collar around a glowing ice crystal (glow bone)
    m.box('pommel', (-1.8, 16.6, -1.8), (3.6, 1.2, 3.6), x=silver, z=silver, y=silver)
    m.box('pommel', (-1.0, 13.2, -1.0), (2.0, 0.8, 2.0), x=silver_dark, z=silver_dark, y=silver)

    # guard: swept-back, stepped wings
    m.box('guard', (-1.3, 29.8, -2.4), (2.6, 1.8, 4.8), x=silver, z=silver, y=silver)
    for sz in (-1, 1):
        for (z0, z1, y0, y1) in ((2.4, 5.2, 29.5, 31.3), (5.2, 7.6, 28.7, 30.3), (7.6, 9.0, 27.9, 29.3)):
            lo, hi = (z0, z1) if sz > 0 else (-z1, -z0)
            m.box('guard', (-1.1, y0, lo), (2.2, y1 - y0, hi - lo), x=silver, z=silver, y=silver)

    # blade: ricasso + long wide body + taper
    steps = [
        (31.6, 1.8, 5.6, 2.1, trim_face),
        (33.4, 13.8, 6.2, 1.9, blade_face_m),
        (47.2, 2.4, 5.4, 1.8, blade_face_m),
        (49.6, 2.0, 4.2, 1.7, blade_face_m),
        (51.6, 1.6, 3.0, 1.5, blade_face_m),
        (53.2, 1.0, 1.8, 1.3, blade_face_m),
        (54.2, 0.6, 0.8, 1.0, blade_face_m),
    ]
    for (y0, h, wz, tx, face) in steps:
        m.box('blade', (-tx / 2, y0, -wz / 2), (tx, h, wz), x=face, z=edge, y=cap)

    # ---------- glow layers ----------
    for n in ('glow_core', 'glow_crystals', 'glow_mist_a', 'glow_mist_b'):
        m.bone(n, 'weapon', (0, 42, 0) if 'mist' in n else (0, 24, 0))
    ice_gem = gem(ICE, seed=5)
    ice_glow = glow_solid(FROST, t=0.8)
    vein = vein_cutout(FROST, seed=41, branch=0.18)
    rime = strip_glow(FROST, fade=False)

    for sx in (-1, 1):
        ox = 0.97 if sx > 0 else -1.03
        m.box('glow_core', (ox, 34.0, -1.0), (0.06, 16.0, 2.0), x=vein)
    for sz in (-1, 1):
        oz = 3.13 if sz > 0 else -3.19
        m.box('glow_core', (-0.5, 33.6, oz), (1.0, 13.6, 0.06), z=rime)
    m.box('glow_core', (-1.4, 29.4, -1.4), (2.8, 2.4, 2.8), x=ice_gem, z=ice_gem, y=ice_gem)
    m.box('glow_core', (-0.9, 14.3, -0.9), (1.8, 2.2, 1.8), x=ice_glow, z=ice_glow, y=ice_glow)

    # jagged ice crystals growing off the back edge
    cr = crystal(ICE, seed=7)
    for i, (y0, h, d) in enumerate(((36.0, 3.6, 1.8), (40.0, 3.0, 1.5), (43.6, 3.4, 1.7), (47.0, 2.6, 1.3), (49.8, 2.0, 1.0))):
        m.box('glow_crystals', (-0.7, y0, 3.0), (1.4, h, d), x=cr, z=cr, y=cr)
    for i, (y0, h, d) in enumerate(((38.0, 3.0, 1.4), (42.0, 3.2, 1.6), (45.6, 2.6, 1.2))):
        m.box('glow_crystals', (-0.7, y0, -3.0 - d), (1.4, h, d), x=cr, z=cr, y=cr)

    # drifting frost mist (alpha-cutout flames in icy colours)
    mist_a = flame_cutout(FROST, seed=51, tongues=2, core=False)
    mist_b = flame_cutout(FROST, seed=52, tongues=3, core=False)
    m.box('glow_mist_a', (-0.05, 36.0, -3.6), (0.1, 12.0, 7.2), x=mist_a)
    m.box('glow_mist_b', (-3.6, 36.0, -0.05), (7.2, 12.0, 0.1), z=mist_b)

    # snowflake motes orbiting the blade
    spark = spark_cutout(FROST, seed=3, rays=8)
    for i in range(3):
        nm = 'glow_mote_%d' % i
        m.bone(nm, 'weapon', (0, 44.0 - i * 3, 0))
        r = 4.4 + 0.5 * i
        m.box(nm, (-0.05, 44.0 - i * 3 - 0.9, r - 0.9), (0.1, 1.8, 1.8), x=spark)
    return m


SPEC = dict(
    id='frostbite', name='Frostbite', title='§bFrostbite', element='ice',
    damage=10, durability=1900, enchant=14,
    repair=['minecraft:blue_ice'],
    cooldown=12.0, cast_len=1.25,
    hold=dict(first=[22, -26, -42, (0.5, -9.5, 3.5)], third=[60, 6, 0, (0, 0, 0.5)]),
    flicker=[('glow_mist_a', 4.0, 0.12, 0), ('glow_mist_b', 4.6, 0.14, 80)],
    spin=[('glow_mote_0', 'y', 70.0, 0.0), ('glow_mote_1', 'y', -55.0, 120.0), ('glow_mote_2', 'y', 90.0, 240.0)],
    fp_swing=[
        Pose(0.00, 22, -26, -42, (0.5, -9.5, 3.5), 'out2'),
        Pose(0.12, -14, 16, -12, (5.5, -0.5, 3.5), 'in'),
        Pose(0.28, 40, -30, -60, (-1.5, -6.5, 6.5), 'out'),
        Pose(0.44, 58, -48, -80, (-5.5, -8.5, 7.0), 'smooth'),
        Pose(0.68, 26, -30, -48, (-1.0, -7.0, 4.5), 'smooth'),
        Pose(0.88, 24, -26, -42, (0.8, -9.3, 3.4), 'smooth'),
        Pose(1.00, 22, -26, -42, (0.5, -9.5, 3.5)),
    ],
    fp_cast=[
        Pose(0.00, 22, -26, -42, (0.5, -9.5, 3.5), 'out'),
        Pose(0.22, -12, 10, -20, (4.0, -0.5, 3.5), 'smooth'),
        Pose(0.46, -22, 14, -12, (5.0, 3.5, 3.5), 'in'),          # raised high
        Pose(0.58, 60, -12, -45, (0.5, -8.0, 7.5), 'out'),        # plunge
        Pose(0.68, 108, -8, -40, (0.0, -10.5, 8.0), 'smooth'),    # planted in the ground
        Pose(0.98, 104, -8, -40, (0.0, -10.2, 8.0), 'smooth'),
        Pose(1.25, 22, -26, -42, (0.5, -9.5, 3.5)),
    ],
    tp_swing={'weapon': [
        Key(0.00, (0, 0, 0), (0, 0, 0), 'out2'),
        Key(0.10, (-24, 8, -8), (0, 1.0, 1.6), 'in'),
        Key(0.28, (52, -12, 12), (0, -1.4, -3.6), 'out'),
        Key(0.44, (70, -20, 18), (0, -2.2, -5.0), 'smooth'),
        Key(0.66, (30, -8, 6), (0, -0.8, -1.8), 'smooth'),
        Key(0.86, (-5, 2, -1), (0, 0.1, 0.3), 'smooth'),
        Key(1.00, (0, 0, 0), (0, 0, 0)),
    ]},
    tp_cast={'weapon': [
        Key(0.00, (0, 0, 0), (0, 0, 0), 'out'),
        Key(0.22, (-44, 0, 10), (0, 2.5, 3.5), 'smooth'),
        Key(0.46, (-70, 8, 18), (0, 4.5, 5.5), 'in'),
        Key(0.58, (70, -6, -6), (0, -3.5, -6.0), 'out'),
        Key(0.66, (100, -8, -8), (0, -5.0, -8.0), 'smooth'),
        Key(0.98, (96, -8, -8), (0, -5.0, -8.0), 'smooth'),
        Key(1.25, (0, 0, 0), (0, 0, 0)),
    ]},
    recipe=dict(
        pattern=[' I ', 'PDP', ' I '],
        key={'I': 'minecraft:blue_ice', 'P': 'minecraft:prismarine_crystals', 'D': 'minecraft:diamond_sword'},
        unlock='minecraft:blue_ice'),
    icon=lambda: sword_icon(FROST, glow_pal=ICE, guard_pal=SILVER, grip_pal=NAVY, gem=ICE, aura=FROST),
)
