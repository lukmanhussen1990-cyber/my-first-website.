"""Procedural music + sound effects (pure numpy, no external services),
mixed under the provided voiceover (out/vo_padded.f32 from timeline.py).
Writes out/mix.wav (44.1 kHz stereo, 60 s)."""
import numpy as np, os, wave, json, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100; DUR = 60.0; N = int(SR * DUR)
rs = np.random.RandomState(7)
L = np.zeros(N); R = np.zeros(N)

def T(n): return np.arange(n) / SR
def noise(n, seed=None):
    r = np.random.RandomState(seed) if seed is not None else rs
    return r.uniform(-1, 1, n)
def band(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo > 0: m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi: m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))
def norm(x):
    p = np.max(np.abs(x)) or 1; return x / p
def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N or i + len(sig) <= 0: return
    a = max(0, -i); sig = sig[a:]; i = max(0, i)
    sig = sig[:N - i]
    gl = gain * np.sqrt((1 - pan) / 2) * 1.41; gr = gain * np.sqrt((1 + pan) / 2) * 1.41
    L[i:i + len(sig)] += sig * gl; R[i:i + len(sig)] += sig * gr
def env(n, a=0.005, d=0.2, curve=1.0):
    t = T(n); e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d * curve)
    return e
def sweep(f0, f1, dur, shape='exp'):
    n = int(dur * SR); t = T(n)
    f = f0 * (f1 / f0) ** (t / dur) if shape == 'exp' else f0 + (f1 - f0) * t / dur
    return np.sin(2 * np.pi * np.cumsum(f) / SR)

# ---------------- SFX ----------------
def splat(big=1.0):
    n = int(0.5 * SR); t = T(n)
    s = band(noise(n), 250, 3500) * env(n, 0.002, 0.07 * big) * 1.2
    s += sweep(700, 160, 0.18)[:n] if n <= int(0.18 * SR) else np.pad(sweep(700, 160, 0.18), (0, n - int(0.18 * SR))) * 0
    b = np.pad(sweep(650, 170, 0.16) * env(int(0.16 * SR), 0.002, 0.06), (0, n - int(0.16 * SR)))
    th = np.pad(sweep(140, 55, 0.2) * env(int(0.2 * SR), 0.002, 0.07), (0, n - int(0.2 * SR)))
    return norm(s * 0.8 + b * 0.6 + th * 0.9)
def whoosh(dur=0.5, lo=300, hi=3000):
    n = int(dur * SR); t = T(n)
    s = band(noise(n), lo, hi); e = np.sin(np.pi * t / dur) ** 2
    return norm(s * e)
def thud(f=70):
    n = int(0.45 * SR)
    s = sweep(f * 1.6, f * 0.7, 0.45) * env(n, 0.002, 0.12) + band(noise(n), 30, 500) * env(n, 0.001, 0.05) * 0.8
    return norm(s)
def tonk(f=330):
    n = int(0.3 * SR); t = T(n)
    s = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.4 * t)) * env(n, 0.001, 0.07) + band(noise(n), 1000, 6000) * env(n, 0.0005, 0.008) * 0.6
    return norm(s)
def chuff():
    n = int(0.18 * SR)
    return norm(band(noise(n), 150, 1800) * env(n, 0.004, 0.05) + sweep(110, 60, 0.18) * env(n, 0.002, 0.04) * 0.6)
def pop_sfx():
    n = int(0.16 * SR)
    s = sweep(380, 1100, 0.16) * env(n, 0.003, 0.05)
    return norm(s)
def boing():
    n = int(0.5 * SR); t = T(n)
    f = 180 + 120 * np.exp(-t * 6) * np.sin(2 * np.pi * 9 * t) + 60 * t
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, 0.18))
def blip(f0=300, f1=1100, d=0.06):
    n = int(d * SR); return sweep(f0, f1, d) * np.sin(np.pi * T(n) / d)
def chime(base=1568):
    out = np.zeros(int(1.4 * SR))
    for k, m in enumerate([1, 1.26, 1.5, 2.0, 2.52]):
        n = int(1.0 * SR); t = T(n); s = np.sin(2 * np.pi * base * m * t) * env(n, 0.002, 0.25) * (0.8 ** k)
        i = int(k * 0.07 * SR); out[i:i + n] += s
    return norm(out)
def creak_clack():
    n = int(0.35 * SR); t = T(n)
    c = np.sign(np.sin(2 * np.pi * np.cumsum(360 - 200 * t / 0.35) / SR)) * env(n, 0.01, 0.12) * 0.25
    c = band(c, 200, 2500)
    k = band(noise(int(0.05 * SR)), 800, 6000) * env(int(0.05 * SR), 0.0005, 0.01)
    out = np.zeros(n); out += c; out[int(0.22 * SR):int(0.22 * SR) + len(k)] += k * 1.2
    return norm(out)
def flush():
    n = int(1.6 * SR); t = T(n)
    s = band(noise(n), 300, 4000) * (0.6 + 0.4 * np.sin(2 * np.pi * (6 + 4 * t) * t)) * np.minimum(1, t / 0.08) * np.exp(-np.maximum(0, t - 0.5) / 0.45)
    g = np.zeros(n)
    for k in range(10):
        i = int((0.5 + k * 0.09 + rs.uniform(0, 0.04)) * SR); b = blip(200 + rs.uniform(0, 200), 500 + rs.uniform(0, 300), 0.07)
        g[i:i + len(b)] += b * 0.5
    return norm(s + g)
def wahwah():
    out = np.zeros(int(1.3 * SR))
    notes = [(233.1, 0.22), (220.0, 0.22), (207.7, 0.22), (196.0, 0.55)]
    i = 0
    for k, (f, d) in enumerate(notes):
        n = int(d * SR); t = T(n)
        vib = 1 + (0.02 * np.sin(2 * np.pi * 6 * t) if k == 3 else 0)
        ph = 2 * np.pi * np.cumsum(f * vib) / SR
        saw = sum(np.sin(h * ph) / h for h in range(1, 8))
        e = np.minimum(1, t / 0.03) * np.minimum(1, (d - t) / 0.06)
        wah = 0.55 + 0.45 * np.sin(np.pi * np.minimum(1, t / d))
        out[i:i + n] += saw * e * wah; i += n
    return norm(band(out, 120, 2200))
def buzz(dur, f=210, seed=0):
    n = int(dur * SR); t = T(n); r = np.random.RandomState(seed)
    fm = f * (1 + 0.04 * np.sin(2 * np.pi * 7 * t + seed) + 0.03 * np.sin(2 * np.pi * 0.7 * t))
    ph = 2 * np.pi * np.cumsum(fm) / SR
    s = sum(np.sin(h * ph) / h for h in range(1, 10))
    am = 0.5 + 0.5 * np.sin(2 * np.pi * (0.9 + seed * 0.3) * t) ** 2
    return norm(band(s, 150, 3000)) * am
def rain(dur):
    n = int(dur * SR)
    s = band(noise(n, 3), 1200, 9000) * 0.5 + band(noise(n, 4), 100, 900) * 0.35
    ticks = np.zeros(n)
    for k in range(int(dur * 60)):
        i = rs.randint(0, n - 400); ticks[i:i + 300] += band(noise(300), 2000, 8000) * env(300, 0.0005, 0.002) * rs.uniform(0.2, 0.7)
    return s + ticks
def thunder():
    n = int(2.8 * SR); t = T(n)
    s = band(noise(n, 9), 25, 260) * (np.minimum(1, t / 0.08) * np.exp(-t / 0.9)) * (1 + 0.5 * np.sin(2 * np.pi * 3 * t))
    crack = band(noise(int(0.25 * SR), 10), 300, 6000) * env(int(0.25 * SR), 0.002, 0.06)
    s[:len(crack)] += crack * 0.7
    return norm(s)
def water_flow(dur, lo=200, hi=1600, seed=5, blips=6):
    n = int(dur * SR); t = T(n)
    s = band(noise(n, seed), lo, hi) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.8 * t + seed))
    for k in range(int(dur * blips)):
        i = rs.randint(0, max(1, n - 3000)); b = blip(250 + rs.uniform(0, 300), 600 + rs.uniform(0, 500), 0.05)
        s[i:i + len(b)] += b * 0.25
    fade = np.minimum(1, np.minimum(t / 0.15, (dur - t) / 0.15))
    return s * fade
def hum(dur):
    n = int(dur * SR); t = T(n)
    s = np.sin(2 * np.pi * 60 * t) + 0.5 * np.sin(2 * np.pi * 120 * t) + 0.2 * np.sin(2 * np.pi * 180 * t)
    s *= 0.7 + 0.3 * np.sin(2 * np.pi * 2.2 * t)
    return s * np.minimum(1, np.minimum(t / 0.2, (dur - t) / 0.2))
def crowd_cheer(dur):
    n = int(dur * SR); t = T(n); out = np.zeros(n)
    for v in range(36):
        r = np.random.RandomState(100 + v)
        f1 = r.uniform(500, 1100); f2 = r.uniform(1300, 2600)
        s = band(r.uniform(-1, 1, n), f1 * 0.7, f1 * 1.4) + 0.6 * band(r.uniform(-1, 1, n), f2 * 0.8, f2 * 1.2)
        am = np.clip(np.sin(2 * np.pi * r.uniform(1.5, 4) * t + r.uniform(0, 6)), 0, 1) ** 1.5
        out += s * (0.5 + 0.5 * am)
    out = norm(out)
    for k in range(int(dur * 6)):   # whistles + "woo"
        st = rs.uniform(0, dur - 0.6); d = rs.uniform(0.25, 0.6); m = int(d * SR)
        f0 = rs.uniform(1600, 2600); w = sweep(f0, f0 * rs.uniform(0.8, 1.3), d) * np.sin(np.pi * T(m) / d) * 0.12
        i = int(st * SR); out[i:i + m] += w
    for k in range(int(dur * 45)):  # claps
        i = rs.randint(0, n - 900); out[i:i + 800] += band(noise(800), 700, 5000) * env(800, 0.0005, 0.006) * rs.uniform(0.15, 0.4)
    e = np.minimum(1, t / 0.35) * np.minimum(1, (dur - t) / 0.4)
    return out * e
def steps_echo(times):
    out = np.zeros(int(4 * SR))
    for st in times:
        n = int(0.12 * SR); s = band(noise(n), 200, 2500) * env(n, 0.001, 0.02)
        for k, (dl, g) in enumerate([(0, 1), (0.11, 0.45), (0.23, 0.25), (0.37, 0.12)]):
            i = int((st + dl) * SR); out[i:i + n] += s * g
    return out

# ---------------- place SFX ----------------
add(creak_clack(), 1.98, 0.35, -0.3)
add(whoosh(0.55, 400, 3500), 4.75, 0.35)
add(splat(1.3), 5.6, 0.85)
add(splat(0.8), 5.71, 0.4, 0.3); add(splat(0.8), 5.79, 0.4, -0.3)
add(wahwah(), 6.12, 0.38)
add(buzz(4.1, 205, 1), 7.1, 0.09, -0.4); add(buzz(4.1, 236, 2), 7.1, 0.08, 0.4); add(buzz(2.2, 260, 3), 9.0, 0.1, 0.1)
for k in range(int((13.8 - 11.3) * 4.5)): add(chuff(), 11.3 + k / 4.5 + rs.uniform(0, 0.03), 0.32, rs.uniform(-0.5, 0.5))
add(water_flow(2.4, 200, 1400, 5, 8), 13.85, 0.22)
for k in range(10): add(blip(500, 220, 0.08) * 0.8, 14.1 + k * 0.12 + rs.uniform(0, 0.05), 0.2, rs.uniform(-0.5, 0.5))
add(rain(5.2), 16.15, 0.13)
add(thunder(), 16.38, 0.6); add(thunder(), 19.25, 0.45)
add(water_flow(3.0, 120, 900, 8, 10), 18.35, 0.28)
slab_times = sorted({round(21.5 + 1.8 * (z + 30) / 44, 3) for z in [38.5 - 3 * i for i in range(30)] if -30 <= z <= 14})
for k, st in enumerate(slab_times): add(thud(62 + (k % 3) * 6), st, 0.55 + 0.03 * k, rs.uniform(-0.2, 0.2))
for k in range(int((25.95 - 24.25) * 6)): add(chuff(), 24.25 + k / 6, 0.3, rs.uniform(-0.4, 0.4))
for x in [-34 + 1.2 + 2.4 * i for i in range(25)]:
    if -14 <= x <= 12: add(tonk(300 + (x % 5) * 8), 26.05 + min(1.2, max(0, (x + 14) / 22)) * 1.15 + 0.15, 0.32, x / 30)
add(flush(), 28.42, 0.55)
for k in range(7): add(blip(700, 260, 0.08), 28.35 + k * 0.17 + 0.25, 0.18, -0.6 + k * 0.2)
add(water_flow(2.7, 150, 1200, 11, 4), 30.85, 0.18)
add(steps_echo([k * 0.42 for k in range(6)]), 33.7, 0.28)
add(water_flow(2.3, 120, 900, 12, 3), 33.6, 0.22)
for k in range(5): add(blip(1500, 900, 0.03), 33.8 + k * 0.45, 0.1, rs.uniform(-0.6, 0.6))
add(water_flow(4.9, 150, 1300, 13, 3), 35.9, 0.3)
for k in range(7): add(boing(), 41.0 + k * 0.28 + 0.05, 0.32, -0.4 + k * 0.13)
add(hum(4.1), 43.55, 0.1)
for k in range(110): add(blip(260 + rs.uniform(0, 300), 700 + rs.uniform(0, 900), 0.05), rs.uniform(43.6, 47.6), 0.12, rs.uniform(-0.7, 0.7))
add(water_flow(2.9, 300, 3000, 14, 2), 47.65, 0.2)
add(chime(1568), 46.6, 0.18); add(chime(1760), 48.25, 0.2); add(chime(2093), 51.6, 0.2); add(chime(1760), 53.9, 0.18)
for i in range(5):
    add(splat(0.5) * 0.6, 50.45 + i * 0.16 + 0.05, 0.25, -0.5 + i * 0.25); add(blip(400, 1200, 0.1), 50.5 + i * 0.16, 0.15)
add(creak_clack(), 53.33, 0.3, -0.3)
add(crowd_cheer(4.75), 55.25, 0.42)
add(whoosh(0.4, 1500, 8000) * 0.7, 55.38, 0.25)
LABEL_T = [12.61, 21.80, 26.58, 29.10, 32.72, 37.96, 41.94, 48.18]
for t0 in LABEL_T: add(pop_sfx(), t0, 0.28)
for t0 in [11.2, 24.2, 30.85, 33.6, 35.9, 40.85, 47.65, 55.4]: add(whoosh(0.35, 600, 5000), t0 - 0.18, 0.12)

# ---------------- music: light bouncy toy-town loop ----------------
BPM = 112; beat = 60 / BPM
prog = [(48, [0, 4, 7]), (43, [7, 11, 14]), (45, [9, 12, 16]), (41, [5, 9, 12])]   # C G Am F
mf = lambda m: 440 * 2 ** ((m - 69) / 12)
music = np.zeros(N)
def marimba(f, d=0.45):
    n = int(d * SR); t = T(n)
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t * 30)) * env(n, 0.002, 0.16)
def pluck_bass(f, d=0.5):
    n = int(d * SR); t = T(n)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * env(n, 0.004, 0.22)
def kick():
    n = int(0.25 * SR); return sweep(130, 45, 0.25) * env(n, 0.002, 0.08)
def shaker():
    n = int(0.06 * SR); return band(noise(n), 5000, 12000) * env(n, 0.003, 0.015)
mel_r = np.random.RandomState(42)
scale = [0, 2, 4, 7, 9, 12, 14, 16]
motifs = [[0, 2, 4, 2, 5, 4, 2, 0], [4, 5, 7, 5, 4, 2, 4, None], [2, 4, 5, 4, 2, 0, 1, None], [5, 4, 2, 0, 2, None, 0, None]]
nbars = int(DUR / (4 * beat)) + 1
for bar in range(nbars):
    t0 = bar * 4 * beat; root, ch = prog[bar % 4]
    for b in range(4):
        tb = t0 + b * beat
        def put(sig, tt, g):
            i = int(tt * SR); sig = sig[:max(0, N - i)]; music[i:i + len(sig)] += sig * g
        put(pluck_bass(mf(root - 12 + (7 if b % 2 else 0))), tb, 0.55)
        if b in (0, 2): put(kick(), tb, 0.35)
        for h in (0, 0.5): put(shaker(), tb + h * beat, 0.12)
        if b in (1, 3):
            for k, iv in enumerate(ch): put(marimba(mf(root + 12 + iv), 0.35), tb + k * 0.012, 0.16)
    mot = motifs[bar % 4]
    for k, deg in enumerate(mot):
        if deg is None: continue
        f = mf(72 + scale[min(deg, 7)] + (prog[bar % 4][0] - 48 if bar % 8 >= 4 else 0) * 0)
        put(marimba(f, 0.5), t0 + k * beat / 2, 0.32)
# dim the music during the storm, add a little tension tremolo
tt = T(N)
storm = np.clip((tt - 16.2) / 0.3, 0, 1) * np.clip((21.3 - tt) / 0.3, 0, 1)
music *= 1 - 0.45 * storm
tunnel = np.clip((tt - 33.6) / 0.2, 0, 1) * np.clip((35.9 - tt) / 0.2, 0, 1)
music *= 1 - 0.35 * tunnel
# finale lift + final chord
music *= 1 + 0.35 * np.clip((tt - 55.3) / 0.5, 0, 1)
fin = np.zeros(int(2.5 * SR))
for m in [60, 64, 67, 72, 76]: fin += marimba(mf(m), 2.5) * 0.25
i = int(58.2 * SR); music[i:i + len(fin)] += fin[:N - i] * 0.8
music *= np.clip((DUR - tt) / 1.0, 0, 1)   # fade out at the very end

# ---------------- voiceover + ducking ----------------
vo = np.fromfile(f'{ROOT}/out/vo_padded.f32', dtype='<f4').astype(np.float64)
vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]
vo = vo / (np.max(np.abs(vo)) + 1e-9) * 0.89
win = int(0.15 * SR)
rms = np.sqrt(np.convolve(vo ** 2, np.ones(win) / win, mode='same'))
duck = 1 - 0.55 * np.clip(rms / 0.06, 0, 1)
duck = np.convolve(duck, np.ones(int(0.1 * SR)) / int(0.1 * SR), mode='same')
music = music / (np.max(np.abs(music)) + 1e-9) * 0.16 * duck
sfx_peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
Ls = L / sfx_peak * 0.55; Rs = R / sfx_peak * 0.55
outL = vo + music + Ls; outR = vo + music + Rs
# soft limiter
pk = max(np.max(np.abs(outL)), np.max(np.abs(outR)))
outL = np.tanh(outL / pk * 1.15) / np.tanh(1.15) * 0.95; outR = np.tanh(outR / pk * 1.15) / np.tanh(1.15) * 0.95
st = np.stack([outL, outR], 1)
with wave.open(f'{ROOT}/out/mix.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
print('wrote out/mix.wav', st.shape, 'sfx peak', round(sfx_peak, 2))
