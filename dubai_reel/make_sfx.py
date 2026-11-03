#!/usr/bin/env python3
"""Sound effects for the dubai aunty reel (ALL made with code here: no downloaded or AI sounds) -> audio/sfx/*.wav + audio/sfx_cues.json (then mix.py makes the mix).

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


def bell(f, d=1.6, amp=1.0, seed=0):
    return L.modal([(f, 1.0 * amp, 0.55), (f * 2.0, 0.35 * amp, 0.3), (f * 2.76, 0.25 * amp, 0.18), (f * 5.4, 0.1 * amp, 0.08)], d, seed=seed, strike=0.08, strike_hp=4000)


def make_doorbell():
    """Classic two-tone 'ding-dong' (E5 -> C5)."""
    y = np.zeros(n_(2.0)); L.add_at(y, bell(659.3, 1.4, 1.0, 1), 0.0); L.add_at(y, bell(523.3, 1.5, 1.0, 2), 0.42)
    return save("doorbell", place(y, -0.2, "room", -14), fade_out=0.4)


def make_mugdrop():
    """The mug hits the floor: a ceramic clunk + a coffee splash."""
    r = rng(7101); y = np.zeros(n_(0.9))
    L.add_at(y, L.modal([(820, 0.8, 0.06), (1930, 0.5, 0.04), (3100, 0.3, 0.025), (240, 0.6, 0.05)], 0.3, seed=3, strike=0.6, strike_tau=0.002, strike_hp=1500), 0.0)
    t = tt(0.55); sp = bp(r.standard_normal(len(t)), 600, 6000) * np.exp(-t / 0.12) * (1 - np.exp(-t / 0.004))
    for k in range(6): L.add_at(y, L.bubble(500 + 300 * r.random(), 0.01, rise=1.0, amp=0.3), 0.04 + 0.05 * k * r.random())
    L.add_at(y, sp * 0.8, 0.01)
    return save("mugdrop", place(y, 0.1, "room", -16), fade_out=0.1)


def make_steps(d=1.1):
    r = rng(7201); y = np.zeros(n_(d + 0.2)); t = 0.0; k = 0
    while t < d:
        L.add_at(y, L.modal([(150 + 40 * r.random(), 0.7, 0.03), (420, 0.3, 0.015)], 0.12, seed=k, strike=0.6, strike_tau=0.002, strike_hp=1500) * (0.6 + 0.4 * r.random()), t)
        t += 0.16 + 0.03 * r.random(); k += 1
    return save("steps", place(lp(y, 5000), 0, "room", -16), fade_out=0.1)


def make_tick(n=10, gap=0.11, name="ticks"):
    y = np.zeros(n_(n * gap + 0.2))
    for k in range(n):
        L.add_at(y, L.modal([(2600 if k % 2 else 2200, 0.6, 0.008), (5200, 0.2, 0.004)], 0.05, seed=k, strike=0.4, strike_hp=3000), k * gap)
    return save(name, place(y, 0.25, "small", -18), fade_out=0.05)


def make_whistle():
    """Pressure cooker whistle: a rising, wobbling steam whistle + hiss."""
    r = rng(7301); d = 1.5; t = tt(d); n = len(t)
    f = 1800 + 900 * np.clip(t / 0.35, 0, 1) + 60 * np.sin(2 * np.pi * 9 * t)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * 2 * np.pi * np.cumsum(f) / SR)
    hiss = hp(r.standard_normal(n), 3000) * 0.6
    env = np.clip(t / 0.12, 0, 1) * np.clip((d - t) / 0.25, 0, 1)
    return save("whistle", place((0.5 * tone + hiss) * env, -0.3, "room", -16), fade_out=0.15)


def make_creak(d=1.2, name="creak"):
    """Door creak: a slow, scratchy pitch wobble through a resonant filter."""
    r = rng(7401); t = tt(d); n = len(t)
    f0 = 140 + 60 * np.sin(2 * np.pi * 0.8 * t) + 25 * np.sin(2 * np.pi * 5.3 * t)
    pulses = np.zeros(n); ph = np.cumsum(f0) / SR
    pulses[np.where(np.diff(np.floor(ph)) > 0)[0]] = 1.0
    y = svf(pulses + 0.05 * r.standard_normal(n), 900, q=6) + 0.6 * svf(pulses, 2300, q=8)
    y *= np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.7
    return save(name, place(y, 0.2, "room", -16), fade_out=0.15)


def make_click():
    y = L.modal([(1800, 0.6, 0.012), (3900, 0.3, 0.006), (600, 0.4, 0.02)], 0.08, seed=9, strike=0.6, strike_hp=2000)
    return save("click", place(y, 0.2, "small", -18), fade_out=0.03)


def make_chime():
    """Gold sparkle: quick high bell arpeggio (code-made)."""
    y = np.zeros(n_(1.4))
    for i, f in enumerate([1568, 2093, 2637, 3136, 4186]):
        L.add_at(y, L.modal([(f, 0.5, 0.3), (f * 2.76, 0.15, 0.1)], 0.7, seed=20 + i, strike=0.05, strike_hp=5000), i * 0.06)
    return save("chime", place(y, 0, "room", -14), fade_out=0.4)


def make_tune():
    """Grandpa's whistled little tune (sine whistle, vibrato)."""
    notes = [(784, 0.25), (880, 0.25), (784, 0.25), (659, 0.5), (587, 0.25), (659, 0.5)]
    y = np.zeros(n_(sum(d for _, d in notes) + 0.3)); t0 = 0.0
    for f, d in notes:
        t = tt(d); vib = 1 + 0.012 * np.sin(2 * np.pi * 6 * t)
        tone = np.sin(2 * np.pi * np.cumsum(f * vib) / SR) * np.clip(t / 0.03, 0, 1) * np.clip((d - t) / 0.05, 0, 1)
        L.add_at(y, tone * 0.6, t0); t0 += d
    return save("tune", place(y, 0.3, "room", -16), fade_out=0.1)


def make_scribble():
    """Pen scratching a line on paper."""
    r = rng(7501); d = 0.5; t = tt(d); n = len(t)
    y = bp(r.standard_normal(n), 2500, 8000) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 14 * t))) * np.sin(np.pi * np.clip(t / d, 0, 1))
    return save("scribble", place(y, 0, "small", -18), fade_out=0.05)


def make_whoosh(d=0.5, name="whoosh"):
    r = rng(2401); t = tt(d); n = len(t)
    fc = 500 * (4000 / 500) ** np.clip(t / (d * 0.7), 0, 1)
    y = svf(lp(r.standard_normal(n), 7000), fc, q=1.0) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return save(name, place(y, 0, "room", -14), fade_out=0.08)


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
    hit(EV(10, "rings"), "doorbell", -10, "ding-dong")
    add(S0(11) + 0.05, "creak", -16, "front door opens (slow motion)")
    add(S0(11) + 0.3, "chime", -15, "gold sparkles: the rich aunty")
    add(EV(12, "dubai") + 0.05, "chime", -17, "gold sparkles: From Dubai")
    hit(EV(13, "mug") + 0.05, "mugdrop", -9, "the mug hits the floor, coffee splash")
    add(S0(14) + 0.05, "steps", -14, "Mom runs")
    add(S0(18) + 0.05, "ticks", -14, "clock ticks (10 minutes)")
    add(EV(21, "louder") - 0.25, "whistle", -11, "PRESSURE COOKER WHISTLE", duck_db=3)
    add(S0(24) + 0.1, "tune", -16, "Grandpa whistles")
    add(S0(26) + 0.02, "fastticks", -14, "clock spins (2 hours)")
    hit(EV(32, "turns") - 0.45, "click", -12, "the handle")
    add(EV(32, "turns") - 0.4, "creakshort", -18, "handle turning")
    add(S0(33) + 0.05, "creak", -13, "the door opens slowly")
    add(S0(38) + 0.05, "whoosh", -18, "what you don't know")
    add(EV(42, "was") - 0.05, "scribble", -10, "the red pen crosses out YOU")
    cues.sort(key=lambda c: c["t"])
    json.dump(cues, open(CUES, "w"), indent=1)
    return cues


def main():
    os.makedirs(L.SFX_DIR, exist_ok=True)
    make_doorbell(); make_mugdrop(); make_steps(); make_tick(); make_tick(14, 0.07, "fastticks"); make_whistle(); make_creak(); make_creak(0.5, "creakshort")
    make_click(); make_chime(); make_tune(); make_scribble(); make_whoosh()
    cues = build_cues()
    for k, v in INFO.items():
        print(f"{k:12s} {v['dur']:6.2f}s  peak {v['peak_db']:6.1f}")
    print(f"wrote {len(INFO)} files + {len(cues)} cues")


if __name__ == "__main__":
    main()
