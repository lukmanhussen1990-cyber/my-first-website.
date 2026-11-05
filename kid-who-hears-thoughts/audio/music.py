"""Procedural music: soft piano-like notes (sine partials + decay) over a gentle pad.
I-V-vi-IV in C major at 70 BPM. Quieter in the overwhelming/sad and dark parts, building for the ending.
Usage: python3 audio/music.py  -> audio/music.wav
"""
import json
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
tl = json.load(open(os.path.join(HERE, '..', 'story', 'timeline.json')))
DUR = tl['duration']
N = int(DUR * SR) + SR
out = np.zeros(N)

BPM = 70
BEAT = 60 / BPM
BAR = 4 * BEAT
CHORDS = [  # I  V  vi  IV  (C major)
    [48, 55, 60, 64, 67],  # C
    [43, 50, 55, 59, 62],  # G
    [45, 52, 57, 60, 64],  # Am
    [41, 48, 53, 57, 60],  # F
]
MELODY = [  # one gentle phrase per chord (beat offset, midi)
    [(0, 76), (1, 74), (2, 72), (3, 74)],
    [(0, 74), (1.5, 71), (2, 67), (3, 71)],
    [(0, 72), (1, 76), (2, 74), (2.5, 72), (3, 69)],
    [(0, 69), (1, 72), (2, 77), (3, 76)],
]
rng = np.random.default_rng(7)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def piano(f, dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for k in range(1, 7):
        B = 0.0004
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > SR / 2.2:
            break
        s += (1 / k ** 1.4) * np.sin(2 * np.pi * fk * t) * np.exp(-t * (1.1 + 0.9 * k))
    att = np.minimum(1, t / 0.004)
    s *= att * vel
    click = rng.normal(0, 1, min(n, 220)) * np.exp(-np.arange(min(n, 220)) / 40) * 0.02 * vel
    s[: len(click)] += click
    return s


def pad(freqs, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        for det in (0.997, 1.003):
            s += np.sin(2 * np.pi * f * det * t + det * 3)
            s += 0.18 * np.sin(2 * np.pi * 2 * f * det * t)
    env = np.minimum(1, t / 1.0) * np.minimum(1, (dur - t) / 1.0)
    return s * env / (len(freqs) * 2.4)


def add(sig, t0):
    i = int(t0 * SR)
    j = min(N, i + len(sig))
    if i < N:
        out[i:j] += sig[: j - i]


def level(t):
    """Arrangement dynamics (0..1) over the timeline."""
    keys = [(0, 0.75), (4.4, 0.85), (17.2, 0.6), (21, 0.35), (31.5, 0.55), (46, 0.4), (60.8, 0.8), (76.9, 0.55), (83.3, 0.18), (85.7, 0.5), (89.4, 1.0), (93.6, 0.7), (100.4, 0.85), (106.6, 1.0), (DUR - 1.2, 1.0), (DUR, 0.0)]
    ts = [k[0] for k in keys]
    vs = [k[1] for k in keys]
    return float(np.interp(t, ts, vs))


t = 0.0
bar = 0
while t < DUR:
    ci = bar % 4
    lv = level(t)
    ch = CHORDS[ci]
    add(pad([hz(m) for m in ch[1:4]], BAR + 1.0) * 0.32 * lv, t)
    # broken-chord left hand (eighths)
    pattern = [ch[0], ch[2], ch[3], ch[2], ch[0] + 12, ch[2], ch[3], ch[2]]
    for e, m in enumerate(pattern):
        add(piano(hz(m), 2.2, 0.32 * lv), t + e * BEAT / 2)
    # melody (sparser in the sad and dark parts)
    if lv > 0.3:
        for off, m in MELODY[ci]:
            add(piano(hz(m), 2.8, 0.55 * lv), t + off * BEAT)
    # building ending: sparkly high octave doubles
    if t > 89 and lv > 0.6:
        for off, m in MELODY[ci]:
            add(piano(hz(m + 12), 2.0, 0.22 * lv), t + off * BEAT + 0.01)
    t += BAR
    bar += 1

# final chord + fade
add(sum(piano(hz(m), 4.0, 0.5) for m in [48, 60, 64, 67, 72]), DUR - 3.4)
fade = np.ones(N)
fs = int((DUR - 1.4) * SR)
fade[fs:] = np.linspace(1, 0, N - fs)
out *= fade
out /= np.max(np.abs(out)) + 1e-9
out *= 10 ** (-6 / 20)  # peak -6 dBFS (ducked further in the mix)
with wave.open(os.path.join(HERE, 'music.wav'), 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((out[: int(DUR * SR)] * 32767).astype(np.int16).tobytes())
print('music.wav', round(DUR, 2), 's')
