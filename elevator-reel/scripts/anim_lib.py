"""Animation helpers: Actor (IK posing / face units), cameras+markers, prop sockets."""
import bpy, math, random
from mathutils import Vector, Matrix, Euler, Quaternion
import lib
import mh_common as mc

FPS = 30


def F(t):
    """seconds -> frame (frame 1 == t 0)."""
    return int(round(t * FPS)) + 1


def set_curve_interp(idblock, data_path_prefix, interp, index=None):
    for fc in lib.fcurves_of(idblock):
        if fc.data_path.startswith(data_path_prefix) and (index is None or fc.array_index == index):
            for kp in fc.keyframe_points:
                kp.interpolation = interp


class Actor:
    def __init__(self, rig):
        self.rig = rig
        self.pb = rig.pose.bones
        self.units = set()
        for e in mc.ARKIT_EXPRESSIONS.values():
            self.units |= set(e.keys())
        self.units |= {"eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "eyeLookInLeft", "eyeLookOutRight",
                       "eyeLookOutLeft", "eyeLookInRight", "eyeLookUpLeft", "eyeLookUpRight", "eyeLookDownLeft",
                       "eyeLookDownRight", "mouthPucker"}
        self.owners = {u: mc.face_key_owners(rig, u) for u in self.units}
        # hands: follow forearm; feet keep COPY_ROTATION
        for side in ("l", "r"):
            c = self.pb["hand_" + side].constraints.get("IK_hand_rot")
            if c:
                c.influence = 0.0
        for b in self.pb:
            b.rotation_mode = 'XYZ'
        self.cur_expr = {}

    # ------------------------------------------------ placement (object level)
    def place(self, f, loc, rz=0.0, constant=True):
        self.rig.location = loc
        self.rig.rotation_euler = (0, 0, math.radians(rz))
        self.rig.keyframe_insert("location", frame=f)
        self.rig.keyframe_insert("rotation_euler", frame=f)
        for fc in lib.fcurves_of(self.rig):
            if fc.data_path in ("location", "rotation_euler"):
                for kp in fc.keyframe_points:
                    if abs(kp.co.x - f) < 0.01:
                        kp.interpolation = 'CONSTANT' if constant else 'BEZIER'

    def world_to_arm(self, p, loc, rz):
        M = Matrix.Translation(loc) @ Euler((0, 0, math.radians(rz))).to_matrix().to_4x4()
        return M.inverted() @ Vector(p)

    def arm_to_world(self, p, loc, rz):
        M = Matrix.Translation(loc) @ Euler((0, 0, math.radians(rz))).to_matrix().to_4x4()
        return M @ Vector(p)

    # ------------------------------------------------ IK targets (armature space)
    def ik(self, f, bone, pos, interp=None):
        b = self.pb[bone]
        M = self.rig.data.bones[bone].matrix_local
        R = M.to_3x3()
        loc_local = R.inverted() @ (Vector(pos) - M.to_translation())
        b.location = loc_local
        b.keyframe_insert("location", frame=f)
        if interp:
            for fc in lib.fcurves_of(self.rig):
                if fc.data_path == f'pose.bones["{bone}"].location':
                    for kp in fc.keyframe_points:
                        if abs(kp.co.x - f) < 0.01:
                            kp.interpolation = interp

    def hands(self, f, l=None, r=None, el=None, er=None, interp=None):
        if l is not None:
            self.ik(f, "IK_hand_l", l, interp)
        if r is not None:
            self.ik(f, "IK_hand_r", r, interp)
        if el is not None:
            self.ik(f, "IK_elbow_l", el, interp)
        if er is not None:
            self.ik(f, "IK_elbow_r", er, interp)

    def rest_hands(self, f):
        # relaxed arms hanging at sides
        self.hands(f, l=(0.27, -0.05, 0.86), r=(-0.27, -0.05, 0.86), el=(0.35, 0.3, 1.1), er=(-0.35, 0.3, 1.1))

    def feet(self, f, l=(0.201, -0.017, 0.075), r=(-0.201, -0.017, 0.075)):
        self.ik(f, "IK_foot_l", l)
        self.ik(f, "IK_foot_r", r)
        self.ik(f, "IK_knee_l", (0.17, -0.5, 0.52))
        self.ik(f, "IK_knee_r", (-0.17, -0.5, 0.52))

    # ------------------------------------------------ FK
    def rot(self, f, bone, x=0.0, y=0.0, z=0.0):
        b = self.pb[bone]
        b.rotation_euler = (math.radians(x), math.radians(y), math.radians(z))
        b.keyframe_insert("rotation_euler", frame=f)

    def spine(self, f, bend=0.0, twist=0.0, side=0.0):
        for bn, w in (("spine_01", 0.3), ("spine_02", 0.35), ("spine_03", 0.35)):
            self.rot(f, bn, bend * w, twist * w, side * w)

    def head(self, f, pitch=0.0, yaw=0.0, roll=0.0):
        self.rot(f, "neck_01", pitch * 0.4, yaw * 0.4, roll * 0.4)
        self.rot(f, "head", pitch * 0.6, yaw * 0.6, roll * 0.6)

    def pelvis(self, f, offset=(0, 0, 0), bend=0.0):
        b = self.pb["pelvis"]
        M = self.rig.data.bones["pelvis"].matrix_local
        b.location = M.to_3x3().inverted() @ Vector(offset)
        b.keyframe_insert("location", frame=f)
        b.rotation_euler = (math.radians(bend), 0, 0)
        b.keyframe_insert("rotation_euler", frame=f)

    def clav(self, f, side, up=0.0, fwd=0.0):
        self.rot(f, f"clavicle_{side}", 0, fwd, up if side == "l" else -up)

    def wrist(self, f, side, x=0.0, y=0.0, z=0.0):
        self.rot(f, f"hand_{side}", x, y, z)

    def fingers(self, f, side, curl=0.0, thumb=None, spread=0.0):
        """curl in degrees per joint (positive = close)."""
        for fn in ("index", "middle", "ring", "pinky"):
            for j, w in (("01", 0.8), ("02", 1.0), ("03", 0.8)):
                self.rot(f, f"{fn}_{j}_{side}", curl * w, 0, 0)
        t = curl * 0.4 if thumb is None else thumb
        for j in ("02", "03"):
            self.rot(f, f"thumb_{j}_{side}", t, 0, 0)

    # ------------------------------------------------ face
    def face(self, f, expr="neutral", w=1.0, extra=None):
        ex = dict(mc.ARKIT_EXPRESSIONS.get(expr, {}))
        if extra:
            ex.update(extra)
        for u in self.units:
            v = ex.get(u, 0.0) * w
            for o, kb in self.owners[u]:
                kb.value = v
                kb.keyframe_insert("value", frame=f)
        self.cur_expr = ex

    def blink(self, f):
        base_l = self.cur_expr.get("eyeBlinkLeft", 0.0)
        base_r = self.cur_expr.get("eyeBlinkRight", 0.0)
        for u, base in (("eyeBlinkLeft", base_l), ("eyeBlinkRight", base_r)):
            for o, kb in self.owners[u]:
                for ff, v in ((f - 1, base), (f + 1, 1.0), (f + 3, 1.0), (f + 5, base)):
                    kb.value = v
                    kb.keyframe_insert("value", frame=ff)


# ---------------------------------------------------------------- cameras
def make_cam(name, loc, target, lens, f0, scene, coll, roll=0.0):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_start = 0.02
    cd.clip_end = 80
    cd.sensor_fit = 'VERTICAL' if False else 'AUTO'
    cam = bpy.data.objects.new(name, cd)
    coll.objects.link(cam)
    aim(cam, loc, target, roll)
    m = scene.timeline_markers.new(name, frame=f0)
    m.camera = cam
    return cam


def aim(cam, loc, target, roll=0.0):
    cam.location = Vector(loc)
    d = Vector(target) - Vector(loc)
    q = d.to_track_quat('-Z', 'Y')
    e = q.to_euler()
    if roll:
        e = (q @ Quaternion((0, 0, 1), math.radians(roll))).to_euler()
    cam.rotation_euler = e


def cam_key(cam, f, loc=None, target=None, lens=None, roll=0.0):
    if loc is not None and target is not None:
        aim(cam, loc, target, roll)
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)
    if lens is not None:
        cam.data.lens = lens
        cam.data.keyframe_insert("lens", frame=f)


def cam_move(cam, f0, f1, loc0, tgt0, loc1, tgt1, lens0=None, lens1=None, interp='BEZIER'):
    cam_key(cam, f0, loc0, tgt0, lens0)
    cam_key(cam, f1, loc1, tgt1, lens1)
    for fc in lib.fcurves_of(cam):
        for kp in fc.keyframe_points:
            kp.interpolation = interp
            kp.easing = 'EASE_IN_OUT'


def shake(cam, f0, f1, amp_deg=1.2, seed=0, decay=True, step=1):
    """Additive rotational shake: re-key existing rotation with offsets (cam must have constant rotation or keys)."""
    rng = random.Random(seed)
    base = {}
    bpy.context.scene.frame_set(f0)
    for f in range(f0, f1 + 1, step):
        bpy.context.scene.frame_set(f)
        e = cam.matrix_world.to_euler()
        k = 1.0 - (f - f0) / max(1, (f1 - f0)) if decay else 1.0
        a = math.radians(amp_deg) * k
        cam.rotation_euler = (e.x + rng.uniform(-a, a), e.y + rng.uniform(-a, a) * 0.5, e.z + rng.uniform(-a, a))
        cam.keyframe_insert("rotation_euler", frame=f)
    bpy.context.scene.frame_set(f1 + 1)
    e = cam.matrix_world.to_euler()
    cam.keyframe_insert("rotation_euler", frame=f1 + 1)


# ---------------------------------------------------------------- sockets / attachments
def socket(name, rig, bone, offset=(0, 0, 0), rot=(0, 0, 0), coll=None):
    e = bpy.data.objects.new(name, None)
    (coll or bpy.context.scene.collection).objects.link(e)
    e.parent = rig
    e.parent_type = 'BONE'
    e.parent_bone = bone
    e.location = offset  # relative to bone tail in bone space
    e.rotation_euler = [math.radians(a) for a in rot]
    e.empty_display_size = 0.05
    return e


def attach(obj, target, name):
    c = obj.constraints.new('COPY_TRANSFORMS')
    c.target = target
    c.name = name
    c.influence = 0.0
    return c


def key_infl(obj, cname, f, val):
    c = obj.constraints[cname]
    c.influence = val
    obj.keyframe_insert(f'constraints["{cname}"].influence', frame=f)
    for fc in lib.fcurves_of(obj):
        if fc.data_path == f'constraints["{cname}"].influence':
            for kp in fc.keyframe_points:
                kp.interpolation = 'CONSTANT'


def key_obj(obj, f, loc=None, rot=None, scale=None, interp=None):
    if loc is not None:
        obj.location = loc
        obj.keyframe_insert("location", frame=f)
    if rot is not None:
        obj.rotation_euler = [math.radians(a) for a in rot]
        obj.keyframe_insert("rotation_euler", frame=f)
    if scale is not None:
        obj.scale = scale if hasattr(scale, "__len__") else (scale,) * 3
        obj.keyframe_insert("scale", frame=f)
    for fc in lib.fcurves_of(obj):
        if fc.data_path in ("location", "rotation_euler", "scale"):
            for kp in fc.keyframe_points:
                if abs(kp.co.x - f) < 0.01:
                    kp.interpolation = interp or 'BEZIER'


def key_node_value(mat, node_name, f, val):
    n = mat.node_tree.nodes[node_name]
    n.outputs[0].default_value = val
    n.outputs[0].keyframe_insert("default_value", frame=f)


def show_only(objs, f0, f1):
    for o in objs:
        lib.visible_between(o, f0, f1)
