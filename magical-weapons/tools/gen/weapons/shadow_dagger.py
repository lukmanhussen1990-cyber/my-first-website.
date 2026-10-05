"""Shadowfang - a curved fang-shaped dagger wreathed in violet shadow."""
from ..modelkit import *  # noqa: F401,F403
from ..anim import Key
from ..kinematics import Pose
from ..icons import dagger_icon


def build():
    m = Model('shadow_dagger', 128, 128)
    m.bone('root', None, (0, 24, 0), binding='q.item_slot_to_bone_name(c.item_slot)')
    m.bone('weapon', 'root', (0, 24, 0))
    for n in ('grip', 'guard', 'pommel'):
        m.bone(n, 'weapon', (0, 24, 0))
    dark = slab(DARKSTEEL, bevel=1, noise=0.05, seed=91)
    dark_edge = slab(VIOLET, bevel=1, noise=0.05, seed=92)
    wrap = leather_wrap(SHADOW, 3, seed=93)
    blade_m = blade_face(DARKSTEEL, fuller=True, edge_pal=VIOLET, seed=94)
    edge_m = edge_strip(VIOLET_GLOW, seed=95)
    cap_m = slab(DARKSTEEL, bevel=1, seed=96)

    # handle, guard, pommel
    m.box('grip', (-0.9, 19.6, -0.9), (1.8, 6.4, 1.8), x=wrap, z=wrap, y=dark)
    for gy in (19.4, 25.3):
        m.box('grip', (-1.2, gy, -1.2), (2.4, 0.8, 2.4), x=dark_edge, z=dark_edge, y=dark_edge)
    m.box('pommel', (-1.3, 17.4, -1.3), (2.6, 2.0, 2.6), x=dark, z=dark, y=dark_edge)
    m.box('guard', (-1.0, 26.0, -3.0), (2.0, 1.1, 6.0), x=dark_edge, z=dark_edge, y=dark_edge)
    m.box('guard', (-0.8, 27.1, 2.2), (1.6, 1.2, 1.4), x=dark_edge, z=dark_edge, y=dark_edge)       # back horn
    m.box('guard', (-0.8, 24.9, -4.4), (1.6, 1.2, 1.6), x=dark_edge, z=dark_edge, y=dark_edge)       # front hook (down)

    # curved blade: chained segments, each tipped further forward (-Z) than the last
    segs = [(27.2, 4.4, 4.0, 0.0), (31.6, 4.2, 3.5, 9.0), (35.8, 3.8, 2.8, 12.0), (39.6, 3.0, 1.9, 14.0), (42.6, 1.6, 1.0, 14.0)]
    parent = 'weapon'
    for i, (y0, h, wz, rot) in enumerate(segs):
        nm = 'seg_%d' % i
        m.bone(nm, parent, (0, y0, 0), rotation=[rot, 0, 0] if rot else None)
        m.box(nm, (-0.5, y0, -wz / 2), (1.0, h, wz), x=blade_m, z=edge_m, y=cap_m)
        parent = nm

    # ---------- glow layers ----------
    edge_glow = strip_glow(VIOLET_GLOW)
    vein = vein_cutout(VIOLET, seed=97, branch=0.2)
    parent = 'weapon'
    for i, (y0, h, wz, rot) in enumerate(segs):
        nm = 'glow_edge_%d' % i
        m.bone(nm, 'seg_%d' % i, (0, y0, 0))
        m.box(nm, (-0.4, y0, -wz / 2 - 0.07), (0.8, h, 0.07), z=edge_glow)
        if i < 3:
            for sx in (-1, 1):
                ox = 0.53 if sx > 0 else -0.59
                m.box(nm, (ox, y0 + 0.5, -0.4), (0.06, h - 1.0, 0.8), x=vein)
    m.bone('glow_gem', 'weapon', (0, 24, 0))
    gem_m = gem(VIOLET_GLOW, seed=14)
    m.box('glow_gem', (-0.9, 26.3, -0.9), (1.8, 1.4, 1.8), x=gem_m, z=gem_m, y=gem_m)
    m.box('glow_gem', (-0.7, 17.9, -1.4), (1.4, 1.4, 0.15), z=gem_m)
    # drifting shadow wisps
    for nm, (x0, z0, w, sx_, sz_) in (('glow_wisp_a', (0, 0, 7.0, True, False)), ('glow_wisp_b', (0, 0, 7.0, False, True))):
        m.bone(nm, 'weapon', (0, 34, 0))
    wisp_a = flame_cutout(VIOLET_GLOW, seed=98, tongues=3, core=False)
    wisp_b = flame_cutout(VIOLET_GLOW, seed=99, tongues=2, core=False)
    m.box('glow_wisp_a', (-0.05, 29.5, -3.3), (0.1, 11.0, 6.6), x=wisp_a)
    m.box('glow_wisp_b', (-3.0, 29.5, -0.05), (6.0, 11.0, 0.1), z=wisp_b)
    return m


SPEC = dict(
    id='shadow_dagger', name='Shadowfang', title='§5Shadowfang', element='shadow',
    damage=7, durability=1500, enchant=20,
    repair=['minecraft:ender_pearl'],
    cooldown=7.0, cast_len=0.8,
    hold=dict(first=[28, -26, -24, (4.0, -3.5, 1.5)], third=[48, 2, 0, (0, 0, 0.4)]),
    flicker=[('glow_wisp_a', 5.5, 0.18, 0), ('glow_wisp_b', 6.3, 0.2, 70)],
    spin=[],
    fp_swing=[
        Pose(0.00, 28, -26, -24, (4.0, -3.5, 1.5), 'out2'),
        Pose(0.07, 12, 16, 18, (5.5, -1.0, 2.0), 'in'),
        Pose(0.18, 40, -44, -52, (-2.0, -5.5, 5.5), 'out'),
        Pose(0.30, 46, -60, -66, (-4.5, -6.5, 6.0), 'smooth'),
        Pose(0.55, 34, -40, -44, (-0.5, -5.0, 3.5), 'smooth'),
        Pose(0.82, 29, -28, -26, (3.5, -3.8, 1.8), 'smooth'),
        Pose(1.00, 28, -26, -24, (4.0, -3.5, 1.5)),
    ],
    fp_cast=[
        Pose(0.00, 28, -26, -24, (4.0, -3.5, 1.5), 'out'),
        Pose(0.10, 10, -34, -10, (4.5, -4.5, 0.0), 'in'),          # coil
        Pose(0.20, 74, -10, -8, (0.0, -5.5, 9.5), 'out'),          # lunge/stab forward
        Pose(0.30, 48, -56, -62, (-6.5, -5.0, 6.0), 'smooth'),     # slash across on arrival
        Pose(0.46, 38, -46, -46, (-3.0, -5.0, 4.5), 'smooth'),
        Pose(0.80, 28, -26, -24, (4.0, -3.5, 1.5)),
    ],
    tp_swing={'weapon': [
        Key(0.00, (0, 0, 0), (0, 0, 0), 'out2'),
        Key(0.06, (-12, 5, -4), (0, 0.4, 0.8), 'in'),
        Key(0.16, (34, -8, 8), (0, -0.8, -2.8), 'out'),
        Key(0.30, (40, -12, 12), (0, -1.0, -3.2), 'smooth'),
        Key(0.55, (16, -5, 4), (0, -0.4, -1.0), 'smooth'),
        Key(0.80, (-2, 1, -1), (0, 0, 0.2), 'smooth'),
        Key(1.00, (0, 0, 0), (0, 0, 0)),
    ]},
    tp_cast={'weapon': [
        Key(0.00, (0, 0, 0), (0, 0, 0), 'out'),
        Key(0.10, (-24, 6, -6), (0, 0.8, 2.8), 'in'),
        Key(0.20, (56, -6, 4), (0, -1.5, -6.5), 'out'),
        Key(0.30, (30, -22, 18), (0, -1.0, -4.0), 'smooth'),
        Key(0.46, (20, -10, 8), (0, -0.6, -2.0), 'smooth'),
        Key(0.80, (0, 0, 0), (0, 0, 0)),
    ]},
    recipe=dict(
        pattern=[' P ', 'OSO', ' P '],
        key={'P': 'minecraft:ender_pearl', 'O': 'minecraft:obsidian', 'S': 'minecraft:iron_sword'},
        unlock='minecraft:ender_pearl'),
    icon=lambda: dagger_icon(DARKSTEEL, VIOLET_GLOW, VIOLET),
)
