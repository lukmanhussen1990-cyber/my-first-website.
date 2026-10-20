#!/usr/bin/env python3
"""Synthesize the music and sound-effect stems, in sync with the animation.

All sound is generated with numpy/scipy (no samples). Timing comes from
work/timeline.json (node tools/export_timeline.mjs), which is sampled from the
same timeline the 3D render uses.
  work/music.wav  playful 124 BPM score; stops dead at the 'music_stop' time
  work/sfx.wav    motor, sand, fan, paws, thrusters, splash, skid, panting, click
usage: make_audio.py [--timeline work/timeline.json] [--out work]
"""
import argparse, json, os
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
rng = np.random.default_rng(7)


# ------------------------------------------------------------------ helpers
def sec(x):
    return int(round(x * SR))


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype='low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype='high', fs=SR, output='sos'), x)


def noise(n):
    return rng.standard_normal(n).astype(np.float64)


def pink(n):
    # Voss-McCartney-ish: sum of octave-filtered noises
    w = noise(n)
    return lp(w, 1200) * 0.6 + lp(w, 300) * 1.4 + lp(w, 80) * 2.0 + w * 0.12


def env_ad(n, a, d, curve=4.0):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), np.exp(-(t - a) * curve / max(d, 1e-4)))
    return e


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, x, t, gain=1.0, pan=0.0):
    """Add mono x into stereo buf at time t with constant-power pan (-1..1)."""
    i = sec(t)
    if i >= buf.shape[1] or i + len(x) <= 0:
        return
    j0, j1 = max(0, -i), min(len(x), buf.shape[1] - i)
    a = (pan + 1) * np.pi / 4
    seg = x[j0:j1] * gain
    buf[0, i + j0:i + j1] += seg * np.cos(a)
    buf[1, i + j0:i + j1] += seg * np.sin(a)


def reverb_ir(length=1.6, decay=3.2, predelay=0.012, seed=3):
    r = np.random.default_rng(seed)
    n = sec(length)
    t = np.arange(n) / SR
    irs = []
    for ch in range(2):
        x = r.standard_normal(n) * np.exp(-t * decay)
        x = lp(x, 6500) * 0.7 + lp(x, 1800) * 0.3
        x[:sec(predelay)] = 0
        for k in range(6):  # a few early reflections
            d = sec(predelay + 0.006 + 0.011 * k + 0.003 * ch)
            x[d] += 0.5 * (0.7 ** k) * (1 if k % 2 == 0 else -1)
        irs.append(x / np.sqrt(np.sum(x ** 2)))
    return irs


def add_reverb(st, wet=0.25, **kw):
    ir = reverb_ir(**kw)
    out = st.copy()
    for ch in range(2):
        out[ch] += wet * fftconvolve(st[ch], ir[ch])[:st.shape[1]]
    return out


# --------------------------------------------------------------- instruments
def kick(vel=1.0, dur=0.42):
    n = sec(dur); t = np.arange(n) / SR
    f = 46 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 7.5)
    click = hp(noise(n), 2500) * np.exp(-t * 300) * 0.35
    return np.tanh(1.6 * (x + click)) * vel


def clap(vel=1.0):
    n = sec(0.3); t = np.arange(n) / SR
    e = np.zeros(n)
    for k, d in enumerate([0, 0.011, 0.022]):
        i = sec(d); e[i:] += np.exp(-(t[:n - i]) * (60 if k < 2 else 18)) * (0.8 if k < 2 else 1.0)
    return bp(noise(n), 900, 2600) * e * 0.9 * vel


def snare(vel=1.0):
    n = sec(0.25); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 28) * 0.6
    sn = hp(noise(n), 1600) * np.exp(-t * 22)
    return (body + sn) * 0.7 * vel


def hat(vel=1.0, open_=False):
    n = sec(0.32 if open_ else 0.07); t = np.arange(n) / SR
    x = hp(noise(n), 7000, 3) * np.exp(-t * (11 if open_ else 75))
    return x * 0.45 * vel


def crash(vel=1.0, dur=2.6):
    n = sec(dur); t = np.arange(n) / SR
    x = hp(noise(n), 3500) * np.exp(-t * 1.9)
    metal = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) for f in (3120, 4370, 5620, 6890)) * 0.05 * np.exp(-t * 3)
    return (x * 0.55 + metal) * vel


def bass(m, dur, vel=1.0):
    n = sec(dur + 0.06); t = np.arange(n) / SR
    f = mtof(m)
    saw = 2 * ((f * t) % 1.0) - 1
    sub = np.sin(2 * np.pi * f * t)
    cut = 250 + 1400 * np.exp(-t * 14)
    # time-varying low-pass via blocks
    y = np.zeros(n); blk = 480
    zi = np.zeros((1, 2))
    for s in range(0, n, blk):
        sos = butter(2, min(cut[s], SR * 0.45), btype='low', fs=SR, output='sos')
        y[s:s + blk], zi = sosfilt(sos, saw[s:s + blk], zi=zi)
    e = np.minimum(1, t / 0.004) * np.where(t < dur, 1.0, np.exp(-(t - dur) * 60)) * (0.75 + 0.25 * np.exp(-t * 6))
    return np.tanh(1.3 * (y * 0.6 + sub * 0.55)) * e * vel


def marimba(m, vel=1.0, dur=0.9):
    n = sec(dur); t = np.arange(n) / SR
    f = mtof(m)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t * 6.5) + 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 22)
         + 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t * 45))
    x *= np.minimum(1, t / 0.0015)
    return x * vel


def pluck_lead(m, dur, vel=1.0):
    """Bright square-ish pluck that doubles the marimba for the hook."""
    n = sec(dur + 0.25); t = np.arange(n) / SR
    f = mtof(m)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.25)
    ph = np.cumsum(f * vib) / SR
    sq = np.sign(np.sin(2 * np.pi * ph)) * 0.5 + 0.5 * (2 * (ph % 1.0) - 1)
    y = lp(sq, 2600)
    e = np.minimum(1, t / 0.006) * np.where(t < dur, np.exp(-t * 2.2), np.exp(-dur * 2.2) * np.exp(-(t - dur) * 25))
    return y * e * 0.35 * vel


def brass(ms, dur, vel=1.0):
    n = sec(dur + 0.2); t = np.arange(n) / SR
    out = np.zeros(n)
    for m in ms:
        for det in (-0.08, 0.0, 0.07):
            f = mtof(m + det)
            out += 2 * ((f * t + rng.uniform()) % 1.0) - 1
    att = np.minimum(1, t / 0.025)
    e = att * np.where(t < dur, 1 - 0.25 * np.minimum(1, t / dur), 0.75 * np.exp(-(t - dur) * 18))
    y = lp(out, 2200) * 0.6 + lp(out, 700) * 0.4
    return y * e * vel / (3 * len(ms)) * 1.6


def pad(ms, dur, vel=1.0, att=0.6, rel=0.9, cutoff=1500):
    n = sec(dur + rel); t = np.arange(n) / SR
    out = np.zeros(n)
    for m in ms:
        for det in (-0.12, -0.04, 0.05, 0.13):
            f = mtof(m + det)
            out += 2 * ((f * t + rng.uniform()) % 1.0) - 1
    e = np.minimum(1, t / att) * np.where(t < dur, 1.0, np.exp(-(t - dur) * 4.0 / rel))
    return lp(out, cutoff, 2) * e * vel / (4 * len(ms))


def pizz(m, vel=1.0):
    """Karplus-Strong plucked string."""
    f = mtof(m)
    L = max(2, int(SR / f))
    n = sec(0.5)
    buf = rng.uniform(-1, 1, L)
    out = np.zeros(n)
    for i in range(n):
        v = buf[i % L]
        out[i] = v
        buf[i % L] = 0.5 * (v + buf[(i + 1) % L]) * 0.985
    return lp(out, 3500) * np.exp(-np.arange(n) / SR * 7) * vel


def bell(m, vel=1.0):
    n = sec(1.8); t = np.arange(n) / SR
    f = mtof(m)
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in ((1, 1, 2.5), (2.76, 0.4, 5), (5.4, 0.2, 9), (8.9, 0.1, 14)))
    return x * np.minimum(1, t / 0.001) * vel * 0.5


def riser(dur, vel=1.0, f0=300, f1=4000):
    # noise swept upward: fixed band-passes cross-faded along the sweep (no zipper noise)
    n = sec(dur); t = np.arange(n) / SR
    w = noise(n)
    nb = 10
    cents = f0 * (f1 / f0) ** (np.arange(nb) / (nb - 1))
    pos = (t / dur) * (nb - 1)
    out = np.zeros(n)
    for k, fc in enumerate(cents):
        g = np.clip(1 - np.abs(pos - k), 0, 1)
        if g.max() > 0:
            out += bp(w, fc * 0.75, min(fc * 1.33, SR * 0.45)) * g
    return out * (t / dur) ** 2 * vel


def reverse_cymbal(dur, vel=1.0):
    c = crash(1.0, dur)[::-1]
    return c * vel


# --------------------------------------------------------------------- music
BPM = 124.0
BEAT = 60.0 / BPM
STEP = BEAT / 4  # 16th


class Score:
    def __init__(self, dur):
        self.buses = {k: np.zeros((2, sec(dur) + SR * 3)) for k in ('drums', 'bass', 'lead', 'chords', 'fx')}

    def add(self, bus, x, t, gain=1.0, pan=0.0):
        place(self.buses[bus], x, t, gain, pan)


CHORDS = {  # root (bass MIDI), chord tones (MIDI)
    'C': (36, [60, 64, 67]), 'Am': (45, [57, 60, 64]), 'F': (41, [57, 60, 65]), 'G': (43, [59, 62, 67]),
    'Dm': (38, [57, 62, 65]), 'E': (40, [56, 59, 64]), 'Ab': (44, [56, 60, 63]), 'Bb': (46, [58, 62, 65]),
}
HOOK = [  # per bar: (step, len, midi)
    [(0, 2, 76), (2, 2, 79), (4, 3, 84), (8, 2, 83), (10, 2, 79), (12, 4, 76)],
    [(0, 2, 81), (2, 2, 84), (4, 3, 88), (8, 2, 86), (10, 2, 84), (12, 4, 81)],
    [(0, 2, 77), (2, 2, 81), (4, 3, 84), (8, 2, 81), (10, 2, 84), (12, 3, 89)],
    [(0, 2, 79), (3, 1, 83), (4, 4, 86), (8, 2, 83), (10, 2, 79), (12, 2, 86), (14, 2, 89)],
]
HOOK_B = [  # higher-energy answer phrase
    [(0, 1, 84), (1, 1, 86), (2, 2, 88), (4, 2, 91), (6, 2, 88), (8, 3, 86), (12, 2, 84), (14, 2, 79)],
    [(0, 2, 81), (2, 2, 84), (4, 2, 88), (6, 2, 84), (8, 3, 86), (12, 4, 84)],
    [(0, 2, 77), (2, 1, 79), (3, 1, 81), (4, 3, 84), (8, 2, 89), (10, 2, 88), (12, 4, 84)],
    [(0, 2, 83), (2, 2, 86), (4, 2, 91), (6, 2, 89), (8, 2, 86), (10, 2, 83), (12, 4, 86)],
]


def bar_drums(S, t0, style='A', vel=1.0):
    st = lambda k: t0 + k * STEP
    if style == 'A':
        for k in (0, 8, 10):
            S.add('drums', kick(vel), st(k), 0.95 if k != 10 else 0.6)
        for k in (4, 12):
            S.add('drums', clap(vel), st(k), 0.7, 0.05)
        for k in range(0, 16, 2):
            S.add('drums', hat(vel, open_=(k == 14)), st(k), 0.55 if k % 4 else 0.35, 0.25)
        for k in (3, 7, 11, 15):
            S.add('drums', hat(vel * 0.5), st(k), 0.25, 0.3)
    elif style == 'B':  # driving: four on the floor + 16th hats
        for k in (0, 4, 8, 12):
            S.add('drums', kick(vel), st(k), 0.95)
        for k in (4, 12):
            S.add('drums', clap(vel), st(k), 0.75, 0.05)
            S.add('drums', snare(vel), st(k), 0.35, -0.05)
        for k in range(16):
            S.add('drums', hat(vel * (1.0 if k % 2 == 0 else 0.6), open_=(k in (6, 14))), st(k), 0.4, 0.25)
    elif style == 'half':  # stuck in the sand: half time, muffled
        S.add('drums', kick(vel), st(0), 0.85)
        S.add('drums', kick(vel * 0.7), st(10), 0.5)
        S.add('drums', snare(vel * 0.8), st(8), 0.45)
        for k in range(0, 16, 4):
            S.add('drums', hat(vel * 0.6), st(k + 2), 0.3, 0.25)
    elif style == 'thin':  # tired cheetah: just hats and a soft kick
        S.add('drums', kick(vel * 0.6), st(0), 0.6)
        for k in range(0, 16, 4):
            S.add('drums', hat(vel * 0.5), st(k + 2), 0.28, 0.25)
    elif style == 'happy':  # celebration: bouncy claps
        for k in (0, 6, 8, 14):
            S.add('drums', kick(vel), st(k), 0.85 if k in (0, 8) else 0.55)
        for k in (4, 12):
            S.add('drums', clap(vel), st(k), 0.8, 0.0)
        for k in (11,):
            S.add('drums', clap(vel * 0.6), st(k), 0.45, 0.1)
        for k in range(0, 16, 2):
            S.add('drums', hat(vel), st(k), 0.5, 0.25)


def bar_bass(S, t0, chord, style='A', vel=1.0):
    r = CHORDS[chord][0]
    st = lambda k: t0 + k * STEP
    if style == 'A':
        pat = [(0, 2, r), (3, 1, r + 12), (6, 1, r), (8, 2, r), (10, 1, r + 12), (12, 2, r + 7), (14, 2, r + 12)]
    elif style == 'B':
        pat = [(k, 1, r if k % 4 != 2 else r + 12) for k in range(0, 16, 2)]
    elif style == 'half':
        pat = [(0, 6, r), (8, 2, r), (11, 1, r + 12), (12, 4, r - 2)]
    elif style == 'thin':
        pat = [(0, 8, r), (8, 8, r)]
    else:  # happy
        pat = [(0, 2, r), (2, 1, r + 12), (4, 2, r + 7), (6, 1, r + 12), (8, 2, r), (10, 1, r + 12), (12, 2, r + 4), (14, 2, r + 7)]
    for k, ln, m in pat:
        S.add('bass', bass(m, ln * STEP * 0.9, vel), st(k), 0.6)


def bar_hook(S, t0, phrase, vel=1.0, double=True):
    for k, ln, m in phrase:
        S.add('lead', marimba(m, vel), t0 + k * STEP, 0.42, -0.15)
        if double:
            S.add('lead', pluck_lead(m, ln * STEP * 0.85, vel), t0 + k * STEP, 0.5, 0.15)


def bar_chords(S, t0, chord, vel=1.0, style='stab'):
    tones = CHORDS[chord][1]
    if style == 'stab':
        for k in (2, 6, 10, 14):  # off-beat skank
            S.add('chords', brass(tones, STEP * 0.8, vel * 0.55), t0 + k * STEP, 0.32, 0.2)
    else:
        S.add('chords', pad(tones, 4 * BEAT, vel), t0, 0.5)


def compose(beat, dur, stop):
    S = Score(dur)
    T0 = beat['flagDrop']                 # downbeat of the groove = the flag drop
    bar = lambda k: T0 + k * 4 * BEAT
    prog = ['C', 'Am', 'F', 'G']
    # --- intro (0 .. flag drop): ticking pizzicato, warm pad, snare roll + riser
    for k in range(-9, 0):
        tb = T0 + k * BEAT
        if tb > 0.05:
            S.add('lead', pizz(72 if k % 2 else 79, 0.8), tb, 0.5, -0.2)
    S.add('chords', pad([60, 65, 67], T0 - 0.2, 0.7, att=1.5, cutoff=1100), 0.2, 0.45)
    for i in range(32):
        tt = T0 - 2 * BEAT + i * (2 * BEAT / 32)
        S.add('drums', snare(0.25 + 0.75 * i / 31), tt, 0.25 + 0.35 * i / 31, 0.0)
    S.add('fx', riser(2.2, 1.0), T0 - 2.2, 0.35)
    S.add('fx', crash(1.0), T0, 0.6, -0.1)
    # --- groove A: launch and the side-by-side sprint
    k = 0
    while bar(k) < beat['bog']:
        c = prog[k % 4]
        bar_drums(S, bar(k), 'A'); bar_bass(S, bar(k), c, 'A'); bar_hook(S, bar(k), HOOK[k % 4]); bar_chords(S, bar(k), c)
        k += 1
    # --- stuck in the sand: comedic slide down, half-time and muffled until the fan
    S.add('bass', bass(43, 0.18), beat['sortOf'] - 0.02, 0.6)
    slide = np.concatenate([bass(m, 0.07, 0.9) for m in (43, 42, 41, 40, 39, 38, 37, 36)])
    S.add('bass', slide, beat['sortOf'] + 0.25, 0.55)
    kk = k
    while bar(kk) < beat['fanOn']:
        c = prog[kk % 4]
        bar_drums(S, bar(kk), 'half', 0.8); bar_bass(S, bar(kk), c, 'half', 0.85)
        for s16 in range(0, 16, 2):  # wheels spinning: one stuck note
            S.add('lead', marimba(79 + (s16 % 4 == 2), 0.45), bar(kk) + s16 * STEP, 0.3, -0.2)
        kk += 1
    # fan on: riser into the build, big hit on grip
    S.add('fx', riser(beat['grip'] - beat['fanOn'], 1.0, 200, 6000), beat['fanOn'], 0.4)
    kb = kk
    while bar(kb) < beat['grip']:
        tb = bar(kb)
        for i in range(16):
            S.add('drums', snare(0.3 + 0.5 * i / 15), tb + i * STEP, 0.3, 0.0)
        bar_bass(S, tb, prog[kb % 4], 'B', 0.8)
        kb += 1
    S.add('fx', crash(1.2), beat['grip'], 0.75, 0.1)
    S.add('chords', brass([60, 64, 67, 72], 0.45, 1.0), beat['grip'], 0.7)
    S.add('drums', kick(1.2), beat['grip'], 1.0)
    # --- groove B: the chase, corner and run-up to the river
    kc = kb
    while bar(kc) < beat['chLeap'] - 0.4:
        c = prog[kc % 4]
        bar_drums(S, bar(kc), 'B'); bar_bass(S, bar(kc), c, 'B'); bar_hook(S, bar(kc), (HOOK_B if (kc // 4) % 2 else HOOK)[kc % 4]); bar_chords(S, bar(kc), c)
        kc += 1
    S.add('chords', brass([62, 67, 71], 0.3, 0.9), beat['sideThr'], 0.6)
    S.add('fx', crash(0.8), beat['sideThr'], 0.45, -0.2)
    # cheetah leaps: marimba run up into the leap
    for i, m in enumerate([72, 74, 76, 79, 81, 84, 86, 88]):
        S.add('lead', marimba(m, 0.8), beat['chLeap'] - 0.32 + i * 0.04, 0.4, -0.1)
    # car brakes at the bank: suspense (tremolo Ab chord), then the thrusters
    t_s = beat['carBrake'] + 0.25
    trem = pad([56, 60, 63], beat['carLaunch'] - t_s, 0.8, att=0.15, rel=0.3, cutoff=2400)
    trem *= 0.65 + 0.35 * np.sin(2 * np.pi * 9 * np.arange(len(trem)) / SR)
    S.add('chords', trem, t_s, 0.5)
    S.add('bass', bass(32, beat['carLaunch'] - t_s, 0.8), t_s, 0.5)
    S.add('fx', riser(beat['carLaunch'] - beat['backThr'] + 0.2, 1.0, 150, 3000), beat['backThr'] - 0.2, 0.4)
    S.add('fx', crash(1.2), beat['carLaunch'], 0.7)
    S.add('chords', brass([65, 69, 72, 77], 0.5, 1.0), beat['carLaunch'], 0.6)
    # --- slow motion: dreamy pad, sparkling bells, a slow heartbeat, reverse cymbal into the landing
    ts0, ts1 = beat['carLaunch'] + 0.25, beat['land']
    S.add('chords', pad([53, 60, 64, 69], 2.2, 0.9, att=0.5, cutoff=1300), ts0, 0.55)
    S.add('chords', pad([55, 59, 62, 67], ts1 - ts0 - 2.0, 0.9, att=0.6, cutoff=1300), ts0 + 2.0, 0.55)
    S.add('bass', bass(29, 2.0, 0.6), ts0, 0.45)
    S.add('bass', bass(31, ts1 - ts0 - 2.0, 0.6), ts0 + 2.0, 0.45)
    for hb in np.arange(ts0 + 0.4, ts1 - 0.3, 1.25):
        S.add('drums', lp(kick(0.8, 0.6), 400), hb, 0.6)
    pent = [84, 86, 88, 91, 93, 96, 98]
    for i in range(26):
        tt = ts0 + rng.uniform(0, ts1 - ts0 - 0.4)
        S.add('lead', bell(pent[rng.integers(len(pent))], 0.6), tt, 0.22, rng.uniform(-0.7, 0.7))
    S.add('fx', reverse_cymbal(2.0, 1.0), ts1 - 2.0, 0.5)
    # --- landing: groove A returns
    S.add('fx', crash(1.2), beat['land'], 0.8)
    S.add('drums', kick(1.2), beat['land'], 1.0)
    kd = int(np.ceil((beat['land'] - T0) / (4 * BEAT) - 0.02))
    while bar(kd) < beat['chSlow']:
        c = prog[kd % 4]
        bar_drums(S, bar(kd), 'A'); bar_bass(S, bar(kd), c, 'A'); bar_hook(S, bar(kd), HOOK[kd % 4]); bar_chords(S, bar(kd), c)
        kd += 1
    # --- the cheetah tires: thinner groove, descending tired melody
    while bar(kd) < beat['sly'] - 0.3:
        c = prog[kd % 4]
        bar_drums(S, bar(kd), 'thin'); bar_bass(S, bar(kd), c, 'thin', 0.75)
        for i, m in enumerate([79, 77, 76, 74]):
            S.add('lead', marimba(m, 0.5), bar(kd) + i * BEAT, 0.3, -0.2)
        kd += 1
    # --- sly idea: sneaky pizzicato tiptoe (minor), finger snaps
    sneak = [57, 60, 64, 63, 64, 60, 57, 59, 60, 63, 64, 67]
    for i, m in enumerate(sneak):
        tt = beat['sly'] + i * (BEAT / 2)
        if tt < beat['zip'] - 0.05:
            S.add('lead', pizz(m + 12, 0.9), tt, 0.6, 0.1)
            S.add('bass', bass(m - 12, BEAT * 0.3, 0.6), tt, 0.35)
            if i % 2 == 1:
                S.add('drums', hp(clap(0.6), 2000), tt, 0.35, -0.2)
    # zip: fast glissando up
    for i in range(14):
        S.add('lead', marimba(72 + 2 * i, 0.7), beat['zip'] + i * 0.022, 0.35)
    S.add('fx', crash(0.9), beat['zip'] + 0.3, 0.5, 0.2)
    # --- finish run: groove B
    ke = int(np.ceil((beat['zip'] + 0.3 - T0) / (4 * BEAT)))
    S.add('fx', riser(bar(ke) - beat['zip'] - 0.3, 0.8), beat['zip'] + 0.3, 0.35)
    while bar(ke) < beat['carStop'] - 0.2:
        c = prog[ke % 4]
        bar_drums(S, bar(ke), 'B'); bar_bass(S, bar(ke), c, 'B'); bar_hook(S, bar(ke), HOOK_B[ke % 4]); bar_chords(S, bar(ke), c)
        ke += 1
    S.add('fx', crash(1.0), beat['finishCross'], 0.65, -0.2)
    S.add('chords', brass([60, 64, 67], 0.3, 0.9), beat['finishCross'], 0.55)
    # car stops: big hit, then a shimmering held chord while the dust clears
    S.add('fx', crash(1.3, 3.5), beat['carStop'], 0.8)
    S.add('drums', kick(1.3), beat['carStop'], 1.0)
    S.add('chords', brass([55, 60, 64, 67], 0.6, 1.0), beat['carStop'], 0.6)
    S.add('chords', pad([60, 64, 67, 71], beat['cheer'] - beat['carStop'] - 0.3, 0.8, att=0.3, cutoff=2600), beat['carStop'] + 0.1, 0.5)
    for i in range(10):
        S.add('lead', bell([84, 88, 91, 95][i % 4], 0.5), beat['carStop'] + 0.4 + i * 0.16, 0.2, rng.uniform(-0.6, 0.6))
    # --- cheer: fanfare, then a bouncy happy groove that keeps going... until it stops dead
    tc = beat['cheer']
    for i, (dt, tones, ln) in enumerate([(0, [60, 64, 67], 0.16), (0.2, [60, 64, 67], 0.16), (0.4, [65, 69, 72], 0.16), (0.62, [67, 72, 76], 0.7)]):
        S.add('chords', brass(tones, ln, 1.0), tc + dt, 0.75)
    S.add('fx', crash(1.0), tc + 0.62, 0.6)
    tf0 = tc + 0.62 + 2 * BEAT  # the happy groove kicks in two beats after the fanfare chord
    happy = ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'C']
    j = 0
    tb = tf0
    while tb < stop + 0.5:
        c = happy[j % len(happy)]
        bar_drums(S, tb, 'happy'); bar_bass(S, tb, c, 'happy'); bar_hook(S, tb, HOOK[j % 4], 0.9); bar_chords(S, tb, c, 0.9)
        tb += 4 * BEAT; j += 1
    # mix buses
    gains = {'drums': 0.9, 'bass': 0.85, 'lead': 0.7, 'chords': 0.6, 'fx': 0.55}
    mix = sum(S.buses[k] * g for k, g in gains.items())
    send = S.buses['lead'] * 0.7 + S.buses['chords'] * 0.6 + S.buses['drums'] * 0.12 + S.buses['fx'] * 0.3
    mix = mix + (add_reverb(send, wet=1.0, length=1.8, decay=3.0) - send) * 0.28
    mix = mix[:, :sec(dur)]
    # the music stops dead right before John's line (8 ms fade to avoid a click)
    i = sec(stop); f = sec(0.008)
    mix[:, i:i + f] *= np.linspace(1, 0, f)
    mix[:, i + f:] = 0
    return mix


# ----------------------------------------------------------------------- sfx
def curve(tl, key):
    return np.interp(np.arange(sec(tl['duration'])) / SR, np.array(tl['curves']['t']), np.array(tl['curves'][key], dtype=float))


def make_sfx(tl):
    dur = tl['duration']; n = sec(dur)
    out = np.zeros((2, n + SR * 3))
    t = np.arange(n) / SR
    B = tl['beat']
    slow = curve(tl, 'slow')
    carV = curve(tl, 'carV')
    carPan = curve(tl, 'carPan'); carDist = np.maximum(3.0, curve(tl, 'carDist'))
    prox = np.clip(14.0 / carDist, 0.25, 1.6)
    spin = curve(tl, 'spin'); fan = curve(tl, 'fan')
    thrB, thrS, thrF = curve(tl, 'thrBack'), curve(tl, 'thrSide'), curve(tl, 'thrFront')
    brake = curve(tl, 'brake'); yaw = curve(tl, 'carYaw')

    def put(x, pan_curve=None, gain=1.0):
        if pan_curve is None:
            out[0, :n] += x * gain * 0.707; out[1, :n] += x * gain * 0.707
        else:
            a = (np.clip(pan_curve, -1, 1) * 0.7 + 1) * np.pi / 4
            out[0, :n] += x * gain * np.cos(a); out[1, :n] += x * gain * np.sin(a)

    # 1) electric motor whine: pitch follows speed (+ wheelspin rev), slowed in slow motion
    acc = np.abs(np.gradient(lp(carV, 3), 1 / SR))
    rev = carV + 18 * spin
    f0 = (55 + 9.5 * rev) * slow
    ph = 2 * np.pi * np.cumsum(f0) / SR
    whine = np.sin(ph) * 0.5 + 0.25 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph + 1) + 0.08 * np.sin(7.5 * ph)
    inv = np.sin(8 * ph) * 0.06 * np.clip(acc / 15, 0, 1)
    amp = (0.12 + 0.55 * np.clip(acc / 20, 0, 1) + 0.25 * np.clip(rev / 30, 0, 1)) * (rev > 0.3) * prox
    amp = lp(amp, 8)
    put((whine + inv) * amp, carPan, 0.35)
    # wind/road noise with speed
    wind = lp(pink(n), 900) * lp(np.clip(carV / 30, 0, 1) ** 2, 4) * prox
    put(wind, carPan, 0.10)
    # 2) tyres spinning in sand: gritty pulsing noise + sprayed grains
    grit = bp(noise(n), 400, 3200) * (0.55 + 0.45 * np.sin(2 * np.pi * 37 * t) ** 2)
    grains = np.zeros(n)
    for ti in rng.uniform(6.7, 14.0, 900):
        i = sec(ti); ln = sec(0.006)
        if i + ln < n:
            grains[i:i + ln] += rng.uniform(0.3, 1.0) * np.exp(-np.arange(ln) / SR * 900) * rng.choice([-1, 1])
    grains = hp(grains, 2500)
    put((grit * 0.5 + grains * 1.4) * lp(spin, 6) * prox, carPan, 0.55)
    # 3) suction fan: whoosh up when it switches on, then a steady hum + air
    tf = B['fanOn']
    whoosh = riser(0.9, 1.0, 180, 2500)
    place(out, whoosh, tf - 0.15, 0.5, 0.0)
    fanrate = 57 * slow
    fph = 2 * np.pi * np.cumsum(fanrate) / SR
    hum = (np.sin(fph) * 0.5 + 0.3 * np.sin(2 * fph) + 0.15 * np.sin(3 * fph)) + lp(noise(n), 700) * 0.5
    spin_down = 1 - np.clip((t - B['carStop']) / 1.6, 0, 1) ** 0.7   # the fan winds down once the car stops
    put(hum * lp(fan, 4) * prox * spin_down, carPan, 0.10)
    # 4) paw thuds (from the gait), with a scuff of sand
    for p in tl['paws']:
        d = max(2.5, p['dist']); g = np.clip(10.0 / d, 0.15, 1.5) * (0.5 + 0.5 * min(1, p['v'] / 12))
        ln = sec(0.12); tt = np.arange(ln) / SR
        thud = np.sin(2 * np.pi * (70 + 30 * np.exp(-tt * 40)) * tt) * np.exp(-tt * 38)
        scuff = bp(noise(ln), 1800, 6500) * np.exp(-tt * 55) * 0.35
        place(out, thud + scuff, p['t'], 0.5 * g, np.clip(p['pan'], -1, 1) * 0.7)
    # 5) sand sprays: launch, corner slide, finish
    def spray(t0, t1, gain, pan=0.0, color=(1500, 7000)):
        ln = sec(t1 - t0); tt = np.arange(ln) / SR
        e = np.minimum(1, tt / 0.05) * np.exp(-tt * (2.0 / max(0.3, t1 - t0)))
        x = bp(noise(ln), *color) * (0.6 + 0.4 * np.abs(lp(noise(ln), 30)) * 2)
        place(out, x * e, t0, gain, pan)
    spray(B['launch'] - 0.02, B['launch'] + 0.9, 0.45)
    spray(B['carSlide'] + 0.2, B['sideThrEnd'] + 0.5, 0.35, 0.0, (900, 6000))
    spray(B['frontThr'], B['carStop'] + 0.3, 0.4, 0.0, (700, 5500))
    # sand trickling over the cliff edge
    spray(B['sideThr'] - 0.4, B['sideThrEnd'] + 0.6, 0.18, -0.2, (3000, 9000))
    # 6) thruster blasts: ignition whump + roaring jet (pitched down in slow motion)
    def thruster(curve_, t_on, gain):
        ln = sec(0.35); tt = np.arange(ln) / SR
        whump = np.sin(2 * np.pi * (45 + 60 * np.exp(-tt * 20)) * tt) * np.exp(-tt * 9) + bp(noise(ln), 300, 3000) * np.exp(-tt * 25) * 0.6
        place(out, whump, t_on, gain * 0.9, 0.0)
        flick = 1 + 0.25 * np.sin(2 * np.pi * np.cumsum(23 * slow) / SR) * np.sin(2 * np.pi * np.cumsum(7 * slow) / SR)
        roar_lo = lp(pink(n), 500 * (0.4 + 0.6 * slow).mean()) * 1.4
        hiss = bp(noise(n), 2500, 7500) * 0.35
        sub = np.sin(2 * np.pi * np.cumsum(38 * slow) / SR) * 0.4
        mix_ = (roar_lo + hiss * slow + sub) * flick
        put(mix_ * lp(curve_, 10) * prox, carPan, gain)
    thruster(thrS, B['sideThr'], 0.42)
    thruster(thrB, B['backThr'], 0.45)
    thruster(thrF, B['frontThr'], 0.45)
    # 7) water: the back blast throws the river up (slowed), sparkling drops, the landing
    tw = B['carLaunch']
    ln = sec(2.6); tt = np.arange(ln) / SR
    splash = lp(noise(ln), 1800) * np.exp(-tt * 1.6) * np.minimum(1, tt / 0.03)
    bub = sum(np.sin(2 * np.pi * f * tt * (1 + 0.3 * tt)) * np.exp(-tt * d) for f, d in ((420, 5), (610, 7), (880, 9), (1300, 12))) * 0.15
    place(out, lp(splash, 900) * 1.2 + bub, tw - 0.02, 0.55, -0.1)
    for i in range(42):  # drops plinking in slow motion
        tt0 = rng.uniform(tw + 0.3, B['land'] - 0.2)
        ln2 = sec(0.09); t2 = np.arange(ln2) / SR
        f = rng.uniform(1800, 4200)
        plink = np.sin(2 * np.pi * f * t2 * (1 + 2.5 * t2)) * np.exp(-t2 * 55)
        place(out, plink, tt0, rng.uniform(0.04, 0.11), rng.uniform(-0.8, 0.8))
    # landing thud + sand
    ln = sec(0.8); tt = np.arange(ln) / SR
    land = np.sin(2 * np.pi * (38 + 50 * np.exp(-tt * 12)) * tt) * np.exp(-tt * 6) + bp(noise(ln), 600, 4000) * np.exp(-tt * 8) * 0.4
    place(out, land, B['land'], 0.75, 0.0)
    spray(B['land'], B['land'] + 1.0, 0.3)
    # the cheetah's leap and the zip: whooshes
    def whoosh_(t0, d, gain, f0=300, f1=3000, pan=0.0):
        place(out, riser(d, 1.0, f0, f1) * np.hanning(sec(d)), t0, gain, pan)
    whoosh_(B['chLeap'] - 0.15, 0.7, 0.35, 250, 2200)
    whoosh_(B['zip'] - 0.05, 0.35, 0.55, 600, 6000, 0.3)
    zip_ = np.sin(2 * np.pi * np.cumsum(np.linspace(500, 2600, sec(0.22))) / SR) * np.hanning(sec(0.22))
    place(out, zip_, B['zip'], 0.18, 0.3)
    whoosh_(B['flagDrop'] - 0.12, 0.35, 0.25, 500, 3500, -0.3)
    whoosh_(B['finishCross'] - 0.25, 0.6, 0.4, 300, 3500)
    # 8) the big skid and spin-out: gritty scrape following the yaw rate
    yaw_rate = np.abs(np.gradient(lp(yaw, 6), 1 / SR))
    skid_amt = lp(np.clip(brake * 0.6 + yaw_rate / 2.5, 0, 1.4) * ((t > B['frontThr'] - 0.05) & (t < B['carStop'] + 0.4)), 8)
    scrape = bp(noise(n), 500, 3500) * (0.6 + 0.4 * np.abs(bp(noise(n), 8, 40)) * 3) + lp(pink(n), 250) * 0.8
    put(scrape * skid_amt * prox, carPan, 0.55)
    ln = sec(0.5); tt = np.arange(ln) / SR  # settle
    place(out, bp(noise(ln), 300, 2500) * np.exp(-tt * 9), B['carStop'] - 0.05, 0.3)
    # 9) panting: tired cheetah, then the stowaway (breath cycles match the animation)
    def pant(t0, t1, rate, gain, pan=0.0):
        for cyc in np.arange(t0, t1, 1.0 / rate):
            for k, (dt, g, f1, f2, dur_) in enumerate(((0.0, 1.0, 750, 1250, 0.13), (0.5 / rate, 0.55, 900, 1900, 0.1))):
                ln = sec(dur_); tt = np.arange(ln) / SR
                e = np.sin(np.pi * np.minimum(1, tt / dur_)) ** 1.5
                br = (bp(noise(ln), f1 * 0.8, f1 * 1.25) * 1.0 + bp(noise(ln), f2 * 0.85, f2 * 1.2) * 0.6 + hp(noise(ln), 3000) * 0.25) * e
                place(out, br, cyc + dt, gain * g * rng.uniform(0.85, 1.1), pan)
    pant(B['chSlow'] + 1.4, B['sly'] - 0.2, 10.5 / (2 * np.pi), 0.5, 0.0)
    pant(49.8, 54.65, 10.0 / (2 * np.pi), 0.26, 0.25)   # soft, so the silence after the music lands
    # 10) the seatbelt click: loud, crisp latch + clunk
    ln = sec(0.12); tt = np.arange(ln) / SR
    click = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt * d) for f, d in ((2550, 160), (4180, 220), (6330, 300), (8100, 380))) * 0.6
    clunk = np.sin(2 * np.pi * 820 * tt) * np.exp(-tt * 90) * 0.7 + bp(noise(ln), 1200, 6000) * np.exp(-tt * 260) * 0.8
    ring = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt * 45) for f in (3400, 5150)) * 0.25
    belt = np.zeros(sec(0.3)); belt[:ln] += clunk; belt[sec(0.016):sec(0.016) + ln] += click
    belt[sec(0.058):sec(0.058) + ln] += 0.8 * click + ring   # second "clack" as the latch seats
    belt = add_reverb(np.vstack([belt, belt]), wet=0.18, length=0.4, decay=12)[0]
    place(out, belt, B['click'], 1.0, 0.15)
    # ambience: soft savanna wind bed (quieter in slow motion, gone at the stare)
    amb = lp(pink(n), 600) * (0.6 + 0.4 * lp(np.abs(noise(n)), 0.3) * 4)
    amb_e = 1 - 0.5 * (slow < 0.9)
    put(amb * amb_e, None, 0.035)
    return out[:, :n]


def norm(x, peak=0.89):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def write(path, x):
    wavfile.write(path, SR, (np.clip(x, -1, 1).T * 32767).astype(np.int16))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--timeline', default=os.path.join(ROOT, 'work', 'timeline.json'))
    ap.add_argument('--script', default=os.path.join(ROOT, 'script', 'script.json'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'work'))
    a = ap.parse_args()
    tl = json.load(open(a.timeline))
    stop = json.load(open(a.script)).get('music_stop', tl['beat']['musicStop'])
    music = compose(tl['beat'], tl['duration'], stop)
    write(os.path.join(a.out, 'music.wav'), np.tanh(norm(music, 0.95) * 1.2) / np.tanh(1.2) * 0.89)
    sfx = make_sfx(tl)
    write(os.path.join(a.out, 'sfx.wav'), norm(sfx, 0.89))
    print('wrote music.wav and sfx.wav')


if __name__ == '__main__':
    main()
