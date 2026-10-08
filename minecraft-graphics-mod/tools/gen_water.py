"""Animated water: tileable, loopable caustic shimmer.  The *_grey textures are tinted
by the biome water colour in-game, so they stay neutral grey."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from common import periodic_noise, smoothstep, save_image, Grade, read_rgba


def _shift(a, sy, sx):
    """Sub-pixel circular shift (Fourier), so scrolling layers loop exactly."""
    n = a.shape[0]
    ky = np.fft.fftfreq(n)[:, None]
    kx = np.fft.fftfreq(n)[None, :]
    return np.fft.ifft2(np.fft.fft2(a) * np.exp(-2j * np.pi * (ky * sy + kx * sx))).real


def still_frames(n=16, frames=32, seed=21, n_sites=5):
    """Calm surface: soft integer-wavenumber ripples (seamless, exact time loop), faint
    horizontal streaks like vanilla, plus a few twinkling sun glints per tile."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    waves = [(1, 0, 1, 1.0, 0.2), (1, 1, -1, 0.8, 1.9), (2, 1, 2, 0.5, 0.7), (0, 2, 1, 0.45, 2.6)]
    st = periodic_noise(n, n, beta=0.8, seed=seed + 3)
    ky = np.fft.fftfreq(n)[:, None] * n
    st = np.fft.ifft2(np.fft.fft2(st - st.mean()) / (1 + ky ** 2 * 0.9)).real      # blur vertically => streaks
    st = (st - st.min()) / (st.max() - st.min())
    sites = [(int(rng.integers(0, n)), int(rng.integers(0, n)), int(rng.integers(0, frames)),
              float(rng.uniform(0.15, 0.24))) for _ in range(n_sites)]
    out = np.zeros((frames * n, n, 4), dtype=np.uint8)
    for t in range(frames):
        h = np.zeros((n, n))
        for kx_, ky_, f, a, ph in waves:
            h += a * np.sin(2 * np.pi * (kx_ * x + ky_ * y) + 2 * np.pi * f * t / frames + ph)
        h /= 2.4
        v = 0.655 + 0.040 * h + 0.045 * (_shift(st, 0, n * t / frames) - 0.5)
        for sx, sy, ph, amp in sites:
            dt = min((t - ph) % frames, (ph - t) % frames)
            w = np.exp(-(dt / 1.4) ** 2)
            if w < 0.02:
                continue
            v[sy, sx] += amp * w
            for dx_, dy_ in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                v[(sy + dy_) % n, (sx + dx_) % n] += amp * w * 0.28
        g = np.round(np.clip(v, 0, 1) * 255).astype(np.uint8)
        out[t * n:(t + 1) * n] = np.stack([g, g, g, np.full_like(g, 240)], axis=-1)
    return out


def flow_frames(w=32, h=32, frames=32, seed=9):
    """Downward-streaming ripples.  A periodic noise field is scrolled one row per
    frame, so 32 frames loop perfectly."""
    rng = np.random.default_rng(seed)
    fy = np.fft.fftfreq(h)[:, None] * h
    fx = np.fft.fftfreq(w)[None, :] * w
    k = np.hypot(fx, fy * 0.35)
    k[0, 0] = 1
    amp = 1.0 / (1.0 + k ** 1.7)                           # streaks: smooth along y, detailed along x
    amp = amp * (1.0 + 0.9 * (np.abs(fx) > 3))
    amp[0, 0] = 0
    spec = amp * (rng.normal(size=(h, w)) + 1j * rng.normal(size=(h, w)))
    base = np.fft.ifft2(spec).real
    base = (base - base.min()) / (base.max() - base.min())
    base2 = periodic_noise(h, w, beta=2.4, seed=seed + 7)
    out = np.zeros((frames * h, w, 4), dtype=np.uint8)
    for t in range(frames):
        f1 = np.roll(base, t, axis=0)
        f2 = np.roll(base2, 2 * t, axis=0)
        v = 0.64 + 0.20 * (f1 - 0.5) + 0.10 * (f2 - 0.5)
        v += 0.22 * smoothstep(0.80, 0.96, f1)              # bright streaks
        g = np.round(np.clip(v, 0, 1) * 255).astype(np.uint8)
        out[t * h:(t + 1) * h] = np.stack([g, g, g, np.full_like(g, 255)], axis=-1)
    return out


def generate(vanilla: Path, out_dir: Path):
    blocks = out_dir / "textures" / "blocks"
    still = still_frames()
    flow = flow_frames()
    save_image(still, blocks / "water_still_grey.png")
    save_image(flow, blocks / "water_flow_grey.png")
    # the coloured twins (legacy atlas entries) keep their vanilla hue but get the same pattern
    tint = np.array([0.45, 0.58, 1.0])
    sc = still.copy().astype(np.float64)
    sc[..., :3] = np.clip(sc[..., :3] * tint * 1.25, 0, 255)
    sc[..., 3] = 255
    save_image(sc.astype(np.uint8), blocks / "water_still.png")
    fc = flow.copy().astype(np.float64)
    fc[..., :3] = np.clip(fc[..., :3] * np.array([0.38, 0.55, 1.0]) * 1.25, 0, 255)
    save_image(fc.astype(np.uint8), blocks / "water_flow.png")
