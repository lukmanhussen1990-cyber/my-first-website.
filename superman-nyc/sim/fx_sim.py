"""Particle / rigid-ish debris simulations in numpy (no bpy; runs in Blender's Python too).

* Voronoi-fractured glass panels, mullion bars and slab-edge chunks blasted off the tower
  as the heat-vision beam sweeps across it (ballistic + drag + tumbling + ground bounce).
* Sparks spraying from the beam impact point.
* Paper litter lifted and swirled by Superman's wake.

Each system is returned as (verts, faces, uvs-per-loop, mats, per-frame vertex positions).
"""
import math
import os
import struct
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import timeline as TL  # noqa: E402

FPS = TL.FPS
G = np.array([0.0, 0.0, -9.81])


def write_pc2(path, frames):
    frames = np.asarray(frames, np.float32)
    F, N, _ = frames.shape
    with open(path, "wb") as fh:
        fh.write(struct.pack("<12siiffi", b"POINTCACHE2\0", 1, N, 0.0, 1.0, F))
        fh.write(frames.astype("<f4").tobytes())


# ------------------------------------------------------------------------------ geometry helpers
def clip_poly(poly, a, b):
    """Clip convex polygon (list of 2D points) with half-plane a.x <= b."""
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        fp, fq = a @ p - b, a @ q - b
        if fp <= 0:
            out.append(p)
        if fp * fq < 0:
            t = fp / (fp - fq)
            out.append(p + t * (q - p))
    return out


def voronoi_cells(w, h, n, rng):
    """Voronoi partition of the rectangle [0,w]x[0,h] -> list of convex polygons."""
    pts = np.column_stack([rng.uniform(0, w, n), rng.uniform(0, h, n)])
    # bias a crack line through the middle so panels split like real tempered glass
    rect = [np.array([0, 0.0]), np.array([w, 0.0]), np.array([w, h]), np.array([0, h])]
    cells = []
    for i in range(n):
        poly = rect
        for j in range(n):
            if i == j:
                continue
            a = pts[j] - pts[i]
            b = a @ (pts[i] + pts[j]) / 2
            poly = clip_poly(poly, a, b)
            if len(poly) < 3:
                break
        if len(poly) >= 3:
            cells.append(np.array(poly))
    return cells


def prism(poly2d, frame, thick, uv_fn):
    """Extrude a 2D polygon (in a facade frame) into a thin prism.
    frame: (origin3, u3, v3, n3). Returns verts (2k,3), faces, uvs (per face loop)."""
    o, U, V, N = frame
    k = len(poly2d)
    front = [o + U * p[0] + V * p[1] + N * (thick * 0.5) for p in poly2d]
    back = [o + U * p[0] + V * p[1] - N * (thick * 0.5) for p in poly2d]
    verts = np.array(front + back)
    faces = [list(range(k)), list(range(2 * k - 1, k - 1, -1))]
    uvs = [[uv_fn(p) for p in poly2d], [uv_fn(poly2d[i - k]) for i in range(2 * k - 1, k - 1, -1)]]
    for i in range(k):
        j = (i + 1) % k
        faces.append([i, k + i, k + j, j])
        uvs.append([uv_fn(poly2d[i])] * 4)
    return verts, faces, uvs


def box_mesh(center, half, R):
    c = np.array(center)
    corners = np.array([[sx, sy, sz] for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]) * half
    verts = corners @ R.T + c
    faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]
    uvs = [[(0, 0), (1, 0), (1, 1), (0, 1)]] * 6
    return verts, faces, uvs


def rand_rot(rng):
    q = rng.normal(size=4)
    q /= np.linalg.norm(q)
    w, x, y, z = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def axis_angle(axis, ang):
    """Rotation matrices for arrays of axes (n,3) and angles (n,)."""
    a = axis / (np.linalg.norm(axis, axis=1, keepdims=True) + 1e-9)
    c, s = np.cos(ang), np.sin(ang)
    x, y, z = a[:, 0], a[:, 1], a[:, 2]
    C = 1 - c
    return np.stack([
        np.stack([c + x * x * C, x * y * C - z * s, x * z * C + y * s], -1),
        np.stack([y * x * C + z * s, c + y * y * C, y * z * C - x * s], -1),
        np.stack([z * x * C - y * s, z * y * C + x * s, c + z * z * C], -1)], -2)


# ------------------------------------------------------------------------------ rigid body batch
def ground_height(x, y):
    on_road = (np.abs(x) < TL.AVE_HALF) | (np.abs(y) < TL.ST_HALF)
    return np.where(on_road, 0.0, TL.CURB_H)


def simulate_bodies(bodies, t_break, v0, w0, drag, restitution=0.25, frames=TL.N_FRAMES, sub=4):
    """bodies: list of local vertex arrays (centred at the body origin) + origin positions.
    Returns per-frame world vertex positions for all bodies concatenated."""
    n = len(bodies)
    origins = np.array([b[0] for b in bodies])
    locs = [b[1] for b in bodies]
    pos = origins.copy()
    vel = np.zeros((n, 3))
    R = np.tile(np.eye(3), (n, 1, 1))
    omega = np.zeros((n, 3))
    active = np.zeros(n, bool)
    resting = np.zeros(n, bool)
    counts = [len(l) for l in locs]
    allloc = np.concatenate(locs)
    owner = np.repeat(np.arange(n), counts)
    out = np.zeros((frames, len(allloc), 3), np.float32)
    dt = 1.0 / (FPS * sub)
    for f in range(frames):
        for s in range(sub):
            t = (f + s / sub) / FPS
            newly = (~active) & (t >= t_break)
            if newly.any():
                active[newly] = True
                vel[newly] = v0[newly]
                omega[newly] = w0[newly]
            m = active & ~resting
            if m.any():
                sp = np.linalg.norm(vel[m], axis=1, keepdims=True)
                acc = G - drag[m, None] * sp * vel[m]
                vel[m] += acc * dt
                pos[m] += vel[m] * dt
                ang = np.linalg.norm(omega[m], axis=1)
                Rm = axis_angle(omega[m] + 1e-9, ang * dt)
                R[m] = Rm @ R[m]
                gz = ground_height(pos[m, 0], pos[m, 1]) + 0.03
                hit = pos[m, 2] < gz
                if hit.any():
                    idx = np.where(m)[0][hit]
                    pos[idx, 2] = gz[hit]
                    vel[idx, 2] = -vel[idx, 2] * restitution
                    vel[idx, :2] *= 0.45
                    omega[idx] *= 0.4
                    slow = np.linalg.norm(vel[idx], axis=1) < 0.6
                    resting[idx[slow]] = True
                    vel[idx[slow]] = 0
        out[f] = (np.einsum('nij,nj->ni', R[owner], allloc) + pos[owner]).astype(np.float32)
    return out


# ------------------------------------------------------------------------------ the tower debris
def beam_pass_time(px, py, pz):
    """Time the beam sweep passes nearest to a facade point (coarse search)."""
    ts = np.linspace(TL.T_BEAM_ON, TL.T_BEAM_OFF, 200)
    tg = np.array([TL.beam_target(t) for t in ts])
    d = np.hypot(tg[:, 0] - px, tg[:, 1] - py) + 0.35 * np.abs(tg[:, 2] - pz)
    i = int(np.argmin(d))
    return ts[i], d[i], tg[i]


def tower_debris(panels, slabs, mullions, seed=7):
    rng = np.random.default_rng(seed)
    V, Fc, UV, MAT = [], [], [], []
    bodies, tb, v0, w0, drag = [], [], [], [], []
    vofs = 0

    def add(verts, faces, uvs, mat, t_break, vel, omg, dr):
        nonlocal vofs
        c = verts.mean(0)
        bodies.append((c, verts - c))
        for fce, uv in zip(faces, uvs):
            Fc.append([vofs + i for i in fce])
            UV.append(uv)
            MAT.append(mat)
        V.append(verts)
        vofs += len(verts)
        tb.append(t_break)
        v0.append(vel)
        w0.append(omg)
        drag.append(dr)
    for p in panels:
        o = np.array([p["o"][0], p["o"][1], 0.0])
        d = np.array([p["d"][0], p["d"][1], 0.0])
        nrm = np.array([p["n"][0], p["n"][1], 0.0])
        w, h = p["u1"] - p["u0"], p["z1"] - p["z0"]
        origin = o + d * p["u0"] + np.array([0, 0, p["z0"]])
        cu, cz = p["u0"] + w / 2, p["z0"] + h / 2
        cpos = o + d * cu + np.array([0, 0, cz])
        t_pass, dist, tgt = beam_pass_time(cpos[0], cpos[1], cz)
        # panels within reach of the beam blow out; the rest crack later or stay
        if dist < 3.2:
            t0 = t_pass + rng.uniform(0.0, 0.12)
            power = 1.0
        elif dist < 7.0:
            t0 = t_pass + rng.uniform(0.25, 1.6)
            power = 0.55
        elif rng.random() < 0.35:
            t0 = rng.uniform(17.5, 23.5)        # progressive failure later on
            power = 0.25
        else:
            t0 = 1e9
            power = 0.0
        ncell = int(rng.integers(9, 15))
        cells = voronoi_cells(w, h, ncell, rng)
        frame = (origin + nrm * 0.0, d, np.array([0, 0, 1.0]), nrm)
        zf0 = p["zf0"]
        for cell in cells:
            uv_fn = lambda q, u0=p["u0"], z0=p["z0"]: (u0 + q[0], z0 + q[1] - zf0)
            verts, faces, uvs = prism(cell, frame, 0.022, uv_fn)
            c2 = cell.mean(0)
            # blast direction: outward + away from the impact point + some up
            away = (o + d * (p["u0"] + c2[0]) + np.array([0, 0, p["z0"] + c2[1]])) - np.array(tgt)
            away /= np.linalg.norm(away) + 1e-9
            vel = nrm * rng.uniform(4, 13) * power + away * rng.uniform(1, 5) * power + np.array([0, 0, rng.uniform(0, 3)]) * power
            vel += rng.normal(0, 1.2, 3) * power
            omg = rng.normal(0, 9, 3)
            add(verts, faces, uvs, "glass", t0, vel, omg, rng.uniform(0.04, 0.12))
    for s in slabs:
        o = np.array([s["o"][0], s["o"][1], 0.0])
        d = np.array([s["d"][0], s["d"][1], 0.0])
        nrm = np.array([s["n"][0], s["n"][1], 0.0])
        cu = (s["u0"] + s["u1"]) / 2
        cz = (s["z0"] + s["z1"]) / 2
        cpos = o + d * cu + np.array([0, 0, cz])
        t_pass, dist, tgt = beam_pass_time(cpos[0], cpos[1], cz)
        if dist > 4.0 and rng.random() < 0.75:
            continue
        nch = int(rng.integers(2, 5))
        for k in range(nch):
            uu = s["u0"] + (k + rng.uniform(0.2, 0.8)) * (s["u1"] - s["u0"]) / nch
            c = o + d * uu + nrm * rng.uniform(-0.25, 0.1) + np.array([0, 0, cz + rng.uniform(-0.2, 0.2)])
            half = np.array([rng.uniform(0.12, 0.35), rng.uniform(0.1, 0.3), rng.uniform(0.08, 0.22)])
            verts, faces, uvs = box_mesh(c, half, rand_rot(rng))
            t0 = t_pass + rng.uniform(0.05, 0.5) if dist < 4.0 else rng.uniform(18.0, 24.0)
            vel = nrm * rng.uniform(2, 8) + rng.normal(0, 1.5, 3) + np.array([0, 0, rng.uniform(0, 2)])
            add(verts, faces, uvs, "concrete", t0, vel, rng.normal(0, 4, 3), rng.uniform(0.005, 0.02))
    for mu in mullions:
        o = np.array([mu["o"][0], mu["o"][1], 0.0])
        d = np.array([mu["d"][0], mu["d"][1], 0.0])
        nrm = np.array([mu["n"][0], mu["n"][1], 0.0])
        c = o + d * mu["u"] + nrm * 0.07 + np.array([0, 0, (mu["z0"] + mu["z1"]) / 2])
        t_pass, dist, tgt = beam_pass_time(c[0], c[1], c[2])
        if dist > 3.5:
            continue
        L = (mu["z1"] - mu["z0"]) / 2
        R = np.column_stack([d, nrm, np.array([0, 0, 1.0])])
        verts, faces, uvs = box_mesh(c, np.array([0.035, 0.07, L]), R)
        vel = nrm * rng.uniform(2, 6) + rng.normal(0, 1, 3)
        add(verts, faces, uvs, "metal", t_pass + rng.uniform(0.1, 0.6), vel, rng.normal(0, 3, 3), 0.01)
    tb, v0, w0, drag = np.array(tb), np.array(v0), np.array(w0), np.array(drag)
    traj = simulate_bodies(bodies, tb, v0, w0, drag)
    verts = np.concatenate(V)
    info = dict(n_bodies=len(bodies), break_times=tb)
    return verts, Fc, UV, MAT, traj, info


# ------------------------------------------------------------------------------ sparks
def sparks(seed=3, n_per_s=420):
    rng = np.random.default_rng(seed)
    t0, t1 = TL.T_BEAM_ON, TL.T_BEAM_OFF + 0.15
    n = int((t1 - t0) * n_per_s)
    births = np.sort(rng.uniform(t0, t1, n))
    life = rng.uniform(0.35, 1.4, n)
    origin = np.array([TL.beam_target(min(b, TL.T_BEAM_OFF)) for b in births])
    # outward from the facade: approximate by the chamfer normal + spread
    nrm = np.array([-0.707, -0.707, 0.0])
    vel = nrm * rng.uniform(3, 16, (n, 1)) + rng.normal(0, 6, (n, 3)) + np.array([0, 0, 3.0])
    F = TL.N_FRAMES
    out = np.zeros((F, n * 4, 3), np.float32)
    tet = np.array([[0, 0, 0.035], [0.03, 0, -0.012], [-0.015, 0.026, -0.012], [-0.015, -0.026, -0.012]])
    hidden = np.array([0, 0, -500.0])
    for f in range(F):
        t = f / FPS
        age = t - births
        alive = (age >= 0) & (age <= life)
        a = np.clip(age, 0, None)[:, None]
        # drag-damped ballistic motion (analytic-ish)
        k = 1.6
        p = origin + vel * (1 - np.exp(-k * a)) / k + G * (a * a) * 0.5
        size = np.where(alive, 1.0 - 0.7 * (age / life), 0.0)
        pts = p[:, None, :] + tet[None, :, :] * size[:, None, None]
        pts[~alive] = hidden
        out[f] = pts.reshape(-1, 3)
    faces = []
    for i in range(n):
        b = 4 * i
        faces += [[b, b + 1, b + 2], [b, b + 2, b + 3], [b, b + 3, b + 1], [b + 1, b + 3, b + 2]]
    return out[0], faces, out


# ------------------------------------------------------------------------------ paper litter
def papers(seed=5, n=170):
    """Litter lying on the street; Superman's wake lifts and swirls it (9.25 s on)."""
    rng = np.random.default_rng(seed)
    x = rng.uniform(-14, 14, n)
    y = rng.uniform(-38, 32, n)
    x = np.where(rng.random(n) < 0.5, x, rng.uniform(-60, 60, n))
    y = np.where(np.abs(x) > 16, rng.uniform(-8, 8, n), y)
    z = ground_height(x, y) + 0.005
    base = np.column_stack([x, y, z])
    size = rng.uniform(0.1, 0.3, n)
    # wake arrival time grows with distance from the flight line near the tower
    dist = np.hypot(x - 6.0, y - 18.0)
    t_go = TL.T_WAKE + 0.15 + dist / 45.0 + rng.uniform(0, 0.25, n)
    away = np.column_stack([x - 6.0, y - 18.0, np.zeros(n)])
    away /= np.linalg.norm(away, axis=1, keepdims=True) + 1e-9
    strength = np.clip(1.4 - dist / 60.0, 0.15, 1.4)
    v0 = (away * rng.uniform(4, 10, (n, 1)) + np.column_stack([np.zeros(n), -rng.uniform(1, 4, n), rng.uniform(3, 9, n)])) * strength[:, None]
    F = TL.N_FRAMES
    out = np.zeros((F, n * 4, 3), np.float32)
    quad = np.array([[-0.5, -0.35, 0], [0.5, -0.35, 0], [0.5, 0.35, 0], [-0.5, 0.35, 0]])
    pos = base.copy()
    vel = np.zeros((n, 3))
    ang = rng.uniform(0, 2 * np.pi, (n, 3)) * np.array([0.05, 0.05, 1.0])
    spin = rng.normal(0, 6, (n, 3))
    started = np.zeros(n, bool)
    sub = 3
    dt = 1.0 / (FPS * sub)
    ph = rng.uniform(0, 6.28, n)
    for f in range(F):
        for s in range(sub):
            t = (f + s / sub) / FPS
            go = (~started) & (t >= t_go)
            vel[go] = v0[go]
            started |= go
            m = started
            # flutter: strong drag, slow fall, swirling
            swirl = np.column_stack([np.sin(3 * t + ph), np.cos(2.3 * t + ph), 0.6 * np.sin(4.1 * t + 2 * ph)])[m]
            vel[m] += (G * 0.35 + swirl * 2.5 - 1.6 * vel[m]) * dt
            pos[m] += vel[m] * dt
            gz = ground_height(pos[m, 0], pos[m, 1]) + 0.005
            low = pos[m, 2] < gz
            idx = np.where(m)[0][low]
            pos[idx, 2] = gz[low]
            vel[idx] *= 0.3
            ang[m] += spin[m] * dt * np.clip(np.linalg.norm(vel[m], axis=1, keepdims=True), 0, 3)
        R = axis_angle(np.where(np.linalg.norm(ang, axis=1, keepdims=True) > 1e-6, ang, [[0, 0, 1.0]]),
                       np.linalg.norm(ang, axis=1))
        pts = np.einsum('nij,kj->nki', R, quad) * size[:, None, None] + pos[:, None, :]
        out[f] = pts.reshape(-1, 3)
    faces = [[4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3] for i in range(n)]
    return out[0], faces, out


def build_all(cache, panels, slabs, mullions):
    os.makedirs(cache, exist_ok=True)
    res = {}
    verts, faces, uvs, mats, traj, info = tower_debris(panels, slabs, mullions)
    write_pc2(f"{cache}/debris.pc2", traj)
    res["debris"] = (verts, faces, uvs, mats, info)
    v, f, tr = sparks()
    write_pc2(f"{cache}/sparks.pc2", tr)
    res["sparks"] = (v, f)
    v, f, tr = papers()
    write_pc2(f"{cache}/papers.pc2", tr)
    res["papers"] = (v, f)
    return res
