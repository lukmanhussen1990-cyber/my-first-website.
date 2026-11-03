#!/usr/bin/env python3
"""A quiet lo-fi beat made entirely with code -> build/music.wav

82 BPM, Fmaj7 - Em7 - Dm7 - Cmaj7 on a soft electric-piano tone, sine bass,
swung kick/snare/hats, vinyl crackle, everything warmed with a low-pass.
"""
import json, os, wave
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(5)
BPM = 82
BEAT = 60 / BPM


def mtof(m): return 440 * 2 ** ((m - 69) / 12)


def lowpass(x, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (f / hi) ** 4), len(x))


def add(buf, at, sig):
    i = int(at * SR)
    if i >= len(buf): return
    n = min(len(sig), len(buf) - i); buf[i:i + n] += sig[:n]


def epiano(freq, dur):
    t = np.arange(int(dur * SR)) / SR
    tone = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t * 3) + 0.12 * np.sin(2 * np.pi * 3 * freq * t) * np.exp(-t * 5)
    envl = np.minimum(1, t / 0.02) * np.exp(-t * 0.9)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.5 * t)
    return tone * envl * trem


def main():
    tl = json.load(open(os.path.join(HERE, "build", "timeline.json")))
    total = tl["duration"] + 1
    n = int(total * SR)
    keys, bass, drums = np.zeros(n), np.zeros(n), np.zeros(n)
    chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]  # Fmaj7 Em7 Dm7 Cmaj7
    roots = [41, 40, 38, 36]
    bar = 4 * BEAT
    t0 = 0.0; b = 0
    while t0 < total:
        ch = chords[b % 4]
        for k, m in enumerate(ch):                        # gently strummed chord + a re-hit on beat 3
            add(keys, t0 + k * 0.025, epiano(mtof(m), bar * 0.95) * 0.22)
            add(keys, t0 + 2.5 * BEAT + k * 0.02, epiano(mtof(m + 12 if k == 3 else m), bar * 0.4) * 0.09)
        r = roots[b % 4]
        for beat, ln in [(0, 1.5), (2.5, 1.0), (3.5, 0.45)]:
            tt = np.arange(int(ln * BEAT * SR)) / SR
            add(bass, t0 + beat * BEAT, np.sin(2 * np.pi * mtof(r) * tt) * np.minimum(1, tt / 0.01) * np.exp(-tt * 1.6) * 0.5)
        for beat in range(8):                             # swung 8th-note pattern
            at = t0 + beat * 0.5 * BEAT + (0.06 if beat % 2 else 0.0)
            tt = np.arange(int(0.35 * SR)) / SR
            if beat in (0, 5):                            # kick
                add(drums, at, np.sin(2 * np.pi * (55 + 90 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 9) * 0.9)
            if beat in (2, 6):                            # soft snare
                add(drums, at, (lowpass(rng.standard_normal(len(tt)), 5000) * 0.5 + np.sin(2 * np.pi * 190 * tt) * 0.3) * np.exp(-tt * 18) * 0.6)
            hat = np.diff(rng.standard_normal(int(0.06 * SR) + 1)) * np.exp(-np.arange(int(0.06 * SR)) / SR * 60)
            add(drums, at, hat * (0.16 if beat % 2 else 0.24))
        t0 += bar; b += 1
    crackle = np.zeros(n)
    idx = rng.integers(0, n, int(total * 14)); crackle[idx] = rng.uniform(-0.25, 0.25, len(idx))
    hiss = lowpass(rng.standard_normal(n), 3000) * 0.004
    mix = lowpass(keys, 2600) + lowpass(bass, 400) + lowpass(drums, 6000) * 0.8 + crackle * 0.3 + hiss
    mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.8
    with wave.open(os.path.join(HERE, "build", "music.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
    print(f"music -> build/music.wav ({total:.1f}s, {BPM} bpm)")


if __name__ == "__main__":
    main()
