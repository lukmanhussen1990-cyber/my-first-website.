#!/usr/bin/env python3
"""Sound track for "How BIG is Jannah?" — synthesized from scratch with numpy only.

No samples, no music, no voice, no bells. Every sound is made from sine waves and
shaped noise, and every cue is read from build/cues.json, which index.html exports
from the same timeline that draws the pictures, so sound and picture stay in sync.

    python3 make_audio.py [build/cues.json] [build/audio.wav]

Output: 48 kHz stereo 32-bit float WAV, integrated loudness -14 LUFS, true peak <= -1 dBTP.
"""
import json
import struct
import sys

import numpy as np

SR = 48000
TARGET_LUFS = -14.0
PEAK_DBTP = -1.0
SEED = 20261020

cues_path = sys.argv[1] if len(sys.argv) > 1 else 'build/cues.json'
out_path = sys.argv[2] if len(sys.argv) > 2 else 'build/audio.wav'
CUES = json.load(open(cues_path))
DUR = float(CUES['duration'])
N = int(round(DUR * SR))
EV = CUES['ev']
rng = np.random.default_rng(SEED)


def db(x):
    return 10.0 ** (x / 20.0)


def tt(n):
    return np.arange(n) / SR


def ns(seconds):
    return int(round(seconds * SR))


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def ramp_env(n, attack, release, shape=2.0):
    """Smooth attack/release envelope (seconds) so nothing ever clicks."""
    t = tt(n)
    a = smoothstep(t / max(attack, 1e-4)) if attack > 0 else np.ones(n)
    r = smoothstep((t[-1] - t) / max(release, 1e-4)) if release > 0 else np.ones(n)
    return (a * r) ** (shape / 2.0)


def swell_env(n, peak_at, rise_pow=1.6, fall_pow=1.3):
    """0 → 1 at peak_at (s) → 0 at the end, with soft curves."""
    t = tt(n)
    p = np.where(t < peak_at, (t / max(peak_at, 1e-4)) ** rise_pow,
                 (np.clip(1 - (t - peak_at) / max(t[-1] - peak_at, 1e-4), 0, 1)) ** fall_pow)
    return np.sin(p * np.pi / 2) ** 2


def as_fn(v):
    return v if callable(v) else (lambda t, v=v: np.full_like(t, float(v)))


def spectral_noise(dur, fc, bw_oct, gain=1.0, nfft=2048, seed=None, tilt=0.0):
    """Noise synthesized frame by frame in the frequency domain: a gaussian band
    (in octaves) around a centre frequency. fc, bw_oct and gain may be functions of t.
    Returns a mono array normalized to RMS 1 (before the gain curve)."""
    r = np.random.default_rng(seed if seed is not None else rng.integers(1 << 30))
    n = ns(dur)
    hop = nfft // 4
    frames = n // hop + 4
    tf = (np.arange(frames) * hop - nfft / 2) / SR
    freqs = np.fft.rfftfreq(nfft, 1 / SR)
    lf = np.log2(np.maximum(freqs, 1.0))
    fcv = np.maximum(as_fn(fc)(tf), 10.0)[:, None]
    bwv = np.maximum(as_fn(bw_oct)(tf), 0.05)[:, None]
    mask = np.exp(-0.5 * ((lf[None, :] - np.log2(fcv)) / (bwv / 2.0)) ** 2)
    if tilt:
        mask *= (np.maximum(freqs, 20.0)[None, :] / 1000.0) ** tilt
    spec = (r.standard_normal(mask.shape) + 1j * r.standard_normal(mask.shape)) * mask
    spec[:, 0] = 0
    win = np.hanning(nfft)
    blocks = np.fft.irfft(spec, nfft, axis=1) * win[None, :]
    out = np.zeros(frames * hop + nfft)
    for i in range(frames):
        out[i * hop:i * hop + nfft] += blocks[i]
    out = out[nfft // 2: nfft // 2 + n]
    out /= np.sqrt(np.mean(out ** 2)) + 1e-12
    g = as_fn(gain)(tt(n))
    return out * g


def osc(freq, phase0=0.0):
    """Sine with an arbitrary frequency curve (array, Hz)."""
    return np.sin(phase0 + 2 * np.pi * np.cumsum(freq) / SR)


def fft_filter(x, lo=None, hi=None, order=2):
    """Zero-phase Butterworth-shaped high/low pass applied in the frequency domain."""
    n = len(x)
    nfft = 1 << int(np.ceil(np.log2(n + SR // 4)))
    X = np.fft.rfft(x, nfft)
    f = np.fft.rfftfreq(nfft, 1 / SR)
    H = np.ones_like(f)
    if lo:
        H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    if hi:
        H *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    return np.fft.irfft(X * H, nfft)[:n]


def fft_convolve(a, b):
    n = len(a) + len(b) - 1
    nfft = 1 << int(np.ceil(np.log2(n)))
    return np.fft.irfft(np.fft.rfft(a, nfft) * np.fft.rfft(b, nfft), nfft)[:n]


def peak_norm(x, peak_db):
    return x * (db(peak_db) / (np.max(np.abs(x)) + 1e-12))


def rms_norm(x, rms_db):
    return x * (db(rms_db) / (np.sqrt(np.mean(x ** 2)) + 1e-12))


class Mix:
    """A named stereo stem; sounds are placed at absolute times with constant-power panning."""
    def __init__(self, name):
        self.name = name
        self.buf = np.zeros((2, N))

    def add(self, x, t0, pan=0.0, xr=None):
        i0 = int(round(t0 * SR))
        if xr is None:
            a = (pan + 1) * np.pi / 4
            xl, xr = x * np.cos(a) * np.sqrt(2), x * np.sin(a) * np.sqrt(2)
        else:
            xl = x
        n = len(xl)
        s0, s1 = max(0, i0), min(N, i0 + n)
        if s1 <= s0:
            return
        self.buf[0, s0:s1] += xl[s0 - i0:s1 - i0]
        self.buf[1, s0:s1] += xr[s0 - i0:s1 - i0]


# ----------------------------------------------------------------------------- sounds
def bed():
    """Warm drone: 55 Hz + 82 Hz + a very quiet 165 Hz, slowly breathing, plus faint filtered air."""
    t = tt(N)
    breath = 0.74 + 0.26 * np.sin(2 * np.pi * 0.085 * t - np.pi / 2) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.031 * t))
    # main partials nearly in phase on both sides (safe on mono phone speakers); faint detuned twins add width
    left = (np.sin(2 * np.pi * 55.0 * t) + 0.62 * np.sin(2 * np.pi * 82.41 * t + 0.3) + 0.1 * np.sin(2 * np.pi * 165.0 * t + 1.1)
            + 0.16 * np.sin(2 * np.pi * 55.13 * t + 1.7) + 0.1 * np.sin(2 * np.pi * 82.3 * t + 2.2))
    right = (np.sin(2 * np.pi * 55.0 * t + 0.15) + 0.62 * np.sin(2 * np.pi * 82.41 * t + 0.42) + 0.1 * np.sin(2 * np.pi * 165.0 * t + 1.25)
             + 0.16 * np.sin(2 * np.pi * 54.88 * t + 0.4) + 0.1 * np.sin(2 * np.pi * 82.55 * t + 0.9))
    air_gain = lambda tq: 0.8 + 0.2 * np.sin(2 * np.pi * 0.05 * tq + 1.0)
    air_l = spectral_noise(DUR, 1700, 1.8, air_gain, seed=11)
    air_r = spectral_noise(DUR, 1700, 1.8, air_gain, seed=12)
    drone = np.stack([left, right]) * breath
    drone = rms_norm(drone, -27.0)
    air = rms_norm(np.stack([air_l, air_r]), -40.0)
    out = drone + air
    env = smoothstep(t / 0.5) * smoothstep((DUR - t) / 2.0)
    return out * env


def whoosh(dur=1.15, peak_at=0.72, f=(260, 2600, 520), bw=1.0, seed=None):
    def fc(tq):
        p = np.clip(tq / dur, 0, 1)
        k = peak_at / dur
        a = np.where(p < k, p / k, 1 + (p - k) / (1 - k))
        lo, mid, hi = np.log2(f[0]), np.log2(f[1]), np.log2(f[2])
        return 2 ** np.where(a < 1, lo + (mid - lo) * smoothstep(a), mid + (hi - mid) * smoothstep(a - 1))
    x = spectral_noise(dur, fc, bw, 1.0, nfft=1024, seed=seed)
    return x * swell_env(len(x), peak_at, 2.0, 1.4)


def tick(r):
    n = int(0.016 * SR)
    t = tt(n)
    f = 3000 * (0.85 + 0.3 * r.random())
    body = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.0022) + 0.5 * np.sin(2 * np.pi * 950 * t) * np.exp(-t / 0.003)
    grit = fft_filter(r.standard_normal(n), lo=2500) * np.exp(-t / 0.0007) * 0.35
    x = (body + grit) * smoothstep(t / 0.0004)
    return x / np.max(np.abs(x))


def riser(dur, octaves=1.55, f0=180.0):
    """Soft rising tone that follows the number's ease-out count."""
    tail = 0.45
    n = ns(dur + tail)
    t = tt(n)
    p = np.clip(t / dur, 0, 1)
    e = 1 - (1 - p) ** 3
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.2 * t)
    freq = f0 * 2 ** (octaves * e) * vib
    ph = 2 * np.pi * np.cumsum(freq) / SR
    x = np.sin(ph) + 0.22 * np.sin(2 * ph + 0.4) + 0.06 * np.sin(3 * ph + 1.0)
    x2 = np.sin(ph * 1.003 + 0.7)                       # gentle chorus
    amp = smoothstep(t / 0.07) * np.where(t < dur - 0.15, 1.0, smoothstep((dur + tail - t) / (tail + 0.15)))
    air = spectral_noise(dur + tail, lambda tq: 4 * f0 * 2 ** (octaves * (1 - (1 - np.clip(tq / dur, 0, 1)) ** 3)), 0.8, 1.0, nfft=1024)
    return (0.8 * x + 0.35 * x2) * amp + 0.12 * air * amp


def title_swell():
    dur = 3.25
    n = ns(dur)
    t = tt(n)
    env = swell_env(n, 2.45, 1.4, 1.1)
    low = np.sin(2 * np.pi * 41.2 * t) + 0.8 * np.sin(2 * np.pi * 55.0 * t + 0.4) + 0.18 * np.sin(2 * np.pi * 110.3 * t + 1.3)
    rumble = spectral_noise(dur, 180, 1.6, 1.0, nfft=4096, seed=21)
    body = spectral_noise(dur, 420, 1.4, 1.0, nfft=4096, seed=23)
    airy = spectral_noise(dur, 2600, 1.4, 1.0, seed=22)
    return env * (0.55 * low + 0.45 * rumble + 0.3 * body + 0.14 * airy)


def creak(dur, r):
    """Wooden stick-slip creak: a jittery pulse train ringing a few wooden resonances."""
    n = ns(dur)
    t = tt(n)
    slow = np.interp(t, np.linspace(0, dur, 9), r.uniform(0.3, 1.0, 9))
    rate = 38 + 85 * (0.5 + 0.5 * np.sin(2 * np.pi * 1.1 * t + 1.0)) * slow
    pulses = np.zeros(n)
    pos = 0.0
    while True:
        pos += SR / np.interp(pos, np.arange(n), rate) * r.uniform(0.75, 1.25)
        if pos >= n:
            break
        pulses[int(pos)] = r.uniform(0.4, 1.0)
    h_t = tt(int(0.04 * SR))
    h = (np.sin(2 * np.pi * 510 * h_t) * np.exp(-h_t / 0.007) + 0.6 * np.sin(2 * np.pi * 1170 * h_t) * np.exp(-h_t / 0.004)
         + 0.3 * np.sin(2 * np.pi * 2350 * h_t) * np.exp(-h_t / 0.002))
    x = fft_convolve(pulses, h)[:n]
    x = fft_filter(x, lo=180, hi=4200)
    swell = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.6
    return x * swell * ramp_env(n, 0.12, 0.08)


def thud():
    dur = 0.7
    n = ns(dur)
    t = tt(n)
    f = 44 + 34 * np.exp(-t / 0.05)
    body = osc(f) * np.exp(-t / 0.17)
    knock = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.028) * 0.5 + np.sin(2 * np.pi * 118 * t) * np.exp(-t / 0.06) * 0.45
    soft = spectral_noise(dur, 160, 1.3, 1.0, nfft=4096, seed=31) * np.exp(-t / 0.06) * 0.45
    return (body + knock + soft) * smoothstep(t / 0.003)


def shimmer(dur, r, density=55, fmin=3500, fmax=9000):
    """Glittering sparkle grains (very short, never bell-like) over a soft high air band."""
    n = ns(dur)
    left, right = np.zeros(n), np.zeros(n)
    for _ in range(int(density * dur)):
        gd = r.uniform(0.015, 0.05)
        gn = int(gd * SR)
        gt = tt(gn)
        f = np.exp(r.uniform(np.log(fmin), np.log(fmax)))
        g = np.sin(2 * np.pi * f * gt + r.uniform(0, 6.28)) * np.exp(-0.5 * ((gt - gd / 2) / (gd / 5)) ** 2) * r.uniform(0.3, 1.0)
        i0 = int(r.uniform(0, max(1, n - gn)))
        pan = r.uniform(-0.8, 0.8)
        left[i0:i0 + gn] += g * np.cos((pan + 1) * np.pi / 4)
        right[i0:i0 + gn] += g * np.sin((pan + 1) * np.pi / 4)
    band = spectral_noise(dur, 7200, 1.0, 1.0, seed=int(r.integers(1 << 30)))
    env = ramp_env(n, min(0.4, dur / 3), min(0.5, dur / 2.5))
    grains = np.stack([left, right])
    grains /= np.max(np.abs(grains)) + 1e-12
    return (grains * 0.55 + 0.2 * band[None, :]) * env


def wind(dur, r):
    n = ns(dur)
    t = tt(n)
    knots = np.linspace(-0.5, dur + 0.5, int(dur * 3) + 3)
    gust = np.clip(np.interp(t, knots, r.uniform(0.45, 1.0, len(knots))), 0, 1)
    gust = fft_filter(gust - gust.mean(), hi=1.2) + gust.mean()
    gf = lambda tq: np.interp(tq, t, gust)
    out = []
    for ch in range(2):
        low = spectral_noise(dur, lambda tq: 320 + 380 * gf(tq), 1.5, gf, nfft=4096, seed=40 + ch)
        flutter = np.abs(fft_filter(r.standard_normal(n), hi=14)) ** 1.5
        flutter /= flutter.max()
        rustle = spectral_noise(dur, 5200, 1.3, 1.0, seed=50 + ch) * (0.25 + 0.75 * flutter) * gust
        out.append(0.8 * low + 0.45 * rustle)
    return np.stack(out) * ramp_env(n, 0.35, 0.45)


def door_rumble(dur, r):
    n = ns(dur)
    t = tt(n)
    sub = np.sin(2 * np.pi * 37.5 * t + 0.6 * np.sin(2 * np.pi * 2.7 * t))
    rum = spectral_noise(dur, 75, 1.4, 1.0, nfft=8192, seed=61)
    jitter = np.abs(fft_filter(r.standard_normal(n), hi=18))
    jitter = 0.35 + 0.65 * jitter / jitter.max()
    grind = spectral_noise(dur, 240, 0.9, 1.0, nfft=4096, seed=62) * jitter
    env = ramp_env(n, 0.3, 0.6)
    return (0.75 * sub + 0.9 * rum + 0.45 * grind) * env


def air(dur, fc=1800, bw=2.0, attack=0.6, release=0.8, seed=None):
    x = spectral_noise(dur, fc, bw, 1.0, seed=seed)
    return x * ramp_env(len(x), attack, release)


def pop(f0):
    dur = 0.22
    n = ns(dur)
    t = tt(n)
    f = f0 * (1 + 0.55 * np.exp(-t / 0.012))
    body = osc(f) * np.exp(-t / 0.045)
    sub = np.sin(2 * np.pi * f0 * 0.5 * t) * np.exp(-t / 0.03) * 0.35
    click = fft_filter(rng.standard_normal(n), lo=1500, hi=6000) * np.exp(-t / 0.0015) * 0.12
    return (body + sub + click) * smoothstep(t / 0.0012)


def space_whoosh(dur):
    n = ns(dur)
    t = tt(n)
    fc = lambda tq: 2 ** np.interp(tq, [0, 0.9, dur], [np.log2(2300), np.log2(700), np.log2(95)])
    bw = lambda tq: np.interp(tq, [0, dur], [1.3, 1.0])
    x = spectral_noise(dur, fc, bw, 1.0, nfft=4096, seed=71)
    drop = osc(28 + 60 * np.exp(-t / 0.8)) * 0.5
    return (x + drop) * swell_env(n, 0.85, 1.8, 1.6)


# ----------------------------------------------------------------------------- arrange
stems = {k: Mix(k) for k in ['bed', 'ticks', 'whoosh', 'counts', 'sfx']}
stems['bed'].buf += bed()

boundaries = [s['start'] for s in CUES['scenes'][1:]]
for i, tb in enumerate(boundaries):
    w = whoosh(seed=100 + i)
    w = peak_norm(w, -15.0)
    stems['whoosh'].add(w * np.linspace(1.15, 0.85, len(w)), tb - 0.72, xr=w * np.linspace(0.85, 1.15, len(w)))

r_tick = np.random.default_rng(SEED + 1)
for tk in CUES['ticks']:
    x = tick(r_tick) * db(-37.5 + r_tick.uniform(-1.5, 1.0))
    stems['ticks'].add(x, tk, pan=r_tick.uniform(-0.25, 0.25))

for c in CUES['counts']:
    x = peak_norm(riser(c['dur'], octaves=1.5 if c['value'] < 80 else 1.7), -17.0)
    stems['counts'].add(x, c['start'])

sfx = stems['sfx']
# 0 · title: deep soft swell
sfx.add(peak_norm(title_swell(), -7.5), EV['titleSwell'][0])
# 1 · whip: wooden creak while the beam tips, a gentle thud when it lands
r1 = np.random.default_rng(SEED + 2)
c0, c1 = EV['whipCreak']
sfx.add(peak_norm(creak(c1 - c0, r1), -13.0), c0, pan=0.15)
sfx.add(peak_norm(thud(), -8.0), EV['whipThud'], pan=0.25)
ws = CUES['scenes'][1]
sfx.add(rms_norm(air(ws['end'] - ws['start'], 700, 1.8, 0.6, 0.6, seed=7), -27.0), ws['start'])   # warm room air
# 2 · pearl: soft shimmer as the pearl glows, a warm bloom as the tent forms (the count riser is separate)
r2 = np.random.default_rng(SEED + 3)
s0, s1 = EV['pearlShimmer']
sh = shimmer(s1 - s0 + 0.5, r2)
sfx.add(peak_norm(sh[0], -18.5), s0, xr=peak_norm(sh[1], -18.5))
p0, p1 = EV['pearlTent']
sh2 = shimmer(p1 - p0 + 0.6, r2, density=30)
sfx.add(peak_norm(sh2[0], -23.0), p0, xr=peak_norm(sh2[1], -23.0))
sfx.add(rms_norm(air(p1 - p0 + 0.6, 900, 1.6, 0.5, 0.6, seed=81), -25.0), p0)
# 3 · tree: soft wind through leaves
w0, w1 = EV['treeWind']
wd = wind(w1 - w0, np.random.default_rng(SEED + 4))
wd = wd * (db(-25.0) / np.sqrt(np.mean(wd ** 2)))
sfx.add(wd[0], w0, xr=wd[1])
# 4 · gate: deep heavy door rumble, then soft open air
g0, g1 = EV['gateRumble']
sfx.add(rms_norm(door_rumble(g1 - g0 + 0.5, np.random.default_rng(SEED + 5)), -23.0), g0)
a0, a1 = EV['gateAir']
sfx.add(rms_norm(air(a1 - a0, 2000, 2.0, 0.7, 0.5, seed=91), -27.0), a0, pan=-0.1)
sfx.add(rms_norm(air(a1 - a0, 2300, 2.0, 0.7, 0.5, seed=92), -27.0), a0, pan=0.1)
# 5 · levels: soft whooshes climbing in pitch, one per rising level
for k, tw in enumerate(EV['levelWhooshes']):
    base = 320 * 2 ** (k * 0.33)
    x = whoosh(dur=0.55, peak_at=0.22, f=(base * 0.7, base * 1.8, base), bw=0.8, seed=200 + k)
    sfx.add(peak_norm(x, -15.0 + 0.3 * k), tw - 0.2, pan=-0.3 + 0.6 * (k % 2))
# 6 · heavens: one long deep whoosh into quiet space air
h0, h1 = EV['spaceWhoosh']
sfx.add(peak_norm(space_whoosh(h1 - h0 + 0.4), -9.0), h0)
q0, q1 = EV['spaceAir']
sfx.add(rms_norm(air(q1 - q0, 5200, 1.6, 0.8, 0.6, seed=101), -30.0), q0, pan=-0.2)
sfx.add(rms_norm(air(q1 - q0, 4800, 1.6, 0.8, 0.6, seed=102), -30.0), q0, pan=0.2)
# 7 · last person: a soft pop for each world, each a little higher (plus a soft glow for the ×10)
for k, tp in enumerate(EV['pops']):
    sfx.add(peak_norm(pop(300 * 2 ** (k * 1.4 / 12)), -12.5), tp, pan=np.sin(-np.pi / 2 + k * 2 * np.pi / 10) * 0.5)
sfx.add(rms_norm(air(1.4, 1200, 1.6, 0.05, 1.1, seed=111), -23.0), EV['numberPop'])
ls = CUES['scenes'][7]
sfx.add(rms_norm(air(ls['end'] - ls['start'], 900, 2.0, 0.6, 0.6, seed=8), -28.0), ls['start'])     # warm golden air
# 8 · beyond: soft swell into a bright airy shimmer
b0, b1 = EV['beyondSwell']
bs_n = ns(b1 - b0 + 0.6)
bs = spectral_noise(b1 - b0 + 0.6, lambda tq: 260 * 2 ** (2.2 * np.clip(tq / (b1 - b0), 0, 1)), 1.6, 1.0, nfft=4096, seed=121)
bs += 0.5 * np.sin(2 * np.pi * 55 * tt(bs_n))
sfx.add(peak_norm(bs * swell_env(bs_n, b1 - b0, 2.2, 0.8), -13.5), b0)
e0, e1 = EV['beyondShimmer']
bsh = shimmer(e1 - e0, np.random.default_rng(SEED + 6), density=60, fmin=3500, fmax=8500)
sfx.add(peak_norm(bsh[0], -20.5), e0, xr=peak_norm(bsh[1], -20.5))
sfx.add(rms_norm(air(e1 - e0, 5200, 1.6, 0.3, 1.2, seed=131), -27.5), e0)
# 9 · ending: soft air only, fading out
f0, f1 = EV['endingAir']
end_air = spectral_noise(f1 - f0, 1300, 2.0, 1.0, seed=141)
end_air *= ramp_env(len(end_air), 0.8, 2.6)
sfx.add(rms_norm(end_air, -28.0), f0)


# ----------------------------------------------------------------------------- master
def k_weighted(x):
    """ITU-R BS.1770 K-weighting (pre-filter + RLB high-pass), applied in the frequency domain."""
    n = x.shape[-1]
    nfft = 1 << int(np.ceil(np.log2(n + SR)))
    z = np.exp(-1j * 2 * np.pi * np.fft.rfftfreq(nfft, 1 / SR) / SR)
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    H = ((b1[0] + b1[1] * z + b1[2] * z * z) / (a1[0] + a1[1] * z + a1[2] * z * z)
         * (b2[0] + b2[1] * z + b2[2] * z * z) / (a2[0] + a2[1] * z + a2[2] * z * z))
    return np.fft.irfft(np.fft.rfft(x, nfft, axis=-1) * H, nfft, axis=-1)[..., :n]


def integrated_lufs(x):
    y = k_weighted(x)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    cs = np.concatenate([np.zeros((2, 1)), np.cumsum(y ** 2, axis=1)], axis=1)
    starts = np.arange(0, y.shape[1] - blk + 1, hop)
    z = (cs[:, starts + blk] - cs[:, starts]) / blk
    zs = z.sum(axis=0)
    lj = -0.691 + 10 * np.log10(zs + 1e-20)
    g = zs[lj > -70]
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    return -0.691 + 10 * np.log10(zs[lj > rel].mean())


def true_peak_db(x, over=4):
    n = x.shape[1]
    X = np.fft.rfft(x, axis=1)
    up = np.fft.irfft(X, n * over, axis=1) * over
    return 20 * np.log10(np.max(np.abs(up)) + 1e-12), up


def limit(x, ceiling_db, look_ms=3.0, release_ms=90.0, over=4):
    """Look-ahead peak limiter driven by a 4x-oversampled (true-peak) envelope."""
    _, up = true_peak_db(x, over)
    env = np.max(np.abs(up), axis=0).reshape(-1, over).max(axis=1)
    ceil = db(ceiling_db)
    need = np.minimum(1.0, ceil / np.maximum(env, 1e-9))
    if need.min() >= 1.0:
        return x, 0.0
    L = int(look_ms * 1e-3 * SR)
    pad = np.concatenate([need, np.ones(L)])
    win = np.lib.stride_tricks.sliding_window_view(pad, L + 1).min(axis=1)[:len(need)]
    k = np.ones(L) / L
    att = np.convolve(np.concatenate([np.ones(L), win]), k, mode='valid')[:len(need)]
    att = np.minimum(att, win)
    rel = np.exp(-1.0 / (release_ms * 1e-3 * SR))
    g = np.empty_like(att)
    cur = 1.0
    for i in range(len(att)):                       # simple one-pole release, instant attack
        a = att[i]
        cur = a if a < cur else a + (cur - a) * rel
        g[i] = cur
    return x * g, 20 * np.log10(g.min())


stem_bufs = {k: m.buf for k, m in stems.items()}
hp = lambda x: np.stack([fft_filter(x[0], lo=28, order=2), fft_filter(x[1], lo=28, order=2)])
# The bed (-26 dB) and the letter ticks (-36 dB) keep their absolute levels; the scene sounds,
# whooshes and count tones are balanced as one group so the whole mix lands on -14 LUFS.
fixed = hp(stem_bufs['bed'] + stem_bufs['ticks'])
group = hp(stem_bufs['whoosh'] + stem_bufs['counts'] + stem_bufs['sfx'])
group_db = 0.0
for _ in range(8):
    lufs = integrated_lufs(fixed + group * db(group_db))
    if abs(lufs - TARGET_LUFS) < 0.03:
        break
    group_db += (TARGET_LUFS - lufs) * 1.05
out = fixed + group * db(group_db)
trim_db = 0.0
for _ in range(4):                                # limit to the true-peak ceiling, re-measure, trim
    out, gr = limit(out, PEAK_DBTP - 0.35)
    lufs = integrated_lufs(out)
    if abs(lufs - TARGET_LUFS) < 0.1:
        break
    trim_db += TARGET_LUFS - lufs
    out = out * db(TARGET_LUFS - lufs)
out, gr = limit(out, PEAK_DBTP - 0.35)
lufs = integrated_lufs(out)
tp, _ = true_peak_db(out)
out = np.clip(out, -db(PEAK_DBTP), db(PEAK_DBTP))

bed_db = 20 * np.log10(np.sqrt(np.mean(stem_bufs['bed'][:, int(5 * SR):int(40 * SR)] ** 2)) + 1e-12) + trim_db
tick_pk = 20 * np.log10(np.max(np.abs(stem_bufs['ticks'])) + 1e-12) + trim_db
def scene_report(x):
    y = k_weighted(x)
    rows = []
    for sc in CUES['scenes']:
        a, b = int(sc['start'] * SR), int(sc['end'] * SR)
        e = np.mean(np.sum(y[:, a:b] ** 2, axis=0))
        pk = 20 * np.log10(np.max(np.abs(x[:, a:b])) + 1e-12)
        rows.append(f"{sc['id']:>8}: {-0.691 + 10 * np.log10(e + 1e-20):6.1f} LUFS  peak {pk:5.1f} dBFS")
    print('\n'.join(rows))


scene_report(out)
print(f'scene-sound group gain {group_db:+.2f} dB, final trim {trim_db:+.2f} dB')
print(f'final: {lufs:.2f} LUFS integrated, true peak {tp:.2f} dBTP, max limiter reduction {gr:.2f} dB')
print(f'bed RMS {bed_db:.1f} dBFS, tick peaks {tick_pk:.1f} dBFS, {len(CUES["ticks"])} ticks')

# 32-bit float WAV
data = out.T.astype('<f4').tobytes()
with open(out_path, 'wb') as fh:
    fh.write(b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVE')
    fh.write(b'fmt ' + struct.pack('<IHHIIHH', 16, 3, 2, SR, SR * 2 * 4, 8, 32))
    fh.write(b'data' + struct.pack('<I', len(data)) + data)
print('wrote', out_path, f'{out.shape[1] / SR:.3f} s')
