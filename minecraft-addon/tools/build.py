#!/usr/bin/env python3
"""Generates the models/textures for the Bugatti + Sniper add-on and packs it
into a single .mcaddon file that can be opened directly on Android/iOS.

    python3 tools/build.py

Everything it writes is committed to the repo, so running it is only needed
after changing the model or the pixel art below.
"""

import json
import os
import struct
import shutil
import zlib
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "BugattiSniper_BP")
RP = os.path.join(ROOT, "BugattiSniper_RP")
DIST = os.path.join(ROOT, "dist")
ADDON_NAME = "BugattiSniper.mcaddon"


# --------------------------------------------------------------------------
# tiny PNG writer (RGBA, no external dependencies)
# --------------------------------------------------------------------------
def write_png(path, pixels):
    height = len(pixels)
    width = len(pixels[0])
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter type 0
        for r, g, b, a in row:
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        out = struct.pack(">I", len(data)) + tag + data
        return out + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(png)
    print("  texture", os.path.relpath(path, ROOT))


def rgba(hex_color, alpha=255):
    hex_color = hex_color.lstrip("#")
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
        alpha,
    )


CLEAR = (0, 0, 0, 0)


def blank(w, h, color=CLEAR):
    return [[color for _ in range(w)] for _ in range(h)]


def fill(px, x0, y0, x1, y1, color):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px[y][x] = color


def from_art(art, palette):
    """Build pixels from a list of strings + a char -> colour mapping."""
    return [[palette.get(ch, CLEAR) for ch in row] for row in art]


def scale(px, factor):
    out = []
    for row in px:
        big = []
        for pixel in row:
            big.extend([pixel] * factor)
        out.extend([big] * factor)
    return out


def shade(color, amount):
    r, g, b, a = color
    f = lambda v: max(0, min(255, int(v + amount)))
    return (f(r), f(g), f(b), a)


# --------------------------------------------------------------------------
# entity texture: a palette atlas. Every model face points at one flat region,
# so the geometry below picks a colour by choosing UV coordinates.
# --------------------------------------------------------------------------
BLUE = "blue"
BLACK = "black"
GLASS = "glass"
SILVER = "silver"
HEAD = "head"
TAIL = "tail"
DBLUE = "dblue"

# name -> (uv, uv_size) inside textures/entity/bugatti.png
UV = {
    BLUE: ([0, 0], [16, 16]),
    BLACK: ([0, 24], [16, 14]),
    GLASS: ([0, 40], [16, 8]),
    SILVER: ([32, 40], [16, 8]),
    HEAD: ([48, 40], [16, 8]),
    TAIL: ([0, 48], [16, 16]),
    DBLUE: ([32, 48], [16, 16]),
}


def build_car_texture():
    px = blank(64, 64, rgba("#1560BD"))
    # Bugatti blue body with a soft top-down gradient
    for y in range(0, 24):
        for x in range(0, 64):
            px[y][x] = shade(rgba("#1560BD"), 18 - y)
    # tyres / carbon
    for y in range(24, 40):
        for x in range(0, 64):
            n = ((x * 7 + y * 13) % 5) - 2
            px[y][x] = shade(rgba("#15171C"), n * 3)
    fill(px, 0, 40, 31, 47, rgba("#1B2733"))   # tinted glass
    fill(px, 32, 40, 47, 47, rgba("#C6CBD1"))  # chrome
    fill(px, 48, 40, 63, 47, rgba("#FFF3B0"))  # headlights
    fill(px, 0, 48, 31, 63, rgba("#D62828"))   # tail lights
    fill(px, 32, 48, 63, 63, rgba("#0B2F63"))  # dark blue accents
    write_png(os.path.join(RP, "textures/entity/bugatti.png"), px)


def build_bullet_texture():
    px = blank(16, 16)
    fill(px, 4, 0, 11, 5, rgba("#B87333"))
    fill(px, 4, 6, 11, 15, rgba("#D9B44A"))
    fill(px, 4, 0, 5, 15, rgba("#8C5A28"))
    fill(px, 10, 0, 11, 15, rgba("#F0DE9A"))
    write_png(os.path.join(RP, "textures/entity/sniper_bullet.png"), px)


RIFLE_ART = [
    "..............KK",
    ".............KKS",
    "............KKS.",
    "...........KKS..",
    ".........lLKS...",
    "........LLKS....",
    ".......SSKS.....",
    "......KKKS......",
    ".....KKKS.......",
    "....KKKS........",
    "...KKOS.........",
    "..KKOS..........",
    "..KKS...........",
    ".KKS............",
    "KKS.............",
    "KS..............",
]

AMMO_ART = [
    ".......CC.......",
    "......CCCC......",
    "......CCCC......",
    ".....CCCCCC.....",
    ".....BBBBBB.....",
    ".....BbbbbB.....",
    ".....BbbbbB.....",
    ".....BbbbbB.....",
    ".....BbbbbB.....",
    ".....BbbbbB.....",
    ".....BbbbbB.....",
    ".....BbbbbB.....",
    ".....BbbbbB.....",
    ".....BbbbbB.....",
    ".....DDDDDD.....",
    ".....DDDDDD.....",
]

CAR_ICON_ART = [
    "................",
    "................",
    "................",
    "................",
    "......BBBBB.....",
    ".....BGGGGGB....",
    "...BBBBBBBBBB...",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBBR.",
    "..DDDDDDDDDDDDD.",
    "...KK......KK...",
    "...KK......KK...",
    "................",
    "................",
    "................",
    "................",
]


def build_item_textures():
    rifle = from_art(
        RIFLE_ART,
        {
            "K": rgba("#2A2E35"),
            "S": rgba("#8A929C"),
            "L": rgba("#1A1D22"),
            "l": rgba("#7FD8FF"),
            "O": rgba("#B07B2A"),
        },
    )
    write_png(os.path.join(RP, "textures/items/sniper_rifle.png"), rifle)

    ammo = from_art(
        AMMO_ART,
        {
            "C": rgba("#B87333"),
            "B": rgba("#8C6B22"),
            "b": rgba("#D9B44A"),
            "D": rgba("#6E5518"),
        },
    )
    write_png(os.path.join(RP, "textures/items/sniper_ammo.png"), ammo)


def build_pack_icons():
    car = from_art(
        CAR_ICON_ART,
        {
            "B": rgba("#1560BD"),
            "G": rgba("#1B2733"),
            "D": rgba("#0B2F63"),
            "K": rgba("#15171C"),
            "R": rgba("#D62828"),
        },
    )
    background = rgba("#0E1116")
    icon = [[background if p == CLEAR else p for p in row] for row in car]
    write_png(os.path.join(BP, "pack_icon.png"), scale(icon, 4))

    rifle = from_art(
        RIFLE_ART,
        {
            "K": rgba("#2A2E35"),
            "S": rgba("#8A929C"),
            "L": rgba("#1A1D22"),
            "l": rgba("#7FD8FF"),
            "O": rgba("#B07B2A"),
        },
    )
    icon2 = [[rgba("#101820") if p == CLEAR else p for p in row] for row in rifle]
    write_png(os.path.join(RP, "pack_icon.png"), scale(icon2, 4))


# --------------------------------------------------------------------------
# geometry
# --------------------------------------------------------------------------
def cube(origin, size, faces):
    """faces: either a palette name for the whole cube, or a dict of
    face -> palette name (north/south/east/west/up/down)."""
    if isinstance(faces, str):
        faces = {f: faces for f in ("north", "south", "east", "west", "up", "down")}
    uv = {}
    for face, name in faces.items():
        coords, uv_size = UV[name]
        uv[face] = {"uv": list(coords), "uv_size": list(uv_size)}
    return {"origin": list(origin), "size": list(size), "uv": uv}


def build_car_geometry():
    body = [
        # ---- chassis -------------------------------------------------
        cube([-11, 2, -26], [22, 3, 52], BLACK),                 # underbody
        cube([-12, 5, -28], [24, 5, 56], BLUE),                  # main body
        cube([-11, 4, -30], [22, 4, 2], BLUE),                   # nose
        cube([-8, 5, -31], [16, 3, 1], DBLUE),                   # grille
        cube([-11, 8, -31], [5, 2, 1], HEAD),                    # headlight L
        cube([6, 8, -31], [5, 2, 1], HEAD),                      # headlight R
        cube([-13, 5, -8], [1, 1, 22], SILVER),                  # side blade L
        cube([12, 5, -8], [1, 1, 22], SILVER),                   # side blade R
        # ---- cockpit (open top so the driver is visible) -------------
        cube([-10, 10, -10], [1, 4, 22], BLUE),                  # left wall
        cube([9, 10, -10], [1, 4, 22], BLUE),                    # right wall
        cube([-6, 10, 11], [12, 5, 1], BLUE),                    # roll hoop
        cube([-13, 14, -8], [2, 1, 3], SILVER),                  # mirror L
        cube([11, 14, -8], [2, 1, 3], SILVER),                   # mirror R
        # ---- rear ----------------------------------------------------
        cube([-10, 10, 14], [20, 2, 12], DBLUE),                 # engine cover
        cube([-9, 12, 24], [2, 5, 2], BLACK),                    # wing strut L
        cube([7, 12, 24], [2, 5, 2], BLACK),                     # wing strut R
        cube([-12, 17, 22], [24, 1, 7], DBLUE),                  # rear wing
        cube([-11, 8, 28], [22, 2, 1], TAIL),                    # tail light bar
        cube([-10, 4, 27], [20, 2, 2], BLACK),                   # diffuser
        cube([-6, 5, 28], [3, 3, 1], SILVER),                    # exhaust L
        cube([3, 5, 28], [3, 3, 1], SILVER),                     # exhaust R
        # ---- wheels --------------------------------------------------
        cube([-15, 0, -22], [4, 10, 10], BLACK),
        cube([11, 0, -22], [4, 10, 10], BLACK),
        cube([-15, 0, 12], [4, 11, 11], BLACK),
        cube([11, 0, 12], [4, 11, 11], BLACK),
        cube([-16, 3, -19], [1, 4, 4], SILVER),
        cube([15, 3, -19], [1, 4, 4], SILVER),
        cube([-16, 3, 15], [1, 5, 5], SILVER),
        cube([15, 3, 15], [1, 5, 5], SILVER),
    ]

    windshield = [
        cube(
            [-9, 10, -11],
            [18, 7, 1],
            {
                "north": GLASS,
                "south": GLASS,
                "east": SILVER,
                "west": SILVER,
                "up": SILVER,
                "down": SILVER,
            },
        )
    ]

    geo = {
        "format_version": "1.16.0",
        "minecraft:geometry": [
            {
                "description": {
                    "identifier": "geometry.bugatti",
                    "texture_width": 64,
                    "texture_height": 64,
                    "visible_bounds_width": 5,
                    "visible_bounds_height": 4,
                    "visible_bounds_offset": [0, 1.5, 0],
                },
                "bones": [
                    {"name": "body", "pivot": [0, 0, 0], "cubes": body},
                    {
                        "name": "windshield",
                        "parent": "body",
                        "pivot": [0, 10, -11],
                        "rotation": [-28, 0, 0],
                        "cubes": windshield,
                    },
                ],
            },
            {
                "description": {
                    "identifier": "geometry.sniper_bullet",
                    "texture_width": 16,
                    "texture_height": 16,
                    "visible_bounds_width": 1,
                    "visible_bounds_height": 1,
                    "visible_bounds_offset": [0, 0, 0],
                },
                "bones": [
                    {
                        "name": "bullet",
                        "pivot": [0, 0, 0],
                        "cubes": [
                            {
                                "origin": [-1, -1, -2],
                                "size": [2, 2, 4],
                                "uv": [0, 0],
                            }
                        ],
                    }
                ],
            },
        ],
    }

    path = os.path.join(RP, "models/entity/bugatti.geo.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(geo, fh, indent=2)
        fh.write("\n")
    print("  model  ", os.path.relpath(path, ROOT))


# --------------------------------------------------------------------------
# packaging
# --------------------------------------------------------------------------
def build_mcaddon():
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, ADDON_NAME)
    if os.path.exists(out):
        os.remove(out)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for pack in (BP, RP):
            for folder, _, files in os.walk(pack):
                for name in sorted(files):
                    full = os.path.join(folder, name)
                    arc = os.path.join(
                        os.path.basename(pack), os.path.relpath(full, pack)
                    )
                    zf.write(full, arc)
    size = os.path.getsize(out)
    print("\nBuilt %s (%.1f KB)" % (os.path.relpath(out, ROOT), size / 1024.0))
    return out


def validate():
    """Fail loudly on malformed JSON before anything ships."""
    bad = 0
    for pack in (BP, RP):
        for folder, _, files in os.walk(pack):
            for name in files:
                if not name.endswith(".json"):
                    continue
                full = os.path.join(folder, name)
                try:
                    with open(full) as fh:
                        json.load(fh)
                except ValueError as err:
                    bad += 1
                    print("  INVALID JSON:", os.path.relpath(full, ROOT), err)
    if bad:
        raise SystemExit("%d invalid JSON file(s)" % bad)
    print("  all JSON files parse cleanly")


if __name__ == "__main__":
    print("Generating art + models...")
    build_car_texture()
    build_bullet_texture()
    build_item_textures()
    build_pack_icons()
    build_car_geometry()
    print("Validating...")
    validate()
    build_mcaddon()
