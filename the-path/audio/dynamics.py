"""Offline dynamics in NumPy for the VO stem (and later the master bus).

  compressor(x)    feed-forward RMS compressor, soft knee, attack / release on a 1 ms grid
  expander(x)      range-limited downward expander for the room tone between phrases
  tp_limiter(x)    look-ahead true-peak limiter (4x oversampled detection, dB-linear release)

All three return (processed, gain_db_per_sample).  x is mono (n,) or stereo (n, 2);
stereo is detected on the louder channel and both channels get the same gain.
"""

from __future__ import annotations

import numpy as np

SR = 48000


def _mono(x):
    return np.max(np.abs(x), axis=1) if x.ndim == 2 else np.abs(x)


def _block_level_db(x, sr, block, win):
    """RMS level in dB every `block` samples, over a centred `win`-sample window."""
    p = x ** 2 if x.ndim == 1 else np.max(x ** 2, axis=1)
    c = np.concatenate([[0.0], np.cumsum(p)])
    centres = np.arange(0, len(p), block)
    a = np.clip(centres - win // 2, 0, len(p))
    b = np.clip(centres + win // 2, 0, len(p))
    return 10 * np.log10((c[b] - c[a]) / np.maximum(b - a, 1) + 1e-14)


def _smooth(g, down_blocks, up_blocks):
    """One-pole smoothing of a gain curve in dB: separate time constants for falling
    (more attenuation) and rising gain."""
    ad, au = np.exp(-1.0 / max(down_blocks, 1e-6)), np.exp(-1.0 / max(up_blocks, 1e-6))
    out = np.empty_like(g)
    y = 0.0
    for i, v in enumerate(g.tolist()):
        a = ad if v < y else au
        y = a * y + (1 - a) * v
        out[i] = y
    return out


def _apply(x, g_blocks, block):
    g = np.interp(np.arange(len(x)), np.arange(len(g_blocks)) * block, g_blocks)
    lin = 10 ** (g / 20)
    return (x * lin[:, None] if x.ndim == 2 else x * lin), g


def compressor(x, sr=SR, threshold_db=-20.0, ratio=2.5, knee_db=6.0, attack_ms=3.0, release_ms=80.0, rms_ms=5.0):
    block = sr // 1000
    L = _block_level_db(x, sr, block, int(rms_ms * sr / 1000))
    o = L - threshold_db
    slope = 1.0 / ratio - 1.0
    gr = np.where(2 * o < -knee_db, 0.0,
                  np.where(2 * np.abs(o) <= knee_db, slope * (o + knee_db / 2) ** 2 / (2 * knee_db), slope * o))
    return _apply(x, _smooth(gr, attack_ms, release_ms), block)


def expander(x, sr=SR, threshold_db=-50.0, ratio=2.0, range_db=8.0, open_ms=1.0, hold_ms=60.0,
             close_ms=120.0, lookahead_ms=5.0, rms_ms=10.0):
    """Below threshold every dB costs (ratio - 1) extra dB, at most range_db.  It opens
    lookahead_ms early and holds hold_ms before closing, so word edges stay intact."""
    block = sr // 1000
    L = _block_level_db(x, sr, block, int(rms_ms * sr / 1000))
    gr = -np.clip((threshold_db - L) * (ratio - 1.0), 0.0, range_db)
    n = len(gr)
    la, hd = int(lookahead_ms), int(hold_ms)
    pad = np.concatenate([np.full(hd, -range_db), gr, np.zeros(la)])
    win = np.lib.stride_tricks.sliding_window_view(pad, hd + la + 1)
    g = win.max(axis=1)[:n]  # open early (look-ahead), close late (hold)
    return _apply(x, _smooth(g, close_ms, open_ms), block)


def _oversampled_peak(x, oversample=4):
    """Per-sample peak of the band-limited 4x reconstruction (max of the sub-samples
    around each sample and its neighbours)."""
    x2 = x[:, None] if x.ndim == 1 else x
    pad = 4096
    y = np.vstack([np.zeros((pad, x2.shape[1])), x2, np.zeros((pad, x2.shape[1]))])
    n = len(y)
    up = np.abs(np.fft.irfft(np.fft.rfft(y, axis=0), n * oversample, axis=0) * oversample).max(axis=1)
    up = up.reshape(n, oversample).max(axis=1)[pad:pad + len(x2)]
    return np.maximum(up, np.maximum(np.roll(up, 1), np.roll(up, -1)))


def tp_limiter(x, sr=SR, ceiling_dbtp=-1.5, lookahead_ms=2.0, release_db_per_s=60.0):
    """Gain never exceeds what the next lookahead_ms of true peaks allow (min-hold over
    the look-ahead window, then a box average of the same length so the gain ramps down
    before the peak), and recovers at release_db_per_s."""
    L = int(lookahead_ms * sr / 1000)
    peak = _oversampled_peak(x)
    need = np.minimum(0.0, ceiling_dbtp - 20 * np.log10(peak + 1e-12))
    hold = np.zeros(len(need) + L)
    for i in np.flatnonzero(need < 0):
        seg = hold[i:i + L + 1]
        np.minimum(seg, need[i], out=seg)
    c = np.concatenate([[0.0], np.cumsum(hold)])
    avg = (c[L + 1:] - c[:-L - 1]) / (L + 1)  # mean of hold[i .. i+L]
    g = avg[: len(x)]
    r = release_db_per_s / sr
    idx = np.arange(len(g))
    g = np.minimum(0.0, r * idx + np.minimum.accumulate(g - r * idx))
    lin = 10 ** (g / 20)
    return (x * lin[:, None] if x.ndim == 2 else x * lin), g
