#!/usr/bin/env python3
"""
The Hollow Bride - texture generator.

Writes every PNG the add-on needs, at the right path, at the sizes the mobile
budget allows: 16x16 for blocks, items and the particle atlas, 64x64 for
entities, 128x128 for the two pack icons. Nothing larger is emitted.

Usage:
    python3 tools/make_textures.py            # writes into ./RP and ./BP
    python3 tools/make_textures.py --out DIR  # writes into DIR/RP and DIR/BP

Requires Pillow:  pip install pillow
"""

import argparse
import os
import random

from PIL import Image

random.seed(1861)  # the year on the plaques; keeps output reproducible

T = (0, 0, 0, 0)  # transparent


def hexrgba(s):
    s = s.lstrip("#")
    if len(s) == 6:
        return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), int(s[6:8], 16))


def grid(rows, palette):
    """Build a 16x16 RGBA image from 16 strings of 16 characters.

    '.' means transparent unless the palette gives it a colour explicitly.
    """
    assert len(rows) == 16, "need exactly 16 rows"
    img = Image.new("RGBA", (16, 16), T)
    px = img.load()
    for y, row in enumerate(rows):
        assert len(row) == 16, "row %d is %d chars, need 16" % (y, len(row))
        for x, ch in enumerate(row):
            if ch not in palette:
                assert ch == ".", "row %d uses undefined palette key %r" % (y, ch)
                continue
            px[x, y] = hexrgba(palette[ch])
    return img


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print("wrote", path, img.size)


# ---------------------------------------------------------------------------
# 16x16 block textures
# ---------------------------------------------------------------------------

SALT_LINE = (
    [
        "................",
        ".....xx...x.....",
        "...x.xxx.xx.x...",
        "..xxxxxxxxxxx...",
        ".x.xxoxxxoxx.x..",
        "..xxxxxxxxxxxx..",
        ".xxxoxxxxxxoxx..",
        "..xxxxxxxxxxx.x.",
        ".x.xxxxoxxxxxx..",
        "..xxxoxxxxxoxx..",
        ".xxxxxxxxxxxxx..",
        "..x.xxxoxxxx.x..",
        "...xxxxxxxxx....",
        "....x.xxx.x.....",
        ".....x...x......",
        "................",
    ],
    {"x": "#efece0", "o": "#cfc9b4"},
)

WARDROBE_FRONT = (
    [
        "aaaaaaaaaaaaaaaa",
        "abbbbbbaabbbbbba",
        "abccccbaabccccba",
        "abcddcbaabcddcba",
        "abcddcbaabcddcba",
        "abcddcbaabcddcba",
        "abccccbaabccccba",
        "abbbbbbaabbbbbba",
        "aaaaaaeaaeaaaaaa",
        "abbbbbbaabbbbbba",
        "abccccbaabccccba",
        "abcddcbaabcddcba",
        "abcddcbaabcddcba",
        "abccccbaabccccba",
        "abbbbbbaabbbbbba",
        "aaaaaaaaaaaaaaaa",
    ],
    {
        "a": "#2c1f14",
        "b": "#4a3520",
        "c": "#3a2818",
        "d": "#2a1c11",
        "e": "#b9a05a",
    },
)

WARDROBE_SIDE = (
    [
        "aaaaaaaaaaaaaaaa",
        "abbbbbbbbbbbbbba",
        "abccccccccccccba",
        "abcbbbbbbbbbbcba",
        "abcbccccccccbcba",
        "abcbcbbbbbbcbcba",
        "abcbcbccccbcbcba",
        "abcbcbcaacbcbcba",
        "abcbcbcaacbcbcba",
        "abcbcbccccbcbcba",
        "abcbcbbbbbbcbcba",
        "abcbccccccccbcba",
        "abcbbbbbbbbbbcba",
        "abccccccccccccba",
        "abbbbbbbbbbbbbba",
        "aaaaaaaaaaaaaaaa",
    ],
    {"a": "#241a10", "b": "#43301d", "c": "#332415"},
)

WARDROBE_TOP = (
    [
        "aaaaaaaaaaaaaaaa",
        "abbbbbbbbbbbbbba",
        "abcbcbcbcbcbcbba",
        "abbcbcbcbcbcbcba",
        "abcbcbcbcbcbcbba",
        "abbcbcbcbcbcbcba",
        "abcbcbcbcbcbcbba",
        "abbcbcbcbcbcbcba",
        "abcbcbcbcbcbcbba",
        "abbcbcbcbcbcbcba",
        "abcbcbcbcbcbcbba",
        "abbcbcbcbcbcbcba",
        "abcbcbcbcbcbcbba",
        "abbcbcbcbcbcbcba",
        "abbbbbbbbbbbbbba",
        "aaaaaaaaaaaaaaaa",
    ],
    {"a": "#1e150c", "b": "#3c2b19", "c": "#4b3722"},
)

UNDER_BED = (
    [
        "aaaaaaaaaaaaaaaa",
        "abbbbbbbbbbbbbba",
        "abccccccccccccba",
        "abcddddddddddcba",
        "abcdeeeeeeeedcba",
        "abcdeffffffedcba",
        "abcdefggggfedcba",
        "abcdefghhgfedcba",
        "abcdefghhgfedcba",
        "abcdefggggfedcba",
        "abcdeffffffedcba",
        "abcdeeeeeeeedcba",
        "abcddddddddddcba",
        "abccccccccccccba",
        "abbbbbbbbbbbbbba",
        "aaaaaaaaaaaaaaaa",
    ],
    {
        "a": "#3a2a1b",
        "b": "#312417",
        "c": "#281d13",
        "d": "#20170e",
        "e": "#18110a",
        "f": "#120c07",
        "g": "#0b0705",
        "h": "#050303",
    },
)

WALL_CANDLE_UNLIT = (
    [
        "aaaaaaaaaaaaaaaa",
        "abbbbbbbbbbbbbba",
        "abaaaaaaaaaaaaba",
        "abaaaaaccaaaaaba",
        "abaaaaaccaaaaaba",
        "abaaaaaccaaaaaba",
        "abaaaadddaaaaaba",
        "abaaaddddd aaaba",
        "abaaadddddaaaaba",
        "abaaaadddaaaaaba",
        "abaaaaeeeaaaaaba",
        "abaaaaeeeaaaaaba",
        "abaaaeeeeeaaaaba",
        "abaaaaaaaaaaaaba",
        "abbbbbbbbbbbbbba",
        "aaaaaaaaaaaaaaaa",
    ],
    {
        "a": "#3d3226",
        "b": "#4c3f2f",
        "c": "#6d6152",
        "d": "#cfc3a6",
        "e": "#7a6a4c",
        " ": "#cfc3a6",
    },
)

NAME_PLAQUE = (
    [
        "aaaaaaaaaaaaaaaa",
        "abbbbbbbbbbbbbba",
        "abcccccccccccccba"[:16],
        "abc..........cba",
        "abc.dd.d.dd..cba",
        "abc.d.d.d.d..cba",
        "abc.dd.d.dd..cba",
        "abc..........cba",
        "abc.d.d.dd...cba",
        "abc.ddd.d.d..cba",
        "abc.d.d.dd...cba",
        "abc..........cba",
        "abccccccccccccba",
        "abbbbbbbbbbbbbba",
        "aeeeeeeeeeeeeeea",
        "aaaaaaaaaaaaaaaa",
    ],
    {
        "a": "#3a352c",
        "b": "#585144",
        "c": "#7d745f",
        "d": "#241f18",
        "e": "#4a4438",
        ".": "#9a9078",
    },
)

MIRROR = (
    [
        "aaaaaaaaaaaaaaaa",
        "abbbbbbbbbbbbbba",
        "abccccccccccccba",
        "abcddddddddddcba",
        "abcdeeeeeeeedcba",
        "abcdefffffeedcba",
        "abcdeffgffeedcba",
        "abcdeffffffedcba",
        "abcdeeffffeedcba",
        "abcdeeeffeeedcba",
        "abcdeeeeeeeedcba",
        "abcddddddddddcba",
        "abccccccccccccba",
        "abbbbbbbbbbbbbba",
        "ahhhhhhhhhhhhhha",
        "aaaaaaaaaaaaaaaa",
    ],
    {
        "a": "#241a10",
        "b": "#4a3520",
        "c": "#6b5432",
        "d": "#8d99a4",
        "e": "#78868f",
        "f": "#5f6d78",
        "g": "#98a6b0",
        "h": "#3a2a19",
    },
)

PORTRAIT_BASE = (
    [
        "aaaaaaaaaaaaaaaa",
        "abbbbbbbbbbbbbba",
        "abcccccccccccccba"[:16],
        "abc..dddddd..cba",
        "abc.dddeeddd.cba",
        "abc.ddeffedd.cba",
        "abc.ddefeedd.cba",
        "abc.dddeeddd.cba",
        "abc..gggggg..cba",
        "abc.gghhhhgg.cba",
        "abc.ghhhhhhg.cba",
        "abc.ghhhhhhg.cba",
        "abccccccccccccba",
        "abbbbbbbbbbbbbba",
        "aiiiiiiiiiiiiiia",
        "aaaaaaaaaaaaaaaa",
    ],
    {
        "a": "#241a10",
        "b": "#5a4126",
        "c": "#7a5a33",
        "d": "#c8ab8a",
        "e": "#8f7357",
        "f": "#3a2d22",
        "g": "#4a3a52",
        "h": "#33283a",
        "i": "#3a2a19",
        ".": "#1b1610",
    },
)

TOY_BASE = (
    [
        "aaaaaaaaaaaaaaaa",
        "abbbbbbbbbbbbbba",
        "abcccccccccccccba"[:16],
        "abccddddddddccba",
        "abcddeeeeeeddcba",
        "abcdeeffffeedcba",
        "abcdefggggfedcba",
        "abcdefghhgfedcba",
        "abcdefghhgfedcba",
        "abcdefggggfedcba",
        "abcdeeffffeedcba",
        "abcddeeeeeeddcba",
        "abccddddddddccba",
        "abcccccccccccccba"[:16],
        "abbbbbbbbbbbbbba",
        "aaaaaaaaaaaaaaaa",
    ],
    {
        "a": "#2a1d12",
        "b": "#6b4a2a",
        "c": "#c25f4a",
        "d": "#d4715a",
        "e": "#e08a6c",
        "f": "#f0a982",
        "g": "#fbc59c",
        "h": "#fff0d8",
        " ": "#c25f4a",
    },
)

CLOCK_FACE = (
    [
        "aaaaaaaaaaaaaaaa",
        "abbbbbbbbbbbbbba",
        "abccccccccccccba",
        "abcddddddddddcba",
        "abcddeeeeeeddcba",
        "abcdeefffffedcba",
        "abcdefgffgfedcba",
        "abcdefffgffedcba",
        "abcdeffgfffedcba",
        "abcdeefffffedcba",
        "abcddeeeeeeddcba",
        "abcdddhhhdddcdba",
        "abcddddhhddddcba",
        "abccccccccccccba",
        "abbbbbbbbbbbbbba",
        "aaaaaaaaaaaaaaaa",
    ],
    {
        "a": "#1d1409",
        "b": "#4a3419",
        "c": "#5f4522",
        "d": "#3a2a14",
        "e": "#8d7a4e",
        "f": "#d8c48d",
        "g": "#2b2213",
        "h": "#b99a4e",
    },
)

CLOCK_SIDE = (
    [
        "aaaaaaaaaaaaaaaa",
        "abbbbbbbbbbbbbba",
        "abcbcbcbcbcbcbba",
        "abbcbcbcbcbcbcba",
        "abcbcbcbcbcbcbba",
        "abbcbcbcbcbcbcba",
        "abcbcbcbcbcbcbba",
        "abbcbcbcbcbcbcba",
        "abcbcbcbcbcbcbba",
        "abbcbcbcbcbcbcba",
        "abcbcbcbcbcbcbba",
        "abbcbcbcbcbcbcba",
        "abcbcbcbcbcbcbba",
        "abbcbcbcbcbcbcba",
        "abbbbbbbbbbbbbba",
        "aaaaaaaaaaaaaaaa",
    ],
    {"a": "#1d1409", "b": "#42301a", "c": "#523a20"},
)

MAILBOX = (
    [
        "................",
        "................",
        "....aaaaaaaa....",
        "...abbbbbbbba...",
        "..abccccccccba..",
        "..abcddddddcba..",
        "..abcdeeeedcba..",
        "..abcdeffedcba..",
        "..abcdeffedcba..",
        "..abcdeeeedcba..",
        "..abcddddddcba..",
        "..abccccccccba..",
        "...abbbbbbbba...",
        "....aaaaaaaa....",
        ".....g....g.....",
        ".....g....g.....",
    ],
    {
        "a": "#2a1410",
        "b": "#7a2f28",
        "c": "#8d3a30",
        "d": "#5f2019",
        "e": "#3a120e",
        "f": "#c9b47a",
        "g": "#4a4038",
    },
)

THRESHOLD_BARRIER = (
    [
        "aaaabbbbbbbbaaaa",
        "aabbbccccccbbbaa",
        "abbcccddddcccbba",
        "abccddddddddccba",
        "bcddddeeeeddddcb",
        "bcddeeeeeeeeddcb",
        "bcdeeeeeeeeeedcb",
        "bcdeeeeeeeeeedcb",
        "bcdeeeeeeeeeedcb",
        "bcdeeeeeeeeeedcb",
        "bcddeeeeeeeeddcb",
        "bcddddeeeeddddcb",
        "abccddddddddccba",
        "abbcccddddcccbba",
        "aabbbccccccbbbaa",
        "aaaabbbbbbbbaaaa",
    ],
    {
        "a": "#0d0f1420",
        "b": "#14182240",
        "c": "#1a1f2a60",
        "d": "#20263480",
        "e": "#2a3142a0",
    },
)

KEY_PEDESTAL = (
    [
        "................",
        "....aaaaaaaa....",
        "...abbbbbbbba...",
        "...abccccccba...",
        "....abccccba....",
        ".....abccba.....",
        "......abba......",
        "......abba......",
        "......abba......",
        "......abba......",
        ".....abccba.....",
        "....abccccba....",
        "...abccccccba...",
        "..abbbbbbbbbba..",
        "..aaaaaaaaaaaa..",
        "................",
    ],
    {"a": "#5a5240", "b": "#9a9078", "c": "#ded6bc"},
)

STORY_PAGE = (
    [
        "................",
        "................",
        "...aaaaaaaaaa...",
        "..abbbbbbbbbba..",
        "..abcccccccccba.",
        "..abc.cc.cc.cba.",
        "..abcccccccccba.",
        "..abc.c.cc..cba.",
        "..abcccccccccba.",
        "..abc.cc.c.ccba.",
        "..abcccccccccba.",
        "..abc..cc.c.cba.",
        "..abbbbbbbbbba..",
        "...aaaaaaaaaa...",
        "................",
        "................",
    ],
    {
        "a": "#8d7f5c",
        "b": "#d8ceac",
        "c": "#efe7cb",
        ".": "#00000000",
        "c": "#efe7cb",
    },
)

# ---------------------------------------------------------------------------
# 16x16 item textures
# ---------------------------------------------------------------------------

TALLOW_CANDLE = (
    [
        "................",
        ".......aa.......",
        "......abba......",
        "......abba......",
        ".......cc.......",
        "......dddd......",
        "......deed......",
        "......deed......",
        "......deed......",
        "......deed......",
        "......deed......",
        ".....ffffff.....",
        ".....fgggggf....",
        ".....ffffff.....",
        "................",
        "................",
    ],
    {
        "a": "#ffd88a",
        "b": "#ff9a3c",
        "c": "#5a4a2a",
        "d": "#cfc3a6",
        "e": "#e8dfc4",
        "f": "#7a6a4c",
        "g": "#5f5238",
    },
)

TALLOW = (
    [
        "................",
        "................",
        "....aaaaaaa.....",
        "...abbbbbbba....",
        "..abbcccccbba...",
        "..abccddddcba...",
        "..abcddddddcba..",
        "..abcddddddcba..",
        "..abcddddddcba..",
        "..abccddddcbba..",
        "...abbccccbba...",
        "...abbbbbbba....",
        "....aaaaaaa.....",
        "................",
        "................",
        "................",
    ],
    {"a": "#6b5f3f", "b": "#a99a6d", "c": "#d8cba0", "d": "#efe6c6"},
)

CRACKED_MONOCLE = (
    [
        "................",
        "................",
        "....aaaaaa......",
        "...abbbbbba.....",
        "..abccccccba....",
        "..abcddddcba....",
        "..abcd.ddcba....",
        "..abcdd.dcba....",
        "..abcddd.cba....",
        "..abccccccba....",
        "...abbbbbba.....",
        "....aaaaaa.a....",
        "..............a.",
        "...............a",
        "................",
        "................",
    ],
    {
        "a": "#8d7a3c",
        "b": "#c9b060",
        "c": "#6f7d86",
        "d": "#9cb0bd",
        ".": "#00000000",
    },
)

BONE_CAMERA = (
    [
        "................",
        "................",
        "......aaaa......",
        "....aaabbaaa....",
        "...abbbbbbbba...",
        "...abcccccccba..",
        "...abcddddccba..",
        "...abcdeedccba..",
        "...abcdeedccba..",
        "...abcddddccba..",
        "...abcccccccba..",
        "...abbbbbbbba...",
        "....aaaaaaaa....",
        "................",
        "................",
        "................",
    ],
    {
        "a": "#5f5a4a",
        "b": "#ded6bc",
        "c": "#9a9078",
        "d": "#2a2f36",
        "e": "#7fa0b5",
    },
)

SEANCE_BELL = (
    [
        "................",
        ".......aa.......",
        "......abba......",
        ".....abbbba.....",
        "....abbccbba....",
        "....abccccba....",
        "...abccccccba...",
        "...abccccccba...",
        "..abccccccccba..",
        "..abccccccccba..",
        "..aaaaaaaaaaaa..",
        "....a......a....",
        "......addda.....",
        "......addda.....",
        ".......aaa......",
        "................",
    ],
    {
        "a": "#6b5a2a",
        "b": "#b99a4e",
        "c": "#d8c48d",
        "d": "#8d7a4e",
        "c": "#d8c48d",
    },
)

SALT_POUCH = (
    [
        "................",
        "................",
        ".......aa.......",
        "......abba......",
        ".....acccca.....",
        "....addddda.....",
        "...adddeedda....",
        "...addeeeedda...",
        "..addeeeeeedda..",
        "..addeeeeeedda..",
        "..adddeeeeddda..",
        "...adddddddda...",
        "....aaaaaaaa....",
        "................",
        "................",
        "................",
    ],
    {
        "a": "#5f4a2a",
        "b": "#8d6f3c",
        "c": "#a98a4e",
        "d": "#cfc3a6",
        "e": "#efece0",
    },
)

BONE_KEY = (
    [
        "................",
        "....aaaa........",
        "...abbbba.......",
        "..abbccbba......",
        "..abc..cba......",
        "..abc..cba......",
        "..abbccbba......",
        "...abbbba.......",
        "....abbba.......",
        ".....abbba......",
        "......abbbaa....",
        ".......abbbba...",
        "........abaaba..",
        ".........a..aba.",
        "..........a..a..",
        "................",
    ],
    {
        "a": "#7a725c",
        "b": "#ded6bc",
        "c": "#4a4438",
        ".": "#00000000",
    },
)

MANOR_JOURNAL = (
    [
        "................",
        "..aaaaaaaaaaa...",
        "..abbbbbbbbba...",
        "..abcccccccba...",
        "..abc.....cba...",
        "..abc.ddd.cba...",
        "..abc.d.d.cba...",
        "..abc.ddd.cba...",
        "..abc.....cba...",
        "..abc.d.d.cba...",
        "..abc.ddd.cba...",
        "..abcccccccba...",
        "..abbbbbbbbba...",
        "..aaaaaaaaaaa...",
        "................",
        "................",
    ],
    {
        "a": "#3a2418",
        "b": "#5f3a20",
        "c": "#d8ceac",
        "d": "#4a4438",
        ".": "#efe7cb",
    },
)

# ---------------------------------------------------------------------------
# Particle atlas: four 8x8 cells - dot, flame, speck, spark
# ---------------------------------------------------------------------------


def particle_atlas():
    img = Image.new("RGBA", (16, 16), T)
    px = img.load()

    def blob(ox, oy, colour, falloff):
        for y in range(8):
            for x in range(8):
                dx = x - 3.5
                dy = y - 3.5
                d = (dx * dx + dy * dy) ** 0.5
                a = max(0.0, 1.0 - d / falloff)
                if a <= 0:
                    continue
                r, g, b, _ = colour
                px[ox + x, oy + y] = (r, g, b, int(255 * a))

    blob(0, 0, (220, 220, 220, 255), 4.0)  # soft dot
    blob(8, 0, (255, 190, 110, 255), 3.4)  # flame
    blob(0, 8, (245, 242, 230, 255), 3.0)  # salt speck
    blob(8, 8, (200, 220, 235, 255), 2.4)  # spark
    return img


# ---------------------------------------------------------------------------
# 64x64 entity textures, laid out for geometry.ag_humanoid / ag_watcher
# ---------------------------------------------------------------------------

# UV rectangles that actually get sampled by the two geometries.
ENTITY_REGIONS = {
    "head": (0, 0, 32, 16),
    "hat": (32, 0, 64, 16),
    "body": (16, 16, 40, 32),
    "arm": (40, 16, 56, 32),
    "leg": (0, 16, 16, 32),
}


def entity_texture(base, shade, accent, eye, ghostly=False, hat_alpha=0):
    img = Image.new("RGBA", (64, 64), T)
    px = img.load()

    def fill(rect, colour, noise=14):
        x0, y0, x1, y1 = rect
        for y in range(y0, y1):
            for x in range(x0, x1):
                n = random.randint(-noise, noise)
                r = max(0, min(255, colour[0] + n))
                g = max(0, min(255, colour[1] + n))
                b = max(0, min(255, colour[2] + n))
                a = 255
                if ghostly and ((x + y) % 3 == 0):
                    a = 0  # dithered alpha reads as translucent under alpha_test
                px[x, y] = (r, g, b, a)

    fill(ENTITY_REGIONS["head"], base)
    fill(ENTITY_REGIONS["body"], shade)
    fill(ENTITY_REGIONS["arm"], shade)
    fill(ENTITY_REGIONS["leg"], accent)

    if hat_alpha > 0:
        x0, y0, x1, y1 = ENTITY_REGIONS["hat"]
        for y in range(y0, y1):
            for x in range(x0, x1):
                px[x, y] = (accent[0], accent[1], accent[2], hat_alpha)

    # Face sits in the front head cell: u 8-16, v 8-16.
    for x in range(9, 12):
        px[x, 11] = eye
        px[x, 12] = eye
    for x in range(13, 16):
        px[x, 11] = eye
        px[x, 12] = eye
    for x in range(11, 14):
        px[x, 14] = (10, 8, 8, 255)

    return img


ENTITIES = {
    "ag_nanny": dict(
        base=(196, 178, 158), shade=(44, 40, 46), accent=(28, 26, 30),
        eye=(232, 226, 210, 255), ghostly=False, hat_alpha=190
    ),
    "ag_bride": dict(
        base=(214, 208, 198), shade=(226, 222, 214), accent=(198, 192, 182),
        eye=(20, 18, 20, 255), ghostly=False, hat_alpha=150
    ),
    "ag_child": dict(
        base=(188, 176, 162), shade=(96, 88, 96), accent=(60, 54, 60),
        eye=(240, 236, 220, 255), ghostly=False, hat_alpha=0
    ),
    "ag_wraith": dict(
        base=(112, 138, 140), shade=(62, 84, 90), accent=(40, 58, 64),
        eye=(198, 232, 236, 255), ghostly=True, hat_alpha=0
    ),
    "ag_reflection": dict(
        base=(158, 170, 180), shade=(104, 118, 130), accent=(70, 82, 94),
        eye=(226, 240, 248, 255), ghostly=True, hat_alpha=0
    ),
    "ag_ghost": dict(
        base=(176, 190, 196), shade=(126, 142, 150), accent=(92, 108, 116),
        eye=(240, 248, 250, 255), ghostly=True, hat_alpha=0
    ),
    "ag_hallucination": dict(
        base=(60, 58, 62), shade=(40, 38, 42), accent=(26, 24, 28),
        eye=(190, 60, 60, 255), ghostly=True, hat_alpha=0
    ),
    "ag_watcher": dict(
        base=(34, 32, 36), shade=(22, 20, 24), accent=(14, 13, 16),
        eye=(228, 220, 190, 255), ghostly=False, hat_alpha=0
    ),
}


# ---------------------------------------------------------------------------
# Pack icons
# ---------------------------------------------------------------------------


def pack_icon():
    img = Image.new("RGBA", (128, 128), (10, 11, 14, 255))
    px = img.load()
    for y in range(128):
        for x in range(128):
            dx = x - 64
            dy = y - 74
            d = (dx * dx + dy * dy) ** 0.5
            glow = max(0.0, 1.0 - d / 70.0)
            r = int(10 + 40 * glow)
            g = int(11 + 30 * glow)
            b = int(14 + 22 * glow)
            px[x, y] = (r, g, b, 255)
    # A veil silhouette.
    for y in range(28, 118):
        half = int(6 + (y - 28) * 0.34)
        for x in range(64 - half, 64 + half):
            px[x, y] = (206, 202, 194, 255)
    # A single flame.
    for y in range(96, 112):
        w = max(1, (112 - y) // 3)
        for x in range(64 - w, 64 + w):
            px[x, y] = (255, 170, 80, 255)
    return img


# ---------------------------------------------------------------------------


def derive_portrait(index):
    rows, palette = PORTRAIT_BASE
    pal = dict(palette)
    skins = ["#c8ab8a", "#d8bb98", "#b89a78", "#e0c5a6", "#a88a6c"]
    coats = ["#4a3a52", "#3a4a52", "#52463a", "#3a523f", "#523a41"]
    pal["d"] = skins[index % len(skins)]
    pal["g"] = coats[index % len(coats)]
    pal["h"] = coats[(index + 2) % len(coats)]
    return grid(rows, pal)


def derive_portrait_wrong():
    rows, palette = PORTRAIT_BASE
    pal = dict(palette)
    pal["d"] = "#8d7a6a"
    pal["e"] = "#4a3a30"
    pal["f"] = "#c03a30"
    pal["g"] = "#20202a"
    pal["h"] = "#12121a"
    img = grid(rows, pal)
    px = img.load()
    # Smear the eyes downward: the wrong-er version.
    for x in range(5, 11):
        for y in range(6, 10):
            px[x, y] = hexrgba("#20161a")
    return img


def derive_toy(index):
    rows, palette = TOY_BASE
    pal = dict(palette)
    faces = [
        ("#c25f4a", "#d4715a", "#e08a6c", "#f0a982", "#fbc59c"),
        ("#4a7ac2", "#5a8ad4", "#6c9ce0", "#82b0f0", "#9cc8fb"),
        ("#4ac274", "#5ad486", "#6ce098", "#82f0ac", "#9cfbc4"),
        ("#c2b04a", "#d4c25a", "#e0d06c", "#f0e082", "#fbf09c"),
        ("#9a4ac2", "#aa5ad4", "#bc6ce0", "#d082f0", "#e49cfb"),
    ]
    c, d, e, f, g = faces[index % len(faces)]
    pal["c"] = c
    pal[" "] = c
    pal["d"] = d
    pal["e"] = e
    pal["f"] = f
    pal["g"] = g
    return grid(rows, pal)


def derive_wall_candle_lit():
    rows, palette = WALL_CANDLE_UNLIT
    pal = dict(palette)
    pal["a"] = "#5a4a34"
    pal["b"] = "#6d5a40"
    img = grid(rows, pal)
    px = img.load()
    flame = ["#ffe6a8", "#ffc46b", "#ff9a3c", "#e0662a"]
    px[7, 2] = hexrgba(flame[0])
    px[8, 2] = hexrgba(flame[0])
    px[7, 1] = hexrgba(flame[1])
    px[8, 1] = hexrgba(flame[1])
    px[7, 3] = hexrgba(flame[2])
    px[8, 3] = hexrgba(flame[2])
    px[6, 3] = hexrgba(flame[3])
    px[9, 3] = hexrgba(flame[3])
    return img


def derive_mirror_broken():
    rows, palette = MIRROR
    pal = dict(palette)
    pal["d"] = "#4a5560"
    pal["e"] = "#3a444e"
    pal["f"] = "#2a323a"
    pal["g"] = "#5a6670"
    img = grid(rows, pal)
    px = img.load()
    crack = hexrgba("#0d1014")
    for i in range(3, 13):
        px[i, i] = crack
        px[15 - i, i] = crack
    for i in range(5, 11):
        px[i, 8] = crack
    return img


def derive_manor_key():
    """The Manor Key: the bone key struck in brass, so it reads as special."""
    rows, palette = BONE_KEY
    pal = dict(palette)
    pal["a"] = "#6b5220"
    pal["b"] = "#e8c96a"
    pal["c"] = "#3a2c10"
    return grid(rows, pal)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=".", help="directory containing RP/ and BP/")
    args = ap.parse_args()
    root = args.out

    rp_blocks = os.path.join(root, "RP", "textures", "blocks")
    rp_items = os.path.join(root, "RP", "textures", "items")
    rp_entity = os.path.join(root, "RP", "textures", "entity")
    rp_particle = os.path.join(root, "RP", "textures", "particle")

    blocks = {
        "ag_salt_line": grid(*SALT_LINE),
        "ag_wardrobe_front": grid(*WARDROBE_FRONT),
        "ag_wardrobe_side": grid(*WARDROBE_SIDE),
        "ag_wardrobe_top": grid(*WARDROBE_TOP),
        "ag_under_bed": grid(*UNDER_BED),
        "ag_wall_candle_unlit": grid(*WALL_CANDLE_UNLIT),
        "ag_wall_candle_lit": derive_wall_candle_lit(),
        "ag_name_plaque": grid(*NAME_PLAQUE),
        "ag_mirror": grid(*MIRROR),
        "ag_mirror_broken": derive_mirror_broken(),
        "ag_portrait_wrong": derive_portrait_wrong(),
        "ag_clock_face": grid(*CLOCK_FACE),
        "ag_clock_side": grid(*CLOCK_SIDE),
        "ag_mailbox": grid(*MAILBOX),
        "ag_threshold_barrier": grid(*THRESHOLD_BARRIER),
        "ag_key_pedestal": grid(*KEY_PEDESTAL),
        "ag_story_page": grid(*STORY_PAGE),
    }
    for i in range(5):
        blocks["ag_portrait_%d" % i] = derive_portrait(i)
        blocks["ag_toy_%d" % i] = derive_toy(i)

    items = {
        "ag_tallow_candle": grid(*TALLOW_CANDLE),
        "ag_tallow": grid(*TALLOW),
        "ag_cracked_monocle": grid(*CRACKED_MONOCLE),
        "ag_bone_camera": grid(*BONE_CAMERA),
        "ag_seance_bell": grid(*SEANCE_BELL),
        "ag_salt_pouch": grid(*SALT_POUCH),
        "ag_bone_key": grid(*BONE_KEY),
        "ag_manor_journal": grid(*MANOR_JOURNAL),
        "ag_manor_key": derive_manor_key(),
    }

    for name, img in blocks.items():
        save(img, os.path.join(rp_blocks, name + ".png"))
    for name, img in items.items():
        save(img, os.path.join(rp_items, name + ".png"))
    for name, spec in ENTITIES.items():
        save(entity_texture(**spec), os.path.join(rp_entity, name + ".png"))
    save(particle_atlas(), os.path.join(rp_particle, "ag_particle.png"))

    icon = pack_icon()
    save(icon, os.path.join(root, "RP", "pack_icon.png"))
    save(icon, os.path.join(root, "BP", "pack_icon.png"))
    print("done")


if __name__ == "__main__":
    main()
