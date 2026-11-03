#!/usr/bin/env python3
"""Small sound effects synthesised with numpy (no samples). -> build/sfx/*.wav"""
import os, wave
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build", "sfx")
rng = np.random.default_rng(3)
T = lambda s: np.arange(int(s * SR)) / SR


def band(x, lo=None, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); g = np.ones_like(f)
    if lo: g *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi: g *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * g, len(x))


def env(n, a, r):
    e = np.ones(n); a = max(1, int(a * SR)); r = max(1, int(r * SR)); e[:a] = np.linspace(0, 1, a); e[-r:] *= np.linspace(1, 0, r); return e


def norm(x, p=0.89): return x / (np.max(np.abs(x)) + 1e-9) * p


def write(name, x):
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
    print(f"sfx {name:15s} {len(x) / SR:.2f}s")


def creak(dur, f0, f1):
    t = T(dur)
    rate = f0 + (f1 - f0) * np.sin(np.pi * t / dur) ** 2 + 8 * np.sin(2 * np.pi * 3 * t)
    ph = np.cumsum(rate / SR); pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(float) * (0.6 + 0.4 * rng.random(len(t)))
    x = band(pulses, 400, 900) + 0.6 * band(pulses, 1000, 1600) + 0.3 * band(pulses, 2000, 2800)
    return norm(x * env(len(t), 0.06, 0.3))


def phone_ring():
    t = T(1.2); x = np.zeros_like(t)
    for s in (0.0, 0.5):
        m = (t >= s) & (t < s + 0.35); tt = t[m] - s
        x[m] += (np.sin(2 * np.pi * 1400 * tt) + np.sin(2 * np.pi * 1750 * tt)) * (np.sin(2 * np.pi * 22 * tt) > 0)
    return norm(band(x, hi=6000) * env(len(t), 0.005, 0.05))


def whistle():                   # carefree little tune
    notes = [(76, 0.18), (79, 0.18), (84, 0.3), (81, 0.18), (79, 0.18), (76, 0.36)]
    out = []
    for m, d in notes:
        t = T(d); f = 440 * 2 ** ((m - 69) / 12)
        out.append(np.sin(2 * np.pi * f * t + 0.004 * f * np.sin(2 * np.pi * 6 * t)) * env(len(t), 0.02, 0.05) + band(rng.standard_normal(len(t)), 2000, 6000) * 0.04)
    return norm(np.concatenate(out))


def party(dur=5.0):              # crowd murmur + a party horn + a few claps
    t = T(dur)
    murmur = band(rng.standard_normal(len(t)), 250, 1800) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.7 * t))
    for _ in range(14):           # chattering voice-like formants
        c = rng.uniform(0, dur - 0.5); m = (t >= c) & (t < c + 0.4); tt = t[m] - c
        murmur[m] += np.sin(2 * np.pi * rng.uniform(140, 260) * tt) * np.sin(np.pi * tt / 0.4) * 0.6
    horn = np.zeros_like(t); m = (t >= 0.2) & (t < 0.8); tt = t[m] - 0.2
    horn[m] = np.sign(np.sin(2 * np.pi * (380 + 40 * tt) * tt)) * np.minimum(1, tt / 0.03) * np.minimum(1, (0.6 - tt) / 0.1) * 0.5
    claps = np.zeros_like(t)
    for c in np.arange(0.9, 2.6, 0.22):
        m = t >= c; tt = t[m] - c; claps[m] += band(rng.standard_normal(m.sum()), 800, 5000) * np.exp(-tt / 0.012) * 1.2
    return norm(murmur * 0.6 + band(horn, hi=3000) + claps)


def record_scratch():
    t = T(0.5); table = band(rng.standard_normal(SR), hi=2500) + 0.6 * np.sin(2 * np.pi * 220 * np.arange(SR) / SR)
    sp = 9 * np.sin(2 * np.pi * t / 0.24) + 1.5; pos = (np.cumsum(sp) % SR).astype(int)
    return norm(band(table[pos] * np.abs(sp) / 9, 300, 3000) * env(len(t), 0.005, 0.12))


def shutter():                   # camera click-clack
    t = T(0.25); x = np.zeros_like(t)
    for s, a in [(0.0, 1.0), (0.07, 0.7)]:
        m = t >= s; tt = t[m] - s; x[m] += band(rng.standard_normal(m.sum()), 1500, 9000) * np.exp(-tt / 0.008) * a
    return norm(x)


if __name__ == "__main__":
    write("gate_creak", creak(1.8, 25, 60))
    write("door_creak", creak(1.2, 35, 90))
    write("phone_ring", phone_ring())
    write("whistle", whistle())
    write("party", party())
    write("record_scratch", record_scratch())
    write("shutter", shutter())
