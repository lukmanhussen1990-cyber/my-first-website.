"""Review board for the supporting graphics designed in engine/graphics.py.

usage: .venv/bin/python -I tools/graphics_board.py   -> out/review/graphics_board.png
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from engine import graphics as g  # noqa: E402
from engine import svg  # noqa: E402

NUNITO = ROOT / "assets/fonts/nunito/Nunito[wght].ttf"
OUT = ROOT / "out/review/graphics_board.png"
W, H = 1920, 1500
LABEL = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Regular.otf", 17)
HEAD = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-SemiBold.otf", 22)


def nunito(size, wght):
    f = ImageFont.truetype(str(NUNITO), size, layout_engine=ImageFont.Layout.RAQM)
    f.set_variation_by_axes([wght])
    return f


def T(sx, tx, ty, sy=None):
    return np.array([[sx, 0, tx], [0, sy if sy is not None else sx, ty], [0, 0, 1.0]])


def moved(shapes, M):
    return [svg.Shape(s.index, s.tag, s.fill, s.alpha, s.rule, g.xform(s.contours, M)) for s in shapes]


def main():
    shapes, texts = [], []

    def label(x, y, t):
        texts.append(((x, y), t, LABEL, (150, 162, 168), "la"))

    # --- row 1: flag tiles (face + lip) -----------------------------------
    texts.append(((40, 30), "Flags (orbit the Languages node) · rounded 4:3 tiles, real geometry lip in film", HEAD, (226, 232, 235), "la"))
    for i, code in enumerate(g.FLAGS):
        x, y, s = 40 + i * 232, 80, 1.6
        shapes.append(g.shape(g.SURFACE, g.xform([g.rrect(0, 10, g.FLAG_W, g.FLAG_H, g.FLAG_R)], T(s, x, y))))
        shapes += moved(g.flag(code), T(s, x, y))
        label(x, y + 170, {"es": "Spanish", "fr": "French", "jp": "Japanese", "de": "German", "it": "Italian",
                           "kr": "Korean", "br": "Portuguese", "cn": "Chinese"}[code])

    # --- row 2: course medallions + glyphs ---------------------------------
    texts.append(((40, 300), "Course nodes (Languages, Math, Music, Chess) · glyphs stand on the node tops in film", HEAD, (226, 232, 235), "la"))
    pi = g.font_glyph("π", NUNITO, 1000, g.WHITE)
    courses = [("Languages", g.FEATHER, None, g.WHITE), ("Math", g.MATH, pi, g.WHITE),
               ("Music", g.MUSIC, g.NOTE, g.WHITE), ("Chess", g.WHITE, g.KNIGHT, g.SURFACE)]
    for i, (name, col, glyph, ink) in enumerate(courses):
        cx, cy, r = 140 + i * 300, 440, 92
        shapes.append(g.shape(g.lip(col), g.circle(cx, cy + 16, r, 160)))
        shapes.append(g.shape(col, g.circle(cx, cy, r, 160)))
        shapes.append(g.shape(g.WHITE, g.ellipse(cx - 26, cy - 46, 40, 16, -20), alpha=0.18))
        M = T(1.15, cx - 57.5, cy - 57.5)
        if glyph is None:  # Languages: a chunky globe
            shapes += moved(g.globe(g.WHITE), M)
        elif isinstance(glyph, str):
            shapes += g.glyph_shapes(glyph, ink, M)
        else:
            shapes += moved([svg.Shape(-1, "gfx", ink, 1.0, glyph.rule, glyph.contours)], M)
        texts.append(((cx, cy + 116), name, nunito(40, 800), g.WHITE, "ma"))
    # big glyph drafts for review
    for i, (glyph, name) in enumerate(((g.KNIGHT, "knight"), (g.NOTE, "note"), (pi, "pi"))):
        x0 = 1260 + i * 215
        shapes.append(g.shape(g.SURFACE, g.rrect(x0, 340, 190, 190, 24)))
        if isinstance(glyph, str):
            shapes += g.glyph_shapes(glyph, g.WHITE, T(1.7, x0 + 10, 350))
        else:
            shapes += moved([svg.Shape(-1, "gfx", g.WHITE, 1.0, glyph.rule, glyph.contours)], T(1.7, x0 + 10, 350))
        label(x0, 540, name)

    # --- row 3: path & lesson UI -------------------------------------------
    texts.append(((40, 640), "Path and lesson UI · unlit / lit / pressed node, START, tiles, CHECK, progress bar", HEAD, (226, 232, 235), "la"))
    shapes += g.node_disc(110, 740, 70, lit=False)
    shapes += g.node_disc(290, 740, 70, lit=True)
    pressed = g.node_disc(470, 752, 70, lit=True, depth=10)
    shapes += pressed
    label(60, 820, "unlit"); label(255, 820, "lit"); label(430, 820, "pressed")
    # START tooltip
    shapes += g.button(560, 680, 190, 74, 18, g.WHITE, 6, lip_col=(229, 229, 229))
    shapes.append(g.shape(g.WHITE, np.array([(640, 759), (670, 759), (655, 776)])))
    texts.append(((655, 690), "START", nunito(38, 1000), g.FEATHER, "ma"))
    # word tiles (dark mode)
    x = 800
    for word in ("I", "want", "a", "coffee", "please"):
        w = int(nunito(40, 700).getlength(word)) + 44
        shapes += g.button(x, 690, w, 70, 16, g.SURFACE, 5, lip_col=g.RAISED, border=g.RAISED)
        texts.append(((x + w / 2, 700), word, nunito(40, 700), g.WHITE, "ma"))
        x += w + 14
    # CHECK inactive / active (dark mode: dark ink on green)
    shapes += g.button(800, 790, 300, 66, 18, g.RAISED, 6, lip_col=(42, 54, 61))
    texts.append(((950, 800), "CHECK", nunito(38, 1000), (82, 101, 109), "ma"))
    shapes += g.button(1130, 790, 300, 66, 18, g.FEATHER, 6)
    texts.append(((1280, 800), "CHECK", nunito(38, 1000), g.SURFACE, "ma"))
    # progress bar: track + fill (+ highlight band); in film the fill IS the green path
    shapes.append(g.shape(g.RAISED, g.rrect(1470, 700, 400, 30, 15)))
    shapes.append(g.shape(g.FEATHER, g.rrect(1470, 700, 280, 30, 15)))
    shapes.append(g.shape(g.FEATHER_HI, g.rrect(1482, 706, 256, 8, 4), alpha=0.6))
    label(1470, 745, "progress bar (fill = the green line)")

    # --- row 4: streak, league, call icons ---------------------------------
    texts.append(((40, 900), "Streak, league and call pieces", HEAD, (226, 232, 235), "la"))
    shapes += g.glyph_shapes(g.FLAME_OUTER, g.STREAK, T(1.6, 40, 950), rule="nonzero")
    shapes += g.glyph_shapes(g.FLAME_INNER, g.GOLD, T(1.6, 40, 950), rule="nonzero")
    label(60, 1120, "flame")
    texts.append(((300, 960), "365", nunito(150, 900), g.STREAK, "ma"))
    texts.append(((300, 1120), "day streak", nunito(40, 800), g.STREAK, "ma"))
    for k, d in enumerate("MTWTFSS"):
        cx, cy = 480 + k * 70, 1010
        filled = k < 5
        if filled:
            shapes.append(g.shape(g.lip(g.STREAK), g.circle(cx, cy + 4, 26)))
            shapes.append(g.shape(g.STREAK, g.circle(cx, cy, 26)))
            shapes.append(g.check_mark(g.WHITE, cx, cy, 0.62))
        else:
            shapes.append(g.shape(g.RAISED, g.circle(cx, cy, 26)))
            shapes.append(g.shape(g.STAGE, g.circle(cx, cy, 21)))
        texts.append(((cx, 1050), d, nunito(26, 700), (175, 190, 196), "ma"))
    shapes += g.gem(1050, 1010, 1.0)
    label(1000, 1120, "Diamond gem")
    shapes += g.glyph_shapes(g.CROWN, g.GOLD, T(1.0, 1160, 960), rule="nonzero")
    label(1175, 1120, "#1 crown")
    for k, (name, col) in enumerate((("M", g.FEATHER), ("S", g.MATH), ("K", g.MUSIC), ("A", g.STREAK), ("L", (255, 75, 75)))):
        cx, cy = 1330 + k * 76, 1010
        shapes.append(g.shape(col, g.circle(cx, cy, 30)))
        texts.append(((cx, cy - 22), name, nunito(36, 900), g.WHITE, "ma"))
    label(1300, 1120, "avatars (fictional initials)")
    # call controls
    for k, (glyph, bg, ink) in enumerate(((g.SPEAKER, g.SURFACE, g.MATH), ("mic", g.RAISED, g.WHITE), (g.CAMERA, g.RAISED, g.WHITE), (g.HANGUP, g.CARDINAL, g.WHITE))):
        cx, cy = 140 + k * 140, 1270
        shapes.append(g.shape(bg, g.circle(cx, cy, 48)))
        if glyph == "mic":
            shapes += moved(g.mic(ink), T(0.62, cx - 31, cy - 31))
        else:
            shapes += g.glyph_shapes(glyph, ink, T(0.62, cx - 31, cy - 31), rule="nonzero")
    label(80, 1340, "speaker · mic · camera · hang-up")
    shapes.append(g.check_mark(g.FEATHER, 760, 1270, 1.2))
    label(720, 1340, "check")

    img = svg.render(shapes, np.eye(3), (H, W), ss=4)
    board = Image.fromarray(svg.to_uint8(img, g.STAGE))
    d = ImageDraw.Draw(board)
    for (x, y), t, f, col, anchor in texts:
        d.text((x, y), t, font=f, fill=col, anchor=anchor)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    board.save(OUT)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
