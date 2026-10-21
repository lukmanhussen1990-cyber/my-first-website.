"""Small shared DSP toolkit for the reel's synthesized audio (numpy + scipy only).

Everything is offline / non-realtime, mono arrays are 1-D float64, stereo arrays
are shape (n, 2).
"""
import numpy as np
from scipy import signal

SR = 48000
NYQ = SR / 2


# ----------------------------------------------------------------------------- basics
def n_of(dur):
    return max(1, int(round(dur * SR)))


def t_of(n):
    return np.arange(n) / SR


def db(x):
    return 20 * np.log10(np.maximum(x, 1e-12))


def undb(d):
    return 10 ** (d / 20.0)


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def phase_from_freq(f):
    """Integrate an instantaneous frequency array (Hz) into phase (radians)."""
    return 2 * np.pi * np.cumsum(f) / SR


def smooth_noise(rng, n, rate_hz, order=2):
    """Unit-ish band-limited random signal (for wobble / drift), mean 0, ~std 1."""
    x = rng.standard_normal(n)
    sos = signal.butter(order, min(rate_hz, NYQ * 0.9), "low", fs=SR, output="sos")
    y = signal.sosfilt(sos, x)
    s = np.std(y[n // 10:]) if n > 50 else np.std(y)
    return y / (s + 1e-12)


# ----------------------------------------------------------------------------- filters
def lp(x, fc, order=2):
    sos = signal.butter(order, min(fc, NYQ * 0.95), "low", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def hp(x, fc, order=2):
    sos = signal.butter(order, fc, "high", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, min(hi, NYQ * 0.95)], "band", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def peak_res(x, f0, q):
    """Constant-peak (0 dB) resonant bandpass."""
    b, a = signal.iirpeak(f0, q, fs=SR)
    return signal.lfilter(b, a, x, axis=0)


def peaking_eq(x, f0, gain_db, q):
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    al = np.sin(w0) / (2 * q)
    b = np.array([1 + al * A, -2 * np.cos(w0), 1 - al * A])
    a = np.array([1 + al / A, -2 * np.cos(w0), 1 - al / A])
    return signal.lfilter(b / a[0], a / a[0], x, axis=0)


def tv_bandpass(x, fc, q, block=64):
    """Time-varying RBJ bandpass (0 dB peak); fc may be an array (Hz per sample)."""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    q = np.broadcast_to(np.asarray(q, dtype=float), x.shape)
    y = np.zeros_like(x)
    zi = np.zeros(2)
    for s in range(0, len(x), block):
        f = float(np.clip(fc[s], 20, SR * 0.45))
        w0 = 2 * np.pi * f / SR
        al = np.sin(w0) / (2 * float(q[s]))
        a0 = 1 + al
        b = np.array([al, 0.0, -al]) / a0
        a = np.array([1.0, -2 * np.cos(w0) / a0, (1 - al) / a0])
        y[s:s + block], zi = signal.lfilter(b, a, x[s:s + block], zi=zi)
    return y


# ----------------------------------------------------------------------------- envelopes
def env_ar(n, att, dec):
    """Attack (1-exp) x exponential decay."""
    t = t_of(n)
    return (1 - np.exp(-t / max(att, 1e-5))) * np.exp(-t / dec)


def env_adsr(n, a, d, s, r, gate):
    """Linear-ish ADSR with raised-cosine attack; gate = note-on length in seconds."""
    t = t_of(n)
    e = np.zeros(n)
    a = max(a, 1e-4)
    att = t < a
    e[att] = 0.5 - 0.5 * np.cos(np.pi * t[att] / a)
    dec = (t >= a) & (t < gate)
    e[dec] = s + (1 - s) * np.exp(-(t[dec] - a) / max(d, 1e-4))
    # level at gate
    if gate <= a:
        lg = 0.5 - 0.5 * np.cos(np.pi * min(gate, a) / a)
    else:
        lg = s + (1 - s) * np.exp(-(gate - a) / max(d, 1e-4))
    rel = t >= gate
    e[rel] = lg * np.exp(-(t[rel] - gate) / max(r, 1e-4))
    return e


def fade_edges(x, fin=0.002, fout=0.005):
    n = len(x)
    a = min(n // 2, n_of(fin))
    b = min(n // 2, n_of(fout))
    if a > 0:
        x[:a] *= np.linspace(0, 1, a)[:, None] if x.ndim == 2 else np.linspace(0, 1, a)
    if b > 0:
        x[-b:] *= np.linspace(1, 0, b)[:, None] if x.ndim == 2 else np.linspace(1, 0, b)
    return x


# ----------------------------------------------------------------------------- building blocks
def modal(n, modes, att=0.0004, rng=None):
    """Sum of exponentially damped sines: modes = [(freq, tau, amp), ...]."""
    t = t_of(n)
    out = np.zeros(n)
    for f, tau, a in modes:
        if f < NYQ * 0.9:
            ph = rng.uniform(0, 2 * np.pi) if rng is not None else 0.0
            out += a * np.sin(2 * np.pi * f * t + ph) * np.exp(-t / tau)
    return out * (1 - np.exp(-t / att))


def formant_gain(f, formants):
    """Parallel 2-pole resonance magnitudes (each normalised to its gain at F).

    formants: list of (F, B, G) where each may be a scalar or array matching f.
    """
    H = 0.0
    for F, B, G in formants:
        H = H + G * (B * F) / np.sqrt((F * F - f * f) ** 2 + (B * f) ** 2 + 1e-9)
    return H


def voice(f0, formants, tilt=1.0, max_f=6000.0, rng=None, jitter_phase=False):
    """Band-limited glottal pulse train (additive harmonics with spectral tilt) shaped
    by a time-varying formant envelope. f0 is an array (Hz per sample)."""
    n = len(f0)
    ph = phase_from_freq(f0)
    K = int(max_f / max(np.min(f0), 30)) + 1
    out = np.zeros(n)
    for k in range(1, K + 1):
        fk = k * f0
        if np.min(fk) > max_f:
            break
        w = k ** (-tilt) * formant_gain(fk, formants)
        # smooth band-limit (no aliasing): fade harmonics approaching max_f
        w = w * np.clip((max_f - fk) / (0.15 * max_f), 0, 1)
        p0 = rng.uniform(0, 0.3) if (rng is not None and jitter_phase) else 0.0
        out += w * np.sin(k * ph + p0)
    return out


def pan_st(x, pan):
    """Equal-power pan; pan in [-1, 1] (scalar or array)."""
    th = (np.asarray(pan) + 1) * np.pi / 4
    if x.ndim == 2:  # already stereo: balance
        return np.stack([x[:, 0] * np.cos(th) * np.sqrt(2), x[:, 1] * np.sin(th) * np.sqrt(2)], 1)
    return np.stack([x * np.cos(th), x * np.sin(th)], 1) * np.sqrt(2)


def add_at(buf, x, start):
    """Mix x into buf starting at sample index start (clipped to buffer)."""
    if start >= len(buf):
        return
    if start < 0:
        x = x[-start:]
        start = 0
    end = min(len(buf), start + len(x))
    buf[start:end] += x[:end - start]


# ----------------------------------------------------------------------------- reverb
def synth_ir(rt60=0.4, length=None, predelay=0.008, lp_hz=6000, seed=1, early=True):
    """Decorrelated stereo exponential-noise room impulse response (energy-normalised)."""
    rng = np.random.default_rng(seed)
    length = length or rt60 * 1.6
    n = n_of(length)
    t = t_of(n)
    env = np.exp(-6.91 * t / rt60) * (1 - np.exp(-t / 0.004))
    ir = rng.standard_normal((n, 2)) * env[:, None]
    # darker tail: progressively stronger lowpass via blend of two filtered copies
    dark = lp(ir, lp_hz * 0.35, 2)
    br = lp(ir, lp_hz, 2)
    mix = np.clip(t / rt60, 0, 1)[:, None]
    ir = br * (1 - mix) + dark * mix
    if early:
        for d, g, ch in [(0.011, 0.5, 0), (0.017, 0.42, 1), (0.023, 0.33, 0), (0.031, 0.3, 1),
                         (0.037, 0.22, 0), (0.043, 0.2, 1)]:
            i = n_of(d)
            if i < n:
                ir[i, ch] += g * 3
    pd = n_of(predelay)
    ir = np.vstack([np.zeros((pd, 2)), ir])
    ir /= np.sqrt(np.sum(ir ** 2) / 2)
    return ir


def convolve_st(x, ir):
    from scipy.signal import fftconvolve
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    out = np.zeros((len(x), 2))
    for c in range(2):
        out[:, c] = fftconvolve(x[:, c], ir[:, c])[:len(x)]
    return out


# ----------------------------------------------------------------------------- metering / mastering
def lufs(x):
    """ITU-R BS.1770-4 integrated loudness (48 kHz), stereo or mono."""
    if x.ndim == 1:
        x = x[:, None]
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)
    blk = n_of(0.4)
    hop = n_of(0.1)
    ms = []
    for s in range(0, len(y) - blk + 1, hop):
        ms.append(np.sum(np.mean(y[s:s + blk] ** 2, axis=0)))
    ms = np.array(ms)
    L = -0.691 + 10 * np.log10(ms + 1e-15)
    g = ms[L > -70]
    if len(g) == 0:
        return -np.inf
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g2 = ms[(L > -70) & (L > rel)]
    return -0.691 + 10 * np.log10(np.mean(g2))


def true_peak_db(x):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return db(np.max(np.abs(up)))


def limiter(x, ceiling_db=-1.0, look_ms=4.0, release_ms=60.0):
    """Zero-latency (offline, look-around) brickwall-ish soft limiter.

    Gain = smoothed running-min of the required gain, so peaks never exceed ceiling."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    c = undb(ceiling_db)
    pk = np.max(np.abs(x), axis=1) if x.ndim == 2 else np.abs(x)
    need = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    L = max(3, n_of(look_ms / 1000))
    R = max(L, n_of(release_ms / 1000))
    g = minimum_filter1d(need, size=2 * R + 1, mode="nearest")
    g = uniform_filter1d(g, size=R, mode="nearest")
    # guarantee (smoothing window <= min window half-width)
    g = np.minimum(g, minimum_filter1d(need, size=2 * L + 1, mode="nearest"))
    g = uniform_filter1d(g, size=L, mode="nearest")
    g = np.minimum(g, need)
    return x * (g[:, None] if x.ndim == 2 else g)


def max_rms_db(x, win=0.05):
    """Max short-window RMS (dBFS), a quick 'momentary level' meter."""
    m = x if x.ndim == 1 else np.mean(x ** 2, axis=1) ** 0.5
    w = n_of(win)
    if len(m) < w:
        return db(np.sqrt(np.mean(m ** 2)))
    from scipy.ndimage import uniform_filter1d
    p = uniform_filter1d(m ** 2, size=w, mode="constant")
    return db(np.sqrt(np.max(p)))
