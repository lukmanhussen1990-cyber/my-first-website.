"""Per-frame procedural geometry for props (shared by builder + animator)."""
import numpy as np
import bpy
from geo import tube, icosphere, merge


def flower_petals(center, n, size, droop, seed):
    n = np.asarray(n, float); n /= np.linalg.norm(n)
    a = np.cross(n, [0, 0, 1.0] if abs(n[2]) < 0.9 else [1.0, 0, 0]); a /= np.linalg.norm(a)
    b = np.cross(n, a)
    V, F = [], []
    for k in range(7):
        ang = 2 * np.pi * k / 7 + seed
        d = np.cos(ang) * a + np.sin(ang) * b
        e = -np.sin(ang) * a + np.cos(ang) * b
        base = len(V)
        V.append(center)
        for (u, w) in [(0.2, 0), (0.5, 0.45), (0.85, 0.38), (1.0, 0.0), (0.85, -0.38), (0.5, -0.45)]:
            fold = droop * 1.3 * u * u
            V.append(center + d * u * size * (1 - 0.3 * droop) + e * w * size * 0.42 + n * size * (0.08 + 0.1 * u - fold))
        for i in range(1, 6):
            F.append((base, base + i, base + i + 1))
        F.append((base, base + 6, base + 1))
    return np.array(V), F


def wilt_flower_geo(h, bend, seed, droop, lean_dir=(1.0, 0.0)):
    n = 10
    seg = h / (n - 1)
    ld = np.array([lean_dir[0], lean_dir[1], 0.0]); ld /= np.linalg.norm(ld)
    p = np.zeros(3); P = [p.copy()]
    for i in range(1, n):
        a = 0.08 + bend * 1.9 * ((i / (n - 1)) ** 1.6)
        p = p + seg * (ld * np.sin(a) + np.array([0, 0, np.cos(a)]))
        P.append(p.copy())
    P = np.array(P)
    Vs, Fs = tube(P, np.linspace(0.006, 0.004, n), 6)
    tip = P[-1]; tdir = P[-1] - P[-2]; tdir /= np.linalg.norm(tdir)
    size = 0.055
    nrm = tdir + np.array([0, -0.5, 0.15]) * (1 - bend)
    nrm /= np.linalg.norm(nrm)
    Vf, Ff = flower_petals(tip, nrm, size, droop, seed)
    Vc, Fc = icosphere(1, size * 0.28)
    Vc = Vc * np.array([1, 1, 0.55]) + tip + nrm * size * 0.1
    return (Vs, Fs), (Vf, Ff), (Vc, Fc)


def set_mesh(ob, V, F):
    me = ob.data
    V = np.asarray(V, float)
    if len(me.vertices) == len(V) and len(me.polygons) == len(F):
        me.vertices.foreach_set('co', V.ravel())
        me.update()
        return
    mats = list(me.materials)
    new = bpy.data.meshes.new(me.name + '_d')
    new.from_pydata(V.tolist(), [], [list(map(int, f)) for f in F])
    for m in mats:
        new.materials.append(m)
    new.shade_smooth()
    ob.data = new


def strand(p0, p1, r0, r1, sag=0.0, n=14, k=8, wobble=0.0, t=0.0, seed=0):
    """sticky string between two points with sag (gravity) and thinning in the middle."""
    p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
    u = np.linspace(0, 1, n)
    P = p0[None] + (p1 - p0)[None] * u[:, None]
    P[:, 2] -= sag * 4 * u * (1 - u)
    if wobble:
        P[:, 0] += wobble * np.sin(u * np.pi) * np.sin(t * 9 + seed)
    thin = 1 - 0.55 * np.sin(u * np.pi)
    R = (r0 * (1 - u) + r1 * u) * thin
    return tube(P, R, k)
