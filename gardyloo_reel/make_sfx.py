#!/usr/bin/env python3
"""Sound effects for the Gardyloo reel -> audio/sfx/*.wav + audio/sfx_cues.json (read by mix.py).

Same method as wedding_reel/make_sfx.py. Two sources:
  * ElevenLabs sound effects (audio/sfx_src/<name>_<k>.mp3, flow m6lzKCnri8LVCEdi7Ua7, 2 takes each; the take
    used is in TAKES): doorbell, failed flush, water gurgle, heavenly choir, paper rustle, splat, western music.
  * code-made (numpy, fixed seeds): flush clicks, whooshes, slide whistle, the scream, ducking thud, the
    medieval lute + flute tune, crowd panic, record scratch, cutlery clinks, clock ticks, fly buzz, water drip,
    heartbeat, crow, crickets, dog bark, birds, wind, footsteps, door creak, sad trombone, sparkles.
Every cue is placed on a word of the voiceover (audio/word_onsets.json) or a shot cut (shots.json).
All effects sit under the voice (mix.py ducks them while the narrator speaks).
Usage: python3 make_sfx.py
"""
import json
import os
import subprocess

import numpy as np
import soundfile as sf

import audiolib as A
from audiolib import SR, add_at, att, bp, cosramp, hp, lp, n_, place, rms, rng, save, tt

HERE = A.HERE
P = lambda *a: os.path.join(HERE, *a)
SRC = P("audio", "sfx_src")
WORDS = json.load(open(P("audio", "word_onsets.json")))
VO = json.load(open(P("audio", "vo_lines.json")))
SHOTS = {s["id"]: s for s in json.load(open(P("shots.json")))["shots"]}
DUR = json.load(open(P("shots.json")))["duration"]

# ElevenLabs take chosen for each sound (cleanest / loudest take of the two)
TAKES = {"doorbell": "doorbell_1", "flushfail": "flushfail_1", "gurgle": "gurgle_1", "gurgle_b": "gurgle_2",
         "choir": "choir_2", "paper": "paper_1", "splat": "splat_1", "western": "western_1",
         "western_b": "western_2"}


def word(line, idx=0):
    ws = [w for w in WORDS if w["line"] == line]
    return ws[idx]["s"]


def line_span(i):
    l = VO["lines"][i - 1]
    return l["start"], l["end"]


def shot(i):
    return SHOTS[i]["t0"], SHOTS[i]["t1"]


def load(name, trim=True):
    """ElevenLabs take -> float stereo 48 kHz, leading silence trimmed (keeps 5 ms)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(SRC, TAKES.get(name, name) + ".mp3"),
                          "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
    if trim:
        env = np.abs(x).max(axis=1)
        thr = env.max() * 10 ** (-40 / 20)
        i0 = max(0, int(np.argmax(env > thr)) - n_(0.005))
        x = x[i0:]
    return x


def fade(x, fi=0.005, fo=0.05):
    x = x.copy()
    a, b = n_(fi), n_(fo)
    if a:
        x[:a] *= cosramp(a)[:, None]
    if b:
        x[-b:] *= cosramp(b)[::-1][:, None]
    return x


def seg(x, t0, t1, fi=0.005, fo=0.05):
    return fade(x[n_(t0):n_(t1)], fi, fo)


def stereo(x):
    return x if x.ndim == 2 else np.stack([x, x], 1)


def pitch(x, semis):
    """Resample-pitch (speed changes with it): for drum / sting variations."""
    from scipy.signal import resample_poly
    r = 2 ** (semis / 12)
    up, down = 1000, int(round(1000 * r))
    return resample_poly(x, up, down, axis=0)


# --------------------------------------------------------------------------------------------- code-made
def mk_whoosh(d=0.45, f0=500, f1=3200, seed=1):
    r = rng(seed)
    t = tt(d)
    pk = d * 0.7
    fc = np.where(t < pk, f0 * (f1 / f0) ** (t / pk), f1)
    y = A.svf(lp(r.standard_normal(len(t)), 7000), fc, q=1.4)
    env = np.where(t < pk, (t / pk) ** 2.5, np.exp(-(t - pk) / 0.05))
    return place(y * env, 0, "room", -14)


def mk_ding():
    y = A.modal([(1568, 1.0, 0.5), (3136, 0.1, 0.25), (1568 * 2.76, 0.12, 0.16), (1568 * 5.4, 0.05, 0.05)],
                1.6, seed=901, strike=0.05, strike_tau=0.0008, strike_hp=4000, beat=0.0012, twin=0.12)
    return place(hp(y, 400), 0, "room", -16)


def mk_sparkle():
    r = rng(5)
    out = np.zeros(n_(1.0))
    for k, f in enumerate([2637, 3136, 3951, 4699]):
        y = A.modal([(f, 1.0, 0.18), (f * 2.01, 0.2, 0.08)], 0.9, seed=10 + k, strike=0.02)
        add_at(out, y * 0.6, 0.05 * k + r.uniform(0, 0.01))
    return place(hp(out, 1500), 0, "room", -12)


def mk_womp():
    """Sad 'wah-waaah' (muted trombone-ish): two falling notes with a wah filter."""
    d = 1.3
    t = tt(d)
    f = np.where(t < 0.42, 233 * (1 - 0.02 * t), 220 * (196 / 220) ** np.clip((t - 0.45) / 0.8, 0, 1))
    f = f * (1 + 0.012 * np.sin(2 * np.pi * 5.5 * t) * att(t - 0.6, 0.2))
    src = A.saw(f)
    wah = 500 + 900 * (0.5 + 0.5 * np.sin(2 * np.pi * np.where(t < 0.42, 2.4, 1.2) * t - 1.5))
    y = A.svf(src, wah, q=2.5, mode="bp")
    env = att(t, 0.03) * (1 - 0.85 * att(t - 0.38, 0.05) * (1 - att(t - 0.45, 0.04))) * (1 - att(t - 1.0, 0.3))
    return place(lp(y * env, 3500), 0, "room", -14)


def mk_blink():
    t = tt(0.06)
    f = 2400 * (1 - 0.5 * t / 0.06)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.012)
    return place(y, 0)


def mk_heartbeat():
    out = np.zeros(n_(0.6))
    for t0, a in ((0.0, 1.0), (0.18, 0.7)):
        t = tt(0.25)
        f = 55 * (1 + 0.6 * np.exp(-t / 0.02))
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * att(t, 0.004) * np.exp(-t / 0.07)
        add_at(out, y * a, t0)
    return place(lp(out, 300), 0)


def mk_drip():
    y = A.bubble(1400, 0.012, rise=1.2, amp=1.0)
    return place(np.concatenate([y, np.zeros(n_(0.3))]), 0, "small", -8)


def mk_pad(d=2.2):
    """Soft calm documentary pad (A major add9, slow swell): the twist 'What you don't know'."""
    t = tt(d)
    y = np.zeros(len(t))
    for f, a in [(220, 1.0), (277.2, 0.6), (329.6, 0.7), (493.9, 0.35), (440, 0.4)]:
        for det in (-4, 4):
            y += a * np.sin(2 * np.pi * f * 2 ** (det / 1200) * t + det)
    y = lp(y, 1800) * att(t, 0.5) * (1 - att(t - (d - 0.8), 0.8))
    return place(y, 0, "hall", -10)


def mk_boom():
    t = tt(1.2)
    f = 38 + 50 * np.exp(-t / 0.04)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * att(t, 0.003) * np.exp(-t / 0.35)
    y += lp(rng(3).standard_normal(len(t)), 300) * np.exp(-t / 0.05) * 0.5
    return place(y, 0, "hall", -12)


def mk_pop():
    r = rng(4)
    t = tt(0.25)
    y = bp(r.standard_normal(len(t)), 800, 6000) * att(t, 0.001) * np.exp(-t / 0.02)
    return place(y, 0, "room", -12)



# --------------------------------------------------------------------------------------------- new code-made
def stretch(x, factor):
    """Time-stretch (rubberband, same pitch) a stereo float buffer."""
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        sf.write(a, x, SR, subtype="FLOAT")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a, "-af",
                        f"rubberband=tempo={1 / factor:.4f}:transients=smooth", b], check=True)
        y, _ = sf.read(b, dtype="float64", always_2d=True)
    return y


def loop_to(x, d, xf=0.25):
    """Repeat a stereo buffer with crossfades until it is d seconds long."""
    out = x.copy()
    k = n_(xf)
    while len(out) < n_(d):
        r = cosramp(k)[:, None]
        out = np.concatenate([out[:-k], out[-k:] * (1 - r) + x[:k] * r, x[k:]])
    return out[:n_(d)]


def mk_click(f=2600, seed=1):
    t = tt(0.05)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.004) + hp(rng(seed).standard_normal(len(t)), 3000) * np.exp(-t / 0.0015)
    return place(y * 0.8, 0, "small", -12)


def mk_tick(tock=False):
    t = tt(0.12)
    f = 1900 if tock else 2500
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.006) + 0.5 * hp(rng(7 + tock).standard_normal(len(t)), 2500) * np.exp(-t / 0.002)
    y += 0.4 * np.sin(2 * np.pi * 800 * t) * np.exp(-t / 0.015)
    return place(y, 0, "room", -16)


def mk_thud():
    t = tt(0.6)
    f = 70 + 60 * np.exp(-t / 0.03)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)
    y += lp(rng(11).standard_normal(len(t)), 500) * np.exp(-t / 0.03) * 0.8
    return place(y, 0, "small", -10)


def mk_slide_whistle(d=1.6, f0=1900, f1=500):
    t = tt(d)
    f = f0 * (f1 / f0) ** (t / d)
    f = f * (1 + 0.015 * np.sin(2 * np.pi * 6 * t))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.15 * hp(rng(3).standard_normal(len(t)), 3000)
    env = att(t, 0.05) * (1 - att(t - (d - 0.4), 0.4))
    return place(lp(y * env, 5000) * 0.6, 0, "room", -16)


def mk_scream(d=1.25):
    """Comedic man's scream 'AAAAH!': sawtooth voice through vowel formants, pitch jumps up, wobbles, falls."""
    t = tt(d)
    f = 280 + 260 * att(t, 0.08) - 140 * att(t - 0.8, 0.45)
    f = f * (1 + 0.035 * np.sin(2 * np.pi * 7.5 * t) + 0.01 * rng(5).standard_normal(len(t)).cumsum() / np.sqrt(SR * 2))
    src = A.saw(f) + 0.12 * rng(6).standard_normal(len(t))
    y = sum(g * A.svf(src, fc, q=q, mode="bp") for fc, q, g in ((850, 6, 1.0), (1250, 7, 0.7), (2900, 8, 0.35), (3600, 9, 0.2)))
    env = att(t, 0.04) * (1 - att(t - (d - 0.35), 0.35))
    return place(hp(y * env, 150), 0.25, "hall", -12)


def pluck(f, d=1.2, seed=0, bright=0.5):
    """Karplus-Strong plucked string (lute)."""
    r = rng(seed)
    N = int(SR / f)
    buf = r.uniform(-1, 1, N)
    buf = lp(buf, 1500 + 6000 * bright)
    out = np.zeros(n_(d))
    for i in range(len(out)):
        out[i] = buf[i % N]
        buf[i % N] = 0.996 * 0.5 * (buf[i % N] + buf[(i + 1) % N])
    return out * (1 - att(tt(d) - (d - 0.15), 0.15))


def mk_medieval(d=8.6):
    """Cheerful old-folk tune: lute plucks + wooden flute melody + a soft drone (D dorian)."""
    bpm = 132
    beat = 60 / bpm
    out = np.zeros(n_(d + 1.5))
    D = 146.83
    scale = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15]
    lute = [0, 4, 2, 4, 0, 4, 2, 4, 1, 5, 3, 5, 1, 5, 3, 5]
    k = 0
    while k * beat / 2 < d:
        deg = lute[k % len(lute)]
        add_at(out, 0.5 * pluck(D * 2 ** (scale[deg] / 12), 0.9, seed=k, bright=0.4), k * beat / 2)
        k += 1
    mel = [(7, 1), (8, 1), (9, 2), (8, 1), (7, 1), (5, 2), (7, 1), (5, 1), (3, 1), (2, 1), (0, 4),
           (4, 1), (5, 1), (7, 2), (9, 1), (7, 1), (5, 2), (3, 1), (2, 1), (0, 4)]
    tcur = 0.0
    for deg, ln in mel:
        dd = ln * beat
        tn = tt(dd * 0.95)
        f = 2 * D * 2 ** (scale[deg] / 12) * (1 + 0.008 * np.sin(2 * np.pi * 5.2 * tn))
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.12 * np.sin(4 * np.pi * np.cumsum(f) / SR)
        y += 0.05 * bp(rng(int(tcur * 100)).standard_normal(len(tn)), 1500, 5000)
        y *= att(tn, 0.03) * (1 - att(tn - (dd * 0.95 - 0.06), 0.06))
        add_at(out, 0.35 * y, tcur)
        tcur += dd
        if tcur > d:
            break
    tdr = tt(len(out) / SR)
    drone = 0.08 * (np.sin(2 * np.pi * D / 2 * tdr) + 0.5 * np.sin(2 * np.pi * D * 3 / 4 * tdr))
    out += lp(drone, 800)
    out = out[:n_(d)] * (1 - att(tt(d) - (d - 0.4), 0.4))
    return place(out, 0, "hall", -16)


def mk_crowd(d=1.8):
    """Small crowd of people yelling 'aaah!' and running (formant noise voices + footsteps)."""
    out = np.zeros(n_(d))
    for k in range(6):
        r = rng(40 + k)
        dd = r.uniform(0.6, 1.1)
        t = tt(dd)
        f = r.uniform(180, 420) * (1 + 0.3 * att(t, 0.1)) * (1 + 0.03 * np.sin(2 * np.pi * r.uniform(5, 8) * t))
        src = A.saw(f) + 0.2 * r.standard_normal(len(t))
        y = A.svf(src, r.uniform(700, 1000), q=5, mode="bp") + 0.6 * A.svf(src, r.uniform(1100, 1500), q=6, mode="bp")
        add_at(out, y * att(t, 0.05) * (1 - att(t - (dd - 0.25), 0.25)) * r.uniform(0.4, 0.8), r.uniform(0, d - dd))
    for k in range(int(d / 0.11)):
        tk = tt(0.06)
        add_at(out, 0.3 * lp(rng(80 + k).standard_normal(len(tk)), 900) * np.exp(-tk / 0.012), k * 0.11 + rng(k).uniform(0, 0.03))
    return place(lp(out, 4000), 0, "hall", -10)


def mk_scratch():
    t = tt(0.45)
    f = 900 * (1 + 0.8 * np.sin(2 * np.pi * 3.5 * t)) * (1 - 0.6 * t / 0.45)
    y = A.svf(rng(9).standard_normal(len(t)), f, q=4, mode="bp") * 2 + 0.3 * A.saw(f / 4)
    return place(y * (1 - att(t - 0.35, 0.1)), 0, "room", -14)


def mk_clinks(d=6.0, seed=20):
    out = np.zeros(n_(d))
    r = rng(seed)
    t = 0.3
    while t < d - 0.4:
        f = r.uniform(2800, 4800)
        y = A.modal([(f, 1.0, 0.12), (f * 2.7, 0.3, 0.05)], 0.4, seed=int(t * 50), strike=0.1)
        add_at(out, y * r.uniform(0.2, 0.6), t)
        t += r.uniform(0.35, 1.1)
    return place(out, 0, "room", -12)


def mk_fly(d=1.6, seed=3):
    t = tt(d)
    r = rng(seed)
    f = 210 * (1 + 0.08 * np.sin(2 * np.pi * 1.3 * t + 1) + 0.04 * np.sin(2 * np.pi * 3.7 * t))
    y = A.saw(f) * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * t)) + 0.1 * r.standard_normal(len(t))
    y = bp(y, 180, 3000)
    pan = np.sin(2 * np.pi * 0.7 * t)
    env = att(t, 0.25) * (1 - att(t - (d - 0.35), 0.35)) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.9 * t + 0.5) ** 2)
    st = np.stack([y * env * (1 - 0.6 * pan), y * env * (1 + 0.6 * pan)], 1) * 0.5
    return st


def mk_drip_loud():
    y = A.bubble(1100, 0.018, rise=1.4, amp=1.0, harm=0.2)
    return place(np.concatenate([y, np.zeros(n_(0.4))]), 0, "small", -6)


def mk_crow():
    out = np.zeros(n_(0.9))
    for k, t0 in enumerate((0.0, 0.32)):
        t = tt(0.26)
        f = 520 - 120 * t / 0.26
        src = A.saw(f) * (1 + 0.5 * rng(k).standard_normal(len(t)))
        y = A.svf(src, 1200, q=3, mode="bp") * att(t, 0.01) * (1 - att(t - 0.18, 0.08))
        add_at(out, y, t0)
    return place(out, -0.4, "hall", -8)


def mk_crickets(d=3.0):
    t = tt(d)
    out = np.zeros(len(t))
    for k, (f, rate, ph) in enumerate(((4300, 3.1, 0.0), (4700, 2.6, 1.3), (3900, 3.6, 2.1))):
        chirp = (np.sin(2 * np.pi * rate * t + ph) > 0.55).astype(float)
        chirp = lp(chirp, 60)
        pulses = 0.5 + 0.5 * np.sin(2 * np.pi * 32 * t)
        out += np.sin(2 * np.pi * f * t) * chirp * pulses * (0.5 - 0.1 * k)
    return place(out * att(t, 0.4) * (1 - att(t - (d - 0.6), 0.6)), 0, "hall", -10)


def mk_bark():
    out = np.zeros(n_(0.5))
    t = tt(0.16)
    f = 520 * (1 - 0.35 * t / 0.16)
    src = A.saw(f) + 0.4 * rng(12).standard_normal(len(t))
    y = A.svf(src, 900, q=3, mode="bp") * att(t, 0.01) * np.exp(-t / 0.06)
    add_at(out, y, 0.0)
    return place(lp(out, 2500) * 0.7, 0.5, "hall", -6)


def mk_birds(d=3.6):
    out = np.zeros(n_(d))
    r = rng(30)
    t0 = 0.2
    while t0 < d - 0.4:
        dd = r.uniform(0.08, 0.2)
        t = tt(dd)
        f0 = r.uniform(2800, 4200)
        f = f0 * (1 + r.uniform(-0.3, 0.4) * t / dd)
        add_at(out, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dd) * r.uniform(0.2, 0.5), t0)
        t0 += r.uniform(0.12, 0.6)
    return place(out, 0.3, "hall", -12)


def mk_wind(d=3.0, seed=50):
    t = tt(d)
    y = A.svf(rng(seed).standard_normal(len(t)), 500 + 250 * np.sin(2 * np.pi * 0.3 * t), q=0.8, mode="bp")
    return place(y * att(t, 0.6) * (1 - att(t - (d - 0.8), 0.8)) * 0.6, 0, None)


def mk_drone(d=3.0, f=55):
    t = tt(d)
    y = A.saw(np.full(len(t), f)) + 0.6 * A.saw(np.full(len(t), f * 1.498))
    y = A.svf(y, 400 + 300 * att(t, d), q=0.7, mode="lp") * att(t, 0.5) * (1 - att(t - (d - 0.5), 0.5))
    return place(y * 0.6, 0, "hall", -12)


def mk_gulp():
    t = tt(0.25)
    f = 180 + 300 * att(t - 0.05, 0.1)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-((t - 0.1) / 0.06) ** 2)
    b = A.bubble(600, 0.01, rise=1.5)[:len(t)]
    y[:len(b)] += 0.3 * b
    return place(lp(y, 2000), 0, "small", -14)


def mk_steps(n=4, every=0.32, seed=60):
    out = np.zeros(n_(n * every + 0.3))
    for k in range(n):
        t = tt(0.12)
        y = lp(rng(seed + k).standard_normal(len(t)), 700) * np.exp(-t / 0.018) + 0.5 * np.sin(2 * np.pi * 110 * t) * np.exp(-t / 0.03)
        add_at(out, y, k * every)
    return place(out, 0, "room", -12)


def mk_creak(d=0.7):
    t = tt(d)
    f = 320 + 120 * np.sin(2 * np.pi * 1.4 * t)
    pulses = (np.sin(2 * np.pi * np.cumsum(f / 6) / SR) > 0.97).astype(float)
    y = A.svf(lp(pulses, 6000) + 0.02 * rng(8).standard_normal(len(t)), 900, q=5, mode="bp")
    return place(y * att(t, 0.05) * (1 - att(t - (d - 0.15), 0.15)) * 3, 0.3, "room", -12)


def mk_squeak():
    t = tt(0.35)
    f = 1500 + 600 * np.sin(2 * np.pi * 2.5 * t)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * rng(4).standard_normal(len(t))) * att(t, 0.03) * (1 - att(t - 0.25, 0.1))
    return place(bp(y, 800, 4000) * 0.4, 0, "small", -12)


def build():
    cues = []

    def cue(name, x, t, gain_db, note, level=A.REF_LUFS, by="mmax", **kw):
        save(name, x, level=level, by=by)
        cues.append(dict(t=round(float(t), 3), file=f"audio/sfx/{name}.wav", gain_db=gain_db, note=note, **kw))

    # --- arrival
    cue("doorbell", seg(load("doorbell"), 0, 1.9, fo=0.3), 0.02, -9.0, "doorbell ding-dong at the start", duck_db=3)
    cue("birds", mk_birds(shot(3)[0]), 0.0, -22.0, "soft evening birds outside", by="int", duck_db=4)
    cue("gulp", mk_gulp(), shot(2)[0] + 0.45, -12.0, "nervous gulp")
    cue("steps", mk_steps(4), shot(3)[0] + 0.05, -15.0, "polite footsteps in the hallway")
    cue("creak", mk_creak(), shot(3)[1] - 0.6, -16.0, "bathroom door creak")
    cue("whoosh_poop", mk_whoosh(0.32, seed=2), word(4, 1) - 0.28, -16.0, "punch-in on 'poop'")
    # --- flushing
    fl = load("flushfail")
    cue("click_1", mk_click(2600, 1), word(5, 1) + 0.05, -8.0, "flush button click", duck_db=2)
    cue("drip", mk_drip(), shot(6)[0] + 0.35, -14.0, "tiny drip in the silence")
    cue("click_2", mk_click(2400, 2), word(7, 1) - 0.02, -8.0, "click", duck_db=2)
    cue("click_3", mk_click(2800, 3), word(7, 1) + 0.16, -8.0, "click (again, harder)", duck_db=2)
    cue("flushfail", seg(fl, 0.2, 1.9, fo=0.4), word(7, 2) + 0.1, -13.0, "weak sad gurgle, no flush", duck_db=3)
    cue("blink", mk_blink(), shot(8)[0] + 0.35, -16.0, "deadpan blink")
    g = np.concatenate([load("gurgle"), load("gurgle_b")])
    g = stretch(g, 1.6)
    cue("gurgle", fade(g[:n_(2.0)], 0.02, 0.4), shot(9)[0] + 0.02, -9.0, "water rising: deep gurgle", duck_db=3)
    cue("heart_1", mk_heartbeat(), shot(10)[0] + 0.02, -8.0, "panic heartbeat")
    cue("heart_2", mk_heartbeat(), shot(10)[0] + 0.46, -8.0, "heartbeat")
    # --- the window
    cue("shimmer", mk_sparkle(), shot(11)[0] + 0.5, -16.0, "light shimmer as he looks up")
    ch = stretch(load("choir"), 2.6)
    cue("choir", fade(ch, 0.05, 0.6), shot(12)[0] - 0.05, -6.0, "heavenly choir 'aaaah'", duck_db=2)
    cue("paper", seg(load("paper"), 0.0, 1.9, fo=0.3), shot(13)[0] + 0.05, -12.0, "toilet paper rustling", duck_db=3)
    cue("sparkle_gift", mk_sparkle(), shot(14)[0] + 0.35, -14.0, "the little gift sparkles")
    cue("ribbon", mk_whoosh(0.22, 1500, 5000, seed=4), word(15, 3) - 0.15, -18.0, "ribbon swish")
    cue("ding_bow", mk_ding(), word(15, 4) + 0.05, -14.0, "cute ding on 'bow'")
    cue("squeak", mk_squeak(), shot(16)[0] + 0.25, -14.0, "window squeak")
    cue("wind", mk_wind(shot(17)[0] - shot(16)[0] + 0.3), shot(16)[0] + 0.2, -20.0, "evening breeze", by="int")
    # --- the throw
    cue("windup", mk_whoosh(1.0, 200, 1400, seed=5), shot(17)[0] + 0.05, -12.0, "slow-motion wind-up whoosh")
    cue("throw", mk_whoosh(0.5, 400, 3600, seed=6), shot(18)[0] - 0.22, -8.0, "big THROW whoosh", duck_db=2)
    cue("whistle", mk_slide_whistle(2.6, 1900, 420), shot(18)[0] + 0.35, -16.0, "long falling whistle")
    # --- splat + scream (black screen)
    cue("splat", seg(load("splat"), 0, 1.0, fo=0.2), shot(20)[0] + 0.0, -4.0, "SPLAT on the cut to black", duck_db=0)
    cue("scream", mk_scream(), line_span(21)[1] + 0.03, -6.0, "the dad's scream", duck_db=0)
    # --- the dad
    cue("wind_2", mk_wind(3.0, 51), shot(21)[0], -22.0, "outside wind", by="int")
    cue("drone", mk_drone(shot(25)[0] - shot(22)[0], 55), shot(22)[0], -17.0, "tense low drone", by="int", duck_db=4)
    cue("womp", mk_womp(), word(26, 0) - 0.05, -15.0, "sad trombone on 'His best suit'", duck_db=4)
    cue("crow", mk_crow(), shot(24)[0] + 0.55, -14.0, "crow caw as he looks up")
    cue("thud", mk_thud(), word(28, 1) - 0.08, -7.0, "ducking THUD", duck_db=1)
    # --- old Edinburgh
    med_t0 = shot(26)[0]
    med_t1 = shot(30)[0]
    cue("medieval", mk_medieval(med_t1 - med_t0 + 0.05), med_t0, -15.0, "old medieval lute + flute music",
        by="int", duck_db=5)
    cue("bucket", mk_whoosh(0.4, 300, 1800, seed=7), shot(27)[0] + 0.45, -16.0, "bucket swoosh")
    cue("crowd", mk_crowd(1.9), shot(29)[0] + 0.05, -14.0, "people below panic and run", duck_db=4)
    cue("scratch", mk_scratch(), shot(30)[0] - 0.02, -9.0, "record scratch back to now", duck_db=1)
    # --- dinner
    cue("clinks", mk_clinks(shot(33)[0] - shot(31)[0] + 0.5), shot(31)[0] + 0.05, -16.0, "cutlery clinks",
        by="int", duck_db=4)
    cue("drip_loud", mk_drip_loud(), shot(32)[0] + 0.55, -9.0, "loud water drip from his wet hair", duck_db=2)
    w1 = load("western", trim=False)
    w_t0, w_t1 = shot(33)[0], shot(38)[0]
    wb = fade(loop_to(w1, w_t1 - w_t0 + 0.3, 0.35), 0.4, 0.3)
    cue("western", wb, w_t0, -15.0, "tense western standoff music", by="int", duck_db=5)
    # clock: soft ticks through dinner, LOUD ticks in the awkward pause, silence under the whisper,
    # then ticks again over the family freeze
    ticks = []
    t = shot(31)[0] + 0.5
    while t < shot(37)[0] - 0.3:
        ticks.append((t, -18.0, 3, "clock tick"))
        t += 1.0
    for dt in (0.08, 0.72):
        ticks.append((shot(37)[0] + dt, -9.0, 0, "LOUD clock tick (the awkward pause)"))
    for dt in (0.25, 0.95, 1.65):
        ticks.append((shot(39)[0] + dt, -12.0, 0, "clock tick over the family freeze"))
    for k, (t, g, dk, note) in enumerate(ticks):
        cue(f"tick_{k:02d}", mk_tick(k % 2 == 1), t, g, note, duck_db=dk)
    cue("fly_1", mk_fly(1.7, 3), shot(35)[0] + 0.1, -13.0, "fly buzzing past", duck_db=3)
    cue("fly_2", mk_fly(1.1, 4), shot(36)[0] + 0.05, -12.0, "fly lands on the mustache", duck_db=3)
    # --- ending
    cue("crickets", mk_crickets(DUR - shot(40)[0]), shot(40)[0], -14.0, "night crickets", by="int")
    cue("bark", mk_bark(), shot(40)[0] + 1.1, -16.0, "a dog barks once far away")

    cues.sort(key=lambda c: c["t"])
    json.dump(cues, open(P("audio", "sfx_cues.json"), "w"), indent=1)
    for c in cues:
        info = A.INFO[os.path.splitext(os.path.basename(c["file"]))[0]]
        print(f"{c['t']:6.2f}  {os.path.basename(c['file']):20s} {c['gain_db']:+5.1f} dB  {info['dur']:5.2f}s  "
              f"{c['note']}")
    print(f"{len(cues)} cues -> audio/sfx_cues.json")


if __name__ == "__main__":
    build()
