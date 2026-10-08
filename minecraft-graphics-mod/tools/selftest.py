#!/usr/bin/env python3
"""Self-test of the colour code the whole pack depends on:  python3 -I tools/selftest.py"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (Grade, rgb_to_oklab, oklab_to_rgb, map_toward, limit_delta, periodic_noise, hex_to_rgb, rgb_to_hex)

rng = np.random.default_rng(1)
fails = 0


def check(name, cond, extra=""):
    global fails
    print(("ok   " if cond else "FAIL ") + name + (f"  {extra}" if extra else ""))
    fails += (not cond)


# 1. sRGB <-> OKLab round trip over the whole 8-bit cube (sampled)
rgb = rng.integers(0, 256, size=(200000, 3)) / 255.0
back = oklab_to_rgb(rgb_to_oklab(rgb))
check("OKLab round trip < 1e-5 (8-bit step is 4e-3)", np.abs(back - rgb).max() < 1e-5, f"max err {np.abs(back - rgb).max():.2e}")

# 2. identity grade leaves 8-bit colours unchanged
ident = Grade()
q = lambda x: np.round(x * 255).astype(int)
check("identity Grade is exact", (q(ident.apply_rgb(rgb)) == q(rgb)).all())

# 3. walk-back mapping: never leaves the gamut, never desaturates a colour that asked for MORE chroma
lab = rgb_to_oklab(rgb)
target = lab.copy()
target[:, 0] += 0.08
target[:, 1:] *= 1.3
out = map_toward(lab, target)
check("map_toward stays in gamut", out.min() >= -1e-9 and out.max() <= 1 + 1e-9)
c_in = np.hypot(lab[:, 1], lab[:, 2])
c_out = np.hypot(*rgb_to_oklab(out)[:, 1:].T)
check("map_toward never loses chroma when chroma was raised", (c_out >= c_in - 2e-3).all(), f"worst {np.min(c_out - c_in):.4f}")

# 4. pure primaries / marker colours are untouched by the texture grade
g = Grade(chroma=1.14, contrast=0.09, lift=0.015, warm=1.4)
prim = np.array([[0, 255, 0], [255, 0, 0], [0, 0, 255], [255, 255, 255], [0, 0, 0], [255, 255, 0]]) / 255.0
res = q(g.apply_rgb(prim))
check("pure primaries unchanged", (res == q(prim)).all(), str(res.tolist()))

# 4b. the edit cap holds
big = lab + rng.normal(0, 0.2, lab.shape)
lim = limit_delta(lab, big, 0.085)
check("limit_delta caps the step", (np.sqrt(((lim - lab) ** 2).sum(axis=1)) <= 0.085 + 1e-9).all())

# 5. neutral greys stay neutral under chroma-only grading (dye / tint masks!)
greys = np.linspace(0, 1, 256)[:, None].repeat(3, 1)
gr = Grade(chroma=1.4).apply_rgb(greys)
check("greys stay grey under vibrance", np.abs(gr - gr[:, :1]).max() < 1e-6)

# 6. noise is periodic (tileable): wrap-around difference is as small as any neighbouring difference
n = periodic_noise(64, 64, beta=2.0, seed=3)
inner = np.abs(np.diff(n, axis=1)).mean()
wrap = np.abs(n[:, 0] - n[:, -1]).mean()
check("periodic_noise wraps seamlessly", wrap < inner * 3 + 1e-3, f"wrap {wrap:.4f} vs inner {inner:.4f}")

# 7. hex helpers
check("hex round trip", rgb_to_hex(hex_to_rgb("#3DB8F5")) == "#3DB8F5")

print(f"\n{fails} failure(s)")
sys.exit(1 if fails else 0)
