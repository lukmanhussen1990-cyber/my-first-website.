"""Per-shot camera moves and cartoon effects for render.py (times are absolute seconds on the voiceover).

Camera keys: push (z0, z1) zoom over the shot | pan ((u0,v0),(u1,v1)) focus point in the picture (0..1) |
  punch [(t, k)] stepped zoom on a word | pulse [(t, k, dur)] zoom in and back | shake [(t, px, dur, hz)] |
  sway (deg, hz) | handheld px drift | clip {start, speed} for Kling clips (speed < 1 = slow motion)
Effects (fx list): stink {at, scale, n, amount, t0, t1, fade_in} | sweat {at, t0, dist} | tears {at: [eyes], t0, fly}
  | rings {at, t0, t1} (yell sound waves) | sparkles {at, radius} | confetti | petals | zzz {at, t0, t1}
Grade: desat / tint ((b,g,r), amount) / haze / dim, each a number or (start, end) over the shot.
"at" points are positions in the picture (u = 0 left .. 1 right, v = 0 top .. 1 bottom); they are set after
looking at each image (ANCHORS below), so the effects sit on the right door / forehead / eyes.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
WORDS = json.load(open(os.path.join(HERE, "audio", "word_onsets.json")))
VO = json.load(open(os.path.join(HERE, "audio", "vo_lines.json")))["lines"]
SHOTS = {s["id"]: s for s in json.load(open(os.path.join(HERE, "shots.json")))["shots"]}


def w(line, idx=0):
    return [x for x in WORDS if x["line"] == line][idx]["s"]


def L(line):
    return VO[line - 1]["start"], VO[line - 1]["end"]


def S(i):
    return SHOTS[i]["t0"], SHOTS[i]["t1"]


# Picture positions (u, v) of the things effects attach to. Defaults follow the prompts' framing
# ("face a little above the middle"); they are corrected per image once the images arrive.
ANCHORS = {
    1: {"watch": (0.36, 0.66)},
    2: {"door_top": (0.50, 0.16)},
    4: {"mouth": (0.50, 0.42)},
    5: {"mouth": (0.50, 0.48)},
    9: {"forehead": (0.43, 0.27)},
    15: {"forehead": (0.62, 0.27)},
    17: {"mouth": (0.55, 0.40)},
    19: {"mouth": (0.50, 0.46)},
    21: {"eyes": [(0.42, 0.40), (0.58, 0.40)]},
    22: {"door": (0.50, 0.60)},
    23: {"roll": (0.50, 0.22)},
    25: {"door_top": (0.50, 0.16)},
    30: {"forehead": (0.45, 0.25)},
    35: {"eyes": [(0.43, 0.38), (0.57, 0.38)]},
    36: {"door": (0.88, 0.55)},
}


def A(i, k):
    return ANCHORS[i][k]


def shot_fx(i):
    t0, t1 = S(i)
    yell1, yell1_end = L(4)
    yell2, yell2_end = L(17)
    hh = 2.5
    F = {
        1: dict(push=(1.0, 1.08), handheld=hh,
                fx=[dict(type="sparkles", at=A(1, "watch"), radius=60, n=4, rate=1.2, t0=t0 + 0.6, t1=t0 + 1.8)]),
        2: dict(push=(1.04, 1.10), punch=[(w(2, 2), 1.18)],
                fx=[dict(type="stink", at=A(2, "door_top"), scale=1.3, n=3, amount=1.0)]),
        3: dict(push=(1.12, 1.14), pan=((0.38, 0.5), (0.62, 0.5)), pan_ease="lin", handheld=hh),
        4: dict(push=(1.0, 1.12), push_ease="in", handheld=hh),
        5: dict(push=(1.06, 1.14), punch=[(w(4, 0), 1.12)],
                shake=[(yell1, 34, 0.9, 22)], flash=[(yell1, 0.35, 0.16)],
                fx=[dict(type="rings", at=A(5, "mouth"), t0=yell1, t1=t1 + 0.1, size=600)]),
        6: dict(push=(1.0, 1.05), shake=[(t0, 22, 1.4, 20)], handheld=hh),
        7: dict(push=(1.0, 1.04), punch=[(w(5, 2), 1.22)], shake=[(w(5, 2), 12, 0.35, 24)],
                grade=dict(desat=(0.0, 0.25))),
        8: dict(push=(1.0, 1.18), push_ease="in"),
        9: dict(push=(1.0, 1.20), push_ease="in", grade=dict(desat=(0.0, 0.45)),
                fx=[dict(type="sweat", at=A(9, "forehead"), t0=t0 + 0.25, dist=70, scale=1.2)]),
        10: dict(push=(1.0, 1.12), grade=dict(tint=((255, 215, 190), (0.0, 0.45)), desat=(0.1, 0.3))),
        11: dict(push=(1.0, 1.0), vignette=0.4),
        12: dict(push=(1.02, 1.06), pan=((0.47, 0.5), (0.53, 0.5)), punch=[(w(10, 2), 1.08), (w(10, 4), 1.08)],
                 handheld=hh),
        13: dict(push=(1.0, 1.07)),
        14: dict(push=(1.0, 1.12), shake=[(w(12, 2), 7, 0.45, 32)], grade=dict(desat=(0.0, 0.2))),
        15: dict(push=(1.0, 1.06), handheld=hh,
                 fx=[dict(type="sweat", at=A(15, "forehead"), t0=t0 + 0.1, dist=50)]),
        16: dict(push=(1.0, 1.04), punch=[(t0 + 0.2, 1.15)]),
        17: dict(push=(1.0, 1.06), pulse=[(t0 + 0.15, 1.05, 0.9), (w(14, 3) + 0.05, 1.05, 0.8)],
                 fx=[dict(type="zzz", at=A(17, "mouth"), t0=t0 + 0.2, t1=t1)]),
        18: dict(push=(1.0, 1.10), push_ease="in", punch=[(w(16, 0), 1.25)], shake=[(w(16, 0), 10, 0.3, 26)]),
        19: dict(push=(1.08, 1.20), punch=[(w(17, 0), 1.10)], shake=[(yell2, 52, 1.4, 24)],
                 flash=[(yell2, 0.5, 0.2)],
                 fx=[dict(type="rings", at=A(19, "mouth"), t0=yell2, t1=t1 + 0.1, size=700, n=5)]),
        20: dict(push=(1.05, 1.12), shake=[(t0, 40, 2.4, 16)], sway=(2.5, 0.9)),
        21: dict(push=(1.0, 1.08), shake=[(w(18, 3), 8, 0.6, 24)],
                 fx=[dict(type="tears", at=A(21, "eyes"), t0=t0 + 0.2, fly=0.7, rate=7.0)]),
        22: dict(push=(1.0, 1.14), push_ease="lin",
                 fx=[dict(type="stink", at=A(22, "door"), scale=0.6, n=3, amount=0.55)]),
        23: dict(push=(1.0, 1.08), pulse=[(t0 + 0.3, 1.03, 0.35), (t0 + 0.75, 1.03, 0.35)],
                 fx=[dict(type="sparkles", at=A(23, "roll"), radius=200, n=12)]),
        24: dict(push=(1.0, 1.06), fx=[dict(type="confetti", n=60, speed=380)]),
        25: dict(push=(1.0, 1.10), grade=dict(desat=0.15),
                 fx=[dict(type="stink", at=A(25, "door_top"), scale=1.1, n=2, amount=0.7)]),
        26: dict(push=(1.0, 1.12), grade=dict(dim=(0.0, 0.2)), vignette=0.45),
        27: dict(push=(1.0, 1.03), punch=[(w(23, 0), 1.15)], shake=[(w(23, 0), 16, 0.4, 20)], vignette=0.45),
        28: dict(push=(1.0, 1.03), punch=[(w(24, 0), 1.12), (w(25, 0), 1.12)],
                 shake=[(w(24, 0), 14, 0.35, 20), (w(25, 0), 16, 0.4, 20)], vignette=0.45),
        29: dict(push=(1.0, 1.04), punch=[(w(26, 2), 1.08)], vignette=0.45),
        30: dict(push=(1.0, 1.24), push_ease="in", grade=dict(desat=(0.0, 0.4)), vignette=0.45,
                 fx=[dict(type="sweat", at=A(30, "forehead"), t0=t0 + 0.4, dist=90, slide=1.5)]),
        31: dict(push=(1.0, 1.10), push_ease="lin", flash=[(w(28, 2), 0.55, 0.25)], vignette=0.45,
                 clip=dict(start=0.0, speed=0.6)),
        32: dict(push=(1.0, 1.05), punch=[(w(29, 3), 1.12)], vignette=0.35),
        33: dict(push=(1.0, 1.10), push_ease="lin", clip=dict(start=0.3, speed=0.7),
                 fx=[dict(type="petals", n=26, speed=110)]),
        34: dict(push=(1.0, 1.06), fx=[dict(type="petals", n=22, speed=110)]),
        35: dict(push=(1.0, 1.08), grade=dict(tint=((255, 200, 160), 0.35)),
                 fx=[dict(type="tears", at=A(35, "eyes"), t0=t0 + 0.2, fly=0.0, rate=3.0)]),
        36: dict(push=(1.24, 1.0), push_ease="out", pan=((0.55, 0.5), (0.5, 0.5)),
                 grade=dict(haze=(0.0, 0.38)), vignette=0.35,
                 fx=[dict(type="stink", at=A(36, "door"), scale=0.9, n=4, amount=1.0, t0=t0, fade_in=1.0)]),
    }
    return F.get(i, dict(push=(1.0, 1.06)))
