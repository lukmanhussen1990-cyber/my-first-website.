"""Posing helpers for the MPFB 'default' (MakeHuman) rig.

All rotations are given in the character's REST armature frame
(+X = character's left, -Y = forward, +Z = up) and are applied relative
to the parent bone, so they compose like normal FK.
"""
import bpy
import math
from mathutils import Euler, Quaternion, Matrix, Vector

D2R = math.pi / 180.0


def _rest3(pb):
    return pb.bone.matrix_local.to_3x3()


def q_axis(axis, deg):
    return Quaternion(Vector(axis).normalized(), deg * D2R)


def q_euler(x=0.0, y=0.0, z=0.0):
    return Euler((x * D2R, y * D2R, z * D2R), 'XYZ').to_quaternion()


def to_local(pb, q_arm):
    B = _rest3(pb)
    return (B.inverted() @ q_arm.to_matrix() @ B).to_quaternion()


class Rig:
    def __init__(self, rig_obj):
        self.obj = rig_obj
        self.pb = rig_obj.pose.bones
        for pb in self.pb:
            pb.rotation_mode = 'QUATERNION'
        self.body = next(c for c in rig_obj.children if c.name.endswith(".body"))
        self.meshes = [c for c in rig_obj.children if c.type == 'MESH']
        self._last_q = {}
        b = rig_obj.data.bones
        self.rest = {}
        for side, sgn in (("L", 1), ("R", -1)):
            u = (b[f"upperarm02.{side}"].tail_local - b[f"upperarm01.{side}"].head_local)
            f = (b[f"lowerarm02.{side}"].tail_local - b[f"lowerarm01.{side}"].head_local)
            self.rest[f"abd_{side}"] = math.degrees(math.atan2(abs(u.x), -u.z))
            self.rest[f"udir_{side}"] = u.normalized()
            h = u.cross(f).normalized()
            self.rest[f"hinge_{side}"] = h
            self.rest[f"elbow_{side}"] = math.degrees(u.angle(f))
        self.keyed = set()

    # ------------------------------------------------------------------ basic
    def set_q(self, name, q_arm):
        pb = self.pb[name]
        pb.rotation_quaternion = to_local(pb, q_arm)
        self.keyed.add(name)

    def reset(self):
        for pb in self.pb:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)
        for kb in self.body.data.shape_keys.key_blocks:
            if kb.name.startswith("fu_"):
                kb.value = 0.0

    # ----------------------------------------------------------------- limbs
    def arm(self, side, side_deg=10, fwd=0, twist=0, elbow=10, wrist=(0, 0, 0), clav=(0, 0, 0)):
        """side_deg: abduction from hanging down (90 = T-pose). fwd: forward swing.
        twist: rotation about the upper arm axis. elbow: elbow flexion (0 = straight)."""
        s = 1 if side == "L" else -1
        rest_abd = self.rest[f"abd_{side}"]
        q = q_euler(x=-fwd) @ q_euler(y=s * (rest_abd - side_deg)) @ q_axis(self.rest[f"udir_{side}"], s * twist)
        self.set_q(f"upperarm01.{side}", q)
        e = q_axis(self.rest[f"hinge_{side}"], elbow - self.rest[f"elbow_{side}"])
        self.set_q(f"lowerarm01.{side}", e)
        self.set_q(f"wrist.{side}", q_euler(wrist[0], s * wrist[1], s * wrist[2]))
        self.set_q(f"clavicle.{side}", q_euler(clav[0], s * clav[1], s * clav[2]))

    def leg(self, side, flex=0, abd=0, twist=0, knee=0, ankle=0):
        s = 1 if side == "L" else -1
        q = q_euler(x=-flex) @ q_euler(y=-s * abd) @ q_euler(z=s * twist)
        self.set_q(f"upperleg01.{side}", q)
        self.set_q(f"lowerleg01.{side}", q_euler(x=knee))
        self.set_q(f"foot.{side}", q_euler(x=-ankle))

    def spine(self, bend=0, side=0, twist=0, lower=None):
        """Distribute a forward bend / side bend / twist over spine04..spine01.
        lower: bend at spine05 (hips) separately."""
        names = ["spine04", "spine03", "spine02", "spine01"]
        for n in names:
            self.set_q(n, q_euler(bend / 4.0, side / 4.0, twist / 4.0))
        self.set_q("spine05", q_euler(lower or 0, 0, 0))

    def head(self, nod=0, turn=0, tilt=0):
        for n in ("neck01", "neck02", "neck03"):
            self.set_q(n, q_euler(nod * 0.15, tilt * 0.15, turn * 0.15))
        self.set_q("head", q_euler(nod * 0.55, tilt * 0.55, turn * 0.55))

    def root(self, loc=(0, 0, 0), rot=(0, 0, 0)):
        pb = self.pb["root"]
        B = _rest3(pb)
        pb.location = B.inverted() @ Vector(loc)
        pb.rotation_quaternion = to_local(pb, q_euler(*rot))
        self.keyed.add("root")

    def fingers(self, side, curl=0.0, thumb=None, spread=0.0):
        """curl 0..1 (fist = 1)."""
        thumb = curl if thumb is None else thumb
        for i in range(2, 6):
            for j in range(1, 4):
                n = f"finger{i}-{j}.{side}"
                if n not in self.pb:
                    continue
                pb = self.pb[n]
                ang = curl * (55 if j == 1 else 75 if j == 2 else 55)
                pb.rotation_quaternion = Quaternion((1, 0, 0), ang * D2R)
                self.keyed.add(n)
        for j in range(1, 4):
            n = f"finger1-{j}.{side}"
            if n in self.pb:
                pb = self.pb[n]
                pb.rotation_quaternion = Quaternion((1, 0, 0), thumb * (20 if j == 1 else 35) * D2R)
                self.keyed.add(n)

    def jaw(self, deg):
        pb = self.pb["jaw"]
        pb.rotation_quaternion = Quaternion((1, 0, 0), deg * D2R)
        self.keyed.add("jaw")

    def face(self, **units):
        kbs = self.body.data.shape_keys.key_blocks
        for k, v in units.items():
            kb = kbs.get("fu_" + k)
            if kb is not None:
                kb.value = v

    # -------------------------------------------------------------- keyframes
    def key(self, frame, interp=None):
        for name in list(self.keyed):
            pb = self.pb[name]
            q = pb.rotation_quaternion.copy()
            last = self._last_q.get(name)
            if last is not None and last.dot(q) < 0:
                q.negate()
                pb.rotation_quaternion = q
            self._last_q[name] = q.copy()
            pb.keyframe_insert("rotation_quaternion", frame=frame)
            if name == "root":
                pb.keyframe_insert("location", frame=frame)
        for kb in self.body.data.shape_keys.key_blocks:
            if kb.name.startswith("fu_"):
                kb.keyframe_insert("value", frame=frame)
        if interp:
            set_interp(self.obj, frame, interp)
            if self.body.data.shape_keys.animation_data:
                for fc in self.body.data.shape_keys.animation_data.action.fcurves:
                    for kp in fc.keyframe_points:
                        if abs(kp.co.x - frame) < 0.01:
                            kp.interpolation = interp

    def place(self, frame, loc=None, yaw=None, interp=None):
        if loc is not None:
            self.obj.location = loc
            self.obj.keyframe_insert("location", frame=frame)
        if yaw is not None:
            self.obj.rotation_euler = (0, 0, yaw * D2R)
            self.obj.keyframe_insert("rotation_euler", frame=frame)
        if interp:
            set_interp(self.obj, frame, interp)

    def wet(self, frame, value):
        for m in self.meshes:
            if "wet" in m.keys():
                m["wet"] = value
                m.keyframe_insert('["wet"]', frame=frame)


def set_interp(obj, frame, interp):
    ad = obj.animation_data
    if not ad or not ad.action:
        return
    for fc in ad.action.fcurves:
        for kp in fc.keyframe_points:
            if abs(kp.co.x - frame) < 0.01:
                kp.interpolation = interp


def apply_pose(rig, pose):
    """pose: dict produced by the pose library (see poses.py)."""
    rig.reset()
    rig.spine(**pose.get("spine", {}))
    rig.head(**pose.get("head", {}))
    rig.arm("L", **pose.get("armL", {}))
    rig.arm("R", **pose.get("armR", {}))
    rig.leg("L", **pose.get("legL", {}))
    rig.leg("R", **pose.get("legR", {}))
    rig.root(**pose.get("root", {}))
    rig.fingers("L", **pose.get("fingL", {"curl": 0.25}))
    rig.fingers("R", **pose.get("fingR", {"curl": 0.25}))
    rig.jaw(pose.get("jaw", 0))
    rig.face(**pose.get("face", {}))


def blend_pose(a, b, t):
    """Linear blend of two pose dicts (numbers and tuples)."""
    out = {}
    for k in set(a) | set(b):
        va, vb = a.get(k), b.get(k)
        if va is None:
            out[k] = vb
        elif vb is None:
            out[k] = va
        elif isinstance(va, dict):
            out[k] = blend_pose(va, vb, t)
        elif isinstance(va, (tuple, list)):
            out[k] = tuple(x + (y - x) * t for x, y in zip(va, vb))
        else:
            out[k] = va + (vb - va) * t
    return out
