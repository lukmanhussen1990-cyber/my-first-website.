"""Per-shot camera moves and cartoon effects (render.py). Effects with a named "at" follow that 3D anchor frame by
frame (measured by the 3D renderer: build/anchors/shot_XX_frames.json); a tuple "at" is a point on the screen.
Keys: push | punch [(t, k)] | pulse | shake [(t, px, d, hz)] | handheld | flash | grade | vignette | fade_out |
fx [hearts, bigheart, sparkles, glow, sweat, tears, speedlines, rumble]."""
from events import T, word, line, shot


def shot_fx(i):
    t0, t1 = shot(i)
    sweat = lambda at="forehead", d0=0.1, **k: dict(type="sweat", at=at, t0=t0 + d0, dist=k.get("dist", 80), slide=k.get("slide", 0.9), scale=k.get("scale", 1.2))
    hearts = lambda at="head", d0=0.0, **k: dict(type="hearts", at=at, t0=t0 + d0, n=k.get("n", 8), radius=k.get("radius", 210), size=k.get("size", 46), rate=k.get("rate", 0.9), rise=k.get("rise", 460))
    spark = lambda at, **k: dict(type="sparkles", at=at, radius=k.get("radius", 260), n=k.get("n", 12), rate=k.get("rate", 1.5), t0=k.get("t0", t0))
    glow = lambda at, **k: dict(type="glow", at=at, radius=k.get("radius", 460), amount=k.get("amount", 0.25), pulse=0.3, hz=1.2, rays=k.get("rays", 8), color=k.get("color", (120, 210, 255)))
    tears = lambda **k: dict(type="tears", at=["eyeL", "eyeR"], t0=t0 + k.get("d0", 0.1), fly=k.get("fly", 0.6), rate=1.6, size=18)
    F = {
        1: lambda: dict(push=(1.0, 1.08), push_ease="lin"),
        2: lambda: dict(push=(1.0, 1.08), shake=[(T["rumble"], 10, 0.9, 26)], fx=[dict(type="rumble", at="belly", radius=230, n=6, t0=T["rumble"]), sweat(d0=0.5)]),
        3: lambda: dict(push=(1.05, 1.18), push_ease="lin", shake=[(t0 + 0.05, 14, 0.6, 26)], fx=[sweat(d0=0.05, dist=120, scale=1.6), sweat("forehead2", d0=0.4, dist=110, scale=1.5)]),
        4: lambda: dict(push=(1.0, 1.06), fx=[dict(type="speedlines", t0=t0, t1=t1, n=30, amount=0.25, inner=0.45), sweat(d0=0.1)]),
        5: lambda: dict(push=(1.0, 1.08), shake=[(T["rattle"], 6, 0.9, 28)], fx=[sweat(d0=0.2)]),
        6: lambda: dict(push=(1.0, 1.06)),
        7: lambda: dict(push=(1.0, 1.1), push_ease="lin"),
        8: lambda: dict(push=(1.0, 1.12), punch=[(t0 + 0.3, 1.08)]),
        9: lambda: dict(push=(1.0, 1.04), fx=[spark("mansion", radius=480, n=16), glow("mansion", radius=700, amount=0.18, color=(150, 220, 255))]),
        10: lambda: dict(push=(1.0, 1.05), punch=[(x, 1.03) for x in T["knocks1"]], shake=[(x, 5, 0.12, 30) for x in T["knocks1"]]),
        11: lambda: dict(push=(1.0, 1.08), push_ease="lin"),
        12: lambda: dict(push=(1.0, 1.12), push_ease="lin"),
        13: lambda: dict(push=(1.0, 1.04), shake=[(T["slam"], 22, 0.5, 24)], punch=[(T["slam"], 1.1)]),
        14: lambda: dict(push=(1.0, 1.04), shake=[(x, 9, 0.12, 30) for x in T["knocks2"]], fx=[sweat(d0=0.2)]),
        15: lambda: dict(push=(1.0, 1.1), fx=[glow("door", radius=700, amount=0.35, color=(170, 225, 255), rays=12)]),
        16: lambda: dict(push=(1.0, 1.08), push_ease="lin", fx=[glow("owner", radius=650, amount=0.22, color=(170, 225, 255), rays=12), spark("head", radius=300, n=8)]),
        17: lambda: dict(push=(1.0, 1.06), punch=[(T["kneel"] + 0.25, 1.06)], shake=[(T["kneel"] + 0.25, 6, 0.25, 24)]),
        18: lambda: dict(push=(1.0, 1.1), push_ease="lin", fx=[sweat(d0=0.05, dist=100, scale=1.4), sweat("forehead2", d0=0.5, dist=90, scale=1.3)]),
        19: lambda: dict(push=(1.0, 1.06)),
        20: lambda: dict(push=(1.0, 1.04), punch=[(T["smile"], 1.06)], fx=[spark("smile", radius=60, n=3, rate=1.4, t0=T["smile"])]),
        21: lambda: dict(push=(1.0, 1.06)),
        22: lambda: dict(push=(1.0, 1.1), push_ease="lin", fx=[glow("top", radius=520, amount=0.3, color=(120, 210, 255), rays=10), spark("stairs", radius=380, n=14)]),
        23: lambda: dict(push=(1.0, 1.06), fx=[spark("head", radius=320, n=10)]),
        24: lambda: dict(push=(1.0, 1.06), punch=[(T["kiss"], 1.1)], fx=[hearts("cheek", d0=0.32, n=6, radius=120, size=40)]),
        25: lambda: dict(push=(1.0, 1.08), punch=[(T["hearts1"], 1.12)], fx=[hearts(d0=0.15, n=10)]),
        26: lambda: dict(push=(1.0, 1.04), fx=[dict(type="speedlines", t0=t0, t1=t1, n=40, amount=0.35, inner=0.42)]),
        27: lambda: dict(push=(1.0, 1.1), push_ease="lin", fx=[glow("toilet", radius=520, amount=0.35, color=(80, 200, 255), rays=12), spark("toilet", radius=330, n=16)]),
        28: lambda: dict(push=(1.0, 1.04), shake=[(T["plop"], 10, 0.35, 24)], punch=[(T["plop"], 1.06)]),
        29: lambda: dict(push=(1.0, 1.04), shake=[(t0, 6, t1 - t0, 20)], fx=[spark("chand", radius=300, n=10)]),
        30: lambda: dict(push=(1.0, 1.04), shake=[(t0, 5, 0.8, 18)]),
        31: lambda: dict(push=(1.0, 1.06), fx=[spark("head", radius=160, n=5, rate=1.2)]),
        32: lambda: dict(push=(1.0, 1.1), push_ease="lin", fx=[hearts(n=10)]),
        33: lambda: dict(push=(1.0, 1.06), fx=[glow("candles", radius=360, amount=0.22, color=(120, 200, 255), rays=0)]),
        34: lambda: dict(push=(1.0, 1.06)),
        35: lambda: dict(push=(1.0, 1.08), push_ease="lin"),
        36: lambda: dict(push=(1.0, 1.06)),
        37: lambda: dict(push=(1.0, 1.06)),
        38: lambda: dict(push=(1.0, 1.08), push_ease="lin"),
        39: lambda: dict(push=(1.0, 1.06)),
        40: lambda: dict(push=(1.0, 1.08), push_ease="lin"),
        41: lambda: dict(push=(1.0, 1.06)),
        42: lambda: dict(push=(1.05, 1.15), push_ease="lin"),
        43: lambda: dict(push=(1.0, 1.06)),
        44: lambda: dict(push=(1.0, 1.08), punch=[(T["hearts_couch"], 1.1)], fx=[hearts(d0=0.15, n=8)]),
        45: lambda: dict(push=(1.0, 1.06), fx=[hearts(n=8), hearts("head2", n=8)]),
        46: lambda: dict(push=(1.0, 1.06)),
        47: lambda: dict(push=(1.0, 1.06), fx=[spark((0.5, 0.5), radius=300, n=8)]),
        48: lambda: dict(push=(1.0, 1.06), push_ease="lin", fx=[spark("tower", radius=380, n=12)]),
        49: lambda: dict(push=(1.0, 1.06)),
        50: lambda: dict(push=(1.0, 1.06)),
        51: lambda: dict(push=(1.0, 1.08), fx=[hearts(n=8), dict(type="bigheart", at=(0.72, 0.3), t0=line(37)[0], size=300, amount=0.8)]),
        52: lambda: dict(push=(1.0, 1.06), fx=[dict(type="bigheart", at="mid", t0=t0 + 0.05, size=560, amount=0.6, hz=1.4), hearts(n=7), hearts("head2", n=7)]),
        53: lambda: dict(push=(1.0, 1.06), fx=[spark((0.5, 0.65), radius=420, n=12, rate=1.0)]),
        54: lambda: dict(push=(1.0, 1.06)),
        55: lambda: dict(push=(1.0, 1.06)),
        56: lambda: dict(push=(1.0, 1.12), punch=[(t0 + 0.05, 1.06)]),
        57: lambda: dict(push=(1.0, 1.08), fx=[spark("ring", radius=120, n=8, t0=T["box_open"] + 0.2)]),
        58: lambda: dict(push=(1.0, 1.06)),
        59: lambda: dict(push=(1.0, 1.1), push_ease="lin", fx=[spark("diamond", radius=260, n=16, rate=1.8), glow("diamond", radius=420, amount=0.35, color=(255, 240, 200), rays=12)]),
        60: lambda: dict(push=(1.0, 1.08), fx=[tears(), hearts(d0=0.6, n=12, radius=320)]),
        61: lambda: dict(push=(1.0, 1.06), fx=[tears(fly=0.3), hearts("couple", n=10, radius=260)]),
        62: lambda: dict(push=(1.0, 1.06)),
        63: lambda: dict(push=(1.0, 1.06)),
        64: lambda: dict(push=(1.0, 1.08), push_ease="lin", fx=[glow("toilet", radius=520, amount=0.3, color=(80, 200, 255), rays=12), spark("toilet", radius=330, n=14), spark("potty", radius=120, n=6)]),
        65: lambda: dict(push=(1.0, 1.06), fx=[spark("mansion", radius=480, n=10, rate=0.8)]),
        66: lambda: dict(push=(1.0, 1.0)),
        67: lambda: dict(push=(1.0, 1.08), fx=[hearts(d0=0.2, n=8)]),
        68: lambda: dict(push=(1.0, 1.06), fx=[hearts(n=8), hearts("head2", n=8), dict(type="bigheart", at="mid", t0=t0 + 0.3, size=260, amount=0.75)]),
        69: lambda: dict(push=(1.0, 1.08), push_ease="lin", fx=[glow("toilet", radius=520, amount=0.3, color=(80, 200, 255), rays=12), spark("toilet", radius=300, n=14)]),
        70: lambda: dict(push=(1.0, 1.0), fx=[glow("toilet", radius=420, amount=0.3, color=(80, 200, 255), rays=12), spark("toilet", radius=300, n=16)], fade_out=(t1 - 0.6, 0.55)),
    }
    return F[i]() if i in F else dict(push=(1.0, 1.06))
