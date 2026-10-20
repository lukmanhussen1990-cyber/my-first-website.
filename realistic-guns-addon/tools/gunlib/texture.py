"""Procedural PBR-ish texture painter for the gun atlases.

Every face of every cube gets its own texel rectangle, painted with the
part's material (metal, wood, polymer, ...) plus an optional pattern
(rails, vents, grain, checkering, serrations ...), baked shading, edge wear
and scratches.  Output is deterministic (seeded per face).
"""
import numpy as np
from PIL import Image

# base rgb, noise amplitude, kind, highlight band strength
MATERIALS = {
    "blued":       ((62, 66, 77), 5, "metal", 0.24),
    "black":       ((48, 50, 55), 4, "metal", 0.20),
    "parkerized":  ((62, 64, 61), 6, "metal", 0.10),
    "gunmetal":    ((78, 82, 90), 6, "metal", 0.20),
    "steel":       ((140, 144, 150), 7, "metal", 0.25),
    "chrome":      ((188, 191, 196), 6, "metal", 0.35),
    "stainless":   ((162, 164, 168), 9, "metal", 0.22),
    "alu":         ((66, 69, 75), 4, "metal", 0.20),
    "polymer":     ((46, 47, 50), 5, "polymer", 0.05),
    "polymer_dk":  ((35, 36, 39), 4, "polymer", 0.04),
    "polymer_od":  ((86, 94, 62), 6, "polymer", 0.05),
    "polymer_tan": ((166, 142, 104), 7, "polymer", 0.05),
    "polymer_gr":  ((70, 72, 72), 5, "polymer", 0.04),
    "wood":        ((132, 66, 34), 9, "wood", 0.08),
    "wood_dark":   ((92, 48, 26), 8, "wood", 0.06),
    "rubber":      ((33, 33, 35), 4, "polymer", 0.02),
    "brass":       ((200, 162, 72), 8, "metal", 0.30),
    "copper":      ((186, 112, 60), 8, "metal", 0.25),
    "lens":        ((38, 66, 104), 4, "glass", 0.0),
    "red":         ((200, 32, 32), 6, "polymer", 0.05),
    "orange":      ((224, 110, 30), 6, "polymer", 0.05),
    "white":       ((232, 232, 228), 4, "polymer", 0.02),
    "tritium":     ((120, 240, 140), 3, "polymer", 0.0),
    "bore":        ((10, 10, 11), 2, "polymer", 0.0),
    "cloth":       ((66, 68, 56), 7, "polymer", 0.03),
    "glove":       ((34, 35, 33), 5, "polymer", 0.03),
    "sleeve":      ((74, 78, 62), 7, "polymer", 0.03),
}

FACE_IDX = {"north": 0, "south": 1, "east": 2, "west": 3, "up": 4, "down": 5}

WEAR_COLOR = {
    "metal": np.array([170, 174, 180], dtype=float),
    "wood": np.array([170, 110, 70], dtype=float),
    "polymer": np.array([88, 90, 92], dtype=float),
    "glass": np.array([120, 160, 200], dtype=float),
}


def _clip(a):
    return np.clip(a, 0, 255)


def paint_face(rect_w, rect_h, mat, pattern, face, rng, long_axis=None, wear=1.0):
    base, noise_amp, kind, band = MATERIALS[mat]
    base = np.array(base, dtype=float)
    h, w = rect_h, rect_w
    img = np.empty((h, w, 3), dtype=float)
    img[:] = base
    vv, uu = np.meshgrid(np.arange(h), np.arange(w), indexing="ij")
    if long_axis is None:
        long_axis = "u" if w >= h else "v"
    along = uu if long_axis == "u" else vv
    across = vv if long_axis == "u" else uu
    n_along = w if long_axis == "u" else h
    n_across = h if long_axis == "u" else w

    # ---- material texture ---------------------------------------------
    def smooth_noise(cells, amp):
        gy, gx = max(2, cells), max(2, cells)
        grid = rng.normal(0, amp, (gy, gx))
        yi = np.linspace(0, gy - 1, h)
        xi = np.linspace(0, gx - 1, w)
        y0 = np.floor(yi).astype(int).clip(0, gy - 2)
        x0 = np.floor(xi).astype(int).clip(0, gx - 2)
        fy = (yi - y0)[:, None]
        fx = (xi - x0)[None, :]
        g00 = grid[y0][:, x0]
        g01 = grid[y0][:, x0 + 1]
        g10 = grid[y0 + 1][:, x0]
        g11 = grid[y0 + 1][:, x0 + 1]
        return (g00 * (1 - fy) * (1 - fx) + g01 * (1 - fy) * fx + g10 * fy * (1 - fx)
                + g11 * fy * fx)

    if kind == "metal":
        img += smooth_noise(3, noise_amp * 1.1)[..., None]
        img += rng.normal(0, noise_amp * 0.45, (h, w, 1))
        streak = rng.normal(0, noise_amp * 0.55, n_across)
        img += streak[across][..., None]
    elif kind == "wood":
        phase = rng.uniform(0, 6.28)
        wav = np.sin(along * rng.uniform(0.10, 0.22) + phase) * rng.uniform(0.6, 1.4)
        t = across + wav
        stripe = 0.5 + 0.5 * np.sin(t * rng.uniform(1.6, 2.3) + phase)
        img *= (0.84 + 0.24 * stripe)[..., None]
        period = rng.uniform(2.6, 3.6)
        dark = ((t + rng.uniform(0, 3)) % period) < 0.55
        img[dark] *= 0.80
        img += smooth_noise(3, noise_amp * 0.9)[..., None]
        img += rng.normal(0, noise_amp * 0.25, (h, w, 1))
    elif kind == "polymer":
        img += smooth_noise(3, noise_amp * 0.6)[..., None]
        img += rng.normal(0, noise_amp * 0.7, (h, w, 1))
        speck = rng.random((h, w)) < 0.04
        img[speck] += 6
    elif kind == "glass":
        t = (uu + vv) / max(1, (w + h - 2))
        img = img * (1.0 - 0.35 * t[..., None]) + np.array([30, 40, 50]) * (1 - t[..., None]) * 0.4
        if w >= 3 and h >= 3:
            img[max(0, h // 4), max(0, w // 4)] = (210, 230, 250)
            if w >= 5 and h >= 5:
                img[max(0, h // 4) + 1, max(0, w // 4)] = (150, 180, 215)

    # ---- patterns -----------------------------------------------------
    if pattern == "rail" and n_along >= 4:
        period = max(2, int(round(n_along / max(1, round(n_along / 3.0)))))
        tooth = (along % period) < max(1, period // 2)
        img[tooth] += 26
        img[~tooth] -= 18
    elif pattern == "vents" and n_along >= 6 and n_across >= 3:
        period = max(3, n_across + 1)
        slot = ((along % period) >= 1) & ((along % period) < period - 1) & \
               (across >= 1) & (across < n_across - 1)
        img[slot] = img[slot] * 0.25 + 4
    elif pattern == "holes" and n_along >= 4 and n_across >= 3:
        period = max(3, int(round(n_across / 2)) + 1)
        hole = ((along % period) == period // 2) & ((across % 3) == 1)
        img[hole] = (12, 12, 13)
    elif pattern == "serration":
        lines = (along % 2) == 0
        img[lines] *= 0.55
    elif pattern == "serration_rear":
        lines = ((along % 2) == 0) & (along > n_along * 0.6)
        img[lines] *= 0.55
    elif pattern == "checker":
        chk = ((uu + vv) % 3 == 0) | ((uu - vv) % 3 == 0)
        img[chk] *= 0.72
    elif pattern == "stipple":
        sp = rng.random((h, w))
        img[sp < 0.2] *= 0.84
        img[sp > 0.88] *= 1.12
    elif pattern == "ribs" and n_along >= 4:
        period = 3
        rib = (along % period) == 1
        img[rib] *= 0.78
    elif pattern == "grooves" and n_along >= 4:
        groove = (along % 2) == 1
        img[groove] *= 0.62
    elif pattern == "knurl":
        k = ((uu + vv) % 2 == 0)
        img[k] *= 0.8
    elif pattern == "muzzle":
        cy, cx = (h - 1) / 2, (w - 1) / 2
        r = min(h, w) * 0.3
        hole = np.hypot(vv - cy, uu - cx) <= max(0.6, r)
        img[hole] = (8, 8, 9)
    elif pattern == "port":
        if n_along >= 3 and n_across >= 3:
            a0, a1 = int(n_along * 0.15), max(int(n_along * 0.85), int(n_along * 0.15) + 1)
            s0, s1 = 1, n_across - 1
            hole = (along >= a0) & (along < a1) & (across >= s0) & (across < s1)
            img[hole] = img[hole] * 0.25 + 3
    elif pattern == "belt":
        cart = (along % 3) != 2
        img[cart] = np.array([196, 160, 70]) + rng.normal(0, 6, (int(cart.sum()), 1))
        img[~cart] = (70, 72, 76)
    elif pattern == "screen":
        img[(uu % 2 == 0) & (vv % 2 == 0)] *= 0.6
    elif pattern == "dot":
        cy, cx = h // 2, w // 2
        img[cy, cx] = (240, 240, 235)
    elif pattern == "lines":
        img[(across % 2) == 0] *= 0.82
    elif pattern == "scope_lens":
        cy, cx = (h - 1) / 2, (w - 1) / 2
        d = np.hypot(vv - cy, uu - cx) / max(1.0, min(h, w) / 2)
        img = np.where((d < 0.85)[..., None], img * (0.75 + 0.25 * d[..., None]), img * 0.6)
        if w >= 4 and h >= 4:
            img[int(h * 0.3), int(w * 0.3)] = (220, 235, 255)

    # ---- baked shading --------------------------------------------------
    if face in ("north", "south", "east", "west") and h >= 2:
        grad = np.linspace(1.10, 0.86, h)
        if band > 0 and h >= 4:
            pos = rng.uniform(0.18, 0.32)
            bandv = np.exp(-((np.arange(h) / (h - 1) - pos) ** 2) / 0.012) * band
            grad = grad + bandv
        img *= grad[:, None, None]
    elif face == "up":
        img *= 1.07
        if band > 0 and w >= 4 and h >= 4:
            img += band * 30 * np.exp(-((uu / (w - 1) - 0.5) ** 2) / 0.05)[..., None]
    elif face == "down":
        img *= 0.80

    # bevel edges (only where there is room for it)
    if w >= 4 and h >= 4:
        img[0, :] = img[0, :] * 1.12 + 8
        img[-1, :] *= 0.86
        img[:, 0] = img[:, 0] * 1.03 + 2
        img[:, -1] *= 0.94

    # ---- wear & scratches ----------------------------------------------------
    if wear > 0 and kind in ("metal", "wood", "polymer") and min(w, h) >= 3:
        wc = WEAR_COLOR[kind]
        edge = (vv == 0) | (vv == h - 1) | (uu == 0) | (uu == w - 1)
        chance = {"metal": 0.07, "wood": 0.05, "polymer": 0.04}[kind] * wear
        worn = edge & (rng.random((h, w)) < chance)
        mix = 0.42 if kind == "metal" else 0.28
        img[worn] = img[worn] * (1 - mix) + wc * mix
        if kind == "metal" and w * h >= 40:
            n_scr = int(min(3, rng.integers(0, 1 + (w * h) // 140)) * wear)
            for _ in range(n_scr):
                length = int(rng.integers(2, 5))
                y0 = int(rng.integers(0, h))
                x0 = int(rng.integers(0, w))
                dx, dy = [(1, 0), (1, 1), (1, -1)][int(rng.integers(0, 3))]
                for k in range(length):
                    yy, xx = y0 + dy * k, x0 + dx * k
                    if 0 <= yy < h and 0 <= xx < w:
                        img[yy, xx] = img[yy, xx] * 0.68 + wc * 0.32
    return _clip(img)


def paint_atlas(model, W, H, wear=1.0, seed_base=0):
    tex = np.zeros((H, W, 4), dtype=float)
    owner = np.full((H, W), -1, dtype=int)
    idx = 0
    for p in model.parts:
        for face, (x, y, w, h) in p.uv.items():
            mat = p.face_mat.get(face, p.mat)
            pattern = p.face_pattern.get(face, p.pattern)
            if isinstance(pattern, dict):
                pattern = pattern.get(face)
            long_axis = None
            rng = np.random.default_rng(seed_base * 100003 + p.seed * 17 + FACE_IDX[face])
            rgb = paint_face(w, h, mat, pattern, face, rng, long_axis, wear)
            tex[y:y + h, x:x + w, :3] = rgb
            tex[y:y + h, x:x + w, 3] = 255
            owner[y:y + h, x:x + w] = idx
            idx += 1
    # dilate 1px into the padding so mip-mapping never bleeds transparent texels
    for _ in range(2):
        alpha = tex[..., 3] > 0
        grow = np.zeros_like(tex)
        cnt = np.zeros((H, W))
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sh = np.roll(np.roll(tex, dy, axis=0), dx, axis=1)
            sa = np.roll(np.roll(alpha, dy, axis=0), dx, axis=1)
            grow[sa] += sh[sa]
            cnt[sa] += 1
        fill = (~alpha) & (cnt > 0)
        tex[fill] = grow[fill] / cnt[fill][:, None]
        tex[fill, 3] = 255
    return tex.astype(np.uint8)


def save_png(arr, path):
    import os
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(arr, "RGBA").save(path, optimize=True)
