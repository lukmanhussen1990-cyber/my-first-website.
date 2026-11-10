#!/usr/bin/env python3
"""Procedural sound design + mix for the reel. All SFX are synthesized (numpy only), timed to the whisper word
timestamps, side-chain ducked under the voiceover and mixed to a 48 kHz stereo WAV.
usage: python3 audio/make_audio.py  ->  out/mix.wav"""
import json, subprocess, os, sys
import numpy as np

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUR = 35.866
N = int(round(DUR * SR))
rng = np.random.default_rng(7)
words = json.load(open(os.path.join(ROOT, 'assets/words.json')))

# ---- story beats (mirror src/times.js)
T = dict(S2=4.22, S3=5.80, S5=11.74, P2=12.82, P3=13.47, P4=14.43, S6=15.70, DOG=18.30, S6C=19.25, S7=19.86, S8=24.12, S10=26.48, S10B=27.12, S11=28.26, S11B=31.02, S12=32.66, S13=34.84,
         SEND=9.06, WHIP=9.50, FAMILY=9.68, BEAT1=10.06, BEAT2=10.58, BEAT3=10.86, TAPS=[16.10, 16.52, 16.95, 17.30], PIN=19.50,
         SEEN_DAD=20.20, SEEN_UNCLE=21.40, SEEN_GRANDMA=22.92, MOM_TYPING=24.22, DAD_TYPING=25.46, THUNDER=25.62, LEFT=26.56, SLAM=27.60, MOM_REPLY=29.84, DAD_AGAIN=32.72, SCRATCH=34.60, GENIUS=35.06)
MESSAGE = 'your mom is so fucking hot'
def key_times():
    out = []; parts = MESSAGE.split(' ')
    for i, p in enumerate(parts):
        w = words[16 + i]; s_ = (' ' if i else '') + p; ln = len(s_); s = w['s'] - 0.05; e = min(w['e'] - 0.06, w['s'] + 0.06 * ln + 0.12)
        out += [s + (e - s) * k / ln for k in range(ln)]
    return out

# ---- dsp helpers
def tt(d): return np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR))
def band(x, lo, hi, soft=0.25):
    n = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    g = 1 / (1 + (lo / np.maximum(f, 1e-3)) ** (2 / soft)) * 1 / (1 + (f / hi) ** (2 / soft))
    return np.fft.irfft(X * g, n)
def env_ad(d, a, dec, curve=1.0):
    t = tt(d); return np.minimum(t / max(a, 1e-4), 1.0) * np.exp(-np.maximum(t - a, 0) / dec) ** curve
def fade(x, a=0.005, r=0.01):
    n = len(x); e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return x * e
def norm(x, peak=1.0): m = np.max(np.abs(x)) + 1e-9; return x / m * peak
def sweep(d, f0, f1, shape=1.0):
    t = tt(d); u = (t / d) ** shape; f = f0 * (f1 / f0) ** u; return np.sin(2 * np.pi * np.cumsum(f) / SR)

bus = np.zeros((N, 2))      # ducked sfx bus
bus_nd = np.zeros((N, 2))   # non-ducked (very quiet bed) bus
def place(x, t, gain=1.0, pan=0.0, target=None):
    target = bus if target is None else target
    i = int(round(t * SR));
    if i < 0: x = x[-i:]; i = 0
    n = min(len(x), N - i)
    if n <= 0: return
    l = np.cos((pan + 1) * np.pi / 4) * 1.414; r = np.sin((pan + 1) * np.pi / 4) * 1.414
    target[i:i + n, 0] += x[:n] * gain * l; target[i:i + n, 1] += x[:n] * gain * r
def reverb(x, mix=0.25, decay=0.5):
    out = np.copy(x)
    for d, g in [(0.0297, 0.6), (0.0371, 0.55), (0.0411, 0.5), (0.0437, 0.45), (0.071, 0.3)]:
        k = int(d * SR); y = np.zeros(len(x) + k * 8)
        for j in range(1, 8): y[k * j:k * j + len(x)] += x * (g * decay * 2) ** j
        out = out + mix * y[:len(x)] if len(y) >= len(x) else out
    return out

# ---- sound makers
def creak(up=True, d=0.2):
    f0, f1 = (520, 880) if up else (840, 500)
    f0 *= 1 + rng.uniform(-0.06, 0.06); f1 *= 1 + rng.uniform(-0.06, 0.06)
    t = tt(d); u = t / d; f = f0 + (f1 - f0) * u ** 0.7 + 30 * np.sin(2 * np.pi * 37 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    stick = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * (70 + 40 * u) * t))        # stick-slip chatter
    tone = (np.sin(ph) + 0.5 * np.sin(2 * ph + 0.3) + 0.3 * np.sin(3 * ph) + 0.2 * np.sin(5.03 * ph)) * (0.55 + 0.45 * stick)
    spring = band(noise(d), 1800, 5200) * 0.35 * np.sin(np.pi * u) ** 2
    wood = np.sin(2 * np.pi * 92 * t) * np.exp(-t / 0.05) * 0.9
    return fade((tone * np.sin(np.pi * u) ** 1.5 * 0.5 + spring) * 0.8 + wood, 0.004, 0.02)
def breath(inhale, d):
    x = noise(d); t = tt(d); u = t / d
    y = band(x, 900, 3800) * 0.9 + band(x, 250, 700) * 0.5 if not inhale else band(x, 1500, 5200) * 0.8 + band(x, 500, 1200) * 0.3
    e = np.sin(np.pi * u) ** (1.2 if inhale else 0.8) * (1 + 0.15 * np.sin(2 * np.pi * 23 * t))
    voice = 0 if inhale else 0.12 * np.sin(2 * np.pi * (150 - 30 * u) * t) * e      # faint vocal grunt on the exhale
    return fade(y * e + voice, 0.01, 0.02)
def tick(f=2100, d=0.03):
    t = tt(d); return (np.sin(2 * np.pi * f * t) * 0.5 + band(noise(d), 1500, 7000) * 0.7) * np.exp(-t / 0.006) + np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.012) * 0.6
def whoosh(d=0.42, lo=300, hi=5000, rise=True):
    x = noise(d); t = tt(d); u = t / d; out = np.zeros(len(x)); bands = np.geomspace(lo, hi, 9)
    for i in range(8):
        c = (i + 0.5) / 8; pos = u if rise else 1 - u
        w = np.exp(-((pos - c) / 0.22) ** 2); out += band(x, bands[i], bands[i + 1]) * w
    return fade(out * np.sin(np.pi * u) ** 0.8, 0.01, 0.03)
def thump(f=58, d=0.38, click=0.3):
    t = tt(d); fr = f * (1 + 1.6 * np.exp(-t / 0.018)); x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.11)
    return fade(np.tanh(x * 1.8) + click * band(noise(d), 80, 900) * np.exp(-t / 0.012), 0.001, 0.03)
def heartbeat(): x = np.zeros(int(0.62 * SR)); a = thump(60, 0.3, 0.25); b = thump(50, 0.3, 0.15) * 0.75; x[:len(a)] += a; k = int(0.17 * SR); x[k:k + len(b)] += b; return x
def impact(d=0.7):
    t = tt(d); sub = np.sin(2 * np.pi * np.cumsum(46 * (1 + 2.2 * np.exp(-t / 0.03))) / SR) * np.exp(-t / 0.2)
    return fade(np.tanh(sub * 2.2) * 0.9 + band(noise(d), 100, 2400) * np.exp(-t / 0.04) * 0.6, 0.001, 0.05)
def pop(f0=420, f1=1150, d=0.14):
    t = tt(d); x = sweep(d, f0, f1, 0.5) * np.exp(-t / 0.035) + 0.3 * band(noise(d), 800, 5000) * np.exp(-t / 0.004); return fade(x, 0.001, 0.02)
def bloop(f0=300, f1=620, d=0.22):
    t = tt(d); return fade(sweep(d, f0, f1, 0.6) * np.sin(np.pi * t / d) ** 0.6 * (1 + 0.3 * np.sin(2 * np.pi * 28 * t)), 0.005, 0.03)
def bell(f, d=0.9, bright=1.0):
    t = tt(d); x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (dc * d)) for m, a, dc in [(1, 1, 0.3), (2.0, 0.45 * bright, 0.2), (3.01, 0.22 * bright, 0.12), (4.2, 0.12 * bright, 0.08), (5.4, 0.06 * bright, 0.05)])
    return fade(x * np.minimum(t / 0.002, 1), 0.0, 0.05)
def glass(d=0.5):
    t = tt(d); x = band(noise(d), 3500, 12000) * np.exp(-t / 0.03) * 1.2
    for k in range(9):
        t0 = rng.uniform(0, 0.22); f = rng.uniform(2800, 7500); n0 = int(t0 * SR); seg = tt(d - t0)
        x[n0:n0 + len(seg)] += np.sin(2 * np.pi * f * seg) * np.exp(-seg / rng.uniform(0.02, 0.08)) * rng.uniform(0.15, 0.4)
    return fade(x, 0.0005, 0.05)
def thunder(d=2.2):
    t = tt(d); x = band(noise(d), 30, 260) * (np.exp(-t / 0.7) + 0.5 * np.exp(-((t - 0.5) / 0.25) ** 2)) * 1.6
    crack = band(noise(d), 400, 5000) * np.exp(-t / 0.05) * 0.9 + band(noise(d), 200, 2500) * np.exp(-np.abs(t - 0.16) / 0.06) * 0.5
    return fade(np.tanh((x + crack) * 1.5), 0.002, 0.3)
def slam(d=1.0):
    t = tt(d); body = np.sin(2 * np.pi * np.cumsum(70 * (1 + 2.5 * np.exp(-t / 0.012))) / SR) * np.exp(-t / 0.13)
    wood = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / dc) * a for f, a, dc in [(212, 0.5, 0.06), (347, 0.35, 0.04), (538, 0.25, 0.03)])
    crack = band(noise(d), 300, 6000) * np.exp(-t / 0.018) * 1.3
    rattle = band(noise(d), 1200, 4500) * np.exp(-t / 0.2) * 0.25 * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 43 * t))) * (t > 0.04)
    return fade(np.tanh((body * 1.4 + wood + crack) * 1.4) + rattle, 0.0005, 0.1)
def scratch(d=0.3):
    t = tt(d); u = t / d
    speed = np.where(u < 0.45, 1.6 - 2.6 * u / 0.45, -1.0 + 2.4 * (u - 0.45) / 0.55)      # platter direction back/forth
    ph = np.cumsum(np.abs(speed) * 1900 + 250) / SR * 2 * np.pi
    x = (np.sign(np.sin(ph)) * 0.5 + np.sin(ph * 0.5)) * (0.25 + np.abs(speed)); x = band(x + noise(d) * 0.5 * np.abs(speed), 350, 6500)
    return fade(x * (0.35 + 0.65 * np.abs(np.sin(np.pi * u * 2))), 0.004, 0.02)
def drone(d):
    t = tt(d); x = np.zeros(len(t))
    for f, a in [(41.2, 1.0), (43.6, 0.8), (61.7, 0.5), (87.3, 0.35), (58.3, 0.5), (123.5, 0.18), (130.8, 0.14)]:
        ph = 2 * np.pi * f * t + rng.uniform(0, 6.28); x += a * np.tanh(2.5 * np.sin(ph + 0.4 * np.sin(2 * np.pi * 0.7 * t)))
    air = band(noise(d), 1800, 6000) * 0.08 * (1 + np.sin(2 * np.pi * 5.3 * t)) + band(noise(d), 90, 400) * 0.5
    swell = np.minimum(t / 0.5, 1) ** 1.5 * (1 + 0.25 * np.sin(2 * np.pi * 1.61 * t)) * (0.6 + 0.4 * t / d)
    return fade((band(x, 30, 900) + air) * swell, 0.02, 0.06)
def whimper(d=0.85):
    t = tt(d); u = t / d; f = 1250 + 260 * np.sin(np.pi * u) + 55 * np.sin(2 * np.pi * 15 * t); ph = 2 * np.pi * np.cumsum(f) / SR
    return fade((np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)) * np.sin(np.pi * u) ** 0.7 * (0.6 + 0.4 * np.sin(2 * np.pi * 15 * t)), 0.03, 0.08)
def buzz(d=0.3):
    t = tt(d); x = np.tanh(3 * np.sin(2 * np.pi * 172 * t)) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 86 * t))) + 0.2 * band(noise(d), 900, 3000)
    return fade(band(x, 120, 2600), 0.01, 0.03)

# =============================================================== timeline
RF = 2.6; per = 1 / RF
# 1) opening: bed creaks on every rock + panicked breathing (through the reveal, fading as he freezes)
k = 0; t = 0.0
while t < 5.75:
    amp = 1.0 if t < 4.3 else max(0.0, 1 - (t - 4.3) / 1.45) * 0.8
    place(creak(True, 0.17), t + 0.02, 0.26 * amp, -0.15); place(creak(False, 0.15), t + per * 0.52, 0.2 * amp, 0.15)
    place(thump(70, 0.16, 0.5), t + 0.03, 0.12 * amp)
    place(breath(False, per * 0.55), t + 0.0, 0.3 * amp, 0.05); place(breath(True, per * 0.42), t + per * 0.56, 0.2 * amp, -0.05)
    t += per; k += 1
# reveal whoosh (camera pull-up + swing)
place(whoosh(0.9, 180, 3500, True), T['S2'] - 0.05, 0.3, 0.0)
# 2) typing taps
for i, kt in enumerate(key_times()): place(tick(1900 + rng.uniform(-250, 350)), kt, 0.42, rng.uniform(-0.4, 0.4))
# 3) send whoosh + whip + FAMILY zoom + heartbeats
place(tick(2500, 0.04), T['SEND'] - 0.03, 0.5); place(whoosh(0.4, 500, 7500, True), T['SEND'], 0.55, 0.0); place(pop(700, 1500, 0.1), T['SEND'] + 0.28, 0.25)
place(whoosh(0.42, 250, 4500, True), T['WHIP'] - 0.02, 0.5, 0.0)
place(impact(0.8), T['FAMILY'] + 0.1, 0.5)
for b, g in [(T['BEAT1'], 0.85), (T['BEAT2'], 0.9), (T['BEAT3'], 0.9)]: place(thump(56, 0.4, 0.3), b, g)
place(thump(50, 0.4, 0.2), T['BEAT1'] + 0.19, 0.6); place(heartbeat(), 11.25, 0.5)
# 4) punch-in cuts: riser into hit
for i, c in enumerate([T['S5'], T['P2'], T['P3'], T['P4']]):
    place(whoosh(0.22, 300, 3000 + i * 800, True), c - 0.2, 0.22 + 0.05 * i); place(impact(0.6), c, 0.42 + 0.1 * i); place(heartbeat(), c + 0.42, 0.28)
# 5) delete attempt: frantic vibrating tapping + missed taps
t = T['S6'] + 0.05
while t < T['DOG']:
    place(tick(2300 + rng.uniform(-300, 300), 0.02), t, 0.16 + 0.1 * min(1, max(0, (t - 17.3) / 0.6)), 0.3); t += 1 / 15 + rng.uniform(-0.006, 0.006)
for tp in T['TAPS']: place(tick(1500, 0.05), tp, 0.6, 0.2); place(thump(120, 0.1, 0.6), tp, 0.2)
# chihuahua cutaway: shivery whimper + tiny collar jingle
place(whoosh(0.16, 600, 5000, True), T['DOG'] - 0.12, 0.22); place(whimper(0.85), T['DOG'] + 0.05, 0.16, 0.0)
t = T['DOG']
while t < T['S6C']: place(bell(3100 + rng.uniform(-200, 200), 0.08, 0.6), t, 0.05, rng.uniform(-0.3, 0.3)); t += 1 / 15
t = T['S6C']
while t < T['S7'] - 0.05: place(tick(2300 + rng.uniform(-300, 300), 0.02), t, 0.22, 0.3); t += 1 / 15
place(tick(1500, 0.05), T['PIN'], 0.7, 0.2); place(bell(1320, 0.3), T['PIN'] + 0.05, 0.16); place(bell(990, 0.35), T['PIN'] + 0.14, 0.14)
# 6) seen pops (rising pitch), glasses crack
for (tm, f0), pan in zip([(T['SEEN_DAD'], 380), (T['SEEN_UNCLE'], 450), (T['SEEN_GRANDMA'], 540)], [-0.35, 0.0, 0.35]):
    place(pop(f0, f0 * 2.7), tm, 0.75, pan); place(bloop(f0 * 1.5, f0 * 1.1, 0.16), tm + 0.14, 0.2, pan)
place(glass(0.5), T['SEEN_GRANDMA'] + 0.24, 0.45, 0.3); place(tick(3200, 0.03), T['SEEN_GRANDMA'] + 0.36, 0.3, 0.3)
# 7) typing bubbles + thunder
for tm, base in [(T['MOM_TYPING'], 420), (T['DAD_TYPING'], 250)]:
    place(bloop(base, base * 1.9), tm - 0.02, 0.6)
    for j in range(6): place(bloop(base * 2.2, base * 2.6, 0.07), tm + 0.22 + j * 0.14, 0.11 * (0.85 ** j))
place(impact(0.7), T['DAD_TYPING'], 0.4); place(reverb(np.concatenate([thunder(2.2), np.zeros(SR // 2)]), 0.2), T['THUNDER'] - 0.02, 0.6)
# 8) grandma leaves: swipe, huffy footsteps, door slam, sign clatter
place(whoosh(0.25, 500, 6000, False), T['LEFT'], 0.3, -0.2); place(bloop(520, 300, 0.2), T['LEFT'] + 0.2, 0.35)
for j in range(4): place(thump(160, 0.08, 0.8), T['S10B'] + 0.03 + j * 0.105, 0.22, -0.3 + j * 0.1)
place(whoosh(0.14, 300, 2500, True), T['SLAM'] - 0.14, 0.35); place(reverb(np.concatenate([slam(1.0), np.zeros(SR // 3)]), 0.3), T['SLAM'], 0.95)
place(creak(False, 0.2), T['SLAM'] + 0.2, 0.2, -0.2); place(tick(900, 0.05), T['SLAM'] + 0.42, 0.3, -0.2)
# 9) mom replies: message ding + soft romantic sparkle, then awkward silence
place(bell(1568, 0.5), T['MOM_REPLY'], 0.3); place(bell(2093, 0.7), T['MOM_REPLY'] + 0.09, 0.3)
for j, f in enumerate([2093, 2637, 3136, 3951, 4186, 5274, 6272, 4186, 5274]):
    place(bell(f, 0.7, 0.5), T['MOM_REPLY'] + 0.45 + j * 0.12 + rng.uniform(-0.02, 0.02), 0.075 * (0.93 ** j), rng.uniform(-0.6, 0.6))
for j, f in enumerate([2637, 3136, 3951, 5274]): place(bell(f, 0.8, 0.4), T['S11B'] + 0.1 + j * 0.16, 0.06, rng.uniform(-0.5, 0.5))
place(bloop(700, 420, 0.12), 31.5, 0.12); place(bloop(420, 620, 0.12), 31.95, 0.12)        # blink... blink
# 10) dad types again: horror drone + heartbeat, cut hard by the record scratch
dr = drone(T['SCRATCH'] - T['S12'] + 0.04); place(reverb(dr, 0.15), T['S12'] - 0.02, 0.5)
place(bloop(190, 120, 0.3), T['DAD_AGAIN'] - 0.02, 0.6); place(impact(0.8), T['S12'], 0.5)
t = T['DAD_AGAIN'] + 0.05
while t < T['SCRATCH'] - 0.3: place(heartbeat(), t, 0.7); t += 0.62
place(whoosh(0.5, 200, 2500, True), T['SCRATCH'] - 0.5, 0.25)
# 11) record scratch -> "Genius." happy chime + phone buzz
place(scratch(0.3), T['SCRATCH'], 0.75)
for j, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0]): place(bell(f, 0.75, 0.8), T['GENIUS'] - 0.02 + j * 0.065, 0.3, -0.3 + 0.2 * j)
place(bell(2637, 0.6, 0.5), T['GENIUS'] + 0.3, 0.16, 0.3)
place(buzz(0.26), T['S13'] + 0.08, 0.13, -0.4); place(buzz(0.26), T['S13'] + 0.47, 0.11, -0.4); place(buzz(0.2), T['S13'] + 0.84, 0.09, -0.4)
# 12) quiet night room tone (not ducked)
tone = band(noise(DUR), 60, 900) * 0.012 + band(noise(DUR), 2000, 7000) * 0.0025
place(fade(tone[:N], 0.3, 0.2), 0, 1.0, target=bus_nd)

# =============================================================== voice + ducking + master
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(ROOT, 'assets/voiceover.mp3'), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
vo = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]
vo = vo / (np.max(np.abs(vo)) + 1e-9) * 0.89
# envelope follower -> duck sfx up to -9 dB while he speaks
hop = 240; e = np.sqrt(np.convolve(vo ** 2, np.ones(hop * 4) / (hop * 4), mode='same')); e = e / (np.percentile(e, 95) + 1e-9)
g = np.clip(e * 1.6, 0, 1); sm = np.zeros(N); v = 0.0
ge = g[::hop]; out = np.zeros(len(ge))
for i, x in enumerate(ge): v = x if x > v else v * 0.93 + x * 0.07; out[i] = v
duck = 1 - 0.62 * np.interp(np.arange(N), np.arange(len(out)) * hop, out)
mix = bus * duck[:, None] * 0.9 + bus_nd
mix[:, 0] += vo; mix[:, 1] += vo
mix = np.tanh(mix * 1.05) / np.tanh(1.05) * 0.97       # gentle soft clip / limiter
fo = np.ones(N); nf = int(0.03 * SR); fo[-nf:] = np.linspace(1, 0, nf); mix *= fo[:, None]
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2').tobytes()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', os.path.join(ROOT, 'out/mix.wav')], input=pcm, check=True)
if '--stems' in sys.argv:
    pcm = (np.clip(bus * 0.9, -1, 1) * 32767).astype('<i2').tobytes(); subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', os.path.join(ROOT, 'out/sfx_only.wav')], input=pcm, check=True)
print('wrote out/mix.wav', N / SR, 's  peak', float(np.max(np.abs(mix))), ' sfx peak', float(np.max(np.abs(bus))))
