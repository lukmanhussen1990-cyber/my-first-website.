#!/usr/bin/env python3
"""Sound effects for the reel, synthesized in numpy (no music) and placed from src/timeline.json.

Writes final/stems/sfx.wav (48 kHz stereo float). Every sound is deterministic (seeded).
Event times follow the same rules as src/shots.js (scene-local word times).
"""
import json, os, re
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
TL = json.load(open(os.path.join(ROOT, 'src', 'timeline.json')))
DUR = TL['duration']
N = int(round(DUR * SR))
RNG = np.random.default_rng(1950)

out = np.zeros((N, 2))      # dry bus
rev = np.zeros((N, 2))      # send to the "ice crevasse" reverb


def t2i(t):
    return int(round(t * SR))


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype='low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype='high', fs=SR, output='sos'), x)


def noise(n, seed=None):
    r = np.random.default_rng(seed) if seed is not None else RNG
    return r.standard_normal(n)


def env_adsr(n, a, d, s, r, sl=0.6):
    e = np.zeros(n)
    ia, idd, ir = int(a * SR), int(d * SR), int(r * SR)
    isus = max(0, n - ia - idd - ir)
    seg = [np.linspace(0, 1, max(ia, 1)), np.linspace(1, sl, max(idd, 1)), np.full(isus, sl), np.linspace(sl, 0, max(ir, 1))]
    e = np.concatenate(seg)[:n]
    return np.pad(e, (0, n - len(e)))


def expdecay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def place(x, t, gain=1.0, pan=0.0, send=0.0):
    """Add mono/stereo sound x at time t (s). pan -1..1, send = reverb amount."""
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l, x * r], axis=1) * np.sqrt(2)
    i0 = t2i(t)
    if i0 >= N:
        return
    j0 = max(0, -i0)
    i0 = max(0, i0)
    i1 = min(N, i0 + len(x) - j0)
    out[i0:i1] += x[j0:j0 + i1 - i0] * gain
    if send > 0:
        rev[i0:i1] += x[j0:j0 + i1 - i0] * gain * send


def bed(x, t0, t1, gain=1.0, fade=0.4, send=0.0):
    """Place a looping ambience between t0 and t1 with fades."""
    n = t2i(t1) - t2i(t0)
    if n <= 0:
        return
    reps = int(np.ceil(n / len(x)))
    y = np.concatenate([x] * reps, axis=0)[:n]
    f = min(t2i(fade), n // 2)
    e = np.ones(n)
    if f > 0:
        e[:f] = np.linspace(0, 1, f)
        e[-f:] = np.linspace(1, 0, f)
    if y.ndim == 1:
        y = np.stack([y, y], axis=1)
    place(y * e[:, None], t0, gain, send=send)


# ------------------------------------------------------------------ sound designs
def wind(dur, strength=1.0, seed=1, howl=True):
    n = int(dur * SR)
    t = np.arange(n) / SR
    base = noise(n, seed)
    gust = 0.55 + 0.45 * np.sin(2 * np.pi * 0.11 * t + 1.3) * np.sin(2 * np.pi * 0.037 * t + 0.4)
    body = lp(base, 700) * 0.6 + bp(base, 250, 1400) * 0.5
    y = body * gust
    if howl:
        # resonant whistle whose pitch wanders with the gusts
        f = 420 + 260 * np.sin(2 * np.pi * 0.07 * t + 2.0) + 90 * np.sin(2 * np.pi * 0.23 * t)
        ph = 2 * np.pi * np.cumsum(f) / SR
        wh = bp(noise(n, seed + 7), 300, 1200) * (0.5 + 0.5 * np.sin(ph)) * gust ** 2
        y += wh * 0.35
    st = np.stack([y, np.roll(lp(noise(n, seed + 3), 600) * gust, 2000) * 0.5 + y * 0.7], axis=1)
    return st * strength * 0.25


def deep_air(dur, seed=2):
    """muffled wind far above + low rumble of the crevasse"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = lp(noise(n, seed), 220, 3) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.05 * t))
    y += lp(noise(n, seed + 1), 60, 2) * 0.8
    return np.stack([y, np.roll(y, 900)], axis=1) * 0.35


def drip(seed):
    r = np.random.default_rng(seed)
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    f0 = r.uniform(1400, 2600)
    f = f0 * (1 + 0.8 * np.exp(-t * 60))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * expdecay(n, 0.035)
    return y * 0.5


def creak(dur, seed, f0=180):
    """stick-slip ice creak: resonant pulse train with wandering rate"""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    rate = 35 + 25 * np.sin(np.pi * t / dur) + r.uniform(-5, 5)
    ph = np.cumsum(rate) / SR
    pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(float)
    pulses *= 0.6 + 0.4 * r.random(n)
    y = bp(pulses, f0 * 0.7, f0 * 3.5, 2) + bp(pulses, f0 * 5, f0 * 9, 2) * 0.3
    return y * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7 * 2.5


def groan(dur, seed, f0=55):
    """deep ice groan: low bent tone + friction noise"""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (1 + 0.25 * np.sin(np.pi * t / dur) + 0.08 * np.sin(2 * np.pi * 0.7 * t + r.uniform(0, 6)))
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.5 * np.sin(2 * ph + 0.3) + 0.25 * np.sin(3.01 * ph)
    fr = bp(noise(n, seed), f0 * 2, f0 * 12) * (0.5 + 0.5 * np.sin(ph * 0.5))
    y = tone * 0.6 + fr * 0.8
    return lp(y, 900) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.2 * 0.8


def breath_cycle(seed, shaky=1.0, period=3.2):
    """one inhale + exhale, shaky"""
    r = np.random.default_rng(seed)
    n = int(period * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for (t0, d, lo, hi, g) in [(0.05, 0.9, 700, 3200, 0.5), (1.1, 1.3, 400, 2400, 0.8)]:
        i0, m = int(t0 * SR), int(d * SR)
        m = min(m, n - i0)
        if m <= 0:
            continue
        e = np.sin(np.pi * np.linspace(0, 1, m)) ** 1.5
        trem = 1 + shaky * 0.35 * np.sin(2 * np.pi * r.uniform(7, 11) * np.arange(m) / SR) * r.uniform(0.5, 1)
        y[i0:i0 + m] += bp(noise(m, seed + int(t0 * 10)), lo, hi) * e * trem * g
    return y * 0.35


def click(seed=0, f=2800):
    n = int(0.05 * SR)
    y = np.zeros(n)
    for k, (t0, g) in enumerate([(0.0, 1.0), (0.018, 0.6)]):
        i = int(t0 * SR)
        m = int(0.012 * SR)
        y[i:i + m] += bp(noise(m, seed + k), f * 0.6, f * 1.8) * expdecay(m, 0.002) * g
    return y * 1.2


def buzz(dur, seed=3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * 50 * h * t) / h for h in range(1, 12)) * 0.3
    y += bp(noise(n, seed), 2000, 6000) * 0.15
    return y


def heartbeat(seed=0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for t0, g in [(0.0, 1.0), (0.17, 0.7)]:
        i = int(t0 * SR)
        m = n - i
        tt = np.arange(m) / SR
        y[i:] += np.sin(2 * np.pi * (48 + 25 * np.exp(-tt * 25)) * tt) * np.exp(-tt * 18) * g
    return lp(y, 160) * 1.4


def crackle(dur, density, seed, lo=2500, hi=9000):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    y = np.zeros(n)
    k = int(density * dur)
    for _ in range(k):
        i = r.integers(0, max(1, n - 400))
        m = r.integers(60, 400)
        y[i:i + m] += noise(m, int(r.integers(1e6))) * expdecay(m, r.uniform(0.0004, 0.002)) * r.uniform(0.3, 1)
    return bp(y, lo, hi, 2)


def bass_hit(seed=0, big=1.0):
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    f = 30 + 45 * np.exp(-t * 7)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.4)
    boom = lp(noise(n, seed), 260, 2) * np.exp(-t * 6) * 1.2
    hit = bp(noise(n, seed + 1), 80, 2000) * np.exp(-t * 28) * 0.8
    y = (sub * 1.2 + boom + hit) * big
    return np.tanh(y * 1.3) * 0.9


def riser(dur, seed=0):
    """reverse-swell into a hit"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = (t / dur) ** 3
    y = bp(noise(n, seed), 300, 6000) * k * 0.6 + np.sin(2 * np.pi * (60 + 200 * k) * t) * k * 0.2
    return y


def ice_crack(seed=0, size=1.0):
    """sharp broadband crack + crackle tail + low thump"""
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    tr = noise(n, seed) * np.exp(-t * 90) * 1.5
    tail = crackle(1.6, 380 * size, seed + 5, 1500, 9000)[:n] * np.exp(-t * 3.5) * 1.4
    thump = np.sin(2 * np.pi * (70 + 60 * np.exp(-t * 30)) * t) * np.exp(-t * 9) * 0.9 * size
    body = bp(noise(n, seed + 2), 300, 3000) * np.exp(-t * 14) * 0.9
    return np.tanh((tr + tail + thump + body) * 1.2)


def thud(seed=0):
    n = int(1.0 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * (45 + 70 * np.exp(-t * 25)) * t) * np.exp(-t * 7) * 1.4
    y += lp(noise(n, seed), 500) * np.exp(-t * 12) * 1.2
    y += bp(noise(n, seed + 1), 1500, 7000) * np.exp(-t * 30) * 0.6  # snow crunch
    return np.tanh(y)


def crunch_step(seed):
    r = np.random.default_rng(seed)
    n = int(0.18 * SR)
    y = crackle(0.18, 900, seed, 1200, 7000) * np.exp(-np.arange(n) / (0.06 * SR))
    y += lp(noise(n, seed + 1), 400) * np.exp(-np.arange(n) / (0.03 * SR)) * 0.5
    return y * r.uniform(0.7, 1.0) * 0.8


def rush(dur, seed=4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = np.clip(t / dur, 0, 1)
    y = np.zeros(n)
    blocks = 40
    for b in range(blocks):
        i0, i1 = b * n // blocks, (b + 1) * n // blocks
        f = 400 + 2600 * (b / blocks) ** 1.5
        seg = bp(noise(i1 - i0 + 2000, seed + b), f * 0.5, min(f * 2.5, 20000))[1000:1000 + i1 - i0]
        y[i0:i1] = seg
    return y * (0.2 + 0.8 * k ** 1.5) * 0.9


def shout(seed=0):
    """short 'ah!' of surprise: glottal pulse source through vowel formants"""
    n = int(0.55 * SR)
    t = np.arange(n) / SR
    f0 = 210 - 60 * t / 0.55 + 6 * np.sin(2 * np.pi * 6 * t)
    ph = np.cumsum(f0) / SR
    src = (ph % 1.0) * 2 - 1
    src = src - np.convolve(src, np.ones(8) / 8, mode='same') * 0.5
    y = bp(src, 650, 950, 2) * 1.0 + bp(src, 1050, 1350, 2) * 0.7 + bp(src, 2400, 2900, 2) * 0.35
    y += bp(noise(n, seed), 1000, 4000) * 0.15
    e = env_adsr(n, 0.02, 0.08, 0.35, 0.4, 0.75)
    return np.tanh(y * e * 3) * 0.5


def static(dur, seed=5):
    n = int(dur * SR)
    y = bp(noise(n, seed), 800, 5000) * 0.5 + crackle(dur, 300, seed + 1, 2000, 8000) * 0.8
    return y


def beep(f=1250, dur=0.09):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t) * env_adsr(n, 0.004, 0.01, 0.8, 0.02, 0.9) * 0.4


def flap(dur, seed=6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    am = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * (6 + 3 * np.sin(2 * np.pi * 0.4 * t)) * t)) * np.abs(np.sin(2 * np.pi * 0.3 * t))
    y = bp(noise(n, seed), 120, 1500) * am
    return lp(y, 2000) * 0.6


def motor(dur, seed=7):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 95 + 6 * np.sin(2 * np.pi * 0.8 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = sum(np.sin(h * ph) / h for h in range(1, 14)) * 0.25
    y += np.sin(2 * np.pi * 1180 * t + 0.2 * np.sin(ph)) * 0.05   # gear whine
    y += bp(noise(n, seed), 200, 2000) * 0.12
    return y


def metal_click(seed=0):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in [(3150, 40), (4720, 55), (6880, 70), (2300, 35)]) * 0.25
    y += bp(noise(n, seed), 3000, 9000) * np.exp(-t * 200) * 0.8
    return y


def rustle(dur, seed=8, lo=1500, hi=9000):
    n = int(dur * SR)
    return crackle(dur, 1400, seed, lo, hi) * np.sin(np.pi * np.linspace(0, 1, n)) * 0.6


def drone(dur, seed=9):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * f * t + p) for f, p in [(41.2, 0), (43.65, 1), (61.7, 2), (87.3, 3), (92.5, 4)]) * 0.2
    y += lp(noise(n, seed), 120) * 0.4
    return y * (t / dur) ** 1.5


def make_reverb_ir(dur=2.4, seed=11):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for c in range(2):
        x = noise(n, seed + c) * np.exp(-t / 0.55)
        x = lp(x, 5500) * 0.7 + bp(x, 200, 1200) * 0.5
        ir[:, c] = x
    for d, g in [(0.031, 0.5), (0.047, 0.4), (0.083, 0.35), (0.121, 0.25)]:   # flutter between the ice walls
        ir[int(d * SR), :] += g
    ir /= np.sqrt((ir ** 2).sum(axis=0, keepdims=True))
    return ir


# ------------------------------------------------------------------ timeline helpers
SC = {s['id']: s for s in TL['scenes']}


def norm(w):
    return re.sub(r'[^a-z0-9]', '', w.lower())


def word(sid, w, nth=0, default=None):
    s = SC[sid]
    k = 0
    for l in s['lines']:
        for x in l['words']:
            if norm(x['w']) == norm(w):
                if k == nth:
                    return x['s']
                k += 1
    return default


def S(sid):
    return SC[sid]['start']


def E(sid):
    return SC[sid]['end']


def L(sid, i):
    return SC[sid]['lines'][i]


def main():
    # ===== beds
    # scene 1: surface night wind for the wide shot, crossfading into the crevasse as we descend
    bed(wind(14, 0.6, seed=1), S(1), S(1) + 6.0, gain=0.9, fade=0.6)
    bed(deep_air(14, 2), S(1) + 4.0, E(1) - 0.7, gain=1.0, fade=1.5)
    # scene 2: sunset wind + footsteps
    bed(wind(14, 0.7, seed=3), S(2), S(2) + word(2, 'broke', default=17.5) - S(2) + 0.4, gain=0.8, fade=0.3)
    bed(deep_air(14, 4), S(2) + 6.0, E(2), gain=0.9, fade=1.0)
    # scene 3: storm
    bed(wind(8, 1.0, seed=5), S(3), E(3), gain=1.0, fade=0.3)
    storm = wind(8, 1.6, seed=6)
    k = np.clip((np.arange(len(storm)) / SR - 1.6) / 2.8, 0, 1)[:, None]
    place(storm * k, S(3), 1.0)
    # crack scenes: deep air
    for sid in (4, 5, 6, 7):
        bed(deep_air(12, 10 + sid), S(sid), E(sid), gain=0.85, fade=0.25)
    bed(wind(8, 0.5, seed=9), S(8), S(8) + 2.0, gain=0.6, fade=0.3)
    bed(deep_air(10, 18), S(8) + 1.6, E(9), gain=0.8, fade=0.6)
    bed(wind(16, 0.45, seed=10), S(10), E(10), gain=0.7, fade=0.4)
    bed(deep_air(4, 19), S(11), S(11) + 0.4, gain=0.6, fade=0.15)

    # ===== scene 1 — hook
    hit1 = L(1, 3)['hit']
    for i, t in enumerate([5.5, 7.4, 9.6]):
        place(drip(100 + i), S(1) + t, 0.35, pan=0.3, send=0.6)
    place(groan(3.0, 21, 50), S(1) + 6.2, 0.55, send=0.5)
    place(creak(1.3, 22, 160), S(1) + 9.0, 0.35, pan=0.5, send=0.5)
    for k2 in range(3):
        place(breath_cycle(30 + k2, 0.6, 3.4), S(1) + 6.4 + k2 * 3.4, 0.35, pan=-0.2)
    place(riser(0.7, 1), hit1 - 0.7, 0.5)
    place(bass_hit(1, 1.1), hit1, 1.0, send=0.4)
    place(ice_crack(2, 0.7), hit1, 0.55, send=0.5)

    # ===== scene 2 — the fall
    tB = word(2, 'broke', default=S(2) + 5.4) - 0.05
    tL = word(2, 'ledge', default=S(2) + 8.3)
    tR = word(2, 'radio', default=S(2) + 11) - 0.15
    phase_step = np.pi / 7.2
    t = S(2) + 0.2
    i = 0
    while t < tB - 0.05:
        place(crunch_step(200 + i), t, 0.55, pan=-0.1 + 0.2 * (i % 2))
        t += phase_step
        i += 1
    place(ice_crack(3, 0.8), tB - 0.25, 0.7, send=0.3)
    place(crackle(0.6, 500, 31, 1500, 8000), tB - 0.2, 0.6)
    place(thud(32), tB + 0.05, 0.6)
    place(shout(33), tB + 0.1, 0.7, send=0.4)
    place(rush(max(0.5, tL - tB - 0.1), 34), tB + 0.12, 0.8)
    for k2 in range(9):
        place(thud(40 + k2) * 0.3, tB + 0.6 + k2 * 0.31, 0.25, pan=RNG.uniform(-0.6, 0.6), send=0.4)
    place(thud(50), tL, 1.2, send=0.5)
    place(ice_crack(51, 0.5), tL + 0.02, 0.4, send=0.5)
    place(bass_hit(52, 0.55), tL, 0.6)
    place(groan(1.6, 53, 70), tL + 0.4, 0.4, send=0.6)
    for k2 in range(2):
        place(breath_cycle(60 + k2, 1.2, 1.6), tL + 1.0 + k2 * 1.6, 0.4)
    st = static(1.6, 61)
    st *= np.clip(1 - np.linspace(0, 1, len(st)) ** 0.8, 0, 1) * (np.random.default_rng(62).random(len(st)) > 0.04)
    place(st, tR, 0.45)

    # ===== scene 3 — storm
    for k2, tt in enumerate([0.4, 0.75, 1.9]):
        place(beep(1250 if k2 < 2 else 900), S(3) + tt, 0.6, pan=0.2)
    place(static(1.4, 70) * 0.5, S(3) + 0.9, 0.3, pan=0.2)
    place(flap(E(3) - S(3) - 1.0, 71), S(3) + 1.0, 0.8)

    # ===== scene 4 — day 1
    tClick = word(4, 'on', default=S(4) + 1.4)
    place(click(80), tClick, 1.0, send=0.3)
    place(groan(2.6, 81, 46), S(4) + 3.2, 0.45, send=0.6)
    place(drip(82), S(4) + 2.4, 0.35, pan=0.4, send=0.6)
    place(drip(83), S(4) + 7.1, 0.3, pan=-0.3, send=0.6)
    place(creak(1.0, 84, 210), word(4, 'man', default=S(4) + 6) + 0.2, 0.35, send=0.5)
    for k2 in range(3):
        place(breath_cycle(85 + k2, 0.8, 3.0), S(4) + 0.3 + k2 * 3.0, 0.35)

    # ===== scene 5 — day 2
    t5 = L(5, 1)['start']
    place(breath_cycle(90, 1.4, 1.4), t5 - 0.6, 0.55)
    place(thud(91) * 0.4, t5 - 0.4, 0.4, send=0.3)   # pushes back against the ice
    place(creak(1.4, 92, 140), t5 + 0.3, 0.45, send=0.6)
    place(groan(2.5, 93, 40), t5 + 0.8, 0.4, send=0.6)

    # ===== scene 6 — day 3: flicker buzz, heartbeat speeding up, bass hit on "open"
    hit6 = L(6, 2)['hit']
    tFl = word(6, 'flicker', default=S(6) + 1.9)
    s6 = S(6)
    flashes = [(0.0, tFl - s6 - 0.05), (tFl - s6 + 0.05, 0.12), (tFl - s6 + 0.32, 0.08),
               (L(6, 1)['start'] - s6 + 0.2, 0.55), (L(6, 1)['start'] - s6 + 1.05, 0.22), (L(6, 1)['start'] - s6 + 1.45, 0.1),
               (L(6, 2)['start'] - s6 - 0.05, 0.42), (L(6, 2)['start'] - s6 + 0.62, 0.18), (L(6, 2)['start'] - s6 + 0.98, 0.08)]
    for k2, (a, d) in enumerate(flashes):
        if k2 == 0:
            continue
        place(buzz(d, 100 + k2), s6 + a, 0.18)
        place(click(110 + k2, 3500) * 0.6, s6 + a, 0.5)
        place(click(130 + k2, 2500) * 0.4, s6 + a + d, 0.4)
    place(buzz(E(6) - hit6, 140), hit6, 0.12)
    # heartbeat from scene 6 into scene 7, getting faster
    tt = S(6) + 0.5
    tEnd = L(7, 3)['start'] - 0.4
    while tt < tEnd:
        prog = (tt - S(6)) / (tEnd - S(6))
        bpm = 62 + 70 * prog ** 1.3
        place(heartbeat(), tt, 0.55 + 0.3 * prog)
        tt += 60.0 / bpm
    place(riser(0.8, 141), hit6 - 0.8, 0.55)
    place(bass_hit(142, 1.15), hit6, 1.05, send=0.4)
    place(ice_crack(143, 0.5), hit6 + 0.02, 0.35, send=0.5)

    # ===== scene 7 — day 4: crackles as the cracks spread; light + voice from above
    t2 = L(7, 1)['start']
    tIns = word(7, 'inside', default=L(7, 2)['start'])
    place(crackle(tIns - t2 + 0.8, 160, 150, 2500, 10000), t2 + 0.4, 0.55, send=0.4)
    place(crackle(0.5, 600, 151, 2000, 9000), tIns, 0.6, send=0.5)
    place(creak(1.8, 152, 120), t2 + 1.0, 0.4, send=0.6)
    tLight = L(7, 3)['start'] - 0.45
    n = int(2.5 * SR)
    air = bp(noise(n, 153), 300, 5000) * np.sin(np.pi * np.linspace(0, 1, n) * 0.5) * 0.25
    place(air, tLight, 0.6, send=0.5)

    # ===== scene 8 — rescue: winch, rope creak, carabiner
    tDown = L(8, 1)['start'] - 0.1
    tClip = word(8, 'clipped', default=S(8) + 3.4)
    tRise = word(8, 'rise', default=S(8) + 5.6)
    place(motor(tClip - tDown, 160) * env_adsr(int((tClip - tDown) * SR), 0.3, 0.1, 0.9, 0.3, 0.9)[:, None].T[0], tDown, 0.45)
    place(creak(1.2, 161, 260), tDown + 0.8, 0.35, send=0.4)
    place(metal_click(162), tClip - 0.05, 0.9, send=0.3)
    place(metal_click(163), tClip + 0.18, 0.7, send=0.3)
    m2 = motor(E(9) - tRise + 0.2, 164)
    m2 *= env_adsr(len(m2), 0.4, 0.1, 0.9, 1.5, 0.9)
    place(m2, tRise - 0.2, 0.4, send=0.2)
    for k2 in range(5):
        place(creak(0.8, 170 + k2, 230 + 20 * k2), tRise + 0.4 + k2 * 1.9, 0.3, send=0.5)

    # ===== scene 9 — reveal: drone swell + bass hit on "dozens" + smaller hit on "up"
    tDoz = word(9, 'dozens', default=S(9) + 4.0)
    tUp = word(9, 'up', default=S(9) + 9.0)
    place(drone(tDoz - S(9) + 0.2, 180), S(9), 0.7)
    place(riser(0.9, 181), tDoz - 0.9, 0.55)
    place(bass_hit(182, 1.1), tDoz, 1.0, send=0.4)
    place(drone(E(9) - tDoz, 183)[::-1] * 0.8, tDoz, 0.5)
    place(bass_hit(184, 0.6), tUp, 0.6, send=0.4)
    place(groan(3.5, 185, 38), tDoz + 1.5, 0.5, send=0.6)

    # ===== scene 10 — safe: foil crinkle, page rustle, "No. 32" flicker blips
    place(rustle(1.4, 190, 3000, 12000), S(10) + 0.7, 0.5)
    place(rustle(0.9, 191, 1200, 7000), L(10, 1)['start'] + 0.5, 0.45)
    t32 = word(10, '32', default=L(10, 4)['start'] + 1.4)
    for d in (0.35, 0.6):
        place(buzz(0.07, 192) * 0.5, t32 + d, 0.25)

    # ===== scene 11 — empty ledge, 1 s total silence, then the loudest crack
    s11 = S(11)
    tCrack = s11 + 1.4
    place(ice_crack(200, 1.6), tCrack, 2.2, send=0.6)
    place(bass_hit(201, 1.4), tCrack, 1.4, send=0.5)
    place(crackle(1.8, 500, 202, 3000, 12000) * np.exp(-np.arange(int(1.8 * SR)) / (0.6 * SR)), tCrack + 0.05, 0.9, send=0.5)  # ice chips
    place(creak(1.6, 203, 90), tCrack + 0.5, 0.6, send=0.6)   # fingers curling
    # hard cut to black at +3.3s: kill everything after the cut except a short reverb tail of the crack
    cut = t2i(s11 + 3.3)

    # ===== reverb + final assembly
    ir = make_reverb_ir()
    wet = np.stack([fftconvolve(rev[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
    mix = out + wet * 0.55
    # total silence before the final crack (scene 11, 0.4 .. 1.4 s)
    a, b = t2i(s11 + 0.4), t2i(tCrack)
    fade = t2i(0.08)
    mix[a - fade:a] *= np.linspace(1, 0, fade)[:, None]
    mix[a:b] = 0
    mix[cut:] *= np.exp(-np.arange(N - cut) / (0.35 * SR))[:, None]
    peak = np.abs(mix).max()
    mix = mix / max(peak, 1e-9) * 0.89
    path = os.path.join(ROOT, 'final', 'stems', 'sfx.wav')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sf.write(path, mix.astype(np.float32), SR, subtype='FLOAT')
    print(f'sfx stem written: {path} ({DUR:.2f}s, peak normalised)')


if __name__ == '__main__':
    main()
