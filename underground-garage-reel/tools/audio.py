"""Sound for the reel: voiceover assembly, sound effects, music and the final mix.

Everything is driven by build/timeline.json (exported from src/timeline.js), so
sound cues stay locked to the animation. Effects are synthesised here; any file
dropped in assets/sfx/<name>.mp3 (e.g. generated with ElevenLabs) replaces the
synthetic version of that effect.

usage: python tools/audio.py            -> build/mix.wav (+ stems in build/audio/)
"""
import json
import os
import subprocess
import sys

import numpy as np
from scipy import signal

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = lambda *p: os.path.join(ROOT, "build", *p)
A = lambda *p: os.path.join(ROOT, "assets", *p)
TL = json.load(open(B("timeline.json")))
T = TL["T"]
DUR = TL["DURATION"]
N = int(DUR * SR)
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
    w = noise(d)
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w) * 6


def brown(d):
    return hp(np.cumsum(noise(d)) * 0.02, 20)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x * (peak / m)


def fade(x, a=0.005, r=0.02):
    x = x.copy()
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    x[:na] *= np.linspace(0, 1, na)
    x[-nr:] *= np.linspace(1, 0, nr)
    return x


def chirp(f, d):
    """sine with a per-sample frequency array or callable"""
    t = tt(d)
    fr = f(t) if callable(f) else f
    return np.sin(2 * np.pi * np.cumsum(fr) / SR)


def env_exp(d, tau, attack=0.002):
    t = tt(d)
    e = np.exp(-t / tau)
    na = max(1, int(attack * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def grains(d, rate, f1, f2, glen=(0.002, 0.008), shape=None):
    """sparse crackle: short band-passed noise bursts"""
    out = np.zeros(int(d * SR))
    n = rng.poisson(rate * d)
    for _ in range(n):
        st = rng.uniform(0, d)
        if shape is not None and rng.uniform() > shape(st / d):
            continue
        gl = rng.uniform(*glen)
        g = bp(noise(gl + 0.01), f1, f2)[: int(gl * SR)] * np.hanning(int(gl * SR))
        i = int(st * SR)
        out[i : i + len(g)] += g[: len(out) - i] * rng.uniform(0.3, 1.0)
    return out


def load_mp3(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


# ---------------------------------------------------------------------------
# sound effects
# ---------------------------------------------------------------------------
def s_pop(pitch=1.0):
    d = 0.13
    t = tt(d)
    f = (330 + 700 * np.exp(-t / 0.011)) * pitch
    y = chirp(f, d) * env_exp(d, 0.03, 0.0015)
    y += 0.12 * hp(noise(d), 2500) * env_exp(d, 0.0025)
    return norm(lp(y, 6000))


def s_thud(weight=1.0):
    d = 0.6
    t = tt(d)
    f = 42 + 60 * np.exp(-t / 0.06)
    y = chirp(f / weight ** 0.3, d) * env_exp(d, 0.15 * weight, 0.003)
    y += 0.55 * lp(noise(d), 260) * env_exp(d, 0.05)
    y += 0.12 * bp(noise(d), 900, 3500) * env_exp(d, 0.025)
    return norm(y)


def s_dig():
    d = 0.3
    y = grains(d, 260, 1500, 6000, shape=lambda u: np.exp(-3 * u))
    y += 0.5 * lp(noise(d), 500) * env_exp(d, 0.07)
    return norm(y)


def s_crumble(d=2.8):
    t = tt(d)
    shape = lambda u: np.clip(min(u / 0.12, 1.0) * (1 - u) ** 0.6 * 1.3, 0, 1)
    rum = lp(brown(d), 170, 4) * (0.6 + 0.4 * lp(noise(d), 3) * 8)
    env = np.minimum(t / 0.2, 1) * np.clip((d - t) / (0.5 * d), 0, 1) ** 0.7
    y = norm(rum) * 0.8 * env
    y += norm(grains(d, 900, 1800, 7000, shape=shape)) * 0.5
    y += norm(grains(d, 140, 400, 1400, glen=(0.008, 0.03), shape=shape)) * 0.45
    return norm(y)


def s_rain(d=3.4):
    t = tt(d)
    y = bp(pink(d), 900, 9000) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.7 * t))
    drops = np.zeros(len(t))
    for _ in range(int(55 * d)):
        i = int(rng.uniform(0, d) * SR)
        f = rng.uniform(2500, 6500)
        g = np.sin(2 * np.pi * f * tt(0.005)) * np.exp(-tt(0.005) / 0.0012)
        drops[i : i + len(g)] += g[: len(drops) - i] * rng.uniform(0.2, 1)
    y = norm(y) * 0.7 + norm(drops) * 0.35 + norm(lp(noise(d), 350)) * 0.12
    return norm(fade(y, 0.4, 0.6))


def bubble(f0, d):
    t = tt(d)
    f = f0 * (1 + 2.2 * t / d)
    return chirp(f, d) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.6 * np.exp(-t / (d * 0.6))


def s_bubbles(d, rate, f1, f2, blen=(0.02, 0.07), clustered=False):
    out = np.zeros(int(d * SR))
    k = 0
    while k < int(rate * d * (1.6 if clustered else 1)):
        k += 1
        st = rng.uniform(0, d)
        if clustered and np.sin(2 * np.pi * 3.2 * st) < 0.1:
            continue
        b = bubble(rng.uniform(f1, f2), rng.uniform(*blen))
        i = int(st * SR)
        out[i : i + len(b)] += b[: len(out) - i] * rng.uniform(0.3, 1)
    return out


def s_waterfill(d=2.4):
    y = norm(bp(noise(d), 300, 1800)) * 0.35 * (0.7 + 0.3 * np.sin(2 * np.pi * 5 * tt(d)))
    y += norm(s_bubbles(d, 32, 280, 900)) * 0.65
    return norm(fade(y, 0.25, 0.5))


def s_gurgle(d=2.8):
    y = norm(s_bubbles(d, 26, 140, 520, (0.04, 0.11), clustered=True)) * 0.8
    y += norm(lp(noise(d), 300)) * 0.2 * (0.5 + 0.5 * np.sin(2 * np.pi * 3.2 * tt(d)))
    return norm(fade(y, 0.2, 0.4))


def s_splash(d=2.2):
    y = norm(bp(noise(d), 500, 4000)) * 0.4 * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 2.3 * tt(d))))
    y += norm(s_bubbles(d, 18, 500, 1400, (0.015, 0.04))) * 0.4
    return norm(fade(y, 0.15, 0.5))


def s_motor(d, f0=118, harm=8, wobble=1.5, cut=1400):
    t = tt(d)
    f = f0 * (1 + 0.006 * np.sin(2 * np.pi * wobble * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = sum(np.sin(k * ph) / k ** 1.2 for k in range(1, harm + 1))
    y = lp(y, cut) * (0.9 + 0.1 * np.sin(2 * np.pi * 2 * f0 * t))
    y += 0.08 * bp(noise(d), 2000, 6000)
    return norm(fade(y, 0.15, 0.25))


def s_hydraulic(d=1.6, up=True):
    t = tt(d)
    prog = np.clip(t / d, 0, 1)
    f0 = (150 + 55 * prog) if up else (205 - 55 * prog)
    ph = 2 * np.pi * np.cumsum(f0) / SR
    y = sum(np.sin(k * ph) / k for k in range(1, 7))
    y = lp(y, 1800) * (np.minimum(t / 0.15, 1) * np.clip((d - t) / 0.2, 0, 1))
    hiss = hp(noise(d), 3000) * np.exp(-t / 0.25) * 0.35
    y = norm(y) * 0.8 + norm(hiss) * 0.3
    return norm(y)


def s_clunk():
    d = 0.35
    y = norm(s_thud(0.6)[: int(d * SR)]) * 0.8
    t = tt(d)
    y += 0.3 * (np.sin(2 * np.pi * 780 * t) + 0.6 * np.sin(2 * np.pi * 1230 * t)) * env_exp(d, 0.04)
    return norm(y)


def s_clink():
    d = 0.4
    t = tt(d)
    y = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / tau) for f, a, tau in [(2100, 1, 0.08), (3350, 0.6, 0.05), (5200, 0.3, 0.03)])
    return norm(y)


def s_tirespin(d=2.3):
    t = tt(d)
    env = np.minimum(t / 0.15, 1) * np.clip((d - t) / 0.35, 0, 1)
    sq = bp(noise(d), 1100, 1900, 3) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t))
    tone = np.sin(2 * np.pi * np.cumsum(1350 + 60 * np.sin(2 * np.pi * 6 * t)) / SR) * 0.25
    rev_f = 65 + 75 * (1 - np.exp(-t / 0.4))
    rev = lp(signal.sawtooth(2 * np.pi * np.cumsum(rev_f) / SR), 900) * 0.9
    y = norm(sq + tone) * 0.55 + norm(rev) * 0.6
    return norm(y * env)


def s_engine(d_idle=6.5):
    # starter crank, catch, idle
    crank_d, catch_d = 0.65, 0.55
    t = tt(crank_d)
    crank = lp(noise(crank_d), 900) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 9 * t)))
    crank += 0.3 * signal.sawtooth(2 * np.pi * 170 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t))
    t2 = tt(catch_d)
    rf = 22 + 45 * np.sin(np.pi * np.clip(t2 / catch_d, 0, 1)) + 10
    catch = engine_pulses(catch_d, rf) * 1.2
    idle = engine_pulses(d_idle, np.full(int(d_idle * SR), 26.0) + 0.6 * np.sin(2 * np.pi * 0.7 * tt(d_idle)))
    y = np.concatenate([norm(lp(crank, 1500)) * 0.5, norm(catch), norm(idle) * 0.75])
    return norm(fade(y, 0.01, 0.4))


def engine_pulses(d, rate):
    """combustion pulse train; rate is an array of firing frequency (Hz)"""
    n = int(d * SR)
    ph = np.cumsum(rate[:n]) / SR
    pulse = np.exp(-((ph % 1.0) * 9.0))
    body = np.sin(2 * np.pi * np.cumsum(rate[:n] * 3.4) / SR)
    y = lp(pulse * (0.7 + 0.3 * body) + 0.15 * noise(d)[:n] * pulse, 650, 3)
    return hp(y, 30)


def s_sputter():
    d = 0.9
    rate = np.linspace(26, 6, int(d * SR))
    y = engine_pulses(d, rate) * np.linspace(1, 0, int(d * SR)) ** 1.5
    return norm(y)


def s_puff():
    d = 0.25
    y = lp(noise(d), 700) * env_exp(d, 0.05, 0.004) + 0.4 * np.sin(2 * np.pi * 80 * tt(d)) * env_exp(d, 0.04)
    return norm(y)


def s_fan(d=3.6):
    t = tt(d)
    spin = 1 - np.exp(-t / 0.55)
    bpf = 52 * spin  # blade pass frequency
    ph = 2 * np.pi * np.cumsum(bpf) / SR
    am = 0.55 + 0.45 * np.sin(ph)
    y = bp(noise(d), 300, 2600) * am * (0.3 + 0.7 * spin)
    y += 0.35 * np.sin(ph) * spin + 0.15 * np.sin(2 * ph) * spin
    return norm(fade(y, 0.05, 0.4))


def s_whoosh(d=1.6):
    t = tt(d)
    y = noise(d)
    # sweep a band-pass by processing short blocks
    out = np.zeros_like(y)
    blk = 1024
    for i in range(0, len(y), blk):
        u = i / len(y)
        fc = 380 + 1500 * np.sin(np.pi * u) ** 1.5
        seg = bp(y[max(0, i - 2048) : i + blk], fc * 0.7, fc * 1.4)[-min(blk, len(y) - i):]
        out[i : i + len(seg)] = seg
    return norm(out * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.2)


def s_sparkle(d=1.4, n=12):
    out = np.zeros(int((d + 0.6) * SR))
    notes = [2093, 2349, 2637, 3136, 3520, 4186]
    for k in range(n):
        st = d * k / n + rng.uniform(0, 0.05)
        f = notes[rng.integers(len(notes))]
        g = (np.sin(2 * np.pi * f * tt(0.5)) + 0.4 * np.sin(2 * np.pi * f * 2.01 * tt(0.5))) * env_exp(0.5, 0.12, 0.002)
        i = int(st * SR)
        out[i : i + len(g)] += g[: len(out) - i] * rng.uniform(0.4, 1)
    out += norm(bp(noise(len(out) / SR), 2500, 7000)) * 0.12 * np.hanning(len(out))
    return norm(out)


def s_chime():
    d = 1.6
    t = tt(d)
    y = np.zeros(len(t))
    for f0, st in [(1046.5, 0.0), (1568.0, 0.07), (2093.0, 0.14)]:
        tt0 = np.clip(t - st, 0, None)
        on = (t >= st).astype(float)
        for ratio, a, tau in [(1, 1, 0.9), (2.76, 0.45, 0.35), (5.4, 0.2, 0.15)]:
            y += on * a * np.sin(2 * np.pi * f0 * ratio * tt0) * np.exp(-tt0 / tau)
    return norm(y)


def s_slam():
    d = 0.7
    t = tt(d)
    y = np.sin(2 * np.pi * np.cumsum(40 + 50 * np.exp(-t / 0.05)) / SR) * env_exp(d, 0.14, 0.002)
    y += 0.7 * lp(noise(d), 520) * env_exp(d, 0.06)
    y += 0.25 * bp(noise(d), 1000, 3200) * env_exp(d, 0.12)
    return norm(y)


def s_boing(pitch=1.0, d=0.7):
    t = tt(d)
    f = (210 + 60 * t) * pitch * (1 + 0.32 * np.exp(-3.5 * t) * np.sin(2 * np.pi * 13 * t))
    y = chirp(f, d) * env_exp(d, 0.28, 0.003)
    y += 0.25 * chirp(f * 2.0, d) * env_exp(d, 0.12)
    return norm(y)


def s_drive(d=1.9):
    t = tt(d)
    rate = 21 + 6 * np.clip(t / d, 0, 1)
    y = norm(engine_pulses(d, np.full(int(d * SR), 1.0) * rate)) * 0.6
    y += norm(lp(noise(d), 260)) * 0.35 + norm(bp(noise(d), 2500, 6000)) * 0.08
    return norm(fade(y, 0.4, 0.25))


def s_thunder(d=2.6):
    t = tt(d)
    y = lp(brown(d), 120, 4) * (np.exp(-t / 0.9) * np.minimum(t / 0.06, 1)) * (0.7 + 0.3 * lp(noise(d), 2) * 10)
    return norm(y)


def s_rumble(d=1.4):
    t = tt(d)
    y = lp(brown(d), 160, 3) * np.sin(np.pi * np.clip(t / d, 0, 1))
    y += 0.2 * grains(d, 160, 1500, 5000)
    return norm(y)


def s_whistle_down():
    d = 0.55
    t = tt(d)
    f = 900 * np.exp(-t / 0.35) + 260
    y = chirp(f, d) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.5
    return norm(lp(y, 3000))


# ---------------------------------------------------------------------------
# effect bank (a generated file in build/sfx/<name>.mp3 wins over synthesis)
# ---------------------------------------------------------------------------
CACHE = {}


def generated(name):
    f = A("sfx", f"{name}.mp3")
    return norm(load_mp3(f)) if os.path.exists(f) else None


POP_N = [0]


def fit(y, d, xf=0.25):
    """trim (with fade) or extend (crossfaded loop of the later part) to d seconds"""
    n = int(d * SR)
    if len(y) >= n:
        return fade(y[:n].copy(), 0.005, min(0.3, d * 0.25))
    seg = y[len(y) // 3:]
    out = y.copy()
    k = int(xf * SR)
    while len(out) < n:
        mixed = out[-k:] * np.linspace(1, 0, k) + seg[:k] * np.linspace(0, 1, k)
        out = np.concatenate([out[:-k], mixed, seg[k:]])
    return fade(out[:n], 0.005, 0.3)


def rms_norm(y, target=0.2):
    r = np.sqrt(np.mean(y ** 2)) + 1e-9
    y = y * (target / r)
    peak = np.max(np.abs(y))
    return y * (0.95 / peak) if peak > 0.95 else y


# generated recordings (assets/sfx/<name>.mp3) used instead of synthesis
GEN = {"crumble": 0, "rain": 0, "engine": 1.2, "hydraulic": 0, "tirespin": 0, "fan": 0}


def sfx(name, *args, **kw):
    if name in GEN:
        base = CACHE.get(("file", name))
        if base is None and ("file", name) not in CACHE:
            g = generated(name)
            CACHE[("file", name)] = base = (rms_norm(hp(g, 40)) if g is not None else None)
        if base is not None:
            y = fit(base, args[0] + GEN[name]) if args else base
            if name == "hydraulic" and len(args) > 1 and not args[1]:
                y = signal.resample(y, int(len(y) * 1.06))  # going down: a touch lower
            return y
    if name == "pop":
        POP_N[0] += 1
        base = CACHE.setdefault("pop_file", generated("pop"))
        if base is not None and POP_N[0] % 2 == 0:
            pitch = args[0] if args else 1.0
            y = base[: int(0.16 * SR)]
            y = signal.resample(y, int(len(y) / pitch))
            return norm(fade(y, 0.0005, 0.03))
    key = (name, args, tuple(sorted(kw.items())))
    if key not in CACHE:
        f = A("sfx", f"{name}.mp3")
        if os.path.exists(f) and not args and not kw:
            CACHE[key] = norm(load_mp3(f))
        else:
            CACHE[key] = globals()["s_" + name](*args, **kw)
    return CACHE[key]


# ---------------------------------------------------------------------------
# cue sheet
# ---------------------------------------------------------------------------
CUES = []  # (time, sound array, gain dB, pan -1..1)


def cue(t, snd, gain_db=0.0, pan=0.0):
    CUES.append((t, snd, gain_db, pan))


def x2pan(x):
    return float(np.clip(x / 6.5, -0.8, 0.8))


def build_cues():
    # 1 - dig: scoops + chunk pops, pile thud, car drive, tip, landing bounce
    for i in range(T["digSteps"]):
        t0 = T["digStart"] + i * T["digStep"]
        cue(t0, sfx("dig"), -9, 0.1)
        cue(t0 + 0.02, sfx("pop", 0.8 + 0.07 * i), -16, 0.2)
    cue(T["pileLand"], sfx("thud", 0.9), -8, 0.4)
    for k in range(7):
        cue(T["pileLand"] + 0.25 + k * 0.27, sfx("thud", 0.5), -20, 0.4)
    cue(T["carEnter"] - 0.2, sfx("drive"), -11, -0.6)
    cue(T["carEdge"] - 0.05, sfx("whistle_down"), -17, -0.4)
    cue(T["carNoseHit"], sfx("thud", 1.3), -5, -0.2)
    cue(T["carNoseHit"] + 0.02, sfx("crumble", 0.9), -18, -0.2)
    cue(T["carFlat"], sfx("thud", 1.1), -6, -0.1)
    cue(T["carFlat"] + 0.05, sfx("boing", 1.0), -11, 0.0)
    cue(T["carFlat"] + 0.52, sfx("boing", 1.25, 0.45), -17, 0.0)
    cue(T["sortOf"] - 0.05, sfx("boing", 0.7, 0.6), -21, 0.0)
    # 2 - crumble, pops, concrete
    cue(T["crumble"], sfx("crumble", 3.0), -6, 0.0)
    cue(T["slideIn"] + 0.3, sfx("rumble", 1.6), -10, 0.0)
    cue(T["buried"] - 0.1, sfx("whoosh", 1.2), -18, 0.0)
    for k in range(9):
        side = -1 if k < 4 else 1
        cue(T["dirtPop"] + 0.04 + k * 0.075, sfx("pop", 0.9 + 0.12 * (k % 4)), -12, 0.35 * side)
    for k in range(4):
        cue(T["dirtPop"] + 0.38 + k * 0.06, sfx("pop", 1.3 + 0.1 * k), -15, 0.45)
    for key, pan in [("backWall", 0.0), ("leftWall", -0.45), ("rightWall", 0.45)]:
        cue(T[key], sfx("slam"), -8, pan)
        cue(T[key] + 0.05, sfx("pop", 0.7), -15, pan)
    cue(T["floor"], sfx("slam"), -7, 0.0)
    cue(T["floor"] + 0.1, sfx("boing", 1.1, 0.5), -15, 0.0)
    # 3 - cloud, rain, pool, drainage
    cue(T["cloudIn"], sfx("pop", 0.6), -12, 0.05)
    cue(T["cloudIn"] + 0.2, sfx("thunder"), -11, 0.1)
    cue(T["rainStart"] - 0.2, sfx("rain", T["rainEnd"] - T["rainStart"] + 0.7), -9, 0.05)
    cue(T["waterRise"], sfx("waterfill", T["waterFull"] - T["waterRise"] + 0.4), -11, 0.0)
    cue(T["gravel"], sfx("dig"), -12, 0.0)
    cue(T["gravel"], sfx("pop", 0.75), -12, 0.0)
    cue(T["grate"], sfx("clink"), -15, -0.4)
    cue(T["drainPipe"], sfx("pop", 1.1), -13, -0.4)
    cue(T["sump"], sfx("pop", 0.85), -12, -0.45)
    cue(T["pump"], sfx("pop", 1.25), -12, -0.45)
    cue(T["dischargePipe"], sfx("whoosh", 0.7), -17, -0.55)
    cue(T["outlet"], sfx("pop", 1.4), -13, -0.65)
    cue(T["flowStart"], sfx("motor", T["flowEnd"] - T["flowStart"], 118, 8, 1.5, 1400), -17, -0.45)
    cue(T["flowStart"] + 0.1, sfx("gurgle", T["flowEnd"] - T["flowStart"]), -9, -0.35)
    cue(T["flowStart"] + 0.9, sfx("splash", T["flowEnd"] - T["flowStart"] - 0.4), -16, -0.7)
    cue(T["drainEnd"] + 0.05, sfx("thud", 0.7), -15, 0.0)
    # 4 - stuck, then the lift
    cue(T["spinStart"], sfx("tirespin", T["spinEnd"] - T["spinStart"] + 0.2), -8, 0.1)
    cue(T["bump1"], sfx("thud", 0.8), -10, 0.35)
    cue(T["bump2"], sfx("thud", 0.9), -9, 0.35)
    cue(T["casing"], sfx("pop", 0.7), -12, 0.0)
    cue(T["casing"] + 0.05, sfx("clunk"), -14, 0.0)
    cue(T["rod"], sfx("pop", 1.15), -12, 0.0)
    cue(T["platform"], sfx("pop", 0.9), -10, 0.0)
    cue(T["platform"] + 0.03, sfx("clunk"), -11, 0.0)
    cue(T["platform"] + 0.35, sfx("boing", 1.15, 0.45), -17, 0.0)
    for a, b, up in [("liftUp", "liftTop", True), ("liftDown", "liftBottom", False), ("lift2Up", "lift2Top", True),
                     ("lift2Down", "lift2Bottom", False), ("rise", "riseTop", True), ("sink", "sinkBottom", False)]:
        cue(T[a], sfx("hydraulic", T[b] - T[a] + 0.15, up), -11, 0.0)
        cue(T[b], sfx("clunk"), -13, 0.0)
    # 5 - engine, fumes, vent, fan, air
    cue(T["engineOn"], sfx("engine", T["engineOff"] - T["engineOn"] - 1.1), -9, 0.0)
    for k in range(9):
        cue(T["puffsStart"] + 0.15 + k * 0.29, sfx("puff"), -17, -0.2)
    cue(T["engineOff"], sfx("sputter"), -13, 0.0)
    cue(T["ventStub"], sfx("pop", 0.95), -12, 0.5)
    cue(T["ventPipe"], sfx("whoosh", 0.8), -16, 0.6)
    cue(T["ventPipe"] + 0.45, sfx("pop", 1.2), -11, 0.6)
    cue(T["fanHousing"], sfx("pop", 0.8), -10, 0.65)
    cue(T["fanSpin"], sfx("fan", T["roomClear"] - T["fanSpin"] + 0.7), -11, 0.6)
    cue(T["airStart"], sfx("whoosh", 2.4), -14, -0.3)
    cue(T["smokeOut"] + 0.6, sfx("whoosh", 1.9), -16, 0.6)
    # 6 - posts, roof drop, grass, close
    for k in range(4):
        cue(T["posts"] + k * 0.11, sfx("pop", 1.0 + 0.12 * k), -12, (-0.3, 0.3, -0.3, 0.3)[k])
    for k, (dt, g) in enumerate([(0.2, -6), (0.4, -13), (0.5, -19)]):
        cue(T["roofDrop"] + dt, sfx("thud", 0.9 - 0.15 * k), g, 0.0)
    cue(T["grassStart"], sfx("sparkle", T["grassEnd"] - T["grassStart"], 16), -12, 0.0)
    cue(T["grassStart"] + 0.1, sfx("rumble", 1.0), -24, 0.0)
    cue(T["lift2Bottom"] + 0.02, sfx("pop", 0.6), -13, 0.0)
    # 7 - finale
    cue(T["split"] - 0.05, sfx("rumble", 1.2), -13, 0.0)
    cue(T["riseTop"] + 0.05, sfx("sparkle", 0.9, 8), -15, 0.0)
    for tf in (T["flash1"], T["flash2"]):
        cue(tf, sfx("clink"), -15, 0.3)
    cue(T["flash2"] + 0.25, sfx("chime"), -10, 0.0)
    cue(T["sinkBottom"] + 0.03, sfx("sparkle", 1.1, 10), -14, 0.0)


# ---------------------------------------------------------------------------
# music: light, curious, pizzicato + marimba; the last chord lands as the
# lawn closes for good (bar 24 = T.sinkBottom)
# ---------------------------------------------------------------------------
NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def mf(name):
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[n] + 12 * (o + 1) - 69) / 12)


def marimba(f, d=0.9, vel=1.0):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / (0.28 + 60 / f))
    y += 0.3 * np.sin(2 * np.pi * f * 3.98 * t) * np.exp(-t / 0.07)
    y += 0.06 * np.sin(2 * np.pi * f * 9.9 * t) * np.exp(-t / 0.03)
    y += 0.08 * bp(noise(d), 1500, 4000) * np.exp(-t / 0.004)
    return fade(y * vel, 0.001, 0.05)


def glock(f, d=1.4, vel=1.0):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.7) + 0.35 * np.sin(2 * np.pi * f * 2.71 * t) * np.exp(-t / 0.25)
    return fade(y * vel, 0.001, 0.1)


def pluck(f, d=0.55, vel=1.0, bright=0.5):
    L = int(SR / f)
    n = int(d * SR)
    exc = np.zeros(n)
    burst = lp(noise(L / SR + 0.001), 1200 + 3000 * bright)[:L]
    exc[:L] = burst
    g = 0.996
    a = np.zeros(L + 2)
    a[0] = 1
    a[L] = -g * 0.5
    a[L + 1] = -g * 0.5
    y = signal.lfilter([1.0], a, exc)
    y *= np.exp(-tt(d) / 0.22)  # pizzicato: short
    return fade(lp(y, 2500) * vel, 0.002, 0.06)


def pad(freqs, d, vel=1.0):
    t = tt(d)
    y = np.zeros(len(t))
    for f in freqs:
        for det in (0.997, 1.003):
            ph = 2 * np.pi * f * det * t
            y += np.sin(ph) + 0.12 * np.sin(3 * ph) + 0.04 * np.sin(5 * ph)
    env = np.minimum(t / 0.5, 1) * np.clip((d - t) / 0.6, 0, 1)
    return lp(y * env, 1800) * vel / len(freqs)


def shaker(vel=1.0):
    d = 0.06
    return hp(noise(d), 6500) * env_exp(d, 0.012, 0.004) * vel


def woodblock(vel=1.0):
    d = 0.12
    t = tt(d)
    return (np.sin(2 * np.pi * 1250 * t) + 0.5 * np.sin(2 * np.pi * 1870 * t)) * np.exp(-t / 0.025) * vel


CHORDS = {
    "C": ["C", "E", "G"], "A7": ["A", "C#", "E", "G"], "Dm": ["D", "F", "A"], "G7": ["G", "B", "D", "F"],
    "F": ["F", "A", "C"], "Fm": ["F", "G#", "C"], "Am": ["A", "C", "E"], "E7": ["E", "G#", "B", "D"],
}
PROG = ["C", "C", "A7", "Dm", "G7", "C", "A7", "Dm", "G7",  # 0-8
        "F", "Fm", "C", "A7", "Dm", "G7", "C", "E7",          # 9-16
        "F", "Fm", "C", "A7", "Dm", "G7", "G7", "C"]          # 17-24 (24 = final chord)


def build_music():
    bar = T["sinkBottom"] / 24.0
    beat = bar / 4
    out = np.zeros(N + SR * 3)

    def put(t0, y, g=1.0):
        i = int(t0 * SR)
        if i >= len(out):
            return
        out[i : i + len(y)] += y[: len(out) - i] * g

    mel_rng = np.random.default_rng(3)
    motif_a = [(0, 0), (0.5, 1), (1.5, 2), (2.5, 1), (3, 0)]  # (beat, chord tone index)
    motif_b = [(0, 2), (1, 1), (1.5, 0), (2, 1), (3.5, 2)]
    for b_i, ch in enumerate(PROG):
        t_bar = b_i * bar
        tones = CHORDS[ch]
        root = tones[0]
        final = b_i == 24
        # pizzicato walking bass
        if not final:
            pattern = [(0, root + "2"), (1, tones[2] + "2"), (2, root + "2"), (3, tones[1] + "2")]
            for bt, n in pattern:
                put(t_bar + bt * beat, pluck(mf(n), 0.5, 0.9 if bt in (0, 2) else 0.6), 0.55)
        else:
            put(t_bar, pluck(mf("C2"), 1.4, 1.0, 0.3), 0.6)
            put(t_bar, pluck(mf("G2"), 1.4, 0.7, 0.3), 0.4)
        # soft pad on the chord
        if b_i >= 1:
            put(t_bar, pad([mf(n + "4") for n in tones[:3]], bar + (1.4 if final else 0.2), 1.0), 0.05 if not final else 0.08)
        # shaker / woodblock groove (from bar 1)
        if 1 <= b_i < 24:
            for k in range(8):
                put(t_bar + k * beat / 2, shaker(0.6 if k % 2 else 0.35), 0.1)
            if b_i % 2 == 1:
                put(t_bar + 3.5 * beat, woodblock(0.6), 0.1)
        # marimba melody: motif A in bars 2-8, motif B 9-16, A again 17-23
        if 2 <= b_i < 24:
            motif = motif_a if (b_i < 9 or b_i >= 17) else motif_b
            octave = "5" if b_i % 4 in (1, 2) else "4"
            for k, (bt, idx) in enumerate(motif):
                if b_i % 4 == 3 and k == len(motif) - 1:
                    continue  # breathe at the end of each phrase
                n = tones[idx % len(tones)] + octave
                vel = 0.75 + 0.25 * mel_rng.uniform()
                put(t_bar + bt * beat, marimba(mf(n), 0.8, vel), 0.32)
        # stabs during the intro
        if b_i == 0:
            for bt in (0, 1.5, 3):
                for n in tones:
                    put(t_bar + bt * beat, marimba(mf(n + "4"), 0.5, 0.5), 0.18)
        # sparkly glockenspiel lift for the finale (bars 21-23)
        if 21 <= b_i < 24:
            for bt in (0, 1, 2, 3):
                n = tones[(bt + b_i) % len(tones)] + "6"
                put(t_bar + bt * beat + beat * 0.5, glock(mf(n), 1.0, 0.6), 0.1)
        if final:
            for n in ["C4", "E4", "G4", "C5", "E5"]:
                put(t_bar, marimba(mf(n), 1.6, 0.9), 0.25)
            put(t_bar + 0.04, glock(mf("C6"), 2.0, 0.8), 0.16)
            put(t_bar + 0.11, glock(mf("G6"), 2.0, 0.6), 0.12)
    music = out[:N]
    # gentle room: short feedback-delay reverb
    rev = np.zeros_like(music)
    for dly, g in [(0.031, 0.32), (0.053, 0.27), (0.079, 0.22), (0.113, 0.17), (0.161, 0.12)]:
        d = int(dly * SR)
        rev[d:] += music[:-d] * g
    music = music + lp(rev, 3500) * 0.6
    # fade-in and final fade-out
    t = np.arange(N) / SR
    music *= np.minimum(t / 0.6, 1) * np.clip((DUR - t) / 1.2, 0, 1)
    return music


# ---------------------------------------------------------------------------
# voiceover assembly from the timed sentence clips
# ---------------------------------------------------------------------------
def build_vo():
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", A("vo", "take1.mp3"), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    src = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    out = np.zeros(N)
    for c in TL["VO"]:
        a, b = c["src"]
        seg = src[int(a * SR) : int(b * SR)]
        seg = fade(seg, 0.012, 0.03)
        i = int(c["at"] * SR)
        out[i : i + len(seg)] += seg[: N - i]
    # light clean-up: high-pass rumble, gentle presence
    out = hp(out, 80, 2)
    return out


def envelope(x, att=0.02, rel=0.35):
    a = np.abs(x)
    e = np.zeros_like(a)
    ka, kr = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    # coarse but fast: process with a moving max then smooth
    blk = 256
    m = np.array([a[i : i + blk].max() for i in range(0, len(a), blk)])
    s = np.zeros_like(m)
    v = 0.0
    for i, val in enumerate(m):
        k = ka ** blk if val > v else kr ** blk
        v = val + (v - val) * k
        s[i] = v
    e = np.repeat(s, blk)[: len(a)]
    return e


def place(track, t0, snd, gain, pan):
    i = int(t0 * SR)
    if i >= N:
        return
    y = snd[: N - i] * 10 ** (gain / 20)
    l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    track[0, i : i + len(y)] += y * l
    track[1, i : i + len(y)] += y * r


def main():
    os.makedirs(B("audio"), exist_ok=True)
    vo = build_vo()
    vo = vo / (np.max(np.abs(vo)) + 1e-9) * 0.7
    build_cues()
    sfx_bus = np.zeros((2, N))
    for t0, snd, g, pan in CUES:
        place(sfx_bus, t0, snd, g, pan)
    music = build_music()
    music = music / (np.max(np.abs(music)) + 1e-9) * 0.5
    # duck music (and a little SFX) under the voice
    e = envelope(vo)
    duck = 1 - 0.55 * np.clip(e / 0.25, 0, 1)
    duck_sfx = 1 - 0.45 * np.clip(e / 0.25, 0, 1)
    mus_st = np.stack([music, music]) * 0.55
    # slight stereo widening for the music
    mus_st[0] = music * 0.6 + np.roll(music, 240) * 0.1
    mus_st[1] = music * 0.6 + np.roll(music, 480) * 0.1
    # keep the low end clean (phones can't play it and it eats headroom)
    sfx_bus = np.stack([hp(ch, 55, 2) for ch in sfx_bus])
    mix = np.stack([vo, vo]) * 1.0 + sfx_bus * 0.55 * duck_sfx + mus_st * duck * 0.62
    mix = np.stack([hp(ch, 32, 2) for ch in mix])
    # soft bus limiter
    mix = np.tanh(mix * 1.15) / 1.15
    for name, arr in [("vo", np.stack([vo, vo])), ("sfx", sfx_bus * 0.55), ("music", mus_st * 0.62), ("mix_raw", mix)]:
        write_wav(B("audio", f"{name}.wav"), arr)
    # loudness normalise for Instagram (-14 LUFS, -1 dBTP)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", B("audio", "mix_raw.wav"), "-af",
                    "loudnorm=I=-14:TP=-1.0:LRA=11", "-ar", str(SR), B("mix.wav")], check=True)
    print("wrote", B("mix.wav"), f"({len(CUES)} sound cues)")


def write_wav(path, st):
    import soundfile as sf
    sf.write(path, np.clip(st.T, -1, 1).astype(np.float32), SR, subtype="FLOAT")


if __name__ == "__main__":
    main()
