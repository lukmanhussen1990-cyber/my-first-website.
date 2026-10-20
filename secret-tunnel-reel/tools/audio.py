"""Sound for the tunnel reel: voiceover assembly, sound effects, music and the final mix.

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
POP_N = [0]


def s_pop(pitch=1.0):
    """parts popping in: every other pop is the recorded one"""
    POP_N[0] += 1
    rec = recording("pop")
    if rec is not None and POP_N[0] % 2 == 0:
        return norm(fade(repitch(rec[: int(0.16 * SR)], pitch), 0.0005, 0.03))
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
    rec = hit("dig", float(rng.uniform(0.9, 1.1)))
    if rec is not None:
        return rec
    d = 0.3
    y = grains(d, 260, 1500, 6000, shape=lambda u: np.exp(-3 * u))
    y += 0.5 * lp(noise(d), 500) * env_exp(d, 0.07)
    return norm(y)


def s_crumble(d=2.8):
    rec = recording("crumble")
    if rec is not None:
        return fit(rms_norm(rec), d)
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



def s_dig_soft():
    """muffled scoop heard from inside the ground"""
    y = lp(s_dig(), 1800)
    th = sfx("thud", 0.7)[: len(y)]
    return norm(y + 0.6 * np.pad(th, (0, len(y) - len(th))))


def s_tap():
    """shovel tapping the footing: the first knock of the concrete recording"""
    rec = hit("concrete", float(rng.uniform(1.0, 1.08)))
    return rec if rec is not None else norm(sfx("concrete")[: int(0.3 * SR)])


def s_concrete():
    """dull heavy clunk of a shovel on thick concrete"""
    rec = recording("concrete")
    if rec is not None:
        return rms_norm(rec)
    d = 0.7
    t = tt(d)
    y = chirp(55 + 70 * np.exp(-t / 0.03), d) * env_exp(d, 0.09, 0.001)
    y += 0.5 * lp(noise(d), 700) * env_exp(d, 0.045)
    # the ring of the shovel blade, quick and dull
    y += 0.22 * sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / tau) for f, a, tau in [(612, 1, 0.07), (1190, 0.55, 0.05), (1870, 0.3, 0.03)])
    y += 0.25 * bp(noise(d), 1500, 5000) * env_exp(d, 0.01)
    return norm(y)


def s_clack(pitch=1.0, synth=False):
    """brick set down on brick"""
    rec = None if synth else hit("clack", pitch)
    if rec is not None:
        return rec
    d = 0.16
    t = tt(d)
    y = sum(a * np.sin(2 * np.pi * f * pitch * t) * np.exp(-t / tau) for f, a, tau in [(1450, 1, 0.025), (2380, 0.6, 0.016), (3720, 0.35, 0.01)])
    y += 0.6 * bp(noise(d), 900, 4500) * env_exp(d, 0.006, 0.0005)
    y += 0.4 * lp(noise(d), 300) * env_exp(d, 0.02)
    return norm(y)


def s_fizz(d=1.1):
    """candle sputter and hiss"""
    t = tt(d)
    hiss = hp(noise(d), 3000) * np.exp(-t / 0.35) * (0.7 + 0.3 * np.sin(2 * np.pi * 23 * t))
    crack = grains(d, 60, 2000, 8000, glen=(0.002, 0.006), shape=lambda u: np.exp(-4 * u))
    return norm(fade(norm(hiss) * 0.7 + norm(crack) * 0.4, 0.005, 0.2))


def s_strike():
    """match flare when the candle appears"""
    d = 0.5
    t = tt(d)
    y = hp(noise(d), 1800) * (np.minimum(t / 0.01, 1) * np.exp(-t / 0.12))
    y += 0.3 * lp(noise(d), 900) * np.exp(-t / 0.2)
    return norm(y)


def s_click():
    """light switch"""
    d = 0.06
    t = tt(d)
    y = (np.sin(2 * np.pi * 3100 * t) + 0.7 * np.sin(2 * np.pi * 5200 * t)) * np.exp(-t / 0.004)
    y += 0.5 * bp(noise(d), 2500, 9000) * np.exp(-t / 0.003)
    y = np.concatenate([y, np.zeros(int(0.025 * SR)), 0.5 * y])  # click-clack of the toggle
    return norm(y)


def s_hum(d=0.6):
    """filament warming up"""
    t = tt(d)
    y = (np.sin(2 * np.pi * 120 * t) + 0.5 * np.sin(2 * np.pi * 240 * t) + 0.2 * np.sin(2 * np.pi * 360 * t)) * np.minimum(t / 0.05, 1) * np.exp(-t / 0.3)
    y += 0.25 * np.sin(2 * np.pi * 2300 * t) * np.exp(-t / 0.06)
    return norm(y)


def s_zip(d=1.2):
    """wire zipping along the roof"""
    t = tt(d)
    f = 900 + 1500 * (t / d)
    y = bp(noise(d), 1500, 7000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * np.cumsum(f / 40) / SR * 40)))
    return norm(fade(y * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.5, 0.01, 0.1))


def s_clink(pitch=1.0):
    d = 0.4
    t = tt(d)
    y = sum(a * np.sin(2 * np.pi * f * pitch * t) * np.exp(-t / tau) for f, a, tau in [(2100, 1, 0.08), (3350, 0.6, 0.05), (5200, 0.3, 0.03)])
    return norm(y)


def s_rattle(d=2.0):
    """mine cart wheels rattling over rail joints, speeding up then braking"""
    t = tt(d)
    rate = 6 + 22 * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.7  # joints per second
    ph = np.cumsum(rate) / SR
    joints = np.zeros(len(t))
    idx = np.where(np.diff(np.floor(ph)) > 0)[0]
    tick = s_clack(0.55, synth=True)[: int(0.05 * SR)] * 0.8
    for i in idx:
        joints[i : i + len(tick)] += tick[: len(joints) - i] * (0.6 + 0.4 * rng.uniform())
    roll = lp(brown(d), 300, 2) * 2 + 0.25 * bp(noise(d), 2500, 6000)
    env = np.minimum(t / 0.2, 1) * np.clip((d - t) / 0.3, 0, 1)
    return norm((norm(joints) * 0.8 + norm(roll) * 0.6) * env)


def cart_e(u):
    """cart progress along the rails (same curve as updateCart in main.js)"""
    u = np.clip(u, 0, 1)
    return np.where(u < 0.75, 0.82 * (u / 0.75) ** 1.6, 0.82 + 0.18 * (1 - (1 - np.clip((u - 0.75) / 0.25, 0, 1)) ** 3))


def s_cart(run, tail=0.18):
    """the ride: the recorded rattle played faster and louder as the cart picks
    up speed, dying away as it brakes"""
    rec = recording("rattle")
    if rec is None:
        return s_rattle(run + 0.25)
    n = int((run + tail) * SR)
    t = np.arange(n) / SR
    sp = np.gradient(cart_e(t / run))
    sp /= sp.max()
    steady = rms_norm(rec[int(0.3 * SR) : int(1.25 * SR)])  # the full-speed stretch
    src = fit(steady, (run + tail) * 1.3 + 0.5)
    y = np.interp(np.cumsum(0.8 + 0.35 * sp), np.arange(len(src)), src)
    env = (0.12 + 0.88 * sp ** 0.8) * np.minimum(t / 0.05, 1) * np.clip((run + tail - t) / tail, 0, 1)
    return norm(y * env)


def s_squeak():
    """brakes"""
    d = 0.45
    t = tt(d)
    y = np.sin(2 * np.pi * np.cumsum(2400 + 300 * np.sin(2 * np.pi * 11 * t)) / SR) * np.sin(np.pi * np.clip(t / d, 0, 1))
    return norm(y)


def s_knock():
    """wooden lid knock: the recorded hollow thump for the body, a woody mid
    "tok" on top so it still reads on a phone speaker"""
    d = 0.35
    t = tt(d)
    y = chirp(190 + 140 * np.exp(-t / 0.01), d) * env_exp(d, 0.05, 0.001)
    y += 0.4 * bp(noise(d), 600, 2500) * env_exp(d, 0.012)
    tok = norm(y + 0.5 * bp(noise(d), 900, 3200) * env_exp(d, 0.006, 0.0005))
    rec = hit("knock", float(rng.uniform(0.96, 1.04)))
    if rec is None:
        return tok
    n = max(len(rec), len(tok))
    return norm(np.pad(rec, (0, n - len(rec))) + 0.55 * np.pad(tok, (0, n - len(tok))))


def s_gulp():
    d = 0.32
    t = tt(d)
    f = 520 * np.exp(-t / 0.08) + 140
    y = chirp(f, d) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.8
    y += 0.4 * chirp(f * 0.5, d) * np.exp(-t / 0.12)
    return norm(lp(y, 2000))


def s_slide_down(d=1.0):
    """slow slide whistle as he sinks back"""
    t = tt(d)
    f = 1150 * np.exp(-1.25 * t / d) + 170
    y = chirp(f * (1 + 0.012 * np.sin(2 * np.pi * 5.5 * t)), d) + 0.1 * chirp(f * 2, d)
    return norm(fade(lp(y, 3500), 0.05, 0.15))


def s_zoom_up(d=0.5):
    t = tt(d)
    f = 300 + 900 * (t / d) ** 1.5
    return norm(fade(chirp(f, d) * np.sin(np.pi * np.clip(t / d, 0, 1)), 0.01, 0.05))


def s_shimmer(d=2.0):
    """soft warm swell under the load dots"""
    t = tt(d)
    y = sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate([523.3, 659.3, 784.0, 1046.5])) * 0.25
    y *= np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5 * (0.8 + 0.2 * np.sin(2 * np.pi * 6 * t))
    return norm(y)


def s_darkness():
    """everything goes dark: a soft low thump"""
    d = 0.9
    t = tt(d)
    y = chirp(70 * np.exp(-t / 0.4) + 35, d) * np.exp(-t / 0.3)
    return norm(lp(y + 0.2 * lp(noise(d), 200) * np.exp(-t / 0.2), 400))


def s_slap():
    """rubber flip-flop slapped against an arm"""
    d = 0.14
    t = tt(d)
    y = bp(noise(d), 700, 4200) * env_exp(d, 0.012, 0.0008)
    y += 0.5 * chirp(160 + 120 * np.exp(-t / 0.01), d) * env_exp(d, 0.03)
    return norm(y)


def s_creak():
    """foot on a wooden ladder rung"""
    d = 0.22
    t = tt(d)
    y = bp(noise(d), 400, 1600) * env_exp(d, 0.05, 0.002) * (0.6 + 0.4 * np.sin(2 * np.pi * 37 * t))
    return norm(y + 0.3 * chirp(110 + 40 * t, d) * env_exp(d, 0.06))


def s_swish():
    d = 0.22
    t = tt(d)
    return norm(bp(noise(d), 1200, 6000) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2)


def s_squelch():
    d = 0.18
    t = tt(d)
    return norm(chirp(380 + 300 * np.sin(np.pi * t / d), d) * np.sin(np.pi * np.clip(t / d, 0, 1)) * 0.8 + 0.2 * lp(noise(d), 1200) * np.exp(-t / 0.05))


# ---------------------------------------------------------------------------
# effect bank. A recording in assets/sfx/<name>.mp3 (generated with ElevenLabs)
# replaces the synthetic version of that effect. One-shot recordings are split
# into their separate hits and every cue gets the next hit, slightly re-pitched,
# so a run of digs or bricks never repeats the exact same sound.
# ---------------------------------------------------------------------------
CACHE = {}
HIT_N = {}
# per recording: how far below the loudest hit a hit may be, and its longest slice
HIT_OPTS = {"dig": dict(rel_db=-14, max_len=0.3), "clack": dict(rel_db=-8, max_len=0.12),
            "concrete": dict(rel_db=-3, max_len=0.3), "knock": dict(rel_db=-3, max_len=0.3)}


def recording(name):
    if ("rec", name) not in CACHE:
        f = A("sfx", f"{name}.mp3")
        CACHE[("rec", name)] = hp(load_mp3(f), 40) if os.path.exists(f) else None
    return CACHE[("rec", name)]


def split_hits(y, rel_db=-16, gap=0.04, drop=30, max_len=0.4, pre=0.003):
    """each separate hit in a recording, from its onset until it has decayed by
    `drop` dB (or the next hit starts), loudest first"""
    hop, w = int(0.0025 * SR), int(0.008 * SR)
    e = 20 * np.log10(np.array([np.sqrt(np.mean(y[i : i + w] ** 2)) for i in range(0, len(y) - w, hop)]) + 1e-9)
    top = e.max()
    peaks = []
    for i in range(1, len(e) - 1):
        if e[i] >= top + rel_db and e[i] >= e[i - 1] and e[i] >= e[i + 1]:
            if peaks and (i - peaks[-1]) * hop < gap * SR:
                if e[i] > e[peaks[-1]]:
                    peaks[-1] = i
                continue
            peaks.append(i)
    starts = []
    for k, p in enumerate(peaks):
        s, lo = p, peaks[k - 1] if k else 0
        while s > lo and e[s - 1] < e[s] and e[s - 1] > e[p] - 24:
            s -= 1
        starts.append(s)
    hits = []
    for k, p in enumerate(peaks):
        t, hi = p, starts[k + 1] if k + 1 < len(peaks) else len(e)
        while t < hi - 1 and e[t] > e[p] - drop:
            t += 1
        a = max(0, starts[k] * hop - int(pre * SR))
        b = min(len(y), t * hop + w, a + int(max_len * SR))
        hits.append((e[p], norm(fade(y[a:b], 0.001, min(0.03, (b - a) / SR / 3)))))
    return [h for _, h in sorted(hits, key=lambda h: -h[0])]


def repitch(y, pitch):
    return y if pitch == 1.0 else signal.resample(y, int(len(y) / pitch))


def hit(name, pitch=1.0):
    """the next hit of a recording (cycling through them), or None without one"""
    y = recording(name)
    if y is None:
        return None
    hs = CACHE.setdefault(("hits", name), split_hits(y, **HIT_OPTS.get(name, {})))
    HIT_N[name] = HIT_N.get(name, -1) + 1
    return repitch(hs[HIT_N[name] % len(hs)], pitch)


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


# effects that come out different on every cue (recorded hits, the pop) are never cached
VARY = {"pop", "dig", "dig_soft", "clack", "tap", "knock"}


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
CUES = []  # (time, sound array, gain dB, pan -1..1)


def cue(t, snd, gain_db=0.0, pan=0.0):
    CUES.append((t, snd, gain_db, pan))


def x2pan(x):
    return float(np.clip(x / 5.0, -0.75, 0.75))


def brick_xs():
    """x of each arch brick in the order they land (laid out from src/world.js the
    way main.js does it)"""
    js = ("import('./src/world.js').then(W => { const xs = []; for (const a of W.ARCHES) {"
          " const Rm = a.R + W.BAND / 2, arc = Rm * (a.a0 - a.a1), n = Math.max(5, Math.round(arc / 0.11));"
          " for (let i = 0; i < n; i++) xs.push(a.ox + Rm * Math.cos(a.a0 + ((a.a1 - a.a0) * (i + 0.5)) / n)); }"
          " console.log(JSON.stringify(xs.sort((p, q) => p - q))); })")
    try:
        return json.loads(subprocess.run(["node", "-e", js], cwd=ROOT, check=True, capture_output=True, text=True).stdout)
    except (OSError, subprocess.CalledProcessError, ValueError):
        return list(np.linspace(-2.8, 2.8, 62))


BOUNCE = (0.364, 0.727, 0.909)  # impacts of easeOutBounce (fraction of its duration)


def build_cues():
    rnd = np.random.default_rng(5)
    # 1 - shaft dug in six scoops, sideways tunnel, the pile grows
    for i in range(T["shaftSteps"]):
        t0 = T["digStart"] + i * T["shaftStep"]
        cue(t0, sfx("dig"), -8, x2pan(-3.2))
        cue(t0 + 0.03, sfx("pop", 0.8 + 0.06 * i), -17, x2pan(-3.2))
    cue(T["pileLand"], sfx("thud", 0.9), -10, x2pan(-2.0))
    for k in range(10):
        cue(T["pileLand"] + 0.3 + k * 0.42, sfx("thud", 0.5), -22, x2pan(-2.0))
    gap = (T["tunnelEnd"] - 0.3 - T["tunnelStart"]) / 6
    for j in range(7):
        x = -2.85 + 2.0 * (j + 1) / 7
        cue(T["tunnelStart"] + j * gap, sfx("dig_soft"), -10, x2pan(x))
    cue(5.85, sfx("pop", 0.9), -14, x2pan(-3.2))  # ladder
    # 2 - the clunk, knock knock, dig deeper and under, out under the friend's lawn
    cue(T["clunk"], sfx("concrete"), -3, x2pan(-0.9))
    cue(T["clunk"] + 0.04, sfx("crumble", 1.0), -20, x2pan(-0.9))
    cue(T["knock1"], sfx("tap"), -9, x2pan(-0.9))
    cue(T["knock2"], sfx("tap"), -9, x2pan(-0.9))
    for j in range(10):
        t0 = T["dipStart"] + j * ((T["exitShaft"] - T["dipStart"]) / 10)
        cue(t0, sfx("dig_soft"), -11, x2pan(-1.8 + 4.8 * j / 9))
    for j in range(3):
        cue(T["exitShaft"] + 0.1 + j * 0.22, sfx("dig_soft"), -12, x2pan(3.2))
    cue(T["breakThrough"], sfx("dig"), -7, x2pan(3.2))
    cue(T["breakThrough"] + 0.02, sfx("pop", 1.1), -12, x2pan(3.2))
    for k, g in enumerate((-8, -15, -21)):
        cue(T["lidLand"] - 0.4 + 0.55 * BOUNCE[k], sfx("knock"), g, x2pan(3.2))
    cue(T["potLand"], sfx("pop", 1.25), -12, x2pan(3.2))
    cue(T["lidLand"] - 0.25, sfx("pop", 0.85), -14, x2pan(3.2))  # ladder
    cue(T["pileAway"], sfx("pop", 0.7), -10, x2pan(-2.0))
    cue(T["pileAway"] + 0.05, sfx("whoosh", 0.6), -17, x2pan(-2.0))
    # 3 - dirt keeps falling, bricks snap into arches, the weight flows round them
    for k in range(5):
        c = T["crumbleStart"] + k * ((T["crumbleEnd"] - T["crumbleStart"] - 0.55) / 4)
        cue(c, sfx("crumble", 1.1), -10, x2pan(-2.35 + k * 1.2))
        for m in range(3):
            cue(c + 0.25 + m * 0.13, sfx("thud", 0.45), -19, x2pan(-2.35 + k * 1.2))
    for k in range(9):
        cue(T["clumpsAway"] + k * 0.03, sfx("pop", 1.0 + 0.08 * (k % 4)), -17, x2pan(-3 + k * 0.75))
    xs = brick_xs()
    nb = len(xs)
    for i in range(0, nb, 2):
        t0 = T["bricksStart"] + (T["bricksEnd"] - T["bricksStart"] - 0.3) * i / (nb - 1)
        cue(t0, sfx("clack", float(0.9 + 0.25 * rnd.uniform())), -13 + 2 * rnd.uniform(), x2pan(xs[i]))
        if i % 6 == 0:
            cue(t0 + 0.01, sfx("pop", 1.1 + 0.1 * (i % 3)), -19, x2pan(xs[i]))
    cue(T["loadStart"], sfx("shimmer", T["loadEnd"] - T["loadStart"] + 0.6), -21, 0.0)
    # 4 - candle, stale air, fizzle, air pipe, fresh air
    cue(T["candleIn"], sfx("pop", 0.9), -13, 0.05)
    cue(T["candleIn"] + 0.08, sfx("strike"), -15, 0.05)
    cue(T["candleOut"] - 0.05, sfx("fizz", 1.1), -7, 0.05)
    cue(T["pipeStart"], sfx("zoom_up", 0.7), -16, x2pan(1.3))
    cue(T["pipeTop"] - 0.05, sfx("pop", 1.15), -11, x2pan(1.3))
    cue(T["capPop"], sfx("pop", 1.4), -12, x2pan(1.3))
    cue(T["freshStart"] - 0.1, sfx("whoosh", 2.6), -9, x2pan(1.3))
    cue(T["staleOut"] + 0.6, sfx("whoosh", 2.0), -15, x2pan(-3.2))
    # 5 - pitch dark, wire, bulbs one by one
    cue(T["darkStart"], sfx("darkness"), -9, 0.0)
    cue(T["wireStart"], sfx("zip", T["wireEnd"] - T["wireStart"]), -15, 0.0)
    for i in range(5):
        cue(T["bulbsHang"] + i * 0.08, sfx("pop", 1.2 + 0.07 * i), -15, x2pan(-2.35 + i * 1.2))
        t0 = T["bulbsOn"] + i * T["bulbGap"]
        cue(t0 - 0.01, sfx("click"), -9, x2pan(-2.35 + i * 1.2))
        cue(t0 + 0.02, sfx("hum"), -20, x2pan(-2.35 + i * 1.2))
    # 6 - snail, rails, the cart
    cue(T["snailIn"], sfx("squelch"), -18, x2pan(-2.6))
    for k in range(12):
        t0 = T["railsStart"] + (T["railsEnd"] - T["railsStart"] - 0.3) * k / 11
        cue(t0 + 0.4 * BOUNCE[0], sfx("clink", float(0.8 + 0.04 * k)), -15, x2pan(-3.2 + 6.4 * k / 11))
    cue(T["cartDrop"], sfx("whistle_down"), -15, x2pan(-3.2))
    cue(T["cartLand"], sfx("thud", 1.0), -7, x2pan(-3.2))
    cue(T["cartLand"] + 0.02, sfx("clink", 0.6), -12, x2pan(-3.2))
    run = T["cartArrive"] - T["cartGo"]
    ride = sfx("cart", run)
    cue(T["cartGo"], ride, -5, np.clip((-3.18 + 6.36 * cart_e(np.arange(len(ride)) / SR / run)) / 5, -0.75, 0.75))
    cue(T["cartArrive"] - 0.2, sfx("squeak"), -15, x2pan(3.1))
    cue(T["cartArrive"], sfx("thud", 0.8), -10, x2pan(3.1))
    # 7 - finale
    cue(T["momIn"], sfx("pop", 0.85), -12, x2pan(3.6))
    cue(T["lidOpen"], sfx("knock"), -6, x2pan(3.2))
    cue(T["lidOpen"] + 0.02, sfx("pop", 1.0), -11, x2pan(3.2))
    cue(T["headOut"], sfx("boing", 1.2, 0.45), -13, x2pan(3.2))
    for k in range(4):  # Aunty slaps the flip-flop on her arm, waiting
        if T["momIn"] + (1.05, 2.3, 3.45, 4.5)[k] < T["lookUp"]:
            cue(T["momIn"] + (1.05, 2.3, 3.45, 4.5)[k], sfx("slap"), -15 if k < 2 else -12, x2pan(3.6))
    for k in range(3):  # the boy climbs the ladder
        cue(T["boyIn"] + 0.15 + k * 0.42, sfx("creak"), -20, x2pan(3.2))
    cue(T["girlUp"], sfx("pop", 1.35), -16, x2pan(2.0))  # girl at the window
    cue(T["girlTake"], sfx("swish"), -19, x2pan(2.0))
    cue(T["lookUp"] + 0.25, sfx("gulp"), -11, x2pan(3.2))
    cue(T["sink"], sfx("slide_down", T["sinkBottom"] - T["sink"] + 0.1), -15, x2pan(3.2))
    for k, g in enumerate((-4, -13, -19)):
        cue(T["lidClose"] + 0.42 * BOUNCE[k], sfx("knock"), g, x2pan(3.2))
    cue(T["lidClose"] + 0.42 * BOUNCE[0] + 0.01, sfx("thud", 0.8), -11, x2pan(3.2))


# ---------------------------------------------------------------------------
# music: light and playful, pizzicato + marimba; stops dead right before
# "Hi, Aunty..." (bar 26 ends exactly at T.musicStop)
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
    y *= np.exp(-tt(d) / 0.22)
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


def woodblock(vel=1.0, f=1250):
    d = 0.12
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t)) * np.exp(-t / 0.025) * vel


CHORDS = {
    "F": ["F", "A", "C"], "D7": ["D", "F#", "A", "C"], "Gm": ["G", "A#", "D"], "C7": ["C", "E", "G", "A#"],
    "Bb": ["A#", "D", "F"], "Bbm": ["A#", "C#", "F"], "Dm": ["D", "F", "A"], "A7": ["A", "C#", "E", "G"], "G7": ["G", "B", "D", "F"],
}
PROG = ["F", "F", "D7", "Gm", "C7", "F", "D7", "Gm", "C7",       # 0-8
        "Bb", "Bbm", "F", "D7", "Gm", "C7", "F", "A7",           # 9-16
        "Bb", "Bbm", "F", "D7", "G7", "C7", "Dm", "Bb", "C7"]    # 17-25, cut dead at the end of bar 25
N_BARS = len(PROG)


def build_music():
    bar = T["musicStop"] / N_BARS
    beat = bar / 4
    out = np.zeros(N + SR * 3)

    def put(t0, y, g=1.0):
        i = int(t0 * SR)
        if i >= len(out):
            return
        out[i : i + len(y)] += y[: len(out) - i] * g

    mel_rng = np.random.default_rng(3)
    motif_a = [(0, 0), (0.5, 1), (1.5, 2), (2.5, 1), (3, 0)]
    motif_b = [(0, 2), (1, 1), (1.5, 0), (2, 1), (3.5, 2)]
    for b_i, ch in enumerate(PROG):
        t_bar = b_i * bar
        tones = CHORDS[ch]
        root = tones[0]
        # pizzicato walking bass
        for bt, n in [(0, root + "2"), (1, tones[2] + "2"), (2, root + "2"), (3, tones[1] + "2")]:
            put(t_bar + bt * beat, pluck(mf(n), 0.5, 0.9 if bt in (0, 2) else 0.6), 0.55)
        if b_i >= 1:
            put(t_bar, pad([mf(n + "4") for n in tones[:3]], bar + 0.2, 1.0), 0.05)
        if b_i >= 1:
            for k in range(8):
                put(t_bar + k * beat / 2, shaker(0.6 if k % 2 else 0.35), 0.1)
            if b_i % 2 == 1:
                put(t_bar + 3.5 * beat, woodblock(0.6), 0.1)
            # a little "tick-tock" tiptoe on the off-beats: we're sneaking
            put(t_bar + 1.5 * beat, woodblock(0.35, 1700), 0.07)
        if b_i >= 2:
            motif = motif_a if (b_i < 9 or b_i >= 17) else motif_b
            octave = "5" if b_i % 4 in (1, 2) else "4"
            for k, (bt, idx) in enumerate(motif):
                if b_i % 4 == 3 and k == len(motif) - 1:
                    continue
                n = tones[idx % len(tones)] + octave
                put(t_bar + bt * beat, marimba(mf(n), 0.8, 0.75 + 0.25 * mel_rng.uniform()), 0.32)
        if b_i == 0:
            for bt in (0, 1.5, 3):
                for n in tones:
                    put(t_bar + bt * beat, marimba(mf(n + "4"), 0.5, 0.5), 0.18)
        # glockenspiel sparkle as the tunnel is finished (bars 22-25)
        if b_i >= 22:
            for bt in (0, 1, 2, 3):
                put(t_bar + bt * beat + beat * 0.5, glock(mf(tones[(bt + b_i) % len(tones)] + "6"), 1.0, 0.6), 0.1)
    music = out[:N]
    rev = np.zeros_like(music)
    for dly, g in [(0.031, 0.32), (0.053, 0.27), (0.079, 0.22), (0.113, 0.17), (0.161, 0.12)]:
        d = int(dly * SR)
        rev[d:] += music[:-d] * g
    music = music + lp(rev, 3500) * 0.6
    # fade in, then stop dead (8 ms ramp, no tail) right before the boy speaks
    t = np.arange(N) / SR
    music *= np.minimum(t / 0.6, 1) * np.clip((T["musicStop"] - t) / 0.008, 0, 1)
    return music


# ---------------------------------------------------------------------------
# voiceover assembly from the timed sentence clips (narrator take + the boy)
# ---------------------------------------------------------------------------
VO_FILES = {"take1": A("vo", "take1.mp3"), "boy": A("vo", "boy.wav")}
# The take swings ~10 LU between lines (the "But..." lines are hushed), so each
# narrator sentence is pulled most of the way to one level. The boy sits just
# under the narrator: quiet and close, but clear in the silence after the music.
NARR_LUFS, NARR_PULL = -23.5, 0.8
BOY_LUFS = -24.5


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
    p = p[-0.691 + 10 * np.log10(p) > -0.691 + 10 * np.log10(np.mean(p)) - 10]
    return -0.691 + 10 * np.log10(np.mean(p))


def build_vo():
    srcs = {}
    for k, f in VO_FILES.items():
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], check=True, capture_output=True).stdout
        srcs[k] = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    out = np.zeros(N)
    for c in TL["VO"]:
        a, b = c["src"]
        src = srcs[c.get("file", "take1")]
        seg = src[int(a * SR) : int(b * SR)]
        seg = fade(seg, 0.012, 0.03)
        lv = loudness(seg)
        if c.get("voice") == "boy":
            g = BOY_LUFS - lv
        else:
            g = float(np.clip((NARR_LUFS - lv) * NARR_PULL, -4, 7))
        seg = seg * 10 ** (g / 20)
        i = int(c["at"] * SR)
        out[i : i + len(seg)] += seg[: N - i]
    return hp(out, 80, 2)


def envelope(x, att=0.02, rel=0.35):
    a = np.abs(x)
    ka, kr = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    blk = 256
    m = np.array([a[i : i + blk].max() for i in range(0, len(a), blk)])
    s = np.zeros_like(m)
    v = 0.0
    for i, val in enumerate(m):
        k = ka ** blk if val > v else kr ** blk
        v = val + (v - val) * k
        s[i] = v
    return np.repeat(s, blk)[: len(a)]


def place(track, t0, snd, gain, pan):
    i = int(t0 * SR)
    if i >= N:
        return
    y = snd[: N - i] * 10 ** (gain / 20)
    pan = np.asarray(pan, dtype=float)
    if pan.ndim:  # a (start, end) sweep or a pan curve over the sound
        pan = np.interp(np.linspace(0, 1, len(y)), np.linspace(0, 1, len(pan)), pan)
    l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    track[0, i : i + len(y)] += y * l
    track[1, i : i + len(y)] += y * r


def main():
    os.makedirs(B("audio"), exist_ok=True)
    vo = build_vo()
    build_cues()
    sfx_bus = np.zeros((2, N))
    for t0, snd, g, pan in CUES:
        place(sfx_bus, t0, snd, g, pan)
    music = build_music()
    music = music / (np.max(np.abs(music)) + 1e-9) * 0.5
    e = envelope(vo)
    duck = 1 - 0.58 * np.clip(e / 0.15, 0, 1)  # soft words duck the music fully too
    duck_sfx = 1 - 0.4 * np.clip(e / 0.15, 0, 1)
    mus_st = np.stack([music * 0.6 + np.roll(music, 240) * 0.1, music * 0.6 + np.roll(music, 480) * 0.1])
    sfx_bus = np.stack([hp(ch, 55, 2) for ch in sfx_bus])
    mix = np.stack([vo, vo]) * 1.0 + sfx_bus * 0.55 * duck_sfx + mus_st * duck * 0.62
    mix = np.stack([hp(ch, 32, 2) for ch in mix])
    mix = np.tanh(mix * 1.15) / 1.15
    for name, arr in [("vo", np.stack([vo, vo])), ("sfx", sfx_bus * 0.55 * duck_sfx), ("music", mus_st * duck * 0.62), ("mix_raw", mix)]:
        write_wav(B("audio", f"{name}.wav"), arr)
    out = mix * 10 ** ((TARGET_LUFS - loudness(mix)) / 20)
    for _ in range(3):  # limiting takes a hair of loudness off: re-gain and re-limit
        out = tp_limit(out)
        out *= 10 ** ((TARGET_LUFS - loudness(out)) / 20)
    out = tp_limit(out)
    write_wav(B("mix.wav"), out, "PCM_24")
    print("wrote", B("mix.wav"), f"({len(CUES)} sound cues, {loudness(out):.2f} LUFS, true peak {true_peak_db(out):.2f} dBTP)")


TARGET_LUFS, CEILING_DB = -14.0, -1.3


def true_peak_db(st):
    return 20 * np.log10(np.max(np.abs(signal.resample_poly(st, 4, 1, axis=1))) + 1e-12)


def tp_limit(st, look=0.002, rel=0.08):
    """look-ahead peak limiter on 4x-oversampled peaks: holds the true peak under CEILING_DB"""
    ceil = 10 ** (CEILING_DB / 20)
    pk = np.abs(signal.resample_poly(st, 4, 1, axis=1)).max(axis=0)
    pk = pk[: 4 * (len(pk) // 4)].reshape(-1, 4).max(axis=1)
    pk = np.pad(pk, (0, st.shape[1] - len(pk)), mode="edge")
    need = np.minimum(1.0, ceil / (pk + 1e-12))
    if need.min() >= 1.0:
        return st
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    L = int(look * SR)
    g = minimum_filter1d(need, 2 * L + 1)  # starts pulling down L samples ahead of a peak
    g = uniform_filter1d(g, L) # smooth attack (still <= need at the peak)
    blk = 32  # release, at a decimated rate
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
    import soundfile as sf
    sf.write(path, np.clip(st.T, -1, 1).astype(np.float32), SR, subtype=subtype)


if __name__ == "__main__":
    main()
