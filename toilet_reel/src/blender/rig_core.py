"""Python-side skeleton: FK, analytic 2-bone IK, and writing poses to Blender.

Conventions (bone local axes, from the build script's roll setup):
  spine / neck / head : +X pitch forward(nod down), +Z lean to character's right, +Y turn left
  arms (FK)           : +X flexes (elbow bends forward), +Z/-Z swing
  fingers             : +X curls into the palm
  legs                : IK only (knee pole forward)
Everything here works in armature space (= world, the armature object stays at the origin).
"""
import math
from mathutils import Matrix, Vector, Quaternion, Euler


def qeuler(x=0.0, y=0.0, z=0.0, deg=True):
    if deg:
        x, y, z = math.radians(x), math.radians(y), math.radians(z)
    return Euler((x, y, z), 'XYZ').to_quaternion()


class Skeleton:
    def __init__(self, rig):
        self.rig = rig
        self.rest = {}
        self.parent = {}
        self.order = []
        bones = rig.data.bones
        for b in bones:
            self.rest[b.name] = b.matrix_local.copy()
            self.parent[b.name] = b.parent.name if b.parent else None
        seen = set()

        def visit(b):
            if b.name in seen:
                return
            if b.parent:
                visit(b.parent)
            seen.add(b.name)
            self.order.append(b.name)
        for b in bones:
            visit(b)
        self.length = {b.name: b.length for b in bones}
        # rest offset of each bone relative to its parent's rest frame
        self.offset = {}
        for n in self.order:
            p = self.parent[n]
            self.offset[n] = (self.rest[p].inverted() @ self.rest[n]) if p else self.rest[n].copy()
        self.reset()

    def reset(self):
        self.rot = {}      # local rotation quaternions (FK)
        self.loc = {}      # local translations
        self.target = {}   # desired armature-space matrices (overrides FK)
        self.M = {}

    # ---------------------------------------------------------------- FK
    def solve(self, upto=None):
        """compute armature-space matrices for all bones (or until `upto` is done)."""
        for n in self.order:
            if n in self.M:
                continue
            p = self.parent[n]
            base = (self.M[p] @ self.offset[n]) if p else self.offset[n]
            if n in self.target:
                self.M[n] = self.target[n]
            else:
                basis = Matrix.Translation(self.loc.get(n, Vector())) @ self.rot.get(n, Quaternion()).to_matrix().to_4x4()
                self.M[n] = base @ basis
            if upto is not None and n == upto:
                return

    def base_of(self, n):
        """armature-space matrix the bone would have with identity basis (parent must be solved)."""
        p = self.parent[n]
        if p and p not in self.M:
            self.solve(upto=p)
        return (self.M[p] @ self.offset[n]) if p else self.offset[n]

    def head_pos(self, n):
        return self.base_of(n).to_translation()

    def world(self, n):
        if n not in self.M:
            self.solve(upto=n)
        return self.M[n]

    def invalidate(self):
        self.M = {}

    # ---------------------------------------------------------------- IK
    def two_bone(self, b1, b2, target, pole, flip=False):
        """place b1,b2 so b2's tail reaches target; bend plane through pole.

        flip=False: flexion axis = cross(y1, y2) (arms: elbow bends towards bone +Z)
        flip=True : flexion axis = -cross(y1, y2) (legs: knee bends towards bone -Z)
        """
        S = self.head_pos(b1)
        l1, l2 = self.length[b1], self.length[b2]
        T = Vector(target)
        dv = T - S
        d = dv.length
        d = max(min(d, (l1 + l2) * 0.9992), abs(l1 - l2) + 1e-4)
        u = dv.normalized()
        pv = Vector(pole) - S
        v = (pv - u * pv.dot(u))
        if v.length < 1e-6:
            v = Vector((0, -1, 0)) - u * u.y
        v.normalize()
        ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
        a = math.acos(max(-1.0, min(1.0, ca)))
        E = S + (u * math.cos(a) + v * math.sin(a)) * l1
        Tc = S + u * d
        y1 = (E - S).normalized()
        y2 = (Tc - E).normalized()
        x = y1.cross(y2)
        if x.length < 1e-6:
            x = u.cross(v)
        x.normalize()
        if flip:
            x = -x
        M1 = Matrix((x, y1, x.cross(y1))).transposed().to_4x4()
        M1.translation = S
        M2 = Matrix((x, y2, x.cross(y2))).transposed().to_4x4()
        M2.translation = E
        self.target[b1] = M1
        self.target[b2] = M2
        return E, Tc

    def aim(self, name, direction, up_hint):
        """orient a bone so its Y axis points along direction (world), Z near up_hint."""
        S = self.head_pos(name)
        y = Vector(direction).normalized()
        z = Vector(up_hint)
        z = (z - y * z.dot(y)).normalized()
        x = y.cross(z)
        M = Matrix((x, y, z)).transposed().to_4x4()
        M.translation = S
        self.target[name] = M

    def set_world_rot(self, name, R3, pos=None):
        M = R3.to_4x4()
        M.translation = self.head_pos(name) if pos is None else Vector(pos)
        self.target[name] = M

    # ---------------------------------------------------------------- write to blender
    def apply(self):
        self.M = {}            # full re-solve: FK values may have changed after IK queries
        self.solve()
        pbs = self.rig.pose.bones
        for n in self.order:
            p = self.parent[n]
            base = (self.M[p] @ self.offset[n]) if p else self.offset[n]
            basis = base.inverted() @ self.M[n]
            pb = pbs[n]
            loc, rot, _ = basis.decompose()
            pb.location = loc
            pb.rotation_quaternion = rot
            pb.scale = (1, 1, 1)
