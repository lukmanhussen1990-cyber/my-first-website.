#!/usr/bin/env python3
"""Synthesise every sound effect in code (no samples, no music) and write audio/sfx.wav.

Timing comes from the animation itself:
  audio/events.json  one-shot events (name, story time tau, real time t)
  audio/tracks.json  per-frame tracks: cart speed, blower level, rivals, cart-row push
"""
import json, sys
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt, sosfiltfilt
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
DUR = 56.0
N = int(SR * (DUR + 0.5))
rng = np.random.default_rng(7)

ev = json.loads((ROOT / "audio/events.json").read_text())
tracks = json.loads((ROOT / "audio/tracks.json").read_text())
T = {}
for e in ev:
    T.setdefault(e["name"], []).append(e["t"])
def t1(name, i=0):
    return T[name][i]

L = np.zeros(N); R = np.zeros(N)

# ------------------------------------------------------------------ helpers
def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)
def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)
def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)
def tt(d):
    return np.arange(int(d * SR)) / SR
def noise(d):
    return rng.standard_normal(int(d * SR))
def pink(d):
    n = int(d * SR); X = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR); f[0] = 1
    y = np.fft.irfft(X / np.sqrt(f), n); return y / (np.abs(y).max() + 1e-9)
def env_ad(d, a, dec):
    t = tt(d); return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / dec)
def add(t0, sig, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i < 0: sig = sig[-i:]; i = 0
    n = min(len(sig), N - i)
    if n <= 0: return
    gl = gain * np.cos((pan + 1) * np.pi / 4) * np.sqrt(2); gr = gain * np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
    L[i:i + n] += sig[:n] * gl; R[i:i + n] += sig[:n] * gr
def track(key):
    t = np.array([f["t"] for f in tracks]); v = np.array([f[key] for f in tracks], dtype=float)
    return np.interp(np.arange(N) / SR, t, v)
def mixs(*xs):
    n = max(len(x) for x in xs); out = np.zeros(n)
    for x in xs: out[:len(x)] += x
    return out
def norm(x):
    return x / (np.abs(x).max() + 1e-9)

# ------------------------------------------------------------------ building blocks
def metal_tick(f=None, dec=0.012):
    f = f or rng.uniform(2200, 6500); t = tt(dec * 6)
    s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.47 * t) + 0.3 * np.sin(2 * np.pi * f * 2.31 * t)
    return s * np.exp(-t / dec) * (0.6 + 0.4 * rng.random())

def click(d=0.004, f=3000):
    return hp(noise(d), f) * np.exp(-tt(d) / (d / 3))

def pop(f0=420, f1=950, d=0.06):
    t = tt(d); f = f0 + (f1 - f0) * (t / d); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / (d / 3)) * np.minimum(1, t / 0.003)

def snap():
    t = tt(0.12)
    ring = (np.sin(2 * np.pi * 2900 * t) + 0.6 * np.sin(2 * np.pi * 4300 * t)) * np.exp(-t / 0.025)
    s = np.zeros_like(t); c = click(0.003, 2500); s[:len(c)] += c * 1.5
    return s + ring * 0.5

def whoosh(d=0.45, f0=300, f1=2600, f2=500):
    n = noise(d); t = tt(d); u = t / d
    fc = np.where(u < 0.5, f0 + (f1 - f0) * (u / 0.5), f1 + (f2 - f1) * ((u - 0.5) / 0.5))
    out = np.zeros_like(n); blk = 480
    for i in range(0, len(n), blk):
        c = fc[i]; seg = n[max(0, i - 2000):i + blk]
        y = bp(seg, max(60, c * 0.6), min(20000, c * 1.6)); out[i:i + blk] = y[-len(n[i:i + blk]):]
    return out * np.sin(np.pi * u) ** 2

def thud(f=70, d=0.35, noise_amt=0.6):
    t = tt(d); s = np.sin(2 * np.pi * (f + 40 * np.exp(-t / 0.03)) * t) * np.exp(-t / 0.09)
    return s + noise_amt * lp(noise(d), 500) * np.exp(-t / 0.05)

def bell(f=1320, d=2.2):
    t = tt(d); parts = [(1.0, 1.0, 1.2), (2.0, 0.5, 0.8), (2.76, 0.45, 0.6), (4.07, 0.3, 0.35), (5.4, 0.2, 0.25), (0.5, 0.25, 1.5)]
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / dec) for r, a, dec in parts)
    return s * np.minimum(1, t / 0.002)

def squeal(d, f=3000, vib=6.0):
    t = tt(d); fm = f + 60 * np.sin(2 * np.pi * vib * t) + 40 * np.sin(2 * np.pi * 13 * t)
    ph = 2 * np.pi * np.cumsum(fm) / SR
    a = 0.6 + 0.4 * np.abs(lp(noise(d), 18))[: len(t)] / 0.05
    a = np.clip(a, 0, 1.2)
    e = np.minimum(1, t / 0.06) * np.minimum(1, (d - t) / 0.15)
    return (np.sin(ph) + 0.3 * np.sin(2 * ph)) * e * a

def creak(d, f=380):
    t = tt(d); out = np.zeros_like(t); tt0 = 0.0
    while tt0 < d:
        period = 1 / (f * rng.uniform(0.04, 0.09)); i = int(tt0 * SR)
        g = np.exp(-tt(0.02) / 0.004) * np.sin(2 * np.pi * f * rng.uniform(0.9, 1.3) * tt(0.02))
        out[i:i + len(g)] += g[: len(out) - i]; tt0 += period
    return bp(out, 150, 2500) * np.sin(np.pi * t / d)

# ------------------------------------------------------------------ continuous layers
speed = track("speed"); blow = track("blower"); rival = track("rival"); push = track("push"); slow = track("slow")
tN = np.arange(N) / SR
clack_t = t1("clack")
# the comedy beat: everything continuous drops out just before the clack
silence = 1 - np.clip((tN - (clack_t - 0.62)) / 0.12, 0, 1) * (tN < clack_t)
after = np.clip((tN - clack_t) / 0.02, 0, 1)
gate = np.where(tN < clack_t, silence, after)

# soft outdoor air (very quiet, not music)
amb = lp(pink(DUR + 0.5), 900) * 0.11
amb2 = hp(pink(DUR + 0.5), 3000) * 0.012
L += (amb + amb2)[:N] * gate; R += (np.roll(amb, 911) + np.roll(amb2, 417))[:N] * gate

def rattle_stream(spd, level=1.0, seed=0, pan=0.0):
    """wire-cart rattle: metallic ticks at a speed-dependent rate + wheel rumble"""
    r = np.random.default_rng(seed)
    out = np.zeros(N); t = 0.0
    while t < DUR:
        i = int(t * SR); v = spd[i]
        rate = 6 + 32 * min(v, 6) if v > 0.05 else 0
        if rate <= 0: t += 0.02; continue
        g = metal_tick(r.uniform(2000, 6500), r.uniform(0.006, 0.016)) * min(1, 0.5 + v / 3)
        out[i:i + len(g)] += g[: N - i] * r.uniform(0.3, 1.0)
        t += r.exponential(1 / rate)
    rum = lp(noise(DUR + 0.5), 260)[:N] * np.clip(spd / 4, 0, 1.2) ** 0.8 * 2.2
    # periodic wheel thump from small asphalt joints
    wheel_ph = np.cumsum(spd / (2 * np.pi * 0.057)) / SR
    thumps = (np.sin(2 * np.pi * wheel_ph) > 0.97).astype(float)
    thumps = lp(thumps, 300) * np.clip(spd / 3, 0, 1) * 6
    return (out * 0.16 + rum * 0.05 + thumps * 0.03) * level

johnR = rattle_stream(speed, 1.0, 1)
add(0, johnR * gate, 1.0, 0.0)
add(0, rattle_stream(rival, 0.55, 2) * gate, 1.0, -0.35)
add(0, rattle_stream(rival * 0.9, 0.45, 3) * gate, 1.0, 0.35)
add(0, rattle_stream(push * 1.4, 1.0, 4), 1.0, -0.1)

# rushing wind with speed
wind = pink(DUR + 0.5)[:N]
wl = np.clip((speed - 2.0) / 5.0, 0, 1) ** 1.5
w1 = bp(wind, 300, 1400) * wl * 0.35 + hp(wind, 2500) * wl * 0.05
add(0, w1 * gate, 1.0, 0.0)

# leaf blower engine + air
t_axis = tN
f0 = 92 + 30 * np.clip(blow, 0, 1)
ph = 2 * np.pi * np.cumsum(f0) / SR
eng = sum((1 / k ** 0.9) * np.sin(k * ph + 0.3 * k) for k in range(1, 28))
eng *= 1 + 0.35 * np.sin(ph / 2)                # two-stroke unevenness
eng = lp(eng, 3800) * 0.07
air = bp(noise(DUR + 0.5)[:N], 600, 4200) * 0.12 + bp(noise(DUR + 0.5)[:N], 150, 600) * 0.08
lvl = np.clip(blow, 0, 1.2)
add(0, (eng * lvl ** 0.7 + air * lvl ** 1.2) * gate, 1.0, -0.05)
# pull-start rev ups
for name in ["blower_on", "blower_on2"]:
    for t0 in T.get(name, []):
        d = 0.45; t = tt(d); f = 40 + 80 * (t / d) ** 0.6; p2 = 2 * np.pi * np.cumsum(f) / SR
        s = sum((1 / k) * np.sin(k * p2) for k in range(1, 18)) * np.minimum(1, t / 0.05)
        add(t0 - 0.25, lp(s, 3000) * 0.12)
        add(t0 - 0.35, creak(0.22, 900) * 0.15)   # cord zip

# broom scrape + spark crackle
bt0, bt1 = t1("broom_drag"), t1("stop")
d = bt1 - bt0 + 0.3
sc = noise(d); t = tt(d)
sp = np.interp(bt0 + t, tN, speed)
scrape = (bp(sc, 900, 5000) * 0.5 + bp(sc, 200, 900) * 0.4) * np.clip(sp / 3, 0, 1) ** 0.7
scrape *= 1 + 0.5 * np.sin(2 * np.pi * 11 * t) * np.sin(2 * np.pi * 3.1 * t)
add(bt0, scrape * np.minimum(1, t / 0.05) * 0.5, 1.0, 0.1)
tc = 0.0
while tc < d - 0.3:
    v = np.interp(bt0 + tc, tN, speed)
    if v > 0.6:
        add(bt0 + tc, hp(noise(0.006), 4000) * np.exp(-tt(0.006) / 0.0015) * rng.uniform(0.1, 0.35), 1.0, rng.uniform(-0.3, 0.5))
    tc += rng.exponential(1 / (20 + 60 * min(v, 5) / 5))

# wobbly wheel shimmy (S2)
w0, w1t = t1("wobble_start"), t1("bonk")
d = w1t - w0; t = tt(d)
shim = np.zeros_like(t)
for k in range(int(d * 8.5 * 2)):
    i = int(k / 17.0 * SR)
    g = metal_tick(rng.uniform(1500, 3500), 0.02) * (0.6 + 0.4 * (k % 2)); shim[i:i + len(g)] += g[: len(shim) - i]
wub = np.sin(2 * np.pi * 8.5 * t) * lp(noise(d), 180) * 3
add(w0, (shim * 0.35 + wub * 0.08) * np.minimum(1, t / 0.3), 1.0, 0.15)
add(w0 + 0.2, squeal(d - 0.2, 1900, 8.5) * 0.04, 1.0, 0.15)

# a few distant evening birds (very soft) in calm moments
def chirp(f0, n=3):
    out = []
    for k in range(n):
        d = 0.07 + rng.random() * 0.05; t = tt(d); f = f0 * (1 + 0.25 * np.sin(np.pi * t / d)) * (1 + 0.1 * k)
        out.append(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2); out.append(np.zeros(int(0.05 * SR)))
    return np.concatenate(out)
for t0, f0 in [(0.6, 3600), (2.2, 4200), (5.4, 3900), (12.6, 3700), (13.4, 4300), (41.6, 3800), (42.3, 4100)]:
    add(t0, chirp(f0, 2 + int(rng.random() * 3)) * 0.018, 1.0, rng.uniform(-0.7, 0.7))

# ------------------------------------------------------------------ one-shots
add(t1("jump") - 0.05, pop(260, 620, 0.16) * 0.18)
add(t1("land"), thud(90, 0.25, 0.4) * 0.35); add(t1("land"), johnR[:1] * 0)  # landing
for k in range(6): add(t1("land") + 0.01 * k, metal_tick(dec=0.03) * 0.3)
g = t1("goggles"); add(g, snap() * 0.35); add(g, pop(200, 120, 0.07) * 0.25)
for k in T.get("kick", []):
    s = bp(noise(0.12), 900, 4500) * np.exp(-tt(0.12) / 0.03)
    add(k - 0.02, s * 0.45, 1.0, 0.25)
# bonk on the parked car (cartoon, soft)
b = t1("bonk"); t = tt(0.6)
bonk = np.sin(2 * np.pi * np.cumsum(170 + 150 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.16)
body = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / dd) for f, a, dd in [(95, 0.8, 0.2), (240, 0.4, 0.12), (410, 0.25, 0.08)])
add(b, (bonk * 0.55 + body * 0.35 + click(0.004, 1500)[: len(t)].sum() * 0) * 0.8)
add(b, click(0.004, 1500) * 0.6)
for k in range(10): add(b + 0.005 * k, metal_tick(dec=0.02) * 0.25)
# dizzy twinkles
for k, f in enumerate([2637, 3136, 3520, 3136, 2637, 3520]):
    t = tt(0.25); add(b + 0.15 + k * 0.17, np.sin(2 * np.pi * f * t) * np.exp(-t / 0.06) * 0.05, 1.0, 0.4 * np.sin(k))
# upgrades popping in + snapping on
for name in ["wrench_pop", "blower_pop", "rope_pop", "broom_pop"]:
    t0 = t1(name); add(t0, pop(380, 1000, 0.07) * 0.3); add(t0 + 0.16, snap() * 0.4)
add(t1("wrench_out"), pop(900, 400, 0.08) * 0.2)
# wrench ratchet
r0, r1 = t1("wrench_turns"), t1("wrench_done")
tc = r0
while tc < r1:
    s = click(0.003, 2500) * 0.9; t = tt(0.04); ring = np.sin(2 * np.pi * 3300 * t) * np.exp(-t / 0.012) * 0.4
    add(tc, s * 0.5, 1.0, 0.2); add(tc, ring * 0.3, 1.0, 0.2)
    tc += 1 / 13.0 + (0.03 if int((tc - r0) * 13) % 4 == 3 else 0)
t = tt(0.8); add(t1("wrench_done"), (np.sin(2 * np.pi * 2600 * t) + 0.5 * np.sin(2 * np.pi * 5230 * t)) * np.exp(-t / 0.18) * 0.12, 1.0, 0.2)
# glowing arrows appear: soft swell
t = tt(0.5); add(t1("blower_on") + 0.05, np.sin(2 * np.pi * 523 * t) * np.sin(np.pi * t / 0.5) ** 2 * 0.04 + bp(noise(0.5), 2000, 6000) * np.sin(np.pi * t / 0.5) ** 2 * 0.03)
# casters spinning freely (S4): fast whirr + rattle
c0 = t1("casters_spin"); d = t1("rope_pop") - c0; t = tt(d)
whirr = bp(noise(d), 1200, 3000) * (0.5 + 0.5 * np.sin(2 * np.pi * 14 * t)) * np.minimum(1, t / 0.3) * np.minimum(1, (d - t) / 0.2)
add(c0, whirr * 0.12, 1.0, 0.2)
# rope creak + pulled tight
add(t1("rope_pull"), creak(0.55, 420) * 0.5, 1.0, 0.1)
# tyre squeals in turns
add(t1("turn_squeak"), squeal(1.3, 2950) * 0.08, 1.0, 0.2)
add(t1("tip_squeal"), squeal(1.15, 2600, 9) * 0.1, 1.0, -0.2)
add(t1("tip_squeal") + 0.1, creak(1.0, 300) * 0.35, 1.0, -0.2)
add(t1("tip_slam"), thud(80, 0.4, 0.8) * 0.5); [add(t1("tip_slam") + 0.006 * k, metal_tick(dec=0.03) * 0.35) for k in range(14)]
add(t1("corner2"), squeal(0.6, 3100) * 0.03, 1.0, 0.2)
# whip transitions
for t0 in T.get("whip", []): add(t0 - 0.22, whoosh(0.5) * 0.35, 1.0, 0.0)
# downhill: rising rumble already in the rattle; add a little "uh-oh" whistle of speed
d = 3.0; t = tt(d); add(t1("downhill") + 0.2, bp(noise(d), 500, 2500) * (t / d) ** 2 * 0.15)
# stop at the boxes: skid end + cardboard creak + box wobble
add(t1("stop") - 0.1, bp(noise(0.3), 300, 2000) * np.exp(-tt(0.3) / 0.08) * 0.3)
add(t1("box_wobble"), lp(creak(0.8, 160), 900) * 0.6, 1.0, -0.2)
for k in range(3): add(t1("box_wobble") + 0.18 * k + 0.05, thud(140, 0.15, 0.5) * 0.06 * (1 - k * 0.3))
# potato sacks
for name in ["potato1", "potato2"]:
    t0 = t1(name); add(t0 - 0.35, whoosh(0.35, 300, 900, 300) * 0.12)
    add(t0, thud(62, 0.4, 1.0) * 0.8); add(t0, bp(noise(0.12), 700, 2400) * np.exp(-tt(0.12) / 0.03) * 0.3)
    for k in range(5): add(t0 + 0.004 * k, metal_tick(rng.uniform(1500, 3000), 0.04) * 0.15)
# centre-of-mass dot moving lower: soft descending tone
t = tt(0.8); f = 880 * 2 ** (-t / 0.8); add(t1("potato2") + 0.05, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.8) * 0.05)
# race: flag whoosh, start
add(t1("flag") - 0.1, whoosh(0.4, 400, 3000, 700) * 0.5, 1.0, -0.3)
add(t1("flag") + 0.18, bp(noise(0.2), 400, 3000) * np.exp(-tt(0.2) / 0.05) * 0.2, 1.0, -0.3)
# finish: big ding + confetti pops and paper flutter (slow-mo makes the ding long)
fz = t1("finish")
add(fz, bell(1320, 3.0) * 0.16); add(fz + 0.22, bell(1760, 2.6) * 0.1)
for k, pan in enumerate([-0.6, 0.6]):
    add(fz + 0.03 * k, mixs(thud(110, 0.2, 0.4) * 0.3, bp(noise(0.08), 1000, 4000) * np.exp(-tt(0.08) / 0.02) * 0.4), 1.0, pan)
d = 2.5; t = tt(d); flutter = hp(noise(d), 2500) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 9 * t))) * np.exp(-t / 1.0) * 0.06
add(fz + 0.1, flutter, 1.0, 0.0)
# THE CLACK: cart nests into the row, chain reaction down the line
c = clack_t; t = tt(0.6)
clk = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / dd) for f, a, dd in [(1150, 0.6, 0.12), (2380, 0.5, 0.08), (3950, 0.35, 0.05), (5600, 0.2, 0.03), (620, 0.4, 0.09)])
add(c, click(0.005, 1200) * 1.2 + clk[:240] * 0, 1.0, -0.1)
add(c, clk * 0.55, 1.0, -0.1)
for k in range(1, 8):
    add(c + 0.025 * k, clk * (0.3 * 0.82 ** k), 1.0, -0.1 - 0.06 * k); add(c + 0.025 * k, click(0.003, 2000) * 0.4 * 0.8 ** k, 1.0, -0.1 - 0.06 * k)
for k in range(12): add(c + rng.uniform(0.02, 0.35), metal_tick(dec=0.02) * rng.uniform(0.05, 0.2), 1.0, rng.uniform(-0.6, 0.2))
# worker footsteps
w = t1("worker_walk") - 0.35
for k in range(5): add(w + k * 0.29, lp(noise(0.06), 1500) * np.exp(-tt(0.06) / 0.015) * 0.25, 1.0, 0.3 - 0.08 * k)
# thumbs up: tiny sparkle
t = tt(0.4); add(t1("thumbs"), (np.sin(2 * np.pi * 2093 * t) + np.sin(2 * np.pi * 3136 * t)) * np.exp(-t / 0.1) * 0.05, 1.0, 0.2)
# automatic doors sliding open: motor whine + slide + soft stop
dt0 = t1("doors"); d = 0.7; t = tt(d)
fm = 150 + 90 * (t / d); motor = (np.sin(2 * np.pi * np.cumsum(fm) / SR) + 0.4 * np.sin(4 * np.pi * np.cumsum(fm) / SR)) * (1 + 0.3 * np.sin(2 * np.pi * 30 * t))
slide = lp(noise(d), 1200) * 0.6
e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.6
add(dt0, (motor * 0.05 + slide * 0.12) * e, 1.0, -0.4)
add(dt0 + d - 0.05, thud(120, 0.15, 0.3) * 0.12, 1.0, -0.4)
t = tt(1.4); add(dt0 + 0.05, (np.sin(2 * np.pi * 1047 * t) * np.exp(-t / 0.35) * 0.04 + np.sin(2 * np.pi * 784 * np.maximum(t - 0.28, 0)) * (t > 0.28) * np.exp(-np.maximum(t - 0.28, 0) / 0.45) * 0.04), 1.0, -0.4)

# ------------------------------------------------------------------ master
mix = np.stack([L, R], 1)
mix = sosfiltfilt(butter(1, 30, btype="high", fs=SR, output="sos"), mix, axis=0)
peak = np.abs(mix).max(); mix = mix / peak * 0.7
(ROOT / "audio").mkdir(exist_ok=True)
sf.write(str(ROOT / "audio/sfx.flac"), mix.astype(np.float32), SR, subtype="PCM_24")
print("wrote audio/sfx.flac", mix.shape, "peak was", round(float(peak), 3))
