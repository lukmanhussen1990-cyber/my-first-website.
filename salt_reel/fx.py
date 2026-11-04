"""Per-shot camera moves and cartoon effects for the salt reel (render.py). Named "at" anchors follow the 3D points
measured per frame (build/anchors/shot_XX_frames.json); a tuple "at" is a point on the screen (0..1)."""
from events import T, word, line, shot


def shot_fx(i):
    t0, t1 = shot(i)
    sweat = lambda at="forehead", d0=0.1, **k: dict(type="sweat", at=at, t0=t0 + d0, dist=k.get("dist", 80), slide=k.get("slide", 0.9), scale=k.get("scale", 1.2))
    F = {
        1: lambda: dict(push=(1.0, 1.08), shake=[(t0, 4, t1 - t0, 30)], fx=[sweat(d0=0.2), dict(type="speedlines", t0=t0, t1=t1, n=24, amount=0.18, inner=0.5)]),
        2: lambda: dict(push=(1.0, 1.04), shake=[(t0, 3, t1 - t0, 30)], fx=[sweat(d0=0.1, scale=0.9)]),
        3: lambda: dict(push=(1.0, 1.12), push_ease="lin"),
        4: lambda: dict(push=(1.0, 1.05), punch=[(T["slap"], 1.12)], shake=[(T["slap"], 18, 0.35, 26)]),
        5: lambda: dict(push=(1.0, 1.1), push_ease="lin"),
        6: lambda: dict(push=(1.0, 1.06), shake=[(t0, 4, 0.6, 28)], punch=[(T["lid"], 1.08)]),
        7: lambda: dict(push=(1.0, 1.06), shake=[(T["dump"], 10, 0.5, 22)], fx=[dict(type="saltfall", at="mouth", t0=T["dump"], t1=t0 + 0.55, n=220, rate=3.0, spread=60, fall=380)]),
        8: lambda: dict(push=(1.0, 1.15), push_ease="in", shake=[(line(6)[0], 12, 0.5, 26)], fx=[sweat(d0=0.1, dist=110, scale=1.5), sweat("forehead2", d0=0.4, dist=100, scale=1.4)]),
        9: lambda: dict(push=(1.0, 1.06)),
        10: lambda: dict(push=(1.0, 1.06), pulse=[(x, 1.03, 0.12) for x in T["pokes"] if t0 <= x < t1]),
        11: lambda: dict(push=(1.0, 1.2), push_ease="lin"),
        12: lambda: dict(push=(1.0, 1.06)),
        13: lambda: dict(push=(1.0, 1.08), push_ease="lin", fx=[dict(type="icecube", at="fries", t0=t0 + 0.1, size=150)]),
        14: lambda: dict(push=(1.0, 1.06), shake=[(t0, 3, t1 - t0, 34)], fx=[dict(type="icecube", at="fry", t0=t0 + 0.05, size=110)]),
        15: lambda: dict(push=(1.0, 1.06)),
        16: lambda: dict(push=(1.0, 1.05)),
        17: lambda: dict(push=(1.0, 1.1), push_ease="lin", pulse=[(x, 1.02, 0.08) for x in T["dial"]]),
        18: lambda: dict(push=(1.0, 1.08), push_ease="in", shake=[(t0, 6, t1 - t0, 34)], fx=[dict(type="rumble", at="blower", radius=260, n=8)]),
        19: lambda: dict(push=(1.0, 1.04), shake=[(T["boom"], 34, 0.7, 22)], flash=[(T["boom"], 1.0, 0.25)], fx=[dict(type="burst", at="blast", t0=T["boom"], n=260)]),
        20: lambda: dict(push=(1.0, 1.06), fx=[dict(type="snow", t0=t0, t1=t1, n=110, speed=180)]),
        21: lambda: dict(push=(1.0, 1.1), push_ease="lin", fx=[dict(type="snow", t0=t0, t1=t1, n=60, speed=120)], fade_out=(t1 - 0.7, 0.65)),
    }
    return F[i]() if i in F else dict(push=(1.0, 1.06))
