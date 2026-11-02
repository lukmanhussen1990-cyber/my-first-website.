import numpy as np, subprocess, json, sys, os
SR = 48000
TOTAL = 50.5
N = int(TOTAL * SR)
rng = np.random.default_rng(7)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "audio_out")
VO_PATH = sys.argv[2] if len(sys.argv) > 2 else None
os.makedirs(OUT, exist_ok=True)

def t_(d): return np.arange(int(d * SR)) / SR
def env_ad(n, a=0.005, d=0.2):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
    return e
def noise(d): return rng.standard_normal(int(d * SR))
def fft_filter(x, lo=0, hi=SR / 2, slope=1.0):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo > 0: m *= 1 / (1 + (lo / np.maximum(f, 1)) ** (4 * slope))
    if hi < SR / 2: m *= 1 / (1 + (f / hi) ** (4 * slope))
    return np.fft.irfft(X * m, len(x))
def sweep_sine(f0, f1, d, curve=1.0):
    t = t_(d); k = (t / d) ** curve; f = f0 + (f1 - f0) * k
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-9; return x / m * peak
def db(v): return 10 ** (v / 20)

# ---------------- SFX ----------------
def ping(f=1320):
    a = np.sin(2 * np.pi * f * t_(0.07)) * env_ad(int(0.07 * SR), 0.002, 0.03)
    b = np.sin(2 * np.pi * f * 1.335 * t_(0.12)) * env_ad(int(0.12 * SR), 0.002, 0.05)
    return norm(np.concatenate([a, b]))
def chime():
    out = np.zeros(int(0.9 * SR))
    for i, f in enumerate([1046.5, 1568, 2093]):
        s = int(i * 0.09 * SR); seg = np.sin(2 * np.pi * f * t_(0.6)) * env_ad(int(0.6 * SR), 0.003, 0.22)
        out[s:s + len(seg)] += seg
    return norm(out)
def tick(): return norm(fft_filter(noise(0.006), 3000) * env_ad(int(0.006 * SR), 0.0005, 0.002))
def plop():
    d = 0.32; s = sweep_sine(950, 140, d, 0.45) * env_ad(int(d * SR), 0.002, 0.11)
    s += 0.6 * sweep_sine(160, 55, d, 0.7) * env_ad(int(d * SR), 0.004, 0.14)
    s += 0.25 * fft_filter(noise(d), 200, 1500) * env_ad(int(d * SR), 0.001, 0.02)
    return norm(s)
def squish(d=0.45, seed=1):
    r = np.random.default_rng(seed); out = np.zeros(int(d * SR))
    for i in range(9):
        st = int(r.uniform(0, d - 0.08) * SR); g = fft_filter(r.standard_normal(int(0.08 * SR)), r.uniform(250, 600), r.uniform(900, 2400))
        g *= np.hanning(len(g)) ** 2; out[st:st + len(g)] += g * r.uniform(0.4, 1)
    out += 0.7 * sweep_sine(260, 90, d, 0.6) * np.sin(np.pi * t_(d) / d) * (0.6 + 0.4 * np.sin(2 * np.pi * 18 * t_(d)))
    return norm(out)
def rumble(d=1.3, seed=2):
    r = np.random.default_rng(seed); t = t_(d)
    f = 70 + 18 * np.sin(2 * np.pi * 3.1 * t) + 12 * np.sin(2 * np.pi * 7.3 * t + 1)
    ph = 2 * np.pi * np.cumsum(f) / SR; base = np.sign(np.sin(ph)) * 0.5 + np.sin(ph)
    base = fft_filter(base, 30, 400) * (0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 4.3 * t)))
    for i in range(10):  # gurgle bubbles
        st = r.uniform(0, d - 0.1); n = int(0.08 * SR); s0 = int(st * SR)
        b = sweep_sine(r.uniform(180, 300), r.uniform(380, 650), 0.08, 0.5) * np.hanning(n)
        base[s0:s0 + n] += 0.5 * b
    base *= np.minimum(1, t / 0.08) * np.minimum(1, (d - t) / 0.25)
    return norm(base)
def heartbeat():
    def thump(): d = 0.16; return sweep_sine(85, 40, d, 0.6) * env_ad(int(d * SR), 0.004, 0.05)
    out = np.zeros(int(0.45 * SR)); a = thump(); out[:len(a)] += a; s = int(0.19 * SR); out[s:s + len(a)] += 0.75 * a
    return norm(out)
def wind(d, seed=3, lo=200, hi=900):
    r = np.random.default_rng(seed); t = t_(d); x = r.standard_normal(len(t))
    a = fft_filter(x, lo, hi) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.35 * t + 1) * np.sin(2 * np.pi * 0.13 * t))
    w = fft_filter(r.standard_normal(len(t)), 700, 1100) * 0.25 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.5 * t))
    out = a + w; out *= np.minimum(1, t / 0.3) * np.minimum(1, (d - t) / 0.3)
    return norm(out)
def thunder(d=1.6):
    t = t_(d); x = fft_filter(noise(d), 25, 300) * env_ad(len(t), 0.02, 0.5) * (0.7 + 0.3 * np.sin(2 * np.pi * 6 * t))
    return norm(x)
def gunshot(dist=False):
    d = 0.5; n = int(d * SR); x = noise(d)
    crack = fft_filter(x, 1500) * env_ad(n, 0.0005, 0.012)
    body = fft_filter(x, 80, 2500) * env_ad(n, 0.001, 0.07)
    boom = sweep_sine(110, 40, d, 0.5) * env_ad(n, 0.001, 0.09)
    s = 0.7 * crack + body + 0.9 * boom
    if dist: s = fft_filter(s, 60, 1200) + 0.3 * fft_filter(noise(d), 100, 800) * env_ad(n, 0.02, 0.18)
    return norm(s)
def build_knock(seed=0):
    r = np.random.default_rng(seed + 10); d = 0.22; n = int(d * SR); t = t_(d); s = np.zeros(n)
    for f, a, dec in [(r.uniform(150, 190), 1.0, 0.06), (r.uniform(400, 450), 0.6, 0.04), (r.uniform(720, 800), 0.4, 0.03), (1500, 0.2, 0.015)]:
        s += a * np.sin(2 * np.pi * f * t) * np.exp(-t / dec)
    s += 0.5 * fft_filter(noise(d), 1500, 6000) * env_ad(n, 0.0005, 0.006)
    # second "clack"
    s2 = np.zeros(n); off = int(0.05 * SR); s2[off:] = 0.5 * s[:n - off]
    return norm(s + s2)
def keys(d, rate=14, seed=4):
    r = np.random.default_rng(seed); out = np.zeros(int(d * SR)); tt = 0
    while tt < d - 0.02:
        c = fft_filter(r.standard_normal(int(0.012 * SR)), 1800, 7000) * env_ad(int(0.012 * SR), 0.0005, 0.003)
        s0 = int(tt * SR); out[s0:s0 + len(c)] += c * r.uniform(0.5, 1); tt += r.exponential(1 / rate)
    return norm(out)
def whoosh(d=0.45, up=True):
    t = t_(d); x = noise(d); out = np.zeros_like(x); nseg = 12
    for i in range(nseg):
        a, b = int(i * len(x) / nseg), int((i + 1) * len(x) / nseg); k = i / nseg if up else 1 - i / nseg
        out[a:b] = fft_filter(x, 300 + 2500 * k, 900 + 5000 * k)[a:b]
    out *= np.sin(np.pi * t / d) ** 1.5
    return norm(out)
def choir(d=1.0):
    t = t_(d); out = np.zeros_like(t)
    for f in [440, 554.4, 659.3, 880, 1108.7]:
        vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * t + f)
        ph = 2 * np.pi * np.cumsum(f * vib) / SR
        out += np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)
    out *= np.minimum(1, t / 0.12) * np.minimum(1, (d - t) / 0.35)
    out += 0.15 * fft_filter(noise(d), 4000, 9000) * np.minimum(1, t / 0.1) * np.minimum(1, (d - t) / 0.3)
    return norm(out)
def sniff():
    d = 0.16; t = t_(d); x = noise(d); out = np.zeros_like(x)
    for i in range(8):
        a, b = int(i * len(x) / 8), int((i + 1) * len(x) / 8); out[a:b] = fft_filter(x, 1500 + 400 * i, 5000 + 300 * i)[a:b]
    out *= np.sin(np.pi * t / d) ** 2
    full = np.zeros(int(0.42 * SR)); full[:len(out)] += out; s = int(0.2 * SR); full[s:s + len(out)] += out * 1.1
    return norm(full)
def drip():
    d = 0.18; return norm(sweep_sine(1400, 2600, d, 0.3) * env_ad(int(d * SR), 0.001, 0.035))
def shutter():
    out = np.zeros(int(0.25 * SR))
    for st, a in [(0, 1), (0.09, 0.8)]:
        c = fft_filter(noise(0.03), 1200, 8000) * env_ad(int(0.03 * SR), 0.0005, 0.006); s0 = int(st * SR); out[s0:s0 + len(c)] += c * a
    return norm(out)
def pop():
    d = 0.25; n = int(d * SR); s = fft_filter(noise(d), 300, 4000) * env_ad(n, 0.0008, 0.03) + 0.6 * sweep_sine(400, 120, d, 0.5) * env_ad(n, 0.001, 0.04)
    return norm(s)
def crowd(d, seed=5):
    r = np.random.default_rng(seed); t = t_(d); out = np.zeros_like(t)
    for i in range(14):
        lo = r.uniform(250, 900); x = fft_filter(r.standard_normal(len(t)), lo, lo * r.uniform(2, 4))
        am = 0.5 + 0.5 * np.sin(2 * np.pi * r.uniform(0.3, 1.5) * t + r.uniform(0, 6))
        out += x * am
    for i in range(10):  # "wooo" voices
        st = r.uniform(0, max(0.1, d - 1.2)); dd = r.uniform(0.6, 1.2); n = int(dd * SR); s0 = int(st * SR)
        f0 = r.uniform(280, 520); v = sweep_sine(f0, f0 * r.uniform(1.2, 1.5), dd, 0.5) * np.sin(np.pi * np.arange(n) / n)
        v = v + 0.4 * np.sign(v) * np.abs(v) ** 2
        out[s0:s0 + n] += 0.35 * fft_filter(v, 200, 3000) * np.std(out[:SR]) / (np.std(v) + 1e-9)
    out *= np.minimum(1, t / 0.15) * np.minimum(1, (d - t) / 0.4)
    return norm(out)
def chaching():
    d = 1.0; t = t_(d); out = np.zeros_like(t)
    for f, a in [(2093, 1), (2637, 0.7), (3136, 0.6), (4186, 0.4), (5274, 0.25)]:
        s0 = int(0.08 * SR); seg = a * np.sin(2 * np.pi * f * t[:len(t) - s0]) * np.exp(-t[:len(t) - s0] / 0.35); out[s0:] += seg
    out[:int(0.1 * SR)] += 0.6 * fft_filter(noise(0.1), 800, 4000) * env_ad(int(0.1 * SR), 0.01, 0.03)
    return norm(out)
def sq(f, d, duty=0.5):
    t = t_(d); ph = (f * t) % 1; return np.where(ph < duty, 1.0, -1.0)
def tri(f, d):
    t = t_(d); ph = (f * t) % 1; return 4 * np.abs(ph - 0.5) - 1
def nfreq(n): return 440 * 2 ** ((n - 69) / 12)
def victory_music(d=4.6):
    bpm = 160; b = 60 / bpm; out = np.zeros(int(d * SR) + SR)
    def note(n, st, du, amp=0.5, duty=0.5, kind='sq'):
        dd = du * 0.95; x = sq(nfreq(n), dd, duty) if kind == 'sq' else tri(nfreq(n), dd)
        e = np.minimum(1, t_(dd) / 0.005) * np.exp(-t_(dd) / (du * 1.8 + 0.05)); s0 = int(st * SR); out[s0:s0 + len(x)] += amp * x * e
    # fanfare: G4 C5 E5 G5 - C6 (held)
    seq = [(67, 0, 0.5), (72, 0.5, 0.5), (76, 1, 0.5), (79, 1.5, 0.5), (84, 2, 2.5), (79, 4.5, 0.5), (84, 5, 2.5)]
    for n, s, l in seq: note(n, s * b, l * b, 0.35, 0.25); note(n - 12, s * b, l * b, 0.18, 0.5)
    # bouncy loop
    mel = [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 76, 74]
    st0 = 7.5
    for i in range(int((d / b) - st0) + 1):
        n = mel[i % len(mel)]; note(n, (st0 + i * 0.5) * b, 0.5 * b, 0.22, 0.25)
    bass = [48, 48, 53, 53, 55, 55, 48, 48]
    for i in range(int(d / b) + 1):
        note(bass[(i // 2) % len(bass)], i * b, b * 0.9, 0.32, kind='tri')
    for i in range(int(d / b) + 1):  # drums
        s0 = int(i * b * SR); k = sweep_sine(150, 45, 0.12, 0.5) * env_ad(int(0.12 * SR), 0.001, 0.04); out[s0:s0 + len(k)] += 0.5 * k
        if i % 2 == 1: sn = fft_filter(noise(0.1), 1500, 8000) * env_ad(int(0.1 * SR), 0.001, 0.03); out[s0:s0 + len(sn)] += 0.25 * sn
    out = out[:int(d * SR)]; out *= np.minimum(1, (d - t_(d)) / 0.05)
    return norm(out)
def airhorn():
    out = np.zeros(int(1.3 * SR)); pos = 0
    for dd in [0.13, 0.13, 0.55]:
        t = t_(dd); x = np.zeros_like(t)
        for f in [466, 470, 587, 698]:
            vib = 1 + 0.004 * np.sin(2 * np.pi * 7 * t); ph = (np.cumsum(f * vib) / SR) % 1; x += 2 * ph - 1
        x = fft_filter(x, 300, 3500); x *= np.minimum(1, t / 0.01) * np.minimum(1, (dd - t) / 0.03)
        s0 = int(pos * SR); out[s0:s0 + len(x)] += x; pos += dd + 0.05
    return norm(out)
def record_scratch():
    d = 0.45; t = t_(d); f = 600 + 900 * np.sin(2 * np.pi * 2.6 * t) ** 2
    x = noise(d); out = np.zeros_like(x); nseg = 20
    for i in range(nseg):
        a, b = int(i * len(x) / nseg), int((i + 1) * len(x) / nseg); fc = f[(a + b) // 2]; out[a:b] = fft_filter(x, fc * 0.6, fc * 1.6)[a:b]
    out += 0.4 * sweep_sine(900, 200, d, 1) * np.exp(-t / 0.2)
    out *= np.minimum(1, t / 0.005) * np.exp(-t / 0.25)
    return norm(out)
def sad_trombone():
    notes = [(70, 0.45), (69, 0.45), (68, 0.45), (67, 1.3)]; out = []
    for i, (n, dd) in enumerate(notes):
        f = nfreq(n - 12); t = t_(dd); vib = 1 + (0.02 * np.sin(2 * np.pi * 5 * t) * np.minimum(1, t / 0.3) if i == 3 else 0)
        ph = (np.cumsum(f * vib) / SR) % 1; x = (2 * ph - 1) + 0.5 * np.sign(np.sin(2 * np.pi * ph))
        x = fft_filter(x, 80, 1400) * np.minimum(1, t / 0.03) * np.minimum(1, (dd - t) / 0.06)
        if i == 3: x *= np.exp(-t / 0.9)
        out.append(x)
    return norm(np.concatenate(out))

# ---------------- timeline ----------------
bus = np.zeros(N); noduck = np.zeros(N)
def place(x, t, gain_db, duck=True):
    s0 = int(t * SR); x = x * db(gain_db)
    if s0 >= N: return
    e = min(N, s0 + len(x)); tgt = bus if duck else noduck; tgt[s0:e] += x[:e - s0]

place(chime(), 0.02, -22)
for tt in [0.6, 1.3]: place(gunshot(True), tt, -36)
for i in range(45): place(tick(), 2.1 + i * 0.04, -30)
for tt in [2.3, 2.75, 3.1, 3.55]: place(ping(1320 + rng.integers(0, 4) * 60), tt, -28)
place(whoosh(0.4), 4.25, -24)
place(wind(1.95, 3), 4.4, -27)
for tt in [4.8, 5.4, 5.95]: place(gunshot(True), tt, -26)
place(keys(0.78, 16), 6.32, -26)
# POOP moment
place(plop(), 7.08, -11, duck=False); place(squish(0.4, 3), 7.16, -17, duck=False)
place(squish(0.3, 9), 8.42, -15, duck=False)
# 1v1, storm
for k in range(13):
    tt = 8.7 + sum(0.86 - 0.025 * j for j in range(k))
    if tt < 15.0: place(heartbeat(), tt, -19 if tt < 13.4 else -15)
place(wind(2.8, 4), 8.65, -27); place(thunder(), 10.05, -15); place(wind(1.4, 5, 150, 700), 10.05, -20)
place(gunshot(True), 9.1, -25)
place(whoosh(0.35), 11.42, -20); place(choir(1.0), 11.55, -24)
place(keys(0.95, 30, 6), 12.44, -22)
# chat
pings = [15.25, 15.45, 15.7, 15.9, 16.1, 16.45, 16.7, 17.0, 17.3, 17.75, 18.0, 18.3, 18.6, 18.9]
for tt in pings: place(ping(1250 + rng.integers(0, 6) * 50), tt, -30)
place(keys(1.5, 45, 7), 17.68, -24)
# building
for i in range(6): place(build_knock(i), 19.2 + 0.08 + i * 0.17, -17)
for i in range(3): place(build_knock(10 + i), 19.2 + 0.16 + i * 0.34, -19)
for i in range(4): place(build_knock(20 + i), 20.5 + 0.05 + i * 0.25, -15)
place(build_knock(30), 21.12, -17)
for tt in [19.55, 19.95, 20.3]: place(gunshot(True), tt, -24)
place(rumble(1.0, 2), 21.62, -15); place(build_knock(31), 22.42, -18); place(build_knock(32), 22.58, -19); place(rumble(0.75, 8), 22.72, -14)
# smell
place(whoosh(1.0, True), 23.4, -22); place(sniff(), 24.5, -14)
place(drip(), 26.05, -22); place(drip(), 26.75, -22)
place(shutter(), 27.3, -16)
for i in range(16): place(ping(1500 + (i % 4) * 90), 28.45 + i * 0.19, -32)
for i in range(6): place(pop(), 28.6 + i * 0.45, -30)
# twist
place(whoosh(0.35, True), 32.55, -20); place(pop(), 32.86, -16)
place(crowd(4.55), 32.85, -21)
place(chaching(), 34.38, -15)
# cut to room
for k in range(3): place(heartbeat(), 37.55 + k * 0.85, -22)
place(squish(0.3, 12), 39.3, -17)
place(whoosh(0.5, True), 39.95, -22)
place(gunshot(False), 40.8, -9, duck=False); place(pop(), 40.95, -18)
# victory
place(victory_music(4.6), 41.45, -15); place(pop(), 41.48, -14); place(pop(), 41.6, -16)
place(airhorn(), 42.95, -17)
for i in range(40): place(ping(1200 + (i % 7) * 70), 42.85 + i * 0.075, -32)
place(whoosh(0.3, True), 44.35, -22)
place(record_scratch(), 46.0, -13)
# chair reveal
place(squish(0.35, 21), 47.3, -14)
for i in range(30): place(ping(1100 + (i % 5) * 110), 47.33 + i * 0.07, -30)
place(sad_trombone(), 48.35, -18, duck=False)
place(wind(3.0, 9, 150, 600), 47.5, -30)

# silence windows (all sound cuts out)
def silence(a, b, fade=0.03):
    ia, ib = int(a * SR), int(b * SR); f = int(fade * SR)
    for arr in (bus,):
        arr[ia:ib] *= 0; arr[ia - f:ia] *= np.linspace(1, 0, f)
silence(7.12, 8.62)
silence(46.12, 47.28)

# room tone bed
bed = fft_filter(rng.standard_normal(N), 40, 400) * db(-50)
bed[int(7.12 * SR):int(8.62 * SR)] = 0
bus += bed

# ---------------- voice ----------------
vo = None
if VO_PATH:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", VO_PATH, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    vo = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    v = np.zeros(N); v[:min(N, len(vo))] = vo[:N]; vo = v
    # simple VO normalize: RMS of active speech to -19 dBFS
    w = int(0.03 * SR); nb = N // w; r = np.sqrt((vo[:nb * w].reshape(nb, w) ** 2).mean(1))
    act = r > np.percentile(r, 60) * 0.5
    sp_rms = np.sqrt((r[act] ** 2).mean()); vo *= db(-19) / sp_rms
    pk = np.max(np.abs(vo));
    if pk > db(-2): vo *= db(-2) / pk
    # ducking envelope
    envv = np.repeat(r * db(-19) / sp_rms, w); envv = np.pad(envv, (0, N - len(envv)))
    k = int(0.15 * SR); ker = np.ones(k) / k; envv = np.convolve(envv, ker, mode='same')
    d = np.clip(envv / db(-26), 0, 1); duck = 1 - 0.5 * d  # up to -6 dB
    bus *= duck
    mix = vo + bus + noduck
else:
    mix = bus + noduck
# fade end
fe = int(0.8 * SR); mix[-fe:] *= np.linspace(1, 0, fe)
np.save(os.path.join(OUT, "sfx.npy"), (bus + noduck).astype(np.float32))
if vo is not None: np.save(os.path.join(OUT, "vo.npy"), vo.astype(np.float32))
pk = np.max(np.abs(mix)); print("peak before limit", 20 * np.log10(pk))
mix = np.tanh(mix * 1.0) if pk > 1 else mix
st = np.stack([mix, mix], 1).astype(np.float32)
st.tofile(os.path.join(OUT, "mix.f32"))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", os.path.join(OUT, "mix.f32"),
                "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR), os.path.join(OUT, "mix.wav")], check=True)
print("wrote", os.path.join(OUT, "mix.wav"))
