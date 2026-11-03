#!/usr/bin/env python3
"""Code-generated sound effects + final mix (no ElevenLabs). Quiet so the voices stay clear.
Reads scene/shots.json (render.js --dump) and audio/voice_track.wav (if present)."""
import json, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 44100
rs = np.random.RandomState(11)


def lp(x, a):
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc); y[i] = acc
    return y


def env(n, a, d):
    e = np.exp(-np.arange(n) / (d * SR)).astype(np.float32); na = max(1, int(a * SR)); e[:na] *= np.linspace(0, 1, na); return e


def click(f=3200, d=0.012):
    n = int(0.03 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) * np.exp(-t / d) * 0.6 + rs.randn(n) * np.exp(-t / 0.003) * 0.5).astype(np.float32)


def whoosh(L=0.3):
    n = int(L * SR); t = np.linspace(0, 1, n); x = rs.randn(n).astype(np.float32); y = np.zeros(n, np.float32); acc = 0.0
    for i in range(n):
        a = 0.02 + 0.25 * np.sin(np.pi * t[i]) ** 2; acc += a * (x[i] - acc); y[i] = acc
    return (y - lp(y, 0.01)) * np.sin(np.pi * t) ** 1.5 * 3.0


def sniff():
    n = int(0.2 * SR); t = np.linspace(0, 1, n); x = rs.randn(n).astype(np.float32); x = x - lp(x, 0.2)
    return x * (t ** 1.2) * (1 - t ** 6) * 1.1


def printer_jam():
    n = int(1.1 * SR); t = np.arange(n) / SR
    grind = np.sign(np.sin(2 * np.pi * 95 * t + 3 * np.sin(2 * np.pi * 7 * t))) * 0.35
    noise = lp(rs.randn(n).astype(np.float32), 0.15) * 0.8
    stop = np.clip((0.75 - t) / 0.1, 0, 1)
    beeps = ((np.sin(2 * np.pi * 1800 * t) > 0) * 2 - 1) * 0.25 * (((t > 0.8) & (t < 0.9)) | ((t > 0.97) & (t < 1.07)))
    return ((grind + noise) * stop * np.minimum(1, t / 0.05) + beeps).astype(np.float32)


def rumble(L):
    n = int(L * SR); t = np.arange(n) / SR
    x = lp(rs.randn(n).astype(np.float32), 0.02) * 6
    engine = np.sin(2 * np.pi * 38 * t + 0.6 * np.sin(2 * np.pi * 9 * t)) * 0.45 + np.sin(2 * np.pi * 76 * t) * 0.15
    clank = np.zeros(n, np.float32)
    for k in np.arange(0, L, 0.18):
        i = int(k * SR); c = click(900, 0.02)[: n - i] * 0.25; clank[i:i + len(c)] += c
    e = np.minimum(1, t / 0.6) * np.minimum(1, (L - t) / 0.6)
    return ((x + engine + clank) * e).astype(np.float32)


def boom():
    n = int(3.2 * SR); t = np.arange(n) / SR
    low = np.sin(2 * np.pi * (55 * np.exp(-t * 1.5) + 28) * t) * np.exp(-t / 0.9)
    crack = rs.randn(n) * np.exp(-t / 0.08)
    roar = lp(rs.randn(n).astype(np.float32), 0.05) * 4 * np.exp(-t / 1.1)
    return ((low * 1.0 + crack * 0.6 + roar * 0.8)).astype(np.float32)


def cannon():
    n = int(0.6 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.12) + rs.randn(n) * np.exp(-t / 0.05) * 0.7).astype(np.float32)


def rain(L):
    n = int(L * SR); x = rs.randn(n).astype(np.float32); x = x - lp(x, 0.3)
    drops = (rs.rand(n) < 0.002) * rs.randn(n) * 2
    e = np.minimum(1, np.arange(n) / (0.3 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.3 * SR))
    return ((x * 0.35 + drops) * e).astype(np.float32)


def squeeze():
    n = int(0.5 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * (300 + 500 * t) * t) * np.sin(np.pi * t / 0.5) * 0.5 + np.sign(np.sin(2 * np.pi * 60 * t)) * 0.1 * np.sin(np.pi * t / 0.5)).astype(np.float32)


def place(track, clip, at, gain):
    i = int(round(at * SR))
    if i >= len(track): return
    if i < 0: clip = clip[-i:]; i = 0
    seg = clip[:len(track) - i]; track[i:i + len(seg)] += seg * gain


def main():
    d = json.loads((ROOT / "scene" / "shots.json").read_text()); ev = d["events"]; shots = d["shots"]
    tl = json.loads((ROOT / "scene" / "timeline.json").read_text())
    LN = {l["id"]: l for l in tl["lines"]}
    dur = ev["duration"]; n = int(dur * SR)
    sfx = np.zeros(n, np.float32)
    # office keyboard typing from the boss entrance until the office freezes
    t0, t1 = ev["typing"]; t = t0
    while t < t1:
        place(sfx, click(2600 + rs.rand() * 1500), t, 0.05 * (0.6 + rs.rand() * 0.6)); t += 0.06 + rs.rand() * 0.09
    for s in shots:
        if s["whoosh"]: place(sfx, whoosh(), s["t0"] - 0.16, 0.12)
    for t in ev["sniffs"]: place(sfx, sniff(), t, 0.2)
    place(sfx, squeeze(), LN["L06"]["words"][3]["s"], 0.1); place(sfx, squeeze(), LN["L07"]["start"], 0.12)
    place(sfx, printer_jam(), ev["printJam"] - 0.6, 0.12)
    r0, r1 = ev["rain"]; place(sfx, rain(r1 - r0), r0, 0.08)
    a, b = ev["tank"]; place(sfx, rumble(b - a + 1.2), a, 0.22)
    place(sfx, rumble(ev["boom"] - b), b, 0.07)          # idling
    place(sfx, cannon(), ev["fire"], 0.35)
    place(sfx, boom(), ev["boom"], 0.5)
    vt = ROOT / "audio" / "voice_track.wav"; voice = np.zeros(n, np.float32)
    if vt.exists():
        with wave.open(str(vt)) as w:
            v = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        voice[:min(n, len(v))] = v[:n]
    mix = voice + sfx
    mix *= np.clip((dur - np.arange(n) / SR) / 1.2, 0, 1)
    pk = float(np.max(np.abs(mix)) or 1)
    if pk > 0.97: mix *= 0.97 / pk
    with wave.open(str(ROOT / "audio" / "final_mix.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
    print(f"wrote audio/final_mix.wav ({dur:.2f}s, voice: {'yes' if vt.exists() else 'NO - sfx only'})")


if __name__ == "__main__":
    main()
