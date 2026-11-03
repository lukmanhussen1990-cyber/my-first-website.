"""Per-shot camera moves and cartoon effects for render.py (times are absolute seconds on the voiceover).

Camera keys: push (z0, z1) zoom over the shot | pan ((u0,v0),(u1,v1)) focus point in the picture (0..1), over the
  whole shot or only between pan_t (ta, tb) | path [(t, (u, v)), ...] focus keyframes | punch [(t, k)] stepped zoom
  on a word | pulse [(t, k, dur)] zoom in and back | shake [(t, px, dur, hz)] | handheld px drift |
  hold_fps / weave (old film: camera moves in 12 fps steps, jumpy frame) | clip {start, speed} or {span: (a, b)}
  for Kling clips (span = play clip seconds a..b over the shot)
Effects (fx list): stink {at, scale, n, amount, t0, t1, fade_in} | sweat {at, t0, dist} | sparkles {at, radius}
  | rings {at, t0, t1} | speedlines {t0, t1, dir, n, amount} | glow {at, radius, amount, rays} | fly {at, rx, ry}
Picture: grade (desat / tint / dim / haze) | oldfilm {amount} | vignette | flash [(t, a, d)] | letterbox px or
  (px0, px1) | fade_out (t, d) | pixel k (PS1 pixel blocks, default PIXEL=2)
"at" points are positions in the picture (u = 0 left .. 1 right, v = 0 top .. 1 bottom). The defaults follow the
prompts' framing; they are corrected per image once the images arrive (ANCHORS).
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
WORDS = json.load(open(os.path.join(HERE, "audio", "word_onsets.json")))
VO = json.load(open(os.path.join(HERE, "audio", "vo_lines.json")))["lines"]
SHOTS = {s["id"]: s for s in json.load(open(os.path.join(HERE, "shots.json")))["shots"]}
CUES = json.load(open(os.path.join(HERE, "audio", "sfx_cues.json")))


def w(line, idx=0):
    return [x for x in WORDS if x["line"] == line][idx]["s"]


def L(line):
    return VO[line - 1]["start"], VO[line - 1]["end"]


def S(i):
    return SHOTS[i]["t0"], SHOTS[i]["t1"]


def cue_times(prefix, t0, t1):
    """Times of the sound cues whose file name starts with prefix inside [t0, t1) (clock ticks -> zoom pulses)."""
    return [c["t"] for c in CUES if os.path.basename(c["file"]).startswith(prefix) and t0 <= c["t"] < t1]


# Picture positions (u, v) of the things effects attach to.
ANCHORS = {
    1: {"flowers": (0.42, 0.62)},
    2: {"forehead": (0.56, 0.30)},
    4: {"bottom": (0.50, 0.98)},
    8: {"temple": (0.62, 0.32)},
    10: {"forehead": (0.40, 0.22), "forehead2": (0.62, 0.20)},
    11: {"light": (0.62, 0.12)},
    12: {"window": (0.50, 0.42)},
    14: {"bundle": (0.50, 0.55)},
    15: {"bundle": (0.50, 0.55)},
    21: {"dad": (0.50, 0.52)},
    22: {"shoulder": (0.42, 0.24)},
    23: {"smudge": (0.58, 0.50)},
    24: {"shoulder": (0.30, 0.62)},
    25: {"forehead": (0.50, 0.42)},
    29: {"street": (0.50, 0.85)},
    30: {"forehead": (0.56, 0.28)},
    32: {"drip": (0.42, 0.40)},
    35: {"forehead": (0.62, 0.30)},
    36: {"fly": (0.55, 0.55)},
    38: {"lip": (0.62, 0.52)},
    39: {"you": (0.25, 0.60)},
    40: {"window": (0.62, 0.42)},
}

# corrected positions measured on the real images override the defaults (build/anchors/shot_XX.json)
for _i in list(ANCHORS):
    _f = os.path.join(HERE, "build", "anchors", f"shot_{_i:02d}.json")
    if os.path.exists(_f):
        for _k, _v in json.load(open(_f)).items():
            ANCHORS[_i][_k] = [tuple(x) for x in _v] if _v and isinstance(_v[0], list) else tuple(_v)


def A(i, k):
    return ANCHORS[i][k]


WEST = dict(tint=((150, 205, 255), 0.30))         # warm western-movie colour (BGR)
LB = 150                                          # western black bars (px)


def shot_fx(i):
    t0, t1 = S(i)
    hh = 2.5
    old = dict(oldfilm=dict(amount=1.0), hold_fps=12, weave=3.0, vignette=0.6)
    F = {
        # --- arrival
        1: dict(push=(1.0, 1.10), pan=((0.5, 0.55), (0.48, 0.5)), handheld=hh,
                fx=[dict(type="sparkles", at=A(1, "flowers"), radius=90, n=6, rate=1.4, t0=t0 + 0.3)]),
        2: dict(push=(1.02, 1.12), push_ease="lin",
                fx=[dict(type="sweat", at=A(2, "forehead"), t0=t0 + 0.3, dist=80, slide=1.0)]),
        3: dict(push=(1.14, 1.16), pan=((0.36, 0.5), (0.62, 0.5)), pan_ease="lin", handheld=hh),
        4: dict(push=(1.0, 1.04), punch=[(w(4, 1), 1.16)],
                fx=[dict(type="stink", at=A(4, "bottom"), scale=1.1, n=3, amount=0.9, t0=w(4, 1), fade_in=0.25)]),
        # --- flushing
        5: dict(push=(1.0, 1.04), punch=[(w(5, 1) + 0.05, 1.14)], shake=[(w(5, 1) + 0.05, 6, 0.25, 26)]),
        6: dict(push=(1.0, 1.03), push_ease="lin"),
        7: dict(push=(1.0, 1.02), punch=[(w(7, 1) - 0.02, 1.10), (w(7, 1) + 0.16, 1.10)],
                shake=[(w(7, 1) - 0.02, 8, 0.25, 28), (w(7, 1) + 0.16, 12, 0.4, 28)]),
        8: dict(push=(1.0, 1.0),
                fx=[dict(type="sweat", at=A(8, "temple"), t0=t0 + 0.25, dist=60, slide=0.8)]),
        9: dict(push=(1.0, 1.10), push_ease="in", shake=[(t0 + 0.3, 4, 0.6, 18), (t0 + 0.9, 9, 0.6, 20)],
                clip=dict(span=(0.0, 4.0)), grade=dict(dim=(0.0, 0.12))),
        10: dict(push=(1.12, 1.18), shake=[(t0, 10, 0.95, 22)],
                 path=[(t0, (0.5, 0.42)), (t0 + 0.2, (0.42, 0.42)), (t0 + 0.42, (0.58, 0.42)),
                       (t0 + 0.64, (0.44, 0.42)), (t0 + 0.86, (0.55, 0.42))],
                 fx=[dict(type="sweat", at=A(10, "forehead"), t0=t0 + 0.05, dist=110, slide=0.7, scale=1.2),
                     dict(type="sweat", at=A(10, "forehead2"), t0=t0 + 0.2, dist=90, slide=0.6),
                     dict(type="speedlines", t0=t0, t1=t1, n=40, amount=0.35, inner=0.40)]),
        # --- the window
        11: dict(push=(1.0, 1.10), push_ease="lin", grade=dict(tint=((170, 225, 255), (0.0, 0.3))),
                 fx=[dict(type="glow", at=A(11, "light"), radius=700, amount=0.35, pulse=0.0, rays=0,
                          rise=1.4, t0=t0),
                     dict(type="sparkles", at=A(11, "light"), radius=320, n=8, rate=1.0)]),
        12: dict(push=(1.0, 1.16), push_ease="lin", clip=dict(span=(0.0, 2.5)),
                 fx=[dict(type="glow", at=A(12, "window"), radius=620, amount=0.55, pulse=0.3, hz=1.6, rays=12),
                     dict(type="sparkles", at=A(12, "window"), radius=420, n=12, rate=1.2)]),
        13: dict(push=(1.0, 1.08), handheld=4.0),
        14: dict(push=(1.0, 1.08),
                 fx=[dict(type="sparkles", at=A(14, "bundle"), radius=170, n=8, rate=1.5, t0=t0 + 0.2),
                     dict(type="stink", at=A(14, "bundle"), scale=0.55, n=2, amount=0.6, t0=t0 + 0.4,
                          fade_in=0.3)]),
        15: dict(push=(1.0, 1.04), punch=[(w(15, 4), 1.18)],
                 fx=[dict(type="sparkles", at=A(15, "bundle"), radius=150, n=6, rate=1.8, t0=w(15, 4))]),
        16: dict(push=(1.0, 1.08), handheld=hh),
        # --- the throw
        17: dict(push=(1.0, 1.12), push_ease="in", clip=dict(span=(0.0, 2.0)),
                 shake=[(t1 - 0.2, 10, 0.25, 24)]),
        18: dict(push=(1.02, 1.08), clip=dict(span=(0.0, 4.5)), shake=[(t0, 18, 0.4, 22)],
                 fx=[dict(type="speedlines", t0=t0, t1=t0 + 0.7, n=50, amount=0.55, fade=0.3, inner=0.38)]),
        19: dict(push=(1.0, 1.08), punch=[(w(19, 2), 1.10)], handheld=hh),
        # --- black screen: "Splat." / "And a scream."
        20: dict(push=(1.0, 1.0), pixel=1, vignette=0,
                 fx=[dict(type="rings", at=(0.5, 0.5), t0=(cue_times("scream", t0, t1) or [t0])[0], t1=t1, size=700, n=4, a0=0, a1=360)]),
        # --- the dad
        21: dict(push=(1.0, 1.16), pan=((0.5, 0.5), A(21, "dad")), push_ease="in"),
        22: dict(push=(1.32, 1.26), pan=((0.5, 0.95), (0.5, 0.05)), pan_ease="inout",
                 fx=[dict(type="stink", at=A(22, "shoulder"), scale=0.5, n=2, amount=0.7, t0=t0 + 1.4,
                          fade_in=0.5)]),
        23: dict(push=(1.0, 1.06), punch=[(w(26, 1), 1.18)],
                 fx=[dict(type="stink", at=A(23, "smudge"), scale=1.2, n=3, amount=1.0)]),
        24: dict(push=(1.0, 1.08), push_ease="lin", clip=dict(span=(0.0, 4.0)),
                 fx=[dict(type="stink", at=A(24, "shoulder"), scale=0.8, n=2, amount=0.8)]),
        25: dict(push=(1.25, 1.25), pan=((0.5, 0.2), (0.5, 0.62)), pan_t=(w(28, 1) - 0.12, w(28, 1) + 0.06),
                 pan_ease="in", shake=[(w(28, 1) + 0.06, 22, 0.5, 22)],
                 fx=[dict(type="speedlines", dir="vertical", t0=w(28, 1) - 0.12, t1=w(28, 1) + 0.35, n=26,
                          amount=0.6, fade=0.2),
                     dict(type="sweat", at=A(25, "forehead"), t0=w(28, 1) + 0.25, dist=70, slide=0.8)]),
        # --- old Edinburgh (old film)
        26: dict(old, push=(1.10, 1.14), pan=((0.5, 0.75), (0.5, 0.3))),
        27: dict(old, push=(1.0, 1.08), shake=[(t0 + 0.45, 6, 0.3, 14)]),
        28: dict(old, push=(1.0, 1.04), punch=[(w(31, 9), 1.18)], shake=[(w(31, 9), 14, 0.6, 16)]),
        29: dict(old, push=(1.05, 1.10), shake=[(t0, 8, 2.0, 9)],
                 fx=[dict(type="speedlines", t0=t0, t1=t1, n=36, amount=0.30, inner=0.45)]),
        # --- guilty
        30: dict(push=(1.0, 1.14), push_ease="lin", shake=[(t0, 14, 0.3, 26)],
                 fx=[dict(type="sweat", at=A(30, "forehead"), t0=t0 + 0.5, dist=90, slide=1.3)]),
        # --- dinner
        31: dict(push=(1.0, 1.18), push_ease="lin", pan=((0.5, 0.5), (0.55, 0.42))),
        32: dict(push=(1.0, 1.06), punch=[(t0 + 0.55, 1.05, 0.05)],
                 fx=[dict(type="sweat", at=A(32, "drip"), t0=t0 + 0.2, dist=260, slide=0.4, scale=1.3)]),
        33: dict(push=(1.0, 1.28), push_ease="lin", clip=dict(start=0.0, speed=1.0), letterbox=(0, LB),
                 grade=dict(dim=(0.0, 0.1)), vignette=0.6),
        # --- western stare-down
        34: dict(grade=WEST, push=(1.0, 1.05), letterbox=LB, vignette=0.5),
        35: dict(grade=WEST, push=(1.04, 1.10), letterbox=LB, vignette=0.5,
                 fx=[dict(type="sweat", at=A(35, "forehead"), t0=t0 + 0.3, dist=100, slide=1.2, scale=1.3),
                     dict(type="fly", at=(0.5, 0.55), rx=380, ry=200, t0=t0 + 0.1, speed=0.9, size=24)]),
        36: dict(grade=WEST, push=(1.06, 1.12), letterbox=LB, vignette=0.5, shake=[(t0 + 0.05, 5, 0.6, 30)]),
        37: dict(push=(1.0, 1.03), letterbox=LB, vignette=0.45, grade=dict(WEST),
                 pulse=[(tk, 1.05, 0.16) for tk in cue_times("tick_", t0 - 0.05, t1)]),
        # --- whisper + freeze + ending
        38: dict(push=(1.0, 1.12), push_ease="lin", letterbox=LB, vignette=0.5,
                 fx=[dict(type="sweat", at=A(38, "lip"), t0=t0 + 0.1, dist=30, slide=1.2, scale=0.9)]),
        39: dict(push=(1.0, 1.0), grade=dict(desat=0.3), vignette=0.4,
                 pulse=[(tk, 1.012, 0.14) for tk in cue_times("tick_", t0, t1)],
                 fx=[dict(type="sweat", at=A(39, "you"), t0=t0 + 0.6, dist=40, slide=1.0, scale=0.8)]),
        40: dict(push=(1.32, 1.0), push_ease="out", pan=(A(40, "window"), (0.5, 0.5)), vignette=0.45,
                 fade_out=(t1 - 0.75, 0.7),
                 fx=[dict(type="stink", at=A(40, "window"), scale=0.9, n=3, amount=0.9, t0=t0 + 0.2, fade_in=0.6),
                     dict(type="sparkles", at=(0.5, 0.15), radius=480, n=10, rate=0.8)]),
    }
    return F.get(i, dict(push=(1.0, 1.06)))
