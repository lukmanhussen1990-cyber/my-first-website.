#!/usr/bin/env python3
"""Generate every item icon, block texture and pack icon for Lost Island: Abandoned.

All art is original, composed pixel-by-pixel. Item icons are 16x16 and block
textures are 16x16 to keep GPU memory and download size low on Android.
Deterministic: no randomness that is not seeded.
"""
import json
import os
import random

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "build", "Lost_Island_RP")
ITEM_DIR = os.path.join(RP, "textures", "items")
BLOCK_DIR = os.path.join(RP, "textures", "blocks")

T = (0, 0, 0, 0)


def new(size=16):
    return Image.new("RGBA", (size, size), T)


def px(im, x, y, c):
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), c)


def rect(im, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px(im, x, y, c)


def outline(im, x0, y0, x1, y1, c):
    for x in range(x0, x1 + 1):
        px(im, x, y0, c)
        px(im, x, y1, c)
    for y in range(y0, y1 + 1):
        px(im, x0, y, c)
        px(im, x1, y, c)


def hline(im, x0, x1, y, c):
    for x in range(x0, x1 + 1):
        px(im, x, y, c)


def vline(im, x, y0, y1, c):
    for y in range(y0, y1 + 1):
        px(im, x, y, c)


def dark(c, f=0.65):
    return (int(c[0] * f), int(c[1] * f), int(c[2] * f), c[3])


def light(c, f=1.35):
    return (min(255, int(c[0] * f)), min(255, int(c[1] * f)),
            min(255, int(c[2] * f)), c[3])


def save(im, d, name):
    os.makedirs(d, exist_ok=True)
    im.save(os.path.join(d, name + ".png"))


# --------------------------------------------------------------------------
# A hand-made 3x5 pixel font, enough for short uppercase warning words.
# --------------------------------------------------------------------------
FONT = {
    "A": ["111", "101", "111", "101", "101"],
    "B": ["110", "101", "110", "101", "110"],
    "C": ["111", "100", "100", "100", "111"],
    "D": ["110", "101", "101", "101", "110"],
    "E": ["111", "100", "111", "100", "111"],
    "F": ["111", "100", "110", "100", "100"],
    "G": ["111", "100", "101", "101", "111"],
    "H": ["101", "101", "111", "101", "101"],
    "I": ["111", "010", "010", "010", "111"],
    "K": ["101", "101", "110", "101", "101"],
    "L": ["100", "100", "100", "100", "111"],
    "N": ["101", "111", "111", "111", "101"],
    "O": ["111", "101", "101", "101", "111"],
    "P": ["111", "101", "111", "100", "100"],
    "Q": ["111", "101", "101", "111", "011"],
    "R": ["111", "101", "110", "101", "101"],
    "S": ["111", "100", "111", "001", "111"],
    "T": ["111", "010", "010", "010", "010"],
    "U": ["101", "101", "101", "101", "111"],
    "V": ["101", "101", "101", "101", "010"],
    "W": ["101", "101", "111", "111", "101"],
    "X": ["101", "101", "010", "101", "101"],
    "Y": ["101", "101", "010", "010", "010"],
    "Z": ["111", "001", "010", "100", "111"],
    "!": ["010", "010", "010", "000", "010"],
    "-": ["000", "000", "111", "000", "000"],
    " ": ["000", "000", "000", "000", "000"],
}


def text3x5(im, x, y, s, c, gap=1, scale=1):
    """Draw uppercase text with the 3x5 font, optionally pixel-scaled."""
    cx = x
    for ch in s.upper():
        g = FONT.get(ch)
        if g:
            for gy, row in enumerate(g):
                for gx, bit in enumerate(row):
                    if bit == "1":
                        for sy in range(scale):
                            for sx in range(scale):
                                px(im, cx + gx * scale + sx,
                                   y + gy * scale + sy, c)
        cx += (3 + gap) * scale
    return cx


def text_width(s, gap=1, scale=1):
    return (len(s) * (3 + gap) - gap) * scale


def centered_text(im, y, s, c, width=16, margin=1, scale=1):
    """Centre a word in a tile. Sign tiles are 32px so the words stay legible
    at a 2x font scale; 16px tiles cannot fit a readable 4-letter word."""
    w = text_width(s, 1, scale)
    text3x5(im, max(margin, (width - w) // 2), y, s, c, 1, scale)


# ==========================================================================
# ITEM ICONS (16x16)
# ==========================================================================

def bottle(fill, cap, specks=0, steam=False, seed=1):
    """Shared plastic-bottle silhouette used by the three water items."""
    im = new()
    glass = (206, 224, 230, 90)
    edge = (70, 88, 96, 255)
    # cap + neck
    rect(im, 6, 1, 9, 2, cap)
    px(im, 6, 1, light(cap))
    rect(im, 7, 3, 8, 3, (150, 168, 175, 255))
    # body outline (slightly tapered shoulders)
    outline(im, 5, 4, 10, 14, edge)
    px(im, 5, 4, edge)
    rect(im, 6, 5, 9, 13, glass)
    # liquid, filled to ~2/3
    rect(im, 6, 7, 9, 13, fill)
    hline(im, 6, 9, 7, light(fill))
    # highlight down the left edge, shadow on the right
    vline(im, 6, 5, 13, (255, 255, 255, 70))
    vline(im, 9, 8, 13, dark(fill, 0.7))
    if specks:
        rnd = random.Random(seed)
        for _ in range(specks):
            px(im, rnd.randint(6, 9), rnd.randint(8, 13),
               (74, 60, 34, 255))
    if steam:
        for i, (sx, sy) in enumerate([(4, 2), (11, 1), (4, 0)]):
            px(im, sx, sy, (225, 235, 240, 140))
    return im


def icon_clean_water():
    return bottle((110, 176, 214, 235), (58, 122, 168, 255))


def icon_dirty_water():
    return bottle((104, 96, 52, 245), (86, 74, 44, 255), specks=9, seed=7)


def icon_boiled_water():
    return bottle((150, 210, 235, 225), (216, 216, 216, 255), steam=True)


def can(label, contents):
    im = new()
    steel = (176, 180, 186, 255)
    rect(im, 4, 2, 11, 13, steel)
    outline(im, 4, 2, 11, 13, (86, 90, 96, 255))
    # lid ellipse-ish
    hline(im, 5, 10, 2, (206, 210, 216, 255))
    hline(im, 5, 10, 3, (150, 154, 160, 255))
    # paper label
    rect(im, 4, 5, 11, 11, label)
    hline(im, 4, 11, 5, light(label, 1.2))
    hline(im, 4, 11, 11, dark(label))
    # printed lines on the label
    hline(im, 6, 9, 7, (250, 248, 240, 255))
    hline(im, 6, 8, 9, (250, 248, 240, 200))
    px(im, 5, 8, contents)
    px(im, 10, 8, contents)
    # left highlight / right shade
    vline(im, 5, 3, 13, (255, 255, 255, 60))
    vline(im, 11, 4, 13, (0, 0, 0, 70))
    return im


def icon_canned_beans():
    return can((150, 96, 48, 255), (96, 62, 30, 255))


def icon_canned_meat():
    return can((150, 52, 46, 255), (108, 40, 36, 255))


def icon_bandage():
    im = new()
    gauze = (234, 230, 218, 255)
    shade = (190, 184, 168, 255)
    edge = (138, 132, 118, 255)
    d = ImageDraw.Draw(im)
    # a rolled bandage: round coil with a visible spiral end
    d.ellipse([3, 3, 12, 12], fill=gauze, outline=edge)
    d.ellipse([5, 5, 10, 10], fill=shade, outline=edge)
    d.ellipse([7, 7, 8, 8], fill=gauze)
    # the loose tail unrolling to the lower right
    px(im, 11, 11, gauze); px(im, 12, 12, gauze); px(im, 13, 12, gauze)
    px(im, 13, 13, shade); px(im, 14, 13, gauze)
    px(im, 12, 13, edge)
    # highlight
    px(im, 5, 4, (255, 255, 255, 255)); px(im, 6, 4, (250, 250, 246, 255))
    return im


def icon_first_aid():
    im = new()
    body = (226, 226, 228, 255)
    rect(im, 2, 4, 13, 13, body)
    outline(im, 2, 4, 13, 13, (120, 122, 126, 255))
    # handle
    hline(im, 6, 9, 2, (150, 152, 156, 255))
    px(im, 5, 3, (150, 152, 156, 255))
    px(im, 10, 3, (150, 152, 156, 255))
    # red cross
    red = (198, 44, 40, 255)
    rect(im, 7, 6, 8, 11, red)
    rect(im, 5, 8, 10, 9, red)
    # latch + shading
    px(im, 2, 8, (120, 122, 126, 255))
    hline(im, 3, 12, 13, (170, 172, 176, 255))
    hline(im, 3, 12, 5, (255, 255, 255, 110))
    return im


def icon_cloth():
    im = new()
    a = (196, 186, 162, 255)
    b = (166, 156, 134, 255)
    c = (140, 130, 110, 255)
    # three folded layers
    rect(im, 2, 9, 13, 12, c)
    rect(im, 3, 6, 12, 9, b)
    rect(im, 4, 3, 11, 6, a)
    outline(im, 2, 9, 13, 12, dark(c))
    outline(im, 3, 6, 12, 9, dark(b))
    outline(im, 4, 3, 11, 6, dark(a))
    # weave hints
    px(im, 6, 4, light(a)); px(im, 9, 5, light(a))
    px(im, 5, 7, light(b)); px(im, 10, 8, light(b))
    px(im, 7, 11, light(c))
    return im


def icon_rope():
    im = new()
    r1 = (162, 128, 72, 255)
    r2 = (120, 92, 50, 255)
    r3 = (196, 164, 104, 255)
    d = ImageDraw.Draw(im)
    # a hank of rope: two overlapping rings, twist-hatched so it does not
    # read as a picture frame
    d.ellipse([2, 4, 13, 12], fill=None, outline=r1, width=2)
    d.ellipse([4, 2, 11, 9], fill=None, outline=r2, width=2)
    # twist hatching around both loops
    for i, (hx, hy) in enumerate([(3, 6), (5, 4), (8, 3), (11, 5), (12, 8),
                                  (10, 11), (7, 12), (4, 10), (2, 8),
                                  (6, 2), (9, 2), (12, 6)]):
        px(im, hx, hy, r3 if i % 2 else r2)
    # loose end trailing off to the right
    px(im, 13, 11, r1); px(im, 14, 12, r1); px(im, 14, 13, r2)
    px(im, 13, 13, r3)
    return im


def icon_scrap():
    im = new()
    m = (140, 134, 128, 255)
    rust = (128, 78, 44, 255)
    # irregular plate
    pts = [(3, 5), (4, 4), (5, 3), (10, 3), (12, 5), (12, 10), (10, 12),
           (5, 12), (3, 10)]
    ImageDraw.Draw(im).polygon(pts, fill=m, outline=(78, 74, 70, 255))
    # rivets
    for (rx, ry) in ((5, 5), (10, 5), (5, 10), (10, 10)):
        px(im, rx, ry, (96, 92, 88, 255))
        px(im, rx, ry - 1, (190, 186, 180, 255))
    # rust streaks and a torn corner
    px(im, 7, 4, rust); px(im, 8, 6, rust); px(im, 6, 8, rust)
    px(im, 9, 9, rust); px(im, 7, 11, rust)
    px(im, 12, 11, T); px(im, 11, 12, T)
    hline(im, 5, 9, 3, (190, 186, 180, 200))
    return im


def icon_battery():
    im = new()
    body = (44, 46, 52, 255)
    band = (196, 156, 40, 255)
    rect(im, 5, 3, 10, 13, body)
    outline(im, 5, 3, 10, 13, (18, 18, 22, 255))
    # positive terminal
    rect(im, 7, 1, 8, 2, (206, 202, 190, 255))
    px(im, 7, 1, (255, 255, 255, 255))
    # label band with a plus
    rect(im, 5, 7, 10, 10, band)
    px(im, 7, 8, (40, 30, 8, 255)); px(im, 8, 8, (40, 30, 8, 255))
    px(im, 7, 9, (40, 30, 8, 255)) if False else None
    vline(im, 7, 7, 10, (40, 30, 8, 255))
    hline(im, 6, 9, 8, (40, 30, 8, 255))
    # gloss
    vline(im, 6, 4, 12, (255, 255, 255, 60))
    vline(im, 10, 4, 12, (0, 0, 0, 80))
    return im


def flashlight(on):
    im = new()
    body = (198, 158, 36, 255) if on else (168, 132, 32, 255)
    head = (86, 88, 94, 255)
    # barrel running diagonally is hard to read at 16px: keep it vertical
    rect(im, 6, 5, 9, 14, body)
    outline(im, 6, 5, 9, 14, (74, 58, 12, 255))
    # ribbed grip
    for y in (8, 10, 12):
        hline(im, 6, 9, y, dark(body, 0.75))
    # head + bezel
    rect(im, 5, 2, 10, 5, head)
    outline(im, 5, 2, 10, 5, (40, 42, 46, 255))
    lens = (255, 246, 190, 255) if on else (120, 132, 140, 255)
    rect(im, 6, 3, 9, 4, lens)
    if on:
        # short beam + glow, kept inside the icon bounds
        px(im, 5, 1, (255, 250, 210, 210))
        px(im, 10, 1, (255, 250, 210, 210))
        hline(im, 6, 9, 1, (255, 252, 225, 235))
        px(im, 7, 0, (255, 255, 240, 150))
        px(im, 8, 0, (255, 255, 240, 150))
    # switch
    px(im, 10, 8, (198, 44, 40, 255) if on else (70, 72, 76, 255))
    vline(im, 6, 6, 13, (255, 255, 255, 55))
    return im


def icon_flashlight_off():
    return flashlight(False)


def icon_flashlight_on():
    return flashlight(True)


def icon_crowbar():
    im = new()
    steel = (168, 62, 52, 255)      # painted red steel
    edge = (86, 30, 24, 255)
    # long shaft, diagonal for a tool silhouette
    for i in range(10):
        px(im, 4 + i, 13 - i, steel)
        px(im, 5 + i, 13 - i, edge)
    # bent claw at the top
    px(im, 13, 3, steel); px(im, 14, 3, steel)
    px(im, 14, 4, steel); px(im, 13, 2, edge)
    px(im, 12, 4, edge)
    # chisel foot
    px(im, 3, 14, steel); px(im, 2, 14, steel); px(im, 2, 13, edge)
    # worn highlights
    px(im, 7, 10, (216, 120, 108, 255))
    px(im, 10, 7, (216, 120, 108, 255))
    return im


def icon_keycard():
    im = new()
    card = (232, 234, 238, 255)
    rect(im, 2, 4, 13, 12, card)
    outline(im, 2, 4, 13, 12, (110, 116, 124, 255))
    # blue header band
    rect(im, 2, 4, 13, 6, (44, 92, 150, 255))
    # magnetic stripe
    rect(im, 2, 10, 13, 11, (32, 34, 38, 255))
    # gold chip
    rect(im, 4, 7, 6, 9, (198, 164, 48, 255))
    px(im, 5, 8, (140, 112, 24, 255))
    # printed lines
    hline(im, 8, 12, 8, (150, 154, 160, 255))
    hline(im, 8, 11, 9, (150, 154, 160, 255))
    hline(im, 3, 12, 4, (255, 255, 255, 90))
    return im


def icon_bunker_key():
    im = new()
    brass = (192, 152, 56, 255)
    edge = (118, 90, 28, 255)
    # bow (ring)
    outline(im, 3, 2, 8, 7, brass)
    px(im, 3, 2, edge); px(im, 8, 7, edge)
    rect(im, 5, 4, 6, 5, T)
    # shaft
    for i in range(7):
        px(im, 8 + i, 8 + i, brass)
    # teeth
    px(im, 12, 13, brass); px(im, 13, 11, brass); px(im, 14, 12, brass)
    px(im, 11, 13, edge)
    px(im, 6, 3, (240, 216, 140, 255))
    return im


def icon_radio_part():
    im = new()
    board = (34, 92, 58, 255)
    rect(im, 2, 6, 13, 13, board)
    outline(im, 2, 6, 13, 13, (18, 52, 32, 255))
    # copper traces
    gold = (196, 168, 72, 255)
    hline(im, 3, 12, 8, gold)
    hline(im, 3, 10, 11, gold)
    vline(im, 5, 8, 11, gold)
    vline(im, 11, 8, 10, gold)
    # components
    rect(im, 7, 9, 9, 10, (30, 32, 36, 255))
    px(im, 4, 12, (170, 40, 36, 255))
    px(im, 12, 12, (170, 40, 36, 255))
    # antenna
    vline(im, 12, 1, 6, (176, 180, 186, 255))
    px(im, 12, 1, (226, 230, 236, 255))
    px(im, 11, 2, (140, 144, 150, 255))
    return im


def icon_fuel_can():
    im = new()
    red = (162, 44, 38, 255)
    edge = (92, 24, 20, 255)
    rect(im, 3, 4, 11, 14, red)
    outline(im, 3, 4, 11, 14, edge)
    # spout
    rect(im, 11, 3, 13, 5, red)
    outline(im, 11, 3, 13, 5, edge)
    px(im, 13, 2, (120, 122, 126, 255))
    # cap + handle
    rect(im, 5, 2, 7, 3, (60, 60, 64, 255))
    # X brace pressed into the side
    for i in range(6):
        px(im, 4 + i, 7 + i, dark(red, 0.7))
        px(im, 9 - i, 7 + i, dark(red, 0.7))
    vline(im, 4, 5, 13, (255, 255, 255, 55))
    vline(im, 11, 6, 13, (0, 0, 0, 70))
    return im


def icon_mech_part():
    im = new()
    steel = (150, 154, 160, 255)
    edge = (74, 78, 82, 255)
    d = ImageDraw.Draw(im)
    d.ellipse([3, 3, 12, 12], fill=steel, outline=edge)
    # teeth
    for (tx, ty) in ((7, 1), (7, 14), (1, 7), (14, 7),
                     (3, 3), (12, 3), (3, 12), (12, 12)):
        px(im, tx, ty, steel)
        px(im, tx + 1, ty, steel) if tx < 14 else None
    # hub
    d.ellipse([6, 6, 9, 9], fill=(52, 54, 58, 255))
    px(im, 5, 5, (210, 214, 220, 255))
    px(im, 10, 10, (44, 46, 50, 255))
    return im


def icon_nav_gear():
    im = new()
    case = (58, 62, 68, 255)
    d = ImageDraw.Draw(im)
    d.ellipse([2, 2, 13, 13], fill=case, outline=(28, 30, 34, 255))
    d.ellipse([4, 4, 11, 11], fill=(226, 222, 208, 255))
    # needle: red north, dark south
    px(im, 8, 5, (196, 44, 40, 255)); px(im, 8, 6, (196, 44, 40, 255))
    px(im, 7, 9, (40, 42, 46, 255)); px(im, 7, 8, (40, 42, 46, 255))
    px(im, 7, 7, (90, 92, 96, 255)); px(im, 8, 7, (90, 92, 96, 255))
    # cardinal ticks
    px(im, 8, 3, (240, 240, 240, 255)); px(im, 7, 12, (240, 240, 240, 255))
    px(im, 3, 8, (240, 240, 240, 255)); px(im, 12, 7, (240, 240, 240, 255))
    px(im, 4, 4, (255, 255, 255, 120))
    return im


def icon_flare():
    im = new()
    tube = (176, 40, 36, 255)
    rect(im, 6, 5, 9, 14, tube)
    outline(im, 6, 5, 9, 14, (94, 20, 18, 255))
    # warning stripes
    hline(im, 6, 9, 8, (236, 232, 220, 255))
    hline(im, 6, 9, 11, (236, 232, 220, 255))
    # cap
    rect(im, 6, 3, 9, 4, (56, 56, 60, 255))
    # spark
    px(im, 7, 1, (255, 232, 120, 255)); px(im, 8, 2, (255, 200, 60, 255))
    px(im, 6, 2, (255, 168, 40, 220)); px(im, 9, 1, (255, 240, 180, 200))
    vline(im, 6, 6, 13, (255, 255, 255, 60))
    return im


def icon_documents():
    im = new()
    paper = (226, 222, 206, 255)
    # back sheets, offset
    rect(im, 4, 2, 13, 13, (198, 194, 178, 255))
    rect(im, 3, 3, 12, 14, (212, 208, 192, 255))
    rect(im, 2, 4, 11, 14, paper)
    outline(im, 2, 4, 11, 14, (140, 136, 122, 255))
    # typed lines
    for y in (6, 8, 10, 12):
        hline(im, 4, 9, y, (110, 108, 100, 255))
    hline(im, 4, 7, 13, (110, 108, 100, 255))
    # red CLASSIFIED stamp corner
    rect(im, 7, 9, 10, 11, (170, 40, 36, 110))
    outline(im, 7, 9, 10, 11, (170, 40, 36, 200))
    px(im, 3, 5, (255, 255, 255, 130))
    return im


def icon_matches():
    im = new()
    box = (142, 90, 44, 255)
    rect(im, 2, 8, 12, 14, box)
    outline(im, 2, 8, 12, 14, (84, 52, 24, 255))
    # striking strip
    rect(im, 2, 11, 12, 12, (58, 54, 50, 255))
    # a match sticking out
    for i in range(6):
        px(im, 10 + 0, 7 - i, (206, 178, 128, 255))
    px(im, 10, 1, (198, 44, 40, 255))
    px(im, 10, 2, (232, 140, 60, 255))
    # a second match lying flat
    hline(im, 4, 8, 9, (206, 178, 128, 255))
    px(im, 3, 9, (198, 44, 40, 255))
    hline(im, 3, 11, 8, light(box, 1.2))
    return im


def icon_setup_tool():
    im = new()
    paper = (222, 212, 182, 255)
    rect(im, 1, 3, 14, 13, paper)
    outline(im, 1, 3, 14, 13, (128, 118, 92, 255))
    # island silhouette on a chart
    sea = (86, 132, 150, 255)
    rect(im, 2, 4, 13, 12, sea)
    land = (96, 132, 70, 255)
    for (y, x0, x1) in ((6, 6, 9), (7, 5, 11), (8, 4, 12), (9, 5, 11), (10, 6, 10)):
        hline(im, x0, x1, y, land)
    px(im, 8, 5, (140, 148, 120, 255))   # peak
    # X marks the wreck
    px(im, 4, 11, (190, 40, 36, 255)); px(im, 5, 12, (190, 40, 36, 255))
    px(im, 5, 11, (190, 40, 36, 255)); px(im, 4, 12, (190, 40, 36, 255))
    # folded corner
    px(im, 14, 3, (250, 246, 230, 255))
    return im


def icon_debug_tool():
    im = new()
    handle = (72, 76, 82, 255)
    for i in range(8):
        px(im, 4 + i, 13 - i, handle)
        px(im, 5 + i, 13 - i, dark(handle))
    # wrench head
    outline(im, 10, 2, 14, 6, (188, 192, 198, 255))
    rect(im, 11, 3, 13, 5, T)
    px(im, 12, 2, T)
    # glowing bit
    px(im, 3, 14, (120, 220, 200, 255))
    px(im, 2, 13, (120, 220, 200, 180))
    px(im, 6, 11, (200, 204, 210, 255))
    return im


ITEM_ICONS = {
    "li_clean_water": icon_clean_water,
    "li_dirty_water": icon_dirty_water,
    "li_boiled_water": icon_boiled_water,
    "li_canned_beans": icon_canned_beans,
    "li_canned_meat": icon_canned_meat,
    "li_bandage": icon_bandage,
    "li_first_aid": icon_first_aid,
    "li_cloth": icon_cloth,
    "li_rope": icon_rope,
    "li_scrap": icon_scrap,
    "li_battery": icon_battery,
    "li_flashlight_off": icon_flashlight_off,
    "li_flashlight_on": icon_flashlight_on,
    "li_crowbar": icon_crowbar,
    "li_keycard": icon_keycard,
    "li_bunker_key": icon_bunker_key,
    "li_radio_part": icon_radio_part,
    "li_fuel_can": icon_fuel_can,
    "li_mech_part": icon_mech_part,
    "li_nav_gear": icon_nav_gear,
    "li_flare": icon_flare,
    "li_documents": icon_documents,
    "li_matches": icon_matches,
    "li_setup_tool": icon_setup_tool,
    "li_debug_tool": icon_debug_tool,
}


# ==========================================================================
# BLOCK TEXTURES (16x16, tileable)
# ==========================================================================

def noise_base(base, spread, seed, size=16):
    im = new(size)
    rnd = random.Random(seed)
    for y in range(size):
        for x in range(size):
            j = rnd.randint(-spread, spread)
            px(im, x, y, (max(0, min(255, base[0] + j)),
                          max(0, min(255, base[1] + j)),
                          max(0, min(255, base[2] + j)), 255))
    return im


def blk_rusted_metal():
    im = noise_base((118, 112, 104), 10, 11)
    rnd = random.Random(12)
    # vertical rust streaks that tile horizontally
    for _ in range(26):
        x = rnd.randint(0, 15)
        y0 = rnd.randint(0, 11)
        h = rnd.randint(3, 5)
        c = rnd.choice([(132, 74, 38), (108, 58, 30), (148, 92, 44)])
        for y in range(y0, min(16, y0 + h)):
            px(im, x, y, (c[0], c[1], c[2], 255))
    # riveted seam rows top and bottom so it tiles vertically
    for x in range(1, 16, 4):
        px(im, x, 0, (86, 84, 80, 255))
        px(im, x, 15, (86, 84, 80, 255))
    return im


def blk_damaged_concrete():
    im = noise_base((146, 146, 142), 9, 21)
    rnd = random.Random(22)
    # exposed aggregate
    for _ in range(30):
        px(im, rnd.randint(0, 15), rnd.randint(0, 15), (112, 110, 106, 255))
    # cracks: random walks that stay inside the tile
    for _ in range(3):
        x, y = rnd.randint(2, 13), rnd.randint(1, 3)
        for _ in range(11):
            px(im, x, y, (96, 94, 92, 255))
            px(im, x + 1, y, (120, 118, 116, 255))
            y = min(15, y + 1)
            x = max(0, min(15, x + rnd.choice([-1, 0, 0, 1])))
    # chipped corner
    rect(im, 0, 14, 2, 15, (120, 118, 114, 255))
    return im


def blk_mossy_concrete():
    im = blk_damaged_concrete()
    rnd = random.Random(33)
    for _ in range(70):
        x, y = rnd.randint(0, 15), rnd.randint(0, 15)
        g = rnd.choice([(74, 104, 52), (58, 86, 42), (92, 122, 62)])
        px(im, x, y, (g[0], g[1], g[2], 255))
        if rnd.random() < 0.5:
            px(im, (x + 1) % 16, y, (g[0], g[1], g[2], 255))
    return im


def blk_lab_panel():
    im = noise_base((196, 198, 200), 5, 41)
    # panel seams
    hline(im, 0, 15, 0, (150, 152, 156, 255))
    vline(im, 0, 0, 15, (150, 152, 156, 255))
    hline(im, 0, 15, 8, (168, 170, 174, 255))
    # bolt heads
    for (bx, by) in ((2, 2), (13, 2), (2, 13), (13, 13)):
        px(im, bx, by, (128, 130, 134, 255))
        px(im, bx, by - 1, (226, 228, 230, 255))
    # scuff marks
    hline(im, 4, 9, 11, (176, 178, 180, 255))
    px(im, 7, 5, (170, 172, 176, 255))
    return im


def blk_lab_vent():
    im = noise_base((84, 86, 90), 6, 51)
    for y in range(1, 16, 3):
        hline(im, 1, 14, y, (44, 46, 50, 255))
        hline(im, 1, 14, y + 1, (108, 110, 114, 255))
    outline(im, 0, 0, 15, 15, (64, 66, 70, 255))
    for (bx, by) in ((1, 0), (14, 0), (1, 15), (14, 15)):
        px(im, bx, by, (150, 152, 156, 255))
    return im


def blk_emergency_light():
    im = noise_base((52, 54, 58), 6, 61)
    # housing frame
    outline(im, 0, 0, 15, 15, (34, 36, 40, 255))
    outline(im, 1, 1, 14, 14, (74, 76, 80, 255))
    # amber lens with a hot centre
    rect(im, 3, 5, 12, 10, (196, 132, 36, 255))
    rect(im, 4, 6, 11, 9, (238, 186, 78, 255))
    rect(im, 6, 7, 9, 8, (255, 232, 168, 255))
    # cage bars over the lens
    for x in range(3, 13, 3):
        vline(im, x, 5, 10, (40, 40, 44, 255))
    return im


SIGN_SIZE = 32


def sign_plate(bg, border, lines, textcol, seed=71, wood=False):
    """32x32 so two 4-letter words render legibly at a 2x font scale."""
    S = SIGN_SIZE
    im = noise_base(bg, 8 if not wood else 14, seed, size=S)
    if wood:
        for y in range(0, S, 9):
            hline(im, 0, S - 1, y, dark((bg[0], bg[1], bg[2], 255), 0.8)[:3] + (255,))
            hline(im, 0, S - 1, y + 1, dark((bg[0], bg[1], bg[2], 255), 0.9)[:3] + (255,))
    outline(im, 0, 0, S - 1, S - 1, border)
    outline(im, 1, 1, S - 2, S - 2, border)
    outline(im, 2, 2, S - 3, S - 3, border)
    y = 5 if len(lines) == 2 else 11
    for ln in lines:
        # 1px dark drop shadow keeps the words readable over the noisy plate
        w = text_width(ln, 1, 2)
        x = max(2, (S - w) // 2)
        text3x5(im, x + 1, y + 1, ln, (0, 0, 0, 90), 1, 2)
        text3x5(im, x, y, ln, textcol, 1, 2)
        y += 13
    return im


def blk_warning_sign_quarantine():
    # yellow/black hazard plate, "QUAR" / "ZONE" on two lines
    im = sign_plate((214, 176, 32), (34, 32, 28, 255), ["BIO", "HAZ"],
                    (30, 28, 24, 255), seed=81)
    # hazard hatching down the two side margins only, so it never crosses text
    for i in range(0, 32, 3):
        for k in range(2):
            px(im, 3 + k, (i + k) % 32, (30, 28, 24, 255))
            px(im, 28 - k, (i + k) % 32, (30, 28, 24, 255))
    return im


def blk_warning_sign_keepout():
    im = sign_plate((198, 198, 194), (150, 30, 26, 255), ["KEEP", "OUT"],
                    (150, 30, 26, 255), seed=91)
    return im


def blk_warning_sign_handwritten():
    # weathered plank with a scrawled "GO BACK"
    im = sign_plate((146, 108, 62), (92, 66, 36, 255), ["GO", "BACK"],
                    (46, 36, 28, 255), seed=101, wood=True)
    rnd = random.Random(102)
    for _ in range(56):   # weathering / splintering
        px(im, rnd.randint(0, 31), rnd.randint(0, 31), (112, 82, 46, 255))
    return im


def blk_notice_board():
    im = noise_base((124, 92, 54), 10, 111)
    outline(im, 0, 0, 15, 15, (78, 56, 32, 255))
    # pinned papers
    rect(im, 2, 2, 7, 8, (226, 222, 206, 255))
    rect(im, 8, 5, 13, 12, (214, 210, 194, 255))
    for y in (4, 6):
        hline(im, 3, 6, y, (140, 138, 130, 255))
    for y in (7, 9, 11):
        hline(im, 9, 12, y, (140, 138, 130, 255))
    px(im, 4, 2, (176, 40, 36, 255))     # pins
    px(im, 10, 5, (176, 40, 36, 255))
    return im


BLOCK_TEXTURES = {
    "li_rusted_metal": blk_rusted_metal,
    "li_damaged_concrete": blk_damaged_concrete,
    "li_mossy_concrete": blk_mossy_concrete,
    "li_lab_panel": blk_lab_panel,
    "li_lab_vent": blk_lab_vent,
    "li_emergency_light": blk_emergency_light,
    "li_warning_sign_quarantine": blk_warning_sign_quarantine,
    "li_warning_sign_keepout": blk_warning_sign_keepout,
    "li_warning_sign_handwritten": blk_warning_sign_handwritten,
    "li_notice_board": blk_notice_board,
}


# ==========================================================================
# PACK ICON (256x256) - original art: island silhouette under a storm
# ==========================================================================

def pack_icon():
    S = 256
    im = Image.new("RGBA", (S, S), (0, 0, 0, 255))
    d = ImageDraw.Draw(im)

    def overlay():
        o = Image.new("RGBA", (S, S), T)
        return o, ImageDraw.Draw(o)

    # sky gradient, storm teal into deep night
    for y in range(S):
        t = y / (S - 1)
        r = int(14 + 26 * (1 - t))
        g = int(30 + 54 * (1 - t))
        b = int(38 + 66 * (1 - t))
        d.line([(0, y), (S, y)], fill=(r, g, b, 255))
    # moon behind the clouds, with a soft halo.
    # PIL's ImageDraw REPLACES pixels (it does not blend alpha), so the halo is
    # built on its own layer and composited once.
    o, od = overlay()
    for rad in range(46, 12, -2):
        a = int(4 + (46 - rad) * 0.9)
        od.ellipse([188 - rad, 48 - rad, 188 + rad, 48 + rad],
                   fill=(150, 176, 186, min(38, a)))
    im.alpha_composite(o)
    d.ellipse([188 - 13, 48 - 13, 188 + 13, 48 + 13], fill=(214, 226, 226, 255))
    d.ellipse([188 - 9, 48 - 11, 188 + 12, 48 + 10], fill=(226, 234, 232, 255))
    # torn cloud bands crossing the moon
    for (cy, cx0, cx1, ca) in ((38, 120, 250, 210), (58, 96, 232, 190),
                               (78, 140, 256, 150), (24, 40, 180, 120)):
        o, od = overlay()
        od.rounded_rectangle([cx0, cy, cx1, cy + 9], radius=4,
                             fill=(20, 34, 42, ca))
        im.alpha_composite(o)
    # sea
    sea_y = 168
    for y in range(sea_y, S):
        t = (y - sea_y) / (S - sea_y)
        d.line([(0, y), (S, y)], fill=(int(10 + 16 * t), int(26 + 24 * t),
                                       int(34 + 30 * t), 255))
    rnd = random.Random(7)
    o, od = overlay()
    for _ in range(320):     # wave glints
        x = rnd.randint(0, S - 1)
        y = rnd.randint(sea_y, S - 1)
        od.point((x, y), fill=(150, 180, 190, rnd.randint(20, 70)))
    im.alpha_composite(o)
    # island silhouette
    ridge = []
    for x in range(0, S + 1, 8):
        h = (28 * (1 - abs(x - 118) / 150.0)
             + 16 * (1 - abs(x - 190) / 90.0)
             + 8 * ((x * 37) % 11) / 11.0)
        ridge.append((x, sea_y - max(2, h)))
    d.polygon([(0, S)] + ridge + [(S, S)], fill=(9, 18, 20, 255))
    # tree line
    for _ in range(90):
        x = rnd.randint(4, S - 5)
        base = sea_y - 4 - rnd.randint(0, 16)
        ht = rnd.randint(6, 16)
        d.line([(x, base), (x, base - ht)], fill=(6, 13, 14, 255))
        d.ellipse([x - 4, base - ht - 4, x + 4, base - ht + 3],
                  fill=(7, 15, 16, 255))
    # lighthouse on the right headland with a beam
    lx, ly = 206, sea_y - 30
    d.polygon([(lx - 5, ly + 30), (lx + 5, ly + 30), (lx + 3, ly), (lx - 3, ly)],
              fill=(28, 32, 34, 255))
    d.rectangle([lx - 4, ly - 7, lx + 4, ly], fill=(20, 24, 26, 255))
    d.rectangle([lx - 2, ly - 5, lx + 2, ly - 1], fill=(255, 226, 150, 255))
    # beam sweeping left, as one composited wedge
    o, od = overlay()
    od.polygon([(lx - 2, ly - 4), (lx - 150, ly - 74), (lx - 150, ly - 24)],
               fill=(255, 228, 160, 34))
    od.polygon([(lx - 2, ly - 4), (lx - 150, ly - 60), (lx - 150, ly - 38)],
               fill=(255, 232, 176, 30))
    im.alpha_composite(o)
    o, od = overlay()
    for rad in range(18, 3, -2):     # lamp glow
        od.ellipse([lx - rad, ly - 3 - rad, lx + rad, ly - 3 + rad],
                   fill=(255, 226, 150, 22))
    im.alpha_composite(o)
    # rain
    o, od = overlay()
    for _ in range(520):
        x = rnd.randint(0, S - 1)
        y = rnd.randint(0, S - 1)
        od.line([(x, y), (x - 2, y + 7)],
                fill=(170, 195, 205, rnd.randint(16, 44)))
    im.alpha_composite(o)
    # title bar
    o, od = overlay()
    od.rectangle([0, 196, S, 256], fill=(4, 8, 10, 195))
    im.alpha_composite(o)
    d.line([(0, 196), (S, 196)], fill=(150, 122, 52, 255))
    return im


def draw_title(im):
    """'LOST ISLAND' in the 3x5 font, scaled up, so no font files are needed."""
    tmp = new(80)
    text3x5(tmp, 1, 1, "LOST ISLAND", (238, 230, 202, 255))
    tmp = tmp.crop((0, 0, text_width("LOST ISLAND") + 2, 7))
    tmp = tmp.resize((tmp.width * 4, tmp.height * 4), Image.NEAREST)
    im.alpha_composite(tmp, (max(0, (256 - tmp.width) // 2), 202))
    tmp2 = new(80)
    text3x5(tmp2, 1, 1, "ABANDONED", (196, 154, 58, 255))
    tmp2 = tmp2.crop((0, 0, text_width("ABANDONED") + 2, 7))
    tmp2 = tmp2.resize((tmp2.width * 3, tmp2.height * 3), Image.NEAREST)
    im.alpha_composite(tmp2, (max(0, (256 - tmp2.width) // 2), 232))
    return im


def main():
    for name, fn in ITEM_ICONS.items():
        save(fn(), ITEM_DIR, name)
    for name, fn in BLOCK_TEXTURES.items():
        save(fn(), BLOCK_DIR, name)

    icon = draw_title(pack_icon())
    for pack in ("Lost_Island_BP", "Lost_Island_RP"):
        icon.save(os.path.join(ROOT, "build", pack, "pack_icon.png"))

    # ---- atlases -----------------------------------------------------------
    item_data = {}
    for name in ITEM_ICONS:
        item_data[name] = {"textures": "textures/items/" + name}
    with open(os.path.join(RP, "textures", "item_texture.json"), "w") as f:
        json.dump({"resource_pack_name": "lost_island",
                   "texture_name": "atlas.items",
                   "texture_data": item_data}, f, indent=2)

    terrain_data = {}
    for name in BLOCK_TEXTURES:
        terrain_data[name] = {"textures": "textures/blocks/" + name}
    with open(os.path.join(RP, "textures", "terrain_texture.json"), "w") as f:
        json.dump({"resource_pack_name": "lost_island",
                   "texture_name": "atlas.terrain",
                   "padding": 8, "num_mip_levels": 4,
                   "texture_data": terrain_data}, f, indent=2)

    print("item icons     : %d (16x16)" % len(ITEM_ICONS))
    print("block textures : %d (16x16)" % len(BLOCK_TEXTURES))
    print("pack icons     : 2 (256x256)")


if __name__ == "__main__":
    main()
