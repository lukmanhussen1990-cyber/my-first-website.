#!/usr/bin/env python3
"""Sound effects for the balls-double reel -> audio/sfx/*.wav + audio/sfx_cues.json (read by mix.py).

Every sound is made in code (numpy, fixed seeds, helpers from the earlier reels). No AI voice, no recordings: the
user's own voiceover stays the main sound and every effect is kept quiet under it (mix.py ducks them while the
voice speaks). Times come from events.py (the same moments the camera hits and the 2D effects use), which reads
the word times of the user's voice (faster-whisper) and the shot cuts.
Usage: python3 make_sfx.py
"""
import json
import os
import subprocess

import numpy as np
import soundfile as sf

import audiolib as A
from audiolib import SR, add_at, att, bp, cosramp, hp, lp, n_, place, rms, rng, save, tt

HERE = A.HERE
P = lambda *a: os.path.join(HERE, *a)
SRC = P("audio", "sfx_src")
WORDS = json.load(open(P("audio", "voiceover.words.json")))
VO = json.load(open(P("audio", "vo_lines.json")))
SHOTS = {s["id"]: s for s in json.load(open(P("shots.json")))["shots"]}
DUR = json.load(open(P("shots.json")))["duration"]

TAKES = {}


def word(line, idx=0):
    ws = [w for w in WORDS if w["line"] == line]
    return ws[idx]["s"]


def line_span(i):
    l = VO["lines"][i - 1]
    return l["start"], l["end"]


def shot(i):
    return SHOTS[i]["t0"], SHOTS[i]["t1"]


def load(name, trim=True):
    """ElevenLabs take -> float stereo 48 kHz, leading silence trimmed (keeps 5 ms)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(SRC, TAKES.get(name, name) + ".mp3"),
                          "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
    if trim:
        env = np.abs(x).max(axis=1)
        thr = env.max() * 10 ** (-40 / 20)
        i0 = max(0, int(np.argmax(env > thr)) - n_(0.005))
        x = x[i0:]
    return x


def fade(x, fi=0.005, fo=0.05):
    x = x.copy()
    a, b = n_(fi), n_(fo)
    if a:
        x[:a] *= cosramp(a)[:, None]
    if b:
        x[-b:] *= cosramp(b)[::-1][:, None]
    return x


def seg(x, t0, t1, fi=0.005, fo=0.05):
    return fade(x[n_(t0):n_(t1)], fi, fo)


def stereo(x):
    return x if x.ndim == 2 else np.stack([x, x], 1)


def pitch(x, semis):
    """Resample-pitch (speed changes with it): for drum / sting variations."""
    from scipy.signal import resample_poly
    r = 2 ** (semis / 12)
    up, down = 1000, int(round(1000 * r))
    return resample_poly(x, up, down, axis=0)


# --------------------------------------------------------------------------------------------- code-made
def mk_whoosh(d=0.45, f0=500, f1=3200, seed=1):
    r = rng(seed)
    t = tt(d)
    pk = d * 0.7
    fc = np.where(t < pk, f0 * (f1 / f0) ** (t / pk), f1)
    y = A.svf(lp(r.standard_normal(len(t)), 7000), fc, q=1.4)
    env = np.where(t < pk, (t / pk) ** 2.5, np.exp(-(t - pk) / 0.05))
    return place(y * env, 0, "room", -14)


def mk_ding():
    y = A.modal([(1568, 1.0, 0.5), (3136, 0.1, 0.25), (1568 * 2.76, 0.12, 0.16), (1568 * 5.4, 0.05, 0.05)],
                1.6, seed=901, strike=0.05, strike_tau=0.0008, strike_hp=4000, beat=0.0012, twin=0.12)
    return place(hp(y, 400), 0, "room", -16)


def mk_sparkle():
    r = rng(5)
    out = np.zeros(n_(1.0))
    for k, f in enumerate([2637, 3136, 3951, 4699]):
        y = A.modal([(f, 1.0, 0.18), (f * 2.01, 0.2, 0.08)], 0.9, seed=10 + k, strike=0.02)
        add_at(out, y * 0.6, 0.05 * k + r.uniform(0, 0.01))
    return place(hp(out, 1500), 0, "room", -12)


def mk_womp():
    """Sad 'wah-waaah' (muted trombone-ish): two falling notes with a wah filter."""
    d = 1.3
    t = tt(d)
    f = np.where(t < 0.42, 233 * (1 - 0.02 * t), 220 * (196 / 220) ** np.clip((t - 0.45) / 0.8, 0, 1))
    f = f * (1 + 0.012 * np.sin(2 * np.pi * 5.5 * t) * att(t - 0.6, 0.2))
    src = A.saw(f)
    wah = 500 + 900 * (0.5 + 0.5 * np.sin(2 * np.pi * np.where(t < 0.42, 2.4, 1.2) * t - 1.5))
    y = A.svf(src, wah, q=2.5, mode="bp")
    env = att(t, 0.03) * (1 - 0.85 * att(t - 0.38, 0.05) * (1 - att(t - 0.45, 0.04))) * (1 - att(t - 1.0, 0.3))
    return place(lp(y * env, 3500), 0, "room", -14)


def mk_blink():
    t = tt(0.06)
    f = 2400 * (1 - 0.5 * t / 0.06)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.012)
    return place(y, 0)


def mk_heartbeat():
    out = np.zeros(n_(0.6))
    for t0, a in ((0.0, 1.0), (0.18, 0.7)):
        t = tt(0.25)
        f = 55 * (1 + 0.6 * np.exp(-t / 0.02))
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * att(t, 0.004) * np.exp(-t / 0.07)
        add_at(out, y * a, t0)
    return place(lp(out, 300), 0)


def mk_drip():
    y = A.bubble(1400, 0.012, rise=1.2, amp=1.0)
    return place(np.concatenate([y, np.zeros(n_(0.3))]), 0, "small", -8)


def mk_pad(d=2.2):
    """Soft calm documentary pad (A major add9, slow swell): the twist 'What you don't know'."""
    t = tt(d)
    y = np.zeros(len(t))
    for f, a in [(220, 1.0), (277.2, 0.6), (329.6, 0.7), (493.9, 0.35), (440, 0.4)]:
        for det in (-4, 4):
            y += a * np.sin(2 * np.pi * f * 2 ** (det / 1200) * t + det)
    y = lp(y, 1800) * att(t, 0.5) * (1 - att(t - (d - 0.8), 0.8))
    return place(y, 0, "hall", -10)


def mk_boom():
    t = tt(1.2)
    f = 38 + 50 * np.exp(-t / 0.04)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * att(t, 0.003) * np.exp(-t / 0.35)
    y += lp(rng(3).standard_normal(len(t)), 300) * np.exp(-t / 0.05) * 0.5
    return place(y, 0, "hall", -12)


def mk_pop():
    r = rng(4)
    t = tt(0.25)
    y = bp(r.standard_normal(len(t)), 800, 6000) * att(t, 0.001) * np.exp(-t / 0.02)
    return place(y, 0, "room", -12)



# --------------------------------------------------------------------------------------------- new code-made
def stretch(x, factor):
    """Time-stretch (rubberband, same pitch) a stereo float buffer."""
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        sf.write(a, x, SR, subtype="FLOAT")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a, "-af",
                        f"rubberband=tempo={1 / factor:.4f}:transients=smooth", b], check=True)
        y, _ = sf.read(b, dtype="float64", always_2d=True)
    return y


def loop_to(x, d, xf=0.25):
    """Repeat a stereo buffer with crossfades until it is d seconds long."""
    out = x.copy()
    k = n_(xf)
    while len(out) < n_(d):
        r = cosramp(k)[:, None]
        out = np.concatenate([out[:-k], out[-k:] * (1 - r) + x[:k] * r, x[k:]])
    return out[:n_(d)]


def mk_click(f=2600, seed=1):
    t = tt(0.05)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.004) + hp(rng(seed).standard_normal(len(t)), 3000) * np.exp(-t / 0.0015)
    return place(y * 0.8, 0, "small", -12)


def mk_tick(tock=False):
    t = tt(0.12)
    f = 1900 if tock else 2500
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.006) + 0.5 * hp(rng(7 + tock).standard_normal(len(t)), 2500) * np.exp(-t / 0.002)
    y += 0.4 * np.sin(2 * np.pi * 800 * t) * np.exp(-t / 0.015)
    return place(y, 0, "room", -16)


def mk_thud():
    t = tt(0.6)
    f = 70 + 60 * np.exp(-t / 0.03)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)
    y += lp(rng(11).standard_normal(len(t)), 500) * np.exp(-t / 0.03) * 0.8
    return place(y, 0, "small", -10)


def mk_slide_whistle(d=1.6, f0=1900, f1=500):
    t = tt(d)
    f = f0 * (f1 / f0) ** (t / d)
    f = f * (1 + 0.015 * np.sin(2 * np.pi * 6 * t))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.15 * hp(rng(3).standard_normal(len(t)), 3000)
    env = att(t, 0.05) * (1 - att(t - (d - 0.4), 0.4))
    return place(lp(y * env, 5000) * 0.6, 0, "room", -16)


def mk_scream(d=1.25):
    """Comedic man's scream 'AAAAH!': sawtooth voice through vowel formants, pitch jumps up, wobbles, falls."""
    t = tt(d)
    f = 280 + 260 * att(t, 0.08) - 140 * att(t - 0.8, 0.45)
    f = f * (1 + 0.035 * np.sin(2 * np.pi * 7.5 * t) + 0.01 * rng(5).standard_normal(len(t)).cumsum() / np.sqrt(SR * 2))
    src = A.saw(f) + 0.12 * rng(6).standard_normal(len(t))
    y = sum(g * A.svf(src, fc, q=q, mode="bp") for fc, q, g in ((850, 6, 1.0), (1250, 7, 0.7), (2900, 8, 0.35), (3600, 9, 0.2)))
    env = att(t, 0.04) * (1 - att(t - (d - 0.35), 0.35))
    return place(hp(y * env, 150), 0.25, "hall", -12)


def pluck(f, d=1.2, seed=0, bright=0.5):
    """Karplus-Strong plucked string (lute)."""
    r = rng(seed)
    N = int(SR / f)
    buf = r.uniform(-1, 1, N)
    buf = lp(buf, 1500 + 6000 * bright)
    out = np.zeros(n_(d))
    for i in range(len(out)):
        out[i] = buf[i % N]
        buf[i % N] = 0.996 * 0.5 * (buf[i % N] + buf[(i + 1) % N])
    return out * (1 - att(tt(d) - (d - 0.15), 0.15))


def mk_medieval(d=8.6):
    """Cheerful old-folk tune: lute plucks + wooden flute melody + a soft drone (D dorian)."""
    bpm = 132
    beat = 60 / bpm
    out = np.zeros(n_(d + 1.5))
    D = 146.83
    scale = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15]
    lute = [0, 4, 2, 4, 0, 4, 2, 4, 1, 5, 3, 5, 1, 5, 3, 5]
    k = 0
    while k * beat / 2 < d:
        deg = lute[k % len(lute)]
        add_at(out, 0.5 * pluck(D * 2 ** (scale[deg] / 12), 0.9, seed=k, bright=0.4), k * beat / 2)
        k += 1
    mel = [(7, 1), (8, 1), (9, 2), (8, 1), (7, 1), (5, 2), (7, 1), (5, 1), (3, 1), (2, 1), (0, 4),
           (4, 1), (5, 1), (7, 2), (9, 1), (7, 1), (5, 2), (3, 1), (2, 1), (0, 4)]
    tcur = 0.0
    for deg, ln in mel:
        dd = ln * beat
        tn = tt(dd * 0.95)
        f = 2 * D * 2 ** (scale[deg] / 12) * (1 + 0.008 * np.sin(2 * np.pi * 5.2 * tn))
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.12 * np.sin(4 * np.pi * np.cumsum(f) / SR)
        y += 0.05 * bp(rng(int(tcur * 100)).standard_normal(len(tn)), 1500, 5000)
        y *= att(tn, 0.03) * (1 - att(tn - (dd * 0.95 - 0.06), 0.06))
        add_at(out, 0.35 * y, tcur)
        tcur += dd
        if tcur > d:
            break
    tdr = tt(len(out) / SR)
    drone = 0.08 * (np.sin(2 * np.pi * D / 2 * tdr) + 0.5 * np.sin(2 * np.pi * D * 3 / 4 * tdr))
    out += lp(drone, 800)
    out = out[:n_(d)] * (1 - att(tt(d) - (d - 0.4), 0.4))
    return place(out, 0, "hall", -16)


def mk_crowd(d=1.8):
    """Small crowd of people yelling 'aaah!' and running (formant noise voices + footsteps)."""
    out = np.zeros(n_(d))
    for k in range(6):
        r = rng(40 + k)
        dd = r.uniform(0.6, 1.1)
        t = tt(dd)
        f = r.uniform(180, 420) * (1 + 0.3 * att(t, 0.1)) * (1 + 0.03 * np.sin(2 * np.pi * r.uniform(5, 8) * t))
        src = A.saw(f) + 0.2 * r.standard_normal(len(t))
        y = A.svf(src, r.uniform(700, 1000), q=5, mode="bp") + 0.6 * A.svf(src, r.uniform(1100, 1500), q=6, mode="bp")
        add_at(out, y * att(t, 0.05) * (1 - att(t - (dd - 0.25), 0.25)) * r.uniform(0.4, 0.8), r.uniform(0, d - dd))
    for k in range(int(d / 0.11)):
        tk = tt(0.06)
        add_at(out, 0.3 * lp(rng(80 + k).standard_normal(len(tk)), 900) * np.exp(-tk / 0.012), k * 0.11 + rng(k).uniform(0, 0.03))
    return place(lp(out, 4000), 0, "hall", -10)


def mk_scratch():
    t = tt(0.45)
    f = 900 * (1 + 0.8 * np.sin(2 * np.pi * 3.5 * t)) * (1 - 0.6 * t / 0.45)
    y = A.svf(rng(9).standard_normal(len(t)), f, q=4, mode="bp") * 2 + 0.3 * A.saw(f / 4)
    return place(y * (1 - att(t - 0.35, 0.1)), 0, "room", -14)


def mk_clinks(d=6.0, seed=20):
    out = np.zeros(n_(d))
    r = rng(seed)
    t = 0.3
    while t < d - 0.4:
        f = r.uniform(2800, 4800)
        y = A.modal([(f, 1.0, 0.12), (f * 2.7, 0.3, 0.05)], 0.4, seed=int(t * 50), strike=0.1)
        add_at(out, y * r.uniform(0.2, 0.6), t)
        t += r.uniform(0.35, 1.1)
    return place(out, 0, "room", -12)


def mk_fly(d=1.6, seed=3):
    t = tt(d)
    r = rng(seed)
    f = 210 * (1 + 0.08 * np.sin(2 * np.pi * 1.3 * t + 1) + 0.04 * np.sin(2 * np.pi * 3.7 * t))
    y = A.saw(f) * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * t)) + 0.1 * r.standard_normal(len(t))
    y = bp(y, 180, 3000)
    pan = np.sin(2 * np.pi * 0.7 * t)
    env = att(t, 0.25) * (1 - att(t - (d - 0.35), 0.35)) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.9 * t + 0.5) ** 2)
    st = np.stack([y * env * (1 - 0.6 * pan), y * env * (1 + 0.6 * pan)], 1) * 0.5
    return st


def mk_drip_loud():
    y = A.bubble(1100, 0.018, rise=1.4, amp=1.0, harm=0.2)
    return place(np.concatenate([y, np.zeros(n_(0.4))]), 0, "small", -6)


def mk_crow():
    out = np.zeros(n_(0.9))
    for k, t0 in enumerate((0.0, 0.32)):
        t = tt(0.26)
        f = 520 - 120 * t / 0.26
        src = A.saw(f) * (1 + 0.5 * rng(k).standard_normal(len(t)))
        y = A.svf(src, 1200, q=3, mode="bp") * att(t, 0.01) * (1 - att(t - 0.18, 0.08))
        add_at(out, y, t0)
    return place(out, -0.4, "hall", -8)


def mk_crickets(d=3.0):
    t = tt(d)
    out = np.zeros(len(t))
    for k, (f, rate, ph) in enumerate(((4300, 3.1, 0.0), (4700, 2.6, 1.3), (3900, 3.6, 2.1))):
        chirp = (np.sin(2 * np.pi * rate * t + ph) > 0.55).astype(float)
        chirp = lp(chirp, 60)
        pulses = 0.5 + 0.5 * np.sin(2 * np.pi * 32 * t)
        out += np.sin(2 * np.pi * f * t) * chirp * pulses * (0.5 - 0.1 * k)
    return place(out * att(t, 0.4) * (1 - att(t - (d - 0.6), 0.6)), 0, "hall", -10)


def mk_bark():
    out = np.zeros(n_(0.5))
    t = tt(0.16)
    f = 520 * (1 - 0.35 * t / 0.16)
    src = A.saw(f) + 0.4 * rng(12).standard_normal(len(t))
    y = A.svf(src, 900, q=3, mode="bp") * att(t, 0.01) * np.exp(-t / 0.06)
    add_at(out, y, 0.0)
    return place(lp(out, 2500) * 0.7, 0.5, "hall", -6)


def mk_birds(d=3.6):
    out = np.zeros(n_(d))
    r = rng(30)
    t0 = 0.2
    while t0 < d - 0.4:
        dd = r.uniform(0.08, 0.2)
        t = tt(dd)
        f0 = r.uniform(2800, 4200)
        f = f0 * (1 + r.uniform(-0.3, 0.4) * t / dd)
        add_at(out, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dd) * r.uniform(0.2, 0.5), t0)
        t0 += r.uniform(0.12, 0.6)
    return place(out, 0.3, "hall", -12)


def mk_wind(d=3.0, seed=50):
    t = tt(d)
    y = A.svf(rng(seed).standard_normal(len(t)), 500 + 250 * np.sin(2 * np.pi * 0.3 * t), q=0.8, mode="bp")
    return place(y * att(t, 0.6) * (1 - att(t - (d - 0.8), 0.8)) * 0.6, 0, None)


def mk_drone(d=3.0, f=55):
    t = tt(d)
    y = A.saw(np.full(len(t), f)) + 0.6 * A.saw(np.full(len(t), f * 1.498))
    y = A.svf(y, 400 + 300 * att(t, d), q=0.7, mode="lp") * att(t, 0.5) * (1 - att(t - (d - 0.5), 0.5))
    return place(y * 0.6, 0, "hall", -12)


def mk_gulp():
    t = tt(0.25)
    f = 180 + 300 * att(t - 0.05, 0.1)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-((t - 0.1) / 0.06) ** 2)
    b = A.bubble(600, 0.01, rise=1.5)[:len(t)]
    y[:len(b)] += 0.3 * b
    return place(lp(y, 2000), 0, "small", -14)


def mk_steps(n=4, every=0.32, seed=60):
    out = np.zeros(n_(n * every + 0.3))
    for k in range(n):
        t = tt(0.12)
        y = lp(rng(seed + k).standard_normal(len(t)), 700) * np.exp(-t / 0.018) + 0.5 * np.sin(2 * np.pi * 110 * t) * np.exp(-t / 0.03)
        add_at(out, y, k * every)
    return place(out, 0, "room", -12)


def mk_creak(d=0.7):
    t = tt(d)
    f = 320 + 120 * np.sin(2 * np.pi * 1.4 * t)
    pulses = (np.sin(2 * np.pi * np.cumsum(f / 6) / SR) > 0.97).astype(float)
    y = A.svf(lp(pulses, 6000) + 0.02 * rng(8).standard_normal(len(t)), 900, q=5, mode="bp")
    return place(y * att(t, 0.05) * (1 - att(t - (d - 0.15), 0.15)) * 3, 0.3, "room", -12)


def mk_squeak():
    t = tt(0.35)
    f = 1500 + 600 * np.sin(2 * np.pi * 2.5 * t)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * rng(4).standard_normal(len(t))) * att(t, 0.03) * (1 - att(t - 0.25, 0.1))
    return place(bp(y, 800, 4000) * 0.4, 0, "small", -12)


# --------------------------------------------------------------------------------------------- plumber sounds
def env_ad(t, a, d, total):
    return att(t, a) * (1 - att(t - (total - d), d))


def mk_grunt(d=2.7):
    """Straining 'nnnnggghhh': a strained low voice through nasal formants, getting louder and shakier."""
    t = tt(d)
    r = rng(71)
    f = 118 * (1 + 0.18 * t / d) * (1 + 0.03 * np.sin(2 * np.pi * 7 * t) * (t / d) + 0.006 * r.standard_normal(len(t)).cumsum() / np.sqrt(SR))
    src = A.saw(f) * (1 + 0.25 * np.sin(2 * np.pi * 13 * t) * (t / d)) + 0.15 * r.standard_normal(len(t)) * (t / d)
    y = A.svf(src, 260, q=4, mode="bp") + 0.6 * A.svf(src, 2300, q=6, mode="bp") + 0.35 * A.svf(src, 1100, q=5, mode="bp")
    y *= (0.35 + 0.65 * (t / d) ** 1.4) * env_ad(t, 0.12, 0.25, d)
    for k, tb in enumerate((0.75, 1.55)):       # two short breath catches
        y[n_(tb):n_(tb + 0.06)] *= np.linspace(1, 0.2, n_(tb + 0.06) - n_(tb))
        y[n_(tb + 0.06):n_(tb + 0.12)] *= np.linspace(0.2, 1, n_(tb + 0.12) - n_(tb + 0.06))
    return place(hp(y, 90), 0, "small", -14)


def mk_flicker(d=2.6, events=(0.3, 0.42, 0.9, 1.35, 1.42, 2.0)):
    """Fluorescent light buzz (100/200 Hz hum) that cuts out with little clicks on each flicker."""
    t = tt(d)
    hum = sum(a * np.sin(2 * np.pi * f * t) for f, a in ((100, 1), (200, 0.6), (300, 0.3), (500, 0.15)))
    hum = hum + 0.4 * bp(rng(5).standard_normal(len(t)), 2000, 6000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 100 * t)))
    gate = np.ones(len(t))
    out = np.zeros(len(t))
    for k, e in enumerate(events):
        a, b = n_(e), n_(e + 0.05 + 0.04 * (k % 2))
        gate[a:b] = 0.05
        ck = tt(0.02)
        c = hp(rng(10 + k).standard_normal(len(ck)), 3000) * np.exp(-ck / 0.002)
        add_at(out, c, e)
        add_at(out, c * 0.7, e + 0.05)
    gate = lp(gate, 200)
    y = hum * gate * 0.25 + out
    return place(y * env_ad(t, 0.05, 0.2, d), 0, "small", -16)


def mk_rattle(d=0.8, seed=12):
    """Picture frame rattling on the tiles: fast little wooden knocks."""
    out = np.zeros(n_(d + 0.3))
    r = rng(seed)
    t = 0.0
    k = 0
    while t < d:
        y = A.modal([(r.uniform(700, 900), 1.0, 0.03), (r.uniform(1700, 2100), 0.4, 0.02)], 0.12, seed=seed + k, strike=0.2)
        add_at(out, y * r.uniform(0.4, 1.0), t)
        t += r.uniform(0.04, 0.09)
        k += 1
    return place(out, -0.2, "small", -14)


def mk_crash():
    """Frame hits the floor: wooden clack + a little glass tinkle."""
    out = np.zeros(n_(1.4))
    add_at(out, A.modal([(180, 1.0, 0.12), (420, 0.6, 0.08), (950, 0.4, 0.05)], 0.6, seed=31, strike=0.5), 0.0)
    add_at(out, lp(rng(32).standard_normal(n_(0.08)), 1500) * np.exp(-tt(0.08) / 0.015), 0.0)
    r = rng(33)
    for k in range(9):
        f = r.uniform(3000, 6500)
        add_at(out, A.modal([(f, 1.0, 0.08), (f * 1.7, 0.4, 0.05)], 0.3, seed=40 + k, strike=0.05) * r.uniform(0.15, 0.4),
               0.02 + r.uniform(0, 0.35))
    add_at(out, A.modal([(220, 0.8, 0.09), (510, 0.5, 0.06)], 0.5, seed=34, strike=0.4) * 0.5, 0.16)   # bounce
    return place(out, 0.1, "small", -12)


def mk_stab(d=0.34):
    """Short orchestral 'dun' stab (the start of the big DUN, cut short)."""
    x = A.make_dun()
    return fade(x[:n_(d)], 0.002, 0.08)


def mk_dundundun():
    out = np.zeros((n_(3.2), 2))
    add_at(out, mk_stab(0.32), 0.0)
    add_at(out, mk_stab(0.32) * 1.05, 0.38)
    big = A.make_dun()
    add_at(out, big[:n_(2.4)] * 1.15, 0.78)
    return out


def mk_flush(d=1.8, seed=3):
    """A proper flush: rushing water (filtered noise, swirling), then draining."""
    t = tt(d)
    r = rng(seed)
    n = r.standard_normal(len(t))
    sw = A.svf(n, 700 + 500 * np.sin(2 * np.pi * 2.2 * t), q=1.2, mode="bp") + 0.5 * bp(n, 2500, 7000)
    y = sw * att(t, 0.06) * (1 - 0.7 * att(t - 0.6, d - 0.6))
    for k in range(10):
        add_at(y, A.bubble(r.uniform(300, 800), r.uniform(0.006, 0.014), rise=1.2) * r.uniform(0.2, 0.5), r.uniform(0.6, d - 0.2))
    return place(y * (1 - att(t - (d - 0.3), 0.3)), 0, "small", -12)


def mk_horror(d=0.9):
    """Shrill 'eeek' strings stab (dissonant cluster, tremolo)."""
    t = tt(d)
    y = np.zeros(len(t))
    for k, f in enumerate((1568, 1661, 1760, 2093)):
        y += A.saw(np.full(len(t), f) * (1 + 0.004 * np.sin(2 * np.pi * (5 + k) * t)))
    y = A.svf(y, 3000, q=1.2, mode="bp") * (0.6 + 0.4 * np.sin(2 * np.pi * 16 * t)) * env_ad(t, 0.01, 0.4, d)
    return place(y, 0, "hall", -12)


def mk_squelch(seed=1):
    """Plunger 'shlorp': a wet suction plop with a falling resonance + bubbles."""
    t = tt(0.4)
    r = rng(seed)
    f = 900 * np.exp(-t / 0.08) + 180
    y = A.svf(r.standard_normal(len(t)), f, q=6, mode="bp") * att(t, 0.01) * np.exp(-t / 0.12) * 2
    add_at(y, A.bubble(260, 0.02, rise=0.8) * 0.8, 0.05)
    add_at(y, A.bubble(420, 0.012, rise=1.2) * 0.5, 0.14)
    return place(lp(y, 2500), 0, "small", -10)


def mk_wood_creak(d=0.6):
    t = tt(d)
    f = 160 + 90 * t / d
    pulses = (np.sin(2 * np.pi * np.cumsum(f / 3) / SR) > 0.93).astype(float)
    y = A.svf(lp(pulses, 5000) + 0.03 * rng(9).standard_normal(len(t)), 700 + 500 * t / d, q=6, mode="bp")
    return place(y * env_ad(t, 0.05, 0.1, d) * 3, 0, "small", -12)


def mk_crack():
    """Wooden handle snapping: sharp broadband crack + splintering + woody resonance."""
    out = np.zeros(n_(0.9))
    t = tt(0.05)
    add_at(out, rng(61).standard_normal(len(t)) * np.exp(-t / 0.004) * 1.5, 0.0)
    add_at(out, A.modal([(380, 1.0, 0.06), (870, 0.7, 0.04), (1650, 0.5, 0.03), (2900, 0.3, 0.02)], 0.4, seed=62, strike=0.6), 0.0)
    r = rng(63)
    for k in range(12):
        tk = tt(0.015)
        add_at(out, hp(r.standard_normal(len(tk)), 2500) * np.exp(-tk / 0.003) * r.uniform(0.2, 0.6), 0.01 + r.uniform(0, 0.12))
    return place(out, 0, "small", -10)


def mk_knock(seed=0):
    """One knuckle knock on a wooden door."""
    y = A.modal([(150, 1.0, 0.07), (330, 0.7, 0.05), (720, 0.4, 0.03), (1500, 0.2, 0.015)], 0.35, seed=70 + seed, strike=0.4, strike_hp=1500)
    return place(y, 0.15, "room", -14)


def mk_dial(n=7, every=0.13):
    """Phone keypad: DTMF beeps, then one ring tone."""
    rows, cols = (697, 770, 852, 941), (1209, 1336, 1477)
    r = rng(80)
    out = np.zeros(n_(n * every + 1.2))
    for k in range(n):
        t = tt(0.08)
        f1, f2 = rows[int(r.integers(0, 4))], cols[int(r.integers(0, 3))]
        add_at(out, (np.sin(2 * np.pi * f1 * t) + np.sin(2 * np.pi * f2 * t)) * env_ad(t, 0.004, 0.01, 0.08) * 0.5, k * every)
    t = tt(0.9)
    ring = (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 480 * t)) * env_ad(t, 0.02, 0.05, 0.9) * 0.3
    add_at(out, ring, n * every + 0.15)
    return place(bp(out, 300, 3400), 0.3, "small", -16)


def mk_screech(d=1.3):
    """Van tyres screeching to a stop: squealing band noise falling in pitch + a final thump."""
    t = tt(d)
    r = rng(90)
    n = r.standard_normal(len(t))
    f = 2400 - 1100 * t / d + 150 * np.sin(2 * np.pi * 9 * t)
    y = A.svf(n, f, q=14, mode="bp") * 3 + 0.4 * A.svf(n, f * 1.5, q=10, mode="bp") + 0.25 * bp(n, 300, 1200)
    y *= att(t, 0.03) * (1 - att(t - (d - 0.25), 0.2))
    add_at(y, lp(r.standard_normal(n_(0.2)), 300) * np.exp(-tt(0.2) / 0.05) * 1.5, d - 0.22)
    return place(y, -0.3, "hall", -12)


def brass(f, d, vib=0.0, bright=1.0, seed=0):
    t = tt(d)
    fr = f * (1 - 0.02 * np.exp(-t / 0.05)) * (1 + vib * 0.012 * np.sin(2 * np.pi * 5.5 * t) * att(t - 0.2, 0.2))
    y = A.saw(fr) + 0.7 * A.saw(fr * 1.003)
    cut = 400 + 2200 * bright * att(t, 0.06) * (0.6 + 0.4 * np.exp(-t / 0.4))
    return A.svf(y, cut, q=0.8, mode="lp") * env_ad(t, 0.04, min(0.15, d * 0.3), d)


def drum(kind, seed=0):
    if kind == "timp":
        t = tt(0.9)
        f0 = 73 * (1 + 0.03 * np.exp(-t / 0.05))
        return sum(a * np.sin(2 * np.pi * np.cumsum(f0 * q) / SR) * np.exp(-t / tau) for q, a, tau in ((1, 1, 0.6), (1.5, 0.5, 0.4), (2, 0.3, 0.3))) * att(t, 0.003)
    t = tt(0.25)
    return (bp(rng(seed).standard_normal(len(t)), 1500, 7000) * np.exp(-t / 0.05) + 0.6 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.03))


def mk_hero(d=1.6):
    """Heroic movie fanfare: brass chords (C - F - G - C) over a snare roll and timpani hits."""
    out = np.zeros(n_(d + 1.0))
    C, F, G = (130.81, 164.81, 196.0, 261.63), (174.61, 220.0, 261.63, 349.23), (196.0, 246.94, 293.66, 392.0)
    seq = [(0.0, C, 0.35), (0.38, C, 0.2), (0.6, F, 0.35), (0.98, G, 0.35), (1.35, C, 1.0)]
    for t0, ch, ln in seq:
        if t0 > d:
            break
        for k, f in enumerate(ch):
            add_at(out, brass(f, ln, vib=1 if ln > 0.5 else 0, seed=k) * (0.9 if k == 3 else 0.6), t0)
        add_at(out, drum("timp") * 1.2, t0)
    tt_ = 0.0
    while tt_ < d:
        add_at(out, drum("snare", int(tt_ * 100)) * (0.25 + 0.25 * tt_ / d), tt_)
        tt_ += 0.065
    return place(out * (1 - att(tt(len(out) / SR) - (len(out) / SR - 0.4), 0.4)), 0, "hall", -10)


def mk_taps():
    """Sad lone trumpet: the opening of a slow funeral call (G G C... G C E), with vibrato."""
    notes = [(392.0, 0.28), (392.0, 0.12), (523.25, 0.9), (392.0, 0.3), (523.25, 0.3), (659.25, 1.1)]
    out = np.zeros(n_(3.4))
    t0 = 0.0
    for f, ln in notes:
        y = brass(f / 2, ln, vib=1.0, bright=0.7)
        add_at(out, A.svf(y, 1400, q=1.5, mode="bp") * 1.5, t0)
        t0 += ln + 0.03
    return place(out, 0, "hall", -10)


def mk_projector(d=2.4):
    t = tt(d)
    clicks = (np.sin(2 * np.pi * 24 * t) > 0.92).astype(float)
    y = hp(lp(clicks, 4000), 800) * 0.8 + 0.15 * np.sin(2 * np.pi * 60 * t) + 0.1 * bp(rng(3).standard_normal(len(t)), 1000, 4000)
    return place(y * env_ad(t, 0.1, 0.2, d), 0.2, "room", -16)


def mk_musicbox(d=2.4):
    """Nostalgic music box: a slow little tune of bell-like plucks."""
    notes = [784, 659, 523, 659, 784, 1047, 988, 784]
    out = np.zeros(n_(d + 1.0))
    for k, f in enumerate(notes):
        if k * 0.3 > d:
            break
        add_at(out, A.modal([(f, 1.0, 0.6), (f * 2.0, 0.3, 0.3), (f * 3.01, 0.15, 0.15)], 1.2, seed=100 + k, strike=0.02) * 0.6, k * 0.3)
    return place(out, 0, "room", -14)


def mk_spray(d=1.4):
    t = tt(d)
    n = rng(7).standard_normal(len(t))
    y = (hp(n, 2500) * (0.7 + 0.3 * np.sin(2 * np.pi * 7 * t)) + 0.3 * bp(n, 400, 1500)) * env_ad(t, 0.03, 0.2, d)
    return place(y, -0.2, "room", -12)


def mk_footsteps_hall(n=4, every=0.55):
    out = np.zeros(n_(n * every + 0.5))
    for k in range(n):
        y = A.modal([(900, 1.0, 0.04), (2100, 0.5, 0.02)], 0.15, seed=120 + k, strike=0.6, strike_hp=2000)
        add_at(out, y * (0.8 if k % 2 else 1.0), k * every)
    return place(out, 0, "hall", -4)


def mk_murmur(d=0.9, seed=0):
    """A polite 'hmm' from museum visitors (two hummed voices)."""
    t = tt(d)
    y = np.zeros(len(t))
    for k, f in enumerate((120, 185)):
        fr = f * (1 + 0.04 * np.sin(np.pi * t / d)) * (1 - 0.05 * t / d)
        y += A.svf(A.saw(fr), 300 + 80 * k, q=3, mode="bp") * (0.8 - 0.3 * k)
    return place(y * env_ad(t, 0.08, 0.3, d), 0.2 * (seed - 0.5), "hall", -10)


def mk_zip(d=1.2):
    """Measuring tape pulled out: a fast ratchet buzz + rising whoosh, ending in a click."""
    t = tt(d)
    rate = 40 + 60 * att(t, 0.3)
    clicks = (np.sin(2 * np.pi * np.cumsum(rate) / SR) > 0.85).astype(float)
    y = hp(lp(clicks, 6000), 1200) * 0.8 + 0.4 * A.svf(rng(4).standard_normal(len(t)), 800 + 1800 * t / d, q=1.5, mode="bp")
    y *= env_ad(t, 0.02, 0.1, d)
    add_at(y, A.modal([(2600, 1, 0.03)], 0.1, seed=7, strike=0.3) * 0.8, d - 0.08)
    return place(y, 0.2, "small", -12)


def mk_camera():
    """Phone camera: shutter 'ka-chk' + the old flash charging whine."""
    out = np.zeros(n_(1.2))
    for k, tk in enumerate((0.0, 0.07)):
        t = tt(0.04)
        add_at(out, bp(rng(140 + k).standard_normal(len(t)), 1500, 8000) * np.exp(-t / 0.006) * (1.0 if k else 0.7), tk)
    t = tt(0.9)
    f = 2000 + 6000 * att(t, 0.9)
    add_at(out, np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.15 * env_ad(t, 0.05, 0.2, 0.9), 0.12)
    return place(out, 0, "small", -14)


def mk_piano(chord=(261.63, 329.63, 392.0, 523.25), d=2.2, seed=0):
    t = tt(d)
    y = np.zeros(len(t))
    for f in chord:
        for k in range(1, 12):
            fk = k * f * np.sqrt(1 + 0.0003 * k * k)
            if fk > 6000:
                break
            y += (k ** -1.1) * np.sin(2 * np.pi * fk * t) * np.exp(-t / (1.8 / (1 + fk / 900)))
    y *= att(t, 0.003) * (1 - att(t - (d - 0.3), 0.3))
    return place(y, 0, "hall", -14)


def mk_claps(d=4.0, start_rate=1.6, people=12):
    """Slow clapping from one or two people that grows into warm applause."""
    out = np.zeros(n_(d + 0.5))
    r = rng(150)
    one = lambda s: A.svf(rng(s).standard_normal(n_(0.06)), r.uniform(900, 1800), q=1.5, mode="bp") * np.exp(-tt(0.06) / 0.012)
    for p in range(people):
        t = 0.0 if p < 2 else r.uniform(0.6, 2.2) + p * 0.08
        per = 1 / start_rate + r.uniform(-0.03, 0.03)
        k = 0
        while t < d:
            add_at(out, one(1000 * p + k) * r.uniform(0.5, 1.0) * (1.0 if p < 2 else 0.7), t)
            per = max(0.17, per * (0.93 if p < 2 else 0.97))
            t += per + r.uniform(-0.01, 0.01)
            k += 1
    tt_ = tt(len(out) / SR)
    return place(out * (1 - att(tt_ - (d - 0.6), 0.6)), 0, "hall", -10)


def mk_slurp():
    t = tt(0.7)
    n = rng(160).standard_normal(len(t))
    y = A.svf(n, 1200 + 900 * np.sin(np.pi * t / 0.7), q=3, mode="bp") * env_ad(t, 0.05, 0.15, 0.7)
    for k in range(6):
        add_at(y, A.bubble(500 + 80 * k, 0.008, rise=1.0) * 0.3, 0.1 + k * 0.08)
    return place(y, 0, "room", -14)


def mk_shock(d=0.7):
    """Shocked orchestral hit: a short brass + timpani 'BWAM'."""
    out = np.zeros(n_(d + 1.0))
    for k, f in enumerate((98.0, 146.83, 196.0, 233.08)):
        add_at(out, brass(f, d, bright=1.2), 0.0)
    add_at(out, drum("timp") * 1.4, 0.0)
    return place(out, 0, "hall", -10)



# --------------------------------------------------------------------------------------------- genius sounds
def mk_blip():
    out = np.zeros(n_(0.35))
    for k, f in enumerate((880, 1320)):
        t = tt(0.1)
        add_at(out, np.sin(2 * np.pi * f * t) * env_ad(t, 0.005, 0.03, 0.1), k * 0.1)
    return place(out, 0, "small", -16)


def mk_plop():
    t = tt(0.5)
    out = A.bubble(260, 0.03, rise=1.6, amp=1.0, harm=0.2)
    y = np.zeros(len(t)); y[:len(out)] += out[:len(t)]
    y += 0.4 * bp(rng(5).standard_normal(len(t)), 600, 3000) * np.exp(-t / 0.02)
    add_at(y, A.bubble(520, 0.012, rise=1.2) * 0.4, 0.09)
    return place(y, 0, "small", -10)


def mk_tinkpop():
    """The bulb goes out: a little glassy 'tink' + an electric pop."""
    out = A.modal([(3200, 1.0, 0.12), (5100, 0.5, 0.06)], 0.5, seed=4, strike=0.05)
    t = tt(0.05); add_at(out, hp(rng(9).standard_normal(len(t)), 2000) * np.exp(-t / 0.006), 0.0)
    return place(out, 0, "small", -12)


def mk_gasp(n=10, d=0.9):
    """A studio audience gasping: many short in-breath 'haah' voices."""
    out = np.zeros(n_(d + 0.4))
    for k in range(n):
        r = rng(200 + k); dd = r.uniform(0.35, 0.6); t = tt(dd)
        src = r.standard_normal(len(t)) * 0.6 + 0.4 * A.saw(np.full(len(t), r.uniform(180, 320)))
        y = A.svf(src, r.uniform(800, 1300), q=4, mode="bp") + 0.6 * A.svf(src, r.uniform(1700, 2400), q=5, mode="bp")
        add_at(out, y * att(t, 0.04) * np.exp(-t / 0.25) * r.uniform(0.5, 1.0), r.uniform(0, 0.12))
    return place(out, 0, "hall", -10)


def mk_ooh(d=1.6, n=14):
    """A big stadium crowd going 'ooooh' (voices on an 'oo' vowel, pitch sliding up)."""
    out = np.zeros(n_(d + 0.6))
    for k in range(n):
        r = rng(300 + k); t = tt(d)
        f = r.uniform(110, 240) * (1 + 0.25 * att(t, d * 0.7)) * (1 + 0.02 * np.sin(2 * np.pi * r.uniform(4, 6) * t))
        y = A.svf(A.saw(f), r.uniform(330, 420), q=5, mode="bp") + 0.4 * A.svf(A.saw(f), 800, q=6, mode="bp")
        add_at(out, y * env_ad(t, 0.25, 0.5, d) * r.uniform(0.5, 1.0), r.uniform(0, 0.15))
    out += 0.15 * bp(rng(9).standard_normal(len(out)), 300, 3000) * env_ad(tt(len(out) / SR), 0.2, 0.5, len(out) / SR)
    return place(out, 0, "hall", -6)


def mk_crowd_bed(d=3.0):
    t = tt(d)
    y = bp(rng(31).standard_normal(len(t)), 250, 2500) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.7 * t))
    return place(y * env_ad(t, 0.3, 0.4, d), 0, "hall", -8)


def mk_heli(d=3.0, rate=9.0):
    """Helicopter: rhythmic low 'thwop-thwop' blade beats + a turbine whine."""
    t = tt(d)
    n = rng(41).standard_normal(len(t))
    beat = (0.5 + 0.5 * np.cos(2 * np.pi * rate * t)) ** 6
    y = lp(n, 500) * beat * 1.6 + 0.08 * np.sin(2 * np.pi * 1850 * t) + 0.25 * lp(n, 120)
    return place(y * env_ad(t, 0.2, 0.3, d), 0, "hall", -16)


def mk_fwoosh():
    """The helicopter roars past: a big whoosh with blade beats that rise then fall (doppler)."""
    d = 1.4; t = tt(d)
    n = rng(51).standard_normal(len(t))
    env = np.exp(-((t - 0.55) / 0.3) ** 2)
    rate = 11 - 4 * att(t - 0.55, 0.3)
    ph = np.cumsum(rate) / SR
    beat = (0.5 + 0.5 * np.cos(2 * np.pi * ph)) ** 5
    y = (A.svf(n, 500 + 1800 * env, q=0.9, mode="bp") * 1.2 + lp(n, 400) * beat * 1.4) * (0.2 + env)
    return place(y, 0, "hall", -10)


def mk_hero2(d=2.4):
    """Heroic slow-motion music: rising brass chords over big drums (C - G - Am - F - C)."""
    out = np.zeros(n_(d + 1.2))
    chords = [(130.81, 164.81, 196.0, 261.63), (98.0, 146.83, 196.0, 246.94), (110.0, 164.81, 220.0, 261.63),
              (87.31, 174.61, 220.0, 261.63), (130.81, 196.0, 261.63, 329.63)]
    step = d / len(chords)
    for k, ch in enumerate(chords):
        for f in ch:
            add_at(out, brass(f, step * 1.05, vib=1, bright=0.9) * 0.5, k * step)
        add_at(out, drum("timp") * 1.3, k * step)
        add_at(out, drum("snare", k) * 0.4, k * step + step / 2)
    tt_ = tt(len(out) / SR)
    return place(out * (1 - att(tt_ - (len(out) / SR - 0.5), 0.5)), 0, "hall", -10)


def mk_umbrella_pops(n=10, spread=0.3):
    out = np.zeros(n_(spread + 0.6))
    r = rng(61)
    for k in range(n):
        t = tt(0.2)
        y = A.svf(r.standard_normal(len(t)), 900 - 600 * t / 0.2, q=2, mode="bp") * np.exp(-t / 0.05) * 2
        y += 0.5 * np.sin(2 * np.pi * 120 * t) * np.exp(-t / 0.04)
        add_at(out, y * r.uniform(0.5, 1.0), r.uniform(0, spread))
    return place(out, 0, "room", -10)


def mk_splat(seed=1):
    """A wet cartoon SPLAT: a burst of filtered noise with a low thud and a few drips."""
    t = tt(0.6); r = rng(70 + seed)
    y = A.svf(r.standard_normal(len(t)), 1400 * np.exp(-t / 0.06) + 250, q=1.5, mode="bp") * np.exp(-t / 0.09) * 2.2
    y += 0.8 * np.sin(2 * np.pi * np.cumsum(90 + 60 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.07)
    for k in range(3):
        b = A.bubble(r.uniform(400, 800), 0.008, rise=1.0) * 0.25
        add_at(y, b, 0.12 + k * 0.08)
    return place(y, 0, "small", -8)


def mk_thwap(seed=0):
    """Wiper swing: rubber squeak + a soft thump at the end."""
    t = tt(0.32); r = rng(80 + seed)
    f = 1100 + 500 * np.sin(np.pi * t / 0.32)
    y = A.svf(r.standard_normal(len(t)) * 0.4 + 0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR), f, q=8, mode="bp") * env_ad(t, 0.04, 0.08, 0.32)
    add_at(y, lp(r.standard_normal(n_(0.06)), 400) * np.exp(-tt(0.06) / 0.015) * 1.4, 0.26)
    return place(y, 0, "room", -10)


def mk_whizz(d=0.7):
    t = tt(d)
    f = 2400 - 1600 * t / d
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + 0.4 * A.svf(rng(3).standard_normal(len(t)), f, q=6, mode="bp")
    return place(y * env_ad(t, 0.08, 0.1, d), 0.2, "room", -12)


def mk_news(d=4.0):
    """Newsroom music: a tense synth pulse, a little bass line and timpani hits (generic TV news bed)."""
    out = np.zeros(n_(d + 1.0))
    beat = 60 / 128
    bass = [55.0, 55.0, 65.41, 55.0, 73.42, 65.41, 55.0, 49.0]
    k = 0
    while k * beat / 2 < d:
        t = tt(beat / 2)
        f = bass[k % len(bass)]
        add_at(out, A.svf(A.saw(np.full(len(t), f)), 400, q=1.2, mode="lp") * env_ad(t, 0.01, 0.08, beat / 2) * 0.6, k * beat / 2)
        add_at(out, np.sin(2 * np.pi * 880 * tt(0.06)) * np.exp(-tt(0.06) / 0.02) * 0.15, k * beat / 2)
        if k % 8 == 0:
            add_at(out, drum("timp") * 0.8, k * beat / 2)
        k += 1
    pad = sum(np.sin(2 * np.pi * f * tt(len(out) / SR)) for f in (220, 261.63, 329.63)) * 0.06
    out += lp(pad, 2000)
    return place(out[:n_(d)] * env_ad(tt(d), 0.1, 0.4, d), 0, "room", -14)


def mk_kaching():
    """Cash register: drawer rattle + a bright bell 'ching'."""
    out = np.zeros(n_(1.4))
    r = rng(91)
    for k in range(6):
        add_at(out, A.modal([(r.uniform(1500, 2600), 1, 0.03)], 0.08, seed=k, strike=0.3) * 0.5, k * 0.025)
    add_at(out, A.modal([(2637, 1.0, 0.6), (5274, 0.4, 0.3), (7900, 0.2, 0.15)], 1.2, seed=93, strike=0.05), 0.16)
    return place(out, 0, "room", -12)


def mk_pings(n=8, every=0.13):
    out = np.zeros(n_(n * every + 0.6))
    for k in range(n):
        f = [1568, 2093, 1760, 2349][k % 4]
        y = A.modal([(f, 1.0, 0.15), (f * 2, 0.3, 0.08)], 0.4, seed=100 + k, strike=0.02)
        add_at(out, y * 0.7, k * every)
    return place(out, 0, "room", -14)


def mk_fanfare(d=2.8):
    """Triumphant trumpet fanfare: ta-ta-ta-TAAA (C major), brass section + timpani roll."""
    out = np.zeros(n_(d + 1.2))
    notes = [(392.0, 0.14), (392.0, 0.14), (392.0, 0.14), (523.25, 0.6), (466.16, 0.3), (523.25, 1.3)]
    t0 = 0.0
    for f, ln in notes:
        for k, mul in enumerate((1.0, 0.5, 0.75)):
            add_at(out, A.svf(brass(f * mul, ln, vib=1 if ln > 0.4 else 0, bright=1.2), 1600, q=1.2, mode="bp") * (1.4 if k == 0 else 0.6), t0)
        t0 += ln + 0.02
    tt_ = 0.0
    while tt_ < 1.0:
        add_at(out, drum("timp") * 0.35, tt_); tt_ += 0.07
    add_at(out, drum("timp") * 1.5, 0.48)
    return place(out, 0, "hall", -9)



# --------------------------------------------------------------------------------------------- doctor sounds
from events import T, shot as SH, at as AT, DUR as DUR_


def mk_rumble(d=1.0, seed=0, big=0.0):
    """Stomach rumble: a low wobbly growl (the gut 'talking') + gurgle bubbles. big = 0..1 (LOUD)."""
    r = rng(500 + seed)
    t = tt(d)
    wob = np.cumsum(r.standard_normal(len(t))) / np.sqrt(SR) * 0.9
    f = (62 + 30 * big) * (1 + 0.35 * np.sin(2 * np.pi * (2.2 + seed * 0.3) * t + 0.6 * wob) + 0.12 * wob)
    f = np.clip(f, 35, 180)
    src = A.saw(f) + 0.3 * r.standard_normal(len(t))
    growl = A.svf(src, 180 + 120 * big + 60 * np.sin(2 * np.pi * 1.3 * t), q=3, mode="bp") + 0.5 * lp(src, 140)
    am = 0.55 + 0.45 * np.sin(2 * np.pi * (3.5 + 2 * big) * t + 2 * wob) ** 2
    y = growl * am * env_ad(t, 0.08, 0.25, d)
    k = 0.05
    while k < d - 0.12:
        add_at(y, A.bubble(r.uniform(140, 420), r.uniform(0.012, 0.03), rise=r.uniform(0.6, 1.6)) * r.uniform(0.3, 0.8), k)
        k += r.uniform(0.06, 0.2)
    return place(lp(y, 1400 + 800 * big), 0, "small", -16)


def mk_boing(d=0.75, f0=150, depth=0.45, rate=13):
    """Cartoon spring 'boing' (the balloon belly bouncing back)."""
    t = tt(d)
    f = f0 * (1 + 0.6 * att(t, 0.06)) * (1 + depth * np.sin(2 * np.pi * rate * t) * np.exp(-t / 0.22))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.25 * np.sin(2 * np.pi * np.cumsum(2 * f) / SR)
    return place(lp(y * att(t, 0.004) * np.exp(-t / 0.25), 3000), 0, "small", -16)


def mk_rubber(d=0.3, seed=0):
    """Rubbery balloon squeak (a hand pressing the belly)."""
    t = tt(d)
    r = rng(520 + seed)
    f = 520 + 260 * np.sin(np.pi * t / d) + 40 * r.standard_normal(len(t)).cumsum() / np.sqrt(SR)
    y = A.svf(A.saw(f) + 0.2 * r.standard_normal(len(t)), 1300, q=4, mode="bp") * env_ad(t, 0.02, 0.08, d)
    return place(y, 0, "small", -14)


def mk_marker(d=0.2, seed=0):
    """Marker stroke on paper: a short squeaky scratch."""
    t = tt(d)
    r = rng(540 + seed)
    f = 2200 + 900 * np.sin(np.pi * t / d)
    y = A.svf(r.standard_normal(len(t)), f, q=5, mode="bp") * 1.4 + 0.25 * np.sin(2 * np.pi * np.cumsum(f * 0.5) / SR)
    return place(hp(y * env_ad(t, 0.015, 0.05, d), 900), 0, "small", -16)


def mk_scribble(d=1.4, seed=0):
    """Pen scribbling on paper (irregular little strokes)."""
    t = tt(d)
    r = rng(560 + seed)
    gate = np.zeros(len(t))
    k = 0.0
    while k < d - 0.05:
        a, b = n_(k), n_(min(d, k + r.uniform(0.05, 0.14)))
        gate[a:b] = cosramp(b - a)[::-1] * 0.4 + 0.6
        k += r.uniform(0.07, 0.2)
    gate = lp(gate, 40)
    f = 1800 + 700 * np.sin(2 * np.pi * 7 * t)
    y = A.svf(r.standard_normal(len(t)), f, q=2, mode="bp") * gate * env_ad(t, 0.02, 0.1, d)
    return place(hp(y, 700), 0, "small", -14)


def mk_chime():
    """Clinic door: a two-note 'ding-dong'."""
    out = np.zeros(n_(1.6))
    for k, f in enumerate((659.25, 523.25)):
        add_at(out, A.modal([(f, 1.0, 0.7), (f * 2.0, 0.25, 0.3), (f * 3.01, 0.08, 0.15)], 1.0, seed=600 + k, strike=0.04), k * 0.38)
    return place(hp(out, 250), 0, "room", -14)


def mk_slide_door(d=0.6):
    t = tt(d)
    y = bp(rng(610).standard_normal(len(t)), 300, 2500) * env_ad(t, 0.1, 0.25, d) * 0.6
    return place(y, 0, "room", -14)


def mk_bang(seed=0):
    """A fist banging on a wooden door: knock + low thump."""
    out = mk_knock(seed % 4)
    t = tt(0.2)
    th = np.sin(2 * np.pi * np.cumsum(90 + 60 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.05)
    th = place(th, 0, "room", -16)
    n = min(len(out), len(th))
    out = out.copy()
    out[:n] += 0.8 * th[:n]
    return out


def mk_door_creak(d=1.1):
    """A slow, long door creak (the toilet door opening)."""
    t = tt(d)
    f = 120 + 90 * np.sin(np.pi * t / d) + 30 * np.sin(2 * np.pi * 2.3 * t)
    pulses = (np.sin(2 * np.pi * np.cumsum(f / 2) / SR) > 0.94).astype(float)
    y = A.svf(lp(pulses, 5000) + 0.02 * rng(620).standard_normal(len(t)), 600 + 400 * t / d, q=6, mode="bp")
    return place(y * env_ad(t, 0.1, 0.2, d) * 3, 0, "room", -12)


def mk_patter(d=1.4, every=0.11, seed=0, heavy=0.0):
    """Tiny fast running footsteps (the waddle-run)."""
    out = np.zeros(n_(d + 0.3))
    r = rng(640 + seed)
    k = 0.0
    i = 0
    while k < d:
        tk = tt(0.08)
        y = lp(r.standard_normal(len(tk)), 900 + 600 * heavy) * np.exp(-tk / 0.012)
        y += (0.6 + heavy) * np.sin(2 * np.pi * (130 - 30 * heavy) * tk) * np.exp(-tk / 0.025)
        add_at(out, y * (1.0 if i % 2 else 0.8) * r.uniform(0.8, 1.0), k)
        k += every * r.uniform(0.9, 1.1)
        i += 1
    return place(out, 0, "room", -12)


def mk_stampede(d=0.9, people=12):
    """Everyone runs out at once: many fast footsteps."""
    out = np.zeros(n_(d + 0.4))
    for p in range(people):
        st = mk_patter(d * rng(p).uniform(0.6, 1.0), 0.09 * rng(p + 50).uniform(0.85, 1.2), seed=10 + p, heavy=0.4)
        st = st.mean(axis=1)
        add_at(out, st * rng(p + 90).uniform(0.4, 0.9), rng(p + 70).uniform(0, 0.08))
    return place(out, 0, "room", -10)


def mk_fwoomp(d=1.3):
    """The giant cartoon cloud bursting out: a big soft 'FWOOMP' (air + low boom), not gross."""
    t = tt(d)
    r = rng(660)
    env = att(t, 0.03) * np.exp(-t / 0.35)
    air = A.svf(r.standard_normal(len(t)), 300 + 1500 * np.exp(-t / 0.15), q=0.9, mode="bp") * env
    f = 45 + 70 * np.exp(-t / 0.05)
    low = np.sin(2 * np.pi * np.cumsum(f) / SR) * att(t, 0.005) * np.exp(-t / 0.4)
    return place(air * 1.2 + low, 0, "hall", -12)


def mk_spin(d=1.6, seed=0):
    """An office chair still spinning: a squeaky turn that slows down."""
    out = np.zeros(n_(d + 0.4))
    k, step = 0.0, 0.16
    i = 0
    while k < d:
        sq = mk_squeak().mean(axis=1)[:n_(0.18)] * cosramp(n_(0.18))[::-1]
        add_at(out, sq * (0.9 - 0.5 * k / d), k)
        k += step
        step *= 1.18
        i += 1
    return place(out, 0, "room", -14)


def mk_flutter(d=1.2):
    """A magazine fluttering down (paper flaps)."""
    t = tt(d)
    flap = (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t)) ** 4
    y = bp(rng(680).standard_normal(len(t)), 1200, 6000) * flap * env_ad(t, 0.05, 0.3, d)
    return place(y, 0.2, "room", -14)


def mk_tada():
    """A small 'ta-daa' (the medicine works!)."""
    out = np.zeros(n_(1.4))
    for f, t0, ln in ((523.25, 0.0, 0.12), (659.25, 0.14, 0.7)):
        for mul in (1.0, 0.75, 0.5):
            add_at(out, A.svf(brass(f * mul, ln, vib=1 if ln > 0.4 else 0, bright=1.0), 1500, q=1.2, mode="bp") * 0.6, t0)
    return place(out, 0, "room", -12)


def mk_room_tone(d, seed=0):
    """Very quiet waiting-room air: soft hum + far-away TV hiss."""
    t = tt(d)
    y = bp(rng(700 + seed).standard_normal(len(t)), 150, 1500) * 0.5 + 0.2 * np.sin(2 * np.pi * 120 * t)
    return place(y * env_ad(t, 0.2, 0.3, d), 0, "room", -14)





# --------------------------------------------------------------------------------------------- exam sounds
def mk_crinkle(d=1.0, seed=0):
    """Toilet paper crinkling: dense little crackles."""
    r = rng(1000 + seed)
    out = np.zeros(n_(d + 0.1))
    k = 0.0
    while k < d:
        ln = r.uniform(0.004, 0.02); t = tt(ln)
        add_at(out, bp(r.standard_normal(len(t)), 1500, 9000) * np.exp(-t / (ln * 0.4)) * r.uniform(0.3, 1.0), k)
        k += r.uniform(0.005, 0.03)
    return place(out * env_ad(tt(len(out) / SR), 0.03, 0.1, len(out) / SR), 0, "small", -16)


def mk_heel(seed=0):
    """A hard heel STOMP on the wooden floor: a sharp click + a low wooden thud."""
    out = A.modal([(900, 1.0, 0.05), (2300, 0.6, 0.03), (4100, 0.3, 0.015)], 0.2, seed=1010 + seed, strike=0.6, strike_hp=1500)
    t = tt(0.15); out = out[:n_(0.25)].copy() if len(out) > n_(0.25) else out
    th = np.sin(2 * np.pi * np.cumsum(110 + 60 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.05) * 0.7
    add_at(out, th, 0.0)
    return place(out, 0, "hall", -10)


def mk_snap():
    out = np.zeros(n_(0.5))
    t = tt(0.04); add_at(out, rng(1020).standard_normal(len(t)) * np.exp(-t / 0.005) * 1.4, 0)
    add_at(out, A.modal([(520, 1.0, 0.06), (1300, 0.6, 0.04), (2900, 0.3, 0.02)], 0.3, seed=1021, strike=0.5), 0.0)
    return place(out, 0, "small", -10)


def mk_tense(d, bpm=60):
    """Slow tense music: a low string drone + a soft pulsing heartbeat bass + a high thin note that rises."""
    t = tt(d)
    drone = sum(A.saw(np.full(len(t), f)) * a for f, a in ((55.0, 1.0), (82.4, 0.6), (110.0, 0.4)))
    drone = A.svf(drone, 380 + 120 * np.sin(2 * np.pi * 0.2 * t), q=1.0, mode="lp") * (0.8 + 0.2 * np.sin(2 * np.pi * 5.5 * t))
    high = np.sin(2 * np.pi * np.cumsum(880 * (1 + 0.06 * t / d)) / SR) * 0.05 * att(t, d * 0.5)
    out = drone * 0.4 + high
    beat = 60.0 / bpm; k = 0.0
    while k < d - 0.3:
        add_at(out, mk_heartbeat().mean(axis=1) * 0.8, k); k += beat
    return place(out * env_ad(t, 0.8, 0.8, d), 0, "hall", -12)


def mk_sad_piano(d):
    """Soft sad piano for the ending: slow Am - F - C - G arpeggios."""
    beat = 0.75
    chords = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (130.81, 164.81, 196.0), (196.0, 246.94, 293.66)]
    out = np.zeros(n_(d + 2.5))
    def note(f, ln, v):
        t = tt(ln); y = sum((k ** -1.3) * np.sin(2 * np.pi * k * f * t) * np.exp(-t / (1.6 / (1 + k * f / 1000))) for k in range(1, 7))
        return y * att(t, 0.004) * (1 - att(t - (ln - 0.3), 0.3)) * v
    b = 0
    while b * 4 * beat < d:
        r, th, fi = chords[b % 4]; t0 = b * 4 * beat
        add_at(out, note(r / 2, 3.0, 0.5), t0)
        for k, f in enumerate((r, th, fi, th * 2, fi, th, fi * 2, th)):
            add_at(out, note(f, 2.0, 0.28 if k % 2 else 0.36), t0 + k * beat / 2)
        b += 1
    out = out[:n_(d)] * env_ad(tt(d), 0.6, 1.2, d)
    return place(lp(out, 4500), 0, "hall", -12)


# --------------------------------------------------------------------------------------------- balls-double sounds
def mk_beep(f=2400, d=0.11):
    """Digital scale beep."""
    t = tt(d)
    y = np.sign(np.sin(2 * np.pi * f * t)) * 0.25 + np.sin(2 * np.pi * f * t) * 0.5
    return place(lp(y, 6000) * att(t, 0.003) * (1 - att(t - (d - 0.02), 0.02)), 0, "small", -20)


def mk_engine(d=3.0, rev=0.0, seed=0):
    """Tank diesel engine: low pulsing growl (firing rate) + track clatter; rev = 0..1 (revving, treads spinning)."""
    r = rng(700 + seed)
    t = tt(d)
    f = (22 + 18 * rev) * (1 + 0.04 * np.sin(2 * np.pi * 0.7 * t)) + rev * 10 * np.clip(t / 0.6, 0, 1)
    ph = 2 * np.pi * np.cumsum(f) / SR
    pulse = (0.5 + 0.5 * np.sin(ph)) ** 6
    growl = lp(r.standard_normal(len(t)), 260 + 220 * rev) * (0.35 + pulse) + A.saw(f * 2) * 0.25
    clat = np.zeros(len(t))
    k = 0.0
    while k < d:
        add_at(clat, A.modal([(r.uniform(900, 1600), 1, 0.02)], 0.05, seed=int(k * 100), strike=0.5) * r.uniform(0.15, 0.35), k)
        k += (0.11 if rev < 0.5 else 0.045) * r.uniform(0.7, 1.3)
    y = lp(growl, 700 + 500 * rev) + hp(clat, 600) * (0.6 + 0.6 * rev)
    return place(y * env_ad(t, 0.3, 0.4, d), 0, "hall", -14)


def mk_horn(d=0.5, f=415.0, seed=0):
    """Car horn: two detuned square-ish tones through a small speaker."""
    t = tt(d)
    y = sum(np.tanh(3 * np.sin(2 * np.pi * ff * t)) for ff in (f, f * 1.26))
    y = A.svf(y, 1500, q=0.8, mode="bp") + 0.3 * lp(y, 800)
    return place(y * att(t, 0.01) * (1 - att(t - (d - 0.03), 0.03)), 0, "room", -16)


def mk_honks(d=3.0, seed=0):
    """A traffic jam: many horns from near and far."""
    r = rng(800 + seed)
    out = np.zeros(n_(d + 0.8))
    k = 0.0
    while k < d:
        h = mk_horn(r.uniform(0.15, 0.7), r.uniform(330, 520), seed=int(k * 10)).mean(axis=1) * r.uniform(0.2, 0.9)
        add_at(out, lp(h, r.uniform(2000, 6000)), k)
        k += r.uniform(0.12, 0.4)
    return place(out[:n_(d)], 0, "hall", -10)


def mk_chain(d=1.4, seed=0):
    """Chains pulled tight: metal link rattles + a straining creak."""
    r = rng(900 + seed)
    out = np.zeros(n_(d + 0.3))
    k = 0.0
    while k < d:
        add_at(out, A.modal([(r.uniform(2200, 4200), 1, 0.05), (r.uniform(5000, 7000), 0.4, 0.03)], 0.12, seed=int(k * 97), strike=0.2) * r.uniform(0.2, 0.6), k)
        k += r.uniform(0.03, 0.09)
    t = tt(d)
    creak = A.svf(A.saw(90 + 25 * np.sin(2 * np.pi * 3 * t)) * (0.5 + 0.5 * np.sin(2 * np.pi * 11 * t)), 700, q=4, mode="bp") * 0.25
    out[:len(creak)] += creak
    return place(out, 0, "hall", -14)


def mk_ricochet():
    """A bullet bounces off: a sharp hit + a falling 'pyeww'."""
    t = tt(0.7)
    f = 3200 * np.exp(-t / 0.35) + 600
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.25) * 0.5
    y += hp(rng(5).standard_normal(len(t)), 3000) * np.exp(-t / 0.01) * 0.8
    return place(y, 0.3, "hall", -14)


def mk_quake(d=2.0, seed=0):
    """Deep earth rumble + rock crunching (mountains crushed)."""
    r = rng(950 + seed)
    t = tt(d)
    y = lp(r.standard_normal(len(t)), 90) * 3.0 * env_ad(t, 0.05, 0.8, d)
    k = 0.0
    while k < d * 0.8:
        add_at(y, lp(r.standard_normal(n_(0.15)), r.uniform(600, 1800)) * np.exp(-tt(0.15) / 0.04) * r.uniform(0.3, 0.9), k)
        k += r.uniform(0.05, 0.18)
    add_at(y, mk_boom().mean(axis=1) * 1.5, 0.0)
    return place(y, 0, "hall", -10)


def mk_deep_whoosh(d=1.2, up=True):
    """A deep whoosh (everything pulled in / the black hole): filtered noise sweeping + a sub drop."""
    r = rng(990)
    t = tt(d)
    fc = 120 * (1 + 12 * (t / d) ** 2) if up else 1800 * np.exp(-t / (d * 0.35)) + 80
    y = A.svf(r.standard_normal(len(t)), fc, q=1.4, mode="bp") * (att(t, d * 0.7) if up else np.exp(-t / (d * 0.4)))
    y += np.sin(2 * np.pi * np.cumsum(40 + 30 * (t / d)) / SR) * 0.6 * att(t, d * 0.5)
    return place(y, 0, "hall", -10)


def mk_alarm(d=1.2):
    """Breaking-news alarm: a fast rising synth swoosh + three two-tone stabs."""
    out = np.zeros(n_(d + 0.4))
    t = tt(0.35)
    add_at(out, A.svf(rng(4).standard_normal(len(t)), 300 + 6000 * (t / 0.35) ** 2, q=1.5, mode="bp") * att(t, 0.3) * 0.7, 0.0)
    for k in range(3):
        for f in (880.0, 1174.7):
            tt_ = tt(0.16)
            add_at(out, A.saw(np.full(len(tt_), f)) * env_ad(tt_, 0.005, 0.08, 0.16) * 0.22, 0.35 + k * 0.2 + (0.08 if f > 900 else 0))
    return place(lp(out, 5000), 0, "room", -12)


def build():
    cues = []

    def cue(name, x, t, gain_db, note, level=A.REF_LUFS, by="mmax", **kw):
        save(name, x, level=level, by=by)
        cues.append(dict(t=round(float(t), 3), file=f"audio/sfx/{name}.wav", gain_db=gain_db, note=note, **kw))

    # street air + birds (the start and the end)
    cue("air", mk_room_tone(SH(13)[0]), 0.0, -32.0, "soft street air", by="int", duck_db=2)
    cue("birds", mk_birds(3.6), 0.3, -32.0, "a few birds", duck_db=3)
    # 40 g: the two small balls land on the kitchen scale, beep beep
    cue("tap", mk_click(1800, 2), T["land"], -22.0, "they land on the scale", duck_db=2)
    cue("beep_1", mk_beep(), T["land"] + 0.03, -22.0, "scale beep", duck_db=2)
    cue("beep_2", mk_beep(2800, 0.14), T["ding40"], -20.0, "scale: 40 g", duck_db=2)
    # waddling steps, onto the big scale (41 kg)
    for k, ts in enumerate(T["waddle"]):
        cue(f"step_{k}", mk_thud(), ts, -26.0, "heavy waddling steps", duck_db=2)
    cue("onscale", mk_thud(), T["onscale"], -16.0, "steps onto the big scale", duck_db=2)
    cue("beep_41", mk_beep(2100, 0.2), T["ding41"], -20.0, "41 kg", duck_db=2)
    cue("strain", mk_wood_creak(0.9), T["strain"], -24.0, "straining", duck_db=3)
    # you can't: the floor cracks
    cue("crack", mk_crack(), T["crack"], -10.0, "the floor cracks", duck_db=1)
    cue("thud", mk_boom(), T["crack"], -14.0, "heavy thud", duck_db=1)
    # the army
    cue("engines", mk_engine(SH(15)[0] - T["tanks"] + 0.2, 0.0, 1), T["tanks"], -20.0, "tank engines rolling in", duck_db=4)
    cue("rev", mk_engine(SH(15)[1] - SH(15)[0] + 0.3, 1.0, 2), T["pull"], -17.0, "engines revving, treads spinning", duck_db=4)
    cue("chains", mk_chain(SH(15)[1] - SH(15)[0]), T["pull"] + 0.05, -20.0, "chains pulled tight", duck_db=4)
    cue("ping", mk_ricochet(), T["ping"], -18.0, "a bullet bounces off", duck_db=3)
    # huge: wind up high, the news, the jam
    cue("wind", mk_wind(SH(19)[0] - T["big"], 51), T["big"], -26.0, "wind up high", duck_db=3)
    cue("alarm", mk_alarm(), T["news"], -18.0, "breaking-news alarm", duck_db=4)
    cue("newsbed", mk_news(SH(19)[1] - SH(19)[0]), T["news"] + 0.3, -26.0, "news music", by="int", duck_db=4)
    cue("horns", mk_honks(SH(21)[1] - T["jam"], 1), T["jam"], -22.0, "car horns in the jam", duck_db=4)
    for k in range(int((SH(21)[1] - SH(21)[0]) / 0.45) + 1):
        cue(f"mom_{k}", mk_horn(0.22, 470, k), T["mom"] + k * 0.45, -20.0, "MOM honks", duck_db=3)
    cue("quake", mk_quake(SH(24)[0] - T["crush"]), T["crush"], -14.0, "mountains crushed", duck_db=4)
    cue("creak", mk_wood_creak(0.7), AT(24, 0.1), -22.0, "the balance creaks", duck_db=3)
    cue("slam", mk_bang(1), T["slam"], -12.0, "the spheres' side slams down", duck_db=2)
    # space
    cue("space", mk_drone(SH(28)[1] - T["space"], 45), T["space"], -26.0, "space hum", by="int", duck_db=3)
    cue("pull_in", mk_deep_whoosh(SH(28)[1] - T["pull_in"], True), T["pull_in"], -14.0, "everything pulled in", duck_db=3)
    cue("boom", mk_boom(), T["hole"], -10.0, "the black hole", duck_db=1)
    cue("hole", mk_deep_whoosh(SH(29)[1] - T["hole"] + 0.4, False), T["hole"], -12.0, "deep whoosh at the black hole", duck_db=2)
    # quiet empty street, then him
    cue("quiet", mk_wind(DUR_ - T["quiet"], 77), T["quiet"], -30.0, "a quiet empty street", duck_db=2)
    cue("birds_2", mk_birds(DUR_ - T["quiet"]), T["quiet"] + 0.2, -32.0, "a bird far away", duck_db=2)

    cues.sort(key=lambda c: c["t"])
    json.dump(cues, open(P("audio", "sfx_cues.json"), "w"), indent=1)
    for c in cues:
        info = A.INFO[os.path.splitext(os.path.basename(c["file"]))[0]]
        print(f"{c['t']:6.2f}  {os.path.basename(c['file']):14s} {c['gain_db']:+5.1f} dB  {info['dur']:5.2f}s  {c['note']}")
    print(f"{len(cues)} cues -> audio/sfx_cues.json")


if __name__ == "__main__":
    build()
