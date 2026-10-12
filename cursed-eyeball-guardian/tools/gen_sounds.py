#!/usr/bin/env python3
"""Synthesise every custom sound of the Cursed Floating Eyeball Guardian (SPEC section 9).

Usage (from the repo root, i.e. the `cursed-eyeball-guardian` folder):

    python3 tools/gen_sounds.py                    # synthesise + encode everything, write JSON
    python3 tools/gen_sounds.py --wav-dir DIR      # also keep the 16-bit WAV masters in DIR
    python3 tools/gen_sounds.py --only laser_1 impact

Outputs (resource pack):
    sounds/ceg/<name>.ogg            Ogg Vorbis, mono, 44.1 kHz (ffmpeg libvorbis -q:a 4)
    sounds/sound_definitions.json    ids ceg.guardian.* (vanilla format_version 1.20.20 layout)
    sounds.json                      entity_sounds for ceg:eyeball_guardian (ambient/hurt/death)

Everything is procedural (numpy only, no samples) with a fixed random seed per sound, so the
output is deterministic.  ffmpeg runs with +bitexact so the Ogg container (stream serial
numbers, encoder tag) is reproducible too.  After encoding, every file is decoded again and
its peak is checked; if lossy-coding overshoot pushes it above the ceiling the master is
turned down and re-encoded (no clipping).

Requirements: python3, numpy, ffmpeg (with libvorbis) on PATH.

Sound design (all mono, mid-range heavy so they still read on a phone speaker):
    ambient_1   whispering ghost voices (formant-filtered noise, one voice reversed) + drone bed
    ambient_2   wet heartbeat: lub-dub thumps, squelches and gooey bubbles
    ambient_3   low detuned drone with slow beating, breathing resonant filter, distant whine
    hurt_1/2    squelchy wet creature screech
    death       descending distorted screech -> gooey pop -> rumble
    summon      rising dissonant chord + reverse swell + whoosh -> low boom + eerie sting
    laser_1/2   rising charge whine -> sharp zap with buzzy harmonics -> crackling beam fizz
    impact      explosion-like boom (low-passed noise burst + sub thump + crackle)
    rage        distorted roaring screech (formant roar + screech layer + growl)
    teleport    phasey whoosh with a pitch dive and a suction pop
    shield      humming energy pulse with a filter "whomp" and shimmer
    shield_hit  bright metallic ping + crackle
    heal        eerie glassy chime arpeggio (A minor-major)
    destroy     crunchy blast (bit-crushed noise, thump, falling debris)
    levelup     ascending ominous arpeggio (D harmonic minor) into a minor-major-7 chord
    mode        short eerie blip (tritone)
    menu        soft eerie bell
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import wave
import zlib
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RP = ROOT / "packs" / "Cursed_Eyeball_Guardian_RP"
SND_DIR = RP / "sounds" / "ceg"
SOUND_DEFS = RP / "sounds" / "sound_definitions.json"
SOUNDS_JSON = RP / "sounds.json"

SR = 44100
PEAK_DBFS = -1.0           # master peak target
DECODED_CEILING_DBFS = -0.3  # max allowed peak after Vorbis round trip
FFMPEG_ENCODE = ["-c:a", "libvorbis", "-q:a", "4", "-ac", "1", "-ar", str(SR)]
BITEXACT = ["-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact"]

TAU = 2.0 * np.pi


# =============================================================================================
# DSP toolkit (numpy only)
# =============================================================================================
def n_of(dur: float) -> int:
    return int(round(dur * SR))


def timeline(dur: float) -> np.ndarray:
    return np.arange(n_of(dur)) / SR


def peak_norm(x: np.ndarray, peak: float = 1.0) -> np.ndarray:
    m = float(np.max(np.abs(x))) if len(x) else 0.0
    return x * (peak / m) if m > 1e-12 else x


def place(buf: np.ndarray, t0: float, sig: np.ndarray, gain: float = 1.0) -> np.ndarray:
    """Mix `sig` into `buf` starting at `t0` seconds (truncated at the buffer end)."""
    i = n_of(t0)
    if i >= len(buf) or i < 0:
        return buf
    m = min(len(sig), len(buf) - i)
    buf[i:i + m] += gain * sig[:m]
    return buf


def pts(dur: float, points) -> np.ndarray:
    """Piecewise-linear curve through [(t, value), ...] sampled at audio rate."""
    ts, vs = zip(*points)
    return np.interp(timeline(dur), ts, vs)


def pts_exp(dur: float, points) -> np.ndarray:
    """Like pts() but interpolates in the log domain (good for frequency curves)."""
    ts, vs = zip(*points)
    return np.exp(np.interp(timeline(dur), ts, np.log(vs)))


def env_ar(dur: float, attack: float, tau: float, hold: float = 0.0) -> np.ndarray:
    """Smooth attack then exponential decay (time constant tau)."""
    t = timeline(dur)
    a = np.clip(t / max(attack, 1e-6), 0.0, 1.0)
    a = 0.5 - 0.5 * np.cos(np.pi * a)
    d = np.where(t < attack + hold, 1.0, np.exp(-(t - attack - hold) / tau))
    return a * d


def bump(t: np.ndarray, c: float, w: float) -> np.ndarray:
    """Raised-cosine bump centred on c with half-width w."""
    x = (t - c) / w
    return np.where(np.abs(x) < 1.0, 0.5 * (1.0 + np.cos(np.pi * x)), 0.0)


def wobble(n: int, rate: float, rng: np.random.Generator) -> np.ndarray:
    """Smooth random modulation in [-1, 1] changing roughly `rate` times per second."""
    k = int(n / SR * rate) + 3
    ctl = rng.uniform(-1.0, 1.0, k)
    pos = np.arange(n) / SR * rate
    i = np.floor(pos).astype(int)
    fr = pos - i
    fr = 0.5 - 0.5 * np.cos(np.pi * fr)
    return ctl[i] * (1.0 - fr) + ctl[i + 1] * fr


def phase_of(freq) -> np.ndarray:
    return TAU * np.cumsum(np.asarray(freq, float)) / SR


def const(f: float, dur: float) -> np.ndarray:
    return np.full(n_of(dur), float(f))


def sine(freq, phase0: float = 0.0) -> np.ndarray:
    return np.sin(phase_of(freq) + phase0)


def additive(freq, amp_of_k, kmax: int = 64) -> np.ndarray:
    """Band-limited additive oscillator; harmonics fade out before Nyquist (no aliasing)."""
    freq = np.asarray(freq, float)
    ph = phase_of(freq)
    kmax = min(kmax, int(0.46 * SR / max(float(freq.min()), 1.0)) + 1)
    out = np.zeros_like(freq)
    for k in range(1, kmax + 1):
        a = amp_of_k(k)
        if a == 0.0:
            continue
        mask = np.clip((0.46 * SR - k * freq) / (0.03 * SR), 0.0, 1.0)
        out += a * mask * np.sin(k * ph)
    return out


def saw(freq, kmax: int = 64) -> np.ndarray:
    return additive(freq, lambda k: 1.0 / k, kmax) * (2.0 / np.pi)


def square(freq, kmax: int = 64) -> np.ndarray:
    return additive(freq, lambda k: (1.0 / k) if k % 2 else 0.0, kmax) * (4.0 / np.pi)


def tri(freq, kmax: int = 24) -> np.ndarray:
    return additive(freq, lambda k: ((-1) ** ((k - 1) // 2)) / (k * k) if k % 2 else 0.0,
                    kmax) * (8.0 / np.pi ** 2)


def noise(dur: float, rng: np.random.Generator) -> np.ndarray:
    return rng.standard_normal(n_of(dur))


def drive(x: np.ndarray, k: float) -> np.ndarray:
    """tanh saturation of a peak-normalised signal (adds harmonics, tames peaks)."""
    return np.tanh(k * peak_norm(x)) / np.tanh(k)


# ---- static zero-phase spectral filters ------------------------------------------------------
def g_lp(f, fc, order=2):
    return 1.0 / np.sqrt(1.0 + (np.asarray(f) / fc) ** (2 * order))


def g_hp(f, fc, order=2):
    r = (np.asarray(f) / fc) ** (2 * order)
    return np.sqrt(r / (1.0 + r))


def g_peak(f, fc, width_oct):
    """Gaussian resonance on a log-frequency axis (width in octaves)."""
    return np.exp(-0.5 * (np.log2(np.maximum(f, 1.0) / fc) / width_oct) ** 2)


def spectral(x: np.ndarray, gain_fn) -> np.ndarray:
    n = len(x)
    nfft = 1 << int(np.ceil(np.log2(n + 4096)))
    f = np.fft.rfftfreq(nfft, 1.0 / SR)
    return np.fft.irfft(np.fft.rfft(x, nfft) * gain_fn(f), nfft)[:n]


def lowpass(x, fc, order=2):
    return spectral(x, lambda f: g_lp(f, fc, order))


def highpass(x, fc, order=2):
    return spectral(x, lambda f: g_hp(f, fc, order))


def bandpass(x, lo, hi, order=2):
    return spectral(x, lambda f: g_hp(f, lo, order) * g_lp(f, hi, order))


# ---- time-varying spectral filter (STFT mask, overlap-add) ----------------------------------
def stft_filter(x: np.ndarray, gain_fn, nfft: int = 1024, hop: int = 256) -> np.ndarray:
    """gain_fn(t, f) receives frame-centre times (F,1) and bin freqs (1,B), returns gains."""
    n = len(x)
    win = 0.5 - 0.5 * np.cos(TAU * np.arange(nfft) / nfft)
    xp = np.concatenate([np.zeros(nfft), x, np.zeros(nfft + hop)])
    nfr = 1 + (len(xp) - nfft) // hop
    idx = np.arange(nfft)[None, :] + hop * np.arange(nfr)[:, None]
    spec = np.fft.rfft(xp[idx] * win, axis=1)
    tc = (hop * np.arange(nfr) + nfft / 2 - nfft) / SR
    f = np.fft.rfftfreq(nfft, 1.0 / SR)
    frames = np.fft.irfft(spec * gain_fn(tc[:, None], f[None, :]), nfft, axis=1) * win
    out = np.zeros(len(xp))
    wsum = np.zeros(len(xp))
    w2 = win * win
    for k in range(nfr):
        s = k * hop
        out[s:s + nfft] += frames[k]
        wsum[s:s + nfft] += w2
    out = out / np.maximum(wsum, 1e-3)
    return out[nfft:nfft + n]


def sweep_lp(x, cut_points, order=2, res=0.0, res_w=0.2, nfft=1024, hop=256):
    """Low-pass whose cutoff follows [(t, Hz), ...] (log interp), optional resonant peak."""
    ts, fs = zip(*cut_points)
    lf = np.log(fs)

    def g(t, f):
        fc = np.exp(np.interp(t[:, 0], ts, lf))[:, None]
        out = g_lp(f, fc, order)
        if res:
            out = out + res * g_peak(f, fc, res_w)
        return out
    return stft_filter(x, g, nfft, hop)


def sweep_bp(x, centre_points, width_oct=0.5, nfft=1024, hop=256):
    ts, fs = zip(*centre_points)
    lf = np.log(fs)

    def g(t, f):
        fc = np.exp(np.interp(t[:, 0], ts, lf))[:, None]
        return g_peak(f, fc, width_oct)
    return stft_filter(x, g, nfft, hop)


# ---- effects --------------------------------------------------------------------------------
def fftconv(x: np.ndarray, h: np.ndarray) -> np.ndarray:
    m = len(x) + len(h) - 1
    nfft = 1 << int(np.ceil(np.log2(m)))
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)[:m]


def make_ir(rng: np.random.Generator, rt60: float, predelay: float = 0.012,
            bright: float = 0.45) -> np.ndarray:
    """Synthetic room: sparse early reflections + diffuse tail whose highs die faster."""
    dur = min(rt60 * 1.05, 2.6)
    t = timeline(dur)
    nz = rng.standard_normal(len(t))
    lo = lowpass(nz, 1800.0, 2)
    hi = nz - lo
    tail = lo * 10 ** (-3.0 * t / rt60) + 0.7 * hi * 10 ** (-3.0 * t / (rt60 * bright))
    tail *= np.clip(t / 0.03, 0.0, 1.0)
    ir = np.zeros(len(t) + n_of(predelay) + 2)
    ir[n_of(predelay):n_of(predelay) + len(t)] += tail * 0.6
    for d, g in ((0.0071, 0.9), (0.0113, 0.7), (0.0167, 0.62), (0.0239, 0.5),
                 (0.0311, 0.42), (0.0423, 0.33), (0.0557, 0.25)):
        ir[n_of(d)] += g * (1.0 if rng.random() < 0.5 else -1.0) * 6.0
    return ir / np.sqrt(np.sum(ir * ir))


def reverb(x: np.ndarray, rng: np.random.Generator, rt60: float = 1.2, mix: float = 0.25,
           wet_only: bool = False, keep_len: bool = True) -> np.ndarray:
    wet = fftconv(x, make_ir(rng, rt60))
    wet = highpass(wet, 140.0, 2)          # keep the low end tight
    if keep_len:
        wet = wet[:len(x)]
    if wet_only:
        return wet
    out = wet * mix
    out[:len(x)] += x
    return out


def flanger(x: np.ndarray, delay_ms, mix: float = 0.7) -> np.ndarray:
    n = len(x)
    d = np.broadcast_to(np.asarray(delay_ms, float), (n,)) * SR / 1000.0
    idx = np.arange(n) - d
    return x + mix * np.interp(idx, np.arange(n), x, left=0.0)


def crackle(dur: float, rng: np.random.Generator, density, lo: float = 1500.0,
            hi: float = 9000.0, click_tau: float = 0.0012) -> np.ndarray:
    """Sparse random clicks; density is a constant or an audio-rate curve (clicks/second)."""
    n = n_of(dur)
    dens = np.broadcast_to(np.asarray(density, float), (n,))
    hit = rng.random(n) < dens / SR
    imp = np.where(hit, rng.uniform(0.3, 1.0, n) * rng.choice([-1.0, 1.0], n), 0.0)
    kt = timeline(click_tau * 6)
    kern = rng.standard_normal(len(kt)) * np.exp(-kt / click_tau)
    return bandpass(fftconv(imp, kern)[:n], lo, hi, 2)


def bubble(f0: float, f1: float, dur: float, tau: float | None = None) -> np.ndarray:
    """Minnaert-style bubble: a sine whose pitch rises while it decays."""
    t = timeline(dur)
    freq = f0 * (f1 / f0) ** (t / dur)
    return np.sin(phase_of(freq)) * env_ar(dur, 0.002, tau or dur * 0.4)


def gurgle(dur: float, rng: np.random.Generator, density: float = 6.0, lo: float = 220.0,
           hi: float = 700.0) -> np.ndarray:
    out = np.zeros(n_of(dur))
    t = rng.exponential(1.0 / density)
    while t < dur - 0.06:
        f0 = rng.uniform(lo, hi)
        d = rng.uniform(0.018, 0.05)
        place(out, t, bubble(f0, f0 * rng.uniform(1.7, 3.0), d), rng.uniform(0.3, 1.0))
        t += rng.exponential(1.0 / density)
    return out


def squelch(dur: float, rng: np.random.Generator, lo: float = 300.0, hi: float = 1500.0,
            width: float = 0.22, rate: float = 19.0) -> np.ndarray:
    """Wet squelch: noise through a narrow resonance that swoops lo -> hi -> lo and trembles."""
    src = noise(dur, rng)
    ct = np.linspace(0.0, dur, 6)
    cf = np.array([lo, rng.uniform(0.6, 0.9) * hi, hi, rng.uniform(0.5, 0.8) * hi,
                   rng.uniform(1.0, 1.5) * lo, lo])
    lcf = np.log(cf)
    ph = rng.uniform(0, TAU)

    def g(t, f):
        tt = t[:, 0]
        fc = np.exp(np.interp(tt, ct, lcf)) * 2 ** (0.3 * np.sin(TAU * rate * tt + ph))
        fc = fc[:, None]
        return g_peak(f, fc, width) + 0.35 * g_peak(f, fc * 2.3, width * 1.3)
    y = stft_filter(src, g, nfft=512, hop=64)
    return peak_norm(y * env_ar(dur, 0.004, dur * 0.3))


def splat(dur: float, rng: np.random.Generator, cut: float = 700.0, tau: float = 0.04):
    return peak_norm(lowpass(noise(dur, rng), cut, 2) * env_ar(dur, 0.0015, tau))


def thump(f0: float, f1: float, dur: float, rng: np.random.Generator, tau: float = 0.11,
          body: float = 0.4, knock: float = 0.35) -> np.ndarray:
    """Heartbeat / boom thump: fast pitch-drop sine, saturated (odd harmonics) plus a short
    mid-range knock so it still reads on a phone speaker."""
    t = timeline(dur)
    freq = f1 + (f0 - f1) * np.exp(-t / 0.045)
    s = np.tanh(3.2 * np.sin(phase_of(freq)) * env_ar(dur, 0.004, tau))
    b = np.sin(phase_of(freq * 2.03)) * env_ar(dur, 0.003, tau * 0.45) * body
    thud = lowpass(noise(dur, rng), 320.0, 2) * env_ar(dur, 0.002, 0.035)
    kn = bandpass(noise(dur, rng), 260.0, 1500.0) * env_ar(dur, 0.0015, 0.022)
    return s + b + 0.5 * peak_norm(thud) + knock * peak_norm(kn)


VOWELS = {  # F1, F2, F3 (Hz)
    "a": (730.0, 1090.0, 2440.0),
    "e": (530.0, 1840.0, 2480.0),
    "i": (270.0, 2290.0, 3010.0),
    "o": (570.0, 840.0, 2410.0),
    "u": (300.0, 870.0, 2240.0),
    "ae": (660.0, 1720.0, 2410.0),
}
FORMANT_BW = (90.0, 120.0, 170.0)
FORMANT_AMP = (1.0, 0.6, 0.35)


def formant_gain(t, f, vowel_pts, fscale=1.0, bw=1.0, floor=0.015):
    vt = [p[0] for p in vowel_pts]
    g = floor
    for i in range(3):
        fi = np.interp(t[:, 0], vt, [VOWELS[p[1]][i] * fscale for p in vowel_pts])[:, None]
        g = g + FORMANT_AMP[i] * np.exp(-0.5 * ((f - fi) / (FORMANT_BW[i] * bw * fscale)) ** 2)
    return g


def formant_voice(f0: np.ndarray, vowel_pts, rng, fscale=1.0, bw=1.0, jitter=0.01,
                  nfft=1024, hop=128) -> np.ndarray:
    """Creature voice: jittery band-limited saw through moving vowel formants."""
    n = len(f0)
    src = saw(f0 * (1.0 + jitter * wobble(n, 45.0, rng)), kmax=72)
    y = stft_filter(src, lambda t, f: formant_gain(t, f, vowel_pts, fscale, bw), nfft, hop)
    return peak_norm(y)


FRICATIVES = {  # centre Hz, width (oct), level
    "s": (6500.0, 0.45, 0.8),
    "sh": (3000.0, 0.5, 0.9),
    "f": (5000.0, 1.2, 0.35),
    "h": (1500.0, 1.0, 0.4),
    "k": (2200.0, 0.6, 0.9),
}


def whisper(dur: float, rng: np.random.Generator, rate: float = 7.0,
            fscale: float = 1.0) -> np.ndarray:
    """Unintelligible whispering: aspirated noise through vowel formants + fricatives."""
    syl = []
    t = rng.uniform(0.04, 0.1)
    cons_names = ["s", "sh", "f", "h", "k", "-"]
    while t < dur - 0.18:
        cons = cons_names[rng.choice(len(cons_names), p=[0.22, 0.2, 0.1, 0.22, 0.1, 0.16])]
        fd = 0.025 if cons == "k" else rng.uniform(0.05, 0.11)
        vd = rng.uniform(0.07, 0.17) * 7.0 / rate
        vowel = ["a", "e", "i", "o", "u", "ae"][rng.integers(6)]
        syl.append((t, cons, fd, vowel, vd, rng.uniform(0.45, 1.0)))
        t += fd + vd + rng.uniform(0.0, 0.08) + (0.15 if rng.random() < 0.15 else 0.0)

    def g(tc, f):
        tt = tc[:, 0]
        venv = np.zeros(len(tt))
        fenv = np.zeros(len(tt))
        vc, fF, fct, fcen, fwid = [], [[], [], []], [], [], []
        for (s, cons, fd, vowel, vd, amp) in syl:
            if cons != "-":
                c, w, lvl = FRICATIVES[cons]
                fenv += amp * lvl * bump(tt, s + fd / 2, fd / 2 + 0.01)
                fct.append(s + fd / 2)
                fcen.append(c * fscale)
                fwid.append(w)
            vcen = s + fd * 0.8 + vd / 2
            venv += amp * bump(tt, vcen, vd / 2 + fd * 0.35)
            vc.append(vcen)
            for i in range(3):
                fF[i].append(VOWELS[vowel][i] * fscale)
        gain = np.zeros((len(tt), f.shape[1]))
        for i in range(3):
            fi = np.interp(tt, vc, fF[i])[:, None]
            gain += FORMANT_AMP[i] * np.exp(-0.5 * ((f - fi) / (FORMANT_BW[i] * 1.8)) ** 2)
        gain *= venv[:, None]
        if fct:
            fc = np.interp(tt, fct, fcen)[:, None]
            fw = np.interp(tt, fct, fwid)[:, None]
            gain += 0.55 * fenv[:, None] * np.exp(-0.5 * (np.log2(np.maximum(f, 20.0) / fc) / fw) ** 2)
        return gain
    y = stft_filter(noise(dur, rng), g, nfft=1024, hop=256)
    y *= pts(dur, [(0, 0), (0.03, 1), (dur - 0.05, 1), (dur, 0)])
    return peak_norm(limit(y, 4.0))


def drone_src(dur: float, rng: np.random.Generator, base: float, sub: float = 0.5) -> np.ndarray:
    """Detuned saw cluster: unison pair (slow beating), flat fifth, tritone, minor ninth."""
    n = n_of(dur)
    out = np.zeros(n)
    for ratio, a in ((1.0, 1.0), (1.0068, 0.85), (1.4983, 0.42), (2 ** (6 / 12), 0.22),
                     (2 * 2 ** (1 / 12), 0.15), (0.5, sub)):
        f = base * ratio * (1.0 + 0.0025 * wobble(n, 0.4, rng))
        out += a * saw(f, kmax=48)
    return peak_norm(out)


def bell(f0: float, dur: float, partials, attack: float = 0.002, detune: float = 0.0):
    """Sum of decaying sine partials [(ratio, amp, tau), ...]; optional detuned twin."""
    t = timeline(dur)
    out = np.zeros(len(t))
    for r, a, tau in partials:
        e = np.exp(-t / tau)
        out += a * e * np.sin(TAU * f0 * r * t)
        if detune:
            out += 0.6 * a * e * np.sin(TAU * f0 * r * (1.0 + detune) * t + 1.3)
    return out * env_ar(dur, attack, 1e9)


def limit(x: np.ndarray, reduction_db: float, block: float = 0.0025,
          release: float = 0.08) -> np.ndarray:
    """Look-ahead block peak limiter: pulls peaks down by `reduction_db` so the body of the
    sound comes up after normalisation (instant attack, smooth exponential release)."""
    if reduction_db <= 0.0:
        return x
    n = len(x)
    thr = float(np.max(np.abs(x))) * 10 ** (-reduction_db / 20.0)
    bs = max(1, n_of(block))
    nb = -(-n // bs)
    padded = np.zeros(nb * bs)
    padded[:n] = np.abs(x)
    g = np.minimum(1.0, thr / np.maximum(padded.reshape(nb, bs).max(axis=1), 1e-12))
    prev = np.concatenate([[1.0], g[:-1]])
    nxt = np.concatenate([g[1:], [1.0]])
    g = np.minimum(g, np.minimum(prev, nxt))       # neighbours: interpolation never overshoots
    a = float(np.exp(-bs / (release * SR)))
    sm = g.copy()
    for i in range(1, nb):
        sm[i] = min(g[i], sm[i - 1] * a + (1.0 - a) * g[i])
    centres = (np.arange(nb) + 0.5) * bs
    return x * np.interp(np.arange(n), centres, sm)


def low_shelf(x: np.ndarray, gain_db: float, fc: float = 130.0) -> np.ndarray:
    """Gentle low shelf (negative gain = less sub, so phone speakers get more mid-range)."""
    if gain_db == 0.0:
        return x
    g = 10 ** (gain_db / 20.0)
    return spectral(x, lambda f: g + (1.0 - g) * g_hp(f, fc, 2))


def finish(x: np.ndarray, fade_in: float = 0.004, fade_out: float = 0.05,
           hp: float = 45.0, shelf_db: float = 0.0, limit_db: float = 0.0) -> np.ndarray:
    """Sub high-pass (+ optional low shelf), optional peak limiting, click-free raised-cosine
    fades, peak-normalise to PEAK_DBFS."""
    x = highpass(x, hp, 2)
    x = low_shelf(x, shelf_db)
    x = limit(x, limit_db)
    n = len(x)
    fi, fo = max(n_of(fade_in), 1), max(n_of(fade_out), 1)
    x[:fi] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(fi) / fi)
    x[n - fo:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(fo) / fo)
    x[-1] = 0.0
    return peak_norm(x, 10 ** (PEAK_DBFS / 20.0))


# =============================================================================================
# The sounds
# =============================================================================================
def snd_ambient_1(rng):
    """Whispering voices drifting around the eye (one voice is reversed)."""
    dur = 3.3
    out = np.zeros(n_of(dur))
    place(out, 0.05, whisper(2.5, rng, rate=6.5, fscale=1.0), 1.0)
    place(out, 0.45, whisper(2.3, rng, rate=8.0, fscale=1.18), 0.65)
    place(out, 0.75, whisper(2.1, rng, rate=5.0, fscale=0.86)[::-1], 0.55)
    t = timeline(dur)
    out = flanger(out, 2.2 + 1.6 * np.sin(TAU * 0.6 * t), 0.45)
    out *= pts(dur, [(0, 0.3), (0.5, 1.0), (2.3, 1.0), (3.1, 0.2), (dur, 0.0)])
    bed = lowpass(drone_src(dur, rng, 82.4), 600.0, 3)
    out = peak_norm(out) + 0.13 * peak_norm(bed) * pts(dur, [(0, 0), (0.8, 1), (2.6, 1), (dur, 0)])
    out = reverb(out, rng, rt60=1.8, mix=0.5)
    return finish(out, fade_in=0.15, fade_out=0.45)


def snd_ambient_2(rng):
    """Wet heartbeat: two lub-dubs with squelches, bubbles and a gurgling bed."""
    dur = 2.7
    out = np.zeros(n_of(dur))
    for t0, a, f0, f1 in ((0.10, 1.0, 92.0, 46.0), (0.38, 0.72, 112.0, 56.0),
                          (1.40, 0.95, 90.0, 45.0), (1.68, 0.68, 108.0, 54.0)):
        place(out, t0, thump(f0, f1, 0.45, rng), a)
        place(out, t0 + 0.004, squelch(0.22, rng, 260.0, 1100.0, 0.2), 0.42 * a)
        for _ in range(int(rng.integers(1, 3))):
            f = rng.uniform(260.0, 450.0)
            place(out, t0 + rng.uniform(0.03, 0.2), bubble(f, f * rng.uniform(2.2, 3.4), 0.04), 0.22 * a)
    out += 0.16 * peak_norm(gurgle(dur, rng, density=5.0))
    bed = lowpass(drone_src(dur, rng, 73.4), 450.0, 3)
    out += 0.06 * peak_norm(bed) * pts(dur, [(0, 0), (0.6, 1), (2.2, 1), (dur, 0)])
    out = reverb(out, rng, rt60=1.1, mix=0.22)
    return finish(out, fade_in=0.008, fade_out=0.25)


def snd_ambient_3(rng):
    """Low detuned drone with slow beating, a breathing resonant filter and a distant whine."""
    dur = 3.6
    t = timeline(dur)
    d = drone_src(dur, rng, 98.0)
    d = sweep_lp(d, [(0, 260), (1.1, 1300), (1.9, 650), (2.6, 1050), (dur, 300)],
                 order=3, res=0.9, res_w=0.18, nfft=2048, hop=512)
    d = peak_norm(d) * pts(dur, [(0, 0), (0.6, 1.0), (2.8, 0.9), (dur, 0)])
    whine = (np.sin(phase_of(1568.0 * (1 + 0.004 * np.sin(TAU * 5.1 * t))))
             + 0.7 * np.sin(TAU * 1573.5 * t))
    whine *= pts(dur, [(0, 0), (1.0, 0), (1.8, 1), (2.6, 0.55), (3.4, 0), (dur, 0)])
    out = d + 0.06 * whine
    place(out, 1.45, squelch(0.25, rng, 300.0, 900.0, 0.2), 0.12)
    place(out, 2.65, squelch(0.2, rng, 350.0, 1100.0, 0.2), 0.09)
    out = reverb(out, rng, rt60=2.2, mix=0.35)
    return finish(out, fade_in=0.05, fade_out=0.5)


def _hurt(rng, dur, f0_pts, vowel_pts, fscale, sq_lo, sq_hi, end):
    t = timeline(dur)
    f0 = pts(dur, f0_pts) * (1.0 + 0.035 * np.sin(TAU * 27.0 * t) + 0.01 * wobble(len(t), 30, rng))
    sc = drive(formant_voice(f0, vowel_pts, rng, fscale=fscale, bw=2.6, jitter=0.02), 2.5)
    sc *= pts(dur, [(0, 0), (0.012, 1.0), (0.22, 0.8), (end, 0.0), (dur, 0.0)])
    out = 0.8 * sc
    place(out, 0.0, squelch(0.3, rng, sq_lo, sq_hi, 0.18), 0.55)
    place(out, 0.0, splat(0.15, rng, 700.0, 0.035), 0.35)
    for _ in range(3):
        f = rng.uniform(280.0, 520.0)
        place(out, rng.uniform(0.01, 0.25), bubble(f, f * rng.uniform(2.4, 3.6), 0.035), 0.2)
    out = reverb(out, rng, rt60=0.6, mix=0.15)
    return finish(out, fade_in=0.002, fade_out=0.06)


def snd_hurt_1(rng):
    return _hurt(rng, 0.55, [(0, 600), (0.05, 930), (0.16, 760), (0.42, 520), (0.55, 480)],
                 [(0, "a"), (0.12, "i"), (0.3, "e")], 1.25, 380.0, 1700.0, 0.42)


def snd_hurt_2(rng):
    return _hurt(rng, 0.5, [(0, 520), (0.04, 790), (0.12, 700), (0.38, 400), (0.5, 380)],
                 [(0, "e"), (0.1, "a"), (0.28, "o")], 1.15, 330.0, 1400.0, 0.38)


def snd_death(rng):
    """Descending distorted screech -> gooey pop -> rumble."""
    dur = 1.8
    t = timeline(dur)
    n = len(t)
    prog = np.clip(t / 1.3, 0.0, 1.0)
    f0 = 900.0 * (140.0 / 900.0) ** prog
    vib = 1.0 + (0.01 + 0.06 * prog) * np.sin(phase_of(7.5 + 2.0 * prog))
    vowels = [(0, "i"), (0.5, "e"), (1.0, "a"), (1.4, "o")]
    v1 = formant_voice(f0 * vib, vowels, rng, fscale=1.2, bw=2.4, jitter=0.03)
    v2 = formant_voice(f0 * vib * 1.059, vowels, rng, fscale=1.05, bw=2.4, jitter=0.03)
    scr = drive(v1 + 0.6 * v2, 3.5)
    scr *= pts(dur, [(0, 0), (0.02, 1.0), (0.7, 0.85), (1.15, 0.55), (1.45, 0.0), (dur, 0.0)])
    out = 0.72 * scr
    # gooey pop
    tp = 1.05
    place(out, tp, bubble(220.0, 1300.0, 0.05, 0.03), 0.9)
    place(out, tp, peak_norm(bandpass(noise(0.08, rng), 700.0, 3200.0) * env_ar(0.08, 0.001, 0.018)), 0.6)
    place(out, tp + 0.004, splat(0.35, rng, 500.0, 0.11), 0.55)
    place(out, tp + 0.03, peak_norm(gurgle(0.55, rng, density=16.0, lo=200.0, hi=600.0)), 0.25)
    # rumble
    rum = peak_norm(lowpass(noise(dur, rng), 180.0, 3))
    growl = lowpass(saw(55.0 * (1 + 0.01 * wobble(n, 8, rng))), 420.0, 2)
    sub = np.tanh(2.0 * np.sin(TAU * 42.0 * t))
    rumble = 0.55 * rum + 0.45 * peak_norm(growl) + 0.35 * sub
    rumble *= pts(dur, [(0, 0), (0.85, 0), (1.08, 1.0), (1.35, 0.6), (dur, 0)])
    out += 0.65 * rumble
    out = reverb(out, rng, rt60=1.5, mix=0.3)
    return finish(out, fade_in=0.003, fade_out=0.25)


def snd_summon(rng):
    """Rising dissonant chord + reverse swell + whoosh -> low boom + eerie sting."""
    dur = 2.5
    hit = 1.55
    t = timeline(dur)
    n = len(t)
    rise = np.clip(t / hit, 0.0, 1.0)
    glide = 2.0 ** ((rise ** 1.6) * 7.0 / 12.0)
    chord = np.zeros(n)
    for f, a in ((110.0, 1.0), (116.54, 0.7), (155.56, 0.8), (233.08, 0.55), (329.63, 0.45)):
        chord += a * saw(f * glide * (1.0 + 0.003 * wobble(n, 3.0, rng)), kmax=60)
    chord = sweep_lp(chord, [(0, 250), (hit, 4200), (dur, 4200)], order=2, res=0.6, res_w=0.25)
    chord = peak_norm(chord) * pts(dur, [(0, 0), (0.3, 0.25), (1.3, 0.85), (hit, 1.0),
                                         (hit + 0.06, 0.0), (dur, 0.0)])
    # reverse swell (reversed reverberant crash, ending exactly on the hit)
    crash = bandpass(noise(0.9, rng), 600.0, 9000.0) * env_ar(0.9, 0.001, 0.25)
    rev = peak_norm(reverb(crash, rng, rt60=1.3, mix=1.0, wet_only=True)[::-1])
    swell = np.zeros(n)
    place(swell, hit - len(rev) / SR, rev, 1.0)
    # whoosh
    wh = sweep_bp(noise(dur, rng), [(0, 300), (0.5, 300), (hit, 5200), (dur, 5200)], 0.55)
    wh = peak_norm(wh) * pts(dur, [(0, 0), (0.4, 0), (1.45, 1.0), (hit, 0.3), (hit + 0.1, 0), (dur, 0)])
    # boom + crack + rumble tail
    boom = np.zeros(n)
    place(boom, hit, thump(95.0, 32.0, 0.95, rng, tau=0.32, body=0.5), 1.0)
    place(boom, hit, peak_norm(bandpass(noise(0.05, rng), 900.0, 7000.0) * env_ar(0.05, 0.0005, 0.008)), 0.6)
    place(boom, hit, peak_norm(lowpass(noise(0.9, rng), 260.0, 2) * env_ar(0.9, 0.005, 0.32)), 0.55)
    sting = bell(440.0, 0.95, [(1.0, 1.0, 0.45), (1.414, 0.6, 0.35), (2.1, 0.45, 0.25),
                                (2.76, 0.35, 0.2), (4.07, 0.2, 0.12)], attack=0.004, detune=0.004)
    place(boom, hit + 0.01, peak_norm(sting), 0.35)
    out = 0.55 * chord + 0.45 * swell + 0.35 * wh + 0.9 * boom
    out = reverb(out, rng, rt60=1.8, mix=0.3)
    return finish(out, fade_in=0.01, fade_out=0.3)


def _laser(rng, dur, c0, c1, ct, z0, z1, buzz):
    out = np.zeros(n_of(dur))
    # charge whine
    tt = timeline(ct)
    cf = c0 * (c1 / c0) ** ((tt / ct) ** 1.4)
    trem = 0.65 + 0.35 * np.sin(phase_of(14.0 + 50.0 * tt / ct))
    whine = (np.sin(phase_of(cf)) + 0.35 * tri(cf * 1.5) + 0.25 * saw(cf * 0.5, kmax=24)) * trem
    whine *= pts(ct, [(0, 0), (ct * 0.9, 1.0), (ct, 0.85)]) ** 1.5
    hiss = highpass(noise(ct, rng), 4000.0) * pts(ct, [(0, 0), (ct, 1.0)]) ** 2
    place(out, 0.0, peak_norm(whine) * 0.45 + 0.08 * peak_norm(hiss))
    # zap
    zd = 0.45
    zt = timeline(zd)
    zf = z1 + (z0 - z1) * np.exp(-zt / 0.05)
    zap = 0.6 * square(zf, kmax=40) + 0.4 * saw(zf * 1.01, kmax=40)
    zap *= 0.55 + 0.45 * np.tanh(5.0 * np.sin(TAU * buzz * zt))
    zap = drive(zap, 2.0) * env_ar(zd, 0.0015, 0.09)
    crack = peak_norm(highpass(noise(0.03, rng), 1500.0) * env_ar(0.03, 0.0005, 0.006))
    pew = np.sin(phase_of(1900.0 * (250.0 / 1900.0) ** np.clip(zt / 0.12, 0, 1))) * env_ar(zd, 0.001, 0.05)
    place(out, ct, zap, 0.85)
    place(out, ct, crack, 0.55)
    place(out, ct, pew, 0.4)
    # crackling beam fizz tail
    fd = 0.45
    ft = timeline(fd)
    fizz = saw(110.0 * (1 + 0.01 * np.sin(TAU * 31 * ft))) + 0.8 * saw(166.0 * (1 + 0.012 * np.sin(TAU * 23 * ft)))
    fizz = sweep_lp(fizz, [(0, 5000), (fd, 500)], order=2, res=0.5)
    fizz = peak_norm(fizz) * env_ar(fd, 0.01, 0.12)
    crk = peak_norm(crackle(fd, rng, 90.0 * np.exp(-ft / 0.15))) * 0.8
    place(out, ct + 0.02, fizz, 0.3)
    place(out, ct + 0.02, crk, 0.3)
    out = reverb(out, rng, rt60=0.8, mix=0.15)
    return finish(out, fade_in=0.004, fade_out=0.08)


def snd_laser_1(rng):
    return _laser(rng, 0.8, 420.0, 2600.0, 0.30, 2600.0, 170.0, 78.0)


def snd_laser_2(rng):
    return _laser(rng, 0.78, 520.0, 3300.0, 0.26, 3200.0, 140.0, 92.0)


def snd_impact(rng):
    """Explosion-like red energy burst."""
    dur = 1.2
    t = timeline(dur)
    out = np.zeros(len(t))
    body = sweep_lp(noise(dur, rng), [(0, 6000), (0.08, 2500), (0.4, 600), (0.9, 180), (dur, 150)], order=2)
    body = peak_norm(body) * env_ar(dur, 0.002, 0.22)
    out += 0.75 * body
    place(out, 0.0, peak_norm(bandpass(noise(0.02, rng), 800.0, 10000.0) * env_ar(0.02, 0.0003, 0.004)), 0.8)
    place(out, 0.0, thump(78.0, 30.0, 0.7, rng, tau=0.2, body=0.5), 0.75)
    crk = crackle(0.95, rng, 260.0 * np.exp(-timeline(0.95) / 0.25), 1000.0, 7000.0)
    place(out, 0.04, peak_norm(crk), 0.35)
    zing = np.sin(phase_of(1500.0 * (380.0 / 1500.0) ** np.clip(timeline(0.3) / 0.22, 0, 1)))
    place(out, 0.0, zing * env_ar(0.3, 0.002, 0.07), 0.25)
    out = reverb(out, rng, rt60=1.4, mix=0.28)
    return finish(out, fade_in=0.001, fade_out=0.2)


def snd_rage(rng):
    """Distorted roaring screech."""
    dur = 1.5
    t = timeline(dur)
    n = len(t)
    f0 = pts(dur, [(0, 90), (0.15, 128), (0.7, 118), (1.1, 135), (dur, 95)])
    vib = 1.0 + 0.02 * np.sin(TAU * 6.2 * t) + 0.01 * wobble(n, 12, rng)
    growl = 0.6 + 0.4 * np.sin(TAU * 31.0 * t)
    roar = np.zeros(n)
    for r, a in ((1.0, 1.0), (1.012, 0.8), (0.994, 0.7), (2.005, 0.4)):
        roar += a * saw(f0 * vib * r, kmax=72)
    roar = stft_filter(roar, lambda tt, f: formant_gain(tt, f, [(0, "o"), (0.2, "a"), (0.9, "ae"), (1.4, "a")],
                                                        1.0, 1.6, 0.03), 1024, 128)
    roar = drive(peak_norm(roar) * growl, 4.0)
    sf0 = pts(dur, [(0, 900), (0.25, 1300), (0.8, 1450), (1.2, 1100), (dur, 800)])
    sf0 = sf0 * (1.0 + 0.04 * np.sin(TAU * 9.0 * t))
    scr = drive(formant_voice(sf0, [(0, "i"), (0.6, "e"), (1.2, "i")], rng, fscale=1.3, bw=2.6, jitter=0.03), 3.0)
    breath = peak_norm(bandpass(noise(dur, rng), 700.0, 4500.0)) * growl
    e_roar = pts(dur, [(0, 0), (0.07, 1.0), (1.05, 0.9), (1.45, 0.0), (dur, 0.0)])
    e_scr = pts(dur, [(0, 0), (0.12, 0), (0.35, 0.9), (1.0, 1.0), (1.4, 0.0), (dur, 0.0)])
    out = 0.8 * roar * e_roar + 0.42 * scr * e_scr + 0.16 * breath * e_roar
    out = lowpass(out, 7500.0, 2)
    out = reverb(out, rng, rt60=1.3, mix=0.25)
    return finish(out, fade_in=0.004, fade_out=0.08)


def snd_teleport(rng):
    """Phasey whoosh with a pitch dive and a suction pop."""
    dur = 0.9
    t = timeline(dur)
    n = len(t)
    wh = sweep_bp(noise(dur, rng), [(0, 6500), (0.65, 260), (dur, 220)], 0.5, nfft=1024, hop=128)
    wh = peak_norm(wh) * pts(dur, [(0, 0), (0.18, 1.0), (0.5, 0.7), (0.75, 0), (dur, 0)])
    f = 1700.0 * (90.0 / 1700.0) ** (np.clip(t / 0.6, 0.0, 1.0) ** 0.8)
    dive = np.zeros(n)
    for dt in (-0.007, 0.0, 0.007):
        dive += np.sin(phase_of(f * (1 + dt))) + 0.3 * tri(f * 2.0 * (1 + dt))
    dive = peak_norm(dive) * pts(dur, [(0, 0), (0.03, 1.0), (0.55, 0.6), (0.7, 0), (dur, 0)])
    out = 0.6 * wh + 0.45 * dive
    pop = np.sin(phase_of(700.0 * (150.0 / 700.0) ** (timeline(0.08) / 0.08))) * env_ar(0.08, 0.001, 0.02)
    place(out, 0.62, pop, 0.5)
    place(out, 0.62, splat(0.06, rng, 1500.0, 0.01), 0.2)
    out = flanger(out, 1.6 + 1.3 * np.sin(TAU * 2.2 * t), 0.75)
    out = flanger(out, 4.0 + 3.0 * np.sin(TAU * 1.3 * t + 1.0), 0.5)
    out = reverb(out, rng, rt60=1.0, mix=0.25)
    return finish(out, fade_in=0.003, fade_out=0.1)


def snd_shield(rng):
    """Humming energy pulse: power-up whomp, wub pulses and shimmer."""
    dur = 1.0
    t = timeline(dur)
    n = len(t)
    hum = np.zeros(n)
    for f, a in ((110.0, 1.0), (165.0, 0.6), (220.5, 0.5), (110.6, 0.6)):
        hum += a * saw(const(f, dur) * (1 + 0.002 * wobble(n, 2, rng)), kmax=48)
    hum = sweep_lp(hum, [(0, 200), (0.18, 3000), (0.45, 800), (dur, 600)], order=2, res=1.2, res_w=0.2)
    pulse = 0.55 + 0.45 * np.sin(TAU * 8.0 * t - np.pi / 2)
    hum = peak_norm(hum) * pulse * pts(dur, [(0, 0), (0.12, 1.0), (0.6, 0.8), (dur, 0)])
    sh = np.zeros(n)
    for f, a in ((1320.0, 1.0), (1980.0, 0.7), (2640.0, 0.5), (1327.0, 0.6)):
        sh += a * np.sin(TAU * f * t + rng.uniform(0, TAU))
    sh *= (0.5 + 0.5 * np.sin(TAU * 16.0 * t)) * pts(dur, [(0, 0), (0.15, 0), (0.35, 1.0), (dur, 0)])
    out = 0.8 * hum + 0.12 * peak_norm(sh)
    out += 0.08 * peak_norm(crackle(dur, rng, 30.0, 2000.0, 9000.0))
    out = reverb(out, rng, rt60=1.0, mix=0.25)
    return finish(out, fade_in=0.004, fade_out=0.15)


def snd_shield_hit(rng):
    """Bright metallic ping + energy crackle."""
    dur = 0.5
    ping = bell(1480.0, dur, [(1.0, 1.0, 0.16), (2.32, 0.6, 0.09), (4.25, 0.45, 0.06),
                              (6.63, 0.3, 0.04), (9.38, 0.18, 0.028)], attack=0.001, detune=0.003)
    out = 0.7 * peak_norm(ping)
    crk = crackle(0.3, rng, 420.0 * np.exp(-timeline(0.3) / 0.06), 2500.0, 9000.0)
    place(out, 0.0, peak_norm(crk), 0.45)
    th = np.sin(phase_of(160.0 + 80.0 * np.exp(-timeline(0.15) / 0.02))) * env_ar(0.15, 0.001, 0.05)
    place(out, 0.0, th, 0.35)
    zap = np.sin(phase_of(3000.0 * (1200.0 / 3000.0) ** (timeline(0.05) / 0.05))) * env_ar(0.05, 0.0005, 0.015)
    place(out, 0.0, zap, 0.3)
    out = reverb(out, rng, rt60=0.7, mix=0.2)
    return finish(out, fade_in=0.0005, fade_out=0.08)


def snd_heal(rng):
    """Eerie glassy chime arpeggio over a tritone pad."""
    dur = 1.2
    out = np.zeros(n_of(dur))
    glass = [(1.0, 1.0, 0.55), (2.005, 0.22, 0.3), (2.99, 0.12, 0.18), (5.43, 0.06, 0.08)]
    for i, (t0, f) in enumerate(((0.0, 440.0), (0.1, 523.25), (0.2, 659.26), (0.3, 830.61), (0.42, 987.77))):
        nd = dur - t0
        tone = bell(f, nd, glass, attack=0.004, detune=0.004)
        place(out, t0, peak_norm(tone), 0.7 if i < 4 else 0.85)
    t = timeline(dur)
    pad = (np.sin(TAU * 220.0 * t) + 0.7 * np.sin(TAU * 311.13 * t) + 0.4 * np.sin(TAU * 221.2 * t))
    pad *= pts(dur, [(0, 0), (0.35, 1.0), (0.8, 0.7), (dur, 0)])
    out += 0.18 * peak_norm(pad)
    air = peak_norm(bandpass(noise(dur, rng), 5000.0, 10000.0)) * pts(dur, [(0, 0), (0.3, 1.0), (dur, 0)])
    out += 0.03 * air
    out = reverb(out, rng, rt60=1.6, mix=0.38)
    return finish(out, fade_in=0.002, fade_out=0.2)


def snd_destroy(rng):
    """Crunchy blast: bit-crushed noise, low thump and falling debris."""
    dur = 1.0
    out = np.zeros(n_of(dur))
    blast = sweep_lp(noise(dur, rng), [(0, 7000), (0.1, 2500), (0.5, 400), (dur, 250)], order=2)
    blast = peak_norm(blast) * env_ar(dur, 0.001, 0.13)
    hold = 6
    crunch = blast[(np.arange(len(blast)) // hold) * hold]          # sample-and-hold decimation
    crunch = np.round(crunch * 12.0) / 12.0                           # ~5-bit crush
    crunch = lowpass(crunch, 6500.0, 2)
    out += 0.45 * blast + 0.45 * peak_norm(crunch)
    place(out, 0.0, thump(85.0, 38.0, 0.5, rng, tau=0.12, body=0.6), 0.7)
    grains = np.zeros(n_of(dur))
    tg = 0.0
    while tg < 0.85:
        gd = rng.uniform(0.002, 0.009)
        g = noise(gd, rng) * env_ar(gd, 0.0003, gd * 0.35)
        c = rng.uniform(500.0, 4500.0)
        g = bandpass(g, c * 0.7, c * 1.4)
        place(grains, tg, peak_norm(g), rng.uniform(0.2, 1.0) * np.exp(-tg / 0.35))
        tg += rng.exponential(0.012 + tg * 0.06)
    out += 0.35 * peak_norm(grains)
    out = reverb(out, rng, rt60=0.9, mix=0.2)
    return finish(out, fade_in=0.001, fade_out=0.12)


def snd_levelup(rng):
    """Ascending ominous arpeggio (D harmonic minor) resolving into a dark mM7 chord."""
    dur = 1.8
    out = np.zeros(n_of(dur))
    notes = (146.83, 174.61, 220.0, 277.18, 293.66, 349.23, 440.0)
    step = 0.11
    for i, f in enumerate(notes):
        t0 = i * step
        nd = 0.42
        organ = 0.7 * saw(const(f, nd), kmax=40) + 0.5 * np.sin(TAU * f / 2 * timeline(nd))
        organ = lowpass(organ, f * 5.0, 2) * env_ar(nd, 0.006, 0.12)
        ping = bell(f * 2.0, nd, [(1.0, 1.0, 0.12), (2.0, 0.3, 0.06), (3.01, 0.15, 0.04)], 0.002)
        place(out, t0, peak_norm(organ) * 0.55 + peak_norm(ping) * 0.35, 0.8)
    tc = len(notes) * step
    cd = dur - tc
    ct = timeline(cd)
    chord = np.zeros(len(ct))
    for f, a in ((293.66, 1.0), (349.23, 0.8), (440.0, 0.75), (554.37, 0.6), (146.83, 0.7)):
        chord += a * saw(const(f, cd) * (1 + 0.002 * wobble(len(ct), 3, rng)), kmax=36)
    chord = sweep_lp(chord, [(0, 600), (0.25, 3200), (cd, 900)], order=2, res=0.5)
    chord = peak_norm(chord) * (0.8 + 0.2 * np.sin(TAU * 6.0 * ct)) * pts(cd, [(0, 0), (0.04, 1.0), (0.5, 0.75), (cd, 0)])
    place(out, tc, chord, 0.75)
    place(out, tc, thump(80.0, 40.0, 0.6, rng, tau=0.15, body=0.4), 0.45)
    sh = sweep_bp(noise(dur, rng), [(0, 1500), (tc, 7000), (dur, 9000)], 0.4)
    out += 0.07 * peak_norm(sh) * pts(dur, [(0, 0), (tc, 1.0), (dur, 0)])
    out = reverb(out, rng, rt60=1.6, mix=0.3)
    return finish(out, fade_in=0.002, fade_out=0.25)


def snd_mode(rng):
    """Short eerie blip: two quick tones a tritone apart."""
    dur = 0.25
    out = np.zeros(n_of(dur))
    for t0, f in ((0.0, 660.0), (0.075, 933.4)):
        d = 0.12
        tt = timeline(d)
        tone = np.sin(TAU * f * tt) + 0.25 * np.sin(TAU * 3 * f * tt) + 0.5 * np.sin(TAU * f * 1.006 * tt)
        place(out, t0, tone * env_ar(d, 0.002, 0.03), 1.0)
    out = reverb(out, rng, rt60=0.45, mix=0.15)
    return finish(out, fade_in=0.001, fade_out=0.03)


def snd_menu(rng):
    """Soft eerie bell (hum tone, minor third, tritone overtone)."""
    dur = 0.4
    b = bell(587.33, dur, [(0.5, 0.35, 0.35), (1.0, 1.0, 0.3), (1.183, 0.45, 0.2), (1.414, 0.18, 0.15),
                           (1.5, 0.3, 0.18), (2.0, 0.35, 0.12), (2.52, 0.15, 0.08), (2.66, 0.12, 0.07)],
             attack=0.004, detune=0.003)
    out = reverb(peak_norm(b), rng, rt60=0.8, mix=0.25)
    return finish(out, fade_in=0.001, fade_out=0.08)


SOUNDS = {
    "ambient_1": snd_ambient_1, "ambient_2": snd_ambient_2, "ambient_3": snd_ambient_3,
    "hurt_1": snd_hurt_1, "hurt_2": snd_hurt_2, "death": snd_death, "summon": snd_summon,
    "laser_1": snd_laser_1, "laser_2": snd_laser_2, "impact": snd_impact, "rage": snd_rage,
    "teleport": snd_teleport, "shield": snd_shield, "shield_hit": snd_shield_hit,
    "heal": snd_heal, "destroy": snd_destroy, "levelup": snd_levelup, "mode": snd_mode,
    "menu": snd_menu,
}

# =============================================================================================
# sound_definitions.json / sounds.json
# =============================================================================================
# id suffix -> (category, min_distance, max_distance, volume, [(file, pitch), ...])
DEFINITIONS = {
    "ambient": ("neutral", 2.0, 16.0, 0.55, [("ambient_1", None), ("ambient_2", None), ("ambient_3", None)]),
    "hurt": ("neutral", 2.0, 24.0, 0.9, [("hurt_1", None), ("hurt_2", None)]),
    "death": ("neutral", 2.0, 32.0, 1.0, [("death", None)]),
    "summon": ("neutral", 2.0, 32.0, 1.0, [("summon", None)]),
    "laser": ("neutral", 2.0, 32.0, 0.75, [("laser_1", 0.96), ("laser_1", 1.04), ("laser_2", 0.96), ("laser_2", 1.04)]),
    "impact": ("neutral", 2.0, 40.0, 0.9, [("impact", 0.92), ("impact", 1.0), ("impact", 1.08)]),
    "rage": ("neutral", 2.0, 40.0, 1.0, [("rage", None)]),
    "teleport": ("neutral", 2.0, 24.0, 0.8, [("teleport", 0.95), ("teleport", 1.05)]),
    "shield": ("neutral", 2.0, 20.0, 0.75, [("shield", None)]),
    "shield_hit": ("neutral", 2.0, 24.0, 0.7, [("shield_hit", 0.92), ("shield_hit", 1.0), ("shield_hit", 1.1)]),
    "heal": ("neutral", 2.0, 16.0, 0.75, [("heal", None)]),
    "destroy": ("neutral", 2.0, 40.0, 0.85, [("destroy", 0.9), ("destroy", 1.0), ("destroy", 1.1)]),
    "levelup": ("neutral", 2.0, 24.0, 0.9, [("levelup", None)]),
    "mode": ("ui", 1.0, 16.0, 0.6, [("mode", None)]),
    "menu": ("ui", 1.0, 16.0, 0.6, [("menu", None)]),
}


def build_sound_definitions() -> dict:
    defs = {}
    for key, (cat, dmin, dmax, vol, files) in DEFINITIONS.items():
        sounds = []
        for name, pitch in files:
            e = {"name": f"sounds/ceg/{name}", "volume": vol, "load_on_low_memory": True}
            if pitch is not None:
                e["pitch"] = pitch
            sounds.append(e)
        defs[f"ceg.guardian.{key}"] = {
            "category": cat,
            "min_distance": dmin,
            "max_distance": dmax,
            "sounds": sounds,
        }
    return {"format_version": "1.20.20", "sound_definitions": defs}


def build_sounds_json() -> dict:
    return {
        "entity_sounds": {
            "entities": {
                "ceg:eyeball_guardian": {
                    "events": {
                        "ambient": {"sound": "ceg.guardian.ambient", "volume": 1.0, "pitch": [0.9, 1.1]},
                        "hurt": {"sound": "ceg.guardian.hurt", "volume": 1.0, "pitch": [0.9, 1.15]},
                        "death": {"sound": "ceg.guardian.death", "volume": 1.0, "pitch": [0.95, 1.05]},
                    },
                    "pitch": [0.9, 1.1],
                    "volume": 1.0,
                }
            }
        }
    }


# =============================================================================================
# I/O
# =============================================================================================
def write_wav(path: Path, x: np.ndarray) -> None:
    pcm = np.clip(np.round(x * 32767.0), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def encode(wav: Path, ogg: Path) -> None:
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav),
           *BITEXACT, *FFMPEG_ENCODE, str(ogg)]
    subprocess.run(cmd, check=True)


def decode(ogg: Path) -> np.ndarray:
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(ogg),
           "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype="<f4").astype(np.float64)


def db(v: float) -> float:
    return 20.0 * np.log10(max(v, 1e-12))


def render(name: str, wav_dir: Path) -> dict:
    rng = np.random.default_rng(zlib.crc32(f"ceg:{name}".encode()))
    x = SOUNDS[name](rng)
    if not np.all(np.isfinite(x)):
        raise RuntimeError(f"{name}: non-finite samples")
    ogg = SND_DIR / f"{name}.ogg"
    gain = 1.0
    for _ in range(4):
        wav = wav_dir / f"{name}.wav"
        write_wav(wav, x * gain)
        encode(wav, ogg)
        y = decode(ogg)
        pk = float(np.max(np.abs(y)))
        if db(pk) <= DECODED_CEILING_DBFS:
            break
        gain *= 10 ** ((DECODED_CEILING_DBFS - 0.15 - db(pk)) / 20.0)
    else:
        raise RuntimeError(f"{name}: decoded peak {db(pk):.2f} dBFS still above ceiling")
    rms = float(np.sqrt(np.mean(y * y)))
    return {"name": name, "dur": len(x) / SR, "peak_db": db(pk), "rms_db": db(rms),
            "gain_db": db(gain), "bytes": ogg.stat().st_size}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--wav-dir", type=Path, help="keep the 16-bit WAV masters in this folder")
    ap.add_argument("--only", nargs="*", help="only render these sound names")
    args = ap.parse_args(argv)

    if shutil.which("ffmpeg") is None:
        print("error: ffmpeg not found on PATH", file=sys.stderr)
        return 1
    names = args.only or list(SOUNDS)
    unknown = [n for n in names if n not in SOUNDS]
    if unknown:
        print(f"error: unknown sound(s): {', '.join(unknown)}", file=sys.stderr)
        return 1

    SND_DIR.mkdir(parents=True, exist_ok=True)
    tmp = None
    if args.wav_dir:
        wav_dir = args.wav_dir.resolve()
        wav_dir.mkdir(parents=True, exist_ok=True)
    else:
        tmp = tempfile.TemporaryDirectory(prefix="ceg_sounds_")
        wav_dir = Path(tmp.name)
    try:
        total = 0
        print(f"{'sound':<12}{'dur s':>7}{'peak dB':>9}{'rms dB':>8}{'trim dB':>8}{'bytes':>8}")
        for name in names:
            r = render(name, wav_dir)
            total += r["bytes"]
            print(f"{r['name']:<12}{r['dur']:>7.2f}{r['peak_db']:>9.2f}{r['rms_db']:>8.1f}"
                  f"{r['gain_db']:>8.2f}{r['bytes']:>8}")
        print(f"{'total':<12}{'':>32}{total:>8}")
    finally:
        if tmp is not None:
            tmp.cleanup()

    # every referenced file must exist
    defs = build_sound_definitions()
    missing = [s["name"] for d in defs["sound_definitions"].values() for s in d["sounds"]
               if not (RP / (s["name"] + ".ogg")).is_file()]
    if missing:
        print(f"error: missing sound files: {missing}", file=sys.stderr)
        return 1
    SOUND_DEFS.write_text(json.dumps(defs, indent=2) + "\n", encoding="utf-8")
    SOUNDS_JSON.write_text(json.dumps(build_sounds_json(), indent=2) + "\n", encoding="utf-8")
    print(f"wrote {SOUND_DEFS.relative_to(ROOT)} and {SOUNDS_JSON.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
