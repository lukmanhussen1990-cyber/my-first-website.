"""Build the rigged caveman from assets/parts.npz -> assets/caveman.blend

Run with the bpy venv python:  python build_character.py
"""
import sys, math, json
import numpy as np
sys.path.insert(0, '/home/user/work/scripts')
import bpy, bmesh
from mathutils import Vector, Matrix
from scipy.spatial import cKDTree
import char_geo as G
from sdf import Prim

ASSETS = '/home/user/work/assets'
L = G.landmarks()
D = np.load(f'{ASSETS}/parts.npz')

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
col = bpy.data.collections.new('caveman')
sc.collection.children.link(col)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ mesh helpers
def make_mesh(name, V, F, smooth=True, fix_normals=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(np.asarray(V).tolist(), [], np.asarray(F).tolist())
    if fix_normals:
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me); bm.free()
    if smooth:
        me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob


def decimate(ob, ratio):
    mod = ob.modifiers.new('dec', 'DECIMATE')
    mod.ratio = ratio
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.remove(mod)
    ob.data = me
    bpy.data.meshes.remove(old)
    me.shade_smooth()


def verts_np(ob):
    v = np.zeros(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get('co', v)
    return v.reshape(-1, 3)


def adjacency(ob):
    e = np.zeros(len(ob.data.edges) * 2, dtype=np.int64)
    ob.data.edges.foreach_get('vertices', e)
    return e.reshape(-1, 2)


def smooth_weights(W, edges, iters=3, amt=0.5):
    n = W.shape[0]
    for _ in range(iters):
        acc = np.zeros_like(W); cnt = np.zeros(n)
        np.add.at(acc, edges[:, 0], W[edges[:, 1]]); np.add.at(acc, edges[:, 1], W[edges[:, 0]])
        np.add.at(cnt, edges[:, 0], 1); np.add.at(cnt, edges[:, 1], 1)
        avg = acc / np.maximum(cnt, 1)[:, None]
        W = W * (1 - amt) + avg * amt
    return W


def assign_weights(ob, bone_names, W, keep=4, thresh=0.01):
    W = np.asarray(W, float)
    if W.ndim == 1:
        W = W[:, None]
    # keep top-k per vertex, normalize
    if W.shape[1] > keep:
        idx = np.argsort(-W, axis=1)[:, keep:]
        np.put_along_axis(W, idx, 0.0, axis=1)
    W[W < thresh] = 0
    s = W.sum(1, keepdims=True); s[s == 0] = 1
    W = W / s
    for j, bn in enumerate(bone_names):
        nz = np.nonzero(W[:, j] > 0)[0]
        if len(nz) == 0:
            continue
        vg = ob.vertex_groups.get(bn) or ob.vertex_groups.new(name=bn)
        # group by weight value for speed
        vals = W[nz, j]
        for i, w in zip(nz.tolist(), vals.tolist()):
            vg.add([i], w, 'REPLACE')


def set_rest_attr(ob):
    V = verts_np(ob)
    a = ob.data.attributes.new('rest', 'FLOAT_VECTOR', 'POINT')
    a.data.foreach_set('vector', V.ravel())


# ------------------------------------------------------------------ materials
def principled(name, color, rough=0.5, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m


def node(m, typ, loc=(0, 0), **props):
    n = m.node_tree.nodes.new(typ)
    n.location = loc
    for k, v in props.items():
        setattr(n, k, v)
    return n


def link(m, a, b):
    m.node_tree.links.new(a, b)


def sock(n, name, typ='RGBA', out=False):
    for so in (n.outputs if out else n.inputs):
        if so.name == name and so.type == typ and so.enabled:
            return so
    for so in (n.outputs if out else n.inputs):
        if so.name == name and so.type == typ:
            return so
    raise KeyError(name)


def skin_material():
    m = principled('skin', (0.72, 0.45, 0.32), 0.52)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Subsurface Weight'].default_value = 0.18
    b.inputs['Subsurface Radius'].default_value = (1.0, 0.4, 0.25)
    b.inputs['Subsurface Scale'].default_value = 0.012
    b.inputs['Specular IOR Level'].default_value = 0.35
    attr = node(m, 'ShaderNodeAttribute', (-900, 200), attribute_name='rest')
    noise = node(m, 'ShaderNodeTexNoise', (-700, 200))
    noise.inputs['Scale'].default_value = 18
    noise.inputs['Detail'].default_value = 3
    link(m, attr.outputs['Vector'], noise.inputs['Vector'])
    blush = node(m, 'ShaderNodeAttribute', (-900, -100), attribute_name='blush')
    ramp = node(m, 'ShaderNodeMix', (-450, 200), data_type='RGBA')
    sock(ramp, 'A').default_value = (0.66, 0.40, 0.28, 1)
    sock(ramp, 'B').default_value = (0.74, 0.47, 0.33, 1)
    link(m, noise.outputs['Fac'], sock(ramp, 'Factor', 'VALUE'))
    mix2 = node(m, 'ShaderNodeMix', (-250, 100), data_type='RGBA')
    sock(mix2, 'B').default_value = (0.74, 0.33, 0.26, 1)
    link(m, blush.outputs['Fac'], sock(mix2, 'Factor', 'VALUE'))
    link(m, sock(ramp, 'Result', out=True), sock(mix2, 'A'))
    link(m, sock(mix2, 'Result', out=True), b.inputs['Base Color'])
    # subtle pores bump
    bump = node(m, 'ShaderNodeBump', (-250, -250))
    bump.inputs['Strength'].default_value = 0.015
    n2 = node(m, 'ShaderNodeTexNoise', (-450, -250)); n2.inputs['Scale'].default_value = 400
    link(m, attr.outputs['Vector'], n2.inputs['Vector'])
    link(m, n2.outputs['Fac'], bump.inputs['Height'])
    link(m, bump.outputs['Normal'], b.inputs['Normal'])
    return m


def hair_material(name='hair', base=(0.075, 0.045, 0.026), tip=(0.16, 0.10, 0.06)):
    m = principled(name, base, 0.45)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Specular IOR Level'].default_value = 0.35
    hi = node(m, 'ShaderNodeHairInfo', (-700, 200))
    mix = node(m, 'ShaderNodeMix', (-400, 200), data_type='RGBA')
    sock(mix, 'A').default_value = (*base, 1)
    sock(mix, 'B').default_value = (*tip, 1)
    link(m, hi.outputs['Intercept'], sock(mix, 'Factor', 'VALUE'))
    # per-strand random brightness
    mr = node(m, 'ShaderNodeMix', (-200, 200), data_type='RGBA', blend_type='MULTIPLY')
    rr = node(m, 'ShaderNodeMapRange', (-400, 0))
    rr.inputs['To Min'].default_value = 0.75; rr.inputs['To Max'].default_value = 1.25
    link(m, hi.outputs['Random'], rr.inputs['Value'])
    cr = node(m, 'ShaderNodeCombineColor', (-300, -100))
    for c in ('Red', 'Green', 'Blue'):
        link(m, rr.outputs['Result'], cr.inputs[c])
    sock(mr, 'Factor', 'VALUE').default_value = 1.0
    link(m, sock(mix, 'Result', out=True), sock(mr, 'A'))
    link(m, cr.outputs['Color'], sock(mr, 'B'))
    link(m, sock(mr, 'Result', out=True), b.inputs['Base Color'])
    return m


def leopard_material():
    m = principled('leopard', (0.66, 0.40, 0.19), 0.85)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Specular IOR Level'].default_value = 0.2
    b.inputs['Sheen Weight'].default_value = 0.3
    attr = node(m, 'ShaderNodeAttribute', (-1200, 0), attribute_name='rest')
    # warp coordinates for irregular blotches
    nz = node(m, 'ShaderNodeTexNoise', (-1000, -200)); nz.inputs['Scale'].default_value = 6; nz.inputs['Detail'].default_value = 2
    link(m, attr.outputs['Vector'], nz.inputs['Vector'])
    warp = node(m, 'ShaderNodeVectorMath', (-800, 0), operation='MULTIPLY_ADD')
    warp.inputs[1].default_value = (0.09, 0.09, 0.09)
    link(m, nz.outputs['Color'], warp.inputs[0]); link(m, attr.outputs['Vector'], warp.inputs[2])
    vor = node(m, 'ShaderNodeTexVoronoi', (-600, 0), feature='F1')
    vor.inputs['Scale'].default_value = 6.0
    vor.inputs['Randomness'].default_value = 0.9
    link(m, warp.outputs['Vector'], vor.inputs['Vector'])
    # spot size varies per cell
    sz = node(m, 'ShaderNodeMath', (-400, -200), operation='MULTIPLY_ADD')
    sz.inputs[1].default_value = 0.14; sz.inputs[2].default_value = 0.27
    sep = node(m, 'ShaderNodeSeparateColor', (-500, -200))
    link(m, vor.outputs['Color'], sep.inputs['Color'])
    link(m, sep.outputs['Red'], sz.inputs[0])
    lt = node(m, 'ShaderNodeMath', (-250, 0), operation='SUBTRACT')
    link(m, sz.outputs['Value'], lt.inputs[0]); link(m, vor.outputs['Distance'], lt.inputs[1])
    sm = node(m, 'ShaderNodeMapRange', (-100, 0))
    sm.inputs['From Min'].default_value = 0.0; sm.inputs['From Max'].default_value = 0.035
    link(m, lt.outputs['Value'], sm.inputs['Value'])
    # base fur colour with mottling
    n3 = node(m, 'ShaderNodeTexNoise', (-600, 300)); n3.inputs['Scale'].default_value = 25; n3.inputs['Detail'].default_value = 6
    link(m, attr.outputs['Vector'], n3.inputs['Vector'])
    base = node(m, 'ShaderNodeMix', (-250, 300), data_type='RGBA')
    sock(base, 'A').default_value = (0.50, 0.26, 0.09, 1)
    sock(base, 'B').default_value = (0.62, 0.35, 0.13, 1)
    link(m, n3.outputs['Fac'], sock(base, 'Factor', 'VALUE'))
    spot = node(m, 'ShaderNodeMix', (100, 200), data_type='RGBA')
    sock(spot, 'B').default_value = (0.13, 0.055, 0.025, 1)
    link(m, sm.outputs['Result'], sock(spot, 'Factor', 'VALUE'))
    link(m, sock(base, 'Result', out=True), sock(spot, 'A'))
    link(m, sock(spot, 'Result', out=True), b.inputs['Base Color'])
    bump = node(m, 'ShaderNodeBump', (100, -300)); bump.inputs['Strength'].default_value = 0.25
    n4 = node(m, 'ShaderNodeTexNoise', (-100, -300)); n4.inputs['Scale'].default_value = 160; n4.inputs['Detail'].default_value = 4
    link(m, attr.outputs['Vector'], n4.inputs['Vector'])
    link(m, n4.outputs['Fac'], bump.inputs['Height'])
    link(m, bump.outputs['Normal'], b.inputs['Normal'])
    return m


def eye_material():
    m = principled('eye', (0.9, 0.88, 0.84), 0.06)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Coat Weight'].default_value = 0.6
    b.inputs['Coat Roughness'].default_value = 0.03
    tc = node(m, 'ShaderNodeAttribute', (-900, 0), attribute_name='eyelocal')
    nrmv = node(m, 'ShaderNodeVectorMath', (-700, 0), operation='NORMALIZE')
    link(m, tc.outputs['Vector'], nrmv.inputs[0])
    dot = node(m, 'ShaderNodeVectorMath', (-500, 0), operation='DOT_PRODUCT')
    dot.inputs[1].default_value = (0, -1, 0)
    link(m, nrmv.outputs['Vector'], dot.inputs[0])
    cr = node(m, 'ShaderNodeValToRGB', (-300, 0))
    el = cr.color_ramp.elements
    el[0].position = 0.0; el[0].color = (0.93, 0.91, 0.87, 1)
    el[1].position = 1.0; el[1].color = (0.0, 0.0, 0.0, 1)
    for pos, c in [(0.80, (0.88, 0.85, 0.80, 1)), (0.875, (0.88, 0.84, 0.80, 1)), (0.888, (0.10, 0.06, 0.03, 1)),
                   (0.90, (0.30, 0.17, 0.07, 1)), (0.955, (0.46, 0.30, 0.13, 1)), (0.968, (0.02, 0.015, 0.01, 1))]:
        e = el.new(pos); e.color = c
    link(m, dot.outputs['Value'], cr.inputs['Fac'])
    link(m, cr.outputs['Color'], b.inputs['Base Color'])
    return m


def hair_base_material(name, dark, light):
    m = principled(name, dark, 0.9)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Specular IOR Level'].default_value = 0.04
    attr = node(m, 'ShaderNodeAttribute', (-900, 0), attribute_name='rest')
    wv = node(m, 'ShaderNodeTexWave', (-650, 0), wave_type='BANDS', bands_direction='Z')
    wv.inputs['Scale'].default_value = 60; wv.inputs['Distortion'].default_value = 9
    wv.inputs['Detail'].default_value = 4; wv.inputs['Detail Scale'].default_value = 2
    link(m, attr.outputs['Vector'], wv.inputs['Vector'])
    mx = node(m, 'ShaderNodeMix', (-350, 0), data_type='RGBA')
    sock(mx, 'A').default_value = (*dark, 1); sock(mx, 'B').default_value = (*light, 1)
    link(m, wv.outputs['Fac'], sock(mx, 'Factor', 'VALUE'))
    link(m, sock(mx, 'Result', out=True), b.inputs['Base Color'])
    bump = node(m, 'ShaderNodeBump', (-350, -300)); bump.inputs['Strength'].default_value = 0.3
    link(m, wv.outputs['Fac'], bump.inputs['Height'])
    link(m, bump.outputs['Normal'], b.inputs['Normal'])
    return m


MAT = {
    'beardbase': hair_base_material('beard_base', (0.06, 0.036, 0.021), (0.12, 0.075, 0.045)),
    'hairbase': hair_base_material('hair_base', (0.04, 0.024, 0.014), (0.12, 0.075, 0.045)),
    'skin': skin_material(),
    'hair': hair_material(),
    'beard': hair_material('beard', (0.08, 0.048, 0.028), (0.17, 0.105, 0.06)),
    'brow': hair_material('brow', (0.05, 0.03, 0.018), (0.1, 0.06, 0.035)),
    'leopard': leopard_material(),
    'eye': eye_material(),
    'lid': None,
    'lash': principled('lash', (0.04, 0.025, 0.015), 0.6),
    'lips': principled('lips', (0.66, 0.36, 0.31), 0.4),
    'mouthin': principled('mouth_in', (0.22, 0.045, 0.045), 0.6),
    'teeth': principled('teeth', (0.90, 0.86, 0.74), 0.25),
    'tongue': principled('tongue', (0.72, 0.30, 0.30), 0.35),
}
MAT['lid'] = MAT['skin']

# ------------------------------------------------------------------ armature
arm_data = bpy.data.armatures.new('caveman_rig')
rig = bpy.data.objects.new('caveman_rig', arm_data)
col.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones
BONES = []  # (name, head, tail, parent, deform)


def B(name, h, t, parent=None, deform=True):
    BONES.append((name, np.asarray(h, float), np.asarray(t, float), parent, deform))


Vv = G.V
a_, n_, w_ = L['hand_a'], L['hand_n'], L['hand_w']
B('root', (0, 0, 0), (0, 0, 0.2), None, False)
B('hips', (0, 0.01, 0.955), (0, 0.01, 1.07), 'root')
B('spine', (0, 0.01, 1.07), (0, 0.0, 1.245), 'hips')
B('chest', (0, 0.0, 1.245), (0, 0.012, 1.47), 'spine')
B('neck', (0, 0.015, 1.47), (0, 0.0, 1.645), 'chest')
B('head', (0, 0.0, 1.645), (0, 0.0, 1.86), 'neck')
B('jaw', (0, 0.005, 1.69), (0, -0.075, 1.628), 'head')
B('beard_tip', (0, -0.085, 1.60), (0, -0.10, 1.44), 'jaw')
B('hair_back', (0, 0.075, 1.74), (0, 0.1, 1.52), 'head')
B('skirt_F', (0, -0.10, 1.03), (0, -0.165, 0.70), 'hips')
B('skirt_B', (0, 0.10, 1.03), (0, 0.15, 0.70), 'hips')
for s, sx in (('.L', 1), ('.R', -1)):
    M = lambda p: np.asarray(p, float) * np.array([sx, 1, 1])
    e = L['eye']
    B('cheek' + s, M((0.045, -0.07, 1.703)), M((0.065, -0.07, 1.703)), 'head')
    B('brow' + s, M((0.035, -0.09, 1.775)), M((0.035, -0.09, 1.795)), 'head')
    B('eye' + s, M(e), M(e + Vv(0, -0.025, 0)), 'head')
    B('lidU' + s, M(e), M(e + Vv(0, -0.025, 0)), 'head')
    B('lidL' + s, M(e), M(e + Vv(0, -0.025, 0)), 'head')
    B('clavicle' + s, M((0.025, 0.01, 1.48)), M((0.19, 0.004, 1.462)), 'chest')
    B('upperarm' + s, M(L['shoulder']), M(L['elbow']), 'clavicle' + s)
    B('forearm' + s, M(L['elbow']), M(L['wrist']), 'upperarm' + s)
    B('hand' + s, M(L['wrist']), M(L['knuckle']), 'forearm' + s)
    d1 = G.nrm(np.cos(np.radians(8)) * a_ + np.sin(np.radians(8)) * n_)
    d2 = G.nrm(np.cos(np.radians(36)) * a_ + np.sin(np.radians(36)) * n_)
    k0 = L['knuckle'] + 0.002 * n_
    B('fingers1' + s, M(k0), M(k0 + 0.05 * d1), 'hand' + s)
    B('fingers2' + s, M(k0 + 0.05 * d1), M(k0 + 0.05 * d1 + 0.04 * d2), 'fingers1' + s)
    ib, im_, it = G.finger_chain(L, *G.FINGERS[0])
    B('index1' + s, M(ib), M(im_), 'hand' + s)
    B('index2' + s, M(im_), M(it), 'index1' + s)
    tb, tm, tt = G.thumb_chain(L)
    B('thumb1' + s, M(tb), M(tm), 'hand' + s)
    B('thumb2' + s, M(tm), M(tt), 'thumb1' + s)
    B('thigh' + s, M(L['hip']), M(L['knee']), 'hips')
    B('shin' + s, M(L['knee']), M(L['ankle']), 'thigh' + s)
    B('foot' + s, M(L['ankle']), M(L['ball']), 'shin' + s)
    B('toes' + s, M(L['ball']), M(L['toe']), 'foot' + s)
    B('foot_ik' + s, M(L['ankle']), M(L['ball']), 'root', False)
    B('knee_pole' + s, M(L['knee'] * Vv(1, 0, 1) + Vv(0, -0.6, 0)), M(L['knee'] * Vv(1, 0, 1) + Vv(0, -0.65, 0)), 'root', False)
    B('hand_ik' + s, M(L['wrist']), M(L['knuckle']), 'root', False)
    B('elbow_pole' + s, M(L['elbow'] + Vv(0.05, 0.5, 0)), M(L['elbow'] + Vv(0.05, 0.55, 0)), 'root', False)

for name, h, t, parent, deform in BONES:
    b = eb.new(name)
    b.head, b.tail = Vector(h), Vector(t)
    b.use_deform = deform
    # consistent rolls: bend axis = local X
    if name.startswith(('upperarm', 'forearm', 'hand', 'fingers', 'thumb', 'index')):
        b.align_roll(Vector((0, 0, 1)) if not name.startswith('thumb') else Vector((0, 0, 1)))
    elif name.startswith(('thigh', 'shin')):
        b.align_roll(Vector((0, -1, 0)))
    elif name.startswith(('foot', 'toes')):
        b.align_roll(Vector((0, 0, 1)))
for name, h, t, parent, deform in BONES:
    if parent:
        eb[name].parent = eb[parent]
        if name in ('spine', 'chest', 'neck', 'head') or name.startswith(('upperarm', 'forearm', 'hand.', 'shin', 'foot.', 'toes', 'fingers2', 'thumb2')):
            eb[name].use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')

# IK setup
for s in ('.L', '.R'):
    pb = rig.pose.bones['shin' + s]
    c = pb.constraints.new('IK'); c.name = 'IK'
    c.target = rig; c.subtarget = 'foot_ik' + s
    c.pole_target = rig; c.pole_subtarget = 'knee_pole' + s
    c.pole_angle = math.radians(-90); c.chain_count = 2
    c2 = rig.pose.bones['foot' + s].constraints.new('COPY_ROTATION'); c2.name = 'IKrot'
    c2.target = rig; c2.subtarget = 'foot_ik' + s
    pb = rig.pose.bones['forearm' + s]
    c = pb.constraints.new('IK'); c.name = 'IK'
    c.target = rig; c.subtarget = 'hand_ik' + s
    c.pole_target = rig; c.pole_subtarget = 'elbow_pole' + s
    c.pole_angle = math.radians(-90); c.chain_count = 2
    c.influence = 0.0
    c2 = rig.pose.bones['hand' + s].constraints.new('COPY_ROTATION'); c2.name = 'IKrot'
    c2.target = rig; c2.subtarget = 'hand_ik' + s
    c2.influence = 0.0
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'


def _pole_search(chain, names):
    c = rig.pose.bones[chain].constraints['IK']
    old = c.influence
    c.influence = 1.0
    best = None
    for a in np.arange(-180, 180, 0.5):
        c.pole_angle = math.radians(a)
        bpy.context.view_layer.update()
        e = 0
        for n in names:
            pb = rig.pose.bones[n]
            e += abs(pb.bone.matrix_local.to_quaternion().rotation_difference(pb.matrix.to_quaternion()).angle)
        if best is None or e < best[1]:
            best = (a, e)
    c.pole_angle = math.radians(best[0])
    c.influence = old
    print('pole', chain, best)


for s_ in ('.L', '.R'):
    _pole_search('shin' + s_, ['thigh' + s_, 'shin' + s_])
    _pole_search('forearm' + s_, ['upperarm' + s_, 'forearm' + s_])


def bind(ob):
    ob.parent = rig
    m = ob.modifiers.new('rig', 'ARMATURE')
    m.object = rig
    return m


# ------------------------------------------------------------------ body
body = make_mesh('body', D['body_V'], D['body_F'])
decimate(body, 0.4)
Vb = verts_np(body)
prims, _ = G.body_prims()
bone_names = [b[0] for b in BONES if b[4]]
bidx = {n: i for i, n in enumerate(bone_names)}
W = np.zeros((len(Vb), len(bone_names)))
for pr in prims:
    if pr.op != 'union' or pr.bone is None:
        continue
    d = pr.dist(Vb)
    sig = float(np.clip(pr.k * 0.55, 0.0035, 0.03))
    w = np.exp(-(np.maximum(d, 0) / sig) ** 2)
    bones = pr.bone if isinstance(pr.bone, dict) else {pr.bone: 1.0}
    for bn, f in bones.items():
        W[:, bidx[bn]] = np.maximum(W[:, bidx[bn]], w * f)
W = smooth_weights(W, adjacency(body), iters=4, amt=0.5)
assign_weights(body, bone_names, W)
bind(body)
set_rest_attr(body)
# blush on nose / cheeks
blush = np.clip(np.exp(-np.sum(((Vb - G.V(0, -0.118, 1.692)) / 0.022) ** 2, 1)) * 0.6
                + np.exp(-np.sum(((np.abs(Vb) * G.V(1, 1, 1) - G.V(0.05, 0.085, 1.70)) / G.V(0.02, 0.03, 0.02)) ** 2, 1)) * 0.35
                + np.exp(-np.sum(((Vb - G.V(0, -0.08, 1.74)) / G.V(0.09, 0.06, 0.012)) ** 2, 1)) * 0.0, 0, 1)
ba = body.data.attributes.new('blush', 'FLOAT', 'POINT'); ba.data.foreach_set('value', blush)
body.data.materials.append(MAT['skin'])
print('body done', len(Vb))

# ------------------------------------------------------------------ eyes + lids
def uv_sphere(name, center, r, seg=40, rings=20):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); col.objects.link(ob)
    me.shade_smooth()
    V = verts_np(ob) + np.asarray(center)
    ob.data.vertices.foreach_set('co', V.ravel())
    return ob


def lid_cap(name, center, r, upper=True, e0=20.0, droop=16.0, nphi=64, nt=10, lash=True):
    """Spherical cap shell around the eye; upper lid covers the pole +Z down to elevation e(phi)."""
    verts, faces = [], []
    phis = np.linspace(0, 2 * np.pi, nphi, endpoint=False)
    for i, ph in enumerate(phis):
        # azimuth measured from the forward (-Y) direction
        fwd = np.cos(ph)  # 1 at front
        side = np.sin(ph)
        e = e0 - droop * side ** 2 if upper else -e0 + droop * side ** 2
        e = np.radians(e)
        polar_edge = np.pi / 2 - e
        for j in range(nt + 1):
            t = j / nt
            pol = t * polar_edge if upper else np.pi - t * (np.pi - polar_edge)
            d = np.array([np.sin(pol) * side, -np.sin(pol) * fwd, np.cos(pol)])
            verts.append(np.asarray(center) + r * d)
    for i in range(nphi):
        i2 = (i + 1) % nphi
        for j in range(nt):
            a, b2, c, d_ = i * (nt + 1) + j, i2 * (nt + 1) + j, i2 * (nt + 1) + j + 1, i * (nt + 1) + j + 1
            faces.append((a, b2, c, d_) if upper else (a, d_, c, b2))
    ob = make_mesh(name, verts, faces, fix_normals=False)
    sol = ob.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 0.0011; sol.offset = 1.0
    ob.data.materials.append(MAT['lid'])
    if lash:
        # lash line: tube along the edge (front half only)
        ring = []
        for i, ph in enumerate(phis):
            if np.cos(ph) < -0.05:
                continue
            ring.append(verts[i * (nt + 1) + nt])
        tube = []
        tf = []
        rr = 0.00075
        npts = len(ring)
        # order by azimuth side coordinate
        ring = sorted(ring, key=lambda p: p[0])
        k = 6
        for i, p in enumerate(ring):
            p = np.asarray(p)
            dirv = (p - np.asarray(center)); dirv /= np.linalg.norm(dirv)
            tang = np.asarray(ring[min(i + 1, npts - 1)]) - np.asarray(ring[max(i - 1, 0)]); tang /= np.linalg.norm(tang)
            bi = np.cross(tang, dirv)
            for q in range(k):
                an = 2 * np.pi * q / k
                tube.append(p + dirv * 0.0011 + rr * (np.cos(an) * dirv + np.sin(an) * bi))
        for i in range(npts - 1):
            for q in range(k):
                q2 = (q + 1) % k
                tf.append((i * k + q, i * k + q2, (i + 1) * k + q2, (i + 1) * k + q))
        lo = make_mesh(name + '_lash', tube, tf)
        lo.data.materials.append(MAT['lash'])
        return ob, lo
    return ob, None


eye_objs = []
for s, sx in (('.L', 1), ('.R', -1)):
    c = L['eye'] * G.V(sx, 1, 1)
    eo = uv_sphere('eye' + s, c, L['eye_r'])
    loc = verts_np(eo) - c
    at = eo.data.attributes.new('eyelocal', 'FLOAT_VECTOR', 'POINT'); at.data.foreach_set('vector', loc.ravel())
    eo.data.materials.append(MAT['eye'])
    assign_weights(eo, ['eye' + s], np.ones(len(loc)))
    bind(eo)
    for part, up in (('lidU', True), ('lidL', False)):
        lo, lash = lid_cap(part + s, c, L['eye_r'] + 0.0009, upper=up, e0=(22 if up else 30), droop=(16 if up else 10), lash=up)
        for o in (lo, lash):
            if o is None:
                continue
            assign_weights(o, [part + s], np.ones(len(o.data.vertices)))
            bind(o)

# ------------------------------------------------------------------ mouth (lips ring with shape keys)
MC = L['mouth']


def lip_curve(W=0.027, Hu=0.0035, Hl=0.0035, corner=0.0, fwd=0.0, round_=0.0, open_=0.0, thick=1.0, n=72):
    th = np.linspace(0, 2 * np.pi, n, endpoint=False)
    c, s = np.cos(th), np.sin(th)
    x = W * c
    up = s > 0
    H = np.where(up, Hu, Hl)
    # superellipse-ish flattening controlled by round_
    z = H * s
    z = z + corner * np.abs(c) ** 4
    z = z - open_ * np.clip(-s, 0, 1) ** 1.2
    y = 0.016 * c ** 2 + fwd * (1 - c ** 2)
    rad = (np.where(up, 0.0068, 0.0082) * (1 - 0.45 * np.abs(c) ** 6)) * thick
    return np.stack([x, y, z], 1), rad, th


def lip_mesh(curve, rad, th, k=14):
    P, R = curve, rad
    n = len(P)
    verts = []
    for i in range(n):
        p = P[i]
        t = P[(i + 1) % n] - P[i - 1]; t /= np.linalg.norm(t)
        out = np.array([p[0], 0, p[2]]); nn = np.linalg.norm(out)
        out = out / nn if nn > 1e-6 else np.array([0, 0, 1.0])
        out = out - (out @ t) * t; out /= np.linalg.norm(out)
        fw = np.cross(t, out)
        if fw[1] > 0:
            fw = -fw
        for q in range(k):
            an = 2 * np.pi * q / k
            off = R[i] * (np.cos(an) * out * 0.8 + np.sin(an) * fw * 1.15)
            verts.append(MC + p + off)
    faces = []
    for i in range(n):
        i2 = (i + 1) % n
        for q in range(k):
            q2 = (q + 1) % k
            faces.append((i * k + q, i2 * k + q, i2 * k + q2, i * k + q2))
    return np.array(verts), faces


base_c, base_r, th = lip_curve()
Vl, Fl = lip_mesh(base_c, base_r, th)
lips = make_mesh('lips', Vl, Fl)
lips.data.materials.append(MAT['lips'])
k = 14
sv = np.repeat(np.sin(th), k)
wj = smoothstep(0.25, -0.35, sv)
assign_weights(lips, ['head', 'jaw'], np.stack([1 - wj, wj], 1), thresh=0.0)
lips.shape_key_add(name='Basis')
SHAPES = {
    'smile': dict(W=0.031, Hu=0.0045, Hl=0.0055, corner=0.0075, thick=0.9),
    'frown': dict(W=0.026, corner=-0.007),
    'O': dict(W=0.016, Hu=0.011, Hl=0.013, fwd=-0.008, thick=1.1),
    'pucker': dict(W=0.011, Hu=0.0045, Hl=0.0045, fwd=-0.016, thick=1.25),
    'grimace': dict(W=0.033, Hu=0.0075, Hl=0.0085, corner=-0.002, thick=0.85),
    'wide': dict(W=0.029, Hu=0.008, Hl=0.016, thick=0.95),
}
for nm, kw in SHAPES.items():
    cc, rr, _ = lip_curve(**kw)
    Vk, _ = lip_mesh(cc, rr, th)
    sk = lips.shape_key_add(name=nm)
    sk.data.foreach_set('co', Vk.ravel())
bind(lips)

# mouth cavity, teeth, tongue
cav = uv_sphere('mouth_cavity', MC + G.V(0, 0.017, -0.004), 1.0, 32, 16)
Vc = verts_np(cav) - (MC + G.V(0, 0.017, -0.004))
Vc = Vc * G.V(0.031, 0.022, 0.024)
Vc[:, 1] = np.where(Vc[:, 1] < -0.006, -0.006 + (Vc[:, 1] + 0.006) * 0.2, Vc[:, 1])
cav.data.vertices.foreach_set('co', (Vc + MC + G.V(0, 0.017, -0.004)).ravel())
cav.data.materials.append(MAT['mouthin'])
wj = smoothstep(0.003, -0.006, Vc[:, 2])
assign_weights(cav, ['head', 'jaw'], np.stack([1 - wj, wj], 1), thresh=0.0)
bind(cav)


def teeth_arc(name, zc, h, bone):
    verts, faces = [], []
    n = 24
    for i in range(n + 1):
        u = -1 + 2 * i / n
        x = 0.022 * u
        y = 0.004 + 0.013 * u * u
        for (dy, dz) in ((0, h / 2), (0, -h / 2), (0.004, -h / 2), (0.004, h / 2)):
            verts.append(MC + G.V(x, y + dy, zc + dz))
    for i in range(n):
        for q in range(4):
            q2 = (q + 1) % 4
            faces.append((i * 4 + q, (i + 1) * 4 + q, (i + 1) * 4 + q2, i * 4 + q2))
    faces.append((0, 1, 2, 3)); faces.append((n * 4 + 3, n * 4 + 2, n * 4 + 1, n * 4 + 0))
    ob = make_mesh(name, verts, faces)
    bev = ob.modifiers.new('bev', 'BEVEL'); bev.width = 0.0012; bev.segments = 2
    ob.data.materials.append(MAT['teeth'])
    assign_weights(ob, [bone], np.ones(len(verts)))
    bind(ob)
    return ob


teeth_arc('teeth_up', 0.0005, 0.0062, 'head')
teeth_arc('teeth_lo', -0.0062, 0.0052, 'jaw')
tg = uv_sphere('tongue', MC + G.V(0, 0.014, -0.009), 1.0, 24, 12)
Vt = verts_np(tg) - (MC + G.V(0, 0.014, -0.009))
tg.data.vertices.foreach_set('co', (Vt * G.V(0.018, 0.014, 0.006) + MC + G.V(0, 0.014, -0.009)).ravel())
tg.data.materials.append(MAT['tongue'])
assign_weights(tg, ['jaw'], np.ones(len(Vt)))
bind(tg)

# ------------------------------------------------------------------ fur helpers
def add_fur(ob, mat, count, length, children, root=0.9, tip=0.25, clump=0.4, curl=0.0, curl_freq=2.0,
            rough=0.002, rough_end=0.0, align_down=0.0, normal=1.0, steps=2, seed=1, tangent=0.0, base=None):
    if base is not None:
        ob.data.materials.append(base)
    ob.data.materials.append(mat)
    m = ob.modifiers.new('fur', 'PARTICLE_SYSTEM')
    ps = ob.particle_systems[-1]
    ps.seed = seed
    st = ps.settings
    st.type = 'HAIR'
    st.count = count
    st.hair_length = length
    st.emit_from = 'FACE'
    st.distribution = 'RAND'
    st.use_advanced_hair = True
    nrm_ = max(np.hypot(normal, align_down) * 0.85, 1e-3)
    st.normal_factor = normal * length / 4 / nrm_
    st.tangent_factor = tangent * length / 4 / nrm_
    st.object_align_factor = (0, 0, -align_down * length / 4 / nrm_)
    st.hair_step = 5
    st.display_step = steps
    st.render_step = steps
    st.child_type = 'INTERPOLATED'
    st.child_percent = 2
    st.rendered_child_count = children
    st.child_length = 1.0
    st.clump_factor = clump
    st.clump_shape = 0.2
    st.roughness_1 = rough
    st.roughness_1_size = 1.0
    st.roughness_endpoint = rough_end
    st.roughness_end_shape = 1.0
    if curl > 0 and steps >= 3:
        st.kink = 'CURL'
        st.kink_amplitude = curl
        st.kink_frequency = curl_freq
        st.kink_shape = 0.0
    st.radius_scale = 0.001
    st.root_radius = root
    st.tip_radius = tip
    st.use_close_tip = True
    st.material_slot = mat.name
    st.use_rotations = False
    return ps


def weights_by(ob, groups):
    names = list(groups.keys())
    Wm = np.stack([groups[n] for n in names], 1)
    assign_weights(ob, names, Wm, thresh=0.0)


# ------------------------------------------------------------------ beard
beard = make_mesh('beard', D['beard_V'], D['beard_F'])
decimate(beard, 0.35)
Vbd = verts_np(beard)
x, y, z = Vbd.T
side = smoothstep(0.055, 0.08, np.abs(x)) * smoothstep(1.62, 1.7, z)
jaw_w = smoothstep(1.69, 1.635, z) * (1 - side)
tip_w = smoothstep(1.57, 1.45, z)
chk = np.exp(-(((np.abs(x) - 0.056) / 0.03) ** 2 + ((y + 0.062) / 0.04) ** 2 + ((z - 1.664) / 0.035) ** 2)) * 0.6
weights_by(beard, {
    'head': (1 - jaw_w) * (1 - chk),
    'jaw': jaw_w * (1 - tip_w) * (1 - chk),
    'beard_tip': jaw_w * tip_w * (1 - chk),
    'cheek.L': chk * (x > 0), 'cheek.R': chk * (x <= 0)})
bind(beard)
add_fur(beard, MAT['beard'], 2600, 0.03, 8, root=1.5, tip=0.35, clump=0.5, rough=0.004, rough_end=0.002,
        align_down=0.9, normal=0.6, seed=3, base=MAT['beardbase'])

must = make_mesh('mustache', D['must_V'], D['must_F'])
decimate(must, 0.5)
Vm = verts_np(must)
weights_by(must, {'head': np.ones(len(Vm)) * 0.85, 'cheek.L': 0.15 * (Vm[:, 0] > 0), 'cheek.R': 0.15 * (Vm[:, 0] <= 0)})
bind(must)
add_fur(must, MAT['beard'], 600, 0.0085, 8, root=1.1, tip=0.3, clump=0.4, rough=0.0012,
        align_down=0.8, normal=0.5, seed=5, base=MAT['beardbase'])

# ------------------------------------------------------------------ hair
hair = make_mesh('hair', D['hair_V'], D['hair_F'])
decimate(hair, 0.35)
Vh = verts_np(hair)
hb = smoothstep(1.74, 1.55, Vh[:, 2]) * smoothstep(-0.02, 0.04, Vh[:, 1])
weights_by(hair, {'head': 1 - hb, 'hair_back': hb})
bind(hair)
add_fur(hair, MAT['hair'], 2800, 0.038, 8, root=1.5, tip=0.35, clump=0.6, rough=0.005, rough_end=0.004,
        align_down=0.8, normal=0.55, seed=7, base=MAT['hairbase'])

brow = make_mesh('brows', D['brow_V'], D['brow_F'])
Vbr = verts_np(brow)
weights_by(brow, {'brow.L': (Vbr[:, 0] > 0).astype(float), 'brow.R': (Vbr[:, 0] <= 0).astype(float)})
bind(brow)
add_fur(brow, MAT['brow'], 450, 0.008, 6, root=0.8, tip=0.25, clump=0.3, rough=0.001, align_down=0.35,
        normal=0.6, seed=9, base=MAT['beardbase'])

# ------------------------------------------------------------------ tunic
Vt, Ft = D['tunic_V'], D['tunic_F']
cent = Vt[Ft].mean(1)
keep = G.tunic_keep(cent, L)
Ft = Ft[keep]
used = np.unique(Ft)
remap = -np.ones(len(Vt), int); remap[used] = np.arange(len(used))
tunic = make_mesh('tunic', Vt[used], remap[Ft])
decimate(tunic, 0.5)
Vtu = verts_np(tunic)
# weights: copy from nearest body vertex, then blend skirt bones
tree = cKDTree(Vb)
_, nn = tree.query(Vtu)
Wt = W[nn].copy()
lowf = smoothstep(0.98, 0.70, Vtu[:, 2])
fr = smoothstep(0.02, -0.08, Vtu[:, 1]); bk = smoothstep(-0.02, 0.08, Vtu[:, 1])
Wt *= (1 - 0.45 * lowf)[:, None]
Wt[:, bidx['skirt_F']] += 0.45 * lowf * fr
Wt[:, bidx['skirt_B']] += 0.45 * lowf * bk
Wt[:, bidx['hips']] += 0.45 * lowf * (1 - fr - bk).clip(0, 1)
Wt = smooth_weights(Wt, adjacency(tunic), iters=6, amt=0.5)
assign_weights(tunic, bone_names, Wt)
bind(tunic)
sol = tunic.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 0.006; sol.offset = 1.0
set_rest_attr(tunic)
tunic.data.materials.append(MAT['leopard'])
print('tunic done')

# ------------------------------------------------------------------ save
for ob in col.objects:
    ob['caveman'] = True
json.dump({k: (v.tolist() if hasattr(v, 'tolist') else v) for k, v in L.items()}, open(f'{ASSETS}/landmarks.json', 'w'))
bpy.ops.wm.save_as_mainfile(filepath=f'{ASSETS}/caveman.blend')
print('saved')
