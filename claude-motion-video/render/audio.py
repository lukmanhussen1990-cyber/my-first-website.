"""Synthesizes the sound design for the Claude promo from the animation's cue list.

Everything is generated procedurally (no samples): glitch textures, whooshes, sub booms,
keyboard clicks, UI beeps, card hits, pads and bells, then reverb + a gentle master chain.

Usage: python3 render/audio.py out/cues.json out/audio.wav
"""
import json
import sys

import numpy as np
import scipy.signal as sps
from scipy.io import wavfile

SR = 48000
rng = np.random.default_rng(7)


# ----------------------------------------------------------------------------- helpers
def secs(n):
    return np.arange(n) / SR


def noise(n):
    return rng.standard_normal(n)


def filt(x, kind, f, order=2):
    if kind == 'band':
        sos = sps.butter(order, [max(20, f[0]), min(SR / 2 - 100, f[1])], 'bandpass', fs=SR, output='sos')
    else:
        sos = sps.butter(order, min(SR / 2 - 100, max(20, f)), kind, fs=SR, output='sos')
    return sps.sosfilt(sos, x)


def svf(x, fc, q=0.7, mode='bp'):
    """Time-varying state-variable filter; fc may be an array (Hz)."""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    g = np.tan(np.pi * np.clip(fc, 20, SR * 0.45) / SR)
    k = 1.0 / q
    ic1 = ic2 = 0.0
    out = np.empty_like(x)
    for i in range(len(x)):
        gi = g[i]
        a1 = 1.0 / (1.0 + gi * (gi + k))
        v3 = x[i] - ic2
        v1 = a1 * ic1 + gi * a1 * v3
        v2 = ic2 + gi * v1
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        out[i] = v1 if mode == 'bp' else v2 if mode == 'lp' else x[i] - k * v1 - v2
    return out


def osc(freq, n, kind='sine', phase=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    ph = phase + 2 * np.pi * np.cumsum(f) / SR
    if kind == 'sine':
        return np.sin(ph)
    if kind == 'tri':
        return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == 'square':
        return np.sign(np.sin(ph))
    raise ValueError(kind)


def saw(freq, n, harmonics=40):
    t = secs(n)
    out = np.zeros(n)
    for k in range(1, harmonics + 1):
        if k * freq > SR * 0.45:
            break
        out += np.sin(2 * np.pi * k * freq * t + rng.uniform(0, 2 * np.pi)) / k
    return out * 0.6


def env_exp(n, tau, attack=0.002):
    t = secs(n)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / tau)


def env_adsr(n, a, d, s, r, hold):
    t = secs(n)
    e = np.where(t < a, t / max(a, 1e-4), 0)
    dec = (t >= a) & (t < a + d)
    e = np.where(dec, 1 - (1 - s) * (t - a) / max(d, 1e-4), e)
    sus = (t >= a + d) & (t < hold)
    e = np.where(sus, s, e)
    rel = t >= hold
    e = np.where(rel, s * np.exp(-(t - hold) / max(r, 1e-4)), e)
    return e


def bell(freq, n, tau=0.6):
    t = secs(n)
    partials = [(1, 1.0, 1.0), (2.0, 0.35, 0.6), (2.76, 0.28, 0.45), (5.4, 0.12, 0.25), (8.93, 0.05, 0.15)]
    out = np.zeros(n)
    for ratio, amp, tm in partials:
        out += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / (tau * tm))
    return out * np.clip(t / 0.002, 0, 1)


def note(name):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + 12 * (octave + 1) - 69) / 12)


# ----------------------------------------------------------------------------- mix bus
class Bus:
    def __init__(self, dur):
        self.n = int(dur * SR)
        self.dry = np.zeros((2, self.n))
        self.wet = np.zeros((2, self.n))

    def add(self, sig, t, gain=1.0, pan=0.0, rev=0.15):
        sig = np.asarray(sig, dtype=float)
        if sig.ndim == 1:
            gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            sig = np.vstack([sig * gl, sig * gr]) * np.sqrt(2)
        i = int(round(t * SR))
        if i < 0:
            sig = sig[:, -i:]
            i = 0
        m = min(sig.shape[1], self.n - i)
        if m <= 0:
            return
        self.dry[:, i:i + m] += sig[:, :m] * gain
        self.wet[:, i:i + m] += sig[:, :m] * gain * rev


def reverb_ir(seconds=2.4, tau=0.55):
    n = int(seconds * SR)
    t = secs(n)
    ir = np.zeros((2, n))
    for c in range(2):
        x = noise(n) * np.exp(-t / tau)
        lo = filt(x, 'low', 2400) * np.exp(-t / (tau * 0.4))
        ir[c] = filt(x, 'low', 7000) * 0.55 + lo * 0.6
        ir[c, : int(0.012 * SR)] *= 0
    for d, g in [(0.013, 0.5), (0.021, 0.35), (0.034, 0.3), (0.047, 0.22)]:
        ir[0, int(d * SR)] += g
        ir[1, int((d + 0.004) * SR)] += g
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


# ----------------------------------------------------------------------------- sounds
def s_boom(v=1.0, length=1.8, f0=40, f1=120):
    n = int(length * SR)
    t = secs(n)
    f = f0 + f1 * np.exp(-t / 0.06)
    body = osc(f, n) * env_exp(n, 0.55, 0.004)
    click = filt(noise(n), 'high', 1800) * np.exp(-t / 0.004) * 0.35
    rumble = filt(noise(n), 'low', 110) * np.exp(-t / 0.4) * 1.2
    return np.tanh(1.5 * (body + click + rumble)) * v


def s_whoosh(dur=0.5, v=1.0, lo=250, hi=4200, pan_from=-0.6, pan_to=0.6):
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    e = np.sin(np.pi * u ** 0.75) ** 2
    x = filt(noise(n), 'low', 9000)
    y = svf(x, lo + (hi - lo) * e, q=1.1) * e * 1.4
    pan = np.linspace(pan_from, pan_to, n)
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    return np.vstack([y * gl, y * gr]) * v * 1.4


def s_tick(v=1.0, f=2600):
    n = int(0.06 * SR)
    t = secs(n)
    c = filt(noise(n), 'band', (2500, 9000)) * np.exp(-t / 0.0022)
    p = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012) * 0.35
    return (c + p) * v


def s_blip(v=1.0, f=2093):
    n = int(0.09 * SR)
    t = secs(n)
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * env_exp(n, 0.022, 0.001) * v


def s_key(v=1.0):
    n = int(0.09 * SR)
    t = secs(n)
    f = rng.uniform(150, 230)
    thock = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012) * 0.55
    click = filt(noise(n), 'band', (1800, 7500)) * np.exp(-t / 0.0024)
    d = int(rng.uniform(0.007, 0.016) * SR)
    clack = np.zeros(n)
    clack[d:] = filt(noise(n - d), 'band', (700, 2600)) * np.exp(-secs(n - d) / 0.005) * 0.45
    return (click + thock + clack) * v * rng.uniform(0.8, 1.0)


def s_mouse(v=1.0):
    n = int(0.16 * SR)
    out = np.zeros(n)
    for off, g in [(0, 1.0), (int(0.075 * SR), 0.6)]:
        m = n - off
        t = secs(m)
        out[off:] += (filt(noise(m), 'band', (1500, 6000)) * np.exp(-t / 0.0018) + np.sin(2 * np.pi * 3100 * t) * np.exp(-t / 0.006) * 0.3) * g
    return out * v


def s_pop(v=1.0):
    n = int(0.25 * SR)
    t = secs(n)
    f = 260 + 700 * np.exp(-t / 0.018)
    return (osc(f, n) * env_exp(n, 0.05, 0.001) + filt(noise(n), 'high', 2000) * np.exp(-t / 0.003) * 0.4) * v


def s_card(v=1.0):
    n = int(0.45 * SR)
    t = secs(n)
    f = 46 + 70 * np.exp(-t / 0.03)
    kick = osc(f, n) * env_exp(n, 0.13, 0.002)
    sw_env = np.clip(t / 0.012, 0, 1) * np.exp(-t / 0.05)
    swish = filt(noise(n), 'band', (1400, 6500)) * sw_env * 0.5
    snap = filt(noise(n), 'high', 3000) * np.exp(-t / 0.003) * 0.3
    return np.tanh(1.3 * (kick + swish + snap)) * v


def s_beep(f, v=1.0):
    n = int(0.5 * SR)
    t = secs(n)
    wob = 1 + 0.004 * np.sin(2 * np.pi * 28 * t)
    tone = osc(f * wob, n) + 0.3 * osc(2 * f * wob, n) * np.exp(-t / 0.05)
    e = env_exp(n, 0.13, 0.002)
    out = tone * e
    d = int(0.13 * SR)
    out[d:] += out[:-d] * 0.35
    return out * v


def s_pluck(f, v=1.0):
    n = int(0.6 * SR)
    t = secs(n)
    tone = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.05) + 0.15 * np.sin(6 * np.pi * f * t) * np.exp(-t / 0.03)
    return tone * env_exp(n, 0.16, 0.001) * v


def s_pad(freqs, dur, v=1.0, attack=0.6, release=0.9, cutoff=1500, detune=0.006):
    n = int((dur + release * 3) * SR)
    out = np.zeros((2, n))
    for i, f in enumerate(freqs):
        for c, dt in enumerate([-detune, detune]):
            voice = saw(f * (1 + dt), n, harmonics=24)
            out[c] += voice
    t = secs(n)
    lfo = 1 + 0.25 * np.sin(2 * np.pi * 0.35 * t)
    for c in range(2):
        out[c] = svf(out[c], cutoff * lfo, q=0.8, mode='lp')
    e = env_adsr(n, attack, 0.4, 0.8, release, dur)
    out = np.vstack([filt(out[c], 'high', 140) for c in range(2)])
    return out * e / len(freqs) * v


def s_riser(dur, v=1.0, lo=300, hi=7000):
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    e = u ** 2.2
    x = filt(noise(n), 'high', 200)
    y = svf(x, lo * (hi / lo) ** u, q=2.2) * e
    tone = osc(220 * 4 ** u, n) * e * 0.15
    return (y * 1.5 + tone) * v


def s_reverse_air(dur, v=1.0):
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    x = filt(noise(n), 'band', (600, 9000))
    return x * u ** 3 * v


def s_glitch_grain(kind, v=1.0):
    if kind == 0:  # bit-crushed noise burst
        n = int(rng.uniform(0.008, 0.045) * SR)
        x = noise(n)
        hold = int(rng.integers(6, 30))
        x = np.repeat(x[::hold], hold)[:n]
        x = np.round(x * 3) / 3
        return filt(x, 'high', 900) * np.hanning(n) * v * 0.5
    if kind == 1:  # square blip
        n = int(rng.uniform(0.012, 0.05) * SR)
        f = rng.choice([1174.7, 1568, 1760, 2349, 2637, 3136, 3520])
        return osc(f, n, 'square') * env_exp(n, 0.015, 0.001) * v * 0.22
    n = int(rng.uniform(0.03, 0.09) * SR)  # chirp
    t = secs(n)
    f = rng.uniform(800, 2500) * np.exp(t * rng.uniform(-30, 30))
    return osc(f, n) * np.hanning(n) * v * 0.3


# ----------------------------------------------------------------------------- score
def render(cues, duration):
    bus = Bus(duration + 1.0)
    P = lambda: rng.uniform(-0.5, 0.5)

    for c in cues:
        t, kind, v = c['t'], c['type'], c.get('v', 1.0)
        dur = c.get('dur', 0.5)
        if kind == 'intro':
            # low swell + granular digital glitches building toward the pixel wipe
            n = int(2.7 * SR)
            tt = secs(n)
            drone = (0.6 * np.sin(2 * np.pi * 55 * tt) + 0.3 * np.sin(2 * np.pi * 110 * tt) + 0.12 * np.sin(2 * np.pi * 164.8 * tt))
            drone *= np.clip(tt / 2.2, 0, 1) ** 1.6 * 0.5
            bus.add(drone, t, 0.35, 0, 0.1)
            shimmer = (np.sin(2 * np.pi * note('A5') * tt) + 0.6 * np.sin(2 * np.pi * note('E6') * tt) + 0.4 * np.sin(2 * np.pi * note('C#6') * tt))
            shimmer *= np.clip(tt / 1.6, 0, 1) * (0.5 + 0.5 * np.sin(2 * np.pi * 5.5 * tt)) * 0.05
            bus.add(shimmer, t, 1, 0, 0.6)
            for k in range(90):
                tg = t + 2.45 * (k / 90) ** 0.8 + rng.uniform(-0.02, 0.02)
                dens = 0.35 + 0.65 * (tg - t) / 2.45
                if rng.random() > dens:
                    continue
                bus.add(s_glitch_grain(int(rng.integers(0, 3)), 0.55), tg, 0.6, P() * 1.6, 0.25)
        elif kind == 'pixel':
            n16 = int(dur / 0.05)
            scale = [note(x) for x in ['D6', 'F#6', 'A6', 'B6', 'D7', 'E7']]
            for k in range(n16):
                tg = t + k * 0.05
                m = int(0.045 * SR)
                f = scale[int(rng.integers(0, len(scale)))] * (1 - 0.25 * k / n16)
                bus.add(osc(f, m, 'square') * env_exp(m, 0.02, 0.001) * 0.16, tg, v, P() * 1.4, 0.2)
                if k % 2 == 0:
                    bus.add(s_glitch_grain(0, 0.6), tg + 0.01, v, P(), 0.1)
            bus.add(s_whoosh(dur, 0.6, 400, 6000, 0.6, -0.6), t, v, 0, 0.15)
        elif kind == 'boom':
            bus.add(s_boom(v), t, 0.9, 0, 0.12)
        elif kind == 'whoosh':
            bus.add(s_whoosh(dur, v), t - dur * 0.5, 0.9, 0, 0.2)
        elif kind == 'bigwhoosh':
            bus.add(s_whoosh(dur, v, 180, 5200, -0.8, 0.8), t, 1.0, 0, 0.3)
            bus.add(s_reverse_air(0.45, 0.25), t - 0.15, 1, 0, 0.3)
            bus.add(s_boom(0.55, 1.6, 36, 70), t + 0.42, 1, 0, 0.2)
        elif kind == 'tick':
            bus.add(s_tick(v), t, 0.55, P() * 0.4, 0.2)
        elif kind == 'blip':
            bus.add(s_blip(v, rng.choice([1760, 2093, 2349, 2637])), t, 0.5, P() * 1.2, 0.3)
        elif kind == 'flick':
            bus.add(s_tick(v * 0.8, rng.uniform(2200, 3800)), t, 0.6, P(), 0.15)
        elif kind == 'snap':
            bus.add(s_tick(v, 3000), t, 0.8, 0, 0.2)
            bus.add(s_boom(0.35, 0.5, 70, 90), t, 1, 0, 0.1)
        elif kind == 'breath':
            bus.add(s_reverse_air(0.27, 0.35), t, 1, 0, 0.4)
        elif kind == 'reveal':
            flash = filt(noise(int(0.9 * SR)), 'high', 3000) * env_exp(int(0.9 * SR), 0.18, 0.002) * 0.35
            bus.add(flash, t, v, 0, 0.6)
            chord = [note(x) for x in ['D3', 'A3', 'C#4', 'E4', 'F#4', 'A4']]
            bus.add(s_pad(chord, 3.25, 0.55, attack=0.35, release=0.25, cutoff=1700), t, v, 0, 0.45)
            bus.add(np.sin(2 * np.pi * note('D2') * secs(int(3.7 * SR))) * env_adsr(int(3.7 * SR), 0.4, 0.3, 0.8, 0.2, 3.3) * 0.1, t, v, 0, 0)
            for k, nm in enumerate(['A5', 'F#5', 'E5', 'D5']):
                bus.add(bell(note(nm), int(1.8 * SR), 0.7) * 0.11, t + 0.62 + k * 0.42, v, (-0.4, 0.3, -0.2, 0.4)[k], 0.6)
        elif kind == 'swell':
            bus.add(s_riser(dur, 0.5, 300, 6500), t, v, 0, 0.25)
        elif kind == 'pop':
            bus.add(s_pop(v), t, 0.7, 0, 0.25)
            bus.add(s_boom(0.4, 0.8, 50, 80), t, 1, 0, 0.1)
        elif kind == 'air':
            n = int(4.3 * SR)
            x = filt(filt(noise(n), 'low', 1100), 'high', 140)
            tt = secs(n)
            e = np.clip(tt / 0.3, 0, 1) * np.clip((4.25 - tt) / 0.25, 0, 1) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.4 * tt))
            bus.add(x * e * 0.13, t, v, 0, 0.3)
        elif kind == 'key':
            bus.add(s_key(v), t, 0.95 if v >= 1 else 0.62, P() * 0.5, 0.06)
        elif kind == 'cut':
            n = int(0.05 * SR)
            bus.add(filt(noise(n), 'low', 3500) * env_exp(n, 0.004, 0.0005) * v, t, 0.5, 0, 0.1)
        elif kind == 'click':
            bus.add(s_mouse(v), t, 0.8, 0.2, 0.1)
        elif kind == 'send':
            bus.add(s_whoosh(0.4, 0.5, 600, 5200, -0.2, 0.4), t, v, 0, 0.25)
            bus.add(bell(note('D6'), int(1.2 * SR), 0.35) * 0.18, t + 0.05, v, -0.1, 0.5)
            bus.add(bell(note('A6'), int(1.2 * SR), 0.35) * 0.16, t + 0.13, v, 0.15, 0.5)
        elif kind == 'beep':
            f = [note('D6'), note('F#6'), note('A6'), note('D7')][c.get('n', 0)]
            bus.add(s_beep(f, 0.32), t, v, (-0.3, 0.1, -0.1, 0.3)[c.get('n', 0)], 0.3)
        elif kind == 'data':
            for k in range(int(dur * 38)):
                tg = t + rng.uniform(0, dur)
                m = int(rng.uniform(0.006, 0.022) * SR)
                f = rng.choice([2093, 2637, 3136, 3520, 4186, 5274])
                bus.add(osc(f, m) * np.hanning(m) * 0.09, tg, v, P() * 1.6, 0.2)
            n = int(dur * SR)
            tt = secs(n)
            bed = filt(noise(n), 'band', (3000, 9000)) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 16 * tt))) * 0.025
            bed *= np.clip(tt / 0.2, 0, 1) * np.clip((dur - tt) / 0.3, 0, 1)
            bus.add(bed, t, v, 0, 0.1)
        elif kind == 'plink':
            scale = [note(x) for x in ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6', 'A6']]
            bus.add(s_pluck(scale[c.get('n', 0) % len(scale)], 0.22), t, v * 2, P() * 1.4, 0.35)
        elif kind == 'riser':
            bus.add(s_riser(dur, 0.6, 400, 8000), t, v, 0, 0.3)
        elif kind == 'impact':
            bus.add(s_boom(1.0, 2.0, 38, 110), t, v * 0.9, 0, 0.15)
            sh = filt(noise(int(1.4 * SR)), 'high', 5000) * env_exp(int(1.4 * SR), 0.25, 0.002) * 0.22
            bus.add(sh, t, v, 0, 0.7)
            for k, nm in enumerate(['D6', 'F#6', 'A6']):
                bus.add(bell(note(nm), int(2.0 * SR), 0.8) * 0.06, t + k * 0.03, v, (-0.4, 0, 0.4)[k], 0.7)
        elif kind == 'card':
            bus.add(s_card(v), t, 0.62, P() * 0.6, 0.12)
        elif kind == 'word':
            bus.add(s_whoosh(0.32, 0.55, 300, 3500), t - 0.1, v, 0, 0.25)
            bus.add(s_boom(0.35, 0.6, 55, 60), t, v, 0, 0.1)
        elif kind == 'type':
            bus.add(s_tick(0.25, rng.uniform(3000, 4200)), t, v * 1.5, P() * 0.8, 0.4)
        elif kind == 'pad':
            chord = [note(x) for x in ['B2', 'F#3', 'A3', 'C#4', 'D4', 'F#4']]
            bus.add(s_pad(chord, dur, 0.5, attack=0.7, release=0.6, cutoff=1300), t, v, 0, 0.5)
            bus.add(np.sin(2 * np.pi * note('B1') * secs(int((dur + 1) * SR))) * env_adsr(int((dur + 1) * SR), 0.6, 0.3, 0.8, 0.4, dur) * 0.09, t, v, 0, 0)
        elif kind == 'flip':
            bus.add(s_whoosh(0.32, 0.7, 400, 4500, 0.5, -0.5), t - 0.2, v, 0, 0.2)
            bus.add(s_card(0.6), t + 0.02, v, 0, 0.15)
        elif kind == 'land':
            bus.add(s_boom(0.3, 0.6, 60, 80), t, v, 0, 0.1)
            bus.add(s_tick(0.4, 2400), t, v, 0, 0.3)
        elif kind == 'bloom':
            bus.add(s_reverse_air(0.42, 0.35), t - 0.42, v, 0, 0.4)
            bus.add(s_boom(0.8, 2.2, 36, 90), t, v, 0, 0.15)
            for k, nm in enumerate(['D5', 'F#5', 'A5', 'E6', 'A6']):
                bus.add(bell(note(nm), int(3.0 * SR), 1.1) * 0.09, t + k * 0.045, v, (-0.5, -0.2, 0.1, 0.35, 0.55)[k], 0.75)
        elif kind == 'shimmer':
            for k in range(14):
                f = rng.choice([note(x) for x in ['A6', 'B6', 'D7', 'E7', 'F#7', 'A7']])
                bus.add(bell(f, int(0.8 * SR), 0.18) * 0.045, t + rng.uniform(0, 0.7), v, P() * 1.6, 0.7)
        elif kind == 'end':
            chord = [note(x) for x in ['D3', 'A3', 'C#4', 'E4', 'F#4']]
            bus.add(s_pad(chord, dur, 0.45, attack=0.5, release=0.7, cutoff=1500), t - 0.5, v, 0, 0.5)

    # reverb
    ir = reverb_ir()
    wet = np.vstack([sps.fftconvolve(bus.wet[c], ir[c])[: bus.n] for c in range(2)])
    mix = bus.dry + wet * 0.55
    mix = np.vstack([filt(mix[c], 'high', 28) for c in range(2)])
    # gentle glue compression + soft clip
    level = np.max(np.abs(mix), axis=0)
    env = sps.filtfilt(*sps.butter(1, 6, fs=SR), level)
    thr = np.percentile(env, 97) * 0.75
    gain = np.where(env > thr, (thr / np.maximum(env, 1e-9)) ** 0.4, 1.0)
    mix = mix * gain
    mix = np.tanh(mix / np.max(np.abs(mix)) * 1.25) / np.tanh(1.25)
    # fades + trim to video length
    total = int(duration * SR)
    mix = mix[:, :total]
    fade = int(0.9 * SR)
    mix[:, -fade:] *= np.linspace(1, 0, fade) ** 1.5
    mix[:, : int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
    mix *= 10 ** (-1.0 / 20) / np.max(np.abs(mix))
    return mix


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    data = json.load(open(src))
    out = render(data['cues'], data['duration'])
    wavfile.write(dst, SR, (out.T * 32767).astype(np.int16))
    print(f'wrote {dst}: {out.shape[1] / SR:.2f}s, {len(data["cues"])} cues')
