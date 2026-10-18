"""ITU-R BS.1770-4 loudness and true peak in NumPy (cross-checked against FFmpeg ebur128).

  integrated(x)   gated integrated loudness, LUFS
  momentary(x)    400 ms loudness, one value per 100 ms step
  short_term(x)   3 s loudness, one value per 100 ms step
  span(x, t0, t1) ungated loudness of one stretch (per-word levels)
  true_peak(x)    4x oversampled peak, dBTP

x is mono (n,) or multichannel (n, ch). All channels get weight 1.0 (no surrounds).
"""

from __future__ import annotations

import math

import numpy as np

SR = 48000


def _biquad_response(b, a, w):
    z = np.exp(-1j * w)
    return (b[0] + b[1] * z + b[2] * z * z) / (a[0] + a[1] * z + a[2] * z * z)


def k_filter_coefficients(sr: int = SR):
    """Stage 1 high shelf and stage 2 RLB high-pass, valid at any sample rate."""
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = math.tan(math.pi * f0 / sr)
    Vh = 10 ** (G / 20)
    Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    shelf = ([(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0],
             [1.0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0])
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = math.tan(math.pi * f0 / sr)
    a0 = 1 + K / Q + K * K
    hp = ([1.0, -2.0, 1.0], [1.0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0])
    return shelf, hp


def k_weight(x: np.ndarray, sr: int = SR) -> np.ndarray:
    """K-weighting applied in the frequency domain with 1 s of zero padding, so the
    (fast-decaying) IIR tail never wraps around: equal to the recursive filter to ~1e-9."""
    x = np.asarray(x, float)
    mono = x.ndim == 1
    x2 = x[:, None] if mono else x
    n = len(x2) + sr
    m = 1 << (n - 1).bit_length()
    w = 2 * np.pi * np.fft.rfftfreq(m)
    (b1, a1), (b2, a2) = k_filter_coefficients(sr)
    H = _biquad_response(b1, a1, w) * _biquad_response(b2, a2, w)
    out = np.fft.irfft(np.fft.rfft(x2, m, axis=0) * H[:, None], m, axis=0)[: len(x2)]
    return out[:, 0] if mono else out


def _block_power(y: np.ndarray, sr: int, block: float, step: float) -> np.ndarray:
    """Channel-summed mean square for every block (rows = blocks)."""
    y = y[:, None] if y.ndim == 1 else y
    nb, ns = int(round(block * sr)), int(round(step * sr))
    if len(y) < nb:
        return np.zeros(0)
    c = np.vstack([np.zeros((1, y.shape[1])), np.cumsum(y * y, axis=0)])
    starts = np.arange(0, len(y) - nb + 1, ns)
    return ((c[starts + nb] - c[starts]) / nb).sum(axis=1)


def _lufs(p):
    return -0.691 + 10 * np.log10(np.maximum(p, 1e-30))


def integrated(x: np.ndarray, sr: int = SR) -> float:
    p = _block_power(k_weight(x, sr), sr, 0.4, 0.1)
    if not len(p):
        return -math.inf
    p = p[_lufs(p) > -70.0]
    if not len(p):
        return -math.inf
    rel = _lufs(p.mean()) - 10.0
    p = p[_lufs(p) > rel]
    return float(_lufs(p.mean()))


def momentary(x: np.ndarray, sr: int = SR) -> np.ndarray:
    return _lufs(_block_power(k_weight(x, sr), sr, 0.4, 0.1))


def short_term(x: np.ndarray, sr: int = SR) -> np.ndarray:
    return _lufs(_block_power(k_weight(x, sr), sr, 3.0, 0.1))


def span(x: np.ndarray, t0: float, t1: float, sr: int = SR, weighted: np.ndarray | None = None) -> float:
    """Ungated K-weighted loudness of x[t0:t1]; pass `weighted` to reuse a k_weight() result."""
    y = k_weight(x, sr) if weighted is None else weighted
    s = y[int(round(t0 * sr)): max(int(round(t1 * sr)), int(round(t0 * sr)) + 1)]
    s = s[:, None] if s.ndim == 1 else s
    return float(_lufs(np.mean(s * s, axis=0).sum()))


def true_peak(x: np.ndarray, oversample: int = 4) -> float:
    """Band-limited (ideal sinc) 4x reconstruction peak in dBTP; zero padding on both
    sides keeps the FFT's periodic wrap from adding edge ringing."""
    x = np.asarray(x, float)
    x2 = x[:, None] if x.ndim == 1 else x
    pad = 4096
    y = np.vstack([np.zeros((pad, x2.shape[1])), x2, np.zeros((pad, x2.shape[1]))])
    n = len(y)
    up = np.fft.irfft(np.fft.rfft(y, axis=0), n * oversample, axis=0) * oversample
    p = float(np.max(np.abs(up)))
    return 20 * math.log10(p) if p > 0 else -math.inf


def sample_peak(x: np.ndarray) -> float:
    p = float(np.max(np.abs(x)))
    return 20 * math.log10(p) if p > 0 else -math.inf
