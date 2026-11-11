# Procedural SFX + mix with voiceover (ducked). Output: mix_raw.wav (48k stereo float)
import numpy as np, subprocess, sys, os
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
DUR = 1712 / 60.0
N = int(round(DUR * SR))
HERE = os.path.dirname(os.path.abspath(__file__))
VO = os.path.join(HERE, 'voiceover.mp3')
rng = np.random.default_rng(1234)

def tt(d): return np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR))
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'highpass', fs=SR, output='sos'), x)
def norm(x, p=1.0):
    m = np.max(np.abs(x)) + 1e-9; return x / m * p
def env_ad(n, a, d, curve=3.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) * curve / max(d, 1e-4))
    return e
def fade(x, fi=0.005, fo=0.02):
    n = len(x); a = min(n, int(fi * SR)); b = min(n, int(fo * SR))
    if a: x[:a] *= np.linspace(0, 1, a)
    if b: x[-b:] *= np.linspace(1, 0, b)
    return x

BUS = np.zeros((2, N))        # sfx bus (ducked)
SPEC = np.zeros((2, N))       # musical/fx that also gets reverb
def S(*xs):
    L = max(len(x) for x in xs); o = np.zeros(L)
    for x in xs: o[:len(x)] += x
    return o
def put(x, t0, g=1.0, pan=0.0, bus=None):
    bus = BUS if bus is None else bus
    i = int(t0 * SR)
    if i >= N: return
    if i < 0: x = x[-i:]; i = 0
    x = x[:N - i]
    l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    bus[0, i:i + len(x)] += x * g * l * 1.414
    bus[1, i:i + len(x)] += x * g * r * 1.414

# ------------------------------------------------------------------ instruments
def knock(f=200, d=0.08, bright=1.0):
    t = tt(d)
    body = np.sin(2 * np.pi * f * t) * np.exp(-t * 55)
    n = bp(noise(d), 400, 2500 * bright) * np.exp(-t * 90)
    return S(body * 0.8, n * 0.5)

def rattle(d, rate=20, seed=0, f=(160, 260)):
    out = np.zeros(int(d * SR) + SR // 4)
    r = np.random.default_rng(seed)
    tcur = 0.0
    while tcur < d:
        k = knock(r.uniform(*f), 0.09, r.uniform(0.7, 1.4)) * r.uniform(0.4, 1.0)
        i = int(tcur * SR); out[i:i + len(k)] += k
        tcur += 1 / rate * r.uniform(0.6, 1.4)
    return out

def clink(f=2400, d=0.25):
    t = tt(d); x = 0
    for k, a in [(1.0, 1), (1.61, 0.6), (2.37, 0.4), (3.3, 0.25)]:
        x = x + a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (18 + 10 * k))
    return x * 0.5

def breath(d=0.45, inhale=True, f=(500, 2600)):
    n = bp(noise(d), *f)
    t = tt(d)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** (1.5 if inhale else 0.8)
    if not inhale: e *= np.exp(-t * 1.5)
    return n * e

def glottal(f0, d, vib=0.0, vibf=5.5, jitter=0.0):
    t = tt(d)
    f = f0 * (1 + vib * np.sin(2 * np.pi * vibf * t)) if np.isscalar(f0) else f0
    ph = np.cumsum(f / SR)
    saw = 2 * (ph % 1) - 1
    return lp(saw, 4000, 1)

def formant(src, fs_bw):
    out = 0
    for f, bw, g in fs_bw:
        out = out + g * bp(src, max(50, f - bw / 2), f + bw / 2, 2)
    return out

def grunt(d=0.32, f0=105):
    t = tt(d)
    pitch = f0 * (1 + 0.15 * np.sin(np.pi * t / d))
    g = glottal(pitch, d)
    v = formant(g, [(450, 120, 1.0), (950, 160, 0.6), (2400, 300, 0.2)])
    v += 0.2 * bp(noise(d), 300, 1500)
    return v * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.7

def whoosh(d=0.45, f0=300, f1=2500, q=0.6, peak=0.55):
    x = noise(d); n = len(x); out = np.zeros(n)
    t = np.arange(n) / n
    fc = f0 * (f1 / f0) ** t
    # time-varying 2-pole bandpass (state variable filter)
    low = band = 0.0
    for i in range(n):
        F = 2 * np.sin(np.pi * min(fc[i], 18000) / SR)
        high = x[i] - low - q * band
        band += F * high; low += F * band
        out[i] = band
    e = np.where(t < peak, (t / peak) ** 2, ((1 - t) / (1 - peak)) ** 1.5)
    return out * e

def thump(f0=90, f1=40, d=0.35):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)

def boom(d=1.0):
    t = tt(d)
    f = 35 + 110 * np.exp(-t * 12)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4)
    x += 0.5 * lp(noise(d), 300) * np.exp(-t * 6)
    return x

def bell(f, d=1.2, bright=1.0):
    t = tt(d); x = 0
    for k, a, dec in [(1, 1, 2.5), (2.0, 0.5, 4), (2.76, 0.35 * bright, 6), (5.4, 0.2 * bright, 10), (8.9, 0.1 * bright, 16)]:
        x = x + a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * dec)
    return x * np.minimum(1, t / 0.002)

def pluck(f, d=1.6, damp=0.996, bright=0.5):
    n = int(d * SR); P = max(2, int(SR / f))
    buf = rng.uniform(-1, 1, P) * bright + (1 - bright) * np.sin(np.linspace(0, 2 * np.pi, P))
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % P]
        buf[i % P] = damp * 0.5 * (buf[i % P] + buf[(i + 1) % P])
    return lp(out, 5000, 1)

def tone_pad(freqs, d, a=0.4, r=0.6):
    t = tt(d); x = 0
    for f in freqs:
        for det in (-0.004, 0.004):
            ph = 2 * np.pi * f * (1 + det) * t
            x = x + np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    e = np.minimum(1, t / a) * np.minimum(1, (d - t) / r)
    return lp(x, 2500) * np.clip(e, 0, 1)

def choir(freqs, d=1.0):
    t = tt(d); x = 0
    for i, f in enumerate(freqs):
        for det in (-0.006, 0.0, 0.007):
            g = glottal(f * (1 + det) * (1 + 0.012 * np.sin(2 * np.pi * (5 + i * 0.3) * t)), d)
            x = x + formant(g, [(800, 160, 1.0), (1150, 180, 0.6), (2900, 300, 0.25)])
    x += 0.15 * bp(noise(d), 2000, 8000)
    e = np.minimum(1, t / 0.18) * np.minimum(1, (d - t) / 0.35)
    return x * np.clip(e, 0, 1)

def giggle(t0, n=5, f0=420, seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros(int((n * 0.2 + 0.4) * SR))
    tc = 0.0
    for k in range(n):
        d = r.uniform(0.07, 0.11)
        t = tt(d)
        pitch = f0 * (1.25 - 0.35 * k / n) * (1 + 0.25 * np.sin(np.pi * t / d)) * r.uniform(0.92, 1.08)
        g = glottal(pitch, d)
        v = formant(g, [(900, 200, 1.0), (2300, 300, 0.7), (3500, 400, 0.3)]) + 0.5 * bp(noise(d), 1500, 5000)
        v *= np.sin(np.pi * t / d) ** 0.6
        i = int(tc * SR); out[i:i + len(v)] += v
        tc += d + r.uniform(0.05, 0.09)
    return out

def crackle(d=0.6, density=900, seed=0):
    r = np.random.default_rng(seed)
    n = int(d * SR); x = np.zeros(n)
    k = int(density * d)
    idx = r.integers(0, n, k); x[idx] = r.uniform(-1, 1, k) * r.uniform(0.2, 1, k) ** 2
    x = hp(x, 1500) + 0.4 * bp(x, 300, 1200)
    return x

def buzz(d=0.6, f=120):
    t = tt(d)
    ph = 2 * np.pi * f * t
    x = sum(np.sin(k * ph) / k for k in range(1, 18))
    x *= 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 23 * t + 3 * np.sin(2 * np.pi * 7 * t)))
    return bp(x, 100, 6000)

def scrape(d=0.4, seed=0):
    r = np.random.default_rng(seed)
    n = int(d * SR)
    x = bp(noise(d), 1500, 6000)
    am = np.zeros(n); tc = 0
    while tc < n:
        L = int(r.uniform(0.008, 0.03) * SR); am[tc:tc + L] = r.uniform(0.3, 1.0); tc += L + int(r.uniform(0.002, 0.01) * SR)
    am = lp(am, 150)
    res = sum(np.sin(2 * np.pi * f * np.arange(n) / SR) for f in (2100, 3300)) * 0.15
    return (x + res * np.abs(x).mean()) * am

def click(d=0.03, f=3000):
    t = tt(d); return (np.sin(2 * np.pi * f * t) * 0.6 + bp(noise(d), 2000, 9000)) * np.exp(-t * 220)

def squeak(d=0.25, f0=2400, seed=0):
    r = np.random.default_rng(seed); t = tt(d)
    f = f0 * (1 + 0.15 * np.sin(2 * np.pi * r.uniform(5, 11) * t))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 60 * t)))
    return lp(x, 6000) * np.sin(np.pi * t / d) * 0.6 + 0.2 * bp(noise(d), 3000, 7000) * np.sin(np.pi * t / d)

def bloop(f0=500, f1=1200, d=0.12):
    t = tt(d); f = f0 * (f1 / f0) ** (t / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d)

def paper(d=0.6, seed=0):
    r = np.random.default_rng(seed); n = int(d * SR)
    x = hp(noise(d), 2500)
    g = np.zeros(n); tc = 0
    while tc < n:
        L = int(r.uniform(0.005, 0.03) * SR); g[tc:tc + L] = r.uniform(0, 1) ** 2; tc += L
    return x * lp(g, 300) * np.exp(-np.arange(n) / SR * 2)

def scratch(d=0.3):
    # vinyl scratch: read a tonal source with back-forth playhead
    src_d = 1.0; t = tt(src_d)
    src = sum(np.sin(2 * np.pi * f * t) for f in (220, 277, 330, 440)) + 0.6 * noise(src_d)
    src = bp(src, 150, 5000)
    n = int(d * SR); tl = np.arange(n) / SR
    pos = 0.25 + 0.18 * np.sin(2 * np.pi * 1.5 / d * tl * 0.5) ** 3 + 0.05 * tl / d
    idx = np.clip(pos * SR, 0, len(src) - 2)
    i0 = idx.astype(int); fr = idx - i0
    x = src[i0] * (1 - fr) + src[i0 + 1] * fr
    return hp(x, 200) * np.sin(np.pi * tl / d) ** 0.4

def reverb(x, rt=1.4, wet=0.35, seed=5):
    r = np.random.default_rng(seed)
    L = int(rt * SR); t = np.arange(L) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = r.standard_normal(L) * np.exp(-t * 6.9 / rt)
        ir = lp(ir, 6000); ir /= np.sqrt((ir ** 2).sum())
        out[ch] = fftconvolve(x[ch], ir)[:x.shape[1]]
    return x * (1 - wet) + out * wet * 1.6

# ------------------------------------------------------------------ cue sheet
def cues():
    # S1/S2 struggle: breathing, grunts, rattle
    for k, (t0, ins) in enumerate([(0.0, True), (0.3, False), (0.62, True), (0.95, False), (1.3, True)]):
        put(breath(0.38, ins, (500, 2300) if k % 2 else (420, 1900)), t0, 0.32, -0.25 + 0.5 * (k % 2))
    put(grunt(0.34, 100), 0.12, 0.22, -0.2); put(grunt(0.3, 88), 0.5, 0.2, 0.25)
    put(rattle(0.85, 16, 1), 0.0, 0.22, 0.0)
    put(rattle(0.75, 26, 2, (180, 320)), 0.85, 0.5, 0.15)
    for k in range(9): put(clink(2200 + 400 * rng.random()), 0.9 + k * 0.075 + 0.02 * rng.random(), 0.16, 0.3)
    put(bp(noise(0.5), 800, 5000) * np.exp(-tt(0.5) * 5), 1.0, 0.12, 0.3)          # splash
    for k in range(8): put(click(0.02, 2500 + 500 * rng.random()), 0.9 + k * 0.04, 0.08, 0.4)  # pens rolling
    put(S(knock(900, 0.12, 2), clink(3100, 0.2)), 1.68, 0.18, 0.5); put(S(knock(1000, 0.1, 2), clink(2800, 0.2)), 1.8, 0.15, 0.55)
    put(whoosh(0.22, 400, 3500), 0.78, 0.25, -0.3); put(whoosh(0.25, 300, 3000), 1.5, 0.25, 0.3)
    # S3: footsteps, turn swish, gasp, papers, spit
    for k in range(5): put(S(thump(140, 70, 0.12) * 0.8, 0.2 * click(0.02, 1500)), 1.6 + k * 0.085 + (0.04 if k % 2 else 0), 0.22, -0.3 + 0.15 * k)
    put(whoosh(0.18, 600, 3000), 2.0, 0.18, -0.2); put(whoosh(0.18, 500, 2800), 2.06, 0.16, 0.2)
    put(breath(0.22, True, (900, 3500)), 2.13, 0.35, -0.1); put(breath(0.2, True, (800, 3000)), 2.16, 0.3, 0.2)
    put(paper(0.7, 3), 2.25, 0.45, -0.25); put(knock(500, 0.1, 2) * 0.6, 2.62, 0.2, -0.3)
    sp = bp(noise(0.35), 700, 5000) * env_ad(int(0.35 * SR), 0.01, 0.25, 4)
    put(sp, 2.42, 0.45, 0.25)
    for k in range(10): put(click(0.015, 1800 + 800 * rng.random()), 2.55 + 0.03 * k, 0.07, 0.3)
    # S4: shimmer + dreamy pad
    for k in range(10): put(bell(2800 + 1800 * rng.random(), 0.5, 0.5) * 0.4, 2.95 + k * 0.17, 0.055, rng.uniform(-0.7, 0.7), SPEC)
    put(tone_pad([261.6, 329.6, 392.0, 493.9], 1.9, 0.35, 0.5), 2.95, 0.03, 0.0, SPEC)
    put(bloop(700, 1400, 0.1), 3.2, 0.05, 0.3, SPEC)
    # S5: reveal whoosh, flashlight click, plastic scraping
    put(whoosh(0.9, 2500, 250, 0.7, 0.3), 4.72, 0.3, 0.0)
    put(S(click(0.025, 2200), click(0.02, 1400)), 4.86, 0.25, 0.3)
    for k, t0 in enumerate([5.25, 5.75, 6.3, 6.85, 7.3]): put(scrape(0.32, k), t0, 0.12, -0.35)
    # S6a: slow-mo
    sl = lp(noise(1.1), 600) * np.linspace(1, 0.2, int(1.1 * SR)) + 0.6 * np.sin(2 * np.pi * np.cumsum(np.linspace(180, 55, int(1.1 * SR))) / SR) * np.linspace(0.5, 0, int(1.1 * SR))
    put(sl, 7.6, 0.25, 0.0)
    put(thump(70, 40, 0.3), 7.75, 0.45); put(thump(60, 38, 0.3), 7.95, 0.35); put(thump(70, 40, 0.3), 8.35, 0.45); put(thump(60, 38, 0.3), 8.55, 0.35)
    put(scrape(0.42, 7), 7.95, 0.22, -0.2)
    put(click(0.02, 4000), 8.62, 0.25, -0.2)
    # S6b: ZAP
    put(crackle(0.75, 1600, 1), 8.69, 0.75, -0.15); put(crackle(0.6, 1200, 2), 8.71, 0.65, 0.2)
    put(buzz(0.62, 118), 8.7, 0.38, 0.0)
    put(boom(1.1), 8.69, 0.9, 0.0)
    put(bp(noise(0.08), 1000, 12000) * np.exp(-tt(0.08) * 40), 8.69, 0.8, 0.0)
    put(buzz(0.38, 60) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 7.5 * tt(0.38)))), 8.74, 0.22, 0.0)
    put(lp(noise(0.7), 900) * env_ad(int(0.7 * SR), 0.06, 0.6, 3), 9.0, 0.35, 0.0)        # smoke poof
    put(hp(noise(1.2), 3000) * np.exp(-tt(1.2) * 2.5), 9.05, 0.08, 0.0)                     # sizzle
    # swirl into flashback
    put(whoosh(0.6, 200, 4000, 0.5, 0.6), 9.15, 0.35, 0.0)
    for k, f in enumerate([523.3, 659.3, 784.0, 987.8, 1174.7, 1568.0, 2093.0]): put(bell(f, 1.6, 0.6), 9.32 + k * 0.06, 0.12, -0.6 + 0.2 * k, SPEC)
    put(tone_pad([261.6, 392.0, 523.3, 659.3], 4.6, 0.6, 0.9), 9.45, 0.05, 0.0, SPEC)
    # S7: polaroids fly past + shutter clicks
    for n in range(7):
        ts = 9.42 + n * 0.36
        put(S(click(0.012, 5000), click(0.02, 2500)), ts + 0.05, 0.08, rng.uniform(-0.5, 0.5))
        put(whoosh(0.35, 500, 4000, 0.6, 0.75), ts + 1.1, 0.2, (-1) ** n * 0.6)
    # S8: polaroids land, heart pops, heartbeat
    for k, tl in enumerate([12.15, 12.6, 12.98, 13.33]):
        put(whoosh(0.28, 600, 3000, 0.6, 0.8), tl - 0.3, 0.16, -0.4 + 0.27 * k)
        put(S(knock(700, 0.06, 1.5) * 0.5, click(0.012, 5200)), tl, 0.25, -0.4 + 0.27 * k)
        put(bloop(600, 1300, 0.09), tl + 0.12, 0.1, -0.4 + 0.27 * k, SPEC)
    for tb in (13.66, 14.03):
        put(thump(80, 42, 0.28), tb, 0.5); put(thump(70, 40, 0.26), tb + 0.17, 0.38)
    # S9: smoky room, YOINK, harp
    put(lp(noise(3.8), 500) * 0.5, 14.27, 0.05, 0.0)
    put(whoosh(0.3, 3000, 300, 0.7, 0.4), 14.2, 0.22, 0.0)
    put(whoosh(0.14, 800, 5000, 0.4, 0.5), 14.56, 0.3, -0.3)
    zz = np.sin(2 * np.pi * np.cumsum(np.linspace(150, 600, int(0.45 * SR))) / SR)
    put(lp(np.sign(zz) * 0.5 + zz, 3000) * np.sin(np.pi * tt(0.45) / 0.45) * (0.6 + 0.4 * np.sin(2 * np.pi * 30 * tt(0.45))), 14.82, 0.12, -0.1)
    put(knock(300, 0.1, 1.0), 15.3, 0.3, 0.0)
    harp_notes = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3, 784.0, 880.0, 1046.5]
    for k, f in enumerate(harp_notes): put(pluck(f, 1.6), 15.8 + k * 0.035, 0.14, -0.6 + 0.12 * k, SPEC)
    chords = [[261.6, 329.6, 392.0, 493.9], [220.0, 261.6, 329.6, 392.0], [174.6, 220.0, 261.6, 329.6], [196.0, 246.9, 293.7, 392.0]]
    for c, t0 in enumerate([16.25, 16.75, 17.25, 17.75]):
        for k, f in enumerate(chords[c] + [chords[c][0] * 2]): put(pluck(f * 2, 1.4, 0.995, 0.35), t0 + k * 0.07, 0.06, -0.4 + 0.2 * k, SPEC)
    put(tone_pad([261.6, 329.6, 392.0], 2.2, 0.5, 0.8), 15.9, 0.035, 0.0, SPEC)
    # S10: hair crackles, sizzle, blinks
    for k in range(9): put(crackle(0.12, 700, 20 + k), 18.1 + k * 0.27 + 0.1 * rng.random(), 0.18, rng.uniform(-0.4, 0.4))
    put(hp(noise(2.4), 3500) * 0.4, 18.05, 0.04, 0.0)
    put(bloop(900, 600, 0.14) * 0.7, 18.42, 0.14, 0.2, SPEC); put(bloop(900, 600, 0.14) * 0.7, 19.88, 0.14, 0.2, SPEC)
    # S11a: rustle, keys jingle, choir, ding, whoosh
    put(bp(noise(0.3), 800, 4000) * np.sin(np.pi * tt(0.3) / 0.3), 20.6, 0.14, 0.1)
    for k in range(16):
        f = rng.uniform(3200, 7000)
        put(bell(f, 0.35, 1.2) * 0.5, 20.88 + rng.uniform(0, 0.45), 0.1, rng.uniform(-0.5, 0.5))
    put(choir([220.0, 277.2, 329.6, 440.0, 554.4], 1.2), 20.92, 0.11, 0.0, SPEC)
    put(bell(1760, 1.4, 0.8), 20.95, 0.16, 0.1, SPEC)
    put(whoosh(0.35, 300, 5000, 0.5, 0.85), 21.42, 0.3, 0.0)
    # S11b: whip, flip, ding
    put(whoosh(0.22, 400, 4000, 0.5, 0.5), 21.98, 0.25, -0.4)
    put(bp(noise(0.05), 600, 3000) * np.exp(-tt(0.05) * 60), 22.22, 0.4, -0.2); put(bp(noise(0.05), 500, 2500) * np.exp(-tt(0.05) * 60), 22.36, 0.35, -0.2)
    put(bell(2093, 1.2, 0.7) + 0.6 * bell(2637, 1.2, 0.5), 22.45, 0.12, -0.1, SPEC)
    # S12: title card, giggles, marker squeaks
    put(whoosh(0.3, 300, 3000, 0.6, 0.7), 22.8, 0.3, -0.5); put(S(thump(110, 45, 0.4), 0.4 * click(0.02, 1800)), 23.07, 0.5)
    put(whoosh(0.28, 3000, 400, 0.6, 0.3), 23.72, 0.25, 0.5)
    for k, (t0, f0) in enumerate([(24.0, 430), (24.35, 380), (24.75, 460), (25.05, 400)]): put(giggle(t0, 5, f0, k), t0, 0.12, rng.uniform(-0.5, 0.5))
    for k in range(6): put(squeak(0.18 + 0.1 * rng.random(), 2200 + 600 * rng.random(), k), 23.45 + k * 0.33, 0.05, -0.5)
    # S13: point swish, impact
    put(whoosh(0.2, 700, 4000, 0.5, 0.6), 26.27, 0.25, 0.0)
    put(S(thump(120, 40, 0.5), 0.5 * bp(noise(0.12), 500, 6000) * np.exp(-tt(0.12) * 30)), 26.6, 0.6, 0.0)
    put(giggle(26.75, 3, 520, 9) * 0.6, 26.75, 0.05, 0.3)
    # S14: record scratch, happy chime, confetti popper
    put(scratch(0.28), 27.36, 0.55, 0.0)
    for k, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0, 2637.0]): put(bell(f, 1.3, 0.7), 27.65 + k * 0.055, 0.15, -0.4 + 0.2 * k, SPEC)
    put(S(bp(noise(0.06), 500, 8000) * np.exp(-tt(0.06) * 50), 0.6 * thump(200, 80, 0.12)), 27.64, 0.45, 0.0)
    put(paper(0.85, 11), 27.7, 0.25, 0.2)

cues()
SPECW = reverb(SPEC, 1.6, 0.4)
BUS = reverb(BUS, 0.35, 0.12, 7)  # tiny room for everything
sfx = BUS + SPECW

# voice
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', VO, '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'], capture_output=True).stdout
vo = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]
vo = norm(vo, 0.89)
# duck envelope
a = np.abs(vo); win = int(0.02 * SR)
envv = np.convolve(a, np.ones(win) / win, 'same')
sm = np.zeros(N); v = 0.0
att, rel = 1 - np.exp(-1 / (0.015 * SR)), 1 - np.exp(-1 / (0.22 * SR))
for i in range(0, N, 32):
    e = envv[i]; v += (e - v) * (1 - (1 - (att if e > v else rel)) ** 32); sm[i:i + 32] = v
duck = 1 - 0.55 * np.clip(sm / (np.percentile(envv[envv > 0.01], 70) + 1e-6), 0, 1)
sfx *= duck
sfx = norm(sfx, 0.7) if np.max(np.abs(sfx)) > 0.7 else sfx
mix = np.stack([vo, vo]) + sfx * 0.9
mix = np.tanh(mix * 1.05) / np.tanh(1.05)
os.makedirs(os.path.join(HERE, 'build'), exist_ok=True)
out = os.path.join(HERE, 'build', 'mix_raw.wav')
import wave
pcm = (np.clip(mix.T, -1, 1) * 32767).astype(np.int16)
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', out, mix.shape, 'peak', np.max(np.abs(mix)), 'sfx peak', np.max(np.abs(sfx)))
