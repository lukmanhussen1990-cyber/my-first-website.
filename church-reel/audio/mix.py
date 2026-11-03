"""Soundtrack: the user's own voiceover (untouched) + quiet sound effects made with code.
Writes audio/mix.wav (48 kHz stereo). Needs numpy, scipy, soundfile, librosa (scratch venv).
"""
import json, os
import numpy as np, soundfile as sf, librosa
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
D = json.load(open(os.path.join(HERE, "..", "shots.json")))
W = D["words"]; SH = {s["id"]: s for s in D["shots"]}
vo, _ = librosa.load(os.path.join(HERE, "my_voiceover.mp3"), sr=SR, mono=True)   # the voice, unchanged
N = len(vo)
L = vo.copy(); R = vo.copy()
rng = np.random.default_rng(5)
VO_RMS = np.sqrt(np.mean(vo[np.abs(vo) > 0.01] ** 2))
t_ = lambda n: np.arange(n) / SR
db = lambda x: 10 ** (x / 20)
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)
def level(x, rel):  # loud part of x sits rel dB under the voice
    loud = x[np.abs(x) > np.abs(x).max() * 0.1]
    return x * VO_RMS / np.sqrt(np.mean(loud ** 2)) * db(rel)
def place(x, t, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    x = x[: N - i]; L[i:i + len(x)] += x * (1 - max(0, pan)); R[i:i + len(x)] += x * (1 + min(0, pan))
def env(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] = np.minimum(e[-nr:], np.linspace(1, 0, nr))
    return e

# ---- soft church organ (additive pipes + slow tremulant) ----
def organ_note(f, dur):
    n = int(dur * SR); t = t_(n); trem = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t)
    ph = 2 * np.pi * f * np.cumsum(trem) / SR
    s = sum(w * np.sin(k * ph) for k, w in [(1, 1), (2, 0.6), (3, 0.25), (4, 0.3), (6, 0.1), (8, 0.12)])
    return s * env(n, 0.5, 0.6)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
organ = np.zeros(int(11 * SR))
for t0, dur, notes in [(0.0, 3.6, [53, 57, 60, 65]), (3.3, 3.2, [46, 58, 62, 65]), (6.2, 4.2, [48, 55, 60, 64])]:
    for m in notes:
        x = organ_note(hz(m), dur); i = int(t0 * SR); organ[i:i + len(x)] += x
organ = lp(organ, 2500)
organ *= env(len(organ), 0.8, 2.5)
place(level(organ, -20), 0.0, -0.1); place(level(organ, -24), 0.02, 0.3)

# ---- fly buzzing in the silence (eyes closed ... don't breathe) ----
fa, fb = SH["09"]["t0"], SH["15"]["t0"]
n = int((fb - fa) * SR); t = t_(n)
f = 190 + 35 * np.sin(2 * np.pi * 0.6 * t) + 15 * np.sin(2 * np.pi * 2.3 * t + 1)
saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
buzz = bp(saw * (1 + 0.4 * np.sin(2 * np.pi * 11 * t)), 150, 3000) * env(n, 0.6, 0.8)
pan = 0.6 * np.sin(2 * np.pi * 0.25 * t)
b = level(buzz, -18); i = int(fa * SR)
L[i:i + n] += b * (1 - np.clip(pan, 0, 1)); R[i:i + n] += b * (1 + np.clip(pan, -1, 0))

# ---- small plop on "pooped" ----
n = int(0.25 * SR); t = t_(n)
plop = np.sin(2 * np.pi * np.cumsum(520 * np.exp(-t * 14) + 120) / SR) * np.exp(-t * 18)
place(level(plop, -14), W[3]["s"] - 0.04)

# ---- old lady coughs ----
def cough(f0=230):
    n = int(0.22 * SR); t = t_(n)
    noise = bp(rng.normal(0, 1, n), 400, 2600) + 0.6 * bp(rng.normal(0, 1, n), 900, 1300)
    voiced = 0.35 * np.sign(np.sin(2 * np.pi * f0 * t)) * np.exp(-t * 20)
    return (noise + bp(voiced, 200, 2000)) * np.minimum(1, t / 0.01) * np.exp(-t * 14)
for k, dt in enumerate([0.12, 0.45, 0.72, 1.0]):
    place(level(cough(220 + k * 10), -9 - k), SH["18"]["t0"] + 0.2 + dt, 0.2)

# ---- record scratch right before "Let us pray" ----
chord = sum(organ_note(hz(m), 0.6) for m in [53, 57, 60]) + 0.4 * rng.normal(0, 1, int(0.6 * SR))
n = int(0.42 * SR); t = t_(n)
speed = np.where(t < 0.14, 1 - t / 0.14 * 3.5, np.where(t < 0.26, -2.5 + (t - 0.14) / 0.12 * 4.5, 2.0 - (t - 0.26) / 0.16 * 2.0))
pos = np.clip(0.25 * SR + np.cumsum(speed), 0, len(chord) - 2)
scr = np.interp(pos, np.arange(len(chord)), chord) * env(n, 0.005, 0.06)
scr = bp(scr, 250, 5000) + 0.15 * bp(rng.normal(0, 1, n), 2000, 6000) * env(n, 0.005, 0.1)
place(level(scr, -9), W[73]["s"] - 0.5)

# ---- burrito pop + crowd gasp + slide whoosh ----
n = int(0.12 * SR); t = t_(n)
pop = np.sin(2 * np.pi * np.cumsum(900 + 1200 * np.exp(-t * 40)) / SR) * np.exp(-t * 30)
place(level(pop, -14), W[116]["s"] - 0.05)
gasp = np.zeros(int(1.2 * SR))
for k in range(16):
    n = int((0.25 + rng.uniform(0, 0.15)) * SR); t = t_(n)
    v = bp(rng.normal(0, 1, n), 700 + rng.uniform(0, 600), 2400 + rng.uniform(0, 800))
    v += 0.2 * bp(np.sign(np.sin(2 * np.pi * rng.uniform(160, 300) * t)), 300, 2000)
    v *= np.minimum(1, (t / (t[-1] * 0.8)) ** 1.5) * env(n, 0.0, 0.04)
    i = int(rng.uniform(0, 0.12) * SR); gasp[i:i + n] += v * rng.uniform(0.6, 1.0)
place(level(gasp, -15), W[115]["s"] - 0.05, 0.0)
n = int(0.6 * SR); t = t_(n)
wh = bp(rng.normal(0, 1, n), 300, 1500) * np.sin(np.pi * t / t[-1]) ** 2
place(level(wh, -18), SH["38"]["t0"] + 0.05)

mix = np.stack([L, R], 1)
peak = np.abs(mix).max()
mix *= db(-1.0) / peak          # one static gain for the whole track (no compression, voice untouched)
sf.write(os.path.join(HERE, "mix.wav"), mix.astype(np.float32), SR)
print("mix %.3f s, gain %.1f dB" % (len(mix) / SR, 20 * np.log10(db(-1.0) / peak)))
