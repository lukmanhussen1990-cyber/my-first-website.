"""Shared helpers for the Warrior Reel audio build (deterministic, numpy/scipy only).

Every module in audio/ works at 48 kHz float64 internally.  Mono signals are 1-D
arrays, stereo signals are (n, 2) arrays.
"""
import json
import os
import subprocess

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out", "audio")
STEMS = os.path.join(OUT, "stems")
BUILD = os.path.join(OUT, "build")
SF2 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"


def ensure_dirs():
    for d in (OUT, STEMS, BUILD):
        os.makedirs(d, exist_ok=True)


def timeline():
    with open(os.path.join(ROOT, "timeline", "timeline.json")) as f:
        return json.load(f)


def n_total(tl):
    """Exact sample count of the film (timeline.duration at 48 kHz)."""
    return int(round(tl["duration"] * SR))


def path(rel):
    return os.path.join(ROOT, rel)


# ----------------------------------------------------------------------------- I/O
def load(p, channels=1):
    """Decode any audio file with ffmpeg (soxr resampler) to float64 at 48 kHz."""
    cmd = ["ffmpeg", "-v", "error", "-i", p, "-af",
           f"aresample={SR}:resampler=soxr:precision=28",
           "-f", "f32le", "-ac", str(channels), "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    if channels == 1:
        return x
    return x.reshape(-1, channels)


def write(p, x, subtype="PCM_24"):
    """Write float audio (mono or stereo) as 48 kHz WAV.  Stereo is forced."""
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = np.clip(x, -1.0, 1.0 - 2.0 ** -23)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    sf.write(p, x, SR, subtype=subtype)


def stereo(x):
    return np.stack([x, x], axis=1) if x.ndim == 1 else x


def pan(x, p):
    """Constant-power pan of a mono signal, p in [-1 (L), +1 (R)]."""
    a = (p + 1.0) * np.pi / 4.0
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1) * np.sqrt(2.0)


def balance(x, p):
    """Balance an already-stereo signal, p in [-1, 1]."""
    gl = min(1.0, 1.0 - p)
    gr = min(1.0, 1.0 + p)
    return x * np.array([gl, gr])


def place(dst, src, t, gain=1.0):
    """Add src into dst starting at time t (seconds); clips at both ends."""
    i0 = int(round(t * SR))
    s0 = 0
    if i0 < 0:
        s0, i0 = -i0, 0
    n = min(len(src) - s0, len(dst) - i0)
    if n > 0:
        dst[i0:i0 + n] += src[s0:s0 + n] * gain


def db(x):
    return 20.0 * np.log10(np.maximum(np.abs(x), 1e-12))


def undb(d):
    return 10.0 ** (np.asarray(d) / 20.0)


def fade(x, fin=0.0, fout=0.0):
    """Raised-cosine fade in/out (seconds)."""
    x = x.copy()
    n = len(x)
    ni, no = int(fin * SR), int(fout * SR)
    if ni > 0:
        w = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, ni))
        x[:ni] = (x[:ni].T * w).T
    if no > 0:
        w = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, no))
        x[n - no:] = (x[n - no:].T * w).T
    return x


# ----------------------------------------------------------------------------- filters
def _sos_apply(sos, x):
    return signal.sosfilt(sos, x, axis=0)


def hpf(x, fc, order=2):
    return _sos_apply(signal.butter(order, fc, "highpass", fs=SR, output="sos"), x)


def lpf(x, fc, order=2):
    return _sos_apply(signal.butter(order, fc, "lowpass", fs=SR, output="sos"), x)


def bpf(x, f1, f2, order=2):
    return _sos_apply(signal.butter(order, [f1, f2], "bandpass", fs=SR, output="sos"), x)


def _biquad(kind, f0, gain_db, q):
    """RBJ cookbook biquad -> sos row."""
    A = 10 ** (gain_db / 40.0)
    w0 = 2 * np.pi * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2 * q)
    if kind == "peak":
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif kind == "lowshelf":
        sa = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) - (A - 1) * cw + sa), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sa)]
        a = [(A + 1) + (A - 1) * cw + sa, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sa]
    elif kind == "highshelf":
        sa = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) + (A - 1) * cw + sa), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sa)]
        a = [(A + 1) - (A - 1) * cw + sa, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sa]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return np.concatenate([b, a])[None, :]


def eq(x, *bands):
    """bands: (kind, f0, gain_db, q) tuples; kind in peak/lowshelf/highshelf."""
    sos = np.concatenate([_biquad(*b) for b in bands], axis=0)
    return _sos_apply(sos, x)


# ----------------------------------------------------------------------------- envelopes
HOP = 48  # 1 ms control rate


def frame_rms(x, win=0.010, hop=HOP):
    """RMS envelope sampled every `hop` samples (centred windows). x mono."""
    p = uniform_filter1d(x * x, size=max(1, int(win * SR)), mode="constant")
    return np.sqrt(np.maximum(p[::hop], 0.0))


def ar_smooth(v, attack, release, dt=HOP / SR, up_is_attack=True):
    """One-pole attack/release follower on a control-rate array (python loop, ~1 kHz)."""
    aa = np.exp(-dt / max(attack, 1e-6))
    ar = np.exp(-dt / max(release, 1e-6))
    out = np.empty_like(v)
    y = v[0]
    for i, s in enumerate(v):
        rising = s > y
        c = aa if (rising == up_is_attack) else ar
        y = c * y + (1.0 - c) * s
        out[i] = y
    return out


def control_to_audio(g, n, hop=HOP):
    """Linear-interpolate a control-rate curve (one value per hop) to n samples."""
    tc = np.arange(len(g)) * hop
    return np.interp(np.arange(n), tc, g)


def curve(n, points, interp="cos"):
    """Gain curve (linear amplitude) of n samples from [(t, dB), ...] breakpoints."""
    pts = sorted(points)
    t = np.arange(n) / SR
    ts = np.array([p[0] for p in pts])
    vs = np.array([p[1] for p in pts], dtype=float)
    if interp == "lin":
        d = np.interp(t, ts, vs)
    else:
        idx = np.clip(np.searchsorted(ts, t, side="right") - 1, 0, len(ts) - 1)
        nxt = np.clip(idx + 1, 0, len(ts) - 1)
        span = np.maximum(ts[nxt] - ts[idx], 1e-9)
        u = np.clip((t - ts[idx]) / span, 0.0, 1.0)
        u = 0.5 - 0.5 * np.cos(np.pi * u)
        d = vs[idx] + (vs[nxt] - vs[idx]) * u
    return undb(d)


# ----------------------------------------------------------------------------- loudness / peaks
_METER = None


def lufs(x):
    import pyloudnorm as pyln
    global _METER
    if _METER is None:
        _METER = pyln.Meter(SR)
    x = stereo(np.asarray(x, dtype=np.float64))
    if np.max(np.abs(x)) < 1e-9:
        return float("-inf")
    return float(_METER.integrated_loudness(x))


def short_term_lufs(x, win=3.0, hop=0.1):
    """Short-term loudness (BS.1770 K-weighting, 3 s window, ungated) as a series."""
    x = stereo(np.asarray(x, dtype=np.float64))
    # K-weighting: pre-filter shelf + RLB high-pass (pyloudnorm coefficients)
    import pyloudnorm as pyln
    m = pyln.Meter(SR)
    y = x.copy()
    for _, filt in m._filters.items():
        y = filt.apply_filter(y.T).T if hasattr(filt, "apply_filter") else y
    p = (y ** 2).sum(axis=1)
    w = int(win * SR)
    h = int(hop * SR)
    c = np.concatenate([[0.0], np.cumsum(p)])
    starts = np.arange(0, max(1, len(p) - w + 1), h)
    ms = (c[starts + w] - c[starts]) / w
    return starts / SR + win / 2, -0.691 + 10 * np.log10(np.maximum(ms, 1e-20))


def true_peak_db(x, os_factor=4):
    x = stereo(np.asarray(x, dtype=np.float64))
    up = signal.resample_poly(x, os_factor, 1, axis=0)
    return float(db(np.max(np.abs(up))))


def sample_peak_db(x):
    return float(db(np.max(np.abs(x))))


def tp_limiter(x, ceiling_db=-1.2, lookahead=0.004, release=0.120, os_factor=4):
    """Look-ahead true-peak limiter (stereo-linked).

    Gain is derived from the 4x-oversampled peak, held/averaged over the look-ahead
    window so it reaches its target before the peak, and released smoothly.
    """
    x = stereo(np.asarray(x, dtype=np.float64))
    n = len(x)
    ceil = undb(ceiling_db)
    up = np.abs(signal.resample_poly(x, os_factor, 1, axis=0)).max(axis=1)
    pk = up[: n * os_factor].reshape(n, os_factor).max(axis=1)
    pk = np.maximum(pk, np.abs(x).max(axis=1))
    greq = np.minimum(1.0, ceil / np.maximum(pk, 1e-12))
    L = max(1, int(lookahead * SR))
    g = minimum_filter1d(greq, size=2 * L + 1, mode="nearest")
    g = uniform_filter1d(g, size=L + 1, mode="nearest")
    # release smoothing at 0.25 ms control rate, never above the instantaneous need
    hop = 12
    nb = int(np.ceil(n / hop))
    gb = np.ones(nb * hop)
    gb[:n] = g
    gb = gb.reshape(nb, hop).min(axis=1)
    rel = np.exp(-(hop / SR) / release)
    out = np.empty(nb)
    y = 1.0
    for i in range(nb):
        s = gb[i]
        y = s if s < y else rel * y + (1 - rel) * s
        out[i] = y
    gr = np.interp(np.arange(n), np.arange(nb) * hop + hop / 2, out)
    gfin = np.minimum(gr, g)
    return x * gfin[:, None], gfin
