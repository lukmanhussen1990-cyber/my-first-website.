"""Synthesize every sound effect of the reel from code and lay them out on the timeline.

Reads timeline.json ("sfx" cues: t, type, dur?, gain?) and writes build/audio/sfx.wav
(48 kHz stereo float). Deterministic (seeded per cue).

    python audio/make_sfx.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dsp import (SR, n_of, t_of, lp, hp, bp, peak_res, env_ar, fade_edges, modal, voice, pan_st, add_at,  # noqa: E402
                 synth_ir, convolve_st, limiter, db, smooth_noise, tv_bandpass)

REEL = Path(__file__).resolve().parent.parent
OUT = REEL / "build" / "audio" / "sfx.wav"


def noise(rng, n):
    return rng.standard_normal(n)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-12
    return x / m * peak


def grains(rng, n, rate, dur_g=0.004, lo=600, hi=5000, decay=None):
    """Granular crumble: many tiny filtered clicks (dirt, gravel)."""
    out = np.zeros(n)
    k = int(rate * n / SR)
    g = n_of(dur_g)
    for _ in range(k):
        s = rng.integers(0, max(1, n - g))
        a = rng.uniform(0.2, 1.0) * (np.exp(-s / SR / decay) if decay else 1.0)
        out[s:s + g] += a * rng.standard_normal(g) * np.exp(-np.arange(g) / (g / 4))
    return bp(out, lo, hi)


# ------------------------------------------------------------------ effects
def fx_dig(rng, fast=False):
    d = 0.42 if fast else 0.6
    n = n_of(d); t = t_of(n)
    # blade bites into the soil: crunchy noise burst + low thump
    bite = bp(noise(rng, n), 250, 3200) * env_ar(n, 0.002, 0.05) * 0.9
    bite += grains(rng, n, 900, lo=400, hi=4500, decay=0.06) * 1.6
    thump = np.sin(2 * np.pi * (95 - 40 * t) * t) * env_ar(n, 0.002, 0.05) * 0.6
    scrape = bp(noise(rng, n), 1500, 6000) * np.exp(-((t - 0.05) / 0.03) ** 2) * 0.25
    # toss: airy swish + sprinkle landing
    toss_t = 0.2 if fast else 0.3
    sw = bp(noise(rng, n), 500, 2500) * np.exp(-((t - toss_t) / 0.05) ** 2) * 0.35
    spr = np.zeros(n); s0 = n_of(toss_t + 0.1)
    spr[s0:] = grains(rng, n - s0, 500, lo=800, hi=6000, decay=0.12) * 0.7
    return bite + thump + scrape + sw + spr


def fx_clunk(rng):
    n = n_of(0.9)
    wood = modal(n, [(172, 0.16, 1.0), (395, 0.09, 0.7), (742, 0.05, 0.5), (1210, 0.03, 0.35), (1830, 0.02, 0.2)], rng=rng)
    ring = modal(n, [(2140, 0.35, 0.12), (3360, 0.28, 0.08), (4870, 0.2, 0.05)], rng=rng)
    click = hp(noise(rng, n), 2000) * env_ar(n, 0.0005, 0.006) * 0.5
    hollow = peak_res(noise(rng, n) * env_ar(n, 0.001, 0.08), 220, 6) * 0.6
    return wood + ring + click + hollow


def fx_brush(rng, d=0.32):
    n = n_of(d); t = t_of(n)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return bp(noise(rng, n), 900, 6000) * e * 0.35 + grains(rng, n, 300, lo=1500, hi=7000) * e * 0.4


def fx_whoosh(rng, d=0.9, f0=300, f1=1400, pan_from=0.0, pan_to=0.0):
    n = n_of(d); t = t_of(n)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    fc = f0 * (f1 / f0) ** (t / d)
    x = tv_bandpass(noise(rng, n), fc, 1.4) * e
    return pan_st(x * 1.6, np.linspace(pan_from, pan_to, n))


def fx_dirt_fall(rng, d=0.8):
    n = n_of(d + 0.3); t = t_of(n)
    e = np.clip(t / 0.05, 0, 1) * np.exp(-np.maximum(0, t - d * 0.6) / (d * 0.35))
    x = grains(rng, n, 1400, lo=500, hi=5000) * e
    x += lp(noise(rng, n), 900) * e * 0.25
    x += np.sin(2 * np.pi * 70 * t) * env_ar(n, 0.003, 0.08) * 0.25
    return x


def fx_thud(rng):
    n = n_of(0.5); t = t_of(n)
    f = 60 + 50 * np.exp(-t / 0.03)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ar(n, 0.002, 0.12)
    x += lp(noise(rng, n), 600) * env_ar(n, 0.001, 0.05) * 0.5
    x += grains(rng, n, 400, lo=600, hi=4000, decay=0.08) * 0.6
    return x


def fx_creak(rng, d=1.0, base=24.0, res=(620, 1080, 1720)):
    """Stick-slip friction: an irregular pulse train exciting wooden resonances."""
    n = n_of(d + 0.2); t = t_of(n)
    rate = base * (1 + 0.45 * np.sin(2 * np.pi * 0.9 * t / d + 0.5)) * (1 + 0.15 * smooth_noise(rng, n, 6))
    rate = np.clip(rate, 8, 80)
    ph = np.cumsum(rate) / SR
    pulses = np.zeros(n); idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    pulses[idx] = rng.uniform(0.5, 1.0, len(idx))
    x = sum(peak_res(pulses, f * (1 + 0.04 * np.sin(2 * np.pi * 0.7 * t[0] + k)), 18) * (1.0 / (k + 1)) for k, f in enumerate(res))
    x = x + 0.15 * bp(noise(rng, n), 800, 3000) * (pulses > 0).astype(float)
    env = np.clip(t / 0.05, 0, 1) * np.clip((d + 0.1 - t) / 0.15, 0, 1)
    return x * env * 2.0


def bell(f, n, decay=0.7, rng=None):
    t = t_of(n)
    return (np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / (decay * 0.4))
            + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / (decay * 0.2))) * np.exp(-t / decay) * (1 - np.exp(-t / 0.002))


PENTA = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96]  # C major pentatonic, high


def fx_shimmer(rng, d=2.0, density=14, rise=False):
    n = n_of(d + 1.0); t = t_of(n)
    out = np.zeros((n, 2))
    k = int(density * d)
    for i in range(k):
        st = rng.uniform(0, d) if not rise else d * np.sqrt(rng.uniform(0, 1))
        pool = PENTA if not rise else PENTA[int(len(PENTA) * min(0.99, st / d * 0.7)):]
        m = pool[rng.integers(0, len(pool))]
        f = 440 * 2 ** ((m - 69) / 12)
        b = bell(f, n_of(1.0), decay=rng.uniform(0.3, 0.8)) * rng.uniform(0.3, 1.0)
        add_at(out, pan_st(b, rng.uniform(-0.7, 0.7)), n_of(st))
    air = hp(noise(rng, n), 6000) * np.clip(t / 0.3, 0, 1) * np.clip((d + 0.6 - t) / 0.8, 0, 1) * 0.12
    out += np.stack([air, np.roll(air, 37)], 1)
    if rise:
        # bright swelling chord that rises an octave
        sw = np.zeros(n); fr = 2 ** (np.clip(t / d, 0, 1))
        for f in [261.6, 329.6, 392.0, 523.3]:
            ph = 2 * np.pi * np.cumsum(f * fr) / SR
            sw += sum(np.sin(h * ph) / h for h in range(1, 7))
        sw *= (np.clip(t / d, 0, 1) ** 2) * np.clip((d + 0.5 - t) / 0.5, 0, 1) * 0.12
        out += np.stack([sw, sw], 1)
    return out


def fx_boing(rng, f0=320, d=0.35):
    n = n_of(d); t = t_of(n)
    f = f0 * (1 + 0.25 * np.sin(2 * np.pi * 14 * t) * np.exp(-t / 0.15)) * (1 + 0.6 * np.exp(-t / 0.03))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ar(n, 0.003, 0.12) * 0.6


def fx_slam(rng):
    n = n_of(1.0); t = t_of(n)
    x = modal(n, [(88, 0.22, 1.0), (141, 0.15, 0.8), (233, 0.1, 0.6), (412, 0.06, 0.4), (690, 0.04, 0.25)], rng=rng)
    x += lp(noise(rng, n), 2500) * env_ar(n, 0.0008, 0.03) * 1.2
    for k, dt in enumerate([0.035, 0.07, 0.11]):
        r = modal(n_of(0.3), [(2300 + 400 * k, 0.05, 0.3), (3600 + 300 * k, 0.04, 0.2)], rng=rng)
        add_at(x, r, n_of(dt))
    x += grains(rng, n, 500, lo=700, hi=5000, decay=0.2) * 0.5
    return x


def fx_grunt(rng, d=0.7):
    n = n_of(d); t = t_of(n)
    f0 = 340 * (1 + 0.08 * np.sin(np.pi * t / d)) * (1 + 0.03 * smooth_noise(rng, n, 25))
    form = [(380, 90, 1.0), (1650, 160, 0.35), (2700, 220, 0.18)]
    x = voice(f0, form, tilt=1.2, max_f=5000, rng=rng)
    trem = 1 + 0.35 * np.sin(2 * np.pi * 9 * t)
    env = np.clip(t / 0.04, 0, 1) * np.clip((d - t) / 0.12, 0, 1)
    breath = bp(noise(rng, n), 800, 4000) * 0.06
    return lp(x * trem * env, 4500) * 0.5 + breath * env


def fx_pop(rng, up=True):
    n = n_of(0.25); t = t_of(n)
    f = (380 + 650 * (1 - np.exp(-t / 0.025))) if up else (950 - 600 * (1 - np.exp(-t / 0.03)))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ar(n, 0.001, 0.05) * 0.8
    click = modal(n, [(1800, 0.015, 0.4), (2650, 0.01, 0.3)], rng=rng)
    add_at(x, click, n_of(0.045 if up else 0.0))
    if not up:
        x += bp(noise(rng, n), 500, 3000) * env_ar(n, 0.002, 0.06) * 0.4
    return x


def fx_pulley(rng, d=2.0):
    n = n_of(d + 0.2); t = t_of(n); out = np.zeros(n)
    k = 0; st = 0.05
    while st < d:
        m = n_of(0.16); tt = t_of(m)
        f = (1250 + 250 * np.sin(k * 1.7)) * (1 + 0.06 * np.sin(2 * np.pi * 32 * tt)) * (1 + 0.12 * tt / 0.16)
        sq = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / 0.16) ** 2
        sq += 0.3 * np.sin(2 * np.pi * np.cumsum(2 * f) / SR) * np.sin(np.pi * tt / 0.16) ** 3
        add_at(out, sq * rng.uniform(0.5, 0.9), n_of(st))
        st += 0.3 + 0.08 * np.sin(k); k += 1
    rope = fx_creak(rng, d, base=40, res=(420, 780, 1300)) * 0.25
    return out * 0.35 + rope[:n]


def fx_beeps(rng, d=4.1, t0_off=0.05):
    n = n_of(d + 0.3); t = t_of(n); out = np.zeros(n)
    i = 0
    while True:
        st = t0_off + i * 0.36
        if st > d: break
        amp = 1.0 if st < 2.9 else max(0.0, 1 - (st - 2.9) / 1.2)
        if amp <= 0.01: break
        m = n_of(0.075); tt = t_of(m)
        b = (np.sin(2 * np.pi * 1650 * tt) + 0.25 * np.sign(np.sin(2 * np.pi * 1650 * tt)) * 0.3) * np.clip(tt / 0.004, 0, 1) * np.clip((0.075 - tt) / 0.006, 0, 1)
        add_at(out, b * amp * 0.5, n_of(st)); i += 1
    hum = (np.sin(2 * np.pi * 120 * t) * 0.5 + np.sin(2 * np.pi * 240 * t) * 0.2) * 0.012 * np.clip(1 - (t - 2.9) / 1.2, 0, 1) * np.clip(t / 0.2, 0, 1)
    return lp(out, 7000) + hum


def fx_hm(rng, d=0.32, f_from=150, f_to=185):
    n = n_of(d); t = t_of(n)
    f0 = f_from + (f_to - f_from) * np.clip(t / d, 0, 1) ** 1.5
    x = voice(f0, [(260, 70, 1.0), (1000, 150, 0.15), (2200, 200, 0.08)], tilt=1.4, max_f=3500, rng=rng)
    return lp(x, 2000) * np.sin(np.pi * np.clip(t / d, 0, 1)) * 0.35


def fx_trot(rng, d=0.9):
    n = n_of(d + 0.1); out = np.zeros(n); st = 0.0; k = 0
    while st < d:
        m = n_of(0.08); tt = t_of(m)
        p = np.sin(2 * np.pi * (180 - 600 * tt) * tt) * np.exp(-tt / 0.015) * 0.5 + lp(rng.standard_normal(m), 1200) * np.exp(-tt / 0.01) * 0.3
        add_at(out, p * (0.6 + 0.4 * (k % 2)), n_of(st)); st += 0.13 + 0.02 * (k % 3); k += 1
    return out


def fx_sniff(rng, d=1.2):
    n = n_of(d + 0.1); out = np.zeros(n); st = 0.0; k = 0
    while st < d:
        for j in range(3 + (k % 2)):
            m = n_of(0.055); tt = t_of(m)
            s = bp(rng.standard_normal(m), 900, 4500) * np.sin(np.pi * tt / 0.055) ** 1.5
            add_at(out, s * (0.8 - j * 0.1), n_of(st)); st += 0.085
        st += 0.18; k += 1
    return out * 0.7


def fx_paw_dig(rng, d=1.2):
    n = n_of(d + 0.2); out = np.zeros(n); st = 0.0; k = 0
    while st < d:
        m = n_of(0.06); tt = t_of(m)
        s = bp(rng.standard_normal(m), 700, 6000) * np.exp(-tt / 0.02) + grains(rng, m, 2500, lo=900, hi=6000) * 0.6
        add_at(out, s * (0.6 + 0.4 * rng.uniform()), n_of(st)); st += 1 / 11 + rng.uniform(-0.01, 0.01); k += 1
    out += fx_dirt_fall(rng, d)[:n] * 0.4
    return out * 0.7


def fx_bark(rng):
    d = 0.24; n = n_of(d); t = t_of(n)
    f0 = 560 * np.exp(-t / 0.25) + 330
    form = [(780, 120, 1.0), (1350, 160, 0.6), (2600, 260, 0.25)]
    x = voice(f0, form, tilt=1.0, max_f=6000, rng=rng)
    env = np.clip(t / 0.008, 0, 1) * np.exp(-np.maximum(0, t - 0.06) / 0.07)
    x = x * env + bp(rng.standard_normal(n), 1000, 5000) * env_ar(n, 0.002, 0.03) * 0.3
    return lp(x, 5500) * 0.6


def fx_hop(rng):
    n = n_of(0.22); t = t_of(n)
    f = 300 + 500 * (t / 0.22) ** 0.7
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.22) ** 2 * 0.35 + fx_brush(rng, 0.22)[:n] * 0.4


def fx_clap(rng):
    n = n_of(0.35); t = t_of(n)
    x = bp(rng.standard_normal(n), 700, 3500) * env_ar(n, 0.0008, 0.018)
    x += hp(rng.standard_normal(n), 1500) * np.exp(-((t - 0.06) / 0.07) ** 2) * 0.12  # dust puff
    return x


def fx_door(rng):
    n = n_of(0.9); out = np.zeros(n)
    latch = modal(n_of(0.2), [(2400, 0.02, 0.5), (3900, 0.015, 0.35), (1300, 0.03, 0.3)], rng=rng)
    add_at(out, latch, 0)
    add_at(out, fx_creak(rng, 0.5, base=30, res=(780, 1300, 2100)) * 0.6, n_of(0.08))
    return out


def fx_humming(rng, d=3.3):
    """Grandpa hums a cheerful little tune (nasal 'mmm' voice following a melody in C)."""
    notes = [(0.0, 52, 0.28), (0.3, 55, 0.28), (0.6, 57, 0.55), (1.2, 55, 0.25), (1.45, 52, 0.25), (1.7, 55, 0.6),
             (2.35, 60, 0.3), (2.65, 59, 0.25), (2.9, 55, 0.4)]
    n = n_of(d + 0.3); t = t_of(n)
    f0 = np.full(n, 440 * 2 ** ((52 - 69) / 12))
    amp = np.zeros(n)
    for st, m, du in notes:
        a, b = n_of(st), n_of(min(d, st + du))
        f0[a:] = 440 * 2 ** ((m - 69) / 12)
        seg = t_of(b - a)
        amp[a:b] = np.maximum(amp[a:b], np.clip(seg / 0.04, 0, 1) * np.clip((du - seg) / 0.06, 0, 1))
    from scipy.ndimage import gaussian_filter1d
    f0 = gaussian_filter1d(f0, n_of(0.02)) * (1 + 0.012 * np.sin(2 * np.pi * 5.2 * t))
    amp = gaussian_filter1d(amp, n_of(0.01))
    x = voice(f0, [(250, 60, 1.0), (1100, 200, 0.12), (2500, 250, 0.06)], tilt=1.5, max_f=3500, rng=rng)
    return lp(x * amp, 1800) * 0.55


def fx_bone_land(rng):
    n = n_of(0.5)
    x = fx_thud(rng)[:n] * 0.6
    add_at(x, fx_brush(rng, 0.3) * 0.6, 0)
    return x


def fx_drag(rng, d=0.7):
    n = n_of(d); t = t_of(n)
    stutter = 0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 9 * t))
    x = bp(rng.standard_normal(n), 300, 2500) * stutter * np.sin(np.pi * t / d) ** 0.7
    x += fx_creak(rng, d, base=18, res=(300, 560, 900))[:n] * 0.25
    return x * 0.6


def make(cue, rng):
    ty = cue["type"]; d = cue.get("dur")
    if ty == "dig": return fx_dig(rng)
    if ty == "dig_fast": return fx_dig(rng, fast=True)
    if ty == "clunk": return fx_clunk(rng)
    if ty == "brush": return fx_brush(rng)
    if ty == "lift_whoosh": return fx_whoosh(rng, d or 0.9, 250, 900, -0.1, 0.3)
    if ty == "dirt_fall": return fx_dirt_fall(rng, d or 0.8)
    if ty == "thud_soft": return fx_thud(rng)
    if ty == "creak": return fx_creak(rng, d or 1.0)
    if ty == "shimmer": return fx_shimmer(rng, d or 2.0)
    if ty == "shimmer_rise": return fx_shimmer(rng, d or 1.8, density=26, rise=True)
    if ty == "panic_boing": return fx_boing(rng, 360)
    if ty == "slam": return fx_slam(rng)
    if ty == "grunt": return fx_grunt(rng, d or 0.7)
    if ty == "pop_snap": return fx_pop(rng, True)
    if ty == "pop_out": return fx_pop(rng, False)
    if ty == "pulley_squeak": return fx_pulley(rng, d or 2.0)
    if ty == "detector_beeps": return fx_beeps(rng, d or 4.1)
    if ty == "shrug": return fx_hm(rng)
    if ty == "paws_trot": return fx_trot(rng, d or 0.9)
    if ty == "sniff": return fx_sniff(rng, d or 1.2)
    if ty == "paw_dig": return fx_paw_dig(rng, d or 1.2)
    if ty == "whoosh": return fx_whoosh(rng, d or 1.0, 400, 1800, 0.0, -0.7)
    if ty == "bark_happy": return fx_bark(rng)
    if ty == "bone_land": return fx_bone_land(rng)
    if ty == "sparkle_pop": return fx_shimmer(rng, 0.5, density=12)
    if ty == "hand_clap": return fx_clap(rng)
    if ty == "door": return fx_door(rng)
    if ty == "humming": return fx_humming(rng, d or 3.3)
    if ty == "whoosh_up": return fx_whoosh(rng, d or 0.6, 300, 3200, 0.0, 0.0)
    if ty == "hop": return fx_hop(rng)
    if ty == "drag": return fx_drag(rng, d or 0.7)
    raise ValueError(f"unknown sfx type {ty}")


# per-type mix level (dB) and stereo position
LEVEL = {"dig": -6, "dig_fast": -7, "clunk": -3, "brush": -10, "lift_whoosh": -8, "dirt_fall": -9, "thud_soft": -5, "creak": -6,
         "shimmer": -8, "shimmer_rise": -6, "panic_boing": -14, "slam": -2, "grunt": -7, "pop_snap": -8, "pop_out": -9,
         "pulley_squeak": -9, "detector_beeps": -9, "shrug": -12, "paws_trot": -12, "sniff": -7, "paw_dig": -9, "whoosh": -8,
         "bark_happy": -4, "bone_land": -10, "sparkle_pop": -11, "hand_clap": -9, "door": -9, "humming": -7, "whoosh_up": -6,
         "hop": -14, "drag": -10}
PAN = {"detector_beeps": 0.45, "shrug": 0.45, "humming": 0.15, "door": -0.25, "bark_happy": 0.0}


def main():
    tl = json.loads((REEL / "timeline.json").read_text())
    N = n_of(tl["duration"])
    bus = np.zeros((N + n_of(3), 2))
    for i, cue in enumerate(tl["sfx"]):
        rng = np.random.default_rng(1000 + i)
        x = make(cue, rng)
        if x.ndim == 1:
            x = norm(x)
            x = pan_st(x, PAN.get(cue["type"], 0.0))
        else:
            x = norm(x)
        x = fade_edges(x.copy(), 0.001, 0.02)
        g = 10 ** ((LEVEL.get(cue["type"], -8) + 20 * np.log10(cue.get("gain", 1.0))) / 20)
        add_at(bus, x * g, n_of(cue["t"]))
    # small outdoor-ish ambience: short bright room + a touch of wind/birds bed
    ir = synth_ir(rt60=0.35, predelay=0.01, lp_hz=7000, seed=3)
    wet = convolve_st(bus, ir)
    bus = bus * 0.9 + wet * 0.22
    rng = np.random.default_rng(7)
    wind = lp(rng.standard_normal((len(bus), 2)), 500) * (0.5 + 0.5 * smooth_noise(rng, len(bus), 0.3)[:, None]) * 10 ** (-46 / 20)
    bus += wind
    bus = bus[:N]
    pk = np.max(np.abs(bus))
    bus = bus * (10 ** (-3 / 20) / pk)
    bus = limiter(bus, -3.0)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sf.write(OUT, bus.astype(np.float32), SR, subtype="FLOAT")
    print(f"wrote {OUT} ({len(bus) / SR:.2f}s, peak {db(np.max(np.abs(bus))):.1f} dBFS, {len(tl['sfx'])} cues)")


if __name__ == "__main__":
    main()
