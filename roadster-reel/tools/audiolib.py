"""Small synthesis toolkit (numpy/scipy): oscillators, envelopes, filters, reverb, mixing."""
import numpy as np
from scipy.signal import lfilter, fftconvolve, butter, sosfilt

SR = 48000
RNG = np.random.default_rng(1234)


def secs(n):
    return np.arange(int(round(n * SR))) / SR


def note_hz(name):
    """'A4' -> 440, 'C#5' etc."""
    names = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    n = names[name[0]]
    i = 1
    if name[1] == '#': n += 1; i = 2
    elif name[1] == 'b': n -= 1; i = 2
    octave = int(name[i:])
    return 440.0 * 2 ** ((n + (octave - 4) * 12) / 12)


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def phase_from_freq(f):
    f = np.broadcast_to(f, f.shape) if isinstance(f, np.ndarray) else f
    return 2 * np.pi * np.cumsum(f) / SR


def poly_blep(t, dt):
    y = np.zeros_like(t)
    m = t < dt
    x = t[m] / dt[m] if isinstance(dt, np.ndarray) else t[m] / dt
    y[m] = x + x - x * x - 1
    m2 = t > 1 - (dt if not isinstance(dt, np.ndarray) else dt)
    if isinstance(dt, np.ndarray):
        x2 = (t[m2] - 1) / dt[m2]
    else:
        x2 = (t[m2] - 1) / dt
    y[m2] = x2 * x2 + x2 + x2 + 1
    return y


def saw(f, n):
    f = np.full(n, f) if np.isscalar(f) else f
    dt = f / SR
    ph = np.cumsum(dt) % 1.0
    return 2 * ph - 1 - poly_blep(ph, dt)


def square(f, n, pw=0.5):
    f = np.full(n, f) if np.isscalar(f) else f
    dt = f / SR
    ph = np.cumsum(dt) % 1.0
    s = np.where(ph < pw, 1.0, -1.0)
    s += poly_blep(ph, dt)
    s -= poly_blep((ph + (1 - pw)) % 1.0, dt)
    return s


def sine(f, n, ph0=0.0):
    f = np.full(n, f) if np.isscalar(f) else f
    return np.sin(ph0 + 2 * np.pi * np.cumsum(f) / SR)


def noise(n):
    return RNG.standard_normal(n).astype(np.float64)


def env_adsr(n, a=0.005, d=0.1, s=0.6, r=0.1, hold=None):
    t = np.arange(n) / SR
    hold = (n / SR - r) if hold is None else hold
    e = np.where(t < a, t / max(a, 1e-6), np.where(t < a + d, 1 - (1 - s) * (t - a) / max(d, 1e-6), s))
    rel = np.clip((t - hold) / max(r, 1e-6), 0, 1)
    return e * (1 - rel)


def env_exp(n, tau, a=0.002):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-6)) * np.exp(-t / tau)


def biquad(kind, f0, q=0.707, gain_db=0.0):
    w = 2 * np.pi * f0 / SR
    c, s = np.cos(w), np.sin(w)
    al = s / (2 * q)
    A = 10 ** (gain_db / 40)
    if kind == 'lp':
        b = [(1 - c) / 2, 1 - c, (1 - c) / 2]; a = [1 + al, -2 * c, 1 - al]
    elif kind == 'hp':
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; a = [1 + al, -2 * c, 1 - al]
    elif kind == 'bp':
        b = [al, 0, -al]; a = [1 + al, -2 * c, 1 - al]
    elif kind == 'peak':
        b = [1 + al * A, -2 * c, 1 - al * A]; a = [1 + al / A, -2 * c, 1 - al / A]
    elif kind == 'lowshelf':
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) - (A - 1) * c + sq), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - sq)]
        a = [(A + 1) + (A - 1) * c + sq, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - sq]
    elif kind == 'highshelf':
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * c + sq), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sq)]
        a = [(A + 1) - (A - 1) * c + sq, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sq]
    b = np.array(b) / a[0]; a = np.array(a) / a[0]
    return b, a


def filt(x, kind, f0, q=0.707, gain_db=0.0):
    b, a = biquad(kind, min(f0, SR * 0.45), q, gain_db)
    return lfilter(b, a, x)


def sweep_filter(x, kind, f_curve, q=0.9, block=256):
    """time-varying biquad (f_curve: per-sample cutoff array)"""
    y = np.zeros_like(x)
    zi = np.zeros(2)
    for i in range(0, len(x), block):
        f0 = float(np.clip(f_curve[min(i + block // 2, len(f_curve) - 1)], 20, SR * 0.45))
        b, a = biquad(kind, f0, q)
        seg, zi = lfilter(b, a, x[i:i + block], zi=zi)
        y[i:i + block] = seg
    return y


def lp(x, f, order=2):
    sos = butter(order, min(f, SR * 0.45), 'low', fs=SR, output='sos'); return sosfilt(sos, x)


def hp(x, f, order=2):
    sos = butter(order, f, 'high', fs=SR, output='sos'); return sosfilt(sos, x)


def bp(x, f1, f2, order=2):
    sos = butter(order, [f1, min(f2, SR * 0.45)], 'band', fs=SR, output='sos'); return sosfilt(sos, x)


_IR = {}


def reverb(x, size=1.6, damp=4000, wet=0.3, seed=7, stereo=True):
    key = (size, damp, seed)
    if key not in _IR:
        r = np.random.default_rng(seed)
        n = int(size * SR)
        t = np.arange(n) / SR
        irs = []
        for ch in range(2):
            ir = r.standard_normal(n) * np.exp(-6.9 * t / size)
            ir = lp(ir, damp)
            ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
            ir /= np.sqrt(np.sum(ir ** 2))
            irs.append(ir)
        _IR[key] = irs
    irs = _IR[key]
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    out = np.zeros((len(x) + len(irs[0]) - 1, 2))
    for ch in range(2):
        out[:, ch] = fftconvolve(x[:, ch], irs[ch])
    out = out[: len(x)] * wet
    return x * (1 - wet * 0.3) + out


def pan(x, p):
    """p in [-1, 1] -> stereo (equal power)"""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def place(buf, x, t0, gain=1.0):
    """mix stereo/mono x into stereo buf at time t0 (seconds)"""
    i0 = int(round(t0 * SR))
    if x.ndim == 1:
        x = np.stack([x, x], axis=1) * 0.7071
    if i0 < 0:
        x = x[-i0:]; i0 = 0
    n = min(len(x), len(buf) - i0)
    if n > 0:
        buf[i0:i0 + n] += x[:n] * gain


def db(x):
    return 10 ** (x / 20)


def soft_clip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


def limiter(x, ceiling_db=-1.0, release=0.08, lookahead=0.004):
    """simple look-ahead peak limiter on a stereo buffer"""
    c = db(ceiling_db)
    peak = np.max(np.abs(x), axis=1)
    la = int(lookahead * SR)
    # running max over the look-ahead window
    from scipy.ndimage import maximum_filter1d
    pk = maximum_filter1d(peak, size=2 * la + 1)
    g = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    # smooth: instant attack (already looked ahead), exponential release
    a = np.exp(-1.0 / (release * SR))
    gs = np.empty_like(g); cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else a * cur + (1 - a) * g[i]
        gs[i] = cur
    return x * gs[:, None]
