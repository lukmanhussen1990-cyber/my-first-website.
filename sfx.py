#!/usr/bin/env python3
"""sfx.py — synthesize the royalty-free music bed + sound effects (numpy only).

  python3 sfx.py            create any missing file in audio/ (keeps your own files)
  python3 sfx.py --force    regenerate everything

  audio/music.wav           soft dark piano + pad tension loop (length = reel length + 2 s)
  audio/sfx/whoosh.wav      cut whoosh          audio/sfx/ding.wav       stat-card ding
  audio/sfx/tick.wav        clock tick          audio/sfx/flip.wav       counter flip
  audio/sfx/heartbeat.wav   lub-dub             audio/sfx/hit.wav        low cinematic hit
  audio/sfx/shimmer.wav     soft sparkle chime

Drop your own royalty-free files with the same names into audio/ to replace them.
"""
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
SR = 48000
rng = np.random.default_rng(1234)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def save(path, x, peak_db=-1.0):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = x / (np.max(np.abs(x)) + 1e-12) * 10 ** (peak_db / 20)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
    print("wrote", path.relative_to(ROOT), f"({len(x) / SR:.2f}s)")


def fft_filter(x, lo=None, hi=None, order=2):
    """Zero-phase band filter in the frequency domain (smooth Butterworth-like magnitude)."""
    n = len(x)
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    if X.ndim == 2:
        g = g[:, None]
    return np.fft.irfft(X * g, n=n, axis=0)


def reverb(x, seconds=2.4, mix=0.3, seed=7):
    """Convolution reverb with a synthetic stereo decaying-noise impulse response."""
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    env = np.exp(-6.9 * t / seconds)
    ir = r.standard_normal((n, 2)) * env[:, None]
    ir = fft_filter(ir, lo=180, hi=6000)
    ir[: int(0.012 * SR)] = 0                         # pre-delay
    ir /= np.sqrt(np.sum(ir ** 2, axis=0))
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    m = len(x) + n
    size = 1 << int(np.ceil(np.log2(m)))
    wet = np.fft.irfft(np.fft.rfft(x, size, axis=0) * np.fft.rfft(ir, size, axis=0), size, axis=0)[: len(x)]
    return (1 - mix) * x + mix * wet * 3.0


def adsr(n, a, d, s, r_, total):
    t = np.arange(n) / SR
    env = np.where(t < a, t / max(a, 1e-6), 1.0)
    env = np.where((t >= a) & (t < a + d), 1 - (1 - s) * (t - a) / max(d, 1e-6), env)
    env = np.where(t >= a + d, s, env)
    rel = total - r_
    env = np.where(t > rel, env * np.clip(1 - (t - rel) / max(r_, 1e-6), 0, 1), env)
    return env


# ------------------------------------------------------------------- SFX
def whoosh():
    sec = 0.8
    n = int(sec * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    hop, size = 256, 1024
    win = np.hanning(size)
    f = np.fft.rfftfreq(size, 1 / SR)
    for start in range(0, n - size, hop):
        p = (start + size / 2) / n
        fc = 250 * (14 ** np.sin(np.pi * min(p * 1.15, 1)))      # sweep up and back down
        bw = fc * 0.9
        g = np.exp(-0.5 * ((f - fc) / bw) ** 2)
        seg = np.fft.irfft(np.fft.rfft(noise[start:start + size] * win) * g, size)
        out[start:start + size] += seg * win
    t = t_axis(sec)
    env = np.sin(np.pi * np.clip(t / (sec * 0.92), 0, 1)) ** 2.2
    env *= np.exp(-1.2 * t)
    pan = np.sin(np.pi * t / sec) * 0.6
    x = out * env
    return reverb(np.stack([x * (1 - pan * 0.5), x * (1 + pan * 0.5)], axis=1), 1.0, 0.22)


def ding():
    sec = 1.8
    t = t_axis(sec)
    f0 = 1318.5
    parts = [(1, 1.0, 1.6), (2.0, .45, .9), (2.76, .3, .6), (4.07, .18, .35), (5.43, .1, .25), (0.5, .25, 1.2)]
    x = sum(a * np.exp(-t / d) * np.sin(2 * np.pi * f0 * k * t) for k, a, d in parts)
    x *= np.clip(t / 0.002, 0, 1)
    return reverb(x, 1.6, 0.25)


def tick():
    sec = 0.16
    t = t_axis(sec)
    click = rng.standard_normal(len(t)) * np.exp(-t / 0.0018)
    click = fft_filter(click, lo=1500, hi=9000)
    body = np.sin(2 * np.pi * 3100 * t) * np.exp(-t / 0.012) * 0.6 + np.sin(2 * np.pi * 980 * t) * np.exp(-t / 0.02) * 0.4
    return reverb(click * 2.2 + body, 0.5, 0.12)


def flip():
    sec = 0.2
    t = t_axis(sec)
    n = rng.standard_normal(len(t)) * (np.exp(-t / 0.03) * np.clip(t / 0.004, 0, 1))
    n = fft_filter(n, lo=900, hi=5000)
    tock = np.sin(2 * np.pi * 620 * t) * np.exp(-t / 0.018) * 0.5
    return reverb(n + tock, 0.5, 0.1)


def heartbeat():
    sec = 0.62
    t = t_axis(sec)

    def thump(t0, f_hi, f_lo, dec, amp):
        tt = np.clip(t - t0, 0, None)
        freq = f_lo + (f_hi - f_lo) * np.exp(-tt / 0.03)
        phase = 2 * np.pi * np.cumsum(freq) / SR
        env = np.where(t >= t0, np.exp(-tt / dec) * np.clip(tt / 0.004, 0, 1), 0)
        return amp * env * np.sin(phase)

    x = thump(0.0, 95, 48, 0.07, 1.0) + thump(0.19, 110, 55, 0.06, 0.75)
    nz = fft_filter(rng.standard_normal(len(t)), hi=180) * (np.exp(-t / 0.04) + np.exp(-np.clip(t - .19, 0, None) / .04) * (t > .19))
    return x + nz * 0.25


def hit():
    sec = 2.4
    t = t_axis(sec)
    freq = 38 + 70 * np.exp(-t / 0.08)
    boom = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.55)
    nz = fft_filter(rng.standard_normal(len(t)), hi=900) * np.exp(-t / 0.09) * 0.5
    x = (boom + nz) * np.clip(t / 0.003, 0, 1)
    return reverb(x, 2.2, 0.35)


def shimmer():
    sec = 2.4
    t = t_axis(sec)
    x = np.zeros(len(t))
    for i, f in enumerate([1318.5, 1661.2, 1975.5, 2637.0, 3322.4]):
        tt = np.clip(t - i * 0.07, 0, None)
        on = t >= i * 0.07
        x += on * np.exp(-tt / 0.7) * (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2.01 * f * tt)) * (0.9 ** i)
    x *= 0.6 + 0.4 * np.sin(2 * np.pi * 6 * t)
    return reverb(x, 2.4, 0.5)


# ----------------------------------------------------------------- music
NOTE = {"C": 0, "C#": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "Bb": 10, "B": 11}


def hz(name):
    n, octv = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[n] + 12 * (octv + 1) - 69) / 12)


def piano_note(f, sec, vel=1.0):
    t = t_axis(sec)
    x = np.zeros(len(t))
    B = 0.00035
    for k in range(1, 11):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 12000:
            break
        amp = (1 / k ** 1.15) * (1.0 if k > 1 else 1.2)
        dec = 2.8 / (k ** 0.55)
        x += amp * np.exp(-t / dec) * np.sin(2 * np.pi * fk * t + rng.uniform(0, 2 * np.pi))
    x *= np.clip(t / 0.004, 0, 1) * (1 - np.clip((t - (sec - 0.3)) / 0.3, 0, 1))
    hammer = fft_filter(rng.standard_normal(len(t)), lo=800, hi=4000) * np.exp(-t / 0.01) * 0.08
    return (x + hammer) * vel


def pad_chord(freqs, sec):
    t = t_axis(sec)
    x = np.zeros((len(t), 2))
    for f in freqs:
        for ch, det in ((0, -0.004), (1, 0.004)):
            ff = f * (1 + det)
            for k in range(1, 7):
                x[:, ch] += (1 / k) * np.exp(-k / 2.2) * np.sin(2 * np.pi * ff * k * t + k * 0.7 + ch)
    env = adsr(len(t), 1.4, 0.5, 0.85, 1.6, sec)
    return x * env[:, None]


def music(total):
    total = max(total, 20.0)
    n = int(total * SR)
    out = np.zeros((n, 2))
    # D minor, dark: Dm – Bb – Gm – A (tension back to Dm), 4 s per chord
    prog = [(["D3", "F3", "A3"], "D2"), (["Bb2", "D3", "F3"], "Bb1"), (["G2", "Bb2", "D3"], "G1"), (["A2", "C#3", "E3"], "A1")]
    motif = [["A4", "F4", "D5", "F4"], ["F4", "D4", "Bb4", "D4"], ["D4", "Bb3", "G4", "Bb3"], ["E4", "C#4", "A4", "G4"]]
    bar = 4.0
    i = 0
    while i * bar < total:
        chord, root = prog[i % 4]
        start = int(i * bar * SR)
        seg = pad_chord([hz(c) for c in chord] + [hz(root) * 2], bar + 1.8)
        end = min(n, start + len(seg))
        out[start:end] += seg[: end - start] * 0.12
        # sub bass
        t = t_axis(bar + 1.0)
        sub = np.sin(2 * np.pi * hz(root) * t) * adsr(len(t), 0.6, 0.2, 0.9, 1.0, bar + 1.0) * 0.16
        end = min(n, start + len(sub))
        out[start:end] += sub[: end - start, None]
        # sparse piano: 4 soft notes per bar, last bar of every 4 a little busier
        for j, name in enumerate(motif[i % 4]):
            if i % 8 == 7 and j == 3:
                continue
            note = piano_note(hz(name), 3.2, vel=0.5 if j else 0.65)
            s0 = start + int(j * 1.0 * SR + (0.02 if j % 2 else 0) * SR)
            e0 = min(n, s0 + len(note))
            if s0 < n:
                pan = 0.15 * (-1 if j % 2 else 1)
                out[s0:e0, 0] += note[: e0 - s0] * (1 - pan) * 0.22
                out[s0:e0, 1] += note[: e0 - s0] * (1 + pan) * 0.22
        # heartbeat-like low pulse on beat 1 and 3 (tension)
        for j in (0, 2):
            t = t_axis(0.4)
            pul = np.sin(2 * np.pi * (50 + 30 * np.exp(-t / 0.03)) * t) * np.exp(-t / 0.12) * 0.12
            s0 = start + int(j * SR)
            e0 = min(n, s0 + len(pul))
            if s0 < n:
                out[s0:e0] += pul[: e0 - s0, None]
        i += 1
    out = fft_filter(out, lo=35, hi=7000)
    out = reverb(out, 3.2, 0.35, seed=3)
    t = np.arange(n) / SR
    out *= np.clip(t / 1.5, 0, 1)[:, None] * np.clip((total - t) / 2.5, 0, 1)[:, None]
    return out


def lufs(path):
    r = subprocess.run(["ffmpeg", "-nostats", "-hide_banner", "-i", str(path), "-af", "ebur128=framelog=quiet",
                        "-f", "null", "-"], capture_output=True, text=True)
    import re
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1]) if m else None


def main():
    force = "--force" in sys.argv
    sfx = {"whoosh": whoosh, "ding": ding, "tick": tick, "flip": flip, "heartbeat": heartbeat, "hit": hit,
           "shimmer": shimmer}
    for name, fn in sfx.items():
        p = ROOT / "audio" / "sfx" / f"{name}.wav"
        if force or not p.exists():
            save(p, fn())
    p = ROOT / "audio" / "music.wav"
    if force or not p.exists():
        tl = ROOT / "out" / "timeline.json"
        total = json.loads(tl.read_text())["total"] if tl.exists() else 90.0
        save(p, music(total + 2.0), peak_db=-1.0)
        # loudness-match the bed to the voice target so "music_db: -18" means 18 dB under the voice
        plan = json.loads((ROOT / "scenes.json").read_text(encoding="utf-8"))
        target = plan.get("audio", {}).get("voice_lufs", -16)
        cur = lufs(p)
        if cur is not None:
            with wave.open(str(p), "rb") as w:
                data = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float64) / 32767
            gain = 10 ** ((target - cur) / 20)
            peak = np.max(np.abs(data)) * gain
            if peak > 0.98:
                gain *= 0.98 / peak
            save(p, data.reshape(-1, 2) * gain, peak_db=20 * np.log10(max(np.max(np.abs(data)) * gain, 1e-9)))
            print(f"  music loudness {cur:.1f} → {lufs(p):.1f} LUFS")


if __name__ == "__main__":
    main()
