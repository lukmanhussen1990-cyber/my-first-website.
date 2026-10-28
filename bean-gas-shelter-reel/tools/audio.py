"""Sound for the bean gas shelter reel: voice placement, sound effects, music and the mix.

Everything is driven by build/timeline.json (node tools/export_timeline.mjs), so the
sound stays locked to the animation, and every effect and the music are synthesised
here in code. The voice lines (assets/vo/<id>.wav) sit in fixed slots (timeline
VO[].at). A slot can take only some of a line's words ("Time's up." on its own, then
the rest), cut in the middle of the pause between them. A line that has grown longer
than its slot (a new recording) is sped up a little (atempo, at most 1.12x) and
reported. The placement actually used is written to build/vo_placement.json for the
subtitles.

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
rng = np.random.default_rng(20261028)


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
# camera -> stereo position: where a source sits across the frame (the camera is
# sampled every 0.1 s by tools/export_timeline.mjs, with the renderer's own easing)
# ---------------------------------------------------------------------------
CT = np.arange(len(TL["CAMS"]["cx"])) / 10.0


def cam(key, t):
    return float(np.interp(t, CT, TL["CAMS"][key]))


def pan(x, t, z=-1.0, width=0.7):
    """stereo position of a source at world (x, z) at time t"""
    px = (x - cam("cx", t)) * cam("f", t) / max(0.3, cam("cz", t) - z)
    return float(np.clip(px / 540.0, -1, 1) * width)


def inside_view(t):
    """1 while the camera looks into the shelter at eye level (below the lawn)"""
    t = np.asarray(t, dtype=float)
    return np.clip((0.25 - np.interp(t, CT, TL["CAMS"]["cy"])) / 0.7, 0, 1)


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


def s_clank(f0=None, d=0.7):
    """a hollow steel tube or sheet hit"""
    f0 = f0 or rng.uniform(250, 520)
    parts = [(f0, 1.0, 0.18), (f0 * 1.58, 0.8, 0.14), (f0 * 2.37, 0.6, 0.1), (f0 * 3.61, 0.4, 0.07), (f0 * 5.1, 0.25, 0.05)]
    y = modes(d, parts) + 0.5 * bp(noise(d), 1200, 6000) * env_exp(d, 0.006, 0.0003)
    return norm(y)


def s_clang(f0=90, d=2.2, bright=1.0):
    """a heavy steel plate hit: a deep 'bwong' with a long ring"""
    ratios = [1.0, 1.47, 2.09, 2.56, 3.21, 3.9, 4.61, 5.43, 6.73, 8.1, 9.6, 11.8]
    parts = [(f0 * r * rng.uniform(0.985, 1.015), (1.0 / (1 + 0.35 * i)) * bright ** (i / 6), 0.9 / (1 + 0.25 * i)) for i, r in enumerate(ratios)]
    t = tt(d)
    y = modes(d, parts)
    y += 0.6 * bp(noise(d), 1500, 7000) * env_exp(d, 0.01, 0.0003)
    y += 0.8 * chirp(45 + 40 * np.exp(-t / 0.03), d) * env_exp(d, 0.18, 0.002)
    return norm(y)


def s_click():
    """a switch clicking on"""
    d = 0.05
    t = tt(d)
    y = (np.sin(2 * np.pi * 3100 * t) + 0.7 * np.sin(2 * np.pi * 5200 * t)) * np.exp(-t / 0.004)
    y += 0.5 * bp(noise(d), 2500, 9000) * np.exp(-t / 0.003)
    return norm(y)


def s_bench():
    out = np.zeros(int(0.8 * SR))
    put(out, 0.0, s_knock(0.55), 0.8)
    put(out, 0.0, s_thud(0.7), 0.6)
    put(out, 0.06, s_knock(0.7), 0.3)
    return norm(out)


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


def s_belly(d=1.3, big=1.0):
    """a tummy full of beans rumbling: a low gurgling growl with bubbles"""
    t = tt(d)
    f0 = (46 + 13 * srand(d, 4)) * (1.0 if big >= 1 else 1.3)
    ph = 2 * np.pi * np.cumsum(f0) / SR
    growl = sum(np.sin(h * ph + rng.uniform(0, 6.28)) / h ** 1.2 for h in range(1, 8))
    growl *= np.clip(0.55 + 0.5 * srand(d, 16), 0.05, 1.5)
    y = norm(lp(growl, 420, 2)) + 0.3 * norm(lp(brown(d), 160, 2))
    for _ in range(int(10 * d * big)):
        bd = rng.uniform(0.04, 0.09)
        f = rng.uniform(140, 380)
        put(y, rng.uniform(0.05, d - 0.12), chirp(f * (1 + 0.9 * tt(bd) / bd), bd) * arch(bd, 1.3), rng.uniform(0.15, 0.45))
    env = np.minimum(t / 0.08, 1) * np.clip((d - t) / 0.35, 0, 1)
    return norm(y * env)


def s_pat():
    """a small hand patting a full tummy: soft, fleshy, a little hollow"""
    d = 0.14
    t = tt(d)
    y = chirp(150 + 90 * np.exp(-t / 0.01), d) * env_exp(d, 0.03, 0.001)
    y += 0.5 * bp(noise(d), 600, 2600) * env_exp(d, 0.008, 0.0005)
    return norm(y)


def s_can():
    """the empty can held up: a light tinny rattle"""
    out = np.zeros(int(0.6 * SR))
    for k in range(3):
        f0 = rng.uniform(1500, 2100)
        put(out, 0.05 * k + 0.02 * rng.uniform(), modes(0.3, [(f0, 1.0, 0.05), (f0 * 2.31, 0.5, 0.03), (f0 * 3.7, 0.3, 0.02)]), 1.0 - 0.25 * k)
    return norm(out)


def s_beep(f=1760, d=0.11):
    t = tt(d)
    y = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)) * np.minimum(t / 0.004, 1) * np.clip((d - t) / 0.02, 0, 1)
    return norm(y)


def s_buzzer(d=0.8):
    """0:00: a harsh alarm buzzer"""
    t = tt(d)
    sq = np.sign(np.sin(2 * np.pi * 220 * t)) + 0.6 * np.sign(np.sin(2 * np.pi * 330 * t))
    y = lp(sq, 2600) * (0.78 + 0.22 * (np.sin(2 * np.pi * 14 * t) > 0))
    return norm(y * np.minimum(t / 0.01, 1) * np.clip((d - t) / 0.06, 0, 1))


def s_scrape():
    """the shovel pulled out of the lawn: a gritty metal scrape"""
    d = 0.35
    t = tt(d)
    y = bp(noise(d), 1500, 6000) * arch(d, 0.7) * (0.6 + 0.4 * np.abs(srand(d, 40)))
    y += 0.6 * grains(d, 400, 900, 5000)
    y += 0.4 * modes(d, [(rng.uniform(900, 1300), 1.0, 0.06), (2900, 0.4, 0.03)]) * np.minimum(t / 0.2, 1)
    return norm(y)


def s_scuff(d=0.5):
    """scrambling up the pit wall: boots scuffing the soil, grit pattering down"""
    out = np.zeros(int((d + 0.3) * SR))
    for k in range(4):
        put(out, k * d / 4 + 0.03 * rng.uniform(), s_dig()[: int(0.2 * SR)], 0.5)
    put(out, 0.05, grains(d, 700, 1500, 7000, shape=lambda u: 1 - u), 0.5)
    return norm(out)


def s_sheet_clank(f0=None):
    """a corrugated steel sheet slapped into place: a rattly, ringing clank"""
    f0 = f0 or rng.uniform(150, 260)
    d = 1.1
    t = tt(d)
    out = np.zeros(int(d * SR))
    put(out, 0, s_clang(f0, d, 0.9), 0.8)
    rattle = bp(noise(d), 300, 2500) * (0.5 + 0.5 * np.sin(2 * np.pi * 23 * t)) ** 2 * np.exp(-t / 0.18)
    put(out, 0, norm(rattle), 0.5)
    put(out, 0, s_thud(0.7), 0.5)
    return norm(out)


def s_slab_drop():
    """the concrete floor slab landing in the pit"""
    out = np.zeros(int(1.2 * SR))
    put(out, 0, s_thud(1.6), 1.0)
    put(out, 0.0, grains(0.6, 260, 900, 5000, shape=lambda u: np.exp(-6 * u)), 0.25)
    return norm(out)


def s_door_snap():
    """the heavy steel door snaps onto the stairwell: a deep clang, the hinges rattle"""
    out = np.zeros(int(2.4 * SR))
    put(out, 0.0, s_clang(96, 2.2, 0.95), 1.0)
    put(out, 0.0, s_thud(1.2), 0.7)
    for k in range(3):
        put(out, 0.05 + 0.06 * k, s_clink(rng.uniform(900, 1400)), 0.15)
    return norm(out)


def s_door_shut():
    """the door slams down onto its seals: a huge deep boom, the steel's ring dulled by the rubber"""
    out = np.zeros(int(3.0 * SR))
    put(out, 0.0, s_clang(70, 2.6, 0.75), 1.0)
    put(out, 0.0, s_thud(1.8), 1.0)
    put(out, 0.0, lp(noise(0.08), 900) * np.exp(-tt(0.08) / 0.015), 0.5)
    return norm(out)


def s_squeak(d=0.32, f0=620, f1=900):
    """rubber squeaking under pressure: a squeal from stick-slip"""
    t = tt(d)
    f = f0 + (f1 - f0) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.7 + 25 * np.sin(2 * np.pi * 31 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = sum(np.sin(h * ph) / h ** 1.1 for h in range(1, 7))
    y *= 0.6 + 0.4 * (np.sin(2 * np.pi * 47 * t) > -0.3)
    y = bp(y, 400, 5000)
    return norm(y * arch(d, 0.5))


def s_shimmer(d=1.4):
    """the seals lighting up all round: a soft rising shimmer"""
    t = tt(d)
    y = sum(np.sin(2 * np.pi * f * (1 + 0.12 * t / d) * t) * a for f, a in [(880, 1.0), (1320, 0.6), (1760, 0.35)])
    y *= arch(d, 1.2) * (0.7 + 0.3 * np.sin(2 * np.pi * 10 * t))
    return norm(y)


def s_gas(d, lo=150, hi=900, wobble=1.0, seed=1):
    """the gas moving: a thick, soft, low rolling hiss"""
    def mag(ft, f):
        u = np.clip(ft / d, 0, 1)
        env = smooth01(u, 0, 0.18) * (1 - smooth01(u, 0.72, 0.28))
        roll = np.clip(1 + 0.4 * wobble * slow_noise(ft, 2.2, seed), 0.2, 2)
        fc = lo + (hi - lo) * np.clip(0.5 + 0.5 * slow_noise(ft, 0.8, seed + 50), 0, 1)
        g = np.exp(-0.5 * (np.log2(np.maximum(f, 20)[:, None] / fc[None, :]) / 1.0) ** 2)
        return g * (env * roll)[None, :]

    return norm(shaped_noise(d, mag, 700 + seed))


def s_pipe_up():
    """the air pipe telescoping up out of the lawn: sliding steel, a clunk at each joint"""
    out = np.zeros(int(1.6 * SR))
    d = 0.85
    slide = bp(noise(d), 700, 4500) * (0.55 + 0.45 * np.abs(srand(d, 30))) * arch(d, 0.6)
    put(out, 0.0, slide, 0.35)
    for k, dt_ in enumerate([0.25, 0.5, 0.78]):
        put(out, dt_, s_clink(rng.uniform(700, 1000) + 150 * k), 0.45)
        put(out, dt_, s_thud(0.4)[: int(0.25 * SR)], 0.25)
    return norm(out)


def s_filter_on():
    """the filter box clicking onto the pipe: a firm snap, two clicks"""
    out = np.zeros(int(0.7 * SR))
    put(out, 0.0, s_knock(1.6), 0.7)
    put(out, 0.0, s_click(), 0.9)
    put(out, 0.07, s_click(), 0.7)
    put(out, 0.0, s_clink(rng.uniform(1100, 1400)), 0.25)
    return norm(out)


def s_panel_off():
    """the filter's front panel sliding off"""
    out = np.zeros(int(0.8 * SR))
    d = 0.4
    put(out, 0.0, bp(noise(d), 1200, 6000) * arch(d, 0.8), 0.5)
    put(out, 0.38, s_click(), 0.4)
    return norm(out)


def s_plink(f=None):
    """a gas dot caught in the carbon: a tiny soft plink"""
    f = f or rng.uniform(1800, 3200)
    d = 0.12
    t = tt(d)
    return norm(np.sin(2 * np.pi * f * (1 - 0.25 * t / d) * t) * np.exp(-t / 0.025) * np.minimum(t / 0.002, 1))


def s_fan(d):
    """the fan: spins up and hums (the motor, the blades, the air)"""
    t = tt(d)
    spin = np.clip(t / 0.9, 0, 1) ** 0.7
    ph = 2 * np.pi * np.cumsum(24 * spin + 0.1) / SR  # rev/s: 5 blades -> a 120 Hz blade pass
    hum = sum(np.sin(h * 2 * np.pi * 100 * t) / h for h in (1, 2, 3)) * spin
    blade = np.sin(5 * ph) * 0.5 + 0.3 * np.sin(10 * ph)
    air = bp(noise(d), 300, 3000) * (0.75 + 0.25 * np.sin(5 * ph))
    y = norm(hum) * 0.3 + norm(blade) * 0.4 * spin + norm(air) * 0.55 * spin
    return norm(y * np.minimum(t / 0.05, 1) * np.clip((d - t) / 0.3, 0, 1))


def s_hiss(d=0.8, f=4000):
    """air hissing out through a tiny gap"""
    y = bp(noise(d), f * 0.6, min(f * 1.8, 16000)) * arch(d, 0.6) * (0.85 + 0.15 * srand(d, 25))
    return norm(y)


def s_zip(d=0.35):
    """a measuring line drawing out"""
    t = tt(d)
    y = bp(noise(d), 1500, 7000) * arch(d, 1.5) + 0.2 * np.sin(2 * np.pi * np.cumsum(1200 + 2500 * t / d) / SR) * arch(d, 2)
    return norm(y)


def s_fart_huge(d=3.6):
    """the blast: a huge, long, flappy low rumble (a giant raspberry) with the air rushing
    out and the ground shaking; brassy and silly, not gross"""
    t = tt(d)
    u = t / d
    f0 = 56 + 30 * np.exp(-((u - 0.05) / 0.05) ** 2) + 8 * srand(d, 7) - 24 * u ** 1.6
    f0 = np.maximum(f0, 22)
    ph = 2 * np.pi * np.cumsum(f0) / SR
    bright = 8 + 8 * np.abs(srand(d, 5))
    y = np.zeros(len(t))
    for h in range(1, 32):
        y += np.sin(h * ph) / h ** 0.85 / (1 + np.exp((h - bright) / 2.0))
    y *= 0.62 + 0.38 * np.sin(2 * np.pi * np.cumsum(10 + 7 * np.abs(srand(d, 3))) / SR)  # the flutter
    y = np.tanh(2.4 * y / (np.max(np.abs(y)) + 1e-9))
    rumble = lp(brown(d), 110, 4)
    blast = lp(noise(d), 1600) * np.exp(-t / 0.4)
    env = np.minimum(t / 0.025, 1) * np.clip((d - t) / (0.55 * d), 0, 1) ** 0.6
    out = (norm(y) * 0.9 + norm(rumble) * 0.75 + norm(blast) * 0.45) * env
    # two little sputters to finish
    for dt_, f, sd in [(d - 0.5, 74, 0.12), (d - 0.26, 92, 0.08)]:
        tt_ = tt(sd)
        sp = sum(np.sin(h * 2 * np.pi * f * tt_) / h for h in range(1, 12)) * arch(sd, 0.8) * (0.6 + 0.4 * np.sin(2 * np.pi * 30 * tt_))
        put(out, dt_, norm(sp), 0.35)
    return norm(out)


def s_pfft():
    """the dog's tiny 'pfft': short, high, airy, a little squeaky"""
    d = 0.3
    t = tt(d)
    air = bp(noise(d), 900, 5200) * np.exp(-t / 0.09) * np.minimum(t / 0.006, 1)
    f = 330 + 170 * np.exp(-t / 0.05)
    ph = 2 * np.pi * np.cumsum(f) / SR
    squeak = sum(np.sin(h * ph) / h for h in range(1, 6)) * np.exp(-t / 0.07) * (0.6 + 0.4 * np.sin(2 * np.pi * 45 * t))
    return norm(norm(air) * 0.7 + norm(squeak) * 0.5)


def s_squawk():
    """a bird squawking as it bursts off the branch"""
    out = np.zeros(int(0.9 * SR))
    for k, (dt_, f0, dd) in enumerate([(0.0, 1500, 0.16), (0.21, 1780, 0.2)]):
        t = tt(dd)
        ph = 2 * np.pi * np.cumsum(f0 * (1 + 0.35 * np.sin(np.pi * t / dd))) / SR
        y = sum(np.sin(h * ph) / h ** 0.7 for h in range(1, 9))
        y = bp(y * (0.7 + 0.3 * np.sign(np.sin(2 * np.pi * 70 * t))), 900, 7000) * arch(dd, 0.5)
        put(out, dt_, norm(y), 1.0 - 0.2 * k)
    return norm(out)


def s_wings(d=1.0):
    """wings beating away"""
    out = np.zeros(int(d * SR))
    tq, k = 0.0, 0
    while tq < d - 0.08:
        put(out, tq, bp(noise(0.07), 300, 2500) * arch(0.07, 1.0), 1.0 - 0.7 * tq / d)
        tq += 0.075 + 0.012 * k
        k += 1
    return norm(out)


def s_rustle(d=1.6):
    """leaves curling and rustling"""
    y = grains(d, 900, 2000, 9000, glen=(0.002, 0.01), shape=lambda u: np.sin(np.pi * u))
    y += 0.4 * bp(noise(d), 3000, 9000) * arch(d, 1.0)
    return norm(y)


def s_strap():
    """the mask's strap snapping into place: a rubbery thwap"""
    d = 0.2
    t = tt(d)
    y = chirp(220 + 300 * np.exp(-t / 0.01), d) * env_exp(d, 0.03, 0.001) + 0.4 * bp(noise(d), 500, 3000) * env_exp(d, 0.01, 0.0005)
    return norm(y)


def s_mask_breath():
    """a breath through the gas mask's filter: a hollow hiss in, a valve click, a puff out"""
    d = 1.5
    out = np.zeros(int(d * SR))
    di = 0.72
    t = tt(di)
    inh = bp(noise(di), 700, 2600) * arch(di, 0.8) + 0.25 * np.sin(2 * np.pi * (1050 + 120 * t / di) * t) * arch(di, 1.2)
    put(out, 0.0, norm(inh), 0.8)
    put(out, di + 0.03, s_click(), 0.25)
    do = 0.55
    exh = lp(noise(do), 1300) * arch(do, 0.7) * (0.75 + 0.25 * np.sin(2 * np.pi * 38 * tt(do)))
    put(out, di + 0.1, norm(exh), 0.6)
    return norm(out)


def s_sit():
    """sitting down on the wooden bench"""
    out = np.zeros(int(0.7 * SR))
    put(out, 0, s_knock(0.45), 0.6)
    put(out, 0, s_thud(0.8)[: int(0.4 * SR)], 0.5)
    put(out, 0.05, s_creak(0.35, 140, 260, 0.9), 0.25)
    return norm(out)


def s_dog_hop():
    """the dog's paws scrabbling up onto the bench, a soft landing"""
    out = np.zeros(int(0.8 * SR))
    for k in range(4):
        put(out, 0.05 * k + 0.01 * rng.uniform(), s_paw(1.0), 0.6)
    put(out, 0.35, s_knock(0.6)[: int(0.2 * SR)], 0.4)
    return norm(out)


def s_cloth(d=0.4):
    """a jacket rustling as he moves"""
    return norm(bp(noise(d), 700, 5000) * arch(d, 1.0) * (0.7 + 0.3 * srand(d, 20)))


VARY = {"dig", "toss", "step", "paw", "clink", "knock", "tick", "pat", "plink", "hiss", "sheet_clank", "scrape"}
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


def cue(t, snd, gain_db, x=None, z=-1.0, p=None, duck=True, verb=0.0):
    """x, z: where the source is (panned by where it sits on screen at t); duck=False keeps
    a hit at full level even under the narration; verb: reverb send (the steel room)"""
    if p is None:
        p = pan(x, t, z) if x is not None else 0.0
    CUES.append((t, snd, gain_db, p, duck, verb))


def travel_e(u, a, ease_in=True, ease_out=True):
    """the rig's eased travel (src/people.js travel)"""
    if a <= 0:
        return u
    if ease_in and ease_out:
        v = 1 / (1 - a)
        if u < a:
            return v * u * u / (2 * a)
        if u > 1 - a:
            return 1 - v * (1 - u) * (1 - u) / (2 * a)
        return v * a / 2 + v * (u - a)
    if ease_in:
        return (u * u) / (2 * a) / (1 - a / 2) if u < a else (u - a / 2) / (1 - a / 2)
    return 1 - ((1 - u) * (1 - u)) / (2 * a) / (1 - a / 2) if u > 1 - a else u / (1 - a / 2)


def path_at(pts, s):
    for a, b in zip(pts, pts[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if s <= L:
            k = s / L if L else 0
            return a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k
        s -= L
    return pts[-1]


def surface(x, z):
    """what a foot lands on: the room floor, the steps, the hatch frame, the lawn"""
    if -2.4 < z < 0.05 and -1.6 < x < 3.75:
        if x < 1.35:
            return "floor"
        if z > -1.25:
            return "stair"
    return "grass"


def walk(t0, t1, pts, stride, ease=0.18, ease_in=True, ease_out=True, gain=-20, run=False, dog=False):
    """footsteps along a path, on the beat of the animation's own feet (rig.footAt lands a
    foot every half stride of eased travel)"""
    L = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))
    half = stride / (4 if dog else 2)
    ts_ = np.linspace(t0, t1, 800)
    d = np.array([travel_e((t - t0) / (t1 - t0), ease, ease_in, ease_out) * L for t in ts_])
    for k in range(1, int(L / half) + 1):
        i = int(np.searchsorted(d, k * half))
        if i >= len(ts_):
            break
        x, z = path_at(pts, k * half)
        srf = surface(x, z)
        hard = srf != "grass"
        g = gain + (2 if run else 0) + rng.uniform(-1.5, 1.5)
        snd = sfx("paw", 1.0 if hard else 0.0) if dog else sfx("step", 1.0 if hard else 0.0, 1.25 if run else 1.0)
        cue(ts_[i], snd, g + (-4 if dog else 0), x, z, verb=0.3 if hard else 0.0)


def pop_land(t0, dur=0.36, s=2.2):
    """when a part popping in first reaches its place (src/util.js popIn)"""
    return t0 + dur * (1 - s / (s + 1))


def build_cues():
    S0 = T["shell0"]
    # 1 - the porch: pats, the rumble, the can held up, "3 CANS", the countdown appears,
    #     the worker's fright, the shovel pulled out
    KX, KZ = 1.25, -9.35
    tp_ = T["pat0"] + 0.25 / 2.2
    while tp_ < 6.5:
        cue(tp_, sfx("pat"), -27, KX, KZ)
        tp_ += 1 / 2.2
    cue(T["rumble"], sfx("belly", 1.3, 1.0), -9, KX, KZ, duck=False)
    cue(T["label3"] - 0.25, sfx("can"), -20, KX - 0.3, KZ)
    cue(T["label3"], sfx("label"), -14, p=0.0)
    cue(T["timer0"], sfx("beep", 1320, 0.16), -16, p=0.0, duck=False)
    cue(T["fear"], sfx("whoosh", 0.35, 500, 2200), -20, 3.3, -1.0)
    cue(T["fear"] + 0.16, sfx("step", 0.0, 1.3), -16, 3.3, -0.6)
    cue(T["fear"] + 0.22, sfx("step", 0.0, 1.1), -18, 3.4, -0.6)
    cue(T["fear"] + 0.05, sfx("cloth", 0.4), -22, 3.3, -0.8)
    for dt_ in (0.7, 0.95, 1.12):
        cue(T["fear"] + dt_, sfx("step", 0.0), -22, 3.45, -0.7)
    cue(T["grab"] + 0.05, sfx("scrape"), -14, 3.9, -0.75)
    for dt_ in (0.75, 1.0, 1.25, 1.45):
        cue(T["grab"] + dt_, sfx("step", 0.0), -22, 3.3, -1.1)
    # the countdown: a tick at every jump of the display; the last ten louder, rising beeps
    tk = T["timer0"] + 0.25
    k = 0
    while tk < T["final0"] - 0.01:
        cue(tk, sfx("tick", 1.0 if k % 2 == 0 else 0.8), -27 + 4 * (tk - T["timer0"]) / (T["final0"] - T["timer0"]), p=0.0)
        tk += 0.25
        k += 1
    for j in range(10):
        tj = T["final0"] + j * (T["zero"] - T["final0"]) / 10
        cue(tj, sfx("beep", 1480 + 60 * j, 0.09), -19 + 0.6 * j, p=0.0, duck=False)
    cue(T["zero"], sfx("buzzer", 0.42), -16, p=0.0)

    # 2 - the dig: a bite and a toss for every stroke, the soil landing on the pile
    for i, st in enumerate(WD["DIG_T"]):
        x = WD["digX"][i]
        cue(st - 0.07, sfx("dig"), -13, x, -1.3)
        cue(st + 0.04, sfx("whoosh", 0.22, 600, 2400), -24, x, -1.3)
        cue(st + 0.5, sfx("toss"), -20, WD["PILE"]["x"], WD["PILE"]["z"])
    # out of the pit: the shovel tossed onto the lawn, the scramble up the wall
    xc = -0.95
    cue(T["climbOut"], sfx("whoosh", 0.45, 400, 1600), -20, xc, -2.0)
    cue(T["climbOut"] + 0.47, sfx("clank", 820, 0.6), -20, -1.7, -3.2)
    cue(T["climbOut"] + 0.47, sfx("step", 0.0, 1.4), -20, -1.7, -3.2)
    cue(T["climbOut"] + 0.1, sfx("scuff", 0.5), -16, xc, -2.3)
    cue(T["climbOut"] + 0.62, sfx("step", 0.0, 1.3), -17, xc, -2.8)
    cue(T["climbOut"] + 0.75, sfx("step", 0.0, 1.1), -19, xc, -2.9)
    # the shelter snaps together: the slab, the posts, five wall sheets, the beams, the
    # roof sheet, the steps, the hatch frame, the bench and the lamp
    cue(pop_land(S0), sfx("slab_drop"), -12, 1.0, -1.2)
    cue(pop_land(S0 + 0.14, 0.3), sfx("clank", 420, 0.6), -18, -1.0, -1.2)
    for k, (dt_, x) in enumerate([(0.3, -1.55), (0.42, 0.0), (0.54, 1.3), (0.64, 2.5), (0.74, 3.7)]):
        cue(pop_land(S0 + dt_), sfx("sheet_clank", 150 + 25 * k), -13, x, -1.2)
    cue(pop_land(S0 + 0.86), sfx("clank", 300, 0.7), -17, 0.0, -1.2)
    cue(pop_land(S0 + 0.98), sfx("sheet_clank", 135), -12, 0.0, -1.2)
    cue(pop_land(S0 + 1.08), sfx("thud", 1.2), -14, 2.5, -0.6)
    cue(pop_land(S0 + 1.18), sfx("clank", 520, 0.6), -17, 2.5, -0.6)
    cue(pop_land(S0 + 1.3), sfx("bench"), -19, 0.3, -2.1)
    cue(pop_land(S0 + 1.3) + 0.03, sfx("clink", 1500), -26, -0.3, -0.7)
    # the backfill: soil showering onto the buried roof
    cue(T["backfill0"] - 0.05, sfx("crumble", 1.2), -14, 0.0, -1.2)
    # the test puff drifting in, sinking into the stairwell
    cue(T["puff0"], sfx("gas", 2.2, 160, 700, 1.0, 1), -19, p=(-0.7, 0.1))
    cue(T["labelHeavy"], sfx("label"), -14, p=0.0)
    cue(T["sink0"] - 0.1, sfx("whoosh", 1.6, 700, 200, 1.0), -18, 2.3, -0.6)
    cue(T["sink0"], sfx("gas", 1.8, 120, 420, 0.6, 2), -20, 2.2, -0.6)
    # the run to the stairwell and down into the room; the dog ahead
    W0 = T["walkIn0"]
    walk(W0, W0 + 1.25, [(-0.95, -2.95), (2.85, -1.75), (3.98, -0.95), (3.56, -0.62)], 1.65, ease=0.18, ease_out=False, gain=-19, run=True)
    walk(W0 + 1.25, W0 + 2.2, [(3.56, -0.62), (1.62, -0.62)], 1.0, ease=0.1, ease_in=False, ease_out=False, gain=-18)
    walk(W0 + 2.2, W0 + 2.95, [(1.62, -0.62), (1.05, -0.88), (0.45, -1.2)], 1.2, ease=0.3, ease_in=False, gain=-20)
    walk(W0 + 0.05, W0 + 0.95, [(5.25, -5.0), (4.75, -2.1), (4.02, -0.8), (3.56, -0.6)], 1.0, ease=0.2, ease_out=False, gain=-19, dog=True)
    walk(W0 + 0.95, W0 + 1.6, [(3.56, -0.6), (1.62, -0.6)], 0.9, ease=0.1, ease_in=False, ease_out=False, gain=-18, dog=True)
    walk(W0 + 1.6, W0 + 2.25, [(1.62, -0.6), (0.8, -1.0), (-0.2, -1.45)], 0.8, ease=0.3, ease_in=False, gain=-21, dog=True)

    # 3 - the door: snaps on, swings shut, slams onto its seals (a squeak of rubber); the
    #     seals light up; the gas rolls in and presses on it
    DX = 2.5
    cue(T["door"] + 0.13, sfx("door_snap"), -11, DX, -0.7, verb=0.2)
    cue(T["labelAir"], sfx("label"), -14, p=0.0)
    cue(T["doorClose"], sfx("creak", 0.42, 58, 110, 0.45), -14, DX, -0.7, verb=0.3)
    cue(T["doorClose"] + 0.05, sfx("whoosh", 0.35, 250, 900), -18, DX, -0.7)
    cue(T["doorShut"], sfx("door_shut"), -7, DX, -0.7, duck=False, verb=0.45)
    cue(T["doorShut"] + 0.04, sfx("squeak", 0.34, 620, 940), -17, DX, -0.7)
    cue(T["doorShut"] + 0.3, sfx("hiss", 0.5, 2600), -26, DX, -0.7)
    cue(T["seals"], sfx("shimmer", 1.5), -21, DX, -0.7)
    cue(T["seals"] + 0.25, sfx("squeak", 0.25, 520, 700), -24, DX + 0.8, -0.7)
    cue(T["press0"] - 0.6, sfx("gas", 2.8, 110, 500, 1.3, 3), -16, p=(-0.6, 0.3))
    cue(T["press0"] + 0.15, sfx("creak", 1.2, 30, 48, 0.25), -21, DX, -0.7)

    # 4 - stuffy; the pipe telescopes up; "CLEAN AIR: 4 M UP"; the gas stays low; clean air
    #     pours down the pipe
    PX = -1.0
    cue(T["stuffy0"] + 0.2, sfx("cloth", 0.5), -24, 0.45, -1.2)
    cue(T["stuffy0"] + 1.05, sfx("cloth", 0.45), -25, 0.45, -1.2)
    cue(T["pipe0"], sfx("pipe_up"), -13, PX, -1.9)
    cue(T["label4m"], sfx("label"), -14, p=0.0)
    cue(T["label4m"] - 0.15, sfx("zip", 0.45), -22, PX - 0.4, -1.9)
    cue(T["lowGas"], sfx("gas", 2.5, 100, 380, 0.7, 4), -21, p=(-0.5, 0.5))
    cue(T["air0"], sfx("air", T["air1"] - T["air0"] + 0.4), -13, PX, -1.9)

    # 5 - the filter clicks on; its front slides off; the gas dots stick in the carbon; the
    #     clean air passes through
    cue(pop_land(T["filter"], 0.36, 2.4), sfx("filter_on"), -11, PX, -2.1)
    cue(T["labelCarbon"], sfx("label"), -14, p=0.0)
    cue(T["cutOpen"], sfx("panel_off"), -17, PX, -2.1)
    for k in range(12):
        cue(T["dots0"] + 0.55 + k * 0.1 + 0.03 * rng.uniform(), sfx("plink"), -25 + 2 * rng.uniform(), PX + 0.3 * (rng.uniform() - 0.5), -2.1)
    cue(T["clean0"], sfx("air", T["clean1"] - T["clean0"] + 0.3), -18, PX, -2.1)

    # 6 - he walks to the switch: click, the fan spins up (its hum runs to the end, see the
    #     beds); "+ PRESSURE"; air hissing out through every gap; the gas clears
    walk(33.25, 33.95, [(0.45, -1.2), (-0.33, -1.66)], 1.0, ease=0.3, gain=-22)
    cue(T["fanOn"], sfx("click"), -15, -0.45, -2.2)
    cue(T["push0"], sfx("whoosh", 1.2, 300, 1100), -21, -0.8, -1.8)
    walk(T["fanOn"] + 0.35, T["fanOn"] + 1.0, [(-0.33, -1.66), (0.12, -1.32)], 0.9, ease=0.35, gain=-22)
    cue(T["labelPress"], sfx("label"), -14, p=0.0)
    for k, (x, f) in enumerate([(-1.7, 3600), (3.9, 4300), (2.5, 5200), (-1.0, 3000), (1.0, 4700), (3.0, 3900)]):
        cue(T["leak0"] + 0.45 * k + 0.1 * rng.uniform(), sfx("hiss", 1.1, f), -24, x, -0.3)
    cue(T["gasOut"], sfx("whoosh", 1.4, 300, 900), -22, p=(0.0, 0.7))
    walk(T["toBench"], T["toBench"] + 0.75, [(0.12, -1.32), (0.67, -1.68)], 0.9, ease=0.3, gain=-22)
    cue(T["toBench"] + 0.85, sfx("sit"), -18, 0.62, -2.06)
    cue(T["toBench"] + 0.7, sfx("dog_hop"), -18, -0.05, -2.0)

    # 7 - 0:00 (the buzzer, above); the little brother braces; the blast; the bird flaps off;
    #     the leaves curl; "SMELL RADIUS: 50 M"
    cue(T["brace"] - 0.3, sfx("belly", 0.75, 1.4), -10, KX, KZ, duck=False)
    cue(T["blast"], sfx("fart_huge", 3.6), -3, KX, KZ, duck=False)
    cue(T["blast"] + 0.05, sfx("whoosh", 2.4, 120, 700, 0.8), -10, p=(0.0, 0.0), duck=False)
    cue(T["blast"] + 0.4, sfx("gas", 6.0, 70, 300, 1.4, 5), -9, p=(-0.2, 0.2), duck=False)
    cue(T["bird"], sfx("squawk"), -14, 4.6, -5.0)
    cue(T["bird"] + 0.1, sfx("wings", 1.0), -18, 4.6, -5.0)
    cue(T["curl"], sfx("rustle", 1.8), -20, 6.2, -5.4)
    cue(T["labelRadius"], sfx("label"), -14, p=0.0)
    cue(T["labelRadius"] - 0.1, sfx("zip", 0.6), -21, p=(0.2, -0.6))

    # 8 - the thumbs-up; the dog looks away; the music stops; the pfft (all alone); the
    #     freeze; the slow turn; the gas mask: rubber, the strap, a breath through the filter
    cue(T["thumb"] - 0.1, sfx("cloth", 0.35), -24, 0.9, -1.8)
    cue(T["pfft"], sfx("pfft"), -6, -0.05, -2.1, duck=False)
    cue(T["freeze"] + 0.45, sfx("cloth", 0.9), -28, 0.62, -2.0)
    cue(T["mask0"] + 0.05, sfx("cloth", 0.5), -24, 0.9, -2.0)
    cue(T["mask0"] + 0.55, sfx("squeak", 0.5, 300, 460), -23, 0.9, -2.0)
    cue(T["mask0"] + 1.35, sfx("squeak", 0.6, 260, 420), -21, 0.62, -2.0)
    cue(T["mask0"] + 1.7, sfx("strap"), -19, 0.62, -2.0)
    cue(T["mask1"] + 0.25, sfx("mask_breath"), -14, 0.62, -2.0, duck=False)


# ---------------------------------------------------------------------------
# beds: birds and a light breeze in the sunny yard; the room tone and the fan inside
# ---------------------------------------------------------------------------
def breeze_bed():
    out = []
    for ch in range(2):
        def mag(ft, f, ch=ch):
            lvl = 0.6 + 0.3 * slow_noise(ft, 0.25, 31 + ch)
            F = np.maximum(f, 15.0)[:, None]
            base = (F / 300.0) ** -0.6 / (1 + (60.0 / F) ** 4) / (1 + (F / 1800.0) ** 2)
            return base * np.clip(lvl, 0.15, 1.5)[None, :]

        out.append(shaped_noise(DUR, mag, 610 + ch))
    st = np.stack(out)
    return st / (np.max(np.abs(st)) + 1e-9)


def room_bed():
    """the closed steel room: a low air tone"""
    d = DUR
    y = lp(pink(d), 300) + 0.2 * np.sin(2 * np.pi * 57 * tt(d))
    y = norm(y)
    return np.stack([y, np.roll(y, 1234)])


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


# ---------------------------------------------------------------------------
# music: tense and serious, documentary style, in D minor at 120 bpm - a low drone and a
# soft pulse at first; a pulsing ostinato from the moment the countdown starts, taikos,
# low brass "braams" on the big beats, strings and a long riser building to 0:00; a held
# breath; a huge dark chord with the blast and a slow dramatic fall; calm and warm in
# D major underground... and cut dead just before the dog's pfft
# ---------------------------------------------------------------------------
def build_music():
    """returns a stereo (2, N) score"""
    BEAT = 0.5
    BAR = 4 * BEAT
    X = N + 8 * SR
    padL, padR, perc, ost, hi, low = (np.zeros(X) for _ in range(6))
    PROG = ["Dm", "Dm", "Bb", "Bb", "Gm", "Gm", "A", "A"]
    Z = T["zero"]
    I = lambda t: float(np.clip(0.15 + 0.85 * (t / Z) ** 1.2, 0, 1))  # intensity, up to 0:00

    # the drone and pads: one chord a bar, from the start to 0:00
    nb = int(math.ceil(Z / BAR))
    for b in range(nb):
        t0 = b * BAR
        ch = "Dm" if t0 < 3.8 else PROG[b % 8]
        d = BAR + 1.0
        cut = 450 + 1100 * I(t0)
        for k, fr in enumerate(chord_notes(ch, 3)):
            v = pad(fr, d, cut, a=0.9 if b == 0 else 0.5, r=0.9) * (0.5 + 0.5 * I(t0))
            put(padL, t0, v, 0.2 * (1.1 if k % 2 else 0.9))
            put(padR, t0, v, 0.2 * (0.9 if k % 2 else 1.1))
        put(low, t0, pad(mf(BASS[ch]), d, 240, a=0.7, r=0.9), 0.32 * (0.55 + 0.45 * I(t0)))
        if t0 >= 15.0:  # strings an octave up; tremolo in the last stretch
            for k, fr in enumerate(chord_notes(ch, 4)):
                put(padL if k % 2 else padR, t0, strings(fr, d, 2000 + 1500 * I(t0), trem=0.55 if t0 >= 33.7 else 0.0), 0.06 * I(t0))
    # a glassy high shimmer in the intro
    for t0, n in [(0.4, "A5"), (2.2, "E6")]:
        d = 3.0
        t = tt(d)
        put(hi, t0, np.sin(2 * np.pi * mf(n) * t * (1 + 0.002 * np.sin(2 * np.pi * 4.5 * t))) * arch(d, 1.2), 0.03)
    # a soft pulse on the beat until the countdown starts
    tb = BEAT
    while tb < 3.8:
        put(perc, tb, heartbeat(0.5), 0.45)
        tb += 2 * BEAT
    # the ostinato: 8ths from the countdown, 16ths from the filter on
    t8 = 4.0
    while t8 < Z - 0.01:
        b = int(t8 // BAR)
        root, third, fifth = chord_notes(PROG[b % 8], 3)
        seq = [root, root, root * 2, root, fifth, root, third, fifth]
        fast = t8 >= 26.0
        step = BEAT / (4 if fast else 2)
        k = int(round((t8 % BAR) / step))
        fr = seq[k % 8] if not fast else seq[(k // 2) % 8] * (2 if k % 4 == 3 else 1)
        acc = 1.0 if k % (8 if fast else 4) == 0 else 0.65
        put(ost, t8, pluck(fr, 0.16 if fast else 0.24, 0.5 + 1.5 * I(t8)), 0.09 * acc * (0.5 + 0.5 * I(t8)))
        t8 += step
    # taikos: sparse in the dig, busier through the build, 8ths in the last stretch
    pats = {
        "a": [(0, 1.0), (2, 0.8)],
        "b": [(0, 1.0), (1.5, 0.5), (2, 0.85), (3, 0.5)],
        "c": [(0, 1.0), (0.5, 0.4), (1.5, 0.55), (2, 0.9), (2.5, 0.4), (3, 0.6), (3.5, 0.5)],
        "d": [(k * 0.5, 0.75 + 0.25 * (k % 2 == 0)) for k in range(8)],
    }
    b0 = 3  # from 6.0 s, as he takes the shovel
    b1 = int(Z // BAR)
    for b in range(b0, b1):
        t0 = b * BAR
        pat = pats["a"] if t0 < 15 else pats["b"] if t0 < 26 else pats["c"] if t0 < 37.5 else pats["d"]
        for bt, v in pat:
            put(perc, t0 + bt * BEAT, taiko(v * (0.6 + 0.4 * I(t0)), 62 if bt % 2 == 0 else 74), 0.5)
    # the last bar: a 16th roll into 0:00
    for k in range(16):
        put(perc, Z - 2.0 + k * 0.125, taiko(0.4 + 0.04 * k, 66 + 2 * k), 0.45)
    # braams on the big beats
    for tb_, ch in [(T["timer0"], "Dm"), (T["shell0"], "Bb"), (T["doorShut"], "Dm"), (T["pipe1"], "Gm"), (T["filter"], "Bb"), (T["fanOn"], "Gm"), (T["final0"], "A")]:
        put(low, tb_, braam(mf(BASS[ch]), 3.2, 0.6 + 0.4 * I(tb_)), 0.26)
    # the riser into 0:00
    put(hi, Z - 5.0, riser(5.0), 0.12)
    # 0:00: the hit
    put(perc, Z, taiko(1.0, 55), 0.8)
    put(low, Z, braam(mf("D1") * 2, 2.0, 1.0), 0.32)
    # the held breath: a thin high tremolo until the blast
    put(padL, Z + 0.3, strings(mf("A5"), T["blast"] - Z - 0.3, 3000, a=0.4, r=0.05, trem=0.6), 0.035)
    put(padR, Z + 0.3, strings(mf("D6"), T["blast"] - Z - 0.3, 3000, a=0.4, r=0.05, trem=0.6), 0.03)
    # the blast: a huge dark chord and a slow dramatic fall (Dm - Bb - Gm - A)
    Bl = T["blast"]
    put(perc, Bl, taiko(1.0, 48), 0.9)
    put(perc, Bl + 0.03, taiko(0.8, 60), 0.6)
    for n in ("D1", "A1"):
        put(low, Bl, braam(mf(n) * 2, 4.5, 1.0), 0.3)
    fall = [("Dm", 0.0), ("Bb", 1.6), ("Gm", 3.0), ("A", 4.2)]
    for i, (ch, dt_) in enumerate(fall):
        d = (fall[i + 1][1] - dt_ if i + 1 < len(fall) else T["safe0"] - Bl - dt_) + 1.2
        for k, fr in enumerate(chord_notes(ch, 3)):
            put(padL if k % 2 else padR, Bl + dt_, strings(fr, d, 1800, a=0.5, r=1.0), 0.07)
        put(low, Bl + dt_, pad(mf(BASS[ch]), d, 220, a=0.4, r=1.0), 0.3)
    # underground: calm and warm in D major, a soft piano on top
    c0 = T["safe0"] - 0.2
    seq = [("D", 0.0), ("G", 1.6), ("D", 3.0)]
    for i, (ch, dt_) in enumerate(seq):
        d = (seq[i + 1][1] - dt_ if i + 1 < len(seq) else T["musicCut"] - c0 - dt_) + 1.4
        for k, fr in enumerate(chord_notes(ch, 3)):
            v = pad(fr, d, 1100, a=0.9, r=1.4, vib=0.0015)
            put(padL, c0 + dt_, v, 0.16 * (1.1 if k % 2 else 0.9))
            put(padR, c0 + dt_, v, 0.16 * (0.9 if k % 2 else 1.1))
        put(low, c0 + dt_, pad(mf(BASS[ch]), d, 240, a=1.0, r=1.4), 0.22)
    for n, dt_ in [("A4", 0.3), ("D5", 0.85), ("F#5", 1.4), ("E5", 2.2), ("D5", 2.8), ("A5", 3.4)]:
        put(hi, c0 + dt_, piano(mf(n), 2.4, 0.9), 0.12)

    end = int(DUR * SR)
    L = np.zeros((2, X))
    L[0] = padL + 0.8 * perc + ost * 1.0 + hi * 0.9 + low
    L[1] = padR + 0.8 * perc + ost * 0.85 + hi * 1.0 + low
    L[1] += 0.25 * np.roll(ost, int(0.011 * SR)) + 0.2 * np.roll(hi, int(0.007 * SR))
    L = L[:, :end]
    ir = make_ir(2.6, 0.02, 4500, 21)
    wet = np.stack([signal.fftconvolve(L[c], ir[c])[:end] for c in range(2)])
    out = L + 0.3 * wet
    t = np.arange(end) / SR
    # the cut: everything (reverb tails too) stops dead just before the pfft
    out *= 1 - smooth01(t, T["musicCut"] - 0.03, 0.05)
    out *= np.minimum(t / 0.6, 1)
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
# voice: each line (or part of a line) in its slot, levelled, sped up a hair only if it
# overruns
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


def slot_key(s):
    return s["id"] if "words" not in s else f"{s['id']}@{s['words'][0]}"


def build_vo():
    lines = {l["id"]: l for l in SCRIPT["lines"]}
    slots = TL["VO"]
    out = np.zeros(N)
    placement = {}
    for k, s in enumerate(slots):
        path = A("vo", f"{s['id']}.wav")
        y = read_audio(path)
        # a slot with a range of words takes that part of the line, cut in the middle of
        # the pauses around it
        c0, c1 = 0.0, len(y) / SR
        if "words" in s:
            words = json.load(open(A("vo", f"{s['id']}.words.json")))
            a = s["words"][0]
            b = s["words"][1] if len(s["words"]) > 1 else len(words)
            if a > 0:
                c0 = (words[a - 1]["e"] + words[a]["s"]) / 2
            if b < len(words):
                c1 = (words[b - 1]["e"] + words[b]["s"]) / 2
            y = y[int(c0 * SR) : int(c1 * SR)]
        dur = len(y) / SR
        end = slots[k + 1]["at"] - 0.12 if k + 1 < len(slots) else DUR - 0.25
        room = end - s["at"]
        tempo = 1.0
        if dur > room:
            tempo = min(MAX_TEMPO, dur / room)
            msg = f"{slot_key(s)} is {dur:.2f}s for a {room:.2f}s slot, sped up {tempo:.3f}x"
            print(("WARNING: " if dur / tempo > room else "note: ") + msg, file=sys.stderr)
            ff = ["ffmpeg", "-v", "error", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", f"atempo={tempo:.4f}", "-f", "f64le", "-"]
            y = np.frombuffer(subprocess.run(ff, input=y.astype(np.float64).tobytes(), check=True, capture_output=True).stdout, dtype=np.float64)
        y = fade(hp(y, 70, 2), 0.01, 0.03)
        y = compress(y * 10 ** ((NARR_LUFS - loudness(y)) / 20))
        g = NARR_LUFS - loudness(y)
        y = y * 10 ** (g / 20)
        put(out, s["at"], y)
        placement[slot_key(s)] = {"id": s["id"], "at": s["at"], "cut0": round(c0, 4), "tempo": round(tempo, 4), "duration": round(len(y) / SR, 3), "gain_db": round(g, 2)}
    json.dump(placement, open(B("vo_placement.json"), "w"), indent=1)
    assert {p["id"] for p in placement.values()} == set(lines), "every script line needs a slot"
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
    ir = make_ir(0.9, 0.006, 5500, 5)  # the steel room and stairwell: short and bright
    sfx_bus += np.stack([signal.fftconvolve(send[c], ir[c])[:N] for c in range(2)])
    sfx_bus = np.stack([hp(ch, 30, 2) for ch in sfx_bus])
    hits = np.stack([hp(ch, 25, 2) for ch in hits])
    music = build_music()
    music = music / (np.max(np.abs(music)) + 1e-9) * 0.5

    # beds: birds and the breeze outside (the birds flee at the blast), the room tone and
    # the fan inside; each follows whether the camera is looking into the shelter
    inside = inside_view(t)
    bird = birds(DUR)[:, :N] * (1 - smooth01(t, T["bird"] - 0.1, 0.6)) * np.minimum(t / 0.8, 1)
    breeze = breeze_bed()
    room = room_bed()
    fan = np.zeros((2, N))
    place(fan, T["fanOn"] + 0.05, s_fan(DUR - T["fanOn"] - 0.05), 0.0, 0.0)
    fan *= 0.35 + 0.65 * inside  # it hums on under everything, louder when we are inside

    e = envelope(vo, 0.01, 0.3)
    talk = np.clip(e / (np.percentile(e[e > 1e-4], 60) + 1e-9), 0, 1)
    # under the narrator the music gives way most in the speech band, so every word is clear
    def carve(st, lo=0.3, mid=0.7, high=0.45):
        a = np.stack([lp(ch, 260, 2) for ch in st])
        c = np.stack([hp(ch, 4500, 2) for ch in st])
        return a * (1 - lo * talk) + (st - a - c) * (1 - mid * talk) + c * (1 - high * talk)

    stems = {
        "vo": np.stack([vo, vo]),
        "sfx": (sfx_bus * (1 - 0.3 * talk) + hits) * 1.4,
        "music": carve(music) * 0.62,
        "ambience": (bird * 0.05 + breeze * 0.05) * (1 - 0.75 * inside) * (1 - 0.3 * talk) + room * 0.03 * inside,
        "fan": fan * 0.09 * (1 - 0.3 * talk),
    }
    mix = sum(stems.values())
    mix = np.stack([hp(ch, 25, 2) for ch in mix])
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
