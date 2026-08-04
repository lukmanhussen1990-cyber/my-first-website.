"""Synthesises the score for the Al-Ameen Academy opening titles.

Beats are matched to intro.html:  logo lands at 1.95s, title builds 2.45-4.05s,
the frame holds to 8.9s and resolves by 10.6s.
"""
import numpy as np, wave, pathlib

SR = 48000
DUR = 10.9
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(11)
mix = np.zeros(N)


def env(attack, hold, release, start=0.0, curve=2.0):
    """Attack / hold / exponential release envelope starting at `start`."""
    e = np.zeros(N)
    s = int(start * SR)
    a = int(attack * SR)
    h = int(hold * SR)
    r = int(release * SR)
    if a:
        e[s:s + a] = np.linspace(0, 1, a) ** (1 / curve)
    e[s + a:s + a + h] = 1.0
    if r:
        seg = np.exp(-np.linspace(0, 5, r))
        e[s + a + h:s + a + h + r] = seg[:max(0, min(r, N - (s + a + h)))]
    return e[:N]


def tone(freq, amp, e, detune=0.0012, harms=((1, 1.0), (2, 0.22), (3, 0.09), (4, 0.04))):
    out = np.zeros(N)
    for h, w in harms:
        for d in (-1, 1):
            f = freq * h * (1 + d * detune)
            out += w * np.sin(2 * np.pi * f * t + rng.random() * 6.28)
    return out * amp * e / 2


def bell(freq, amp, start, decay=2.6):
    """Inharmonic partials — a soft struck-metal timbre."""
    out = np.zeros(N)
    s = int(start * SR)
    n = N - s
    if n <= 0:
        return out
    lt = np.arange(n) / SR
    for p, w, dm in ((1.0, 1.0, 1.0), (2.0, 0.5, 1.25), (2.98, 0.28, 1.6),
                     (4.22, 0.16, 2.1), (5.43, 0.09, 2.6), (6.79, 0.05, 3.2)):
        out[s:] += w * np.sin(2 * np.pi * freq * p * lt) * np.exp(-lt * dm * (3.6 / decay))
    strike = np.exp(-lt * 55) * rng.normal(0, 1, n) * 0.05
    out[s:] += strike
    return out * amp


def lowpass(x, cutoff_taps):
    k = np.ones(cutoff_taps) / cutoff_taps
    return np.convolve(x, k, mode='same')


# ---- sustained pad: A major, voiced low and wide -------------------------
pad = env(2.6, 5.5, 2.6, start=0.15, curve=2.4)
breathe = 1 + 0.10 * np.sin(2 * np.pi * 0.11 * t) + 0.05 * np.sin(2 * np.pi * 0.19 * t + 1.1)
for f, a in ((110.00, 0.34), (164.81, 0.24), (220.00, 0.20), (277.18, 0.12), (329.63, 0.09)):
    mix += tone(f, a, pad * breathe)

# ---- riser into the logo landing ---------------------------------------
r0, r1 = 0.45, 1.95
ri = np.clip((t - r0) / (r1 - r0), 0, 1)
riser_env = (ri ** 2.6) * (t < r1)
noise = lowpass(rng.normal(0, 1, N), 90)
sweep = np.sin(2 * np.pi * np.cumsum(180 + 900 * ri ** 2) / SR)
mix += noise * riser_env * 0.16
mix += sweep * riser_env * 0.05

# ---- the landing: sub thump + bell --------------------------------------
IMP = 1.95
ie = env(0.004, 0.02, 1.05, start=IMP)
sub_f = 62 * np.exp(-np.clip(t - IMP, 0, None) * 1.7)
mix += np.sin(2 * np.pi * np.cumsum(sub_f) / SR) * ie * 0.55
mix += bell(440.00, 0.20, IMP, 3.2)
mix += bell(880.00, 0.13, IMP, 2.8)

# ---- chimes tracing the title build -------------------------------------
for start, f, a in ((2.50, 659.25, 0.075), (3.15, 880.00, 0.065),
                    (3.80, 1108.73, 0.055), (4.55, 1318.51, 0.045)):
    mix += bell(f, a, start, 2.4)

# ---- resolve ------------------------------------------------------------
mix += bell(220.00, 0.14, 8.80, 3.4)
out_sweep = np.clip((t - 8.6) / 1.2, 0, 1)
mix += lowpass(rng.normal(0, 1, N), 260) * (out_sweep * (1 - out_sweep) * 4) ** 2 * 0.05

# ---- space: a cheap but smooth plate ------------------------------------
wet = np.zeros(N)
for delay, g in ((0.031, 0.42), (0.057, 0.34), (0.089, 0.27), (0.131, 0.21),
                 (0.191, 0.16), (0.271, 0.11), (0.383, 0.07)):
    d = int(delay * SR)
    wet[d:] += mix[:N - d] * g
wet = lowpass(wet, 40)
mix = mix * 0.82 + wet * 0.42

# ---- master -------------------------------------------------------------
mix = lowpass(mix, 5)
fade_in = np.clip(t / 0.35, 0, 1)
fade_out = np.clip((DUR - t) / 0.45, 0, 1)
tail = np.clip((10.45 - t) / 1.1, 0, 1) ** 1.3
mix *= fade_in * fade_out * np.maximum(tail, 0)
mix = np.tanh(mix * 1.05)
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.89

stereo = np.stack([mix, np.concatenate([[0] * 12, mix[:-12]])], axis=1)  # slight width
stereo /= np.max(np.abs(stereo)) + 1e-9
stereo *= 0.89
pcm = (stereo * 32767).astype('<i2')

path = pathlib.Path(__file__).parent / 'score.wav'
with wave.open(str(path), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', path, pcm.shape)
