"""Procedural SFX library (48 kHz mono float32)."""
import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(7)


def t_axis(d):
    return np.arange(int(d * SR)) / SR


def noise(d):
    return rng.standard_normal(int(d * SR)).astype(np.float64)


def bp(x, lo, hi, order=4):
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def lp(x, hi, order=4):
    sos = signal.butter(order, hi, btype='low', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def hp(x, lo, order=4):
    sos = signal.butter(order, lo, btype='high', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def env_ad(n, a, d, curve=4.0):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), np.exp(-(t - a) * curve / max(d, 1e-4)))
    return e


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


def chirp_tone(d, f0, f1, decay=8.0):
    t = t_axis(d)
    f = f0 * (f1 / f0) ** (t / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * decay)


def bubbles(d, n, fmin=500, fmax=1800, rise=True, dur=0.05):
    out = np.zeros(int(d * SR))
    for _ in range(n):
        st = rng.uniform(0, d - dur)
        f0 = rng.uniform(fmin, fmax)
        b = chirp_tone(dur, f0, f0 * (1.8 if rise else 0.6), decay=50)
        i = int(st * SR)
        out[i:i + len(b)] += b * rng.uniform(0.3, 1.0)
    return out


def splash():
    d = 0.9
    n = noise(d)
    x = bp(n, 400, 7000) * env_ad(len(n), 0.008, 0.35, 5)
    x += 0.6 * lp(noise(d), 600) * env_ad(len(n), 0.004, 0.15, 6)
    x += 0.5 * bubbles(d, 18, 700, 2500)
    return norm(x, 0.9)


def squelch():
    d = 0.55
    t = t_axis(d)
    n = lp(noise(d), 1400)
    f = 250 + 700 * np.sin(np.pi * t / d)
    y = np.zeros_like(n)
    # time-varying bandpass via short blocks
    blk = 512
    for i in range(0, len(n), blk):
        fc = f[i]
        seg = n[max(0, i - 2048):i + blk]
        s = bp(seg, max(80, fc * 0.6), fc * 1.6, 2)[-min(blk, len(n) - i):]
        y[i:i + len(s)] = s
    y *= np.sin(np.pi * t / d) ** 0.7
    y += 0.4 * bubbles(d, 8, 300, 900, rise=False)
    return norm(y, 0.85)


def glug(count=6):
    d = 0.16 * count + 0.2
    out = np.zeros(int(d * SR))
    for k in range(count):
        st = 0.03 + k * 0.155 + rng.uniform(-0.01, 0.01)
        g = chirp_tone(0.14, rng.uniform(170, 220), 110, decay=18)
        hi = 0.5 * chirp_tone(0.08, 900, 500, decay=40)
        g[:len(hi)] += hi
        cl = bp(noise(0.03), 300, 2500) * env_ad(int(0.03 * SR), 0.002, 0.02, 6) * 0.4
        i = int(st * SR)
        out[i:i + len(g)] += g
        out[i:i + len(cl)] += cl
    return norm(lp(out, 3000), 0.85)


def scrub(d=1.4, rate=7.0, bright=(1200, 6000)):
    t = t_axis(d)
    n = bp(noise(d), *bright)
    am = (0.55 + 0.45 * np.abs(np.sin(np.pi * rate * t))) ** 2
    wet = 0.35 * bubbles(d, int(d * 10), 900, 2400)
    x = n * am + wet
    fade = np.minimum(1, np.minimum(t / 0.05, (d - t) / 0.08))
    return norm(x * fade, 0.8)


def crowd_scrub(d=3.6, layers=14):
    out = np.zeros(int(d * SR))
    for k in range(layers):
        s = scrub(d, rate=rng.uniform(5, 9), bright=(rng.uniform(900, 1500), rng.uniform(4000, 7000)))
        out += s * rng.uniform(0.5, 1.0)
    t = t_axis(d)
    out += 0.15 * lp(noise(d), 400)  # room murmur
    fade = np.minimum(1, np.minimum(t / 0.1, (d - t) / 0.2))
    return norm(out * fade, 0.8)


def thud(f=70, d=0.45, softness=1.0):
    t = t_axis(d)
    x = np.sin(2 * np.pi * f * t * (1 - 0.3 * t / d)) * np.exp(-t * 12)
    x += softness * 0.6 * lp(noise(d), 500) * env_ad(len(t), 0.003, 0.12, 6)
    return norm(x, 0.9)


def clunk():
    d = 0.9
    t = t_axis(d)
    x = np.zeros_like(t)
    for f, a, dec in ((62, 1.0, 6), (148, 0.6, 9), (311, 0.4, 14), (523, 0.25, 18), (877, 0.15, 25)):
        x += a * np.sin(2 * np.pi * f * t) * np.exp(-t * dec)
    x += 0.5 * lp(noise(d), 1200) * env_ad(len(t), 0.002, 0.05, 6)
    return norm(x, 0.95)


def metal_clank(d=0.8, base=1.0):
    t = t_axis(d)
    x = np.zeros_like(t)
    for f, a, dec in ((523, 1.0, 7), (1187, 0.7, 9), (2011, 0.5, 12), (3150, 0.35, 15), (4420, 0.2, 20)):
        x += a * np.sin(2 * np.pi * f * base * t + rng.uniform(0, 6)) * np.exp(-t * dec)
    x += 0.6 * hp(noise(d), 2000) * env_ad(len(t), 0.001, 0.02, 6)
    x += 0.5 * np.sin(2 * np.pi * 90 * t) * np.exp(-t * 20)
    return norm(x, 0.9)


def clink():
    d = 0.25
    t = t_axis(d)
    x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * dec) for f, a, dec in ((3200, 1, 30), (5100, 0.6, 40), (7300, 0.3, 50)))
    return norm(x, 0.7)


def crank_squeak():
    d = 0.32
    t = t_axis(d)
    f = 950 + 500 * (t / d) + 60 * np.sin(2 * np.pi * 38 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph))
    x *= np.sin(np.pi * t / d) ** 1.5
    x *= 0.7 + 0.3 * np.sin(2 * np.pi * 23 * t)
    return norm(x, 0.6)


def rumble(d, rot_hz=1.0, level=1.0):
    t = t_axis(d)
    n = lp(noise(d), 180, 4)
    n = lp(np.cumsum(n) * 0.02, 160, 2) + 0.3 * lp(noise(d), 300)
    am = 0.75 + 0.25 * np.sin(2 * np.pi * rot_hz * t)
    tumble = bubbles(d, int(d * rot_hz * 2) + 1, 120, 260, rise=False, dur=0.12) * 0.8
    x = n * am + tumble
    fade = np.minimum(1, np.minimum(t / 0.15, (d - t) / 0.25))
    return norm(x * fade, 0.8 * level)


def motor_hum(d, f0=95.0, start_ramp=0.25):
    t = t_axis(d)
    ramp = np.minimum(1, t / start_ramp)
    f = f0 * (0.6 + 0.4 * ramp)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = sum((0.8 / k) * np.sin(k * ph + k) for k in range(1, 9))
    x += 0.15 * bp(noise(d), 1500, 5000)
    x *= 0.85 + 0.15 * np.sin(2 * np.pi * 7 * t)
    fade = np.minimum(1, np.minimum(t / 0.05, (d - t) / 0.2))
    return norm(x * fade * ramp, 0.7)


def drain(d=1.6):
    t = t_axis(d)
    n = lp(noise(d), 900) * 0.6
    gur = bubbles(d, int(d * 28), 150, 650, rise=False, dur=0.09)
    x = n * (0.6 + 0.4 * np.sin(2 * np.pi * 3 * t)) + gur
    fade = np.minimum(1, np.minimum(t / 0.08, (d - t) / 0.3))
    return norm(x * fade, 0.8)


def pour(d=2.2):
    t = t_axis(d)
    x = bp(noise(d), 500, 5000) * 0.7 + 0.5 * bubbles(d, int(d * 30), 600, 2200)
    fade = np.minimum(1, np.minimum(t / 0.06, (d - t) / 0.25))
    return norm(x * fade, 0.75)


def whoosh(d=0.6, f0=300, f1=3000, rise=True):
    t = t_axis(d)
    n = noise(d)
    y = np.zeros_like(n)
    blk = 480
    for i in range(0, len(n), blk):
        u = i / len(n)
        fc = f0 * (f1 / f0) ** (u if rise else 1 - u)
        seg = n[max(0, i - 4096):i + blk]
        s = bp(seg, fc * 0.6, min(fc * 1.7, 20000), 2)[-min(blk, len(n) - i):]
        y[i:i + len(s)] = s
    y *= np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.2
    return norm(y, 0.8)


def spin_whoosh(d, rate=2.6):
    t = t_axis(d)
    base = bp(noise(d), 300, 4000)
    am = 0.35 + 0.65 * (0.5 + 0.5 * np.sin(2 * np.pi * rate * 2 * t)) ** 2
    x = base * am + 0.4 * lp(noise(d), 200)
    fade = np.minimum(1, np.minimum(t / 0.2, (d - t) / 0.3))
    return norm(x * fade, 0.75)


def poof():
    d = 0.7
    t = t_axis(d)
    x = lp(noise(d), 1800) * env_ad(len(t), 0.02, 0.35, 5)
    x += 0.7 * np.sin(2 * np.pi * 80 * t) * np.exp(-t * 14)
    return norm(x, 0.9)


def fire(d=1.6):
    t = t_axis(d)
    roar = lp(noise(d), 700) * 0.8 + bp(noise(d), 800, 3000) * 0.3
    crack = np.zeros_like(t)
    for _ in range(int(d * 40)):
        i = int(rng.uniform(0, d - 0.01) * SR)
        c = hp(noise(0.006), 2000) * np.exp(-np.arange(int(0.006 * SR)) / SR * 600)
        crack[i:i + len(c)] += c * rng.uniform(0.3, 1.0)
    x = roar * (0.7 + 0.3 * np.sin(2 * np.pi * 2.3 * t)) + crack
    att = np.minimum(1, t / 0.12)
    fade = np.minimum(1, (d - t) / 0.4)
    return norm(x * att * fade, 0.85)


def fall_whistle(d=0.9):
    return norm(chirp_tone(d, 1400, 500, decay=0.6) * np.sin(np.pi * t_axis(d) / d), 0.4)


def plip():
    return norm(chirp_tone(0.05, 1400, 2600, decay=60), 0.5)


def pop():
    d = 0.05
    x = chirp_tone(d, rng.uniform(900, 1500), 500, decay=90)
    return norm(x, 0.6)


def sparkle():
    d = 0.5
    t = t_axis(d)
    x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * 9) * a for f, a in ((2637, 1), (3136, 0.7), (3951, 0.5)))
    return norm(x, 0.35)


# ---------------------------------------------------------------- elevator episode extras
def breath(d=0.35, inhale=False, level=1.0):
    t = t_axis(d)
    n = bp(noise(d), 350, 2600)
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** (0.6 if inhale else 1.5)
    if not inhale:
        env *= np.exp(-t * 3)
    return norm(n * env, 0.6 * level)


def piano_clang(d=1.6, base=110.0):
    t = t_axis(d)
    x = np.zeros_like(t)
    for f, a in ((base, 1.0), (base * 1.059, 0.8), (base * 1.122, 0.7), (base * 2.0, 0.5), (base * 2.12, 0.4), (base * 3.0, 0.3),
                 (base * 4.24, 0.2)):
        x += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t * (2.0 + f / 400))
    x += 0.8 * lp(noise(d), 600) * env_ad(len(t), 0.002, 0.08, 6)
    return norm(x, 0.9)


def glass_shatter(d=1.2):
    t = t_axis(d)
    x = hp(noise(d), 2500) * env_ad(len(t), 0.001, 0.25, 5)
    for _ in range(40):
        st = rng.uniform(0.02, d - 0.1)
        f0 = rng.uniform(3000, 7500)
        b = np.sin(2 * np.pi * f0 * t_axis(0.08)) * np.exp(-t_axis(0.08) * 60)
        i = int(st * SR)
        x[i:i + len(b)] += b * rng.uniform(0.2, 0.7) * np.exp(-st * 2)
    x += 0.5 * lp(noise(d), 400) * env_ad(len(t), 0.001, 0.06, 6)
    return norm(x, 0.9)


def crack():
    d = 0.12
    x = hp(noise(d), 1500) * env_ad(int(d * SR), 0.0005, 0.02, 8)
    x += 0.6 * chirp_tone(d, 900, 300, decay=60)
    return norm(x, 0.8)


def sizzle(d=0.6):
    t = t_axis(d)
    x = hp(noise(d), 4000) * (0.6 + 0.4 * rng.random(len(t)) ** 4) * np.sin(np.pi * t / d) ** 0.5
    return norm(x, 0.6)


def rope_creak(d=0.35, f0=420):
    t = t_axis(d)
    f = f0 * (1 + 0.15 * np.sin(2 * np.pi * 9 * t)) * (1 + 0.3 * t / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sign(np.sin(ph)) * 0.3 + np.sin(ph)) * (0.5 + 0.5 * rng.random(len(t)) ** 8)
    x = bp(x, 200, 3000) * np.sin(np.pi * t / d) ** 1.2
    return norm(x, 0.5)


def fall_whistle_down(d=0.9):
    t = t_axis(d)
    return norm(chirp_tone(d, 1800, 350, decay=0.3) * np.minimum(1, t / 0.1), 0.45)


def bell_ding(d=1.4):
    t = t_axis(d)
    x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * dec) for f, a, dec in ((1568, 1.0, 2.5), (3136, 0.4, 4), (2349, 0.5, 3.5), (4699, 0.15, 6)))
    return norm(x, 0.6)


def click():
    d = 0.05
    x = hp(noise(d), 1500) * env_ad(int(d * SR), 0.0005, 0.01, 8) + 0.4 * chirp_tone(d, 2500, 1500, decay=120)
    return norm(x, 0.6)


def knock(f=180):
    d = 0.18
    t = t_axis(d)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 35) + 0.6 * bp(noise(d), 500, 2500) * env_ad(len(t), 0.0008, 0.03, 8)
    return norm(x, 0.8)
