#!/usr/bin/env python3
"""
make_sounds.py - procedural sound design for the SCP-096 Bedrock add-on.

Synthesises six original, human-like vocal sounds with numpy/scipy only (no samples):

    cry1.ogg    anguished sobbing wail, calm / mournful      (~3.7 s)
    cry2.ogg    second cry variant (different vowel, nasal)   (~3.3 s)
    scream1.ogg breath-in + piercing distorted shriek         (~4.3 s)
    rage1.ogg   gritty, raspy screech / growl (loops while running) (~2.7 s)
    hurt1.ogg   short groan                                   (~0.6 s)
    death1.ogg  descending wail                               (~2.3 s)

Method: source-filter voice model.
  * glottal source = band-limited harmonic series whose amplitudes follow a
    glottal-derivative spectrum  (f/fg) / (1+(f/fg)^2)^(p/2)   (p = tilt: ~1.3 pressed
    ... ~3 breathy) with per-cycle jitter, shimmer, vibrato, period-doubling
    (sub-harmonic) roughness and low-rate AM growl,
  * vocal tract = cascade of 2-pole resonators (F1..F7) with time-varying
    formants; complex response (magnitude AND phase) is evaluated at every
    harmonic, so the result is a proper minimum-phase-like voiced waveform,
  * aspiration / frication noise shaped by the same time-varying vocal tract
    (STFT filtering) and pitch-synchronously modulated,
  * soft-clip (tanh, oversampled) distortion, tiny synthetic room, DC/HP/LP
    filtering, fades, peak normalisation to -3 dBFS.
Everything is seeded (numpy default_rng) and therefore deterministic.

Encoding: ffmpeg -c:a libvorbis, mono, 44100 Hz (bit-exact flags => reproducible).

Usage:
    python3 tools/make_sounds.py build      # synthesise + encode + analyse + spectrograms
    python3 tools/make_sounds.py analyze    # only analyse the shipped .ogg files
    python3 tools/make_sounds.py verify     # check json files <-> ogg files <-> ffprobe
    python3 tools/make_sounds.py all        # build + verify

Dev-only tool: NOT shipped inside the .mcaddon.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.interpolate import CubicSpline, PchipInterpolator
from scipy.io import wavfile
from scipy.linalg import solve_toeplitz

SR = 44100
HOP = 128                      # control-rate hop (samples) of the vocal tract / source frames
PEAK_DB = -3.0                 # target peak level of every shipped file
ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "SCP096_RP" / "sounds" / "mob" / "scp096"
PREVIEW_DIR = ROOT / "previews" / "audio"
SOUND_DEFS = ROOT / "SCP096_RP" / "sounds" / "sound_definitions.json"
SOUNDS_JSON = ROOT / "SCP096_RP" / "sounds.json"
QUALITY = "6"                  # libvorbis -q:a (~100 kbit/s mono; budget is ample)

# --------------------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------------------


def db(x: float) -> float:
    return 20.0 * math.log10(max(float(x), 1e-12))


def undb(d: float) -> float:
    return 10.0 ** (d / 20.0)


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def curve(t, pts):
    """Smooth monotone (PCHIP) interpolation through (time, value) points, clamped outside."""
    ts = np.array([p[0] for p in pts], dtype=float)
    vs = np.array([p[1] for p in pts], dtype=float)
    return PchipInterpolator(ts, vs, extrapolate=False)(np.clip(t, ts[0], ts[-1]))


def smooth_noise(rng, n, rate_hz):
    """Unit-variance smooth random signal: gaussian values every 1/rate_hz seconds, cubic interpolated."""
    nc = int(math.ceil(n / SR * rate_hz)) + 4
    knots = rng.standard_normal(nc)
    x = np.arange(nc) / rate_hz
    cs = CubicSpline(x, knots)
    y = cs(np.arange(n) / SR)
    s = y.std()
    return y / s if s > 0 else y


def lowpass_sos(x, fc, order=4):
    return signal.sosfilt(signal.butter(order, fc, "low", fs=SR, output="sos"), x)


def highpass_sos(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, "high", fs=SR, output="sos"), x)


def movavg(x, seconds):
    w = max(3, int(seconds * SR) | 1)
    ker = np.hanning(w)
    ker /= ker.sum()
    return signal.fftconvolve(x, ker, mode="same")


def unit_rms(y, win_s=0.06):
    """Normalise a signal to ~unit short-time RMS (so the amplitude envelope applied later is the real loudness)."""
    ms = np.maximum(movavg(y * y, win_s), 0.0)
    return y / np.sqrt(ms + 1e-9 * (np.mean(y * y) + 1e-12))


def frame_times(n):
    nf = n // HOP + 2
    return np.arange(nf) * HOP / SR


def at_frames(arr, n):
    nf = n // HOP + 2
    return arr[np.minimum(np.arange(nf) * HOP, n - 1)]


# --------------------------------------------------------------------------------------
# vocal tract: cascade of 2-pole resonators, analog prototype with unity DC gain
# --------------------------------------------------------------------------------------


def vt_response(freqs, F, B, Gdb):
    """Complex response of a cascade of resonators.

    freqs: [nf, K] evaluation frequencies (Hz);  F, B, Gdb: [nf, nform]
    returns [nf, K] complex."""
    w = 2.0 * np.pi * freqs[:, None, :]
    sig = np.pi * B[:, :, None]
    wd = 2.0 * np.pi * F[:, :, None]
    num = sig ** 2 + wd ** 2
    den = (1j * w + sig - 1j * wd) * (1j * w + sig + 1j * wd)
    g = (10.0 ** (Gdb[:, :, None] / 20.0))
    return np.prod(g * num / den, axis=1)


def tract_arrays(t_frames, f123, scale=1.0, bw=None, hi=None, gains=None, hi_bw=None):
    """Build per-frame formant arrays F,B,G ([nf,7]).

    f123: callable t->[nf,3] (F1,F2,F3 in Hz) .  scale: vocal-tract-length factor (1.1 = shorter tract).
    hi: fixed F4..F7; bw: B1..B3 (Hz)"""
    f3 = f123(t_frames) * scale
    nf = len(t_frames)
    hi = np.array(hi if hi is not None else [3500.0, 4600.0, 6000.0, 7800.0]) * scale
    hi_bw = np.array(hi_bw if hi_bw is not None else [330.0, 480.0, 700.0, 950.0])
    bw3 = np.array(bw if bw is not None else [90.0, 110.0, 160.0])
    F = np.concatenate([f3, np.tile(hi, (nf, 1))], axis=1)
    B = np.concatenate([np.tile(bw3, (nf, 1)), np.tile(hi_bw, (nf, 1))], axis=1)
    G = np.zeros((nf, 7))
    if gains is not None:
        G[:] = np.array(gains)[None, :]
    return F, B, G


def vowel(*specs):
    """Return t -> [n,3] formant track from (time, (F1,F2,F3)) points."""
    ts = [s[0] for s in specs]
    arr = np.array([s[1] for s in specs], dtype=float)

    def f(t):
        t = np.asarray(t)
        return np.stack([np.interp(t, ts, arr[:, i]) for i in range(3)], axis=1)
    return f


# --------------------------------------------------------------------------------------
# voiced source: band-limited harmonic synthesis through the vocal tract
# --------------------------------------------------------------------------------------


def harmonic_synth(f0, F, B, G, p, fg_ratio=1.4, fmax=14000.0):
    """Additive source-filter synthesis.

    f0: per-sample F0 (Hz); F,B,G: [nf,7] tract; p: [nf] tilt exponent. returns (signal, cycles-phase)."""
    n = len(f0)
    f0f = at_frames(f0, n)
    fmin = float(np.min(f0))
    K = int(fmax / fmin) + 1
    k = np.arange(1, K + 1)
    freqs = f0f[:, None] * k[None, :]
    H = vt_response(freqs, F, B, G)
    fg = fg_ratio * f0f[:, None]
    x = freqs / fg
    src = x / (1.0 + x * x) ** (p[:, None] / 2.0)
    taper = np.clip((fmax - freqs) / (0.2 * fmax), 0.0, 1.0)
    taper = 0.5 - 0.5 * np.cos(np.pi * taper)
    C = (H * src * taper).astype(np.complex128)
    phi = np.cumsum(f0) / SR            # cycles
    y = np.zeros(n)
    CH = 2048
    for s0 in range(0, n, CH):
        s1 = min(n, s0 + CH)
        pos = np.arange(s0, s1) / HOP
        j = pos.astype(int)
        w = (pos - j)[:, None]
        cm = C[j] * (1.0 - w) + C[j + 1] * w
        ph = np.mod(np.outer(phi[s0:s1], k), 1.0)
        y[s0:s1] = np.real(np.sum(cm * np.exp(2j * np.pi * ph), axis=1))
    return y, phi


# --------------------------------------------------------------------------------------
# noise shaping (aspiration / inhale / frication) in the STFT domain
# --------------------------------------------------------------------------------------


def shape_noise(rng, n, env_fn, nperseg=1024):
    """White noise filtered by a (possibly time-varying) magnitude envelope env_fn(t_cols, f_bins)->[nb,nc]."""
    w = rng.standard_normal(n)
    f, t, Z = signal.stft(w, SR, window="hann", nperseg=nperseg, noverlap=nperseg * 3 // 4)
    Z = Z * env_fn(t, f)
    _, y = signal.istft(Z, SR, window="hann", nperseg=nperseg, noverlap=nperseg * 3 // 4)
    y = y[:n] if len(y) >= n else np.pad(y, (0, n - len(y)))
    return y


def tract_env(F, B, G, t_frames):
    """Noise envelope = |vocal tract response| evaluated on STFT bins (time-interpolated formants)."""
    def env(tc, fb):
        nc = len(tc)
        Fc = np.stack([np.interp(tc, t_frames, F[:, i]) for i in range(F.shape[1])], axis=1)
        Bc = np.stack([np.interp(tc, t_frames, B[:, i]) for i in range(B.shape[1])], axis=1)
        Gc = np.stack([np.interp(tc, t_frames, G[:, i]) for i in range(G.shape[1])], axis=1)
        freqs = np.tile(fb[None, :], (nc, 1))
        return np.abs(vt_response(freqs, Fc, Bc, Gc)).T
    return env


def band_env(lo, hi, lo_order=2, hi_order=2):
    """Static band-pass magnitude envelope (frication)."""
    def env(tc, fb):
        fb = np.maximum(fb, 1.0)
        m = 1.0 / np.sqrt(1.0 + (lo / fb) ** (2 * lo_order)) / np.sqrt(1.0 + (fb / hi) ** (2 * hi_order))
        return np.tile(m[:, None], (1, len(tc)))
    return env


# --------------------------------------------------------------------------------------
# effects
# --------------------------------------------------------------------------------------


def softclip(x, drive, bias=0.0, os=4):
    """tanh waveshaper at os-times oversampling (limits aliasing). Input is peak-normalised first."""
    pk = np.max(np.abs(x)) + 1e-12
    xo = signal.resample_poly(x / pk, os, 1)
    y = np.tanh(drive * (xo + bias)) - np.tanh(drive * bias)
    y = signal.resample_poly(y, 1, os)
    y = y[: len(x)] if len(y) >= len(x) else np.pad(y, (0, len(x) - len(y)))
    return y / (np.max(np.abs(y)) + 1e-12)


def room(x, rng, rt60=0.32, wet=0.14, tail=0.35, damp_hz=5200.0):
    """Tiny synthetic room: early reflections + exponentially decaying filtered noise."""
    n_ir = int((rt60 * 1.2) * SR)
    t = np.arange(n_ir) / SR
    ir = rng.standard_normal(n_ir) * np.exp(-6.91 * t / rt60)
    ir = lowpass_sos(ir, damp_hz, 2)
    ir[: int(0.011 * SR)] = 0.0
    for dly, g in ((0.007, 0.5), (0.013, 0.38), (0.021, 0.3), (0.031, 0.22)):
        ir[int(dly * SR)] += g * np.std(ir) * 6.0 * (1 if rng.random() > 0.5 else -1)
    ir /= math.sqrt(float(np.sum(ir ** 2)))
    n_out = len(x) + int(tail * SR)
    xp = np.pad(x, (0, n_out - len(x)))
    w = signal.fftconvolve(xp, ir)[:n_out]
    # keep wet level relative to the dry RMS
    w *= wet * (np.sqrt(np.mean(xp ** 2)) / (np.sqrt(np.mean(w ** 2)) + 1e-12))
    return xp + w


def finish(x, fade_in=0.010, fade_out=0.05, hp=45.0, lp=17000.0, peak_db=PEAK_DB):
    """DC removal, HP/LP, fades, normalise to peak_db."""
    x = x - np.mean(x)
    x = highpass_sos(x, hp, 2)
    x = lowpass_sos(x, lp, 4)
    n = len(x)
    fi = int(fade_in * SR)
    fo = int(fade_out * SR)
    env = np.ones(n)
    env[:fi] = 0.5 - 0.5 * np.cos(np.pi * np.arange(fi) / fi)
    env[n - fo:] = 0.5 + 0.5 * np.cos(np.pi * np.arange(fo) / fo)
    x = x * env
    x = x - np.mean(x)
    return x * (undb(peak_db) / (np.max(np.abs(x)) + 1e-12))


# --------------------------------------------------------------------------------------
# voice assembly
# --------------------------------------------------------------------------------------


class VoiceSpec:
    """Container for one voiced layer (everything per-sample unless noted)."""

    def __init__(self, f0, amp, F, B, G, p, fg_ratio=1.4, fmax=14000.0, sub_m=None, am=None,
                 shimmer=0.0, breath_db=-14.0, breath_amp=None, rng=None, pulse_depth=0.6):
        self.f0, self.amp, self.F, self.B, self.G, self.p = f0, amp, F, B, G, p
        self.fg_ratio, self.fmax = fg_ratio, fmax
        self.sub_m, self.am, self.shimmer = sub_m, am, shimmer
        self.breath_db, self.breath_amp, self.rng = breath_db, breath_amp, rng
        self.pulse_depth = pulse_depth


def render_voice(v: VoiceSpec, t_frames):
    n = len(v.f0)
    y, phi = harmonic_synth(v.f0, v.F, v.B, v.G, v.p, v.fg_ratio, v.fmax)
    if v.sub_m is not None:                                   # period doubling (alternate cycles differ)
        y = y * (1.0 + v.sub_m * np.cos(np.pi * phi))
    if v.am is not None:                                       # low rate AM growl (array already 1+depth*noise)
        y = y * v.am
    y = unit_rms(y)
    if v.shimmer > 0:
        y = y * (1.0 + v.shimmer * smooth_noise(v.rng, n, 95.0))
    out = y * v.amp
    if v.breath_amp is not None:
        nz = shape_noise(v.rng, n, tract_env(v.F, v.B, v.G, t_frames))
        nz = unit_rms(nz)
        # aspiration noise is strongest in the open phase of every glottal cycle
        nz = nz * (1.0 + v.pulse_depth * np.cos(2 * np.pi * phi - 0.6)) / (1.0 + 0.5 * v.pulse_depth ** 2) ** 0.5
        out = out + nz * v.breath_amp * undb(v.breath_db)
    return out, phi


def sob_events(rng, start, end, mean_gap, spread):
    ts = []
    t = start
    while t < end:
        ts.append(t)
        t += rng.uniform(mean_gap - spread, mean_gap + spread)
    return np.array(ts)


def per_event(t, ev):
    """For each sample time: index of the latest event (or -1), time since that event."""
    idx = np.searchsorted(ev, t, side="right") - 1
    dt = np.where(idx >= 0, t - ev[np.clip(idx, 0, None)], -1.0)
    return idx, dt


# --------------------------------------------------------------------------------------
# the sounds
# --------------------------------------------------------------------------------------

DESIGN = {}     # name -> dict(t, f0, amp, ...) designed contours kept for the analysis report


def make_cry(seed, variant):
    rng = np.random.default_rng(seed)
    if variant == 1:
        D, f0_pts = 3.30, [(0, 168), (0.5, 186), (1.2, 226), (1.9, 252), (2.6, 214), (3.3, 150)]
        gap, spread, scale = 0.50, 0.075, 1.12
        vow_a, vow_b = (800, 1260, 2850), (520, 940, 2650)
        nasal = 0.0
    else:
        D, f0_pts = 2.95, [(0, 206), (0.4, 236), (1.0, 192), (1.7, 258), (2.3, 205), (2.95, 146)]
        gap, spread, scale = 0.44, 0.07, 1.08
        vow_a, vow_b = (640, 1880, 2650), (470, 1300, 2500)    # e / schwa-ish "eh -> uh"
        nasal = 1.0
    tail = 0.36
    n = int((D + tail) * SR)
    t = np.arange(n) / SR
    tf = frame_times(n)

    ev = sob_events(rng, 0.10, D - 0.35, gap, spread)
    n_ev = len(ev)
    amps = rng.uniform(0.68, 1.0, n_ev)
    amps[-1] *= 0.8
    pitch_off = rng.uniform(-0.05, 0.05, n_ev)
    taus = rng.uniform(0.17, 0.26, n_ev)
    ends = np.append(ev[1:], D + 0.05) - ev - 0.115            # voicing ends before the next sob (inhale gap)
    ends = np.clip(ends, 0.22, 0.55)
    idx, dt = per_event(t, ev)
    ii = np.clip(idx, 0, n_ev - 1)
    valid = (idx >= 0)

    # --- amplitude: sob pulses on a macro swell
    attack = smoothstep(dt / 0.06)
    decay = np.exp(-np.clip(dt, 0, None) / taus[ii])
    release = 1.0 - smoothstep((dt - (ends[ii] - 0.07)) / 0.07)
    pulse = valid * attack * (0.18 + 0.82 * decay) * release * amps[ii]
    macro = curve(t, [(0, 0.62), (0.9, 0.86), (1.9, 1.0), (D, 0.62)])
    amp = pulse * macro

    # --- pitch
    base = curve(t, f0_pts)
    flick = 0.09 * np.exp(-np.clip(dt, 0, None) / 0.06)
    fall = -0.16 * smoothstep(np.clip(dt, 0, None) / 0.5)
    f0 = base * (1.0 + flick + fall + pitch_off[ii]) * valid + base * (~valid)
    # voice cracks (short jumps into falsetto)
    for tc, wc, ratio in ((1.28 * D / 3.3, 0.06, 1.42), (2.35 * D / 3.3, 0.05, 1.35)):
        f0 = f0 * (1.0 + (ratio - 1.0) * smoothstep((1 - np.abs(t - tc) / wc)))
    vib_depth = 0.02 * smoothstep(dt / 0.25) + 0.004
    vib = vib_depth * np.sin(2 * np.pi * np.cumsum(5.4 + 0.5 * smooth_noise(rng, n, 2.0)) / SR)
    f0 = f0 * (1.0 + vib + 0.02 * smooth_noise(rng, n, 3.0) + 0.006 * smooth_noise(rng, n, 120.0))
    f0 = movavg(f0, 0.012)

    # --- vocal tract: vowel glides a -> b inside every sob
    glide = smoothstep(np.clip(dt, 0, None) / 0.38)
    glide_f = at_frames(glide, n)
    F1 = vow_a[0] + (vow_b[0] - vow_a[0]) * glide_f
    F2 = vow_a[1] + (vow_b[1] - vow_a[1]) * glide_f
    F3 = vow_a[2] + (vow_b[2] - vow_a[2]) * glide_f
    f0_fr = at_frames(f0, n)
    F1 = F1 + 0.35 * np.clip(f0_fr - 200, -60, 120)
    f3 = np.stack([F1, F2, F3], axis=1)
    F, B, G = tract_arrays(tf, lambda tt: f3, scale=scale,
                           gains=[0, 0, 0, -1, -3, -5, -7])
    if nasal > 0:                                              # nasal murmur: broad low formant, shallow F2
        F[:, 0] = 0.8 * F[:, 0] + 0.2 * 300
        B[:, 0] = B[:, 0] * 1.6
        G[:, 1] = -3.0
    loud_f = at_frames(amp / (amp.max() + 1e-9), n)
    p = 2.7 - 0.9 * loud_f                                      # louder -> more strained / brighter
    sub_m = 0.06 * amp / (amp.max() + 1e-9)
    voiced = VoiceSpec(f0, amp, F, B, G, p, fg_ratio=1.35, fmax=12000.0, sub_m=sub_m, shimmer=0.05,
                       breath_db=-11.0, breath_amp=amp ** 0.7, rng=rng)
    y, phi = render_voice(voiced, tf)

    # --- inhale between sobs ("hic" breaths)
    inh = np.zeros(n)
    for i in range(n_ev):
        c = ev[i] + ends[i] + 0.03 + 0.012
        inh += amps[i] * np.exp(-((t - c) / 0.042) ** 2)
    inh_F = np.tile([620.0, 1550.0, 2600.0, 3600.0, 4700.0, 6000.0, 7800.0], (len(tf), 1)) * 1.05
    inh_B = np.tile([260.0, 380.0, 480.0, 600.0, 800.0, 1000.0, 1200.0], (len(tf), 1))
    nzi = shape_noise(rng, n, tract_env(inh_F, inh_B, np.zeros_like(inh_F), tf))
    nzi = highpass_sos(unit_rms(nzi, 0.1), 260.0, 2)
    y = y + nzi * inh * undb(-12.0) * macro

    y = compress_down(y, 65.0, 0.55)
    y = room(y, rng, rt60=0.30, wet=0.13, tail=0.0)
    y = finish(y, fade_in=0.006, fade_out=0.06)
    DESIGN[f"cry{variant}"] = dict(t=t, f0=f0, amp=amp)
    return y


# --------------------------------------------------------------------------------------
# analysis: levels, loudness, F0 (autocorrelation), centroid, formants (LPC), spectrograms
# --------------------------------------------------------------------------------------


def k_weight(x):
    """ITU-R BS.1770 K-weighting (pre-filter high shelf + RLB high-pass), coefficients designed for SR."""
    # high shelf
    G, Q, fc = 3.999843853973347, 0.7071752369554196, 1681.9744509555319
    K = math.tan(math.pi * fc / SR)
    Vh = 10 ** (G / 20.0)
    Vb = Vh ** 0.4996667741545416
    a0 = 1.0 + K / Q + K * K
    b = [(Vh + Vb * K / Q + K * K) / a0, 2.0 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a = [1.0, 2.0 * (K * K - 1.0) / a0, (1.0 - K / Q + K * K) / a0]
    y = signal.lfilter(b, a, x)
    # RLB high-pass
    Q2, fc2 = 0.5003270373238773, 38.13547087613982
    K = math.tan(math.pi * fc2 / SR)
    a0 = 1.0 + K / Q2 + K * K
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, 2.0 * (K * K - 1.0) / a0, (1.0 - K / Q2 + K * K) / a0]
    return signal.lfilter(b2, a2, y)


def lufs(x):
    """Integrated loudness (BS.1770-4 gating) of a mono signal; short files are zero-padded to >= 0.4 s."""
    if len(x) < int(0.4 * SR):
        x = np.pad(x, (0, int(0.4 * SR) - len(x)))
    z = k_weight(x) ** 2
    blk, step = int(0.4 * SR), int(0.1 * SR)
    ms = np.array([z[i:i + blk].mean() for i in range(0, len(z) - blk + 1, step)])
    l = -0.691 + 10 * np.log10(ms + 1e-14)
    g1 = ms[l > -70.0]
    if len(g1) == 0:
        return -70.0
    rel = -0.691 + 10 * np.log10(g1.mean()) - 10.0
    g2 = ms[l > rel]
    return float(-0.691 + 10 * np.log10(g2.mean() + 1e-14)) if len(g2) else -70.0


def f0_track(x, times, fmin, fmax, win_s=0.046, thr=0.35):
    """Autocorrelation F0 estimate at the given times -> list of (Hz or None, strength)."""
    out = []
    w = int(win_s * SR)
    lo, hi = int(SR / fmax), int(SR / fmin)
    for tt in times:
        c = int(tt * SR)
        seg = x[max(0, c - w // 2): c + w // 2]
        if len(seg) < w:
            out.append((None, 0.0))
            continue
        seg = seg * np.hanning(len(seg))
        seg = seg - seg.mean()
        ac = signal.fftconvolve(seg, seg[::-1])[len(seg) - 1:]
        if ac[0] <= 1e-9:
            out.append((None, 0.0))
            continue
        ac = ac / ac[0]
        # normalise for the shrinking overlap
        ac = ac / (1.0 - np.arange(len(ac)) / len(ac))
        seg_ac = ac[lo: min(hi, len(ac) - 2)]
        if len(seg_ac) < 3:
            out.append((None, 0.0))
            continue
        peak = seg_ac.max()
        # first local maximum that reaches 85 % of the global one (avoids picking sub-multiples)
        cand = [i for i in range(1, len(seg_ac) - 1)
                if seg_ac[i] >= seg_ac[i - 1] and seg_ac[i] > seg_ac[i + 1] and seg_ac[i] >= 0.85 * peak]
        if not cand or peak < thr:
            out.append((None, float(peak)))
            continue
        i = cand[0]
        a, b, cc = seg_ac[i - 1], seg_ac[i], seg_ac[i + 1]
        d = 0.5 * (a - cc) / (a - 2 * b + cc + 1e-12)
        out.append((SR / (lo + i + d), float(b)))
    return out


def spectral_centroid(x, t0=None, t1=None):
    if t0 is not None:
        x = x[int(t0 * SR): int(t1 * SR)]
    X = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return float(np.sum(f * X) / (np.sum(X) + 1e-12))


def band_energy(x, t0, t1, lo, hi):
    seg = x[int(t0 * SR): int(t1 * SR)]
    X = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / SR)
    tot = X.sum() + 1e-18
    return float(X[(f >= lo) & (f < hi)].sum() / tot)


def lpc_formants(x, tc, order=14, win_s=0.035, fs_work=11025):
    """Rough LPC formant estimate around time tc (works for F0 below ~350 Hz)."""
    y = signal.resample_poly(x, fs_work, SR)
    c = int(tc * fs_work)
    w = int(win_s * fs_work)
    seg = y[max(0, c - w // 2): c + w // 2]
    if len(seg) < w - 2:
        return []
    seg = np.append(seg[0], seg[1:] - 0.97 * seg[:-1]) * np.hamming(len(seg))
    r = signal.fftconvolve(seg, seg[::-1])[len(seg) - 1: len(seg) + order]
    if r[0] < 1e-9:
        return []
    a = solve_toeplitz(r[:order] + 1e-9 * r[0] * (np.arange(order) == 0), -r[1:order + 1])
    roots = np.roots(np.concatenate([[1.0], a]))
    roots = roots[np.imag(roots) > 0.01]
    fr = np.angle(roots) * fs_work / (2 * np.pi)
    bw = -np.log(np.abs(roots)) * fs_work / np.pi
    sel = sorted((f, b) for f, b in zip(fr, bw) if 200 < f < 5000 and b < 400)
    return [(round(f), round(b)) for f, b in sel]


def envelope_peaks(x, t0, t1, n_peaks=4, lifter_hz=None):
    """Peaks of the cepstrally smoothed log spectrum in [t0,t1] (formant-like bumps), Hz."""
    seg = x[int(t0 * SR): int(t1 * SR)]
    N = 8192
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), N)) + 1e-9
    cep = np.fft.irfft(np.log(spec))
    L = int(SR / (lifter_hz or 450.0))
    lift = np.zeros_like(cep)
    lift[:L] = 1
    lift[-L + 1:] = 1
    env = np.real(np.fft.rfft(cep * lift))
    f = np.fft.rfftfreq(N, 1 / SR)
    pk, _ = signal.find_peaks(env[(f > 100) & (f < 9000)], prominence=0.15)
    fs = f[(f > 100) & (f < 9000)][pk]
    return [int(v) for v in fs[:n_peaks]]



def sob_rate(x, t0, t1):
    """Dominant modulation frequency (Hz) of the 30 ms RMS envelope in 0.8..5 Hz and the number of envelope peaks."""
    env = np.sqrt(np.maximum(movavg(x * x, 0.03), 0.0))
    e = env[int(t0 * SR): int(t1 * SR): 221]            # ~200 Hz
    e0 = e - e.mean()
    N = 8192
    F = np.abs(np.fft.rfft(e0 * np.hanning(len(e0)), N))
    f = np.fft.rfftfreq(N, 1.0 / (SR / 221.0))
    band = (f > 0.8) & (f < 5.0)
    dom = float(f[band][np.argmax(F[band])])
    pk, _ = signal.find_peaks(e, prominence=0.25 * e.max(), distance=int(0.25 * SR / 221))
    return dom, int(len(pk)), float(len(pk) / ((t1 - t0)))


def harmonic_levels(x, tc, f0, K=10, win_s=0.08):
    """Level (dB re strongest) of the first K harmonics of f0 around time tc."""
    c = int(tc * SR)
    w = int(win_s * SR)
    seg = x[c - w // 2: c + w // 2]
    N = 1 << 17
    X = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), N))
    f = np.fft.rfftfreq(N, 1 / SR)
    lv = []
    for k in range(1, K + 1):
        m = (f > k * f0 * 0.96) & (f < k * f0 * 1.04)
        lv.append(float(X[m].max()))
    lv = np.array(lv)
    return [round(float(v), 1) for v in 20 * np.log10(lv / lv.max() + 1e-12)]


def compress_down(x, ref_pct=70.0, amount=0.5, win=0.03):
    """Gentle downward compressor (no distortion): lowers parts louder than the ref percentile of the RMS envelope."""
    env = np.sqrt(np.maximum(movavg(x * x, win), 0.0)) + 1e-9
    ref = np.percentile(env, ref_pct)
    g = np.minimum(1.0, ref / env) ** amount
    return x * g


_CMAP = [(0.0, (4, 4, 16)), (0.2, (40, 12, 90)), (0.4, (120, 28, 110)), (0.6, (205, 60, 70)),
         (0.8, (250, 150, 30)), (1.0, (252, 250, 190))]


def _colormap(v):
    v = np.clip(v, 0, 1)
    xs = [c[0] for c in _CMAP]
    out = np.zeros(v.shape + (3,))
    for ch in range(3):
        out[..., ch] = np.interp(v, xs, [c[1][ch] for c in _CMAP])
    return out.astype(np.uint8)


def spectrogram_png(x, path, title, fmax=10000.0, f0_overlay=None):
    """Spectrogram (top) + waveform (bottom) as PNG, drawn with PIL only."""
    from PIL import Image, ImageDraw, ImageFont
    nper = 1024
    f, t, S = signal.spectrogram(x, SR, window="hann", nperseg=nper, noverlap=nper * 7 // 8, mode="magnitude")
    sdb = 20 * np.log10(S + 1e-7)
    top = sdb.max()
    img = np.clip((sdb - (top - 78.0)) / 78.0, 0, 1)
    sel = f <= fmax
    img = img[sel][::-1]
    rgb = _colormap(img)
    W, Hs = 1100, 420
    spec = Image.fromarray(rgb).resize((W, Hs), Image.BILINEAR)
    left, top_m, bot_m, right = 62, 34, 30, 12
    wave_h = 80
    canvas = Image.new("RGB", (W + left + right, Hs + wave_h + top_m + bot_m + 14), (16, 16, 20))
    canvas.paste(spec, (left, top_m))
    d = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.load_default(size=13)
    except TypeError:
        font = ImageFont.load_default()
    d.text((left, 8), title, fill=(235, 235, 235), font=font)
    dur = len(x) / SR
    for fk in np.arange(0, fmax + 1, 1000 if fmax <= 12000 else 2000):
        y = top_m + Hs - int(fk / fmax * Hs)
        d.line([(left - 4, y), (left + W, y)], fill=(70, 70, 80) if fk else (200, 200, 200), width=1)
        d.text((8, y - 7), f"{int(fk / 1000)}k", fill=(220, 220, 220), font=font)
    step = 0.5
    for tk in np.arange(0, dur + 1e-6, step):
        xx = left + int(tk / dur * W)
        d.line([(xx, top_m), (xx, top_m + Hs + 4)], fill=(70, 70, 80), width=1)
        d.text((xx - 8, top_m + Hs + 6), f"{tk:.1f}", fill=(220, 220, 220), font=font)
    if f0_overlay is not None:
        tt, ff = f0_overlay
        pts = [(left + int(a / dur * W), top_m + Hs - int(b / fmax * Hs)) for a, b in zip(tt, ff)
               if b is not None and b < fmax]
        for p0 in pts:
            d.ellipse([p0[0] - 1, p0[1] - 1, p0[0] + 1, p0[1] + 1], outline=(80, 255, 120))
    # waveform strip
    wy0 = top_m + Hs + 24
    d.rectangle([left, wy0, left + W, wy0 + wave_h], outline=(90, 90, 100))
    cols = np.array_split(x, W)
    for i, c in enumerate(cols):
        if len(c) == 0:
            continue
        lo_, hi_ = c.min(), c.max()
        d.line([(left + i, wy0 + wave_h / 2 - hi_ * wave_h / 2), (left + i, wy0 + wave_h / 2 - lo_ * wave_h / 2)],
               fill=(110, 200, 255))
    canvas.convert('P', palette=Image.ADAPTIVE, colors=128).save(path, optimize=True)


def analyze_signal(name, x, f0_range, times, design=None):
    """Return a dict of measurements for decoded signal x (float, +-1)."""
    r = {}
    r["duration_s"] = round(len(x) / SR, 3)
    r["peak_dbfs"] = round(db(np.max(np.abs(x))), 2)
    r["rms_dbfs"] = round(db(np.sqrt(np.mean(x ** 2))), 2)
    r["crest_db"] = round(r["peak_dbfs"] - r["rms_dbfs"], 2)
    r["lufs_integrated"] = round(lufs(x), 2)
    r["dc_offset"] = float(f"{np.mean(x):.2e}")
    r["clipped_samples"] = int(np.sum(np.abs(x) >= 0.999))
    e = int(0.002 * SR)
    r["max_abs_first_2ms"] = float(f"{np.max(np.abs(x[:e])):.2e}")
    r["max_abs_last_2ms"] = float(f"{np.max(np.abs(x[-e:])):.2e}")
    r["spectral_centroid_hz"] = round(spectral_centroid(x))
    r["band_fraction_0_500_500_2k_2k_6k_6k_up"] = [round(band_energy(x, 0, len(x) / SR, lo, hi), 3)
                                                   for lo, hi in ((0, 500), (500, 2000), (2000, 6000), (6000, 22050))]
    tr = f0_track(x, times, *f0_range)
    r["f0_autocorr"] = [{"t": round(tt, 2), "f0": (round(v[0], 1) if v[0] else None), "r": round(v[1], 2)}
                        for tt, v in zip(times, tr)]
    return r



def f_tract(f0_fr, base, k1=0.30, k2=0.45, k3=0.35, ref=400.0):
    """Formants that follow F0 upward (shouting: F1/F2/F3 are pulled towards the harmonics)."""
    d = f0_fr - ref
    return np.stack([base[0] + k1 * d, base[1] + k2 * d, base[2] + k3 * d], axis=1)


def make_scream(seed=3303):
    rng = np.random.default_rng(seed)
    D, tail = 4.0, 0.30
    n = int((D + tail) * SR)
    t = np.arange(n) / SR
    tf = frame_times(n)
    t_on = 0.58

    # ---- pitch: 400 -> ~1090 Hz ease-out sweep, vibrato, jitter, register cracks, final fall
    x = np.clip((t - t_on) / 2.3, 0.0, 1.0)
    sweep = (1.0 - np.exp(-1.7 * x)) / (1.0 - np.exp(-1.7))
    f0 = 400.0 + 690.0 * sweep
    f0 = f0 + 28.0 * smooth_noise(rng, n, 0.8) * smoothstep((t - t_on - 1.5) / 0.5)
    f0 = f0 * (0.86 + 0.14 * smoothstep((t - t_on) / 0.09))                      # onset scoop
    for tc, wc, ratio in ((1.30, 0.060, 1.20), (2.46, 0.050, 1.17), (3.02, 0.070, 0.82)):
        f0 = f0 * (1.0 + (ratio - 1.0) * smoothstep(1.0 - np.abs(t - tc) / wc))
    f0 = f0 * (1.0 - 0.38 * smoothstep((t - 3.28) / 0.55))                       # falling tail
    vib_d = 0.035 * smoothstep((t - t_on - 0.2) / 0.8)
    vib = vib_d * np.sin(2 * np.pi * np.cumsum(5.9 + 0.6 * smooth_noise(rng, n, 1.5)) / SR)
    f0 = f0 * (1.0 + vib + 0.012 * smooth_noise(rng, n, 160.0) + 0.012 * smooth_noise(rng, n, 4.0))
    f0 = movavg(f0, 0.006)

    # ---- amplitude
    amp = smoothstep((t - t_on) / 0.028) * (1.0 - smoothstep((t - 3.42) / 0.42))
    amp = amp * (1.0 + 0.30 * np.exp(-np.clip(t - t_on, 0, None) / 0.12)) * (1.0 + 0.07 * smooth_noise(rng, n, 7.0))
    amp = np.clip(amp, 0, None)

    # ---- tract + source
    f0_fr = at_frames(f0, n)
    f3 = f_tract(f0_fr, (880.0, 1650.0, 2900.0))
    F, B, G = tract_arrays(tf, lambda tt: f3, bw=[170.0, 210.0, 280.0],
                           hi=[4200.0, 5200.0, 6600.0, 8300.0], hi_bw=[420.0, 600.0, 800.0, 1000.0],
                           gains=[0, 0, 3, 7, 7, 6, 5])
    ramp = smoothstep((t - t_on - 0.4) / 1.6)
    p = np.full(len(tf), 1.30)
    sub_m = 0.10 + 0.35 * ramp
    rough = 1.0 + (0.20 + 0.25 * ramp) * smooth_noise(rng, n, 70.0)
    rough = np.clip(rough, 0.15, None)
    v = VoiceSpec(f0, amp, F, B, G, p, fg_ratio=1.6, fmax=16000.0, sub_m=sub_m, am=rough, shimmer=0.08,
                  breath_db=-9.0, breath_amp=amp, rng=rng, pulse_depth=0.8)
    y, _ = render_voice(v, tf)
    y = softclip(y, 4.5, bias=0.07)                                              # peak-normalised, distorted

    # ---- breath-in before the scream (quiet, noisy, rising)
    ih = smoothstep((t - 0.03) / 0.33) * (1.0 - smoothstep((t - 0.47) / 0.05))
    Fi = np.tile([700.0, 1500.0, 2600.0, 3700.0, 4800.0, 6200.0, 8000.0], (len(tf), 1))
    Bi = np.tile([300.0, 420.0, 520.0, 650.0, 850.0, 1100.0, 1300.0], (len(tf), 1))
    nzi = highpass_sos(unit_rms(shape_noise(rng, n, tract_env(Fi, Bi, np.zeros_like(Fi), tf)), 0.1), 220.0, 2)
    y = y + nzi * ih * 0.085 * (0.7 + 0.3 * smooth_noise(rng, n, 9.0))

    # ---- sibilant noise tail after the shriek
    te = np.clip(t - 3.48, 0, None)
    fe = smoothstep((t - 3.48) / 0.14) * np.exp(-te / 0.34)
    nzf = unit_rms(shape_noise(rng, n, band_env(3200.0, 9500.0)), 0.1)
    y = y + nzf * fe * 0.20 * (0.8 + 0.2 * smooth_noise(rng, n, 25.0))

    y = room(y, rng, rt60=0.42, wet=0.16, tail=0.0)
    y = finish(y, fade_in=0.004, fade_out=0.07)
    DESIGN["scream1"] = dict(t=t, f0=f0, amp=amp)
    return y


def make_rage(seed=4404):
    rng = np.random.default_rng(seed)
    D, tail = 2.45, 0.22
    n = int((D + tail) * SR)
    t = np.arange(n) / SR
    tf = frame_times(n)

    f0 = curve(t, [(0, 188), (0.3, 214), (0.9, 244), (1.5, 226), (2.0, 258), (2.45, 196)])
    f0 = f0 * (1.0 + 0.022 * np.sin(2 * np.pi * np.cumsum(6.4 + 0.8 * smooth_noise(rng, n, 2.0)) / SR)
               + 0.04 * smooth_noise(rng, n, 16.0) + 0.012 * smooth_noise(rng, n, 140.0))
    f0 = movavg(f0, 0.008)
    # growl bursts: amplitude flutters between ~0.6 and 1
    flut = np.clip(0.78 + 0.34 * smooth_noise(rng, n, 7.0), 0.30, 1.20)
    amp = smoothstep(t / 0.05) * (1.0 - smoothstep((t - 2.10) / 0.36)) * flut
    f0_fr = at_frames(f0, n)
    mix = at_frames(smoothstep(t / 1.6), n)[:, None]
    f3 = np.array([700.0, 1050.0, 2600.0])[None, :] * (1 - mix) + np.array([840.0, 1380.0, 2750.0])[None, :] * mix
    f3 = f3 + np.stack([0.4 * (f0_fr - 220), 0.2 * (f0_fr - 220), 0 * f0_fr], axis=1)
    F, B, G = tract_arrays(tf, lambda tt: f3, bw=[140.0, 190.0, 260.0], gains=[0, 0, 1, 2, 2, 1, 0])
    p = np.full(len(tf), 1.55)
    am_ph = np.cumsum(36.0 + 7.0 * smooth_noise(rng, n, 5.0)) / SR
    growl = 1.0 + 0.45 * np.sin(2 * np.pi * am_ph) * (0.6 + 0.4 * smooth_noise(rng, n, 4.0))
    v = VoiceSpec(f0, amp, F, B, G, p, fg_ratio=1.5, fmax=14000.0, sub_m=0.40 + 0 * t, am=np.clip(growl, 0.1, None),
                  shimmer=0.10, breath_db=-5.0, breath_amp=amp, rng=rng, pulse_depth=0.85)
    y1, _ = render_voice(v, tf)

    # high screech layer: three chirpy bursts on top
    amp2 = np.zeros(n)
    f02 = np.full(n, 700.0)
    for tc, wd, fa, fb in ((0.52, 0.30, 640.0, 930.0), (1.18, 0.34, 700.0, 990.0), (1.84, 0.38, 760.0, 1060.0)):
        u = np.clip((t - (tc - wd / 2)) / wd, 0, 1)
        shape = smoothstep(u / 0.2) * (1.0 - smoothstep((u - 0.75) / 0.25))
        amp2 += shape
        f02 = f02 * (1 - (u > 0) * (u < 1)) + (fa + (fb - fa) * u ** 0.8) * ((u > 0) * (u < 1))
    f02 = f02 * (1.0 + 0.03 * np.sin(2 * np.pi * np.cumsum(6.0 + 0 * t) / SR) + 0.012 * smooth_noise(rng, n, 150.0))
    f02 = movavg(f02, 0.005)
    f02_fr = at_frames(f02, n)
    f3b = f_tract(f02_fr, (760.0, 1800.0, 3000.0), 0.5, 0.5, 0.3, 700.0)
    F2_, B2_, G2_ = tract_arrays(tf, lambda tt: f3b, bw=[160.0, 220.0, 290.0],
                                 hi=[4300.0, 5400.0, 6800.0, 8500.0], hi_bw=[450.0, 650.0, 850.0, 1050.0],
                                 gains=[0, 0, 2, 3, 3, 2, 1])
    v2 = VoiceSpec(f02, amp2 * 0.9, F2_, B2_, G2_, np.full(len(tf), 1.35), fg_ratio=1.6, fmax=16000.0,
                   sub_m=0.30 + 0 * t, am=np.clip(1.0 + 0.3 * smooth_noise(rng, n, 60.0), 0.2, None),
                   shimmer=0.08, breath_db=-12.0, breath_amp=amp2, rng=rng)
    y2, _ = render_voice(v2, tf)
    y = y1 + 1.0 * y2
    y = softclip(y, 4.5, bias=0.05)
    y = room(y, rng, rt60=0.30, wet=0.12, tail=0.0)
    y = finish(y, fade_in=0.008, fade_out=0.08)
    DESIGN["rage1"] = dict(t=t, f0=f0, amp=amp, f0_hi=f02, amp_hi=amp2)
    return y


def make_hurt(seed=5505):
    rng = np.random.default_rng(seed)
    D, tail = 0.44, 0.14
    n = int((D + tail) * SR)
    t = np.arange(n) / SR
    tf = frame_times(n)
    f0 = curve(t, [(0, 205), (0.05, 258), (0.16, 232), (0.30, 178), (0.44, 118)])
    fry = smoothstep((t - 0.26) / 0.14)
    f0 = f0 * (1.0 + 0.018 * np.sin(2 * np.pi * np.cumsum(5.8 + 0 * t) / SR)
               + (0.012 + 0.10 * fry) * smooth_noise(rng, n, 110.0))
    f0 = movavg(f0, 0.004)
    amp = smoothstep(t / 0.014) * np.exp(-t / 0.30) * (1.0 - smoothstep((t - 0.34) / 0.10))
    vt = vowel((0.0, (660, 1180, 2600)), (0.2, (600, 1050, 2550)), (0.5, (480, 900, 2500)))
    F, B, G = tract_arrays(tf, vt, scale=1.05, gains=[0, 0, 0, -1, -2, -4, -6])
    p = 2.1 - 0.5 * (1.0 - fry[np.minimum(np.arange(len(tf)) * HOP, n - 1)])
    v = VoiceSpec(f0, amp, F, B, G, p, fg_ratio=1.4, fmax=11000.0, sub_m=0.05 + 0.5 * fry, shimmer=0.08,
                  breath_db=-12.0, breath_amp=amp, rng=rng)
    y, _ = render_voice(v, tf)
    y = softclip(y, 1.9, bias=0.04)
    y = room(y, rng, rt60=0.22, wet=0.10, tail=0.0)
    y = finish(y, fade_in=0.004, fade_out=0.05)
    DESIGN["hurt1"] = dict(t=t, f0=f0, amp=amp)
    return y


def make_death(seed=6606):
    rng = np.random.default_rng(seed)
    D, tail = 2.0, 0.34
    n = int((D + tail) * SR)
    t = np.arange(n) / SR
    tf = frame_times(n)
    t_on = 0.26
    f0 = curve(t, [(0, 330), (t_on, 330), (0.55, 392), (0.95, 305), (1.45, 205), (1.85, 138), (2.0, 98)])
    vd = 0.028 + 0.025 * smoothstep((t - 0.6) / 1.0)
    f0 = f0 * (1.0 + vd * np.sin(2 * np.pi * np.cumsum(5.1 + 0.4 * smooth_noise(rng, n, 1.5)) / SR)
               + 0.015 * smooth_noise(rng, n, 3.0) + (0.006 + 0.07 * smoothstep((t - 1.5) / 0.4)) * smooth_noise(rng, n, 120.0))
    f0 = movavg(f0, 0.008)
    amp = smoothstep((t - t_on) / 0.07) * curve(t, [(t_on, 0.9), (0.7, 1.0), (1.4, 0.72), (1.85, 0.34), (2.02, 0.0)])
    amp = amp * (1.0 + 0.08 * smooth_noise(rng, n, 6.0))
    vt = vowel((0.0, (780, 1250, 2800)), (0.9, (700, 1150, 2760)), (1.35, (520, 920, 2650)), (2.0, (350, 750, 2450)))
    F, B, G = tract_arrays(tf, vt, scale=1.08, bw=[100.0, 120.0, 170.0], gains=[0, 0, 0, -1, -3, -5, -7])
    breathy = at_frames(smoothstep((t - 1.0) / 1.0), n)
    p = 2.2 + 0.8 * breathy
    fry = smoothstep((t - 1.55) / 0.35)
    v = VoiceSpec(f0, amp, F, B, G, p, fg_ratio=1.35, fmax=12000.0, sub_m=0.04 + 0.55 * fry, shimmer=0.07,
                  breath_db=-9.0, breath_amp=amp ** 0.6, rng=rng)
    y, _ = render_voice(v, tf)
    y = softclip(y, 1.5, bias=0.03)
    # gasp at the start and a dying exhale at the end
    ih = smoothstep((t - 0.02) / 0.12) * (1.0 - smoothstep((t - 0.22) / 0.04))
    Fi = np.tile([650.0, 1500.0, 2600.0, 3600.0, 4700.0, 6000.0, 7800.0], (len(tf), 1))
    Bi = np.tile([280.0, 400.0, 500.0, 620.0, 820.0, 1000.0, 1200.0], (len(tf), 1))
    nzi = highpass_sos(unit_rms(shape_noise(rng, n, tract_env(Fi, Bi, np.zeros_like(Fi), tf)), 0.1), 220.0, 2)
    y = y + nzi * ih * 0.10
    ex = smoothstep((t - 1.7) / 0.2) * (1.0 - smoothstep((t - 2.05) / 0.25))
    Fe = np.tile([420.0, 1000.0, 2400.0, 3300.0, 4500.0, 5800.0, 7600.0], (len(tf), 1))
    Be = np.tile([240.0, 380.0, 520.0, 650.0, 850.0, 1000.0, 1200.0], (len(tf), 1))
    nze = unit_rms(shape_noise(rng, n, tract_env(Fe, Be, np.zeros_like(Fe), tf)), 0.1)
    y = y + nze * ex * 0.09
    y = room(y, rng, rt60=0.34, wet=0.14, tail=0.0)
    y = finish(y, fade_in=0.006, fade_out=0.10)
    DESIGN["death1"] = dict(t=t, f0=f0, amp=amp)
    return y


# --------------------------------------------------------------------------------------
# sound table -> sound_definitions.json / sounds.json (generated, canonical formatting)
# --------------------------------------------------------------------------------------

# id -> (category, min_distance, max_distance, [(file stem, volume)])
SOUND_TABLE = {
    "mob.scp096.cry":    ("neutral", 0.0, 32.0, [("cry1", 1.0), ("cry2", 1.0)]),
    "mob.scp096.scream": ("hostile", 0.0, 80.0, [("scream1", 0.9)]),
    "mob.scp096.rage":   ("hostile", 0.0, 48.0, [("rage1", 0.85)]),
    "mob.scp096.hurt":   ("neutral", 0.0, 24.0, [("hurt1", 1.0)]),
    "mob.scp096.death":  ("neutral", 0.0, 40.0, [("death1", 1.0)]),
}
# built-in Minecraft sounds that can replace each custom sound (documented in the guide, NOT shipped)
FALLBACK = {
    "mob.scp096.cry":    ("mob.ghast.moan",    "mob.wolf.whine"),
    "mob.scp096.scream": ("mob.ghast.scream",  "mob.endermen.scream"),
    "mob.scp096.rage":   ("mob.endermen.scream", "mob.warden.roar"),
    "mob.scp096.hurt":   ("mob.endermen.hit",  "mob.zombie.hurt"),
    "mob.scp096.death":  ("mob.ghast.death",   "mob.endermen.death"),
}
VANILLA_RP = Path("/home/user/mojang/bedrock-samples/resource_pack")

ENTITY_ID = "scp:scp096"
SOUND_PATH_PREFIX = "sounds/mob/scp096/"

BUILDERS = {
    "cry1": lambda: make_cry(1101, 1),
    "cry2": lambda: make_cry(2202, 2),
    "scream1": make_scream,
    "rage1": make_rage,
    "hurt1": make_hurt,
    "death1": make_death,
}

# per file: (f0 search range Hz, analysis times s, formant (LPC) times s or [])
ANALYSIS = {
    "cry1": ((100, 400), [0.2, 0.4, 0.7, 1.2, 1.5, 1.9, 2.3, 2.7, 3.0], [0.25, 0.75, 1.75, 2.75]),
    "cry2": ((100, 400), [0.2, 0.35, 0.7, 1.2, 1.55, 1.95, 2.4, 2.65], [0.2, 0.7, 1.6, 2.5]),
    "scream1": ((250, 1500), [0.7, 0.9, 1.2, 1.6, 2.0, 2.5, 3.0, 3.3, 3.6], []),
    "rage1": ((100, 1300), [0.2, 0.5, 0.9, 1.2, 1.5, 1.9, 2.2], []),
    "hurt1": ((80, 400), [0.03, 0.08, 0.15, 0.22, 0.3, 0.36], [0.06, 0.2]),
    "death1": ((70, 500), [0.35, 0.6, 0.9, 1.2, 1.5, 1.75, 1.9], [0.45, 0.9, 1.4]),
}


def canon(obj):
    return json.dumps(obj, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def sound_definitions_obj():
    sd = {}
    for sid, (cat, mn, mx, files) in SOUND_TABLE.items():
        sd[sid] = {
            "category": cat,
            "max_distance": mx,
            "min_distance": mn,
            "sounds": [{"load_on_low_memory": True, "name": SOUND_PATH_PREFIX + stem, "volume": vol}
                       for stem, vol in files],
        }
    return {"format_version": "1.14.0", "sound_definitions": sd}


def sounds_json_obj():
    return {"entity_sounds": {"entities": {ENTITY_ID: {
        "events": {"death": "mob.scp096.death", "hurt": "mob.scp096.hurt"},
        "pitch": [0.9, 1.1],
        "volume": 1.0,
    }}}}


def write_json_files():
    SOUND_DEFS.parent.mkdir(parents=True, exist_ok=True)
    SOUND_DEFS.write_text(canon(sound_definitions_obj()), encoding="utf-8", newline="\n")
    SOUNDS_JSON.write_text(canon(sounds_json_obj()), encoding="utf-8", newline="\n")


# --------------------------------------------------------------------------------------
# encode / decode / probe
# --------------------------------------------------------------------------------------


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"command failed: {' '.join(cmd)}\n{r.stderr}")
    return r.stdout


def encode_ogg(wav_path: Path, ogg_path: Path):
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav_path),
         "-map_metadata", "-1", "-ac", "1", "-ar", str(SR), "-c:a", "libvorbis", "-q:a", QUALITY,
         "-fflags", "+bitexact", "-flags:a", "+bitexact", str(ogg_path)])


def decode_ogg(ogg_path: Path):
    with tempfile.TemporaryDirectory() as td:
        w = Path(td) / "d.wav"
        run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(ogg_path),
             "-f", "wav", "-acodec", "pcm_s16le", "-ac", "1", "-ar", str(SR), str(w)])
        sr, x = wavfile.read(str(w))
    assert sr == SR
    return x.astype(np.float64) / 32768.0


def probe(ogg_path: Path):
    out = run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
               "stream=codec_name,channels,sample_rate,duration,bit_rate:format=format_name,size",
               "-of", "json", str(ogg_path)])
    return json.loads(out)


def snr_after_alignment(ref, dec, max_lag=4096):
    n = min(len(ref), len(dec))
    ref, dec = ref[:n], dec[:n]
    seg = slice(int(0.1 * SR), int(0.1 * SR) + 20000) if n > 30000 else slice(0, n)
    c = signal.fftconvolve(dec[seg], ref[seg][::-1])
    lag = int(np.argmax(c)) - (len(ref[seg]) - 1)
    lag = max(-max_lag, min(max_lag, lag))
    if lag >= 0:
        a, b = ref[: n - lag], dec[lag:]
    else:
        a, b = ref[-lag:], dec[: n + lag]
    m = min(len(a), len(b))
    a, b = a[:m], b[:m]
    g = float(np.dot(a, b) / (np.dot(a, a) + 1e-18))      # decoder output vs (gain-adjusted) source
    err = b - g * a
    return float(10 * np.log10(np.sum((g * a) ** 2) / (np.sum(err ** 2) + 1e-18))), lag


# --------------------------------------------------------------------------------------
# commands
# --------------------------------------------------------------------------------------


def encode_to_target(x, wav, ogg):
    """Encode x; re-scale so that the *decoded* ogg peaks at PEAK_DB (+-0.15 dB). Returns (gain, decoded)."""
    gain = 1.0
    for _ in range(4):
        wavfile.write(str(wav), SR, np.round(x * gain * 32767.0).astype(np.int16))
        encode_ogg(wav, ogg)
        dec = decode_ogg(ogg)
        err = PEAK_DB - db(np.max(np.abs(dec)))
        if abs(err) <= 0.15:
            break
        gain *= undb(err)
    return gain, dec


def cmd_build(args):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    originals = {}
    with tempfile.TemporaryDirectory() as td:
        for stem, fn in BUILDERS.items():
            x = fn()
            assert np.all(np.isfinite(x)) and np.max(np.abs(x)) < 0.9999, stem
            wav = Path(td) / f"{stem}.wav"
            ogg = OUT_DIR / f"{stem}.ogg"
            gain, dec = encode_to_target(x, wav, ogg)
            originals[stem] = x * gain
            # determinism: a second encode of the same wav must be byte-identical
            ogg2 = Path(td) / f"{stem}.again.ogg"
            encode_ogg(wav, ogg2)
            same = ogg.read_bytes() == ogg2.read_bytes()
            print(f"{stem}: {len(x) / SR:.2f}s gain {db(gain):+.2f} dB -> {ogg.stat().st_size} bytes, "
                  f"decoded peak {db(np.max(np.abs(dec))):.2f} dBFS, re-encode identical: {same}")
    write_json_files()
    cmd_analyze(args, originals)


def cmd_analyze(args, originals=None):
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    report = {}
    total = 0
    for stem in BUILDERS:
        ogg = OUT_DIR / f"{stem}.ogg"
        pr = probe(ogg)
        st = pr["streams"][0]
        x = decode_ogg(ogg)
        f0r, times, ftimes = ANALYSIS[stem]
        a = analyze_signal(stem, x, f0r, times)
        a["file_bytes"] = ogg.stat().st_size
        total += ogg.stat().st_size
        a["codec"] = st["codec_name"]
        a["channels"] = st["channels"]
        a["sample_rate"] = int(st["sample_rate"])
        a["bit_rate"] = int(st.get("bit_rate", 0))
        a["md5"] = hashlib.md5(ogg.read_bytes()).hexdigest()
        # designed contour for comparison (re-synthesise to read DESIGN)
        ref = originals[stem] if originals else BUILDERS[stem]()
        a["roundtrip_snr_db"], a["roundtrip_lag_samples"] = [round(v, 2) for v in snr_after_alignment(ref, x)]
        d = DESIGN.get(stem)
        if d is not None:
            for row in a["f0_autocorr"]:
                i = min(int(row["t"] * SR), len(d["f0"]) - 1)
                row["designed_f0"] = round(float(d["f0"][i]), 1)
                row["designed_amp"] = round(float(d["amp"][i] / (np.max(d["amp"]) + 1e-12)), 2)
                if row["designed_amp"] < 0.15:
                    row["designed_unvoiced_gap"] = True      # inhale / pause: measured F0 is meaningless here
        if ftimes:
            a["lpc_formants_hz_bw"] = {f"{tc:.2f}s": lpc_formants(x, tc) for tc in ftimes}
        a["envelope_peaks_hz"] = {}
        for lo, hi in ((0.15, 0.35),) if stem.startswith("cry") else ((1.0, 1.6),) if stem == "scream1" else ((0.3, 0.8),):
            if hi * SR <= len(x):
                a["envelope_peaks_hz"][f"{lo:.2f}-{hi:.2f}s"] = envelope_peaks(x, lo, hi)
        for row in a["f0_autocorr"]:
            if row["r"] < 0.5:
                row["low_confidence"] = True
        if stem.startswith("cry"):
            dom, cnt, rate = sob_rate(x, 0.1, len(x) / SR - 0.4)
            a["sob_modulation_peak_hz"] = round(dom, 2)
            a["sob_envelope_peaks"] = cnt
            a["sob_peaks_per_second"] = round(rate, 2)
        if stem == "scream1" and d is not None:
            a["harmonic_levels_db_re_strongest"] = {}
            for tc in (0.9, 1.6, 2.2, 3.0):
                f0c = float(d["f0"][int(tc * SR)])
                a["harmonic_levels_db_re_strongest"][f"t={tc}s,f0~{f0c:.0f}Hz"] = harmonic_levels(x, tc, f0c, 10)
        ov = None
        if d is not None:
            sub = slice(None, None, 441)
            tt = d["t"][sub]
            ff = np.where(d["amp"][sub] > 0.15 * d["amp"].max(), d["f0"][sub], np.nan)
            ov = (tt, [None if np.isnan(v) else float(v) for v in ff])
        spectrogram_png(x, PREVIEW_DIR / f"{stem}_spectrogram.png", f"{stem}.ogg  (decoded, {len(x) / SR:.2f} s)",
                        fmax=12000.0 if stem in ("scream1", "rage1") else 8000.0, f0_overlay=ov)
        report[stem] = a
    report["_total_bytes"] = total
    (PREVIEW_DIR / "measurements.json").write_text(canon(report), encoding="utf-8", newline="\n")
    print_report(report)


def print_report(report):
    print("\nfile      dur(s)  SR     ch  codec   size(B)  peak(dBFS) rms(dBFS) LUFS   crest  DC        centroid  snr(dB)")
    for k, a in report.items():
        if k.startswith("_"):
            continue
        print(f"{k:9s} {a['duration_s']:6.2f}  {a['sample_rate']}  {a['channels']}   {a['codec']}  {a['file_bytes']:8d}  "
              f"{a['peak_dbfs']:8.2f}  {a['rms_dbfs']:8.2f} {a['lufs_integrated']:7.2f} {a['crest_db']:5.1f}  "
              f"{a['dc_offset']:9.2e}  {a['spectral_centroid_hz']:6d}  {a['roundtrip_snr_db']:6.2f}")
    print("total shipped audio bytes:", report["_total_bytes"])


def cmd_verify(args):
    ok = True

    def fail(msg):
        nonlocal ok
        ok = False
        print("FAIL:", msg)

    def strict_load(path):
        raw = path.read_bytes()
        if raw.startswith(b"\xef\xbb\xbf"):
            fail(f"{path.name}: BOM")
        if b"\r" in raw:
            fail(f"{path.name}: CR found")
        text = raw.decode("utf-8")

        def no_dups(pairs):
            keys = [k for k, _ in pairs]
            if len(keys) != len(set(keys)):
                fail(f"{path.name}: duplicate keys {keys}")
            return dict(pairs)
        obj = json.loads(text, object_pairs_hook=no_dups,
                         parse_constant=lambda c: fail(f"{path.name}: non-JSON constant {c}"))
        return text, obj

    text, sd = strict_load(SOUND_DEFS)
    if text != canon(sd):
        fail("sound_definitions.json is not in canonical 2-space/sorted form")
    if sd.get("format_version") != "1.14.0":
        fail("format_version")
    allowed_entry = {"category", "max_distance", "min_distance", "sounds"}
    allowed_sound = {"load_on_low_memory", "name", "volume"}
    cats = {"neutral", "hostile"}
    ids = set()
    for sid, e in sd["sound_definitions"].items():
        ids.add(sid)
        if not sid.startswith("mob.scp096."):
            fail(f"unexpected id {sid}")
        if set(e) - allowed_entry:
            fail(f"{sid}: unknown keys {set(e) - allowed_entry}")
        if e["category"] not in cats:
            fail(f"{sid}: category")
        if not (0 <= e["min_distance"] < e["max_distance"]):
            fail(f"{sid}: distances")
        for s in e["sounds"]:
            if set(s) - allowed_sound:
                fail(f"{sid}: unknown sound keys")
            name = s["name"]
            if name.endswith(".ogg") or not name.startswith("sounds/"):
                fail(f"{sid}: bad sound name {name}")
            f = ROOT / "SCP096_RP" / (name + ".ogg")
            if not f.exists():
                fail(f"{sid}: missing file {f}")
            else:
                st = probe(f)["streams"][0]
                if (st["codec_name"], st["channels"], int(st["sample_rate"])) != ("vorbis", 1, SR):
                    fail(f"{f.name}: ffprobe says {st}")
                x = decode_ogg(f)
                if len(x) < SR * 0.4 or not np.all(np.isfinite(x)) or np.max(np.abs(x)) >= 0.9999:
                    fail(f"{f.name}: decode check")
    want = {"mob.scp096." + k for k in ("cry", "scream", "rage", "hurt", "death")}
    if ids != want:
        fail(f"ids {ids} != {want}")
    # no stray audio files
    on_disk = {p.stem for p in OUT_DIR.glob("*") if p.is_file()}
    referenced = {s["name"].split("/")[-1] for e in sd["sound_definitions"].values() for s in e["sounds"]}
    if on_disk != referenced or any(p.suffix != ".ogg" for p in OUT_DIR.glob("*")):
        fail(f"files on disk {sorted(on_disk)} != referenced {sorted(referenced)}")

    text2, sj = strict_load(SOUNDS_JSON)
    if text2 != canon(sj):
        fail("sounds.json is not in canonical form")
    if set(sj) != {"entity_sounds"} or set(sj["entity_sounds"]) != {"entities"}:
        fail("sounds.json top-level structure")
    ent = sj["entity_sounds"]["entities"]
    if list(ent) != [ENTITY_ID]:
        fail("sounds.json entity key")
    e = ent[ENTITY_ID]
    if set(e) != {"events", "pitch", "volume"}:
        fail("sounds.json entity keys")
    for ev, sid in e["events"].items():
        if ev not in ("hurt", "death") or sid not in ids:
            fail(f"sounds.json event {ev}->{sid}")

    # ---- field spellings must exist in the vanilla 1.21.0.3 corpus (if the samples are on this machine)
    if VANILLA_RP.exists():
        vsd = json.loads((VANILLA_RP / "sounds" / "sound_definitions.json").read_text(encoding="utf-8"))
        v_entry_keys, v_sound_keys, v_cats = set(), set(), set()
        for ve in vsd["sound_definitions"].values():
            v_entry_keys |= set(ve)
            v_cats.add(ve.get("category"))
            for sn in ve["sounds"]:
                if isinstance(sn, dict):
                    v_sound_keys |= set(sn)
        used_entry = {k for d_ in sd["sound_definitions"].values() for k in d_}
        used_sound = {k for d_ in sd["sound_definitions"].values() for sn in d_["sounds"] for k in sn}
        used_cats = {d_["category"] for d_ in sd["sound_definitions"].values()}
        for what, used, vset in (("entry keys", used_entry, v_entry_keys), ("sound keys", used_sound, v_sound_keys),
                                 ("categories", used_cats, v_cats)):
            if not used <= vset:
                fail(f"{what} not in vanilla: {sorted(used - vset)}")
        print("vanilla sound_definitions: entry keys", sorted(used_entry), "sound keys", sorted(used_sound),
              "categories", sorted(used_cats), "-> all present in vanilla")
        vsj = json.loads((VANILLA_RP / "sounds.json").read_text(encoding="utf-8"))
        v_ent = vsj["entity_sounds"]["entities"]
        if not set(e) <= set().union(*[set(v) for v in v_ent.values()]):
            fail("sounds.json entity keys not in vanilla")
        v_events = set().union(*[set(v.get("events", {})) for v in v_ent.values()])
        if not set(e["events"]) <= v_events:
            fail("sounds.json event names not in vanilla")
        vids = vsd["sound_definitions"]
        for sid, (primary, alt) in FALLBACK.items():
            for fb in (primary, alt):
                if fb not in vids:
                    fail(f"fallback {fb} for {sid} does not exist in vanilla sound_definitions.json")
        print("fallback table:")
        for sid, (primary, alt) in FALLBACK.items():
            print(f"  {sid:20s} -> {primary} (alt {alt})")
        if any(k.startswith("mob.scp096.") for k in vids):
            fail("id collision with vanilla")
    total = sum(p.stat().st_size for p in OUT_DIR.glob("*.ogg"))
    print(f"shipped audio: {total} bytes ({total / 1024:.1f} KiB) in {len(list(OUT_DIR.glob('*.ogg')))} files")
    if total > 600 * 1024:
        fail("audio over 600 KB budget")
    print("VERIFY OK" if ok else "VERIFY FAILED")
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["build", "analyze", "verify", "all", "json"])
    args = ap.parse_args()
    if args.command == "build":
        cmd_build(args)
    elif args.command == "analyze":
        cmd_analyze(args)
    elif args.command == "verify":
        sys.exit(cmd_verify(args))
    elif args.command == "json":
        write_json_files()
    else:
        cmd_build(args)
        sys.exit(cmd_verify(args))


if __name__ == "__main__":
    main()
