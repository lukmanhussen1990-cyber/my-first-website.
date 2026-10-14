"""Original score and sound design for "Bulbul & Shabnaj", synthesised from scratch (no samples, no loops).
D major, 72 bpm (1 beat = 25 frames, 1 bar = 100 frames), 13 bars = 43.33 s, locked to the picture:
  bars 1-2  night sky, shooting star, the gold arch draws   - string pad, fairy dust, a far-off bulbul, a harp sweep
  bars 3-5  the garden, the rose blooms, the bulbul sings     - santoor-like hammered strings, bass, the bird's song
  bars 6-8  its song writes the names, lanterns rise          - the melody on a soft felt piano
  bars 9-12 the second bird, the heart, the monogram          - the theme on a string section, frame drum and manjira
  bar 13    they fly away together, fade to night             - the tonic chord rings out
Harmony (two chords a bar): a descending-bass progression D A/C# Bm F#m/A G D/F# Em7 A.
usage: music.py OUT.wav"""
import sys, os, json, subprocess
import numpy as np, soundfile as sf
from scipy.signal import lfilter, butter, sosfilt, fftconvolve
SR = 44100
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUR = 1300 / 30.0
N = int(DUR * SR) + SR * 4                      # room for tails, trimmed at the end
rng = np.random.default_rng(31)
BEAT = 25 / 30.0
T = lambda f: (f - 1) / 30.0                    # frame -> seconds
TB = lambda bar, beat=0.0: ((bar - 1) * 4 + beat) * BEAT   # bar (1-based) + beat -> seconds
NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}
def hz(name):
    n, o = (name[:-1], int(name[-1])); return 440.0 * 2 ** ((NOTE[n] + 12 * (o + 1) - 69) / 12)
def db(x): return 10 ** (x / 20)
def lp(x, fc, order=2): return sosfilt(butter(order, min(fc, SR * 0.45), btype='low', fs=SR, output='sos'), x)
def hp(x, fc, order=2): return sosfilt(butter(order, fc, btype='high', fs=SR, output='sos'), x)
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, min(hi, SR * 0.45)], btype='band', fs=SR, output='sos'), x)
buses = {k: np.zeros((N, 2)) for k in ('music', 'birds', 'sfx', 'perc')}
def put(bus, sig, t, gain=0.0, pan=0.0):
    i = int(round(t * SR)); sig = np.asarray(sig, float)
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], 1) * 1.414
    j0, j1 = max(0, i), min(N, i + len(sig))
    if j1 > j0: buses[bus][j0:j1] += sig[j0 - i:j1 - i] * db(gain)
# ------------------------------------------------------------------------------------------------ instruments
def ks_string(f0, dur, bright=0.6, decay=0.9965, seed=0):
    """Karplus-Strong string, hammered: a short bright noise burst through the loop filter."""
    n = int(dur * SR); r = np.random.default_rng(seed)
    L = max(2, int(round(SR / f0 - 0.5)))
    exc = np.zeros(n); burst = r.uniform(-1, 1, L)
    burst = lp(burst, 1500 + 7000 * bright, 1); exc[:L] = burst * np.hanning(L) ** 0.5
    a = np.zeros(L + 2); a[0] = 1; a[L] = -decay * 0.5; a[L + 1] = -decay * 0.5
    y = lfilter([1.0], a, exc)
    y *= np.minimum(1, np.arange(n) / (0.002 * SR))
    return y / (np.abs(y).max() + 1e-9)
def santoor(f0, dur=2.6, vel=1.0, seed=0):
    """A hammered-dulcimer flavour: two slightly detuned strings per note, a little body resonance."""
    a = ks_string(f0 * 2 ** (2.5 / 1200), dur, 0.55 + 0.3 * vel, 0.9968, seed)
    b = ks_string(f0 * 2 ** (-2.5 / 1200), dur, 0.5 + 0.3 * vel, 0.9966, seed + 99)
    y = 0.5 * (a + b); y = y + 0.25 * bp(y, 180, 900); return lp(y, 6500) * vel
def harp(f0, dur=3.6, vel=1.0, pos=0.18, roll=2.0, seed=0):
    """A concert harp string: the harmonics of a string plucked at `pos` of its length (falling as 1/k^roll),
    higher harmonics dying sooner, lower strings ringing longer, a soft finger noise and a little soundboard."""
    r = np.random.default_rng(seed); n = int(dur * SR); t = np.arange(n) / SR; y = np.zeros(n)
    tau0 = 2.4 * (261.6 / f0) ** 0.5; npart = int(min(18, 9000 / f0))
    for k in range(1, npart + 1):
        a = abs(np.sin(np.pi * k * pos)) / k ** roll * (1 + 0.12 * r.uniform(-1, 1))
        y += a * np.exp(-t / (tau0 / (1 + 0.8 * (k - 1)))) * np.sin(2 * np.pi * k * f0 * (1 + 0.00006 * k * k) * t)
    y += 0.03 * lp(r.standard_normal(n), 900) * np.exp(-t / 0.004)
    y *= np.minimum(1, t / 0.003); y = y + 0.25 * bp(y, 140, 700)
    return y / (np.abs(y).max() + 1e-9) * vel
def piano(f0, dur=3.0, vel=0.8, seed=0):
    """A soft felt piano: inharmonic partials on two slightly detuned strings, a prompt and an after-sound decay,
    a little hammer noise, brightness rising with velocity."""
    r = np.random.default_rng(seed); n = int((dur + 1.2) * SR); t = np.arange(n) / SR; y = np.zeros(n)
    B = 0.00035 * (f0 / 261.6) ** 0.6; tau0 = 3.2 * (261.6 / f0) ** 0.45
    npart = int(min(22, 7600 / f0))
    for det in (-0.9, 0.9):
        fs = f0 * 2 ** (det / 1200)
        for k in range(1, npart + 1):
            fk = k * fs * np.sqrt(1 + B * k * k)
            a = (1.0 / k ** 1.15) * np.exp(-(k - 1) * (0.32 - 0.16 * vel)) * (1 + 0.25 * r.uniform(-1, 1))
            tau = tau0 / (1 + 0.55 * (k - 1))
            env = 0.62 * np.exp(-t / (0.22 * tau)) + 0.38 * np.exp(-t / tau)
            y += a * env * np.sin(2 * np.pi * fk * t + r.uniform(0, 6.28))
    y += 0.08 * lp(r.standard_normal(n), 1800) * np.exp(-t / 0.006)          # the felt hammer
    y *= np.minimum(1, t / 0.003)
    y *= np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.18))                    # the damper
    y = lp(y, 2200 + 4200 * vel); return y / (np.abs(y).max() + 1e-9) * vel
def body_ir(seed, nmodes=46, lo=190, hi=6500):
    """The wooden body of a bowed instrument: many resonant modes at scattered frequencies (dense, jagged, with the
    'bridge hill' near 2.9 kHz and the main air/wood resonance near 470 Hz), so every note and every swing of the
    vibrato lands on different peaks, the way a real violin colours its sound."""
    r = np.random.default_rng(seed); m = int(0.06 * SR); tt = np.arange(m) / SR; h = np.zeros(m)
    for k in range(nmodes):
        f = lo * (hi / lo) ** (r.uniform() ** 0.85); q = r.uniform(8, 22)
        env = (1.0 + 2.2 * np.exp(-0.5 * ((np.log2(f) - np.log2(2900)) / 0.45) ** 2) + 1.2 * np.exp(-0.5 * ((np.log2(f) - np.log2(470)) / 0.35) ** 2)) * (f / 1000) ** -0.35
        h += env * r.uniform(0.4, 1.0) * np.exp(-tt * np.pi * f / q) * np.sin(2 * np.pi * f * tt + r.uniform(0, 6.28))
    h[0] += 0.6 * np.abs(h).max(); return h / np.sqrt((h ** 2).sum())
BODY = (body_ir(21), body_ir(22))
def wood(out):
    """Play a stereo string signal through the two bodies, keeping its loudness."""
    n = len(out); y = np.stack([fftconvolve(out[:, c], BODY[c])[:n] for c in range(2)], 1)
    return y * np.sqrt((out ** 2).mean() / ((y ** 2).mean() + 1e-20))
def section(f0, dur, vel=1.0, att=0.14, rel=0.45, bright=2600):
    """A string section on one note: six bowed voices, delayed vibrato, a body resonance, a soft bow attack."""
    n = int((dur + rel + 0.2) * SR); t = np.arange(n) / SR; out = np.zeros((n, 2))
    for i, (cents, pan) in enumerate(((-14, -0.7), (-8, -0.4), (-3, -0.1), (3, 0.1), (8, 0.4), (14, 0.7))):
        vib = 1 + 0.0055 * np.clip((t - 0.18) / 0.35, 0, 1) * np.sin(2 * np.pi * (5.0 + 0.3 * i) * t + i)
        ph = (np.cumsum(f0 * 2 ** (cents / 1200) * vib) / SR + rng.uniform()) % 1.0
        v = 2 * ph - 1
        out[:, 0] += v * np.cos((pan + 1) * np.pi / 4); out[:, 1] += v * np.sin((pan + 1) * np.pi / 4)
    for c in range(2):
        x = lp(out[:, c], bright, 2); out[:, c] = x + 0.6 * bp(x, 700, 1400) + 0.3 * bp(x, 2500, 3500)
    env = np.minimum(1, (t / att) ** 1.5) * np.where(t < dur, 1.0, np.exp(-(t - dur) / (rel / 3)))
    out *= env[:, None]; peak = np.abs(out).max() + 1e-9; return wood(out) / peak * vel
def strings(freqs, dur, att=1.0, rel=1.6, bright=1800):
    n = int((dur + rel) * SR); t = np.arange(n) / SR; out = np.zeros((n, 2))
    for f0 in freqs:
        for d, pan in ((-0.09, -0.6), (-0.03, -0.2), (0.03, 0.2), (0.09, 0.6)):
            fr = f0 * 2 ** (d / 12); ph = (np.cumsum(fr * (1 + 0.004 * np.sin(2 * np.pi * (4.6 + rng.uniform(0, 0.8)) * t + rng.uniform(0, 6)))) / SR + rng.uniform()) % 1.0
            saw = 2 * ph - 1; v = lp(saw, bright * 0.8, 2); v = v + 0.5 * bp(v, 500, 1200)
            out[:, 0] += v * np.cos((pan + 1) * np.pi / 4); out[:, 1] += v * np.sin((pan + 1) * np.pi / 4)
    env = np.minimum(1, t / att) * np.where(t < dur, 1.0, np.exp(-(t - dur) / (rel / 3)))
    out *= env[:, None]; return out / (np.abs(out).max() + 1e-9)
def bassnote(f0, dur):
    n = int((dur + 0.8) * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f0 * t) + 0.35 * np.sin(4 * np.pi * f0 * t) + 0.12 * lp((2 * ((f0 * t) % 1) - 1), 700)
    env = np.minimum(1, t / 0.25) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.25)); return y * env / 1.5
def dum(vel=1.0):
    n = int(0.6 * SR); t = np.arange(n) / SR
    f = 62 + 50 * np.exp(-t / 0.03); y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.28)
    y += 0.25 * bp(rng.standard_normal(n), 150, 900) * np.exp(-t / 0.03); return y / np.abs(y).max() * vel
def tak(vel=1.0):
    n = int(0.25 * SR); t = np.arange(n) / SR
    y = bp(rng.standard_normal(n), 900, 5200) * np.exp(-t / 0.035) + 0.5 * np.sin(2 * np.pi * 420 * t) * np.exp(-t / 0.04)
    return y / np.abs(y).max() * vel
def manjira(vel=1.0):
    n = int(2.2 * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for f0, a, tau in ((2350, 1.0, 1.4), (3710, 0.7, 1.0), (5180, 0.45, 0.7), (6470, 0.3, 0.5), (8120, 0.18, 0.35)):
        y += a * np.sin(2 * np.pi * f0 * t * (1 + 0.0012 * np.sin(2 * np.pi * 6 * t))) * np.exp(-t / tau)
    y += 0.6 * hp(rng.standard_normal(n), 5000) * np.exp(-t / 0.006)
    return y / np.abs(y).max() * vel
def flutter(dur, rate=4.6, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    beats = np.maximum(0, np.sin(2 * np.pi * rate * t)) ** 4
    y = bp(rng.standard_normal(n), 250, 2600) * beats; return y / (np.abs(y).max() + 1e-9) * vel
def shimmer(dur, f0=3000, f1=9000, vel=1.0, att=0.4):
    """A moving band of airy noise (the sound of light): the band glides from f0 to f1."""
    from scipy.signal import stft, istft
    n = int(dur * SR); x = rng.standard_normal(n + 4096)
    fr, tt, Z = stft(x, SR, nperseg=2048, noverlap=1536)
    u = np.clip(tt / dur, 0, 1); fc = f0 * (f1 / f0) ** u
    band = np.exp(-0.5 * ((np.log2(np.maximum(fr, 20))[:, None] - np.log2(fc)[None, :]) / 0.35) ** 2)
    _, y = istft(Z * band, SR, nperseg=2048, noverlap=1536); y = y[:n]
    t = np.arange(n) / SR; env = np.minimum(1, t / max(1e-3, att * dur)) * np.clip((dur - t) / (0.5 * dur), 0, 1)
    y = y * env; return y / (np.abs(y).max() + 1e-9) * vel
def sparkles(dur, count, lo=1800, hi=4200, vel=1.0, seed=0):
    """Fairy dust: many tiny, very high glints (no clear pitch, so no 'ding'), shaped by a soft swell."""
    r = np.random.default_rng(seed); n = int((dur + 0.6) * SR); y = np.zeros(n)
    for k in range(count * 9):
        f0 = r.uniform(5200, 11000); d = r.uniform(0.008, 0.03); m = int(d * SR); t = np.arange(m) / SR
        g = np.sin(2 * np.pi * f0 * t) * np.sin(np.pi * t / d) ** 2 * r.uniform(0.2, 1.0)
        i = int(r.uniform(0, dur) * SR); y[i:i + m] += g[:max(0, n - i)]
    t = np.arange(n) / SR; y *= np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7
    return y / (np.abs(y).max() + 1e-9) * vel
def ping(f0, vel=0.45, seed=0):
    """A soft high piano tone for small events (instead of a bell)."""
    return piano(f0, 1.4, vel, seed)
# ------------------------------------------------------------------------------------------------ the bulbul's song
def chirp(f0, f1, dur, shape='glide', am=0.0):
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
    if shape == 'glide': fr = f0 * (f1 / f0) ** u
    elif shape == 'arch': fr = f0 + (f1 - f0) * np.sin(np.pi * u)
    else: fr = f0 + (f1 - f0) * u
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR) + 0.18 * np.sin(4 * np.pi * np.cumsum(fr) / SR)
    if am: y *= 0.6 + 0.4 * np.sin(2 * np.pi * am * t)
    env = np.sin(np.pi * np.clip(u, 0, 1)) ** 0.6; return y * env
def bird_phrase(seed, base=1.0, dur=0.62):
    """A bulbul-like phrase: liquid, bubbly notes with fast glides, sometimes a trill."""
    r = np.random.default_rng(seed); out = np.zeros(int((dur + 0.3) * SR)); t = 0.0
    while t < dur:
        kind = r.choice(['up', 'down', 'arch', 'trill', 'bubble'], p=[0.25, 0.25, 0.2, 0.12, 0.18])
        if kind == 'trill':   # a living trill: every note a little different, the run slowing and falling slightly
            d = r.uniform(0.12, 0.2); f0 = base * r.uniform(2600, 3400); seg = np.zeros(int(d * SR) + 2400)
            q = np.random.default_rng(seed * 997 + int(t * 1e4)); j = 0.0
            while j < d:
                fk = f0 * (1 - 0.05 * j / d) * (1 + 0.035 * q.normal()); dk = q.uniform(0.016, 0.026)
                c = chirp(fk, fk * q.uniform(1.08, 1.2), dk, 'arch') * q.uniform(0.55, 1.0); i0 = int(j * SR); seg[i0:i0 + len(c)] += c
                j += dk + q.uniform(0.01, 0.02) * (1 + 0.6 * j / d)
        elif kind == 'bubble':
            d = r.uniform(0.07, 0.11); f0 = base * r.uniform(1500, 2200); seg = chirp(f0, f0 * 1.6, d, 'glide', am=r.uniform(35, 60))
        else:
            d = r.uniform(0.06, 0.13); f0 = base * r.uniform(1700, 3000); f1 = f0 * (r.uniform(1.3, 1.8) if kind == 'up' else r.uniform(0.55, 0.8) if kind == 'down' else r.uniform(1.2, 1.5))
            seg = chirp(f0, f1, d, 'arch' if kind == 'arch' else 'glide')
        i = int(t * SR); seg = np.asarray(seg)
        if i + len(seg) > len(out): break
        out[i:i + len(seg)] += seg * r.uniform(0.6, 1.0); t += d + r.uniform(0.015, 0.05)
    return hp(out, 900) / (np.abs(out).max() + 1e-9)
# ------------------------------------------------------------------------------------------------ the score
CH = {  # chord name -> (bass, voicing)
    'D': ('D2', ['D3', 'A3', 'D4', 'F#4']), 'A/C#': ('C#2', ['C#3', 'A3', 'C#4', 'E4']), 'Bm': ('B1', ['B2', 'F#3', 'B3', 'D4']),
    'F#m/A': ('A1', ['A2', 'F#3', 'A3', 'C#4']), 'G': ('G1', ['G2', 'D3', 'G3', 'B3']), 'D/F#': ('F#1', ['F#2', 'D3', 'A3', 'D4']),
    'Em7': ('E1', ['E2', 'B2', 'D3', 'G3']), 'A': ('A1', ['A2', 'E3', 'A3', 'C#4']), 'A7sus': ('A1', ['A2', 'E3', 'G3', 'D4']),
    'D/A': ('A1', ['A2', 'D3', 'F#3', 'A3'])}
BARS = {1: ['D', 'D'], 2: ['D', 'A/C#'], 3: ['Bm', 'F#m/A'], 4: ['G', 'D/F#'], 5: ['Em7', 'A7sus'], 6: ['D', 'A/C#'], 7: ['Bm', 'F#m/A'],
        8: ['G', 'D/F#'], 9: ['Em7', 'A'], 10: ['Bm', 'G'], 11: ['D/A', 'A'], 12: ['G', 'A'], 13: ['D', 'D']}
# pad: from the first frame, swelling; fuller from bar 6, fullest 9-12, ringing out in 13
for bar, chords in BARS.items():
    for half, name in enumerate(chords):
        bass, voic = CH[name]; t0 = TB(bar, 2 * half)
        g = -23.5 if bar == 1 else -23 if bar < 3 else -25.5 if bar < 6 else -24 if bar < 9 else -19.5
        if bar == 13: g = -22
        dur = 2 * BEAT if bar < 13 else 6.0
        put('music', strings([hz(v) for v in voic], dur + 0.05, att=1.4 if bar == 1 else 0.5, rel=2.2 if bar == 13 else 1.2, bright=1500 if bar < 6 else 2200), t0 - 0.05, g)
        if bar >= 3:   # bass
            put('music', bassnote(hz(bass), 2 * BEAT if bar < 13 else 5.0), t0, -22 if bar < 6 else -20 if bar < 9 else -17.5 if bar < 13 else -19)
        if 3 <= bar <= 12:   # santoor arpeggio: 8th notes up the chord
            arp = [voic[0], voic[1], voic[2], voic[3]] if bar < 9 else [voic[1], voic[2], voic[3], CH[name][1][2][:-1] + str(int(CH[name][1][2][-1]) + 1)]
            for k, nt in enumerate(arp):
                hv = np.random.default_rng(bar * 100 + half * 10 + k); put('music', santoor(hz(nt), 2.4, (0.75 + 0.25 * (k == 0)) * hv.uniform(0.85, 1.05), seed=bar * 10 + half * 4 + k), t0 + k * BEAT / 2 + hv.normal(0, 0.007), -22.5 if bar < 6 else -21.5 if bar < 9 else -17, pan=-0.35 + 0.23 * k)
# melody: (bar, beat, note, beats)
MEL = [(6, 0, 'A4', .5), (6, .5, 'D5', .5), (6, 1, 'F#5', 1.5), (6, 2.5, 'G5', .5), (6, 3, 'E5', .5), (6, 3.5, 'A4', .5),
       (7, 0, 'D5', .5), (7, .5, 'F#5', .5), (7, 1, 'B5', 1.5), (7, 2.5, 'A5', .5), (7, 3, 'F#5', .5), (7, 3.5, 'C#5', .5),
       (8, 0, 'B4', .5), (8, .5, 'D5', .5), (8, 1, 'G5', 1.5), (8, 2.5, 'F#5', .5), (8, 3, 'E5', .5), (8, 3.5, 'D5', .5),
       (9, 0, 'E5', .5), (9, .5, 'G5', .5), (9, 1, 'B5', 1), (9, 2, 'A5', .5), (9, 2.5, 'G5', .5), (9, 3, 'F#5', .5), (9, 3.5, 'C#5', .5),
       (10, 0, 'D5', 1.5), (10, 1.5, 'F#5', .5), (10, 2, 'B5', 1), (10, 3, 'A5', .5), (10, 3.5, 'G5', .5),
       (11, 0, 'F#5', 1.5), (11, 1.5, 'E5', .5), (11, 2, 'D5', 1), (11, 3, 'E5', 1),
       (12, 0, 'D5', .5), (12, .5, 'E5', .5), (12, 1, 'F#5', 1), (12, 2, 'G5', 1), (12, 3, 'E5', .5), (12, 3.5, 'C#5', .5),
       (13, 0, 'D5', 4)]
for i, (bar, beat, nt, beats) in enumerate(MEL):
    t0 = TB(bar, beat)
    if bar <= 8: put('music', piano(hz(nt) / 2, max(1.2, beats * BEAT * 1.6), 0.66 + 0.12 * (beats >= 1), seed=900 + i), t0 + np.random.default_rng(i).normal(0, 0.006), -14.0, pan=0.08)   # the names: felt piano, middle register
    else:
        put('music', section(hz(nt), beats * BEAT * 0.98, 1.0), t0, -12.5)                    # the finale: the strings sing it
        put('music', piano(hz(nt) / 2, max(1.2, beats * BEAT * 1.4), 0.5, seed=950 + i), t0, -23, pan=-0.1)
# percussion: frame drum and manjira from bar 8, gentle; a last soft roll into bar 13
for bar in range(8, 13):
    for beat, kind, v in ((0, 'dum', 1.0), (1.5, 'tak', 0.55), (2, 'dum', 0.6), (3, 'tak', 0.7), (3.5, 'tak', 0.4)):
        put('perc', dum(v) if kind == 'dum' else tak(v), TB(bar, beat), -21 if kind == 'dum' else -27, pan=0.05 if kind == 'dum' else -0.15)
    if bar >= 9:
        for beat in (1, 3): put('perc', manjira(0.8), TB(bar, beat), -32, pan=0.3)
for k in range(8): put('perc', tak(0.3 + 0.08 * k), TB(12, 3) + k * BEAT / 8, -30, pan=-0.1)
put('perc', dum(1.0), TB(13, 0), -20)
# ------------------------------------------------------------------------------------------------ sound design (frames)
put('sfx', sparkles(2.5, 7, vel=1.0, seed=1), T(8), -36, pan=0.4)                           # the night opens: chimes
put('sfx', shimmer(0.8, 6000, 2500, 1.0, 0.2), T(44), -33, pan=-0.3)                          # shooting star
for k, nt in enumerate(['F#6', 'E6', 'D6', 'B5', 'A5', 'F#5']): put('sfx', ping(hz(nt), 0.4, 60 + k), T(46) + k * 0.07, -31, pan=-0.4 + 0.15 * k)
put('sfx', shimmer(3.2, 1800, 7000, 1.0, 0.6), T(100), -33)                                   # the arch inks on
GL = ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5', 'E5', 'F#5', 'G5', 'A5', 'B5', 'C#6', 'D6']
for k, nt in enumerate(GL):
    u = k / (len(GL) - 1); put('music', harp(hz(nt), seed=k) * (0.55 + 0.45 * np.sin(np.pi * u)), T(150) + 1.25 * u ** 1.35 + np.random.default_rng(k).normal(0, 0.005), -28.5, pan=-0.6 + 1.2 * u)
put('sfx', sparkles(1.4, 6, vel=1.0, seed=11), T(188), -40)
put('sfx', shimmer(3.0, 900, 3200, 1.0, 0.5), T(205), -36)                                    # into the garden
put('sfx', ping(hz('A5'), 0.45, 70), T(286), -29)                                             # the bud
for k, nt in enumerate(['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5', 'D6']): put('music', santoor(hz(nt), 2.4, 0.7, seed=700 + k), T(302) + k * 0.11, -21, pan=-0.3 + 0.1 * k)   # the bloom
put('sfx', flutter(1.5, 4.6, 1.0), T(328), -30, pan=0.7)                                      # wings
put('sfx', flutter(0.4, 6.0, 0.6), T(366), -33, pan=0.2)
put('birds', bird_phrase(2, 1.0, 0.25), T(374), -26, pan=0.15)                                # landing chirp
put('sfx', sparkles(0.9, 4, vel=1.0, seed=12), T(378), -40, pan=-0.1)                          # dew glints
for k, p0 in enumerate((402, 427, 452, 477)): put('birds', bird_phrase(10 + k, 1.0, 0.6), T(p0), -20, pan=0.15)   # the bulbul sings
put('birds', bird_phrase(3, 0.9, 0.5), T(30), -31, pan=-0.6)                                  # far away, in the opening
put('sfx', shimmer(1.6, 2000, 9000, 1.0, 0.7), T(500), -30, pan=0.1)                          # its song rises
put('sfx', sparkles(1.4, 8, vel=1.0, seed=4), T(505), -38)
put('sfx', shimmer(1.5, 3500, 6000, 1.0, 0.3), T(548), -38, pan=-0.2)                         # the pen writes Bulbul
put('sfx', sparkles(1.4, 6, vel=1.0, seed=5), T(548), -41, pan=-0.2)
put('sfx', ping(hz('A5'), 0.5, 71), T(596), -28); put('sfx', ping(hz('D6'), 0.4, 72), T(596.5), -31)   # &
put('sfx', shimmer(1.9, 3500, 6500, 1.0, 0.3), T(604), -38, pan=0.2)                          # ... Shabnaj
put('sfx', sparkles(1.8, 7, vel=1.0, seed=6), T(604), -41, pan=0.2)
put('sfx', sparkles(0.8, 4, vel=1.0, seed=13), T(662), -40)                                    # divider
put('sfx', shimmer(2.0, 2500, 10000, 1.0, 0.5), T(700), -33)                                  # the arch catches the light
put('sfx', flutter(1.5, 4.8, 1.0), T(800), -31, pan=0.8)                                      # the second bulbul arrives
put('birds', bird_phrase(21, 1.1, 0.25), T(848), -26, pan=0.3)
put('sfx', flutter(0.25, 7.0, 0.5), T(850), -36, pan=-0.1)                                    # the turn
for k, (p0, base, pan) in enumerate(((862, 0.95, -0.05), (874, 1.12, 0.3), (887, 0.95, -0.05), (899, 1.12, 0.3))):
    put('birds', bird_phrase(30 + k, base, 0.55), T(p0), -21, pan=pan)                        # the duet
for k, nt in enumerate(['D5', 'F#5', 'A5', 'D6', 'E6', 'F#6']): put('sfx', ping(hz(nt), 0.42, 80 + k), T(878) + k * 0.08, -29, pan=0.2)   # the heart
put('sfx', sparkles(1.6, 7, vel=1.0, seed=14), T(880), -39, pan=0.2)
put('sfx', sparkles(2.2, 9, vel=1.0, seed=8), T(965), -39, pan=0.2)                         # it scatters
put('sfx', shimmer(2.0, 1500, 6000, 1.0, 0.5), T(1000), -36)                                  # the monogram
put('sfx', sparkles(1.2, 6, vel=1.0, seed=15), T(1018), -40)
for k, nt in enumerate(['D5', 'A5', 'D6']): put('sfx', ping(hz(nt), 0.45, 90 + k), T(1030) + k * 0.12, -29)
put('sfx', shimmer(2.0, 2500, 10000, 1.0, 0.5), T(1052), -35)                                 # the arch glints again
put('birds', bird_phrase(41, 1.05, 0.5), T(1194), -26, pan=0.3)                               # a last call
put('sfx', flutter(1.8, 4.6, 1.0), T(1204), -30, pan=0.5)                                     # they fly away together
put('sfx', flutter(1.6, 5.0, 0.8), T(1210), -33, pan=0.7)
put('birds', bird_phrase(42, 1.1, 0.4), T(1236), -32, pan=0.85)
# ------------------------------------------------------------------------------------------------ space, mix, master
def hall(rt=2.6, seed=5):
    r = np.random.default_rng(seed); n = int(rt * SR * 1.2); t = np.arange(n) / SR
    env = np.exp(-6.91 * t / rt); env[:int(0.02 * SR)] = 0
    ir = np.stack([lp(r.standard_normal(n), 7000) * env, lp(r.standard_normal(n), 7000) * env], 1)
    for k, (d, g) in enumerate(((0.011, 0.5), (0.017, 0.4), (0.023, 0.35), (0.031, 0.3))):
        ir[int(d * SR), k % 2] += g
    return ir / np.sqrt((ir ** 2).sum(0, keepdims=True))
IR = hall()
def wet(x, amt):
    y = np.stack([fftconvolve(x[:, c], IR[:, c])[:len(x)] for c in range(2)], 1); return x * (1 - amt * 0.4) + y * amt
mix = wet(buses['music'], 0.38) + wet(buses['birds'], 0.32) * 0.9 + wet(buses['sfx'], 0.45) + wet(buses['perc'], 0.22)
n_out = int(round(DUR * SR)); mix = mix[:n_out]
fo = int(1.2 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5                     # into the night
fi = int(0.004 * SR); mix[:fi] *= np.linspace(0, 1, fi)[:, None]
tmp = f'{D}/audio/mix_raw.wav'; os.makedirs(f'{D}/audio', exist_ok=True)
sf.write(tmp, (mix / (np.abs(mix).max() + 1e-9) * 0.7).astype(np.float32), SR, subtype='FLOAT')
out = sys.argv[1]
chain = 'highpass=f=30,equalizer=f=250:t=q:w=1.0:g=-1.5,equalizer=f=3000:t=q:w=1.2:g=1.0,acompressor=threshold=-18dB:ratio=2:attack=20:release=250:knee=6'
m = subprocess.run(['ffmpeg', '-hide_banner', '-y', '-i', tmp, '-af', chain + ',loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
js = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
ln = f"loudnorm=I=-14:TP=-1.0:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true"
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-af', chain + ',' + ln, '-ar', str(SR), '-c:a', 'pcm_s16le', out], check=True)
print('wrote', out, 'pre-master', js['input_i'], 'LUFS')
