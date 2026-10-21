"""Procedural PBR textures for the Great Wall subway reel (all made by code).

Every texture tiles seamlessly. Outputs PNGs into scene/tex/.
Albedo maps are sRGB, normal maps are OpenGL style (+Y up), ORM = (AO, roughness, metalness).
"""
import os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'scene', 'tex')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1234)


# ---------------------------------------------------------------- noise helpers
def value_noise(n, cells, seed):
    """Tileable smooth value noise, n x n pixels, `cells` lattice cells per side."""
    r = np.random.default_rng(seed)
    lat = r.random((cells, cells))
    u = np.arange(n) * cells / n
    i0 = np.floor(u).astype(int)
    f = u - i0
    f = f * f * f * (f * (f * 6 - 15) + 10)
    i1 = (i0 + 1) % cells
    a = lat[np.ix_(i0, i0)]; b = lat[np.ix_(i0, i1)]
    c = lat[np.ix_(i1, i0)]; d = lat[np.ix_(i1, i1)]
    fy = f[:, None]; fx = f[None, :]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(n, base_cells, octaves, seed, gain=0.5):
    total = np.zeros((n, n)); amp = 1.0; norm = 0.0; cells = base_cells
    for o in range(octaves):
        if cells > n:
            break
        total += amp * value_noise(n, cells, seed + o * 101)
        norm += amp; amp *= gain; cells *= 2
    return total / norm


def worley(n, cells, seed, jitter=1.0):
    """Tileable F1/F2 cellular noise; returns (f1, f2, cell_id) in pixel-normalised units."""
    r = np.random.default_rng(seed)
    pts = (np.arange(cells)[:, None, None] + 0.0)
    off = r.random((cells, cells, 2)) * jitter + (1 - jitter) * 0.5
    ids = r.random((cells, cells))
    yy, xx = np.mgrid[0:n, 0:n] * (cells / n)
    cy = np.floor(yy).astype(int); cx = np.floor(xx).astype(int)
    f1 = np.full((n, n), 9.0); f2 = np.full((n, n), 9.0); cid = np.zeros((n, n))
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            gy = cy + dy; gx = cx + dx
            gyw = gy % cells; gxw = gx % cells
            py = gy + off[gyw, gxw, 0]; px = gx + off[gyw, gxw, 1]
            d = np.sqrt((py - yy) ** 2 + (px - xx) ** 2)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            cid = np.where(closer, ids[gyw, gxw], cid)
            f1 = np.where(closer, d, f1)
    return f1, f2, cid


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5
    nx = -dx * strength; ny = dy * strength; nz = np.ones_like(h)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / l, ny / l, nz / l], -1)


def blur(a, r=1):
    out = a.copy()
    for _ in range(r):
        out = (out + np.roll(out, 1, 0) + np.roll(out, -1, 0) + np.roll(out, 1, 1) + np.roll(out, -1, 1)) / 5
    return out


def save_rgb(name, rgb):
    Image.fromarray(np.clip(rgb * 255 + 0.5, 0, 255).astype(np.uint8), 'RGB').save(os.path.join(OUT, name))


def save_rgba(name, rgba):
    Image.fromarray(np.clip(rgba * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, name))


def save_normal(name, nrm):
    save_rgb(name, nrm * 0.5 + 0.5)


def srgb(hexstr):
    h = hexstr.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def stones(n, count, rmin, rmax, seed):
    """Tileable field of small round pebbles: returns (height, mask, tint)."""
    r = np.random.default_rng(seed)
    h = np.zeros((n, n)); m = np.zeros((n, n)); tint = np.zeros((n, n))
    yy, xx = np.mgrid[0:n, 0:n]
    for _ in range(count):
        cy, cx = r.random(2) * n
        rad = r.uniform(rmin, rmax)
        ry = rad * r.uniform(0.6, 1.0)
        ang = r.uniform(0, np.pi)
        dy = (yy - cy + n / 2) % n - n / 2
        dx = (xx - cx + n / 2) % n - n / 2
        u = dx * np.cos(ang) + dy * np.sin(ang)
        v = -dx * np.sin(ang) + dy * np.cos(ang)
        d = (u / rad) ** 2 + (v / ry) ** 2
        inside = d < 1
        dome = np.sqrt(np.clip(1 - d, 0, 1))
        h = np.where(inside, np.maximum(h, dome), h)
        tint = np.where(inside & (dome > 0.05), r.random(), tint)
        m = np.maximum(m, np.clip((1 - d) * 4, 0, 1))
    return h, m, tint


N = 1024

# ---------------------------------------------------------------- bricks (Great Wall)
def make_bricks():
    n = N; cols, rows = 8, 16
    yy, xx = np.mgrid[0:n, 0:n] / n
    row = np.floor(yy * rows).astype(int)
    shift = (row % 2) * 0.5
    bx = xx * cols + shift
    col = np.floor(bx).astype(int) % cols
    fx = bx - np.floor(bx); fy = yy * rows - row
    mortar_w = 0.07
    ex = np.minimum(fx, 1 - fx) / (1.0 / cols * cols) ; ey = np.minimum(fy, 1 - fy)
    # rounded brick edges: distance to brick border in brick units (account for aspect 2:1)
    edge = np.minimum(ex * 2.0, ey)
    warp = fbm(n, 16, 4, 7) * 0.05
    edge = edge + warp - 0.025
    brick_mask = np.clip((edge - mortar_w * 0.5) / 0.05, 0, 1)
    bevel = np.clip(edge / 0.16, 0, 1) ** 0.6
    bid = (row * 31 + col * 17) % 97
    r = np.random.default_rng(5)
    per = r.random(97)
    per2 = r.random(97)
    tone = per[bid]
    n1 = fbm(n, 32, 5, 11); n2 = fbm(n, 128, 3, 12)
    # chipped corners / pits
    f1, f2, _ = worley(n, 48, 13)
    pits = np.clip((0.12 - f1) / 0.12, 0, 1) * (n2 > 0.55)
    # cracks: thin worley ridges, only on some bricks
    c1, c2, _ = worley(n, 10, 14)
    crack = np.clip(1 - (c2 - c1) / 0.035, 0, 1) * (per2[bid] > 0.55) * (fbm(n, 8, 2, 15) > 0.45)
    height = brick_mask * (0.55 + 0.45 * bevel) + (n1 - 0.5) * 0.25 * brick_mask - pits * 0.25 - crack * 0.35
    height += (1 - brick_mask) * (n2 * 0.15)
    base_a = srgb('#b9a68a'); base_b = srgb('#8f7d66'); base_c = srgb('#a39279')
    col_rgb = (base_a[None, None] * (1 - tone[..., None]) + base_b[None, None] * tone[..., None])
    col_rgb = col_rgb * (0.82 + 0.3 * n1[..., None]) + (n2[..., None] - 0.5) * 0.08
    weather = fbm(n, 6, 4, 16)
    col_rgb = col_rgb * (1 - 0.18 * weather[..., None]) + base_c * 0.0
    mortar_col = srgb('#cfc6b4') * (0.85 + 0.2 * n2[..., None])
    alb = col_rgb * brick_mask[..., None] + mortar_col * (1 - brick_mask[..., None])
    alb = alb * (1 - 0.35 * crack[..., None]) * (1 - 0.25 * pits[..., None])
    ao = 0.55 + 0.45 * np.clip(bevel * brick_mask + (1 - brick_mask) * 0.25, 0, 1)
    ao = blur(ao, 2)
    alb *= (0.8 + 0.2 * ao[..., None])
    rough = 0.82 + 0.12 * n2 - 0.05 * brick_mask
    save_rgb('bricks_albedo.png', alb)
    save_normal('bricks_normal.png', normal_from_height(blur(height, 1), 9.0))
    save_rgb('bricks_orm.png', np.stack([ao, rough, np.zeros_like(ao)], -1))


# ---------------------------------------------------------------- big stone blocks (tower base)
def make_blocks():
    n = 512; cols, rows = 3, 4
    yy, xx = np.mgrid[0:n, 0:n] / n
    row = np.floor(yy * rows).astype(int)
    bx = xx * cols + (row % 2) * 0.37
    col = np.floor(bx).astype(int)
    fx = bx - np.floor(bx); fy = yy * rows - row
    edge = np.minimum(np.minimum(fx, 1 - fx) * cols / rows * 1.0, np.minimum(fy, 1 - fy)) + fbm(n, 12, 4, 21) * 0.04
    mask = np.clip((edge - 0.035) / 0.03, 0, 1)
    bevel = np.clip(edge / 0.12, 0, 1) ** 0.5
    n1 = fbm(n, 16, 5, 22); n2 = fbm(n, 64, 3, 23)
    bid = (row * 13 + col * 7) % 50
    tone = np.random.default_rng(24).random(50)[bid]
    a = srgb('#a8a294'); b = srgb('#8a857a')
    alb = a * (1 - tone[..., None]) + b * tone[..., None]
    alb = alb * (0.8 + 0.35 * n1[..., None]) * (mask[..., None] * 0.9 + 0.1) + (1 - mask[..., None]) * srgb('#6d675d') * 0.9
    h = mask * (0.6 + 0.4 * bevel) + (n1 - 0.5) * 0.3 + n2 * 0.1
    ao = blur(0.6 + 0.4 * mask * bevel, 2)
    save_rgb('blocks_albedo.png', alb * (0.8 + 0.2 * ao[..., None]))
    save_normal('blocks_normal.png', normal_from_height(blur(h, 1), 6.0))
    save_rgb('blocks_orm.png', np.stack([ao, 0.85 + 0.1 * n2, np.zeros_like(ao)], -1))


# ---------------------------------------------------------------- rock (neutral, tinted in shader)
def make_rock():
    n = N
    n1 = fbm(n, 4, 7, 31); n2 = fbm(n, 24, 5, 32); n3 = fbm(n, 128, 3, 33)
    # sedimentary feel: stretched horizontal layering + soft blotches
    yy = np.arange(n)[:, None] / n
    warp = fbm(n, 6, 4, 39)
    layers = 0.5 + 0.5 * np.sin((yy * 22 + warp * 3.0) * np.pi)
    layers = blur(np.repeat(layers, n, axis=1) if layers.shape[1] == 1 else layers, 2)
    f1, f2, cid = worley(n, 9, 34)
    crack_mask = (fbm(n, 5, 3, 35) > 0.56)
    cracks = np.clip(1 - (f2 - f1) / 0.022, 0, 1) * crack_mask
    g1, g2, gid = worley(n, 30, 36)
    small_cracks = np.clip(1 - (g2 - g1) / 0.016, 0, 1) * (n2 > 0.6)
    ph, pm, ptint = stones(n, 120, 3, 9, 37)
    h = n1 * 0.5 + n2 * 0.55 + n3 * 0.35 + layers * 0.12 + (1 - f1) * 0.06 - cracks * 0.5 - small_cracks * 0.2 + ph * 0.22
    lum = 0.56 + 0.16 * (n1 - 0.5) + 0.2 * (n2 - 0.5) + 0.22 * (n3 - 0.5) + 0.06 * (layers - 0.5) + 0.05 * (cid - 0.5)
    lum = lum * (1 - 0.45 * cracks) * (1 - 0.22 * small_cracks)
    # mineral grains: small dark and light specks (granite / sandstone grit)
    rr = np.random.default_rng(38)
    dark = blur((rr.random((n, n)) > 0.975).astype(float), 1) * 2.2
    light = blur((rr.random((n, n)) > 0.985).astype(float), 1) * 2.0
    lum = lum * (1 - 0.35 * np.clip(dark, 0, 1)) + 0.18 * np.clip(light, 0, 1)
    pcol = 0.5 + 0.25 * ptint
    pm = pm * 0.7
    lum = lum * (1 - pm) + pcol * pm * (0.75 + 0.25 * ph)
    alb = np.stack([lum, lum * 0.985, lum * 0.96], -1)
    ao = blur(np.clip(0.55 + 0.6 * (h - h.min()) / (h.max() - h.min()), 0, 1), 3)
    save_rgb('rock_albedo.png', np.clip(alb, 0, 1))
    save_normal('rock_normal.png', normal_from_height(blur(h, 1), 11.0))
    save_rgb('rock_orm.png', np.stack([ao, 0.8 + 0.15 * n3 - pm * 0.2, np.zeros_like(ao)], -1))


# ---------------------------------------------------------------- soil / dirt
def make_soil():
    n = 512
    n1 = fbm(n, 8, 6, 41); n2 = fbm(n, 64, 3, 42)
    ph, pm, pt = stones(n, 220, 2, 6, 43)
    clods = fbm(n, 24, 3, 44)
    h = n1 * 0.6 + clods * 0.5 + n2 * 0.2 + ph * 0.5
    a = srgb('#7a5236'); b = srgb('#5a3a25')
    t = np.clip((n1 - 0.3) * 1.6, 0, 1)
    alb = a * (1 - t[..., None]) + b * t[..., None]
    alb = alb * (0.85 + 0.3 * n2[..., None])
    stone_col = (srgb('#8a7865') * pt[..., None] + srgb('#62564a') * (1 - pt[..., None]))
    alb = alb * (1 - pm[..., None]) + stone_col * pm[..., None] * (0.7 + 0.3 * ph[..., None])
    ao = blur(np.clip(0.5 + 0.6 * (h - h.min()) / (np.ptp(h)), 0, 1), 2)
    save_rgb('soil_albedo.png', alb * (0.75 + 0.25 * ao[..., None]))
    save_normal('soil_normal.png', normal_from_height(blur(h, 1), 10.0))


# ---------------------------------------------------------------- grass (seen from above at distance)
def make_grass():
    n = 512
    n1 = fbm(n, 6, 6, 51); n2 = fbm(n, 96, 3, 52); n3 = fbm(n, 24, 4, 53)
    blades = np.random.default_rng(54).random((n, n))
    blades = blur(blades, 1)
    a = srgb('#5d8a35'); b = srgb('#3f6a2a'); c = srgb('#8fa843')
    t = np.clip(n1 * 1.5 - 0.25, 0, 1)
    alb = a * (1 - t[..., None]) + b * t[..., None]
    dry = np.clip((n3 - 0.58) * 4, 0, 1)
    alb = alb * (1 - dry[..., None] * 0.6) + c * dry[..., None] * 0.6
    alb = alb * (0.8 + 0.4 * blades[..., None]) * (0.9 + 0.2 * n2[..., None])
    h = blades * 0.5 + n2 * 0.3 + n1 * 0.4
    save_rgb('grass_albedo.png', alb)
    save_normal('grass_normal.png', normal_from_height(h, 4.0))


# ---------------------------------------------------------------- concrete
def make_concrete():
    n = 512
    n1 = fbm(n, 4, 6, 61); n2 = fbm(n, 64, 3, 62)
    pores = (np.random.default_rng(63).random((n, n)) > 0.992).astype(float)
    pores = blur(pores, 1) * 3
    stains = np.clip((fbm(n, 3, 5, 64) - 0.5) * 2.5, 0, 1)
    lum = 0.74 + 0.1 * (n1 - 0.5) + 0.05 * (n2 - 0.5) - 0.12 * stains - 0.3 * np.clip(pores, 0, 1)
    alb = np.stack([lum * 1.0, lum * 0.985, lum * 0.95], -1)
    h = n2 * 0.4 + n1 * 0.2 - np.clip(pores, 0, 1) * 0.6
    save_rgb('concrete_albedo.png', np.clip(alb, 0, 1))
    save_normal('concrete_normal.png', normal_from_height(h, 3.0))
    save_rgb('concrete_orm.png', np.stack([np.ones_like(h) * (1 - 0.2 * np.clip(pores, 0, 1)), 0.72 + 0.15 * n2 + 0.08 * stains, np.zeros_like(h)], -1))


# ---------------------------------------------------------------- machine grime / scratches mask
def make_grime():
    n = N
    g = fbm(n, 6, 6, 71)
    speck = fbm(n, 96, 2, 72)
    r = np.random.default_rng(73)
    scratches = np.zeros((n, n))
    yy, xx = np.mgrid[0:n, 0:n]
    for _ in range(140):
        x0, y0 = r.random(2) * n
        ang = r.normal(0.0, 0.5) + (r.random() > 0.6) * np.pi / 2
        length = r.uniform(30, 160)
        width = r.uniform(0.6, 1.6)
        dx = (xx - x0 + n / 2) % n - n / 2
        dy = (yy - y0 + n / 2) % n - n / 2
        along = dx * np.cos(ang) + dy * np.sin(ang)
        across = -dx * np.sin(ang) + dy * np.cos(ang)
        m = (np.abs(across) < width) & (along > 0) & (along < length)
        fade = np.clip(1 - along / length, 0, 1)
        scratches = np.maximum(scratches, m * fade * r.uniform(0.5, 1.0))
    f1, f2, _ = worley(n, 40, 74)
    chips = np.clip((0.18 - f1) / 0.1, 0, 1) * (fbm(n, 12, 3, 75) > 0.6)
    save_rgb('grime_mask.png', np.stack([g, np.clip(scratches + speck * 0.0, 0, 1), np.clip(chips + (speck > 0.7) * 0.3, 0, 1)], -1))


# ---------------------------------------------------------------- generic 4-channel noise
def make_noise():
    n = 512
    save_rgba('noise_rgba.png', np.stack([fbm(n, 4, 6, 81), fbm(n, 16, 5, 82), fbm(n, 64, 3, 83), fbm(n, 2, 6, 84)], -1))


# ---------------------------------------------------------------- station wall tiles
def make_tiles():
    n = 512; k = 8
    yy, xx = np.mgrid[0:n, 0:n] / n * k
    fx = xx - np.floor(xx); fy = yy - np.floor(yy)
    e = np.minimum(np.minimum(fx, 1 - fx), np.minimum(fy, 1 - fy))
    grout = np.clip((e - 0.03) / 0.02, 0, 1)
    bevel = np.clip(e / 0.12, 0, 1) ** 0.5
    n1 = fbm(n, 8, 4, 91)
    tid = (np.floor(xx) * 7 + np.floor(yy) * 13) % 23
    tone = np.random.default_rng(92).random(23)[tid.astype(int)]
    lum = (0.9 + 0.06 * tone + 0.03 * n1) * grout + (1 - grout) * 0.55
    alb = np.stack([lum, lum * 0.97, lum * 0.9], -1)
    h = grout * (0.5 + 0.5 * bevel)
    save_rgb('tiles_albedo.png', alb)
    save_normal('tiles_normal.png', normal_from_height(blur(h, 1), 5.0))


# ---------------------------------------------------------------- sprites
def make_sprites():
    n = 128
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n * 2 - 1
    d = np.sqrt(xx ** 2 + yy ** 2)
    nz = fbm(n, 4, 4, 101)
    puff = np.clip(1 - d, 0, 1) ** 1.5 * (0.55 + 0.6 * nz)
    puff = np.clip(puff * 1.3, 0, 1) * np.clip((1 - d) * 3, 0, 1)
    save_rgba('dust_sprite.png', np.stack([np.ones_like(d), np.ones_like(d), np.ones_like(d), puff], -1))
    glow = np.exp(-d * d * 9) + 0.25 * np.exp(-d * d * 2.5)
    glow = glow / glow.max() * np.clip((1 - d) * 4, 0, 1)
    save_rgba('glow_sprite.png', np.stack([np.ones_like(d), np.ones_like(d), np.ones_like(d), glow], -1))
    # soft mist bank (wide): horizontal falloff, noisy top
    w, h = 512, 128
    yy, xx = (np.mgrid[0:h, 0:w] + 0.5)
    u = xx / w * 2 - 1; v = yy / h
    nz2 = np.array(Image.fromarray((fbm(512, 8, 5, 102) * 255).astype(np.uint8)).resize((w, h))) / 255
    a = np.clip(1 - np.abs(u) ** 2.2, 0, 1) * np.clip(np.sin(np.pi * v) ** 1.2, 0, 1) * (0.5 + 0.7 * nz2)
    save_rgba('mist_sprite.png', np.stack([np.ones_like(a), np.ones_like(a), np.ones_like(a), np.clip(a, 0, 1)], -1))


if __name__ == '__main__':
    import sys
    only = set(sys.argv[1:])
    for f in (make_bricks, make_blocks, make_rock, make_soil, make_grass, make_concrete, make_grime, make_noise, make_tiles, make_sprites):
        if only and f.__name__ not in only:
            continue
        f()
        print('made', f.__name__)
