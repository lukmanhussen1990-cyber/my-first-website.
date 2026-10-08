"""Sky bodies + weather: glowing sun, smooth moon phases, soft clouds, brighter rain."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from common import periodic_noise, smoothstep, read_rgba, save_image

N = 32
_C = (N - 1) / 2.0


def _grid():
    y, x = np.mgrid[0:N, 0:N].astype(np.float64)
    return x - _C, y - _C


def make_sun(strength=1.0):
    """The sun sprite is drawn additively (vanilla alpha is 255 everywhere and the
    background is black), so brightness = RGB.  Round disc + bloom that is forced
    to exactly black before the sprite edge so no square can ever show."""
    dx, dy = _grid()
    r = np.hypot(dx, dy)
    disc = 1.0 - smoothstep(3.7, 5.0, r)
    inner = np.exp(-(r / 5.2) ** 1.25) * 0.70
    outer = np.exp(-(r / 10.5) ** 1.5) * 0.30
    glow = (inner + outer) * strength * (1.0 - smoothstep(11.5, 15.6, r))
    core_col = np.array([1.00, 0.985, 0.90])
    glow_col = np.array([1.00, 0.80, 0.42])
    rgb = disc[..., None] * core_col + (np.clip(glow, 0, 1) * (1 - disc))[..., None] * glow_col
    rgb = np.clip(rgb, 0, 1)
    out = np.zeros((N, N, 4), dtype=np.uint8)
    out[..., :3] = np.round(rgb * 255).astype(np.uint8)
    out[..., 3] = 255
    return out


def _moon_tile(phase_idx, seed=11):
    """phase 0 full, 1 waning gibbous, 2 last quarter, 3 waning crescent, 4 new,
    5 waxing crescent, 6 first quarter, 7 waxing gibbous (vanilla order)."""
    dx, dy = _grid()
    R = 8.0
    r = np.hypot(dx, dy)
    nx, ny = dx / R, dy / R
    inside = r <= R
    nz = np.sqrt(np.clip(1.0 - nx ** 2 - ny ** 2, 0, 1))
    # surface albedo: soft maria + a few craters
    yy, xx = np.mgrid[0:N, 0:N]
    maria = periodic_noise(N, N, beta=2.8, seed=seed)
    fine = periodic_noise(N, N, beta=1.6, seed=seed + 1)
    albedo = 0.86 + 0.22 * (maria - 0.5) + 0.07 * (fine - 0.5)
    for cx, cy, cr in [(-2.5, -2, 1.5), (3, 1.5, 1.2), (-1, 4, 1.0), (2, -4, 0.9)]:
        d = np.hypot(dx - cx, dy - cy)
        albedo -= 0.12 * np.exp(-(d / cr) ** 2) - 0.05 * np.exp(-((d - cr) / 0.6) ** 2)
    limb = 0.70 + 0.30 * np.sqrt(nz)

    phi = {0: 0.0, 1: np.pi / 4, 2: np.pi / 2, 3: 3 * np.pi / 4, 4: np.pi,
           5: 3 * np.pi / 4, 6: np.pi / 2, 7: np.pi / 4}[phase_idx]
    side = -1.0 if phase_idx in (1, 2, 3) else 1.0          # waning = lit on the left
    lx, lz = side * np.sin(phi), np.cos(phi)
    ndl = nx * lx + nz * lz
    lit = smoothstep(-0.04, 0.10, ndl)
    earth = 0.07
    light = (earth + (1.0 - earth) * lit) * (1.0 if phase_idx != 4 else 0.0) + (earth if phase_idx == 4 else 0.0)
    body = np.where(inside, albedo * limb * light, 0.0)
    body = np.clip(body, 0, 1)

    illum = {0: 1.0, 1: 0.8, 2: 0.5, 3: 0.2, 4: 0.0, 5: 0.2, 6: 0.5, 7: 0.8}[phase_idx]
    halo = np.exp(-(r / 6.3) ** 1.3) * (0.16 + 0.34 * illum) * (1.0 - smoothstep(11.0, 15.5, r))
    halo = np.where(inside, 0.0, halo)

    moon_col = np.array([0.88, 0.93, 1.00])
    halo_col = np.array([0.40, 0.52, 0.85])
    rgb = body[..., None] * moon_col + halo[..., None] * halo_col
    return np.clip(np.round(rgb * 255), 0, 255).astype(np.uint8)


def make_moon_phases():
    sheet = np.zeros((2 * N, 4 * N, 3), dtype=np.uint8)
    for i in range(8):
        r, c = divmod(i, 4)
        sheet[r * N:(r + 1) * N, c * N:(c + 1) * N] = _moon_tile(i)
    return sheet


def make_clouds(coverage=0.30, kb=48, wb=0.35, seed=7):
    """256x256 mask, vanilla format: RGB white, alpha 1 (empty) / 255 (cloud).
    Cumulus-like clusters with real gaps instead of vanilla's fine speckle."""
    n = 256
    big = periodic_noise(n, n, beta=3.0, seed=seed, kmax=kb)
    mid = periodic_noise(n, n, beta=2.2, seed=seed + 1, kmax=int(kb * 1.9))
    fine = periodic_noise(n, n, beta=1.6, seed=seed + 2, kmax=110)
    f = wb * big + (0.85 - wb) * mid + 0.15 * fine
    m = f > np.quantile(f, 1.0 - coverage)
    for _ in range(2):                       # drop lone cells, fill pin-holes
        nb = sum(np.roll(np.roll(m, dy, 0), dx, 1).astype(int) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - m.astype(int)
        m = np.where(m & (nb <= 1), False, m)
        m = np.where(~m & (nb >= 7), True, m)
    out = np.zeros((n, n, 4), dtype=np.uint8)
    out[..., :3] = 255
    out[..., 3] = np.where(m, 255, 1)
    return out


def make_weather(vanilla: Path):
    """Keep the exact sprite layout (the engine addresses it by UV); only make the
    rain streaks lighter / a touch more opaque so rain reads clearly on a phone."""
    a = read_rgba(vanilla / "textures" / "environment" / "weather.png").astype(np.float64)
    rain = np.zeros(a.shape[:2], bool)
    rain[5:20, :] = a[5:20, :, 3] > 0
    sky = np.array([160.0, 200.0, 255.0])
    a[rain, :3] = a[rain, :3] * 0.45 + sky * 0.55
    a[rain, 3] = np.minimum(255.0, a[rain, 3] * 1.22 + 6)
    return np.clip(np.round(a), 0, 255).astype(np.uint8)


CLOUD = {"lite": dict(coverage=0.24, kb=56, wb=0.30, seed=11),
         "standard": dict(coverage=0.30, kb=48, wb=0.35, seed=7),
         "ultra": dict(coverage=0.33, kb=44, wb=0.38, seed=7)}


def generate(vanilla: Path, out_dir: Path, preset: str, include_bodies=True):
    env = out_dir / "textures" / "environment"
    save_image(make_clouds(**CLOUD[preset]), env / "clouds.png")
    if include_bodies:
        save_image(make_sun(1.0 if preset != "lite" else 0.8), env / "sun.png")
        Image.fromarray(make_moon_phases(), "RGB").save(env / "moon_phases.png", optimize=True)
        save_image(make_weather(vanilla), env / "weather.png")
