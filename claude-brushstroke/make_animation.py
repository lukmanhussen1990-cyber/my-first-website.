#!/usr/bin/env python3
"""
Brush-stroke animation of the Claude illustration  ->  claude-brushstroke.mp4

The artwork in source.jpg is split into its paint layers (black ink / orange paint),
skeletonised into brush paths, and then "re-painted" over ten seconds by a simulated
bristle brush: round tip, streaky dry-brush edge, curvature-aware speed, and a camera
that follows the action.  The final frames match the original artwork.

    python3 make_animation.py                       # full render -> claude-brushstroke.mp4
    python3 make_animation.py --stills 1.0 2.5 4.0  # PNG stills only (for review)
    python3 make_animation.py --debug               # overlay of the brush paths
"""
import os
import math
import time
import argparse
import subprocess
from collections import deque

import numpy as np
import cv2
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from scipy.interpolate import PchipInterpolator
from skimage.morphology import skeletonize

HERE = os.path.dirname(os.path.abspath(__file__))
SRC_PATH = os.path.join(HERE, "source.jpg")
OUT_PATH = os.path.join(HERE, "claude-brushstroke.mp4")

OUT_W, OUT_H = 1360, 1080      # output frame (same aspect as the 920x731 source)
FPS = 60
DURATION = 10.0
S = 2                          # scene pixels per source pixel
PAD = 160                      # source px of extra paper around the art (camera room)
OFF = PAD * S                  # scene offset of the source canvas
SOFT = 2.2                     # softness of the brush front, in scene px


# ----------------------------------------------------------------------------- small helpers
def smooth01(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def ease_out_cubic(x):
    x = np.clip(x, 0.0, 1.0)
    return 1 - (1 - x) ** 3


def _hash(i, seed):
    x = np.sin(i * 127.1 + seed * 311.7) * 43758.5453
    return x - np.floor(x)


def vnoise(x, seed):
    i = np.floor(x)
    f = x - i
    f = f * f * (3 - 2 * f)
    return _hash(i, seed) * (1 - f) + _hash(i + 1, seed) * f


def fbm(x, seed, octaves=3):
    acc = tot = 0.0
    amp = 0.5
    for o in range(octaves):
        acc = acc + amp * vnoise(x * (2 ** o) + 17.3 * o, seed + 7.1 * o)
        tot += amp
        amp *= 0.5
    return acc / tot


def affine_about(cx, cy, angle=0.0, scale=1.0, tx=0.0, ty=0.0):
    c, s = math.cos(angle) * scale, math.sin(angle) * scale
    return np.array([[c, -s, cx - c * cx + s * cy + tx],
                     [s, c, cy - s * cx - c * cy + ty],
                     [0, 0, 1]], np.float64)


def translate(tx, ty):
    return np.array([[1, 0, tx], [0, 1, ty], [0, 0, 1]], np.float64)


# ----------------------------------------------------------------------------- source layers
class Layers:
    pass


def upscale_alpha(a):
    u = cv2.resize(a, None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)
    u = cv2.GaussianBlur(u, (0, 0), .45 * S)             # remove JPEG ringing / blockiness
    return smooth01((u - .30) / .40).astype(np.float32)  # crisp, smooth anti-aliased edge


def load_layers():
    """Unmix the JPEG into clean coverage maps for the orange paint and the black ink."""
    L = Layers()
    rgb = cv2.imread(SRC_PATH)[:, :, ::-1].astype(np.float32)
    H0, W0 = rgb.shape[:2]
    paper = np.median(rgb[:20, :20].reshape(-1, 3), axis=0)
    yy, xx = np.mgrid[:H0, :W0]
    disc = (xx - 433) ** 2 + (yy - 378) ** 2 < 28 ** 2
    orange = np.median(rgb[disc], axis=0)
    lum = rgb @ np.array([.299, .587, .114], np.float32)
    chroma = rgb.max(2) - rgb.min(2)
    ink = np.median(rgb[(lum < 45) & (chroma < 25)], axis=0)
    M = np.stack([orange - paper, ink - paper], 1)
    d = (rgb - paper) @ np.linalg.pinv(M).T
    a_o = np.clip(d[..., 0], 0, 1)
    a_k = np.clip(d[..., 1], 0, 1)
    a_o[a_o < .04] = 0
    a_k[a_k < .04] = 0
    A_k, A_o = upscale_alpha(a_k), upscale_alpha(a_o)

    L.W0, L.H0 = W0, H0
    L.paper, L.orange, L.ink = paper.astype(np.float32), orange.astype(np.float32), ink.astype(np.float32)
    L.line = A_k.copy()
    L.line[:300 * S] = 0                     # hand, bow, string, profile
    L.text = A_k.copy()
    L.text[135 * S:] = 0                     # "Claude" wordmark
    bal = A_o.copy()
    bal[:300 * S] = 0                        # orange balloon
    # the string overlaps the balloon rim: pre-divide so that "ink over orange" reproduces the source
    L.balloon = np.clip(np.where(L.line < .98, bal / np.maximum(1 - L.line, 1e-3), bal), 0, 1)
    L.star = A_o.copy()
    L.star[140 * S:] = 0
    L.star[:, 390 * S:] = 0                  # orange starburst
    L.src_rgb = rgb
    return L


# ----------------------------------------------------------------------------- skeleton graph
K8 = np.ones((3, 3), np.uint8)
K8[1, 1] = 0


def nb_count(sk):
    return cv2.filter2D(sk.astype(np.uint8), -1, K8, borderType=cv2.BORDER_CONSTANT) * sk


def prune_spurs(sk, maxlen):
    sk = sk.copy()
    H, W = sk.shape
    for _ in range(3):
        changed = False
        for y, x in np.argwhere(nb_count(sk) == 1):
            path, cur, prev = [(y, x)], (y, x), None
            nb = []
            while True:
                cy, cx = cur
                nb = [(cy + dy, cx + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                      if (dy or dx) and 0 <= cy + dy < H and 0 <= cx + dx < W and sk[cy + dy, cx + dx]
                      and (cy + dy, cx + dx) != prev and (cy + dy, cx + dx) not in path]
                if len(nb) != 1:
                    break
                prev, cur = cur, nb[0]
                path.append(cur)
                if len(path) > maxlen:
                    break
            if len(path) <= maxlen and len(nb) >= 2:
                for p in path[:-1]:
                    sk[p] = False
                changed = True
        if not changed:
            break
    return sk


def order_piece(ys, xs):
    pts = set(zip(ys.tolist(), xs.tolist()))

    def nbrs(p):
        y, x = p
        return [(y + dy, x + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                if (dy or dx) and (y + dy, x + dx) in pts]
    ends = [p for p in pts if len(nbrs(p)) <= 1]
    start = ends[0] if ends else next(iter(pts))
    path, seen, cur = [start], {start}, start
    while True:
        nb = [q for q in nbrs(cur) if q not in seen]
        if not nb:
            break
        nb.sort(key=lambda q: abs(q[0] - cur[0]) + abs(q[1] - cur[1]))
        cur = nb[0]
        seen.add(cur)
        path.append(cur)
    return path


def skeleton_graph(mask):
    """Skeleton of the line art split into edges between endpoints / junction clusters."""
    sk = prune_spurs(skeletonize(mask), 14 * S)
    deg = nb_count(sk)
    junc = (deg >= 3) & sk
    jd = cv2.dilate(junc.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    jl, jn = ndi.label(jd, structure=np.ones((3, 3)))
    jl = jl * sk
    clusters = {}
    for k in range(1, jn + 1):
        ys, xs = np.nonzero(jl == k)
        if len(ys):
            clusters[k] = np.array([xs.mean(), ys.mean()])
    el, en = ndi.label(sk & (jl == 0), structure=np.ones((3, 3)))
    edges = []
    for i in range(1, en + 1):
        ys, xs = np.nonzero(el == i)
        if len(ys) < 3:
            continue
        path = order_piece(ys, xs)
        edges.append(np.array([(x, y) for y, x in path], np.float64))
    return sk, edges, clusters


def pick_edge(edges, p0, p1, tol=7):
    """Find the skeleton edge running from source-px p0 to p1 (either orientation)."""
    p0, p1 = np.array(p0, float) * S, np.array(p1, float) * S
    best = None
    for P in edges:
        for rev in (False, True):
            Q = P[::-1] if rev else P
            c = np.hypot(*(Q[0] - p0)) + np.hypot(*(Q[-1] - p1))
            if best is None or c < best[0]:
                best = (c, Q)
    assert best[0] < tol * S, f"edge {p0 / S}->{p1 / S} not found (err {best[0] / S:.1f}px)"
    return best[1]


def chain(edges, clusters, parts):
    """Concatenate edges (given by source-px endpoints) through junction centroids."""
    segs = [pick_edge(edges, a, b) for a, b in parts]
    out = [segs[0]]
    for A, B in zip(segs[:-1], segs[1:]):
        gap = np.hypot(*(A[-1] - B[0]))
        if gap > 2.5:
            mid = (A[-1] + B[0]) / 2
            ck = min(clusters.values(), key=lambda c: np.hypot(*(c - mid)))
            if np.hypot(*(ck - mid)) < 14 * S:
                out.append(ck[None, :])
        out.append(B)
    return np.concatenate(out)


def smooth_resample(pts, sigma=3.0, step=1.0):
    p = np.asarray(pts, float)
    if len(p) > 6 and sigma > 0:
        p = np.stack([ndi.gaussian_filter1d(p[:, 0], sigma, mode="nearest"),
                      ndi.gaussian_filter1d(p[:, 1], sigma, mode="nearest")], 1)
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    n = max(int(d[-1] / step) + 1, 3)
    g = np.linspace(0, d[-1], n)
    return np.stack([np.interp(g, d, p[:, 0]), np.interp(g, d, p[:, 1])], 1)


# ----------------------------------------------------------------------------- brush strokes
class Stroke:
    """One brush path.  Pixels are bound to it later; it then drives their reveal over time."""

    def __init__(self, name, pts, t0, t1, *, dt_img=None, w=None, seed=1.0, ease=(.45, .45),
                 curv=0.0, sigma=3.0, bristle=1.0, nb=6, tip=1.0, w_min=2.5):
        self.name, self.t0, self.t1 = name, t0, t1
        self.seed, self.ease, self.curv = seed, ease, curv
        self.bristle, self.nb, self.tip = bristle, nb, tip
        xy = smooth_resample(pts, sigma)
        self.xy = xy
        seg = np.hypot(*np.diff(xy, axis=0).T)
        self.a = np.r_[0, np.cumsum(seg)]
        self.L = float(self.a[-1])
        T = np.gradient(xy, axis=0)
        T /= np.maximum(np.hypot(T[:, 0], T[:, 1]), 1e-9)[:, None]
        T = np.stack([ndi.gaussian_filter1d(T[:, 0], 4, mode="nearest"),
                      ndi.gaussian_filter1d(T[:, 1], 4, mode="nearest")], 1)
        T /= np.maximum(np.hypot(T[:, 0], T[:, 1]), 1e-9)[:, None]
        self.T = T
        dT = np.gradient(T, axis=0)
        self.kappa = ndi.gaussian_filter1d(np.hypot(dT[:, 0], dT[:, 1]), 6, mode="nearest")
        if w is not None:
            self.w = np.full(len(xy), float(w))
        else:
            ww = ndi.map_coordinates(dt_img, [xy[:, 1], xy[:, 0]], order=1, mode="nearest")
            self.w = np.maximum(ndi.gaussian_filter1d(ww, 8, mode="nearest"), w_min)

    def finish(self, thr):
        """Build the time profile once the pixel thresholds are known."""
        self.F_lo = float(thr.min()) - 1.0
        self.F_hi = float(thr.max()) + SOFT + 1.0
        F = np.arange(self.F_lo, self.F_hi + 1.0, 1.0)
        aa = np.clip(F, 0, self.L)
        kap = np.interp(aa, self.a, self.kappa)
        v = 1.0 / (1.0 + self.curv * np.clip(kap * 90.0, 0, 4.0))
        u = aa / max(self.L, 1.0)
        e_in, e_out = self.ease
        v = v * (e_in + (1 - e_in) * smooth01(u / .2)) * (e_out + (1 - e_out) * smooth01((1 - u) / .2))
        cum = np.cumsum(1.0 / v)
        self.F_grid = F
        self.tau_grid = (cum - cum[0]) / (cum[-1] - cum[0])

    def time_of(self, thr):
        """Time at which the brush front reaches arclength-threshold `thr`."""
        tau = np.interp(thr, self.F_grid, self.tau_grid)
        return self.t0 + tau * (self.t1 - self.t0)

    def soft_of(self, thr):
        """Duration of the soft edge of the front at `thr` (SOFT px of travel, at the local speed)."""
        tau = np.interp(thr, self.F_grid, self.tau_grid)
        v = np.interp(tau, self.tau_grid, np.gradient(self.F_grid, self.tau_grid)) / (self.t1 - self.t0)
        return np.clip(SOFT / np.maximum(v, 1e-6), .004, .10)


def bind_pixels(alpha, strokes, region=None, *, bristle_scale=1.0):
    """Give every painted pixel the moment it gets painted.

    A pixel is painted by whichever brush passes over it first (a brush covers a capsule of
    radius = local half-width around its path), so overlaps at knots and junctions fill in
    like real paint instead of splitting along hard Voronoi seams.
    """
    m = alpha > 0.012
    if region is not None:
        m &= region
    ys, xs = np.nonzero(m)
    px = np.stack([xs, ys], 1).astype(np.float64)
    n, K = len(xs), len(strokes)
    ptree = cKDTree(px)

    def geometry(st, i, j):
        d = px[i] - st.xy[j]
        T = st.T[j]
        w = st.w[j]
        a_eff = st.a[j] + (d * T).sum(1)
        u = np.clip((d[:, 0] * -T[:, 1] + d[:, 1] * T[:, 0]) / w, -1, 1)
        bz = np.clip((fbm(u * st.nb * .5 + st.seed * 3.7, st.seed) - .5) * 1.7 + .5, 0, 1)
        thr = a_eff + st.tip * w * (1 - np.sqrt(1 - u * u)) + st.bristle * bristle_scale * w * bz
        return thr, u, a_eff

    THR = np.full((K, n), np.inf)
    U = np.zeros((K, n))
    A = np.zeros((K, n))
    for k, st in enumerate(strokes):
        pairs = ptree.sparse_distance_matrix(cKDTree(st.xy), 1.12 * float(st.w.max()), output_type="ndarray")
        i, j, dist = pairs["i"], pairs["j"], pairs["v"]
        keep = dist <= 1.12 * st.w[j]
        i, j = i[keep], j[keep]
        thr, u, a_eff = geometry(st, i, j)
        order = np.lexsort((thr, i))                 # earliest covering sample of this stroke per pixel
        iu, first = np.unique(i[order], return_index=True)
        sel = order[first]
        THR[k, iu], U[k, iu], A[k, iu] = thr[sel], u[sel], a_eff[sel]
    # pixels outside every brush capsule (rare, at junction gaps): nearest brush path
    free = ~np.isfinite(THR).any(0)
    if free.any():
        dn = np.full((K, n), np.inf)
        cand = []
        for k, st in enumerate(strokes):
            dist, j = cKDTree(st.xy).query(px[free])
            dn[k, free] = dist / st.w[j]
            cand.append(j)
        win = dn.argmin(0)
        idx = np.nonzero(free)[0]
        for k, st in enumerate(strokes):
            sel = win[idx] == k
            if sel.any():
                ii = idx[sel]
                jj = cand[k][sel]
                thr, u, a_eff = geometry(st, ii, jj)
                THR[k, ii], U[k, ii], A[k, ii] = thr, u, a_eff
    T_rev = np.full((K, n), np.inf)
    T_soft = np.full((K, n), .03)
    for k, st in enumerate(strokes):
        fin = np.isfinite(THR[k])
        st.finish(THR[k, fin] if fin.any() else np.zeros(1))
        T_rev[k, fin] = st.time_of(THR[k, fin])
        T_soft[k, fin] = st.soft_of(THR[k, fin])
    sid = T_rev.argmin(0)
    col = np.arange(n)
    return dict(xs=xs, ys=ys, alpha=alpha[ys, xs].astype(np.float32), sid=sid,
                t_rev=T_rev[sid, col].astype(np.float32), t_soft=T_soft[sid, col].astype(np.float32),
                u=U[sid, col], a=A[sid, col])


# ----------------------------------------------------------------------------- timeline (seconds)
TL = dict(
    star_t0=0.25, ray_dur=0.28, ray_gap=0.06,
    text_t0=0.95, letter_dur=0.40, letter_gap=0.095,
    balloon=(2.05, 3.05), pop_t=2.95,
    string=(2.95, 3.35),
    bow_r=(3.25, 3.65), bow_l=(3.50, 4.05), bow_d=(3.95, 4.20),
    hand=[(4.10, 4.45), (4.25, 4.62), (4.42, 4.82), (4.60, 5.05)],
    long=(4.95, 7.85),
    kick=7.85,                       # the balloon is flicked when the last stroke lands
)

# camera keyframes: time, centre x, centre y (source px), zoom
CAM_KEYS = [
    (0.00, 461, 92, 1.90),
    (1.65, 461, 92, 1.90),
    (2.00, 450, 250, 1.50),       # pull back: logo above, empty canvas below ...
    (2.50, 433, 384, 1.85),       # ... then push in on the balloon
    (3.20, 420, 440, 1.85),
    (4.90, 440, 495, 1.68),
    (6.20, 500, 545, 1.50),
    (7.10, 540, 490, 1.35),
    (7.85, 530, 425, 1.20),
    (8.75, 460, 365.5, 1.00),     # exactly the source framing
    (10.0, 460, 365.5, 1.00),
]


# ----------------------------------------------------------------------------- painted elements
def texture(bound, strokes, k=1.0):
    seeds = np.array([s.seed for s in strokes])[bound["sid"]]
    return (fbm(bound["u"] * 2.5 + bound["a"] / 180.0, seeds + 5.0) - .5) * k


class Paint:
    """Sparse set of pixels with a final colour/alpha and a per-pixel paint-on time."""

    def __init__(self, bound, color, strokes, alpha=None):
        self.xs = (bound["xs"] + OFF).astype(np.int64)
        self.ys = (bound["ys"] + OFF).astype(np.int64)
        self.alpha = (bound["alpha"] if alpha is None else alpha).astype(np.float32)
        self.sid = bound["sid"].astype(np.int64)
        self.t_rev, self.t_soft = bound["t_rev"], bound["t_soft"]
        self.color = color.astype(np.float32)
        self.strokes = strokes


class Group:
    """Paints that share a region of interest (and an optional transform), drawn in z-order."""

    def __init__(self, paints, matrix_fn=None, margin=6):
        self.paints, self.matrix_fn = paints, matrix_fn
        xs = np.concatenate([p.xs for p in paints])
        ys = np.concatenate([p.ys for p in paints])
        self.x0, self.y0 = int(xs.min()) - margin, int(ys.min()) - margin
        self.w, self.h = int(xs.max()) + margin + 1 - self.x0, int(ys.max()) + margin + 1 - self.y0
        for p in paints:
            p.li = (p.ys - self.y0) * self.w + (p.xs - self.x0)
        self.t_first = min(s.t0 for p in paints for s in p.strokes)

    def draw(self, frame, t):
        if t < self.t_first:
            return
        buf = np.zeros((self.h * self.w, 4), np.float32)
        for p in self.paints:
            a = p.alpha * smooth01((t - p.t_rev) / p.t_soft)
            prev = buf[p.li]
            buf[p.li, :3] = prev[:, :3] * (1 - a)[:, None] + p.color * a[:, None]
            buf[p.li, 3] = prev[:, 3] * (1 - a) + a
        buf = buf.reshape(self.h, self.w, 4)
        if self.matrix_fn is not None:
            M = self.matrix_fn(t)
            if M is not None and not np.allclose(M, np.eye(3), atol=1e-9):
                Ml = translate(-self.x0, -self.y0) @ M @ translate(self.x0, self.y0)
                buf = cv2.warpAffine(buf, Ml[:2], (self.w, self.h), flags=cv2.INTER_CUBIC,
                                     borderMode=cv2.BORDER_CONSTANT, borderValue=0)
                buf[..., 3] = np.clip(buf[..., 3], 0, 1)
                buf[..., :3] = np.clip(buf[..., :3], 0, None)
        sub = frame[self.y0:self.y0 + self.h, self.x0:self.x0 + self.w]
        sub *= (1 - buf[..., 3:4])
        sub += buf[..., :3]


class Droplets:
    """Little flung blobs of paint: a burst off the balloon and an ink flick off the last stroke."""

    def __init__(self, items, color):
        self.items, self.color = items, np.asarray(color, np.float32)

    def draw(self, frame, t):
        for it in self.items:
            tau = (t - it["t0"]) / it["life"]
            if not 0 <= tau <= 1:
                continue
            e = ease_out_cubic(tau)
            pos = it["p0"] + it["dir"] * it["dist"] * e
            r = it["r"] * (1 - .45 * tau)
            a = 1 - smooth01((tau - .5) / .5)
            stretch = 1 + it["elong"] * (1 - e)
            R = int(r * stretch + 4)
            x0, y0 = int(pos[0]) - R, int(pos[1]) - R
            yy, xx = np.mgrid[y0:y0 + 2 * R + 1, x0:x0 + 2 * R + 1].astype(np.float32)
            dx, dy = xx - pos[0], yy - pos[1]
            u = (dx * it["dir"][0] + dy * it["dir"][1]) / stretch
            v = -dx * it["dir"][1] + dy * it["dir"][0]
            cov = np.clip(r + .5 - np.sqrt(u * u + v * v), 0, 1) * a
            sub = frame[y0:y0 + 2 * R + 1, x0:x0 + 2 * R + 1]
            sub *= (1 - cov[..., None])
            sub += cov[..., None] * self.color


def make_droplets(bal_c, bal_R, tip_pos, tip_dir, orange, ink):
    rng = np.random.RandomState(21)
    items = []
    t0 = TL["balloon"][1] - .05
    for k in range(10):
        ang = math.radians(-90 + 360 * (k + rng.uniform(-.3, .3)) / 10)
        d = np.array([math.cos(ang), math.sin(ang)])
        if d[1] > .55 and abs(d[0]) < .6:           # keep clear of the string
            continue
        items.append(dict(p0=bal_c + d * (bal_R * .92), dir=d, dist=rng.uniform(34, 82) * S,
                          r=rng.uniform(2.2, 5.2) * S, t0=t0 + rng.uniform(0, .06), life=rng.uniform(.55, .8),
                          elong=rng.uniform(.6, 1.6)))
    orange_d = Droplets(items, orange)
    items = []
    base = math.atan2(tip_dir[1], tip_dir[0])
    t1 = TL["long"][1] - .1
    for k in range(7):
        ang = base + rng.uniform(-.55, .55)
        d = np.array([math.cos(ang), math.sin(ang)])
        items.append(dict(p0=tip_pos + d * rng.uniform(0, 6) * S, dir=d, dist=rng.uniform(22, 78) * S,
                          r=rng.uniform(1.2, 3.0) * S, t0=t1 + rng.uniform(0, .08), life=rng.uniform(.4, .6),
                          elong=rng.uniform(.8, 2.0)))
    return [orange_d, Droplets(items, ink)]


def build_ink(L):
    mask = L.line > .5
    sk, edges, clusters = skeleton_graph(mask)
    dt = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)
    ch = lambda *parts: chain(edges, clusters, list(parts))
    D = [  # name, path (source-px edge ends, in drawing direction), timing, params
        ("string", ch(((436, 422), (432, 460))), TL["string"], dict(ease=(.5, .6), curv=0)),
        ("bow_r", ch(((440, 458), (440, 466))), TL["bow_r"], dict(ease=(.45, .7), curv=1.0)),
        ("bow_l", ch(((426, 472), (422, 479)), ((420, 487), (420, 488)),
                     ((424, 495), (398, 534)), ((392, 529), (416, 484))), TL["bow_l"],
         dict(ease=(.4, .6), curv=1.0)),
        ("bow_d", ch(((416, 496), (398, 526))), TL["bow_d"], dict(ease=(.5, .6))),
        ("h1", ch(((282, 503), (326, 434))), TL["hand"][0], dict(ease=(.35, .9), curv=.8)),
        ("h2", ch(((306, 494), (328, 440)), ((332, 434), (361, 425))), TL["hand"][1], dict(ease=(.35, .9), curv=.8)),
        ("h3", ch(((330, 492), (361, 432)), ((366, 428), (376, 459))), TL["hand"][2], dict(ease=(.35, .9), curv=.8)),
        ("h4", ch(((352, 497), (374, 466)), ((380, 462), (424, 466))), TL["hand"][3], dict(ease=(.35, .9), curv=.8)),
        ("long", ch(((437, 472), (636, 322))), TL["long"], dict(ease=(.4, 1.5), curv=1.3)),
    ]
    strokes = [Stroke(n, p, t0, t1, dt_img=dt, seed=3.0 + 1.7 * i, bristle=1.15, nb=6, **kw)
               for i, (n, p, (t0, t1), kw) in enumerate(D)]
    b = bind_pixels(L.line, strokes)
    alpha = b["alpha"]
    names = [s.name for s in strokes]
    return strokes, b, alpha, names


def star_rays(mask):
    """Radial skeleton branches of the starburst, centre -> tip."""
    sk = prune_spurs(skeletonize(mask), 5 * S)
    cy, cx = ndi.center_of_mass(mask)
    pix = set(zip(*[a.tolist() for a in np.nonzero(sk)]))
    start = min(pix, key=lambda p: (p[0] - cy) ** 2 + (p[1] - cx) ** 2)
    parent, dq = {start: None}, deque([start])
    while dq:
        p = dq.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                q = (p[0] + dy, p[1] + dx)
                if (dy or dx) and q in pix and q not in parent:
                    parent[q] = p
                    dq.append(q)
    ends = [tuple(e) for e in np.argwhere(nb_count(sk) == 1)]
    paths = []
    for e in ends:
        path, p = [], e
        while p is not None:
            path.append(p)
            p = parent[p]
        paths.append(path[::-1])
    count = {}
    for pth in paths:
        for p in pth:
            count[p] = count.get(p, 0) + 1
    rays = []
    for pth in paths:
        shared = [i for i, p in enumerate(pth) if count[p] > 1]
        i0 = max(shared) if shared else 0
        xy = np.array([(x, y) for y, x in pth[i0:]], float)
        if len(xy) >= 6:
            rays.append(xy)
    return rays, np.array([cx, cy])


def build_star(L):
    mask = L.star > .5
    dt = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5).astype(np.float32)
    rays, c = star_rays(mask)
    ang = lambda r: (math.atan2(r[-1, 1] - c[1], r[-1, 0] - c[0]) + math.pi / 2) % (2 * math.pi)
    rays.sort(key=ang)                       # clockwise from the top
    n = len(rays)
    order = [(k * 5) % n for k in range(n)]  # jump around the star: a sparkly, hand-flicked rhythm
    strokes = [Stroke("dab", np.array([c, c + [6, 0]]), TL["star_t0"], TL["star_t0"] + .20,
                      w=float(dt[int(c[1]), int(c[0])]) * 1.05, seed=1.0, ease=(.6, .6), sigma=0, nb=3, bristle=.45)]
    for slot, k in enumerate(order):
        t0 = TL["star_t0"] + .12 + slot * TL["ray_gap"]
        strokes.append(Stroke(f"ray{k}", rays[k], t0, t0 + TL["ray_dur"], dt_img=dt, seed=5.0 + 1.3 * k,
                              ease=(.35, .7), sigma=2.0, bristle=1.0, nb=3, w_min=3))
    b = bind_pixels(L.star, strokes)
    tex = texture(b, strokes, .05)
    col = L.orange[None, :] * (1 + tex)[:, None]
    return strokes, b, col, c


def build_text(L):
    mask = L.text > .5
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    comps = sorted([i for i in range(1, n) if stats[i, 4] > 50], key=lambda i: stats[i, 0])
    parts, strokes = [], []
    for k, i in enumerate(comps):
        x, y, w, h, _ = stats[i]
        yc = y + h / 2
        t0 = TL["text_t0"] + k * TL["letter_gap"]
        st = Stroke(f"letter{k}", np.array([[x - 8, yc], [x + w + 8, yc]]), t0, t0 + TL["letter_dur"],
                    w=h / 2 + 10, seed=11.0 + 2.3 * k, ease=(.5, .5), sigma=0, bristle=.95, nb=6, tip=.55)
        b = bind_pixels(L.text, [st], region=(lab == i))
        b["sid"] = np.full(len(b["xs"]), k)
        parts.append(b)
        strokes.append(st)
    b = {key: np.concatenate([p[key] for p in parts]) for key in parts[0]}
    return strokes, b


def build_balloon(L):
    mask = L.balloon > .5
    cy, cx = ndi.center_of_mass(mask)
    R = math.sqrt(mask.sum() / math.pi)
    wb = 13.5 * S
    pitch = 1.55 * wb
    r0, r1 = 1.5 * S, R - .72 * wb
    psi = np.linspace(2 * math.pi * r0 / pitch, 2 * math.pi * r1 / pitch, 1500)
    r = pitch * psi / (2 * math.pi)
    pts = np.stack([cx + r * np.cos(psi - 1.2), cy + r * np.sin(psi - 1.2)], 1)
    st = Stroke("balloon", pts, *TL["balloon"], w=wb, seed=9.0, ease=(.55, .35), sigma=0, bristle=.9, nb=5)
    b = bind_pixels(L.balloon, [st])
    tex = texture(b, [st], .07)
    col = L.orange[None, :] * (1 + tex)[:, None]
    return [st], b, col, np.array([cx, cy]), R


# ----------------------------------------------------------------------------- the scene
def make_paper(h, w, base):
    rng = np.random.RandomState(7)

    def field(sig, amp):
        n = cv2.GaussianBlur(rng.randn(h, w).astype(np.float32), (0, 0), sig)
        return n / n.std() * amp
    lum = field(.8, .55) + field(5.0, .55) + field(55.0, .8)
    warm = field(90.0, .5)
    paper = np.empty((h, w, 3), np.float32)
    paper[..., 0] = base[0] + lum + .5 * warm
    paper[..., 1] = base[1] + lum
    paper[..., 2] = base[2] + lum - .6 * warm
    return paper


class Scene:
    def __init__(self, L):
        self.SW, self.SH = (L.W0 + 2 * PAD) * S, (L.H0 + 2 * PAD) * S
        self.k0 = OUT_W / (L.W0 * S)
        self.paper = make_paper(self.SH, self.SW, L.paper)
        yy, xx = np.mgrid[:OUT_H, :OUT_W].astype(np.float32)
        r2 = ((xx - OUT_W / 2) / (OUT_W / 2)) ** 2 + ((yy - OUT_H / 2) / (OUT_H / 2)) ** 2
        self.vig = (1 - .045 * r2 / 2).astype(np.float32)
        cam = np.array(CAM_KEYS, float)
        self.cam = [PchipInterpolator(cam[:, 0], cam[:, i]) for i in (1, 2, 3)]

        ink_strokes, ink_b, ink_alpha, names = build_ink(L)
        star_strokes, star_b, star_col, star_c = build_star(L)
        text_strokes, text_b = build_text(L)
        bal_strokes, bal_b, bal_col, bal_c, bal_R = build_balloon(L)
        self.debug = dict(ink=ink_strokes, star=star_strokes, text=text_strokes, bal=bal_strokes)
        self.star_c = (star_c + OFF)
        self.bal_c, self.bal_R = bal_c + OFF, bal_R

        # the string rides with the balloon (it is one rigid "stick" that sways at the knot)
        i_str = names.index("string")
        is_str = ink_b["sid"] == i_str

        def sub(b, m):
            return {k: v[m] for k, v in b.items()}
        stem_b = sub(ink_b, is_str)
        rest_b = sub(ink_b, ~is_str)
        stem_strokes = [ink_strokes[i_str]]
        rest_strokes = [s for i, s in enumerate(ink_strokes) if i != i_str]

        Pstar = Paint(star_b, star_col, star_strokes)
        Ptext = Paint(text_b, np.tile(L.ink, (len(text_b["xs"]), 1)), text_strokes)
        Pbal = Paint(bal_b, bal_col, bal_strokes)
        Pstem = Paint(stem_b, np.tile(L.ink, (len(stem_b["xs"]), 1)), stem_strokes, alpha=ink_alpha[is_str])
        Prest = Paint(rest_b, np.tile(L.ink, (len(rest_b["xs"]), 1)), rest_strokes, alpha=ink_alpha[~is_str])

        knot = (np.array([434.0, 462.0]) + PAD) * S      # pivot of the string

        def star_matrix(t):
            ang = -.9 * (1 - ease_out_cubic((t - TL["star_t0"]) / 2.0))
            sc = .9 + .1 * ease_out_cubic((t - TL["star_t0"]) / 1.5)
            return affine_about(self.star_c[0], self.star_c[1], ang, sc)

        def balloon_matrix(t):
            M = np.eye(3)
            tp = (t - TL["pop_t"]) / .7
            if 0 <= tp <= 1:
                sc = 1 + .09 * math.exp(-4.5 * tp) * math.sin(2 * math.pi * 1.25 * tp)
                M = affine_about(self.bal_c[0], self.bal_c[1], 0, sc) @ M
            ts = t - TL["kick"]
            if ts > 0:
                ang = .12 * math.exp(-ts / .85) * math.sin(2 * math.pi * .95 * ts)
                M = affine_about(knot[0], knot[1], ang, 1.0) @ M
            return M

        self.groups = [
            Group([Pstar], star_matrix, margin=int(34 * S)),
            Group([Ptext]),
            Group([Pbal, Pstem], balloon_matrix, margin=int(24 * S)),
            Group([Prest]),
        ]
        long = ink_strokes[names.index("long")]
        tip_pos = long.xy[-1] + OFF
        self.fx = make_droplets(self.bal_c, self.bal_R, tip_pos, long.T[-1], L.orange, L.ink)

    def camera(self, t):
        cx, cy, z = (float(f(min(max(t, 0), DURATION))) for f in self.cam)
        sc = self.k0 * z
        cxs, cys = (cx + PAD) * S, (cy + PAD) * S
        hw, hh = OUT_W / (2 * sc), OUT_H / (2 * sc)
        cxs = min(max(cxs, hw), self.SW - hw)
        cys = min(max(cys, hh), self.SH - hh)
        return np.array([[sc, 0, OUT_W / 2 - sc * cxs], [0, sc, OUT_H / 2 - sc * cys]], np.float64)

    def render(self, t):
        frame = self.paper.copy()
        for g in self.groups:
            g.draw(frame, t)
        for f in self.fx:
            f.draw(frame, t)
        # camera with motion blur (180-degree shutter): average a few sub-frame camera poses
        h = .25 / FPS
        M0, M1 = self.camera(t - h), self.camera(t + h)
        shift = np.abs(M1 - M0)[:, 2].max() + abs(M1[0, 0] - M0[0, 0]) * OUT_W / 2
        n = int(np.clip(np.ceil(shift / 3.0), 1, 8))
        out = 0
        for k in range(n):
            M = M0 + (M1 - M0) * ((k + .5) / n)
            out = out + cv2.warpAffine(frame, M, (OUT_W, OUT_H), flags=cv2.INTER_CUBIC,
                                       borderMode=cv2.BORDER_REPLICATE)
        out = out / n
        out *= self.vig[..., None]
        return np.clip(out + .5, 0, 255).astype(np.uint8)


# ----------------------------------------------------------------------------- debug + CLI
def debug_overlay(sc, L, path):
    """Draw every brush path (start dot + name) over the artwork."""
    A = np.maximum(np.maximum(L.line, L.text), np.maximum(L.balloon, L.star))
    vis = (255 * (1 - .3 * A))[..., None].repeat(3, 2).astype(np.uint8)
    rng = np.random.RandomState(4)
    for grp in sc.debug.values():
        for st in grp:
            col = tuple(int(c) for c in rng.randint(20, 200, 3))
            pts = st.xy.astype(np.int32).reshape(-1, 1, 2)
            cv2.polylines(vis, [pts], False, col, 2)
            cv2.circle(vis, tuple(pts[0, 0]), 6, col, -1)
            cv2.putText(vis, st.name, tuple(pts[0, 0] + [6, -6]), cv2.FONT_HERSHEY_SIMPLEX, .6, col, 2)
    cv2.imwrite(path, vis)


def encode(frames_iter, out_path, n_frames):
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{OUT_W}x{OUT_H}", "-r", str(FPS), "-i", "-",
           "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
           "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-tune", "animation",
           "-profile:v", "high", "-level", "4.2", "-g", "120", "-movflags", "+faststart",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
           out_path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    for i, fr in enumerate(frames_iter):
        p.stdin.write(fr.tobytes())
        if i % 60 == 0:
            print(f"  frame {i}/{n_frames}  {time.time() - t0:5.1f}s", flush=True)
    p.stdin.close()
    p.wait()


_SCENE = None


def _render_idx(i):
    return _SCENE.render(i / FPS)


def main():
    global _SCENE
    ap = argparse.ArgumentParser()
    ap.add_argument("--stills", nargs="*", type=float, help="write PNG stills at these times")
    ap.add_argument("--debug", action="store_true")
    ap.add_argument("--out", default=OUT_PATH)
    ap.add_argument("--jobs", type=int, default=os.cpu_count())
    ap.add_argument("--outdir", default=os.path.join(HERE, "stills"))
    args = ap.parse_args()

    t0 = time.time()
    L = load_layers()
    sc = Scene(L)
    _SCENE = sc
    print(f"scene ready in {time.time() - t0:.1f}s  ({sc.SW}x{sc.SH} scene px)")
    if args.debug:
        debug_overlay(sc, L, os.path.join(HERE, "debug_paths.png"))
        return
    if args.stills is not None:
        os.makedirs(args.outdir, exist_ok=True)
        for t in args.stills:
            t1 = time.time()
            fr = sc.render(t)
            cv2.imwrite(os.path.join(args.outdir, f"t{t:05.2f}.png"), fr[:, :, ::-1])
            print(f"  t={t:5.2f}s  {time.time() - t1:.2f}s")
        return
    import multiprocessing as mp
    n = int(round(DURATION * FPS))
    ctx = mp.get_context("fork")
    with ctx.Pool(args.jobs) as pool:
        encode(pool.imap(_render_idx, range(n), chunksize=2), args.out, n)
    print(f"wrote {args.out}  ({time.time() - t0:.1f}s total)")


if __name__ == "__main__":
    main()
