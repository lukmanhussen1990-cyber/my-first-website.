"""Per-shot camera moves + 2D effects for the ghost-girlfriend reel: music notes out of the car, a creepy push on
the ghost, shakes on the screams and the jump scare, sparkles on her face, heart eyes + a big BA-DUM heart, time
cards (WEEK 1 ...) in the reference label style, hearts on the dates, a fade out at the end."""
from events import T, shot, cut

CARD = lambda text, t0, **k: dict(type="label", text=text, t0=t0, pos=k.pop("pos", (0.5, 0.16)), size=k.pop("size", 78), pointer=False, **k)


def shot_fx(i):
    t0, t1 = shot(i)
    F = {
        1: lambda: dict(push=(1.0, 1.05), fx=[dict(type="notes", at="car", t0=t0 - 1, n=8, size=24)] if False else []),
        2: lambda: dict(push=(1.0, 1.04)),
        3: lambda: dict(push=(1.0, 1.04), pulse=[(t0 + k * 0.33, 1.025, 0.16) for k in range(5)], fx=[dict(type="notes", at="car", t0=t0, n=14, size=30, radius=320, rise=900)]),
        4: lambda: dict(push=(1.0, 1.05), pulse=[(t0 + k * 0.33, 1.025, 0.16) for k in range(4)]),
        5: lambda: dict(push=(1.0, 1.03), shake=[(T["sputter"], 8, 0.5, 22)]),
        6: lambda: dict(push=(1.0, 1.04), shake=[(T["dies"], 6, 0.3, 18)]),
        7: lambda: dict(push=(1.0, 1.06)),
        8: lambda: dict(push=(1.0, 1.14), push_ease="in"),
        9: lambda: dict(push=(1.02, 1.06), shake=[(t0, 22, 0.35, 26)], flash=[(t0, 0.18, 0.08)]),
        10: lambda: dict(push=(1.0, 1.04), shake=[(t0, 10, t1 - t0, 30)]),
        11: lambda: dict(push=(1.0, 1.03), shake=[(t0, 6, 0.8, 24)]),
        12: lambda: dict(push=(1.0, 1.05)),
        13: lambda: dict(push=(1.0, 1.06), push_ease="in"),
        14: lambda: dict(push=(1.0, 1.08), push_ease="in"),
        15: lambda: dict(push=(1.0, 1.08), fx=[dict(type="sparkles", at="face", t0=T["reveal"], n=14, radius=330, rate=1.4)]),
        16: lambda: dict(push=(1.0, 1.05), punch=[(t0 + 0.1, 1.06)]),
        17: lambda: dict(push=(1.0, 1.06), fx=[dict(type="hearts", at="eyes", t0=t0, n=10, radius=320, rise=600, size=54)]),
        18: lambda: dict(push=(1.0, 1.02), pulse=[(b, 1.06, 0.12) for b in T["badum"]], fx=[dict(type="bigheart", at="chest", t0=t0, hz=1.3, size=520)]),
        19: lambda: dict(push=(1.0, 1.04)),
        20: lambda: dict(push=(1.0, 1.04), fx=[CARD("WEEK 1", t0 + 0.05)]),
        21: lambda: dict(push=(1.0, 1.03)),
        22: lambda: dict(push=(1.0, 1.05), fx=[dict(type="sparkles", at="ghost", t0=t0, n=12, radius=300)]),
        23: lambda: dict(push=(1.0, 1.04), fx=[dict(type="hearts", at="eyes", t0=t0, n=8, radius=300, size=44)] if False else []),
        24: lambda: dict(push=(1.0, 1.06), fx=[CARD("MONTH 1", t0 + 0.05)]),
        25: lambda: dict(push=(1.0, 1.03)),
        26: lambda: dict(push=(1.0, 1.04)),
        27: lambda: dict(push=(1.0, 1.04), pulse=[(t0 + 0.2 + k * 0.42, 1.015, 0.14) for k in range(3)]),
        28: lambda: dict(push=(1.0, 1.03)),
        29: lambda: dict(push=(1.0, 1.04), fx=[CARD("MONTH 6", t0 + 0.05)]),
        30: lambda: dict(push=(1.0, 1.05)),
        31: lambda: dict(push=(1.0, 1.04), fx=[dict(type="sparkles", at="hands", t0=T["through"], n=10, radius=200, rate=2.0)]),
        32: lambda: dict(push=(1.0, 1.04), fx=[CARD("1 YEAR", t0 + 0.05)]),
        33: lambda: dict(push=(1.0, 1.05), fx=[dict(type="sparkles", at="ring", t0=t0 + 0.3, n=10, radius=150, rate=2.0)]),
        34: lambda: dict(push=(1.0, 1.05)),
        35: lambda: dict(push=(1.0, 1.04)),
        36: lambda: dict(push=(1.0, 1.04), fx=[dict(type="hearts", at="couple", t0=t0, n=12, radius=360, rise=700, size=50)]),
        37: lambda: dict(push=(1.0, 1.04), fx=[CARD("WEDDING DAY", t0 + 0.05, size=72)]),
        38: lambda: dict(push=(1.0, 1.06), pulse=[(b, 1.03, 0.2) for b in T["bells"]]),
        39: lambda: dict(push=(1.0, 1.04)),
        40: lambda: dict(push=(1.0, 1.03), shake=[(T["faint"], 14, 0.35, 22)]),
        41: lambda: dict(push=(1.0, 1.05)),
        42: lambda: dict(push=(1.0, 1.03)),
        43: lambda: dict(push=(1.0, 1.06), fade_out=(t1 - 0.45, 0.4)),
    }
    return F[i]() if i in F else dict(push=(1.0, 1.04))
