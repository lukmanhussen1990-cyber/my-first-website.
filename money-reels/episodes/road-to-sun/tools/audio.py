"""Music, sound effects and the final mix, all synthesised in code.

Reads  audio/vo.wav and src/data/timeline.json
Writes audio/music.wav, audio/sfx.wav, public/audio/mix.wav (48 kHz stereo, -14 LUFS, <= -1 dBTP)
"""
import json
from pathlib import Path
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy import signal
from scipy.ndimage import minimum_filter1d

ROOT = Path(__file__).resolve().parents[1]
SR = 48000
TL = json.load(open(ROOT / "src/data/timeline.json"))
T, SC = TL["t"], TL["scenes"]
DUR = TL["duration"]
N = int(round(DUR * SR))
rng = np.random.default_rng(7)


# ---------- helpers ----------
def tt(d):
    return np.arange(int(d * SR)) / SR


def env_ad(n, a, d):
    """Attack time a, exponential decay constant d (seconds)."""
    t = np.arange(n) / SR
    e = np.exp(-t / d)
    na = max(int(a * SR), 1)
    e[:na] *= np.linspace(0, 1, na)
    return e


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], "bandpass", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "lowpass", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "highpass", fs=SR, output="sos"), x)


def noise(d):
    return rng.standard_normal(int(d * SR))


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, x, t, gain=1.0, pan=0.0):
    """Add mono x (or stereo [n,2]) into stereo buf at time t."""
    i = int(round(t * SR))
    if i >= len(buf):
        return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414], axis=1)
    if i < 0:
        x, i = x[-i:], 0
    n = min(len(x), len(buf) - i)
    buf[i:i + n] += x[:n] * gain


def sweep_noise(d, f0, f1, q=0.6):
    """Noise through a band-pass whose centre moves from f0 to f1 (block-wise)."""
    x = noise(d)
    out = np.zeros_like(x)
    blk = 256
    zi = None
    for s in range(0, len(x), blk):
        k = s / max(len(x) - 1, 1)
        fc = f0 * (f1 / f0) ** k
        lo, hi = max(fc * (1 - q / 2), 30), min(fc * (1 + q / 2), SR / 2 - 100)
        sos = signal.butter(2, [lo, hi], "bandpass", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[s:s + blk], zi = signal.sosfilt(sos, x[s:s + blk], zi=zi)
    return out


# ---------- instruments ----------
def pluck(f, d=0.45, bright=1.0):
    t = tt(d)
    y = np.zeros_like(t)
    for h, amp in [(1, 1.0), (2, 0.45 * bright), (3, 0.22 * bright), (4, 0.12 * bright), (5, 0.06 * bright)]:
        y += amp * np.sin(2 * np.pi * f * h * t) * np.exp(-t * (6 + 5 * h))
    y += 0.15 * hp(noise(d), 3000) * np.exp(-t * 120)
    return y * env_ad(len(t), 0.002, 0.35)


def bass(f, d=0.4):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    y = np.tanh(1.6 * y) * env_ad(len(t), 0.006, 0.22)
    y[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return y


def kick(d=0.35):
    t = tt(d)
    f = 45 + 95 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env_ad(len(t), 0.001, 0.12) + 0.2 * hp(noise(d), 2000) * np.exp(-t * 300)


def clap(d=0.25):
    x = bp(noise(d), 900, 2600)
    t = tt(d)
    e = np.zeros_like(t)
    for k, o in enumerate([0, 0.011, 0.022]):
        e += np.where(t >= o, np.exp(-(t - o) * (180 if k < 2 else 22)), 0)
    return x * e * 0.9


def hat(d=0.06, open_=False):
    x = hp(noise(d if not open_ else 0.25), 7000)
    return x * env_ad(len(x), 0.001, 0.012 if not open_ else 0.08) * 0.5


def snare(d=0.18):
    t = tt(d)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return 0.6 * body + 0.8 * bp(noise(d), 1500, 7000) * np.exp(-t * 25)


# ---------- music ----------
CHORDS = [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [60, 64, 67, 71]]  # Fmaj7 Em7 Dm7 Cmaj7
ROOTS = [41, 40, 38, 36]
ARP = [0, 2, 1, 3, 2, 1, 3, 2]
LEAD = [12 + 76, 0, 12 + 74, 12 + 72, 0, 12 + 69, 12 + 72, 0]


def in_any(t, ranges):
    return any(a <= t < b for a, b in ranges)


def make_music():
    buf = np.zeros((N, 2))
    beat = 60 / TL["bpm"]
    cut, drop = T["musicCut"], T["elonSun"]
    build = (T["elonIgnite"], cut)
    full = [(0, SC["intro"][0]), (SC["ronaldo"][0], SC["elon"][0]), (drop, SC["kicker"][0]), (SC["cta"][0], T["ctaGlow"])]
    light = [(SC["intro"][0], SC["ronaldo"][0]), (SC["elon"][0], build[0]), (SC["kicker"][0], SC["cta"][0])]

    def grid(start, end, phase0):
        k = 0
        while True:
            t8 = start + k * beat / 2
            if t8 >= end:
                break
            step = (phase0 + k) % 8
            bar = ((phase0 + k) // 8) % 4
            isfull, islight, isbuild = in_any(t8, full), in_any(t8, light), build[0] <= t8 < build[1]
            bprog = (t8 - build[0]) / (build[1] - build[0]) if isbuild else 0
            ch = CHORDS[bar]
            # pluck arpeggio
            if isfull or islight or isbuild:
                n = ch[ARP[step]] + (12 if isbuild and bprog > 0.5 and step % 2 else 0)
                g = 0.20 if islight else 0.24
                place(buf, pluck(midi(n), bright=0.8 + 0.6 * bprog), t8, g * (1 + 0.6 * bprog), pan=0.35 if step % 2 else -0.35)
            # bass on 1, the "and" of 2, and 3
            if (isfull or islight or isbuild) and step in (0, 3, 4, 7 if isfull else 4):
                place(buf, bass(midi(ROOTS[bar]), 0.36), t8, 0.42 if not islight else 0.34)
            # drums
            if isfull or isbuild:
                if step in (0, 4) or (isbuild and step in (2, 6) and bprog > 0.3):
                    place(buf, kick(), t8, 0.75)
                if isfull and step in (2, 6):
                    place(buf, clap(), t8, 0.5)
                if isfull:
                    place(buf, hat(open_=(step == 7)), t8, 0.32 if step % 2 else 0.2, pan=0.2)
                    place(buf, hat(), t8 + beat / 4, 0.12, pan=0.25)
            if islight and step in (2, 6):
                place(buf, clap(), t8, 0.32)
            if isfull and t8 >= drop and step in (0, 3, 6) and t8 < SC["kicker"][0]:
                place(buf, pluck(midi(LEAD[step] if LEAD[step] else 84), 0.6, 1.4), t8, 0.16, pan=0.0)
            k += 1

    grid(0, cut, 0)
    grid(drop, T["ctaGlow"], 0)

    # build: snare roll accelerating into the cut, plus a rising noise sweep
    t, step = T["elonMercury"] - 1.0, 0.25
    while t < cut - 0.03:
        place(buf, snare(), t, 0.18 + 0.35 * (t - (T["elonMercury"] - 1.0)) / (cut - T["elonMercury"] + 1.0))
        t += step
        step = max(step * 0.9, 0.045)
    riser_d = cut - build[0]
    r = sweep_noise(riser_d, 300, 9000, 0.5)
    r *= np.linspace(0, 1, len(r)) ** 2
    place(buf, r, build[0], 0.25)
    # hook riser into the whip-pan
    r = sweep_noise(1.2, 500, 8000, 0.6) * np.linspace(0, 1, int(1.2 * SR)) ** 2
    place(buf, r, T["hookWhip"] - 1.2, 0.2)
    # end sting: a long Fmaj7 chord that rings into the glow
    for m, g in [(53, 0.3), (65, 0.2), (69, 0.18), (72, 0.16), (76, 0.14), (84, 0.08)]:
        place(buf, pluck(midi(m), 2.2, 0.7), T["ctaGlow"], g)
    place(buf, bass(midi(41), 1.2), T["ctaGlow"], 0.4)
    # hard silence right before the Sun
    i0, i1 = int(cut * SR), int(drop * SR)
    fade = int(0.012 * SR)
    buf[i0 - fade:i0] *= np.linspace(1, 0, fade)[:, None]
    buf[i0:i1] = 0
    return buf


# ---------- sound effects ----------
def whoosh(d=0.45, f0=400, f1=3000, pan0=-0.6, pan1=0.6):
    x = sweep_noise(d, f0, f1, 0.9)
    t = np.linspace(0, 1, len(x))
    e = np.sin(np.pi * t) ** 1.6
    x = x * e
    pan = np.linspace(pan0, pan1, len(x))
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l, x * r], axis=1) * 1.4


def flutter(d=0.5, density=70):
    out = np.zeros(int(d * SR))
    n = int(d * density)
    for t0 in np.sort(rng.uniform(0, d - 0.03, n)):
        b = bp(noise(0.03), 1800, 6500) * env_ad(int(0.03 * SR), 0.001, 0.006)
        i = int(t0 * SR)
        out[i:i + len(b)] += b * rng.uniform(0.3, 1.0)
    return out * np.sin(np.pi * np.linspace(0, 1, len(out))) ** 0.5


def slap():
    t = tt(0.12)
    body = lp(noise(0.12), 900) * np.exp(-t * 60) * 1.4
    crack = bp(noise(0.12), 2000, 8000) * np.exp(-t * 150)
    return body + crack * 0.8


def cha_ching(big=False):
    d = 1.6 if big else 1.1
    t = tt(d)
    y = np.zeros_like(t)
    # "cha": drawer clunk and coin rattle
    y[:int(0.09 * SR)] += bp(noise(0.09), 400, 3000) * env_ad(int(0.09 * SR), 0.001, 0.02) * 0.9
    y += np.where(t > 0.0, np.sin(2 * np.pi * 120 * t) * np.exp(-t * 40), 0) * 0.5
    # "ching": bell partials
    o = 0.11
    tb = np.clip(t - o, 0, None)
    bell = np.zeros_like(t)
    for f, a, dec in [(2093, 1.0, 2.8), (3140, 0.6, 3.5), (4186, 0.45, 4.5), (5274, 0.3, 6), (6272, 0.2, 8)]:
        bell += a * np.sin(2 * np.pi * f * tb) * np.exp(-tb * dec)
    bell[t < o] = 0
    y += bell * 0.55
    if big:
        tb2 = np.clip(t - o - 0.12, 0, None)
        b2 = sum(a * np.sin(2 * np.pi * f * tb2) * np.exp(-tb2 * dec)
                 for f, a, dec in [(2637, 1.0, 3), (3951, 0.5, 4), (5274, 0.3, 6)])
        b2[t < o + 0.12] = 0
        y += b2 * 0.4
    return y


def tick():
    t = tt(0.02)
    return np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 400) * 0.5 + hp(noise(0.02), 4000) * np.exp(-t * 600) * 0.2


def pop(f0=900, f1=280):
    t = tt(0.09)
    f = f1 + (f0 - f1) * np.exp(-t * 60)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(t), 0.001, 0.03)


def thump():
    t = tt(0.3)
    f = 40 + 80 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(t), 0.001, 0.09) + lp(noise(0.3), 500) * np.exp(-t * 40) * 0.4


def rumble(d):
    x = lp(np.cumsum(noise(d)) / 60, 160, 4)
    x += lp(noise(d), 600) * 0.25
    t = np.linspace(0, 1, len(x))
    am = 1 + 0.25 * np.sin(2 * np.pi * 9 * t * d)
    return x * am * (0.3 + 0.7 * t) * np.minimum(1, t * 15)


def boom():
    d = 3.2
    t = tt(d)
    f = 28 + 70 * np.exp(-t * 6)
    low = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(t), 0.002, 0.9)
    crash = lp(noise(d), 4000) * env_ad(len(t), 0.001, 0.35) * 0.7
    shim = np.zeros_like(t)
    for fr in [3520, 4186, 5274, 6272, 7040]:
        shim += np.sin(2 * np.pi * fr * t + rng.uniform(0, 6)) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(5, 9) * t))
    shim *= env_ad(len(t), 0.05, 1.1) * 0.12
    return np.tanh(1.3 * (low * 1.2 + crash)) + shim


def shimmer(d=1.5):
    t = tt(d)
    y = np.zeros_like(t)
    for fr in [2637, 3520, 4186, 5274, 6272]:
        y += np.sin(2 * np.pi * fr * t + rng.uniform(0, 6)) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(6, 11) * t))
    return y * np.sin(np.pi * np.linspace(0, 1, len(t))) * 0.12


def horn():
    out = []
    for d in (0.16, 0.42):
        t = tt(d)
        vib = 1 + 0.004 * np.sin(2 * np.pi * 6 * t)
        y = signal.square(2 * np.pi * 392 * vib * t, 0.5) + signal.square(2 * np.pi * 494 * vib * t, 0.5)
        y = lp(y, 2200) * env_ad(len(t), 0.01, 10)
        y[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
        out += [y, np.zeros(int(0.07 * SR))]
    return np.concatenate(out) * 0.35


def engine(d):
    t = tt(d)
    f = 38 + 3 * np.sin(2 * np.pi * 0.7 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sign(np.sin(ph)) * 0.5 + 0.5 * np.sin(2 * ph)
    return lp(y, 400) * np.minimum(1, t * 4) * np.minimum(1, (d - t) * 4) * 0.5


def plane(d=1.6):
    t = np.linspace(0, 1, int(d * SR))
    f = 160 * (1.15 - 0.3 * t)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + lp(noise(d), 1200) * 0.5
    x = y * np.sin(np.pi * t) ** 2
    pan = np.linspace(0.8, -0.8, len(x))
    return np.stack([x * np.cos((pan + 1) * np.pi / 4), x * np.sin((pan + 1) * np.pi / 4)], axis=1)


def counter_ticks(buf, a, b):
    t = a
    while t < b:
        k = (t - a) / (b - a)
        place(buf, tick(), t, 0.28, pan=0.1)
        t += 0.035 + 0.15 * k ** 2


def make_sfx():
    buf = np.zeros((N, 2))
    P = lambda x, t, g=1.0, pan=0.0: place(buf, x, t, g, pan)
    # hook: start at full speed
    P(whoosh(0.7, 300, 2500, 0.8, -0.8), 0.0, 0.7)
    P(rumble(4.4), 0.05, 0.25)
    P(flutter(4.3, 25), 0.1, 0.25)
    P(shimmer(1.0), T["hookThumb"] - 0.1, 0.6)
    P(pop(), T["hookThumb"], 0.5)
    P(whoosh(0.5, 3000, 250, 0.7, -0.7), T["hookWhip"], 1.0)
    # intro
    P(flutter(0.45, 60), T["introFirstBill"], 0.8)
    P(slap(), T["introBillLand"], 0.9)
    t = T["introSlapStart"]
    for k in range(9):
        P(slap(), t, 0.55 + 0.05 * k, pan=rng.uniform(-0.3, 0.3))
        P(flutter(0.12, 80), t - 0.08, 0.5)
        t += 0.13 - 0.004 * k
    # you
    P(whoosh(0.35), SC["you"][0] - 0.12, 0.6)
    P(pop(), T["youPop"], 0.7)
    P(cha_ching(), T["youCash"], 0.65)
    P(flutter(T["youRoadEnd"] - T["youRoadStart"], 55), T["youRoadStart"], 0.55)
    counter_ticks(buf, TL["counter"][0]["from"], TL["counter"][0]["to"])
    P(pop(1100, 350), T["youBig"], 0.6)
    P(whoosh(0.35, 600, 2000), T["youWalk"] - 0.15, 0.5)
    for k in range(4):
        P(thump() * 0.25, T["youWalk"] + 0.15 + k * 0.28, 0.6, pan=0.2 if k % 2 else -0.2)
    # ronaldo
    P(whoosh(0.4), SC["ronaldo"][0] - 0.12, 0.7)
    P(whoosh(0.3, 500, 2500, 0, 0), T["ronJump"], 0.4)
    P(thump(), T["ronLand"], 0.9)
    P(cha_ching(), T["ronCash"], 0.65)
    P(whoosh(0.8, 200, 4000, 0, 0), T["ronLaunch"], 0.8)
    P(rumble(1.2), T["ronLaunch"], 0.3)
    P(flutter(T["ronRoadEnd"] - T["ronLaunch"], 40), T["ronLaunch"], 0.35)
    P(whoosh(0.4), T["ronRide"] - 0.1, 0.6)
    P(plane(1.6), T["ronPlane"], 0.45)
    counter_ticks(buf, TL["counter"][1]["from"], TL["counter"][1]["to"])
    P(thump(), T["ronRoadEnd"], 0.6)
    P(pop(1000, 300), T["ronBig"], 0.6)
    # mrbeast
    P(whoosh(0.4), SC["mrbeast"][0] - 0.12, 0.7)
    P(pop(), T["mbPop"], 0.7)
    P(cha_ching(), T["mbCash"], 0.65)
    P(flutter(0.8, 120), T["mbFire"], 0.8)
    for k in range(10):
        P(slap() * 0.4, T["mbFire"] + k * 0.06, 0.5)
    P(whoosh(0.45), T["mbRide"] - 0.1, 0.6)
    P(whoosh(0.3, 800, 3000, -0.8, 0.8), T["mbPassRon"], 0.45)
    P(whoosh(0.6, 200, 3500, -0.9, 0.9), T["mbMoon"] - 0.2, 0.9)
    counter_ticks(buf, TL["counter"][2]["from"], TL["counter"][2]["to"])
    P(thump(), T["mbRoadEnd"], 0.5)
    # elon
    P(whoosh(0.4), SC["elon"][0] - 0.12, 0.7)
    P(whoosh(0.25, 1500, 4000, 0, 0), T["elonZoom"] - 0.05, 0.6)
    P(cha_ching(big=True), T["elonCash"], 0.75)
    ign = T["elonIgnite"]
    P(rumble(T["musicCut"] - ign), ign, 0.6)
    P(boom() * 0.35, ign, 0.5)
    P(whoosh(0.5), T["elonRide"] - 0.1, 0.7)
    P(whoosh(0.9, 150, 6000, 0, 0), T["elonHyper"], 0.7)
    P(whoosh(0.3, 300, 4000, -0.9, 0.9), T["elonMoon"] - 0.1, 0.9)
    P(whoosh(0.3, 400, 4500, 0.9, -0.9), T["elonVenus"] - 0.1, 0.8)
    P(whoosh(0.3, 500, 5000, -0.9, 0.9), T["elonMercury"] - 0.1, 0.8)
    counter_ticks(buf, TL["counter"][3]["from"], T["musicCut"] - 0.05)
    # everything goes quiet for the 0.3 s gap, then the Sun hits
    i0, i1 = int(T["musicCut"] * SR), int(T["elonSun"] * SR)
    fade = int(0.015 * SR)
    buf[i0 - fade:i0] *= np.linspace(1, 0, fade)[:, None]
    buf[i0:i1] = 0
    P(boom(), T["elonSun"], 1.0)
    P(tick(), T["elonSun"], 0.4)
    P(shimmer(1.2), T["elonThumb"] - 0.1, 0.7)
    P(pop(), T["elonThumb"], 0.5)
    P(pop(1100, 300), T["elonBig"], 0.6)
    # kicker
    P(whoosh(0.4), SC["kicker"][0] - 0.12, 0.7)
    P(engine(T["kickHonk"] - T["kickDrive"] + 0.4), T["kickDrive"], 0.35)
    t, a, b = T["kickCalStart"], T["kickCalStart"], T["kickCalEnd"]
    while t < b:
        k = (t - a) / (b - a)
        P(flutter(0.04, 200) * 0.8 + slap() [:int(0.04 * SR)] * 0.3, t, 0.5)
        t += 0.12 - 0.1 * np.sin(np.pi * k)
    P(pop(1200, 300), T["kickBig"], 0.6)
    P(horn(), T["kickHonk"], 0.9)
    # cta
    P(whoosh(0.4), SC["cta"][0] - 0.12, 0.7)
    P(pop(), T["ctaPop"], 0.7)
    P(pop(1000, 400), T["ctaText"], 0.5)
    P(pop(1300, 500), T["ctaComments"], 0.5)
    P(shimmer(1.5), T["ctaGlow"], 0.8)
    return buf


# ---------- voice and mix ----------
def compress(x, thr_db=-20, ratio=3.0, att=0.004, rel=0.12):
    lvl = np.abs(x)
    a_a, a_r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    env = np.zeros_like(lvl)
    e = 0.0
    for i, v in enumerate(lvl):
        e = a_a * e + (1 - a_a) * v if v > e else a_r * e + (1 - a_r) * v
        env[i] = e
    db = 20 * np.log10(np.maximum(env, 1e-6))
    gr = np.minimum(0, (thr_db - db) * (1 - 1 / ratio))
    return x * 10 ** (gr / 20)


def limiter(x, ceiling_db=-1.0, look=0.003, rel=0.08):
    ceil = 10 ** (ceiling_db / 20)
    # 4x oversampled peak estimate for true-peak safety
    peak = np.abs(signal.resample_poly(np.max(np.abs(x), axis=1), 4, 1))
    peak = peak.reshape(-1, 4).max(axis=1)[:len(x)]
    need = np.minimum(1, ceil / np.maximum(peak, 1e-9))
    w = int(look * SR)
    need = minimum_filter1d(need, 2 * w + 1)
    g = np.ones_like(need)
    a_r = np.exp(-1 / (rel * SR))
    cur = 1.0
    for i, v in enumerate(need):
        cur = v if v < cur else a_r * cur + (1 - a_r) * v
        g[i] = cur
    return x * g[:, None]


def main():
    vo, sr = sf.read(ROOT / "audio/vo.wav")
    assert sr == SR
    vo = vo[:N] if len(vo) >= N else np.pad(vo, (0, N - len(vo)))
    vo = hp(vo, 85)
    vo = vo + 0.25 * bp(vo, 2500, 5000)  # presence
    vo = compress(vo, -22, 3.0)
    vo = vo / np.max(np.abs(vo)) * 0.9

    music = make_music()
    sfx = make_sfx()
    sf.write(ROOT / "audio/music.wav", music / max(1e-9, np.abs(music).max()) * 0.9, SR)
    sf.write(ROOT / "audio/sfx.wav", sfx / max(1e-9, np.abs(sfx).max()) * 0.9, SR)

    meter = pyln.Meter(SR)
    def norm(x, target):
        return x * 10 ** ((target - meter.integrated_loudness(x)) / 20)
    vo2 = np.stack([vo, vo], axis=1)
    vo2 = norm(vo2, -16.0)
    music = norm(music, -27.0)
    sfx = norm(sfx, -25.0)

    # duck the music under the voice (~8 dB)
    env = lp(np.abs(vo), 6, 1)
    env = np.clip(env / (np.percentile(env[env > 1e-4], 90) + 1e-9), 0, 1)
    duck = 1 - 0.6 * env
    mix = vo2 + music * duck[:, None] + sfx
    mix = norm(mix, -14.0)
    mix = limiter(mix, -1.0)
    mix = norm(mix, -14.0)
    mix = limiter(mix, -1.0)
    (ROOT / "public/audio").mkdir(parents=True, exist_ok=True)
    sf.write(ROOT / "public/audio/mix.wav", mix.astype(np.float32), SR, subtype="PCM_24")
    tp = 20 * np.log10(np.abs(signal.resample_poly(mix, 4, 1, axis=0)).max())
    print(f"mix: {meter.integrated_loudness(mix):.2f} LUFS, true peak {tp:.2f} dBTP, {len(mix)/SR:.2f}s")


if __name__ == "__main__":
    main()
