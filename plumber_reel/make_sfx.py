#!/usr/bin/env python3
"""Sound effects for the plumber reel -> audio/sfx/*.wav + audio/sfx_cues.json (read by mix.py).

Same method as gardyloo_reel/make_sfx.py. Sources:
  * three ElevenLabs sound effects made for the Gardyloo reel and reused here (audio/sfx_src/, no new credits):
    a weak flush, a water gurgle, a heavenly choir.
  * everything else is code-made (numpy, fixed seeds): straining grunt, light flicker buzz, picture rattle + fall,
    dun dun DUNNN, flush clicks, blink, horror sting, plunger squelch, wood creak + CRACK, knocks, phone dialing,
    van screech, heroic brass fanfare, drone, sad trumpet, projector rattle, music box, water spray, record
    scratch, museum footsteps, ding, murmur, measuring-tape zip, camera shutter + flash whine, piano, slow
    clapping into applause, heartbeat, clock ticks, tea slurp, fly buzz, birds.
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

# ElevenLabs takes reused from the Gardyloo reel
TAKES = {"flushfail": "flushfail_1", "flushweak": "flushfail_2", "gurgle": "gurgle_1", "gurgle_b": "gurgle_2",
         "choir": "choir_2"}


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


# --------------------------------------------------------------------------------------------- plumber sounds
def env_ad(t, a, d, total):
    return att(t, a) * (1 - att(t - (total - d), d))


def mk_grunt(d=2.7):
    """Straining 'nnnnggghhh': a strained low voice through nasal formants, getting louder and shakier."""
    t = tt(d)
    r = rng(71)
    f = 118 * (1 + 0.18 * t / d) * (1 + 0.03 * np.sin(2 * np.pi * 7 * t) * (t / d) + 0.006 * r.standard_normal(len(t)).cumsum() / np.sqrt(SR))
    src = A.saw(f) * (1 + 0.25 * np.sin(2 * np.pi * 13 * t) * (t / d)) + 0.15 * r.standard_normal(len(t)) * (t / d)
    y = A.svf(src, 260, q=4, mode="bp") + 0.6 * A.svf(src, 2300, q=6, mode="bp") + 0.35 * A.svf(src, 1100, q=5, mode="bp")
    y *= (0.35 + 0.65 * (t / d) ** 1.4) * env_ad(t, 0.12, 0.25, d)
    for k, tb in enumerate((0.75, 1.55)):       # two short breath catches
        y[n_(tb):n_(tb + 0.06)] *= np.linspace(1, 0.2, n_(tb + 0.06) - n_(tb))
        y[n_(tb + 0.06):n_(tb + 0.12)] *= np.linspace(0.2, 1, n_(tb + 0.12) - n_(tb + 0.06))
    return place(hp(y, 90), 0, "small", -14)


def mk_flicker(d=2.6, events=(0.3, 0.42, 0.9, 1.35, 1.42, 2.0)):
    """Fluorescent light buzz (100/200 Hz hum) that cuts out with little clicks on each flicker."""
    t = tt(d)
    hum = sum(a * np.sin(2 * np.pi * f * t) for f, a in ((100, 1), (200, 0.6), (300, 0.3), (500, 0.15)))
    hum = hum + 0.4 * bp(rng(5).standard_normal(len(t)), 2000, 6000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 100 * t)))
    gate = np.ones(len(t))
    out = np.zeros(len(t))
    for k, e in enumerate(events):
        a, b = n_(e), n_(e + 0.05 + 0.04 * (k % 2))
        gate[a:b] = 0.05
        ck = tt(0.02)
        c = hp(rng(10 + k).standard_normal(len(ck)), 3000) * np.exp(-ck / 0.002)
        add_at(out, c, e)
        add_at(out, c * 0.7, e + 0.05)
    gate = lp(gate, 200)
    y = hum * gate * 0.25 + out
    return place(y * env_ad(t, 0.05, 0.2, d), 0, "small", -16)


def mk_rattle(d=0.8, seed=12):
    """Picture frame rattling on the tiles: fast little wooden knocks."""
    out = np.zeros(n_(d + 0.3))
    r = rng(seed)
    t = 0.0
    k = 0
    while t < d:
        y = A.modal([(r.uniform(700, 900), 1.0, 0.03), (r.uniform(1700, 2100), 0.4, 0.02)], 0.12, seed=seed + k, strike=0.2)
        add_at(out, y * r.uniform(0.4, 1.0), t)
        t += r.uniform(0.04, 0.09)
        k += 1
    return place(out, -0.2, "small", -14)


def mk_crash():
    """Frame hits the floor: wooden clack + a little glass tinkle."""
    out = np.zeros(n_(1.4))
    add_at(out, A.modal([(180, 1.0, 0.12), (420, 0.6, 0.08), (950, 0.4, 0.05)], 0.6, seed=31, strike=0.5), 0.0)
    add_at(out, lp(rng(32).standard_normal(n_(0.08)), 1500) * np.exp(-tt(0.08) / 0.015), 0.0)
    r = rng(33)
    for k in range(9):
        f = r.uniform(3000, 6500)
        add_at(out, A.modal([(f, 1.0, 0.08), (f * 1.7, 0.4, 0.05)], 0.3, seed=40 + k, strike=0.05) * r.uniform(0.15, 0.4),
               0.02 + r.uniform(0, 0.35))
    add_at(out, A.modal([(220, 0.8, 0.09), (510, 0.5, 0.06)], 0.5, seed=34, strike=0.4) * 0.5, 0.16)   # bounce
    return place(out, 0.1, "small", -12)


def mk_stab(d=0.34):
    """Short orchestral 'dun' stab (the start of the big DUN, cut short)."""
    x = A.make_dun()
    return fade(x[:n_(d)], 0.002, 0.08)


def mk_dundundun():
    out = np.zeros((n_(3.2), 2))
    add_at(out, mk_stab(0.32), 0.0)
    add_at(out, mk_stab(0.32) * 1.05, 0.38)
    big = A.make_dun()
    add_at(out, big[:n_(2.4)] * 1.15, 0.78)
    return out


def mk_flush(d=1.8, seed=3):
    """A proper flush: rushing water (filtered noise, swirling), then draining."""
    t = tt(d)
    r = rng(seed)
    n = r.standard_normal(len(t))
    sw = A.svf(n, 700 + 500 * np.sin(2 * np.pi * 2.2 * t), q=1.2, mode="bp") + 0.5 * bp(n, 2500, 7000)
    y = sw * att(t, 0.06) * (1 - 0.7 * att(t - 0.6, d - 0.6))
    for k in range(10):
        add_at(y, A.bubble(r.uniform(300, 800), r.uniform(0.006, 0.014), rise=1.2) * r.uniform(0.2, 0.5), r.uniform(0.6, d - 0.2))
    return place(y * (1 - att(t - (d - 0.3), 0.3)), 0, "small", -12)


def mk_horror(d=0.9):
    """Shrill 'eeek' strings stab (dissonant cluster, tremolo)."""
    t = tt(d)
    y = np.zeros(len(t))
    for k, f in enumerate((1568, 1661, 1760, 2093)):
        y += A.saw(np.full(len(t), f) * (1 + 0.004 * np.sin(2 * np.pi * (5 + k) * t)))
    y = A.svf(y, 3000, q=1.2, mode="bp") * (0.6 + 0.4 * np.sin(2 * np.pi * 16 * t)) * env_ad(t, 0.01, 0.4, d)
    return place(y, 0, "hall", -12)


def mk_squelch(seed=1):
    """Plunger 'shlorp': a wet suction plop with a falling resonance + bubbles."""
    t = tt(0.4)
    r = rng(seed)
    f = 900 * np.exp(-t / 0.08) + 180
    y = A.svf(r.standard_normal(len(t)), f, q=6, mode="bp") * att(t, 0.01) * np.exp(-t / 0.12) * 2
    add_at(y, A.bubble(260, 0.02, rise=0.8) * 0.8, 0.05)
    add_at(y, A.bubble(420, 0.012, rise=1.2) * 0.5, 0.14)
    return place(lp(y, 2500), 0, "small", -10)


def mk_wood_creak(d=0.6):
    t = tt(d)
    f = 160 + 90 * t / d
    pulses = (np.sin(2 * np.pi * np.cumsum(f / 3) / SR) > 0.93).astype(float)
    y = A.svf(lp(pulses, 5000) + 0.03 * rng(9).standard_normal(len(t)), 700 + 500 * t / d, q=6, mode="bp")
    return place(y * env_ad(t, 0.05, 0.1, d) * 3, 0, "small", -12)


def mk_crack():
    """Wooden handle snapping: sharp broadband crack + splintering + woody resonance."""
    out = np.zeros(n_(0.9))
    t = tt(0.05)
    add_at(out, rng(61).standard_normal(len(t)) * np.exp(-t / 0.004) * 1.5, 0.0)
    add_at(out, A.modal([(380, 1.0, 0.06), (870, 0.7, 0.04), (1650, 0.5, 0.03), (2900, 0.3, 0.02)], 0.4, seed=62, strike=0.6), 0.0)
    r = rng(63)
    for k in range(12):
        tk = tt(0.015)
        add_at(out, hp(r.standard_normal(len(tk)), 2500) * np.exp(-tk / 0.003) * r.uniform(0.2, 0.6), 0.01 + r.uniform(0, 0.12))
    return place(out, 0, "small", -10)


def mk_knock(seed=0):
    """One knuckle knock on a wooden door."""
    y = A.modal([(150, 1.0, 0.07), (330, 0.7, 0.05), (720, 0.4, 0.03), (1500, 0.2, 0.015)], 0.35, seed=70 + seed, strike=0.4, strike_hp=1500)
    return place(y, 0.15, "room", -14)


def mk_dial(n=7, every=0.13):
    """Phone keypad: DTMF beeps, then one ring tone."""
    rows, cols = (697, 770, 852, 941), (1209, 1336, 1477)
    r = rng(80)
    out = np.zeros(n_(n * every + 1.2))
    for k in range(n):
        t = tt(0.08)
        f1, f2 = rows[int(r.integers(0, 4))], cols[int(r.integers(0, 3))]
        add_at(out, (np.sin(2 * np.pi * f1 * t) + np.sin(2 * np.pi * f2 * t)) * env_ad(t, 0.004, 0.01, 0.08) * 0.5, k * every)
    t = tt(0.9)
    ring = (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 480 * t)) * env_ad(t, 0.02, 0.05, 0.9) * 0.3
    add_at(out, ring, n * every + 0.15)
    return place(bp(out, 300, 3400), 0.3, "small", -16)


def mk_screech(d=1.3):
    """Van tyres screeching to a stop: squealing band noise falling in pitch + a final thump."""
    t = tt(d)
    r = rng(90)
    n = r.standard_normal(len(t))
    f = 2400 - 1100 * t / d + 150 * np.sin(2 * np.pi * 9 * t)
    y = A.svf(n, f, q=14, mode="bp") * 3 + 0.4 * A.svf(n, f * 1.5, q=10, mode="bp") + 0.25 * bp(n, 300, 1200)
    y *= att(t, 0.03) * (1 - att(t - (d - 0.25), 0.2))
    add_at(y, lp(r.standard_normal(n_(0.2)), 300) * np.exp(-tt(0.2) / 0.05) * 1.5, d - 0.22)
    return place(y, -0.3, "hall", -12)


def brass(f, d, vib=0.0, bright=1.0, seed=0):
    t = tt(d)
    fr = f * (1 - 0.02 * np.exp(-t / 0.05)) * (1 + vib * 0.012 * np.sin(2 * np.pi * 5.5 * t) * att(t - 0.2, 0.2))
    y = A.saw(fr) + 0.7 * A.saw(fr * 1.003)
    cut = 400 + 2200 * bright * att(t, 0.06) * (0.6 + 0.4 * np.exp(-t / 0.4))
    return A.svf(y, cut, q=0.8, mode="lp") * env_ad(t, 0.04, min(0.15, d * 0.3), d)


def drum(kind, seed=0):
    if kind == "timp":
        t = tt(0.9)
        f0 = 73 * (1 + 0.03 * np.exp(-t / 0.05))
        return sum(a * np.sin(2 * np.pi * np.cumsum(f0 * q) / SR) * np.exp(-t / tau) for q, a, tau in ((1, 1, 0.6), (1.5, 0.5, 0.4), (2, 0.3, 0.3))) * att(t, 0.003)
    t = tt(0.25)
    return (bp(rng(seed).standard_normal(len(t)), 1500, 7000) * np.exp(-t / 0.05) + 0.6 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.03))


def mk_hero(d=1.6):
    """Heroic movie fanfare: brass chords (C - F - G - C) over a snare roll and timpani hits."""
    out = np.zeros(n_(d + 1.0))
    C, F, G = (130.81, 164.81, 196.0, 261.63), (174.61, 220.0, 261.63, 349.23), (196.0, 246.94, 293.66, 392.0)
    seq = [(0.0, C, 0.35), (0.38, C, 0.2), (0.6, F, 0.35), (0.98, G, 0.35), (1.35, C, 1.0)]
    for t0, ch, ln in seq:
        if t0 > d:
            break
        for k, f in enumerate(ch):
            add_at(out, brass(f, ln, vib=1 if ln > 0.5 else 0, seed=k) * (0.9 if k == 3 else 0.6), t0)
        add_at(out, drum("timp") * 1.2, t0)
    tt_ = 0.0
    while tt_ < d:
        add_at(out, drum("snare", int(tt_ * 100)) * (0.25 + 0.25 * tt_ / d), tt_)
        tt_ += 0.065
    return place(out * (1 - att(tt(len(out) / SR) - (len(out) / SR - 0.4), 0.4)), 0, "hall", -10)


def mk_taps():
    """Sad lone trumpet: the opening of a slow funeral call (G G C... G C E), with vibrato."""
    notes = [(392.0, 0.28), (392.0, 0.12), (523.25, 0.9), (392.0, 0.3), (523.25, 0.3), (659.25, 1.1)]
    out = np.zeros(n_(3.4))
    t0 = 0.0
    for f, ln in notes:
        y = brass(f / 2, ln, vib=1.0, bright=0.7)
        add_at(out, A.svf(y, 1400, q=1.5, mode="bp") * 1.5, t0)
        t0 += ln + 0.03
    return place(out, 0, "hall", -10)


def mk_projector(d=2.4):
    t = tt(d)
    clicks = (np.sin(2 * np.pi * 24 * t) > 0.92).astype(float)
    y = hp(lp(clicks, 4000), 800) * 0.8 + 0.15 * np.sin(2 * np.pi * 60 * t) + 0.1 * bp(rng(3).standard_normal(len(t)), 1000, 4000)
    return place(y * env_ad(t, 0.1, 0.2, d), 0.2, "room", -16)


def mk_musicbox(d=2.4):
    """Nostalgic music box: a slow little tune of bell-like plucks."""
    notes = [784, 659, 523, 659, 784, 1047, 988, 784]
    out = np.zeros(n_(d + 1.0))
    for k, f in enumerate(notes):
        if k * 0.3 > d:
            break
        add_at(out, A.modal([(f, 1.0, 0.6), (f * 2.0, 0.3, 0.3), (f * 3.01, 0.15, 0.15)], 1.2, seed=100 + k, strike=0.02) * 0.6, k * 0.3)
    return place(out, 0, "room", -14)


def mk_spray(d=1.4):
    t = tt(d)
    n = rng(7).standard_normal(len(t))
    y = (hp(n, 2500) * (0.7 + 0.3 * np.sin(2 * np.pi * 7 * t)) + 0.3 * bp(n, 400, 1500)) * env_ad(t, 0.03, 0.2, d)
    return place(y, -0.2, "room", -12)


def mk_footsteps_hall(n=4, every=0.55):
    out = np.zeros(n_(n * every + 0.5))
    for k in range(n):
        y = A.modal([(900, 1.0, 0.04), (2100, 0.5, 0.02)], 0.15, seed=120 + k, strike=0.6, strike_hp=2000)
        add_at(out, y * (0.8 if k % 2 else 1.0), k * every)
    return place(out, 0, "hall", -4)


def mk_murmur(d=0.9, seed=0):
    """A polite 'hmm' from museum visitors (two hummed voices)."""
    t = tt(d)
    y = np.zeros(len(t))
    for k, f in enumerate((120, 185)):
        fr = f * (1 + 0.04 * np.sin(np.pi * t / d)) * (1 - 0.05 * t / d)
        y += A.svf(A.saw(fr), 300 + 80 * k, q=3, mode="bp") * (0.8 - 0.3 * k)
    return place(y * env_ad(t, 0.08, 0.3, d), 0.2 * (seed - 0.5), "hall", -10)


def mk_zip(d=1.2):
    """Measuring tape pulled out: a fast ratchet buzz + rising whoosh, ending in a click."""
    t = tt(d)
    rate = 40 + 60 * att(t, 0.3)
    clicks = (np.sin(2 * np.pi * np.cumsum(rate) / SR) > 0.85).astype(float)
    y = hp(lp(clicks, 6000), 1200) * 0.8 + 0.4 * A.svf(rng(4).standard_normal(len(t)), 800 + 1800 * t / d, q=1.5, mode="bp")
    y *= env_ad(t, 0.02, 0.1, d)
    add_at(y, A.modal([(2600, 1, 0.03)], 0.1, seed=7, strike=0.3) * 0.8, d - 0.08)
    return place(y, 0.2, "small", -12)


def mk_camera():
    """Phone camera: shutter 'ka-chk' + the old flash charging whine."""
    out = np.zeros(n_(1.2))
    for k, tk in enumerate((0.0, 0.07)):
        t = tt(0.04)
        add_at(out, bp(rng(140 + k).standard_normal(len(t)), 1500, 8000) * np.exp(-t / 0.006) * (1.0 if k else 0.7), tk)
    t = tt(0.9)
    f = 2000 + 6000 * att(t, 0.9)
    add_at(out, np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.15 * env_ad(t, 0.05, 0.2, 0.9), 0.12)
    return place(out, 0, "small", -14)


def mk_piano(chord=(261.63, 329.63, 392.0, 523.25), d=2.2, seed=0):
    t = tt(d)
    y = np.zeros(len(t))
    for f in chord:
        for k in range(1, 12):
            fk = k * f * np.sqrt(1 + 0.0003 * k * k)
            if fk > 6000:
                break
            y += (k ** -1.1) * np.sin(2 * np.pi * fk * t) * np.exp(-t / (1.8 / (1 + fk / 900)))
    y *= att(t, 0.003) * (1 - att(t - (d - 0.3), 0.3))
    return place(y, 0, "hall", -14)


def mk_claps(d=4.0, start_rate=1.6, people=12):
    """Slow clapping from one or two people that grows into warm applause."""
    out = np.zeros(n_(d + 0.5))
    r = rng(150)
    one = lambda s: A.svf(rng(s).standard_normal(n_(0.06)), r.uniform(900, 1800), q=1.5, mode="bp") * np.exp(-tt(0.06) / 0.012)
    for p in range(people):
        t = 0.0 if p < 2 else r.uniform(0.6, 2.2) + p * 0.08
        per = 1 / start_rate + r.uniform(-0.03, 0.03)
        k = 0
        while t < d:
            add_at(out, one(1000 * p + k) * r.uniform(0.5, 1.0) * (1.0 if p < 2 else 0.7), t)
            per = max(0.17, per * (0.93 if p < 2 else 0.97))
            t += per + r.uniform(-0.01, 0.01)
            k += 1
    tt_ = tt(len(out) / SR)
    return place(out * (1 - att(tt_ - (d - 0.6), 0.6)), 0, "hall", -10)


def mk_slurp():
    t = tt(0.7)
    n = rng(160).standard_normal(len(t))
    y = A.svf(n, 1200 + 900 * np.sin(np.pi * t / 0.7), q=3, mode="bp") * env_ad(t, 0.05, 0.15, 0.7)
    for k in range(6):
        add_at(y, A.bubble(500 + 80 * k, 0.008, rise=1.0) * 0.3, 0.1 + k * 0.08)
    return place(y, 0, "room", -14)


def mk_shock(d=0.7):
    """Shocked orchestral hit: a short brass + timpani 'BWAM'."""
    out = np.zeros(n_(d + 1.0))
    for k, f in enumerate((98.0, 146.83, 196.0, 233.08)):
        add_at(out, brass(f, d, bright=1.2), 0.0)
    add_at(out, drum("timp") * 1.4, 0.0)
    return place(out, 0, "hall", -10)


def build():
    cues = []

    def cue(name, x, t, gain_db, note, level=A.REF_LUFS, by="mmax", **kw):
        save(name, x, level=level, by=by)
        cues.append(dict(t=round(float(t), 3), file=f"audio/sfx/{name}.wav", gain_db=gain_db, note=note, **kw))

    # --- 1-2: straining, flickering light, the picture falls
    cue("grunt", mk_grunt(2.75), 0.0, -13.0, "straining grunt 'nnnggh'", duck_db=4)
    cue("flicker", mk_flicker(2.8), 0.05, -17.0, "light flicker buzz", by="int", duck_db=3)
    cue("rattle", mk_rattle(0.75), shot(2)[0] + 0.05, -13.0, "picture frame rattles on the wall", duck_db=3)
    cue("crash", mk_crash(), word(1, 8) + 0.12, -9.0, "picture frame falls and crashes", duck_db=2)
    # --- 3: the bowl. dun dun DUNNN
    cue("dundun", mk_dundundun(), shot(3)[0] + 0.02, -7.0, "dun dun DUNNN sting", duck_db=3)
    # --- 4-7: flushing
    cue("click_1", mk_click(2600, 1), word(3, 1) + 0.04, -8.0, "flush button click", duck_db=2)
    cue("flush", mk_flush(1.9, 3), word(3, 1) + 0.12, -11.0, "big flush, water swirling", duck_db=3)
    cue("click_2", mk_click(2400, 2), word(5, 1) - 0.02, -8.0, "click", duck_db=2)
    cue("click_3", mk_click(2800, 3), word(5, 1) + 0.18, -8.0, "click (harder)", duck_db=2)
    cue("flushweak", seg(load("flushfail"), 0.2, 1.7, fo=0.4), word(5, 2) + 0.15, -12.0, "weak flush", duck_db=3)
    g = stretch(np.concatenate([load("gurgle"), load("gurgle_b")]), 1.7)
    cue("gurgle", fade(g[:n_(1.7)], 0.02, 0.4), shot(7)[0] + 0.08, -10.0, "sad gurgle", duck_db=3)
    # --- 8-10: staring, the bowl looks back
    cue("fly", mk_fly(1.5, 3), shot(8)[0] + 0.1, -22.0, "a fly buzzing far away", duck_db=3)
    cue("blink", mk_blink(), word(8, 1) + 0.05, -9.0, "tiny cartoon blink", duck_db=1)
    cue("horror", mk_horror(0.85), shot(10)[0] + 0.02, -12.0, "horror 'eeek' strings", duck_db=3)
    # --- 11-13: the plunger
    cue("ting", mk_ding(), word(9, 3), -15.0, "heroic little ting on 'plunger'")
    cue("grab", mk_whoosh(0.3, 600, 2600, seed=8), shot(11)[0] + 0.1, -16.0, "grab whoosh")
    for k, tq in enumerate((0.02, 0.3)):
        cue(f"squelch_{k}", mk_squelch(k + 1), shot(12)[0] + tq, -9.0, "plunger squelch", duck_db=3)
    cue("creak", mk_wood_creak(0.45), shot(12)[0] + 0.5, -12.0, "wooden handle bends", duck_db=3)
    cue("crack", mk_crack(), word(10, 2) + 0.02, -5.0, "the handle SNAPS", duck_db=1)
    cue("tick_wood", A.modal([(1900, 1, 0.03), (4100, 0.4, 0.02)], 0.2, seed=5, strike=0.3), shot(13)[0] + 0.35, -14.0, "a little wood piece drops")
    # --- 14-17: the friend knocks
    for k in range(3):
        cue(f"knock_{k}", mk_knock(k), word(11, 2) + 0.42 + k * 0.19, -7.0, "knock", duck_db=1)
    cue("heart_1", mk_heartbeat(), shot(17)[0] + 0.1, -8.0, "heartbeat")
    cue("heart_2", mk_heartbeat(), shot(17)[0] + 0.62, -8.0, "heartbeat")
    cue("heart_3", mk_heartbeat(), shot(17)[0] + 1.14, -7.0, "heartbeat")
    # --- 18-20: mom calls, the family waits, grandma
    cue("dial", mk_dial(), shot(18)[0] + 0.05, -16.0, "phone dialing + ring", duck_db=4)
    for k in range(5):
        cue(f"clock_{k}", mk_tick(k % 2 == 1), shot(19)[0] + 0.25 + k * 0.5, -17.0, "clock tick (waiting)", duck_db=3)
    cue("slurp", mk_slurp(), line_span(17)[1] + 0.05, -10.0, "grandma slurps her tea", duck_db=1)
    # --- 21-24: the plumber arrives
    cue("screech", mk_screech(1.2), shot(21)[0] + 0.02, -9.0, "van tyre screech", duck_db=3)
    cue("hero", mk_hero(1.45), shot(22)[0] - 0.02, -11.0, "heroic brass fanfare", duck_db=4)
    cue("drone", mk_drone(shot(25)[0] - shot(23)[0], 55), shot(23)[0], -18.0, "low drone (music cut)", by="int", duck_db=4)
    cue("taps", mk_taps(), shot(24)[0] + 0.1, -13.0, "sad trumpet", duck_db=4)
    # --- 25-27: thirty years (flashback) ... never seen this
    cue("projector", mk_projector(shot(27)[0] - shot(25)[0]), shot(25)[0], -18.0, "old film projector rattle", by="int", duck_db=3)
    cue("musicbox", mk_musicbox(shot(27)[0] - shot(25)[0]), shot(25)[0] + 0.05, -17.0, "nostalgic music box", duck_db=4)
    cue("spray", mk_spray(1.3), shot(26)[0] + 0.05, -15.0, "burst pipe spraying", duck_db=3)
    cue("scratch_1", mk_scratch(), shot(27)[0] - 0.02, -9.0, "record scratch back to now", duck_db=1)
    cue("shock", mk_shock(), word(23, 1) - 0.03, -12.0, "shocked brass hit on 'never'", duck_db=4)
    # --- 28-32: the museum
    cue("steps", mk_footsteps_hall(3, 0.5), shot(28)[0] + 0.1, -16.0, "footsteps echo in the museum", duck_db=3)
    ch = stretch(load("choir"), 3.2)
    cue("choir", fade(ch, 0.3, 0.8), shot(29)[0] - 0.1, -13.0, "soft heavenly choir", duck_db=4)
    cue("ding", mk_ding(), word(26, 2) + 0.02, -14.0, "ding on 'twenty'")
    cue("hmm_1", mk_murmur(0.8, 0), shot(31)[0] + 0.05, -16.0, "visitors 'hmm'", duck_db=3)
    cue("hmm_2", mk_murmur(0.9, 1), line_span(27)[1] + 0.02, -14.0, "visitors 'hmm'", duck_db=2)
    cue("steps_2", mk_footsteps_hall(2, 0.7), shot(32)[0] + 0.4, -18.0, "a guard's footsteps", duck_db=3)
    # --- 33-35: measuring
    cue("scratch_2", mk_scratch(), shot(33)[0] - 0.02, -10.0, "record scratch back to the bathroom", duck_db=1)
    cue("ting_ruler", mk_sparkle(), word(29, 5) + 0.05, -15.0, "tiny ruler ting")
    cue("zip", mk_zip(1.25), shot(34)[0] + 0.12, -10.0, "measuring tape zzzzip", duck_db=3)
    cue("camera", mk_camera(), word(31, 4) + 0.1, -8.0, "camera shutter + flash whine", duck_db=2)
    # --- 36-38: Kid... broke the record
    cue("piano", mk_piano((196.0, 246.94, 293.66, 392.0), 2.6), shot(36)[0] + 0.15, -14.0, "soft emotional piano", duck_db=3)
    cue("piano_2", mk_piano((261.63, 329.63, 392.0, 523.25), 2.6), line_span(33)[0] - 0.05, -15.0, "warm piano chord", duck_db=3)
    cue("claps", mk_claps(DUR - line_span(33)[0]), line_span(33)[0] + 0.45, -11.0, "slow clapping into applause", duck_db=4)
    cue("birds", mk_birds(DUR - shot(38)[0]), shot(38)[0], -20.0, "evening birds", by="int")
    cue("farflush", lp(mk_flush(1.6, 9), 1500), shot(38)[0] + 1.0, -21.0, "a far-away flush inside the house")

    cues.sort(key=lambda c: c["t"])
    json.dump(cues, open(P("audio", "sfx_cues.json"), "w"), indent=1)
    for c in cues:
        info = A.INFO[os.path.splitext(os.path.basename(c["file"]))[0]]
        print(f"{c['t']:6.2f}  {os.path.basename(c['file']):18s} {c['gain_db']:+5.1f} dB  {info['dur']:5.2f}s  {c['note']}")
    print(f"{len(cues)} cues -> audio/sfx_cues.json")


if __name__ == "__main__":
    build()
