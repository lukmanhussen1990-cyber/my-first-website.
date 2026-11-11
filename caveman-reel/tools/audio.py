"""Synthesises every sound effect in code (numpy/scipy) and mixes them under the voiceover.
   python3 tools/audio.py  ->  audio/mix.wav"""
import numpy as np, subprocess, wave
from scipy.signal import butter, sosfilt

SR = 44100
DUR = 52.8
rng = np.random.default_rng(7)
N = int(DUR * SR)
bed = np.zeros((N, 2), np.float64)

def T(d): return np.arange(int(d * SR)) / SR
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, btype='low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, btype='high', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(d * SR))
def env(t, a, d): return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
def norm(x, peak=1.0): return x * (peak / (np.max(np.abs(x)) + 1e-9))

def pop(f0=520, f1=180, d=0.09):
    t = T(d); f = f0 * (f1 / f0) ** (t / d); return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, 0.002, d * 0.35))
def blip(f0=600, f1=1300, d=0.10):
    t = T(d); f = f0 * (f1 / f0) ** (t / d); return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, 0.004, d * 0.4))
def whoosh(d=0.38, lo=300, hi=3800):
    t = T(d); u = t / d; n = noise(d); out = np.zeros_like(t)
    for k in range(6):
        c = lo * (hi / lo) ** (k / 5); band = bp(n, c * 0.7, c * 1.4); out += band * np.exp(-((u - (0.25 + 0.1 * k)) / 0.2) ** 2)
    return norm(out)
def ding(f=1320, d=1.0):
    t = T(d); x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (d * q)) for m, a, q in [(1, 1, 0.30), (2.76, 0.45, 0.16), (5.4, 0.22, 0.08), (8.9, 0.1, 0.05)])
    return norm(x * np.minimum(1, t / 0.002))
def thud(f0=110, d=0.32, click=0.5):
    t = T(d); f = f0 * (0.42) ** (t / d); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, 0.003, d * 0.28)
    return norm(x + click * lp(noise(d), 900) * env(t, 0.001, 0.02))
def knock(d=0.22):          # wooden door bang
    t = T(d); x = np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.05) + 0.8 * bp(noise(d), 160, 520) * np.exp(-t / 0.035) + 0.35 * bp(noise(d), 900, 2400) * np.exp(-t / 0.012)
    return norm(x)
def splash(d=0.7):
    t = T(d); x = hp(noise(d), 1200) * env(t, 0.01, 0.16) + 0.6 * bp(noise(d), 400, 1500) * env(t, 0.03, 0.22)
    for _ in range(14):
        s = rng.uniform(0.02, d - 0.12); f = rng.uniform(500, 1700); tt = T(0.07); b = np.sin(2 * np.pi * np.cumsum(f * (1.6) ** (tt / 0.07)) / SR) * env(tt, 0.004, 0.02) * 0.5
        i = int(s * SR); x[i:i + len(b)] += b
    return norm(x)
def flush(d=1.5):
    t = T(d); u = t / d; n = noise(d)
    x = bp(n, 250, 1400) * (0.55 + 0.45 * np.sin(2 * np.pi * (9 + 9 * u) * t)) * np.sin(np.pi * np.minimum(1, u * 1.1)) ** 0.7
    g = np.sin(2 * np.pi * np.cumsum(260 * (0.28) ** (u ** 1.5)) / SR) * np.exp(-((u - 0.82) / 0.13) ** 2) * (0.6 + 0.4 * np.sin(2 * np.pi * 21 * t))
    return norm(x + 0.9 * g)
def grunt(d=0.85):          # mammoth
    t = T(d); u = t / d; f = 78 * (1 + 0.18 * np.sin(np.pi * u)) * (1 - 0.25 * u); ph = 2 * np.pi * np.cumsum(f) / SR
    x = sum(np.sin(ph * k) / k for k in range(1, 9)); x = x * (0.7 + 0.3 * np.sin(2 * np.pi * 23 * t))
    x = bp(x, 90, 900) + 0.25 * bp(noise(d), 200, 700) * (0.5 + 0.5 * np.sin(2 * np.pi * 23 * t))
    return norm(x * np.sin(np.pi * u) ** 0.6)
def creak(d=0.6):
    t = T(d); u = t / d; f = 330 + 420 * u + 40 * np.sin(2 * np.pi * 31 * t); x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.5
    return norm(bp(x, 300, 2600) * np.sin(np.pi * u) ** 0.8)
def shimmer(d=1.6, base=880):
    t = T(d); x = np.zeros_like(t)
    for i, m in enumerate([1, 1.25, 1.5, 2, 2.5, 3]):
        s = i * 0.09; tt = np.maximum(0, t - s); x += np.sin(2 * np.pi * base * m * tt) * env(tt, 0.01, 0.5) * (tt > 0) * (0.9 ** i)
    return norm(x)
def choir(d=1.7, base=392):
    t = T(d); u = t / d; x = np.zeros_like(t)
    for m in [1, 1.26, 1.5, 2]:
        for det in [-0.5, 0.4]:
            ph = 2 * np.pi * (base * m + det) * t + 0.3 * np.sin(2 * np.pi * 5.2 * t); x += sum(np.sin(ph * k) / k ** 1.3 for k in range(1, 6))
    x = bp(x, 500, 1300) + 0.5 * bp(x, 2300, 3200)
    return norm(x * np.sin(np.pi * np.minimum(1, u * 1.05)) ** 0.8)
def sizzle(d=0.9):
    t = T(d); return norm(hp(noise(d), 3500) * env(t, 0.04, 0.3) * (0.6 + 0.4 * rng.random(len(t))))
def zap(d=0.22):
    t = T(d); x = np.sign(np.sin(2 * np.pi * 55 * t)) * np.sin(2 * np.pi * (700 + 500 * rng.random()) * t) + 0.5 * hp(noise(d), 2500)
    return norm(x * env(t, 0.003, 0.07) * (rng.random(len(t)) > 0.25))
def tick(f=1900): t = T(0.03); return norm(np.sin(2 * np.pi * f * t) * env(t, 0.001, 0.006))
def fwip(d=0.14): return whoosh(d, 900, 5000)
def tune():                  # tiny speaker jingle
    x = np.zeros(int(1.25 * SR)); notes = [659, 784, 988, 784, 880, 1175]
    for i, f in enumerate(notes):
        t = T(0.2); n = (np.sign(np.sin(2 * np.pi * f * t)) * 0.4 + np.sin(2 * np.pi * f * t)) * env(t, 0.004, 0.07); j = int(i * 0.19 * SR); x[j:j + len(n)] += n
        k = (thud(150, 0.1, 0.2) if i % 2 == 0 else hp(noise(0.05), 5000) * env(T(0.05), 0.001, 0.012)) * 0.6; x[j:j + len(k)] += k
    return norm(lp(x, 5000))
def boing(d=0.35, f0=220, f1=520):
    t = T(d); f = f0 + (f1 - f0) * (t / d) + 30 * np.sin(2 * np.pi * 18 * t); return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, 0.01, d * 0.5))
def squish(d=0.4):
    t = T(d); return norm(bp(noise(d), 150, 700) * (0.5 + 0.5 * np.sin(2 * np.pi * 16 * t)) * env(t, 0.03, 0.14))
def murmur(d=2.0):
    t = T(d); u = t / d; x = np.zeros_like(t)
    for _ in range(26):
        s = rng.uniform(0, d - 0.3); f = rng.uniform(110, 210); tt = T(rng.uniform(0.12, 0.28)); ph = 2 * np.pi * np.cumsum(f * (1 + 0.12 * np.sin(2 * np.pi * 4 * tt))) / SR
        v = sum(np.sin(ph * k) / k for k in range(1, 7)) * np.sin(np.pi * tt / tt[-1]); i = int(s * SR); x[i:i + len(v)] += v
    return norm(bp(x, 250, 1500) * np.sin(np.pi * np.minimum(1, u * 1.1)) ** 0.5)

def put(x, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N: return
    x = x[:N - i]; l = gain * (1 - max(0, pan)); r = gain * (1 + min(0, pan))
    bed[i:i + len(x), 0] += x * l; bed[i:i + len(x), 1] += x * r

W = whoosh()
# --- cue sheet (seconds) ---
put(W, 0.02, 0.30); put(pop(), 0.93, 0.5); put(blip(), 0.95, 0.22)
put(W, 1.66, 0.35); put(thud(90, 0.25, 0.3), 2.32, 0.45); put(boing(0.2, 500, 300), 2.9, 0.12)
put(W, 4.24, 0.35); put(grunt(), 4.42, 0.75); put(thud(60, 0.4, 0.2), 4.42, 0.45)
put(blip(500, 1700, 0.12), 5.57, 0.5); put(ding(1760, 0.5), 5.58, 0.25); put(thud(70, 0.3, 0.3), 5.6, 0.4)
put(thud(75, 0.5, 0.2), 6.46, 0.7); put(thud(60, 0.5, 0.2), 6.74, 0.6)
put(pop(), 7.63, 0.6); put(ding(1568, 0.9), 7.66, 0.5)
for s in [8.82, 9.30, 9.78, 10.26]: put(thud(120, 0.2, 0.9), s, 0.6); put(hp(noise(0.25), 1500) * env(T(0.25), 0.02, 0.07), s + 0.02, 0.10)
put(W, 10.5, 0.3); put(squish(), 10.74, 0.5); put(boing(0.45, 420, 160), 10.8, 0.28)
put(W, 12.08, 0.3); put(thud(70, 0.5, 0.8), 12.90, 1.0); put(knock(), 12.90, 0.4)
put(fwip(), 14.1, 0.3); put(splash(0.8), 14.44, 0.6); put(flush(1.5), 14.72, 0.75); put(splash(0.5), 14.9, 0.35)
put(boing(0.3, 300, 620), 16.36, 0.45); put(pop(700, 400, 0.07), 16.37, 0.4)
put(pop(), 17.65, 0.6); put(ding(1568, 0.9), 17.68, 0.5); put(knock(0.16), 18.57, 0.55)
for i, s in enumerate([18.76, 18.94, 19.10, 19.24, 19.36]): put(pop(480 + 70 * i, 200 + 30 * i, 0.08), s, 0.5)
put(W, 19.58, 0.35)
for i in range(10): put(pop(420 + 55 * i, 190 + 25 * i, 0.07), 19.72 + i * 0.105, 0.42, (i % 2) * 0.5 - 0.25)
put(bp(noise(1.1), 300, 1200) * (0.6 + 0.4 * np.sin(2 * np.pi * 11 * T(1.1))) * np.sin(np.pi * T(1.1) / 1.1), 20.7, 0.10)
put(pop(), 21.80, 0.5)
for i, f in enumerate([1047, 1319, 1568, 2093]): put(ding(f, 0.7), 21.84 + i * 0.09, 0.42)
put(hp(noise(0.3), 3000) * env(T(0.3), 0.005, 0.08), 21.98, 0.22); put(shimmer(1.4, 1047), 22.6, 0.2); put(pop(600, 300), 23.66, 0.4)
put(W, 24.3, 0.35)
for i in range(5): put(pop(520 + 60 * i, 240, 0.08), 24.44 + i * 0.07, 0.4)
put(murmur(1.2), 24.6, 0.16)
put(W, 26.02, 0.3); put(creak(0.62), 26.36, 0.36); put(choir(1.7), 26.55, 0.34); put(shimmer(1.4, 1319), 26.75, 0.18)
put(ding(1047, 0.8), 28.06, 0.55); put(ding(1319, 0.8), 28.75, 0.55); put(shimmer(0.7, 1760), 28.8, 0.2); put(ding(1568, 1.0), 29.70, 0.55); put(shimmer(1.0, 1568), 29.72, 0.22)
put(W, 30.76, 0.25); put(pop(), 31.42, 0.55); put(sizzle(0.9), 31.44, 0.22)
put(pop(560, 240), 32.47, 0.55); put(tune(), 32.62, 0.26)
put(pop(500, 220), 34.02, 0.55); put(fwip(), 34.82, 0.25); put(ding(1976, 0.5), 35.0, 0.45); put(ding(2637, 0.5), 35.11, 0.4); put(knock(0.1), 35.0, 0.25)
put(W, 35.76, 0.3); put(thud(85, 0.3, 0.6), 36.30, 0.7); put(squish(0.2), 36.31, 0.2)
tk = 36.7; i = 0
while tk < 39.0: put(tick(1700 if i % 2 else 2300), tk, 0.22); tk += 0.085; i += 1
for s in [39.2, 39.6, 39.98]: put(fwip(0.12), s, 0.3)
for s in np.arange(40.25, 41.85, 0.21): put(zap(), float(s), 0.2, 0.4 * np.sin(s * 9))
put(W, 41.9, 0.35); put(murmur(2.0), 42.0, 0.2); put(grunt(0.7), 42.75, 0.38)
for s in [43.21, 43.56, 43.91]: put(knock(), s, 0.55)
for s in [44.10, 44.40, 44.70, 45.00, 45.28]: put(knock(), s, 0.95); put(thud(80, 0.2, 0.5), s, 0.5)
for s in [45.42, 46.62, 46.86]: put(knock(), s, 0.45)
for s in [47.22, 47.52, 48.0, 48.3]: put(lp(knock(), 500), s, 0.4)
put(fwip(0.12), 48.2, 0.2); put(W, 48.52, 0.3); put(pop(), 49.41, 0.55); put(blip(700, 1500, 0.08), 49.43, 0.25)
put(pop(520, 260), 50.75, 0.5); put(pop(560, 280), 50.95, 0.35); put(ding(1568, 0.9), 51.98, 0.5); put(shimmer(0.8, 2093), 52.0, 0.22)

bed = np.tanh(bed * 0.9) * 0.9
# --- voiceover ---
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'voiceover.mp3', '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
vo = np.frombuffer(raw, np.int16).astype(np.float64) / 32768.0
vo = vo[:N] if len(vo) > N else np.pad(vo, (0, N - len(vo)))
vo = vo * (0.89 / (np.max(np.abs(vo)) + 1e-9))
mix = bed * 0.52 + vo[:, None]
mix = mix / max(1.0, np.max(np.abs(mix)) / 0.97)
with wave.open('audio/sfx.wav', 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(bed, -1, 1) * 32767).astype(np.int16).tobytes())
with wave.open('audio/mix.wav', 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
print('mix.wav', round(len(mix) / SR, 2), 's  sfx rms', round(float(np.sqrt(np.mean(bed ** 2))), 4), 'vo rms', round(float(np.sqrt(np.mean(vo ** 2))), 4))
