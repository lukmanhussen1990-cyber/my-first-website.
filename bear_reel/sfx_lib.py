#!/usr/bin/env python3
"""Code-made sound effects for the Thanksgiving reel (numpy + scipy only, fixed seeds -> identical output).

Usage:   python3 make_sfx.py
Reads:   web/plan.js (shot times + sync events, read with node; regex fallback), audio/vo_lines.json
Writes:  audio/sfx/*.wav   48 kHz, 24-bit, stereo
         audio/sfx_cues.json   [{t, file, gain_db, note, [offset, dur, fade_in, fade_out, duck_db, cap_db]}]

Level convention (so cue gains mean something): every effect is normalised so its loudest 400 ms
(EBU R128 momentary loudness) sits at REF_LUFS = -20 LUFS. Exceptions: the four stomach rumbles keep
built-in steps (rumble1 < rumble2 < rumble3 < rumble4, see RUMBLE_STEPS_DB) and the ambience bed is
normalised by integrated loudness. mix.py puts the voice at -20 LUFS integrated, so a cue's gain_db is
roughly "how loud the effect is compared with the narrator" before ducking. Sample peaks are capped
at -1 dBFS. Every file: 18 Hz DC-blocking high-pass, raised-cosine fade-in/out, silent tail trimmed.
"""
import json
import os
import re
import subprocess

import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SFX_DIR = os.path.join(HERE, "audio", "sfx")
CUES = os.path.join(HERE, "audio", "sfx_cues.json")
SR = 48000
REF_LUFS = -20.0
PEAK_CAP_DB = -1.0
RUMBLE_STEPS_DB = {1: -6.0, 2: -4.0, 3: -2.0, 4: 0.0}   # built-in loudness of rumble1..4 vs REF_LUFS


# ----------------------------------------------------------------------------------------------- basics
def n_(d):
    return int(round(d * SR))


def tt(d):
    return np.arange(n_(d)) / SR


def rng(seed):
    return np.random.default_rng(seed)


def _butter(x, kind, f, order):
    sos = signal.butter(order, f, btype=kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def lp(x, f, order=2):
    return _butter(x, "lowpass", f, order)


def hp(x, f, order=2):
    return _butter(x, "highpass", f, order)


def bp(x, lo, hi, order=2):
    return _butter(x, "bandpass", [lo, hi], order)


def lpnoise(r, n, fc, order=2):
    """Smooth random control signal, ~unit std, bandwidth fc (Hz)."""
    warm = int(min(2 * SR, 4 * SR / fc))
    x = lp(r.standard_normal(n + warm), fc, order)[warm:]
    return x / (x.std() + 1e-12)


def reson(x, f, bw):
    """Klatt two-pole resonator (unity gain at DC)."""
    rr = np.exp(-np.pi * bw / SR)
    b1 = 2 * rr * np.cos(2 * np.pi * f / SR)
    b2 = -rr * rr
    return signal.lfilter([1 - b1 - b2], [1, -b1, -b2], x)


def svf(x, fc, q=0.707, mode="bp"):
    """Time-varying TPT state-variable filter. fc may be an array (Hz per sample). bp has unity peak gain."""
    x = np.asarray(x, float)
    fc = np.clip(np.broadcast_to(np.asarray(fc, float), x.shape), 10.0, 0.45 * SR)
    g = np.tan(np.pi * fc / SR)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k))
    a2 = g * a1
    a3 = g * a2
    xs, A1, A2, A3 = x.tolist(), a1.tolist(), a2.tolist(), a3.tolist()
    ic1 = ic2 = 0.0
    out = [0.0] * len(xs)
    lowp = mode == "lp"
    for i in range(len(xs)):
        v3 = xs[i] - ic2
        v1 = A1[i] * ic1 + A2[i] * v3
        v2 = ic2 + A2[i] * ic1 + A3[i] * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        out[i] = v2 if lowp else v1
    y = np.array(out)
    return y if lowp else y * k


def harmonics(f0, fmax=7000.0, tilt=1.0):
    """Band-limited additive pulse source: sum_k sin(k*phase)/k^tilt (tilt 1 = sawtooth)."""
    f0 = np.asarray(f0, float)
    ph = 2 * np.pi * np.cumsum(f0) / SR
    out = np.zeros_like(f0)
    kmax = int(fmax / max(f0.min(), 20.0)) + 1
    for k in range(1, kmax + 1):
        m = np.clip((fmax - k * f0) / (0.2 * fmax), 0.0, 1.0)
        if m.max() <= 0:
            break
        out += m * np.sin(k * ph) / k ** tilt
    return out


def saw(f, phase0=0.0):
    """PolyBLEP band-limited sawtooth for an f (Hz) array."""
    dt = np.asarray(f, float) / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    t = ph[m] / dt[m]
    y[m] -= t + t - t * t - 1
    m = ph > 1 - dt
    t = (ph[m] - 1) / dt[m]
    y[m] -= t * t + t + t + 1
    return y


def add_at(buf, x, t0):
    i = n_(t0)
    if i >= len(buf) or i + len(x) <= 0:
        return
    s = max(0, -i)
    j = min(len(buf), i + len(x))
    buf[max(i, 0):j] += x[s:s + j - max(i, 0)]


def cosramp(n):
    return 0.5 - 0.5 * np.cos(np.pi * np.arange(n) / max(1, n))


def att(t, a):
    """Smooth 0->1 attack of length a seconds (raised cosine)."""
    return 0.5 - 0.5 * np.cos(np.pi * np.clip(t / a, 0, 1))


def bubble(f0, tau, rise=0.5, amp=1.0, harm=0.0):
    """Liquid bubble: damped sine whose pitch rises (Minnaert-like chirp)."""
    t = tt(tau * 7 + 0.004)
    f = f0 * (1 + rise * np.minimum(t / (3 * tau), 1.6))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = (np.sin(ph) + harm * np.sin(2 * ph)) * np.exp(-t / tau) * (1 - np.exp(-t / 0.0012))
    return amp * y


def modal(partials, dur, seed=0, strike=0.15, strike_tau=0.0012, strike_hp=2500.0, beat=0.0018, detune=1.0, twin=0.35):
    """Struck object = sum of exponentially decaying partials (f, amp, tau) + a short strike noise.
    Each partial has a slightly detuned twin (real plates/glasses have split mode pairs -> gentle beating).
    The buffer is at least 6.5 x the longest decay (-56 dB) and ends with a fade, so nothing is cut off."""
    r = rng(seed)
    dur = max(dur, 6.5 * max(p[2] for p in partials))
    t = tt(dur)
    y = np.zeros_like(t)
    for f, a, tau in partials:
        f = f * detune
        y += a * np.exp(-t / tau) * np.sin(2 * np.pi * f * t)
        f2 = f * (1 + beat * r.uniform(0.5, 1.5))
        y += twin * a * np.exp(-t / (tau * 0.8)) * np.sin(2 * np.pi * f2 * t)
    y *= 1 - np.exp(-t / 0.00025)
    nz = hp(r.standard_normal(len(t)), strike_hp) * np.exp(-t / strike_tau) * strike
    y = y + nz
    y *= 1 - att(t - 0.88 * dur, 0.12 * dur)
    return y


def rms(x):
    return float(np.sqrt(np.mean(np.square(x)) + 1e-20))


# --------------------------------------------------------------------------------------------- reverb
_IR = {}
IR_SPECS = {
    # rt60 (s), predelay (s), low/high decay multipliers, early reflections [(s, gain)], lowpass on IR, seed
    "room": dict(rt=0.55, pre=0.006, lo=1.15, hi=0.45, er=[(0.0041, 0.55), (0.0073, 0.42), (0.0117, 0.34), (0.0164, 0.26), (0.0229, 0.2)], lpf=9000, seed=11),
    "small": dict(rt=0.28, pre=0.002, lo=1.0, hi=0.5, er=[(0.0021, 0.5), (0.0039, 0.4), (0.0061, 0.3)], lpf=10000, seed=12),
    "hall": dict(rt=2.3, pre=0.024, lo=1.25, hi=0.4, er=[(0.011, 0.5), (0.019, 0.42), (0.029, 0.35), (0.041, 0.28), (0.057, 0.22)], lpf=8000, seed=13),
    "cave": dict(rt=0.45, pre=0.003, lo=1.1, hi=0.35, er=[(0.0027, 0.6), (0.0051, 0.5), (0.0083, 0.4)], lpf=2600, seed=14),
}


def ir(kind):
    """Synthetic stereo impulse response (unit energy per channel, decorrelated L/R)."""
    if kind in _IR:
        return _IR[kind]
    p = IR_SPECS[kind]
    r = rng(p["seed"])
    L = n_(p["rt"] * 1.5)
    t = np.arange(L) / SR
    chans = []
    for ch in range(2):
        nz = r.standard_normal(L)
        low = lp(nz, 500)
        high = hp(nz, 4000)
        mid = nz - low - high
        dec = lambda rt: np.exp(-6.91 * t / rt)
        tail = low * dec(p["rt"] * p["lo"]) + mid * dec(p["rt"]) + high * dec(p["rt"] * p["hi"])
        tail *= 1 - np.exp(-t / 0.012)
        tail /= np.sqrt(np.sum(tail ** 2))
        h = np.zeros(L + n_(p["pre"]) + n_(0.07))
        h[n_(p["pre"]):n_(p["pre"]) + L] += tail
        for k, (d, g) in enumerate(p["er"]):
            d2 = d * (1 + 0.13 * (ch * 2 - 1) * (1 if k % 2 else -1))
            h[n_(d2)] += g * 0.18 * (1 if (k + ch) % 2 else -1)
        h = lp(h, p["lpf"])
        h /= np.sqrt(np.sum(h ** 2))
        chans.append(h)
    _IR[kind] = np.stack(chans, 1)
    return _IR[kind]


def place(x, pan=0.0, room=None, wet_db=-14.0, dry=1.0):
    """Mono -> stereo: constant-power pan (0 dB per channel at centre) + optional stereo reverb."""
    a = (pan + 1) * np.pi / 4
    gl, gr = np.cos(a) * np.sqrt(2), np.sin(a) * np.sqrt(2)
    x = np.array(x, float)
    g10 = min(len(x) // 4, n_(0.01))
    if g10 > 1:
        x[-g10:] *= cosramp(g10)[::-1]                       # guard: the dry signal never stops abruptly
    h = ir(room) if room else None
    n = len(x) + (len(h) - 1 if h is not None else 0)
    out = np.zeros((n, 2))
    out[:len(x), 0] += dry * gl * x
    out[:len(x), 1] += dry * gr * x
    if h is not None:
        g = 10 ** (wet_db / 20)
        for c in range(2):
            out[:, c] += g * signal.fftconvolve(x, h[:, c])
    return out


# ------------------------------------------------------------------------------------ loudness (BS.1770)
_KB1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
_KA1 = [1.0, -1.69065929318241, 0.73248077421585]
_KB2 = [1.0, -2.0, 1.0]
_KA2 = [1.0, -1.99004745483398, 0.99007225036621]


def _power(x):
    x = np.asarray(x, float)
    if x.ndim == 1:
        x = x[:, None]
    y = signal.lfilter(_KB2, _KA2, signal.lfilter(_KB1, _KA1, x, axis=0), axis=0)
    return np.sum(y * y, axis=1)


def momentary(x, hop=0.05, win=0.4):
    """Momentary loudness (LUFS) every hop seconds; returns (values, start times)."""
    p = _power(x)
    w = n_(win)
    if len(p) < w:
        p = np.concatenate([p, np.zeros(w - len(p))])
    cs = np.concatenate([[0.0], np.cumsum(p)])
    st = np.arange(0, len(p) - w + 1, n_(hop))
    ms = (cs[st + w] - cs[st]) / w
    return -0.691 + 10 * np.log10(ms + 1e-20), st / SR


def mmax(x):
    return float(momentary(x)[0].max())


def integrated(x):
    """BS.1770-4 gated integrated loudness (LUFS)."""
    lk, _ = momentary(x, hop=0.1, win=0.4)
    lk = lk[lk > -70]
    if len(lk) == 0:
        return -70.0
    zr = -0.691 + 10 * np.log10(np.mean(10 ** ((lk + 0.691) / 10))) - 10
    g = lk[lk > zr]
    return float(-0.691 + 10 * np.log10(np.mean(10 ** ((g + 0.691) / 10))))


# --------------------------------------------------------------------------------------------- output
INFO = {}


def save(name, x, level=REF_LUFS, by="mmax", fade_in=0.002, fade_out=0.03, trim_db=-60.0):
    x = np.asarray(x, float)
    if x.ndim == 1:
        x = place(x)
    x = hp(x, 18.0, 2)                                    # DC / sub-sonic removal
    env = np.abs(x).max(axis=1)
    above = np.nonzero(env > env.max() * 10 ** (trim_db / 20))[0]
    x = x[:min(len(x), above[-1] + n_(0.02))]
    fi, fo = max(1, n_(fade_in)), max(1, min(n_(fade_out), len(x) // 2))
    x[:fi] *= cosramp(fi)[:, None]
    x[-fo:] *= cosramp(fo)[::-1][:, None]
    cur = mmax(x) if by == "mmax" else integrated(x)
    g = 10 ** ((level - cur) / 20)
    pk = np.abs(x).max() * g
    if pk > 10 ** (PEAK_CAP_DB / 20):
        g *= 10 ** (PEAK_CAP_DB / 20) / pk
    x = x * g
    x -= x.mean(axis=0)                                   # exact zero mean (no DC offset)
    os.makedirs(SFX_DIR, exist_ok=True)
    sf.write(os.path.join(SFX_DIR, name + ".wav"), x.astype(np.float32), SR, subtype="PCM_24")
    INFO[name] = dict(dur=len(x) / SR, peak_db=20 * np.log10(np.abs(x).max() + 1e-12),
                      rms_db=20 * np.log10(rms(x) + 1e-12), mmax=mmax(x), lufs_i=integrated(x))
    return x


# ------------------------------------------------------------------------------------------- voices
# Adult male formants F1..F5 (Hz); women x~1.15, children x~1.3
VOWELS = {
    "a": (730, 1090, 2440, 3400, 4300), "uh": (640, 1190, 2390, 3350, 4300), "ae": (660, 1720, 2410, 3400, 4350),
    "o": (570, 860, 2410, 3350, 4300), "e": (530, 1840, 2480, 3450, 4350), "i": (290, 2250, 3010, 3600, 4400),
    "u": (320, 900, 2240, 3350, 4300), "er": (490, 1350, 1690, 3300, 4300), "ih": (390, 1990, 2550, 3500, 4350),
    "aw": (680, 1050, 2600, 3400, 4300),
}
BWS = (80, 100, 150, 250, 320)


def syllable(r, f0a, f0b, vdur, vowel, fs=1.0, asp=0.04, asp_amp=0.5, breath=0.12, tilt=1.15,
             jitter=0.012, vib=(0.0, 0.0), cons=None, fvar=0.04, fmax=7500.0):
    """One voiced syllable through a Klatt-style formant cascade.
    asp = /h/ aspiration lead (s) shaped by the same vowel formants; cons = optional consonant noise ('s','f','t','k')."""
    pre = asp
    if cons in ("s", "f"):
        pre = max(pre, 0.06)
    elif cons in ("t", "k"):
        pre = max(pre, 0.035)
    rel = 0.05
    t = tt(pre + vdur + rel)
    n = len(t)
    tv = t - pre
    u = np.clip(tv / vdur, 0, 1)
    f0 = f0a * (f0b / f0a) ** u
    f0 = f0 * (1 + jitter * lpnoise(r, n, 35)) * (1 + vib[0] * np.sin(2 * np.pi * vib[1] * t))
    ve = att(tv, 0.012) * (0.5 + 0.5 * np.cos(np.pi * np.clip((tv - vdur + 0.04) / 0.04, 0, 1))) * (tv >= 0)
    ve *= (0.3 + 0.7 * np.exp(-2.2 * u)) * (1 + 0.06 * lpnoise(r, n, 25))      # decaying vowel + shimmer
    ph = 2 * np.pi * np.cumsum(f0) / SR
    src = harmonics(f0, fmax=fmax, tilt=tilt) * ve
    noise = hp(r.standard_normal(n), 350)
    src += noise * breath * ve * (0.55 + 0.45 * np.cos(ph))
    if asp > 0:
        ae = np.where(tv < 0, np.clip(t / asp, 0, 1) ** 1.5, np.exp(-np.maximum(tv, 0) / 0.018))
        ae *= (t >= pre - asp)
        src += noise * asp_amp * ae
    y = src
    for f, b in zip(VOWELS[vowel], BWS):
        y = reson(y, f * fs * r.uniform(1 - fvar, 1 + fvar), b * fs ** 0.5)
    if cons in ("s", "f"):
        lo, hi, a = (3800, 9000, 0.10) if cons == "s" else (1500, 7000, 0.05)
        cz = bp(r.standard_normal(n), lo, hi) * a * np.sin(np.pi * np.clip(t / pre, 0, 1)) ** 2 * (tv < 0)
        y = y + cz * rms(y) / 0.05
    elif cons in ("t", "k"):
        b0 = pre - 0.012
        cz = hp(r.standard_normal(n), 1500 if cons == "t" else 900) * np.exp(-np.maximum(t - b0, 0) / 0.004) * (t >= b0)
        y = y * (tv >= -0.005) + cz * rms(y) * 1.5
    return y


def inhale(r, dur, fs):
    """Laugh gasp: breathy noise through /ih/ formants."""
    t = tt(dur)
    x = r.standard_normal(len(t))
    for f, b in zip(VOWELS["ih"], BWS):
        x = reson(x, f * fs, b * 2.5)
    x = hp(x, 900)
    return x * np.sin(np.pi * t / dur) ** 1.5 / (rms(x) + 1e-12)


# =========================================================================================== EFFECTS
def make_squeak():
    """Small rubbery cartoon squeak (~0.25 s): pitch swoop + stick-slip roughness + nasal 'eek' formants."""
    r = rng(101)
    d = 0.25
    t = tt(d)
    u = t / d
    f0 = np.interp(u, [0, 0.16, 0.45, 0.8, 1], [540, 860, 800, 700, 620])
    f0 = f0 * (1 + 0.03 * np.sin(2 * np.pi * 23 * t) + 0.012 * lpnoise(r, len(t), 60))
    src = harmonics(f0, fmax=9000, tilt=1.05)
    slip = np.sin(2 * np.pi * np.cumsum(52 * (1 + 0.15 * lpnoise(r, len(t), 20))) / SR)
    slip = 0.72 + 0.28 * lp(np.tanh(4 * slip), 500)                 # rubber stick-slip pulsing
    y = reson(src, 1300, 220) + 0.55 * reson(src, 2500, 380) + 0.25 * reson(src, 3900, 500)
    env = att(t, 0.012) * np.interp(u, [0, 0.12, 0.6, 0.85, 1], [0.6, 1, 0.85, 0.45, 0])
    y = hp(y * env * slip, 350)
    return save("squeak", place(y, 0, "small", -20), fade_out=0.02)


CLINKS = {   # (f Hz, amp, tau s) partials: fork/knife on porcelain, glass tink, spoon on bowl, cup
    "clink_1": dict(p=[(2870, 1.0, 0.085), (4130, 0.6, 0.055), (6020, 0.45, 0.032), (8240, 0.22, 0.018), (3350, 0.3, 0.05)], dbl=(0.034, 0.45), seed=201),
    "clink_2": dict(p=[(2310, 1.0, 0.11), (3720, 0.5, 0.065), (5480, 0.38, 0.038), (7900, 0.18, 0.02)], dbl=None, seed=202),
    "clink_3": dict(p=[(1630, 0.7, 0.3), (4390, 1.0, 0.15), (8150, 0.3, 0.05), (2920, 0.2, 0.09)], dbl=None, seed=203),
    "clink_4": dict(p=[(1240, 1.0, 0.15), (3080, 0.6, 0.075), (5150, 0.3, 0.04)], dbl=(0.052, 0.35), seed=204),
    "clink_5": dict(p=[(3400, 1.0, 0.05), (5100, 0.6, 0.03), (7600, 0.35, 0.017)], dbl=(0.028, 0.6), seed=205),
    "clink_6": dict(p=[(1890, 1.0, 0.13), (2650, 0.5, 0.095), (4700, 0.4, 0.05), (6900, 0.2, 0.025)], dbl=None, seed=206),
}


def clink_mono(spec, seed=None, detune=1.0):
    d = 0.6
    y = modal(spec["p"], d, seed=spec["seed"] if seed is None else seed, strike=0.12, detune=detune)
    if spec["dbl"]:
        dt, a = spec["dbl"]
        y2 = modal(spec["p"], d, seed=(spec["seed"] if seed is None else seed) + 50, strike=0.1, detune=detune * 1.004)
        y = y + a * np.concatenate([np.zeros(n_(dt)), y2[:len(y) - n_(dt)]])
    return hp(y, 600)


def make_clinks():
    for name, spec in CLINKS.items():
        save(name, place(clink_mono(spec), 0, "room", -15), fade_out=0.05)


def make_fork_down():
    """Fork set down gently on the plate: tines touch, handle settles 70 ms later, tiny rattle."""
    r = rng(301)
    y = np.zeros(n_(0.7))
    tines = [(3050, 1.0, 0.07), (4480, 0.55, 0.045), (6650, 0.35, 0.026), (2380, 0.35, 0.09)]
    add_at(y, modal(tines, 0.5, seed=302, strike=0.08), 0.0)
    add_at(y, 0.55 * modal([(f * 0.93, a, tau * 0.8) for f, a, tau in tines], 0.4, seed=303, strike=0.06), 0.072)
    add_at(y, 0.18 * modal([(f * 1.07, a, tau * 0.5) for f, a, tau in tines], 0.3, seed=304, strike=0.05), 0.118)
    t = tt(0.06)
    add_at(y, 0.12 * lp(r.standard_normal(len(t)), 900) * np.exp(-t / 0.012), 0.0)   # soft contact thump
    return save("fork_down", place(hp(y, 300), 0.05, "room", -16), fade_out=0.06)


def make_turkey_plop():
    """Slice of turkey landing on a plate: soft meaty thud + fleshy slap + damped plate tick + small bounce."""
    r = rng(401)
    d = 0.4
    t = tt(d)
    y = np.zeros(len(t))
    for k, (t0, a) in enumerate([(0.0, 1.0), (0.105, 0.32)]):
        f = 150 * np.exp(-t / 0.05) + 85
        thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045) * att(t, 0.002)
        slap = bp(r.standard_normal(len(t)), 250, 2400) * np.exp(-t / 0.011) * att(t, 0.0008)
        squish = np.sin(2 * np.pi * 380 * t) * np.exp(-t / 0.022) * att(t, 0.002)
        tick = modal([(2650, 1.0, 0.016), (4150, 0.5, 0.01)], d, seed=402 + k, strike=0.0)
        add_at(y, a * (1.0 * thump + 0.75 * slap / 0.3 * 0.3 + 0.35 * squish + 0.06 * tick), t0)
    return save("turkey_plop", place(y, 0, "room", -18), fade_out=0.05)


def make_potato_plop():
    """Mashed potatoes plopped on the plate: wet splat (grain cloud) + rising 'plop' + soft thump."""
    r = rng(411)
    d = 0.5
    t = tt(d)
    f = 120 * np.exp(-t / 0.06) + 75
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.055) * att(t, 0.002)
    fp = 210 * (1 + 1.3 * (1 - np.exp(-t / 0.035)))
    plop = np.sin(2 * np.pi * np.cumsum(fp) / SR) * np.exp(-t / 0.045) * att(t, 0.004)
    splat = np.zeros(len(t))
    for _ in range(46):                     # wet splatter grains, dense at the start
        t0 = r.exponential(0.025)
        if t0 > 0.18:
            continue
        g = tt(r.uniform(0.0015, 0.005))
        grain = bp(r.standard_normal(len(g)), *sorted(r.uniform([600, 1800], [1500, 4200]))) * np.sin(np.pi * g / g[-1]) ** 2
        add_at(splat, grain * r.uniform(0.3, 1.0) * np.exp(-t0 / 0.06), t0)
    schlup = bp(r.standard_normal(len(t)), 200, 900) * np.exp(-t / 0.04) * att(t, 0.003)
    y = 0.9 * thump + 0.7 * plop + 0.6 * splat / (rms(splat[:n_(0.1)]) * 4 + 1e-9) * 0.25 + 0.35 * schlup / 0.3 * 0.2
    return save("potato_plop", place(y, 0, "room", -17), fade_out=0.06)


def make_gravy_pour():
    """Thick gravy pouring for ~0.8 s: low liquid stream + many tiny rising bubbles + 2 glugs + end drips."""
    r = rng(421)
    d = 1.25
    t = tt(d)
    n = len(t)
    body_env = att(t - 0.0, 0.07) * (1 - att(t - 0.66, 0.17))
    stream = bp(r.standard_normal(n), 280, 1600) * (0.6 + 0.4 * np.clip(lpnoise(r, n, 7) * 0.5 + 0.5, 0, 1.5))
    stream = lp(stream, 2200) * body_env
    patter = lp(hp(r.standard_normal(n), 1200), 5000) * np.clip(lpnoise(r, n, 30), 0, None) * body_env * 0.12
    bub = np.zeros(n)
    tb = 0.03
    while tb < 0.8:
        add_at(bub, bubble(r.uniform(550, 1700), r.uniform(0.006, 0.018), rise=r.uniform(0.3, 0.8), amp=r.uniform(0.2, 1.0)), tb)
        tb += r.exponential(1 / 38)
    for t0, f0 in [(0.015, 230), (0.13, 290), (0.30, 260)]:
        add_at(bub, bubble(f0, 0.035, rise=0.7, amp=1.6), t0)
    for t0, f0 in [(0.9, 1050), (1.06, 1250)]:
        add_at(bub, bubble(f0, 0.012, rise=0.9, amp=0.6), t0)
    y = 0.55 * stream / rms(stream[n_(0.1):n_(0.7)]) * 0.3 + 0.25 * patter + 0.5 * bub
    return save("gravy_pour", place(y, -0.05, "room", -16), fade_in=0.01, fade_out=0.08)


def chew_event(r, wet=1.0):
    """One closed-mouth chew: muffled squish + a few wet clicks + a soft jaw bump."""
    d = 0.32
    t = tt(d)
    n = len(t)
    env = att(t, 0.025) * np.exp(-np.maximum(t - 0.03, 0) / 0.045)
    sq = lp(bp(r.standard_normal(n), 180, 1100), 1500, 2) * env
    y = sq / (rms(sq) + 1e-9) * 0.25
    for _ in range(r.integers(4, 9)):                    # wet mouth clicks
        g = tt(r.uniform(0.001, 0.0025))
        add_at(y, bp(r.standard_normal(len(g)), 1000, 4500) * np.hanning(len(g)) * r.uniform(0.15, 0.4) * wet, r.uniform(0.01, 0.12))
    y += 0.25 * np.sin(2 * np.pi * 115 * t) * np.exp(-t / 0.02) * att(t, 0.003)   # jaw
    return y


def make_chews():
    """Soft closed-mouth chewing: a bite (teeth on fork + crisp 'tk') then chews ~0.3 s apart."""
    for k, (times, wet, seed) in enumerate([([0.30, 0.58], 1.0, 501), ([0.29, 0.56], 1.4, 511), ([0.28, 0.55, 0.84], 1.1, 521)]):
        r = rng(seed)
        y = np.zeros(n_(times[-1] + 0.3))
        g = tt(0.05)
        add_at(y, hp(r.standard_normal(len(g)), 1800) * np.exp(-g / 0.0025) * 0.5, 0.0)
        add_at(y, 0.08 * modal([(4300, 1, 0.008), (6100, 0.5, 0.005)], 0.05, seed=seed + 1, strike=0), 0.0)
        add_at(y, chew_event(r, wet) * 0.8, 0.03)
        for i, tc in enumerate(times):
            add_at(y, chew_event(r, wet) * r.uniform(0.75, 1.0) * (1 - 0.12 * i), tc)
        save(f"chew_{k + 1}", place(lp(hp(y, 150), 7000), 0, "small", -22), fade_out=0.04)


def make_rumble(idx, dur, f0pts, cavpts, trains, seed, att_s=0.09, rel_s=0.2):
    """Stomach growl: creaky pulse train through a moving 'cavity' resonance (the grrrowl) + gurgling
    bubble trains + liquid slosh + a little sub body. All modulated by a swelling intensity envelope."""
    r = rng(seed)
    t = tt(dur)
    n = len(t)
    u = t / dur
    env = att(t, att_s) * (1 - att(t - (dur - rel_s), rel_s))
    env *= np.clip(1 + 0.28 * lpnoise(r, n, 3.5), 0.45, 1.6)
    f0 = np.interp(u, *zip(*f0pts)) * (1 + 0.05 * lpnoise(r, n, 8))
    ph = np.cumsum(f0) / SR
    idxs = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    pulses = np.zeros(n)
    for j, i in enumerate(idxs):
        if r.random() < 0.05:
            continue                                      # creak dropout
        i2 = i + int(r.normal(0, 0.05 * SR / f0[i]))
        if 0 <= i2 < n:
            a = r.uniform(0.6, 1.0) * (0.5 if (j % 2 and r.random() < 0.65) else 1.0)   # period doubling = growl
            pulses[i2] += a
    pulses = hp(pulses, 45)
    cav = np.interp(u, *zip(*cavpts)) * (1 + 0.06 * lpnoise(r, n, 5))
    growl = svf(pulses, cav, q=3.5) + 0.4 * svf(pulses, cav * 2.1, q=5.0) + 0.45 * reson(pulses, 170, 70) / 2.5
    growl = lp(growl, 1000, 4)
    flutter = np.clip(1 + 0.75 * lpnoise(r, n, 16), 0.08, 2.4)                 # bubbly flutter
    gate = 0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(7 + 2.5 * lpnoise(r, n, 1.5)) / SR)  # 'gurgle-gurgle' pulsing
    growl *= flutter * (0.35 + 0.65 * gate)
    growl /= rms(growl[n_(att_s):n - n_(rel_s)]) + 1e-9
    pad = n_(0.3)                                          # gurgles may ring out past the growl
    gur = np.zeros(n + pad)
    for tc, count, fstart, fstep in trains:
        tb = tc * dur
        for b in range(count):
            add_at(gur, bubble(fstart * (1 + fstep * b) * r.uniform(0.9, 1.1), r.uniform(0.014, 0.032),
                               rise=r.uniform(0.3, 0.9), amp=r.uniform(0.65, 1.0), harm=0.25), tb)
            tb += r.uniform(0.024, 0.046)
    tb = r.uniform(0.05, 0.15)
    while tb < dur - 0.1:                                  # stray small bubbles
        add_at(gur, bubble(r.uniform(300, 900), r.uniform(0.008, 0.02), rise=0.6, amp=r.uniform(0.15, 0.4)), tb)
        tb += r.exponential(1 / 7)
    gur = lp(gur, 1600, 4)
    slosh = lp(bp(r.standard_normal(n), 160, 650), 900, 4) * lpnoise(r, n, 9) ** 2
    slosh /= rms(slosh) + 1e-9
    sub = lp(r.standard_normal(n), 75, 4)
    sub = sub / (rms(sub) + 1e-9) + 0.7 * np.sin(2 * np.pi * np.cumsum(46 + 6 * lpnoise(r, n, 2)) / SR)
    y = np.concatenate([env * (1.0 * growl + 0.22 * slosh + 0.28 * sub), np.zeros(pad)])
    gg = np.clip(env * 1.3, 0.25, 1)
    y += 1.0 * gur * np.concatenate([gg, np.full(pad, gg[-1])])
    out = place(y, 0, "cave", -14)
    return save(f"rumble{idx}", out, level=REF_LUFS + RUMBLE_STEPS_DB[idx], fade_out=0.06)


def make_rumbles():
    # duration, f0 contour (u, Hz), cavity resonance contour (u, Hz), gurgle trains (u, count, f, step), seed
    make_rumble(1, 0.85, [(0, 92), (0.3, 118), (0.7, 104), (1, 82)], [(0, 300), (0.45, 430), (1, 290)],
                [(0.55, 3, 330, 0.18)], 601)
    make_rumble(2, 0.90, [(0, 86), (0.25, 124), (0.55, 108), (0.8, 128), (1, 76)], [(0, 280), (0.4, 540), (0.75, 420), (1, 300)],
                [(0.3, 3, 300, 0.2), (0.7, 4, 380, 0.15)], 602)
    make_rumble(3, 1.05, [(0, 72), (0.2, 116), (0.45, 92), (0.7, 134), (1, 66)], [(0, 250), (0.35, 600), (0.6, 380), (0.85, 520), (1, 260)],
                [(0.15, 3, 280, 0.22), (0.5, 4, 360, 0.18), (0.8, 3, 450, 0.2)], 603)
    make_rumble(4, 1.25, [(0, 64), (0.15, 102), (0.35, 82), (0.6, 142), (0.8, 118), (1, 56)],
                [(0, 240), (0.3, 640), (0.5, 380), (0.7, 660), (1, 250)],
                [(0.1, 3, 260, 0.2), (0.38, 4, 340, 0.18), (0.62, 3, 420, 0.22), (0.86, 5, 300, 0.15)], 604, rel_s=0.25)


def make_laugh():
    """Family laughing ~1.55 s: six formant-synth voices 'ha-ha-ha' / 'ho-ho' / 'hee-hee', each with its own
    pitch, syllable rate (4-6.5 /s), slowing down and getting quieter through the bout, /h/ aspiration
    between syllables, jitter/shimmer, some end with a gasp. Panned around the table + room reverb."""
    voices = [
        dict(f0=(165, 118), rate=4.5, n=6, t0=0.00, v="uh", fs=1.00, tilt=1.0, breath=0.10, amp=1.00, pan=0.00, gasp=False, vib=(0, 0)),     # uncle
        dict(f0=(205, 150), rate=4.7, n=7, t0=0.04, v="ae", fs=1.03, tilt=1.1, breath=0.12, amp=0.62, pan=0.35, gasp=True, vib=(0, 0)),      # dad
        dict(f0=(345, 268), rate=5.0, n=7, t0=0.08, v="a", fs=1.16, tilt=1.2, breath=0.18, amp=0.58, pan=-0.35, gasp=True, vib=(0, 0)),      # mom
        dict(f0=(292, 236), rate=4.3, n=5, t0=0.12, v="o", fs=1.12, tilt=1.35, breath=0.26, amp=0.42, pan=-0.6, gasp=False, vib=(0.03, 6)),  # grandma
        dict(f0=(470, 392), rate=6.0, n=8, t0=0.18, v="i", fs=1.28, tilt=1.25, breath=0.20, amp=0.36, pan=0.6, gasp=False, vib=(0, 0)),      # cousin A giggle
        dict(f0=(420, 345), rate=4.8, n=6, t0=0.03, v="a", fs=1.30, tilt=1.2, breath=0.15, amp=0.32, pan=0.75, gasp=False, vib=(0, 0)),      # cousin B
    ]
    r = rng(701)
    out = None
    for vi, v in enumerate(voices):
        buf = np.zeros(n_(2.4))
        tcur = v["t0"]
        for k in range(v["n"]):
            prog = k / (v["n"] - 1)
            period = (1 / v["rate"]) * (1 + 0.28 * prog ** 2) * r.uniform(0.9, 1.1)
            vdur = period * r.uniform(0.42, 0.52)
            asp = period * r.uniform(0.14, 0.22)
            f0k = v["f0"][0] * (v["f0"][1] / v["f0"][0]) ** prog * r.uniform(0.95, 1.05) * (1.08 if k == 0 else 1.0)
            s = syllable(r, f0k * 1.05, f0k * 0.88, vdur, v["v"], fs=v["fs"], asp=asp, asp_amp=0.3, breath=v["breath"],
                         tilt=v["tilt"], jitter=0.015, vib=v["vib"])
            amp = (1 - 0.5 * prog ** 1.3) * r.uniform(0.85, 1.05) * (1.1 if k == 0 else 1.0)
            add_at(buf, s / (rms(s) + 1e-9) * amp, tcur)
            tcur += period
        if v["gasp"]:
            add_at(buf, 0.22 * inhale(r, 0.2, v["fs"]), tcur + 0.02)
        buf += 0.45 * hp(buf, 1800, 2)                                   # breathy presence
        buf *= v["amp"] / (rms(buf[np.abs(buf) > 0.05 * np.abs(buf).max()]) + 1e-9)
        st = place(buf, v["pan"], "room", -15)
        out = st if out is None else out + st
    return save("laugh", out, fade_out=0.08)


def make_dun():
    """Dramatic orchestral 'DUN': low brass section (C minor, scooped attack, bright blat that darkens),
    timpani, low piano octaves, a sub boom, into a 2.3 s hall."""
    r = rng(801)
    d = 3.2
    t = tt(d)
    n = len(t)
    brass = np.zeros(n)
    for f, a in [(65.41, 1.0), (98.0, 0.8), (130.81, 0.9), (155.56, 0.6), (196.0, 0.45)]:
        for c in (-7, 0, 6):
            fr = f * 2 ** (c / 1200) * (1 - 0.015 * np.exp(-t / 0.04))
            brass += a * saw(fr, phase0=r.random())
    cutoff = 450 + 2600 * np.exp(-t / 0.28) * att(t, 0.025) + 500 * np.exp(-t / 1.5)
    brass = svf(brass, cutoff, q=0.9, mode="lp")
    benv = att(t, 0.03) * (1 + 0.35 * np.exp(-t / 0.09)) * np.exp(-t / 1.3) * (1 - att(t - 1.6, 0.6))
    brass = brass * benv
    timp = np.zeros(n)
    f0 = 65.41 * (1 + 0.025 * np.exp(-t / 0.05))
    for ratio, a, tau in [(1.0, 1.0, 0.9), (1.504, 0.55, 0.6), (1.742, 0.25, 0.45), (2.0, 0.35, 0.5), (2.245, 0.15, 0.35), (2.494, 0.12, 0.3)]:
        timp += a * np.sin(2 * np.pi * np.cumsum(f0 * ratio) / SR) * np.exp(-t / tau)
    timp *= att(t, 0.003)
    timp += lp(r.standard_normal(n), 500) * np.exp(-t / 0.016) * 0.8
    piano = np.zeros(n)
    for f, a in [(32.70, 0.9), (65.41, 1.0), (98.0, 0.5), (130.81, 0.6)]:
        for k in range(1, 60):
            fk = k * f * np.sqrt(1 + 0.00025 * k * k)
            if fk > 5000:
                break
            piano += a * (k ** -0.75) * np.exp(-(fk / 2500) ** 2) * np.sin(2 * np.pi * fk * t) * np.exp(-t / (2.6 / (1 + fk / 450)))
    piano *= att(t, 0.002)
    piano += bp(r.standard_normal(n), 150, 2500) * np.exp(-t / 0.008) * 0.6
    fb = 42 + 30 * np.exp(-t / 0.05)
    boom = np.sin(2 * np.pi * np.cumsum(fb) / SR) * np.exp(-t / 0.3) * att(t, 0.003)
    y = (0.75 * brass / rms(brass[:n_(0.8)]) + 0.55 * timp / rms(timp[:n_(0.8)]) +
         0.45 * piano / rms(piano[:n_(0.8)]) + 0.5 * boom / rms(boom[:n_(0.5)]))
    y *= 1 - att(t - (d - 0.5), 0.5)
    out = place(y, 0, "hall", -7)
    return save("dun", out, fade_out=0.6)


def make_ding():
    """Clean bright bell 'ding' (G6): strong fundamental + soft inharmonic partials, light plate reverb."""
    d = 1.8
    y = modal([(1568, 1.0, 0.5), (1568 * 2.0, 0.1, 0.25), (1568 * 2.76, 0.12, 0.16), (1568 * 5.40, 0.05, 0.05), (1568 * 0.5, 0.03, 0.35)],
              d, seed=901, strike=0.05, strike_tau=0.0008, strike_hp=4000, beat=0.0012, twin=0.12)
    y = hp(y, 400)
    return save("ding", place(y, 0, "room", -16), fade_out=0.3)


def make_whoosh():
    """Subtle x-ray whoosh, peak at 0.30 s (the cut): band-passed noise sweeping up then down, panning
    left -> right, with a faint shimmering scan tone."""
    r = rng(1001)
    d = 0.8
    t = tt(d)
    n = len(t)
    pk = 0.30
    fc = np.where(t < pk, 350 * (2600 / 350) ** (t / pk), 2600 * (1100 / 2600) ** ((t - pk) / (d - pk)))
    nz = lp(r.standard_normal(n), 6000)
    y = svf(nz, fc, q=1.6)
    env = np.where(t < pk, (t / pk) ** 2.2, np.exp(-(t - pk) / 0.13)) * (1 - att(t - (d - 0.2), 0.2))
    shimmer = (np.sin(2 * np.pi * 880 * t) + 0.6 * np.sin(2 * np.pi * 1323 * t)) * (0.6 + 0.4 * np.sin(2 * np.pi * 13 * t))
    shimmer *= att(t - 0.22, 0.08) * np.exp(-np.maximum(t - 0.3, 0) / 0.15) * 0.05
    y = y * env / rms(y * env) * 0.3 + shimmer
    pan = np.clip((t - 0.05) / 0.6, 0, 1) * 1.2 - 0.6
    a = (pan + 1) * np.pi / 4
    st = np.stack([y * np.cos(a), y * np.sin(a)], 1) * np.sqrt(2)
    wet = place(y, 0, "room", -12, dry=0.0)
    st = np.concatenate([st, np.zeros((len(wet) - len(st), 2))]) + wet
    return save("xray_whoosh", st, fade_in=0.01, fade_out=0.1)


def make_bloop():
    """Cartoon stomach 'bloop' + small splash, slightly muffled (inside the body)."""
    r = rng(1101)
    d = 0.7
    t = tt(d)
    n = len(t)
    f = 180 * (650 / 180) ** np.clip(t / 0.09, 0, 1)
    bl = np.sin(2 * np.pi * np.cumsum(f) / SR) * att(t, 0.004) * np.exp(-np.maximum(t - 0.05, 0) / 0.05)
    f2 = 360 * (900 / 360) ** np.clip((t - 0.11) / 0.06, 0, 1)
    bl2 = np.sin(2 * np.pi * np.cumsum(f2) / SR) * att(t - 0.11, 0.004) * np.exp(-np.maximum(t - 0.15, 0) / 0.035) * 0.4
    splash = bp(r.standard_normal(n), 700, 5500) * att(t - 0.06, 0.006) * np.exp(-np.maximum(t - 0.065, 0) / 0.07)
    splash = splash / (rms(splash[n_(0.06):n_(0.2)]) + 1e-9) * 0.18
    bub = np.zeros(n)
    for _ in range(9):
        add_at(bub, bubble(r.uniform(900, 2600), r.uniform(0.006, 0.016), rise=0.7, amp=r.uniform(0.1, 0.3)), r.uniform(0.08, 0.38))
    low = lp(r.standard_normal(n), 220) * att(t - 0.05, 0.01) * np.exp(-np.maximum(t - 0.06, 0) / 0.06) * 0.6
    y = lp(0.8 * bl + bl2 + splash + bub + low / (rms(low) + 1e-9) * 0.1, 4500)
    return save("bloop", place(y, 0, "cave", -9), fade_out=0.08)


def make_zap():
    """Electric zap ~0.4 s: bright buzzy saw stack (118 Hz) sputtering on/off, arc crackle, and a short
    descending 'pew' for the signal shooting down."""
    r = rng(1201)
    d = 0.42
    t = tt(d)
    n = len(t)
    f = 118 * (1 + 0.03 * lpnoise(r, n, 30))
    buzz = saw(f) + 0.8 * saw(f * 2.01, 0.25) + 0.5 * saw(f * 3.03, 0.5)
    buzz = lp(hp(buzz, 300), 7000)
    sputter = lp((lpnoise(r, n, 60) > -0.5).astype(float), 300)          # on/off flicker (smoothed: no clicks)
    crackle = np.zeros(n)
    idx = r.choice(n, size=int(d * 400), replace=False)
    crackle[idx] = r.uniform(-1, 1, len(idx)) ** 3
    crackle = lp(hp(crackle, 2000), 9000)
    fp = 400 + 1200 * np.exp(-t / 0.08)
    pew = svf(saw(fp), fp * 2.5, q=1.0, mode="lp") * att(t, 0.003) * np.exp(-t / 0.09)
    env = att(t, 0.002) * (0.6 + 0.4 * np.exp(-t / 0.05)) * (1 - att(t - (d - 0.12), 0.12))
    y = env * (0.5 * buzz / rms(buzz) * (0.3 + 0.7 * sputter) + 0.35 * crackle / rms(crackle)) + 0.22 * pew / rms(pew[:n_(0.12)])
    return save("zap", place(y, 0, "small", -14), fade_out=0.06)


def make_squelch():
    """Soft wet rhythmic squelch for the colon squeeze (2.4 s, a squeeze every 0.6 s): dark noise through a
    sweeping resonance + wet bubbles + a low pressure swell, inside-the-body reverb."""
    r = rng(1301)
    d = 2.4
    t = tt(d)
    n = len(t)
    nz = lp(r.standard_normal(n), 2500, 2)
    bub = np.zeros(n)
    fc = np.full(n, 300.0)
    gate = np.zeros(n)
    for i, t0 in enumerate([0.12, 0.72, 1.32, 1.92]):
        lt = t - t0
        m = (lt >= 0) & (lt < 0.45)
        fc[m] = 300 + 900 * np.sin(np.pi * np.clip(lt[m] / 0.4, 0, 1)) ** 1.5
        gate += att(lt, 0.07) * np.exp(-np.maximum(lt - 0.08, 0) / 0.1) * (lt >= 0) * r.uniform(0.8, 1.0)
        for b in range(4):
            add_at(bub, bubble(r.uniform(220, 520), r.uniform(0.015, 0.03), rise=0.7, amp=r.uniform(0.3, 0.6), harm=0.2),
                   t0 + 0.04 + b * r.uniform(0.035, 0.065))
    sq = lp(svf(nz, fc, q=5.0), 1800, 2) * gate
    swell = lp(nz, 200) * gate
    y = sq / (rms(sq) + 1e-9) * 0.3 + 0.7 * bub + swell / (rms(swell) + 1e-9) * 0.12
    y *= 1 - att(t - (d - 0.15), 0.15)
    return save("squelch_loop", place(y, 0, "cave", -10), fade_in=0.08, fade_out=0.2)


def make_plate_thud():
    """Huge heavy plate set down: table thump + ceramic clack + food 'flump' + cutlery/glass rattle."""
    r = rng(1401)
    d = 2.2
    t = tt(d)
    n = len(t)
    thump = (np.sin(2 * np.pi * 96 * t) * np.exp(-t / 0.09) + 0.6 * np.sin(2 * np.pi * 163 * t) * np.exp(-t / 0.05)) * att(t, 0.002)
    clack = modal([(1150, 1.0, 0.06), (2230, 0.7, 0.04), (3480, 0.45, 0.025), (5200, 0.25, 0.014)], d, seed=1402, strike=0.3)
    flump = lp(r.standard_normal(n), 600) * att(t, 0.003) * np.exp(-t / 0.04)
    rattle = np.zeros(n)
    base = [(2870, 1.0, 0.05), (4130, 0.6, 0.035), (6020, 0.4, 0.02)]
    for k in range(9):
        t0 = 0.03 + 0.42 * (k / 8) ** 1.4 + r.uniform(-0.01, 0.01)
        sc = r.uniform(0.75, 1.4)
        rattle_part = modal([(f * sc, a, tau) for f, a, tau in base], 0.25, seed=1410 + k, strike=0.1)
        add_at(rattle, rattle_part * 0.35 * (1 - k / 10), t0)
    add_at(rattle, 0.25 * modal(CLINKS["clink_3"]["p"], 0.8, seed=1430), 0.05)    # a glass rings
    y = 1.0 * thump + 0.45 * clack + 0.5 * flump / (rms(flump[:n_(0.08)]) + 1e-9) * 0.2 + rattle
    return save("plate_thud", place(y, 0, "room", -14), fade_out=0.1)


def talker(r, dur, f0base, fs):
    """Background chatter voice: phrases of random CV syllables with falling intonation, then a pause."""
    out = np.zeros(n_(dur))
    tcur = r.uniform(0.0, 1.2)
    vows = list(VOWELS)
    while tcur < dur:
        nsyl = int(r.uniform(4, 13))
        for k in range(nsyl):
            prog = k / max(1, nsyl - 1)
            f0 = f0base * (1.12 - 0.25 * prog) * (1.15 if r.random() < 0.18 else 1.0) * r.uniform(0.96, 1.04)
            cons = r.choice(["s", "t", "k", "f", None, None, None])
            s = syllable(r, f0 * 1.03, f0 * 0.95, r.uniform(0.07, 0.15), r.choice(vows), fs=fs, asp=0.0,
                         breath=0.08, tilt=1.2, jitter=0.01, cons=cons, fvar=0.06, fmax=3500.0)
            add_at(out, s / (rms(s) + 1e-9) * r.uniform(0.6, 1.0) * (1 - 0.3 * prog), tcur)
            tcur += len(s) / SR * r.uniform(0.78, 0.95)
        tcur += r.uniform(0.35, 1.6)
    return out


def make_ambience():
    """Dinner bed (28.5 s, used in 3 slices): soft room tone + very soft murmur of other talkers
    (muffled, reverberant) + sparse seeded cutlery clinks around the table."""
    r = rng(1501)
    d = 28.5
    n = n_(d)
    st = np.zeros((n, 2))
    for c in range(2):                                            # soft brown-ish room air, decorrelated L/R
        tone = hp(lp(np.cumsum(r.standard_normal(n)), 700), 45)
        tone = tone / rms(tone) + 0.15 * lp(r.standard_normal(n), 2500)
        st[:, c] = tone / rms(tone) * 0.035
    mur = None
    for k, (f0, fs, pan) in enumerate([(118, 1.0, -0.5), (205, 1.16, 0.3), (132, 1.02, 0.65), (228, 1.18, -0.2), (105, 0.98, 0.1)]):
        v = talker(rng(1510 + k), d, f0, fs)
        v = lp(v, 1700, 2) * (0.9 + 0.1 * np.sin(2 * np.pi * 0.05 * np.arange(n) / SR + k))
        pv = place(v / (rms(v) + 1e-9), pan, "room", 0.0, dry=0.55)[:n]
        mur = pv if mur is None else mur + pv
    mur /= rms(mur)
    cl = np.zeros((n, 2))
    tc = 0.4
    names = list(CLINKS)
    k = 0
    while tc < d - 0.5:
        spec = CLINKS[names[int(r.integers(len(names)))]]
        c = clink_mono(spec, seed=1600 + k, detune=r.uniform(0.85, 1.2)) * 10 ** (r.uniform(-14, 0) / 20)
        pc = place(c, r.uniform(-0.8, 0.8), "room", -6, dry=0.6)
        i = n_(tc)
        j = min(n, i + len(pc))
        cl[i:j] += pc[:j - i]
        tc += 0.28 + r.exponential(0.9)
        k += 1
    y = st + 0.10 * mur + 0.045 * cl / (np.abs(cl).max() + 1e-9) * 6
    return save("ambience", y, by="lufs", fade_in=0.3, fade_out=0.3)


# ============================================================================================== CUES
def read_plan():
    """Shot plan from web/plan.js (via node; regex fallback)."""
    path = os.path.join(HERE, "web", "plan.js")
    try:
        out = subprocess.run(["node", "-e", "import(process.argv[1]).then(m=>console.log(JSON.stringify(m.PLAN)))",
                              "file://" + path], capture_output=True, text=True, check=True, cwd=HERE).stdout
        return json.loads(out)
    except Exception:
        src = open(path).read()
        plan = []
        for m in re.finditer(r"\{\s*id:\s*'(s\d+)',\s*t0:\s*([\d.]+),\s*t1:\s*([\d.]+)(.*?)\n\s*(?=\{ id:|\];)", src, re.S):
            ev = {}
            e = re.search(r"events:\s*\{(.*?)\}\s*\}", m.group(4), re.S)
            if e:
                for k, v in re.findall(r"(\w+):\s*(\[[^\]]*\]|[\d.]+)", e.group(1)):
                    ev[k] = json.loads(v)
            plan.append(dict(id=m.group(1), t0=float(m.group(2)), t1=float(m.group(3)), events=ev))
        return plan


def build_cues():
    plan = {s["id"]: s for s in read_plan()}
    ev = lambda sid, k: plan[sid]["events"][k]
    T0 = lambda sid: plan[sid]["t0"]
    T1 = lambda sid: plan[sid]["t1"]
    cues = []

    def cue(t, f, g, note, **kw):
        c = dict(t=round(float(t), 3), file=f"audio/sfx/{f}.wav", gain_db=g, note=note)
        c.update({k: (round(v, 3) if isinstance(v, float) else v) for k, v in kw.items()})
        cues.append(c)

    # --- ambience bed: three slices of one 28.5 s file (no repeats), fading at the edges
    a1, a2 = T0("s02"), T1("s12")
    cue(a1, "ambience", -16.0, "dinner bed s02-s12", offset=0.0, dur=a2 - a1 + 0.3, fade_in=0.35, fade_out=0.45)
    b1, b2 = T0("s15"), T1("s18")
    cue(b1, "ambience", -16.0, "dinner bed s15-s18 (cut on the DUN)", offset=18.6, dur=b2 - b1, fade_in=0.4, fade_out=0.12)
    c1, c2 = T0("s23"), T1("s24")
    cue(c1, "ambience", -16.0, "dinner bed s23-s24, gone by 'the whole table goes quiet'", offset=24.7, dur=c2 - c1 + 0.04,
        fade_in=0.3, fade_out=0.3)
    # --- foreground clinks in the gaps of the narration (family eating)
    for t, f, g, note in [
        (T0("s02") + 1.56, "clink_2", -11.0, "s02 knife on plate (gap after 'dinner')"),
        (T0("s03") + 0.62, "clink_1", -13.0, "s03 fork on plate"),
        (T0("s03") + 1.68, "clink_4", -11.0, "s03 spoon in bowl (gap)"),
        (T0("s04") + 1.42, "clink_3", -15.0, "s04 glass tink in YOU's frozen pause 'very, ... very'"),
        (T0("s05") + 0.04, "clink_5", -12.0, "s05 family eating"),
        (T0("s05") + 1.32, "clink_6", -12.0, "s05 cup (gap)"),
        (T0("s06") + 0.50, "clink_1", -12.0, "s06 Grandma's serving fork on the platter"),
        (T0("s11") + 0.46, "clink_5", -12.0, "s11 Uncle's fork, just before he looks up"),
        (T0("s15") + 0.04, "clink_4", -10.0, "s15 Grandma's big spoon in the potato bowl"),
        (T0("s23") + 0.07, "clink_2", -12.0, "s23 cutlery"),
    ]:
        cue(t, f, g, note)
    # --- story events
    cue(ev("s01", "squeak"), "squeak", -6.0, "s01 the squeak (small, on 'pooped')", duck_db=3.0)
    cue(ev("s07", "plop"), "turkey_plop", -4.0, "s07 turkey slice lands")
    cue(ev("s08", "bite"), "chew_1", -7.0, "s08 bite + nervous chews")
    for k, sid in [(1, "s09"), (2, "s10"), (3, "s18"), (4, "s23")]:
        w = ev(sid, f"rumble{k}")
        cue(w[0], f"rumble{k}", 1.5, f"{sid} stomach rumble {k} ({w[0]}-{w[1]}), louder each time",
            duck_db=1.5, cap_db=[-6.0, -3.5, -2.0, -1.0][k - 1])
    cue(ev("s13", "laugh")[0], "laugh", -1.0, "s13 family laughs (under 'Everyone laughs')")
    cue(ev("s15", "plop"), "potato_plop", -3.0, "s15 mashed potatoes land")
    cue(ev("s16", "pour")[0], "gravy_pour", -6.0, "s16 gravy pour")
    cue(ev("s17", "bite"), "chew_2", -7.0, "s17 bite + chews (potatoes)")
    cue(ev("s19", "dun"), "dun", 0.0, "s19 dramatic DUN on the cut", duck_db=6.0)
    cue(T0("s20") - 0.30, "xray_whoosh", -11.0, "s20 x-ray whoosh, peak on the cut at %.2f" % T0("s20"))
    cue(ev("s20", "land"), "bloop", -3.0, "s20 food lands in the stomach")
    cue(ev("s21", "zap"), "zap", -4.0, "s21 electric signal")
    cue(T0("s22"), "squelch_loop", -8.0, "s22 colon squeeze waves", dur=T1("s22") - T0("s22"), fade_in=0.1, fade_out=0.25)
    cue(ev("s23", "bite"), "chew_3", -7.0, "s23 bite + chews")
    cue(ev("s24", "clink"), "fork_down", -5.0, "s24 fork set down on the plate")
    cue(ev("s27", "thud"), "plate_thud", -2.0, "s27 third plate lands")
    cue(ev("s29", "ding"), "ding", -4.0, "s29 the final ding")
    cues.sort(key=lambda c: c["t"])
    json.dump(cues, open(CUES, "w"), indent=1)
    return cues


def main():
    os.makedirs(SFX_DIR, exist_ok=True)
    make_squeak()
    make_clinks()
    make_fork_down()
    make_turkey_plop()
    make_potato_plop()
    make_gravy_pour()
    make_chews()
    make_rumbles()
    make_laugh()
    make_dun()
    make_ding()
    make_whoosh()
    make_bloop()
    make_zap()
    make_squelch()
    make_plate_thud()
    make_ambience()
    cues = build_cues()
    print(f"{'file':14s} {'dur':>6s} {'peak':>7s} {'rms':>7s} {'Mmax':>7s} {'I':>7s}")
    for k, v in INFO.items():
        print(f"{k:14s} {v['dur']:6.2f} {v['peak_db']:7.1f} {v['rms_db']:7.1f} {v['mmax']:7.1f} {v['lufs_i']:7.1f}")
    print(f"wrote {len(INFO)} files to audio/sfx/ and {len(cues)} cues to audio/sfx_cues.json")


if __name__ == "__main__":
    main()
