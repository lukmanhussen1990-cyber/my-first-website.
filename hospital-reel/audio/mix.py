"""Soundtrack for the hospital reel: voice + ambience + sneaky music (synth) + ElevenLabs SFX.
Writes audio/mix.wav (48 kHz stereo). Run with the scratch venv python (numpy, soundfile, librosa).
"""
import json, os
import numpy as np
import soundfile as sf
import librosa

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
D = json.load(open(os.path.join(HERE, "..", "shots.json")))
W = D["words"]
SH = {s["id"]: s for s in D["shots"]}
N = int(D["duration"] * SR) + SR // 10
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(3)

def db(x): return 10 ** (x / 20)
def rms(x): return np.sqrt(np.mean(x ** 2) + 1e-12)
def place(sig, t, gain_db=0.0, pan=0.0):
    i = int(t * SR)
    if i >= N or len(sig) == 0: return
    s = sig[: N - i] * db(gain_db)
    L[i:i + len(s)] += s * (1 - max(0, pan)); R[i:i + len(s)] += s * (1 + min(0, pan))
def load(name):
    y, _ = librosa.load(os.path.join(HERE, "sfx", name + ".mp3"), sr=SR, mono=True)
    return y
def fades(x, a=0.05, b=0.05):
    x = x.copy(); na, nb = int(a * SR), int(b * SR)
    if na: x[:na] *= np.linspace(0, 1, na)
    if nb: x[-nb:] *= np.linspace(1, 0, nb)
    return x
def bed(name, t0, t1, rel, fade=0.6):  # loop a sound between t0 and t1
    y = load(name); n = int((t1 - t0) * SR)
    while len(y) < n: y = np.concatenate([y, load(name)])
    place(fades(level(y[:n], rel), fade, fade), t0)

vo, _ = sf.read(os.path.join(HERE, "vo_final.wav"))
VO_RMS = rms(vo[np.abs(vo) > 0.01])
def level(sig, rel_db):  # loud part of sig sits rel_db under the voice
    loud = sig[np.abs(sig) > np.abs(sig).max() * 0.1]
    return sig * (VO_RMS / rms(loud)) * db(rel_db)
place(vo, 0.0)

# ---------------- sneaky pizzicato music (synth, Karplus-Strong) ----------------
def pluck(freq, dur=0.35, bright=0.5):
    n = int(dur * SR); p = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * (0.994 - 0.01 * (1 - bright))
    return out * np.exp(-np.arange(n) / SR * 6)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def sneaky(length):
    out = np.zeros(int(length * SR) + SR); beat = 60 / 112
    bass = [40, 47, 40, 47, 43, 47, 42, 46]            # E2 B2 E2 B2 G2 B2 F#2 A#2
    mel = [64, None, 67, None, 66, 64, None, 63, 64, None, 71, None, 70, None, 67, None]
    t, k = 0.0, 0
    while t < length:
        i = int(t * SR); s = pluck(hz(bass[k % 8]), 0.3, 0.3) * 0.9
        out[i:i + len(s)] += s[: len(out) - i]
        m = mel[k % 16]
        if m is not None:
            s = pluck(hz(m), 0.25, 0.8) * 0.55; j = int((t + beat / 2) * SR)
            out[j:j + len(s)] += s[: len(out) - j]
        t += beat; k += 1
    return out[: int(length * SR)]
t_sn0, t_sn1 = SH["06"]["t0"] - 0.05, SH["10"]["t0"] - 0.1
sn = sneaky(t_sn1 - t_sn0)
sn /= np.abs(sn).max()
duck = np.ones(len(sn))  # duck under the whisper
a, b = int((SH["09"]["t0"] - t_sn0) * SR), len(sn)
duck[a:b] = np.linspace(1, 0.55, b - a) if b > a else 1
place(fades(level(sn * duck, -10), 0.05, 0.6), t_sn0, 0, -0.1)

# ---------------- beds ----------------
bed("ambience1", 0.0, SH["23"]["t0"] + 0.4, -20, 0.8)
bed("ambience1", SH["28"]["t0"] - 0.2, SH["37"]["t0"] + 0.3, -20, 0.5)
bed("projector1", SH["23"]["t0"], SH["28"]["t0"], -13, 0.4)
bed("birds1", SH["37"]["t0"] + 0.3, D["duration"], -13, 1.2)

# ---------------- hits ----------------
place(fades(level(load("door2"), -16)[: int(1.4 * SR)], 0, 0.4), 0.0)          # entering
place(level(load("squish"), -6), W[13]["s"] + 0.02)                               # pooped
place(fades(level(load("sprinkler1"), -12)[: int(SH["11"]["dur"] * SR)], 0, 0.2), SH["11"]["t0"])
pen = level(load("pen2"), -11)
place(fades(pen[: int(1.3 * SR)], 0.02, 0.2), SH["13"]["t0"] + 0.15)              # scribble
place(fades(pen[int(1.7 * SR):], 0.02, 0.1), SH["14"]["t0"] + 0.55)               # underline
place(level(load("sting1"), -7), W[61]["s"] - 0.05)                               # dun dun DUN
place(level(load("click1"), -6), W[84]["e"] - 0.22)                              # wristband
for sid in ("28", "30", "32"):                                                    # calendar
    place(level(load("calendar1"), -12), SH[sid]["t0"] - 0.02)
# sad trombone "wah wah" after "changed your pants"
def wah(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    vib = 1 + 0.012 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t * 3)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    s = sum((0.7 ** k) * np.sin((k + 1) * ph) for k in range(7))
    return s * np.minimum(1, t / 0.04) * np.minimum(1, (dur - t) / 0.08)
ww = np.concatenate([wah(hz(58), 0.32), wah(hz(57), 0.45)])
place(level(ww, -18), W[133]["e"] + 0.05)
place(level(load("boom1"), -4), SH["34"]["t0"] + 0.03)                            # BOOM
pf = level(load("calendar2"), -15)
for k in range(4): place(pf[: int(0.5 * SR)], SH["36"]["t0"] + 0.1 + k * 0.55)    # page flips
place(fades(level(load("door1"), -12), 0, 0.5), SH["37"]["t0"])                  # door opens

mix = np.stack([L, R], 1)
mix /= max(1.0, np.abs(mix).max() / 0.95)
sf.write(os.path.join(HERE, "mix.wav"), mix.astype(np.float32), SR)
print("mix written %.2f s" % (len(mix) / SR))
