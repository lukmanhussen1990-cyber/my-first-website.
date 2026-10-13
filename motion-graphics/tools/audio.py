#!/usr/bin/env python3
"""Score and sound design for "One Token at a Time".

Reads the cue sheet exported by the scene (`node tools/render.mjs cues cues.json`)
and writes a 48 kHz stereo WAV. Everything is synthesized here from oscillators
and noise: no samples, no loops, no generative models.

    python3 tools/audio.py cues.json out.wav

The music sits on the same 120 BPM grid the picture is cut to, and every
visual event in the cue sheet gets its own synthesized sound, panned to where
it happens on screen.
"""
import json
import sys

import numpy as np
from scipy import signal

SR = 48000
BEAT = 0.5          # 120 BPM
RNG = np.random.default_rng(20251013)

# ---------------------------------------------------------------------------
# Pitch helpers (D major / B minor, with a D major pentatonic for sound design)
# ---------------------------------------------------------------------------
_PC = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}


def hz(name):
    """'F#4' -> frequency in Hz."""
    pc, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((12 * (octave + 1) + _PC[pc] - 69) / 12)


PENTA = ['D', 'E', 'F#', 'A', 'B']


def penta(i, octave=5):
    """i-th step of the D major pentatonic, starting at D<octave>."""
    return hz(f'{PENTA[i % 5]}{octave + i // 5}')


def secs(n):
    return np.arange(n) / SR


def ns(dur):
    return max(1, int(round(dur * SR)))


def fades(x, fi=0.002, fo=0.01):
    """Click-free edges."""
    n = x.shape[-1]
    a, b = min(n, ns(fi)), min(n, ns(fo))
    if a > 0:
        x[..., :a] *= np.linspace(0, 1, a)
    if b > 0:
        x[..., n - b:] *= np.linspace(1, 0, b)
    return x


def sos(kind, f, order=2):
    if kind in ('bandpass', 'bandstop'):
        return signal.butter(order, [f[0] / (SR / 2), min(0.99, f[1] / (SR / 2))], kind, output='sos')
    return signal.butter(order, min(0.99, f / (SR / 2)), kind, output='sos')


def filt(x, kind, f, order=2):
    return signal.sosfilt(sos(kind, f, order), x, axis=-1)


def noise(n):
    return RNG.standard_normal(n)


# ---------------------------------------------------------------------------
# Mix buses
# ---------------------------------------------------------------------------
class Bus:
    def __init__(self, dur):
        self.x = np.zeros((2, ns(dur)))

    def add(self, sig, t, pan=0.0, gain=1.0):
        if sig.ndim == 1:
            th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
            sig = np.stack([sig * np.cos(th), sig * np.sin(th)]) * np.sqrt(2)
        i0 = int(round(t * SR))
        if i0 >= self.x.shape[1]:
            return
        if i0 < 0:
            sig, i0 = sig[:, -i0:], 0
        n = min(sig.shape[1], self.x.shape[1] - i0)
        self.x[:, i0:i0 + n] += gain * sig[:, :n]

    def add_moving(self, sig, t, pan0, pan1, gain=1.0):
        """Mono source whose pan travels from pan0 to pan1."""
        p = np.linspace(pan0, pan1, sig.shape[0])
        th = (np.clip(p, -1, 1) + 1) * np.pi / 4
        self.add(np.stack([sig * np.cos(th), sig * np.sin(th)]) * np.sqrt(2), t, gain=gain)


# ---------------------------------------------------------------------------
# Oscillators and instruments
# ---------------------------------------------------------------------------
_TABLES = {}


def saw_table(nharm, tilt):
    key = (nharm, round(tilt, 2))
    if key not in _TABLES:
        ph = np.arange(4096) / 4096
        k = np.arange(1, nharm + 1)[:, None]
        tab = (np.sin(2 * np.pi * k * ph) / k ** tilt).sum(0)
        _TABLES[key] = tab / np.abs(tab).max()
    return _TABLES[key]


def osc(table, freq, n, phase0=0.0):
    ph = (phase0 + np.arange(n) * (freq / SR)) % 1.0
    idx = ph * len(table)
    i0 = idx.astype(np.int64)
    fr = idx - i0
    return table[i0] * (1 - fr) + table[(i0 + 1) % len(table)] * fr


def adsr(n, a, d, s, r_start, r):
    """Envelope over n samples: attack a, decay d to sustain s, release r starting at r_start (seconds)."""
    t = secs(n)
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = np.clip((t - r_start) / max(r, 1e-4), 0, 1)
    return e * (1 - rel) ** 2


def pad_note(f, dur, att=0.8, rel=1.8, bright=0.55, voices=5, detune=0.14, sub=0.0):
    n = ns(dur + rel)
    nh = int(np.clip(7000 / f, 1, 40))
    tab = saw_table(nh, 1.0 + (1 - bright) * 0.9)
    out = np.zeros((2, n))
    for v in range(voices):
        x = (v - (voices - 1) / 2) / ((voices - 1) / 2)
        sig = osc(tab, f * 2 ** (x * detune / 12), n, RNG.random())
        th = (x * 0.75 + 1) * np.pi / 4
        out[0] += sig * np.cos(th)
        out[1] += sig * np.sin(th)
    if sub:
        out += np.sin(2 * np.pi * f * 0.5 * secs(n)) * sub
    return out * adsr(n, att, 1.5, 0.85, dur, rel) / voices


def pluck(f, dur=1.2, bright=1.0, decay=0.45):
    n = ns(dur)
    t = secs(n)
    out = np.zeros(n)
    nh = int(np.clip(11000 / f, 1, 28))
    for k in range(1, nh + 1):
        d = decay / (1 + 0.5 * (k - 1) / bright)
        out += np.sin(2 * np.pi * f * k * t + RNG.random() * 6.28) * np.exp(-t / d) / k ** 1.35
    return fades(out / 1.6, 0.0015, 0.02)


def bass_note(f, dur, rel=0.09, drive=1.6):
    n = ns(dur + rel)
    t = secs(n)
    x = np.sin(2 * np.pi * f * t) + 0.28 * np.sin(4 * np.pi * f * t) + 0.1 * np.sin(6 * np.pi * f * t)
    x = np.tanh(drive * x) / np.tanh(drive)
    return x * adsr(n, 0.006, 0.4, 0.8, dur, rel)


def bell(f, dur=2.2, ratio=3.5, index=1.8, decay=0.9):
    n = ns(dur)
    t = secs(n)
    mod = index * np.exp(-t / 0.3) * np.sin(2 * np.pi * f * ratio * t)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / decay)
    x += 0.22 * np.sin(2 * np.pi * f * 2.001 * t) * np.exp(-t / (decay * 0.45))
    return fades(x, 0.001, 0.05)


def glide(f0, f1, dur):
    n = ns(dur)
    f = f0 * (f1 / f0) ** (secs(n) / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def shaped_noise(dur, fc, width=1.0):
    """Noise whose spectrum is a Gaussian bump (in octaves) centred on fc(t)."""
    nfft, hop = 2048, 512
    n = ns(dur)
    frames = n // hop + 4
    out = np.zeros(frames * hop + nfft)
    lf = np.log2(np.maximum(np.fft.rfftfreq(nfft, 1 / SR), 20))
    win = np.hanning(nfft)
    sd = width / 2.355
    for i in range(frames):
        c = np.log2(max(30.0, fc(i * hop / SR)))
        mag = np.exp(-0.5 * ((lf - c) / sd) ** 2)
        spec = mag * (RNG.standard_normal(len(lf)) + 1j * RNG.standard_normal(len(lf)))
        out[i * hop:i * hop + nfft] += np.fft.irfft(spec) * win
    out = out[nfft // 2:nfft // 2 + n]
    return out / (np.abs(out).max() + 1e-9)


def kick(v=1.0, tight=1.0):
    n = ns(0.55)
    t = secs(n)
    f = 46 + 118 * np.exp(-t / (0.035 * tight))
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = (np.sin(ph) + 0.18 * np.sin(2 * ph)) * np.exp(-t / (0.24 * tight))
    click = filt(noise(n), 'highpass', 2500) * np.exp(-t / 0.0025) * 0.25
    return fades(np.tanh(1.7 * (body + click)) * v, 0.0005, 0.03)


def hat(open_=False, v=1.0):
    n = ns(0.4 if open_ else 0.1)
    t = secs(n)
    x = sum(np.sign(np.sin(2 * np.pi * fr * 1.35 * t + RNG.random() * 6.28)) for fr in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0))
    x = filt(x, 'highpass', 7200, 4) + 0.25 * filt(noise(n), 'highpass', 9000)
    x *= np.exp(-t / (0.11 if open_ else 0.02))
    return fades(x / 4 * v, 0.0005, 0.01)


def clap(v=1.0):
    n = ns(0.5)
    t = secs(n)
    e = sum(np.exp(-(t - tb) / 0.006) * (t >= tb) for tb in (0.0, 0.011, 0.022))
    e += 0.85 * np.exp(-(t - 0.03) / 0.12) * (t >= 0.03)
    x = filt(noise(n), 'bandpass', (950, 2600)) * e
    return fades(x * v * 0.9, 0.0005, 0.02)


def click(f=3000, v=1.0, tau=0.0018):
    n = ns(0.03)
    t = secs(n)
    x = filt(noise(n), 'bandpass', (f * 0.6, f * 1.6)) * np.exp(-t / tau)
    return fades(x * v, 0.0002, 0.005)


# ---------------------------------------------------------------------------
# Sound design: one function per cue type
# ---------------------------------------------------------------------------
def sfx_key(c, B):
    n = ns(0.08)
    t = secs(n)
    k = c.get('n', 0)
    h = (k * 0.618) % 1
    thock = np.sin(2 * np.pi * (165 + 50 * h) * t) * np.exp(-t / 0.012)
    tick = np.sin(2 * np.pi * (1700 + 400 * h) * t) * np.exp(-t / 0.004)
    body = thock * 0.55 + tick * 0.18
    body[:ns(0.03)] += 0.8 * click(3400 + 900 * h, 1.0, 0.0016)
    v = c.get('v', 1.0)
    B['sfx'].add(fades(body * v, 0.0003, 0.01), c['t'], c['pan'], 0.42)
    B['verb'].add(fades(body * v, 0.0003, 0.01), c['t'], c['pan'], 0.1)


def sfx_blink(c, B):
    n = ns(0.06)
    t = secs(n)
    x = np.sin(2 * np.pi * 2350 * t) * np.exp(-t / 0.008) + 0.5 * np.sin(2 * np.pi * 4700 * t) * np.exp(-t / 0.004)
    B['sfx'].add(fades(x, 0.0003, 0.01), c['t'], c['pan'], 0.1 * c.get('v', 1))
    B['verb'].add(x, c['t'], c['pan'], 0.06 * c.get('v', 1))


def sfx_question(c, B):
    for i, (nm, dt) in enumerate((('D5', 0.0), ('A5', 0.14))):
        x = bell(hz(nm), 2.4, ratio=2.0, index=0.9, decay=0.8)
        B['sfx'].add(x, c['t'] + dt, -0.15 + 0.3 * i, 0.11)
        B['verb'].add(x, c['t'] + dt, 0, 0.12)


def sfx_hit(c, B):
    v = c.get('v', 1.0)
    n = ns(1.6)
    t = secs(n)
    sub = glide(96, 40, 1.6) * np.exp(-t / 0.42)
    thump = filt(noise(n), 'lowpass', 180) * np.exp(-t / 0.05) * 1.4
    air = filt(noise(n), 'highpass', 5000) * np.exp(-t / 0.18) * 0.12
    x = fades(np.tanh(1.3 * (sub + thump)) + air, 0.0005, 0.05)
    B['sfx'].add(x, c['t'], 0, 0.62 * v)
    B['verb'].add(x, c['t'], 0, 0.12 * v)
    for nm, p in (('D6', -0.3), ('A6', 0.3)):
        b = bell(hz(nm), 2.5, ratio=2.0, index=0.6, decay=0.9)
        B['sfx'].add(b, c['t'], p, 0.03 * v)
        B['verb'].add(b, c['t'], p, 0.07 * v)


def sfx_ui(c, B):
    for i in range(6):
        f = penta(i + 3, 6)
        n = ns(0.08)
        t = secs(n)
        x = fades(np.sin(2 * np.pi * f * t) * np.exp(-t / 0.02), 0.0005, 0.01)
        p = c['pan'] + i * 0.12
        B['sfx'].add(x, c['t'] + i * 0.045, p, 0.05)
        B['verb'].add(x, c['t'] + i * 0.045, p, 0.05)


def sfx_whoosh(c, B):
    d = c['dur']
    rise = c.get('rise', False)
    fc = (lambda tt: 350 * (12 ** (tt / d))) if rise else (lambda tt: 2600 * (0.16 ** (tt / d)) + 250)
    x = shaped_noise(d, fc, 1.6)
    u = np.linspace(0, 1, x.size)
    x *= np.sin(np.pi * u ** 0.75) ** 2
    B['sfx'].add_moving(fades(x), c['t'], c.get('pan0', 0), c.get('pan1', 0), 0.13 * c.get('v', 1))
    B['verb'].add_moving(x, c['t'], c.get('pan0', 0), c.get('pan1', 0), 0.05 * c.get('v', 1))


def sfx_pop(c, B):
    f = penta(c['n'] + 2, 5)
    n = ns(0.25)
    t = secs(n)
    fr = f * (1 + 0.5 * np.exp(-t / 0.012))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.06)
    x[:ns(0.03)] += 0.35 * click(2500, 1.0, 0.002)
    B['sfx'].add(fades(x, 0.0005, 0.02), c['t'], c['pan'], 0.15)
    B['verb'].add(x, c['t'], c['pan'], 0.07)


def sfx_roll(c, B):
    k = 0
    tt = 0.0
    while tt < c['dur']:
        x = click(4200 + 600 * ((k * 0.37) % 1), 1.0, 0.0012)
        B['sfx'].add(x, c['t'] + tt, c['pan'], 0.09 * (1 - 0.4 * tt / c['dur']))
        tt += 1 / 28
        k += 1


def sfx_lock(c, B):
    n = ns(0.12)
    t = secs(n)
    x = np.sin(2 * np.pi * 950 * t) * np.exp(-t / 0.012)
    x[:ns(0.03)] += 0.6 * click(1800, 1.0, 0.004)
    B['sfx'].add(fades(x, 0.0003, 0.01), c['t'], c['pan'], 0.16)
    p = pluck(penta(c['n'] + 5, 4), 1.2, 0.8, 0.35)
    B['sfx'].add(p, c['t'], c['pan'], 0.13)
    B['verb'].add(p, c['t'], c['pan'], 0.08)


def sfx_morph(c, B):
    d = c['dur']
    x = shaped_noise(d, lambda tt: 600 * (10 ** (tt / d)), 1.2)
    u = np.linspace(0, 1, x.size)
    x *= np.sin(np.pi * u) ** 2
    B['sfx'].add(fades(x), c['t'], 0, 0.06)
    for i in range(16):
        f = penta(int(RNG.integers(0, 10)), 6)
        n = ns(0.05)
        t = secs(n)
        b = fades(np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012), 0.0005, 0.01)
        B['sfx'].add(b, c['t'] + 0.15 + i * 0.045, float(RNG.uniform(-0.6, 0.6)), 0.05)
        B['verb'].add(b, c['t'] + 0.15 + i * 0.045, 0, 0.03)


def sfx_data(c, B):
    f = penta(c['n'], 6)
    n = ns(0.06)
    t = secs(n)
    mod = 1.2 * np.exp(-t / 0.01) * np.sin(2 * np.pi * f * 2 * t)
    x = fades(np.sin(2 * np.pi * f * t + mod) * np.exp(-t / 0.015), 0.0005, 0.01)
    B['sfx'].add(x, c['t'], c['pan'], 0.05 * c.get('v', 1))
    B['delay'].add(x, c['t'], c['pan'], 0.03)


def sfx_collapse(c, B):
    d = c['dur']
    x = glide(1400, 180, d) * np.linspace(0.2, 1, ns(d)) ** 2
    nz = shaped_noise(d, lambda tt: 4000 * (0.1 ** (tt / d)), 1.0) * np.linspace(0, 1, ns(d)) ** 2
    y = fades(0.5 * x + 0.5 * nz, 0.005, 0.02)
    B['sfx'].add(y, c['t'], 0, 0.1)
    B['verb'].add(y, c['t'], 0, 0.05)


def sfx_land(c, B):
    p = pluck(penta(c['n'], 4), 1.4, 1.0, 0.5)
    n = ns(0.2)
    t = secs(n)
    th = np.sin(2 * np.pi * 120 * t) * np.exp(-t / 0.04)
    B['sfx'].add(p, c['t'], c['pan'], 0.14)
    B['sfx'].add(fades(th, 0.0005, 0.02), c['t'], c['pan'], 0.2)
    B['verb'].add(p, c['t'], c['pan'], 0.1)


def sfx_plink(c, B):
    x = bell(penta(c['n'] + 5, 6), 1.2, ratio=3.0, index=0.8, decay=0.35)
    B['sfx'].add(x, c['t'], c['pan'], 0.05 * c.get('v', 1))
    B['verb'].add(x, c['t'], c['pan'], 0.06 * c.get('v', 1))


def sfx_draw(c, B):
    d = c['dur']
    x = shaped_noise(d, lambda tt: 3000 + 1500 * tt / d, 0.8)
    x *= np.sin(np.pi * np.linspace(0, 1, x.size)) ** 0.5
    B['sfx'].add(fades(x), c['t'], c['pan'], 0.035)


def sfx_ping(c, B):
    v = c.get('v', 1.0)
    x = bell(penta(c['n'] + 5, 5), 2.8, ratio=2.0, index=1.0, decay=1.1)
    B['sfx'].add(x, c['t'], c['pan'], 0.13 * v)
    B['verb'].add(x, c['t'], c['pan'], 0.12 * v)
    B['delay'].add(x, c['t'], c['pan'], 0.05 * v)


def sfx_arc(c, B):
    d = c['dur']
    f0 = penta(c['n'] * 2, 4)
    x = glide(f0, f0 * 1.5, d + 0.4)
    n = x.size
    u = secs(n)
    env = np.clip(u / d, 0, 1) ** 0.8 * np.exp(-np.clip(u - d, 0, None) / 0.12)
    x = x * env + 0.3 * glide(f0 * 2.003, f0 * 3.0, d + 0.4) * env
    v = c.get('v', 1.0)
    B['sfx'].add(fades(x, 0.003, 0.03), c['t'], c['pan'], 0.07 * v)
    B['verb'].add(x, c['t'], c['pan'], 0.07 * v)


def sfx_zap(c, B):
    d = c['dur']
    x = glide(2400, 300, d) * np.exp(-secs(ns(d)) / (d * 0.6))
    nz = shaped_noise(d, lambda tt: 5000 * (0.12 ** (tt / d)), 1.4) * np.exp(-secs(ns(d)) / (d * 0.5))
    y = fades(0.6 * x + 0.4 * nz, 0.001, 0.02)
    B['sfx'].add_moving(y, c['t'], c['pan0'], c['pan1'], 0.08)
    B['verb'].add_moving(y, c['t'], c['pan0'], c['pan1'], 0.05)


def sfx_fill(c, B):
    n = ns(1.2)
    t = secs(n)
    x = sum(np.sin(2 * np.pi * hz(nm) * t) for nm in ('D4', 'A4', 'E5')) / 3
    env = (1 - np.exp(-t / 0.08)) * np.exp(-t / 0.45)
    th = np.sin(2 * np.pi * 85 * t) * np.exp(-t / 0.08)
    y = fades(x * env + 0.6 * th, 0.001, 0.05)
    B['sfx'].add(y, c['t'], c['pan'], 0.15)
    B['verb'].add(y, c['t'], c['pan'], 0.12)


def sfx_tilt(c, B):
    d = c['dur']
    x = shaped_noise(d, lambda tt: 180 + 900 * np.sin(np.pi * tt / d), 1.4)
    x *= np.sin(np.pi * np.linspace(0, 1, x.size)) ** 1.5
    r = glide(55, 82, d) * np.sin(np.pi * np.linspace(0, 1, ns(d)))
    B['sfx'].add_moving(fades(x * 0.8 + r * 0.5), c['t'], -0.4, 0.4, 0.12)
    B['verb'].add(fades(x), c['t'], 0, 0.04)


def sfx_layer(c, B):
    k = c['k']
    n = ns(0.3)
    t = secs(n)
    th = np.sin(2 * np.pi * np.cumsum(90 + 60 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.07)
    B['sfx'].add(fades(th, 0.0005, 0.02), c['t'], 0, 0.22 * c.get('v', 1))
    b = bell(penta(k + 3, 5), 1.0, ratio=2.0, index=0.7, decay=0.3)
    B['sfx'].add(b, c['t'], -0.3 + 0.08 * k, 0.06)
    B['verb'].add(b, c['t'], 0, 0.07)


def sfx_focus(c, B):
    d = c['dur'] + 0.6
    n = ns(d)
    t = secs(n)
    x = np.sin(2 * np.pi * hz('A5') * t + 0.15 * np.sin(2 * np.pi * 5.2 * t)) + 0.4 * np.sin(2 * np.pi * hz('E6') * t)
    env = np.clip(t / c['dur'], 0, 1) ** 1.5 * np.clip((d - t) / 0.4, 0, 1)
    B['sfx'].add(fades(x * env), c['t'], 0, 0.035)
    B['verb'].add(x * env, c['t'], 0, 0.04)


def sfx_riser(c, B):
    d = c['dur']
    x = shaped_noise(d, lambda tt: 400 * (16 ** (tt / d)), 1.3)
    u = np.linspace(0, 1, x.size)
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * np.cumsum(6 + 22 * u) / SR)
    s = glide(hz('A3'), hz('A5'), d)
    y = (x * 0.8 + s * 0.25) * u ** 2.2 * trem
    B['sfx'].add(fades(y, 0.01, 0.004), c['t'], 0, 0.16)
    B['verb'].add(y, c['t'], 0, 0.06)


def sfx_bar(c, B):
    r, p = c['r'], c['p']
    notes = ['A5', 'F#5', 'E5', 'D5', 'B4', 'A4', 'F#4']
    f = hz(notes[r])
    d = 0.35 + 1.4 * p
    n = ns(d + 0.3)
    t = secs(n)
    fr = f * 2 ** (-2 / 12 * np.exp(-t / 0.05))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) + 0.25 * np.sin(4 * np.pi * np.cumsum(fr) / SR)
    x *= (1 - np.exp(-t / 0.01)) * np.exp(-t / (0.12 + 0.9 * p))
    B['sfx'].add(fades(x, 0.001, 0.03), c['t'], c['pan'] - 0.05 * r, 0.09 * (0.6 + p))
    B['verb'].add(x, c['t'], 0, 0.06)


def sfx_tail(c, B):
    for k in range(18):
        x = click(5000 + 200 * k, 1.0, 0.001)
        B['sfx'].add(x, c['t'] + k * 0.025, 0.2, 0.05 * (1 - k / 18))


def sfx_select(c, B):
    for nm, dt, p in (('D6', 0, -0.2), ('A6', 0.07, 0.2)):
        x = bell(hz(nm), 2.0, ratio=2.0, index=1.2, decay=0.7)
        B['sfx'].add(x, c['t'] + dt, p, 0.07)
        B['verb'].add(x, c['t'] + dt, p, 0.08)
    B['sfx'].add(click(2200, 1.0, 0.003), c['t'], 0, 0.2)


def sfx_drop(c, B):
    # the band stops; a reversed swell breathes in towards the landing
    d = 1.0
    x = shaped_noise(d, lambda tt: 2500 + 5000 * tt / d, 1.6)
    u = np.linspace(0, 1, x.size)
    y = x * u ** 3
    B['sfx'].add(fades(y, 0.01, 0.003), c['t'], 0, 0.12)
    B['verb'].add(y, c['t'], 0, 0.06)


def sfx_impact(c, B):
    n = ns(2.2)
    t = secs(n)
    sub = glide(120, 41, 2.2) * np.exp(-t / 0.55)
    thump = filt(noise(n), 'lowpass', 220) * np.exp(-t / 0.06) * 1.3
    snap = filt(noise(n), 'highpass', 3000) * np.exp(-t / 0.03) * 0.35
    x = fades(np.tanh(1.4 * (sub + thump)) + snap, 0.0005, 0.08)
    B['sfx'].add(x, c['t'], c['pan'], 0.7)
    B['verb'].add(x, c['t'], c['pan'], 0.15)
    for nm, p in (('D5', -0.35), ('F#5', 0.0), ('A5', 0.35), ('D6', 0.0)):
        b = bell(hz(nm), 3.2, ratio=2.0, index=1.0, decay=1.4)
        B['sfx'].add(b, c['t'], p, 0.05)
        B['verb'].add(b, c['t'], p, 0.09)
        B['delay'].add(b, c['t'], p, 0.04)


GEN_MELODY = ['A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'A5']


def sfx_gen(c, B):
    f = hz(GEN_MELODY[c['n'] % len(GEN_MELODY)])
    p = pluck(f, 1.4, 1.3, 0.5)
    B['sfx'].add(p, c['t'], c['pan'], 0.17)
    B['delay'].add(p, c['t'], c['pan'], 0.08)
    B['verb'].add(p, c['t'], c['pan'], 0.07)
    B['sfx'].add(click(3800, 1.0, 0.0015), c['t'], c['pan'], 0.25)


def sfx_zoom(c, B):
    d = c['dur']
    x = shaped_noise(d, lambda tt: 1800 * (0.12 ** (tt / d)) + 120, 2.0)
    u = np.linspace(0, 1, x.size)
    x *= np.sin(np.pi * u ** 0.6) ** 2
    s = glide(hz('D5'), hz('D3'), d) * np.sin(np.pi * u) ** 2
    B['sfx'].add(fades(x * 0.9 + s * 0.15), c['t'], 0, 0.13)
    B['verb'].add(x, c['t'], 0, 0.08)


def sfx_swell(c, B):
    d = c['dur']
    x = shaped_noise(d, lambda tt: 7000, 2.2)
    u = np.linspace(0, 1, x.size)
    B['sfx'].add(fades(x * u ** 4, 0.01, 0.002), c['t'], 0, 0.14)


CHORDS = {
    'Dmaj9': ['D3', 'A3', 'C#4', 'E4', 'F#4'],
    'Bm11': ['B2', 'F#3', 'A3', 'D4', 'E4'],
    'Bm9': ['B2', 'F#3', 'A3', 'C#4', 'D4'],
    'Gmaj9': ['G2', 'D3', 'F#3', 'A3', 'B3'],
    'Gmaj7#11': ['G2', 'D3', 'F#3', 'B3', 'C#4'],
    'D/F#': ['F#2', 'D3', 'A3', 'E4', 'F#4'],
    'Em9': ['E2', 'B2', 'D3', 'F#3', 'G3'],
    'Asus4': ['A2', 'E3', 'A3', 'D4', 'E4'],
    'A6': ['A2', 'E3', 'F#3', 'C#4', 'E4'],
}


def sfx_stab(c, B):
    chord = ['Bm9', 'Gmaj9'][c['chord']]
    for i, nm in enumerate(CHORDS[chord]):
        p = pluck(hz(nm), 2.5, 0.8, 0.9)
        pn = (i - 2) * 0.2
        B['sfx'].add(p, c['t'], pn, 0.085)
        B['verb'].add(p, c['t'], pn, 0.1)
        pd = pad_note(hz(nm), 0.9, att=0.01, rel=1.2, bright=0.5, voices=3)
        B['sfx'].add(pd, c['t'], gain=0.05)
    sfx_hit({'t': c['t'], 'v': 0.75}, B)


def sfx_title(c, B):
    sfx_hit({'t': c['t'], 'v': 0.55}, B)
    for i, (nm, dt) in enumerate((('A5', 0.0), ('F#5', 0.24), ('D5', 0.48), ('A4', 1.2))):
        b = bell(hz(nm), 3.5, ratio=2.0, index=0.9, decay=1.3)
        B['sfx'].add(b, c['t'] + 0.05 + dt, -0.25 + 0.17 * i, 0.08)
        B['verb'].add(b, c['t'] + 0.05 + dt, 0, 0.1)
        B['delay'].add(b, c['t'] + 0.05 + dt, 0, 0.05)


SFX = {k[4:]: v for k, v in globals().items() if k.startswith('sfx_')}


# ---------------------------------------------------------------------------
# Score
# ---------------------------------------------------------------------------
def score(B, M):
    music, drums, verb, delay = B['music'], B['drums'], B['verb'], B['delay']

    # Intro drone: a low D that breathes in from silence.
    d = M['ch1'] + 1.5
    n = ns(d)
    t = secs(n)
    drone = (np.sin(2 * np.pi * hz('D2') * t) + 0.5 * np.sin(2 * np.pi * hz('A2') * t + 1) +
             0.18 * np.sin(2 * np.pi * hz('D3') * t * 1.0015))
    drone *= np.clip(t / 3.2, 0, 1) ** 1.3 * np.clip((d - t) / 1.6, 0, 1)
    music.add(drone, 0, 0, 0.16)
    air = shaped_noise(d, lambda tt: 5200, 1.5) * np.clip(t / 5, 0, 1) * np.clip((d - t) / 1.5, 0, 1)
    music.add(air, 0, 0, 0.012)

    # Pads: (start, length, chord, brightness)
    land = M['land']
    pads = [
        (M['ch1'], 4, 'Dmaj9', 0.45), (10, 4, 'Bm11', 0.5),
        (M['ch2'], 4, 'Gmaj9', 0.5), (18, 4, 'D/F#', 0.55), (22, 2, 'Em9', 0.55), (24, 2, 'Asus4', 0.55),
        (M['ch3'], 4, 'Bm9', 0.6), (30, 4, 'Gmaj9', 0.62), (34, 2, 'Dmaj9', 0.65), (36, 2, 'Asus4', 0.7),
        (M['ch4'], 4, 'Gmaj9', 0.7),
        (land, 1, 'Dmaj9', 0.7), (44, 2, 'Bm9', 0.7), (46, 2, 'Gmaj9', 0.72), (48, 2, 'A6', 0.72),
        (M['corpus'], 3.8, 'Gmaj7#11', 0.5),
        (M['end'], 5.2, 'Dmaj9', 0.5),
    ]
    for start, length, ch, br in pads:
        rel = 2.6 if ch in ('Gmaj7#11',) or start == M['end'] else (1.2 if start == land else 1.0)
        for i, nm in enumerate(CHORDS[ch]):
            x = pad_note(hz(nm), length, att=0.35 if start > M['ch2'] else 0.7, rel=rel, bright=br, sub=0.3 if i == 0 else 0.0)
            music.add(x, start, gain=0.05)
            verb.add(x, start, gain=0.025)

    # Bass
    def bass(start, end, root, pulse):
        f = hz(root)
        if not pulse:
            music.add(bass_note(f, end - start - 0.05), start, 0, 0.2)
            return
        tt = start
        k = 0
        while tt < end - 1e-6:
            ff = f * (2 if k % 4 == 3 else 1)
            music.add(bass_note(ff, 0.19, 0.05), tt, 0, 0.17 if k % 2 == 0 else 0.12)
            tt += 0.25
            k += 1

    bass_plan = [
        (6, 10, 'D2', False), (10, 14, 'B1', False),
        (14, 18, 'G1', False), (18, 22, 'F#1', False), (22, 24, 'E1', False), (24, 26, 'A1', False),
        (26, 30, 'B1', True), (30, 34, 'G1', True), (34, 35, 'D2', True),
        (38, 42, 'G1', True),
        (44, 46, 'B1', True), (46, 48, 'G1', True), (48, 50, 'A1', True),
        (50, 53.8, 'G1', False),
    ]
    for b in bass_plan:
        bass(*b)
    music.add(bass_note(hz('D2'), 1.0, 0.6), land, 0, 0.22)
    music.add(bass_note(hz('D2'), 5.0, 2.0), M['end'], 0, 0.2)

    # Plucked arpeggio, with a dotted-eighth echo
    arps = [
        (6, 10, 'Dmaj9', 0.25, 0.65), (10, 14, 'Bm11', 0.25, 0.7),
        (14, 18, 'Gmaj9', 0.25, 0.7), (18, 22, 'D/F#', 0.25, 0.7), (22, 24, 'Em9', 0.25, 0.75), (24, 26, 'Asus4', 0.25, 0.75),
        (26, 30, 'Bm9', 0.125, 0.85), (30, 34, 'Gmaj9', 0.125, 0.9), (34, 36, 'Dmaj9', 0.125, 0.95), (36, 37.5, 'Asus4', 0.125, 1.0),
        (38, 42, 'Gmaj9', 0.125, 1.1),
        (44, 46, 'Bm9', 0.125, 1.1), (46, 48, 'Gmaj9', 0.125, 1.1), (48, 50, 'A6', 0.125, 1.1),
        (50, 52, 'Gmaj7#11', 0.25, 0.7),
    ]
    for start, end, ch, step, br in arps:
        notes = [hz(nm) * 2 for nm in CHORDS[ch][1:]] + [hz(CHORDS[ch][1]) * 4]
        tt, k = start, 0
        while tt < end - 1e-6:
            f = notes[(k * 2) % len(notes)] if step < 0.2 else notes[k % len(notes)]
            acc = 1.0 if k % 4 == 0 else 0.72
            fade_out = np.clip((52 - tt) / 2, 0, 1) if start >= 50 else 1
            p = pluck(f, 0.7, br, 0.18 + 0.1 * br)
            pan = 0.35 * np.sin(k * 0.9)
            music.add(p, tt, pan, 0.075 * acc * fade_out)
            delay.add(p, tt, pan, 0.03 * acc * fade_out)
            tt += step
            k += 1

    # Drums
    kicks = []
    def k4(start, end, step=0.5, v=1.0):
        tt = start
        while tt < end - 1e-6:
            kicks.append((tt, v))
            tt += step
    k4(14, 24, 1.0, 0.75)             # half-time pulse while the map builds
    k4(26, 35, 0.5, 0.9)              # four on the floor for attention
    for tt in (37.5, 37.625, 37.75, 37.875):
        kicks.append((tt, 0.5 + (tt - 37.5)))
    k4(38, 42, 0.5, 1.0)
    k4(44, 50, 0.5, 1.0)
    for tt, v in kicks:
        drums.add(kick(v), tt, 0, 0.55)

    def hats(start, end, step, v, offbeat=False):
        tt = start + (step if offbeat else 0)
        k = 0
        while tt < end - 1e-6:
            acc = 1.0 if (k % 2 == 1 or offbeat) else 0.6
            x = hat(False, v * acc)
            drums.add(x, tt, 0.25 if k % 2 else -0.15, 0.6)
            tt += step * (2 if offbeat else 1)
            k += 1
    for tt in np.arange(6.25, 14, 0.5):  # brushed shaker, off-beats
        n = ns(0.12)
        sh = filt(noise(n), 'bandpass', (5000, 11000)) * np.exp(-secs(n) / 0.035) * (1 - np.exp(-secs(n) / 0.006))
        drums.add(fades(sh), tt, 0.3 * np.sin(tt * 3.1), 0.05 * (0.7 + 0.3 * ((tt * 2) % 2)))
    hats(14, 24, 0.25, 0.5, offbeat=True)
    hats(26, 35, 0.125, 0.55)
    hats(38, 42, 0.125, 0.6)
    hats(44, 50, 0.125, 0.6)
    for tt in np.arange(26.5, 35, 1.0).tolist() + np.arange(38.5, 42, 1.0).tolist() + np.arange(44.5, 50, 1.0).tolist():
        x = clap(1.0)
        drums.add(x, tt, 0.05, 0.3)
        verb.add(x, tt, 0, 0.12)
    for tt in (33.75, 41.75, 49.75):
        drums.add(hat(True, 0.7), tt, 0.3, 0.6)

    return kicks


# ---------------------------------------------------------------------------
# Effects and mixdown
# ---------------------------------------------------------------------------
def reverb_ir(sec=2.6, pre=0.02):
    n = ns(sec)
    t = secs(n)
    out = []
    for ch in range(2):
        w = noise(n)
        lp = filt(w, 'lowpass', 2800)
        x = lp * np.exp(-t * 6.9 / sec) + (w - lp) * 0.5 * np.exp(-t * 6.9 / (sec * 0.35))
        for k in range(6):  # a few early reflections
            i = ns(0.007 + 0.011 * k + 0.004 * ch)
            x[i] += (0.6 - 0.08 * k) * (1 if (k + ch) % 2 else -1)
        x = np.concatenate([np.zeros(ns(pre)), x])
        out.append(x / np.sqrt(np.sum(x ** 2)))
    return np.stack(out)


def apply_reverb(x):
    ir = reverb_ir()
    wet = np.stack([signal.fftconvolve(x[0], ir[0])[:x.shape[1]], signal.fftconvolve(x[1], ir[1])[:x.shape[1]]])
    return filt(wet, 'highpass', 180)


def apply_delay(x, time=0.375, fb=0.38, taps=6):
    out = np.zeros_like(x)
    d = ns(time)
    src = filt(x, 'lowpass', 3500)
    for k in range(1, taps + 1):
        g = fb ** (k - 1)
        ch = (k + 1) % 2  # ping-pong
        sh = d * k
        if sh >= x.shape[1]:
            break
        out[ch, sh:] += g * src[0, :-sh] * 0.7 + g * src[1, :-sh] * 0.3
        out[1 - ch, sh:] += g * src[1, :-sh] * 0.2
        src = filt(src, 'lowpass', 3000, 1)
    return out


def peak_eq(x, f0, gain_db, q=0.8):
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    alpha = np.sin(w0) / (2 * q)
    b = [1 + alpha * A, -2 * np.cos(w0), 1 - alpha * A]
    a = [1 + alpha / A, -2 * np.cos(w0), 1 - alpha / A]
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=-1)


def shelf(x, f0, gain_db, kind, q=0.707):
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    alpha = np.sin(w0) / (2 * q)
    cw = np.cos(w0)
    sA = 2 * np.sqrt(A) * alpha
    if kind == 'high':
        b = [A * ((A + 1) + (A - 1) * cw + sA), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sA)]
        a = [(A + 1) - (A - 1) * cw + sA, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sA]
    else:
        b = [A * ((A + 1) - (A - 1) * cw + sA), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sA)]
        a = [(A + 1) + (A - 1) * cw + sA, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sA]
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=-1)


def sidechain(n, kicks, depth=0.5, release=0.2):
    env = np.zeros(n)
    t = secs(ns(0.6))
    shape = np.exp(-t / release) * (1 - np.exp(-t / 0.004))
    for tk, v in kicks:
        i = int(tk * SR)
        m = min(shape.size, n - i)
        if m > 0:
            env[i:i + m] = np.maximum(env[i:i + m], shape[:m] * min(1, v))
    return 1 - depth * env


def main():
    cues_path, out_path = sys.argv[1], sys.argv[2]
    data = json.load(open(cues_path))
    M, dur = data['markers'], data['duration']
    B = {name: Bus(dur) for name in ('music', 'drums', 'sfx', 'verb', 'delay')}

    kicks = score(B, M)
    unknown = set()
    for c in data['cues']:
        fn = SFX.get(c['type'])
        if fn is None:
            unknown.add(c['type'])
            continue
        fn(c, B)
    if unknown:
        print('no sound for cue types:', sorted(unknown), file=sys.stderr)

    n = B['music'].x.shape[1]
    duck = sidechain(n, kicks, depth=0.45)
    music = B['music'].x * duck      # pads, bass and arp pump gently against the kick
    verb = apply_reverb(B['verb'].x)
    delay = apply_delay(B['delay'].x)
    mix = music + B['drums'].x + B['sfx'].x + verb * 0.9 + delay * 0.8
    mix = filt(mix, 'highpass', 28)
    mix = shelf(mix, 90, -3.0, 'low')
    mix = shelf(mix, 4200, 3.0, 'high')
    mix = peak_eq(mix, 3000, 2.5, 0.8)

    # The film fades to black at M['fade']; the sound fades with it, a little slower,
    # and the reverb tail rings out over the black before the last frame.
    t = secs(n)
    f0, f1 = M['fade'] + 0.2, data['duration'] - 0.05
    fade = np.clip(1 - (t - f0) / (f1 - f0), 0, 1) ** 1.5
    mix *= fade

    peak = np.abs(mix).max()
    mix = np.tanh(mix / peak * 1.25) / np.tanh(1.25) * 0.89  # gentle glue and headroom; loudness set later
    pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2').T
    import wave
    with wave.open(out_path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f'wrote {out_path}: {n / SR:.1f}s, {len(data["cues"])} cues')


if __name__ == '__main__':
    main()
