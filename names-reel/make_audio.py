#!/usr/bin/env python3
"""Soundtrack for "9 Beautiful Names of Allah", 100% synthesised with numpy (no samples).

Every sound is placed from build/cues.json, which reel.html exports from the same timeline
that draws the picture, so the audio lands exactly on its frame.

    python3 make_audio.py build/cues.json build/audio.wav

No music, no voice, no bells: only a drone bed, filtered noise and short synthetic sounds.
"""
import json
import sys
import wave

import numpy as np

from audio_dsp import (SR, Bus, bp, convolve_fft, db, env_ad, env_bell, fade, fft_filter, from_points, hp,
                       integrated_lufs, limit, lp, reverb_ir, rms_db, secs, shaped_noise, stft_noise, true_peak_db)

DUR = 60.0
N = int(DUR * SR)
TARGET_LUFS, CEILING_DBTP = -14.0, -1.6   # leaves room for AAC overshoot (final MP4 <= -1 dBTP)
rng = np.random.default_rng(99)

cues = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'build/cues.json'))
OUT = sys.argv[2] if len(sys.argv) > 2 else 'build/audio.wav'
END_START = next(s['start'] for s in cues['scenes'] if s['id'] == 'end')

bed, sfx, ticks = Bus(N), Bus(N), Bus(N)


# ============================================================================ helpers
def mixs(*parts):
    out = np.zeros(max(len(p) for p in parts))
    for p in parts:
        out[:len(p)] += p
    return out


def norm(x, peak_db):
    return x / (np.max(np.abs(x)) + 1e-12) * db(peak_db)


def stereo_norm(l, r, peak_db):
    m = max(np.max(np.abs(l)), np.max(np.abs(r))) + 1e-12
    return l / m * db(peak_db), r / m * db(peak_db)


def pan_x(x, amount=0.5):
    return float(np.clip((x - 540) / 540 * amount, -1, 1))


def sine_sweep(n, f0, f1):
    t = np.linspace(0, 1, n)
    return np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** t) / SR)


def lfo_noise(n, rate_hz):
    pts = rng.random(int(n / SR * rate_hz) + 3)
    return np.interp(np.arange(n) / SR * rate_hz, np.arange(len(pts)), pts)


def burst(n_ms, mag, attack=0.0004, decay=0.002):
    n = max(8, int(n_ms / 1000 * SR))
    return fft_filter(rng.standard_normal(n), mag) * env_ad(n, attack, decay)


def damped(freqs, decays, amps, n_ms):
    n = int(n_ms / 1000 * SR)
    t = secs(n)
    return sum(a * np.sin(2 * np.pi * f * t + rng.random() * 6.28) * np.exp(-t / d) for f, d, a in zip(freqs, decays, amps))


def scatter(n, rate, make, spread=0.5):
    """Place many short grains (make() -> mono array) at random times; rate is per second (scalar or array)."""
    L, R = np.zeros(n), np.zeros(n)
    for i in np.nonzero(rng.random(n) < np.asarray(rate) / SR)[0]:
        g = make()
        p = rng.uniform(-spread, spread)
        j = min(n, i + len(g))
        L[i:j] += g[:j - i] * np.cos((p + 1) * np.pi / 4); R[i:j] += g[:j - i] * np.sin((p + 1) * np.pi / 4)
    return L, R


def glitter(n, rate, fc=9000):                      # soft sparkle: tiny grains of very high noise, no pitch
    return scatter(n, rate, lambda: burst(rng.uniform(2, 6), bp(fc * rng.uniform(0.75, 1.3), 0.35), 0.0003, rng.uniform(0.0008, 0.002)) * rng.uniform(0.3, 1.0), 0.7)


def sweep_noise(n, fc_fn, octaves):
    return stft_noise(rng, n, lambda tt, f: np.exp(-0.5 * (np.log2(np.maximum(f, 1) / np.maximum(fc_fn(tt), 60)) / octaves) ** 2))


def edges(n, fin, fout):
    t = secs(n)
    return np.clip(t / max(fin, 1e-3), 0, 1) ** 2 * np.cos(np.clip((t - (n / SR - fout)) / max(fout, 1e-3), 0, 1) * np.pi / 2) ** 2


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
    away = 1 - np.clip((t - END_START) / 1.5, 0, 1)                        # ending: soft air only
    dl, dr = drone(0.0021, 0.0) * breath * away, drone(0.0018, 0.7) * breath * away
    k = db(-27) / np.sqrt(np.mean((drone(0.0021, 0.0) * breath)[:int(50 * SR)] ** 2))
    air_m = lambda f: bp(900, 1.4)(f) / np.sqrt(np.maximum(f, 30) / 100)
    al, ar = shaped_noise(rng, N, air_m), shaped_noise(rng, N, air_m)
    gust = 0.65 + 0.35 * lfo_noise(N, 0.35)
    ka = db(-42) / np.sqrt(np.mean(al ** 2))
    g = np.clip(t / 1.0, 0, 1) ** 2                                         # fade in 1 s
    return (dl * k + al * ka * gust) * g, (dr * k + ar * ka * gust) * g


# ============================================================================ transitions + typing
def whoosh(dur=1.2, peak=0.55):
    n = int(dur * SR)
    u = lambda tt: np.clip(tt / dur, 0, 1)
    s = sweep_noise(n, lambda tt: np.where(u(tt) < peak, 240 * (1900 / 240) ** (u(tt) / peak), 1900 * (480 / 1900) ** ((u(tt) - peak) / (1 - peak))), 0.85)
    s = s * env_bell(n, peak, 1.5)
    p = np.linspace(-0.45, 0.45, n)
    return (s * np.cos((p + 1) * np.pi / 4) * np.sqrt(2), s * np.sin((p + 1) * np.pi / 4) * np.sqrt(2))


def tick_sound():
    n = int(0.03 * SR); t = secs(n); r = rng.random()
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


def tok(e):                                          # a date landing in the clay bowl
    k = e['k']; n = int(0.3 * SR); t = secs(n)
    f0 = (560 if k < 6 else 430) + 70 * rng.random()          # the first ones knock on bare clay
    body = np.sin(2 * np.pi * f0 * t) * np.exp(-t / 0.032) + 0.45 * np.sin(2 * np.pi * 2.31 * f0 * t) * np.exp(-t / 0.016)
    knock = burst(40, bp(1300, 0.7), 0.0006, 0.006)
    s = mixs(body, 0.7 * knock / np.max(np.abs(knock)), 0.6 * np.sin(2 * np.pi * 150 * t) * np.exp(-t / 0.05))
    sfx.add(e['t'], norm(fade(s, 0.0005, 0.05), (-15.5 if k < 6 else -17.5) + rng.uniform(-1.5, 1)), pan_x(e['x'], 0.4))


def air_rise(e):                                     # breathy air rising upward
    d = e['dur']; n = int((d + 0.3) * SR)
    s = sweep_noise(n, lambda tt: 280 * (3400 / 280) ** np.clip(tt / d, 0, 1), 0.7) * env_bell(n, 0.42, 1.3)
    p = rng.uniform(-0.25, 0.25)
    sfx.add(e['t'], norm(s, -21), p)


def underwater(e):                                   # deep, muffled
    n = int((e['end'] - e['t']) * SR); t = secs(n)
    deep = shaped_noise(rng, n, lp(170, 2)) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.21 * t))
    tone = np.sin(2 * np.pi * 42 * t + 2 * np.sin(2 * np.pi * 0.13 * t)) * 0.6
    bl, br = scatter(n, 7, lambda: (lambda m: sine_sweep(m, rng.uniform(140, 380), rng.uniform(300, 600)) * env_ad(m, 0.004, m / SR / 3))(int(rng.uniform(0.03, 0.09) * SR)), 0.6)
    bl, br = fft_filter(bl, lp(900, 2)), fft_filter(br, lp(900, 2))
    body = np.tanh(1.5 * (deep / np.max(np.abs(deep)) + tone)) * edges(n, 0.5, 0.45)
    b = norm(body, -18.5)
    ml, mr = stereo_norm(bl, br, -25)
    sfx.add(e['t'], (b + ml, b + mr))


def pearl_shimmer(e):                                # soft shimmer when the pearl glows
    n = int((e['end'] - e['t']) * SR); t = secs(n)
    rate = 90 * np.exp(-t / 0.8) + 18
    gl, gr = glitter(n, rate * edges(n, 0.02, 0.45), 8500)
    gl, gr = stereo_norm(gl, gr, -21)
    air = norm(shaped_noise(rng, n, bp(6000, 0.5)) * np.exp(-t / 1.2) * edges(n, 0.05, 0.45), -31)
    sfx.add(e['t'], (gl + air, gr + air))


def soil(e):                                         # soft soil crackle
    n = int((e['end'] - e['t']) * SR); t = secs(n) + e['t']
    rate = 14 + 60 * np.exp(-np.abs(t - e['crack']) / 0.08) + 22 * ((t > e['crack']) & (t < e['end']))
    cl, cr = scatter(n, rate, lambda: burst(rng.uniform(1.5, 4), bp(rng.uniform(900, 2600), 0.7), 0.0003, rng.uniform(0.0006, 0.002)) * rng.uniform(0.15, 1.0) ** 2, 0.35)
    cl, cr = stereo_norm(cl, cr, -20)
    sfx.add(e['t'], (cl, cr))


def pop(e):                                          # a tiny "pop" as the sprout breaks out
    n = int(0.08 * SR)
    s = sine_sweep(n, 950, 470) * np.exp(-secs(n) / 0.012)
    s = mixs(s, 0.5 * norm(burst(3, hp(2000, 2)), 0))
    sfx.add(e['t'], norm(s, -15))


def rain(e):                                         # gentle rain
    n = int((e['end'] - e['t']) * SR)
    env = edges(n, 0.7, 0.45)
    hiss = shaped_noise(rng, n, bp(5200, 1.1)) * env
    dl, dr = scatter(n, 170 * env, lambda: burst(rng.uniform(1, 3), hp(2500, 2), 0.0002, rng.uniform(0.0004, 0.0012)) * rng.exponential(0.35), 0.8)
    tl, tr = scatter(n, 24 * env, lambda: burst(rng.uniform(3, 6), bp(1200, 0.6), 0.0004, 0.002) * rng.uniform(0.2, 0.8), 0.5)
    dl, dr = stereo_norm(dl, dr, -21.5); tl, tr = stereo_norm(tl, tr, -26.5)
    h = norm(hiss, -25.5)
    sfx.add(e['t'], (dl + tl + h, dr + tr + h))


def warm_tone(e):                                    # a warm, soft rising tone (smooth, no attack)
    n = int((e['end'] - e['t']) * SR); t = secs(n)
    u = np.clip(t / (e['peak'] - e['t']), 0, 1)
    rise = u * u * (3 - 2 * u)
    f = 98 * 2 ** (0.585 * rise)                    # glides up a fifth
    ph = 2 * np.pi * np.cumsum(f) / SR
    amps = [1, 0.5, 0.28 * (0.5 + rise), 0.16 * (0.4 + rise), 0.09 * rise, 0.05 * rise]
    tone = sum(a * np.sin(k * ph) for k, a in enumerate(amps, 1))
    tone += 0.6 * sum(a * np.sin(k * ph * 1.003 + 1) for k, a in enumerate(amps[:3], 1))   # gentle chorus
    air = shaped_noise(rng, n, bp(1800, 0.8)) * 0.12
    env = (0.08 + 0.92 * rise) * edges(n, 0.6, 0.5)
    sfx.add(e['t'], norm(fft_filter((tone / np.max(np.abs(tone)) + air) * env, lp(2600, 2)), -16.5))


def storm(e):                                        # storm wind; muffled and calm once the glass is down
    n = int((e['end'] - e['t']) * SR); t = secs(n) + e['t']
    gust = 0.55 + 0.45 * lfo_noise(n, 1.4)
    wind = sweep_noise(n, lambda tt: 650 + 420 * np.sin(tt * 1.7) + 250 * np.sin(tt * 4.1), 1.2)
    howl = sweep_noise(n, lambda tt: 760 + 120 * np.sin(tt * 0.9), 0.16)
    rainh = shaped_noise(rng, n, bp(4500, 1.0))
    full = (wind / np.max(np.abs(wind)) + 0.35 * howl / np.max(np.abs(howl))) * gust + 0.3 * rainh / np.max(np.abs(rainh))
    muffled = fft_filter(full, lp(420, 2))
    m = np.clip((t - (e['cover'] - 0.05)) / 0.4, 0, 1); m = m * m * (3 - 2 * m)
    s = (full * (1 - m) + muffled * db(-11) * m) * edges(n, 0.3, 0.45)
    sfx.add(e['t'], (norm(s, -13), norm(np.roll(s, 1900), -13)))


def glass_settle(e):                                 # a soft, dull touch of glass on stone (not a ring)
    s = mixs(damped([1150, 2650], [0.025, 0.015], [1, 0.5], 120), 0.8 * np.sin(2 * np.pi * 180 * secs(int(0.1 * SR))) * np.exp(-secs(int(0.1 * SR)) / 0.03))
    sfx.add(e['t'], norm(s, -22))


def winter_wind(e):
    n = int((e['end'] - e['t']) * SR)
    w = sweep_noise(n, lambda tt: 850 + 300 * np.sin(tt * 0.8), 0.9) * (0.6 + 0.4 * lfo_noise(n, 0.6))
    whistle = sweep_noise(n, lambda tt: 1250 + 160 * np.sin(tt * 0.5), 0.08) * 0.4
    s = (w / np.max(np.abs(w)) + whistle / np.max(np.abs(whistle)) * 0.35) * edges(n, 0.4, 0.45)
    sfx.add(e['t'], (norm(s, -19.5), norm(np.roll(s, 2600), -19.5)))


def fire(e):                                         # a warm, gentle fire crackle
    n = int((e['end'] - e['t']) * SR); t = secs(n)
    env = edges(n, 0.5, 0.45)
    cl, cr = scatter(n, 16 * env, lambda: burst(rng.uniform(1, 3.5), bp(rng.uniform(1500, 3500), 0.7), 0.0002, rng.uniform(0.0005, 0.0015)) * rng.uniform(0.1, 1) ** 2, 0.3)
    roar = shaped_noise(rng, n, lp(320, 2)) * (0.6 + 0.4 * lfo_noise(n, 9)) * env
    cl, cr = stereo_norm(cl, cr, -19.5)
    r_ = norm(roar, -26.5)
    sfx.add(e['t'], (cl + r_, cr + r_), -0.15)


def night_air(e):
    n = int((e['end'] - e['t']) * SR)
    s = shaped_noise(rng, n, bp(1100, 1.1)) * (0.6 + 0.4 * lfo_noise(n, 0.4)) * edges(n, 0.5, 0.45)
    sfx.add(e['t'], (norm(s, -25), norm(np.roll(s, 3000), -25)))


def star_shimmer(e):                                 # gentle shimmer as the stars come close
    n = int(5.5 * SR)
    env = from_points(n, 0, e['rate'], e['env'])
    d = np.gradient(env) * SR                        # most sparkle while they are moving in
    gl, gr = glitter(n, (12 + 40 * env + 260 * np.clip(d, 0, None)) * edges(n, 0.2, 0.45), 9000)
    gl, gr = stereo_norm(gl, gr, -20)
    sfx.add(e['t'], (gl, gr))


def end_air(e):
    n = int((e['end'] - e['t']) * SR); t = secs(n)
    l = shaped_noise(rng, n, bp(800, 1.3)) * (0.7 + 0.3 * lfo_noise(n, 0.4))
    r = shaped_noise(rng, n, bp(800, 1.3)) * (0.7 + 0.3 * lfo_noise(n, 0.4))
    env = np.clip(t / 0.8, 0, 1) ** 2
    l, r = stereo_norm(l * env, r * env, -31)
    sfx.add(e['t'], (l, r))


HANDLERS = {'titleSwell': title_swell, 'tok': tok, 'airRise': air_rise, 'underwater': underwater, 'pearlShimmer': pearl_shimmer,
            'soil': soil, 'pop': pop, 'rain': rain, 'warmTone': warm_tone, 'storm': storm, 'glassSettle': glass_settle,
            'winterWind': winter_wind, 'fire': fire, 'nightAir': night_air, 'starShimmer': star_shimmer, 'endAir': end_air}


# ============================================================================ build + mix
print('bed ...')
bL, bR = make_bed()
bed.L += bL; bed.R += bR
print('transitions + typing ...')
for b in cues['boundaries']:
    w = whoosh()
    sfx.add(b - 0.55 * 1.2, (norm(w[0], -21), norm(w[1], -21)))
for tk in cues['ticks']:
    ticks.add(tk['t'], norm(tick_sound(), -36 + rng.uniform(-1.5, 1)), pan_x(tk['x'], 0.5))
print('scene effects ...')
for e in cues['events']:
    HANDLERS[e['type']](e)

print('reverb ...')
irl, irr = reverb_ir(rng, 2.2)
wet = np.stack([convolve_fft(sfx.L, irl), convolve_fft(sfx.R, irr)])
mix = bed.stereo() + ticks.stereo() + sfx.stereo() + db(-13) * wet
t = secs(N)
mix *= np.clip((DUR - t) / 2.0, 0, 1)[None, :] ** 1.5      # fade out over the last 2 s
mix = np.stack([fft_filter(ch, hp(24, 2)) for ch in mix])

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
if '--report' in sys.argv:                              # per-scene loudness / peak before the limiter
    from audio_dsp import k_weight
    pre = mix * db(gain)
    for sc in cues['scenes']:
        i0, i1 = int(sc['start'] * SR), int(sc['end'] * SR)
        ms = np.mean(sum(k_weight(ch) ** 2 for ch in out[:, i0:i1]))
        pk = 20 * np.log10(np.max(np.abs(pre[:, i0:i1])) + 1e-12)
        print(f"    {sc['id']:8s} loudness {-0.691 + 10 * np.log10(ms + 1e-15):6.1f} LUFS   peak before limiter {pk:+5.1f} dBFS")
print(f'  master gain {gain:+.2f} dB, max limiting {gr:.2f} dB')
print(f'  integrated loudness {lufs:.2f} LUFS, true peak {tp:.2f} dBTP, sample peak {20 * np.log10(np.max(np.abs(out))):.2f} dBFS')
print(f'  bed {pre_bed:.1f} dBFS RMS and ticks {pre_tick:.1f} dBFS peak before the master gain')

x = np.clip(out, -1, 1 - 1 / 8388608)
pcm = np.ascontiguousarray(np.round(x.T * 8388607).astype('<i4'))
data = pcm.view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR); w.writeframes(data)
print(f'wrote {OUT}  ({N / SR:.3f} s, {SR} Hz, 24-bit stereo)')
