#!/usr/bin/env python3
"""Sound effects for the awards reel - ALL made with code here (numpy, fixed seeds; no downloaded or AI sounds)
-> audio/sfx/*.wav + audio/sfx_cues.json (then mix.py makes the mix).

  crowd cheer + applause (opening), golden sparkle, stair steps, mic taps, mic feedback squeal, voice-crack squeak,
  the four SQUISHes (each bigger + louder: squish -> SQUISH -> SQUOOSH -> SQUOOOSH, cartoon rubber + bubble sounds),
  front-row sniffs, camera flashes, the TV crane whir + zoom servo, buttons popping, a crowd gasp, the dramatic DUN
  ("What you don't know"), the stopwatch ticking (one tick per shown second, faster in the countdown, big ticks on
  0:40 / 0:44 / 0:45), the baton whoosh, the orchestra PLAY-OFF music (brass fanfare + strings + pizzicato bass +
  timpani; it gets sloppy and wobbly when they play with one hand), penguin footsteps, night crickets.
Level convention: every effect is normalised so its loudest 400 ms sits at -20 LUFS, so a cue's gain_db is its level
relative to the narrator. The voice stays on top: all gains are negative and mix.py ducks effects under the voice.
Run: python3 make_sfx.py
"""
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sfx_lib as L  # noqa: E402
from sfx_lib import SR, save, place, lp, hp, bp, svf, att, tt, n_, rng, INFO  # noqa: E402
from scipy.signal import fftconvolve  # noqa: E402

CUES = os.path.join(HERE, "audio", "sfx_cues.json")
SH = json.load(open(os.path.join(HERE, "shots.json")))["shots"]
END = json.load(open(os.path.join(HERE, "shots.json")))["duration"]
EV = lambda sid, name: SH[sid - 1]["events"][name]
S0 = lambda sid: SH[sid - 1]["t0"]
POOPS = [6.562, 17.622, 20.488, 26.567]


def speech_secs(t):          # same mapping as make_overlay.py / web/shots_a.js
    if t < 42.66: return 31 + (t - 33.5) * (9 / 9.16)
    if t < 44.10: return 40 + (t - 42.66) / 1.44 * 4
    if t < 45.44: return 44 + (t - 44.10) / 1.34
    return 45.0


def env_pts(t, pts):
    return np.interp(t, [p[0] for p in pts], [p[1] for p in pts])


def sine_glide(f, t=None):
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def saw_glide(f):
    ph = np.cumsum(f) / SR
    return 2 * (ph - np.floor(ph + 0.5))


# ------------------------------------------------------------------------------------------- crowd
def clap_kernels(r, k=6):
    out = []
    for i in range(k):
        n = n_(0.03); t = np.arange(n) / SR
        x = bp(r.standard_normal(n), 900 + 500 * r.random(), 4500 + 2000 * r.random()) * np.exp(-t / (0.004 + 0.004 * r.random()))
        out.append(x / (np.abs(x).max() + 1e-9))
    return out


def applause(d, density, seed, env=None):
    r = rng(seed); n = n_(d); y = np.zeros(n); ks = clap_kernels(r)
    dens = density * (env if env is not None else np.ones(n))
    for kk in ks:
        imp = (r.random(n) < dens / SR / len(ks)).astype(float) * (0.4 + 0.6 * r.random(n))
        y += fftconvolve(imp, kk)[:n]
    return y


def crowd_voices(d, seed, env=None, woo=6):
    """many people cheering: formant-filtered buzzy voices with swells + a few 'wooo' whistles"""
    r = rng(seed); t = tt(d); n = len(t); y = np.zeros(n)
    for v in range(28):
        f0 = (130 + 220 * r.random()) * (1 + 0.04 * np.sin(2 * np.pi * (0.3 + r.random()) * t + 6 * r.random()))
        src = saw_glide(f0) * 0.5 + r.standard_normal(n) * 0.15
        f1, f2 = 600 + 300 * r.random(), 1000 + 500 * r.random()
        vo = svf(src, f1, q=4) + 0.7 * svf(src, f2, q=5)
        sw = np.clip(0.4 + 0.6 * np.sin(2 * np.pi * (0.25 + 0.4 * r.random()) * t + 6 * r.random()), 0, 1)
        y += vo * sw * (0.5 + 0.5 * r.random())
    for w in range(woo):
        t0 = r.random() * max(0.1, d - 1.2); dd = 0.6 + 0.5 * r.random(); tw = tt(dd)
        f = (700 + 300 * r.random()) * (1 + 0.6 * np.clip(tw / 0.25, 0, 1)) * (1 + 0.03 * np.sin(2 * np.pi * 6 * tw))
        x = (sine_glide(f) + 0.3 * sine_glide(2 * f)) * np.sin(np.pi * np.clip(tw / dd, 0, 1)) ** 0.8
        L.add_at(y, x * 0.35, t0)
    y = lp(y, 5000)
    return y * (env if env is not None else 1)


def make_cheer():
    """the opening: crowd roar + applause, swells on 'won', fades at the mic, CUT at the first squish."""
    d = POOPS[0] + 0.06; t = tt(d)
    e = env_pts(t, [(0, 0.55), (0.9, 0.7), (1.2, 1.0), (3.2, 0.95), (4.6, 0.55), (6.2, 0.35), (POOPS[0], 0.3), (d, 0.0)])
    y = crowd_voices(d, 8101, e, woo=8) * 0.8 + applause(d, 260, 8102, e) * 0.9
    return save("cheer", place(y, 0, "hall", -10), fade_out=0.04)


def make_sniffs(n_people=9, d=1.0, name="sniffs", seed=8201):
    r = rng(seed); y = np.zeros(n_(d + 0.4))
    for p in range(n_people):
        t0 = r.random() * d * 0.6
        for k in range(2):
            dd = 0.09 + 0.04 * r.random(); tw = tt(dd)
            x = bp(r.standard_normal(len(tw)), 1800 + 800 * r.random(), 6500) * np.sin(np.pi * np.clip(tw / dd, 0, 1)) ** 2 * np.clip(tw / dd, 0, 1)
            L.add_at(y, x * (0.5 + 0.5 * r.random()), t0 + k * (0.13 + 0.03 * r.random()))
    return save(name, place(y, 0, "hall", -16), fade_out=0.05)


def make_gasp():
    r = rng(8301); y = np.zeros(n_(1.0))
    for p in range(10):
        dd = 0.35 + 0.15 * r.random(); tw = tt(dd); n = len(tw)
        src = r.standard_normal(n) * 0.6 + saw_glide(np.full(n, 160 + 160 * r.random())) * 0.3
        x = (svf(src, 750 + 200 * r.random(), q=3) + 0.6 * svf(src, 1250, q=4)) * att(tw, 0.08) * np.exp(-np.clip(tw - 0.1, 0, None) / 0.12)
        L.add_at(y, x, 0.08 * r.random())
    return save("gasp", place(lp(y, 6000), 0, "hall", -14), fade_out=0.1)


# ------------------------------------------------------------------------------------------- stage
def make_chime():
    y = np.zeros(n_(1.5))
    for i, f in enumerate([1568, 2093, 2637, 3136, 4186, 5274]):
        L.add_at(y, L.modal([(f, 0.5, 0.35), (f * 2.76, 0.15, 0.1)], 0.8, seed=20 + i, strike=0.05, strike_hp=5000), i * 0.055)
    return save("chime", place(y, 0, "hall", -14), fade_out=0.4)


def make_steps(d=0.7, gap=0.17, name="steps", seed=8401):
    r = rng(seed); y = np.zeros(n_(d + 0.2)); t = 0.0; k = 0
    while t < d:
        L.add_at(y, L.modal([(170 + 40 * r.random(), 0.7, 0.03), (520, 0.3, 0.015), (1400, 0.15, 0.01)], 0.12, seed=k, strike=0.6, strike_tau=0.002, strike_hp=1500) * (0.6 + 0.4 * r.random()), t)
        t += gap + 0.02 * r.random(); k += 1
    return save(name, place(lp(y, 6000), 0.2, "hall", -18), fade_out=0.1)


def make_mictap():
    y = np.zeros(n_(0.8))
    for k, t0 in enumerate([0.0, 0.22]):
        tw = tt(0.25); x = np.sin(2 * np.pi * (90 - 40 * tw) * tw) * np.exp(-tw / 0.06) + 0.3 * lp(rng(8500 + k).standard_normal(len(tw)), 800) * np.exp(-tw / 0.02)
        L.add_at(y, x, t0)
    return save("mictap", place(y, 0, "hall", -12), fade_out=0.1)


def make_feedback():
    """mic feedback squeal: a pure high tone that swells fast, wobbles, then is cut"""
    d = 0.75; t = tt(d)
    f = 2960 * (1 + 0.004 * np.sin(2 * np.pi * 7 * t)) * (1 + 0.02 * np.clip((t - 0.3) / 0.3, 0, 1))
    x = sine_glide(f) + 0.25 * sine_glide(2 * f) + 0.1 * sine_glide(3 * f)
    e = np.clip(t / 0.35, 0, 1) ** 2 * np.clip((d - t) / 0.05, 0, 1)
    return save("feedback", place(x * e, 0, "hall", -12), fade_out=0.04)


def make_crack():
    """cartoon voice-crack squeak: a quick rising 'eep' through a vowel formant"""
    d = 0.2; t = tt(d); f = 520 * (1 + 1.4 * np.clip(t / 0.12, 0, 1))
    x = svf(saw_glide(f), 1600, q=3) * np.sin(np.pi * np.clip(t / d, 0, 1))
    return save("crack", place(x, 0, "small", -18), fade_out=0.03)


def make_squish(level, name):
    """cartoon SQUISH (rubber + bubbles + a soft low thump) - bigger level = longer, lower, louder, more wobble"""
    r = rng(8600 + level); d = 0.32 + 0.22 * level; t = tt(d); n = len(t); y = np.zeros(n)
    f = (300 - 35 * level) * (1 - 0.45 * np.clip(t / d, 0, 1)) * (1 + 0.08 * np.sin(2 * np.pi * (16 - level) * t))
    rub = svf(saw_glide(f), 700 - 60 * level, q=2.5) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.6
    y += rub * 0.8
    for k in range(3 + 2 * level):
        L.add_at(y, L.bubble(260 + 380 * r.random(), 0.018 + 0.006 * level, rise=1.1, amp=0.5), 0.02 + r.random() * d * 0.75)
    if level >= 2:
        dd = d * 0.6; tw = tt(dd); fs = (900 - 80 * level) * (1 + 0.15 * np.sin(2 * np.pi * 23 * tw)) * (1 - 0.3 * np.clip(tw / dd, 0, 1))
        L.add_at(y, sine_glide(fs) * np.sin(np.pi * np.clip(tw / dd, 0, 1)) * 0.25 * level / 3, 0.04)
    tw = tt(0.3); L.add_at(y, np.sin(2 * np.pi * (75 - 30 * tw) * tw) * np.exp(-tw / 0.07) * (0.5 + 0.2 * level), 0.0)
    return save(name, place(y, 0, "room", -16), fade_out=0.06)


def make_flash():
    """camera flash: shutter click + the tiny rising charge whine"""
    y = np.zeros(n_(0.5))
    L.add_at(y, L.modal([(2400, 0.6, 0.01), (5100, 0.3, 0.006), (900, 0.3, 0.012)], 0.06, seed=31, strike=0.7, strike_hp=2500), 0.0)
    tw = tt(0.35); L.add_at(y, sine_glide(4000 + 5000 * tw / 0.35) * 0.06 * np.clip(tw / 0.35, 0, 1), 0.05)
    return save("flash", place(y, 0.1, "hall", -16), fade_out=0.05)


def make_crane():
    """TV crane: electric motor whir rising + gear noise"""
    r = rng(8701); d = 0.95; t = tt(d); n = len(t)
    f = 70 + 90 * np.clip(t / 0.5, 0, 1)
    x = lp(saw_glide(f) + 0.5 * saw_glide(f * 2.01), 1600) * 0.6 + bp(r.standard_normal(n), 1500, 4000) * 0.15 * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 0.25) / SR))
    return save("crane", place(x * att(t, 0.08) * np.clip((d - t) / 0.2, 0, 1), 0.3, "hall", -14), fade_out=0.1)


def make_zoom():
    d = 0.55; t = tt(d); f = 900 + 500 * np.clip(t / d, 0, 1)
    x = lp(saw_glide(f), 3000) * np.sin(np.pi * np.clip(t / d, 0, 1)) * 0.5
    return save("zoom", place(x, 0.2, "small", -18), fade_out=0.05)


def make_buttons():
    y = np.zeros(n_(0.9)); r = rng(8801)
    for k, t0 in enumerate([0.0, 0.07, 0.16, 0.3]):
        L.add_at(y, L.modal([(1900 + 600 * r.random(), 0.6, 0.02), (4300, 0.25, 0.01)], 0.1, seed=40 + k, strike=0.7, strike_hp=2000), t0)
        L.add_at(y, L.modal([(2600 + 900 * r.random(), 0.3, 0.05)], 0.12, seed=50 + k, strike=0.2), t0 + 0.35 + 0.08 * k)
    return save("buttons", place(y, 0, "hall", -14), fade_out=0.1)


def make_dun():
    """the dramatic 'What you don't know' hit: deep drop + rumble"""
    r = rng(8901); d = 2.0; t = tt(d); n = len(t)
    x = np.sin(2 * np.pi * np.cumsum(62 - 18 * np.clip(t / 1.2, 0, 1)) / SR) * np.exp(-t / 0.7)
    x += 0.5 * np.sin(2 * np.pi * np.cumsum(124 - 30 * np.clip(t / 1.2, 0, 1)) / SR) * np.exp(-t / 0.4)
    x += lp(r.standard_normal(n), 400) * np.exp(-t / 0.15) * 0.6
    return save("dun", place(x, 0, "hall", -12), fade_out=0.3)


def make_ticks():
    tick = L.modal([(2600, 0.6, 0.008), (5200, 0.2, 0.004)], 0.05, seed=1, strike=0.4, strike_hp=3000)
    tock = L.modal([(2150, 0.6, 0.008), (4300, 0.2, 0.004)], 0.05, seed=2, strike=0.4, strike_hp=3000)
    save("tick", place(tick, 0.25, "small", -18), fade_out=0.02)
    save("tock", place(tock, 0.25, "small", -18), fade_out=0.02)
    big = np.zeros(n_(0.7)); tw = tt(0.6)
    L.add_at(big, L.modal([(1800, 0.8, 0.02), (3600, 0.3, 0.01), (900, 0.4, 0.03)], 0.1, seed=3, strike=0.6, strike_hp=1500), 0.0)
    L.add_at(big, np.sin(2 * np.pi * (70 - 25 * tw) * tw) * np.exp(-tw / 0.18) * 0.8, 0.0)
    return save("bigtick", place(big, 0, "hall", -14), fade_out=0.1)


def make_whoosh(d=0.35, name="whoosh"):
    r = rng(2401); t = tt(d); n = len(t)
    fc = 600 * (5000 / 600) ** np.clip(t / (d * 0.6), 0, 1)
    y = svf(lp(r.standard_normal(n), 8000), fc, q=1.2) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return save(name, place(y, 0, "room", -14), fade_out=0.06)


def make_penguin():
    """tiny waddle steps: soft pat + a little shoe squeak, every ~0.27 s"""
    d = 54.4 - 47.95; r = rng(9001); y = np.zeros(n_(d + 0.3)); t = 0.0; k = 0
    while t < d:
        L.add_at(y, L.modal([(190 + 30 * r.random(), 0.7, 0.025), (600, 0.2, 0.012)], 0.1, seed=k, strike=0.5, strike_hp=1500) * 0.8, t)
        if k % 2 == 0:
            tw = tt(0.07); L.add_at(y, sine_glide(1500 + 500 * r.random() + 300 * tw / 0.07) * np.sin(np.pi * tw / 0.07) * 0.18, t + 0.01)
        t += 0.27 + 0.02 * r.random(); k += 1
    return save("penguin", place(lp(y, 7000), -0.1, "hall", -16), fade_out=0.1)


def make_crickets():
    r = rng(9101); d = END - S0(40) + 0.2; t = tt(d); y = np.zeros(len(t))
    for c in range(3):
        f = 4300 + 400 * c; rate = 2.2 + 0.7 * c; ph = 6 * r.random()
        gate = (np.sin(2 * np.pi * rate * t + ph) > 0.55).astype(float) * (np.sin(2 * np.pi * 30 * t) > 0).astype(float)
        y += np.sin(2 * np.pi * f * t) * lp(gate, 300) * (0.3 + 0.2 * c)
    return save("crickets", place(y, 0.15, "room", -16), by="integrated", fade_in=0.3, fade_out=0.5)


# ------------------------------------------------------------------------------------------- the play-off music
def midi(m): return 440.0 * 2 ** ((m - 69) / 12)


def adsr(n, a=0.01, dcy=0.08, s=0.7, rel=0.08):
    t = np.arange(n) / SR; d = n / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / dcy))
    return e * np.clip((d - t) / rel, 0, 1)


def make_music():
    """orchestral PLAY-OFF music: a cheerful brassy march in C (132 bpm). It starts BIG on the baton swing, and after
    'With one hand' (they hold their noses) it gets sloppy: notes missing, pitch wobbling, thinner sound."""
    t0 = EV(34, "music") - 0.02
    d = END - t0 + 0.3; N = n_(d); r = rng(9201)
    beat = 60 / 132
    sloppy_t = EV(38, "hand") - t0
    out = {k: np.zeros(N) for k in ("brass", "strings", "bass", "perc")}
    mel = [(0, 1, 67), (1, 0.5, 72), (1.5, 0.5, 72), (2, 1, 76), (3, 1, 79),
           (4, 1.5, 76), (5.5, 0.5, 72), (6, 1, 74), (7, 1, 76),
           (8, 1, 77), (9, 0.5, 76), (9.5, 0.5, 74), (10, 1, 72), (11, 1, 69),
           (12, 1, 71), (13, 1, 74), (14, 2, 79)]
    chords = [(0, [48, 60, 64, 67]), (4, [45, 57, 60, 64]), (8, [41, 57, 60, 65]), (12, [43, 55, 59, 62])]
    reps = int(d / (16 * beat)) + 1
    wob = lambda tpos: float(np.clip((tpos - sloppy_t) / 0.6, 0, 1))
    for rep in range(reps):
        base = rep * 16 * beat
        for (b, ln, m) in mel:
            ts_ = base + b * beat
            if ts_ >= d: break
            s = wob(ts_)
            if s > 0 and r.random() < 0.35 * s: continue          # a missed note (one hand!)
            n = n_(ln * beat * 0.95); tw = np.arange(n) / SR
            f = midi(m) * (1 + s * 0.03 * np.sin(2 * np.pi * (3 + 2 * r.random()) * tw + 6 * r.random()) + s * 0.02 * (r.random() - 0.5))
            x = saw_glide(f) + 0.6 * saw_glide(f * 1.004) + 0.4 * saw_glide(f * 0.5)
            x = 0.6 * svf(x, 1100, q=0.9) + 0.4 * svf(x, 3000, q=0.8) * np.exp(-tw / 0.12)     # brassy: bright attack
            L.add_at(out["brass"], x * adsr(n, 0.02, 0.15, 0.75, 0.06) * (1 - 0.35 * s), ts_)
        for (b, notes) in chords:
            ts_ = base + b * beat
            if ts_ >= d: break
            s = wob(ts_); n = n_(4 * beat); tw = np.arange(n) / SR
            pad = np.zeros(n)
            for m in notes[1:]:
                f = midi(m) * (1 + s * 0.015 * np.sin(2 * np.pi * 4.5 * tw + m))
                pad += saw_glide(f) + saw_glide(f * 1.003)
            L.add_at(out["strings"], lp(pad, 2200) * adsr(n, 0.12, 0.4, 0.8, 0.15) * 0.35 * (1 - 0.5 * s), ts_)
            for k in range(4):                                       # pizzicato bass on every beat
                tb = ts_ + k * beat
                if s > 0 and r.random() < 0.3 * s: continue
                nb = n_(0.35); twb = np.arange(nb) / SR; fb = midi(notes[0])
                pz = (np.sin(2 * np.pi * fb * twb) + 0.4 * np.sin(4 * np.pi * fb * twb)) * np.exp(-twb / 0.12)
                L.add_at(out["bass"], pz * 0.9, tb)
            nt = n_(0.8); twt = np.arange(nt) / SR                    # timpani on the bar, brush on 2 + 4
            timp = np.sin(2 * np.pi * np.cumsum(midi(notes[0]) * (1 + 0.1 * np.exp(-twt / 0.03))) / SR) * np.exp(-twt / 0.35)
            L.add_at(out["perc"], timp * 0.9, ts_)
            for k in (1, 3):
                nsn = n_(0.15); tws = np.arange(nsn) / SR
                L.add_at(out["perc"], bp(r.standard_normal(nsn), 1500, 7000) * np.exp(-tws / 0.04) * 0.35, ts_ + k * beat)
    nc = n_(2.5); twc = np.arange(nc) / SR                           # opening cymbal crash
    L.add_at(out["perc"], hp(r.standard_normal(nc), 4000) * np.exp(-twc / 0.6) * 0.5, 0.0)
    mix = (place(out["brass"], 0.15, "hall", -10) * 1.0 + place(out["strings"], -0.25, "hall", -9) * 0.8
           + place(out["bass"], 0.0, "hall", -14) * 0.9 + place(out["perc"], 0.0, "hall", -12) * 0.8)
    return save("music", mix, by="integrated", fade_in=0.005, fade_out=0.4)


# ------------------------------------------------------------------------------------------- cues
def onset(name):
    import soundfile as sf
    x, _ = sf.read(os.path.join(L.SFX_DIR, name + ".wav"), always_2d=True)
    a = np.abs(x).max(axis=1); i = int(np.argmax(a > a.max() * 0.25))
    return i / SR


def build_cues():
    cues = []
    add = lambda t, name, gain, note, **kw: cues.append(dict(t=round(max(0.0, t), 3), file=f"audio/sfx/{name}.wav", gain_db=gain, note=note, **kw))
    hit = lambda t, name, gain, note, **kw: add(t - onset(name), name, gain, note, **kw)
    add(0.0, "cheer", -9, "crowd cheer + applause (cut at the first squish)", duck_db=4)
    add(EV(2, "oscar") + 0.02, "chime", -14, "the golden statue sparkles")
    add(S0(3) + 0.03, "steps", -15, "up the stairs")
    hit(EV(4, "mic") + 0.12, "mictap", -15, "tap tap on the mic")
    for k, (t, nm, g) in enumerate(zip(POOPS, ["squish1", "squish2", "squish3", "squish4"], [-12, -9, -7, -4])):
        hit(t, nm, g, f"SQUISH #{k + 1} (louder each time)", duck_db=2)
    hit(EV(9, "thank") + 0.05, "feedback", -13, "mic feedback squeal", duck_db=3)
    hit(EV(10, "cracks") + 0.18, "crack", -16, "voice-crack squeak", duck_db=2)
    add(S0(11) + 0.05, "sniffs", -12, "the whole front row sniffs")
    add(S0(12) + 0.05, "sniffs2", -16, "two more sniffs")
    for ft in (S0(18) + 0.25, S0(18) + 0.9, EV(18, "nose") + 0.2, EV(18, "nose") + 0.75):
        hit(ft, "flash", -17, "camera flash")
    add(EV(19, "camera") - 0.1, "crane", -14, "TV crane swings")
    add(EV(19, "zooms") + 0.02, "zoom", -18, "camera zoom servo")
    hit(POOPS[3] + 0.04, "buttons", -14, "buttons pop off")
    add(POOPS[3] + 0.25, "gasp", -14, "crowd gasp")
    hit(EV(26, "know") - 0.02, "dun", -10, "What you don't know: DUN")
    # stopwatch: one tick per shown second (from the overlay start), faster in the countdown; big ticks on the numbers
    big = {40: EV(31, "forty"), 44: EV(32, "fortyfour"), 45: EV(33, "fortyfive")}
    T0, T1 = S0(26) + 0.25, EV(34, "music")
    t = T0; prev = None; k = 0
    while t < T1:
        s = int(math.floor(speech_secs(t) + 1e-6))
        if s != prev:
            if s not in big:
                hit(t, "tick" if k % 2 == 0 else "tock", -15, f"stopwatch 0:{s:02d}")
            prev = s; k += 1
        t += 0.01
    for s, tb in big.items():
        hit(tb, "bigtick", -10, f"big countdown tick 0:{s}")
    add(EV(34, "music") - 0.2, "whoosh", -13, "the baton swing")
    add(EV(34, "music") - 0.02, "music", -8, "orchestra PLAY-OFF music (sloppy after 'one hand')", duck_db=5)
    add(47.95, "penguin", -15, "penguin waddle steps")
    add(S0(40) - 0.05, "crickets", -22, "night crickets outside", fade_in=0.3)
    cues.sort(key=lambda c: c["t"])
    json.dump(cues, open(CUES, "w"), indent=1)
    return cues


def main():
    os.makedirs(L.SFX_DIR, exist_ok=True)
    make_cheer(); make_sniffs(); make_sniffs(2, 0.4, "sniffs2", 8211); make_gasp()
    make_chime(); make_steps(); make_mictap(); make_feedback(); make_crack()
    for lv in range(1, 5):
        make_squish(lv, f"squish{lv}")
    make_flash(); make_crane(); make_zoom(); make_buttons(); make_dun(); make_ticks(); make_whoosh(); make_penguin(); make_crickets()
    make_music()
    cues = build_cues()
    for k, v in INFO.items():
        print(f"{k:12s} {v['dur']:6.2f}s  peak {v['peak_db']:6.1f}")
    print(f"wrote {len(INFO)} files + {len(cues)} cues")


if __name__ == "__main__":
    main()
