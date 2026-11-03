"""Per-shot camera moves and cartoon effects for render.py (times are absolute seconds on the voiceover).
Every shot is a 3D animation clip (clips/shot_XX.mp4); the pixel mosaic comes from the 3D render
(build/anchors/shot_XX_mosaic.json), the LIVE counter / pop-up words / notifications from overlays.py.
Keys: push (z0, z1) | pan | punch [(t, k)] | pulse [(t, k, d)] | shake [(t, px, d, hz)] | handheld px |
flash [(t, a, d)] | flicker [(t, d)] | grade | vignette | fx [confetti, speedlines, sparkles, sweat] | fade_out."""
import json
import os

from events import T, word, shot

HERE = os.path.dirname(os.path.abspath(__file__))


def shot_fx(i):
    t0, t1 = shot(i)
    hh = 2.0
    F = {
        1: lambda: dict(push=(1.0, 1.08), handheld=hh),
        2: lambda: dict(push=(1.0, 1.1), push_ease="in", flicker=[(T["bulb_out"] + 0.07, 0.06), (T["bulb_out"] + 0.23, 0.06)],
                        grade=dict(dim=(0.0, 0.18))),
        3: lambda: dict(push=(1.0, 1.06), punch=[(T["live"], 1.12)], flash=[(T["live"], 0.25, 0.12)]),
        4: lambda: dict(push=(1.0, 1.05), punch=[(T["plop"], 1.1)], shake=[(T["plop"], 10, 0.3, 26)]),
        5: lambda: dict(push=(1.0, 1.05), punch=[(T["ding"], 1.12)]),
        6: lambda: dict(push=(1.0, 1.06), punch=[(T["shrug"], 1.1)], handheld=hh),
        7: lambda: dict(push=(1.0, 1.08), punch=[(T["squish"], 1.08)], shake=[(T["squish"], 6, 0.25, 26)]),
        8: lambda: dict(push=(1.0, 1.04), punch=[(T["smile_drop"] + 0.1, 1.16)]),
        9: lambda: dict(push=(1.02, 1.1), shake=[(T["gasp"], 12, 0.5, 22)]),
        10: lambda: dict(push=(1.0, 1.1), push_ease="in", handheld=hh),
        11: lambda: dict(push=(1.0, 1.1), punch=[(t0 + 0.15, 1.08)]),
        12: lambda: dict(push=(1.0, 1.08), pan=((0.45, 0.5), (0.55, 0.5)), pan_ease="lin", shake=[(T["ooh"], 6, 0.8, 14)]),
        13: lambda: dict(push=(1.0, 1.08), push_ease="lin"),
        14: lambda: dict(push=(1.0, 1.05), handheld=hh),
        15: lambda: dict(push=(1.0, 1.1), punch=[(T["gulp"], 1.06)]),
        16: lambda: dict(push=(1.0, 1.04), shake=[(T["fwoosh"] - 0.1, 22, 0.6, 18)],
                         fx=[dict(type="speedlines", t0=T["fwoosh"] - 0.25, t1=T["fwoosh"] + 0.45, n=40, amount=0.4, fade=0.2, inner=0.42)]),
        17: lambda: dict(push=(1.0, 1.06), handheld=4.0, shake=[(t0, 3, t1 - t0, 9)]),
        18: lambda: dict(push=(1.0, 1.08), push_ease="lin"),
        19: lambda: dict(push=(1.0, 1.05), punch=[(T["umbrellas"], 1.06)] + [(x, 1.04) for x in T["splat_u"]],
                         shake=[(x, 8, 0.25, 26) for x in T["splat_u"]]),
        20: lambda: dict(push=(1.0, 1.05), punch=[(x, 1.04) for x in T["thwaps"]]),
        21: lambda: dict(push=(1.0, 1.06)),
        22: lambda: dict(push=(1.0, 1.04), punch=[(T["splat_n"], 1.2)], shake=[(T["splat_n"], 18, 0.4, 24)],
                         flash=[(T["splat_n"], 0.3, 0.1)]),
        23: lambda: dict(push=(1.0, 1.06), push_ease="lin"),
        24: lambda: dict(push=(1.0, 1.08), push_ease="lin"),
        25: lambda: dict(push=(1.0, 1.08), punch=[(T["views_1b"], 1.15)], shake=[(T["views_1b"] + 0.4, 14, 0.6, 20)],
                         flash=[(T["kaching"], 0.35, 0.15)],
                         fx=[dict(type="confetti", n=80, speed=520, t0=T["views_1b"] + 0.35)]),
        26: lambda: dict(push=(1.12, 1.0), push_ease="out", handheld=3.0, fade_out=(t1 - 0.45, 0.4),
                         fx=[dict(type="confetti", n=50, speed=420, t0=t0), dict(type="sparkles", at=(0.5, 0.25), radius=420, n=8, rate=1.0)]),
    }
    return F[i]() if i in F else dict(push=(1.0, 1.06))
