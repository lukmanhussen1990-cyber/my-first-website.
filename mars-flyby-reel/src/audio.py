"""Score, sound design and final mix for the reel (48 kHz stereo, exactly 45.0 s).

Usage: python audio.py <audio_dir> <out_wav>
"""
import json
import math
import os
import sys

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt, sosfilt_zi

SR = 48000
DUR = 45.0
N = int(SR * DUR)
T = np.arange(N) / SR
RNG = np.random.default_rng(2026)


def db(x):
    return 10 ** (x / 20.0)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def env_seg(t0, t1, a=0.05, r=0.3, shape=1.0):
    """Gate envelope from t0 to t1 with attack a and release r (seconds)."""
    e = np.clip((T - t0) / max(a, 1e-4), 0, 1) * np.clip((t1 - T) / max(r, 1e-4), 0, 1)
    return e ** shape


def ramp(points):
    """Piecewise-linear automation from [(t, value), ...]."""
    ts, vs = zip(*points)
    return np.interp(T, ts, vs)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "bandpass", fs=SR, output="sos"), x, axis=0)


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, "lowpass", fs=SR, output="sos"), x, axis=0)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "highpass", fs=SR, output="sos"), x, axis=0)


def lp_auto(x, cut, block=1024, order=2):
    """Low-pass with a time-varying cutoff (block-wise, filter state carried)."""
    y = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        sos = butter(order, float(np.clip(cut[min(i, len(cut) - 1)], 40, SR / 2.2)), "lowpass", fs=SR, output="sos")
        if zi is None:
            zi = sosfilt_zi(sos) * 0.0
        y[i:i + block], zi = sosfilt(sos, x[i:i + block], zi=zi)
    return y


def polyblep_saw(freq):
    """Band-limited sawtooth for a per-sample frequency array."""
    dt = freq / SR
    ph = np.cumsum(dt) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    t1 = ph[m] / dt[m]
    y[m] -= t1 + t1 - t1 * t1 - 1
    m = ph > 1 - dt
    t1 = (ph[m] - 1) / dt[m]
    y[m] -= t1 * t1 + t1 + t1 + 1
    return y


def pan(x, p):
    """Equal-power pan, p in [-1, 1]."""
    a = (p + 1) * math.pi / 4
    return np.stack([x * math.cos(a), x * math.sin(a)], 1)


def reverb_ir(rt60=2.6, pre=0.02, seed=1):
    r = np.random.default_rng(seed)
    n = int(SR * rt60 * 1.1)
    tt = np.arange(n) / SR
    decay = np.exp(-6.9 * tt / rt60)
    ir = r.normal(0, 1, (n, 2)) * decay[:, None]
    ir = lp(ir, 5200)
    ir[: int(pre * SR)] = 0
    for d, g in ((0.011, 0.5), (0.019, 0.38), (0.027, 0.3), (0.041, 0.22)):
        ir[int((pre + d) * SR), 0] += g
        ir[int((pre + d * 1.13) * SR), 1] += g
    return ir / np.sqrt((ir ** 2).sum(0, keepdims=True))


def reverb(x, wet=0.35, rt60=2.6):
    ir = reverb_ir(rt60)
    y = np.stack([fftconvolve(x[:, 0], ir[:, 0])[:N], fftconvolve(x[:, 1], ir[:, 1])[:N]], 1)
    return x * (1 - wet) + y * wet


# ------------------------------------------------------------------ score
CHORDS = [  # (start, end, midi notes) — D minor, slow-build
    (0.0, 4.0, [50, 57, 62, 65]),
    (4.0, 6.5, [46, 53, 58, 62]),
    (6.5, 9.0, [41, 48, 57, 60]),
    (9.0, 12.5, [50, 57, 62, 65]),
    (12.5, 16.0, [48, 55, 60, 64]),
    (16.0, 19.0, [46, 53, 58, 62, 65]),
    (19.0, 22.0, [41, 48, 57, 60, 65]),
    (22.0, 25.5, [50, 57, 62, 65]),
    (25.5, 29.0, [46, 53, 62, 65]),
    (29.0, 32.5, [43, 50, 55, 58, 62]),
    (32.5, 36.0, [45, 52, 57, 62, 64]),
    (36.0, 38.5, [46, 53, 58, 62, 65, 74, 77]),
    (38.5, 40.85, [45, 52, 57, 61, 64, 79, 81]),
    (41.05, 45.0, [50, 57, 66, 64]),
]


def pad():
    out = np.zeros((N, 2))
    for ci, (t0, t1, notes) in enumerate(CHORDS):
        last = ci == len(CHORDS) - 1
        e = env_seg(t0 - 0.25, t1 + (1.8 if last else 0.55), a=0.9 if ci else 1.6, r=2.2 if last else 0.9)
        if last:
            e = e * ramp([(0, 1), (41.0, 1), (43.6, 0.55), (44.85, 0.0), (45, 0)])
        if not e.any():
            continue
        for k, m in enumerate(notes):
            f0 = mtof(m)
            vib = 1 + 0.0025 * np.sin(2 * math.pi * (4.6 + 0.3 * k) * T + k)
            v = np.zeros(N)
            for det in (-0.09, 0.0, 0.08):
                v += polyblep_saw(np.full(N, f0 * 2 ** (det / 12)) * vib)
            v = v / 3 + 0.4 * np.sin(2 * math.pi * f0 * T)
            amp = 0.9 if m < 60 else (0.55 if m < 72 else 0.35)
            out += pan(v * e * amp / len(notes), -0.6 + 1.2 * (k / max(len(notes) - 1, 1)))
    cut = ramp([(0, 700), (4, 900), (9, 1100), (16, 1600), (22, 1500), (29, 1900), (36, 2600), (40.8, 3400),
                (41.0, 900), (45, 700)])
    return np.stack([lp_auto(out[:, 0], cut), lp_auto(out[:, 1], cut)], 1)


def drone():
    d = 0.6 * np.sin(2 * math.pi * 73.42 * T) + 0.35 * np.sin(2 * math.pi * 36.71 * T)
    d *= 1 + 0.15 * np.sin(2 * math.pi * 0.11 * T)
    e = ramp([(0, 0), (0.6, 1), (4, 1), (9, 0.7), (16, 0.8), (29, 0.9), (40.8, 1.0), (41.0, 0.4), (44.8, 0), (45, 0)])
    return pan(d * e, 0.0)


def pulse():
    """Soft eighth-note pulse on the chord root, then a low heartbeat thump; stops at the drop."""
    beat = 60.0 / 84.0
    out = np.zeros((N, 2))
    gain = lambda t: np.interp(t, [8.8, 9.0, 16, 22, 29, 36, 40.6, 40.85], [0, .35, .5, .55, .7, .9, 1.0, 0])
    t = 9.0
    i = 0
    while t < 40.85:
        root = [c for c in CHORDS if c[0] <= t < c[1]]
        m = (root[0][2][0] if root else 50) + 12
        f = mtof(m)
        n = int(0.32 * SR)
        tt = np.arange(n) / SR
        x = polyblep_saw(np.full(n, f)) * np.exp(-tt / 0.07)
        x = lp(x, 900 + 600 * gain(t))
        s = int(t * SR)
        g = gain(t) * (1.0 if i % 2 == 0 else 0.6)
        out[s:s + n] += pan(x[: max(0, min(n, N - s))] * g * 0.5, 0.25 if i % 2 else -0.25)
        if t >= 29.0 and i % 2 == 0:
            k = np.sin(2 * math.pi * np.cumsum(np.linspace(78, 44, n)) / SR) * np.exp(-tt / 0.12)
            out[s:s + n] += pan(k[: max(0, min(n, N - s))] * g * 0.9, 0.0)
        t += beat / 2
        i += 1
    return out


def bell(t0, midi, amp=1.0, decay=2.4):
    out = np.zeros((N, 2))
    s = int(t0 * SR)
    n = min(int(decay * 3 * SR), N - s)
    tt = np.arange(n) / SR
    f = mtof(midi)
    x = sum(a * np.sin(2 * math.pi * f * r * tt) * np.exp(-tt / (decay * d))
            for r, a, d in ((1, 1, 1), (2.0, 0.35, 0.6), (2.76, 0.25, 0.35), (5.4, 0.12, 0.2)))
    x *= np.clip(tt / 0.004, 0, 1)
    out[s:s + n] = pan(x * amp, 0.1)
    return out


def score():
    mus = pad() * 1.0 + drone() * 0.35 + pulse() * 0.55
    mus += bell(41.15, 74, 0.45) + bell(41.75, 81, 0.25) + bell(43.95, 74, 0.5, 3.0) + bell(43.95, 78, 0.3, 3.0)
    mus = reverb(mus, wet=0.38, rt60=2.8)
    fade_end = ramp([(0, 1), (44.2, 1), (44.97, 0), (45, 0)])
    return mus * fade_end[:, None]


# ------------------------------------------------------------------ sound effects
def noise(n=N, ch=2):
    return RNG.normal(0, 1, (n, ch))


def brown(n=N, ch=2):
    w = RNG.normal(0, 1, (n, ch))
    b = np.cumsum(w, 0)
    b -= lp(b, 2.0)
    return b / (np.abs(b).max() + 1e-9)


def waves(regions):
    """Gentle night shoreline: brown-noise wash with slow swells + soft fizz."""
    base = lp(brown(), 900) * 3.0
    sw = 0.55 + 0.45 * np.sin(2 * math.pi * 0.13 * T + 1.0) * np.sin(2 * math.pi * 0.071 * T)
    fizz = bp(noise(), 2500, 7000) * (np.clip(np.sin(2 * math.pi * 0.13 * T + 2.2), 0, 1) ** 3)[:, None] * 0.25
    x = base * sw[:, None] + fizz
    g = sum(env_seg(a, b, 0.25, 0.35) * lvl for a, b, lvl in regions)
    return x * g[:, None]


def whoosh(t0, dur, lo=300, hi=3200, amp=1.0, p0=-0.7, p1=0.7):
    out = np.zeros((N, 2))
    s, n = int(t0 * SR), int(dur * SR)
    n = min(n, N - s)
    tt = np.arange(n) / dur / SR
    x = RNG.normal(0, 1, n)
    y = np.zeros(n)
    blocks = 24
    for b in range(blocks):
        i0, i1 = b * n // blocks, (b + 1) * n // blocks
        c = lo * (hi / lo) ** math.sin(math.pi * (i0 / n))
        y[i0:i1] = bp(x[max(0, i0 - 2000):i1], c * 0.6, c * 1.6)[-(i1 - i0):]
    e = np.sin(math.pi * tt) ** 2 * amp
    for b in range(blocks):
        i0, i1 = b * n // blocks, (b + 1) * n // blocks
        pp = p0 + (p1 - p0) * (i0 / n)
        out[s + i0:s + i1] += pan(y[i0:i1] * e[i0:i1], pp)
    return out


def tick(t0, amp=1.0):
    out = np.zeros((N, 2))
    s = int(t0 * SR)
    n = int(0.05 * SR)
    tt = np.arange(n) / SR
    x = (np.sin(2 * math.pi * 2600 * tt) * 0.8 + np.sin(2 * math.pi * 5200 * tt) * 0.2) * np.exp(-tt / 0.008)
    x += RNG.normal(0, 0.15, n) * np.exp(-tt / 0.002)
    out[s:s + n] = pan(x * amp, 0.0)
    return out


def riser(t0, t1, f0, f1, amp=1.0):
    out = np.zeros((N, 2))
    s, e = int(t0 * SR), int(t1 * SR)
    n = e - s
    k = np.linspace(0, 1, n)
    f = f0 * (f1 / f0) ** k
    x = np.sin(2 * math.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * math.pi * np.cumsum(f * 2.005) / SR)
    env = np.sin(math.pi * np.clip(k * 1.05, 0, 1)) ** 1.5 * amp
    out[s:e] = pan(x * env, 0.0)
    return out


def swell(t0, t1, amp=1.0):
    out = np.zeros((N, 2))
    s, e = int(t0 * SR), int(t1 * SR)
    n = e - s
    k = np.linspace(0, 1, n)
    env = (np.sin(math.pi * k) ** 2) * amp
    tt = np.arange(n) / SR
    x = 0.7 * np.sin(2 * math.pi * 36.7 * tt) + 0.5 * np.sin(2 * math.pi * 55.0 * tt)
    nz = lp(RNG.normal(0, 1, (n, 2)), 220) * 2.0
    out[s:e] = (x[:, None] + nz) * env[:, None]
    return out


def creak(t0, dur, amp=1.0, seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros((N, 2))
    s, n = int(t0 * SR), int(dur * SR)
    tt = np.arange(n) / SR
    rate = 55 + 60 * np.sin(math.pi * tt / dur) + r.normal(0, 6, n).cumsum() * 0.01
    ph = np.cumsum(rate) / SR
    pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(float)
    x = sum(bp(pulses, f * 0.85, f * 1.15) * g for f, g in ((420, 1.0), (930, 0.6), (1750, 0.35)))
    x *= np.sin(math.pi * tt / dur) ** 0.7
    out[s:s + n] = pan(x * amp * 6.0, r.uniform(-0.5, 0.5))
    return out


def water_rise(t0, t1, amp=1.0):
    out = np.zeros((N, 2))
    s, e = int(t0 * SR), int(t1 * SR)
    n = e - s
    k = np.linspace(0, 1, n)
    x = bp(RNG.normal(0, 1, (n, 2)), 250, 1600) * (0.4 + 0.6 * k)[:, None]
    for _ in range(int(55 * (t1 - t0))):          # bubbles / sloshes
        b0 = RNG.integers(0, n - 4000)
        bl = int(RNG.uniform(0.03, 0.09) * SR)
        bt = np.arange(bl) / SR
        f = RNG.uniform(300, 900) * (1 + 3.0 * bt)
        bub = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-bt / 0.02) * RNG.uniform(0.2, 0.6)
        x[b0:b0 + bl] += pan(bub, RNG.uniform(-0.6, 0.6))
    env = np.clip(k / 0.15, 0, 1) * np.clip((1 - k) / 0.1, 0, 1)
    out[s:e] = x * env[:, None] * amp
    return out


def rumble(t0, t1, amp=1.0):
    out = np.zeros((N, 2))
    s, e = int(t0 * SR), int(t1 * SR)
    n = e - s
    tt = np.arange(n) / SR
    x = lp(RNG.normal(0, 1, (n, 2)), 70, 4) * 4.0 + (0.5 * np.sin(2 * math.pi * 41 * tt))[:, None]
    x *= (0.75 + 0.25 * np.sin(2 * math.pi * 0.7 * tt))[:, None]
    env = np.clip(tt / 0.6, 0, 1) * np.clip((tt[-1] - tt) / 0.4, 0, 1)
    out[s:e] = x * env[:, None] * amp
    return out


def sfx():
    x = np.zeros((N, 2))
    # Earth-ground scenes: real-sounding shoreline
    x += waves([(0.0, 4.05, 1.0), (16.0, 22.05, 1.15), (25.4, 29.0, 0.9), (41.0, 45.0, 0.0)]) * 0.55
    # Scene 2 (space, symbolic): soft whoosh + rising tone
    x += whoosh(3.85, 0.9, 250, 2600, 0.30)
    x += riser(4.3, 9.0, 196.0, 392.0, 0.10)
    x += whoosh(8.45, 0.65, 400, 3600, 0.22, 0.6, -0.6)
    # Scene 3: a short tick per distance jump
    for t0 in (9.0, 10.95, 11.95):
        x += tick(t0, 0.22)
    # Scene 4: deep ambient swell
    x += swell(16.0, 21.6, 0.28)
    # Scene 5 (harbour, Earth): rising water, creaking docks, low rumble
    x += water_rise(25.5, 29.0, 0.32)
    for i, (t0, d) in enumerate(((25.9, 0.55), (26.8, 0.7), (27.7, 0.5), (28.3, 0.6))):
        x += creak(t0, d, 0.18, seed=i)
    x += rumble(25.4, 29.0, 0.20)
    # whip-pan
    x += whoosh(28.62, 0.6, 500, 5200, 0.30, -0.3, 0.3)
    # Scene 6: smooth tonal sweep as Mars swings past
    x += riser(29.4, 33.8, 330.0, 247.0, 0.07)
    # Scene 7 -> 8: soft air on the drop
    x += whoosh(40.75, 0.7, 300, 1600, 0.10)
    return x


# ------------------------------------------------------------------ voice
def compress(x, thr_db=-26.0, ratio=3.0, att=0.006, rel=0.12, knee=6.0):
    lvl = np.abs(x)
    a_a, a_r = math.exp(-1 / (att * SR)), math.exp(-1 / (rel * SR))
    env = np.zeros_like(lvl)
    e = 0.0
    # envelope follower in blocks of 1 sample is slow in Python; do it on 1 ms chunks
    hop = int(0.001 * SR)
    pk = np.maximum.reduceat(lvl, np.arange(0, len(lvl), hop))
    out_env = np.zeros_like(pk)
    a_a1, a_r1 = math.exp(-1 / (att * 1000)), math.exp(-1 / (rel * 1000))
    for i, v in enumerate(pk):
        c = a_a1 if v > e else a_r1
        e = c * e + (1 - c) * v
        out_env[i] = e
    env = np.repeat(out_env, hop)[: len(x)]
    ldb = 20 * np.log10(env + 1e-9)
    over = ldb - thr_db
    gr = np.where(over <= -knee / 2, 0.0,
                  np.where(over >= knee / 2, over * (1 - 1 / ratio),
                           (1 - 1 / ratio) * (over + knee / 2) ** 2 / (2 * knee)))
    return x * db(-gr)


def limiter(x, ceiling_db, look=0.003, rel=0.05, oversample=4):
    """Look-ahead peak limiter (true-peak aware via oversampled detection)."""
    det = np.abs(resample_poly(x, oversample, 1, axis=0)).max(1) if x.ndim > 1 else np.abs(
        resample_poly(x, oversample, 1))
    det = det.reshape(-1, oversample).max(1)[: len(x)]
    ceil = db(ceiling_db)
    need = np.minimum(1.0, ceil / (det + 1e-12))
    la = int(look * SR)
    # minimum over the look-ahead window, then smooth release
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * la + 1, origin=0)
    a_r = math.exp(-1 / (rel * SR))
    hop = 48
    gb = g[::hop].copy()
    for i in range(1, len(gb)):
        gb[i] = min(gb[i], a_r ** hop * gb[i - 1] + (1 - a_r ** hop) * gb[i])
    g2 = np.minimum(np.repeat(gb, hop)[: len(x)], g)
    g2 = np.convolve(g2, np.ones(la) / la, mode="same")
    g2 = np.minimum(g2, g)
    return x * (g2[:, None] if x.ndim > 1 else g2)


def process_voice(v):
    v = hp(v, 75)
    # de-esser: tame 5.5-9 kHz when it dominates
    s = bp(v, 5500, 9000)
    se = np.convolve(np.abs(s), np.ones(240) / 240, mode="same")
    fe = np.convolve(np.abs(v), np.ones(240) / 240, mode="same")
    ratio = se / (fe + 1e-6)
    gr = np.clip((ratio - 0.35) / 0.35, 0, 1) * 0.5           # up to -6 dB on the sibilant band
    v = v - s * gr
    # warmth + presence
    v = v + 0.12 * lp(v, 250) + 0.10 * bp(v, 2500, 4500)
    v = v / (np.abs(v).max() + 1e-9) * db(-3)
    v = compress(v, thr_db=-22.0, ratio=3.0, att=0.005, rel=0.12)
    v = v / (np.abs(v).max() + 1e-9)
    v = limiter(v[:, None].repeat(2, 1), -3.0, look=0.004, rel=0.06)[:, 0]   # shave spiky peaks
    v = compress(v / (np.abs(v).max() + 1e-9), thr_db=-14.0, ratio=2.0, att=0.003, rel=0.08)
    v = v / (np.abs(v).max() + 1e-9)
    v = limiter(v[:, None].repeat(2, 1), -4.6, look=0.004, rel=0.07)[:, 0]
    return v / (np.abs(v).max() + 1e-9) * db(-6.0)             # VO stem peaks at -6 dBFS


def speech_envelope(words, att=0.06, rel=0.35):
    act = np.zeros(N)
    for w in words:
        act[int(max(0, w["start"] - 0.05) * SR):int(min(DUR, w["end"] + 0.12) * SR)] = 1.0
    hop = int(0.005 * SR)
    a = act[::hop]
    e = np.zeros_like(a)
    v = 0.0
    ca, cr = math.exp(-1 / (att / 0.005)), math.exp(-1 / (rel / 0.005))
    for i, x in enumerate(a):
        c = ca if x > v else cr
        v = c * v + (1 - c) * x
        e[i] = v
    return np.repeat(e, hop)[:N]


def main(adir, out_wav):
    v, sr = sf.read(os.path.join(adir, "vo_edit.wav"), dtype="float64")
    assert sr == SR
    v = np.pad(v, (0, max(0, N - len(v))))[:N]
    words = json.load(open(os.path.join(adir, "align_edit.json")))
    vo = process_voice(v)
    vo2 = np.stack([vo, vo], 1)
    meter = pyln.Meter(SR)
    speech = speech_envelope(words)
    mus = score()
    fx = sfx()
    # levels: measure the voice during speech, then set music ~12 dB under it before ducking
    on = speech > 0.5
    vo_l = meter.integrated_loudness(vo2[on])
    mus_l = meter.integrated_loudness(mus[mus.any(1)])
    mus *= db((vo_l - 12.0) - mus_l)
    duck = db(-8.0 * speech)
    mus_d = mus * duck[:, None]
    fx_l = meter.integrated_loudness(fx[np.abs(fx).max(1) > 1e-4])
    fx *= db((vo_l - 17.0) - fx_l)
    fx_d = fx * db(-4.0 * speech)[:, None]
    mix = vo2 + mus_d + fx_d
    # master: -14 LUFS integrated, true peak <= -1 dBTP
    loud = meter.integrated_loudness(mix)
    g = db(-14.0 - loud)
    mix = mix * g
    for _ in range(3):
        mix = limiter(mix, -1.3)
        loud = meter.integrated_loudness(mix)
        mix = mix * db(-14.0 - loud)
    mix = limiter(mix, -1.3)
    mix = np.clip(mix, -1, 1)
    sf.write(out_wav, mix.astype(np.float32), SR, subtype="FLOAT")
    # report
    on_m = meter.integrated_loudness(mus_d[on] * g)
    rep = dict(
        integrated_lufs=meter.integrated_loudness(mix),
        vo_stem_peak_dbfs_after_master=20 * math.log10(np.abs(vo2 * g).max()),
        voice_loudness_in_speech=meter.integrated_loudness((vo2 * g)[on]),
        music_loudness_under_speech=on_m,
        music_under_voice_db=meter.integrated_loudness((vo2 * g)[on]) - on_m,
        duck_db=8.0,
        samples=len(mix),
    )
    json.dump(rep, open(out_wav.replace(".wav", "_report.json"), "w"), indent=1)
    sf.write(out_wav.replace(".wav", "_music.wav"), (mus_d * g).astype(np.float32), SR, subtype="FLOAT")
    sf.write(out_wav.replace(".wav", "_sfx.wav"), (fx_d * g).astype(np.float32), SR, subtype="FLOAT")
    sf.write(out_wav.replace(".wav", "_vo.wav"), (vo2 * g).astype(np.float32), SR, subtype="FLOAT")
    print(json.dumps(rep, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
