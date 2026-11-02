#!/usr/bin/env python3
"""Sound effects for the bus crush reel (ALL made with code here, no downloaded or AI sounds) -> audio/sfx/*.wav + audio/sfx_cues.json (then mix.py makes the mix).

Sources:
  * ElevenLabs sound effects made for this reel (eleven_text_to_sound_v2, audio/sfx_src/<name>_<k>.mp3, sessions
    in audio/sfx_src/sessions.json, chosen take in PICK): limo, car door, door slam, heel step, heel walk, gasp,
    paper crinkle, cart squeak, silk swish, chomp, plate crash, sobbing, wedding bells, swing creak, fly, boop,
    heart pop, ticking, stopwatch click, fur swoosh, restaurant piano bed, Paris accordion bed, soft piano.
  * Reused from the last reels (audio/sfx_src/reused/): city street bed, heavenly choir, sparkle, love harp,
    time-lapse whoosh, park bed (mansion reel); bush rustle, leaf, crickets, forest birds (bear reel).
  * Code-made (numpy, fixed seeds): heartbeat, whoosh, the 'What you don't know' DUN and the ding (sfx_lib.py).
Level convention: every effect is normalised so its loudest 400 ms sits at -20 LUFS (beds: integrated), so a
cue's gain_db is roughly its level relative to the narrator. The narrator stays on top: effects are ducked under
the voice in mix.py and almost all gains are negative. Cue times come from edit.py (= measured word onsets).
Run: python3 make_sfx.py
"""
import json
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sfx_lib as L  # noqa: E402
from sfx_lib import SR, save, place, lp, hp, bp, svf, att, tt, n_, rng, INFO  # noqa: E402

SRC = os.path.join(HERE, "audio", "sfx_src")
CUES = os.path.join(HERE, "audio", "sfx_cues.json")
END = json.load(open(os.path.join(HERE, "shots.json")))["duration"]
# chosen variation per ElevenLabs sound (1-4); see pick notes in README
PICK = json.load(open(os.path.join(SRC, "pick.json"))) if os.path.exists(os.path.join(SRC, "pick.json")) else {}


def load_src(name, k=None):
    """Decode an ElevenLabs mp3 -> float stereo (n, 2) at 48 kHz."""
    if "/" in name:
        path = os.path.join(SRC, name + ".mp3")
    else:
        path = os.path.join(SRC, f"{name}_{k or PICK.get(name, 1)}.mp3")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(float)


def env_db(x, win=0.02):
    m = np.abs(x).max(1) if x.ndim == 2 else np.abs(x)
    h = n_(win)
    pad = np.pad(m, (0, (-len(m)) % h))
    return 20 * np.log10(pad.reshape(-1, h).max(1) + 1e-9), h


def trim(x, thr_db=-42.0, pre=0.01, post=0.08, max_len=None):
    """Cut leading/trailing quiet parts (relative to the clip's peak)."""
    e, h = env_db(x)
    on = np.where(e > e.max() + thr_db)[0]
    if len(on) == 0:
        return x
    a = max(0, on[0] * h - n_(pre))
    b = min(len(x), (on[-1] + 1) * h + n_(post))
    if max_len:
        b = min(b, a + n_(max_len))
    return x[a:b]


def around_peak(x, pre=0.3, post=0.4):
    """The part of a clip around its loudest 20 ms (for swells such as the silk swish)."""
    e, h = env_db(x)
    i = int(np.argmax(e)) * h
    return x[max(0, i - n_(pre)):min(len(x), i + n_(post))]




SH = json.load(open(os.path.join(HERE, "shots.json")))["shots"]
EV = lambda sid, name: SH[sid - 1]["events"][name]
S0 = lambda sid: SH[sid - 1]["t0"]
S1 = lambda sid: SH[sid - 1]["t1"]
K = dict(cruise=8.5, stop0=5.4, stop1=7.0, go0=9.9, go1=12.2, brake0=26.968, brake1=27.42, away0=30.72)   # = web/layout.js


def sm(x):
    x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)


def speed(t):
    v = K["cruise"]
    return np.select([t < K["stop0"], t < K["stop1"], t < K["go0"], t < K["go1"], t < K["brake0"], t < K["brake1"], t < K["away0"]],
                     [v, v * (1 - sm((t - K["stop0"]) / (K["stop1"] - K["stop0"]))), 0, v * sm((t - K["go0"]) / (K["go1"] - K["go0"])), v,
                      v * np.clip(1 - (t - K["brake0"]) / (K["brake1"] - K["brake0"]), 0, 1) ** 1.4, 0],
                     np.minimum(v * 1.4, 6.5 * (t - K["away0"])))


def make_engine():
    """City-bus diesel: a low harmonic rumble whose pitch + level follow the bus speed (idle at the stops), road noise,
    and small interior rattles while it moves. Whole-video bed."""
    r = rng(5101); d = END + 0.5; t = tt(d); n = len(t)
    v = speed(t); acc = np.gradient(v, 1 / SR)
    f0 = 31 + 3.0 * v + 1.6 * np.clip(acc, 0, 6)
    ph = 2 * np.pi * np.cumsum(f0) / SR
    y = np.zeros(n)
    for k in range(1, 14):
        y += np.sin(k * ph + k * 1.3) / k ** 0.9 * (1.0 if k % 2 else 0.7)
    y *= 0.75 + 0.25 * np.sin(ph * 0.5)                                    # firing unevenness
    y = lp(y, 700) * (0.55 + 0.45 * np.clip(v / 8.5, 0, 1.3) + 0.25 * np.clip(acc / 4, 0, 1))
    road = lp(r.standard_normal(n), 380) * 0.55 * np.clip(v / 8.5, 0, 1.3)
    out = y + road
    tt0 = 0.0
    while tt0 < d - 0.3:                                                     # rattles (only while moving)
        vv = float(speed(np.array([tt0]))[0])
        if vv > 1:
            hitx = L.modal([(900 + 700 * r.random(), 0.5, 0.012), (2300 + 900 * r.random(), 0.25, 0.008)], 0.06, seed=int(tt0 * 100), strike=0.3, strike_hp=2000)
            L.add_at(out, hitx * 0.12 * (vv / 8.5), tt0)
        tt0 += 0.11 + 0.35 * r.random()
    return save("engine", place(out, 0, "small", -22), level=-20.0, by="integrated", fade_in=0.02, fade_out=0.4)


def make_hiss(name="doorhiss", d=0.9):
    """Pneumatic door 'psshhh' + a soft thunk at the end."""
    r = rng(5201); t = tt(d); n = len(t)
    y = hp(r.standard_normal(n), 2500) * np.exp(-t / 0.28) * (1 - np.exp(-t / 0.01))
    L.add_at(y, L.modal([(110, 0.6, 0.05), (240, 0.3, 0.03)], 0.2, seed=3, strike=0.3) * 0.8, d * 0.62)
    return save(name, place(lp(y, 9000), 0.2, "small", -18), fade_out=0.1)


def make_screech():
    """Brake screech: a squealing whine with vibrato + tyre noise, then the air brake 'pssht'."""
    r = rng(5301); d = 1.25; t = tt(d); n = len(t)
    env = np.clip(t / 0.04, 0, 1) * np.clip((0.55 - t) / 0.12, 0, 1)
    f = 2350 + 140 * np.sin(2 * np.pi * 7.5 * t) - 300 * t
    sq = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.35 * np.sin(2 * 2 * np.pi * np.cumsum(f) / SR)
    tyre = bp(r.standard_normal(n), 400, 2500) * 0.6
    y = (0.45 * sq + tyre) * env
    hs = hp(r.standard_normal(n), 2200) * np.exp(-np.maximum(t - 0.62, 0) / 0.18) * (t > 0.62) * 0.7
    return save("screech", place(y + hs, 0, "small", -20), fade_out=0.08)


def make_slide():
    """Window pane sliding open: a short gritty scrape ending in a click."""
    r = rng(5401); d = 0.42; t = tt(d); n = len(t)
    y = bp(r.standard_normal(n), 800, 4000) * (0.6 + 0.4 * np.sin(2 * np.pi * 37 * t)) * np.sin(np.pi * np.clip(t / 0.32, 0, 1))
    L.add_at(y, L.modal([(1800, 0.5, 0.01), (3400, 0.3, 0.006)], 0.05, seed=4, strike=0.5) * 1.2, 0.32)
    return save("slide", place(y, 0.3, "small", -18), fade_out=0.05)


def make_wind(d=1.8):
    """Wind rushing past an open window (head outside)."""
    r = rng(5501); t = tt(d); n = len(t)
    fc = 900 + 400 * np.sin(2 * np.pi * 0.7 * t) + 300 * np.sin(2 * np.pi * 2.3 * t)
    y = svf(lp(r.standard_normal(n), 6000), fc, q=0.8) + 0.5 * lp(r.standard_normal(n), 300)
    return save("wind", place(y * (0.8 + 0.2 * np.sin(2 * np.pi * 5 * t)), 0, None), fade_in=0.12, fade_out=0.25)


def make_chime():
    """Soft sparkly chime (code-made bell partials) for the crush."""
    y = np.zeros(n_(1.4))
    for i, f in enumerate([1568, 2093, 2637, 3136]):
        L.add_at(y, L.modal([(f, 0.6, 0.35), (f * 2.76, 0.18, 0.12)], 0.8, seed=10 + i, strike=0.05, strike_hp=5000), i * 0.07)
    return save("chime", place(y, 0, "room", -14), fade_out=0.4)


def make_steps():
    """Quick running footsteps on the bus floor (~1 s)."""
    r = rng(5601); y = np.zeros(n_(1.2)); t = 0.0; k = 0
    while t < 1.0:
        y_ = L.modal([(140 + 40 * r.random(), 0.7, 0.03), (420, 0.3, 0.015)], 0.12, seed=k, strike=0.6, strike_tau=0.002, strike_hp=1500)
        L.add_at(y, y_ * (0.5 + 0.5 * r.random()), t); t += 0.07 + 0.06 * r.random(); k += 1
    return save("steps", place(lp(y, 5000), 0, "small", -16), fade_out=0.1)


def make_pop():
    """Tiny cartoon pop (the stink line / sweat drop)."""
    y = L.bubble(520, 0.012, rise=1.2, amp=1.0)
    return save("pop", place(y, 0, "small", -20), fade_out=0.02)


def onset(name):
    """Seconds from the start of a saved effect to its first strong transient (to line hits up exactly)."""
    import soundfile as sf
    x, _ = sf.read(os.path.join(L.SFX_DIR, name + ".wav"), always_2d=True)
    e, h = env_db(x, 0.005)
    i = int(np.argmax(e > e.max() - 12))
    return i * h / SR


def build_cues():
    cues = []
    add = lambda t, name, gain, note, **kw: cues.append(dict(t=round(max(0.0, t), 3), file=f"audio/sfx/{name}.wav",
                                                             gain_db=gain, note=note, **kw))
    hit = lambda t, name, gain, note, **kw: add(t - onset(name), name, gain, note, **kw)
    add(0.0, "engine", -14, "bus engine + road noise (follows the bus speed)", duck_db=4)
    hit(EV(1, "pooped") + 0.1, "pop", -18, "the little stink line")
    hit(K["stop1"] - 0.05, "doorhiss", -15, "front door opens (pssh)")
    add(S0(5) + 0.15, "chime", -15, "sparkle chime: the crush steps in")
    hit(EV(6, "seat") - 0.05, "pop", -20, "the empty seat sparkle")
    hit(EV(7, "next"), "pop", -18, "sweat drop")
    add(EV(9, "smiles"), "chime", -16, "pink sparkles: her smile")
    hit(EV(14, "opens") + 0.05, "slide", -12, "the window slides open")
    add(S0(15) + 0.3, "wind", -18, "wind through the open window", dur=S1(15) - S0(15) - 0.3, fade_out=0.15)
    add(S0(16), "wind", -11, "wind rush outside (head out)", dur=S1(16) - S0(16) + 0.05, fade_in=0.05, fade_out=0.08)
    hit(K["brake0"], "screech", -10, "BRAKE SCREECH + air brake", duck_db=3)
    hit(S0(19) + 0.02, "doorhiss", -16, "doors open")
    add(S0(19) + 0.05, "steps", -12, "everyone runs out")
    hit(K["away0"] - 0.1, "doorhiss", -20, "doors close")
    cues.sort(key=lambda c: c["t"])
    json.dump(cues, open(CUES, "w"), indent=1)
    return cues


def main():
    os.makedirs(L.SFX_DIR, exist_ok=True)
    make_engine(); make_hiss(); make_screech(); make_slide(); make_wind(); make_chime(); make_steps(); make_pop()
    cues = build_cues()
    for k, v in INFO.items():
        print(f"{k:12s} {v['dur']:6.2f}s  peak {v['peak_db']:6.1f}  I {v['lufs_i']:6.1f}")
    print(f"wrote {len(INFO)} files + {len(cues)} cues")


if __name__ == "__main__":
    main()
