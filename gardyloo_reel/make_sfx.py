#!/usr/bin/env python3
"""Sound effects for the wedding reel -> audio/sfx/*.wav + audio/sfx_cues.json (read by mix.py).

Two sources:
  * ElevenLabs sound effects (audio/sfx_src/<name>_<k>.mp3, flow eb7qlRn1EmAIRCBYfiKN, 4 takes each; the take
    used is in TAKES) for the sounds code can't fake well: baby crying, crowd gasp / "ooh", fake snore, record
    scratch, wedding music, hall chatter, glasses, chandelier, footsteps, sad violin, toilet flush ...
  * code-made (numpy, fixed seeds): punch whoosh, realization ding, sad "womp", eye blinks, heartbeat, drip,
    calm pad, impact boom, the rock-paper-scissors war-drum pattern (built from the ElevenLabs drum hits),
    the yell echoes (made from the voiceover itself), the "DUN DUN DUNNN".
Every cue is placed on a word of the voiceover (audio/word_onsets.json) or a shot cut (shots.json).
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

# ElevenLabs take chosen for each sound (picked from spectrograms + levels: clean, right length, no gaps)
TAKES = {
    "wedding_music": "wedding_music_long_3", "chatter": "chatter_long_1", "glasses": "glasses_4",
    "record_scratch": "record_scratch_2", "chairs": "chairs_4", "crowd_gasp": "crowd_gasp_2",
    "cricket": "cricket_1", "cough": "cough_4", "champagne": "champagne_pour_1", "phone_a": "phone_tap_4",
    "phone_b": "phone_tap_1", "snore_a": "snore_4", "snore_b": "snore_2", "inhale_long": "inhale_1",
    "inhale_short": "inhale_4", "chandelier": "chandelier_1", "baby": "baby_cry_2", "choir": "choir_1",
    "kids": "kids_cheer_3", "snare": "snare_roll_3", "drum_big": "drum_hit_2", "drum_a": "drum_hit_3",
    "drum_b": "drum_hit_4", "war": "war_drums_3", "sting_a": "dun_sting_1", "sting_b": "dun_sting_2",
    "sting_c": "dun_sting_3", "ooh": "crowd_ooh_4", "gasp_small": "crowd_gasp_3", "steps": "footsteps_3",
    "violin": "sad_violin_long_3", "flush": "toilet_flush_3",
}


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


def mk_yell_echo(line_no, taps=((0.30, -7), (0.60, -13), (0.90, -19), (1.20, -25)), wet_db=-10):
    """Echo of YOU's yell rolling through the hall: delayed, darker repeats + big hall reverb (wet only:
    the dry yell stays in the voice track)."""
    v, sr = sf.read(P("audio", "voiceover.wav"), always_2d=True)
    v = v.mean(1)
    s, e = line_span(line_no)
    y = v[n_(s - 0.03):n_(e + 0.12)].copy()
    y *= cosramp(len(y))[::-1] ** 0.02
    out = np.zeros(len(y) + n_(taps[-1][0] + 0.2))
    for k, (d, g) in enumerate(taps):
        add_at(out, lp(y, 3200 / (k + 1) ** 0.6) * 10 ** (g / 20), d)
    return place(out, 0, "hall", wet_db, dry=1.0)


def war_drums(t0, t1, hits):
    """Slow tribal pattern from the ElevenLabs drum hits between t0 and t1 (absolute times), plus big hits."""
    a, b, big = load("drum_a"), load("drum_b"), load("drum_big")
    a, b = seg(a, 0, 1.8, fo=0.3), seg(b, 0, 1.6, fo=0.3)
    L = n_(t1 - t0 + 3.0)
    out = np.zeros((L, 2))
    beat = 60 / 84                                       # 84 bpm, heavy and slow
    pattern = [(0, 1.0, a, 0), (1, 0.55, b, -2), (1.5, 0.45, b, -2), (2, 0.9, a, -3), (3, 0.6, b, 0)]
    k = 0
    while True:
        bar0 = k * 4 * beat
        if bar0 > (t1 - t0):
            break
        for (bt, g, smp, st) in pattern:
            tt_ = bar0 + bt * beat
            if tt_ < t1 - t0 - 0.05 and all(abs((t0 + tt_) - h) > 0.25 for h in hits):
                x = pitch(smp, st) * g * (0.75 + 0.25 * min(1.0, tt_ / 2.0))
                add_at(out, x, tt_)
        k += 1
    for h in hits:
        add_at(out, seg(big, 0, 3.0, fo=0.6) * 1.6, h - t0 - 0.01)
    return out


def dun_dun_dunnn():
    a, b, c = load("sting_a"), load("sting_b"), load("sting_c")
    out = np.zeros((n_(3.0), 2))
    add_at(out, seg(c, 0, 0.32, fo=0.08), 0.0)
    add_at(out, seg(c, 0, 0.32, fo=0.08) * 1.05, 0.38)
    long = A.make_dun()                                   # the orchestral DUN from the Thanksgiving reel
    add_at(out, long[:n_(2.2)] / np.abs(long).max() * np.abs(c).max() * 1.1, 0.78)
    return out


def steps_seq(t0, t1, every=0.62):
    st = load("steps")
    env = np.abs(st).max(axis=1)
    # first footstep transient only
    one = seg(st, 0, min(0.45, len(st) / SR), fo=0.15)
    out = np.zeros((n_(t1 - t0 + 1.5), 2))
    k, t = 0, 0.0
    while t < t1 - t0:
        add_at(out, pitch(one, -1.5 if k % 2 else -2.5) * (0.85 + 0.15 * (k % 2)), t)
        k += 1
        t += every
    return place(out.mean(1), 0, "hall", -9)


def muffled_switch(x, t_start, spans):
    """Music/chatter bed: muffled (through the bathroom wall) or clear (in the hall) per span, 30 ms crossfades.
    spans: [(t0, t1, 'clear'|'muffled', gain_db)] absolute times; x starts at t_start."""
    clear = x
    muff = lp(x, 520, 4) * 10 ** (-5 / 20)
    out = np.zeros_like(x)
    for (a, b, kind, g) in spans:
        i0, i1 = max(0, n_(a - t_start)), min(len(x), n_(b - t_start))
        if i1 <= i0:
            continue
        w = np.ones(i1 - i0)
        xf = min(n_(0.03), (i1 - i0) // 2)
        w[:xf] = cosramp(xf)
        w[-xf:] = cosramp(xf)[::-1]
        src = clear if kind == "clear" else muff
        out[i0:i1] += src[i0:i1] * w[:, None] * 10 ** (g / 20)
    return out


# ------------------------------------------------------------------------------------------------ cues
def build():
    cues = []

    def cue(name, x, t, gain_db, note, level=A.REF_LUFS, by="mmax", **kw):
        save(name, x, level=level, by=by)
        cues.append(dict(t=round(float(t), 3), file=f"audio/sfx/{name}.wav", gain_db=gain_db, note=note, **kw))

    stops = word(5, 2)                                   # "stops" -> record scratch, music dies
    # music bed: muffled in the bathroom shots, clear in the hall shots, cut by the scratch
    mus = load("wedding_music", trim=False)
    hall = [3, 6, 7]
    spans = []
    for i in range(1, 8):
        a, b = shot(i)
        b = min(b, stops + 0.03)
        spans.append((a, b, "clear" if i in hall else "muffled", -3.0 if i == 4 else 0.0))
    bed = muffled_switch(mus[:n_(stops + 0.1)], 0.0, spans)
    bed = fade(bed, 0.2, 0.04)
    cue("music_bed", bed, 0.0, -13.0, "wedding music (muffled in the bathroom, clear in the hall), dies on 'stops'",
        by="int", duck_db=5)
    # hall chatter: same switching, stops dead at the first yell
    yell1 = line_span(4)[0]
    ch = load("chatter", trim=False)
    spans = [(a, min(b, yell1 + 0.15), "clear" if i in hall else "muffled", 0.0)
             for i in range(1, 6) for (a, b) in [shot(i)]]
    chb = fade(muffled_switch(ch[:n_(yell1 + 0.2)], 0.0, spans), 0.3, 0.12)
    cue("chatter_bed", chb, 0.0, -19.0, "hall chatter, stops at the yell", by="int", duck_db=4)

    cue("sparkle", mk_sparkle(), shot(1)[0] + 0.7, -16.0, "watch sparkle")
    cue("whoosh_pooped", mk_whoosh(0.35, seed=2), word(2, 2) - 0.3, -15.0, "punch-in on 'pooped'")
    cue("inhale_1", seg(load("inhale_short"), 0, 0.9), word(3, 4) - 0.1, -12.0, "inhale before the yell",
        duck_db=2)
    # yell 1
    cue("boom_1", mk_boom(), yell1 - 0.02, -10.0, "impact under the yell (screen shake)", duck_db=0)
    cue("yell_echo_1", mk_yell_echo(4), yell1, -2.0, "echo of MOM! I'M DONE! through the hall", duck_db=1.5)
    cue("glasses", seg(load("glasses"), 0, 1.7, fo=0.3), shot(6)[0] + 0.04, -11.0, "champagne glasses rattle",
        duck_db=3)
    cue("record_scratch", seg(load("record_scratch"), 0, 1.0, fo=0.1), stops - 0.06, -4.0,
        "DJ record scratch, music cut", duck_db=1)
    # crowd turns
    cue("chairs", seg(load("chairs"), 0, 1.6, fo=0.3), word(6, 0) + 0.05, -14.0, "200 chairs creak", duck_db=3)
    cue("gasp", seg(load("crowd_gasp"), 0, 1.6, fo=0.4), word(6, 3) - 0.05, -10.0, "crowd gasp", duck_db=3)
    cue("ding_remember", mk_ding(), word(7, 2), -17.0, "tiny realization ding")
    s9 = shot(11)
    cue("cricket", seg(load("cricket"), 0, 1.9, fo=0.4), s9[0] + 0.35, -17.0, "cricket in the silence", duck_db=3)
    cue("cough", seg(load("cough"), 0, 1.0, fo=0.2), line_span(9)[1] + 0.25, -16.0, "awkward cough far away",
        duck_db=0)
    cue("blink_1", mk_blink(), word(10, 2) + 0.05, -15.0, "uncles' eyes dart")
    cue("blink_2", mk_blink(), word(10, 4) + 0.05, -15.0, "uncles' eyes dart back")
    cue("champagne", seg(load("champagne"), 0, 1.6, fo=0.4), shot(13)[0] + 0.05, -12.0,
        "champagne overflowing (frozen waiter)", duck_db=3)
    cue("womp", mk_womp(), word(12, 2) - 0.05, -13.0, "sad womp: the smile dies", duck_db=4)
    cue("phone_1", seg(load("phone_a"), 0, 0.8, fo=0.1), shot(15)[0] + 0.15, -15.0, "phone taps", duck_db=2)
    cue("phone_2", seg(load("phone_b"), 0, 1.0, fo=0.1), shot(16)[0] + 0.1, -14.0, "phone taps", duck_db=2)
    cue("snore_1", seg(load("snore_a"), 0, 1.9, fo=0.3), shot(17)[0] + 0.12, -9.0, "grandpa's fake snore",
        duck_db=4)
    cue("snore_2", seg(load("snore_b"), 0, 1.0, fo=0.25), word(14, 3) + 0.05, -10.0, "fake snore 2", duck_db=4)
    cue("inhale_2", seg(load("inhale_long"), 0, 1.6, fo=0.25), word(15, 0) + 0.1, -9.0, "huge inhale",
        duck_db=3)
    cue("whoosh_louder", mk_whoosh(0.3, 700, 4000, seed=3), word(16, 0) - 0.22, -12.0, "punch on 'Louder'")
    # yell 2 (bigger)
    yell2 = line_span(17)[0]
    cue("boom_2", mk_boom(), yell2 - 0.02, -6.0, "bigger impact under yell 2", duck_db=0)
    cue("yell_echo_2", mk_yell_echo(17, taps=((0.32, -5), (0.64, -10), (0.96, -15), (1.28, -20), (1.6, -26)),
                                    wet_db=-8), yell2, 0.0, "echo of MOM! I'M DOOONE!", duck_db=1.5)
    cue("chandelier", seg(load("chandelier"), 0, 2.4, fo=0.6), shot(20)[0] + 0.02, -9.0, "chandelier swings",
        duck_db=2)
    cue("baby", seg(load("baby"), 0, 2.6, fo=0.6), word(18, 3) - 0.08, -8.0, "baby starts crying", duck_db=3)
    cue("pad", mk_pad(2.0), shot(22)[0] + 0.05, -16.0, "calm documentary pad (twist)", duck_db=3)
    cue("choir", seg(load("choir"), 0, 1.6, fo=0.4), shot(23)[0] + 0.08, -12.0, "heavenly 'aaah' (kid trophy)",
        duck_db=4)
    cue("pop", mk_pop(), shot(24)[0] + 0.05, -14.0, "party popper")
    cue("kids", seg(load("kids"), 0, 1.6, fo=0.3), shot(24)[0] + 0.12, -12.0, "kids cheer", duck_db=4)
    cue("drip", mk_drip(), line_span(21)[1] + 0.12, -15.0, "drip back in the bathroom")
    # rock - paper - scissors
    hits = [word(23, 0), word(24, 0), word(25, 0)]
    wd = war_drums(shot(26)[0] + 0.05, word(26, 0) + 0.2, hits)
    cue("war_drums", wd, shot(26)[0] + 0.05, -7.0, "war drums + hits on Rock / Paper / Scissors", duck_db=3)
    cue("dun_rock", seg(load("drum_big"), 0, 2.0, fo=0.5), word(26, 2) - 0.02, -9.0,
        "low hit on 'Everyone throws rock'", duck_db=3)
    sn = load("snare")
    sn = seg(sn, 0.0, min(0.95, len(sn) / SR), fi=0.02, fo=0.02)
    roll = np.concatenate([sn, sn[::-1]] * 2)[:n_(1.25)]
    roll = fade(roll * np.linspace(0.35, 1.0, len(roll))[:, None], 0.15, 0.03)
    cue("snare_roll", roll, word(27, 0) + 0.05, -14.0, "tension snare roll", duck_db=2)
    pause0 = line_span(27)[1]
    cue("heart_1", mk_heartbeat(), pause0 + 0.25, -9.0, "heartbeat in the dramatic pause")
    cue("heart_2", mk_heartbeat(), pause0 + 0.75, -9.0, "heartbeat")
    cue("dun_dun_dunnn", dun_dun_dunnn(), word(28, 2) - 0.02, -6.0, "DUN DUN DUNNN on 'scissors'", duck_db=4)
    cue("ooh", seg(load("ooh"), 0, 1.6, fo=0.4), word(29, 3) - 0.1, -11.0, "crowd 'ooooh'", duck_db=3)
    cue("footsteps", steps_seq(shot(33)[0] + 0.1, shot(35)[0] + 0.4), shot(33)[0] + 0.1, -11.0,
        "slow footsteps down the hall", duck_db=3)
    vio = load("violin", trim=True)
    vstart = shot(33)[0] + 0.9
    vio = fade(vio[:n_(DUR - vstart + 0.05)], 0.8, 1.6)
    cue("violin", vio, vstart, -11.0, "slow sad violin (the 'sad song')", by="int", duck_db=4)
    fl = load("flush")
    fl = lp(seg(fl, 0, min(len(fl) / SR, DUR - (line_span(33)[1] + 0.2) - 0.02), fo=0.5), 2200)
    cue("flush", fl, line_span(33)[1] + 0.2, -13.0, "distant toilet flush at the very end", duck_db=0)

    cues.sort(key=lambda c: c["t"])
    json.dump(cues, open(P("audio", "sfx_cues.json"), "w"), indent=1)
    for c in cues:
        info = A.INFO[os.path.splitext(os.path.basename(c["file"]))[0]]
        print(f"{c['t']:6.2f}  {os.path.basename(c['file']):20s} {c['gain_db']:+5.1f} dB  {info['dur']:5.2f}s  "
              f"{c['note']}")
    print(f"{len(cues)} cues -> audio/sfx_cues.json")


if __name__ == "__main__":
    build()
