"""Mesh the caveman SDF and compute per-part skin weights.

usage: python3 build_body_mesh.py <out.npz> [voxel]
"""
import sys
import time
import numpy as np

sys.path.insert(0, __file__.rsplit('/', 1)[0])
import body_def as B  # noqa: E402
from sdf import mesh_sdf  # noqa: E402


def part_weights(V, P, top=4):
    """Soft assignment of vertices to parts from per-part distances."""
    names = list(P.keys())
    D = np.empty((len(V), len(names)), dtype=np.float32)
    for j, nm in enumerate(names):
        D[:, j] = P[nm](V.astype(np.float64))
    dmin = D.min(1, keepdims=True)
    # blend width: small on fingers / face, larger on big joints
    tau = np.full(len(names), 0.012, dtype=np.float32)
    for j, nm in enumerate(names):
        if nm[:-2].rstrip('123') in ('thumb', 'index', 'middle', 'ring', 'pinky'):
            tau[j] = 0.004
        elif nm in ('head', 'jaw', 'ears'):
            tau[j] = 0.004
        elif nm.startswith(('hand', 'toe', 'foot')):
            tau[j] = 0.007
        elif nm.startswith(('hips', 'spine', 'chest')):
            tau[j] = 0.03
        elif nm == 'neck':
            tau[j] = 0.012
    W = np.exp(-np.maximum(D - dmin, 0) / tau[None, :])
    # keep top-k
    idx = np.argsort(-W, axis=1)[:, :top]
    Wt = np.take_along_axis(W, idx, 1)
    Wt[Wt < 0.02] = 0
    Wt /= Wt.sum(1, keepdims=True)
    return names, idx.astype(np.int16), Wt.astype(np.float32), D


def main():
    out = sys.argv[1]
    voxel = float(sys.argv[2]) if len(sys.argv) > 2 else 0.003
    t = time.time()
    skin, P = B.build_skin()
    bbox = None
    if len(sys.argv) > 3 and sys.argv[3] == 'head':
        bbox = (np.array([-0.10, -0.15, 1.40]), np.array([0.10, 0.12, 1.70]))
    V, F = mesh_sdf(skin, voxel, bbox=bbox)
    print('meshed in', round(time.time() - t, 1), 's')
    t = time.time()
    names, idx, W, D = part_weights(V, P)
    print('weights in', round(time.time() - t, 1), 's')
    joints = {k: v for k, v in B.J.items()}
    chains = {}
    for side in ('L', 'R'):
        for f, pts in B.finger_chains(side).items():
            chains[f'{f}.{side}'] = np.array(pts)
    np.savez_compressed(out, V=V, F=F, part_names=np.array(names), part_idx=idx, part_w=W,
                        joint_names=np.array(list(joints.keys())),
                        joint_pos=np.array(list(joints.values())),
                        chain_names=np.array(list(chains.keys())),
                        chain_pos=np.array(list(chains.values())))
    print('saved', out)


if __name__ == '__main__':
    main()
