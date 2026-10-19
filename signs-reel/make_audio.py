#!/usr/bin/env python3
"""Soundtrack for "Signs before the Last Day", 100% synthesised with numpy (no samples).

Every sound is placed from build/cues.json, which reel.html exports from the same timeline
that draws the picture, so the audio lands exactly on its frame.

    python3 make_audio.py build/cues.json build/audio.wav

No music, no voice, no bells: only a drone bed, filtered noise and short synthetic hits.
"""
import json
import sys
import wave

import numpy as np

from audio_dsp import (SR, Bus, bp, convolve_fft, db, env_ad, env_bell, fade, fft_filter, from_points, hp,
                       integrated_lufs, limit, lp, reverb_ir, rms_db, secs, shaped_noise, stft_noise, true_peak_db)

DUR = 60.0
N = int(DUR * SR)
CUT = 55.0                       # "sudden silence" after the sun rises from the West
TARGET_LUFS, CEILING_DBTP = -14.0, -1.3
rng = np.random.default_rng(1447)

cues = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'build/cues.json'))
OUT = sys.argv[2] if len(sys.argv) > 2 else 'build/audio.wav'

bed, sfx, ticks, post = Bus(N), Bus(N), Bus(N), Bus(N)


def mixs(*parts):
    """Sum arrays of different lengths (zero-padded)."""
    out = np.zeros(max(len(p) for p in parts))
    for p in parts:
        out[:len(p)] += p
    return out


def norm(x, peak_db):
    return x / (np.max(np.abs(x)) + 1e-12) * db(peak_db)


def pan_x(x, amount=0.5):
    return float(np.clip((x - 540) / 540 * amount, -1, 1))


def sine_sweep(n, f0, f1, curve='exp'):
    t = np.linspace(0, 1, n)
    f = f0 * (f1 / f0) ** t if curve == 'exp' else f0 + (f1 - f0) * t
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def lfo_noise(n, rate_hz, seed_rng):
    pts = seed_rng.random(int(n / SR * rate_hz) + 3)
    return np.interp(np.arange(n) / SR * rate_hz, np.arange(len(pts)), pts)


def burst(n_ms, mag, attack=0.0004, decay=0.002):
    n = int(n_ms / 1000 * SR)
    return fft_filter(rng.standard_normal(n), mag) * env_ad(n, attack, decay)


def damped(freqs, decays, amps, n_ms):
    n = int(n_ms / 1000 * SR)
    t = secs(n)
    return sum(a * np.sin(2 * np.pi * f * t + rng.random() * 6.28) * np.exp(-t / d) for f, d, a in zip(freqs, decays, amps))


# ============================================================================ bed
def make_bed():
    t = secs(N)
    breath = 0.7 + 0.3 * np.sin(2 * np.pi * t / 7.5 - np.pi / 2)            # slow "breathing"
    breath *= 0.9 + 0.1 * np.sin(2 * np.pi * t / 23 + 1)

    def drone(det, ph):
        return (np.sin(2 * np.pi * 55 * (1 + det) * t + ph) + 0.55 * np.sin(2 * np.pi * 55 * (1 - det) * t + ph * 2)
                + 0.8 * np.sin(2 * np.pi * 82.41 * (1 - det) * t + ph + 1) + 0.4 * np.sin(2 * np.pi * 82.41 * (1 + det) * t)
                + 0.2 * np.sin(2 * np.pi * 110.0 * t + ph) + 0.11 * np.sin(2 * np.pi * 164.8 * t + ph * 3)
                + 0.05 * np.sin(2 * np.pi * 220.0 * t + 0.5))          # soft upper partials so phones hear it
    dl, dr = drone(0.0021, 0.0) * breath, drone(0.0018, 0.7) * breath
    k = db(-27) / np.sqrt(np.mean(dl ** 2))
    air_m = lambda f: bp(900, 1.4)(f) / np.sqrt(np.maximum(f, 30) / 100)  # pinkish, filtered "air"
    al, ar = shaped_noise(rng, N, air_m), shaped_noise(rng, N, air_m)
    gust = 0.65 + 0.35 * lfo_noise(N, 0.35, rng)
    ka = db(-42) / np.sqrt(np.mean(al ** 2))
    L, R = dl * k + al * ka * gust, dr * k + ar * ka * gust
    g = np.clip(t / 1.0, 0, 1) ** 2                                            # fade in 1 s
    return L * g, R * g


# ============================================================================ transitions + typing
def whoosh(dur=1.2, peak=0.55):
    n = int(dur * SR)

    def mag(tt, f):
        u = np.clip(tt / dur, 0, 1)
        fc = np.where(u < peak, 240 * (1900 / 240) ** (u / peak), 1900 * (480 / 1900) ** ((u - peak) / (1 - peak)))
        return np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / 0.85) ** 2)
    s = stft_noise(rng, n, mag) * env_bell(n, peak, 1.5)
    p = np.linspace(-0.45, 0.45, n)
    return (s * np.cos((p + 1) * np.pi / 4) * np.sqrt(2), s * np.sin((p + 1) * np.pi / 4) * np.sqrt(2))


def tick_sound():
    n = int(0.03 * SR)
    t = secs(n)
    r = rng.random()
    c = fft_filter(rng.standard_normal(n), bp(2600 + 1500 * r, 0.75)) * np.exp(-t / 0.0016)
    body = np.sin(2 * np.pi * (1600 + 500 * r) * t) * np.exp(-t / 0.005) * 0.3
    return fade(c / np.max(np.abs(c)) + body, 0.0003, 0.004)


# ============================================================================ scene effects
def title_swell(e):
    n = int(e['dur'] * SR); t = secs(n)
    tone = (np.sin(2 * np.pi * 41.2 * t) + 0.7 * np.sin(2 * np.pi * 61.74 * t + 0.5) + 0.5 * np.sin(2 * np.pi * 82.4 * t + 1)
            + 0.2 * np.sin(2 * np.pi * 123.5 * t) + 0.1 * np.sin(2 * np.pi * 164.8 * t))
    nz = shaped_noise(rng, n, lp(300, 2))
    s = (tone / np.max(np.abs(tone)) + 0.4 * nz / np.max(np.abs(nz))) * env_bell(n, 0.5, 1.6)
    sfx.add(e['t'], norm(s, -13))


def tower_rise(e):
    d, i = e['dur'], e['i']
    n = int((d + 0.7) * SR); t = secs(n)
    u = np.clip(t / d, 0, 1)
    env = np.where(t < d, np.sin(np.pi * u) ** 1.1, 0)
    rum = shaped_noise(rng, n, lp(110, 3)); rum /= np.max(np.abs(rum))
    sub = sine_sweep(n, 64, 40) * 0.8 + sine_sweep(n, 128, 80) * 0.25
    wh = stft_noise(rng, n, lambda tt, f: np.exp(-0.5 * (np.log2(np.maximum(f, 1) / (180 + 700 * np.clip(tt / d, 0, 1))) / 0.8) ** 2))
    s = np.tanh(1.6 * (0.9 * rum + 0.7 * sub)) + 0.6 * wh / np.max(np.abs(wh))
    sfx.add(e['t'], norm(s * env, -17.5 + 1.5 * i), pan_x(e['x'], 0.35))


def page_flutter(e):
    t0, off, amp = e['t'], 0.0, 1.0
    sfx.add(t0, norm(burst(90, bp(380, 0.7), 0.004, 0.03), -24))
    for k in range(11):
        sfx.add(t0 + off, norm(burst(28, bp(1900 + 400 * rng.random(), 1.1), 0.0015, 0.007), -18 - k * 0.9), rng.uniform(-0.3, 0.3))
        off += 0.052 - k * 0.0028


def grain_cloud(t0, n, density, peak_db, fc=9000, spread=0.6):
    """Glitter: many 2-6 ms grains of very high, band-limited noise (no pitched tones)."""
    s = (np.zeros(n), np.zeros(n))
    rate = density / SR
    times = np.nonzero(rng.random(n) < rate)[0]
    for i in times:
        g = burst(rng.uniform(2, 6), bp(fc * rng.uniform(0.75, 1.3), 0.35), 0.0003, rng.uniform(0.0008, 0.002))
        g *= rng.uniform(0.3, 1.0)
        p = rng.uniform(-spread, spread)
        j = min(n, i + len(g))
        s[0][i:j] += g[:j - i] * np.cos((p + 1) * np.pi / 4); s[1][i:j] += g[:j - i] * np.sin((p + 1) * np.pi / 4)
    m = max(np.max(np.abs(s[0])), np.max(np.abs(s[1]))) + 1e-12
    return (s[0] / m * db(peak_db), s[1] / m * db(peak_db))


def shimmer(e):
    n = int(4.6 * SR)
    env = from_points(n, 0, e['rate'], np.array(e['env']) / max(1e-6, max(e['env'])))
    base = shaped_noise(rng, n, bp(7500, 0.55)) * env
    gl, gr = grain_cloud(e['t'], n, 70 * env, -22.5)
    b = norm(base, -28.5)
    sfx.add(e['t'], (gl + b, gr + b))


def quake(e):
    n = int(5.2 * SR); t = secs(n)
    A = from_points(n, 0, e['rate'], e['env']) ** 1.2
    rum = shaped_noise(rng, n, lp(85, 3)); rum /= np.max(np.abs(rum))
    flutter = 0.6 + 0.4 * lfo_noise(n, 9, rng)
    subs = np.sin(2 * np.pi * 33 * t) + 0.7 * np.sin(2 * np.pi * 46.5 * t + 1)
    s = np.tanh(1.8 * (0.9 * rum + 0.5 * subs * flutter)) * A
    sfx.add(e['t'], norm(s, -15))
    rate = 34 * A ** 2 / SR                               # glass rattling on the table
    for i in np.nonzero(rng.random(n) < rate)[0]:
        f = rng.uniform(2800, 5200)
        g = mixs(damped([f, f * 1.37], [0.008, 0.005], [1, 0.5], 30), 3 * burst(12, bp(4200, 0.5), 0.0003, 0.002))
        sfx.add(e['t'] + i / SR, norm(g, -26.5 + rng.uniform(-4, 2)), rng.uniform(-0.15, 0.15))


def crack(e):
    if e.get('metal'):                                     # the gold lock snapping
        s = mixs(norm(burst(25, hp(800, 2), 0.0003, 0.006), 0), 0.7 * damped([1650, 2900, 4100], [0.025, 0.018, 0.012], [1, 0.7, 0.5], 120))
        for k in range(4):
            j = int((0.012 + 0.018 * k) * SR)
            s[j:j + 144] += norm(burst(3, hp(2000, 2)), -6 - 3 * k)[:len(s[j:j + 144])]
        sfx.add(e['t'], norm(s, -13))
        return
    d = e['dur']; n = int((d + 0.4) * SR); t = secs(n)       # the floor cracking, running left -> right
    s = np.zeros(n)
    s += norm(sine_sweep(n, 70, 42) * np.exp(-t / 0.18), -2)
    s += norm(fft_filter(rng.standard_normal(n), bp(320, 1)) * np.exp(-t / 0.04), -6)
    tear = stft_noise(rng, n, lambda tt, f: np.exp(-0.5 * (np.log2(np.maximum(f, 1) / (800 + 2400 * np.clip(tt / d, 0, 1))) / 0.6) ** 2))
    s += norm(tear * env_bell(n, 0.25, 1.2) * (t < d + 0.2), -10)
    offs = np.sort(rng.random(28) ** 1.6)                   # crackles: dense first, then sparse
    for k in range(28):
        j = int(offs[k] * d * SR)
        c = norm(burst(3, hp(1500, 2)), -3 - rng.uniform(0, 8))
        s[j:j + len(c)] += c[:len(s[j:j + len(c)])]
    p = np.clip(np.linspace(-0.6, 0.9, n), -0.6, 0.6)
    s = norm(s, -16)
    sfx.add(e['t'], (s * np.cos((p + 1) * np.pi / 4) * np.sqrt(2), s * np.sin((p + 1) * np.pi / 4) * np.sqrt(2)))


def watch(e):
    def tick1(scale=1.0):
        return (damped([3100, 4700], [0.005, 0.003], [1, 0.5], 25) + damped([1150], [0.012], [0.5], 25)
                + burst(25, bp(5200, 0.6), 0.0002, 0.0012) * 4) * scale
    for tt in e['ticks']:                                  # tick ... tick ... faster
        s = tick1()
        s2 = np.zeros(int(0.04 * SR)); s2[:len(s)] += s; j = int(0.009 * SR); s2[j:j + len(s)] += tick1(0.55)[:len(s2) - j]
        sfx.add(tt, norm(s2, -17))
    t0, stop = e['buzzFrom'], e['stop']                    # ...into a buzz, then it stops dead
    n = int((stop - t0) * SR); t = secs(n) + t0
    f = e['f0'] * np.exp(e['a'] * (t - e['t1']))
    fa = 165 * (1 - np.exp(-f / 165))
    ph = np.cumsum(fa) / SR
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    s = np.zeros(n + 2000)
    click = tick1(1.0)[:int(0.006 * SR)]
    for i in idx:
        s[i:i + len(click)] += click
    s = s[:n]
    hum = sum(np.sin(2 * np.pi * k * np.cumsum(fa) / SR) / k for k in range(1, 7))      # buzz body
    s = s / np.max(np.abs(s)) + 0.35 * hum / np.max(np.abs(hum)) * np.clip((fa - 50) / 90, 0, 1)
    s *= np.linspace(0.8, 1.1, n)
    sfx.add(t0, norm(fade(s, 0.002, 0.005), -15))


def sparkle(e):
    n = int((0.06 if e['small'] else 0.18) * SR)
    gl, gr = grain_cloud(e['t'], n, 60 if e['small'] else 85, -28.5 if e['small'] else -22.5, 9500, 0.25)
    p = pan_x(e['x'], 0.5)
    sfx.add(e['t'], (gl * (1 - p * 0.5), gr * (1 + p * 0.5)))


def click(e):
    s = damped([2300, 3400], [0.004, 0.003], [1, 0.6], 20) + 3 * burst(20, bp(4500, 0.5), 0.0002, 0.0012)
    s2 = np.zeros(int(0.03 * SR)); s2[:len(s)] += s; j = int(0.0025 * SR); s2[j:j + len(s)] += 0.7 * s[:len(s2) - j]
    sfx.add(e['t'], norm(s2, -15))


def clunk(e):
    def hit(scale):
        n = int(0.5 * SR); t = secs(n)
        thud = sine_sweep(n, 95, 55) * np.exp(-t / 0.16)
        knock = fft_filter(rng.standard_normal(n), bp(450, 0.8)) * np.exp(-t / 0.05)
        metal = damped([900, 1630, 2480], [0.06, 0.045, 0.03], [1, 0.7, 0.4], 500)
        return (np.tanh(2.2 * thud) + 0.5 * knock / np.max(np.abs(knock)) + 0.35 * metal / np.max(np.abs(metal))) * scale
    sfx.add(e['t'], norm(hit(1), -12.5))
    sfx.add(e['t'] + 0.16, norm(hit(1), -21))
    sfx.add(e['t'] + 0.31, norm(damped([1630, 2480], [0.03, 0.02], [1, 0.6], 80), -27))


def lid_thud(e):
    o, t1 = e['open0'], e['t']
    n = int((t1 - o) * SR)
    air = shaped_noise(rng, n, lp(420, 2)) * env_bell(n, 0.75, 1.3)
    sfx.add(o, norm(air, -29))
    m = int(0.4 * SR); t = secs(m)
    th = np.sin(2 * np.pi * 72 * t) * np.exp(-t / 0.12) + 0.5 * fft_filter(rng.standard_normal(m), bp(260, 0.8)) * np.exp(-t / 0.05) / 0.3
    sfx.add(t1, norm(th, -17))


def coin(e):
    ground = e['on'] == 'ground'
    f = (2100 + 300 * rng.random()) if ground else (3100 + 500 * rng.random())
    k = 0.7 if ground else 1.0
    s = damped([f, f * 1.47, f * 2.09, f * 2.76], [0.045 * k, 0.03 * k, 0.022 * k, 0.015 * k], [1, 0.8 * rng.random() + 0.3, 0.6, 0.4], 160)
    s = s / np.max(np.abs(s))
    c = norm(burst(3, hp(3000, 2)), -4)
    s[:len(c)] += c
    if ground:
        th = norm(burst(30, bp(500, 0.8), 0.0005, 0.008), -3)
        s[:len(th)] += th
    p = pan_x(e['x'], 0.55)
    sfx.add(e['t'], norm(s, (-22 if ground else -21) + rng.uniform(-3, 1.5)), p)
    if ground:
        sfx.add(e['t'] + 0.07 + 0.03 * rng.random(), norm(s, -33), p)


def bubbles(n, rate_env, f_lo, f_hi, rise, dur_ms, peak_db):
    s = (np.zeros(n), np.zeros(n))
    for i in np.nonzero(rng.random(n) < rate_env / SR)[0]:
        d = rng.uniform(*dur_ms)
        m = int(d / 1000 * SR)
        f0 = rng.uniform(f_lo, f_hi)
        b = sine_sweep(m, f0, f0 * (1 + rise * rng.uniform(0.6, 1.2))) * env_ad(m, 0.002, d / 1000 / 3)
        p = rng.uniform(-0.45, 0.45); a = rng.uniform(0.2, 1)
        j = min(n, i + m)
        s[0][i:j] += b[:j - i] * a * np.cos((p + 1) * np.pi / 4); s[1][i:j] += b[:j - i] * a * np.sin((p + 1) * np.pi / 4)
    mx = max(np.max(np.abs(s[0])), np.max(np.abs(s[1]))) + 1e-12
    return s[0] / mx * db(peak_db), s[1] / mx * db(peak_db)


def wind(e):
    d = e['dur']; n = int((d + 0.4) * SR); t = secs(n)
    gust = 0.55 + 0.45 * lfo_noise(n, 0.7, rng)
    body = stft_noise(rng, n, lambda tt, f: np.exp(-0.5 * (np.log2(np.maximum(f, 1) / (800 + 450 * np.sin(tt * 2.1))) / 1.1) ** 2))
    hiss = shaped_noise(rng, n, bp(5200, 0.6))
    env = np.clip(t / 0.25, 0, 1) * np.cos(np.clip((t - 1.4) / (d - 1.4), 0, 1) * np.pi / 2) ** 2
    s = (body / np.max(np.abs(body)) + 0.35 * hiss / np.max(np.abs(hiss)) * gust) * gust * env
    sfx.add(e['t'], (norm(s, -18), norm(np.roll(s, 2400), -18)))


def stream(e):
    n = int((e['end'] - e['t']) * SR); t = secs(n) + e['t']
    env = np.clip((t - e['t']) / (e['full'] - e['t']), 0, 1) ** 1.5 * np.cos(np.clip((t - (e['end'] - 0.45)) / 0.45, 0, 1) * np.pi / 2) ** 2
    bl, br = bubbles(n, 46 * env, 380, 1250, 0.45, (12, 38), -19)
    water = shaped_noise(rng, n, lambda f: lp(2200, 2)(f) * hp(260, 2)(f)) * (0.65 + 0.35 * lfo_noise(n, 11, rng)) * env
    w = norm(water, -25)
    sfx.add(e['t'], (bl * env + w, br * env + w))


def drain(e):
    d = e['dur']; n = int((d + 0.3) * SR); t = secs(n)
    env = env_bell(n, 0.3, 1.1)
    bl, br = bubbles(n, 30 * env, 140, 480, -0.3, (40, 90), -20)
    swirl = stft_noise(rng, n, lambda tt, f: np.exp(-0.5 * (np.log2(np.maximum(f, 1) / (900 * (260 / 900) ** np.clip(tt / d, 0, 1))) / 0.7) ** 2))
    sw = norm(swirl * (0.6 + 0.4 * np.sin(2 * np.pi * 4 * t)) * env, -24)
    sfx.add(e['t'], (bl + sw, br + sw))


def rumble(e):
    d = e['dur']; n = int((d + 0.5) * SR); t = secs(n)
    env = env_bell(n, 0.5, 1.2)
    rum = shaped_noise(rng, n, lp(75, 3)); rum /= np.max(np.abs(rum))
    s = np.tanh(1.7 * (0.9 * rum + 0.6 * np.sin(2 * np.pi * 38 * t))) * env
    sfx.add(e['t'], norm(s, -14))


def gold_shimmer(e):
    n = int((e['end'] - e['t']) * SR); t = secs(n)
    u = t / (n / SR)
    env = np.clip(u / 0.4, 0, 1) * np.cos(np.clip((t - (n / SR - 0.4)) / 0.4, 0, 1) * np.pi / 2) ** 2
    gl, gr = grain_cloud(e['t'], n, (20 + 75 * u) * env, -24, 9000, 0.7)
    air = norm(shaped_noise(rng, n, bp(5500, 0.6)) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.8 * t)) * env * u, -31)
    sfx.add(e['t'], (gl + air, gr + air))


def thump(e):
    k = e['k']; f = 64 - 2.7 * k                           # each one a little deeper
    n = int(0.8 * SR); t = secs(n)
    fr = f * (1 + 0.8 * np.exp(-t / 0.03))
    ph = 2 * np.pi * np.cumsum(fr) / SR
    env = env_ad(n, 0.003, 0.22 + 0.012 * k)
    s = (np.sin(ph) + 0.32 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)) * env
    s[:int(0.015 * SR)] += norm(burst(15, lp(500, 2), 0.0005, 0.004), -10)
    sfx.add(e['t'], norm(np.tanh(1.3 * s), -19 + 0.12 * k))


def swell(e):
    n = int((e['end'] - e['t']) * SR); t = secs(n)
    u = t / (n / SR)
    amp = db(-34 + 28 * u ** 1.5)
    tone = (np.sin(2 * np.pi * 36.7 * t) + 0.8 * np.sin(2 * np.pi * 55.05 * t + 1) + 0.6 * np.sin(2 * np.pi * 73.4 * t)
            + (0.15 + 0.35 * u) * np.sin(2 * np.pi * 110.1 * t) + (0.05 + 0.25 * u) * np.sin(2 * np.pi * 146.8 * t + 2)
            + 0.15 * u ** 2 * np.sin(2 * np.pi * 220.2 * t))
    nz = stft_noise(rng, n, lambda tt, f: lp(150 + 1300 * np.clip(tt / (n / SR), 0, 1) ** 1.6, 2)(f))
    top = shaped_noise(rng, n, bp(3200, 0.9)) * u ** 3
    s = (np.tanh(1.2 * tone / 2.2) + 0.5 * nz / np.max(np.abs(nz)) + 0.25 * top / np.max(np.abs(top))) * amp
    sfx.add(e['t'], norm(fade(s, 0.05, 0.012), -12.5))


def end_air(e):
    n = int((e['end'] - e['t']) * SR); t = secs(n) + e['t']
    env = np.clip((t - 55.35) / 1.2, 0, 1) ** 2
    l = shaped_noise(rng, n, bp(800, 1.3)) * (0.7 + 0.3 * lfo_noise(n, 0.4, rng))
    r = shaped_noise(rng, n, bp(800, 1.3)) * (0.7 + 0.3 * lfo_noise(n, 0.4, rng))
    m = max(np.max(np.abs(l)), np.max(np.abs(r)))
    post.add(e['t'], (l / m * db(-33) * env, r / m * db(-33) * env))


HANDLERS = {'titleSwell': title_swell, 'towerRise': tower_rise, 'pageFlutter': page_flutter, 'shimmer': shimmer,
            'quake': quake, 'crack': crack, 'watch': watch, 'sparkle': sparkle, 'click': click, 'clunk': clunk,
            'lidThud': lid_thud, 'coin': coin, 'wind': wind, 'stream': stream, 'drain': drain, 'rumble': rumble,
            'goldShimmer': gold_shimmer, 'thump': thump, 'swell': swell, 'endAir': end_air}


# ============================================================================ build + mix
print('bed ...')
bL, bR = make_bed()
bed.L += bL; bed.R += bR
print('transitions + typing ...')
for b in cues['boundaries']:
    if abs(b - CUT) < 1e-6:
        continue                                          # silence instead of a whoosh at 55 s
    w = whoosh()
    sfx.add(b - 0.55 * 1.2, (norm(w[0], -21), norm(w[1], -21)))
for tk in cues['ticks']:
    (post if tk['t'] >= CUT else ticks).add(tk['t'], norm(tick_sound(), -36 + rng.uniform(-1.5, 1)), pan_x(tk['x'], 0.5))
print('scene effects ...')
for e in cues['events']:
    HANDLERS[e['type']](e)

print('reverb ...')
irl, irr = reverb_ir(rng, 2.2)
wetL, wetR = convolve_fft(sfx.L, irl), convolve_fft(sfx.R, irr)
mix = bed.stereo() + ticks.stereo() + sfx.stereo() + db(-13) * np.stack([wetL, wetR])
t = secs(N)
gate = np.where(t < CUT, 1.0, 0.0)                         # sudden silence (15 ms, no click)
k = (t >= CUT) & (t < CUT + 0.015)
gate[k] = np.cos((t[k] - CUT) / 0.015 * np.pi / 2) ** 2
mix = mix * gate[None, :] + post.stereo()
mix *= np.clip((DUR - t) / 2.0, 0, 1)[None, :] ** 1.5      # fade out over the last 2 s
mix = np.stack([fft_filter(ch, hp(24, 2)) for ch in mix])   # no DC / subsonic rumble

print('master ...')
pre_bed = rms_db(bed.L[int(5 * SR):int(50 * SR)])
pre_tick = 20 * np.log10(np.max(np.abs(ticks.L)) + 1e-12)
gain = TARGET_LUFS - integrated_lufs(mix)
for it in range(5):
    out, gr = limit(mix * db(gain), CEILING_DBTP)
    lufs = integrated_lufs(out)
    if abs(lufs - TARGET_LUFS) < 0.05:
        break
    gain += TARGET_LUFS - lufs
tp = true_peak_db(out)
if '--report' in sys.argv:                              # per-scene loudness / peak / limiting
    from audio_dsp import k_weight
    pre = mix * db(gain)
    for sc in cues['scenes']:
        i0, i1 = int(sc['start'] * SR), int(sc['end'] * SR)
        seg = out[:, i0:i1]
        pk = 20 * np.log10(np.max(np.abs(pre[:, i0:i1])) + 1e-12)
        ms = np.mean(sum(k_weight(ch) ** 2 for ch in seg))
        print(f"    {sc['id']:10s} loudness {-0.691 + 10 * np.log10(ms + 1e-15):6.1f} LUFS   peak before limiter {pk:+5.1f} dBFS")
print(f'  master gain {gain:+.2f} dB, max limiting {gr:.2f} dB')
print(f'  integrated loudness {lufs:.2f} LUFS, true peak {tp:.2f} dBTP, sample peak {20 * np.log10(np.max(np.abs(out))):.2f} dBFS')
print(f'  bed {pre_bed:.1f} dBFS RMS and ticks {pre_tick:.1f} dBFS peak before the master gain')

x = np.clip(out, -1, 1 - 1 / 8388608)
pcm = np.ascontiguousarray(np.round(x.T * 8388607).astype('<i4'))
data = pcm.view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR); w.writeframes(data)
print(f'wrote {OUT}  ({N / SR:.3f} s, {SR} Hz, 24-bit stereo)')
