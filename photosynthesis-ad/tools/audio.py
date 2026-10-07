"""Original score + sound design + voiceover mix for "Powered by Sunlight".

usage: python audio.py <cues.json> <vo_dir> <out.wav>

Everything is synthesised here (no samples): a soft, playful 120 BPM piece in
F major (marimba ostinato, celesta melody, plucked bass, warm pad, shaker),
delicate effects placed from the animation's cue list, and the voiceover with
the music ducked underneath. The music resolves on F major at 22.0 s, as the
end card settles, and rings out to 25.0 s.
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve, lfilter, resample_poly

SR = 48000
DUR = 25.0
N = int(SR * DUR)
BEAT = 0.5           # 120 BPM
BAR = 4 * BEAT
rng = np.random.default_rng(7)


def t_axis(d):
    return np.arange(int(d * SR)) / SR


def hz(note):
    """'F4' / 'Bb3' / 'C#5' -> Hz"""
    names = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    n = names[note[0]]
    i = 1
    if note[1] in "b#":
        n += -1 if note[1] == "b" else 1
        i = 2
    octv = int(note[i:])
    midi = 12 * (octv + 1) + n
    return 440.0 * 2 ** ((midi - 69) / 12)


def bp(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return sosfilt(sos, x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


class Bus:
    def __init__(self):
        self.L = np.zeros(N + SR * 4)
        self.R = np.zeros(N + SR * 4)

    def add(self, sig, t, gain=1.0, pan=0.0):
        i = int(round(t * SR))
        if i < 0:
            sig = sig[-i:]
            i = 0
        n = min(len(sig), len(self.L) - i)
        if n <= 0:
            return
        pan = max(-1.0, min(1.0, pan))
        a = (pan + 1) * np.pi / 4
        self.L[i:i + n] += sig[:n] * gain * np.cos(a)
        self.R[i:i + n] += sig[:n] * gain * np.sin(a)

    def st(self):
        return np.stack([self.L[:N], self.R[:N]], 1)


# ----------------------------------------------------------------- instruments
def marimba(f, vel=1.0, dur=1.6):
    t = t_axis(dur)
    dec = 0.55 * (440 / f) ** 0.35
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / dec)
         + 0.32 * np.sin(2 * np.pi * 3.98 * f * t) * np.exp(-t / (dec * 0.22))
         + 0.10 * np.sin(2 * np.pi * 9.9 * f * t) * np.exp(-t / 0.03))
    click = bp(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t / 0.004) * 0.12
    att = np.minimum(1, t / 0.0015)
    return (s + click) * att * vel


def celesta(f, vel=1.0, dur=2.4):
    t = t_axis(dur)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.9)
         + 0.22 * np.sin(2 * np.pi * 2 * f * t + 0.3) * np.exp(-t / 0.35)
         + 0.08 * np.sin(2 * np.pi * 4.07 * f * t) * np.exp(-t / 0.12)
         + 0.04 * np.sin(2 * np.pi * 6.1 * f * t) * np.exp(-t / 0.05))
    att = np.minimum(1, t / 0.002)
    return s * att * vel


def bell(f, vel=1.0, dur=3.0):
    t = t_axis(dur)
    parts = [(1, 1, 1.4), (2.76, 0.45, 0.55), (5.4, 0.22, 0.25), (8.93, 0.1, 0.12)]
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in parts)
    return s * np.minimum(1, t / 0.002) * vel


def pluck_bass(f, vel=1.0, dur=1.2):
    t = t_axis(dur)
    s = (np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.25)
         + 0.18 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.12))
    env = np.minimum(1, t / 0.006) * np.exp(-t / 0.55)
    thump = lp(rng.standard_normal(len(t)), 400) * np.exp(-t / 0.015) * 0.3
    return (s * env + thump) * vel


def pizz(f, vel=1.0, dur=0.9):
    """Karplus–Strong pluck (fast, via an IIR comb)."""
    n = int(dur * SR)
    p = SR / f
    d = int(p)
    frac = p - d
    x = np.zeros(n)
    burst = lp(rng.standard_normal(d), min(9000, f * 9))
    x[:d] = burst
    g = 0.994
    a = np.zeros(d + 2)
    a[0] = 1
    a[d] = -g * (1 - frac) * 0.5 - g * 0.5 * (1 - frac)
    a[d + 1] = -g * frac
    # simple averaged loop
    a = np.zeros(d + 2)
    a[0] = 1
    a[d] = -g * 0.5
    a[d + 1] = -g * 0.5
    y = lfilter([1.0], a, x)
    y = lp(y, 5200)
    y *= np.exp(-np.arange(n) / SR / 0.45)
    return y / (np.abs(y).max() + 1e-9) * vel


def pad_chord(notes, dur, vel=1.0, att=0.35, rel=0.6):
    t = t_axis(dur + rel)
    s = np.zeros(len(t))
    for nt in notes:
        f = hz(nt)
        for det in (-0.12, 0.12):
            ff = f * 2 ** (det / 12 / 4)
            ph = rng.uniform(0, 2 * np.pi)
            for k in range(1, 7):
                s += (1 / k ** 1.8) * np.sin(2 * np.pi * ff * k * t + ph * k)
    env = np.minimum(1, t / att) * np.where(t < dur, 1.0, np.exp(-(t - dur) / (rel / 3)))
    s = lp(s, 2600)
    return s * env * vel / (len(notes) * 2.5)


def shaker(vel=1.0):
    t = t_axis(0.12)
    s = bp(rng.standard_normal(len(t)), 5000, 11000) * np.minimum(1, t / 0.006) * np.exp(-t / 0.035)
    return s * vel


def tick_wood(f=1250, vel=1.0):
    t = t_axis(0.12)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.025) + 0.3 * bp(rng.standard_normal(len(t)), 1500, 4000) * np.exp(-t / 0.006)
    return s * vel


def soft_kick(vel=1.0):
    t = t_axis(0.35)
    f = 48 + 70 * np.exp(-t / 0.04)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.16) * np.minimum(1, t / 0.003) * vel


# ----------------------------------------------------------------- the score
def score():
    mus = Bus()
    # chords: (start_beat, length_beats, pad voicing, bass root, arpeggio tones)
    C = [
        (0, 4, ["F3", "C4", "G4", "A4"], None, None),                       # bar 0 intro
        (4, 2, ["Bb3", "D4", "F4", "A4"], None, ["Bb3", "F4", "A4", "D5"]),
        (6, 2, ["C4", "F4", "G4"], None, ["C4", "G4", "F4", "G4"]),
        (8, 4, ["F3", "A3", "C4", "E4"], "F2", ["F4", "C5", "A4", "C5"]),
        (12, 2, ["Bb3", "D4", "F4"], "Bb1", ["Bb3", "F4", "D4", "F4"]),
        (14, 2, ["C4", "E4", "G4"], "C2", ["C4", "G4", "E4", "G4"]),
        (16, 2, ["D4", "F4", "A4", "C5"], "D2", ["D4", "A4", "F4", "A4"]),
        (18, 2, ["Bb3", "D4", "F4", "A4"], "Bb1", ["Bb3", "F4", "D4", "F4"]),
        (20, 2, ["G3", "Bb3", "D4", "F4"], "G2", ["G3", "D4", "Bb3", "D4"]),
        (22, 2, ["C4", "F4", "G4", "Bb4"], "C2", ["C4", "G4", "F4", "G4"]),
        (24, 4, ["F3", "A3", "C4", "E4"], "F2", ["F4", "A4", "C5", "E5"]),  # inside the chloroplast
        (28, 2, ["Bb3", "D4", "F4", "A4"], "Bb1", ["Bb3", "F4", "A4", "F4"]),
        (30, 2, ["C4", "E4", "G4"], "C2", ["C4", "G4", "E4", "G4"]),
        (32, 2, ["F3", "A3", "C4", "F4"], "F2", ["F4", "C5", "A4", "C5"]),  # payoff
        (34, 2, ["E3", "G3", "C4", "E4"], "E2", ["E4", "C5", "G4", "C5"]),
        (36, 2, ["D3", "F3", "A3", "C4"], "D2", ["D4", "A4", "F4", "A4"]),
        (38, 2, ["Bb2", "D3", "F3", "A3"], "Bb1", ["Bb3", "F4", "D4", "F4"]),
        (40, 2, ["G3", "Bb3", "D4", "F4"], "G2", ["G3", "D4", "Bb3", "D4"]),
        (42, 1, ["C4", "F4", "G4", "Bb4"], "C2", ["C4", "G4"]),
        (43, 1, ["C4", "E4", "G4", "Bb4"], "C2", ["E4", "Bb4"]),
    ]
    for sb, lb, voicing, root, arp in C:
        t0 = sb * BEAT
        mus.add(pad_chord(voicing, lb * BEAT, vel=0.9), t0, gain=0.55, pan=0.0)
        if root:
            mus.add(pluck_bass(hz(root), 0.9), t0, gain=0.55, pan=-0.05)
            if lb >= 2 and t0 + 2 * BEAT < 21.5:
                mus.add(pluck_bass(hz(root), 0.6), t0 + 2 * BEAT, gain=0.45, pan=-0.05)
        if arp:
            for j in range(int(lb * 2)):
                tt = t0 + j * BEAT / 2
                note = arp[j % len(arp)]
                accent = 1.0 if j % 2 == 0 else 0.7
                mus.add(marimba(hz(note), 0.55 * accent), tt, gain=0.42, pan=0.25 if j % 2 else -0.15)
    # intro sparkle on the sun: rising celesta
    for i, (nt, tt) in enumerate([("F5", 0.25), ("A5", 0.55), ("C6", 0.8), ("F6", 1.05), ("A5", 1.5), ("C6", 1.75)]):
        mus.add(celesta(hz(nt), 0.7 - i * 0.05), tt, gain=0.35, pan=-0.2 + i * 0.08)
    # melody (beat positions on the timeline)
    mel = [
        (4.0, "C5"), (4.5, "A4"), (5.0, "C5"), (5.5, "F5"), (6.5, "E5"), (7.0, "C5"),
        (8.0, "D5"), (8.5, "F5"), (9.0, "D5"), (9.5, "Bb4"), (10.0, "C5"), (10.5, "E5"), (11.0, "G5"),
        (12.0, "F5"), (12.5, "E5"), (13.0, "D5"), (13.5, "A4"), (14.0, "D5"), (15.0, "F5"),
        (16.0, "G5"), (16.5, "F5"), (17.0, "D5"), (17.5, "Bb4"), (18.0, "C5"), (18.5, "F5"), (19.0, "G5"), (19.5, "A5"),
        (28.0, "D5"), (28.5, "C5"), (29.0, "Bb4"), (29.5, "D5"), (30.0, "E5"), (30.5, "G5"), (31.0, "C6"),
        (32.0, "A5"), (32.5, "G5"), (33.0, "F5"), (33.5, "C5"), (34.0, "G5"), (34.5, "F5"), (35.0, "E5"), (35.5, "C5"),
        (36.0, "F5"), (36.5, "A5"), (37.0, "G5"), (37.5, "F5"), (38.0, "D5"), (38.5, "F5"), (39.0, "Bb5"),
        (40.0, "A5"), (40.5, "G5"), (41.0, "F5"), (41.5, "D5"),
    ]
    for b, nt in mel:
        mus.add(celesta(hz(nt), 0.8), b * BEAT, gain=0.5, pan=0.12)
    # chloroplast bar: gentle 16th-note sparkle arpeggio
    sp = ["F5", "A5", "C6", "E6", "C6", "A5", "F5", "A5"]
    for j in range(32):
        tt = 12.0 + j * BEAT / 4
        if tt >= 16.0:
            break
        nt = sp[j % len(sp)] if tt < 14 else ["D5", "F5", "A5", "C6"][j % 4] if tt < 15 else ["E5", "G5", "C6", "G5"][j % 4]
        mus.add(celesta(hz(nt), 0.35, dur=1.0), tt, gain=0.3, pan=-0.35 if j % 2 else 0.35)
    # gather into the emblem: ascending harp-like run, then the resolution
    run = ["C5", "E5", "G5", "Bb5", "C6", "E6", "G6"]
    for i, nt in enumerate(run):
        mus.add(pizz(hz(nt), 0.6), 21.0 + i * 0.105, gain=0.32, pan=-0.3 + i * 0.1)
    # percussion
    for k in range(int(21.5 / (BEAT / 2))):
        tt = k * BEAT / 2
        if tt < 6.0:
            continue
        acc = 1.0 if k % 2 == 0 else 0.6
        g = 0.12 if tt < 16 else 0.16
        mus.add(shaker(acc), tt, gain=g, pan=0.35)
    for k in range(int(21.5 / BEAT)):
        tt = k * BEAT
        if tt >= 8.0 and k % 2 == 1:
            mus.add(tick_wood(1180 if k % 4 == 1 else 1320, 0.5), tt, gain=0.1, pan=-0.3)
        if 16.0 <= tt < 21.5 and k % 2 == 0:
            mus.add(soft_kick(0.8), tt, gain=0.22, pan=0)
    # final chord at 22.0 s: F major, rings out
    fin = 22.0
    mus.add(pad_chord(["F3", "A3", "C4", "F4", "A4"], 2.2, vel=1.0, att=0.08, rel=1.6), fin, gain=0.6)
    mus.add(pluck_bass(hz("F2"), 1.0, dur=2.8), fin, gain=0.6)
    for i, nt in enumerate(["F4", "A4", "C5", "F5"]):
        mus.add(marimba(hz(nt), 0.6, dur=2.6), fin + i * 0.03, gain=0.38, pan=-0.2 + i * 0.13)
    mus.add(bell(hz("F5"), 0.6, dur=3.0), fin, gain=0.32, pan=0.1)
    mus.add(bell(hz("C6"), 0.4, dur=3.0), fin + 0.04, gain=0.22, pan=-0.1)
    return mus


# ----------------------------------------------------------------- effects
def env_ad(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)


def fx(c):
    ty = c["type"]
    dur = c.get("dur", 0.5)
    soft = 0.6 if c.get("soft") else 1.0
    n = c.get("n", 0)
    if ty == "pop":
        t = t_axis(0.18)
        f = 700 + 900 * (1 - np.exp(-t / 0.02))
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(t), 0.002, 0.05)
        return s * 0.9, 0.5
    if ty == "swell":
        t = t_axis(dur + 0.4)
        s = bp(rng.standard_normal(len(t)), 2500, 9000) * 0.25
        for f in (hz("F5"), hz("C6"), hz("A6")):
            s += 0.18 * np.sin(2 * np.pi * f * t * (1 + 0.004 * np.sin(2 * np.pi * 5 * t)))
        e = np.sin(np.pi * np.clip(t / (dur + 0.4), 0, 1)) ** 1.5
        return s * e * soft, 0.35
    if ty == "scratch":
        t = t_axis(dur)
        nz = rng.standard_normal(len(t))
        s = bp(nz, 1800, 7000, 2)
        grain = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * (11 + 6 * rng.random()) * t + rng.random() * 6))
        fluct = lp(np.abs(rng.standard_normal(len(t))), 30)
        fluct /= fluct.max() + 1e-9
        e = np.minimum(1, t / 0.04) * np.minimum(1, (dur - t) / 0.08)
        return s * grain * (0.5 + 0.5 * fluct) * e * soft, 0.12
    if ty == "shimmer":
        t = t_axis(dur + 0.6)
        s = np.zeros(len(t))
        for i, nt in enumerate(["C6", "E6", "G6", "C7", "E7"]):
            on = i * dur / 6
            m = t >= on
            tt = t[m] - on
            s[m] += np.sin(2 * np.pi * hz(nt) * tt) * np.exp(-tt / 0.5) * 0.35
        return s * soft, 0.3
    if ty == "rustle":
        t = t_axis(dur)
        s = bp(rng.standard_normal(len(t)), 900, 5000)
        bumps = np.zeros(len(t))
        for k in range(5):
            c0 = rng.uniform(0.1, 0.8) * dur
            bumps += np.exp(-((t - c0) / 0.05) ** 2) * rng.uniform(0.5, 1)
        e = np.sin(np.pi * np.clip(t / dur, 0, 1))
        return s * (0.3 + bumps) * e * soft, 0.3
    if ty == "whoosh":
        t = t_axis(dur)
        nz = rng.standard_normal(len(t))
        out = np.zeros(len(t))
        seg = int(0.02 * SR)
        up = c.get("up", 1)
        for i in range(0, len(t), seg):
            fr = i / len(t)
            fc = 400 + 3000 * (fr if up else 1 - fr)
            out[i:i + seg] = bp(nz[max(0, i - 2000):i + seg], fc * 0.7, fc * 1.4)[-len(out[i:i + seg]):]
        e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
        g = 0.55 if c.get("big") else 0.4
        return out * e * g, 0.4
    if ty == "sparkle":
        t = t_axis(0.8)
        s = np.zeros(len(t))
        for i, nt in enumerate(["A6", "C7", "E7", "A7", "E7"]):
            on = i * 0.045
            m = t >= on
            tt = t[m] - on
            s[m] += np.sin(2 * np.pi * hz(nt) * tt) * np.exp(-tt / 0.18) * 0.3
        return s, 0.35
    if ty == "soak":
        t = t_axis(dur)
        s = lp(rng.standard_normal(len(t)), 900) * 0.6 + 0.4 * np.sin(2 * np.pi * 110 * t) * np.exp(-t / 0.5)
        f = 180 + 120 * t / dur
        s += 0.35 * np.sin(2 * np.pi * np.cumsum(f) / SR)
        e = np.minimum(1, t / 0.08) * np.exp(-t / (dur * 0.5))
        return s * e, 0.35
    if ty == "tick":
        f = [2200, 2500, 2800, 2350, 2650, 2950, 3100][n % 7]
        t = t_axis(0.1)
        s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.018) + 0.25 * bp(rng.standard_normal(len(t)), 3000, 8000) * np.exp(-t / 0.004)
        return s * soft, 0.28
    if ty in ("plip", "bloop"):
        base = (620 if ty == "plip" else 380) * (1 + 0.12 * (n % 3))
        t = t_axis(0.16)
        f = base * (1 + 1.3 * (1 - np.exp(-t / 0.018)))
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(t), 0.001, 0.045)
        return s * soft, 0.5 if ty == "plip" else 0.3
    if ty == "puff":
        t = t_axis(0.3)
        s = bp(rng.standard_normal(len(t)), 500, 2500) * env_ad(len(t), 0.05, 0.08)
        return s * soft, 0.22
    if ty == "ping":
        notes = ["A5", "C6", "E6", "F5", "C6", "A5", "F5"]
        return bell(hz(notes[n % len(notes)]), 1.0, 1.6) * (0.55 if c.get("soft") else 1.0), 0.32
    if ty == "bubble":
        t = t_axis(0.2)
        base = 300 * (1 + 0.15 * (n % 4))
        f = base * (1 + 2.0 * (t / 0.2) ** 0.7)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(t), 0.004, 0.06)
        return s * soft, 0.42
    if ty == "clink":
        t = t_axis(0.8)
        f0 = hz("C7") if n % 2 == 0 else hz("E7")
        s = np.sin(2 * np.pi * f0 * t) * np.exp(-t / 0.25) + 0.5 * np.sin(2 * np.pi * f0 * 2.41 * t) * np.exp(-t / 0.09)
        return s, 0.3
    if ty == "gather":
        t = t_axis(dur)
        s = np.zeros(len(t))
        nz = rng.standard_normal(len(t))
        s += bp(nz, 1200, 6000) * (t / dur) ** 2 * 0.35
        return s, 0.35
    if ty == "chime":
        return bell(hz("F6"), 0.7, 2.5), 0.18
    return None, 0


# ----------------------------------------------------------------- reverb
def reverb_ir(rt=1.6, pre=0.012):
    n = int((rt + 0.2) * SR)
    t = np.arange(n) / SR
    irs = []
    for ch in range(2):
        r = np.random.default_rng(100 + ch)
        nz = r.standard_normal(n) * np.exp(-6.9 * t / rt)
        nz = lp(nz, 6500)
        nz[: int(pre * SR)] = 0
        for d, g in [(0.017, 0.5), (0.029, 0.35), (0.041, 0.3), (0.053, 0.2)]:
            k = int((d + ch * 0.003) * SR)
            nz[k] += g * 3
        irs.append(nz / np.sqrt(np.sum(nz ** 2)))
    return irs


def apply_reverb(st, wet, rt=1.6):
    irs = reverb_ir(rt)
    out = np.zeros_like(st)
    for ch in range(2):
        out[:, ch] = fftconvolve(st[:, ch], irs[ch])[: len(st)]
    return st + wet * out


# ----------------------------------------------------------------- main
def main():
    cues_path, vo_dir, out = sys.argv[1], sys.argv[2], sys.argv[3]
    cues = json.load(open(cues_path))
    timing = json.load(open(os.path.join(vo_dir, "vo_timing.json")))

    # music
    mus = score().st()
    mus = apply_reverb(mus, 0.35, 1.7)
    # gentle overall fade at the very end so the tail resolves to silence
    tt = np.arange(N) / SR
    mus *= np.clip((25.0 - tt) / 1.6, 0, 1)[:, None] ** 1.2

    # effects
    fxb = Bus()
    for c in cues:
        ty = c["type"]
        if ty in ("type",):
            continue
        t0 = c["t"]
        if ty == "chime":
            t0 = 22.0
        sig, g = fx(c)
        if sig is None:
            continue
        fxb.add(sig, t0, gain=g, pan=0.8 * c.get("x", 0.0))
    fx_st = apply_reverb(fxb.st(), 0.25, 1.2)

    # voiceover
    vo = np.zeros(N)
    for L in timing:
        a, sr = sf.read(os.path.join(vo_dir, L["id"] + ".wav"), dtype="float64")
        if a.ndim > 1:
            a = a.mean(1)
        a = resample_poly(a, SR, sr)
        a = hp(a, 70)
        i = int(round(L["start"] * SR))
        vo[i:i + len(a)] += a[: max(0, min(len(a), N - i))]
    # gentle compression on the voice (smoothed peak follower)
    envv = np.abs(vo)
    envv = lfilter([0.002], [1, -0.998], envv)
    gain = np.where(envv > 0.12, (0.12 / np.maximum(envv, 1e-9)) ** 0.35, 1.0)
    vo = vo * gain
    vo = vo / (np.abs(vo).max() + 1e-9) * 0.92
    # a whisper of room on the voice
    vo_st = np.stack([vo, vo], 1)
    vo_st = apply_reverb(vo_st, 0.06, 0.6)

    # ducking: music and effects dip under the voice
    act = lfilter([0.004], [1, -0.996], (np.abs(vo) > 0.02).astype(float))
    act = np.clip(act * 3, 0, 1)
    duck_m = 1 - 0.5 * act
    duck_f = 1 - 0.3 * act

    mix = vo_st * 1.0 + mus * 0.5 * duck_m[:, None] + fx_st * 0.55 * duck_f[:, None]
    # soft limiter
    peak = np.abs(mix).max()
    mix = mix / peak * 0.89
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    # 10 ms fades at the edges
    f = int(0.01 * SR)
    mix[:f] *= np.linspace(0, 1, f)[:, None]
    mix[-f:] *= np.linspace(1, 0, f)[:, None]
    sf.write(out, mix.astype(np.float32), SR, subtype="FLOAT")
    # stems for reference
    base = os.path.splitext(out)[0]
    sf.write(base + "_music.wav", (mus * 0.5).astype(np.float32), SR, subtype="FLOAT")
    sf.write(base + "_fx.wav", (fx_st * 0.55).astype(np.float32), SR, subtype="FLOAT")
    sf.write(base + "_vo.wav", vo_st.astype(np.float32), SR, subtype="FLOAT")
    print("wrote", out, mix.shape, "peak", float(np.abs(mix).max()))


if __name__ == "__main__":
    main()
