#!/usr/bin/env python3
"""Synthesize the reel's sound effects with numpy (no samples, no external services).

door_creak, stomach_growl, record_scratch, pen_scribble, door_slam -> build/sfx/*.wav
"""
import math, os, wave
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build", "sfx")
rng = np.random.default_rng(7)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def biquad_bp(x, f0, q):
    w0 = 2 * math.pi * f0 / SR
    alpha = math.sin(w0) / (2 * q)
    b0, b1, b2 = alpha, 0.0, -alpha
    a0, a1, a2 = 1 + alpha, -2 * math.cos(w0), 1 - alpha
    b0, b1, b2, a1, a2 = b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for n in range(len(x)):
        xn = x[n]
        yn = b0 * xn + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, xn, y1, yn
        y[n] = yn
    return y


def lowpass(x, fc):
    a = 1 - math.exp(-2 * math.pi * fc / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for n in range(len(x)):
        acc += a * (x[n] - acc)
        y[n] = acc
    return y


def env_ad(n, attack, release):
    e = np.ones(n)
    a = max(1, int(attack * SR)); r = max(1, int(release * SR))
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


def norm(x, peak=0.89):
    m = np.max(np.abs(x)) or 1.0
    return x / m * peak


def write(name, x):
    os.makedirs(OUT, exist_ok=True)
    x = np.clip(x, -1, 1)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    print("sfx", name, f"{len(x) / SR:.2f}s")


def door_creak():
    t = t_axis(1.7)
    rate = 30 + 75 * np.sin(np.pi * t / 1.7) ** 2 + 12 * np.sin(2 * np.pi * 3.1 * t)
    phase = np.cumsum(rate / SR)
    pulses = (np.diff(np.floor(phase), prepend=0) > 0).astype(float)
    pulses *= 0.6 + 0.4 * rng.random(len(t))
    x = biquad_bp(pulses, 520, 12) * 1.0 + biquad_bp(pulses, 1150, 14) * 0.7 + biquad_bp(pulses, 2300, 16) * 0.35
    groan = np.sin(2 * np.pi * np.cumsum(rate * 2.0) / SR) * 0.15
    x = (x / (np.max(np.abs(x)) + 1e-9) + groan) * env_ad(len(t), 0.08, 0.35)
    return norm(x)


def stomach_growl():
    t = t_axis(1.35)
    f = 62 + 22 * np.sin(2 * np.pi * 2.3 * t) + 14 * np.sin(2 * np.pi * 7.1 * t + 1)
    saw = 2 * ((np.cumsum(f) / SR) % 1.0) - 1
    body = lowpass(saw, 380)
    bubbles = np.zeros_like(t)
    for _ in range(14):
        c = rng.uniform(0.05, 1.25); w = rng.uniform(0.02, 0.06); fb = rng.uniform(140, 320)
        bubbles += np.exp(-((t - c) / w) ** 2) * np.sin(2 * np.pi * fb * t * (1 + 0.6 * (t - c)))
    am = 0.55 + 0.45 * np.sin(2 * np.pi * 5.5 * t) ** 2
    x = body * am + 0.35 * bubbles
    x = x * env_ad(len(t), 0.06, 0.3)
    return norm(x)


def record_scratch():
    t = t_axis(0.5)
    table = lowpass(rng.standard_normal(SR), 2500)
    table += 0.6 * np.sin(2 * np.pi * 220 * np.arange(SR) / SR) + 0.4 * np.sin(2 * np.pi * 330 * np.arange(SR) / SR)
    speed = 9 * np.sin(2 * np.pi * t / 0.24) + 1.5
    pos = (np.cumsum(speed) % SR).astype(int)
    x = table[pos] * np.abs(speed) / 9
    x = biquad_bp(x, 1200, 0.8)
    x *= env_ad(len(t), 0.005, 0.12)
    return norm(x)


def pen_scribble():
    t = t_axis(1.15)
    noise = rng.standard_normal(len(t))
    hiss = biquad_bp(noise, 3800, 1.4)
    strokes = np.abs(np.sin(2 * np.pi * 6.5 * t + 0.6 * np.sin(2 * np.pi * 1.7 * t))) ** 1.5
    gate = (np.sin(2 * np.pi * 1.9 * t) > -0.7).astype(float)
    x = hiss * strokes * (0.4 + 0.6 * gate) * env_ad(len(t), 0.02, 0.15)
    return norm(x)


def door_slam():
    t = t_axis(1.0)
    thump = np.sin(2 * np.pi * 52 * t) * np.exp(-t / 0.16) + 0.5 * np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.08)
    crack = lowpass(rng.standard_normal(len(t)), 1800) * np.exp(-t / 0.035) * 3.0
    rattle = biquad_bp(rng.standard_normal(len(t)), 2600, 6) * np.exp(-((t - 0.07) / 0.05) ** 2) * 0.8
    tail = lowpass(rng.standard_normal(len(t)), 600) * np.exp(-t / 0.3) * 0.25
    x = thump + crack + rattle + tail
    return norm(x)


if __name__ == "__main__":
    write("door_creak", door_creak())
    write("stomach_growl", stomach_growl())
    write("record_scratch", record_scratch())
    write("pen_scribble", pen_scribble())
    write("door_slam", door_slam())
