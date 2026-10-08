"""HUD vignette overlay (Ultra preset) and the pack icon."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from common import smoothstep, periodic_noise, write_json, save_image


def make_vignette(strength=0.42, w=256, h=144, seed=4):
    """Soft film vignette.  Stretched over the whole screen, drawn *behind* the HUD."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float64)
    u = (x + 0.5) / w * 2 - 1
    v = (y + 0.5) / h * 2 - 1
    r = np.sqrt(u * u * 0.80 + v * v * 1.0)
    a = strength * smoothstep(0.52, 1.28, r) ** 1.6
    rng = np.random.default_rng(seed)
    a = a + rng.uniform(-0.5, 0.5, a.shape) / 255.0          # dither => no banding
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = 3, 7, 16          # cool near-black
    out[..., 3] = np.clip(np.round(a * 255), 0, 255).astype(np.uint8)
    return out


def hud_modification():
    """Defines one image control and inserts a reference to it at the *front* of the HUD's
    root_panel (same pattern as the Bedrock Wiki's "Add HUD elements" tutorial).  Uses the
    UI `modifications` mechanism, so Mojang's own hud_screen.json is not copied or replaced.
    root_panel is full-screen and children without a parent-relative size inherit it, so
    100% x 100% stretches the vignette over the whole view, behind every HUD element."""
    return {
        "namespace": "hud",
        "hg_vignette": {
            "type": "image",
            "texture": "textures/ui/hg_vignette",
            "size": ["100%", "100%"],
            "layer": 0,
            "alpha": 1.0,
            "keep_ratio": False,
        },
        "root_panel": {
            "modifications": [
                {
                    "array_name": "controls",
                    "operation": "insert_front",
                    "value": [{"hg_vignette@hud.hg_vignette": {}}],
                }
            ]
        },
    }


def write_overlay(out_dir: Path, strength=0.42):
    save_image(make_vignette(strength), out_dir / "textures" / "ui" / "hg_vignette.png")
    write_json(out_dir / "ui" / "hud_screen.json", hud_modification())


# ---------------------------------------------------------------- pack icon
def make_icon(size=256, seed=2):
    rng = np.random.default_rng(seed)
    S = size
    y, x = np.mgrid[0:S, 0:S].astype(np.float64)
    yn, xn = y / S, x / S
    hor = 0.60
    # sky gradient
    top = np.array([0.13, 0.33, 0.78])
    mid = np.array([0.50, 0.74, 0.97])
    low = np.array([1.00, 0.84, 0.62])
    t = np.clip(yn / hor, 0, 1)[..., None]
    sky = np.where(t < 0.62, top + (mid - top) * (t / 0.62), mid + (low - mid) * ((t - 0.62) / 0.38))
    # sun + glow
    sx, sy = 0.70, 0.52
    d = np.hypot((xn - sx) * 1.0, (yn - sy) * 1.0)
    glow = np.exp(-(d / 0.16) ** 1.3) * 0.85 + np.exp(-(d / 0.45) ** 1.6) * 0.30
    disc = 1 - smoothstep(0.045, 0.060, d)
    img = sky + glow[..., None] * np.array([1.0, 0.78, 0.45]) * 0.8
    img = img * (1 - disc[..., None]) + disc[..., None] * np.array([1.0, 0.98, 0.9])
    # clouds (soft)
    cn = periodic_noise(S, S, beta=3.0, seed=seed, kmax=14)
    cm = smoothstep(0.62, 0.80, cn) * smoothstep(0.50, 0.12, yn) * 0.55
    img = img * (1 - cm[..., None]) + cm[..., None] * np.array([1.0, 0.96, 0.95])

    # mountain ridges
    def ridge(seed_, base, amp, rough):
        n = periodic_noise(1, S, beta=rough, seed=seed_)[0]
        n = (n - n.mean()) / (n.std() + 1e-9)
        return base + amp * n

    layers = [(ridge(5, 0.50, 0.035, 2.8), np.array([0.60, 0.66, 0.88])),
              (ridge(6, 0.56, 0.040, 2.6), np.array([0.40, 0.52, 0.72])),
              (ridge(7, 0.62, 0.035, 2.4), np.array([0.20, 0.38, 0.40]))]
    for r, col in layers:
        mask = yn >= np.tile(r, (S, 1))
        shade = col * (0.85 + 0.30 * (1 - yn))[..., None]
        img = np.where(mask[..., None], shade, img)
    # water
    wy = 0.70
    wm = yn >= wy
    k = np.clip((yn - wy) / (1 - wy), 0, 1)[..., None]
    water = np.array([0.24, 0.72, 0.96]) * (1 - k) + np.array([0.07, 0.34, 0.66]) * k
    rip = 0.5 + 0.5 * np.sin(yn * 180 + np.sin(xn * 14) * 1.5)
    refl = np.exp(-((xn - sx) / (0.025 + 0.12 * (yn - wy))) ** 2) * (0.35 + 0.65 * rip) * (1 - k[..., 0] * 0.4)
    water = water + refl[..., None] * np.array([1.0, 0.82, 0.55]) * 0.55
    img = np.where(wm[..., None], water, img)
    # edge vignette + frame
    vv = 1 - 0.28 * smoothstep(0.55, 1.05, np.hypot(xn - 0.5, yn - 0.5) * 1.5)
    img = img * vv[..., None]
    out = np.clip(np.round(img * 255), 0, 255).astype(np.uint8)
    rgba = np.dstack([out, np.full((S, S), 255, np.uint8)])
    return rgba


def write_icon(out_dir: Path):
    save_image(make_icon(), out_dir / "pack_icon.png")
