"""Synthesize all SFX + music from code, then mix with the voiceover.

Usage: python3 make_audio.py cues.json vo_tight.wav out_mix.wav
All sounds are generated here (numpy only). Silly cartoon sounds, nothing gross.
"""
import json, sys, wave
import numpy as np

SR = 44100
rng = np.random.default_rng(11)


# ---------------------------------------------------------------- primitives
def N(d): return max(1, int(d * SR))
def tt(d): return np.arange(N(d)) / SR

def fit(x, n): return np.concatenate([x, np.zeros(max(0, n - len(x)))])[:n]

def osc(freq, d=None, wave='sine'):
    f = np.full(N(d if d is not None else 0.5), float(freq)) if np.isscalar(freq) else np.asarray(freq, float)
    ph = 2 * np.pi * np.cumsum(f) / SR
    c = (ph / (2 * np.pi)) % 1
    if wave == 'sine': return np.sin(ph)
    if wave == 'saw': return 2 * c - 1
    if wave == 'square': return np.where(c < 0.5, 1.0, -1.0)
    if wave == 'tri': return 2 * np.abs(2 * c - 1) - 1
    if wave == 'pulse': return np.where(c < 0.25, 1.0, -1.0)
    raise ValueError(wave)

def env(n, a=0.005, d=0.3):
    t = np.arange(n) / SR
    return np.clip(t / a, 0, 1) * np.exp(-t / d) if a > 0 else np.exp(-t / d)

def adsr(n, a, d, s, r):
    t = np.arange(n) / SR; T = n / SR
    e = np.where(t < a, t / max(a, 1e-4), np.where(t < a + d, 1 - (1 - s) * (t - a) / max(d, 1e-4), s))
    rel = np.clip((T - t) / max(r, 1e-4), 0, 1)
    return e * rel

def bell(n):  # smooth hump
    return np.sin(np.linspace(0, np.pi, n)) ** 2

def noise(d): return rng.uniform(-1, 1, N(d))

def bandnoise(d, lo, hi):
    x = noise(d); X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(X, len(x)); return y / (np.abs(y).max() + 1e-9)

def svf(x, fc, q=0.8, mode='lp'):
    """Chamberlin state-variable filter; fc can be an array (sweeps)."""
    if np.isscalar(fc): fc = np.full(len(x), float(fc))
    else:
        fc = np.asarray(fc, float)
        fc = np.concatenate([fc, np.full(max(0, len(x) - len(fc)), fc[-1])])[:len(x)]
    F = 2 * np.sin(np.pi * np.clip(fc, 20, SR / 6) / SR)
    damp = 1.0 / q
    low = band = 0.0
    out = np.empty(len(x))
    for i in range(len(x)):
        high = x[i] - low - damp * band
        band += F[i] * high
        low += F[i] * band
        out[i] = low if mode == 'lp' else band if mode == 'bp' else high
    return out

def lin(d, a, b): return np.linspace(a, b, N(d))
def expo(d, a, b): return a * (b / a) ** np.linspace(0, 1, N(d))

def mix(*parts):
    n = max(len(p) for p in parts); o = np.zeros(n)
    for p in parts: o[:len(p)] += p
    return o

def place(buf, x, t):
    i = int(t * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(x)); buf[i:j] += x[:j - i]

def seq(items):
    """items: list of (start_time, array)"""
    n = max(int(t * SR) + len(a) for t, a in items); o = np.zeros(n)
    for t, a in items: o[int(t * SR):int(t * SR) + len(a)] += a
    return o

def norm(x, p=1.0): return x / (np.abs(x).max() + 1e-9) * p


# ---------------------------------------------------------------- sound effects
def toot(d, f0, f1, wob=22, depth=0.18, bright=1400, flutter=0.5):
    t = tt(d)
    f = expo(d, f0, f1) * (1 + depth * np.sin(2 * np.pi * wob * t) + 0.04 * rng.standard_normal(len(t)).cumsum() / 200)
    x = osc(f, wave='pulse') * 0.7 + osc(f * 0.5, wave='saw') * 0.4
    x += 0.15 * bandnoise(d, 200, 2500)
    x = svf(x, bright, 1.2)
    am = 1 - flutter * 0.5 * (1 + np.sin(2 * np.pi * (wob * 0.7) * t))
    return x * am * adsr(len(t), 0.015, 0.05, 0.85, 0.08)

def S_pop():
    d = 0.14; f = expo(d, 380, 1300)
    return mix(osc(f) * env(N(d), 0.001, 0.045), 0.4 * bandnoise(0.01, 2000, 8000))

def S_whoosh(d=0.45, a=500, b=3200):
    n = noise(d); fc = np.concatenate([expo(d * 0.55, a, b), expo(d * 0.45, b, a * 1.6)])[:N(d)]
    return svf(n, fc, 2.0, 'bp') * bell(N(d))

def S_thud():
    d = 0.35; f = expo(d, 140, 42)
    return mix(osc(f) * env(N(d), 0.001, 0.12), 0.3 * svf(noise(0.05), 800) * env(N(0.05), 0.001, 0.02))

def S_boing():
    d = 0.7; t = tt(d)
    f = 210 + 90 * np.sin(2 * np.pi * 11 * t) * np.exp(-3.5 * t) + 60 * t
    return osc(f) * env(len(t), 0.002, 0.3) + 0.25 * osc(f * 2, wave='tri') * env(len(t), 0.002, 0.15)

def S_rewind():
    parts = []
    for i in range(6):
        d = 0.09; parts.append((i * 0.085, osc(expo(d, 2400 - i * 250, 700), wave='saw') * env(N(d), 0.002, 0.05)))
    return mix(svf(seq(parts), 3500, 0.9), 0.3 * S_whoosh(0.5, 3000, 600))

def S_whistle():
    d = 0.55; t = tt(d)
    f = 2700 + 160 * np.sign(np.sin(2 * np.pi * 34 * t))
    return (osc(f) * 0.8 + 0.25 * bandnoise(d, 2000, 6000)) * adsr(len(t), 0.01, 0.05, 0.9, 0.06)

def S_sparkle():
    notes = [2093, 2637, 3136, 3951, 3136, 4186, 3520, 4699]
    return seq([(i * 0.055, (osc(f, 0.35) + 0.3 * osc(f * 2.01, 0.35)) * env(N(0.35), 0.001, 0.12)) for i, f in enumerate(notes)])

def S_snapzoom():
    return mix(S_whoosh(0.18, 1500, 6000) * 0.8, np.concatenate([np.zeros(N(0.12)), S_thud() * 0.7]))

def S_ding(f=1318.5, d=1.2):
    t = tt(d)
    return (osc(f, d) + 0.45 * osc(f * 2.76, d) * np.exp(-t * 3) + 0.25 * osc(f * 5.4, d) * np.exp(-t * 6)) * env(len(t), 0.001, 0.45)

def S_crunch():
    parts = [(i * 0.045 + rng.uniform(0, 0.015), svf(noise(0.03), 4000, 0.8, 'hp') * env(N(0.03), 0.001, 0.01)) for i in range(7)]
    return seq(parts)

def S_tada():
    def brass(fs, d):
        t = tt(d); x = sum(osc(f * (1 + 0.003 * np.sin(2 * np.pi * 5 * t)), wave='saw') for f in fs)
        return svf(x, 2400, 0.9) * adsr(len(t), 0.02, 0.1, 0.8, 0.12)
    return seq([(0, brass([523.25, 659.25, 784.0], 0.12)), (0.14, brass([523.25, 659.25, 784.0, 1046.5], 0.75))])

def S_swoosh(): return S_whoosh(0.35, 300, 2500)

def S_alarm():
    parts = []
    for i in range(4):
        f = 880 if i % 2 == 0 else 660
        parts.append((i * 0.16, svf(osc(f, 0.15, 'square'), 3000) * adsr(N(0.15), 0.005, 0.02, 0.9, 0.02)))
    return seq(parts)

def S_send():
    d = 0.16; return osc(expo(d, 600, 1700)) * env(N(d), 0.002, 0.07)

def S_msg():
    return seq([(0, S_ding(1568, 0.4) * 0.8), (0.09, S_ding(2093, 0.6))])

def S_impact():
    d = 1.2; t = tt(d)
    boom = osc(expo(d, 110, 38)) * env(len(t), 0.001, 0.28)
    crash = svf(noise(d), 5000, 0.7, 'hp') * env(len(t), 0.001, 0.35) * 0.4
    return mix(boom + crash, 0.4 * svf(noise(0.08), 1200) * env(N(0.08), 0.001, 0.03))

def S_bell():
    return mix(S_ding(2093, 1.0), np.concatenate([np.zeros(N(0.11)), S_ding(2637, 1.0) * 0.8]), np.concatenate([np.zeros(N(0.2)), S_ding(2093, 0.8) * 0.5]))

def S_steps():
    return seq([(i * 0.28, svf(noise(0.06), 600) * env(N(0.06), 0.001, 0.02) + osc(90, 0.06) * env(N(0.06), 0.001, 0.03)) for i in range(4)])

def S_choir(fs=(523.25, 659.25, 784.0, 1046.5), d=1.6):
    t = tt(d); x = np.zeros(len(t))
    for i, f in enumerate(fs):
        for det in (-0.004, 0.004):
            x += osc(f * (1 + det) * (1 + 0.006 * np.sin(2 * np.pi * 5.2 * t + i)), wave='saw')
    x = svf(x, 900, 3.0, 'bp') * 0.6 + svf(x, 1300, 4.0, 'bp') * 0.4
    return x * adsr(len(t), 0.18, 0.2, 0.8, 0.5)

def S_growl():
    d = 1.1; t = tt(d)
    f = 62 + 18 * np.sin(2 * np.pi * 3.3 * t) + 10 * np.sin(2 * np.pi * 7.1 * t)
    x = osc(f, wave='saw') * 0.7 + svf(noise(d), 300) * 0.6
    am = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 4.5 * t + np.sin(2 * np.pi * 1.3 * t)))
    gurgle = seq([(rng.uniform(0, d - 0.1), osc(expo(0.06, rng.uniform(200, 400), rng.uniform(500, 900))) * env(N(0.06), 0.002, 0.02)) for _ in range(6)])
    return svf(x, 600, 1.4) * am * adsr(len(t), 0.05, 0.1, 0.9, 0.2) + 0.4 * fit(gurgle, len(t))

def S_rattle():
    parts = []
    for i in range(12):
        hit = svf(noise(0.025), 2400 + rng.uniform(-300, 300), 6, 'bp') * env(N(0.06), 0.001, 0.02)[:N(0.025)]
        parts.append((i * 0.058 + rng.uniform(0, 0.01), hit))
    return seq(parts)

def S_zoomout(): return S_whoosh(0.7, 2600, 300)

def S_dundun():
    def note(f, d):
        t = tt(d); x = osc(f, d, 'saw') + osc(f * 1.005, d, 'saw') + 0.6 * osc(f / 2, d, 'saw')
        return svf(x, 900, 1.0) * adsr(len(t), 0.01, 0.1, 0.8, 0.15)
    return seq([(0, note(146.8, 0.22)), (0.26, note(146.8, 0.22)), (0.52, note(130.8, 1.0))])

def S_gasp():
    d = 0.45; return svf(noise(d), lin(d, 900, 1600), 2.0, 'bp') * adsr(N(d), 0.04, 0.05, 0.7, 0.2)

def S_munch():
    one = lambda: svf(noise(0.12), 900) * env(N(0.12), 0.002, 0.04) + 0.5 * S_crunch()[:N(0.12)]
    return seq([(0, one()), (0.22, one())])

def S_paper():
    d = 0.45; x = svf(noise(d), 3000, 0.7, 'hp')
    am = np.repeat(rng.uniform(0.1, 1, int(d * 60) + 1), N(d) // (int(d * 60)) + 1)[:N(d)]
    return x * am * bell(N(d))

def S_stamp():
    return mix(S_thud() * 1.2, svf(noise(0.04), 2500, 2, 'bp') * env(N(0.04), 0.001, 0.012))

def S_blip(lo=280, hi=480):
    return seq([(i * 0.11, svf(osc(rng.uniform(lo, hi), 0.08, 'square'), 2000) * adsr(N(0.08), 0.004, 0.01, 0.8, 0.02)) for i in range(5)])

def S_blip2(): return S_blip(480, 760)

def S_buzzer():
    d = 0.75; x = osc(118, d, 'square') + osc(124, d, 'saw')
    return svf(x, 1800, 0.8) * adsr(N(d), 0.005, 0.02, 0.95, 0.05)

def S_slide(a=1600, b=380, d=0.65):
    t = tt(d); f = expo(d, a, b) * (1 + 0.01 * np.sin(2 * np.pi * 6 * t))
    return (osc(f) + 0.2 * bandnoise(d, a * 0.5, a * 1.5) * 0.3) * adsr(len(t), 0.02, 0.05, 0.9, 0.08)

def S_organ(chord=(130.81, 164.81, 196.0, 261.63), d=2.4):
    t = tt(d); x = np.zeros(len(t))
    for f in chord:
        for h, w in ((1, 1), (2, 0.6), (3, 0.35), (4, 0.3), (6, 0.15), (8, 0.12)):
            x += w * osc(f * h, d)
    x *= 1 + 0.12 * np.sin(2 * np.pi * 6.2 * t)
    return x * adsr(len(t), 0.08, 0.2, 0.85, 0.5)

def S_crickets(d=2.4):
    o = np.zeros(N(d))
    for c, (f, per, off) in enumerate([(4400, 0.55, 0.0), (4900, 0.7, 0.25)]):
        tt0 = off
        while tt0 < d - 0.1:
            for k in range(3):
                place(o, osc(f, 0.018) * bell(N(0.018)) * (0.9 - c * 0.3), tt0 + k * 0.032)
            tt0 += per
    return o

def S_aah(): return S_choir((392.0, 493.88, 587.33), 1.4)

def S_creak():
    d = 0.95; t = tt(d)
    f = 320 + 140 * np.sin(2 * np.pi * 0.9 * t) + 40 * np.sin(2 * np.pi * 7 * t)
    pulse = (np.sin(2 * np.pi * np.cumsum(f) / SR) > 0.92).astype(float)
    x = svf(pulse, 1800, 5, 'bp') + 0.3 * osc(f, wave='saw')
    return svf(x, 2500) * adsr(len(t), 0.05, 0.1, 0.8, 0.2)

def S_scratch():
    d = 0.42; t = tt(d)
    f = 400 + 900 * np.abs(np.sin(2 * np.pi * 3.2 * t))
    x = svf(noise(d), f * 2, 2.5, 'bp') + 0.5 * osc(f, wave='saw')
    return svf(x, 4000) * adsr(len(t), 0.005, 0.05, 0.9, 0.05)

def S_ticktock(d=1.8):
    o = np.zeros(N(d)); i = 0; t0 = 0.0
    while t0 < d - 0.05:
        f = 2600 if i % 2 == 0 else 2000
        place(o, svf(noise(0.02), f, 8, 'bp') * env(N(0.02), 0.001, 0.006), t0); t0 += 0.5; i += 1
    return o

def S_zip(): return mix(S_whoosh(0.35, 800, 5000), S_slide(500, 1800, 0.35) * 0.5)

def S_skid():
    d = 0.45; t = tt(d); f = 1900 + 120 * np.sin(2 * np.pi * 30 * t)
    return (osc(f) * 0.7 + 0.4 * svf(noise(d), 3000, 3, 'bp')) * adsr(len(t), 0.01, 0.05, 0.8, 0.15)

def S_sniff():
    d = 0.2; return svf(noise(d), 3500, 1.5, 'bp') * adsr(N(d), 0.03, 0.05, 0.6, 0.06)

def S_hmph():
    d = 0.32; t = tt(d); f = expo(d, 200, 150)
    x = osc(f, wave='saw'); x = svf(x, 700, 3, 'bp') + 0.3 * svf(noise(d), 1200, 2, 'bp')
    return x * adsr(len(t), 0.02, 0.05, 0.8, 0.1)

def S_tiltup(): return S_whoosh(0.9, 250, 2500) * 0.8

def S_shades():
    gl = seq([(i * 0.04, (osc(f, 0.4) + 0.4 * osc(f * 2.5, 0.4)) * env(N(0.4), 0.001, 0.15)) for i, f in enumerate([1046, 1318, 1568, 2093, 2637])])
    bass = svf(osc(65.4, 0.6, 'saw'), 400) * adsr(N(0.6), 0.01, 0.1, 0.7, 0.2)
    return mix(gl, np.concatenate([np.zeros(N(0.2)), bass * 0.8]))

def S_curtain(): return S_whoosh(0.75, 200, 1500)

def S_seen(): return S_ding(2349, 0.35) * 0.7

def S_sadtrombone():
    def note(f, d, vib=0.0):
        t = tt(d); fv = f * (1 + vib * np.sin(2 * np.pi * 6 * t) * np.clip(t / 0.3, 0, 1))
        x = osc(fv, wave='saw') + 0.4 * osc(fv * 0.5, wave='saw')
        wah = svf(x, lin(d, 400, 1300) if d < 0.5 else 700 + 500 * np.abs(np.sin(2 * np.pi * 3 * t)), 2.0)
        return wah * adsr(len(t), 0.03, 0.05, 0.85, 0.1)
    return seq([(0, note(293.7, 0.36)), (0.4, note(277.2, 0.36)), (0.8, note(261.6, 0.36)), (1.2, note(246.9, 1.1, 0.03))])

def S_typing(d=1.6):
    o = np.zeros(N(d)); t0 = 0.0
    while t0 < d - 0.03:
        place(o, svf(noise(0.015), rng.uniform(2500, 4500), 4, 'bp') * env(N(0.015), 0.001, 0.004), t0)
        t0 += rng.uniform(0.045, 0.085)
    return o

def S_backspace(d=0.5):
    o = np.zeros(N(d)); t0 = 0.0
    while t0 < d - 0.02:
        place(o, svf(noise(0.012), 1800, 4, 'bp') * env(N(0.012), 0.001, 0.004), t0); t0 += 0.03
    return mix(o, S_whoosh(d, 3000, 800) * 0.3)

def S_key(): return svf(noise(0.03), 3000, 4, 'bp') * env(N(0.03), 0.001, 0.008)

def S_click(): return mix(S_key() * 1.2, S_pop() * 0.6)

def S_confetti():
    pop = svf(noise(0.15), 2500, 0.7, 'hp') * env(N(0.15), 0.001, 0.04)
    return mix(pop, np.concatenate([np.zeros(N(0.05)), S_sparkle() * 0.6]))

def S_flip():
    return mix(S_whoosh(0.2, 1500, 5000) * 0.7, S_key() * 1.2)

def S_rumble():
    d = 1.0; t = tt(d)
    return svf(noise(d), 120, 1.2) * 3 * adsr(len(t), 0.1, 0.1, 0.9, 0.3) + 0.4 * osc(48 + 6 * np.sin(2 * np.pi * 3 * t)) * adsr(len(t), 0.1, 0.1, 0.9, 0.3)

def S_sting():
    d = 1.0; t = tt(d)
    x = sum(osc(f, d, 'saw') for f in (65.4, 98.0, 130.8, 155.6))
    return svf(x, 1200, 0.9) * env(len(t), 0.005, 0.35) + svf(noise(d), 6000, 0.7, 'hp') * env(len(t), 0.001, 0.4) * 0.3

# toots: escalating, silly
def S_toot1(): return toot(0.38, 120, 95)
def S_toot2(): return seq([(0, toot(0.16, 170, 150, 28)), (0.2, toot(0.22, 150, 120, 26))])
def S_toot3(): return toot(0.6, 95, 160, 18, 0.22, 1600)
def S_toot4(): return toot(0.85, 140, 70, 14, 0.25, 1200, 0.6)
def S_toot5(): return seq([(0, toot(0.14, 180, 170, 30)), (0.18, toot(0.14, 200, 190, 30)), (0.36, toot(0.9, 150, 85, 16, 0.25, 1800))])

def S_flush():
    d = 1.6; t = tt(d)
    x = svf(noise(d), expo(d, 2500, 400), 1.2, 'bp') * (0.7 + 0.3 * np.sin(2 * np.pi * 7 * t))
    gl = seq([(rng.uniform(0.3, d - 0.2), osc(expo(0.05, rng.uniform(250, 500), rng.uniform(600, 1000))) * env(N(0.05), 0.002, 0.02)) for _ in range(10)])
    swirl = (x + 0.4 * fit(gl, len(t))) * adsr(len(t), 0.03, 0.2, 0.8, 0.5)
    lead = np.concatenate([S_toot1() * 0.7, np.zeros(max(0, len(t) - N(0.38)))])[:len(t)]
    return swirl + lead

SFX = {k[2:]: v for k, v in globals().items() if k.startswith('S_')}
DUR_SFX = {'typing': S_typing, 'backspace': S_backspace, 'crickets': S_crickets, 'ticktock': S_ticktock}
GAIN = {  # per-sound trim (dB) so nothing sticks out
    'pop': -2, 'toot1': 0, 'toot2': 0, 'toot3': 0, 'toot4': 0, 'toot5': 1, 'flush': 0, 'whoosh': -6, 'swoosh': -6, 'thud': -2,
    'typing': -8, 'backspace': -8, 'key': -6, 'crickets': -6, 'ticktock': -6, 'choir': -5, 'aah': -8, 'organ': -6, 'impact': -2,
    'sparkle': -8, 'msg': -5, 'send': -5, 'seen': -6, 'blip': -8, 'blip2': -8, 'tiltup': -8, 'curtain': -6, 'zoomout': -6,
    'sadtrombone': -2, 'dundun': -3, 'growl': 0, 'rumble': 0, 'gasp': -6, 'paper': -8, 'steps': -8, 'bell': -6, 'ding': -6,
}


# ---------------------------------------------------------------- music
BPM = 112; BEAT = 60 / BPM; S16 = BEAT / 4; BAR = BEAT * 4
CHORDS = [  # root bass, chord tones (C, Am, F, G)
    (65.41, [261.63, 329.63, 392.0, 523.25]),
    (55.00, [220.0, 261.63, 329.63, 440.0]),
    (87.31, [174.61, 220.0, 261.63, 349.23]),
    (98.00, [196.0, 246.94, 293.66, 392.0]),
]

def pluck(f, d=0.35, bright=1.0):
    t = tt(d); x = np.zeros(len(t))
    for k in range(1, 9):
        x += np.sin(2 * np.pi * f * k * t) * np.exp(-t * (6 + k * 5 / bright)) / k
    return x * np.clip(t / 0.002, 0, 1)

def bassnote(f, d=0.28):
    t = tt(d); return (osc(f, d, 'tri') * 0.7 + osc(f, d) * 0.5) * adsr(len(t), 0.004, 0.05, 0.7, 0.06)

def kick():
    d = 0.22; return osc(expo(d, 160, 48)) * env(N(d), 0.001, 0.09)

def clap():
    d = 0.16; return bandnoise(d, 900, 5000) * env(N(d), 0.001, 0.045) + 0.3 * osc(190, d) * env(N(d), 0.001, 0.03)

def hat():
    d = 0.05; return bandnoise(d, 7000, 15000) * env(N(d), 0.001, 0.012)

def glock(f):
    d = 0.6; t = tt(d); return (osc(f, d) + 0.3 * osc(f * 2.76, d) * np.exp(-t * 8)) * env(len(t), 0.001, 0.22)

ARP = [0, 2, 1, 2, 3, 2, 1, 2]
MELODY = [3, None, 2, 3, None, 1, 2, None]

def music_section(style, t0, t1, total):
    o = np.zeros(N(total) + N(3))
    if style in ('stop', 'tease', 'end'): return o
    if style == 'church':
        prog = [(130.81, 164.81, 196.0, 261.63), (174.61, 220.0, 261.63, 349.23), (196.0, 246.94, 293.66, 392.0), (130.81, 164.81, 196.0, 261.63)]
        k = 0; tt0 = t0
        while tt0 < t1:
            place(o, S_organ(prog[k % 4], BAR * 1.2) * 0.5, tt0); tt0 += BAR; k += 1
        return o
    if style == 'tension':
        place(o, svf(osc(55, t1 - t0 + 0.3, 'saw'), 400) * 0.6, t0)
        tt0 = t0
        while tt0 < t1:
            place(o, osc(expo(0.25, 120, 70)) * env(N(0.25), 0.001, 0.1), tt0); tt0 += BEAT / 2
        return o
    full = style in ('main', 'poll'); poll = style == 'poll'
    step = int(np.ceil(t0 / S16))
    while step * S16 < t1:
        st = step * S16; bar = int(st // BAR); pos = step % 16
        root, tones = CHORDS[bar % 4]
        if pos % 2 == 0:  # 8th notes
            i8 = pos // 2
            place(o, pluck(tones[ARP[i8]] * (2 if poll and i8 % 4 == 0 else 1), 0.3) * (0.32 if style == 'soft' else 0.42), st)
        if pos in (0, 6, 8, 14):
            place(o, bassnote(root * (2 if pos == 14 else 1)) * 0.55, st)
        if full:
            if pos in (0, 8) or (poll and pos in (4, 12)): place(o, kick() * 0.7, st)
            if pos in (4, 12): place(o, clap() * (0.32 if poll else 0.22), st)
            if pos % 4 == 2: place(o, hat() * 0.18, st)
        if poll and pos % 2 == 0:
            m = MELODY[pos // 2]
            if m is not None: place(o, glock(tones[m] * 2) * 0.22, st)
        step += 1
    return o

def build_music(sections, total):
    out = np.zeros(N(total) + N(3))
    for i, sec in enumerate(sections[:-1]):
        t0, t1 = sec['t'], sections[i + 1]['t']
        part = music_section(sec['style'], t0, t1, total)
        g = np.zeros(len(part)); a, b = int(t0 * SR), int(t1 * SR)
        g[a:b] = 1.0
        fi, fo = N(0.02), N(0.03 if sections[i + 1]['style'] in ('stop', 'tease') else 0.25)
        g[a:a + fi] *= np.linspace(0, 1, fi)
        if sections[i + 1]['style'] in ('stop', 'tease', 'end'):
            g[max(a, b - fo):b] *= np.linspace(1, 0, b - max(a, b - fo))
        else:  # let the tail ring briefly into the next section
            tail = N(0.25); g[b:b + tail] = np.linspace(1, 0, tail)
        out += part * g
    return out[:N(total)]


# ---------------------------------------------------------------- mixing
def read_wav(p):
    with wave.open(p) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
        if w.getnchannels() == 2: x = x.reshape(-1, 2).mean(1)
        return x

def write_wav(p, x):
    y = np.clip(x, -1, 1); st = np.stack([y, y], 1)
    with wave.open(p, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())

def envelope(x, att=0.01, rel=0.3):
    # fast block-based envelope follower
    blk = 441; n = len(x) // blk
    r = np.sqrt((x[:n * blk].reshape(n, blk) ** 2).mean(1))
    e = np.zeros(n); a, b = np.exp(-blk / SR / att), np.exp(-blk / SR / rel); v = 0
    for i in range(n):
        v = a * v + (1 - a) * r[i] if r[i] > v else b * v + (1 - b) * r[i]; e[i] = v
    return np.repeat(e, blk)[:len(x)].tolist() + [e[-1]] * (len(x) - n * blk)

def main():
    cues = json.load(open(sys.argv[1])); vo = read_wav(sys.argv[2]); out = sys.argv[3]
    total = cues['dur']; n = N(total)
    vo = np.concatenate([vo, np.zeros(max(0, n - len(vo)))])[:n]
    speech_rms = np.sqrt(np.mean(vo[np.abs(vo) > 0.02] ** 2))
    # SFX bus
    sfx = np.zeros(n + N(3)); missing = set()
    for c in cues['cues']:
        name = c['name']
        if name in DUR_SFX and 'dur' in c: x = DUR_SFX[name](max(0.2, c['dur']))
        elif name in SFX: x = SFX[name]()
        else: missing.add(name); continue
        x = np.asarray(x, float); x = x - x.mean()
        rms = np.sqrt(np.mean(x ** 2)) + 1e-9; pk = np.abs(x).max() + 1e-9
        g = min(speech_rms * 0.6 / rms, 0.8 / pk) * c.get('vol', 1) * 10 ** (GAIN.get(name, 0) / 20)
        place(sfx, x * g, c['t'])
    if missing: print('MISSING SFX:', missing)
    sfx = sfx[:n]
    # music bus, ducked under the voice
    mus = build_music(cues['music'], total)
    mrms = np.sqrt(np.mean(mus[np.abs(mus) > 1e-4] ** 2)) + 1e-9
    mus *= speech_rms * 10 ** (-17 / 20) / mrms
    ve = np.array(envelope(vo, 0.02, 0.35))
    duck = 1 - 0.55 * np.clip(ve / (speech_rms * 0.6), 0, 1)
    mus *= duck
    mixd = vo + sfx + mus
    # gentle soft-clip limiter
    pk = np.abs(mixd).max(); mixd = mixd / pk * 0.95 if pk > 0.95 else mixd
    mixd = np.tanh(mixd * 1.2) / np.tanh(1.2)
    write_wav(out, mixd)
    for nm, x in (('vo', vo), ('sfx', sfx), ('music', mus), ('mix', mixd)):
        r = np.sqrt(np.mean(x ** 2)); print(f'{nm:6s} rms {20*np.log10(r+1e-12):6.1f} dBFS  peak {20*np.log10(np.abs(x).max()+1e-12):6.1f} dBFS')
    write_wav(out.replace('.wav', '_sfx.wav'), sfx); write_wav(out.replace('.wav', '_music.wav'), mus)

if __name__ == '__main__':
    main()
