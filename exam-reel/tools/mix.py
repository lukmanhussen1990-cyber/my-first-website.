#!/usr/bin/env python3
"""Code-generated sound effects + final audio mix (no ElevenLabs involved).

Reads scene/shots.json (exported by `node tools/render.js --dump scene/shots.json`)
and audio/voice_track.wav (built by tools/build_timeline.py from the saved
ElevenLabs files, if present). Writes audio/final_mix.wav.

Sounds: clock ticks (every second, louder on the clock shot and in the quiet
beats), small whooshes on punch-in cuts, sniffs, a cartoon "bloop" when the
trousers fill up, soft chimes for the hearts and a paper rustle for the note.
"""
import json
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 44100
DUR = 45.0
rs = np.random.RandomState(7)


def env(n, a, d):
    e = np.ones(n, np.float32)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na)
    e *= np.exp(-np.arange(n) / (d * SR)).astype(np.float32)
    return e


def lowpass(x, alpha):
    y = np.zeros_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc); y[i] = acc
    return y


def tick(pitch):
    n = int(0.05 * SR); t = np.arange(n) / SR
    click = np.sin(2 * np.pi * pitch * t) * np.exp(-t / 0.006)
    body = np.sin(2 * np.pi * pitch * 0.5 * t) * np.exp(-t / 0.012) * 0.5
    noise = rs.randn(n) * np.exp(-t / 0.002) * 0.4
    return (click + body + noise).astype(np.float32)


def whoosh(length=0.32):
    n = int(length * SR); t = np.linspace(0, 1, n)
    x = rs.randn(n).astype(np.float32)
    # sweep a simple one-pole low-pass from dark to bright and back
    y = np.zeros(n, np.float32); acc = 0.0
    for i in range(n):
        a = 0.02 + 0.25 * np.sin(np.pi * t[i]) ** 2
        acc += a * (x[i] - acc); y[i] = acc
    y -= lowpass(y, 0.01)
    return y * np.sin(np.pi * t) ** 1.5 * 3.0


def sniff():
    n = int(0.22 * SR); t = np.linspace(0, 1, n)
    x = rs.randn(n).astype(np.float32)
    x = x - lowpass(x, 0.18)                  # nasal hiss (high-passed noise)
    e = (t ** 1.2) * np.exp(-((t - 0.75) / 0.18) ** 2 * 0.5) * (1 - t ** 8)
    return x * e * 1.2


def bloop():
    n = int(0.42 * SR); t = np.arange(n) / SR
    f = 190 * np.exp(-t * 5.5) + 55
    ph = 2 * np.pi * np.cumsum(f) / SR
    wob = 1 + 0.25 * np.sin(2 * np.pi * 18 * t)
    return (np.sin(ph) * wob * env(n, 0.01, 0.13)).astype(np.float32)


def chime():
    n = int(0.6 * SR); t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * f * t) for f, a in [(1568, 0.6), (2093, 0.4), (3136, 0.15)])
    return (s * env(n, 0.003, 0.18)).astype(np.float32)


def rustle():
    n = int(0.45 * SR); t = np.linspace(0, 1, n)
    x = rs.randn(n).astype(np.float32)
    x = x - lowpass(x, 0.3)
    crackle = (rs.rand(n) < 0.004).astype(np.float32) * rs.randn(n) * 3
    return (x * 0.5 + crackle) * np.sin(np.pi * t) * (0.6 + 0.4 * np.sin(t * 40))


def place(track, clip, at, gain):
    i = int(round(at * SR))
    if i >= len(track) or i + len(clip) <= 0:
        return
    j0 = max(0, -i); i = max(0, i)
    seg = clip[j0:j0 + len(track) - i]
    track[i:i + len(seg)] += seg * gain


def read_wav(p):
    with wave.open(str(p)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        if w.getnchannels() == 2:
            x = x.reshape(-1, 2).mean(1)
    return x


def main():
    meta = json.loads((ROOT / "scene" / "shots.json").read_text())
    tl = json.loads((ROOT / "scene" / "timeline.json").read_text())
    shots, ev = meta["shots"], meta["events"]
    seg = {s["id"]: s for s in tl["segments"]}
    n = int(DUR * SR)
    sfx = np.zeros(n, np.float32)

    # clock: one tick per second (matches the second hand), louder on the clock shot / quiet beats
    loud = [tuple(x) for x in ev.get("clockShots", [])]
    quiet = [(seg["S15"]["start"], seg["S16"]["start"]), (seg["S18"]["start"], seg["S19"]["start"])]
    tk, tc = tick(2900), tick(2300)
    for k in range(int(DUR)):
        g = 0.035
        if any(a - 0.05 <= k <= b for a, b in loud):
            g = 0.22
        elif any(a <= k <= b for a, b in quiet):
            g = 0.11
        place(sfx, tk if k % 2 == 0 else tc, k, g)

    w = whoosh()
    for s in shots:
        if s["whoosh"]:
            place(sfx, w, s["t0"] - 0.16, 0.16)
    sn = sniff()
    for t in ev["sniffs"]:
        place(sfx, sn, t, 0.22)
    place(sfx, bloop(), ev["poop"], 0.35)
    ch = chime()
    for t in ev["hearts"]:
        place(sfx, ch, t + 0.05, 0.07)
    place(sfx, rustle(), ev["noteOpen"] - 0.1, 0.12)

    vt = ROOT / "audio" / "voice_track.wav"
    voice = np.zeros(n, np.float32)
    if vt.exists():
        v = read_wav(vt)[:n]; voice[:len(v)] = v
    mix = voice + sfx
    # fade the very end with the picture
    fade = np.clip((DUR - np.arange(n) / SR) / 0.9, 0, 1).astype(np.float32)
    mix *= fade
    peak = float(np.max(np.abs(mix)) or 1)
    if peak > 0.97:
        mix *= 0.97 / peak
    out = ROOT / "audio" / "final_mix.wav"
    y = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(out), "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes(y.tobytes())
    print(f"wrote {out}  (voice: {'yes' if vt.exists() else 'NO - sfx only'})")


if __name__ == "__main__":
    main()
