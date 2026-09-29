#!/usr/bin/env python3
"""Synthesise the 25 add-on sounds (mono OGG Vorbis) and write sounds/sound_definitions.json into the resource pack."""
import json
import os

import numpy as np
import soundfile as sf
from scipy import signal

SR = 44100
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'NaturalDisasters_RP')
OUT = os.path.join(ROOT, 'sounds', 'nd')
rng = np.random.default_rng(20240921)


def tt(d):
    return np.arange(int(SR * d)) / SR


def noise(d):
    return rng.standard_normal(int(SR * d))


def _f(x, kind, fc, order=4):
    sos = signal.butter(order, fc, kind, fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def lp(x, f):
    return _f(x, 'low', min(f, SR / 2 - 100))


def hp(x, f):
    return _f(x, 'high', min(f, SR / 2 - 100))


def bp(x, lo, hi):
    return _f(x, 'band', [lo, min(hi, SR / 2 - 100)], 3)


def sweep(f0, f1, d, kind='exp'):
    t = tt(d)
    if kind == 'exp':
        f = f0 * (f1 / f0) ** (t / d)
    else:
        f = f0 + (f1 - f0) * (t / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def fade(x, a=0.01, b=0.05):
    n = len(x)
    ia, ib = max(1, int(SR * a)), max(1, int(SR * b))
    x = x.copy()
    x[:ia] *= np.linspace(0, 1, ia)
    x[-ib:] *= np.linspace(1, 0, ib)
    return x


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


def swell(d, p=1.0):
    return np.sin(np.pi * tt(d) / d) ** p


def bursts(d, n, decay, lo=300, hi=4000, t_max=None):
    x = np.zeros(int(SR * d))
    t_max = t_max or d * 0.8
    for _ in range(n):
        t0 = rng.uniform(0, t_max)
        i0 = int(t0 * SR)
        m = min(len(x) - i0, int(SR * decay * 6))
        if m <= 0:
            continue
        tail = np.exp(-np.arange(m) / SR / decay)
        x[i0:i0 + m] += bp(noise(m / SR), lo, hi)[:m] * tail * rng.uniform(0.4, 1.0)
    return x


# ---- the sounds --------------------------------------------------------------------------------------------------
def tornado_loop():
    d = 4.0; t = tt(d)
    x = lp(noise(d), 500) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.5 * t))
    x += bp(noise(d), 300, 900) * 0.5 * (0.5 + 0.5 * np.sin(2 * np.pi * 1.7 * t + 1))
    x += 0.3 * np.sin(2 * np.pi * 55 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 3 * t))
    return fade(norm(x, 0.8), 0.4, 0.4)


def tornado_siren():
    d = 4.0; t = tt(d)
    f = 620 + 240 * np.sin(2 * np.pi * 0.25 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)
    return fade(norm(x, 0.6), 0.1, 0.3)


def wind_gust():
    d = 2.5
    x = bp(noise(d), 200, 1400) * swell(d, 1.5)
    return fade(norm(x, 0.8), 0.05, 0.2)


def wind_howl():
    d = 3.0; t = tt(d)
    x = bp(noise(d), 500, 1100) * 0.7
    for c, ph in ((620, 0.0), (910, 1.7)):
        f = c * (1 + 0.08 * np.sin(2 * np.pi * 0.4 * t + ph))
        x += 0.25 * np.sin(2 * np.pi * np.cumsum(f) / SR)
    x *= swell(d, 0.8)
    return fade(norm(x, 0.7), 0.1, 0.3)


def blizzard_wind():
    d = 4.0; t = tt(d)
    x = hp(noise(d), 500) * 0.5 + bp(noise(d), 250, 700) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.35 * t))
    f = 700 * (1 + 0.1 * np.sin(2 * np.pi * 0.3 * t))
    x += 0.2 * np.sin(2 * np.pi * np.cumsum(f) / SR)
    return fade(norm(x, 0.75), 0.4, 0.4)


def rumble_low():
    d = 3.0; t = tt(d)
    x = lp(noise(d), 90) * 4 + 0.6 * np.sin(2 * np.pi * 36 * t) * (0.7 + 0.3 * np.sin(2 * np.pi * 6 * t))
    x *= np.minimum(1, t / 0.3) * np.minimum(1, (d - t) / 0.8)
    return norm(x, 0.85)


def rumble_heavy():
    d = 3.5; t = tt(d)
    x = lp(noise(d), 140) * 4 + 0.7 * np.sin(2 * np.pi * 28 * t) + 0.5 * np.sin(2 * np.pi * 42 * t)
    x += bursts(d, 14, 0.05, 600, 2500) * 0.4
    x *= np.minimum(1, t / 0.25) * np.minimum(1, (d - t) / 0.9)
    return norm(x, 0.9)


def quake_crack():
    d = 1.2; t = tt(d)
    x = bp(noise(d), 200, 3000) * np.exp(-t / 0.08) * 1.4
    x += sweep(90, 35, d) * np.exp(-t / 0.25)
    x2 = np.roll(x, int(0.15 * SR)) * 0.6
    x2[:int(0.15 * SR)] = 0
    return fade(norm(x + x2, 0.9), 0.001, 0.1)


def debris_crash():
    d = 1.0
    x = bursts(d, 6, 0.06, 300, 4000, 0.5)
    return fade(norm(x, 0.85), 0.001, 0.1)


def wave_rush():
    d = 3.0
    x = bp(noise(d), 150, 2500) * swell(d, 1.5)
    return fade(norm(x, 0.8), 0.05, 0.3)


def wave_crash():
    d = 2.5; t = tt(d)
    x = lp(noise(d), 3000) * np.exp(-t / 0.5)
    x += hp(noise(d), 2000) * np.exp(-t / 1.0) * 0.3
    x += sweep(120, 50, d) * np.exp(-t / 0.35)
    return fade(norm(x, 0.9), 0.002, 0.2)


def volcano_rumble():
    d = 3.5; t = tt(d)
    x = lp(noise(d), 110) * 3 + 0.6 * np.sin(2 * np.pi * 30 * t) + bursts(d, 10, 0.03, 200, 1200) * 0.5
    x *= np.minimum(1, t / 0.3) * np.minimum(1, (d - t) / 0.9)
    return norm(x, 0.85)


def volcano_blast():
    d = 2.5; t = tt(d)
    x = sweep(110, 25, d) * np.exp(-t / 0.6) * 1.2 + lp(noise(d), 800) * np.exp(-t / 0.5) * 0.9 + lp(noise(d), 70) * 3 * np.exp(-t / 1.2)
    return fade(norm(x, 0.95), 0.002, 0.3)


def lava_pop():
    d = 0.6; t = tt(d)
    x = sweep(500, 140, d) * np.exp(-t / 0.08) + hp(noise(d), 2000) * np.exp(-t / 0.02) * 0.3
    return fade(norm(x, 0.8), 0.001, 0.05)


def meteor_whistle():
    d = 3.0; t = tt(d)
    x = sweep(500, 2200, d) + 0.3 * bp(noise(d), 800, 3000)
    x *= (t / d) ** 0.8
    return fade(norm(x, 0.7), 0.02, 0.05)


def meteor_impact():
    d = 3.5; t = tt(d)
    x = sweep(140, 28, d) * np.exp(-t / 0.9) * 1.2
    x += lp(noise(d), 1500) * np.exp(-t / 0.35) * 1.1
    x += lp(noise(d), 300) * np.exp(-t / 1.5) * 0.5
    x += noise(d) * np.exp(-t / 0.02) * 1.5
    return fade(norm(x, 0.95), 0.001, 0.3)


def shockwave():
    d = 2.0; t = tt(d)
    x = sweep(70, 22, d) * np.exp(-t / 0.5) * 1.2 + bp(noise(d), 40, 400) * np.exp(-t / 0.7) * 0.8
    return fade(norm(x, 0.9), 0.002, 0.2)


def fire_roar():
    d = 3.0; t = tt(d)
    x = lp(noise(d), 700) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.8 * t)) + bursts(d, 30, 0.01, 1500, 6000) * 0.4
    return fade(norm(x, 0.75), 0.3, 0.3)


def fire_crackle():
    d = 1.5
    x = bursts(d, 14, 0.012, 1200, 7000, d * 0.95)
    return fade(norm(x, 0.7), 0.001, 0.05)


def thunder_crack():
    d = 1.8; t = tt(d)
    x = noise(d) * np.exp(-t / 0.03) * 1.5 + lp(noise(d), 180) * np.exp(-t / 0.9) * (1 + 0.5 * np.sin(2 * np.pi * 7 * t)) + bp(noise(d), 300, 1200) * np.exp(-t / 0.25)
    return fade(norm(x, 0.95), 0.001, 0.2)


def thunder_roll():
    d = 4.0; t = tt(d)
    env = 0.2 + sum(np.exp(-((t - c) ** 2) / (2 * w * w)) for c, w in ((0.6, 0.3), (1.5, 0.4), (2.4, 0.5), (3.0, 0.3)))
    x = lp(noise(d), 160) * 4 * env
    return fade(norm(x, 0.85), 0.2, 0.6)


def sinkhole_collapse():
    d = 3.0; t = tt(d)
    x = sweep(80, 25, d) * np.exp(-t / 0.7) + bursts(d, 12, 0.15, 150, 900, 2.0) * 0.8 + lp(noise(d), 120) * 3 * np.exp(-t / 1.4)
    return fade(norm(x, 0.95), 0.002, 0.4)


def stone_grind():
    d = 2.0; t = tt(d)
    x = bp(noise(d), 200, 1800) * (0.5 + 0.5 * np.sin(2 * np.pi * 23 * t)) ** 1.5 * swell(d, 0.6)
    return fade(norm(x, 0.75), 0.1, 0.3)


def stop_chime():
    d = 1.5; t = tt(d)

    def bell(f, delay):
        y = np.zeros_like(t)
        s = int(delay * SR)
        tb = t[:len(t) - s]
        y[s:] = (np.sin(2 * np.pi * f * tb) + 0.4 * np.sin(2 * np.pi * f * 2.76 * tb)) * np.exp(-tb / 0.5)
        return y

    return fade(norm(bell(880, 0) + bell(1318.5, 0.12), 0.8), 0.002, 0.2)


def alarm_beep():
    d = 1.0; t = tt(d)
    y = np.zeros_like(t)
    for a, b in ((0.0, 0.18), (0.3, 0.48)):
        m = (t >= a) & (t < b)
        y[m] = np.sign(np.sin(2 * np.pi * 1000 * t[m])) * 0.5 + np.sin(2 * np.pi * 1000 * t[m]) * 0.5
        y[m] *= np.minimum(1, (t[m] - a) / 0.01) * np.minimum(1, (b - t[m]) / 0.02)
    return norm(y, 0.6)


# name -> (function, category, max_distance)
SOUNDS = {
    'tornado_loop': (tornado_loop, 'neutral', 128), 'tornado_siren': (tornado_siren, 'neutral', 160),
    'wind_gust': (wind_gust, 'neutral', 96), 'wind_howl': (wind_howl, 'neutral', 96),
    'blizzard_wind': (blizzard_wind, 'neutral', 96), 'rumble_low': (rumble_low, 'neutral', 128),
    'rumble_heavy': (rumble_heavy, 'neutral', 160), 'quake_crack': (quake_crack, 'neutral', 128),
    'debris_crash': (debris_crash, 'neutral', 64), 'wave_rush': (wave_rush, 'neutral', 128),
    'wave_crash': (wave_crash, 'neutral', 128), 'volcano_rumble': (volcano_rumble, 'neutral', 128),
    'volcano_blast': (volcano_blast, 'neutral', 160), 'lava_pop': (lava_pop, 'neutral', 48),
    'meteor_whistle': (meteor_whistle, 'neutral', 160), 'meteor_impact': (meteor_impact, 'neutral', 192),
    'shockwave': (shockwave, 'neutral', 160), 'fire_roar': (fire_roar, 'neutral', 96),
    'fire_crackle': (fire_crackle, 'neutral', 64), 'thunder_crack': (thunder_crack, 'neutral', 192),
    'thunder_roll': (thunder_roll, 'neutral', 192), 'sinkhole_collapse': (sinkhole_collapse, 'neutral', 128),
    'stone_grind': (stone_grind, 'neutral', 64), 'stop_chime': (stop_chime, 'neutral', 32),
    'alarm_beep': (alarm_beep, 'neutral', 48),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    defs = {}
    total = 0
    for name, (fn, cat, dist) in SOUNDS.items():
        data = fn().astype(np.float32)
        path = os.path.join(OUT, name + '.ogg')
        sf.write(path, data, SR, format='OGG', subtype='VORBIS')
        total += os.path.getsize(path)
        defs['nd.' + name] = {
            'category': cat,
            '__use_legacy_max_distance': 'true',
            'max_distance': float(dist),
            'min_distance': 0.0,
            'sounds': [{'name': 'sounds/nd/' + name, 'volume': 1.0, 'load_on_low_memory': True}],
        }
    with open(os.path.join(ROOT, 'sounds', 'sound_definitions.json'), 'w') as fh:
        json.dump({'format_version': '1.14.0', 'sound_definitions': defs}, fh, indent=2)
    print('wrote %d sounds, %.0f KB' % (len(SOUNDS), total / 1024))


if __name__ == '__main__':
    main()
