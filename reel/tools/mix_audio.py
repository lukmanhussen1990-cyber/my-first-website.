#!/usr/bin/env python3
"""All the sound for the reel, made from scratch with numpy (no samples).

1. Places every voice line on the timeline (each line has a slot in
   timeline.json: its anchor word lands on a picture event; lines that are too
   long for their slot are sped up slightly with ffmpeg's atempo).
2. Synthesizes the music: soft, adventurous, quiet under the voice, and it
   stops dead right before John's line.
3. Synthesizes every sound effect, keyed to the same timeline events the
   animation uses (and to data/sfx_events.json for the concrete rings).
4. Mixes voice + music + effects with ducking, writes build/mix.wav.

Outputs: build/placement.json (absolute start of every line and word),
         build/voice.wav, build/music.wav, build/sfx.wav, build/mix.wav

Usage:  python3 tools/mix_audio.py          (needs numpy, scipy, soundfile, ffmpeg)
"""
import json
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
SR = 48000
rng = np.random.default_rng(7)


def load_json(rel):
    with open(os.path.join(ROOT, rel)) as f:
        return json.load(f)


TL = load_json("timeline.json")
E = TL["events"]
DUR = TL["duration"]
N = int(round(DUR * SR))


# ---------------------------------------------------------------- helpers
def i(t):
    return int(round(t * SR))


def tt(n):
    return np.arange(n) / SR


def noise(n):
    return rng.standard_normal(n)


def sos(kind, f, order=2):
    nyq = SR / 2
    if kind == "bp":
        return signal.butter(order, [f[0] / nyq, min(f[1] / nyq, 0.99)], btype="band", output="sos")
    return signal.butter(order, min(f / nyq, 0.99), btype={"lp": "low", "hp": "high"}[kind], output="sos")


def filt(x, kind, f, order=2):
    return signal.sosfilt(sos(kind, f, order), x)


def sweep_bp(x, f_c, q=1.5, block=256):
    """Band-pass whose centre frequency follows the per-sample array f_c."""
    out = np.zeros_like(x)
    zi = None
    for b in range(0, len(x), block):
        fc = float(np.clip(np.mean(f_c[b:b + block]), 40, SR * 0.45))
        bw = fc / q
        lo, hi = max(20.0, fc - bw / 2), min(SR * 0.47, fc + bw / 2)
        s = sos("bp", (lo, hi), 2)
        if zi is None or zi.shape != (s.shape[0], 2):
            zi = np.zeros((s.shape[0], 2))
        out[b:b + block], zi = signal.sosfilt(s, x[b:b + block], zi=zi)
    return out


def adsr(n, a=0.01, d=0.1, s=0.7, r=0.2, hold=None):
    hold = n / SR if hold is None else hold
    t = tt(n)
    env = np.where(t < a, t / max(a, 1e-4),
                   np.where(t < a + d, 1 - (1 - s) * (t - a) / max(d, 1e-4), s))
    rel = np.clip((t - hold) / max(r, 1e-4), 0, 1)
    return env * (1 - rel)


def expdec(n, tau):
    return np.exp(-tt(n) / tau)


def pan(x, p):
    """Mono -> stereo, p in -1..1 (constant power)."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def add(buf, start, x, gain=1.0, p=0.0):
    """Mix a mono (panned) or stereo clip into buf at time start."""
    if x.ndim == 1:
        x = pan(x, p)
    s = i(start)
    if s < 0:
        x = x[-s:]
        s = 0
    e = min(len(buf), s + len(x))
    if e > s:
        buf[s:e] += x[: e - s] * gain


def db(x):
    return 10 ** (x / 20)


def make_reverb(seconds=1.8, damp=6000, seed=3):
    r = np.random.default_rng(seed)
    n = i(seconds)
    t = tt(n)
    ir = np.stack([r.standard_normal(n), r.standard_normal(n)], axis=1) * np.exp(-t / (seconds / 6.5))[:, None]
    for c in range(2):
        ir[:, c] = filt(ir[:, c], "lp", damp)
    ir[: i(0.012)] = 0  # pre-delay
    return ir / np.sqrt(np.sum(ir ** 2))


def convolve_st(x, ir):
    return np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------------------------------------------------------------- voices
def ffmpeg_tempo(src, rate, dst):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter:a", f"atempo={rate:.5f}", "-ar", str(SR), "-ac", "1", dst],
                   check=True)


def place_voices():
    script = load_json("script.json")
    words = load_json("build/words.json")["lines"]
    placement = {}
    track = np.zeros((N, 2))
    tmpdir = tempfile.mkdtemp()
    for line in script["lines"]:
        lid = line["id"]
        slot = TL["voice"][lid]
        path = os.path.join(ROOT, "voices", f"{lid}.wav")
        x, sr = sf.read(path, dtype="float64", always_2d=True)
        x = x.mean(axis=1)
        dur = len(x) / sr
        w = words[lid]["words"]
        rate = 1.0
        # keep the anchor word on its picture event
        start = slot["anchor_time"] - w[slot["anchor_word"]]["start"]
        if start < slot["earliest"]:
            start = slot["earliest"]
        if start + dur > slot["latest_end"]:
            start = slot["latest_end"] - dur
            if start < slot["earliest"]:
                rate = dur / (slot["latest_end"] - slot["earliest"])
                start = slot["earliest"]
        src = path
        if abs(rate - 1.0) > 1e-3 or sr != SR:
            dst = os.path.join(tmpdir, f"{lid}.wav")
            ffmpeg_tempo(path, rate, dst)
            src = dst
        y, _ = sf.read(src, dtype="float64", always_2d=True)
        y = y.mean(axis=1)
        y = filt(y, "hp", 70)
        # level: every line to the same speech loudness (RMS of the voiced parts)
        frame = y[: len(y) // 480 * 480].reshape(-1, 480)
        rms = np.sqrt((frame ** 2).mean(axis=1))
        voiced = rms[rms > rms.max() * 0.1]
        y = y * (0.1 / max(1e-6, np.sqrt((voiced ** 2).mean())))
        add(track, start, y, 1.0, -0.05 if line["speaker"] == "narrator" else 0.08)
        placement[lid] = {
            "speaker": line["speaker"], "start": round(start, 4), "rate": round(rate, 5),
            "duration": round(len(y) / SR, 4),
            "words": [{"word": ww["word"], "start": round(start + ww["start"] / rate, 4),
                       "end": round(start + ww["end"] / rate, 4)} for ww in w],
        }
        print(f"  {lid}: start {start:6.2f} s  dur {len(y) / SR:5.2f} s  rate {rate:.3f}")
    with open(os.path.join(BUILD, "placement.json"), "w") as f:
        json.dump({"source": load_json("build/words.json").get("source"), "lines": placement}, f, indent=1)
    return track, placement


# ---------------------------------------------------------------- music
BAR = 2.0          # 120 bpm, 4/4
T0 = 0.8           # bar grid offset: bar 18 lands exactly on the flash through the core (36.8 s)
BEAT = BAR / 4
MUSIC_STOP = TL["music"]["stop"]


def bar_t(k, beat=0.0):
    return T0 + k * BAR + beat * BEAT


def inst_pad(freqs, dur, bright=1.0, attack=0.5, release=0.8):
    n = i(dur + release)
    t = tt(n)
    out = np.zeros((n, 2))
    for f in freqs:
        for c, det in ((0, -0.004), (1, 0.0045)):
            for d2 in (0.0, 0.0021):
                ff = f * (1 + det + d2)
                y = np.zeros(n)
                for h in range(1, 9):
                    if ff * h > 5000:
                        break
                    y += np.sin(2 * np.pi * ff * h * t + h * 0.7) / h
                out[:, c] += y
    for c in range(2):
        out[:, c] = filt(out[:, c], "lp", 900 + 1400 * bright, 2)
    env = adsr(n, attack, 0.3, 0.85, release, hold=dur)
    return out * env[:, None] / (len(freqs) * 3)


def inst_pluck(f, dur=0.9, bright=1.0):
    """Soft kalimba / marimba-like mallet."""
    n = i(dur)
    t = tt(n)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55)
    y += 0.35 * bright * np.sin(2 * np.pi * f * 4.02 * t) * np.exp(-t / 0.07)
    y += 0.12 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.25)
    click = filt(noise(i(0.004)), "bp", (1500, 6000)) * 0.05
    y[: len(click)] += click
    return y * np.minimum(1, t / 0.002)


def inst_steel(f, dur=1.0):
    """Steel-pan like tone (bright partials, quick bloom)."""
    n = i(dur)
    t = tt(n)
    parts = [(1.0, 1.0, 0.8), (2.0, 0.55, 0.45), (3.0, 0.28, 0.3), (3.98, 0.22, 0.2), (5.03, 0.1, 0.12)]
    y = np.zeros(n)
    bend = 1 + 0.01 * np.exp(-t / 0.02)
    for r, a, tau in parts:
        y += a * np.sin(2 * np.pi * f * r * np.cumsum(bend) / SR) * np.exp(-t / tau)
    return y * np.minimum(1, t / 0.004) * 0.6


def inst_bass(f, dur):
    n = i(dur + 0.08)
    t = tt(n)
    y = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) + 0.08 * np.sin(2 * np.pi * 3 * f * t)
    env = adsr(n, 0.008, 0.25, 0.55, 0.08, hold=dur)
    return filt(y * env, "lp", 700) * 0.9


def inst_bleep(f, dur=0.18):
    n = i(dur)
    t = tt(n)
    y = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 3 * f * t)
    return y * np.exp(-t / 0.06) * np.minimum(1, t / 0.002) * 0.5


def drum_kick(amp=1.0):
    n = i(0.35)
    t = tt(n)
    f = 45 + 75 * np.exp(-t / 0.035)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    return y * amp


def drum_shaker(amp=1.0):
    n = i(0.09)
    y = filt(noise(n), "bp", (4500, 11000)) * adsr(n, 0.012, 0.04, 0.0, 0.01)
    return y * amp * 0.35


def drum_snare(amp=1.0):
    n = i(0.3)
    t = tt(n)
    y = filt(noise(n), "bp", (1200, 7000)) * np.exp(-t / 0.08) * 0.6
    y += np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.5
    return y * amp


def drum_tom(f=140, amp=1.0):
    n = i(0.45)
    t = tt(n)
    ff = f * (1 + 0.5 * np.exp(-t / 0.03))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t / 0.22) * amp


def crash(amp=1.0, dur=2.5):
    n = i(dur)
    t = tt(n)
    y = filt(noise(n), "hp", 4500) * np.exp(-t / 0.7)
    return pan(y * amp * 0.5, -0.2) + pan(filt(noise(n), "hp", 5000) * np.exp(-t / 0.65) * amp * 0.5, 0.2)


def riser(dur, amp=1.0):
    n = i(dur)
    t = tt(n)
    u = t / dur
    fc = 300 * (12 ** u)
    y = sweep_bp(noise(n), fc, q=2.5)
    y += 0.25 * np.sin(2 * np.pi * np.cumsum(180 * (6 ** u)) / SR)
    return y * (u ** 2) * amp


CHORDS = {  # midi notes (pad voicing), bass root
    "C": ([60, 64, 67, 72], 36), "G": ([59, 62, 67, 71], 43), "Am": ([60, 64, 69, 72], 45),
    "F": ([60, 65, 69, 72], 41), "Dm": ([62, 65, 69, 74], 38), "E": ([59, 64, 68, 71], 40),
    "Fmaj7": ([60, 64, 65, 69], 41), "Gsus": ([60, 62, 67, 72], 43),
}


def make_music():
    dry = np.zeros((N + i(4), 2))
    # Sections: (first bar, chords, style)
    plan = [
        (0, ["C", "Am", "F", "G"], "intro"),
        (4, ["C", "G", "Am", "F"], "groove"),
        (8, ["C", "G", "F", "G"], "groove2"),
        (11, ["Am", "F", "Dm", "E"], "heat"),
        (15, ["F", "G", "Am"], "build"),
        (18, ["C"], "hit"),
        (19, ["Am", "F", "Dm", "Gsus"], "holo"),
        (23, ["C", "F", "G", "C"], "beach"),
    ]
    # pickup before the first bar: soft pad swell
    add(dry, 0.0, inst_pad([midi(m) for m in CHORDS["C"][0]], 0.8, bright=0.4, attack=0.6, release=0.3), 0.5)
    for k0, chords, style in plan:
        for j, ch in enumerate(chords):
            k = k0 + j
            t0 = bar_t(k)
            notes, root = CHORDS[ch]
            fr = [midi(m) for m in notes]
            pad_gain = {"intro": 0.55, "groove": 0.5, "groove2": 0.5, "heat": 0.6, "build": 0.62, "hit": 0.75,
                        "holo": 0.5, "beach": 0.45}[style]
            bright = {"heat": 0.6, "hit": 1.6, "build": 1.0, "beach": 1.2}.get(style, 0.8)
            add(dry, t0, inst_pad(fr, BAR, bright=bright, attack=0.35 if style != "hit" else 0.02), pad_gain)
            # arpeggio (8ths): kalimba
            if style in ("intro", "groove", "groove2", "beach", "build"):
                arp = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[3] + 12, notes[2] + 12, notes[1] + 12, notes[2] + 12, notes[3] + 12]
                for b8, m in enumerate(arp):
                    v = 0.32 if b8 % 2 == 0 else 0.22
                    if style == "beach":
                        v *= 0.7
                    add(dry, t0 + b8 * BEAT / 2, inst_pluck(midi(m)), v, p=0.35 if b8 % 2 else -0.25)
            if style == "holo":  # computer-like bleeps
                for b8 in range(8):
                    m = notes[(b8 * 3) % 4] + 24
                    add(dry, t0 + b8 * BEAT / 2, inst_bleep(midi(m)), 0.16, p=0.5 if b8 % 2 else -0.5)
            if style == "heat":  # slow, low pluck pulse
                for b in range(4):
                    add(dry, t0 + b * BEAT, inst_pluck(midi(notes[0]), 1.2, bright=0.4), 0.22, p=-0.2)
            # bass
            if style in ("groove", "groove2", "build", "beach", "heat", "holo"):
                pattern = {"groove": [(0, 1.5), (1.5, 0.5), (2, 1.5), (3.5, 0.5)],
                           "groove2": [(0, 1.5), (1.5, 0.5), (2, 1.0), (3, 1.0)],
                           "heat": [(0, 2.0), (2, 2.0)], "holo": [(0, 3.5)],
                           "build": [(0, 1), (1, 1), (2, 1), (3, 1)],
                           "beach": [(0, 0.75), (1.5, 0.5), (2, 0.75), (3, 0.5), (3.5, 0.5)]}[style]
                for b, d in pattern:
                    add(dry, t0 + b * BEAT, inst_bass(midi(root + (12 if style == "beach" and b == 3.5 else 0)), d * BEAT * 0.9), 0.5)
            # drums
            if style in ("groove", "groove2", "beach"):
                for b in range(4):
                    if b in (0, 2):
                        add(dry, t0 + b * BEAT, drum_kick(0.55 if style != "beach" else 0.45), 1.0)
                    for h8 in range(2):
                        add(dry, t0 + (b + h8 * 0.5) * BEAT, drum_shaker(0.8 if h8 else 0.5), 1.0, p=0.3)
                if style == "groove2":
                    add(dry, t0 + 3 * BEAT, drum_snare(0.25), 1.0)
            if style == "heat":
                add(dry, t0, drum_kick(0.4), 1.0)
                add(dry, t0 + 2.5 * BEAT, drum_kick(0.25), 1.0)
            if style == "build":
                # toms gathering speed toward the flash
                n_hits = [4, 8, 16][j]
                for h in range(n_hits):
                    add(dry, t0 + h * BAR / n_hits, drum_tom(120 + 30 * j + 2 * h, 0.22 + 0.1 * j), 1.0, p=-0.3 + 0.6 * (h % 2))
                add(dry, t0, drum_kick(0.5), 1.0)
            if style == "hit":
                add(dry, t0, drum_kick(1.0), 1.0)
                add(dry, t0, crash(0.6), 1.0)
                for b, m in enumerate([72, 76, 79, 84]):
                    add(dry, t0 + b * BEAT * 0.5, inst_pluck(midi(m), 1.4, 1.2), 0.3)
    # build riser into the flash
    add(dry, bar_t(15), riser(bar_t(18) - bar_t(15), 0.55), 1.0)
    # beach melody (steel pan), from bar 23
    mel = [  # (bar, beat, midi, beats)
        (23, 0, 76, 1), (23, 1, 79, 0.5), (23, 1.5, 81, 0.5), (23, 2, 79, 1), (23, 3, 76, 1),
        (24, 0, 77, 1), (24, 1, 81, 0.5), (24, 1.5, 84, 0.5), (24, 2, 81, 2),
        (25, 0, 79, 1), (25, 1, 83, 0.5), (25, 1.5, 86, 0.5), (25, 2, 83, 1), (25, 3, 79, 1),
        (26, 0, 84, 1), (26, 1, 79, 1), (26, 2, 76, 2),
    ]
    for k, b, m, d in mel:
        add(dry, bar_t(k, b), inst_steel(midi(m), 0.4 + d * BEAT), 0.42, p=0.15)
    # the yard intro: a gentle hello melody on the kalimba (bars 2-3)
    for k, b, m in [(2, 0, 79), (2, 1, 81), (2, 2, 84), (3, 0, 83), (3, 2, 79)]:
        add(dry, bar_t(k, b), inst_pluck(midi(m), 1.2, 0.8), 0.3, p=0.1)
    dry = dry[:N]
    wet = convolve_st(dry, make_reverb(2.2, 5500))
    mix = dry * 0.8 + wet * 0.45
    # fade in, then stop dead right before John speaks (a 12 ms fade avoids a click)
    t = tt(N)
    fin = np.clip(t / TL["music"]["fade_in"], 0, 1)
    stop = 1 - np.clip((t - MUSIC_STOP) / 0.012, 0, 1)
    return mix * (fin * stop)[:, None]


# ---------------------------------------------------------------- sound effects
def sfx_whoosh(dur, f0, f1, amp=1.0, q=2.0, peak=0.5):
    n = i(dur)
    t = tt(n)
    u = t / dur
    fc = f0 * (f1 / f0) ** u
    y = sweep_bp(noise(n), fc, q=q)
    env = np.where(u < peak, (u / peak) ** 2, ((1 - u) / (1 - peak)) ** 1.5)
    return y * env * amp


def sfx_thud(f=60, tau=0.25, amp=1.0, grit=0.3):
    n = i(tau * 4)
    t = tt(n)
    ff = f * (1 + 0.8 * np.exp(-t / 0.02))
    y = np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t / tau)
    y += grit * filt(noise(n), "lp", 900) * np.exp(-t / (tau * 0.4))
    return y * amp


def sfx_crunch(dur, density=60, lo=300, hi=3000, amp=1.0, seed=1):
    """Gritty granular crunch: many short filtered noise grains."""
    r = np.random.default_rng(seed)
    n = i(dur)
    y = np.zeros(n + i(0.05))
    times = np.sort(r.uniform(0, dur, int(density * dur)))
    for tg in times:
        g = i(r.uniform(0.004, 0.025))
        gr = r.standard_normal(g) * np.hanning(g) * r.uniform(0.3, 1.0)
        s = i(tg)
        y[s:s + g] += gr
    return filt(y[:n], "bp", (lo, hi)) * amp


def sfx_crackle(dur, rate=120, amp=1.0, lo=2500, seed=2):
    r = np.random.default_rng(seed)
    n = i(dur)
    y = np.zeros(n)
    k = r.uniform(0, n, int(rate * dur)).astype(int)
    y[k] = r.uniform(-1, 1, len(k)) * r.uniform(0.2, 1.0, len(k)) ** 2
    y = filt(y, "hp", lo)
    return y * amp


def sfx_tone_sweep(dur, f0, f1, amp=1.0, harm=(1.0, 0.3), tau=None, curve=1.0):
    n = i(dur)
    t = tt(n)
    u = (t / dur) ** curve
    f = f0 * (f1 / f0) ** u
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = sum(a * np.sin(ph * (h + 1)) for h, a in enumerate(harm))
    env = np.exp(-t / tau) if tau else np.ones(n)
    return y * env * np.minimum(1, t / 0.003) * amp


def sfx_chime(freqs, gap=0.09, amp=1.0, tau=0.5):
    out = np.zeros(i(gap * len(freqs) + tau * 5))
    for k, f in enumerate(freqs):
        n = i(tau * 5)
        t = tt(n)
        y = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.08)) * np.exp(-t / tau)
        s = i(k * gap)
        out[s:s + n] += y[: len(out) - s]
    return out * amp


def sfx_boing(f=320, dur=0.5, amp=1.0):
    n = i(dur)
    t = tt(n)
    f_t = f * (1 + 0.35 * np.exp(-t / 0.12) * np.sin(2 * np.pi * 14 * t))
    return np.sin(2 * np.pi * np.cumsum(f_t) / SR) * np.exp(-t / 0.18) * amp


def sfx_clank(f=420, amp=1.0):
    n = i(0.6)
    t = tt(n)
    y = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / tau) for r, a, tau in
            [(1, 1, 0.18), (2.71, 0.6, 0.09), (5.4, 0.35, 0.05), (8.9, 0.2, 0.03)])
    y += filt(noise(n), "bp", (2000, 8000)) * np.exp(-t / 0.01) * 0.6
    return y * amp


def sfx_gull(amp=1.0, seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros(i(1.4))
    s = 0.0
    for k in range(r.integers(2, 4)):
        d = r.uniform(0.22, 0.34)
        n = i(d)
        t = tt(n)
        u = t / d
        f = 1500 + 1100 * np.sin(np.pi * u) ** 0.6 - 300 * u
        f = f * (1 + 0.02 * np.sin(2 * np.pi * 28 * t))
        ph = 2 * np.pi * np.cumsum(f) / SR
        y = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)
        y *= np.sin(np.pi * u) ** 0.8
        st = i(s)
        out[st:st + n] += y[: len(out) - st]
        s += d + r.uniform(0.05, 0.12)
    return filt(out, "bp", (900, 7000)) * amp


def sfx_plop(amp=1.0):
    n = i(0.35)
    t = tt(n)
    f = 260 * np.exp(-t / 0.05) + 90
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.07)
    y += filt(noise(n), "bp", (300, 2500)) * np.exp(-t / 0.03) * 0.5
    return y * amp


def make_sfx(placement):
    ev = load_json("data/sfx_events.json")   # written by tools/export_events.mjs from the animation code
    out = np.zeros((N + i(4), 2))
    # --- backyard ambience: breeze and a few birds
    n = i(15.5)
    breeze = filt(noise(n), "lp", 500) * (0.5 + 0.5 * np.sin(2 * np.pi * tt(n) / 7.0)) * 0.05
    fade = np.clip(1 - (tt(n) - 13.0) / 2.5, 0, 1)
    add(out, 0, breeze * fade, 1.0, -0.3)
    for k, (tb, f) in enumerate([(0.6, 3200), (1.5, 3800), (2.3, 3500), (6.9, 3300), (7.4, 3900)]):
        chirp = sfx_tone_sweep(0.09, f, f * 1.3, 0.12, tau=0.05)
        add(out, tb, chirp, 1.0, 0.6 if k % 2 else -0.6)
        add(out, tb + 0.12, sfx_tone_sweep(0.07, f * 1.1, f * 1.4, 0.1, tau=0.04), 1.0, 0.6 if k % 2 else -0.6)
    # --- the hole opens: a dig thump and a crunchy collapse
    add(out, E["hole_open"], sfx_thud(55, 0.3, 0.7, grit=0.6), 1.0)
    add(out, E["hole_open"], sfx_crunch(E["hole_done"] - E["hole_open"] + 0.3, 140, 200, 2500, 0.35, seed=11), 1.0, -0.1)
    # --- the car rolls on the grass, tips in, falls, thuds on the pit floor
    add(out, E["car_roll"], filt(noise(i(0.7)), "lp", 400) * adsr(i(0.7), 0.1, 0.2, 0.6, 0.2) * 0.25, 1.0)
    add(out, E["car_tip"] + 0.2, sfx_whoosh(1.0, 300, 900, 0.35, q=1.5, peak=0.6), 1.0)
    add(out, E["car_land"], sfx_thud(48, 0.35, 1.0, grit=0.8), 1.0)
    add(out, E["car_land"], sfx_crunch(0.5, 120, 200, 2000, 0.3, seed=12), 1.0)
    # --- tyres spinning in the dirt: motor whine, tyre whirr, flung dirt
    d = E["spin_end"] - E["spin_start"] + 0.3
    n = i(d)
    t = tt(n)
    k = np.clip(t / 0.3, 0, 1) * np.clip((d - t) / 0.4, 0, 1)
    f = 520 + 260 * np.clip(t / 0.6, 0, 1) + 15 * np.sin(2 * np.pi * 9 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    whine = (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.15 * np.sin(3.01 * ph)) * 0.09
    whirr = sweep_bp(noise(n), 900 + 200 * np.sin(2 * np.pi * 21 * t), q=1.2) * 0.25
    add(out, E["spin_start"], (whine + whirr) * k, 1.0)
    add(out, E["spin_start"] + 0.1, sfx_crunch(d - 0.2, 220, 400, 5000, 0.35, seed=13) * k[: i(d - 0.2)], 1.0, 0.2)
    # --- the drill snaps on (clank + boing), spins up (rising whine)
    add(out, E["drill_snap"], sfx_clank(380, 0.5), 1.0, 0.1)
    add(out, E["drill_snap"] + 0.05, sfx_boing(300, 0.5, 0.35), 1.0, 0.1)
    add(out, E["drill_spinup"], sfx_tone_sweep(E["drill_go"] - E["drill_spinup"] + 0.05, 160, 820, 0.18,
                                               harm=(1.0, 0.45, 0.25, 0.1), curve=0.7), 1.0)
    # --- drilling: whine follows the drill speed; grinding colour follows the layer
    drill = np.array(ev["drill"])  # t, s, v
    t_d = drill[:, 0]
    s_d = drill[:, 1]
    v_d = drill[:, 2]
    seg = [(E["drill_go"], E["zoom_start"] - 0.1), (E["zoom_end"] + 0.35, E["burst"])]
    for a, b in seg:
        n = i(b - a)
        t = a + tt(n)
        s = np.interp(t, t_d, s_d)
        v = np.interp(t, t_d, v_d)
        f = 760 + 26 * np.clip(v, 0, 12)
        ph = 2 * np.pi * np.cumsum(f) / SR
        whine = np.sin(ph) + 0.4 * np.sin(2 * ph + 0.3) + 0.2 * np.sin(3 * ph) + 0.08 * np.sin(5.02 * ph)
        # the whine is loud while the drill bites in, then settles back so it never nags
        settle = 0.45 + 0.55 * np.exp(-np.maximum(0, t - a) / 2.5)
        whine *= 0.04 * settle * (1 + 0.15 * np.sin(2 * np.pi * 7 * t))
        # grinding: lower and softer in soil/sand, crackly in rock, bubbly in the mantle
        soil = ((s < 10) | (s > 128)).astype(float)
        rock = (((s >= 10) & (s < 23)) | ((s > 111) & (s <= 128))).astype(float)
        hot = (((s >= 23) & (s < 50)) | ((s > 94) & (s <= 111))).astype(float)
        sm = lambda m: filt(m, "lp", 3)  # noqa: E731 - smooth layer masks
        soil, rock, hot = sm(soil), sm(rock), sm(hot)
        g_soil = filt(sfx_crunch(b - a, 160, 150, 1400, 1.0, seed=21)[:n], "lp", 1600) * 0.5
        g_rock = sfx_crunch(b - a, 260, 500, 4500, 1.0, seed=22)[:n] * 0.45
        g_hot = (sfx_crunch(b - a, 90, 200, 1200, 1.0, seed=23)[:n] * 0.4 + sfx_crackle(b - a, 160, 1.2, 3000, seed=24)[:n] * 0.35)
        grind = g_soil * soil + g_rock * rock + g_hot * hot
        env = np.clip((t - a) / 0.3, 0, 1) * np.clip((b - t) / 0.2, 0, 1)
        add(out, a, (whine + grind * 0.55) * env, 1.0)
    # --- tunnel walls crumble
    add(out, E["crumble_start"], filt(noise(i(2.4)), "lp", 220) * adsr(i(2.4), 0.3, 0.5, 0.7, 0.8) * 0.45, 1.0, -0.2)
    add(out, E["crumble_start"] + 0.1, sfx_crunch(2.2, 60, 300, 3000, 0.4, seed=31), 1.0, 0.3)
    # --- concrete rings thunk into place (louder while they are the story)
    for r in ev["rings"]:
        tr = r["t"]
        g = 0.55 if tr < E["rock_enter"] + 3.2 else 0.18
        g *= 0.85 + 0.3 * rng.random()
        add(out, tr, sfx_thud(80 + 10 * rng.random(), 0.09, g, grit=0.5), 1.0, rng.uniform(-0.3, 0.3))
        add(out, tr, filt(noise(i(0.03)), "bp", (1500, 4000)) * expdec(i(0.03), 0.006) * g * 0.3, 1.0)
    # --- rock crunch accent as the drill enters hard rock
    add(out, E["rock_enter"], sfx_crunch(0.6, 300, 600, 5000, 0.4, seed=41), 1.0)
    # --- heat: sizzle swelling with the glow
    a, b = E["heat_start"], E["core_reveal"] + 0.5
    n = i(b - a)
    t = tt(n)
    env = np.clip(t / 2.5, 0, 1) * np.clip((b - a - t) / 1.0, 0, 1)
    sizzle = filt(noise(n), "bp", (3500, 11000)) * 0.05 + sfx_crackle(b - a, 220, 1.3, 2500, seed=51)[:n] * 0.4
    add(out, a, sizzle * env, 1.0, 0.2)
    # --- heat shield: foil crinkle wrapping round the car
    d = E["shield_done"] - E["shield_wrap"] + 0.2
    add(out, E["shield_wrap"], sfx_crackle(d, 900, 1.0, 1800, seed=52) * adsr(i(d), 0.05, 0.2, 0.8, 0.15) * 0.8, 1.0, -0.2)
    add(out, E["shield_wrap"], sfx_whoosh(d, 500, 2500, 0.25, q=1.5), 1.0, 0.2)
    # --- ice-cold air: hiss from the vents, and frost tinkles
    a, b = E["vents"], 31.0
    n = i(b - a)
    t = tt(n)
    hiss = filt(noise(n), "bp", (2200, 9000)) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.7 * t))
    env = np.minimum(1, t / 0.08) * np.clip((b - a - t) / 0.8, 0, 1)
    add(out, a, hiss * env * 0.12, 1.0, -0.15)
    for k in range(9):
        f = rng.uniform(2600, 5200)
        add(out, E["frost"] + k * 0.11 + rng.uniform(0, 0.05), sfx_chime([f], amp=0.05, tau=0.15), 1.0, rng.uniform(-0.6, 0.6))
    add(out, E["thumbs_up"] + 0.15, sfx_chime([1568, 2093], gap=0.08, amp=0.12, tau=0.35), 1.0, 0.3)
    # --- the core: a deep roar of fire as it comes into view
    a, b = E["core_reveal"], E["zoom_end"] + 1.2
    n = i(b - a)
    t = tt(n)
    roar = filt(noise(n), "lp", 160) * 1.2 + filt(noise(n), "bp", (200, 900)) * 0.25
    roar *= (0.8 + 0.2 * filt(noise(n), "lp", 4) * 8)
    env = np.clip(t / 2.0, 0, 1) * np.clip((b - a - t) / 1.0, 0, 1)
    add(out, a, roar * env * 0.32, 1.0)
    # --- SpaceX thrusters: ignition boom and a roaring jet
    a, b = E["thrusters"], E["zoom_end"] + 0.7
    n = i(b - a)
    t = tt(n)
    jet = filt(noise(n), "lp", 180) * 1.4 + filt(noise(n), "bp", (900, 6000)) * 0.5 + filt(noise(n), "bp", (300, 900)) * 0.4
    env = np.minimum(1, t / 0.06) * np.clip((b - a - t) / 0.6, 0, 1)
    add(out, a, jet * env * 0.42, 1.0)
    add(out, a, sfx_thud(42, 0.45, 1.0, grit=0.5), 1.0)
    # --- the dash through the core: one big whoosh and a deep boom at the flash
    add(out, E["zoom_start"] - 0.1, sfx_whoosh(E["zoom_end"] - E["zoom_start"] + 0.6, 180, 3500, 0.9, q=1.2, peak=0.55), 1.0)
    add(out, E["flash"], sfx_thud(36, 0.7, 0.8, grit=0.4), 1.0)
    # --- hologram: pop, tap, path bending, beach locked
    add(out, E["holo_pop"], sfx_tone_sweep(0.16, 380, 1300, 0.18, tau=0.09), 1.0, 0.25)
    add(out, E["holo_pop"] + 0.05, sfx_chime([2637, 3136], gap=0.05, amp=0.06, tau=0.2), 1.0, 0.25)
    add(out, E["holo_tap"], sfx_tone_sweep(0.06, 1800, 1700, 0.16, tau=0.03), 1.0, 0.25)
    for k in range(4):
        add(out, E["path_bend"] + k * 0.22, sfx_tone_sweep(0.07, 900 + 160 * k, 950 + 160 * k, 0.09, tau=0.04), 1.0, 0.25)
    add(out, E["beach_lock"], sfx_chime([1319, 1976], gap=0.11, amp=0.15, tau=0.4), 1.0, 0.25)
    # --- heat shield peels off
    add(out, E["shield_off"], sfx_crackle(0.6, 700, 0.9, 1500, seed=61) * adsr(i(0.6), 0.02, 0.2, 0.5, 0.2), 1.0, -0.2)
    add(out, E["shield_off"], sfx_whoosh(0.6, 2500, 600, 0.2), 1.0)
    # --- sand: the beach swells, bursts, the car flies and lands
    add(out, E["sand_bulge"], filt(noise(i(0.8)), "lp", 140) * np.linspace(0, 1, i(0.8)) ** 2 * 0.5, 1.0)
    add(out, E["burst"], sfx_thud(50, 0.4, 1.0, grit=1.0), 1.0)
    add(out, E["burst"], filt(noise(i(1.6)), "lp", 2600) * expdec(i(1.6), 0.35) * 0.6, 1.0)
    add(out, E["burst"] + 0.05, sfx_crunch(1.6, 300, 1500, 7000, 0.35, seed=71) * expdec(i(1.6), 0.6), 1.0, 0.3)
    add(out, E["burst"], sfx_whoosh(1.3, 400, 1400, 0.3, peak=0.3), 1.0, -0.2)
    add(out, E["drill_stop"] - 0.6, sfx_tone_sweep(0.7, 820, 220, 0.12, harm=(1.0, 0.4, 0.2), curve=1.5), 1.0)
    add(out, E["drill_stop"], sfx_tone_sweep(0.08, 600, 1400, 0.15, tau=0.03), 1.0)  # drill pops off
    add(out, E["land"], sfx_thud(52, 0.32, 1.0, grit=0.7), 1.0)
    add(out, E["land"] + 0.02, filt(noise(i(0.8)), "bp", (500, 5000)) * expdec(i(0.8), 0.18) * 0.35, 1.0)
    add(out, E["land"] + 0.08, sfx_boing(170, 0.35, 0.12), 1.0, 0.1)
    # --- ice cream: the scoop drops and plops
    add(out, E["plop"], sfx_plop(0.55), 1.0, -0.35)
    # --- dizzy stars twinkle (quietly, stops before John talks)
    for k in range(6):
        add(out, E["land"] + 0.5 + k * 0.55, sfx_chime([3520 + 300 * (k % 3)], amp=0.025, tau=0.12), 1.0, 0.5 * (-1) ** k)
    # --- the door swings up, sand pours out
    add(out, E["door_open"], sfx_whoosh(0.6, 700, 1800, 0.12, q=2.0), 1.0, 0.15)
    add(out, E["door_open"] + 0.62, sfx_thud(140, 0.05, 0.25, grit=0.2), 1.0, 0.15)
    d = 1.5
    add(out, E["sand_pour"], (sfx_crunch(d, 900, 1500, 9000, 0.4, seed=81) + filt(noise(i(d)), "bp", (2500, 8000)) * 0.05)
        * adsr(i(d), 0.15, 0.3, 0.8, 0.5), 1.0, 0.2)
    # --- ocean: waves wash in and out, gulls now and then
    a = 43.4
    n = N - i(a)
    t = tt(n)
    swell = 0.55 + 0.45 * np.sin(2 * np.pi * t / 6.5 - 1.2) ** 2
    waves = np.stack([filt(noise(n), "lp", 1200) * swell, filt(noise(n), "lp", 1100) * np.roll(swell, i(0.7))], axis=1)
    waves += np.stack([filt(noise(n), "bp", (2000, 6000)) * swell ** 3 * 0.15] * 2, axis=1)
    env = np.clip((t - 1.0) / 2.0, 0, 1)
    add(out, a, waves * env[:, None] * 0.07, 1.0)
    for tg, sd, p in [(45.25, 1, -0.6), (49.55, 2, 0.6), (54.75, 3, -0.4)]:
        add(out, tg, sfx_gull(0.06, sd), 1.0, p)
    return out[:N]


# ---------------------------------------------------------------- mix
MUSIC_DB = -12.0   # music bed, relative to the voice level (and ducked a further 6 dB while someone talks)
SFX_DB = -8.0      # sound effects bus, relative to the voice level (ducked 4.4 dB under speech)


def rms_active(x, thresh=0.02):
    """RMS over the parts that are actually sounding (50 ms blocks)."""
    m = x.mean(axis=1) if x.ndim == 2 else x
    blk = m[: len(m) // 2400 * 2400].reshape(-1, 2400)
    r = np.sqrt((blk ** 2).mean(axis=1))
    on = r[r > r.max() * thresh]
    return max(1e-9, float(np.sqrt((on ** 2).mean())))


def report(voice, music, sfx):
    """Print how far the music and effects sit under the voice while it speaks."""
    blk = 2400
    def levels(x):
        m = x.mean(axis=1)
        b = m[: len(m) // blk * blk].reshape(-1, blk)
        return 20 * np.log10(np.sqrt((b ** 2).mean(axis=1)) + 1e-9)
    lv, lm, ls = levels(voice), levels(music), levels(sfx)
    sp = lv > lv.max() - 25
    print(f"  while speaking: voice {np.median(lv[sp]):.1f} dB, music {np.median(lm[sp]):.1f} dB, "
          f"effects {np.median(ls[sp]):.1f} dB (95th pct {np.percentile(ls[sp], 95):.1f} dB)")


def envelope(x, attack=0.03, release=0.35):
    """Smoothed level of a stereo signal (for ducking)."""
    m = np.abs(x).max(axis=1)
    blk = 240
    nb = len(m) // blk + 1
    mm = np.pad(m, (0, nb * blk - len(m))).reshape(nb, blk).max(axis=1)
    out = np.zeros(nb)
    a_up, a_dn = np.exp(-blk / (attack * SR)), np.exp(-blk / (release * SR))
    v = 0.0
    for k in range(nb):
        c = a_up if mm[k] > v else a_dn
        v = c * v + (1 - c) * mm[k]
        out[k] = v
    return np.repeat(out, blk)[: len(m)]


def main():
    os.makedirs(BUILD, exist_ok=True)
    print("placing voices")
    voice, placement = place_voices()
    print("music")
    music = make_music()
    print("sound effects")
    sfx = make_sfx(placement)
    # every stem to the same reference level first, then quiet music/effects under the voice
    music = music * (0.1 / rms_active(music))
    sfx = sfx * (0.1 / rms_active(sfx))
    venv = envelope(voice)
    active = np.clip(venv / 0.05, 0, 1)
    duck_m = 1 - 0.5 * active
    duck_s = 1 - 0.4 * active
    music = music * db(MUSIC_DB) * duck_m[:, None]
    sfx = sfx * db(SFX_DB) * duck_s[:, None]
    # loud effects (thrusters, the sand burst) never cover a word: while someone
    # talks, the effects bus is held at least 7 dB under the voice
    senv = envelope(sfx, 0.01, 0.25)
    ceiling = np.where(active > 0.1, envelope(voice, 0.01, 0.5) * db(-7), np.inf)
    g = np.minimum(1.0, ceiling / np.maximum(senv, 1e-6))
    g = signal.sosfiltfilt(sos("lp", 12), g)
    sfx = sfx * np.clip(g, 0, 1)[:, None]
    mix = voice + music + sfx
    report(voice, music, sfx)
    peak = np.abs(mix).max()
    print(f"  peak before limiter: {peak:.2f}")
    mix = np.tanh(mix / 0.95) * 0.95 if peak > 0.95 else mix
    for name, x in [("voice", voice), ("music", music), ("sfx", sfx), ("mix", mix)]:
        sf.write(os.path.join(BUILD, f"{name}.wav"), np.clip(x, -1, 1).astype(np.float32), SR, subtype="FLOAT")
    print("wrote build/mix.wav")


if __name__ == "__main__":
    main()
