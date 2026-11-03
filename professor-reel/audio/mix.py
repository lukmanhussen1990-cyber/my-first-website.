"""Soundtrack: the user's own voiceover (untouched, one static gain) + quiet sound effects made with code.
Writes audio/mix.wav (48 kHz stereo). Needs numpy, scipy, soundfile."""
import json, os, subprocess
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
D = json.load(open(os.path.join(HERE, "..", "shots.json")))
W = D["words"]; SH = {s["id"]: s for s in D["shots"]}
w = lambda i: W[i]["s"]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(HERE, "my_voiceover.mp3"), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
vo = np.frombuffer(raw, np.float32).astype(np.float64)          # the voice, unchanged
N = len(vo); L = vo.copy(); R = vo.copy()
rng = np.random.default_rng(21)
VO_RMS = np.sqrt(np.mean(vo[np.abs(vo) > 0.01] ** 2))
t_ = lambda n: np.arange(n) / SR
db = lambda x: 10 ** (x / 20)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], btype="band", fs=SR, output="sos"), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, btype="low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, btype="high", fs=SR, output="sos"), x)
def level(x, rel):
    loud = x[np.abs(x) > np.abs(x).max() * 0.1]
    return x * VO_RMS / np.sqrt(np.mean(loud ** 2)) * db(rel)
def place(x, t, pan=0.0):
    i = int(t * SR)
    if i >= N or i < 0: return
    x = x[: N - i]; L[i:i + len(x)] += x * (1 - max(0, pan)); R[i:i + len(x)] += x * (1 + min(0, pan))
def env(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] = np.minimum(e[-nr:], np.linspace(1, 0, nr))
    return e
def noise(n): return rng.normal(0, 1, n)

# ---- classroom chatter (murmur of voices) under the class scenes
n = int(4 * SR); t = t_(n)
mur = sum(bp(noise(n), 300 + 120 * k, 900 + 200 * k) * (0.5 + 0.5 * np.sin(2 * np.pi * (2.5 + 0.7 * k) * t + k) ** 2) for k in range(5))
c0, c1 = 0.0, SH["19"]["t0"]; n2 = int((c1 - c0) * SR); place(level(np.resize(mur, n2) * env(n2, 0.3, 0.4), -31), c0)
# ---- nervous trembling (opening): a soft fast rattle
n = int(1.9 * SR); t = t_(n); place(level(bp(noise(n), 2000, 6000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 22 * t))) * env(n, 0.1, 0.4), -30), 0.0)
# ---- door creak + angelic shimmer when he walks in
n = int(1.1 * SR); t = t_(n); f = 300 + 180 * np.sin(np.pi * t / t[-1]) + 30 * np.sin(2 * np.pi * 9 * t)
creak = bp(np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 17 * t))), 400, 3000) * env(n, 0.05, 0.3)
place(level(creak, -22), SH["03"]["t0"] + 0.1, 0.4)
n = int(2.2 * SR); t = t_(n); shim = sum(a * np.sin(2 * np.pi * f * t) for f, a in [(1046.5, 1), (1318.5, 0.7), (1568, 0.6), (2093, 0.4)]) * (0.6 + 0.4 * np.sin(2 * np.pi * 5 * t)) * env(n, 0.6, 0.9)
place(level(shim, -25), SH["04"]["t0"] - 0.3)
# ---- heartbeats (ba-dum) under every BA-DUM!
def badum():
    n = int(0.5 * SR); t = t_(n); x = np.zeros(n)
    for d0, a in ((0.0, 1.0), (0.19, 0.7)):
        m = int(0.16 * SR); i = int(d0 * SR); tt = t_(m); x[i:i + m] += a * np.sin(2 * np.pi * (55 + 40 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 18)
    return lp(x, 300)
for t0, t1 in ((w(16), SH["07"]["t0"]), (w(62), SH["19"]["t0"]), (w(81) - 0.3, D["duration"])):
    for tt in np.arange(t0, t1 - 0.2, 1 / 1.6): place(level(badum(), -12), tt)
# ---- pencil scribbling, paper drop, running feet
n = int((w(34) + 0.6 - w(22)) * SR); t = t_(n); scr = bp(noise(n), 2500, 8000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 9 * t))) * env(n, 0.1, 0.2)
place(level(scr, -24), w(22))
n = int(0.3 * SR); t = t_(n); place(level(bp(noise(n), 800, 5000) * np.exp(-t * 15), -20), w(38))
def step():
    n = int(0.07 * SR); t = t_(n); return lp(noise(n), 1400) * np.exp(-t * 45)
for k in range(9): place(level(step(), -19), w(39) + k * 0.12, 0.5 * np.sin(k))
# ---- red pen squeak while writing A+, then DING!
n = int(1.2 * SR); t = t_(n); f = 1800 + 600 * np.sin(2 * np.pi * 3 * t); sq = bp(np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.6 * noise(n), 1500, 6000) * (np.abs(np.sin(2 * np.pi * 4 * t)) ** 2) * env(n, 0.05, 0.1)
place(level(sq, -26), SH["14"]["t0"] + 0.1)
def chime():
    n = int(1.2 * SR); t = t_(n)
    return sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in [(1568, 1, 4), (2093, 0.7, 5), (2637, 0.5, 6), (3136, 0.35, 7)])
place(level(chime(), -14), w(50))
# ---- calendar pages flipping
for k in range(7): n = int(0.12 * SR); t = t_(n); place(level(bp(noise(n), 1500, 7000) * np.sin(np.pi * t / t[-1]) ** 3, -21), SH["19"]["t0"] + 0.05 + k * (SH["19"]["dur"] / 7.2))
# ---- wedding bells + applause, pen click, laughter
def bell(f):
    n = int(2.0 * SR); t = t_(n); return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in [(1, 1, 1.6), (2.0, 0.5, 2.2), (2.76, 0.35, 2.8), (5.4, 0.15, 4)])
for k, f in enumerate((784, 659, 523, 659, 784)): place(level(bell(f), -21), SH["20"]["t0"] + k * 0.32, (-1) ** k * 0.3)
n = int(1.8 * SR); clap = np.zeros(n)
for k in range(140): j = int(rng.uniform(0, 1.65) * SR); m = int(0.02 * SR); clap[j:j + m] += bp(rng.normal(0, 1, m), 900, 5000) * np.exp(-t_(m) * 220) * rng.uniform(0.4, 1)
place(level(clap * env(n, 0.1, 0.5), -21), SH["20"]["t0"] + 0.1)
n = int(0.03 * SR); place(level(hp(noise(n), 2500) * np.exp(-t_(n) * 250), -11), w(78))
n = int(0.03 * SR); place(level(hp(noise(n), 2500) * np.exp(-t_(n) * 250), -13), w(78) + 0.11)
def laugh(f0):
    n = int(0.9 * SR); t = t_(n); x = np.zeros(n)
    for k in range(5):
        i = int((k * 0.16 + rng.uniform(0, 0.03)) * SR); m = int(0.11 * SR); tt = t_(m)
        x[i:i + m] += bp(np.sign(np.sin(2 * np.pi * f0 * (1 - 0.1 * k) * tt)) + 0.5 * rng.normal(0, 1, m), 500, 3000) * np.sin(np.pi * tt / tt[-1]) ** 2
    return x
lg = np.zeros(int(1.6 * SR))
for k in range(9): x = laugh(rng.uniform(170, 300)); i = int(rng.uniform(0, 0.6) * SR); lg[i:i + len(x)] += x * rng.uniform(0.5, 1)
place(level(lg, -20), w(81) - 0.1)

mix = np.stack([L, R], 1)
peak = np.abs(mix).max()
mix *= db(-1.0) / peak          # one static gain for the whole track (no compression, voice untouched)
sf.write(os.path.join(HERE, "mix.wav"), mix.astype(np.float32), SR)
print("mix %.3f s (voice %.3f s), gain %.1f dB" % (len(mix) / SR, N / SR, 20 * np.log10(db(-1.0) / peak)))
