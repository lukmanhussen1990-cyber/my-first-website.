"""Bedrock geometry / bone math used for previews and for solving hold poses.

All math happens in Blockbench's internal right-handed frame:
  * Bedrock geometry X is mirrored, so positions/pivots get x negated and
    cube origins become -(origin.x + size.x).
  * Bedrock Euler rotations become (-rx, -ry, rz) and are applied in ZYX order
    (matrix = Rz * Ry * Rx), exactly like Blockbench does.
  * The player model faces -Z.  In first person the camera sits at eye height
    above the model origin and looks along +Z (the vanilla first-person pose
    turns the head 180 degrees), with camera-right = -X.
  * A bone with a "binding" is attached to the target bone's pivot with an
    extra -24 px offset along the target bone's local Y axis (the documented
    Bedrock quirk for bound attachable bones).
"""
import math
import numpy as np

EYE_HEIGHT_PX = 1.62 * 16.0
PLAYER_SCALE = 0.9375
EYE_MODEL_Y = EYE_HEIGHT_PX / PLAYER_SCALE  # camera height in player-model units
BINDING_OFFSET = np.array([0.0, -24.0, 0.0])


def rx(a):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], dtype=float)


def ry(a):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=float)


def rz(a):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], dtype=float)


def euler_internal(r):
    """Rotation matrix for an internal-frame Euler triple (ZYX order)."""
    return rz(r[2]) @ ry(r[1]) @ rx(r[0])


def bedrock_rot(r):
    return (-float(r[0]), -float(r[1]), float(r[2]))


def bedrock_vec(p):
    return np.array([-float(p[0]), float(p[1]), float(p[2])])


def mat4(R=None, t=None, s=None):
    M = np.eye(4)
    if R is not None:
        M[:3, :3] = R
    if s is not None:
        M[:3, :3] = M[:3, :3] @ np.diag([s, s, s] if np.isscalar(s) else s)
    if t is not None:
        M[:3, 3] = t
    return M


def T(v):
    return mat4(t=np.asarray(v, dtype=float))


def bone_local(pivot_i, rot_i=(0, 0, 0), pos_i=(0, 0, 0), scale=1.0):
    """Local bone matrix in the internal frame (all args already converted)."""
    pivot_i = np.asarray(pivot_i, dtype=float)
    return (T(pos_i) @ T(pivot_i) @ mat4(R=euler_internal(rot_i), s=scale)
            @ T(-pivot_i))


def internal_to_bedrock_euler(R):
    """Decompose R = Rz*Ry*Rx (internal) and return Bedrock degrees."""
    # R = Rz(c) Ry(b) Rx(a)
    sb = -R[2, 0]
    sb = max(-1.0, min(1.0, sb))
    b = math.asin(sb)
    if abs(math.cos(b)) > 1e-6:
        a = math.atan2(R[2, 1], R[2, 2])
        c = math.atan2(R[1, 0], R[0, 0])
    else:  # gimbal lock
        a = math.atan2(-R[1, 2], R[1, 1])
        c = 0.0
    a, b, c = (math.degrees(a), math.degrees(b), math.degrees(c))
    return (-a, -b, c)


# --------------------------------------------------------------------------
# Geometry loading
# --------------------------------------------------------------------------
FACE_NAMES = ("north", "south", "east", "west", "up", "down")


def box_uv_faces(uv, size, mirror=False):
    """Bedrock box-UV layout -> per face (u, v, w, h) rectangles."""
    u, v = uv
    w, h, d = size
    faces = {
        "east": (u, v + d, d, h),
        "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h),
        "south": (u + 2 * d + w, v + d, w, h),
        "up": (u + d, v, w, d),
        "down": (u + d + w, v, w, d),
    }
    if mirror:
        faces["east"], faces["west"] = faces["west"], faces["east"]
    return faces


class Cube:
    def __init__(self, bone, frm, to, faces, rot=None, pivot=None, color=None):
        self.bone = bone
        self.frm = np.asarray(frm, dtype=float)
        self.to = np.asarray(to, dtype=float)
        self.faces = faces            # face -> (u, v, w, h) or None
        self.rot = rot                # internal euler or None
        self.pivot = None if pivot is None else np.asarray(pivot, dtype=float)
        self.color = color            # optional flat colour override


class Bone:
    def __init__(self, name, parent, pivot, rot, binding=None):
        self.name = name
        self.parent = parent
        self.pivot = np.asarray(pivot, dtype=float)
        self.rot = rot
        self.binding = binding
        self.cubes = []


class Model:
    def __init__(self, tex_w, tex_h):
        self.tex_w = tex_w
        self.tex_h = tex_h
        self.bones = {}
        self.order = []

    @staticmethod
    def from_geo(geo):
        desc = geo["description"]
        m = Model(desc.get("texture_width", 64), desc.get("texture_height", 64))
        for b in geo.get("bones", []):
            name = b["name"]
            bone = Bone(name, b.get("parent"), bedrock_vec(b.get("pivot", [0, 0, 0])),
                        bedrock_rot(b.get("rotation", [0, 0, 0])), b.get("binding"))
            for c in b.get("cubes", []):
                origin = np.asarray(c["origin"], dtype=float)
                size = np.asarray(c["size"], dtype=float)
                inflate = float(c.get("inflate", 0.0))
                frm = np.array([-(origin[0] + size[0]), origin[1], origin[2]]) - inflate
                to = np.array([-origin[0], origin[1] + size[1], origin[2] + size[2]]) + inflate
                uv = c.get("uv", [0, 0])
                if isinstance(uv, dict):
                    faces = {}
                    for fn in FACE_NAMES:
                        if fn in uv:
                            f = uv[fn]
                            us = f.get("uv_size", [0, 0])
                            faces[fn] = (f["uv"][0], f["uv"][1], us[0], us[1])
                else:
                    faces = box_uv_faces(uv, size, c.get("mirror", False))
                rot = None
                pivot = None
                if "rotation" in c:
                    rot = bedrock_rot(c["rotation"])
                    pivot = bedrock_vec(c.get("pivot", [0, 0, 0]))
                bone.cubes.append(Cube(name, frm, to, faces, rot, pivot))
            m.bones[name] = bone
            m.order.append(name)
        return m

    def world_matrices(self, anims=None, root=None, bound=None):
        """anims: bone -> dict(pos=, rot=, scale=) in *Bedrock* units.
        bound: matrix used for bones with a binding (target bone frame)."""
        anims = anims or {}
        mats = {}
        lower = {k.lower(): k for k in self.bones}

        def get(name):
            if name in mats:
                return mats[name]
            bone = self.bones[name]
            a = anims.get(name) or anims.get(name.lower()) or {}
            pos = bedrock_vec(a.get("pos", (0, 0, 0)))
            arot = bedrock_rot(a.get("rot", (0, 0, 0)))
            rot = tuple(bone.rot[i] + arot[i] for i in range(3))
            local = bone_local(bone.pivot, rot, pos, a.get("scale", 1.0))
            if bone.binding is not None and bound is not None:
                parent_m = bound
            elif bone.parent and bone.parent.lower() in lower:
                parent_m = get(lower[bone.parent.lower()])
            else:
                parent_m = np.eye(4) if root is None else root
            mats[name] = parent_m @ local
            return mats[name]

        for n in self.order:
            get(n)
        return mats


# --------------------------------------------------------------------------
# Player rig
# --------------------------------------------------------------------------
def player_rig_matrices(player_model, first_person, extra=None):
    """World matrices of the vanilla player for a neutral standing pose."""
    anims = {}
    if first_person:
        anims["rightArm"] = {"pos": (13.5, -10.0, 12.0), "rot": (95.0, -45.0, 115.0)}
        rp = player_model.bones["rightArm"].pivot
        ip = player_model.bones["rightItem"].pivot
        # q.get_default_bone_pivot values are Bedrock-space: y and z unaffected
        anims["rightItem"] = {"pos": (0.0, rp[1] - ip[1] - 7.0, -ip[2])}
    else:
        anims["rightArm"] = {"rot": (-18.0, 0.0, 2.865)}
    if extra:
        for k, v in extra.items():
            anims.setdefault(k, {}).update(v)
    return player_model.world_matrices(anims)


def binding_matrix(player_mats, player_model, bone="rightItem"):
    """Frame that a bound attachable bone's model origin lives in."""
    pivot = player_model.bones[bone].pivot
    return player_mats[bone] @ T(pivot) @ T(BINDING_OFFSET)


def first_person_camera():
    """camera-from-model matrix (camera: x right, y up, z forward)."""
    # camera looks along +Z internal, right = -X internal
    R = np.array([[-1, 0, 0], [0, 1, 0], [0, 0, 1]], dtype=float)
    M = np.eye(4)
    M[:3, :3] = R
    M[:3, 3] = -R @ np.array([0.0, EYE_MODEL_Y, 0.0])
    return M


def look_at_camera(eye, target, up=(0, 1, 0)):
    eye = np.asarray(eye, dtype=float)
    f = np.asarray(target, dtype=float) - eye
    f /= np.linalg.norm(f)
    r = np.cross(f, np.asarray(up, dtype=float))
    r /= np.linalg.norm(r)
    u = np.cross(r, f)
    R = np.stack([r, u, f])
    M = np.eye(4)
    M[:3, :3] = R
    M[:3, 3] = -R @ eye
    return M


def solve_hold(A, grip_cam, R_cam):
    """Find Bedrock (pos, rot) for a bound bone (pivot at its origin) so that
    the bone origin lands on grip_cam and its axes match R_cam.

    A is camera-from-binding-frame (includes the -24 offset)."""
    RA = A[:3, :3]
    tA = A[:3, 3]
    # remove uniform scale from RA
    sc = np.cbrt(abs(np.linalg.det(RA)))
    RAn = RA / sc
    R_bone = RAn.T @ R_cam
    rot = internal_to_bedrock_euler(R_bone)
    pos_i = RAn.T @ ((np.asarray(grip_cam, dtype=float) - tA) / sc)
    pos = (-pos_i[0], pos_i[1], pos_i[2])
    return pos, rot


# Vanilla 1.21.100 player rig (bones of geometry.humanoid.custom that matter for
# held items), copied from Mojang's bedrock-samples resource pack.
VANILLA_PLAYER_GEO = {
    "description": {"identifier": "geometry.humanoid.custom", "texture_width": 64, "texture_height": 64},
    "bones": [
        {"name": "root", "pivot": [0.0, 0.0, 0.0]},
        {"name": "body", "parent": "waist", "pivot": [0.0, 24.0, 0.0],
         "cubes": [{"origin": [-4.0, 12.0, -2.0], "size": [8, 12, 4], "uv": [16, 16]}]},
        {"name": "waist", "parent": "root", "pivot": [0.0, 12.0, 0.0]},
        {"name": "head", "parent": "body", "pivot": [0.0, 24.0, 0.0],
         "cubes": [{"origin": [-4.0, 24.0, -4.0], "size": [8, 8, 8], "uv": [0, 0]}]},
        {"name": "leftArm", "parent": "body", "pivot": [5.0, 22.0, 0.0],
         "cubes": [{"origin": [4.0, 12.0, -2.0], "size": [4, 12, 4], "uv": [32, 48]}]},
        {"name": "leftItem", "pivot": [6.0, 15.0, 1.0], "parent": "leftArm"},
        {"name": "rightArm", "parent": "body", "pivot": [-5.0, 22.0, 0.0],
         "cubes": [{"origin": [-8.0, 12.0, -2.0], "size": [4, 12, 4], "uv": [40, 16]}]},
        {"name": "rightItem", "pivot": [-6, 15, 1], "parent": "rightArm"},
        {"name": "leftLeg", "parent": "root", "pivot": [1.9, 12.0, 0.0],
         "cubes": [{"origin": [-0.1, 0.0, -2.0], "size": [4, 12, 4], "uv": [16, 48]}]},
        {"name": "rightLeg", "parent": "root", "pivot": [-1.9, 12.0, 0.0],
         "cubes": [{"origin": [-3.9, 0.0, -2.0], "size": [4, 12, 4], "uv": [0, 16]}]},
    ],
}


def vanilla_player():
    return Model.from_geo(VANILLA_PLAYER_GEO)
