"""Per-shot camera moves + 2D effects for the balls-double reel: slow pushes (the reference keeps moving), hits on
the impacts, the reference's black labels with gold pointer lines, the news header + ticker, the white flash."""
from events import T, shot

LBL = lambda text, t0, at=None, **k: dict(type="label", text=text, t0=t0, **({"at": at} if at else {}), **k)


def shot_fx(i):
    t0, t1 = shot(i)
    F = {
        1: lambda: dict(push=(1.0, 1.04)),
        2: lambda: dict(push=(1.0, 1.03)),
        3: lambda: dict(push=(1.0, 1.05), punch=[(T["land"], 1.03)]),
        4: lambda: dict(push=(1.02, 1.1), push_ease="out"),
        5: lambda: dict(push=(1.0, 1.06), push_ease="out"),
        6: lambda: dict(push=(1.0, 1.04), fx=[LBL("MELON SIZE", t0 + 0.3, "bulge", off=(-250, -330), size=54)]),
        7: lambda: dict(push=(1.0, 1.04), punch=[(T["ding41"], 1.05)], shake=[(T["onscale"], 10, 0.3, 24)]),
        8: lambda: dict(push=(1.0, 1.04)),
        9: lambda: dict(push=(1.0, 1.05), shake=[(t0, 5, t1 - t0, 34)]),
        10: lambda: dict(push=(1.0, 1.03), shake=[(T["crack"], 36, 0.55, 24)], flash=[(T["crack"], 0.25, 0.1)]),
        11: lambda: dict(push=(1.0, 1.04)),
        12: lambda: dict(push=(1.0, 1.03), fx=[LBL("1.3 TONS", t0 + 0.25, "spheres", off=(0, -300), size=64)]),
        13: lambda: dict(push=(1.0, 1.04), shake=[(t0, 4, t1 - t0, 20)]),
        14: lambda: dict(push=(1.0, 1.04)),
        15: lambda: dict(push=(1.0, 1.03), shake=[(t0, 7, t1 - t0, 22)]),
        16: lambda: dict(push=(1.0, 1.05), fx=[LBL("DAMAGE: 0%", t0 + 0.12, pos=(0.5, 0.17), size=96, pointer=False)]),
        17: lambda: dict(push=(1.0, 1.04)),
        18: lambda: dict(push=(1.0, 1.02), fx=[LBL("HIM", t0 + 0.3, "him", off=(0, -200), size=50)]),
        19: lambda: dict(push=(1.0, 1.03), vignette=0.1, fx=[dict(type="news", title="BALL-POCALYPSE")]),
        20: lambda: dict(push=(1.0, 1.04)),
        21: lambda: dict(push=(1.0, 1.04), fx=[LBL("MOM", t0 + 0.2, "mom", off=(-40, -230), size=60)]),
        22: lambda: dict(push=(1.0, 1.04), shake=[(t0, 10, 0.7, 20)]),
        23: lambda: dict(push=(1.0, 1.04)),
        24: lambda: dict(push=(1.0, 1.03), fx=[LBL("8 BILLION PEOPLE", t0 + 0.15, "people", off=(150, -300), size=46)]),
        25: lambda: dict(push=(1.0, 1.03), shake=[(T["slam"], 22, 0.45, 24)], fx=[LBL("8 BILLION PEOPLE", t0 - 0.5, "people", off=(150, -300), size=46)]),
        26: lambda: dict(push=(1.0, 1.04), fx=[LBL("EARTH", t0 + 0.15, "earth", off=(0, -150), size=46),
                                              LBL("HIM (SOMEWHERE)", t0 + 0.35, "him", off=(-60, -330), size=44)]),
        27: lambda: dict(push=(1.0, 1.1), push_ease="in", shake=[(t0 + 0.3, 6, t1 - t0 - 0.3, 26)]),
        28: lambda: dict(push=(1.0, 1.12), push_ease="in", shake=[(t0, 10, t1 - t0, 30)], whiteout=(t1 - 0.4, t1)),
        29: lambda: dict(push=(1.0, 1.05), flash=[(t0, 1.0, 0.5)]),
        30: lambda: dict(push=(1.0, 1.02)),
        31: lambda: dict(push=(1.0, 1.05)),
    }
    return F[i]() if i in F else dict(push=(1.0, 1.04))
