"""Small synthesis toolkit (numpy/scipy) used by make_audio.py."""
import numpy as np
from scipy import signal

SR = 48000
RNG = np.random.default_rng(1234)


def secs(n):
    return np.arange(int(n * SR)) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def note_num(name):
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    n = names[name[0]]; i = 1
    while i < len(name) and name[i] in '#b':
        n += 1 if name[i] == '#' else -1; i += 1
    return 12 * (int(name[i:]) + 1) + n


def env_adsr(n, a=0.01, d=0.1, s=0.7, r=0.2, sus_time=None):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    total = n
    sus_n = max(0, total - a_n - d_n - r_n) if sus_time is None else int(sus_time * SR)
    e = np.concatenate([np.linspace(0, 1, max(1, a_n), endpoint=False), np.linspace(1, s, max(1, d_n), endpoint=False), np.full(sus_n, s), np.linspace(s, 0, max(1, r_n))])
    if len(e) < total:
        e = np.concatenate([e, np.zeros(total - len(e))])
    return e[:total]


def exp_decay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def saw(f, n, phase=0.0):
    """Band-limited-ish saw via additive harmonics (up to 12k)."""
    t = np.arange(n) / SR
    f = np.broadcast_to(np.asarray(f, float), (n,)) if np.ndim(f) else np.full(n, float(f))
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    out = np.zeros(n)
    fmax = f.max()
    kmax = int(min(40, 12000 / max(fmax, 20)))
    for k in range(1, kmax + 1):
        out += np.sin(k * ph) / k * (1 if k % 2 else 1)
    return out * 0.55


def sq(f, n, phase=0.0):
    f = np.full(n, float(f)) if not np.ndim(f) else f
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    kmax = int(min(25, 12000 / max(np.max(f), 20)))
    out = np.zeros(n)
    for k in range(1, kmax + 1, 2):
        out += np.sin(k * ph) / k
    return out * 0.8


def sine(f, n, phase=0.0):
    f = np.full(n, float(f)) if not np.ndim(f) else f
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def noise(n, rng=RNG):
    return rng.standard_normal(n)


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(0.99, fc / (SR / 2)), 'low')
    return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, max(1e-4, fc / (SR / 2)), 'high')
    return signal.lfilter(b, a, x)


def bp(x, f1, f2, order=2):
    b, a = signal.butter(order, [max(1e-4, f1 / (SR / 2)), min(0.99, f2 / (SR / 2))], 'band')
    return signal.lfilter(b, a, x)


def peak(x, f, q=8.0, gain=1.0):
    b, a = signal.iirpeak(f / (SR / 2), q)
    return signal.lfilter(b, a, x) * gain


def svf_sweep(x, fc_curve, q=0.7):
    """Time-varying lowpass (state-variable filter, per-sample)."""
    y = np.zeros_like(x); low = band = 0.0
    fc = np.asarray(fc_curve)
    for i in range(len(x)):
        f = 2 * np.sin(np.pi * min(fc[i], SR / 6) / SR)
        high = x[i] - low - q * band
        band += f * high
        low += f * band
        y[i] = low
    return y


def onepole_lp_curve(x, fc_curve):
    """Cheap time-varying one-pole lowpass (vectorised in blocks)."""
    y = np.empty_like(x); z = 0.0
    fc = np.asarray(fc_curve)
    a = np.exp(-2 * np.pi * np.clip(fc, 5, SR / 2.2) / SR)
    for i in range(len(x)):
        z = (1 - a[i]) * x[i] + a[i] * z
        y[i] = z
    return y


def karplus(f, dur, bright=0.5, decay=0.996, rng=RNG):
    n = int(dur * SR)
    N = max(2, int(SR / f))
    exc = rng.uniform(-1, 1, N) * np.hanning(N) ** 0.3
    exc = lp(exc, 800 + 9000 * bright)
    x = np.zeros(n); x[:N] = exc
    # y[n] = x[n] + decay*0.5*(y[n-N] + y[n-N-1])
    a = np.zeros(N + 2); a[0] = 1; a[N] = -decay * 0.5; a[N + 1] = -decay * 0.5
    y = signal.lfilter([1.0], a, x)
    return y * 0.8


def marimba(f, dur, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.sin(2 * np.pi * f * t) * np.exp(-t * 5.5)
    out += 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 18)
    out += 0.12 * np.sin(2 * np.pi * f * 9.24 * t) * np.exp(-t * 40)
    mallet = lp(noise(n), 3000) * np.exp(-t * 300) * 0.15
    return (out + mallet) * vel * np.minimum(1, t * 800)


def glock(f, dur, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 5) + 0.18 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 9)
    return out * vel * np.minimum(1, t * 2000)


def kick(dur=0.5, f0=140, f1=42, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 28)
    out = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    click = hp(noise(n), 2000) * np.exp(-t * 400) * 0.25
    return (out + click) * vel


def taiko(dur=1.6, f0=110, f1=48, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 14)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    skin = bp(noise(n), 80, 900) * np.exp(-t * 22) * 0.9
    slap = hp(noise(n), 1500) * np.exp(-t * 120) * 0.25
    return np.tanh((body * 1.2 + skin + slap) * 1.3) * vel


def snare(dur=0.35, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25)
    nz = bp(noise(n), 1500, 9000) * np.exp(-t * 16)
    return (0.5 * tone + nz) * vel


def clap(vel=1.0):
    n = int(0.3 * SR); t = np.arange(n) / SR
    e = np.zeros(n)
    for k, d in enumerate([0, 0.011, 0.022, 0.034]):
        i = int(d * SR); e[i:] += np.exp(-(t[: n - i]) * (180 if k < 3 else 22))
    return bp(noise(n), 900, 6000) * e * 0.6 * vel


def shaker(vel=1.0):
    n = int(0.09 * SR); t = np.arange(n) / SR
    e = np.sin(np.pi * np.minimum(1, t / 0.09)) ** 2
    return hp(noise(n), 5000) * e * 0.35 * vel


def hat(vel=1.0, open_=False):
    n = int((0.3 if open_ else 0.06) * SR); t = np.arange(n) / SR
    return hp(noise(n), 7000) * np.exp(-t * (12 if open_ else 70)) * 0.3 * vel


def cymbal(dur=3.0, vel=1.0, reverse=False):
    n = int(dur * SR); t = np.arange(n) / SR
    x = hp(noise(n), 3500) + 0.3 * bp(noise(n), 300, 1200)
    x *= np.exp(-t * 1.6)
    if reverse:
        x = x[::-1] * np.linspace(0, 1, n) ** 2
    return x * 0.35 * vel


def pad(freqs, dur, a=0.6, r=1.0, cutoff=1800, detune=0.08, voices=3, kind='saw', vib=0.0):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for v in range(voices):
            dt = (v - (voices - 1) / 2) * detune
            ff = f * 2 ** (dt / 12) * (1 + vib * np.sin(2 * np.pi * 5.2 * t + v))
            out += (saw(ff, n, phase=v * 1.7) if kind == 'saw' else sq(ff, n, phase=v))
    out /= max(1, len(freqs) * voices) ** 0.6
    out = lp(out, cutoff, 2)
    return out * env_adsr(n, a, 0.3, 0.85, r)


def formant_voice(f0, dur, vowel='a', vib=0.012, breath=0.15, rng=RNG):
    n = int(dur * SR); t = np.arange(n) / SR
    fv = np.asarray(f0) if np.ndim(f0) else np.full(n, f0)
    fv = fv * (1 + vib * np.sin(2 * np.pi * 5.0 * t + rng.uniform(0, 6)))
    src = saw(fv, n) + breath * noise(n)
    F = {'a': [(730, 90, 1.0), (1090, 110, 0.6), (2440, 160, 0.3)], 'o': [(570, 80, 1.0), (840, 100, 0.5), (2410, 160, 0.2)],
         'e': [(530, 80, 1.0), (1840, 120, 0.5), (2480, 160, 0.3)], 'u': [(300, 60, 1.0), (870, 90, 0.4), (2240, 150, 0.2)],
         'ay': [(660, 90, 1.0), (1700, 120, 0.6), (2400, 160, 0.3)]}[vowel]
    out = np.zeros(n)
    for fc, bw, g in F:
        out += peak(src, fc, q=fc / bw, gain=g)
    return out


def reverb_ir(rt60=2.0, pre=0.02, seed=7, bright=6000):
    rng = np.random.default_rng(seed)
    n = int((rt60 * 1.2 + pre) * SR)
    t = np.arange(n) / SR
    env = np.exp(-6.9 * t / rt60) * (t > pre)
    L = lp(rng.standard_normal(n), bright) * env
    R = lp(rng.standard_normal(n), bright) * env
    L[: int(pre * SR)] = 0; R[: int(pre * SR)] = 0
    return np.stack([L, R], 1) / np.sqrt(np.sum(L ** 2))


def convolve_stereo(x, ir):
    """x: (n,2), ir: (m,2)"""
    out = np.zeros((len(x) + len(ir) - 1, 2))
    for c in range(2):
        out[:, c] = signal.fftconvolve(x[:, c], ir[:, c])
    return out[: len(x)]


class Track:
    def __init__(self, dur):
        self.n = int(dur * SR)
        self.buf = np.zeros((self.n, 2))

    def add(self, t, x, gain=1.0, pan=0.0):
        i = int(round(t * SR))
        if i >= self.n or len(x) == 0:
            return
        if i < 0:
            x = x[-i:]; i = 0
        m = min(len(x), self.n - i)
        if x.ndim == 1:
            gl = np.cos((pan + 1) * np.pi / 4) * 1.414; gr = np.sin((pan + 1) * np.pi / 4) * 1.414
            self.buf[i:i + m, 0] += x[:m] * gain * gl
            self.buf[i:i + m, 1] += x[:m] * gain * gr
        else:
            self.buf[i:i + m] += x[:m] * gain
