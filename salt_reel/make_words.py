#!/usr/bin/env python3
"""Adds the reference-style overlays to audio/captions.ass (run after make_captions.py):
  - big comic sound words (SHAKE SHAKE!, SLAP!, POP!, VRRRRR!, BOOM! ...): yellow fill, thick red outline, a soft
    dark shadow, a little bounce (30% -> 122% -> 100%) and a slight tilt;
  - small labels in white boxes with a black arrow pointing at the thing ("HOLES", "40 MIN", "MAX", "2 MIN").
    The arrow tip is placed on the 3D anchor measured by the renderer (build/anchors/shot_XX_frames.json).
Times come from events.py (the same moments as the sounds and camera hits)."""
import json
import math
import os
from events import T, shot, line

HERE = os.path.dirname(os.path.abspath(__file__))
ASS = os.path.join(HERE, "audio", "captions.ass")
FONT = "Inter Display Black"
W, H = 1080, 1920


def ts(t):
    t = max(0.0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def anchor(sid, name, u=0.5):
    """screen point (px) of a named 3D anchor at fraction u of the shot"""
    f = os.path.join(HERE, "build", "anchors", f"shot_{sid:02d}_frames.json")
    fr = json.load(open(f))
    a = fr[min(len(fr) - 1, int(u * (len(fr) - 1)))][name]
    return a[0] * W, a[1] * H


STYLES = [
    "Style: Word,{f},120,&H0020D2FF,&H0020D2FF,&H002A20E8,&H90000000,-1,0,0,0,100,100,2,0,1,9,0,5,0,0,0,1",
    "Style: WordShadow,{f},120,&H70000000,&H70000000,&H70000000,&HFF000000,-1,0,0,0,100,100,2,0,1,14,0,5,0,0,0,1",
    "Style: Label,{f},64,&H00141414,&H00141414,&H00FFFFFF,&H50000000,-1,0,0,0,100,100,2,0,3,16,6,5,0,0,0,1",
    "Style: Arrow,{f},20,&H00141414,&H00141414,&H00FFFFFF,&H00000000,0,0,0,0,100,100,0,0,1,5,0,7,0,0,0,1",
]
WORDS = [   # (text, start, end, x, y, tilt, scale)
    ("SHAKE SHAKE!", T["shake"] + 0.1, shot(1)[1], 560, 470, -7, 1.0),
    ("SHAKE SHAKE!", T["shake2"] + 0.05, shot(2)[1], 540, 560, 6, 0.85),
    ("SLAP!", T["slap"], shot(4)[1], 600, 560, -8, 1.45),
    ("POP!", T["lid"], shot(6)[1], 640, 640, 8, 1.2),
    ("FWOOSH!", T["dump"], shot(7)[1], 540, 520, -6, 1.15),
    ("POKE!", T["pokes"][0], shot(9)[1], 700, 560, 8, 0.9),
    ("TICK TOCK", T["clock"] + 0.1, shot(12)[1], 540, 400, -4, 0.85),
    ("VRRRRR!", T["vrrr"] + 0.08, shot(18)[1], 540, 520, -6, 1.3),
    ("BOOM!", T["boom"], shot(19)[1], 540, 760, 5, 1.9),
]
LABELS = [  # (text, start, end, shot, anchor, box x, box y)
    ("2 MIN", shot(2)[0] + 0.15, shot(2)[1], 2, "forehead", 300, 330),
    ("HOLES", shot(9)[0] + 0.1, shot(9)[1], 9, "holes", 760, 330),
    ("HOLES", shot(10)[0], shot(10)[1], 10, "holes", 300, 330),
    ("40 MIN", T["clock"] + 0.05, shot(12)[1], 12, "clock", 780, 1500),
    ("MAX", shot(17)[0] + 0.8, shot(17)[1], 17, "dial", 820, 330),
]


def arrow(x0, y0, x1, y1, w=16, head=46):
    """an arrow polygon from (x0, y0) to the tip (x1, y1), as an ASS drawing"""
    dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = -uy, ux
    bx, by = x1 - ux * head, y1 - uy * head
    pts = [(x0 + nx * w / 2, y0 + ny * w / 2), (bx + nx * w / 2, by + ny * w / 2), (bx + nx * head * 0.6, by + ny * head * 0.6), (x1, y1),
           (bx - nx * head * 0.6, by - ny * head * 0.6), (bx - nx * w / 2, by - ny * w / 2), (x0 - nx * w / 2, y0 - ny * w / 2)]
    return "m " + " l ".join(f"{int(px)} {int(py)}" for px, py in pts)


def main():
    s = open(ASS, encoding="utf-8").read()
    assert "Style: Word," not in s, "run make_captions.py first (captions.ass already has the words)"
    s = s.replace("\n[Events]", "\n" + "\n".join(x.format(f=FONT) for x in STYLES) + "\n\n[Events]", 1)
    ev = []
    for text, a, b, x, y, tilt, k in WORDS:
        k100 = int(100 * k)
        bounce = (f"\\fscx{int(30 * k)}\\fscy{int(30 * k)}\\t(0,110,\\fscx{int(122 * k)}\\fscy{int(122 * k)})"
                  f"\\t(110,230,\\fscx{k100}\\fscy{k100})\\t(230,330,\\fscx{int(108 * k)}\\fscy{int(108 * k)})\\t(330,430,\\fscx{k100}\\fscy{k100})")
        ev.append(f"Dialogue: 2,{ts(a)},{ts(b)},WordShadow,,0,0,0,,{{\\an5\\pos({x + 8},{y + 10})\\frz{tilt}\\blur10{bounce}}}{text}")
        ev.append(f"Dialogue: 3,{ts(a)},{ts(b)},Word,,0,0,0,,{{\\an5\\pos({x},{y})\\frz{tilt}{bounce}}}{text}")
    for text, a, b, sid, name, bx, by in LABELS:
        tx, ty = anchor(sid, name)
        # the arrow starts at the box edge nearest the target and stops a little short of it
        sx, sy = bx + (60 if tx > bx else -60) * (abs(tx - bx) > 120), by + (40 if ty > by else -40)
        L = math.hypot(tx - sx, ty - sy); ex, ey = tx - (tx - sx) / L * 22, ty - (ty - sy) / L * 22
        pop = "\\fscx40\\fscy40\\t(0,120,\\fscx110\\fscy110)\\t(120,220,\\fscx100\\fscy100)"
        ev.append(f"Dialogue: 4,{ts(a + 0.08)},{ts(b)},Arrow,,0,0,0,,{{\\an7\\pos(0,0)\\p1\\fad(80,0)}}{arrow(sx, sy, ex, ey)}{{\\p0}}")
        ev.append(f"Dialogue: 5,{ts(a)},{ts(b)},Label,,0,0,0,,{{\\an5\\pos({bx},{by}){pop}}}{text}")
    open(ASS, "w", encoding="utf-8").write(s.rstrip("\n") + "\n" + "\n".join(ev) + "\n")
    print(f"words: {len(WORDS)} comic words + {len(LABELS)} arrow labels -> audio/captions.ass")


if __name__ == "__main__":
    main()
