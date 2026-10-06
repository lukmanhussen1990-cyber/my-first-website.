"""Tiny numpy synth: every sound in the video is generated here (no samples, no licensed music)."""
import numpy as np
from scipy import signal

SR = 48000


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env_adsr(n, a=0.005, d=0.1, s=0.0, r=0.1, sustain_time=0.0):
    """Linear-attack / exponential-ish decay envelope of n samples."""
    e = np.zeros(n)
    ia, idd, isus = int(a * SR), int(d * SR), int(sustain_time * SR)
    ir = int(r * SR)
    i = 0
    seg = min(ia, n - i); e[i:i + seg] = np.linspace(0, 1, seg, endpoint=False) if seg > 0 else e[i:i + seg]; i += seg
    seg = min(idd, n - i)
    if seg > 0: e[i:i + seg] = s + (1 - s) * np.exp(-5 * np.linspace(0, 1, seg)); i += seg
    seg = min(isus, n - i)
    if seg > 0: e[i:i + seg] = s; i += seg
    seg = min(ir, n - i)
    if seg > 0: e[i:i + seg] = (e[i - 1] if i > 0 else s) * np.exp(-6 * np.linspace(0, 1, seg)); i += seg
    return e


def exp_decay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def lowpass(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR * 0.45) / (SR / 2), 'low')
    return signal.lfilter(b, a, x)


def highpass(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(hi, SR * 0.45) / (SR / 2)], 'band')
    return signal.lfilter(b, a, x)


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def noise(n, seed=0):
    return np.random.default_rng(seed).standard_normal(n)


# ---------------- instruments ----------------

def marimba(freq, dur=0.9, vel=1.0):
    t = t_axis(dur)
    x = (np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.35)
         + 0.35 * np.sin(2 * np.pi * freq * 3.98 * t) * np.exp(-t / 0.06)
         + 0.12 * np.sin(2 * np.pi * freq * 9.9 * t) * np.exp(-t / 0.02))
    x[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return x * vel * 0.5


def pluck(freq, dur=1.2, vel=1.0, bright=0.5, seed=1):
    """Karplus-Strong plucked string."""
    n = int(dur * SR)
    period = max(2, int(round(SR / freq)))
    rng = np.random.default_rng(seed)
    buf = rng.uniform(-1, 1, period)
    buf = lowpass(buf, 2000 + 8000 * bright, 1)
    out = np.zeros(n)
    decay = 0.996
    for i in range(n):
        v = buf[i % period]
        out[i] = v
        buf[i % period] = decay * 0.5 * (v + buf[(i + 1) % period])
    return out * vel * 0.6


def bell(freq, dur=2.0, vel=1.0):
    t = t_axis(dur)
    partials = [(1, 1, 1.4), (2.76, 0.45, 0.7), (5.4, 0.25, 0.35), (8.93, 0.12, 0.2)]
    x = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t / d) for r, a, d in partials)
    x[: int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    return x * vel * 0.35


def pad(freqs, dur, vel=1.0, attack=0.6, release=1.0, cutoff=1800, seed=3):
    """Warm detuned-saw pad chord."""
    t = t_axis(dur)
    x = np.zeros_like(t)
    rng = np.random.default_rng(seed)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12)
            ph = rng.uniform(0, 1)
            x += signal.sawtooth(2 * np.pi * ff * t + ph * 2 * np.pi) * 0.33
    x = lowpass(x, cutoff, 2)
    env = np.minimum(1, t / attack) * np.minimum(1, np.maximum(0, (dur - t) / release))
    return x * env * vel * 0.08


def sub_thump(dur=0.5, f0=110, f1=42, vel=1.0):
    t = t_axis(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.04)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.16) * vel


def pop(f0=420, f1=900, dur=0.09, vel=1.0):
    """Bubbly 'bloop': fast upward sine glide with a click."""
    t = t_axis(dur)
    f = f0 + (f1 - f0) * (1 - np.exp(-t / (dur * 0.35)))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t / (dur * 0.3))
    x[: int(0.001 * SR)] *= np.linspace(0, 1, int(0.001 * SR))
    return x * vel * 0.7


def click(vel=1.0, seed=0, tone=3500):
    n = int(0.03 * SR)
    x = bandpass(noise(n, seed), tone * 0.6, tone * 1.6) * exp_decay(n, 0.004)
    return x * vel * 0.6


def whoosh(dur=0.6, f_lo=300, f_hi=3000, vel=1.0, seed=5, rise=True):
    n = int(dur * SR)
    x = noise(n, seed)
    out = np.zeros(n)
    blk = 512
    for i in range(0, n, blk):
        p = i / n
        p = p if rise else 1 - p
        fc = f_lo * (f_hi / f_lo) ** p
        seg = x[max(0, i - 256): i + blk]
        y = bandpass(seg, fc * 0.7, fc * 1.4, 1)
        out[i: i + blk] = y[-len(out[i: i + blk]):]
    env = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
    return out * env * vel * 0.9


def shimmer(dur=1.2, base=2400, count=14, vel=1.0, seed=7):
    """Sparkly cluster of tiny high bells."""
    rng = np.random.default_rng(seed)
    out = np.zeros(int(dur * SR))
    for k in range(count):
        st = rng.uniform(0, dur * 0.6)
        f = base * 2 ** (rng.integers(0, 24) / 12)
        b = bell(f, dur=0.6, vel=rng.uniform(0.2, 0.5))
        i = int(st * SR)
        m = min(len(b), len(out) - i)
        out[i:i + m] += b[:m]
    return out * vel


def riser(dur=1.0, f0=200, f1=1200, vel=1.0):
    t = t_axis(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = 0.6 * np.sin(ph) + 0.4 * signal.sawtooth(ph) * 0.3
    x = lowpass(x, 3000)
    return x * (t / dur) ** 2 * vel * 0.4


def scribble(dur=0.5, vel=1.0, seed=11):
    """Pen-on-paper scratch."""
    n = int(dur * SR)
    x = bandpass(noise(n, seed), 1800, 7000)
    t = np.arange(n) / SR
    mod = 0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 9 * t + np.random.default_rng(seed).uniform(0, 6)))
    env = np.minimum(1, t / 0.03) * np.minimum(1, (dur - t) / 0.08)
    return x * mod * env * vel * 0.25


# ---------------- mixing ----------------

class Mix:
    def __init__(self, dur):
        self.n = int(dur * SR)
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)
        self.verbL = np.zeros(self.n)
        self.verbR = np.zeros(self.n)

    def add(self, x, at, gain=1.0, pan=0.0, verb=0.15):
        i = int(at * SR)
        if i >= self.n: return
        x = x[: self.n - i] * gain
        gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.L[i:i + len(x)] += x * gl
        self.R[i:i + len(x)] += x * gr
        self.verbL[i:i + len(x)] += x * gl * verb
        self.verbR[i:i + len(x)] += x * gr * verb

    def render(self, room=1.6, peak_db=-1.0):
        rng = np.random.default_rng(99)
        m = int(room * SR)
        tt = np.arange(m) / SR
        irL = rng.standard_normal(m) * np.exp(-tt / (room / 6))
        irR = rng.standard_normal(m) * np.exp(-tt / (room / 6))
        irL, irR = lowpass(irL, 5000), lowpass(irR, 5000)
        irL /= np.sqrt((irL ** 2).sum()); irR /= np.sqrt((irR ** 2).sum())
        wl = signal.fftconvolve(self.verbL, irL)[: self.n]
        wr = signal.fftconvolve(self.verbR, irR)[: self.n]
        L, R = self.L + wl * 0.8, self.R + wr * 0.8
        st = np.stack([L, R], 1)
        st = highpass(st.T, 30).T
        pk = np.abs(st).max() + 1e-9
        st = st / pk * 1.15
        st = np.tanh(st)  # gentle soft clip
        st = st / (np.abs(st).max() + 1e-9) * 10 ** (peak_db / 20)
        return st


def write_wav(path, st):
    from scipy.io import wavfile
    wavfile.write(path, SR, (np.clip(st, -1, 1) * 32767).astype(np.int16))
