#!/usr/bin/env python3
"""Energetic, playful background music synthesized in code -> audio/music.wav (stereo, 48 kHz).
Bar downbeats are aligned so the bus bonk (7.0 s) and the car-wash landing (46.0 s) land on
downbeats; the music cuts dead at the 'music_stop' time right before John's line."""
import json, os, sys
import numpy as np
import soundfile as sf
sys.path.insert(0, os.path.dirname(__file__))
from audiolib import *  # noqa

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'timeline.json')))
DUR = TL['duration']
STOP = TL['events']['music_stop']
BAR = 1.95                    # 123.08 BPM
OFF = 1.15                    # downbeat of bar 0  (bar 3 = 7.0 s, bar 23 = 46.0 s)
STEP = BAR / 16
N = int(DUR * SR) + SR

CH = {  # chord: (bass root midi, triad midi)
    'C': (48, [60, 64, 67]), 'G': (43, [59, 62, 67]), 'Am': (45, [60, 64, 69]), 'F': (41, [60, 65, 69]),
}
PROG = ['C', 'G', 'Am', 'F']
HOOK = {
    'C': [(0, 79, 2), (2, 76, 2), (4, 79, 2), (6, 81, 4), (10, 79, 2), (12, 76, 2), (14, 72, 2)],
    'G': [(0, 74, 2), (2, 71, 2), (4, 74, 2), (6, 79, 4), (10, 77, 2), (12, 74, 2), (14, 71, 2)],
    'Am': [(0, 76, 2), (2, 72, 2), (4, 76, 2), (6, 81, 4), (10, 79, 2), (12, 76, 2), (14, 72, 2)],
    'F': [(0, 77, 2), (2, 81, 2), (4, 84, 3), (7, 81, 1), (8, 79, 4), (12, 77, 2), (14, 76, 2)],
}


def bar_t(k):
    return OFF + k * BAR


def chord_of(k):
    return PROG[k % 4]


def section(k):
    t = bar_t(k)
    if t < 1.0: return 'intro'
    if t < 3.0: return 'stuck'
    if t < 5.0: return 'build'
    if t < 6.9: return 'A'
    if t < 8.9: return 'dizzy'
    if t < 12.8: return 'A'
    if t < 14.7: return 'build2'
    if t < 22.5: return 'B'
    if t < 28.4: return 'spin'
    if t < 30.3: return 'break'
    if t < 32.3: return 'rise'
    if t < 34.2: return 'tension'
    if t < 38.1: return 'A'
    if t < 40.1: return 'pre_slow'
    if t < 44.0: return 'slow'
    if t < 45.95: return 'build3'
    return 'wash'


# ---------------------------------------------------------------- instruments
def kick():
    t = secs(0.38)
    f = 46 + 120 * np.exp(-t / 0.032)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
    x[:150] += hp(noise(150), 2000) * 0.35 * np.linspace(1, 0, 150)
    return soft_clip(x * 1.2, 1.3)


def clap():
    n = int(0.25 * SR); t = np.arange(n) / SR
    e = np.zeros(n)
    for d in (0.0, 0.011, 0.022):
        i = int(d * SR); e[i:] += np.exp(-(t[: n - i]) / (0.006 if d < 0.02 else 0.11))
    x = bp(noise(n), 900, 3200) * e * 0.8
    x += np.sin(2 * np.pi * 195 * t) * np.exp(-t / 0.05) * 0.35
    return x


def hat(open_=False):
    d = 0.32 if open_ else 0.06
    t = secs(d)
    return hp(noise(len(t)), 7500, 3) * np.exp(-t / (0.12 if open_ else 0.018)) * (0.5 if open_ else 0.6)


def shaker():
    t = secs(0.07)
    return bp(noise(len(t)), 5000, 11000) * np.sin(np.pi * np.clip(t / 0.07, 0, 1)) * 0.35


def crash():
    t = secs(2.2)
    x = hp(noise(len(t)), 3500, 2) * np.exp(-t / 0.65)
    for f in (3150, 4420, 5810, 7230):
        x += 0.08 * np.sin(2 * np.pi * f * t + RNG.random() * 6) * np.exp(-t / 0.5)
    return x * 0.5


def bass(m, dur, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = midi_hz(m)
    x = 0.6 * square(f, n, 0.42) + 0.5 * saw(f, n)
    cut = 250 + (1600 * bright) * np.exp(-t / 0.09)
    x = sweep_filter(x, 'lp', cut, 1.1)
    x *= env_adsr(n, 0.003, 0.08, 0.65, 0.03)
    x += 0.35 * np.sin(2 * np.pi * f * t) * env_adsr(n, 0.003, 0.1, 0.8, 0.03)
    return x * 0.55


def stab(notes, dur=0.13, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for m in notes:
        for det in (-0.07, 0.0, 0.07):
            x += saw(midi_hz(m + det), n)
    x /= len(notes) * 3
    x = sweep_filter(x, 'lp', 600 + 3200 * bright * np.exp(-t / 0.05), 1.3)
    return x * env_adsr(n, 0.002, 0.06, 0.35, 0.03) * 0.9


def marimba(m, dur=0.5, wob=0.0):
    t = secs(max(dur, 0.6))
    f = midi_hz(m)
    vib = 1 + wob * 0.03 * np.sin(2 * np.pi * 5.5 * t)
    x = np.zeros(len(t))
    for ratio, amp, tau in ((1, 1.0, 0.42), (3.93, 0.32, 0.11), (9.2, 0.1, 0.035)):
        if f * ratio < SR * 0.45:
            x += amp * np.sin(2 * np.pi * np.cumsum(f * ratio * vib) / SR) * np.exp(-t / (tau * (440 / f) ** 0.25))
    x[:100] += noise(100) * np.linspace(0.12, 0, 100)
    return x * 0.5


def pluck(m, dur=0.25):
    n = int(dur * SR); t = np.arange(n) / SR
    x = saw(midi_hz(m), n) * 0.5 + square(midi_hz(m) * 2, n) * 0.15
    x = sweep_filter(x, 'lp', 400 + 5000 * np.exp(-t / 0.04), 1.0)
    return x * np.exp(-t / 0.12) * 0.5


def pad(notes, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for m in notes:
        for det in (-0.12, 0.05, 0.11):
            x += saw(midi_hz(m + det), n)
    x = lp(x / (len(notes) * 3), 1100)
    return x * env_adsr(n, 0.6, 0.4, 0.8, 0.9) * 0.6


def bloop():
    t = secs(0.12)
    f = 900 + 1400 * (1 - np.exp(-t / 0.03)) * (0.6 + 0.8 * RNG.random())
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.04) * 0.25


def riser(dur, f0=400, f1=6000):
    n = int(dur * SR); t = np.arange(n) / SR
    u = t / dur
    x = sweep_filter(noise(n), 'bp', f0 * (f1 / f0) ** u, 2.0) * u ** 2
    return x * 0.6


# ---------------------------------------------------------------- arrangement
def render():
    tr = {k: np.zeros((N, 2)) for k in ['kick', 'clap', 'hat', 'bass', 'stab', 'hook', 'arp', 'pad', 'fx']}
    K = kick(); C = clap(); Hc = hat(); Ho = hat(True); S = shaker(); X = crash()
    for k in range(-1, 27):
        t0 = bar_t(k)
        if t0 > STOP + 0.5: break
        sec = section(k); ch = chord_of(k); root, triad = CH[ch]
        steps = [t0 + s * STEP for s in range(16)]
        full = sec in ('A', 'B', 'spin', 'wash', 'pre_slow', 'tension', 'dizzy', 'build2', 'build3')
        # drums
        if sec in ('build', 'A', 'B', 'spin', 'wash', 'pre_slow', 'build2', 'build3', 'dizzy', 'tension', 'rise'):
            kick_steps = [0, 4, 8, 12] if sec != 'tension' else [0, 2, 4, 6, 8, 10, 12, 14]
            if sec == 'dizzy': kick_steps = [0, 8]
            if sec == 'build': kick_steps = [0, 4, 8, 12]
            for s in kick_steps: place(tr['kick'], K, steps[s], 0.9)
        if full or sec in ('rise',):
            for s in (4, 12): place(tr['clap'], C, steps[s], 0.7 if sec != 'dizzy' else 0.4)
        if sec != 'intro' and sec != 'slow':
            for s in range(0, 16, 2):
                g = 0.5 if s % 4 == 2 else 0.32
                if sec == 'stuck': g *= 0.6
                place(tr['hat'], Ho if (full and s % 8 == 6) else Hc, steps[s], g)
            if full:
                for s in range(1, 16, 2): place(tr['hat'], S, steps[s], 0.5)
        if sec == 'rise':  # snare roll accelerating
            for s in range(0, 16): place(tr['clap'], C, steps[s], 0.15 + 0.35 * s / 15)
        # bass
        if sec not in ('intro', 'slow'):
            pat = {0: 0, 3: 12, 4: 0, 6: 12, 8: 0, 11: 7, 12: 0, 14: 12}
            bright = 0.5 if sec in ('stuck', 'break') else 1.0
            for s, iv in pat.items():
                if sec == 'stuck' and s % 4 != 0: continue
                place(tr['bass'], bass(root + iv, STEP * 1.6, bright), steps[s], 0.9)
        # off-beat stabs
        if full or sec == 'build':
            for s in (2, 6, 10, 14):
                place(tr['stab'], stab([n + 12 for n in triad], 0.12), steps[s], 0.55 if sec != 'build' else 0.3)
        # hook (marimba)
        if sec not in ('slow', 'tension', 'rise'):
            g = 0.75 if sec not in ('intro', 'stuck') else 0.5
            for s, m, ln in HOOK[ch]:
                place(tr['hook'], marimba(m, ln * STEP, wob=1.0 if sec == 'dizzy' else 0.0), steps[s], g)
        # driving arpeggio for the climb / spin / wash
        if sec in ('B', 'spin', 'wash', 'build2', 'build3'):
            arp = [0, 4, 7, 12, 16, 19, 24, 19] if ch in ('C',) else [0, 3 if ch == 'Am' else 4, 7, 12, 15 if ch == 'Am' else 16, 19, 24, 19]
            base = triad[0] - 12 if ch != 'G' else 55
            for s in range(16):
                place(tr['arp'], pluck(base + arp[s % 8] + (12 if sec == 'B' and s >= 8 else 0), STEP * 1.1), steps[s], 0.32)
        if sec == 'wash':
            r = np.random.default_rng(k)
            for s in r.choice(16, 5, replace=False): place(tr['fx'], bloop(), steps[s] + r.random() * 0.05, 0.6)
        # slow-motion: dreamy pads + slow bell arpeggio
        if sec == 'slow':
            place(tr['pad'], pad([n for n in triad] + [root + 12], BAR * 1.05), t0, 0.7)
            for i, s in enumerate((0, 4, 8, 12)):
                place(tr['hook'], marimba([triad[0] + 12, triad[1] + 12, triad[2] + 12, triad[1] + 24][i], 0.9), steps[s], 0.45)
            place(tr['kick'], K, steps[0], 0.45); place(tr['clap'], C, steps[8], 0.25)
    # crashes / impacts on story beats
    for tt, g in ((5.05, 0.6), (7.0, 0.9), (14.8, 0.6), (33.81, 0.9), (46.0, 1.0)):
        place(tr['fx'], X, tt, g)
    for (a, b) in ((3.35, 4.75), (12.85, 13.6), (22.0, 23.0), (32.35, 33.81), (44.6, 46.0)):
        place(tr['fx'], riser(b - a), a, 0.55)

    # per-track processing
    mix = np.zeros((N, 2))
    gains = {'kick': 0.9, 'clap': 0.55, 'hat': 0.35, 'bass': 0.7, 'stab': 0.42, 'hook': 0.6, 'arp': 0.38, 'pad': 0.55, 'fx': 0.5}
    for name, buf in tr.items():
        x = buf
        if name in ('hook', 'pad', 'arp', 'stab'):
            x = reverb(x[:, 0] * 0.5 + x[:, 1] * 0.5, size=2.2 if name == 'pad' else 1.4, wet=0.35 if name != 'pad' else 0.55)
        if name == 'hook':
            x = x * np.array([0.92, 1.0])
        if name == 'arp':
            x = x * np.array([1.0, 0.85])
        mix += x * gains[name]
    # spin section: circling auto-pan on everything melodic (car tumbling)
    t = np.arange(N) / SR
    spin = ((t > 23.4) & (t < 28.9)).astype(float)
    sp = np.convolve(spin, np.ones(4800) / 4800, mode='same')
    pnr = 0.45 * sp * np.sin(2 * np.pi * 1.1 * t)
    mix[:, 0] *= 1 - pnr; mix[:, 1] *= 1 + pnr
    # 'stuck' + intro: muffled (like from inside the car)
    muff = 1 - np.clip((t - 3.1) / 1.6, 0, 1)
    lpd = np.stack([lp(mix[:, 0], 1400), lp(mix[:, 1], 1400)], axis=1)
    mix = mix * (1 - muff[:, None]) + lpd * muff[:, None]
    # slow-motion: low-pass the whole music + tape stop / tape start pitch glides
    slow = np.clip((t - 39.8) / 0.4, 0, 1) * (1 - np.clip((t - 44.4) / 0.4, 0, 1))
    lps = np.stack([lp(mix[:, 0], 900), lp(mix[:, 1], 900)], axis=1)
    mix = mix * (1 - 0.7 * slow[:, None]) + lps * 0.7 * slow[:, None]
    mix = tape_warp(mix, 39.8, 40.2, 1.0, 0.45)
    mix = tape_warp(mix, 44.4, 44.8, 0.45, 1.0)
    # hard stop right before John's line (10 ms fade avoids a click)
    i = int(STOP * SR); f = int(0.01 * SR)
    mix[i:i + f] *= np.linspace(1, 0, f)[:, None]; mix[i + f:] = 0
    mix = mix[: int(DUR * SR)]
    mix /= max(1e-6, np.abs(mix).max()) / 0.85
    return mix


def tape_warp(x, a, b, r0, r1):
    """within [a,b] play the signal at a gliding rate r0->r1 (pitch glide), keeping total length"""
    ia, ib = int(a * SR), int(b * SR)
    n = ib - ia
    rate = np.linspace(r0, r1, n)
    pos = ia + np.cumsum(rate)
    pos = np.clip(pos, 0, len(x) - 2)
    out = x.copy()
    for ch in range(2):
        out[ia:ib, ch] = np.interp(pos, np.arange(len(x)), x[:, ch])
    # crossfade back into the untouched signal to avoid a click at the seam
    f = int(0.02 * SR)
    w = np.linspace(1, 0, f)[:, None]
    out[ib - f:ib] = out[ib - f:ib] * w + x[ib - f:ib] * (1 - w)
    return out


if __name__ == '__main__':
    os.makedirs(os.path.join(ROOT, 'audio'), exist_ok=True)
    m = render()
    sf.write(os.path.join(ROOT, 'audio', 'music.wav'), m.astype(np.float32), SR, subtype='FLOAT')
    print('music.wav', m.shape[0] / SR, 's')
