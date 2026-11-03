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
rng = np.random.default_rng(11)
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
def bed(t0, t1, x, rel, pan=0.0):  # a looping background bed between two times, with soft edges
    n = int((t1 - t0) * SR); y = np.resize(x, n) * env(n, 0.3, 0.3); place(level(y, rel), t0, pan)

# ---- street ambience: distant traffic, birds in the morning, one far horn
n = int(6 * SR); t = t_(n)
traffic = lp(noise(n), 300) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.13 * t)) + 0.3 * bp(noise(n), 400, 1500) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t) ** 2)
bed(0.0, SH["17"]["t0"], traffic, -30)
def chirp(f0):
    n = int(0.12 * SR); t = t_(n); f = f0 * (1 + 0.5 * np.sin(np.pi * t / 0.12)); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.12) ** 2
for k in range(14): place(level(chirp(2600 + 900 * rng.random()), -26), SH["05"]["t0"] + 0.1 + k * 0.17 + 0.05 * rng.random(), rng.uniform(-0.5, 0.5))
n = int(0.7 * SR); t = t_(n); horn = (np.sign(np.sin(2 * np.pi * 410 * t)) + np.sign(np.sin(2 * np.pi * 517 * t))) * env(n, 0.02, 0.15)
place(level(lp(horn, 2000), -30), SH["16"]["t0"] + 0.4, 0.4)

# ---- pizza bites (crunch), POP!, GASP sting
def crunch():
    n = int(0.16 * SR); x = np.zeros(n)
    for k in range(20): j = int(rng.uniform(0, 0.12) * SR); m = int(0.004 * SR); x[j:j + m] += rng.normal(0, 1, m) * np.exp(-np.arange(m) / (0.0012 * SR))
    return bp(x, 1500, 7000)
for tt in np.arange(SH["04"]["t0"] + 0.25, SH["05"]["t0"], 2 * np.pi / 6): place(level(crunch(), -18), tt)
n = int(0.35 * SR); t = t_(n)
pop = np.sin(2 * np.pi * np.cumsum(180 + 900 * np.exp(-t * 18)) / SR) * np.exp(-t * 9) + 0.4 * bp(noise(n), 800, 4000) * np.exp(-t * 60)
place(level(pop, -9), w(25) - 0.01)
n = int(0.9 * SR); t = t_(n)
sting = sum(lp(2 * ((f * t) % 1) - 1, 900) for f in (98, 147)) * env(n, 0.01, 0.4) * np.where(t < 0.18, 1, np.where(t < 0.24, 0, 1))
place(level(sting, -17), w(38) - 0.05)

# ---- head scratch, pigeon coo
for k in range(6): n = int(0.07 * SR); place(level(bp(noise(n), 2000, 7000) * env(n, 0.005, 0.03), -24), SH["13"]["t0"] + 0.15 + k * 0.11)
def coo(f0=420):
    n = int(0.55 * SR); t = t_(n); f = f0 * (1 + 0.12 * np.sin(2 * np.pi * 6 * t)) * (1 - 0.25 * t)
    return lp(np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR), 1200) * np.sin(np.pi * t / t[-1]) ** 1.5
place(level(coo(430), -19), SH["14"]["t0"] + 0.15, 0.3); place(level(coo(380), -21), SH["14"]["t0"] + 0.9, 0.3)

# ---- shopping cart: squeaky wheel + waddling steps
for tt in np.arange(SH["15"]["t0"] + 0.05, SH["17"]["t0"] - 0.1, 2 * np.pi / 7):
    n = int(0.09 * SR); t = t_(n); sq = np.sin(2 * np.pi * np.cumsum(2200 + 500 * np.sin(np.pi * t / 0.09)) / SR) * np.sin(np.pi * t / 0.09)
    place(level(sq, -24), tt, 0.2)
    n = int(0.08 * SR); t = t_(n); step = lp(noise(n), 900) * np.exp(-t * 40); place(level(step, -22), tt + 0.22, -0.2)
rattle = bp(noise(int(3.4 * SR)), 2500, 7000) * (np.abs(np.sin(2 * np.pi * 9 * t_(int(3.4 * SR)))) ** 4)
place(level(rattle, -30), SH["15"]["t0"])

# ---- hospital: room tone, heart-monitor beeps, BEEP!, glasses clicks, door bang, running feet
n = int(4 * SR); tone = lp(noise(n), 250) + 0.05 * np.sin(2 * np.pi * 120 * t_(n))
bed(SH["17"]["t0"], D["duration"], tone, -36)
def beep(f=1000, dur=0.11):
    n = int(dur * SR); t = t_(n); return np.sin(2 * np.pi * f * t) * env(n, 0.005, 0.02)
for tt in np.arange(SH["24"]["t0"] + 0.3, D["duration"] - 0.5, 0.73): place(level(beep(), -27), tt, -0.25)
place(level(beep(1400, 0.22), -13), w(91)); place(level(beep(1400, 0.08), -15), w(91) + 0.3)
place(level(beep(1250, 0.22), -13), w(167)); place(level(beep(1250, 0.08), -15), w(167) + 0.3)
def click(): n = int(0.03 * SR); return hp(noise(n), 3000) * np.exp(-t_(n) * 200)
place(level(click(), -18), w(99) - 0.1); place(level(click(), -18), w(104) - 0.05)
n = int(0.4 * SR); t = t_(n); bang = lp(noise(n), 500) * np.exp(-t * 18) + 0.5 * np.sin(2 * np.pi * 85 * t) * np.exp(-t * 14)
place(level(bang, -14), w(109) - 0.3, -0.4)
def step():
    n = int(0.07 * SR); t = t_(n); return lp(noise(n), 1400) * np.exp(-t * 45)
for k in range(11):
    t0 = w(109) - 0.55 if k == 1 else w(111) - 0.65 + (k - 2) * 0.15
    if k == 0: continue
    for j in range(5): place(level(step(), -20), t0 + j * 0.09 + 0.01 * rng.random(), rng.uniform(-0.6, 0.0))

# ---- pen scribble, sniffles, page flips, belly wobble
n = int(1.0 * SR); t = t_(n); scr = bp(noise(n), 2500, 8000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 7 * t))) * env(n, 0.05, 0.1)
place(level(scr, -21), w(131))
for k in range(3): n = int(0.18 * SR); t = t_(n); place(level(bp(noise(n), 800, 4000) * np.sin(np.pi * t / t[-1]) ** 2, -20), w(137) + k * 0.35)
def flip():
    n = int(0.22 * SR); t = t_(n); return bp(noise(n), 1500, 7000) * np.sin(np.pi * t / t[-1]) ** 3
for k in range(4): place(level(flip(), -19), w(139) + k * 0.18, (-1) ** k * 0.4)
n = int(1.7 * SR); t = t_(n)
wob = np.sin(2 * np.pi * (70 + 20 * np.sin(2 * np.pi * 6 * t)) * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t)) * env(n, 0.3, 0.2)
place(level(wob, -16), w(145))

# ---- WAAAH!: a whoosh + shimmer under the voice, then a short baby cry tail; sparkle chime for the baby
n = int(0.6 * SR); t = t_(n); whoosh = bp(noise(n), 600, 6000) * np.sin(np.pi * t / t[-1]) ** 2
place(level(whoosh, -20), w(150) - 0.25)
n = int(0.55 * SR); t = t_(n); f = 520 * (1 + 0.2 * np.sin(np.pi * t / t[-1])) * (1 + 0.03 * np.sin(2 * np.pi * 7 * t))
cry = bp(np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.5 + np.sin(2 * np.pi * np.cumsum(f) / SR), 400, 4000) * env(n, 0.04, 0.2)
place(level(cry, -20), W[150]["e"] + 0.02)
def chime():
    n = int(0.9 * SR); t = t_(n)
    return sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in [(1568, 1, 5), (2093, 0.7, 6), (2637, 0.5, 7), (3136, 0.35, 8)])
place(level(chime(), -19), w(151)); place(level(chime(), -21), w(154))

# ---- rain outside (window + the cardboard box), then eleven thuds
n = int(3 * SR); rainx = bp(noise(n), 1200, 9000) + 0.6 * lp(noise(n), 400)
bed(SH["52"]["t0"], SH["53"]["t0"], rainx, -30); bed(SH["53"]["t0"], SH["54"]["t0"], rainx, -21)
def thud(f=70):
    n = int(0.4 * SR); t = t_(n); return np.sin(2 * np.pi * np.cumsum(f + 60 * np.exp(-t * 25)) / SR) * np.exp(-t * 10) + 0.5 * lp(noise(n), 1200) * np.exp(-t * 35)
for k in range(11): place(level(thud(60 + 5 * k), -11 - (k % 3)), w(194) + 0.03 + 0.012 * k + 0.01 * rng.random(), rng.uniform(-0.5, 0.5))

mix = np.stack([L, R], 1)
peak = np.abs(mix).max()
mix *= db(-1.0) / peak          # one static gain for the whole track (no compression, voice untouched)
sf.write(os.path.join(HERE, "mix.wav"), mix.astype(np.float32), SR)
print("mix %.3f s (voice %.3f s), gain %.1f dB" % (len(mix) / SR, N / SR, 20 * np.log10(db(-1.0) / peak)))
