"""Sound for the tornado shelter reel: voice placement, sound effects, music and the mix.

Everything is driven by build/timeline.json (node tools/export_timeline.mjs), so the
sound stays locked to the animation, and every effect, the weather and the music are
synthesised here in code. The voice lines (assets/vo/<id>.wav) sit in fixed slots
(timeline VO[].at); a line that has grown longer than its slot (a new recording) is
sped up a little (atempo, at most 1.12x) and reported. The placement actually used is
written to build/vo_placement.json for the subtitles.

usage: python tools/audio.py    -> build/mix.wav (+ stems in build/audio/)
"""
import json
import math
import os
import subprocess
import sys

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.interpolate import CubicSpline

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = lambda *p: os.path.join(ROOT, "build", *p)
A = lambda *p: os.path.join(ROOT, "assets", *p)
TL = json.load(open(B("timeline.json")))
T = TL["T"]
WD = TL["WORLD"]
DUR = TL["DURATION"]
N = int(DUR * SR)
SCRIPT = json.load(open(os.path.join(ROOT, "script.json")))
rng = np.random.default_rng(7)


# ---------------------------------------------------------------------------
# dsp helpers
# ---------------------------------------------------------------------------
def tt(d):
    return np.arange(int(d * SR)) / SR


def sos(kind, f, order=2):
    return signal.butter(order, f, btype=kind, fs=SR, output="sos")


def lp(x, f, o=2):
    return signal.sosfilt(sos("lowpass", f, o), x)


def hp(x, f, o=2):
    return signal.sosfilt(sos("highpass", f, o), x)


def bp(x, f1, f2, o=2):
    return signal.sosfilt(sos("bandpass", [f1, f2], o), x)


def noise(d):
    return rng.standard_normal(int(d * SR))


def pink(d):
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, noise(d)) * 6


def brown(d):
    return hp(np.cumsum(noise(d)) * 0.02, 20)


def norm(x, peak=0.9):
    return x * (peak / (np.max(np.abs(x)) + 1e-9))


def fade(x, a=0.005, r=0.02):
    x = x.copy()
    na, nr = max(1, min(len(x), int(a * SR))), max(1, min(len(x), int(r * SR)))
    x[:na] *= np.linspace(0, 1, na)
    x[-nr:] *= np.linspace(1, 0, nr)
    return x


def chirp(f, d):
    """sine with a per-sample frequency array or callable"""
    t = tt(d)
    fr = f(t) if callable(f) else f
    return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(fr, t.shape)) / SR)


def env_exp(d, tau, attack=0.002):
    t = tt(d)
    e = np.exp(-t / tau)
    na = max(1, int(attack * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def arch(d, p=1.0):
    """0 -> 1 -> 0 half-sine envelope"""
    return np.sin(np.pi * np.clip(tt(d) / d, 0, 1)) ** p


def put(out, t0, y, g=1.0):
    i = int(round(t0 * SR))
    if i < 0:
        y, i = y[-i:], 0
    if i < len(out):
        out[i : i + len(y)] += y[: len(out) - i] * g


def grains(d, rate, f1, f2, glen=(0.002, 0.008), shape=None, amp=(0.3, 1.0)):
    """sparse crackle: short windowed slices of band-passed noise"""
    out = np.zeros(int(d * SR))
    src = bp(noise(min(d, 1.5) + 0.05), f1, min(f2, SR / 2 - 100))
    for _ in range(rng.poisson(rate * d)):
        st = rng.uniform(0, d)
        if shape is not None and rng.uniform() > shape(st / d):
            continue
        n = max(8, int(rng.uniform(*glen) * SR))
        j = int(rng.integers(0, max(1, len(src) - n)))
        put(out, st, src[j : j + n] * np.hanning(n), rng.uniform(*amp))
    return out


def modes(d, parts, phase=True):
    """sum of decaying sines: [(freq, amp, tau), ...]"""
    t = tt(d)
    return sum(a * np.sin(2 * np.pi * f * t + (rng.uniform(0, 6.28) if phase else 0)) * np.exp(-t / tau) for f, a, tau in parts if f < SR / 2 - 200)


def srand(d, rate, seed=None):
    """a smooth random curve (about -1..1) sampled at the audio rate"""
    r = np.random.default_rng(seed) if seed is not None else rng
    n = int(d * rate) + 4
    return CubicSpline(np.arange(n) / rate - 1.0 / rate, r.standard_normal(n) * 0.6)(tt(d))


def slow_noise(x, rate, seed):
    """the same, evaluated at arbitrary times x (seconds of the reel)"""
    r = np.random.default_rng(seed)
    n = int((DUR + 4) * rate) + 4
    return CubicSpline(np.arange(n) / rate - 2.0, r.standard_normal(n) * 0.6)(x)


def shaped_noise(d, mag, seed, nper=2048):
    """noise shaped in time and frequency: mag(frame_times, freqs) -> gains (freqs x frames)"""
    r = np.random.default_rng(seed)
    n = int(d * SR)
    f, ft, Z = signal.stft(r.standard_normal(n), SR, nperseg=nper, noverlap=nper * 3 // 4)
    Z *= mag(ft, f)
    _, y = signal.istft(Z, SR, nperseg=nper, noverlap=nper * 3 // 4)
    return y[:n] if len(y) >= n else np.pad(y, (0, n - len(y)))


def band_field(ft, f, rate, seed, nb=26):
    """smooth random (time x band) field spread over the bins: turbulence"""
    cen = np.geomspace(25, 12000, nb)
    series = np.stack([slow_noise(ft, rate, seed * 100 + k) for k in range(nb)])  # nb x frames
    lf = np.log(np.maximum(f, 20.0))
    idx = np.clip(np.interp(lf, np.log(cen), np.arange(nb)), 0, nb - 1)
    i0 = np.floor(idx).astype(int)
    i1 = np.minimum(i0 + 1, nb - 1)
    w = (idx - i0)[:, None]
    return series[i0] * (1 - w) + series[i1] * w


def smooth01(x, a, d):
    u = np.clip((np.asarray(x, dtype=float) - a) / d, 0, 1)
    return u * u * (3 - 2 * u)


# ---------------------------------------------------------------------------
# camera -> stereo position (the same monotone spline as src/util.js monotone)
# ---------------------------------------------------------------------------
def monotone(keys):
    t = [k[0] for k in keys]
    v = [k[1] for k in keys]
    n = len(keys)
    d = [(v[i + 1] - v[i]) / max(1e-9, t[i + 1] - t[i]) for i in range(n - 1)]
    m = [0.0] * n
    for i in range(1, n - 1):
        m[i] = 0.0 if d[i - 1] * d[i] <= 0 else (d[i - 1] + d[i]) / 2
    for i in range(n - 1):
        if d[i] == 0:
            m[i] = m[i + 1] = 0.0
            continue
        a, b = m[i] / d[i], m[i + 1] / d[i]
        s = a * a + b * b
        if s > 9:
            k = 3 / math.sqrt(s)
            m[i], m[i + 1] = k * a * d[i], k * b * d[i]

    def f(x):
        if x <= t[0]:
            return v[0]
        if x >= t[-1]:
            return v[-1]
        i = 0
        while x > t[i + 1]:
            i += 1
        h = t[i + 1] - t[i]
        u = (x - t[i]) / h
        u2, u3 = u * u, u * u * u
        return (2 * u3 - 3 * u2 + 1) * v[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * v[i + 1] + (u3 - u2) * h * m[i + 1]

    return f


CAM_CX = monotone([(c["t"], c["cx"]) for c in TL["CAM"]])
CAM_LS = monotone([(c["t"], math.log(c["s"])) for c in TL["CAM"]])


def pan(x, t, width=0.7):
    """stereo position of world x at time t: where it sits across the frame"""
    px = (x - CAM_CX(t)) * math.exp(CAM_LS(t))
    return float(np.clip(px / 540.0, -1, 1) * width)


WT = np.arange(len(WD["wind"])) / 10.0


def sampled(key, t):
    return np.interp(t, WT, WD[key])


# ---------------------------------------------------------------------------
# sound effects (all synthesised)
# ---------------------------------------------------------------------------
def s_label():
    """a yellow label popping up: a soft low 'whum' with a breath of air"""
    d = 0.5
    t = tt(d)
    body = chirp(92 + 150 * np.exp(-t / 0.035), d) * env_exp(d, 0.1, 0.002)
    air = bp(noise(d), 1400, 6000) * np.exp(-t / 0.025)
    return norm(norm(body) + 0.16 * norm(air))


def s_tick(pitch=1.0):
    d = 0.12
    t = tt(d)
    y = modes(d, [(2650 * pitch, 1.0, 0.012), (4100 * pitch, 0.5, 0.007), (1320 * pitch, 0.4, 0.02)])
    y += 0.4 * hp(noise(d), 3500) * np.exp(-t / 0.0015)
    return norm(y)


def s_thud(weight=1.0):
    d = 0.5
    t = tt(d)
    y = chirp((44 + 60 * np.exp(-t / 0.05)) / weight ** 0.3, d) * env_exp(d, 0.12 * weight, 0.003)
    y += 0.55 * lp(noise(d), 260) * env_exp(d, 0.045)
    y += 0.1 * bp(noise(d), 900, 3500) * env_exp(d, 0.02)
    return norm(y)


def s_knock(pitch=1.0):
    """wood on wood: a dry tok with a hollow body"""
    d = 0.3
    t = tt(d)
    y = modes(d, [(480 * pitch, 1.0, 0.03), (1130 * pitch, 0.6, 0.018), (1760 * pitch, 0.35, 0.011), (230 * pitch, 0.7, 0.05)])
    y += 0.5 * bp(noise(d), 900, min(3800 * pitch, 16000)) * env_exp(d, 0.004, 0.0004)
    return norm(y * np.minimum(t / 0.0008, 1))


def s_creak(d=0.5, f0=170, f1=330, bright=1.0):
    """creak: stick-slip pulses through resonances (wood, or low and dark: a steel groan)"""
    t = tt(d)
    rate = f0 + (f1 - f0) * np.sin(np.pi * np.clip(t / d, 0, 1)) + 0.07 * f0 * np.sin(2 * np.pi * 9 * t)
    ph = np.cumsum(rate) / SR
    imp = (np.diff(np.floor(ph), prepend=0) > 0).astype(float) * (0.7 + 0.3 * rng.uniform(size=len(t)))
    y = signal.lfilter([1], [1, -0.96], imp)
    y = bp(y, 120 + 260 * bright, 400 + 2000 * bright) + 0.6 * bp(y, 300 + 550 * bright, 500 + 800 * bright)
    return norm(y * arch(d, 0.6))


def s_whoosh(d=0.9, lo=380, hi=1900, p=1.2):
    def mag(ft, f):
        u = np.clip(ft / d, 0, 1)
        fc = lo + (hi - lo) * np.sin(np.pi * u) ** 1.5
        g = np.exp(-0.5 * (np.log2(np.maximum(f, 20)[:, None] / fc[None, :]) / 0.55) ** 2)
        return g * (np.sin(np.pi * u) ** p)[None, :]

    return norm(shaped_noise(d, mag, int(rng.integers(1 << 30)), nper=1024))


def s_step(hard=0.0, weight=1.0):
    """a footstep: on grass (hard=0), on concrete (hard=1)"""
    d = 0.16
    t = tt(d)
    if hard < 0.5:
        y = lp(noise(d), 1700) * env_exp(d, 0.03, 0.004) + 0.35 * grains(d, 220, 1500, 6000, shape=lambda u: np.exp(-6 * u))
        y += 0.5 * chirp(70 + 40 * np.exp(-t / 0.01), d) * env_exp(d, 0.03, 0.003) * weight
    else:
        y = bp(noise(d), 900, 7000) * env_exp(d, 0.006, 0.0004)
        y += 0.9 * chirp(95 + 60 * np.exp(-t / 0.008), d) * env_exp(d, 0.028, 0.001) * weight
        y += 0.2 * bp(noise(d), 1200, 4500) * arch(d, 2.0)  # the scuff of the sole
    return norm(y)


def s_paw(hard=1.0):
    """a dog's paw: claws tick on concrete, a soft pad"""
    d = 0.08
    t = tt(d)
    y = 0.6 * lp(noise(d), 1200) * env_exp(d, 0.012, 0.002)
    if hard > 0.5:
        for k in range(int(rng.integers(1, 3))):
            put(y, 0.004 + 0.012 * k, bp(noise(0.01), 3000, 9000) * np.exp(-tt(0.01) / 0.0015), 0.8)
    return norm(y)


def s_dig():
    """the blade bites into the soil: a dull thump with crumbly grit and a scrape"""
    d = 0.34
    t = tt(d)
    thump = lp(noise(d), 380) * env_exp(d, 0.05, 0.004)
    grit = grains(d, 330, 1200, 5500, shape=lambda u: np.exp(-4 * u))
    scrape = bp(noise(d), 700, 2600) * env_exp(d, 0.03, 0.002)
    body = chirp(68 + 45 * np.exp(-t / 0.03), d) * env_exp(d, 0.06)
    return norm(norm(thump) * 0.8 + norm(grit) * 0.5 + norm(scrape) * 0.35 + norm(body) * 0.45)


def s_toss():
    """a shovelful of soil landing on the pile"""
    d = 0.45
    y = lp(noise(d), 600) * env_exp(d, 0.06, 0.006)
    y += 0.7 * grains(d, 300, 900, 4500, shape=lambda u: np.exp(-5 * u))
    return norm(y)


def s_crumble(d=1.1):
    """soil sliding down: a soft rumble and a rain of grit"""
    t = tt(d)
    shape = lambda u: np.clip(min(u / 0.08, 1.0) * (1 - u) ** 0.7 * 1.3, 0, 1)
    rum = lp(brown(d), 170, 4) * np.minimum(t / 0.06, 1) * np.clip((d - t) / (0.6 * d), 0, 1) ** 0.7
    y = norm(rum) * 0.7 + norm(grains(d, 1100, 1800, 7000, shape=shape)) * 0.5
    y += norm(grains(d, 160, 400, 1400, glen=(0.008, 0.03), shape=shape)) * 0.45
    return norm(y)


def s_clink(f0=None):
    """a steel bar knocking another: a bright inharmonic ring"""
    f0 = f0 or rng.uniform(420, 900)
    d = 0.9
    parts = [(f0, 1.0, 0.32), (f0 * 2.756, 0.75, 0.2), (f0 * 5.404, 0.45, 0.11), (f0 * 8.933, 0.25, 0.06)]
    y = modes(d, parts) + 0.35 * hp(noise(d), 2500) * env_exp(d, 0.004, 0.0003)
    return norm(y)


def s_cage():
    """a rebar cage dropping into place: clinks and a dull landing"""
    out = np.zeros(int(1.3 * SR))
    for _ in range(int(rng.integers(3, 6))):
        put(out, rng.uniform(0, 0.16), s_clink(rng.uniform(380, 950)), rng.uniform(0.35, 1.0))
    put(out, 0.0, s_thud(0.6)[: int(0.4 * SR)], 0.4)
    return norm(out)


def s_pour(d=1.6):
    """wet concrete pouring: a thick gushing slurry with glops and a sloshing chute"""
    t = tt(d)
    body = lp(hp(pink(d), 90), 1100) * (0.85 + 0.25 * srand(d, 12))
    glops = np.zeros(len(t))
    for _ in range(int(16 * d)):
        gd = rng.uniform(0.05, 0.12)
        f0 = rng.uniform(70, 190)
        put(glops, rng.uniform(0, d - 0.15), chirp(f0 * (1 + 0.6 * tt(gd) / gd), gd) * arch(gd, 1.5), rng.uniform(0.3, 1.0))
    slosh = bp(noise(d), 300, 900) * (0.5 + 0.5 * np.abs(srand(d, 6)))
    env = np.minimum(t / 0.12, 1) * np.clip((d - t) / 0.45, 0, 1)
    return norm((norm(body) * 0.8 + norm(glops) * 0.6 + norm(slosh) * 0.35) * env)


def s_slab():
    """the heavy roof slab settling into place"""
    d = 1.4
    t = tt(d)
    boom = chirp(38 + 50 * np.exp(-t / 0.06), d) * env_exp(d, 0.28, 0.004)
    thud = lp(noise(d), 300) * env_exp(d, 0.06, 0.002)
    grit = grains(d, 260, 900, 5000, shape=lambda u: np.exp(-7 * u))
    return norm(norm(boom) + 0.7 * norm(thud) + 0.25 * norm(grit))


def s_plank_flight(d):
    """the plank tumbling in at speed (slow motion): a heavy whoosh building to the hit"""
    def mag(ft, f):
        u = np.clip(ft / d, 0, 1)
        fc = 230 + 1000 * u ** 2
        g = np.exp(-0.5 * (np.log2(np.maximum(f, 20)[:, None] / fc[None, :]) / 0.9) ** 2)
        return g * (0.12 + 0.88 * u ** 2.2)[None, :]

    t = tt(d)
    u = t / d
    y = norm(shaped_noise(d, mag, 4242)) * (1 + 0.3 * np.sin(2 * np.pi * (2.5 + 5 * u) * t))
    y += 0.35 * chirp(50 + 35 * u, d) * u ** 3  # a low riser under it
    return norm(fade(y, 0.05, 0.003))


def s_smash():
    """the plank smashing into the concrete: a crack, splinters, a deep thud, bits falling"""
    d = 2.2
    t = tt(d)
    crack = hp(noise(d), 1500) * env_exp(d, 0.012, 0.0002)
    snap = bp(noise(d), 700, 4500) * env_exp(d, 0.045, 0.0005)
    splinter = grains(d, 1600, 1200, 9000, glen=(0.0008, 0.004), shape=lambda u: np.exp(-9 * u))
    body = modes(d, [(190, 1.0, 0.06), (330, 0.7, 0.05), (520, 0.5, 0.035), (870, 0.3, 0.02)])
    boom = chirp(42 + 70 * np.exp(-t / 0.04), d) * env_exp(d, 0.3, 0.002)
    fall = np.zeros(len(t))
    for _ in range(36):
        put(fall, rng.uniform(0.25, 1.7) ** 1.3, s_knock(rng.uniform(1.6, 3.2))[: int(0.12 * SR)], rng.uniform(0.05, 0.25))
    y = norm(crack) * 0.8 + norm(snap) * 0.9 + norm(splinter) * 0.55 + norm(body) * 0.7 + norm(boom) * 0.9 + norm(fall) * 0.35
    return norm(y)


def s_clank(f0=None, d=0.7):
    """a hollow steel tube or sheet hit"""
    f0 = f0 or rng.uniform(250, 520)
    parts = [(f0, 1.0, 0.18), (f0 * 1.58, 0.8, 0.14), (f0 * 2.37, 0.6, 0.1), (f0 * 3.61, 0.4, 0.07), (f0 * 5.1, 0.25, 0.05)]
    y = modes(d, parts) + 0.5 * bp(noise(d), 1200, 6000) * env_exp(d, 0.006, 0.0003)
    return norm(y)


def s_chair():
    """the garden chair lifting off, clattering and tumbling away"""
    out = np.zeros(int(2.4 * SR))
    for dt_, g in [(0.0, 0.45), (0.55, 1.0), (1.0, 0.6), (1.4, 0.35), (1.75, 0.2)]:
        put(out, dt_, s_clank(rng.uniform(300, 480)), g)
        put(out, dt_ + 0.03, s_clank(rng.uniform(520, 800)), g * 0.5)
    put(out, 0.1, s_whoosh(1.4, 300, 1200), 0.35)
    return norm(out)


def s_motor(d, f_run=150, gear=7.3):
    """the drill's motor: spins up, works under load, spins down"""
    t = tt(d)
    up = np.clip(t / 0.18, 0, 1) ** 0.6
    down = np.clip((d - t) / 0.25, 0, 1)
    load = 1 - 0.14 * smooth01(t, 0.25, 0.3) + 0.05 * srand(d, 7)
    f = f_run * up * np.sqrt(down) * load + 4
    ph = 2 * np.pi * np.cumsum(f) / SR
    motor = sum(np.sin(h * ph) / h ** 0.8 for h in range(1, 13))
    whine = np.sin(gear * ph)
    brush = hp(noise(d), 3000) * (0.5 + 0.5 * np.sin(ph)) ** 2
    y = norm(motor) * 0.6 + norm(whine) * 0.3 + norm(brush) * 0.12
    return norm(y * up * down)


def s_auger(d=1.15):
    """an anchor screwing down into the soil: deep grinding, stones crunching"""
    t = tt(d)
    rot = 2 * np.pi * np.cumsum(13 + 4 * smooth01(t, 0, 0.2)) / SR
    grind = lp(bp(noise(d), 120, 1600), 1200) * (0.65 + 0.35 * np.sin(rot))
    stones = grains(d, 70, 500, 3000, glen=(0.004, 0.015))
    rumble = lp(brown(d), 140, 4)
    env = smooth01(t, 0, 0.12) * (1 - smooth01(t, d - 0.25, 0.25))
    return norm((norm(grind) * 0.7 + norm(stones) * 0.35 + norm(rumble) * 0.5) * env)


def s_clang(f0=90, d=2.2, bright=1.0):
    """a heavy steel plate hit: a deep 'bwong' with a long ring"""
    ratios = [1.0, 1.47, 2.09, 2.56, 3.21, 3.9, 4.61, 5.43, 6.73, 8.1, 9.6, 11.8]
    parts = [(f0 * r * rng.uniform(0.985, 1.015), (1.0 / (1 + 0.35 * i)) * bright ** (i / 6), 0.9 / (1 + 0.25 * i)) for i, r in enumerate(ratios)]
    t = tt(d)
    y = modes(d, parts)
    y += 0.6 * bp(noise(d), 1500, 7000) * env_exp(d, 0.01, 0.0003)
    y += 0.8 * chirp(45 + 40 * np.exp(-t / 0.03), d) * env_exp(d, 0.18, 0.002)
    return norm(y)


def s_door_drop():
    """the steel door drops in and lands with a heavy thud; the hinges rattle"""
    out = np.zeros(int(2.8 * SR))
    put(out, 0.0, s_whoosh(0.32, 300, 1200), 0.25)
    put(out, 0.3, s_clang(84, 2.4, 0.9), 1.0)
    put(out, 0.3, s_thud(1.3), 0.8)
    for k in range(4):
        put(out, 0.36 + 0.07 * k + 0.02 * rng.uniform(), s_clink(rng.uniform(900, 1500)), 0.12)
    return norm(out)


def s_bolt(slide=0.11, pitch=1.0, clunk_g=1.0):
    """a steel bolt sliding home with a clunk"""
    d = slide + 0.6
    out = np.zeros(int(d * SR))
    ns = int(slide * SR)
    sl = bp(noise(slide), 1800, 7000) * arch(slide, 0.5) * (0.6 + 0.4 * rng.uniform(size=ns))
    put(out, 0.0, sl + 0.4 * grains(slide, 900, 2000, 8000, glen=(0.0005, 0.002)), 0.25)
    t = tt(0.6)
    clunk = modes(0.6, [(720 * pitch, 1.0, 0.05), (1310 * pitch, 0.7, 0.035), (2150 * pitch, 0.45, 0.025), (3400 * pitch, 0.25, 0.015)])
    clunk += 1.4 * chirp(110 * pitch + 90 * np.exp(-t / 0.01), 0.6) * env_exp(0.6, 0.06, 0.0008)
    clunk += 0.6 * lp(noise(0.6), 900) * env_exp(0.6, 0.02, 0.0005)
    put(out, slide, clunk, clunk_g)
    return norm(out)


def s_hatch_open():
    """the heavy door swings up on its hinges and lands open against its stop"""
    out = np.zeros(int(1.8 * SR))
    put(out, 0.0, s_creak(0.5, 70, 120, 0.45), 0.6)
    put(out, 0.05, s_whoosh(0.5, 250, 900), 0.25)
    put(out, 0.52, s_clang(118, 1.3, 0.8), 0.55)
    put(out, 0.52, s_thud(0.9), 0.35)
    return norm(out)


def s_door_open():
    """after the storm: the bolts are back, the hinges groan, the door swings open"""
    out = np.zeros(int(2.0 * SR))
    put(out, 0.0, s_creak(0.75, 55, 105, 0.4), 0.7)
    put(out, 0.08, s_whoosh(0.7, 220, 800), 0.2)
    put(out, 0.62, s_clang(120, 1.2, 0.7), 0.4)
    return norm(out)


def s_slam():
    """the door slammed shut over their heads: a big metallic boom in the stairwell"""
    out = np.zeros(int(3.0 * SR))
    put(out, 0.0, s_clang(78, 2.8, 1.0), 1.0)
    put(out, 0.0, s_thud(1.6), 0.9)
    put(out, 0.0, hp(noise(0.05), 2000) * np.exp(-tt(0.05) / 0.004), 0.5)
    return norm(out)


def s_vent_pop():
    """a pipe shoots up through the roof: a quick scrape and a hollow ring"""
    out = np.zeros(int(1.2 * SR))
    d = 0.14
    put(out, 0.0, bp(noise(d), 900, 5000) * np.linspace(0.3, 1, int(d * SR)) ** 2, 0.35)
    f0 = rng.uniform(560, 680)
    ring = modes(1.0, [(f0, 1.0, 0.3), (f0 * 2.76, 0.5, 0.18), (f0 * 5.4, 0.25, 0.08)]) + 0.4 * hp(noise(1.0), 3000) * env_exp(1.0, 0.003, 0.0002)
    put(out, d, ring, 0.8)
    put(out, d, s_thud(0.5)[: int(0.3 * SR)], 0.25)
    return norm(out)


def s_cap():
    """the angled cap snapping onto the pipe"""
    out = np.zeros(int(0.6 * SR))
    put(out, 0.0, s_clink(rng.uniform(1300, 1700)), 0.7)
    put(out, 0.035, s_tick(0.8), 0.6)
    return norm(out)


def s_bits(d=0.9, n=14):
    """bits of debris rattling onto the vent caps and bouncing off"""
    out = np.zeros(int((d + 0.2) * SR))
    for _ in range(n):
        y = modes(0.12, [(rng.uniform(1800, 3200), 1.0, 0.02), (rng.uniform(4000, 6000), 0.5, 0.01)])
        put(out, rng.uniform(0, d), y, rng.uniform(0.2, 1.0))
    return norm(out)


def s_air(d):
    """fresh air flowing in through the vent pipes: a soft breathy rush with pipe tones"""
    def mag(ft, f):
        u = np.clip(ft / d, 0, 1)
        env = smooth01(u, 0, 0.25) * (1 - smooth01(u, 0.7, 0.3))
        base = 1 / (1 + (f / 2500.0) ** 2) * (f > 120)
        pipe = sum(np.exp(-0.5 * ((f - fr) / (fr * 0.06)) ** 2) * a for fr, a in [(185, 1.4), (370, 1.0), (555, 0.6), (740, 0.35)])
        breath = 1 + 0.3 * np.sin(2 * np.pi * 0.7 * ft)
        return (base + 0.6 * pipe)[:, None] * (env * breath)[None, :]

    return norm(shaped_noise(d, mag, 515))


def s_bench():
    out = np.zeros(int(0.8 * SR))
    put(out, 0.0, s_knock(0.55), 0.8)
    put(out, 0.0, s_thud(0.7), 0.6)
    put(out, 0.06, s_knock(0.7), 0.3)
    return norm(out)


def s_shelf():
    """steel shelving dropping into place: a rattling clatter"""
    out = np.zeros(int(1.2 * SR))
    for k in range(6):
        put(out, 0.02 * k + 0.015 * rng.uniform(), s_clank(rng.uniform(380, 720), 0.6), 1.0 - 0.12 * k)
    put(out, 0.0, s_thud(0.6), 0.5)
    return norm(out)


def s_glass(f0=None):
    """a bottle clinking: a bright glassy ping"""
    f0 = f0 or rng.uniform(1900, 2900)
    y = modes(0.5, [(f0, 1.0, 0.16), (f0 * 2.32, 0.5, 0.08), (f0 * 4.1, 0.25, 0.04)])
    return norm(y + 0.2 * hp(noise(0.5), 4000) * env_exp(0.5, 0.002, 0.0002))


def s_bottles():
    out = np.zeros(int(0.9 * SR))
    for k in range(6):
        put(out, 0.035 * k + 0.02 * rng.uniform(), s_glass(), 1.0 - 0.1 * k)
    put(out, 0.0, s_knock(0.9), 0.25)
    return norm(out)


def s_cans():
    out = np.zeros(int(0.7 * SR))
    for k in range(5):
        put(out, 0.04 * k + 0.02 * rng.uniform(), modes(0.25, [(rng.uniform(1100, 1500), 1.0, 0.05), (rng.uniform(2600, 3300), 0.5, 0.03)]), 1.0 - 0.12 * k)
    return norm(out)


def s_plastic(pitch=1.0):
    """a plastic box set down: a hollow tock"""
    d = 0.3
    y = modes(d, [(330 * pitch, 1.0, 0.035), (720 * pitch, 0.6, 0.02), (1250 * pitch, 0.35, 0.012)])
    y += 0.4 * bp(noise(d), 800, 4000) * env_exp(d, 0.005, 0.0005)
    return norm(y)


def s_click():
    """a switch clicking on"""
    d = 0.05
    t = tt(d)
    y = (np.sin(2 * np.pi * 3100 * t) + 0.7 * np.sin(2 * np.pi * 5200 * t)) * np.exp(-t / 0.004)
    y += 0.5 * bp(noise(d), 2500, 9000) * np.exp(-t / 0.003)
    return norm(y)


def s_radio():
    """the battery radio crackles on for a moment: static, a tuning whistle"""
    d = 0.9
    t = tt(d)
    stat = bp(noise(d), 700, 5000) * (0.6 + 0.4 * (rng.uniform(size=len(t)) > 0.97))
    stat += 0.5 * grains(d, 300, 1500, 6000, glen=(0.0005, 0.002))
    whistle = chirp(1300 + 900 * t / d, d) * 0.25
    env = smooth01(t, 0.0, 0.03) * (1 - smooth01(t, 0.55, 0.3))
    return norm((stat + whistle) * env)


def s_bulb_flicker(d=0.85):
    """the lamp flickering and dying: electric buzz chopped on and off, then a tink"""
    t = tt(d)
    on = (np.sin(t * 47) > 0.2).astype(float)
    on = lp(on, 300)
    buzz = sum(np.sin(2 * np.pi * 100 * h * t) / h for h in range(1, 9)) * 0.5 + 0.4 * bp(noise(d), 2000, 7000)
    y = norm(buzz * on)
    put(y, d - 0.05, s_tick(1.3), 0.5)
    return norm(y)


def s_thunder_far(d=4.5, bright=170):
    """distant thunder rolling"""
    t = tt(d)
    y = lp(brown(d), bright, 4)
    env = np.zeros(len(t))
    for _ in range(5):
        c, w = rng.uniform(0.08, 0.7) * d, rng.uniform(0.15, 0.6)
        env += rng.uniform(0.4, 1.0) * np.exp(-((t - c) / w) ** 2)
    env *= np.minimum(t / 0.2, 1) * np.clip((d - t) / 1.0, 0, 1)
    return norm(y * env)


def s_thunder_crack(d=4.0):
    """a close thunderclap: a tearing crack and a huge rolling boom"""
    t = tt(d)
    crack = hp(noise(d), 900) * (np.exp(-t / 0.05) + 0.4 * np.exp(-((t - 0.12) / 0.06) ** 2)) * (0.5 + 0.5 * (rng.uniform(size=len(t)) > 0.6))
    boom = lp(brown(d), 220, 4) * (np.minimum(t / 0.05, 1) * np.exp(-t / 1.3)) * (1 + 0.5 * np.sin(2 * np.pi * 1.3 * t))
    return norm(norm(crack) * 0.6 + norm(boom))


def s_board_crash():
    """a fence board ripped off and smashing into things"""
    out = np.zeros(int(1.0 * SR))
    put(out, 0.0, bp(noise(0.08), 900, 6000) * np.exp(-tt(0.08) / 0.015), 0.7)
    put(out, 0.0, s_knock(rng.uniform(0.6, 0.9)), 1.0)
    for k in range(int(rng.integers(2, 5))):
        put(out, 0.1 + 0.12 * k + 0.05 * rng.uniform(), s_knock(rng.uniform(0.8, 1.6)), 0.6 / (k + 1))
    return norm(out)


def s_sheet():
    """a corrugated roof sheet tearing off: a screech, a wobbling flap, a crash"""
    d = 1.8
    t = tt(d)
    out = np.zeros(int(d * SR))
    screech = chirp(900 + 500 * np.sin(2 * np.pi * 3 * t[: int(0.4 * SR)]), 0.4) * arch(0.4, 0.8)
    screech += 0.4 * bp(noise(0.4), 2000, 7000) * arch(0.4)
    put(out, 0.0, screech, 0.5)
    wob = bp(noise(1.0), 120, 900) * (0.5 + 0.5 * np.sin(2 * np.pi * 7 * tt(1.0) + 3 * np.sin(2 * np.pi * 1.3 * tt(1.0)))) * arch(1.0, 0.5)
    put(out, 0.3, wob, 0.8)
    put(out, 1.1, s_clank(rng.uniform(160, 260), 0.7), 0.9)
    put(out, 1.13, s_clank(rng.uniform(300, 500), 0.6), 0.5)
    return norm(out)


def s_limb():
    """a big branch tearing off the tree: splintering crack, a rush of leaves"""
    d = 1.6
    t = tt(d)
    crackle = grains(0.35, 2500, 800, 7000, glen=(0.0006, 0.003), shape=lambda u: 1 - u)
    out = np.zeros(int(d * SR))
    put(out, 0.0, crackle, 0.7)
    put(out, 0.3, bp(noise(0.06), 400, 5000) * np.exp(-tt(0.06) / 0.012), 1.0)
    put(out, 0.3, modes(0.4, [(160, 1.0, 0.08), (290, 0.6, 0.05)]), 0.7)
    leaves = bp(noise(1.2), 2500, 11000) * arch(1.2, 0.7)
    put(out, 0.35, leaves, 0.35)
    return norm(out)


def s_tile():
    """a roof tile smashing: a ceramic clack, sometimes shattering"""
    d = 0.4
    f0 = rng.uniform(1500, 2600)
    y = modes(d, [(f0, 1.0, 0.03), (f0 * 1.71, 0.7, 0.02), (f0 * 2.63, 0.4, 0.012)])
    y += 0.6 * bp(noise(d), 2000, 9000) * env_exp(d, 0.01, 0.0003)
    if rng.uniform() < 0.4:
        y += 0.8 * grains(d, 900, 2500, 10000, glen=(0.0006, 0.003), shape=lambda u: np.exp(-6 * u))
    return norm(y)


def s_gate_bang():
    out = np.zeros(int(0.6 * SR))
    put(out, 0.0, s_knock(0.5), 1.0)
    put(out, 0.0, s_thud(0.5)[: int(0.3 * SR)], 0.4)
    put(out, 0.02, s_clink(rng.uniform(700, 900)), 0.2)  # the latch
    return norm(out)


def s_flyby(d=None):
    """debris whipping past"""
    d = d or rng.uniform(0.25, 0.6)
    lo = rng.uniform(300, 700)
    return s_whoosh(d, lo, lo * rng.uniform(2.5, 4.5), 1.6)


def s_shovel_land():
    out = np.zeros(int(0.8 * SR))
    put(out, 0.0, s_step(0.0, 1.4), 0.6)
    put(out, 0.01, s_clank(rng.uniform(700, 900), 0.6), 0.35)
    return norm(out)


def s_shake(d=0.85):
    """the dog shaking off the dust: fur and ears flapping, a tag jingling"""
    t = tt(d)
    flap = bp(noise(d), 400, 3000) * (0.5 + 0.5 * np.sin(2 * np.pi * 12 * t)) ** 2 * (1 - t / d)
    out = norm(flap)
    for k in range(5):
        put(out, 0.08 + 0.16 * k, s_glass(rng.uniform(3500, 4500)), 0.15 * (1 - k / 5))
    return norm(out)


def s_drip():
    d = 0.12
    t = tt(d)
    f = rng.uniform(900, 1600) * (1 + 0.8 * t / d)
    return norm(chirp(f, d) * np.exp(-t / 0.025) * np.minimum(t / 0.002, 1))


def s_strain(d=1.4):
    """the wind heaving at the shelter: a deep groan of steel and concrete, nothing gives"""
    out = np.zeros(int((d + 0.5) * SR))
    put(out, 0.0, s_creak(d, 28, 46, 0.25), 0.8)
    put(out, 0.0, lp(brown(d), 120, 4) * arch(d, 0.8), 0.6)
    put(out, d - 0.1, s_thud(0.8), 0.3)
    return norm(out)


def s_pulse():
    """the open stairwell 'pulses' (the weak point): a soft low throb"""
    d = 0.6
    t = tt(d)
    return norm(np.sin(2 * np.pi * 58 * t) * arch(d, 1.5) + 0.3 * np.sin(2 * np.pi * 116 * t) * arch(d, 2))


def birds(d, seed=3):
    """birdsong: chirps, little trills and whistles, far off, left and right"""
    r = np.random.default_rng(seed)
    out = np.zeros((2, int(d * SR)))
    t0 = 0.3
    while t0 < d:
        ch = int(r.integers(0, 2))
        kind = r.uniform()
        f = r.uniform(2600, 4300)
        if kind < 0.5:  # chirp phrase
            for k in range(int(r.integers(2, 5))):
                cd = r.uniform(0.05, 0.11)
                t = tt(cd)
                y = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.35 * np.sin(np.pi * t / cd) * (1 if k % 2 else -0.6))) / SR) * arch(cd, 1.2)
                put(out[ch], t0 + k * (cd + 0.04), y, 0.7)
                put(out[1 - ch], t0 + k * (cd + 0.04) + 0.01, y, 0.2)
        elif kind < 0.8:  # trill
            n = int(r.integers(6, 12))
            for k in range(n):
                cd = 0.035
                t = tt(cd)
                y = np.sin(2 * np.pi * np.cumsum(f * (1.1 - 0.2 * t / cd)) / SR) * arch(cd, 1.0)
                put(out[ch], t0 + k * 0.05, y, 0.45)
                put(out[1 - ch], t0 + k * 0.05 + 0.01, y, 0.12)
        else:  # a slow two-note whistle
            for k, ff in enumerate([f * 0.7, f * 0.55]):
                cd = 0.28
                t = tt(cd)
                y = np.sin(2 * np.pi * np.cumsum(ff * (1 + 0.04 * np.sin(2 * np.pi * 6 * t))) / SR) * arch(cd, 0.8)
                put(out[ch], t0 + k * 0.33, y, 0.4)
                put(out[1 - ch], t0 + k * 0.33 + 0.012, y, 0.1)
        t0 += r.uniform(0.9, 2.3)
    return out / (np.max(np.abs(out)) + 1e-9)


VARY = {"dig", "toss", "step", "paw", "clink", "cage", "knock", "tile", "board_crash", "flyby", "sheet", "drip", "glass", "bits", "tick"}
CACHE = {}


def sfx(name, *args, **kw):
    key = (name, args, tuple(sorted(kw.items())))
    if name in VARY:
        return globals()["s_" + name](*args, **kw)
    if key not in CACHE:
        CACHE[key] = globals()["s_" + name](*args, **kw)
    return CACHE[key]


# ---------------------------------------------------------------------------
# cue sheet
# ---------------------------------------------------------------------------
CUES = []  # (time, sound, gain dB, pan or (from, to) sweep, ducked under the voice?, reverb send)


def cue(t, snd, gain_db, x=None, p=None, duck=True, verb=0.0):
    """x: world x of the source (panned by where it sits on screen at t); duck=False
    keeps a hit at full level even under the narration; verb: reverb send (the stairwell)"""
    if p is None:
        p = pan(x, t) if x is not None else 0.0
    CUES.append((t, snd, gain_db, p, duck, verb))


def ease_travel(u, a):
    if a <= 0:
        return u
    v = 1 / (1 - a)
    if u < a:
        return v * u * u / (2 * a)
    if u > 1 - a:
        return 1 - v * (1 - u) * (1 - u) / (2 * a)
    return v * a / 2 + v * (u - a)


def path_at(pts, s):
    for a, b in zip(pts, pts[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if s <= L:
            k = s / L if L else 0
            return a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k
        s -= L
    return pts[-1]


def surface(x, z):
    if -2.6 < z < 0.05 and -1.8 < x < 4.2:
        if x < 1.6:
            return "floor"
        if x <= 3.9 and z > -1.25:
            return "stair"
        return "slab"
    return "grass"


def walk(t0, t1, pts, stride, s=1.0, ease=0.18, gain=-20, run=False, dog=False):
    """footsteps along a path, on the beat of the animation's own feet (rig.footAt
    lands a foot every half stride of eased travel)"""
    L = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))
    half = stride * s / (4 if dog else 2)
    ts_ = np.linspace(t0, t1, 600)
    d = np.array([ease_travel((t - t0) / (t1 - t0), ease) * L for t in ts_])
    for k in range(1, int(L / half) + 1):
        i = int(np.searchsorted(d, k * half))
        if i >= len(ts_):
            break
        x, z = path_at(pts, k * half)
        srf = surface(x, z)
        hard = srf != "grass"
        far = -min(9.0, 9.0 * max(0.0, -z - 1.0) / 8.0)
        g = gain + 3 + far + (2 if run else 0) + rng.uniform(-1.5, 1.5)
        snd = sfx("paw", 1.0 if hard else 0.0) if dog else sfx("step", 1.0 if hard else 0.0, 1.25 if run else 1.0)
        cue(ts_[i], snd, g + (-3 if dog else 0), x, verb=0.25 if srf == "stair" else 0.1 if hard else 0.0)


SEAT = {"w": -0.1, "wo": -0.62, "k": -1.12}
SEAT_Z = -2.3 + 0.24 + 0.35
STEP6 = 3.9 - 7 * 0.24 + 0.12
GATE_P = (6.5, -8.6)


def fam_path(lane, end):
    return [(GATE_P[0] + lane, GATE_P[1] - 0.6), (GATE_P[0] + lane, GATE_P[1] + 0.4), (5.3 + lane * 0.5, -3.6), (4.55, -1.1), end]


def build_cues():
    # 1 - calm; the funnel forms far away; "10 MIN"; the shovel
    cue(T["label10"], sfx("label"), -15, duck=False)
    cue(T["label10"] + 0.05, sfx("tick", 1.0), -21, 0.2, duck=False)
    cue(T["label10"] + 0.55, sfx("tick", 0.82), -23, 0.2, duck=False)
    for k, tt0 in enumerate([1.05, 1.4, 1.7, 4.15, 4.42, 6.4, 6.72, 7.05]):
        cue(tt0, sfx("step", 0.0), -27, 3.3)
    cue(4.62, sfx("dig"), -21, 3.9)  # the shovel pulled out of the lawn
    cue(5.15, sfx("whoosh", 0.35, 500, 1800), -26, 3.6)
    # 2 - fast digging: the blade bites, the soil flies onto the pile
    dig = WD["DIG_T"]
    prev = T["dig0"] - 0.3
    for s in dig:
        bite = prev + 0.55 * (s - prev)
        x = 3.05 + (-0.75 - 3.05) * float(smooth01(s, 7.7, 4.6))
        cue(bite, sfx("dig"), -12, x)
        cue(s + 0.32, sfx("toss"), -18, WD["PILE"]["x"])
        prev = s
    cue(T["labelUG"], sfx("label"), -15, duck=False)
    cue(13.3, sfx("whoosh", 0.5, 400, 1500), -24, 0.5)
    cue(14.55, sfx("shovel_land"), -20, 5.0)
    # 3 - the rebar cages, the pour, the roof slab, the backfill
    for i in range(6):
        cue(T["rebar0"] + i * T["rebarGap"] + 0.06, sfx("cage"), -12, [-0.4, -1.6, 0.0, 1.45, 2.8, 4.0][i])
    cue(T["slab"] - 0.45 + 0.06, sfx("cage"), -12, -0.4)
    cue(T["pour0"] - 0.1, sfx("pour", T["pour1"] - T["pour0"] + 1.0), -9, None, p=0.0)
    cue(T["label30"] + 0.12, sfx("label"), -15, duck=False)
    cue(T["slab"] - 0.15, sfx("whoosh", 0.3, 250, 900), -22, -0.2)
    cue(T["slab"] + 0.12, sfx("slab"), -8, -0.2, duck=False)
    cue(T["barsGlow"], sfx("clink", 1250.0), -24, -1.2)
    cue(T["backfill0"], sfx("crumble", 1.4), -19, 5.2)
    cue(T["backfill0"] + 0.5, sfx("crumble", 0.9), -22, 4.6)
    # 4 - flying debris (leaves and twigs whipping past); the plank test
    for k, tt0 in enumerate([23.4, 24.25, 24.9, 25.8, 26.45]):
        p0 = -0.8 + 0.1 * k
        cue(tt0, sfx("flyby"), -25 + 1.0 * k, None, p=(p0, p0 + 1.1))
    cue(T["plank0"], sfx("plank_flight", T["hit"] - T["plank0"]), -10, None, p=(-0.75, -0.15), duck=False)
    cue(T["label160"], sfx("label"), -16, duck=False)
    cue(T["hit"], sfx("smash"), -2, -1.6, duck=False, verb=0.12)
    # 5 - the chair lifts; the anchors drill down; the wind heaves, nothing moves
    cue(T["lift0"], sfx("chair"), -15, -2.6)
    cue(T["drill0"] - 0.1, sfx("motor", T["drill1"] - T["drill0"] + 0.4), -14, 0.5)
    for i, x in enumerate(WD["ANCHORS"]):
        t0 = T["drill0"] + i * T["drillGap"]
        cue(t0, sfx("auger", 1.15), -11, x)
        cue(t0 + 1.12, sfx("clink", 520.0), -24, x)
    cue(T["labelAnchor"] + 0.15, sfx("label"), -15, duck=False)
    cue(T["uplift0"] - 0.1, sfx("whoosh", 1.4, 200, 900, 0.8), -18, None, p=0.0)
    cue(T["uplift0"], sfx("strain", T["uplift1"] - T["uplift0"]), -11, 0.9)
    # 6 - the weak point, the door, the bolts
    walk(38.4, 40.8, [(0.5, -1.25), (1.0, -0.62), (1.75, -0.6), (STEP6, -0.6)], 1.2, gain=-22)
    for k in range(2):
        cue(T["weak0"] + 0.15 + 0.7 * k, sfx("pulse"), -22, 3.0)
    cue(T["doorShut"] - 0.3, sfx("door_drop"), -6, 3.05, duck=False, verb=0.2)  # whoosh as it drops, clang as it lands
    for k, b in enumerate(T["bolts"]):
        cue(b - 0.11, sfx("bolt", 0.11, 1.0 - 0.04 * k), -6, 3.05 + [-0.55, 0, 0.55][k], duck=False, verb=0.25)
    # 7 - inside: dark and stuffy; the vents; air
    walk(44.55, 46.0, [(STEP6, -0.6), (1.75, -0.62), (1.0, -0.9), (0.25, -1.2)], 1.2, gain=-23)
    cue(T["stuffy0"], sfx("click"), -26, -0.15)
    for i in range(2):
        cue(T["vent"][i] - 0.04, sfx("vent_pop"), -12, [-0.85, 0.75][i])
        cue(T["cap"][i] + 0.08, sfx("cap"), -13, [-0.85, 0.75][i])
    cue(T["bounce"] - 0.5, sfx("bits", 1.0, 16), -15, 0.0)
    cue(T["air0"] - 0.2, sfx("air", T["air1"] - T["air0"] + 1.6), -10, None, p=0.0)
    # 8 - benches, shelves, supplies
    # things pop in with an overshoot: they touch down about 0.1 s after they appear
    cue(T["bench"] + 0.13, sfx("bench"), -12, -0.6)
    walk(T["bench"] + 0.3, T["bench"] + 1.0, [(0.25, -1.2), (SEAT["k"], SEAT_Z)], 1.0, gain=-25)
    cue(T["bench"] + 1.05, sfx("creak", 0.4, 140, 220, 0.8), -24, SEAT["k"])
    cue(T["shelf"] + 0.13, sfx("shelf"), -12, 0.8)
    cue(T["shelf"] + 0.38, sfx("cans"), -18, 0.6)
    cue(T["water"] + 0.1, sfx("bottles"), -10, 0.5)
    cue(T["light"] + 0.1, sfx("plastic", 1.3), -12, 0.55)
    cue(T["aid"] + 0.1, sfx("plastic", 0.8), -12, 1.05)
    cue(T["aid"] + 0.15, sfx("thud", 0.4), -24, 1.05)
    cue(T["radio"] + 0.1, sfx("plastic", 1.0), -12, 0.8)
    cue(T["radio"] + 0.22, sfx("radio"), -22, 0.8)
    for k in ("water", "light", "radio"):
        cue(T[k] + 0.05, sfx("label"), -19, duck=False)
    # 9 - the storm breaks; up and out; the family runs in; down; the door; the bolts
    cue(T["storm"] - 0.05, sfx("thunder_crack"), -8, -0.5, duck=False)
    walk(T["workerUp"], T["hatchOpen"], [(SEAT["k"], SEAT_Z), (1.0, -0.62), (1.75, -0.6), (STEP6, -0.6)], 1.5, ease=0.1, gain=-19, run=True)
    for k in range(3):
        cue(T["hatchOpen"] - 0.35 + k * 0.05, sfx("bolt", 0.07, 1.15, 0.6), -18, 3.05 + [-0.55, 0, 0.55][k], verb=0.2)
    cue(T["hatchOpen"], sfx("hatch_open"), -8, 3.05, duck=False)
    walk(T["hatchOpen"] + 0.35, 60.55, [(STEP6, -0.6), (3.55, -0.6), (4.55, -0.82)], 1.0, ease=0.15, gain=-19)
    cue(T["run0"] - 0.3, sfx("creak", 0.45, 200, 320, 0.8), -22, 6.6)  # the gate swings open...
    cue(T["run0"] + 0.15, sfx("gate_bang"), -18, 6.6)  # ...and bangs against the fence
    for who, lane, r0, r1, d1, sc in [("woman", -0.25, T["run0"] + 0.05, 62.25, 64.5, 0.93), ("kid", 0.25, T["run0"], 61.9, 63.9, 0.7)]:
        walk(r0, r1, fam_path(lane, (4.35, -0.62)), 1.75, s=sc, ease=0.12, gain=-19, run=True)
        walk(r1, d1, [(4.35, -0.62), (3.95, -0.6), (3.9 - 4 * 0.24, -0.6), (1.8, -0.62), (1.0, -0.9), (SEAT["wo" if who == "woman" else "k"], SEAT_Z)], 0.95, s=sc, ease=0.08, gain=-20)
    walk(T["run0"] + 0.1, 61.55, fam_path(0.45, (4.3, -0.55)), 1.0, ease=0.1, gain=-19, run=True, dog=True)
    walk(61.55, 63.0, [(4.3, -0.55), (3.95, -0.55), (3.9 - 5 * 0.24, -0.55), (1.8, -0.6), (0.8, -1.2), (-0.85, -1.62)], 0.9, ease=0.08, gain=-19, dog=True)
    walk(62.7, 64.6, [(4.55, -0.82), (3.95, -0.6), (STEP6, -0.6), (1.75, -0.62), (1.0, -0.9)], 1.0, ease=0.1, gain=-19)
    cue(T["doorClose"], sfx("whoosh", 0.32, 200, 800), -18, 3.05)
    cue(T["doorClose"] + 0.32, sfx("slam"), -3, 3.05, duck=False, verb=0.35)
    for k in range(3):
        cue(T["lockAll"] + 0.09 * k - 0.06, sfx("bolt", 0.06, 1.0 - 0.03 * k), -5, 3.05 + [-0.55, 0, 0.55][k], duck=False, verb=0.35)
    walk(64.6, 65.0, [(1.0, -0.9), (SEAT["w"], SEAT_Z)], 1.0, ease=0.3, gain=-24)
    # the tornado passes over: the lamp dies, the torch, the debris
    cue(T["hitT"], sfx("bulb_flicker"), -20, -0.15, duck=False)
    cue(T["torch"], sfx("click"), -14, -0.2, duck=False)
    cue(T["label300"], sfx("label"), -13, duck=False)
    h = T["hitT"]
    r = np.random.default_rng(64)
    for k in range(3):
        cue(h + 0.4 + 0.9 * k, sfx("sheet"), -11, None, p=(-0.9, 0.2), duck=False)
    for tb in (h + 1.6, h + 3.4):
        cue(tb - 0.3, sfx("limb"), -10, 5.4, duck=False)
    for _ in range(11):
        cue(h + 0.9 + r.uniform(0, 4.6) + 0.3, sfx("board_crash"), -13 + r.uniform(-3, 2), None, p=float(r.uniform(-0.6, 0.8)))
    for _ in range(46):
        tt0 = T["tiles0"] + r.uniform(0, 5.2) + 0.25
        cue(tt0, sfx("tile"), -19 + r.uniform(-5, 2), None, p=float(r.uniform(-0.5, 0.7)))
    for _ in range(30):
        tt0 = h - 0.8 + r.uniform(0, T["passEnd"] - h + 0.5)
        p0 = float(r.uniform(-1, -0.2))
        cue(tt0, sfx("flyby"), -15 + r.uniform(-5, 2), None, p=(p0, min(1.0, p0 + r.uniform(0.6, 1.4))))
    # the gate banging in the gusts
    k = 0
    while True:
        tb = (math.pi / 2 + 2 * math.pi * k) / 7.3
        k += 1
        if tb > T["passEnd"]:
            break
        if sampled("engulf", tb) > 0.5 and r.uniform() < 0.6:
            cue(tb, sfx("gate_bang"), -22, None, p=0.7)
    # 10 - silence; the bolts back; the door opens; out onto the lawn; the dog shakes
    for k in range(3):
        cue(T["unbolt"] + 0.12 * k - 0.05, sfx("bolt", 0.12, 1.12, 0.55), -11, 3.05 + [-0.55, 0, 0.55][k], verb=0.25)
    walk(T["unbolt"] - 0.9, T["unbolt"], [(SEAT["w"], SEAT_Z), (1.0, -0.62), (1.75, -0.6), (STEP6, -0.6)], 1.3, ease=0.15, gain=-24)
    cue(T["doorOpen"], sfx("door_open"), -10, 3.05)
    walk(T["out"][0], T["out"][0] + 2.6, [(STEP6, -0.6), (3.6, -0.6), (4.4, -0.65), (4.55, -1.9), (3.4, -2.6), (1.3, -3.15)], 1.05, ease=0.15, gain=-21)
    for (o0, o1, lawn, sc, seat) in [(T["out"][1], T["out"][1] + 3.0, (0.45, -3.55), 0.93, "wo"), (T["out"][2], T["out"][2] + 2.9, (1.85, -2.95), 0.7, "k")]:
        walk(o0, o1, [(SEAT[seat], SEAT_Z), (1.0, -0.62), (1.8, -0.6), (3.6, -0.6), (4.4, -0.66), (4.55, -1.95), (3.4, -2.65), lawn], 1.0, s=sc, ease=0.12, gain=-22)
    walk(76.6, 77.75, [(-0.85, -1.62), (0.8, -1.0), (1.8, -0.6), (3.7, -0.55), (4.4, -0.62), (4.5, -1.9), (3.2, -2.55), (-0.3, -2.95)], 0.9, ease=0.1, gain=-21, dog=True)
    cue(T["shake"], sfx("shake"), -17, -0.3)


# ---------------------------------------------------------------------------
# the weather beds: wind, the tornado's roar, rain, birds, drips
# ---------------------------------------------------------------------------
def wind_bed():
    """howling wind following WORLD.wind: gusts, whistling resonances, brighter as it grows;
    muffled while we are down in the stuffy shelter"""
    out = []
    for ch in range(2):
        def mag(ft, f, ch=ch):
            w = np.interp(ft, WT, WD["wind"])
            gust = np.clip(1 + 0.45 * slow_noise(ft, 0.3, 11 + ch) + 0.2 * slow_noise(ft, 1.3, 21 + ch), 0.25, 2.2)
            lvl = (0.08 + w) ** 1.7 * gust
            fhi = 700 + 5200 * w * np.clip(gust, 0.6, 1.4)
            F = np.maximum(f, 15.0)[:, None]
            base = (F / 250.0) ** -0.45 / (1 + (40.0 / F) ** 4) / (1 + (F / fhi[None, :]) ** 2)
            c1 = 330 * 2 ** (0.9 * slow_noise(ft, 0.18, 31 + ch) + 0.6 * w)
            howl = np.exp(-0.5 * (np.log2(F / c1[None, :]) / 0.06) ** 2) + 0.6 * np.exp(-0.5 * (np.log2(F / (1.93 * c1[None, :])) / 0.05) ** 2)
            howl *= (0.5 + 2.0 * w ** 1.5 * np.clip(gust - 0.7, 0, 1.5))[None, :]
            inside = smooth01(ft, T["stuffy0"] - 0.6, 0.6) * (1 - smooth01(ft, T["air0"], 1.2))
            muffle = 1 - 0.75 * inside[None, :] * (F > 500)
            return (base + 0.55 * howl) * lvl[None, :] * muffle

        out.append(shaped_noise(DUR, mag, 900 + ch))
    st = np.stack(out)
    return st / (np.max(np.abs(st)) + 1e-9)


def roar_bed():
    """the tornado: a far-off low rumble that grows into a dense freight-train roar as it
    comes in (WORLD.tornadoD), brightest right over the yard, then gone with it"""
    out = []
    for ch in range(2):
        def mag(ft, f, ch=ch):
            dd = np.interp(ft, WT, WD["tornadoD"])
            form = smooth01(ft, T["funnel0"], T["funnel1"] - T["funnel0"])
            p = np.clip((math.log(6200) - np.log(np.maximum(dd, 20))) / (math.log(6200) - math.log(35)), 0, 1)
            gone = 1 - smooth01(ft, T["passEnd"] - 0.6, 2.0)
            lvl_db = -10 + 10 * p
            lvl = 10 ** (lvl_db / 20) * form * gone * (0.35 + 0.65 * smooth01(ft, 0, 4.0))
            fc = 170 * 2 ** (4.7 * p ** 1.2)
            F = np.maximum(f, 15.0)[:, None]
            spec = 1 / (1 + (F / fc[None, :]) ** 2) / (1 + (25.0 / F) ** 4) * (1 + 2.2 * np.exp(-0.5 * (np.log2(F / 75.0) / 1.0) ** 2))
            turb = np.exp(0.9 * band_field(ft, f, 4.0, 300 + ch))
            pulse = 1 + 0.3 * p * np.sin(2 * np.pi * 0.9 * ft + slow_noise(ft, 0.2, 77))
            return spec * turb * (lvl * pulse)[None, :]

        out.append(shaped_noise(DUR, mag, 1300 + ch))
    st = np.stack(out)
    return st / (np.max(np.abs(st)) + 1e-9)


def rain_bed():
    """the sideways storm rain: a dense hiss with heavy drops, while it lasts"""
    k0, k1 = T["storm"], T["passEnd"] + 0.2
    out = []
    for ch in range(2):
        def mag(ft, f):
            on = smooth01(ft, k0 - 0.3, 1.0) * (1 - smooth01(ft, k1 - 0.6, 1.2))
            w = np.interp(ft, WT, WD["wind"])
            F = np.maximum(f, 15.0)[:, None]
            spec = (F > 500) * (F / 3000.0) ** -0.3 / (1 + (F / 11000.0) ** 2)
            return spec * (on * (0.6 + 0.4 * w) * (1 + 0.25 * slow_noise(ft, 2.0, 41 + ch)))[None, :]

        hiss = shaped_noise(DUR, mag, 1700 + ch)
        drops = grains(DUR, 220, 400, 3000, glen=(0.004, 0.012))
        t = np.arange(N) / SR
        drops *= smooth01(t, k0, 1.0) * (1 - smooth01(t, k1 - 0.6, 1.2))
        out.append(norm(hiss) + 0.25 * norm(drops))
    st = np.stack(out)
    return st / (np.max(np.abs(st)) + 1e-9)


def drips_bed():
    """after the storm: water dripping off the fence and the door"""
    out = np.zeros((2, N))
    r = np.random.default_rng(91)
    tt0 = T["calm0"] + 0.8
    while tt0 < DUR - 0.3:
        ch = int(r.integers(0, 2))
        y = sfx("drip")
        put(out[ch], tt0, y, r.uniform(0.3, 1.0))
        put(out[1 - ch], tt0 + 0.004, y, 0.3)
        tt0 += r.uniform(0.25, 1.1)
    t = np.arange(N) / SR
    return out * (1 - 0.6 * smooth01(t, 76.0, 3.0))


# ---------------------------------------------------------------------------
# music: tense and cinematic in D minor - a low drone and a heartbeat at first, then a
# pulsing ostinato, taikos, low brass "braams", a ticking clock and a long riser as
# the tornado closes in; cut dead when the bolts slam (only the wind); a dark low
# drone while it passes over; soft and calm in D major at the end
# ---------------------------------------------------------------------------
NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def mf(name):
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[n] + 12 * (o + 1) - 69) / 12)


def adsr(d, a, r, curve=1.0):
    t = tt(d)
    e = np.minimum(1, t / max(a, 1e-3)) ** curve
    e *= np.clip((d - t) / max(r, 1e-3), 0, 1)
    return e


def saw_voice(f, d, cutoff, detune=0.0, vib=0.0, seed=None):
    """band-limited saw by additive synthesis, its harmonics rolled off at cutoff (4-pole)"""
    t = tt(d)
    r = np.random.default_rng(seed) if seed is not None else rng
    fv = f * 2 ** (detune / 1200) * (1 + vib * np.sin(2 * np.pi * 5.3 * t + r.uniform(0, 6.28)))
    ph = 2 * np.pi * np.cumsum(fv) / SR
    nh = int(max(1, min(48, cutoff * 2.5 / f, (SR / 2 - 500) / f)))
    y = np.zeros(len(t))
    for h in range(1, nh + 1):
        y += np.sin(h * ph + r.uniform(0, 6.28)) / h / (1 + (h * f / cutoff) ** 4)
    return y


def pad(f, d, cutoff=900, a=0.8, r=1.2, vib=0.002):
    y = sum(saw_voice(f, d, cutoff, dt, vib) for dt in (-9, 0, 8))
    return y * adsr(d, a, r)


def strings(f, d, cutoff=2400, a=1.2, r=1.0, trem=0.0):
    t = tt(d)
    y = sum(saw_voice(f, d, cutoff, dt, 0.004) for dt in (-6, 0, 5, 11))
    if trem:
        y *= 1 - trem * (0.5 + 0.5 * np.sin(2 * np.pi * 11.5 * t))
    return y * adsr(d, a, r)


def pluck(f, d=0.3, bright=1.0):
    """the ostinato: a muted synth pluck (higher harmonics die first)"""
    t = tt(d)
    y = np.zeros(len(t))
    nh = int(min(30, (SR / 2 - 500) / f))
    for h in range(1, nh + 1):
        y += np.sin(2 * np.pi * f * h * t) / h * np.exp(-t * (6 + 1.8 * h / bright))
    return fade(y, 0.002, 0.03)


def taiko(vel=1.0, f0=62):
    d = 1.4
    t = tt(d)
    y = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 0.5 * np.exp(-t / 0.025))) / SR) * np.exp(-t / 0.42)
    y += 0.5 * np.sin(2 * np.pi * np.cumsum(f0 * 1.58 * (1 + 0.3 * np.exp(-t / 0.02))) / SR) * np.exp(-t / 0.18)
    y += 0.5 * lp(noise(d), 1400) * np.exp(-t / 0.018)
    return y * vel


def heartbeat(vel=1.0):
    out = np.zeros(int(0.8 * SR))
    for dt_, f, g in [(0.0, 52, 1.0), (0.24, 47, 0.7)]:
        d = 0.4
        t = tt(d)
        put(out, dt_, np.sin(2 * np.pi * np.cumsum(f * (1 + 0.4 * np.exp(-t / 0.02))) / SR) * np.exp(-t / 0.09) * np.minimum(t / 0.004, 1), g)
    return out * vel


def braam(f, d=3.2, vel=1.0):
    """low brass blast: the filter flares open, then closes; driven a little"""
    t = tt(d)
    bright = 3 + 22 * np.minimum(t / 0.25, 1) * np.exp(-np.maximum(t - 0.25, 0) / 1.0) + 3
    y = np.zeros(len(t))
    for dt in (-7, 0, 6):
        ph = 2 * np.pi * np.cumsum(f * 2 ** (dt / 1200) * np.ones(len(t))) / SR
        for h in range(1, 40):
            if h * f > SR / 2 - 500:
                break
            y += np.sin(h * ph + rng.uniform(0, 6.28)) / h / (1 + np.exp((h - bright) / 2.0))
    y = np.tanh(1.6 * y / (np.max(np.abs(y)) + 1e-9))
    return y * adsr(d, 0.06, 1.6, 0.7) * vel


def tick(vel=1.0, f=3100):
    d = 0.05
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.62 * t)) * np.exp(-t / 0.006) * vel


def riser(d):
    t = tt(d)
    u = t / d

    def mag(ft, f):
        uu = np.clip(ft / d, 0, 1)
        fc = 300 * 2 ** (4.5 * uu)
        g = np.exp(-0.5 * (np.log2(np.maximum(f, 20)[:, None] / fc[None, :]) / 0.8) ** 2)
        return g * (uu ** 2.5)[None, :]

    y = norm(shaped_noise(d, mag, 333))
    tone = sum(np.sin(2 * np.pi * np.cumsum(f0 * 2 ** (2.0 * u)) / SR) for f0 in (mf("D3"), mf("A3")))
    return y * 0.8 + 0.25 * tone * u ** 3


def piano(f, d=3.0, vel=1.0):
    """soft felt piano: slightly stretched partials, highs decay first, a little hammer"""
    t = tt(d)
    y = np.zeros(len(t))
    for k in range(1, 9):
        fk = f * k * math.sqrt(1 + 0.0004 * k * k)
        if fk > SR / 2 - 500:
            break
        y += np.sin(2 * np.pi * fk * t) * (0.9 ** k / k ** 0.6) * np.exp(-t / (1.8 / k ** 0.7))
    y += 0.05 * lp(noise(d), 2500) * np.exp(-t / 0.01)
    return fade(y * vel, 0.003, 0.25)


CH = {
    "Dm": ["D", "F", "A"], "Bb": ["A#", "D", "F"], "Gm": ["G", "A#", "D"], "A": ["A", "C#", "E"],
    "D": ["D", "F#", "A"], "Bm": ["B", "D", "F#"], "G": ["G", "B", "D"],
}
BASS = {"Dm": "D2", "Bb": "A#1", "Gm": "G1", "A": "A1", "D": "D2", "Bm": "B1", "G": "G1"}


def chord_notes(ch, octv):
    return [mf(n + str(octv)) for n in CH[ch]]


def build_music():
    """returns a stereo (2, N) score"""
    BAR = T["lockAll"] / 27.0
    BEAT = BAR / 4
    L = np.zeros((2, N + 6 * SR))
    mono = lambda: np.zeros(N + 6 * SR)
    padL, padR, perc, ost, hi, low = mono(), mono(), mono(), mono(), mono(), mono()
    prog = ["Dm"] * 3 + [["Dm", "Dm", "Bb", "Bb", "Gm", "Gm", "A", "A"][(b - 3) % 8] for b in range(3, 27)]
    I = lambda b: min(1.0, 0.2 + 0.8 * (b / 26.0) ** 1.3)  # intensity 0.2 .. 1

    # pads and strings: one chord per two bars
    b = 0
    while b < 27:
        ch = prog[b]
        nb = 2 if b >= 3 else 3
        t0, d = b * BAR, nb * BAR + 1.0
        cut = 500 + 900 * I(b)
        for k, fr in enumerate(chord_notes(ch, 3)):
            v = pad(fr, d, cut, a=1.2 if b == 0 else 0.6, r=1.0) * (0.5 + 0.5 * I(b))
            put(padL, t0, v, 0.22 * (1.1 if k % 2 else 0.9))
            put(padR, t0, v, 0.22 * (0.9 if k % 2 else 1.1))
        put(low, t0, pad(mf(BASS[ch]), d, 260, a=0.8, r=1.0), 0.32 * (0.6 + 0.4 * I(b)))
        if b >= 15:  # strings an octave up; tremolo from bar 21
            for k, fr in enumerate(chord_notes(ch, 4)):
                put(padL if k % 2 else padR, t0, strings(fr, d, 2200 + 1200 * I(b), trem=0.55 if b >= 21 else 0.0), 0.06 * I(b))
        b += nb

    # intro: a glassy high shimmer far above the drone
    for t0, n in [(0.6, "A5"), (3.0, "E6"), (5.2, "D6")]:
        d = 3.4
        t = tt(d)
        put(hi, t0, np.sin(2 * np.pi * mf(n) * t * (1 + 0.002 * np.sin(2 * np.pi * 4.5 * t))) * arch(d, 1.2), 0.03)

    # heartbeat (bars 1 - 8), then the taikos
    for b in range(1, 9):
        put(perc, b * BAR, heartbeat(0.55 + 0.05 * b), 0.55)
    pats = {
        "a": [(0, 1.0), (2, 0.8), (3.5, 0.35)],
        "b": [(0, 1.0), (1.5, 0.5), (2, 0.85), (3, 0.5), (3.5, 0.45)],
        "c": [(0, 1.0), (0.5, 0.4), (1.5, 0.55), (2, 0.9), (2.5, 0.4), (3, 0.6), (3.5, 0.5)],
        "d": [(k * 0.5, 0.75 + 0.25 * (k % 2 == 0)) for k in range(8)],
    }
    for b in range(9, 27):
        pat = pats["a"] if b < 15 else pats["b"] if b < 21 else pats["c"] if b < 25 else pats["d"]
        for bt, v in pat:
            put(perc, b * BAR + bt * BEAT, taiko(v * (0.7 + 0.3 * I(b)), 62 if bt % 2 == 0 else 74), 0.5)
        if b % 4 == 0 and b < 25:  # a fill into the next phrase
            for k in range(4):
                put(perc, b * BAR + (3 + k * 0.25) * BEAT, taiko(0.35 + 0.1 * k, 80), 0.4)
    for k in range(8):  # the last bar: a 16th roll into the cut
        put(perc, 26 * BAR + (2 + k * 0.25) * BEAT, taiko(0.5 + 0.06 * k, 70 + 2 * k), 0.45)

    # the pulsing ostinato: 8ths from bar 3, 16ths from bar 15
    for b in range(3, 27):
        ch = prog[b]
        root, third, fifth = chord_notes(ch, 3)
        seq = [root, root, root * 2, root, fifth, root, third, fifth]
        steps = 8 if b < 15 else 16
        for k in range(steps):
            fr = seq[k % 8] if steps == 8 else seq[(k // 2) % 8] * (2 if k % 4 == 3 else 1)
            accent = 1.0 if k % (steps // 4) == 0 else 0.65
            put(ost, b * BAR + k * BAR / steps, pluck(fr, 0.25 if steps == 8 else 0.16, 0.4 + 1.6 * I(b)), 0.09 * accent * (0.5 + 0.5 * I(b)))

    # the clock ticking (bars 15 - 26)
    for b in range(15, 27):
        for k in range(8):
            put(hi, b * BAR + k * BEAT / 2, tick(0.6 if k % 2 == 0 else 0.4, 3100 if k % 2 == 0 else 2500), 0.05 + 0.03 * I(b))

    # braams on the big moments
    for b in (9, 15, 19, 21, 23, 25):
        ch = prog[b]
        put(low, b * BAR, braam(mf(BASS[ch]) / 2 if mf(BASS[ch]) > 60 else mf(BASS[ch]), 3.4, 0.7 + 0.3 * I(b)), 0.3)

    # the riser into the cut
    rd = T["lockAll"] - 23 * BAR
    put(hi, 23 * BAR, riser(rd), 0.12)

    # everything above stops dead as the bolts slam
    cut = int(T["lockAll"] * SR)
    tail = int(0.04 * SR)
    for x in (padL, padR, perc, ost, hi, low):
        x[cut : cut + tail] *= np.linspace(1, 0, tail)
        x[cut + tail :] = 0

    # under the tornado: a dark low drone and a slow heartbeat (from a moment after the lock)
    g0 = T["lockAll"] + 2.4
    g1 = T["passEnd"] + 0.6
    d = g1 - g0 + 1.8
    for n, g in [("D1", 0.5), ("A1", 0.3), ("D2", 0.25)]:
        put(low, g0, pad(mf(n), d, 220, a=1.5, r=1.8), g * 1.5)
    put(padL, g0, strings(mf("F3"), d, 900, a=2.0, r=1.8), 0.03)
    put(padR, g0, strings(mf("A3"), d, 900, a=2.0, r=1.8), 0.03)
    tb = g0 + 0.3
    while tb < g1 - 0.6:
        put(perc, tb, heartbeat(0.8), 0.7)
        tb += 1.25

    # the calm: D major, warm and slow; a soft piano on top
    c0 = T["clear0"] + 0.6
    seq = [("D", 0.0), ("Bm", 2.1), ("G", 4.2), ("D", 6.0)]
    for i, (ch, dt_) in enumerate(seq):
        d = (seq[i + 1][1] - dt_ if i + 1 < len(seq) else DUR - c0 - dt_) + 1.4
        for k, fr in enumerate(chord_notes(ch, 3)):
            v = pad(fr, d, 1100, a=1.0, r=1.4 if i + 1 < len(seq) else 2.4, vib=0.0015)
            put(padL, c0 + dt_, v, 0.16 * (1.1 if k % 2 else 0.9))
            put(padR, c0 + dt_, v, 0.16 * (0.9 if k % 2 else 1.1))
        put(low, c0 + dt_, pad(mf(BASS[ch]), d, 240, a=1.0, r=1.4), 0.22)
    mel = [("A4", 0.3), ("D5", 0.85), ("F#5", 1.4), ("E5", 2.4), ("D5", 3.0), ("B4", 3.6), ("D5", 4.5), ("G5", 5.1), ("F#5", 6.2), ("A5", 6.9), ("D6", 7.6)]
    for n, dt_ in mel:
        put(hi, c0 + dt_, piano(mf(n), 3.2, 0.9), 0.12)

    end = int(DUR * SR)
    L[0] = padL + 0.8 * perc + ost * 1.0 + hi * 0.9 + low
    L[1] = padR + 0.8 * perc + ost * 0.85 + hi * 1.0 + low
    # a little stereo motion in the ostinato and the ticks
    L[1] += 0.25 * np.roll(ost, int(0.011 * SR)) + 0.2 * np.roll(hi, int(0.007 * SR))
    L = L[:, :end]
    # the hall: a long soft reverb
    ir = make_ir(2.8, 0.02, 4500, 21)
    wet = np.stack([signal.fftconvolve(L[c], ir[c])[:end] for c in range(2)])
    out = L + 0.3 * wet
    # make sure the reverb tail does not leak through the cut either
    t = np.arange(end) / SR
    gap = smooth01(t, T["lockAll"] - 0.02, 0.06) * (1 - smooth01(t, g0 - 0.2, 0.6))
    out *= 1 - gap
    out *= np.minimum(t / 0.8, 1) * (1 - smooth01(t, DUR - 1.2, 1.15))
    return out


def make_ir(rt60, pre, bright, seed):
    r = np.random.default_rng(seed)
    d = rt60 * 1.15
    t = tt(d)
    irs = []
    for _ in range(2):
        lo = lp(r.standard_normal(len(t)), 1500) * np.exp(-6.91 * t / rt60)
        hi_ = hp(r.standard_normal(len(t)), 1500) * np.exp(-6.91 * t / (rt60 * 0.45))
        x = lp(lo + 0.6 * hi_, bright) * np.minimum(t / 0.01, 1)
        x = np.concatenate([np.zeros(int(pre * SR)), x])
        irs.append(x / np.sqrt(np.sum(x ** 2)))
    return np.stack(irs)


# ---------------------------------------------------------------------------
# voice: each line in its slot, levelled, sped up a hair only if it overruns
# ---------------------------------------------------------------------------
NARR_LUFS = -20.0
MAX_TEMPO = 1.12


def kweight(x):
    """ITU-R BS.1770 K-weighting (48 kHz)"""
    x = signal.lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585], x, axis=-1)
    return signal.lfilter([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621], x, axis=-1)


def loudness(x):
    """gated integrated loudness (LUFS) of a mono (n,) or stereo (2, n) signal"""
    y = kweight(np.atleast_2d(x))
    n, h = int(0.4 * SR), int(0.1 * SR)
    p = np.array([np.sum(np.mean(y[:, i : i + n] ** 2, axis=1)) for i in range(0, max(1, y.shape[1] - n), h)]) + 1e-12
    p = p[-0.691 + 10 * np.log10(p) > -70]
    if not len(p):
        return -70.0
    p = p[-0.691 + 10 * np.log10(p) > -0.691 + 10 * np.log10(np.mean(p)) - 10]
    return -0.691 + 10 * np.log10(np.mean(p))


def short_term(x, t0, t1):
    st = np.atleast_2d(x)[:, int(t0 * SR) : int(t1 * SR)]
    y = kweight(st)
    return -0.691 + 10 * np.log10(np.sum(np.mean(y ** 2, axis=1)) + 1e-12)


def read_audio(path, tempo=1.0):
    af = ["-af", f"atempo={tempo:.4f}"] if abs(tempo - 1.0) > 1e-4 else []
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, *af, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def compress(x, thr_db=-24.0, ratio=2.5, att=0.005, rel=0.12):
    """gentle compression so every word sits at the same level over the storm"""
    e = envelope(x, att, rel)
    lv = 20 * np.log10(e + 1e-9)
    over = np.maximum(0, lv - thr_db)
    return x * 10 ** (-over * (1 - 1 / ratio) / 20)


def build_vo():
    lines = {l["id"]: l for l in SCRIPT["lines"]}
    slots = TL["VO"]
    out = np.zeros(N)
    placement = {}
    for k, s in enumerate(slots):
        path = A("vo", f"{s['id']}.wav")
        y = read_audio(path)
        dur = len(y) / SR
        end = slots[k + 1]["at"] - 0.12 if k + 1 < len(slots) else DUR - 0.25
        room = end - s["at"]
        tempo = 1.0
        if dur > room:
            tempo = dur / room
            if tempo > MAX_TEMPO:
                print(f"WARNING: {s['id']} is {dur:.2f}s for a {room:.2f}s slot; sped up {MAX_TEMPO}x and still overruns by {dur / MAX_TEMPO - room:.2f}s", file=sys.stderr)
                tempo = MAX_TEMPO
            else:
                print(f"note: {s['id']} is {dur:.2f}s for a {room:.2f}s slot, sped up {tempo:.3f}x", file=sys.stderr)
            y = read_audio(path, tempo)
        y = fade(hp(y, 70, 2), 0.01, 0.03)
        y = compress(y * 10 ** ((NARR_LUFS - loudness(y)) / 20))
        g = NARR_LUFS - loudness(y)
        y = y * 10 ** (g / 20)
        put(out, s["at"], y)
        placement[s["id"]] = {"at": s["at"], "tempo": round(tempo, 4), "duration": round(len(y) / SR, 3), "gain_db": round(g, 2)}
    json.dump(placement, open(B("vo_placement.json"), "w"), indent=1)
    assert set(placement) == set(lines), "every script line needs a slot"
    return out


# ---------------------------------------------------------------------------
# mix
# ---------------------------------------------------------------------------
def envelope(x, att=0.02, rel=0.35):
    a = np.abs(x)
    ka, kr = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    blk = 64
    m = np.array([a[i : i + blk].max() for i in range(0, len(a), blk)])
    s = np.zeros_like(m)
    v = 0.0
    for i, val in enumerate(m):
        k = ka ** blk if val > v else kr ** blk
        v = val + (v - val) * k
        s[i] = v
    return np.repeat(s, blk)[: len(a)]


def place(track, t0, snd, gain, p):
    i = int(round(t0 * SR))
    if i >= track.shape[1]:
        return
    y = snd * 10 ** (gain / 20)
    if i < 0:
        y, i = y[-i:], 0
    y = y[: track.shape[1] - i]
    p = np.asarray(p, dtype=float)
    if p.ndim:  # a (start, end) sweep across the sound
        p = np.interp(np.linspace(0, 1, len(y)), np.linspace(0, 1, len(p)), p)
    l, r = np.sqrt(0.5 * (1 - p)), np.sqrt(0.5 * (1 + p))
    track[0, i : i + len(y)] += y * l
    track[1, i : i + len(y)] += y * r


TARGET_LUFS, CEILING_DB = -14.0, -1.3


def true_peak_db(st):
    return 20 * np.log10(np.max(np.abs(signal.resample_poly(st, 4, 1, axis=1))) + 1e-12)


def tp_limit(st, look=0.002, rel=0.08):
    """look-ahead peak limiter on 4x-oversampled peaks: holds the true peak under CEILING_DB"""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    ceil = 10 ** (CEILING_DB / 20)
    pk = np.abs(signal.resample_poly(st, 4, 1, axis=1)).max(axis=0)
    pk = pk[: 4 * (len(pk) // 4)].reshape(-1, 4).max(axis=1)
    pk = np.pad(pk, (0, st.shape[1] - len(pk)), mode="edge")
    need = np.minimum(1.0, ceil / (pk + 1e-12))
    if need.min() >= 1.0:
        return st
    L = int(look * SR)
    g = uniform_filter1d(minimum_filter1d(need, 2 * L + 1), L)
    blk = 32
    gb = g[: blk * (len(g) // blk)].reshape(-1, blk).min(axis=1)
    r = np.exp(-blk / (rel * SR))
    out = np.empty_like(gb)
    v = 1.0
    for i, x in enumerate(gb):
        v = min(x, 1 - (1 - v) * r)
        out[i] = v
    g2 = np.minimum(g, np.pad(np.repeat(out, blk), (0, len(g) - blk * len(out)), constant_values=1.0))
    return st * g2


def write_wav(path, st, subtype="FLOAT"):
    sf.write(path, np.clip(st.T, -1, 1).astype(np.float32), SR, subtype=subtype)


def main():
    os.makedirs(B("audio"), exist_ok=True)
    t = np.arange(N) / SR
    vo = build_vo()
    build_cues()
    sfx_bus, hits, send = np.zeros((2, N)), np.zeros((2, N)), np.zeros((2, N))
    for t0, snd, g, p, ducked, verb in CUES:
        place(sfx_bus if ducked else hits, t0, snd, g, p)
        if verb > 0:
            place(send, t0, snd, g + 20 * math.log10(verb), p)
    ir = make_ir(1.1, 0.008, 5000, 5)  # the concrete stairwell and room
    sfx_bus += np.stack([signal.fftconvolve(send[c], ir[c])[:N] for c in range(2)])
    sfx_bus = np.stack([hp(ch, 35, 2) for ch in sfx_bus])
    hits = np.stack([hp(ch, 35, 2) for ch in hits])
    music = build_music()
    music = music / (np.max(np.abs(music)) + 1e-9) * 0.5

    # weather and ambience
    wind = wind_bed()
    roar = roar_bed()
    rain = rain_bed()
    bird = birds(DUR)[:, :N]
    birdK = (1 - smooth01(t, 9.0, 4.0)) * np.minimum(t / 1.0, 1) + smooth01(t, T["birds"], 2.5)
    drips = drips_bed()
    # thunder far off as the storm builds; the far rumble when he first sees it
    thunder = np.zeros((2, N))
    for tt0, g, p, b in [(1.3, -6, -0.6, 150), (16.2, -8, -0.4, 170), (24.4, -6, 0.3, 190), (33.2, -5, -0.5, 200), (46.6, -4, 0.4, 220), (53.3, -3, -0.3, 240)]:
        place(thunder, tt0, sfx("thunder_far", 4.5, b), g, p)

    e = envelope(vo, 0.01, 0.3)
    talk = np.clip(e / (np.percentile(e[e > 1e-4], 60) + 1e-9), 0, 1)
    # under the narrator the roar and the wind give way in the speech band only, so the
    # words stay clear while the weight of the storm stays
    def carve(st, lo=0.3, mid=0.75, high=0.5):
        a = np.stack([lp(ch, 260, 2) for ch in st])
        c = np.stack([hp(ch, 4500, 2) for ch in st])
        return a * (1 - lo * talk) + (st - a - c) * (1 - mid * talk) + c * (1 - high * talk)

    roar = carve(roar)
    wind = carve(wind, 0.2, 0.7, 0.45)
    stems = {
        "vo": np.stack([vo, vo]),
        "sfx": sfx_bus * (1 - 0.35 * talk) + hits,
        "music": music * 0.62 * (1 - 0.55 * talk),
        "wind": wind * 0.36,
        "roar": roar * 0.62,
        "rain": rain * 0.07 * (1 - 0.4 * talk),
        "ambience": bird * 0.05 * birdK * (1 - 0.3 * talk) + drips * 0.05 + thunder * 0.5 * (1 - 0.3 * talk),
    }
    mix = sum(stems.values())
    mix = np.stack([hp(ch, 28, 2) for ch in mix])
    mix = np.tanh(mix * 1.1) / 1.1
    for name, arr in [*stems.items(), ("mix_raw", mix)]:
        write_wav(B("audio", f"{name}.wav"), arr)
    out = mix * 10 ** ((TARGET_LUFS - loudness(mix)) / 20)
    for _ in range(3):  # limiting takes a hair of loudness off: re-gain and re-limit
        out = tp_limit(out)
        out *= 10 ** ((TARGET_LUFS - loudness(out)) / 20)
    out = tp_limit(out)
    out[:, -int(0.06 * SR):] *= np.linspace(1, 0, int(0.06 * SR))  # no click at the last frame
    write_wav(B("mix.wav"), out, "PCM_24")
    # a level report per scene: the voice should always sit on top
    g = 10 ** ((loudness(out) - loudness(mix)) / 20)
    sc = TL["SCENES"]
    for i in range(len(sc) - 1):
        a, b = sc[i], sc[i + 1]
        print(f"scene {i + 1:2d} {a:5.1f}-{b:5.1f}s  mix {short_term(out, a, b):6.1f}  " + "  ".join(f"{k} {short_term(v * g, a, b):6.1f}" for k, v in stems.items()))
    print("wrote", B("mix.wav"), f"({len(CUES)} sound cues, {loudness(out):.2f} LUFS, true peak {true_peak_db(out):.2f} dBTP)")


if __name__ == "__main__":
    main()
