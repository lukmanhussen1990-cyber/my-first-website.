"""Sound for the buried report card reel: voice placement, sound effects, music and the mix.

Everything is driven by build/timeline.json (node tools/export_timeline.mjs), so the
sound stays locked to the animation, and every effect and the music are synthesised
here in code. The voice lines (assets/vo/<id>.wav, made by tools/voices.py) sit in
fixed slots (timeline VO[].at); a line that has grown longer than its slot (a new
recording) is sped up a little (atempo, at most 1.12x) and reported. The placement
actually used is written to build/vo_placement.json for the subtitles.

usage: python tools/audio.py    -> build/mix.wav (+ stems in build/audio/)
"""
import json
import math
import os
import subprocess
import sys

import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = lambda *p: os.path.join(ROOT, "build", *p)
A = lambda *p: os.path.join(ROOT, "assets", *p)
TL = json.load(open(B("timeline.json")))
T = TL["T"]
WD = TL["WORLD"]
DUR = TL["DURATION"]
N = int(DUR * SR)
SCRIPT = json.load(open(os.path.join(ROOT, "script.json")))
rng = np.random.default_rng(7)


# ---------------------------------------------------------------------------
# dsp helpers
# ---------------------------------------------------------------------------
def tt(d):
    return np.arange(int(d * SR)) / SR


def sos(kind, f, order=2):
    return signal.butter(order, f, btype=kind, fs=SR, output="sos")


def lp(x, f, o=2):
    return signal.sosfilt(sos("lowpass", f, o), x)


def hp(x, f, o=2):
    return signal.sosfilt(sos("highpass", f, o), x)


def bp(x, f1, f2, o=2):
    return signal.sosfilt(sos("bandpass", [f1, f2], o), x)


def noise(d):
    return rng.standard_normal(int(d * SR))


def pink(d):
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, noise(d)) * 6


def brown(d):
    return hp(np.cumsum(noise(d)) * 0.02, 20)


def norm(x, peak=0.9):
    return x * (peak / (np.max(np.abs(x)) + 1e-9))


def fade(x, a=0.005, r=0.02):
    x = x.copy()
    na, nr = max(1, min(len(x), int(a * SR))), max(1, min(len(x), int(r * SR)))
    x[:na] *= np.linspace(0, 1, na)
    x[-nr:] *= np.linspace(1, 0, nr)
    return x


def chirp(f, d):
    """sine with a per-sample frequency array or callable"""
    t = tt(d)
    fr = f(t) if callable(f) else f
    return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(fr, t.shape)) / SR)


def env_exp(d, tau, attack=0.002):
    t = tt(d)
    e = np.exp(-t / tau)
    na = max(1, int(attack * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def arch(d, p=1.0):
    """0 -> 1 -> 0 half-sine envelope"""
    return np.sin(np.pi * np.clip(tt(d) / d, 0, 1)) ** p


def put(out, t0, y, g=1.0):
    i = int(t0 * SR)
    if 0 <= i < len(out):
        out[i : i + len(y)] += y[: len(out) - i] * g


def grains(d, rate, f1, f2, glen=(0.002, 0.008), shape=None, amp=(0.3, 1.0)):
    """sparse crackle: short band-passed noise bursts"""
    out = np.zeros(int(d * SR))
    for _ in range(rng.poisson(rate * d)):
        st = rng.uniform(0, d)
        if shape is not None and rng.uniform() > shape(st / d):
            continue
        gl = rng.uniform(*glen)
        n = max(8, int(gl * SR))
        g = bp(noise(gl + 0.01), f1, f2)[:n] * np.hanning(n)
        put(out, st, g, rng.uniform(*amp))
    return out


def modes(d, parts, phase=True):
    """sum of decaying sines: [(freq, amp, tau), ...]"""
    t = tt(d)
    return sum(a * np.sin(2 * np.pi * f * t + (rng.uniform(0, 6.28) if phase else 0)) * np.exp(-t / tau) for f, a, tau in parts)


# ---------------------------------------------------------------------------
# camera -> stereo position (the same monotone spline as src/util.js monotone)
# ---------------------------------------------------------------------------
def monotone(keys):
    t = [k[0] for k in keys]
    v = [k[1] for k in keys]
    n = len(keys)
    d = [(v[i + 1] - v[i]) / max(1e-9, t[i + 1] - t[i]) for i in range(n - 1)]
    m = [0.0] * n
    for i in range(1, n - 1):
        m[i] = 0.0 if d[i - 1] * d[i] <= 0 else (d[i - 1] + d[i]) / 2
    for i in range(n - 1):
        if d[i] == 0:
            m[i] = m[i + 1] = 0.0
            continue
        a, b = m[i] / d[i], m[i + 1] / d[i]
        s = a * a + b * b
        if s > 9:
            k = 3 / math.sqrt(s)
            m[i], m[i + 1] = k * a * d[i], k * b * d[i]

    def f(x):
        if x <= t[0]:
            return v[0]
        if x >= t[-1]:
            return v[-1]
        i = 0
        while x > t[i + 1]:
            i += 1
        h = t[i + 1] - t[i]
        u = (x - t[i]) / h
        u2, u3 = u * u, u * u * u
        return (2 * u3 - 3 * u2 + 1) * v[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * v[i + 1] + (u3 - u2) * h * m[i + 1]

    return f


CAM_CX = monotone([(c["t"], c["cx"]) for c in TL["CAM"]])
CAM_LS = monotone([(c["t"], math.log(c["s"])) for c in TL["CAM"]])


def pan(x, t, width=0.6):
    """stereo position of world x at time t: where it sits across the frame"""
    px = (x - CAM_CX(t)) * math.exp(CAM_LS(t))
    return float(np.clip(px / 540.0, -1, 1) * width)


# ---------------------------------------------------------------------------
# sound effects (all synthesised)
# ---------------------------------------------------------------------------
def s_pop(pitch=1.0):
    d = 0.13
    t = tt(d)
    y = chirp((330 + 700 * np.exp(-t / 0.011)) * pitch, d) * env_exp(d, 0.03, 0.0015)
    y += 0.12 * hp(noise(d), 2500) * env_exp(d, 0.0025)
    return norm(lp(y, 6000))


def s_thud(weight=1.0):
    d = 0.5
    t = tt(d)
    y = chirp((44 + 60 * np.exp(-t / 0.05)) / weight ** 0.3, d) * env_exp(d, 0.12 * weight, 0.003)
    y += 0.55 * lp(noise(d), 260) * env_exp(d, 0.045)
    y += 0.1 * bp(noise(d), 900, 3500) * env_exp(d, 0.02)
    return norm(y)


def s_dig():
    """shovel bites into the soil and lifts it: a dull thump with crumbly grit"""
    d = 0.34
    t = tt(d)
    thump = lp(noise(d), 380) * env_exp(d, 0.05, 0.004)
    grit = grains(d, 330, 1200, 5500, shape=lambda u: np.exp(-4 * u))
    scrape = bp(noise(d), 700, 2600) * env_exp(d, 0.03, 0.002)
    body = chirp(68 + 45 * np.exp(-t / 0.03), d) * env_exp(d, 0.06)
    return norm(norm(thump) * 0.8 + norm(grit) * 0.5 + norm(scrape) * 0.3 + norm(body) * 0.45)


def s_dig_soft():
    """a scoop heard from inside the ground: muffled"""
    return norm(lp(s_dig(), 1700) + 0.35 * np.pad(s_thud(0.7), (0, 0))[: int(0.34 * SR)])


def s_toss():
    """a shovelful landing on the pile"""
    d = 0.42
    y = lp(noise(d), 600) * env_exp(d, 0.06, 0.006)
    y += 0.6 * grains(d, 260, 900, 4500, shape=lambda u: np.exp(-5 * u))
    return norm(y)


def s_patter():
    """dirt crumbs bouncing on the tunnel floor"""
    d = 0.35
    return norm(grains(d, 90, 700, 3000, glen=(0.003, 0.01), shape=lambda u: np.exp(-3 * u)))


def s_crumble(d=1.1):
    """the roof gives way: a soft rumble and a rain of grit"""
    t = tt(d)
    shape = lambda u: np.clip(min(u / 0.08, 1.0) * (1 - u) ** 0.7 * 1.3, 0, 1)
    rum = lp(brown(d), 170, 4) * np.minimum(t / 0.06, 1) * np.clip((d - t) / (0.6 * d), 0, 1) ** 0.7
    y = norm(rum) * 0.7 + norm(grains(d, 1100, 1800, 7000, shape=shape)) * 0.5
    y += norm(grains(d, 160, 400, 1400, glen=(0.008, 0.03), shape=shape)) * 0.45
    return norm(y)


def s_knock(pitch=1.0):
    """wood on wood: a dry tok with a hollow body"""
    d = 0.3
    t = tt(d)
    y = modes(d, [(480 * pitch, 1.0, 0.03), (1130 * pitch, 0.6, 0.018), (1760 * pitch, 0.35, 0.011), (230 * pitch, 0.7, 0.05)])
    y += 0.5 * bp(noise(d), 900, 3800) * env_exp(d, 0.004, 0.0004)
    return norm(y * np.minimum(t / 0.0008, 1))


def s_creak(d=0.5, f0=170, f1=330, bright=1.0):
    """wood creak: stick-slip pulses through the wood's resonances"""
    t = tt(d)
    rate = f0 + (f1 - f0) * np.sin(np.pi * np.clip(t / d, 0, 1)) + 12 * np.sin(2 * np.pi * 9 * t)
    ph = np.cumsum(rate) / SR
    imp = (np.diff(np.floor(ph), prepend=0) > 0).astype(float) * (0.7 + 0.3 * rng.uniform(size=len(t)))
    y = signal.lfilter([1], [1, -0.96], imp)
    y = bp(y, 380, 2400 * bright) + 0.6 * bp(y, 850, 1300)
    return norm(y * arch(d, 0.6))


def s_whoosh(d=0.9, lo=380, hi=1900):
    t = tt(d)
    y = noise(d)
    out = np.zeros_like(y)
    blk = 1024
    for i in range(0, len(y), blk):
        u = i / len(y)
        fc = lo + (hi - lo) * np.sin(np.pi * u) ** 1.5
        seg = bp(y[max(0, i - 2048) : i + blk], fc * 0.7, fc * 1.4)[-min(blk, len(y) - i):]
        out[i : i + len(seg)] = seg
    return norm(out * arch(d, 1.2))


def s_flip():
    """the trapdoor tile flips up on its hinges and lands open"""
    y = np.zeros(int(0.7 * SR))
    put(y, 0.0, s_creak(0.22, 260, 420), 0.5)
    put(y, 0.05, s_whoosh(0.28, 600, 2200), 0.35)
    put(y, 0.3, s_knock(0.75), 1.0)
    put(y, 0.3, s_thud(0.5)[: int(0.3 * SR)], 0.4)
    return norm(y)


def s_tap():
    """spoon on solid tile and concrete: a hard little tok"""
    d = 0.3
    t = tt(d)
    y = modes(d, [(2650, 1.0, 0.012), (1150, 0.7, 0.02), (4300, 0.4, 0.007)])
    y += 0.7 * chirp(70 + 90 * np.exp(-t / 0.01), d) * env_exp(d, 0.035, 0.0005)
    y += 0.3 * bp(noise(d), 1500, 6000) * env_exp(d, 0.004, 0.0003)
    return norm(y)


def s_crinkle(d=0.35):
    """a bag of chips crinkling"""
    return norm(grains(d, 900, 1800, 10000, glen=(0.001, 0.005), shape=lambda u: np.sin(np.pi * u)) + 0.05 * hp(noise(d), 4000) * arch(d))


def s_click():
    """the fridge light (or headlamp) switching on"""
    d = 0.05
    t = tt(d)
    y = (np.sin(2 * np.pi * 3100 * t) + 0.7 * np.sin(2 * np.pi * 5200 * t)) * np.exp(-t / 0.004)
    y += 0.5 * bp(noise(d), 2500, 9000) * np.exp(-t / 0.003)
    return norm(y)


def s_shimmer(d=1.3):
    """the top shelf lighting up"""
    out = np.zeros(int((d + 0.6) * SR))
    for k, f in enumerate([1568.0, 1760.0, 2093.0, 2349.3, 2637.0, 3136.0]):
        put(out, d * k / 6, modes(0.6, [(f, 1.0, 0.25), (f * 2.01, 0.3, 0.1)]), 0.6 + 0.4 * rng.uniform())
    out += norm(bp(noise(len(out) / SR), 3000, 8000)) * 0.08 * np.hanning(len(out))
    return norm(out)


def s_poof():
    """the shovel vanishing in a puff"""
    d = 0.35
    t = tt(d)
    return norm(lp(noise(d), 1400) * env_exp(d, 0.08, 0.01) + 0.3 * chirp(500 * np.exp(-t / 0.1) + 150, d) * env_exp(d, 0.1))


def s_boing(pitch=1.0, d=0.45):
    t = tt(d)
    f = (230 + 60 * t) * pitch * (1 + 0.3 * np.exp(-4 * t) * np.sin(2 * np.pi * 14 * t))
    return norm(chirp(f, d) * env_exp(d, 0.2, 0.003) + 0.25 * chirp(f * 2.0, d) * env_exp(d, 0.1))


def s_gulp():
    d = 0.32
    t = tt(d)
    f = 520 * np.exp(-t / 0.08) + 140
    y = chirp(f, d) * arch(d, 0.8) + 0.4 * chirp(f * 0.5, d) * np.exp(-t / 0.12)
    return norm(lp(y, 2000))


def s_bwip(up=True):
    """cartoon eyebrow: a quick little pitch flick"""
    d = 0.14
    t = tt(d)
    f = 700 + 1100 * (t / d) ** 1.3 if up else 1600 - 900 * (t / d)
    return norm(chirp(f, d) * arch(d, 0.7))


def s_clap():
    d = 0.09
    y = bp(noise(d), 900, 3200) * env_exp(d, 0.012, 0.0006)
    y += 0.4 * bp(noise(d), 300, 900) * env_exp(d, 0.02, 0.001)
    return norm(y)


def s_sniff():
    """three quick sniffs"""
    out = np.zeros(int(0.32 * SR))
    for k in range(3):
        d = 0.055
        g = bp(noise(d), 1800, 6000) * arch(d, 1.5) * (0.8 + 0.2 * k)
        put(out, k * 0.085, g)
    return norm(out)


def s_bark(muffled=True):
    """a happy 'wuf-wuf' (muffled: the card is in its mouth)"""
    out = np.zeros(int(0.42 * SR))
    for k, (f0, d) in enumerate([(520, 0.13), (600, 0.12)]):
        t = tt(d)
        f = f0 * (1 + 0.25 * np.exp(-t / 0.02)) * (1 - 0.25 * t / d)
        saw = sum(np.sin(2 * np.pi * np.cumsum(f * h) / SR) / h for h in range(1, 9))
        y = bp(saw, 400, 2400) * arch(d, 0.6) + 0.15 * bp(noise(d), 800, 3000) * env_exp(d, 0.03)
        put(out, k * 0.17, y)
    return norm(lp(out, 1300 if muffled else 3500))


def s_rain(d):
    """steady rain: a soft hiss, close drips, a few heavier drops (stereo)"""
    out = np.zeros((2, int(d * SR)))
    for ch in range(2):
        hiss = bp(pink(d), 800, 9000) * 0.25 + hp(noise(d), 4000) * 0.05
        drips = grains(d, 90, 1500, 7000, glen=(0.002, 0.006), amp=(0.2, 0.8))
        drops = grains(d, 9, 300, 1600, glen=(0.008, 0.02), amp=(0.4, 1.0))
        out[ch] = hiss + drips * 0.5 + drops * 0.35
    return out / (np.max(np.abs(out)) + 1e-9)


def s_thunder():
    d = 3.2
    t = tt(d)
    y = lp(brown(d), 160, 4) * (np.minimum(t / 0.25, 1) * np.exp(-t / 1.1)) * (1 + 0.5 * np.sin(2 * np.pi * 1.7 * t))
    y += 0.3 * lp(brown(d), 420) * np.exp(-((t - 0.35) ** 2) / 0.02)
    return norm(y)


def s_squelch(pitch=1.0):
    """squishy mud"""
    d = 0.38
    t = tt(d)
    f = (180 + 420 * np.exp(-t / 0.06)) * pitch
    y = chirp(f, d) * env_exp(d, 0.08, 0.01) * 0.5
    y += bp(noise(d), 250 * pitch, 1400 * pitch) * arch(d, 1.2)
    y += 0.5 * grains(d, 120, 500, 2500, shape=lambda u: np.exp(-3 * u))
    return norm(lp(y, 3000))


def s_blub(pitch=1.0):
    d = 0.16
    t = tt(d)
    f = (260 + 520 * (t / d) ** 1.5) * pitch
    return norm(chirp(f, d) * arch(d, 1.4) * np.exp(-t / 0.09))


def s_bubbles(d=1.2, rate=8, pitch=1.0):
    out = np.zeros(int(d * SR))
    for _ in range(rng.poisson(rate * d)):
        put(out, rng.uniform(0, d - 0.2), s_blub(pitch * rng.uniform(0.75, 1.4)), rng.uniform(0.3, 1.0))
    return norm(out)


def s_tink(pitch=1.0):
    """a metal panel snapping into place"""
    d = 0.35
    y = modes(d, [(1850 * pitch, 1.0, 0.06), (2970 * pitch, 0.6, 0.04), (4480 * pitch, 0.35, 0.025), (620 * pitch, 0.5, 0.05)])
    y += 0.4 * hp(noise(d), 3000) * env_exp(d, 0.003, 0.0003)
    return norm(y)


def s_latch():
    """the lid clicking shut: two crisp clicks and a ring"""
    out = np.zeros(int(0.45 * SR))
    for k, (dt_, g) in enumerate([(0.0, 1.0), (0.045, 0.7)]):
        d = 0.3
        y = hp(noise(d), 2500) * env_exp(d, 0.0025, 0.0002) + modes(d, [(2600, 0.5, 0.05), (4100, 0.35, 0.03), (1450, 0.3, 0.07)])
        put(out, dt_, y, g)
    return norm(out)


def s_glug():
    out = np.zeros(int(0.9 * SR))
    for k in range(4):
        put(out, k * 0.17 + 0.03 * rng.uniform(), s_blub(0.55 + 0.1 * k), 0.9 - 0.15 * k)
    out += 0.4 * np.pad(s_squelch(0.7), (0, max(0, len(out) - int(0.38 * SR))))[: len(out)]
    return norm(out)


def s_rumble(d):
    """the garden roller: a heavy rolling rumble with a squeaky axle"""
    t = tt(d)
    y = lp(brown(d), 220, 4) * (0.7 + 0.3 * np.sin(2 * np.pi * 3.2 * t))
    y += 0.25 * grains(d, 160, 400, 2000, glen=(0.004, 0.012))
    squeak = chirp(1500 + 120 * np.sin(2 * np.pi * 2.1 * t), d) * (0.5 + 0.5 * np.sin(2 * np.pi * 2.1 * t)) ** 6 * 0.12
    return norm(fade(y + squeak, 0.08, 0.15))


def s_beep():
    d = 0.075
    t = tt(d)
    return norm((np.sin(2 * np.pi * 1760 * t) + 0.2 * np.sin(2 * np.pi * 3520 * t)) * fade(np.ones(len(t)), 0.004, 0.02))


def s_squeal(d):
    t = tt(d)
    y = np.sin(2 * np.pi * (1980 + 18 * np.sin(2 * np.pi * 9 * t)) * t) * (0.75 + 0.25 * np.sin(2 * np.pi * 12 * t))
    return norm(fade(y, 0.01, 0.01))


def s_hum(d):
    """Dad humming a little tune: a nasal 'mmm' voice (saw through two formants)"""
    notes = [("G3", 0.42), ("A3", 0.22), ("B3", 0.42), ("D4", 0.62), ("B3", 0.3), ("A3", 0.3), ("G3", 0.62), ("E3", 0.32), ("G3", 0.75)]
    out = np.zeros(int(d * SR))
    t0 = 0.0
    while t0 < d:
        for n, nd in notes:
            if t0 >= d:
                break
            f0 = mf(n)
            nd2 = min(nd, d - t0)
            t = tt(nd2)
            vib = 1 + 0.012 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(t / 0.15, 1)
            ph = np.cumsum(f0 * vib) / SR
            saw = sum(np.sin(2 * np.pi * h * ph) / h for h in range(1, 14))
            y = bp(saw, 180, 420) + 0.35 * bp(saw, 1800, 2700)
            put(out, t0, fade(y, 0.04, 0.06) * arch(nd2, 0.35))
            t0 += nd
        t0 += 0.35
    return norm(lp(out, 3200))


def s_step():
    """a footstep on grass"""
    d = 0.12
    y = lp(noise(d), 1800) * env_exp(d, 0.03, 0.004) + 0.3 * grains(d, 200, 1500, 5000, shape=lambda u: np.exp(-6 * u))
    return norm(y)


def s_door():
    """the back door: latch, a short creak, it swings open"""
    out = np.zeros(int(1.0 * SR))
    put(out, 0.0, s_click(), 0.6)
    put(out, 0.05, s_creak(0.45, 210, 300, 0.7), 0.7)
    put(out, 0.08, lp(s_whoosh(0.6, 200, 700), 1500), 0.3)
    return norm(out)


def s_flurry(d):
    """Dad's cartoon digging flurry: rapid scrapes and dirt everywhere"""
    out = np.zeros(int(d * SR))
    k = 0.0
    while k < d - 0.3:
        put(out, k, s_dig(), 0.55 + 0.25 * rng.uniform())
        k += 0.09 + 0.03 * rng.uniform()
    out += 0.5 * grains(d, 600, 700, 5000)
    return norm(fade(out, 0.05, 0.2))


def s_climb(n, d):
    """rungs: quick wooden tocks"""
    out = np.zeros(int((d + 0.3) * SR))
    for k in range(n):
        put(out, k * d / n, s_knock(1.4 + 0.05 * k), 0.6)
    return norm(out)


def birds(d):
    """evening birdsong: little chirp phrases far off, left and right"""
    out = np.zeros((2, int(d * SR)))
    t0 = 0.4
    while t0 < d:
        ch = int(rng.integers(0, 2))
        f = rng.uniform(2600, 4200)
        for k in range(int(rng.integers(2, 5))):
            cd = rng.uniform(0.05, 0.11)
            t = tt(cd)
            y = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.35 * np.sin(np.pi * t / cd) * (1 if k % 2 else -0.6))) / SR) * arch(cd, 1.2)
            put(out[ch], t0 + k * (cd + 0.04), y, 0.7)
            put(out[1 - ch], t0 + k * (cd + 0.04) + 0.01, y, 0.2)
        t0 += rng.uniform(1.1, 2.6)
    breeze = lp(pink(d), 450) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.06 * tt(d)))
    out += np.stack([breeze, np.roll(breeze, 900)]) * 0.05
    return out / (np.max(np.abs(out)) + 1e-9)


VARY = {"pop", "dig", "dig_soft", "toss", "patter", "tink", "step", "clap", "squelch", "blub", "knock", "beep"}
CACHE = {}


def sfx(name, *args, **kw):
    key = (name, args, tuple(sorted(kw.items())))
    if name in VARY:
        return globals()["s_" + name](*args, **kw)
    if key not in CACHE:
        CACHE[key] = globals()["s_" + name](*args, **kw)
    return CACHE[key]


# ---------------------------------------------------------------------------
# cue sheet
# ---------------------------------------------------------------------------
CUES = []  # (time, sound, gain dB, pan or (from, to) sweep, ducked under the voice?)


def cue(t, snd, gain_db, x=None, p=None, duck=True):
    """x: world x of the source (panned by where it sits on screen at t); duck=False
    keeps a hit at full level even under the narration"""
    if p is None:
        p = pan(x, t) if x is not None else 0.0
    CUES.append((t, snd, gain_db, p, duck))


HOLE_X = WD["HOLE"]["x"]
PILE_X = WD["PILE"]["x"]
KID_X = WD["KID_SPOT"]["x"]
DOG_X = WD["DOGHOUSE"]["x"]
DAD_X = WD["DAD_SPOT"]["x"]


def sampled(key, t):
    s = WD[key]
    return float(np.interp(t, np.arange(len(s)) / 10.0, s))


def build_cues():
    S = WD["SCOOPS"]
    # 1 - the gulp, the shovel, the hole, the card goes in, covered, patted
    cue(T["gulp"], sfx("gulp"), -11, KID_X)
    cue(T["shovelIn"], sfx("pop", 1.1), -15, KID_X)
    for s in [s["t"] for s in S if s["kind"] == "out"]:
        cue(s - 0.06, sfx("dig"), -11, HOLE_X)
        cue(s + 0.55, sfx("toss"), -16, PILE_X)
    cue(T["cardDrop"], sfx("whoosh", 0.4, 900, 3500), -22, HOLE_X)
    cue(T["cardLand"], sfx("tap"), -19, HOLE_X)
    for s in [s["t"] for s in S if s["kind"] == "in"]:
        cue(s - 0.05, sfx("dig_soft"), -15, PILE_X)
        cue(s + 0.45, sfx("toss"), -14, HOLE_X)
        cue(s + 0.52, sfx("patter"), -19, HOLE_X)
    for p in T["pat"]:
        cue(p, sfx("thud", 0.6), -14, HOLE_X)
    cue(T["dogPeek"] + 0.1, sfx("sniff"), -15, DOG_X)
    # 2 - the dog digs it up, barks; the deep dig, the ladder, the refill
    for k in range(6):
        cue(T["dogGo"] + 0.1 + k * 0.14, sfx("step"), -25, DOG_X + (WD["DOG_SPOT"]["x"] - DOG_X) * k / 6)
    for s in T["sniff"]:
        cue(s, sfx("sniff"), -13, WD["DOG_SPOT"]["x"])
    for s in WD["PAW_T"]:
        cue(s, sfx("dig_soft"), -17, HOLE_X - 0.2)
        cue(s + 0.4, sfx("patter"), -21, HOLE_X - 1.0)
    cue(T["dogGrab"] + 0.1, sfx("crinkle"), -18, HOLE_X - 0.3)
    cue(T["bark"], sfx("bark"), -9, WD["DOG_SPOT"]["x"])
    cue(T["snatch"], sfx("whoosh", 0.35, 700, 2600), -18, HOLE_X - 0.2)
    cue(T["snatch"] + 0.05, sfx("crinkle"), -17, HOLE_X - 0.2)
    cue(T["deep0"], sfx("whoosh", 0.35, 400, 1500), -20, HOLE_X + 0.3)
    cue(T["deep0"] + 0.28, sfx("thud", 0.9), -15, HOLE_X)
    for s in WD["DEEP_T"]:
        cue(s - 0.05, sfx("dig_soft"), -12, HOLE_X)
        cue(s + 0.8, sfx("toss"), -17, PILE_X)
    cue(T["cardDown"], sfx("tap"), -20, HOLE_X)
    cue(T["ladderIn"], sfx("pop", 0.9), -15, HOLE_X)
    cue(T["climb0"], sfx("climb", 7, T["climb1"] - T["climb0"]), -15, HOLE_X)
    cue(T["ladderOut"], sfx("pop", 1.2), -17, HOLE_X)
    for k in range(3):
        cue(T["refill0"] + 0.25 * k, sfx("crumble", 0.9), -12, HOLE_X + 0.4)
    cue(T["refill1"] + 0.3, sfx("poof"), -17, KID_X)
    # 3 - storm, rain, mud, the card floats up, the box, the click, it sinks
    cue(T["storm0"], sfx("thunder"), -12, -0.3, duck=False)
    cue(T["mud0"], sfx("squelch", 1.0), -12, HOLE_X)
    cue(T["mud0"] + 0.35, sfx("squelch", 0.85), -14, HOLE_X)
    cue(T["mud0"] + 0.2, sfx("bubbles", 1.2, 6, 0.8), -18, HOLE_X)
    cue(T["float0"], sfx("bubbles", T["float1"] - T["float0"], 9, 1.0), -15, HOLE_X)
    cue(T["float1"], sfx("blub", 1.3), -12, HOLE_X)
    cue(T["fish"], sfx("squelch", 1.25), -13, HOLE_X)
    cue(T["fish"] + 0.4, sfx("patter"), -20, HOLE_X + 0.2)
    for i in range(5):
        cue(T["box0"] + i * T["boxGap"], sfx("tink", 0.9 + 0.08 * i), -15, HOLE_X)
    cue(T["boxLid"], sfx("tink", 0.7), -14, HOLE_X)
    cue(T["cardIn"], sfx("flip"), -18, HOLE_X)
    cue(T["click"], sfx("latch"), -7, HOLE_X, duck=False)
    cue(T["click"] + 0.05, sfx("shimmer", 0.6), -22, HOLE_X)
    cue(T["sink0"], sfx("squelch", 0.8), -12, HOLE_X)
    cue(T["sink0"] + 0.2, sfx("glug"), -12, HOLE_X)
    cue(T["sink0"] + 0.5, sfx("bubbles", 1.0, 7, 0.7), -18, HOLE_X)
    # 4 - suspicious; the flowers pop up one by one
    cue(T["sus"] - 0.05, sfx("bwip", False), -20, HOLE_X)
    for i, ft in enumerate(WD["FLOWER_T"]):
        cue(ft, sfx("pop", 1.0 + 0.09 * i), -14, WD["FLOWERS"][i][0])
    # 5 - the lump, the roller, flat
    cue(T["lump0"] + 0.05, sfx("boing", 0.62, 0.55), -12, HOLE_X)
    cue(T["rollIn"] - 0.25, sfx("pop", 0.8), -16, sampled("rollerX", T["rollIn"]))
    d = T["roll1"] - T["rollIn"] + 0.3
    cue(T["rollIn"], sfx("rumble", d), -13, None, p=(pan(sampled("rollerX", T["rollIn"]), T["rollIn"]), pan(sampled("rollerX", T["roll1"]), T["roll1"])))
    cue(T["rollOut"], sfx("poof"), -17, sampled("rollerX", T["rollOut"]))
    cue(T["sparkle"], sfx("shimmer", 1.0), -17, HOLE_X)
    # 6 - claps, the stroll
    for k in range(3):
        cue(T["dust0"] + 0.25 * k, sfx("clap"), -13, KID_X)
    for k in range(9):
        cue(T["kidWalk0"] + 0.15 + k * 0.21, sfx("step"), -27, None, p=0.0)
    # 7 - the door, Dad's walk and humming, the beeps, the flurry, the box, the creak
    cue(T["door"], sfx("door"), -14, WD["BACKDOOR"]["x"])
    t = T["dadOut"] + 0.15
    while t < T["dadArrive"] - 0.2:
        cue(t, sfx("step"), -22, sampled("dadX", t))
        t += 0.52
    cue(T["dadOut"] + 0.25, sfx("hum", T["dadArrive"] - T["dadOut"] - 0.5), -17, None, p=(pan(sampled("dadX", T["dadOut"]), T["dadOut"]), pan(DAD_X, T["dadArrive"])))
    for b in WD["BEEPS"]:
        cue(b, sfx("beep"), -12, DAD_X - 0.6, duck=False)
    cue(T["beep1"], sfx("squeal", T["dadDig0"] - T["beep1"]), -14, DAD_X - 0.6, duck=False)
    cue(T["dadDig0"], sfx("poof"), -14, DAD_X)
    cue(T["dadDig0"] + 0.05, sfx("pop", 0.9), -16, DAD_X)
    cue(T["dadDig0"] + 0.15, sfx("flurry", T["dadDig1"] - T["dadDig0"]), -9, HOLE_X + 0.3)
    for k in range(8):
        cue(T["dadDig0"] + 0.25 + k * 0.11 + 0.45, sfx("patter"), -19, -0.6 if k % 2 else 0.6)
    cue(T["boxUp"], sfx("thud", 0.7), -17, DAD_X)
    cue(T["creak0"], sfx("creak", T["creak1"] - T["creak0"] + 0.1, 150, 260, 1.1), -9, DAD_X, duck=False)
    cue(T["cardOut"], sfx("crinkle"), -15, DAD_X)
    cue(T["brow"], sfx("bwip"), -17, DAD_X, duck=False)
    cue(T["gulp2"], sfx("gulp"), -9, WD["KID_WATCH"]["x"], duck=False)


# ---------------------------------------------------------------------------
# music: soft, sneaky, playful tiptoe (pizzicato, marimba, celesta, soft bass,
# shaker, woodblock tiptoes) in F, a minor turn for the storm, and a suspense
# vamp for Dad that stops dead at T.musicStop on an unresolved C7.
# ---------------------------------------------------------------------------
def marimba(f, d=0.8, vel=1.0):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / (0.26 + 55 / f))
    y += 0.3 * np.sin(2 * np.pi * f * 3.98 * t) * np.exp(-t / 0.06)
    y += 0.06 * np.sin(2 * np.pi * f * 9.9 * t) * np.exp(-t / 0.025)
    y += 0.06 * bp(noise(d), 1500, 4000) * np.exp(-t / 0.004)
    return fade(y * vel, 0.001, 0.05)


def celesta(f, d=1.2, vel=1.0):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55) + 0.3 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t / 0.12)
    y += 0.12 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.3)
    return fade(y * vel, 0.001, 0.1)


def pluck(f, d=0.45, vel=1.0, bright=0.5, decay=0.2):
    """pizzicato string (Karplus-Strong)"""
    L = int(SR / f)
    n = int(d * SR)
    exc = np.zeros(n)
    exc[:L] = lp(noise(L / SR + 0.001), 1200 + 3000 * bright)[:L]
    a = np.zeros(L + 2)
    a[0], a[L], a[L + 1] = 1, -0.996 * 0.5, -0.996 * 0.5
    y = signal.lfilter([1.0], a, exc) * np.exp(-tt(d) / decay)
    return fade(lp(y, 2600) * vel, 0.002, 0.06)


def bass(f, d=0.42, vel=1.0):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.08) + 0.12 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.05)
    return fade(y * env_exp(d, 0.22, 0.006) * vel, 0.004, 0.05)


def shaker(vel=1.0):
    d = 0.06
    return hp(noise(d), 6500) * env_exp(d, 0.012, 0.004) * vel


def woodblock(vel=1.0, f=1250):
    d = 0.12
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t)) * np.exp(-t / 0.025) * vel


NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def mf(name):
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[n] + 12 * (o + 1) - 69) / 12)


CHORDS = {
    "F": ["F", "A", "C"], "Dm": ["D", "F", "A"], "Gm": ["G", "A#", "D"], "C7": ["C", "E", "G", "A#"],
    "Bb": ["A#", "D", "F"], "A7": ["A", "C#", "E", "G"], "Gm7": ["G", "A#", "D", "F"],
}
PROG = ["F", "Dm", "Gm7", "C7", "F", "Dm", "Bb", "C7",   # 0-7   the hole, the dog, the deep dig
        "Dm", "Gm", "A7", "Dm",                          # 8-11  the storm (sparse, minor)
        "Bb", "C7", "F", "F", "Bb", "C7", "F", "F",      # 12-19 flowers, the roller, congratulations
        "Dm", "Gm7", "C7", "C7", "C7"]                   # 20-24 Dad: a tiptoe vamp, cut dead on C7
N_BARS = len(PROG)
PAT_A = [(0.5, 0, 0), (1.0, 1, 0), (1.5, 2, 0), (2.5, 1, 0), (3.5, 0, 1)]
PAT_B = [(0.0, 2, 0), (0.75, -1, 0), (1.0, 2, 0), (2.0, 1, 0), (3.0, 0, 0)]
STORM = range(8, 12)
VAMP = range(20, 25)


def build_music():
    bar = T["musicStop"] / N_BARS
    beat = bar / 4
    out = np.zeros(N + SR * 3)
    rmel = np.random.default_rng(3)

    def tone(ch, idx, octv):
        tones = CHORDS[ch]
        if idx < 0:  # a chromatic step below the fifth: the sneaky slink
            return mf(tones[2 % len(tones)] + str(5 + octv)) * 2 ** (-1 / 12)
        return mf(tones[idx % len(tones)] + str(5 + octv - (1 if idx >= len(tones) else 0)))

    for b_i, ch in enumerate(PROG):
        t_bar = b_i * bar
        tones = CHORDS[ch]
        root = tones[0]
        storm, vamp = b_i in STORM, b_i in VAMP
        # tiptoe bass on every beat (eighths in the vamp, half notes in the storm)
        steps = [(0, root + "2"), (1, tones[2] + "2"), (2, root + "2"), (3, tones[1] + "2")]
        if vamp:
            steps = [(k * 0.5, (root if k % 2 == 0 else tones[2]) + "2") for k in range(8)]
        if storm:
            steps = [(0, root + "2"), (2, tones[2] + "2")]
        for bt, n in steps:
            put(out, t_bar + bt * beat, bass(mf(n), 0.6 if storm else 0.3 if vamp else 0.42, 0.9 if bt in (0, 2) else 0.65), 0.5)
            if not storm:
                put(out, t_bar + bt * beat, pluck(mf(n) * 2, 0.3, 0.5, 0.3), 0.2)
        if not storm and not vamp and b_i >= 1:
            for bt in (1.5, 3.5):
                for n in tones[:3]:
                    put(out, t_bar + bt * beat, pluck(mf(n + "4"), 0.35, 0.45, 0.6), 0.12)
        if not storm and b_i >= 1:
            put(out, t_bar + 1.5 * beat, woodblock(0.35, 1700), 0.06)
            put(out, t_bar + 3.5 * beat, woodblock(0.3, 1450), 0.05)
            for k in range(8):
                put(out, t_bar + k * beat / 2, shaker(0.55 if k % 2 else 0.3), 0.06)
        # melody: marimba, celesta in the happy stretch, slow celesta drops in the storm
        if storm:
            for k, bt in enumerate((0.0, 1.5, 3.0)):
                put(out, t_bar + bt * beat, celesta(mf(tones[k % len(tones)] + "5"), 1.4, 0.5), 0.12)
        elif 1 <= b_i < 20:
            pat = PAT_A if (b_i // 2) % 2 == 0 else PAT_B
            for k, (bt, idx, oc) in enumerate(pat):
                if b_i % 4 == 3 and k == len(pat) - 1:
                    continue
                f = tone(ch, idx, oc - 1)
                vel = 0.75 + 0.25 * rmel.uniform()
                if 12 <= b_i < 20:
                    put(out, t_bar + bt * beat, celesta(f * 2, 1.0, vel), 0.16)
                    put(out, t_bar + bt * beat, marimba(f, 0.6, vel * 0.6), 0.14)
                else:
                    put(out, t_bar + bt * beat, marimba(f, 0.7, vel), 0.3)
        # "Congratulations": a sparkle up the chord
        if b_i == 17:
            for k, n in enumerate(tones * 2):
                put(out, t_bar + k * beat / 2, celesta(mf(n + ("6" if k >= 3 else "5")), 1.1, 0.8), 0.14)
        # the vamp: tiptoe staccato marimba that creeps up and up...
        if vamp:
            for k in range(8):
                n = ["C5", "E5", "G5", "E5", "C5", "E5", "A#5", "G5"][k]
                put(out, t_bar + k * beat / 2, marimba(mf(n) * 2 ** ((b_i - 20) / 12), 0.25, 0.45 + 0.08 * (b_i - 20)), 0.2)
    music = out[:N]
    rev = np.zeros_like(music)
    for dly, g in [(0.031, 0.3), (0.053, 0.25), (0.079, 0.2), (0.113, 0.15), (0.161, 0.11), (0.23, 0.07)]:
        d = int(dly * SR)
        rev[d:] += music[:-d] * g
    music = music + lp(rev, 3500) * 0.55
    t = np.arange(N) / SR
    # fade in; softer in the storm; a dead stop (8 ms, no tail) right before Dad speaks
    shape = np.minimum(t / 0.6, 1)
    shape *= 1 - 0.35 * np.clip((t - T["storm0"]) / 0.5, 0, 1) * np.clip((T["storm3"] - t) / 0.8, 0, 1)
    shape *= np.clip((T["musicStop"] - t) / 0.008, 0, 1)
    return music * shape


# ---------------------------------------------------------------------------
# voice: each line in its slot, levelled, sped up a hair only if it overruns
# ---------------------------------------------------------------------------
NARR_LUFS = -23.0
DAD_LUFS = -22.5
MAX_TEMPO = 1.12


def kweight(x):
    """ITU-R BS.1770 K-weighting (48 kHz)"""
    x = signal.lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585], x, axis=-1)
    return signal.lfilter([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621], x, axis=-1)


def loudness(x):
    """gated integrated loudness (LUFS) of a mono (n,) or stereo (2, n) signal"""
    y = kweight(np.atleast_2d(x))
    n, h = int(0.4 * SR), int(0.1 * SR)
    p = np.array([np.sum(np.mean(y[:, i : i + n] ** 2, axis=1)) for i in range(0, max(1, y.shape[1] - n), h)]) + 1e-12
    p = p[-0.691 + 10 * np.log10(p) > -70]
    p = p[-0.691 + 10 * np.log10(p) > -0.691 + 10 * np.log10(np.mean(p)) - 10]
    return -0.691 + 10 * np.log10(np.mean(p))


def read_audio(path, tempo=1.0):
    af = ["-af", f"atempo={tempo:.4f}"] if abs(tempo - 1.0) > 1e-4 else []
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, *af, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def build_vo():
    lines = {l["id"]: l for l in SCRIPT["lines"]}
    slots = TL["VO"]
    out = np.zeros(N)
    placement = {}
    for k, s in enumerate(slots):
        line = lines[s["id"]]
        path = A("vo", f"{s['id']}.wav")
        y = read_audio(path)
        dur = len(y) / SR
        # room: until the next line starts (and the music stop, for the last narrator line)
        end = slots[k + 1]["at"] - 0.12 if k + 1 < len(slots) else DUR - 0.25
        if s["id"] != "dad" and k + 1 < len(slots) and slots[k + 1]["id"] == "dad":
            end = min(end, T["musicStop"] - 0.12)
        room = end - s["at"]
        tempo = 1.0
        if dur > room:
            tempo = dur / room
            if tempo > MAX_TEMPO:
                print(f"WARNING: {s['id']} is {dur:.2f}s for a {room:.2f}s slot; sped up {MAX_TEMPO}x and still overruns by {dur / MAX_TEMPO - room:.2f}s", file=sys.stderr)
                tempo = MAX_TEMPO
            else:
                print(f"note: {s['id']} is {dur:.2f}s for a {room:.2f}s slot, sped up {tempo:.3f}x", file=sys.stderr)
            y = read_audio(path, tempo)
        y = fade(y, 0.01, 0.03)
        lv = loudness(y)
        g = (DAD_LUFS if line["speaker"] == "dad" else NARR_LUFS) - lv
        y = y * 10 ** (g / 20)
        put(out, s["at"], y)
        placement[s["id"]] = {"at": s["at"], "tempo": round(tempo, 4), "duration": round(len(y) / SR, 3), "gain_db": round(g, 2)}
    json.dump(placement, open(B("vo_placement.json"), "w"), indent=1)
    return hp(out, 80, 2)


# ---------------------------------------------------------------------------
# mix
# ---------------------------------------------------------------------------
def envelope(x, att=0.02, rel=0.35):
    a = np.abs(x)
    ka, kr = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    blk = 256
    m = np.array([a[i : i + blk].max() for i in range(0, len(a), blk)])
    s = np.zeros_like(m)
    v = 0.0
    for i, val in enumerate(m):
        k = ka ** blk if val > v else kr ** blk
        v = val + (v - val) * k
        s[i] = v
    return np.repeat(s, blk)[: len(a)]


def place(track, t0, snd, gain, p):
    i = int(t0 * SR)
    if i >= N or i < 0:
        return
    y = snd[: N - i] * 10 ** (gain / 20)
    p = np.asarray(p, dtype=float)
    if p.ndim:  # a (start, end) sweep across the sound
        p = np.interp(np.linspace(0, 1, len(y)), np.linspace(0, 1, len(p)), p)
    l, r = np.sqrt(0.5 * (1 - p)), np.sqrt(0.5 * (1 + p))
    track[0, i : i + len(y)] += y * l
    track[1, i : i + len(y)] += y * r


TARGET_LUFS, CEILING_DB = -14.0, -1.3


def true_peak_db(st):
    return 20 * np.log10(np.max(np.abs(signal.resample_poly(st, 4, 1, axis=1))) + 1e-12)


def tp_limit(st, look=0.002, rel=0.08):
    """look-ahead peak limiter on 4x-oversampled peaks: holds the true peak under CEILING_DB"""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    ceil = 10 ** (CEILING_DB / 20)
    pk = np.abs(signal.resample_poly(st, 4, 1, axis=1)).max(axis=0)
    pk = pk[: 4 * (len(pk) // 4)].reshape(-1, 4).max(axis=1)
    pk = np.pad(pk, (0, st.shape[1] - len(pk)), mode="edge")
    need = np.minimum(1.0, ceil / (pk + 1e-12))
    if need.min() >= 1.0:
        return st
    L = int(look * SR)
    g = uniform_filter1d(minimum_filter1d(need, 2 * L + 1), L)
    blk = 32
    gb = g[: blk * (len(g) // blk)].reshape(-1, blk).min(axis=1)
    r = np.exp(-blk / (rel * SR))
    out = np.empty_like(gb)
    v = 1.0
    for i, x in enumerate(gb):
        v = min(x, 1 - (1 - v) * r)
        out[i] = v
    g2 = np.minimum(g, np.pad(np.repeat(out, blk), (0, len(g) - blk * len(out)), constant_values=1.0))
    return st * g2


def write_wav(path, st, subtype="FLOAT"):
    sf.write(path, np.clip(st.T, -1, 1).astype(np.float32), SR, subtype=subtype)


def main():
    os.makedirs(B("audio"), exist_ok=True)
    vo = build_vo()
    build_cues()
    sfx_bus, hits = np.zeros((2, N)), np.zeros((2, N))
    for t0, snd, g, p, ducked in CUES:
        place(sfx_bus if ducked else hits, t0, snd, g, p)
    sfx_bus = np.stack([hp(ch, 50, 2) for ch in sfx_bus])
    hits = np.stack([hp(ch, 50, 2) for ch in hits])
    music = build_music()
    music = music / (np.max(np.abs(music)) + 1e-9) * 0.5
    mus_st = np.stack([music * 0.62 + np.roll(music, 240) * 0.1, music * 0.62 + np.roll(music, 480) * 0.1])
    # evening ambience (birds, a breeze); the rain bed replaces it in the storm; after
    # the music stops only a faint breeze is left under Dad's line
    t = np.arange(N) / SR
    amb = birds(DUR)[:, :N]
    rainK = np.clip((t - T["rain0"]) / 0.4, 0, 1) * np.clip((T["rain1"] + 0.7 - t) / 0.7, 0, 1)
    amb *= np.minimum(t / 1.5, 1) * (1 - rainK) * (1 - 0.7 * np.clip((t - T["musicStop"]) / 0.05, 0, 1)) * 0.06
    rain = s_rain(T["rain1"] - T["rain0"] + 1.0)
    rain_bed = np.zeros((2, N))
    i0 = int(T["rain0"] * SR)
    rain_bed[:, i0 : i0 + rain.shape[1]] = rain[:, : N - i0]
    amb = amb + rain_bed * rainK * 0.14
    e = envelope(vo)
    talk = np.clip(e / 0.12, 0, 1)
    duck_mus = 1 - 0.62 * talk
    duck_sfx = 1 - 0.38 * talk
    duck_amb = 1 - 0.5 * talk
    stems = {
        "vo": np.stack([vo, vo]),
        "sfx": sfx_bus * 0.65 * duck_sfx + hits * 0.65,
        "music": mus_st * 0.6 * duck_mus,
        "ambience": amb * duck_amb,
    }
    mix = sum(stems.values())
    mix = np.stack([hp(ch, 32, 2) for ch in mix])
    mix = np.tanh(mix * 1.1) / 1.1
    for name, arr in [*stems.items(), ("mix_raw", mix)]:
        write_wav(B("audio", f"{name}.wav"), arr)
    out = mix * 10 ** ((TARGET_LUFS - loudness(mix)) / 20)
    for _ in range(3):  # limiting takes a hair of loudness off: re-gain and re-limit
        out = tp_limit(out)
        out *= 10 ** ((TARGET_LUFS - loudness(out)) / 20)
    out = tp_limit(out)
    out[:, -int(0.06 * SR):] *= np.linspace(1, 0, int(0.06 * SR))  # no click at the last frame
    write_wav(B("mix.wav"), out, "PCM_24")
    print("wrote", B("mix.wav"), f"({len(CUES)} sound cues, {loudness(out):.2f} LUFS, true peak {true_peak_db(out):.2f} dBTP)")


if __name__ == "__main__":
    main()
