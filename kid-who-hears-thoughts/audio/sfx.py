"""Procedural sound effects placed at shot / bubble times:
pop (thought bubbles), whoosh (fast cuts), page flip, knocks, clock ticks, light clicks,
crowd cheer (layered filtered noise + claps), sparkle chime.
Usage: python3 audio/sfx.py  (needs story/timeline.json and story/events.json) -> audio/sfx.wav
"""
import json
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
STORY = os.path.join(HERE, '..', 'story')
SR = 44100
tl = json.load(open(os.path.join(STORY, 'timeline.json')))
events = json.load(open(os.path.join(STORY, 'events.json'))) if os.path.exists(os.path.join(STORY, 'events.json')) else []
DUR = tl['duration']
N = int(DUR * SR) + SR
out = np.zeros(N)
rng = np.random.default_rng(11)
start = {s['id']: s['start'] for s in tl['shots']}


def add(sig, t0, gain=1.0):
    i = int(t0 * SR)
    j = min(N, i + len(sig))
    if 0 <= i < N:
        out[i:j] += sig[: j - i] * gain


def tt(d):
    return np.arange(int(d * SR)) / SR


def lowpass(x, a):
    y = np.zeros_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += (v - acc) * a
        y[i] = acc
    return y


def pop():
    t = tt(0.12)
    f = 700 + 900 * np.exp(-t * 40)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 32) * 0.8


def whoosh(d=0.35):
    t = tt(d)
    n = rng.normal(0, 1, len(t))
    x = t / d
    k = 0.04 + 0.4 * x
    y = np.zeros_like(n)
    acc = 0.0
    for i in range(len(n)):
        acc += (n[i] - acc) * k[i]
        y[i] = acc
    return y * np.sin(np.pi * x) ** 1.5 * 1.6


def knock():
    t = tt(0.12)
    return (np.sin(2 * np.pi * 180 * t) * 0.8 + rng.normal(0, 0.3, len(t))) * np.exp(-t * 45)


def tick():
    t = tt(0.03)
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 260) * 0.6


def page_flip():
    t = tt(0.45)
    n = lowpass(rng.normal(0, 1, len(t)), 0.35)
    env = np.exp(-((t - 0.18) ** 2) / 0.006) + 0.4 * np.exp(-((t - 0.32) ** 2) / 0.002)
    return n * env * 1.4


def click():
    t = tt(0.05)
    return (rng.normal(0, 1, len(t)) * 0.5 + np.sin(2 * np.pi * 1600 * t)) * np.exp(-t * 120) * 0.5


def chime():
    t = tt(2.2)
    s = np.zeros_like(t)
    for i, f in enumerate([1568, 2093, 2637, 3136]):
        tt0 = t - i * 0.07
        m = tt0 > 0
        s[m] += np.sin(2 * np.pi * f * tt0[m]) * np.exp(-tt0[m] * 3.2) * (0.5 - i * 0.08)
    return s


def cheer(d=2.4):
    t = tt(d)
    env = np.minimum(1, t / 0.15) * np.minimum(1, (d - t) / 0.8)
    b1 = lowpass(rng.normal(0, 1, len(t)), 0.25)
    b2 = lowpass(b1, 0.25)
    voices = (b1 - b2) * (1 + 0.5 * np.sin(2 * np.pi * 3.1 * t) * np.sin(2 * np.pi * 0.7 * t))
    s = voices * env * 3.0
    for _ in range(int(d * 26)):
        c0 = rng.uniform(0, d - 0.05)
        ct = tt(0.04)
        n = rng.normal(0, 1, len(ct))
        clap = (n - lowpass(n, 0.6)) * np.exp(-ct * 110) * 0.5
        i = int(c0 * SR)
        s[i : i + len(clap)] += clap * env[min(i, len(env) - 1)]
    return s


def sting():
    t = tt(0.3)
    f = 520 + 380 * np.minimum(1, t * 12)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.6


# thought-bubble pops (from the shots themselves)
seen = set()
for e in events:
    key = round(e['t'], 2)
    if key in seen:
        continue
    seen.add(key)
    add(pop(), e['t'], 0.55)

# whooshes on fast/energetic cuts
for sid in ['hook_ecu', 'a1_ball2', 'a2_flood', 'a2_loud', 'a2_orbit', 'a3_heard', 'a4_ran', 'a4_run', 'a4_topdown', 'a4_bakery', 'a4_lamp', 'a4_doors', 'a5_surprise', 'end_pullup']:
    add(whoosh(), max(0, start[sid] - 0.15), 0.35)
add(whoosh(0.5), start['hook_cake'] + 0.25, 0.25)  # blowing the candles
for k in range(3):
    add(tick(), start['hook_clock'] + k * 0.5, 0.6)
add(sting(), start['hook_ecu'] + 0.5, 0.5)
add(sting(), start['a3_heard'] + 0.45, 0.4)
add(page_flip(), start['a4_calendar'] + 0.12, 0.8)
for sid, n in [('a4_mia', 3), ('a4_doors', 2), ('a5_door', 4)]:
    for k in range(n):
        add(knock(), start[sid] + 0.08 + k * 0.2, 0.8)
# lights switching on one by one
for k in range(0, 28):
    add(click(), 86.45 + k / 9, 0.35)
add(chime(), 86.45, 0.25)
add(cheer(2.6), start['a5_surprise'], 0.9)
add(cheer(1.4), start['a5_bigsmile2'], 0.6)
add(cheer(3.5), start['end_pullup'], 0.5)
add(chime(), start['a5_thanks'] + 0.05, 0.6)
add(chime(), 0.7, 0.3)

out /= np.max(np.abs(out)) + 1e-9
out *= 10 ** (-3 / 20)
with wave.open(os.path.join(HERE, 'sfx.wav'), 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((out[: int(DUR * SR)] * 32767).astype(np.int16).tobytes())
print('sfx.wav', len(events), 'bubble pops')
