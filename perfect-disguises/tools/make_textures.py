#!/usr/bin/env python3
"""
Draws every texture used by Perfect Disguises (all original pixel art):

  RP textures/pd/items/disguise_wand.png   16x16 item icon
  RP textures/pd/ui/<mob>.png               64x64 menu icons (mob faces)
  RP textures/pd/ui/{ability,remove,settings,help,back}.png
  BP/RP pack_icon.png                       256x256

Usage:  python3 tools/make_textures.py
"""

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "packs", "PerfectDisguises_RP")
BP = os.path.join(ROOT, "packs", "PerfectDisguises_BP")


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def grid_image(rows, palette):
    h, w = len(rows), len(rows[0])
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        assert len(row) == w, (row, w)
        for x, ch in enumerate(row):
            if ch != ".":
                px[x, y] = hexc(palette[ch])
    return img


def upscale(img, size):
    return img.resize((size, size), Image.NEAREST)


def save(img, *parts):
    path = os.path.join(*parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    print("wrote", os.path.relpath(path, ROOT))


# ---------------------------------------------------------------------------
WAND = [
    "................",
    "............w...",
    "...........wPw..",
    "..........wPpPw.",
    ".........wPPPPPw",
    "..........wPPPw.",
    "..........GwPw..",
    ".........GGGw...",
    "........bGG.....",
    ".......bBb......",
    "......bBb.......",
    ".....bBb........",
    "....bBb.........",
    "...bBb..........",
    "..bBb...........",
    "..bb............",
]
WAND_PAL = {"w": "#3B1466", "P": "#9B4DFF", "p": "#F3E3FF", "G": "#F5C542",
            "B": "#9C6B3C", "b": "#5E3B1E"}

# 8x8 mob faces ------------------------------------------------------------
FACES = {
    "zombie": ([
        "GgGGGGgG",
        "GGGgGGGG",
        "GGGGGGgG",
        "GeeGGeeG",
        "GGGnnGGG",
        "GgmmmmgG",
        "GGGGGGGG",
        "gGGGgGGG",
    ], {"G": "#5F9B45", "g": "#4A7D35", "e": "#1C2E22", "n": "#3E6B2C", "m": "#2F4F22"}),
    "skeleton": ([
        "WWWWWWWW",
        "WwWWWWwW",
        "WWWWWWWW",
        "WkkWWkkW",
        "WkkWWkkW",
        "WWWkkWWW",
        "WkwkwkwW",
        "WWWWWWWW",
    ], {"W": "#D6D6D6", "w": "#B5B5B5", "k": "#2A2A2A"}),
    "creeper": ([
        "cCcCCcCC",
        "CcCCcCCc",
        "CkkCCkkC",
        "CkkCCkkC",
        "CCCkkCCC",
        "CCkkkkCC",
        "CCkkkkCC",
        "CCkCCkCC",
    ], {"C": "#5BC24A", "c": "#3E9B33", "k": "#111111"}),
    "spider": ([
        "kkkkkkkk",
        "kSkkkkSk",
        "kkkkkkkk",
        "krRkkRrk",
        "kkkkkkkk",
        "kkrkkrkk",
        "kSkkkkSk",
        "kkkkkkkk",
    ], {"k": "#2B2422", "S": "#3F3533", "R": "#E31B1B", "r": "#8E0F0F"}),
    "enderman": ([
        "kKkkkkKk",
        "kkkkkkkk",
        "kkKkkkkk",
        "kkkkkKkk",
        "pMMkkMMp",
        "kkkkkkkk",
        "kKkkkkKk",
        "kkkkkkkk",
    ], {"k": "#141414", "K": "#202020", "M": "#CC00FA", "p": "#E79CFF"}),
    "villager": ([
        "SSSSSSSS",
        "ssssssss",
        "ssssssss",
        "sbbbbbbs",
        "swgssgws",
        "sssNNsss",
        "sssNNsss",
        "sssNNsss",
    ], {"S": "#A97A62", "s": "#BD8B72", "b": "#4A3328", "w": "#FFFFFF", "g": "#3C8E2A", "N": "#9E6A52"}),
    "pig": ([
        "pppppppp",
        "pqpppppp",
        "pwkppkwp",
        "pppppppp",
        "ppSSSSpp",
        "ppnSSnpp",
        "ppSSSSpp",
        "pppppqpp",
    ], {"p": "#F0A3A6", "q": "#E39397", "w": "#FFFFFF", "k": "#1A1A1A", "S": "#E8848D", "n": "#9E4B52"}),
    "cow": ([
        "kkkkkkkk",
        "kkwwwwkk",
        "kewwwwek",
        "kkwwwwkk",
        "kkkwwkkk",
        "kPPPPPPk",
        "kPnPPnPk",
        "kPPPPPPk",
    ], {"k": "#3D2E22", "w": "#E8E8E8", "e": "#0A0A0A", "P": "#C9B8A4", "n": "#6E5E50"}),
    "sheep": ([
        "WWWWWWWW",
        "WwWWWWwW",
        "WFFFFFFW",
        "WkFFFFkW",
        "WFFFFFFW",
        "WFFnnFFW",
        "WWFFFFWW",
        "WWWWWWWW",
    ], {"W": "#EDEDED", "w": "#D4D4D4", "F": "#DFC6AE", "k": "#1A1A1A", "n": "#C08A7C"}),
    "wolf": ([
        "GGggggGG",
        "gggggggg",
        "gkggggkg",
        "gggggggg",
        "ggMnnMgg",
        "ggMMMMgg",
        "ggMMMMgg",
        "gggggggg",
    ], {"G": "#9E9796", "g": "#DCD7D6", "k": "#111111", "M": "#C8C1BF", "n": "#111111"}),
    "chicken": ([
        "WWWWWWWW",
        "WWWWWWWW",
        "WkWWWWkW",
        "WWYYYYWW",
        "WWYyyYWW",
        "WWWRRWWW",
        "WWWRRWWW",
        "wwwwwwww",
    ], {"W": "#FAFAFA", "w": "#DEDEDE", "k": "#111111", "Y": "#F2B230", "y": "#C98A1E", "R": "#E01414"}),
    "bee": ([
        "YkYYYYkY",
        "YYkYYkYY",
        "YYYYYYYY",
        "kkYYYYkk",
        "kkYYYYkk",
        "kkYyyYkk",
        "YYYbbYYY",
        "yYYYYYYy",
    ], {"Y": "#F4C430", "y": "#D9A520", "k": "#1E1E1E", "b": "#6B4A1E"}),
}

# 16x16 menu icons ---------------------------------------------------------
UI = {
    "ability": ([
        "................",
        ".......oo.......",
        ".......oo.......",
        "......oyyo......",
        "......oyyo......",
        ".....oyYYyo.....",
        "ooooooyYYyoooooo",
        "oyyyyyYYYYyyyyyo",
        ".oyYYYYYYYYYYyo.",
        "..oyYYYYYYYYyo..",
        "...oyYYYYYYyo...",
        "...oyYYYYYYyo...",
        "..oyYYYooYYYyo..",
        "..oyYYo..oYYyo..",
        ".oyYoo....ooYyo.",
        ".ooo........ooo.",
    ], {"o": "#7A4B00", "y": "#FFD84A", "Y": "#FFF2A8"}),
    "remove": ([
        "................",
        ".oo..........oo.",
        "oRRo........oRRo",
        "oRrRo......oRrRo",
        ".oRrRo....oRrRo.",
        "..oRrRo..oRrRo..",
        "...oRrRooRrRo...",
        "....oRrRRrRo....",
        "....oRrRRrRo....",
        "...oRrRooRrRo...",
        "..oRrRo..oRrRo..",
        ".oRrRo....oRrRo.",
        "oRrRo......oRrRo",
        "oRRo........oRRo",
        ".oo..........oo.",
        "................",
    ], {"o": "#4A0000", "R": "#E53935", "r": "#FF8A80"}),
    "settings": ([
        "................",
        "......oooo......",
        "......oGGo......",
        "..oo.oGGGGo.oo..",
        "..oGooGGGGooGo..",
        "...oGGGGGGGGo...",
        ".ooGGGGooGGGGoo.",
        ".oGGGGo..oGGGGo.",
        ".oGGGGo..oGGGGo.",
        ".ooGGGGooGGGGoo.",
        "...oGGGGGGGGo...",
        "..oGooGGGGooGo..",
        "..oo.oGGGGo.oo..",
        "......oGGo......",
        "......oooo......",
        "................",
    ], {"o": "#2E2E2E", "G": "#A8A8A8"}),
    "help": ([
        "................",
        ".....oooooo.....",
        "...ooBBBBBBoo...",
        "..oBBBWWWWBBBo..",
        ".oBBBWWBBWWBBBo.",
        ".oBBBBBBBWWBBBo.",
        "oBBBBBBBWWBBBBBo",
        "oBBBBBBWWBBBBBBo",
        "oBBBBBWWBBBBBBBo",
        "oBBBBBWWBBBBBBBo",
        ".oBBBBBBBBBBBBo.",
        ".oBBBBBWWBBBBBo.",
        "..oBBBBWWBBBBo..",
        "...ooBBBBBBoo...",
        ".....oooooo.....",
        "................",
    ], {"o": "#0D2B5E", "B": "#2F6FD6", "W": "#FFFFFF"}),
    "back": ([
        "................",
        "................",
        "......oo........",
        ".....oGo........",
        "....oGGo........",
        "...oGGGooooooo..",
        "..oGGGGGGGGGGGo.",
        ".oGGGGGGGGGGGGo.",
        ".oGGGGGGGGGGGGo.",
        "..oGGGGGGGGGGGo.",
        "...oGGGooooooo..",
        "....oGGo........",
        ".....oGo........",
        "......oo........",
        "................",
        "................",
    ], {"o": "#1B4D1B", "G": "#4CAF50"}),
}


def face_icon(key):
    rows, pal = FACES[key]
    face = grid_image(rows, pal)
    big = upscale(face, 56)
    icon = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    border = Image.new("RGBA", (60, 60), (20, 20, 20, 255))
    icon.alpha_composite(border, (2, 2))
    icon.alpha_composite(big, (4, 4))
    return icon


def pack_icon():
    size = 256
    img = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    # vertical purple gradient
    for y in range(size):
        t = y / (size - 1)
        r = int(70 * (1 - t) + 25 * t)
        g = int(30 * (1 - t) + 10 * t)
        b = int(120 * (1 - t) + 60 * t)
        d.line([(0, y), (size, y)], fill=(r, g, b, 255))
    # 3x3 mob face mosaic
    keys = ["creeper", "zombie", "pig", "enderman", "villager", "sheep", "spider", "chicken", "skeleton"]
    cell, gap = 64, 10
    total = cell * 3 + gap * 2
    ox = (size - total) // 2
    for i, key in enumerate(keys):
        cx = ox + (i % 3) * (cell + gap)
        cy = ox + (i // 3) * (cell + gap)
        d.rectangle([cx - 3, cy - 3, cx + cell + 2, cy + cell + 2], fill=(15, 8, 30, 255))
        img.alpha_composite(upscale(grid_image(*FACES[key]), cell), (cx, cy))
    # wand across the mosaic
    wand = upscale(grid_image(WAND, WAND_PAL), 176)
    shadow = Image.new("RGBA", wand.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 150), (0, 0), wand)
    img.alpha_composite(shadow, (54, 54))
    img.alpha_composite(wand, (46, 46))
    return img


def main():
    save(grid_image(WAND, WAND_PAL), RP, "textures", "pd", "items", "disguise_wand.png")
    for key in FACES:
        save(face_icon(key), RP, "textures", "pd", "ui", key + ".png")
    for key, (rows, pal) in UI.items():
        save(upscale(grid_image(rows, pal), 64), RP, "textures", "pd", "ui", key + ".png")
    icon = pack_icon()
    save(icon, RP, "pack_icon.png")
    save(icon, BP, "pack_icon.png")


if __name__ == "__main__":
    main()
