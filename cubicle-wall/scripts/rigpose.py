"""Simple FK pose system for the MPFB 'mixamo' skeleton.

A pose is a dict  short_bone_name -> spec, where spec is either
  ("rot", (x, y, z))   extra rotation in degrees, armature axes (character faces -Y, its left is +X):
                        +X bends torso/head forward and swings limbs backward, +Z turns left, +Y leans left
  ("aim", (dx, dy, dz)) point the bone along this armature-space direction (swing only)
Bones not mentioned keep their parent-relative rest orientation.
"""
import math

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

P = "mixamorig:"
ORDER = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head",
         "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
         "RightShoulder", "RightArm", "RightForeArm", "RightHand",
         "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase",
         "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase"]


def mirror(pose):
    """Left/right mirror of a pose (X axis flip)."""
    out = {}
    for k, (kind, v) in pose.items():
        k2 = k.replace("Left", "TMP").replace("Right", "Left").replace("TMP", "Right")
        if kind == "aim":
            out[k2] = (kind, (-v[0], v[1], v[2]))
        else:
            out[k2] = (kind, (v[0], -v[1], -v[2]))
    return out


def blend(p1, p2, t):
    """Linear blend of two pose dicts (rot by angle, aim by direction)."""
    out = {}
    for k in set(p1) | set(p2):
        a = p1.get(k); b = p2.get(k)
        if a is None:
            a = (b[0], (0, 0, 0)) if b[0] == "rot" else None
        if b is None:
            b = (a[0], (0, 0, 0)) if a[0] == "rot" else None
        if a is None or b is None or a[0] != b[0]:
            out[k] = (b or a)
            continue
        v = tuple(x + (y - x) * t for x, y in zip(a[1], b[1]))
        out[k] = (a[0], v)
    return out


def solve(rig, pose):
    """Return {bone: basis quaternion} and {bone: posed armature-space 4x4 matrix}."""
    bones = rig.data.bones
    posed, basis = {}, {}
    for short in ORDER + [b.name[len(P):] for b in bones if b.name[len(P):] not in ORDER]:
        name = P + short
        if name not in bones:
            continue
        b = bones[name]
        rest = b.matrix_local
        if b.parent is None:
            M0 = rest.copy()
        else:
            M0 = posed[b.parent.name] @ (b.parent.matrix_local.inverted() @ rest)
        spec = pose.get(short)
        S = Quaternion()
        if spec:
            kind, v = spec
            if kind == "rot":
                S = Euler([math.radians(x) for x in v], "XYZ").to_quaternion()
            else:
                cur = (M0.to_3x3() @ Vector((0, 1, 0))).normalized()
                S = cur.rotation_difference(Vector(v).normalized())
        q0 = M0.to_quaternion()
        bq = q0.inverted() @ S @ q0
        basis[name] = bq
        R = (S.to_matrix() @ M0.to_3x3()).to_4x4()
        R.translation = M0.translation
        posed[name] = R
    return basis, posed


def apply(rig, pose, frame=None, keys=True):
    basis, posed = solve(rig, pose)
    for name, q in basis.items():
        pb = rig.pose.bones[name]
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = q
        if keys and frame is not None:
            pb.keyframe_insert("rotation_quaternion", frame=frame, group=name)
    return posed


def bone_point(rig, posed, short, at="head", obj_matrix=None):
    m = posed[P + short]
    b = rig.data.bones[P + short]
    p = m.translation if at == "head" else m @ Vector((0, b.length, 0))
    om = obj_matrix if obj_matrix is not None else rig.matrix_world
    return om @ p
