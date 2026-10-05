"""Arcane Wand - slim ebony wand tipped with a floating amethyst crystal."""
from ..modelkit import *  # noqa: F401,F403
from ..parts import ring, shaft, diamond
from ..anim import Key
from ..kinematics import Pose
from ..icons import wand_icon

TIP_Y = 34.5


def build():
    m = Model('arcane_wand', 128, 128)
    m.bone('root', None, (0, 24, 0), binding='q.item_slot_to_bone_name(c.item_slot)')
    m.bone('weapon', 'root', (0, 24, 0))
    for n in ('shaft', 'trim', 'claw'):
        m.bone(n, 'weapon', (0, 24, 0))
    ebony = wood_grain(EBONY, seed=81)
    ebony_cap = slab(EBONY, bevel=1, seed=82)
    gold = slab(GOLD, bevel=1, noise=0.04, seed=83)
    gold_dark = slab(GOLD, bevel=1, noise=0.08, vgrad=-0.5, seed=84)
    wrap = leather_wrap(VIOLET, 3, seed=85)

    shaft(m, 'shaft', 14.5, 31.5, 0.7, ebony, ebony_cap)
    m.box('shaft', (-0.95, 20.0, -0.95), (1.9, 7.0, 1.9), x=wrap, z=wrap, y=ebony_cap)
    for ry, rh in ((14.2, 0.9), (19.6, 0.7), (27.2, 0.7), (30.6, 1.1)):
        ring(m, 'trim', ry, 1.1, rh, gold)
    m.box('trim', (-0.8, 12.6, -0.8), (1.6, 1.8, 1.6), x=gold_dark, z=gold_dark, y=gold)     # pommel bead
    # claw prongs holding the crystal
    for i, (sx, sz) in enumerate(((1, 1), (-1, 1), (1, -1), (-1, -1))):
        nm = 'claw_%d' % i
        m.bone(nm, 'claw', (0, 31.7, 0), rotation=[-16 * sz * 0.6, 0, 16 * sx * 0.6])
        m.box(nm, (sx * 0.95 - 0.3, 31.7, sz * 0.95 - 0.3), (0.6, 3.6, 0.6), x=gold, z=gold, y=gold)

    # ---------- glow layers ----------
    m.bone('glow_crystal', 'weapon', (0, TIP_Y, 0))
    m.bone('glow_core', 'weapon', (0, TIP_Y, 0))
    for nm in ('glow_halo_a', 'glow_halo_b'):
        m.bone(nm, 'weapon', (0, TIP_Y, 0))
    crystal_m = gem(ARCANE, seed=12)
    # octahedron-ish crystal: two cubes rotated 45 degrees about different axes
    m.bone('glow_crystal_a', 'glow_crystal', (0, TIP_Y, 0), rotation=[45, 0, 45])
    s = 2.6
    m.box('glow_crystal_a', (-s / 2, TIP_Y - s / 2, -s / 2), (s, s, s), x=crystal_m, z=crystal_m, y=crystal_m)
    core = glow_solid(ARCANE, t=0.97)
    m.box('glow_core', (-0.8, TIP_Y - 0.8, -0.8), (1.6, 1.6, 1.6), x=core, z=core, y=core)
    halo = spark_cutout(ARCANE, seed=5, rays=8)
    m.box('glow_halo_a', (-0.05, TIP_Y - 3.6, -3.6), (0.1, 7.2, 7.2), x=halo)
    m.box('glow_halo_b', (-3.6, TIP_Y - 3.6, -0.05), (7.2, 7.2, 0.1), z=halo)
    star = spark_cutout(ARCANE, seed=6, rays=4)
    for i in range(3):
        nm = 'glow_mote_%d' % i
        m.bone(nm, 'weapon', (0, TIP_Y, 0))
        m.box(nm, (-0.05, TIP_Y - 0.6 + (i - 1) * 1.2, 3.4 - 0.6), (0.1, 1.2, 1.2), x=star)
    return m


SPEC = dict(
    id='arcane_wand', name='Arcane Wand', title='§dArcane Wand', element='arcane',
    damage=3, durability=1400, enchant=22,
    repair=['minecraft:amethyst_shard'],
    cooldown=2.5, cast_len=0.7,
    hold=dict(first=[36, -18, 0, (3.4, -3.4, -0.5)], third=[42, 4, 0, (0, 0, 0.4)]),
    flicker=[('glow_halo_a', 6.0, 0.14, 0), ('glow_halo_b', 6.7, 0.14, 100), ('glow_core', 8.0, 0.1, 30)],
    spin=[('glow_mote_0', 'y', 220.0, 0.0), ('glow_mote_1', 'y', -180.0, 120.0), ('glow_mote_2', 'y', 260.0, 240.0),
          ('glow_crystal_a', 'y', 50.0, 0.0), ('glow_halo_a', 'y', 40.0, 0.0), ('glow_halo_b', 'y', 40.0, 0.0)],
    fp_swing=[
        Pose(0.00, 36, -18, 0, (3.4, -3.4, -0.5), 'out2'),
        Pose(0.08, 24, 4, 8, (4.5, -2.5, 2.0), 'in'),
        Pose(0.20, 62, -22, -10, (-0.5, -4.5, 6.5), 'out'),
        Pose(0.38, 56, -26, -14, (-1.5, -5.0, 6.0), 'smooth'),
        Pose(0.70, 40, -18, -4, (2.6, -3.6, 1.6), 'smooth'),
        Pose(1.00, 36, -18, 0, (3.4, -3.4, -0.5)),
    ],
    fp_cast=[
        Pose(0.00, 36, -18, 0, (3.4, -3.4, -0.5), 'out'),
        Pose(0.12, 22, 4, 6, (4.0, -2.0, 2.0), 'in'),             # pull back
        Pose(0.24, 68, -14, -6, (1.0, -4.5, 8.0), 'out'),         # flick forward: missiles fly
        Pose(0.34, 74, -16, -8, (0.5, -4.8, 8.4), 'smooth'),
        Pose(0.70, 36, -18, 0, (3.4, -3.4, -0.5)),
    ],
    tp_swing={'weapon': [
        Key(0.00, (0, 0, 0), (0, 0, 0), 'out2'),
        Key(0.08, (-14, 4, -3), (0, 0.4, 0.8), 'in'),
        Key(0.22, (34, -6, 6), (0, -0.8, -2.2), 'out'),
        Key(0.42, (28, -8, 8), (0, -0.8, -2.4), 'smooth'),
        Key(0.72, (8, -2, 2), (0, -0.2, -0.6), 'smooth'),
        Key(1.00, (0, 0, 0), (0, 0, 0)),
    ]},
    tp_cast={'weapon': [
        Key(0.00, (0, 0, 0), (0, 0, 0), 'out'),
        Key(0.12, (-30, 4, -4), (0, 1.5, 2.5), 'in'),
        Key(0.24, (36, -4, 4), (0, -1.0, -5.0), 'out'),
        Key(0.34, (40, -6, 6), (0, -1.0, -5.4), 'smooth'),
        Key(0.70, (0, 0, 0), (0, 0, 0)),
    ]},
    recipe=dict(
        pattern=['  A', ' P ', 'B  '],
        key={'A': 'minecraft:amethyst_shard', 'P': 'minecraft:ender_pearl', 'B': 'minecraft:blaze_rod'},
        unlock='minecraft:amethyst_shard'),
    icon=lambda: wand_icon(EBONY, ARCANE, GOLD),
)
