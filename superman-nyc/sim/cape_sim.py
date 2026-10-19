"""Cape cloth simulation (position-based dynamics, numpy).

The cloth is simulated in a frame that translates with the cape anchor (Spine2 bone):
gravity, fictitious inertial force (-a_anchor), quadratic air drag against the relative
airflow (wind - v_anchor) and a little flutter; the top row is pinned to the shoulders and
the cloth is pushed out of capsules around the torso and legs.  The result is written as a
PC2 point cache in Spine2-local coordinates (the cape object follows the bone in Blender).

Run:  python3 cape_sim.py /opt/work/cache
"""
import os
import struct
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import timeline as TL  # noqa: E402

NR, NC = 20, 13          # rows (top->bottom), columns
LENGTH = 1.28
SUB = 12                 # substeps per frame
ITERS = 10


def rest_grid(attach):
    """Rest cape in Spine2-local coordinates (bone Y = up, Z = front, X = left)."""
    a = np.array(attach)
    # resample the attachment line to NC points
    t = np.linspace(0, 1, len(a))
    tt = np.linspace(0, 1, NC)
    top = np.stack([np.interp(tt, t, a[:, k]) for k in range(3)], 1)
    P = np.zeros((NR, NC, 3))
    for r in range(NR):
        f = r / (NR - 1)
        widen = 1.0 + 0.85 * f
        P[r] = top
        P[r, :, 0] = top[:, 0] * widen
        P[r, :, 1] = top[:, 1] - LENGTH * f
        P[r, :, 2] = top[:, 2] - 0.06 * f - 0.04 * np.sin(np.pi * f)      # hang slightly off the back
    return P.reshape(-1, 3)


def constraints(P):
    idx = lambda r, c: r * NC + c
    C = []
    for r in range(NR):
        for c in range(NC):
            for dr, dc, kind in ((0, 1, 0), (1, 0, 0), (1, 1, 1), (1, -1, 1), (0, 2, 2), (2, 0, 2)):
                rr, cc = r + dr, c + dc
                if 0 <= rr < NR and 0 <= cc < NC:
                    i, j = idx(r, c), idx(rr, cc)
                    C.append((i, j, np.linalg.norm(P[i] - P[j]), kind))
    C = np.array(C)
    return C[:, 0].astype(int), C[:, 1].astype(int), C[:, 2], C[:, 3].astype(int)


def vertex_normals(X):
    G = X.reshape(NR, NC, 3)
    du = np.gradient(G, axis=1)
    dv = np.gradient(G, axis=0)
    n = np.cross(du, dv).reshape(-1, 3)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-9)


def capsule_push(X, a, b, r):
    ab = b - a
    t = np.clip(((X - a) @ ab) / (ab @ ab + 1e-9), 0, 1)
    c = a + t[:, None] * ab
    d = X - c
    dist = np.linalg.norm(d, axis=1)
    m = dist < r
    if m.any():
        X[m] = c[m] + d[m] / (dist[m, None] + 1e-9) * r
    return X


def wind(t, X):
    """Ambient wind + gusts (world frame, m/s)."""
    base = np.array([1.1, 1.7, 0.0])
    g = 1.0 + 0.6 * np.sin(1.7 * t) * np.sin(0.63 * t + 1.0) + 0.35 * np.sin(4.1 * t + 0.3)
    w = base * g
    # scene 5: swirling turbulence in the dusty intersection
    if 29.5 < t < 35.2:
        w = w + np.array([np.sin(3.1 * t), np.cos(2.3 * t), 0.2 * np.sin(5.0 * t)]) * 1.3
    return w


def main(cache):
    A = np.load(f"{cache}/cape_anchor.npy")          # (F, 4, 4) world matrices
    attach = np.load(f"{cache}/cape_attach_local.npy")
    body = np.load(f"{cache}/body_points.npy")       # (F, 9, 3)
    F = len(A)
    assert np.isfinite(A).all() and np.isfinite(body).all(), "non-finite anchor data"
    R = A[:, :3, :3]
    T = A[:, :3, 3]
    P0 = rest_grid(attach)
    I, Jc, L0, kind = constraints(P0)
    stiff = np.where(kind == 0, 1.0, np.where(kind == 1, 0.8, 0.25))
    pins = np.arange(NC)
    ccount = (np.bincount(I, minlength=len(P0)) + np.bincount(Jc, minlength=len(P0))).astype(float)
    ccount = np.maximum(ccount, 1.0)[:, None]
    # anchor kinematics (per frame, finite differences)
    dt_f = 1.0 / TL.FPS
    V = np.gradient(T, dt_f, axis=0)
    Acc = np.gradient(V, dt_f, axis=0)
    amag = np.linalg.norm(Acc, axis=1, keepdims=True)
    Acc = Acc * np.minimum(1.0, 90.0 / (amag + 1e-9))          # clamp spikes (path start)
    X = (R[0] @ P0.T).T
    Xp = X.copy()
    out = np.zeros((F, len(P0), 3), np.float32)
    dt = dt_f / SUB
    g = np.array([0, 0, -9.81])
    rng = np.random.default_rng(3)
    phase = rng.uniform(0, 2 * np.pi, len(P0))
    for f in range(F):
        for s in range(SUB):
            a_ = (s + 0.5) / SUB
            fi = min(f + 1, F - 1)
            Rf = R[f] * (1 - a_) + R[fi] * a_
            Tf = T[f] * (1 - a_) + T[fi] * a_
            v_anchor = V[f] * (1 - a_) + V[fi] * a_
            acc_anchor = Acc[f] * (1 - a_) + Acc[fi] * a_
            t = (f + a_) / TL.FPS
            vel = (X - Xp) / dt
            air = wind(t, X) - v_anchor
            amag = np.linalg.norm(air)
            if amag > 28.0:                     # beyond this the cape simply streams
                air = air * (28.0 / amag)
            u = air[None, :] - vel
            un = np.linalg.norm(u, axis=1, keepdims=True)
            n = vertex_normals(X)
            drag = 0.14 * un * u + 0.22 * (np.sum(n * u, 1, keepdims=True) * un) * n
            speed = min(amag, 28.0)
            flutter = (0.02 * speed ** 1.5 + 0.3) * np.sin(phase[:, None] + t * (9 + 0.4 * speed)
                                                     + np.arange(len(P0))[:, None] * 0.37) * n
            acc = g - acc_anchor + drag + flutter
            Xn = X + (X - Xp) * 0.992 + acc * dt * dt
            Xp, X = X, Xn
            # pins
            Pw = (Rf @ P0[pins].T).T
            X[pins] = Pw
            for _ in range(ITERS):
                d = X[Jc] - X[I]
                dist = np.linalg.norm(d, axis=1) + 1e-9
                corr = (dist - L0) / dist * stiff
                # only stretch is resisted strongly; compression mildly (cloth buckles)
                corr = np.where(dist > L0, corr, corr * 0.3)
                delta = d * (0.5 * corr)[:, None]
                acc_c = np.zeros_like(X)
                np.add.at(acc_c, I, delta)
                np.add.at(acc_c, Jc, -delta)
                X += 1.6 * acc_c / ccount
                X[pins] = Pw
            # body collisions (capsules), in the anchor-centred frame
            bp = body[min(f + (1 if a_ > 0.5 else 0), F - 1)] - Tf
            hips, sp2, neck = bp[0], bp[1], bp[2]
            X = capsule_push(X, hips, neck, 0.19)
            X = capsule_push(X, bp[3], bp[4], 0.10)
            X = capsule_push(X, bp[4], bp[5], 0.075)
            X = capsule_push(X, bp[6], bp[7], 0.10)
            X = capsule_push(X, bp[7], bp[8], 0.075)
            X[pins] = Pw
        if not np.isfinite(X).all():
            raise RuntimeError(f"cape sim diverged at frame {f}")
        # store in Spine2-local coordinates
        out[f] = (R[f].T @ X.T).T
        if f % 100 == 0:
            print("cape frame", f, flush=True)
    write_pc2(f"{cache}/cape.pc2", out)
    np.save(f"{cache}/cape_rest.npy", P0)
    print("cape cache written", out.shape)


def write_pc2(path, frames):
    F, N, _ = frames.shape
    with open(path, "wb") as fh:
        fh.write(struct.pack("<12siiffi", b"POINTCACHE2\0", 1, N, 0.0, 1.0, F))
        fh.write(frames.astype("<f4").tobytes())


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/opt/work/cache")
