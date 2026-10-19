"""Soundtrack for WHAT IF SUPERMAN ATTACKED NEW YORK?  (exactly 40.0 s, 48 kHz stereo)

Every cue is placed from timeline.py, so picture and sound stay locked.  Buses:

  scene  what the phone hears: street ambience, the flybys (rendered from the real flight path with
         distance, air absorption and Doppler), destruction, crowd, the operator's steps, breath and
         handling noise.  It goes through a phone-microphone chain (band-limiting, AGC pumping,
         capsule clipping on the big hits), is muffled for the CCTV insert, and collapses into a
         low, ringing muffle after the final impact.
  low    a clean sub layer under the big events (a phone can't record it, a film can't do without it).
  score  a restrained synth/orchestral score: drone, swell, ostinato, braams, drums, final hit.
  ears   the post-impact tinnitus ring (subjective, not through the mic).

A handful of ElevenLabs sound effects (crowd reactions, ambience, glass, beam, breathing, braam...)
are layered on top of the synthesis when present in SFX_DIR as <name>.wav; every cue also has a
synthesized fallback, so the mix renders without them.

Usage:  python3 sound_design.py SFX_DIR OUT.wav [--stems DIR]
"""
import os
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import timeline as TL  # noqa: E402

SR = 48000
N = int(round(TL.DURATION * SR))
C_SOUND = 343.0
CCTV = (TL.SHOTS[3][1] / TL.FPS, (TL.SHOTS[3][2] + 1) / TL.FPS)      # 20.0 .. 23.5 s
FIREBALLS = np.linspace(TL.T_BEAM_ON + 0.15, TL.T_BEAM_OFF - 0.1, 7)   # as in blender/fx.py
SPRINTERS = ((-15.25, 36.45), (-14.2, 36.95), (-15.6, 37.55), (-13.4, 38.2))  # blender/crowd.py
SPRINT_V = 5.0

# D minor
D1, A1, D2, F2, G2, A2, BB2, C3, D3, E3, F3, A3, D4, D5, A5 = (
    36.71, 55.0, 73.42, 87.31, 98.0, 110.0, 116.54, 130.81, 146.83, 164.81, 174.61, 220.0, 293.66,
    587.33, 880.0)


# ============================================================================= basic helpers
def sec(t):
    return int(round(t * SR))


def tt(n):
    return np.arange(n) / SR


def stereo(x):
    x = np.asarray(x, np.float64)
    return np.stack([x, x], axis=1) if x.ndim == 1 else x


def mono(x):
    x = np.asarray(x, np.float64)
    return x.mean(axis=1) if x.ndim == 2 else x


def db(g):
    return 10.0 ** (np.asarray(g, np.float64) / 20.0)


def butter(x, kind, f, order=2):
    sos = signal.butter(order, f, btype=kind, fs=SR, output='sos')
    return signal.sosfilt(sos, np.asarray(x, np.float64), axis=0)


def peaking(x, f0, gain_db, q=1.0):
    """RBJ peaking EQ."""
    A = 10 ** (gain_db / 40.0)
    w = 2 * np.pi * f0 / SR
    al = np.sin(w) / (2 * q)
    b = np.array([1 + al * A, -2 * np.cos(w), 1 - al * A])
    a = np.array([1 + al / A, -2 * np.cos(w), 1 - al / A])
    return signal.lfilter(b / a[0], a / a[0], x, axis=0)


def lp_sweep(x, cutoff, block=256):
    """2-pole low-pass whose cutoff (Hz; scalar or per-sample array) moves over time."""
    x = np.asarray(x, np.float64)
    X = x[:, None] if x.ndim == 1 else x
    cut = np.broadcast_to(np.asarray(cutoff, np.float64), (len(X),))
    out = np.empty_like(X)
    zi = np.zeros((1, 2, X.shape[1]))
    for i in range(0, len(X), block):
        fc = float(np.clip(cut[i], 25.0, SR * 0.45))
        sos = signal.butter(2, fc, 'low', fs=SR, output='sos')
        out[i:i + block], zi = signal.sosfilt(sos, X[i:i + block], axis=0, zi=zi)
    return out[:, 0] if x.ndim == 1 else out


def fade(x, fin=0.005, fout=0.005):
    """Equal-power (sine) fades in and out."""
    x = np.array(x, np.float64)
    n = len(x)
    w = np.ones(n)
    a, b = min(n, sec(fin)), min(n, sec(fout))
    if a > 0:
        w[:a] = np.sin(np.linspace(0, np.pi / 2, a))
    if b > 0:
        w[n - b:] *= np.cos(np.linspace(0, np.pi / 2, b))
    return x * (w[:, None] if x.ndim == 2 else w)


def curve(points, n=N, t0=0.0):
    """Piecewise-linear automation from (absolute time, value) breakpoints."""
    p = np.array(points, np.float64)
    return np.interp(t0 + tt(n), p[:, 0], p[:, 1])


def seg(x, a, b):
    return x[sec(a):sec(b)]


def varispeed(x, ratio):
    """Play `ratio` times faster (tape-style: pitch and tempo together)."""
    x = np.asarray(x, np.float64)
    n = int(len(x) / ratio)
    src = np.arange(n) * ratio
    grid = np.arange(len(x))
    if x.ndim == 1:
        return np.interp(src, grid, x)
    return np.stack([np.interp(src, grid, x[:, c]) for c in range(x.shape[1])], 1)


def white(n, rng):
    return rng.standard_normal(n)


def _shaped(n, rng, power):
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    X /= f ** power
    X[f < 12] = 0
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-12)


def pink(n, rng):
    return _shaped(n, rng, 0.5)


def brown(n, rng):
    return _shaped(n, rng, 1.0)


def lfo(n, rate, rng):
    """Smooth random control signal in about [-1, 1], changing at roughly `rate` Hz."""
    k = int(n / SR * rate) + 3
    pts = rng.uniform(-1, 1, k)
    x = np.linspace(0, k - 2, n)
    i = np.floor(x).astype(int)
    w = (1 - np.cos(np.pi * (x - i))) / 2
    return pts[i] * (1 - w) + pts[i + 1] * w


def poisson_times(t0, t1, rate, rng, rmax):
    """Event times of an inhomogeneous Poisson process (thinning); rate(t) <= rmax."""
    out, t = [], t0
    while True:
        t += rng.exponential(1.0 / rmax)
        if t >= t1:
            return out
        if rng.random() < rate(t) / rmax:
            out.append(t)


def saw(freq, n, phase=0.0):
    """Band-limited sawtooth (polyBLEP); freq scalar or per-sample array."""
    f = np.broadcast_to(np.asarray(freq, np.float64), (n,))
    dt = f / SR
    ph = (phase + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    t = ph[m] / dt[m]
    y[m] -= t + t - t * t - 1
    m = ph > 1 - dt
    t = (ph[m] - 1) / dt[m]
    y[m] -= t * t + t + t + 1
    return y


def sweep_phase(freq):
    return 2 * np.pi * np.cumsum(freq) / SR


def convolve(x, ir):
    x = stereo(x)
    return np.stack([signal.fftconvolve(x[:, c], ir[:, c]) for c in range(2)], 1)


def make_ir(rt60, lp_hz=6000, seed=0, early=(), width=1.0, pre=0.008, length=None):
    """Stereo noise reverb that darkens as it decays, plus optional discrete reflections."""
    rng = np.random.default_rng(seed)
    n = sec(length or rt60 * 1.1)
    t = tt(n)
    ir = rng.standard_normal((n, 2)) * np.exp(-6.9 * t / rt60)[:, None]
    w = np.clip(t / (0.5 * rt60), 0, 1)[:, None]
    ir = butter(ir, 'low', lp_hz) * (1 - w) + butter(ir, 'low', lp_hz * 0.22) * w
    k = sec(pre)
    ir[:k] = 0
    ir[k:k + sec(0.02)] *= np.linspace(0, 1, len(ir[k:k + sec(0.02)]))[:, None]
    for d, g, p in early:
        i = sec(d)
        burst = butter(rng.standard_normal(sec(0.012)), 'low', 2500) * np.hanning(sec(0.012)) * g * 6
        i1 = min(n, i + len(burst))
        ir[i:i1, 0] += burst[:i1 - i] * (1 - p) / 2
        ir[i:i1, 1] += burst[:i1 - i] * (1 + p) / 2
    m, s = (ir[:, 0] + ir[:, 1]) / 2, (ir[:, 0] - ir[:, 1]) / 2 * width
    ir = np.stack([m + s, m - s], 1)
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


class Bus:
    def __init__(self, name):
        self.name = name
        self.x = np.zeros((N, 2))

    def add(self, sig, t0, gain=1.0, pan=0.0):
        s = stereo(sig) * gain
        if pan:
            th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
            s = s * (np.array([np.cos(th), np.sin(th)]) * np.sqrt(2))
        i0 = sec(t0)
        j0 = max(0, -i0)
        i0 = max(0, i0)
        n = min(len(s) - j0, N - i0)
        if n > 0:
            self.x[i0:i0 + n] += s[j0:j0 + n]


class Mix:
    """Buses plus sends; `put` places a cue on the scene with optional city reverb / far echoes."""

    def __init__(self, sfx):
        self.sfx = sfx
        self.scene, self.verb, self.echo = Bus("scene"), Bus("verb"), Bus("echo")
        self.low, self.score, self.hall, self.ears = Bus("low"), Bus("score"), Bus("hall"), Bus("ears")

    def put(self, sig, t0, gain=1.0, pan=0.0, verb=0.0, echo=0.0):
        self.scene.add(sig, t0, gain, pan)
        if verb:
            self.verb.add(sig, t0, gain * verb, pan)
        if echo:
            self.echo.add(sig, t0, gain * echo, pan)

    def music(self, sig, t0, gain=1.0, pan=0.0, hall=0.3):
        self.score.add(sig, t0, gain, pan)
        if hall:
            self.hall.add(sig, t0, gain * hall, pan)


class SFX:
    def __init__(self, folder):
        self.folder = folder
        self.cache = {}

    def get(self, name):
        if name not in self.cache:
            p = os.path.join(self.folder, name + ".wav") if self.folder else ""
            x = None
            if p and os.path.exists(p):
                sr, x = wavfile.read(p)
                x = x.astype(np.float64)
                if x.dtype.kind == 'i':
                    x /= 32768.0
                if sr != SR:
                    x = signal.resample_poly(x, SR, sr, axis=0)
                x = stereo(x)
            self.cache[name] = x
        return self.cache[name]


def tile(src, dur, rng, region=None, seglen=(2.2, 3.6), xf=0.45, ratio=(0.96, 1.04)):
    """Fill `dur` seconds with crossfaded, slightly re-pitched pieces of `src` (stereo)."""
    src = stereo(src)
    a0, a1 = region or (0.0, len(src) / SR)
    out = np.zeros((sec(dur) + sec(8), 2))
    pos = 0
    while pos < sec(dur):
        r = rng.uniform(*ratio)
        L = min(rng.uniform(*seglen), (a1 - a0) / r - xf - 0.01)
        a = rng.uniform(a0, a1 - (L + xf) * r)
        piece = fade(varispeed(seg(src, a, a + (L + xf) * r), r), xf, xf)
        out[pos:pos + len(piece)] += piece
        pos += len(piece) - sec(xf)
    return out[:sec(dur)]


def loop(src, dur):
    src = stereo(src)
    reps = int(np.ceil(sec(dur) / len(src)))
    return np.tile(src, (reps, 1))[:sec(dur)]


# ============================================================================= geometry
_GRID = np.arange(0.0, TL.DURATION + 0.02, 0.01)
_OPER = np.array([TL.operator_pos(float(t)) for t in _GRID])


def interp_rows(tq, ts, P):
    return np.stack([np.interp(tq, ts, P[:, k]) for k in range(P.shape[1])], 1)


def listener(t):
    """Phone microphone position (m) at times t; it falls to the pavement during the drop."""
    t = np.atleast_1d(np.asarray(t, np.float64))
    L = interp_rows(t, _GRID, _OPER)
    L[:, 2] += TL.CURB_H - 0.08
    u = np.clip((t - TL.T_DROP) / (TL.T_PHONE_LAND - TL.T_DROP), 0, 1)[:, None] ** 2
    return L * (1 - u) + np.array(TL.PHONE_REST) * u


def dist_to(p, t):
    return float(np.linalg.norm(np.array(p) - listener(t)[0]))


def arrival(p, t):
    """Time a sound emitted at point p at time t reaches the phone."""
    return t + dist_to(p, t) / C_SOUND


def air(x, d):
    """Distance colouring: high frequencies die out with distance."""
    return butter(x, 'low', float(np.clip(16000.0 / (1.0 + d / 45.0), 900, 16000)))


# ============================================================================= synthesized cues
def footstep(rng, low=1.0, scuff=0.6, dur=0.22):
    n = sec(dur)
    t = tt(n)
    th = butter(rng.standard_normal(n), 'low', 320) * np.exp(-t / 0.014) * 3.0
    th += np.sin(2 * np.pi * rng.uniform(70, 100) * t) * np.exp(-t / 0.025) * 0.6
    d = rng.uniform(0.008, 0.02)
    sc = butter(rng.standard_normal(n), 'band', [900, 6500]) * np.exp(-np.maximum(t - d, 0) / 0.03) * (t > d)
    return (th * low + sc * scuff) * 0.5


def horn(dur, rng, f=(415.0, 495.0)):
    n = sec(dur)
    t = tt(n)
    x = np.zeros(n)
    for fi in f:
        ph = 2 * np.pi * fi * t + 0.2 * np.sin(2 * np.pi * 5 * t + rng.uniform(0, 6))
        x += sum(np.sin(k * ph) / k for k in range(1, 18, 2))
    x = butter(np.tanh(1.5 * x), 'band', [300, 3800])
    return fade(x, 0.015, 0.05) * 0.3


def car_pass(dur, t_c, closest, speed, rng, engine=55.0):
    """A car driving past: tyre roar and engine hum shaped by distance."""
    n = sec(dur)
    t = tt(n)
    d = np.sqrt(closest ** 2 + (speed * (t - t_c)) ** 2)
    tyre = butter(pink(n, rng), 'band', [250, 4500]) * 0.6
    f = engine * (1 - 0.06 * np.tanh((t - t_c) * speed / 8))       # small Doppler drop
    eng = butter(saw(f, n) + 0.5 * saw(2 * f, n), 'low', 500) * 0.25
    return fade((tyre + eng) * (6.0 / (d + 2.0)), 0.3, 0.4)


def sonic_boom(rng):
    n = sec(0.6)
    t = tt(n)
    x = np.zeros(n)
    k = sec(0.095)
    x[:k] = np.linspace(1.0, -1.0, k)                     # N-wave: two cracks, linear pressure ramp
    x = butter(x, 'low', 3200)
    x += rng.standard_normal(n) * np.exp(-t / 0.004) * 0.5
    x += np.roll(rng.standard_normal(n) * np.exp(-t / 0.004) * 0.45, k)
    x += butter(rng.standard_normal(n), 'low', 700) * np.exp(-t / 0.09) * 0.5
    return x


def boom_low(dur=1.6, f0=42.0, f1=26.0, tau=0.5):
    n = sec(dur)
    t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / 0.25)
    return np.sin(sweep_phase(f)) * np.exp(-t / tau) * fade(np.ones(n), 0.004, 0.2)


def explosion(rng, size=1.0, dur=2.6):
    n = sec(dur)
    t = tt(n)
    crack = rng.standard_normal(n) * np.exp(-t / 0.006) * 0.9
    body = butter(rng.standard_normal(n), 'low', 1100) * np.exp(-t / (0.22 * size)) * 1.1
    roll = butter(rng.standard_normal(n), 'low', 260) * np.exp(-t / (0.7 * size)) * (0.6 + 0.4 * lfo(n, 9, rng)) * 1.2
    grit = butter(rng.standard_normal(n), 'high', 2500) * (rng.random(n) < 0.03) * np.exp(-t / 0.5) * 2.5
    return (crack + body + roll + grit) * size


def tink(rng):
    n = sec(0.12)
    t = tt(n)
    x = rng.standard_normal(n) * np.exp(-t / 0.0015) * 0.5
    for _ in range(3):
        x += np.sin(2 * np.pi * rng.uniform(2600, 9500) * t + rng.uniform(0, 6.3)) * \
            np.exp(-t / rng.uniform(0.008, 0.045)) * rng.uniform(0.3, 1.0)
    return x


def thud(rng, size=1.0):
    n = sec(0.6)
    t = tt(n)
    low = butter(rng.standard_normal(n), 'low', 170) * np.exp(-t / 0.06) * 3.0
    crunch = butter(rng.standard_normal(n), 'band', [400, 3500]) * np.exp(-t / 0.035) * rng.uniform(0.4, 1.1)
    grit = butter(rng.standard_normal(n), 'high', 2500) * (rng.random(n) < 0.06) * np.exp(-t / 0.1) * 2.0
    return (low + crunch + grit) * size


def glass_crash(rng, dur=2.5):
    n = sec(dur)
    t = tt(n)
    x = butter(rng.standard_normal(n), 'high', 1800) * np.exp(-t / 0.35) * 0.5
    for ti in poisson_times(0.0, dur * 0.8, lambda s: 260 * np.exp(-s / 0.4), rng, 260):
        k = tink(rng)
        i = sec(ti)
        x[i:i + len(k)] += k[:len(x) - i] * rng.uniform(0.2, 0.8)
    return x


def clang(rng):
    n = sec(0.6)
    t = tt(n)
    f0 = rng.uniform(450, 900)
    x = rng.standard_normal(n) * np.exp(-t / 0.003)
    for r in (1.0, 2.32, 3.67, 5.1, 6.9):
        x += np.sin(2 * np.pi * f0 * r * t + rng.uniform(0, 6)) * np.exp(-t / (0.2 / np.sqrt(r))) * rng.uniform(0.4, 1)
    return x * 0.3


def charge_hum(dur):
    n = sec(dur)
    u = tt(n) / dur
    ph = sweep_phase(70 + 120 * u ** 2)
    x = sum(np.sin(k * ph) / k ** (1.7 - 1.1 * u) for k in range(1, 18))
    return x * u ** 1.5 * 0.4


def beam_tone(dur, rng):
    n = sec(dur)
    t = tt(n)
    f = 150 + 9 * np.sin(2 * np.pi * 6.5 * t) + 25 * lfo(n, 3, rng)
    ph = sweep_phase(f)
    x = sum(np.sin(k * ph) / k for k in range(1, 40))
    tone = butter(x, 'band', [180, 3200]) * 0.5
    sizzle = butter(rng.standard_normal(n), 'high', 3500) * (0.5 + 0.5 * np.abs(lfo(n, 25, rng))) * 0.5
    crackle = butter((rng.random(n) < 0.004) * rng.standard_normal(n) * 6, 'band', [1500, 9000])
    return fade(tone + sizzle + crackle, 0.02, 0.25)


def gust(dur, peak, rng, lo=60, hi=1400, width=0.3):
    n = sec(dur)
    t = tt(n)
    x = butter(pink(n, rng), 'band', [lo, hi])
    env = np.exp(-((t - peak) / (dur * width)) ** 2) * (0.65 + 0.35 * lfo(n, 7, rng))
    return x * env


def mic_wind(dur, rng, rate=6.0):
    """Wind buffeting the phone's microphone port: boomy, gusty rumble."""
    n = sec(dur)
    x = butter(rng.standard_normal(n), 'low', 240) * 3.0
    env = np.clip(lfo(n, rate, rng) * 1.4 + 0.25, 0, None) ** 2
    return fade(x * env, 0.1, 0.2)


def handling(dur, rng, knocks=6):
    """Fingers rubbing and knocking the phone body."""
    n = sec(dur)
    x = butter(rng.standard_normal(n), 'band', [120, 2400]) * np.clip(lfo(n, 14, rng), 0, None) ** 2 * 0.7
    for _ in range(knocks):
        i = rng.integers(0, max(1, n - sec(0.06)))
        k = butter(rng.standard_normal(sec(0.05)), 'low', rng.uniform(300, 1500)) * np.exp(-tt(sec(0.05)) / 0.006)
        x[i:i + len(k)] += k * rng.uniform(0.6, 1.6)
    return fade(x, 0.01, 0.03)


def paper_flutter(dur, rng, rate=35):
    n = sec(dur)
    x = np.zeros(n)
    for ti in poisson_times(0, dur, lambda s: rate, rng, rate):
        m = sec(rng.uniform(0.02, 0.07))
        b = butter(rng.standard_normal(m), 'band', [1500, 8000]) * np.hanning(m) * rng.uniform(0.2, 1)
        i = sec(ti)
        x[i:i + m] += b[:n - i]
    return x


def window_rattle(dur, rng, f=23.0):
    n = sec(dur)
    t = tt(n)
    am = (0.5 + 0.5 * np.sin(2 * np.pi * (f + 3 * lfo(n, 2, rng)) * t)) ** 4
    return butter(rng.standard_normal(n), 'band', [1500, 5000]) * am


def car_alarm_synth(dur, rng):
    n = sec(dur)
    t = tt(n)
    cyc = t % 6.0
    f = np.where(cyc < 2.0, 1100 + 500 * signal.sawtooth(2 * np.pi * 4 * t, 0.5),        # wail
                 np.where(cyc < 4.0, 700 + 900 * ((t * 2) % 1.0),                         # whoop
                          1250.0))                                                         # beep
    x = np.sin(sweep_phase(f)) + 0.3 * np.sin(2 * sweep_phase(f))
    gate = np.where((cyc >= 4.0) & (((t * 6) % 1.0) > 0.5), 0.0, 1.0)
    x = np.tanh(2.5 * x * butter(gate, 'low', 300))
    return butter(x, 'band', [500, 4500]) * 0.5


def siren(dur):
    n = sec(dur)
    t = tt(n)
    f = 1050 + 380 * np.sin(2 * np.pi * t / 4.3)
    ph = sweep_phase(f)
    return butter(np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph), 'band', [500, 3000])


def screech(dur, rng):
    n = sec(dur)
    t = tt(n)
    f = 1550 + 300 * lfo(n, 7, rng) - 450 * t / dur
    ph = sweep_phase(f)
    tone = (np.sin(ph) + 0.4 * np.sin(2 * ph + 0.5)) * (0.6 + 0.4 * lfo(n, 40, rng))
    rough = butter(rng.standard_normal(n), 'band', [900, 4200]) * 0.45
    return fade(tone + rough, 0.04, 0.35) * 0.5


def elec_buzz(dur, rng):
    n = sec(dur)
    t = tt(n)
    x = sum(np.sin(2 * np.pi * 120 * k * t + rng.uniform(0, 6)) / k ** 0.8 for k in range(1, 26))
    x = butter(np.tanh(2.5 * x), 'band', [100, 7000])
    gate = butter((lfo(n, 11, rng) > -0.25).astype(float), 'low', 150)        # flickering contact
    crack = butter((rng.random(n) < 0.003) * rng.standard_normal(n) * 8, 'band', [2000, 9000])
    return (x * gate * 0.35 + crack) * fade(np.ones(n), 0.01, 0.3)


def creak(dur, rng):
    n = sec(dur)
    f = 140 + 90 * tt(n) / dur + 18 * lfo(n, 6, rng)
    x = saw(f, n) * (0.6 + 0.4 * lfo(n, 30, rng))
    return fade(butter(x, 'band', [200, 2600]), 0.04, 0.3)


def tinnitus(dur):
    t = tt(sec(dur))
    return (0.7 * np.sin(2 * np.pi * 3960 * t) + 0.3 * np.sin(2 * np.pi * 3966.5 * t + 1.0) +
            0.1 * np.sin(2 * np.pi * 6230 * t))


# ============================================================================= flight sound
def flyby(m, t0, t1, gain, rng, flutter=0.0):
    """Superman's air-tearing roar at the phone: retarded-time solve along SUPERMAN_PATH, so
    loudness (1/r), air absorption and the Doppler shift all follow the real flight path.
    Returns (listener time when it is loudest, distance then)."""
    t = np.arange(sec(t0), sec(t1)) / SR
    ts = np.arange(t0 - 2.0, t1 + 0.01, 0.002)                    # emission times
    P = np.array([TL.superman_pos(float(x)) for x in ts])
    spd_path = np.linalg.norm(np.gradient(P, ts, axis=0), axis=1)
    arr = ts + np.linalg.norm(P - listener(ts), axis=1) / C_SOUND
    dist = np.linalg.norm(P - listener(arr), axis=1)
    arr = ts + dist / C_SOUND
    # first arrivals only: where he outruns his own sound the arrivals fold over (that's the boom)
    arr = np.maximum.accumulate(arr) + np.arange(len(arr)) * 1e-9
    tau = np.interp(t, arr, ts)
    d = np.interp(t, arr, dist)
    spd = np.interp(tau, ts, spd_path)
    e0 = int(np.floor(tau.min() * SR)) - 8
    ne = int(np.ceil(tau.max() * SR)) + 8 - e0
    roar = butter(pink(ne, rng), 'band', [110, 6500]) + butter(rng.standard_normal(ne), 'band', [2000, 9000]) * 0.3
    dark = butter(roar, 'low', 650)
    low = butter(brown(ne, rng), 'low', 140) * 1.3
    flap = butter(rng.standard_normal(ne), 'band', [220, 1700]) * \
        (0.5 + 0.5 * np.sin(2 * np.pi * 19 * np.arange(ne) / SR)) ** 3 * 2.2
    pos = tau * SR - e0
    grid = np.arange(ne)

    def at(s):
        return np.interp(pos, grid, s)

    w = np.clip((d - 12) / 140, 0, 1)
    loud = np.clip(spd / 140.0, 0, 1.8) ** 1.6
    att = 8.0 / np.maximum(d, 4.0)
    sig = (at(roar) * (1 - w) + at(dark) * w + at(low) +
           flutter * at(flap) * np.clip(spd / 40, 0, 1)) * loud * att * gain
    m.put(fade(sig, 0.25, 0.25), t0, verb=0.25)
    m.low.add(fade(at(low) * loud * att * gain * 0.15, 0.25, 0.25), t0)
    i = int(np.argmax(loud * att))
    return t[i], d[i]


# ============================================================================= scene cues
def ambience(m, rng):
    # traffic rumble + tyre hiss; traffic stops after the boom, the street is near silent in scene 5
    rum = butter(brown(N, rng), 'low', 220) * (0.75 + 0.25 * lfo(N, 0.3, rng))
    hiss = butter(pink(N, rng), 'band', [600, 5000]) * np.clip(0.45 + 0.55 * lfo(N, 0.25, rng), 0, None)
    env = curve([(0, 1.0), (6.0, 1.0), (7.5, 0.5), (12.0, 0.3), (20, 0.25), (28.8, 0.1), (40, 0.08)])
    m.put((rum * 0.025 + hiss * 0.006) * env, 0.0)
    el = m.sfx.get("street_amb")
    if el is not None:
        amb = loop(el, TL.DURATION)
        env = curve([(0, 1.0), (5.9, 1.0), (6.4, 0.45), (9.5, 0.22), (14.0, 0.12), (28.8, 0.05), (40, 0.04)])
        m.put(amb * env[:, None], 0.0, 1.0, verb=0.1)
    # the taxi passing the operator at ~2 s, the queue pulling away on green, braking at the boom
    m.put(car_pass(4.0, 2.0, 4.5, 11.0, rng, 52), 0.0, 0.22, verb=0.15)
    for k, (td, dist) in enumerate(((5.05, 9.0), (5.35, 13.0), (5.6, 18.0))):
        n = sec(1.6)
        t = tt(n)
        f = 48 + 30 * np.clip(t / 1.1, 0, 1)                   # pulling away in first gear
        eng = butter(saw(f, n) + 0.6 * saw(2 * f, n), 'low', 600) * fade(np.ones(n), 0.15, 0.5)
        m.put(eng * (0.55 if k == 0 else 0.35), td, 4.0 / dist * 0.12, verb=0.1)
    for td, dist in ((6.35, 10.0), (6.55, 16.0), (6.8, 30.0)):
        m.put(air(screech(0.8, rng), dist), td, 2.2 / dist, verb=0.2)
    # horns: ordinary city first, then drivers leaning on them
    for th, d, dur in ((1.25, 70, 0.3), (3.35, 55, 0.22), (3.6, 55, 0.18), (7.3, 25, 0.7), (8.1, 40, 1.1),
                       (21.7, 30, 1.4), (22.6, 60, 0.6), (25.1, 80, 0.9)):
        m.put(air(horn(dur, rng, (rng.uniform(390, 430), rng.uniform(480, 520))), d), th, 9.0 / d * 0.25,
              verb=0.35)
    # a distant siren builds after the attack
    s = air(siren(16.0), 400) * curve([(24, 0.0), (27, 1.0), (29.0, 1.0), (30.0, 0.5), (40, 0.45)], sec(16.0), 24.0)
    m.put(s, 24.0, 0.008, verb=0.8)
    # the delivery cyclist overtaking the operator: freewheel ticking, tyre hum, two rings of the bell
    t_pass = 2.7
    n = sec(5.0)
    t = tt(n) - 2.0
    d = np.sqrt(4.0 ** 2 + (5.2 * t) ** 2)
    hum = butter(pink(n, rng), 'band', [180, 2200]) * 0.5
    tick = np.zeros(n)
    tick[::sec(1 / 22.0)] = 1.0
    tick = butter(tick, 'band', [2000, 8000]) * 3.0
    m.put(fade((hum + tick) * (2.5 / (d + 1.0)), 0.5, 1.0), t_pass - 2.0, 0.05, verb=0.15)
    for tb in (t_pass - 0.55, t_pass - 0.35):
        n = sec(0.9)
        tq = tt(n)
        bell = sum(a * np.sin(2 * np.pi * 2350 * r * tq) * np.exp(-tq / (0.5 / r)) for r, a in ((1.0, 1.0), (2.76, 0.4), (5.4, 0.15)))
        m.put(bell * 0.3, tb, 0.05, verb=0.3)


def operator(m, rng):
    # walking (scene 1), stopping when the rumble starts
    t = 0.32
    while t < 5.45:
        m.put(footstep(rng, low=0.8, scuff=0.5), t, 0.05 * rng.uniform(0.75, 1.0))
        t += 0.54 + rng.uniform(-0.03, 0.03)
    m.put(handling(0.5, rng, 2), 5.5, 0.05)                  # adjusting grip, looking up
    # the fumble at the beam (scene 3): grabbing the phone, a sharp gasp
    m.put(handling(TL.T_FUMBLE[1] - TL.T_FUMBLE[0] + 0.15, rng, 9), TL.T_FUMBLE[0], 0.32)
    m.put(mic_wind(0.9, rng, 9), TL.T_FUMBLE[0], 0.12)
    br = m.sfx.get("breathing")
    if br is not None:
        m.put(fade(seg(br, 0.0, 0.75), 0.01, 0.2), TL.T_FUMBLE[0] + 0.05, 0.5)
    # running (scene 4b): 23.5 -> 28.8 s, then crouching behind the corner
    fs = m.sfx.get("footsteps")
    if fs is not None:
        m.put(fade(seg(fs, 0.0, 5.3), 0.05, 0.3), 23.5, 0.55)
    else:
        t = 23.55
        while t < 28.75:
            m.put(footstep(rng, low=1.0, scuff=0.9), t, 0.14 * rng.uniform(0.8, 1.0))
            t += 0.34 + rng.uniform(-0.02, 0.02)
    m.put(mic_wind(5.4, rng, 5), 23.5, 0.09)
    m.put(handling(5.3, rng, 10), 23.5, 0.06)
    m.put(handling(0.5, rng, 4), 28.6, 0.18)                 # back against the wall
    if br is not None:
        m.put(fade(seg(br, 0.0, 5.0), 0.3, 0.4), 24.2, 0.42)            # panting while running
        m.put(fade(varispeed(seg(br, 0.6, 3.3), 0.94), 0.3, 0.25), 28.9, 0.28)   # hiding
        # holds the breath when Superman turns to the camera, then a shaky exhale
        m.put(fade(seg(br, 5.1, 6.6), 0.05, 0.3), TL.T_LOOK + 1.4, 0.26)
        m.put(fade(varispeed(seg(br, 1.5, 3.6), 0.97), 0.2, 0.2), 33.5, 0.3)
    else:
        for k in range(18):
            n = sec(0.35)
            b = butter(rng.standard_normal(n), 'band', [500, 4000]) * np.hanning(n)
            m.put(b, 24.2 + 0.55 * k, 0.05)


def appearance(m, rng):
    # rumble (scene 1, 4.0 s): felt more than heard; the windows start to buzz
    n = sec(2.2)
    u = np.clip(tt(n) / 2.0, 0, 1)
    m.low.add(butter(brown(n, rng), 'low', 70) * u ** 2 * 0.3, TL.T_RUMBLE)
    m.put(butter(brown(n, rng), 'band', [60, 400]) * u ** 2.5, TL.T_RUMBLE, 0.06)
    m.put(window_rattle(1.6, rng) * np.linspace(0, 1, sec(1.6)) ** 2, TL.T_RUMBLE + 0.45, 0.03)
    # sonic boom (6.0 s) + echoes off the canyon, sub in the low bus
    sb = m.sfx.get("sonic_boom")
    m.put(sonic_boom(rng), TL.T_BOOM1, 0.9, verb=0.35, echo=0.6)
    if sb is not None:
        m.put(sb, TL.T_BOOM1 - 0.02, 0.6, verb=0.2)
    m.low.add(boom_low(2.0, 50, 30, 0.45), TL.T_BOOM1, 0.55)
    m.put(window_rattle(1.8, rng, 27) * np.exp(-tt(sec(1.8)) / 0.6), TL.T_BOOM1 + 0.03, 0.09)
    # the crowd reacts
    cg = m.sfx.get("crowd_gasp")
    if cg is not None:
        m.put(fade(seg(cg, 1.45, 5.0), 0.05, 0.6), TL.T_BOOM1 - 0.05, 0.42, verb=0.3)
    # flyby between the towers + the wake
    t_ca, d_ca = flyby(m, 8.4, 12.6, 3.0, rng, flutter=0.4)
    fb = m.sfx.get("flyby")
    if fb is not None:
        m.put(air(fb, d_ca), t_ca - 0.45, 0.5, verb=0.3)
    m.put(gust(2.4, 0.7, rng), TL.T_WAKE + 0.05, 0.45, verb=0.2)
    m.put(mic_wind(1.4, rng, 10), TL.T_WAKE + 0.2, 0.22)
    m.put(paper_flutter(2.4, rng), TL.T_WAKE + 0.25, 0.05, verb=0.2)
    m.put(window_rattle(1.2, rng, 25) * fade(np.ones(sec(1.2)), 0.1, 0.6), TL.T_WAKE + 0.1, 0.07)
    if cg is not None:   # people stumble: a second, sharper wave of screams
        m.put(fade(varispeed(seg(cg, 1.8, 4.2), 1.05), 0.05, 0.5), TL.T_WAKE + 0.2, 0.36, verb=0.3)
    # car alarms set off by the shockwave and the wake
    al = m.sfx.get("car_alarm")
    if al is None:
        al = stereo(car_alarm_synth(8.0, rng))
    for start, ratio, gain, dist in ((6.7, 1.0, 0.09, 18.0), (9.75, 1.06, 0.06, 32.0), (10.4, 0.95, 0.04, 55.0)):
        x = air(loop(varispeed(al, ratio), TL.DURATION - start), dist)
        env = curve([(start, 1.0), (28.8, 1.0), (29.8, 0.14), (40, 0.12)], len(x), start)
        m.put(fade(x * env[:, None], 0.02, 0.1), start, gain, verb=0.4)
    # the stop above the intersection (12.2 s): a pressure "whomp" and a cape snap
    m.put(gust(0.9, 0.2, rng, 40, 500, 0.25), TL.T_STOP - 0.05, 0.4)
    m.low.add(boom_low(1.2, 60, 30, 0.3), TL.T_STOP, 0.3)
    n = sec(0.1)
    m.put(butter(rng.standard_normal(n), 'band', [400, 2200]) * np.exp(-tt(n) / 0.02), TL.T_STOP + 0.08, 0.05,
          verb=0.4)
    if cg is not None:   # uneasy murmurs while he hangs there
        m.put(fade(varispeed(seg(cg, 3.4, 5.0), 0.92), 0.4, 0.6), TL.T_STOP + 0.3, 0.16, verb=0.4)


def destruction(m, rng):
    sm = TL.superman_pos(TL.T_BEAM_ON)
    d_eyes = dist_to(sm, TL.T_BEAM_ON)
    d_wall = dist_to(TL.beam_target(15.3), 15.3)
    lag_e, lag_w = d_eyes / C_SOUND, d_wall / C_SOUND
    # eyes charge, beam on, beam off
    m.put(charge_hum(TL.T_BEAM_ON - TL.T_EYES), TL.T_EYES + lag_e, 0.12, verb=0.3)
    dur = TL.T_BEAM_OFF - TL.T_BEAM_ON
    m.put(air(beam_tone(dur + 0.3, rng), d_eyes), TL.T_BEAM_ON + lag_e, 0.13, verb=0.4)
    bm = m.sfx.get("beam")
    if bm is not None:
        x = bm[:sec(dur + 0.4)]
        m.put(fade(air(x, d_wall * 0.6), 0.01, 0.35), TL.T_BEAM_ON + lag_w * 0.7, 0.4, verb=0.3)
    # fireballs as the beam blows the panels out
    ex = m.sfx.get("explosion")
    for k, t0 in enumerate(FIREBALLS):
        p = TL.beam_target(t0)
        ta, d = arrival(p, t0), dist_to(p, t0)
        size = rng.uniform(0.8, 1.15)
        m.put(air(explosion(rng, size), d), ta, 0.3, verb=0.4, echo=0.3)
        m.low.add(boom_low(1.5, 50, 30, 0.4), ta, 0.22 * size)
        if ex is not None and k in (0, 3, 6):
            m.put(air(varispeed(ex, rng.uniform(0.92, 1.06)), d), ta, 0.32, verb=0.3)
    # glass: panels shattering at the wall, then the shards raining onto the street
    gl = m.sfx.get("glass")
    for t0, ratio, gain in ((TL.T_BEAM_ON + 0.2, 1.0, 0.5), (15.4, 0.94, 0.36), (16.2, 1.05, 0.3)):
        x = gl if gl is not None else stereo(glass_crash(rng))
        m.put(air(varispeed(x, ratio), d_wall), t0 + lag_w, gain, verb=0.4)
    fall = 3.3                                                   # ~50 m drop with drag
    rate = lambda s: 75 * np.exp(-((s - 18.7) / 1.3) ** 2) + 6 * (s < 22.0)
    for ti in poisson_times(TL.T_BEAM_ON + fall, 22.5, rate, rng, 82):
        m.put(tink(rng), ti + 0.2, 0.05 * rng.uniform(0.2, 1.0), pan=rng.uniform(-0.6, 0.6), verb=0.5)
    if gl is not None:
        m.put(fade(air(seg(gl, 2.0, 5.5), 60), 0.3, 0.6), TL.T_BEAM_ON + fall + 0.4, 0.3, verb=0.4)
    # concrete and steel hitting the pavement
    rate = lambda s: 7 * np.exp(-((s - 18.3) / 1.2) ** 2) + 0.8 * (s < 22.0)
    for ti in poisson_times(17.2, 22.5, rate, rng, 8):
        size = rng.uniform(0.4, 1.2)
        m.put(air(thud(rng, size), 65), ti + 0.19, 0.22, verb=0.4)
        m.low.add(boom_low(0.6, 55, 35, 0.12), ti + 0.19, 0.08 * size)
    de = m.sfx.get("debris")
    if de is not None:
        m.put(air(de, 60), 17.45, 0.42, verb=0.3)
        m.put(air(varispeed(de, 0.9), 60), 18.9, 0.3, verb=0.3)
    # the crowd panics (beam on -> they're gone by scene 5)
    cp = m.sfx.get("crowd_panic")
    if cp is not None:
        dur = 29.8 - 14.25
        a = tile(cp, dur, rng, (0.3, 5.8))
        b = tile(cp, dur, rng, (0.3, 5.8), ratio=(0.93, 0.99))
        env = curve([(14.25, 0.0), (14.6, 0.6), (15.3, 1.0), (20.0, 0.85), (23.5, 0.6), (27.0, 0.42),
                     (28.8, 0.22), (29.8, 0.0)], sec(dur), 14.25)[:, None]
        m.put(a * env, 14.25, 0.36, pan=-0.3, verb=0.35)
        m.put(b * env, 14.4, 0.26, pan=0.35, verb=0.35)


def chaos(m, rng):
    # takeoff, circling high over the block, descent towards the operator
    m.put(gust(1.0, 0.15, rng, 40, 900, 0.2), TL.T_TAKEOFF, 0.35)
    m.low.add(boom_low(1.4, 55, 28, 0.35), TL.T_TAKEOFF + 0.1, 0.3)
    flyby(m, TL.T_TAKEOFF - 0.1, 31.5, 3.0, rng, flutter=0.2)
    # the taxi stands on its brakes (seen on CCTV)
    ts = m.sfx.get("tire_screech")
    d = 28.0
    if ts is not None:
        m.put(air(ts, d), TL.T_TAXI_BRAKE, 0.45, verb=0.3)
    else:
        m.put(air(screech(1.6, rng), d), TL.T_TAXI_BRAKE, 0.22, verb=0.3)
    # cafe furniture and the A-frame toppling in the debris gust
    for ti in sorted(rng.uniform(21.8, 24.5, 6)):
        m.put(air(clang(rng), 25), ti, 0.12, pan=rng.uniform(-0.5, 0.5), verb=0.4)
    n = sec(0.2)
    m.put(butter(rng.standard_normal(n), 'band', [300, 1600]) * np.exp(-tt(n) / 0.05), 22.6, 0.1, verb=0.3)
    # the dust cloud rolling down the avenue
    n = sec(10.0)
    roll = butter(pink(n, rng), 'band', [50, 500]) * (0.6 + 0.4 * lfo(n, 1.5, rng))
    grit = butter(rng.standard_normal(n), 'high', 3000) * (rng.random(n) < 0.02) * 2.0
    env = curve([(19.5, 0.0), (23.0, 0.5), (26.5, 1.0), (29.0, 0.6), (30.2, 0.2), (35.0, 0.1), (40, 0.1)], n, 19.5)
    m.put((roll + grit * 0.4) * env, 19.5, 0.07, verb=0.3)


def standoff(m, rng):
    # he arrives and hovers: pressure wave, dust gust, the signal pole bends and shorts out
    t_hover = 30.6
    m.put(gust(1.6, 0.3, rng, 60, 1500, 0.2), t_hover - 0.1, 0.3, verb=0.3)
    m.low.add(boom_low(1.4, 50, 28, 0.4), t_hover, 0.25)
    m.put(paper_flutter(1.0, rng, 25), t_hover + 0.1, 0.04)
    t_pole = TL.T_DESCEND + 1.02
    m.put(creak(0.9, rng), t_pole, 0.07, verb=0.4)
    sp = m.sfx.get("sparks")
    if sp is not None:
        m.put(sp, t_pole + 0.05, 0.3, verb=0.2)
    m.put(elec_buzz(TL.T_LAUNCH + 0.3 - t_pole, rng), t_pole + 0.05, 0.025, verb=0.2)
    # wind through the empty street, a faint hum while his eyes glow
    n = sec(6.5)
    w = butter(pink(n, rng), 'band', [90, 1800]) * np.clip(0.5 + 0.5 * lfo(n, 0.8, rng), 0.1, None)
    m.put(fade(w, 1.0, 0.5), 29.0, 0.035, verb=0.3)
    hum = charge_hum(TL.T_LAUNCH - TL.T_LOOK)
    m.put(hum * 0.4, TL.T_LOOK, 0.06, verb=0.3)
    # the deep atmospheric rumble that is left when everything else drops away
    n = sec(TL.T_LAUNCH - 28.8)
    rum = butter(brown(n, rng), 'low', 60) * (0.7 + 0.3 * lfo(n, 0.4, rng))
    m.low.add(fade(rum, 1.2, 0.3), 28.8, 0.12)


def finale(m, rng):
    # launch: air blast straight at the camera
    m.put(sonic_boom(rng) * 0.7, TL.T_LAUNCH + 0.1, 0.8, verb=0.3, echo=0.3)
    m.put(gust(1.2, 0.25, rng, 40, 1800, 0.2), TL.T_LAUNCH, 0.5)
    m.low.add(boom_low(1.8, 55, 26, 0.5), TL.T_LAUNCH + 0.1, 0.55)
    sb = m.sfx.get("sonic_boom")
    if sb is not None:
        m.put(varispeed(sb, 0.85), TL.T_LAUNCH + 0.05, 0.45, verb=0.2)
    t_ca, d_ca = flyby(m, TL.T_LAUNCH - 0.2, TL.T_IMPACT + 0.3, 4.0, rng, flutter=1.0)
    fb = m.sfx.get("flyby")
    if fb is not None:
        m.put(varispeed(fb, 0.9), t_ca - 0.5, 0.75)
    # the phone is dropped: grab, fall, clatter onto the pavement (right at the microphone)
    m.put(handling(0.12, rng, 4), TL.T_DROP, 0.5)
    n = sec(TL.T_PHONE_LAND - TL.T_DROP - 0.08)
    m.put(butter(rng.standard_normal(n), 'band', [200, 2200]) * np.linspace(0.2, 1, n) ** 2, TL.T_DROP + 0.08, 0.12)
    pd = m.sfx.get("phone_drop")
    if pd is not None:
        m.put(pd, TL.T_PHONE_LAND, 1.1)
    n = sec(0.25)
    m.put(butter(rng.standard_normal(n), 'low', 450) * np.exp(-tt(n) / 0.02) * 3, TL.T_PHONE_LAND, 0.45)
    m.put(handling(0.4, rng, 3), TL.T_PHONE_LAND + 0.05, 0.12)
    # sprinters' feet pounding past the phone on the ground
    for x, t_pass in SPRINTERS:
        lat = abs(x - TL.PHONE_REST[0])
        t = t_pass - 1.0 + rng.uniform(0, 0.3)
        while t < t_pass + 1.0:
            dd = np.hypot(lat, SPRINT_V * (t - t_pass))
            m.put(footstep(rng, low=1.4, scuff=0.8), t, min(0.9, 0.35 / (dd * dd + 0.25)))
            t += 0.31 + rng.uniform(-0.02, 0.02)
    # the impact
    p_imp = TL.superman_pos(TL.T_IMPACT)
    ta, d = arrival(p_imp, TL.T_IMPACT), dist_to(p_imp, TL.T_IMPACT)
    m.put(explosion(rng, 1.8, 3.0), ta, 1.2, verb=0.4, echo=0.5)
    m.put(sonic_boom(rng), ta, 0.7)
    m.low.add(boom_low(3.0, 45, 24, 0.7), ta, 0.8)
    im = m.sfx.get("impact")
    if im is not None:
        m.put(im, ta - 0.02, 0.9, verb=0.2)
    for ti in poisson_times(ta + 0.15, 39.2, lambda s: 9 * np.exp(-(s - ta) / 0.9) + 1.0, rng, 10):
        m.put(air(thud(rng, rng.uniform(0.3, 1.0)), 15 + 20 * rng.random()), ti, 0.25, verb=0.3)
    for ti in poisson_times(ta + 0.1, 38.8, lambda s: 30 * np.exp(-(s - ta) / 0.6), rng, 30):
        m.put(tink(rng), ti, 0.05 * rng.uniform(0.2, 1), verb=0.3)
    # ears ringing (subjective)
    dur = TL.T_CUT - (ta + 0.12)
    ring = tinnitus(dur) * curve([(0, 0.0), (0.15, 1.0), (1.2, 0.75), (dur - 0.25, 0.55), (dur, 0.0)], sec(dur), 0.0)
    m.ears.add(ring, ta + 0.12, db(-21))


# ============================================================================= score
def pad(notes, dur, cutoff, rng, voices=3, spread=9.0, vib=0.0):
    n = sec(dur)
    out = np.zeros((n, 2))
    t = tt(n)
    for c in range(2):
        x = np.zeros(n)
        for f in notes:
            for v in np.linspace(-spread, spread, voices):
                fr = f * 2 ** ((v + rng.uniform(-2, 2)) / 1200)
                if vib:
                    fr = fr * (1 + vib * np.sin(2 * np.pi * rng.uniform(4.6, 5.6) * t + rng.uniform(0, 6)))
                x += saw(fr, n, rng.uniform())
        out[:, c] = lp_sweep(x / (len(notes) * np.sqrt(voices)), cutoff)
    return out


def pluck(f, rng, dur=0.1, bright=1700):
    n = sec(dur + 0.18)
    t = tt(n)
    x = saw(f, n, rng.uniform()) + 0.6 * saw(f * 1.004, n, rng.uniform())
    return butter(x * np.exp(-t / 0.06), 'low', bright)


def drum(f0, rng, decay=0.45, dur=1.3):
    n = sec(dur)
    t = tt(n)
    ph = 2 * np.pi * (f0 * t + f0 * 1.5 * 0.03 * (1 - np.exp(-t / 0.03)))
    body = np.sin(ph) * np.exp(-t / decay)
    skin = butter(rng.standard_normal(n), 'band', [80, 900]) * np.exp(-t / 0.05) * 0.5
    attack = butter(rng.standard_normal(n), 'band', [1000, 5000]) * np.exp(-t / 0.006) * 0.25
    return body + skin + attack


def braam_synth(rng, dur=4.0):
    n = sec(dur)
    t = tt(n)
    x = pad([D1, A1, D2, A2], dur, 180 + 2400 * np.exp(-t / 0.7), rng, voices=3, spread=14)
    return np.tanh(2.2 * x) * (np.exp(-t / 2.2) * fade(np.ones(n), 0.02, 0.8))[:, None]


def riser(dur, rng):
    n = sec(dur)
    u = tt(n) / dur
    noise = lp_sweep(butter(rng.standard_normal(n), 'high', 250), 400 + 7000 * u ** 2) * 0.5
    tone = np.sin(sweep_phase(220 + 440 * u ** 2)) * 0.15
    return (noise + tone) * u ** 2


def score(m, rng):
    sfx = m.sfx
    # title hit (0-2.75 s): reverse swell into a low hit as the title lands at 0.45 s
    n = sec(0.45)
    sw = butter(rng.standard_normal(n), 'band', [200, 5000]) * np.exp(-tt(n) / 0.12)
    m.music(sw[::-1] * 0.5, 0.0, 0.12, hall=0.5)
    m.music(boom_low(2.4, 70, 36, 0.6), 0.45, 0.3, hall=0.3)
    m.music(fade(pad([D2, A2, D3], 2.6, 700, rng), 0.005, 1.6) * np.exp(-tt(sec(2.6)) / 0.6)[:, None],
            0.45, 0.18, hall=0.6)
    # drone from the rumble, a swell after the boom that stops dead when he does
    dur = TL.T_IMPACT + 0.2 - TL.T_RUMBLE
    drone = pad([D1, A1, D2], dur, curve([(4.0, 140), (6.0, 420), (12, 520), (20, 600), (28.8, 380), (35, 260)],
                                         sec(dur), 4.0), rng, voices=3)
    env = curve([(4.0, 0.0), (5.9, 0.6), (6.0, 0.8), (12.2, 1.0), (19.5, 1.0), (28.6, 0.8), (29.6, 0.25),
                 (TL.T_CUT, 0.2)], sec(dur), 4.0)
    m.music(drone * env[:, None], 4.0, 0.16, hall=0.3)
    dur = TL.T_STOP - TL.T_BOOM1 + 0.15
    sw = pad([D3, F3, A3, D4], dur, curve([(0, 500), (dur, 2600)], sec(dur)), rng, voices=3, vib=0.004)
    env = curve([(0, 0.0), (1.0, 0.25), (dur - 0.15, 1.0), (dur, 0.0)], sec(dur))
    m.music(sw * env[:, None], TL.T_BOOM1, 0.11, hall=0.5)
    # ostinato (scene 3 and 4): 16ths at 120 bpm on D, accents shift as it builds
    pattern = [D2, D2, D2, F2, D2, D2, D2, C3, D2, D2, D2, F2, D2, D2, A2, G2]
    accent = [1.0, 0.45, 0.65, 0.5]
    lvl = lambda t: np.interp(t, [12.8, 14.0, 19.4, 28.4, 29.2], [0.35, 0.6, 0.8, 0.85, 0.0])
    t, k = 12.8, 0
    while t < 29.2:
        m.music(pluck(pattern[k % 16], rng, bright=1200 + 900 * lvl(t)), t,
                0.05 * accent[k % 4] * lvl(t), pan=0.25 * np.sin(k * 0.7), hall=0.25)
        t += 0.125
        k += 1
    # strings under scene 4
    st = pad([D3, F3, A3], 4.8, 1800, rng, vib=0.004)
    st2 = pad([BB2, D3, F3], 4.8, 1800, rng, vib=0.004)
    m.music(fade(st, 0.8, 0.8), 20.0, 0.06, hall=0.5)
    m.music(fade(st2, 0.8, 0.6) * curve([(0, 1), (4.8, 0.4)], sec(4.8))[:, None], 24.8, 0.06, hall=0.5)
    # braams: beam on, the cut to CCTV / takeoff, the launch
    br = sfx.get("braam")
    for t0, ratio, gain in ((TL.T_BEAM_ON, 1.0, 0.34), (20.0, 0.94, 0.38), (TL.T_LAUNCH, 0.89, 0.5)):
        x = varispeed(br, ratio) if br is not None else braam_synth(rng)
        m.music(x, t0, gain, hall=0.35)
    # drums through scene 4
    t = 20.0
    beat = 0.5
    while t < 28.9:
        b = int(round((t - 20.0) / beat))
        if b % 4 in (0, 2) or (b % 8 == 7):
            m.music(drum(52 if b % 4 == 0 else 62, rng), t, 0.18 if b % 4 == 0 else 0.12, hall=0.4)
        if b % 8 == 6:
            for j in range(3):
                m.music(drum(75, rng, 0.2), t + j * beat / 3, 0.06, hall=0.4)
        t += beat
    # scene 5: almost nothing -- a thin high harmonic, then a heartbeat and a riser into the launch
    dur = TL.T_LAUNCH - 29.4
    n = sec(dur)
    tq = tt(n)
    hi = (np.sin(2 * np.pi * D5 * tq * (1 + 0.003 * np.sin(2 * np.pi * 5 * tq))) +
          0.5 * np.sin(2 * np.pi * A5 * tq * (1 + 0.003 * np.sin(2 * np.pi * 4.6 * tq + 1))))
    m.music(fade(hi, 2.0, 0.3), 29.4, 0.006, hall=0.7)
    t = 32.0
    while t < TL.T_LAUNCH - 0.3:
        m.music(drum(44, rng, 0.18), t, 0.09, hall=0.2)
        m.music(drum(40, rng, 0.2), t + 0.27, 0.06, hall=0.2)
        t += 0.86
    m.music(riser(1.6, rng), TL.T_LAUNCH - 1.6, 0.1, hall=0.4)
    m.music(drum(48, rng, 0.8, 2.0), TL.T_LAUNCH, 0.35, hall=0.4)


# ============================================================================= processing
def compressor(x, thr_db, ratio, attack, release, makeup_db=0.0, block=0.004, detect=None):
    """Block-wise RMS compressor (a phone's AGC with audible pumping)."""
    det = mono(x if detect is None else detect)
    B = sec(block)
    nb = int(np.ceil(len(det) / B))
    pad_ = np.zeros(nb * B)
    pad_[:len(det)] = det
    lvl = 10 * np.log10(np.mean(pad_.reshape(nb, B) ** 2, axis=1) + 1e-12)
    over = np.maximum(lvl - thr_db, 0)
    target = -over * (1 - 1 / ratio)
    aa, ar = 1 - np.exp(-block / attack), 1 - np.exp(-block / release)
    g = np.zeros(nb)
    cur = 0.0
    for i in range(nb):
        cur += (target[i] - cur) * (aa if target[i] < cur else ar)
        g[i] = cur
    gain = np.interp(np.arange(len(det)), np.arange(nb) * B + B / 2, g)
    return x * db(gain + makeup_db)[:, None]


def limiter(x, ceiling_db=-1.0, release=0.08, look=0.003):
    """Look-ahead peak limiter: the gain ramps down over `look` s before a peak, recovers slowly."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    c = db(ceiling_db)
    L = sec(look)
    need = np.minimum(1.0, c / np.maximum(np.abs(x).max(axis=1), 1e-9))
    need = minimum_filter1d(need, 2 * L + 1)
    need = np.minimum(need, uniform_filter1d(need, L))
    red = 1.0 - need
    k = np.exp(-1.0 / (release * SR))
    out = np.empty_like(red)
    cur = 0.0
    for i, r in enumerate(red.tolist()):
        cur = r if r > cur else cur * k
        out[i] = cur
    return np.clip(x * (1.0 - out)[:, None], -c, c)


def phone_mic(x):
    m, s = (x[:, 0] + x[:, 1]) / 2, (x[:, 0] - x[:, 1]) / 2
    x = np.stack([m + 0.3 * s, m - 0.3 * s], 1)                  # near-mono capsule
    x = butter(x, 'high', 95)
    x = peaking(x, 260, -2.0, 1.0)
    x = peaking(x, 2600, 3.0, 0.9)
    x = butter(x, 'low', 12500)
    x = compressor(x, -24.0, 3.0, 0.004, 0.35, makeup_db=4.0)
    return np.tanh(1.2 * x) / 1.2                                 # capsule / converter overload


def window(t0, t1, ramp=0.03):
    return curve([(0, 0), (t0 - ramp, 0), (t0, 1), (t1, 1), (t1 + ramp, 0), (TL.DURATION, 0)])


def loudness(x):
    """Integrated loudness (ITU-R BS.1770, gated)."""
    y = signal.lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285],
                       [1.0, -1.69065929318241, 0.73248077421585], x, axis=0)
    y = signal.lfilter([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621], y, axis=0)
    B, H = sec(0.4), sec(0.1)
    z = np.array([np.mean(y[i:i + B] ** 2, axis=0).sum() for i in range(0, len(y) - B, H)])
    lk = -0.691 + 10 * np.log10(z + 1e-12)
    z = z[lk > -70]
    rel = -0.691 + 10 * np.log10(z.mean() + 1e-12) - 10
    z = z[-0.691 + 10 * np.log10(z + 1e-12) > rel]
    return -0.691 + 10 * np.log10(z.mean() + 1e-12)


def master(m, stems=None):
    rng = np.random.default_rng(99)
    city = make_ir(1.7, 5000, seed=3, early=[(0.029, 0.5, -0.6), (0.058, 0.42, 0.5), (0.087, 0.33, -0.3),
                                             (0.116, 0.27, 0.4), (0.17, 0.2, -0.5), (0.24, 0.16, 0.6)])
    far = make_ir(2.4, 2500, seed=4, early=[(0.21, 0.55, -0.7), (0.34, 0.5, 0.6), (0.47, 0.42, -0.4),
                                            (0.66, 0.36, 0.7), (0.88, 0.3, -0.6), (1.15, 0.22, 0.4),
                                            (1.45, 0.16, -0.3), (1.8, 0.1, 0.5)], pre=0.15)
    hall = make_ir(3.2, 7000, seed=5)
    scene = m.scene.x + convolve(m.verb.x, city)[:N] * 0.5 + convolve(m.echo.x, far)[:N] * 0.45
    scene = phone_mic(scene)
    # CCTV insert: the picture changes device, the sound turns distant and boxy
    w = window(*CCTV)[:, None]
    box = butter(mono(scene), 'band', [280, 3000])
    box = stereo(box) * db(-7)
    hiss = butter(rng.standard_normal(N), 'high', 3000) * db(-58) + \
        sum(np.sin(2 * np.pi * 60 * k * tt(N)) / k for k in (1, 2, 3)) * db(-56)
    scene = scene * (1 - w) + (box + stereo(hiss)) * w
    # after the impact: the mic is overloaded, everything collapses into a low muffle and fades out
    p_imp = TL.superman_pos(TL.T_IMPACT)
    ta = arrival(p_imp, TL.T_IMPACT)
    mw = curve([(0, 0), (ta + 0.2, 0), (ta + 0.65, 1.0), (TL.DURATION, 1.0)])[:, None]
    muff = butter(scene, 'low', 320, order=2) * 1.6
    scene = scene * (1 - mw) + muff * mw
    low = butter(m.low.x, 'low', 120, order=4)
    music = m.score.x + convolve(m.hall.x, hall)[:N] * 0.6
    # the score leaves the room for the impact
    music *= curve([(0, 1), (ta - 0.03, 1), (ta + 0.01, 0), (TL.DURATION, 0)])[:, None]
    tail = curve([(0, 1), (ta + 1.2, 1), (TL.T_CUT - 0.05, 0.25), (TL.T_CUT, 0.0), (TL.DURATION, 0.0)])[:, None]
    scene *= tail
    low *= tail
    ears = m.ears.x
    mix = scene + low * 0.9 + music + ears
    if stems:
        os.makedirs(stems, exist_ok=True)
        for name, x in (("scene", scene), ("low", low), ("score", music), ("ears", ears)):
            wavfile.write(os.path.join(stems, name + ".wav"), SR, x.astype(np.float32))
    gain = -15.0 - loudness(mix)
    mix = limiter(mix * db(gain), -1.0)
    mix[sec(TL.T_CUT):] = 0.0                                     # cut to black = digital silence
    return mix, gain


def main():
    args = sys.argv[1:]
    stems = None
    if "--stems" in args:
        i = args.index("--stems")
        stems = args[i + 1]
        del args[i:i + 2]
    sfx_dir, out = args
    m = Mix(SFX(sfx_dir))
    rng = np.random.default_rng(2037)
    for cue in (ambience, operator, appearance, destruction, chaos, standoff, finale, score):
        cue(m, rng)
    mix, gain = master(m, stems)
    assert mix.shape == (N, 2)
    wavfile.write(out, SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
    print(f"wrote {out}: {len(mix) / SR:.3f} s, gain {gain:+.1f} dB, peak {20 * np.log10(np.abs(mix).max()):.1f} dBFS, "
          f"loudness {loudness(mix):.1f} LUFS")


if __name__ == "__main__":
    main()
