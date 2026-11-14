import numpy as np, subprocess, wave
from scipy.signal import butter, sosfilt

SR = 48000
DUR = 60.0
N = int(SR * DUR)
rng = np.random.default_rng(7)


def T(d): return np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR))
def filt(x, kind, f, order=2):
    sos = butter(order, f, btype=kind, fs=SR, output='sos'); return sosfilt(sos, x)
def bp(x, lo, hi, o=2): return filt(x, 'band', [lo, hi], o)
def lp(x, f, o=2): return filt(x, 'low', f, o)
def hp(x, f, o=2): return filt(x, 'high', f, o)
def dec(n, tau, att=0.002):
    t = np.arange(n) / SR; a = np.minimum(1, t / max(att, 1e-4)); return a * np.exp(-t / tau)
def norm(x, p=1.0): m = np.max(np.abs(x)) + 1e-9; return x / m * p
def place(buf, x, t, g=1.0):
    i = int(t * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(x)); buf[i:j] += x[:j - i] * g
def sweep(f0, f1, d, curve='exp'):
    t = T(d); k = t / d
    f = f0 * (f1 / f0) ** k if curve == 'exp' else f0 + (f1 - f0) * k
    return np.sin(2 * np.pi * np.cumsum(f) / SR), f

# ---------------- instruments ----------------
def ks(freq, d=0.9, bright=0.5, decay=0.996):
    n = int(d * SR); p = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, p); buf = lp(buf, 1500 + 6000 * bright, 1)
    out = np.zeros(n); b = buf.copy(); idx = 0
    for i in range(n):
        v = b[idx]; nxt = b[(idx + 1) % p]
        b[idx] = decay * 0.5 * (v + nxt); out[i] = v; idx = (idx + 1) % p
    return out * np.minimum(1, np.arange(n) / 40)

_ks_cache = {}
def uke(freq, d=0.9):
    k = round(freq, 2)
    if k not in _ks_cache: _ks_cache[k] = norm(ks(freq, d, 0.55, 0.9965), 0.6)
    return _ks_cache[k]

def glock(freq, d=0.9):
    t = T(d); x = np.zeros_like(t)
    for m, a, tau in [(1, 1, 0.5), (2.76, 0.35, 0.18), (5.4, 0.15, 0.08)]:
        x += a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t / tau)
    return x * np.minimum(1, t / 0.002)

def bass(freq, d=0.38):
    t = T(d); x = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(4 * np.pi * freq * t) + 0.12 * np.sin(6 * np.pi * freq * t)
    e = np.minimum(1, t / 0.006) * np.exp(-t / 0.22); e[-200:] *= np.linspace(1, 0, 200)
    return x * e

def kick():
    s, f = sweep(140, 45, 0.28); return s * dec(len(s), 0.09, 0.001) + 0.3 * hp(noise(0.28), 2000) * dec(len(s), 0.004)
def snare():
    n = bp(noise(0.22), 900, 7000) * dec(int(0.22 * SR), 0.06, 0.001)
    s, _ = sweep(220, 160, 0.22); return 0.7 * n + 0.35 * s * dec(len(s), 0.05)
def hat(open_=False):
    d = 0.18 if open_ else 0.05; return hp(noise(d), 7000) * dec(int(d * SR), 0.06 if open_ else 0.012, 0.0005)

NOTE = lambda n: 440 * 2 ** ((n - 69) / 12)
C4 = 60
CHORDS = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]]  # C Am F G
ROOTS = [48, 45, 41, 43]
MEL = [[76, 79, 81, 79], [76, 74, 72, None], [72, 74, 76, 79], [74, None, None, None],
       [76, 79, 81, 84], [81, 79, 76, None], [74, 76, 74, 72], [72, None, None, None]]

def music(start, end):
    bpm = 120; beat = 60 / bpm; bar = 4 * beat
    out = np.zeros(N); drums = np.zeros(N); mel = np.zeros(N)
    nb = int((end - start) / bar) + 2
    for b in range(nb):
        t0 = start + b * bar
        if t0 >= end: break
        ci = b % 4; ch = CHORDS[ci]
        # strum pattern on eighths: D . D U . U D U
        for e8, kind in [(0, 'D'), (2, 'D'), (3, 'U'), (5, 'U'), (6, 'D'), (7, 'U')]:
            tt = t0 + e8 * beat / 2
            if tt >= end: continue
            notes = ch if kind == 'D' else ch[::-1]
            vel = 0.9 if kind == 'D' else 0.55
            for k, n in enumerate(notes):
                place(out, uke(NOTE(n)), tt + k * (0.011 if kind == 'D' else 0.008), vel * 0.5)
        r = ROOTS[ci]
        for bt, nn in [(0, r), (1.5, r + 12), (2, r + 7), (3.5, r + 12)]:
            tt = t0 + bt * beat
            if tt < end: place(out, bass(NOTE(nn)), tt, 0.55 if bt in (0, 2) else 0.3)
        for bt in range(4):
            tt = t0 + bt * beat
            if tt >= end: continue
            if bt in (0, 2): place(drums, kick(), tt, 0.9)
            else: place(drums, snare(), tt, 0.45)
            place(drums, hat(), tt, 0.25); place(drums, hat(), tt + beat / 2, 0.16)
        if b >= 2:
            ph = MEL[(b - 2) % 8]
            for bt, nn in enumerate(ph):
                tt = t0 + bt * beat
                if nn and tt < end: place(mel, glock(NOTE(nn)), tt, 0.32)
    m = out + 0.8 * drums + mel
    # fade in/out
    i0, i1 = int(start * SR), int(end * SR)
    m[:i0] = 0; m[i1:] = 0
    fi = int(0.05 * SR); m[i0:i0 + fi] *= np.linspace(0, 1, fi)
    return m

# ---------------- sfx ----------------
def svf_bp(x, fc, q=2.0):
    y = np.zeros_like(x); lo = bd = 0.0
    for i in range(len(x)):
        f = 2 * np.sin(np.pi * min(fc[i], SR / 6) / SR)
        hi_ = x[i] - lo - bd / q; bd += f * hi_; lo += f * bd; y[i] = bd
    return y
def whoosh(d=0.35, f0=300, f1=2600, q=1.6):
    n = int(d * SR); fc = np.geomspace(f0, f1, n); x = svf_bp(noise(d), fc, q)
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5; return norm(x * e, 0.8)
def impact(big=1.0):
    s, _ = sweep(120, 38, 0.45); x = s * dec(len(s), 0.16, 0.001)
    x += 0.6 * lp(noise(0.45), 900) * dec(len(s), 0.06, 0.0005)
    x += 0.25 * big * bp(noise(0.45), 300, 1400) * dec(len(s), 0.03)
    return norm(x, 0.95)
def wham():
    x = impact(); n = len(x)
    c = bp(noise(1.0), 250, 7000) * dec(int(1.0 * SR), 0.22, 0.001)
    w = bp(noise(1.0), 300, 1200) * dec(int(1.0 * SR), 0.05)
    y = np.zeros(int(1.0 * SR)); y[:n] += x; y += 0.35 * c + 0.4 * w
    return norm(y, 0.95)
def pop(f0=1100, f1=260, d=0.08):
    s, _ = sweep(f0, f1, d); return norm(s * dec(len(s), d / 3, 0.0005), 0.8)
def bell(freqs, amps, tau=1.0, d=1.4):
    t = T(d); x = np.zeros_like(t)
    for f, a in zip(freqs, amps): x += a * np.sin(2 * np.pi * f * t) * np.exp(-t / (tau * (1.2 - a * 0.3)))
    return x * np.minimum(1, t / 0.001)
def cashreg():
    y = np.zeros(int(1.4 * SR))
    place(y, hp(noise(0.02), 2500) * dec(int(0.02 * SR), 0.004), 0, 0.6)
    place(y, bp(noise(0.12), 1200, 5000) * dec(int(0.12 * SR), 0.04), 0.03, 0.35)
    place(y, bell([2093, 2637, 3136, 4186, 5274], [1, 0.8, 0.6, 0.5, 0.3], 0.5, 1.2), 0.1, 0.5)
    return norm(y, 0.85)
def boing(d=0.75, f0=180, f1=300):
    t = T(d); f = (f0 + (f1 - f0) * t / d) * (1 + 0.35 * np.sin(2 * np.pi * 9 * t) * np.exp(-3 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)
    return norm(x * np.exp(-3.2 * t) * np.minimum(1, t / 0.004), 0.8)
def slide(f0=1700, f1=420, d=0.36):
    t = T(d); f = np.geomspace(f0, f1, len(t)) * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.08 * hp(noise(d), 3000)
    e = np.minimum(1, t / 0.02) * np.minimum(1, (d - t) / 0.03); return norm(x * e, 0.6)
def piano(freq, d=1.6, vel=1.0):
    t = T(d); x = np.zeros_like(t); B = 0.0004
    for k in range(1, 9):
        fk = k * freq * np.sqrt(1 + B * k * k)
        x += (1 / k ** 1.3) * np.sin(2 * np.pi * fk * t) * np.exp(-t * (1.5 + k * 0.9))
    x += 0.3 * hp(noise(d), 2000) * dec(len(t), 0.004)
    return x * vel * np.minimum(1, t / 0.002)
def crash_big():
    d = 1.6; y = np.zeros(int(d * SR))
    place(y, impact(), 0, 1.0)
    place(y, bp(noise(d), 400, 9000) * dec(int(d * SR), 0.35, 0.001), 0, 0.5)
    t = T(d); met = np.zeros_like(t)
    for i in range(18):
        f = rng.uniform(350, 6500); met += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / rng.uniform(0.08, 0.5)) * rng.uniform(0.2, 1)
    place(y, met, 0.0, 0.18)
    for n_, dl in [(48, 0), (54, 0.01), (60, 0.02), (66, 0.015), (67, 0.03), (73, 0.04), (78, 0.02)]:
        place(y, piano(NOTE(n_), 1.4), dl, 0.18)
    for i in range(5): place(y, bell([rng.uniform(900, 2400)], [1], 0.15, 0.4), 0.05 + i * 0.09 + rng.uniform(0, 0.05), 0.12)
    return norm(y, 0.95)
def crack():
    y = np.zeros(int(0.3 * SR))
    for dt, g in [(0, 1), (0.025, 0.7), (0.06, 0.5)]: place(y, hp(noise(0.006), 1800) * dec(int(0.006 * SR), 0.0015), dt, g)
    place(y, bp(noise(0.06), 900, 3500) * dec(int(0.06 * SR), 0.015), 0.005, 0.6)
    place(y, impact(0.3) * 0.4, 0.0, 1.0)
    return norm(y, 0.9)
def flutter(d=0.9):
    t = T(d); am = (0.5 + 0.5 * np.sin(2 * np.pi * 23 * t)) ** 2
    x = bp(noise(d), 350, 2400) * am * np.sin(np.pi * t / d) ** 0.7; return norm(x, 0.6)
def trombone():
    y = np.zeros(int(1.0 * SR))
    for (f, d, t0, vib) in [(233.08, 0.24, 0.0, 0), (207.65, 0.48, 0.27, 1)]:
        t = T(d); fr = f * (1 + vib * 0.025 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.15))
        ph = 2 * np.pi * np.cumsum(fr) / SR
        bright = 0.35 + 0.65 * np.sin(np.pi * np.minimum(1, t / d)) ** 0.8
        x = sum((1 / k) * np.exp(-k * (1 - bright) * 0.45) * np.sin(k * ph) for k in range(1, 14))
        e = np.minimum(1, t / 0.03) * np.minimum(1, (d - t) / 0.06); place(y, x * e, t0, 1)
    return norm(lp(y, 2500), 0.7)
def ring(d=0.55):
    t = T(d); f = np.where((t * 40).astype(int) % 2, 1050, 1320)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 20 * t)) ; e = np.minimum(1, t / 0.01) * np.minimum(1, (d - t) / 0.03)
    return norm(lp(x * e, 4000), 0.5)
def crickets(d=1.5):
    t = T(d); x = np.zeros_like(t)
    for c0 in np.arange(0.05, d - 0.2, 0.45):
        for k in range(3):
            s = c0 + k * 0.055; m = (t >= s) & (t < s + 0.035)
            x[m] += np.sin(2 * np.pi * 4500 * t[m]) * np.sin(np.pi * (t[m] - s) / 0.035)
    return norm(x * (0.6 + 0.4 * np.sin(2 * np.pi * 30 * t)), 0.4)
def engine(d=1.25):
    t = T(d); f0 = np.interp(t, [0, 0.35, 0.8, d], [48, 95, 80, 55])
    ph = 2 * np.pi * np.cumsum(f0) / SR
    x = sum((1 / k ** 0.9) * np.sin(k * ph + k) for k in range(1, 22))
    x = lp(x, 1600) + 0.4 * lp(noise(d), 500)
    e = np.minimum(1, t / 0.08) * np.interp(t, [0, 0.4, 0.9, d], [0.6, 1, 0.8, 0.0]); return norm(x * e, 0.85)
def hiss(d=0.6): t = T(d); return norm(hp(noise(d), 2500) * np.exp(-t / 0.25) * np.minimum(1, t / 0.01), 0.5)
def glug():
    y = np.zeros(int(0.45 * SR))
    for i in range(3):
        s, _ = sweep(160 + i * 25, 420, 0.09); place(y, s * dec(len(s), 0.04, 0.003), i * 0.13, 1)
    return norm(y, 0.6)
def slap():
    y = np.zeros(int(0.25 * SR)); place(y, bp(noise(0.06), 500, 6000) * dec(int(0.06 * SR), 0.012, 0.0005), 0, 1)
    place(y, impact(0.2) * 0.5, 0, 1); return norm(y, 0.9)
def stamp():
    y = np.zeros(int(0.35 * SR)); s, _ = sweep(110, 50, 0.2); place(y, s * dec(len(s), 0.07, 0.001), 0, 1)
    place(y, bp(noise(0.03), 800, 4000) * dec(int(0.03 * SR), 0.008), 0, 0.6); return norm(y, 0.9)
def printer(d=0.8):
    t = T(d); saw = 2 * ((90 * t) % 1) - 1
    x = lp(saw, 1200) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 15 * t))) + 0.5 * bp(noise(d), 1000, 4000)
    e = np.minimum(1, t / 0.02) * np.minimum(1, (d - t) / 0.05); return norm(x * e, 0.6)
def keyclick(): return norm(hp(noise(0.008), 2500) * dec(int(0.008 * SR), 0.002, 0.0003), 0.5)
def squish(d=0.95):
    t = T(d); x = bp(noise(d), 250, 1600) * (0.5 + 0.5 * np.sin(2 * np.pi * 13 * t) ** 2)
    return norm(x * np.sin(np.pi * t / d) ** 0.5, 0.45)
def sparkle(base=84):
    y = np.zeros(int(1.2 * SR))
    for i, n_ in enumerate([base, base + 4, base + 7, base + 12]): place(y, glock(NOTE(n_), 0.8), i * 0.06, 0.8)
    return norm(y, 0.6)
def twinkle(d=1.3):
    y = np.zeros(int(d * SR))
    for i in range(7): place(y, glock(NOTE(int(rng.choice([88, 91, 93, 96, 100]))), 0.5), i * 0.16, 0.6)
    return norm(y, 0.45)
def scratch():
    d = 0.42; n = int(d * SR); fc = np.interp(np.linspace(0, 1, n), [0, 0.3, 0.55, 1], [250, 2600, 500, 1800])
    x = svf_bp(noise(d), fc, 4.0); return norm(x * np.sin(np.pi * np.linspace(0, 1, n)) ** 0.6, 0.8)
def creak(d=0.55):
    t = T(d); rate = np.interp(t, [0, d], [35, 75]); ph = np.cumsum(rate) / SR
    clicks = np.zeros_like(t); idx = np.where(np.diff(np.floor(ph)) > 0)[0]; clicks[idx] = 1
    x = bp(clicks + 0.02 * noise(d), 500, 1500, 3); return norm(x * np.sin(np.pi * t / d), 0.5)
def rumble(d):
    t = T(d); return norm(lp(noise(d), 160) * np.minimum(1, t / d) ** 1.5, 0.6)
def fanfare():
    y = np.zeros(int(1.8 * SR))
    def brass(f, d):
        t = T(d); ph = 2 * np.pi * f * t * (1 + 0.004 * np.sin(2 * np.pi * 5 * t))
        br = np.minimum(1, t / 0.08)
        x = sum((1 / k) * np.exp(-k * (1 - br) * 0.6) * np.sin(k * ph) for k in range(1, 12))
        return x * np.minimum(1, t / 0.02) * np.minimum(1, (d - t) / 0.12)
    place(y, brass(NOTE(67), 0.13), 0.0, 0.7); place(y, brass(NOTE(67), 0.13), 0.15, 0.7)
    for n_ in [60, 64, 67, 72]: place(y, brass(NOTE(n_), 1.3), 0.3, 0.45)
    return norm(lp(y, 3500), 0.75)
def popper():
    y = np.zeros(int(0.8 * SR)); place(y, pop(700, 150, 0.06) + 0.0, 0, 1)
    cr = np.zeros(int(0.7 * SR)); idx = rng.integers(0, len(cr), 400); cr[idx] = rng.uniform(-1, 1, 400)
    place(y, hp(cr, 3000) * np.linspace(1, 0, len(cr)), 0.03, 0.8); return norm(y, 0.8)
def tweet():
    y = np.zeros(int(0.8 * SR))
    for i in range(3): s, _ = sweep(2800, 4800, 0.07); place(y, s * np.sin(np.pi * np.linspace(0, 1, len(s))), i * 0.12, 1)
    return norm(y, 0.4)
def thump(): s, _ = sweep(90, 45, 0.16); return norm(s * dec(len(s), 0.05, 0.002) + 0.2 * lp(noise(0.16), 400) * dec(len(s), 0.02), 0.7)

# ---------------- cue sheet ----------------
sfx = np.zeros(N)
cues = [
    (1.95, flutter(), 0.42), (2.86, trombone(), 0.42), (3.28, whoosh(0.4), 0.3),
    (5.72, whoosh(0.25, 600, 3000), 0.16), (6.22, cashreg(), 0.6), (7.32, boing(0.6, 160, 320), 0.32), (7.58, pop(), 0.4), (7.6, sparkle(), 0.3),
    (8.58, whoosh(0.3), 0.2), (9.28, creak(0.6), 0.5), (9.3, thump(), 0.5),
    (10.92, thump(), 0.55), (10.95, creak(0.4), 0.35), (11.64, thump(), 0.6), (11.66, creak(0.45), 0.4), (12.74, pop(900, 180, 0.12), 0.7),
    (13.55, slide(1700, 380, 0.38), 0.5), (13.93, wham(), 1.0), (14.15, twinkle(), 0.3),
    (15.42, creak(0.5), 0.4), (16.86, cashreg(), 0.6), (17.38, whoosh(0.3), 0.18), (17.7, creak(0.5), 0.22), (18.4, creak(0.5), 0.22),
    (21.0, ring(), 0.32), (21.45, whoosh(0.3, 400, 3500), 0.45), (21.52, whoosh(0.3, 500, 3000), 0.4), (21.72, thump(), 0.35), (21.76, thump(), 0.3),
    (22.4, whoosh(0.15, 800, 4000), 0.3), (22.55, whoosh(0.15, 800, 4000), 0.3),
    (25.2, crack(), 0.95), (26.3, whoosh(0.45, 200, 1800), 0.35), (26.85, sparkle(86), 0.55),
    (28.05, whoosh(0.3), 0.18), (29.4, slide(500, 1300, 0.22), 0.35),
    (29.8, rumble(1.55), 0.55), (31.35, crash_big(), 1.0),
    (32.15, whoosh(0.2, 700, 3000), 0.22), (32.35, whoosh(0.2, 700, 3000), 0.22),
    (33.07, whoosh(0.3, 300, 2500), 0.3), (33.44, stamp(), 0.85),
    (34.6, creak(0.6), 0.45), (35.05, creak(0.5), 0.4), (35.6, boing(0.7, 150, 260), 0.5),
    (35.98, engine(), 0.65), (36.95, hiss(), 0.4),
    (38.1, glug(), 0.45), (39.2, whoosh(0.25, 500, 3500), 0.4), (39.24, whoosh(0.25, 600, 3000), 0.35), (39.48, whoosh(0.15, 800, 4000), 0.3),
    (40.42, flutter(0.9), 0.45), (40.6, crickets(1.3), 0.4),
    (42.25, slap(), 0.8), (44.72, whoosh(0.25), 0.14),
    (47.15, flutter(0.8), 0.42), (47.35, crickets(0.8), 0.28),
    (48.0, whoosh(0.55, 150, 4000, 2.5), 0.5), (48.3, pop(), 0.25), (48.88, impact(0.4), 0.45),
    (50.42, keyclick(), 0.8), (50.46, sparkle(84), 0.45),
    (51.25, squish(), 0.4), (52.6, printer(), 0.5),
    (54.03, popper(), 0.7), (54.03, fanfare(), 0.55), (54.62, cashreg(), 0.6), (54.64, boing(0.6, 200, 360), 0.3), (55.77, sparkle(88), 0.35),
    (58.3, slide(1800, 400, 0.32), 0.5), (58.62, wham(), 1.0), (58.6, scratch(), 0.4), (58.85, twinkle(), 0.3), (59.25, tweet(), 0.28),
]
for i in range(6): cues.append((19.3 + i * 0.16, pop(1000 + i * 90, 300, 0.07), 0.28))
for i in range(4): cues.append((43.48 + i * 0.15, pop(1300, 500, 0.06), 0.3))
for k in np.arange(23.75, 25.15, 0.55): cues.append((k, thump(), 0.3))
for k in np.arange(46.62, 47.0, 0.09): cues.append((k, thump() * 0.5, 0.25))
for k in [49.9, 49.98, 50.08, 50.15, 50.25, 50.31]: cues.append((k, keyclick(), 0.5))
for k in np.arange(37.95, 38.95, 0.07): cues.append((k, keyclick(), 0.25))
for k in [32.18, 32.28, 38.58, 38.67]: cues.append((k, whoosh(0.15, 900, 4000), 0.18))
for i, k in enumerate(np.arange(29.9, 31.3, 0.13)): cues.append((k, piano(NOTE(int(rng.integers(55, 84))), 0.6, 0.8), 0.22))
for c in cues:
    if c[0] in (54.03,) and c[2] == 0.55: continue  # fanfare (music sting)
    if c[0] == 58.6: continue  # record scratch (only made sense with music)
    place(sfx, c[1], c[0], c[2])

# ---------------- voice + music + ducking ----------------
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'voice.mp3', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
voice = np.frombuffer(raw, np.float32).astype(np.float64)
voice = hp(voice, 70)
v = np.zeros(N); v[:min(N, len(voice))] = voice[:N]
v = norm(v, 0.9)
MUSIC = False  # user asked for no background music
mus = norm(music(3.3, 58.62), 1.0) if MUSIC else np.zeros(N)
# voice envelope for ducking
w = int(0.05 * SR); env = np.sqrt(np.convolve(v ** 2, np.ones(w) / w, 'same'))
act = np.clip(env / (np.percentile(env[env > 1e-4], 60) + 1e-9), 0, 1)
k = int(0.15 * SR); act = np.convolve(act, np.ones(k) / k, 'same')
duck = 0.43 - 0.21 * act
for t0, depth, d in [(13.93, 0.8, 0.6), (25.2, 0.6, 0.45), (31.35, 0.8, 0.6), (42.25, 0.3, 0.2)]:
    i = int(t0 * SR); n = int(d * SR); duck[i:i + n] *= 1 - depth * np.linspace(1, 0, n) ** 0.5
mix = v + mus * duck + sfx * 0.55
mix = np.tanh(mix * 0.95) / np.tanh(0.95)
mix = norm(mix, 0.95)
st = np.stack([mix, mix], 1)
with wave.open('mix_raw.wav', 'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes((st * 32767).astype(np.int16).tobytes())
print('wrote mix_raw.wav', DUR, 's')
if __name__ == '__main__':
    db = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
    vm = act > 0.5
    print(f"voice(active) {db(v[vm]):.1f} dB | music under voice {db((mus*duck)[vm]):.1f} dB | music in gaps {db((mus*duck)[~vm & (np.arange(N) > 3.4*SR)]):.1f} dB | sfx peak-region {db(sfx[np.abs(sfx)>0.05]*0.55):.1f} dB")
