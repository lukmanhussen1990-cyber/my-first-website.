"""The microscopic stages: two rough surfaces facing each other across a dark gap.

Geometry (units: 1 = the gap being measured):
  * bottom = an endless floor (person B), seen from a low camera
  * top    = the underside of a huge ball (person A) hanging one gap above the floor
Both carry a procedural relief that is really ray-marched (so bumps hide each other and
the outline is bumpy), lit with a key light plus a low back light, and focus falls off
with distance (depth of field is built into the textures, see noise.fbm2).
"""
from math import atan2, cos, exp, floor, pi, sin, sqrt

import numpy as np
from numba import njit, prange

from .noise import fbm2, gnoise2, hash2, hash2f, smoothstep, voronoi2

# screen layout, in half-screen-heights measured from the focus point (centre of the gap)
VT = -0.205  # where the top surface ends
VB = 0.205  # where the measuring line meets the bottom surface
VH = -0.12  # eye level (horizon)
ZB = 1.0 / (VB - VT)  # distance from the camera to the measured column
HC = (VB - VH) * ZB  # camera height above the floor


@njit(fastmath=True, inline="always")
def _vis(size, lam):
    """How visible a feature of this size is, given focus blur (lam = px per unit / blur px)."""
    return smoothstep(0.7, 2.6, size * lam)


@njit(fastmath=True)
def balls(x, y, jitter, rmin, rmax, bmin, bmax, tm, wob, seed):
    """Upper surface of a layer of spheres scattered on a jittered grid (true union, so
    neighbours meet in clean creases). Returns (height or -1, sphere id 0..1)."""
    fx0 = floor(x)
    fy0 = floor(y)
    ix = int(fx0)
    iy = int(fy0)
    fx = x - fx0
    fy = y - fy0
    best = -1.0
    bid = 0.0
    for j in range(-1, 2):
        for i in range(-1, 2):
            n = hash2(ix + i + seed, iy + j)
            h1 = (n & 0xFFFF) / 65535.0
            h2 = ((n >> 16) & 0xFFFF) / 65535.0
            hid = ((n * 2654435761) & 0xFFFFFFFF) / 4294967296.0
            cx = i + 0.5 + (h1 - 0.5) * jitter - fx
            cy = j + 0.5 + (h2 - 0.5) * jitter - fy
            if wob > 0.0:
                cx += wob * sin(tm * (3.0 + 2.5 * hid) + 6.2832 * h1)
                cy += wob * cos(tm * (2.6 + 2.9 * h2) + 6.2832 * hid)
            r = rmin + (rmax - rmin) * hid
            q = r * r - cx * cx - cy * cy
            if q > 0.0:
                hg = bmin + (bmax - bmin) * h2 + sqrt(q)
                if hg > best:
                    best = hg
                    bid = hid
    return best, bid


@njit(fastmath=True)
def height(stage, surf, a, b, tm, ppu, blur, detail):
    """Relief of a surface at (a, b). Returns (height, tint, cavity, alt-colour mix)."""
    sd = 11.0 if surf == 0 else 47.0
    lam = ppu / (blur + 1e-6)
    h = 0.0
    tint = 1.0
    cav = 1.0
    alt = 0.0
    if stage == 2:
        # ---------------- palm ridges with sweat pores
        wx = a + 0.38 * gnoise2(a * 0.33 + sd, b * 0.33)
        wz = b + 0.38 * gnoise2(a * 0.33 + 5.2, b * 0.33 + sd)
        ang = 0.62 if surf == 0 else 1.32
        ca = cos(ang)
        sa = sin(ang)
        s = (wx * ca + wz * sa) / 0.72
        r = (-wx * sa + wz * ca) / 0.72
        s0 = floor(s)
        fs = s - s0
        prof = sin(pi * fs)
        v2 = _vis(0.72, lam)
        v1 = _vis(0.2, lam)
        shape = prof ** (0.5 + 0.5 * (1.0 - v1))
        h = 0.15 * shape * v2 + 0.08 * (1.0 - v2)
        isd = int(s0)
        rr = r * 1.15 + hash2f(isd, 7) * 5.0
        r0 = floor(rr)
        fr = rr - r0 - 0.5 + (hash2f(isd, int(r0)) - 0.5) * 0.4
        d2 = (fs - 0.5) ** 2 + (fr / 1.15) ** 2
        pit = exp(-d2 / 0.0042) * _vis(0.12, lam)
        h -= 0.045 * pit
        tint = 0.74 + 0.26 * shape - 0.30 * pit
        cav = 0.22 + 0.78 * shape ** 0.8
        if detail:
            h += 0.040 * fbm2(a * 5.5 + sd, b * 5.5, 5, ppu / 5.5, blur)
            f1, f2, cid, vx, vy = voronoi2(a * 6.0 + sd, b * 6.0, 0.9)
            vv = _vis(0.16, lam)
            fl = smoothstep(0.0, 0.16, f2 - f1)
            h += 0.006 * fl * vv
            tint *= 1.0 - 0.07 * (1.0 - fl) * vv + 0.06 * (cid - 0.5) * vv
    elif stage == 3:
        # ---------------- flat skin cells: pillow-like plates with dark seams
        f1, f2, cid, vx, vy = voronoi2(a / 1.05 + sd, b / 1.05 + sd * 0.3, 0.82)
        edge = f2 - f1
        ew = sqrt(0.16 * 0.16 + (1.0 / (lam * 1.05 + 1e-6)) ** 2)
        plate = smoothstep(0.0, ew, edge)
        pil = plate ** 0.6
        an = 6.2832 * cid
        tilt = (vx * cos(an) + vy * sin(an)) * 0.07
        h = (0.11 + 0.05 * (cid - 0.5) + tilt) * pil
        tint = 0.70 + 0.40 * cid
        cav = 0.12 + 0.88 * plate
        alt = smoothstep(0.5, 0.95, cid) * 0.6
        if detail:
            h += 0.030 * fbm2(a * 4.2 + sd, b * 4.2, 5, ppu / 4.2, blur) * plate
            wr = gnoise2(a * 8.0 + sd + vx * 3.0, b * 3.0) * _vis(0.12, lam)
            h += 0.012 * wr * plate
            tint *= 1.0 + 0.12 * fbm2(a * 2.0 + 3.0, b * 2.0 + sd, 3, ppu / 2.0, blur)
            # the cell's nucleus shows through as a soft darker spot
            nd = sqrt(vx * vx + vy * vy)
            tint *= 1.0 - 0.16 * (1.0 - smoothstep(0.05, 0.22, nd)) * _vis(0.3, lam)
    elif stage == 4:
        # ---------------- the bumpy, folded surface of one cell
        n1 = gnoise2(a * 0.85 + sd, b * 0.85 + tm * 0.03)
        n2 = gnoise2(a * 1.9 + 3.0, b * 1.9 + sd)
        r1 = 1.0 - abs(n1)
        r2 = 1.0 - abs(n2)
        h = 0.15 * r1 * r1 * _vis(1.1, lam) + 0.06 * r2 * r2 * _vis(0.5, lam)
        hb, bid = balls(a * 2.6 + sd, b * 2.6, 0.8, 0.26, 0.46, -0.30, -0.12, tm, 0.0, 3)
        bv = _vis(0.25, lam)
        if hb > 0.0:
            h += 0.11 * hb * bv
            alt = smoothstep(0.0, 0.2, hb) * 0.7 * bv
        tint = 0.72 + 0.9 * h
        cav = smoothstep(0.0, 0.2, h) * 0.8 + 0.2
        if detail:
            h += 0.040 * fbm2(a * 6.0 + sd, b * 6.0, 5, ppu / 6.0, blur)
            g1, g2, gid, wx, wy = voronoi2(a * 9.0 + sd, b * 9.0, 0.9)
            q = 1.0 - (g1 / 0.42) ** 2
            if q > 0.0:
                h += 0.012 * sqrt(q) * _vis(0.1, lam)
    elif stage == 5:
        # ---------------- cell membrane: a rippling sheet of beads with a few big proteins
        und = 0.085 * gnoise2(a * 0.33 + tm * 0.22 + sd, b * 0.33 - tm * 0.17)
        und += 0.04 * gnoise2(a * 0.8 - tm * 0.3, b * 0.8 + sd + tm * 0.21)
        g1, g2, pid, px_, py_ = voronoi2(a / 1.7 + sd * 0.7, b / 1.7 + 3.3, 0.8)
        dome = 0.0
        if pid > 0.5:
            pr = 0.20 + 0.16 * hash2f(int(pid * 9973.0), 5)
            q = 1.0 - (g1 / pr) ** 2
            if q > 0.0:
                dome = sqrt(q)
        hb, bid = balls(a / 0.17 + sd, b / 0.17, 0.42, 0.50, 0.62, 0.0, 0.10, tm, 0.06, 1)
        bv = _vis(0.17, lam)
        bead = hb / 0.66 if hb > 0.0 else 0.0
        dm = smoothstep(0.0, 0.25, dome)
        h = und + 0.075 * (bead * bv + 0.6 * (1.0 - bv)) * (1.0 - dm) + 0.27 * dome
        if dome > 0.0:
            h += 0.03 * gnoise2(a * 5.0 + sd, b * 5.0) * dm * _vis(0.2, lam)
        tint = 0.62 + 0.40 * bead * bv + 0.16 * bid
        tint = tint * (1.0 - dm) + (0.8 + 0.3 * dome) * dm
        cav = (0.18 + 0.82 * bead * bv + 0.5 * (1.0 - bv)) * (1.0 - dm) + dm * (0.3 + 0.7 * dome)
        if cav > 1.0:
            cav = 1.0
        alt = dm
    else:
        # ---------------- molecules: packed, jiggling balls of different sizes
        und = 0.06 * gnoise2(a * 0.4 + sd + tm * 0.2, b * 0.4)
        h1, id1 = balls(a / 0.56 + sd, b / 0.56, 0.6, 0.36, 0.56, -0.12, 0.10, tm, 0.05, 2)
        h2, id2 = balls(a / 0.31 + 9.0, b / 0.31 + sd, 0.7, 0.34, 0.50, -0.16, 0.04, tm, 0.07, 5)
        s1 = h1 * 0.56
        s2 = h2 * 0.31 - 0.03
        v = _vis(0.3, lam)
        if s1 >= s2:
            hh = s1
            idc = id1
        else:
            hh = s2
            idc = id2 * 0.731 + 0.19
            idc -= floor(idc)
        if hh < -0.06:
            hh = -0.06
        h = hh * v + 0.12 * (1.0 - v) + und
        tint = 0.78 + 0.30 * idc
        cav = smoothstep(-0.06, 0.12, hh) * 0.86 + 0.14
        alt = smoothstep(0.50, 0.56, idc) - smoothstep(0.84, 0.88, idc) * 0.4
    return h, tint, cav, alt


@njit(fastmath=True)
def _lit(stage, surf, a, b, tm, ppu, bl, ea, eb, n0x, n0y, n0z, tax, tay, taz, tbx, tby, tbz, vx, vy, vz, P):
    """Shade one surface point: relief normal, a short shadow march, then the lights."""
    h0, tint, cav, alt = height(stage, surf, a, b, tm, ppu, bl, True)
    h1 = height(stage, surf, a + ea, b, tm, ppu, bl, True)[0]
    h2 = height(stage, surf, a, b + eb, tm, ppu, bl, True)[0]
    ga = (h1 - h0) / ea
    gb = (h2 - h0) / eb
    nx = n0x - ga * tax - gb * tbx
    ny = n0y - ga * tay - gb * tby
    nz = n0z - ga * taz - gb * tbz
    inv = 1.0 / sqrt(nx * nx + ny * ny + nz * nz)
    nx *= inv
    ny *= inv
    nz *= inv
    if surf == 0:
        lx = -0.60
        ly = 0.42
        lz = -0.68
        rx = 0.22
        ry = 0.24
        rz = 0.945
    else:
        lx = -0.36
        ly = -0.24
        lz = -0.90
        rx = 0.20
        ry = -0.16
        rz = 0.966
    # shadows cast by the relief itself
    la = lx * tax + ly * tay + lz * taz
    lb = lx * tbx + ly * tby + lz * tbz
    ln = lx * n0x + ly * n0y + lz * n0z
    hm = height(stage, surf, a, b, tm, ppu, bl, False)[0]
    sh = 1.0
    d = 0.045
    for _ in range(4):
        hs = height(stage, surf, a + la * d, b + lb * d, tm, ppu, bl, False)[0]
        over = hs - (hm + ln * d)
        if over > 0.0:
            sv = 1.0 - over / (0.015 + 0.30 * d)
            if sv < sh:
                sh = sv
        d *= 2.1
    if sh < 0.0:
        sh = 0.0
    sh = 0.12 + 0.88 * sh

    ar = (P[0 + 6 * (1 - surf)] + (P[3 + 6 * (1 - surf)] - P[0 + 6 * (1 - surf)]) * alt) * tint
    ag = (P[1 + 6 * (1 - surf)] + (P[4 + 6 * (1 - surf)] - P[1 + 6 * (1 - surf)]) * alt) * tint
    ab = (P[2 + 6 * (1 - surf)] + (P[5 + 6 * (1 - surf)] - P[2 + 6 * (1 - surf)]) * alt) * tint

    ndl = nx * lx + ny * ly + nz * lz
    wrap = (ndl + 0.25) / 1.25
    if wrap < 0.0:
        wrap = 0.0
    diff = (wrap ** 1.3) * sh
    ao = 0.25 + 0.75 * cav
    ndr = nx * rx + ny * ry + nz * rz
    rd = ndr if ndr > 0.0 else 0.0
    ndv = nx * vx + ny * vy + nz * vz
    if ndv < 0.0:
        ndv = 0.0
    fres = (1.0 - ndv) ** 3
    hx = lx + vx
    hy = ly + vy
    hz = lz + vz
    inv = 1.0 / sqrt(hx * hx + hy * hy + hz * hz + 1e-9)
    ndh = (nx * hx + ny * hy + nz * hz) * inv
    if ndh < 0.0:
        ndh = 0.0
    spec = (ndh ** P[16]) * P[15] * ao * sh
    hx = rx + vx
    hy = ry + vy
    hz = rz + vz
    inv = 1.0 / sqrt(hx * hx + hy * hy + hz * hz + 1e-9)
    ndh = (nx * hx + ny * hy + nz * hz) * inv
    if ndh < 0.0:
        ndh = 0.0
    specr = (ndh ** (P[16] * 0.5)) * P[15] * 1.5 * ao
    band = exp(-((ndl / 0.42) ** 2)) * P[18] * (0.3 + 0.7 * sh)
    rim = (rd * 0.40 + fres * rd * 1.2) * (0.35 + 0.65 * ao)
    amb = P[26] * ao
    em = P[19]
    r = ar * (P[20] * diff * ao + amb + P[23] * rim + 0.30 * band + em) + P[20] * spec + P[23] * specr
    g = ag * (P[21] * diff * ao + amb * 0.92 + P[24] * rim + 0.07 * band + em * 0.8) + P[21] * spec + P[24] * specr
    bb = ab * (P[22] * diff * ao + amb * 1.08 + P[25] * rim + 0.04 * band + em * 0.7) + P[22] * spec + P[25] * specr
    return r, g, bb


@njit(parallel=True, fastmath=True, cache=True)
def render_micro(W, H, out, depth, stage, tm, zoom, fx, fy, gblur, P, drift):
    """Draw one micro stage into out (linear RGB) and depth (distance; 1e6 = empty gap).

    zoom   1 = normal framing; >1 pushes into the gap, <1 pulls back
    fx,fy  focus point in pixels
    gblur  extra blur (pixels) used during zoom transitions
    drift  [floor dx, floor dz, top da, top db] slow texture travel
    """
    S = H * 0.5
    R = P[12]
    hmax = P[13]
    fogk = P[14]
    dofA = P[17] * H / 1920.0
    cyc = 1.0 + R
    NS = 16
    zq = sqrt(zoom)
    for y in prange(H):
        for x in range(W):
            u = (x + 0.5 - fx) / (S * zoom)
            v = (y + 0.5 - fy) / (S * zoom)
            dx = u
            dy = -(v - VH)
            dz = 1.0
            inv = 1.0 / sqrt(dx * dx + dy * dy + dz * dz)
            dx *= inv
            dy *= inv
            dz *= inv
            cr = 0.0
            cg = 0.0
            cb = 0.0
            ta = 0.0
            dep = 1e6

            # ------------------------------------------------ top: underside of the ball
            ocy = HC - cyc
            ocz = -ZB
            bq = ocy * dy + ocz * dz
            oc2 = ocy * ocy + ocz * ocz
            disc = bq * bq - (oc2 - (R + hmax) ** 2)
            if disc > 0.0:
                sq = sqrt(disc)
                t0 = -bq - sq
                t1 = -bq + sq
                if t0 < 0.02:
                    t0 = 0.02
                d2 = bq * bq - (oc2 - (R - 0.08) ** 2)
                if d2 > 0.0:
                    ti = -bq - sqrt(d2)
                    if ti > t0:
                        t1 = ti
                if t1 > t0:
                    prev_t = t0
                    hit_t = -1.0
                    min_c = 1e9
                    min_t = t0
                    for i in range(NS + 1):
                        tt = t0 + (t1 - t0) * i / NS
                        wx = dx * tt
                        wy = HC + dy * tt - cyc
                        wz = dz * tt - ZB
                        rl = sqrt(wx * wx + wy * wy + wz * wz)
                        a = R * atan2(wx, -wy) + drift[2]
                        b = R * atan2(wz, -wy) + drift[3]
                        zd = tt * dz
                        ppu = S * zoom / zd
                        bl = sqrt(gblur * gblur + (dofA * abs(1.0 - ZB / zd) * zq) ** 2 + 1.0)
                        c = rl - R - height(stage, 1, a, b, tm, ppu, bl, False)[0]
                        if c < min_c:
                            min_c = c
                            min_t = tt
                        if c < 0.0:
                            lo = prev_t
                            hi = tt
                            for _ in range(6):
                                mid = 0.5 * (lo + hi)
                                wx = dx * mid
                                wy = HC + dy * mid - cyc
                                wz = dz * mid - ZB
                                rl = sqrt(wx * wx + wy * wy + wz * wz)
                                a = R * atan2(wx, -wy) + drift[2]
                                b = R * atan2(wz, -wy) + drift[3]
                                if rl - R - height(stage, 1, a, b, tm, ppu, bl, False)[0] < 0.0:
                                    hi = mid
                                else:
                                    lo = mid
                            hit_t = 0.5 * (lo + hi)
                            break
                        prev_t = tt
                    alpha = 0.0
                    if hit_t > 0.0:
                        alpha = 1.0
                        ts = hit_t
                    else:
                        ts = min_t
                        zd = ts * dz
                        ppu = S * zoom / zd
                        bl = sqrt(gblur * gblur + (dofA * abs(1.0 - ZB / zd) * zq) ** 2 + 1.0)
                        alpha = 1.0 - smoothstep(0.0, 1.0, min_c * ppu / bl)
                    if alpha > 0.0:
                        wx = dx * ts
                        wy = HC + dy * ts - cyc
                        wz = dz * ts - ZB
                        rl = sqrt(wx * wx + wy * wy + wz * wz)
                        wx /= rl
                        wy /= rl
                        wz /= rl
                        a = R * atan2(wx, -wy) + drift[2]
                        b = R * atan2(wz, -wy) + drift[3]
                        zd = ts * dz
                        ppu = S * zoom / zd
                        bl = sqrt(gblur * gblur + (dofA * abs(1.0 - ZB / zd) * zq) ** 2 + 1.0)
                        e = 1.2 / ppu
                        if e < 0.004:
                            e = 0.004
                        tl = sqrt(wx * wx + wy * wy) + 1e-9
                        tl2 = sqrt(wy * wy + wz * wz) + 1e-9
                        r, g, bb = _lit(
                            stage, 1, a, b, tm, ppu, bl, e, e,
                            wx, wy, wz, -wy / tl, wx / tl, 0.0, 0.0, wz / tl2, -wy / tl2,
                            -dx, -dy, -dz, P,
                        )
                        fall = exp(-max(0.0, zd - ZB) * fogk * 1.5)
                        cr = r * fall * alpha
                        cg = g * fall * alpha
                        cb = bb * fall * alpha
                        ta = alpha
                        dep = zd

            # ------------------------------------------------ bottom: the floor
            if ta < 0.999 and dy < -1e-4:
                t0 = (HC - hmax) / (-dy)
                t1 = (HC + 0.08) / (-dy)
                if t0 < 0.02:
                    t0 = 0.02
                fog0 = exp(-max(0.0, t0 * dz - ZB) * fogk)
                if fog0 > 0.004:
                    prev_t = t0
                    hit_t = t1
                    for i in range(NS + 1):
                        tt = t0 + (t1 - t0) * i / NS
                        zd = tt * dz
                        ppu = S * zoom / zd
                        bl = sqrt(gblur * gblur + (dofA * abs(1.0 - ZB / zd) * zq) ** 2 + 1.0)
                        hh = height(stage, 0, dx * tt + drift[0], zd + drift[1], tm, ppu, bl, False)[0]
                        if HC + dy * tt - hh < 0.0:
                            lo = prev_t
                            hi = tt
                            for _ in range(6):
                                mid = 0.5 * (lo + hi)
                                hh = height(stage, 0, dx * mid + drift[0], dz * mid + drift[1], tm, ppu, bl, False)[0]
                                if HC + dy * mid - hh < 0.0:
                                    hi = mid
                                else:
                                    lo = mid
                            hit_t = 0.5 * (lo + hi)
                            break
                        prev_t = tt
                    ts = hit_t
                    a = dx * ts + drift[0]
                    b = dz * ts + drift[1]
                    zd = ts * dz
                    ppu = S * zoom / zd
                    bl = sqrt(gblur * gblur + (dofA * abs(1.0 - ZB / zd) * zq) ** 2 + 1.0)
                    e = 1.2 / ppu
                    if e < 0.004:
                        e = 0.004
                    ez = e * min(5.0, 1.0 / (-dy + 0.08))
                    r, g, bb = _lit(
                        stage, 0, a, b, tm, ppu, bl, e, ez,
                        0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
                        -dx, -dy, -dz, P,
                    )
                    fog = exp(-max(0.0, zd - ZB * 0.92) * fogk)
                    k = fog * (1.0 - ta)
                    cr += r * k
                    cg += g * k
                    cb += bb * k
                    if ta < 0.5:
                        dep = zd
            out[y, x, 0] = cr
            out[y, x, 1] = cg
            out[y, x, 2] = cb
            depth[y, x] = dep


def render(W, H, stage, tm, zoom=1.0, gblur=0.0, drift=None, exposure=1.0, focus_xy=None):
    """One micro-stage frame, display-referred float32 RGB."""
    from . import post

    out = np.zeros((H, W, 3), np.float32)
    depth = np.zeros((H, W), np.float32)
    P = palette(stage)
    if drift is None:
        drift = np.zeros(4)
    fx, fy = (W * 0.5, H * 900.0 / 1920.0) if focus_xy is None else focus_xy
    render_micro(W, H, out, depth, stage, tm, zoom, fx, fy, gblur, P, np.asarray(drift, float))
    s = H / 1920.0
    out = post.depth_of_field(out, depth, ZB, P[17] * s * np.sqrt(zoom), 44.0 * s, np.zeros(3, np.float32))
    return post.tonemap(out, exposure)


def palette(stage):
    """Colours / material for each micro stage.
    0:3 top colour, 3:6 top accent, 6:9 bottom colour, 9:12 bottom accent,
    12 ball radius, 13 relief height, 14 distance fade, 15 shine, 16 gloss, 17 focus blur,
    18 skin glow, 19 self-glow, 20:23 key light, 23:26 back light, 26 ambient."""
    P = np.zeros(32)
    if stage == 2:
        P[0:3] = (0.93, 0.50, 0.28)
        P[3:6] = (0.93, 0.50, 0.28)
        P[6:9] = (0.84, 0.44, 0.46)
        P[9:12] = (0.84, 0.44, 0.46)
        P[12:20] = (5.0, 0.24, 0.62, 0.10, 24.0, 26.0, 1.0, 0.012)
    elif stage == 3:
        P[0:3] = (0.95, 0.54, 0.30)
        P[3:6] = (1.0, 0.72, 0.42)
        P[6:9] = (0.84, 0.44, 0.52)
        P[9:12] = (0.96, 0.64, 0.70)
        P[12:20] = (7.0, 0.30, 0.56, 0.16, 30.0, 28.0, 1.0, 0.014)
    elif stage == 4:
        P[0:3] = (1.0, 0.48, 0.20)
        P[3:6] = (1.0, 0.72, 0.30)
        P[6:9] = (0.90, 0.33, 0.52)
        P[9:12] = (1.0, 0.58, 0.76)
        P[12:20] = (6.0, 0.40, 0.52, 0.34, 40.0, 28.0, 1.2, 0.022)
    elif stage == 5:
        P[0:3] = (1.0, 0.52, 0.16)
        P[3:6] = (1.0, 0.82, 0.42)
        P[6:9] = (0.86, 0.30, 0.66)
        P[9:12] = (0.46, 0.54, 1.0)
        P[12:20] = (8.0, 0.44, 0.50, 0.44, 50.0, 26.0, 1.2, 0.035)
    else:
        P[0:3] = (1.0, 0.54, 0.17)
        P[3:6] = (1.0, 0.86, 0.52)
        P[6:9] = (0.90, 0.30, 0.64)
        P[9:12] = (0.42, 0.52, 1.0)
        P[12:20] = (5.0, 0.42, 0.48, 0.62, 64.0, 26.0, 1.3, 0.05)
    P[20:23] = (0.78, 0.68, 0.58)
    P[23:26] = (0.95, 0.62, 0.38)
    P[26] = 0.030
    return P
