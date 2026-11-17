"""Shot framework: timing table, cameras, keyframe helpers, prop visibility, attachments."""
import bpy, math, random
from mathutils import Vector, Matrix, Euler, Quaternion
import rigtools
from rigtools import Rig, apply_pose, blend_pose

FPS = 30
# (shot id, start frame, end frame (exclusive)) on the global timeline, synced to the voiceover
SHOTS = [
    ("S01a", 0, 29), ("S01b", 29, 60), ("S02", 60, 114), ("S03", 114, 170), ("S04a", 170, 203),
    ("S04b", 203, 222), ("S05", 222, 279), ("S06", 279, 305), ("S07a", 305, 341), ("S07b", 341, 369),
    ("S07c", 369, 393), ("S08", 393, 476), ("S09", 476, 509), ("S10", 509, 560), ("S11a", 560, 594),
    ("S11b", 594, 620), ("S11c", 620, 639), ("S12", 639, 702), ("S13a", 702, 737), ("S13b", 737, 776),
    ("S14", 776, 885),
]
SHOT = {s: (a, b) for s, a, b in SHOTS}
BINOCULAR_SHOTS = {"S02", "S06", "S11c"}


def length(shot):
    a, b = SHOT[shot]
    return b - a


# ------------------------------------------------------------------ scene prep
def prep(shot):
    sc = bpy.context.scene
    sc.frame_start = 1
    sc.frame_end = length(shot)
    sc.render.fps = FPS
    for name in ("PROPS",):
        col = bpy.data.collections.get(name)
        if col:
            for ob in list(col.all_objects):
                ob.hide_render = True
    # characters visible
    for ob in list(bpy.data.collections["CHARS"].all_objects):
        ob.hide_render = False
    random.seed(hash(shot) % 1000)
    you = Rig(bpy.data.objects["YOU"])
    fr = Rig(bpy.data.objects["FRIEND"])
    for r in (you, fr):
        r.reset()
        r.obj.location = (0, 0, -30)
    return sc, you, fr


def show(obj_or_name, visible=True, frame=None, children=True):
    ob = bpy.data.objects[obj_or_name] if isinstance(obj_or_name, str) else obj_or_name
    obs = [ob] + (list(ob.children_recursive) if children else [])
    for o in obs:
        o.hide_render = not visible
        if frame is not None:
            o.keyframe_insert("hide_render", frame=frame)
            fc = o.animation_data.action.fcurves.find("hide_render")
            for kp in fc.keyframe_points:
                kp.interpolation = 'CONSTANT'


def hide_char(rig, hidden=True):
    for o in [rig.obj] + list(rig.obj.children_recursive):
        o.hide_render = hidden


# ------------------------------------------------------------------ camera
class Cam:
    def __init__(self, lens=35, name="ShotCam"):
        sc = bpy.context.scene
        self.data = bpy.data.cameras.new(name)
        self.data.lens = lens
        self.data.clip_start = 0.02
        self.data.clip_end = 600
        self.rig = bpy.data.objects.new(name + "_shake", None)   # shake parent
        sc.collection.objects.link(self.rig)
        self.obj = bpy.data.objects.new(name, self.data)
        sc.collection.objects.link(self.obj)
        self.obj.parent = self.rig
        self.tgt = bpy.data.objects.new(name + "_target", None)
        sc.collection.objects.link(self.tgt)
        con = self.obj.constraints.new('TRACK_TO')
        con.target = self.tgt
        con.track_axis = 'TRACK_NEGATIVE_Z'
        con.up_axis = 'UP_Y'
        self.roll_con = None
        sc.camera = self.obj

    def key(self, frame, loc, target, lens=None, interp=None, roll=None):
        self.obj.location = loc
        self.obj.keyframe_insert("location", frame=frame)
        self.tgt.location = target
        self.tgt.keyframe_insert("location", frame=frame)
        if lens is not None:
            self.data.lens = lens
            self.data.keyframe_insert("lens", frame=frame)
        if roll is not None:
            self.rig.rotation_euler = (0, 0, 0)
        if interp:
            for ob in (self.obj, self.tgt):
                rigtools.set_interp(ob, frame, interp)

    def shake(self, f0, dur=10, amp=0.06, rot_amp=1.8, seed=1):
        """decaying hand-held shake on the parent empty (location + rotation)"""
        r = random.Random(seed)
        ob = self.rig
        for i in range(dur + 1):
            f = f0 + i
            k = (1 - i / dur) ** 1.6
            ob.location = (r.uniform(-1, 1) * amp * k, r.uniform(-1, 1) * amp * k, r.uniform(-1, 1) * amp * k)
            ob.rotation_euler = (math.radians(r.uniform(-1, 1) * rot_amp * k), math.radians(r.uniform(-1, 1) * rot_amp * k),
                                 math.radians(r.uniform(-1, 1) * rot_amp * k))
            ob.keyframe_insert("location", frame=f)
            ob.keyframe_insert("rotation_euler", frame=f)
        ob.location = (0, 0, 0)
        ob.rotation_euler = (0, 0, 0)
        ob.keyframe_insert("location", frame=f0 - 1)
        ob.keyframe_insert("rotation_euler", frame=f0 - 1)

    def handheld(self, f0, f1, amp=0.006, seed=3):
        """subtle continuous hand-held drift (binocular POV)"""
        r = random.Random(seed)
        ob = self.rig
        for f in range(f0, f1 + 1, 4):
            ob.rotation_euler = (math.radians(r.uniform(-1, 1) * 0.35), 0, math.radians(r.uniform(-1, 1) * 0.35))
            ob.location = (r.uniform(-1, 1) * amp, 0, r.uniform(-1, 1) * amp)
            ob.keyframe_insert("rotation_euler", frame=f)
            ob.keyframe_insert("location", frame=f)


# ------------------------------------------------------------------ poses over time
def pose_keys(rig, keys, interp=None):
    """keys: list of (frame, pose_dict) ; poses applied + keyed in order"""
    for item in keys:
        f, pose = item[0], item[1]
        ip = item[2] if len(item) > 2 else interp
        apply_pose(rig, pose)
        rig.key(f, interp=ip)


def place_keys(rig, keys):
    """keys: list of (frame, (x,y,z), yaw_deg[, interp])"""
    for item in keys:
        f, loc, yaw = item[0], item[1], item[2]
        ip = item[3] if len(item) > 3 else None
        rig.place(f, loc=loc, yaw=yaw, interp=ip)


def walk_cycle(rig, f0, f1, start, end, stride_frames=8, base_pose=None, arm_swing=22, leg_swing=26,
               bob=0.03, tired=False):
    """keyframes a simple walk from start to end (world xy) between f0..f1."""
    import poses as P
    sx, sy = start[0], start[1]
    ex, ey = end[0], end[1]
    yaw = math.degrees(math.atan2(-(ex - sx), (ey - sy))) + 180.0
    # character faces -Y in rest; yaw so that -Y local points along travel dir
    d = Vector((ex - sx, ey - sy, 0))
    yaw = math.degrees(math.atan2(d.x, -d.y))
    rig.place(f0, loc=(sx, sy, 0), yaw=yaw)
    rig.place(f1, loc=(ex, ey, 0), yaw=yaw)
    rigtools.set_interp(rig.obj, f0, 'LINEAR')
    base = base_pose or P.STAND
    f = f0
    phase = 0
    while f <= f1:
        s = 1 if phase % 2 == 0 else -1
        pose = blend_pose(base, base, 0)
        pose["legL"] = dict(flex=leg_swing * s, abd=2, twist=0, knee=8 if s > 0 else 30, ankle=8 * s)
        pose["legR"] = dict(flex=-leg_swing * s, abd=2, twist=0, knee=30 if s > 0 else 8, ankle=-8 * s)
        aL = dict(base["armL"])
        aR = dict(base["armR"])
        aL["fwd"] = aL.get("fwd", 0) - arm_swing * s
        aR["fwd"] = aR.get("fwd", 0) + arm_swing * s
        pose["armL"], pose["armR"] = aL, aR
        rl = dict(base.get("root", {}))
        pose["root"] = dict(loc=(0, 0, rl.get("loc", (0, 0, 0))[2] - bob), rot=rl.get("rot", (0, 0, 0)))
        apply_pose(rig, pose)
        rig.key(f)
        # passing position (up)
        fm = f + stride_frames // 2
        if fm <= f1:
            pose2 = blend_pose(pose, pose, 0)
            pose2["legL"] = dict(flex=4, abd=2, twist=0, knee=18 if s > 0 else 40, ankle=0)
            pose2["legR"] = dict(flex=4, abd=2, twist=0, knee=40 if s > 0 else 18, ankle=0)
            pose2["armL"] = dict(base["armL"])
            pose2["armR"] = dict(base["armR"])
            pose2["root"] = dict(loc=(0, 0, rl.get("loc", (0, 0, 0))[2] + bob * 0.5), rot=rl.get("rot", (0, 0, 0)))
            apply_pose(rig, pose2)
            rig.key(fm)
        f += stride_frames
        phase += 1


# ------------------------------------------------------------------ attachments
def bone_world(rig, bone, frame=None):
    if frame is not None:
        bpy.context.scene.frame_set(frame)
    pb = rig.obj.pose.bones[bone]
    return rig.obj.matrix_world @ pb.matrix


def attach_to_bone(ob, rig, bone, offset=(0, 0, 0), rot=(0, 0, 0), f_on=None, f_off=None):
    """Child-Of style attachment via constraint with influence keys; offset in bone space."""
    con = ob.constraints.new('CHILD_OF')
    con.target = rig.obj
    con.subtarget = bone
    con.set_inverse_pending = False
    con.inverse_matrix = Matrix()
    ob.location = offset
    ob.rotation_euler = Euler([math.radians(a) for a in rot])
    if f_on is not None:
        con.influence = 0.0
        con.keyframe_insert("influence", frame=f_on - 1)
        con.influence = 1.0
        con.keyframe_insert("influence", frame=f_on)
    if f_off is not None:
        con.influence = 1.0
        con.keyframe_insert("influence", frame=f_off - 1)
        con.influence = 0.0
        con.keyframe_insert("influence", frame=f_off)
    if ob.animation_data and ob.animation_data.action:
        for fc in ob.animation_data.action.fcurves:
            if "influence" in fc.data_path:
                for kp in fc.keyframe_points:
                    kp.interpolation = 'CONSTANT'
    return con


def key_loc(ob, frame, loc, interp=None):
    ob.location = loc
    ob.keyframe_insert("location", frame=frame)
    if interp:
        rigtools.set_interp(ob, frame, interp)


def key_rot(ob, frame, rot_deg, interp=None):
    ob.rotation_euler = [math.radians(a) for a in rot_deg]
    ob.keyframe_insert("rotation_euler", frame=frame)
    if interp:
        rigtools.set_interp(ob, frame, interp)


def key_scale(ob, frame, s, interp=None):
    ob.scale = (s, s, s) if isinstance(s, (int, float)) else s
    ob.keyframe_insert("scale", frame=frame)
    if interp:
        rigtools.set_interp(ob, frame, interp)


def pop_in(ob, f, dur=4, overshoot=1.18):
    """fast-build pop: 0 -> overshoot -> 1"""
    key_scale(ob, f - 1, 0.001)
    key_scale(ob, f + max(1, dur // 2), overshoot)
    key_scale(ob, f + dur, 1.0)


def drop_in(ob, f, dur=5, height=1.2):
    """fast-build drop from above with a little bounce"""
    base = ob.location.copy()
    key_loc(ob, f - 1, base + Vector((0, 0, height)))
    key_loc(ob, f + dur, base, 'BOUNCE')
    key_loc(ob, f + dur + 1, base)
    show(ob, False, f - 2)
    show(ob, True, f - 1)


def ballistic(ob, f0, p0, p1, f1, apex=0.6, spin=None, step=1):
    """keyframe a parabolic flight from p0 (frame f0) to p1 (frame f1) with extra apex height."""
    p0, p1 = Vector(p0), Vector(p1)
    n = f1 - f0
    for i in range(0, n + 1, step):
        t = i / n
        p = p0.lerp(p1, t) + Vector((0, 0, 4 * apex * t * (1 - t)))
        key_loc(ob, f0 + i, p, 'LINEAR')
        if spin:
            key_rot(ob, f0 + i, (spin[0] * t, spin[1] * t, spin[2] * t), 'LINEAR')


def look_at_yaw(src, dst):
    d = Vector((dst[0] - src[0], dst[1] - src[1], 0))
    return math.degrees(math.atan2(d.x, -d.y))


def attach_rest(ob, rig, bone, rest_loc, rest_rot=(0, 0, 0), f_on=None, f_off=None):
    """Attach ob to a bone so that in the REST pose (armature at origin) it sits at rest_loc/rest_rot."""
    bl = rig.obj.data.bones[bone]
    M = Matrix.Translation(Vector(rest_loc)) @ Euler([math.radians(a) for a in rest_rot]).to_matrix().to_4x4()
    basis = bl.matrix_local.inverted() @ M
    con = ob.constraints.new('CHILD_OF')
    con.target = rig.obj
    con.subtarget = bone
    con.inverse_matrix = Matrix.Identity(4)
    ob.matrix_basis = basis
    ob.rotation_mode = 'XYZ'
    loc, rot, sca = basis.decompose()
    ob.location = loc
    ob.rotation_euler = rot.to_euler()
    con.influence = 1.0
    if f_on is not None or f_off is not None:
        if f_on is not None:
            con.influence = 0.0
            con.keyframe_insert("influence", frame=f_on - 1)
            con.influence = 1.0
            con.keyframe_insert("influence", frame=f_on)
        if f_off is not None:
            con.influence = 1.0
            con.keyframe_insert("influence", frame=f_off - 1)
            con.influence = 0.0
            con.keyframe_insert("influence", frame=f_off)
        for fc in ob.animation_data.action.fcurves:
            if "influence" in fc.data_path:
                for kp in fc.keyframe_points:
                    kp.interpolation = 'CONSTANT'
    return con, (loc.copy(), rot.to_euler())


def release(ob, offset, f_off, target, f_hit, apex=0.5, spin=(0, 0, 0), after=None):
    """After the rig is fully keyed: compute where the held object is at f_off-1 and keyframe a
    ballistic flight to `target` arriving at f_hit. offset = (loc, rot) returned by attach_rest."""
    sc = bpy.context.scene
    sc.frame_set(f_off - 1)
    p0 = ob.matrix_world.translation.copy()
    loc, rot = offset
    # hold the local offset until release
    ob.location = loc
    ob.rotation_euler = rot
    ob.keyframe_insert("location", frame=f_off - 1)
    ob.keyframe_insert("rotation_euler", frame=f_off - 1)
    rigtools.set_interp(ob, f_off - 1, 'CONSTANT')
    ballistic(ob, f_off, p0, target, f_hit, apex=apex, spin=spin)
    return p0


def head_point(rig, local, frame=None):
    """world position of a point given in the REST armature frame, carried by the head bone"""
    if frame is not None:
        bpy.context.scene.frame_set(frame)
    bl = rig.obj.data.bones["head"]
    pb = rig.obj.pose.bones["head"]
    return rig.obj.matrix_world @ pb.matrix @ bl.matrix_local.inverted() @ Vector(local)


EYE_REST = (0.0, -0.105, 1.625)    # approx. mid-eye point in the rest armature frame


def ground_lock(rig, f0, f1, ground=0.0, only_down=False):
    """Keep the lowest shoe vertex on the ground for every frame f0..f1 by keying the root bone height."""
    sc = bpy.context.scene
    shoe = bpy.data.objects[f"{rig.obj.name}.shoes04"]
    pb = rig.obj.pose.bones["root"]
    Binv = pb.bone.matrix_local.to_3x3().inverted()
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = shoe.evaluated_get(dg)
        me = ev.to_mesh()
        zmin = min((ev.matrix_world @ v.co).z for v in me.vertices)
        ev.to_mesh_clear()
        dz = ground - zmin
        if only_down and dz > 0:
            dz = 0.0
        pb.location = pb.location + Binv @ Vector((0, 0, dz))
        pb.keyframe_insert("location", frame=f)
