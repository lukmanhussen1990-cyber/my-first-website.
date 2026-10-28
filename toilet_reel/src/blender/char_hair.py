"""Procedural hair: side hair, beard, mustache, eyebrows, ear tufts.

Strands are grown in numpy (gravity + curl noise + collision against the body
SDF), clumped around guide strands, and turned into tapered ribbon meshes.
Each strand carries weights for the skeleton (root bone + chain bones).
"""
import numpy as np
import body_def as BD
from sdf import Union, Offset

RNG = np.random.RandomState(7)


def C_smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def collider():
    skin, P = BD.build_skin()
    tun = BD.tunic_shape()
    core = Union([P['head'], P['ears'], P['jaw'], P['neck'], P['chest'], P['spine'], P['hips']], k=0.01)
    env = Offset(tun, 0.004)
    return lambda X: np.minimum(core(X), env(X))


def grad(f, X, h=0.0015):
    g = np.zeros_like(X)
    for i in range(3):
        e = np.zeros(3); e[i] = h
        g[:, i] = (f(X + e) - f(X - e)) / (2 * h)
    n = np.linalg.norm(g, axis=1, keepdims=True) + 1e-9
    return g / n


def surface_points(f, origins, dirs, rmax=0.15):
    """march from origins along dirs to the first zero crossing (outside->inside reversed)."""
    ts = np.linspace(0.0, rmax, 600)
    P = origins[:, None, :] + dirs[:, None, :] * ts[None, :, None]
    D = f(P.reshape(-1, 3)).reshape(len(origins), len(ts))
    out = np.full(len(origins), np.nan)
    inside = D < 0
    # last inside sample going outwards (origins are inside the head)
    for i in range(len(origins)):
        idx = np.nonzero(inside[i])[0]
        if len(idx) == 0:
            continue
        # first outside after an inside run that started at 0
        j = np.nonzero(~inside[i])[0]
        if len(j) == 0:
            continue
        out[i] = ts[j[0]]
    ok = ~np.isnan(out)
    return origins[ok] + dirs[ok] * out[ok, None], ok


def grow(f_col, roots, d0, length, steps, gravity, curl, puff_dir=None, puff=0.0, margin=0.003,
         seed=0, stiff=0.0, converge=None):
    rng = np.random.RandomState(seed)
    N = len(roots)
    seg = (length / steps)[:, None]
    P = np.zeros((N, steps + 1, 3))
    P[:, 0] = roots
    d = d0 / np.linalg.norm(d0, axis=1, keepdims=True)
    phase = rng.uniform(0, 6.28, (N, 3))
    freq = rng.uniform(2.0, 4.0, (N, 1))
    for s in range(1, steps + 1):
        u = s / steps
        nz = np.sin(phase + freq * u * 6.28 * np.array([1.0, 1.3, 0.7]))
        nz += 0.6 * np.sin(phase * 1.7 + freq * u * 15.0 * np.array([0.8, 1.1, 1.2]))
        nz += rng.normal(0, 0.30, (N, 3))
        d = d + gravity * (1 - stiff * (1 - u)) + curl * nz
        if puff_dir is not None:
            d = d + puff * puff_dir * max(0.0, 1 - u / 0.3)
        if converge is not None:
            d = d + converge * u
        d /= np.linalg.norm(d, axis=1, keepdims=True)
        p = P[:, s - 1] + d * seg
        # collision push-out (two iterations)
        for _ in range(2):
            dist = f_col(p)
            bad = dist < margin
            if bad.any():
                g = grad(f_col, p[bad])
                p[bad] += g * (margin - dist[bad])[:, None]
        d = (p - P[:, s - 1]); d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
        P[:, s] = p
    return P


def wave_locks(G, amp, wavelength, seed):
    """add a lateral S-wave to guide strands (wavy locks)."""
    rng = np.random.RandomState(seed)
    N, S1, _ = G.shape
    seglen = np.linalg.norm(np.diff(G, axis=1), axis=2)
    s = np.concatenate([np.zeros((N, 1)), np.cumsum(seglen, axis=1)], 1)
    T = np.gradient(G, axis=1)
    T /= np.linalg.norm(T, axis=2, keepdims=True) + 1e-9
    ang = rng.uniform(0, 2 * np.pi, (N, 1))
    hint = np.stack([np.cos(ang), np.sin(ang) * 0.5, np.zeros_like(ang)], 2)
    side = np.cross(T, hint)
    side /= np.linalg.norm(side, axis=2, keepdims=True) + 1e-9
    a = amp * rng.uniform(0.6, 1.3, (N, 1))
    lam = wavelength * rng.uniform(0.8, 1.25, (N, 1))
    ph = rng.uniform(0, 2 * np.pi, (N, 1))
    u = np.linspace(0, 1, S1)[None, :]
    off = (a * np.sin(2 * np.pi * s / lam + ph) * np.sqrt(u))[:, :, None] * side
    return G + off


def children(guides, n_child, spread, clump, seed, noise=0.004):
    rng = np.random.RandomState(seed)
    G, S1, _ = guides.shape
    u = np.linspace(0, 1, S1)[None, :, None]
    out = []
    for c in range(n_child):
        off = rng.normal(0, spread, (G, 1, 3))
        shrink = 1.0 - clump * u ** 0.8
        jitter = rng.normal(0, noise, (G, 1, 3)) * u
        wav = np.sin(u * rng.uniform(4, 9) * np.pi + rng.uniform(0, 6.28, (G, 1, 1))) * noise * 0.6 * u
        lenf = rng.uniform(0.82, 1.08, (G, 1, 1))
        base = guides[:, :1] + (guides - guides[:, :1]) * lenf
        out.append(base + off * shrink + jitter + wav)
    return np.concatenate([guides] + out, axis=0)


def ribbons(strands, width_root, width_tip=0.0, up=None, center=None, twist=0.0, seed=0, axis=None):
    """tapered ribbon mesh. returns V, F, u(per vert), rand(per vert), strand_id(per vert).

    Ribbons face away from `center` (point), from a vertical `axis` (x, y), or along `up`.
    """
    rng = np.random.RandomState(seed)
    N, S1, _ = strands.shape
    T = np.gradient(strands, axis=1)
    T /= np.linalg.norm(T, axis=2, keepdims=True) + 1e-9
    if axis is not None:
        R = strands.copy()
        R[..., 0] -= axis[0]; R[..., 1] -= axis[1]; R[..., 2] = 0.0
    elif center is not None:
        R = strands - np.asarray(center)[None, None, :]
    else:
        R = np.broadcast_to(np.asarray(up)[None, None, :], strands.shape).copy()
    side = np.cross(T, R)
    side /= np.linalg.norm(side, axis=2, keepdims=True) + 1e-9
    if twist:
        ang = rng.uniform(-twist, twist, (N, 1, 1))
        nrm = np.cross(side, T)
        side = side * np.cos(ang) + nrm * np.sin(ang)
    u = np.linspace(0, 1, S1)
    wr = np.atleast_1d(width_root)
    if wr.size == 1:
        wr = np.full(N, float(wr[0]))
    w = (wr[:, None] * (1 - u[None, :]) ** 0.75 + width_tip)[:, :, None]
    A = strands - side * w * 0.5
    B = strands + side * w * 0.5
    V = np.stack([A, B], axis=2).reshape(N, S1 * 2, 3)
    base = (np.arange(N) * S1 * 2)[:, None]
    i = np.arange(S1 - 1) * 2
    q = np.stack([i, i + 1, i + 3, i + 2], axis=1)[None, :, :] + base[:, :, None]
    F = q.reshape(-1, 4)
    uu = np.repeat(u, 2)[None, :].repeat(N, 0).ravel()
    rr = np.repeat(rng.uniform(0, 1, N), S1 * 2)
    sid = np.repeat(np.arange(N), S1 * 2)
    vv = np.tile(np.array([0.0, 1.0]), N * S1)
    return V.reshape(-1, 3), F, uu, rr, sid, vv


# ---------------------------------------------------------------- regions
def side_hair(f_col, f_head):
    n = 360
    phi = RNG.uniform(-2.25, 2.25, n)              # 0 = back of head
    zt = RNG.uniform(0.0, 1.0, n)
    # higher band at the back, lower near the temples; skip ears via filter below
    zlo = 1.538 + 0.010 * np.abs(phi)
    zhi = 1.630 - 0.012 * np.abs(phi)
    z = zlo + (zhi - zlo) * zt
    c = np.array([0.0, 0.012, 0.0])
    dirs = np.stack([np.sin(phi), np.cos(phi), np.zeros(n)], 1)
    origins = np.stack([np.zeros(n), np.full(n, 0.012), z], 1)
    roots, ok = surface_points(f_head, origins, dirs)
    phi = phi[ok]
    # remove roots on/near the ears
    ear = np.abs(np.abs(roots[:, 0]) - 0.074) < 0.018
    ear &= (roots[:, 2] < 1.597) & (roots[:, 2] > 1.52) & (roots[:, 1] < 0.045)
    roots = roots[~ear]; phi = phi[~ear]
    roots = roots - grad(f_head, roots) * 0.0015
    nrm = grad(f_head, roots)
    d0 = nrm * 0.55 + np.array([0, 0.35, -1.0])
    L = RNG.uniform(0.09, 0.16, len(roots))
    G = grow(f_col, roots, d0, L, 14, gravity=np.array([0, 0.01, -0.20]), curl=0.16,
             puff_dir=nrm, puff=0.10, margin=0.005, seed=1, stiff=0.5)
    G = wave_locks(G, 0.004, 0.05, seed=32)
    S = children(G, 11, 0.0032, 0.65, seed=2, noise=0.007)
    return S


def beard(f_col, f_face):
    n = 1500
    th = RNG.uniform(-1.0, 1.0, n) * 1.75           # around the face (0 = front)
    el = RNG.uniform(-1.25, 0.35, n)
    c0 = np.array([0.0, -0.010, 1.500])
    dirs = np.stack([np.sin(th) * np.cos(el), -np.cos(th) * np.cos(el), np.sin(el)], 1)
    origins = np.repeat(c0[None], n, 0)
    roots, ok = surface_points(f_face, origins, dirs, rmax=0.13)
    x, y, z = roots[:, 0], roots[:, 1], roots[:, 2]
    keep = (z < 1.528 + 1.2 * np.maximum(np.abs(x) - 0.045, 0)) & (z > 1.405)
    keep &= ~((np.abs(x) < 0.030) & (z > 1.476) & (y < -0.07))       # mouth / lips area
    keep &= ~((z > 1.505) & (np.abs(x) < 0.040) & (y < -0.075))      # under nose / upper lip
    keep &= ~((np.abs(x) > 0.062) & (y > 0.006))                     # behind the jaw line / ears
    keep &= y < 0.03
    roots = roots[keep]
    roots = roots - grad(f_face, roots) * 0.0015
    nrm = grad(f_face, roots)
    x = roots[:, 0]
    ztip = 1.255 + 3.2 * x ** 2
    L = np.clip((roots[:, 2] - ztip) * 1.22, 0.035, 0.30)
    d0 = nrm * 0.45 + np.array([0, -0.30, -1.0])
    conv = np.stack([-roots[:, 0] * 3.0, np.zeros(len(roots)), np.zeros(len(roots))], 1)
    G = grow(f_col, roots, d0, L, 18, gravity=np.array([0, -0.008, -0.24]), curl=0.16,
             puff_dir=nrm, puff=0.10, margin=0.006, seed=3, stiff=0.3, converge=conv)
    G = wave_locks(G, 0.0045, 0.055, seed=31)
    S = children(G, 9, 0.0030, 0.72, seed=4, noise=0.006)
    return S


def mustache(f_col, f_face):
    n = 230
    x = RNG.uniform(-0.030, 0.030, n)
    z = RNG.uniform(1.4995, 1.5135, n) - 0.006 * (np.abs(x) / 0.03) ** 2
    origins = np.stack([x * 0.6, np.full(n, -0.05), z], 1)
    dirs = np.repeat(np.array([[0, -1.0, 0]]), n, 0)
    roots, ok = surface_points(f_face, origins, dirs, rmax=0.08)
    x = roots[:, 0]
    roots = roots - grad(f_face, roots) * 0.0012
    side = np.sign(x + 1e-6)
    d0 = np.stack([side * (0.35 + 1.6 * np.abs(x) / 0.03), np.full(len(x), -0.55), np.full(len(x), -1.0)], 1)
    ax = np.abs(x) / 0.03
    # short over the mouth (mouth stays readable), long drooping walrus ends at the sides
    L = 0.012 + 0.060 * C_smooth(0.35, 1.0, ax) + RNG.uniform(0, 0.006, len(x))
    G = grow(f_col, roots, d0, L, 10, gravity=np.array([0, -0.01, -0.16]), curl=0.08,
             margin=0.003, seed=5, stiff=0.3)
    S = children(G, 7, 0.0018, 0.5, seed=6, noise=0.0035)
    return S


def eyebrows(f_col, f_face):
    out = []
    for s in (1, -1):
        n = 95
        t = RNG.uniform(0, 1, n)
        x = s * (0.011 + 0.043 * t)
        z = 1.5925 + 0.010 * np.sin(np.pi * t ** 0.8) - 0.006 * t + RNG.normal(0, 0.0022, n)
        origins = np.stack([x * 0.85, np.full(n, -0.04), z], 1)
        dirs = np.repeat(np.array([[0, -1.0, 0]]), n, 0)
        roots, ok = surface_points(f_face, origins, dirs, rmax=0.08)
        tt = t[ok]
        roots = roots - grad(f_face, roots) * 0.001
        nrm = grad(f_face, roots)
        d0 = (np.stack([s * (0.25 + 1.2 * tt), np.full(len(tt), -0.55), 0.9 - 0.5 * tt], 1) + nrm * 0.4)
        L = 0.014 + 0.022 * RNG.uniform(0, 1, len(tt)) ** 2 + 0.010 * tt
        wild = RNG.uniform(0, 1, len(tt)) > 0.88
        L[wild] *= 1.6
        G = grow(f_col, roots, d0, L, 8, gravity=np.array([0, -0.02, 0.02]), curl=0.30,
                 margin=0.002, seed=8 + s)
        out.append(children(G, 4, 0.0012, 0.3, seed=9 + s, noise=0.0022))
    return out


def ear_tufts(f_col, f_head):
    out = []
    for s in (1, -1):
        n = 14
        roots = np.array([s * 0.0735, 0.010, 1.552]) + RNG.normal(0, 0.0025, (n, 3))
        d0 = np.array([s * 1.0, -0.2, 0.3]) + RNG.normal(0, 0.4, (n, 3))
        L = RNG.uniform(0.008, 0.016, n)
        G = grow(f_col, roots, d0, L, 5, gravity=np.array([0, 0, 0.0]), curl=0.5, margin=0.0, seed=20 + s)
        out.append(G)
    return np.concatenate(out, 0)
