"""Procedural pixel-art textures for Ancient Ruins Expedition.

Blocks/items are 16x16, mobs are 64x64 (mobile friendly). Mob textures follow
the box-UV layout of the geometry files in RP/models/entity.
"""
import os

from pixels import CLEAR, Canvas, box_faces, hexc, mix, rng, shade

# ---------------------------------------------------------------------------
# Glyph symbols (12x12). '#' main colour, '+' highlight, '-' shadow.
# ---------------------------------------------------------------------------
SYMBOLS = {
    "sun": [
        ".....##.....",
        "..#..##..#..",
        "...#....#...",
        "....####....",
        "...#++###...",
        "##.#+####.##",
        "##.######.##",
        "...######...",
        "....####....",
        "...#....#...",
        "..#..##..#..",
        ".....##.....",
    ],
    "serpent": [
        "....#####...",
        "...##+++##..",
        "...#+#.#+#..",
        "...##....#..",
        "....###.....",
        "......###...",
        "........##..",
        "..#......#..",
        "..##.....#..",
        "...##...##..",
        "....#####...",
        "............",
    ],
    "moon": [
        ".....####...",
        "...###+.....",
        "..###+......",
        "..##+.......",
        ".###........",
        ".###........",
        ".###........",
        ".###........",
        "..##-.......",
        "..###-......",
        "...###-.....",
        ".....####...",
    ],
    "eye": [
        "............",
        "....####....",
        "..##....##..",
        ".#...##...#.",
        "#...#++#...#",
        "#...####...#",
        "#...####...#",
        ".#...##...#.",
        "..##....##..",
        "....####....",
        "............",
        "............",
    ],
    "ankh": [
        "....####....",
        "...#+..-#...",
        "...#....#...",
        "...#....#...",
        "....#..#....",
        "############",
        "#+#######-##",
        ".....##.....",
        ".....##.....",
        ".....##.....",
        ".....##.....",
        ".....##.....",
    ],
    "horus": [
        "............",
        "..########..",
        ".#........#.",
        "#...####...#",
        "###.#++#.###",
        "....####....",
        ".....#......",
        ".....#......",
        ".....##..#..",
        "......#.##..",
        "......###...",
        "............",
    ],
    "scarab": [
        ".#........#.",
        "..#.####.#..",
        "...##++##...",
        "..##.##.##..",
        ".###.##.###.",
        ".#+#.##.#+#.",
        ".###.##.###.",
        "..##.##.##..",
        "...######...",
        "..#..##..#..",
        ".#........#.",
        "............",
    ],
    "feather": [
        ".....#......",
        "....###.....",
        "....#+#.....",
        "...##+##....",
        "...#.+.#....",
        "...##+##....",
        "...#.+.#....",
        "...##+##....",
        "....#+#.....",
        ".....#......",
        ".....#......",
        ".....#......",
    ],
    "anchor": [
        ".....##.....",
        "....#..#....",
        ".....##.....",
        "..########..",
        ".....##.....",
        ".....##.....",
        ".....##.....",
        "#....##....#",
        "##...##...##",
        ".##..##..##.",
        "..########..",
        "....####....",
    ],
    "star": [
        ".....##.....",
        ".....++.....",
        "....####....",
        "#...####...#",
        ".##########.",
        "..###++###..",
        "..###++###..",
        ".##########.",
        "#...####...#",
        "....####....",
        ".....##.....",
        ".....##.....",
    ],
    "wave": [
        "............",
        "..###....###",
        ".#+..#..#+..",
        "#.....##....",
        "............",
        "..###....###",
        ".#+..#..#+..",
        "#.....##....",
        "............",
        "..###....###",
        ".#+..#..#+..",
        "#.....##....",
    ],
    "skull": [
        "...######...",
        "..########..",
        ".##########.",
        ".#..####..#.",
        ".#..####..#.",
        ".##########.",
        "..###..###..",
        "...######...",
        "...#.##.#...",
        "...######...",
        "............",
        "............",
    ],
}

THEMES = {
    # glyph order: 1, 2, 3, 4 (the order the puzzle expects)
    "temple": {"symbols": ["sun", "serpent", "moon", "eye"],
               "ink": hexc("#3ee07c"), "hi": hexc("#b8ffd0"), "lo": hexc("#1a8a48")},
    "crypt": {"symbols": ["ankh", "horus", "scarab", "feather"],
              "ink": hexc("#f2c23b"), "hi": hexc("#fff0a0"), "lo": hexc("#a8781a")},
    "ship": {"symbols": ["anchor", "star", "wave", "skull"],
             "ink": hexc("#46e6e0"), "hi": hexc("#c8ffff"), "lo": hexc("#1b8a93")},
}


# ---------------------------------------------------------------------------
# Block backgrounds
# ---------------------------------------------------------------------------
def mossy_stone(seed, moss=0.18):
    r = rng(seed)
    c = Canvas(16, 16)
    base = hexc("#7a7f70")
    c.noise(0, 0, 16, 16, base, 0.10, r)
    # carved tile grid: 2x2 slabs
    dark = hexc("#4a4d43")
    for i in range(16):
        c.put(i, 0, dark)
        c.put(0, i, dark)
        c.put(i, 8, shade(dark, 1.15))
        c.put(8, i, shade(dark, 1.15))
    for i in range(1, 16):
        c.put(i, 1, shade(base, 1.18))
        c.put(1, i, shade(base, 1.18))
    for _ in range(int(40 * moss / 0.18)):
        x, y = r.randrange(16), r.randrange(16)
        g = hexc("#4f7d36") if r.random() < 0.6 else hexc("#6a9a40")
        c.put(x, y, g)
        if r.random() < 0.5:
            c.put(x + 1, y, g)
    return c


def sandstone(seed):
    r = rng(seed)
    c = Canvas(16, 16)
    base = hexc("#dcc68e")
    c.noise(0, 0, 16, 16, base, 0.05, r)
    grout = hexc("#b89c62")
    for x in range(16):
        c.put(x, 0, grout)
        c.put(x, 8, grout)
    for y in range(0, 8):
        c.put(0, y, grout)
    for y in range(8, 16):
        c.put(8, y, grout)
    for x in range(1, 16):
        c.put(x, 1, shade(base, 1.07))
        c.put(x, 9, shade(base, 1.07))
    return c


def dark_wood(seed, rot=0.0):
    r = rng(seed)
    c = Canvas(16, 16)
    base = hexc("#4b3522") if rot < 0.5 else hexc("#3c2d1d")
    for y in range(16):
        band = (y // 4) % 2
        for x in range(16):
            f = 1.0 + r.uniform(-0.08, 0.08) + (0.06 if band else 0.0)
            if (x + y * 3) % 7 == 0:
                f -= 0.12
            c.put(x, y, shade(base, f))
    seam = hexc("#24190f")
    for y in (3, 7, 11, 15):
        c.hline(0, 15, y, seam)
    for (x, y) in ((5, 0), (12, 4), (3, 8), (10, 12)):
        c.vline(x, y, y + 2, seam)
    return c


# ---------------------------------------------------------------------------
# Block textures
# ---------------------------------------------------------------------------
def glyph_block(theme, idx):
    t = THEMES[theme]
    if theme == "temple":
        c = mossy_stone(100 + idx, moss=0.06)
        frame = hexc("#3b3f35")
    elif theme == "crypt":
        c = sandstone(200 + idx)
        frame = hexc("#9c7f45")
    else:
        c = dark_wood(300 + idx)
        frame = hexc("#b08a3e")  # brass frame
    c.border(1, 1, 14, 14, frame)
    c.rect(2, 2, 12, 12, shade(c.get(8, 8), 0.78))
    c.stamp(2, 2, SYMBOLS[t["symbols"][idx - 1]], {"#": t["ink"], "+": t["hi"], "-": t["lo"]})
    for (x, y) in ((1, 1), (14, 1), (1, 14), (14, 14)):
        c.put(x, y, t["hi"])
    return c


def temple_floor():
    return mossy_stone(11)


def crumbling(base_fn, seed, crack):
    c = base_fn()
    r = rng(seed)
    for start in ((2, 3), (9, 1), (4, 10), (12, 9)):
        x, y = start
        for _ in range(7):
            c.put(x, y, crack)
            x += r.choice((-1, 0, 1))
            y += r.choice((0, 1, 1))
            if not (0 <= x < 16 and 0 <= y < 16):
                break
    c.speckle(0, 0, 16, 16, shade(crack, 1.3), 0.05, r)
    return c


def crypt_floor():
    c = sandstone(21)
    ink = hexc("#b0904f")
    c.stamp(3, 3, ["#.#", ".#.", "#.#"], {"#": ink})
    c.stamp(11, 11, ["##", "##"], {"#": ink})
    c.stamp(10, 3, ["###"], {"#": ink})
    c.stamp(3, 12, ["#", "#", "#"], {"#": ink})
    return c


def ship_floor():
    c = dark_wood(31)
    r = rng(32)
    for _ in range(9):
        x, y = r.randrange(1, 15), r.randrange(1, 15)
        c.put(x, y, hexc("#d7d3c2"))
        c.put(x + 1, y, hexc("#a9a594"))
    c.speckle(0, 0, 16, 16, hexc("#3f6d4b"), 0.06, r)
    return c


def rotten_planks():
    c = dark_wood(41, rot=1.0)
    r = rng(42)
    c.speckle(0, 0, 16, 16, hexc("#44683a"), 0.10, r)
    for (x, y) in ((4, 5), (10, 9), (6, 13)):
        c.rect(x, y, 2, 2, hexc("#0e0a06"))
    c.speckle(0, 0, 16, 16, hexc("#1a120a"), 0.06, r)
    return c


def altar_top(theme):
    t = THEMES[theme]
    if theme == "temple":
        c = mossy_stone(51, moss=0.04)
    elif theme == "crypt":
        c = sandstone(52)
    else:
        c = dark_wood(53)
    gold = hexc("#e3b341")
    c.border(0, 0, 16, 16, shade(gold, 0.8))
    c.border(1, 1, 14, 14, gold)
    gem = [
        "....#....",
        "...###...",
        "..##+##..",
        ".##+###-.",
        "####+###-",
        ".######-.",
        "..#####..",
        "...###...",
        "....#....",
    ]
    c.stamp(4, 4, gem, {"#": t["ink"], "+": t["hi"], "-": t["lo"]})
    for (x, y) in ((2, 2), (13, 2), (2, 13), (13, 13)):
        c.put(x, y, t["hi"])
    return c


def altar_side(theme):
    t = THEMES[theme]
    if theme == "temple":
        c = mossy_stone(61, moss=0.10)
    elif theme == "crypt":
        c = sandstone(62)
    else:
        c = dark_wood(63)
    gold = hexc("#d9a93a")
    c.hline(0, 15, 6, gold)
    c.hline(0, 15, 9, gold)
    for x in range(0, 16, 3):
        c.put(x, 7, t["ink"])
        c.put(x + 1, 8, t["ink"])
    c.rect(6, 11, 4, 3, shade(t["ink"], 0.7))
    c.put(7, 12, t["hi"])
    c.hline(0, 15, 15, shade(gold, 0.6))
    return c


def dormant_altar():
    r = rng(71)
    c = Canvas(16, 16)
    c.noise(0, 0, 16, 16, hexc("#5f615c"), 0.12, r)
    c.border(0, 0, 16, 16, hexc("#3a3b38"))
    crack = hexc("#262624")
    x, y = 3, 2
    for _ in range(14):
        c.put(x, y, crack)
        x += r.choice((0, 1))
        y += 1 if r.random() < 0.8 else 0
    c.rect(6, 6, 4, 4, hexc("#34352f"))
    return c


def vault_seal():
    r = rng(81)
    c = Canvas(16, 16)
    c.noise(0, 0, 16, 16, hexc("#2e2d3a"), 0.10, r)
    gold = hexc("#e2b544")
    ring = [
        ".....######.....",
        "...##......##...",
        "..#..........#..",
        ".#............#.",
        ".#............#.",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        ".#............#.",
        ".#............#.",
        "..#..........#..",
        "...##......##...",
        ".....######.....",
    ]
    c.stamp(0, 0, ring, {"#": gold})
    c.stamp(6, 5, [".##.", "####", "####", ".##.", ".##.", "####"], {"#": hexc("#101014")})
    for (x, y) in ((8, 2), (8, 13), (2, 8), (13, 8)):
        c.put(x, y, hexc("#7de6ff"))
    return c


def trap_mechanism():
    r = rng(91)
    c = Canvas(16, 16)
    c.noise(0, 0, 16, 16, hexc("#7b7d74"), 0.09, r)
    c.border(0, 0, 16, 16, hexc("#55574f"))
    for (x, y) in ((4, 4), (11, 4), (4, 11), (11, 11), (7, 7)):
        c.rect(x, y, 2, 2, hexc("#1d1e1b"))
    return c


def miasma_vent():
    r = rng(95)
    c = Canvas(16, 16)
    c.noise(0, 0, 16, 16, hexc("#30342d"), 0.08, r)
    glow = hexc("#79ff6e")
    glow2 = hexc("#3fb34a")
    for y in (3, 7, 11):
        for x in range(2, 14):
            c.put(x, y, glow2 if (x + y) % 3 else glow)
            c.put(x, y + 1, hexc("#1b2019"))
    c.border(0, 0, 16, 16, hexc("#1e211c"))
    return c


# ---------------------------------------------------------------------------
# Item textures
# ---------------------------------------------------------------------------
def ruin_compass():
    c = Canvas(16, 16)
    rim = hexc("#d6a53a")
    rim_dark = hexc("#8f6a1e")
    face = hexc("#1e5b48")
    body = [
        ".....######.....",
        "...##++++++##...",
        "..#+--------+#..",
        ".#+----------+#.",
        ".#+----------+#.",
        "#+------------+#",
        "#+------------+#",
        "#+------------+#",
        "#+------------+#",
        "#+------------+#",
        "#+------------+#",
        ".#+----------+#.",
        ".#+----------+#.",
        "..#+--------+#..",
        "...##++++++##...",
        ".....######.....",
    ]
    c.stamp(0, 0, body, {"#": rim_dark, "+": rim, "-": face})
    r = rng(5)
    c.speckle(3, 3, 10, 10, shade(face, 1.3), 0.12, r)
    # rune marks at N/E/S/W
    for (x, y) in ((7, 2), (8, 2), (13, 7), (13, 8), (7, 13), (8, 13), (2, 7), (2, 8)):
        c.put(x, y, hexc("#66ffb0"))
    # needle: red towards north-east, pale towards south-west
    for i, (x, y) in enumerate(((11, 4), (10, 5), (9, 6), (8, 7))):
        c.put(x, y, hexc("#ff3b3b") if i < 3 else hexc("#ffd84a"))
    for (x, y) in ((7, 8), (6, 9), (5, 10)):
        c.put(x, y, hexc("#e8e2d0"))
    c.put(8, 8, hexc("#ffd84a"))
    c.put(7, 7, hexc("#ffd84a"))
    return c


def cursed_ring():
    c = Canvas(16, 16)
    gold = hexc("#e8b93f")
    gold_dark = hexc("#9a6f17")
    gem = hexc("#9b2fe0")
    ring = [
        "................",
        "......####......",
        ".....#+--+#.....",
        ".....#-@@-#.....",
        "......#@@#......",
        "....########....",
        "...##......##...",
        "..#+........-#..",
        "..#+........-#..",
        "..#+........-#..",
        "..#+........-#..",
        "...#+......-#...",
        "....##+..-##....",
        "......####......",
        "................",
        "................",
    ]
    c.stamp(0, 0, ring, {"#": gold_dark, "+": gold, "-": shade(gold, 0.75), "@": gem})
    c.put(7, 3, hexc("#e6b8ff"))
    r = rng(9)
    for _ in range(9):
        x, y = r.randrange(1, 15), r.randrange(5, 15)
        if c.get(x, y)[3] == 0:
            c.put(x, y, hexc("#5a1470", 170))
    return c


def ancient_map():
    c = Canvas(16, 16)
    paper = hexc("#dcc79b")
    r = rng(13)
    c.noise(1, 1, 14, 14, paper, 0.06, r)
    edge = hexc("#8e7043")
    c.border(1, 1, 14, 14, edge)
    for (x, y) in ((1, 1), (14, 1), (1, 14), (14, 14), (6, 1), (14, 9), (1, 6)):
        c.put(x, y, CLEAR)
    ink = hexc("#6b4a24")
    path = [(3, 12), (4, 11), (5, 11), (6, 10), (7, 9), (7, 8), (8, 7), (9, 7), (10, 6)]
    for i, (x, y) in enumerate(path):
        if i % 2 == 0:
            c.put(x, y, ink)
    c.rect(3, 3, 3, 2, hexc("#5f8f4c"))
    c.rect(4, 5, 2, 1, hexc("#5f8f4c"))
    c.rect(9, 11, 3, 2, hexc("#6aa3c9"))
    red = hexc("#d42a2a")
    for (x, y) in ((10, 3), (12, 3), (11, 4), (10, 5), (12, 5)):
        c.put(x, y, red)
    return c


# ---------------------------------------------------------------------------
# Mob textures (64x64 box UV)
# ---------------------------------------------------------------------------
HEAD = (0, 0, 8, 8, 8)
BODY = (16, 16, 8, 12, 4)
ARM = (40, 16, 4, 12, 4)
LEG = (0, 16, 4, 12, 4)
PLUME = (32, 0, 10, 6, 1)
HAT_BRIM = (0, 32, 10, 1, 10)
HAT_TOP = (0, 44, 8, 3, 8)
NEMES = (0, 32, 9, 11, 9)
BEARD = (40, 32, 2, 4, 1)


def paint_box(c, box, base, var, seed, overrides=None):
    u, v, w, h, d = box
    r = rng(seed)
    for name, (x, y, fw, fh) in box_faces(u, v, w, h, d).items():
        col = base
        if overrides and name in overrides:
            col = overrides[name]
        c.noise(x, y, fw, fh, col, var, r)


def face_rect(box, face):
    u, v, w, h, d = box
    return box_faces(u, v, w, h, d)[face]


def temple_guardian_tex(boss=False):
    c = Canvas(64, 64)
    if boss:
        stone, jade, gold, eye = hexc("#2eab66"), hexc("#7dffb0"), hexc("#e7b73e"), hexc("#fff27a")
    else:
        stone, jade, gold, eye = hexc("#7c8672"), hexc("#34c46c"), hexc("#c9a042"), hexc("#7dffa6")
    paint_box(c, HEAD, stone, 0.10, 1)
    paint_box(c, BODY, stone, 0.10, 2)
    paint_box(c, ARM, stone, 0.10, 3)
    paint_box(c, LEG, shade(stone, 0.85), 0.10, 4)
    r = rng(7)
    if not boss:
        for box in (HEAD, BODY, ARM, LEG):
            u, v, w, h, d = box
            c.speckle(u, v, 2 * (w + d), h + d, hexc("#4f7d36"), 0.08, r)
    # face: jade mask with glowing eyes
    x, y, w, h = face_rect(HEAD, "front")
    c.rect(x + 1, y + 2, 6, 3, shade(jade, 0.75))
    c.rect(x + 1, y + 3, 2, 1, eye)
    c.rect(x + 5, y + 3, 2, 1, eye)
    c.hline(x + 2, x + 5, y + 6, hexc("#1f231c"))
    if boss:
        c.put(x + 2, y + 7, hexc("#f4f4f4"))
        c.put(x + 5, y + 7, hexc("#f4f4f4"))
    c.hline(x, x + 7, y, gold)  # crown band
    # plume feathers
    px, py, pw, ph = face_rect(PLUME, "front")
    cols = [hexc("#2fbf5a"), hexc("#d83a2e"), hexc("#f0c43a"), hexc("#2fbf5a"), hexc("#1e8f9e")]
    for i in range(pw):
        col = cols[i % len(cols)] if not boss else (gold if i % 2 else jade)
        c.vline(px + i, py, py + ph - 1, col)
        c.put(px + i, py, shade(col, 1.3))
    bx, by, bw, bh = face_rect(PLUME, "back")
    for i in range(bw):
        c.vline(bx + i, by, by + bh - 1, shade(cols[i % len(cols)], 0.8))
    for f in ("top", "right", "left", "bottom"):
        fx, fy, fw, fh = face_rect(PLUME, f)
        c.rect(fx, fy, fw, fh, shade(jade, 0.8))
    # chest emblem + belt
    x, y, w, h = face_rect(BODY, "front")
    c.stamp(x + 2, y + 1, [".##.", "#++#", "#++#", ".##."], {"#": gold, "+": jade})
    c.hline(x, x + 7, y + 8, jade)
    c.hline(x, x + 7, y + 9, shade(jade, 0.7))
    c.put(x + 3, y + 8, gold)
    c.put(x + 4, y + 8, gold)
    for f in ("back", "left", "right"):
        fx, fy, fw, fh = face_rect(BODY, f)
        c.hline(fx, fx + fw - 1, fy + 8, jade)
        c.hline(fx, fx + fw - 1, fy + 9, shade(jade, 0.7))
    # bracers
    for f in ("front", "back", "left", "right"):
        fx, fy, fw, fh = face_rect(ARM, f)
        c.hline(fx, fx + fw - 1, fy + 8, gold)
        c.rect(fx, fy + 9, fw, 2, jade)
    # loincloth on legs
    for f in ("front", "back"):
        fx, fy, fw, fh = face_rect(LEG, f)
        c.rect(fx, fy, fw, 3, shade(jade, 0.8))
    return c


def mummy_tex():
    c = Canvas(64, 64)
    wrap = hexc("#d9cfae")
    r = rng(21)

    def wrap_box(box, seed):
        u, v, w, h, d = box
        rr = rng(seed)
        for name, (x, y, fw, fh) in box_faces(u, v, w, h, d).items():
            for yy in range(fh):
                for xx in range(fw):
                    stripe = ((yy + xx // 3) % 3 == 0)
                    col = shade(wrap, 0.78 if stripe else 1.0 + rr.uniform(-0.06, 0.06))
                    if rr.random() < 0.05:
                        col = hexc("#3b3226")
                    c.put(x + xx, y + yy, col)

    wrap_box(HEAD, 22)
    wrap_box(BODY, 23)
    wrap_box(ARM, 24)
    wrap_box(LEG, 25)
    x, y, w, h = face_rect(HEAD, "front")
    c.rect(x + 1, y + 3, 6, 2, hexc("#2d251b"))
    c.put(x + 2, y + 3, hexc("#ffcc33"))
    c.put(x + 5, y + 3, hexc("#ffcc33"))
    c.put(x + 2, y + 4, hexc("#c98a1c"))
    c.put(x + 5, y + 4, hexc("#c98a1c"))
    c.hline(x + 3, x + 4, y + 6, hexc("#2d251b"))
    c.speckle(0, 0, 64, 32, hexc("#b9ad8e"), 0.02, r)
    return c


def captain_tex(boss=False):
    c = Canvas(64, 64)
    skin = hexc("#4d8c82") if not boss else hexc("#3a5f66")
    coat = hexc("#23305c") if not boss else hexc("#15182a")
    gold = hexc("#d2a646")
    eye = hexc("#86fbff")
    paint_box(c, HEAD, skin, 0.12, 31)
    paint_box(c, BODY, coat, 0.08, 32)
    paint_box(c, ARM, coat, 0.08, 33)
    paint_box(c, LEG, hexc("#2b2a2e"), 0.08, 34)
    r = rng(35)
    # face
    x, y, w, h = face_rect(HEAD, "front")
    c.rect(x + 1, y + 3, 2, 1, eye)
    c.rect(x + 5, y + 3, 2, 1, eye)
    beard = hexc("#233a36") if not boss else hexc("#0f1718")
    c.rect(x + 1, y + 5, 6, 3, beard)
    c.hline(x + 3, x + 4, y + 5, hexc("#101010"))
    for f in ("right", "left"):
        fx, fy, fw, fh = face_rect(HEAD, f)
        c.rect(fx, fy + 5, fw, 3, beard)
    c.speckle(0, 0, 32, 16, hexc("#c9c4b0"), 0.04 if boss else 0.02, r)  # barnacles
    # coat front: shirt, buttons, sash
    x, y, w, h = face_rect(BODY, "front")
    c.rect(x + 3, y, 2, 3, hexc("#d8d8c8"))
    for yy in (2, 5, 8):
        c.put(x + 2, y + yy, gold)
        c.put(x + 5, y + yy, gold)
    c.hline(x, x + 7, y + 10, hexc("#8f1f1f"))
    c.speckle(16, 16, 24, 16, hexc("#9ea79a"), 0.03, r)
    # sleeves: gold cuffs, skin hands, epaulettes
    for f in ("front", "back", "left", "right"):
        fx, fy, fw, fh = face_rect(ARM, f)
        c.hline(fx, fx + fw - 1, fy + 8, gold)
        c.rect(fx, fy + 9, fw, 3, skin)
    tx, ty, tw, th = face_rect(ARM, "top")
    c.rect(tx, ty, tw, th, gold)
    # boots
    for f in ("front", "back", "left", "right"):
        fx, fy, fw, fh = face_rect(LEG, f)
        c.rect(fx, fy + 8, fw, 4, hexc("#141414"))
    # tricorn hat
    hat = hexc("#15161c")
    paint_box(c, HAT_BRIM, hat, 0.06, 36)
    paint_box(c, HAT_TOP, hat, 0.06, 37)
    for f in ("front", "back", "left", "right"):
        fx, fy, fw, fh = face_rect(HAT_BRIM, f)
        c.hline(fx, fx + fw - 1, fy, gold)
        fx, fy, fw, fh = face_rect(HAT_TOP, f)
        c.hline(fx, fx + fw - 1, fy + fh - 1, gold)
    fx, fy, fw, fh = face_rect(HAT_TOP, "front")
    c.stamp(fx + 2, fy, ["####", "#..#", ".##."], {"#": hexc("#e8e4d8"), ".": hexc("#15161c")})
    return c


def pharaoh_tex():
    c = Canvas(64, 64)
    wrap = hexc("#cdbf98")
    gold = hexc("#e7b53c")
    lapis = hexc("#2548ad")
    paint_box(c, HEAD, hexc("#8b7b58"), 0.10, 41)
    paint_box(c, BODY, wrap, 0.07, 42)
    paint_box(c, ARM, wrap, 0.07, 43)
    paint_box(c, LEG, wrap, 0.07, 44)
    x, y, w, h = face_rect(HEAD, "front")
    c.rect(x + 1, y + 3, 2, 1, hexc("#5fd0ff"))
    c.rect(x + 5, y + 3, 2, 1, hexc("#5fd0ff"))
    c.hline(x + 1, x + 2, y + 2, hexc("#141414"))
    c.hline(x + 5, x + 6, y + 2, hexc("#141414"))
    c.hline(x + 3, x + 4, y + 6, hexc("#3a2f20"))
    # nemes headdress: gold/lapis stripes, transparent face window
    u, v, nw, nh, nd = NEMES
    for name, (fx, fy, fw, fh) in box_faces(u, v, nw, nh, nd).items():
        for yy in range(fh):
            for xx in range(fw):
                col = gold if (yy // 2) % 2 == 0 else lapis
                if name in ("top", "bottom"):
                    col = gold if (xx // 2) % 2 == 0 else lapis
                c.put(fx + xx, fy + yy, col)
    fx, fy, fw, fh = face_rect(NEMES, "front")
    for yy in range(1, 8):
        for xx in range(1, fw - 1):
            c.put(fx + xx, fy + yy, CLEAR)
    for f in ("bottom",):
        bx, by, bw, bh = face_rect(NEMES, f)
        c.rect(bx, by, bw, bh, CLEAR)
    fx, fy, fw, fh = face_rect(NEMES, "front")
    c.stamp(fx + 3, fy, [".#.", "###"], {"#": hexc("#3de07a")})  # uraeus cobra
    # beard
    for name, (bx, by, bw, bh) in box_faces(*BEARD).items():
        for yy in range(bh):
            c.hline(bx, bx + bw - 1, by + yy, gold if yy % 2 == 0 else lapis)
    # collar and belt
    x, y, w, h = face_rect(BODY, "front")
    for yy, col in enumerate((gold, lapis, gold, hexc("#c43b2b"))):
        c.hline(x, x + 7, y + yy, col)
    c.hline(x, x + 7, y + 8, gold)
    c.rect(x + 2, y + 9, 4, 3, hexc("#f0ead6"))
    for f in ("back", "left", "right"):
        fx, fy, fw, fh = face_rect(BODY, f)
        c.hline(fx, fx + fw - 1, fy, gold)
        c.hline(fx, fx + fw - 1, fy + 1, lapis)
        c.hline(fx, fx + fw - 1, fy + 8, gold)
    for f in ("front", "back", "left", "right"):
        fx, fy, fw, fh = face_rect(ARM, f)
        c.hline(fx, fx + fw - 1, fy + 2, gold)
        c.hline(fx, fx + fw - 1, fy + 8, gold)
        c.hline(fx, fx + fw - 1, fy + 9, lapis)
        fx, fy, fw, fh = face_rect(LEG, f)
        c.rect(fx, fy, fw, 4, hexc("#f0ead6"))
    return c


def marker_tex():
    return Canvas(16, 16)


# ---------------------------------------------------------------------------
# Pack icons
# ---------------------------------------------------------------------------
def pack_icon(kind):
    c = Canvas(64, 64)
    r = rng(99 if kind == "bp" else 98)
    sky = hexc("#1c3b2e") if kind == "bp" else hexc("#23324f")
    for y in range(64):
        c.hline(0, 63, y, mix(sky, hexc("#0d1512"), y / 64))
    # stepped pyramid silhouette
    stone = hexc("#8b9a78")
    for i, (w, y) in enumerate(((52, 50), (40, 42), (28, 34), (16, 26))):
        x0 = 32 - w // 2
        c.noise(x0, y, w, 8, shade(stone, 1.0 - i * 0.06), 0.08, r)
        c.hline(x0, x0 + w - 1, y, shade(stone, 1.25))
    c.rect(29, 44, 6, 6, hexc("#101410"))
    # glowing jade glyph on the top tier
    c.stamp(26, 12, SYMBOLS["sun"], {"#": hexc("#3ee07c"), "+": hexc("#b8ffd0"), "-": hexc("#1a8a48")})
    c.speckle(0, 50, 64, 14, hexc("#4f7d36"), 0.25, r)
    c.border(0, 0, 64, 64, hexc("#d6a53a"))
    c.border(1, 1, 62, 62, hexc("#8f6a1e"))
    return c


def build_all(bp_dir, rp_dir):
    out = {}

    def save(canvas, rel, root):
        path = os.path.join(root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        canvas.save(path)
        out[rel] = canvas

    blocks = "textures/blocks/ancient_ruins/"
    save(temple_floor(), blocks + "temple_floor.png", rp_dir)
    save(crumbling(temple_floor, 12, hexc("#2b2e26")), blocks + "crumbling_temple_floor.png", rp_dir)
    save(crypt_floor(), blocks + "crypt_floor.png", rp_dir)
    save(crumbling(lambda: sandstone(22), 23, hexc("#8a7240")), blocks + "crumbling_sandstone.png", rp_dir)
    save(ship_floor(), blocks + "ship_floor.png", rp_dir)
    save(rotten_planks(), blocks + "rotten_planks.png", rp_dir)
    for theme in THEMES:
        for i in range(1, 5):
            save(glyph_block(theme, i), blocks + f"{theme}_glyph_{i}.png", rp_dir)
        save(altar_top(theme), blocks + f"{theme}_altar_top.png", rp_dir)
        save(altar_side(theme), blocks + f"{theme}_altar_side.png", rp_dir)
    save(dormant_altar(), blocks + "dormant_altar.png", rp_dir)
    save(vault_seal(), blocks + "vault_seal.png", rp_dir)
    save(trap_mechanism(), blocks + "trap_mechanism.png", rp_dir)
    save(miasma_vent(), blocks + "miasma_vent.png", rp_dir)

    items = "textures/items/ancient_ruins/"
    save(ruin_compass(), items + "ruin_compass.png", rp_dir)
    save(cursed_ring(), items + "cursed_ring.png", rp_dir)
    save(ancient_map(), items + "ancient_map.png", rp_dir)

    ent = "textures/entity/ancient_ruins/"
    save(temple_guardian_tex(), ent + "temple_guardian.png", rp_dir)
    save(mummy_tex(), ent + "crypt_mummy.png", rp_dir)
    save(captain_tex(), ent + "drowned_captain.png", rp_dir)
    save(temple_guardian_tex(boss=True), ent + "jade_idol.png", rp_dir)
    save(pharaoh_tex(), ent + "sand_pharaoh.png", rp_dir)
    save(captain_tex(boss=True), ent + "abyssal_admiral.png", rp_dir)
    save(marker_tex(), ent + "ruin_marker.png", rp_dir)

    save(pack_icon("rp"), "pack_icon.png", rp_dir)
    save(pack_icon("bp"), "pack_icon.png", bp_dir)
    return out


def contact_sheet(textures, path, scale=6, cols=8):
    items = sorted(textures.items())
    cell = 64 * scale // 4 * 4
    cell = max(t.w for _, t in items) * scale // 4 + 8
    small = [(k, t) for k, t in items if t.w == 16]
    big = [(k, t) for k, t in items if t.w > 16]
    rows_small = (len(small) + cols - 1) // cols
    sheet_w = cols * (16 * scale + 4) + 4
    sheet_h = rows_small * (16 * scale + 4) + 4 + ((len(big) + 3) // 4) * (64 * scale // 2 + 4) + 4
    sheet = Canvas(sheet_w, sheet_h, hexc("#404040"))
    for i, (_, t) in enumerate(small):
        x = 4 + (i % cols) * (16 * scale + 4)
        y = 4 + (i // cols) * (16 * scale + 4)
        sheet.blit(t.scaled(scale), x, y)
    y0 = 4 + rows_small * (16 * scale + 4)
    half = scale // 2 or 1
    for i, (_, t) in enumerate(big):
        x = 4 + (i % 4) * (64 * half + 4)
        y = y0 + (i // 4) * (64 * half + 4)
        sheet.blit(t.scaled(half), x, y)
    sheet.save(path)


if __name__ == "__main__":
    import sys
    bp, rp = sys.argv[1], sys.argv[2]
    tex = build_all(bp, rp)
    if len(sys.argv) > 3:
        contact_sheet(tex, sys.argv[3])
    print(len(tex), "textures")
