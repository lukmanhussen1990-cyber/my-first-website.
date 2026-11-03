"""Per-shot camera moves and cartoon effects (render.py). Effects with a named "at" follow that anchor frame by frame
(the 3D renderer measures it: build/anchors/shot_XX_frames.json).
Keys: push | pan | punch [(t, k)] | pulse | shake [(t, px, d, hz)] | handheld | flash | grade | vignette |
fx [sweat, stink, cloud, rumble, sparkles, speedlines] | fade_out."""
from events import T, word, line, shot

LOUD_SHAKE = lambda li, px=14: [(line(li)[0], px, 0.45, 26)]      # loud lines: BIG CAPS + a small screen shake


def shot_fx(i):
    t0, t1 = shot(i)
    hh = 2.0
    sweat = lambda at="forehead", d0=0.15, **k: dict(type="sweat", at=at, t0=t0 + d0, dist=k.get("dist", 80), slide=k.get("slide", 0.9), scale=k.get("scale", 1.2))
    F = {
        1: lambda: dict(push=(1.0, 1.08), handheld=hh, fx=[sweat(d0=0.5)]),
        2: lambda: dict(push=(1.0, 1.06), punch=[(x, 1.03) for x in T["x_marks"]]),
        3: lambda: dict(push=(1.05, 1.15), push_ease="lin", punch=[(T["x_five"] + 0.2, 1.12)], shake=[(T["x_five"] + 0.2, 8, 0.3, 26)]),
        4: lambda: dict(push=(1.0, 1.06), fx=[sweat(d0=0.2)]),
        5: lambda: dict(push=(1.0, 1.18), push_ease="lin", pulse=[(T["wobble"] + 0.3, 1.04, 0.3), (T["wobble"] + 0.7, 1.03, 0.3)]),
        6: lambda: dict(push=(1.0, 1.06), handheld=hh),
        7: lambda: dict(push=(1.0, 1.1), punch=[(T["gasp"], 1.1)], shake=[(T["gasp"], 8, 0.3, 24)]),
        8: lambda: dict(push=(1.0, 1.08), handheld=hh),
        9: lambda: dict(push=(1.0, 1.06), punch=[(T["press"], 1.06)], shake=[(T["boing"], 10, 0.4, 20)]),
        10: lambda: dict(push=(1.0, 1.08), push_ease="lin"),
        11: lambda: dict(push=(1.0, 1.12), push_ease="lin", fx=[dict(type="sparkles", at="glasses", radius=60, n=3, rate=1.6, t0=T["shine"] - 0.1, t1=T["shine"] + 0.6)]),
        12: lambda: dict(push=(1.0, 1.06)),
        13: lambda: dict(push=(1.0, 1.1), fx=[dict(type="sparkles", at="bottle", radius=220, n=12, rate=1.4), dict(type="glow", at="bottle", radius=420, amount=0.25, pulse=0.3, hz=1.5, rays=8, color=(255, 140, 210))]),
        14: lambda: dict(push=(1.0, 1.06), punch=[(word(10, 1), 1.1)]),
        15: lambda: dict(push=(1.0, 1.08), punch=[(line(11)[0], 1.15)], shake=LOUD_SHAKE(11, 16)),
        16: lambda: dict(push=(1.0, 1.06), pulse=[(x, 1.04, 0.15) for x in T["pills"]]),
        17: lambda: dict(push=(1.0, 1.08), push_ease="lin"),
        18: lambda: dict(push=(1.0, 1.06)),
        19: lambda: dict(push=(1.0, 1.04), pulse=[(T["tick"], 1.04, 0.15)]),
        20: lambda: dict(push=(1.0, 1.06)),
        21: lambda: dict(push=(1.0, 1.15), push_ease="in", punch=[(T["freeze"], 1.08)], fx=[sweat(d0=0.4, dist=60)]),
        22: lambda: dict(push=(1.0, 1.08), shake=[(t0, 6, t1 - t0, 30)], fx=[dict(type="rumble", at="belly", radius=300, n=6)]),
        23: lambda: dict(push=(1.0, 1.06), shake=[(t0, 4, t1 - t0, 30)], fx=[sweat(d0=0.1), sweat(d0=0.6, dist=70), dict(type="rumble", at="belly", radius=280, n=6)]),
        24: lambda: dict(push=(1.0, 1.12), punch=[(line(19)[0], 1.2)], shake=LOUD_SHAKE(19, 26) + [(line(19)[0] + 0.4, 12, 0.6, 22)],
                         fx=[dict(type="rumble", at="belly", radius=380, n=8)]),
        25: lambda: dict(push=(1.05, 1.12), punch=[(t0 + 0.05, 1.06)]),
        26: lambda: dict(push=(1.05, 1.12), punch=[(t0 + 0.05, 1.06)]),
        27: lambda: dict(push=(1.05, 1.12), punch=[(t0 + 0.05, 1.06)]),
        28: lambda: dict(push=(1.05, 1.12), punch=[(t0 + 0.05, 1.06)]),
        29: lambda: dict(push=(1.0, 1.04), fx=[dict(type="speedlines", t0=t0, t1=t1, n=36, amount=0.3, inner=0.42), sweat(d0=0.1, dist=90)]),
        30: lambda: dict(push=(1.0, 1.06)),
        31: lambda: dict(push=(1.0, 1.04)),
        32: lambda: dict(push=(1.0, 1.12), push_ease="lin", fx=[sweat(d0=0.05, dist=140, slide=1.0, scale=1.9), sweat("forehead2", d0=0.35, dist=120, slide=0.9, scale=1.7)]),
        33: lambda: dict(push=(1.0, 1.04), shake=LOUD_SHAKE(25, 14) + [(x, 4, 0.1, 30) for x in T["bangs"] if t0 <= x < t1]),
        34: lambda: dict(push=(1.05, 1.1), shake=[(x, 7, 0.12, 30) for x in T["bangs"] if t0 <= x < t1]),
        35: lambda: dict(push=(1.0, 1.1), push_ease="lin"),
        36: lambda: dict(push=(1.0, 1.08), punch=[(t0 + 0.1, 1.08)]),
        37: lambda: dict(push=(1.0, 1.2), push_ease="in"),
        38: lambda: dict(push=(1.0, 1.0), flash=[(T["happens"] + 0.05, 0.5, 0.15)], shake=[(T["happens"] + 0.05, 26, 0.8, 22)],
                         grade=dict(tint=((150, 255, 170), 0.15)), fx=[dict(type="cloud", at="cloud", t0=T["happens"] + 0.05, size=1.0, amount=0.85)]),
        39: lambda: dict(push=(1.0, 1.06), shake=[(t0, 8, 0.5, 20)], fx=[dict(type="cloud", at="cloud", t0=t0 - 0.9, size=1.2, amount=0.75)]),
        40: lambda: dict(push=(1.0, 1.05), fx=[dict(type="stink", at="shoes", scale=1.2, n=3, amount=1.0, t0=t0 + 1.2, fade_in=0.4)]),
        41: lambda: dict(push=(1.0, 1.03), grade=dict(desat=0.25), fx=[dict(type="stink", at="cloud", scale=1.4, n=4, amount=0.9)]),
        42: lambda: dict(push=(1.0, 1.04), fx=[dict(type="speedlines", t0=t0, t1=t1, n=40, amount=0.35, inner=0.4)]),
        43: lambda: dict(push=(1.0, 1.06), push_ease="lin"),
        44: lambda: dict(push=(1.0, 1.06), push_ease="lin"),
        45: lambda: dict(push=(1.0, 1.08), push_ease="lin", fx=[dict(type="stink", at="shoes", scale=1.1, n=3, amount=1.0)]),
        46: lambda: dict(push=(1.0, 1.08), push_ease="lin"),
        47: lambda: dict(push=(1.0, 1.06), punch=[(T["fifty"], 1.12)]),
        48: lambda: dict(push=(1.0, 1.06), punch=[(T["five_hundred"], 1.08)], shake=[(T["five_hundred"], 8, 0.3, 24)],
                         fade_out=(t1 - 0.45, 0.42)),
    }
    return F[i]() if i in F else dict(push=(1.0, 1.06))
