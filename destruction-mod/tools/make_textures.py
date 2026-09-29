#!/usr/bin/env python3
"""Draws every texture used by the Destruction Mod.

Pure Python (no Pillow needed). Writes 16x16 item icons, a few UI icons for
the menus, and the 128x128 pack icons straight into the pack folders.

    python3 tools/make_textures.py            # write textures
    python3 tools/make_textures.py --preview  # also write build/preview.png
"""
import math
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "packs", "DestructionMod_RP")
BP = os.path.join(ROOT, "packs", "DestructionMod_BP")

CLEAR = (0, 0, 0, 0)


def hexc(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


PALETTE = {
    ".": CLEAR,
    "K": hexc("1c1c1c"),  # outline
    "k": hexc("3a3a3a"),  # dark grey
    "g": hexc("6e6e6e"),  # grey
    "G": hexc("b8b8b8"),  # light grey
    "W": hexc("ffffff"),  # white
    "w": hexc("dcdcdc"),  # off white
    "x": hexc("000000"),  # black
    "b": hexc("4a2f1b"),  # dark wood
    "B": hexc("8a5a2e"),  # wood
    "n": hexc("b07a45"),  # light wood
    "r": hexc("8b1414"),  # dark red
    "R": hexc("dc2f2f"),  # red
    "f": hexc("c43d08"),  # deep flame
    "o": hexc("f77f00"),  # orange
    "O": hexc("ffa62b"),  # light orange
    "y": hexc("e0a800"),  # dark yellow
    "Y": hexc("ffe135"),  # yellow
    "q": hexc("a86f00"),  # dark gold
    "Q": hexc("ffcf3a"),  # gold
    "z": hexc("12002b"),  # void purple-black
    "u": hexc("3c096c"),  # dark purple
    "U": hexc("7b2cbf"),  # purple
    "v": hexc("c77dff"),  # light violet
    "m": hexc("f15bb5"),  # magenta
    "c": hexc("0077b6"),  # dark cyan
    "C": hexc("48cae4"),  # cyan
    "a": hexc("caf0f8"),  # pale aqua
    "l": hexc("1d4ed8"),  # blue
    "L": hexc("60a5fa"),  # light blue
    "e": hexc("2d6a4f"),  # dark green
    "E": hexc("52b788"),  # green
    "s": hexc("4f4f4f"),  # dark stone
    "S": hexc("8f8f8f"),  # stone
    "t": hexc("a3a3a3"),  # stone highlight
    "Z": hexc("0b2f3f"),  # screen
    "T": hexc("2dd4bf"),  # screen glow
}


class Canvas:
    def __init__(self, w=16, h=16):
        self.w, self.h = w, h
        self.px = [[CLEAR for _ in range(w)] for _ in range(h)]

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[y][x]
        return CLEAR

    def disc(self, cx, cy, r, c):
        for y in range(self.h):
            for x in range(self.w):
                if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                    self.set(x, y, c)

    def outline(self, c):
        """Adds a 1px outline around every opaque pixel (4-neighbourhood)."""
        add = []
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x][3] != 0:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if self.get(x + dx, y + dy)[3] != 0 and self.get(x + dx, y + dy) != c:
                        add.append((x, y))
                        break
        for x, y in add:
            self.set(x, y, c)

    def scaled(self, k):
        out = Canvas(self.w * k, self.h * k)
        for y in range(out.h):
            for x in range(out.w):
                out.px[y][x] = self.px[y // k][x // k]
        return out

    def paste(self, other, ox, oy):
        for y in range(other.h):
            for x in range(other.w):
                c = other.px[y][x]
                if c[3]:
                    self.set(ox + x, oy + y, c)

    def png(self):
        raw = bytearray()
        for row in self.px:
            raw.append(0)
            for c in row:
                raw.extend(c)

        def chunk(tag, data):
            body = tag + data
            return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

        header = struct.pack(">IIBBBBB", self.w, self.h, 8, 6, 0, 0, 0)
        return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
                + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))

    def save(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(self.png())


def from_map(rows):
    assert len(rows) == 16, f"need 16 rows, got {len(rows)}"
    cv = Canvas()
    for y, row in enumerate(rows):
        assert len(row) == 16, f"row {y} has {len(row)} chars: {row!r}"
        for x, ch in enumerate(row):
            cv.set(x, y, PALETTE[ch])
    return cv


# --------------------------------------------------------------------------
# Item icons (16x16)
# --------------------------------------------------------------------------
ICONS = {}

ICONS["mega_tnt_wand"] = from_map([
    "..........Y.....",
    "..........k.Y...",
    "........KKkKKKK.",
    "........KRrRrRK.",
    "........KRrRrRK.",
    "........KWWWWWK.",
    "........KxWxWxK.",
    "........KWWWWWK.",
    "........KRrRrRK.",
    "........KKKKKKK.",
    ".......Bb.......",
    "......Bb........",
    ".....Bb.........",
    "....Bb..........",
    "...Bb...........",
    "..Bb............",
])

ICONS["meteor_staff"] = from_map([
    "..........FF.F..".replace("F", "o"),
    ".........fOfOo..",
    "........foOYOof.",
    "........oOYWYOo.",
    "........oYWWYOo.",
    "........foYYOof.",
    ".........foOof..",
    "........qQff....",
    ".......qQ.......",
    "......qQ........",
    ".....qQ.........",
    "....qQ..........",
    "...qQ...........",
    "..qQ............",
    ".qQ.............",
    "qq..............",
])

ICONS["thunder_staff"] = from_map([
    "............KKK.",
    "...........KYYK.",
    "..........KYYK..",
    ".........KYYKKK.",
    "........KYWYYYK.",
    "........KKKYYK..",
    "..........KYK...",
    ".........KYK....",
    "........gKK.....",
    ".......gG.......",
    "......gG........",
    ".....gG.........",
    "....gG..........",
    "...gG...........",
    "..gG............",
    ".gg.............",
])

ICONS["black_hole_orb"] = from_map([
    "..W.............",
    ".....uuuuuu.....",
    "...uuUUzzUUuu...",
    "..uUzzzzzzzzUu..",
    "..uzzxxxxxxzzu..",
    ".uUzxxxxxxxxzUu.",
    ".UzxxxxxxxxxxzU.",
    "vmmvvxxxxxxvvmmv",
    "mmvvvvvvvvvvvvmm",
    ".vvzxxxxxxxxzvv.",
    ".uUzxxxxxxxxzUu.",
    "..uzzxxxxxxzzu..",
    "..uUzzzzzzzzUu..",
    "...uuUUzzUUuu...",
    ".....uuuuuu.....",
    ".............W..",
])

ICONS["earthquake_hammer"] = from_map([
    "................",
    ".KKKKKKKKKKKKKK.",
    ".KtSSSsSSSStSSK.",
    ".KSsSSSoSSSsSSK.",
    ".KSSSSoSSSSSStK.",
    ".KsSSSSooSSSsSK.",
    ".KSSSSSSSoSSSSK.",
    ".KKKKKKBbKKKKKK.",
    ".......Bb.......",
    ".......Bb.......",
    ".......Bb.......",
    ".......Bb.......",
    ".......Bb.......",
    ".......Bb.......",
    ".......nb.......",
    ".......KK.......",
])

ICONS["tornado_wand"] = from_map([
    "..............B.",
    ".GGWWWWWWWWWGG..",
    "..gGGGWWWGGGg...",
    "B..WWWGGGWWW....",
    "....gGGWWGGg....",
    ".....WWGGWW...E.",
    ".....gGWWGg.....",
    "......WGGW......",
    "......gWWg......",
    ".......GW.......",
    ".......Wg.......",
    "......gW........",
    "......W.........",
    ".....bE.........",
    "....BbEe........",
    "................",
])

ICONS["sky_beam_staff"] = from_map([
    "...........W....",
    "..........KaK...",
    ".........KaCCK..",
    "........KaCCCcK.",
    ".........KCCcK..",
    "..........KcK...",
    ".........uUK....",
    "........uU......",
    ".......uU.......",
    "......uU........",
    ".....uU.........",
    "....uU..........",
    "...uU...........",
    "..uU............",
    ".uU.............",
    "uu..............",
])

ICONS["tnt_rain_wand"] = from_map([
    "................",
    ".....GGGG.......",
    "...GGWWWWGG.....",
    "..GWWWWWWWWGGG..",
    ".GWWWWWWWWWWWWG.",
    ".GgWWWWWWWWWWgG.",
    "..gggggggggggg..",
    "..G.........G...",
    ".rRRr......rRRr.",
    ".WWWW......WWWW.",
    ".rRRr...G..rRRr.",
    "........G.......",
    "......rRRr......",
    "......WWWW......",
    "......rRRr......",
    "................",
])

ICONS["shockwave_core"] = from_map([
    "................",
    ".....LLLLLL.....",
    "...LL......LL...",
    "..L...aaaa...L..",
    ".L..aa....aa..L.",
    ".L.a..CCCC..a.L.",
    "L..a.C.WW.C.a..L",
    "L.a.C.WWWW.C.a.L",
    "L.a.C.WWWW.C.a.L",
    "L..a.C.WW.C.a..L",
    ".L.a..CCCC..a.L.",
    ".L..aa....aa..L.",
    "..L...aaaa...L..",
    "...LL......LL...",
    ".....LLLLLL.....",
    "................",
])

ICONS["crater_wand"] = from_map([
    "..........UUU...",
    ".........UzxxU..",
    "........UzxxxxU.",
    "........UxxxxWU.",
    "........UxxxxxU.",
    ".........UxxxU..",
    ".........vUUU...",
    "........vu......",
    ".......vu.......",
    "......vu........",
    ".....vu.........",
    "....vu..........",
    "...vu...........",
    "..vu............",
    ".vu.............",
    "uu..............",
])

ICONS["control_tablet"] = from_map([
    "................",
    ".kkkkkkkkkkkkkk.",
    ".kggggggggggggk.",
    ".kgZZZZZZZZZZgk.",
    ".kgZZZZRZZZZZgk.",
    ".kgZZZRZRZZZZgk.",
    ".kgZRRZYZRRZZgk.",
    ".kgZZZRZRZZZZgk.",
    ".kgZZZZRZZZZZgk.",
    ".kgZZZZZZZTTZgk.",
    ".kggggggggggggk.",
    ".kgRgYgEggggggk.",
    ".kggggggggggggk.",
    ".kkkkkkkkkkkkkk.",
    "................",
    "................",
])


def target_icon():
    cv = Canvas()
    cv.disc(8, 8, 7.0, PALETTE["R"])
    cv.disc(8, 8, 5.6, PALETTE["W"])
    cv.disc(8, 8, 4.1, PALETTE["R"])
    cv.disc(8, 8, 2.6, PALETTE["W"])
    cv.disc(8, 8, 1.3, PALETTE["r"])
    cv.outline(PALETTE["K"])
    return cv


ICONS["target_marker"] = target_icon()

# --------------------------------------------------------------------------
# Menu icons (16x16, shown on form buttons)
# --------------------------------------------------------------------------
UI = {}

UI["stop"] = from_map([
    "................",
    ".....KKKKKK.....",
    "....KRRRRRRK....",
    "...KRRRRRRRRK...",
    "..KRRRRRRRRRRK..",
    ".KRRRRRRRRRRRRK.",
    ".KRWWWWWWWWWWRK.",
    ".KRWWWWWWWWWWRK.",
    ".KRRRRRRRRRRRRK.",
    ".KRRRRRRRRRRRRK.",
    "..KRRRRRRRRRRK..",
    "...KRRRRRRRRK...",
    "....KRRRRRRK....",
    ".....KKKKKK.....",
    "................",
    "................",
])

UI["gear"] = from_map([
    "................",
    ".......GG.......",
    "...GG.GGGG.GG...",
    "...GGGGGGGGGG...",
    "....GGGggGGG....",
    "..GGGGg..gGGGG..",
    ".GGGGg....gGGGG.",
    ".GGGg......gGGG.",
    "..GGg......gGG..",
    "..GGGg....gGGG..",
    "...GGGg..gGGG...",
    "..GGGGGggGGGGG..",
    "...GG.GGGG.GG...",
    ".......GG.......",
    "................",
    "................",
])

UI["help"] = from_map([
    "................",
    ".....llllll.....",
    "...llLLLLLLll...",
    "..lLLLWWWWLLLl..",
    "..lLLWWLLWWLLl..",
    ".lLLLLLLLWWLLLl.",
    ".lLLLLLLWWLLLLl.",
    ".lLLLLLWWLLLLLl.",
    ".lLLLLLWWLLLLLl.",
    ".lLLLLLLLLLLLLl.",
    "..lLLLLWWLLLLl..",
    "..lLLLLWWLLLLl..",
    "...llLLLLLLll...",
    ".....llllll.....",
    "................",
    "................",
])

UI["kit"] = from_map([
    "................",
    "................",
    "..KKKKKKKKKKKK..",
    "..KnnnnnnnnnnK..",
    "..KnBBBBBBBBnK..",
    "..KnBBBBBBBBnK..",
    "..KKKKKGGKKKKK..",
    "..KnnnnGGnnnnK..",
    "..KnBBBBBBBBnK..",
    "..KnBBBBBBBBnK..",
    "..KnBBBBBBBBnK..",
    "..KnnnnnnnnnnK..",
    "..KKKKKKKKKKKK..",
    "................",
    "................",
    "................",
])


UI["gear"].outline(PALETTE["k"])

UI["eye"] = from_map([
    "................",
    "................",
    "................",
    ".....KKKKKK.....",
    "...KKWWWWWWKK...",
    "..KWWWWLLWWWWK..",
    ".KWWWWLllLWWWWK.",
    ".KWWWLlxxlLWWWK.",
    ".KWWWLlxxlLWWWK.",
    ".KWWWWLllLWWWWK.",
    "..KWWWWLLWWWWK..",
    "...KKWWWWWWKK...",
    ".....KKKKKK.....",
    "................",
    "................",
    "................",
])

UI["coords"] = from_map([
    "................",
    ".KKKKKKKKKKKKKK.",
    ".KWWWWWWWWWWWWK.",
    ".KWRRWWWWWWWWWK.",
    ".KWWRWRWWWWWWWK.",
    ".KWWWRWWWWWWWWK.",
    ".KWWRWRWWWWWWWK.",
    ".KWRRWWWEEWEEWK.",
    ".KWWWWWWWEWEWWK.",
    ".KWlWlWWWEEEWWK.",
    ".KWWlWWWWWWWWWK.",
    ".KWWlWWWWWWWWWK.",
    ".KWWWWWWWWWWWWK.",
    ".KKKKKKKKKKKKKK.",
    "................",
    "................",
])

UI["player"] = from_map([
    "................",
    "....KKKKKKKK....",
    "....KbbbbbbK....",
    "....KbnnnnbK....",
    "....KnWxxWnK....",
    "....KnnnnnnK....",
    "....KnnbbnnK....",
    "....KKKKKKKK....",
    "..KKKKKKKKKKKK..",
    "..KcCCCCCCCCcK..",
    "..KcCCCCCCCCcK..",
    "..KnKCCCCCCKnK..",
    "..KnKllllllKnK..",
    "....KllKKllK....",
    "....KllK.KllK...",
    "....KKKK.KKKK...",
])

UI["dice"] = from_map([
    "................",
    "................",
    "..KKKKKKKKKKKK..",
    "..KWWWWWWWWWWK..",
    "..KWxxWWWWWWWK..",
    "..KWxxWWWWWWWK..",
    "..KWWWWWWWWWWK..",
    "..KWWWWxxWWWWK..",
    "..KWWWWxxWWWWK..",
    "..KWWWWWWWWWWK..",
    "..KWWWWWWWxxWK..",
    "..KWWWWWWWxxWK..",
    "..KWWWWWWWWWWK..",
    "..KKKKKKKKKKKK..",
    "................",
    "................",
])

# --------------------------------------------------------------------------
# Pack icon (drawn at 32x32, scaled to 128x128)
# --------------------------------------------------------------------------
def pack_icon():
    cv = Canvas(32, 32)
    bg_top, bg_bot = hexc("2a0d0d"), hexc("0d0d14")
    for y in range(32):
        t = y / 31
        col = tuple(int(bg_top[i] * (1 - t) + bg_bot[i] * t) for i in range(3)) + (255,)
        for x in range(32):
            # rounded corners
            cx = min(x, 31 - x)
            cy = min(y, 31 - y)
            if cx + cy < 3:
                continue
            cv.set(x, y, col)
    cx, cy = 16, 15
    layers = [(1.0, hexc("b3160f")), (0.78, hexc("f25c05")), (0.56, hexc("ffae00")),
              (0.34, hexc("ffe66d")), (0.14, hexc("ffffff"))]
    for y in range(32):
        for x in range(32):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            ang = math.atan2(dy, dx)
            spike = ((1 + math.cos(10 * ang)) / 2) ** 2
            wobble = 0.8 * math.sin(3 * ang + 1.3)
            r = 8.5 + 5.5 * spike + wobble
            for frac, col in layers:
                if d <= r * frac:
                    cv.set(x, y, col)
    # debris
    for (x, y, ch) in [(26, 5, "o"), (27, 4, "Y"), (5, 6, "o"), (28, 24, "f"), (24, 27, "o"), (4, 15, "f")]:
        cv.set(x, y, PALETTE[ch])
    return cv.scaled(4)


def main():
    for name, cv in ICONS.items():
        cv.save(os.path.join(RP, "textures", "items", "destruct", f"{name}.png"))
    for name, cv in UI.items():
        cv.save(os.path.join(RP, "textures", "ui", "destruct", f"{name}.png"))
    icon = pack_icon()
    icon.save(os.path.join(RP, "pack_icon.png"))
    icon.save(os.path.join(BP, "pack_icon.png"))
    print(f"wrote {len(ICONS)} item icons, {len(UI)} menu icons, 2 pack icons")

    if "--preview" in sys.argv:
        tiles = list(ICONS.values()) + list(UI.values())
        cols = 6
        rows = math.ceil(len(tiles) / cols)
        k = 8
        sheet = Canvas(cols * (16 * k + 8) + 8, rows * (16 * k + 8) + 8 + 136)
        for y in range(sheet.h):
            for x in range(sheet.w):
                sheet.px[y][x] = hexc("c6c6c6") if ((x // 8) + (y // 8)) % 2 else hexc("8b8b8b")
        for i, cv in enumerate(tiles):
            sheet.paste(cv.scaled(k), 8 + (i % cols) * (16 * k + 8), 8 + (i // cols) * (16 * k + 8))
        sheet.paste(icon, 8, 8 + rows * (16 * k + 8))
        out = os.path.join(ROOT, "build", "preview.png")
        sheet.save(out)
        print("preview:", out)


if __name__ == "__main__":
    main()
