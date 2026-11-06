"""Rooster and fox: ready-made rigged Sketchfab models posed with simple FK keyframes.

The models' own clips are an idle (rooster) and a mixed clip (fox), so walking, pecking, flapping, sitting and
trotting are keyed here on their bones. A pose is {bone: (rx, ry, rz)} in degrees, in the creature frame
(creature faces -Y, its left is +X, up is +Z): +X swings a hanging limb backwards / tips a raised neck forwards.
"""
import math

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

from scenelib import iter_fcurves


def _depth(b):
    d = 0
    while b.parent:
        d += 1
        b = b.parent
    return d


def import_creature(path, name, size, axis, coll, front_yaw=0.0):
    """Import a rigged glTF under an empty `name` (bottom centre, real size), drop stray helper meshes,
    clear the bundled clip and put every bone in its rest pose."""
    before = set(bpy.data.objects)
    acts = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for a in list(bpy.data.actions):          # the bundled clips are not used (poses are keyed here)
        if a not in acts:
            bpy.data.actions.remove(a)
    for o in list(new):
        if o.type == "MESH" and o.name.startswith("Icosphere"):
            new.remove(o)
            bpy.data.objects.remove(o)
    arm = next(o for o in new if o.type == "ARMATURE")
    if arm.animation_data:
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in new:
        if o.type == "MESH":
            oe = o.evaluated_get(dg)
            me = oe.to_mesh()
            pts += [oe.matrix_world @ v.co for v in me.vertices]
            oe.to_mesh_clear()
    mn = Vector([min(p[i] for p in pts) for i in range(3)])
    mx = Vector([max(p[i] for p in pts) for i in range(3)])
    ext = mx - mn
    s = size / {"x": ext.x, "y": ext.y, "z": ext.z, "max": max(ext)}[axis]
    root = bpy.data.objects.new(name, None)
    coll.objects.link(root)
    bc = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
        if o.parent is None:
            o.parent = root
            o.location = o.location - bc
        if o.type == "MESH":
            o.name = f"{name}__{o.name}"
    root.scale = (s, s, s)
    root.rotation_mode = "XYZ"
    root["size"] = [ext.x * s, ext.y * s, ext.z * s]
    root["front_yaw"] = front_yaw
    bpy.context.view_layer.update()
    return root, arm


class Creature:
    def __init__(self, root, arm, front_yaw=0.0):
        self.root, self.arm, self.front_yaw = root, arm, front_yaw
        self.meshes = [o for o in root.children_recursive if o.type == "MESH"]
        self.objs = [root] + list(root.children_recursive)
        saved = root.matrix_world.copy()
        root.location = (0, 0, 0)
        root.rotation_euler = (0, 0, front_yaw)
        bpy.context.view_layer.update()
        self.A = arm.matrix_world.to_quaternion().normalized()      # armature space -> creature frame
        self.Ainv = self.A.inverted()
        self.arm_M = arm.matrix_world.copy()                        # armature -> world with root at origin, facing -Y
        self.root_M_inv = root.matrix_world.inverted()
        root.matrix_world = saved
        self.order = sorted(arm.data.bones, key=_depth)
        self.base_scale = root.scale.copy()

    def solve(self, pose):
        posed, basis = {}, {}
        for b in self.order:
            rest = b.matrix_local
            if b.parent is None:
                M0 = rest.copy()
            else:
                M0 = posed[b.parent.name] @ (b.parent.matrix_local.inverted() @ rest)
            v = pose.get(b.name)
            S = Quaternion()
            if v:
                S = self.Ainv @ Euler([math.radians(x) for x in v], "XYZ").to_quaternion() @ self.A
            q0 = M0.to_quaternion()
            basis[b.name] = q0.inverted() @ S @ q0
            R = (S.to_matrix() @ M0.to_3x3()).to_4x4()
            R.translation = M0.translation
            posed[b.name] = R
        return basis, posed

    def point(self, posed, bone, loc, yaw, at="head", tilt=0.0, offset=None):
        """World position of a bone's head/tail for a pose placed at loc/yaw (creature frame -> world)."""
        b = self.arm.data.bones[bone]
        m = posed[bone]
        p = m.translation if at == "head" else m @ Vector((0, b.length, 0))
        if offset is not None:
            p = m @ offset
        local = self.arm_M @ p                       # creature frame, root at origin
        W = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Rotation(tilt, 4, "X")
        return W @ local

    def key(self, f, pose, loc, yaw, tilt=0.0, roll=0.0, z=None, scale=None):
        """Key a pose at loc (x, y[, z]) facing yaw (world, 0 = -Y). tilt pitches the whole body (+ = nose down)."""
        loc = Vector((loc[0], loc[1], loc[2] if len(loc) > 2 else 0.0))
        if z is not None:
            loc.z = z
        basis, posed = self.solve(pose)
        self.root.location = loc
        self.root.rotation_euler = (Matrix.Rotation(yaw, 4, "Z") @ Matrix.Rotation(tilt, 4, "X") @ Matrix.Rotation(roll, 4, "Y")
                                    @ Matrix.Rotation(self.front_yaw, 4, "Z")).to_euler("XYZ", self.root.rotation_euler)
        self.root.keyframe_insert("location", frame=f)
        self.root.keyframe_insert("rotation_euler", frame=f)
        scale = scale or (1.0, 1.0, 1.0)
        self.root.scale = Vector((self.base_scale.x * scale[0], self.base_scale.y * scale[1], self.base_scale.z * scale[2]))
        self.root.keyframe_insert("scale", frame=f)
        for name, q in basis.items():
            pb = self.arm.pose.bones[name]
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=f, group=name)
        return loc

    def path(self, f0, f1, p0, p1, cycle, step_frames=4, yaw=None, z0=0.0, z1=None, bob=0.0, tilt=0.0):
        """Move from p0 to p1 between f0..f1 cycling through `cycle` poses every step_frames frames."""
        p0 = Vector((p0[0], p0[1], z0))
        p1 = Vector((p1[0], p1[1], z0 if z1 is None else z1))
        if yaw is None:
            d = p1 - p0
            yaw = math.atan2(d.x, -d.y)
        n = max(1, int(round((f1 - f0) / step_frames)))
        for i in range(n + 1):
            t = i / n
            f = int(round(f0 + (f1 - f0) * t))
            p = p0.lerp(p1, t)
            p.z += bob * (1 if i % 2 else 0)
            self.key(f, cycle[i % len(cycle)], p, yaw, tilt=tilt)
        return yaw


def linear_root(creature, f0, f1):
    """Make root location keys between f0..f1 linear (steady travel) while pose keys stay smooth."""
    ad = creature.root.animation_data
    if not (ad and ad.action):
        return
    for fc in iter_fcurves(ad.action):
        if fc.data_path == "location":
            for k in fc.keyframe_points:
                if f0 <= k.co.x <= f1:
                    k.interpolation = "LINEAR"
