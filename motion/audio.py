#!/usr/bin/env python3
"""Procedural sound design for the logo reveal, locked to timeline.py.

    python3 audio.py build/audio.wav
"""
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

import timeline as TL
from logo_geom import SKELETON

SR = 48000
N = int(TL.DURATION * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(21)


# ------------------------------------------------------------------ utils
def env_adsr(t0, a, hold, r, curve=2.0):
    """Attack (linear-ish), hold, exponential-ish release starting at t0."""
    e = np.zeros(N)
    x = t - t0
    att = (x >= 0) & (x < a)
    e[att] = (x[att] / a) ** 0.8
    h = (x >= a) & (x < a + hold)
    e[h] = 1
    rel = x >= a + hold
    e[rel] = np.exp(-(x[rel] - a - hold) / r * curve)
    return e


def ramp(t0, t1, v0=0.0, v1=1.0):
    return np.interp(t, [t0, t1], [v0, v1])


def sos(kind, f, order=2):
    nyq = SR / 2
    if kind == "band":
        return signal.butter(order, [f[0] / nyq, f[1] / nyq], "bandpass", output="sos")
    return signal.butter(order, f / nyq, kind, output="sos")


def filt(x, kind, f, order=2):
    return signal.sosfilt(sos(kind, f, order), x, axis=-1)


def sweep_bp(x, f_curve, q=1.2, block=256):
    """Band-pass with a time-varying centre frequency (block-wise)."""
    out = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        fc = float(np.clip(f_curve[min(i + block // 2, len(x) - 1)], 40, 18000))
        bw = fc / q
        lo, hi = max(20.0, fc - bw / 2), min(SR / 2 - 100, fc + bw / 2)
        s_ = sos("band", (lo, hi), 1)
        if zi is None:
            zi = np.zeros((s_.shape[0], 2))
        out[i:i + block], zi = signal.sosfilt(s_, x[i:i + block], zi=zi)
    return out


def sweep_lp(x, f_curve, block=256):
    out = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        fc = float(np.clip(f_curve[min(i + block // 2, len(x) - 1)], 40, 20000))
        s_ = sos("low", fc, 2)
        if zi is None:
            zi = np.zeros((s_.shape[0], 2))
        out[i:i + block], zi = signal.sosfilt(s_, x[i:i + block], zi=zi)
    return out


def pan(x, p):
    """Equal-power pan, p in [-1, 1] (scalar or array)."""
    a = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)])


def saw(freq, maxf=4500, detune_lfo=0.0, lfo_rate=0.2, phase0=0.0):
    f = freq * (1 + detune_lfo * np.sin(2 * np.pi * lfo_rate * t + phase0))
    ph = 2 * np.pi * np.cumsum(f) / SR + phase0
    out = np.zeros(N)
    for k in range(1, int(maxf // freq) + 1):
        out += np.sin(k * ph) / k
    return out


def bell(t0, f, amp=1.0, decay=3.0, partials=((1, 1, 1), (2.0, .45, .65), (3.01, .3, .45),
                                               (4.2, .18, .3), (5.43, .1, .22))):
    out = np.zeros(N)
    i0 = int(t0 * SR)
    if i0 >= N:
        return out
    x = t[i0:] - t0
    for ratio, a, d in partials:
        out[i0:] += a * np.sin(2 * np.pi * f * ratio * x) * np.exp(-x / (decay * d))
    out[i0:] *= np.minimum(1, x / 0.004)
    return out * amp


def noise():
    return rng.standard_normal(N)


def pink():
    w = np.fft.rfft(rng.standard_normal(N))
    fr = np.fft.rfftfreq(N, 1 / SR)
    w[1:] /= np.sqrt(fr[1:])
    w[0] = 0
    x = np.fft.irfft(w, N)
    return x / np.std(x)


def db(v):
    return 10 ** (v / 20)


def norm(x):
    return x / (np.max(np.abs(x)) + 1e-9)


L = np.zeros((2, N))        # dry bus
R = np.zeros((2, N))        # reverb send

# ------------------------------------------------------- 1. drone + pads
dark_notes = [73.42, 110.0, 146.83, 174.61]
dark = sum(saw(f, detune_lfo=0.002, lfo_rate=0.11 + 0.03 * i, phase0=i) +
           saw(f * 1.004, detune_lfo=0.002, lfo_rate=0.07 + 0.02 * i, phase0=2 * i)
           for i, f in enumerate(dark_notes))
dark += 0.6 * saw(261.63, detune_lfo=0.002, lfo_rate=0.13) * ramp(9.4, 12.0)
cut = np.interp(t, [0, 3, 9, TL.T_BUILD, TL.T_IMPACT - 0.15], [300, 480, 700, 900, 3200])
dark = sweep_lp(norm(dark), cut)
dark_env = ramp(0.3, 3.5) * (1 + 1.6 * ramp(TL.T_BUILD, TL.T_IMPACT - 0.15) ** 2)
dark_env *= np.interp(t, [TL.T_IMPACT - 0.16, TL.T_IMPACT - 0.1], [1, 0])
dark = norm(dark) * dark_env
L += pan(dark, -0.25) * db(-25) + pan(np.roll(dark, 900), 0.25) * db(-25)
R += np.stack([dark, dark]) * db(-26)

bright_notes = [146.83, 220.0, 293.66, 369.99, 329.63, 440.0]
bright = sum(saw(f, maxf=6000, detune_lfo=0.0025, lfo_rate=0.09 + 0.02 * i, phase0=i) +
             saw(f * 0.997, maxf=6000, detune_lfo=0.0025, lfo_rate=0.05 + 0.03 * i, phase0=3 * i)
             for i, f in enumerate(bright_notes))
bcut = np.interp(t, [TL.T_IMPACT, 18.5, 23, 26, 30, 34, 40], [5000, 2400, 1800, 2600, 3000, 2200, 900])
bright = sweep_lp(norm(bright), bcut)
benv = np.interp(t, [TL.T_IMPACT, TL.T_IMPACT + 0.05, 19, 23, 27, 33, 36, TL.T_FADE0, TL.T_FADE1 + 0.2],
                 [0, 1.0, 0.75, 0.6, 0.85, 0.7, 0.8, 0.7, 0])
bright = norm(bright) * benv * (1 + 0.08 * np.sin(2 * np.pi * 0.23 * t))
L += pan(bright, -0.35) * db(-21) + pan(np.roll(bright, 1300), 0.35) * db(-21)
R += np.stack([bright, bright]) * db(-24)

sub = np.sin(2 * np.pi * 36.71 * t) + 0.5 * np.sin(2 * np.pi * 73.42 * t)
sub_env = ramp(TL.T_IGNITE, 5.0) * 0.25 + 0.6 * ramp(TL.T_BUILD, TL.T_IMPACT - 0.15)
sub_env *= np.where(t < TL.T_IMPACT - 0.12, 1.0, 0.0) + np.where(t >= TL.T_IMPACT, 0.7, 0.0)
sub_env *= np.interp(t, [TL.T_FADE0, TL.T_FADE1], [1, 0])
L += np.stack([sub, sub]) * sub_env * db(-22)

air = filt(pink(), "band", (1800, 7000), 2)
air = norm(air) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t)) * ramp(0, 4) * \
    np.interp(t, [TL.T_FADE0, TL.T_FADE1], [1, 0])
L += np.stack([air, np.roll(air, 4000)]) * db(-40)

# --------------------------------------------------------- 2. ignition
pre = sweep_bp(noise(), np.interp(t, [0.6, TL.T_IGNITE], [400, 5000]), q=2.5)
pre = norm(pre) * ramp(0.6, TL.T_IGNITE) ** 3 * (t < TL.T_IGNITE)
L += np.stack([pre, pre]) * db(-30)
ign = bell(TL.T_IGNITE, 1174.66, 1.0, 3.5) + bell(TL.T_IGNITE, 880.0, 0.7, 3.0) + \
    bell(TL.T_IGNITE + 0.002, 587.33, 0.5, 2.5)
L += np.stack([ign, ign]) * db(-22)
R += np.stack([ign, ign]) * db(-16)
x = np.clip(t - TL.T_IGNITE, 0, None)
thump = np.sin(2 * np.pi * (55 * x - 12 * x * x)) * np.exp(-x / 0.35) * (t >= TL.T_IGNITE)
L += np.stack([thump, thump]) * db(-19)

# ----------------------------------------------------- 3. beam whooshes
starts = sorted({round(TL.T_BEAM + s * TL.BEAM_SCALE, 3) for _, _, _, s, _ in SKELETON})
for k, s0 in enumerate(starts):
    d = 0.75
    fc = np.interp(t, [s0, s0 + d], [500, 6000])
    nz = sweep_bp(noise(), fc, q=1.6)
    e = env_adsr(s0, 0.06, 0.05, 0.45)
    w = norm(nz * e) * e
    p = -0.6 if k % 2 else 0.6
    L += pan(w, np.interp(t, [s0, s0 + d], [p, -p * 0.3])) * db(-27)
    R += np.stack([w, w]) * db(-30)
    zing = np.sin(2 * np.pi * np.cumsum(np.interp(t, [s0, s0 + 0.5], [700, 1400])) / SR) * \
        env_adsr(s0, 0.01, 0.0, 0.25) * (t >= s0)
    L += np.stack([zing, zing]) * db(-38)

# ------------------------------------------- 4. pulses, guides, tracing
ticks = np.zeros(N)
tt_ = TL.T_PULSE
while tt_ < TL.T_IMPACT - 0.2:
    rate = 5 + 25 * max(0.0, (tt_ - TL.T_BUILD) / (TL.T_IMPACT - TL.T_BUILD)) ** 2
    i0 = int(tt_ * SR)
    ln = int(0.006 * SR)
    ticks[i0:i0 + ln] += rng.standard_normal(ln) * np.exp(-np.arange(ln) / (0.0015 * SR)) * \
        rng.uniform(0.3, 1.0)
    tt_ += rng.exponential(1 / rate)
ticks = filt(ticks, "high", 4000.0)
tp = np.sin(2 * np.pi * 0.37 * t)
L += pan(norm(ticks), tp * 0.7) * db(-31)
R += np.stack([ticks, ticks]) * db(-40)

for k in range(16):       # glassy guide pings as the lines shoot out
    s0 = TL.T_GUIDES + k * 0.11 + rng.uniform(0, 0.05)
    g = bell(s0, rng.choice([1760.0, 2349.3, 2637.0, 2959.9]), 0.6, 0.6)
    L += pan(g, rng.uniform(-0.8, 0.8)) * db(-34)
    R += np.stack([g, g]) * db(-30)

hum = (np.sin(2 * np.pi * 1760 * t) * 0.3 + sweep_bp(noise(), np.full(N, 2600.0), q=6) * 0.6)
hum_env = np.interp(t, [TL.T_TRACE, TL.T_TRACE + 0.3, TL.T_TRACE + 3.4, TL.T_TRACE + 4.0], [0, 1, 0.8, 0]) * \
    (0.7 + 0.3 * np.sin(2 * np.pi * 7 * t))
L += np.stack([hum, np.roll(hum, 2000)]) * norm(hum).std() * hum_env * db(-30)

beat = np.zeros(N)
bt = TL.T_TRACE
while bt < TL.T_IMPACT - 0.25:
    period = 1.0 if bt < TL.T_BUILD else max(0.16, 1.0 - 0.84 * (bt - TL.T_BUILD) / (TL.T_IMPACT - 0.3 - TL.T_BUILD))
    x = np.clip(t - bt, 0, None)
    beat += np.sin(2 * np.pi * (120 * x - 350 * x * x).clip(None, 48 * x + 3)) * np.exp(-x / 0.18) * (t >= bt) * \
        (0.6 + 0.4 * min(1.0, (bt - TL.T_TRACE) / 3))
    bt += period
L += np.stack([beat, beat]) * db(-19)

# ------------------------------------------------------------ 5. riser
rs = sweep_bp(noise(), np.geomspace(1, 1, N) * np.interp(t, [TL.T_BUILD, TL.T_IMPACT - 0.12], [300, 9000]), q=1.4)
renv = ramp(TL.T_BUILD, TL.T_IMPACT - 0.12) ** 2.2 * (t < TL.T_IMPACT - 0.12)
L += np.stack([rs, np.roll(rs, 700)]) * renv * db(-17) / (np.std(rs) * 4 + 1e-9)
pf = np.interp(t, [TL.T_BUILD, TL.T_IMPACT - 0.12], [146.83, 587.33])
pr = sum(np.sin(k * 2 * np.pi * np.cumsum(pf) / SR) / k for k in range(1, 8))
L += np.stack([pr, pr]) * renv * db(-28)
R += np.stack([rs, rs]) * renv * db(-28) / (np.std(rs) * 4 + 1e-9)

# ------------------------------------------------------------ 6. impact
ti = TL.T_IMPACT
x = np.clip(t - ti, 0, None)
on = t >= ti
boom = np.sin(2 * np.pi * np.cumsum(32 + 70 * np.exp(-x / 0.12)) / SR) * np.exp(-x / 1.4) * on
boom = np.tanh(boom * 1.8)
crack = filt(noise(), "low", 3500.0) * np.exp(-x / 0.09) * on
metal = sum(a * np.sin(2 * np.pi * f * x) * np.exp(-x / d)
            for f, a, d in ((146.83, 1, 2.5), (219.5, .6, 2.0), (311.3, .4, 1.6),
                            (452.0, .3, 1.2), (587.3, .35, 1.8), (893.0, .15, 0.8))) * on
crash = filt(noise(), "high", 3000.0) * np.exp(-x / 0.9) * on
L += np.stack([boom, boom]) * db(-3)
L += np.stack([crack, np.roll(crack, 300)]) * db(-14)
L += np.stack([metal, metal]) * db(-21)
L += np.stack([crash, np.roll(crash, 1100)]) * db(-33)
R += np.stack([crack + metal * 0.5, crack + metal * 0.5]) * db(-14)
R += np.stack([crash, crash]) * db(-28)

for k in range(10):       # glittering debris with the sparks
    s0 = ti + 0.05 + rng.exponential(0.5)
    g = bell(s0, rng.choice([1174.7, 1480.0, 1760.0, 2349.3, 2960.0]), 0.4, 0.8)
    L += pan(g, rng.uniform(-0.9, 0.9)) * db(-34)
    R += np.stack([g, g]) * db(-30)

# ----------------------------------------------- 7. 3D move and the spin
for s0, d, f0, f1, lvl in ((TL.T_3D - 0.2, 2.6, 300, 2500, -24),
                           (TL.T_SPIN0, TL.T_SPIN1 - TL.T_SPIN0, 250, 1800, -16),
                           (TL.T_RETURN0, 2.6, 2200, 400, -27)):
    shape = np.sin(np.pi * np.clip((t - s0) / d, 0, 1)) ** 2
    fc = f0 + (f1 - f0) * shape
    w = sweep_bp(noise(), fc, q=1.3)
    w = w / (np.std(w[(t > s0) & (t < s0 + d)]) + 1e-9) * shape * 0.25
    if s0 == TL.T_SPIN0:
        ang = 2 * np.pi * np.clip((t - s0) / d, 0, 1) ** 1.0
        L += pan(w, 0.8 * np.sin(ang * 1.0)) * db(lvl)
    else:
        L += np.stack([w, np.roll(w, 900)]) * db(lvl)
    R += np.stack([w, w]) * db(lvl - 4)

# ----------------------------------------------------------- 8. glints
penta = [1174.66, 1318.51, 1479.98, 1760.0, 1975.53, 2349.32, 2637.02]
for g0, dur, n in ((TL.T_GLINT1, 1.2, 9), (TL.T_RETURN1 - 0.9, 1.3, 6), (TL.T_GLINT2, 1.4, 12)):
    for k in range(n):
        u = k / max(1, n - 1)
        s0 = g0 + u * dur * 0.8 + rng.uniform(0, 0.04)
        g = bell(s0, penta[(k * 3) % len(penta)] * (2 if k % 4 == 3 else 1), 0.5, 1.4)
        L += pan(g, -0.8 + 1.6 * u) * db(-31)
        R += np.stack([g, g]) * db(-26)

# final sting: warm low hit with a chord bloom
fs = TL.T_GLINT2
x = np.clip(t - fs, 0, None)
on = t >= fs
sting = (np.sin(2 * np.pi * 73.42 * x) + 0.5 * np.sin(2 * np.pi * 146.83 * x)) * np.exp(-x / 2.2) * on * \
    np.minimum(1, x / 0.01)
L += np.stack([sting, sting]) * db(-17)
chord = sum(bell(fs + 0.03 * i, f, 0.5, 4.0) for i, f in enumerate([293.66, 369.99, 440.0, 587.33, 659.26]))
L += np.stack([chord, chord]) * db(-25)
R += np.stack([chord, chord]) * db(-20)

# ------------------------------------------------------------- reverb
ir_len = int(3.6 * SR)
ir_t = np.arange(ir_len) / SR
ir = rng.standard_normal((2, ir_len)) * np.exp(-ir_t * 6.9 / 3.4)
ir = filt(ir, "low", 6000.0)
ir[:, :int(0.025 * SR)] = 0
ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
wet = np.stack([signal.fftconvolve(R[c], ir[c])[:N] for c in range(2)])
mix_ = L + wet * 0.9

# --------------------------------------------------------------- master
mix_ = filt(mix_, "high", 28.0)
mix_ *= np.interp(t, [0, 0.05, TL.DURATION - 0.25, TL.DURATION], [0, 1, 1, 0])
rms = np.sqrt(np.mean(mix_ ** 2))
mix_ *= db(-17) / rms
mix_ = np.tanh(mix_ * 1.2) / 1.2
mix_ *= db(-1.0) / np.max(np.abs(mix_))
out = sys.argv[1] if len(sys.argv) > 1 else "build/audio.wav"
wavfile.write(out, SR, (mix_.T * 32767).astype(np.int16))
print("wrote", out, "rms dBFS", round(20 * np.log10(np.sqrt(np.mean(mix_ ** 2))), 1))
