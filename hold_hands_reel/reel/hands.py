"""Procedural 3D hands.

A hand is a skeleton of 22 tapered capsules (forearm, palm, fingers, thumb).
The capsules are blended into one smooth signed-distance field and ray-marched
with skin shading: wrap lighting, soft shadows, ambient occlusion, a fake
sub-surface glow, nails, palm creases and (when the camera is close enough)
fingerprint ridges.  Units are centimetres.
"""
from math import acos, atan2, cos, exp, pi, sin, sqrt

import numpy as np
from numba import njit, prange

from .noise import gnoise2, gnoise3, smoothstep

NCAP = 22

# knuckle (MCP) positions in the hand's own frame: x = towards the fingers,
# y = back of the hand, z = thumb side.  index, middle, ring, pinky.
F_MCP = np.array([[9.0, 0.0, 2.85], [9.4, 0.05, 0.95], [9.0, 0.0, -0.95], [8.2, -0.1, -2.7]])
F_LEN = np.array([[4.3, 2.5, 2.2], [4.7, 2.9, 2.3], [4.3, 2.7, 2.3], [3.4, 2.0, 2.0]])
F_RAD = np.array(
    [[0.86, 0.78, 0.71, 0.63], [0.88, 0.80, 0.72, 0.64], [0.82, 0.75, 0.68, 0.61], [0.73, 0.67, 0.61, 0.55]]
)


def make_pose(mcp, pip, dip, splay, thumb):
    """Finger angles in degrees: mcp/pip/dip/splay = 4 values (index..pinky) or one number.
    thumb = three direction vectors (base bone, middle bone, tip bone) in the hand's own frame."""
    mcp = np.broadcast_to(np.asarray(mcp, float), (4,))
    pip = np.broadcast_to(np.asarray(pip, float), (4,))
    dip = np.broadcast_to(np.asarray(dip, float), (4,))
    splay = np.broadcast_to(np.asarray(splay, float), (4,))
    flex = np.stack([mcp, pip, dip], axis=1).ravel()
    th = np.asarray(thumb, float).reshape(3, 3)
    th = th / np.linalg.norm(th, axis=1, keepdims=True)
    return np.concatenate([np.radians(flex), np.radians(splay), th.ravel()])


def frame_from(forward, dorsal_hint, thumb_sign=1.0):
    """Orthonormal hand frame from a finger direction and a rough 'back of hand' direction."""
    ex = np.asarray(forward, float)
    ex = ex / np.linalg.norm(ex)
    ey = np.asarray(dorsal_hint, float)
    ey = ey - ex * np.dot(ey, ex)
    ey = ey / np.linalg.norm(ey)
    ez = np.cross(ex, ey) * thumb_sign
    return ex, ey, ez


def build_hand(o, ex, ey, ez, P):
    """Returns capsules C(22,9), dorsal vectors D(22,3), finger bounds FB(5,4), hand bound HB(4), frame F(4,3)."""
    o = np.asarray(o, float)
    C = np.zeros((NCAP, 9))
    D = np.zeros((NCAP, 3))

    def W(p):
        return o + p[0] * ex + p[1] * ey + p[2] * ez

    def Wd(v):
        return v[0] * ex + v[1] * ey + v[2] * ez

    def put(i, a, b, ra, rb, d):
        a = W(a)
        b = W(b)
        C[i, 0:3] = a
        C[i, 3:6] = b
        C[i, 6] = ra
        C[i, 7] = rb
        C[i, 8] = 1.0 / max(1e-9, float(((b - a) ** 2).sum()))
        D[i] = Wd(d)

    up = (0.0, 1.0, 0.0)
    # forearm: two capsules side by side -> oval wrist
    put(0, (1.2, 0.0, 1.15), (-40.0, 0.5, 1.9), 1.72, 2.9, up)
    put(1, (1.2, 0.0, -1.15), (-40.0, 0.5, -1.9), 1.72, 2.9, up)
    # palm: one thick bar per finger
    for f in range(4):
        m = F_MCP[f]
        put(2 + f, (1.0, 0.0, m[2] * 0.6), m, 1.22, 1.04, up)
    # thumb: three bones given directly as directions
    c = np.array([1.7, -0.75, 2.2])
    tdir = P[16:25].reshape(3, 3)
    tdir = tdir / np.linalg.norm(tdir, axis=1, keepdims=True)
    dm, dp, dd = tdir[0], tdir[1], tdir[2]
    ref = np.array([-0.2, 0.55, 0.8])  # roughly where the thumb nail faces

    def nail_side(d, prev):
        r = ref - d * np.dot(ref, d)
        curl = -(d - prev * np.dot(d, prev))
        v = r / np.linalg.norm(r) + 3.0 * curl
        v = v - d * np.dot(v, d)
        return v / np.linalg.norm(v)

    j1 = c + 4.2 * dm
    put(6, c, j1, 1.5, 1.04, nail_side(dm, dm))
    j2 = j1 + 3.3 * dp
    put(20, j1, j2, 1.0, 0.88, nail_side(dp, dm))
    j3 = j2 + (2.8 - 0.74) * dd
    put(21, j2, j3, 0.88, 0.74, nail_side(dd, dp))
    # fleshy edge under the pinky
    put(7, (1.2, -0.35, -2.5), (6.6, -0.3, -3.15), 1.2, 0.98, up)
    # fingers
    for f in range(4):
        sp = P[12 + f]
        th = 0.0
        p = F_MCP[f].copy()
        for s in range(3):
            th += P[3 * f + s]
            d = np.array([cos(th) * cos(sp), -sin(th), cos(th) * sin(sp)])
            dr = np.array([sin(th) * cos(sp), cos(th), sin(th) * sin(sp)])
            L = F_LEN[f, s] - (F_RAD[f, 3] if s == 2 else 0.0)
            q = p + L * d
            put(8 + 3 * f + s, p, q, F_RAD[f, s], F_RAD[f, s + 1], dr)
            p = q

    FB = np.zeros((5, 4))
    for f in range(5):
        idx = [8 + 3 * f + s for s in range(3)] if f < 4 else [20, 21]
        pts = np.concatenate([C[idx, 0:3], C[idx, 3:6]])
        rr = np.concatenate([C[idx, 6], C[idx, 7]])
        cen = pts.mean(0)
        FB[f, :3] = cen
        FB[f, 3] = (np.linalg.norm(pts - cen, axis=1) + rr).max()
    idx = list(range(2, NCAP))
    pts = np.concatenate([C[idx, 0:3], C[idx, 3:6]])
    rr = np.concatenate([C[idx, 6], C[idx, 7]])
    cen = pts.mean(0)
    HB = np.zeros(4)
    HB[:3] = cen
    HB[3] = (np.linalg.norm(pts - cen, axis=1) + rr).max()
    F = np.stack([o, ex, ey, ez])
    return C, D, FB, HB, F


# ----------------------------------------------------------------------------
# distance field
# ----------------------------------------------------------------------------
@njit(fastmath=True, inline="always")
def smin(a, b, k):
    h = k - abs(a - b)
    m = a if a < b else b
    if h <= 0.0:
        return m
    return m - h * h * 0.25 / k


@njit(fastmath=True, inline="always")
def capd(px, py, pz, C, i):
    ax = C[i, 0]
    ay = C[i, 1]
    az = C[i, 2]
    bax = C[i, 3] - ax
    bay = C[i, 4] - ay
    baz = C[i, 5] - az
    pax = px - ax
    pay = py - ay
    paz = pz - az
    h = (pax * bax + pay * bay + paz * baz) * C[i, 8]
    if h < 0.0:
        h = 0.0
    elif h > 1.0:
        h = 1.0
    dx = pax - bax * h
    dy = pay - bay * h
    dz = paz - baz * h
    return sqrt(dx * dx + dy * dy + dz * dz) - (C[i, 6] + (C[i, 7] - C[i, 6]) * h)


@njit(fastmath=True)
def sdf_hand(px, py, pz, C, FB, HB):
    d0 = capd(px, py, pz, C, 0)
    d1 = capd(px, py, pz, C, 1)
    dp = smin(d0, d1, 1.2)
    dx = px - HB[0]
    dy = py - HB[1]
    dz = pz - HB[2]
    db = sqrt(dx * dx + dy * dy + dz * dz) - HB[3]
    if db > 1.5:
        return dp if dp < db else db
    for i in range(2, 8):
        dp = smin(dp, capd(px, py, pz, C, i), 0.75)
    d = dp
    for f in range(5):
        dx = px - FB[f, 0]
        dy = py - FB[f, 1]
        dz = pz - FB[f, 2]
        dfb = sqrt(dx * dx + dy * dy + dz * dz) - FB[f, 3]
        if dfb > d + 0.5:
            continue
        s0 = 8 + 3 * f
        df = capd(px, py, pz, C, s0)
        df = smin(df, capd(px, py, pz, C, s0 + 1), 0.12)
        if f < 4:
            df = smin(df, capd(px, py, pz, C, s0 + 2), 0.12)
        dn = smin(dp, df, 0.5)
        if dn < d:
            d = dn
    return d


@njit(fastmath=True, inline="always")
def _bow(qx, qz, x0, z0, x1, z1, bow):
    ex = x1 - x0
    ez = z1 - z0
    L2 = ex * ex + ez * ez
    s = ((qx - x0) * ex + (qz - z0) * ez) / L2
    if s < 0.0:
        s = 0.0
    elif s > 1.0:
        s = 1.0
    L = sqrt(L2)
    off = bow * 4.0 * s * (1.0 - s)
    cx = x0 + ex * s - ez / L * off
    cz = z0 + ez * s + ex / L * off
    return sqrt((qx - cx) ** 2 + (qz - cz) ** 2)


@njit(fastmath=True)
def hand_detail(px, py, pz, nx, ny, nz, C, D, F, fp, ridge_amp):
    """Fine surface detail at a point on a hand.

    Returns (height, crease, nail, blush, palmar, nail_tip).
    fp = size of one pixel at this point (cm) so detail fades instead of aliasing.
    """
    best = 1e9
    bi = 0
    bh = 0.0
    brx = 0.0
    bry = 1.0
    brz = 0.0
    for i in range(NCAP):
        ax = C[i, 0]
        ay = C[i, 1]
        az = C[i, 2]
        bax = C[i, 3] - ax
        bay = C[i, 4] - ay
        baz = C[i, 5] - az
        pax = px - ax
        pay = py - ay
        paz = pz - az
        hraw = (pax * bax + pay * bay + paz * baz) * C[i, 8]
        h = hraw
        if h < 0.0:
            h = 0.0
        elif h > 1.0:
            h = 1.0
        dx = pax - bax * h
        dy = pay - bay * h
        dz = paz - baz * h
        ln = sqrt(dx * dx + dy * dy + dz * dz)
        dist = ln - (C[i, 6] + (C[i, 7] - C[i, 6]) * h)
        if dist < best:
            best = dist
            bi = i
            bh = hraw
            inv = 1.0 / (ln + 1e-9)
            brx = dx * inv
            bry = dy * inv
            brz = dz * inv
    bL = 1.0 / sqrt(C[bi, 8])
    dorsN = nx * D[bi, 0] + ny * D[bi, 1] + nz * D[bi, 2]
    dorsR = brx * D[bi, 0] + bry * D[bi, 1] + brz * D[bi, 2]
    rx = px - F[0, 0]
    ry = py - F[0, 1]
    rz = pz - F[0, 2]
    qx = rx * F[1, 0] + ry * F[1, 1] + rz * F[1, 2]
    qy = rx * F[2, 0] + ry * F[2, 1] + rz * F[2, 2]
    qz = rx * F[3, 0] + ry * F[3, 1] + rz * F[3, 2]

    palmar = smoothstep(0.15, -0.45, dorsN)
    dorsal = smoothstep(0.2, 0.7, dorsN)
    seg = -1
    if bi >= 8 and bi < 20:
        seg = (bi - 8) % 3
    elif bi == 20:
        seg = 1
    elif bi == 21:
        seg = 2

    height = 0.0
    crease = 0.0
    nail = 0.0
    tipw = 0.0
    blush = 0.0
    s_al = bh * bL

    cw = sqrt(0.04 * 0.04 + (1.3 * fp) ** 2)
    camp = 0.04 / cw
    if seg >= 0:
        sj = abs(s_al)
        if seg < 2:
            e2 = abs((bh - 1.0) * bL)
            if e2 < sj:
                sj = e2
        c1 = exp(-((sj / cw) ** 2)) + 0.55 * exp(-(((sj - 0.14) / cw) ** 2))
        crease += palmar * c1 * camp * 0.8
        kn = 1.0 if seg < 2 else 0.5
        wr = exp(-((sj / 0.30) ** 2)) * (0.5 + 0.5 * cos(2.0 * pi * sj / 0.17)) ** 2
        wf = 1.0 - smoothstep(0.02, 0.06, fp)
        crease += dorsal * wr * 0.16 * kn * wf
        blush += dorsal * exp(-((sj / 0.55) ** 2)) * 0.45 * kn
        blush += palmar * (0.75 if seg == 2 else 0.3)
    else:
        if bi >= 2:
            d1 = _bow(qx, qz, 7.5, -3.7, 8.2, 1.7, 0.6)
            d2 = _bow(qx, qz, 7.1, 3.2, 4.3, -3.0, -0.55)
            d3 = abs(sqrt((qx - 2.6) ** 2 + (qz - 4.3) ** 2) - 4.5)
            if qz > 3.3 or qx > 7.3 or qx < 0.4:
                d3 = 9.0
            pc = exp(-((d1 / cw) ** 2)) + exp(-((d2 / cw) ** 2)) + exp(-((d3 / cw) ** 2))
            crease += palmar * pc * camp * 0.75
            if bi == 6:
                blush += palmar * 0.5
            elif bi == 7:
                blush += palmar * 0.4
            else:
                blush += palmar * 0.12
            # knuckles on the back of the hand
            kd = (qx - 9.0) / 0.9
            blush += dorsal * exp(-kd * kd) * 0.35

    # fingerprint / palm-print ridges (only when the camera is close)
    rf = 1.0 - smoothstep(0.004, 0.012, fp)
    if rf > 0.0 and ridge_amp > 0.0:
        if seg == 2:
            cover = smoothstep(0.55, 0.05, dorsN)  # prints wrap well up the sides of a fingertip
            axx = (C[bi, 3] - C[bi, 0]) / bL
            axy = (C[bi, 4] - C[bi, 1]) / bL
            axz = (C[bi, 5] - C[bi, 2]) / bL
            lx = axy * D[bi, 2] - axz * D[bi, 1]
            ly = axz * D[bi, 0] - axx * D[bi, 2]
            lz = axx * D[bi, 1] - axy * D[bi, 0]
            rad = C[bi, 6] + (C[bi, 7] - C[bi, 6]) * min(max(bh, 0.0), 1.0)
            wl = atan2(brx * lx + bry * ly + brz * lz, -dorsR) * rad
            sa = s_al - 0.55 * bL
            rho = sqrt(sa * sa + (0.8 * wl) ** 2)
            fld = rho + 0.05 * gnoise2(s_al * 4.0 + 3.0, wl * 4.0)
        else:
            cover = palmar
            fld = qz * 0.8 + qx * 0.6 + 0.3 * gnoise2(qx * 0.7 + 3.1, qz * 0.7)
        if cover > 0.0:
            rg = 0.5 + 0.5 * cos(2.0 * pi * fld / 0.045)
            rg = 1.0 - (1.0 - rg) * (1.0 - rg)
            height += ridge_amp * rf * cover * (rg - 0.5)
        # fine criss-cross skin lines everywhere else
        if cover < 1.0:
            sl = 1.0 - abs(gnoise3(qx * 30.0, qy * 30.0, qz * 30.0))
            height -= 0.0016 * rf * (1.0 - cover) * sl * sl * sl

    # skin grain
    w1 = 1.0 - smoothstep(0.012, 0.035, fp)
    if w1 > 0.0:
        height += 0.0022 * w1 * gnoise3(qx * 21.0, qy * 21.0, qz * 21.0)
    w2 = 1.0 - smoothstep(0.035, 0.1, fp)
    if w2 > 0.0:
        height += 0.0022 * w2 * gnoise3(qx * 6.5 + 9.0, qy * 6.5, qz * 6.5)
    height -= 0.011 * crease

    if seg == 2:
        ang = acos(min(max(dorsR, -1.0), 1.0))
        e = ((bh - 0.70) / 0.50) ** 2 + (ang / 1.0) ** 2
        nail = 1.0 - smoothstep(0.78, 1.0, e)
        tipw = smoothstep(1.0, 1.12, bh) * nail
    return height, crease, nail, blush, palmar, tipw


# ----------------------------------------------------------------------------
# renderer
# ----------------------------------------------------------------------------
@njit(fastmath=True, inline="always")
def _scene(px, py, pz, CA, FBA, HBA, CB, FBB, HBB):
    a = sdf_hand(px, py, pz, CA, FBA, HBA)
    b = sdf_hand(px, py, pz, CB, FBB, HBB)
    return a if a < b else b


@njit(parallel=True, fastmath=True, cache=True)
def render_hands(W, H, cam, CA, DA, FBA, HBA, FA, CB, DB, FBB, HBB, FB_, LP, out, depth):
    """cam = [ro(3), right(3), up(3), fwd(3), focal, cx, cy, tmax]
    LP  = [key dir 0:3, key col 3:6, rim dir 6:9, rim col 9:12, amb top 12:15, amb bot 15:18,
           albedo A 18:21, albedo B 21:24, glow strength 24, glow cx 25, glow cy 26, glow radius 27,
           glow col 28:31, ridge amp 31, sss 32, bounce 33, bg top 34:37, bg bot 37:40]
    """
    rox = cam[0]
    roy = cam[1]
    roz = cam[2]
    focal = cam[12]
    tmax = cam[15]
    hh2 = 0.5 * H
    for y in prange(H):
        for x in range(W):
            sx = (x + 0.5 - 0.5 * W) / hh2
            sy = (hh2 - (y + 0.5)) / hh2
            ux = sx - cam[13]
            uy = sy - cam[14]
            dx = cam[9] * focal + cam[3] * ux + cam[6] * uy
            dy = cam[10] * focal + cam[4] * ux + cam[7] * uy
            dz = cam[11] * focal + cam[5] * ux + cam[8] * uy
            inv = 1.0 / sqrt(dx * dx + dy * dy + dz * dz)
            dx *= inv
            dy *= inv
            dz *= inv
            cosv = dx * cam[9] + dy * cam[10] + dz * cam[11]
            t = 0.2
            hit = False
            for _ in range(120):
                px = rox + dx * t
                py = roy + dy * t
                pz = roz + dz * t
                d = _scene(px, py, pz, CA, FBA, HBA, CB, FBB, HBB)
                if d < 0.0006 * t + 0.0004:
                    hit = True
                    break
                t += d * 0.92
                if t > tmax:
                    break
            if not hit:
                g = 0.5 + 0.5 * sy
                r = LP[37] + (LP[34] - LP[37]) * g
                gg = LP[38] + (LP[35] - LP[38]) * g
                b = LP[39] + (LP[36] - LP[39]) * g
                r2 = ((sx - LP[25]) ** 2 + (sy - LP[26]) ** 2) / (LP[27] * LP[27])
                gl = LP[24] * exp(-r2)
                out[y, x, 0] = r + LP[28] * gl
                out[y, x, 1] = gg + LP[29] * gl
                out[y, x, 2] = b + LP[30] * gl
                depth[y, x] = 1e6
                continue

            px = rox + dx * t
            py = roy + dy * t
            pz = roz + dz * t
            fp = t / (focal * hh2)
            e = 0.004 if fp < 0.004 else fp
            n1 = _scene(px + e, py - e, pz - e, CA, FBA, HBA, CB, FBB, HBB)
            n2 = _scene(px - e, py - e, pz + e, CA, FBA, HBA, CB, FBB, HBB)
            n3 = _scene(px - e, py + e, pz - e, CA, FBA, HBA, CB, FBB, HBB)
            n4 = _scene(px + e, py + e, pz + e, CA, FBA, HBA, CB, FBB, HBB)
            nx = n1 - n2 - n3 + n4
            ny = -n1 - n2 + n3 + n4
            nz = -n1 + n2 - n3 + n4
            inv = 1.0 / sqrt(nx * nx + ny * ny + nz * nz + 1e-20)
            nx *= inv
            ny *= inv
            nz *= inv

            dA = sdf_hand(px, py, pz, CA, FBA, HBA)
            dB = sdf_hand(px, py, pz, CB, FBB, HBB)
            isA = dA < dB

            # tangent frame for bump mapping
            if abs(ny) < 0.9:
                t1x = nz
                t1y = 0.0
                t1z = -nx
            else:
                t1x = 0.0
                t1y = -nz
                t1z = ny
            inv = 1.0 / sqrt(t1x * t1x + t1y * t1y + t1z * t1z)
            t1x *= inv
            t1y *= inv
            t1z *= inv
            t2x = ny * t1z - nz * t1y
            t2y = nz * t1x - nx * t1z
            t2z = nx * t1y - ny * t1x
            eb = 0.003 if fp * 1.2 < 0.003 else fp * 1.2
            ra = LP[31]
            gz = -(nx * dx + ny * dy + nz * dz)
            if gz < 0.22:
                gz = 0.22
            fp = fp / gz
            if isA:
                h0, crease, nail, blush, palmar, tipw = hand_detail(px, py, pz, nx, ny, nz, CA, DA, FA, fp, ra)
                h1 = hand_detail(px + t1x * eb, py + t1y * eb, pz + t1z * eb, nx, ny, nz, CA, DA, FA, fp, ra)[0]
                h2 = hand_detail(px + t2x * eb, py + t2y * eb, pz + t2z * eb, nx, ny, nz, CA, DA, FA, fp, ra)[0]
                ar = LP[18]
                ag = LP[19]
                ab = LP[20]
                orr = LP[21]
                og = LP[22]
                ob = LP[23]
                d_o = sdf_hand(px + nx * 0.5, py + ny * 0.5, pz + nz * 0.5, CB, FBB, HBB)
                qn = gnoise3((px - FA[0, 0]) * 0.9, (py - FA[0, 1]) * 0.9, (pz - FA[0, 2]) * 0.9)
            else:
                h0, crease, nail, blush, palmar, tipw = hand_detail(px, py, pz, nx, ny, nz, CB, DB, FB_, fp, ra)
                h1 = hand_detail(px + t1x * eb, py + t1y * eb, pz + t1z * eb, nx, ny, nz, CB, DB, FB_, fp, ra)[0]
                h2 = hand_detail(px + t2x * eb, py + t2y * eb, pz + t2z * eb, nx, ny, nz, CB, DB, FB_, fp, ra)[0]
                ar = LP[21]
                ag = LP[22]
                ab = LP[23]
                orr = LP[18]
                og = LP[19]
                ob = LP[20]
                d_o = sdf_hand(px + nx * 0.5, py + ny * 0.5, pz + nz * 0.5, CA, FBA, HBA)
                qn = gnoise3((px - FB_[0, 0]) * 0.9, (py - FB_[0, 1]) * 0.9, (pz - FB_[0, 2]) * 0.9)
            bs = 1.0 - 0.92 * nail
            g1 = (h1 - h0) / eb * bs
            g2 = (h2 - h0) / eb * bs
            bx = nx - g1 * t1x - g2 * t2x
            by = ny - g1 * t1y - g2 * t2y
            bz = nz - g1 * t1z - g2 * t2z
            inv = 1.0 / sqrt(bx * bx + by * by + bz * bz)
            bx *= inv
            by *= inv
            bz *= inv

            # ---- albedo
            ar = ar + (0.97 - ar) * 0.15 * palmar
            ag = ag + (0.70 - ag) * 0.22 * palmar
            ab = ab + (0.64 - ab) * 0.22 * palmar
            bl = blush if blush < 1.0 else 1.0
            ar = ar + (0.93 - ar) * 0.30 * bl
            ag = ag + (0.42 - ag) * 0.30 * bl
            ab = ab + (0.40 - ab) * 0.30 * bl
            mv = 1.0 + 0.06 * qn
            ar *= mv
            ag *= mv * (1.0 - 0.02 * qn)
            ab *= mv * (1.0 - 0.05 * qn)
            cd = 1.0 - 0.42 * (crease if crease < 1.0 else 1.0)
            ar *= cd + (1.0 - cd) * 0.45
            ag *= cd
            ab *= cd
            if nail > 0.0:
                ar = ar + (0.93 - ar) * nail * 0.7
                ag = ag + (0.70 - ag) * nail * 0.7
                ab = ab + (0.66 - ab) * nail * 0.7
                ar = ar + (0.96 - ar) * tipw * 0.7
                ag = ag + (0.88 - ag) * tipw * 0.7
                ab = ab + (0.84 - ab) * tipw * 0.7

            # ---- ambient occlusion
            occ = 0.0
            sca = 1.0
            hstep = 0.12
            for _ in range(5):
                dd = _scene(px + nx * hstep, py + ny * hstep, pz + nz * hstep, CA, FBA, HBA, CB, FBB, HBB)
                occ += (hstep - dd) * sca
                sca *= 0.72
                hstep *= 1.9
            ao = 1.0 - 0.55 * occ
            if ao < 0.0:
                ao = 0.0
            elif ao > 1.0:
                ao = 1.0

            # ---- soft shadow from the key light
            lx = LP[0]
            ly = LP[1]
            lz = LP[2]
            res = 1.0
            ts = 0.06 + 2.0 * e
            sxp = px + nx * 0.012
            syp = py + ny * 0.012
            szp = pz + nz * 0.012
            for _ in range(22):
                dd = _scene(sxp + lx * ts, syp + ly * ts, szp + lz * ts, CA, FBA, HBA, CB, FBB, HBB)
                v = 6.0 * dd / ts
                if v < res:
                    res = v
                if dd < 0.05:
                    dd = 0.05
                elif dd > 1.4:
                    dd = 1.4
                ts += dd
                if res < 0.01 or ts > 34.0:
                    break
            if res < 0.0:
                res = 0.0
            sh = res * res * (3.0 - 2.0 * res)

            # ---- thickness (thin parts glow when lit from behind)
            thk = _scene(px - nx * 0.9, py - ny * 0.9, pz - nz * 0.9, CA, FBA, HBA, CB, FBB, HBB)
            thin = 1.0 - smoothstep(0.0, 0.75, -thk)

            # ---- light
            ndl = bx * lx + by * ly + bz * lz
            wrap = (ndl + 0.35) / 1.35
            if wrap < 0.0:
                wrap = 0.0
            diff = wrap ** 1.25
            shd = sh * (0.35 + 0.65 * sqrt(ao))
            kr = LP[3] * diff * shd
            kg = LP[4] * diff * shd
            kb = LP[5] * diff * shd
            band = exp(-((ndl / 0.38) ** 2)) * LP[32] * (0.35 + 0.65 * sh)
            sr = band * 0.42 * LP[3]
            sg = band * 0.10 * LP[4]
            sb = band * 0.06 * LP[5]

            rlx = LP[6]
            rly = LP[7]
            rlz = LP[8]
            ndr = bx * rlx + by * rly + bz * rlz
            rw = ndr * 0.6 + 0.4
            if rw < 0.0:
                rw = 0.0
            ndv = -(bx * dx + by * dy + bz * dz)
            if ndv < 0.0:
                ndv = 0.0
            fres = (1.0 - ndv) ** 3
            rimk = (rw * 0.30 + fres * rw * 1.25) * (0.5 + 0.5 * ao)
            back = (-ndr) * 0.5 + 0.5
            trn = thin * back * LP[32] * 0.55

            up = by * 0.5 + 0.5
            amr = (LP[15] + (LP[12] - LP[15]) * up) * ao
            amg = (LP[16] + (LP[13] - LP[16]) * up) * ao
            amb = (LP[17] + (LP[14] - LP[17]) * up) * ao

            if d_o < 0.0:
                d_o = 0.0
            prox = exp(-d_o / 1.6) * LP[33] * (0.4 + 0.6 * ao)

            cr = ar * (kr + amr + LP[9] * rimk + orr * prox) + ar * sr + LP[9] * trn * 1.0
            cg = ag * (kg + amg + LP[10] * rimk + og * prox) + ag * sg + LP[10] * trn * 0.22
            cb = ab * (kb + amb + LP[11] * rimk + ob * prox) + ab * sb + LP[11] * trn * 0.10

            # ---- speculars
            hx = lx - dx
            hy = ly - dy
            hz = lz - dz
            inv = 1.0 / sqrt(hx * hx + hy * hy + hz * hz)
            ndh = (bx * hx + by * hy + bz * hz) * inv
            if ndh < 0.0:
                ndh = 0.0
            sp = (ndh ** 30) * 0.14 * (1.0 - nail) + (ndh ** 140) * 0.9 * nail
            sp *= sh
            hx = rlx - dx
            hy = rly - dy
            hz = rlz - dz
            inv = 1.0 / sqrt(hx * hx + hy * hy + hz * hz)
            ndh = (bx * hx + by * hy + bz * hz) * inv
            if ndh < 0.0:
                ndh = 0.0
            sp2 = (ndh ** 18) * 0.10 + (ndh ** 90) * 0.5 * nail
            cr += LP[3] * sp + LP[9] * sp2
            cg += LP[4] * sp + LP[10] * sp2
            cb += LP[5] * sp + LP[11] * sp2

            out[y, x, 0] = cr
            out[y, x, 1] = cg
            out[y, x, 2] = cb
            depth[y, x] = t * cosv


def make_camera(target, dist, az_deg, el_deg, focal, cx=0.0, cy=0.0, tmax=120.0):
    az = np.radians(az_deg)
    el = np.radians(el_deg)
    target = np.asarray(target, float)
    ro = target + dist * np.array([sin(az) * cos(el), sin(el), cos(az) * cos(el)])
    fwd = target - ro
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, np.array([0.0, 1.0, 0.0]))
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    return np.concatenate([ro, right, up, fwd, [focal, cx, cy, tmax]])


def project(cam, p, W, H):
    """World point -> pixel coordinates."""
    v = np.asarray(p, float) - cam[0:3]
    z = np.dot(v, cam[9:12])
    sx = np.dot(v, cam[3:6]) / z * cam[12] + cam[13]
    sy = np.dot(v, cam[6:9]) / z * cam[12] + cam[14]
    return sx * 0.5 * H + 0.5 * W, 0.5 * H - sy * 0.5 * H, z


def drop_gap(point, CB, FBB, HBB):
    """Vertical distance from `point` straight down to hand B's surface."""
    y = 0.0
    for _ in range(200):
        d = sdf_hand(point[0], point[1] - y, point[2], CB, FBB, HBB)
        if d < 1e-4:
            break
        y += d
        if y > 60:
            break
    return y
