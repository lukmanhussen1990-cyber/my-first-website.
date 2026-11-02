#!/usr/bin/env python3
"""Sound effects for the handkerchief reel -> audio/sfx/*.wav + audio/sfx_cues.json (then mix.py makes the mix).

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
from sfx_lib import SR, save, place, lp, hp, svf, att, tt, n_, rng, INFO  # noqa: E402
from edit import W, WE, T0, T1  # noqa: E402

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


def make_heart():
    """One heartbeat 'lub-dub' (low thumps)."""
    r = rng(1301); d = 0.7; t = tt(d); y = np.zeros(len(t))
    for t0, a in [(0.0, 1.0), (0.16, 0.7)]:
        tl = np.maximum(t - t0, 0); on = (t >= t0)
        f = 55 * (1 + 0.5 * np.exp(-tl / 0.02))
        y += on * a * np.sin(2 * np.pi * np.cumsum(f * on) / SR) * np.exp(-tl / 0.07) * att(tl, 0.003)
        y += on * a * 0.35 * lp(r.standard_normal(len(t)), 300) * np.exp(-tl / 0.02)
    return save("heart", place(lp(y, 400), 0, "small", -20), fade_out=0.1)


def make_whoosh(d=0.5, name="whoosh"):
    r = rng(2401); t = tt(d); n = len(t)
    fc = 500 * (4000 / 500) ** np.clip(t / (d * 0.7), 0, 1)
    y = svf(lp(r.standard_normal(n), 7000), fc, q=1.0) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return save(name, place(y, 0, "room", -14), fade_out=0.08)


def prep_elevenlabs():
    beds = dict(level=-20.0, by="integrated", fade_in=0.05, fade_out=0.05, trim_db=-80)
    save("city", load_src("reused/citylong_2"), **beds)
    save("park", load_src("reused/forestlong_4"), **beds)
    save("crickets", load_src("reused/cricketslong_1"), **beds)
    save("restaurant", load_src("restaurant"), **beds)
    save("accordion", load_src("accordion"), **beds)
    save("piano", trim(load_src("piano"), -50, 0.0, 0.5), level=-20.0, by="integrated", fade_out=1.2)
    save("choir", trim(load_src("reused/choir_3"), -45, 0.01, 0.3), fade_out=0.35)
    save("sparkle", trim(load_src("reused/sparkle_1"), -40, 0.005, 0.2, 1.2), fade_out=0.3)
    save("aww", trim(load_src("reused/aww_2"), -42, 0.01, 0.3), fade_out=0.4)
    save("era", trim(load_src("reused/timelapse_2"), -40, 0.01, 0.2), fade_out=0.2)
    save("bush", trim(load_src("reused/bush_4"), -42, 0.01, 0.1, 1.6), fade_out=0.15)
    save("leaf", trim(load_src("reused/leaf_4"), -42, 0.01, 0.1, 1.0), fade_out=0.1)
    save("limo", trim(load_src("limo"), -50, 0.0, 0.3), fade_out=0.3)
    save("cardoor", trim(load_src("cardoor"), -45, 0.005, 0.2), fade_out=0.15)
    save("doorslam", trim(load_src("doorslam"), -45, 0.003, 0.2), fade_out=0.15)
    save("heelstep", trim(load_src("heelstep"), -45, 0.003, 0.2), fade_out=0.15)
    save("heelwalk", trim(load_src("heelwalk"), -45, 0.003, 0.2), fade_out=0.15)
    save("gasp", trim(load_src("gasp"), -42, 0.01, 0.15, 0.7), fade_out=0.15)
    save("crinkle", trim(load_src("crinkle"), -42, 0.005, 0.1), fade_out=0.1)
    save("cart", trim(load_src("cart"), -42, 0.005, 0.15), fade_out=0.12)
    save("silk", around_peak(load_src("silk"), 0.35, 0.35), fade_in=0.08, fade_out=0.15)
    save("chomp", trim(load_src("chomp"), -42, 0.003, 0.15, 0.8), fade_out=0.12)
    save("crash", trim(load_src("crash"), -45, 0.003, 0.3), fade_out=0.3)
    save("sob", trim(load_src("sob"), -45, 0.01, 0.3), fade_out=0.3)
    save("bells", trim(load_src("bells"), -50, 0.0, 0.5), fade_out=0.8)
    save("creak", trim(load_src("creak"), -45, 0.01, 0.2), fade_out=0.2)
    save("fly", trim(load_src("fly"), -45, 0.01, 0.2), fade_out=0.3)
    save("boop", trim(load_src("boop"), -40, 0.002, 0.1), fade_out=0.06)
    save("pop", trim(load_src("pop"), -40, 0.002, 0.15), fade_out=0.1)
    save("tick", trim(load_src("tick"), -45, 0.0, 0.1), fade_out=0.1)
    save("click", trim(load_src("click"), -40, 0.002, 0.1), fade_out=0.06)
    save("fur", trim(load_src("fur"), -42, 0.005, 0.1), fade_out=0.1)


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
    hit = lambda t, name, gain, note, **kw: add(t - onset(name), name, gain, note, **kw)   # transient on t
    # ---------------------------------------------------------------- the street (city bed with two drop-outs)
    add(0.0, "city", -13, "city street bed", dur=T0(11) + 0.04, fade_out=0.05, loop=True, duck_db=4)
    add(T0(13), "city", -19, "city bed, quiet (she walks)", dur=T0(14) - T0(13) + 0.02, fade_in=0.15, fade_out=0.04,
        loop=True, duck_db=3)
    add(T0(19), "city", -21, "city bed again (very quiet)", dur=T1(22) - T0(19), fade_in=0.3, fade_out=0.3, loop=True,
        duck_db=3)
    add(T0(1) + 0.25, "bush", -15, "bush rustle (opening)")
    hit(W(2, 3), "bush", -10, "the bush shakes")
    add(T0(3) + 0.15, "crinkle", -11, "bus ticket crinkle")
    add(T0(3) + 0.45, "leaf", -15, "leaf")
    # limo: ends with its stop on "stops"; the engine keeps idling under the next shot
    add(W(4, 4) + 0.15 - 3.0, "limo", -7, "limo pulls up and stops", duck_db=4)
    add(T0(5) + 0.25, "sparkle", -13, "gold rim sparkle")
    add(W(5, 3) - 0.03, "sparkle", -10, "sparkle on 'black car'")
    hit(T0(6) + 0.08, "cardoor", -6, "limo door opens")
    add(T0(6) + 0.2, "choir", -19, "a breath of heavenly light from the car", dur=1.0, fade_out=0.5, duck_db=3)
    hit(T0(7) + 0.55, "heelstep", -1, "red heel lands in the puddle")
    add(T0(8) + 0.05, "fur", -11, "fur coat swoosh")
    add(W(9) - 0.04, "sparkle", -3, "DIAMONDS sparkle", duck_db=2)
    hit(T0(9) + 0.04, "doorslam", -6, "bodyguard's door")
    add(T0(9) + 0.12, "gasp", -6, "bodyguard panic gasp", duck_db=3)
    hit(T0(12) + 0.02, "boop", -3, "BOOP (mouth snaps shut)", duck_db=0)
    add(T0(13) + 0.10, "heelwalk", -7, "her heels walking")
    # ---------------------------------------------------------------- the freeze: no city, single heartbeats
    for i, d in [(14, 0.25), (15, 0.30), (16, 0.30), (17, 0.30)]:
        add(T0(i) + d, "heart", -4 - (i == 14), "heartbeat", duck_db=1)
    add(T0(18) + 0.02, "choir", -6, "heavenly 'aaah' (the handkerchief)", duck_db=4)
    add(W(18, 4) - 0.1, "silk", -11, "silk swish")
    hit(W(19, 5), "cart", -9, "sad cart squeak on 'whole life'")
    add(T0(20) + 0.08, "silk", -13, "she holds it out")
    add(T0(20) + 0.35, "sparkle", -16, "handkerchief sparkle")
    # ---------------------------------------------------------------- the fact
    add(T0(22) + 0.08, "dun", -9, "'What you don't know' hit", duck_db=4)
    add(T0(23) + 0.05, "tick", -13, "stopwatch ticking", dur=W(24, 3) - T0(23) - 0.05, fade_out=0.03, loop=True)
    hit(W(24, 3), "click", -1, "stopwatch stops")
    add(W(24, 3) + 0.04, "ding", -11, "0.1 SEC ding")
    add(W(25) + 0.06, "whoosh", -11, "eyes go wide (her)")
    add(W(26) + 0.04, "whoosh", -11, "eyes go wide (him)")
    hit(WE(26) + 0.05, "pop", -5, "heart pops")
    add(WE(26) + 0.08, "aww", -9, "love harp")
    # ---------------------------------------------------------------- the timeline
    for i in (27, 31, 34, 36):
        add(T0(i) - 0.12, "era", -16, "soft whoosh into the next era", duck_db=2)
    add(T0(27), "restaurant", -12, "restaurant piano + clinks", dur=W(31, 2) + 0.2 - T0(27), fade_in=0.1, fade_out=0.08,
        loop=True, duck_db=5)
    hit(W(29, 2), "chomp", -7, "he bites the steak")
    hit(T0(29) + 0.25, "chomp", -9, "she bites too")
    hit(W(31, 2) + 0.2, "crash", -4, "waiter faints: plates crash", duck_db=2)
    add(T0(31), "accordion", -11, "Paris accordion", dur=T1(33) - T0(31) + 0.1, fade_in=0.05, fade_out=0.25, loop=True,
        duck_db=5)
    add(T0(31), "park", -22, "Paris park birds", dur=T1(33) - T0(31), fade_in=0.2, fade_out=0.25, loop=True, duck_db=2)
    hit(W(33, 1), "bush", -13, "bush rustle (Eiffel Tower)")
    add(T0(33) + 0.3, "sparkle", -14, "handkerchief sparkle (Paris)")
    add(T0(34) - 0.02, "bells", -9, "wedding bells", dur=T1(34) - T0(34) + 1.6, fade_out=1.0, duck_db=4)
    add(T0(35) + 0.05, "sob", -5, "the bodyguard sobs (and honks)", duck_db=3)
    # ---------------------------------------------------------------- 50 years later
    add(T0(36), "piano", -10, "soft piano", dur=T0(40) + 0.1 - T0(36), fade_in=0.3, fade_out=0.12, duck_db=5)
    add(T0(36), "crickets", -24, "crickets", dur=END - T0(36), fade_in=0.4, fade_out=0.8, loop=True, duck_db=2)
    add(T0(37) + 0.2, "creak", -13, "porch swing creak")
    add(T0(39) + 0.35, "sparkle", -16, "old handkerchief sparkle")
    add(T0(40) + 0.08, "fly", -11, "a fly buzzes around the frame", dur=T1(40) - T0(40), fade_out=0.15)
    add(T0(41) + 0.05, "piano", -11, "soft piano returns for the ending", offset=6.0, dur=END - T0(41) - 0.05,
        fade_in=0.25, fade_out=1.2, duck_db=4)
    cues.sort(key=lambda c: c["t"])
    json.dump(cues, open(CUES, "w"), indent=1)
    return cues


def main():
    os.makedirs(L.SFX_DIR, exist_ok=True)
    prep_elevenlabs()
    make_heart(); make_whoosh()
    L.make_ding(); L.make_dun()
    cues = build_cues()
    print(f"{'file':14s} {'dur':>6s} {'peak':>7s} {'Mmax':>7s} {'I':>7s}")
    for k, v in INFO.items():
        print(f"{k:14s} {v['dur']:6.2f} {v['peak_db']:7.1f} {v['mmax']:7.1f} {v['lufs_i']:7.1f}")
    print(f"wrote {len(INFO)} files to audio/sfx/ and {len(cues)} cues to audio/sfx_cues.json")


if __name__ == "__main__":
    main()
