"""Numpy mesh generators for environment / props."""
import numpy as np
import bpy, bmesh


def mesh_obj(name, V, F, col=None, mat=None, smooth=True, attrs=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(np.asarray(V, float).tolist(), [], [list(map(int, f)) for f in F])
    me.validate()
    if smooth:
        me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    (col or bpy.context.scene.collection).objects.link(ob)
    if mat is not None:
        for m in (mat if isinstance(mat, (list, tuple)) else [mat]):
            me.materials.append(m)
    if attrs:
        for an, (dom, typ, data) in attrs.items():
            a = me.attributes.new(an, typ, dom)
            if typ == 'FLOAT':
                a.data.foreach_set('value', np.asarray(data, np.float32).ravel())
            elif typ in ('FLOAT_VECTOR',):
                a.data.foreach_set('vector', np.asarray(data, np.float32).ravel())
            elif typ in ('FLOAT_COLOR',):
                a.data.foreach_set('color', np.asarray(data, np.float32).ravel())
    return ob


def verts_of(ob):
    v = np.zeros(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get('co', v)
    return v.reshape(-1, 3)


def set_verts(ob, V):
    ob.data.vertices.foreach_set('co', np.asarray(V, float).ravel())
    ob.data.update()


def icosphere(subdiv=3, r=1.0):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    V = np.array([v.co[:] for v in bm.verts])
    F = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    return V, F


def uvsphere(seg=24, rings=12, r=1.0):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    V = np.array([v.co[:] for v in bm.verts])
    F = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    return V, F


_rng = np.random.default_rng(11)
_D = _rng.normal(size=(16, 3)); _D /= np.linalg.norm(_D, axis=1, keepdims=True)
_P = _rng.uniform(0, 6.28, 16)
_F = np.geomspace(1, 3.5, 16)


def wnoise(p, freq, seed=0):
    rot = np.roll(np.arange(16), seed % 16)
    acc = np.zeros(len(p))
    for i in rot[:12]:
        acc += np.sin(p @ _D[i] * freq * _F[i] + _P[i] + seed) / _F[i]
    return acc / 2.0


def lathe(profile, n=32, cap=True):
    """profile: list of (r, z). returns V, F (quads), closed around Z."""
    prof = np.asarray(profile, float)
    V = []
    for i in range(n):
        a = 2 * np.pi * i / n
        for r, z in prof:
            V.append((r * np.cos(a), r * np.sin(a), z))
    m = len(prof)
    F = []
    for i in range(n):
        i2 = (i + 1) % n
        for j in range(m - 1):
            F.append((i * m + j, i2 * m + j, i2 * m + j + 1, i * m + j + 1))
    return np.array(V), F


def tube(points, radii, k=8, cap=True):
    P = np.asarray(points, float)
    R = np.broadcast_to(np.asarray(radii, float), (len(P),))
    n = len(P)
    V, F = [], []
    prev = None
    for i in range(n):
        t = P[min(i + 1, n - 1)] - P[max(i - 1, 0)]
        t /= max(np.linalg.norm(t), 1e-9)
        if prev is None:
            a = np.array([0, 0, 1.0]) if abs(t[2]) < 0.9 else np.array([1.0, 0, 0])
            nrm = np.cross(t, a); nrm /= np.linalg.norm(nrm)
        else:
            nrm = prev - (prev @ t) * t
            nrm /= max(np.linalg.norm(nrm), 1e-9)
        prev = nrm
        bi = np.cross(t, nrm)
        for q in range(k):
            an = 2 * np.pi * q / k
            V.append(P[i] + R[i] * (np.cos(an) * nrm + np.sin(an) * bi))
    for i in range(n - 1):
        for q in range(k):
            q2 = (q + 1) % k
            F.append((i * k + q, i * k + q2, (i + 1) * k + q2, (i + 1) * k + q))
    if cap:
        V.append(P[0]); V.append(P[-1])
        c0, c1 = len(V) - 2, len(V) - 1
        for q in range(k):
            q2 = (q + 1) % k
            F.append((c0, q2, q))
            F.append((c1, (n - 1) * k + q, (n - 1) * k + q2))
    return np.array(V), F


def merge(parts):
    V, F, off = [], [], 0
    for v, f in parts:
        V.append(np.asarray(v)); F += [[i + off for i in face] for face in f]; off += len(v)
    return np.concatenate(V), F
