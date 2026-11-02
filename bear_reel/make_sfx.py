#!/usr/bin/env python3
"""Sound effects for the bear reel -> audio/sfx/*.wav + audio/sfx_cues.json (then mix.py makes the final mix).

Two sources:
  * ElevenLabs sound effects (eleven_text_to_sound_v2, 4 variations each, in audio/sfx_src/<name>_<k>.mp3,
    see audio/sfx_src/sessions.json): forest birds, crickets, leaf, scratching, branch snap, scary sting,
    growl, sniffs, footsteps, bear crying, birds flying away, dog whimper, squirrel, gulp, bear whimper,
    disgusted groan, bush rustle. PICK chooses the variation used.
  * Code-made (numpy, fixed seeds): deep thud, heartbeat, trail whoosh, tube tap, itch "zip", tension drone,
    plus the ding and the dramatic 'dun' from the previous reel (sfx_lib.py).
Level convention (same as last reel): every effect is normalised so its loudest 400 ms sits at -20 LUFS
(beds by integrated loudness); a cue's gain_db is then roughly its level relative to the narrator.
Cue times come from web/plan.js events (= measured word onsets), so picture, words and sound stay in sync.
Run: python3 make_sfx.py
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # sfx_lib.py lives next to this file
import sfx_lib as L
from sfx_lib import SR, save, place, lp, hp, bp, svf, att, tt, n_, rng, rms, cosramp, INFO, read_plan

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "audio", "sfx_src")
CUES = os.path.join(HERE, "audio", "sfx_cues.json")

# chosen ElevenLabs variation per sound (1..4) - picked by listening-proxy checks (spectrograms, levels, length)
PICK = {"forestlong": 1, "cricketslong": 1, "leaf": 1, "scratch": 1, "snap": 1, "sting": 1, "growl": 1, "sniff2": 1,
        "longsniff": 1, "steps": 1, "bearcry": 1, "birds": 1, "dogwhimper": 1, "squirrel": 1, "gulp": 1,
        "bearwhimper": 1, "disgust": 1, "bush": 1}
PICK_FILE = os.path.join(SRC, "pick.json")
if os.path.exists(PICK_FILE):
    PICK.update(json.load(open(PICK_FILE)))


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
def make_thud():
    """'Closer.': deep cinematic boom (pitch-dropping sub + soft knock) in a big space."""
    r = rng(1201); d = 1.8; t = tt(d)
    f = 46 * (1 + 1.6 * np.exp(-t / 0.035))
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.42) * att(t, 0.004)
    knock = lp(r.standard_normal(len(t)), 700) * np.exp(-t / 0.018) * 0.9
    y = sub + knock
    return save("thud", place(y, 0, "hall", -15), fade_out=0.4)


def make_heart():
    """One heartbeat 'lub-dub' (low thumps)."""
    r = rng(1301); d = 0.7; t = tt(d); y = np.zeros(len(t))
    for t0, a in [(0.0, 1.0), (0.16, 0.7)]:
        tl = np.maximum(t - t0, 0); on = (t >= t0)
        f = 55 * (1 + 0.5 * np.exp(-tl / 0.02))
        y += on * a * np.sin(2 * np.pi * np.cumsum(f * on) / SR) * np.exp(-tl / 0.07) * att(tl, 0.003)
        y += on * a * 0.35 * lp(r.standard_normal(len(t)), 300) * np.exp(-tl / 0.02)
    return save("heart", place(lp(y, 400), 0, "small", -20), fade_out=0.1)


def make_trail_whoosh():
    """Map shot: a long airy whoosh travelling left -> right, rising then fading (1.6 s)."""
    r = rng(1401); d = 1.7; t = tt(d); n = len(t)
    pk = 1.15
    fc = 300 * (3200 / 300) ** np.clip(t / pk, 0, 1) * np.where(t > pk, (1 - 0.5 * (t - pk) / (d - pk)), 1)
    y = svf(lp(r.standard_normal(n), 7000), fc, q=1.2)
    env = np.where(t < pk, (t / pk) ** 1.6, np.exp(-(t - pk) / 0.18)) * (1 - att(t - (d - 0.15), 0.15))
    y = y * env
    pan = np.clip(t / d, 0, 1) * 1.4 - 0.7
    a = (pan + 1) * np.pi / 4
    st = np.stack([y * np.cos(a), y * np.sin(a)], 1) * np.sqrt(2)
    wet = place(y, 0, "room", -12, dry=0.0)
    st = np.concatenate([st, np.zeros((len(wet) - len(st), 2))]) + wet
    return save("trail_whoosh", st, fade_in=0.02, fade_out=0.15)


def make_tap():
    """Empty cardboard tube tapped/squeezed: hollow 'tok'."""
    r = rng(1501); d = 0.25; t = tt(d)
    nz = r.standard_normal(len(t)) * np.exp(-t / 0.012)
    y = svf(nz, 950, q=6) * 1.0 + svf(nz, 2300, q=5) * 0.5 + svf(nz, 420, q=4) * 0.6
    return save("tap", place(y, 0.1, "small", -18), fade_out=0.05)


def make_itch():
    """Cartoon itch 'zip-zip-zip': three quick rising chirps."""
    d = 0.5; t = tt(d); y = np.zeros(len(t))
    for i, t0 in enumerate([0.0, 0.13, 0.26]):
        tl = t - t0; on = (tl >= 0) & (tl < 0.07)
        f = 900 + 1700 * np.clip(tl / 0.07, 0, 1)
        ph = 2 * np.pi * np.cumsum(f * on) / SR
        y += on * np.sin(ph) * np.sin(np.pi * np.clip(tl / 0.07, 0, 1)) * (1 - 0.15 * i)
    return save("itch", place(hp(y, 300), 0, "small", -22), fade_out=0.03)


def make_drone():
    """Tension bed (12.8 s): low fifth + slow pulsing rumble, swelling, for the bear's approach."""
    r = rng(1601); d = 12.8; t = tt(d); n = len(t)
    y = np.zeros(n)
    for f, a in [(41.2, 1.0), (61.7, 0.55), (82.4, 0.35), (123.5, 0.12)]:
        y += a * np.sin(2 * np.pi * f * t + r.random() * 6) * (1 + 0.25 * np.sin(2 * np.pi * 0.23 * t + f))
    rumble = svf(r.standard_normal(n), 90 + 40 * np.sin(2 * np.pi * 0.11 * t), q=2.0) * 0.6
    eerie = np.sin(2 * np.pi * 659.3 * t + 2 * np.sin(2 * np.pi * 0.31 * t)) * 0.025 * att(t - 4, 3.0)
    swell = 0.35 + 0.65 * np.clip(t / d, 0, 1) ** 1.5
    y = (y * 0.5 + rumble + eerie) * swell * att(t, 1.2) * (1 - att(t - (d - 1.0), 1.0))
    return save("drone", place(lp(y, 900), 0, "hall", -16), level=-20.0, by="integrated", fade_in=0.5, fade_out=1.0)


# ------------------------------------------------------------------------------------------- ElevenLabs
SNIFF2_ON = [0.0, 0.5]


def load_wav(name):
    import soundfile as sf
    return sf.read(os.path.join(L.SFX_DIR, name + ".wav"), always_2d=True)[0]


def prep_elevenlabs():
    # beds (loop-made): forest birds 12 s, crickets 8 s
    save("forest_amb", load_src("forestlong"), level=-20.0, by="integrated", fade_in=0.05, fade_out=0.05, trim_db=-80)
    save("crickets", load_src("cricketslong"), level=-20.0, by="integrated", fade_in=0.05, fade_out=0.05, trim_db=-80)
    save("leaf", trim(load_src("leaf"), max_len=1.2), fade_out=0.08)
    save("scratch", trim(load_src("scratch")), fade_out=0.05)
    save("snap", trim(load_src("snap"), -40, 0.005, 0.25, 1.6), fade_out=0.2)
    save("sting", trim(load_src("sting"), -45, 0.01, 0.4), fade_out=0.6)
    save("growl", trim(load_src("growl"), -40, 0.02, 0.2, 2.5), fade_out=0.3)
    save("sniff2", trim(load_src("sniff2"), -38), fade_out=0.08)
    save("longsniff", trim(load_src("longsniff"), -38, 0.02, 0.12, 1.6), fade_out=0.1)
    for i, k in enumerate([1, 4, 2]):   # three different heavy footsteps (one thump each, from 3 variations)
        st = trim(load_src("steps", k), -45, 0.01, 0.2)
        ons = onsets(st) or [0.0]
        seg = st[max(0, n_(ons[0] - 0.02)):n_(ons[0] + 0.55)]
        save(f"step{i + 1}", seg, fade_out=0.15)
    save("bearcry", join("bearcry", [3, 1]), fade_out=0.35)
    save("birds", join("birds", [2, 1], 0.12, -45), fade_out=0.5)
    save("dogwhimper", trim(load_src("dogwhimper"), -40, 0.01, 0.15, 1.4), fade_out=0.15)
    save("squirrel", trim(load_src("squirrel"), -40, 0.01, 0.1, 1.0), fade_out=0.1)
    save("gulp", trim(load_src("gulp"), -40, 0.01, 0.1, 0.9), fade_out=0.08)
    save("bearwhimper", trim(load_src("bearwhimper"), -40, 0.01, 0.2, 1.8), fade_out=0.25)
    save("disgust", trim(load_src("disgust"), -40, 0.01, 0.2, 1.5), fade_out=0.2)
    save("bush", trim(load_src("bush"), -42, 0.01, 0.1, 2.0), fade_out=0.15)


# ------------------------------------------------------------------------------------------- cues
def build_cues():
    plan = {s["id"]: s for s in read_plan()}
    ev = lambda sid, k: plan[sid]["events"][k]
    T0 = lambda sid: plan[sid]["t0"]
    T1 = lambda sid: plan[sid]["t1"]
    f = lambda name: f"audio/sfx/{name}.wav"
    cues = []
    add = lambda t, name, gain, note, **kw: cues.append(dict(t=round(t, 3), file=f(name), gain_db=gain, note=note, **kw))
    snap = ev("s07", "snap")
    # 1) forest birds from the first frame until the branch snaps (then ALL sound cuts out)
    add(0.0, "forest_amb", -13, "forest birds bed (cut at the snap)", dur=snap + 0.03, fade_out=0.03, loop=True, duck_db=4)
    add(ev("s03", "punch") + 0.02, "tap", -9, "empty tube tap")
    add(ev("s04", "grab") - 0.04, "leaf", -4, "leaf grab + tear")
    add(ev("s05", "itch") + 0.05, "itch", -10, "itch zip")
    a, b = ev("s06", "scratch")
    add(a, "scratch", -3, "frantic scratching", dur=b - a + 0.05, fade_out=0.06, loop=True)
    add(a + 0.02, "bush", -8, "bush shaking", dur=b - a, fade_out=0.1)
    add(snap - 0.01, "snap", 2, "branch SNAP", duck_db=0)
    # 2) silence ("You freeze"), then distant footsteps + tension
    for i, tt_ in enumerate(ev("s09", "thuds")):
        add(tt_, f"step{i % 3 + 1}", -9 + i * 1.5, "distant heavy step", lp=900)
    add(11.45, "bush", -7, "distant bushes moving", dur=1.4, fade_out=0.4, lp=2200, duck_db=2)
    add(T0("s09"), "drone", -9, "tension drone (bear approach)", dur=T0("s18") - T0("s09") + 0.25, fade_out=0.6, duck_db=3)
    add(ev("s10", "sting") - 0.03, "sting", -1, "scary music sting", duck_db=2)
    add(ev("s11", "growl") - 0.35, "growl", -2, "bear growl")
    add(ev("s12", "stop") - 0.05, "step2", -6, "last step before it stops")
    s1, s2 = ev("s13", "sniffs")
    add(s1 - SNIFF2_ON[0], "sniff2", -2, "sniff, sniff (2nd sniff on the 2nd event)")
    for i, s in enumerate(ev("s14", "steps")):
        add(s, f"step{i % 3 + 1}", -5 + i, "heavy step toward you")
    add(ev("s15", "look") + 0.18, "gulp", -6, "nervous gulp")
    for b_ in [22.95, 23.3] + ev("s17", "beats"):
        add(b_, "heart", -4, "heartbeat")
    # 3) the twist: calm
    add(T0("s18") - 0.02, "dun", -7, "'What you don't know' hit", duck_db=4)
    add(T0("s18"), "forest_amb", -20, "calm forest again (twist)", dur=T1("s20") - T0("s18"), fade_in=0.4, fade_out=0.3, loop=True, duck_db=3)
    add(ev("s19", "x7") - 0.01, "ding", -5, "x7 ding")
    add(ev("s20", "dog") + 0.1, "dogwhimper", -6, "sad bloodhound whimper")
    t0_, t1_ = ev("s21", "trail")
    add(t0_ - 0.1, "trail_whoosh", -6, "stink trail travels for miles")
    add(t1_ - 0.02, "sniff2", -6, "map bear sniffs", dur=0.5, fade_out=0.1)
    # 4) closer
    for i, s in enumerate(ev("s22", "steps")):
        add(s, f"step{i % 3 + 1}", -4 + i, "step closer")
    add(T0("s22"), "drone", -12, "tension again", dur=T0("s24") - T0("s22") + 0.3, fade_in=0.3, fade_out=0.3, duck_db=3)
    add(ev("s23", "thud") - 0.01, "thud", 0, "'Closer.' boom", duck_db=0)
    add(ev("s24", "sniff") - 0.05, "longsniff", 0, "one big sniff", duck_db=2)
    add(ev("s25", "tears") + 0.35, "bearwhimper", -6, "bear whimpers, eyes watering")
    add(ev("s26", "pinch") + 0.05, "disgust", -4, "muffled disgusted groan")
    add(ev("s27", "wail") - 0.05, "bearcry", 2, "bear runs away crying", fade_out=0.3, duck_db=3)
    for i in range(4):
        add(ev("s27", "wail") + 0.1 + i * 0.36, f"step{i % 3 + 1}", -6 - i * 2.5, "running steps fading", lp=2500)
    add(ev("s28", "burst") - 0.06, "birds", 3, "the whole flock flies away", duck_db=3)
    add(ev("s28", "burst") + 0.25, "squirrel", -6, "squirrel squeaks and runs")
    # 5) ending: quiet, no birds
    add(T0("s29") - 0.05, "crickets", -15, "empty quiet forest (no birds)", dur=44.37 - T0("s29") + 0.05, fade_in=0.5, fade_out=0.6, loop=True, duck_db=3)
    cues.sort(key=lambda c: c["t"])
    json.dump(cues, open(CUES, "w"), indent=1)
    return cues


def main():
    os.makedirs(L.SFX_DIR, exist_ok=True)
    prep_elevenlabs()
    make_thud(); make_heart(); make_trail_whoosh(); make_tap(); make_itch(); make_drone()
    L.make_ding(); L.make_dun()
    global SNIFF2_ON
    x2 = load_wav("sniff2"); SNIFF2_ON = onsets(x2, -14, 0.2)[:2] or [0.0, 0.5]
    print("sniff2 onsets (s):", [round(v, 3) for v in SNIFF2_ON])
    cues = build_cues()
    print(f"{'file':14s} {'dur':>6s} {'peak':>7s} {'Mmax':>7s} {'I':>7s}")
    for k, v in INFO.items():
        print(f"{k:14s} {v['dur']:6.2f} {v['peak_db']:7.1f} {v['mmax']:7.1f} {v['lufs_i']:7.1f}")
    print(f"wrote {len(INFO)} files to audio/sfx/ and {len(cues)} cues to audio/sfx_cues.json")


if __name__ == "__main__":
    main()
