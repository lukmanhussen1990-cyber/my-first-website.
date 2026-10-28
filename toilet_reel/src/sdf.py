"""Tiny signed-distance-field toolkit used to sculpt the characters in code.

Shapes are numpy-vectorised; a shape is any object with .eval(P) -> distances
and .bbox -> (lo, hi).  Meshing is block-sparse: a coarse pass finds the blocks
that touch the surface and only those are sampled at full resolution.
"""
import numpy as np

BIG = 1e3


def _v(x):
    return np.asarray(x, dtype=np.float64)


def rot_from_axes(x_axis, y_axis):
    """3x3 matrix whose columns are an orthonormal frame built from two hints."""
    x = _v(x_axis); x = x / np.linalg.norm(x)
    y = _v(y_axis); y = y - x * np.dot(x, y); y = y / np.linalg.norm(y)
    z = np.cross(x, y)
    return np.stack([x, y, z], axis=1)


def rot_euler(rx=0.0, ry=0.0, rz=0.0):
    cx, sx = np.cos(rx), np.sin(rx)
    cy, sy = np.cos(ry), np.sin(ry)
    cz, sz = np.cos(rz), np.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1 - h) + a * h - k * h * (1 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


class Shape:
    bbox = None

    def eval(self, P):
        raise NotImplementedError

    margin = 0.06  # exact evaluation this far outside the bbox (> any blend radius)

    def __call__(self, P):
        lo, hi = self.bbox
        m = self.margin
        # cheap reject: points far outside the bbox get a conservative distance
        out = np.full(len(P), BIG)
        inside = np.all((P >= lo - m) & (P <= hi + m), axis=1)
        if inside.any():
            out[inside] = self.eval(P[inside])
        # outside the bbox the true distance is at least the bbox distance
        if (~inside).any():
            q = np.maximum(np.maximum(lo - P[~inside], P[~inside] - hi), 0.0)
            out[~inside] = np.linalg.norm(q, axis=1) + 0.0
        return out


class Sphere(Shape):
    def __init__(self, c, r):
        self.c = _v(c); self.r = float(r)
        self.bbox = (self.c - r, self.c + r)

    def eval(self, P):
        return np.linalg.norm(P - self.c, axis=1) - self.r


class Ellipsoid(Shape):
    def __init__(self, c, radii, R=None):
        self.c = _v(c); self.rad = _v(radii)
        self.R = np.eye(3) if R is None else _v(R)
        ext = np.abs(self.R) @ self.rad
        self.bbox = (self.c - ext, self.c + ext)

    def eval(self, P):
        q = (P - self.c) @ self.R  # into local frame
        k0 = np.linalg.norm(q / self.rad, axis=1)
        k1 = np.linalg.norm(q / (self.rad * self.rad), axis=1)
        k1 = np.maximum(k1, 1e-9)
        return k0 * (k0 - 1.0) / k1


class RoundCone(Shape):
    """Capsule between a and b with radius ra at a and rb at b."""

    def __init__(self, a, b, ra, rb=None):
        self.a = _v(a); self.b = _v(b)
        self.ra = float(ra); self.rb = float(ra if rb is None else rb)
        r = max(self.ra, self.rb)
        self.bbox = (np.minimum(self.a, self.b) - r, np.maximum(self.a, self.b) + r)

    def eval(self, P):
        a, b, r1, r2 = self.a, self.b, self.ra, self.rb
        ba = b - a
        l2 = float(np.dot(ba, ba))
        rr = r1 - r2
        a2 = l2 - rr * rr
        il2 = 1.0 / l2
        pa = P - a
        y = pa @ ba
        z = y - l2
        xv = pa * l2 - np.outer(y, ba)
        x2 = np.einsum('ij,ij->i', xv, xv)
        y2 = y * y * l2
        z2 = z * z * l2
        k = np.sign(rr) * rr * rr * x2
        d = np.empty(len(P))
        c1 = np.sign(z) * a2 * z2 > k
        c2 = (~c1) & (np.sign(y) * a2 * y2 < k)
        c3 = ~(c1 | c2)
        d[c1] = np.sqrt(x2[c1] + z2[c1]) * il2 - r2
        d[c2] = np.sqrt(x2[c2] + y2[c2]) * il2 - r1
        d[c3] = (np.sqrt(x2[c3] * a2 * il2) + y[c3] * rr) * il2 - r1
        return d


class RoundBox(Shape):
    def __init__(self, c, half, R=None, round_r=0.0):
        self.c = _v(c); self.h = _v(half); self.rr = float(round_r)
        self.R = np.eye(3) if R is None else _v(R)
        ext = np.abs(self.R) @ (self.h + self.rr)
        self.bbox = (self.c - ext, self.c + ext)

    def eval(self, P):
        q = np.abs((P - self.c) @ self.R) - self.h
        return (np.linalg.norm(np.maximum(q, 0.0), axis=1)
                + np.minimum(np.max(q, axis=1), 0.0) - self.rr)


class Torus(Shape):
    """Torus around local z axis of frame R."""

    def __init__(self, c, R_major, r_minor, R=None):
        self.c = _v(c); self.R0 = float(R_major); self.r = float(r_minor)
        self.R = np.eye(3) if R is None else _v(R)
        e = self.R0 + self.r
        self.bbox = (self.c - e, self.c + e)

    def eval(self, P):
        q = (P - self.c) @ self.R
        qx = np.sqrt(q[:, 0] ** 2 + q[:, 1] ** 2) - self.R0
        return np.sqrt(qx * qx + q[:, 2] ** 2) - self.r


class HalfSpace(Shape):
    """Solid on the side opposite to normal n: dist = dot(p - c, n)."""

    def __init__(self, c, n, bbox):
        self.c = _v(c); self.n = _v(n) / np.linalg.norm(n)
        self.bbox = bbox

    def __call__(self, P):
        return (P - self.c) @ self.n

    def eval(self, P):
        return self(P)


# --------------------------------------------------------------------------- combinators
class Union(Shape):
    def __init__(self, shapes, k=0.0):
        self.shapes = list(shapes); self.k = k
        los = np.array([s.bbox[0] for s in self.shapes])
        his = np.array([s.bbox[1] for s in self.shapes])
        self.bbox = (los.min(0) - k, his.max(0) + k)

    def eval(self, P):
        d = None
        for s in self.shapes:
            ds = s(P)
            d = ds if d is None else smin(d, ds, self.k)
        return d


class Subtract(Shape):
    """base minus cutters (smooth)."""

    def __init__(self, base, cutters, k=0.0):
        self.base = base; self.cutters = list(cutters); self.k = k
        self.bbox = base.bbox

    def eval(self, P):
        d = self.base(P)
        for c in self.cutters:
            d = smax(d, -c(P), self.k)
        return d


class Intersect(Shape):
    def __init__(self, a, b, k=0.0):
        self.a = a; self.b = b; self.k = k
        self.bbox = a.bbox

    def eval(self, P):
        return smax(self.a(P), self.b(P), self.k)


class Offset(Shape):
    def __init__(self, s, off):
        self.s = s; self.off = off
        self.bbox = (s.bbox[0] - max(off, 0), s.bbox[1] + max(off, 0))

    def __call__(self, P):
        return self.s(P) - self.off

    def eval(self, P):
        return self(P)


class Func(Shape):
    def __init__(self, f, bbox):
        self.f = f; self.bbox = bbox

    def __call__(self, P):
        return self.f(P)

    def eval(self, P):
        return self.f(P)


# --------------------------------------------------------------------------- meshing
def mesh_sdf(shape, voxel, bbox=None, block=16, coarse_mult=4, verbose=True):
    """Block-sparse marching cubes. Returns (verts, faces)."""
    from skimage.measure import marching_cubes
    lo, hi = shape.bbox if bbox is None else bbox
    lo = _v(lo) - 2 * voxel; hi = _v(hi) + 2 * voxel
    n = np.ceil((hi - lo) / voxel).astype(int) + 1
    nb = np.ceil((n - 1) / block).astype(int)
    # coarse pass on block corners/centres to find candidate blocks
    bs = block * voxel
    cx = lo[0] + (np.arange(nb[0]) + 0.5) * bs
    cy = lo[1] + (np.arange(nb[1]) + 0.5) * bs
    cz = lo[2] + (np.arange(nb[2]) + 0.5) * bs
    G = np.stack(np.meshgrid(cx, cy, cz, indexing='ij'), -1).reshape(-1, 3)
    dc = np.empty(len(G))
    for i in range(0, len(G), 200000):
        dc[i:i + 200000] = shape(G[i:i + 200000])
    half_diag = 0.5 * bs * np.sqrt(3) * 1.05 + voxel
    active = np.nonzero(np.abs(dc) < half_diag)[0]
    if verbose:
        print(f"grid {n}, blocks {nb.prod()}, active {len(active)}")
    idx3 = np.stack(np.unravel_index(active, tuple(nb)), -1)
    # evaluate active blocks in batches
    ar = np.arange(block + 1) * voxel
    lx, ly, lz = np.meshgrid(ar, ar, ar, indexing='ij')
    local = np.stack([lx, ly, lz], -1).reshape(-1, 3)
    verts_all = []; faces_all = []; nv = 0
    batch = max(1, 300000 // len(local))
    for bi in range(0, len(idx3), batch):
        chunk = idx3[bi:bi + batch]
        origins = lo + chunk * bs
        P = (origins[:, None, :] + local[None, :, :]).reshape(-1, 3)
        D = shape(P).reshape(len(chunk), block + 1, block + 1, block + 1)
        for j in range(len(chunk)):
            vol = D[j]
            if vol.min() > 0 or vol.max() < 0:
                continue
            try:
                v, f, _, _ = marching_cubes(vol.astype(np.float32), level=0.0,
                                            spacing=(voxel, voxel, voxel),
                                            allow_degenerate=False)
            except (ValueError, RuntimeError):
                continue
            verts_all.append(v + origins[j]); faces_all.append(f + nv); nv += len(v)
    V = np.concatenate(verts_all); F = np.concatenate(faces_all)
    # weld duplicated vertices on block borders
    key = np.round(V / (voxel * 1e-3)).astype(np.int64)
    uniq, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1)
    V2 = V[first]
    F2 = inv[F]
    good = (F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2])
    F2 = F2[good]
    if verbose:
        print(f"mesh: {len(V2)} verts, {len(F2)} faces")
    # skimage winding: make normals point outward (towards +sdf)
    return V2.astype(np.float32), F2[:, ::-1].astype(np.int32)


def save_mesh(path, V, F, **extra):
    np.savez_compressed(path, V=V, F=F, **extra)
