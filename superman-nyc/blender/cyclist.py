"""A food-delivery cyclist overtaking the camera operator in the avenue's bike lane (scene 1).

Procedural bicycle (frame tubes, wheels with spokes, crank and pedals) and a library pedestrian
posed on it: leaned torso, hands on the bar, and legs solved per frame with a two-bone IK so
the feet stay on the turning pedals.  He wobbles at the sonic boom and is gone by scene 2.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

import timeline as TL
import people

FPS = TL.FPS
P = people.P
LANE_X = -9.0                 # centre of the green bike lane (x -9.85 .. -8.2)
SPEED = 5.2                   # m/s
T_PASS = 2.7                  # overtakes the operator
T_GONE = 9.0                  # hidden once the phone points at the sky
WHEEL_R = 0.34
BB = Vector((-0.05, 0.0, 0.29))
CRANK = 0.17
GEAR = 2.6                    # wheel turns per crank turn
GRIP = (0.36, 0.22, 0.92)
SADDLE = Vector((-0.2, 0.0, 0.95))


# ------------------------------------------------------------------------------ geometry
def material(name, color, rough, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color + (1.0,)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


def tube(bm, a, b, r, seg=10, mat=0):
    a, b = Vector(a), Vector(b)
    axis = (b - a).normalized()
    q = Vector((0, 0, 1)).rotation_difference(axis)
    ring_a, ring_b = [], []
    for i in range(seg):
        ang = 2 * math.pi * i / seg
        off = q @ Vector((math.cos(ang) * r, math.sin(ang) * r, 0))
        ring_a.append(bm.verts.new(a + off))
        ring_b.append(bm.verts.new(b + off))
    for i in range(seg):
        j = (i + 1) % seg
        f = bm.faces.new((ring_a[i], ring_a[j], ring_b[j], ring_b[i]))
        f.material_index = mat
        f.smooth = True
    for ring in (ring_a, ring_b[::-1]):
        f = bm.faces.new(ring[::-1] if ring is ring_a else ring)
        f.material_index = mat


def torus(bm, R, r, seg=36, rseg=8, mat=0):
    """Ring in the XZ plane (the wheel plane), centred at the origin."""
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        c, s = math.cos(a), math.sin(a)
        ring = []
        for k in range(rseg):
            b = 2 * math.pi * k / rseg
            rr = R + r * math.cos(b)
            ring.append(bm.verts.new((rr * c, r * math.sin(b), rr * s)))
        rings.append(ring)
    for i in range(seg):
        for k in range(rseg):
            f = bm.faces.new((rings[i][k], rings[(i + 1) % seg][k], rings[(i + 1) % seg][(k + 1) % rseg],
                              rings[i][(k + 1) % rseg]))
            f.material_index = mat
            f.smooth = True


def box(bm, c, size, mat=0):
    c = Vector(c)
    hx, hy, hz = (s / 2 for s in size)
    v = [bm.verts.new(c + Vector((x, y, z))) for x in (-hx, hx) for y in (-hy, hy) for z in (-hz, hz)]
    for idx in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        f = bm.faces.new([v[i] for i in idx])
        f.material_index = mat


def mesh_object(name, bm, mats, coll, parent=None):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob


def build_bike(coll, mats):
    root = bpy.data.objects.new("Bike", None)
    coll.objects.link(root)
    rear, front = Vector((-0.5, 0, WHEEL_R)), Vector((0.5, 0, WHEEL_R))
    st, ht, hb = Vector((-0.17, 0, 0.82)), Vector((0.37, 0, 0.84)), Vector((0.42, 0, 0.66))
    bm = bmesh.new()
    for a, b, r in ((BB, st, 0.016), (BB, hb, 0.021), (st, ht, 0.015), (ht, hb, 0.02)):
        tube(bm, a, b, r)
    for side in (-1, 1):
        tube(bm, BB + Vector((0, side * 0.03, 0)), rear + Vector((0, side * 0.055, 0)), 0.009)
        tube(bm, st + Vector((0, side * 0.02, -0.04)), rear + Vector((0, side * 0.055, 0)), 0.008)
        tube(bm, hb + Vector((0, side * 0.03, 0)), front + Vector((0, side * 0.05, 0)), 0.011)
    tube(bm, ht, (0.34, 0, 0.92), 0.013, mat=2)                     # stem
    tube(bm, (GRIP[0], -GRIP[1], GRIP[2]), (GRIP[0], GRIP[1], GRIP[2]), 0.012, mat=2)
    for side in (-1, 1):
        tube(bm, (GRIP[0], side * (GRIP[1] - 0.11), GRIP[2]), (GRIP[0], side * (GRIP[1] + 0.01), GRIP[2]), 0.017, mat=1)
    tube(bm, st, SADDLE + Vector((0, 0, -0.03)), 0.012, mat=2)    # seat post
    box(bm, SADDLE, (0.26, 0.13, 0.05), mat=3)
    box(bm, (-0.62, 0, 0.62), (0.34, 0.12, 0.02), mat=0)          # rear fender stub
    frame = mesh_object("BikeFrame", bm, [mats["paint"], mats["rubber"], mats["metal"], mats["saddle"]], coll, root)
    wheels = []
    for name, c in (("BikeWheelR", rear), ("BikeWheelF", front)):
        bm = bmesh.new()
        torus(bm, WHEEL_R - 0.018, 0.019, mat=1)
        torus(bm, WHEEL_R - 0.045, 0.009, mat=2)
        for k in range(16):
            a = 2 * math.pi * k / 16
            tube(bm, (0.02 * math.cos(a), 0.03 * (1 if k % 2 else -1), 0.02 * math.sin(a)),
                 ((WHEEL_R - 0.05) * math.cos(a), 0, (WHEEL_R - 0.05) * math.sin(a)), 0.0016, seg=4, mat=2)
        tube(bm, (0, -0.05, 0), (0, 0.05, 0), 0.022, mat=2)
        w = mesh_object(name, bm, [mats["paint"], mats["rubber"], mats["metal"]], coll, root)
        w.location = c
        w.rotation_mode = 'XYZ'
        wheels.append(w)
    bm = bmesh.new()
    for side, ang in ((1, 0.0), (-1, math.pi)):
        tip = Vector((-math.sin(ang) * CRANK, side * 0.075, -math.cos(ang) * CRANK))
        tube(bm, (0, side * 0.06, 0), tip, 0.012, mat=2)
        box(bm, tip + Vector((0, side * 0.04, 0)), (0.09, 0.08, 0.022), mat=1)
    tube(bm, (0, -0.07, 0), (0, 0.07, 0), 0.03, mat=2)
    crank = mesh_object("BikeCrank", bm, [mats["paint"], mats["rubber"], mats["metal"]], coll, root)
    crank.location = BB
    crank.rotation_mode = 'XYZ'
    return root, frame, wheels, crank


# ------------------------------------------------------------------------------ rider pose
def _update():
    bpy.context.view_layer.update()


def _rotate_about_head(pb, q):
    """Apply an extra armature-space rotation q to pose bone pb, pivoting on its head."""
    h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix


def two_bone(rig, upper, lower, end, target, pole):
    """Rotate `upper` and `lower` so that the head of `end` reaches target (armature space)."""
    pu, pl, pe = (rig.pose.bones[P + n] for n in (upper, lower, end))
    pu.rotation_quaternion = (1, 0, 0, 0)
    pl.rotation_quaternion = (1, 0, 0, 0)
    _update()
    a, b, c = pu.head.copy(), pl.head.copy(), pe.head.copy()
    l1, l2 = (b - a).length, (c - b).length
    to_t = target - a
    d = min(to_t.length, (l1 + l2) * 0.999)
    u = to_t.normalized()
    cos_a = max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
    side = pole - a
    side = (side - u * side.dot(u)).normalized()
    knee = a + (u * cos_a + side * math.sqrt(1 - cos_a * cos_a)) * l1
    _rotate_about_head(pu, (b - a).rotation_difference(knee - a))
    _update()
    b2, c2 = pl.head.copy(), pe.head.copy()
    _rotate_about_head(pl, (c2 - b2).rotation_difference(a + u * d - b2))
    _update()


def aim_bone(rig, bone, child, direction):
    """Turn `bone` so that the vector to `child`'s head points along `direction` (armature space)."""
    pb, pc = rig.pose.bones[P + bone], rig.pose.bones[P + child]
    pb.rotation_quaternion = (1, 0, 0, 0)
    _update()
    _rotate_about_head(pb, (pc.head - pb.head).rotation_difference(direction))
    _update()


def key_bones(rig, names, frame):
    for n in names:
        rig.keyframe_insert(f'pose.bones["{P + n}"].rotation_quaternion', frame=frame)


def build(lib, coll):
    rng = random.Random(41)
    mats = {"paint": material("BikePaint", (0.02, 0.09, 0.08), 0.35, 0.4),
            "rubber": material("BikeRubber", (0.012, 0.012, 0.012), 0.8),
            "metal": material("BikeMetal", (0.55, 0.56, 0.58), 0.3, 1.0),
            "saddle": material("BikeSaddle", (0.02, 0.018, 0.016), 0.55),
            "bag": material("DeliveryBag", (0.55, 0.05, 0.03), 0.6),
            "helmet": material("Helmet", (0.03, 0.03, 0.035), 0.35)}
    root, frame, wheels, crank = build_bike(coll, mats)
    outfit = people.random_outfit("male", rng)
    outfit.update(top="jacket", bottom="pants", hair="short", acc=[], height=1.0, girth=1.0,
                  top_col=(0.10, 0.13, 0.20), top_mat="cloth", pants_col=(0.05, 0.05, 0.06), pants_mat="cloth",
                  shoe_col=(0.85, 0.85, 0.84))
    rig = people.spawn_person(lib, "male", outfit, "Cyclist", coll, (0, 0, 0), 0.0, lod=1)
    rig.parent = root
    rig.matrix_parent_inverse = Matrix.Identity(4)
    rig.scale = (1, 1, 1)
    rig.rotation_euler = (0, 0, math.pi / 2)             # the rig faces -Y; the bike's forward is +X
    hips_rest = rig.data.bones[P + "Hips"].head_local
    rig.location = Vector((-0.17, 0.0, 1.0)) - Matrix.Rotation(math.pi / 2, 3, 'Z') @ hips_rest
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    # torso leaned over the bar, head up to see the road
    lean = {"Hips": 0.32, "Spine": 0.16, "Spine1": 0.13, "Spine2": 0.1, "Neck": -0.3, "Head": -0.28}
    for n, a in lean.items():
        rig.pose.bones[P + n].rotation_quaternion = Quaternion((1, 0, 0), a)
    _update()
    to_arm = rig.matrix_basis.inverted()                  # bike space -> armature space
    for side, s in (("Left", 1), ("Right", -1)):
        grip = to_arm @ Vector((GRIP[0] - 0.02, s * (GRIP[1] - 0.04), GRIP[2] + 0.02))
        sh = rig.pose.bones[P + side + "Arm"].head
        pole = sh + Vector((s * 0.5, 0.35, -0.35))
        two_bone(rig, side + "Arm", side + "ForeArm", side + "Hand", grip, pole)
    # the delivery bag on his back, the helmet on his head
    bm = bmesh.new()
    box(bm, (0, 0, 0), (0.40, 0.42, 0.24))                    # bone axes: x across, y up the spine, z forward
    bag = mesh_object("DeliveryBag", bm, [mats["bag"]], coll)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10, radius=1.0)
    for v in list(bm.verts):
        if v.co.y < -0.2:
            bm.verts.remove(v)
    bmesh.ops.scale(bm, vec=(0.108, 0.1, 0.138), verts=bm.verts)
    helmet = mesh_object("Helmet", bm, [mats["helmet"]], coll)
    _update()
    for ob, bone, off in ((bag, "Spine2", Vector((0.0, -0.07, -0.21))), (helmet, "Head", Vector((0.0, 0.115, -0.01)))):
        pb = rig.pose.bones[P + bone]
        ob.parent = rig
        ob.parent_type = 'BONE'
        ob.parent_bone = P + bone
        ob.matrix_world = rig.matrix_world @ Matrix.Translation(pb.head + pb.matrix.to_3x3() @ off) @ \
            pb.matrix.to_3x3().to_4x4()
    # ------------------------------------------------------------------ ride
    # (skip mesh deformation while solving: only bone positions are needed)
    deform = [m for o in coll.objects if o.parent == rig for m in o.modifiers if m.type == 'ARMATURE']
    for m in deform:
        m.show_viewport = False
    names = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head"]
    names += [s + n for s in ("Left", "Right") for n in ("Arm", "ForeArm", "Hand")]
    legs = [s + n for s in ("Left", "Right") for n in ("UpLeg", "Leg", "Foot")]
    y0 = TL.operator_pos(T_PASS)[1] - SPEED * T_PASS
    for f in range(0, int(T_GONE * FPS) + 2):
        t = f / FPS
        dist = SPEED * t + (0.6 * max(0.0, t - TL.T_BOOM1) ** 2 if t > TL.T_BOOM1 else 0.0)
        sway = 0.06 * math.sin(t * 2.1 + 0.4)
        wob = 0.1 * math.exp(-max(0.0, t - TL.T_BOOM1 - 0.15) / 0.5) * math.sin((t - TL.T_BOOM1) * 13) \
            if t > TL.T_BOOM1 + 0.15 else 0.0
        root.location = (LANE_X + sway, y0 + dist, 0.0)
        root.rotation_euler = (0.012 * math.sin(t * 2.1) + wob, 0.0, math.pi / 2)
        root.keyframe_insert("location", frame=f)
        root.keyframe_insert("rotation_euler", frame=f)
        wheel_ang = dist / WHEEL_R
        for w in wheels:
            w.rotation_euler = (0, wheel_ang, 0)
            w.keyframe_insert("rotation_euler", frame=f)
        ca = wheel_ang / GEAR
        crank.rotation_euler = (0, ca, 0)
        crank.keyframe_insert("rotation_euler", frame=f)
        # head glances up at the boom
        look = 0.35 * min(1.0, max(0.0, (t - TL.T_BOOM1 - 0.2) / 0.4)) if t > TL.T_BOOM1 + 0.2 else 0.0
        rig.pose.bones[P + "Neck"].rotation_quaternion = Quaternion((1, 0, 0), lean["Neck"] - look)
        _update()
        to_arm = rig.matrix_basis.inverted()
        for side, s, phase in (("Left", 1, 0.0), ("Right", -1, math.pi)):
            a = ca + phase
            pedal = BB + Vector((-math.sin(a) * CRANK, s * 0.12, -math.cos(a) * CRANK))
            ankle = to_arm @ (pedal + Vector((-0.045, 0, 0.075)))
            hip = rig.pose.bones[P + side + "UpLeg"].head
            two_bone(rig, side + "UpLeg", side + "Leg", side + "Foot", ankle, hip + Vector((s * 0.08, -1.0, 0.1)))
            # foot roughly along the pedal, toes dipping through the bottom of the stroke
            toe = math.radians(-12 - 10 * math.cos(a))
            fwd = to_arm.to_3x3() @ Vector((math.cos(toe), 0, math.sin(toe)))
            aim_bone(rig, side + "Foot", side + "ToeBase", fwd)
        key_bones(rig, names + legs, f)
    for m in deform:
        m.show_viewport = True
    for ob in [root, frame, crank] + wheels + [o for o in coll.objects if o.parent in (rig, root) or o == rig]:
        ob.hide_render = False
        ob.keyframe_insert("hide_render", frame=int(T_GONE * FPS))
        ob.hide_render = True
        ob.keyframe_insert("hide_render", frame=int(T_GONE * FPS) + 1)
    for ob in [root, crank, rig] + wheels:
        if ob.animation_data and ob.animation_data.action:
            for fc in ob.animation_data.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'
    return root
