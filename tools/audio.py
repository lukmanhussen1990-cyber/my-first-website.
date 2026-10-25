"""Soundtrack: procedural ambient pad (suspended -> minor S3–S11 -> major from S12),
synthesized SFX from build/sfx_events.json, voice ducking (-8 dB), and mastering to
-14 LUFS integrated / -1 dBTP. Everything is generated here — no samples, royalty-free.

    .venv/bin/python tools/audio.py      -> build/mix.wav
"""
import json, os
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, sosfiltfilt, fftconvolve, resample_poly
import pyloudnorm as pyln

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build")
SR = 48000
RNG = np.random.default_rng(7)


def T(n): return np.arange(n) / SR
def db(x): return 10 ** (x / 20)
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)
def env_ad(n, a, d, curve=4.0):
    t = T(n); e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) * curve / max(d, 1e-4)); return e
def fade(x, fi, fo):
    n = len(x); a = min(n, int(fi * SR)); b = min(n, int(fo * SR))
    if a: x[:a] *= np.linspace(0, 1, a) ** 1.5
    if b: x[-b:] *= np.linspace(1, 0, b) ** 1.5
    return x
def noise(n): return RNG.standard_normal(n)
def pan(x, p):  # p in [-1,1] -> stereo (constant power)
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1)


def reverb_ir(sec=2.6, decay=3.2, bright=6000):
    n = int(sec * SR)
    t = T(n)
    ir = np.stack([noise(n), noise(n)], 1) * np.exp(-t * decay)[:, None]
    ir = np.stack([lp(ir[:, 0], bright), lp(ir[:, 1], bright)], 1)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum(0, keepdims=True))


def reverb(x, ir, wet=0.3):
    if x.ndim == 1: x = np.stack([x, x], 1)
    y = np.stack([fftconvolve(x[:, 0], ir[:, 0])[: len(x)], fftconvolve(x[:, 1], ir[:, 1])[: len(x)]], 1)
    return x * (1 - wet) + y * wet


# ------------------------------------------------------------------ music
NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}
def hz(name, octv): return 440 * 2 ** ((NOTE[name] + 12 * (octv + 1) - 69) / 12)

CHORDS = {
    "Dsus2": [("D", 2), ("A", 3), ("D", 4), ("E", 4), ("A", 4)],
    "Gmaj7": [("G", 2), ("D", 3), ("B", 3), ("F#", 4), ("D", 5)],
    "Bm7":   [("B", 1), ("F#", 3), ("A", 3), ("D", 4), ("F#", 4)],
    "Dm":    [("D", 2), ("A", 3), ("D", 4), ("F", 4), ("A", 4)],
    "Bb":    [("A#", 1), ("F", 3), ("A#", 3), ("D", 4), ("F", 4)],
    "Gm":    [("G", 2), ("D", 3), ("G", 3), ("A#", 3), ("D", 4)],
    "Asus":  [("A", 1), ("E", 3), ("A", 3), ("D", 4), ("E", 4)],
    "A":     [("A", 1), ("E", 3), ("A", 3), ("C#", 4), ("E", 4)],
    "Dm9":   [("D", 2), ("A", 3), ("C", 4), ("E", 4), ("F", 4)],
    "Cluster": [("D", 2), ("G#", 2), ("D", 3), ("D#", 4), ("A", 4)],
    "D":     [("D", 2), ("A", 3), ("D", 4), ("F#", 4), ("A", 4)],
    "G":     [("G", 1), ("D", 3), ("G", 3), ("B", 3), ("D", 4)],
    "Bm":    [("B", 1), ("F#", 3), ("B", 3), ("D", 4), ("F#", 4)],
    "Dadd9": [("D", 2), ("A", 3), ("E", 4), ("F#", 4), ("A", 4)],
}


def pad_voice(f, n, det=0.006, bright=1400):
    t = T(n)
    ph = RNG.random(6)
    v = np.zeros(n)
    for k, d in enumerate([-det, 0, det]):
        fr = f * (1 + d)
        saw = 2 * ((t * fr + ph[k]) % 1) - 1
        v += saw * 0.33
    v = lp(v, min(bright, 8000), 2)
    v += 0.35 * np.sin(2 * np.pi * f * t + ph[4])
    return v


def music(sections, total, ir):
    """sections: list of (t0, t1, chord, level, brightness)"""
    n = int(total * SR)
    out = np.zeros((n, 2))
    for (t0, t1, ch, lvl, br) in sections:
        a, b = int(max(0, t0 - 0.6) * SR), int(min(total, t1 + 1.4) * SR)
        m = b - a
        if m <= 0: continue
        seg = np.zeros((m, 2))
        for i, (nm, o) in enumerate(CHORDS[ch]):
            f = hz(nm, o)
            v = pad_voice(f, m, bright=br if i else 600) * (0.9 if i == 0 else 0.55)
            seg += pan(v, (-0.6 + 1.2 * i / 4) * 0.7)
        env = np.ones(m)
        att, rel = int(1.1 * SR), int(1.6 * SR)
        env[:att] = np.sin(np.linspace(0, np.pi / 2, att)) ** 2
        env[-rel:] = np.cos(np.linspace(0, np.pi / 2, rel)) ** 2
        # slow breathing swell
        env *= 0.85 + 0.15 * np.sin(2 * np.pi * T(m) / 5.3 + t0)
        out[a:b] += seg * env[:, None] * lvl
    out = reverb(out, ir, 0.45)
    return out * 0.11


def bells(times_notes, total, ir, gain=0.06):
    n = int(total * SR)
    out = np.zeros((n, 2))
    for t, f, g in times_notes:
        m = int(2.6 * SR)
        a = int(t * SR)
        if a >= n: continue
        m = min(m, n - a)
        tt = T(m)
        v = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 2.01 * tt) * np.exp(-tt * 3) + 0.12 * np.sin(2 * np.pi * f * 3.0 * tt) * np.exp(-tt * 6))
        v *= env_ad(m, 0.004, 2.4, 5.0) * g
        out[a:a + m] += pan(v, RNG.uniform(-0.5, 0.5))
    return reverb(out, ir, 0.5) * gain


# ------------------------------------------------------------------ sfx
def sfx(kind, dur, g):
    if kind == "whoosh":
        n = int(0.9 * SR); t = T(n)
        x = noise(n)
        f = 250 + 2600 * np.sin(np.pi * np.clip(t / 0.75, 0, 1)) ** 2
        y = np.zeros(n)
        for k in range(0, n, 480):  # piecewise band-pass sweep
            sl = slice(k, min(n, k + 480))
            y[sl] = bp(x[max(0, k - 2400):sl.stop], f[k] * 0.6, f[k] * 1.4)[-(sl.stop - k):]
        e = np.sin(np.pi * np.clip(t / 0.85, 0, 1)) ** 2
        p = np.linspace(-0.7, 0.7, n)
        return np.stack([y * e * np.cos((p + 1) * np.pi / 4), y * e * np.sin((p + 1) * np.pi / 4)], 1) * 0.5 * g
    if kind == "rumble":
        n = int(dur * SR); t = T(n)
        x = lp(noise(n), 90, 4) * 3.2 + 0.4 * np.sin(2 * np.pi * 38 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.23 * t))
        x *= 0.7 + 0.3 * lp(noise(n), 1.5, 1) * 6
        return pan(fade(x, 1.2, 1.5), 0) * 0.35 * g
    if kind == "wind":
        n = int(dur * SR)
        x = bp(noise(n), 250, 900) * (0.6 + 0.4 * np.sin(2 * np.pi * T(n) / 3.7))
        return np.stack([fade(x.copy(), 1, 1.5), fade(np.roll(x, 3000), 1, 1.5)], 1) * 0.12 * g
    if kind == "thunder":
        n = int(3.4 * SR); t = T(n)
        crack = hp(noise(n), 900) * np.exp(-t * 40) * 0.9
        roll = lp(noise(n), 260, 3) * 4 * np.exp(-t * 1.25) * (0.6 + 0.4 * np.abs(lp(noise(n), 6, 1)) * 8)
        boom = np.sin(2 * np.pi * (48 - 10 * t) * t) * np.exp(-t * 2.2) * 0.6
        x = crack + roll + boom
        return pan(x, RNG.uniform(-0.3, 0.3)) * 0.42 * g
    if kind == "murmur":
        n = int(dur * SR)
        x = np.zeros(n)
        for v in range(10):
            f0 = RNG.uniform(250, 900)
            syl = np.clip(lp(noise(n), RNG.uniform(3, 6), 1) * 30, 0, 1)
            x += bp(noise(n), f0, f0 * 1.6) * syl
        x = lp(x, 1800)
        return np.stack([fade(x.copy(), 0.8, 1.2), fade(np.roll(x, 2400), 0.8, 1.2)], 1) * 0.16 * g
    if kind == "timelapse":
        n = int(dur * SR); t = T(n)
        out = np.zeros(n)
        tick_t = 0.0; k = 0
        while tick_t < dur - 0.05:
            a = int(tick_t * SR); m = min(int(0.03 * SR), n - a)
            out[a:a + m] += bp(noise(m), 2500, 6000) * np.exp(-T(m) * 200)
            k += 1; tick_t += max(0.035, 0.22 * (1 - tick_t / dur) ** 1.4)
        sw = bp(noise(n), 400, 2400) * np.sin(np.pi * t / dur) ** 2 * 0.4
        return pan(out * 0.6 + sw, 0) * 0.35 * g
    if kind == "drums":
        n = int(dur * SR); out = np.zeros(n)
        bpm = 132; step = 60 / bpm / 2
        pattern = [1, 0, 0.5, 0, 0.8, 0.35, 0.5, 0]
        k = 0; t0 = 0
        while t0 < dur - 0.2:
            v = pattern[k % 8]
            if v:
                a = int(t0 * SR); m = min(int(0.3 * SR), n - a); tt = T(m)
                thump = np.sin(2 * np.pi * (95 - 50 * tt) * tt) * np.exp(-tt * 14)
                slap = bp(noise(m), 900, 3200) * np.exp(-tt * 45) * 0.35
                out[a:a + m] += (thump + slap) * v
            k += 1; t0 += step
        return pan(lp(fade(out, 0.6, 0.8), 2500), 0.15) * 0.3 * g
    if kind == "swell":
        n = int(dur * SR); t = T(n)
        rise = (t / dur) ** 2
        x = np.zeros(n)
        for f in [hz("D", 4), hz("A", 4), hz("D", 5), hz("F#", 5), hz("A", 5), hz("D", 6)]:
            x += np.sin(2 * np.pi * f * t + RNG.random() * 6) * (0.8 + 0.2 * np.sin(2 * np.pi * 5.5 * t))
        air = hp(noise(n), 3000) * 0.25
        x = (x * 0.12 + air) * rise
        x[-int(0.4 * SR):] *= np.linspace(1, 0, int(0.4 * SR))
        boom_n = int(2.5 * SR); bt = T(boom_n)
        boom = np.sin(2 * np.pi * (60 - 18 * bt) * bt) * np.exp(-bt * 1.6) * 0.8 + lp(noise(boom_n), 200) * np.exp(-bt * 2) * 2
        y = np.zeros(n + boom_n); y[:n] += x; y[n - int(0.3 * SR):n - int(0.3 * SR) + boom_n] += boom
        return np.stack([y, np.roll(y, 600)], 1) * 0.5 * g
    if kind == "thud":
        n = int(0.8 * SR); t = T(n)
        x = np.sin(2 * np.pi * (70 - 30 * t) * t) * np.exp(-t * 9) + lp(noise(n), 400) * np.exp(-t * 18) * 1.5
        return pan(x, 0) * 0.45 * g
    if kind == "tension":
        n = int(dur * SR); t = T(n)
        x = np.zeros(n)
        for f0 in [hz("D", 5), hz("D#", 5), hz("A", 5)]:
            f = f0 * (1 + 0.04 * t / dur)
            x += np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.7 + 0.3 * np.sin(2 * np.pi * 7 * t))
        x *= np.sin(np.pi * np.clip(t / dur, 0, 1)) * 0.12
        return np.stack([x, np.roll(x, 900)], 1) * g
    if kind == "snap":
        f = RNG.uniform(700, 1300)
        n = int(0.9 * SR)
        L = int(SR / f)
        buf = noise(L) * 0.9; out = np.zeros(n)
        for i in range(n):  # Karplus-Strong pluck
            out[i] = buf[i % L]
            buf[i % L] = 0.5 * (buf[i % L] + buf[(i + 1) % L]) * 0.994
        click = hp(noise(n), 3000) * np.exp(-T(n) * 220) * 0.8
        x = out * np.exp(-T(n) * 5) + click
        return pan(x, RNG.uniform(-0.6, 0.6)) * 0.35 * g
    if kind in ("shimmer", "dawn", "logo"):
        n = int((dur if kind != "logo" else 2.6) * SR); t = T(n)
        x = np.zeros(n)
        cnt = int(dur * 14) if kind != "logo" else 30
        notes = [hz(nm, o) for nm, o in [("D", 6), ("F#", 6), ("A", 6), ("E", 6), ("D", 7), ("A", 5)]]
        for _ in range(cnt):
            a = int(RNG.uniform(0, max(0.1, n / SR - 0.4)) * SR); m = min(int(0.9 * SR), n - a); tt = T(m)
            f = notes[RNG.integers(len(notes))] * (1 if kind != "dawn" else 0.5)
            x[a:a + m] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 6) * RNG.uniform(0.3, 1)
        x *= np.sin(np.pi * np.clip(t / (n / SR), 0, 1)) ** 0.7
        if kind == "dawn":  # a few bird chirps
            for _ in range(7):
                a = int(RNG.uniform(0.3, n / SR - 0.5) * SR); m = int(0.12 * SR); tt = T(m)
                f = 2600 + 1400 * np.sin(np.pi * tt / 0.12) + RNG.uniform(-300, 300)
                x[a:a + m] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / 0.12) * 0.25
        if kind == "logo":
            bt = T(n)
            x += np.sin(2 * np.pi * hz("D", 2) * bt) * np.exp(-bt * 1.2) * 0.8
            for f in [hz("D", 4), hz("A", 4), hz("F#", 5)]:
                x += np.sin(2 * np.pi * f * bt) * np.exp(-bt * 1.4) * 0.35
        return np.stack([x, np.roll(x, 700)], 1) * 0.16 * g
    if kind == "paper":
        n = int(0.5 * SR); t = T(n)
        x = bp(noise(n), 1800, 7000) * np.sin(np.pi * np.clip(t / 0.42, 0, 1)) ** 1.5 * (0.7 + 0.3 * np.abs(lp(noise(n), 30)) * 6)
        return pan(x, 0.1) * 0.4 * g
    if kind == "kneel":
        n = int(0.5 * SR); t = T(n)
        x = lp(noise(n), 700) * np.exp(-t * 14) * 1.6 + np.sin(2 * np.pi * 80 * t) * np.exp(-t * 16) * 0.4
        return pan(x, -0.1) * 0.4 * g
    if kind in ("chime", "chime2"):
        n = int(2.4 * SR); t = T(n)
        fs = [hz("A", 5), hz("E", 6)] if kind == "chime" else [hz("D", 5), hz("F#", 5), hz("A", 5)]
        x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * (2.5 + i)) for i, f in enumerate(fs))
        return pan(x, -0.3 if kind == "chime" else 0.3) * 0.12 * g
    if kind == "type":
        n = int(0.04 * SR)
        x = bp(noise(n), 2000, 6000) * np.exp(-T(n) * 260)
        return pan(x, 0.2) * 0.25 * g
    if kind in ("heart", "pop"):
        n = int(0.09 * SR); t = T(n)
        f0, f1 = (600, 950) if kind == "heart" else (1100, 650)
        x = np.sin(2 * np.pi * np.cumsum(np.linspace(f0, f1, n)) / SR) * np.sin(np.pi * t / 0.09)
        return pan(x, RNG.uniform(-0.2, 0.4)) * 0.18 * g
    if kind == "city_amb":
        n = int(dur * SR)
        x = lp(noise(n), 180, 2) * 2.5 + bp(noise(n), 400, 1200) * 0.12
        return np.stack([fade(x.copy(), 0.2, 1.0), fade(np.roll(x, 4000), 0.2, 1.0)], 1) * 0.1 * g
    raise ValueError(kind)


def place(buf, x, t):
    a = int(t * SR)
    if a >= len(buf): return
    m = min(len(x), len(buf) - a)
    buf[a:a + m] += x[:m]


def true_peak_limit(x, ceiling_db=-1.2):
    """Lookahead limiter driven by the 4x-oversampled (true) peak."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    from scipy.signal import lfilter
    os4 = resample_poly(x, 4, 1, axis=0)
    need = np.minimum(1, db(ceiling_db) / np.maximum(np.abs(os4).max(1), 1e-9))
    g = need[: len(need) // 4 * 4].reshape(-1, 4).min(1)
    g = np.concatenate([g, np.ones(len(x) - len(g))])
    look = int(0.004 * SR)
    gs = uniform_filter1d(minimum_filter1d(g, 2 * look + 1), look)
    rel = np.exp(-1 / (0.08 * SR))
    lf = lfilter([1 - rel], [1, -rel], gs, zi=[gs[0] * rel])[0]
    return x * np.minimum(gs, lf)[:, None]


def main():
    T_ = json.load(open(os.path.join(B, "timings.json")))
    events = json.load(open(os.path.join(B, "sfx_events.json")))
    total = T_["total"]
    n = int(total * SR) + SR
    ir = reverb_ir()
    lines = {L["id"]: L for L in T_["lines"]}
    s = lambda i: lines[i]["words"][0]["s"] - 0.25

    # --- voice (24k -> 48k), light clean-up + a touch of room
    v, vsr = sf.read(os.path.join(B, "voice.wav"), dtype="float64")
    if v.ndim > 1: v = v.mean(1)
    v = resample_poly(v, SR, vsr)
    v = hp(v, 75, 2)
    v = v / (np.abs(v).max() + 1e-9) * 0.7
    vs = reverb(v, reverb_ir(0.9, 7.0, 5000), 0.08)
    voice = np.zeros((n, 2)); voice[: len(vs)] += vs

    # --- music map
    secs = [
        (0, s("S2"), "Dsus2", 1.0, 1300), (s("S2"), s("S3"), "Gmaj7", 1.0, 1300),
        (s("S3"), s("S4"), "Dm", 1.0, 1100), (s("S4"), s("S5"), "Bb", 1.1, 1300), (s("S5"), s("S6"), "Gm", 1.0, 1100),
        (s("S6"), s("S7"), "Asus", 0.95, 1200), (s("S7"), s("S8"), "Dm9", 0.9, 900),
        (s("S8"), s("S9"), "Bb", 1.05, 1600), (s("S9"), s("S11"), "Cluster", 0.85, 900), (s("S11"), s("S12"), "Dm", 0.8, 800),
        (s("S12"), s("S13"), "Bm7", 0.85, 1100), (s("S13"), s("S14"), "G", 0.95, 1300), (s("S14"), s("S15"), "Bm", 0.9, 1200),
        (s("S15"), s("S16"), "A", 0.95, 1400), (s("S16"), s("S17"), "D", 1.1, 1700), (s("S17"), s("S18"), "G", 0.9, 1300),
        (s("S18"), T_["voice_end"], "Dadd9", 0.9, 1400), (T_["voice_end"], total, "D", 1.0, 1800),
    ]
    mus = np.zeros((n, 2))
    m = music(secs, total, ir)
    mus[: len(m)] += m
    # warm bell arpeggio once grace enters (S12 ->)
    arps = []
    seq = {"Bm7": ["B", "D", "F#", "A"], "G": ["G", "B", "D", "F#"], "Bm": ["B", "D", "F#", "B"], "A": ["A", "C#", "E", "A"], "D": ["D", "F#", "A", "E"], "Dadd9": ["D", "E", "F#", "A"]}
    for (t0, t1, ch, _, _) in secs:
        if ch in seq and t0 >= s("S12") - 0.1 and t0 < T_["voice_end"]:
            k = 0; tt = t0 + 0.2
            while tt < t1 - 0.3:
                nm = seq[ch][k % 4]
                arps.append((tt, hz(nm, 5 if nm not in ("A", "B") else 4), 0.8 if k % 4 == 0 else 0.55))
                k += 1; tt += 0.62
    bl = bells(arps, total, ir, 0.05)
    mus[: len(bl)] += bl

    # --- duck music -8 dB under the voice
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    e = uniform_filter1d(np.abs(v), int(0.05 * SR))
    act = (e > 0.02).astype(float)
    g = uniform_filter1d(maximum_filter1d(act, int(0.3 * SR)), int(0.3 * SR))
    duck = np.ones(n); duck[: len(g)] = db(-8 * g)
    mus *= duck[:, None]

    # --- sfx
    BEDS = {"city_amb", "wind", "rumble", "murmur", "drums", "dawn", "tension", "timelapse", "shimmer"}
    beds = np.zeros((n, 2)); hits = np.zeros((n, 2))
    for ev in events:
        x = sfx(ev["type"], ev.get("dur", 0) or 1.0, ev.get("gain", 1.0))
        place(beds if ev["type"] in BEDS else hits, x, ev["t"])

    mix = voice * db(0) + mus * db(-3) + beds * db(-13) + hits * db(-5)
    # gentle master: tame very lows, soft-clip safety
    mix = np.stack([hp(mix[:, 0], 30), hp(mix[:, 1], 30)], 1)
    mix = mix[: int(total * SR)]
    # final fade
    fo = int(0.35 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]

    meter = pyln.Meter(SR)
    for it in range(3):
        L = meter.integrated_loudness(mix)
        mix *= db(-14.0 - L)
        mix = true_peak_limit(mix, -1.3)
    L = meter.integrated_loudness(mix)
    tp = 20 * np.log10(np.abs(resample_poly(mix, 4, 1, axis=0)).max())
    print(f"integrated {L:.2f} LUFS, true peak {tp:.2f} dBTP")
    sf.write(os.path.join(B, "mix.wav"), mix.astype(np.float32), SR, subtype="PCM_24")
    
    print("wrote build/mix.wav")


if __name__ == "__main__":
    main()
