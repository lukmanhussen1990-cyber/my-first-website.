"""Tiny signed-distance-field modeling kit (numpy) + chunked marching cubes.

Shapes are lists of primitives combined with smooth union / smooth subtraction,
evaluated on a grid and meshed with skimage marching cubes.
"""
import numpy as np
from skimage.measure import marching_cubes


def _len(v):
    return np.sqrt(np.einsum('...i,...i->...', v, v))


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def smax(a, b, k):
    return -smin(-a, -b, k)


def rot_matrix(rx=0.0, ry=0.0, rz=0.0):
    """XYZ euler (degrees) -> 3x3 rotation matrix (local->world)."""
    rx, ry, rz = np.radians([rx, ry, rz])
    cx, sx, cy, sy, cz, sz = np.cos(rx), np.sin(rx), np.cos(ry), np.sin(ry), np.cos(rz), np.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def frame_from_axes(y_axis, up_hint=(0, 0, 1)):
    """Rotation whose local Y points along y_axis."""
    y = np.asarray(y_axis, float); y /= np.linalg.norm(y)
    up = np.asarray(up_hint, float)
    x = np.cross(y, up)
    if np.linalg.norm(x) < 1e-6:
        x = np.cross(y, (1, 0, 0))
    x /= np.linalg.norm(x)
    z = np.cross(x, y)
    return np.stack([x, y, z], axis=1)


class Prim:
    """A primitive. kind in sphere/ellipsoid/roundcone/box/plane. op in union/sub/inter."""

    def __init__(self, kind, op='union', k=0.0, bone=None, tag=None, **kw):
        self.kind, self.op, self.k, self.bone, self.tag = kind, op, k, bone, tag
        self.kw = kw
        if 'rot' in kw and kw['rot'] is not None and np.ndim(kw['rot']) == 1:
            kw['rot'] = rot_matrix(*kw['rot'])

    def dist(self, p):
        kw = self.kw
        if self.kind == 'sphere':
            return _len(p - kw['c']) - kw['r']
        if self.kind == 'ellipsoid':
            q = p - kw['c']
            R = kw.get('rot')
            if R is not None:
                q = q @ R  # world -> local (R orthonormal)
            r = np.asarray(kw['r'], float)
            k0 = _len(q / r)
            k1 = _len(q / (r * r))
            return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)
        if self.kind == 'roundcone':
            return _roundcone(p, np.asarray(kw['a'], float), np.asarray(kw['b'], float), kw['ra'], kw.get('rb', kw['ra']))
        if self.kind == 'box':
            q = p - kw['c']
            R = kw.get('rot')
            if R is not None:
                q = q @ R
            r = kw.get('round', 0.0)
            b = np.asarray(kw['h'], float) - r
            qa = np.abs(q) - b
            return _len(np.maximum(qa, 0.0)) + np.minimum(np.max(qa, axis=-1), 0.0) - r
        if self.kind == 'plane':
            n = np.asarray(kw['n'], float); n = n / np.linalg.norm(n)
            return p @ n - kw['h']
        if self.kind == 'torus':
            q = p - kw['c']
            R = kw.get('rot')
            if R is not None:
                q = q @ R
            qx = np.sqrt(q[..., 0] ** 2 + q[..., 1] ** 2) - kw['R']
            return np.sqrt(qx ** 2 + q[..., 2] ** 2) - kw['r']
        if self.kind == 'func':
            return kw['f'](p)
        raise ValueError(self.kind)


def _roundcone(p, a, b, r1, r2):
    ba = b - a
    l2 = ba @ ba
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = p - a
    y = pa @ ba
    z = y - l2
    xv = pa * l2 - y[..., None] * ba
    x2 = np.einsum('...i,...i->...', xv, xv)
    y2 = y * y * l2
    z2 = z * z * l2
    k = np.sign(rr) * rr * rr * x2
    d3 = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - r1
    d1 = np.sqrt(x2 + z2) * il2 - r2
    d2 = np.sqrt(x2 + y2) * il2 - r1
    out = np.where(np.sign(z) * a2 * z2 > k, d1, np.where(np.sign(y) * a2 * y2 < k, d2, d3))
    return out


def bound(pr):
    """Bounding sphere (center, radius) of a primitive or None if unbounded."""
    kw = pr.kw
    if pr.kind == 'sphere':
        return np.asarray(kw['c'], float), kw['r']
    if pr.kind == 'ellipsoid':
        return np.asarray(kw['c'], float), float(np.max(kw['r']))
    if pr.kind == 'roundcone':
        a, b = np.asarray(kw['a'], float), np.asarray(kw['b'], float)
        return (a + b) / 2, np.linalg.norm(b - a) / 2 + max(kw['ra'], kw.get('rb', kw['ra']))
    if pr.kind == 'box':
        return np.asarray(kw['c'], float), float(np.linalg.norm(kw['h']))
    if pr.kind == 'torus':
        return np.asarray(kw['c'], float), kw['R'] + kw['r']
    return None


def prune(prims, c, h, margin=0.08):
    out = []
    for pr in prims:
        bs = bound(pr)
        if bs is None or np.linalg.norm(bs[0] - c) - bs[1] - h < margin:
            out.append(pr)
    return out


def evaluate(prims, p, extra=None):
    d = np.full(p.shape[:-1], 1e3, dtype=np.float64)
    for pr in prims:
        di = pr.dist(p)
        if pr.op == 'union':
            d = smin(d, di, pr.k)
        elif pr.op == 'sub':
            d = smax(d, -di, pr.k)
        elif pr.op == 'inter':
            d = smax(d, di, pr.k)
    if extra is not None:
        d = extra(p, d)
    return d


def mesh_sdf(prims, bmin, bmax, step, block=96, extra=None, verbose=True):
    """Chunked marching cubes. Returns verts (N,3), faces (M,3)."""
    bmin = np.asarray(bmin, float); bmax = np.asarray(bmax, float)
    n = np.ceil((bmax - bmin) / step).astype(int) + 1
    all_v, all_f, voff = [], [], 0
    half_diag = np.sqrt(3) * block * step * 0.5
    for i0 in range(0, n[0] - 1, block):
        for j0 in range(0, n[1] - 1, block):
            for k0 in range(0, n[2] - 1, block):
                i1, j1, k1 = min(i0 + block + 1, n[0]), min(j0 + block + 1, n[1]), min(k0 + block + 1, n[2])
                if min(i1 - i0, j1 - j0, k1 - k0) < 2:
                    continue
                c = bmin + step * np.array([(i0 + i1 - 1) / 2, (j0 + j1 - 1) / 2, (k0 + k1 - 1) / 2])
                dc = evaluate(prims, c[None, :], extra)[0]
                if abs(dc) > half_diag * 1.1 + 0.02:
                    continue
                local = prune(prims, c, half_diag)
                xs = bmin[0] + step * np.arange(i0, i1)
                ys = bmin[1] + step * np.arange(j0, j1)
                zs = bmin[2] + step * np.arange(k0, k1)
                P = np.stack(np.meshgrid(xs, ys, zs, indexing='ij'), axis=-1)
                D = evaluate(local, P.reshape(-1, 3), extra).reshape(P.shape[:-1]).astype(np.float32)
                if D.min() > 0 or D.max() < 0:
                    continue
                v, f, _, _ = marching_cubes(D, 0.0, spacing=(step, step, step), allow_degenerate=False)
                v = v + np.array([xs[0], ys[0], zs[0]])
                all_v.append(v); all_f.append(f + voff); voff += len(v)
    V = np.concatenate(all_v); F = np.concatenate(all_f)
    # weld block seams
    key = np.round(V / (step * 1e-3)).astype(np.int64)
    _, idx, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1)
    V = V[idx]; F = inv[F]
    good = (F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])
    F = F[good]
    # marching cubes winding -> outward normals check (flip if needed)
    if verbose:
        print(f"mesh_sdf: {len(V)} verts {len(F)} faces")
    return V, F
