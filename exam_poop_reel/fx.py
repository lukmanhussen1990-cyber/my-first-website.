"""Per-shot camera moves and cartoon effects for the exam reel (render.py). The pixel mosaic over his hips (and the
blob, and the inside of the opened box) comes from the 3D scenes (S.mosaic -> build/anchors/shot_XX_mosaic.json) and is
applied by render.py on every frame. Named "at" anchors follow 3D points; a tuple "at" is a point on the screen."""
from events import T, word, line, shot

OLD = dict(oldfilm=dict(amount=1.0), hold_fps=12, weave=2.5, vignette=0.55)
FLASHBACK = dict(grade=dict(desat=0.55, tint=((200, 220, 255), 0.12)), vignette=0.5)


def shot_fx(i):
    t0, t1 = shot(i)
    sweat = lambda at="forehead", d0=0.1, **k: dict(type="sweat", at=at, t0=t0 + d0, dist=k.get("dist", 80), slide=k.get("slide", 0.9), scale=k.get("scale", 1.2))
    stink = lambda at="box", **k: dict(type="stink", at=at, scale=k.get("scale", 0.8), n=k.get("n", 3), amount=k.get("amount", 0.8), t0=k.get("t0", t0), fade_in=k.get("fade_in", 0.4))
    glow = lambda at, **k: dict(type="glow", at=at, radius=k.get("radius", 300), amount=k.get("amount", 0.3), pulse=0.3, hz=1.4, rays=k.get("rays", 0), color=k.get("color", (110, 255, 110)), t0=k.get("t0", -1e9), t1=k.get("t1", 1e9))
    spark = lambda at, **k: dict(type="sparkles", at=at, radius=k.get("radius", 60), n=k.get("n", 3), rate=k.get("rate", 1.6), t0=k.get("t0", t0), t1=k.get("t1", t1))
    F = {
        1: lambda: dict(push=(1.0, 1.08), push_ease="lin"),
        2: lambda: dict(push=(1.0, 1.1), push_ease="lin", fx=[sweat(d0=0.05, dist=90), sweat("forehead2", d0=0.3, dist=80)]),
        3: lambda: dict(push=(1.0, 1.06), shake=[(T["rumble"], 8, 1.0, 24)], fx=[dict(type="rumble", at="belly", radius=200, n=6, t0=T["rumble"])]),
        4: lambda: dict(FLASHBACK, push=(1.0, 1.08), push_ease="lin", flash=[(t0, 0.5, 0.12)]),
        5: lambda: dict(FLASHBACK, push=(1.0, 1.15), push_ease="lin", punch=[(word(3, 4), 1.08)]),
        6: lambda: dict(push=(1.0, 1.06), fx=[sweat(d0=0.2)]),
        7: lambda: dict(push=(1.0, 1.06), fx=[sweat(d0=0.1, dist=70)]),
        8: lambda: dict(push=(1.0, 1.05)),
        9: lambda: dict(push=(1.0, 1.06), punch=[(T["plop"], 1.08)], shake=[(T["plop"], 8, 0.3, 24)]),
        10: lambda: dict(push=(1.0, 1.0)),
        11: lambda: dict(push=(1.0, 1.15), push_ease="in"),
        12: lambda: dict(push=(1.0, 1.06)),
        13: lambda: dict(push=(1.0, 1.04), shake=[(T["tight"], 5, 0.4, 26)]),
        14: lambda: dict(push=(1.0, 1.08), fx=[spark("bundle", radius=90, n=5, t0=T["bow"])]),
        15: lambda: dict(push=(1.0, 1.06)),
        16: lambda: dict(push=(1.0, 1.06), punch=[(T["click"], 1.1)], shake=[(T["click"], 6, 0.2, 28)]),
        17: lambda: dict(push=(1.0, 1.06), fx=[spark("head", radius=150, n=4, t0=T["nod"])]),
        18: lambda: dict(push=(1.0, 1.12), push_ease="in"),
        19: lambda: dict(push=(1.0, 1.12), push_ease="lin", punch=[(T["glint"], 1.08)], fx=[spark("glasses", radius=20, n=2, rate=2.2, t0=T["glint"], t1=T["glint"] + 0.6), spark("glasses2", radius=20, n=2, rate=2.4, t0=T["glint"], t1=T["glint"] + 0.6)]),
        20: lambda: dict(push=(1.0, 1.06)),
        21: lambda: dict(push=(1.0, 1.04), pulse=[(T["open_all"] + 0.1, 1.03, 0.2)]),
        22: lambda: dict(push=(1.0, 1.08), push_ease="lin", fx=[spark("glasses", radius=24, n=2, rate=1.8)]),
        23: lambda: dict(push=(1.0, 1.04), shake=[(x, 6, 0.15, 30) for x in T["stomps"][:3]]),
        24: lambda: dict(push=(1.0, 1.06)),
        25: lambda: dict(push=(1.0, 1.12), push_ease="lin", fx=[sweat(d0=0.05, dist=110, scale=1.5), sweat("forehead2", d0=0.35, dist=100, scale=1.4)]),
        26: lambda: dict(push=(1.0, 1.06), shake=[(x, 4, 0.12, 30) for x in T["stomps"][3:6]], fx=[stink(scale=0.7, amount=0.6, fade_in=0.8)]),
        27: lambda: dict(push=(1.0, 1.15), push_ease="lin", grade=dict(desat=(0.0, 0.5)), fx=[stink(scale=0.8, amount=0.7)]),
        28: lambda: dict(OLD, push=(1.0, 1.06)),
        29: lambda: dict(OLD, push=(1.0, 1.06)),
        30: lambda: dict(OLD, push=(1.0, 1.08), fx=[sweat(d0=0.1, dist=60)]),
        31: lambda: dict(OLD, push=(1.0, 1.05), flash=[(T["hit"], 0.8, 0.3)], shake=[(T["hit"], 14, 0.4, 24)], fx=[glow("hit", radius=520, amount=0.4, rays=10, color=(220, 240, 255), )]),
        32: lambda: dict(OLD, push=(1.0, 1.1), push_ease="lin", fx=[glow("lump", radius=480, amount=0.35, rays=12, color=(220, 240, 255)), spark("lump", radius=260, n=10)]),
        33: lambda: dict(OLD, push=(1.05, 1.0), push_ease="out", fx=[glow("lump", radius=300, amount=0.3, rays=8, color=(220, 240, 255))]),
        34: lambda: dict(push=(1.0, 1.1), push_ease="lin", fx=[glow("box", radius=240, amount=0.22), stink(scale=0.9, amount=0.9, fade_in=0.2)]),
        35: lambda: dict(push=(1.0, 1.08), push_ease="lin", grade=dict(tint=((140, 255, 140), 0.12)), fx=[sweat(d0=0.3, dist=90)]),
        36: lambda: dict(push=(1.0, 1.06), vignette=0.65, grade=dict(dim=0.25), shake=[(x, 5, 0.12, 30) for x in T["stomps"][6:]]),
        37: lambda: dict(push=(1.0, 1.08), grade=dict(tint=((140, 255, 140), 0.15)), fx=[glow("box", radius=420, amount=0.5, t0=T["creak"]), stink(scale=1.0, amount=1.0, t0=T["creak"] + 0.3, fade_in=0.3)]),
        38: lambda: dict(push=(1.0, 1.06), grade=dict(tint=((140, 255, 140), 0.18)), pulse=[(T["twitch"] + k * 0.17, 1.02, 0.08) for k in range(6)]),
        39: lambda: dict(push=(1.0, 1.04), punch=[(T["snap"], 1.12)], shake=[(T["snap"], 14, 0.35, 26)], fx=[glow("box", radius=300, amount=0.4, t1=T["snap"]), stink(scale=0.8, amount=0.8)]),
        40: lambda: dict(push=(1.0, 1.06)),
        41: lambda: dict(push=(1.0, 1.06), grade=dict(tint=((255, 220, 170), 0.1))),
        42: lambda: dict(push=(1.0, 1.06), grade=dict(tint=((255, 220, 170), 0.1)), fx=[stink(scale=0.9, amount=0.8)]),
        43: lambda: dict(push=(1.0, 1.0), fx=[stink("window", scale=1.4, n=4, amount=1.0, fade_in=0.3)], fade_out=(t1 - 0.6, 0.55)),
    }
    return F[i]() if i in F else dict(push=(1.0, 1.06))
