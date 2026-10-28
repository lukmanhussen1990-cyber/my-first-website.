"""Mesh the caveman SDFs (head, body, tunic) and compute skin weights.

usage: python3 build_meshes.py <outdir> [head|body|tunic|all] [voxel_scale]
"""
import os
import sys
import time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import body_def as B  # noqa: E402
from sdf import mesh_sdf, Shape  # noqa: E402

FINGERS = ('thumb', 'index', 'middle', 'ring', 'pinky')


def part_tau(nm):
    base = nm.split('.')[0].rstrip('123')
    if base in FINGERS:
        return 0.004
    if nm in ('head', 'jaw', 'ears'):
        return 0.004
    if base in ('hand', 'toe', 'foot'):
        return 0.007
    if base in ('hips', 'spine', 'chest'):
        return 0.03
    if base in ('upperarm', 'forearm'):
        return 0.02
    return 0.014


def part_weights(V, P, names=None, tau_scale=1.0, top=4):
    # exact distances: the bbox culling lower bound would leak into the kernel
    Shape.margin = 10.0
    try:
        return _part_weights(V, P, names, tau_scale, top)
    finally:
        Shape.margin = 0.06


def _part_weights(V, P, names=None, tau_scale=1.0, top=4):
    names = list(P.keys()) if names is None else names
    lo, hi = V.min(0) - 0.08, V.max(0) + 0.08
    use = [n for n in names if np.all(P[n].bbox[0] <= hi) and np.all(P[n].bbox[1] >= lo)]
    D = np.empty((len(V), len(use)), dtype=np.float32)
    Vd = V.astype(np.float64)
    for j, nm in enumerate(use):
        for i in range(0, len(V), 400000):
            D[i:i + 400000, j] = P[nm](Vd[i:i + 400000])
    dmin = D.min(1, keepdims=True)
    tau = np.array([part_tau(n) * tau_scale for n in use], dtype=np.float32)
    # compact smooth kernel: exactly zero beyond 3*tau (no hard cut-off steps)
    t = np.clip(np.maximum(D - dmin, 0) / (3.0 * tau[None, :]), 0, 1)
    W = (1 - t * t) ** 2
    k = min(top, len(use))
    idx = np.argsort(-W, axis=1)[:, :k]
    Wt = np.take_along_axis(W, idx, 1)
    Wt /= Wt.sum(1, keepdims=True)
    return use, idx.astype(np.int16), Wt.astype(np.float32)


def project_to_skin(f, V, iters=3):
    X = V.astype(np.float64).copy()
    h = 0.001
    for _ in range(iters):
        d = np.empty(len(X))
        g = np.zeros_like(X)
        for i in range(0, len(X), 300000):
            sl = slice(i, i + 300000)
            d[sl] = f(X[sl])
            for a in range(3):
                e = np.zeros(3); e[a] = h
                g[sl, a] = (f(X[sl] + e) - f(X[sl] - e)) / (2 * h)
        g /= np.linalg.norm(g, axis=1, keepdims=True) + 1e-9
        X -= g * d[:, None]
    return X


def save(path, V, F, names, idx, W, **extra):
    np.savez_compressed(path, V=V, F=F, part_names=np.array(names), part_idx=idx, part_w=W, **extra)
    print('saved', path, len(V), 'verts', len(F), 'faces')


def main():
    out = sys.argv[1]
    what = sys.argv[2] if len(sys.argv) > 2 else 'all'
    vs = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    os.makedirs(out, exist_ok=True)
    skin, P = B.build_skin()
    if what in ('head', 'all'):
        t = time.time()
        bbox = (np.array([-0.185, -0.15, 1.418]), np.array([0.185, 0.125, 1.70]))
        V, F = mesh_sdf(skin, 0.0012 * vs, bbox=bbox)
        names, idx, W = part_weights(V, P, ['head', 'ears', 'jaw', 'neck', 'chest'])
        save(f'{out}/head.npz', V, F, names, idx, W)
        print('head', round(time.time() - t, 1), 's')
    if what in ('body', 'all'):
        t = time.time()
        V, F = mesh_sdf(skin, 0.0016 * vs)
        names, idx, W = part_weights(V, P)
        J = B.J
        chains = {}
        for side in ('L', 'R'):
            for f, pts in B.finger_chains(side).items():
                chains[f'{f}.{side}'] = np.array(pts)
        save(f'{out}/body.npz', V, F, names, idx, W,
             joint_names=np.array(list(J.keys())), joint_pos=np.array(list(J.values())),
             chain_names=np.array(list(chains.keys())), chain_pos=np.array(list(chains.values())))
        print('body', round(time.time() - t, 1), 's')
    if what in ('neighbour', 'all'):
        t = time.time()
        V, F = mesh_sdf(B.neighbour_arm_shape(), 0.0014 * vs)
        np.savez_compressed(f'{out}/neighbour.npz', V=V, F=F)
        print('neighbour', round(time.time() - t, 1), 's', len(V))
    if what in ('tunic', 'all'):
        t = time.time()
        tun = B.tunic_shape()
        V, F = mesh_sdf(tun, 0.0020 * vs)
        # weights of the body surface point under each tunic vertex (follows the skin exactly)
        Vp = project_to_skin(skin, V)
        names, idx, W = part_weights(Vp, P, ['hips', 'spine', 'chest', 'thigh.L', 'thigh.R',
                                             'upperarm.L', 'upperarm.R', 'neck'], tau_scale=1.0)
        save(f'{out}/tunic.npz', V, F, names, idx, W)
        print('tunic', round(time.time() - t, 1), 's')


if __name__ == '__main__':
    main()
