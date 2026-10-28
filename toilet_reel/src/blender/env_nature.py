"""Procedural garden world in the reference style: bright grass, dirt patches, speckled
round boulders, blobby trees, pink flower bushes, low hills, pale sky, river, cliff, waterfall."""
import math
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix, noise
import common as C
from common import NB, new_mat, principled

RNG = np.random.RandomState(11)


def lin(c):
    """sRGB triple -> linear."""
    c = np.asarray(c, dtype=float)
    return tuple(np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4))


# ------------------------------------------------------------------ haze helper
def add_haze(nb, color_socket, start=25.0, full=160.0, haze=(0.70, 0.80, 0.90)):
    """mix colour towards the sky colour with camera distance (cheap aerial perspective)."""
    cam = nb.node('ShaderNodeCameraData')
    f = nb.maprange(cam.outputs['View Distance'], start, full, 0.0, 0.85)
    return nb.mix(f, color_socket, nb.rgb(haze))


# ------------------------------------------------------------------ materials
def mat_ground():
    m = new_mat('ground', lin((0.36, 0.58, 0.20)), 0.95)
    nb = NB(m)
    b = principled(m)
    tc = nb.node('ShaderNodeTexCoord')
    p = tc.outputs['Object']
    n1 = nb.node('ShaderNodeTexNoise', {'Vector': p, 'Scale': 0.35, 'Detail': 2.0})
    n2 = nb.node('ShaderNodeTexNoise', {'Vector': p, 'Scale': 3.0, 'Detail': 2.0})
    g1 = nb.rgb(lin((0.33, 0.55, 0.18)))
    g2 = nb.rgb(lin((0.45, 0.64, 0.24)))
    g = nb.mix(nb.maprange(n2.outputs['Fac'], 0.35, 0.65, 0, 1), g1, g2)
    # tiny grass speckle
    n3 = nb.node('ShaderNodeTexNoise', {'Vector': p, 'Scale': 60.0, 'Detail': 2.0})
    g = nb.mix(nb.maprange(n3.outputs['Fac'], 0.3, 0.7, 0, 0.35), g, nb.rgb(lin((0.24, 0.42, 0.12))))
    # dirt patches (noise) + painted dirt (vertex attribute 'dirt')
    dirt_n = nb.smoothstep(n1.outputs['Fac'], 0.62, 0.70)
    dirt_a = nb.attr('dirt', 'Fac')
    dmask = nb.math('MAXIMUM', dirt_n, dirt_a)
    dn = nb.node('ShaderNodeTexNoise', {'Vector': p, 'Scale': 18.0, 'Detail': 2.0})
    dc = nb.mix(nb.maprange(dn.outputs['Fac'], 0.3, 0.7, 0, 1), nb.rgb(lin((0.47, 0.35, 0.24))),
                nb.rgb(lin((0.58, 0.45, 0.32))))
    vor = nb.node('ShaderNodeTexVoronoi', {'Vector': p, 'Scale': 30.0})
    pebble = nb.smoothstep(vor.outputs['Distance'], 0.22, 0.12)
    dc = nb.mix(nb.math('MULTIPLY', pebble, 0.35), dc, nb.rgb(lin((0.62, 0.58, 0.52))))
    col = nb.mix(dmask, g, dc)
    col = add_haze(nb, col)
    nb.link(col, b.inputs['Base Color'])
    bump = nb.node('ShaderNodeBump', {'Strength': 0.25, 'Distance': 0.02})
    nb.link(n3.outputs['Fac'], bump.inputs['Height'])
    nb.link(bump.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Specular IOR Level'].default_value = 0.2
    return m


def mat_grass():
    m = new_mat('grass_blade', lin((0.30, 0.55, 0.15)), 0.6)
    nb = NB(m)
    b = principled(m)
    h = nb.attr('h', 'Fac')
    r = nb.attr('rnd', 'Fac')
    base = nb.mix(r, nb.rgb(lin((0.20, 0.42, 0.10))), nb.rgb(lin((0.33, 0.56, 0.16))))
    tip = nb.mix(r, nb.rgb(lin((0.50, 0.70, 0.25))), nb.rgb(lin((0.62, 0.74, 0.30))))
    col = nb.mix(nb.smoothstep(h, 0.0, 1.0), base, tip)
    col = add_haze(nb, col)
    nb.link(col, b.inputs['Base Color'])
    b.inputs['Subsurface Weight'].default_value = 0.0
    b.inputs['Specular IOR Level'].default_value = 0.35
    m.use_backface_culling = False
    return m


def mat_rock(name='rock', base=(0.64, 0.64, 0.62), spot=(0.38, 0.38, 0.37), scale=11.0):
    m = new_mat(name, lin(base), 0.85)
    nb = NB(m)
    b = principled(m)
    p = nb.node('ShaderNodeTexCoord').outputs['Object']
    vor = nb.node('ShaderNodeTexVoronoi', {'Vector': p, 'Scale': scale})
    wn = nb.node('ShaderNodeTexNoise', {'Vector': p, 'Scale': scale * 2.5, 'Detail': 2.0})
    d = nb.math('ADD', vor.outputs['Distance'], nb.math('MULTIPLY', wn.outputs['Fac'], 0.25))
    spots = nb.smoothstep(d, 0.42, 0.30)
    vx, vy, vz = nb.sep(vor.outputs['Color'])
    spots = nb.math('MULTIPLY', spots, nb.math('GREATER_THAN', vx, 0.35))
    gn = nb.node('ShaderNodeTexNoise', {'Vector': p, 'Scale': 40.0, 'Detail': 2.0})
    c = nb.mix(nb.maprange(gn.outputs['Fac'], 0.3, 0.7, 0, 0.4), nb.rgb(lin(base)),
               nb.rgb(lin(tuple(x * 0.85 for x in base))))
    c = nb.mix(spots, c, nb.rgb(lin(spot)))
    c = add_haze(nb, c)
    nb.link(c, b.inputs['Base Color'])
    bump = nb.node('ShaderNodeBump', {'Strength': 0.35, 'Distance': 0.01})
    nb.link(nb.math('ADD', gn.outputs['Fac'], nb.math('MULTIPLY', spots, -0.4)), bump.inputs['Height'])
    nb.link(bump.outputs['Normal'], b.inputs['Normal'])
    return m


def mat_leaves(name='leaves', c1=(0.20, 0.45, 0.14), c2=(0.30, 0.56, 0.18), scale=14.0):
    m = new_mat(name, lin(c1), 0.75)
    nb = NB(m)
    b = principled(m)
    p = nb.node('ShaderNodeTexCoord').outputs['Object']
    vor = nb.node('ShaderNodeTexVoronoi', {'Vector': p, 'Scale': scale})
    n = nb.node('ShaderNodeTexNoise', {'Vector': p, 'Scale': 3.0, 'Detail': 2.0})
    c = nb.mix(nb.maprange(vor.outputs['Distance'], 0.0, 0.6, 0, 1), nb.rgb(lin(c2)), nb.rgb(lin(c1)))
    c = nb.mix(nb.maprange(n.outputs['Fac'], 0.3, 0.7, 0, 0.5), c, nb.rgb(lin((0.14, 0.34, 0.10))))
    c = add_haze(nb, c)
    nb.link(c, b.inputs['Base Color'])
    bump = nb.node('ShaderNodeBump', {'Strength': 0.8, 'Distance': 0.03})
    nb.link(vor.outputs['Distance'], bump.inputs['Height'])
    nb.link(bump.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Sheen Weight'].default_value = 0.3
    return m


def mat_bark():
    m = new_mat('bark', lin((0.40, 0.26, 0.16)), 0.9)
    nb = NB(m)
    b = principled(m)
    p = nb.node('ShaderNodeTexCoord').outputs['Object']
    pp = nb.vmath('MULTIPLY', p, (6.0, 6.0, 0.8))
    n = nb.node('ShaderNodeTexNoise', {'Vector': pp, 'Scale': 6.0, 'Detail': 2.0})
    c = nb.mix(nb.maprange(n.outputs['Fac'], 0.3, 0.7, 0, 1), nb.rgb(lin((0.30, 0.19, 0.11))),
               nb.rgb(lin((0.46, 0.31, 0.19))))
    c = add_haze(nb, c)
    nb.link(c, b.inputs['Base Color'])
    bump = nb.node('ShaderNodeBump', {'Strength': 0.7, 'Distance': 0.02})
    nb.link(n.outputs['Fac'], bump.inputs['Height'])
    nb.link(bump.outputs['Normal'], b.inputs['Normal'])
    return m


# ------------------------------------------------------------------ geometry helpers
def displaced_sphere(name, radius, scale=(1, 1, 1), subdiv=4, amp=0.15, freq=1.5, seed=0, flat_bottom=None,
                     mat=None, coll=None, loc=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    for v in bm.verts:
        n = v.co.normalized()
        d = noise.noise(n * freq + off) * amp + noise.noise(n * freq * 3 + off) * amp * 0.3
        v.co = n * (1 + d)
        v.co.x *= scale[0] * radius
        v.co.y *= scale[1] * radius
        v.co.z *= scale[2] * radius
        if flat_bottom is not None and v.co.z < flat_bottom:
            v.co.z = flat_bottom + (v.co.z - flat_bottom) * 0.15
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    ob = C.obj_from_mesh(me, name, coll)
    ob.location = loc
    if mat:
        me.materials.append(mat)
    return ob


def ground(coll, size=260.0, res=200):
    """big ground with gentle bumps; 'dirt' vertex attribute painted later via paint_dirt."""
    n = res + 1
    xs = np.linspace(-size / 2, size / 2, n)
    # denser near the origin: warp coordinates
    X, Y = np.meshgrid(xs, xs, indexing='ij')
    r = np.sqrt(X ** 2 + Y ** 2)
    k = 1.0 + 0.0 * r
    X = np.sign(X) * (np.abs(X) / (size / 2)) ** 1.8 * (size / 2)
    Y = np.sign(Y) * (np.abs(Y) / (size / 2)) ** 1.8 * (size / 2)
    Z = np.zeros_like(X)
    for i in range(n):
        for j in range(n):
            Z[i, j] = ground_height(X[i, j], Y[i, j])
    V = np.stack([X, Y, Z], -1).reshape(-1, 3)
    F = []
    for i in range(res):
        for j in range(res):
            a = i * n + j
            F.append((a, a + n, a + n + 1, a + 1))
    me = C.mesh_from_arrays('Ground', V, np.array(F), attrs={'dirt': np.zeros(len(V))})
    ob = C.obj_from_mesh(me, 'Ground', coll)
    me.materials.append(mat_ground())
    return ob


RIVER_Y0 = 11.0


def river_center(x):
    return RIVER_Y0 + 1.2 * math.sin(x * 0.08)


def ground_height(x, y):
    p = Vector((x * 0.05, y * 0.05, 0.0))
    h = noise.noise(p) * 0.25 * min(1.0, (abs(x) + abs(y)) / 12.0)
    # river channel
    h -= 0.30 * math.exp(-((y - river_center(x)) / 1.5) ** 2)
    return h


def paint_dirt(ground_ob, spots):
    """spots: list of (x, y, radius, strength). writes the 'dirt' attribute."""
    me = ground_ob.data
    V = C.verts_np(me)
    d = np.zeros(len(V))
    for (x, y, r, s) in spots:
        dist = np.sqrt((V[:, 0] - x) ** 2 + (V[:, 1] - y) ** 2)
        ns = np.array([noise.noise(Vector((vx * 2.0, vy * 2.0, 0.0))) for vx, vy in V[dist < r * 1.5, :2]])
        m = np.zeros(len(V))
        sel = dist < r * 1.5
        m[sel] = np.clip((r * (1 + 0.35 * ns) - dist[sel]) / (0.25 * r), 0, 1) * s
        d = np.maximum(d, m)
    me.attributes['dirt'].data.foreach_set('value', d.astype(np.float32))


def grass_field(coll, regions, seed=3, avoid=()):
    """regions: list of (cx, cy, radius, clump_count). Clumps of tall blades like the reference."""
    rng = np.random.RandomState(seed)
    V = []; F = []; H = []; RN = []
    nv = 0
    for (cx, cy, rad, count) in regions:
        for c in range(count):
            a = rng.uniform(0, 2 * np.pi); rr = rad * np.sqrt(rng.uniform(0, 1))
            x0, y0 = cx + rr * np.cos(a), cy + rr * np.sin(a)
            if any((x0 - ax) ** 2 + (y0 - ay) ** 2 < ar ** 2 for (ax, ay, ar) in avoid):
                continue
            z0 = ground_height(x0, y0)
            nb_ = rng.randint(9, 22)
            hgt = rng.uniform(0.22, 0.48)
            crand = rng.uniform(0, 1)
            for b in range(nb_):
                bx = x0 + rng.normal(0, 0.045); by = y0 + rng.normal(0, 0.045)
                h = hgt * rng.uniform(0.6, 1.15)
                w = rng.uniform(0.007, 0.012)
                ang = rng.uniform(0, 2 * np.pi)
                lean_dir = np.array([bx - x0, by - y0]) + rng.normal(0, 0.03, 2)
                ln = np.linalg.norm(lean_dir) + 1e-6
                lean_dir = lean_dir / ln
                lean = rng.uniform(0.15, 0.55) * h
                dx, dy = np.cos(ang) * w, np.sin(ang) * w
                segs = 4
                pts = []
                for s_ in range(segs + 1):
                    t = s_ / segs
                    off = lean * t * t
                    px, py = bx + lean_dir[0] * off, by + lean_dir[1] * off
                    pz = z0 + h * t - 0.01
                    ww = (1 - t) ** 0.9
                    pts.append(((px - dx * ww, py - dy * ww, pz), (px + dx * ww, py + dy * ww, pz), t))
                for s_ in range(segs + 1):
                    V.append(pts[s_][0]); V.append(pts[s_][1])
                    H.extend([pts[s_][2]] * 2); RN.extend([crand] * 2)
                for s_ in range(segs):
                    a_ = nv + s_ * 2
                    F.append((a_, a_ + 1, a_ + 3, a_ + 2))
                nv += (segs + 1) * 2
    me = C.mesh_from_arrays('Grass', np.array(V), np.array(F), attrs={'h': H, 'rnd': RN})
    ob = C.obj_from_mesh(me, 'Grass', coll)
    me.materials.append(mat_grass())
    print('grass blades verts', len(V))
    return ob


def boulder(coll, loc, radius, seed, squash=0.8, mat=None):
    ob = displaced_sphere(f'Boulder{seed}', radius, scale=(1.0, 0.92, squash), subdiv=4, amp=0.12, freq=1.2,
                          seed=seed, mat=mat, coll=coll)
    z = ground_height(loc[0], loc[1])
    ob.location = (loc[0], loc[1], z + radius * squash * 0.55)
    ob.rotation_euler = (0, 0, seed * 1.3)
    return ob


def tree(coll, loc, height, seed, bark, leaves):
    rng = np.random.RandomState(seed)
    z0 = ground_height(*loc)
    # trunk: tapered cylinder with flared base
    bm = bmesh.new()
    segs = 16; rings = 10
    r0 = height * 0.055
    verts = []
    for i in range(rings + 1):
        t = i / rings
        z = t * height * 0.72
        r = r0 * (1 - 0.45 * t) * (1 + 0.6 * max(0, 0.18 - t) / 0.18)
        ring = []
        for j in range(segs):
            a = 2 * math.pi * j / segs
            rr = r * (1 + 0.04 * math.sin(a * 3 + seed))
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        verts.append(ring)
    for i in range(rings):
        for j in range(segs):
            bm.faces.new((verts[i][j], verts[i][(j + 1) % segs], verts[i + 1][(j + 1) % segs], verts[i + 1][j]))
    me = bpy.data.meshes.new(f'Trunk{seed}')
    bm.to_mesh(me); bm.free()
    me.shade_smooth()
    tr = C.obj_from_mesh(me, f'Trunk{seed}', coll)
    tr.location = (loc[0], loc[1], z0 - 0.05)
    me.materials.append(bark)
    # canopy: a few blobby spheres
    ch = height * 0.62
    for k in range(rng.randint(3, 5)):
        off = Vector((rng.normal(0, 0.18), rng.normal(0, 0.18), rng.uniform(-0.05, 0.25))) * height * 0.5
        rad = height * rng.uniform(0.24, 0.32)
        displaced_sphere(f'Canopy{seed}_{k}', rad, scale=(1, 1, 0.82), subdiv=4, amp=0.16, freq=2.2,
                         seed=seed * 10 + k, mat=leaves, coll=coll,
                         loc=(loc[0] + off.x, loc[1] + off.y, z0 + ch + off.z))
    return tr


def flower_mesh_data(rng, n, center, radius, scale_z=0.8, size=(0.028, 0.045)):
    """5-petal flowers on a (deformed) sphere surface; returns verts/faces/color-ids."""
    V = []; F = []; CID = []
    for i in range(n):
        u = rng.uniform(-0.1, 1.0)
        th = rng.uniform(0, 2 * np.pi)
        zc = u
        rr = np.sqrt(max(0.0, 1 - zc * zc))
        nrm = np.array([rr * np.cos(th), rr * np.sin(th), zc])
        p = np.array(center) + nrm * radius * np.array([1, 1, scale_z]) * 1.03
        s = rng.uniform(*size)
        # local frame
        t1 = np.cross(nrm, [0, 0, 1.0]);
        if np.linalg.norm(t1) < 1e-3:
            t1 = np.array([1.0, 0, 0])
        t1 /= np.linalg.norm(t1); t2 = np.cross(nrm, t1)
        base = len(V)
        V.append(tuple(p + nrm * 0.004)); CID.append(1.0)
        rot = rng.uniform(0, 2 * np.pi)
        for k in range(5):
            a = rot + k * 2 * np.pi / 5
            for (da, rf) in ((-0.42, 0.55), (-0.25, 0.95), (0.0, 1.0), (0.25, 0.95), (0.42, 0.55)):
                q = p + (t1 * np.cos(a + da) + t2 * np.sin(a + da)) * s * rf + nrm * 0.004 * (1 - rf)
                V.append(tuple(q)); CID.append(0.0)
        for k in range(5):
            o = base + 1 + k * 5
            F.append((base, o, o + 1)); F.append((base, o + 1, o + 2)); F.append((base, o + 2, o + 3))
            F.append((base, o + 3, o + 4))
    return V, F, CID


def mat_flower():
    m = new_mat('flower', lin((0.95, 0.40, 0.60)), 0.5)
    nb = NB(m)
    b = principled(m)
    cid = nb.attr('cid', 'Fac')
    c = nb.mix(cid, nb.rgb(lin((0.94, 0.24, 0.50))), nb.rgb(lin((1.0, 0.82, 0.20))))
    nb.link(c, b.inputs['Base Color'])
    m.use_backface_culling = False
    return m


def flower_bush(coll, loc, radius, seed, leaves, fmat, n_flowers=45):
    rng = np.random.RandomState(seed)
    z0 = ground_height(*loc)
    c = (loc[0], loc[1], z0 + radius * 0.55)
    bush = displaced_sphere(f'Bush{seed}', radius, scale=(1, 1, 0.8), subdiv=4, amp=0.10, freq=2.6,
                            seed=seed, mat=leaves, coll=coll, loc=c)
    V, F, CID = flower_mesh_data(rng, n_flowers, (0, 0, 0), radius, 0.8)
    me = C.mesh_from_arrays(f'Flowers{seed}', np.array(V), F, attrs={'cid': CID}, smooth=False)
    fo = C.obj_from_mesh(me, f'Flowers{seed}', coll)
    fo.location = c
    me.materials.append(fmat)
    return bush, fo


def hills(coll):
    m = new_mat('hills', lin((0.40, 0.60, 0.28)), 1.0)
    nb = NB(m)
    b = principled(m)
    p = nb.node('ShaderNodeTexCoord').outputs['Object']
    n = nb.node('ShaderNodeTexNoise', {'Vector': p, 'Scale': 0.05, 'Detail': 2.0})
    c = nb.mix(nb.maprange(n.outputs['Fac'], 0.3, 0.7, 0, 1), nb.rgb(lin((0.42, 0.62, 0.30))),
               nb.rgb(lin((0.50, 0.68, 0.34))))
    c = add_haze(nb, c, start=40, full=260, haze=(0.74, 0.84, 0.92))
    nb.link(c, b.inputs['Base Color'])
    b.inputs['Specular IOR Level'].default_value = 0.1
    obs = []
    rng = np.random.RandomState(4)
    for i in range(16):
        a = -1.0 + 2.0 * i / 15 + rng.normal(0, 0.05)
        dist = rng.uniform(110, 190)
        x, y = dist * math.sin(a * 1.4), dist * math.cos(a * 1.4)
        ob = displaced_sphere(f'Hill{i}', rng.uniform(35, 65), scale=(1.4, 1.0, 0.22), subdiv=4, amp=0.08,
                              freq=1.0, seed=100 + i, mat=m, coll=coll, loc=(x, y, -2.0))
        obs.append(ob)
    return obs


def sky(scene):
    w = bpy.data.worlds.new('Sky')
    scene.world = w
    w.use_nodes = True
    nb = NB(w)
    bg = nb.N['Background']
    tc = nb.node('ShaderNodeTexCoord')
    x, y, z = nb.sep(tc.outputs['Generated'])
    sep = nb.node('ShaderNodeSeparateXYZ')
    nb.link(tc.outputs['Generated'], sep.inputs[0])
    # use the view direction z for the gradient
    lp = nb.node('ShaderNodeLightPath')
    zz = nb.sep(nb.node('ShaderNodeNewGeometry').outputs['Incoming'])[2]
    t = nb.maprange(nb.math('MULTIPLY', zz, -1.0), -0.05, 0.6, 0, 1)
    col = nb.mix(t, nb.rgb(lin((0.86, 0.90, 0.95))), nb.rgb(lin((0.58, 0.73, 0.92))))
    nb.link(col, bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.0
    return w
