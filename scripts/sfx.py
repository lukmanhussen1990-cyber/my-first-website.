"""Sound design for NIGHT SHIFT, synthesized in code (numpy/scipy), placed on the
same timeline the renderer uses (src/timeline.json). No music anywhere.

Writes audio/mix/sfx.wav (48 kHz stereo). The mixer ducks it under the voice.
"""
import json
import math
import os
import sys

import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SR = 48000
rng = np.random.default_rng(1337)

T = json.load(open(os.path.join(ROOT, 'src/timeline.json')))
C = T['cues']
DUR = T['duration'] + 0.5
N = int(DUR * SR)
SC = {s['id']: s for s in T['scenes']}


# ---------------- dsp helpers ----------------
def filt(x, kind, f, order=2):
    sos = butter(order, f, kind, fs=SR, output='sos')
    return sosfilt(sos, x, axis=0)


def lp(x, f, o=2):
    return filt(x, 'lowpass', f, o)


def hp(x, f, o=2):
    return filt(x, 'highpass', f, o)


def bp(x, lo, hi, o=2):
    return filt(x, 'bandpass', [lo, hi], o)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env_exp(dur, tau):
    return np.exp(-t_axis(dur) / tau)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-12
    return x * (peak / m)


def stereo(x, pan=0.0):
    """constant-power pan, pan in [-1, 1]"""
    a = (pan + 1) * math.pi / 4
    return np.stack([x * math.cos(a), x * math.sin(a)], axis=1)


def reverb_ir(dur, decay, bright=5000, seed=0, predelay=0.0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal((n, 2)) * np.exp(-t / decay)[:, None]
    ir = lp(ir, bright)
    ir[: int(predelay * SR)] = 0
    ir[0] = [1.0, 1.0]
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


ROOM = reverb_ir(0.9, 0.18, 6000, seed=1, predelay=0.006)      # tiled restaurant
STREET = reverb_ir(1.6, 0.45, 3500, seed=2, predelay=0.03)     # outdoor slap


def verb(st, ir, wet=0.3):
    out = np.stack([fftconvolve(st[:, k], ir[:, k])[: len(st)] for k in range(2)], axis=1)
    return st * (1 - wet) + out * wet


bed = np.zeros((N, 2))


def place(sig, t, gain=1.0):
    """add a stereo (n,2) or mono signal at time t (seconds)"""
    if sig.ndim == 1:
        sig = stereo(sig)
    i = int(round(t * SR))
    if i >= N:
        return
    j = min(N, i + len(sig))
    if i < 0:
        sig = sig[-i:]
        i = 0
    bed[i:j] += sig[: j - i] * gain


def curve(points, n=N):
    """piecewise-linear gain automation from [(t, g), ...]"""
    ts = np.array([p[0] for p in points])
    gs = np.array([p[1] for p in points])
    return np.interp(np.arange(n) / SR, ts, gs)


# ---------------- beds ----------------
def fluorescent(dur):
    t = t_axis(dur)
    x = np.zeros_like(t)
    for k, a in [(1, 0.25), (2, 1.0), (3, 0.35), (4, 0.6), (6, 0.35), (8, 0.22), (10, 0.12), (12, 0.08)]:
        x += a * np.sin(2 * np.pi * 60 * k * t + rng.uniform(0, 6.28))
    sizzle = hp(rng.standard_normal(len(t)), 3500) * (0.5 + 0.5 * np.sin(2 * np.pi * 120 * t)) ** 4
    x = 0.8 * x / 3 + 0.25 * sizzle
    x *= 1 + 0.08 * np.sin(2 * np.pi * 0.37 * t)
    return np.tanh(x * 1.2)


def fridge_hum(dur):
    t = t_axis(dur)
    x = 0.8 * np.sin(2 * np.pi * 50 * t) + 0.45 * np.sin(2 * np.pi * 100 * t + 1) + 0.2 * np.sin(2 * np.pi * 150 * t)
    x += 0.6 * lp(rng.standard_normal(len(t)), 180)
    x *= 1 + 0.15 * np.sin(2 * np.pi * 0.21 * t)
    return x


def fryer(dur):
    n = int(dur * SR)
    x = 0.25 * bp(rng.standard_normal(n), 2500, 7000) * (1 + 0.3 * np.sin(np.arange(n) / SR * 3))
    for _ in range(int(dur * 22)):
        tt = rng.uniform(0, dur - 0.05)
        f0 = rng.uniform(350, 900)
        d = rng.uniform(0.012, 0.035)
        tb = t_axis(d)
        pop = np.sin(2 * np.pi * (f0 * tb + 9000 * tb ** 2)) * np.exp(-tb / (d / 3))
        i = int(tt * SR)
        x[i:i + len(pop)] += pop * rng.uniform(0.2, 0.7)
    return x


def drone(dur):
    t = t_axis(dur)
    x = np.zeros_like(t)
    for f, a in [(41.2, 1.0), (41.55, 0.9), (61.7, 0.55), (82.4, 0.35), (87.3, 0.18)]:
        x += a * np.sin(2 * np.pi * f * t + 2 * np.sin(2 * np.pi * 0.05 * t + f))
    x = np.tanh(x * 0.7)
    # eerie high layer: resonant noise slowly sweeping
    air = rng.standard_normal(len(t))
    sweep = np.zeros_like(t)
    for k, (lo, hi) in enumerate([(700, 760), (1180, 1240), (1630, 1700)]):
        band = bp(air, lo, hi, 2)
        sweep += band * (0.5 + 0.5 * np.sin(2 * np.pi * (0.07 + 0.03 * k) * t + k))
    x = 0.85 * x + 1.4 * sweep
    return x


def city(dur):
    return lp(rng.standard_normal(int(dur * SR)), 220) * 0.6 + lp(rng.standard_normal(int(dur * SR)), 900) * 0.1


# ---------------- one-shots ----------------
def heel_click():
    d = 0.09
    tb = t_axis(d)
    burst = bp(rng.standard_normal(len(tb)), 1400, 6500) * np.exp(-tb / 0.004)
    body = np.sin(2 * np.pi * rng.uniform(820, 980) * tb) * np.exp(-tb / 0.018)
    return norm(burst * 0.8 + body * 0.5)


def ring_tap():
    d = 0.35
    tb = t_axis(d)
    x = np.zeros_like(tb)
    for f, a, tau in [(2210, 1.0, 0.06), (3870, 0.7, 0.045), (6120, 0.45, 0.03), (8350, 0.35, 0.02), (11800, 0.2, 0.012)]:
        x += a * np.sin(2 * np.pi * f * rng.uniform(0.98, 1.02) * tb) * np.exp(-tb / tau)
    knock = lp(rng.standard_normal(len(tb)), 600) * np.exp(-tb / 0.01)
    return norm(x * 0.8 + knock * 0.6)


def mop_squeak(length=0.16):
    tb = t_axis(length)
    f = rng.uniform(950, 1350) * (1 + 0.12 * np.sin(2 * np.pi * rng.uniform(25, 40) * tb)) * (1 + 0.25 * tb / length)
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = np.sign(np.sin(ph)) * 0.4 + np.sin(ph) + 0.3 * np.sin(2 * ph)
    e = np.sin(np.pi * tb / length) ** 0.6
    return norm(bp(saw * e, 700, 5000))


def swish(length):
    tb = t_axis(length)
    return norm(bp(rng.standard_normal(len(tb)), 300, 2200) * np.sin(np.pi * tb / length) ** 1.5)


def metal_impact(scale=1.0):
    d = 0.5
    tb = t_axis(d)
    x = np.zeros_like(tb)
    for f, a, tau in [(480, 1.0, 0.12), (1320, 0.6, 0.08), (2610, 0.45, 0.05), (4130, 0.3, 0.03)]:
        x += a * np.sin(2 * np.pi * f * scale * tb) * np.exp(-tb / tau)
    thud = lp(rng.standard_normal(len(tb)), 900) * np.exp(-tb / 0.015)
    return norm(x * 0.7 + thud)


def step(sneaker=True):
    d = 0.18
    tb = t_axis(d)
    thump = np.sin(2 * np.pi * 95 * tb) * np.exp(-tb / 0.03)
    tap = bp(rng.standard_normal(len(tb)), 900, 4500) * np.exp(-tb / 0.008)
    sq = mop_squeak(0.05) * 0.25 if sneaker and rng.uniform() < 0.5 else np.zeros(1)
    out = thump * 1.0 + tap * 0.6
    out[: len(sq)] += sq[: len(out)]
    return norm(out)


def clink():
    d = 0.12
    tb = t_axis(d)
    x = np.zeros_like(tb)
    for _ in range(4):
        x += np.sin(2 * np.pi * rng.uniform(2500, 9500) * tb) * np.exp(-tb / rng.uniform(0.01, 0.04))
    return norm(x)


def jingle(length=0.7, density=26):
    x = np.zeros(int((length + 0.15) * SR))
    for _ in range(int(length * density)):
        i = int(rng.uniform(0, length) * SR)
        c = clink() * rng.uniform(0.2, 1.0)
        x[i:i + len(c)] += c[: len(x) - i]
    return norm(x)


def key_insert():
    d = 0.28
    tb = t_axis(d)
    scrape = bp(rng.standard_normal(len(tb)), 2000, 7000) * 0.3 * np.sin(np.pi * tb / d)
    for k in range(5):
        i = int((0.03 + k * 0.045) * SR)
        c = clink() * 0.5
        scrape[i:i + len(c)] += c[: len(scrape) - i]
    return norm(scrape)


def lock_click():
    d = 0.4
    tb = t_axis(d)
    x = np.zeros_like(tb)
    for t0, a in [(0.0, 0.7), (0.045, 1.0)]:
        i = int(t0 * SR)
        tt = tb[: len(tb) - i]
        hit = bp(rng.standard_normal(len(tt)), 1500, 8000) * np.exp(-tt / 0.004) + np.sin(2 * np.pi * 210 * tt) * np.exp(-tt / 0.03) * 0.8
        hit += np.sin(2 * np.pi * 3100 * tt) * np.exp(-tt / 0.05) * 0.3
        x[i:] += hit * a
    return norm(x)


def phone_beep():
    out = []
    for f in (1180, 1560):
        tb = t_axis(0.085)
        e = np.minimum(1, tb / 0.005) * np.minimum(1, (0.085 - tb) / 0.01)
        out.append(np.sin(2 * np.pi * f * tb) * e)
        out.append(np.zeros(int(0.03 * SR)))
    return norm(np.concatenate(out))


def bass_hit():
    d = 3.0
    tb = t_axis(d)
    f = 34 + 70 * np.exp(-tb / 0.12)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sub = np.sin(ph) * np.exp(-tb / 0.9)
    crack = lp(rng.standard_normal(len(tb)), 1800) * np.exp(-tb / 0.03)
    boom = lp(rng.standard_normal(len(tb)), 250) * np.exp(-tb / 0.25)
    metal = np.zeros_like(tb)
    for fr in (233, 311, 467, 589):
        metal += np.sin(2 * np.pi * fr * tb) * np.exp(-tb / 0.6) * 0.15
    x = np.tanh(1.6 * (sub * 1.0 + crack * 0.5 + boom * 0.6 + metal))
    return verb(stereo(x), STREET, 0.25)


def riser(length=0.45):
    tb = t_axis(length)
    x = bp(rng.standard_normal(len(tb)), 600, 6000) * (tb / length) ** 3
    return norm(x)


def heartbeat_one():
    d = 0.55
    tb = t_axis(d)
    x = np.zeros_like(tb)
    for t0, f, a in [(0.0, 58, 1.0), (0.26, 47, 0.75)]:
        i = int(t0 * SR)
        tt = tb[: len(tb) - i]
        fr = f * (1 + 0.6 * np.exp(-tt / 0.02))
        beat = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt / 0.07) * np.minimum(1, tt / 0.004)
        x[i:] += beat * a
    return norm(lp(x, 180))


def breath(length=0.9):
    tb = t_axis(length)
    e = np.sin(np.pi * tb / length) ** 2
    return norm(bp(rng.standard_normal(len(tb)), 400, 3200) * e)


def crackle(length):
    n = int(length * SR)
    x = np.zeros(n)
    for _ in range(int(length * 60)):
        i = int(rng.uniform(0, length - 0.01) * SR)
        b = bp(rng.standard_normal(int(0.006 * SR)), 1500, 9000)
        x[i:i + len(b)] += b * rng.uniform(0.2, 1)
    tb = t_axis(length)
    x += 0.4 * np.sin(2 * np.pi * 120 * tb) * (np.sin(2 * np.pi * 7 * tb) > 0)
    return norm(x)


def hash1(n):
    x = math.sin(n * 127.1 + 311.7) * 43758.5453123
    return x - math.floor(x)


# ================= build the bed =================
s = SC
silence_a = C['s10_silence']
silence_b = C['s10_narrator'] - 0.05

# --- fluorescent buzz (room tone), follows the scenes; stutters with the flicker
buzz = fluorescent(DUR)
g = curve([(0, 0.11), (s[2]['start'], 0.08), (s[3]['start'], 0.03), (s[4]['start'], 0.07), (s[5]['start'], 0.08),
           (s[7]['start'], 0.1), (s[8]['start'], 0.04), (s[9]['start'], 0.07), (s[10]['start'], 0.08), (s[11]['start'], 0.07), (DUR, 0.07)])
fl = np.ones(N)
for k in range(int(1.25 * 15) + 1):
    t0 = C['s7_flicker'] + k / 15
    if hash1(math.floor(t0 * 15)) < 0.55:
        fl[int(t0 * SR): int((t0 + 1 / 15) * SR)] = 0.08
fl = lp(fl, 60)
bed += stereo(buzz * g * fl, 0.0)
place(crackle(1.25) * 0.18, C['s7_flicker'])

# --- fridge hum (kitchen scenes), close and loud by the fridge
hum = fridge_hum(DUR)
g = curve([(0, 0.0), (s[7]['start'], 0.0), (s[7]['start'] + 0.01, 0.045), (s[8]['start'], 0.035), (s[9]['start'], 0.04), (s[10]['start'], 0.07), (DUR, 0.045)])
bed += stereo(hum * g, -0.2)

# --- fryer bubbling (soft, kitchen side)
fr = fryer(DUR)
g = curve([(0, 0.035), (s[2]['start'], 0.02), (s[3]['start'], 0.0), (s[7]['start'], 0.0), (s[7]['start'] + 0.01, 0.035), (s[8]['start'], 0.02), (s[9]['start'], 0.02), (s[10]['start'], 0.015), (DUR, 0.015)])
bed += stereo(fr * g, 0.35)

# --- night outside, through the glass (scenes 2-4, 6)
ct = city(DUR)
g = curve([(0, 0.0), (s[2]['start'], 0.02), (s[5]['start'], 0.02), (s[6]['start'], 0.03), (s[7]['start'], 0.0), (DUR, 0.0)])
bed += stereo(ct * g, 0.0)

# --- horror drone: fades in from scene 3, builds to the fridge, returns softly under the choice
dr = drone(DUR)
g = curve([(0, 0), (s[3]['start'], 0.0), (s[3]['start'] + 3.0, 0.05), (s[4]['start'], 0.06), (s[6]['start'], 0.07),
           (s[7]['start'], 0.06), (s[8]['start'], 0.045), (s[9]['start'], 0.055), (s[10]['start'], 0.07), (silence_a - 0.02, 0.11), (s[11]['start'], 0.045), (DUR, 0.04)])
bed += np.stack([dr * g, np.roll(dr, 2400) * g], axis=1)

# --- scene 1: mop strokes squeak on the wet tiles
for k in range(30):
    tt = (math.pi / 2 + k * math.pi) / 2.4
    if tt > s[1]['end'] - 0.2:
        break
    place(verb(stereo(swish(0.55) * 0.05, 0.1), ROOM, 0.2), tt - 0.3)
    if k % 2 == 0 or rng.uniform() < 0.4:
        place(verb(stereo(mop_squeak(rng.uniform(0.12, 0.2)), 0.1), ROOM, 0.25), tt - 0.02, 0.06)

# --- her heels on the street, off-beat (only while she's outside and you can hear the silence)
for st in T['danceSteps']:
    t0 = st['t']
    if s[2]['start'] <= t0 < C['s4_lookUp']:
        gain = 0.05 if t0 < s[3]['start'] else 0.075
    elif C['s4_lookUp'] <= t0 < s[5]['start']:
        gain = 0.1
    else:
        continue
    click = verb(stereo(lp(heel_click(), 3200), -0.15), STREET, 0.45)
    place(click, t0, gain)

# --- scene 4: phone recording beep, the scare
place(stereo(phone_beep(), 0.1), C['s4_phoneFull'] + 0.05, 0.12)
place(stereo(riser(0.35), 0), C['s4_reveal'] - 0.35, 0.05)
place(bass_hit(), C['s4_reveal'], 0.55)

# --- scene 5: running steps, the mop clatters, keys, lock click
for k in range(5):
    place(verb(stereo(step(), 0.0), ROOM, 0.2), s[5]['start'] + 0.08 + k * 0.15, 0.22)
for k, (dt, a, sc) in enumerate([(0.45, 1.0, 1.0), (0.58, 0.55, 1.05), (0.68, 0.3, 0.97)]):
    place(verb(stereo(metal_impact(sc), -0.3), ROOM, 0.3), C['s5_drop'] + dt, 0.2 * a)
place(verb(stereo(jingle(C['s5_keyIn'] - C['s5_cutToLock']), 0.2), ROOM, 0.2), C['s5_cutToLock'] - 0.1, 0.16)
place(verb(stereo(key_insert(), 0.2), ROOM, 0.2), C['s5_keyIn'] - 0.05, 0.16)
place(verb(stereo(jingle(0.3, 18), 0.2), ROOM, 0.15), C['s5_keyTurn'], 0.07)
place(verb(stereo(lock_click(), 0.2), ROOM, 0.3), C['s5_lockClick'], 0.3)

# --- scene 6: she's at the glass: hit, rings tapping in rhythm, her breath on the glass
place(stereo(riser(0.3), 0), C['s6_reveal'] - 0.3, 0.05)
place(bass_hit(), C['s6_reveal'], 0.6)
for tp in T['glassTaps']:
    behind_counter = tp['t'] >= s[7]['start']
    tap = ring_tap()
    if behind_counter:
        tap = lp(tap, 2500)
    place(verb(stereo(tap, -0.25), ROOM, 0.25), tp['t'], 0.06 if behind_counter else 0.12)
for k in range(6):
    tb = s[6]['start'] + 0.5 + k * (2 * math.pi / 4.2)
    if tb < s[7]['start']:
        place(stereo(breath(0.8), -0.2), tb, 0.025)

# --- scene 7-10: heartbeat, rising
hb = C['s7_heartbeat']
while hb < silence_a - 0.2:
    bpm = 72 + 22 * max(0.0, (hb - C['s7_heartbeat']) / (silence_a - C['s7_heartbeat']))
    place(stereo(heartbeat_one(), 0.0), hb, 0.24)
    hb += 60.0 / bpm

# --- scene 10: reveal hit, then TOTAL silence before the whisper
place(stereo(riser(0.4), 0), C['s10_reveal'] - 0.4, 0.05)
place(bass_hit(), C['s10_reveal'], 0.65)
mute = np.ones(N)
a, b = int(silence_a * SR), int(silence_b * SR)
fade = int(0.04 * SR)
mute[a:b] = 0
mute[a - fade:a] = np.linspace(1, 0, fade)
mute[b:b + fade * 6] = np.linspace(0, 1, fade * 6)
bed *= mute[:, None]

# soft low swell when the choice card appears
place(stereo(lp(bass_hit()[:, 0], 120), 0), C['s11_card'], 0.18)

# --------------- write ---------------
bed = np.clip(bed, -1.0, 1.0)
out = os.path.join(ROOT, 'audio/mix')
os.makedirs(out, exist_ok=True)
import soundfile as sf  # noqa: E402

sf.write(os.path.join(out, 'sfx.wav'), bed.astype(np.float32), SR, subtype='PCM_24')
peak = 20 * np.log10(np.max(np.abs(bed)) + 1e-9)
print(f'sfx.wav: {DUR:.2f} s, peak {peak:.1f} dBFS, silence {silence_a:.2f}-{silence_b:.2f} s', file=sys.stderr)
