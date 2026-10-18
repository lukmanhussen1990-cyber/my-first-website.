"""Deterministic synthesis primitives (NumPy only) at 48 kHz.

Every random source is seeded from a name, so a cue renders bit-identically every
time.  Signals are float64 mono arrays unless a function says stereo (n, 2).
"""

from __future__ import annotations

import math
import wave
import zlib
from pathlib import Path

import numpy as np

SR = 48000
NOTE = {"D4": 293.66, "F#4": 369.99, "A4": 440.00, "B4": 493.88, "C#5": 554.37, "D5": 587.33, "E5": 659.26,
        "F#5": 739.99, "G5": 783.99, "A5": 880.00, "B5": 987.77, "C#6": 1108.73, "D6": 1174.66, "E6": 1318.51,
        "F#6": 1479.98, "G6": 1567.98, "A6": 1760.00, "B6": 1975.53, "D7": 2349.32, "D3": 146.83, "A3": 220.00,
        "D2": 73.42, "A2": 110.00, "D1": 36.71}


def rng(name: str) -> np.random.Generator:
    return np.random.default_rng(zlib.crc32(name.encode("utf-8")))


def samples(seconds: float) -> int:
    return int(round(seconds * SR))


def t_axis(n: int) -> np.ndarray:
    return np.arange(n) / SR


# ---------------------------------------------------------------- envelopes

def env(n: int, points, curve: str = "smooth") -> np.ndarray:
    """Piecewise envelope through (time_s, value) points; 'smooth' = smoothstep segments."""
    t = t_axis(n)
    out = np.zeros(n)
    pts = sorted(points)
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        m = (t >= t0) & (t < t1)
        u = (t[m] - t0) / max(t1 - t0, 1e-9)
        if curve == "smooth":
            u = u * u * (3 - 2 * u)
        elif curve == "exp":
            u = 1 - np.exp(-5 * u)
        out[m] = v0 + (v1 - v0) * u
    out[t >= pts[-1][0]] = pts[-1][1]
    out[t < pts[0][0]] = pts[0][1]
    return out


def perc(n: int, attack: float = 0.002, decay: float = 0.2, curve: float = 1.0) -> np.ndarray:
    """Percussive envelope: short raised-cosine attack, exponential decay (time constant)."""
    t = t_axis(n)
    a = np.clip(t / max(attack, 1e-6), 0, 1)
    a = 0.5 - 0.5 * np.cos(np.pi * a)
    d = np.exp(-np.maximum(t - attack, 0) / decay) ** curve
    return a * d


def fade(x: np.ndarray, fin: float = 0.002, fout: float = 0.01) -> np.ndarray:
    x = x.copy()
    ni, no = samples(fin), samples(fout)
    if ni:
        x[:ni] *= (np.linspace(0, 1, ni) ** 2)[:, None] if x.ndim == 2 else np.linspace(0, 1, ni) ** 2
    if no:
        ramp = np.linspace(1, 0, no) ** 2
        x[-no:] *= ramp[:, None] if x.ndim == 2 else ramp
    return x


# -------------------------------------------------------------- oscillators

def phase_from(freq, n):
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    return 2 * np.pi * np.cumsum(f) / SR


def sine(freq, n, phase0: float = 0.0):
    return np.sin(phase_from(freq, n) + phase0)


def tri(freq, n):
    ph = (phase_from(freq, n) / (2 * np.pi)) % 1.0
    return 4 * np.abs(ph - 0.5) - 1


def saw(freq, n):
    """Band-limited-ish saw (polyBLEP)."""
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    dt = f / SR
    ph = np.cumsum(dt) % 1.0
    y = 2 * ph - 1
    m1 = ph < dt
    t1 = ph[m1] / dt[m1]
    y[m1] -= t1 + t1 - t1 * t1 - 1
    m2 = ph > 1 - dt
    t2 = (ph[m2] - 1) / dt[m2]
    y[m2] -= t2 * t2 + t2 + t2 + 1
    return y


def fm(carrier, ratio, index, n):
    """Two-operator FM: index may be an envelope array."""
    mod = sine(np.asarray(carrier) * ratio, n) * np.asarray(index)
    return np.sin(phase_from(carrier, n) + mod)


def modal(n, f0, partials, amps, decays, detune=0.0, name="modal"):
    """Sum of exponentially decaying sines (bells, mallets, plucks)."""
    t = t_axis(n)
    r = rng(name)
    y = np.zeros(n)
    for p, a, d in zip(partials, amps, decays):
        f = f0 * p * (1 + detune * (r.random() - 0.5))
        y += a * np.sin(2 * np.pi * f * t + r.random() * 0.2) * np.exp(-t / d)
    return y


# -------------------------------------------------------------------- noise

def white(n, name):
    return rng(name).standard_normal(n)


def pink(n, name):
    x = rng(name).standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X[1:] /= np.sqrt(f[1:])
    X[0] = 0
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-12)


# ------------------------------------------------------------------ filters

def svf(x, cutoff, q: float = 0.7, mode: str = "lp"):
    """TPT state-variable filter with per-sample cutoff (Hz). mode lp|bp|hp."""
    n = len(x)
    fc = np.clip(np.broadcast_to(np.asarray(cutoff, float), (n,)), 10, SR * 0.45)
    g = np.tan(np.pi * fc / SR)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k))
    a2 = g * a1
    a3 = g * a2
    ic1 = ic2 = 0.0
    out = np.empty(n)
    xs = x.tolist()
    a1l, a2l, a3l = a1.tolist(), a2.tolist(), a3.tolist()
    if mode == "lp":
        for i in range(n):
            v3 = xs[i] - ic2
            v1 = a1l[i] * ic1 + a2l[i] * v3
            v2 = ic2 + a2l[i] * ic1 + a3l[i] * v3
            ic1 = 2 * v1 - ic1
            ic2 = 2 * v2 - ic2
            out[i] = v2
    elif mode == "bp":
        for i in range(n):
            v3 = xs[i] - ic2
            v1 = a1l[i] * ic1 + a2l[i] * v3
            v2 = ic2 + a2l[i] * ic1 + a3l[i] * v3
            ic1 = 2 * v1 - ic1
            ic2 = 2 * v2 - ic2
            out[i] = v1
    else:
        kl = k
        for i in range(n):
            v3 = xs[i] - ic2
            v1 = a1l[i] * ic1 + a2l[i] * v3
            v2 = ic2 + a2l[i] * ic1 + a3l[i] * v3
            ic1 = 2 * v1 - ic1
            ic2 = 2 * v2 - ic2
            out[i] = xs[i] - kl * v1 - v2
    return out


def spectral(x, fn):
    """Zero-phase static filter: multiply the spectrum by fn(freqs_hz)."""
    n = len(x)
    X = np.fft.rfft(x)
    X *= fn(np.fft.rfftfreq(n, 1 / SR))
    return np.fft.irfft(X, n)


def lowpass(x, fc, order=2):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def highpass(x, fc, order=2):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))


def bandpass(x, lo, hi, order=2):
    return highpass(lowpass(x, hi, order), lo, order)


def notches(x, freqs, width=2.0, depth_db=40.0):
    """Zero-phase narrow notches (Gaussian, `width` Hz standard deviation) for hum
    removal; 1 s of zero padding keeps their long impulse response from wrapping."""
    n = len(x)
    m = 1 << (n + SR - 1).bit_length()
    f = np.fft.rfftfreq(m, 1 / SR)
    H = np.ones_like(f)
    for fc in freqs:
        H *= 1 - (1 - 10 ** (-depth_db / 20)) * np.exp(-0.5 * ((f - fc) / width) ** 2)
    return np.fft.irfft(np.fft.rfft(x, m) * H, m)[:n]


# ---------------------------------------------------------------- space etc.

def pan(mono, p) -> np.ndarray:
    """Equal-power pan; p in [-1, 1] (scalar or per-sample)."""
    p = np.clip(np.broadcast_to(np.asarray(p, float), mono.shape), -1, 1)
    a = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], axis=1)


def stereo_spread(mono, name, width=0.6, delay_ms=11.0):
    """Decorrelated stereo from mono (Haas-style + gentle comb), centred."""
    d = samples(delay_ms / 1000)
    r = np.concatenate([np.zeros(d), mono[:-d]]) if d else mono
    side = (mono - r) * 0.5 * width
    mid = mono
    return np.stack([mid + side, mid - side], axis=1) / (1 + width * 0.3)


def make_ir(seconds=1.4, name="ir", predelay=0.012, damp=6000.0, density=1.0):
    n = samples(seconds)
    out = np.zeros((n, 2))
    t = t_axis(n)
    for ch in range(2):
        noise = white(n, f"{name}-{ch}")
        tail = noise * np.exp(-t / (seconds / 6.9))  # -60 dB at `seconds`
        tail = lowpass(tail, damp, 1)
        out[:, ch] = tail
    pd = samples(predelay)
    out = np.concatenate([np.zeros((pd, 2)), out])[:n]
    # a few early reflections
    r = rng(name + "-er")
    for _ in range(int(8 * density)):
        k = int(r.uniform(0.004, 0.045) * SR)
        out[k, r.integers(0, 2)] += r.uniform(0.2, 0.5)
    return out / np.sqrt(np.sum(out ** 2) / 2)


def convolve(stereo, ir, wet=0.25):
    n = len(stereo) + len(ir) - 1
    m = 1 << (n - 1).bit_length()
    out = np.zeros((n, 2))
    for ch in range(2):
        out[:, ch] = np.fft.irfft(np.fft.rfft(stereo[:, ch], m) * np.fft.rfft(ir[:, ch], m), m)[:n]
    dry = np.zeros((n, 2))
    dry[: len(stereo)] = stereo
    return dry * (1 - wet) + out * wet


def soft_clip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


def peak_db(x):
    p = np.max(np.abs(x))
    return 20 * np.log10(p) if p > 0 else -np.inf


def normalize(x, peak_dbfs=-6.0):
    p = np.max(np.abs(x))
    return x * (10 ** (peak_dbfs / 20) / p) if p > 0 else x


def mix(*items, n=None):
    """Sum (signal, start_seconds, gain) items into one buffer (mono or stereo)."""
    stereo = any(sig.ndim == 2 for sig, *_ in items)
    end = max(samples(st) + len(sig) for sig, st, *_ in items)
    n = n or end
    out = np.zeros((n, 2) if stereo else n)
    for sig, st, *g in items:
        gain = g[0] if g else 1.0
        if stereo and sig.ndim == 1:
            sig = np.stack([sig, sig], 1) * math.sqrt(0.5)
        s0 = samples(st)
        k = min(len(sig), n - s0)
        out[s0:s0 + k] += sig[:k] * gain
    return out


def write_wav(path, x, bits=24, mono=False):
    """24- or 16-bit PCM WAV at 48 kHz; mono input is written as two identical
    channels unless mono=True."""
    x = np.asarray(x, float)
    if x.ndim == 1 and not mono:
        x = np.stack([x, x], 1)
    nch = 1 if x.ndim == 1 else x.shape[1]
    x = np.clip(x, -1, 1 - 2 ** -(bits - 1))
    if bits == 24:
        q = np.round(x * (2 ** 23)).astype(np.int32)
        b = q.astype("<i4").view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    else:
        b = np.round(x * 32767).astype("<i2").tobytes()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(nch)
        w.setsampwidth(bits // 8)
        w.setframerate(SR)
        w.writeframes(b)
