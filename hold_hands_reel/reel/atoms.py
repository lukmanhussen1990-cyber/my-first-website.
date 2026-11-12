"""The last stage: atoms. Glowing balls wrapped in fuzzy electron clouds.

Two sheets of atoms face each other across the gap.  When they drift closer, the
facing sides of the clouds flatten and light up (electrons pushing back) and the
atoms ease apart again - they never meet.
"""
from math import atan2, cos, exp, pi, sin, sqrt

import numpy as np
from numba import njit, prange

from .noise import gnoise2, hash2, smoothstep
from .post import tonemap

GAP_PX = 394.0  # the measured gap on a 1920-tall frame
RAD = 0.63  # cloud radius in gap units
SPACING = 1.34


def build_atoms(t, push):
    """List of atoms: [x, y, radius, r, g, b, blur, gain, squash, face(+1 down/-1 up), seed, halo r,g,b]."""
    rows = []
    for side in (-1, 1):  # -1 = top sheet (person A), +1 = bottom sheet (person B)
        for j in range(0, 7):
            for i in range(-9, 10):
                seed = (i + 20) * 131 + j * 17 + (0 if side < 0 else 7919)
                rng = np.random.default_rng(seed)
                jx, jy, jr, ph = rng.random(4)
                x = (i + (0.5 if j % 2 else 0.0)) * SPACING + (jx - 0.5) * 0.10 * (1 if (i or j) else 0)
                y = side * (0.5 + RAD + j * SPACING * 0.84 + (jy - 0.5) * 0.10 * (1 if j else 0))
                rad = RAD * (1.0 + (jr - 0.5) * 0.12 * (1 if (i or j) else 0))
                # gentle thermal wobble
                x += 0.018 * sin(t * 2.3 + ph * 6.28)
                y += 0.014 * cos(t * 1.9 + ph * 9.1)
                sq = 0.0
                if j == 0:
                    w = 1.0 if i == 0 else 0.7
                    y -= side * 0.085 * push * w  # drift towards the other sheet ...
                    sq = 0.15 * push * w  # ... while the facing side flattens
                blur = 0.30 * j + (0.06 * abs(i) if j == 0 else 0.0)
                gain = (0.80**j) * (1.0 if i == 0 or j > 0 else 0.86)
                if side < 0:
                    col = (1.0, 0.56 + 0.10 * jr, 0.24 + 0.10 * jx)
                    halo = (1.0, 0.36, 0.20)
                else:
                    k = jx if (i or j) else 0.25
                    col = (1.0 - 0.45 * k, 0.42 + 0.14 * k, 0.70 + 0.30 * k)
                    halo = (0.45, 0.40, 1.0)
                rows.append([x, y, rad, *col, blur, gain, sq, -side, seed, *halo])
    return np.array(rows, dtype=np.float64)


@njit(parallel=True, fastmath=True, cache=True)
def render_atoms_k(W, H, out, atoms, t, frame, zoom, fx, fy, gblur):
    s = H / 1920.0
    unit = GAP_PX * s * zoom  # pixels per gap unit
    n = atoms.shape[0]
    blur_k = gblur / (unit * RAD + 1e-6)
    for y in prange(H):
        for k in range(n):
            ax = fx + atoms[k, 0] * unit
            ay = fy + atoms[k, 1] * unit
            rad = atoms[k, 2] * unit
            bl = atoms[k, 6] + blur_k
            ext = rad * (1.55 + 0.9 * bl)
            dyp = y + 0.5 - ay
            if dyp > ext or dyp < -ext:
                continue
            if ax + ext < 0 or ax - ext > W:
                continue
            x0 = int(max(0.0, ax - ext))
            x1 = int(min(float(W), ax + ext + 1.0))
            gain = atoms[k, 7]
            sq = atoms[k, 8]
            face = atoms[k, 9]
            seedf = atoms[k, 10] * 0.37
            cr = atoms[k, 3]
            cg = atoms[k, 4]
            cb = atoms[k, 5]
            hr = atoms[k, 11]
            hg = atoms[k, 12]
            hb = atoms[k, 13]
            sharp = 1.0 / (1.0 + 2.2 * bl)
            for x in range(x0, x1):
                dxp = x + 0.5 - ax
                r = sqrt(dxp * dxp + dyp * dyp) + 1e-6
                ct = dyp / r * face  # +1 on the side that faces the other sheet
                cf = ct if ct > 0.0 else 0.0
                rr = r / rad
                rr = rr / (1.0 - sq * cf * cf)  # flattened where the clouds press together
                if rr > 1.55 + 0.9 * bl:
                    continue
                # fuzzy cloud: dense core, soft shells, fading edge
                core = exp(-((rr / (0.30 + 0.5 * bl)) ** 1.6))
                body = exp(-((rr / (0.74 + 0.6 * bl)) ** (3.2 * sharp + 0.8)))
                shell = 0.0
                arc = 0.0
                tex = 1.0
                if bl < 0.5:
                    w = 1.0 - bl * 2.0
                    shell = (0.16 * exp(-(((rr - 0.56) / 0.07) ** 2)) + 0.12 * exp(-(((rr - 0.90) / 0.06) ** 2))) * w
                    ang = atan2(dyp, dxp)
                    tex = 1.0 + w * 0.22 * gnoise2(ang * 2.2 + seedf + t * 0.5, rr * 4.5 - t * 0.9 + seedf)
                    tex += w * 0.10 * gnoise2(dxp / rad * 9.0 + t * 1.3, dyp / rad * 9.0 - seedf)
                    arc = sq * 9.0 * exp(-(((rr - 1.0) / 0.055) ** 2)) * cf * cf * cf * w
                # soft sphere lighting so the cloud reads as a ball
                lit = 0.78 + 0.34 * (-dxp * 0.55 - dyp * 0.62) / r * smoothstep(0.0, 0.5, rr) * sharp
                dens = (body * 0.58 + shell) * tex * lit
                edge = smoothstep(0.35, 1.05, rr)
                r_ = (cr + (hr - cr) * edge) * dens + core * 1.25 + arc * (0.9 + 0.1 * hr)
                g_ = (cg + (hg - cg) * edge) * dens + core * (0.95 + 0.25 * cg) + arc * 0.85
                b_ = (cb + (hb - cb) * edge) * dens + core * (0.75 + 0.45 * cb) + arc * (0.85 + 0.15 * hb)
                out[y, x, 0] += r_ * gain
                out[y, x, 1] += g_ * gain
                out[y, x, 2] += b_ * gain


@njit(fastmath=True, cache=True)
def sparkle(W, H, out, atoms, t, frame, zoom, fx, fy, gblur):
    """Electron 'probability dots': thousands of tiny flickering points, densest near each nucleus,
    plus a few brighter electrons gliding through the cloud."""
    s = H / 1920.0
    unit = GAP_PX * s * zoom
    n = atoms.shape[0]
    for k in range(n):
        if atoms[k, 6] > 0.45:
            continue
        ax = fx + atoms[k, 0] * unit
        ay = fy + atoms[k, 1] * unit
        rad = atoms[k, 2] * unit
        if ax + 1.5 * rad < 0 or ax - 1.5 * rad > W or ay + 1.5 * rad < 0 or ay - 1.5 * rad > H:
            continue
        w = (1.0 - atoms[k, 6] / 0.45) * atoms[k, 7]
        soft = 1.0 + gblur * 0.25
        nd = int(min(5200.0, 0.085 * rad * rad) * w / soft)
        seed = int(atoms[k, 10])
        sq = atoms[k, 8]
        face = atoms[k, 9]
        sig = (1.15 * s + 0.004 * rad) * soft
        rs = int(3.0 * sig) + 1
        for i in range(nd):
            life = 5
            slot = (frame + i) // life
            ph = ((frame + i) % life + 0.5) / life
            h1 = hash2(seed * 131 + i, slot)
            h2 = hash2(seed * 17 + i * 3 + 1, slot + 7)
            u1 = (h1 & 0xFFFF) / 65535.0
            u2 = ((h1 >> 16) & 0xFFFF) / 65535.0
            u3 = (h2 & 0xFFFF) / 65535.0
            u4 = ((h2 >> 16) & 0xFFFF) / 65535.0
            # radius: mostly close in, a few far out (two shells)
            if u3 < 0.55:
                rr = 0.10 + 0.50 * sqrt(u1)
            else:
                rr = 0.56 + 0.52 * u1
            an = u2 * 6.2832
            cs = cos(an)
            sn = sin(an)
            ct = sn * face
            cf = ct if ct > 0.0 else 0.0
            rr *= 1.0 - sq * cf * cf
            px = ax + rr * rad * cs
            py = ay + rr * rad * sn
            br = (0.10 + 0.55 * u4 * u4) * sin(pi * ph) * w * (1.25 - 0.6 * rr) / soft
            ix = int(px)
            iy = int(py)
            for yy in range(iy - rs, iy + rs + 1):
                if yy < 0 or yy >= H:
                    continue
                for xx in range(ix - rs, ix + rs + 1):
                    if xx < 0 or xx >= W:
                        continue
                    d2 = (xx + 0.5 - px) ** 2 + (yy + 0.5 - py) ** 2
                    g = exp(-d2 / (2.0 * sig * sig)) * br
                    out[yy, xx, 0] += g * (0.75 + 0.25 * atoms[k, 3])
                    out[yy, xx, 1] += g * (0.70 + 0.30 * atoms[k, 4])
                    out[yy, xx, 2] += g * (0.70 + 0.30 * atoms[k, 5])
        # a few bright electrons with short trails
        if atoms[k, 6] < 0.1:
            for e in range(7):
                he = hash2(seed + e * 977, 3)
                e1 = (he & 0xFFFF) / 65535.0
                e2 = ((he >> 16) & 0xFFFF) / 65535.0
                rsh = (0.56 if e % 2 == 0 else 0.90) * rad
                tilt = 0.35 + 0.6 * e1
                rot = e2 * 6.2832
                om = (1.6 + 1.4 * e1) * (1.0 if e % 2 == 0 else -0.8)
                for tr in range(14):
                    ph = om * (t - tr * 0.012) * 2.2 + e2 * 20.0
                    ex = rsh * cos(ph)
                    ey = rsh * sin(ph) * tilt
                    qx = ex * cos(rot) - ey * sin(rot)
                    qy = ex * sin(rot) + ey * cos(rot)
                    r0 = sqrt(qx * qx + qy * qy) + 1e-6
                    ct = qy / r0 * face
                    cf = ct if ct > 0.0 else 0.0
                    kq = 1.0 - sq * cf * cf
                    px = ax + qx * kq
                    py = ay + qy * kq
                    sg = (2.4 * s + 0.006 * rad) * (1.0 - tr * 0.035) * soft
                    br = 1.5 * (1.0 - tr / 14.0) ** 2 * w / soft
                    rs2 = int(3.0 * sg) + 1
                    ix = int(px)
                    iy = int(py)
                    for yy in range(iy - rs2, iy + rs2 + 1):
                        if yy < 0 or yy >= H:
                            continue
                        for xx in range(ix - rs2, ix + rs2 + 1):
                            if xx < 0 or xx >= W:
                                continue
                            d2 = (xx + 0.5 - px) ** 2 + (yy + 0.5 - py) ** 2
                            g = exp(-d2 / (2.0 * sg * sg)) * br
                            out[yy, xx, 0] += g
                            out[yy, xx, 1] += g * 0.92
                            out[yy, xx, 2] += g * 0.85


def push_amount(t):
    """0..1: how hard the two sheets are pressing towards each other at stage time t (seconds)."""
    x = 0.5 - 0.5 * cos(2.0 * pi * (t - 0.25) / 1.9)
    return float(x**1.6) if t > 0.25 else 0.0


def render(W, H, t, frame, zoom=1.0, gblur=0.0, exposure=1.0, focus_xy=None, push=None):
    out = np.zeros((H, W, 3), np.float32)
    fx, fy = (W * 0.5, H * 900.0 / 1920.0) if focus_xy is None else focus_xy
    p = push_amount(t) if push is None else push
    atoms = build_atoms(t, p)
    s = H / 1920.0
    render_atoms_k(W, H, out, atoms, t, frame, zoom, fx, fy, gblur * s)
    sparkle(W, H, out, atoms, t, frame, zoom, fx, fy, gblur * s)
    return tonemap(out, exposure)
