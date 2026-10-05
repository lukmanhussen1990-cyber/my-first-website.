"""Stormcaller Staff - ebony staff crowned with a crackling storm orb."""
from ..modelkit import *  # noqa: F401,F403
from ..parts import ring, shaft
from ..anim import Key
from ..kinematics import Pose
from ..icons import staff_icon

ORB_Y = 46.0


def build():
    m = Model('storm_staff', 256, 256)
    m.bone('root', None, (0, 24, 0), binding='q.item_slot_to_bone_name(c.item_slot)')
    m.bone('weapon', 'root', (0, 24, 0))
    for n in ('shaft', 'trim', 'crown'):
        m.bone(n, 'weapon', (0, 24, 0))

    ebony = wood_grain(EBONY, seed=61)
    ebony_cap = slab(EBONY, bevel=1, seed=62)
    wrap = leather_wrap(LEATHER, 3, seed=63)
    silver = slab(SILVER, bevel=1, noise=0.04, seed=64)
    silver_dark = slab(SILVER, bevel=1, noise=0.08, vgrad=-0.5, seed=65)

    shaft(m, 'shaft', 2.0, 41.0, 0.95, ebony, ebony_cap)
    m.box('shaft', (-1.2, 19.5, -1.2), (2.4, 9.0, 2.4), x=wrap, z=wrap, y=ebony_cap)   # grip wrap
    for ry, rh in ((2.2, 1.2), (10.0, 0.9), (19.2, 0.9), (28.6, 0.9), (38.8, 1.4)):
        ring(m, 'trim', ry, 1.35, rh, silver)
    # butt spike
    m.box('trim', (-0.6, -1.5, -0.6), (1.2, 3.6, 1.2), x=silver_dark, z=silver_dark, y=silver)

    # crown: collar + four curved prongs cradling the orb
    m.box('crown', (-1.7, 41.0, -1.7), (3.4, 1.6, 3.4), x=silver, z=silver, y=silver)
    for i, (sx, sz) in enumerate(((1, 1), (-1, 1), (1, -1), (-1, -1))):
        nm = 'prong_%d' % i
        m.bone(nm, 'crown', (0, 42.6, 0), rotation=[-14 * sz * 0.7, 0, 14 * sx * 0.7])
        m.box(nm, (sx * 1.35 - 0.45, 42.6, sz * 1.35 - 0.45), (0.9, 3.6, 0.9), x=silver, z=silver, y=silver)
        m.box(nm, (sx * 1.35 - 0.3, 46.0, sz * 1.35 - 0.3), (0.6, 2.4, 0.6), x=silver, z=silver, y=silver)

    # ---------- glow layers ----------
    m.bone('glow_orb', 'weapon', (0, ORB_Y, 0))
    m.bone('glow_runes', 'weapon', (0, 24, 0))
    orb = gem(STORM, seed=9)
    core = glow_solid(STORM, t=0.98)
    m.box('glow_orb', (-1.9, ORB_Y - 1.9, -1.9), (3.8, 3.8, 3.8), x=orb, z=orb, y=orb)
    m.box('glow_orb', (-1.1, ORB_Y - 1.1, -1.1), (2.2, 2.2, 2.2), x=core, z=core, y=core, inflate=0.0)
    # radiant star planes behind the orb
    for nm, rot in (('glow_halo_a', None), ('glow_halo_b', None)):
        m.bone(nm, 'weapon', (0, ORB_Y, 0))
    halo = spark_cutout(STORM, seed=2, rays=8)
    m.box('glow_halo_a', (-0.05, ORB_Y - 4.5, -4.5), (0.1, 9.0, 9.0), x=halo)
    m.box('glow_halo_b', (-4.5, ORB_Y - 4.5, -0.05), (9.0, 9.0, 0.1), z=halo)
    # sparks orbiting the orb
    star = spark_cutout(STORM, seed=4, rays=4)
    for i in range(3):
        nm = 'glow_mote_%d' % i
        m.bone(nm, 'weapon', (0, ORB_Y, 0))
        r = 4.2
        m.box(nm, (-0.05, ORB_Y - 0.8 + (i - 1) * 1.6, r - 0.8), (0.1, 1.6, 1.6), x=star)
    # lightning-rune band down the shaft (cutouts on all four faces)
    zig = vein_cutout(STORM, seed=71, branch=0.3)
    m.box('glow_runes', (0.97, 29.4, -0.7), (0.05, 9.0, 1.4), x=zig)
    m.box('glow_runes', (-1.02, 29.4, -0.7), (0.05, 9.0, 1.4), x=zig)
    m.box('glow_runes', (-0.7, 29.4, 0.97), (1.4, 9.0, 0.05), z=zig)
    m.box('glow_runes', (-0.7, 29.4, -1.02), (1.4, 9.0, 0.05), z=zig)
    return m


SPEC = dict(
    id='storm_staff', name='Stormcaller Staff', title='§9Stormcaller Staff', element='lightning',
    damage=5, durability=1600, enchant=18,
    repair=['minecraft:copper_ingot'],
    cooldown=10.0, cast_len=1.2,
    hold=dict(first=[22, -8, 0, (3.5, -6.0, 2.5)], third=[12, 5, 0, (0.4, 0, 0.5)]),
    flicker=[('glow_halo_a', 5.0, 0.12, 0), ('glow_halo_b', 5.6, 0.12, 90),
             ('glow_orb', 7.0, 0.05, 40)],
    spin=[('glow_mote_0', 'y', 160.0, 0.0), ('glow_mote_1', 'y', -130.0, 120.0), ('glow_mote_2', 'y', 200.0, 240.0),
          ('glow_halo_a', 'y', 35.0, 0.0), ('glow_halo_b', 'y', 35.0, 0.0)],
    fp_swing=[
        Pose(0.00, 22, -8, 0, (3.5, -6, 2.5), 'out2'),
        Pose(0.10, 8, 16, 14, (6.0, -2.5, 3.0), 'in'),
        Pose(0.26, 34, -30, -22, (-3.0, -6.5, 5.0), 'out'),
        Pose(0.42, 42, -42, -34, (-6.0, -7.5, 5.5), 'smooth'),
        Pose(0.66, 26, -22, -14, (-1.0, -6.5, 3.5), 'smooth'),
        Pose(0.88, 20, -10, -2, (3.0, -6.0, 2.6), 'smooth'),
        Pose(1.00, 22, -8, 0, (3.5, -6, 2.5)),
    ],
    fp_cast=[
        Pose(0.00, 22, -8, 0, (3.5, -6, 2.5), 'out'),
        Pose(0.26, 6, 6, 0, (4.0, -1.0, 3.0), 'smooth'),          # raise the staff
        Pose(0.52, -6, 10, 0, (4.5, 3.0, 3.5), 'in'),            # held high, orb flaring
        Pose(0.62, 44, -8, -4, (1.0, -4.5, 8.0), 'out'),         # thrust towards the target
        Pose(0.78, 52, -8, -4, (1.0, -5.0, 8.5), 'smooth'),
        Pose(0.98, 36, -8, -2, (2.5, -5.5, 5.0), 'smooth'),
        Pose(1.20, 22, -8, 0, (3.5, -6, 2.5)),
    ],
    tp_swing={'weapon': [
        Key(0.00, (0, 0, 0), (0, 0, 0), 'out2'),
        Key(0.10, (-14, 4, -4), (0, 0.6, 1.0), 'in'),
        Key(0.26, (36, -8, 8), (0, -1.0, -2.6), 'out'),
        Key(0.42, (46, -12, 10), (0, -1.5, -3.4), 'smooth'),
        Key(0.66, (18, -4, 4), (0, -0.5, -1.0), 'smooth'),
        Key(0.88, (-3, 1, -1), (0, 0.1, 0.2), 'smooth'),
        Key(1.00, (0, 0, 0), (0, 0, 0)),
    ]},
    tp_cast={'weapon': [
        Key(0.00, (0, 0, 0), (0, 0, 0), 'out'),
        Key(0.26, (-26, 0, 8), (0, 3.0, 3.0), 'smooth'),
        Key(0.52, (-40, 4, 12), (0, 5.0, 4.0), 'in'),
        Key(0.62, (44, -6, -4), (0, -2.0, -7.0), 'out'),
        Key(0.78, (54, -8, -6), (0, -2.5, -8.0), 'smooth'),
        Key(0.98, (30, -4, -3), (0, -1.0, -3.0), 'smooth'),
        Key(1.20, (0, 0, 0), (0, 0, 0)),
    ]},
    recipe=dict(
        pattern=[' E ', 'ALA', ' L '],
        key={'E': 'minecraft:ender_eye', 'A': 'minecraft:amethyst_shard', 'L': 'minecraft:lightning_rod'},
        unlock='minecraft:lightning_rod'),
    icon=lambda: staff_icon(EBONY, STORM, SILVER),
)
