#!/usr/bin/env python3
"""Natural Disaster Simulator - icon generator (deterministic).

Draws the 15 item icons (16x16 RGBA) as character-grid pixel art with explicit
per-icon palettes, plus the two 256x256 pack icons (BP / RP), and writes them
into the resource / behavior packs.

    python3 natural-disasters/tools/gen_icons.py                 # regenerate every PNG
    python3 natural-disasters/tools/gen_icons.py --sheets DIR    # also write review sheets
    python3 natural-disasters/tools/gen_icons.py --check         # generate + run self checks

Rules followed by every item icon: exactly 16x16, mode RGBA, hard-edged pixels
(alpha is 0 or 255), 1-px dark outline, <= 8 opaque colours per sprite.
'.' is always the fully transparent pixel (0,0,0,0).
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ADDON = os.path.dirname(HERE)
RP = os.path.join(ADDON, "NaturalDisasters_RP")
BP = os.path.join(ADDON, "NaturalDisasters_BP")
ITEM_DIR = os.path.join(RP, "textures", "items")

SIZE = 16

# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def hexcol(s):
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


def check_grid(name, rows):
    ok = True
    if len(rows) != SIZE:
        print("GRID ERROR %s: %d rows (need %d)" % (name, len(rows), SIZE))
        ok = False
    for i, r in enumerate(rows):
        if len(r) != SIZE:
            print("GRID ERROR %s row %d: %d chars (need %d): %r" % (name, i, len(r), SIZE, r))
            ok = False
    return ok


def grid_to_image(name, palette, rows):
    if not check_grid(name, rows):
        raise SystemExit(1)
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            if ch not in palette:
                raise SystemExit("icon %s: char %r at (%d,%d) not in palette" % (name, ch, x, y))
            px[x, y] = palette[ch]
    return img


# 3x5 pixel font (only what the icons need)
FONT_3X5 = {
    "4": ["X.X", "X.X", "XXX", "..X", "..X"],
    "5": ["XXX", "X..", "XXX", "..X", "XXX"],
    "6": ["XXX", "X..", "XXX", "X.X", "XXX"],
    "9": ["XXX", "X.X", "XXX", "..X", "XXX"],
}


def stamp(rows, digit, x0, y0, ch):
    """Return rows with the 3x5 digit stamped at (x0, y0) using palette char ch."""
    g = [list(r) for r in rows]
    for dy, line in enumerate(FONT_3X5[digit]):
        for dx, c in enumerate(line):
            if c == "X":
                g[y0 + dy][x0 + dx] = ch
    return ["".join(r) for r in g]


def plot_line(rows, ys, x0, ch):
    """Draw a connected zig-zag polyline: ys[i] is the row at column x0+i.
    Consecutive columns are joined vertically so the line has no gaps."""
    g = [list(r) for r in rows]
    prev = None
    for i, y in enumerate(ys):
        x = x0 + i
        if prev is None:
            g[y][x] = ch
        else:
            lo, hi = (prev, y) if prev <= y else (y, prev)
            # first half of the vertical run belongs to the previous column,
            # second half to this one (keeps the zig-zag slim and readable)
            mid = (lo + hi) // 2
            if y >= prev:
                for yy in range(prev, mid + 1):
                    g[yy][x - 1] = ch
                for yy in range(mid + 1 if hi > lo else mid, y + 1):
                    g[yy][x] = ch
            else:
                for yy in range(mid, prev + 1):
                    g[yy][x - 1] = ch
                for yy in range(y, mid):
                    g[yy][x] = ch
            g[y][x] = ch
        prev = y
    return ["".join(r) for r in g]


# --------------------------------------------------------------------------
# item icons: (palette, grid)
# --------------------------------------------------------------------------

ICONS = {}

# 1. Spawn Tornado - grey funnel under a dark cloud, a little debris at the tip
ICONS["nd_spawn_tornado"] = (
    {
        "K": hexcol("1a1a24"),
        "D": hexcol("484c5e"),
        "M": hexcol("686e82"),
        "G": hexcol("929aa8"),
        "L": hexcol("c4cad6"),
        "W": hexcol("eef2f8"),
        "B": hexcol("805832"),
    },
    [
        "................",
        "..KKKKKKKKKKKK..",
        ".KDDDMMDDDDDDDK.",
        "KDDMMMDDDMMDDDDK",
        "KDDDDDDDDDDDDDDK",
        ".KKKKGLLLLGKKKK.",
        "...KGLLWLLLGK...",
        "...KGGLLLLGGK...",
        "....KGLLWLGK....",
        "....KGGLLLGK....",
        ".....KGLLGGK....",
        ".....KGGLGK.....",
        "......KGLGK.....",
        "....B.KGGK.B....",
        "..B..BKGK..B....",
        ".B....KKK...B..B",
    ],
)

# 2. Spawn EF5 Tornado - near-black cloud, dark funnel, red lightning, red "5"
ICONS["nd_spawn_ef5_tornado"] = (
    {
        "K": hexcol("100c14"),
        "D": hexcol("2a2836"),
        "M": hexcol("444258"),
        "G": hexcol("5c5e70"),
        "L": hexcol("858898"),
        "R": hexcol("f02828"),
        "H": hexcol("ff8a70"),
    },
    [
        "................",
        "..KKKKKKKKKKKK..",
        ".KDDDMMDDDDDDDK.",
        "KDDMMMDDDDMMDDDK",
        "KDDDDDDDDDDDRRDK",
        ".KKKGLLLGKKKRRK.",
        "...KGLLLLGKRRK..",
        "...KGGLLGGKRRK..",
        "....KGLLLGRRK...",
        "....KGGLGKRRK...",
        ".....KGLGGRHK...",
        ".....KGGGKKRRRK.",
        "......KGLGK.R...",
        ".......KGK..RRR.",
        ".......KGK....R.",
        "........K...RRR.",
    ],
)

# 3. Spawn Tsunami - blue wave with a curling white foam crest
ICONS["nd_spawn_tsunami"] = (
    {
        "K": hexcol("0a1a44"),
        "D": hexcol("163c86"),
        "B": hexcol("2468be"),
        "M": hexcol("4298e4"),
        "L": hexcol("86d0f6"),
        "W": hexcol("f4faff"),
    },
    [
        "................",
        ".......KKKKK....",
        ".....KKWWWWWKK..",
        "....KWWLLLLWWWK.",
        "...KWLLMMMMLLWWK",
        "..KWLMMBBBBMLKWK",
        "..KLMMBBDDBBMKKK",
        ".KLMBBBDDDDBBK..",
        ".KMMBBBDDDDDDK..",
        "KMMBBBBDDDDDBK..",
        "KMBBBBBBDDBBBKKK",
        "KMBBDBBBBBBBBBBK",
        "KBBBBBMBBBMBBBBK",
        "KWBBMBBBBBBBMBWK",
        "KDBBBBWBBBWBBBDK",
        "KKKKKKKKKKKKKKKK",
    ],
)

# 4. Spawn Volcano - dark cone, orange lava, grey smoke plume
ICONS["nd_spawn_volcano"] = (
    {
        "K": hexcol("181214"),
        "R": hexcol("60483e"),
        "S": hexcol("3c2e2e"),
        "O": hexcol("f88418"),
        "Y": hexcol("ffd648"),
        "G": hexcol("a8a8b2"),
        "g": hexcol("6c6c7a"),
    },
    [
        "....gggg........",
        "...gGGGGgg..g...",
        "..gGGGGGGGggGg..",
        "...gGGGGGGGGg...",
        "....ggGGGGgg....",
        ".....KOYYOK.....",
        "....KROYYORK....",
        "....KRROOSRK....",
        "...KRRSROOSSK...",
        "...KRSRRROOSK...",
        "..KRRRSRRROOSK..",
        "..KSRRRRSROOOK..",
        ".KRRSRRRRSRROOK.",
        ".KRRRRSRRRSRRRK.",
        "KRSRRRRRSRRRSRRK",
        "KKKKKKKKKKKKKKKK",
    ],
)

# 5-7. Earthquakes: dark seismograph panel (digit + zig-zag) over cracked ground.
QUAKE_PAL = {
    "K": hexcol("1a1214"),
    "P": hexcol("2a3040"),
    "W": hexcol("f4f4f4"),
    "R": hexcol("f03030"),
    "A": hexcol("b47c48"),
    "B": hexcol("8c5c34"),
    "C": hexcol("60401f"),
}

_QUAKE_BASE_TOP = [
    "KKKKKKKKKKKKKKKK",
    "KPPPPPPPPPPPPPPK",
    "KPPPPPPPPPPPPPPK",
    "KPPPPPPPPPPPPPPK",
    "KPPPPPPPPPPPPPPK",
    "KPPPPPPPPPPPPPPK",
    "KPPPPPPPPPPPPPPK",
    "KPPPPPPPPPPPPPPK",
]

_QUAKE_GROUND = {
    # small: a single thin hairline crack
    "m4": [
        "KAAAABAAAAAAAAAK",
        "KAABAAKAAAAABAAK",
        "KBAAAAAKAAAAAAAK",
        "KAAAABAKKAAABAAK",
        "KAAAAAAAKBAAAAAK",
        "KAABAAAAAKAAAAAK",
        "KKKKKKKKKKKKKKKK",
        "KKKKKKKKKKKKKKKK",
    ],
    # medium: two cracks, one branching, shifted slabs
    "m6": [
        "KAAAAKAAAAAKAAAK",
        "KAABAKBAAAAKAAAK",
        "KBAAAKKAAAAKKBAK",
        "KAAABAKCKAAAKAAK",
        "KAAAAAKCKKAAKBAK",
        "KAABAAKKCKAKAAAK",
        "KKKKKKKKKKKKKKKK",
        "KKKKKKKKKKKKKKKK",
    ],
    # violent: wide chasm, many branches, slabs lifted
    "m9": [
        "KAAKCCKAAAKCCKAK",
        "KBAKCCCKAKCCKBAK",
        "KAKCCCCKKCCCKAAK",
        "KKCCCKCCCCCKKBAK",
        "KCCCKAKCCCKAKCCK",
        "KCKKABAKCKAABKCK",
        "KKKKKKKKKKKKKKKK",
        "KKKKKKKKKKKKKKKK",
    ],
}

_QUAKE_WAVE = {
    "m4": [3, 3, 3, 2, 4, 3, 4, 3, 4],
    "m6": [3, 2, 5, 1, 6, 2, 5, 3, 4],
    "m9": [4, 1, 7, 1, 7, 1, 7, 2, 4],
}
_QUAKE_DIGIT = {"m4": "4", "m6": "6", "m9": "9"}


def _quake(level):
    rows = _QUAKE_BASE_TOP + _QUAKE_GROUND[level]
    rows = stamp(rows, _QUAKE_DIGIT[level], 2, 2, "R")
    rows = plot_line(rows, _QUAKE_WAVE[level], 6, "W")
    return (QUAKE_PAL, rows)


ICONS["nd_earthquake_m4"] = _quake("m4")
ICONS["nd_earthquake_m6"] = _quake("m6")
ICONS["nd_earthquake_m9"] = _quake("m9")

# 8. Meteor Strike - fireball falling to the lower-left with a smoke/flame tail
ICONS["nd_meteor_strike"] = (
    {
        "K": hexcol("1c1412"),
        "T": hexcol("3a3036"),
        "Q": hexcol("6a5a58"),
        "R": hexcol("d0341c"),
        "O": hexcol("f88418"),
        "Y": hexcol("ffd648"),
        "S": hexcol("78747c"),
    },
    [
        "..........SS..SS",
        "..........SSSSSS",
        "..........KSSSSK",
        "......KKKKRRSSK.",
        "....KKROOORRK...",
        "...KROOYYOORK...",
        "..KROOYYYYOORK..",
        "..KOYYTTQYYOK...",
        ".KROYTTTQQYORK..",
        ".KROYTTTTQYORK..",
        ".KROYYTTQYYORK..",
        ".KROOYYYYYOORK..",
        "..KRROOYYOORK...",
        "...KRRROORRK....",
        "....KKKRRKK.....",
        "......KKKK......",
    ],
)

# 9. Supercell - big dark storm cloud with a yellow lightning bolt
ICONS["nd_supercell"] = (
    {
        "K": hexcol("161822"),
        "D": hexcol("3a3e54"),
        "M": hexcol("5c6280"),
        "L": hexcol("8890b0"),
        "Y": hexcol("ffd820"),
        "W": hexcol("fff8b8"),
        "O": hexcol("e88a10"),
    },
    [
        "................",
        "....KKKKKK......",
        "..KKLLMMMKKKK...",
        ".KLLMMDDMMLMMKK.",
        "KLMMDDDDDDMMMMDK",
        "KMDDDDDDDDDDDDDK",
        "KDDDDDDKKYYKDDDK",
        ".KKDDKKKYWYKKDK.",
        "..KKKKKYWYYK.KK.",
        ".....KKYWYKK....",
        "......KYYWYK....",
        "......KKYYYK....",
        ".......KKYK.....",
        "........KYK.....",
        ".........KK.....",
        "................",
    ],
)

# 10. Hurricane - white spiral bands around a clear eye, seen from above over the sea
ICONS["nd_hurricane"] = (
    {
        "K": hexcol("0c1a48"),
        "D": hexcol("1a3c8c"),
        "B": hexcol("2c68c0"),
        "L": hexcol("aacbec"),
        "W": hexcol("f6faff"),
        "E": hexcol("102a66"),
    },
    [
        ".....KKKKKK.....",
        "...KKBBBBBBKK...",
        "..KBBWWWWWLBBK..",
        ".KBWWLLLLLWWBBK.",
        ".KBWLBBBBBBLWBK.",
        "KBWLBBDDDDBBLWBK",
        "KBWLBDDEEDDBBWBK",
        "KBWBBDEEEEDDBWBK",
        "KBBWBDEEEEDDBWBK",
        "KBBWBBDDDDBBLWBK",
        "KBBLWBBBBBBLWBBK",
        ".KBBLWWLLLWWBBK.",
        ".KBBBLLWWWLBBBK.",
        "..KBBBBBBBBBBK..",
        "...KKBBBBBBKK...",
        ".....KKKKKK.....",
    ],
)

# 11. Wildfire - three flame tongues on a charred black ground
ICONS["nd_wildfire"] = (
    {
        "K": hexcol("100c0c"),
        "C": hexcol("2c2626"),
        "R": hexcol("c82814"),
        "O": hexcol("f87818"),
        "Y": hexcol("ffcc30"),
        "W": hexcol("fff0a0"),
    },
    [
        ".......K........",
        "......KRK...K...",
        "..K...KORK.KRK..",
        ".KRK..KOOK.KORK.",
        ".KORK.KROYKKOOK.",
        ".KOOKKKROYRKOYK.",
        "KKOYOKROOYORKOYK",
        "KROYYOOOYYYOROYK",
        "KROYYYOYYWYOOYRK",
        "KROOYYYYWWYYOORK",
        ".KROOYYYWWYYORK.",
        ".KKROOYYYYOORKK.",
        "KCKKKRROOORRKKCK",
        "KCCCCKKKKKKCCCCK",
        "KCKCCCCCCCCCCKCK",
        "KKKKKKKKKKKKKKKK",
    ],
)

# 12. Blizzard - white snowflake on icy blue with wind streaks
ICONS["nd_blizzard"] = (
    {
        "K": hexcol("143266"),
        "D": hexcol("4a8cd0"),
        "B": hexcol("78b8ec"),
        "b": hexcol("a4d4f6"),
        "L": hexcol("d4ecff"),
        "W": hexcol("ffffff"),
    },
    [
        "KKKKKKKKKKKKKKKK",
        "KBBBBBBWBBBBBBBK",
        "KBbBBBBWBBBbBBBK",
        "KBBBWBBWBBWBBBBK",
        "KBBBBWBWBWBBBBBK",
        "KBBBBBWWWBBBBbBK",
        "KBWBBBBWBBBBBBBK",
        "KBWWWWWWWWWWWWBK",
        "KBBBBBBWBBBBWBBK",
        "KBBBBBWWWBBBBBBK",
        "KBBBBWBWBWBBBBBK",
        "KBBBWBBWBBWBBBBK",
        "KBbBBBBWBBBBBbBK",
        "KBBBBBBWBBBBBBBK",
        "KDDDDDDDDDDDDDDK",
        "KKKKKKKKKKKKKKKK",
    ],
)

# 13. Sinkhole - dark hole in green/brown ground with a crumbling edge
ICONS["nd_sinkhole"] = (
    {
        "K": hexcol("14100e"),
        "G": hexcol("5ea83c"),
        "g": hexcol("3c7a2c"),
        "D": hexcol("946438"),
        "d": hexcol("684626"),
        "H": hexcol("0a080c"),
        "h": hexcol("342c3c"),
    },
    [
        "KKKKKKKKKKKKKKKK",
        "KGGgGGGGGGGgGGGK",
        "KGGGGGKKKKGGGgGK",
        "KGgGKKDDDDKKGGGK",
        "KGGKKDDhhDDDKGgK",
        "KGKDDhhHHhhDDKGK",
        "KGKDhHHHHHHhDdKK",
        "KKDDhHHHHHHHhDKK",
        "KKdDhHHHHHHhhDKK",
        "KGKddhHHHHhhdDKK",
        "KGgKdDhhHhhDDKGK",
        "KGGKKDDdDDDKKGGK",
        "KGGGgKKDdDKKGGGK",
        "KGGGGGGKKKGGGgGK",
        "KGgGGGGGGGGGGGGK",
        "KKKKKKKKKKKKKKKK",
    ],
)

# 14. STOP ALL DISASTERS - red octagon, white hand
ICONS["nd_stop_all_disasters"] = (
    {
        "K": hexcol("2a0808"),
        "D": hexcol("9c1414"),
        "R": hexcol("e42424"),
        "H": hexcol("ff6a5a"),
        "W": hexcol("ffffff"),
        "S": hexcol("c8ccd4"),
    },
    [
        "....KKKKKKKK....",
        "...KHRRRRRRRK...",
        "..KHRRRRRRRRRK..",
        ".KHRRWRWRWRRRRK.",
        "KHRRRWSWSWSRRRRK",
        "KRRRWSWSWSWSRRRK",
        "KRRRWSWSWSWSRRRK",
        "KRRWWSWSWSWSWRRK",
        "KRRSWSWWWWWSWRRK",
        "KRRRWSWWWWWSRRRK",
        "KRRRRWSWWWWSRRDK",
        ".KRRRRWSWWSRRDK.",
        "..KRRRRWWWRRDK..",
        "...KRRRRRRRDK...",
        "....KDDDDDDK....",
        ".....KKKKKK.....",
    ],
)

# 15. Disaster Controller - brown/grey control panel: two dials, LEDs, a lever
ICONS["nd_disaster_controller"] = (
    {
        "K": hexcol("16110e"),
        "B": hexcol("845a30"),
        "b": hexcol("5a3c20"),
        "G": hexcol("9ca0a8"),
        "g": hexcol("646a74"),
        "L": hexcol("d2d6dc"),
        "R": hexcol("e03428"),
        "N": hexcol("5cd450"),
    },
    [
        "................",
        "KKKKKKKKKKKKKKKK",
        "KBBBBBBBBBBBBBbK",
        "KBGGGGGGGGGGGGgK",
        "KBGLLLGGGGLLLGgK",
        "KBGLgLLGGLgLLLgK",
        "KBGLLgLGGLLLgLgK",
        "KBGGLLLGGGLLLGgK",
        "KBGGGGGGGGGGGGgK",
        "KBGRGNGGgggggGgK",
        "KBGGGGGGgKKKgGgK",
        "KBGGGGGGgLKKgGgK",
        "KBGGGGGGgKKKgGgK",
        "KBGGGGGGGGGGGGgK",
        "KbbbbbbbbbbbbbbK",
        "KKKKKKKKKKKKKKKK",
    ],
)

ICON_ORDER = [
    "nd_spawn_tornado",
    "nd_spawn_ef5_tornado",
    "nd_spawn_tsunami",
    "nd_spawn_volcano",
    "nd_earthquake_m4",
    "nd_earthquake_m6",
    "nd_earthquake_m9",
    "nd_meteor_strike",
    "nd_supercell",
    "nd_hurricane",
    "nd_wildfire",
    "nd_blizzard",
    "nd_sinkhole",
    "nd_stop_all_disasters",
    "nd_disaster_controller",
]

CAPTIONS = {
    "nd_spawn_tornado": "Tornado",
    "nd_spawn_ef5_tornado": "EF5",
    "nd_spawn_tsunami": "Tsunami",
    "nd_spawn_volcano": "Volcano",
    "nd_earthquake_m4": "Quake M4",
    "nd_earthquake_m6": "Quake M6",
    "nd_earthquake_m9": "Quake M9",
    "nd_meteor_strike": "Meteor",
    "nd_supercell": "Supercell",
    "nd_hurricane": "Hurricane",
    "nd_wildfire": "Wildfire",
    "nd_blizzard": "Blizzard",
    "nd_sinkhole": "Sinkhole",
    "nd_stop_all_disasters": "STOP ALL",
    "nd_disaster_controller": "Controller",
}


def build_item_images():
    assert set(ICON_ORDER) == set(ICONS), "ICON_ORDER / ICONS mismatch"
    out = {}
    for key in ICON_ORDER:
        pal, rows = ICONS[key]
        out[key] = grid_to_image(key, pal, rows)
    return out


# --------------------------------------------------------------------------
# pack icons (procedural chunky pixel art: 64x64 logical pixels, x4 -> 256)
# --------------------------------------------------------------------------

PACK_LOGICAL = 64
PACK_SCALE = 4

# 3x5 letters for the corner badge
FONT_LETTERS = {
    "B": ["XX.", "X.X", "XX.", "X.X", "XX."],
    "R": ["XX.", "X.X", "XX.", "X.X", "X.X"],
    "P": ["XX.", "X.X", "XX.", "X..", "X.."],
}

PACK_THEMES = {
    # behavior pack: hot storm sky, red/orange accent, "BP" badge
    "bp": {
        "sky": ["2a1030", "4a1840", "7a2848", "b04a48", "e08048"],
        "cloud": ["1e1420", "34243a", "4e3a52", "6e5468"],
        "frame": "e8541c",
        "frame_dark": "5a1a0a",
        "badge_bg": "e8541c",
        "badge_fg": "fff4d8",
        "bolt": "ffd820",
        "letters": "BP",
    },
    # resource pack: cool storm sky, teal/cyan accent, "RP" badge
    "rp": {
        "sky": ["0c1a30", "14304c", "1e4c6c", "2c7088", "58a4a8"],
        "cloud": ["141c28", "24303e", "3a4a5c", "58708a"],
        "frame": "28c8d8",
        "frame_dark": "0a3a48",
        "badge_bg": "18a4b8",
        "badge_fg": "f0feff",
        "bolt": "e8f8ff",
        "letters": "RP",
    },
}

FUNNEL_TONES = ["50545e", "7a808c", "a4aab6", "cdd3dd"]
GRASS = ["4e9c34", "3e8228", "62b040", "2f6a1e"]
DIRT = ["86592e", "6c4624", "a06c3a", "58381c"]
DEBRIS = ["8a5c30", "5a3a1c", "c8ccd4"]


def _hash2(x, y, seed):
    # small integer hash -> deterministic pseudo-random in [0, 1)
    n = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    n ^= n >> 16
    return (n & 0xFFFF) / 65536.0


def make_pack_icon(theme_key):
    th = PACK_THEMES[theme_key]
    n = PACK_LOGICAL
    img = Image.new("RGBA", (n, n), (0, 0, 0, 255))
    px = img.load()
    seed = 11 if theme_key == "bp" else 23

    # sky: 5 hard bands (dithered edges) from dark (top) to bright horizon
    sky = [hexcol(c) for c in th["sky"]]
    horizon_y = 48
    for y in range(n):
        t = min(y / float(horizon_y), 0.999) * len(sky)
        band = int(t)
        frac = t - band
        for x in range(n):
            b = band
            # checker dither on the last 20% of every band edge
            if frac > 0.8 and b + 1 < len(sky) and (x + y) % 2 == 0:
                b += 1
            px[x, y] = sky[b]

    # cloud mass: overlapping blocky ellipses, lit from the top
    cloud = [hexcol(c) for c in th["cloud"]]
    blobs = [
        (10, 8, 14, 7), (24, 6, 16, 8), (40, 7, 16, 8), (54, 9, 13, 7),
        (18, 13, 15, 6), (34, 13, 17, 6), (49, 14, 14, 5), (4, 14, 8, 5),
    ]
    for y in range(0, 24):
        for x in range(n):
            best = None
            for (cx, cy, rx, ry) in blobs:
                d = ((x - cx) / float(rx)) ** 2 + ((y - cy) / float(ry)) ** 2
                if d <= 1.0 and (best is None or d < best):
                    best = d
            if best is not None:
                # top of the cloud is lighter, underside darkest
                shade = 3 if best > 0.55 and y < 9 else (2 if y < 12 else (1 if y < 17 else 0))
                if y >= 17:
                    shade = 0
                px[x, y] = cloud[shade]

    # funnel: horizontal slices, wobbling centre line, diagonal banding = rotation
    fun = [hexcol(c) for c in FUNNEL_TONES]
    y_top, y_bot = 15, 50
    for y in range(y_top, y_bot):
        k = (y - y_top) / float(y_bot - y_top)  # 0 top .. 1 bottom
        half = 2.0 + (1.0 - k) ** 1.4 * 15.0
        wob = (
            6.0 * (1.0 - k) * ((y - y_top) / 5.0 % 4.0 - 2.0) / 2.0 * 0.0
        )
        cx = 32.0 + 6.5 * (1.0 - k) * _tri(y * 0.16) + 4.0 * k * _tri(y * 0.16 + 1.7) + wob
        x0 = int(round(cx - half))
        x1 = int(round(cx + half))
        for x in range(x0, x1 + 1):
            if 0 <= x < n:
                edge = min(x - x0, x1 - x)
                tone = ((x + y // 2) // 3) % 3  # diagonal stripes
                if edge == 0:
                    idx = 0
                elif edge == 1:
                    idx = 1 if tone != 0 else 0
                else:
                    idx = 1 + tone if tone < 3 else 2
                    idx = min(idx, 3)
                px[x, y] = fun[idx]

    # ground: grass block strip with dirt below
    grass = [hexcol(c) for c in GRASS]
    dirt = [hexcol(c) for c in DIRT]
    for y in range(horizon_y, n):
        for x in range(n):
            r = _hash2(x // 2, y // 2, seed)
            if y < horizon_y + 4:
                # grass top, ragged lower edge
                if y == horizon_y + 3 and _hash2(x, 3, seed) < 0.5:
                    px[x, y] = dirt[0]
                else:
                    px[x, y] = grass[0] if r < 0.5 else (grass[2] if r < 0.75 else grass[1])
                if y == horizon_y:
                    px[x, y] = grass[2] if r < 0.6 else grass[0]
            else:
                px[x, y] = dirt[0] if r < 0.55 else (dirt[1] if r < 0.8 else (dirt[2] if r < 0.92 else dirt[3]))

    # debris flying around the funnel base
    deb = [hexcol(c) for c in DEBRIS]
    for (x, y, c) in [(22, 42, 0), (24, 41, 0), (43, 38, 1), (45, 38, 1), (20, 34, 2),
                      (46, 30, 0), (47, 30, 0), (26, 46, 1), (40, 45, 2), (41, 45, 2)]:
        px[x, y] = deb[c]

    # lightning bolt on the right side of the funnel
    bolt = hexcol(th["bolt"])
    for (x, y) in [(52, 20), (51, 21), (50, 22), (51, 23), (50, 24), (49, 25), (50, 26),
                   (49, 27), (48, 28), (49, 29), (48, 30), (47, 31), (46, 32),
                   (53, 20), (52, 21), (52, 22), (52, 23), (51, 24), (51, 25), (51, 26),
                   (50, 27), (50, 28), (50, 29), (49, 30), (48, 31), (47, 32)]:
        px[x, y] = bolt

    # frame: dark rim + accent line (2 + 2 logical px)
    fr = hexcol(th["frame"])
    fd = hexcol(th["frame_dark"])
    for i in range(n):
        for d in range(2):
            for (x, y) in [(i, d), (i, n - 1 - d), (d, i), (n - 1 - d, i)]:
                px[x, y] = fd
        for d in range(2, 4):
            for (x, y) in [(i, d), (i, n - 1 - d), (d, i), (n - 1 - d, i)]:
                if 2 <= i < n - 2 or True:
                    px[x, y] = fr

    # corner badge with the pack letters
    bg = hexcol(th["badge_bg"])
    fg = hexcol(th["badge_fg"])
    bx0, by0 = 6, 6
    bw, bh = 15, 9
    for y in range(by0, by0 + bh):
        for x in range(bx0, bx0 + bw):
            edge = x in (bx0, bx0 + bw - 1) or y in (by0, by0 + bh - 1)
            px[x, y] = fd if edge else bg
    for li, letter in enumerate(th["letters"]):
        for dy, line in enumerate(FONT_LETTERS[letter]):
            for dx, c in enumerate(line):
                if c == "X":
                    px[bx0 + 3 + li * 5 + dx, by0 + 2 + dy] = fg

    return img.resize((n * PACK_SCALE, n * PACK_SCALE), Image.NEAREST)


def _tri(t):
    """Triangle wave in [-1, 1] with period 2*pi-ish (deterministic, no math import needed)."""
    import math
    return math.sin(t)


# --------------------------------------------------------------------------
# output + review sheets
# --------------------------------------------------------------------------


def write_all():
    os.makedirs(ITEM_DIR, exist_ok=True)
    imgs = build_item_images()
    for key, img in imgs.items():
        img.save(os.path.join(ITEM_DIR, key + ".png"), format="PNG", optimize=False)
    for theme, pack_dir in (("bp", BP), ("rp", RP)):
        os.makedirs(pack_dir, exist_ok=True)
        make_pack_icon(theme).save(os.path.join(pack_dir, "pack_icon.png"), format="PNG", optimize=False)
    return imgs


def _font():
    try:
        return ImageFont.load_default()
    except Exception:  # pragma: no cover
        return None


def make_sheet(imgs, scale, cols, bg_mode, cell_pad, caption=True):
    font = _font()
    cw = SIZE * scale + cell_pad * 2
    ch = SIZE * scale + cell_pad * 2 + (14 if caption else 0)
    rows = (len(ICON_ORDER) + cols - 1) // cols
    sheet = Image.new("RGBA", (cw * cols, ch * rows), (40, 40, 44, 255))
    d = ImageDraw.Draw(sheet)
    for i, key in enumerate(ICON_ORDER):
        cx = (i % cols) * cw
        cy = (i // cols) * ch
        x0, y0 = cx + cell_pad, cy + cell_pad
        size = SIZE * scale
        if bg_mode == "checker":
            step = max(scale, 4)
            for yy in range(0, size, step):
                for xx in range(0, size, step):
                    c = (74, 74, 80, 255) if ((xx // step) + (yy // step)) % 2 == 0 else (58, 58, 64, 255)
                    d.rectangle([x0 + xx, y0 + yy, x0 + xx + step - 1, y0 + yy + step - 1], fill=c)
        else:
            d.rectangle([x0, y0, x0 + size - 1, y0 + size - 1], fill=(88, 152, 72, 255))
        big = imgs[key].resize((size, size), Image.NEAREST)
        sheet.alpha_composite(big, (x0, y0))
        if caption:
            d.text((cx + 3, y0 + size + 3), CAPTIONS[key], fill=(235, 235, 235, 255), font=font)
    return sheet


def write_sheets(imgs, outdir):
    os.makedirs(outdir, exist_ok=True)
    make_sheet(imgs, 16, 5, "checker", 6).save(os.path.join(outdir, "sheet_x16.png"))
    make_sheet(imgs, 3, 8, "checker", 6).save(os.path.join(outdir, "sheet_x3_phone.png"))
    make_sheet(imgs, 3, 8, "grass", 6).save(os.path.join(outdir, "sheet_x3_phone_grass.png"))
    # 1:1 strip, useful to judge the real size
    strip = Image.new("RGBA", (SIZE * len(ICON_ORDER) + 4 * (len(ICON_ORDER) + 1), SIZE + 8), (60, 60, 64, 255))
    for i, key in enumerate(ICON_ORDER):
        strip.alpha_composite(imgs[key], (4 + i * (SIZE + 4), 4))
    strip.save(os.path.join(outdir, "strip_x1.png"))
    for theme, pack_dir in (("bp", BP), ("rp", RP)):
        Image.open(os.path.join(pack_dir, "pack_icon.png")).save(os.path.join(outdir, "pack_icon_%s.png" % theme))


def self_check():
    """Programmatic checks required by the task brief. Returns list of problems."""
    problems = []
    for key in ICON_ORDER:
        p = os.path.join(ITEM_DIR, key + ".png")
        if not os.path.isfile(p):
            problems.append("missing " + p)
            continue
        im = Image.open(p)
        im.load()
        if im.size != (16, 16):
            problems.append("%s: size %s" % (key, im.size))
        if im.mode != "RGBA":
            problems.append("%s: mode %s" % (key, im.mode))
        px = list(im.convert("RGBA").getdata())
        opaque = sum(1 for c in px if c[3] == 255)
        transparent = sum(1 for c in px if c[3] == 0)
        partial = sum(1 for c in px if 0 < c[3] < 255)
        colours = set(px)
        if partial:
            problems.append("%s: %d partially transparent pixels" % (key, partial))
        if not (opaque and (transparent or opaque == 256)):
            problems.append("%s: bad alpha mix opaque=%d transparent=%d" % (key, opaque, transparent))
        if len(colours) > 16:
            problems.append("%s: %d unique colours" % (key, len(colours)))
        solid = {c for c in colours if c[3] == 255}
        if len(solid) > 8:
            problems.append("%s: %d opaque colours (>8)" % (key, len(solid)))
        if transparent and any(c[:3] != (0, 0, 0) for c in colours if c[3] == 0):
            problems.append("%s: transparent pixels not (0,0,0,0)" % key)
    for pack_dir in (BP, RP):
        p = os.path.join(pack_dir, "pack_icon.png")
        if not os.path.isfile(p):
            problems.append("missing " + p)
            continue
        im = Image.open(p)
        im.load()
        if im.size not in ((256, 256), (128, 128)) or im.mode != "RGBA":
            problems.append("%s: size %s mode %s" % (p, im.size, im.mode))
    b = Image.open(os.path.join(BP, "pack_icon.png")).tobytes()
    r = Image.open(os.path.join(RP, "pack_icon.png")).tobytes()
    if b == r:
        problems.append("BP and RP pack icons are identical")
    # icons must be distinct from each other
    seen = {}
    for key in ICON_ORDER:
        data = Image.open(os.path.join(ITEM_DIR, key + ".png")).tobytes()
        if data in seen:
            problems.append("%s identical to %s" % (key, seen[data]))
        seen[data] = key
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheets", metavar="DIR", help="also write review sheets into DIR")
    ap.add_argument("--check", action="store_true", help="run self checks after generating")
    args = ap.parse_args()
    imgs = write_all()
    print("wrote %d item icons + 2 pack icons" % len(imgs))
    if args.sheets:
        write_sheets(imgs, args.sheets)
        print("sheets in", args.sheets)
    if args.check:
        problems = self_check()
        for p in problems:
            print("PROBLEM:", p)
        print("self-check:", "FAILED" if problems else "OK")
        return 1 if problems else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
