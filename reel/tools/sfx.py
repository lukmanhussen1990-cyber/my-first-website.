# Procedural sound design (numpy only): cartoon groan, Velcro rip, thuds, fan spin-up, glass crash,
# trampoline boing, ding, whooshes, clicks, pops — plus a bouncy comedy music loop.
import numpy as np

SR = 48000
rng = np.random.default_rng(7)

def t_axis(dur): return np.arange(int(dur * SR)) / SR

def env_adsr(n, a=0.01, d=0.1, s=0.7, r=0.2, dur=None):
    dur = dur or n / SR
    t = np.arange(n) / SR
    e = np.ones(n) * s
    e[t < a] = t[t < a] / a
    m = (t >= a) & (t < a + d); e[m] = 1 - (1 - s) * (t[m] - a) / d
    rel = t > dur - r; e[rel] *= np.clip((dur - t[rel]) / r, 0, 1)
    return e

def stft_filter(x, mask_fn, n=1024):
    """Time-varying spectral filter: mask_fn(freqs, time_sec) -> gain array."""
    hop = n // 4
    win = np.hanning(n)
    pad = np.concatenate([np.zeros(n), x, np.zeros(n)])
    out = np.zeros_like(pad); wsum = np.zeros_like(pad)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    for i in range(0, len(pad) - n, hop):
        seg = pad[i:i + n] * win
        X = np.fft.rfft(seg)
        X *= mask_fn(freqs, (i - n + n / 2) / SR)
        out[i:i + n] += np.fft.irfft(X, n) * win
        wsum[i:i + n] += win ** 2
    out = out / np.maximum(wsum, 1e-6)
    return out[n:n + len(x)]

def band(f, lo, hi, soft=1.0):
    return 1 / (1 + np.exp(-(f - lo) / (soft * 0.15 * lo + 1))) * 1 / (1 + np.exp((f - hi) / (soft * 0.15 * hi + 1)))

def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak

# ---------------------------------------------------------------- voice-like groan
def groan(dur=3.0, f_start=150, f_end=95, seed=1, yeah=True, pitch=1.0):
    r = np.random.default_rng(seed)
    t = t_axis(dur); u = t / dur
    # pitch contour: "ohhhh" (slight rise, slow fall) then "yeahhh" (jump up, relieved fall)
    split = 0.52 if yeah else 1.0
    f0 = np.where(u < split,
                  f_start * (1 + 0.1 * np.sin(np.pi * np.clip(u / split, 0, 1) * 0.8)) * (1 - 0.18 * np.clip(u / split, 0, 1) ** 1.5),
                  (f_start * 1.18) * (1 - 0.42 * np.clip((u - split) / (1 - split), 0, 1) ** 0.9))
    f0 = f0 * pitch
    f0 = f0 * (1 + 0.025 * np.sin(2 * np.pi * 5.3 * t) * np.clip(u * 3, 0, 1))  # vibrato
    f0 = f0 * (1 + 0.01 * np.cumsum(r.standard_normal(len(t))) / np.sqrt(SR) * 4)  # drift
    # vocal fry at the very end
    fry = np.clip((u - 0.9) / 0.1, 0, 1)
    f0 = f0 * (1 - 0.35 * fry)
    phase = 2 * np.pi * np.cumsum(f0) / SR
    # formant trajectory: o -> (j glide) -> e -> a
    def trk(points):
        xs, ys = zip(*points); return np.interp(u, xs, ys)
    if yeah:
        F1 = trk([(0, 430), (0.48, 470), (0.55, 300), (0.62, 560), (0.8, 680), (1, 650)])
        F2 = trk([(0, 780), (0.48, 820), (0.55, 2150), (0.62, 1850), (0.8, 1350), (1, 1150)])
    else:
        F1 = trk([(0, 450), (1, 520)]); F2 = trk([(0, 800), (1, 900)])
    F3 = 2550 + 0 * u
    out = np.zeros(len(t))
    for k in range(1, 40):
        fk = k * f0
        amp = (1.0 / k ** 1.05) * (fk < 5000)
        res = 0
        for F, bw, g in ((F1, 90, 1.0), (F2, 120, 0.55), (F3, 200, 0.22)):
            res = res + g / (1 + ((fk - F) / bw) ** 2)
        out += amp * res * np.sin(k * phase + r.uniform(0, 6.28))
    breath = r.standard_normal(len(t))
    breath = stft_filter(breath, lambda f, tt: band(f, 400, 3500) * 0.5)
    amp_env = np.clip(u / 0.08, 0, 1) * np.clip((1 - u) / 0.12, 0, 1) ** 0.8
    amp_env *= 0.85 + 0.15 * np.sin(2 * np.pi * 0.9 * t)
    if yeah:
        amp_env *= np.where((u > 0.5) & (u < 0.56), 0.55, 1.0) * 1.0
    y = out * amp_env + breath * amp_env * 0.06
    jitter = 1 + 0.25 * fry * r.standard_normal(len(t))
    return norm(y * jitter, 0.85)

# ---------------------------------------------------------------- sound effects
def velcro(dur=0.75):
    t = t_axis(dur); u = t / dur
    rate = 2500 + 6000 * np.sin(np.pi * u) ** 0.5
    clicks = (rng.random(len(t)) < rate / SR) * rng.uniform(0.3, 1, len(t))
    burst = np.convolve(clicks, np.exp(-np.arange(60) / 9), mode='same')
    noise = rng.standard_normal(len(t)) * 0.4
    tear = 0.6 + 0.4 * np.abs(np.sin(2 * np.pi * (11 + 9 * u) * t))
    x = (burst + noise * (0.5 + 0.5 * tear)) * tear
    x = stft_filter(x, lambda f, tt: band(f, 900, 9000) * (1 + 1.2 * band(f, 2500, 5000)))
    e = np.clip(u / 0.04, 0, 1) * np.clip((1 - u) / 0.25, 0, 1)
    return norm(x * e, 0.9)

def thud(dur=0.6, f0=72, rattle=True):
    t = t_axis(dur)
    f = f0 * (1 - 0.4 * np.clip(t / 0.25, 0, 1))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)
    n = rng.standard_normal(len(t)) * np.exp(-t * 30)
    n = stft_filter(n, lambda fr, tt: band(fr, 40, 700))
    x = body + 0.7 * n
    if rattle:
        for k in range(14):
            at = 0.05 + rng.random() * 0.35
            i = int(at * SR); L = int(0.03 * SR)
            if i + L < len(x):
                x[i:i + L] += 0.08 * np.sin(2 * np.pi * rng.uniform(1800, 3500) * np.arange(L) / SR) * np.exp(-np.arange(L) / (0.006 * SR))
    return norm(x, 0.95)

def fan(dur=2.0):
    t = t_axis(dur); u = t / dur
    rot = 1.0 + 9.0 * u ** 1.6               # rev/s
    blade = 5 * rot                           # blade pass frequency
    am = 0.55 + 0.45 * np.sin(2 * np.pi * np.cumsum(blade) / SR) ** 2
    n = rng.standard_normal(len(t))
    x = stft_filter(n, lambda f, tt: band(f, 250 + 700 * (tt / dur), 900 + 3200 * (tt / dur)) * 1.0)
    hum = 0.25 * np.sin(2 * np.pi * np.cumsum(60 + 140 * u) / SR)
    e = np.clip(u / 0.1, 0, 1) * (0.4 + 0.6 * u)
    return norm((x * am + hum) * e, 0.85)

def glass(dur=1.6):
    t = t_axis(dur)
    crash = rng.standard_normal(len(t)) * np.exp(-t * 9)
    crash = stft_filter(crash, lambda f, tt: band(f, 1800, 14000) * (0.6 + 0.4 * band(f, 4000, 9000)))
    x = crash * 0.9
    low = np.sin(2 * np.pi * 110 * t) * np.exp(-t * 18) * 0.5
    x += low
    for k in range(70):
        at = rng.random() ** 1.6 * 1.2
        i = int(at * SR); L = int(0.12 * SR)
        if i + L >= len(x): continue
        fr = rng.uniform(2500, 9500)
        tl = np.arange(L) / SR
        x[i:i + L] += rng.uniform(0.05, 0.25) * np.exp(-at * 1.5) * (np.sin(2 * np.pi * fr * tl) + 0.4 * np.sin(2 * np.pi * fr * 2.7 * tl)) * np.exp(-tl * rng.uniform(25, 60))
    return norm(x, 0.95)

def boing(dur=0.85, base=190):
    t = t_axis(dur)
    f = base * (1 + 0.45 * np.exp(-t * 4.5) * np.sin(2 * np.pi * 8.5 * t)) * (1 + 0.6 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph + 1)
    twang = rng.standard_normal(len(t)) * np.exp(-t * 60) * 0.3
    e = np.clip(t / 0.005, 0, 1) * np.exp(-t * 3.2)
    return norm(x * e + twang, 0.85)

def ding(dur=2.2, f=1318.5):
    t = t_axis(dur)
    parts = [(1, 1.0, 2.2), (2.756, 0.45, 4.5), (5.404, 0.25, 7.5), (8.933, 0.12, 11), (0.5, 0.18, 2.0)]
    x = sum(a * np.sin(2 * np.pi * f * m * t + m) * np.exp(-t * d) for m, a, d in parts)
    x *= np.clip(t / 0.002, 0, 1)
    return norm(x, 0.8)

def whoosh(dur=0.45, lo=300, hi=2500):
    t = t_axis(dur); u = t / dur
    n = rng.standard_normal(len(t))
    x = stft_filter(n, lambda f, tt: band(f, lo + (hi - lo) * 0.5 * (tt / dur), lo * 2 + (hi - lo) * (tt / dur)))
    e = np.sin(np.pi * np.clip(u, 0, 1)) ** 1.5
    return norm(x * e, 0.8)

def click(dur=0.12):
    t = t_axis(dur); x = np.zeros(len(t))
    for at, fr in ((0.0, 3200), (0.045, 2400)):
        i = int(at * SR); L = int(0.02 * SR); tl = np.arange(L) / SR
        x[i:i + L] += np.sin(2 * np.pi * fr * tl) * np.exp(-tl * 400) + rng.standard_normal(L) * np.exp(-tl * 600) * 0.4
    return norm(x, 0.8)

def pop(dur=0.14, f0=320, f1=1100):
    t = t_axis(dur)
    f = f0 + (f1 - f0) * (t / dur) ** 0.6
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22)
    return norm(x, 0.8)

def roof(dur=0.8):
    x = thud(dur, f0=58, rattle=False)
    t = t_axis(dur)
    r = rng.standard_normal(len(t)) * np.exp(-t * 14)
    r = stft_filter(r, lambda f, tt: band(f, 600, 5000))
    return norm(x + 0.35 * r, 0.9)

# ---------------------------------------------------------------- music
def note_hz(n): return 440.0 * 2 ** ((n - 69) / 12)

def pluck(dur, f, bright=1.0):
    t = t_axis(dur)
    x = np.sin(2 * np.pi * f * t) + 0.5 * bright * np.sin(4 * np.pi * f * t) * np.exp(-t * 18) + 0.2 * np.sin(6 * np.pi * f * t) * np.exp(-t * 30)
    return x * np.exp(-t * 7) * np.clip(t / 0.003, 0, 1)

def marimba(dur, f):
    t = t_axis(dur)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 6) + 0.35 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t * 22) + 0.08 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t * 40)
    return x * np.clip(t / 0.002, 0, 1)

def glock(dur, f):
    t = t_axis(dur)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6)) * np.exp(-t * 3.5) * np.clip(t / 0.001, 0, 1)

def music(total, bpm=118):
    beat = 60 / bpm
    L = np.zeros((2, int((total + 2) * SR)))
    def put(sig, at, gain, pan=0.0):
        i = int(at * SR)
        if i >= L.shape[1]: return
        sig = sig[:L.shape[1] - i]
        L[0, i:i + len(sig)] += sig * gain * (1 - pan) * 0.5 ** 0.5 * 1.4
        L[1, i:i + len(sig)] += sig * gain * (1 + pan) * 0.5 ** 0.5 * 1.4
    # I - vi - IV - V in F major, one bar each
    prog = [(53, [65, 69, 72]), (50, [62, 65, 69]), (46, [58, 62, 65]), (48, [60, 64, 67])]
    melody = [  # (beat offset within 4-bar phrase, midi, length in beats)
        (0, 72, .5), (.5, 74, .5), (1, 76, .5), (1.5, 72, .5), (2.5, 69, .5), (3, 72, 1),
        (4, 74, .5), (4.5, 72, .5), (5, 69, .5), (5.5, 65, .5), (6.5, 67, .5), (7, 69, 1),
        (8, 70, .5), (8.5, 69, .5), (9, 67, .5), (9.5, 65, .5), (10, 62, .5), (10.5, 65, .5), (11, 70, .75),
        (12, 72, .5), (12.5, 71, .25), (12.75, 72, .25), (13, 74, .5), (13.5, 76, .5), (14, 79, .5), (14.5, 76, .5), (15, 77, 1),
    ]
    bars = int(total / (beat * 4)) + 2
    for b in range(bars):
        t0 = b * 4 * beat
        root, chord = prog[b % 4]
        # bouncy bass: root - fifth with pickups
        for off, step in ((0, 0), (1.5, 7), (2, 0), (3, 7), (3.5, 12)):
            put(pluck(beat * 0.9, note_hz(root - 12 + step + 12)), t0 + off * beat, 0.32, -0.1)
        # offbeat chord stabs (marimba)
        for off in (0.5, 1.5, 2.5, 3.5):
            for n in chord:
                put(marimba(beat * 0.6, note_hz(n)), t0 + off * beat, 0.07, 0.25)
        # shaker on 8ths + soft clap on 2 & 4
        for k in range(8):
            sh = rng.standard_normal(int(0.05 * SR)) * np.exp(-np.arange(int(0.05 * SR)) / (0.008 * SR))
            sh = np.diff(sh, prepend=0)
            put(sh, t0 + k * beat / 2, 0.05 if k % 2 else 0.03, 0.35)
        for off in (1, 3):
            cl = rng.standard_normal(int(0.12 * SR)) * np.exp(-np.arange(int(0.12 * SR)) / (0.02 * SR))
            put(np.diff(cl, prepend=0), t0 + off * beat, 0.09, -0.2)
        # woodblock tick
        put(marimba(0.12, 1600) * 0.6, t0 + 2.75 * beat, 0.08, 0.4)
    # melody every phrase (4 bars), sparkle glock every 8 bars
    phrases = bars // 4 + 1
    for p in range(phrases):
        t0 = p * 16 * beat
        for off, n, ln in melody:
            put(marimba(beat * ln * 1.6, note_hz(n)), t0 + off * beat, 0.16 if p % 2 == 0 else 0.13, -0.15)
            if p % 2 == 1: put(glock(beat * 1.5, note_hz(n + 12)), t0 + off * beat, 0.035, 0.3)
    out = L[:, :int(total * SR)]
    fade = np.clip(np.arange(out.shape[1]) / (0.4 * SR), 0, 1) * np.clip((out.shape[1] - np.arange(out.shape[1])) / (1.2 * SR), 0, 1)
    return out * fade / (np.max(np.abs(out)) + 1e-9) * 0.8
