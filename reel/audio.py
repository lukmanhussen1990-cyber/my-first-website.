"""Synthesize the reel's soundtrack (12 s, 48 kHz stereo) -> build/audio.wav

Soft wind, rustling leaves, a few bird chirps at the start, little bony
footsteps / props foley, then the distant clack of a passing train with a
soft whistle around 6-9 s, and quiet wind again at the end.
Timings mirror the animation in scene.js.
"""
import os
import wave

import numpy as np

SR = 48000
DUR = 12.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(2024)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build", "audio.wav")


# ------------------------------------------------------------------ helpers
def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def band(x, lo=None, hi=None, order=2):
    """Zero-phase band shaping in the frequency domain."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    h = np.ones_like(f)
    if lo:
        h /= np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    if hi:
        h /= np.sqrt(1 + (f / hi) ** (2 * order))
    return np.fft.irfft(X * h, n=len(x))


def fftconv(a, b):
    n = len(a) + len(b) - 1
    m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(a, m) * np.fft.rfft(b, m), m)[:n]


def slow_noise(step, seed):
    """Smooth random curve in [0, 1], new value every `step` seconds."""
    r = np.random.default_rng(seed)
    knots = np.arange(-step, DUR + 2 * step, step)
    vals = r.random(len(knots))
    y = np.interp(t, knots, vals)
    k = int(step * SR)
    win = np.hanning(k)
    return fftconv(y, win / win.sum())[k // 2: k // 2 + N]


def env(points):
    ts, vs = zip(*points)
    return np.interp(t, ts, vs)


def place(dst, src, start, gain=1.0, pan=0.0):
    """Mix mono `src` into stereo `dst` at time `start` with equal-power pan."""
    i = int(start * SR)
    if i >= N:
        return
    src = src[: N - i]
    a = (pan + 1) * np.pi / 4
    dst[0, i:i + len(src)] += src * gain * np.cos(a)
    dst[1, i:i + len(src)] += src * gain * np.sin(a)


def pan_stereo(x, pan):
    a = (np.asarray(pan) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)])


def reverb(x, decay=0.9, seed=5):
    """Simple stereo convolution reverb (decaying, darkened noise)."""
    r = np.random.default_rng(seed)
    L = int(decay * 1.6 * SR)
    tt = np.arange(L) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = r.standard_normal(L) * np.exp(-tt * 6.9 / decay)
        ir = band(ir, lo=200, hi=4500)
        ir[: int(0.012 * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        out[ch] = fftconv(x[ch], ir)[:N]
    return out


def gust(tt):
    return smoothstep((tt - 6.3) / 0.5) * (1 - smoothstep((tt - 8.2) / 0.8))


# ------------------------------------------------------------------ layers
dry = np.zeros((2, N))
wet = np.zeros((2, N))   # sent to reverb
g = gust(t)

# soft wind: low noise with slow breathing, stronger whoosh with the train
for ch, seed in ((0, 11), (1, 12)):
    w = band(np.random.default_rng(seed).standard_normal(N), lo=60, hi=520, order=1)
    w /= np.std(w)
    breath = 0.55 + 0.45 * slow_noise(1.1, seed + 5)
    hi = band(np.random.default_rng(seed + 50).standard_normal(N), lo=700, hi=2200, order=2)
    hi /= np.std(hi)
    base = 0.055 * breath * (1 - 0.35 * smoothstep((t - 10.5) / 1.5))
    dry[ch] += w * (base + 0.075 * g) + hi * (0.006 * breath + 0.022 * g * (0.6 + 0.4 * slow_noise(0.35, seed + 9)))

# rustling leaves: tiny crackly grains of bright noise
rate = 20 + 26 * slow_noise(0.8, 3) + 160 * g
imp = (rng.random(N) < rate / SR) * rng.uniform(0.25, 1.0, N)
kern = np.exp(-np.arange(int(0.03 * SR)) / (0.006 * SR))
grains = fftconv(imp, kern)[:N]
for ch, seed in ((0, 21), (1, 22)):
    hn = band(np.random.default_rng(seed).standard_normal(N), lo=1800, hi=8000)
    hn /= np.std(hn)
    dry[ch] += hn * grains * (0.022 + 0.035 * g) * (1 - 0.4 * smoothstep((t - 10.8) / 1.2))


# birds at the start
def chirp(f0, f1, dur, vib=0.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 + (f1 - f0) * (tt / dur) ** 0.7 + vib * np.sin(2 * np.pi * 38 * tt)
    ph = 2 * np.pi * np.cumsum(f) / SR
    a = np.sin(np.pi * tt / dur) ** 1.5
    return a * (np.sin(ph) + 0.18 * np.sin(2 * ph))


phrases = [
    (0.22, -0.6, 0.22, [(3600, 4700, 0.07), (3700, 4800, 0.07), (4900, 3500, 0.11)]),
    (1.05, 0.65, 0.17, [(5200, 4200, 0.06), (5200, 4100, 0.06), (5100, 4000, 0.06), (4300, 5600, 0.12)]),
    (1.95, -0.3, 0.12, [(4100, 3300, 0.09), (4400, 5400, 0.08)]),
    (2.85, 0.5, 0.09, [(3900, 4900, 0.07), (4000, 5000, 0.07)]),
]
for start, pan, gain, notes in phrases:
    tt0 = start
    for f0, f1, d in notes:
        c = chirp(f0, f1, d, vib=120)
        place(dry, c, tt0, gain * 0.7, pan)
        place(wet, c, tt0, gain * 0.6, pan)
        tt0 += d + rng.uniform(0.05, 0.09)


# little bony footsteps on the wooden platform
def tok(gain=1.0, pitch=1.0):
    n = int(0.09 * SR)
    tt = np.arange(n) / SR
    knock = np.sin(2 * np.pi * (560 * pitch + 260 * np.exp(-tt / 0.01)) * tt) * np.exp(-tt / 0.03)
    thump = np.sin(2 * np.pi * 150 * pitch * tt) * np.exp(-tt / 0.04)
    click = band(rng.standard_normal(n), lo=1500, hi=5000) * np.exp(-tt / 0.006) * 0.25
    return gain * (0.45 * knock + 0.6 * thump + click)


walk_v = 574 / (2.25 - 0.225)
for i, d in enumerate([95.7, 191.3, 287.0, 382.6, 478.3]):
    place(dry, tok(0.11, 1.0 + 0.05 * (i % 2)), d / walk_v, 1.0, -0.6 + 0.12 * i)
for tt0, gn in ((2.24, 0.09), (2.44, 0.08), (3.47, 0.06)):
    place(dry, tok(gn, 1.08), tt0, 1.0, 0.0)

# suitcase set down: soft leathery thud + a small bounce
def thud(gain, f=95):
    n = int(0.25 * SR)
    tt = np.arange(n) / SR
    body = np.sin(2 * np.pi * (f + 40 * np.exp(-tt / 0.02)) * tt) * np.exp(-tt / 0.07)
    slap = band(rng.standard_normal(n), lo=300, hi=2500) * np.exp(-tt / 0.012) * 0.5
    return gain * (body + slap)


place(dry, thud(0.32), 3.16, 1.0, 0.15)
place(dry, thud(0.08, 120), 3.23, 1.0, 0.15)


# bench creak + bony landing when it hops on the seat
def creak(dur=0.32, f=210):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    pulses = 70 + 25 * np.sin(2 * np.pi * 3 * tt)
    ph = np.cumsum(pulses) / SR
    saw = (ph % 1.0) * 2 - 1
    sig = band(saw * (0.6 + 0.4 * rng.random(n)), lo=f, hi=f * 6)
    return sig * np.sin(np.pi * tt / dur) ** 0.8


place(dry, creak() * 0.16, 3.84, 1.0, -0.05)
place(dry, tok(0.12, 0.8), 3.85, 1.0, -0.05)
place(dry, creak(0.2, 260) * 0.06, 10.75, 1.0, -0.05)   # leaning back

# bony rattle while shaking the leaf off, and while holding the skull in the wind
for k in range(9):
    place(dry, tok(0.035, 2.4 + 0.3 * (k % 3)), 5.5 + k * 0.05, 1.0, -0.05)
for k in range(10):
    place(dry, tok(0.02, 2.6), 6.75 + k * 0.19 + rng.uniform(0, 0.05), 1.0, 0.0)

# ------------------------------------------------------------------ train
tr_env = env([(0, 0), (5.5, 0), (6.15, 0.55), (6.6, 1.0), (7.6, 0.95), (8.6, 0.5), (9.4, 0.12), (10.2, 0)])
tr_pan = np.interp(t, [5.5, 6.4, 8.8, 9.6], [0.75, 0.55, -0.6, -0.75])
rumble = band(rng.standard_normal(N), lo=28, hi=210, order=2)
rumble /= np.std(rumble)
rumble *= 1 + 0.25 * np.sin(2 * np.pi * 7.5 * t)
dry += pan_stereo(rumble * 0.075 * tr_env, tr_pan)


def clack():
    n = int(0.07 * SR)
    tt = np.arange(n) / SR
    c = band(rng.standard_normal(n), lo=700, hi=3200) * np.exp(-tt / 0.012)
    c += 0.8 * np.sin(2 * np.pi * 180 * tt) * np.exp(-tt / 0.025)
    return c


clacks = np.zeros(N)
tc = 5.7
while tc < 9.6:
    for off in (0.0, 0.105):
        i = int((tc + off) * SR)
        cl = clack()
        clacks[i:i + len(cl)] += cl[: max(0, N - i)] * rng.uniform(0.75, 1.0)
    tc += 0.36
clacks = band(clacks, hi=2600)
dry += pan_stereo(clacks * 0.12 * tr_env, tr_pan)
wet += pan_stereo(clacks * 0.08 * tr_env, tr_pan)

chuff_n = np.zeros(N)
tc = 5.8
k = 0
while tc < 9.2:
    i = int(tc * SR)
    n = int(0.16 * SR)
    tt = np.arange(n) / SR
    burst = np.random.default_rng(k).standard_normal(n) * (1 - np.exp(-tt / 0.01)) * np.exp(-tt / 0.06)
    chuff_n[i:i + n] += burst[: max(0, N - i)] * (1.0 if k % 4 == 0 else 0.6)
    tc += 0.19
    k += 1
chuff_n = band(chuff_n, lo=250, hi=1400)
dry += pan_stereo(chuff_n * 0.045 * tr_env, tr_pan)


# soft steam whistle (F major triad, breathy, distant)
def whistle(dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * tt)
    for f, a in ((349.2, 1.0), (440.0, 0.8), (523.3, 0.6)):
        ph = 2 * np.pi * np.cumsum(f * vib) / SR
        out += a * (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph))
    breath = band(np.random.default_rng(9).standard_normal(n), lo=900, hi=3200)
    out += 0.9 * breath / np.std(breath) * 0.25
    att = smoothstep(tt / 0.09)
    rel = smoothstep((dur - tt) / 0.28)
    return band(out * att * rel, hi=2400) / 3.0


place(dry, whistle(0.75), 6.12, 0.17, 0.55)
place(wet, whistle(0.75), 6.12, 0.2, 0.55)
place(dry, whistle(0.32), 7.02, 0.11, 0.2)
place(wet, whistle(0.32), 7.02, 0.14, 0.2)

# ------------------------------------------------------------------ mix
mix = dry + 0.55 * reverb(wet, decay=1.1)
mix = np.stack([band(mix[0], lo=25), band(mix[1], lo=25)])
fade_in = smoothstep(t / 0.35)
fade_out = smoothstep((DUR - t) / 0.7)
mix *= fade_in * fade_out
mix = np.tanh(mix * 1.1) / 1.1
mix *= 0.89 / np.max(np.abs(mix))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
pcm = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
with wave.open(OUT, "wb") as f:
    f.setnchannels(2)
    f.setsampwidth(2)
    f.setframerate(SR)
    f.writeframes(pcm.tobytes())
print("wrote", OUT, "rms", float(np.sqrt(np.mean(mix ** 2))))
