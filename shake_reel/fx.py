"""Per-shot camera moves + 2D effects for the bed-shake reel, like the reference: comic sound words (SHAKE, BANG!,
CLANK, RUMBLE, SCREEECH!, DING!, BOOM), the white timer-style counter box, the EARTHQUAKE news with a seismograph,
music notes, shakes on every rumble."""
from events import T, shot, cut

WHITE, ORANGE, YELLOW = (255, 255, 255), (255, 96, 48), (255, 216, 42)
W_ = lambda text, t0, pos, size=86, color=WHITE, angle=0, dur=0.7: dict(type="word", text=text, t0=t0, t1=t0 + dur, pos=pos, size=size, color=color, angle=angle)
COUNT = lambda text, t0: dict(type="label", text=text, t0=t0, pos=(0.3, 0.2), size=74, pointer=False, border=False, fill=(250, 250, 248), text_col=(226, 40, 46))
NOTES = lambda at, t0, **k: dict(type="notes", at=at, t0=t0, n=k.get("n", 10), size=k.get("size", 30), radius=k.get("radius", 300), rise=k.get("rise", 700))


def shot_fx(i):
    t0, t1 = shot(i)
    F = {
        1: lambda: dict(push=(1.0, 1.04), shake=[(t0, 4, t1 - t0, 30)], fx=[W_("SHAKE", t0 + 0.35, (0.3, 0.3), 74, angle=8, dur=0.8), W_("SHAKE", t0 + 1.2, (0.7, 0.25), 74, angle=-8, dur=0.8),
                                                                           W_("SHAKE", t0 + 2.1, (0.36, 0.22), 74, angle=-6, dur=0.7), W_("SHAKE", cut(1) + 0.05, (0.3, 0.3), 74, angle=8),
                                                                           dict(type="sweat", at="forehead", t0=cut(1) + 0.05, dist=90, slide=1.4, scale=1.3)]),
        2: lambda: dict(push=(1.0, 1.04), shake=[(t0, 5, t1 - t0, 30)], fx=[W_("SHAKE", t0 + 0.1, (0.32, 0.22), 74, angle=-8), W_("SHAKE", t0 + 0.6, (0.68, 0.3), 74, angle=8),
                                                                           dict(type="sweat", at="forehead", t0=t0 - 0.4, dist=110, slide=1.6, scale=1.3)]),
        3: lambda: dict(push=(1.0, 1.03), shake=[(t0, 3, t1 - t0, 30)], fx=[W_("AAAH!", t0 + 0.05, (0.45, 0.52), 84, YELLOW, angle=-6)]),
        4: lambda: dict(push=(1.0, 1.04)),
        5: lambda: dict(push=(1.0, 1.05), fx=[COUNT("x 247", t0 + 0.1)]),
        6: lambda: dict(push=(1.0, 1.04)),
        7: lambda: dict(push=(1.0, 1.04), shake=[(h, 10, 0.12, 30) for h in T["hammer"]], fx=[W_("BANG!", h, (0.3 + 0.2 * (k % 3), 0.28 + 0.06 * (k % 2)), 100, ORANGE, angle=(-1) ** k * 10, dur=0.3) for k, h in enumerate(T["hammer"])]),
        8: lambda: dict(push=(1.0, 1.04), shake=[(t0, 10, t1 - t0, 26)], fx=[W_("RUMBLE", t0 + 0.08, (0.5, 0.2), 80, angle=-4, dur=1.2)]),
        9: lambda: dict(push=(1.0, 1.06), fx=[W_("CREAK", t0 + 0.2, (0.3, 0.28), 64, angle=-10)]),
        10: lambda: dict(push=(1.0, 1.05), fx=[NOTES("chand", t0, n=12, size=30, radius=260)]),
        11: lambda: dict(push=(1.0, 1.05), shake=[(c, 6, 0.1, 30) for c in T["clank"]], fx=[W_("CLANK", c, (0.32 + 0.3 * (k % 2), 0.3), 84, angle=(-1) ** k * 8, dur=0.32) for k, c in enumerate(T["clank"])]),
        12: lambda: dict(push=(1.0, 1.03), fx=[W_("CLANK!", T["bolts"][0], (0.3, 0.16), 72, angle=-8, dur=0.5), W_("CLANK!", T["bolts"][4], (0.7, 0.24), 72, angle=8, dur=0.5)]),
        13: lambda: dict(push=(1.0, 1.04), shake=[(t0, 16, t1 - t0, 24)], fx=[W_("RUMBLE", t0 + 0.08, (0.5, 0.14), 96, angle=-4, dur=1.0), W_("CRACK!", T["crack"] + 0.05, (0.62, 0.24), 100, ORANGE, angle=8, dur=0.7)]),
        14: lambda: dict(push=(1.0, 1.03), vignette=0.1, fx=[dict(type="news", title="EARTHQUAKE", ticker="MAGNITUDE 6.9  •  EPICENTER: APARTMENT 2B  •  "), dict(type="seismo", x=0.56, y=0.2)]),
        15: lambda: dict(push=(1.0, 1.04), shake=[(t0, 3, t1 - t0, 12)]),
        16: lambda: dict(push=(1.0, 1.04), shake=[(T["basement"], 6, t1 - T["basement"], 30)], fx=[W_("SHAKE", T["basement"] + 0.02, (0.5, 0.3), 72, angle=-6)]),
        17: lambda: dict(push=(1.0, 1.06), push_ease="in", shake=[(t0, 5, t1 - t0, 22)], fx=[W_("RUMBLE", t0 + 0.1, (0.5, 0.2), 80, angle=4, dur=0.9)]),
        18: lambda: dict(push=(1.0, 1.04), shake=[(t0, 18, 0.5, 24)], fx=[W_("SCREEECH!", t0 + 0.02, (0.5, 0.2), 92, ORANGE, angle=-6, dur=0.75),
                                                                       dict(type="label", text="SERVICE SUSPENDED", t0=t0 + 0.3, pos=(0.5, 0.33), size=58, pointer=False, border=False, fill=(214, 30, 40))]),
        19: lambda: dict(push=(1.0, 1.04), punch=[(T["ding"], 1.05)], fx=[W_("DING!", T["ding"], (0.72, 0.2), 90, YELLOW, angle=10, dur=0.6)]),
        20: lambda: dict(push=(1.0, 1.04), pulse=[(d, 1.03, 0.12) for d in T["drum"]], fx=[W_("BOOM", d, (0.3 + 0.4 * (k % 2), 0.22), 88, ORANGE, angle=(-1) ** k * 8, dur=0.35) for k, d in enumerate(T["drum"])]),
        21: lambda: dict(push=(1.0, 1.04), pulse=[(d, 1.02, 0.1) for d in T["beat"][::2]],
                         fx=[dict(type="label", text="120 BPM", t0=t0 + 0.05, pos=(0.5, 0.17), size=74, pointer=False, border=False, fill=(24, 26, 36))] + [NOTES("drum", t0, n=8)] if False else
                            [dict(type="label", text="120 BPM", t0=t0 + 0.05, pos=(0.5, 0.17), size=74, pointer=False, border=False, fill=(24, 26, 36))]),
        22: lambda: dict(push=(1.0, 1.04)),
        23: lambda: dict(push=(1.0, 1.04), pulse=[(t0 + k * 0.5, 1.02, 0.14) for k in range(4)], fx=[NOTES("couple", t0, n=12, radius=330), W_("WOO!", t0 + 0.3, (0.72, 0.24), 84, YELLOW, angle=10, dur=0.8)]),
        24: lambda: dict(push=(1.0, 1.03), pulse=[(t0 + k * 0.5, 1.015, 0.14) for k in range(4)], fx=[COUNT("x 248", t0 + 0.1)]),
        25: lambda: dict(push=(1.0, 1.05), fx=[NOTES("him", t0, n=8, radius=280, rise=600)], fade_out=(t1 - 0.3, 0.28)),
    }
    return F[i]() if i in F else dict(push=(1.0, 1.04))
