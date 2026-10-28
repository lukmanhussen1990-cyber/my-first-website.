"""All sound effects + a bouncy goofy background tune, synthesised with numpy; mixed under the voice.

usage: python3 audio.py <voiceover.mp3> <out.wav> <duration_s>
"""
import sys
import subprocess
import numpy as np

SR = 48000
RNG = np.random.RandomState(1234)


# ------------------------------------------------------------------ basics
def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env_adsr(n, a=0.005, d=0.05, s=0.6, r=0.1, hold=None):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    h_n = n - a_n - d_n - r_n if hold is None else int(hold * SR)
    h_n = max(0, h_n)
    e = np.concatenate([np.linspace(0, 1, max(1, a_n)), np.linspace(1, s, max(1, d_n)), np.full(h_n, s),
                        np.linspace(s, 0, max(1, r_n))])
    if len(e) < n:
        e = np.concatenate([e, np.zeros(n - len(e))])
    return e[:n]


def expdec(n, tau):
    return np.exp(-np.arange(n) / SR / tau)


def phase_from_freq(f):
    return 2 * np.pi * np.cumsum(f) / SR


def saw(ph):
    return 2 * ((ph / (2 * np.pi)) % 1.0) - 1


def square(ph, duty=0.5):
    return np.where(((ph / (2 * np.pi)) % 1.0) < duty, 1.0, -1.0)


def lowpass(x, fc):
    """one-pole low pass (fc may be array)."""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def biquad_bp(x, fc, q):
    """band-pass (constant fc or array, rbj cookbook, per-sample coefficients)."""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        w0 = 2 * np.pi * fc[i] / SR
        al = np.sin(w0) / (2 * q)
        b0, b2 = al, -al
        a0, a1, a2 = 1 + al, -2 * np.cos(w0), 1 - al
        yi = (b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1 = x1, x[i]
        y2, y1 = y1, yi
        y[i] = yi
    return y


def fast_lp(x, fc):
    """FFT brick-ish low pass for long noise buffers (constant fc)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / fc) ** 4)
    return np.fft.irfft(X, len(x))


def fast_bp(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4) / (1 + (f / hi) ** 4)
    return np.fft.irfft(X, len(x))


def noise(dur):
    return RNG.uniform(-1, 1, int(dur * SR))


def norm(x, peak=1.0):
    m = np.abs(x).max()
    return x / m * peak if m > 0 else x


# ------------------------------------------------------------------ effects
def record_scratch():
    d = 0.42
    t = t_axis(d)
    rate = 1 + 0.9 * np.sin(2 * np.pi * 7 * t) * np.exp(-t * 3) + 0.5 * (t > 0.2)
    f = 180 * rate + 400 * np.abs(np.sin(2 * np.pi * 9 * t))
    s = saw(phase_from_freq(f)) * 0.5 + fast_bp(noise(d), 800, 6000) * 0.8
    s *= env_adsr(len(t), 0.002, 0.05, 0.8, 0.12)
    return norm(s, 0.8)


def dun_dun():
    out = []
    for f0, dur in ((73.4, 0.45), (69.3, 1.25)):
        t = t_axis(dur)
        s = sum(saw(phase_from_freq(np.full(len(t), f0 * m))) * a for m, a in ((1, 1), (2, 0.6), (1.5, 0.35), (4, 0.15)))
        s = fast_lp(s, 900) * expdec(len(t), dur * 0.45)
        s += np.sin(2 * np.pi * f0 * 0.5 * t) * expdec(len(t), 0.3) * 0.8
        out.append(s)
    gap = np.zeros(int(0.12 * SR))
    return norm(np.concatenate([out[0], gap, out[1]]), 0.9)


def ding(f0=1568.0, dur=1.2):
    t = t_axis(dur)
    s = np.zeros_like(t)
    for m, a, tau in ((1, 1, 0.6), (2.76, 0.45, 0.25), (5.4, 0.25, 0.12), (8.93, 0.12, 0.06)):
        s += a * np.sin(2 * np.pi * f0 * m * t) * expdec(len(t), tau)
    s *= np.minimum(1, t / 0.002)
    return norm(s, 0.7)


def thud(f0=85, dur=0.22, crunch=0.5):
    t = t_axis(dur)
    f = f0 * (1 + 0.8 * np.exp(-t * 30))
    s = np.sin(phase_from_freq(f)) * expdec(len(t), 0.07)
    s += fast_bp(noise(dur), 300, 3500) * expdec(len(t), 0.05) * crunch
    return norm(s, 0.9)


def fly_buzz(dur, seed=0):
    rng = np.random.RandomState(seed)
    t = t_axis(dur)
    out = np.zeros_like(t)
    for k in range(3):
        f = (190 + 40 * k) * (1 + 0.08 * np.sin(2 * np.pi * (3 + k) * t + rng.uniform(0, 6)) + 0.03 * np.sin(2 * np.pi * 13 * t))
        s = saw(phase_from_freq(f)) + 0.5 * square(phase_from_freq(f * 2.01))
        am = 0.6 + 0.4 * np.sin(2 * np.pi * (1.3 + k * 0.7) * t + k)
        out += fast_bp(s, 300, 2500) * am
    out *= env_adsr(len(t), 0.15, 0.1, 1.0, 0.25)
    return norm(out, 0.5)


def trombone(notes, vib_last=True, gliss=0.0):
    """notes: list of (freq, dur)."""
    parts = []
    for i, (f0, dur) in enumerate(notes):
        t = t_axis(dur)
        f = np.full(len(t), f0)
        if gliss and i == len(notes) - 1:
            f = f0 * (1 - gliss * t / dur)
        if vib_last and i == len(notes) - 1:
            f = f * (1 + 0.025 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.2))
        ph = phase_from_freq(f)
        s = saw(ph) * 0.8 + square(ph) * 0.3
        bright = 600 + 1800 * np.minimum(1, t / 0.08) * np.exp(-t * 2.0)
        s = lowpass(s, bright)
        s *= env_adsr(len(t), 0.03, 0.08, 0.85, 0.08)
        parts.append(s)
    return norm(np.concatenate(parts), 0.75)


def leaf_rustle(dur=0.9):
    t = t_axis(dur)
    n = fast_bp(noise(dur), 1500, 7000)
    crackle = (RNG.uniform(0, 1, len(t)) > 0.996).astype(float)
    crackle = np.convolve(crackle, np.exp(-np.arange(200) / 30.0), 'same')
    am = 0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 6 * t)) * RNG.uniform(0.7, 1.0)
    s = n * am * 0.6 + fast_bp(noise(dur), 2000, 8000) * crackle * 0.8
    return norm(s * env_adsr(len(t), 0.05, 0.1, 0.8, 0.3), 0.6)


def wind(dur=1.8):
    t = t_axis(dur)
    n = noise(dur)
    fc = 350 + 900 * np.sin(np.pi * t / dur) ** 2 + 150 * np.sin(2 * np.pi * 1.7 * t)
    s = biquad_bp(n, fc, 2.5)
    s += fast_lp(noise(dur), 300) * 0.6
    s *= np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return norm(s, 0.8)


def slide_whistle(f_from, f_to, dur):
    t = t_axis(dur)
    u = t / dur
    f = f_from * (f_to / f_from) ** u * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))
    s = np.sin(phase_from_freq(f)) + 0.15 * np.sin(2 * phase_from_freq(f))
    s += fast_bp(noise(dur), 1000, 4000) * 0.06
    return norm(s * env_adsr(len(t), 0.02, 0.05, 0.9, 0.06), 0.6)


def poof_sfx(dur=0.5):
    t = t_axis(dur)
    s = fast_lp(noise(dur), 1800) * expdec(len(t), 0.12) * np.minimum(1, t / 0.008)
    s += np.sin(phase_from_freq(140 * (1 - 0.5 * t / dur))) * expdec(len(t), 0.08) * 0.6
    return norm(s, 0.8)


def knock(f0=520, dur=0.12, bright=1.0):
    t = t_axis(dur)
    s = np.sin(2 * np.pi * f0 * t) * expdec(len(t), 0.03) + 0.5 * np.sin(2 * np.pi * f0 * 2.3 * t) * expdec(len(t), 0.015)
    s += fast_bp(noise(dur), 1500, 6000) * expdec(len(t), 0.004) * bright
    return norm(s, 0.9)


def pop(f_from=380, f_to=950, dur=0.10):
    t = t_axis(dur)
    f = f_from + (f_to - f_from) * np.minimum(1, t / 0.05)
    s = np.sin(phase_from_freq(f)) * expdec(len(t), 0.03)
    return norm(s, 0.8)


def creak(dur=0.45):
    t = t_axis(dur)
    f = 95 * (1 + 0.15 * np.sin(2 * np.pi * 3 * t) + 0.05 * RNG.normal(0, 1, len(t)).cumsum() / 300)
    s = saw(phase_from_freq(f))
    pulses = (np.sin(phase_from_freq(np.full(len(t), 32.0))) > 0.7).astype(float)
    s = biquad_bp(s * (0.3 + pulses), 900, 3)
    return norm(s * env_adsr(len(t), 0.03, 0.05, 0.8, 0.1), 0.6)


def bubbles(dur, density=60, fr=(500, 1600), seed=0):
    rng = np.random.RandomState(seed)
    n = int(dur * SR)
    out = np.zeros(n)
    for k in range(int(density * dur)):
        st = rng.randint(0, max(1, n - 2000))
        L = rng.randint(400, 1600)
        tt = np.arange(L) / SR
        f0 = rng.uniform(*fr)
        b = np.sin(2 * np.pi * f0 * (1 + 2.5 * tt / (L / SR)) * tt) * np.exp(-tt / (L / SR / 3))
        out[st:st + L] += b * rng.uniform(0.3, 1)
    return out


def pour(dur=1.4):
    t = t_axis(dur)
    s = fast_bp(noise(dur), 300, 4000) * 0.6 + bubbles(dur, 90, seed=3) * 0.35
    s *= env_adsr(len(t), 0.08, 0.1, 0.9, 0.3)
    return norm(s, 0.7)


def splash(dur=0.7, big=False):
    t = t_axis(dur)
    s = fast_bp(noise(dur), 200 if big else 400, 6000) * expdec(len(t), 0.25 if big else 0.15)
    s += bubbles(dur, 120 if big else 60, seed=5) * 0.4 * expdec(len(t), 0.3)
    s *= np.minimum(1, t / 0.005)
    return norm(s, 0.9)


def twinkle(dur=0.6, seed=0):
    rng = np.random.RandomState(seed)
    n = int(dur * SR)
    out = np.zeros(n)
    for k in range(5):
        st = int(k * 0.07 * SR)
        L = int(0.35 * SR)
        tt = np.arange(L) / SR
        f0 = rng.uniform(2600, 4800)
        b = np.sin(2 * np.pi * f0 * tt) * np.exp(-tt / 0.07)
        out[st:st + L] += b[:max(0, min(L, n - st))]
    return norm(out, 0.5)


def footstep(heavy=False):
    dur = 0.18
    t = t_axis(dur)
    s = np.sin(phase_from_freq(np.full(len(t), 70 if heavy else 110))) * expdec(len(t), 0.04)
    s += fast_bp(noise(dur), 500, 4000) * expdec(len(t), 0.03) * (0.4 if heavy else 0.6)
    return norm(s, 0.7)


def bone_crack():
    dur = 0.25
    t = t_axis(dur)
    s = np.zeros(len(t))
    for k, off in enumerate((0.0, 0.018, 0.034)):
        st = int(off * SR)
        L = int(0.05 * SR)
        tt = np.arange(L) / SR
        s[st:st + L] += fast_bp(noise(0.05), 1500, 9000)[:L] * np.exp(-tt / 0.006) * (1 - 0.2 * k)
    s += np.sin(2 * np.pi * 180 * t) * expdec(len(t), 0.02) * 0.5
    return norm(s, 0.95)


def whoosh(dur=0.9, big=False):
    t = t_axis(dur)
    u = t / dur
    fc = 300 + 3000 * u ** 1.5 if not big else 200 + 2200 * u
    s = biquad_bp(noise(dur), fc, 1.2)
    if big:
        s += fast_lp(noise(dur), 220) * 1.2
    s *= np.sin(np.pi * np.clip(u, 0, 1) ** 0.6) ** 2
    return norm(s, 0.9)


def roar(dur=1.4):
    t = t_axis(dur)
    s = fast_lp(noise(dur), 900) + fast_bp(noise(dur), 900, 5000) * 0.35 + bubbles(dur, 150, seed=9) * 0.25
    s *= env_adsr(len(t), 0.03, 0.2, 0.8, 0.5)
    return norm(s, 0.9)


def drip():
    dur = 0.25
    t = t_axis(dur)
    f = 650 * (1 + 1.4 * np.minimum(1, t / 0.035))
    s = np.sin(phase_from_freq(f)) * expdec(len(t), 0.05) * np.minimum(1, t / 0.002)
    return norm(s, 0.8)


def party_horn():
    dur = 0.75
    t = t_axis(dur)
    f = 430 * (1 + 0.06 * np.minimum(1, t / 0.1)) * (1 + 0.01 * np.sin(2 * np.pi * 18 * t))
    ph = phase_from_freq(f)
    s = square(ph, 0.3) + 0.6 * saw(ph * 2)
    s = lowpass(s, 2500)
    s += fast_bp(noise(dur), 2000, 7000) * 0.15
    s *= env_adsr(len(t), 0.01, 0.05, 0.9, 0.12)
    return norm(s, 0.7)


def brass_note(f0, dur, amp=1.0):
    t = t_axis(dur)
    ph = phase_from_freq(f0 * (1 + 0.004 * np.sin(2 * np.pi * 5 * t)))
    s = saw(ph) + 0.4 * saw(ph * 2.0)
    s = lowpass(s, 900 + 2600 * np.minimum(1, t / 0.05) * np.exp(-t * 1.5))
    return s * env_adsr(len(t), 0.02, 0.06, 0.8, 0.08) * amp


def fanfare():
    seq = [(523.25, 0.13), (659.25, 0.13), (783.99, 0.13), (1046.5, 0.55)]
    parts = [brass_note(f, d) for f, d in seq]
    s = np.concatenate(parts)
    chord = sum(brass_note(f, 0.55, 0.5) for f in (523.25, 659.25, 783.99))
    s[-len(chord):] += chord
    return norm(s, 0.7)


def wobble_stink(dur=0.6):
    t = t_axis(dur)
    f = 160 * (1 + 0.25 * np.sin(2 * np.pi * 7 * t)) * (1 - 0.3 * t / dur)
    s = saw(phase_from_freq(f))
    s = lowpass(s, 700) * env_adsr(len(t), 0.05, 0.1, 0.8, 0.2)
    return norm(s, 0.5)


# ------------------------------------------------------------------ music
def pluck(f0, dur, bright=3000, tau=0.25):
    t = t_axis(dur)
    s = np.sin(2 * np.pi * f0 * t) + 0.35 * np.sin(2 * np.pi * 2 * f0 * t) * np.exp(-t / 0.08)
    s += 0.2 * np.sin(2 * np.pi * 4 * f0 * t) * np.exp(-t / 0.03)
    return s * expdec(len(t), tau) * np.minimum(1, t / 0.003)


def marimba(f0, dur):
    t = t_axis(dur)
    s = np.sin(2 * np.pi * f0 * t) * np.exp(-t / 0.35) + 0.25 * np.sin(2 * np.pi * 4 * f0 * t) * np.exp(-t / 0.05)
    return s * np.minimum(1, t / 0.002)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def music(total):
    bpm = 116
    beat = 60 / bpm
    out = np.zeros(int((total + 8) * SR))
    # chords per bar (F, Bb, C, F) / (F, Dm, Bb, C)
    prog = [53, 58, 60, 53, 53, 50, 58, 60]    # bass roots (F3=53)
    melody = [77, 79, 81, None, 81, 79, 77, 72, 74, 77, None, 74, 72, None, 70, 72,
              77, 79, 81, 84, 81, None, 77, 79, 81, 79, 77, 74, 72, None, None, None]
    n_bars = int(total / (4 * beat)) + 2
    for bar in range(n_bars):
        root = prog[bar % len(prog)]
        t0 = bar * 4 * beat
        for k, off in enumerate((0, 1, 2, 3)):
            n = root - 12 if k % 2 == 0 else root - 5
            s = pluck(midi(n), beat * 0.9, tau=0.18)
            st = int((t0 + off * beat) * SR)
            out[st:st + len(s)] += s * 0.55
        # offbeat chord stabs
        for off in (0.5, 1.5, 2.5, 3.5):
            st = int((t0 + off * beat) * SR)
            for iv in (0, 4, 7):
                s = pluck(midi(root + iv), beat * 0.4, tau=0.06)
                out[st:st + len(s)] += s * 0.12
        # melody (8th notes, two bars per phrase)
        for i in range(8):
            n = melody[(bar % 4) * 8 + i]
            if n is None:
                continue
            st = int((t0 + i * beat / 2) * SR)
            s = marimba(midi(n), beat * 0.6)
            out[st:st + len(s)] += s * 0.22
        # shaker
        for i in range(8):
            st = int((t0 + i * beat / 2) * SR)
            L = int(0.04 * SR)
            s = fast_bp(noise(0.04), 5000, 12000) * np.exp(-np.arange(L) / SR / 0.012)
            out[st:st + L] += s * (0.08 if i % 2 else 0.05)
    return out[:int(total * SR)]


# ------------------------------------------------------------------ the cue sheet (time s, sound, gain)
def cues():
    c = []
    add = lambda t, s, g: c.append((t, s, g))
    add(0.66, record_scratch(), 0.55)
    add(2.80, dun_dun(), 0.75)
    add(4.56, ding(1568), 0.55)
    for k, tt in enumerate(np.arange(5.85, 6.65, 0.27)):
        add(tt, footstep(), 0.25)
    for k in range(5):
        add(6.82 + 0.34 * k, thud(85 + 8 * (k % 2)), 0.6)
    add(8.50, wobble_stink(0.7), 0.25)
    add(9.32, whoosh(0.25), 0.15)
    add(10.15, fly_buzz(1.65), 0.28)
    add(10.95, trombone([(233.08, 0.24), (220.0, 0.55)]), 0.42)
    add(12.20, leaf_rustle(0.9), 0.45)
    add(13.50, ding(1760), 0.55)
    add(14.50, wind(1.7), 0.55)
    add(16.45, slide_whistle(1700, 520, 0.42), 0.45)
    add(17.00, slide_whistle(520, 1500, 0.38), 0.40)
    add(17.72, poof_sfx(0.55), 0.70)
    for k in range(12):
        add(17.98 + 0.08 * k, knock(700 + 60 * (k % 4), 0.08, 0.6), 0.22)
    for k in range(6):
        add(18.42 + 0.16 * k, knock(480 + 30 * (k % 3), 0.12), 0.55)
    add(19.05, pop(), 0.45)
    add(19.78, creak(0.4), 0.25)
    add(20.20, ding(2093), 0.35)
    add(21.40, wobble_stink(0.7), 0.22)
    add(23.95, pour(1.35), 0.55)
    add(24.05, splash(0.7), 0.45)
    add(24.38, twinkle(0.8, 1), 0.40)
    add(24.75, twinkle(0.6, 2), 0.32)
    for k, tt in enumerate(np.arange(25.95, 27.9, 0.42)):
        add(tt, footstep(heavy=True), 0.35)
    add(28.02, bone_crack(), 0.75)
    add(28.12, trombone([(196.0, 0.15), (174.6, 0.7)], gliss=0.25), 0.45)
    add(28.70, poof_sfx(0.6), 0.70)
    add(28.80, creak(0.5), 0.35)
    add(29.55, thud(70, 0.3, 0.8), 0.6)
    add(29.62, whoosh(0.25), 0.3)
    add(30.35, pop(500, 1100, 0.08), 0.35)
    add(30.80, whoosh(0.35), 0.25)
    add(31.00, pour(0.6), 0.40)
    add(31.68, creak(0.25), 0.30)
    add(31.85, splash(0.9, big=True), 0.60)
    add(31.90, roar(0.8), 0.30)
    for k in range(3):
        add(33.10 + 0.22 * k + 0.35, drip(), 0.65)
    add(33.92, trombone([(233.08, 0.22), (220.0, 0.22), (207.65, 0.22), (196.0, 0.75)]), 0.42)
    for k in range(5):
        add(36.30 + 0.17 * k, pop(420 + 40 * k, 1000 + 60 * k, 0.09), 0.40)
        add(36.30 + 0.17 * k, poof_sfx(0.25), 0.25)
    add(37.18, whoosh(1.0, big=True), 0.80)
    add(37.32, roar(1.4), 0.55)
    add(37.40, splash(1.0, big=True), 0.50)
    add(38.60, party_horn(), 0.45)
    for k in range(4):
        add(38.62 + 0.11 * k, pop(300 + 80 * k, 900, 0.08), 0.35)
    add(38.95, fanfare(), 0.38)
    add(42.78, ding(1568), 0.55)
    add(42.80, twinkle(0.5, 4), 0.25)
    return c


def load_voice(path, total):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True).stdout
    v = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    out = np.zeros(int(total * SR))
    out[:min(len(v), len(out))] = v[:len(out)]
    return out


def main():
    vpath, out_wav, total = sys.argv[1], sys.argv[2], float(sys.argv[3])
    n = int(total * SR)
    voice = load_voice(vpath, total)
    # voice reference loudness (rms of speech parts)
    sfx = np.zeros(n)
    for t0, s, g in cues():
        st = int(t0 * SR)
        e = min(n, st + len(s))
        if st < n:
            sfx[st:e] += s[:e - st] * g
    mus = music(total)
    mus = mus / (np.abs(mus).max() + 1e-9)
    # duck the music under the voice
    env = np.abs(voice)
    k = int(0.15 * SR)
    env = np.convolve(env, np.ones(k) / k, 'same')
    duck = 1.0 - 0.55 * np.clip(env / (env.max() * 0.25 + 1e-9), 0, 1)
    mus *= duck
    # fade music in/out
    fi = np.minimum(1, np.arange(n) / (0.6 * SR))
    fo = np.clip((n - np.arange(n)) / (0.8 * SR), 0, 1)
    mus *= fi * fo
    vpk = np.abs(voice).max()
    v_rms = np.sqrt(np.mean(voice[np.abs(voice) > 0.02 * vpk] ** 2))
    mix_v = voice / v_rms * 0.10                   # voice at a fixed rms
    mix = mix_v + sfx * 0.10 * 1.3 + mus * 0.10 * 0.55
    # soft limiter
    mix = np.tanh(mix * 1.0 / 0.9) * 0.9
    st = np.stack([mix, mix], 1).astype(np.float32)
    import wave
    st16 = (np.clip(st, -1, 1) * 32767).astype(np.int16)
    with wave.open(out_wav, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(st16.tobytes())
    print('wrote', out_wav, 'peak', float(np.abs(mix).max()))


if __name__ == '__main__':
    main()
