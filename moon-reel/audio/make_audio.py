"""Procedural soundtrack for the reel: cinematic electronic score + synchronized sound effects.

No voice, speech, vocals or vocal samples of any kind: everything is synthesized from oscillators and
filtered noise. Event times come from src/events.json so every hit lands on its visual cue.

    python3 audio/make_audio.py out/soundtrack.wav
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
ROOT = Path(__file__).resolve().parent.parent
TIMING = json.loads((ROOT / "src" / "events.json").read_text())
E = TIMING["events"]
DUR = TIMING["duration"] + 0.6
N = int(DUR * SR)
BEAT = 60.0 / TIMING["bpm"]
rng = np.random.default_rng(7)


# ------------------------------------------------------------------------------------------ utils
def tt(dur):
    return np.arange(int(dur * SR)) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def buf():
    return np.zeros((2, N))


def place(bus, sig, t0, gain=1.0, pan=0.0):
    """Add mono (n,) or stereo (2, n) signal at time t0 with equal-power pan."""
    i0 = int(round(t0 * SR))
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
    if i0 < 0:
        sig = sig[:, -i0:]
        i0 = 0
    n = min(sig.shape[1], N - i0)
    if n > 0:
        bus[:, i0 : i0 + n] += sig[:, :n] * gain


def filt(x, kind, f, order=2):
    nyq = SR / 2
    if kind == "band":
        sos = butter(order, [max(20, f[0]) / nyq, min(f[1], nyq * 0.95) / nyq], btype="band", output="sos")
    else:
        sos = butter(order, min(f, nyq * 0.95) / nyq, btype=kind, output="sos")
    return sosfilt(sos, x, axis=-1)


def sweep_filter(x, kind, f_of_t, block=512, order=2, bw=None):
    """Time-varying filter: per-block coefficients with carried state (fine for smooth sweeps)."""
    y = np.zeros_like(x)
    zi = None
    nyq = SR / 2
    for s in range(0, x.shape[-1], block):
        f = float(f_of_t((s + block / 2) / SR))
        if kind == "band":
            lo, hi = max(30, f / bw), min(f * bw, nyq * 0.95)
            sos = butter(order, [lo / nyq, hi / nyq], btype="band", output="sos")
        else:
            sos = butter(order, min(max(f, 30), nyq * 0.95) / nyq, btype=kind, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2) + x.shape[:-1])
            zi = np.moveaxis(zi, 2, -1) if x.ndim > 1 else zi
        seg = x[..., s : s + block]
        if x.ndim > 1:
            out = np.empty_like(seg)
            for c in range(x.shape[0]):
                out[c], zi[..., c] = sosfilt(sos, seg[c], zi=zi[..., c])
            y[..., s : s + block] = out
        else:
            y[s : s + block], zi = sosfilt(sos, seg, zi=zi)
    return y


def saw(freq, dur, phase=0.0):
    n = int(dur * SR)
    dt = freq / SR
    p = (phase + dt * np.arange(n)) % 1.0
    y = 2 * p - 1
    m = p < dt
    x = p[m] / dt
    y[m] -= 2 * x - x * x - 1
    m = p > 1 - dt
    x = (p[m] - 1) / dt
    y[m] -= x * x + 2 * x + 1
    return y


def env(n, a, d=0.0, s=1.0, r=0.0, hold=None):
    """Linear-attack / exponential-decay envelope of length n samples."""
    t = np.arange(n) / SR
    e = np.ones(n)
    if a > 0:
        e = np.minimum(1, t / a)
    if d > 0:
        e = e * np.where(t > a, s + (1 - s) * np.exp(-(t - a) / d), 1)
    if r > 0 and hold is not None:
        e = e * np.where(t > hold, np.exp(-(t - hold) / r), 1)
    return e


def noise(dur, color="white"):
    n = int(dur * SR)
    w = rng.standard_normal(n)
    if color == "pink":
        f = np.fft.rfft(w)
        k = np.arange(len(f))
        k[0] = 1
        w = np.fft.irfft(f / np.sqrt(k), n)
    elif color == "brown":
        w = np.cumsum(w)
        w = filt(w, "high", 20)
    return w / (np.abs(w).max() + 1e-9)


def fade_edges(x, fi=0.003, fo=0.01):
    n = x.shape[-1]
    a = min(int(fi * SR), n // 2)
    b = min(int(fo * SR), n // 2)
    if a:
        x[..., :a] *= np.linspace(0, 1, a)
    if b:
        x[..., -b:] *= np.linspace(1, 0, b)
    return x


def reverb_ir(seconds, damp=6000, seed=1, predelay=0.012):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal((2, n)) * np.exp(-6.9 * t / seconds)
    ir = sweep_filter(ir, "low", lambda tt_: damp * np.exp(-tt_ * 1.6) + 900, block=2048)
    pd = int(predelay * SR)
    ir = np.concatenate([np.zeros((2, pd)), ir], axis=1)
    return ir / np.sqrt((ir**2).sum() / 2)


def convolve(x, ir):
    out = np.vstack([fftconvolve(x[c], ir[c])[: x.shape[1]] for c in range(2)])
    return out


# ------------------------------------------------------------------------------------------ harmony
CH = {
    "Dm": [50, 53, 57, 62, 65, 69],
    "Bb": [46, 53, 58, 62, 65, 70],
    "F": [48, 53, 57, 60, 65, 69],
    "C": [48, 52, 55, 60, 64, 67],
    "Dm9": [50, 57, 62, 64, 65, 69],
}
ROOTS = {"Dm": 38, "Bb": 34, "F": 41, "C": 36, "Dm9": 38}
# (start, chord) — None = silence
CHORDS = [
    (0.0, "Dm"), (2.0, "Bb"), (E["moon_vanish"], None),
    (4.0, "Dm"), (6.0, "Bb"), (8.0, "F"), (10.0, "C"),
    (12.0, "Dm"), (14.0, "Bb"), (16.0, "F"), (17.0, "C"),
    (18.0, "Dm"), (20.0, "Bb"), (22.0, "F"), (24.0, "C"),
    (26.0, "Bb"), (28.0, "C"), (E["orbit_text"] + 0.32, "F"), (30.75, "C"), (31.25, "Dm"),
    (32.0, "Bb"), (34.0, "C"), (35.25, "Dm9"), (DUR, None),
]


def chord_at(t):
    cur = None
    for s, c in CHORDS:
        if s <= t:
            cur = c
    return cur


def segments():
    out = []
    for (s, c), (e, _) in zip(CHORDS[:-1], CHORDS[1:]):
        if c:
            out.append((s, e, c))
    return out


# ------------------------------------------------------------------------------------------ sections
def in_ranges(t, ranges):
    return any(a <= t < b for a, b in ranges)


SILENCE = (E["moon_vanish"], E["s2_start"])
KICK_ON = [(0.0, SILENCE[0]), (4.0, 14.9), (16.0, 18.0), (22.0, 26.0), (30.0, 32.0)]
HALF_TIME = [(26.0, 28.0)]
CLAP_ON = [(4.0, 14.9), (16.0, 18.0), (22.0, 26.0), (30.0, 32.0)]
HATS_ON = [(0.0, SILENCE[0]), (4.0, 32.0)]
ARP_ON = [(4.0, SILENCE[0] + 100)]


# ------------------------------------------------------------------------------------------ drums
def kick():
    t = tt(0.5)
    f = 46 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.22)
    click = filt(noise(0.5), "high", 2500) * np.exp(-t / 0.004) * 0.5
    return np.tanh((body + click) * 1.8) * 0.9


def clap():
    t = tt(0.45)
    n = filt(noise(0.45), "band", (900, 6000))
    e = np.zeros_like(t)
    for d in (0.0, 0.011, 0.022):
        e += np.where(t >= d, np.exp(-(t - d) / 0.012), 0) * (t >= d)
    e += np.where(t >= 0.03, np.exp(-(t - 0.03) / 0.16), 0)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.3
    return (n * e + tone) * 0.55


def hat(open_=False):
    d = 0.22 if open_ else 0.045
    t = tt(d * 4)
    n = filt(noise(d * 4), "high", 7500)
    return n * np.exp(-t / d) * (0.32 if open_ else 0.26)


def crash():
    t = tt(3.0)
    n = filt(noise(3.0), "high", 3500)
    return n * np.exp(-t / 0.9) * 0.5


def tom(f0=90):
    t = tt(0.8)
    f = f0 * (1 + 0.6 * np.exp(-t / 0.05))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.35) * 0.8


def snare_roll(bus, t0, t1, gain=0.5):
    """Accelerating, crescendoing snare roll ending at t1."""
    s = clap()
    t = t0
    while t < t1 - 0.01:
        k = (t - t0) / (t1 - t0)
        step = BEAT / (2 if k < 0.4 else 4 if k < 0.75 else 8)
        place(bus, s, t, gain * (0.25 + 0.75 * k**1.5), pan=0.1 * np.sin(t * 9))
        t += step


# ------------------------------------------------------------------------------------------ synths
def supersaw_chord(notes, dur, detune_cents=16, voices=7, attack=0.25, release=0.6):
    n = int((dur + release) * SR)
    out = np.zeros((2, n))
    spread = np.linspace(-1, 1, voices)
    for m in notes:
        for i, d in enumerate(spread):
            f = midi(m) * 2 ** (d * detune_cents / 1200)
            v = saw(f, dur + release, phase=rng.random())
            pan = d * 0.8
            a = (pan + 1) * np.pi / 4
            out[0] += v * np.cos(a)
            out[1] += v * np.sin(a)
    out /= voices * len(notes) ** 0.6
    e = env(n, attack, 0, 1, release, hold=dur)
    return out * e


def pluck(freq, dur=0.32, bright=4200):
    t = tt(dur)
    v = 0.6 * saw(freq, dur) + 0.4 * saw(freq * 1.005, dur, 0.3)
    cutoff = lambda x: 500 + bright * np.exp(-x / 0.06)
    v = sweep_filter(v, "low", cutoff, block=256)
    return v * np.exp(-t / 0.13) * np.minimum(1, t / 0.002)


def bell(freq, dur=3.0):
    t = tt(dur)
    mod = np.sin(2 * np.pi * freq * 3.5 * t) * 2.2 * np.exp(-t / 0.4)
    car = np.sin(2 * np.pi * freq * t + mod)
    car += 0.3 * np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-t / 0.8)
    return car * np.exp(-t / 1.1) * np.minimum(1, t / 0.004)


def braam(root_midi, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    v = np.zeros(n)
    for m, g in ((root_midi, 1.0), (root_midi + 12, 0.6), (root_midi + 7, 0.35)):
        for d in (-8, 0, 8):
            v += saw(midi(m) * 2 ** (d / 1200), dur, rng.random()) * g
    v = sweep_filter(v, "low", lambda x: 180 + 1500 * np.exp(-x / 0.6), block=512)
    return np.tanh(v * 0.5) * np.exp(-t / 1.4) * np.minimum(1, t / 0.03)


# ------------------------------------------------------------------------------------------ sfx
def whoosh(dur, f0=250, f1=3000, f2=600, peak=0.55, pan0=-0.6, pan1=0.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = t / dur
    fc = lambda x: np.interp(x / dur, [0, peak, 1], [f0, f1, f2])
    v = sweep_filter(noise(dur, "pink"), "band", fc, block=256, bw=1.6)
    e = np.interp(k, [0, peak, 1], [0, 1, 0]) ** 1.5
    v = v * e
    pans = np.interp(k, [0, 1], [pan0, pan1])
    a = (pans + 1) * np.pi / 4
    return np.vstack([v * np.cos(a), v * np.sin(a)]) * np.sqrt(2)


def riser(dur, f0=180, f1=1600):
    t = tt(dur)
    k = t / dur
    nz = sweep_filter(noise(dur), "band", lambda x: 400 * (12 ** (x / dur)), block=256, bw=1.4)
    f = f0 * (f1 / f0) ** k
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.35 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.15
    return (nz * 0.8 + tone) * k**2


def boom(dur=3.0, f0=62, f1=27, gain=1.0, decay=0.9):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.35)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    hit = filt(noise(dur), "low", 900) * np.exp(-t / 0.08) * 0.8
    return np.tanh((body + hit) * 1.6) * gain


def shimmer(dur=2.5, seed=3, base=1800):
    r = np.random.default_rng(seed)
    t = tt(dur)
    out = np.zeros((2, len(t)))
    for _ in range(14):
        f = base * (1 + r.random() * 2.2)
        ph = r.random() * 6.28
        v = np.sin(2 * np.pi * f * t + ph) * np.exp(-t / (0.4 + r.random() * 1.2))
        v *= 0.6 + 0.4 * np.sin(2 * np.pi * (4 + r.random() * 6) * t)
        p = r.random() * 2 - 1
        a = (p + 1) * np.pi / 4
        out[0] += v * np.cos(a)
        out[1] += v * np.sin(a)
    return out / 14 * np.minimum(1, t / 0.01)


def reverse_swell(dur=0.9):
    s = shimmer(dur * 1.5, seed=9, base=900)[:, : int(dur * SR)]
    nz = filt(noise(dur), "band", (600, 7000)) * 0.4
    e = (np.arange(int(dur * SR)) / (dur * SR)) ** 2.4
    return (s + nz) * e


def pop(pitch=1.0):
    t = tt(0.16)
    f = 520 * pitch * (1 + 1.4 * (1 - np.exp(-t / 0.025)))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045)
    click = filt(noise(0.16), "band", (2000, 9000)) * np.exp(-t / 0.004) * 0.4
    return (tone + click) * 0.5


def slam():
    t = tt(1.4)
    thump = np.sin(2 * np.pi * np.cumsum(48 + 70 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.28)
    crack = filt(noise(1.4), "band", (1500, 9000)) * np.exp(-t / 0.03) * 0.5
    air = filt(noise(1.4), "high", 4000) * np.exp(-t / 0.35) * 0.18
    return np.tanh((thump * 1.2 + crack + air) * 1.3) * 0.8


def blip(f1=1320, f2=1760):
    t = tt(0.09)
    a = np.sin(2 * np.pi * f1 * t) * np.exp(-t / 0.02)
    b = np.sin(2 * np.pi * f2 * t) * np.exp(-t / 0.03)
    out = np.concatenate([a[: int(0.04 * SR)], b])
    return fade_edges(out, 0.002, 0.01) * 0.35


def zip_up(dur=0.45, f0=400, f1=1800):
    t = tt(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    v = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 28 * t)))
    return fade_edges(v * np.sin(np.pi * t / dur) ** 0.7 * 0.22, 0.004, 0.02)


def tick(hi=True):
    t = tt(0.05)
    v = filt(noise(0.05), "band", (2000, 7000)) * np.exp(-t / 0.004)
    v += np.sin(2 * np.pi * (2900 if hi else 2300) * t) * np.exp(-t / 0.01) * 0.5
    return v * 0.25


def cricket(dur=0.35, f=4600):
    t = tt(dur)
    am = (np.sin(2 * np.pi * 32 * t) > 0.2).astype(float)
    gate = (t < 0.09) | ((t > 0.12) & (t < 0.21)) | ((t > 0.24) & (t < 0.33))
    return np.sin(2 * np.pi * f * t) * am * gate * 0.05


# ------------------------------------------------------------------------------------------ build
def build():
    music = buf()
    bass = buf()
    pads = buf()
    drums = buf()
    sfx = buf()
    sfx_dry = buf()
    amb = buf()

    K, CL, HC, HO, CR = kick(), clap(), hat(False), hat(True), crash()
    kick_times = []

    # ---------------- drums
    t = 0.0
    step = BEAT / 4
    while t < DUR - 0.5:
        bi = int(round(t / step))
        beat_pos = bi % 4
        on_beat = beat_pos == 0
        beat_no = int(round(t / BEAT))
        if on_beat and in_ranges(t, KICK_ON):
            place(drums, K, t, 0.95)
            kick_times.append(t)
        if on_beat and in_ranges(t, HALF_TIME) and beat_no % 4 in (0, 2):
            place(drums, K, t, 0.95)
            kick_times.append(t)
        if on_beat and in_ranges(t, CLAP_ON) and beat_no % 2 == 1:
            place(drums, CL, t, 0.62, 0.05)
        if on_beat and in_ranges(t, HALF_TIME) and beat_no % 4 == 2:
            place(drums, CL, t, 0.7, 0.05)
        if in_ranges(t, HATS_ON):
            soft = 18.0 <= t < 22.0
            if beat_pos == 2:
                place(drums, HO, t, 0.35 if soft else 0.5, 0.25)
            else:
                place(drums, HC, t, (0.18 if soft else 0.32) * (1.0 if beat_pos == 0 else 0.7), -0.2)
        t += step
    # intro: kick from the very first frame, build roll into the vanish
    snare_roll(drums, 2.0, E["moon_vanish"] - 0.02, 0.55)
    snare_roll(drums, 28.0, E["orbit_text"] + 0.3, 0.5)
    snare_roll(drums, 29.6, 30.0, 0.4)
    for c in (4.0, 12.0, 22.0, 30.0):
        place(drums, CR, c, 0.55, 0.3)
    place(drums, CR, E["orbit_text"] + 0.32, 0.65, -0.3)
    place(drums, tom(70), 32.0, 0.8)
    place(drums, CR, 32.0, 0.5)
    for tt_ in (26.0, 27.0, 28.0):
        place(drums, tom(85), tt_ + BEAT * 1.5, 0.35, -0.3)

    # ---------------- bass (sub + mid saw, 8th-note drive)
    for s, e, c in segments():
        root = ROOTS[c]
        soft = 18.0 <= s < 22.0 or s >= 32.0
        t = s
        while t < e - 1e-6:
            d = min(BEAT / 2, e - t)
            if soft:
                d = e - t
            tl = tt(d + 0.05)
            sub = np.sin(2 * np.pi * midi(root - 12) * tl) * 0.5
            mid = filt(saw(midi(root), d + 0.05), "low", 420 if not soft else 300) * 0.5
            note = (sub + mid) * env(len(tl), 0.004, 0.0, 1.0, 0.03, hold=d - 0.02)
            place(bass, note, t, 0.42 if not soft else 0.32)
            if soft:
                break
            t += d

    # ---------------- pads
    for s, e, c in segments():
        bright = 1.0
        if s < E["moon_vanish"]:
            bright = 0.35 + 0.65 * (s / 3.3)
        elif 8.0 <= s < 12.0 or 18.0 <= s < 22.0:
            bright = 0.6
        elif s >= 29.0:
            bright = 1.25
        ch = supersaw_chord(CH[c], e - s, attack=0.12 if s >= 4 else 0.3, release=0.35 if e < DUR else 1.5)
        cut = (900 + 2600 * bright) if s >= 4 else None
        if cut is None:
            ch = sweep_filter(ch, "low", lambda x, s_=s: 700 + 3600 * min(1, (x + s_) / 3.3) ** 2, block=512)
        else:
            ch = filt(ch, "low", cut)
        if e <= E["moon_vanish"] + 1e-6:
            n = int((E["moon_vanish"] - s) * SR)
            ch = ch[:, :n]
            ch = fade_edges(ch, 0.003, 0.012)
        place(pads, ch, s, 0.5 if s < 32 else 0.6)

    # ---------------- arp (16ths)
    pattern = [0, 2, 3, 4, 5, 4, 3, 2]
    for s, e, c in segments():
        if s < 4.0 or 18.0 <= s < 22.0 and False:
            continue
        notes = sorted(set(CH[c]))
        t = s
        i = int(round(s / (BEAT / 4)))
        while t < e - 1e-6 and t < 32.0:
            m = notes[pattern[i % 8] % len(notes)] + 12
            g = 0.2 if 18.0 <= t < 22.0 else 0.26
            place(music, pluck(midi(m)), t, g, pan=0.35 * np.sin(i * 0.9))
            t += BEAT / 4
            i += 1
    # intro arp (sparser, builds)
    t, i = 0.0, 0
    while t < E["moon_vanish"] - 0.05:
        c = chord_at(t)
        notes = sorted(set(CH[c]))
        m = notes[pattern[i % 8] % len(notes)] + 12
        place(music, pluck(midi(m), bright=1500 + 2500 * t / 3.3), t, 0.12 + 0.12 * t / 3.3, pan=0.3 * np.sin(i))
        t += BEAT / 4
        i += 1

    # ---------------- cinematic layers
    place(music, braam(ROOTS["Bb"], 2.4), 26.0, 0.32)
    place(music, braam(ROOTS["C"], 2.4), 28.0, 0.3)
    place(music, braam(ROOTS["Dm"] - 12 + 12, 1.6), 0.0, 0.22)
    # finale melody (bell) and strings swell
    melody = [(32.0, 77), (32.5, 74), (33.0, 72), (33.5, 74), (34.0, 76), (34.5, 79), (35.0, 77), (35.5, 76), (36.0, 74)]
    for t0, m in melody:
        place(music, bell(midi(m), 3.2), t0, 0.16, pan=-0.15)
        place(music, bell(midi(m + 12), 2.0), t0, 0.04, pan=0.3)
    for t0, m in [(E["orbit_text"] + 0.32, 69), (E["orbit_text"] + 0.32, 72), (E["orbit_text"] + 0.32, 77)]:
        place(music, bell(midi(m), 2.5), t0, 0.07)

    # ---------------- sidechain ducking on bass + pads
    duck = np.ones(N)
    tl = np.arange(N) / SR
    for k in kick_times:
        i0 = int(k * SR)
        i1 = min(N, i0 + int(0.4 * SR))
        x = tl[i0:i1] - k
        duck[i0:i1] *= 1 - 0.6 * np.exp(-x / 0.11)
    bass *= duck
    pads *= 0.35 + 0.65 * duck

    music_bus = music + bass + pads + drums * 0.9
    # section dynamics: breakdown on the beach, lift into the reveal and finale
    tl_ = np.arange(N) / SR
    dyn = np.interp(tl_, [0, 3.3, 4.0, 8.0, 12.0, 17.8, 18.2, 21.8, 22.2, 26.0, 29.4, 32.0, 36.0, DUR],
                    [0.8, 0.95, 1.0, 0.92, 0.95, 0.95, 0.58, 0.58, 0.95, 0.9, 1.05, 1.08, 1.0, 1.0])
    music_bus *= dyn
    # hard silence after the vanish (music only)
    i0, i1 = int(SILENCE[0] * SR), int(SILENCE[1] * SR)
    fade = int(0.012 * SR)
    music_bus[:, i0 : i0 + fade] *= np.linspace(1, 0, fade)
    music_bus[:, i0 + fade : i1] = 0

    # ================================================================ SFX
    vanish = E["moon_vanish"]
    place(sfx, reverse_swell(0.75), vanish - 0.73, 0.45)
    place(sfx_dry, boom(1.2, 75, 30, 1.0, decay=0.22), vanish + 0.02, 1.0)
    place(sfx_dry, slam(), vanish + 0.02, 0.5)
    place(sfx_dry, shimmer(1.6, seed=2, base=1500) * np.exp(-tt(1.6) / 0.35), vanish + 0.04, 0.22)
    place(sfx, whoosh(0.5, 300, 2400, 800, 0.4, 0.3, -0.3), E["hook_out"] - 0.05, 0.25)
    # text hits
    pops = [E["hook_line1"], E["gone_text"], E["nights_text"], E["tides_text"], E["tides_text"] + 0.28,
            E["wild_text"], E["wild_text"] + 0.3, E["rot_text"], E["rot_text"] + 0.3, E["flyaway_text"],
            E["orbit_text"], E["final_text"]]
    for i, p in enumerate(pops):
        place(sfx, pop(1.0 + 0.08 * (i % 3)), p, 0.5, pan=0.1 * ((i % 3) - 1))
    for s_ in [E["hook_line2"], E["gone_text"] + 0.34, E["nights_text"] + 0.34, E["flyaway_text"] + 0.4,
               E["orbit_text"] + 0.32, E["final_text"] + 0.42]:
        place(sfx, slam(), s_, 0.75)
    # UI blips (labels, pills, chips)
    for i, b in enumerate([E["ghost_ring"], E["split_labels"], E["split_labels"] + 0.12, E["sun_tides_label"],
                           E["tide_labels"], E["tide_labels"] + 0.12, E["chip_nav"] - 0.1, E["chip_nav"],
                           E["chip_feed"], E["chip_repro"], E["rot_sub"], E["s6_start"] + 0.5]):
        place(sfx, blip(1250 + 110 * (i % 4), 1700 + 110 * (i % 4)), b, 0.42, pan=0.3 * np.sin(i * 1.7))
    # arrows / motion graphics
    place(sfx, zip_up(0.5), E["tide_arrows"], 0.6, -0.2)
    place(sfx, zip_up(0.4, 500, 2200), E["tide_arrows"] + 0.15, 0.45, 0.2)
    place(sfx, zip_up(0.45, 350, 1500), E["tide_labels"] + 0.35, 0.5)
    place(sfx, zip_up(0.6, 300, 1400), E["s6_start"] + 0.25, 0.45)
    place(sfx, zip_up(0.55, 300, 1200), E["flyaway_text"] + 0.5, 0.5, -0.3)
    place(sfx, whoosh(0.8, 400, 3500, 900, 0.5, 0.7, -0.5), E["split_sweep"] - 0.05, 0.5)
    # tides-scene moon vanish (smaller)
    tv = E["tide_moon_vanish"]
    place(sfx, reverse_swell(0.4), tv - 0.38, 0.3)
    place(sfx, boom(2.0, 85, 35, 0.6), tv + 0.03, 0.55)
    place(sfx, shimmer(1.8, seed=5, base=2000), tv + 0.04, 0.35)
    # transitions
    place(sfx, whoosh(1.1, 200, 2600, 400, 0.25, -0.5, 0.6), E["s2_start"] - 0.05, 0.85)
    place(sfx, riser(0.6, 200, 1400), E["s2_dive"], 0.45)
    place(sfx, whoosh(0.9, 300, 4000, 700, 0.62, 0.0, 0.0), E["s3_start"] - 0.55, 0.7)
    for tt_ in (E["s3_exit"], E["tide_cut"] - 0.3, E["s5_start"] - 0.3, E["s6_start"] - 0.3, E["s7_start"] - 0.3):
        place(sfx, whoosh(0.75, 300, 3200, 600, 0.45, -0.6, 0.6), tt_, 0.6)
    place(sfx, whoosh(0.45, 600, 5000, 1200, 0.6, 0.0, 0.0), E["owl_pan"] - 0.25, 0.6)
    place(sfx, riser(E["orbit_text"] + 0.32 - E["pullback"], 160, 1800), E["pullback"], 0.6)
    place(sfx, whoosh(2.6, 150, 1800, 300, 0.5, 0.6, -0.6), E["pullback"], 0.5)
    place(sfx, whoosh(0.8, 250, 2500, 400, 0.5, -0.4, 0.4), E["s8_start"] - 0.45, 0.55)
    place(sfx, boom(3.5, 55, 25, 0.8), E["s8_start"], 0.55)
    # finale resolve: reverse swell into a soft low hit + chime
    place(sfx, reverse_swell(1.0), 35.25 - 0.98, 0.35)
    place(sfx, boom(2.5, 50, 24, 0.6), 35.25, 0.45)
    place(sfx, shimmer(2.0, seed=11, base=2200), 35.25, 0.35)
    # clock ticks (rotation scene), on the 8th-note grid
    t = E["s6_start"] + 0.5
    k = 0
    while t < E["s7_start"] - 0.2:
        place(sfx, tick(k % 2 == 0), t, 0.5, pan=-0.5)
        t += BEAT / 2
        k += 1

    # ================================================================ ambience
    # deep space drone wherever we are in space
    space = [(0.0, 8.0), (12.0, 14.9), (22.0, DUR)]
    drone = filt(noise(DUR, "brown"), "low", 160) * 0.5
    tl = np.arange(N) / SR
    drone = drone * 0.5 + 0.1 * np.sin(2 * np.pi * 73.4 * tl) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * tl))
    drone += 0.06 * np.sin(2 * np.pi * 110.0 * tl + 1.0) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * tl + 2))
    air = filt(noise(DUR, "pink"), "band", (2500, 9000)) * 0.08
    mask = np.zeros(N)
    for a, b in space:
        mask[int(a * SR) : int(b * SR)] = 1
    mask = np.convolve(mask, np.ones(int(0.3 * SR)) / int(0.3 * SR), mode="same")
    sil = np.ones(N)
    sil[int((SILENCE[0] + 0.05) * SR) : int(SILENCE[1] * SR)] = 0.2
    amb += np.vstack([(drone + air) * mask * sil, (np.roll(drone, 2400) + np.roll(air, 1200)) * mask * sil]) * 0.5

    # tide gauge: water lapping synced to the time-lapse tide (period 1.75 s)
    a, b = E["tide_cut"] - 0.2, E["s5_start"] + 0.1
    seg = int((b - a) * SR)
    ts = np.arange(seg) / SR + a
    lev = np.sin(((ts - E["tide_cut"]) / 1.75) * 2 * np.pi - 0.4)
    speed = np.abs(np.cos(((ts - E["tide_cut"]) / 1.75) * 2 * np.pi - 0.4))
    wash = filt(noise(b - a, "pink"), "low", 1200) * (0.35 + 0.65 * speed)
    lap = filt(noise(b - a), "band", (1500, 5000)) * (0.15 + 0.25 * (np.sin(ts * 13.0) > 0.6)) * (0.5 + 0.5 * speed)
    wv = (wash + lap * 0.4) * np.interp(ts, [a, a + 0.3, b - 0.3, b], [0, 1, 1, 0])
    place(amb, np.vstack([wv, np.roll(wv, 900)]), a, 0.55)
    # subtle water texture under the tides-in-space shot
    place(amb, filt(noise(2.6, "pink"), "low", 700) * np.interp(tt(2.6), [0, 0.6, 2.2, 2.6], [0, 1, 1, 0]), E["s4_start"] + 0.2, 0.18)

    # beach: surf crashes + continuous wash, crickets
    a, b = E["s5_start"], E["s6_start"] + 0.2
    seg_d = b - a
    ts = tt(seg_d) + a
    surf = filt(noise(seg_d, "pink"), "low", 2200)
    swell = 0.4 + 0.6 * np.clip(np.sin((ts - a) * 1.2 + 0.8), 0, 1) ** 2
    owl_part = np.interp(ts, [E["owl_pan"] - 0.1, E["owl_pan"] + 0.3], [1, 0.35])
    surf = surf * swell * owl_part * np.interp(ts, [a, a + 0.3, b - 0.3, b], [0, 1, 1, 0])
    place(amb, np.vstack([surf, np.roll(surf, 1500)]), a, 0.45)
    r2 = np.random.default_rng(3)
    for i in range(16):
        t0 = a + 0.3 + r2.random() * (seg_d - 0.8)
        place(amb, cricket(f=4300 + r2.random() * 800), t0, 0.5, pan=r2.random() * 1.6 - 0.8)

    # city: low distant hum
    a, b = E["s3_start"], E["s4_start"]
    hum = filt(noise(b - a, "brown"), "band", (60, 400)) * np.interp(tt(b - a), [0, 0.3, 3.7, 4.0], [0, 1, 1, 0])
    place(amb, hum, a, 0.25)

    # ================================================================ mix
    ir_m = reverb_ir(2.2, damp=7000, seed=1)
    ir_s = reverb_ir(3.4, damp=5000, seed=2, predelay=0.02)
    music_wet = convolve(music_bus, ir_m)
    sfx_wet = convolve(sfx, ir_s)
    # arp/delay-ish width: short stereo delay on music
    d = int(0.375 * SR)
    delayed = np.zeros_like(music)
    delayed[0, d:] = music[1, :-d] * 0.35
    delayed[1, d:] = music[0, :-d] * 0.35
    mix = music_bus * 0.9 + music_wet * 0.22 + delayed * 0.5 + sfx * 0.8 + sfx_wet * 0.3 + sfx_dry * 0.85 + amb * 0.7
    # keep the post-vanish window genuinely quiet: duck reverb returns too
    duck_win = np.ones(N)
    a0, a1 = int((SILENCE[0] + 0.12) * SR), int((SILENCE[1] - 0.04) * SR)
    duck_win[a0:a1] = 0.18
    duck_win = np.convolve(duck_win, np.ones(int(0.08 * SR)) / int(0.08 * SR), mode="same")
    mix = mix * duck_win
    # the silence moment keeps only reverb tails / ambience
    mix = filt(mix, "high", 28)
    return mix


def bus_compress(x, thresh_db=-16, ratio=2.5, attack=0.01, release=0.18):
    lvl = np.sqrt(np.convolve((x**2).mean(axis=0), np.ones(int(0.01 * SR)) / int(0.01 * SR), mode="same")) + 1e-9
    db = 20 * np.log10(lvl)
    over = np.maximum(0, db - thresh_db)
    gain_db = -over * (1 - 1 / ratio)
    # smooth gain (one-pole, attack/release)
    g = np.empty_like(gain_db)
    a_a = np.exp(-1 / (attack * SR))
    a_r = np.exp(-1 / (release * SR))
    cur = 0.0
    for i in range(0, len(gain_db), 32):
        target = gain_db[i]
        coef = a_a ** 32 if target < cur else a_r ** 32
        cur = target + (cur - target) * coef
        g[i : i + 32] = cur
    return x * 10 ** (g / 20)


def limiter(x, ceiling=0.89, look=0.004):
    peak = np.abs(x).max(axis=0)
    w = int(look * SR)
    from scipy.ndimage import maximum_filter1d, uniform_filter1d

    env_ = maximum_filter1d(peak, size=2 * w + 1)
    gain = np.minimum(1, ceiling / np.maximum(env_, 1e-9))
    gain = uniform_filter1d(gain, size=w)
    gain = np.minimum(gain, ceiling / np.maximum(env_, 1e-9) + 0.0)
    return x * gain


def main(out_path):
    import pyloudnorm as pyln

    mix = build()
    mix = bus_compress(mix)
    meter = pyln.Meter(SR)
    loud = meter.integrated_loudness(mix.T)
    target = -14.0
    mix *= 10 ** ((target - loud) / 20)
    mix = limiter(mix, ceiling=10 ** (-1.2 / 20))
    # tail: fade the last half second with the picture
    end = int(TIMING["duration"] * SR)
    f0 = int((TIMING["duration"] - 0.55) * SR)
    mix[:, f0:end] *= np.linspace(1, 0, end - f0) ** 1.5
    mix = mix[:, :end]
    loud2 = meter.integrated_loudness(mix.T)
    peak = 20 * np.log10(np.abs(mix).max())
    print(f"integrated loudness {loud2:.1f} LUFS, sample peak {peak:.1f} dBFS, duration {mix.shape[1] / SR:.2f}s")
    from scipy.io import wavfile

    wavfile.write(out_path, SR, (mix.T * 32767).astype(np.int16))
    print("wrote", out_path)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "out" / "soundtrack.wav"))
