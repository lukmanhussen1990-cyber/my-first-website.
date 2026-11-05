"""Per-shot camera moves + 2D effects for the balloon reel (SEMIGENIUS style): sound words (VRRRR, BOING!, PFFFFFT!,
RIIIP, SQUISH, VRRROOOM, BOOM!), the white timer boxes (10:00, 3:47:00, 0:01), ARM / LEG labels, sweat, sparkles."""
from events import T, shot, cut

WHITE, ORANGE, YELLOW, PINK = (255, 255, 255), (255, 96, 48), (255, 216, 42), (255, 120, 190)
W_ = lambda text, t0, pos, size=86, color=WHITE, angle=0, dur=0.7: dict(type="word", text=text, t0=t0, t1=t0 + dur, pos=pos, size=size, color=color, angle=angle)
TIMER = lambda text, t0, pos=(0.3, 0.2): dict(type="label", text=text, t0=t0, pos=pos, size=74, pointer=False, border=False, fill=(250, 250, 248), text_col=(226, 40, 46))
LBL = lambda text, t0, at, off, size=56: dict(type="label", text=text, t0=t0, at=at, off=off, size=size)


def shot_fx(i):
    t0, t1 = shot(i)
    F = {
        1: lambda: dict(push=(1.0, 1.05), pulse=[(t0 + k * 0.9, 1.012, 0.3) for k in range(1)], fx=[dict(type="sweat", at="kid", t0=t0 + 0.1, dist=80, slide=1.2, scale=1.2)]),
        2: lambda: dict(push=(1.0, 1.05), fx=[TIMER("10:00", t0 + 0.05, (0.72, 0.2))]),
        3: lambda: dict(push=(1.0, 1.04), punch=[(T["reveal"], 1.04)]),
        4: lambda: dict(push=(1.0, 1.04)),
        5: lambda: dict(push=(1.0, 1.05), shake=[(t0, 3, t1 - t0, 40)], fx=[W_("VRRRR", t0 + 0.05, (0.5, 0.22), 92, angle=-6, dur=t1 - t0)]),
        6: lambda: dict(push=(1.0, 1.08), push_ease="in", fx=[W_("HOT!", t0 + 0.2, (0.72, 0.22), 96, ORANGE, angle=10)]),
        7: lambda: dict(push=(1.0, 1.03), punch=[(T["boing"], 1.06)], fx=[W_("BOING!", T["boing"], (0.5, 0.18), 110, PINK, angle=-8, dur=0.9)]),
        8: lambda: dict(push=(1.0, 1.06), fx=[W_("SIZZLE", t0 + 0.1, (0.3, 0.26), 72, ORANGE, angle=-8, dur=0.8)]),
        9: lambda: dict(push=(1.0, 1.03), shake=[(t0, 14, t1 - t0, 30)], fx=[W_("PFFFFFT!", t0 + 0.05, (0.5, 0.2), 110, YELLOW, angle=-5, dur=t1 - t0 - 0.05)]),
        10: lambda: dict(push=(1.0, 1.04), fx=[W_("RIIIP", T["tape"] - 0.1, (0.62, 0.22), 92, angle=8, dur=0.7)]),
        11: lambda: dict(push=(1.0, 1.05), fx=[TIMER("3:47:00", t0 + 0.05, (0.32, 0.2)), dict(type="sweat", at="kid", t0=t0 + 0.05, dist=90, slide=1.0, scale=1.2)] if False else [TIMER("3:47:00", t0 + 0.05, (0.32, 0.2))]),
        12: lambda: dict(push=(1.0, 1.04), shake=[(t0, 3, t1 - t0, 36)], fx=[W_("PUMP PUMP PUMP", t0 + 0.05, (0.5, 0.18), 70, angle=-4, dur=t1 - t0)]),
        13: lambda: dict(push=(1.0, 1.04), fx=[LBL("ARM", t0 + 0.15, "arm", (-230, -220), 60), LBL("LEG", t0 + 0.35, "leg", (240, -120), 60)]),
        14: lambda: dict(push=(1.0, 1.05), fx=[W_("SQUISH", T["squish"] + 0.05, (0.62, 0.24), 86, angle=8, dur=0.9)]),
        15: lambda: dict(push=(1.0, 1.04), shake=[(T["vroom"], 6, t1 - T["vroom"], 34)], fx=[W_("VRRROOOM!", T["vroom"] + 0.02, (0.5, 0.2), 96, ORANGE, angle=-6, dur=t1 - T["vroom"])]),
        16: lambda: dict(push=(1.0, 1.03), shake=[(T["boom"], 22, 0.5, 24)], flash=[(T["boom"] + 0.15, 0.25, 0.1)], fx=[W_("BOOM!", T["boom"] + 0.15, (0.5, 0.2), 120, ORANGE, angle=-8, dur=0.9), TIMER("0:01", T["timer"], (0.7, 0.3))]),
        17: lambda: dict(push=(1.0, 1.04), fx=[W_("MEOW", t0 + 0.2, (0.66, 0.24), 76, angle=8, dur=0.7)]),
        18: lambda: dict(push=(1.0, 1.03), shake=[(t0, 4, t1 - t0, 20)]),
        19: lambda: dict(push=(1.0, 1.05), fx=[dict(type="sparkles", at="ride", t0=t0, n=14, radius=380, rate=1.6)]),
        20: lambda: dict(push=(1.0, 1.05), fade_out=(t1 - 0.3, 0.28)),
    }
    return F[i]() if i in F else dict(push=(1.0, 1.04))
