#!/usr/bin/env python3
"""Procedural sound synthesis for Parasite Apocalypse Survival.

Every sound shipped in addon/resource_pack/sounds/pas/ is rendered here from
scratch with numpy DSP (noise, state-variable filters, FM, glottal pulse
trains with formant filters, granular clicks, bubble chirps, envelopes and a
synthetic convolution reverb). No sample material is used.

Output: MONO 44.1 kHz OGG Vorbis (ffmpeg libvorbis -q:a 4, bit-exact muxing),
peak-normalised to -1 dBFS, DC-free, with short fades. Each file has its own
deterministic seed (crc32 of its path), so re-running produces identical PCM.

Also writes the two fragments owned by the audio workstream:
  addon/fragments/sound_definitions/pas.json
  addon/fragments/sounds/pas.json

Usage:
  python3 tools/audio/synth.py            # render everything + fragments
  python3 tools/audio/synth.py --only parasite/hurt --wav-dir /tmp/x
  python3 tools/audio/synth.py --defs-only
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
import zlib
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True  # keep tools/audio free of __pycache__
sys.path.insert(0, str(Path(__file__).resolve().parent))
import catalog  # noqa: E402

SR = catalog.SAMPLE_RATE
TAU = 2.0 * np.pi
ROOT = Path(__file__).resolve().parents[2]
SOUND_DIR = ROOT / "addon" / "resource_pack" / "sounds" / "pas"
FRAG_DEFS = ROOT / "addon" / "fragments" / "sound_definitions" / "pas.json"
FRAG_SOUNDS = ROOT / "addon" / "fragments" / "sounds" / "pas.json"


# =============================================================================
# DSP primitives
# =============================================================================

def ns(d: float) -> int:
    return max(1, int(round(d * SR)))


def tvec(n: int) -> np.ndarray:
    return np.arange(n) / SR


def place(buf: np.ndarray, sig: np.ndarray, at: float, gain: float = 1.0) -> None:
    """Mix ``sig`` into ``buf`` starting at ``at`` seconds (clipped to buf)."""
    i = int(round(at * SR))
    if i >= buf.size or i < 0:
        return
    n = min(sig.size, buf.size - i)
    buf[i:i + n] += gain * sig[:n]


def norm(x: np.ndarray, peak: float = 1.0) -> np.ndarray:
    m = float(np.max(np.abs(x))) if x.size else 0.0
    return x * (peak / m) if m > 1e-12 else x


def env(n: int, pts) -> np.ndarray:
    """Piecewise-linear envelope from (time, value) breakpoints."""
    ts = [p[0] for p in pts]
    vs = [p[1] for p in pts]
    return np.interp(tvec(n), ts, vs)


def smooth_noise(rng, n: int, rate: float, lo: float = -1.0, hi: float = 1.0) -> np.ndarray:
    """Band-limited random control signal (cosine-interpolated random points)."""
    k = int(n / SR * rate) + 3
    pts = rng.uniform(lo, hi, k)
    x = tvec(n) * rate
    i = np.floor(x).astype(int)
    f = x - i
    f = (1.0 - np.cos(np.pi * f)) * 0.5
    return pts[i] * (1.0 - f) + pts[i + 1] * f


def _spectral(x: np.ndarray, gain_fn) -> np.ndarray:
    """Zero-phase static filter applied in the frequency domain (padded)."""
    n = x.size
    nfft = 1 << int(np.ceil(np.log2(max(2 * n, 64))))
    spec = np.fft.rfft(x, nfft)
    f = np.fft.rfftfreq(nfft, 1.0 / SR)
    return np.fft.irfft(spec * gain_fn(f), nfft)[:n]


def lowpass(x, fc, order=2):
    return _spectral(x, lambda f: 1.0 / np.sqrt(1.0 + (f / fc) ** (2 * order)))


def highpass(x, fc, order=2):
    return _spectral(x, lambda f: 1.0 / np.sqrt(1.0 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))


def bandpass(x, fc, q):
    return _spectral(x, lambda f: 1.0 / np.sqrt(1.0 + q * q * (f / fc - fc / np.maximum(f, 1e-3)) ** 2))


def fftconv(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    n = a.size + b.size - 1
    nfft = 1 << int(np.ceil(np.log2(n)))
    return np.fft.irfft(np.fft.rfft(a, nfft) * np.fft.rfft(b, nfft), nfft)[:n]


def svf(x, fc, q, mode: str = "bp") -> np.ndarray:
    """Causal TPT state-variable filter with per-sample cutoff/Q.

    mode: "lp", "bp" (unity peak gain), "hp".
    """
    x = np.asarray(x, dtype=np.float64)
    n = x.size
    fc = np.clip(np.broadcast_to(np.asarray(fc, dtype=np.float64), (n,)), 5.0, SR * 0.45)
    q = np.broadcast_to(np.asarray(q, dtype=np.float64), (n,))
    g = np.tan(np.pi * fc / SR)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k))
    a2 = g * a1
    a3 = g * a2
    xl, a1l, a2l, a3l = x.tolist(), a1.tolist(), a2.tolist(), a3.tolist()
    lp = [0.0] * n
    bp = [0.0] * n
    ic1 = ic2 = 0.0
    for i in range(n):
        v3 = xl[i] - ic2
        v1 = a1l[i] * ic1 + a2l[i] * v3
        v2 = ic2 + a2l[i] * ic1 + a3l[i] * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        bp[i] = v1
        lp[i] = v2
    lpa = np.asarray(lp)
    bpa = np.asarray(bp)
    if mode == "lp":
        return lpa
    if mode == "bp":
        return bpa * k
    if mode == "hp":
        return x - k * bpa - lpa
    raise ValueError(mode)


def white(rng, n: int) -> np.ndarray:
    return rng.standard_normal(n)


def pink(rng, n: int) -> np.ndarray:
    return norm(_spectral(rng.standard_normal(n), lambda f: 1.0 / np.sqrt(np.maximum(f, 20.0))))


def brown(rng, n: int) -> np.ndarray:
    return norm(_spectral(rng.standard_normal(n), lambda f: 1.0 / np.maximum(f, 15.0)))


def osc_phase(freq) -> np.ndarray:
    return TAU * np.cumsum(np.asarray(freq, dtype=np.float64)) / SR


def saturate(x: np.ndarray, drive: float) -> np.ndarray:
    return np.tanh(drive * x) / np.tanh(drive)


def fades(x: np.ndarray, fin: float, fout: float) -> np.ndarray:
    x = x.copy()
    a = min(ns(fin), x.size // 2)
    b = min(ns(fout), x.size // 2)
    if a > 1:
        x[:a] *= 0.5 - 0.5 * np.cos(np.linspace(0.0, np.pi, a))
    if b > 1:
        x[-b:] *= 0.5 + 0.5 * np.cos(np.linspace(0.0, np.pi, b))
    return x


# =============================================================================
# Sound-design building blocks
# =============================================================================

def damped_sine(f0: float, tau: float, dur: float | None = None, f1: float | None = None,
                phase: float = 0.0) -> np.ndarray:
    dur = dur if dur is not None else tau * 7.0
    n = ns(dur)
    t = tvec(n)
    if f1 is None:
        ph = TAU * f0 * t + phase
    else:
        ph = osc_phase(f0 * (f1 / f0) ** (t / dur)) + phase
    return np.sin(ph) * np.exp(-t / tau)


def click(rng, f: float, tau: float, noise: float = 0.35) -> np.ndarray:
    """Chitin tick: damped resonance plus a sub-millisecond noise spike."""
    s = damped_sine(f, tau, phase=rng.uniform(0.0, TAU))
    t = tvec(s.size)
    s = s + noise * rng.standard_normal(s.size) * np.exp(-t / 0.0005)
    s[:3] *= np.array([0.3, 0.7, 0.9])[: min(3, s.size)]
    return s


def bubble(rng, f0: float, tau: float, rise: float | None = None) -> np.ndarray:
    """Liquid bubble: rising-pitch sinusoid with exponential decay."""
    rise = rng.uniform(0.6, 2.2) if rise is None else rise
    dur = tau * 6.0
    n = ns(dur)
    t = tvec(n)
    f = f0 * (1.0 + rise * t / dur)
    s = np.sin(osc_phase(f)) * np.exp(-t / tau)
    a = min(ns(0.0015), n)
    s[:a] *= np.linspace(0.0, 1.0, a)
    return s


def squelch(rng, dur: float, f_start: float, f_end: float, q: float) -> np.ndarray:
    """Wet squelch: noise burst through a resonant band-pass sweeping down/up."""
    n = ns(dur)
    t = tvec(n)
    fc = f_start * (f_end / f_start) ** (t / dur)
    e = np.minimum(t / 0.004, 1.0) * np.exp(-t / (dur * 0.35))
    return norm(svf(rng.standard_normal(n) * e, fc, q))


def chitter(rng, count: int, rate: float, f: float, tau=(0.0012, 0.0028)) -> np.ndarray:
    """A burst of mandible clicks at ``rate`` Hz with jitter and a swell."""
    period = 1.0 / rate
    total = period * (count + 2)
    out = np.zeros(ns(total))
    tcur = 0.0
    for k in range(count):
        shape = np.sin(np.pi * (k + 0.5) / count) ** 0.6
        amp = shape * rng.uniform(0.55, 1.0)
        fk = f * rng.uniform(0.85, 1.15)
        place(out, click(rng, fk, rng.uniform(*tau)), tcur, amp)
        tcur += period * rng.uniform(0.7, 1.3)
    return out


def crackle(rng, n: int, rate_env: np.ndarray, burst=0.0015) -> np.ndarray:
    """Poisson crackle (tearing/ripping): random short noise grains."""
    hits = rng.random(n) < (rate_env / SR)
    imp = np.zeros(n)
    idx = np.nonzero(hits)[0]
    imp[idx] = rng.uniform(0.3, 1.0, idx.size) * rng.choice([-1.0, 1.0], idx.size)
    kn = ns(burst * 4)
    kt = tvec(kn)
    kernel = rng.standard_normal(kn) * np.exp(-kt / burst)
    return fftconv(imp, kernel)[:n]


def thump(rng, f0: float, f1: float, tau: float, drive: float = 2.5) -> np.ndarray:
    """Low body thump; saturated so harmonics survive small phone speakers."""
    dur = tau * 6.0
    n = ns(dur)
    t = tvec(n)
    f = f1 + (f0 - f1) * np.exp(-t / (tau * 0.6))
    body = np.sin(osc_phase(f)) * np.exp(-t / tau)
    a = min(ns(0.003), n)
    body[:a] *= np.linspace(0.0, 1.0, a)
    knock = lowpass(rng.standard_normal(n) * np.exp(-t / 0.012), 700.0)
    s = body + 0.25 * norm(knock)
    return saturate(norm(s), drive)


def fm_voice(rng, n: int, f: np.ndarray, ratio: float, index: np.ndarray) -> np.ndarray:
    f = f * (1.0 + 0.02 * smooth_noise(rng, n, 30.0) + 0.012 * smooth_noise(rng, n, 140.0))
    return np.sin(osc_phase(f) + index * np.sin(osc_phase(f * ratio)))


def rasp(rng, n: int, rate, depth: float) -> np.ndarray:
    """Insect/throat rattle amplitude modulation."""
    r = np.broadcast_to(np.asarray(rate, dtype=np.float64), (n,)) * (1.0 + 0.2 * smooth_noise(rng, n, 8.0))
    return 1.0 - depth * (0.5 + 0.5 * np.sin(osc_phase(r)))


def screech(rng, dur: float, f0: float, contour, ratio: float, index_pts, rasp_hz=45.0,
            rasp_depth=0.5) -> np.ndarray:
    n = ns(dur)
    f = f0 * env(n, contour)
    idx = env(n, index_pts)
    y = fm_voice(rng, n, f, ratio, idx)
    y += 0.4 * fm_voice(rng, n, f * 1.5 * 1.012, ratio * 0.97, idx * 0.8)
    nb = bandpass(rng.standard_normal(n), float(np.mean(f)) * 1.3, 2.5)
    y = norm(y) + 0.35 * norm(nb)
    y *= rasp(rng, n, rasp_hz, rasp_depth)
    return y


def glottal(rng, f0: np.ndarray, jitter=0.02, shimmer=0.1, sub=0.0, open_q=0.6) -> np.ndarray:
    """Rosenberg glottal-pulse train (derivative) with jitter, shimmer and
    period-doubling (``sub``: scalar or per-sample array) for vocal-fry growl."""
    n = f0.size
    f = f0 * (1.0 + jitter * smooth_noise(rng, n, 60.0))
    ph = np.cumsum(f / SR)
    period = np.floor(ph).astype(int)
    frac = ph - period
    tp = open_q * 0.7
    tn = open_q * 0.3
    g = np.where(frac < tp, 0.5 * (1.0 - np.cos(np.pi * frac / tp)),
                 np.where(frac < tp + tn, np.cos(0.5 * np.pi * (frac - tp) / tn), 0.0))
    npd = int(period[-1]) + 2
    amp = np.clip(1.0 + shimmer * rng.standard_normal(npd), 0.2, 2.0)
    subv = np.broadcast_to(np.asarray(sub, dtype=np.float64), (n,))
    odd = (period % 2 == 1)
    g = g * amp[period] * np.where(odd, 1.0 - subv, 1.0)
    d = np.diff(g, prepend=g[0])
    return norm(d)


VOWELS = {  # F1, F2, F3 (Hz) - adult male-ish, scaled later for a bigger "throat"
    "uh": (640.0, 1190.0, 2390.0),
    "oh": (500.0, 900.0, 2400.0),
    "oo": (360.0, 760.0, 2300.0),
    "ah": (760.0, 1150.0, 2450.0),
    "eh": (560.0, 1600.0, 2500.0),
}
BANDWIDTHS = (90.0, 130.0, 220.0)
FORMANT_GAINS = (1.0, 0.55, 0.22)


def formant_voice(rng, src: np.ndarray, v_from: str, v_to: str, scale: float,
                  morph_pts=None) -> np.ndarray:
    n = src.size
    m = env(n, morph_pts or [(0.0, 0.0), (n / SR, 1.0)])
    m = m * m * (3.0 - 2.0 * m)
    out = np.zeros(n)
    wob = 1.0 + 0.03 * smooth_noise(rng, n, 3.0)
    for i in range(3):
        fa = VOWELS[v_from][i] * scale
        fb = VOWELS[v_to][i] * scale
        fc = (fa + (fb - fa) * m) * wob
        q = np.clip(fc / BANDWIDTHS[i], 1.5, 20.0)
        out += FORMANT_GAINS[i] * svf(src, fc, q)
    out += 0.35 * lowpass(src, 260.0)
    return out


def gurgle(rng, dur: float, density: float, f_lo: float, f_hi: float,
           tau=(0.02, 0.05), density_env=None) -> np.ndarray:
    """Wet gurgle: a Poisson stream of bubbles plus sloshing low noise."""
    n = ns(dur)
    out = np.zeros(n)
    count = int(density * dur) + 1
    times = np.sort(rng.uniform(0.0, dur, count))
    for tt in times:
        if density_env is not None and rng.random() > np.interp(tt, *density_env):
            continue
        b = bubble(rng, rng.uniform(f_lo, f_hi), rng.uniform(*tau))
        place(out, b, tt, rng.uniform(0.3, 1.0))
    slosh = lowpass(rng.standard_normal(n), f_hi * 0.9)
    am = np.clip(smooth_noise(rng, n, 6.0, -0.3, 1.0), 0.0, None) ** 2
    out = norm(out) + 0.45 * norm(slosh * am)
    return out


def reverb(x: np.ndarray, rng, rt60: float, wet: float, damp: float = 0.45,
           predelay: float = 0.012) -> np.ndarray:
    """Synthetic convolution reverb (exponentially decaying noise IR whose
    highs decay faster). Returns dry + wet with the tail appended."""
    n_ir = ns(rt60)
    t = tvec(n_ir)
    nz = rng.standard_normal(n_ir)
    lo = lowpass(nz, 2200.0)
    hi = nz - lo
    ir = lo * np.exp(-6.9 * t / rt60) + hi * np.exp(-6.9 * t / (rt60 * damp))
    a = min(ns(0.004), n_ir)
    ir[:a] *= np.linspace(0.0, 1.0, a)
    ir = np.concatenate([np.zeros(ns(predelay)), ir])
    ir /= np.sqrt(np.sum(ir ** 2))
    w = fftconv(x, ir)
    dry = np.concatenate([x, np.zeros(w.size - x.size)])
    return dry + wet * w * (np.max(np.abs(x)) / max(np.max(np.abs(w)), 1e-12))


def finish(x: np.ndarray, max_dur: float, fade_in: float = 0.001, fade_out: float = 0.03,
           peak_dbfs: float = catalog.PEAK_DBFS, tail_db: float = -52.0) -> np.ndarray:
    """DC removal, silence trim, length cap, click-free fades, peak normalise."""
    x = np.asarray(x, dtype=np.float64)
    pad = np.zeros(ns(0.008))
    x = np.concatenate([pad, x - np.mean(x), pad])  # room for pre-roll and codec ringing
    x = highpass(x, 28.0, order=2)
    peak = np.max(np.abs(x))
    thr = peak * 10 ** (tail_db / 20.0)
    above = np.nonzero(np.abs(x) > thr)[0]
    start = max(0, int(above[0]) - ns(0.004))  # 4 ms pre-roll keeps attacks intact
    end = min(x.size, int(above[-1]) + ns(0.005))
    x = x[start:end]
    if x.size > ns(max_dur - 0.004):
        x = x[:ns(max_dur - 0.004)]
        fade_out = max(fade_out, 0.08)
    fo = min(fade_out, x.size / SR * 0.25)
    x = fades(x, fade_in, fo)
    x = x - np.mean(x) * np.hanning(x.size) / np.mean(np.hanning(x.size))
    x = np.concatenate([x, np.zeros(ns(0.004))])  # silent tail so the decoder ends at zero
    x = norm(x, 10 ** (peak_dbfs / 20.0))
    assert np.all(np.isfinite(x))
    return x


# =============================================================================
# Recipes: one function per sound id; ``v`` = 0-based variant index.
# =============================================================================

def parasite_ambient(rng, v):
    style = v % 4  # 0 hiss-led, 1 chitter-led, 2 wet-led, 3 mixed
    dur = rng.uniform(0.85, 1.25)
    n = ns(dur)
    out = np.zeros(n)
    # throaty hiss bed with a rattle
    hs = lowpass(highpass(white(rng, n), rng.uniform(2600, 3800)), rng.uniform(7000, 9000), 3) \
        + 0.4 * bandpass(white(rng, n), 1500, 1.2)
    a0 = rng.uniform(0.0, dur * 0.4)
    a1 = min(dur, a0 + rng.uniform(0.35, 0.7))
    hiss_env = env(n, [(0, 0), (a0, 0), (a0 + 0.12, 1), (a1, 0.7), (min(dur, a1 + 0.15), 0), (dur, 0)])
    hs = norm(hs) * hiss_env * rasp(rng, n, rng.uniform(22, 34), 0.55)
    out += [0.55, 0.25, 0.25, 0.4][style] * hs
    # chitter bursts
    for _ in range(int(rng.integers(2, 5)) + (1 if style == 1 else 0)):
        b = chitter(rng, int(rng.integers(5, 15)), rng.uniform(28, 62), rng.uniform(2600, 5200))
        place(out, norm(b), rng.uniform(0.0, max(0.01, dur - 0.3)), rng.uniform(0.45, 0.9) * (1.2 if style == 1 else 0.8))
    # wet clicks / bubbles
    for _ in range(int(rng.integers(3, 8)) + (4 if style == 2 else 0)):
        if rng.random() < 0.5:
            s = bubble(rng, rng.uniform(450, 1400), rng.uniform(0.008, 0.022))
        else:
            s = squelch(rng, rng.uniform(0.02, 0.05), rng.uniform(1500, 2600), rng.uniform(380, 800), rng.uniform(4, 8))
        place(out, norm(s), rng.uniform(0.0, dur - 0.08), rng.uniform(0.25, 0.6) * (1.3 if style == 2 else 1.0))
    # faint low throat purr
    purr = bandpass(white(rng, n), rng.uniform(220, 380), 3.0) * rasp(rng, n, rng.uniform(26, 40), 0.9)
    out += 0.12 * norm(purr) * env(n, [(0, 0), (0.15, 1), (dur - 0.15, 1), (dur, 0)])
    out = lowpass(out, 11000.0)
    out = reverb(out, rng, 0.35, 0.12)
    return finish(out, 1.55)


def parasite_hurt(rng, v):
    dur = rng.uniform(0.32, 0.48)
    f0 = rng.uniform(1500, 2200)
    ratio = [1.41, 1.73, 2.27, 1.5][v % 4] * rng.uniform(0.98, 1.02)
    y = screech(rng, dur, f0,
                [(0, 0.75), (0.035, 1.12), (0.09, 1.0), (dur, rng.uniform(0.6, 0.8))],
                ratio, [(0, 2.6), (dur, 0.8)], rng.uniform(35, 55), 0.5)
    n = y.size
    y *= env(n, [(0, 0), (0.006, 1), (0.04, 1), (dur * 0.6, 0.7), (dur, 0)])
    y = lowpass(saturate(norm(y), 1.6), 9000.0)
    out = np.zeros(n + ns(0.05))
    place(out, y, 0.004)
    place(out, norm(click(rng, rng.uniform(3500, 4500), 0.002)), 0.0, 0.6)
    out = reverb(out, rng, 0.3, 0.12)
    return finish(out, 0.75)


def parasite_death(rng, v):
    total = rng.uniform(1.15, 1.35)
    out = np.zeros(ns(total))
    # A: descending screech
    da = rng.uniform(0.5, 0.65)
    ya = screech(rng, da, rng.uniform(1500, 2000),
                 [(0, 1.05), (0.04, 1.15), (da, 0.35)], [1.41, 1.73, 2.27][v % 3],
                 [(0, 2.2), (da, 3.4)], np.linspace(50.0, 18.0, ns(da)), 0.55)
    ya *= env(ya.size, [(0, 0), (0.008, 1), (da * 0.5, 0.65), (da, 0)])
    place(out, saturate(norm(ya), 2.0), 0.0, 0.9)
    # B: resonant gurgle
    gb_start = rng.uniform(0.22, 0.32)
    gb_dur = total - gb_start - 0.1
    gn = ns(gb_dur)
    src = white(rng, gn)
    gb = np.zeros(gn)
    for _ in range(2):
        fc = rng.uniform(450, 800) * (1.0 + 0.45 * smooth_noise(rng, gn, 9.0))
        gb += svf(src, fc, rng.uniform(6, 9))
    bub_am = np.clip(smooth_noise(rng, gn, 16.0, -0.4, 1.0), 0, None) ** 2
    gb = norm(gb * bub_am) + 0.8 * norm(gurgle(rng, gb_dur, 22, 250, 900))
    gb *= env(gn, [(0, 0), (0.08, 1), (gb_dur * 0.6, 0.8), (gb_dur, 0)])
    place(out, norm(gb), gb_start, 0.75)
    # C: collapse - thud + chitin crunch
    tc = rng.uniform(0.82, 0.98)
    place(out, thump(rng, rng.uniform(75, 90), rng.uniform(38, 46), 0.09), tc, 0.8)
    crunch = np.zeros(ns(0.12))
    for _ in range(int(rng.integers(10, 17))):
        place(crunch, click(rng, rng.uniform(1500, 4200), rng.uniform(0.001, 0.003), 0.6),
              rng.uniform(0.0, 0.08), rng.uniform(0.3, 1.0))
    place(out, norm(crunch), tc + 0.005, 0.55)
    place(out, squelch(rng, 0.09, 1300, 300, 5), tc + 0.02, 0.35)
    out = reverb(out, rng, 0.5, 0.18)
    return finish(out, 1.75)


def parasite_attack(rng, v):
    out = np.zeros(ns(0.36))
    ts = rng.uniform(0.07, 0.1)
    # lunge hiss
    hn = ns(ts + 0.01)
    hiss = norm(highpass(white(rng, hn), rng.uniform(2200, 3200)))
    hiss *= env(hn, [(0, 0), (ts * 0.85, 0.5), (ts + 0.01, 0)])
    out[:hn] += 0.6 * hiss
    # double mandible snap
    f = rng.uniform(1700, 2600)
    tn = ns(0.012)
    trans = rng.standard_normal(tn) * np.exp(-tvec(tn) / 0.0008)
    place(out, norm(trans), ts, 0.9)
    place(out, norm(click(rng, f, 0.004, 0.5)), ts, 1.0)
    gap = rng.uniform(0.022, 0.042)
    place(out, norm(click(rng, f * rng.uniform(1.2, 1.4), 0.003, 0.5)), ts + gap, rng.uniform(0.55, 0.8))
    # wet squelch and punch
    place(out, squelch(rng, 0.06, rng.uniform(1200, 1700), rng.uniform(300, 420), 5), ts + 0.01, 0.4)
    place(out, thump(rng, 150, 60, 0.03, 3.0), ts, 0.45)
    out = reverb(out, rng, 0.2, 0.08)
    return finish(out, 0.45)


def parasite_step(rng, v):
    out = np.zeros(ns(0.2))
    tcur = 0.0
    k = int(rng.integers(3, 5))
    for i in range(k):
        g = 1.0 if i == 0 else rng.uniform(0.45, 0.9)
        place(out, norm(click(rng, rng.uniform(3000, 6500), rng.uniform(0.0007, 0.0018), 0.5)), tcur, g)
        tcur += rng.uniform(0.015, 0.035)
    sn = ns(0.03)
    scrape = norm(highpass(white(rng, sn), 4000)) * env(sn, [(0, 0), (0.005, 1), (0.03, 0)])
    place(out, scrape, rng.uniform(0.0, 0.02), 0.15)
    return finish(out, 0.2, fade_out=0.006)


def parasite_birth(rng, v):
    total = rng.uniform(0.95, 1.15)
    n = ns(total)
    out = np.zeros(n)
    tp = rng.uniform(0.42, 0.5)
    # tearing membrane: crackle rate ramps up, plus stretched resonant noise
    rate = env(n, [(0, 60), (tp - 0.05, 700), (tp, 900), (tp + 0.02, 0), (total, 0)])
    cr = bandpass(crackle(rng, n, rate), rng.uniform(1800, 2800), 1.2)
    place(out, norm(cr), 0.0, 0.55)
    mn = ns(tp + 0.03)
    fc = env(mn, [(0, 600), (tp, 2400)])
    memb = svf(white(rng, mn), fc, 4.0) * (1.0 + 0.6 * smooth_noise(rng, mn, 40.0))
    memb *= env(mn, [(0, 0), (tp * 0.8, 0.8), (tp, 1.0), (tp + 0.03, 0)])
    place(out, norm(memb), 0.0, 0.45)
    # the burst: big squelch + thump
    place(out, squelch(rng, 0.18, rng.uniform(1800, 2300), rng.uniform(240, 320), 7), tp, 1.0)
    place(out, thump(rng, 115, 55, 0.06), tp, 0.5)
    bn = ns(0.03)
    place(out, norm(lowpass(white(rng, bn) * np.exp(-tvec(bn) / 0.008), 1500)), tp, 0.5)
    # drips
    for _ in range(int(rng.integers(4, 8))):
        place(out, norm(bubble(rng, rng.uniform(600, 1600), rng.uniform(0.008, 0.02))),
              rng.uniform(tp + 0.05, total - 0.1), rng.uniform(0.2, 0.5))
    # newborn chitter
    nb = chitter(rng, int(rng.integers(4, 8)), rng.uniform(55, 70), rng.uniform(4500, 6000))
    place(out, norm(nb), rng.uniform(tp + 0.25, tp + 0.4), 0.35)
    out = reverb(out, rng, 0.4, 0.15)
    return finish(out, 1.4)


def _moan(rng, dur, f0, contour, v_from, v_to, scale, sub, jitter, shimmer, drive, growl_hz, growl_depth):
    n = ns(dur)
    f = f0 * env(n, contour) * (1.0 + 0.015 * np.sin(TAU * rng.uniform(4, 6) * tvec(n)))
    f *= 1.0 + 0.02 * smooth_noise(rng, n, 2.5)
    src = glottal(rng, f, jitter=jitter, shimmer=shimmer, sub=sub)
    voiced = formant_voice(rng, src, v_from, v_to, scale)
    breath = bandpass(white(rng, n), VOWELS[v_from][0] * scale, 2.0) + 0.5 * bandpass(white(rng, n), VOWELS[v_from][1] * scale, 3.0)
    y = norm(voiced) + 0.07 * norm(breath)
    y *= rasp(rng, n, growl_hz, growl_depth)
    return lowpass(saturate(norm(y), drive), 3800.0)


def infected_ambient(rng, v):
    dur = rng.uniform(1.05, 1.3)
    vowels = [("uh", "oh"), ("oh", "oo"), ("ah", "uh"), ("eh", "oh")][v % 4]
    f0 = rng.uniform(68, 92)
    contour = [(0, rng.uniform(0.88, 0.95)), (dur * 0.25, rng.uniform(1.03, 1.1)),
               (dur * 0.6, 1.0), (dur, rng.uniform(0.78, 0.88))]
    voice = _moan(rng, dur, f0, contour, vowels[0], vowels[1], rng.uniform(0.82, 0.9),
                  rng.uniform(0.25, 0.55), 0.025, 0.12, 1.8, rng.uniform(20, 28), 0.3)
    n = voice.size
    voice *= env(n, [(0, 0), (0.12, 0.8), (dur * 0.35, 1.0), (dur * 0.75, 0.85), (dur, 0)])
    wet = gurgle(rng, dur, rng.uniform(8, 14), 140, 380, (0.03, 0.06))
    out = norm(voice) + 0.28 * norm(wet) * env(n, [(0, 0), (0.2, 1), (dur, 0.6)])
    out = reverb(out, rng, 0.6, 0.16)
    return finish(out, 1.6, fade_out=0.06)


def infected_hurt(rng, v):
    dur = rng.uniform(0.38, 0.52)
    f0 = rng.uniform(85, 100)
    contour = [(0, 1.0), (0.04, rng.uniform(1.75, 2.0)), (0.12, 1.6), (dur, 0.95)]
    voice = _moan(rng, dur, f0, contour, "ah", "uh", 0.9, 0.3, 0.04, 0.2, 2.8,
                  rng.uniform(26, 36), 0.4)
    n = voice.size
    voice *= env(n, [(0, 0), (0.015, 1), (0.15, 0.9), (dur, 0)])
    out = np.zeros(n + ns(0.05))
    place(out, voice, 0.0)
    place(out, squelch(rng, 0.05, rng.uniform(1000, 1400), 400, 3), 0.0, 0.5)
    sn = ns(0.02)
    place(out, norm(white(rng, sn) * np.exp(-tvec(sn) / 0.004)), 0.0, 0.3)
    out = reverb(out, rng, 0.35, 0.12)
    return finish(out, 0.75)


def infected_death(rng, v):
    total = rng.uniform(1.25, 1.4)
    out = np.zeros(ns(total))
    dv = rng.uniform(0.95, 1.05)
    n = ns(dv)
    f0 = rng.uniform(80, 92)
    contour = [(0, 1.4), (0.08, 1.6), (0.4, 1.1), (dv, 0.55)]
    sub = env(n, [(0, 0.2), (dv, 0.75)])
    f = f0 * env(n, contour) * (1.0 + 0.03 * smooth_noise(rng, n, 3.0))
    src = glottal(rng, f, jitter=0.035, shimmer=0.2, sub=sub)
    voiced = formant_voice(rng, src, ["ah", "uh", "eh"][v % 3], "oo", 0.88)
    voiced = norm(voiced) * rasp(rng, n, env(n, [(0, 30), (dv, 14)]), 0.45)
    voiced = lowpass(saturate(norm(voiced), 2.2), 3800.0) * env(n, [(0, 0), (0.05, 1), (0.5, 0.75), (dv, 0)])
    place(out, voiced, 0.0, 1.0)
    # death rattle gurgle
    gd = total - 0.5
    gn = ns(gd)
    gg = gurgle(rng, gd, 26, 150, 500, (0.025, 0.05))
    place(out, gg * env(gn, [(0, 0), (gd * 0.6, 1), (gd, 0)]), 0.5, 0.45)
    # collapse
    tc = rng.uniform(0.98, 1.12)
    place(out, thump(rng, 70, 38, 0.12), tc, 0.85)
    fn = ns(0.25)
    fall = lowpass(white(rng, fn), 300) * np.exp(-tvec(fn) / 0.05)
    place(out, norm(fall), tc, 0.5)
    out = reverb(out, rng, 0.6, 0.18)
    return finish(out, 1.75, fade_out=0.08)


def infection_start(rng, v):
    out = np.zeros(ns(1.0))
    # sting: transient + falling needle + metallic ring
    tn = ns(0.015)
    place(out, norm(highpass(white(rng, tn), 3000) * np.exp(-tvec(tn) / 0.001)), 0.0, 0.7)
    place(out, norm(damped_sine(rng.uniform(5200, 6200), 0.03, 0.1, f1=rng.uniform(2500, 3000))), 0.0, 0.8)
    fr = rng.uniform(2200, 2800)
    for ratio, tau, amp in ((1.0, 0.1, 0.35), (2.76, 0.06, 0.22), (5.4, 0.035, 0.12)):
        place(out, damped_sine(fr * ratio, tau, tau * 6, phase=rng.uniform(0, TAU)), 0.002, amp)
    place(out, squelch(rng, 0.06, 1800, 600, 4), 0.03, 0.3)
    # heartbeat: strong lub, soft dub
    tb = rng.uniform(0.22, 0.28)
    place(out, thump(rng, rng.uniform(60, 66), 42, 0.11, 3.0), tb, 1.0)
    place(out, thump(rng, rng.uniform(70, 76), 50, 0.08, 3.0), tb + rng.uniform(0.19, 0.23), 0.45)
    out = reverb(out, rng, 0.45, 0.15)
    return finish(out, 1.2, fade_out=0.06)


def infection_convert(rng, v):
    total = rng.uniform(1.1, 1.25)
    n = ns(total)
    out = np.zeros(n)
    # rip
    rn = ns(0.55)
    rip_src = white(rng, rn) * env(rn, [(0, 0), (0.006, 1), (0.25, 0.35), (0.55, 0)])
    fc = env(rn, [(0, 500), (0.18, rng.uniform(2800, 3600)), (0.55, 1500)])
    rip = svf(rip_src, fc, 1.8)
    place(out, norm(rip), 0.0, 0.85)
    rate = env(n, [(0, 900), (0.35, 100), (0.5, 0), (total, 0)])
    place(out, norm(bandpass(crackle(rng, n, rate), 2000, 1.0)), 0.0, 0.5)
    # boom
    place(out, thump(rng, rng.uniform(55, 62), 30, 0.25, 2.2), 0.0, 0.9)
    bn = ns(0.6)
    place(out, norm(lowpass(brown(rng, bn), 200) * np.exp(-tvec(bn) / 0.15)), 0.0, 0.5)
    # gore splats
    for _ in range(int(rng.integers(8, 15))):
        if rng.random() < 0.6:
            s = squelch(rng, rng.uniform(0.03, 0.08), rng.uniform(900, 1600), rng.uniform(250, 450), rng.uniform(3, 6))
        else:
            s = norm(bubble(rng, rng.uniform(300, 1500), rng.uniform(0.01, 0.03)))
        place(out, s, rng.uniform(0.08, 0.7), rng.uniform(0.2, 0.55))
    # screech overtone
    sc = screech(rng, 0.3, rng.uniform(1100, 1500), [(0, 1.1), (0.3, 0.6)], 1.73,
                 [(0, 2.5), (0.3, 1.5)], 40, 0.5)
    sc *= env(sc.size, [(0, 0), (0.02, 1), (0.3, 0)])
    place(out, norm(sc), 0.03, 0.25)
    out = reverb(out, rng, 0.8, 0.22)
    return finish(out, 1.6, fade_out=0.1)


def infection_heartbeat(rng, v):
    out = np.zeros(ns(0.75))
    place(out, thump(rng, rng.uniform(56, 60), 40, 0.10, 3.2), 0.01, 1.0)
    ln = ns(0.2)
    place(out, norm(lowpass(white(rng, ln), 180) * np.exp(-tvec(ln) / 0.04)), 0.01, 0.35)
    td = rng.uniform(0.23, 0.27)
    place(out, thump(rng, rng.uniform(66, 70), 48, 0.08, 3.2), 0.01 + td, 0.7)
    out = lowpass(out, 900)
    out = reverb(out, rng, 0.25, 0.06)
    return finish(out, 0.85, fade_out=0.06)


def outbreak_start(rng, v):
    dur = 3.25
    n = ns(dur)
    t = tvec(n)
    root = [55.0, 51.91][v % 2]
    sag = env(n, [(0, 1.0), (2.2, 1.0), (dur, 2 ** (-1.5 / 12))])
    voices = [(root, 1.0, 0.0), (root * 1.4983, 0.7, 0.0), (root * 2.0, 0.5, 0.0),
              (root * 2.0 * 1.0595, 0.18, 1.4)]  # minor-ninth dissonance enters late
    horn = np.zeros(n)
    for f, amp, t_in in voices:
        for det in (-0.0025, 0.0, 0.0025):
            ff = f * (1.0 + det + 0.002 * smooth_noise(rng, n, 0.7)) * sag
            ph = osc_phase(ff) + rng.uniform(0, TAU)
            nh = int(min(60, 9000.0 / f))
            saw = np.zeros(n)
            for h in range(1, nh + 1):
                saw += np.sin(h * ph) / h
            gate = np.clip((t - t_in) / 0.6, 0.0, 1.0)
            horn += amp * saw * gate
    fc = env(n, [(0, 180), (1.6, 1400), (2.3, 1800), (dur, 450)])
    horn = svf(horn, fc, 1.2, "lp")
    horn = norm(horn) * rasp(rng, n, 6.0, np.float64(0.12))
    horn = saturate(horn, 1.3)
    rumble = lowpass(brown(rng, n), 120)
    shimmer = (np.sin(TAU * 880 * t) + np.sin(TAU * 932.3 * t) + 0.5 * np.sin(TAU * 1244.5 * t))
    shimmer *= (0.6 + 0.4 * np.sin(TAU * 5.0 * t)) * env(n, [(0, 0), (1.2, 0), (2.4, 1), (dur, 0.6)])
    out = norm(horn) + 0.35 * norm(rumble) + 0.06 * norm(shimmer)
    out *= env(n, [(0, 0), (1.9, 1.0), (2.6, 0.9), (dur, 0.0)])
    out = reverb(out, rng, 1.6, 0.3, damp=0.35)
    return finish(out, 3.9, fade_in=0.01, fade_out=0.3)


def _switch(rng, f_press, f_latch, body_f, gap):
    out = np.zeros(ns(0.12))
    place(out, norm(click(rng, f_press, 0.0025, 0.6)), 0.0, 0.55)
    place(out, norm(damped_sine(body_f, 0.006)), 0.0, 0.25)
    latch = norm(click(rng, f_latch, 0.004, 0.5))
    partial = damped_sine(f_latch * 1.6, 0.002, latch.size / SR)
    latch = norm(latch + 0.5 * partial[: latch.size])
    place(out, latch, gap, 1.0)
    place(out, norm(damped_sine(f_latch * 1.45, 0.012)), gap, 0.1)
    out = reverb(out, rng, 0.12, 0.05)
    return finish(out, 0.18, fade_in=0.0005, fade_out=0.01)


def torch_on(rng, v):
    return _switch(rng, rng.uniform(2800, 3300), rng.uniform(4000, 4600), 950.0, rng.uniform(0.018, 0.026))


def torch_off(rng, v):
    return _switch(rng, rng.uniform(2000, 2300), rng.uniform(2600, 3000), 700.0, rng.uniform(0.022, 0.03))


def base_build(rng, v):
    dur = rng.uniform(1.7, 1.9)
    n = ns(dur)
    t = tvec(n)
    # whoosh
    fc = env(n, [(0, 250), (dur * 0.7, rng.uniform(2800, 3400)), (dur, 4500)])
    wh = svf(pink(rng, n), fc, 1.4) * env(n, [(0, 0), (dur * 0.5, 0.8), (dur * 0.75, 1.0), (dur, 0)])
    out = 0.6 * norm(wh)
    # shimmer: rising pentatonic notes (C major pentatonic, octaves 5-6)
    penta = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98]
    k = int(rng.integers(6, 9))
    offs = int(rng.integers(0, len(penta) - k + 1))
    for i in range(k):
        f = penta[offs + i]
        nd = ns(0.6)
        tt = tvec(nd)
        note = (np.sin(TAU * f * tt) + 0.5 * np.sin(TAU * f * 2.003 * tt)) * np.exp(-tt / 0.3)
        note *= np.minimum(tt / 0.01, 1.0) * (0.75 + 0.25 * np.sin(TAU * 9.0 * tt))
        place(out, norm(note), 0.15 + i * (dur * 0.7) / k + rng.uniform(-0.02, 0.02), 0.22)
    # wooden construction knocks
    for _ in range(int(rng.integers(3, 5))):
        f = rng.uniform(380, 650)
        kn = ns(0.175)
        knock = damped_sine(f, 0.025)[:kn]
        part = damped_sine(f * 2.3, 0.01, kn / SR)
        tick = lowpass(rng.standard_normal(kn) * np.exp(-tvec(kn) / 0.0015), 2000)
        knock = norm(knock + 0.4 * part[:kn] + 0.5 * norm(tick))
        place(out, knock, rng.uniform(0.1, dur * 0.7), rng.uniform(0.3, 0.45))
    out = reverb(out, rng, 1.0, 0.25)
    return finish(out, 2.4, fade_out=0.2)


def _bell(f, dur=1.6):
    n = ns(dur)
    t = tvec(n)
    s = np.zeros(n)
    for ratio, amp, tau in ((1.0, 1.0, 1.1), (2.0, 0.45, 0.6), (2.99, 0.25, 0.35), (4.16, 0.12, 0.22), (5.43, 0.06, 0.15)):
        s += amp * np.sin(TAU * f * ratio * t) * np.exp(-t / tau)
    s *= np.minimum(t / 0.002, 1.0)
    return s


def base_done(rng, v):
    out = np.zeros(ns(1.9))
    for f, at in ((1046.5, 0.0), (1318.5, 0.085), (1568.0, 0.17), (2093.0, 0.30)):
        place(out, norm(_bell(f)), at, 0.55 if f < 2000 else 0.45)
    pn = ns(1.3)
    tt = tvec(pn)
    pad = (np.sin(TAU * 523.25 * tt) + 0.6 * np.sin(TAU * 783.99 * tt)) * env(pn, [(0, 0), (0.05, 1), (0.5, 0.7), (1.3, 0)])
    place(out, norm(pad), 0.0, 0.15)
    out = reverb(out, rng, 1.0, 0.25)
    return finish(out, 2.2, fade_out=0.2)


def ui_open(rng, v):
    out = np.zeros(ns(0.22))
    for f, at, d in ((660.0, 0.0, 0.075), (990.0, 0.06, 0.11)):
        nd = ns(d)
        tt = tvec(nd)
        tone = np.sin(TAU * f * tt) + 0.15 * np.sin(TAU * 2 * f * tt) + 0.05 * np.sin(TAU * 3 * f * tt)
        tone *= np.sin(np.pi * tt / d) ** 1.5
        place(out, tone, at, 0.8)
    out = reverb(out, rng, 0.15, 0.06)
    return finish(out, 0.3, fade_in=0.003, fade_out=0.02)


RECIPES = {
    "pas.parasite.ambient": parasite_ambient,
    "pas.parasite.hurt": parasite_hurt,
    "pas.parasite.death": parasite_death,
    "pas.parasite.attack": parasite_attack,
    "pas.parasite.step": parasite_step,
    "pas.parasite.birth": parasite_birth,
    "pas.infected.ambient": infected_ambient,
    "pas.infected.hurt": infected_hurt,
    "pas.infected.death": infected_death,
    "pas.infection.start": infection_start,
    "pas.infection.convert": infection_convert,
    "pas.infection.heartbeat": infection_heartbeat,
    "pas.outbreak.start": outbreak_start,
    "pas.torch.on": torch_on,
    "pas.torch.off": torch_off,
    "pas.base.build": base_build,
    "pas.base.done": base_done,
    "pas.ui.open": ui_open,
}


# =============================================================================
# Output
# =============================================================================

def seed_for(stem: str) -> int:
    return zlib.crc32(stem.encode("utf-8"))


def to_pcm16(x: np.ndarray) -> bytes:
    return np.round(np.clip(x, -1.0, 1.0) * 32767.0).astype("<i2").tobytes()


def _encode_once(x: np.ndarray, path: Path) -> None:
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
           "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0",
           "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact",
           "-c:a", "libvorbis", "-q:a", "4", "-ar", str(SR), "-ac", "1", str(path)]
    subprocess.run(cmd, input=to_pcm16(x), check=True)


def decode_ogg(path: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1",
                          "-ar", str(SR), "pipe:1"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype="<f4").astype(np.float64)


def encode_ogg(x: np.ndarray, path: Path) -> float:
    """Encode, then correct the gain so the DECODED peak is about -1 dBFS
    (Vorbis smears transients and overshoots on dense material)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    target = catalog.PEAK_DBFS
    peak_db = target
    for _ in range(4):
        _encode_once(x, path)
        y = decode_ogg(path)
        peak_db = 20.0 * np.log10(max(float(np.max(np.abs(y))), 1e-9))
        if abs(peak_db - target) <= 0.25:
            break
        x = x * 10 ** ((target - 0.05 - peak_db) / 20.0)
        x = np.clip(x, -1.0, 1.0)
    return peak_db


def write_wav(x: np.ndarray, path: Path) -> None:
    import wave
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(to_pcm16(x))


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def write_fragments() -> None:
    write_json(FRAG_DEFS, catalog.build_sound_definitions())
    write_json(FRAG_SOUNDS, catalog.build_entity_sounds())
    print(f"wrote {FRAG_DEFS.relative_to(ROOT)} ({len(catalog.build_sound_definitions())} ids)")
    print(f"wrote {FRAG_SOUNDS.relative_to(ROOT)}")


def render(only: str | None, wav_dir: Path | None, clean: bool) -> int:
    if shutil.which("ffmpeg") is None:
        print("ffmpeg not found", file=sys.stderr)
        return 2
    expected = set()
    count = 0
    for spec in catalog.SOUNDS:
        recipe = RECIPES[spec["id"]]
        for v, stem in enumerate(catalog.file_stems(spec)):
            rel = stem[len("sounds/pas/"):]
            expected.add(rel + ".ogg")
            if only and not rel.startswith(only):
                continue
            t0 = time.time()
            rng = np.random.default_rng(seed_for(stem))
            x = recipe(rng, v)
            peak_db = encode_ogg(x, SOUND_DIR / f"{rel}.ogg")
            if wav_dir:
                write_wav(x, wav_dir / f"{rel}.wav")
            count += 1
            print(f"  {rel}.ogg  {x.size / SR:5.2f}s  peak {peak_db:5.2f} dBFS  ({time.time() - t0:4.1f}s)")
    if clean and not only:
        for p in sorted(SOUND_DIR.rglob("*.ogg")):
            if str(p.relative_to(SOUND_DIR)) not in expected:
                print(f"  removing stale {p.relative_to(ROOT)}")
                p.unlink()
    print(f"rendered {count} files into {SOUND_DIR.relative_to(ROOT)}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="render only files whose path starts with this (e.g. parasite/hurt)")
    ap.add_argument("--wav-dir", type=Path, help="also write 16-bit WAV copies here (for auditioning)")
    ap.add_argument("--defs-only", action="store_true", help="only write the two JSON fragments")
    ap.add_argument("--no-clean", action="store_true", help="keep stale .ogg files")
    args = ap.parse_args()
    if not args.defs_only:
        rc = render(args.only, args.wav_dir, not args.no_clean)
        if rc:
            return rc
    write_fragments()
    return 0


if __name__ == "__main__":
    sys.exit(main())
