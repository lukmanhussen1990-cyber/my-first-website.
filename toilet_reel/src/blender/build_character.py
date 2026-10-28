"""Assemble the caveman grandpa: meshes, skeleton, weights, eyes, hair, materials.

blender -b --python build_character.py -- <mesh_dir> <out.blend> [preview|full]
"""
import os
import sys
import math
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.dirname(HERE)]
import common as C  # noqa: E402
import char_eyes  # noqa: E402
import char_materials as CM  # noqa: E402
import char_hair as CH  # noqa: E402
import body_def as BD  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
MESH_DIR, OUT = argv[0], argv[1]
QUALITY = argv[2] if len(argv) > 2 else 'full'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
COLL = C.get_coll('Caveman')
J = BD.J
FWD = Vector((0, -1, 0))
UP = Vector((0, 0, 1))
SEAM_Z = 1.430

# ------------------------------------------------------------------ skeleton
BONES = []


def B(name, h, t, z, parent, deform=True):
    BONES.append((name, Vector(h), Vector(t), Vector(z), parent, deform))


B('root', (0, 0, 0), (0, -0.25, 0), UP, None, False)
B('hips', J['hips'], J['spine'], FWD, 'root')
B('spine', J['spine'], J['chest'], FWD, 'hips')
B('chest', J['chest'], J['neck'], FWD, 'spine')
B('neck', J['neck'], J['head'], FWD, 'chest')
B('head', J['head'], J['head_tail'], FWD, 'neck')
B('jaw', J['jaw'], J['jaw_tail'], UP, 'head')
B('lipU', (0, -0.100, 1.503), (0, -0.110, 1.503), UP, 'head')
B('lipD', (0, -0.097, 1.489), (0, -0.107, 1.489), UP, 'jaw')
for side, s in (('L', 1), ('R', -1)):
    e = Vector(J['eye.' + side])
    B('eye.' + side, e, e + Vector((0, -0.02, 0)), UP, 'head')
    B('lidU.' + side, e, e + Vector((0, -0.018, 0)), UP, 'head', False)
    B('lidD.' + side, e, e + Vector((0, -0.016, 0)), UP, 'head', False)
    B('brow.' + side, (s * 0.030, -0.086, 1.596), (s * 0.030, -0.086, 1.611), FWD, 'head')
    B('cheek.' + side, (s * 0.041, -0.078, 1.534), (s * 0.041, -0.078, 1.546), FWD, 'head')
    B('mouth.' + side, (s * 0.026, -0.091, 1.497), (s * 0.026, -0.101, 1.497), UP, 'head')
    d, t, n = BD.arm_frame(s)
    n = Vector(n)
    B('clav.' + side, J['clav.' + side], J['shoulder.' + side], FWD, 'chest')
    B('upperarm.' + side, J['shoulder.' + side], J['elbow.' + side], FWD, 'clav.' + side)
    B('forearm.' + side, J['elbow.' + side], J['wrist.' + side], FWD, 'upperarm.' + side)
    B('hand.' + side, J['wrist.' + side], J['hand_tip.' + side], n, 'forearm.' + side)
    for f, pts in BD.finger_chains(side).items():
        par = 'hand.' + side
        for i in range(3):
            nm = f'{f}{i + 1}.{side}'
            B(nm, pts[i], pts[i + 1], n, par)
            par = nm
    B('thigh.' + side, J['hip.' + side], J['knee.' + side], FWD, 'hips')
    B('shin.' + side, J['knee.' + side], J['ankle.' + side], FWD, 'thigh.' + side)
    B('foot.' + side, J['ankle.' + side], J['ball.' + side], UP, 'shin.' + side)
    B('toe.' + side, J['ball.' + side], J['toe_tip.' + side], UP, 'foot.' + side)
    B(f'hair.{side}1', (s * 0.070, 0.030, 1.590), (s * 0.094, 0.046, 1.505), FWD, 'head')
    B(f'hair.{side}2', (s * 0.094, 0.046, 1.505), (s * 0.104, 0.062, 1.425), FWD, f'hair.{side}1')
    B('skirt.' + side, (s * 0.150, 0.015, 1.020), (s * 0.192, 0.020, 0.660), FWD, 'hips')
B('hair.B1', (0, 0.104, 1.590), (0, 0.124, 1.505), FWD, 'head')
B('hair.B2', (0, 0.124, 1.505), (0, 0.132, 1.425), FWD, 'hair.B1')
B('beard1', (0, -0.092, 1.462), (0, -0.112, 1.398), FWD, 'jaw')
B('beard2', (0, -0.112, 1.398), (0, -0.120, 1.333), FWD, 'beard1')
B('beard3', (0, -0.120, 1.333), (0, -0.117, 1.268), FWD, 'beard2')
B('skirt.F', (0, -0.115, 1.020), (0, -0.155, 0.660), FWD, 'hips')
B('skirt.B', (0, 0.140, 1.020), (0, 0.172, 0.660), FWD, 'hips')

arm_data = bpy.data.armatures.new('RigData')
rig = bpy.data.objects.new('Rig', arm_data)
COLL.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name, h, t, z, parent, deform in BONES:
    eb = arm_data.edit_bones.new(name)
    eb.head = h
    eb.tail = t
    eb.align_roll(z)
    eb.use_deform = deform
    if parent:
        eb.parent = arm_data.edit_bones[parent]
        eb.use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')
arm_data.display_type = 'STICK'
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'
print('bones:', len(arm_data.bones))

# ------------------------------------------------------------------ meshes + weights
PART_BONE = dict(BD.PART_BONE)


def load_npz(path, keep=None):
    d = np.load(path)
    V, F = d['V'], d['F']
    names = [str(x) for x in d['part_names']]
    pidx, pw = d['part_idx'], d['part_w']
    if keep is not None:
        cz = V[F][:, :, 2].mean(1)
        F = F[keep(cz)]
        used = np.unique(F)
        remap = -np.ones(len(V), np.int64)
        remap[used] = np.arange(len(used))
        V, F, pidx, pw = V[used], remap[F], pidx[used], pw[used]
    bones = [PART_BONE[n] for n in names]
    return V, F, bones, pidx, pw


def weights_to_groups(ob, bones, pidx, pw, extra=None):
    """bones: list of bone names per part column; pidx/pw top-k arrays."""
    W = {}
    for k in range(pidx.shape[1]):
        for j, bn in enumerate(bones):
            sel = np.nonzero((pidx[:, k] == j) & (pw[:, k] > 0))[0]
            if len(sel):
                W.setdefault(bn, [np.zeros(len(pidx), np.float32)])[0][sel] += pw[sel, k]
    W = {k: v[0] for k, v in W.items()}
    if extra:
        extra(W)
    for bn, w in W.items():
        idx = np.nonzero(w > 1e-3)[0]
        C.set_vertex_weights(ob, bn, idx, w[idx])
    return W


def face_regions(V):
    """extra facial bones carve weight out of head/jaw."""
    def ball(c, r):
        d = np.linalg.norm(V - np.asarray(c), axis=1)
        return C.smoothstep(r, r * 0.25, d)

    def apply(W):
        n = len(V)
        head = W.get('head', np.zeros(n, np.float32))
        jaw = W.get('jaw', np.zeros(n, np.float32))
        regions = {}
        for side, s in (('L', 1), ('R', -1)):
            regions['brow.' + side] = (ball((s * 0.031, -0.084, 1.597), 0.026) * (V[:, 2] > 1.578), 0.85, 'h')
            regions['cheek.' + side] = (ball((s * 0.042, -0.074, 1.533), 0.026) * (V[:, 2] < 1.556), 0.7, 'h')
            regions['mouth.' + side] = (ball((s * 0.026, -0.092, 1.497), 0.020), 0.9, 'hj')
        regions['lipU'] = (ball((0, -0.098, 1.503), 0.016) * (V[:, 2] > 1.4972), 0.6, 'h')
        regions['lipD'] = (ball((0, -0.096, 1.489), 0.016) * (V[:, 2] < 1.4972), 0.6, 'j')
        tot_h = np.zeros(n); tot_j = np.zeros(n)
        for bn, (m, amt, src) in regions.items():
            m = m * amt
            if 'h' in src:
                tot_h += m
            if 'j' in src:
                tot_j += m
        sh = np.minimum(1.0, 0.95 / np.maximum(tot_h, 0.95))
        sj = np.minimum(1.0, 0.95 / np.maximum(tot_j, 0.95))
        for bn, (m, amt, src) in regions.items():
            m = m * amt
            w = np.zeros(n)
            if 'h' in src:
                w += head * m * sh
            if 'j' in src:
                w += jaw * m * sj
            W[bn] = w.astype(np.float32)
        W['head'] = (head * (1 - np.minimum(tot_h * sh, 0.95))).astype(np.float32)
        if 'jaw' in W:
            W['jaw'] = (jaw * (1 - np.minimum(tot_j * sj, 0.95))).astype(np.float32)
    return apply


def build_skin_mesh():
    Vh, Fh, bh, ih, wh = load_npz(f'{MESH_DIR}/head.npz', lambda z: z > SEAM_Z + 0.0015)
    Vb, Fb, bb, ib, wb = load_npz(f'{MESH_DIR}/body.npz', lambda z: z < SEAM_Z - 0.0015)
    # drop skin that is always hidden deep under the tunic (no poke-through, lighter mesh)
    import body_def as _BD
    cen = Vb[Fb].mean(1)
    hidden = np.zeros(len(Fb), bool)
    zc = cen[:, 2]
    cand = np.nonzero((zc > 0.98) & (zc < 1.36))[0]
    # inside test against the tunic's outer envelope only (shell interior counts as covered)
    inner = _BD.tunic_inner_depth(cen[cand])
    hidden[cand] = inner > 0.0
    keepf = ~hidden
    Fb = Fb[keepf]
    used = np.unique(Fb)
    remap = -np.ones(len(Vb), np.int64); remap[used] = np.arange(len(used))
    Vb, Fb, ib, wb = Vb[used], remap[Fb], ib[used], wb[used]
    print('hidden skin faces removed:', int(hidden.sum()))
    # body object (decimated separately), head object, then join + bridge
    me_b = C.mesh_from_arrays('body_tmp', Vb, Fb, vec_attrs={'rest': Vb})
    ob_b = C.obj_from_mesh(me_b, 'Body', COLL)
    weights_to_groups(ob_b, bb, ib, wb)
    me_h = C.mesh_from_arrays('head_tmp', Vh, Fh, vec_attrs={'rest': Vh})
    ob_h = C.obj_from_mesh(me_h, 'Head', COLL)
    weights_to_groups(ob_h, bh, ih, wh, extra=face_regions(Vh))
    for ob, ratio in ((ob_b, 0.30 if QUALITY == 'full' else 0.5), (ob_h, 0.55 if QUALITY == 'full' else 0.8)):
        if ratio < 1:
            mod = ob.modifiers.new('dec', 'DECIMATE')
            mod.decimate_type = 'COLLAPSE'
            mod.ratio = ratio
            mod.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.modifier_apply(modifier='dec')
    # join
    bpy.ops.object.select_all(action='DESELECT')
    ob_b.select_set(True); ob_h.select_set(True)
    bpy.context.view_layer.objects.active = ob_b
    bpy.ops.object.join()
    ob = ob_b
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    edges = [e for e in bm.edges if e.is_boundary and abs(e.verts[0].co.z - SEAM_Z) < 0.012]
    print('seam boundary edges', len(edges), 'all boundary', sum(e.is_boundary for e in bm.edges))
    try:
        res = bmesh.ops.bridge_loops(bm, edges=edges)
        print('bridged', len(res['faces']))
        seam_verts = list({v for f in res['faces'] for v in f.verts})
        for _ in range(4):
            bmesh.ops.smooth_vert(bm, verts=seam_verts, factor=0.5, use_axis_x=True, use_axis_y=True,
                                  use_axis_z=False)
    except Exception as ex:  # noqa
        print('bridge failed:', ex)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.update()
    return ob


skin = build_skin_mesh()
skin.name = 'Body'
skin_mat = CM.skin_material()
skin.data.materials.append(skin_mat)

# tunic
Vt, Ft, bt, it, wt = load_npz(f'{MESH_DIR}/tunic.npz')
me_t = C.mesh_from_arrays('Tunic', Vt, Ft, vec_attrs={'rest': Vt})
tunic = C.obj_from_mesh(me_t, 'Tunic', COLL)


def skirt_weights(W):
    n = len(Vt)
    z = Vt[:, 2]
    lower = C.smoothstep(0.98, 0.80, z)                 # skirt part follows skirt bones
    ang = np.arctan2(Vt[:, 0], -(Vt[:, 1] - 0.02))      # 0 front, +-pi back
    parts = {
        'skirt.F': np.maximum(np.cos(ang), 0) ** 2,
        'skirt.B': np.maximum(-np.cos(ang), 0) ** 2,
        'skirt.L': np.maximum(np.sin(ang), 0) ** 2,
        'skirt.R': np.maximum(-np.sin(ang), 0) ** 2,
    }
    tot = sum(parts.values())
    share = 0.55 * lower
    for k in list(W.keys()):
        W[k] = W[k] * (1 - share)
    for k, v in parts.items():
        W[k] = (share * v / tot).astype(np.float32)


weights_to_groups(tunic, bt, it, wt, extra=skirt_weights)
if QUALITY == 'full':
    mod = tunic.modifiers.new('dec', 'DECIMATE'); mod.ratio = 0.35
    bpy.context.view_layer.objects.active = tunic
    bpy.ops.object.modifier_apply(modifier='dec')
tunic.data.shade_smooth()
tunic.data.materials.append(CM.tunic_material())

# rope belt
belt_pts = []
for i in range(97):
    a = i / 96 * 2 * math.pi
    belt_pts.append((0.155 * math.sin(a), 0.012 - 0.122 * math.cos(a), 1.000 + 0.012 * math.sin(2 * a)))
cu = bpy.data.curves.new('belt', 'CURVE')
cu.dimensions = '3D'
sp = cu.splines.new('POLY')
sp.points.add(len(belt_pts) - 1)
for p, q in zip(sp.points, belt_pts):
    p.co = (*q, 1)
sp.use_cyclic_u = True
cu.bevel_depth = 0.0085
cu.bevel_resolution = 3
belt = bpy.data.objects.new('Belt', cu)
COLL.objects.link(belt)
bpy.context.view_layer.objects.active = belt
bpy.ops.object.select_all(action='DESELECT'); belt.select_set(True)
bpy.ops.object.convert(target='MESH')
belt = bpy.context.object
bv = C.verts_np(belt.data)
# twist texture via rest attr
a = belt.data.attributes.new('rest', 'FLOAT_VECTOR', 'POINT')
a.data.foreach_set('vector', bv.ravel())
rope = CM.simple('rope', (0.42, 0.30, 0.17), 0.9)
nb = C.NB(rope)
wv = nb.node('ShaderNodeTexWave', {'Vector': nb.attr('rest'), 'Scale': 30.0, 'Distortion': 2.0})
wv.wave_type = 'BANDS'
bump = nb.node('ShaderNodeBump', {'Strength': 0.8})
nb.link(wv.outputs['Fac'], bump.inputs['Height'])
nb.link(bump.outputs['Normal'], C.principled(rope).inputs['Normal'])
belt.data.materials.append(rope)
C.set_vertex_weights(belt, 'spine', np.arange(len(bv)), np.full(len(bv), 0.5))
C.set_vertex_weights(belt, 'hips', np.arange(len(bv)), np.full(len(bv), 0.5))

# ------------------------------------------------------------------ eyes, lids, mouth, nails
emat = char_eyes.eye_material('eye', iris=(0.36, 0.50, 0.60))
lidmat = skin_mat
EYES = {}
for side, s in (('L', 1), ('R', -1)):
    c = tuple(BD.EYE_C * np.array([s, 1, 1]))
    eb = char_eyes.make_eyeball('Eye.' + side, c, BD.EYE_R, emat)
    lu, ld = char_eyes.make_lids('Eye.' + side, c, BD.EYE_R, lidmat)
    for o in (eb, lu, ld):
        if o.name not in COLL.objects:
            COLL.objects.link(o)
            for cl in o.users_collection:
                if cl != COLL:
                    cl.objects.unlink(o)
    # lid rest attr for skin shader (put them near the eye corners: rosy-free)
    for o in (lu, ld):
        vv = C.verts_np(o.data)
        R = np.array(o.matrix_world)[:3, :3]
        wv_ = vv @ R.T + np.asarray(c)
        at = o.data.attributes.new('rest', 'FLOAT_VECTOR', 'POINT')
        at.data.foreach_set('vector', wv_.ravel().astype(np.float32))
    EYES[side] = (eb, lu, ld)


def parent_to_bone(ob, bone):
    mw = ob.matrix_world.copy()
    ob.parent = rig
    ob.parent_type = 'BONE'
    ob.parent_bone = bone
    bpy.context.view_layer.update()
    ob.matrix_world = mw


bpy.context.view_layer.update()
for side in ('L', 'R'):
    eb, lu, ld = EYES[side]
    parent_to_bone(eb, 'eye.' + side)
    parent_to_bone(lu, 'lidU.' + side)
    parent_to_bone(ld, 'lidD.' + side)

# mouth interior + old teeth + tongue
mouth_mat = CM.simple('mouth', (0.16, 0.035, 0.035), 0.6)
teeth_mat = CM.simple('teeth', (0.86, 0.80, 0.62), 0.35)
tongue_mat = CM.simple('tongue', (0.62, 0.22, 0.22), 0.45)
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0, -0.074, 1.494), segments=24, ring_count=12)
bag = bpy.context.object
bag.name = 'MouthBag'
bag.scale = (0.024, 0.020, 0.016)
bpy.ops.object.transform_apply(scale=True)
bag.data.materials.append(mouth_mat)
bv = C.verts_np(bag.data) + np.array([0, -0.074, 1.494])
wj = C.smoothstep(1.499, 1.487, bv[:, 2])
C.set_vertex_weights(bag, 'jaw', np.arange(len(bv)), wj)
C.set_vertex_weights(bag, 'head', np.arange(len(bv)), 1 - wj)
teeth = []
for (x, up, h) in ((-0.0075, True, 0.0062), (0.0045, True, 0.0058), (0.0135, True, 0.0050),
                   (-0.0040, False, 0.0050), (0.0080, False, 0.0046)):
    z = 1.4995 - h / 2 + 0.0004 if up else 1.4925 + h / 2 - 0.0008
    y = -0.0905 if up else -0.0885
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    tt = bpy.context.object
    tt.scale = (0.0050, 0.0030, h)
    bpy.ops.object.transform_apply(scale=True)
    bev = tt.modifiers.new('b', 'BEVEL'); bev.width = 0.0012; bev.segments = 3
    bpy.ops.object.modifier_apply(modifier='b')
    tt.data.materials.append(teeth_mat)
    bpy.ops.object.shade_smooth()
    C.set_vertex_weights(tt, 'head' if up else 'jaw', np.arange(len(tt.data.vertices)),
                         np.ones(len(tt.data.vertices)))
    teeth.append(tt)
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0, -0.078, 1.4875), segments=16, ring_count=8)
tongue = bpy.context.object
tongue.name = 'Tongue'
tongue.scale = (0.015, 0.016, 0.005)
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.shade_smooth()
tongue.data.materials.append(tongue_mat)
C.set_vertex_weights(tongue, 'jaw', np.arange(len(tongue.data.vertices)), np.ones(len(tongue.data.vertices)))
bpy.ops.object.select_all(action='DESELECT')
for o in [bag, tongue] + teeth:
    o.select_set(True)
bpy.context.view_layer.objects.active = bag
bpy.ops.object.join()
mouth = bpy.context.object
mouth.name = 'Mouth'

# nails
nail_mat = CM.simple('nail', (0.88, 0.74, 0.66), 0.3)
nv_all = []; nf_all = []; nbone = []
for side, s in (('L', 1), ('R', -1)):
    d, t, n = BD.arm_frame(s)
    for f, pts in BD.finger_chains(side).items():
        a, b = pts[2], pts[3]
        ax = (b - a) / np.linalg.norm(b - a)
        back = -np.asarray(n)
        back = back - ax * np.dot(back, ax); back /= np.linalg.norm(back)
        side_v = np.cross(ax, back)
        r = {'thumb': 0.0078, 'index': 0.0060, 'middle': 0.0061, 'ring': 0.0058, 'pinky': 0.0052}[f]
        c0 = b - ax * (r * 1.4) + back * (r * 0.78)
        # small curved quad patch
        base = len(nv_all)
        for i in range(4):
            for j in range(3):
                u_ = (i / 3 - 0.5) * 2.0 * r * 1.3
                v_ = (j / 2 - 0.5) * 2.0 * r * 0.85
                curv = -0.5 * (v_ / (r * 0.85)) ** 2 * r * 0.35
                nv_all.append(c0 + ax * u_ + side_v * v_ + back * curv)
                nbone.append(f'{f}3.{side}')
        for i in range(3):
            for j in range(2):
                q = base + i * 3 + j
                nf_all.append((q, q + 1, q + 4, q + 3))
nails = C.obj_from_mesh(C.mesh_from_arrays('Nails', np.array(nv_all), nf_all), 'Nails', COLL)
sol = nails.modifiers.new('s', 'SOLIDIFY'); sol.thickness = 0.0009
bpy.context.view_layer.objects.active = nails
bpy.ops.object.modifier_apply(modifier='s')
nails.data.materials.append(nail_mat)
nb_arr = np.array(nbone)
nvn = len(nails.data.vertices)
nb_full = np.concatenate([nb_arr, nb_arr])[:nvn]
for bn in set(nbone):
    idx = np.nonzero(nb_full == bn)[0]
    C.set_vertex_weights(nails, bn, idx, np.ones(len(idx)))

# ------------------------------------------------------------------ hair
print('growing hair...')
f_col = CH.collider()
skin_sdf, PARTS = BD.build_skin()
f_face = skin_sdf
from sdf import Union as _U  # noqa: E402
f_head = _U([PARTS['head']], k=0.0)
hair_mat = CM.hair_material('hair')
brow_mat = CM.hair_material('brows', color=(0.90, 0.89, 0.86), root=(0.55, 0.50, 0.45))
HAIR = {}
HAIR['side'] = CH.side_hair(f_col, f_head)
HAIR['beard'] = CH.beard(f_col, f_face)
HAIR['must'] = CH.mustache(f_col, f_face)
bl, br = CH.eyebrows(f_col, f_face)
HAIR['brows'] = np.concatenate([bl, br], 0)
HAIR['ear'] = CH.ear_tufts(f_col, f_head)
for k, v in HAIR.items():
    print(k, v.shape)


def strand_weights(kind, S, Vr, u, sid):
    """returns dict bone -> per-vertex weight for ribbon verts."""
    n = len(Vr)
    roots = S[sid, 0]
    W = {}
    if kind in ('side', 'ear'):
        phi = np.arctan2(roots[:, 0], roots[:, 1] - 0.012)
        wl = C.smoothstep(0.2, 1.0, phi); wr = C.smoothstep(-0.2, -1.0, phi)
        wb = np.clip(1 - wl - wr, 0, 1)
        cw = C.smoothstep(0.10, 0.45, u) if kind == 'side' else np.zeros(n)
        c2 = C.smoothstep(0.50, 0.85, u) if kind == 'side' else np.zeros(n)
        W['head'] = 1 - cw
        for nm, w in (('L', wl), ('R', wr), ('B', wb)):
            W[f'hair.{nm}1'] = w * cw * (1 - c2)
            W[f'hair.{nm}2'] = w * cw * c2
    elif kind == 'beard':
        rz = roots[:, 2]
        on_jaw = C.smoothstep(1.522, 1.500, rz)
        cw = C.smoothstep(0.08, 0.35, u)
        W['head'] = (1 - on_jaw) * (1 - cw)
        W['jaw'] = on_jaw * (1 - cw)
        b1 = cw * (1 - C.smoothstep(0.35, 0.65, u))
        b2 = cw * C.smoothstep(0.35, 0.65, u) * (1 - C.smoothstep(0.65, 0.92, u))
        b3 = cw * C.smoothstep(0.65, 0.92, u)
        W['beard1'] = b1; W['beard2'] = b2; W['beard3'] = b3
    elif kind == 'must':
        rx = roots[:, 0]
        ends = C.smoothstep(0.004, 0.026, np.abs(rx)) * C.smoothstep(0.1, 0.7, u)
        W['lipU'] = 0.5 * (1 - ends)
        W['head'] = 0.5 * (1 - ends)
        W['mouth.L'] = ends * (rx > 0)
        W['mouth.R'] = ends * (rx <= 0)
    elif kind == 'brows':
        rx = roots[:, 0]
        W['brow.L'] = (rx > 0) * 0.9
        W['brow.R'] = (rx <= 0) * 0.9
        W['head'] = np.full(n, 0.1)
    return W


def make_hair(kind, S, width, mat, seed):
    if kind == 'brows':
        kw = dict(up=(0, -1, 0.3))
    elif kind == 'must':
        kw = dict(axis=(0, -0.04))
    elif kind == 'ear':
        kw = dict(center=(0, 0.01, 1.555))
    else:
        kw = dict(axis=(0, 0.02))
    V, F, u, r, sid, vv = CH.ribbons(S, width, twist=0.5, seed=seed, **kw)
    me = C.mesh_from_arrays('Hair_' + kind, V, F, attrs={'u': u, 'rand': r, 'v': vv}, vec_attrs={'rest': V})
    ob = C.obj_from_mesh(me, 'Hair_' + kind, COLL)
    me.materials.append(mat)
    W = strand_weights(kind, S, V, u, sid)
    for bn, w in W.items():
        idx = np.nonzero(w > 1e-3)[0]
        if len(idx):
            C.set_vertex_weights(ob, bn, idx, w[idx])
    return ob


hair_objs = [
    make_hair('side', HAIR['side'], 0.0011, hair_mat, 1),
    make_hair('beard', HAIR['beard'], 0.0015, hair_mat, 2),
    make_hair('must', HAIR['must'], 0.0017, hair_mat, 3),
    make_hair('brows', HAIR['brows'], 0.0010, brow_mat, 4),
    make_hair('ear', HAIR['ear'], 0.0006, brow_mat, 5),
]

# ------------------------------------------------------------------ armature modifiers
deformed = [skin, tunic, belt, mouth, nails] + hair_objs
for ob in deformed:
    ob.parent = rig
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig
    mod.use_deform_preserve_volume = ob in (skin,)
for ob in COLL.objects:
    if ob.type == 'MESH':
        ob.data.update()

# shadow/blend settings
for m in bpy.data.materials:
    m.shadow_method = 'HASHED' if m.name.startswith(('hair', 'brows')) else 'OPAQUE'

bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
print('saved', OUT)
