#!/usr/bin/env python3
"""All sound effects, synthesised with numpy (no samples). -> build/sfx/*.wav"""
import math, os, wave
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build", "sfx")
rng = np.random.default_rng(11)


def T(sec):
    return np.arange(int(sec * SR)) / SR


def fft_filter(x, lo=None, hi=None):
    """zero-phase band filter in the frequency domain (smooth edges)"""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if lo: g *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi: g *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * g, len(x))


def env(n, a, r):
    e = np.ones(n); a = max(1, int(a * SR)); r = max(1, int(r * SR))
    e[:a] = np.linspace(0, 1, a); e[-r:] *= np.linspace(1, 0, r); return e


def norm(x, p=0.89):
    return x / (np.max(np.abs(x)) + 1e-9) * p


def write(name, x):
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
    print(f"sfx {name:15s} {len(x) / SR:.2f}s")


def alarm():                       # digital alarm: beep-beep-beep-beep ... pause
    t = T(2.2); x = np.zeros_like(t)
    for g in range(3):
        for b in range(4):
            s = g * 0.62 + b * 0.12; m = (t >= s) & (t < s + 0.07)
            x[m] += np.sign(np.sin(2 * np.pi * 2093 * t[m])) * 0.6 + np.sin(2 * np.pi * 4186 * t[m]) * 0.3
    return norm(fft_filter(x, hi=7000))


def mirror_crack():               # sharp crack + tinkling glass
    t = T(1.0)
    crack = fft_filter(rng.standard_normal(len(t)), lo=1500) * np.exp(-t / 0.012)
    snap = np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.05) * 0.6
    tink = np.zeros_like(t)
    for _ in range(18):
        c = rng.uniform(0.03, 0.7); f = rng.uniform(3000, 7500)
        m = t >= c
        tink[m] += np.sin(2 * np.pi * f * (t[m] - c)) * np.exp(-(t[m] - c) / rng.uniform(0.03, 0.12)) * rng.uniform(0.2, 0.5)
    return norm(crack * 2.5 + snap + tink)


def brush():                       # back-and-forth scrubbing
    t = T(4.6)
    rate = 7 + 3 * (t / 4.6)        # gets faster ("five times")
    stroke = np.abs(np.sin(np.pi * np.cumsum(rate) / SR)) ** 1.4
    hiss = fft_filter(rng.standard_normal(len(t)), lo=2500, hi=6500)
    wet = fft_filter(rng.standard_normal(len(t)), lo=500, hi=1200) * 0.4
    return norm((hiss + wet) * stroke * env(len(t), 0.03, 0.2))


def gargle():                      # bubbly throat flutter
    t = T(2.4)
    flutter = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * (28 + 4 * np.sin(2 * np.pi * 1.3 * t)) * t))
    base = np.sin(2 * np.pi * np.cumsum(140 + 60 * np.sin(2 * np.pi * 2.1 * t)) / SR)
    noise = fft_filter(rng.standard_normal(len(t)), lo=200, hi=1400)
    bub = np.zeros_like(t)
    for _ in range(40):
        c = rng.uniform(0, 2.3); f = rng.uniform(300, 900); m = (t >= c) & (t < c + 0.05)
        tt = t[m] - c; bub[m] += np.sin(2 * np.pi * f * (1 + 6 * tt) * tt) * np.exp(-tt / 0.015)
    return norm(fft_filter((base * 0.5 + noise) * flutter, hi=2500) + bub * 0.5) * env(len(t), 0.05, 0.25)


def ding():                        # little sparkle "ding"
    t = T(1.0); x = np.zeros_like(t)
    for p, a in [(1, 1), (2.76, 0.5), (5.4, 0.25)]:
        x += np.sin(2 * np.pi * 1760 * p * t) * a * np.exp(-t / (0.5 / p))
    return norm(x)


def footsteps():                   # quick running steps
    t = T(2.4); x = np.zeros_like(t)
    for k, s in enumerate(np.arange(0.0, 2.35, 0.15)):
        m = t >= s; tt = t[m] - s
        x[m] += (np.sin(2 * np.pi * 85 * tt) * np.exp(-tt / 0.05) + fft_filter(rng.standard_normal(m.sum()), hi=2500) * np.exp(-tt / 0.018) * 0.7) * (0.75 + 0.25 * (k % 2))
    return norm(x)


def door_bell():                   # cafe door bell: ding-a-ling
    t = T(1.4); x = np.zeros_like(t)
    for s, f0 in [(0.0, 2350), (0.09, 2520), (0.19, 2380), (0.31, 2470)]:
        m = t >= s; tt = t[m] - s
        for p, a in [(1, 1), (2.32, 0.45), (4.1, 0.2)]:
            x[m] += np.sin(2 * np.pi * f0 * p * tt) * a * np.exp(-tt / (0.6 / p))
    return norm(x)


def record_scratch():
    t = T(0.5)
    table = fft_filter(rng.standard_normal(SR), hi=2500) + 0.6 * np.sin(2 * np.pi * 220 * np.arange(SR) / SR)
    speed = 9 * np.sin(2 * np.pi * t / 0.24) + 1.5
    pos = (np.cumsum(speed) % SR).astype(int)
    x = table[pos] * np.abs(speed) / 9
    return norm(fft_filter(x, lo=300, hi=3000) * env(len(t), 0.005, 0.12))


def spray():                       # aerosol "psssht"
    t = T(1.3)
    x = fft_filter(rng.standard_normal(len(t)), lo=3500, hi=11000)
    return norm(x * env(len(t), 0.03, 0.35) * (0.85 + 0.15 * np.sin(2 * np.pi * 9 * t)))


if __name__ == "__main__":
    for fn in [alarm, mirror_crack, brush, gargle, ding, footsteps, door_bell, record_scratch, spray]:
        write(fn.__name__, fn())
