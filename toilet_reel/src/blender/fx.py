"""Cartoon effects in 3D: stink lines, flies + tears, smoke poofs, confetti, dirt chunks,
water stream / splash droplets, sweat drops, neighbour arm, explainer studio scene.

Particle-like effects are single meshes whose vertices are rewritten every frame."""
import math
import os
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix, Quaternion
import common as C
from common import NB, new_mat, principled
from env_nature import lin

RNG = np.random.RandomState(21)


def emissive(name, color, strength=1.0, alpha=1.0):
    m = new_mat(name, color, 0.5)
    b = principled(m)
    b.inputs['Emission Color'].default_value = (*color[:3], 1)
    b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND'
        m.shadow_method = 'NONE'
    return m


# ------------------------------------------------------------------ particle mesh (many small blobs)
def blob_template(subdiv=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    V = np.array([v.co[:] for v in bm.verts])
    F = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    return V, F


class Particles:
    """N instances of a template mesh in one object; set(pos(N,3), scale(N,) or (N,3), rot quats)."""

    def __init__(self, name, n, coll, mat, template=None, attrs=None):
        tV, tF = template if template is not None else blob_template(1)
        self.tV = np.asarray(tV, dtype=np.float32)
        self.n = n
        nv = len(tV)
        V = np.tile(self.tV, (n, 1))
        F = [tuple(i + k * nv for i in f) for k in range(n) for f in tF]
        a = {}
        if attrs:
            for k, v in attrs.items():
                a[k] = np.repeat(np.asarray(v, dtype=np.float32), nv)
        me = C.mesh_from_arrays(name, V, F, attrs=a)
        self.ob = C.obj_from_mesh(me, name, coll)
        me.materials.append(mat)
        self.ob.hide_render = True

    def set(self, pos, scale, rotm=None):
        n = self.n
        pos = np.asarray(pos, dtype=np.float32).reshape(n, 3)
        sc = np.asarray(scale, dtype=np.float32)
        if sc.ndim == 1:
            sc = sc[:, None].repeat(3, 1)
        V = self.tV[None, :, :] * sc[:, None, :]
        if rotm is not None:
            V = np.einsum('nij,nvj->nvi', rotm.astype(np.float32), V)
        V = V + pos[:, None, :]
        me = self.ob.data
        me.vertices.foreach_set('co', V.reshape(-1).astype(np.float32))
        me.update()

    def show(self, on=True):
        self.ob.hide_render = not on


def rot_matrices(axes, angles):
    """batch axis-angle -> (N,3,3)."""
    axes = axes / (np.linalg.norm(axes, axis=1, keepdims=True) + 1e-9)
    x, y, z = axes[:, 0], axes[:, 1], axes[:, 2]
    c = np.cos(angles); s = np.sin(angles); t = 1 - c
    R = np.empty((len(axes), 3, 3))
    R[:, 0, 0] = t * x * x + c; R[:, 0, 1] = t * x * y - s * z; R[:, 0, 2] = t * x * z + s * y
    R[:, 1, 0] = t * x * y + s * z; R[:, 1, 1] = t * y * y + c; R[:, 1, 2] = t * y * z - s * x
    R[:, 2, 0] = t * x * z - s * y; R[:, 2, 1] = t * y * z + s * x; R[:, 2, 2] = t * z * z + c
    return R


# ------------------------------------------------------------------ builders
STINK_N = 7


def build_all(coll):
    objs = {}
    # stink lines: curve tubes, light green semi-transparent emissive
    sm = emissive('stink', lin((0.62, 0.86, 0.30)), 1.2, alpha=0.85)
    for i in range(STINK_N):
        cu = bpy.data.curves.new(f'Stink{i}', 'CURVE')
        cu.dimensions = '3D'
        sp = cu.splines.new('POLY')
        sp.points.add(39)
        cu.bevel_depth = 0.010
        cu.bevel_resolution = 2
        cu.use_fill_caps = True
        ob = bpy.data.objects.new(f'Stink{i}', cu)
        coll.objects.link(ob)
        cu.materials.append(sm)
        ob.hide_render = True
    # flies: body (black), eyes (red-brown), wings (white translucent)
    body = new_mat('flybody', (0.02, 0.02, 0.025), 0.35)
    eye = new_mat('flyeye', lin((0.65, 0.12, 0.08)), 0.2)
    wing = emissive('flywing', (0.9, 0.95, 1.0), 0.4, alpha=0.55)
    for i in range(5):
        root = bpy.data.objects.new(f'Fly{i}', None)
        coll.objects.link(root)
        b_ = make_ellipsoid(f'Fly{i}_body', (0.011, 0.016, 0.010), body, coll)
        b_.parent = root
        h = make_ellipsoid(f'Fly{i}_head', (0.008, 0.007, 0.007), body, coll)
        h.location = (0, -0.016, 0.003); h.parent = root
        for s in (1, -1):
            e = make_ellipsoid(f'Fly{i}_eye{s}', (0.0045, 0.0045, 0.0045), eye, coll)
            e.location = (s * 0.005, -0.019, 0.005); e.parent = root
            w = make_ellipsoid(f'Fly{i}_wing{s}', (0.016, 0.008, 0.0012), wing, coll)
            w.location = (s * 0.012, 0.002, 0.010); w.parent = root
        for o in [root] + list(root.children):
            o.hide_render = True
    # particle systems
    tear = new_mat('tear', lin((0.35, 0.65, 1.0)), 0.05)
    principled(tear).inputs['Emission Color'].default_value = (*lin((0.45, 0.75, 1.0)), 1)
    principled(tear).inputs['Emission Strength'].default_value = 0.6
    objs['tears'] = Particles('Tears', 24, coll, tear, blob_template(1))
    dirt = bpy.data.materials.get('dirt') or new_mat('dirt', lin((0.45, 0.32, 0.22)), 0.95)
    objs['dirtbits'] = Particles('DirtBits', 40, coll, dirt, blob_template(1))
    drop = new_mat('droplet', lin((0.62, 0.84, 1.0)), 0.05)
    principled(drop).inputs['Emission Color'].default_value = (*lin((0.70, 0.88, 1.0)), 1)
    principled(drop).inputs['Emission Strength'].default_value = 0.35
    objs['drops'] = Particles('Drops', 260, coll, drop, blob_template(1))
    objs['sweat'] = Particles('Sweat', 10, coll, tear, blob_template(1))
    # smoke poofs: 5 clusters of 12 puffy spheres
    smoke = new_mat('smoke', (0.92, 0.93, 0.95), 1.0)
    principled(smoke).inputs['Emission Color'].default_value = (1, 1, 1, 1)
    principled(smoke).inputs['Emission Strength'].default_value = 0.12
    principled(smoke).inputs['Sheen Weight'].default_value = 1.0
    principled(smoke).inputs['Subsurface Weight'].default_value = 0.3
    principled(smoke).inputs['Roughness'].default_value = 1.0
    smoke.shadow_method = 'NONE'
    for k in range(5):
        objs[f'poof{k}'] = Particles(f'Poof{k}', 14, coll, smoke, blob_template(3))
    # confetti: flat quads with colour id
    conf = new_mat('confetti', (1, 1, 1), 0.5)
    nb = NB(conf)
    cid = nb.attr('cid', 'Fac')
    ramp = nb.node('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    cr.interpolation = 'CONSTANT'
    cols = [(1.0, 0.25, 0.3), (1.0, 0.85, 0.2), (0.25, 0.75, 1.0), (0.45, 0.9, 0.35), (0.95, 0.45, 0.9),
            (1.0, 0.55, 0.15)]
    cr.elements[0].position = 0.0; cr.elements[0].color = (*lin(cols[0]), 1)
    cr.elements[1].position = 1 / 6; cr.elements[1].color = (*lin(cols[1]), 1)
    for i in range(2, 6):
        e = cr.elements.new(i / 6); e.color = (*lin(cols[i]), 1)
    nb.link(cid, ramp.inputs[0])
    nb.link(ramp.outputs[0], principled(conf).inputs['Base Color'])
    nb.link(ramp.outputs[0], principled(conf).inputs['Emission Color'])
    principled(conf).inputs['Emission Strength'].default_value = 0.25
    conf.use_backface_culling = False
    quad = (np.array([[-1, -0.5, 0], [1, -0.5, 0], [1, 0.5, 0], [-1, 0.5, 0]], dtype=np.float32), [(0, 1, 2, 3)])
    objs['confetti'] = Particles('Confetti', 420, coll, conf, quad, attrs={'cid': RNG.uniform(0, 0.999, 420)})
    # water stream tube (rebuilt per frame) + water jet
    wmat = new_mat('stream', lin((0.62, 0.84, 1.0)), 0.05)
    principled(wmat).inputs['Emission Color'].default_value = (*lin((0.72, 0.90, 1.0)), 1)
    principled(wmat).inputs['Emission Strength'].default_value = 0.45
    principled(wmat).inputs['Coat Weight'].default_value = 0.6
    for nm in ('Stream', 'Stream2', 'Jet'):
        cu = bpy.data.curves.new(nm, 'CURVE')
        cu.dimensions = '3D'
        sp = cu.splines.new('POLY')
        sp.points.add(23)
        cu.bevel_depth = 0.02
        cu.bevel_resolution = 3
        ob = bpy.data.objects.new(nm, cu)
        coll.objects.link(ob)
        cu.materials.append(wmat)
        ob.hide_render = True
    return objs


def make_ellipsoid(name, radii, mat, coll):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * radii[0], v.co.y * radii[1], v.co.z * radii[2]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    me.shade_smooth()
    ob = C.obj_from_mesh(me, name, coll)
    me.materials.append(mat)
    return ob


def set_curve(ob, pts, radius=None, radii=None):
    sp = ob.data.splines[0]
    n = len(sp.points)
    pts = np.asarray(pts)
    if len(pts) != n:
        idx = np.linspace(0, len(pts) - 1, n)
        pts = np.stack([np.interp(idx, np.arange(len(pts)), pts[:, k]) for k in range(3)], 1)
    for i, p in enumerate(sp.points):
        p.co = (pts[i][0], pts[i][1], pts[i][2], 1)
        if radii is not None:
            p.radius = float(radii[i])
    if radius is not None:
        ob.data.bevel_depth = radius


# ------------------------------------------------------------------ per-frame effect updaters
def stink_update(t, t0, t1, src, height=0.75, strength=1.0, spread=0.18, n=STINK_N, phase=0.0, fade_out=None):
    """wavy rising lines above src (x,y,z) visible in [t0,t1]."""
    for i in range(STINK_N):
        ob = bpy.data.objects[f'Stink{i}']
        if i >= n or t < t0 or t > t1:
            ob.hide_render = True
            continue
        life = (t - t0)
        ob.hide_render = False
        # each line loops: rises over 1.2 s
        per = 1.25
        u = ((life + i * 0.37 + phase) % per) / per
        rise = min(1.0, (t - t0) / 0.35)
        if fade_out is not None and t > fade_out:
            rise *= max(0.0, 1 - (t - fade_out) / 0.35)
        ang = i * 2.39996
        bx = src[0] + math.cos(ang) * spread * (0.4 + 0.6 * ((i * 7) % 5) / 4)
        by = src[1] + math.sin(ang) * spread * 0.6
        pts = []
        L = height * (0.75 + 0.25 * ((i * 3) % 4) / 3) * strength
        for k in range(40):
            s = k / 39
            z = src[2] + 0.05 + u * 0.25 + s * L
            w = 0.035 * math.sin(s * 11.0 + t * 7.0 + i) * (0.6 + s)
            pts.append((bx + w, by + 0.4 * w, z))
        set_curve(ob, pts)
        sp = ob.data.splines[0]
        for k, p in enumerate(sp.points):
            s = k / 39
            p.radius = max(0.0, math.sin(math.pi * min(1, s * 1.05)) * rise * (1 - 0.5 * u))


def flies_update(t, t0, t1, center, radius=0.28, height=0.32, tears=None):
    tear_pos = []
    for i in range(5):
        root = bpy.data.objects[f'Fly{i}']
        vis = t0 <= t <= t1
        for o in [root] + list(root.children):
            o.hide_render = not vis
        if not vis:
            continue
        a = t * (2.6 + 0.4 * i) + i * 1.2566
        r = radius * (0.75 + 0.25 * math.sin(t * 3 + i))
        x = center[0] + r * math.cos(a)
        y = center[1] + r * math.sin(a) * 0.8
        z = center[2] + height * (0.6 + 0.4 * math.sin(t * 4.1 + i * 2))
        root.location = (x, y, z)
        root.rotation_euler = (0.25 * math.sin(t * 9 + i), 0.2 * math.sin(t * 7 + i), a + math.pi)
        root.scale = (1.6, 1.6, 1.6)
        flap = math.sin(t * 160 + i) * 0.9
        for ch in root.children:
            if 'wing1' in ch.name:
                ch.rotation_euler = (0, flap, 0)
            elif 'wing-1' in ch.name:
                ch.rotation_euler = (0, -flap, 0)
        tear_pos.append((x, y, z))
    if tears is not None:
        P = np.zeros((tears.n, 3)); S = np.zeros(tears.n)
        if t0 <= t <= t1 and tear_pos:
            for k in range(tears.n):
                fi = k % 5
                ph = ((t * 1.6 + k * 0.173) % 1.0)
                fx, fy, fz = tear_pos[fi]
                side = 1 if (k // 5) % 2 else -1
                P[k] = (fx + side * 0.012, fy - 0.025, fz - ph * 0.22)
                S[k] = 0.0045 * (1 - ph * 0.5)
        tears.set(P, np.stack([S, S, S * 1.5], 1))
        tears.show(t0 <= t <= t1)


def poof_update(p, t, t0, center, size=0.5, seed=0, dur=0.7):
    """white puffy smoke cloud expanding then shrinking away."""
    rng = np.random.RandomState(seed)
    n = p.n
    dirs = rng.normal(0, 1, (n, 3)); dirs[:, 2] = np.abs(dirs[:, 2]) * 0.6
    dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
    base_s = rng.uniform(0.18, 0.32, n) * size
    if t < t0 or t > t0 + dur:
        p.show(False)
        return
    u = (t - t0) / dur
    grow = 1 - (1 - min(1, u / 0.35)) ** 3
    shrink = 1.0 if u < 0.55 else max(0.0, 1 - (u - 0.55) / 0.45) ** 1.5
    pos = np.asarray(center)[None, :] + dirs * size * (0.15 + 0.55 * grow) + np.array([0, 0, 0.12 * u * size])
    s = base_s * (0.4 + 0.9 * grow) * shrink
    p.set(pos, s)
    p.show(True)


def ballistic(p0, v0, t, g=9.8):
    return p0 + v0 * t + np.array([0, 0, -0.5 * g]) * t * t


def neighbour_arm(coll):
    """load the neighbour's big pointing hand + forearm (built by build_meshes.py)."""
    path = os.environ.get('NEIGHBOUR_NPZ', '')
    if not path or not os.path.exists(path):
        print('no neighbour mesh')
        return None
    d = np.load(path)
    V, F = d['V'], d['F']
    me = C.mesh_from_arrays('NeighbourArm', V, F, vec_attrs={'rest': V})
    ob = C.obj_from_mesh(me, 'NeighbourArm', coll)
    m = new_mat('neighbour_skin', lin((0.80, 0.58, 0.44)), 0.5)
    b = principled(m)
    b.inputs['Subsurface Weight'].default_value = 0.15
    b.inputs['Subsurface Radius'].default_value = (1.0, 0.35, 0.2)
    b.inputs['Subsurface Scale'].default_value = 0.004
    me.materials.append(m)
    # fur cuff at the forearm end
    leo = bpy.data.materials.get('leopard')
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.062, radius2=0.058, depth=0.12)
    me2 = bpy.data.meshes.new('NeighbourCuff')
    bm.to_mesh(me2); bm.free()
    cuff = C.obj_from_mesh(me2, 'NeighbourCuff', coll)
    cuff.rotation_euler = (0, math.radians(90), 0)
    cuff.location = (0.36, 0, 0)
    cuff.parent = ob
    vv = C.verts_np(me2)
    a = me2.attributes.new('rest', 'FLOAT_VECTOR', 'POINT'); a.data.foreach_set('vector', (vv * 3).ravel())
    if leo:
        me2.materials.append(leo)
    me2.shade_smooth()
    ob.hide_render = True
    cuff.hide_render = True
    return ob


# ------------------------------------------------------------------ explainer studio
def build_studio():
    st = bpy.data.scenes.new('Studio')
    garden = bpy.context.scene
    st.render.engine = 'BLENDER_EEVEE'
    st.eevee.taa_render_samples = 12
    st.eevee.use_gtao = True
    st.eevee.use_soft_shadows = True
    st.view_settings.view_transform = 'Standard'
    st.render.resolution_x = garden.render.resolution_x
    st.render.resolution_y = garden.render.resolution_y
    st.render.fps = 30
    w = bpy.data.worlds.new('StudioWorld')
    st.world = w
    w.use_nodes = True
    nb = NB(w)
    bg = nb.N['Background']
    # screen-space like vertical gradient using the view direction
    tc = nb.node('ShaderNodeTexCoord')
    x, y, z = nb.sep(tc.outputs['Generated'])
    t = nb.maprange(z, -0.6, 0.6, 0, 1)
    col = nb.mix(t, nb.rgb(lin((0.62, 0.76, 0.90))), nb.rgb(lin((0.84, 0.90, 0.96))))
    nb.link(col, bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.0
    coll = bpy.data.collections.new('StudioObjs')
    st.collection.children.link(coll)
    glass = new_mat('glass', (0.92, 0.95, 1.0), 0.05)
    b = principled(glass)
    b.inputs['Alpha'].default_value = 0.38
    b.inputs['Base Color'].default_value = (0.80, 0.88, 0.98, 1)
    b.inputs['Emission Color'].default_value = (0.85, 0.92, 1.0, 1)
    b.inputs['Emission Strength'].default_value = 0.12
    b.inputs['Coat Weight'].default_value = 1.0
    glass.blend_method = 'BLEND'; glass.shadow_method = 'NONE'; glass.use_backface_culling = False
    glass.show_transparent_back = False
    rim = new_mat('rimwhite', (0.95, 0.96, 0.98), 0.3)
    water = new_mat('studiowater', lin((0.35, 0.62, 0.95)), 0.1)
    principled(water).inputs['Alpha'].default_value = 0.8
    principled(water).inputs['Emission Color'].default_value = (*lin((0.40, 0.66, 0.98)), 1)
    principled(water).inputs['Emission Strength'].default_value = 0.25
    water.blend_method = 'BLEND'; water.shadow_method = 'NONE'
    arrow = new_mat('arrowgreen', lin((0.35, 0.95, 0.45)), 0.4)
    principled(arrow).inputs['Emission Color'].default_value = (*lin((0.35, 0.95, 0.45)), 1)
    principled(arrow).inputs['Emission Strength'].default_value = 0.6
    ropem = bpy.data.materials.get('rope2')
    import props as PR
    # seat (glass box) + tank (glass tub) on glass poles
    seat = PR.box('S_Seat', (0.28, 0.28, 0.22), loc=(0, 0, 0.22), mat=glass, coll=coll, bevel=0.01)
    seat_rim = PR.lathe('S_SeatHole', [(0.15, 0.0), (0.17, 0.0), (0.17, 0.01), (0.15, 0.01)], mat=rim, coll=coll)
    seat_rim.location = (0, 0, 0.445)
    tank_root = bpy.data.objects.new('S_Tank', None)
    coll.objects.link(tank_root)
    tank_root.location = (0, 0.36, 1.90)       # pivot at the tank's front-bottom edge
    tub = PR.lathe('S_Tub', [(0.0, 0.0), (0.36, 0.0), (0.40, 0.44), (0.0, 0.44)], segs=40, mat=glass, coll=coll)
    tub.location = (0, -0.36, 0); tub.parent = tank_root
    for zz in (0.0, 0.44):
        r = PR.lathe(f'S_TubRim{zz}', [(0.36 + 0.09 * zz, zz - 0.006), (0.37 + 0.09 * zz, zz - 0.006),
                                        (0.37 + 0.09 * zz, zz + 0.006), (0.36 + 0.09 * zz, zz + 0.006)],
                     segs=40, mat=rim, coll=coll)
        r.location = (0, -0.36, 0); r.parent = tank_root
    wv = PR.lathe('S_TankWater', [(0.0, 0.01), (0.355, 0.01), (0.385, 0.34), (0.0, 0.34)], segs=40, mat=water,
                  coll=coll)
    wv.location = (0, -0.36, 0); wv.parent = tank_root
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        PR.cylinder(f'S_Pole{i}', 0.03, 1.95, loc=(sx * 0.34, sy * 0.34, 0.0), mat=glass, coll=coll, segs=12)
    rp = PR.tube_along('S_Rope', [(0.10, -0.30, 1.92), (0.12, -0.36, 1.6), (0.13, -0.38, 1.25)], 0.010,
                       mat=ropem, coll=coll)
    # arrows (cone + shaft) created as one mesh each; animated in shots
    for nm in ('S_ArrowPull', 'S_ArrowFlow', 'S_ArrowTip'):
        a = PR.cylinder(nm, 0.022, 0.30, mat=arrow, coll=coll, segs=16)
        head = PR.cylinder(nm + '_head', 0.055, 0.12, mat=arrow, coll=coll, segs=16, r2=0.0)
        head.location = (0, 0, 0.30); head.parent = a
    # water stream in studio
    cu = bpy.data.curves.new('S_Stream', 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY'); sp.points.add(23)
    cu.bevel_depth = 0.035; cu.bevel_resolution = 3
    so = bpy.data.objects.new('S_Stream', cu); coll.objects.link(so); cu.materials.append(water)
    # lights + camera
    key = bpy.data.objects.new('S_Key', bpy.data.lights.new('S_Key', 'AREA'))
    coll.objects.link(key)
    key.data.energy = 900; key.data.size = 4.0
    key.location = (2.5, -3.5, 4.0)
    C.look_at(key, (0, 0, 1.0))
    sun = bpy.data.objects.new('S_Sun', bpy.data.lights.new('S_Sun', 'SUN'))
    coll.objects.link(sun)
    sun.data.energy = 2.0
    sun.rotation_euler = (math.radians(35), 0, math.radians(25))
    cam = bpy.data.objects.new('S_Camera', bpy.data.cameras.new('S_Camera'))
    coll.objects.link(cam)
    cam.data.sensor_fit = 'VERTICAL'; cam.data.sensor_height = 36.0
    cam.data.lens = 50
    cam.location = (0.9, -3.9, 1.55)
    C.look_at(cam, (0, 0, 1.18))
    st.camera = cam
    return st
