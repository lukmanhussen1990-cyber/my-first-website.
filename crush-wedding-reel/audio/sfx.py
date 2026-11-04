# Synthesize quiet sound effects with numpy/scipy and mix them UNDER the original voiceover.
# The voice samples are passed through untouched (no pitch/tempo/EQ change); SFX are summed in.
import subprocess, sys, wave
import numpy as np
from scipy import signal

SR = 44100
voice_path, out_path = sys.argv[1], sys.argv[2]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", voice_path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
voice = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
N = len(voice)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def T(sec): return np.arange(int(sec * SR)) / SR
def db(x): return 10 ** (x / 20)
def add(t0, sig, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N: return
    n = min(len(sig), N - i0)
    if i0 < 0: sig = sig[-i0:]; n = min(len(sig), N); i0 = 0
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L[i0:i0 + n] += sig[:n] * gain * l * 1.414
    R[i0:i0 + n] += sig[:n] * gain * r * 1.414
def env(n, a=0.01, r=0.1, sustain=True):
    e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    if nr < n: e[-nr:] *= np.linspace(1, 0, nr)
    return e
def bp(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'high', fs=SR, output='sos'), x)
def norm(x): m = np.abs(x).max(); return x / m if m > 0 else x
_ir = None
def reverb(x, wet=0.3, length=1.6):
    global _ir
    if _ir is None or len(_ir) != int(length * SR):
        n = int(length * SR); tt = np.arange(n) / SR
        _ir = rng.standard_normal(n) * np.exp(-tt * 4.2); _ir = lp(_ir, 5000); _ir /= np.sqrt((_ir ** 2).sum())
    y = signal.fftconvolve(x, _ir)[: len(x) + int(length * SR)]
    out = np.zeros(len(y)); out[: len(x)] = x * (1 - wet)
    return out + y * wet * 0.9
def midi(m): return 440 * 2 ** ((m - 69) / 12)

# ---------------------------------------------------------------- church organ: "Here Comes the Bride" (Wagner, 1850, public domain)
def organ_note(f, dur, vel=1.0):
    t = T(dur + 0.25)
    bars = [(0.5, 0.5), (1, 1.0), (2, 0.7), (3, 0.42), (4, 0.33), (6, 0.18), (8, 0.14)]
    y = np.zeros(len(t))
    for h, a in bars:
        for det in (-0.0015, 0.0015):
            y += a * np.sin(2 * np.pi * f * h * (1 + det) * t + h)
    y *= 1 + 0.06 * np.sin(2 * np.pi * 5.6 * t)
    e = np.ones(len(t)); na = int(0.035 * SR); e[:na] = np.linspace(0, 1, na)
    nd = int(dur * SR); e[nd:] = np.linspace(1, 0, len(t) - nd) ** 2
    return lp(y * e, 3200) * vel
beat = 0.6
t0 = 2.15
mel = [(60, 1), (65, .75), (65, .25), (65, 2), (60, 1), (67, .75), (64, .25), (65, 2), (60, 1), (65, .75), (70, .25), (70, 1), (69, .75), (67, .25), (65, .75), (64, .25), (65, .75), (67, .25), (65, 2.2)]
chords = [([41, 53, 57, 60], 4), ([36, 52, 55, 58], 2), ([41, 53, 57, 60], 2), ([41, 53, 57, 60], 2), ([46, 53, 58, 62], 1), ([36, 52, 55, 60], 1), ([41, 53, 57, 60], 2), ([41, 53, 57, 60], 6.0)]
org = np.zeros(int(16 * SR))
tt = 0
for m, d in mel:
    s = organ_note(midi(m + 12), d * beat * 0.95, 0.8); i = int(tt * SR); org[i:i + len(s)] += s[: len(org) - i]; tt += d * beat
tt = 0
for ns, d in chords:
    for m in ns:
        s = organ_note(midi(m), d * beat * 0.98, 0.32); i = int(tt * SR); org[i:i + len(s)] += s[: len(org) - i]
    tt += d * beat
cut = int((13.18 - t0) * SR)
org[cut:] = 0
fade = int(0.08 * SR); org[cut - fade:cut] *= np.linspace(1, 0, fade)
# gentle duck under "If anyone objects, speak now"
duck = np.ones(len(org)); a, b = int((10.9 - t0) * SR), int((13.18 - t0) * SR); duck[a:b] = 0.55
org *= duck
org = reverb(org, 0.38, 2.2)
add(t0, norm(org), db(-24))

# ---------------------------------------------------------------- birds outside (intro + ending)
def chirp(f0, f1, dur):
    t = T(dur); f = np.linspace(f0, f1, len(t)); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.sin(np.pi * t / dur) ** 2
for (a, b) in [(0.2, 2.0), (29.7, 34.3)]:
    tt = a
    while tt < b:
        for k in range(rng.integers(2, 4)):
            f0 = rng.uniform(3200, 4600)
            add(tt + k * 0.09, chirp(f0, f0 * rng.uniform(1.1, 1.4), 0.06), db(-38), rng.uniform(-0.7, 0.7))
        tt += rng.uniform(0.35, 0.8)

# ---------------------------------------------------------------- door creak (sneaking in)
def creak(dur, f0=140):
    t = T(dur); walk = np.cumsum(rng.standard_normal(len(t))) / SR * 40
    f = f0 + 40 * np.sin(2 * np.pi * 1.3 * t) + walk
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = signal.sawtooth(ph)
    y = bp(saw, 600, 1100) * 0.7 + bp(saw, 1500, 2200) * 0.4
    return y * env(len(t), 0.05, 0.15)
add(4.25, norm(creak(0.65)), db(-30), 0.3)
# tiptoe taps
for k in range(7):
    tap = lp(rng.standard_normal(int(0.03 * SR)), 1800) * np.exp(-T(0.03) * 120)
    add(4.4 + k * 0.14, norm(tap), db(-40), 0.2)
# boing when hopping into the pew
t = T(0.45); f = 180 + 260 * (1 - np.exp(-t * 9)) + 30 * np.sin(2 * np.pi * 28 * t) * np.exp(-t * 4)
add(5.6, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6), db(-30))
# seat squeak on landing
add(5.9, bp(rng.standard_normal(int(0.12 * SR)), 900, 2400) * np.exp(-T(0.12) * 30), db(-34))

# ---------------------------------------------------------------- sparkle chimes on the bride
def bell(f, dur=1.4):
    t = T(dur); y = np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3) + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 6)
    return y * np.exp(-t * 3.2) * env(len(t), 0.002, 0.05)
for tt, notes in [(3.16, [84, 88, 91, 96]), (6.46, [86, 89, 93, 98]), (32.72, [88, 91, 96])]:
    for k, m in enumerate(notes): add(tt + k * 0.07, bell(midi(m)), db(-34), -0.4 + k * 0.25)
# lovey "ding" for the hearts
for k, m in enumerate([79, 83, 86]): add(7.32 + k * 0.1, bell(midi(m), 0.8), db(-33), 0.2)

# ---------------------------------------------------------------- "meh" bwomp
t = T(0.55); f = 220 * np.exp(-t * 1.6)
bw = signal.square(2 * np.pi * np.cumsum(f) / SR, 0.3); bw = lp(bw, 900) * env(len(t), 0.01, 0.2)
add(9.0, norm(bw), db(-31))

# ---------------------------------------------------------------- record scratch before "Silence."
t = T(0.24); fm = 380 + 1100 * np.abs(np.sin(2 * np.pi * 5.5 * t + 0.4))
sc = signal.sawtooth(2 * np.pi * np.cumsum(fm) / SR) * 0.6 + rng.standard_normal(len(t)) * 0.5
sc = bp(sc, 250, 3500) * env(len(t), 0.005, 0.06)
add(13.13, norm(sc), db(-21))
# crickets during the silence
for k in range(3):
    base = 13.5 + k * 0.32
    for j in range(3):
        tc = T(0.028); add(base + j * 0.045, np.sin(2 * np.pi * 4700 * tc) * np.sin(np.pi * tc / 0.028), db(-36), 0.5)

# ---------------------------------------------------------------- the poop (comedic fart) + whoosh on the zoom
t = T(0.55); f0 = 78 + 25 * np.sin(np.pi * t / 0.55) + 6 * rng.standard_normal(len(t)).cumsum() / np.sqrt(np.arange(1, len(t) + 1))
ph = 2 * np.pi * np.cumsum(f0) / SR
fart = signal.square(ph, 0.25) * (0.6 + 0.4 * np.sin(2 * np.pi * 17 * t)) + 0.3 * rng.standard_normal(len(t))
fart = lp(fart, 700, 3) * env(len(t), 0.01, 0.18)
add(15.44, norm(fart), db(-21))
def whoosh(dur, f0=300, f1=3000):
    n = int(dur * SR); x = rng.standard_normal(n); y = np.zeros(n); s = 0.0
    fc = np.geomspace(f0, f1, n) if f1 > f0 else np.geomspace(f0, f1, n)
    for i in range(n):
        a = 1 - np.exp(-2 * np.pi * fc[i] / SR); s += a * (x[i] - s); y[i] = s
    return y * np.sin(np.pi * np.arange(n) / n) ** 1.5
add(15.38, norm(whoosh(0.22, 400, 4000)), db(-33))

# ---------------------------------------------------------------- crazy laugh with echo (formant "ha-ha-ha")
def formant_voice(f0curve, vowel=(750, 1150, 2600), bw=(90, 110, 160)):
    ph = 2 * np.pi * np.cumsum(f0curve) / SR
    src = signal.sawtooth(ph, 0.85) + 0.08 * rng.standard_normal(len(ph))
    out = np.zeros(len(src))
    for F, B in zip(vowel, bw):
        out += bp(src, max(60, F - B), F + B, 2) * (1.0 if F == vowel[0] else 0.6)
    return out
def laugh(dur, f0=270, rate=6.2):
    n = int(dur * SR); t = np.arange(n) / SR
    syl = (t * rate) % 1
    amp = np.where(syl < 0.62, np.clip(np.sin(np.pi * np.minimum(syl, 0.62) / 0.62), 0, 1) ** 0.6, 0)
    k = np.floor(t * rate)
    f = f0 * (1.25 - 0.05 * (k % 5)) * (1 + 0.04 * np.sin(2 * np.pi * 5 * t))
    vox = formant_voice(f)
    breath = bp(rng.standard_normal(n), 1200, 4000) * np.where(syl < 0.12, 1, 0) * 0.5
    return (vox * amp + breath) * env(n, 0.03, 0.2)
def echo(x, d=0.21, fb=0.45, taps=4):
    y = np.zeros(len(x) + int(d * SR * taps)); y[: len(x)] += x
    for k in range(1, taps + 1): i = int(d * SR * k); y[i:i + len(x)] += x * fb ** k
    return y
lg = reverb(echo(norm(laugh(2.35))), 0.35, 1.4)
add(16.85, norm(lg), db(-24), -0.2)
lg2 = reverb(echo(norm(laugh(2.3, 300, 6.8))), 0.35, 1.4)
add(25.55, norm(lg2), db(-26), 0.2)
# body thump when falling off the bench
def thump(dur=0.35, f0=95, f1=40, noise=0.4):
    t = T(dur); f = np.geomspace(f0, f1, len(t))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) + noise * lp(rng.standard_normal(len(t)), 1500) * np.exp(-t * 40)
    return y
add(18.78, norm(thump()), db(-20))

# ---------------------------------------------------------------- smell cloud: low wind whoosh down the aisle
add(19.28, norm(whoosh(1.6, 200, 900)), db(-30), 0)
# grandma faints: slide whistle down + soft thud
t = T(0.5); f = np.geomspace(1500, 330, len(t)) * (1 + 0.012 * np.sin(2 * np.pi * 7 * t))
add(21.32, np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.02, 0.08), db(-31), -0.3)
add(21.82, norm(thump(0.3, 120, 50, 0.6)), db(-30), -0.3)

# ---------------------------------------------------------------- crowd screams + running
crowd = np.zeros(int(2.4 * SR))
for k in range(9):
    d = rng.uniform(0.8, 1.5); n = int(d * SR); t = np.arange(n) / SR
    base = rng.uniform(430, 780)
    f = base * (1 + 0.25 * np.sin(np.pi * t / d)) * (1 + 0.035 * np.sin(2 * np.pi * rng.uniform(5, 8) * t))
    vow = [(850, 1500, 2900), (650, 1900, 2900), (900, 1300, 2700)][k % 3]
    y = formant_voice(f, vow, (120, 160, 220)) * env(n, 0.06, 0.25)
    i = int(rng.uniform(0.0, 0.7) * SR); crowd[i:i + n] += norm(y) * rng.uniform(0.5, 1.0)
crowd += bp(rng.standard_normal(len(crowd)), 600, 3000) * 0.15 * env(len(crowd), 0.2, 0.6)
add(22.3, norm(reverb(crowd, 0.35, 1.6)), db(-23))
for k in range(26):
    st = lp(rng.standard_normal(int(0.05 * SR)), 400) * np.exp(-T(0.05) * 60)
    add(22.45 + k * 0.1 + rng.uniform(0, 0.05), norm(st), db(-36), rng.uniform(-0.8, 0.8))

# ---------------------------------------------------------------- throw / door burst / THUD / BANG
add(28.05, norm(whoosh(0.4, 300, 2500)), db(-30))
burst = norm(thump(0.5, 110, 45, 0.9)) + 0.5 * norm(bp(rng.standard_normal(int(0.5 * SR)), 300, 2500)) * np.exp(-T(0.5) * 14)
add(28.42, norm(reverb(burst, 0.3, 1.2)), db(-18))
add(29.03, norm(thump(0.45, 85, 35, 0.5)), db(-15))
bang = norm(thump(0.6, 70, 32, 0.7))
add(29.48, norm(reverb(bang, 0.4, 1.8)), db(-14))

# ---------------------------------------------------------------- "Wait! I object!" organ stings, gasp, creepy music box
def stab(notes, dur, vel=1):
    y = sum(organ_note(midi(m), dur, vel) for m in notes); return reverb(y, 0.4, 2.0)
add(32.77, norm(stab([38, 50, 53, 57, 62], 0.42)), db(-27))
add(33.5, norm(stab([37, 49, 52, 56, 61], 0.6)), db(-27))
g = bp(rng.standard_normal(int(0.45 * SR)), 900, 4500) * np.sin(np.pi * np.minimum(1, T(0.45) / 0.3) / 2) * env(int(0.45 * SR), 0.2, 0.15)
add(33.3, norm(g), db(-29))
for k, m in enumerate([88, 87, 88, 91]):
    t = T(0.5); y = (np.sin(2 * np.pi * midi(m) * t) + 0.3 * np.sin(2 * np.pi * midi(m) * 3 * t)) * np.exp(-t * 7)
    add(33.86 + k * 0.15, y, db(-32), 0.3)

# ---------------------------------------------------------------- mix under the voice
sfx = np.stack([L, R], 1)
# keep the voice on top: duck effects a little while you speak
fr = 441; ve = np.sqrt(np.convolve(voice ** 2, np.ones(fr) / fr, 'same'))
duck = 1 / (1 + (ve / 0.12) ** 2 * 0.6)
sfx *= duck[:, None]
mix = np.stack([voice, voice], 1) + sfx
peak = np.abs(mix).max()
print('voice peak', np.abs(voice).max(), 'sfx peak', np.abs(sfx).max(), 'mix peak', peak)
over = np.abs(mix) > 0.999
if over.any():  # only where effects pushed the sum over full scale, pull the effects back
    print('clipped samples', over.sum())
    mix = np.clip(mix, -0.999, 0.999)
pcm = (mix * 32767).astype(np.int16)
with wave.open(out_path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
with wave.open(out_path.replace('.wav', '_sfx_only.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(sfx, -1, 1) * 32767).astype(np.int16).tobytes())
print('wrote', out_path, N / SR, 's')
