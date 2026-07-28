"""Ten seconds of lo-fi study bed: rhodes chords, soft drums, rain, SFX."""
import os
import struct
import wave

import numpy as np

SR = 44100
DUR = 10.0
N = int(SR * DUR)
BPM = 96.0
BEAT = 60.0 / BPM          # 0.625s
BAR = BEAT * 4             # 2.5s -> exactly 4 bars in 10s
RNG = np.random.default_rng(11)
T = np.arange(N) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def add(buf, sig, at):
    i = int(at * SR)
    if i >= N:
        return
    n = min(len(sig), N - i)
    buf[i:i + n] += sig[:n]


def env(n, a, d, s, r, sus=0.7):
    e = np.zeros(n)
    ai, di, ri = int(a * SR), int(d * SR), int(r * SR)
    ai, di, ri = min(ai, n), min(di, n), min(ri, n)
    e[:ai] = np.linspace(0, 1, ai) if ai else 0
    if di:
        e[ai:ai + di] = np.linspace(1, sus, di)[:max(0, n - ai)]
    e[ai + di:n - ri] = sus
    if ri:
        e[n - ri:] = np.linspace(sus, 0, ri)
    return e


def rhodes(note, dur, amp):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(note)
    sig = (np.sin(2 * np.pi * f * t) * 1.0
           + np.sin(2 * np.pi * f * 2 * t) * 0.34 * np.exp(-t * 4.2)
           + np.sin(2 * np.pi * f * 3 * t) * 0.12 * np.exp(-t * 6.5)
           + np.sin(2 * np.pi * f * 1.001 * t) * 0.5)
    return sig * np.exp(-t * 1.5) * env(n, 0.012, 0.05, 0.0, 0.05, 0.85) * amp


def sub(note, dur, amp):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(note)
    sig = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * f * 2 * t)
    return sig * np.exp(-t * 2.0) * env(n, 0.008, 0.02, 0, 0.04, 0.9) * amp


def lp(x, k):
    """Simple one-pole low-pass."""
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += k * (x[i] - acc)
        y[i] = acc
    return y


def lp_fast(x, k, passes=1):
    a = np.asarray(x, dtype=np.float64)
    for _ in range(passes):
        b = np.empty_like(a)
        acc = 0.0
        # vectorised approximation: exponential moving average via lfilter-style
        alpha = k
        buf = a
        acc_arr = np.zeros_like(buf)
        run = 0.0
        for i in range(0, len(buf), 4096):
            blk = buf[i:i + 4096]
            w = np.empty_like(blk)
            for j, v in enumerate(blk):
                run += alpha * (v - run)
                w[j] = run
            acc_arr[i:i + 4096] = w
        b = acc_arr
        a = b
    return a


def noise(n):
    return RNG.normal(0, 1, n)


mix = np.zeros(N)

# ---------------------------------------------------------------- chords
# Fmaj7 | Dm7 | Bbmaj7 | Csus2 -- gentle, unresolved, loops back on itself
CHORDS = [
    ([53, 57, 60, 64], 41),
    ([50, 53, 57, 60], 38),
    ([46, 50, 53, 57], 34),
    ([48, 52, 55, 62], 36),
]
for b, (notes, root) in enumerate(CHORDS):
    t0 = b * BAR
    for hit, amp in ((0.0, 0.20), (BEAT * 2, 0.15), (BEAT * 3.5, 0.09)):
        for i, nt in enumerate(notes):
            add(mix, rhodes(nt, 2.6, amp * (0.85 ** i)), t0 + hit + i * 0.012)
    add(mix, sub(root, 1.4, 0.30), t0)
    add(mix, sub(root, 1.0, 0.20), t0 + BEAT * 2.5)

# sparse, hopeful top-line
MEL = [(0.0, 72), (BEAT * 1.5, 69), (BEAT * 3, 65), (BAR + BEAT, 67),
       (BAR + BEAT * 2.5, 69), (BAR * 2 + BEAT * 0.5, 65), (BAR * 2 + BEAT * 2, 62),
       (BAR * 3, 64), (BAR * 3 + BEAT * 2, 67), (BAR * 3 + BEAT * 3, 69)]
for (t0, nt) in MEL:
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    f = midi(nt)
    sig = (np.sin(2 * np.pi * f * t) + 0.16 * np.sin(2 * np.pi * f * 3 * t))
    add(mix, sig * np.exp(-t * 3.0) * env(n, 0.02, 0.06, 0, 0.1, 0.8) * 0.11, t0)

# --------------------------------------------------------------- drums
for b in range(4):
    t0 = b * BAR
    for k in (0.0, BEAT * 2):                       # soft kick
        n = int(0.16 * SR)
        t = np.arange(n) / SR
        f = 92 * np.exp(-t * 26) + 44
        add(mix, np.sin(2 * np.pi * f * t) * np.exp(-t * 15) * 0.34, t0 + k)
    n = int(0.14 * SR)                              # brushed snare on the 3
    t = np.arange(n) / SR
    add(mix, lp_fast(noise(n), 0.35) * np.exp(-t * 22) * 0.16, t0 + BEAT * 2)
    for i in range(8):                              # soft hats
        n = int(0.05 * SR)
        t = np.arange(n) / SR
        hh = noise(n) - lp_fast(noise(n), 0.10)
        add(mix, hh * np.exp(-t * 60) * (0.045 if i % 2 else 0.07),
            t0 + i * BEAT / 2)

# ----------------------------------------------------------------- rain
rain = lp_fast(noise(N), 0.16, passes=2)
rain += 0.35 * (noise(N) - lp_fast(noise(N), 0.55))
rain *= 0.85 + 0.15 * np.sin(2 * np.pi * T / 5.0)   # loops twice in 10s
mix += rain / (np.abs(rain).max() + 1e-9) * 0.115

# vinyl crackle
for _ in range(190):
    at = RNG.uniform(0, DUR)
    n = int(0.006 * SR)
    t = np.arange(n) / SR
    add(mix, noise(n) * np.exp(-t * 700) * RNG.uniform(0.01, 0.05), at)

# ------------------------------------------------------------ page turns
def page_turn():
    n = int(0.40 * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for (o, a, d) in ((0.0, 1.0, 16), (0.09, 0.75, 22), (0.20, 0.5, 26)):
        i = int(o * SR)
        m = n - i
        tt = np.arange(m) / SR
        burst = noise(m) - lp_fast(noise(m), 0.22)
        out[i:] += burst * np.exp(-tt * d) * a
    return out * 0.30


for at in (52 / 30.0, 224 / 30.0):
    add(mix, page_turn(), at)

# ------------------------------------------------------- pencil scribbles
t = 80 / 30.0
while t < 150 / 30.0:
    n = int(0.09 * SR)
    tt = np.arange(n) / SR
    scr = noise(n) - lp_fast(noise(n), 0.30)
    add(mix, scr * np.exp(-tt * 30) * 0.055, t)
    t += RNG.uniform(0.13, 0.22)

# ------------------------------------------------- gentle swell on the line
sw = np.zeros(N)
i0, i1 = int(246 / 30.0 * SR), int(294 / 30.0 * SR)
seg = i1 - i0
tt = np.arange(seg) / SR
for nt in (77, 72, 69):
    sw[i0:i1] += np.sin(2 * np.pi * midi(nt) * tt) * np.exp(-tt * 1.1) * 0.05
mix += sw

# ------------------------------------------------------------------ mix
mix = np.tanh(mix * 1.15) * 0.92
# 40ms wrap crossfade so the loop point is click-free
xf = int(0.04 * SR)
fade = np.linspace(0, 1, xf)
mix[:xf] = mix[:xf] * fade + mix[-xf:] * (1 - fade)
mix = mix[:N]
mix /= max(1e-9, np.abs(mix).max()) / 0.89

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audio.wav')
data = (mix * 32767).astype('<i2')
stereo = np.repeat(data[:, None], 2, axis=1).tobytes()
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(stereo)
print('wrote', out, round(len(data) / SR, 3), 's')
