"""Shared timeline for "WHAT IF YOU FELL INTO JUPITER?".

Every module reads its timing from here: render.py (3D picture), overlays.py
(on-screen text and HUD) and audio.py (music and sound effects). All times
are in seconds from the first frame.
"""

FPS = 30
DURATION = 45.0
N_FRAMES = int(round(FPS * DURATION))  # 1350
OUT_W, OUT_H = 1080, 1920
SAMPLE_RATE = 48000

SCENES = [
    ("S1", "THE TERRIFYING FALL", 0.0, 5.0),
    ("S2", "ENTERING THE CLOUDS", 5.0, 11.0),
    ("S3", "THE CRUSHING PRESSURE", 11.0, 18.0),
    ("S4", "THE HELLISH DEEP ATMOSPHERE", 18.0, 26.0),
    ("S5", "THE POINT OF NO RETURN", 26.0, 35.0),
    ("S6", "THE FINAL REVEAL", 35.0, 45.0),
]

# id, start, end, renderer, description
SHOTS = [
    ("1A", 0.0, 5.0, "space", "third person: astronaut tumbling toward Jupiter, rapid push-in"),
    ("2A", 5.0, 8.2, "atmo", "third person: punch through the haze, violent turbulence"),
    ("2B", 8.2, 11.0, "atmo", "first-person POV through the visor, plunging into a cloud deck"),
    ("3A", 11.0, 14.4, "atmo", "close-up: visor reflecting the storm, suit warning lights"),
    ("3B", 14.4, 18.0, "atmo", "wide: tumbling through dark, oppressive layers"),
    ("4A", 18.0, 21.8, "atmo", "wide: gigantic cloud formations lit by lightning"),
    ("4B", 21.8, 26.0, "atmo", "third person from above: looking down into the glowing depths"),
    ("5A", 26.0, 30.6, "atmo", "dramatic pull-back: a tiny silhouette being swallowed"),
    ("5B", 30.6, 35.0, "atmo", "POV: suit failing, visor cracks; near-silence from 33.6"),
    ("6A", 35.0, 39.2, "space", "external reveal: slow pull-back, majestic rotation"),
    ("6B", 39.2, 42.0, "cutaway", "illustrative cutaway: denser and hotter with depth"),
    ("6C", 42.0, 45.0, "space", "tiny silhouette disappears into the clouds; fade to black"),
]

# On-screen text. "hl" words are drawn in the accent colour.
# style: title (huge), headline (large), warning (large, red flicker), sub (smaller)
TEXT_CUES = [
    dict(t0=0.20, t1=2.75, style="title", text="WHAT IF YOU\nFELL INTO\nJUPITER?", hl=["JUPITER?"]),
    dict(t0=2.85, t1=4.90, style="sub", text="There’s no solid surface\nto land on.", hl=["no solid surface"]),
    dict(t0=5.45, t1=8.05, style="headline", text="THE ATMOSPHERE\nGETS DENSER…", hl=["DENSER…"]),
    dict(t0=8.40, t1=10.85, style="sub", text="Pressure begins to\nrise rapidly.", hl=["rise rapidly."]),
    dict(t0=11.30, t1=14.25, style="warning", text="PRESSURE:\nRISING", hl=["RISING"]),
    dict(t0=14.55, t1=17.80, style="sub", text="Far below the clouds,\npressure becomes immense.", hl=["immense."]),
    dict(t0=18.30, t1=21.60, style="warning", text="NOW THE\nTEMPERATURE\nSOARS…", hl=["SOARS…"]),
    dict(t0=21.95, t1=25.80, style="sub", text="Deep inside, heat and\npressure become extreme.", hl=["extreme."]),
    dict(t0=26.40, t1=30.20, style="headline", text="THERE IS NO\nNORMAL GROUND\nHERE.", hl=["NORMAL", "GROUND"]),
    dict(t0=30.70, t1=33.55, style="sub", text="Your suit would\neventually fail.", hl=["fail."], accent="red"),
    dict(t0=35.50, t1=39.40, style="headline", text="JUPITER DOESN’T\nHAVE A NORMAL\nSOLID SURFACE.", hl=["NORMAL", "SOLID", "SURFACE."]),
    dict(t0=42.10, t1=44.60, style="title", text="WOULD YOU DARE\nTO FALL IN?", hl=["FALL", "IN?"]),
]

# Labels on the illustrative cutaway (shot 6B).
CUTAWAY_LABELS = dict(t0=39.65, t1=41.90)

# HUD gauges (no numbers on purpose: no fabricated readings).
GAUGES = [
    dict(kind="pressure", t0=11.45, t1=17.95),
    dict(kind="temperature", t0=18.45, t1=25.85),
]

# Lightning. az/el are degrees relative to the shot camera's forward axis
# (az > 0 right, el > 0 up); dist is in scene metres. strokes = flicker count.
LIGHTNING = [
    # S2: far away, inside enormous storm systems
    dict(t=6.05, dist=2600, az=-18, el=-8, power=0.6, dur=0.35, strokes=2, muffled=0.0),
    dict(t=6.95, dist=3400, az=22, el=-14, power=0.5, dur=0.25, strokes=1, muffled=0.0),
    dict(t=7.55, dist=2200, az=-6, el=-20, power=0.8, dur=0.45, strokes=3, muffled=0.0),
    dict(t=9.15, dist=1800, az=10, el=-5, power=0.9, dur=0.40, strokes=2, muffled=0.3),
    dict(t=10.35, dist=1500, az=-15, el=-10, power=1.0, dur=0.35, strokes=2, muffled=0.3),
    # S3: closer, reflected in the visor
    dict(t=12.25, dist=350, az=160, el=15, power=1.0, dur=0.40, strokes=2, muffled=0.2),
    dict(t=13.55, dist=1400, az=-30, el=-15, power=0.7, dur=0.30, strokes=1, muffled=0.3),
    dict(t=15.25, dist=1100, az=15, el=-25, power=0.9, dur=0.45, strokes=3, muffled=0.3),
    dict(t=16.70, dist=800, az=-20, el=-10, power=1.0, dur=0.35, strokes=2, muffled=0.3),
    dict(t=17.85, dist=500, az=5, el=-5, power=1.6, dur=0.30, strokes=2, muffled=0.1),
    # S4: big flashes reveal gigantic formations
    dict(t=18.45, dist=1200, az=-20, el=5, power=1.5, dur=0.50, strokes=3, muffled=0.3),
    dict(t=19.60, dist=1600, az=25, el=-5, power=1.3, dur=0.40, strokes=2, muffled=0.4),
    dict(t=20.45, dist=900, az=-5, el=15, power=1.4, dur=0.45, strokes=2, muffled=0.3),
    dict(t=21.25, dist=2000, az=30, el=0, power=1.2, dur=0.35, strokes=1, muffled=0.5),
    dict(t=22.55, dist=1000, az=-25, el=-20, power=1.3, dur=0.40, strokes=2, muffled=0.4),
    dict(t=23.40, dist=1400, az=15, el=-30, power=1.2, dur=0.35, strokes=2, muffled=0.5),
    dict(t=24.35, dist=700, az=-10, el=-15, power=1.5, dur=0.50, strokes=3, muffled=0.4),
    dict(t=25.30, dist=1200, az=20, el=-25, power=1.1, dur=0.30, strokes=1, muffled=0.5),
    # S5: deep and muffled
    dict(t=27.40, dist=1500, az=-15, el=-20, power=0.8, dur=0.50, strokes=2, muffled=0.8),
    dict(t=29.10, dist=1800, az=20, el=-35, power=0.6, dur=0.40, strokes=1, muffled=0.85),
    dict(t=31.50, dist=1200, az=0, el=-10, power=0.5, dur=0.40, strokes=2, muffled=0.95),
]


def lightning_strokes(ev):
    """Return [(start, length, gain)] flicker strokes of one lightning event."""
    n = ev["strokes"]
    out = []
    if n == 1:
        return [(ev["t"], ev["dur"], 1.0)]
    gap = ev["dur"] / n
    for i in range(n):
        gain = 1.0 if i == 0 else (0.65 if i % 2 else 0.85)
        out.append((ev["t"] + i * gap, gap * 0.75, gain))
    return out


def lightning_intensity(ev, t):
    """Visual flash brightness (0..power) of one event at time t."""
    s = 0.0
    for (t0, length, gain) in lightning_strokes(ev):
        if t0 - 0.01 <= t <= t0 + length + 0.25:
            x = t - t0
            attack = min(1.0, max(0.0, (x + 0.01) / 0.02))
            decay = 1.0 if x < length * 0.35 else pow(2.718, -(x - length * 0.35) / (0.06 + length * 0.25))
            s = max(s, gain * attack * decay)
    return s * ev["power"]


def _beeps():
    ev = []
    # S3: double beep once a second
    t = 11.25
    while t < 17.9:
        ev.append(dict(t=t, f=1320.0, dur=0.07, style="clean"))
        ev.append(dict(t=t + 0.14, f=1320.0, dur=0.07, style="clean"))
        t += 1.0
    # S4: faster, lower, distorted
    t = 18.25
    while t < 25.9:
        ev.append(dict(t=t, f=990.0, dur=0.12, style="distorted"))
        t += 0.55
    # S5A: failing, irregular, pitch drooping
    for i, t in enumerate([26.35, 26.95, 27.8, 28.35, 29.3, 29.75, 30.4]):
        ev.append(dict(t=t, f=990.0 - 40.0 * i, dur=0.16, style="failing"))
    # S5B: glitching stutter as the suit fails
    for t in [30.85, 31.0, 31.15, 31.9, 32.0, 32.45, 32.52, 32.6, 33.05, 33.3]:
        ev.append(dict(t=t, f=760.0, dur=0.06, style="glitch"))
    return ev


BEEPS = _beeps()


def warning_light(t):
    """Suit warning-light brightness 0..1 (flashes in sync with the beeps)."""
    if t < 11.0 or t >= 33.6:
        return 0.0
    v = 0.0
    for b in BEEPS:
        x = t - b["t"]
        if -0.005 <= x <= 0.6:
            hold = max(b["dur"] * 2.2, 0.16)
            v = max(v, 1.0 if x < hold else pow(2.718, -(x - hold) / 0.08))
    return v


# Glass cracks spreading across the visor in POV shot 5B.
VISOR_CRACKS = [31.85, 32.35, 32.90]

# Big sound moments, matched by cuts or effects in the picture.
HITS = [
    dict(t=0.00, kind="boom_braam", gain=1.0),
    dict(t=5.00, kind="entry_boom", gain=0.9),
    dict(t=8.20, kind="cut_muffle", gain=0.5),
    dict(t=11.00, kind="pressure_hit", gain=0.85),
    dict(t=14.40, kind="groan", gain=0.6),
    dict(t=18.00, kind="thunder_hit", gain=1.0),
    dict(t=21.80, kind="hit_soft", gain=0.6),
    dict(t=26.00, kind="dark_hit", gain=0.95),
    dict(t=30.60, kind="cut_muffle", gain=0.5),
    dict(t=33.60, kind="cut_to_silence", gain=0.0),
    dict(t=35.00, kind="final_boom", gain=1.0),
    dict(t=39.20, kind="whoosh", gain=0.5),
    dict(t=42.00, kind="final_hit", gain=0.7),
]

# The suit's helmet interior (POV shots) muffles the outside world.
POV_WINDOWS = [(8.2, 11.0), (30.6, 35.0)]
NEAR_SILENCE = (33.6, 35.0)
FADE_OUT = (44.2, 45.0)


def shot_at(t):
    for s in SHOTS:
        if s[1] <= t < s[2]:
            return s
    return SHOTS[-1]
