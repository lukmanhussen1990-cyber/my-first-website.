"""Per-shot camera moves and cartoon effects for render.py (times are absolute seconds on the voiceover).

Camera keys: push (z0, z1) zoom over the shot | pan ((u0,v0),(u1,v1)) focus point in the picture (0..1), over the
  whole shot or only between pan_t (ta, tb) | path [(t, (u, v)), ...] | punch [(t, k)] stepped zoom on a word |
  pulse [(t, k, dur)] | shake [(t, px, dur, hz)] | handheld px | hold_fps / weave (old film) | clip {start, speed}
Effects (fx list): censor {at, w, h, block} (the big pixel mosaic over the toilet bowl) | stink | sweat | tears |
  veins | sparkles | speedlines | glow | rings
Picture: grade (desat / tint / dim) | oldfilm | vignette | flash [(t, a, d)] | flicker [(t, d)] | fade_out (t, d)
"at" points are positions in the picture (u = 0 left .. 1 right, v = 0 top .. 1 bottom), measured on the 3D
render (build/anchors/shot_XX.json) so the censor block sits on the bowl and the sweat on the forehead.
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


def cue(name):
    for c in CUES:
        if os.path.basename(c["file"]) == name + ".wav":
            return c["t"]
    raise KeyError(name)


ANCHORS = {
    1: {"forehead": (0.5, 0.25)}, 3: {"bowl": (0.5, 0.55)}, 5: {"bowl": (0.5, 0.55)}, 7: {"bowl": (0.5, 0.55)},
    8: {"forehead": (0.5, 0.2), "bowl": (0.3, 1.2)}, 9: {"bowl": (0.5, 0.95)}, 10: {"forehead": (0.5, 0.25)},
    12: {"bowl": (0.6, 0.8)}, 16: {"forehead": (0.5, 0.3)}, 17: {"forehead": (0.6, 0.1)}, 23: {"bowl": (0.5, 1.1)},
    27: {"forehead": (0.5, 0.2)}, 29: {"fossil": (0.5, 0.6)}, 33: {"bowl": (0.3, 0.7)}, 34: {"bowl": (0.4, 0.8)},
    35: {"bowl": (0.6, 0.8)}, 36: {"eye": (0.45, 0.4)}, 38: {"window": (0.6, 0.45)},
}
for _i in list(ANCHORS):
    _f = os.path.join(HERE, "build", "anchors", f"shot_{_i:02d}.json")
    if os.path.exists(_f):
        for _k, _v in json.load(open(_f)).items():
            ANCHORS[_i][_k] = [tuple(x) for x in _v] if _v and isinstance(_v[0], list) else tuple(_v)


def A(i, k):
    return ANCHORS[i][k]


OLD = dict(oldfilm=dict(amount=1.0), hold_fps=12, weave=2.5, vignette=0.6)


def censor(i, w_=640, h_=520, **kw):
    """Green stink lines rising off the big cartoon poop in the bowl (the user asked to show the poop: no censor
    block any more)."""
    at = A(i, "bowl")
    return [dict(type="stink", at=(at[0], at[1] - 0.04), scale=1.25, n=3, amount=1.0)]


def shot_fx(i):
    t0, t1 = S(i)
    hh = 2.5
    F = {
        # 01 straining: shake that grows, the light flickers, red face, veins
        1: lambda: dict(push=(1.0, 1.14), push_ease="in", shake=[(t0, 5, 0.8, 24), (t0 + 0.7, 9, 0.85, 26)],
                        flicker=[(t0 + e, 0.07) for e in (0.3, 0.42, 0.9, 1.35, 1.42)],
                        grade=dict(tint=((150, 160, 255), 0.12)),
                        fx=[dict(type="veins", at=A(1, "forehead"), scale=1.3),
                            dict(type="sweat", at=A(1, "forehead"), t0=t0 + 0.4, dist=90, slide=0.8)]),
        # 02 the picture shakes and falls, punch-in on "house"
        2: lambda: dict(push=(1.0, 1.05), shake=[(t0, 8, 0.6, 30), (cue("crash"), 16, 0.4, 26)],
                        punch=[(w(1, 8), 1.12)], flicker=[(t0 + 0.4, 0.07)]),
        # 03 the bowl + the giant censor block; three punch-ins on dun dun DUNNN
        3: lambda: dict(push=(1.0, 1.0), punch=[(cue("dundun"), 1.06), (cue("dundun") + 0.38, 1.08),
                                                (cue("dundun") + 0.78, 1.18)],
                        shake=[(cue("dundun") + 0.78, 14, 0.6, 20)], fx=censor(3)),
        4: lambda: dict(push=(1.0, 1.04), punch=[(cue("click_1"), 1.14)], shake=[(cue("click_1"), 6, 0.25, 26)]),
        5: lambda: dict(push=(1.0, 1.06), push_ease="lin", fx=censor(5)),
        6: lambda: dict(push=(1.0, 1.02), punch=[(cue("click_2"), 1.1), (cue("click_3"), 1.1)],
                        shake=[(cue("click_2"), 8, 0.25, 28), (cue("click_3"), 12, 0.4, 28)]),
        7: lambda: dict(push=(1.0, 1.1), push_ease="lin", fx=censor(7)),
        8: lambda: dict(push=(1.0, 1.08), push_ease="lin",
                        fx=censor(8, 560, 460) + [dict(type="sweat", at=A(8, "forehead"), t0=t0 + 0.4, dist=60, slide=0.9)]),
        9: lambda: dict(push=(1.0, 1.04), fx=censor(9, 760, 560), pulse=[(cue("blink"), 1.03, 0.12)]),
        10: lambda: dict(push=(1.05, 1.2), push_ease="out", shake=[(t0, 12, 0.7, 26)],
                         fx=[dict(type="sweat", at=A(10, "forehead"), t0=t0 + 0.05, dist=80, slide=0.6, scale=1.2)]),
        11: lambda: dict(push=(1.0, 1.04), punch=[(w(9, 3), 1.14)], handheld=hh),
        12: lambda: dict(push=(1.0, 1.06), shake=[(t0, 5, 0.5, 20), (cue("crack"), 22, 0.45, 24)],
                         flash=[(cue("crack"), 0.35, 0.12)], fx=censor(12, 520, 420)),
        13: lambda: dict(push=(1.0, 1.05)),
        14: lambda: dict(push=(1.0, 1.03), punch=[(cue("knock_0"), 1.05), (cue("knock_1"), 1.05), (cue("knock_2"), 1.05)],
                         shake=[(cue(f"knock_{k}"), 6, 0.15, 30) for k in range(3)]),
        15: lambda: dict(push=(1.0, 1.1), push_ease="lin"),
        16: lambda: dict(push=(1.0, 1.03), punch=[(w(13, 2), 1.08)],
                         fx=[dict(type="sweat", at=A(16, "forehead"), t0=t0 + 0.2, dist=70, slide=1.0),
                             dict(type="sweat", at=(A(16, "forehead")[0] + 0.05, A(16, "forehead")[1] + 0.02),
                                  t0=t0 + 0.7, dist=60, slide=0.9)]),
        17: lambda: dict(push=(1.0, 1.3), push_ease="in", shake=[(t0 + 0.8, 4, 1.1, 30)],
                         fx=[dict(type="sweat", at=A(17, "forehead"), t0=t0 + 0.3, dist=120, slide=1.4, scale=1.4)]),
        18: lambda: dict(push=(1.0, 1.08), push_ease="lin"),
        19: lambda: dict(push=(1.12, 1.14), pan=((0.42, 0.5), (0.58, 0.5)), pan_ease="lin"),
        20: lambda: dict(push=(1.0, 1.06), punch=[(w(17, 1), 1.1)]),
        21: lambda: dict(push=(1.0, 1.04), shake=[(t0 + 0.95, 12, 0.5, 22)],
                         fx=[dict(type="speedlines", t0=t0, t1=t0 + 0.95, n=40, amount=0.35, fade=0.3, inner=0.42)]),
        22: lambda: dict(push=(1.0, 1.1), push_ease="lin"),
        23: lambda: dict(push=(1.0, 1.12), push_ease="lin", grade=dict(desat=(0.0, 0.6))),
        24: lambda: dict(push=(1.0, 1.06), push_ease="lin", grade=dict(desat=0.3)),
        25: lambda: dict(OLD, push=(1.0, 1.08)),
        26: lambda: dict(OLD, push=(1.04, 1.08), shake=[(t0, 8, 1.2, 14)]),
        27: lambda: dict(push=(1.0, 1.08), punch=[(w(23, 1), 1.16)], shake=[(w(23, 1), 10, 0.5, 26), (t0, 3, 2.4, 32)],
                         fx=[dict(type="sweat", at=A(27, "forehead"), t0=t0 + 0.6, dist=110, slide=1.2, scale=1.3)]),
        28: lambda: dict(OLD, push=(1.0, 1.08)),
        29: lambda: dict(OLD, push=(1.0, 1.1), push_ease="lin",
                         fx=[dict(type="glow", at=A(29, "fossil"), radius=380, amount=0.18, pulse=0.2, hz=0.8, rays=0)]),
        30: lambda: dict(OLD, push=(1.15, 1.15), pan=((0.38, 0.55), (0.6, 0.55)), pan_ease="lin", punch=[(w(26, 2), 1.06)]),
        31: lambda: dict(OLD, push=(1.0, 1.08)),
        32: lambda: dict(OLD, push=(1.18, 1.0), push_ease="out"),
        33: lambda: dict(push=(1.0, 1.04), punch=[(w(29, 5), 1.12)], fx=censor(33, 420, 340)),
        34: lambda: dict(push=(1.1, 1.0), push_ease="out", fx=censor(34, 420, 340)),
        35: lambda: dict(push=(1.0, 1.05), flash=[(cue("camera") + 0.07, 0.95, 0.35)], fx=censor(35, 460, 380)),
        36: lambda: dict(push=(1.0, 1.14), push_ease="lin",
                         fx=[dict(type="tears", at=[A(36, "eye")], t0=t0 + 0.35, fly=0.0, rate=0.9, size=16)]),
        37: lambda: dict(push=(1.0, 1.06), push_ease="lin"),
        38: lambda: dict(push=(1.3, 1.0), push_ease="out", pan=(A(38, "window"), (0.5, 0.5)), vignette=0.4,
                         fade_out=(t1 - 0.7, 0.65),
                         fx=[dict(type="stink", at=A(38, "window"), scale=1.0, n=3, amount=1.0, t0=t0 + 0.1, fade_in=0.5),
                             dict(type="sparkles", at=(0.5, 0.2), radius=420, n=6, rate=0.7)]),
    }
    return F[i]() if i in F else dict(push=(1.0, 1.06))
