"""Props: clay bowl & pots, stone slab, shovel, leaves, plank seat, hole + dirt pile, yoke,
water tank with poles/rope/sign, bamboo pipe, river, cliff + waterfall."""
import math
import os
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix, noise
import common as C
from common import NB, new_mat, principled
from env_nature import lin, add_haze, ground_height, displaced_sphere

FONT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                    'assets', 'fonts', 'Poppins-ExtraBold.ttf')


# ------------------------------------------------------------------ materials
def mat_clay(name='clay', c=(0.74, 0.40, 0.24)):
    m = new_mat(name, lin(c), 0.8)
    nb = NB(m)
    b = principled(m)
    p = nb.node('ShaderNodeTexCoord').outputs['Object']
    n = nb.node('ShaderNodeTexNoise', {'Vector': p, 'Scale': 25.0, 'Detail': 2.0})
    col = nb.mix(nb.maprange(n.outputs['Fac'], 0.3, 0.7, 0, 1), nb.rgb(lin(tuple(x * 0.85 for x in c))),
                 nb.rgb(lin(tuple(min(1, x * 1.08) for x in c))))
    nb.link(col, b.inputs['Base Color'])
    bump = nb.node('ShaderNodeBump', {'Strength': 0.5, 'Distance': 0.004})
    nb.link(n.outputs['Fac'], bump.inputs['Height'])
    nb.link(bump.outputs['Normal'], b.inputs['Normal'])
    return m


def mat_wood(name='wood', c1=(0.62, 0.43, 0.25), c2=(0.48, 0.31, 0.17)):
    m = new_mat(name, lin(c1), 0.75)
    nb = NB(m)
    b = principled(m)
    p = nb.node('ShaderNodeTexCoord').outputs['Object']
    grain = nb.node('ShaderNodeTexNoise', {'Vector': nb.vmath('MULTIPLY', p, (28.0, 28.0, 1.2)), 'Scale': 4.0,
                                           'Detail': 2.0, 'Distortion': 0.5})
    blot = nb.node('ShaderNodeTexNoise', {'Vector': p, 'Scale': 6.0, 'Detail': 2.0})
    col = nb.mix(nb.maprange(grain.outputs['Fac'], 0.35, 0.65, 0, 1), nb.rgb(lin(c2)), nb.rgb(lin(c1)))
    col = nb.mix(nb.maprange(blot.outputs['Fac'], 0.4, 0.7, 0, 0.35), col, nb.rgb(lin(tuple(x * 0.8 for x in c2))))
    nb.link(col, b.inputs['Base Color'])
    bump = nb.node('ShaderNodeBump', {'Strength': 0.35, 'Distance': 0.003})
    nb.link(grain.outputs['Fac'], bump.inputs['Height'])
    nb.link(bump.outputs['Normal'], b.inputs['Normal'])
    return m


def mat_dirt(name='dirt'):
    m = new_mat(name, lin((0.45, 0.32, 0.22)), 0.95)
    nb = NB(m)
    b = principled(m)
    p = nb.node('ShaderNodeTexCoord').outputs['Object']
    n = nb.node('ShaderNodeTexNoise', {'Vector': p, 'Scale': 30.0, 'Detail': 2.0})
    col = nb.mix(nb.maprange(n.outputs['Fac'], 0.3, 0.7, 0, 1), nb.rgb(lin((0.36, 0.25, 0.16))),
                 nb.rgb(lin((0.52, 0.38, 0.26))))
    nb.link(col, b.inputs['Base Color'])
    bump = nb.node('ShaderNodeBump', {'Strength': 0.6, 'Distance': 0.01})
    nb.link(n.outputs['Fac'], bump.inputs['Height'])
    nb.link(bump.outputs['Normal'], b.inputs['Normal'])
    return m


def mat_water(name='water', c=(0.55, 0.78, 0.95), alpha=0.85, emit=0.0):
    m = new_mat(name, lin(c), 0.05)
    b = principled(m)
    b.inputs['Alpha'].default_value = alpha
    b.inputs['Coat Weight'].default_value = 0.5
    if emit:
        b.inputs['Emission Color'].default_value = (*lin(c), 1)
        b.inputs['Emission Strength'].default_value = emit
    m.blend_method = 'BLEND' if alpha < 1 else 'OPAQUE'
    m.shadow_method = 'NONE' if alpha < 1 else 'OPAQUE'
    m.use_backface_culling = False
    return m


def mat_flowing_water(name='flow', c=(0.62, 0.84, 0.97), speed_attr=None, scale=(3, 3, 0.6)):
    """streaky water whose pattern scrolls with the 'flow' value node (animated from python)."""
    m = new_mat(name, lin(c), 0.1)
    nb = NB(m)
    b = principled(m)
    p = nb.node('ShaderNodeTexCoord').outputs['Object']
    off = nb.value(0.0)
    off.node.name = 'flow_offset'
    pp = nb.vmath('ADD', nb.vmath('MULTIPLY', p, scale), nb.comb(0.0, 0.0, off))
    n = nb.node('ShaderNodeTexNoise', {'Vector': pp, 'Scale': 4.0, 'Detail': 2.0})
    streak = nb.smoothstep(n.outputs['Fac'], 0.50, 0.68)
    col = nb.mix(streak, nb.rgb(lin(c)), nb.rgb((0.95, 0.98, 1.0)))
    nb.link(col, b.inputs['Base Color'])
    b.inputs['Emission Color'].default_value = (*lin((0.75, 0.88, 0.98)), 1)
    nb.link(nb.maprange(streak, 0, 1, 0.08, 0.35), b.inputs['Emission Strength'])
    b.inputs['Coat Weight'].default_value = 0.4
    return m


def mat_rope(name='rope2'):
    m = new_mat(name, lin((0.66, 0.53, 0.35)), 0.9)
    nb = NB(m)
    b = principled(m)
    p = nb.node('ShaderNodeTexCoord').outputs['Object']
    w = nb.node('ShaderNodeTexWave', {'Vector': p, 'Scale': 60.0, 'Distortion': 1.0})
    w.wave_type = 'BANDS'; w.bands_direction = 'DIAGONAL'
    bump = nb.node('ShaderNodeBump', {'Strength': 0.8, 'Distance': 0.002})
    nb.link(w.outputs['Fac'], bump.inputs['Height'])
    nb.link(bump.outputs['Normal'], b.inputs['Normal'])
    col = nb.mix(nb.math('MULTIPLY', w.outputs['Fac'], 0.4), nb.rgb(lin((0.66, 0.53, 0.35))),
                 nb.rgb(lin((0.50, 0.38, 0.24))))
    nb.link(col, b.inputs['Base Color'])
    return m


def mat_leaf(name='leaf'):
    m = new_mat(name, lin((0.30, 0.62, 0.18)), 0.55)
    nb = NB(m)
    b = principled(m)
    v = nb.attr('lv', 'Fac')      # 0 at midrib -> 1 at edge
    u = nb.attr('lu', 'Fac')
    col = nb.mix(nb.smoothstep(v, 0.0, 0.12), nb.rgb(lin((0.62, 0.80, 0.38))), nb.rgb(lin((0.27, 0.58, 0.16))))
    col = nb.mix(nb.math('MULTIPLY', u, 0.3), col, nb.rgb(lin((0.20, 0.48, 0.12))))
    nb.link(col, b.inputs['Base Color'])
    b.inputs['Sheen Weight'].default_value = 0.2
    m.use_backface_culling = False
    return m


# ------------------------------------------------------------------ helpers
def lathe(name, profile, segs=48, mat=None, coll=None, smooth=True):
    """profile: list of (r, z) from bottom centre outward and up (and back in)."""
    V = []; F = []
    n = len(profile)
    for i in range(segs):
        a = 2 * math.pi * i / segs
        for (r, z) in profile:
            V.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(segs):
        i2 = (i + 1) % segs
        for j in range(n - 1):
            F.append((i * n + j, i2 * n + j, i2 * n + j + 1, i * n + j + 1))
    me = C.mesh_from_arrays(name, np.array(V), F, smooth=smooth)
    ob = C.obj_from_mesh(me, name, coll)
    if mat:
        me.materials.append(mat)
    return ob


def box(name, size, loc=(0, 0, 0), mat=None, coll=None, bevel=0.0, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    ob = C.obj_from_mesh(me, name, coll)
    if bevel:
        mod = ob.modifiers.new('bev', 'BEVEL'); mod.width = bevel; mod.segments = 2
    ob.location = loc
    ob.rotation_euler = rot
    if mat:
        me.materials.append(mat)
    return ob


def cylinder(name, r, h, loc=(0, 0, 0), mat=None, coll=None, segs=20, r2=None, rot=(0, 0, 0), caps=True):
    r2 = r if r2 is None else r2
    prof = [(0.0, 0.0), (r, 0.0), (r2, h), (0.0, h)] if caps else [(r, 0.0), (r2, h)]
    ob = lathe(name, prof, segs=segs, mat=mat, coll=coll)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def tube_along(name, pts, radius, mat=None, coll=None, segs=10):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for p, q in zip(sp.points, pts):
        p.co = (*q, 1)
    cu.bevel_depth = radius
    cu.bevel_resolution = 2
    ob = bpy.data.objects.new(name, cu)
    (coll or bpy.context.scene.collection).objects.link(ob)
    if mat:
        cu.materials.append(mat)
    return ob


# ------------------------------------------------------------------ props
def bowl(name, radius=0.17, height=0.11, coll=None, mat=None, water=None, water_level=0.75):
    prof = [(0.0, 0.0), (radius * 0.45, 0.0), (radius * 0.80, height * 0.25), (radius * 0.97, height * 0.65),
            (radius, height), (radius * 0.93, height * 1.0), (radius * 0.88, height * 0.62),
            (radius * 0.70, height * 0.25), (radius * 0.35, height * 0.10), (0.0, height * 0.10)]
    ob = lathe(name, prof, mat=mat, coll=coll)
    w = None
    if water:
        z = height * (0.10 + 0.88 * water_level)
        rr = radius * (0.70 + 0.20 * water_level)
        w = cylinder(name + '_water', rr, 0.002, loc=(0, 0, z), mat=water, coll=coll, segs=40)
        w.parent = ob
    return ob, w


def pot(name, radius=0.14, height=0.26, coll=None, mat=None):
    prof = [(0.0, 0.0), (radius * 0.5, 0.0), (radius * 0.92, height * 0.22), (radius, height * 0.48),
            (radius * 0.80, height * 0.78), (radius * 0.52, height * 0.90), (radius * 0.58, height),
            (radius * 0.50, height), (radius * 0.45, height * 0.9), (0.0, height * 0.9)]
    return lathe(name, prof, mat=mat, coll=coll)


def stone_slab(name, radius, thick, coll=None, mat=None, seed=0):
    rng = np.random.RandomState(seed)
    n = 9
    prof_top = []
    V = []; F = []
    angs = np.sort(rng.uniform(0, 2 * np.pi, n))
    rs = radius * rng.uniform(0.85, 1.05, n)
    for z in (0.0, thick):
        V.append((0, 0, z))
        for a, r in zip(angs, rs):
            V.append((r * math.cos(a), r * math.sin(a), z + (thick * 0.15 if z > 0 else 0)))
    for i in range(n):
        a = 1 + i; b_ = 1 + (i + 1) % n
        F.append((0, b_, a))
        F.append((n + 1, n + 1 + a, n + 1 + b_))
        F.append((a, b_, n + 1 + b_, n + 1 + a))
    me = C.mesh_from_arrays(name, np.array(V), F, smooth=False)
    ob = C.obj_from_mesh(me, name, coll)
    mod = ob.modifiers.new('bev', 'BEVEL'); mod.width = thick * 0.3; mod.segments = 3; mod.limit_method = 'NONE'
    if mat:
        me.materials.append(mat)
    return ob


def leaf(name, length=0.32, width=0.15, coll=None, mat=None, curl=0.35):
    nu, nv = 14, 7
    V = []; F = []; LU = []; LV = []
    for i in range(nu + 1):
        u = i / nu
        wv = width * math.sin(math.pi * u) ** 0.8 * (1 - 0.25 * u)
        for j in range(nv + 1):
            v = (j / nv) * 2 - 1
            x = v * wv / 2
            y = u * length
            z = curl * (v * v) * wv * 0.5 + 0.04 * math.sin(math.pi * u) * length * 0.3
            V.append((x, y, z)); LU.append(u); LV.append(abs(v))
    for i in range(nu):
        for j in range(nv):
            a = i * (nv + 1) + j
            F.append((a, a + 1, a + nv + 2, a + nv + 1))
    me = C.mesh_from_arrays(name, np.array(V), F, attrs={'lu': LU, 'lv': LV})
    ob = C.obj_from_mesh(me, name, coll)
    if mat:
        me.materials.append(mat)
    return ob


def shovel(coll, wood, stone, rope):
    root = bpy.data.objects.new('Shovel', None)
    coll.objects.link(root)
    h = cylinder('Shovel_handle', 0.016, 1.05, mat=wood, coll=coll, segs=12, r2=0.014)
    h.parent = root
    blade = displaced_sphere('Shovel_blade', 0.11, scale=(0.95, 0.22, 1.25), subdiv=3, amp=0.06, freq=2.0,
                             seed=5, mat=stone, coll=coll)
    blade.location = (0, 0, -0.08)
    blade.parent = root
    for k in range(3):
        r = bpy.data.meshes.new('ropewrap')
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=False, segments=12, radius1=0.021, radius2=0.021, depth=0.012)
        bm.to_mesh(r); bm.free()
        ro = C.obj_from_mesh(r, f'Shovel_rope{k}', coll)
        ro.location = (0, 0, 0.03 + k * 0.014)
        ro.parent = root
        r.materials.append(rope)
    return root


def plank_seat(coll, wood, dark_wood, size=0.56, height=0.44, hole_r=0.15):
    """box seat made of planks; returns (root empty, [plank objects with final local matrices])."""
    root = bpy.data.objects.new('Seat', None)
    coll.objects.link(root)
    planks = []
    th = 0.03
    pw = size / 4.0
    # side walls: 4 sides x 4 vertical planks
    for side in range(4):
        ang = side * math.pi / 2
        for k in range(4):
            off = -size / 2 + pw / 2 + k * pw
            local = Vector((off, -size / 2 + th / 2, 0))
            pos = Matrix.Rotation(ang, 4, 'Z') @ local
            p = box(f'Plank_s{side}_{k}', (pw * 0.48, th / 2, height / 2 - 0.004), mat=wood if (k + side) % 2 else dark_wood,
                    coll=coll, bevel=0.004)
            p.location = (pos.x, pos.y, height / 2 - 0.01)
            p.rotation_euler = (0, 0, ang + (k - 1.5) * 0.004)
            p.parent = root
            planks.append(p)
    # top with a round hole: ring polygon
    n = 48
    V = []; F = []
    for i in range(n):
        a = 2 * math.pi * i / n
        V.append((hole_r * math.cos(a), hole_r * math.sin(a), 0))
    # square outer, sampled with the same count along the perimeter
    for i in range(n):
        a = 2 * math.pi * i / n
        c, s = math.cos(a), math.sin(a)
        m = max(abs(c), abs(s))
        V.append((size / 2 * c / m, size / 2 * s / m, 0))
    for i in range(n):
        j = (i + 1) % n
        F.append((i, j, n + j, n + i))
    me = C.mesh_from_arrays('SeatTop', np.array(V), F, smooth=False)
    top = C.obj_from_mesh(me, 'SeatTop', coll)
    sol = top.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 0.035; sol.offset = 1.0
    bev = top.modifiers.new('bev', 'BEVEL'); bev.width = 0.006; bev.segments = 2; bev.limit_method = 'ANGLE'
    me.materials.append(wood)
    top.location = (0, 0, height)
    top.parent = root
    # plank lines on top (thin dark strips)
    for k in range(1, 4):
        strip = box(f'SeatGroove{k}', (size / 2 * 0.98, 0.0025, 0.002), mat=dark_wood, coll=coll)
        strip.location = (0, -size / 2 + k * size / 4, height + 0.036)
        strip.parent = root
    # dark hole interior
    hole = cylinder('SeatHoleDark', hole_r * 0.98, 0.002, loc=(0, 0, height + 0.02), coll=coll, segs=40,
                    mat=new_mat('blackhole', (0.01, 0.008, 0.006), 1.0))
    hole.parent = root
    return root, planks + [top]


def hole_and_pile(coll, dirt, x=0.0, y=0.0):
    """dark hole (scaled with dig progress) + annulus of dug dirt + growing pile."""
    z = ground_height(x, y)
    # dug-earth ring around the opening (a lumpy torus, leaves the centre free for the dark pit)
    bm = bmesh.new()
    nu, nv = 48, 12
    vs = []
    for i in range(nu):
        a_ = 2 * math.pi * i / nu
        ring = []
        for j in range(nv):
            b_ = 2 * math.pi * j / nv
            R0 = 0.31 + 0.025 * noise.noise(Vector((math.cos(a_) * 2, math.sin(a_) * 2, 5.0)))
            r0 = 0.085 * (1 + 0.25 * noise.noise(Vector((math.cos(a_) * 3, math.sin(a_) * 3, j * 0.4))))
            rr = R0 + r0 * math.cos(b_)
            zz = max(-0.01, r0 * math.sin(b_) * 0.55)
            ring.append(bm.verts.new((rr * math.cos(a_), rr * math.sin(a_), zz)))
        vs.append(ring)
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((vs[i][j], vs[(i + 1) % nu][j], vs[(i + 1) % nu][(j + 1) % nv], vs[i][(j + 1) % nv]))
    me_r = bpy.data.meshes.new('HoleRim')
    bm.to_mesh(me_r); bm.free()
    me_r.shade_smooth()
    rim = C.obj_from_mesh(me_r, 'HoleRim', coll)
    me_r.materials.append(dirt)
    rim.location = (x, y, z)
    # dark hole 'decal' with a radial depth gradient (reads as a deep pit from any angle)
    hm = new_mat('holedark', (0.025, 0.016, 0.010), 1.0)
    nb = NB(hm)
    p = nb.node('ShaderNodeTexCoord').outputs['Object']
    r = nb.vmath('LENGTH', nb.vmath('MULTIPLY', p, (1.0, 1.0, 0.0)))
    nz_ = nb.node('ShaderNodeTexNoise', {'Vector': p, 'Scale': 40.0, 'Detail': 1.0})
    col = nb.mix(nb.smoothstep(r, 0.10, 0.235), nb.rgb((0.010, 0.006, 0.004)), nb.rgb(lin((0.30, 0.20, 0.13))))
    col = nb.mix(nb.math('MULTIPLY', nz_.outputs['Fac'], 0.3), col, nb.rgb(lin((0.20, 0.13, 0.08))))
    nb.link(col, principled(hm).inputs['Base Color'])
    principled(hm).inputs['Specular IOR Level'].default_value = 0.1
    dark = lathe('HoleDark', [(0.0, 0.0), (0.235, 0.0)], segs=48, mat=hm, coll=coll)
    for v in dark.data.vertices:
        rr = math.hypot(v.co.x, v.co.y)
        if rr > 0.01:
            a_ = math.atan2(v.co.y, v.co.x)
            v.co.x *= 1 + 0.06 * math.sin(a_ * 5 + 1.0)
            v.co.y *= 1 + 0.06 * math.sin(a_ * 5 + 1.0)
    dark.location = (x, y, z + 0.010)
    pile = displaced_sphere('DirtPile', 0.30, scale=(1.1, 0.9, 0.45), subdiv=4, amp=0.16, freq=2.5, seed=78,
                            mat=dirt, coll=coll, loc=(x + 0.62, y + 0.38, z))
    return rim, dark, pile


def tank_assembly(coll, wood, dark_wood, rope, sign_paint, base=(0, 0, 0), seat_size=0.56):
    """4 poles, wooden tub tank on top, rope, FLUSH-O-MATIC 3000 sign. returns dict of parts."""
    parts = {}
    bx, by, bz = base
    half = seat_size / 2 + 0.06
    poles = []
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        p = cylinder(f'TankPole{i}', 0.035, 2.05, mat=dark_wood, coll=coll, segs=12, r2=0.03)
        p.location = (bx + sx * half, by + sy * half, bz - 0.05)
        poles.append(p)
    parts['poles'] = poles
    # cross beams
    beams = []
    for i, (a, b_) in enumerate((((-1, -1), (1, -1)), ((-1, 1), (1, 1)), ((-1, -1), (-1, 1)), ((1, -1), (1, 1)))):
        pa = Vector((bx + a[0] * half, by + a[1] * half, bz + 1.86))
        pb = Vector((bx + b_[0] * half, by + b_[1] * half, bz + 1.86))
        bm_ = box(f'TankBeam{i}', ((pb - pa).length / 2 + 0.05, 0.03, 0.03), mat=dark_wood, coll=coll, bevel=0.005)
        bm_.location = (pa + pb) / 2
        bm_.rotation_euler = (0, 0, math.atan2((pb - pa).y, (pb - pa).x))
        beams.append(bm_)
    parts['beams'] = beams
    # tub: staves around a lathe core
    tank_root = bpy.data.objects.new('Tank', None)
    coll.objects.link(tank_root)
    tank_root.location = (bx, by, bz + 1.90)
    core = lathe('TankCore', [(0.0, 0.0), (0.36, 0.0), (0.40, 0.42), (0.37, 0.44), (0.36, 0.05), (0.0, 0.05)],
                 segs=36, mat=wood, coll=coll)
    core.parent = tank_root
    for k in range(3):
        band = lathe(f'TankBand{k}', [(0.365 + 0.04 * (0.07 + 0.15 * k) / 0.42 * 1.0, 0.07 + 0.15 * k),
                                      (0.372 + 0.04 * (0.10 + 0.15 * k) / 0.42, 0.10 + 0.15 * k)],
                     segs=36, mat=rope, coll=coll)
        sol = band.modifiers.new('s', 'SOLIDIFY'); sol.thickness = 0.008
        band.parent = tank_root
    water = cylinder('TankWater', 0.37, 0.004, loc=(0, 0, 0.36), coll=coll, segs=36,
                     mat=mat_water('tankwater', (0.45, 0.70, 0.90), 1.0))
    water.parent = tank_root
    parts['tank'] = tank_root
    parts['tank_water'] = water
    # sign board + text
    board = box('SignBoard', (0.36, 0.015, 0.075), mat=dark_wood, coll=coll, bevel=0.006)
    board.location = (0, -0.41, 0.24)
    board.rotation_euler = (math.radians(-4), 0, 0)
    board.parent = tank_root
    cu = bpy.data.curves.new('SignText', 'FONT')
    cu.body = 'FLUSH-O-MATIC 3000'
    try:
        cu.font = bpy.data.fonts.load(FONT)
    except Exception:  # noqa
        pass
    cu.size = 0.062
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    cu.extrude = 0.002
    txt = bpy.data.objects.new('SignText', cu)
    coll.objects.link(txt)
    txt.location = (0, -0.426, 0.24)
    txt.rotation_euler = (math.radians(90 - 4), 0, 0)
    cu.materials.append(sign_paint)
    txt.parent = tank_root
    parts['sign'] = (board, txt)
    # rope from the tank lip down the front (hangs to ~1.15 m)
    rp = tube_along('FlushRope', [(0.10, -0.30, 0.02), (0.12, -0.33, -0.25), (0.13, -0.35, -0.55),
                                  (0.13, -0.36, -0.78)], 0.009, mat=rope, coll=coll)
    rp.parent = tank_root
    knob = displaced_sphere('RopeKnot', 0.022, subdiv=2, amp=0.1, seed=3, mat=rope, coll=coll)
    knob.location = (0.13, -0.36, -0.80)
    knob.parent = tank_root
    parts['rope'] = (rp, knob)
    return parts


def bamboo_segment(name, length, radius, mat, node_mat, coll):
    root = cylinder(name, radius, length, mat=mat, coll=coll, segs=14)
    for k, z in enumerate((0.02, length - 0.02)):
        ring = cylinder(f'{name}_n{k}', radius * 1.12, 0.03, loc=(0, 0, z - 0.015), mat=node_mat, coll=coll, segs=14)
        ring.parent = root
    return root


def mat_bamboo():
    m = new_mat('bamboo', lin((0.72, 0.74, 0.36)), 0.45)
    nb = NB(m)
    b = principled(m)
    p = nb.node('ShaderNodeTexCoord').outputs['Object']
    n = nb.node('ShaderNodeTexNoise', {'Vector': nb.vmath('MULTIPLY', p, (30, 30, 1.5)), 'Scale': 3.0})
    col = nb.mix(nb.maprange(n.outputs['Fac'], 0.3, 0.7, 0, 1), nb.rgb(lin((0.62, 0.68, 0.30))),
                 nb.rgb(lin((0.80, 0.80, 0.42))))
    nb.link(col, b.inputs['Base Color'])
    return m


def river(coll, y0=11.0, width=2.6, x_range=(-60, 60), stone_mat=None):
    xs = np.linspace(x_range[0], x_range[1], 241)
    V = []; F = []
    for i, x in enumerate(xs):
        yc = y0 + 1.2 * math.sin(x * 0.08)
        for s in (-1, 1):
            V.append((x, yc + s * width / 2, ground_height(x, yc) + 0.09))
    for i in range(len(xs) - 1):
        a = i * 2
        F.append((a, a + 2, a + 3, a + 1))
    me = C.mesh_from_arrays('River', np.array(V), F)
    ob = C.obj_from_mesh(me, 'River', coll)
    m = mat_flowing_water('river', (0.30, 0.60, 0.88), scale=(0.6, 2.5, 1.0))
    me.materials.append(m)
    # river bed (darker) slightly below and banks of stones
    rng = np.random.RandomState(9)
    stones = []
    for k in range(70):
        x = rng.uniform(-14, 22)
        yc = y0 + 1.2 * math.sin(x * 0.08)
        s = rng.choice([-1, 1])
        y = yc + s * (width / 2 + rng.uniform(-0.15, 0.25))
        r = rng.uniform(0.06, 0.20)
        st = displaced_sphere(f'RiverStone{k}', r, scale=(1, 0.85, 0.55), subdiv=2, amp=0.15, seed=300 + k,
                              mat=stone_mat, coll=coll, loc=(x, y, ground_height(x, y) - 0.02))
        stones.append(st)
    return ob, m


def river_y(x, y0=11.0):
    return y0 + 1.2 * math.sin(x * 0.08)


def cliff_and_waterfall(coll, rock_mat, y0=34.0, top=19.0, fall_x=1.5):
    """huge rocky cliff wall with a waterfall sheet, pool and mist puffs."""
    nx, nz = 90, 40
    V = []; F = []
    xs = np.linspace(-45, 45, nx)
    zs = np.linspace(-2, top, nz)
    for i, x in enumerate(xs):
        for j, z in enumerate(zs):
            yy = y0 + 2.5 * noise.noise(Vector((x * 0.08, z * 0.1, 0))) + 0.8 * noise.noise(Vector((x * 0.4, z * 0.4, 3)))
            # recess where the waterfall falls
            yy += 1.6 * math.exp(-((x - fall_x) / 3.0) ** 2)
            zz = z if z < top - 0.5 else top + 0.6 * noise.noise(Vector((x * 0.2, 9, 0)))
            V.append((x, yy, zz))
    for i in range(nx - 1):
        for j in range(nz - 1):
            a = i * nz + j
            F.append((a, a + nz, a + nz + 1, a + 1))
    # top plateau back
    me = C.mesh_from_arrays('Cliff', np.array(V), F)
    cliff = C.obj_from_mesh(me, 'Cliff', coll)
    me.materials.append(rock_mat)
    plateau = box('CliffTop', (45, 12, 0.5), loc=(0, y0 + 12, top), mat=new_mat('plateau', lin((0.42, 0.62, 0.28)), 1.0),
                  coll=coll)
    # waterfall sheet (curved, slightly in front of the recess)
    nzw = 30
    V = []; F = []
    for j in range(nzw + 1):
        t = j / nzw
        z = top + 0.2 - t * (top + 0.4)
        bulge = 0.9 * math.sin(math.pi * min(1.0, t * 1.2)) + (1.0 if t < 0.04 else 0)
        for k, xx in enumerate(np.linspace(-1.6 - 0.8 * t, 1.6 + 0.8 * t, 9)):
            V.append((fall_x + xx, y0 + 1.2 - bulge - 0.3 * t, z))
    for j in range(nzw):
        for k in range(8):
            a = j * 9 + k
            F.append((a, a + 1, a + 10, a + 9))
    me = C.mesh_from_arrays('Waterfall', np.array(V), F)
    wf = C.obj_from_mesh(me, 'Waterfall', coll)
    wm = mat_flowing_water('waterfall', (0.78, 0.90, 0.98), scale=(1.5, 1.5, 0.35))
    me.materials.append(wm)
    pool = displaced_sphere('Pool', 5.0, scale=(1.3, 0.8, 0.02), subdiv=3, amp=0.05, seed=901,
                            mat=mat_flowing_water('pool', (0.40, 0.68, 0.92), scale=(1, 1, 1)), coll=coll,
                            loc=(fall_x, y0 - 3.0, 0.02))
    mist = []
    mm = new_mat('mist', (1, 1, 1), 1.0)
    b = principled(mm)
    b.inputs['Alpha'].default_value = 0.55
    b.inputs['Emission Color'].default_value = (1, 1, 1, 1)
    b.inputs['Emission Strength'].default_value = 0.3
    mm.blend_method = 'BLEND'; mm.shadow_method = 'NONE'
    rng = np.random.RandomState(5)
    for k in range(14):
        s = displaced_sphere(f'Mist{k}', rng.uniform(1.2, 2.4), scale=(1.2, 0.8, 0.7), subdiv=3, amp=0.2,
                             seed=600 + k, mat=mm, coll=coll,
                             loc=(fall_x + rng.uniform(-3.5, 3.5), y0 - 1.5 + rng.uniform(-1.5, 1.0), rng.uniform(0.3, 2.5)))
        mist.append(s)
    return dict(cliff=cliff, plateau=plateau, waterfall=wf, wf_mat=wm, pool=pool, mist=mist)
