#!/usr/bin/env python3
"""Sound effects for the mansion reel -> audio/sfx/*.wav + audio/sfx_cues.json (then mix.py makes the final mix).

Two sources (same method as the bear reel):
  * ElevenLabs sound effects (eleven_text_to_sound_v2, in audio/sfx_src/<name>_<k>.mp3, sessions in
    audio/sfx_src/sessions.json, chosen take in pick.json): city + park ambience, stomach growl, shop bell, door
    knocks, angel choir, big door creak, sparkles, slide whistle, running steps, water jet, splash, drips, motor,
    door, record scratch, laughing, penguin calls, love harp, egg crack, towel, key jingle, time-lapse whoosh.
  * Code-made (numpy, fixed seeds): button beeps, an 8-bit disco loop, heartbeat, spin whir, speed whoosh,
    bubble squeak, mug clink, plus the ding and the dramatic 'dun' from the last reels (sfx_lib.py).
Level convention: every effect is normalised so its loudest 400 ms sits at -20 LUFS (beds by integrated loudness);
a cue's gain_db is then roughly its level relative to the narrator. Cue times come from web/plan.js events
(= measured word onsets). Run: python3 make_sfx.py
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sfx_lib as L
from sfx_lib import SR, save, place, lp, hp, bp, svf, att, tt, n_, rng, rms, cosramp, INFO, read_plan

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "audio", "sfx_src")
CUES = os.path.join(HERE, "audio", "sfx_cues.json")
PICK = json.load(open(os.path.join(SRC, "pick.json")))


def load_src(name, k=None):
    """Decode an ElevenLabs mp3 -> float stereo (n, 2) at 48 kHz."""
    k = k or PICK[name]
    path = os.path.join(SRC, f"{name}_{k}.mp3")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(float)


def join(name, ks, xfade=0.08, thr=-40):
    """Several variations of one sound back to back (each trimmed), equal-power crossfades."""
    parts = [trim(load_src(name, k), thr, 0.01, 0.05) for k in ks]
    out = parts[0]
    for q in parts[1:]:
        n = min(n_(xfade), len(out) // 2, len(q) // 2)
        w = np.sin(np.linspace(0, np.pi / 2, n))[:, None]
        mid = out[-n:] * w[::-1] + q[:n] * w
        out = np.concatenate([out[:-n], mid, q[n:]])
    return out


def env_db(x, win=0.02):
    m = np.abs(x).max(1) if x.ndim == 2 else np.abs(x)
    h = n_(win)
    pad = np.pad(m, (0, (-len(m)) % h))
    return 20 * np.log10(pad.reshape(-1, h).max(1) + 1e-9), h


def trim(x, thr_db=-42.0, pre=0.01, post=0.08, max_len=None):
    """Cut leading/trailing quiet parts (relative to the clip's peak)."""
    e, h = env_db(x)
    on = np.nonzero(e > e.max() + thr_db)[0]
    a, b = max(0, on[0] * h - n_(pre)), min(len(x), (on[-1] + 1) * h + n_(post))
    y = x[a:b]
    if max_len:
        y = y[:n_(max_len)]
    return y


def strongest(x, dur):
    """The loudest `dur` seconds of a clip (by RMS)."""
    n = n_(dur)
    if len(x) <= n:
        return x
    p = (x ** 2).sum(1)
    c = np.convolve(p, np.ones(n), "valid")
    i = int(np.argmax(c))
    return x[i:i + n]


def onsets(x, thr_db=-18.0, min_gap=0.25):
    """Transient onsets (s) in a clip: frames rising above (peak + thr_db) after a quieter stretch."""
    e, h = env_db(x, 0.01)
    out, last = [], -9
    for i in range(1, len(e)):
        if e[i] > e.max() + thr_db and e[i] - e[max(0, i - 3):i].min() > 6 and (i - last) * h / SR > min_gap:
            out.append(i * h / SR); last = i
    return out




# ------------------------------------------------------------------------------------------- code-made
def make_beep_set():
    """Button beeps: 8 short square-ish blips (pentatonic) + a fast 'all buttons' burble."""
    notes = [784, 880, 988, 1175, 1319, 1568, 1760, 2093]
    for i, f in enumerate(notes):
        d = 0.09; t = tt(d)
        y = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + np.sin(2 * np.pi * f * 2 * t) * 0.2
        y *= att(t, 0.003) * np.exp(-t / 0.05)
        save(f"beep{i}", place(lp(y, 6000), (i - 3.5) * 0.08, "small", -20), fade_out=0.01)
    r = rng(2101); d = 1.0; t = tt(d); y = np.zeros(len(t))
    for k in range(30):
        t0 = k * 0.03 + r.random() * 0.01; f = notes[int(r.random() * 8)] * (1 + 0.5 * (k % 3 == 0))
        tl = t - t0; on = (tl >= 0) & (tl < 0.05)
        y += on * np.sign(np.sin(2 * np.pi * f * np.maximum(tl, 0))) * np.exp(-np.maximum(tl, 0) / 0.03) * 0.5
    save("beepall", place(lp(y, 7000), 0, "small", -18), fade_out=0.08)


def make_disco(d=6.2, bpm=120):
    """8-bit disco loop: kick on every beat, open hats on the off-beats, octave bass (Am7 - D7), chord stabs."""
    r = rng(2201); t = tt(d); n = len(t); y = np.zeros(n)
    beat = 60 / bpm
    def tone(f, t0, dur, kind='sq', amp=1.0, decay=0.15):
        i0, i1 = n_(t0), min(n, n_(t0 + dur))
        if i0 >= n: return
        tl = t[i0:i1] - t0
        ph = 2 * np.pi * f * tl
        w = np.sign(np.sin(ph)) if kind == 'sq' else (2 * ((f * tl) % 1) - 1) if kind == 'saw' else np.sin(ph)
        y[i0:i1] += amp * w * np.exp(-tl / decay) * att(tl, 0.004)
    nb = int(d / beat) + 1
    bass_roots = [110.0, 110.0, 146.83, 146.83]          # A2 A2 D3 D3 (per bar of 4 beats)
    for b in range(nb):
        t0 = b * beat
        # kick: pitch-drop sine
        i0, i1 = n_(t0), min(n, n_(t0 + 0.25))
        if i0 < n:
            tl = t[i0:i1] - t0; f = 55 * (1 + 2.5 * np.exp(-tl / 0.03))
            y[i0:i1] += 0.9 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tl / 0.12)
        # hats on the off-beat (noise burst)
        i0, i1 = n_(t0 + beat / 2), min(n, n_(t0 + beat / 2 + 0.08))
        if i0 < n:
            tl = t[i0:i1] - t0 - beat / 2
            y[i0:i1] += 0.25 * hp(r.standard_normal(i1 - i0), 7000) * np.exp(-tl / 0.03)
        root = bass_roots[(b // 4) % 4 if False else ((b // 4) % 2) * 2]
        tone(root, t0, beat * 0.45, 'sq', 0.35, 0.18)
        tone(root * 2, t0 + beat / 2, beat * 0.45, 'sq', 0.3, 0.12)
        if b % 2 == 1:                                    # chord stab on 2 and 4
            chord = [220.0, 261.63, 329.63, 392.0] if (b // 4) % 2 == 0 else [293.66, 369.99, 440.0, 523.25]
            for f in chord: tone(f, t0, 0.18, 'saw', 0.11, 0.08)
        if b % 4 == 3:                                    # little melody fill
            for k, f in enumerate([659.25, 783.99, 880.0]): tone(f, t0 + k * beat / 3, beat / 3.2, 'sq', 0.12, 0.09)
    y = lp(y, 7500)
    return save("disco", place(y, 0, "room", -16), level=-20.0, by="integrated", fade_out=0.05)


def make_heart():
    """One heartbeat 'lub-dub' (low thumps)."""
    r = rng(1301); d = 0.7; t = tt(d); y = np.zeros(len(t))
    for t0, a in [(0.0, 1.0), (0.16, 0.7)]:
        tl = np.maximum(t - t0, 0); on = (t >= t0)
        f = 55 * (1 + 0.5 * np.exp(-tl / 0.02))
        y += on * a * np.sin(2 * np.pi * np.cumsum(f * on) / SR) * np.exp(-tl / 0.07) * att(tl, 0.003)
        y += on * a * 0.35 * lp(r.standard_normal(len(t)), 300) * np.exp(-tl / 0.02)
    return save("heart", place(lp(y, 400), 0, "small", -20), fade_out=0.1)


def make_whir(d=1.5):
    """Spinning seat: motor whir rising in pitch + a wobbling swoosh."""
    r = rng(2301); t = tt(d); n = len(t)
    f = 70 + 160 * np.clip(t / d, 0, 1) ** 0.7
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = (np.sign(np.sin(ph)) * 0.3 + np.sin(ph * 2) * 0.3) * (0.7 + 0.3 * np.sin(2 * np.pi * 6 * t))
    sw = svf(r.standard_normal(n), 800 + 600 * np.sin(2 * np.pi * (2 + 2 * t) * t) ** 2, q=1.5) * 0.4
    y = (lp(y, 2500) + sw) * att(t, 0.15) * (1 - att(t - (d - 0.2), 0.2))
    return save("whir", place(y, 0, "small", -16), fade_out=0.1)


def make_whoosh(d=0.9, name="whoosh"):
    r = rng(2401); t = tt(d); n = len(t)
    fc = 400 * (3000 / 400) ** np.clip(t / (d * 0.7), 0, 1)
    y = svf(lp(r.standard_normal(n), 7000), fc, q=1.0) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return save(name, place(y, 0, "room", -14), fade_out=0.1)


def make_bubble_squeak(d=1.0):
    """The level's bubble slides: a slow rubbery squeak glissando."""
    r = rng(2501); t = tt(d)
    f = 700 + 900 * (np.clip(t / d, 0, 1) ** 1.3) + 40 * np.sin(2 * np.pi * 9 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * 0.6 + np.sin(2 * ph) * 0.25 + np.sin(3 * ph) * 0.1
    y *= (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 14 * t))) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.6
    return save("squeak", place(bp(y, 400, 4000), 0.1, "small", -20), fade_out=0.08)


def make_clink():
    """Ceramic mug set into hands: a soft 'tok' + tiny ring."""
    r = rng(2601); d = 0.6; t = tt(d)
    nz = r.standard_normal(len(t)) * np.exp(-t / 0.006)
    y = svf(nz, 1800, q=8) * 0.8 + svf(nz, 3400, q=10) * 0.4
    y += sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / tau) for f, a, tau in [(2650, 0.25, 0.12), (4100, 0.12, 0.08)])
    return save("clink", place(y, 0, "small", -18), fade_out=0.1)


# ------------------------------------------------------------------------------------------- ElevenLabs
def prep_elevenlabs():
    save("city", load_src("citylong"), level=-20.0, by="integrated", fade_in=0.05, fade_out=0.05, trim_db=-80)
    save("park", load_src("parklong"), level=-20.0, by="integrated", fade_in=0.05, fade_out=0.05, trim_db=-80)
    save("drips", load_src("driplong"), level=-20.0, by="integrated", fade_in=0.05, fade_out=0.05, trim_db=-80)
    save("jet", trim(load_src("jetlong"), -50, 0.0, 0.2), fade_out=0.4)
    save("laugh", trim(load_src("laughlong"), -45, 0.01, 0.3), fade_out=0.3)
    save("stomach", trim(load_src("stomach"), -40, 0.01, 0.15), fade_out=0.15)
    save("stomach_small", trim(load_src("stomach", 4), -40, 0.01, 0.1, 0.8), fade_out=0.15)
    save("shopbell", trim(load_src("shopbell"), -45, 0.005, 0.3), fade_out=0.2)
    kn = trim(load_src("knock"), -45, 0.01, 0.3)
    ons = onsets(kn, -20, 0.15) or [0.0]
    for i in range(3):
        o = ons[i % len(ons)]
        save(f"knock{i + 1}", kn[max(0, n_(o - 0.01)):n_(o + 0.35)], fade_out=0.12)
    save("choir", trim(load_src("choir"), -45, 0.01, 0.3), fade_out=0.35)
    save("bigdoor", trim(load_src("bigdoor"), -45, 0.01, 0.3), fade_out=0.25)
    save("sparkle", trim(load_src("sparkle"), -40, 0.005, 0.2, 1.2), fade_out=0.3)
    save("slide", trim(load_src("slide"), -40, 0.01, 0.2), fade_out=0.2)
    save("run", trim(load_src("run"), -42, 0.01, 0.15), fade_out=0.15)
    save("splash", trim(load_src("splash"), -45, 0.005, 0.2), fade_out=0.2)
    save("door", trim(load_src("dooropen"), -45, 0.01, 0.2), fade_out=0.15)
    save("scratch", trim(load_src("scratch"), -40, 0.0, 0.15), fade_out=0.1)
    save("penguin1", trim(load_src("penguin", 2), -40, 0.01, 0.15), fade_out=0.12)
    save("penguin2", trim(load_src("penguin", 1), -40, 0.01, 0.15), fade_out=0.12)
    save("aww", trim(load_src("aww"), -42, 0.01, 0.3), fade_out=0.4)
    save("eggcrack", trim(load_src("eggcrack"), -42, 0.01, 0.2), fade_out=0.2)
    save("towel", trim(load_src("towel"), -40, 0.01, 0.15), fade_out=0.12)
    save("key", trim(load_src("key"), -40, 0.005, 0.3, 2.0), fade_out=0.4)
    save("timelapse", trim(load_src("timelapse"), -40, 0.01, 0.2), fade_out=0.2)


# ------------------------------------------------------------------------------------------- cues
def build_cues():
    plan = {s["id"]: s for s in read_plan()}
    ev = lambda sid, k: plan[sid]["events"][k]
    T0 = lambda sid: plan[sid]["t0"]
    T1 = lambda sid: plan[sid]["t1"]
    f = lambda name: f"audio/sfx/{name}.wav"
    cues = []
    add = lambda t, name, gain, note, **kw: cues.append(dict(t=round(t, 3), file=f(name), gain_db=gain, note=note, **kw))
    END = T1("s44")
    # 1) the street
    add(0.0, "city", -12, "city street bed", dur=T1("s04") + 0.05, fade_out=0.12, loop=True, duck_db=4)
    add(ev("s02", "rumble") - 0.06, "stomach", -1, "stomach growl", duck_db=2)
    add(T0("s03") + 0.04, "shopbell", -8, "cafe door bell")
    add(ev("s04", "no1") - 0.08, "shopbell", -11, "pizza door bell", lp=4500)
    # 2) the mansion outside: calm garden (park bed, low)
    add(T0("s05"), "park", -19, "garden ambience outside the mansion", dur=T1("s13") - T0("s05") + 0.05, fade_in=0.1, fade_out=0.2, loop=True, duck_db=3)
    for i, k in enumerate(ev("s05", "knocks") + [ev("s06", "knock")]):
        add(k - 0.015, f"knock{i % 3 + 1}", -1 - (i == 2) * 2, "knock on the giant door", duck_db=1)
    add(ev("s07", "reveal") - 0.12, "choir", -7, "mansion reveal 'aaah'", duck_db=4)
    add(ev("s08", "open") - 0.08, "bigdoor", -2, "giant doors creak open", duck_db=3)
    add(ev("s08", "open") + 0.25, "sparkle", -10, "golden light")
    add(ev("s09", "glint") - 0.02, "sparkle", -8, "rich guy sparkle")
    add(ev("s10", "gold") - 0.02, "sparkle", -7, "gold robe sparkles")
    add(ev("s12", "please") + 0.04, "sparkle", -11, "puppy-eyes twinkle")
    # 3) the hallway
    add(ev("s14", "long") - 0.15, "slide", -6, "the hallway stretches (slide whistle)", duck_db=4)
    add(ev("s15", "gold") - 0.02, "sparkle", -7, "gold everywhere")
    add(T0("s16") + 0.02, "whoosh", -9, "speed whoosh")
    add(T0("s16") + 0.05, "run", -3, "running steps on marble", dur=T1("s16") - T0("s16"), fade_out=0.1, loop=True)
    # 4) the bathroom
    add(T0("s17") + 0.05, "choir", -6, "golden toilet reveal 'aaah'", duck_db=4)
    for k in range(6):
        add(ev("s17", "thirty") + k * 0.07, f"beep{k}", -12, "buttons light up")
    add(ev("s18", "q1") + 0.02, "beep2", -14, "question beep")
    t, k = ev("s19", "press") - 0.03, 0
    while t < ev("s19", "all"):
        add(t, f"beep{(k * 5) % 8}", -9, "button press"); t += 0.11; k += 1
    add(ev("s19", "all") - 0.02, "beepall", -6, "all the buttons at once")
    sp = ev("s20", "spray")
    add(sp - 0.06, "jet", -2, "water jet blasts up", dur=T1("s22") - sp + 0.1, fade_out=0.9, duck_db=4)
    add(ev("s20", "ceiling") - 0.05, "splash", -3, "splash on the ceiling", duck_db=3)
    add(ev("s20", "ceiling") + 0.1, "drips", -9, "indoor rain / drips", dur=T1("s24") - ev("s20", "ceiling"), fade_in=0.3, fade_out=0.5, loop=True, duck_db=3)
    add(T1("s24"), "drips", -18, "last drips", dur=T1("s32") - T1("s24"), fade_out=0.6, loop=True, duck_db=2)
    m, sc = ev("s21", "music"), ev("s25", "scratch")
    add(m - 0.02, "disco", -9, "8-bit disco music", dur=sc - m + 0.06, fade_out=0.04, loop=True, duck_db=6)
    add(ev("s22", "spin") - 0.05, "whir", -7, "the seat spins", dur=T1("s22") - ev("s22", "spin") + 0.05, fade_out=0.25)
    add(ev("s23", "door") - 0.05, "door", -4, "bathroom door opens")
    add(sc - 0.05, "scratch", 0, "record scratch, music stops", duck_db=1)
    add(ev("s26", "laugh") - 0.06, "laugh", -4, "he bursts out laughing", dur=T1("s27") - ev("s26", "laugh") + 0.05, fade_out=0.6, duck_db=7)
    add(ev("s28", "blush") + 0.1, "heart", -12, "soft heartbeat")
    add(ev("s29", "beat") - 0.02, "heart", -3, "heartbeat")
    add(ev("s29", "beat") + 0.4, "heart", -4, "heartbeat")
    add(ev("s30", "stomach") + 0.05, "stomach_small", -10, "small belly gurgle")
    add(ev("s30", "time") - 0.02, "heart", -4, "heartbeat again")
    add(ev("s31", "level") - 0.02, "ding", -6, "the spirit level 'ding'")
    add(ev("s32", "drift") + 0.05, "squeak", -9, "the bubble slides")
    # 5) the fact: New York, the zoo
    add(T0("s33") + 0.1, "dun", -7, "'What you don't know' hit", duck_db=4)
    add(T0("s33"), "park", -13, "park ambience (New York zoo)", dur=T1("s37") - T0("s33"), fade_in=0.4, fade_out=0.3, loop=True, duck_db=4)
    add(ev("s35", "roy") + 0.05, "penguin1", -6, "Roy squawks")
    add(ev("s35", "silo") + 0.05, "penguin2", -6, "Silo squawks")
    add(ev("s36", "love") - 0.06, "aww", -6, "love harp")
    add(ev("s37", "crack") - 0.06, "eggcrack", -3, "egg cracks, chick peeps")
    add(ev("s37", "together") - 0.02, "sparkle", -10, "family sparkle")
    # 6) home
    add(ev("s38", "towel") - 0.15, "towel", -4, "fluffy towel")
    add(ev("s39", "coffee") - 0.03, "clink", -8, "mug into hands")
    add(ev("s40", "key") - 0.04, "key", -4, "golden key jingle")
    add(T0("s41") + 0.02, "timelapse", -5, "days fly by")
    add(ev("s42", "present") - 0.1, "aww", -8, "presenting your own bathroom")
    add(ev("s43", "name") - 0.02, "sparkle", -6, "name plaque sparkle")
    add(T0("s44") + 0.12, "door", -8, "your door opens")
    add(T0("s44") + 0.3, "choir", -7, "heavenly 'aaah' (your bathroom)", duck_db=4)
    add(ev("s44", "welcome") + 0.05, "sparkle", -10, "welcome home sparkle")
    cues.sort(key=lambda c: c["t"])
    json.dump(cues, open(CUES, "w"), indent=1)
    return cues


def main():
    os.makedirs(L.SFX_DIR, exist_ok=True)
    prep_elevenlabs()
    make_beep_set(); make_disco(); make_heart(); make_whir(); make_whoosh(); make_bubble_squeak(); make_clink()
    L.make_ding(); L.make_dun()
    cues = build_cues()
    print(f"{'file':14s} {'dur':>6s} {'peak':>7s} {'Mmax':>7s} {'I':>7s}")
    for k, v in INFO.items():
        print(f"{k:14s} {v['dur']:6.2f} {v['peak_db']:7.1f} {v['mmax']:7.1f} {v['lufs_i']:7.1f}")
    print(f"wrote {len(INFO)} files to audio/sfx/ and {len(cues)} cues to audio/sfx_cues.json")


if __name__ == "__main__":
    main()
