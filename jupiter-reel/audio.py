#!/usr/bin/env python3
"""
audio.py -- procedural soundtrack for "WHAT IF YOU FELL INTO JUPITER?"

Everything is synthesised from code with numpy + scipy: no samples and no
voices (no speech, choirs, formants or breathing).  All timing is imported
from timeline.py, so every boom, thunder roll, warning beep and visor crack
lands on the frame where the picture cuts or flashes.

    python3 audio.py   ->   output/soundtrack.wav
                            45.000 s, 48 kHz, stereo, 16-bit PCM, TPDF dither

Signal flow
    music      D-minor orchestral-hybrid score over a D pedal (string pads,
               sub bass, Shepard risers, S5 tritone cluster, S6 open fifths)
    impacts    boom/braam, entry boom, pressure hit, groan, thunder hit, ...
    wind       STFT-filtered noise turbulence with random LFOs and gusts
    thunder    one per LIGHTNING event (delay, distance, strokes, muffling)
    perc       taiko / tom ostinato, built up S2 -> S4, slow hits in S5
    sfx        space transition, creaks/groans (modal), sizzle, visor
               cracks, suit hum, whoosh
    beeps      one per BEEPS entry, levelled ~10 dB under the bed peaks
      -> per-stem stereo convolution reverb (filtered-noise IRs)
      -> helmet muffling inside the POV windows (outside-world stems)
      -> gate to near-silence at 33.6 s (30 ms), S6 summed after the gate
      -> mono bass (<120 Hz) -> bus compressor on the bed (impacts bypass it)
      -> soft clip -> true-peak limiter (-14 LUFS integrated, <= -1 dBTP)
      -> near-silence hum, final fade, TPDF dither, 16-bit WAV
"""
from __future__ import annotations

import os
import sys
import time
import zlib

import numpy as np
from scipy import fft as sfft
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import gaussian_filter1d, minimum_filter1d, uniform_filter1d

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
sys.dont_write_bytecode = True        # write nothing into the shared folder but the WAV
import timeline as TL  # noqa: E402

# =============================================================================
# constants and timeline shortcuts
# =============================================================================
SR = int(TL.SAMPLE_RATE)
DUR = float(TL.DURATION)
N = int(round(DUR * SR))
OUT_PATH = os.path.join(HERE, "output", "soundtrack.wav")
SEED = 452026
WORKERS = max(1, min(4, os.cpu_count() or 1))

TARGET_LUFS = -14.0
LIMIT_DBTP = -1.35            # limiter ceiling (ffmpeg must read <= -1.0 dBTP)
NEAR_SILENCE_DBFS = -45.0     # RMS of the hum that remains at 33.6-35.0

SCENE = {s[0]: (s[2], s[3]) for s in TL.SCENES}
T_S2, T_S3, T_S4, T_S5, T_S6 = (SCENE[k][0] for k in ("S2", "S3", "S4", "S5", "S6"))
POV1, POV2 = TL.POV_WINDOWS[0], TL.POV_WINDOWS[1]
SIL0, SIL1 = TL.NEAR_SILENCE
FADE0, FADE1 = TL.FADE_OUT
FADE_END = FADE1 - 0.4        # the last 0.4 s is digital silence
HIT_TIMES: dict = {}
for _h in TL.HITS:
    HIT_TIMES.setdefault(_h["kind"], []).append(_h["t"])
T_GROAN = HIT_TIMES["groan"][0]
T_SOFT = HIT_TIMES["hit_soft"][0]
T_WHOOSH = HIT_TIMES["whoosh"][0]
T_FHIT = HIT_TIMES["final_hit"][0]
T_CHORD = 24.0                # S4 harmony moves to Eb/D (bII) ahead of the S5 cluster

# mix faders (dB per stem, applied before reverb)
TRIM = dict(music=-17.0, riser=-4.0, impact=-5.0, wind=1.0, thunder=2.0, perc=-18.0,
            sfx_out=0.0, sfx_in=0.0, beeps=0.0,
            music_post=-12.0, impact_post=-6.0, sfx_post=3.0)
# drum-bus glue: tanh drive applied relative to the stem's own peak
GLUE = dict(perc=2.0)


# =============================================================================
# small helpers
# =============================================================================
def ns(t):
    return int(round(float(t) * SR))


def dbg(d):
    return 10.0 ** (np.asarray(d, dtype=float) / 20.0)


def midi(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=float) - 69.0) / 12.0)


def tvec(n):
    return np.arange(n) / SR


def rng(name):
    return np.random.default_rng([SEED, zlib.crc32(name.encode())])


def smooth01(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def curve_db(t, pts):
    """Piecewise-linear automation in dB -> linear gain at times t."""
    ts, ds = zip(*pts)
    return dbg(np.interp(t, ts, ds))


def curve_log(t, pts):
    """Piecewise-exponential curve (linear in log), e.g. cutoffs in Hz."""
    ts, vs = zip(*pts)
    return np.exp(np.interp(t, ts, np.log(vs)))


def curve_lin(t, pts):
    ts, vs = zip(*pts)
    return np.interp(t, ts, vs)


def fade_edges(n, fin, fout):
    e = np.ones(n)
    a = min(n, max(1, ns(fin)))
    b = min(n, max(1, ns(fout)))
    e[:a] *= np.sin(0.5 * np.pi * np.arange(a) / a) ** 2
    e[n - b:] *= np.cos(0.5 * np.pi * (np.arange(b) + 1) / b) ** 2
    return e


def burst(x, rise, tau):
    """Smooth attack of `rise` s then exponential decay `tau`; x = time since onset."""
    x = np.asarray(x, dtype=float)
    y = np.zeros_like(x)
    a = (x >= 0) & (x < rise)
    y[a] = np.sin(0.5 * np.pi * x[a] / rise) ** 2
    b = x >= rise
    y[b] = np.exp(-(x[b] - rise) / tau)
    return y


def pan_gains(p):
    th = (np.clip(p, -1.0, 1.0) + 1.0) * np.pi / 4.0
    return np.sqrt(2.0) * np.cos(th), np.sqrt(2.0) * np.sin(th)


def st(m):
    return np.vstack([m, m])


def peak_norm(x, p=1.0):
    m = np.max(np.abs(x))
    return x * (p / m) if m > 0 else x


def densify(x, drive):
    """Peak-preserving tanh saturation: thickens the body of a sound."""
    pk = np.max(np.abs(x))
    return pk * np.tanh(drive * x / pk) / np.tanh(drive) if pk > 0 else x


def rms(x):
    return float(np.sqrt(np.mean(np.square(x)))) if x.size else 0.0


def to_db(v):
    return 20.0 * np.log10(max(float(v), 1e-12))


class Bus:
    """A stereo stem covering the whole film."""

    def __init__(self, name):
        self.name = name
        self.x = np.zeros((2, N))

    def add(self, sig, t0, gain=1.0, pan=0.0, fin=0.0015, fout=0.004):
        sig = np.asarray(sig, dtype=float)
        if sig.ndim == 1:
            gl, gr = pan_gains(pan)
            sig = np.vstack([gl * sig, gr * sig])
        elif pan:
            gl, gr = pan_gains(pan)
            sig = sig * np.array([[gl], [gr]])
        n = sig.shape[1]
        if fin or fout:
            sig = sig * fade_edges(n, fin, fout)
        i0 = ns(t0)
        a, b = max(i0, 0), min(i0 + n, N)
        if b > a:
            self.x[:, a:b] += gain * sig[:, a - i0:b - i0]


# =============================================================================
# filters, noise, oscillators
# =============================================================================
def _sos(kind, fc, order=2):
    return signal.butter(order, fc, btype=kind, fs=SR, output="sos")


def lp(x, fc, order=2):
    return signal.sosfilt(_sos("lowpass", fc, order), x, axis=-1)


def hp(x, fc, order=2):
    return signal.sosfilt(_sos("highpass", fc, order), x, axis=-1)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_sos("bandpass", [lo, hi], order), x, axis=-1)


def unit(x):
    return x / (np.std(x, axis=-1, keepdims=True) + 1e-12)


def lp_noise(r, n, fc, order=2, ch=2):
    return unit(lp(r.standard_normal((ch, n)), fc, order))


def bp_noise(r, n, lo, hi, order=2, ch=2):
    return unit(bp(r.standard_normal((ch, n)), lo, hi, order))


def pink(r, n, ch=2, fmin=15.0):
    w = r.standard_normal((ch, n))
    W = sfft.rfft(w, axis=-1, workers=WORKERS)
    f = sfft.rfftfreq(n, 1.0 / SR)
    W *= 1.0 / np.sqrt(np.maximum(f, fmin))
    return unit(sfft.irfft(W, n, axis=-1, workers=WORKERS))


def brown(r, n, ch=2):
    x = signal.lfilter([1.0], [1.0, -0.9995], r.standard_normal((ch, n)), axis=-1)
    return unit(hp(x, 12.0, 2))


def slow_noise(r, n, rate):
    """Smooth random modulation, zero mean, ~unit std, bandwidth ~rate Hz."""
    ctrl = max(8.0 * rate, 50.0)
    m = int(n / SR * ctrl) + 8
    w = gaussian_filter1d(r.standard_normal(m), sigma=0.19 * ctrl / rate, mode="nearest")
    w = (w - w.mean()) / (w.std() + 1e-12)
    return np.interp(np.arange(n) / SR * ctrl, np.arange(m), w)


def phase_of(freq, n, ph0=0.0):
    f = np.full(n, float(freq)) if np.ndim(freq) == 0 else np.asarray(freq, dtype=float)
    ph = np.cumsum(f) / SR
    ph += ph0 - ph[0]
    return ph, f


def sine(freq, n, ph0=0.0):
    ph, _ = phase_of(freq, n, ph0)
    return np.sin(2.0 * np.pi * ph)


def _blep_saw(ph, dt):
    p = ph % 1.0
    y = 2.0 * p - 1.0
    m = p < dt
    if m.any():
        x = p[m] / dt[m]
        y[m] -= x + x - x * x - 1.0
    m = p > 1.0 - dt
    if m.any():
        x = (p[m] - 1.0) / dt[m]
        y[m] -= x * x + x + x + 1.0
    return y


def saw(freq, n, ph0=0.0):
    """Band-limited (PolyBLEP) sawtooth with arbitrary frequency curve."""
    ph, f = phase_of(freq, n, ph0)
    return _blep_saw(ph, f / SR)


def square(freq, n, ph0=0.0):
    ph, f = phase_of(freq, n, ph0)
    dt = f / SR
    return _blep_saw(ph, dt) - _blep_saw(ph + 0.5, dt)


def ensemble(m, n, r, voices=6, detune=10.0, vib_rate=5.3, vib_cents=6.0, drift=3.0,
             spread=0.9, bend=None, wave="saw"):
    """Detuned stack of oscillators on one note -> stereo (2, n)."""
    base = float(midi(m))
    t = tvec(n)
    out = np.zeros((2, n))
    for v in range(voices):
        pos = (2.0 * v / (voices - 1) - 1.0) if voices > 1 else 0.0
        c = np.full(n, detune * pos + r.normal(0.0, detune * 0.12))
        if vib_cents:
            c += vib_cents * np.sin(2 * np.pi * vib_rate * r.uniform(0.85, 1.15) * t
                                    + r.uniform(0, 2 * np.pi))
        if drift:
            c += drift * slow_noise(r, n, 0.4)
        if bend is not None:
            c += bend
        f = base * 2.0 ** (c / 1200.0)
        s = saw(f, n, r.random()) if wave == "saw" else sine(f, n, r.random())
        gl, gr = pan_gains(spread * pos * r.uniform(0.6, 1.0))
        out[0] += gl * s
        out[1] += gr * s
    return out / np.sqrt(voices)


def tv_lowpass(x, fc, q=0.707, block=64, stages=1):
    """Time-varying RBJ low-pass, coefficients updated per block (state carried)."""
    x = np.atleast_2d(x)
    C, n = x.shape
    fc = np.full(n, float(fc)) if np.ndim(fc) == 0 else np.asarray(fc, dtype=float)
    nb = -(-n // block)
    cen = np.minimum(np.arange(nb) * block + block // 2, n - 1)
    f = np.clip(fc[cen], 15.0, 0.45 * SR)
    w0 = 2 * np.pi * f / SR
    cw, al = np.cos(w0), np.sin(w0) / (2 * q)
    a0 = 1 + al
    b0, b1 = (1 - cw) / 2 / a0, (1 - cw) / a0
    a1, a2 = -2 * cw / a0, (1 - al) / a0
    y = x
    for _ in range(stages):
        out = np.empty_like(x)
        zi = np.zeros((C, 2))
        for k in range(nb):
            s = slice(k * block, min(n, (k + 1) * block))
            out[:, s], zi = signal.lfilter([b0[k], b1[k], b0[k]], [1.0, a1[k], a2[k]],
                                           y[:, s], axis=-1, zi=zi)
        y = out
    return y


def stft_filter(x, mask_fn, nper=2048, t0=0.0):
    """Zero-phase time-varying filter: mask_fn(F (1,bins), T (frames,1), ch) -> gains."""
    x = np.atleast_2d(x)
    C, n = x.shape
    hop = nper // 4
    win = np.sin(np.pi * np.arange(nper) / nper) ** 2          # periodic Hann
    pad = nper
    nfr = (n + 2 * pad - nper) // hop + 1
    total = (nfr - 1) * hop + nper
    F = sfft.rfftfreq(nper, 1.0 / SR)[None, :]
    T = (t0 + (np.arange(nfr) * hop + nper / 2 - pad) / SR)[:, None]
    out = np.zeros((C, total))
    for c in range(C):
        xp = np.zeros(total)
        xp[pad:pad + n] = x[c]
        fr = np.lib.stride_tricks.sliding_window_view(xp, nper)[::hop][:nfr] * win
        X = sfft.rfft(fr, axis=1, workers=WORKERS)
        Y = sfft.irfft(X * mask_fn(F, T, c), nper, axis=1, workers=WORKERS) * win
        for k in range(4):
            seg = Y[:, k * hop:(k + 1) * hop].reshape(-1)
            out[c, k * hop:k * hop + seg.size] += seg
    return out[:, pad:pad + n] / 1.5


def bp_mag(F, fc, q):
    Fm = np.maximum(F, 1.0)
    return 1.0 / np.sqrt(1.0 + (q * (Fm / fc - fc / Fm)) ** 2)


def lp_mag(F, fc, order=2):
    return 1.0 / np.sqrt(1.0 + (F / fc) ** (2 * order))


def hp_mag(F, fc, order=2):
    Fm = np.maximum(F, 1e-3)
    return 1.0 / np.sqrt(1.0 + (fc / Fm) ** (2 * order))


def resonator(x, f, tau):
    """Two-pole resonator (one mode of a modal model)."""
    rad = np.exp(-1.0 / (tau * SR))
    w = 2 * np.pi * f / SR
    return signal.lfilter([1 - rad * rad], [1.0, -2 * rad * np.cos(w), rad * rad], x)


# =============================================================================
# reverb: stereo convolution with exponentially decaying filtered-noise IRs
# =============================================================================
class Reverb:
    def __init__(self, name, length, rt60, predelay, build=0.01, xover=(250.0, 1800.0, 5500.0)):
        r = rng("ir-" + name)
        n = ns(length)
        t = tvec(n)
        irs = []
        for ch in range(2):
            w = r.standard_normal(n)
            bands = [lp(w, xover[0], 4), bp(w, xover[0], xover[1], 2),
                     bp(w, xover[1], xover[2], 2), hp(w, xover[2], 4)]
            ir = sum(b * np.exp(-6.9078 * t / rt) for b, rt in zip(bands, rt60))
            ir *= smooth01(t / build)
            # sparse early reflections give the space a body
            for _ in range(10):
                k = ns(r.uniform(0.004, 0.07))
                ir[k] += r.choice([-1.0, 1.0]) * r.uniform(1.0, 3.0) * np.exp(-6.9078 * k / SR / rt60[1])
            ir = np.concatenate([np.zeros(ns(predelay) + 17 * ch), ir])[:n]
            irs.append(ir / np.sqrt(np.sum(ir ** 2)))
        self.ir = np.vstack(irs)
        self.cache = {}

    def __call__(self, x):
        n = x.shape[1]
        nfft = sfft.next_fast_len(n + self.ir.shape[1] - 1, real=True)
        H = self.cache.get(nfft)
        if H is None:
            H = sfft.rfft(self.ir, nfft, axis=-1, workers=WORKERS)
            self.cache[nfft] = H
        src = np.vstack([0.72 * x[0] + 0.28 * x[1], 0.28 * x[0] + 0.72 * x[1]])
        X = sfft.rfft(src, nfft, axis=-1, workers=WORKERS)
        return sfft.irfft(X * H, nfft, axis=-1, workers=WORKERS)[:, :n]


# =============================================================================
# instruments
# =============================================================================
def chord_notes(chords):
    """[(t0, t1, [midi], attack, release)] -> merged notes [(m, on, off, att, rel)]."""
    notes, active = [], {}
    for (t0, t1, ms, att, rel) in chords:
        for m in list(active):
            if m not in ms or abs(active[m][1] - t0) > 1e-6:
                notes.append((m, *active.pop(m)))
        for m in ms:
            if m in active:
                active[m][1], active[m][3] = t1, rel
            else:
                active[m] = [t0, t1, att, rel]
    notes += [(m, *v) for m, v in active.items()]
    return notes


def render_layer(name, chords, cut_pts, amp_pts, voices=6, detune=9.0, vib_rate=5.3,
                 vib_cents=6.0, q=0.6, stages=2, wave="saw", tilt=-0.18, trem=None):
    """Sustained ensemble layer (strings / horns) with cutoff + level automation."""
    r = rng("layer-" + name)
    notes = chord_notes(chords)
    t_start = min(nt[1] for nt in notes)
    t_end = max(nt[2] + nt[4] for nt in notes)
    n = ns(t_end - t_start) + 1
    buf = np.zeros((2, n))
    for (m, on, off, att, rel) in notes:
        i0 = ns(on - t_start)
        length = min(ns(off - on + rel), n - i0)
        x = ensemble(m, length, r, voices=voices, detune=detune, vib_rate=vib_rate,
                     vib_cents=vib_cents, wave=wave)
        tt = tvec(length)
        env = np.ones(length)
        ia = min(length, max(1, ns(att)))
        env[:ia] = np.sin(0.5 * np.pi * tt[:ia] / att) ** 2
        rel_x = np.clip((tt - (off - on)) / rel, 0.0, 1.0)
        env *= np.cos(0.5 * np.pi * rel_x) ** 2
        buf[:, i0:i0 + length] += x * env * dbg(tilt * (m - 50))
    tabs = t_start + tvec(n)
    if cut_pts:
        buf = tv_lowpass(buf, curve_log(tabs, cut_pts), q=q, block=128, stages=stages)
    buf *= curve_db(tabs, amp_pts)
    if trem:
        rate, depth_pts = trem
        d = curve_lin(tabs, depth_pts)
        ph = 2 * np.pi * rate * tabs + 0.8 * slow_noise(r, n, 1.5)
        buf *= 1.0 - d * 0.5 * (1.0 + np.cos(ph))
    return buf, t_start


def pitched_thump(n, f0, f1, tau_f, tau_a, attack=0.003):
    """Sine whose pitch falls exponentially from f0 to f1 (sub drop / drum body)."""
    t = tvec(n)
    f = f1 * (f0 / f1) ** np.exp(-t / tau_f)
    ph = np.cumsum(f) / SR
    ph -= ph[0]
    return np.sin(2 * np.pi * ph) * (1 - np.exp(-t / attack)) * np.exp(-t / tau_a)


def hit_parts(r, dur, sub=None, punch=None, body=None, crack=None):
    """Generic cinematic hit: sub drop, punch, low noise body, transient crack."""
    n = ns(dur)
    t = tvec(n)
    x = np.zeros((2, n))
    if sub:
        f0, f1, tf, ta, a = sub
        x += a * pitched_thump(n, f0, f1, tf, ta, 0.004)
    if punch:
        f0, f1, tf, ta, a = punch
        x += a * pitched_thump(n, f0, f1, tf, ta, 0.0008)
    if body:
        fc, rise, tau, a = body
        x += a * lp_noise(r, n, fc, 4) * burst(t, rise, tau)
    if crack:
        lo, hi, tau, a = crack
        x += a * bp_noise(r, n, lo, hi, 2) * burst(t, 0.0006, tau)
    return x


def braam(r, dur, notes, cut_pts, amp_pts, voices=5, detune=16.0, drive=2.2,
          bend_pts=None, q=0.85):
    """Distorted brass-like 'braam': detuned saw stacks -> drive -> filter envelope."""
    n = ns(dur)
    t = tvec(n)
    bend = curve_lin(t, bend_pts) if bend_pts else None
    x = np.zeros((2, n))
    for m in notes:
        x += ensemble(m, n, r, voices=voices, detune=detune, vib_cents=0.0, drift=2.0,
                      spread=0.95, bend=bend) * dbg(-2.5 if m > 40 else 0.0)
    x = np.tanh(drive * x) / np.tanh(drive)
    flutter = 1.0 + 0.07 * np.sin(2 * np.pi * 27.0 * t) * np.exp(-t / 0.5)
    x = tv_lowpass(x * flutter, curve_log(t, cut_pts), q=q, block=32, stages=2)
    x *= curve_db(t, amp_pts)
    x = np.tanh(1.4 * peak_norm(x)) / np.tanh(1.4)
    return x


MODE_RATIOS = np.array([1.0, 1.47, 2.09, 2.56, 3.21, 3.93, 4.72, 5.61, 6.83, 8.17, 9.7])


def metal_groan(r, dur, base, bend=-0.07, tau=1.0, bright=0.72, n_modes=9,
                swell=(0.25, 0.55), rough=0.35):
    """Modal synthesis: inharmonic decaying partials, pitch-bent, noise excited."""
    n = ns(dur)
    t = tvec(n)
    ratios = MODE_RATIOS[:n_modes] * (1 + r.normal(0, 0.02, n_modes))
    exc = np.clip(0.55 + 0.45 * slow_noise(r, n, 7.0), 0.0, None) ** 2
    exc *= burst(t, swell[0], swell[1] * dur)
    bendc = 1.0 + bend * smooth01(t / dur) + 0.004 * slow_noise(r, n, 2.5)
    out = np.zeros(n)
    for k, ratio in enumerate(ratios):
        tk = tau / (1 + 0.45 * k)
        p = np.exp(-1.0 / (tk * SR))
        amp = signal.lfilter([1 - p], [1.0, -p], exc)
        ph = np.cumsum(base * ratio * bendc) / SR + r.random()
        s = np.sin(2 * np.pi * ph)
        if k < 3:                                  # beating partner mode
            s = 0.65 * s + 0.35 * np.sin(2 * np.pi * (ph + r.uniform(0.4, 1.1) * t))
        out += bright ** k * r.uniform(0.6, 1.0) * amp * s
    grit = 1.0 + rough * unit(lp(r.standard_normal(n), 70.0, 2))
    return peak_norm(out * grit)


def creak(r, dur, modes, rate=(18.0, 50.0), env=None, jitter=0.3, bend=0.0):
    """Stick-slip creak: irregular impulse train exciting a bank of resonators,
    pitch-bent by `bend` (fraction) through a smooth time warp."""
    n = ns(dur)
    t = tvec(n)
    rr = rate[0] * (rate[1] / rate[0]) ** (t / dur) * np.exp(jitter * slow_noise(r, n, 6.0))
    ph = np.cumsum(rr) / SR
    idx = np.nonzero(np.diff(np.floor(ph)))[0] + 1
    idx = np.clip(idx + r.integers(-10, 11, idx.size), 0, n - 1)
    e = burst(t, 0.12 * dur, 0.35 * dur) if env is None else env(t)
    imp = np.zeros(n)
    np.add.at(imp, idx, e[idx] * r.uniform(0.3, 1.0, idx.size) * r.choice([-1.0, 1.0], idx.size))
    out = sum(a * resonator(imp, f, tau) for (f, tau, a) in modes)
    if bend:
        speed = 1.0 + bend * smooth01(t / dur)
        out = out * fade_edges(n, 0.0005, 0.03)            # reads past the end stay silent
        out = np.interp(np.cumsum(speed) - speed[0], np.arange(n), out, right=0.0)
    return peak_norm(hp(out, 90.0, 2))


def clang(r, dur, base, n_modes=7, tau=0.9):
    """Short dark metallic strike (modal), used under heavy hits."""
    n = ns(dur)
    exc = r.standard_normal(n) * burst(tvec(n), 0.0005, 0.004)
    out = np.zeros(n)
    for k, ratio in enumerate(MODE_RATIOS[:n_modes] * (1 + r.normal(0, 0.03, n_modes))):
        out += 0.8 ** k * resonator(exc, base * ratio, tau / (1 + 0.5 * k))
    return peak_norm(out)


def shepard(r, dur, rate0, rate1, f_lo=None, n_oct=8, center=4.2, width=1.25, detune_c=5.0):
    """Shepard-Risset glissando: endlessly rising octave-spaced partials."""
    f_lo = float(midi(26)) if f_lo is None else f_lo
    n = ns(dur)
    t = tvec(n)
    pos = np.cumsum(rate0 * (rate1 / rate0) ** (t / dur)) / SR
    out = np.zeros((2, n))
    for k in range(n_oct):
        p = (k + pos) % n_oct
        amp = np.exp(-0.5 * ((p - center) / width) ** 2) * np.sin(np.pi * p / n_oct)
        f = f_lo * 2.0 ** p
        for c, dc in enumerate((-detune_c, detune_c)):
            ph = np.cumsum(f * 2.0 ** (dc / 1200.0)) / SR + r.random()
            out[c] += amp * np.sin(2 * np.pi * ph)
    return out / np.sqrt(n_oct)


def noise_sweep(r, dur, f_pts, q, amp_pts, color="white", extra=None):
    """Band-passed noise whose centre follows f_pts (relative times) - risers, whooshes."""
    n = ns(dur)
    src = pink(r, n) if color == "pink" else r.standard_normal((2, n))

    def mask(F, T, c):
        tt = T[:, 0]
        fc = curve_log(tt, f_pts)[:, None]
        m = curve_db(tt, amp_pts)[:, None] * bp_mag(F, fc, q)
        if extra is not None:
            m = m + extra(F, tt)
        return m

    return stft_filter(src, mask)


# =============================================================================
# 1) music
# =============================================================================
def make_music(B):
    mus, ris, post = B["music"], B["riser"], B["music_post"]

    # ---- string pads over the D pedal (S1-S5) -------------------------------
    low = [(0.35, T_S2, [38, 45], 2.4, 0.8),
           (T_S2, POV1[0], [38, 45], 0.6, 0.9),
           (POV1[0], T_S3, [38, 46], 0.6, 0.9),               # Bb/D
           (T_S3, T_GROAN, [38, 45], 0.6, 0.9),
           (T_GROAN, T_S4, [38, 43], 0.6, 0.9),               # Gm/D
           (T_S4, T_SOFT, [38, 45], 0.5, 0.8),
           (T_SOFT, T_S5, [38, 46], 0.6, 0.5),                # Bb/D
           (T_S5, SIL0 + 0.1, [38], 0.4, 0.2)]
    x, t0 = render_layer(
        "low", low,
        cut_pts=[(0, 150), (1.5, 260), (4.9, 900), (5.05, 650), (8.2, 600), (11.0, 480),
                 (14.4, 450), (18.0, 600), (21.8, 750), (25.9, 900), (26.05, 380), (34.0, 380)],
        amp_pts=[(0, -60), (0.35, -40), (2.5, -15), (4.95, -8), (5.05, -10), (8.2, -10),
                 (11.0, -9.5), (17.9, -7), (18.05, -8), (25.9, -5), (26.05, -10), (34.0, -10)],
        voices=6, detune=8.0, vib_cents=5.0)
    mus.add(x, t0, fin=0, fout=0)

    mid = [(1.0, T_S2, [50, 53, 57], 2.2, 0.6),
           (T_S2, POV1[0], [50, 53, 57], 0.5, 0.9),
           (POV1[0], T_S3, [50, 53, 58], 0.6, 0.9),
           (T_S3, T_GROAN, [50, 53, 57], 0.6, 0.9),
           (T_GROAN, T_S4, [50, 55, 58], 0.6, 0.9),
           (T_S4, T_SOFT, [50, 53, 57], 0.5, 0.8),
           (T_SOFT, T_CHORD, [50, 53, 58], 0.6, 0.8),
           (T_CHORD, T_S5, [51, 55, 58], 0.5, 0.12),          # Eb/D: bII colour
           (T_S5, POV2[0], [51, 56], 0.3, 1.2)]               # S5 upper cluster
    x, t0 = render_layer(
        "mid", mid,
        cut_pts=[(0, 260), (1.0, 320), (4.9, 3600), (5.05, 2300), (8.2, 2000), (11.0, 1500),
                 (14.4, 1350), (18.0, 2000), (25.9, 4500), (26.05, 900), (31.0, 750)],
        amp_pts=[(1.0, -50), (2.6, -17), (4.95, -7), (5.05, -12), (8.2, -12.5), (11.0, -12),
                 (17.9, -10.5), (18.05, -12), (25.9, -4.5), (26.05, -16), (30.6, -18), (32.0, -50)],
        voices=6, detune=10.0, vib_cents=6.5,
        trem=(11.5, [(0, 0), (18.6, 0), (21.0, 0.25), (25.9, 0.55), (26.0, 0.0)]))
    mus.add(x, t0, fin=0, fout=0)

    high = [(2.6, T_S2, [62, 65, 69], 1.9, 0.3),
            (T_SOFT, T_CHORD, [62, 65, 69], 1.6, 0.6),
            (T_CHORD, T_S5, [63, 67, 70], 0.6, 0.08)]
    x, t0 = render_layer(
        "high", high,
        cut_pts=[(2.6, 900), (4.9, 5200), (5.05, 2000), (21.8, 1500), (25.9, 6500), (26.0, 3000)],
        amp_pts=[(2.6, -50), (3.5, -17), (4.95, -9), (5.2, -40), (21.8, -50), (23.5, -20),
                 (25.92, -8), (26.0, -40)],
        voices=6, detune=11.0, vib_cents=7.0,
        trem=(13.0, [(0, 0), (21.8, 0.2), (25.9, 0.65), (26.0, 0)]))
    ris.add(x, t0, fin=0, fout=0.01)

    # ---- ominous sub bass on D (S1-S5) --------------------------------------
    r = rng("bass")
    t_end = SIL0 + 0.1
    n = ns(t_end)
    t = tvec(n)
    drive = curve_lin(t, [(0, 1.6), (11.0, 1.6), (18.0, 2.3), (26.0, 2.6), (34, 2.6)])
    b = (np.sin(2 * np.pi * np.cumsum(np.full(n, midi(26)) * (1 + 0.001 * slow_noise(r, n, 0.3))) / SR)
         + 0.55 * sine(midi(38), n, 0.1))
    b = np.tanh(drive * 0.9 * b) / np.tanh(drive * 0.9)
    throb = 1.0 - curve_lin(t, [(0, 0.3), (5.0, 0.3), (5.1, 0.12), (34, 0.12)]) * \
        0.5 * (1 + np.cos(2 * np.pi * 0.75 * t))
    b *= throb * curve_db(t, [(0, -60), (0.3, -22), (2.0, -13), (4.95, -9), (5.05, -12),
                              (11.0, -12), (17.9, -5.5), (18.05, -8), (25.9, -6), (26.05, -8),
                              (34.0, -6.5)])
    mus.add(lp(b, 260.0, 2), 0.0, fin=0.002, fout=0.01)

    # ---- low rumble (S2-S5) ---------------------------------------------------
    r = rng("rumble")
    n = ns(t_end - 5.0)
    t = 5.0 + tvec(n)
    x = lp(brown(r, n), 75.0, 4)
    x *= (1.0 + 0.3 * slow_noise(r, n, 0.6))
    x *= curve_db(t, [(5.0, -50), (8.0, -26), (11.0, -17), (17.9, -12), (18.05, -14),
                      (25.9, -11), (26.0, -9), (34.0, -9)])
    mus.add(x, 5.0, fin=0.05, fout=0.01)

    # ---- S5: darkest point - D1 + Eb2 + Ab2 tritone cluster -------------------
    r = rng("cluster")
    dur = SIL0 + 0.1 - T_S5
    n = ns(dur)
    t = tvec(n)
    cl = (ensemble(39, n, r, voices=5, detune=12.0, vib_cents=4.0)
          + 0.9 * ensemble(44, n, r, voices=5, detune=12.0, vib_cents=4.0)
          + 0.7 * ensemble(26, n, r, voices=3, detune=6.0, vib_cents=0.0))
    cl = np.tanh(1.6 * cl) / np.tanh(1.6)
    cl = tv_lowpass(cl, curve_log(t, [(0, 1400), (0.6, 480), (4.6, 380), (dur, 620)]), q=0.7,
                    block=128, stages=2)
    swell = 1.0 + 0.28 * np.sin(2 * np.pi * 0.21 * t - 1.2)
    cl *= swell * curve_db(t, [(0, -5), (1.0, -9), (4.6, -10), (dur, -7)])
    cl += st(0.5 * sine(midi(26), n)) * curve_db(t, [(0, -60), (0.05, -8), (dur, -6)])
    mus.add(cl, T_S5, fin=0.01, fout=0.01)

    # ---- risers: Shepard glissandi + noise risers ----------------------------
    r = rng("shep1")
    x = shepard(r, T_S2 - 1.0, 0.22, 0.95)
    tt = tvec(x.shape[1])
    ris.add(x * curve_db(tt, [(0, -50), (1.5, -19), (3.95, -9)]), 1.0, fin=0.2, fout=0.03)
    r = rng("shep4")
    x = shepard(r, T_S5 - T_S4, 0.12, 0.8)
    tt = tvec(x.shape[1])
    ris.add(x * curve_db(tt, [(0, -50), (2.0, -26), (7.95, -10)]), T_S4, fin=0.3, fout=0.012)
    r = rng("shep5")
    x = shepard(r, SIL0 - POV2[0], 0.35, 1.7)
    tt = tvec(x.shape[1])
    ris.add(x * curve_db(tt, [(0, -30), (3.0, -9)]), POV2[0], fin=0.2, fout=0.005)

    r = rng("nriser4")
    d = T_S5 - 21.0
    x = noise_sweep(r, d, [(0, 250), (d, 7500)], 1.6, [(0, -50), (d - 0.05, -15)])
    ris.add(x, 21.0, fin=0.2, fout=0.012)
    r = rng("nriser5")
    d = SIL0 - 31.2
    x = noise_sweep(r, d, [(0, 400), (d, 9000)], 1.8, [(0, -50), (d, -15)])
    ris.add(x, 31.2, fin=0.2, fout=0.005)

    # tension strings: high D5-Eb5-Ab5 tremolo crescendo into the smash cut
    hi_cl = [(POV2[0], SIL0 + 0.05, [74, 75, 80], 1.2, 0.05)]
    x, t0 = render_layer("tension", hi_cl,
                         cut_pts=[(POV2[0], 1500), (SIL0, 5000)],
                         amp_pts=[(POV2[0], -30), (31.4, -20), (SIL0, -10)],
                         voices=5, detune=14.0, vib_cents=9.0,
                         trem=(14.0, [(POV2[0], 0.4), (SIL0, 0.75)]))
    ris.add(x, t0, fin=0, fout=0.005)

    # section balance of the pre-cut score
    mus.x *= curve_db(tvec(N), [(0, 2.5), (2.0, 5.0), (3.5, 7.0), (4.95, 7.0), (5.05, 2.0), (10.95, 2.0),
                                (11.05, 1.5), (17.95, 1.5), (18.05, 0.0), (DUR, 0.0)])

    # ---- S6: majestic open fifths with a soft Bb major 7 colour --------------
    low6 = [(T_S6, T_WHOOSH, [38, 45], 1.8, 1.4),
            (T_WHOOSH, T_FHIT, [34, 41], 1.4, 1.2),               # Bb1 F2
            (T_FHIT, FADE1, [38, 45], 1.2, 0.3)]
    x, t0 = render_layer(
        "low6", low6,
        cut_pts=[(35.0, 260), (37.0, 700), (42.0, 650), (44.6, 260)],
        amp_pts=[(35.0, -40), (36.6, -10), (42.0, -9.5), (43.0, -12), (44.2, -19), (45, -40)],
        voices=6, detune=7.0, vib_cents=4.0)
    post.add(x, t0, fin=0, fout=0)
    mid6 = [(35.5, T_WHOOSH, [50, 57], 2.4, 1.3),
            (T_WHOOSH, T_FHIT, [50, 53, 57], 1.2, 1.2),           # D F A over Bb = Bbmaj7
            (T_FHIT, FADE1, [50, 57, 62], 1.2, 0.3)]
    x, t0 = render_layer(
        "mid6", mid6,
        cut_pts=[(35.5, 600), (37.5, 1900), (39.2, 2300), (42.0, 2100), (44.6, 800)],
        amp_pts=[(35.5, -40), (37.5, -12), (42.0, -11.5), (43.0, -14), (44.2, -21), (45, -40)],
        voices=6, detune=9.0, vib_cents=6.0)
    post.add(x, t0, fin=0, fout=0)
    horns = [(36.2, T_WHOOSH, [50, 57], 2.0, 1.2),
             (T_WHOOSH, T_FHIT, [46, 50, 53, 57], 1.2, 1.2),
             (T_FHIT, FADE1, [50, 57], 1.0, 0.3)]
    x, t0 = render_layer(
        "horns", horns,
        cut_pts=[(36.2, 400), (38.0, 950), (42.0, 850), (44.6, 400)],
        amp_pts=[(36.2, -40), (38.0, -14), (42.0, -14), (43.0, -17), (44.2, -25), (45, -45)],
        voices=4, detune=5.0, vib_rate=4.6, vib_cents=4.0, q=0.75, tilt=0.0)
    post.add(x, t0, fin=0, fout=0)
    shim = [(36.6, T_WHOOSH, [69, 74], 2.5, 1.2),
            (T_WHOOSH, T_FHIT, [69, 74, 77], 1.2, 1.2),
            (T_FHIT, FADE1, [69, 74], 1.0, 0.3)]
    x, t0 = render_layer(
        "shim", shim, cut_pts=None,
        amp_pts=[(36.6, -40), (38.5, -24), (42.0, -24), (44.2, -32), (45, -50)],
        voices=4, detune=6.0, vib_rate=4.0, vib_cents=8.0, wave="sine", tilt=0.0)
    post.add(x, t0, fin=0, fout=0)
    r = rng("sub6")
    n = ns(FADE1 - T_S6)
    t = tvec(n)
    sub = sine(midi(26), n) + 0.4 * sine(midi(38), n, 0.25)
    sub *= curve_db(t, [(0, -60), (1.5, -16), (7.0, -15), (9.2, -30), (10, -60)])
    post.add(sub, T_S6, fin=0.01, fout=0.01)
    # slow swells over the whole S6 bed
    i0 = ns(T_S6)
    tt = tvec(N - i0)
    post.x[:, i0:] *= 1.0 + 0.18 * np.sin(2 * np.pi * 0.12 * tt - np.pi / 2)


# =============================================================================
# 2) impacts and hits
# =============================================================================
def make_impacts(B):
    imp, sfx_in, imp_post, sfx_post = B["impact"], B["sfx_in"], B["impact_post"], B["sfx_post"]
    for h in TL.HITS:
        kind, t0, g = h["kind"], h["t"], h["gain"]
        r = rng("hit-%s-%.2f" % (kind, t0))
        if kind == "boom_braam":
            x = hit_parts(r, 5.0, sub=(70, 30, 0.55, 1.5, 0.75), punch=(120, 48, 0.035, 0.14, 0.55),
                          body=(170, 0.004, 0.45, 0.42), crack=(1800, 8000, 0.025, 0.16))
            br = braam(r, 4.6, [26, 38, 45],
                       cut_pts=[(0, 110), (0.09, 2400), (0.6, 1500), (2.2, 520), (4.6, 150)],
                       amp_pts=[(0, 0), (1.6, -3), (3.5, -14), (4.6, -50)], drive=2.4,
                       bend_pts=[(0, -35), (0.12, 0), (2.5, 0), (4.6, -40)])
            x[:, :br.shape[1]] += 0.85 * br
            imp.add(densify(x, 1.8), t0, gain=g * dbg(-4.2), fin=0.002, fout=0.05)
        elif kind == "entry_boom":
            x = hit_parts(r, 3.5, sub=(62, 32, 0.4, 1.0, 0.9), punch=(105, 45, 0.03, 0.12, 0.6),
                          body=(240, 0.003, 0.4, 0.5), crack=(500, 3500, 0.06, 0.25))
            imp.add(densify(x, 1.5), t0, gain=g * dbg(-2.0), fin=0.002, fout=0.05)
        elif kind == "cut_muffle":
            x = hit_parts(r, 0.9, sub=(75, 46, 0.05, 0.22, 0.9), body=(130, 0.003, 0.08, 0.35))
            sfx_in.add(x, t0, gain=g * dbg(-9.0), fin=0.002, fout=0.02)
        elif kind == "pressure_hit":
            x = hit_parts(r, 4.0, sub=(55, 30, 0.5, 1.3, 0.85), punch=(90, 40, 0.03, 0.12, 0.5),
                          body=(180, 0.004, 0.5, 0.45))
            grn = metal_groan(r, 2.8, 46.0, bend=-0.08, tau=1.1, swell=(0.08, 0.5))
            cl = clang(r, 1.5, 173.0, tau=0.6)
            x[:, :grn.size] += 0.55 * st(grn)
            x[:, :cl.size] += 0.22 * st(cl)
            imp.add(densify(x, 1.5), t0, gain=g * dbg(-4.0), fin=0.002, fout=0.05)
        elif kind == "groan":
            grn = metal_groan(r, 3.8, 38.0, bend=-0.09, tau=1.4, swell=(0.6, 0.5), rough=0.45)
            grn2 = metal_groan(r, 3.8, 57.0, bend=-0.06, tau=1.0, swell=(0.9, 0.45))
            ck = creak(r, 2.2, [(140, 0.08, 1.0), (233, 0.06, 0.7), (371, 0.05, 0.5), (520, 0.04, 0.35)],
                       rate=(9.0, 26.0), bend=-0.06)
            x = np.vstack([grn + 0.5 * grn2, 0.5 * grn + grn2]) * 0.8
            x[:, :ck.size] += 0.3 * st(ck)
            n = x.shape[1]
            x += st(0.35 * sine(41.0, n) * burst(tvec(n), 0.8, 1.2))
            imp.add(x, t0 - 0.05, gain=g * dbg(-4.0), fin=0.05, fout=0.1)
        elif kind == "thunder_hit":
            x = hit_parts(r, 5.0, sub=(52, 28, 0.45, 1.4, 0.8), punch=(100, 42, 0.03, 0.12, 0.5),
                          body=(280, 0.003, 0.7, 0.5), crack=(1200, 9000, 0.03, 0.4))
            n = x.shape[1]
            t = tvec(n)
            rum = lp_noise(r, n, 380, 4) * (burst(t - 0.05, 0.12, 1.6) * (1 + 0.4 * slow_noise(r, n, 5.0)))
            for dt_, a in ((0.045, 0.25), (0.11, 0.18), (0.19, 0.12)):
                rum += a * bp_noise(r, n, 1000, 7000) * burst(t - dt_, 0.0005, 0.02)
            imp.add(densify(x + 0.45 * rum, 1.5), t0, gain=g * dbg(-5.0), fin=0.001, fout=0.1)
        elif kind == "hit_soft":
            x = hit_parts(r, 2.5, sub=(50, 34, 0.3, 0.9, 0.9), body=(160, 0.01, 0.35, 0.4))
            imp.add(x, t0, gain=g * dbg(-8.0), fin=0.008, fout=0.05)
        elif kind == "dark_hit":
            x = hit_parts(r, 4.5, sub=(58, 27, 0.7, 1.8, 0.9), punch=(95, 40, 0.03, 0.13, 0.55),
                          body=(200, 0.004, 0.6, 0.45), crack=(900, 5000, 0.03, 0.12))
            br = braam(r, 4.0, [26, 39, 44],
                       cut_pts=[(0, 90), (0.08, 1300), (0.6, 700), (2.5, 250), (4.0, 120)],
                       amp_pts=[(0, 0), (1.2, -4), (3.0, -15), (4.0, -50)], drive=2.6,
                       bend_pts=[(0, -25), (0.1, 0), (4.0, -30)])
            x[:, :br.shape[1]] += 0.75 * br
            imp.add(densify(x, 1.6), t0, gain=g * dbg(-4.0), fin=0.002, fout=0.05)
        elif kind == "final_boom":
            x = hit_parts(r, 7.0, sub=(85, 24, 0.9, 2.4, 0.85), punch=(130, 45, 0.04, 0.16, 0.6),
                          body=(200, 0.004, 0.7, 0.5), crack=(1500, 8000, 0.03, 0.18))
            br = braam(r, 6.0, [26, 38, 45, 50],
                       cut_pts=[(0, 100), (0.1, 3000), (0.8, 1600), (3.0, 500), (6.0, 140)],
                       amp_pts=[(0, 0), (2.0, -3), (4.5, -14), (6.0, -55)], drive=2.4,
                       bend_pts=[(0, -40), (0.14, 0), (3.5, 0), (6.0, -50)])
            x[:, :br.shape[1]] += 0.9 * br
            imp_post.add(densify(x, 1.8), t0, gain=g * dbg(-3.5), fin=0.002, fout=0.1)
        elif kind == "final_hit":
            x = hit_parts(r, 3.5, sub=(55, 30, 0.45, 1.2, 0.9), punch=(95, 42, 0.03, 0.12, 0.45),
                          body=(170, 0.005, 0.45, 0.4))
            br = braam(r, 3.0, [38, 45], cut_pts=[(0, 90), (0.12, 900), (1.0, 500), (3.0, 120)],
                       amp_pts=[(0, 0), (1.2, -6), (3.0, -50)], drive=1.6)
            x[:, :br.shape[1]] += 0.3 * br
            imp_post.add(densify(x, 1.4), t0, gain=g * dbg(0.0), fin=0.004, fout=0.05)
        elif kind == "whoosh":
            d = 2.0
            pre = 0.62
            x = noise_sweep(r, d, [(0, 350), (pre, 4200), (d, 1100)], 1.3,
                            [(0, -40), (pre, 0), (pre + 0.3, -6), (d, -45)], color="pink")
            n = x.shape[1]
            p = curve_lin(tvec(n), [(0, -0.7), (d, 0.7)])
            gl, gr = pan_gains(p)
            x = np.vstack([x[0] * gl, x[1] * gr])
            sfx_post.add(peak_norm(x), t0 - pre, gain=g * dbg(-10.0), fin=0.05, fout=0.1)
        # cut_to_silence is the near-silence gate in render(); nothing to synthesise


# =============================================================================
# 3) wind / turbulence
# =============================================================================
def make_wind(B):
    bus = B["wind"]
    r = rng("wind")
    ta, tb = T_S2, SIL0 + 0.05
    n = ns(tb - ta)
    src = pink(r, n)
    ct = np.arange(0.0, tb - ta + 0.05, 0.01)                  # 100 Hz control grid
    cn = ct.size

    def cslow(rate):
        return slow_noise(r, cn * 480, rate)[::480]           # 100 Hz samples

    gust = np.zeros(cn)
    gpan = np.zeros(cn)
    tg = 0.0
    while tg < tb - ta:
        a = r.uniform(0.3, 1.0)
        rise, fall = r.uniform(0.25, 0.6), r.uniform(0.5, 1.4)
        b_ = a * burst(ct - tg, rise, fall)
        gust += b_
        gpan += b_ * r.uniform(-0.8, 0.8)
        tg += r.exponential(1.0 / 0.7)
    gpan = np.clip(gpan / np.maximum(gust, 1e-6), -0.8, 0.8)
    gust = gust / (1.0 + 0.5 * gust)
    inside = np.zeros(cn)
    for (a, b) in TL.POV_WINDOWS:
        inside = np.maximum(inside, smooth01((ta + ct - a + 0.1) / 0.2) * (1 - smooth01((ta + ct - b + 0.1) / 0.2)))
    gust *= 1.0 - 0.7 * inside                                 # steadier (no swells) in the helmet
    lfo_f = [0.75 * cslow(0.2) + 0.45 * cslow(0.25) for _ in range(2)]
    lfo_a = [0.7 * cslow(0.35) + 0.5 * cslow(0.4) for _ in range(2)]
    buffet = np.abs(cslow(5.0)) * curve_lin(ta + ct, [(5.0, 1.0), (7.0, 0.7), (8.4, 0.15), (11, 0.1),
                                                     (18, 0.25), (26, 0.1), (34, 0.05)])
    tabs = ta + ct
    level = curve_db(tabs, [(5.0, -3), (5.4, -4), (6.2, -7.5), (8.2, -8.5), (11.0, -10.5),
                            (14.4, -10), (18.0, -7), (22.0, -6), (25.9, -6.5), (26.1, -10),
                            (30.6, -11), (34.0, -11)])
    fcb = curve_log(tabs, [(5.0, 1000), (5.6, 800), (6.5, 680), (8.2, 600), (11.0, 380), (14.4, 340),
                           (18.0, 520), (22.0, 600), (26.0, 260), (30.6, 220), (34.0, 220)])
    roar_db = curve_lin(tabs, [(5.0, -2), (8.2, -4), (11.0, 0), (14.4, 1), (18.0, -1), (22.0, 0),
                               (26.0, 1), (34.0, 2)])
    roar_fc = curve_log(tabs, [(5.0, 260), (8.2, 200), (11.0, 150), (18.0, 190), (26.0, 115), (34, 105)])
    hiss_db = curve_lin(tabs, [(5.0, -8), (6.0, -12), (8.2, -16), (11.0, -24), (18.0, -16),
                               (22.0, -13), (26.0, -26), (34.0, -28)])
    gains = [1.0 + 0.85 * gust * (1 - gpan * (1 if c == 0 else -1)) for c in range(2)]

    def mask(F, T, c):
        tt = np.clip(T[:, 0], 0.0, ct[-1])
        ip = lambda v: np.interp(tt, ct, v)[:, None]          # noqa: E731
        fc = ip(fcb * 2.0 ** (0.55 * lfo_f[c] + 0.9 * gust))
        amp = ip(level * gains[c] * (1.0 + 0.18 * lfo_a[c]))
        band = bp_mag(F, fc, 1.15)
        roar = ip(dbg(roar_db) * (1.0 + 0.7 * buffet)) * lp_mag(F, ip(roar_fc), 2) * hp_mag(F, 25.0, 2)
        hiss = ip(dbg(hiss_db) * (1.0 + 0.6 * gust)) * bp_mag(F, 3500.0, 0.8)
        return amp * (band + roar + hiss)

    x = stft_filter(src, mask)
    ref = x[:, ns(5.6 - ta):ns(8.2 - ta)]
    x *= dbg(-23.0) / rms(ref)
    bus.add(x, ta, fin=0.04, fout=0.01)


# =============================================================================
# 4) thunder (one per LIGHTNING event)
# =============================================================================
def thunder_event(ev, r):
    d, P, mu = ev["dist"], ev["power"], ev["muffled"]
    delay = 0.15 + d / 2000.0
    loud = P / (1.0 + d / 1500.0)
    fc0 = 2400.0 / (1.0 + d / 650.0)
    fc = float(np.exp((1 - mu) * np.log(fc0) + mu * np.log(150.0)))
    T = 6.5
    n = ns(T)
    t = tvec(n)
    env_main = np.zeros(n)
    env_low = np.zeros(n)
    for (ts, length, g) in TL.lightning_strokes(ev):
        onset = (ts - ev["t"]) + delay
        env_main += g * burst(t - onset, 0.03 + 0.05 * d / 1000.0, 0.45 + d / 2500.0 + 0.3 * r.random())
        for _ in range(int(r.integers(3, 7))):
            o = onset + r.uniform(0.04, 0.35 + d / 2000.0)
            env_main += g * r.uniform(0.25, 0.75) * burst(t - o, r.uniform(0.02, 0.08), r.uniform(0.15, 0.55))
        env_low += g * burst(t - onset - 0.05, 0.15, 1.1 + d / 1500.0)
    roll = np.clip(1.0 + 0.35 * slow_noise(r, n, 4.0), 0.2, None)
    main = lp_noise(r, n, fc, 4)
    low = lp_noise(r, n, min(fc, 90.0), 2)
    x = main * env_main * roll + 0.75 * low * env_low
    if d < 1000:
        ca = (1.0 - d / 1000.0) ** 0.5 * 1.6
        cr = bp_noise(r, n, 900, 7000) * burst(t - delay, 0.0008, 0.035)
        for _ in range(int(r.integers(3, 7))):
            o = delay + r.uniform(0.01, 0.2)
            cr += r.uniform(0.2, 0.6) * bp_noise(r, n, 1200, 8000) * burst(t - o, 0.0005, r.uniform(0.006, 0.02))
        cr = lp(cr, max(fc * 5.0, 1500.0), 2)
        x += ca * unit(cr) * 0.35
    x = x / (np.max(np.abs(x)) + 1e-12)
    pan = float(np.clip(ev["az"] / 40.0 + r.uniform(-0.3, 0.3), -0.85, 0.85))
    return x * loud, pan


def make_thunder(B):
    bus = B["thunder"]
    for i, ev in enumerate(TL.LIGHTNING):
        r = rng("thunder-%d" % i)
        x, pan = thunder_event(ev, r)
        bus.add(x, ev["t"], gain=dbg(-9.0), pan=pan, fin=0.001, fout=0.2)


# =============================================================================
# 5) percussion
# =============================================================================
MEMBRANE = [(1.0, 1.0, 1.0), (1.594, 0.45, 0.55), (2.136, 0.3, 0.42), (2.296, 0.22, 0.36),
            (2.653, 0.15, 0.3), (2.918, 0.1, 0.24)]
DRUMS = dict(taiko=(56.0, 64.0, 0.75, 0.45, 0.3), tom=(100.0, 120.0, 0.34, 0.35, 0.45),
             tomhi=(145.0, 170.0, 0.22, 0.3, 0.55), boom=(44.0, 48.0, 1.2, 0.6, 0.12))


def drum_hit(r, kind, vel):
    fa, fb, decay, drop, slap = DRUMS[kind]
    f0 = r.uniform(fa, fb)
    n = ns(decay * 4.0 + 0.1)
    t = tvec(n)
    ph = np.cumsum(f0 * (1.0 + drop * np.exp(-t / 0.035))) / SR
    body = np.zeros(n)
    for ratio, a, dk in MEMBRANE:
        body += a * np.sin(2 * np.pi * ratio * ph + r.uniform(-0.2, 0.2) * (ratio > 1)) * np.exp(-t / (decay * dk))
    sl = bp(r.standard_normal(n), 300.0, 4500.0, 2) * np.exp(-t / 0.011)
    x = body + slap * (0.6 + 0.6 * vel) * sl / (np.std(sl[:ns(0.02)]) + 1e-9) * 0.25
    x *= 1.0 - np.exp(-t / 0.0007)
    x = np.tanh(1.8 * x * (0.6 + 0.4 * vel)) / np.tanh(1.8)
    return x * vel ** 1.3


def make_perc(B):
    bus = B["perc"]
    r = rng("perc")

    def hit(kind, t, vel, pan=0.0, human=0.004, extra=None):
        dt_ = r.uniform(-human, human) if human else 0.0
        v = float(np.clip(vel * r.uniform(0.93, 1.05), 0.05, 1.0))
        x = drum_hit(r, kind, v)
        sec = float(curve_db(t, [(0, 3.0), (10.99, 3.0), (11.0, 2.5), (17.99, 2.5), (18.0, 0.0),
                                 (25.99, 0.0), (26.0, 1.0), (DUR, 1.0)]))
        bus.add(x, t + dt_, gain=sec, pan=pan + r.uniform(-0.08, 0.08), fin=0.0005, fout=0.02)
        if extra == "clang":
            c = clang(r, 1.6, r.uniform(120, 140), tau=1.0)
            bus.add(c * 0.12 * v, t + dt_, pan=r.uniform(-0.3, 0.3), fin=0.0005, fout=0.05)

    # S2: 100 BPM ostinato from 5.6 s (16th = 0.15 s), 3+3+2 accents, building
    s0, st16 = 5.6, 0.15
    for k, v in zip([0, 6, 12, 16, 22, 28, 32], [0.62, 0.55, 0.62, 0.72, 0.68, 0.78, 0.82]):
        hit("taiko", s0 + k * st16, v, 0.0)
    for k, v in zip([10, 14, 15, 20, 26, 27, 30, 31], [0.3, 0.33, 0.28, 0.38, 0.4, 0.34, 0.44, 0.4]):
        hit("tom", s0 + k * st16, v, (-0.45 if k % 2 else 0.45))
    for k, v in zip([33, 34, 35], [0.5, 0.62, 0.76]):
        hit("tomhi" if k < 35 else "tom", s0 + k * st16, v, (-0.5, 0.5, 0.0)[k - 33])

    # S3: heavy half-time on the beep grid (beeps every 1.0 s from 11.25)
    grid3 = [b["t"] for b in TL.BEEPS if b["style"] == "clean"][::2]
    for i, tb in enumerate(grid3):
        hit("taiko", tb, 0.6 + 0.045 * i, 0.0, human=0.0)
        if i >= 2:
            hit("tom", tb + 0.5, 0.36 + 0.03 * i, 0.4 if i % 2 else -0.4)
        if i >= 4:
            hit("tom", tb + 0.75, 0.3 + 0.02 * i, -0.35 if i % 2 else 0.35)
    for j, dt_ in enumerate([0.0, 0.125, 0.25, 0.3125, 0.375, 0.4375]):
        hit("tomhi" if j % 2 else "tom", 17.5 + dt_, 0.45 + 0.08 * j, (-0.5 if j % 2 else 0.5))

    # S4: driving 109 BPM on the distorted-beep grid (0.55 s), more intense
    grid4 = [b["t"] for b in TL.BEEPS if b["style"] == "distorted"]
    nb4 = len(grid4)
    for i, tb in enumerate(grid4):
        prog = i / max(1, nb4 - 1)
        acc = 0.12 if i % 4 == 0 else 0.0
        if tb + 0.1 < T_S5:
            hit("taiko", tb, 0.62 + 0.3 * prog + acc, 0.0, human=0.0)
        if i % 2 == 0 and i >= 6:
            hit("boom", tb, 0.5 + 0.35 * prog, 0.0, human=0.0)
        if tb + 0.275 < T_S5 - 0.05:
            hit("tom", tb + 0.275, 0.34 + 0.3 * prog, 0.45 if i % 2 else -0.45)
        if i % 4 == 3 or (prog > 0.6 and i % 2 == 1):
            for dt_, side in ((0.1375, -0.55), (0.4125, 0.55)):
                if tb + dt_ < T_S5 - 0.05:
                    hit("tomhi", tb + dt_, 0.3 + 0.3 * prog, side)
    for j in range(4):
        hit("tom" if j % 2 == 0 else "tomhi", T_S5 - 0.55 + j * 0.1375, 0.6 + 0.1 * j, (-0.4, 0.4)[j % 2])

    # S5: heavy slow hits, then an accelerating muffled pulse into the cut
    for tb, v in ((27.2, 0.9), (28.4, 0.85), (29.6, 0.95)):
        hit("boom", tb, v, 0.0, human=0.0, extra="clang")
        hit("taiko", tb, v * 0.85, 0.0, human=0.0)
    for tb, v in ((31.1, 0.55), (31.6, 0.6), (32.05, 0.66), (32.45, 0.72), (32.8, 0.78),
                  (33.1, 0.84), (33.35, 0.9)):
        hit("taiko", tb, v, 0.0, human=0.0)
        hit("boom", tb, v * 0.7, 0.0, human=0.0)


# =============================================================================
# 6) sound effects
# =============================================================================
def visor_crack(r, size):
    dur = 0.35 + 0.55 * size
    n = ns(dur)
    t = tvec(n)
    rate = 900.0 * size * np.exp(-t / (0.04 + 0.12 * size)) + 120.0 * size * np.exp(-t / (0.25 * dur))
    ev = r.random(n) < rate / SR
    imp = np.where(ev, r.uniform(0.15, 1.0, n) ** 2 * r.choice([-1.0, 1.0], n), 0.0)
    grain = r.standard_normal(48) * np.exp(-np.arange(48) / 9.0)
    crackle = hp(np.convolve(imp, grain)[:n], 2500.0, 2)
    ring = sum(r.uniform(0.3, 1.0) * resonator(imp, f * r.uniform(0.93, 1.07), r.uniform(0.008, 0.03))
               for f in (3100.0, 4550.0, 6200.0, 8300.0, 10400.0))
    ticks = np.zeros(n)
    for dt_, a in ((0.0, 1.0), (0.006, 0.7), (0.017, 0.5)):
        ticks[ns(dt_)] += a
    ticks = hp(ticks, 1800.0, 2)
    thunk = pitched_thump(n, 120.0, 62.0, 0.03, 0.09, 0.001)
    thunk += 0.5 * unit(lp(r.standard_normal(n), 250.0, 2)) * burst(t, 0.002, 0.03)
    x = (0.7 * peak_norm(crackle) + 0.45 * peak_norm(ring) + 0.6 * peak_norm(ticks)
         + 0.8 * size * peak_norm(thunk))
    return peak_norm(x)


def suit_hum(r, n, f0=120.0):
    ph = np.cumsum(f0 * (1.0 + 0.0015 * slow_noise(r, n, 0.25))) / SR
    x = sum(a * np.sin(2 * np.pi * (k + 1) * ph + r.uniform(0, 2 * np.pi))
            for k, a in enumerate((1.0, 0.55, 0.32, 0.18, 0.11, 0.07)))
    x *= 1.0 + 0.06 * slow_noise(r, n, 1.2)
    fan = lp(r.standard_normal((2, n)), 1800.0, 2)
    return st(x) / 1.2 + 0.05 * unit(fan)


def make_sfx(B):
    sout, sin_, ris = B["sfx_out"], B["sfx_in"], B["riser"]

    # S1: rushing wind-like space transition swelling 3.8 -> 5.0 into the entry
    r = rng("transition")
    d = T_S2 - 3.8
    x = noise_sweep(r, d, [(0, 220), (d * 0.7, 900), (d, 2600)], 0.9,
                    [(0, -50), (d * 0.5, -22), (d * 0.85, -9), (d - 0.02, 0)], color="pink",
                    extra=lambda F, tt: (curve_db(tt, [(0, -60), (d, -6)])[:, None]
                                         * lp_mag(F, 160.0, 2) * hp_mag(F, 25.0, 2)))
    ris.add(peak_norm(x), 3.8, gain=dbg(-12.0), fin=0.05, fout=0.012)

    # metallic stress: creaks at irregular times (S3 mostly, a few later)
    plate = [(420, 0.05, 1.0), (690, 0.04, 0.8), (1130, 0.03, 0.6), (1710, 0.025, 0.45),
             (2480, 0.02, 0.3), (3390, 0.015, 0.2)]
    creaks = [(11.62, 0.7, -9), (12.48, 0.55, -13), (13.07, 0.9, -10), (13.84, 0.5, -14),
              (15.52, 1.0, -9), (16.08, 0.6, -12), (16.93, 0.8, -10), (17.46, 0.45, -13),
              (19.15, 0.7, -14), (22.2, 0.6, -15), (23.85, 0.8, -14),
              (26.75, 1.1, -10), (27.95, 0.9, -11), (29.35, 1.2, -10), (30.15, 0.7, -12)]
    for i, (tc, dur, lev) in enumerate(creaks):
        r = rng("creak-%d" % i)
        sc = r.uniform(0.55, 1.35) * (0.7 if tc > T_S5 else 1.0)
        modes = [(f * sc * r.uniform(0.95, 1.05), tau, a) for (f, tau, a) in plate]
        x = creak(r, dur, modes, rate=(r.uniform(12, 25), r.uniform(35, 70)),
                  bend=r.choice([-1.0, 1.0]) * r.uniform(0.03, 0.08))
        sout.add(x, tc, gain=dbg(lev - 3.0), pan=r.uniform(-0.7, 0.7), fin=0.005, fout=0.03)
    # extra groans: one mid S3 and a deep one in S5 (the suit under load)
    for i, (tg, base, lev) in enumerate([(16.35, 52.0, -10), (28.05, 33.0, -8)]):
        r = rng("groan-%d" % i)
        g1 = metal_groan(r, 2.6, base, bend=-0.07, tau=1.1, swell=(0.4, 0.5))
        g2 = metal_groan(r, 2.6, base * 1.31, bend=-0.05, tau=0.9, swell=(0.6, 0.5))
        sout.add(np.vstack([g1 + 0.4 * g2, 0.4 * g1 + g2]) * 0.8, tg, gain=dbg(lev), fin=0.05, fout=0.1)

    # S4: very low-level hot "sizzle" crackle
    r = rng("sizzle")
    ta, tb = T_S4, T_S5 + 0.4
    n = ns(tb - ta)
    t = ta + tvec(n)
    dens = 380.0 * curve_lin(t, [(ta, 0.0), (ta + 1.0, 1.0), (T_S5 - 0.5, 1.4), (tb, 0.0)])
    x = np.zeros((2, n))
    for c in range(2):
        ev = r.random(n) < dens / SR
        x[c] = np.where(ev, r.uniform(0.1, 1.0, n) ** 3 * r.choice([-1.0, 1.0], n), 0.0)
    x = lp(hp(x, 3000.0, 2), 11000.0, 2)
    x *= 1.0 + 0.5 * slow_noise(r, n, 2.0)
    x *= dbg(-36.0) / rms(x[:, ns(1.5):ns(6.5)])
    sout.add(x, ta, fin=0.2, fout=0.2)

    # visor glass cracks, escalating
    for i, tc in enumerate(TL.VISOR_CRACKS):
        r = rng("crack-%d" % i)
        size = (0.6, 0.82, 1.0)[min(i, 2)]
        x = visor_crack(r, size)
        sin_.add(x, tc, gain=dbg(-13.0 + 3.0 * i), pan=r.uniform(-0.4, 0.4), fin=0.0003, fout=0.03)

    # suit electronics hum inside the helmet (POV windows), stutters with glitch beeps
    glitches = [b["t"] for b in TL.BEEPS if b["style"] == "glitch"]
    for k, (pa, pb) in enumerate(TL.POV_WINDOWS):
        r = rng("hum-%d" % k)
        pb = min(pb, SIL0 + 0.01)
        n = ns(pb - pa)
        t = pa + tvec(n)
        x = suit_hum(r, n)
        stutter = np.ones(n)
        for tg in glitches:
            stutter *= 1.0 - 0.75 * burst(t - tg, 0.004, 0.05)
        x *= stutter * curve_db(t, [(pa, -27), (pb, -25 if k else -27)])
        sin_.add(x, pa, fin=0.02, fout=0.005)


# =============================================================================
# 7) warning beeps
# =============================================================================
def beep_sound(b, r):
    f, dur, style = b["f"], b["dur"], b["style"]
    n = ns(dur)
    t = tvec(n)
    if style == "clean":
        x = 0.8 * sine(f, n) + 0.2 * square(f, n)
        x = lp(x, 6000.0, 2) * fade_edges(n, 0.004, 0.006)
    elif style == "distorted":
        fm = f * (1.0 + 0.012 * np.sin(2 * np.pi * 9.0 * t + r.uniform(0, 6.28)) + 0.006 * slow_noise(r, n, 12.0))
        x = np.tanh(1.8 * (0.9 * sine(fm, n) + 0.2 * square(fm, n))) / np.tanh(1.8)
        x = np.repeat(x[::4], 4)[:n]                       # sample-and-hold (12 kHz)
        x = np.round(x * 24.0) / 24.0                      # ~5.5-bit crush
        x = lp(x, 3200.0, 4) * fade_edges(n, 0.004, 0.008)
    elif style == "failing":
        fm = f * (1.0 - 0.08 * (t / dur) ** 1.3) * (1.0 + 0.006 * np.sin(2 * np.pi * 6.0 * t))
        x = 0.85 * sine(fm, n) + 0.15 * square(fm, n)
        x *= np.exp(-t / (0.55 * dur)) * (0.85 + 0.15 * np.sin(2 * np.pi * 23.0 * t))
        x = lp(x, 5000.0, 2) * fade_edges(n, 0.005, 0.01)
    else:  # glitch
        base = 0.6 * sine(f, n) + 0.6 * square(f, n)
        seg = ns(0.012)
        gate = np.repeat(r.random(-(-n // seg)) > 0.35, seg)[:n].astype(float)
        gate = np.convolve(gate, np.ones(24) / 24.0, mode="same")
        x = base * gate
        if n >= 3 * seg:                                   # stutter: first 12 ms three times
            x[:3 * seg] = np.tile(base[:seg], 3)
        hold = int(r.integers(5, 11))
        x = np.repeat(x[::hold], hold)[:n]
        x = np.round(x * 4.0) / 4.0
        x = lp(x, 5000.0, 4) * fade_edges(n, 0.002, 0.004)
    return x


def make_beeps(bus, bed):
    """Beeps levelled to sit ~10 dB under the local bed peaks."""
    pk = np.max(np.abs(bed), axis=0)
    groups = {}
    for b in TL.BEEPS:
        a, c = ns(b["t"] - 0.5), ns(b["t"] + 0.5)
        groups.setdefault(b["style"], []).append(float(pk[a:c].max()))
    ref = {k: float(np.median(v)) for k, v in groups.items()}
    offs = dict(clean=-11.0, distorted=-11.5, failing=-7.0, glitch=-11.5)
    counters = {}
    for b in TL.BEEPS:
        i = counters.get(b["style"], 0)
        counters[b["style"]] = i + 1
        r = rng("beep-%s-%d" % (b["style"], i))
        x = beep_sound(b, r)
        lev = ref[b["style"]] * dbg(offs[b["style"]])
        if b["style"] == "failing":
            lev *= dbg(-0.6 * i)                           # the suit is weakening
        bus.add(peak_norm(x), b["t"], gain=lev, pan=r.uniform(-0.12, 0.12), fin=0.0, fout=0.0)
    return ref


# =============================================================================
# mix
# =============================================================================
REVERBS = dict(
    small=dict(length=1.0, rt60=(0.5, 0.45, 0.35, 0.25), predelay=0.006),
    hall=dict(length=4.0, rt60=(2.8, 2.3, 1.6, 1.0), predelay=0.022),
    big=dict(length=6.0, rt60=(4.6, 3.6, 2.4, 1.4), predelay=0.03),
    huge=dict(length=8.5, rt60=(6.5, 5.0, 3.2, 1.8), predelay=0.04),
)
# stem: (reverb, send, helmet amount, helmet cutoff Hz, helmet gain dB, group)
STEMS = dict(
    music=("hall", 0.32, 0.5, 1600.0, -2.0, "pre"),
    riser=("hall", 0.30, 0.0, 0.0, 0.0, "pre"),
    impact=("big", 0.50, 0.0, 0.0, 0.0, "pre"),
    wind=("hall", 0.12, 1.0, 900.0, -4.0, "pre"),
    thunder=("big", 0.45, 1.0, 900.0, -4.0, "pre"),
    perc=("hall", 0.30, 0.8, 900.0, -3.0, "pre"),
    sfx_out=("hall", 0.35, 1.0, 900.0, -4.0, "pre"),
    sfx_in=("small", 0.25, 0.0, 0.0, 0.0, "pre"),
    beeps=("small", 0.22, 0.0, 0.0, 0.0, "pre"),
    music_post=("huge", 0.38, 0.0, 0.0, 0.0, "post"),
    impact_post=("huge", 0.55, 0.0, 0.0, 0.0, "post"),
    sfx_post=("hall", 0.35, 0.0, 0.0, 0.0, "post"),
)


def pov_weight():
    w = np.zeros(N)
    t = tvec(N)
    ramp = 0.012
    for (a, b) in TL.POV_WINDOWS:
        w = np.maximum(w, smooth01((t - (a - ramp)) / (2 * ramp)) * (1.0 - smooth01((t - (b - ramp)) / (2 * ramp))))
    return w


def process_stem(name, x, revs, povw):
    rv, send, hamt, hcut, hdb, _ = STEMS[name]
    x = x * dbg(TRIM.get(name, 0.0))
    if name in GLUE:
        x = densify(x, GLUE[name])
    nz = np.flatnonzero(np.any(x != 0.0, axis=0))
    if nz.size == 0:
        return x
    i0 = max(0, nz[0] - 64)
    out = np.zeros_like(x)
    seg = x[:, i0:]
    out[:, i0:] = seg + send * revs[rv](seg) if (rv and send > 0) else seg
    if hamt > 0:
        w = povw * hamt
        lpd = signal.sosfiltfilt(_sos("lowpass", hcut, 2), out, axis=-1) * dbg(hdb)
        out = out * (1.0 - w) + lpd * w
    return out


# =============================================================================
# master
# =============================================================================
_KW = np.array([[1.53512485958697, -2.69169618940638, 1.19839281085285, 1.0, -1.69065929318241, 0.73248077421585],
                [1.0, -2.0, 1.0, 1.0, -1.99004745483398, 0.99007225036621]])


def loudness_blocks(x, block=0.4, hop=0.1):
    y = signal.sosfilt(_KW, x, axis=-1)
    p = np.sum(y * y, axis=0)
    cs = np.concatenate([[0.0], np.cumsum(p)])
    B_, H = ns(block), ns(hop)
    starts = np.arange(0, x.shape[1] - B_ + 1, H)
    z = (cs[starts + B_] - cs[starts]) / B_
    return starts, z


def integrated_lufs(x):
    _, z = loudness_blocks(x)
    lk = -0.691 + 10 * np.log10(z + 1e-20)
    g = z[lk > -70.0]
    if g.size == 0:
        return -np.inf
    rel = -0.691 + 10 * np.log10(g.mean()) - 10.0
    return -0.691 + 10 * np.log10(z[(lk > -70.0) & (lk > rel)].mean())


def true_peak_env(x, os_=4):
    up = signal.resample_poly(x, os_, 1, axis=-1)
    return np.abs(up).reshape(x.shape[0], -1, os_).max(axis=-1).max(axis=0)


def bus_compress(x, thr_db, ratio=2.0, knee=8.0, att=0.02, rel=0.3, ctrl=48):
    C, n = x.shape
    nb = -(-n // ctrl)
    p = np.zeros(nb * ctrl)
    p[:n] = np.mean(x * x, axis=0)
    pb = p.reshape(nb, ctrl).mean(axis=1)
    aa, ar = np.exp(-ctrl / (att * SR)), np.exp(-ctrl / (rel * SR))
    env = np.empty(nb)
    e = 0.0
    for k in range(nb):
        v = pb[k]
        e = (aa if v > e else ar) * (e - v) + v
        env[k] = e
    over = 10 * np.log10(env + 1e-12) - thr_db
    s = 1.0 - 1.0 / ratio
    gr = np.where(over <= -knee / 2, 0.0,
                  np.where(over >= knee / 2, s * over, s * (over + knee / 2) ** 2 / (2 * knee)))
    g = np.interp(np.arange(n), (np.arange(nb) + 0.5) * ctrl, dbg(-gr))
    return x * g, gr


def soft_clip(x, knee_db=-5.0, ceil_db=-0.9):
    t, c = float(dbg(knee_db)), float(dbg(ceil_db))
    a = np.abs(x)
    y = x.copy()
    m = a > t
    y[m] = np.sign(x[m]) * (t + (c - t) * np.tanh((a[m] - t) / (c - t)))
    return y


def limiter(x, ceiling_db, look=0.004, rel=0.12, ctrl=32):
    """Look-ahead true-peak limiter (4x oversampled detector)."""
    C, n = x.shape
    greq = np.minimum(1.0, float(dbg(ceiling_db)) / np.maximum(true_peak_env(x), 1e-12))
    nb = -(-n // ctrl)
    gp = np.ones(nb * ctrl)
    gp[:n] = greq
    gb = gp.reshape(nb, ctrl).min(axis=1)
    L = max(1, int(round(look * SR / ctrl)))
    ga = uniform_filter1d(minimum_filter1d(gb, 2 * L + 1, mode="nearest"), 2 * L + 1, mode="nearest")
    kr = 1.0 - np.exp(-ctrl / (rel * SR))
    gs = np.empty(nb)
    g = 1.0
    for k in range(nb):
        g += (1.0 - g) * kr
        if ga[k] < g:
            g = ga[k]
        gs[k] = g
    g2 = np.minimum(gs, np.minimum(np.r_[gs[1:], 1.0], np.r_[1.0, gs[:-1]]))
    gain = np.interp(np.arange(n), np.arange(nb) * ctrl, g2)
    return x * gain, gain


def mono_bass(x, fc=120.0, amount=0.75):
    """Collapse most of the side signal below fc (coherent low end, mono-safe)."""
    mid, side = 0.5 * (x[0] + x[1]), 0.5 * (x[0] - x[1])
    side = side - amount * signal.sosfiltfilt(_sos("lowpass", fc, 2), side)
    return np.vstack([mid + side, mid - side])


def master(bed, imp):
    """Bus compression on the bed (impacts bypass it), soft clip, true-peak limiter."""
    bed, imp = mono_bass(hp(bed, 18.0, 2)), mono_bass(hp(imp, 18.0, 2))   # DC / subsonic
    ref = dbg(-20.0 - integrated_lufs(bed + imp))
    bed, gr_comp = bus_compress(bed * ref, thr_db=-20.0, ratio=2.0, knee=8.0, att=0.02, rel=0.3)
    mix = bed + imp * ref
    g = TARGET_LUFS - integrated_lufs(mix)
    for _ in range(6):
        y, lim = limiter(soft_clip(mix * dbg(g)), LIMIT_DBTP)
        err = TARGET_LUFS - integrated_lufs(y)
        if abs(err) < 0.03:
            break
        g += err
    return y, dict(comp_gr_max=float(gr_comp.max()), lim_gr_max=float(-20 * np.log10(lim.min())),
                   makeup_db=float(g))


def near_silence_hum():
    """The barely audible very low hum that remains between the cut and the final boom."""
    r = rng("ns-hum")
    a, b = SIL0 - 0.03, SIL1 + 0.15
    n = ns(b - a)
    t = a + tvec(n)
    ph = np.cumsum(60.0 * (1.0 + 0.002 * slow_noise(r, n, 0.3))) / SR
    x = np.zeros((2, n))
    for c in range(2):
        x[c] = sum(amp * np.sin(2 * np.pi * k * ph + r.uniform(0, 2 * np.pi))
                   for k, amp in ((1, 1.0), (2, 0.6), (3, 0.25), (4, 0.1)))
    x *= 1.0 + 0.12 * slow_noise(r, n, 0.7)
    env = smooth01((t - a) / 0.03) * (1.0 - smooth01((t - SIL1) / 0.15))
    x *= env
    win = (t >= SIL0) & (t < SIL1)
    x *= dbg(NEAR_SILENCE_DBFS) / rms(x[:, win])
    out = np.zeros((2, N))
    i0 = ns(a)
    out[:, i0:i0 + n] = x[:, :N - i0]
    return out


# section ride (dB) on the pre-cut bed, like a mixer's fader moves
RIDE = [(0, 0.0), (4.95, 0.0), (5.05, 3.4), (10.95, 3.4), (11.05, 2.0), (17.95, 2.0), (18.05, -0.5),
        (25.95, 2.5), (26.05, 2.3), (DUR, 2.3)]

# report windows: S1..S5 up to the cut, the near-silence, S6 up to the fade, the silent tail
SECTIONS = [(0.0, T_S2), (T_S2, T_S3), (T_S3, T_S4), (T_S4, T_S5), (T_S5, SIL0), (SIL0, SIL1),
            (T_S6, FADE0), (FADE_END, DUR)]


def render(verbose=True):
    t_all = time.time()
    log = (lambda *a: print(*a, flush=True)) if verbose else (lambda *a: None)
    B = {k: Bus(k) for k in STEMS}
    for name, fn in (("music", make_music), ("impacts", make_impacts), ("wind", make_wind),
                     ("thunder", make_thunder), ("perc", make_perc), ("sfx", make_sfx)):
        t0 = time.time()
        fn(B)
        log("  %-8s %5.1fs" % (name, time.time() - t0))

    t0 = time.time()
    revs = {k: Reverb(k, **v) for k, v in REVERBS.items()}
    povw = pov_weight()
    processed = {}
    ride = curve_db(tvec(N), RIDE)
    for name in STEMS:
        if name != "beeps":
            processed[name] = process_stem(name, B[name].x, revs, povw)
            if STEMS[name][5] == "pre" and name != "impact":
                processed[name] *= ride
    bed = sum(processed[k] for k in STEMS if STEMS[k][5] == "pre" and k != "beeps")
    beep_ref = make_beeps(B["beeps"], bed)
    processed["beeps"] = process_stem("beeps", B["beeps"].x, revs, povw)
    log("  reverb+mix %4.1fs" % (time.time() - t0))

    t = tvec(N)
    gate = 1.0 - smooth01((t - (SIL0 - 0.03)) / 0.03)          # everything stops by 33.6
    impacts = ("impact", "impact_post")
    mixes = []
    for sel in (lambda k: k not in impacts, lambda k: k in impacts):
        pre = sum(processed[k] for k in STEMS if STEMS[k][5] == "pre" and sel(k))
        post = sum(processed[k] for k in STEMS if STEMS[k][5] == "post" and sel(k))
        post[:, :ns(T_S6)] = 0.0
        mixes.append(pre * gate + post)

    t0 = time.time()
    y, info = master(*mixes)
    y = y + near_silence_hum()
    fade = np.ones(N)
    a, b = ns(FADE0), ns(FADE_END)
    fade[a:b] = np.cos(0.5 * np.pi * np.arange(b - a) / (b - a)) ** 2
    fade[b:] = 0.0
    y *= fade
    log("  master   %5.1fs" % (time.time() - t0))

    r = rng("dither")
    d = r.random(y.shape) - r.random(y.shape)                 # TPDF, +-1 LSB
    q = np.clip(np.round(y * 32767.0 + d), -32768, 32767).astype(np.int16)
    q[:, fade <= 0.0] = 0                                     # true digital silence at the end
    info.update(beep_ref=beep_ref, seconds=time.time() - t_all)
    return q, y, processed, info


def main():
    print("rendering %s (%d frames @ %d Hz)" % (OUT_PATH, N, SR), flush=True)
    q, y, _, info = render()
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    wavfile.write(OUT_PATH, SR, np.ascontiguousarray(q.T))
    yf = q.astype(np.float64) / 32768.0
    print("integrated %.2f LUFS | true peak %.2f dBTP | comp GR max %.1f dB | limiter GR max %.1f dB"
          % (integrated_lufs(yf), to_db(true_peak_env(yf).max()), info["comp_gr_max"], info["lim_gr_max"]))
    for (a, b) in SECTIONS:
        seg = yf[:, ns(a):ns(b)]
        v = rms(seg)
        print("  %5.1f-%5.1f s  RMS %s" % (a, b, ("%6.1f dBFS" % to_db(v)) if v > 0 else "  -inf (digital silence)"))
    print("frames %d, DC %.2e / %.2e, NaN %s, done in %.1f s"
          % (q.shape[1], yf[0].mean(), yf[1].mean(), bool(np.isnan(y).any()), info["seconds"]))


if __name__ == "__main__":
    main()
