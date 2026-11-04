"""Per-shot camera moves + 2D effects for the Flash POV reel: rain on every outdoor shot, lightning flashes on the
beats (FLASH), red bolts + the rain vortex on "drink for me", speed lines when he zooms, the spark at the end."""
from events import T, B, FLASH, shot

RAIN = lambda **k: dict(type="rain", amount=k.get("amount", 1.0), slant=k.get("slant", 0.18), alpha=k.get("alpha", 0.55), speed=k.get("speed", 1.0), splash=k.get("splash", 1.0))


def flashes(t0, t1, a=0.45):
    return [(f, a, 0.12) for f in FLASH if t0 - 0.05 <= f < t1]


def shot_fx(i):
    t0, t1 = shot(i)
    F = {
        1: lambda: dict(push=(1.0, 1.05), flash=flashes(t0, t1, 0.18)),
        2: lambda: dict(push=(1.0, 1.04), shake=[(T["buzz"], 6, 0.35, 34)], punch=[(T["msg"], 1.06)]),
        3: lambda: dict(push=(1.0, 1.0), punch=[(T["wide"], 1.04)], flash=flashes(t0, t1, 0.15)),
        4: lambda: dict(push=(1.0, 1.12), push_ease="out", flash=[(T["drop"], 1.0, 0.35)], shake=[(T["drop"], 30, 0.9, 24)],
                        grade=dict(tint=((80, 60, 255), 0.18)),
                        fx=[dict(type="bolts", at="chest", t0=T["drop"], t1=T["drop"] + 0.75, n=8), dict(type="swirl", at="chest", t0=T["drop"] + 0.1, radius=420, n=150, height=1500)]),
        5: lambda: dict(push=(1.0, 1.1), push_ease="lin", shake=[(t0, 6, t1 - t0, 30)], fx=[dict(type="swirl", at="chest", t0=t0 - 0.5, radius=520, n=170, height=1900)]),
        6: lambda: dict(push=(1.04, 1.0), push_ease="out", fx=[dict(type="swirl", at="chest", t0=t0 - 1.0, radius=480, n=150, height=1700, alpha=0.6)]),
        7: lambda: dict(push=(1.0, 1.06), flash=flashes(t0, t1), pulse=[(s, 1.025, 0.18) for s in T["steps"] if t0 <= s < t1], fx=[RAIN(speed=0.45)]),
        8: lambda: dict(push=(1.0, 1.08), flash=flashes(t0, t1), pulse=[(s, 1.03, 0.18) for s in T["steps"] if t0 <= s < t1], fx=[RAIN(speed=0.45)]),
        9: lambda: dict(push=(1.0, 1.1), push_ease="in", flash=flashes(t0, t1, 0.3), shake=[(t0, 10, 0.4, 28)], fx=[RAIN(), dict(type="speedlines", t0=t0, t1=t1, n=40, amount=0.35, inner=0.4)]),
        10: lambda: dict(push=(1.0, 1.12), push_ease="in", flash=flashes(t0, t1, 0.3), fx=[RAIN(slant=0.08), dict(type="speedlines", t0=t0, t1=t1, n=30, amount=0.3, inner=0.45)]),
        11: lambda: dict(push=(1.0, 1.08), flash=flashes(t0, t1, 0.3), fx=[RAIN(), dict(type="speedlines", t0=t0, t1=t1, n=36, amount=0.3, inner=0.42)]),
        12: lambda: dict(push=(1.0, 1.06), flash=flashes(t0, t1, 0.3), shake=[(t0 + 0.15, 8, 0.3, 26)], fx=[RAIN()]),
        13: lambda: dict(push=(1.0, 1.1), push_ease="in", flash=flashes(t0, t1, 0.3), fx=[RAIN(alpha=0.45)]),
        14: lambda: dict(push=(1.0, 1.04), shake=[(T["screech"] + 0.2, 12, 0.3, 26)] + [(k, 4, 0.1, 30) for k in T["knocks"]], fx=[RAIN(alpha=0.5)]),
        15: lambda: dict(push=(1.0, 1.08), push_ease="lin", fx=[RAIN(alpha=0.5)]),
        16: lambda: dict(push=(1.06, 1.06), fx=[RAIN(alpha=0.5), dict(type="sweat", at="forehead", t0=t0 + 0.35, dist=110, slide=1.0, scale=1.4),
                                                dict(type="sparks", at="shoulder", t0=T["fizzle"], n=14, life=0.55)], fade_out=(t1 - 0.35, 0.33)),
    }
    return F[i]() if i in F else dict(push=(1.0, 1.05))
