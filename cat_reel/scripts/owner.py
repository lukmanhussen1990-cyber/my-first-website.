"""Simple, cute low-poly owner built from primitives (seated rest pose), rigged.

Rig 'OwnerRig' (faces -Y, origin = sofa seat surface under the pelvis):
  root, pelvis, spine, neck, head, upper_arm/forearm/hand .L/.R (IK to IK_hand.*),
  thigh/shin/foot .L/.R, face: eye.L/R (scale y = lids), brow.L/R, mouth_smile/flat/o.
"""
import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Euler

from catlib import (N, M, SEP, COMB, SMOOTH, MIXC, setin, sock_out, hexcol, new_material,
                    principled, output, quad_sphere, frame_from_forward)
from scenelib import mesh_obj, subsurf, pbr, solid

SKIN = '#E8B08A'
HAIR = '#3A261C'


def capsule(r, a, b, cuts=4, sx=1.0, sy=1.0):
    """capsule between points a and b (Vectors) with radius r."""
    bm = quad_sphere(cuts)
    L = (b - a).length
    for v in bm.verts:
        x, y, z = v.co.x * r * sx, v.co.y * r * sy, v.co.z * r
        z += L if v.co.z > 0 else 0.0
        v.co = Vector((x, y, z))
    d = (b - a).normalized()
    rot = Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(a) @ rot, verts=bm.verts[:])
    return bm


def ellip(r, c, cuts=4):
    bm = quad_sphere(cuts)
    for v in bm.verts:
        v.co = Vector((v.co.x * r[0] + c[0], v.co.y * r[1] + c[1], v.co.z * r[2] + c[2]))
    return bm


def torso_bm():
    rings = []
    prof = [  # z, half-width, half-depth, y-offset
        (0.10, 0.150, 0.110, 0.010), (0.18, 0.152, 0.112, 0.008), (0.28, 0.165, 0.118, 0.0),
        (0.38, 0.180, 0.120, -0.004), (0.47, 0.192, 0.118, -0.002), (0.54, 0.190, 0.108, 0.004),
        (0.585, 0.15, 0.09, 0.008), (0.61, 0.07, 0.06, 0.008)]
    seg = 24
    bm = bmesh.new()
    vr = []
    for z, hw, hd, yo in prof:
        ring = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            c, s = math.cos(a), math.sin(a)
            # superellipse cross-section (boxy-round)
            e = 0.75
            x = hw * math.copysign(abs(c) ** e, c)
            y = hd * math.copysign(abs(s) ** e, s) + yo
            ring.append(bm.verts.new((x, y, z)))
        vr.append(ring)
    for a, b in zip(vr[:-1], vr[1:]):
        for i in range(seg):
            bm.faces.new((a[i], a[(i + 1) % seg], b[(i + 1) % seg], b[i]))
    for ring, up in ((vr[0], False), (vr[-1], True)):
        c = bm.verts.new(sum((v.co for v in ring), Vector()) / seg)
        for i in range(seg):
            f = (ring[i], ring[(i + 1) % seg], c) if up else (ring[(i + 1) % seg], ring[i], c)
            bm.faces.new(f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def build_owner(coll, location, yaw=0.0, sweater='#D9A03E'):
    m_skin = solid('Owner_Skin', SKIN, 0.55, sheen=0.25, spec=0.4)
    m_hair = solid('Owner_Hair', HAIR, 0.45, sheen=0.6, spec=0.5, noise_bump=0.25, noise_scale=90)
    m_sweater = pbr('Owner_Sweater', 'cotton_jersey', scale=6.0, tint=sweater, sat=0.0, val=1.25,
                    nstr=0.8, sheen=0.4)
    m_jeans = pbr('Owner_Jeans', 'denim_fabric', scale=4.0, nstr=0.9, val=1.05)
    m_sock = solid('Owner_Sock', '#F2EEE8', 0.8, sheen=0.4)
    m_eye = new_material('Owner_Eye')[0]
    nt = m_eye.node_tree
    p = N(nt, 'ShaderNodeTexCoord').outputs['Object']
    x, y, z = SEP(nt, p)
    hl = M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, M(nt, 'SQRT', M(nt, 'ADD', M(nt, 'MULTIPLY', M(nt, 'SUBTRACT', x, 0.006), M(nt, 'SUBTRACT', x, 0.006)),
                                                       M(nt, 'MULTIPLY', M(nt, 'SUBTRACT', z, 0.009), M(nt, 'SUBTRACT', z, 0.009)))), 0.0035, 0.005))
    col = MIXC(nt, hl, hexcol('#241812'), hexcol('#FFFFFF'))
    b = principled(nt, col, 0.15)
    setin(nt, b, 'Emission Color', hexcol('#FFFFFF'))
    setin(nt, b, 'Emission Strength', M(nt, 'MULTIPLY', hl, 1.5))
    setin(nt, b, 'Coat Weight', 0.8)
    output(nt, sock_out(b, 'BSDF'))
    m_brow = solid('Owner_Brow', '#2E1E16', 0.6)
    m_mouth = solid('Owner_Mouth', '#7A3A32', 0.5)
    m_mouth_in = solid('Owner_MouthIn', '#5A1E22', 0.6)
    m_blush = solid('Owner_Blush', '#E8968A', 0.6)

    parts = {}   # name -> (object, bone)

    def add(name, bm, mat, bone, sub=2):
        ob = mesh_obj('Owner_' + name, bm, coll, [mat])
        if sub:
            subsurf(ob, sub, 1)
        parts[name] = (ob, bone)
        return ob

    V = Vector
    # body (seated rest pose)
    add('Hips', ellip((0.165, 0.13, 0.085), (0, 0.01, 0.085)), m_jeans, 'pelvis')
    add('Torso', torso_bm(), m_sweater, 'spine')
    add('Collar', capsule(0.052, V((0, 0.004, 0.58)), V((0, 0.004, 0.62)), sx=1.05, sy=1.0), m_sweater, 'spine')
    add('Neck', capsule(0.042, V((0, 0.0, 0.57)), V((0, -0.004, 0.68)), cuts=3), m_skin, 'neck')
    HC = V((0, -0.012, 0.80))       # head centre
    hb = ellip((0.112, 0.118, 0.13), HC, 6)
    for v in hb.verts:                 # softer jaw, rounder cheeks
        rel = v.co - HC
        if rel.z < -0.02:
            k = min(1.0, (-0.02 - rel.z) / 0.11)
            v.co.x = HC.x + rel.x * (1.0 - 0.18 * k)
            v.co.y = HC.y + rel.y * (1.0 - 0.08 * k)
    add('Head', hb, m_skin, 'head')
    # hair: close-fitting cap with a raised hairline, a swept fringe and a top tuft
    hair = ellip((0.118, 0.124, 0.137), HC + V((0, 0.006, 0.01)), 6)
    bmesh.ops.bisect_plane(hair, geom=hair.verts[:] + hair.edges[:] + hair.faces[:],
                           plane_co=HC + V((0, -0.05, 0.045)), plane_no=V((0, -0.62, -0.78)).normalized(),
                           clear_outer=True)
    bmesh.ops.bisect_plane(hair, geom=hair.verts[:] + hair.edges[:] + hair.faces[:],
                           plane_co=HC + V((0, 0, -0.055)), plane_no=V((0, 0.25, -1)).normalized(), clear_outer=True)
    hob = add('Hair', hair, m_hair, 'head')
    sol = hob.modifiers.new('Solidify', 'SOLIDIFY')
    sol.thickness = 0.008
    sol.offset = 1.0
    hob.modifiers.move(1, 0)
    fr = bmesh.new()
    tufts = [(-0.062, 0.62, 0.064, 0.03), (-0.03, 0.42, 0.075, 0.034), (0.004, 0.25, 0.08, 0.034),
             (0.038, 0.1, 0.07, 0.032), (0.07, -0.05, 0.055, 0.028)]
    for dx, rz, ln, rad in tufts:
        c = bmesh.new()
        bmesh.ops.create_cone(c, cap_ends=True, cap_tris=False, segments=10, radius1=rad, radius2=0.003, depth=ln)
        for v in c.verts:
            v.co.y *= 0.42
            t_ = (v.co.z + ln / 2) / ln          # 0 at root, 1 at tip
            v.co.z = -(v.co.z + ln / 2)          # hang down from the root
            v.co.y -= 0.03 * t_ * t_             # curl outward from the forehead
        m = Matrix.Translation(HC + V((dx, -0.088 + abs(dx) * 0.3, 0.108 - abs(dx) * 0.25))) @ \
            Euler((0.5, 0.0, rz)).to_matrix().to_4x4()
        bmesh.ops.transform(c, matrix=m, verts=c.verts[:])
        me_t = bpy.data.meshes.new('t')
        c.to_mesh(me_t)
        c.free()
        fr.from_mesh(me_t)
        bpy.data.meshes.remove(me_t)
    c = bmesh.new()
    bmesh.ops.create_cone(c, cap_ends=True, cap_tris=False, segments=10, radius1=0.028, radius2=0.003, depth=0.06)
    for v in c.verts:
        v.co.y *= 0.5
    bmesh.ops.transform(c, matrix=Matrix.Translation(HC + V((0.01, 0.03, 0.155))) @ Euler((-0.7, 0.3, 0)).to_matrix().to_4x4(),
                        verts=c.verts[:])
    me_t = bpy.data.meshes.new('t')
    c.to_mesh(me_t)
    c.free()
    fr.from_mesh(me_t)
    bpy.data.meshes.remove(me_t)
    add('Fringe', fr, m_hair, 'head')
    for side, sx in (('L', 1), ('R', -1)):
        add('Ear.' + side, ellip((0.016, 0.026, 0.034), HC + V((sx * 0.11, 0.004, -0.008)), 3), m_skin, 'head')
    add('Nose', ellip((0.0105, 0.009, 0.0125), HC + V((0, -0.117, -0.022)), 3), m_skin, 'head')
    # face features (rigged)
    face = {}
    for side, sx in (('L', 1), ('R', -1)):
        e = mesh_obj(f'Owner_Eye.{side}', ellip((0.0155, 0.007, 0.0205), (0, 0, 0), 4), coll, [m_eye])
        subsurf(e, 2, 1)
        e.matrix_world = Matrix.Translation(HC + V((sx * 0.043, -0.108, 0.006))) @ frame_from_forward(V((sx * 0.25, -1, 0))).to_4x4()
        face['eye.' + side] = e
        br = mesh_obj(f'Owner_Brow.{side}', capsule(0.0052, V((-0.017, 0, 0)), V((0.017, 0, 0)), cuts=3), coll, [m_brow])
        subsurf(br, 1, 1)
        br.matrix_world = Matrix.Translation(HC + V((sx * 0.045, -0.111, 0.046))) @ frame_from_forward(V((sx * 0.25, -1, 0))).to_4x4()
        face['brow.' + side] = br
        bl = mesh_obj(f'Owner_Blush.{side}', ellip((0.018, 0.004, 0.01), (0, 0, 0), 3), coll, [m_blush])
        subsurf(bl, 1, 1)
        bl.matrix_world = Matrix.Translation(HC + V((sx * 0.066, -0.098, -0.03))) @ frame_from_forward(V((sx * 0.55, -1, 0))).to_4x4()
        parts['Blush.' + side] = (bl, 'head')

    def mouth_curve(name, pts, mat, depth=0.0028):
        cu = bpy.data.curves.new(name, 'CURVE')
        cu.dimensions = '3D'
        cu.bevel_depth = depth
        cu.bevel_resolution = 2
        sp = cu.splines.new('POLY')
        sp.points.add(len(pts) - 1)
        for i, (x, z) in enumerate(pts):
            sp.points[i].co = (x, 0.0, z, 1.0)
        ob = bpy.data.objects.new(name, cu)
        coll.objects.link(ob)
        cu.materials.append(mat)
        return ob
    mouth_pos = HC + V((0, -0.112, -0.062))
    sm = mouth_curve('Owner_MouthSmile', [(0.022 * math.cos(a), -0.008 * math.sin(a) + 0.004)
                                           for a in [math.pi * (1 - i / 12) for i in range(13)]], m_mouth)
    fl = mouth_curve('Owner_MouthFlat', [(-0.016, 0.0), (-0.006, 0.0015), (0.006, 0.0015), (0.016, -0.002)], m_mouth)
    mo = mesh_obj('Owner_MouthO', ellip((0.011, 0.006, 0.013), (0, 0, 0), 3), coll, [m_mouth_in])
    subsurf(mo, 1, 1)
    for ob, nm in ((sm, 'mouth_smile'), (fl, 'mouth_flat'), (mo, 'mouth_o')):
        ob.matrix_world = Matrix.Translation(mouth_pos) @ frame_from_forward(V((0, -1, -0.2))).to_4x4()
        face[nm] = ob
    # arms / hands
    for side, sx in (('L', 1), ('R', -1)):
        sh = V((sx * 0.195, 0.0, 0.545))
        el = V((sx * 0.235, 0.06, 0.32))
        wr = V((sx * 0.20, -0.21, 0.26))
        add('UpperArm.' + side, capsule(0.044, sh, el), m_sweater, 'upper_arm.' + side)
        add('Forearm.' + side, capsule(0.039, el, wr + (wr - el).normalized() * -0.01), m_sweater, 'forearm.' + side)
        hd = wr + V((0, -0.055, -0.005))
        hand = ellip((0.042, 0.055, 0.022), hd, 4)
        th = capsule(0.013, hd + V((-sx * 0.03, 0.02, 0.0)), hd + V((-sx * 0.045, -0.025, 0.006)), cuts=3)
        me_t = bpy.data.meshes.new('t')
        th.to_mesh(me_t)
        th.free()
        hand.from_mesh(me_t)
        bpy.data.meshes.remove(me_t)
        add('Hand.' + side, hand, m_skin, 'hand.' + side)
        # legs
        hp = V((sx * 0.095, 0.0, 0.085))
        kn = V((sx * 0.1, -0.44, 0.092))
        an = V((sx * 0.1, -0.455, -0.36))
        add('Thigh.' + side, capsule(0.078, hp, kn), m_jeans, 'thigh.' + side)
        add('Shin.' + side, capsule(0.058, kn, an + V((0, 0, 0.03))), m_jeans, 'shin.' + side)
        ft = ellip((0.052, 0.115, 0.045), an + V((0, -0.06, -0.045)), 4)
        add('Foot.' + side, ft, m_sock, 'foot.' + side)

    # ---------------- rig ----------------
    arm = bpy.data.armatures.new('OwnerRig')
    rig = bpy.data.objects.new('OwnerRig', arm)
    coll.objects.link(rig)
    rig.show_in_front = True
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones

    def bone(name, h, t, parent=None, connect=False):
        b = eb.new(name)
        b.head, b.tail = V(h), V(t)
        b.roll = 0.0
        b.use_deform = False
        if parent:
            b.parent = eb[parent]
            b.use_connect = connect
        return b

    bone('root', (0, 0, 0), (0, 0.15, 0))
    bone('pelvis', (0, 0.02, 0.06), (0, 0.02, 0.16), 'root')
    bone('spine', (0, 0.02, 0.12), (0, 0.02, 0.56), 'pelvis')
    bone('neck', (0, 0.0, 0.57), (0, -0.004, 0.68), 'spine')
    bone('head', (0, -0.004, 0.68), (0, -0.004, 0.92), 'neck', connect=True)
    for side, sx in (('L', 1), ('R', -1)):
        sh = V((sx * 0.195, 0.0, 0.545))
        el = V((sx * 0.235, 0.06, 0.32))
        wr = V((sx * 0.20, -0.21, 0.26))
        bone('upper_arm.' + side, sh, el, 'spine')
        bone('forearm.' + side, el, wr, 'upper_arm.' + side, connect=True)
        bone('hand.' + side, wr, wr + V((0, -0.09, -0.005)), 'forearm.' + side, connect=True)
        hp = V((sx * 0.095, 0.0, 0.085))
        kn = V((sx * 0.1, -0.44, 0.092))
        an = V((sx * 0.1, -0.455, -0.36))
        bone('thigh.' + side, hp, kn, 'pelvis')
        bone('shin.' + side, kn, an, 'thigh.' + side, connect=True)
        bone('foot.' + side, an, an + V((0, -0.12, -0.04)), 'shin.' + side, connect=True)
    for nm, ob in face.items():
        c = ob.matrix_world.translation
        bone(nm, c, c + V((0, 0, 0.02)), 'head')
    bpy.ops.object.mode_set(mode='OBJECT')

    def parent_to_bone(ob, bname):
        b = arm.bones[bname]
        world = ob.matrix_world.copy()
        tail_m = b.matrix_local @ Matrix.Translation((0, b.length, 0))
        ob.parent = rig
        ob.parent_type = 'BONE'
        ob.parent_bone = bname
        ob.matrix_parent_inverse = Matrix.Identity(4)
        ob.matrix_basis = tail_m.inverted() @ world

    for nm, (ob, bn) in parts.items():
        parent_to_bone(ob, bn)
    for nm, ob in face.items():
        parent_to_bone(ob, nm)

    # IK targets for hands + head look target
    ctrl = {}
    for side, sx in (('L', 1), ('R', -1)):
        t = bpy.data.objects.new(f'IK_hand.{side}', None)
        coll.objects.link(t)
        t.empty_display_size = 0.04
        t.parent = rig
        t.location = V((sx * 0.20, -0.21, 0.26))
        pole = bpy.data.objects.new(f'Pole_arm.{side}', None)
        coll.objects.link(pole)
        pole.parent = rig
        pole.location = V((sx * 0.55, 0.35, 0.2))
        pb = rig.pose.bones['forearm.' + side]
        ik = pb.constraints.new('IK')
        ik.target = t
        ik.chain_count = 2
        ik.use_stretch = False
        ctrl['ik.' + side] = t
        ctrl['pole.' + side] = pole
    look = bpy.data.objects.new('Owner_LookTarget', None)
    coll.objects.link(look)
    look.parent = rig
    look.location = V((0, -0.8, 0.45))
    hcon = rig.pose.bones['head'].constraints.new('DAMPED_TRACK')
    hcon.target = look
    hcon.track_axis = 'TRACK_Z'
    hcon.influence = 0.0
    ctrl['look'] = look
    ctrl['head_con'] = hcon

    rig.location = location
    rig.rotation_euler = (0, 0, yaw)
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
    return rig, ctrl


EXPRESSIONS = {
    #            eye_scale_y, eye_scale, brow_dz, brow_rot(inner down +), mouth
    'neutral':   (1.0, 1.0, 0.0, 0.0, 'smile'),
    'smile':     (0.9, 1.0, 0.004, -0.1, 'smile'),
    'annoyed':   (0.5, 1.0, -0.006, 0.42, 'flat'),
    'stare':     (0.85, 1.05, 0.0, 0.05, 'flat'),
    'surprised': (1.18, 1.12, 0.012, -0.15, 'o'),
    'worried':   (1.1, 1.08, 0.009, -0.38, 'o'),
}


def set_face(rig, expr, blink=0.0):
    ey, es, bdz, brot, mouth = EXPRESSIONS[expr]
    pb = rig.pose.bones
    for side, sgn in (('L', 1), ('R', -1)):
        e = pb['eye.' + side]
        e.scale = (es, ey * es * (1.0 - 0.92 * blink), es)
        b = pb['brow.' + side]
        b.location = (0.0, bdz, 0.0)            # bone points up: local Y = up
        b.rotation_euler = (0.0, 0.0, sgn * brot)    # local Z = forward: + lowers the inner end
    for nm in ('smile', 'flat', 'o'):
        b = pb['mouth_' + nm]
        on = 1.0 if nm == mouth else 0.0005
        b.scale = (on, on, on)


FACE_BONES = ['eye.L', 'eye.R', 'brow.L', 'brow.R', 'mouth_smile', 'mouth_flat', 'mouth_o']
BODY_BONES = ['root', 'pelvis', 'spine', 'neck', 'head']


def key_owner(rig, ctrl, frame):
    for nm in FACE_BONES + BODY_BONES:
        b = rig.pose.bones[nm]
        for path in ('location', 'rotation_euler', 'scale'):
            b.keyframe_insert(path, frame=frame, group=nm)
    for side in ('L', 'R'):
        rig.pose.bones['hand.' + side].keyframe_insert('rotation_euler', frame=frame, group='hand.' + side)
        ctrl['ik.' + side].keyframe_insert('location', frame=frame)
    ctrl['look'].keyframe_insert('location', frame=frame)
    ctrl['head_con'].keyframe_insert('influence', frame=frame)
