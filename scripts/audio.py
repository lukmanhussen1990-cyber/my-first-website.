#!/usr/bin/env python3
"""Music + SFX + mix -> build/mix.wav (48 kHz stereo, -14 LUFS, true peak <= -1 dBTP).

Everything is synthesized here (royalty-free by construction) and placed from build/cues.json,
which the render page exports from the same timeline that drives the picture.
  music : ambient pad + felt-piano arpeggio; hopeful (D major) -> tense (B minor, S12-S14)
          -> warm resolve (G/D major, S15+) -> soft end + outro bloom; ducked -8 dB under the voice
  sfx   : hammer taps, crowd laughter/murmur, animal steps & calls, wood creaks, door thud,
          rain/thunder/sea, shimmer on light moments, paper slide on Scripture cards, whooshes,
          soft pops on highlight words, typing ticks, hearts, chime
"""
import json, os, subprocess, sys
import numpy as np
import soundfile as sf
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build")
SR = 48000
RNG = np.random.default_rng(616)

cues = json.load(open(os.path.join(B, "cues.json")))
voice, vsr = sf.read(os.path.join(B, "voice.wav"), dtype="float32")
assert vsr == SR
if voice.ndim > 1:
    voice = voice.mean(1)
DUR = max(cues["duration"], len(voice) / SR)
N = int(np.ceil(DUR * SR))
voice = np.pad(voice, (0, N - len(voice)))


# ---------------------------------------------------------------- helpers
def t_axis(n):
    return np.arange(n) / SR


def sos_band(lo, hi, order=2):
    return signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(sos_band(lo, hi, order), x, axis=0)


def noise(n, seed=None):
    r = np.random.default_rng(seed) if seed is not None else RNG
    return r.standard_normal(n).astype(np.float32)


def pink(n, seed=None):
    w = noise(n, seed)
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w).astype(np.float32) * 6


def env_ad(n, a, d, curve=4.0):
    t = t_axis(n)
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) * curve / max(d, 1e-4))
    return e.astype(np.float32)


def fade(n, fi, fo):
    e = np.ones(n, np.float32)
    a, b = int(fi * SR), int(fo * SR)
    if a > 0:
        e[:a] = np.linspace(0, 1, a) ** 1.5
    if b > 0:
        e[-b:] *= np.linspace(1, 0, b) ** 1.5
    return e


def place(bus, sig, t, gain=1.0, pan=0.0):
    """Add mono (or stereo) sig at time t with equal-power pan (-1..1)."""
    i = int(round(t * SR))
    if i >= len(bus):
        return
    if i < 0:
        sig = sig[-i:]
        i = 0
    sig = sig[: len(bus) - i]
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        bus[i:i + len(sig), 0] += sig * np.cos(a) * gain
        bus[i:i + len(sig), 1] += sig * np.sin(a) * gain
    else:
        bus[i:i + len(sig)] += sig * gain


def reverb_ir(seconds=2.2, seed=3, damp=5000):
    n = int(seconds * SR)
    t = t_axis(n)
    e = np.exp(-t * 6.9 / seconds)
    ir = np.stack([lp(noise(n, seed) * e, damp), lp(noise(n, seed + 1) * e, damp)], 1)
    pre = int(0.022 * SR)
    ir = np.vstack([np.zeros((pre, 2), np.float32), ir])
    return ir / np.sqrt((ir ** 2).sum(0, keepdims=True))


def reverb(x, ir, wet):
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x + y * wet


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def nm(s):  # "F#3" -> midi
    name, octv = s[:-1], int(s[-1])
    return 12 * (octv + 1) + NOTE[name]


# ---------------------------------------------------------------- music
def pad_chord(notes, dur, bright=1.0, seed=0):
    n = int(dur * SR)
    t = t_axis(n)
    out = np.zeros((n, 2), np.float32)
    r = np.random.default_rng(seed)
    for m in notes:
        f = midi(m)
        for det, pan in ((-5, -0.6), (5, 0.6), (0, 0.0)):
            ff = f * 2 ** (det / 1200)
            ph = 2 * np.pi * ff * t + r.uniform(0, 6.28)
            s = np.zeros(n, np.float32)
            for k in range(1, 9):
                if ff * k > 9000:
                    break
                s += np.sin(k * ph) / k * np.exp(-k / (2.0 * bright))
            vib = 1 + 0.0025 * np.sin(2 * np.pi * (0.2 + 0.05 * r.random()) * t)
            s *= vib
            a = (pan + 1) * np.pi / 4
            out[:, 0] += s * np.cos(a)
            out[:, 1] += s * np.sin(a)
    return out / max(1, len(notes))


def piano(m, dur=2.2, vel=1.0):
    n = int(dur * SR)
    t = t_axis(n)
    f = midi(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t * 3) + 0.12 * np.sin(6 * np.pi * f * t) * np.exp(-t * 5)
    e = (1 - np.exp(-t / 0.006)) * np.exp(-t * 2.2)
    return (lp(s * e, 3500) * vel).astype(np.float32)


def bell(f, dur=2.5):
    n = int(dur * SR)
    t = t_axis(n)
    s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 2) + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 4)
    return (s * (1 - np.exp(-t / 0.003)) * np.exp(-t * 1.6)).astype(np.float32)


def build_music():
    mus = np.zeros((N, 2), np.float32)
    sec = {m["section"]: m["t"] for m in cues["music"]}
    t_tense, t_res, t_end, t_out = sec["tense"], sec["resolve"], sec["end"], sec["outro"]
    # progressions: (start, end, [(chord notes, arpeggio notes)], chord length, brightness, level)
    D = (["D3", "A3", "D4", "F#4"], ["D4", "A4", "F#5", "A4", "D5", "A4"])
    Bm = (["B2", "F#3", "B3", "D4"], ["B3", "F#4", "D5", "F#4", "B4", "F#4"])
    G = (["G2", "D3", "G3", "B3"], ["G3", "D4", "B4", "D4", "G4", "D4"])
    A = (["A2", "E3", "A3", "C#4"], ["A3", "E4", "C#5", "E4", "A4", "E4"])
    Em = (["E2", "B2", "E3", "G3"], ["E3", "B3", "G4", "B3", "E4", "B3"])
    Fs = (["F#2", "C#3", "F#3", "A#3"], ["F#3", "C#4", "A#4", "C#4", "F#4", "C#4"])
    Dfs = (["F#2", "D3", "A3", "D4"], ["F#3", "D4", "A4", "D4", "F#4", "D4"])
    Gadd = (["G2", "D3", "A3", "B3"], ["G3", "D4", "A4", "B4", "D5", "A4"])
    secs = [
        (0.0, t_tense, [D, Bm, G, A], 3.3, 1.0, 1.0, True),
        (t_tense, t_res, [Bm, G, Em, Fs], 2.0, 0.6, 0.95, False),
        (t_res, t_end, [G, Dfs, Em, A, G, D], 2.35, 1.25, 1.05, True),
        (t_end, t_out, [Bm, Gadd], 2.8, 0.9, 0.85, True),
        (t_out, DUR, [D], DUR - t_out + 0.5, 1.3, 1.0, False),
    ]
    beat = 60 / 72 / 2  # eighth notes at 72 bpm
    for si, (s0, s1, prog, clen, bright, lvl, arp) in enumerate(secs):
        t = s0
        k = 0
        while t < s1 - 0.05:
            chord, arpn = prog[k % len(prog)]
            dur = min(clen, s1 - t) + 1.4
            pc = pad_chord([nm(x) for x in chord], dur, bright, seed=si * 100 + k)
            e = fade(len(pc), 0.9, 1.3)
            place(mus, pc * e[:, None], t - 0.25, 0.32 * lvl)
            if arp:
                nb = int(min(clen, s1 - t) / beat)
                for j in range(nb):
                    if (j + k) % 3 == 2 and si != 3:
                        continue
                    m = nm(arpn[j % len(arpn)])
                    v = 0.55 + 0.25 * ((j % 4) == 0)
                    place(mus, piano(m, 2.0, v), t + j * beat + 0.01 * np.sin(j), 0.10 * lvl, pan=0.35 * np.sin(j * 1.7))
            t += clen
            k += 1
    # tense section: low pulse + drone
    n = int((t_res - t_tense + 0.8) * SR)
    tt = t_axis(n)
    drone = (np.sin(2 * np.pi * midi(nm("B1")) * tt) + 0.4 * np.sin(2 * np.pi * midi(nm("F#2")) * tt)) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.5 * tt))
    pulse = np.zeros(n, np.float32)
    for b in np.arange(0, n / SR, 1.0):
        i = int(b * SR)
        k2 = env_ad(int(0.5 * SR), 0.01, 0.35) * np.sin(2 * np.pi * 55 * t_axis(int(0.5 * SR)))
        pulse[i:i + len(k2)] += k2[: n - i]
    swell = np.clip((tt - (n / SR - 3.0)) / 3.0, 0, 1) ** 2
    place(mus, (drone * fade(n, 1.2, 1.0) * (0.6 + 0.6 * swell) * 0.22 + pulse * 0.35 * fade(n, 0.5, 1.5)).astype(np.float32), t_tense, 1.0)
    # resolve shimmer (high octave pad)
    n = int((t_end - t_res) * SR)
    shim = pad_chord([nm("D5"), nm("A5"), nm("F#5")], n / SR, 1.6, seed=77)
    place(mus, shim * fade(n, 2.5, 2.0)[:, None], t_res, 0.07)
    # outro bloom + bell
    for i, f in enumerate([nm("D5"), nm("A5"), nm("D6"), nm("F#6")]):
        place(mus, bell(midi(f), 3.0), t_out + 0.25 + i * 0.11, 0.08, pan=-0.4 + 0.27 * i)
    # gentle swells into Scripture / key moments
    mus *= 1.0
    return mus


# ---------------------------------------------------------------- sfx one-shots
def s_hammer(nail=False, short=False, seed=0):
    r = np.random.default_rng(seed)
    n = int(0.45 * SR)
    t = t_axis(n)
    p = 1 + r.uniform(-0.08, 0.08)
    thump = np.sin(2 * np.pi * 140 * p * t) * np.exp(-t * 45)
    knock = np.sin(2 * np.pi * 430 * p * t) * np.exp(-t * 32) * 0.7 + np.sin(2 * np.pi * 760 * p * t) * np.exp(-t * 55) * 0.4
    click = bp(noise(n, seed), 900, 4200) * np.exp(-t * 90) * 0.9
    s = thump * 0.8 + knock + click
    if nail:
        s += (np.sin(2 * np.pi * 2900 * t) + 0.6 * np.sin(2 * np.pi * 4420 * t)) * np.exp(-t * 9) * 0.22
    if short:
        s *= np.exp(-t * 10)
    return s.astype(np.float32)


def s_whoosh(dur=0.6, seed=0):
    n = int(dur * SR)
    t = t_axis(n) / dur
    w = noise(n, seed)
    lo = bp(w, 180, 700) * np.exp(-((t - 0.35) / 0.25) ** 2)
    mid = bp(w, 700, 2200) * np.exp(-((t - 0.5) / 0.18) ** 2)
    hi = bp(w, 2200, 6000) * np.exp(-((t - 0.58) / 0.12) ** 2) * 0.6
    return ((lo + mid + hi) * 0.9).astype(np.float32)


def s_pop(seed=0):
    n = int(0.12 * SR)
    t = t_axis(n)
    f = 720 * np.exp(-t * 9) + 300
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * env_ad(n, 0.003, 0.06, 5)).astype(np.float32)


def s_paper(seed=0):
    n = int(0.55 * SR)
    t = t_axis(n)
    w = noise(n, seed)
    flutter = 0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 37 * t + np.sin(2 * np.pi * 9 * t)))
    e = np.minimum(1, t / 0.06) * np.exp(-np.maximum(0, t - 0.18) * 9)
    return ((bp(w, 1800, 7500) * 0.7 + bp(w, 300, 1200) * 0.4) * flutter * e).astype(np.float32)


def s_shimmer(seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros(int(2.6 * SR), np.float32)
    for i, m in enumerate(r.permutation([nm("D6"), nm("F#6"), nm("A6"), nm("B6"), nm("D7"), nm("E6")])):
        b = bell(midi(m), 2.0) * 0.5
        i0 = int(i * 0.075 * SR)
        out[i0:i0 + len(b)] += b[: len(out) - i0]
    return out


def s_chime():
    out = np.zeros(int(3.5 * SR), np.float32)
    for i, m in enumerate([nm("D5"), nm("A5"), nm("D6")]):
        b = bell(midi(m), 3.0)
        i0 = int(i * 0.09 * SR)
        out[i0:i0 + len(b)] += b * 0.6
    return out


def s_tick(seed=0):
    n = int(0.03 * SR)
    t = t_axis(n)
    return ((bp(noise(n, seed), 2000, 8000) * np.exp(-t * 400) + np.sin(2 * np.pi * 1300 * t) * np.exp(-t * 250) * 0.4)).astype(np.float32)


def s_heart(seed=0):
    n = int(0.14 * SR)
    t = t_axis(n)
    f = 800 + 600 * (t / t[-1])
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(n, 0.004, 0.08, 5)).astype(np.float32)


def s_door(seed=0):
    n = int(1.2 * SR)
    t = t_axis(n)
    boom = np.sin(2 * np.pi * 58 * t) * np.exp(-t * 5)
    wood = np.sin(2 * np.pi * 175 * t) * np.exp(-t * 14) * 0.6
    body = lp(noise(n, seed), 400) * np.exp(-t * 18) * 0.8
    latch = bp(noise(n, seed + 1), 2000, 6000) * np.exp(-np.maximum(0, t - 0.09) * 120) * (t > 0.09) * 0.25
    return (boom + wood + body + latch).astype(np.float32)


def s_creak(dur=1.0, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    imp = np.zeros(n, np.float32)
    t = 0.0
    while t < dur:
        u = t / dur
        rate = 35 + 55 * np.sin(np.pi * u) + r.uniform(-8, 8)
        i = int(t * SR)
        if i < n:
            imp[i] = 1 + 0.4 * r.standard_normal()
        t += 1.0 / max(15, rate)
    s = bp(imp, 450, 750, 2) * 3 + bp(imp, 1000, 1300, 2) * 1.5
    return (s * fade(n, 0.1, 0.25)).astype(np.float32)


def s_thunder(near=True, seed=0):
    r = np.random.default_rng(seed)
    n = int(4.5 * SR)
    t = t_axis(n)
    rum = np.zeros(n, np.float32)
    for k in range(6):
        t0 = r.uniform(0, 1.6) + (0 if near else 0.3)
        e = np.exp(-np.maximum(0, t - t0) * r.uniform(1.2, 2.5)) * (t > t0)
        rum += e * r.uniform(0.4, 1.0)
    s = lp(noise(n, seed), 180 if not near else 320, 4) * rum * 2.5
    if near:
        s += hp(noise(n, seed + 5), 900) * np.exp(-t * 18) * 0.9
    return s.astype(np.float32)


def s_trumpet():
    n = int(1.0 * SR)
    t = t_axis(n)
    f = 430 + 160 * np.minimum(1, t / 0.35) + 12 * np.sin(2 * np.pi * 7 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = sum(np.sin(k * ph) / k for k in range(1, 12))
    return (bp(saw, 450, 2600) * fade(n, 0.06, 0.4)).astype(np.float32)


def s_coo():
    out = []
    for f0, d in ((520, 0.22), (560, 0.4)):
        n = int(d * SR)
        t = t_axis(n)
        f = f0 * (1 - 0.06 * t / d)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 1.5
        out.append(s)
        out.append(np.zeros(int(0.06 * SR)))
    return np.concatenate(out).astype(np.float32)


def vowel(pitch, dur, formants=((750, 1.0), (1200, 0.6), (2500, 0.25)), seed=0, glide=-0.15, breath=0.2):
    n = int(dur * SR)
    t = t_axis(n)
    f = pitch * (1 + glide * t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    src = sum(np.sin(k * ph) / k ** 1.2 for k in range(1, 25) if pitch * k < 8000)
    src = src + breath * noise(n, seed)
    s = sum(a * bp(src, fc * 0.85, fc * 1.15) for fc, a in formants)
    return s.astype(np.float32)


def s_baa():
    n = int(0.65 * SR)
    t = t_axis(n)
    v = vowel(390, 0.65, ((700, 1.0), (1100, 0.6), (2600, 0.3)), glide=-0.1, breath=0.1)
    return (v * (1 + 0.3 * np.sin(2 * np.pi * 9 * t)) * fade(n, 0.05, 0.25)).astype(np.float32)


# ---------------------------------------------------------------- beds
def bed_laugh(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros((n, 2), np.float32)
    for v in range(9):
        pitch = r.uniform(150, 330)
        pan = r.uniform(-0.8, 0.8)
        t = r.uniform(0, 0.8)
        while t < dur:
            k = r.integers(3, 8)
            per = r.uniform(0.15, 0.21)
            for j in range(k):
                d = per * 0.75
                syl = vowel(pitch * (1.08 - 0.03 * j), d, seed=int(r.integers(1e6)), glide=-0.2, breath=0.35)
                syl *= env_ad(len(syl), 0.012, d * 0.7, 3)
                place(out, syl, t + j * per, 0.5 * (1 - 0.08 * j), pan)
            t += k * per + r.uniform(0.4, 1.6)
    out += np.stack([bp(pink(n, seed + 9), 200, 1500)] * 2, 1) * 0.05
    return out


def bed_murmur(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros((n, 2), np.float32)
    vowels = [((750, 1), (1200, .6), (2500, .2)), ((400, 1), (2000, .5), (2600, .2)), ((500, 1), (900, .6), (2400, .2)), ((300, 1), (2300, .5), (3000, .2))]
    for v in range(6):
        pitch = r.uniform(110, 230)
        pan = r.uniform(-0.7, 0.7)
        t = r.uniform(0, 0.5)
        while t < dur:
            d = r.uniform(0.09, 0.18)
            syl = vowel(pitch * r.uniform(0.9, 1.15), d, vowels[r.integers(4)], seed=int(r.integers(1e6)), glide=r.uniform(-0.2, 0.15), breath=0.25)
            syl *= np.sin(np.pi * t_axis(len(syl)) / d)
            place(out, syl, t, 0.32, pan)
            t += d + (r.uniform(0.02, 0.08) if r.random() > 0.15 else r.uniform(0.3, 0.8))
    return lp(out, 2500)


def bed_birds(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros((n, 2), np.float32)
    t = 0.3
    while t < dur:
        f0 = r.uniform(2800, 5200)
        pan = r.uniform(-0.9, 0.9)
        for j in range(r.integers(2, 5)):
            d = r.uniform(0.04, 0.09)
            m = int(d * SR)
            tt = t_axis(m)
            f = f0 * (1 + r.uniform(0.15, 0.4) * tt / d)
            s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / d)
            place(out, s.astype(np.float32), t + j * (d + 0.035), 0.25, pan)
        t += r.uniform(0.5, 1.6)
    return out


def bed_steps(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros((n, 2), np.float32)
    t = 0.0
    while t < dur:
        m = int(0.18 * SR)
        tt = t_axis(m)
        heavy = r.random() < 0.4
        s = np.sin(2 * np.pi * (70 if heavy else 110) * tt) * np.exp(-tt * (18 if heavy else 30)) + lp(noise(m, int(r.integers(1e6))), 600) * np.exp(-tt * 40) * 0.6
        if not heavy:
            s += bp(noise(m, int(r.integers(1e6))), 1000, 2500) * np.exp(-tt * 70) * 0.35
        place(out, s.astype(np.float32), t, 0.55 if heavy else 0.4, r.uniform(-0.6, 0.6))
        t += r.uniform(0.12, 0.32)
    return out


def bed_wind(dur, seed=0):
    n = int(dur * SR)
    t = t_axis(n)
    gust = 0.55 + 0.45 * np.sin(2 * np.pi * 0.13 * t + 1) * np.sin(2 * np.pi * 0.07 * t)
    L = bp(pink(n, seed), 150, 900) * gust
    R = bp(pink(n, seed + 1), 150, 900) * gust[::-1]
    return np.stack([L, R], 1) * 0.6


def bed_rain(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    hiss = np.stack([bp(noise(n, seed), 1200, 9000), bp(noise(n, seed + 1), 1200, 9000)], 1) * 0.35
    roar = np.stack([lp(pink(n, seed + 2), 500)] * 2, 1) * 0.5
    drops = np.zeros((n, 2), np.float32)
    for _ in range(int(dur * 60)):
        i = int(r.uniform(0, n - 400))
        m = 300
        d = bp(noise(m, int(r.integers(1e6))), 2500, 7000) * np.exp(-t_axis(m) * 400)
        c = int(r.integers(2))
        drops[i:i + m, c] += d * r.uniform(0.2, 0.6)
    ramp = np.minimum(1, t_axis(n) / 2.0)[:, None]
    return (hiss + roar + drops) * ramp


def bed_sea(dur, seed=0):
    n = int(dur * SR)
    t = t_axis(n)
    sw = 0.5 + 0.5 * np.sin(2 * np.pi * 0.35 * t) ** 2
    low = lp(pink(n, seed), 380) * sw
    foam = bp(noise(n, seed + 1), 1500, 6000) * np.maximum(0, np.sin(2 * np.pi * 0.35 * t)) ** 6 * 0.4
    return np.stack([low + foam, low * 0.9 + foam * 1.1], 1)


def bed_city(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    hum = np.stack([lp(pink(n, seed), 160)] * 2, 1) * 0.6
    out = hum.copy()
    t = 0.2
    while t < dur:
        d = r.uniform(2.5, 4.0)
        m = int(d * SR)
        tt = t_axis(m) / d
        car = bp(noise(m, int(r.integers(1e6))), 200, 1600) * np.exp(-((tt - 0.5) / 0.22) ** 2)
        pan0 = r.choice([-1, 1])
        a = (pan0 * (1 - 2 * tt) + 1) * np.pi / 4
        st = np.stack([car * np.cos(a), car * np.sin(a)], 1) * 0.35
        i = int(t * SR)
        out[i:i + m] += st[: n - i]
        t += r.uniform(1.2, 2.6)
    return out


def bed_lamp(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tone = np.stack([bp(pink(n, seed), 60, 220)] * 2, 1) * 0.5
    for _ in range(int(dur * 9)):
        i = int(r.uniform(0, n - 200))
        tone[i:i + 120, int(r.integers(2))] += bp(noise(120, int(r.integers(1e6))), 2000, 6000) * r.uniform(0.1, 0.4)
    return tone


BEDS = {"laugh": bed_laugh, "murmur": bed_murmur, "birds": bed_birds, "footsteps": bed_steps, "wind": bed_wind,
        "rain": bed_rain, "sea": bed_sea, "city": bed_city, "lamp": bed_lamp}
BED_GAIN = {"laugh": 0.16, "murmur": 0.12, "birds": 0.1, "footsteps": 0.16, "wind": 0.07, "rain": 0.12, "sea": 0.14, "city": 0.09, "lamp": 0.1}


def build_sfx():
    sfx = np.zeros((N, 2), np.float32)
    for i, c in enumerate(cues["cues"]):
        ty, t, g = c["type"], c["t"], c.get("gain", 1)
        if ty == "hammer":
            place(sfx, s_hammer(c.get("nail", False), c.get("short", False), seed=i), t - 0.005, 0.30 * g, pan=-0.25)
        elif ty == "whoosh":
            place(sfx, s_whoosh(0.6, seed=i), t - 0.15, 0.10 * g, pan=0.0)
        elif ty == "pop":
            place(sfx, s_pop(i), t, 0.045 * g)
        elif ty == "paper":
            place(sfx, s_paper(i), t, 0.16 * g, pan=0.1)
        elif ty == "shimmer":
            place(sfx, s_shimmer(i), t, 0.07 * g, pan=0.15)
        elif ty == "chime":
            place(sfx, s_chime(), t, 0.10 * g)
        elif ty == "tick":
            place(sfx, s_tick(i), t, 0.10 * g, pan=0.2)
        elif ty == "heart":
            place(sfx, s_heart(i), t, 0.05 * g, pan=0.45)
        elif ty == "door_thud":
            place(sfx, s_door(i), t, 0.42 * g, pan=0.15)
        elif ty == "creak":
            place(sfx, s_creak(1.1, i), t, 0.10 * g, pan=-0.3)
        elif ty == "thunder":
            place(sfx, s_thunder(g > 0.6, i), t, 0.55 * g, pan=-0.2)
        elif ty == "trumpet":
            place(sfx, s_trumpet(), t, 0.10 * g, pan=0.4)
        elif ty == "coo":
            place(sfx, s_coo(), t, 0.10 * g, pan=-0.3)
        elif ty == "baa":
            place(sfx, s_baa(), t, 0.12 * g, pan=0.3)
    for j, b in enumerate(cues["beds"]):
        d = b["t1"] - b["t0"]
        if d <= 0.05:
            continue
        sig = BEDS[b["type"]](d + 0.1, seed=50 + j)[: int(d * SR)]
        e = fade(len(sig), 0.4, 0.5)[:, None]
        place(sfx, sig * e, b["t0"], BED_GAIN[b["type"]] * b.get("gain", 1))
    return sfx


# ---------------------------------------------------------------- mix
def duck_curve(v, depth_db=-8.0):
    win = int(0.04 * SR)
    pw = np.convolve(v ** 2, np.ones(win) / win, mode="same")
    rms = np.sqrt(pw)
    thr = np.percentile(rms[rms > 1e-4], 40) if np.any(rms > 1e-4) else 1
    d = np.clip(rms / thr, 0, 1)
    # attack 30 ms, release 350 ms smoothing
    out = np.zeros_like(d)
    a_att, a_rel = np.exp(-1 / (0.03 * SR)), np.exp(-1 / (0.35 * SR))
    y = 0.0
    for i in range(len(d)):
        x = d[i]
        y = a_att * y + (1 - a_att) * x if x > y else a_rel * y + (1 - a_rel) * x
        out[i] = y
    return 10 ** (depth_db * out / 20)


def main():
    print("music…"); music = build_music()
    print("sfx…"); sfx = build_sfx()
    ir = reverb_ir(2.4, 3)
    music = reverb(music, ir, 0.35)
    sfx = reverb(sfx, reverb_ir(1.4, 9, 6500), 0.18)
    duck = duck_curve(voice, -8.0)[:, None]
    v2 = np.stack([voice, voice], 1)
    v2 = reverb(v2, reverb_ir(0.9, 21, 5000), 0.04)
    mix = v2 * 1.0 + music * 0.55 * duck + sfx * (0.6 + 0.4 * duck)
    # stems for inspection
    sf.write(os.path.join(B, "music.wav"), music * 0.55, SR, subtype="FLOAT")
    sf.write(os.path.join(B, "sfx.wav"), sfx, SR, subtype="FLOAT")
    raw = os.path.join(B, "mix_raw.wav")
    sf.write(raw, mix, SR, subtype="FLOAT")
    # two-pass EBU R128 loudness normalisation to -14 LUFS / -1 dBTP
    p1 = subprocess.run(["ffmpeg", "-hide_banner", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                        capture_output=True, text=True).stderr
    js = json.loads(p1[p1.rindex("{"):p1.rindex("}") + 1])
    af = ("loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:"
          "measured_thresh={input_thresh}:offset={target_offset}").format(**js)
    out = os.path.join(B, "mix.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", af + ",aresample=48000", "-ar", "48000", "-c:a", "pcm_s24le", out], check=True)
    # verify
    import pyloudnorm as pyln
    y, _ = sf.read(out)
    lufs = pyln.Meter(SR).integrated_loudness(y)
    up = signal.resample_poly(y, 4, 1, axis=0)
    tp = 20 * np.log10(np.abs(up).max())
    print(f"mix: {len(y) / SR:.2f}s  {lufs:.2f} LUFS  true peak {tp:.2f} dBTP")
    if tp > -1.0:  # safety trim
        g = 10 ** ((-1.05 - tp) / 20)
        sf.write(out, y * g, SR, subtype="PCM_24")
        print("trimmed to -1.05 dBTP")


if __name__ == "__main__":
    main()
