# Sound for the farmer / lion / goat / grass riddle (Hindi voice): the user's voice (gain only) + an original playful
# score (plucked melody over a bouncy bass, brushes; a thinking pad + clock tick for the question; a slow sad bit for
# "seven trips"; a hit on the bridge) ducked under the voice + synthesized SFX (pops, lion growl, goat bleat, chomp,
# river, birds, paddles, slide whistle, cheer). Master -14 LUFS, peak <= -1 dBTP, 48 kHz stereo, exactly 82.5 s.
# Usage: python -I audio/sher.py [--no-music]   (writes out/sher/mix.wav)
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
from dsp import SR, ns, rng, lp, hp, bp, pan, place, fades, dbg, integrated, momentary_max, true_peak, read_wav, write_wav, colored, make_ir, convolve_st
import instruments as I
import sfx_gen as G

ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "out", "sher")
os.makedirs(OUT, exist_ok=True)
DUR = 82.5
N = ns(DUR)
W = json.load(open(os.path.join(ROOT, "src", "videos", "sher", "words.json"), encoding="utf-8"))
norm = lambda w: re.sub(r"[।,?.…]", "", w)


def at(w, n=1):
    k = 0
    for x in W:
        if norm(x["w"]) == w:
            k += 1
            if k == n:
                return x["s"]
    raise KeyError(w)


# ---------------------------------------------------------------- voice
v, sr = read_wav(os.path.join(ROOT, "voice", "sher", "voice.wav"))
assert sr == SR, sr
voice = np.zeros((2, N))
place(voice, v[0], 0.0)
vI = integrated(voice)

# ---------------------------------------------------------------- music
R = rng(3)
music = np.zeros((2, N))
BPM = 108
B = 60 / BPM
CH = [(50, [62, 66, 69]), (50, [62, 66, 69]), (55, [62, 67, 71]), (57, [61, 64, 69])]  # D D G A
MEL = [74, 76, 78, 81, 78, 76, 74, None, 73, 74, 76, 74, 69, None, 71, 73]
T_THINK, T_ASK, T_ANS, T_TIRED, T_BRIDGE = at("किसान", 2) - 0.15, at("तो", 3) - 0.1, at("जवाब") - 0.1, at("किसान", 7) - 0.1, at("फिर", 3) - 0.4
T_PUL = at("पुल")


def sec(t):
    if t < T_THINK: return "groove"
    if t < T_ANS: return "think"
    if t < T_TIRED: return "groove"
    if t < T_BRIDGE: return "sad"
    return "build"


t, beat = 0.0, 0
while t < T_PUL:
    bar, b4 = beat // 4, beat % 4
    root, chord = CH[bar % 4]
    s = sec(t)
    if s == "groove":
        if b4 in (0, 2):
            place(music, pan(I.brass(I.m2f(root - 12 + (7 if b4 == 2 else 0)), B * 0.4, vel=0.6, r=R, kind="soft"), -0.1), t)
        else:
            for k, m in enumerate(chord):
                place(music, pan(I.pluck(I.m2f(m), vel=0.4, r=R, dur=0.45, bright=0.7), 0.25), t + 0.01 * k)
            place(music, pan(I.brush(0.4, R), 0.1), t)
        for e in range(2):
            m = MEL[(beat * 2 + e) % 16]
            if m is not None and bar % 4 in (0, 1):
                place(music, pan(I.pluck(I.m2f(m), vel=0.45, r=R, dur=0.6, bright=0.9, pos=0.08), -0.3), t + e * B / 2)
    elif s == "think":
        if b4 == 0:
            place(music, I.pad([I.m2f(x) for x in chord], B * 4, vel=0.3, r=R), t)
        place(music, pan(I.vibes(I.m2f(chord[beat % 3] + 12), vel=0.3, r=R, dur=1.2), 0.3 if beat % 2 else -0.3), t)
    elif s == "sad":
        if b4 == 0:
            place(music, I.pad([I.m2f(x - 1) for x in chord], B * 4, vel=0.3, r=R), t)
    elif s == "build":
        for ts, vv in I.snare_roll(0.0, B, 0.3, 0.6, R):
            place(music, pan(I.snare(vv * 0.6, R, dur=0.2), 0.0), t + ts)
    t += B
    beat += 1
for f in (I.m2f(38), I.m2f(50)):
    place(music, I.brass(f, 0.8, vel=1.0, r=R, kind="tuba", fall=-5.0), T_PUL)
place(music, I.brass(I.m2f(69), 0.5, vel=0.9, r=R, kind="stab"), T_PUL)
place(music, I.cymbal(0.8, R, dur=1.8), T_PUL)
music = convolve_st(music, make_ir(1.0, 4, hf=0.6)) * 0.3 + music
music[:, ns(DUR - 0.3):] *= np.linspace(1, 0, N - ns(DUR - 0.3))
duck = np.ones(N)
for x in W:
    a, b = ns(x["s"] - 0.05), ns(x["e"] + 0.12)
    duck[max(0, a):min(N, b)] = dbg(-3.0)
k = ns(0.06)
music *= np.convolve(duck, np.ones(k) / k, mode="same")
music *= dbg((vI - 10.0) - integrated(music))

# ---------------------------------------------------------------- sound effects
sfx = np.zeros((2, N))
r = rng(8)


def ev(x, t, lu=-8.0, p=0.0):
    x = pan(x, p) if np.asarray(x).ndim == 1 else x
    m = momentary_max(x)
    if np.isfinite(m):
        x = x * dbg(vI + lu - m)
    place(sfx, x, t)


def tone(f0, f1, dur, shape="sin"):
    tt = np.arange(ns(dur)) / SR
    f = f0 + (f1 - f0) * tt / dur
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) if shape == "sin" else 2 * ((ph / (2 * np.pi)) % 1) - 1) * np.sin(np.pi * tt / dur)


def growl(dur=0.9):
    n = ns(dur); tt = np.arange(n) / SR
    env = np.minimum(1, tt / 0.08) * np.exp(-np.maximum(0, tt - 0.35) / 0.25)
    saw = tone(95, 70, dur, "saw")
    return (lp(saw, 700) * 0.8 + lp(r.standard_normal(n), 900) * 0.5) * (0.6 + 0.4 * np.sin(2 * np.pi * 26 * tt)) * env


def bleat(dur=0.6):
    n = ns(dur); tt = np.arange(n) / SR
    f = 520 * (1 + 0.04 * np.sin(2 * np.pi * 9 * tt))
    saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    return bp(saw, 500, 2600) * (0.55 + 0.45 * np.sin(2 * np.pi * 9 * tt)) * np.sin(np.pi * tt / dur) ** 0.6


def chomp():
    n = ns(0.18); tt = np.arange(n) / SR
    return lp(r.standard_normal(n), 1800) * np.exp(-tt / 0.03) + tone(180, 90, 0.18) * 0.6


def paddle():
    n = ns(0.35); tt = np.arange(n) / SR
    return bp(r.standard_normal(n), 400, 3000) * np.exp(-tt / 0.08) * np.minimum(1, tt / 0.03)


pop = lambda: tone(500, 1200, 0.12)
ev(pop(), at("शेर", 1) - 0.03, -10); ev(growl(), at("शेर", 1) + 0.05, -8, -0.3)
ev(pop(), at("बकरी", 1) - 0.03, -10); ev(bleat(), at("बकरी", 1) + 0.1, -10, 0.3)
ev(pop(), at("घास", 1) - 0.03, -10); ev(G.rattle(0.3, r, 20) * 0.4, at("घास", 1), -18, 0.4)
ev(G.whoosh(0.8, r, peak=0.4), at("और", 2) - 0.1, -14)
river_end = at("किसान", 2) - 0.15
ev(G.water_bed(DUR, r, close=0.5), 0.0, -24)
ev(G.bird_chirps(DUR, r, density=0.35), 0.0, -26, 0.5)
ev(pop(), at("एक", 3) - 0.03, -12, 0.3)
ev(growl(0.7), at("शेर", 3), -12, -0.3)
ev(chomp(), at("खा", 1), -6); ev(bleat(0.4) * 1.0, at("खा", 1) + 0.12, -9, 0.3)
for i in range(5):
    ev(chomp() * 0.5, at("खा", 2) - 0.4 + i * 0.3, -16, 0.1)
ev(pop(), at("किसान", 2) + 0.3, -14, 0.4)
ev(tone(1400, 300, 1.2) * 0.6, at("अब", 2), -12)                            # slide whistle: head spinning
ev(tone(300, 1400, 0.9) * 0.6, at("अब", 2) + 1.2, -14)
for i in range(3):
    ev(pop(), at("तो", 3) + 0.2 + i * 0.25, -14, (-0.4, 0.4, 0.0)[i])
for i in range(int((T_ANS - at("वीडियो")) / 0.5)):
    ev(G.clink(r, 3000 if i % 2 else 2400, 0.05), at("वीडियो") + i * 0.5, -16, 0.2)  # tick tock
ev(G.whoosh(0.7, r, peak=0.3), T_ANS + 0.05, -10)
from importlib import import_module
TR = [(at("बकरी", 8), at("बकरी", 8) + 1.7), (at("वापस", 1) - 0.4, at("वापस", 1) + 1.0), (at("शेर", 7), at("शेर", 7) + 1.5),
      (at("वापस", 2), at("वापस", 2) + 1.6), (at("घास", 7), at("घास", 7) + 1.5), (at("वापस", 3) - 0.3, at("वापस", 3) + 1.0), (at("बकरी", 12), at("बकरी", 12) + 1.3)]
for a, b in TR:
    tt = a
    while tt < b:
        ev(paddle(), tt, -17, 0.2); tt += 0.45
ev(bleat(0.5), at("बकरी", 10), -13, 0.2)
ev(growl(0.6) * 0.6, at("लेकिन", 3) + 0.3, -15, -0.2)
ev(tone(200, 160, 0.6) * 0.4, at("मतलब") - 0.2, -18)                          # lion yawn-ish
ev(I.glock(I.m2f(84), 0.6, r, 1.0), at("सब") + 0.05, -9); ev(I.glock(I.m2f(88), 0.6, r, 1.0), at("सब") + 0.2, -9); ev(I.glock(I.m2f(91), 0.6, r, 1.2), at("सब") + 0.35, -9)
ev(I.brass(I.m2f(50), 0.25, 0.7, r, kind="soft"), at("सात") - 0.05, -12)
for i, m in enumerate((50, 49, 48)):
    ev(I.brass(I.m2f(m - 2), 0.22, 0.6, r, kind="soft", fall=-4.0 if i == 2 else 0.0), at("सात") + 0.22 + i * 0.24, -13)
ev(G.whoosh(0.9, r, peak=0.5), at("कि", 3) - 0.2, -12)
ev(G.push_thump(r), T_PUL, -8)

if "--no-music" in sys.argv:  # user asked for no background music (voice + SFX only)
    music *= 0.0
mix = voice + music + sfx
g = dbg(-14.0 - integrated(mix))
mix *= g
peak = 10 ** (-1.2 / 20)
mix = fades(np.tanh(mix / peak) * peak, 0.002, 0.3)
print(f"voice {vI:.1f} -> mix {integrated(mix):.1f} LUFS, TP {true_peak(mix):.2f} dBTP")
write_wav(os.path.join(OUT, "mix.wav"), mix)
print("wrote", os.path.join(OUT, "mix.wav"))
