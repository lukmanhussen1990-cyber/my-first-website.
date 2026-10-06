"""Goku's outfit: gi top, gi pants with sash, boots and the two spiky hair styles.

Every piece is a custom geometry whose bones share names with the player
skeleton (head, body, rightArm, leftArm, rightLeg, leftLeg) so the clothes
follow the player's animations.
"""
import random

from pixelkit import Atlas, Model, draw_ascii, mix, rgba, shade

# --- palette ---------------------------------------------------------------
ORANGE = rgba('#F27A1A')
ORANGE_L = rgba('#FF9C42')
ORANGE_D = rgba('#C95A12')
ORANGE_DD = rgba('#94400B')
BLUE = rgba('#2244AA')
BLUE_L = rgba('#3A63D2')
BLUE_D = rgba('#17307D')
BLUE_DD = rgba('#0D1C52')
WHITE = rgba('#F4F4F4')
INK = rgba('#161616')
BOOT = rgba('#1E3388')
BOOT_L = rgba('#2D4AB0')
BOOT_D = rgba('#142360')
TAN = rgba('#E5C06C')
TAN_D = rgba('#B88E43')
SOLE = rgba('#0C1438')

GI = {
    'O': ORANGE, 'h': ORANGE_L, 'o': ORANGE_D, 'k': ORANGE_DD,
    'B': BLUE, 'L': BLUE_L, 'b': BLUE_D, 'n': BLUE_DD,
    'W': WHITE, 'S': INK,
    'N': BOOT, 'M': BOOT_L, 'm': BOOT_D, 'T': TAN, 't': TAN_D, 'X': SOLE,
}


def _fill(img, rect, color):
    x, y, w, h = rect
    for j in range(h):
        for i in range(w):
            img.putpixel((x + i, y + j), color)


def _grid(img, rect, rows):
    x, y, w, h = rect
    assert len(rows) == h and all(len(r) == w for r in rows), (rect, rows)
    draw_ascii(img, x, y, rows, GI)


def _fabric(img, rect, seed, amount=0.10):
    """Light dithering so the cloth does not look flat."""
    x, y, w, h = rect
    rnd = random.Random(seed)
    for j in range(h):
        for i in range(w):
            c = img.getpixel((x + i, y + j))
            if c[3] == 0:
                continue
            r = rnd.random()
            if r < amount:
                img.putpixel((x + i, y + j), shade(c, 0.92))
            elif r < amount * 1.5:
                img.putpixel((x + i, y + j), shade(c, 1.05))


def _all_faces(img, rects, rows_by_face, seed):
    for face, rows in rows_by_face.items():
        if isinstance(rows, tuple):
            _fill(img, rects[face], rows)
        else:
            _grid(img, rects[face], rows)
    for k, face in enumerate(rects):
        _fabric(img, rects[face], seed + k)


# --- gi top ----------------------------------------------------------------
GI_FRONT = [
    'hOkBBkOh',
    'OOkBBkOO',
    'OOOkkWWO',
    'OOOOOWSO',
    'OOOOOOOO',
    'OOOOOOOO',
    'oOOOOOOo',
    'oOOOOOOo',
    'oOOOOOOo',
    'oOOOOOOo',
    'ooOOOOoo',
    'oooooooo',
]
GI_BACK = [
    'hOOOOOOh',
    'OOWWWWOO',
    'OWWSSWWO',
    'OWSWSSWO',
    'OWWSWSWO',
    'OOWWWWOO',
    'OOOOOOOO',
    'oOOOOOOo',
    'oOOOOOOo',
    'oOOOOOOo',
    'ooOOOOoo',
    'oooooooo',
]
GI_SIDE = ['hhhh'] + ['OOOO'] * 6 + ['oOOo'] * 3 + ['oooo'] * 2
GI_TOP = [
    'OOOOOOOO',
    'OOBBBBOO',
    'OOBBBBOO',
    'OOkBBkOO',
]
SLEEVE = ['hOOh', 'OOOO', 'kkkk', 'BBBB', 'BBBB', 'bbbb']
WRIST = ['LLLL', 'BBBB', 'bbbb']


def paint_gi_body(img, rects, size):
    _all_faces(img, rects, {
        'front': GI_FRONT, 'back': GI_BACK, 'right': GI_SIDE, 'left': GI_SIDE,
        'up': GI_TOP, 'down': ORANGE_D,
    }, seed=11)


def paint_sleeve(img, rects, size):
    _all_faces(img, rects, {
        'front': SLEEVE, 'back': SLEEVE, 'right': SLEEVE, 'left': SLEEVE,
        'up': ORANGE, 'down': BLUE_DD,
    }, seed=23)


def paint_wrist(img, rects, size):
    _all_faces(img, rects, {
        'front': WRIST, 'back': WRIST, 'right': WRIST, 'left': WRIST,
        'up': BLUE_L, 'down': BLUE_D,
    }, seed=31)


# --- pants -----------------------------------------------------------------
SASH_FRONT = ['LBBLLBBL', 'bBBbbBBb']
SASH_SIDE = ['LBBL', 'bBBb']
SASH_BACK = ['LBBBBBBL', 'bbBBBBbb']
SASH_END = ['B', 'B', 'b']
PANTS = ['OOOO', 'OOOO', 'OOoO', 'OOOO', 'OoOO', 'OOOO', 'oOOo', 'hhhh', 'oOOo', 'oooo']


def paint_sash(img, rects, size):
    _all_faces(img, rects, {
        'front': SASH_FRONT, 'back': SASH_BACK, 'right': SASH_SIDE, 'left': SASH_SIDE,
        'up': BLUE, 'down': BLUE_D,
    }, seed=41)


def paint_sash_end(img, rects, size):
    _all_faces(img, rects, {
        'front': SASH_END, 'back': SASH_END, 'right': SASH_END, 'left': SASH_END,
        'up': BLUE, 'down': BLUE_D,
    }, seed=43)


def paint_pant_leg(img, rects, size):
    _all_faces(img, rects, {
        'front': PANTS, 'back': PANTS, 'right': PANTS, 'left': PANTS,
        'up': ORANGE, 'down': ORANGE_D,
    }, seed=53)


# --- boots -----------------------------------------------------------------
BOOT_FRONT = ['TTTT', 'NTTN', 'NtTN', 'NTtN', 'MNNM', 'XXXX']
BOOT_SIDE = ['TTTT', 'MNNN', 'NNNN', 'NNmN', 'NNNN', 'XXXX']
BOOT_BACK = ['TTTT', 'NNNN', 'NmmN', 'NNNN', 'NNNN', 'XXXX']


def paint_boot(img, rects, size):
    _all_faces(img, rects, {
        'front': BOOT_FRONT, 'back': BOOT_BACK, 'right': BOOT_SIDE, 'left': BOOT_SIDE,
        'up': BOOT_D, 'down': SOLE,
    }, seed=61)


def build_outfit():
    """Returns (atlas, top_model, pants_model, boots_model) sharing one 64x64 texture."""
    atlas = Atlas(64, 64)

    top = Model('geometry.goku.gi_top', atlas)
    top.bone('body', (0, 24, 0))
    top.bone('rightArm', (-5, 22, 0))
    top.bone('leftArm', (5, 22, 0))
    top.cube('body', (-4, 12, -2), (8, 12, 4), paint_gi_body, inflate=0.35)
    top.cube('rightArm', (-8, 18, -2), (4, 6, 4), paint_sleeve, inflate=0.4)
    top.cube('leftArm', (4, 18, -2), (4, 6, 4), paint_sleeve, inflate=0.4)
    top.cube('rightArm', (-8, 13, -2), (4, 3, 4), paint_wrist, inflate=0.42)
    top.cube('leftArm', (4, 13, -2), (4, 3, 4), paint_wrist, inflate=0.42)

    pants = Model('geometry.goku.gi_pants', atlas)
    pants.bone('body', (0, 24, 0))
    pants.bone('rightLeg', (-1.9, 12, 0))
    pants.bone('leftLeg', (1.9, 12, 0))
    pants.cube('body', (-4, 11, -2), (8, 2, 4), paint_sash, inflate=0.55)
    # the two short ends of the knotted sash hanging at the front
    pants.cube('body', (-2.6, 8.4, -2.95), (1, 3, 1), paint_sash_end, inflate=0.05)
    pants.cube('body', (-1.2, 8.9, -2.95), (1, 3, 1), paint_sash_end, inflate=0.05)
    pants.cube('rightLeg', (-3.9, 2, -2), (4, 10, 4), paint_pant_leg, inflate=0.42)
    pants.cube('leftLeg', (-0.1, 2, -2), (4, 10, 4), paint_pant_leg, inflate=0.42)

    boots = Model('geometry.goku.gi_boots', atlas)
    boots.bone('rightLeg', (-1.9, 12, 0))
    boots.bone('leftLeg', (1.9, 12, 0))
    boots.cube('rightLeg', (-3.9, 0, -2), (4, 6, 4), paint_boot, inflate=0.58)
    boots.cube('leftLeg', (-0.1, 0, -2), (4, 6, 4), paint_boot, inflate=0.58)

    return atlas, top, pants, boots


# --- hair ------------------------------------------------------------------
HAIR_PALETTES = {
    # Ultra Instinct: silver with a cold blue tint
    'ui': [rgba('#5F6A8A'), rgba('#8C98B8'), rgba('#B7C2DC'), rgba('#DCE4F4'), rgba('#FFFFFF')],
    # base form: black with blue-ish shine
    'black': [rgba('#060609'), rgba('#0F1016'), rgba('#191A24'), rgba('#272A3A'), rgba('#3C4260')],
}

# Spikes: base point on the head, length, base thickness, rotation [x, y, z].
# Geometry space: -X = wearer's right, -Z = face side.  A negative X rotation
# tilts an upward spike towards the back of the head, a positive Z rotation
# tilts it towards +X (wearer's left).
HAIR_SPIKES = [
    # crown: three big flames pointing up
    ((0.0, 31.0, 0.0), 9, 4, (-12, 0, 0)),
    ((-2.0, 31.0, 0.0), 8, 4, (-10, 0, -28)),
    ((2.0, 31.0, 0.0), 8, 4, (-10, 0, 28)),
    # sides, flaring out
    ((-3.2, 29.0, 0.5), 7, 4, (-8, 0, -62)),
    ((3.2, 29.0, 0.5), 7, 4, (-8, 0, 62)),
    ((-3.4, 26.8, 1.5), 5, 3, (-20, 0, -102)),
    ((3.4, 26.8, 1.5), 5, 3, (-20, 0, 102)),
    # back
    ((0.0, 29.5, 3.0), 7, 4, (-62, 0, 0)),
    ((-2.2, 28.5, 3.0), 6, 3, (-82, 0, -30)),
    ((2.2, 28.5, 3.0), 6, 3, (-82, 0, 30)),
    ((0.0, 26.5, 3.2), 5, 3, (-128, 0, 0)),
    # bangs falling over the forehead
    ((-2.3, 31.6, -3.4), 4, 3, (168, 0, 16)),
    ((0.4, 31.6, -3.4), 3, 2, (172, 0, -6)),
    ((2.6, 31.6, -3.4), 3, 2, (165, 0, -20)),
]

CAP_FRONT = [
    '43344334',
    '32233223',
    '2.1221.2',
    '1......1',
    '1......1',
    '........',
    '........',
    '........',
]
# right side: column 0 is the back edge, column 7 the front edge
CAP_RIGHT = [
    '33333433',
    '22233322',
    '22222221',
    '2222221.',
    '222211..',
    '2221....',
    '221.....',
    '11......',
]
CAP_LEFT = [row[::-1] for row in CAP_RIGHT]
CAP_BACK = [
    '33433343',
    '22322232',
    '22222222',
    '21222212',
    '22122122',
    '12222221',
    '11211211',
    '.1.11.1.',
]


def _hair_painters(pal):
    def tone(ch):
        return None if ch == '.' else pal[int(ch)]

    def grid(img, rect, rows):
        x, y, w, h = rect
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                c = tone(ch)
                if c is not None:
                    img.putpixel((x + i, y + j), c)

    def paint_cap(img, rects, size):
        grid(img, rects['front'], CAP_FRONT)
        grid(img, rects['right'], CAP_RIGHT)
        grid(img, rects['left'], CAP_LEFT)
        grid(img, rects['back'], CAP_BACK)
        x, y, w, h = rects['up']
        rnd = random.Random(7)
        for j in range(h):
            for i in range(w):
                img.putpixel((x + i, y + j), pal[3] if rnd.random() < 0.7 else pal[4])
        x, y, w, h = rects['down']
        for j in range(h):
            for i in range(w):
                img.putpixel((x + i, y + j), pal[1])

    def spike_painter(level, seed):
        # level: 0 = root segment, 1 = middle, 2 = tip
        def paint(img, rects, size):
            rnd = random.Random(seed)
            w, h, d = size
            for face, rect in rects.items():
                x, y, fw, fh = rect
                for j in range(fh):
                    for i in range(fw):
                        if face in ('up',):
                            t = 3 + (1 if level == 2 else 0)
                        elif face == 'down':
                            t = 1
                        else:
                            # rows go from the outer end (top) towards the root
                            t = 1 + level + (1 if j < fh / 2 else 0)
                            if face == 'back':
                                t -= 1
                            if face in ('right', 'left') and i == 0:
                                t -= 1
                            if rnd.random() < 0.12:
                                t += 1
                        img.putpixel((x + i, y + j), pal[max(0, min(4, t))])
        return paint

    return paint_cap, spike_painter


def build_hair(style):
    pal = HAIR_PALETTES[style]
    atlas = Atlas(64, 64)
    model = Model('geometry.goku.hair', atlas, bounds=(3, 3.5, (0, 1.75, 0)))
    model.bone('head', (0, 24, 0))
    paint_cap, spike_painter = _hair_painters(pal)
    model.cube('head', (-4, 24, -4), (8, 8, 8), paint_cap, inflate=0.6)
    for n, (base, length, thick, rot) in enumerate(HAIR_SPIKES):
        bx, by, bz = base
        # tapered spike: thick root, thinner middle, 1px tip
        segs = [(thick, max(2, round(length * 0.45))),
                (max(1, thick - 1), max(1, round(length * 0.35))),
                (max(1, thick - 2), max(1, length - round(length * 0.45) - round(length * 0.35)))]
        y = by
        for level, (s, seg_len) in enumerate(segs):
            model.cube('head', (bx - s / 2, y, bz - s / 2), (s, seg_len, s),
                       spike_painter(level, n * 3 + level),
                       pivot=(bx, by, bz), rotation=rot)
            y += seg_len
    return atlas, model
