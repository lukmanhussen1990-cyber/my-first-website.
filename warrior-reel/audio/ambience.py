"""Ambience bed: river (30 s seamless loop) + meadow birds/breeze (20 s loop),
equal-power crossfade-looped to the full film length.  If the ElevenLabs
files are missing, a babbling brook and sparse chirps are synthesised instead.

Returns the two layers separately (un-ducked, at their nominal bed levels);
mix.py applies the dialogue ducking and the per-section automation.
"""
import os

import numpy as np

from common import SR, load, path, n_total, hpf, lpf, eq, bpf, timeline

RIVER = "audio/sfx/river_loop.mp3"
BIRDS = "audio/sfx/birds.mp3"


def xfade_loop(x, n, xfade=1.5, offset=0.0):
    """Tile a stereo loop to n samples; every seam is an equal-power crossfade.
    `offset` (s) starts playback part-way into the first copy."""
    L = len(x)
    xf = int(xfade * SR)
    off = int(offset * SR)
    total = n + off
    up = np.sin(np.linspace(0, np.pi / 2, xf))[:, None]
    down = np.cos(np.linspace(0, np.pi / 2, xf))[:, None]
    out = np.zeros((total + L, 2))
    pos, k = 0, 0
    while pos < total:
        s = x.copy()
        if k > 0:
            s[:xf] *= up
        s[L - xf:] *= down
        out[pos:pos + L] += s
        pos += L - xf
        k += 1
    return out[off:off + n]


def synth_brook(n, seed=11):
    """Fallback: filtered-noise water bed + many rising sine 'bubble' grains."""
    rng = np.random.default_rng(seed)
    bed = np.stack([rng.standard_normal(n) for _ in range(2)], axis=1)
    bed = bpf(bed, 250.0, 3500.0, 2) * 0.02
    t = np.arange(int(0.06 * SR)) / SR
    for _ in range(int(n / SR * 45)):
        f0 = rng.uniform(500, 2200)
        g = np.sin(2 * np.pi * (f0 * t + 0.5 * f0 * 6.0 * t ** 2)) * np.exp(-t / rng.uniform(0.008, 0.025))
        i = rng.integers(0, n - len(t))
        p = rng.uniform(-0.8, 0.8)
        bed[i:i + len(t), 0] += g * 0.01 * rng.uniform(0.2, 1) * (1 - p) / 2
        bed[i:i + len(t), 1] += g * 0.01 * rng.uniform(0.2, 1) * (1 + p) / 2
    return bed


def synth_birds(n, seed=23):
    rng = np.random.default_rng(seed)
    out = np.zeros((n, 2))
    tt = 0.8
    while tt < n / SR - 1.0:
        f0 = rng.uniform(2600, 5200)
        k = rng.integers(2, 6)
        for j in range(k):
            d = rng.uniform(0.05, 0.12)
            t = np.arange(int(d * SR)) / SR
            fm = f0 * (1 + 0.25 * np.sin(2 * np.pi * rng.uniform(15, 40) * t)) * (1 + rng.uniform(-0.2, 0.3) * t / d)
            ph = 2 * np.pi * np.cumsum(fm) / SR
            g = np.sin(ph) * np.sin(np.pi * t / d) ** 2 * 0.004
            i = int((tt + j * (d + 0.04)) * SR)
            p = rng.uniform(-0.7, 0.7)
            out[i:i + len(g), 0] += g * (1 - p) / 2
            out[i:i + len(g), 1] += g * (1 + p) / 2
        tt += rng.uniform(1.5, 4.0)
    return out


def build(tl=None):
    tl = tl or timeline()
    N = n_total(tl)
    if os.path.exists(path(RIVER)):
        river = xfade_loop(load(path(RIVER), 2), N, xfade=1.5, offset=4.0)
    else:
        river = synth_brook(N)
    if os.path.exists(path(BIRDS)):
        birds = xfade_loop(load(path(BIRDS), 2), N, xfade=1.0, offset=2.5)
    else:
        birds = synth_birds(N)
    # river: keep the low end clean and carve a wide pocket for the voices (1-3 kHz);
    # a little extra top keeps it sounding wet and sparkling rather than dull
    river = eq(hpf(river, 70.0, 2), ("peak", 1400.0, -4.5, 0.55), ("highshelf", 6000.0, 2.0, 0.7))
    # birds: remove the breeze rumble, keep the chirps airy
    birds = lpf(hpf(birds, 300.0, 3), 15000.0, 2)
    return {"river": river, "birds": birds}
