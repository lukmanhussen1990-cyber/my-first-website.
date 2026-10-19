"""Small numpy-only DSP toolkit used by make_audio.py.

Filters work in the frequency domain (FFT), time-varying sounds are built with an STFT
overlap-add, and loudness is measured with ITU-R BS.1770-4 (K-weighting + gating).
"""
import numpy as np

SR = 48000


def secs(n):
    return np.arange(n) / SR


def db(x):
    return 10.0 ** (x / 20.0)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-12)


# ---------------------------------------------------------------------------- filters
def fft_filter(x, mag):
    """Zero-phase filter: mag(freqs) -> amplitude response."""
    n = len(x)
    m = 1 << int(np.ceil(np.log2(n + 1)))
    X = np.fft.rfft(x, m)
    f = np.fft.rfftfreq(m, 1 / SR)
    return np.fft.irfft(X * mag(f), m)[:n]


def lp(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order))


def hp(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order))


def bp(fc, octaves=1.0):
    """Smooth band-pass: gaussian on a log-frequency axis, `octaves` = half-width (1 sd)."""
    return lambda f: np.exp(-0.5 * (np.log2(np.maximum(f, 1.0) / fc) / octaves) ** 2)


def shaped_noise(rng, n, mag):
    return fft_filter(rng.standard_normal(n), mag)


def stft_noise(rng, n, mag_tf, nfft=2048):
    """Noise whose spectrum changes over time. mag_tf(t[frames], f[bins]) -> 2D magnitudes."""
    hop = nfft // 4
    frames = (n + nfft) // hop + 1
    tc = (np.arange(frames) * hop - nfft / 2) / SR
    f = np.fft.rfftfreq(nfft, 1 / SR)
    M = mag_tf(tc[:, None], f[None, :])
    ph = np.exp(2j * np.pi * rng.random(M.shape))
    blocks = np.fft.irfft(M * ph, nfft, axis=1) * np.hanning(nfft)[None, :]
    out = np.zeros(frames * hop + nfft)
    for i in range(frames):                       # overlap-add
        out[i * hop:i * hop + nfft] += blocks[i]
    out = out[nfft // 2:nfft // 2 + n]
    return out / (np.sqrt(np.mean(out ** 2)) + 1e-12) * 0.25


# ---------------------------------------------------------------------------- envelopes
def env_ad(n, attack, decay, curve=1.0):
    """Linear-ish attack then exponential decay (seconds)."""
    t = secs(n)
    a = np.clip(t / max(attack, 1e-4), 0, 1) ** curve
    d = np.exp(-np.maximum(t - attack, 0) / max(decay, 1e-4))
    return a * d


def env_bell(n, peak_frac=0.5, power=1.0):
    """Smooth 0 -> 1 -> 0 hump, peak at peak_frac of the length."""
    u = np.linspace(0, 1, n)
    p = peak_frac
    rise = np.sin(np.clip(u / p, 0, 1) * np.pi / 2) ** 2
    fall = np.cos(np.clip((u - p) / (1 - p), 0, 1) * np.pi / 2) ** 2
    return np.where(u < p, rise, fall) ** power


def fade(sig, fin=0.005, fout=0.005):
    n = len(sig)
    a, b = int(fin * SR), int(fout * SR)
    g = np.ones(n)
    if a > 0:
        g[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if b > 0:
        g[n - b:] *= np.cos(np.linspace(0, np.pi / 2, b)) ** 2
    return sig * g


def from_points(n, t0, rate, values):
    """Resample a cue envelope (values sampled at `rate` Hz starting at t0) onto n samples."""
    t = secs(n)
    tp = np.arange(len(values)) / rate
    return np.interp(t, tp, values, left=values[0], right=values[-1])


# ---------------------------------------------------------------------------- mixing
class Bus:
    def __init__(self, n):
        self.L = np.zeros(n)
        self.R = np.zeros(n)

    def add(self, t, sig, gain_db=0.0, pan=0.0, width=0.0):
        """Place mono (or (L, R) tuple) `sig` at time t (s), equal-power pan -1..1."""
        i = int(round(t * SR))
        if isinstance(sig, tuple):
            l, r = sig
        else:
            l = r = sig
        g = db(gain_db)
        pan = float(np.clip(pan, -1, 1))
        gl, gr = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2), np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
        j0, j1 = max(0, i), min(len(self.L), i + len(l))
        if j1 <= j0:
            return
        s0 = j0 - i
        self.L[j0:j1] += l[s0:s0 + j1 - j0] * g * gl
        self.R[j0:j1] += r[s0:s0 + j1 - j0] * g * gr

    def stereo(self):
        return np.stack([self.L, self.R])


def convolve_fft(x, h):
    n = len(x) + len(h) - 1
    m = 1 << int(np.ceil(np.log2(n)))
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(h, m), m)[:len(x)]


def reverb_ir(rng, seconds=2.2, predelay=0.02):
    """Synthetic stereo room: exponentially decaying noise that gets darker as it decays."""
    n = int(seconds * SR)
    t = secs(n)
    irs = []
    for _ in range(2):
        nz = rng.standard_normal(n) * np.exp(-t / (seconds / 6.9))
        dark = stft_noise(rng, n, lambda tt, f: np.exp(-f / (9000 * np.exp(-np.maximum(tt, 0) * 1.4) + 600)))
        ir = nz * 0.5 + dark * np.exp(-t / (seconds / 6.9)) * 2.0
        ir = fft_filter(ir, hp(120, 1) )
        ir[:int(predelay * SR)] = 0
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return irs


# ---------------------------------------------------------------------------- loudness (BS.1770-4)
_K1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
_K2 = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])


def _biquad_mag(f, b, a):
    z = np.exp(-2j * np.pi * f / SR)
    return np.abs((b[0] + b[1] * z + b[2] * z * z) / (a[0] + a[1] * z + a[2] * z * z))


def k_weight(x):
    return fft_filter(x, lambda f: _biquad_mag(f, *_K1) * _biquad_mag(f, *_K2))


def integrated_lufs(st):
    """st: (2, n) stereo array -> integrated loudness in LUFS."""
    w = [k_weight(ch) for ch in st]
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    starts = np.arange(0, st.shape[1] - blk + 1, hop)
    cs = [np.concatenate([[0], np.cumsum(c * c)]) for c in w]
    ms = sum((c[starts + blk] - c[starts]) / blk for c in cs)
    lk = -0.691 + 10 * np.log10(ms + 1e-15)
    gated = ms[lk > -70]
    rel = -0.691 + 10 * np.log10(np.mean(gated)) - 10
    final = ms[(lk > -70) & (lk > rel)]
    return -0.691 + 10 * np.log10(np.mean(final))


def oversample4(x):
    n = len(x)
    return np.fft.irfft(np.fft.rfft(x), 4 * n) * 4


def true_peak_db(st):
    return 20 * np.log10(max(np.max(np.abs(oversample4(ch))) for ch in st) + 1e-12)


# ---------------------------------------------------------------------------- limiter
def running_min(x, w):
    """Centered running minimum over a window of w samples (van Herk / Gil-Werman, O(n))."""
    h = w // 2
    pad = np.concatenate([np.full(h, x[0]), x, np.full(w, x[-1])])
    m = int(np.ceil(len(pad) / w)) * w
    pad = np.concatenate([pad, np.full(m - len(pad), x[-1])]).reshape(-1, w)
    pre = np.minimum.accumulate(pad, axis=1).ravel()
    suf = np.minimum.accumulate(pad[:, ::-1], axis=1)[:, ::-1].ravel()
    idx = np.arange(len(x))
    return np.minimum(suf[idx], pre[idx + w - 1])


def smooth_hann(x, w):
    k = np.hanning(w + 2)[1:-1]
    k /= k.sum()
    y = convolve_fft(np.concatenate([np.full(w, x[0]), x, np.full(w, x[-1])]), k)
    return y[w + w // 2: w + w // 2 + len(x)]


def limit(st, ceiling_db=-1.3):
    """Look-ahead true-peak limiter. The gain never exceeds what each sample needs."""
    ceil = db(ceiling_db)
    peak = np.max(np.abs(np.stack([oversample4(ch) for ch in st])), axis=0)
    peak = peak.reshape(-1, 4).max(axis=1)
    need = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    if need.min() >= 1.0:
        return st, 0.0
    g = need
    for ms in (10, 30):                                     # fast stage, then a smoother release stage
        w = int(ms / 1000 * SR) * 2 + 1
        g = smooth_hann(running_min(g, w), w)
        g = np.minimum(g, need)
    return st * g[None, :], 20 * np.log10(g.min())
