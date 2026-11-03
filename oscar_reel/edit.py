"""Per-shot edit for the handkerchief reel: camera moves, beats and cartoon effects (used by render.py).

Coordinates: u, v (and camera cx, cy) are fractions of the shot's image (0,0 = top-left, 1,1 = bottom-right),
so effects stay glued to the picture while the camera moves. z = zoom (1 = the image just fills the frame).
Times come from the measured word onsets (W(line, word) = when that word starts), so beats hit the voice.

Camera:  cam0/cam1 = (cx, cy, z) at the start/end of the shot (linear), or keys = [(t, cx, cy, z, ease), ...]
         punch = [(t, factor, (fx, fy), dur, pull)]  quick zoom step toward (fx, fy) on a beat
         shake = [(t, amp_px, dur)], sway = (deg, period), bob = (amp, period)
         clip_in / clip_speed: which part of a Kling clip to use (seconds into the clip, playback speed)
Effects: stink, sweat, sweat_burst, hearts, heart_pop, sparkle, glow, tears, petals, fly, label, bigtext,
         speedlines, flash (see render.py)
The style follows the last reels: calm slow push-ins (2-8 % per shot), sudden punch-ins on the beat (1.08-1.25),
small shakes on comedy beats, hard cuts.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_ON = json.load(open(os.path.join(HERE, "audio", "word_onsets.json")))
_SH = {s["id"]: s for s in json.load(open(os.path.join(HERE, "shots.json")))["shots"]}


def W(line, word=0):
    """Start time (s) of word `word` (0-based) of voice line `line`."""
    return [w for w in _ON if w["line"] == line][word]["s"]


def WE(line):
    """End time (s) of voice line `line`."""
    return [w for w in _ON if w["line"] == line][-1]["e"]


T0 = lambda i: _SH[i]["t0"]
T1 = lambda i: _SH[i]["t1"]

GREEN = (150, 230, 90)


def stink(u, v, w=0.22, n=3, h=0.22, **kw):
    return dict(type="stink", u=u, v=v, w=w, n=n, h=h, **kw)


def hearts(u, v, w=0.3, **kw):
    return dict(type="hearts", u=u, v=v, w=w, **kw)


SPEC = {
    # ------------------------------------------------------------------ the bush
    1: dict(cam0=(0.5, 0.45, 1.0), cam1=(0.5, 0.43, 1.06),
            punch=[(W(1, 1), 1.10, (0.5, 0.38), 0.12, 0.5)],
            fx=[stink(0.5, 0.64, w=0.42, n=3, h=0.25)]),
    2: dict(cam0=(0.42, 0.52, 1.06), cam1=(0.56, 0.50, 1.06),
            shake=[(W(2, 3), 5, 0.45)],
            fx=[stink(0.5, 0.60, w=0.14, n=3, h=0.15, scale=0.7)]),
    3: dict(cam0=(0.5, 0.45, 1.0), cam1=(0.5, 0.45, 1.04),
            punch=[(W(3, 3), 1.15, (0.5, 0.42), 0.12, 0.4)],
            fx=[dict(type="sweat", u=0.63, v=0.28, t=W(3, 3) + 0.1, dur=1.0)]),
    # ------------------------------------------------------------------ the limo
    4: dict(cam0=(0.5, 0.52, 1.0), cam1=(0.5, 0.52, 1.05), clip_in=0.3,
            shake=[(W(4, 4) + 0.12, 9, 0.35)]),
    5: dict(cam0=(0.40, 0.5, 1.10), cam1=(0.58, 0.5, 1.10),
            punch=[(W(5, 3), 1.12, (0.5, 0.5), 0.12, 0.3)],
            fx=[dict(type="sparkle", pts=[(0.46, 0.44), (0.56, 0.55), (0.50, 0.62)], t0=T0(5) + 0.2, size=1.2)]),
    6: dict(cam0=(0.5, 0.5, 1.0), cam1=(0.5, 0.5, 1.06),
            fx=[dict(type="glow", u=0.5, v=0.45, r=0.40, strength=0.45, t0=T0(6) + 0.1, pulse=0.1),
                dict(type="sparkle", pts=[(0.42, 0.40), (0.58, 0.48)], t0=T0(6) + 0.3, size=0.9)]),
    7: dict(cam0=(0.5, 0.55, 1.0), cam1=(0.5, 0.55, 1.04), clip_in=0.2, clip_speed=0.7),
    8: dict(keys=[(T0(8), 0.5, 0.80, 1.35), (W(9) - 0.04, 0.5, 0.58, 1.35, "inout"),
                  (T1(8) - 0.40, 0.5, 0.58, 1.35, "linear"), (T1(8), 0.5, 0.32, 1.20, "inout")],
            punch=[(W(9), 1.15, (0.5, 0.58), 0.10, 0.0)],
            fx=[dict(type="sparkle", pts=[(0.42, 0.56), (0.52, 0.60), (0.60, 0.55), (0.47, 0.63)],
                     t0=W(9), t1=T1(8), size=1.3, period=0.5),
                dict(type="flash", t=W(9), dur=0.12, strength=0.35)]),
    # ------------------------------------------------------------------ the bodyguard
    9: dict(cam0=(0.5, 0.45, 1.0), cam1=(0.5, 0.45, 1.06),
            shake=[(T0(9) + 0.05, 14, 0.55)],
            fx=[dict(type="sweat_burst", u=0.5, v=0.24, t=T0(9) + 0.10, n=7)]),
    10: dict(cam0=(0.5, 0.42, 1.0), cam1=(0.5, 0.42, 1.08),
             shake=[(W(11, 1), 6, 0.3)],
             fx=[dict(type="sweat", u=0.62, v=0.24, t=T0(10) + 0.25, dur=1.2)]),
    11: dict(cam0=(0.5, 0.42, 1.05), cam1=(0.5, 0.42, 1.05)),                        # deadpan: no move
    12: dict(cam0=(0.5, 0.42, 1.0), cam1=(0.5, 0.42, 1.0), punch=[(T0(12), 1.08, None, 0.06)]),
    # ------------------------------------------------------------------ the freeze
    13: dict(cam0=(0.5, 0.50, 1.0), cam1=(0.5, 0.47, 1.10)),
    14: dict(cam0=(0.5, 0.42, 1.10), cam1=(0.5, 0.42, 1.13),
             fx=[dict(type="sweat", u=0.60, v=0.30, t=T0(14) + 0.25, dur=0.95)]),
    15: dict(cam0=(0.5, 0.40, 1.15), cam1=(0.5, 0.40, 1.18)),
    16: dict(cam0=(0.5, 0.40, 1.20), cam1=(0.5, 0.40, 1.28)),
    17: dict(cam0=(0.5, 0.40, 1.25), cam1=(0.5, 0.40, 1.35)),
    # ------------------------------------------------------------------ the handkerchief
    18: dict(cam0=(0.5, 0.45, 1.0), cam1=(0.5, 0.45, 1.10), clip_in=0.0, clip_speed=0.8,
             fx=[dict(type="glow", u=0.5, v=0.40, r=0.50, strength=0.45, pulse=0.15),
                 dict(type="sparkle", pts=[(0.38, 0.35), (0.60, 0.30), (0.55, 0.52), (0.42, 0.55), (0.66, 0.44)],
                      size=1.0, period=0.8)]),
    19: dict(cam0=(0.42, 0.5, 1.06), cam1=(0.58, 0.5, 1.06),
             punch=[(W(19, 5), 1.08, (0.5, 0.5), 0.15, 0.2)]),
    20: dict(cam0=(0.5, 0.5, 1.0), cam1=(0.55, 0.46, 1.08),
             fx=[dict(type="sparkle", pts=[(0.55, 0.45), (0.62, 0.50)], size=0.9, t0=T0(20) + 0.2)]),
    21: dict(cam0=(0.5, 0.42, 1.04), cam1=(0.5, 0.42, 1.04),
             punch=[(W(21, 1), 1.08, (0.5, 0.40), 0.10, 0.3)]),
    # ------------------------------------------------------------------ the fact
    22: dict(cam0=(0.5, 0.5, 1.0), cam1=(0.5, 0.5, 1.10)),
    23: dict(cam0=(0.5, 0.47, 1.0), cam1=(0.5, 0.47, 1.05), bob=(0.006, 1.4),
             punch=[(W(23, 6), 1.10, (0.5, 0.45), 0.12, 0.3)],
             fx=[dict(type="sparkle", pts=[(0.30, 0.30), (0.72, 0.36), (0.66, 0.66)], size=0.8)]),
    24: dict(cam0=(0.5, 0.45, 1.0), cam1=(0.5, 0.45, 1.05),
             punch=[(W(24, 3), 1.15, (0.5, 0.48), 0.10, 0.3)],
             fx=[dict(type="bigtext", text="0.1 SEC", u=0.5, v=0.36, t=W(24, 3), size=150, fill=(255, 235, 120)),
                 dict(type="flash", t=W(24, 3), dur=0.12, strength=0.3)]),
    25: dict(cam0=(0.5, 0.42, 1.05), cam1=(0.5, 0.42, 1.07),
             punch=[(W(25) + 0.12, 1.22, (0.5, 0.40), 0.08, 0.5)],
             fx=[dict(type="speedlines", t0=W(25) + 0.12, t1=W(25) + 0.6),
                 dict(type="sparkle", kind="pinkstar", pts=[(0.38, 0.38), (0.62, 0.38)], t0=W(25) + 0.15, size=1.0)]),
    26: dict(cam0=(0.5, 0.42, 1.05), cam1=(0.5, 0.42, 1.07),
             punch=[(W(26) + 0.10, 1.22, (0.5, 0.40), 0.08, 0.5)],
             fx=[dict(type="speedlines", t0=W(26) + 0.10, t1=W(26) + 0.55),
                 dict(type="heart_pop", u=0.5, v=0.62, t=WE(26) + 0.05, size=1.0),
                 hearts(0.5, 0.75, w=0.6, t0=WE(26) + 0.2, rate=6, rise=0.3)]),
    # ------------------------------------------------------------------ first date
    27: dict(cam0=(0.5, 0.55, 1.0), cam1=(0.5, 0.58, 1.10),
             fx=[dict(type="label", text="DAY 1", t0=T0(27) + 0.05),
                 dict(type="sparkle", pts=[(0.30, 0.15), (0.70, 0.12), (0.5, 0.2)], size=0.9),
                 hearts(0.5, 0.62, w=0.25, rate=2, rise=0.15, size=0.8)]),
    28: dict(cam0=(0.5, 0.45, 1.0), cam1=(0.5, 0.45, 1.05),
             punch=[(W(29, 4), 1.12, (0.5, 0.45), 0.10, 0.3)]),
    29: dict(cam0=(0.5, 0.45, 1.0), cam1=(0.5, 0.45, 1.06),
             fx=[hearts(0.5, 0.45, w=0.5, rate=4, rise=0.2)]),
    30: dict(cam0=(0.5, 0.5, 1.0), cam1=(0.5, 0.5, 1.04), clip_in=0.3,
             shake=[(W(31, 2) + 0.25, 18, 0.55)]),
    # ------------------------------------------------------------------ Paris
    31: dict(cam0=(0.5, 0.64, 1.15), cam1=(0.5, 0.36, 1.15), ease="inout",
             fx=[dict(type="label", text="MONTH 3", t0=T0(31) + 0.05)]),
    32: dict(cam0=(0.5, 0.5, 1.0), cam1=(0.5, 0.47, 1.06),
             fx=[stink(0.5, 0.60, w=0.35, n=3, h=0.22),
                 hearts(0.5, 0.58, w=0.35, rate=2.5, rise=0.25, size=0.8)]),
    33: dict(cam0=(0.5, 0.5, 1.0), cam1=(0.5, 0.48, 1.06),
             fx=[hearts(0.5, 0.45, w=0.6, rate=3.5, rise=0.25),
                 dict(type="sparkle", pts=[(0.55, 0.5)], size=1.0)]),
    # ------------------------------------------------------------------ the wedding
    34: dict(cam0=(0.5, 0.55, 1.0), cam1=(0.5, 0.55, 1.08),
             fx=[dict(type="label", text="YEAR 1", t0=T0(34) + 0.05), dict(type="petals", n=26),
                 hearts(0.5, 0.45, w=0.3, rate=2, rise=0.2)]),
    35: dict(cam0=(0.5, 0.42, 1.02), cam1=(0.5, 0.42, 1.08), clip_in=0.2,
             shake=[(W(36, 2) - 0.05, 8, 0.35), (W(36, 3) + 0.1, 10, 0.4), (W(36, 4) + 0.15, 8, 0.4)],
             fx=[dict(type="tears", pts=[(0.42, 0.33), (0.58, 0.33)], rate=12, speed=0.35)]),
    # ------------------------------------------------------------------ 50 years later
    36: dict(cam0=(0.5, 0.55, 1.0), cam1=(0.5, 0.58, 1.08),
             fx=[dict(type="label", text="50 YEARS LATER", t0=T0(36) + 0.05)]),
    37: dict(cam0=(0.5, 0.5, 1.05), cam1=(0.5, 0.5, 1.09), sway=(0.6, 3.2),
             fx=[hearts(0.5, 0.42, w=0.3, rate=1.5, rise=0.18, size=0.8)]),
    38: dict(cam0=(0.5, 0.5, 1.0), cam1=(0.5, 0.5, 1.06),
             fx=[hearts(0.5, 0.48, w=0.35, rate=3, rise=0.25)]),
    39: dict(cam0=(0.5, 0.45, 1.0), cam1=(0.5, 0.45, 1.06),
             fx=[dict(type="sparkle", pts=[(0.5, 0.55), (0.58, 0.6)], size=0.9)]),
    40: dict(cam0=(0.5, 0.45, 1.0), cam1=(0.5, 0.45, 1.08),
             fx=[stink(0.5, 0.40, w=0.25, n=3, h=0.18, scale=0.8), dict(type="fly", u=0.5, v=0.3, r=0.12)]),
    41: dict(cam0=(0.5, 0.52, 1.25), cam1=(0.5, 0.50, 1.0), ease="out",
             fx=[hearts(0.5, 0.42, w=0.3, rate=3, rise=0.45, life=2.4, size=1.0),
                 stink(0.5, 0.42, w=0.2, n=2, h=0.35, scale=0.7, period=2.2)]),
}
