"""Earthshaker - a rune-carved stone war hammer."""
from ..modelkit import *  # noqa: F401,F403
from ..parts import ring, shaft
from ..anim import Key
from ..kinematics import Pose
from ..icons import hammer_icon


def build():
    m = Model('earth_hammer', 256, 256)
    m.bone('root', None, (0, 24, 0), binding='q.item_slot_to_bone_name(c.item_slot)')
    m.bone('weapon', 'root', (0, 24, 0))
    for n in ('handle', 'trim', 'head'):
        m.bone(n, 'weapon', (0, 24, 0))
    wood = wood_grain(WOOD, seed=101)
    wood_cap = slab(WOOD, bevel=1, seed=102)
    wrap = leather_wrap(LEATHER, 3, seed=103)
    iron = slab(STEEL, bevel=1, noise=0.05, seed=104)
    iron_dark = slab(DARKSTEEL, bevel=1, noise=0.06, seed=105)
    stone = stone_block(STONE, seed=106, cracks=True)
    stone2 = stone_block(STONE, seed=107, cracks=False)

    shaft(m, 'handle', 6.0, 35.2, 1.15, wood, wood_cap)
    m.box('handle', (-1.4, 18.0, -1.4), (2.8, 9.6, 2.8), x=wrap, z=wrap, y=wood_cap)
    for ry, rh, hw in ((5.8, 1.4, 1.7), (17.6, 0.9, 1.6), (27.6, 0.9, 1.6), (33.6, 1.5, 1.9)):
        ring(m, 'trim', ry, hw, rh, iron_dark)
    m.box('trim', (-0.7, 4.0, -0.7), (1.4, 2.0, 1.4), x=iron, z=iron, y=iron)   # butt knob

    # head (long axis = Z, so the ends strike forward/back through the swing plane)
    m.box('head', (-3.9, 35.0, -3.6), (7.8, 8.8, 7.2), x=stone, z=stone2, y=stone2)
    for z0, z1 in ((-6.2, -3.6), (3.6, 6.2)):          # heavy iron striking blocks
        m.box('head', (-4.4, 34.6, z0), (8.8, 9.6, z1 - z0), x=iron, z=iron, y=iron)
    for z0 in (-7.2, 6.2):                              # darker end plates
        m.box('head', (-3.6, 35.4, z0), (7.2, 8.0, 1.0), x=iron_dark, z=iron_dark, y=iron_dark)
    for (y0, s_, h) in ((43.6, 3.8, 1.0), (44.6, 2.6, 1.0), (45.6, 1.3, 1.8)):   # crown spike
        m.box('head', (-s_ / 2, y0, -s_ / 2), (s_, h, s_), x=iron, z=iron, y=iron)

    # ---------- glow layers ----------
    m.bone('glow_runes', 'weapon', (0, 39, 0))
    m.bone('glow_cracks', 'weapon', (0, 39, 0))
    glyph = glyph_cutout(AMBER, seed=11, density=0.9, t=0.85)
    ringm = ring_cutout(AMBER, thickness=1.0, t=0.9)
    for sx in (-1, 1):
        ox = 3.96 if sx > 0 else -4.02
        m.box('glow_runes', (ox, 36.4, -2.5), (0.06, 5.8, 5.0), x=glyph)
    for sz in (-1, 1):
        oz = 7.23 if sz > 0 else -7.29
        m.box('glow_runes', (-2.4, 36.6, oz), (4.8, 4.8, 0.06), z=ringm)
    vein = vein_cutout(AMBER, seed=13, branch=0.35)
    m.box('glow_cracks', (-1.4, 43.83, -3.0), (2.8, 0.06, 6.0), y=vein)
    return m


SPEC = dict(
    id='earth_hammer', name='Earthshaker', title='§6Earthshaker', element='earth',
    damage=12, durability=2100, enchant=12,
    repair=['minecraft:iron_ingot'],
    cooldown=10.0, cast_len=1.4,
    hold=dict(first=[10, -14, -36, (3.5, -7.5, 3.5)], third=[40, 14, 0, (0.6, -0.4, 0.8)]),
    flicker=[('glow_runes', 1.1, 0.03, 0), ('glow_cracks', 1.7, 0.03, 90)],
    spin=[],
    fp_swing=[
        Pose(0.00, 10, -14, -36, (3.5, -7.5, 3.5), 'out2'),
        Pose(0.12, -14, 12, -20, (5.5, -2.0, 3.5), 'in'),
        Pose(0.30, 46, -26, -46, (-1.5, -8.0, 7.0), 'out'),
        Pose(0.46, 62, -40, -60, (-4.5, -10.0, 7.5), 'smooth'),
        Pose(0.72, 26, -24, -44, (-0.5, -8.5, 4.5), 'smooth'),
        Pose(0.90, 12, -16, -38, (3.0, -7.8, 3.7), 'smooth'),
        Pose(1.00, 10, -14, -36, (3.5, -7.5, 3.5)),
    ],
    fp_cast=[
        Pose(0.00, 10, -14, -36, (3.5, -7.5, 3.5), 'out'),
        Pose(0.30, -10, 10, -20, (5.0, -2.5, 3.5), 'smooth'),
        Pose(0.62, -24, 14, -14, (5.5, 2.5, 3.5), 'in'),          # raised overhead
        Pose(0.74, 68, -14, -44, (0.5, -10.5, 8.5), 'out'),       # slam
        Pose(0.84, 86, -12, -44, (0.5, -12.0, 9.0), 'smooth'),    # impact
        Pose(1.10, 76, -12, -44, (0.5, -11.0, 8.6), 'smooth'),
        Pose(1.40, 10, -14, -36, (3.5, -7.5, 3.5)),
    ],
    tp_swing={'weapon': [
        Key(0.00, (0, 0, 0), (0, 0, 0), 'out2'),
        Key(0.12, (-26, 8, -8), (0, 1.2, 1.8), 'in'),
        Key(0.30, (60, -14, 14), (0, -1.6, -4.0), 'out'),
        Key(0.46, (78, -22, 20), (0, -2.4, -5.4), 'smooth'),
        Key(0.72, (30, -8, 6), (0, -0.8, -1.8), 'smooth'),
        Key(0.90, (-4, 2, -1), (0, 0.1, 0.3), 'smooth'),
        Key(1.00, (0, 0, 0), (0, 0, 0)),
    ]},
    tp_cast={'weapon': [
        Key(0.00, (0, 0, 0), (0, 0, 0), 'out'),
        Key(0.30, (-50, 0, 10), (0, 3.0, 4.0), 'smooth'),
        Key(0.62, (-76, 8, 16), (0, 5.0, 5.5), 'in'),
        Key(0.74, (84, -8, -6), (0, -4.0, -7.0), 'out'),
        Key(0.84, (108, -10, -8), (0, -5.5, -8.5), 'smooth'),
        Key(1.10, (96, -10, -8), (0, -5.0, -8.0), 'smooth'),
        Key(1.40, (0, 0, 0), (0, 0, 0)),
    ]},
    recipe=dict(
        pattern=['III', 'IAI', ' B '],
        key={'I': 'minecraft:iron_ingot', 'A': 'minecraft:diamond_axe', 'B': 'minecraft:blaze_rod'},
        unlock='minecraft:diamond_axe'),
    icon=lambda: hammer_icon(STONE, AMBER, WOOD, STEEL),
)
