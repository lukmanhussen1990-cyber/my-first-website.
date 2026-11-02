#!/usr/bin/env python3
"""Code-made sound effects for the Singapore reel (numpy + scipy only, fixed seeds -> identical output).

Usage:   python3 make_sfx.py
Reads:   web/plan.js (shot times + sync events, read with node; regex fallback), audio/vo_lines.json
Writes:  audio/sfx/*.wav   48 kHz, 24-bit, stereo
         audio/sfx_cues.json   [{t, file, gain_db, note, [offset, dur, fade_in, fade_out, duck_db, cap_db]}]

Level convention (so cue gains mean something): every effect is normalised so its loudest 400 ms
(EBU R128 momentary loudness) sits at REF_LUFS = -20 LUFS; the beds (city, room_tone) are normalised by integrated
loudness. mix.py puts the voice at -20 LUFS integrated, so a cue's gain_db is roughly "how loud the effect is
compared with the narrator" before ducking (always negative here: the voice stays on top). Sample peaks are capped
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
def make_pop():
    """Cartoon 'bloop' when the poop appears: rising bubble chirp + tiny low thud (silly, not gross)."""
    r = rng(101)
    d = 0.45
    t = tt(d)
    f = 220 * (760 / 220) ** np.clip(t / 0.07, 0, 1)
    bl = np.sin(2 * np.pi * np.cumsum(f) / SR) * att(t, 0.003) * np.exp(-np.maximum(t - 0.05, 0) / 0.045)
    f2 = 420 * (1100 / 420) ** np.clip((t - 0.09) / 0.05, 0, 1)
    bl2 = 0.35 * np.sin(2 * np.pi * np.cumsum(f2) / SR) * att(t - 0.09, 0.003) * np.exp(-np.maximum(t - 0.12, 0) / 0.03)
    thud = np.sin(2 * np.pi * 110 * t) * att(t, 0.002) * np.exp(-t / 0.035) * 0.5
    y = bl + bl2 + thud + 0.05 * lp(r.standard_normal(len(t)), 3000) * np.exp(-t / 0.01)
    return save("pop", place(y, 0, "small", -14), fade_out=0.05)


def bell(f0, dur, seed, amp=1.0):
    return amp * modal([(f0, 1.0, 0.35), (f0 * 2.0, 0.12, 0.18), (f0 * 2.76, 0.1, 0.12), (f0 * 5.4, 0.04, 0.04)],
                       dur, seed=seed, strike=0.04, strike_tau=0.0006, strike_hp=5000, beat=0.0012, twin=0.1)


def make_sparkle():
    """Sparkle shimmer: a bright 'ding' + a quick run of tiny high tinkles that twinkle and pan around."""
    r = rng(201)
    d = 1.6
    n = n_(d)
    st = np.zeros((n + n_(0.6), 2))
    main = hp(bell(2093, 1.4, 202), 500)
    st[:len(place(main, 0))] += place(main, 0)[:len(st)]
    for k in range(14):
        f = r.choice([2637, 3136, 3520, 4186, 4699, 5274, 6272])
        b = hp(bell(f, 0.4, 210 + k, amp=r.uniform(0.15, 0.35)), 1500)
        pb = place(b, r.uniform(-0.8, 0.8))
        i = n_(0.03 + 0.045 * k + r.uniform(0, 0.02))
        j = min(len(st), i + len(pb))
        st[i:j] += pb[:j - i]
    wet = place(st[:, 0] + st[:, 1], 0, "room", -10, dry=0.0)[:len(st)] * 0.5
    st[:len(wet)] += wet
    return save("sparkle", st, fade_out=0.3)


def make_swish():
    """Fast whip/whoosh for a punch-in or heads turning (peak at 0.12 s)."""
    r = rng(301)
    d = 0.45
    t = tt(d)
    pk = 0.12
    fc = np.where(t < pk, 500 * (3500 / 500) ** (t / pk), 3500 * (700 / 3500) ** np.clip((t - pk) / 0.25, 0, 1))
    y = svf(r.standard_normal(len(t)), fc, q=1.4)
    env = np.where(t < pk, (t / pk) ** 2, np.exp(-(t - pk) / 0.07))
    y *= env
    a = (np.clip(t / d, 0, 1) * 1.2 - 0.6 + 1) * np.pi / 4
    st = np.stack([y * np.cos(a), y * np.sin(a)], 1) * np.sqrt(2)
    return save("swish", st, fade_in=0.01, fade_out=0.08)


def make_splash():
    """Coffee splash out of a cup: wet noise burst + bubbles + droplets landing a moment later."""
    r = rng(401)
    d = 0.9
    t = tt(d)
    n = len(t)
    burst = bp(r.standard_normal(n), 900, 6500) * att(t, 0.004) * np.exp(-t / 0.06)
    slosh = svf(r.standard_normal(n), 600 + 1400 * np.exp(-t / 0.08), q=3.0) * att(t, 0.006) * np.exp(-t / 0.1)
    bub = np.zeros(n)
    for _ in range(12):
        add_at(bub, bubble(r.uniform(700, 2200), r.uniform(0.005, 0.014), rise=0.6, amp=r.uniform(0.2, 0.5)), r.uniform(0.0, 0.18))
    drops = np.zeros(n)
    for _ in range(9):
        dd = bubble(r.uniform(1400, 3200), r.uniform(0.003, 0.006), rise=0.3, amp=r.uniform(0.15, 0.35))
        add_at(drops, dd + 0.2 * hp(r.standard_normal(len(dd)), 3000) * np.exp(-np.arange(len(dd)) / SR / 0.002), r.uniform(0.32, 0.62))
    y = burst / rms(burst[:n_(0.1)]) * 0.35 + slosh / rms(slosh[:n_(0.15)]) * 0.25 + bub + drops
    return save("splash", place(y, 0.1, "small", -12), fade_out=0.08)


def make_bag_drop():
    """Shopping bag hits the pavement: low thump + paper crinkle crackles."""
    r = rng(501)
    d = 0.7
    t = tt(d)
    n = len(t)
    thump = (np.sin(2 * np.pi * np.cumsum(85 + 50 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.07)) * att(t, 0.002)
    crk = np.zeros(n)
    for k in range(70):
        i = int(min(n - 1, (r.exponential(0.07)) * SR))
        crk[i] += r.uniform(-1, 1) * np.exp(-i / SR / 0.15)
    crk = bp(crk, 1500, 7000)
    rustle = bp(r.standard_normal(n), 1200, 5000) * att(t, 0.004) * np.exp(-t / 0.09)
    y = thump + 0.6 * crk / (rms(crk[:n_(0.2)]) + 1e-9) * 0.2 + 0.08 * rustle / (rms(rustle[:n_(0.15)]) + 1e-9)
    return save("bag_drop", place(y, -0.2, "small", -14), fade_out=0.08)


ORANGE_HITS = [(0.0, 1.0), (0.003, 1.0), (0.012, 0.95), (0.025, 0.9), (0.037, 0.95), (0.071, 0.85), (0.081, 0.9),
               (0.216, 0.35), (0.219, 0.35), (0.229, 0.3), (0.245, 0.3), (0.259, 0.3), (0.299, 0.25), (0.311, 0.28)]


def make_oranges():
    """8 oranges land (two bounces each, times from the picture's physics) and roll around."""
    r = rng(601)
    d = 1.4
    n = n_(d)
    st = np.zeros((n + n_(0.5), 2))
    for k, (t0, a) in enumerate(ORANGE_HITS):
        fs = r.uniform(0.85, 1.2)
        tk = modal([(310 * fs, 1.0, 0.025), (720 * fs, 0.5, 0.015), (1500 * fs, 0.2, 0.008)], 0.2, seed=610 + k, strike=0.25,
                   strike_tau=0.0015, strike_hp=1800)
        tk += 0.5 * np.sin(2 * np.pi * 140 * fs * tt(len(tk) / SR)) * np.exp(-tt(len(tk) / SR) / 0.02)
        p = place(tk * a, r.uniform(-0.7, 0.7))
        i = n_(t0)
        st[i:i + len(p)] += p[:len(st) - i]
    t = tt(len(st) / SR)
    roll = lp(r.standard_normal(len(t)), 450) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 7 * t)))
    roll *= att(t - 0.1, 0.15) * (1 - att(t - 0.9, 0.5))
    pr = place(roll / rms(roll[n_(0.3):n_(0.8)]) * 0.12, 0.2)
    st[:len(pr)] += pr[:len(st)]
    return save("oranges", st, fade_out=0.2)


def make_step(name, seed, far=False):
    """Heavy boot stomp on stone: sub thump with pitch drop + heel clack + grit + street slap-back echo."""
    r = rng(seed)
    d = 0.8
    t = tt(d)
    n = len(t)
    f = 48 + 40 * np.exp(-t / 0.03)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12) * att(t, 0.002)
    clack = modal([(1650 * r.uniform(0.9, 1.1), 1.0, 0.018), (2900, 0.6, 0.012), (4400, 0.3, 0.007)], 0.15, seed=seed + 1, strike=0.5,
                  strike_tau=0.002, strike_hp=2000)
    grit = hp(r.standard_normal(n), 2500) * np.exp(-t / 0.025) * att(t - 0.01, 0.003)
    y = 1.0 * sub + np.pad(clack, (0, max(0, n - len(clack))))[:n] * 0.35 + 0.12 * grit / (rms(grit[:n_(0.05)]) + 1e-9) * 0.4
    y = np.concatenate([y, np.zeros(n_(0.3))])
    echo = np.zeros_like(y)
    k = n_(0.11)
    echo[k:] = lp(y[:-k], 2500) * 0.28
    y = y + echo
    if far:
        y = lp(y, 900)
        out = place(y, -0.3, "hall", -6, dry=0.7)
    else:
        out = place(y, 0, "hall", -14)
    return save(name, out, fade_out=0.15)


def make_boom():
    """Big cinematic low hit for the officer's entrance (sub drop + body noise, long hall tail)."""
    r = rng(701)
    d = 2.4
    t = tt(d)
    n = len(t)
    f = 32 + 55 * np.exp(-t / 0.06)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.6) * att(t, 0.003)
    body = lp(r.standard_normal(n), 380) * att(t, 0.004) * np.exp(-t / 0.15)
    crack = bp(r.standard_normal(n), 800, 5000) * np.exp(-t / 0.01)
    y = sub + 0.6 * body / rms(body[:n_(0.3)]) * 0.3 + 0.1 * crack / rms(crack[:n_(0.02)])
    y *= 1 - att(t - (d - 0.6), 0.6)
    return save("boom", place(y, 0, "hall", -8), fade_out=0.5)


def make_stab(name, root, seed):
    """Short drama sting (one hit): brass chord with scooped attack + timpani + low piano, hall tail."""
    r = rng(seed)
    d = 1.6
    t = tt(d)
    n = len(t)
    brass = np.zeros(n)
    for ratio, a in [(1.0, 1.0), (1.5, 0.8), (2.0, 0.9), (2.378, 0.6), (3.0, 0.4)]:
        for c in (-8, 0, 7):
            fr = root * ratio * 2 ** (c / 1200) * (1 - 0.02 * np.exp(-t / 0.03))
            brass += a * saw(fr, phase0=r.random())
    cutoff = 500 + 3000 * np.exp(-t / 0.15) * att(t, 0.02)
    brass = svf(brass, cutoff, q=0.9, mode="lp") * att(t, 0.02) * np.exp(-t / 0.35)
    f0 = root / 2 * (1 + 0.03 * np.exp(-t / 0.04))
    timp = np.zeros(n)
    for ratio, a, tau in [(1.0, 1.0, 0.6), (1.504, 0.5, 0.4), (2.0, 0.3, 0.35), (2.494, 0.12, 0.2)]:
        timp += a * np.sin(2 * np.pi * np.cumsum(f0 * ratio) / SR) * np.exp(-t / tau)
    timp = timp * att(t, 0.003) + lp(r.standard_normal(n), 500) * np.exp(-t / 0.015) * 0.6
    piano = np.zeros(n)
    for f, a in [(root / 2, 1.0), (root, 0.7)]:
        for k in range(1, 30):
            fk = k * f
            if fk > 4500:
                break
            piano += a * k ** -0.8 * np.sin(2 * np.pi * fk * t) * np.exp(-t / (1.6 / (1 + fk / 500)))
    piano *= att(t, 0.002)
    y = 0.8 * brass / rms(brass[:n_(0.4)]) + 0.55 * timp / rms(timp[:n_(0.4)]) + 0.35 * piano / rms(piano[:n_(0.4)])
    y *= 1 - att(t - (d - 0.5), 0.5)
    return save(name, place(y, 0, "hall", -8), fade_out=0.4)


def make_flap():
    """Notebook flips open: two quick paper flaps + a soft page slap."""
    r = rng(901)
    d = 0.5
    t = tt(d)
    n = len(t)
    y = np.zeros(n)
    for k, (t0, a) in enumerate([(0.0, 0.6), (0.07, 0.8), (0.16, 1.0)]):
        lt = t - t0
        e = att(lt, 0.006) * np.exp(-np.maximum(lt, 0) / 0.035) * (lt >= 0)
        y += a * e * svf(r.standard_normal(n), 1800 + 2500 * np.exp(-np.maximum(lt, 0) / 0.02), q=0.8)
    slap = bp(r.standard_normal(n), 300, 3000) * att(t - 0.16, 0.002) * np.exp(-np.maximum(t - 0.16, 0) / 0.012)
    y += 0.5 * slap
    return save("flap", place(y, 0.15, "small", -14), fade_out=0.06)


def make_room_tone():
    """Public toilet room tone: tiled-room air + soft fluorescent hum/buzz (6.5 s)."""
    r = rng(1001)
    d = 6.5
    t = tt(d)
    n = len(t)
    st = np.zeros((n, 2))
    for c in range(2):
        a = hp(lp(np.cumsum(r.standard_normal(n)), 900), 60)
        st[:, c] = a / rms(a) * 0.04
    hum = sum(a * np.sin(2 * np.pi * f * t + r.random() * 6) for f, a in [(100, 0.5), (200, 0.35), (300, 0.2), (400, 0.12), (1200, 0.03)])
    buzz = hp(saw(np.full(n, 100.0)), 1500) * 0.04 * (0.8 + 0.2 * lpnoise(r, n, 3))
    m = (hum * 0.06 + buzz)
    st += place(m, 0, "small", -6, dry=1.0)[:n]
    return save("room_tone", st, by="lufs", fade_in=0.05, fade_out=0.2)


def make_beep():
    """Red-alert warning beep: square-ish 1.3 kHz tone 0.16 s with a pitch blip, in a tiled room."""
    d = 0.2
    t = tt(d)
    f = np.full(len(t), 1320.0)
    f[t > 0.08] = 990.0
    y = harmonics(f, fmax=8000, tilt=1.6) * att(t, 0.004) * (1 - att(t - (d - 0.02), 0.02))
    y = lp(y, 5000)
    return save("beep", place(y, 0, "small", -8), fade_out=0.04)


def make_siren():
    """Alarm siren wail (2.1 s): rising/falling 'whoop' through a horn-like filter."""
    r = rng(1101)
    d = 2.1
    t = tt(d)
    ph = (t / 0.7) % 1.0
    f = 620 + 640 * np.where(ph < 0.75, np.sin(np.pi / 2 * ph / 0.75), 1 - (ph - 0.75) / 0.25)
    y = harmonics(f, fmax=6000, tilt=1.3)
    y = svf(y, 1800, q=1.2) + 0.3 * lp(y, 1200)
    y *= att(t, 0.06) * (1 - att(t - (d - 0.15), 0.15))
    return save("siren", place(y, 0, "small", -6), fade_in=0.04, fade_out=0.15)


def make_scratch():
    """Record scratch: back-and-forth pitch swipes of a buzzy tone through a sweeping filter + vinyl crackle."""
    r = rng(1201)
    d = 0.55
    t = tt(d)
    n = len(t)
    sp = np.interp(t, [0, 0.08, 0.16, 0.24, 0.36, 0.55], [1.0, 2.2, 0.3, 1.8, 0.4, 0.05])
    f = 160 * sp
    src = harmonics(f, fmax=6000, tilt=1.0) + 0.6 * lp(r.standard_normal(n), 4000)
    y = svf(src, 500 + 2200 * sp, q=2.5)
    y *= att(t, 0.004) * (1 - att(t - 0.42, 0.13))
    cr = np.zeros(n)
    idx = r.choice(n, size=60, replace=False)
    cr[idx] = r.uniform(-1, 1, 60)
    y = y / rms(y) * 0.4 + hp(cr, 2000) * 0.5
    return save("scratch", place(y, 0, "small", -16), fade_out=0.05)


def make_scribble(name, rate, d, seed):
    """Pen scribbling on paper: scratchy band noise shaped by stroke rhythm (rate strokes/s) + line jumps."""
    r = rng(seed)
    t = tt(d)
    n = len(t)
    nz = r.standard_normal(n)
    ph = 2 * np.pi * np.cumsum(rate * (1 + 0.08 * lpnoise(r, n, 4))) / SR
    speed = np.abs(np.sin(ph)) ** 0.7
    fc = 2600 + 2400 * speed
    y = svf(nz, fc, q=1.1) * (0.15 + 0.85 * speed)
    grit = np.zeros(n)
    idx = r.choice(n, size=int(d * 260), replace=False)
    grit[idx] = r.uniform(-1, 1, len(idx))
    y = y + 0.4 * bp(grit, 2500, 8000) * (0.2 + speed)
    lift = (np.sin(2 * np.pi * t * rate / 5.5) > 0.93).astype(float)        # pen lifts between lines
    y *= 1 - 0.85 * lp(lift, 60)
    y *= att(t, 0.03) * (1 - att(t - (d - 0.06), 0.06))
    return save(name, place(y, 0.1, "small", -16), fade_out=0.05)


def make_printer():
    """Receipt printer that never stops and keeps getting faster (7.6 s): start chirp, stepper ticks whose
    rate climbs from 45/s to ~520/s, a rising motor whine and paper-feed hiss."""
    r = rng(1301)
    d = 7.6
    t = tt(d)
    n = len(t)
    rate = 45 * (520 / 45) ** (np.clip(t / 7.4, 0, 1) ** 1.6)
    ph = np.cumsum(rate) / SR
    ticks = np.zeros(n)
    k = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    tk = modal([(2300, 1.0, 0.004), (3900, 0.6, 0.003), (5600, 0.3, 0.002)], 0.03, seed=1302, strike=0.2, strike_tau=0.0006)
    tk = tk[:n_(0.02)]
    for i in k:
        j = min(n, i + len(tk))
        ticks[i:j] += tk[:j - i] * r.uniform(0.7, 1.0)
    whine = harmonics(rate * 2, fmax=6000, tilt=1.4)
    whine = bp(whine, 300, 4000)
    hiss = bp(r.standard_normal(n), 2000, 7000) * (0.6 + 0.4 * lpnoise(r, n, 20))
    inten = 0.55 + 0.45 * np.clip(t / 7.2, 0, 1)
    y = ticks / rms(ticks[n_(0.3):n_(1.5)]) * 0.35 + 0.18 * whine / rms(whine) * np.clip(t / 7, 0.15, 1) + 0.06 * hiss / rms(hiss)
    y *= inten * att(t - 0.12, 0.05)
    chirp = np.sin(2 * np.pi * np.where(t < 0.06, 2200, 2900) * t) * att(t, 0.003) * (t < 0.11) * 0.25
    y += chirp
    y *= 1 - att(t - (d - 0.15), 0.15)
    return save("printer", place(y, 0.1, "small", -16), fade_in=0.003, fade_out=0.15)


def make_car_pass():
    """Car driving past on the street (1.8 s): tyre noise + engine hum with a doppler drop, panning right->left."""
    r = rng(1401)
    d = 1.8
    t = tt(d)
    n = len(t)
    c = 0.75
    x = (t - c) * 14.0
    dist = np.sqrt(x ** 2 + 3.0 ** 2)
    dop = 1 - 0.06 * np.tanh(x / 4)
    eng = harmonics(np.full(n, 62.0) * dop, fmax=1500, tilt=1.2)
    tyre = bp(r.standard_normal(n), 300, 3000)
    y = (0.5 * eng / rms(eng) + tyre / rms(tyre)) * (3.0 / dist) ** 1.4
    pan = np.clip(-x / 12, -0.8, 0.8)
    a = (pan + 1) * np.pi / 4
    st = np.stack([y * np.cos(a), y * np.sin(a)], 1) * np.sqrt(2)
    return save("car_pass", st, fade_in=0.05, fade_out=0.2)


def make_horn():
    """Funny double car honk 'beep-beep' (two-tone horn chord)."""
    d = 0.62
    t = tt(d)
    y = np.zeros(len(t))
    for t0, l in [(0.0, 0.16), (0.24, 0.3)]:
        lt = t - t0
        e = att(lt, 0.01) * (1 - att(lt - (l - 0.03), 0.03)) * (lt >= 0)
        y += e * (harmonics(np.full(len(t), 415.0), fmax=5000, tilt=0.8) + 0.8 * harmonics(np.full(len(t), 523.0), fmax=5000, tilt=0.8))
    y = lp(svf(y, 1400, q=1.5) + 0.3 * lp(y, 900), 3200, 4)     # rounded top end: no harsh fizz (and no AAC overshoot)
    return save("horn", place(y, 0.35, "hall", -16), fade_out=0.08)


def make_jet_idle():
    """Airliner on the apron: turbine whine + low roar (2.0 s)."""
    r = rng(1501)
    d = 2.0
    t = tt(d)
    n = len(t)
    f = 3300 * (1 + 0.004 * lpnoise(r, n, 2))
    whine = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 1.52) / SR)
    roar = lp(r.standard_normal(n), 600) + 0.3 * bp(r.standard_normal(n), 800, 3000)
    y = 0.12 * whine + roar / rms(roar) * 0.5
    st = place(y, 0.3, "hall", -12)
    return save("jet_idle", st, fade_in=0.05, fade_out=0.2)


def make_takeoff():
    """Jet take-off (3.2 s): whine climbs, roar swells and crackles, then passes overhead."""
    r = rng(1601)
    d = 3.2
    t = tt(d)
    n = len(t)
    spool = np.clip(t / 1.6, 0, 1)
    f = 2400 + 2600 * spool ** 1.5
    whine = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
    roar = svf(r.standard_normal(n), 300 + 900 * spool, q=0.7, mode="lp") * (0.8 + 0.4 * lpnoise(r, n, 8))
    crackle = hp(r.standard_normal(n), 1500) * np.maximum(0, lpnoise(r, n, 30)) ** 2
    env = (0.25 + 0.75 * spool) * (1 - 0.5 * att(t - 2.4, 0.8))
    y = (0.08 * whine * (1 - 0.6 * spool) + roar / rms(roar) * 0.6 + 0.15 * crackle / rms(crackle) * spool) * env
    pan = np.clip((t - 1.2) / 2.0, 0, 1) * -1.2 + 0.4
    a = (pan + 1) * np.pi / 4
    st = np.stack([y * np.cos(a), y * np.sin(a)], 1) * np.sqrt(2)
    wet = place(y, 0, "hall", -10, dry=0.0)[:n]
    st = st + wet
    return save("takeoff", st, fade_in=0.08, fade_out=0.4)


def make_city():
    """Singapore street bed (34 s, used in two slices): soft traffic rumble with cars passing, far crowd murmur,
    tropical bird chirps, air."""
    r = rng(1701)
    d = 34.0
    n = n_(d)
    t = tt(d)
    st = np.zeros((n, 2))
    for c in range(2):
        a = hp(lp(np.cumsum(r.standard_normal(n)), 500), 40)
        st[:, c] = a / rms(a) * 0.05
    traffic = np.zeros((n, 2))
    tc = 0.3
    while tc < d:
        x = (t - tc) * r.uniform(9, 15)
        dist = np.sqrt(x ** 2 + r.uniform(6, 14) ** 2)
        m = np.abs(x) < 60
        tyre = np.zeros(n)
        idx = np.nonzero(m)[0]
        if len(idx):
            tyre[idx] = bp(r.standard_normal(len(idx)), 200, 1800) * (6.0 / dist[idx]) ** 1.6
            pan = np.clip(-x[idx] / 30, -0.9, 0.9) * r.choice([-1, 1])
            a = (pan + 1) * np.pi / 4
            traffic[idx, 0] += tyre[idx] * np.cos(a)
            traffic[idx, 1] += tyre[idx] * np.sin(a)
        tc += r.uniform(1.6, 4.0)
    traffic = lp(traffic, 2200)
    mur = None
    for k, (f0, fs, pan) in enumerate([(118, 1.0, -0.6), (210, 1.16, 0.4), (128, 1.02, 0.7), (230, 1.18, -0.3)]):
        v = talker(rng(1710 + k), d, f0, fs)
        v = lp(v, 1400, 2)
        pv = place(v / (rms(v) + 1e-9), pan, "hall", -2, dry=0.35)[:n]
        mur = pv if mur is None else mur + pv
    mur /= rms(mur)
    birds = np.zeros((n, 2))
    tb = 1.2
    k = 0
    while tb < d - 1:
        for j in range(int(r.integers(2, 5))):
            cd = r.uniform(0.05, 0.12)
            ct = tt(cd)
            f = r.uniform(2600, 4200) * (1 + r.uniform(0.15, 0.4) * np.sin(np.pi * ct / cd))
            ch = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * ct / cd) ** 2
            pb = place(ch, r.uniform(-0.9, 0.9), "hall", -8, dry=0.5)
            i = n_(tb + j * r.uniform(0.11, 0.18))
            jj = min(n, i + len(pb))
            birds[i:jj] += pb[:jj - i] * r.uniform(0.3, 1.0)
        tb += r.uniform(2.5, 6.0)
        k += 1
    y = st + 0.5 * traffic / (rms(traffic) + 1e-9) * 0.08 + 0.04 * mur + 0.08 * birds / (np.abs(birds).max() + 1e-9)
    return save("city", y, by="lufs", fade_in=0.3, fade_out=0.3)



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

    # --- beds: street (two slices of one 34 s file, no repeat), toilet room tone in between
    cue(0.0, "city", -15.0, "street bed s01-s17 (cut on the DUN)", offset=0.0, dur=T0("s17") + 0.02, fade_in=0.15, fade_out=0.04)
    cue(T0("s18"), "room_tone", -15.0, "public toilet room tone s18-s20", dur=T1("s20") - T0("s18"), fade_in=0.03, fade_out=0.03)
    cue(T0("s21"), "city", -15.0, "street bed s21-s27", offset=23.4, dur=T1("s27") - T0("s21"), fade_in=0.03, fade_out=0.12)
    # --- story events
    cue(ev("s01", "pop"), "pop", -7.0, "s01 cartoon bloop: the poop appears", duck_db=3.0)
    cue(ev("s03", "ding"), "sparkle", -6.0, "s03 sparkle on the polished pavement")
    cue(ev("s06", "ding"), "sparkle", -5.0, "s06 'it shines' sparkle ring", duck_db=4.0)
    cue(ev("s07", "punch") - 0.12, "swish", -8.0, "s07 everyone's heads turn (punch-in)")
    cue(ev("s08", "splash"), "splash", -5.0, "s08 coffee splashes out of the cup")
    cue(ev("s09", "drop"), "bag_drop", -4.0, "s09 shopping bag hits the ground")
    cue(ev("s09", "roll"), "oranges", -6.0, "s09 oranges bounce + roll (times from the picture physics)")
    cue(ev("s10", "punch") - 0.12, "swish", -9.0, "s10 punch-in on the kid")
    for k, t in enumerate(ev("s11", "step")):
        cue(t, f"step_far_{k + 1}", [-9.0, -6.0][k], f"s11 footsteps off-screen {k + 1}")
    for k, t in enumerate(ev("s12", "step") + [ev("s13", "plant")]):
        cue(t, f"step_{k + 1}", [-3.5, -3.0, -2.5, -2.0, -0.5][k], f"heavy boot plant {k + 1}" + (" (stomp in place)" if k == 4 else ""), duck_db=4.0)
    cue(ev("s13", "boom"), "boom", -5.0, "s13 officer entrance boom")
    cue(ev("s14", "sting"), "stab_1", -4.0, "s14 drama sting: he looks at it", duck_db=4.0)
    cue(ev("s15", "sting"), "stab_2", -3.0, "s15 drama sting: he looks at YOU", duck_db=4.0)
    cue(ev("s16", "flap"), "flap", -6.0, "s16 notebook flips open")
    cue(ev("s17", "dun"), "dun", 0.0, "s17 dramatic DUN on the cut", duck_db=6.0)
    cue(T0("s18") + 0.08, "sparkle", -13.0, "s18 spotless toilet glints")
    for t in ev("s19", "beep"):
        cue(t, "beep", -9.0, "s19 red warning beep")
    cue(T0("s20"), "siren", -9.0, "s20 siren", dur=T1("s20") - T0("s20"), fade_out=0.04)
    cue(ev("s21", "scratch") - 0.02, "scratch", -4.0, "s21 record scratch back to the street", duck_db=3.0)
    a, b = ev("s22", "scribble")
    cue(a, "scribble_slow", -6.0, "s22 pen scribbling", dur=b - a, fade_out=0.04)
    a, b = ev("s23", "scribble")
    cue(a, "scribble_fast", -5.0, "s23 pen scribbling super fast", dur=b - a, fade_out=0.04)
    cue(ev("s24", "print") - 0.1, "printer", -7.0, "s24-s28 receipt printer, faster and faster", dur=T1("s28") - ev("s24", "print") + 0.1, fade_out=0.06)
    cue(ev("s27", "horn") - 0.75, "car_pass", -7.0, "s27 car drives past")
    cue(ev("s27", "horn"), "horn", -7.0, "s27 car horn beep-beep", duck_db=4.0)
    cue(ev("s27", "horn") + 0.45, "car_pass", -10.0, "s27 second car")
    cue(ev("s28", "arrive") - 0.02, "flap", -9.0, "s28 the receipt end slaps into the nose tyre")
    cue(T0("s28"), "jet_idle", -7.0, "s28 airliner whine on the runway", dur=T1("s28") - T0("s28"), fade_in=0.03, fade_out=0.04)
    cue(ev("s29", "takeoff") - 0.05, "takeoff", -4.0, "s29 plane takes off")
    cue(ev("s29", "ding"), "ding", -4.0, "s29 the final ding")
    cues.sort(key=lambda c: c["t"])
    json.dump(cues, open(CUES, "w"), indent=1)
    return cues


def main():
    os.makedirs(SFX_DIR, exist_ok=True)
    for f in os.listdir(SFX_DIR):
        if f.endswith(".wav"):
            os.remove(os.path.join(SFX_DIR, f))
    make_pop()
    make_sparkle()
    make_swish()
    make_splash()
    make_bag_drop()
    make_oranges()
    make_step("step_far_1", 2001, far=True)
    make_step("step_far_2", 2011, far=True)
    for k in range(5):
        make_step(f"step_{k + 1}", 2101 + 10 * k)
    make_boom()
    make_stab("stab_1", 196.0, 2201)          # G3
    make_stab("stab_2", 207.65, 2211)         # Ab3, a half step higher = more tension
    make_flap()
    make_dun()
    make_room_tone()
    make_beep()
    make_siren()
    make_scratch()
    make_scribble("scribble_slow", 5.4, 1.1, 2301)
    make_scribble("scribble_fast", 14.0, 1.15, 2311)
    make_printer()
    make_car_pass()
    make_horn()
    make_jet_idle()
    make_takeoff()
    make_ding()
    make_city()
    cues = build_cues()
    print(f"{'file':14s} {'dur':>6s} {'peak':>7s} {'rms':>7s} {'Mmax':>7s} {'I':>7s}")
    for k, v in INFO.items():
        print(f"{k:14s} {v['dur']:6.2f} {v['peak_db']:7.1f} {v['rms_db']:7.1f} {v['mmax']:7.1f} {v['lufs_i']:7.1f}")
    print(f"wrote {len(INFO)} files to audio/sfx/ and {len(cues)} cues to audio/sfx_cues.json")


if __name__ == "__main__":
    main()
