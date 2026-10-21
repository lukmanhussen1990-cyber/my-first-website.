#!/usr/bin/env python3
"""Builds the whole soundtrack from code: bouncy music, synthesized sound
effects, the narrator placed on the story beats, ducking and the final mix.

Inputs : script/voiceover.json, voice/lineNN.wav, voice/timings.json, render/cues.json
Outputs: output/audio/{voice,music,sfx,mix}.wav and output/word_times.json
"""
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
DUR = 50.0
N = int(DUR * SR)
rng = np.random.default_rng(20261021)


# ---------------------------------------------------------------- helpers
def T(d):
    return np.arange(int(d * SR)) / SR


def noise(d, seed=None):
    g = np.random.default_rng(seed) if seed is not None else rng
    return g.standard_normal(int(d * SR))


def filt(x, kind, f, order=2):
    sos = butter(order, f, kind, fs=SR, output="sos")
    return sosfilt(sos, x)


def lp(x, f, o=2): return filt(x, "lowpass", f, o)
def hp(x, f, o=2): return filt(x, "highpass", f, o)
def bp(x, lo, hi, o=2): return filt(x, "bandpass", [lo, hi], o)


def env(n, a=0.005, d=0.2, sustain=0.0, curve=4.0):
    """attack/exponential-decay envelope of n samples"""
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(a, 1e-4))
    dec = np.exp(-np.maximum(0, t - a) * curve / max(d, 1e-4))
    return e * (sustain + (1 - sustain) * dec)


def fade(x, fi=0.005, fo=0.02):
    x = x.copy()
    a, b = int(fi * SR), int(fo * SR)
    if a: x[:a] *= np.linspace(0, 1, a)
    if b: x[-b:] *= np.linspace(1, 0, b)
    return x


class Bus:
    def __init__(self):
        self.L = np.zeros(N); self.R = np.zeros(N)

    def add(self, x, t0, gain=1.0, pan=0.0):
        i = int(round(t0 * SR))
        if i >= N: return
        if i < 0: x = x[-i:]; i = 0
        x = x[: N - i] * gain
        k = min(len(x), int(0.006 * SR))
        if k > 1:  # never end a sound with a click
            x = x.copy(); x[-k:] *= np.linspace(1, 0, k)
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.L[i:i + len(x)] += x * l * 1.41421
        self.R[i:i + len(x)] += x * r * 1.41421

    def stereo(self):
        return np.stack([self.L, self.R], axis=1)


def midi(m): return 440.0 * 2 ** ((m - 69) / 12)


def mx(*xs):
    """sum signals of different lengths"""
    n = max(len(x) for x in xs)
    out = np.zeros(n)
    for x in xs: out[:len(x)] += x
    return out


def formant_voice(f0, d, formants, breath=0.15, seed=None, jitter=0.01):
    """glottal-ish pulse train through formant band-passes (cartoon vocal sounds)"""
    t = T(d)
    f = np.asarray(f0) if np.ndim(f0) else np.full(len(t), f0)
    f = f * (1 + jitter * np.sin(2 * np.pi * 5.5 * t))
    ph = np.cumsum(f / SR)
    src = (ph % 1.0) * 2 - 1                           # saw
    src = src + breath * noise(d, seed)
    out = np.zeros(len(t))
    for fc, bw, g in formants:
        out += g * bp(src, max(30, fc - bw / 2), fc + bw / 2, 2)
    return out


# ---------------------------------------------------------------- music
def tuba(f, d):
    t = T(d)
    glide = f * (1 - 0.03 * np.exp(-t * 25))
    ph = np.cumsum(glide / SR)
    x = sum((1 / k ** 1.25) * np.sin(2 * np.pi * k * ph) for k in range(1, 11))
    x = lp(x, 900)
    return x * env(len(t), 0.012, d * 0.55, 0.15, 3.5)


def pizz(f, d=0.45, bright=1.0):
    t = T(d)
    x = sum((0.8 ** k) * np.sin(2 * np.pi * f * k * (1 + 0.0007 * k * k) * t) * np.exp(-t * (6 + 3.0 * k)) for k in range(1, 9))
    x += 0.15 * bp(noise(d), 1500, 6000) * np.exp(-t * 80)
    return lp(x, 3500 * bright) * env(len(t), 0.002, d, 0, 2.0)


def marimba(f, d=0.6):
    t = T(d)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 5.5) + 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 16) + 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t * 35)
    x += 0.08 * bp(noise(d), 2000, 7000) * np.exp(-t * 120)
    return x * env(len(t), 0.002, d, 0, 1.0)


def glock(f, d=1.0):
    t = T(d)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 3.0) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 7) + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 12)
    return x * env(len(t), 0.001, d, 0, 1.0)


def clarinet(f, d):
    t = T(d)
    ph = np.cumsum(f * (1 + 0.004 * np.sin(2 * np.pi * 5 * t)) / SR)
    x = sum((1 / k) * np.sin(2 * np.pi * k * ph) for k in (1, 3, 5, 7, 9))
    return lp(x, 2500) * env(len(t), 0.02, d * 0.8, 0.5, 2.0) * fade(np.ones(len(t)), 0.01, 0.04)


def woodblock(f=1100, d=0.12):
    t = T(d)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 60) + 0.5 * bp(noise(d), f * 0.8, f * 1.6) * np.exp(-t * 90))


def kick(d=0.3):
    t = T(d)
    f = 45 + 90 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12)


def shaker(d=0.07):
    t = T(d)
    return hp(noise(d), 5000) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2


def snare(d=0.15, g=1.0):
    t = T(d)
    return g * (0.6 * bp(noise(d), 1500, 7000) * np.exp(-t * 30) + 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 35))


def build_music(stop_t):
    bus = Bus()
    bpm = 120.0; beat = 60 / bpm; bar = 4 * beat
    chords = [(65, [65, 69, 72]), (65, [65, 69, 72]), (70, [65, 70, 74]), (72, [64, 70, 72]),
              (65, [65, 69, 72]), (62, [62, 65, 69]), (67, [65, 70, 74]), (72, [64, 67, 70])]
    melody = [
        [(0, .5, 72), (.5, .5, 69), (1, .5, 65), (1.5, .25, 69), (2, .5, 72), (2.5, .5, 74), (3, 1, 72)],
        [(0, .5, 69), (.5, .5, 70), (1, .5, 69), (1.5, .5, 67), (2, 1, 65)],
        [(0, .5, 74), (.5, .5, 72), (1, .5, 70), (1.5, .5, 74), (2, .75, 77), (3, .5, 74), (3.5, .5, 70)],
        [(0, .5, 72), (.5, .5, 76), (1, .5, 79), (1.5, .5, 76), (2, .5, 72), (2.5, .5, 70), (3, .5, 67), (3.5, .5, 64)],
        [(0, .25, 65), (.25, .25, 69), (.5, .5, 72), (1, .5, 77), (1.5, .25, 76), (1.75, .25, 77), (2, 1, 72)],
        [(0, .5, 74), (.5, .5, 69), (1, .5, 65), (1.5, .5, 69), (2, .5, 74), (2.5, .5, 77), (3, 1, 76)],
        [(0, .5, 74), (.5, .5, 70), (1, .5, 67), (1.5, .5, 70), (2, .5, 74), (2.5, .5, 77), (3, .5, 76), (3.5, .5, 74)],
        [(0, .5, 72), (.5, .25, 70), (.75, .25, 69), (1, .5, 67), (1.5, .5, 64), (2, .5, 60), (2.5, .25, 64), (2.75, .25, 67), (3, .75, 72)],
    ]
    t0 = 0.25
    nbars = int((stop_t - t0) / bar) + 2
    for b in range(nbars):
        tb = t0 + b * bar
        if tb > stop_t: break
        root, tri = chords[b % 8]
        sec = tb  # time decides the arrangement
        build = sec > 41.4
        # bass: oom on 1 and 3 (tuba), walking pickup on the last beat of each 2nd bar
        for bt, note in ((0, root - 24), (2, root - 24 + 7)):
            bus.add(tuba(midi(note), beat * 0.9), tb + bt * beat, 0.55)
        if b % 2 == 1 and not build:
            bus.add(tuba(midi(root - 24 + 5), beat * 0.45), tb + 3.5 * beat, 0.35)
        # pah: pizzicato chord stabs on 2 and 4
        for bt in (1, 3):
            for k, m in enumerate(tri):
                bus.add(pizz(midi(m), 0.35), tb + bt * beat + k * 0.004, 0.16, pan=-0.25 + k * 0.25)
        # percussion
        if sec > 1.2:
            bus.add(kick(), tb, 0.35)
            for e in range(8):
                bus.add(shaker(), tb + e * beat / 2, 0.05 if e % 2 else 0.035, pan=0.4)
            bus.add(woodblock(1200), tb + 3.5 * beat, 0.16, pan=-0.3)
            bus.add(woodblock(900), tb + 1.5 * beat, 0.1, pan=0.3)
        if sec > 7.0:
            bus.add(snare(0.12, 0.5), tb + beat, 0.12); bus.add(snare(0.12, 0.5), tb + 3 * beat, 0.12)
        # melody: instrument changes per scene for variety
        if sec > 0.9 and not build:
            for (o, d, m) in melody[b % 8]:
                ts = tb + o * beat
                if ts > stop_t: continue
                if sec < 14 or 28 <= sec < 35:
                    bus.add(marimba(midi(m), max(0.35, d * beat * 1.6)), ts, 0.32, pan=0.15)
                elif sec < 21:
                    bus.add(pizz(midi(m + 12), 0.4, 1.3), ts, 0.28, pan=0.15)
                    bus.add(marimba(midi(m - 12), 0.4), ts, 0.12)
                elif sec < 28:
                    bus.add(clarinet(midi(m), d * beat * 0.95), ts, 0.16, pan=0.2)
                    bus.add(marimba(midi(m), 0.4), ts, 0.12)
                else:
                    bus.add(marimba(midi(m), max(0.35, d * beat * 1.6)), ts, 0.3, pan=0.15)
                    bus.add(glock(midi(m + 12), 0.9), ts, 0.1, pan=-0.2)
        if build:
            # anticipation: snare roll + rising tuba steps into the leap
            for i in range(int(bar / (beat / 4))):
                ts = tb + i * beat / 4
                if ts < stop_t:
                    bus.add(snare(0.08, 1.0), ts, 0.05 + 0.25 * (ts - 41.4) / 2.0)
            for i, m in enumerate([60, 62, 64, 65, 67, 69, 71, 72]):
                ts = tb + i * beat / 2
                if ts < stop_t:
                    bus.add(tuba(midi(m - 24), beat * 0.45), ts, 0.45)
                    bus.add(marimba(midi(m + 12), 0.3), ts, 0.2)
    st = bus.stereo()
    # hard stop right on the splash (5 ms fade to avoid a click)
    i = int(stop_t * SR)
    st[i:, :] = 0
    k = int(0.005 * SR)
    st[i - k:i, :] *= np.linspace(1, 0, k)[:, None]
    return st


# ---------------------------------------------------------------- sound effects
def stomp(g=1.0):
    d = 0.6; t = T(d)
    f = 34 + 40 * np.exp(-t * 14)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    thud = lp(noise(d), 260, 4) * np.exp(-t * 18) * 1.2
    crunch = bp(noise(d), 300, 1800) * np.exp(-t * 35) * 0.35
    return g * (body + thud + crunch)


def huff():
    d = 0.6; t = T(d)
    e = np.minimum(1, t / 0.05) * np.exp(-t * 6)
    air = bp(noise(d), 300, 2500) * e
    hm = formant_voice(110 - 25 * t, d, [(600, 200, 1.0), (1100, 250, 0.5), (250, 120, 0.8)], 0.4) * e * 0.5
    return (air * 0.9 + hm)


def chest_hit(i):
    d = 0.3; t = T(d)
    f = (88 + 6 * (i % 3)) * (1 + 0.25 * np.exp(-t * 40))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 16)
    x += 0.45 * lp(noise(d, 100 + i), 900) * np.exp(-t * 40)
    return x


def scrape(seed, g=1.0):
    d = 0.09; t = T(d)
    x = bp(noise(d, seed), 700, 4500) * np.sin(np.pi * t / d) ** 1.5
    x += 0.6 * lp(noise(d, seed + 1), 300) * np.exp(-t * 40)
    return g * x


def dirt_patter(d, density=120, seed=7):
    """many small clods landing"""
    g = np.random.default_rng(seed)
    out = np.zeros(int(d * SR))
    n = int(d * density)
    for _ in range(n):
        i = g.integers(0, len(out) - 2400)
        k = int(g.uniform(0.008, 0.03) * SR)
        tt = np.arange(k) / SR
        blip = g.standard_normal(k) * np.exp(-tt * g.uniform(80, 200))
        out[i:i + k] += blip * g.uniform(0.2, 1.0)
    return lp(hp(out, 200), 3500)


def gasp():
    d = 0.55; t = T(d)
    e = np.minimum(1, t / 0.18) ** 2 * np.exp(-np.maximum(0, t - 0.22) * 14)
    air = (bp(noise(d), 650, 1000) * 1.0 + bp(noise(d), 1100, 1500) * 0.7 + bp(noise(d), 2400, 3000) * 0.35) * e
    voice = formant_voice(170 + 90 * t, d, [(750, 150, 1), (1250, 200, 0.6), (2600, 300, 0.25)], 0.6) * e * 0.35
    return air * 1.4 + voice


def squeak(f0=1900, d=0.22, seed=0):
    t = T(d)
    f = f0 * (1 + 0.18 * np.sin(np.pi * t / d)) * (1 + 0.02 * np.sin(2 * np.pi * 38 * t))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * 2 * np.cumsum(f) / SR)
    return x * np.sin(np.pi * t / d) ** 2 * 0.5


def boing(f0=180, d=0.5):
    t = T(d)
    f = f0 * (1 + 0.6 * np.exp(-t * 6) * np.sin(2 * np.pi * 9 * t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) * 0.8


def pop(f0=600):
    d = 0.12; t = T(d)
    f = f0 * (1 + 1.5 * np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 40)


def paper():
    d = 0.55; t = T(d)
    g = np.random.default_rng(5)
    am = np.repeat(g.uniform(0, 1, int(d * 200)) ** 3, SR // 200)[: len(t)]
    am = np.pad(am, (0, len(t) - len(am)))
    return bp(noise(d), 1800, 9000) * am * np.sin(np.pi * t / d) * 1.4


def sparkle(n=6, base=88, d=0.12):
    out = np.zeros(int((n * d + 1.0) * SR))
    for i in range(n):
        g = glock(midi(base + [0, 4, 7, 12, 16, 19, 24][i % 7]), 0.8)
        j = int(i * d * SR); out[j:j + len(g)] += g * (0.6 + 0.4 * (i / n))
    return out


def rumble(d):
    t = T(d)
    return lp(noise(d), 140, 4) * 3.0 * np.minimum(1, t / 0.3) * np.minimum(1, (d - t) / 0.4)


def pound():
    d = 0.5; t = T(d)
    f = 50 + 70 * np.exp(-t * 20)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    x += 0.8 * lp(noise(d), 500, 4) * np.exp(-t * 22) + 0.3 * bp(noise(d), 800, 3000) * np.exp(-t * 40)
    return x


def thunk():
    d = 0.35; t = T(d)
    x = np.sin(2 * np.pi * 120 * t) * np.exp(-t * 18) + 0.5 * bp(noise(d), 400, 2000) * np.exp(-t * 35)
    return x


def tile_click(f):
    d = 0.06; t = T(d)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 90) + 0.35 * hp(noise(d), 4000) * np.exp(-t * 200))


def grunt():
    d = 0.45; t = T(d)
    e = np.minimum(1, t / 0.03) * np.exp(-t * 5.5)
    f0 = 105 - 30 * t / d
    x = formant_voice(f0, d, [(520, 160, 1), (950, 220, 0.6), (220, 100, 1.2)], 0.25, jitter=0.03) * e
    return lp(x, 2000)


def slide(d):
    t = T(d)
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 11 * t) ** 2
    return bp(noise(d), 250, 1800) * am * np.minimum(1, t / 0.08) * np.minimum(1, (d - t) / 0.12) * 0.8


def peel():
    d = 0.12; t = T(d)
    fc = 900 + 2600 * t / d
    x = noise(d)
    out = np.zeros(len(t))
    for k in range(4):
        sl = slice(k * len(t) // 4, (k + 1) * len(t) // 4)
        out[sl] = bp(x, fc[sl].mean() * 0.7, fc[sl].mean() * 1.3)[sl]
    return out * np.sin(np.pi * t / d) * 1.4


def chomp():
    d = 0.18; t = T(d)
    return (bp(noise(d), 600, 3500) * np.exp(-t * 30) + 0.5 * np.sin(2 * np.pi * 140 * t) * np.exp(-t * 40)) * 0.8


def hose(d):
    t = T(d)
    flutter = 0.8 + 0.2 * np.sin(2 * np.pi * 13 * t) * np.sin(2 * np.pi * 2.3 * t)
    hiss = bp(noise(d), 1800, 9000) * flutter
    splat = bp(noise(d), 300, 1500) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 7 * t)))
    e = np.minimum(1, t / 0.15) * np.minimum(1, (d - t) / 0.25)
    return (hiss * 0.7 + splat * 0.6) * e


def whoosh(d=0.5, up=True):
    t = T(d); x = noise(d); out = np.zeros(len(t))
    segs = 10
    for k in range(segs):
        sl = slice(k * len(t) // segs, (k + 1) * len(t) // segs)
        fc = 300 + (2500 if up else -0) * (k / segs) if up else 2500 - 2200 * (k / segs)
        out[sl] = bp(x, fc * 0.6, fc * 1.4)[sl]
    return out * np.sin(np.pi * t / d) ** 2


def slide_whistle(t0f, t1f, d):
    t = T(d)
    f = t0f * (t1f / t0f) ** (t / d)
    x = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.006 * np.sin(2 * np.pi * 6 * t))) / SR)
    return x * np.minimum(1, t / 0.05) * np.minimum(1, (d - t) / 0.08) * 0.4


def splash_big():
    d = 2.6; t = T(d)
    boom = np.sin(2 * np.pi * np.cumsum(40 + 60 * np.exp(-t * 8)) / SR) * np.exp(-t * 3.5) * 1.3
    burst = noise(d)
    body = lp(burst, 3000) * np.exp(-t * 2.2) * 1.2 + hp(burst, 2500) * np.exp(-t * 4) * 0.5
    g = np.random.default_rng(11)
    plinks = np.zeros(len(t))
    for _ in range(140):
        i = int(g.uniform(0.25, 2.3) * SR); k = int(0.05 * SR)
        tt = np.arange(k) / SR
        f = g.uniform(700, 2600) * (1 + 0.8 * np.exp(-tt * 70))
        plinks[i:i + k] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 70) * g.uniform(0.05, 0.25)
    return boom + body + plinks


def rain_on_kid(d):
    return dirt_patter(d, 260, 21) * 0.8 + bp(noise(d), 400, 2500) * 0.25 * np.linspace(1, 0, int(d * SR))


def sigh():
    d = 1.6; t = T(d)
    e = np.minimum(1, t / 0.15) * np.exp(-np.maximum(0, t - 0.4) * 2.2)
    f0 = 150 * (1 - 0.35 * t / d)
    x = formant_voice(f0, d, [(720, 180, 1), (1150, 220, 0.55), (2500, 300, 0.15)], 0.55, jitter=0.02) * e
    return lp(x, 3000) * 1.1


def drip():
    d = 0.08; t = T(d)
    f = 1400 * (1 + 1.2 * np.exp(-t * 80))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 60) * 0.5


def crickets(d):
    t = T(d)
    chirp = (np.sin(2 * np.pi * 4300 * t) * (np.sin(2 * np.pi * 28 * t) > 0.2) * (np.sin(2 * np.pi * 1.1 * t) > 0.4))
    return lp(chirp, 6000) * 0.12


def bird(seed):
    g = np.random.default_rng(seed)
    d = g.uniform(0.08, 0.16); t = T(d)
    f = g.uniform(3200, 4800) * (1 + g.uniform(-0.25, 0.3) * t / d) * (1 + 0.04 * np.sin(2 * np.pi * g.uniform(25, 45) * t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2


def ambience(t_end):
    """quiet sunset bed: soft breeze + occasional birdsong (stops with the music)"""
    bus = Bus()
    d = t_end
    t = T(d)
    breeze = lp(noise(d, 77), 500) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t + 1.0))
    bus.add(breeze * np.minimum(1, t / 1.0), 0.0, 0.05, pan=0.0)
    g = np.random.default_rng(91)
    ts = 1.0
    while ts < t_end - 0.5:
        n = g.integers(2, 5)
        pan = g.uniform(-0.8, 0.8)
        for k in range(n):
            bus.add(bird(int(ts * 100) + k), ts + k * g.uniform(0.12, 0.2), g.uniform(0.03, 0.06), pan=pan)
        ts += g.uniform(1.6, 3.5)
    return bus


def build_sfx(c):
    b = c["beats"]; bus = Bus()
    for i, ts in enumerate(b["stomps"]):
        bus.add(stomp(1.0), ts - 0.01, 0.9, pan=0.35 - i * 0.07)
    bus.add(huff(), b["huff"] - 0.05, 0.75)
    for i, ts in enumerate(b["pounds"]):
        bus.add(chest_hit(i), ts - 0.01, 0.85, pan=-0.05 if i % 2 else 0.05)
    bus.add(stomp(1.1), b["hopLand"], 0.9)
    # super fast digging (two hands, "like a machine")
    for (a, e) in ([b["dig0"], b["spray1"]], [b["deep0"], b["deep1"]]):
        ts = a; k = 0
        while ts < e:
            bus.add(scrape(k), ts, 0.55, pan=-0.15 if k % 2 else 0.15); ts += 1 / 6.8; k += 1
        bus.add(rumble(e - a) * 0.3, a, 0.35)
    bus.add(dirt_patter(b["spray1"] + 1.0 - (b["spray0"] + 0.9), 90, 3), b["spray0"] + 0.9, 0.6, pan=0.45)
    bus.add(gasp(), b["gasp"], 0.9, pan=0.4)
    bus.add(boing(200), b["barrowPop"], 0.45)
    bus.add(pop(500), b["barrowPop"], 0.4)
    bus.add(squeak(1850, 0.2), b["barrowPop"] + 0.12, 0.35, pan=0.2)
    bus.add(squeak(2150, 0.18), b["barrowPop"] + 0.45, 0.3, pan=0.2)
    for i, ts in enumerate(b["scoops"]):
        bus.add(dirt_patter(0.35, 160, 30 + i), ts + 0.75, 0.6, pan=0.2)
        bus.add(squeak(1700 + 120 * i, 0.15), ts + 0.85, 0.22, pan=0.2)
        bus.add(scrape(50 + i, 1.3), ts + 0.05, 0.45)
    bus.add(slide_whistle(900, 250, b["deep1"] - b["deep0"]), b["deep0"], 0.5)   # "down, and down, and down"
    bus.add(dirt_patter(b["deep1"] - b["deep0"] + 0.8, 110, 9), b["deep0"] + 0.9, 0.45, pan=-0.3)
    bus.add(paper(), b["mapUp"] - 0.12, 0.75, pan=-0.4)
    bus.add(sparkle(7, 84, 0.07), b["linePop"], 0.35)
    bus.add(whoosh(0.5), b["climb"], 0.4)
    bus.add(stomp(1.1), b["climbLand"], 0.9)
    bus.add(dirt_patter(b["fill1"] - b["fill0"], 220, 12), b["fill0"] + 0.25, 0.7)
    bus.add(rumble(b["fill1"] - b["fill0"]) * 0.4, b["fill0"], 0.4)
    bus.add(rumble(b["crumble1"] - b["crumble0"]), b["crumble0"], 0.6)
    bus.add(dirt_patter(b["crumble1"] - b["crumble0"], 70, 13), b["crumble0"] + 0.1, 0.7)
    bus.add(stomp(1.0), b["jumpInLand"], 0.8)
    for i, ts in enumerate(b["punches"]):
        bus.add(pound(), ts, 0.95, pan=[-0.4, 0, 0.05, 0.4, 0][i])
    bus.add(stomp(1.0), b["jumpOutLand"], 0.8)
    for i, ts in enumerate(b["slabs"]):
        bus.add(thunk(), ts + 0.22, 0.6, pan=[-0.4, 0.4, 0, 0][i])
    # tiles: a fast, slightly rising cascade of clicks
    n = 46
    for i in range(n):
        k = i / n
        ts = b["tiles0"] + (b["tiles1"] - b["tiles0"]) * (k ** 0.9)
        bus.add(tile_click(2600 + 1400 * k + 300 * ((i * 7) % 5) / 5), ts + 0.12, 0.28, pan=np.sin(i * 1.3) * 0.5)
    for i in range(6):
        bus.add(mx(thunk() * 0.5, tile_click(1800) * 0.5), b["cope0"] + i * (b["cope1"] - b["cope0"]) / 6 + 0.1, 0.35, pan=-0.5 + i * 0.2)
    bus.add(glock(midi(96), 1.0) * 0.6, b["ladder"] + 0.1, 0.3, pan=0.4)
    bus.add(grunt(), b["grunt"] - 0.05, 0.9, pan=0.25)
    bus.add(huff(), b["huff2"] - 0.05, 0.6, pan=0.25)
    bus.add(boing(260), b["pilePop"], 0.4, pan=-0.2)
    bus.add(sparkle(5, 88, 0.06), b["pilePop"] + 0.05, 0.3, pan=-0.2)
    bus.add(slide(b["push1"] - b["push0"]), b["push0"], 0.55, pan=-0.2)
    for i, ts in enumerate(c["sfx"]["peel"]):
        bus.add(peel(), ts, 0.55, pan=0.25)
    for ts in c["sfx"]["bite"] + [33.35, 34.75, 36.85, 38.55]:
        bus.add(chomp(), ts, 0.4, pan=0.25)
    bus.add(hose(b["hoseOff"] - b["hoseOn"] + 0.2), b["hoseOn"], 0.5)
    bus.add(squeak(1300, 0.12), b["hoseOn"] - 0.15, 0.2)
    bus.add(mx(whoosh(0.45) * 0.6, pop(900) * 0.4), b["poof"] - 0.05, 0.6, pan=-0.45)
    bus.add(sparkle(7, 91, 0.05), b["poof"] + 0.05, 0.35, pan=-0.45)
    for ts in b["cheers"]:
        bus.add(boing(330, 0.35) * 0.6, ts, 0.25, pan=-0.45)
    bus.add(squeak(2300, 0.14), b["bands"], 0.3); bus.add(squeak(2600, 0.14), b["bands"] + 0.16, 0.3)
    bus.add(stomp(0.6), b["backstep"] + 0.1, 0.5)
    bus.add(whoosh(0.55), b["leap"] - 0.05, 0.5)
    bus.add(slide_whistle(300, 1500, 0.45), b["leap"], 0.4)
    bus.add(slide_whistle(1500, 350, b["impact"] - b["leap"] - 0.45), b["leap"] + 0.45, 0.4)
    bus.add(splash_big(), b["impact"], 1.25)
    bus.add(rain_on_kid(b["soak1"] - b["soak0"] + 0.4), b["soak0"], 0.7, pan=-0.45)
    bus.add(sigh(), b["sigh"], 1.9, pan=0.0)
    g = np.random.default_rng(3)
    ts = b["soak1"] + 0.3
    while ts < DUR - 0.2:
        bus.add(drip(), ts, g.uniform(0.08, 0.18), pan=-0.4); ts += g.uniform(0.25, 0.6)
    bus.add(crickets(DUR - b["impact"] - 0.5), b["impact"] + 0.5, 0.25)
    amb = ambience(b["impact"])
    return bus.stereo() + amb.stereo()


# ---------------------------------------------------------------- voice placement
def load_mono(p):
    x, sr = sf.read(str(p), dtype="float64", always_2d=True)
    x = x.mean(axis=1)
    if sr != SR:
        x = resample_poly(x, SR, sr)
    return x


def atempo(x, factor):
    """pitch-preserving speed-up via ffmpeg (only used if a line would overrun its slot)"""
    import subprocess, tempfile, os
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        sf.write(a, x, SR)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", a, "-filter:a", f"atempo={factor:.4f}", b], check=True)
        y, _ = sf.read(b)
    return y


def place_voice(script, timings):
    voice = np.zeros(N)
    words_out = []
    for line in script["lines"]:
        lid = line["id"]
        x = load_mono(ROOT / "voice" / f"{lid}.wav")
        x = hp(x, 70)
        x = x / (np.max(np.abs(x)) + 1e-9) * 0.9
        ws = timings[lid]["words"]
        parts = []
        k = None
        if line.get("split_word"):
            k = next((i for i, w in enumerate(ws) if i > 0 and w["text"].strip(".,!?") == line["split_word"]), None)
        if k is None:
            parts.append((0.0, len(x) / SR, ws, line["at"]))
        else:
            cut = (ws[k - 1]["end"] + ws[k]["start"]) / 2
            parts.append((0.0, cut, ws[:k], line["at"]))
            parts.append((cut, len(x) / SR, ws[k:], line["split_at"]))
        # resolve overlaps and the slot limit
        starts = []
        for i, (a, b, w, at) in enumerate(parts):
            s = at if i == 0 else max(at, starts[-1] + (parts[i - 1][1] - parts[i - 1][0]) + 0.08)
            starts.append(s)
        end = starts[-1] + (parts[-1][1] - parts[-1][0])
        speed = 1.0
        if end > line["latest_end"]:
            # pull the second part earlier first, then speed the line up if still needed
            if len(parts) == 2:
                starts[1] = max(starts[0] + (parts[0][1] - parts[0][0]) + 0.08, starts[1] - (end - line["latest_end"]))
            end = starts[-1] + (parts[-1][1] - parts[-1][0])
            if end > line["latest_end"]:
                speed = min(1.25, (end - starts[0]) / (line["latest_end"] - starts[0]))
        for i, (a, b, w, at) in enumerate(parts):
            seg = x[int(a * SR):int(b * SR)]
            seg = fade(seg, 0.004, 0.02)
            if speed > 1.001:
                seg = atempo(seg, speed)
            s = starts[i] if i == 0 else starts[0] + (starts[i] - starts[0]) / speed
            j = int(s * SR)
            voice[j:j + len(seg)] += seg[: max(0, N - j)]
            for wd in w:
                words_out.append({"line": lid, "text": wd["text"],
                                  "start": round(s + (wd["start"] - a) / speed, 3),
                                  "end": round(s + (wd["end"] - a) / speed, 3)})
        print(f"{lid}: parts at {[round(v, 2) for v in starts]} speed {speed:.3f}")
    return voice, words_out


def duck_env(voice, depth_db=-8.0):
    lvl = np.abs(voice)
    win = int(0.03 * SR)
    lvl = np.convolve(lvl, np.ones(win) / win, mode="same")
    active = (lvl > 0.01).astype(float)
    # attack 60 ms / release 350 ms smoothing
    out = np.zeros_like(active); g = 0.0
    a, r = np.exp(-1 / (0.06 * SR)), np.exp(-1 / (0.35 * SR))
    for i in range(0, len(active), 64):
        tgt = active[i]
        coef = a if tgt > g else r
        g = tgt + (g - tgt) * coef ** 64
        out[i:i + 64] = g
    return 10 ** (depth_db * out / 20)


def limiter(x, thr=0.9, release=0.12):
    """simple look-ahead peak limiter"""
    from scipy.ndimage import maximum_filter1d
    from scipy.signal import lfilter
    pk = maximum_filter1d(np.max(np.abs(x), axis=1), size=int(0.006 * SR) * 2 + 1)
    g = np.minimum(1.0, thr / np.maximum(pk, 1e-9))
    a = np.exp(-1 / (release * SR))
    # release smoothing: one-pole toward 1, never above the instantaneous need
    gs = lfilter([1 - a], [1, -a], g - 1.0) + 1.0
    return x * np.minimum(g, gs)[:, None]


def main():
    script = json.loads((ROOT / "script" / "voiceover.json").read_text())
    timings = json.loads((ROOT / "voice" / "timings.json").read_text())
    cues = json.loads((ROOT / "render" / "cues.json").read_text())
    outd = ROOT / "output" / "audio"; outd.mkdir(parents=True, exist_ok=True)

    voice, words = place_voice(script, timings)
    music = build_music(cues["sfx"]["musicStop"])
    sfx = build_sfx(cues)

    music = music / (np.max(np.abs(music)) + 1e-9) * 0.5
    sfx = sfx / (np.max(np.abs(sfx)) + 1e-9) * 0.85
    duck = duck_env(voice, -7.0)[:, None]
    v2 = np.stack([voice, voice], axis=1)
    # music about 8 dB under the voice between lines, ~15 dB under while the narrator speaks
    mix = v2 * 1.0 + music * 1.0 * duck + sfx * 1.15 * (0.75 + 0.25 * duck)
    mix = limiter(mix, 0.92)
    mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.93
    sf.write(outd / "voice.wav", voice, SR, subtype="PCM_24")
    sf.write(outd / "music.wav", music, SR, subtype="PCM_24")
    sf.write(outd / "sfx.wav", sfx, SR, subtype="PCM_24")
    sf.write(outd / "mix.wav", mix, SR, subtype="PCM_24")
    (ROOT / "output" / "word_times.json").write_text(json.dumps(words, indent=1))
    print("wrote", outd / "mix.wav", f"({len(words)} words)")


if __name__ == "__main__":
    main()
