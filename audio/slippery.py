# Sound for "Who named this fish?" (the slippery dick short): the user's voice (gain only) + an original goofy
# oom-pah score (tuba, plucks, glock, brushes; dreamy vibes on the reef; soft at night; a final hit on "fish?")
# ducked under the voice + synthesized SFX on the picture's beats. Master -14 LUFS integrated, peak <= -1 dBTP,
# 48 kHz stereo, exactly 54.0 s.  Usage: python -I audio/slippery.py   (writes out/slippery/mix.wav + stems)
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
from dsp import SR, ns, rng, lp, hp, bp, pan, st, place, fades, dbg, integrated, momentary_max, true_peak, read_wav, write_wav, colored, make_ir, convolve_st
import instruments as I
import sfx_gen as G

ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "out", "slippery")
os.makedirs(OUT, exist_ok=True)
DUR = 54.0
N = ns(DUR)
W = json.load(open(os.path.join(ROOT, "src", "videos", "slippery", "words.json")))
norm = lambda w: "".join(ch for ch in w.lower() if ch.isalpha() or ch == "'")


def at(w, n=1):
    k = 0
    for x in W:
        if norm(x["w"]) == w:
            k += 1
            if k == n:
                return x["s"]
    raise KeyError(w)


# ---------------------------------------------------------------- voice
v, sr = read_wav(os.path.join(ROOT, "voice", "voice.wav"))
assert sr == SR, sr
voice = np.zeros((2, N))
place(voice, v[0], 0.0)
vI = integrated(voice)
print(f"voice {vI:.1f} LUFS")

# ---------------------------------------------------------------- music
BPM = 116
B = 60 / BPM
R = rng(5)
music = np.zeros((2, N))
CH = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [59, 62, 67])]  # C Am F G
REEF0, REEF1, NIGHT0, YELL0 = at("you", 2) - 0.08, at("you", 3) - 0.1, at("so", 6) - 0.1, at("who") - 0.11
HIT = at("fish", 3) + 0.05
MEL = [72, 74, 76, 79, 76, 74, 72, None, 71, 72, 74, 72, 67, None, 69, 71]  # goofy two-bar motif (eighths)


def section(t):
    if t < REEF0: return "groove"
    if t < REEF1: return "reef"
    if t < NIGHT0: return "groove"
    if t < YELL0: return "night"
    return "yell"


t = 0.0
beat = 0
while t < HIT:
    bar, b4 = beat // 4, beat % 4
    root, chord = CH[bar % 4]
    sec = section(t)
    if sec in ("groove", "night", "yell"):
        soft = sec != "groove"
        if b4 in (0, 2):
            f = I.m2f(root if b4 == 0 else root + 7)
            place(music, pan(I.brass(f, B * 0.42, vel=0.55 if soft else 0.8, r=R, kind="soft" if soft else "tuba"), -0.1), t)
        else:
            for k, m in enumerate(chord):
                place(music, pan(I.pluck(I.m2f(m), vel=0.35 if soft else 0.5, r=R, dur=0.5, bright=0.6), 0.25), t + 0.012 * k)
            if sec == "groove":
                place(music, pan(I.brush(0.45, R), 0.1), t)
        if sec == "groove" and t > 1.8:
            for e in range(2):
                m = MEL[(beat * 2 + e) % 16]
                if m is not None and (bar % 4) in (0, 1):
                    place(music, pan(I.glock(I.m2f(m + 12), vel=0.32, r=R, dur=1.0), 0.35), t + e * B / 2)
        if sec == "yell":
            a_ = (t - YELL0) / (HIT - YELL0)
            for ts, vv in I.snare_roll(0.0, B, 0.2 + 0.6 * a_, 0.3 + 0.6 * a_, R):
                place(music, pan(I.snare(vv * 0.6, R, dur=0.2), 0.0), t + ts)
    elif sec == "reef":
        for e in range(2):
            m = chord[(beat * 2 + e) % 3] + 12
            place(music, pan(I.vibes(I.m2f(m), vel=0.4, r=R, dur=1.4), (-0.4 if e else 0.4)), t + e * B / 2)
        if b4 == 0:
            place(music, I.pad([I.m2f(x) for x in chord], B * 4, vel=0.35, r=R), t)
    t += B
    beat += 1
# the final hit on "fish?": low tuba + horn stab + cymbal
for f in (I.m2f(36), I.m2f(48)):
    place(music, I.brass(f, 0.7, vel=1.0, r=R, kind="tuba", fall=-5.0), HIT)
place(music, I.brass(I.m2f(67), 0.5, vel=0.9, r=R, kind="stab"), HIT)
place(music, I.cymbal(0.8, R, dur=1.8), HIT)
music = convolve_st(music, make_ir(1.1, 3, hf=0.6)) * 0.35 + music
music[:, ns(DUR - 0.25):] *= np.linspace(1, 0, N - ns(DUR - 0.25))

# duck under speech (keyed from words.json)
duck = np.ones(N)
for x in W:
    a, b = ns(x["s"] - 0.05), ns(x["e"] + 0.12)
    duck[max(0, a):min(N, b)] = dbg(-3.0)
k = ns(0.06)
duck = np.convolve(duck, np.ones(k) / k, mode="same")
music *= duck
music *= dbg((vI - 10.0) - integrated(music))

# ---------------------------------------------------------------- sound effects
sfx = np.zeros((2, N))
r = rng(9)


def ev(x, t, lu=-8.0, p=0.0):
    """place one event at t, its max momentary loudness lu LU relative to the voice"""
    x = pan(x, p) if np.asarray(x).ndim == 1 else x
    m = momentary_max(x)
    if np.isfinite(m):
        x = x * dbg(vI + lu - m)
    place(sfx, x, t)


def tick(f0=1800, dur=0.05):
    tt_ = np.arange(ns(dur)) / SR
    return np.sin(2 * np.pi * f0 * tt_) * np.exp(-tt_ / (dur / 5))


def bloop(f0=500, f1=1100, dur=0.12):
    tt_ = np.arange(ns(dur)) / SR
    f = f0 + (f1 - f0) * (tt_ / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt_ / dur)


def slap(r):
    n = ns(0.09)
    tt_ = np.arange(n) / SR
    return bp(r.standard_normal(n), 700, 4000, 1) * np.exp(-tt_ / 0.012) + lp(r.standard_normal(n), 300) * np.exp(-tt_ / 0.02) * 0.6


def fwump(r, dur=0.35):
    n = ns(dur)
    tt_ = np.arange(n) / SR
    return lp(r.standard_normal(n), 500) * np.exp(-tt_ / 0.09) + bp(r.standard_normal(n), 1500, 5000) * np.exp(-tt_ / 0.05) * 0.2


ev(G.whoosh(0.45, r, peak=0.18), at("i", 1) - 0.25, -12)                            # flash after the hook
ev(np.concatenate([tick(2637, 0.08), tick(3520, 0.25)]), at("debt") - 0.06, -5, 0.2)  # ka-ching
ev(I.glock(I.m2f(96), 0.6, r, 0.8), at("debt") - 0.02, -10, 0.2)
ev(G.whoosh(0.35, r, peak=0.05, f_lo=1500, f_hi=5000), at("debt"), -12, 0.2)         # receipt zip
ev(G.splash_big(r), at("jumped") - 0.02, -9, -0.2)
ev(G.whoosh(0.6, r, peak=0.3), at("jumped"), -14)
t_land = at("bowl") + 0.04
ev(G.push_thump(r), t_land, -6)
tl = t_land + 0.2
while tl < at("so", 1) - 0.15:
    ev(slap(r), tl, -13, 0.1)
    tl += 0.2
ev(G.clink(r, 2200, 0.2), at("lid"), -9, 0.3)                                        # lid on the bowl
ev(bloop(300, 700, 0.15), at("bigger", 1), -9, 0.3)                                  # pop: medium tank
ev(G.whoosh(0.5, r, peak=0.08), at("bigger", 2) - 0.03, -9)                          # BIG tank
ev(I.timpani(I.m2f(38), 0.9, r, 1.6), at("bigger", 2), -6)
ev(G.rattle(1.3, r, 26), at("won't") - 0.1, -15, 0.1)                                # flakes shake
for w in ("crabs", "worms", "sea"):
    ev(bloop(600, 1300, 0.1), at(w) - 0.03, -12, 0.1)
ev(G.bubbles(1.7, r, 9), at("fancy") - 0.1, -16, 0.3)
tt0 = at("fancy")
for i in range(5):
    ev(slap(r) * 0.4, tt0 + i * 0.28, -20, 0.2)                                       # chewing
ev(I.brass(I.m2f(50), 0.25, 0.7, r, kind="soft"), at("die") - 0.05, -10)               # sad trombone
for i, m in enumerate((50, 49, 48)):
    ev(I.brass(I.m2f(m - 2), 0.22, 0.6, r, kind="soft", fall=-4.0 if i == 2 else 0.0), at("die") + 0.22 + i * 0.24, -12)
for i in range(4):
    ev(G.stroll_step(r), at("so", 3) + 0.05 + i * 0.32, -14, -0.2)                      # walking in with the sack
ev(lp(colored(ns(1.2), r, 0.5), 900) * np.hanning(ns(1.2)), at("so", 3), -16)          # sack drag
n_b = 66
for k_ in range(0, n_b, 3):
    ev(G.push_thump(r), at("so", 4) + 0.05 + k_ * 0.024, -13, 0.4)                     # bags piling up
ev(I.timpani(I.m2f(36), 1.0, r, 1.4), at("sand", 3), -6)
ev(G.push_thump(r), at("fuck", 1), -9)
ev(G.whoosh(0.6, r, peak=0.25, f_lo=200, f_hi=1200), at("you", 2) - 0.35, -10)        # into the reef
ev(G.water_bed(at("you", 3) - at("you", 2), r, close=0.6), at("you", 2) - 0.08, -18)
ev(G.bubbles(7.0, r, 6), at("you", 2), -19, -0.3)
for i in range(4):
    ev(fwump(r), at("bury") + 0.1 + i * 0.17, -11, -0.3 + 0.2 * i)                    # diving into the sand
ev(G.whoosh(0.5, r, peak=0.2), at("you", 3) - 0.3, -11)                              # back home
ev(fwump(r, 0.5), at("bowl", 2), -8)
ev(G.crickets(DUR - (at("so", 6) - 0.1), r), at("so", 6) - 0.1, -22, 0.4)              # night
ev(G.bubbles(5.0, r, 3), at("so", 6), -21, 0.3)
ev(tick(4200, 0.03), at("fish", 2) - 0.36, -12, 0.1)                                  # flashlight click
ev(bloop(900, 1600, 0.08), at("hides") + 0.05, -16, 0.4)
ev(G.push_thump(r), at("fuck", 2), -8)
ev(bloop(400, 1400, 0.14), at("fish", 3) - 0.12, -9, 0.4)                              # fish pops out

# ---------------------------------------------------------------- mix + master
mix = voice + music + sfx
g = dbg(-14.0 - integrated(mix))
mix *= g
peak = 10 ** (-1.2 / 20)
mix = np.tanh(mix / peak) * peak                                                      # soft clip as the safety limiter
mix = fades(mix, 0.002, 0.25)
print(f"mix {integrated(mix):.1f} LUFS, TP {true_peak(mix):.2f} dBTP, music {integrated(music * g):.1f}, sfx {integrated(sfx * g):.1f}, voice {integrated(voice * g):.1f}")
write_wav(os.path.join(OUT, "mix.wav"), mix)
for name, x in (("voice", voice), ("music", music), ("sfx", sfx)):
    write_wav(os.path.join(OUT, f"stem_{name}.wav"), x * g)
print("wrote", os.path.join(OUT, "mix.wav"))
