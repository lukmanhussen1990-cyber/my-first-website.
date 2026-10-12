#!/usr/bin/env python3
"""Procedural sound generator for the Giant Spider Hunter resource pack (DESIGN.md section 9).

Every sound is synthesised from scratch with numpy: swept sine thumps, glottal-pulse growls
through moving formant filters, inharmonic additive/FM screeches with chitinous "rattle"
modulation, filtered noise (whooshes, hisses, dirt crunch), modal resonators (chitin clicks,
cracks, knocks), stick-slip excitation through wooden body modes (creaks) and a synthetic
convolution reverb. No recorded, sampled or third-party audio is used anywhere.

Outputs (inside packs/GiantSpiderHunter_RP/):
  sounds/mob/giant_spider/<name><n>.ogg   mono, 44.1 kHz, Ogg Vorbis (ffmpeg libvorbis -q:a 4)
  sounds/sound_definitions.json           format_version 1.20.20, category hostile
  sounds.json                             entity_sounds for horror:giant_spider

Mastering: 24 Hz high-pass (DC/sub-sonic removal), tail trim + short fades, gain to a per-family
loudness target (BS.1770-style K-weighted gated loudness), look-ahead peak limiter at -1 dBFS,
then a post-encode check that re-encodes with less gain if the decoded Vorbis peak exceeds
-0.8 dBFS (no clipping after lossy coding).

Usage (run from anywhere):
  python3 tools/gen_sounds.py                     generate all .ogg + both JSON files
  python3 tools/gen_sounds.py --only roar,hurt    regenerate some families (JSON always rewritten)
  python3 tools/gen_sounds.py --wav-dir DIR       also keep the mastered 16-bit WAV files
  python3 tools/gen_sounds.py --verify [--spectrograms DIR]
                                                  decode/check every referenced file, print a
                                                  report, optionally write spectrogram PNGs
Deterministic: fixed seeds (numpy PCG64) and bit-exact ffmpeg muxing.
Requires numpy and ffmpeg built with libvorbis (ffprobe for --verify, Pillow for spectrograms).
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import wave
import zlib

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

SR = 44100
TAU = 2.0 * np.pi
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "packs", "GiantSpiderHunter_RP")
SOUND_DIR_REL = "sounds/mob/giant_spider"
OUT_DIR = os.path.join(RP, *SOUND_DIR_REL.split("/"))
ENTITY_ID = "horror:giant_spider"
CEILING_DB = -1.0          # limiter ceiling (sample peak) before encoding
DECODED_MAX_DB = -0.8      # max allowed decoded Vorbis peak
VORBIS_Q = "4"


# =========================================================================== basic helpers
def n_of(sec):
    return int(round(sec * SR))


def tline(dur):
    return np.arange(n_of(dur)) / SR


def dbg(db):
    return 10.0 ** (db / 20.0)


def peak_norm(x, p=1.0):
    m = float(np.max(np.abs(x))) if len(x) else 0.0
    return x * (p / m) if m > 0 else x


def fit(x, n):
    return x[:n] if len(x) >= n else np.concatenate([x, np.zeros(n - len(x))])


def place(buf, sig, t0, gain=1.0):
    """Add sig into buf starting at time t0 (seconds)."""
    i0 = n_of(t0)
    if i0 < 0:
        sig, i0 = sig[-i0:], 0
    i1 = min(len(buf), i0 + len(sig))
    if i1 > i0:
        buf[i0:i1] += gain * sig[: i1 - i0]


def env_lin(t, pts):
    tp, vp = zip(*pts)
    return np.interp(t, tp, vp)


def env_log(t, pts):
    tp, vp = zip(*pts)
    return np.exp(np.interp(t, tp, np.log(vp)))


def curve(t, p, log=False):
    """Scalar -> constant array; list of (time, value) -> interpolated curve."""
    if isinstance(p, (int, float)):
        return np.full(np.shape(t), float(p))
    return env_log(t, p) if log else env_lin(t, p)


def decay_env(t, t0, attack, tau):
    """Zero before t0, linear attack, exponential decay (time constant tau)."""
    tt = t - t0
    up = np.clip(tt / attack, 0.0, 1.0) if attack > 0 else (tt >= 0).astype(float)
    return np.where(tt < 0, 0.0, up * np.exp(-np.maximum(tt - attack, 0.0) / tau))


# =========================================================================== filters
def _sf(f):
    return np.maximum(f, 1e-3)


def lp(f, fc, order=2):
    return 1.0 / np.sqrt(1.0 + (f / fc) ** (2 * order))


def hp(f, fc, order=2):
    return 1.0 / np.sqrt(1.0 + (fc / _sf(f)) ** (2 * order))


def bp(f, fc, q):
    x = _sf(f) / fc
    return 1.0 / np.sqrt(1.0 + q * q * (x - 1.0 / x) ** 2)


def fft_filter(x, H):
    """Zero-phase static filter with magnitude response H(freq_hz)."""
    n = len(x)
    nfft = 1 << int(np.ceil(np.log2(max(2 * n, 64))))
    f = np.fft.rfftfreq(nfft, 1.0 / SR)
    return np.fft.irfft(np.fft.rfft(x, nfft) * H(f), nfft)[:n]


def conv(x, h):
    n = len(x) + len(h) - 1
    nfft = 1 << int(np.ceil(np.log2(n)))
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)[:n]


def tv_filter(x, G, n_fft=2048, hop=512):
    """Time-varying filter (STFT overlap-add). G(freq[1,bins], time[frames,1]) -> gain."""
    n = len(x)
    win = np.hanning(n_fft + 1)[:-1]
    pad = n_fft
    xp = np.concatenate([np.zeros(pad), x, np.zeros(pad + hop)])
    frames = (len(xp) - n_fft) // hop + 1
    idx = hop * np.arange(frames)[:, None] + np.arange(n_fft)[None, :]
    spec = np.fft.rfft(xp[idx] * win, axis=1)
    freqs = np.fft.rfftfreq(n_fft, 1.0 / SR)[None, :]
    times = ((hop * np.arange(frames) + n_fft / 2 - pad) / SR)[:, None]
    out = np.fft.irfft(spec * G(freqs, times), n_fft, axis=1) * win
    y = np.zeros(len(xp))
    for i in range(frames):
        y[i * hop: i * hop + n_fft] += out[i]
    y /= np.sum(win ** 2) / hop
    return y[pad: pad + n]


def smooth_noise(n, rate, rng):
    """Unit-variance random modulation band-limited to ~rate Hz."""
    y = fft_filter(rng.standard_normal(n), lambda f: lp(f, rate, 2))
    s = np.std(y)
    return y / s if s > 0 else y


def brown_noise(n, rng):
    y = np.cumsum(rng.standard_normal(n))
    y = fft_filter(y, lambda f: hp(f, 12.0, 2))
    return peak_norm(y)


# =========================================================================== generators
INH_R = (1.0, 1.47, 2.11, 2.73, 3.36, 4.02, 4.81, 5.66)   # inharmonic "chitin throat" partials
INH_A = (1.0, 0.72, 0.55, 0.42, 0.33, 0.25, 0.18, 0.12)


def additive(f, ratios, amps, rng, drift=0.0, fmax=17000.0):
    """Sum of sine partials at ratio*f(t) with independent slow drift (band-limited)."""
    n = len(f)
    base = np.cumsum(f) / SR
    y = np.zeros(n)
    for r, a in zip(ratios, amps):
        ph = TAU * r * base + rng.uniform(0, TAU)
        if drift > 0:
            ph += TAU * np.cumsum(r * f * drift * smooth_noise(n, 3.0, rng)) / SR
        y += a * np.clip((fmax - r * f) / 1500.0, 0.0, 1.0) * np.sin(ph)
    return y


def pulse_train(rate, rng, amp_jitter=0.3, subharm=0.0, lognormal=False):
    """Unit impulses at the phase wraps of the instantaneous rate curve (Hz)."""
    ph = np.cumsum(rate) / SR
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0] + 1
    out = np.zeros(len(rate))
    if len(idx) == 0:
        return out
    if lognormal:
        a = rng.lognormal(0.0, amp_jitter, len(idx))
    else:
        a = np.clip(1.0 + amp_jitter * rng.standard_normal(len(idx)), 0.05, None)
    if subharm:
        a[1::2] *= 1.0 - subharm
    out[idx] = a
    return out


def modal_ir(rng, modes, dur, detune=0.03):
    """Sum of exponentially damped sines [(freq, tau, amp), ...] (starts at phase 0)."""
    t = tline(dur)
    y = np.zeros(len(t))
    for f, tau, a in modes:
        ff = f * (1.0 + detune * rng.uniform(-1, 1))
        if ff < SR * 0.45:
            y += a * np.exp(-t / tau) * np.sin(TAU * ff * t)
    return y


def click(rng, modes, dur=0.04, noise=0.4, ntau=0.0006, attack=0.00025):
    """Hard chitin click: damped modes + a very short broadband snap."""
    t = tline(dur)
    y = modal_ir(rng, modes, dur, detune=0.05)
    y = y + noise * rng.standard_normal(len(t)) * np.exp(-t / ntau)
    return y * np.clip(t / attack, 0.0, 1.0)


def chitin_click(rng, centre=3200.0, dur=0.035, decay=1.0, noise=0.45):
    sc = centre / 3200.0
    modes = [(3200.0 * sc * rng.uniform(0.9, 1.1), 0.0028 * decay, 1.0),
             (5150.0 * sc * rng.uniform(0.9, 1.1), 0.0018 * decay, 0.7),
             (7300.0 * sc * rng.uniform(0.9, 1.1), 0.0012 * decay, 0.45),
             (1350.0 * sc * rng.uniform(0.9, 1.1), 0.0045 * decay, 0.4)]
    return click(rng, modes, dur, noise=noise, ntau=0.0004)


def crack(rng, size=1.0):
    """Splitting chitin plate: broadband snap + inharmonic plate modes + low pop."""
    modes = [(rng.uniform(650, 1250), rng.uniform(0.008, 0.02), 1.0),
             (rng.uniform(1500, 2600), rng.uniform(0.005, 0.012), 0.85),
             (rng.uniform(2900, 4700), rng.uniform(0.003, 0.008), 0.6),
             (rng.uniform(5200, 8000), rng.uniform(0.0015, 0.004), 0.35),
             (rng.uniform(170, 330), rng.uniform(0.012, 0.03), 0.55 * size)]
    t = tline(0.09)
    snap = fft_filter(rng.standard_normal(len(t)), lambda f: hp(f, 1100, 2)) * np.exp(-t / 0.0011)
    return modal_ir(rng, modes, 0.09, detune=0.0) + 0.9 * snap * np.clip(t / 0.0002, 0, 1)


def creak(rng, dur, rate_pts, modes, amp_pts, wobble=0.25, grain=0.55, friction=0.15):
    """Stick-slip creak: irregular pulse train through resonant (wood/chitin) body modes."""
    t = tline(dur)
    n = len(t)
    rate = np.maximum(env_log(t, rate_pts) * np.exp(wobble * smooth_noise(n, 9.0, rng)), 3.0)
    imp = pulse_train(rate, rng, amp_jitter=grain, lognormal=True)
    y = conv(imp, modal_ir(rng, modes, 0.3))[:n]
    gate = conv(imp, np.exp(-np.arange(n_of(0.004)) / (0.0012 * SR)))[:n]
    top = max(m[0] for m in modes)
    fr = fft_filter(rng.standard_normal(n), lambda f: bp(f, top, 1.0)) * gate
    y = peak_norm(y) + friction * peak_norm(fr)
    return y * env_lin(t, amp_pts)


def growl(rng, dur, f0, amp, formants, sub=0.4, jitter=0.07, breath=0.3, drive=2.5, rough=None):
    """Creature throat: jittered glottal pulses (period-doubled) through moving formants."""
    t = tline(dur)
    n = len(t)
    f0c = curve(t, f0, True) * np.exp(jitter * smooth_noise(n, 30.0, rng))
    src = pulse_train(f0c, rng, amp_jitter=0.35, subharm=sub)
    src = src + breath * 0.034 * rng.standard_normal(n)
    F1p, F2p, F3p = formants

    def G(F, tt):
        g = (0.06 + bp(F, curve(tt, F1p, True), 3.0) + 0.7 * bp(F, curve(tt, F2p, True), 4.5)
             + 0.45 * bp(F, curve(tt, F3p, True), 6.0) + 0.6 * bp(F, 110.0, 1.2))
        return g * hp(F, 40, 2) * lp(F, 5000, 2) / np.sqrt(1.0 + (F / 500.0) ** 2)

    y = tv_filter(src, G)
    if rough:
        rate, depth = rough
        y = y * (1.0 - depth * (0.5 + 0.5 * np.sin(TAU * np.cumsum(curve(t, rate, True)) / SR)))
    y = peak_norm(y) * curve(t, amp)
    return np.tanh(drive * y) / np.tanh(drive)


def screech(rng, dur, f, amp, detune=1.031, vib=(6.0, 0.015), jitter=0.025, rattle=(55.0, 0.5),
            fm=1.5, noise=0.35, drive=2.2, bright=2600.0, sharp=2):
    """Inharmonic, beating, FM-roughened screech with chitinous amplitude rattle + breath."""
    t = tline(dur)
    n = len(t)
    base = curve(t, f, True)
    fc = base * np.exp(vib[1] * np.sin(TAU * vib[0] * t + rng.uniform(0, TAU))
                       + curve(t, jitter) * smooth_noise(n, 22.0, rng))
    v1 = additive(fc, INH_R, INH_A, rng, drift=0.004)
    v2 = additive(fc * detune, INH_R, INH_A, rng, drift=0.004)
    v3 = np.sin(TAU * np.cumsum(2.0 * fc) / SR
                + curve(t, fm) * np.sin(TAU * np.cumsum(2.0 * 1.414 * fc) / SR))
    y = peak_norm(v1) + 0.6 * peak_norm(v2) + 0.45 * peak_norm(v3)
    rate, depth = rattle
    rr = curve(t, rate, True) * np.exp(0.12 * smooth_noise(n, 4.0, rng))
    am = (1.0 - depth) + depth * (0.5 + 0.5 * np.sin(TAU * np.cumsum(rr) / SR)) ** sharp
    nz = tv_filter(rng.standard_normal(n),
                   lambda F, tt: bp(F, 2.0 * curve(tt, f, True), 1.4) + 0.35 * hp(F, 3000, 2) * lp(F, 9000, 2))
    y = (peak_norm(y) + noise * peak_norm(nz)) * am
    y = tv_filter(y, lambda F, tt: hp(F, 220, 2) * (0.3 + bp(F, bright, 0.8)) * lp(F, 11000, 2))
    y = peak_norm(y) * curve(t, amp)
    return np.tanh(drive * y) / np.tanh(drive)


def thump(t, t0, f_hi=80.0, f_lo=30.0, tau=0.25, sweep=0.045, drive=2.2, attack=0.004):
    """Pitch-dropping sine thump, saturated so its harmonics survive on phone speakers."""
    tt = np.maximum(t - t0, 0.0)
    f = f_lo + (f_hi - f_lo) * np.exp(-tt / sweep)
    s = np.sin(TAU * np.cumsum(f) / SR) * decay_env(t, t0, attack, tau)
    return np.tanh(drive * s) / np.tanh(drive)


def grains(rng, t, t0, rate0, tau, lo=600.0, hi=7000.0):
    """Dirt/gravel crunch: Poisson grains with decaying density, band-limited."""
    tt = t - t0
    r = np.where(tt >= 0, rate0 * np.exp(-np.maximum(tt, 0.0) / tau), 0.0)
    hits = rng.random(len(t)) < r / SR
    g = hits * rng.lognormal(0.0, 0.9, len(t)) * rng.choice([-1.0, 1.0], len(t))
    return fft_filter(g, lambda f: hp(f, lo, 2) * lp(f, hi, 2) * (0.5 + bp(f, np.sqrt(lo * hi), 0.7)))


def impact(rng, t, t0, weight=1.0, f_hi=80.0, f_lo=30.0, tau=0.16, knock_hz=170.0, crunch=1.0,
           debris=5, debris_spread=0.5, sub_g=0.7, snap=0.0):
    """Giant leg hitting the ground: sub thump, mid-range mass thud (audible on phone speakers),
    hollow chitin knock, dirt crunch, optional chitin crack and settling debris."""
    n = len(t)
    sub = thump(t, t0, f_hi, f_lo, tau, sweep=0.035)
    w = rng.standard_normal(n)
    thud = fft_filter(w, lambda f: lp(f, 380, 2) * hp(f, 45, 1) * (0.6 + bp(f, 160, 0.8))) \
        * decay_env(t, t0, 0.002, 0.055)
    knock = np.zeros(n)
    k = knock_hz
    place(knock, modal_ir(rng, [(k, 0.045, 1.0), (k * 2.27, 0.03, 0.6), (k * 3.9, 0.018, 0.4),
                                (k * 6.3, 0.01, 0.25)], 0.4), t0)
    cr = grains(rng, t, t0, 3200.0, 0.07)
    dirt = fft_filter(rng.standard_normal(n), lambda f: bp(f, 700, 0.7)) * decay_env(t, t0, 0.003, 0.07) \
        * (0.5 + 0.5 * np.abs(smooth_noise(n, 60.0, rng)))
    deb = np.zeros(n)
    for _ in range(debris):
        dt = rng.uniform(0.07, debris_spread)
        place(deb, chitin_click(rng, rng.uniform(1800, 4800), decay=1.5, noise=0.3), t0 + dt,
              rng.uniform(0.3, 1.0) * np.exp(-dt / 0.3))
    y = (sub_g * peak_norm(sub) + 0.8 * peak_norm(thud) + 0.7 * peak_norm(knock)
         + crunch * (0.5 * peak_norm(cr) + 0.4 * peak_norm(dirt)) + 0.15 * peak_norm(deb))
    if snap:
        c = np.zeros(n)
        for _ in range(3):
            place(c, crack(rng, 1.2), t0 + rng.uniform(0, 0.012), rng.uniform(0.6, 1.0))
        y = y + snap * peak_norm(c)
    return weight * y


def hiss(rng, n, centre=3800.0, q=0.8, lo=1500.0):
    return peak_norm(fft_filter(rng.standard_normal(n),
                                lambda f: hp(f, lo, 2) * (0.35 + bp(f, centre, q)) * lp(f, 12000, 2)))


# =========================================================================== reverb
def make_ir(rng, rt=(1.2, 0.9, 0.45), predelay=0.02, early=6):
    """Synthetic outdoor/forest reverb: 3-band exponentially decaying noise + early reflections."""
    length = max(rt) * 1.05
    t = tline(length)
    n = len(t)
    w = rng.standard_normal(n)
    bands = (lambda f: lp(f, 500, 2), lambda f: hp(f, 500, 2) * lp(f, 3500, 2), lambda f: hp(f, 3500, 2))
    ir = sum(fft_filter(w, b) * np.exp(-6.91 * t / r) for b, r in zip(bands, rt))
    ir *= 1.0 - np.exp(-t / 0.015)
    ir /= np.sqrt(np.sum(ir ** 2))
    pre = n_of(predelay)
    out = np.zeros(pre + n)
    out[pre:] = ir
    for _ in range(early):
        d = rng.uniform(0.004, predelay + 0.05)
        out[n_of(d)] += rng.uniform(0.15, 0.4) * np.exp(-d / 0.05) * rng.choice([-1.0, 1.0])
    return out / np.sqrt(np.sum(out ** 2))


def reverb(x, ir, wet):
    y = conv(x, ir)
    return fit(x, len(y)) + wet * y


# =========================================================================== sound designs
def snd_step(rng, v):
    """Giant footfall: deep thud + dirt crunch + wood/chitin creak under load."""
    P = [dict(fh=82, fl=31, tau=0.15, knock=170, rate=(48, 20), body=1.0, cs=0.05),
         dict(fh=74, fl=28, tau=0.17, knock=150, rate=(62, 24), body=0.9, cs=0.08),
         dict(fh=92, fl=34, tau=0.13, knock=195, rate=(40, 16), body=1.1, cs=0.06),
         dict(fh=78, fl=30, tau=0.16, knock=160, rate=(70, 28), body=0.85, cs=0.1)][v]
    t = tline(1.7)
    n = len(t)
    t0 = 0.008
    y = impact(rng, t, t0, 1.0, P["fh"], P["fl"], P["tau"], P["knock"], crunch=1.0,
               debris=int(rng.integers(4, 8)), debris_spread=0.65)
    b = P["body"]
    cd = 0.34 + 0.05 * v
    cr = creak(rng, cd, [(0, P["rate"][0]), (cd, P["rate"][1])],
               [(210 * b, 0.02, 1.0), (470 * b, 0.015, 0.8), (820 * b, 0.012, 0.6),
                (1380 * b, 0.008, 0.4), (2350 * b, 0.005, 0.25)],
               [(0, 0), (0.035, 1.0), (cd * 0.55, 0.75), (cd, 0)], wobble=0.35)
    place(y, 0.5 * peak_norm(cr), t0 + P["cs"])
    rumble = fft_filter(rng.standard_normal(n), lambda f: lp(f, 90, 3)) * decay_env(t, t0, 0.02, 0.25)
    y += 0.22 * peak_norm(rumble)
    return reverb(y, make_ir(rng, (1.1, 0.8, 0.35), predelay=0.012), 0.16)


def snd_step_small(rng, v):
    """Tiny tick/scuttle of the small stalker form."""
    t = tline(0.2)
    n = len(t)
    out = np.zeros(n)
    tt = 0.004
    for k in range([3, 2, 4][v]):
        place(out, chitin_click(rng, rng.uniform(2700, 4200), dur=0.03, decay=rng.uniform(0.7, 1.2)),
              tt, rng.uniform(0.55, 1.0) * 0.78 ** k)
        tt += rng.uniform(0.018, 0.045)
    scrape = fft_filter(rng.standard_normal(n), lambda f: hp(f, 3000, 2) * lp(f, 10000, 2)) \
        * decay_env(t, 0.004, 0.006, 0.03)
    tap = np.zeros(n)
    place(tap, modal_ir(rng, [(rng.uniform(450, 650), 0.008, 1.0), (rng.uniform(1100, 1400), 0.004, 0.5)], 0.06), 0.004)
    return peak_norm(out) + 0.14 * peak_norm(scrape) + 0.28 * peak_norm(tap)


def snd_roar(rng, v):
    """Aggression roar: low growl swelling into a rising inharmonic screech (~2.5 s voice)."""
    dur = 2.95
    t = tline(dur)
    n = len(t)
    if v == 0:
        g = growl(rng, dur, [(0, 40), (0.35, 50), (0.9, 58), (1.6, 56), (2.3, 44), (2.95, 38)],
                  [(0, 0), (0.12, 0.45), (0.55, 0.9), (1.3, 1.0), (2.2, 0.75), (2.55, 0.0), (2.95, 0)],
                  ([(0, 320), (0.8, 560), (1.6, 640), (2.5, 420)], [(0, 850), (1.6, 1250), (2.5, 950)],
                   [(0, 2300), (2.5, 2550)]), sub=0.45, jitter=0.08, breath=0.35, drive=3.0, rough=(27.0, 0.35))
        s = screech(rng, dur, [(0, 330), (0.55, 360), (1.0, 600), (1.5, 950), (1.95, 1300), (2.25, 1220),
                               (2.6, 850), (2.95, 700)],
                    [(0, 0), (0.5, 0), (0.8, 0.35), (1.3, 0.75), (1.85, 1.0), (2.25, 0.95), (2.6, 0.0), (2.95, 0)],
                    fm=[(0, 0.8), (1.0, 1.4), (2.0, 2.6), (2.6, 2.0)], rattle=(52.0, 0.5), vib=(5.5, 0.018))
    else:
        g = growl(rng, dur, [(0, 36), (0.4, 46), (1.0, 53), (1.9, 50), (2.4, 40), (2.95, 34)],
                  [(0, 0), (0.18, 0.5), (0.6, 0.95), (1.5, 1.0), (2.3, 0.7), (2.6, 0.0), (2.95, 0)],
                  ([(0, 300), (0.9, 520), (1.8, 600), (2.6, 380)], [(0, 800), (1.8, 1150), (2.6, 900)],
                   [(0, 2200), (2.6, 2450)]), sub=0.55, jitter=0.1, breath=0.4, drive=3.2, rough=(31.0, 0.4))
        s = screech(rng, dur, [(0, 300), (0.45, 320), (0.85, 780), (1.05, 900), (1.2, 700), (1.5, 820),
                               (1.9, 1250), (2.2, 1450), (2.45, 1300), (2.7, 900), (2.95, 800)],
                    [(0, 0), (0.45, 0), (0.7, 0.4), (1.05, 0.8), (1.2, 0.45), (1.5, 0.7), (2.0, 1.0), (2.4, 0.95),
                     (2.7, 0.0), (2.95, 0)],
                    fm=[(0, 1.0), (1.2, 1.8), (2.2, 2.8)], rattle=(64.0, 0.6), vib=(7.0, 0.02), detune=1.038)
    genv = env_lin(t, [(0, 0), (0.3, 0.4), (1.8, 1.0), (2.5, 0.8), (2.65, 0), (2.95, 0)])
    breath = hiss(rng, n, 4200.0, 0.7, 1800.0) * genv
    sub = (np.sin(TAU * np.cumsum(env_log(t, [(0, 36), (1.5, 44), (2.95, 34)])) / SR)
           + 0.5 * peak_norm(fft_filter(rng.standard_normal(n), lambda f: lp(f, 90, 3)))) \
        * env_lin(t, [(0, 0), (0.4, 0.6), (1.4, 1.0), (2.4, 0.7), (2.7, 0), (2.95, 0)])
    y = peak_norm(g) + dbg(0.0) * peak_norm(s) + dbg(-12) * peak_norm(breath) + dbg(-14) * peak_norm(sub)
    return reverb(y, make_ir(rng, (1.8, 1.4, 0.8), predelay=0.025), 0.28)


def snd_grow(rng, v):
    """Growth: cracking chitin, creaks, stretching groan over a rising rumble (~3.5 s)."""
    T = 3.5
    dur = 3.9
    t = tline(dur)
    n = len(t)
    rum = tv_filter(brown_noise(n, rng), lambda F, tt: lp(F, env_log(tt, [(0, 55), (T, 260 + 40 * v)]), 3) * hp(F, 25, 2))
    rum = peak_norm(rum) * env_lin(t, [(0, 0), (0.3, 0.25), (2.6, 0.85), (3.25, 1.0), (3.5, 0.6), (3.9, 0)])
    ft = env_log(t, [(0, 30 + 2 * v), (T, 52 + 4 * v)])
    ph = np.cumsum(ft) / SR
    tone = sum(a * np.sin(TAU * r * ph + i) for i, (r, a) in enumerate([(1, 1), (1.5, 0.4), (2.03, 0.5), (3.01, 0.25)]))
    tone = np.tanh(1.8 * peak_norm(tone)) * env_lin(t, [(0, 0), (0.6, 0.2), (3.2, 1.0), (3.5, 0.5), (3.9, 0)])
    # cracks: Poisson process with rising rate (thinning)
    cracks = np.zeros(n)
    rmax = 2.5 + 16.0
    tc = 0.05
    while True:
        tc += rng.exponential(1.0 / rmax)
        if tc > T - 0.3:
            break
        rate = 2.5 + 16.0 * (tc / T) ** 1.6
        if rng.random() > rate / rmax:
            continue
        size = rng.lognormal(0.0, 0.45) * (0.35 + 0.65 * tc / T)
        for _ in range(int(rng.integers(1, 5))):
            place(cracks, crack(rng, size), tc + rng.uniform(0, 0.03), size * rng.uniform(0.4, 1.0))
    # big final split + body settling thump
    tf = T - 0.28
    for _ in range(5):
        place(cracks, crack(rng, 1.6), tf + rng.uniform(0, 0.045), rng.uniform(1.0, 1.6))
    creaks = np.zeros(n)
    starts = np.sort(rng.uniform(0.1, 3.0, 5))
    for k, cs in enumerate(starts):
        cd = rng.uniform(0.35, 0.8)
        b = 1.15 - 0.45 * cs / T
        r0, r1 = (rng.uniform(55, 90), rng.uniform(18, 30)) if k % 2 == 0 else (rng.uniform(18, 28), rng.uniform(45, 70))
        c = creak(rng, cd, [(0, r0), (cd, r1)],
                  [(190 * b, 0.022, 1.0), (430 * b, 0.016, 0.8), (760 * b, 0.012, 0.55), (1300 * b, 0.008, 0.4),
                   (2200 * b, 0.005, 0.25)], [(0, 0), (0.05, 1.0), (cd * 0.6, 0.7), (cd, 0)], wobble=0.4)
        place(creaks, peak_norm(c), cs, rng.uniform(0.6, 1.0) * (0.6 + 0.4 * cs / T))
    gd = 1.6
    groan = creak(rng, gd, [(0, 13), (gd, 34)], [(95, 0.035, 1.0), (185, 0.025, 0.8), (310, 0.018, 0.6), (560, 0.01, 0.3)],
                  [(0, 0), (0.4, 0.7), (1.3, 1.0), (gd, 0)], wobble=0.2, grain=0.35, friction=0.05)
    gr = np.zeros(n)
    place(gr, groan, 1.75)
    settle = impact(rng, t, T - 0.22, 1.0, 72.0, 27.0, 0.2, 140.0, crunch=0.9, debris=6, debris_spread=0.35)
    y = (0.7 * rum + 0.3 * tone + 1.0 * peak_norm(cracks) + 0.6 * peak_norm(creaks)
         + 0.45 * peak_norm(gr) + 0.85 * peak_norm(settle))
    return reverb(y, make_ir(rng, (1.5, 1.1, 0.55), predelay=0.02), 0.22)


def snd_attack(rng, v):
    """Leg strike: rising whoosh, impact at 0.35 s (= script strike wind-up)."""
    ti = 0.35
    t = tline(1.15)
    n = len(t)
    fpts = [[(0, 260), (0.22, 650), (0.33, 1500), (0.40, 700), (0.6, 320)],
            [(0, 200), (0.15, 520), (0.3, 1700), (0.36, 2200), (0.45, 900), (0.7, 350)],
            [(0, 300), (0.25, 900), (0.34, 1300), (0.42, 600), (0.6, 300)]][v]
    w = tv_filter(rng.standard_normal(n),
                  lambda F, tt: bp(F, env_log(tt, fpts), 1.6) + 0.25 * bp(F, 0.5 * env_log(tt, fpts), 1.0))
    rise = np.clip(t / ti, 0, 1) ** (2.2 if v != 1 else 1.6)
    wenv = np.where(t < ti, rise, np.exp(-(t - ti) / (0.05 if v != 1 else 0.09)))
    air = fft_filter(rng.standard_normal(n), lambda f: lp(f, 280, 2) * hp(f, 40, 1))
    whoosh = (peak_norm(w) + 0.6 * peak_norm(air)) * wenv
    weight = [1.0, 0.6, 0.85][v]
    hit = impact(rng, t, ti, weight, [95, 80, 88][v], [36, 40, 34][v], [0.1, 0.08, 0.11][v],
                 [230, 260, 210][v], crunch=[1.3, 0.6, 1.0][v], debris=[6, 2, 4][v], debris_spread=0.45,
                 sub_g=0.7, snap=[0.55, 0.35, 0.45][v])
    clack = np.zeros(n)
    for k in range([1, 4, 2][v]):
        place(clack, click(rng, [(1300, 0.012, 1.0), (2400, 0.008, 0.8), (3700, 0.005, 0.6), (5200, 0.003, 0.4)],
                           0.06, noise=0.5), ti + (0.0 if k == 0 else rng.uniform(0.01, 0.12)),
              1.0 if k == 0 else rng.uniform(0.35, 0.7))
    y = [0.75, 1.0, 0.85][v] * peak_norm(whoosh) + peak_norm(hit) + 0.42 * peak_norm(clack)
    return reverb(y, make_ir(rng, (1.0, 0.8, 0.35), predelay=0.012), 0.15)


def snd_bite(rng, v):
    """Fang snap (two chitin clacks at ~0.3 s) wrapped in a lunging hiss."""
    ts = [0.30, 0.27][v]
    t = tline(0.75)
    n = len(t)
    pre = tv_filter(rng.standard_normal(n), lambda F, tt: hp(F, 1500, 2) * lp(F, 11000, 2)
                    * (0.15 + bp(F, env_log(tt, [(0, 2500), (ts, 4200), (0.75, 3000)]), 5.0)
                       + 0.6 * bp(F, env_log(tt, [(0, 1500), (ts, 2100), (0.75, 1700)]), 6.0)))
    rat = 0.6 + 0.4 * (0.5 + 0.5 * np.sin(TAU * 38.0 * t)) ** 2
    pre = peak_norm(pre) * rat * env_lin(t, [(0, 0), (ts - 0.09, 0.5), (ts - 0.005, 1.0), (ts + 0.012, 0.25), (ts + 0.05, 0), (0.75, 0)])
    snap = np.zeros(n)
    for k in range([2, 3][v]):
        place(snap, click(rng, [(1100, 0.015, 1.0), (1900, 0.012, 0.9), (3100, 0.008, 0.7), (4700, 0.005, 0.5),
                                (6500, 0.0025, 0.3)], 0.08, noise=0.35, ntau=0.0008),
              ts + 0.011 * k + rng.uniform(0, 0.002), 1.0 if k == 0 else 0.8)
    jaw = np.zeros(n)
    place(jaw, modal_ir(rng, [(190, 0.03, 1.0), (420, 0.02, 0.5), (900, 0.01, 0.25)], 0.2), ts)
    wet = fft_filter(rng.standard_normal(n), lambda f: bp(f, 1200, 1.0)) * decay_env(t, ts, 0.001, 0.025)
    post = peak_norm(tv_filter(rng.standard_normal(n), lambda F, tt: hp(F, 1500, 2) * lp(F, 11000, 2)
                               * (0.15 + bp(F, 3600.0, 5.0) + 0.5 * bp(F, 5400.0, 7.0)))) \
        * decay_env(t, ts + 0.01, 0.02, 0.13) \
        * (0.55 + 0.45 * (0.5 + 0.5 * np.sin(TAU * 30.0 * t)) ** 2)
    chit = np.zeros(n)
    tc = ts + 0.05
    for k in range(int(rng.integers(4, 8))):
        place(chit, chitin_click(rng, rng.uniform(2600, 4200)), tc, 0.8 ** k)
        tc += rng.uniform(0.022, 0.04)
    snarl = growl(rng, 0.75, [(0, 70), (ts, 95), (0.75, 60)],
                  [(0, 0), (0.08, 0.5), (ts - 0.01, 1.0), (ts + 0.03, 0.5), (ts + 0.2, 0), (0.75, 0)],
                  ([(0, 500), (ts, 750), (0.75, 450)], [(0, 1300), (ts, 1700)], 2600.0), sub=0.5, jitter=0.1,
                  drive=3.0, rough=(33.0, 0.5))
    y = (0.8 * pre + peak_norm(snap) + 0.5 * peak_norm(jaw) + 0.35 * peak_norm(wet) + 0.7 * peak_norm(post)
         + 0.35 * peak_norm(chit) + 0.45 * peak_norm(snarl))
    return reverb(y, make_ir(rng, (0.8, 0.6, 0.3), predelay=0.008), 0.1)


def snd_hurt(rng, v):
    """Short pained screech over a choked growl."""
    k = [1.0, 0.86, 1.18][v]
    dur = [0.75, 0.85, 0.65][v]
    t = tline(dur)
    n = len(t)
    s = screech(rng, dur, [(0, 620 * k), (0.05, 1150 * k), (0.18, 1080 * k), (dur * 0.8, 700 * k), (dur, 600 * k)],
                [(0, 0), (0.018, 0.9), (0.08, 1.0), (0.3, 0.7), (dur * 0.85, 0), (dur, 0)],
                rattle=(60.0 + 10 * v, 0.55), fm=[(0, 2.2), (dur, 1.2)], jitter=0.035, vib=(9.0, 0.02), drive=2.6)
    g = growl(rng, dur, [(0, 85 * k), (dur, 55 * k)], [(0, 0), (0.012, 1.0), (0.25, 0.5), (0.5, 0), (dur, 0)],
              ([(0, 450), (dur, 380)], [(0, 1100), (dur, 950)], [(0, 2500), (dur, 2400)]), sub=0.5, drive=3.0)
    hit = hiss(rng, n, 3000.0, 0.7, 800.0) * decay_env(t, 0.0, 0.001, 0.02)
    y = peak_norm(s) + 0.55 * peak_norm(g) + 0.3 * hit
    return reverb(y, make_ir(rng, (1.0, 0.8, 0.4), predelay=0.012), 0.14)


def snd_death(rng, v):
    """Long descending screech that breaks down, then the collapse: thuds + clattering legs."""
    dur = 4.8
    t = tline(dur)
    n = len(t)
    sd = 3.0
    fp = [[(0, 1250), (0.2, 1450), (0.7, 1150), (1.4, 720), (2.1, 380), (2.6, 230), (3.0, 170)],
          [(0, 1100), (0.3, 1350), (0.55, 1250), (0.8, 1400), (1.5, 800), (2.2, 400), (2.7, 220), (3.0, 160)]][v]
    amp = [(0, 0), (0.04, 0.85), (0.35, 1.0), (1.2, 0.8), (2.0, 0.55), (2.6, 0.3), (3.0, 0)]
    s1 = screech(rng, sd, fp, amp, rattle=([(0, 70), (1.5, 40), (3.0, 16)], 0.55),
                 jitter=[(0, 0.02), (1.5, 0.05), (3.0, 0.12)], fm=[(0, 2.4), (3.0, 1.0)], vib=(6.5, 0.025))
    s2 = screech(rng, sd, [(tt + 0.08, f * 0.94) for tt, f in fp], [(0, 0), (0.15, 0.5), (1.5, 0.6), (2.8, 0.2), (3.0, 0)],
                 rattle=([(0, 55), (3.0, 12)], 0.6), jitter=[(0, 0.03), (3.0, 0.15)], fm=1.6, detune=1.05)
    voice = np.zeros(n)
    place(voice, peak_norm(s1) + 0.55 * peak_norm(s2), 0.0)
    g = growl(rng, sd, [(0, 52), (1.5, 44), (3.0, 30)], [(0, 0), (0.1, 0.6), (1.5, 0.8), (2.8, 0.4), (3.0, 0)],
              ([(0, 500), (3.0, 330)], [(0, 1150), (3.0, 850)], [(0, 2400), (3.0, 2200)]), sub=0.6, jitter=0.12, drive=3.0)
    place(voice, 0.6 * peak_norm(g), 0.0)
    coll = np.zeros(n)
    for tt, w in zip([2.1, 2.45, 2.85, 3.3], [0.55, 0.75, 1.0, 0.65]):
        coll += impact(rng, t, tt + rng.uniform(-0.05, 0.05), w, 72.0, 27.0, 0.2, rng.uniform(130, 180),
                       crunch=1.0, debris=4, debris_spread=0.4, snap=0.3)
    clat = np.zeros(n)
    for _ in range(int(rng.integers(30, 45))):
        tc = rng.uniform(2.0, 3.9)
        place(clat, chitin_click(rng, rng.uniform(1500, 3800), decay=rng.uniform(1.0, 2.5)), tc,
              rng.uniform(0.3, 1.0) * np.exp(-max(tc - 3.3, 0) / 0.3))
    ex = hiss(rng, n, 1800.0, 0.8, 600.0) * env_lin(t, [(0, 0), (3.3, 0), (3.5, 0.8), (4.3, 0.35), (4.75, 0), (4.8, 0)]) \
        * (0.6 + 0.4 * np.sin(TAU * 3.0 * t) ** 2)
    gur = creak(rng, 1.3, [(0, 14), (1.3, 6)], [(420, 0.03, 1.0), (1100, 0.02, 0.6), (2400, 0.008, 0.3)],
                [(0, 0), (0.15, 1.0), (0.9, 0.5), (1.3, 0)], wobble=0.4, grain=0.6, friction=0.2)
    gurgle = np.zeros(n)
    place(gurgle, gur, 3.35)
    rumble = fft_filter(rng.standard_normal(n), lambda f: lp(f, 100, 3)) * decay_env(t, 2.1, 0.05, 0.6)
    y = (peak_norm(voice) + 0.95 * peak_norm(coll) + 0.3 * peak_norm(clat) + 0.22 * ex + 0.3 * peak_norm(gurgle)
         + 0.35 * peak_norm(rumble))
    return reverb(y, make_ir(rng, (1.8, 1.3, 0.6), predelay=0.025), 0.24)


def snd_ambient(rng, v):
    """Stalker: mandible chitter / slow clicks + breathy hiss / rattling hiss."""
    if v == 0:
        dur = 1.5
        t = tline(dur)
        n = len(t)
        rate = env_log(t, [(0, 16), (0.35, 30), (0.7, 24), (1.0, 34), (1.3, 18), (1.5, 15)])
        hits = np.nonzero(pulse_train(rate, rng))[0]
        a_env = env_lin(t, [(0, 0), (0.05, 0.8), (0.45, 1.0), (0.55, 0.2), (0.7, 0.9), (1.2, 0.7), (1.35, 0), (1.5, 0)])
        out = np.zeros(n)
        for k, i in enumerate(hits):
            c = chitin_click(rng, (2600 if k % 2 == 0 else 3300) * rng.uniform(0.9, 1.1), decay=rng.uniform(0.8, 1.4))
            place(out, c, i / SR, a_env[i] * rng.uniform(0.5, 1.0))
        purr = growl(rng, dur, 26.0, [(0, 0), (0.2, 0.6), (1.2, 0.6), (1.5, 0)], (550.0, 1400.0, 2600.0), sub=0.3, drive=1.5)
        y = peak_norm(out) + 0.18 * peak_norm(purr) + 0.08 * hiss(rng, n, 3000.0, 0.7) * a_env
    elif v == 1:
        # spiracle breathing (whistling resonances rise on the in-breath, fall on the out-breath)
        # punctuated by deliberate double clicks
        dur = 1.8
        t = tline(dur)
        n = len(t)
        r1 = [(0, 1900), (0.7, 2600), (0.85, 2500), (1.7, 1700)]
        r2 = [(0, 3300), (0.7, 4300), (0.85, 4100), (1.7, 3000)]
        h = tv_filter(rng.standard_normal(n), lambda F, tt: hp(F, 900, 2) * lp(F, 11000, 2)
                      * (0.1 + bp(F, env_log(tt, r1), 7.0) + 0.7 * bp(F, env_log(tt, r2), 9.0)))
        h = peak_norm(h) * env_lin(t, [(0, 0), (0.45, 0.55), (0.7, 0.3), (0.8, 0.12), (1.05, 1.0), (1.5, 0.35), (1.8, 0)]) \
            * (1.0 - 0.35 * (0.5 + 0.5 * np.sin(TAU * 11.0 * t)))
        out = np.zeros(n)
        for tc in [0.05, 0.31, 0.75, 1.32, 1.6]:
            c = rng.uniform(2200, 3600)
            place(out, chitin_click(rng, c, decay=rng.uniform(1.0, 1.8)), tc, rng.uniform(0.7, 1.0))
            place(out, chitin_click(rng, c * 1.2, decay=1.2), tc + rng.uniform(0.03, 0.05), rng.uniform(0.4, 0.7))
        y = 0.7 * h + peak_norm(out)
    else:
        # stridulation rattle: every pulse is a chitin click plus a short noise grain, over a
        # resonant hiss and a barely audible growl
        dur = 1.6
        t = tline(dur)
        n = len(t)
        renv = env_lin(t, [(0, 0), (0.15, 0.7), (0.9, 1.0), (1.3, 0.6), (1.52, 0), (1.6, 0)])
        pulses = pulse_train(42.0 * np.exp(0.12 * smooth_noise(n, 3.0, rng)), rng, amp_jitter=0.25) * renv
        cir = modal_ir(rng, [(2300, 0.0025, 1.0), (3700, 0.0018, 0.8), (5200, 0.0012, 0.5), (1200, 0.004, 0.4)], 0.03)
        gl = n_of(0.012)
        gir = fft_filter(rng.standard_normal(gl), lambda f: hp(f, 1500, 2)) * np.exp(-np.arange(gl) / (0.003 * SR))
        rat = peak_norm(conv(pulses, cir)[:n]) + 0.5 * peak_norm(conv(pulses, gir)[:n])
        h = tv_filter(rng.standard_normal(n), lambda F, tt: hp(F, 1200, 2) * lp(F, 12000, 2)
                      * (0.1 + bp(F, env_log(tt, [(0, 2600), (1.6, 3400)]), 6.0) + 0.6 * bp(F, 4700.0, 8.0)))
        h = peak_norm(h) * renv
        out = np.zeros(n)
        for tc in [0.02, 0.06, 1.48, 1.55]:
            place(out, chitin_click(rng, rng.uniform(2400, 3400)), tc, rng.uniform(0.6, 1.0))
        g = growl(rng, dur, 45.0, [(0, 0), (0.3, 0.5), (1.2, 0.5), (1.6, 0)], (420.0, 1000.0, 2400.0), sub=0.5, drive=2.0)
        y = peak_norm(rat) + 0.3 * h + 0.7 * peak_norm(out) + 0.12 * peak_norm(g)
    return reverb(y, make_ir(rng, (0.6, 0.5, 0.3), predelay=0.006), 0.1)


def snd_heartbeat(rng, v):
    """Chase heartbeat: muffled lub-dub with harmonics that survive small speakers."""
    t = tline(0.85)
    n = len(t)
    y = np.zeros(n)
    for t0, fh, fl, tau, a in [(0.01, 70.0, 45.0, 0.07, 1.0), (0.28, 84.0, 54.0, 0.055, 0.72)]:
        s = thump(t, t0, fh, fl, tau, sweep=0.03, drive=1.5, attack=0.008)
        body = fft_filter(rng.standard_normal(n), lambda f: lp(f, 160, 2) * hp(f, 30, 1)) * decay_env(t, t0, 0.004, tau * 0.6)
        knock = np.zeros(n)
        place(knock, modal_ir(rng, [(120, 0.03, 1.0), (210, 0.02, 0.6), (330, 0.012, 0.35)], 0.3), t0)
        valve = fft_filter(rng.standard_normal(n), lambda f: bp(f, 280, 1.2)) * decay_env(t, t0, 0.003, 0.025)
        y += a * (peak_norm(s) + 0.5 * peak_norm(body) + 0.7 * peak_norm(knock) + 0.45 * peak_norm(valve))
    y = np.tanh(2.4 * peak_norm(y))
    return fft_filter(y, lambda f: lp(f, 900, 2))


# =========================================================================== catalogue
# name, sound id, builder, target loudness (LUFS-like), max length s, max limiter gain reduction dB,
# min_distance, max_distance, per-file (volume, pitch) in sound_definitions.json
FAMILIES = [
    ("step", "mob.giant_spider.step", snd_step, -14.0, 1.6, 6.0, 8.0, 96.0,
     [(1.0, 1.0), (1.0, 0.95), (0.95, 1.04), (1.0, 0.92)]),
    ("step_small", "mob.giant_spider.step_small", snd_step_small, -21.0, 0.2, 3.0, 1.0, 16.0,
     [(0.6, 1.0), (0.6, 1.08), (0.55, 0.93)]),
    ("roar", "mob.giant_spider.roar", snd_roar, -12.0, 3.6, 3.0, 16.0, 128.0,
     [(1.0, 1.0), (1.0, 0.97)]),
    ("grow", "mob.giant_spider.grow", snd_grow, -14.0, 4.4, 4.0, 12.0, 96.0,
     [(1.0, 1.0), (1.0, 0.96)]),
    ("attack", "mob.giant_spider.attack", snd_attack, -14.0, 1.15, 6.0, 6.0, 64.0,
     [(1.0, 1.0), (1.0, 1.03), (1.0, 0.97)]),
    ("bite", "mob.giant_spider.bite", snd_bite, -15.0, 0.85, 6.0, 4.0, 32.0,
     [(1.0, 1.0), (1.0, 1.05)]),
    ("hurt", "mob.giant_spider.hurt", snd_hurt, -14.0, 1.2, 3.0, 4.0, 48.0,
     [(1.0, 1.0), (1.0, 1.0), (1.0, 1.0)]),
    ("death", "mob.giant_spider.death", snd_death, -13.0, 5.4, 3.0, 12.0, 96.0,
     [(1.0, 1.0), (1.0, 0.96)]),
    ("ambient", "mob.giant_spider.ambient", snd_ambient, -19.0, 2.0, 4.0, 2.0, 24.0,
     [(0.9, 1.0), (0.9, 1.0), (0.9, 1.0)]),
    ("heartbeat", "mob.giant_spider.heartbeat", snd_heartbeat, -16.0, 0.85, 3.0, 2.0, 16.0,
     [(1.0, 1.0)]),
]
DESIGN_VARIANTS = {"step": 4, "step_small": 3, "roar": 2, "grow": 2, "attack": 3, "bite": 2, "hurt": 3,
                   "death": 2, "ambient": 3, "heartbeat": 1}
DESIGN_MAX_DIST = {"step": 96, "step_small": 16, "roar": 128, "grow": 96, "attack": 64, "bite": 32, "hurt": 48,
                   "death": 96, "ambient": 24, "heartbeat": 16}

# sounds.json entity events (engine-driven). No engine footsteps: "step" is set to "" (silent, as
# vanilla does for minecart) - footsteps come from the client steps animation controller.
ENTITY_EVENTS = {
    # ambient chitter is played by the script only while stalking/idle (state aware), so the
    # engine's random ambient sound is silenced like the engine footsteps.
    "ambient": "",
    "hurt": {"sound": "mob.giant_spider.hurt", "volume": 1.0, "pitch": [0.85, 1.15]},
    "hurt.in.water": {"sound": "mob.giant_spider.hurt", "volume": 0.8, "pitch": [0.75, 0.95]},
    "death": {"sound": "mob.giant_spider.death", "volume": 1.0, "pitch": [0.92, 1.05]},
    "death.in.water": {"sound": "mob.giant_spider.death", "volume": 0.8, "pitch": [0.8, 0.95]},
    "step": "",
}


# =========================================================================== mastering
def k_weight(x):
    def H(f):
        x2 = (f / 1500.0) ** 2
        return np.sqrt((1.0 + dbg(4.0) ** 2 * x2) / (1.0 + x2)) * hp(f, 38.0, 2)
    return fft_filter(x, H)


def loudness(x):
    """Gated K-weighted loudness (BS.1770 style, 400 ms blocks / 100 ms hop)."""
    y = k_weight(x)
    blk, hop = n_of(0.4), n_of(0.1)
    if len(y) <= blk:
        ms = np.array([np.mean(y ** 2)])
    else:
        ms = np.array([np.mean(y[i:i + blk] ** 2) for i in range(0, len(y) - blk + 1, hop)])
    L = -0.691 + 10 * np.log10(np.maximum(ms, 1e-20))
    g = ms[L > -70]
    if not len(g):
        return -70.0
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g2 = ms[(L > -70) & (L > rel)]
    return float(-0.691 + 10 * np.log10(np.mean(g2)))


def phone_loudness(x):
    """Loudness of the part a phone speaker can reproduce (high-passed at 250 Hz)."""
    return loudness(fft_filter(x, lambda f: hp(f, 250.0, 4)))


def limiter(x, ceiling_db=CEILING_DB, look_ms=3.0, release_ms=120.0):
    """Look-ahead peak limiter; the gain curve never exceeds the per-sample requirement."""
    thr = dbg(ceiling_db)
    req = np.minimum(1.0, thr / np.maximum(np.abs(x), 1e-12))
    if req.min() >= 1.0:
        return x.copy(), 0.0
    L = max(1, n_of(look_ms / 1000.0))
    m = sliding_window_view(np.pad(req, (L, L), constant_values=1.0), 2 * L + 1).min(axis=1)
    rel = 1.0 - np.exp(-1.0 / (release_ms / 1000.0 * SR))
    g = np.empty_like(m)
    cur = 1.0
    for i, val in enumerate(m.tolist()):
        cur = val if val < cur else cur + (val - cur) * rel
        g[i] = cur
    c = np.concatenate([[0.0], np.cumsum(np.pad(g, (L, L), mode="edge"))])
    s = (c[2 * L + 1:] - c[:-2 * L - 1]) / (2 * L + 1)
    y = x * np.minimum(s, req)
    return y, float(-20 * np.log10(max(np.min(s), 1e-9)))


def master(x, target, max_len, max_gr, tail_db=-62.0):
    x = fft_filter(x, lambda f: hp(f, 24.0, 2))
    a = np.abs(x)
    above = np.nonzero(a > a.max() * dbg(tail_db))[0]
    end = min(len(x), above[-1] + n_of(0.03))
    truncated = end > n_of(max_len)
    end = min(end, n_of(max_len))
    x = x[:end].copy()
    fi = n_of(0.002)
    x[:fi] *= np.sin(np.linspace(0, np.pi / 2, fi)) ** 2
    fo = min(n_of(0.15), len(x) // 6) if truncated else min(n_of(0.04), len(x) // 4)
    x[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
    # gain so that the *limited* signal meets the loudness target, without more than max_gr dB
    # of peak reduction (transients keep their punch; such files end up slightly quieter)
    gdb = target - loudness(x)
    for _ in range(8):
        y, gr = limiter(x * dbg(gdb))
        if gr > max_gr + 0.05:
            gdb -= gr - max_gr
            continue
        err = target - loudness(y)
        if abs(err) < 0.15 or (err > 0 and gr >= max_gr - 0.1):
            break
        gdb += err
    y, gr = limiter(x * dbg(gdb))
    return y, {"limiter_gr_db": gr}


# =========================================================================== encode / decode
def write_wav(path, x, rng):
    d = (rng.random(len(x)) - rng.random(len(x))) / 32768.0       # TPDF dither
    pcm = np.clip(np.round((x + d) * 32767.0), -32768, 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def encode(wav, ogg):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", wav, "-map_metadata", "-1", "-fflags", "+bitexact",
                    "-flags:a", "+bitexact", "-ac", "1", "-ar", str(SR), "-c:a", "libvorbis", "-q:a", VORBIS_Q, ogg],
                   check=True)


def decode(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "pipe:1"],
                       check=True, capture_output=True)
    return np.frombuffer(r.stdout, dtype="<f4").astype(np.float64)


# =========================================================================== JSON
def sound_definitions():
    defs = {}
    for name, sid, _b, _t, _m, _g, mind, maxd, files in FAMILIES:
        entries = []
        for i, (vol, pit) in enumerate(files):
            e = {"name": f"{SOUND_DIR_REL}/{name}{i + 1}", "volume": vol, "pitch": pit}
            if i == 0:
                e["load_on_low_memory"] = True
            entries.append(e)
        defs[sid] = {"category": "hostile", "min_distance": mind, "max_distance": maxd, "sounds": entries}
    return {"format_version": "1.20.20", "sound_definitions": defs}


def sounds_json():
    return {"entity_sounds": {"entities": {ENTITY_ID: {"volume": 1.0, "pitch": [0.95, 1.05], "events": ENTITY_EVENTS}}}}


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(obj, fh, indent=2)
        fh.write("\n")


# =========================================================================== main generation
def seed_for(name, v):
    return np.random.default_rng([zlib.crc32(name.encode()), v, 0x6A5])


def generate(only=None, wav_dir=None):
    os.makedirs(OUT_DIR, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="gsh_sounds_")
    expected = set()
    rows = []
    try:
        for name, sid, builder, target, max_len, max_gr, _mi, _ma, files in FAMILIES:
            for v in range(len(files)):
                fname = f"{name}{v + 1}"
                expected.add(fname + ".ogg")
                if only and name not in only:
                    continue
                rng = seed_for(name, v)
                raw = builder(rng, v)
                x, info = master(raw, target, max_len, max_gr)
                ogg = os.path.join(OUT_DIR, fname + ".ogg")
                wav = os.path.join(wav_dir or tmp, fname + ".wav")
                gain = 1.0
                for _attempt in range(4):
                    write_wav(wav, x * gain, seed_for(name + "_dither", v))
                    encode(wav, ogg)
                    pk = float(np.max(np.abs(decode(ogg))))
                    if pk <= dbg(DECODED_MAX_DB):
                        break
                    gain *= dbg(DECODED_MAX_DB - 0.1) / pk
                rows.append((fname, len(x) / SR, loudness(x * gain), 20 * np.log10(pk), info["limiter_gr_db"],
                             os.path.getsize(ogg), phone_loudness(x * gain)))
                print(f"  {fname:12s} {len(x) / SR:5.2f}s  loud {rows[-1][2]:6.1f} (phone {rows[-1][6]:6.1f})  "
                      f"decoded peak {rows[-1][3]:6.2f} dBFS  limiter GR {info['limiter_gr_db']:4.1f} dB  "
                      f"{rows[-1][5]:7d} B", flush=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    if not only:
        for f in os.listdir(OUT_DIR):
            if f.endswith((".ogg", ".wav", ".fsb")) and f not in expected:
                os.remove(os.path.join(OUT_DIR, f))
                print(f"  removed stale {f}")
    write_json(os.path.join(RP, "sounds", "sound_definitions.json"), sound_definitions())
    write_json(os.path.join(RP, "sounds.json"), sounds_json())
    print("wrote sounds/sound_definitions.json and sounds.json")
    return rows


# =========================================================================== verification
def spectrogram_png(x, path, title):
    from PIL import Image, ImageDraw
    n_fft, hop = 2048, 256
    win = np.hanning(n_fft)
    xp = np.concatenate([np.zeros(n_fft // 2), x, np.zeros(n_fft)])
    frames = max(1, (len(xp) - n_fft) // hop)
    idx = hop * np.arange(frames)[:, None] + np.arange(n_fft)[None, :]
    S = 20 * np.log10(np.abs(np.fft.rfft(xp[idx] * win, axis=1)) / (n_fft / 4) + 1e-9)
    freqs = np.fft.rfftfreq(n_fft, 1.0 / SR)
    H, W = 360, 900
    fy = np.geomspace(20, 20000, H)[::-1]                 # log frequency axis, top = 20 kHz
    cols = np.linspace(0, frames - 1, W)
    spec = np.array([np.interp(fy, freqs, S[int(c)]) for c in cols]).T
    v = np.clip((spec + 90) / 90, 0, 1)
    rgb = np.stack([np.clip(2.5 * v - 0.5, 0, 1), np.clip(2.5 * v - 1.3, 0, 1),
                    np.clip(1.8 * v, 0, 1) * np.clip(1.6 - 2 * v, 0, 1)], -1)
    img = Image.fromarray((rgb * 255).astype(np.uint8))
    wave_h = 90
    canvas = Image.new("RGB", (W, H + wave_h + 18), (10, 10, 14))
    canvas.paste(img, (0, 18))
    d = ImageDraw.Draw(canvas)
    d.text((4, 3), title, fill=(230, 230, 230))
    for f in (50, 100, 200, 500, 1000, 2000, 5000, 10000):
        yy = 18 + int(np.interp(np.log(f), np.log(fy[::-1]), np.arange(H)[::-1]))
        d.line([(0, yy), (6, yy)], fill=(200, 200, 200))
        d.text((8, yy - 6), f"{f // 1000}k" if f >= 1000 else str(f), fill=(200, 200, 200))
    seg = np.array_split(x, W)
    mid = H + 18 + wave_h // 2
    for i, s_ in enumerate(seg):
        if len(s_):
            a = int(np.max(np.abs(s_)) * (wave_h // 2 - 2))
            d.line([(i, mid - a), (i, mid + a)], fill=(120, 200, 120))
    canvas.save(path)


def verify(spec_dir=None):
    ok = True
    problems = []
    sdefs = json.load(open(os.path.join(RP, "sounds", "sound_definitions.json"), encoding="utf-8"))
    sj = json.load(open(os.path.join(RP, "sounds.json"), encoding="utf-8"))
    defs = sdefs.get("sound_definitions", {})
    if sdefs.get("format_version") != "1.20.20":
        problems.append("sound_definitions format_version != 1.20.20")
    for name, count in DESIGN_VARIANTS.items():
        sid = f"mob.giant_spider.{name}"
        d = defs.get(sid)
        if not d:
            problems.append(f"missing definition {sid}")
            continue
        if len(d["sounds"]) != count:
            problems.append(f"{sid}: {len(d['sounds'])} variants, design says {count}")
        if d.get("category") != "hostile":
            problems.append(f"{sid}: category {d.get('category')}")
        if d.get("max_distance") != DESIGN_MAX_DIST[name]:
            problems.append(f"{sid}: max_distance {d.get('max_distance')} != {DESIGN_MAX_DIST[name]}")
    ent = sj.get("entity_sounds", {}).get("entities", {}).get(ENTITY_ID, {})
    for ev in ("hurt", "death"):
        e = ent.get("events", {}).get(ev)
        sid = e if isinstance(e, str) else (e or {}).get("sound")
        if sid not in defs:
            problems.append(f"sounds.json event {ev} -> {sid} undefined")
    referenced = []
    for sid, d in defs.items():
        for s in d["sounds"]:
            nm = s if isinstance(s, str) else s["name"]
            referenced.append((sid, nm))
    total = 0
    print(f"{'file':34s} {'codec':7s} {'ch':>2s} {'rate':>6s} {'dur s':>6s} {'peak dB':>8s} {'rms dB':>7s} "
          f"{'loud':>6s} {'phone':>6s} {'centroid':>8s} {'flat':>5s} {'bytes':>7s}")
    for sid, nm in referenced:
        path = os.path.join(RP, *nm.split("/")) + ".ogg"
        if not os.path.isfile(path):
            problems.append(f"{sid}: missing file {nm}.ogg")
            continue
        pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path],
                                       check=True, capture_output=True, text=True).stdout)
        st = pr["streams"][0]
        x = decode(path)
        size = os.path.getsize(path)
        total += size
        peak = 20 * np.log10(max(np.max(np.abs(x)), 1e-12))
        rms = 20 * np.log10(max(np.sqrt(np.mean(x ** 2)), 1e-12))
        # Welch power spectrum (2048-point Hann frames, 50 % overlap): white noise -> flatness ~1
        xp = np.concatenate([x, np.zeros(2048)])
        fidx = 1024 * np.arange(max(1, (len(xp) - 2048) // 1024 + 1))[:, None] + np.arange(2048)[None, :]
        P = np.mean(np.abs(np.fft.rfft(xp[fidx] * np.hanning(2048), axis=1)) ** 2, axis=0)
        fr = np.fft.rfftfreq(2048, 1.0 / SR)
        band = (fr > 50) & (fr < 16000)
        centroid = float(np.sum(fr[band] * P[band]) / max(np.sum(P[band]), 1e-20))
        flat = float(np.exp(np.mean(np.log(P[band] + 1e-20))) / max(np.mean(P[band]), 1e-20))
        dur = float(pr["format"]["duration"])
        print(f"{nm[len(SOUND_DIR_REL) + 1:] + '.ogg':34s} {st['codec_name']:7s} {st['channels']:>2d} "
              f"{st['sample_rate']:>6s} {dur:6.2f} {peak:8.2f} {rms:7.1f} {loudness(x):6.1f} "
              f"{phone_loudness(x):6.1f} {centroid:8.0f} "
              f"{flat:5.2f} {size:7d}")
        if st["codec_name"] != "vorbis" or st["channels"] != 1 or st["sample_rate"] != str(SR):
            problems.append(f"{nm}: format {st['codec_name']}/{st['channels']}ch/{st['sample_rate']}")
        if peak >= 0.0:
            problems.append(f"{nm}: clipping (peak {peak:.2f} dBFS)")
        if peak < -12.0:
            problems.append(f"{nm}: too quiet (peak {peak:.2f} dBFS)")
        if flat > 0.5:
            problems.append(f"{nm}: spectrum is noise-like (flatness {flat:.2f})")
        if spec_dir:
            os.makedirs(spec_dir, exist_ok=True)
            spectrogram_png(x, os.path.join(spec_dir, os.path.basename(nm) + ".png"),
                            f"{os.path.basename(nm)}  {dur:.2f}s  peak {peak:.1f} dBFS")
    on_disk = sorted(f for f in os.listdir(OUT_DIR) if f.endswith(".ogg"))
    ref_names = sorted(os.path.basename(nm) + ".ogg" for _sid, nm in referenced)
    if on_disk != ref_names:
        problems.append(f"unreferenced/missing files: disk={on_disk} referenced={ref_names}")
    print(f"total ogg size: {total} bytes ({total / 1048576:.3f} MiB) in {len(referenced)} files")
    if total > 2.5 * 1048576:
        problems.append("total size exceeds 2.5 MB")
    for p in problems:
        print("PROBLEM:", p)
        ok = False
    print("VERIFY OK" if ok else "VERIFY FAILED")
    return ok


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--only", help="comma separated family names to regenerate")
    ap.add_argument("--wav-dir", help="keep mastered WAV files in this directory")
    ap.add_argument("--verify", action="store_true", help="verify generated files instead of generating")
    ap.add_argument("--spectrograms", help="with --verify: write spectrogram PNGs here")
    a = ap.parse_args()
    if shutil.which("ffmpeg") is None:
        sys.exit("ffmpeg not found")
    if a.verify:
        sys.exit(0 if verify(a.spectrograms) else 1)
    only = set(a.only.split(",")) if a.only else None
    if only and not only <= {f[0] for f in FAMILIES}:
        sys.exit(f"unknown family in --only: {only - {f[0] for f in FAMILIES}}")
    if a.wav_dir:
        os.makedirs(a.wav_dir, exist_ok=True)
    generate(only, a.wav_dir)


if __name__ == "__main__":
    main()
