"""Procedural sound-effect library: every cue in brief/timeline.json, plus the
original correct-answer chime and lesson-complete fanfare.

Each cue is a deterministic function of its name.  Pitched cues are tuned to
D major so they sit inside the score.  Outputs are stereo float arrays at 48 kHz,
normalised to a nominal per-layer peak; the mixer sets final levels.
"""

from __future__ import annotations

import math

import numpy as np

from audio.synth import (NOTE, SR, bandpass, convolve, env, fade, fm, highpass, lowpass, make_ir, mix, modal,
                         normalize, pan, perc, pink, rng, samples, saw, sine, soft_clip, stereo_spread, svf, t_axis,
                         tri, white)

LAYER_PEAK = {"hero": -3.0, "impact": -4.0, "whoosh": -8.0, "path": -11.0, "ui": -12.0, "character": -12.0,
              "texture": -14.0, "text": -12.0}
_IR = {}


def room(x, wet=0.18, seconds=1.2, name="room"):
    key = (seconds, name)
    if key not in _IR:
        _IR[key] = make_ir(seconds, name)
    if x.ndim == 1:
        x = np.stack([x, x], 1) * math.sqrt(0.5)
    return convolve(x, _IR[key], wet)


# ------------------------------------------------------------- generators

def whoosh(name, dur=0.6, peak=0.35, f_lo=300.0, f_hi=3500.0, q=1.2, pan_from=-0.6, pan_to=0.6,
           shape="updown", whistle=0.0, sub=0.0, air=0.0):
    n = samples(dur)
    t = t_axis(n)
    a = env(n, [(0, 0), (peak, 1), (dur, 0)]) ** 1.4
    if shape == "up":
        sweep = (t / dur) ** 1.5
    elif shape == "down":
        sweep = 1 - (t / dur) ** 0.7
    else:
        sweep = a
    fc = f_lo * (f_hi / f_lo) ** sweep
    y = svf(pink(n, name), fc, q, "bp") * a
    if air:
        y += highpass(white(n, name + "a"), 5000) * a * air * 0.3
    if whistle:
        y += sine(fc * 0.9, n) * a ** 2 * whistle * 0.25
    if sub:
        y += sine(np.linspace(70, 38, n), n) * env(n, [(0, 0), (peak, 1), (dur, 0)]) * sub
    st = pan(y, np.linspace(pan_from, pan_to, n))
    return fade(st, 0.005, 0.02)


def riser(name, dur=0.45, f0=400.0, f1=5000.0, tone=0.3):
    n = samples(dur)
    t = t_axis(n)
    a = (t / dur) ** 1.8
    a = a * (1 - np.exp(-(dur - t) / 0.03))
    fc = f0 * (f1 / f0) ** (t / dur)
    y = svf(pink(n, name), fc, 2.0, "bp") * a + sine(fc * 0.5, n) * a * tone * 0.2
    return fade(stereo_spread(y, name), 0.01, 0.01)


def impact(name, dur=0.9, body=95.0, crack=0.6, sub=0.8, drive=1.6):
    n = samples(dur)
    t = t_axis(n)
    thump = sine(body * (1 + 1.5 * np.exp(-t / 0.012)), n) * perc(n, 0.001, 0.09)
    sub_l = sine(np.maximum(body * 0.45, 30) * (1 + 0.6 * np.exp(-t / 0.05)), n) * perc(n, 0.002, 0.35) * sub
    cr = highpass(white(n, name), 1800) * perc(n, 0.0005, 0.018) * crack
    y = soft_clip(thump + sub_l + cr, drive)
    return room(fade(y, 0.0005, 0.05), 0.12, 0.9, "impact")


def sub_hit(name, dur=0.8, f0=58.0, f1=34.0):
    n = samples(dur)
    t = t_axis(n)
    f = f1 + (f0 - f1) * np.exp(-t / 0.12)
    y = sine(f, n) * perc(n, 0.002, 0.45) + 0.15 * sine(2 * f, n) * perc(n, 0.002, 0.08)
    return fade(np.stack([y, y], 1), 0.001, 0.08)


def rumble(name, dur=0.5):
    n = samples(dur)
    y = lowpass(np.cumsum(white(n, name)) / 300.0, 140, 3) * perc(n, 0.01, 0.16)
    y -= y.mean()
    return fade(stereo_spread(y, name, 0.9), 0.005, 0.05)


def tinkles(name, dur=0.4, count=14, f_lo=3000.0, f_hi=8000.0, decay=0.05):
    n = samples(dur)
    r = rng(name)
    out = np.zeros((n, 2))
    for k in range(count):
        st = r.uniform(0, dur * 0.7)
        f = f_lo * (f_hi / f_lo) ** r.random()
        m = samples(0.12)
        g = modal(m, f, (1, 2.76, 5.4), (1, 0.35, 0.15), (decay, decay * 0.5, decay * 0.3), name=f"{name}{k}")
        g *= perc(m, 0.0005, decay * 2) * r.uniform(0.3, 1.0)
        s0 = samples(st)
        kk = min(m, n - s0)
        out[s0:s0 + kk] += pan(g[:kk], r.uniform(-0.9, 0.9))
    return room(fade(out, 0.001, 0.02), 0.25, 1.0, "glass")


def shimmer(name, dur=0.6, f_lo=4000.0, f_hi=9000.0, density=40, swell=True, pan_from=-0.8, pan_to=0.8):
    n = samples(dur)
    r = rng(name)
    out = np.zeros(n)
    for k in range(density):
        st = r.uniform(0, dur * 0.9)
        f = f_lo * (f_hi / f_lo) ** r.random()
        m = samples(0.06)
        g = sine(f, m) * np.hanning(m) * r.uniform(0.2, 1.0)
        s0 = samples(st)
        kk = min(m, n - s0)
        out[s0:s0 + kk] += g[:kk]
    out += highpass(white(n, name + "n"), 6000) * 0.12
    a = env(n, [(0, 0), (dur * 0.5, 1), (dur, 0)]) if swell else perc(n, 0.005, dur / 3)
    return fade(pan(out * a, np.linspace(pan_from, pan_to, n)), 0.005, 0.03)


def feather(name, dur=0.3, flaps=2, f=1600.0):
    n = samples(dur)
    t = t_axis(n)
    am = (0.5 - 0.5 * np.cos(2 * np.pi * flaps * t / dur)) ** 2
    y = bandpass(pink(n, name), f * 0.5, f * 2.2) * am * perc(n, 0.01, dur * 0.6)
    return fade(stereo_spread(y, name, 0.5), 0.003, 0.03)


def boing(name, dur=0.32, f0=NOTE["D4"], bend=0.35):
    n = samples(dur)
    t = t_axis(n)
    f = f0 * (1 + bend * np.exp(-t / 0.05)) * (1 + 0.03 * np.sin(2 * np.pi * 14 * t) * np.exp(-t / 0.1))
    y = (sine(f, n) + 0.3 * tri(f * 2, n)) * perc(n, 0.004, 0.09)
    return fade(np.stack([y, y], 1) * 0.7, 0.002, 0.03)


def pop(name, f=900.0, dur=0.09, drop=0.45):
    n = samples(dur)
    t = t_axis(n)
    y = sine(f * (1 + drop * np.exp(-t / 0.006)) * (1 - 0.25 * t / dur), n) * perc(n, 0.0008, 0.022)
    y += highpass(white(n, name), 2500) * perc(n, 0.0003, 0.004) * 0.3
    return fade(np.stack([y, y], 1), 0.0005, 0.01)


def tick(name, f=2400.0, dur=0.05, body=0.5, p=0.0):
    n = samples(dur)
    y = modal(n, f, (1, 2.3), (1, 0.4), (0.010, 0.006), name=name) * perc(n, 0.0004, 0.012)
    y += bandpass(white(n, name), 1500, 6000) * perc(n, 0.0002, 0.003) * body
    return fade(pan(y, p), 0.0003, 0.008)


def pluck(name, f, dur=0.5, bright=1.0, p=0.0):
    """Marimba-like mallet: modal partials tuned 1 : 3.93 : 9.2 with a soft mallet click."""
    n = samples(dur)
    y = modal(n, f, (1, 3.93, 9.2), (1, 0.28 * bright, 0.08 * bright), (0.26, 0.06, 0.02), name=name)
    y += lowpass(white(n, name), 4000) * perc(n, 0.0003, 0.004) * 0.15
    y *= perc(n, 0.0015, 0.5)
    return room(fade(pan(y, p), 0.0005, 0.04), 0.15, 0.8, "wood")


def thock(name, dur=0.12, f=180.0, click=0.6):
    n = samples(dur)
    t = t_axis(n)
    y = sine(f * (1 + 0.8 * np.exp(-t / 0.006)), n) * perc(n, 0.0006, 0.035)
    y += bandpass(white(n, name), 800, 4000) * perc(n, 0.0003, 0.006) * click
    return fade(np.stack([y, y], 1), 0.0005, 0.02)


def swipe(name, dur=0.18, f0=1200.0, f1=4500.0, p0=-0.3, p1=0.3):
    n = samples(dur)
    t = t_axis(n)
    fc = f0 * (f1 / f0) ** (t / dur)
    y = svf(pink(n, name), fc, 1.5, "bp") * env(n, [(0, 0), (dur * 0.3, 1), (dur, 0)])
    return fade(pan(y, np.linspace(p0, p1, n)), 0.002, 0.02)


def zing(name, dur=0.22, f0=800.0, f1=4200.0, p=0.0, q=6.0):
    n = samples(dur)
    t = t_axis(n)
    fc = f0 * (f1 / f0) ** ((t / dur) ** 0.6)
    y = svf(white(n, name), fc, q, "bp") * perc(n, 0.003, dur * 0.4)
    y += sine(fc, n) * perc(n, 0.003, dur * 0.3) * 0.15
    return fade(pan(y, p), 0.001, 0.02)


def chime(name, notes, spacing=0.06, decay=0.9, sparkle=0.3, p=0.0, body=0.0):
    total = spacing * (len(notes) - 1) + decay * 2.2
    n = samples(total)
    out = np.zeros(n)
    for k, nt in enumerate(notes):
        f = NOTE[nt] if isinstance(nt, str) else nt
        m = samples(decay * 2.2)
        g = modal(m, f, (1, 2.0, 3.01, 4.2, 5.43), (1, 0.42, 0.22, 0.1, 0.05),
                  (decay, decay * 0.55, decay * 0.35, decay * 0.2, decay * 0.12), name=f"{name}{k}")
        g *= perc(m, 0.0012, decay * 1.2)
        s0 = samples(spacing * k)
        kk = min(m, n - s0)
        out[s0:s0 + kk] += g[:kk] * (0.75 if k < len(notes) - 1 else 1.0)
    if body:
        f = NOTE[notes[-1]] / 2 if isinstance(notes[-1], str) else notes[-1] / 2
        m = samples(decay * 1.5)
        s0 = samples(spacing * (len(notes) - 1))
        out[s0:s0 + m] += sine(f, m)[: n - s0] * perc(m, 0.002, decay * 0.6)[: n - s0] * body
    st = pan(out, p)
    if sparkle:
        sp = shimmer(name + "sp", min(total, 0.7), 5000, 11000, 30, swell=False)
        st = mix((st, 0.0), (sp, spacing * (len(notes) - 1), sparkle))
    return room(fade(st, 0.0005, 0.08), 0.22, 1.6, "hall")


def fire_whoomp(name, dur=0.9):
    n = samples(dur)
    t = t_axis(n)
    a = env(n, [(0, 0), (0.04, 1), (dur, 0)]) ** 1.2
    fc = 200 * (2500 / 200) ** np.clip(t / 0.18, 0, 1) * np.exp(-np.maximum(t - 0.18, 0) * 2)
    y = svf(pink(n, name), np.maximum(fc, 150), 0.9, "lp") * a * 1.5
    y += sine(np.linspace(110, 60, n), n) * perc(n, 0.01, 0.15) * 0.6
    y += crackle(name + "c", dur, 60, mono=True) * 0.5
    return room(fade(stereo_spread(y, name, 0.7), 0.003, 0.08), 0.2, 1.2, "hall")


def crackle(name, dur=1.0, density=25, mono=False):
    n = samples(dur)
    r = rng(name)
    y = np.zeros(n)
    for _ in range(int(density * dur)):
        k = r.integers(0, max(1, n - 200))
        m = r.integers(20, 160)
        y[k:k + m] += r.standard_normal(m) * np.exp(-np.arange(m) / (m / 4)) * r.uniform(0.2, 1.0)
    y = bandpass(y, 900, 7000)
    return y if mono else fade(stereo_spread(y, name, 0.9), 0.01, 0.05)


def tick_train(name, dur=0.84, start_hz=6.0, peak_hz=40.0, end_hz=10.0, f=2600.0):
    """Odometer: ticks accelerating then decelerating."""
    times, t = [], 0.0
    while t < dur:
        u = t / dur
        rate = start_hz + (peak_hz - start_hz) * math.sin(math.pi * min(u * 1.3, 1.0)) if u < 0.77 else end_hz + (peak_hz - end_hz) * (1 - (u - 0.77) / 0.23) ** 2
        times.append(t)
        t += 1.0 / max(rate, 1.0)
    n = samples(dur + 0.08)
    out = np.zeros((n, 2))
    for k, tt in enumerate(times):
        tk = tick(f"{name}{k}", f * (1 + 0.04 * ((k % 3) - 1)), 0.04, 0.4, p=0.15 * math.sin(k))
        s0 = samples(tt)
        kk = min(len(tk), n - s0)
        out[s0:s0 + kk] += tk[:kk] * (0.6 + 0.4 * math.sin(math.pi * tt / dur))
    return out


def two_tone(name, f1=NOTE["A5"], f2=NOTE["D6"], gap=0.11):
    a = chime(name + "1", [f1], 0.05, 0.25, 0.0)
    b = chime(name + "2", [f2], 0.05, 0.3, 0.1)
    return mix((a, 0.0, 0.8), (b, gap, 1.0))


def voice_texture(name, dur=1.1, syllables=12):
    """Very low band-limited 'speech-like' texture following a syllable envelope."""
    n = samples(dur)
    t = t_axis(n)
    r = rng(name)
    a = np.zeros(n)
    for k in range(syllables):
        c = (k + 0.5) / syllables * dur + r.uniform(-0.02, 0.02)
        a += np.exp(-0.5 * ((t - c) / (dur / syllables / 3.2)) ** 2) * r.uniform(0.5, 1.0)
    y = bandpass(pink(n, name), 300, 2600) * a
    return fade(stereo_spread(y, name, 0.3), 0.01, 0.05)


def inhale(name, dur=0.32):
    n = samples(dur)
    y = svf(pink(n, name), np.geomspace(500, 3000, n), 0.8, "bp") * env(n, [(0, 0), (dur * 0.9, 1), (dur, 0)]) ** 2
    return fade(stereo_spread(y, name, 0.6), 0.01, 0.01)


def reverse(x):
    return x[::-1].copy()


# ------------------------------------------------------------- hero sounds

def correct_chime(name="correct_chime"):
    """Original 'correct answer' sound: quick D-major flourish F#5-A5 landing on D6,
    glassy mallet over a soft body, with a short sparkle."""
    flourish = chime(name, ["F#5", "A5", "D6"], spacing=0.055, decay=0.55, sparkle=0.35, body=0.25)
    knock = pluck(name + "k", NOTE["D5"], 0.4, bright=1.2)
    return mix((flourish, 0.0, 1.0), (knock, 0.11, 0.35))


def fanfare(name="lesson_complete_fanfare"):
    """Original 'lesson complete' fanfare: D5-F#5-A5 pickups into a held D6 triad,
    FM brass-bell voice, a low D hit and sparkles. In key with the final D add9 chord."""
    total = 1.9
    n = samples(total)
    out = np.zeros((n, 2))

    def voice(f, start, length, gain, p):
        m = samples(length)
        idx = env(m, [(0, 2.4), (0.06, 1.2), (length, 0.6)])
        y = fm(f, 1.0, idx, m) * 0.6 + modal(m, f, (1, 2, 3.01), (0.5, 0.2, 0.08), (0.6, 0.3, 0.15), name=f"{name}{f}")
        y *= env(m, [(0, 0), (0.008, 1), (length * 0.55, 0.7), (length, 0)])
        s0 = samples(start)
        kk = min(m, n - s0)
        out[s0:s0 + kk] += pan(y[:kk], p) * gain

    voice(NOTE["D5"], 0.00, 0.16, 0.8, -0.2)
    voice(NOTE["F#5"], 0.10, 0.16, 0.8, 0.0)
    voice(NOTE["A5"], 0.20, 0.18, 0.85, 0.2)
    for f, p in ((NOTE["D6"], 0.0), (NOTE["A5"], -0.35), (NOTE["F#5"], 0.35)):
        voice(f, 0.32, 1.3, 0.75 if f != NOTE["D6"] else 1.0, p)
    low = sine(NOTE["D3"], samples(1.0)) * perc(samples(1.0), 0.003, 0.35)
    sp = shimmer(name + "sp", 1.0, 5000, 12000, 50, swell=False)
    out = mix((out, 0.0), (np.stack([low, low], 1) * 0.5, 0.32), (sp, 0.34, 0.4), n=n)
    return room(fade(out, 0.002, 0.15), 0.25, 1.8, "hall")


# ------------------------------------------------------------ cue recipes
# Every cue name in brief/timeline.json maps to a recipe here.

N = NOTE
RECIPES = {
    "rush_in": lambda: whoosh("rush_in", 0.2, 0.17, 500, 6000, 1.0, 0, 0, "up", whistle=0.6, air=0.6),
    "strand_shimmer": lambda: shimmer("strand_shimmer", 0.3, 5000, 11000, 40, True, -0.9, 0.9),
    "slam_impact": lambda: impact("slam_impact", 0.9, 92, 0.8, 0.9, 1.8),
    "sub_hit": lambda: sub_hit("sub_hit", 0.9, 60, 32),
    "shards": lambda: tinkles("shards", 0.45, 14, 3500, 9000, 0.045),
    "wing_fling": lambda: feather("wing_fling", 0.22, 1, 1800),
    "shake_rumble": lambda: rumble("shake_rumble", 0.5),
    "rebound": lambda: boing("rebound", 0.3, N["D4"], 0.3),
    "wing_fold": lambda: feather("wing_fold", 0.2, 1, 1300),
    "strands_collapse": lambda: zing("strands_collapse", 0.2, 5000, 900, 0.0, 5),
    "line_run_A": lambda: shimmer("line_run_A", 0.65, 2500, 6500, 50, True, -0.7, 0.7),
    "wordmark_settle_A": lambda: chime("wordmark_settle_A", ["A6"], 0.05, 0.5, 0.15),
    "blink_A": lambda: tick("blink_A", 3200, 0.04, 0.3),
    "hop_anticipation": lambda: boing("hop_anticipation", 0.12, N["A3"], -0.2),
    "hop_jump": lambda: whoosh("hop_jump", 0.25, 0.08, 600, 2600, 1.5, 0, 0.5, "up", whistle=0.5),
    "hop_flap": lambda: feather("hop_flap", 0.18, 1, 1500),
    "duo_exit": lambda: whoosh("duo_exit", 0.35, 0.1, 900, 3800, 1.3, 0.2, 0.9, "down"),
    "dive_whoosh": lambda: whoosh("dive_whoosh", 0.7, 0.25, 250, 3200, 1.0, -0.3, 0.4, "down", sub=0.4, air=0.4),
    "node1": lambda: pluck("node1", N["D5"], 0.45, p=-0.5),
    "node2": lambda: pluck("node2", N["E5"], 0.45, p=-0.25),
    "node3": lambda: pluck("node3", N["F#5"], 0.45, p=0.0),
    "node4": lambda: pluck("node4", N["A5"], 0.45, p=0.25),
    "start_wobble": lambda: boing("start_wobble", 0.12, N["D5"], 0.12),
    "start_press": lambda: thock("start_press", 0.14, 150, 0.7),
    "start_pop": lambda: pop("start_pop", 1100, 0.09),
    "node5": lambda: mix((pluck("node5", N["B5"], 0.55, 1.2, 0.4), 0.0), (shimmer("node5s", 0.4, 6000, 11000, 25, False), 0.0, 0.5)),
    "phone_rise": lambda: riser("phone_rise", 0.45, 300, 3500, 0.5),
    "phone_settle": lambda: thock("phone_settle", 0.2, 110, 0.3),
    "screen_on": lambda: chime("screen_on", ["D6"], 0.05, 0.25, 0.1),
    "push_air": lambda: whoosh("push_air", 0.5, 0.25, 300, 1500, 0.8, 0, 0, "updown"),
    "title_in": lambda: swipe("title_in", 0.16, 1500, 5000, -0.2, 0.1),
    "duo_pop": lambda: pop("duo_pop", 700, 0.1),
    "bubble_pop": lambda: pop("bubble_pop", 1300, 0.08),
    "duo_chatter": lambda: mix(*[(pop(f"duo_chatter{k}", f, 0.06, 0.2), k * 0.09, 0.5) for k, f in enumerate((900, 1150, 1000))]),
    "bank_in": lambda: mix(*[(tick(f"bank_in{k}", 2000 + 150 * k, 0.04, 0.3, -0.4 + 0.2 * k), k * 0.025, 0.7) for k in range(5)]),
    "tile_lift": lambda: whoosh("tile_lift", 0.12, 0.08, 1500, 5000, 1.5, 0, 0.1, "up"),
    "snap_I": lambda: mix((tick("snap_I", 2400, 0.05, 0.6), 0.0), (pluck("snap_Ip", N["D5"], 0.3, 0.8), 0.0, 0.6)),
    "snap_want": lambda: mix((tick("snap_want", 2400, 0.05, 0.6), 0.0), (pluck("snap_wantp", N["E5"], 0.3, 0.8), 0.0, 0.6)),
    "snap_a": lambda: mix((tick("snap_a", 2400, 0.05, 0.6), 0.0), (pluck("snap_ap", N["F#5"], 0.3, 0.8), 0.0, 0.6)),
    "snap_coffee": lambda: mix((tick("snap_coffee", 2400, 0.05, 0.6), 0.0), (pluck("snap_coffeep", N["A5"], 0.3, 0.8), 0.0, 0.6)),
    "snap_please": lambda: mix((tick("snap_please", 2400, 0.05, 0.6), 0.0), (pluck("snap_pleasep", N["B5"], 0.3, 0.8), 0.0, 0.6)),
    "check_enable": lambda: chime("check_enable", ["A5"], 0.05, 0.18, 0.0),
    "check_press": lambda: thock("check_press", 0.14, 160, 0.8),
    "correct_chime_1": lambda: correct_chime("correct_chime"),
    "banner_slide": lambda: swipe("banner_slide", 0.2, 800, 3000, 0, 0),
    "progress_surge": lambda: shimmer("progress_surge", 0.22, 2500, 7000, 30, True, -0.5, 0.5),
    "progress_full": lambda: chime("progress_full", ["D7"], 0.05, 0.35, 0.4),
    "line_leap": lambda: whoosh("line_leap", 0.4, 0.12, 600, 5000, 1.2, -0.2, 0.8, "up", whistle=0.4),
    "camera_whip": lambda: whoosh("camera_whip", 0.4, 0.15, 300, 2500, 0.9, -0.8, 0.8, "updown", air=0.5),
    "curl_swirl": lambda: shimmer("curl_swirl", 0.25, 2000, 6000, 30, True, 0.8, -0.8),
    "ignite": lambda: fire_whoomp("ignite", 0.9),
    "anamorphic_shimmer": lambda: shimmer("anamorphic_shimmer", 0.45, 3000, 9000, 40, False, -0.9, 0.9),
    "flame_bed": lambda: crackle("flame_bed", 2.1, 18),
    "counter_pop": lambda: pop("counter_pop", 1000, 0.09),
    "counter_roll": lambda: tick_train("counter_roll", 0.84),
    "counter_land": lambda: mix((chime("counter_land", ["D6", "A6"], 0.03, 0.45, 0.2), 0.0), (thock("counter_landt", 0.15, 140, 0.4), 0.0, 0.7)),
    "label_pop": lambda: pop("label_pop", 1200, 0.07),
    "day_1": lambda: pluck("day_1", N["D5"], 0.35, 1.1, -0.6),
    "day_2": lambda: pluck("day_2", N["E5"], 0.35, 1.1, -0.4),
    "day_3": lambda: pluck("day_3", N["F#5"], 0.35, 1.1, -0.2),
    "day_4": lambda: pluck("day_4", N["G5"], 0.35, 1.1, 0.0),
    "day_5": lambda: pluck("day_5", N["A5"], 0.35, 1.1, 0.2),
    "day_6": lambda: pluck("day_6", N["B5"], 0.35, 1.1, 0.4),
    "day_7": lambda: mix((pluck("day_7", N["D6"], 0.5, 1.3, 0.6), 0.0), (shimmer("day_7s", 0.35, 6000, 11000, 20, False), 0.0, 0.5)),
    "predrop_suck": lambda: reverse(whoosh("predrop_suck", 0.17, 0.02, 400, 5000, 1.0, 0.3, -0.3, "down", air=0.5)),
    "drop_whoosh": lambda: whoosh("drop_whoosh", 0.45, 0.12, 180, 2500, 0.9, 0, 0, "down", sub=0.7, air=0.4),
    "arrive_brake": lambda: mix((whoosh("arrive_brake", 0.2, 0.05, 300, 1200, 0.8, 0, 0, "down"), 0.0), (thock("arrive_braket", 0.2, 90, 0.2), 0.02, 0.8)),
    "card_reveal": lambda: swipe("card_reveal", 0.25, 700, 3500, -0.3, 0.3),
    "rows_cascade": lambda: mix(*[(tick(f"rows_cascade{k}", 1800 + 120 * k, 0.04, 0.3), k * 0.03, 0.6) for k in range(7)]),
    "row_lift": lambda: mix((whoosh("row_lift", 0.3, 0.1, 800, 4000, 1.3, -0.2, 0.0, "up"), 0.0), (shimmer("row_lifts", 0.3, 4000, 9000, 20, True), 0.05, 0.5)),
    "pass_6": lambda: mix((tick("pass_6", 2200, 0.05, 0.5), 0.0), (swipe("pass_6s", 0.1, 1500, 900), 0.0, 0.5)),
    "pass_5": lambda: mix((tick("pass_5", 2350, 0.05, 0.5), 0.0), (swipe("pass_5s", 0.1, 1500, 900), 0.0, 0.5)),
    "pass_4": lambda: mix((tick("pass_4", 2500, 0.05, 0.5), 0.0), (swipe("pass_4s", 0.1, 1500, 900), 0.0, 0.5)),
    "pass_3": lambda: mix((tick("pass_3", 2650, 0.05, 0.5), 0.0), (swipe("pass_3s", 0.1, 1500, 900), 0.0, 0.5)),
    "pass_2": lambda: mix((tick("pass_2", 2800, 0.05, 0.5), 0.0), (swipe("pass_2s", 0.1, 1500, 900), 0.0, 0.5)),
    "correct_chime_2": lambda: correct_chime("correct_chime"),
    "rank1_land": lambda: mix((thock("rank1_land", 0.2, 120, 0.4), 0.0), (tinkles("rank1_landt", 0.45, 10, 4000, 10000, 0.05), 0.01, 0.8)),
    "xp_settle": lambda: tick("xp_settle", 2600, 0.05, 0.4),
    "to_call_whoosh": lambda: whoosh("to_call_whoosh", 0.5, 0.2, 300, 2800, 1.0, 0.6, -0.6, "updown", air=0.3),
    "call_connect": lambda: two_tone("call_connect"),
    "tile_popin": lambda: pop("tile_popin", 850, 0.1),
    "duo_bubble": lambda: pop("duo_bubble", 1250, 0.08),
    "duo_talk": lambda: mix(*[(pop(f"duo_talk{k}", f, 0.05, 0.15), k * 0.075, 0.4) for k, f in enumerate((950, 1200, 1050, 1100))]),
    "user_bubble": lambda: pop("user_bubble", 1100, 0.08),
    "wave_on": lambda: zing("wave_on", 0.25, 600, 3000, 0.0, 4),
    "wave_texture": lambda: voice_texture("wave_texture", 1.1, 12),
    "pullback_whoosh": lambda: whoosh("pullback_whoosh", 0.75, 0.15, 150, 4000, 0.8, 0, 0, "down", sub=1.0, air=0.7),
    "fork_zing": lambda: mix(*[(zing(f"fork_zing{k}", 0.25, 900, 3600 + 300 * k, -0.75 + 0.5 * k), k * 0.035, 0.7) for k in range(4)]),
    "languages_light": lambda: chime("languages_light", ["D6"], 0.05, 0.8, 0.3, -0.5, 0.2),
    "flag_pops": lambda: mix(*[(pop(f"flag_pops{k}", 900 + 90 * k, 0.07), k * 0.033, 0.55) for k in range(8)]),
    "math_light": lambda: chime("math_light", ["F#6"], 0.05, 0.8, 0.3, -0.17, 0.2),
    "music_light": lambda: chime("music_light", ["A6"], 0.05, 0.8, 0.3, 0.17, 0.2),
    "chess_light": lambda: mix((chime("chess_light", ["D7"], 0.05, 0.8, 0.3, 0.5, 0.2), 0.0), (thock("chess_lightk", 0.15, 240, 0.5), 0.0, 0.7)),
    "knight_land": lambda: thock("knight_land", 0.14, 260, 0.5),
    "converge_whoosh": lambda: whoosh("converge_whoosh", 0.4, 0.3, 400, 3500, 1.2, -0.7, 0.0, "up", whistle=0.3),
    "merge_zip": lambda: zing("merge_zip", 0.18, 4000, 1200, 0.0, 6),
    "line1_reveal": lambda: shimmer("line1_reveal", 0.4, 2500, 7000, 30, True, -0.6, 0.6),
    "baseline_drop": lambda: zing("baseline_drop", 0.16, 2000, 700, 0.0, 4),
    "line2_split": lambda: mix(*[(shimmer(f"line2_split{k}", 0.45, 3000 + 800 * k, 8000 + 800 * k, 15, True, -0.8 + 0.55 * k, -0.8 + 0.55 * k), 0.0, 0.6) for k in range(4)]),
    "merge_back": lambda: chime("merge_back", ["A6", "D7"], 0.04, 0.4, 0.2),
    "breath_inhale": lambda: inhale("breath_inhale", 0.32),
    "duo_fall": lambda: whoosh("duo_fall", 0.17, 0.15, 400, 1500, 2.0, 0, 0, "down", whistle=0.8),
    "landing_impact": lambda: impact("landing_impact", 1.1, 85, 0.7, 1.0, 1.7),
    "shockwave": lambda: whoosh("shockwave", 0.6, 0.03, 300, 3000, 0.7, -0.9, 0.9, "down", air=0.6),
    "tagline_dissolve": lambda: shimmer("tagline_dissolve", 0.4, 5000, 11000, 40, False, -0.5, 0.5),
    "landing_rebound": lambda: boing("landing_rebound", 0.25, N["D4"], 0.2),
    "line_run_B": lambda: shimmer("line_run_B", 0.3, 2500, 6500, 30, True, -0.7, 0.7),
    "wordmark_settle_B": lambda: chime("wordmark_settle_B", ["A6"], 0.05, 0.5, 0.15),
    "lesson_complete_fanfare": lambda: fanfare(),
    "wing_flap_1": lambda: feather("wing_flap_1", 0.22, 1, 1500),
    "wing_flap_2": lambda: feather("wing_flap_2", 0.22, 1, 1650),
    "blink_I": lambda: tick("blink_I", 3200, 0.04, 0.3),
    "dim_whoosh": lambda: whoosh("dim_whoosh", 0.6, 0.15, 150, 900, 0.7, 0, 0, "down"),
    "signature_reveal": lambda: chime("signature_reveal", ["D6", "A6"], 0.08, 0.9, 0.2),
}


def render_cue(name: str, layer: str) -> np.ndarray:
    x = RECIPES[name]()
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    x = x - x.mean(axis=0)
    return normalize(fade(x, 0.0005, 0.01), LAYER_PEAK.get(layer, -12.0))
