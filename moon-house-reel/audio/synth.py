#!/usr/bin/env python3
"""Code-synthesised soundtrack (music + sound effects) for the Moon House reel.

Everything here is built from oscillators, noise and filters - no samples.

CLI
    python audio/synth.py --cues audio/cues.json --out build [--seed 7] [--float32]

writes  build/music.wav        stereo music stem (hard stop at cues["music_stop"])
        build/sfx.wav          stereo sound-effects stem
        build/sfx_preview.wav  music @ -20 LUFS + sfx @ -14 LUFS (look-ahead limited
                               to -1 dBFS), for listening only
and prints a numeric sanity report (peak, LUFS, RMS per scene, clicks, ...).

Stems: music.wav is loudness-normalised (default -18 LUFS, --music-lufs);
sfx.wav is the plain sum of the cues (gain_db is absolute, 0 dB = each
sound's design level), only scaled down if it would peak above -1 dBFS.

Library
    Every sound effect is a plain function  f(rng=None, **params) -> np.ndarray
    (mono (n,) or stereo (n, 2), float, 48 kHz), registered in SOUNDS by name.
    Output is loudness-normalised to a per-sound design level, so gain_db=0 in
    the cue file means "sits at its intended balance", and always has short
    raised-cosine fades on both ends.
"""
import argparse
import functools
import json
import os
import time
import wave
import zlib

import numpy as np
from scipy import signal

SR = 48000
TWO_PI = 2.0 * np.pi


# ============================================================== basic helpers

def n_samp(sec):
    return max(0, int(round(sec * SR)))


def tvec(n):
    return np.arange(n) / SR


def db(g):
    return 10.0 ** (g / 20.0)


def smoothstep(u):
    u = np.clip(u, 0.0, 1.0)
    return u * u * (3.0 - 2.0 * u)


def unit(x):
    """Scale to unit RMS (safe on silence)."""
    r = np.sqrt(np.mean(np.square(x)))
    return x / r if r > 1e-12 else x


def pk1(x):
    """Scale to unit peak (for short decaying layers, where RMS scaling over-shoots)."""
    m = np.max(np.abs(x))
    return x / m if m > 1e-12 else x


def midi_hz(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def phase(freq):
    """Running phase (radians) of a time-varying frequency array."""
    return TWO_PI * np.cumsum(freq) / SR


def glide(f0, f1, n, tau):
    """Exponential pitch glide from f0 towards f1 with time constant tau."""
    return f1 + (f0 - f1) * np.exp(-tvec(n) / tau)


def env_pts(n, times, values):
    """Piecewise-linear envelope through (time, value) points."""
    return np.interp(tvec(n), times, values)


def env_exp(n, tau, att=0.001):
    """Soft-attack exponential decay; starts exactly at 0."""
    t = tvec(n)
    return (1.0 - np.exp(-t / att)) * np.exp(-t / tau)


def hold_env(n, att, hold, rel):
    """Smooth attack, hold until `hold` seconds, smooth release over `rel`."""
    t = tvec(n)
    return smoothstep(t / att) * (1.0 - smoothstep((t - hold) / rel))


def fade(x, fin=0.002, fout=0.008):
    """Raised-cosine fade-in/out; first and last samples become exactly 0."""
    x = np.array(x, dtype=np.float64, copy=True)
    n = len(x)
    ni, no = min(n_samp(fin), n // 2), min(n_samp(fout), n // 2)
    shape = (slice(None),) + (None,) * (x.ndim - 1)
    if ni > 0:
        x[:ni] *= (0.5 - 0.5 * np.cos(np.pi * np.arange(ni) / ni))[shape]
    if no > 0:
        x[n - no:] *= (0.5 + 0.5 * np.cos(np.pi * np.arange(1, no + 1) / no))[shape]
    return x


# ------------------------------------------------------------------ filters

def _butter(kind, freq, order):
    nyq = SR / 2.0
    if kind == "bandpass":
        wn = [max(freq[0], 1.0) / nyq, min(freq[1] / nyq, 0.99)]
    else:
        wn = min(freq / nyq, 0.99)
    return signal.butter(order, wn, btype=kind, output="sos")


def lp(x, f, order=2):
    return signal.sosfilt(_butter("lowpass", f, order), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(_butter("highpass", f, order), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_butter("bandpass", (lo, hi), order), x, axis=0)


def _rbj(f0, q):
    w0 = TWO_PI * f0 / SR
    return np.cos(w0), np.sin(w0) / (2.0 * q)


def peq(x, f0, gain_db, q):
    """RBJ peaking EQ."""
    a_ = 10.0 ** (gain_db / 40.0)
    cw, al = _rbj(f0, q)
    b = np.array([1 + al * a_, -2 * cw, 1 - al * a_])
    a = np.array([1 + al / a_, -2 * cw, 1 - al / a_])
    return signal.lfilter(b / a[0], a / a[0], x, axis=0)


def reson(x, f0, q):
    """RBJ band-pass resonator, 0 dB at the peak."""
    cw, al = _rbj(f0, q)
    b = np.array([al, 0.0, -al])
    a = np.array([1 + al, -2 * cw, 1 - al])
    return signal.lfilter(b / a[0], a / a[0], x, axis=0)


def band(f, fc, width_oct):
    """Gaussian band in log-frequency (width = FWHM in octaves)."""
    sigma = width_oct / 2.355
    return np.exp(-0.5 * (np.log2(np.maximum(f, 1.0) / fc) / sigma) ** 2)


def formants(f, peaks, floor=0.03):
    """Sum of Gaussian formant peaks [(freq, bandwidth, amp), ...] in Hz."""
    g = floor
    for fc, bw, a in peaks:
        g = g + a * np.exp(-0.5 * ((f - fc) / bw) ** 2)
    return g


def tv_filter(x, gain_fn, nper=1024):
    """Time-varying spectral filter: STFT, multiply by gain_fn(f[:,None], t[None,:]), ISTFT.

    Hann window at 75 % overlap, so it is smooth and click-free.
    """
    if x.ndim == 2:
        return np.stack([tv_filter(x[:, c], gain_fn, nper) for c in range(x.shape[1])], 1)
    hop = nper // 4
    f, t, z = signal.stft(x, SR, nperseg=nper, noverlap=nper - hop)
    _, y = signal.istft(z * gain_fn(f[:, None], t[None, :]), SR, nperseg=nper, noverlap=nper - hop)
    y = y[:len(x)]
    return np.pad(y, (0, len(x) - len(y))) if len(y) < len(x) else y


# ------------------------------------------------------------------ sources

def white(rng, n):
    return rng.standard_normal(n)


def colored(rng, n, slope_db_oct):
    """Unit-RMS noise with a spectral slope (0 white, -3 pink, -6 brown); no DC."""
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1.0 / SR)
    f[0] = 1.0
    spec *= (f / 1000.0) ** (slope_db_oct / 6.0206)
    spec[0] = 0.0
    return unit(np.fft.irfft(spec, n))


def wobble(rng, n, rate):
    """Smooth random modulation in [-1, 1] with roughly `rate` Hz bandwidth."""
    w = lp(rng.standard_normal(n), rate)
    return w / (np.max(np.abs(w)) + 1e-12)


def grain_train(rng, n, rate, grain_ms=(0.6, 2.5), density=None, amp_sigma=0.7):
    """Granular grit: Poisson-placed tiny windowed noise grains (vectorised).

    rate      grains per second (maximum)
    grain_ms  grain lengths; impulses are split randomly between them
    density   optional per-sample 0..1 envelope that thins the grains
    """
    count = rng.poisson(rate * n / SR)
    pos = rng.integers(0, max(n, 1), count)
    amp = rng.lognormal(0.0, amp_sigma, count) * rng.choice([-1.0, 1.0], count)
    if density is not None:
        keep = rng.random(count) < np.clip(density[pos], 0.0, 1.0)
        pos, amp = pos[keep], amp[keep]
    group = rng.integers(0, len(grain_ms), len(pos))
    out = np.zeros(n)
    for g, ms in enumerate(grain_ms):
        imp = np.zeros(n)
        np.add.at(imp, pos[group == g], amp[group == g])
        kl = max(8, n_samp(ms / 1000.0))
        kern = rng.standard_normal(kl) * np.hanning(kl)
        out += signal.oaconvolve(imp, kern)[:n]
    return out


def pan_mono(x, pan):
    """Equal-power pan (-1 left .. +1 right) of a mono signal to stereo."""
    th = (np.clip(pan, -1.0, 1.0) + 1.0) * np.pi / 4.0
    return np.stack([x * np.cos(th), x * np.sin(th)], 1)


def balance(x, pan):
    """Balance control for a stereo signal."""
    p = float(np.clip(pan, -1.0, 1.0))
    return x * np.array([min(1.0, 1.0 - p), min(1.0, 1.0 + p)])


def to_stereo(x, pan=0.0):
    return pan_mono(x, pan) if x.ndim == 1 else balance(x, pan)


def mix_into(buf, x, t0, gain=1.0, pan=0.0):
    """Add mono/stereo x into the stereo buffer at t0 seconds (truncated to fit)."""
    x = to_stereo(x, pan)
    i = int(round(t0 * SR))
    a, b = max(i, 0), min(i + len(x), len(buf))
    if b > a:
        buf[a:b] += gain * x[a - i:b - i]


def tiny_room(rng, x, length=0.18, mix=0.15):
    """Very short exponential-noise room for a touch of space on small sounds."""
    n = n_samp(length)
    ir = rng.standard_normal(n) * np.exp(-tvec(n) / (length / 5.0))
    ir = lp(ir, 6000) / np.sqrt(np.sum(ir ** 2))
    wet = signal.oaconvolve(x, ir)[:len(x)]
    return x + mix * wet


def click(rng, n, at, f_res, decay, lo=1500.0, hi=6500.0):
    """Small mechanical click: band-passed noise burst + short resonant ring."""
    y = np.zeros(n)
    i = n_samp(at)
    m = n - i
    if m <= 0:
        return y
    tt = tvec(m)
    att = 1.0 - np.exp(-tt / 0.0003)
    burst = bp(white(rng, m), lo, hi) * np.exp(-tt / 0.0018)
    ring = np.sin(TWO_PI * f_res * tt) * np.exp(-tt / decay)
    y[i:] = att * (0.3 * pk1(burst) + 0.7 * ring)
    return y


# ------------------------------------------------------------------ loudness

_METER = None


def loudness(x):
    """Integrated loudness (LUFS, BS.1770) of a mono/stereo array (padded to >=0.5 s)."""
    global _METER
    import pyloudnorm
    if _METER is None:
        _METER = pyloudnorm.Meter(SR)
    if len(x) < n_samp(0.5):
        pad = [(0, n_samp(0.5) - len(x))] + [(0, 0)] * (x.ndim - 1)
        x = np.pad(x, pad)
    with np.errstate(divide="ignore"):
        return float(_METER.integrated_loudness(x))


def set_loudness(x, target_lufs, peak_cap=0.89):
    L = loudness(x)
    if np.isfinite(L):
        x = x * db(target_lufs - L)
    pk = np.max(np.abs(x))
    return x * (peak_cap / pk) if pk > peak_cap else x


# ============================================================== sound effects

SOUNDS = {}


def sound(name, lufs, fin=0.002, fout=0.008):
    """Register a sound function; normalise its loudness and fade its edges."""
    def deco(fn):
        @functools.wraps(fn)
        def wrapper(rng=None, **params):
            if rng is None:
                rng = np.random.default_rng(0)
            x = np.asarray(fn(rng, **params), dtype=np.float64)
            x = x - np.mean(x, axis=0)            # no DC
            x = set_loudness(x, lufs)
            return fade(x, fin, fout)
        wrapper.lufs = lufs
        SOUNDS[name] = wrapper
        return wrapper
    return deco


@sound("breath_helmet", lufs=-24, fin=0.4, fout=0.5)
def breath_helmet(rng, dur=10.0, period=3.6):
    """Muffled in-helmet breathing loop (slow inhale / exhale), as a bed."""
    n = n_samp(dur)
    e_in, e_out = np.zeros(n), np.zeros(n)
    t0 = 0.05
    while t0 < dur:
        p = period * rng.uniform(0.92, 1.08)
        ti, te = 0.32 * p * rng.uniform(0.9, 1.1), 0.42 * p * rng.uniform(0.9, 1.1)
        g = db(rng.uniform(-2.0, 1.5))
        for start, length, skew, buf in ((t0, ti, 1.6, e_in), (t0 + ti + 0.15, te, 0.6, e_out)):
            m = n_samp(length)
            u = np.linspace(0.0, 1.0, m)
            shape = np.sin(np.pi * u ** skew) ** 1.5 * g   # inhale peaks late, exhale early
            i = n_samp(start)
            k = min(m, n - i)
            if k > 0:
                buf[i:i + k] += shape[:k]
        t0 += p
    inhale = bp(colored(rng, n, -2), 700, 2600) + 0.6 * reson(colored(rng, n, -2), 1500, 2.0)
    exhale = bp(colored(rng, n, -3), 250, 1500) + 0.6 * reson(colored(rng, n, -3), 650, 2.5)
    x = 0.7 * unit(inhale) * e_in + unit(exhale) * e_out
    # the helmet: muffled, two cavity resonances, tiny close reflections
    x = lp(x, 1900)
    x = peq(peq(x, 380, 6.0, 2.5), 1150, 4.0, 4.0)
    for d, g in ((0.0023, 0.32), (0.0041, 0.2)):
        k = n_samp(d)
        x[k:] += g * x[:-k]
    return tiny_room(rng, x, 0.12, 0.25)


@sound("shovel_scrape", lufs=-21, fin=0.004, fout=0.03)
def shovel_scrape(rng, dur=0.38, bright=1.0):
    """Soft shovel scrape into dust: gritty band-passed grains + dull push."""
    n = n_samp(dur)
    env = env_pts(n, [0, 0.03, 0.55 * dur, dur], [0, 1, 0.85, 0]) ** 1.2
    grit = bp(grain_train(rng, n, 900, (0.6, 2.5), amp_sigma=0.4), 900 * bright, 4200 * bright)
    rasp = bp(white(rng, n), 600, 2200) * (0.6 + 0.4 * wobble(rng, n, 40))
    body = bp(colored(rng, n, -6), 120, 400)
    x = env * (unit(grit) + 0.45 * unit(rasp) + 0.25 * unit(body))
    x = x + 0.25 * reson(x, 1350, 12)                # faint blade ring
    return lp(x, 6000)


@sound("dust_toss", lufs=-25, fin=0.01, fout=0.05)
def dust_toss(rng, dur=0.5):
    """Short soft whoosh of thrown dust plus a scatter of falling grains."""
    n = n_samp(dur)
    sweep = tv_filter(colored(rng, n, -3), lambda f, t: band(f, 1700 * 0.45 ** np.clip(t / dur, 0, 1), 1.6))
    env = env_pts(n, [0, 0.07, 0.45 * dur, dur], [0, 1, 0.35, 0])
    dens = env_pts(n, [0, 0.08, dur], [0, 1, 0])
    scatter = bp(grain_train(rng, n, 500, (0.5, 1.5), density=dens, amp_sigma=0.4), 1800, 6000)
    return unit(sweep) * env + 0.8 * pk1(scatter * dens)


@sound("machine_hum", lufs=-22, fin=0.25, fout=0.35)
def machine_hum(rng, dur=4.0, base=105.0, whine=1.0):
    """Small slow digging machine: warm motor hum with LFO + servo whines, as a bed."""
    n = n_samp(dur)
    t = tvec(n)
    f = base * (1 + 0.006 * np.sin(TWO_PI * 0.27 * t + rng.uniform(0, 6)) + 0.003 * np.sin(TWO_PI * 1.13 * t))
    ph = phase(f)
    hum = sum((1.0 if k % 2 else 0.6) / k * np.sin(k * ph + rng.uniform(0, TWO_PI)) for k in range(1, 11))
    hum = lp(hum, 850) * (1 + 0.16 * np.sin(TWO_PI * 2.3 * t))      # gentle chug
    x = unit(hum) + 0.25 * unit(lp(colored(rng, n, -6), 160))
    # servo whine when the arm moves
    w = np.zeros(n)
    tw = rng.uniform(0.3, 0.9)
    while tw < dur - 0.6:
        length = rng.uniform(0.4, 0.7)
        m = n_samp(length)
        tt = tvec(m)
        fw = rng.uniform(480, 560) * (1 + 0.35 * smoothstep(tt / length * 1.4))
        pw = phase(fw)
        y = (np.sin(pw) + 0.3 * np.sin(2 * pw)) * np.sin(np.pi * tt / length) ** 2
        i = n_samp(tw)
        w[i:i + m] += y[:n - i]
        tw += length + rng.uniform(0.9, 1.8)
    return x + 0.22 * whine * w


@sound("servo", lufs=-23, fin=0.006, fout=0.04)
def servo(rng, dur=0.45, pitch=1.0, up=True):
    """Short servo whirr for the machine arm (pitch rises if up, falls otherwise)."""
    n = n_samp(dur)
    u = tvec(n) / dur
    shape = smoothstep(u / 0.35) - 0.25 * smoothstep((u - 0.75) / 0.25)
    f = 360 * pitch * ((1 + 0.5 * shape) if up else (1.5 - 0.5 * shape))
    ph = phase(f)
    tone = bp(sum(np.sin(k * ph) / k for k in range(1, 7)), 250, 3000)
    teeth = (0.5 + 0.5 * np.sin(ph / 6.0)) ** 4                      # gear-tooth chatter
    gear = bp(white(rng, n), 1200, 4000) * teeth
    env = env_pts(n, [0, 0.03, dur - 0.06, dur], [0, 1, 1, 0])
    return lp(env * (unit(tone) + 0.3 * unit(gear)), 5000)


@sound("pop", lufs=-21, fin=0.0008, fout=0.01)
def pop(rng, pitch=1.0, dur=0.16):
    """Cute 'bloop': sine with a fast upward glide and quick decay."""
    n = n_samp(dur)
    t = tvec(n)
    ph = phase((280 + 520 * (1 - np.exp(-t / 0.016))) * pitch)
    body = np.sin(ph) + 0.22 * np.sin(2 * ph) * np.exp(-t / 0.02)
    lip = lp(white(rng, n) * np.exp(-t / 0.0015), 2500)
    return body * env_exp(n, 0.042, 0.0015) + 0.12 * lip


@sound("snap", lufs=-27, fin=0.0005, fout=0.01)
def snap(rng, pitch=1.0):
    """Crisp small mechanical click-snap (two-stage latch)."""
    n = n_samp(0.1)
    t = tvec(n)
    body = 0.35 * np.sin(TWO_PI * 380 * pitch * t) * env_exp(n, 0.018, 0.0007)
    x = click(rng, n, 0.0, 2300 * pitch, 0.010) + 0.55 * click(rng, n, 0.013, 1700 * pitch, 0.008) + body
    return lp(x, 7000)


@sound("seal_click", lufs=-28.5, fin=0.0005, fout=0.03)
def seal_click(rng, pitch=1.0):
    """Glove/boot seal: low double click + tiny pressurising hiss."""
    n = n_samp(0.34)
    t = tvec(n)
    x = click(rng, n, 0.0, 1250 * pitch, 0.009, 1000, 5000) + 0.6 * click(rng, n, 0.022, 1900 * pitch, 0.006, 1000, 5000)
    x += 0.4 * np.sin(TWO_PI * 260 * pitch * t) * env_exp(n, 0.015, 0.0008)
    hiss_env = env_pts(n, [0, 0.03, 0.05, 0.34], [0, 0, 1, 0]) ** 2
    hiss = lp(hp(white(rng, n), 3500), 10000)
    return x + 0.08 * unit(hiss) * hiss_env


@sound("brush", lufs=-24, fin=0.01, fout=0.04)
def brush(rng, dur=0.32, direction=1):
    """Bristly dust-brush swish (direction flips the sweep)."""
    n = n_samp(dur)
    up = direction >= 0

    def mask(f, t):
        u = np.clip(t / dur, 0, 1)
        return band(f, 2600 * 1.7 ** (u if up else 1 - u), 1.8)
    swish = tv_filter(white(rng, n), mask)
    bristles = hp(grain_train(rng, n, 1800, (0.3, 0.9)), 2500)
    env = np.sin(np.pi * tvec(n) / dur) ** 0.8
    return lp(env * (unit(swish) + 0.5 * unit(bristles)), 9000)


@sound("airlock_hiss", lufs=-21, fin=0.008, fout=0.08)
def airlock_hiss(rng, dur=1.5):
    """Pressurising airlock hiss: band-passed noise, burst then decaying tail."""
    n = n_samp(dur)
    t = tvec(n)
    hiss = tv_filter(white(rng, n), lambda f, tt: band(f, 3600 * 0.62 ** np.clip(tt / dur, 0, 1), 1.4)
                     + 0.25 * band(f, 7000, 1.0))
    env = (1 - np.exp(-t / 0.02)) * (0.35 + 0.65 * np.exp(-t / 0.25)) * (1 - smoothstep((t - (dur - 0.5)) / 0.5))
    rumble = bp(colored(rng, n, -6), 80, 300) * np.exp(-t / 0.3)
    x = unit(hiss) * env * (1 + 0.08 * np.sin(TWO_PI * 23 * t)) + 0.15 * unit(rumble)
    return lp(x, 9000)


@sound("door_clunk", lufs=-19.5, fin=0.001, fout=0.06)
def door_clunk(rng, weight=1.0):
    """Soft heavy door close: low thump, knock, dull metal modes, latch click."""
    n = n_samp(0.7)
    t = tvec(n)
    thump = np.tanh(2.0 * np.sin(phase(glide(115 / weight, 65 / weight, n, 0.05)))) / np.tanh(2.0)
    thump *= env_exp(n, 0.13, 0.002)
    knock = pk1(bp(white(rng, n), 150, 900) * env_exp(n, 0.03, 0.0008))
    modes = sum(a * np.sin(TWO_PI * fm * t + rng.uniform(0, 6)) * np.exp(-t / d)
                for fm, a, d in ((233, 1, 0.25), (391, 0.7, 0.18), (612, 0.5, 0.12), (958, 0.3, 0.08)))
    modes *= 1 - np.exp(-t / 0.001)
    x = thump + 0.4 * knock + 0.12 * modes + 0.12 * click(rng, n, 0.045, 2200, 0.006)
    return lp(x, 3200)


@sound("air_fill", lufs=-22, fin=0.05, fout=0.25)
def air_fill(rng, dur=2.4):
    """Air filling the room: soft rising airy whoosh (stereo)."""
    n = n_samp(dur)
    u = tvec(n) / dur
    env = np.where(u < 0.65, smoothstep(u / 0.65), smoothstep((1 - u) / 0.35))

    def mask(f, t):
        uu = np.clip(t / dur, 0, 1)
        return band(f, 350 * 9 ** uu, 1.5) + 0.15 * band(f, 6000, 1.5)
    return np.stack([tv_filter(colored(rng, n, -3), mask) * env for _ in range(2)], 1)


@sound("happy_breath", lufs=-17, fin=0.02, fout=0.1)
def happy_breath(rng, pitch=1.0, dur_in=0.6, dur_out=1.25):
    """Big happy relieved breath: breathy inhale, then a cute satisfied 'ahh'."""
    gap = 0.1
    n = n_samp(dur_in + gap + dur_out + 0.05)
    x = np.zeros(n)
    # inhale: breathy hiss through a bright 'smile' formant set, peaks late
    ni = n_samp(dur_in)
    u = np.linspace(0, 1, ni)
    inh = tv_filter(colored(rng, ni, -1), lambda f, t: formants(f, ((500, 180, 0.6), (1800, 250, 1.0), (2700, 300, 0.7)), 0.1))
    x[:ni] += 0.55 * unit(inh) * np.sin(np.pi * u ** 1.6) ** 1.3
    # exhale 'ahh': breath noise + a little falling voiced tone, 'ah' formants
    ne = n_samp(dur_out)
    te = tvec(ne)
    ue = te / dur_out
    f0 = pitch * (255 - 70 * ue) * (1 + 0.012 * np.sin(TWO_PI * 5.5 * te))
    ph = phase(f0)
    voiced = sum(np.sin(k * ph) / k ** 1.2 * (k * f0 < 5000) for k in range(1, 25))
    v_env = smoothstep((te - 0.05) / 0.12) * (1 - smoothstep((ue - 0.35) / 0.4))
    src = unit(colored(rng, ne, -2)) + 0.35 * unit(voiced) * v_env
    ahh = tv_filter(src, lambda f, t: formants(f, ((780, 110, 1.0), (1230, 130, 0.7), (2600, 220, 0.35), (3400, 300, 0.2)), 0.05))
    e_env = (1 - np.exp(-te / 0.06)) * (1 - ue) ** 1.4
    i = n_samp(dur_in + gap)
    x[i:i + ne] += unit(ahh) * e_env
    return lp(x, 7000)


@sound("rock_whoosh", lufs=-25, fin=0.02, fout=0.03)
def rock_whoosh(rng, dur=0.7, direction=1):
    """Faint stylised streak before a rock impact: crescendo + pan sweep (stereo)."""
    n = n_samp(dur)
    u = tvec(n) / dur
    mono = tv_filter(colored(rng, n, -3), lambda f, t: band(f, 600 * 3.5 ** (np.clip(t / dur, 0, 1) ** 1.5), 1.2))
    env = u ** 2.5 * (1 - smoothstep((u - 0.94) / 0.06))
    p = direction * (-0.7 + 0.8 * u)
    th = (p + 1) * np.pi / 4
    return np.stack([mono * env * np.cos(th), mono * env * np.sin(th)], 1)


@sound("rock_thud", lufs=-18, fin=0.0008, fout=0.08)
def rock_thud(rng, size=1.0):
    """Small space rock hitting the ground: thump + crunchy transient + spark ticks."""
    n = n_samp(0.9)
    t = tvec(n)
    thump = np.tanh(2.2 * np.sin(phase(glide(140 / size, 55 / size, n, 0.045)))) / np.tanh(2.2)
    thump *= env_exp(n, 0.17, 0.0015)
    crunch = bp(grain_train(rng, n, 4000, (0.4, 1.8), density=np.exp(-t / 0.035)), 400, 3800)
    knock = bp(white(rng, n), 180, 1400) * env_exp(n, 0.018, 0.0005)
    dens = np.where(t < 0.04, 0.0, np.exp(-(t - 0.04) / 0.18))
    debris = bp(grain_train(rng, n, 350, (0.4, 1.2), density=dens), 1500, 5500)
    sparks = np.zeros(n)
    for _ in range(rng.integers(3, 6)):
        m = n_samp(0.05)
        tt = tvec(m)
        y = np.sin(TWO_PI * rng.uniform(3800, 6800) * tt) * (1 - np.exp(-tt / 0.0003)) * np.exp(-tt / rng.uniform(0.006, 0.014))
        i = n_samp(rng.uniform(0.015, 0.2))
        sparks[i:i + m] += rng.uniform(0.5, 1.0) * y
    x = thump + 0.5 * pk1(crunch) + 0.3 * pk1(knock) + 0.12 * pk1(debris * dens) + 0.12 * sparks
    return lp(x, 9000)


@sound("sparkle", lufs=-24, fin=0.002, fout=0.05)
def sparkle(rng, count=5, dur=0.7, base=1.0):
    """Little sparkly glints from a D-major pentatonic set (stereo scatter)."""
    n = n_samp(dur)
    out = np.zeros((n, 2))
    scale = (2349.3, 2637.0, 2960.0, 3520.0, 3951.1, 4698.6)
    for i in range(int(count)):
        f = rng.choice(scale) * base
        m = n_samp(0.25)
        tt = tvec(m)
        y = np.sin(TWO_PI * f * tt) + 0.2 * np.sin(TWO_PI * 2.76 * f * tt) * np.exp(-tt / 0.01)
        y *= (1 - np.exp(-tt / 0.0015)) * np.exp(-tt / rng.uniform(0.05, 0.11)) * rng.uniform(0.6, 1.0)
        mix_into(out, y, i / max(count, 1) * 0.55 * dur + rng.uniform(0, 0.05), pan=rng.uniform(-0.6, 0.6))
    return out


@sound("dust_pour", lufs=-24, fin=0.06, fout=0.12)
def dust_pour(rng, dur=1.0):
    """Granular sand/dust pouring stream, as a bed."""
    n = n_samp(dur)
    flow = 0.75 + 0.25 * wobble(rng, n, 6)
    fine = bp(grain_train(rng, n, 3000, (0.25, 0.8), density=flow), 1500, 7000)
    coarse = bp(grain_train(rng, n, 700, (0.8, 2.5), density=flow), 400, 1800)
    hiss = bp(colored(rng, n, -3), 800, 4000) * flow
    return lp(unit(fine) + 0.6 * unit(coarse) + 0.3 * unit(hiss), 8000)


@sound("land_thud", lufs=-17, fin=0.002, fout=0.1)
def land_thud(rng, size=1.0):
    """Soft low-gravity landing: slow low thump, soft knock, dust puff."""
    n = n_samp(1.0)
    t = tvec(n)
    thump = np.tanh(2.5 * np.sin(phase(glide(140 / size, 75 / size, n, 0.06)))) / np.tanh(2.5)
    thump *= env_exp(n, 0.22, 0.006)
    knock = pk1(reson(white(rng, n), 200, 2.0) * env_exp(n, 0.08, 0.004))
    puff = tv_filter(colored(rng, n, -3), lambda f, tt: band(f, 900 * 0.6 ** np.clip(tt / 0.6, 0, 1), 1.8))
    puff = pk1(puff * env_exp(n, 0.25, 0.03))
    crunch = pk1(bp(grain_train(rng, n, 1500, (0.5, 1.5), density=np.exp(-t / 0.05)), 600, 3500) * np.exp(-t / 0.05))
    return thump + 0.4 * knock + 0.25 * puff + 0.15 * crunch


@sound("flag_plant", lufs=-19, fin=0.002, fout=0.08)
def flag_plant(rng):
    """Flag pole pushed into the ground: soft crunch + thunk + faint pole wobble."""
    n = n_samp(0.75)
    dens = env_pts(n, [0, 0.01, 0.09, 0.16], [0, 1, 0.6, 0])
    x = 0.45 * pk1(bp(grain_train(rng, n, 2500, (0.5, 2.0), density=dens), 500, 4000) * dens)
    i0 = n_samp(0.05)
    m = n - i0
    tt = tvec(m)
    thunk = np.tanh(1.5 * np.sin(phase(glide(170, 100, m, 0.03)))) / np.tanh(1.5) * env_exp(m, 0.07, 0.002)
    knock = pk1(bp(white(rng, m), 200, 900) * env_exp(m, 0.02, 0.0008))
    ring = (np.sin(TWO_PI * 640 * tt + 0.4 * np.sin(TWO_PI * 7 * tt)) + 0.5 * np.sin(TWO_PI * 1510 * tt))
    ring *= np.exp(-tt / 0.3) * (1 - np.exp(-tt / 0.002))
    x[i0:] += thunk + 0.3 * knock + 0.07 * ring
    return x


@sound("phone_popup", lufs=-20, fin=0.002, fout=0.05)
def phone_popup(rng, pitch=1.0):
    """Soft two-tone phone notification blip (B5 -> E6)."""
    n = n_samp(0.5)
    x = np.zeros(n)
    for at, f, length in ((0.0, 987.8, 0.09), (0.1, 1318.5, 0.16)):
        m = n_samp(length + 0.15)
        tt = tvec(m)
        f *= pitch
        y = np.sin(TWO_PI * f * tt) + 0.12 * np.sin(TWO_PI * 2 * f * tt) + 0.05 * np.sin(TWO_PI * 3 * f * tt)
        i = n_samp(at)
        x[i:i + m] += (y * env_exp(m, length * 0.6, 0.004))[:n - i]
    return tiny_room(rng, x, 0.18, 0.15)


@sound("whoosh_soft", lufs=-24, fin=0.02, fout=0.06)
def whoosh_soft(rng, dur=0.55, direction=1):
    """Gentle whoosh for camera moves / magnifier pop (stereo, pan sweep)."""
    n = n_samp(dur)
    u = tvec(n) / dur
    mono = tv_filter(colored(rng, n, -3), lambda f, t: band(f, 350 * 4 ** np.sin(np.pi * np.clip(t / dur, 0, 1)), 1.3))
    env = np.sin(np.pi * u ** 0.8) ** 1.5
    th = (direction * (-0.5 + u) + 1) * np.pi / 4
    return np.stack([mono * env * np.cos(th), mono * env * np.sin(th)], 1)


@sound("temp_tick", lufs=-23, fin=0.003, fout=0.05)
def temp_tick(rng, mode="hot"):
    """Temperature toggle: 'hot' = warm wavy buzz, 'cold' = icy shimmering chime."""
    if mode == "hot":
        n = n_samp(0.42)
        t = tvec(n)
        ph = phase(150 * (1 + 0.01 * np.sin(TWO_PI * 6 * t)))
        buzz = lp(sum(np.sin(k * ph) / k for k in range(1, 15)), 1300)
        trem = 1 - 0.35 * (0.5 + 0.5 * np.sin(TWO_PI * 11 * t))      # heat shimmer
        crackle = bp(grain_train(rng, n, 70, (0.5, 1.5)), 800, 3000)
        env = env_pts(n, [0, 0.03, 0.25, 0.42], [0, 1, 0.7, 0])
        return env * (unit(buzz) * trem + 0.25 * unit(crackle))
    n = n_samp(0.6)
    t = tvec(n)
    chime = sum(a * np.sin(TWO_PI * f * t) * np.exp(-t / d)                # 1175/1181 Hz beat = icy shimmer
                for f, a, d in ((1174.7, 1.0, 0.25), (1180.5, 0.6, 0.25), (1760.0, 0.45, 0.15), (3242.0, 0.15, 0.04)))
    chime *= 1 - np.exp(-t / 0.0015)
    glints = hp(grain_train(rng, n, 120, (0.2, 0.5), density=np.exp(-t / 0.15)), 6000)
    return chime + 0.08 * pk1(glints * np.exp(-t / 0.15))


@sound("thumbs", lufs=-21, fin=0.001, fout=0.08)
def thumbs(rng, pitch=1.0):
    """Tiny cheerful 'ding' (G6 bell)."""
    n = n_samp(0.8)
    t = tvec(n)
    f = 1568.0 * pitch
    x = sum(a * np.sin(TWO_PI * r * f * t) * np.exp(-t / d)
            for r, a, d in ((1.0, 1.0, 0.32), (2.0, 0.25, 0.12), (2.76, 0.12, 0.05), (5.4, 0.05, 0.02)))
    return tiny_room(rng, x * (1 - np.exp(-t / 0.0012)), 0.2, 0.2)


# ============================================================== music

BPM = 90.0
# (bass, pad voicing, arpeggio tones) in MIDI notes; 2 bars per chord.
PROGRESSION = (
    (38, (50, 57, 64, 66, 73), (74, 78, 81, 85, 88)),   # Dmaj9
    (38, (50, 56, 59, 64, 68), (76, 80, 83, 86, 88)),   # E/D  (lydian #4 colour)
    (35, (47, 54, 57, 62, 73), (71, 74, 78, 81, 85)),   # Bm9
    (31, (43, 50, 54, 59, 61), (71, 73, 74, 78, 83)),   # Gmaj7(#11)
)
ARP_PATTERNS = ((0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 3, 1, 2, 4, 3, 1),
                (4, 3, 1, 2, 0, 2, 3, 4, 3, 1, 2, 0, 1, 3, 4, 2))

# Per-scene arrangement (scene 1..7); values are smoothed across boundaries.
SCENE_MIX = {
    "pad":     (0.75, 0.80, 0.85, 0.85, 0.95, 0.90, 1.00),
    "bright":  (0.15, 0.25, 0.32, 0.32, 0.45, 0.40, 0.55),
    "sub":     (0.55, 0.70, 0.80, 0.80, 0.90, 0.90, 1.00),
    "bells":   (0.00, 0.80, 0.90, 0.85, 0.95, 0.90, 0.95),
    "pluck":   (0.00, 0.00, 0.70, 0.80, 0.75, 0.85, 0.90),
    "warm":    (0.00, 0.00, 0.00, 0.30, 0.50, 0.40, 1.00),
    "twinkle": (0.50, 0.50, 0.60, 0.60, 0.90, 0.70, 0.90),
    "verb":    (1.10, 1.00, 0.90, 0.90, 1.00, 0.95, 1.10),
}
ARP_STEP = (0, 2, 1, 1, 1, 1, 1)                  # eighths between notes (0 = off)
ARP_REST = (0.0, 0.0, 0.3, 0.3, 0.12, 0.25, 0.1)  # chance to skip an off-beat note


def _table(kind, size=4096):
    """Single-cycle band-limited wavetable (with guard point)."""
    ph = TWO_PI * np.arange(size) / size
    if kind == "saw":       # soft saw, 30 harmonics (alias-free up to ~800 Hz)
        y = sum(np.sin(k * ph) / k ** 1.1 for k in range(1, 31))
    else:                   # triangle-ish
        y = sum((-1) ** ((k - 1) // 2) * np.sin(k * ph) / k ** 2 for k in range(1, 16, 2))
    y /= np.max(np.abs(y))
    return np.append(y, y[0])


SAW, TRI = _table("saw"), _table("tri")


def osc(table, freq, n, phase0=0.0):
    """Wavetable oscillator; freq may be a scalar or per-sample array."""
    if np.isscalar(freq):
        ph = phase0 + np.arange(n) * (freq / SR)
    else:
        ph = phase0 + np.cumsum(freq) / SR
    ph = (ph % 1.0) * (len(table) - 1)
    i = ph.astype(np.int64)
    fr = ph - i
    return table[i] * (1.0 - fr) + table[i + 1] * fr


def scene_index(t, scenes):
    for k in range(len(scenes) - 1, -1, -1):
        if t >= scenes[k][0]:
            return k
    return 0


def scene_curve(values, scenes, n, ramp=1.2):
    """Per-sample automation: one value per scene, smoothed over `ramp` seconds."""
    rate = 200
    tc = np.arange(int(n / SR * rate) + 2) / rate
    idx = np.array([min(scene_index(x, scenes), len(values) - 1) for x in tc])
    step = np.asarray(values, dtype=float)[idx]
    w = max(1, int(ramp * rate))
    sm = np.convolve(np.pad(step, (w, w), mode="edge"), np.ones(w) / w, mode="same")[w:-w]
    return np.interp(tvec(n), tc, sm)


def lift_curve(cues, n):
    """Scene-5 lift: rises into John's happy breath, holds to the end of scene 5."""
    sc = cues["scenes"]
    if len(sc) < 5:
        return None, np.zeros(n)
    a, b = sc[4]
    hb = [e["t"] for e in cues.get("events", []) if e["type"] == "happy_breath" and a <= e["t"] < b]
    t_lift = hb[0] if hb else a + 2.0
    t = tvec(n)
    return t_lift, smoothstep((t - t_lift + 1.5) / 1.5) * (1 - smoothstep((t - b) / 1.5))


def bell_tone(f, n):
    """Soft FM celesta/bell: harmonic FM with decaying index + a bar-mode partial."""
    t = tvec(n)
    idx = 1.3 * np.exp(-t / 0.12) + 0.15
    y = np.sin(TWO_PI * f * t + idx * np.sin(TWO_PI * f * t))
    y += 0.16 * np.sin(TWO_PI * 2.756 * f * t) * np.exp(-t / 0.05)
    return y * (1 - np.exp(-t / 0.002)) * np.exp(-t / 0.65)


def marimba_tone(f, n):
    """Soft wooden pluck for the playful bass pulse."""
    t = tvec(n)
    y = np.sin(TWO_PI * f * t) * np.exp(-t / 0.30) + 0.22 * np.sin(TWO_PI * 3.93 * f * t) * np.exp(-t / 0.05)
    return y * (1 - np.exp(-t / 0.002))


def make_ir(rng, rt60=3.4, length=4.2, predelay=0.025):
    """Stereo reverb impulse: decorrelated noise, frequency-dependent exponential decay."""
    n = n_samp(length)
    t = tvec(n)
    ir = np.zeros((n, 2))
    for c in range(2):
        w = rng.standard_normal(n)
        for part, rt in ((lp(w, 700), rt60), (bp(w, 700, 3500), rt60 * 0.8), (hp(w, 3500), rt60 * 0.45)):
            ir[:, c] += part * np.exp(-6.908 * t / rt)
    ir *= (1 - np.exp(-t / 0.04))[:, None]           # diffuse build-up
    ir = lp(ir, 7000)
    ir = np.vstack([np.zeros((n_samp(predelay), 2)), ir])
    return ir / np.sqrt(np.mean(np.sum(ir ** 2, axis=0)))


def render_music(cues, seed=7, target_lufs=-18.0):
    """Render the music stem (stereo), hard-stopped at cues['music_stop']."""
    dur, stop, scenes = float(cues["duration"]), float(cues["music_stop"]), cues["scenes"]
    n = n_samp(dur)
    t = tvec(n)
    rng = np.random.default_rng([seed, 101])
    beat = 60.0 / BPM
    eighth, seg_len = beat / 2, 8 * beat            # one chord = 2 bars
    end = min(dur, stop + 0.5)                       # nothing after the stop is audible
    nseg = int(np.ceil(end / seg_len))
    auto = {k: scene_curve(v, scenes, n) for k, v in SCENE_MIX.items()}
    t_lift, lift = lift_curve(cues, n)

    pad, warm, dry, send = (np.zeros((n, 2)) for _ in range(4))
    sub = np.zeros(n)

    # --- pads, sub and warm low pad: one chord per 2 bars, overlapping crossfades
    for s in range(nseg):
        bass, voicing, _ = PROGRESSION[s % len(PROGRESSION)]
        t0, att, rel = s * seg_len, (2.0 if s == 0 else 1.3), 1.9
        m = n_samp(seg_len + rel)
        tm = tvec(m)
        env = hold_env(m, att, seg_len, rel)
        for note in voicing:
            for cents, p in ((-8.0, -0.6), (0.3, 0.0), (8.5, 0.6)):   # detuned stereo voices
                f = midi_hz(note) * 2 ** ((cents + rng.normal(0, 1.5)) / 1200)
                f = f * (1 + 0.0012 * np.sin(TWO_PI * rng.uniform(0.08, 0.25) * tm + rng.uniform(0, TWO_PI)))
                mix_into(pad, osc(SAW, f, m, rng.random()) * env * 0.055, t0, pan=p)
        sub_env = hold_env(m, 1.0, seg_len, 1.5)
        sph = TWO_PI * midi_hz(bass) * tm + rng.uniform(0, TWO_PI)
        sub_note = sub_env * (np.sin(sph) + 0.3 * np.sin(2 * sph))      # 2nd harmonic: audible on phones
        i = n_samp(t0)
        k = min(m, n - i)
        sub[i:i + k] += sub_note[:k]
        for note in (bass + 12, bass + 19, bass + 24):
            for cents, p in ((-5.0, -0.4), (5.0, 0.4)):
                f = midi_hz(note) * 2 ** (cents / 1200)
                mix_into(warm, osc(TRI, f, m, rng.random()) * env * 0.05, t0, pan=p)

    # pad: crossfade a dark and a bright low-pass for a slowly breathing filter
    pad = hp(pad, 90)
    dark, bright = lp(pad, 900), lp(pad, 2400)
    b = np.clip(auto["bright"] + 0.12 * np.sin(TWO_PI * t / 14.0) + 0.2 * lift, 0, 1)[:, None]
    pad = (dark + (bright - dark) * b) * (auto["pad"] * (1 + 0.12 * lift))[:, None]
    dry += pad
    send += 0.35 * pad
    sub = 0.095 * sub * auto["sub"]
    dry += pan_mono(sub, 0.0)
    warm = lp(warm, 900) * auto["warm"][:, None]
    dry += warm
    send += 0.3 * warm

    # --- bell arpeggio (8ths / quarters depending on the scene)
    bells = np.zeros((n, 2))
    for k in range(int(end / eighth)):
        tk = k * eighth
        sc = min(scene_index(tk, scenes), len(ARP_STEP) - 1)
        step = ARP_STEP[sc]
        pos = k % 16
        if step == 0 or pos % step or (pos % 4 and rng.random() < ARP_REST[sc]):
            continue
        g = auto["bells"][n_samp(tk)] * (1 + 0.2 * lift[n_samp(tk)])
        seg = int(tk // seg_len)
        idx = ARP_PATTERNS[seg % 2][pos]
        note = PROGRESSION[seg % len(PROGRESSION)][2][idx]
        vel = (1.0 if pos % 4 == 0 else 0.78) * rng.uniform(0.85, 1.0)
        mix_into(bells, bell_tone(midi_hz(note), n_samp(1.8)) * 0.12 * vel * g,
                 tk + rng.normal(0, 0.004), pan=(idx - 2) * 0.18)
    bells = lp(bells, 3500)
    dry += bells
    send += 0.6 * bells

    # --- playful wooden pulse (tresillo 3+3+2 per bar)
    plk = np.zeros((n, 2))
    for k in range(int(end / eighth)):
        tk, pos = k * eighth, k % 8
        g = auto["pluck"][n_samp(tk)]
        if pos not in (0, 3, 6) or g < 0.02:
            continue
        bass = PROGRESSION[int(tk // seg_len) % len(PROGRESSION)][0]
        note = bass + (12, 19, 24)[(0, 3, 6).index(pos)]
        mix_into(plk, marimba_tone(midi_hz(note), n_samp(1.0)) * 0.19 * g * rng.uniform(0.85, 1.0),
                 tk + rng.normal(0, 0.003), pan=0.15 * ((0, 3, 6).index(pos) - 1))
    plk = lp(plk, 2500)
    dry += plk
    send += 0.25 * plk

    # --- twinkles: rare high soft swells, almost all reverb (the 'shimmer')
    tw = np.zeros((n, 2))
    tt = rng.exponential(1.5)
    while tt < end:
        if rng.random() < auto["twinkle"][n_samp(tt)] * (1 + 0.3 * lift[n_samp(tt)]):
            arp = PROGRESSION[int(tt // seg_len) % len(PROGRESSION)][2]
            m = n_samp(3.0)
            tm = tvec(m)
            y = np.sin(TWO_PI * midi_hz(rng.choice(arp) + 12) * tm) * smoothstep(tm / 0.5) * np.exp(-tm / 0.9)
            mix_into(tw, y * 0.045, tt, pan=rng.uniform(-0.8, 0.8))
        tt += rng.exponential(1.0 / 0.9)
    dry += 0.15 * tw
    send += tw

    # --- air: very quiet high stereo noise that breathes slowly
    air = np.stack([bp(white(rng, n), 6000, 12000) * (0.7 + 0.3 * wobble(rng, n, 0.2)) for _ in range(2)], 1)
    dry += 0.006 * air

    # --- soft noise swells into the lift and into the final scene
    swell_ends = [x for x in (t_lift, scenes[6][0] if len(scenes) > 6 else None) if x is not None and x < stop]
    length = 2.0

    def rising_lp(f, x):       # low-pass whose cutoff sweeps 300 Hz -> 3 kHz
        fc = 300 * 10 ** np.clip(x / length, 0, 1)
        return 1.0 / (1.0 + (f / fc) ** 4)
    for te in swell_ends:
        m = n_samp(length + 0.4)
        tm = tvec(m)
        env = np.clip(tm / length, 0, 1) ** 2 * np.where(tm < length, 1.0, np.exp(-(tm - length) / 0.12))
        sw = fade(np.stack([tv_filter(colored(rng, m, -3), rising_lp) for _ in range(2)], 1) * env[:, None], 0.01, 0.05)
        mix_into(dry, sw * 0.012, te - length)
        mix_into(send, sw * 0.03, te - length)

    # --- lush reverb (FFT convolution) and bus EQ
    ir = make_ir(np.random.default_rng([seed, 202]))
    send *= auto["verb"][:, None]
    wet = np.stack([signal.oaconvolve(send[:, c], ir[:, c])[:n] for c in range(2)], 1)
    mus = dry + 0.5 * wet
    mus = hp(mus, 30)                                # no DC / sub-rumble
    mus = peq(mus, 2800, -3.0, 0.8)                  # keep the narrator's presence band clear

    # --- loudness, then the comedic hard stop (whole bus incl. reverb tail)
    i_stop = min(n, n_samp(stop))
    if target_lufs is not None:
        mus *= db(target_lufs - loudness(mus[:i_stop]))
    pk = np.max(np.abs(mus))
    if pk > db(-1.0):
        mus *= db(-1.0) / pk
    gate = np.ones(n)
    k = n_samp(0.012)
    gate[max(0, i_stop - k):i_stop] = 0.5 + 0.5 * np.cos(np.pi * np.arange(1, min(k, i_stop) + 1) / min(k, i_stop))
    gate[i_stop:] = 0.0
    mus *= gate[:, None]
    return fade(mus, 0.005, 0.005)


# ============================================================== SFX bus

def event_rng(seed, kind, i):
    return np.random.default_rng([seed, zlib.crc32(f"{kind}:{i}".encode())])


def render_sfx(cues, seed=7):
    """Render beds and events from the cue sheet.

    Returns (stereo bus, list of (name, start_sample, end_sample)) - the
    boundaries are reported for click checks.
    """
    n = n_samp(float(cues["duration"]))
    bus = np.zeros((n, 2))
    placed = []
    items = [("bed", i, b["type"], b["start"], b.get("gain_db", 0.0), b.get("pan", 0.0),
              dict(b.get("params", {}), dur=b["end"] - b["start"])) for i, b in enumerate(cues.get("beds", []))]
    items += [("ev", i, e["type"], e["t"], e.get("gain_db", 0.0), e.get("pan", 0.0), dict(e.get("params", {})))
              for i, e in enumerate(cues.get("events", []))]
    for group, i, kind, t0, gain, pan, params in items:
        if kind not in SOUNDS:
            raise KeyError(f"unknown sound type '{kind}' ({group} #{i})")
        x = to_stereo(SOUNDS[kind](event_rng(seed, kind + group, i), **params), pan)
        a = int(round(t0 * SR))
        # truncated by the file edges -> re-fade the cut so it never clicks
        if a < 0:
            x = fade(x[-a:], 0.005, 0.0)
            a = 0
        if a + len(x) > n:
            x = fade(x[:n - a], 0.0, 0.01)
        if len(x) == 0:
            continue
        bus[a:a + len(x)] += db(gain) * x
        placed.append((kind, a, a + len(x)))
    bus = hp(bus, 20)
    pk = np.max(np.abs(bus))
    if pk > db(-1.0):
        print(f"  sfx: peak {20 * np.log10(pk):+.1f} dBFS -> scaled to -1 dBFS")
        bus *= db(-1.0) / pk
    return fade(bus, 0.003, 0.005), placed


def limit(x, ceiling_db=-1.0, look=0.02):
    """Look-ahead peak limiter: min-filtered gain smoothed by a shorter moving
    average, so the gain is guaranteed <= ceiling/|x| at every peak."""
    from scipy.ndimage import minimum_filter1d
    g = np.minimum(1.0, db(ceiling_db) / np.maximum(np.max(np.abs(x), axis=1), 1e-12))
    w = max(2, n_samp(look))
    g = minimum_filter1d(g, size=2 * w + 1, mode="nearest")
    k = 2 * (w // 2) + 1
    g = np.convolve(np.pad(g, k // 2, mode="edge"), np.ones(k) / k, mode="valid")
    return x * g[:, None], 20 * np.log10(g.min())


# ============================================================== I/O + checks

def write_wav(path, x, float32=False):
    x = np.asarray(x, dtype=np.float64)
    if float32:
        from scipy.io import wavfile
        wavfile.write(path, SR, x.astype(np.float32))
        return
    pcm = np.round(np.clip(x, -1.0, 32767 / 32768) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(x.shape[1])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def _dbfs(v):
    return 20 * np.log10(max(v, 1e-12))


def analyze(name, x, cues, placed=None):
    """Print a numeric sanity report for one stem."""
    n = len(x)
    print(f"\n[{name}] {n} samples = {n / SR:.3f} s, {x.shape[1]} ch")
    print(f"  NaN/Inf: {bool(~np.isfinite(x).all())}   peak {_dbfs(np.max(np.abs(x))):+.2f} dBFS"
          f"   DC L/R {np.mean(x[:, 0]):+.1e} / {np.mean(x[:, 1]):+.1e}   loudness {loudness(x):.1f} LUFS")
    end = cues["music_stop"] if name == "music" else cues["duration"]     # music: ignore the silent tail
    rms = ["%.1f" % _dbfs(np.sqrt(np.mean(x[n_samp(a):n_samp(min(b, end))] ** 2))) for a, b in cues["scenes"] if a < end]
    print("  RMS per scene (dBFS): " + "  ".join(rms))
    d = np.max(np.abs(np.diff(x, axis=0)), axis=1)
    print(f"  max sample jump {d.max():.4f} at {np.argmax(d) / SR:.3f} s")
    if placed:
        w = n_samp(0.001)
        jumps = []
        for kind, a, b in placed:
            for edge in (a, b):
                lo, hi = max(1, edge - w), min(n - 1, edge + w)
                jumps.append((d[lo - 1:hi].max() if hi > lo else 0.0, kind, edge / SR))
        worst = max(jumps)
        print(f"  {len(placed)} sounds placed; worst jump within +-1 ms of a sound edge: "
              f"{worst[0]:.4f} ({worst[1]} @ {worst[2]:.3f} s)")
    if name == "music":
        i = n_samp(cues["music_stop"])
        print(f"  after music_stop ({cues['music_stop']} s): max |x| = {np.max(np.abs(x[i:])) if i < n else 0:.2e}"
              f"   max jump in last 20 ms before stop = {d[max(0, i - n_samp(0.02)):i].max():.4f}")
        spec = np.abs(np.fft.rfft(x[:i, 0] + x[:i, 1])) ** 2
        f = np.fft.rfftfreq(i, 1 / SR)
        print(f"  energy share 1-4 kHz: {100 * spec[(f >= 1000) & (f < 4000)].sum() / spec.sum():.1f} %"
              f"   (<250 Hz: {100 * spec[f < 250].sum() / spec.sum():.1f} %)")


def edge_check(seed=7):
    """Render every registered sound once and verify its edges are silent."""
    worst = 0.0
    for name, fn in SOUNDS.items():
        x = to_stereo(fn(np.random.default_rng(seed), **({"dur": 2.0} if name in ("breath_helmet", "machine_hum") else {})))
        e = max(np.max(np.abs(x[0])), np.max(np.abs(x[-1])))
        worst = max(worst, e)
        assert np.isfinite(x).all(), name
    print(f"\n[edges] {len(SOUNDS)} sound types rendered; max |first/last sample| = {worst:.2e}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cues", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "cues.json"))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "build"))
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--music-lufs", type=float, default=-18.0, help="loudness of music.wav")
    ap.add_argument("--preview-music-lufs", type=float, default=-20.0)
    ap.add_argument("--preview-sfx-lufs", type=float, default=-14.0)
    ap.add_argument("--float32", action="store_true", help="write 32-bit float WAVs instead of 16-bit PCM")
    ap.add_argument("--no-check", action="store_true", help="skip the sanity report")
    args = ap.parse_args()

    with open(args.cues) as f:
        cues = json.load(f)
    os.makedirs(args.out, exist_ok=True)
    t0 = time.time()
    music = render_music(cues, args.seed, args.music_lufs)
    t1 = time.time()
    sfx, placed = render_sfx(cues, args.seed)
    t2 = time.time()
    print(f"rendered music in {t1 - t0:.1f} s, sfx in {t2 - t1:.1f} s")

    # preview: each stem at its own loudness target, summed, peak-safe
    prev = music * db(args.preview_music_lufs - loudness(music)) + sfx * db(args.preview_sfx_lufs - loudness(sfx))
    prev, gr = limit(prev, -1.0)
    print(f"  preview: look-ahead limiter at -1 dBFS, max gain reduction {-gr:.1f} dB")

    for name, x in (("music", music), ("sfx", sfx), ("sfx_preview", prev)):
        path = os.path.join(args.out, name + ".wav")
        write_wav(path, x, args.float32)
        print(f"wrote {path}")

    if not args.no_check:
        analyze("music", music, cues)
        analyze("sfx", sfx, cues, placed)
        analyze("sfx_preview", prev, cues)
        edge_check(args.seed)
    print(f"\ntotal {time.time() - t0:.1f} s")


if __name__ == "__main__":
    main()
