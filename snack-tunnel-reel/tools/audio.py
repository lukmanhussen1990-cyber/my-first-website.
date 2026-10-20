"""Sound for the snack tunnel reel: voice placement, sound effects, music and the mix.

Everything is driven by build/timeline.json (node tools/export_timeline.mjs), so the
sound stays locked to the animation, and every effect and the music are synthesised
here in code. The voice lines (assets/vo/<id>.wav, made by tools/voices.py) sit in
fixed slots (timeline VO[].at); a line that has grown longer than its slot (a new
recording) is sped up a little (atempo, at most 1.12x) and reported. The placement
actually used is written to build/vo_placement.json for the subtitles.

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
    i = int(t0 * SR)
    if 0 <= i < len(out):
        out[i : i + len(y)] += y[: len(out) - i] * g


def grains(d, rate, f1, f2, glen=(0.002, 0.008), shape=None, amp=(0.3, 1.0)):
    """sparse crackle: short band-passed noise bursts"""
    out = np.zeros(int(d * SR))
    for _ in range(rng.poisson(rate * d)):
        st = rng.uniform(0, d)
        if shape is not None and rng.uniform() > shape(st / d):
            continue
        gl = rng.uniform(*glen)
        n = max(8, int(gl * SR))
        g = bp(noise(gl + 0.01), f1, f2)[:n] * np.hanning(n)
        put(out, st, g, rng.uniform(*amp))
    return out


def modes(d, parts, phase=True):
    """sum of decaying sines: [(freq, amp, tau), ...]"""
    t = tt(d)
    return sum(a * np.sin(2 * np.pi * f * t + (rng.uniform(0, 6.28) if phase else 0)) * np.exp(-t / tau) for f, a, tau in parts)


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


def pan(x, t, width=0.6):
    """stereo position of world x at time t: where it sits across the frame"""
    px = (x - CAM_CX(t)) * math.exp(CAM_LS(t))
    return float(np.clip(px / 540.0, -1, 1) * width)


def tunx(t):
    s = WD["tunX"]
    return float(np.interp(t, np.arange(len(s)) / 10.0, s))


def t_tun_passes(x):
    """first time the dig face is past x"""
    s = np.array(WD["tunX"])
    i = int(np.argmax(s >= x))
    return i / 10.0 if s[i] >= x else None


# ---------------------------------------------------------------------------
# sound effects (all synthesised)
# ---------------------------------------------------------------------------
def s_pop(pitch=1.0):
    d = 0.13
    t = tt(d)
    y = chirp((330 + 700 * np.exp(-t / 0.011)) * pitch, d) * env_exp(d, 0.03, 0.0015)
    y += 0.12 * hp(noise(d), 2500) * env_exp(d, 0.0025)
    return norm(lp(y, 6000))


def s_thud(weight=1.0):
    d = 0.5
    t = tt(d)
    y = chirp((44 + 60 * np.exp(-t / 0.05)) / weight ** 0.3, d) * env_exp(d, 0.12 * weight, 0.003)
    y += 0.55 * lp(noise(d), 260) * env_exp(d, 0.045)
    y += 0.1 * bp(noise(d), 900, 3500) * env_exp(d, 0.02)
    return norm(y)


def s_dig():
    """shovel bites into the soil and lifts it: a dull thump with crumbly grit"""
    d = 0.34
    t = tt(d)
    thump = lp(noise(d), 380) * env_exp(d, 0.05, 0.004)
    grit = grains(d, 330, 1200, 5500, shape=lambda u: np.exp(-4 * u))
    scrape = bp(noise(d), 700, 2600) * env_exp(d, 0.03, 0.002)
    body = chirp(68 + 45 * np.exp(-t / 0.03), d) * env_exp(d, 0.06)
    return norm(norm(thump) * 0.8 + norm(grit) * 0.5 + norm(scrape) * 0.3 + norm(body) * 0.45)


def s_dig_soft():
    """a scoop heard from inside the ground: muffled"""
    return norm(lp(s_dig(), 1700) + 0.35 * np.pad(s_thud(0.7), (0, 0))[: int(0.34 * SR)])


def s_toss():
    """a shovelful landing on the pile"""
    d = 0.42
    y = lp(noise(d), 600) * env_exp(d, 0.06, 0.006)
    y += 0.6 * grains(d, 260, 900, 4500, shape=lambda u: np.exp(-5 * u))
    return norm(y)


def s_patter():
    """dirt crumbs bouncing on the tunnel floor"""
    d = 0.35
    return norm(grains(d, 90, 700, 3000, glen=(0.003, 0.01), shape=lambda u: np.exp(-3 * u)))


def s_crumble(d=1.1):
    """the roof gives way: a soft rumble and a rain of grit"""
    t = tt(d)
    shape = lambda u: np.clip(min(u / 0.08, 1.0) * (1 - u) ** 0.7 * 1.3, 0, 1)
    rum = lp(brown(d), 170, 4) * np.minimum(t / 0.06, 1) * np.clip((d - t) / (0.6 * d), 0, 1) ** 0.7
    y = norm(rum) * 0.7 + norm(grains(d, 1100, 1800, 7000, shape=shape)) * 0.5
    y += norm(grains(d, 160, 400, 1400, glen=(0.008, 0.03), shape=shape)) * 0.45
    return norm(y)


def s_knock(pitch=1.0):
    """wood on wood: a dry tok with a hollow body"""
    d = 0.3
    t = tt(d)
    y = modes(d, [(480 * pitch, 1.0, 0.03), (1130 * pitch, 0.6, 0.018), (1760 * pitch, 0.35, 0.011), (230 * pitch, 0.7, 0.05)])
    y += 0.5 * bp(noise(d), 900, 3800) * env_exp(d, 0.004, 0.0004)
    return norm(y * np.minimum(t / 0.0008, 1))


def s_frame():
    """a mine frame snapping into place: post, post, beam"""
    y = np.zeros(int(0.45 * SR))
    put(y, 0.0, s_knock(0.92), 0.8)
    put(y, 0.055, s_knock(1.05), 0.65)
    put(y, 0.12, s_knock(0.8), 1.0)
    put(y, 0.125, s_pop(0.9), 0.25)
    return norm(y)


def s_clang():
    """shovel on rock: a LOUD bright clang, the blade ringing out with a wobble"""
    d = 2.4
    t = tt(d)
    ring = modes(d, [(523, 1.0, 0.9), (529, 0.7, 0.85), (1227, 0.8, 0.55), (1236, 0.5, 0.5), (2107, 0.55, 0.38),
                     (3380, 0.42, 0.25), (4710, 0.26, 0.16), (6230, 0.16, 0.1)])
    wob = 1 + 0.28 * np.sin(2 * np.pi * 8.5 * t) * np.exp(-t / 0.6)
    hit = bp(noise(d), 1500, 9500) * env_exp(d, 0.007, 0.0003)
    thud = chirp(105 + 140 * np.exp(-t / 0.018), d) * env_exp(d, 0.05, 0.0008)
    y = norm(ring * wob) * 0.78 + norm(hit) * 0.65 + norm(thud) * 0.5
    return norm(fade(y, 0.0005, 0.3))


def s_whum():
    """one glowing sound ring passing through the soil"""
    d = 0.5
    t = tt(d)
    return norm(lp(chirp(95 + 25 * np.exp(-t / 0.2), d) * arch(d, 1.5), 400))


def s_jingle(d=0.55, n=7):
    """dog collar: a little bell and the tag"""
    out = np.zeros(int(d * SR))
    for _ in range(n):
        f = rng.uniform(3600, 6200)
        g = modes(0.3, [(f, 1.0, 0.06), (f * 1.47, 0.5, 0.04), (f * 2.09, 0.3, 0.025)]) * env_exp(0.3, 1.0, 0.0006)
        put(out, rng.uniform(0, d * 0.55), g, rng.uniform(0.4, 1.0))
    tag = modes(0.2, [(2800, 1.0, 0.03), (4400, 0.5, 0.02)])
    put(out, 0.0, tag, 0.6)
    return norm(out + 0.06 * hp(noise(d), 5000) * env_exp(d, 0.05))


def s_fwip():
    """ears flicking up"""
    d = 0.16
    t = tt(d)
    return norm(bp(noise(d), 1500, 6000) * arch(d, 2) + 0.35 * chirp(600 + 2200 * (t / d) ** 1.5, d) * arch(d, 1))


def s_spoon():
    """a tiny spoon scraping a crumb of soil"""
    d = 0.13
    t = tt(d)
    scr = bp(noise(d), 2200, 7000) * arch(d, 0.8) * (0.6 + 0.4 * np.sin(2 * np.pi * 95 * t))
    tink = modes(d, [(3900, 1.0, 0.018), (6100, 0.5, 0.011)]) * (t > 0.015)
    return norm(norm(scr) * 0.8 + norm(tink) * 0.35)


def s_pages(d=1.9, n=22):
    """calendar pages flicking past, fast"""
    out = np.zeros(int((d + 0.2) * SR))
    for k in range(n):
        u = k / (n - 1)
        st = d * (u ** 0.85)
        fl = 0.03 + 0.01 * rng.uniform()
        g = bp(noise(fl), 1100, 5200) * np.hanning(int(fl * SR)) * (0.6 + 0.4 * np.sin(2 * np.pi * 180 * tt(fl)))
        put(out, st, g, rng.uniform(0.6, 1.0))
        put(out, st + fl * 0.7, s_knock(2.2)[: int(0.02 * SR)], 0.06)
    return norm(out)


def s_tape(d=2.2):
    """measuring tape pulled out: ratchet clicks and a metal whir, then it locks"""
    t = tt(d)
    rate = 18 + 40 * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.8
    ph = np.cumsum(rate) / SR
    ticks = np.zeros(len(t))
    tick = modes(0.015, [(3200, 1.0, 0.003), (5400, 0.6, 0.002)])
    for i in np.where(np.diff(np.floor(ph)) > 0)[0]:
        ticks[i : i + len(tick)] += tick[: len(ticks) - i]
    whir = bp(noise(d), 1800, 6500) * (0.5 + 0.5 * np.sin(np.pi * np.clip(t / d, 0, 1)))
    y = norm(ticks) * 0.6 + norm(whir) * 0.25
    lock = s_knock(2.5)[: int(0.06 * SR)]
    y = np.concatenate([y, np.zeros(int(0.15 * SR))])
    put(y, d, lock, 0.8)
    return norm(fade(y, 0.01, 0.05))


PENTA = [523.3, 587.3, 659.3, 784.0, 880.0, 1046.5, 1174.7, 1318.5, 1568.0, 1760.0, 2093.0, 2349.3]


def s_ping(k=0):
    """a soft glowing ping for each footprint, stepping up the scale"""
    d = 0.5
    f = PENTA[k % len(PENTA)]
    t = tt(d)
    y = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.04 * np.exp(-t / 0.02))) / SR) * env_exp(d, 0.12, 0.004)
    y += 0.25 * np.sin(2 * np.pi * f * 2 * t) * env_exp(d, 0.05)
    return norm(y)


def s_buzz(d=0.95):
    """little tile cutter: a whining motor grinding through ceramic"""
    t = tt(d)
    spin = np.minimum(t / 0.12, 1) * np.clip((d - t) / 0.12, 0, 1)
    f = 165 + 55 * spin + 6 * np.sin(2 * np.pi * 7 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    motor = sum(np.sin(k * ph) / k ** 1.1 for k in range(1, 10))
    grind = bp(noise(d), 2500, 8000) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 13 * t)))
    y = norm(lp(motor, 3000)) * 0.6 + norm(grind) * 0.45
    return norm(fade(y * (0.25 + 0.75 * spin), 0.01, 0.05))


def s_zing():
    """the glowing cut line closes"""
    d = 0.6
    t = tt(d)
    y = chirp(1400 + 900 * t, d) * env_exp(d, 0.18, 0.005) + 0.4 * chirp(2100 + 1300 * t, d) * env_exp(d, 0.1)
    return norm(y)


def s_hinge():
    """a hinge clicking into place"""
    d = 0.12
    t = tt(d)
    y = modes(d, [(1700, 1.0, 0.012), (4100, 0.7, 0.007), (6800, 0.3, 0.004)]) + 0.5 * bp(noise(d), 2500, 9000) * env_exp(d, 0.003, 0.0003)
    y2 = np.concatenate([y, np.zeros(int(0.03 * SR)), 0.55 * y])
    return norm(y2)


def s_creak(d=0.5, f0=170, f1=330, bright=1.0):
    """wood creak: stick-slip pulses through the wood's resonances"""
    t = tt(d)
    rate = f0 + (f1 - f0) * np.sin(np.pi * np.clip(t / d, 0, 1)) + 12 * np.sin(2 * np.pi * 9 * t)
    ph = np.cumsum(rate) / SR
    imp = (np.diff(np.floor(ph), prepend=0) > 0).astype(float) * (0.7 + 0.3 * rng.uniform(size=len(t)))
    y = signal.lfilter([1], [1, -0.96], imp)
    y = bp(y, 380, 2400 * bright) + 0.6 * bp(y, 850, 1300)
    return norm(y * arch(d, 0.6))


def s_whoosh(d=0.9, lo=380, hi=1900):
    t = tt(d)
    y = noise(d)
    out = np.zeros_like(y)
    blk = 1024
    for i in range(0, len(y), blk):
        u = i / len(y)
        fc = lo + (hi - lo) * np.sin(np.pi * u) ** 1.5
        seg = bp(y[max(0, i - 2048) : i + blk], fc * 0.7, fc * 1.4)[-min(blk, len(y) - i):]
        out[i : i + len(seg)] = seg
    return norm(out * arch(d, 1.2))


def s_flip():
    """the trapdoor tile flips up on its hinges and lands open"""
    y = np.zeros(int(0.7 * SR))
    put(y, 0.0, s_creak(0.22, 260, 420), 0.5)
    put(y, 0.05, s_whoosh(0.28, 600, 2200), 0.35)
    put(y, 0.3, s_knock(0.75), 1.0)
    put(y, 0.3, s_thud(0.5)[: int(0.3 * SR)], 0.4)
    return norm(y)


def s_shut():
    """the trapdoor tile dropping shut: wood and tile on concrete"""
    y = np.zeros(int(0.5 * SR))
    put(y, 0.0, s_knock(0.7), 1.0)
    put(y, 0.0, s_thud(0.6)[: int(0.4 * SR)], 0.55)
    put(y, 0.004, s_tap()[: int(0.1 * SR)], 0.3)
    return norm(y)


def s_tap():
    """spoon on solid tile and concrete: a hard little tok"""
    d = 0.3
    t = tt(d)
    y = modes(d, [(2650, 1.0, 0.012), (1150, 0.7, 0.02), (4300, 0.4, 0.007)])
    y += 0.7 * chirp(70 + 90 * np.exp(-t / 0.01), d) * env_exp(d, 0.035, 0.0005)
    y += 0.3 * bp(noise(d), 1500, 6000) * env_exp(d, 0.004, 0.0003)
    return norm(y)


def s_squeak(pitch=1.0):
    """the pulley wheel: wheee"""
    d = 0.2
    t = tt(d)
    f = (2150 + 380 * np.sin(np.pi * t / d)) * pitch * (1 + 0.012 * np.sin(2 * np.pi * 33 * t))
    y = chirp(f, d) + 0.25 * chirp(f * 2.01, d)
    return norm(lp(y, 7000) * arch(d, 0.9))


def s_squeaks(d, period=0.34, pitch=1.0):
    """squeak... squeak... while the rope runs"""
    out = np.zeros(int((d + 0.3) * SR))
    k, t0 = 0, 0.0
    while t0 < d:
        put(out, t0, s_squeak(pitch * (1.0 if k % 2 == 0 else 0.88)), 0.8 if k % 2 == 0 else 0.6)
        put(out, t0 + 0.05, s_creak(0.16, 150, 230, 0.6), 0.18)
        t0 += period * (0.9 + 0.2 * rng.uniform())
        k += 1
    return norm(out)


def s_wicker():
    """the little basket touching down"""
    d = 0.35
    y = 0.5 * grains(d, 260, 1200, 6000, glen=(0.002, 0.006), shape=lambda u: np.exp(-6 * u))
    put(y, 0.0, s_knock(0.6), 0.8)
    return norm(y)


def s_slide_off():
    """the basket pushed off the trapdoor, sliding onto the tiles"""
    d = 0.42
    y = bp(noise(d), 900, 4500) * arch(d, 0.8) * 0.5 + grains(d, 200, 1500, 6000) * 0.3
    out = np.zeros(int(0.7 * SR))
    put(out, 0, norm(y))
    put(out, 0.4, s_wicker(), 0.7)
    return norm(out)


def s_crinkle(d=0.35):
    """a bag of chips crinkling"""
    return norm(grains(d, 900, 1800, 10000, glen=(0.001, 0.005), shape=lambda u: np.sin(np.pi * u)) + 0.05 * hp(noise(d), 4000) * arch(d))


def s_clink(pitch=1.0):
    """glass cookie jar"""
    return norm(modes(0.4, [(2100 * pitch, 1, 0.08), (3350 * pitch, 0.6, 0.05), (5200 * pitch, 0.3, 0.03)]))


def s_crunch(bites=3):
    """crunchy chips: a bite and a couple of chews"""
    out = np.zeros(int(0.75 * SR))
    st = 0.0
    for b in range(bites):
        d = 0.09 if b == 0 else 0.07
        y = grains(d, 2400 if b == 0 else 1700, 1400, 9500, glen=(0.0008, 0.004), amp=(0.4, 1.0))
        y += 0.4 * lp(noise(d), 500) * env_exp(d, 0.02, 0.001)
        put(out, st, norm(y), 1.0 if b == 0 else 0.7)
        st += 0.16 + 0.05 * rng.uniform()
    return norm(out)


def s_fridge_open():
    """fridge door unsticking: a soft suction thwup and the seal peeling"""
    d = 0.45
    t = tt(d)
    y = chirp(140 * np.exp(-t / 0.12) + 50, d) * env_exp(d, 0.09, 0.01)
    y += 0.4 * bp(noise(d), 700, 3000) * env_exp(d, 0.05, 0.004)
    out = np.zeros(int(0.8 * SR))
    put(out, 0, norm(y))
    put(out, 0.08, s_creak(0.35, 140, 210, 0.7), 0.25)
    return norm(out)


def s_click():
    """the fridge light (or headlamp) switching on"""
    d = 0.05
    t = tt(d)
    y = (np.sin(2 * np.pi * 3100 * t) + 0.7 * np.sin(2 * np.pi * 5200 * t)) * np.exp(-t / 0.004)
    y += 0.5 * bp(noise(d), 2500, 9000) * np.exp(-t / 0.003)
    return norm(y)


def s_shimmer(d=1.3):
    """the top shelf lighting up"""
    out = np.zeros(int((d + 0.6) * SR))
    for k, f in enumerate([1568.0, 1760.0, 2093.0, 2349.3, 2637.0, 3136.0]):
        put(out, d * k / 6, modes(0.6, [(f, 1.0, 0.25), (f * 2.01, 0.3, 0.1)]), 0.6 + 0.4 * rng.uniform())
    out += norm(bp(noise(len(out) / SR), 3000, 8000)) * 0.08 * np.hanning(len(out))
    return norm(out)


def s_blip():
    """the thought bubble appearing: a soft magic blip"""
    d = 0.6
    t = tt(d)
    y = chirp(660 * (1 + 0.6 * (1 - np.exp(-t / 0.05))), d) * env_exp(d, 0.18, 0.01)
    y += 0.35 * chirp(1320 * (1 + 0.6 * (1 - np.exp(-t / 0.05))), d) * env_exp(d, 0.1, 0.01)
    return norm(y)


def s_bubble_pop():
    """the thought bubble sags... and pops"""
    d = 0.32
    t = tt(d)
    sag = chirp(520 - 260 * (t / d), d) * arch(d, 0.6) * 0.5
    out = np.zeros(int(0.5 * SR))
    put(out, 0, sag)
    put(out, 0.2, s_pop(1.3), 1.0)
    put(out, 0.2, hp(noise(0.05), 3000) * env_exp(0.05, 0.008), 0.3)
    return norm(out)


def s_poof():
    """the shovel vanishing in a puff"""
    d = 0.35
    t = tt(d)
    return norm(lp(noise(d), 1400) * env_exp(d, 0.08, 0.01) + 0.3 * chirp(500 * np.exp(-t / 0.1) + 150, d) * env_exp(d, 0.1))


def s_lantern():
    """a lantern hooked onto a beam: a small chain clink and a warm swell"""
    out = np.zeros(int(1.4 * SR))
    put(out, 0, s_clink(1.35), 0.6)
    put(out, 0.07, s_clink(1.6), 0.35)
    d = 1.2
    t = tt(d)
    warm = sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate([392.0, 493.9, 587.3])) * arch(d, 1.6) * 0.3
    put(out, 0.05, warm, 0.5)
    return norm(out)


def s_slide_down(d=0.8):
    """slow slide whistle as he sinks back"""
    t = tt(d)
    f = 1100 * np.exp(-1.3 * t / d) + 180
    y = chirp(f * (1 + 0.012 * np.sin(2 * np.pi * 5.5 * t)), d) + 0.1 * chirp(f * 2, d)
    return norm(fade(lp(y, 3500), 0.05, 0.15))


def s_boing(pitch=1.0, d=0.45):
    t = tt(d)
    f = (230 + 60 * t) * pitch * (1 + 0.3 * np.exp(-4 * t) * np.sin(2 * np.pi * 14 * t))
    return norm(chirp(f, d) * env_exp(d, 0.2, 0.003) + 0.25 * chirp(f * 2.0, d) * env_exp(d, 0.1))


def s_gulp():
    d = 0.32
    t = tt(d)
    f = 520 * np.exp(-t / 0.08) + 140
    y = chirp(f, d) * arch(d, 0.8) + 0.4 * chirp(f * 0.5, d) * np.exp(-t / 0.12)
    return norm(lp(y, 2000))


def s_bwip(up=True):
    """cartoon eyebrow: a quick little pitch flick"""
    d = 0.14
    t = tt(d)
    f = 700 + 1100 * (t / d) ** 1.3 if up else 1600 - 900 * (t / d)
    return norm(chirp(f, d) * arch(d, 0.7))


def s_snore():
    """the dog asleep: a slow breath in, a puffy breath out"""
    d = 2.3
    t = tt(d)
    inhale = bp(noise(d), 300, 1300) * (np.clip(t / 0.9, 0, 1) ** 1.5) * (t < 0.95)
    ex_t = np.clip(t - 1.05, 0, None)
    exhale = lp(noise(d), 700) * (t >= 1.05) * np.exp(-ex_t / 0.35) * np.minimum(ex_t / 0.05, 1)
    rumble = np.sin(2 * np.pi * 52 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 26 * t)) * (t >= 1.05) * np.exp(-ex_t / 0.3) * 0.4
    return norm(fade(norm(inhale) * 0.45 + norm(exhale) * 0.7 + rumble, 0.05, 0.2))


def s_sigh():
    """the dog flopping back down"""
    d = 0.7
    t = tt(d)
    return norm(lp(noise(d), 900) * env_exp(d, 0.25, 0.02) + 0.3 * np.sin(2 * np.pi * 60 * t) * env_exp(d, 0.2))


def crickets(d):
    """night ambience: two crickets far apart and a faint breeze"""
    out = np.zeros((2, int(d * SR)))
    for ch, (f, rate, ph0) in enumerate([(4350.0, 1.7, 0.0), (4780.0, 2.15, 0.37)]):
        t0 = ph0
        while t0 < d:
            n_p = 3 + int(rng.integers(0, 2))
            for p in range(n_p):
                pl = 0.016
                g = np.sin(2 * np.pi * f * tt(pl)) * np.hanning(int(pl * SR))
                put(out[ch], t0 + p * 0.032, g, 0.7 + 0.3 * rng.uniform())
                put(out[1 - ch], t0 + p * 0.032 + 0.012, g, 0.18)
            t0 += (1.0 / rate) * (0.85 + 0.3 * rng.uniform())
    breeze = lp(pink(d), 500) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * tt(d)))
    out += np.stack([breeze, np.roll(breeze, 900)]) * 0.04
    return out / (np.max(np.abs(out)) + 1e-9)


VARY = {"pop", "dig", "dig_soft", "toss", "patter", "knock", "frame", "spoon", "jingle", "tap", "crunch", "squeak", "wicker", "crinkle"}
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
CUES = []  # (time, sound, gain dB, pan or (from, to) sweep, ducked under the voice?)


def cue(t, snd, gain_db, x=None, p=None, duck=True):
    """x: world x of the source (panned by where it sits on screen at t); duck=False
    keeps a hit at full level even under the narration (the clang must be LOUD)"""
    if p is None:
        p = pan(x, t) if x is not None else 0.0
    CUES.append((t, snd, gain_db, p, duck))


FRIDGE_X = 4.9
SHAFT_X = (WD["SHAFT"]["x0"] + WD["SHAFT"]["x1"]) / 2
DOG_X = (WD["DOGHOUSE"]["x0"] + WD["DOGHOUSE"]["x1"]) / 2
TRAP_X = (WD["TILE"]["x0"] + WD["TILE"]["x1"]) / 2
PILE_X = -5.25
BACKDOOR_X = 0.82
SHELF_X = 3.25


def build_cues():
    # 1 - shaft and the sideways dig, the pile, the snack dream
    for s in WD["SCOOP_T"]:
        if s["kind"] == "up":
            cue(s["t"] - 0.03, sfx("dig"), -9, SHAFT_X)
            cue(s["t"] + 0.82, sfx("toss"), -17, PILE_X)
        else:
            x = tunx(s["t"])
            cue(s["t"] - 0.03, sfx("dig_soft"), -11, x)
            cue(s["t"] + 0.42, sfx("patter"), -23, x - 0.4)
    cue(T["dream"], sfx("blip"), -15, tunx(T["dream"]) - 0.45)
    cue(T["dreamPop"], sfx("bubble_pop"), -11, tunx(T["dreamPop"]) - 0.45)
    # the dog snoring away (until the clang wakes it, and again after the stare)
    t0 = 0.4
    while t0 < T["dogEyes"] - 2.0:
        cue(t0, sfx("snore"), -27, DOG_X)
        t0 += 2.45
    # 2 - roof caves in, mine frames, lantern
    for k, c in enumerate(WD["CAVES"]):
        cue(c["t"], sfx("crumble", 1.0 + 0.1 * k), -11, c["x"])
        for m in range(4):
            cue(c["t"] + 0.43 + 0.07 * m + 0.1 * rng.uniform(), sfx("thud", 0.45), -20, c["x"])
    for i, x in enumerate(WD["FRAMES_A"]):
        cue(T["frames0"] + i * T["frameGap"], sfx("frame"), -10, x)
    lan = WD["LANTERNS"]
    cue(lan[0]["t"], sfx("lantern"), -13, lan[0]["x"])
    # 3 - the clang, the rings, the dog wakes, spoon, calendar
    rx = WD["ROCK"]["x"]
    cue(T["clang"], sfx("clang"), -3, rx, duck=False)
    for k in range(3):
        cue(T["clang"] + 0.03 + k * 0.2, sfx("whum"), -22, rx)
    cue(T["dogEyes"], sfx("pop", 1.5), -15, DOG_X)
    cue(T["dogEyes"] + 0.02, sfx("jingle"), -15, DOG_X)
    cue(T["dogEars"], sfx("fwip"), -16, DOG_X)
    cue(T["dogEars"] + 0.02, sfx("jingle"), -12, DOG_X)
    cue(T["dogEars"] + 0.9, sfx("jingle", 0.4, 4), -18, DOG_X)  # looking round
    cue(T["spoonSwap"], sfx("poof"), -13, tunx(T["spoonSwap"]))
    cue(T["spoonSwap"] + 0.12, sfx("pop", 1.6), -13, tunx(T["spoonSwap"]))
    for ts in WD["SPOON_T"]:
        cue(ts, sfx("spoon"), -16, tunx(ts))
    cue(T["cal0"], sfx("pages", T["cal1"] - T["cal0"]), -12, tunx(T["cal0"]) - 0.6)
    # 4 - up into the doghouse, the stare, the sink, measuring, on under the house
    for k in range(3):
        cue(T["dogUp0"] + 0.06 + k * 0.25, sfx("dig_soft"), -12, DOG_X)
    cue(T["popUp"], sfx("creak", 0.28, 260, 420), -10, DOG_X)
    cue(T["popUp"] + 0.02, sfx("boing", 1.25, 0.4), -14, DOG_X)
    cue(T["popUp"] + 0.75, sfx("jingle", 0.3, 3), -21, DOG_X)  # the dog: ...
    cue(T["sink0"], sfx("slide_down", T["sink1"] - T["sink0"]), -15, DOG_X)
    cue(T["sink1"], sfx("knock", 0.7), -11, DOG_X)  # the floorboards drop back
    cue(T["dogSleep2"], sfx("jingle", 0.4, 4), -18, DOG_X)
    cue(T["dogSleep2"] + 0.1, sfx("sigh"), -17, DOG_X)
    t0 = T["dogSleep2"] + 1.2
    while t0 < T["musicStop"] - 2.4:
        cue(t0, sfx("snore"), -29, DOG_X)
        t0 += 2.5
    cue(T["tape0"], sfx("tape", T["tape1"] - T["tape0"]), -13, p=(pan(-0.7, T["tape0"]), pan(TRAP_X, T["tape1"])))
    for i in range(12):
        ts = T["steps0"] + i * T["stepGap"]
        cue(ts, sfx("ping", i), -18, BACKDOOR_X + (TRAP_X - BACKDOOR_X) * i / 11)
    for x in WD["FRAMES_B"]:
        tp = t_tun_passes(x + 0.3)
        if tp is not None:
            cue(tp + 0.05, sfx("frame"), -14, x)
    for l in lan[1:]:
        cue(l["t"], sfx("lantern"), -17, l["x"])
    # 5 - up under the kitchen, solid tile, the cut, hinges, trapdoor
    for k in range(3):
        cue(T["kitUp0"] + 0.05 + k * 0.2, sfx("dig_soft"), -12, TRAP_X)
    cue(T["tap1"], sfx("tap"), -8, TRAP_X)
    cue(T["tap2"], sfx("tap"), -8, TRAP_X)
    cue(T["cut0"], sfx("buzz", T["cut1"] - T["cut0"]), -10, TRAP_X)
    cue(T["cut1"] - 0.05, sfx("zing"), -17, TRAP_X)
    cue(T["hinge1"], sfx("hinge"), -11, TRAP_X - 0.15)
    cue(T["hinge2"], sfx("hinge"), -11, TRAP_X + 0.15)
    cue(T["trapOpen"] - 0.05, sfx("flip"), -9, TRAP_X)
    # 6 - the top shelf, the pulley, the snacks lowered into the tunnel
    cue(T["shelfGlow"], sfx("shimmer"), -17, SHELF_X)
    parts = [sfx("knock", 1.1), sfx("knock", 0.95), sfx("squeak", 1.15), sfx("whoosh", 0.25, 900, 3000), sfx("wicker")]
    for k, snd in enumerate(parts):
        cue(T["pulley0"] + k * T["pulleyGap"], snd, -12, TRAP_X)
        cue(T["pulley0"] + k * T["pulleyGap"] + 0.01, sfx("pop", 1.0 + 0.1 * k), -19, TRAP_X)
    cue(T["hopChips"], sfx("crinkle"), -13, SHELF_X)
    cue(T["hopChips"] + 0.02, sfx("pop", 1.2), -16, SHELF_X)
    cue(T["hopJar"], sfx("clink"), -14, SHELF_X)
    cue(T["hopJar"] + 0.02, sfx("pop", 1.35), -17, SHELF_X)
    cue(T["lower0"], sfx("squeaks", T["lower1"] - T["lower0"]), -14, TRAP_X)
    cue(T["lower1"], sfx("wicker"), -12, TRAP_X)
    cue(T["munch"], sfx("crunch"), -10, TRAP_X)
    cue(T["munch"] + 0.62, sfx("crunch", 2), -13, TRAP_X)
    cue(T["basketUp0"], sfx("squeaks", T["basketUp1"] - T["basketUp0"], 0.3, 1.08), -17, TRAP_X)
    cue(T["trapClose1"], sfx("shut"), -12, TRAP_X)
    # 7 - the finale
    cue(T["wide0"] + 0.2, sfx("whoosh", 1.4, 250, 900), -24, 0.0)
    cue(T["basket2_0"], sfx("squeaks", T["basket2_1"] - T["basket2_0"] - 0.1, 0.36), -15, TRAP_X)
    cue(T["basket2_1"], sfx("wicker"), -11, TRAP_X)
    cue(T["confused"], sfx("bwip", False), -21, TRAP_X)
    cue(T["peek0"], sfx("creak", 0.4, 200, 330), -12, TRAP_X)
    cue(T["peek0"] + 0.12, sfx("slide_off"), -15, TRAP_X + 0.3)
    cue(T["peek0"] + 0.2, sfx("click"), -19, TRAP_X)  # headlamp on
    cue(T["fridgeOpen"], sfx("fridge_open"), -13, FRIDGE_X)
    cue(T["fridgeOn"], sfx("click"), -6, FRIDGE_X)
    cue(T["crunch1"], sfx("crunch"), -8, WD["MOM_POS"]["x"])
    cue(T["crunch2"], sfx("crunch", 2), -9, WD["MOM_POS"]["x"])
    cue(T["brow"], sfx("bwip"), -18, WD["MOM_POS"]["x"])
    cue(T["nervous"], sfx("gulp"), -16, TRAP_X)
    cue(T["close0"], sfx("creak", T["close1"] - T["close0"], 160, 260, 0.8), -15, TRAP_X)
    cue(T["close1"], sfx("shut"), -11, TRAP_X)
    cue(T["crunch3"], sfx("crunch"), -8, WD["MOM_POS"]["x"])


# ---------------------------------------------------------------------------
# music: a soft, sneaky night-time tiptoe (pizzicato, marimba, celesta, soft
# bass, shaker, woodblock tiptoes) in D minor. 22 bars end exactly at
# T.musicStop, on an unresolved A7, and it stops dead there.
# ---------------------------------------------------------------------------
NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def mf(name):
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[n] + 12 * (o + 1) - 69) / 12)


def marimba(f, d=0.8, vel=1.0):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / (0.26 + 55 / f))
    y += 0.3 * np.sin(2 * np.pi * f * 3.98 * t) * np.exp(-t / 0.06)
    y += 0.06 * np.sin(2 * np.pi * f * 9.9 * t) * np.exp(-t / 0.025)
    y += 0.06 * bp(noise(d), 1500, 4000) * np.exp(-t / 0.004)
    return fade(y * vel, 0.001, 0.05)


def celesta(f, d=1.2, vel=1.0):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55) + 0.3 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t / 0.12)
    y += 0.12 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.3)
    return fade(y * vel, 0.001, 0.1)


def pluck(f, d=0.45, vel=1.0, bright=0.5, decay=0.2):
    """pizzicato string (Karplus-Strong)"""
    L = int(SR / f)
    n = int(d * SR)
    exc = np.zeros(n)
    exc[:L] = lp(noise(L / SR + 0.001), 1200 + 3000 * bright)[:L]
    a = np.zeros(L + 2)
    a[0], a[L], a[L + 1] = 1, -0.996 * 0.5, -0.996 * 0.5
    y = signal.lfilter([1.0], a, exc) * np.exp(-tt(d) / decay)
    return fade(lp(y, 2600) * vel, 0.002, 0.06)


def bass(f, d=0.42, vel=1.0):
    """soft round upright-ish bass"""
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.08) + 0.12 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.05)
    return fade(y * env_exp(d, 0.22, 0.006) * vel, 0.004, 0.05)


def shaker(vel=1.0):
    d = 0.06
    return hp(noise(d), 6500) * env_exp(d, 0.012, 0.004) * vel


def woodblock(vel=1.0, f=1250):
    d = 0.12
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t)) * np.exp(-t / 0.025) * vel


CHORDS = {
    "Dm": ["D", "F", "A"], "Gm": ["G", "A#", "D"], "A7": ["A", "C#", "E", "G"], "Bb": ["A#", "D", "F"],
    "F": ["F", "A", "C"], "C": ["C", "E", "G"], "Gm6": ["G", "A#", "D", "E"],
}
PROG = ["Dm", "Dm", "Gm", "A7", "Dm", "Dm", "Gm6", "A7",     # 0-7   yard, frames, the clang
        "Bb", "A7", "Dm", "Dm", "Gm", "A7", "F", "C",        # 8-15  spoon, doghouse, on to the house, the tile
        "Dm", "A7", "Bb", "F", "Gm", "A7"]                   # 16-21 the shelf, the pulley, the finale; cut on A7
N_BARS = len(PROG)
# tiptoe melody patterns: (beat, chord tone index, octave offset); negative index = passing tone below
PAT_A = [(0.5, 0, 0), (1.0, 1, 0), (1.5, 2, 0), (2.5, 1, 0), (3.5, 0, 1)]
PAT_B = [(0.0, 2, 0), (0.75, -1, 0), (1.0, 2, 0), (2.0, 1, 0), (3.0, 0, 0)]


def build_music():
    bar = T["musicStop"] / N_BARS
    beat = bar / 4
    out = np.zeros(N + SR * 3)
    rmel = np.random.default_rng(3)

    def tone(ch, idx, octv):
        tones = CHORDS[ch]
        if idx < 0:  # chromatic step below the fifth: the sneaky "slink"
            f = mf(tones[2 % len(tones)] + str(5 + octv)) * 2 ** (-1 / 12)
            return f
        return mf(tones[idx % len(tones)] + str(5 + octv - (1 if idx >= len(tones) else 0)))

    for b_i, ch in enumerate(PROG):
        t_bar = b_i * bar
        tones = CHORDS[ch]
        root = tones[0]
        fin = b_i >= 20  # suspense: just the bass ostinato and the tiptoes
        # walking bass (staccato tiptoe steps on every beat; eighths in the suspense bars)
        steps = [(0, root + "2"), (1, tones[2] + "2"), (2, root + "2"), (3, tones[1] + "2")]
        if fin:
            steps = [(k * 0.5, (root if k % 2 == 0 else tones[2]) + "2") for k in range(8)]
        for bt, n in steps:
            put(out, t_bar + bt * beat, bass(mf(n), 0.3 if fin else 0.42, 0.9 if bt in (0, 2) else 0.65), 0.5)
            put(out, t_bar + bt * beat, pluck(mf(n) * 2, 0.3, 0.5, 0.3), 0.2)
        # pizzicato chord "plinks" on the off-beats
        if 1 <= b_i and not fin:
            for bt in (1.5, 3.5):
                for n in tones[:3]:
                    put(out, t_bar + bt * beat, pluck(mf(n + "4"), 0.35, 0.45, 0.6), 0.12)
        # tiptoe woodblock and a light shaker
        if b_i >= 1:
            put(out, t_bar + 1.5 * beat, woodblock(0.35, 1700), 0.06)
            put(out, t_bar + 3.5 * beat, woodblock(0.3, 1450), 0.05)
            for k in range(8):
                put(out, t_bar + k * beat / 2, shaker(0.55 if k % 2 else 0.3), 0.07)
        # melody: marimba in the yard, celesta once we reach the kitchen
        if 2 <= b_i < 20:
            pat = PAT_A if (b_i // 2) % 2 == 0 else PAT_B
            for k, (bt, idx, oc) in enumerate(pat):
                if b_i % 4 == 3 and k == len(pat) - 1:
                    continue  # breathe at the end of each phrase
                f = tone(ch, idx, oc - 1)
                vel = 0.75 + 0.25 * rmel.uniform()
                if b_i < 14:
                    put(out, t_bar + bt * beat, marimba(f, 0.7, vel), 0.3)
                else:
                    put(out, t_bar + bt * beat, celesta(f * 2, 1.0, vel), 0.17)
                    put(out, t_bar + bt * beat, marimba(f, 0.6, vel * 0.6), 0.14)
        # "Congratulations": a little sparkle up the chord (bar 19)
        if b_i == 19:
            for k, n in enumerate(tones * 2):
                put(out, t_bar + k * beat / 2, celesta(mf(n + ("6" if k >= 3 else "5")), 1.1, 0.8), 0.14)
        # the last bar: a sneaky chromatic climb on the A7... and nothing after it
        if b_i == 21:
            for k, n in enumerate(["A4", "A#4", "B4", "C5", "C#5", "D5", "D#5", "E5"]):
                put(out, t_bar + k * beat / 2, marimba(mf(n), 0.35, 0.55 + 0.05 * k), 0.24)
    music = out[:N]
    rev = np.zeros_like(music)
    for dly, g in [(0.031, 0.3), (0.053, 0.25), (0.079, 0.2), (0.113, 0.15), (0.161, 0.11), (0.23, 0.07)]:
        d = int(dly * SR)
        rev[d:] += music[:-d] * g
    music = music + lp(rev, 3500) * 0.55
    t = np.arange(N) / SR
    # gentle fade in; a beat of near-silence for the stare in the doghouse; a dip on
    # the clang; then a dead stop (8 ms ramp, no tail) right before Mom speaks
    shape = np.minimum(t / 0.6, 1)
    shape *= 1 - 0.8 * np.clip((t - (T["popUp"] + 0.05)) / 0.08, 0, 1) * np.clip(((T["sink0"] + 0.05) - t) / 0.2, 0, 1)
    shape *= 1 - 0.5 * np.clip((t - T["clang"]) / 0.02, 0, 1) * np.clip(((T["clang"] + 0.9) - t) / 0.6, 0, 1)
    shape *= np.clip((T["musicStop"] - t) / 0.008, 0, 1)
    return music * shape


# ---------------------------------------------------------------------------
# voice: each line in its slot, levelled, sped up a hair only if it overruns
# ---------------------------------------------------------------------------
NARR_LUFS = -23.0
MOM_LUFS = -23.0
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
    p = p[-0.691 + 10 * np.log10(p) > -0.691 + 10 * np.log10(np.mean(p)) - 10]
    return -0.691 + 10 * np.log10(np.mean(p))


def read_audio(path, tempo=1.0):
    af = ["-af", f"atempo={tempo:.4f}"] if abs(tempo - 1.0) > 1e-4 else []
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, *af, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def build_vo():
    lines = {l["id"]: l for l in SCRIPT["lines"]}
    slots = TL["VO"]
    out = np.zeros(N)
    placement = {}
    for k, s in enumerate(slots):
        line = lines[s["id"]]
        path = A("vo", f"{s['id']}.wav")
        y = read_audio(path)
        dur = len(y) / SR
        # room: until the next line starts (and the music stop, for the last narrator line)
        end = slots[k + 1]["at"] - 0.12 if k + 1 < len(slots) else DUR - 0.25
        if s["id"] != "mom" and k + 1 < len(slots) and slots[k + 1]["id"] == "mom":
            end = min(end, T["musicStop"] - 0.12)
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
        y = fade(y, 0.01, 0.03)
        lv = loudness(y)
        g = (MOM_LUFS if line["speaker"] == "mom" else NARR_LUFS) - lv
        y = y * 10 ** (g / 20)
        put(out, s["at"], y)
        placement[s["id"]] = {"at": s["at"], "tempo": round(tempo, 4), "duration": round(len(y) / SR, 3), "gain_db": round(g, 2)}
    json.dump(placement, open(B("vo_placement.json"), "w"), indent=1)
    return hp(out, 80, 2)


# ---------------------------------------------------------------------------
# mix
# ---------------------------------------------------------------------------
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


def place(track, t0, snd, gain, p):
    i = int(t0 * SR)
    if i >= N or i < 0:
        return
    y = snd[: N - i] * 10 ** (gain / 20)
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
    vo = build_vo()
    build_cues()
    sfx_bus, hits = np.zeros((2, N)), np.zeros((2, N))
    for t0, snd, g, p, ducked in CUES:
        place(sfx_bus if ducked else hits, t0, snd, g, p)
    sfx_bus = np.stack([hp(ch, 50, 2) for ch in sfx_bus])
    hits = np.stack([hp(ch, 50, 2) for ch in hits])
    music = build_music()
    music = music / (np.max(np.abs(music)) + 1e-9) * 0.5
    mus_st = np.stack([music * 0.62 + np.roll(music, 240) * 0.1, music * 0.62 + np.roll(music, 480) * 0.1])
    # night ambience, cut dead with the music
    amb = crickets(DUR)[:, :N]
    t = np.arange(N) / SR
    amb *= (np.minimum(t / 1.5, 1) * np.clip((T["musicStop"] - t) / 0.008, 0, 1)) * 0.05
    e = envelope(vo)
    talk = np.clip(e / 0.12, 0, 1)
    duck_mus = 1 - 0.62 * talk
    duck_sfx = 1 - 0.38 * talk
    duck_amb = 1 - 0.5 * talk
    stems = {
        "vo": np.stack([vo, vo]),
        "sfx": sfx_bus * 0.65 * duck_sfx + hits * 0.65,
        "music": mus_st * 0.6 * duck_mus,
        "ambience": amb * duck_amb,
    }
    mix = sum(stems.values())
    mix = np.stack([hp(ch, 32, 2) for ch in mix])
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
    print("wrote", B("mix.wav"), f"({len(CUES)} sound cues, {loudness(out):.2f} LUFS, true peak {true_peak_db(out):.2f} dBTP)")


if __name__ == "__main__":
    main()
