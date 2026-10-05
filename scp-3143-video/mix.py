"""Build the soundtrack: narration + synthesized rain, noir music bed and SFX.

Reads build/plan.json (written by `node render.js plan`) and the narration
clips, writes build/mix.wav (48 kHz stereo). Everything except the voice is
synthesized here, so there are no third-party audio assets.
"""
import json
import os

import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
SR = 48000
rng = np.random.default_rng(3143)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def tt(d):
    return np.arange(int(d * SR)) / SR


def noise(d):
    return rng.standard_normal(int(d * SR))


def decay(d, k):
    return np.exp(-tt(d) * k)


def tone(f, d, k=0.0):
    return np.sin(2 * np.pi * f * tt(d)) * (decay(d, k) if k else 1)


# ------------------------------------------------------------------ sfx ----
def click(gain=1.0, f=2500):
    return bp(noise(0.03), f * 0.6, min(f * 1.6, 20000)) * decay(0.03, 160) * gain


def sfx_type(e):
    n, cps = e["n"], e["cps"]
    out = np.zeros(int((n / cps + 0.3) * SR))
    for i in range(n):
        if rng.random() < 0.12:
            continue  # spaces / soft keys
        s = int((i / cps + rng.uniform(-0.01, 0.01)) * SR)
        c = click(0.35 * rng.uniform(0.6, 1.0), rng.uniform(1800, 3400))
        c[: int(0.006 * SR)] += lp(noise(0.006), 300) * 0.5
        s = max(s, 0)
        out[s:s + len(c)] += c[: len(out) - s]
    return out


def sfx(e):
    k = e["type"]
    g = e.get("gain", 1.0)
    if k == "type":
        return sfx_type(e)
    if k == "thunder":
        x = lp(noise(5.0), 180, 4) * decay(5.0, 0.9)
        x[: int(0.12 * SR)] *= np.linspace(0, 1, int(0.12 * SR))
        crack = hp(noise(0.5), 1500) * decay(0.5, 9) * 0.3
        x[: len(crack)] += crack
        return x * 1.6 * g
    if k == "ding":
        return (tone(1760, 1.5, 3) + 0.4 * tone(3520, 1.5, 5) + 0.2 * tone(2637, 1.5, 4)) * 0.18 * g
    if k == "boom":
        d = 2.0
        f = 55 * np.exp(-tt(d) * 2) + 30
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(d, 2.2)
        return (x + lp(noise(d), 400) * decay(d, 5) * 0.4) * 0.75 * g
    if k in ("whoosh", "blinds"):
        d = 0.7
        env = np.sin(np.pi * tt(d) / d) ** 2
        x = bp(noise(d), 300, 3500) * env * 0.22
        if k == "blinds":  # slat rattle
            for i in range(9):
                c = click(0.25, 1400 + 120 * i)
                s = int((0.05 + i * 0.045) * SR)
                x[s:s + len(c)] += c
        return x * g
    if k == "stamp":
        d = 0.5
        x = lp(noise(d), 900, 4) * decay(d, 18) * 1.4 + tone(70, d, 12) * 0.8
        return x * 0.8 * g
    if k == "pop":
        d = 0.18
        f = 900 * np.exp(-tt(d) * 25) + 300
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(d, 24) * 0.22 * g
    if k == "warp":
        d = 1.6
        f = 220 + 80 * np.sin(2 * np.pi * 3 * tt(d))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt(d) / d) * 0.12 * g
    if k == "flatten":
        d = 1.0
        f = 400 * np.exp(-tt(d) * 3) + 40
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(d, 3) * 0.3
        return (x + bp(noise(d), 200, 2000) * decay(d, 4) * 0.15) * g
    if k == "click":
        return click(0.6, 1500) * g
    if k == "cock":
        return np.concatenate([click(0.8, 3000), np.zeros(int(0.09 * SR)), click(1.0, 2200)]) * g
    if k == "rewind":
        d = 0.8
        f = 300 + 1500 * tt(d) / d
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt(d) / d) * 0.08 * g
    if k == "projector":
        d = e.get("dur", 4.0)
        x = np.zeros(int(d * SR))
        for i in range(int(d * 18)):
            c = click(0.05, 1200)
            s = int(i / 18 * SR)
            x[s:s + len(c)] += c[: len(x) - s]
        fade = np.minimum(1, np.minimum(tt(d) / 0.5, (d - tt(d)) / 0.5))
        return (x + lp(noise(d), 200) * 0.02) * fade * g
    if k == "scan":
        d = max(e.get("dur", 2.0), 0.3)
        return tone(880, d) * (0.5 + 0.5 * np.sin(2 * np.pi * 6 * tt(d))) * 0.03 * g
    if k == "alert":
        return np.concatenate([tone(1320, 0.12, 6), np.zeros(int(0.05 * SR)), tone(1320, 0.12, 6)]) * 0.15 * g
    if k == "shatter":
        x = np.zeros(int(1.2 * SR))
        for i in range(14):
            c = click(rng.uniform(0.1, 0.3), rng.uniform(2000, 6000))
            s = int(rng.uniform(0, 0.8) * SR)
            x[s:s + len(c)] += c
        return x * g
    if k == "lock":
        return np.concatenate([click(0.7, 1800), np.zeros(int(0.06 * SR)), tone(660, 0.25, 12) * 0.15]) * g
    if k == "siren":
        d = 2.2
        f = 700 + 250 * np.sin(2 * np.pi * 1.2 * tt(d))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt(d) / d) * 0.05 * g
    if k == "paper":
        d = 0.45
        return bp(noise(d), 1500, 7000) * np.sin(np.pi * tt(d) / d) * 0.1 * g
    if k == "scribble":
        d = 0.4
        return bp(noise(d), 2500, 6000) * (0.5 + 0.5 * np.sin(2 * np.pi * 14 * tt(d))) * 0.08 * g
    if k == "glitch":
        d = 0.7
        x = np.sign(np.sin(2 * np.pi * 110 * tt(d))) * 0.05 + bp(noise(d), 500, 5000) * 0.12
        gate = (np.floor(tt(d) * 30) % 3 != 0)
        return x * gate * decay(d, 2) * g
    if k == "tick":
        return click(0.5, 3500) * g
    if k == "fall":
        d = 1.2
        f = 900 * np.exp(-tt(d) * 2) + 80
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(d, 1.5) * 0.06 * g
    if k in ("thud", "clunk"):
        d = 0.4
        return (tone(90, d, 14) * 0.6 + lp(noise(d), 500) * decay(d, 20) * 0.6) * g
    if k == "lighter":
        x = np.concatenate([click(0.6, 4000), np.zeros(int(0.04 * SR)), bp(noise(0.6), 800, 4000) * decay(0.6, 4) * 0.12])
        return x * g
    if k == "door":
        d = 0.8
        return (tone(70, d, 8) * 0.6 + lp(noise(d), 300) * decay(d, 9) * 0.5) * g
    if k == "alarm":
        return np.concatenate([tone(880, 0.25), tone(660, 0.25)]) * 0.1 * np.concatenate([np.ones(int(0.45 * SR)), np.linspace(1, 0, int(0.05 * SR))]) * g
    if k == "marker":
        d = 0.5
        return bp(noise(d), 1200, 4000) * np.sin(np.pi * tt(d) / d) * 0.05 * g
    print("  unknown sfx", k)
    return np.zeros(1)


# ---------------------------------------------------------------- music ----
def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def pad_voice(f, d):
    t = tt(d)
    vib = 1 + 0.002 * np.sin(2 * np.pi * 4.5 * t)
    x = sum(np.sin(2 * np.pi * f * h * np.cumsum(vib) / SR + h) / h ** 1.6 for h in range(1, 6))
    x += sum(np.sin(2 * np.pi * f * 1.004 * h * t) / h ** 1.6 for h in range(1, 4))
    return x


def music_bed(n):
    """Slow minor-key jazz bed: pad chords + plucked bass, 64 bpm."""
    bar = 4 * 60 / 64
    chords = [  # (bass, voicing) in MIDI notes
        (38, [53, 57, 60, 64]),   # Dm9
        (34, [50, 53, 57, 62]),   # Bbmaj7
        (31, [46, 50, 53, 57]),   # Gm9
        (33, [49, 55, 58, 61]),   # A7b9
    ]
    out = np.zeros((n, 2))
    total = n / SR
    i = 0
    while i * bar < total:
        bass, voicing = chords[i % 4]
        s = int(i * bar * SR)
        d = bar + 1.0
        L = min(int(d * SR), n - s)
        if L <= 0:
            break
        env = np.minimum(1, tt(d) / 1.2) * np.minimum(1, np.maximum(0, (d - tt(d)) / 1.0))
        chord = sum(pad_voice(note(m), d) for m in voicing) * env * 0.03
        chord = lp(chord, 1400)
        out[s:s + L, 0] += chord[:L]
        out[s:s + L, 1] += np.roll(chord, 300)[:L]
        for beat in (0, 2, 3.5):  # plucked upright bass
            bs = s + int(beat * bar / 4 * SR)
            m = bass + (7 if beat == 2 else (0 if beat == 0 else 5))
            pl = (tone(note(m), 1.2, 3.5) + 0.3 * tone(note(m) * 2, 1.2, 6)) * 0.16
            pl[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
            e2 = min(len(pl), n - bs)
            if e2 > 0:
                out[bs:bs + e2] += pl[:e2, None]
        for beat in (1, 3):  # brushes
            bs = s + int(beat * bar / 4 * SR)
            br = bp(noise(0.25), 2000, 8000) * decay(0.25, 14) * 0.035
            e2 = min(len(br), n - bs)
            if e2 > 0:
                out[bs:bs + e2, 0] += br[:e2]
                out[bs:bs + e2, 1] += br[:e2] * 0.7
        i += 1
    return out


def tension_bed(n):
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * 36.7 * t) + 0.5 * np.sin(2 * np.pi * 38.9 * t) + 0.3 * np.sin(2 * np.pi * 55 * t)) * 0.08
    x += lp(rng.standard_normal(n), 300) * 0.05 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.1 * t))
    pulse = (np.sin(2 * np.pi * 1.1 * t) > 0.92).astype(float)
    x += lp(pulse, 120) * 0.25
    return np.stack([x, np.roll(x, 400)], axis=1)


def smooth(v, seconds):
    """Moving average via cumulative sum (O(n), unlike np.convolve)."""
    w = max(1, int(seconds * SR))
    c = np.cumsum(np.concatenate([np.zeros(w), v, np.full(w, v[-1])]))
    out = (c[w:] - c[:-w]) / w
    return out[w // 2: w // 2 + len(v)]


def keyframe_curve(keys, n, field="level", smooth_s=0.6):
    t = np.arange(n) / SR
    v = np.zeros(n)
    for i, k in enumerate(keys):
        a = int(k["t"] * SR)
        b = int(keys[i + 1]["t"] * SR) if i + 1 < len(keys) else n
        v[a:b] = k[field]
    return smooth(v, smooth_s)


def main():
    with open(os.path.join(BUILD, "plan.json")) as f:
        plan = json.load(f)
    n = int((plan["duration"] + 0.5) * SR)
    voice = np.zeros(n)
    for item in plan["narration"]:
        x, sr = sf.read(os.path.join(BUILD, item["file"]), dtype="float32")
        if sr != SR:
            x = resample_poly(x, SR, sr)
        s = int(item["t"] * SR)
        voice[s:s + len(x)] += x[: n - s]
    voice = hp(voice, 70)

    fx = np.zeros((n, 2))
    for e in plan["sfx"]:
        x = sfx(e)
        s = max(0, int(e["t"] * SR))
        L = min(len(x), n - s)
        pan = 0.5 + 0.25 * np.sin(e["t"] * 1.7)
        fx[s:s + L, 0] += x[:L] * (1 - pan) * 1.4
        fx[s:s + L, 1] += x[:L] * pan * 1.4

    # music: jazz bed or tension drone, scaled by per-scene keyframes, ducked under the voice
    keys = plan["music"]
    level = keyframe_curve(keys, n)
    tension = keyframe_curve([{**k, "m": 1.0 if k.get("mode") == "tension" else 0.0} for k in keys], n, "m", 1.5)
    bed = music_bed(n) * (1 - tension)[:, None] + tension_bed(n) * tension[:, None]
    speech = smooth((np.abs(voice) > 0.02).astype(float), 0.4)
    duck = 1 - 0.45 * np.clip(speech * 3, 0, 1)
    music = bed * (level * duck)[:, None] * 1.3

    # rain: louder in the street scenes
    rain_lvl = np.full(n, 0.5)
    for sc in plan["scenes"]:
        if sc["id"] in ("cold_open", "outro"):
            a, b = int(sc["start"] * SR), int((sc["start"] + sc["dur"]) * SR)
            rain_lvl[a:b] = 1.0
    rain_lvl = smooth(rain_lvl, 1.0)
    rain = np.stack([bp(rng.standard_normal(n), 400, 9000), bp(rng.standard_normal(n), 400, 9000)], axis=1) * 0.018
    drops = (rng.random((n, 2)) > 0.9994).astype(float)
    rain += lp(drops[:, 0], 3000)[:, None] * np.array([0.5, 0.2]) + lp(drops[:, 1], 3000)[:, None] * np.array([0.2, 0.5])
    rain *= rain_lvl[:, None]

    mix = voice[:, None] * 0.95 + fx + music + rain
    fade = int(1.5 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    peak = np.max(np.abs(mix))
    mix = np.tanh(mix * 1.6) * 0.9  # fixed gain + soft clip; final loudness is set by loudnorm at mux time
    sf.write(os.path.join(BUILD, "mix.wav"), mix.astype(np.float32), SR, subtype="PCM_16")
    print(f"mix: {n / SR:.1f}s, peak before limiting {peak:.2f}")


if __name__ == "__main__":
    main()
