"""Procedural 256x256 pack icons: the parasite's head at night.

The creature's head is a textured cube rendered with a tiny orthographic
rasteriser (nearest-texel sampling, so it keeps the blocky Minecraft look).
The background (night sky, stars, square moon, blocky tree line, spider legs,
faint biohazard emblem) is drawn on a 64x64 grid and scaled 4x.
Everything here is generated from code; no external image is read.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

SIZE = 256
GRID = 64  # background pixel grid (each cell is 4x4 output pixels)
CELL = SIZE // GRID


def rgb(s: str) -> np.ndarray:
    s = s.lstrip("#")
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def value_noise(shape: tuple[int, int], cells: int, rng: np.random.Generator) -> np.ndarray:
    """Smooth value noise in [0,1] (bilinear interpolation of a random lattice)."""
    h, w = shape
    lat = rng.random((cells + 1, cells + 1))
    ys = np.linspace(0, cells, h, endpoint=False) + cells / h / 2
    xs = np.linspace(0, cells, w, endpoint=False) + cells / w / 2
    y0 = np.floor(ys).astype(int)
    x0 = np.floor(xs).astype(int)
    fy = (ys - y0)[:, None]
    fx = (xs - x0)[None, :]
    fy = fy * fy * (3 - 2 * fy)
    fx = fx * fx * (3 - 2 * fx)
    a = lat[y0][:, x0]
    b = lat[y0][:, x0 + 1]
    c = lat[y0 + 1][:, x0]
    d = lat[y0 + 1][:, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


# ---------------------------------------------------------------------------
# Creature textures (16x16, RGB float arrays + emissive mask)
# ---------------------------------------------------------------------------

PALE = [rgb("#e6c3ae"), rgb("#d6ad97"), rgb("#c49882"), rgb("#ae8170")]
CRIMSON = [rgb("#a8322a"), rgb("#86211b"), rgb("#641712"), rgb("#4a1d12")]

# Face features. '.' = procedural skin. W eye, w eye rim glow, K lip, k mouth
# interior, T tooth, t tooth shade, d blood drip.
FACE_FEATURES = [
    "................",
    "................",
    "................",
    "................",
    "..ww.......ww...",
    ".wWWw.....wWWw..",
    "..wWWw...wWWw...",
    "...ww.....ww....",
    "................",
    "....KKKKKKKK....",
    "...KTkTkkTkTK...",
    "...KkkkkkkkkK...",
    "...KkkkkkkkkK...",
    "...KtTkkkkTtK...",
    "....KKdKKdKK....",
    "......d..d......",
]
FEATURE_COLORS = {
    "W": rgb("#ffffff"),
    "w": rgb("#ffd6cc"),
    "K": rgb("#5e0b0a"),
    "k": rgb("#1e0303"),
    "T": rgb("#eadfc8"),
    "t": rgb("#b9a88a"),
    "d": rgb("#7a0f0c"),
}
EMISSIVE = {"W": 1.0, "w": 0.75}


def skin_texture(seed: int, crimson_amount: float, bottom_bias: float) -> np.ndarray:
    rng = np.random.default_rng(seed)
    tone = value_noise((16, 16), 4, rng) * 0.7 + rng.random((16, 16)) * 0.3
    mott = value_noise((16, 16), 5, rng) * 0.65 + rng.random((16, 16)) * 0.35
    rows = np.linspace(0, 1, 16)[:, None]
    mott = mott + bottom_bias * rows
    tex = np.zeros((16, 16, 3))
    for y in range(16):
        for x in range(16):
            t = tone[y, x]
            pale = PALE[min(3, int(t * 4))]
            m = mott[y, x]
            thr = 1.0 - crimson_amount
            if m > thr:
                k = min(3, int((m - thr) / max(crimson_amount, 1e-6) * 4))
                tex[y, x] = CRIMSON[k]
            else:
                tex[y, x] = pale
    return tex


def face_texture() -> tuple[np.ndarray, np.ndarray]:
    tex = skin_texture(seed=7, crimson_amount=0.30, bottom_bias=0.22)
    emis = np.zeros((16, 16))
    for y, row in enumerate(FACE_FEATURES):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            tex[y, x] = FEATURE_COLORS[ch]
            emis[y, x] = EMISSIVE.get(ch, 0.0)
    return tex, emis


def top_texture() -> tuple[np.ndarray, np.ndarray]:
    return skin_texture(seed=11, crimson_amount=0.38, bottom_bias=0.0), np.zeros((16, 16))


def side_texture() -> tuple[np.ndarray, np.ndarray]:
    return skin_texture(seed=23, crimson_amount=0.55, bottom_bias=0.25), np.zeros((16, 16))


# ---------------------------------------------------------------------------
# Biohazard emblem (signed geometry, evaluated per cell)
# ---------------------------------------------------------------------------

def biohazard_coverage(n: int, cx: float, cy: float, scale: float, ss: int = 4) -> np.ndarray:
    """Coverage in [0,1] of a biohazard trefoil on an n x n grid (ss x ss supersampling).

    Geometry in symbol units (outer radius ~26): three crescents made of a
    radius-15 circle 11 units out, minus a radius-10.5 circle 16 units out (which
    breaks through, so the horns open outwards), a central hole, a ring visible
    inside the cut-outs, and thin gaps between the overlapping crescents.
    scale = grid cells per symbol unit.
    """
    m = n * ss
    ys, xs = np.mgrid[0:m, 0:m].astype(np.float64)
    px = ((xs + 0.5) / ss - cx) / scale
    py = -((ys + 0.5) / ss - cy) / scale
    r = np.hypot(px, py)
    inside = np.zeros((m, m), dtype=bool)
    cut_any = np.zeros((m, m), dtype=bool)
    for k in range(3):
        ang = math.radians(90 + 120 * k)
        ux, uy = math.cos(ang), math.sin(ang)
        d1 = np.hypot(px - 11 * ux, py - 11 * uy)
        d2 = np.hypot(px - 16 * ux, py - 16 * uy)
        inside |= (d1 < 15) & (d2 >= 10.5)
        cut_any |= d2 < 9.5
    inside &= r >= 3.0
    inside |= (r >= 9.0) & (r <= 11.5) & cut_any
    for k in range(3):
        ang = math.radians(150 + 120 * k)
        ux, uy = math.cos(ang), math.sin(ang)
        along = px * ux + py * uy
        perp = np.abs(-px * uy + py * ux)
        inside &= ~((along > 0) & (along < 7) & (perp < 0.6))
    return inside.reshape(n, ss, n, ss).mean(axis=(1, 3))


# ---------------------------------------------------------------------------
# Scene
# ---------------------------------------------------------------------------

def draw_background(variant: str) -> np.ndarray:
    rng = np.random.default_rng(1234)
    g = np.zeros((GRID, GRID, 3))
    # sky gradient, banded like pixel art
    top, bottom = rgb("#070a1c"), rgb("#1c1d3b")
    for y in range(GRID):
        t = min(1.0, y / 46)
        t = round(t * 6) / 6
        g[y, :] = top * (1 - t) + bottom * t
    # stars
    for _ in range(46):
        x, y = rng.integers(0, GRID), rng.integers(0, 34)
        b = rng.choice([0.55, 0.75, 1.0])
        g[y, x] = rgb("#dfe6ff") * b
    # biohazard emblem behind the head
    cov = biohazard_coverage(GRID, 50.0, 13.5, 0.46)
    alpha = np.where(cov > 0.55, 0.55, np.where(cov > 0.25, 0.3, 0.0))[..., None]
    g = g * (1 - alpha) + rgb("#9a1c15") * alpha
    # square moon (top-left)
    mx, my, ms = 6, 5, 8
    g[my - 1:my + ms + 1, mx - 1:mx + ms + 1] = g[my - 1:my + ms + 1, mx - 1:mx + ms + 1] * 0.7 + rgb("#3a4270") * 0.3
    moon = rgb("#e9eef8")
    g[my:my + ms, mx:mx + ms] = moon
    for (cx, cy, c) in ((2, 2, "#c4cbdb"), (6, 5, "#c4cbdb"), (3, 6, "#d2d8e6"), (6, 1, "#d2d8e6"), (1, 5, "#d2d8e6")):
        g[my + cy, mx + cx] = rgb(c)
        if c == "#c4cbdb":
            g[my + cy, mx + cx + 1] = rgb(c)
            g[my + cy + 1, mx + cx] = rgb(c)
    # blocky tree line
    tree_dark, tree_mid = rgb("#08110b"), rgb("#0d1b12")
    x = 0
    while x < GRID:
        w = int(rng.integers(5, 10))
        h = int(rng.integers(10, 19))
        top_y = 46 - h
        g[top_y:46, x:x + w] = tree_dark
        # canopy texture
        for yy in range(top_y, min(top_y + h - 4, 46)):
            for xx in range(x, min(x + w, GRID)):
                if rng.random() < 0.28:
                    g[yy, xx] = tree_mid
        trunk_x = x + w // 2
        g[42:46, trunk_x:trunk_x + 1] = rgb("#140d08")
        x += w - int(rng.integers(0, 2))
    # ground
    for y in range(46, GRID):
        for xx in range(GRID):
            base = rgb("#13230f") if (y - 46) < 2 else rgb("#0d180b")
            if rng.random() < 0.22:
                base = base * 1.25
            g[y, xx] = base
    # tall grass tufts
    for _ in range(14):
        xx = int(rng.integers(0, GRID))
        hh = int(rng.integers(2, 4))
        g[46 - hh:46, xx] = rgb("#1b3417")
    # spider legs (behind the head): list of polylines in grid space
    legs = [
        [(24, 34), (14, 25), (7, 32), (3, 50)],
        [(24, 42), (15, 36), (10, 44), (9, 58)],
        [(40, 34), (50, 25), (57, 32), (61, 50)],
        [(40, 42), (49, 36), (54, 44), (55, 58)],
    ]
    leg_cols = [rgb("#8f2a20"), rgb("#6a1913"), rgb("#4b1a10"), rgb("#b0473a")]
    for li, pts in enumerate(legs):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            steps = max(abs(x1 - x0), abs(y1 - y0)) * 2
            for s in range(steps + 1):
                t = s / steps
                xx = int(round(x0 + (x1 - x0) * t))
                yy = int(round(y0 + (y1 - y0) * t))
                for dx in (0, 1):
                    for dy in (0, 1):
                        X, Y = xx + dx, yy + dy
                        if 0 <= X < GRID and 0 <= Y < GRID:
                            c = leg_cols[(X * 7 + Y * 3 + li) % 3]
                            if dx == 0 and dy == 0 and (X + Y) % 5 == 0:
                                c = leg_cols[3]
                            g[Y, X] = c
        # claw tip
        tx, ty = pts[-1]
        if 0 <= ty < GRID:
            g[min(GRID - 1, ty), max(0, min(GRID - 1, tx))] = rgb("#2a0a07")
    # RP: the torch beam lights the air between the torch and the head
    if variant == "rp":
        beam = beam_mask()
        warm = rgb("#ffe9b0")
        g = g * (1 - beam[..., None] * 0.6) + warm * beam[..., None] * 0.6
    return g


# RP torch: the ON item icon drawn 4x in the bottom-left corner; lens at grid BEAM_ORIGIN.
TORCH_POS = (-26, 218)  # output pixels, top-left of the 64x64 torch sprite (partly off-canvas)
BEAM_ORIGIN = ((TORCH_POS[0] + 12.5 * 4) / CELL, (TORCH_POS[1] + 3.0 * 4) / CELL)
BEAM_TARGET = (30.0, 36.0)


def beam_mask() -> np.ndarray:
    """Cone from the torch lens towards the creature's face, on the 64-grid, 4 brightness levels."""
    ys, xs = np.mgrid[0:GRID, 0:GRID].astype(np.float64)
    ox, oy = BEAM_ORIGIN
    tx, ty = BEAM_TARGET
    dx, dy = tx - ox, ty - oy
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    vx, vy = xs + 0.5 - ox, ys + 0.5 - oy
    along = vx * ux + vy * uy
    perp = np.abs(-vx * uy + vy * ux)
    half = 0.42 * along + 1.5
    a = np.clip(1.25 - perp / np.maximum(half, 1e-6), 0, 1)
    # the head stops the light a little past the target point
    a *= (along > 0.5) * np.clip((L + 4.0 - along) / 4.0, 0, 1) * np.clip(1.15 - along / (2.5 * L), 0, 1)
    return np.round(np.clip(a, 0, 1) * 4) / 4


def rot_matrix(yaw_deg: float, pitch_deg: float) -> np.ndarray:
    y = math.radians(yaw_deg)
    p = math.radians(pitch_deg)
    ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    rx = np.array([[1, 0, 0], [0, math.cos(p), -math.sin(p)], [0, math.sin(p), math.cos(p)]])
    return rx @ ry


def render_head(img: np.ndarray, emis_out: np.ndarray, variant: str) -> None:
    """Rasterise the textured head cube onto img (SIZE x SIZE x 3) in place."""
    R = rot_matrix(-24.0, 16.0)
    half = 58.0
    cx, cy = 128.0, 142.0
    face_tex, face_em = face_texture()
    top_tex, top_em = top_texture()
    side_tex, side_em = side_texture()
    # (origin corner, s axis, t axis, normal, texture, emissive, shade)
    faces = [
        (np.array([-1, 1, 1.0]), np.array([1, 0, 0.0]), np.array([0, -1, 0.0]), np.array([0, 0, 1.0]), face_tex, face_em, 0.9),
        (np.array([-1, 1, -1.0]), np.array([1, 0, 0.0]), np.array([0, 0, 1.0]), np.array([0, 1, 0.0]), top_tex, top_em, 1.0),
        (np.array([1, 1, 1.0]), np.array([0, 0, -1.0]), np.array([0, -1, 0.0]), np.array([1, 0, 0.0]), side_tex, side_em, 0.58),
        (np.array([-1, 1, -1.0]), np.array([0, 0, 1.0]), np.array([0, -1, 0.0]), np.array([-1, 0, 0.0]), side_tex, side_em, 0.58),
    ]
    tint = np.array([0.86, 0.89, 1.0])  # moonlight
    beam_full = None
    if variant == "rp":
        beam_full = np.kron(beam_mask(), np.ones((CELL, CELL)))
    ys, xs = np.mgrid[0:SIZE, 0:SIZE].astype(np.float64)
    px = xs + 0.5 - cx
    py = -(ys + 0.5 - cy)
    for origin, s_ax, t_ax, normal, tex, em, shade in faces:
        n = R @ normal
        if n[2] <= 1e-6:
            continue
        o = R @ origin * half
        u = R @ s_ax * half * 2 / 16  # per texel
        v = R @ t_ax * half * 2 / 16
        # solve [u v] [s t]^T = p - o in screen xy
        m = np.array([[u[0], v[0]], [u[1], v[1]]])
        inv = np.linalg.inv(m)
        qx = px - o[0]
        qy = py - o[1]
        s = inv[0, 0] * qx + inv[0, 1] * qy
        t = inv[1, 0] * qx + inv[1, 1] * qy
        mask = (s >= 0) & (s < 16) & (t >= 0) & (t < 16)
        si = np.clip(s.astype(int), 0, 15)
        ti = np.clip(t.astype(int), 0, 15)
        col = tex[ti, si] * shade * tint
        e = em[ti, si]
        if beam_full is not None:
            col = col * (1 + beam_full[..., None] * np.array([0.65, 0.52, 0.25]))
        col = col * (1 - e[..., None]) + tex[ti, si] * e[..., None]
        img[mask] = col[mask]
        emis_out[mask] = np.maximum(emis_out[mask], e[mask])


def add_glow(img: np.ndarray, emis: np.ndarray) -> np.ndarray:
    """Pixelated bloom around emissive texels (eyes)."""
    small = emis.reshape(GRID, CELL, GRID, CELL).max(axis=(1, 3))
    # separable box blur a few times ~ gaussian
    glow = small.copy()
    k = np.ones(3) / 3
    for _ in range(3):
        glow = np.apply_along_axis(lambda r: np.convolve(r, k, mode="same"), 1, glow)
        glow = np.apply_along_axis(lambda r: np.convolve(r, k, mode="same"), 0, glow)
    glow = np.clip(glow * 1.8, 0, 1)
    glow = np.round(glow * 4) / 4
    big = np.kron(glow, np.ones((CELL, CELL)))
    color = rgb("#ffe6df")
    return img + (color - img) * (big[..., None] * 0.42) * (1 - emis[..., None])


def vignette(img: np.ndarray) -> np.ndarray:
    ys, xs = np.mgrid[0:GRID, 0:GRID].astype(np.float64)
    d = np.hypot((xs + 0.5 - 32) / 32, (ys + 0.5 - 32) / 32)
    v = np.clip((d - 0.85) / 0.6, 0, 1)
    v = np.round(v * 4) / 4 * 0.55
    big = np.kron(v, np.ones((CELL, CELL)))
    return img * (1 - big[..., None])


def make_pack_icon(variant: str, torch_icon: Image.Image | None = None) -> Image.Image:
    """variant 'bp' (moonlit) or 'rp' (a tactical torch lights the creature).

    torch_icon: our 16x16 'torchlight on' item icon, drawn 4x in the RP corner.
    """
    bg = draw_background(variant)
    img = np.kron(bg, np.ones((CELL, CELL, 1)))
    emis = np.zeros((SIZE, SIZE))
    render_head(img, emis, variant)
    img = add_glow(img, emis)
    img = vignette(img)
    out = np.clip(np.round(img), 0, 255).astype(np.uint8)
    rgba = np.dstack([out, np.full((SIZE, SIZE), 255, np.uint8)])
    icon = Image.fromarray(rgba, "RGBA")
    if variant == "rp" and torch_icon is not None:
        sprite = torch_icon.resize((64, 64), Image.NEAREST)
        x0, y0 = TORCH_POS
        crop = sprite.crop((max(0, -x0), max(0, -y0), min(64, SIZE - x0), min(64, SIZE - y0)))
        icon.alpha_composite(crop, (max(0, x0), max(0, y0)))
    return icon
