"""Small DSP toolkit for code-made sound effects and music (numpy + scipy only).

Everything is deterministic (seeded noise), mono float32 at 48 kHz unless a function says otherwise.
Shared by every Larry & John reel.
"""
import numpy as np
from scipy import signal

SR = 48000
TAU = 2 * np.pi


# ---------------------------------------------------------------- basics
def n_of(dur):
    return max(1, int(round(dur * SR)))


def t_axis(dur):
    return np.arange(n_of(dur)) / SR


def rng(seed):
    return np.random.default_rng(seed)


def curve(points, dur, kind='lin'):
    """Piecewise curve over [0, dur]: points = [(time, value), ...]; 'lin' or 'exp' (log-space) interpolation."""
    t = t_axis(dur)
    ts = np.array([p[0] for p in points], float)
    vs = np.array([p[1] for p in points], float)
    if kind == 'exp':
        return np.exp(np.interp(t, ts, np.log(np.maximum(vs, 1e-9))))
    return np.interp(t, ts, vs)


def env_ad(dur, attack=0.005, decay=0.2, curve_pow=1.0):
    """Attack then exponential decay (time constant `decay`)."""
    t = t_axis(dur)
    a = np.clip(t / max(attack, 1e-6), 0, 1) ** curve_pow
    return a * np.exp(-np.maximum(t - attack, 0) / max(decay, 1e-6))


def env_ar(dur, attack=0.01, release=0.1):
    """Linear-ish attack, sustain, release at the end."""
    t = t_axis(dur)
    a = np.clip(t / max(attack, 1e-6), 0, 1)
    r = np.clip((dur - t) / max(release, 1e-6), 0, 1)
    return np.sin(a * np.pi / 2) ** 2 * np.sin(r * np.pi / 2) ** 2


def fade(x, fin=0.003, fout=0.01):
    x = x.copy()
    a, b = n_of(fin), n_of(fout)
    if a > 1:
        x[:a] *= np.linspace(0, 1, a)
    if b > 1:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def pad_to(x, n):
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros(n - len(x), x.dtype)])


def mix_at(dst, x, at, gain=1.0):
    """Add x into dst starting at time `at` (seconds); grows nothing, clips at the end. Works for mono or stereo."""
    i = int(round(at * SR))
    if i >= len(dst) or i + len(x) <= 0:
        return dst
    j0 = max(0, -i)
    i = max(0, i)
    k = min(len(dst) - i, len(x) - j0)
    dst[i:i + k] += gain * x[j0:j0 + k]
    return dst


def seq(parts):
    """Concatenate (time, sound, gain) parts into one buffer."""
    end = max(at + len(x) / SR for at, x, g in parts)
    out = np.zeros(n_of(end) + 1)
    for at, x, g in parts:
        mix_at(out, x, at, g)
    return out


def db(x):
    return 10 ** (x / 20)


def normalize(x, peak_db=-1.0):
    p = np.max(np.abs(x)) + 1e-12
    return x * (db(peak_db) / p)


def saturate(x, drive=2.0):
    return np.tanh(x * drive) / np.tanh(drive)


# ---------------------------------------------------------------- oscillators
def phase_of(freq):
    """Phase (in cycles) from a frequency curve (scalar or array)."""
    f = np.asarray(freq, float)
    return np.cumsum(f) / SR


def sine(freq, dur=None, phase0=0.0):
    if np.isscalar(freq):
        freq = np.full(n_of(dur), float(freq))
    return np.sin(TAU * (phase_of(freq) + phase0))


def _blep(t, dt):
    # polyBLEP residual for band-limited discontinuities
    r = np.zeros_like(t)
    m = t < dt
    x = t[m] / dt[m]
    r[m] = x + x - x * x - 1.0
    m2 = t > 1.0 - dt
    x = (t[m2] - 1.0) / dt[m2]
    r[m2] = x * x + x + x + 1.0
    return r


def saw(freq, dur=None):
    if np.isscalar(freq):
        freq = np.full(n_of(dur), float(freq))
    freq = np.asarray(freq, float)
    ph = np.mod(phase_of(freq), 1.0)
    dt = np.clip(freq / SR, 1e-6, 0.5)
    return 2.0 * ph - 1.0 - _blep(ph, dt)


def square(freq, dur=None, width=0.5):
    if np.isscalar(freq):
        freq = np.full(n_of(dur), float(freq))
    freq = np.asarray(freq, float)
    ph = np.mod(phase_of(freq), 1.0)
    dt = np.clip(freq / SR, 1e-6, 0.5)
    sq = np.where(ph < width, 1.0, -1.0)
    sq += _blep(ph, dt)
    sq -= _blep(np.mod(ph + (1 - width), 1.0), dt)
    return sq


def triangle(freq, dur=None):
    sq = square(freq, dur)
    f = np.full(len(sq), float(freq)) if np.isscalar(freq) else np.asarray(freq, float)
    tri = np.cumsum(sq) * (4 * f / SR)
    return tri - np.convolve(tri, np.ones(512) / 512, mode='same')


def harmonic(freq, dur=None, amps=(1.0,), tilt=None, nmax=60):
    """Additive tone: amps per harmonic, or `tilt` (dB/octave) for a glottal-like source. Harmonics above Nyquist drop out."""
    if np.isscalar(freq):
        freq = np.full(n_of(dur), float(freq))
    freq = np.asarray(freq, float)
    ph = TAU * phase_of(freq)
    out = np.zeros(len(freq))
    if tilt is not None:
        amps = [k ** (tilt / 6.02) for k in range(1, nmax + 1)]
    for k, a in enumerate(amps, start=1):
        if a == 0:
            continue
        lim = np.clip((SR * 0.45 - k * freq) / 400.0, 0, 1)
        if not lim.any():
            break
        out += a * lim * np.sin(k * ph)
    return out


def noise(dur, seed=1, color='white'):
    x = rng(seed).standard_normal(n_of(dur))
    if color == 'pink':
        b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
        x = signal.lfilter(b, a, x) * 4
    elif color == 'brown':
        x = np.cumsum(x) * 0.02
        x = signal.lfilter([1, -1], [1, -0.995], x)
    return x


def crackle(dur, rate=300, seed=1, decay=0.0006):
    """Random clicks (crunches, crackles, rips): Poisson impulses with tiny decays and random levels."""
    r = rng(seed)
    n = n_of(dur)
    imp = np.zeros(n)
    k = r.poisson(rate * dur)
    pos = r.integers(0, n, k)
    imp[pos] = r.uniform(0.2, 1.0, k) * r.choice([-1, 1], k)
    ir = np.exp(-np.arange(n_of(decay * 8)) / (decay * SR))
    return signal.fftconvolve(imp, ir)[:n]


# ---------------------------------------------------------------- filters
def lowpass(x, f, order=2):
    b, a = signal.butter(order, min(f, SR * 0.49) / (SR / 2), 'low')
    return signal.lfilter(b, a, x)


def highpass(x, f, order=2):
    b, a = signal.butter(order, max(f, 5) / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [max(lo, 5) / (SR / 2), min(hi, SR * 0.49) / (SR / 2)], 'band')
    return signal.lfilter(b, a, x)


def _rbj(kind, f0, q, gain_db=0.0):
    w = TAU * min(max(f0, 10), SR * 0.49) / SR
    alpha = np.sin(w) / (2 * q)
    cw = np.cos(w)
    if kind == 'bp':        # constant 0 dB peak gain
        b = [alpha, 0, -alpha]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'lp':
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'hp':
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'peak':
        A = 10 ** (gain_db / 40)
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]; a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]; a = np.array(a) / a[0]
    return b, a


def biquad(x, kind, f0, q=0.707, gain_db=0.0):
    b, a = _rbj(kind, f0, q, gain_db)
    return signal.lfilter(b, a, x)


def sweep_filter(x, kind, f_curve, q=0.707, block=128):
    """Time-varying biquad (cutoff/centre follows f_curve), coefficients updated every `block` samples."""
    f_curve = np.broadcast_to(np.asarray(f_curve, float), x.shape)
    y = np.zeros_like(x)
    zi = np.zeros(2)
    for i in range(0, len(x), block):
        j = min(len(x), i + block)
        b, a = _rbj(kind, float(f_curve[(i + j) // 2]), q)
        y[i:j], zi = signal.lfilter(b, a, x[i:j], zi=zi)
    return y


def eq(x, bands):
    """bands = [(kind, f, q, gain_db), ...] in series."""
    for kind, f, q, g in bands:
        x = biquad(x, kind, f, q, g)
    return x


# ---------------------------------------------------------------- resonators / physical models
def modal(dur, modes, seed=1, exciter=None, strike=0.002):
    """Sum of damped sinusoids: modes = [(freq, decay_s, amp), ...]; optional exciter noise colours the attack."""
    t = t_axis(dur)
    r = rng(seed)
    out = np.zeros(len(t))
    for f, d, a in modes:
        out += a * np.sin(TAU * f * t + r.uniform(0, TAU)) * np.exp(-t / d)
    if strike:
        out *= np.clip(t / strike, 0, 1)
    if exciter is not None:
        out[:len(exciter)] += exciter[:len(out)]
    return out


def resonate(x, modes):
    """Pass x through a bank of resonators (freq, q, gain) in parallel (bodies, rooms, bells)."""
    y = np.zeros_like(x)
    for f, q, g in modes:
        y += g * biquad(x, 'bp', f, q)
    return y


def karplus(freq, dur, decay=0.996, bright=0.5, seed=1, pluck_pos=0.18):
    """Karplus-Strong plucked string."""
    n = n_of(dur)
    p = max(2, int(round(SR / freq)))
    r = rng(seed)
    burst = r.uniform(-1, 1, p)
    burst = lowpass(burst, 1500 + 9000 * bright, 1)
    # pluck position comb (removes some harmonics, more "plucky")
    k = max(1, int(p * pluck_pos))
    burst = burst - np.roll(burst, k) * 0.9
    buf = np.zeros(n + p)
    buf[:p] = burst
    # vectorised in chunks of one period: y[n] = decay * 0.5 * (y[n-p] + y[n-p-1])
    for i in range(p, n + p, p):
        j = min(n + p, i + p)
        prev = buf[i - p:j - p]
        prev2 = buf[i - p - 1:j - p - 1] if i - p - 1 >= 0 else np.concatenate([[0.0], buf[i - p:j - p - 1]])
        buf[i:j] = decay * 0.5 * (prev + prev2[:len(prev)])
    return buf[:n]


def glide_tone(f0, f1, dur, kind='sine', shape='exp'):
    f = curve([(0, f0), (dur, f1)], dur, 'exp' if shape == 'exp' else 'lin')
    return {'sine': sine, 'saw': saw, 'square': square, 'tri': triangle}[kind](f)


# ---------------------------------------------------------------- space
def reverb_ir(seconds=1.6, damp=4000, seed=7, predelay=0.012, stereo=True):
    """Synthetic room/hall impulse response: decaying, darkening noise (decorrelated L/R)."""
    n = n_of(seconds)
    t = np.arange(n) / SR
    chans = []
    for c in range(2 if stereo else 1):
        x = rng(seed + c).standard_normal(n) * np.exp(-6.9 * t / seconds)
        # darker tail: blend a low-passed copy in as time goes on
        dark = lowpass(x, damp * 0.35, 1)
        k = np.clip(t / seconds, 0, 1)
        x = lowpass(x * (1 - k) + dark * k, damp, 1)
        x = np.concatenate([np.zeros(n_of(predelay)), x])
        chans.append(x / np.sqrt(np.sum(x ** 2) + 1e-12))
    return np.stack(chans, 1) if stereo else chans[0]


def reverb(x, wet=0.25, seconds=1.4, damp=5000, seed=7):
    """Stereo reverb of a mono or stereo signal; returns stereo (len + tail)."""
    ir = reverb_ir(seconds, damp, seed)
    xs = to_stereo(x)
    out = np.zeros((len(xs) + len(ir) - 1, 2))
    out[:len(xs)] += xs * (1 - wet)
    for c in range(2):
        out[:, c] += wet * signal.fftconvolve(xs[:, c], ir[:, c])
    return out


def echo(x, delay=0.28, feedback=0.45, taps=6, lp=3500):
    """Repeating echo (each repeat a bit darker) — 'JOHN!' down a pit."""
    n = len(x) + int(delay * SR * taps) + 1
    out = np.zeros(n) if x.ndim == 1 else np.zeros((n, x.shape[1]))
    rep = x.copy()
    out[:len(x)] += x
    for k in range(1, taps + 1):
        rep = lowpass(rep, lp, 1) if rep.ndim == 1 else np.stack([lowpass(rep[:, c], lp, 1) for c in range(rep.shape[1])], 1)
        mix_at(out, rep, delay * k, feedback ** k)
    return out


# ---------------------------------------------------------------- stereo
def to_stereo(x):
    return np.stack([x, x], 1) if x.ndim == 1 else x


def pan(x, p=0.0):
    """Equal-power pan of a mono signal: p in [-1, 1]."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1)


def pan_sweep(x, p0, p1):
    p = np.linspace(p0, p1, len(x))
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1)


# ---------------------------------------------------------------- loudness (ITU-R BS.1770-4)
def _k_weight(x, sr=SR):
    # stage 1: high shelf (+4 dB @ ~1.5 kHz); stage 2: RLB high-pass (~38 Hz) — coefficients for any sample rate
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = np.tan(np.pi * f0 / sr)
    Vh, Vb = 10 ** (G / 20), (10 ** (G / 20)) ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a1 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = np.tan(np.pi * f0 / sr)
    a0 = 1 + K / Q + K * K
    b2 = [1, -2, 1]
    a2 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


def loudness_lufs(x, sr=SR):
    """Integrated loudness (LUFS) of mono or stereo audio."""
    xs = x if x.ndim == 2 else x[:, None]
    y = _k_weight(xs, sr)
    blk, hop = int(0.4 * sr), int(0.1 * sr)
    if len(y) < blk:
        return -70.0
    ms = []
    for i in range(0, len(y) - blk + 1, hop):
        ms.append(np.sum(np.mean(y[i:i + blk] ** 2, axis=0)))
    ms = np.array(ms)
    lk = -0.691 + 10 * np.log10(ms + 1e-12)
    g = ms[lk > -70]
    if not len(g):
        return -70.0
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g2 = ms[(lk > -70) & (lk > rel)]
    return float(-0.691 + 10 * np.log10(np.mean(g2) + 1e-12))


def true_peak_db(x):
    """Approximate true peak (4x oversampled)."""
    xs = x if x.ndim == 2 else x[:, None]
    up = signal.resample_poly(xs, 4, 1, axis=0)
    return float(20 * np.log10(np.max(np.abs(up)) + 1e-12))


def limiter(x, ceiling_db=-1.0, release=0.08, lookahead=0.003, block=16):
    """Look-ahead peak limiter (stereo-linked); the gain curve is computed per small block for speed."""
    from scipy.ndimage import minimum_filter1d
    xs = x if x.ndim == 2 else x[:, None]
    ceil = db(ceiling_db)
    la = n_of(lookahead)
    peak = np.max(np.abs(xs), axis=1)
    need = np.minimum(1.0, ceil / (peak + 1e-12))
    L = la + 1
    need = minimum_filter1d(need, size=L, origin=-(L // 2), mode='nearest')     # look ahead
    nb = int(np.ceil(len(need) / block))
    padded = np.pad(need, (0, nb * block - len(need)), constant_values=1.0)
    nb_min = padded.reshape(nb, block).min(axis=1)
    rel = np.exp(-block / (release * SR))
    g = np.empty(nb)
    cur = 1.0
    for i in range(nb):
        t = nb_min[i]
        cur = t if t < cur else t + (cur - t) * rel
        g[i] = cur
    gf = np.repeat(g, block)[:len(need)]
    k = block
    gf = np.convolve(np.pad(gf, (k, k), mode='edge'), np.ones(k) / k, mode='same')[k:-k]
    gf = np.minimum(gf, need)
    out = xs * gf[:, None]
    return out if x.ndim == 2 else out[:, 0]
