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
rng = np.random.default_rng(31)
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
def bed(t0, t1, x, rel, pan=0.0):
    n = int((t1 - t0) * SR); y = np.resize(x, n) * env(n, 0.3, 0.3); place(level(y, rel), t0, pan)

# ---- city street ambience: traffic + birds (until the front door)
n = int(6 * SR); t = t_(n)
city = lp(noise(n), 350) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.11 * t)) + 0.25 * bp(noise(n), 500, 1800) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t) ** 2)
bed(0, SH["12"]["t0"], city, -30)
def chirp(f0):
    n = int(0.11 * SR); t = t_(n); f = f0 * (1 + 0.45 * np.sin(np.pi * t / 0.11)); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.11) ** 2
for k in range(9): place(level(chirp(2800 + 800 * rng.random()), -29), 0.4 + k * 1.7 + 0.3 * rng.random(), rng.uniform(-0.6, 0.6))
# ---- stomach rumbles
def rumble(dur=0.9, f0=55):
    n = int(dur * SR); t = t_(n); f = f0 * (1 + 0.35 * np.sin(2 * np.pi * 3.3 * t) + 0.2 * np.sin(2 * np.pi * 7.7 * t))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 9 * t))) + 0.4 * lp(noise(n), 300)
    return lp(x, 700) * env(n, 0.06, 0.3)
place(level(rumble(1.0), -10), w(3) - 0.03); place(level(rumble(0.8, 62), -13), w(14) - 0.05); place(level(rumble(0.7, 50), w(24) and -15), w(24))
# ---- footsteps: normal, fast, tiny, heavy
def step(br=1400, d=0.07):
    n = int(d * SR); t = t_(n); return lp(noise(n), br) * np.exp(-t * 45)
for tt in np.arange(0.1, SH["03"]["t0"], 2 * np.pi / 4.5 / 2): place(level(step(), -27), tt, 0.1)
for tt in np.arange(SH["03"]["t0"], SH["04"]["t0"] + 0.4, 2 * np.pi / 13 / 2): place(level(step(1600), -22), tt, 0.1)
for tt in np.arange(SH["06"]["t0"], SH["08"]["t0"], 2 * np.pi / 9 / 2): place(level(step(2200, 0.04), -30), tt, 0.1)
for tt in np.arange(SH["10"]["t0"], SH["12"]["t0"], 2 * np.pi / 2.5 / 2): place(level(step(900, 0.12), -18), tt)
# ---- angels singing at the door: soft choir "aah" chord
n = int(2.1 * SR); t = t_(n); choir = np.zeros(n)
for m_ in (60, 64, 67, 72):
    f = 440 * 2 ** ((m_ - 69) / 12); ph = 2 * np.pi * np.cumsum(f * (1 + 0.006 * np.sin(2 * np.pi * 5 * t + m_))) / SR
    saw = sum(np.sin(k * ph) / k for k in range(1, 12)); choir += bp(saw, 500, 1300) + 0.6 * bp(saw, 900, 1600)
place(level(choir * env(n, 0.4, 0.6), -18), SH["12"]["t0"] - 0.1)
# ---- pockets (cloth rustle), backpack zipper + rummaging, doormat flop
def rustle(d=0.35): n = int(d * SR); t = t_(n); return bp(noise(n), 1500, 6000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 11 * t))) * env(n, 0.03, 0.1)
place(level(rustle(), -21), w(44)); place(level(rustle(0.3), -20), w(48)); place(level(rustle(0.4), -20), w(51))
n = int(0.4 * SR); t = t_(n); zipr = bp(noise(n), 2000, 8000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * (80 + 100 * t) * t))) * env(n, 0.01, 0.05)
place(level(zipr, -19), w(53) - 0.05)
for k in range(5): place(level(step(800, 0.1), -24), w(53) + 0.15 + k * 0.12, rng.uniform(-0.5, 0.5))
place(level(step(600, 0.15), -20), w(56) - 0.1)
# ---- keys jingle, lock + click, door swing, running, THUD
def jingle():
    n = int(0.7 * SR); x = np.zeros(n)
    for k in range(9):
        i = int(rng.uniform(0, 0.4) * SR); m_ = int(0.25 * SR); tt = t_(m_)
        x[i:i + m_] += sum(np.sin(2 * np.pi * f * tt) for f in rng.uniform(3000, 7000, 3)) * np.exp(-tt * 25) * rng.uniform(0.4, 1)
    return hp(x, 2000)
place(level(jingle(), -12), w(58) - 0.05)
for k in range(2): n = int(0.05 * SR); place(level(hp(noise(n), 2500) * np.exp(-t_(n) * 160), -16 + 4 * k), SH["20"]["t0"] + 0.5 + 0.35 * k)
n = int(0.04 * SR); place(level(bp(noise(n), 1500, 6000) * np.exp(-t_(n) * 200) + 0.6 * np.sin(2 * np.pi * 1800 * t_(n)) * np.exp(-t_(n) * 120), -9), w(63) - 0.02)
n = int(0.8 * SR); t = t_(n); f = 260 + 120 * np.sin(np.pi * t / t[-1]); creak = bp(np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)), 400, 2500) * env(n, 0.05, 0.3)
place(level(creak, -24), w(63) + 0.05)
for tt in np.arange(SH["22"]["t0"] + 0.05, SH["23"]["t0"] + 0.2, 2 * np.pi / 17 / 2): place(level(step(1500), -19), tt)
n = int(0.45 * SR); t = t_(n); thud = np.sin(2 * np.pi * np.cumsum(70 + 60 * np.exp(-t * 25)) / SR) * np.exp(-t * 10) + 0.7 * lp(noise(n), 900) * np.exp(-t * 30)
place(level(thud, -8), w(69) + 0.05)
# ---- muffled radio/humming from behind the bathroom door at the very end
n = int(2.2 * SR); t = t_(n); hum = lp(sum(np.sin(2 * np.pi * f * t) for f in (220, 277, 330)) * (0.5 + 0.5 * np.sin(2 * np.pi * 1.5 * t)), 500) * env(n, 0.4, 0.4)
place(level(hum, -32), SH["24"]["t0"])

mix = np.stack([L, R], 1)
peak = np.abs(mix).max()
mix *= db(-1.0) / peak          # one static gain for the whole track (no compression, voice untouched)
sf.write(os.path.join(HERE, "mix.wav"), mix.astype(np.float32), SR)
print("mix %.3f s (voice %.3f s), gain %.1f dB" % (len(mix) / SR, N / SR, 20 * np.log10(db(-1.0) / peak)))
