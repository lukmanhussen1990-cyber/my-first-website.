"""Flamebrand - a one-handed fire longsword (~2 blocks long)."""
from ..modelkit import *  # noqa: F401,F403


def build():
    m = Model('flamebrand', 256, 256)
    m.bone('root', None, (0, 24, 0), binding='q.item_slot_to_bone_name(c.item_slot)')
    m.bone('weapon', 'root', (0, 24, 0))
    for n in ('grip', 'guard', 'blade', 'pommel'):
        m.bone(n, 'weapon', (0, 24, 0))

    steel_face = blade_face(STEEL, fuller=True, edge_pal=STEEL, seed=1, heat=FIRE, heat_amount=0.85, heat_reach=0.62)
    trim_face = blade_face(DARKSTEEL, fuller=False, edge_pal=STEEL, seed=7)
    steel_edge = edge_strip(STEEL, seed=2)
    steel_cap = slab(STEEL, bevel=1, seed=3)
    gold = slab(GOLD, bevel=1, noise=0.04, seed=4)
    gold_dark = slab(GOLD, bevel=1, noise=0.08, vgrad=-0.5, seed=5)
    wrap = leather_wrap(LEATHER, 3, seed=6)

    # grip (2.0 x 2.0, 7 tall) centred on the pivot
    m.box('grip', (-1.0, 20.5, -1.0), (2.0, 7.0, 2.0), x=wrap, z=wrap, y=gold_dark)
    for gy in (20.2, 26.9):
        m.box('grip', (-1.35, gy, -1.35), (2.7, 0.9, 2.7), x=gold, z=gold, y=gold)

    # pommel: gold collar + cap around a glowing ember (glow bone)
    m.box('pommel', (-1.5, 19.3, -1.5), (3.0, 1.0, 3.0), x=gold, z=gold, y=gold)
    m.box('pommel', (-0.9, 16.6, -0.9), (1.8, 0.8, 1.8), x=gold_dark, z=gold_dark, y=gold)

    # cross guard: wide along Z, wing tips curl upward
    m.box('guard', (-1.15, 27.5, -4.2), (2.3, 1.6, 8.4), x=gold, z=gold, y=gold)
    for sz in (-1, 1):
        zc = 3.5 * sz
        m.box('guard', (-0.95, 29.1, zc - 0.8), (1.9, 1.3, 1.6), x=gold, z=gold, y=gold)
        m.box('guard', (-0.75, 30.4, zc - 0.5 + 0.2 * sz), (1.5, 0.8, 1.0), x=gold, z=gold, y=gold)

    # blade: ricasso + long body + smooth stepped taper
    steps = [  # (y0, h, width_z, thick_x, face)
        (29.1, 1.5, 4.0, 1.7, trim_face),
        (30.6, 13.0, 4.6, 1.5, steel_face),
        (43.6, 2.3, 4.0, 1.4, steel_face),
        (45.9, 1.9, 3.0, 1.3, steel_face),
        (47.8, 1.4, 1.9, 1.1, steel_face),
        (49.2, 0.8, 0.9, 0.9, steel_face),
    ]
    for (y0, h, wz, tx, face) in steps:
        m.box('blade', (-tx / 2, y0, -wz / 2), (tx, h, wz), x=face, z=steel_edge, y=steel_cap)

    # ---------- glow layers (rendered fullbright) ----------
    for n, pv in (('glow_veins', (0, 24, 0)), ('glow_gem', (0, 24, 0)),
                  ('glow_flame_a', (0, 40, 0)), ('glow_flame_b', (0, 40, 0)),
                  ('glow_flame_c', (0, 40, 0)), ('glow_flame_d', (0, 40, 0))):
        m.bone(n, 'weapon', pv)
    vein = vein_cutout(FIRE, seed=11, branch=0.25)
    edge = strip_glow(FIRE)
    gem_m = gem(CRIMSON, seed=3)
    ember = glow_solid(FIRE, t=0.85)

    for sx in (-1, 1):  # magma veins on both flat faces
        ox = 0.77 if sx > 0 else -0.83
        m.box('glow_veins', (ox, 32.0, -0.9), (0.06, 15.5, 1.8), x=vein)
    for sz in (-1, 1):  # molten cutting edges (front and back)
        oz = 2.33 if sz > 0 else -2.39
        m.box('glow_veins', (-0.5, 31.6, oz), (1.0, 12.2, 0.06), z=edge)

    # ruby in the guard + ember in the pommel
    m.box('glow_gem', (-1.25, 27.2, -1.25), (2.5, 2.2, 2.5), x=gem_m, z=gem_m, y=gem_m)
    m.box('glow_gem', (-0.9, 17.3, -0.9), (1.8, 2.0, 1.8), x=ember, z=ember, y=ember)

    # flame aura: crossed alpha-cutout planes licking up the blade
    fa = flame_cutout(FIRE, seed=21, tongues=3)
    fb = flame_cutout(FIRE, seed=22, tongues=4)
    fc = flame_cutout(FIRE, seed=23, tongues=3)
    m.box('glow_flame_a', (-0.05, 38.0, -3.6), (0.1, 13.5, 7.2), x=fa)
    m.box('glow_flame_b', (-3.6, 38.0, -0.05), (7.2, 13.5, 0.1), z=fb)
    m.box('glow_flame_c', (-0.05, 40.0, -2.6), (0.1, 11.0, 5.2), x=fc)
    m.box('glow_flame_d', (-2.6, 40.0, -0.05), (5.2, 11.0, 0.1), z=fc)
    m.bones['glow_flame_c'].rotation = [0, 45, 0]
    m.bones['glow_flame_d'].rotation = [0, 45, 0]
    return m


# ---------------------------------------------------------------- spec (items, animation, recipe)
from ..anim import Key  # noqa: E402
from ..kinematics import Pose  # noqa: E402
from ..icons import sword_icon  # noqa: E402

SPEC = dict(
    id='flamebrand',
    name='Flamebrand',
    title='§6Flamebrand',
    element='fire',
    damage=9, durability=1800, enchant=14,
    repair=['minecraft:blaze_rod'],
    cooldown=6.0, cast_len=1.05,
    # Poses are in view space: (pitch, lean, roll, (right, up, forward) offset of the grip)
    hold=dict(first=[10, -20, -30, (2, -5, 2)], third=[55, 4, 0, (0, 0, 0.5)]),
    flicker=[('glow_flame_a', 7.0, 0.16, 0), ('glow_flame_b', 8.3, 0.18, 60),
             ('glow_flame_c', 6.4, 0.15, 120), ('glow_flame_d', 9.1, 0.16, 200)],
    # First person (camera space). Swing time = progress 0..1 of the vanilla attack; cast time = seconds.
    fp_swing=[
        Pose(0.00, 10, -20, -30, (2, -5, 2), 'out2'),
        Pose(0.10, -6, 12, -12, (5.0, -1.5, 3.5), 'in'),          # wind-up: blade rises up and right
        Pose(0.24, 34, -26, -56, (-1.0, -5.5, 6.0), 'out'),        # cut: sweeps through the centre
        Pose(0.38, 52, -52, -74, (-5.5, -7.5, 6.5), 'smooth'),     # follow-through, low left
        Pose(0.62, 28, -38, -52, (-1.0, -6.5, 4.5), 'smooth'),
        Pose(0.85, 14, -24, -34, (1.5, -5.3, 2.4), 'smooth'),
        Pose(1.00, 10, -20, -30, (2, -5, 2)),
    ],
    fp_cast=[
        Pose(0.00, 10, -20, -30, (2, -5, 2), 'out'),
        Pose(0.16, -8, 8, -16, (3.5, -1.0, 3.0), 'smooth'),         # lift
        Pose(0.34, -18, 16, -10, (4.5, 2.5, 3.5), 'in'),            # raised high, glowing
        Pose(0.43, 50, -34, -62, (-3.0, -6.5, 7.0), 'out'),         # slam down and across
        Pose(0.54, 64, -46, -70, (-4.0, -8.0, 8.0), 'smooth'),
        Pose(0.74, 28, -26, -38, (0.0, -5.8, 4.0), 'smooth'),
        Pose(1.05, 10, -20, -30, (2, -5, 2)),
    ],
    # Third person: rot X is the slash arc (+ = chop forward/down), applied on top of the arm swing.
    tp_swing={'weapon': [
        Key(0.00, (0, 0, 0), (0, 0, 0), 'out2'),
        Key(0.07, (-16, 6, -6), (0, 0.6, 1.0), 'in'),
        Key(0.22, (42, -10, 10), (0, -1.0, -3.0), 'out'),
        Key(0.36, (56, -16, 14), (0, -1.6, -4.0), 'smooth'),
        Key(0.58, (24, -6, 5), (0, -0.6, -1.4), 'smooth'),
        Key(0.80, (-4, 2, -1), (0, 0.1, 0.3), 'smooth'),
        Key(1.00, (0, 0, 0), (0, 0, 0)),
    ]},
    tp_cast={'weapon': [
        Key(0.00, (0, 0, 0), (0, 0, 0), 'out'),
        Key(0.14, (-48, 0, 14), (0, 2.5, 4.0), 'smooth'),
        Key(0.34, (-64, 8, 20), (0, 4.0, 5.5), 'in'),
        Key(0.42, (62, -10, -8), (0, -3.0, -7.0), 'out'),
        Key(0.52, (84, -16, -10), (0, -4.0, -8.5), 'smooth'),
        Key(0.72, (34, -6, -3), (0, -1.2, -2.5), 'smooth'),
        Key(1.05, (0, 0, 0), (0, 0, 0)),
    ]},
    recipe=dict(
        pattern=[' B ', 'MDM', ' B '],
        key={'B': 'minecraft:blaze_rod', 'M': 'minecraft:magma_cream', 'D': 'minecraft:diamond_sword'},
        unlock='minecraft:blaze_rod'),
    icon=lambda: sword_icon(STEEL, glow_pal=FIRE, gem=CRIMSON, aura=FIRE),
)
