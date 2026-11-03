"""Soundtrack: the user's own voiceover (untouched, one static gain) + quiet sound effects and party music made with code.
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
rng = np.random.default_rng(7)
VO_RMS = np.sqrt(np.mean(vo[np.abs(vo) > 0.01] ** 2))
t_ = lambda n: np.arange(n) / SR
db = lambda x: 10 ** (x / 20)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], btype="band", fs=SR, output="sos"), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, btype="low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, btype="high", fs=SR, output="sos"), x)
def level(x, rel):  # loud part of x sits rel dB under the voice
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

# ---- background party music (code-made loop): pads, bass, kick, claps, hats ; muffled behind walls, stops with a scratch
BPM = 118; beat = 60 / BPM
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
def saw(f, n): ph = (f * t_(n)) % 1; return 2 * ph - 1
chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]
bar = 4 * beat; MUS_END = w(199) + 0.25
mlen = int(MUS_END * SR) + SR
mus = np.zeros(mlen)
k = 0; tt = 0.0
while tt < MUS_END + bar:
    ch = chords[k % 4]; n = int(bar * SR); i = int(tt * SR)
    pad = sum(lp(saw(hz(m), n) + 0.5 * saw(hz(m) * 1.004, n), 1800) for m in ch) * env(n, 0.03, 0.2) * 0.25
    for b in range(8):                                   # bouncy bass on 8ths
        bn = int(beat / 2 * SR); bi = i + b * bn
        f = hz(ch[0] - 24 + (12 if b % 2 else 0)); x = np.sin(2 * np.pi * f * t_(bn)) * np.exp(-t_(bn) * 6) * 0.8
        if bi + bn < mlen: mus[bi:bi + bn] += x
    if i + n < mlen: mus[i:i + n] += pad
    for b in range(4):                                   # kick + clap + hats
        bi = i + int(b * beat * SR); kn = int(0.25 * SR)
        kick = np.sin(2 * np.pi * np.cumsum(50 + 110 * np.exp(-t_(kn) * 30)) / SR) * np.exp(-t_(kn) * 9)
        if bi + kn < mlen: mus[bi:bi + kn] += kick * 1.1
        if b % 2 == 1:
            cn = int(0.15 * SR); clap = bp(noise(cn), 900, 4000) * np.exp(-t_(cn) * 25) * 0.6
            if bi + cn < mlen: mus[bi:bi + cn] += clap
        for hh in (0, 0.5):
            hi_ = bi + int(hh * beat * SR); hn = int(0.05 * SR)
            if hi_ + hn < mlen: mus[hi_:hi_ + hn] += hp(noise(hn), 7000) * np.exp(-t_(hn) * 60) * 0.25
    k += 1; tt += bar
mus = mus[:mlen]
# loudness by scene: outside/living room = clear, bathroom/hallway = muffled through the walls
muff = lp(mus, 450, 4) * 1.6
inside0, inside1 = SH["08"]["t0"], SH["55"]["t0"]
g = np.ones(mlen); gi0, gi1 = int(inside0 * SR), int(inside1 * SR)
mixm = mus.copy(); mixm[gi0:gi1] = muff[gi0:gi1]
fade = int(0.08 * SR)
mixm[int(MUS_END * SR):] = 0
mixm[int(MUS_END * SR) - fade:int(MUS_END * SR)] *= np.linspace(1, 0, fade)
m = level(mixm, -27)
L[:mlen] += m[:N] * 0.95; R[:mlen] += m[:N]

# ---- record scratch when the burrito rolls into the living room (music stops)
n = int(0.45 * SR); t = t_(n)
src = mus[int((MUS_END - 1.0) * SR):int(MUS_END * SR)]
speed = np.where(t < 0.15, 1 - t / 0.15 * 3.2, np.where(t < 0.28, -2.2 + (t - 0.15) / 0.13 * 4.2, 2.0 - (t - 0.28) / 0.17 * 2.0))
pos = np.clip(0.5 * SR + np.cumsum(speed), 0, len(src) - 2)
scr = np.interp(pos, np.arange(len(src)), src) * env(n, 0.005, 0.06)
scr = bp(scr, 300, 5000) + 0.2 * bp(noise(n), 2000, 6000) * env(n, 0.005, 0.1)
place(level(scr, -14), MUS_END - 0.3)

# ---- pool splashes (shot 03)
def splash(dur=0.6, lo=500, hi=6000):
    n = int(dur * SR); t = t_(n); x = bp(noise(n), lo, hi) * np.exp(-t * 6) * (1 - np.exp(-t * 80))
    x += 0.5 * bp(noise(n), 150, 600) * np.exp(-t * 12); return x
place(level(splash(0.9), -16), w(7) + 0.57, 0.2)
for k2, tt2 in enumerate(np.arange(SH["01"]["t0"] + 0.2, SH["04"]["t0"], 0.45)):
    place(level(splash(0.25, 1500, 7000), -28), tt2, -0.3 + 0.6 * (k2 % 2))

# ---- shower water (on from "her shower" until he rolls out of the tub)
s0, s1 = w(29) + 0.05, SH["48"]["t0"]
n = int((s1 - s0) * SR); t = t_(n)
water = bp(noise(n), 700, 9000) * (1 + 0.15 * np.sin(2 * np.pi * 3.1 * t)) + 0.4 * bp(noise(n), 200, 700)
water *= env(n, 0.25, 0.5)
wl = level(water, -22); i0 = int(s0 * SR)
L[i0:i0 + n] += wl * 0.9; R[i0:i0 + n] += wl
# water drumming on the curtain (louder patter)
p0, p1 = w(125), w(132)
n = int((p1 - p0) * SR); t = t_(n)
pat = bp(noise(n), 300, 3000) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 7 * t))) * env(n, 0.2, 0.1)
place(level(pat, -24), p0)

# ---- squeaky wet rubbing (curtain grinding on him)
def squeak(f0=900, dur=0.18):
    n = int(dur * SR); t = t_(n); f = f0 * (1 + 0.35 * np.sin(np.pi * t / dur))
    x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.3 + np.sin(2 * np.pi * np.cumsum(f) / SR)
    return bp(x, 600, 4000) * env(n, 0.02, 0.06)
tt = w(46)
while tt < SH["17"]["t0"]:
    place(level(squeak(850 + 200 * rng.random()), -17), tt, 0.15 * np.sin(tt * 9)); tt += 1 / (2 * 1.9)

# ---- WHAP! shove, wet slap when it comes back
def slap(dur=0.22, bright=2500):
    n = int(dur * SR); t = t_(n); return (bp(noise(n), 300, bright) * np.exp(-t * 28) + 0.6 * np.sin(2 * np.pi * 110 * t) * np.exp(-t * 20))
place(level(slap(), -10), w(68))
place(level(slap(0.3, 1800), -13), w(78) - 0.12)

# ---- cute pops for the hearts, sparkle chimes for the genius moments
def pop(f=600):
    n = int(0.12 * SR); t = t_(n); return np.sin(2 * np.pi * np.cumsum(f + 900 * t / 0.12) / SR) * np.exp(-t * 30)
for i in range(8): place(level(pop(500 + 60 * i), -20), w(81) - 0.15 + i * 0.12, (-1) ** i * 0.3)
def chime():
    n = int(0.9 * SR); t = t_(n)
    return sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in [(1568, 1, 5), (2093, 0.7, 6), (2637, 0.5, 7), (3136, 0.35, 8)])
for tt in (w(98) - 0.05, w(104), w(117), w(119)): place(level(chime(), -19), tt, 0.1)

# ---- tape pulls (zzzip!) while he tapes the curtain
def zip_(dur=0.16):
    n = int(dur * SR); t = t_(n); x = bp(noise(n), 1200, 7000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * (60 + 200 * t / dur) * t)))
    return x * env(n, 0.01, 0.04)
for k2 in range(14):
    tt = w(105) + 0.02 + k2 * (0.22 if k2 < 5 else 0.17)
    if tt < w(117) - 0.2: place(level(zip_(0.12 + 0.06 * rng.random()), -18), tt, 0.4 * np.sin(k2))

# ---- creaking rail (heavier... heavier...)
for tt, dur in ((w(129), 0.7), (w(131) - 0.05, 0.9)):
    n = int(dur * SR); t = t_(n); f = 95 + 25 * np.sin(2 * np.pi * 1.3 * t) + 8 * noise(n).cumsum() / np.sqrt(SR)
    x = bp(np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 14 * t))), 300, 2500) * env(n, 0.1, 0.2)
    place(level(x, -18), tt)

# ---- RRRRIP (tape tearing): crackly bursts
n = int(0.55 * SR); t = t_(n)
cr = np.zeros(n)
for k2 in range(160):
    j = int(rng.uniform(0, 0.5) * SR); m2 = int(0.004 * SR)
    cr[j:j + m2] += rng.normal(0, 1, m2) * np.exp(-np.arange(m2) / (0.0015 * SR))
rip = bp(cr + 0.35 * noise(n), 900, 7000) * env(n, 0.01, 0.12)
place(level(rip, -9), w(132) - 0.02)

# ---- PING! PING! PING! rings flying off, then the rail crashes down
def ping(f=2200):
    n = int(0.8 * SR); t = t_(n)
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in [(1, 1, 7), (2.76, 0.5, 9), (5.4, 0.25, 12)])
for tt, f, pan in ((w(134), 2300, -0.3), (w(136) - 0.15, 2600, 0.3), (w(137) + 0.05, 2050, 0.0)): place(level(ping(f), -13), tt, pan)
n = int(1.0 * SR); t = t_(n)
clang = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in [(410, 5), (1130, 7), (1870, 9), (2950, 11)]) + bp(noise(n), 200, 3000) * np.exp(-t * 14) * 2
place(level(clang, -11), w(138))

# ---- thuds and thumps (rolling burrito)
def thump(f=70, dur=0.35, click=0.6):
    n = int(dur * SR); t = t_(n)
    return np.sin(2 * np.pi * np.cumsum(f + 60 * np.exp(-t * 25)) / SR) * np.exp(-t * 11) + click * lp(noise(n), 1500) * np.exp(-t * 40)
place(level(thump(60, 0.5), -8), w(166) + 0.06)                          # THUD in the tub
for tt in (w(184), w(185), w(186)): place(level(thump(75, 0.4, 0.8), -7), tt)  # THUMP x3
place(level(thump(65, 0.35), -14), SH["47"]["t0"] + 1.28)                # flop out of the tub
r0, r1 = w(175) - 0.05, w(199) + 0.2                                      # rolling rumble
n = int((r1 - r0) * SR); t = t_(n)
rum = lp(noise(n), 160) * (0.7 + 0.3 * np.abs(np.sin(2 * np.pi * 2.6 * t))) * env(n, 0.2, 0.3)
place(level(rum, -20), r0)

# ---- plate crash + snacks, meatball plop
n = int(1.1 * SR); t = t_(n)
crash = bp(noise(n), 2000, 9000) * np.exp(-t * 7)
for k2 in range(18):
    j = int(rng.uniform(0, 0.6) * SR); m2 = int(0.12 * SR); tt2 = t_(m2)
    crash[j:j + m2] += np.sin(2 * np.pi * rng.uniform(2500, 6000) * tt2) * np.exp(-tt2 * 40) * rng.uniform(0.2, 0.8)
crash += 0.8 * lp(noise(n), 400) * np.exp(-t * 20)
place(level(crash, -9), w(207) - 0.08)
n = int(0.2 * SR); t = t_(n)
plop = np.sin(2 * np.pi * np.cumsum(500 * np.exp(-t * 14) + 120) / SR) * np.exp(-t * 18)
place(level(plop, -15), w(215) + 0.3)

# ---- little "ting" on the wink, crowd gasp when the mouths drop
place(level(chime(), -17), w(257))
gasp = np.zeros(int(1.0 * SR))
for k2 in range(10):
    n = int((0.25 + rng.uniform(0, 0.15)) * SR); t = t_(n)
    v = bp(noise(n), 700 + rng.uniform(0, 600), 2400 + rng.uniform(0, 800)) * np.minimum(1, (t / (t[-1] * 0.8)) ** 1.5) * env(n, 0, 0.04)
    j = int(rng.uniform(0, 0.1) * SR); gasp[j:j + n] += v * rng.uniform(0.6, 1.0)
place(level(gasp, -16), w(258))

mix = np.stack([L, R], 1)
peak = np.abs(mix).max()
mix *= db(-1.0) / peak          # one static gain for the whole track (no compression, voice untouched)
sf.write(os.path.join(HERE, "mix.wav"), mix.astype(np.float32), SR)
print("mix %.3f s (voice %.3f s), gain %.1f dB" % (len(mix) / SR, N / SR, 20 * np.log10(db(-1.0) / peak)))
