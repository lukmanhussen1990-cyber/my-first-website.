"""Synthesize sound effects + a tension music bed and mix them under the voiceover.

All SFX are generated procedurally (no external samples), so the mix is fully reproducible.
Cue times come from data/script.json ("sfx": [[name, time, gain, (duration)], ...]).

Usage:  python tools/make_audio.py            -> assets/final_mix.wav
"""
import json
import os
import subprocess
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
from scipy import signal

ROOT = Path(__file__).resolve().parents[1]
SR = 44100
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- helpers
def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env_exp(dur, decay, attack=0.002):
    t = t_axis(dur)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t * decay)


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    sos = signal.butter(order, f, btype="low", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    sos = signal.butter(order, f, btype="high", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def sweep(f0, f1, dur, curve="exp"):
    t = t_axis(dur)
    if curve == "exp":
        f = f0 * (f1 / f0) ** (t / dur)
    else:
        f = f0 + (f1 - f0) * (t / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR), f


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


def reverb(x, seconds=1.2, mix=0.25, damp=3000):
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * (6.9 / seconds))
    ir = lp(ir, damp)
    ir[0] = 0
    wet = signal.fftconvolve(x, ir)
    wet = np.pad(wet, (0, max(0, len(x) + n - len(wet))))[: len(x) + n]
    wet = norm(wet, np.max(np.abs(x)) * 0.9)
    out = np.zeros(len(x) + n)
    out[: len(x)] += x * (1 - mix * 0.5)
    out += wet * mix
    return out


def pad_to(x, dur):
    n = int(dur * SR)
    return np.pad(x, (0, max(0, n - len(x))))[:n]


# ---------------------------------------------------------------- sound effects
def sfx_siren_chirp():
    out = []
    for f0, f1 in [(650, 1350), (1350, 700)]:
        s, _ = sweep(f0, f1, 0.22)
        saw = signal.sawtooth(2 * np.pi * np.cumsum(np.linspace(f0, f1, len(s))) / SR) * 0.35 + s
        out.append(saw * np.hanning(len(s)) ** 0.5)
    x = np.concatenate(out * 2)
    x = lp(x, 3500)
    return reverb(norm(x), 1.6, 0.4)


def sfx_low_hit():
    d = 1.6
    t = t_axis(d)
    f = 38 + 60 * np.exp(-t * 7)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    s += lp(noise(d), 300) * env_exp(d, 18) * 0.6
    return reverb(norm(s), 1.8, 0.35, 1200)


def sfx_whirr(d, rising):
    t = t_axis(d)
    shape = np.sin(np.pi * t / d)
    f = (300 + 1700 * (t / d) ** 1.5) if rising else (1900 - 1500 * (t / d) ** 0.7)
    vib = 1 + 0.08 * np.sin(2 * np.pi * 34 * t)
    tone = signal.sawtooth(2 * np.pi * np.cumsum(f * vib) / SR) * 0.3
    nz = noise(d)
    centers = 600 + 3000 * (t / d if rising else 1 - t / d)
    zz = np.zeros_like(nz)
    seg = 2048
    for i in range(0, len(nz), seg):
        c = centers[min(i, len(centers) - 1)]
        zz[i:i + seg] = bp(nz[i:i + seg + 256], c * 0.7, min(c * 1.4, 18000))[: len(zz[i:i + seg])]
    x = (tone + zz * 0.8) * shape
    click = np.zeros(int(0.05 * SR)); click[:120] = rng.standard_normal(120)
    return np.concatenate([norm(lp(x, 7000)) * 0.9, hp(click, 2000) * 0.6])


def sfx_buzz():
    pulses = []
    for dur in (0.34, 0.34):
        t = t_axis(dur)
        f = 172
        x = signal.square(2 * np.pi * f * t, 0.5) * 0.4 + np.sin(2 * np.pi * f * t)
        x += lp(noise(dur), 1800) * 0.25 * (np.sin(2 * np.pi * f * t) > 0)  # table rattle
        e = np.clip(t / 0.02, 0, 1) * np.clip((dur - t) / 0.03, 0, 1)
        pulses.append(lp(x, 1400) * e)
        pulses.append(np.zeros(int(0.13 * SR)))
    return norm(np.concatenate(pulses))


def bell(f, dur=1.0, decay=5.0):
    t = t_axis(dur)
    x = np.zeros_like(t)
    for k, (m, a) in enumerate([(1, 1), (2.0, 0.35), (3.01, 0.18), (4.2, 0.08)]):
        x += a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * decay * (1 + k * 0.6))
    return x * np.clip(t / 0.003, 0, 1)


def sfx_ding():
    a = bell(1318.5, 0.9, 6)
    b = bell(1975.5, 1.1, 5)
    x = np.zeros(int(1.3 * SR))
    x[: len(a)] += a
    o = int(0.11 * SR)
    x[o: o + len(b)] += b * 0.9
    return reverb(norm(x), 0.8, 0.2, 6000)


def sfx_snore():
    d1 = 0.9
    t = t_axis(d1)
    saw = (signal.sawtooth(2 * np.pi * 28 * t) + 1) / 2
    x = lp(noise(d1), 700) * saw * np.sin(np.pi * t / d1) ** 1.5
    x = bp(x, 80, 900) * 2
    d2 = 0.7
    t2 = t_axis(d2)
    wh, _ = sweep(950, 650, d2)
    y = (wh * 0.25 + lp(noise(d2), 2500) * 0.4) * np.sin(np.pi * t2 / d2) ** 2
    return np.concatenate([norm(x), np.zeros(int(0.08 * SR)), norm(y) * 0.6])


def sfx_steps(times):
    """Footsteps at explicit times (seconds, absolute)."""
    total = max(times) + 0.3
    out = np.zeros(int((total + 0.3) * SR))
    for k, t in enumerate(times):
        d = 0.09
        th = lp(noise(d), 500) * env_exp(d, 60) + bp(noise(d), 1500, 5000) * env_exp(d, 140) * 0.35
        th *= 0.75 + 0.25 * (k % 2)
        i = int(t * SR)
        out[i: i + len(th)] += th
    return norm(out)


def sfx_pop():
    d = 0.16
    s, _ = sweep(380, 950, d)
    x = s * env_exp(d, 26, 0.004)
    x[:60] += rng.standard_normal(60) * 0.2
    return norm(x)


def sfx_stamp(big=True):
    d = 1.4 if big else 0.6
    t = t_axis(d)
    f = 42 + 70 * np.exp(-t * 25)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (6 if big else 14))
    thwack = bp(noise(d), 250, 2400) * env_exp(d, 38)
    click = hp(noise(d), 3000) * env_exp(d, 120)
    x = thump * 1.0 + thwack * 0.8 + click * 0.35
    return reverb(norm(x), 0.9 if big else 0.4, 0.25 if big else 0.15, 2500)


def sfx_chair():
    d = 0.5
    t = t_axis(d)
    rate = 90 + 120 * np.abs(np.sin(2 * np.pi * 2.3 * t)) + 30 * rng.standard_normal(len(t)).cumsum() / 400
    phase = np.cumsum(np.clip(rate, 40, 400)) / SR
    imp = np.diff(np.floor(phase), prepend=0)
    x = bp(imp, 600, 1100, 4) * 3 + bp(imp, 1500, 2200, 4)
    x *= np.sin(np.pi * t / d) ** 0.7
    return norm(x)


def sfx_door_slam():
    d = 2.0
    t = t_axis(d)
    f = 55 + 50 * np.exp(-t * 20)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    hit = lp(noise(d), 1200) * env_exp(d, 30)
    latch = hp(noise(d), 2500) * env_exp(d, 90) * 0.5
    rattle = np.zeros_like(t)
    for k in range(5):
        i = int((0.06 + k * 0.045) * SR)
        r = bp(noise(0.05), 1500, 5000) * env_exp(0.05, 80)
        rattle[i: i + len(r)] += r * (0.4 / (k + 1))
    x = body + hit * 0.9 + latch + rattle
    return reverb(norm(x), 1.6, 0.35, 2500)


def sfx_splash():
    d = 1.0
    t = t_axis(d)
    plunk_s, _ = sweep(320, 110, 0.12)
    x = np.zeros_like(t)
    x[: len(plunk_s)] += plunk_s * env_exp(0.12, 25) * 0.9
    x += bp(noise(d), 900, 8000) * env_exp(d, 7, 0.01) * 0.7
    # droplets: short rising sine chirps
    for _ in range(14):
        st = rng.uniform(0.05, 0.75)
        dd = rng.uniform(0.02, 0.05)
        f0 = rng.uniform(900, 2200)
        s, _ = sweep(f0, f0 * 2.2, dd)
        i = int(st * SR)
        x[i: i + len(s)] += s * np.hanning(len(s)) * rng.uniform(0.15, 0.4)
    return reverb(norm(x), 0.7, 0.2, 7000)


def sfx_slam_table():
    d = 1.2
    t = t_axis(d)
    x = hp(noise(d), 1200) * env_exp(d, 70) * 0.9
    for f, a, dec in [(420, 0.5, 9), (1133, 0.35, 12), (2150, 0.25, 15), (3390, 0.12, 18)]:
        x += a * np.sin(2 * np.pi * f * t) * np.exp(-t * dec)
    th = np.sin(2 * np.pi * np.cumsum(50 + 60 * np.exp(-t * 30)) / SR) * np.exp(-t * 9)
    x += th
    return reverb(norm(x), 1.0, 0.3, 4000)


def sfx_whoosh(d=0.5):
    t = t_axis(d)
    nz = noise(d)
    x = np.zeros_like(nz)
    seg = 1024
    for i in range(0, len(nz), seg):
        u = i / len(nz)
        c = 400 + 3500 * np.sin(np.pi * u)
        x[i:i + seg] = bp(nz[i:i + seg + 256], c * 0.6, min(c * 1.5, 18000))[: len(x[i:i + seg])]
    return norm(x * np.sin(np.pi * t / d) ** 2)


def sfx_cctv(dur):
    t = t_axis(dur)
    hum = sum(np.sin(2 * np.pi * 60 * k * t) / k for k in (1, 2, 3, 5)) * 0.3
    hiss = hp(noise(dur), 3000) * 0.25
    e = np.clip(t / 0.4, 0, 1) * np.clip((dur - t) / 0.4, 0, 1)
    return norm((hum + hiss) * e)


def sfx_beep():
    blip = lambda f, d: np.sin(2 * np.pi * f * t_axis(d)) * np.clip(t_axis(d) / 0.004, 0, 1) * np.clip((d - t_axis(d)) / 0.01, 0, 1)
    x = np.concatenate([blip(1250, 0.07), np.zeros(int(0.05 * SR)), blip(1250, 0.07), np.zeros(int(0.04 * SR))])
    ch, _ = sweep(800, 3000, 0.18)
    return norm(np.concatenate([x, ch * 0.4 * np.hanning(len(ch))]))


def sfx_bloop():
    d = 0.3
    s, _ = sweep(300, 110, d)
    wob = 1 + 0.4 * np.sin(2 * np.pi * 18 * t_axis(d))
    return norm(s * wob * env_exp(d, 9, 0.01))


def sfx_heartbeat(total):
    out = np.zeros(int((total + 0.5) * SR))
    t0 = 0.0
    while t0 < total:
        for off, a in [(0.0, 1.0), (0.2, 0.7)]:
            d = 0.25
            tt = t_axis(d)
            b = np.sin(2 * np.pi * np.cumsum(48 + 25 * np.exp(-tt * 30)) / SR) * env_exp(d, 18, 0.008) * a
            i = int((t0 + off) * SR)
            out[i: i + len(b)] += b
        t0 += 0.86
    return norm(lp(out, 200))


def sfx_lock():
    out = np.zeros(int(0.7 * SR))
    for k in range(6):
        d = 0.09
        tt = t_axis(d)
        x = sum(a * np.sin(2 * np.pi * f * tt) for f, a in [(2100, 1), (3420, 0.6), (5150, 0.4), (7300, 0.2)])
        x = x * np.exp(-tt * 55) + hp(noise(d), 4000) * env_exp(d, 200) * 0.3
        i = int((k * 0.065 + rng.uniform(0, 0.015)) * SR)
        out[i: i + len(x)] += x * (1.0 if k % 2 == 0 else 0.6)
    return reverb(norm(out), 0.5, 0.15, 8000)


def sfx_gasp():
    d = 0.5
    t = t_axis(d)
    e = np.clip(t / 0.05, 0, 1) * np.exp(-np.clip(t - 0.16, 0, None) * 11)
    nz = noise(d)
    x = bp(nz, 650, 950, 2) * 1.0 + bp(nz, 1150, 1500, 2) * 0.7 + bp(nz, 2400, 3000, 2) * 0.35 + hp(nz, 4500) * 0.08
    return norm(x * e)


def sfx_squeak():
    d = 0.45
    t = t_axis(d)
    f = 1150 + 350 * np.sin(2 * np.pi * 2.0 * t) + 120 * np.sin(2 * np.pi * 37 * t)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    am = 0.6 + 0.4 * (np.sin(2 * np.pi * 23 * t) > 0)
    x = s * am * np.sin(np.pi * t / d) ** 0.6
    thud = np.sin(2 * np.pi * np.cumsum(90 + 60 * np.exp(-t * 30)) / SR) * env_exp(d, 25)
    return norm(lp(x, 4000) * 0.6 + thud)


def sfx_rec_beep():
    tt = t_axis(0.14)
    return norm(np.sin(2 * np.pi * 880 * tt) * np.clip(tt / 0.005, 0, 1) * np.clip((0.14 - tt) / 0.02, 0, 1))


def sfx_btn(f):
    d = 0.35
    s, _ = sweep(f * 0.6, f * 1.25, 0.09)
    x = np.zeros(int(d * SR))
    x[: len(s)] += s * np.hanning(len(s))
    b = bell(f * 1.5, 0.3, 14) * 0.5
    x[int(0.05 * SR): int(0.05 * SR) + len(b)] += b[: len(x) - int(0.05 * SR)]
    return norm(x)


def sfx_final_hit():
    d = 2.8
    t = t_axis(d)
    sub = np.sin(2 * np.pi * np.cumsum(32 + 70 * np.exp(-t * 6)) / SR) * np.exp(-t * 1.6)
    crack = lp(noise(d), 2500) * env_exp(d, 20) * 0.7
    ting = bell(1760, 2.0, 1.6) * 0.18
    x = sub + crack
    x[: len(ting)] += ting
    return reverb(norm(x), 2.6, 0.4, 2200)


def sfx_fountain(dur):
    t = t_axis(dur)
    trickle = bp(noise(dur), 900, 6500)
    am = lp(np.abs(noise(dur)), 18) * 4
    x = trickle * (0.5 + am)
    for _ in range(int(dur * 9)):
        st = rng.uniform(0, dur - 0.1)
        f0 = rng.uniform(700, 1800)
        s, _ = sweep(f0, f0 * 1.9, 0.03)
        i = int(st * SR)
        x[i: i + len(s)] += s * np.hanning(len(s)) * 0.5
    e = np.clip(t / 0.2, 0, 1) * np.clip((dur - t) / 0.4, 0, 1)
    return norm(x * e)


def sfx_radio():
    d = 0.6
    x = bp(noise(d), 500, 3200) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 9 * t_axis(d))))
    x[: int(0.03 * SR)] *= 3
    return norm(x * np.hanning(len(x)) ** 0.3)


SFX = {
    "siren_chirp": sfx_siren_chirp, "low_hit": sfx_low_hit, "rewind": lambda: sfx_whirr(0.8, False),
    "ffwd": lambda: sfx_whirr(0.6, True), "buzz": sfx_buzz, "ding": sfx_ding, "snore": sfx_snore,
    "pop": sfx_pop, "stamp_soft": lambda: sfx_stamp(False), "stamp": lambda: sfx_stamp(True), "chair": sfx_chair,
    "door_slam": sfx_door_slam, "splash": sfx_splash, "slam_table": sfx_slam_table, "whoosh": sfx_whoosh,
    "beep": sfx_beep, "bloop": sfx_bloop, "lock": sfx_lock, "gasp": sfx_gasp, "squeak": sfx_squeak,
    "rec_beep": sfx_rec_beep, "btn_blue": lambda: sfx_btn(880), "btn_red": lambda: sfx_btn(660),
    "final_hit": sfx_final_hit,
}
SFX_DUR = {"steps_at": sfx_steps, "cctv": sfx_cctv, "heartbeat": sfx_heartbeat, "fountain": sfx_fountain}


# ---------------------------------------------------------------- music / ambience bed
def music_bed(total, vo_env):
    t = t_axis(total)
    n = len(t)
    out = np.zeros((n, 2))

    def saw_voice(f, det=0.004):
        v = np.zeros(n)
        for d in (-det, 0, det):
            v += signal.sawtooth(2 * np.pi * f * (1 + d) * t + rng.uniform(0, 6))
        return v / 3

    # dark D-minor pad, filtered; swells per scene
    chord_a = [73.42, 110.0, 174.61]          # D2 A2 F3
    chord_b = [65.41, 98.0, 155.56]           # C2 G2 Eb3 (darker, later)
    pad = np.zeros(n)
    for f in chord_a:
        pad += saw_voice(f)
    pad_b = np.zeros(n)
    for f in chord_b:
        pad_b += saw_voice(f)
    xf = np.clip((t - 45) / 6, 0, 1)
    pad = pad * (1 - xf) + pad_b * xf
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t)
    pad = lp(pad, 520) * (0.7 + 0.3 * lfo)
    level = np.interp(t, [0, 4.6, 5.0, 11.6, 12.2, 18, 28, 40.6, 45.3, 53.6, 62.5, 67.2, 68.0, 71.5],
                      [0.5, 0.55, 0.25, 0.3, 0.45, 0.55, 0.7, 0.6, 0.75, 0.85, 1.0, 1.0, 0.8, 0.0])
    pad *= level
    # sub pulse ("ticking clock") during the interrogation
    pulse = np.zeros(n)
    beat = 60 / 100
    k = 0
    while k * beat < total:
        st = k * beat
        if 28.0 < st < 67.2 and not (40.7 < st < 45.3):
            d = 0.18
            tt = t_axis(d)
            b = np.sin(2 * np.pi * np.cumsum(55 + 30 * np.exp(-tt * 40)) / SR) * env_exp(d, 22, 0.004)
            i = int(st * SR)
            pulse[i: i + len(b)] += b * (0.6 if k % 4 else 1.0)
        k += 1
    pulse *= np.interp(t, [28, 40, 53.6, 62.5, 67.2, 67.9], [0.3, 0.45, 0.6, 0.9, 1.0, 0.0])
    # riser into the final hit
    rise = np.zeros(n)
    i0, i1 = int(62.6 * SR), int(68.0 * SR)
    tt = t_axis((i1 - i0) / SR)
    rs, _ = sweep(110, 880, len(tt) / SR)
    rise_seg = (rs * 0.25 + bp(noise(len(tt) / SR), 1500, 7000) * 0.5) * (tt / tt[-1]) ** 2
    rise[i0: i0 + len(rise_seg)] = rise_seg
    # ambience: night city rumble / room tone / fluorescent hum
    rumble = lp(noise(total), 180) * np.interp(t, [0, 4.8, 5.0], [1, 1, 0.15])
    hum = sum(np.sin(2 * np.pi * 120 * k2 * t) / k2 for k2 in (1, 2, 3)) * np.interp(t, [11.6, 12.0, 67.5, 70], [0, 1, 1, 0]) * 0.08
    mono = pad * 0.55 + pulse * 0.5 + rise * 0.6 + norm(rumble) * 0.18 + hum
    # gentle ducking under the voice
    duck = 1 - 0.35 * np.clip(vo_env, 0, 1)
    mono *= duck
    width = lp(saw_voice(146.83, 0.007), 480) * level * 0.12 * duck
    out[:, 0] = mono + width
    out[:, 1] = mono - width
    return out


# ---------------------------------------------------------------- loudness calibration
METER = None


def momentary_max(x):
    """Max momentary (400 ms) loudness in LUFS of a mono signal."""
    global METER
    if METER is None:
        METER = pyln.Meter(SR, block_size=0.4)
    x = np.asarray(x, dtype=np.float64)
    if len(x) < int(0.4 * SR):
        x = np.pad(x, (0, int(0.4 * SR) - len(x)))
    # K-weight once, then slide a 400 ms window
    kw = x.copy()
    for f in METER._filters.values():
        kw = f.apply_filter(kw)
    win = int(0.4 * SR)
    hop = int(0.05 * SR)
    sq = np.concatenate([[0.0], np.cumsum(kw ** 2)])
    best = 1e-12
    for i in range(0, len(kw) - win + 1, hop):
        best = max(best, (sq[i + win] - sq[i]) / win)
    return -0.691 + 10 * np.log10(best)


# loudness of each effect's loudest 400 ms, in dB relative to the voice's integrated loudness
TARGET_DB = {
    "low_hit": -3, "door_slam": -2, "slam_table": -1, "stamp": -1, "stamp_soft": -8, "final_hit": 0,
    "whoosh": -11, "rewind": -6, "ffwd": -6, "siren_chirp": -9,
    "buzz": -8, "ding": -7, "pop": -13, "beep": -11, "rec_beep": -13, "btn_blue": -7, "btn_red": -7,
    "chair": -15, "squeak": -9, "lock": -9, "gasp": -6, "bloop": -10, "splash": -7, "snore": -11,
    "steps_at": -19, "cctv": -22, "heartbeat": -13, "fountain": -18, "radio": -16,
}


# ---------------------------------------------------------------- mix
def main():
    script = json.loads((ROOT / "data/script.json").read_text())
    total = float(script["duration"])
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(ROOT / "assets/voiceover.mp3"), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    vo = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    vo = pad_to(vo, total)
    # voice envelope for ducking (smoothed)
    env = np.abs(vo)
    env = lp(env, 4) * 8
    mix = np.zeros((int(total * SR), 2))
    vo_peak = np.max(np.abs(vo))

    vo_lufs = pyln.Meter(SR).integrated_loudness(vo)
    print(f"voice integrated loudness: {vo_lufs:.1f} LUFS")

    def place(x, at, gain, pan=0.0, name=None):
        x = np.asarray(x, dtype=np.float64)
        if name in TARGET_DB:
            cur = momentary_max(x)
            x = x * 10 ** ((vo_lufs + TARGET_DB[name] - cur) / 20)
        x = x * gain
        i = int(at * SR)
        j = min(len(mix), i + len(x))
        if j <= i:
            return
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        mix[i:j, 0] += x[: j - i] * l * 1.41
        mix[i:j, 1] += x[: j - i] * r * 1.41

    pans = {"buzz": -0.25, "splash": -0.2, "squeak": 0.35, "btn_blue": -0.35, "btn_red": 0.35, "door_slam": -0.3}
    for cue in script["sfx"]:
        name, at, gain = cue[0], float(cue[1]), float(cue[2])
        if name in SFX_DUR:
            arg = cue[3]
            x = SFX_DUR[name](arg if isinstance(arg, list) else float(arg))
        else:
            x = SFX[name]()
        place(x, at, gain, pans.get(name, 0.0), name)
    # little extras: police radio squelches in the cold open
    place(sfx_radio(), 1.25, 1.0, 0.4, "radio")
    place(sfx_radio(), 3.1, 0.8, 0.4, "radio")
    bed = music_bed(total, np.clip(env / (np.max(env) + 1e-9) * 2.5, 0, 1))
    bed_lufs = pyln.Meter(SR).integrated_loudness(bed.mean(axis=1))
    bed = bed * 10 ** ((vo_lufs - 14 - bed_lufs) / 20)
    stems = os.environ.get("STEMS")
    if stems:
        from scipy.io import wavfile as _wf
        for nm, arr in (("vo", vo), ("sfx", mix.mean(axis=1)), ("bed", bed.mean(axis=1))):
            _wf.write(f"{stems}/{nm}.wav", SR, (np.clip(arr, -1, 1) * 32767).astype(np.int16))
    mix += bed
    mix[:, 0] += vo
    mix[:, 1] += vo
    # soft fade at the very end
    fade = np.clip((total - t_axis(total)) / 1.2, 0, 1)
    mix *= fade[:, None]
    mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.89
    out = ROOT / "assets/final_mix_raw.wav"
    from scipy.io import wavfile
    wavfile.write(out, SR, (mix * 32767).astype(np.int16))
    # loudness normalize for social video (-14 LUFS, -1.5 dBTP)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR),
                    str(ROOT / "assets/final_mix.wav")], check=True)
    out.unlink()
    print("wrote assets/final_mix.wav")


if __name__ == "__main__":
    main()
