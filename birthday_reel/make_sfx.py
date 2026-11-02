#!/usr/bin/env python3
"""Sound effects + music for the birthday reel -> audio/sfx/*.wav + audio/sfx_cues.json (then mix.py makes the mix).

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
VO = json.load(open(os.path.join(HERE, "audio", "vo_lines.json")))["lines"]
EV = lambda sid, name: SH[sid - 1]["events"][name]          # word onset inside shot sid
S0 = lambda sid: SH[sid - 1]["t0"]                           # shot start
S1 = lambda sid: SH[sid - 1]["t1"]
LS = lambda i: VO[i - 1]["start"]                            # voice line start / end
LE = lambda i: VO[i - 1]["end"]

NOTE = {"C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23, "G4": 392.0, "A4": 440.0, "B4": 493.88,
        "C5": 523.25, "D5": 587.33, "E5": 659.26, "F5": 698.46, "G5": 783.99, "A5": 880.0, "B5": 987.77, "C6": 1046.5,
        "C3": 130.81, "D3": 146.83, "E3": 164.81, "F3": 174.61, "G3": 196.0, "A3": 220.0, "B3": 246.94, "G2": 98.0}
MELODY = [("G4", .75), ("G4", .25), ("A4", 1), ("G4", 1), ("C5", 1), ("B4", 2),
          ("G4", .75), ("G4", .25), ("A4", 1), ("G4", 1), ("D5", 1), ("C5", 2),
          ("G4", .75), ("G4", .25), ("G5", 1), ("E5", 1), ("C5", 1), ("B4", 1), ("A4", 2),
          ("F5", .75), ("F5", .25), ("E5", 1), ("C5", 1), ("D5", 1), ("C5", 3)]
# one chord per 3/4 bar (the pickup is 1 beat): C G G C C F C-G C
BARS = [("C3", "E4", "G4"), ("G2", "D4", "F4"), ("G2", "D4", "F4"), ("C3", "E4", "G4"), ("C3", "E4", "G4"),
        ("F3", "A4", "C5"), ("G2", "D4", "F4"), ("C3", "E4", "G4")]


def xylo(f, dur, amp=1.0, seed=0):
    """Toy xylophone / music box note: bright bar partials (1, 3.93, 9.0) + a soft click."""
    return modal_note([(f, 1.0 * amp, 0.32), (f * 3.93, 0.32 * amp, 0.08), (f * 9.0, 0.08 * amp, 0.025), (f * 2.0, 0.18 * amp, 0.18)], dur, seed)


def modal_note(partials, dur, seed):
    return L.modal(partials, dur, seed=seed, strike=0.06, strike_hp=3500, beat=0.0012)


def pluck(f, dur, amp=1.0):
    """Soft ukulele-ish pluck for the chords (decaying harmonics)."""
    t = tt(max(dur, 0.6)); y = np.zeros(len(t))
    for k, a in [(1, 1.0), (2, 0.45), (3, 0.25), (4, 0.12), (5, 0.06)]:
        y += a * np.sin(2 * np.pi * f * k * t) * np.exp(-t / (0.35 / k ** 0.6))
    return amp * y * (1 - np.exp(-t / 0.002))


def make_bday(q):
    """'Happy Birthday to You' (public domain) on a toy xylophone + ukulele oom-pah-pah, quarter = q seconds."""
    total = sum(d for _, d in MELODY) * q + 1.6
    y = np.zeros(n_(total)); t = 0.0
    for i, (nm, d) in enumerate(MELODY):
        L.add_at(y, xylo(NOTE[nm], 1.2, 0.9, seed=i), t); t += d * q
    beat0 = 1.0 * q                                          # first full bar starts after the 1-beat pickup
    for b, (bass, c1, c2) in enumerate(BARS):
        tb = beat0 + b * 3 * q
        L.add_at(y, pluck(NOTE[bass], 0.8, 0.8), tb)
        for k in (1, 2):
            L.add_at(y, pluck(NOTE[c1], 0.5, 0.33) + pluck(NOTE[c2], 0.5, 0.28), tb + k * q)
    return save("bday", place(lp(y, 9000), 0, "room", -16), level=-20.0, by="integrated", fade_out=0.5)


def make_scratch():
    """Record scratch: a noisy back-and-forth pitch wiggle (vinyl), then silence."""
    r = rng(901); d = 0.42; t = tt(d); n = len(t)
    sp = np.interp(t, [0, 0.08, 0.16, 0.26, 0.42], [1.0, -1.4, 1.6, -0.4, 0.0])        # platter speed
    ph = np.cumsum(sp) / SR
    car = np.sin(2 * np.pi * 900 * ph * 3.2) * 0.5 + svf(r.standard_normal(n), 2400, q=1.4) * 0.8
    y = car * np.abs(sp) ** 0.7 * (1 - att(t - 0.36, 0.06))
    return save("scratch", place(bp(y, 300, 7000), 0, "small", -22), fade_out=0.04)


def make_knock():
    """One knuckle knock on a wooden door: low body thump + woody modes + click."""
    r = rng(911); y = L.modal([(115, 1.0, 0.05), (232, 0.6, 0.035), (410, 0.35, 0.02), (690, 0.2, 0.012)], 0.25, seed=3,
                             strike=0.5, strike_tau=0.002, strike_hp=1200)
    return save("knock", place(lp(y, 5000), 0.1, "room", -18), fade_out=0.05)


def make_snore():
    """Cartoon fake snore: a raspy inhale, then a whistling exhale (one cycle, ~1.5 s)."""
    r = rng(921); d = 1.5; t = tt(d); n = len(t)
    inh = (t < 0.75)
    buzz = np.sin(2 * np.pi * np.cumsum(70 + 15 * np.sin(2 * np.pi * 9 * t)) / SR)
    rasp = svf(r.standard_normal(n), 600, q=2) * (0.6 + 0.4 * np.sign(buzz))
    env_i = np.sin(np.pi * np.clip(t / 0.75, 0, 1)) ** 1.5 * inh
    f = np.interp(t, [0.8, 1.15, 1.5], [1200, 1900, 1500])
    wh = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.clip((t - 0.8) / 0.7, 0, 1)) ** 1.2 * (t >= 0.8)
    y = 0.9 * rasp * env_i + 0.35 * wh
    return save("snore", place(lp(y, 6000), 0, "small", -20), fade_out=0.06)


def make_rattle():
    """The bathroom door shaking in its frame: fast irregular wooden knocks + handle jingle (1 s)."""
    r = rng(931); d = 1.0; y = np.zeros(n_(d + 0.3)); t = 0.0; k = 0
    while t < d:
        hit_ = L.modal([(140 + 30 * r.random(), 0.8, 0.03), (300 + 60 * r.random(), 0.5, 0.02), (2400, 0.12, 0.01)], 0.15,
                       seed=k, strike=0.4, strike_tau=0.0015, strike_hp=1500)
        L.add_at(y, hit_ * (0.6 + 0.4 * r.random()), t)
        t += 0.045 + 0.05 * r.random(); k += 1
    return save("rattle", place(lp(y, 6000), 0.1, "room", -16), fade_out=0.1)


def make_applause():
    """Small family applause + 'woo': many short noisy claps (5 people) for ~2 s."""
    r = rng(941); d = 2.2; y = np.zeros(n_(d + 0.2))
    for p in range(5):
        t = 0.05 * r.random(); rate = 0.16 + 0.05 * r.random(); fc = 1400 + 900 * r.random()
        while t < d:
            c = svf(r.standard_normal(n_(0.03)), fc, q=1.2) * np.exp(-tt(0.03) / 0.006)
            L.add_at(y, c * (0.5 + 0.5 * r.random()) * (1 - t / (d + 0.4)), t)
            t += rate * (0.85 + 0.3 * r.random())
    return save("applause", place(bp(y, 300, 9000), 0, "room", -12), fade_in=0.02, fade_out=0.4)


def make_kaching():
    """Cash register: drawer 'ch' (noise + clunk) then a bright bell 'ching'."""
    r = rng(951); y = np.zeros(n_(1.4))
    clunk = L.modal([(180, 0.7, 0.04), (420, 0.5, 0.03)], 0.2, seed=2, strike=0.6, strike_tau=0.004, strike_hp=900)
    L.add_at(y, clunk, 0.0)
    L.add_at(y, svf(r.standard_normal(n_(0.12)), 3000, q=0.8) * np.exp(-tt(0.12) / 0.03) * 0.5, 0.01)
    bell = L.modal([(2093, 1.0, 0.45), (2093 * 2.76, 0.45, 0.25), (2093 * 5.4, 0.2, 0.12), (1568, 0.6, 0.5)], 1.0, seed=5,
                   strike=0.2, strike_hp=4000, beat=0.003)
    L.add_at(y, bell, 0.11)
    return save("kaching", place(y, 0, "room", -16), fade_out=0.3)


def make_tada():
    """A bright music-box C major arpeggio + chord for the very end (C5 E5 G5 C6)."""
    y = np.zeros(n_(2.2))
    for i, nm in enumerate(["C5", "E5", "G5", "C6"]):
        L.add_at(y, xylo(NOTE[nm], 1.6, 0.8, seed=40 + i), i * 0.07)
    for nm in ["C4", "E4", "G4"]:
        L.add_at(y, pluck(NOTE[nm], 1.2, 0.35), 0.3)
    return save("tada", place(y, 0, "room", -14), fade_out=0.6)


def make_wind():
    """Lonely desert wind gust (for the indoor tumbleweed)."""
    r = rng(961); d = 1.4; t = tt(d); n = len(t)
    fc = 700 + 500 * np.sin(np.pi * t / d)
    y = svf(lp(r.standard_normal(n), 4000), fc, q=6) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return save("wind", place(y, 0, None), fade_in=0.1, fade_out=0.2)


def prep_sources():
    beds = dict(level=-20.0, by="integrated", fade_in=0.05, fade_out=0.05, trim_db=-80)
    save("crickets", load_src("reused/cricketslong_1"), **beds)
    save("party", load_src("restaurant"), **beds)
    save("choir", trim(load_src("reused/choir_3"), -45, 0.01, 0.3), fade_out=0.35)
    save("sparkle", trim(load_src("reused/sparkle_1"), -40, 0.005, 0.2, 1.2), fade_out=0.3)
    save("era", trim(load_src("reused/timelapse_2"), -40, 0.01, 0.2), fade_out=0.2)
    save("leaf", trim(load_src("reused/leaf_4"), -42, 0.01, 0.1, 1.0), fade_out=0.1)
    save("gasp", trim(load_src("gasp"), -42, 0.01, 0.15, 0.7), fade_out=0.15)
    save("crinkle", trim(load_src("crinkle"), -42, 0.005, 0.1), fade_out=0.1)
    save("chomp", trim(load_src("chomp"), -42, 0.003, 0.15, 0.8), fade_out=0.12)
    save("creak", trim(load_src("creak"), -45, 0.01, 0.2), fade_out=0.2)
    save("boop", trim(load_src("boop"), -40, 0.002, 0.1), fade_out=0.06)
    save("pop", trim(load_src("pop"), -40, 0.002, 0.15), fade_out=0.1)
    save("tick", trim(load_src("tick"), -45, 0.0, 0.1), fade_out=0.1)
    save("click", trim(load_src("click"), -40, 0.002, 0.1), fade_out=0.06)


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
    hit = lambda t, name, gain, note, **kw: add(t - onset(name), name, gain, note, **kw)   # transient on t
    mom = EV(6, "mom")
    # ---------------------------------------------------------------- the party (music + chatter) until "MOM!"
    add(0.05, "bday", -9, "Happy Birthday on toy xylophone + ukulele (cut by the scratch)", dur=mom - 0.05 - 0.02, fade_out=0.03, duck_db=7)
    add(0.0, "party", -20, "party chatter bed", dur=S0(5) + 0.05, fade_out=0.08, loop=True, duck_db=4)
    add(S0(4), "party", -16, "party chatter (wide shot)", offset=4.0, dur=S1(4) - S0(4), fade_in=0.05, fade_out=0.05, loop=True, duck_db=4)
    add(S0(2) + 0.05, "whoosh", -16, "into the void")
    hit(EV(2, "ass") + 0.35, "boop", -15, "question mark pop")
    add(S0(3) + 0.08, "sparkle", -11, "Mom's golden glow")
    add(S0(3) + 0.05, "choir", -20, "tiny heavenly 'ahh' for Mom", dur=1.2, fade_out=0.5, duck_db=4)
    add(S0(4) + 0.05, "whoosh", -18, "back to the party")
    # ---------------------------------------------------------------- the bathroom
    hit(EV(5, "pooped") + 0.42, "boop", -12, "cartoon bloop after 'pooped'")
    hit(mom - 0.06, "scratch", -6, "RECORD SCRATCH: the music stops on MOM!")
    add(S0(7), "crickets", -12, "crickets: Mom isn't here", dur=S1(7) - S0(7) + 0.25, fade_in=0.05, fade_out=0.25, loop=True, duck_db=3)
    add(S0(7) + 0.02, "wind", -15, "lonely wind for the tumbleweed")
    add(S0(7) + 0.1, "leaf", -16, "tumbleweed rustle")
    add(S0(8) + 0.02, "creak", -17, "the door creaks open a crack", dur=0.7, fade_out=0.2)
    add(S0(9) + 0.05, "crinkle", -14, "Dad's newspaper")
    hit(S0(11) + 0.08, "chomp", -13, "Uncle chewing")
    add(S0(12) + 0.1, "snore", -9, "Grandma's fake snore", duck_db=4)
    hit(S0(12) + 0.15, "pop", -17, "Zzz badge pop")
    # ---------------------------------------------------------------- the birthday boy
    kn = EV(13, "knocks")
    hit(kn, "knock", -5, "knock 1"); hit(kn + 0.2, "knock", -6, "knock 2")
    add(S0(14) + 0.15, "sparkle", -17, "hero glint on the kid")
    add(S0(15) + 0.02, "whoosh", -14, "into the void (fact)")
    add(S0(15) + 0.05, "dun", -12, "DUN: what you don't know", duck_db=3)
    hit(EV(16, "five"), "pop", -12, "AGE 5 badge pop")
    add(EV(16, "five") + 0.02, "sparkle", -15, "stars on AGE 5")
    add(S0(17) + 0.02, "whoosh", -18, "back to the door")
    hit(EV(17, "one"), "pop", -14, "1 YEAR badge pop")
    hit(EV(17, "experience") - 0.1, "click", -12, "sunglasses on")
    add(EV(17, "experience") + 0.0, "sparkle", -14, "sunglasses glint")
    hit(EV(19, "fold") + 0.15, "gasp", -16, "the family gasps")
    add(EV(20, "wipe") + 0.05, "rattle", -8, "the door rattles in its frame", duck_db=3)
    # ---------------------------------------------------------------- 10 minutes later + the hero exit + the $5
    add(S0(21) + 0.02, "era", -13, "time-lapse whoosh (10 minutes later)")
    add(S0(21) + 0.1, "tick", -15, "clock ticking (time passes)", dur=S1(21) - S0(21) - 0.1, fade_out=0.1)
    add(S0(22) + 0.0, "creak", -12, "the door swings open", dur=0.5, fade_out=0.15)
    add(S0(22) + 0.05, "choir", -10, "heavenly AHH: you did it", duck_db=4, fade_out=0.6)
    add(S0(22) + 0.1, "sparkle", -12, "hero sparkles")
    add(S0(22) + 0.25, "applause", -12, "the family claps", duck_db=4)
    hit(EV(23, "six") + 0.35, "pop", -20, "hand out (tiny pop)")
    dl = EV(24, "dollars")
    hit(dl + 0.38, "kaching", -6, "KA-CHING: five dollars")
    add(dl + 0.45, "sparkle", -14, "bill + sunglasses glint")
    add(dl + 0.75, "tada", -11, "music-box ta-da to end", duck_db=2)
    cues.sort(key=lambda c: c["t"])
    json.dump(cues, open(CUES, "w"), indent=1)
    return cues


def main():
    os.makedirs(L.SFX_DIR, exist_ok=True)
    prep_sources()
    mom = EV(6, "mom")
    make_bday(q=(mom - 0.35) / 26.0)
    make_scratch(); make_knock(); make_snore(); make_rattle(); make_applause(); make_kaching(); make_tada(); make_wind()
    make_whoosh(); L.make_dun()
    cues = build_cues()
    print(f"{'file':14s} {'dur':>6s} {'peak':>7s} {'Mmax':>7s} {'I':>7s}")
    for k, v in INFO.items():
        print(f"{k:14s} {v['dur']:6.2f} {v['peak_db']:7.1f} {v['mmax']:7.1f} {v['lufs_i']:7.1f}")
    print(f"wrote {len(INFO)} files to audio/sfx/ and {len(cues)} cues to audio/sfx_cues.json")


if __name__ == "__main__":
    main()
