#!/usr/bin/env python3
"""Synthesize all music, sound effects and ambience with code (numpy only).

Reads audio/cues.json (exported from the 3D timeline, so every sound lands on
its animation frame) and writes stereo 48 kHz stems to build/:
  music.wav   playful, sneaky background score (stops dead right before the twist)
  dance.wav   the happy dance track that the scarecrow's speaker plays
  sfx.wav     every sound effect
  amb.wav     birds, breeze and night crickets
"""
import json
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
SR = 48000
rng = np.random.default_rng(7)


# ------------------------------------------------------------------ basics
def t_axis(d): return np.arange(int(d * SR)) / SR
def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def env_exp(n, tau): return np.exp(-np.arange(n) / (tau * SR))


def adsr(n, a=0.005, d=0.05, s=0.6, r=0.05):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = min(na, n); e[:na] = np.linspace(0, 1, na, endpoint=False)
    nd = min(nd, n - na); e[na:na + nd] = np.linspace(1, s, nd, endpoint=False)
    if nr > 0 and n > nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e


def filt(x, kind, f, order=2):
    if kind == "band":
        sos = butter(order, [max(20, f[0]) / (SR / 2), min(f[1], SR / 2 - 100) / (SR / 2)], btype="band", output="sos")
    else:
        sos = butter(order, min(f, SR / 2 - 100) / (SR / 2), btype=kind, output="sos")
    return sosfilt(sos, x)


def noise(d): return rng.standard_normal(int(d * SR))


def sweep(f0, f1, d, curve=1.0):
    t = t_axis(d); u = (t / d) ** curve
    f = f0 * (f1 / f0) ** u if f0 > 0 and f1 > 0 else f0 + (f1 - f0) * u
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def saw_from_freq(f):
    ph = np.cumsum(f) / SR
    return 2 * (ph - np.floor(ph + 0.5))


def norm(x, peak=0.9):
    m = np.max(np.abs(x)); return x * (peak / m) if m > 0 else x


def reverb_ir(d=1.4, decay=0.35, bright=6000, seed=3):
    r = np.random.default_rng(seed); n = int(d * SR)
    ir = r.standard_normal((2, n)) * np.exp(-np.arange(n) / (decay * SR))
    ir = np.stack([filt(ir[0], "low", bright), filt(ir[1], "low", bright)])
    ir[:, :int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
    return ir / np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))


def add_reverb(st, wet=0.18, **kw):
    ir = reverb_ir(**kw)
    out = st.copy()
    for c in range(2):
        out[c] += wet * fftconvolve(st[c], ir[c])[: st.shape[1]]
    return out


def place(buf, x, t, gain=1.0, pan=0.0):
    """Add mono or stereo x into stereo buf at time t."""
    i = int(round(t * SR))
    if i >= buf.shape[1]: return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414])
    if i < 0: x = x[:, -i:]; i = 0
    n = min(x.shape[1], buf.shape[1] - i)
    buf[:, i:i + n] += x[:, :n] * gain


def write(path, st):
    st = np.clip(st, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st.T * 32767).astype("<i2").tobytes())


# ------------------------------------------------------------------ instruments
def pluck(f, d, bright=0.5, damp=0.996):
    """Karplus-Strong plucked string (pizzicato)."""
    n = int(d * SR); p = max(2, int(SR / f))
    buf = filt(rng.standard_normal(p), "low", 1500 + bright * 6000)
    out = np.zeros(n); b = buf.copy(); idx = 0
    for i in range(n):
        out[i] = b[idx]; nxt = (idx + 1) % p
        b[idx] = damp * 0.5 * (b[idx] + b[nxt]); idx = nxt
    return out * adsr(n, 0.002, 0.05, 1.0, 0.04)


def marimba(f, d, vel=1.0):
    t = t_axis(d)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t * 5) + 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 16)
         + 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t * 35))
    x[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return x * vel


def reed(f, d, vel=1.0, vib=5.0):
    """Clarinet-ish: odd harmonics, soft attack, a little vibrato."""
    t = t_axis(d); fm = f * (1 + 0.004 * np.sin(2 * np.pi * vib * t) * np.clip(t / 0.15, 0, 1))
    ph = 2 * np.pi * np.cumsum(fm) / SR
    x = sum(np.sin(k * ph) / k ** 1.2 for k in (1, 3, 5, 7, 9))
    x = filt(x, "low", 3200)
    return x * adsr(len(t), 0.025, 0.06, 0.75, 0.05) * vel


def celesta(f, d, vel=1.0):
    t = t_axis(d)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 3) + 0.4 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 9)
    return x * vel


def square(f, d, duty=0.5):
    t = t_axis(d); ph = (f * t) % 1.0
    return np.where(ph < duty, 1.0, -1.0)


def saw(f, d): return saw_from_freq(np.full(int(d * SR), f))


def kick(d=0.35, vel=1.0):
    t = t_axis(d); f = 45 + 110 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * vel + filt(noise(d), "high", 3000) * np.exp(-t * 200) * 0.2 * vel


def snare(d=0.2, vel=1.0):
    t = t_axis(d)
    return (filt(noise(d), "band", (1500, 8000)) * np.exp(-t * 22) * 0.6 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.4) * vel


def clap(vel=1.0):
    d = 0.25; t = t_axis(d); n = filt(noise(d), "band", (900, 5000))
    e = np.exp(-t * 18)
    for k, o in enumerate([0.0, 0.011, 0.022]):
        e += np.where(t > o, np.exp(-(t - o) * 150), 0) * 0.8
    return n * e * 0.5 * vel


def hat(d=0.06, vel=1.0):
    t = t_axis(d); return filt(noise(d), "high", 7000) * np.exp(-t * 70) * vel


def brush(d=0.12, vel=1.0):
    t = t_axis(d); return filt(noise(d), "band", (2000, 9000)) * np.sin(np.pi * np.clip(t / d, 0, 1)) * vel


def snap_finger(vel=1.0):
    d = 0.08; t = t_axis(d)
    return (filt(noise(d), "band", (1800, 6000)) * np.exp(-t * 90) + np.sin(2 * np.pi * 2300 * t) * np.exp(-t * 120) * 0.3) * vel


# ------------------------------------------------------------------ music: sneaky score
def background_music(dur, stop_at, night_span, quiet_spans):
    bpm = 104; beat = 60 / bpm
    st = np.zeros((2, int(dur * SR)))
    # D minor sneak: i - VI - iv - V  (Dm, Bb, Gm, A)
    bass_bars = [[38, 45, 41, 45], [34, 41, 38, 41], [31, 38, 34, 38], [33, 40, 37, 40]]
    mel_a = [(0, 0.5, 62), (0.75, 0.25, 65), (1, 0.5, 64), (1.5, 0.5, 62), (2.5, 0.25, 61), (2.75, 0.25, 62), (3, 0.75, 69),
             (4, 0.5, 70), (4.75, 0.25, 69), (5, 0.5, 67), (5.5, 0.5, 65), (6.5, 0.5, 64), (7, 0.5, 62),
             (8, 0.5, 67), (8.75, 0.25, 70), (9, 0.5, 69), (9.5, 0.5, 67), (10.5, 0.25, 66), (10.75, 0.25, 67), (11, 0.75, 74),
             (12, 0.5, 73), (12.75, 0.25, 71), (13, 0.5, 69), (13.5, 0.25, 67), (13.75, 0.25, 64), (14, 0.5, 61), (15, 0.5, 57)]
    mel_b = [(0, 0.25, 74), (0.5, 0.25, 72), (1, 0.25, 69), (1.5, 0.25, 65), (2, 0.5, 62), (3, 0.25, 65), (3.5, 0.25, 69),
             (4, 0.25, 70), (4.5, 0.25, 69), (5, 0.25, 65), (5.5, 0.25, 62), (6, 0.5, 58), (7, 0.5, 62),
             (8, 0.25, 67), (8.5, 0.25, 70), (9, 0.25, 74), (9.5, 0.25, 70), (10, 0.5, 67), (11, 0.5, 70),
             (12, 0.25, 69), (12.5, 0.25, 73), (13, 0.25, 76), (13.5, 0.25, 73), (14, 0.5, 69), (15, 0.25, 64), (15.5, 0.25, 61)]
    n_beats = int(stop_at / beat) + 2
    is_night = lambda tt: night_span[0] <= tt < night_span[1]
    for b in range(n_beats):
        tt = b * beat
        if tt >= stop_at: break
        bar = (b // 4) % 4; pos = b % 4
        # pizzicato bass, with a chromatic tiptoe pickup on the last beat of every 2 bars
        m = bass_bars[bar][pos] - (12 if is_night(tt) else 0) * 0
        x = pluck(midi(m), beat * 0.9, bright=0.35)
        place(st, x, tt, 0.55, -0.15)
        if pos == 3 and bar % 2 == 1:
            place(st, pluck(midi(m + 1), beat * 0.45, 0.35), tt + beat * 0.5, 0.4, -0.15)
        # light percussion: brush on 2 and 4, finger snaps off-beat, soft hat
        if not is_night(tt):
            if pos in (1, 3): place(st, brush(0.14), tt, 0.16, 0.3)
            place(st, hat(0.04), tt + beat * 0.5, 0.07, 0.4)
            if pos in (1, 3): place(st, snap_finger(), tt + beat * 0.02, 0.12, -0.35)
        else:
            if pos == 2: place(st, hat(0.05), tt, 0.05, 0.4)
    # melody phrases: 16 beats each, alternate A/B, instrument by scene
    phrase = 16 * beat
    for k in range(int(stop_at / phrase) + 1):
        t0 = k * phrase; mel = mel_a if k % 2 == 0 else mel_b
        for (bb, dd, m) in mel:
            tt = t0 + bb * beat
            if tt >= stop_at - 0.05: continue
            if any(a <= tt < b for a, b in quiet_spans): continue
            if is_night(tt):
                place(st, celesta(midi(m + 12), dd * beat + 0.6), tt, 0.16, 0.25)
            elif k % 4 in (0, 3):
                place(st, reed(midi(m), dd * beat * 0.95), tt, 0.22, 0.2)
            else:
                place(st, marimba(midi(m + 12), dd * beat + 0.5), tt, 0.2, 0.25)
                place(st, marimba(midi(m), dd * beat + 0.3), tt, 0.08, -0.2)
    st = add_reverb(st, wet=0.22, d=1.6, decay=0.4)
    # sudden stop right before the twist (keep only a tiny 15 ms click-free cut)
    i = int(stop_at * SR); f = int(0.015 * SR)
    st[:, i:i + f] *= np.linspace(1, 0, f); st[:, i + f:] = 0
    return st


# ------------------------------------------------------------------ music: dance track from the speaker
def dance_music(dur, bpm):
    beat = 60 / bpm; st = np.zeros((2, int(dur * SR)))
    chords = [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]]  # C Am F G
    bass = [36, 33, 41, 43]
    lead = [72, 76, 79, 76, 74, 72, 74, 76, 77, 76, 74, 72, 74, 71, 67, 71]
    nb = int(dur / beat) + 1
    for b in range(nb):
        tt = b * beat; bar = (b // 4) % 4
        place(st, kick(0.3), tt, 0.9)
        if b % 2 == 1: place(st, clap(), tt, 0.5, 0.1)
        place(st, hat(0.05), tt + beat / 2, 0.25, 0.35); place(st, hat(0.03), tt + beat * 0.75, 0.12, -0.3)
        # bouncy octave bass
        for k, o in enumerate([0, 0.5]):
            x = saw(midi(bass[bar] + 12 * k), beat * 0.45); x = filt(x, "low", 900) * adsr(len(x), 0.003, 0.08, 0.5, 0.03)
            place(st, x, tt + o * beat, 0.35)
        # off-beat chord stabs
        x = sum(filt(square(midi(m), beat * 0.3, 0.4), "low", 4000) for m in chords[bar]) / 3
        place(st, x * adsr(len(x), 0.003, 0.06, 0.4, 0.04), tt + beat / 2, 0.22, 0.2)
        # lead: cheerful square melody, 8th notes
        for h in range(2):
            m = lead[(b * 2 + h) % 16]
            x = filt(square(midi(m), beat * 0.42, 0.25), "low", 6000); x *= adsr(len(x), 0.004, 0.05, 0.6, 0.04)
            place(st, x, tt + h * beat / 2, 0.16, -0.2)
    st = add_reverb(st, wet=0.12, d=0.8, decay=0.2)
    # a small speaker on a hat: band-limited and slightly overdriven, then it opens up a bit
    small = np.stack([filt(st[c], "band", (380, 6500), 2) for c in range(2)])
    small = np.tanh(small * 1.8) / 1.5
    mix = np.linspace(0.85, 0.45, st.shape[1])
    return small * mix + st * (1 - mix)


# ------------------------------------------------------------------ sound effects
def crunch(d, density=600, band=(400, 4000), seed=0):
    r = np.random.default_rng(seed); n = int(d * SR); x = np.zeros(n)
    k = int(density * d)
    for _ in range(k):
        i = r.integers(0, n - 200); L = r.integers(20, 160)
        x[i:i + L] += r.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)) * r.uniform(0.3, 1)
    return filt(x, "band", band)


def thump(f0=110, f1=45, d=0.25, vel=1.0):
    t = t_axis(d); f = f1 + (f0 - f1) * np.exp(-t * 25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14) * vel


def whoosh(d=0.4, f0=400, f1=2500, vel=1.0):
    n = noise(d); t = t_axis(d); out = np.zeros_like(n); seg = 512
    for i in range(0, len(n), seg):
        u = i / len(n); fc = f0 * (f1 / f0) ** u
        out[i:i + seg] = filt(n[max(0, i - 2048):i + seg], "band", (fc * 0.6, fc * 1.6))[-len(n[i:i + seg]):]
    return out * np.sin(np.pi * t / d) ** 2 * vel


def caw(f0=560, d=0.32, rise=0.0, rasp=0.6, seed=1):
    r = np.random.default_rng(seed); t = t_axis(d); u = t / d
    f = f0 * (1 + 0.25 * np.sin(np.pi * u) * (1 if rise == 0 else 0) + rise * u - 0.18 * u) * (1 + 0.02 * r.standard_normal(len(t)).cumsum() / np.sqrt(len(t)))
    x = saw_from_freq(f)
    am = 1 + rasp * filt(r.standard_normal(len(t)), "low", 90) * 3
    x = x * am
    fm = filt(x, "band", (900, 1700)) * 1.2 + filt(x, "band", (2100, 3200)) * 0.7 + filt(x, "band", (300, 700)) * 0.4
    e = np.clip(t / 0.02, 0, 1) * np.clip((d - t) / 0.08, 0, 1)
    return norm(fm * e, 0.8)


def caw_seq(fs, gap=0.22, d=0.24, rise=0.0, seed=1):
    parts = []
    for k, f in enumerate(fs):
        parts.append((k * gap, caw(f, d, rise, seed=seed + k)))
    tot = parts[-1][0] + d + 0.05; out = np.zeros(int(tot * SR))
    for o, x in parts: i = int(o * SR); out[i:i + len(x)] += x
    return out


def flap(d=0.6, rate=8, vel=1.0, seed=0):
    r = np.random.default_rng(seed); n = int(d * SR); out = np.zeros(n)
    k = int(d * rate)
    for j in range(k):
        i = int(j / rate * SR + r.uniform(0, 0.01) * SR); L = int(0.07 * SR)
        if i + L > n: break
        b = filt(r.standard_normal(L), "band", (250, 2200)) * np.sin(np.pi * np.arange(L) / L) ** 2
        out[i:i + L] += b * r.uniform(0.6, 1.0)
    return out * vel


def hawk(d=1.25):
    """Red-tailed-hawk style 'kee-eeeer' screech: high, harsh, descending."""
    t = t_axis(d); u = t / d
    f = 3300 * (1 + 0.06 * np.sin(np.pi * np.clip(u * 3, 0, 1))) * (1 - 0.32 * u ** 1.5) * (1 + 0.012 * np.sin(2 * np.pi * 34 * t))
    x = saw_from_freq(f) + 0.5 * saw_from_freq(f * 1.5)
    rasp = 1 + 0.8 * filt(rng.standard_normal(len(t)), "low", 160) * 4
    x = filt(x * rasp, "band", (1500, 9000)) + filt(noise(d), "band", (2500, 6000)) * 0.25
    e = np.clip(t / 0.05, 0, 1) * np.clip((d - t) / 0.35, 0, 1)
    x = norm(x * e, 0.9)
    return np.tanh(x * 1.6) / 1.1


def beep(f=1320, d=0.09):
    t = t_axis(d); x = 0.7 * np.sign(np.sin(2 * np.pi * f * t)) + 0.3 * np.sin(2 * np.pi * f * 2 * t)
    return filt(x, "low", 6000) * adsr(len(t), 0.003, 0.02, 0.8, 0.02)


def boing(d=0.45, f0=180, f1=420):
    t = t_axis(d); f = f0 + (f1 - f0) * (1 - np.exp(-t * 12)) + 40 * np.sin(2 * np.pi * 14 * t) * np.exp(-t * 4)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6)


def metal(f=820, d=0.6, vel=1.0):
    t = t_axis(d); ratios = [1, 2.76, 5.4, 8.93]
    x = sum(np.sin(2 * np.pi * f * r_ * t) * np.exp(-t * (6 + 5 * k)) / (k + 1) for k, r_ in enumerate(ratios))
    return (x + filt(noise(d), "high", 3000) * np.exp(-t * 80) * 0.6) * vel


def motor(d=1.2, f0=40, f1=150, vel=1.0):
    t = t_axis(d); f = f0 + (f1 - f0) * np.clip(t / (d * 0.5), 0, 1) ** 0.6
    x = saw_from_freq(f) * 0.5 + saw_from_freq(f * 2.01) * 0.3 + filt(noise(d), "band", (600, 2500)) * 0.2
    x = filt(x, "low", 2500) * (1 + 0.3 * np.sin(2 * np.pi * f * 0.5 * t))
    return x * np.clip(t / 0.05, 0, 1) * np.clip((d - t) / 0.25, 0, 1) * vel


def chirp(seed=0):
    r = np.random.default_rng(seed); out = []
    for k in range(r.integers(1, 3)):
        d = r.uniform(0.05, 0.09); f0 = r.uniform(3200, 4200)
        x = sweep(f0, f0 * r.uniform(1.15, 1.4), d, 0.7) * np.sin(np.pi * t_axis(d) / d)
        out.append(np.concatenate([x, np.zeros(int(0.035 * SR))]))
    return np.concatenate(out)


def rustle(d=0.8, vel=1.0, seed=0):
    x = crunch(d, 1400, (900, 7000), seed) * np.exp(-t_axis(d) * 3.5)
    return x * vel


def page_flip():
    d = 0.22; t = t_axis(d)
    x = filt(noise(d), "band", (1200, 7000)) * (np.exp(-((t - 0.05) / 0.025) ** 2) + 0.5 * np.exp(-((t - 0.13) / 0.04) ** 2))
    return x + crunch(d, 200, (2000, 8000), 4) * 0.3


def click(d=0.03, f=3000):
    t = t_axis(d); return (np.sin(2 * np.pi * f * t) * 0.5 + filt(noise(d), "high", 2000)) * np.exp(-t * 300)


def tiptoe(seed=0):
    r = np.random.default_rng(seed); f = midi(r.choice([79, 81, 84, 86]))
    return pluck(f, 0.25, 0.7, 0.99) * 0.7


class Snd(np.ndarray):
    """1-D sound whose + pads the shorter operand, so layered effects can differ in length."""
    __array_priority__ = 10

    def __add__(self, o):
        o = np.asarray(o)
        if o.ndim == 1 and o.shape != self.shape:
            n = max(len(self), len(o)); a = np.zeros(n); a[:len(self)] += np.asarray(self); a[:len(o)] += o
            return a.view(Snd)
        return np.add(self, o)
    __radd__ = __add__


def _wrap(fn):
    def w(*a, **k): return np.asarray(fn(*a, **k), dtype=float).view(Snd)
    return w


for _name in ("thump", "crunch", "whoosh", "caw", "caw_seq", "flap", "hawk", "beep", "boing", "metal", "motor", "chirp", "rustle",
              "page_flip", "click", "tiptoe", "sweep", "celesta", "saw", "square", "pluck"):
    globals()[_name] = _wrap(globals()[_name])

SFX = {
    "dig": lambda s: thump(140, 55, 0.3) * 0.9 + crunch(0.35, 900, (300, 3500), s) * 0.9,
    "dig_small": lambda s: thump(160, 60, 0.2) * 0.5 + crunch(0.25, 600, (400, 4000), s) * 0.6,
    "dirt_toss": lambda s: whoosh(0.3, 500, 1800, 0.6) + crunch(0.3, 300, (500, 4000), s) * 0.4,
    "dirt_land": lambda s: crunch(0.45, 700, (300, 3000), s) * np.exp(-t_axis(0.45) * 5),
    "dirt_pour": lambda s: crunch(0.6, 1100, (250, 3200), s) * np.sin(np.pi * t_axis(0.6) / 0.6) + thump(90, 45, 0.3) * 0.4,
    "pat": lambda s: thump(120, 50, 0.18) + crunch(0.15, 400, (300, 2500), s) * 0.4,
    "step": lambda s: crunch(0.12, 500, (400, 3000), s) * np.exp(-t_axis(0.12) * 25) * 0.6,
    "pop": lambda s: sweep(320, 980, 0.13, 0.7) * np.exp(-t_axis(0.13) * 14) + click(0.02, 2000) * 0.3,
    "pop_soft": lambda s: sweep(420, 900, 0.1, 0.7) * np.exp(-t_axis(0.1) * 20) * 0.6,
    "thud": lambda s: thump(100, 38, 0.45, 1.2) + crunch(0.3, 500, (200, 2500), s) * 0.5,
    "flap": lambda s: flap(0.55, 9, 0.8, s),
    "flap_big": lambda s: flap(1.0, 12, 1.0, s) + flap(1.0, 10, 0.7, s + 9),
    "land": lambda s: crunch(0.12, 300, (500, 4000), s) * 0.4 + thump(200, 90, 0.08) * 0.3,
    "caw": lambda s: caw(560, 0.3, seed=s),
    "caw_panic": lambda s: caw_seq([760, 820, 700], 0.16, 0.15, seed=s),
    "caw_smug": lambda s: caw_seq([430, 400], 0.28, 0.26, seed=s) * 0.9,
    "caw_confused": lambda s: caw(520, 0.34, rise=0.55, seed=s),
    "yawn_caw": lambda s: caw(420, 0.7, rise=-0.3, rasp=0.3, seed=s),
    "sting": lambda s: norm(sum(filt(saw(midi(m), 0.6), "low", 2600) for m in (50, 57, 62, 66)) * np.exp(-t_axis(0.6) * 5)) * 0.7 + filt(noise(0.6), "high", 5000) * np.exp(-t_axis(0.6) * 6) * 0.25,
    "page_flip": lambda s: page_flip(),
    "peck": lambda s: (np.sin(2 * np.pi * 1250 * t_axis(0.08)) * np.exp(-t_axis(0.08) * 60) + click(0.02, 3500) * 0.5) * 1.0,
    "munch": lambda s: crunch(0.12, 1500, (1200, 7000), s) * np.exp(-t_axis(0.12) * 25),
    "clank": lambda s: metal(760, 0.7, 1.0) + thump(160, 70, 0.15) * 0.5,
    "clank_small": lambda s: metal(1150, 0.45, 0.7),
    "zip": lambda s: sweep(500, 2400, 0.35, 1.0) * 0.4 * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 70 * t_axis(0.35)))) * np.sin(np.pi * t_axis(0.35) / 0.35),
    "motor_start": lambda s: motor(1.4, 30, 160, 1.0),
    "motor_burst": lambda s: motor(0.85, 90, 160, 0.75),
    "whoosh": lambda s: whoosh(0.5, 300, 2600, 0.9),
    "whoosh_small": lambda s: whoosh(0.3, 600, 3000, 0.6),
    "facepalm": lambda s: filt(noise(0.08), "band", (500, 5000)) * np.exp(-t_axis(0.08) * 50) + thump(180, 90, 0.08) * 0.4,
    "beep": lambda s: beep(1320, 0.09),
    "beep_hi": lambda s: beep(1760, 0.14),
    "boing": lambda s: boing(),
    "bonk": lambda s: (np.sin(2 * np.pi * 620 * t_axis(0.18)) + 0.5 * np.sin(2 * np.pi * 1480 * t_axis(0.18))) * np.exp(-t_axis(0.18) * 25),
    "night_whoosh": lambda s: filt(noise(1.2), "low", 900) * np.sin(np.pi * t_axis(1.2) / 1.2) ** 2 * 0.5 + celesta(midi(88), 1.2) * 0.25,
    "tiptoe": lambda s: tiptoe(s),
    "snap": lambda s: click(0.025, 2600) + sweep(500, 1100, 0.07) * np.exp(-t_axis(0.07) * 40) * 0.5,
    "glow_on": lambda s: sum(celesta(midi(m), 0.7) for m in (84, 88, 91)) / 2,
    "scan_hum": lambda s: (np.sin(2 * np.pi * 220 * t_axis(0.8)) * 0.4 + sweep(700, 1600, 0.8) * 0.2) * np.sin(np.pi * t_axis(0.8) / 0.8),
    "sensor_click": lambda s: click(0.03, 4000) * 1.2 + np.concatenate([np.zeros(int(0.03 * SR)), beep(2000, 0.07)]),
    "alarm_buzz": lambda s: filt(square(220, 0.7, 0.5) * (np.sign(np.sin(2 * np.pi * 7 * t_axis(0.7))) > 0), "low", 3000) * 0.5,
    "speaker_on": lambda s: crunch(0.2, 800, (1000, 8000), s) * 0.3 + thump(90, 50, 0.15) * 0.5,
    "hawk": lambda s: hawk(),
    "bush": lambda s: rustle(0.9, 1.0, s) + thump(90, 50, 0.2) * 0.4,
    "bush_small": lambda s: rustle(0.4, 0.6, s),
    "chirp": lambda s: chirp(s),
    "button_click": lambda s: click(0.03, 1800) + click(0.03, 2400) * 0.5,
}
GAIN_RAW = {"hawk": 1.0, "dig": 0.5, "dirt_pour": 0.4, "dirt_land": 0.3, "dirt_toss": 0.35, "flap": 0.35, "flap_big": 0.42, "caw": 0.3, "caw_panic": 0.33,
        "caw_smug": 0.3, "caw_confused": 0.3, "yawn_caw": 0.25, "sting": 0.32, "page_flip": 0.45, "peck": 0.5, "munch": 0.3, "clank": 0.38, "clank_small": 0.32,
        "zip": 0.3, "motor_start": 0.32, "motor_burst": 0.22, "whoosh": 0.28, "whoosh_small": 0.25, "beep": 0.2, "beep_hi": 0.2, "boing": 0.22, "bonk": 0.3,
        "tiptoe": 0.25, "snap": 0.4, "glow_on": 0.22, "scan_hum": 0.12, "sensor_click": 0.4, "alarm_buzz": 0.18, "bush": 0.45, "bush_small": 0.3, "chirp": 0.22,
        "button_click": 0.45, "pop": 0.32, "pop_soft": 0.25, "thud": 0.5, "pat": 0.4, "land": 0.25, "facepalm": 0.3, "dig_small": 0.35, "speaker_on": 0.2,
        "night_whoosh": 0.2, "step": 0.3}


GAIN = {k: (v if k == "hawk" else v * 0.8) for k, v in GAIN_RAW.items()}


def sound_effects(cues, dur):
    st = np.zeros((2, int(dur * SR)))
    for k, c in enumerate(cues):
        fn = SFX.get(c["name"])
        if fn is None or c.get("gain", 1) <= 0: continue
        x = norm(np.asarray(fn(k + 11), dtype=float), 0.9)
        place(st, x, c["t"], GAIN.get(c["name"], 0.3) * c.get("gain", 1), c.get("pan", 0) * 0.7)
    return add_reverb(st, wet=0.1, d=0.9, decay=0.22)


# ------------------------------------------------------------------ ambience
def ambience(dur, night_span):
    n = int(dur * SR); st = np.zeros((2, n)); t = np.arange(n) / SR
    breeze = np.stack([filt(rng.standard_normal(n), "low", 500), filt(rng.standard_normal(n), "low", 500)]) * 0.05
    breeze *= (0.7 + 0.3 * np.sin(2 * np.pi * 0.08 * t))
    st += breeze
    a, b = night_span
    night = np.clip((t - a) / 0.8, 0, 1) * np.clip((b - t) / 0.8, 0, 1)
    # birds (day) - sparse chirps panned around
    r = np.random.default_rng(42); tt = 0.3
    while tt < dur:
        if not (a - 0.5 < tt < b + 0.3):
            x = chirp(int(r.integers(0, 9999))) * r.uniform(0.25, 0.6)
            place(st, x, tt, 0.05, r.uniform(-0.8, 0.8))
        tt += r.uniform(0.35, 1.3)
    # crickets (night)
    cr = np.zeros(n)
    for f, rate, ph in ((4700, 28, 0.0), (5200, 31, 1.3), (4400, 25, 2.1)):
        chirps = (np.sin(2 * np.pi * rate * t + ph) > 0.2) * (np.sin(2 * np.pi * 1.6 * t + ph * 3) > -0.1)
        cr += np.sin(2 * np.pi * f * t) * chirps * 0.3
    cr = filt(cr, "band", (3500, 7000)) * night
    st += np.stack([cr * 0.07, np.roll(cr, 900) * 0.07])
    return st


def main():
    cues = json.loads((ROOT / "audio" / "cues.json").read_text())
    dur = cues["duration"] + 0.5
    BUILD.mkdir(exist_ok=True)
    night = (21.4, 28.3)
    print("music ..."); m = background_music(dur, cues.get("musicStop", 45.35), night, quiet_spans=[(32.5, 34.0)])
    write(BUILD / "music.wav", norm(m, 0.8))
    print("dance ..."); d = np.zeros((2, int(dur * SR))); place(d, dance_music(dur - cues["danceStart"], cues["bpm"]), cues["danceStart"])
    write(BUILD / "dance.wav", norm(d, 0.8))
    print("sfx ..."); s = sound_effects(cues["cues"], dur); write(BUILD / "sfx.wav", s / max(1.0, np.max(np.abs(s)) / 0.95))
    print("ambience ..."); a = ambience(dur, night); write(BUILD / "amb.wav", a)
    print("done")


if __name__ == "__main__":
    main()
