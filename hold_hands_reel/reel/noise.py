"""Small procedural-noise toolbox (numba-compiled). Everything on screen is built from these."""
from math import floor, sqrt

from numba import njit


@njit(fastmath=True, inline="always")
def hash2(ix, iy):
    n = (ix * 374761393 + iy * 668265263) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    n = n ^ (n >> 16)
    return n


@njit(fastmath=True, inline="always")
def hash2f(ix, iy):
    return hash2(ix, iy) / 4294967296.0


@njit(fastmath=True, inline="always")
def hash3(ix, iy, iz):
    n = (ix * 374761393 + iy * 668265263 + iz * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    n = n ^ (n >> 16)
    return n


@njit(fastmath=True, inline="always")
def _g2(ix, iy, dx, dy):
    n = hash2(ix, iy)
    gx = (n & 0xFFFF) / 32767.5 - 1.0
    gy = ((n >> 16) & 0xFFFF) / 32767.5 - 1.0
    return gx * dx + gy * dy


@njit(fastmath=True)
def gnoise2(x, y):
    """2D gradient noise, roughly in [-1, 1]."""
    fx0 = floor(x)
    fy0 = floor(y)
    ix = int(fx0)
    iy = int(fy0)
    fx = x - fx0
    fy = y - fy0
    u = fx * fx * fx * (fx * (fx * 6.0 - 15.0) + 10.0)
    v = fy * fy * fy * (fy * (fy * 6.0 - 15.0) + 10.0)
    a = _g2(ix, iy, fx, fy)
    b = _g2(ix + 1, iy, fx - 1.0, fy)
    c = _g2(ix, iy + 1, fx, fy - 1.0)
    d = _g2(ix + 1, iy + 1, fx - 1.0, fy - 1.0)
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.6


@njit(fastmath=True, inline="always")
def _g3(ix, iy, iz, dx, dy, dz):
    n = hash3(ix, iy, iz)
    gx = (n & 0x3FF) / 511.5 - 1.0
    gy = ((n >> 10) & 0x3FF) / 511.5 - 1.0
    gz = ((n >> 20) & 0x3FF) / 511.5 - 1.0
    return gx * dx + gy * dy + gz * dz


@njit(fastmath=True)
def gnoise3(x, y, z):
    """3D gradient noise, roughly in [-1, 1]."""
    fx0 = floor(x)
    fy0 = floor(y)
    fz0 = floor(z)
    ix = int(fx0)
    iy = int(fy0)
    iz = int(fz0)
    fx = x - fx0
    fy = y - fy0
    fz = z - fz0
    u = fx * fx * fx * (fx * (fx * 6.0 - 15.0) + 10.0)
    v = fy * fy * fy * (fy * (fy * 6.0 - 15.0) + 10.0)
    w = fz * fz * fz * (fz * (fz * 6.0 - 15.0) + 10.0)
    a = _g3(ix, iy, iz, fx, fy, fz)
    b = _g3(ix + 1, iy, iz, fx - 1.0, fy, fz)
    c = _g3(ix, iy + 1, iz, fx, fy - 1.0, fz)
    d = _g3(ix + 1, iy + 1, iz, fx - 1.0, fy - 1.0, fz)
    e = _g3(ix, iy, iz + 1, fx, fy, fz - 1.0)
    f = _g3(ix + 1, iy, iz + 1, fx - 1.0, fy, fz - 1.0)
    g = _g3(ix, iy + 1, iz + 1, fx, fy - 1.0, fz - 1.0)
    h = _g3(ix + 1, iy + 1, iz + 1, fx - 1.0, fy - 1.0, fz - 1.0)
    x0 = a + (b - a) * u
    x1 = c + (d - c) * u
    x2 = e + (f - e) * u
    x3 = g + (h - g) * u
    y0 = x0 + (x1 - x0) * v
    y1 = x2 + (x3 - x2) * v
    return (y0 + (y1 - y0) * w) * 1.5


@njit(fastmath=True, inline="always")
def smoothstep(a, b, x):
    t = (x - a) / (b - a)
    if t < 0.0:
        t = 0.0
    elif t > 1.0:
        t = 1.0
    return t * t * (3.0 - 2.0 * t)


@njit(fastmath=True)
def fbm2(x, y, octaves, lam0_px, blur_px):
    """Fractal noise with depth-of-field built in.

    lam0_px is the on-screen wavelength of the first octave; octaves whose
    wavelength is smaller than the blur circle fade out, which gives a real
    out-of-focus look without any image-space convolution.
    """
    s = 0.0
    amp = 0.5
    f = 1.0
    lam = lam0_px
    for _ in range(octaves):
        w = smoothstep(0.7, 2.6, lam / (blur_px + 1e-6))
        if w > 0.0:
            s += amp * w * gnoise2(x * f + 17.3 * f, y * f - 9.1 * f)
        amp *= 0.5
        f *= 2.03
        lam *= 0.4926
    return s


@njit(fastmath=True)
def voronoi2(x, y, jitter):
    """Returns (F1, F2, cell hash 0..1, vector to nearest site x, y)."""
    fx0 = floor(x)
    fy0 = floor(y)
    ix = int(fx0)
    iy = int(fy0)
    fx = x - fx0
    fy = y - fy0
    f1 = 9.0
    f2 = 9.0
    cid = 0.0
    vx = 0.0
    vy = 0.0
    for j in range(-1, 2):
        for i in range(-1, 2):
            n = hash2(ix + i, iy + j)
            px = i + 0.5 + ((n & 0xFFFF) / 65535.0 - 0.5) * jitter - fx
            py = j + 0.5 + (((n >> 16) & 0xFFFF) / 65535.0 - 0.5) * jitter - fy
            d = px * px + py * py
            if d < f1:
                f2 = f1
                f1 = d
                cid = ((n * 2654435761) & 0xFFFFFFFF) / 4294967296.0
                vx = px
                vy = py
            elif d < f2:
                f2 = d
    return sqrt(f1), sqrt(f2), cid, vx, vy
