"""CMU ASF/AMC motion capture -> MPFB 'cmu_mb' rig retargeting (runs inside Blender).

Math follows the ASF/AMC spec: for every bone, global rotation
    M_bone(t) = M_parent(t) @ C @ Euler(dofs) @ C^-1
which is the identity at the ASF rest pose (a T-pose). We map each CMU bone to the
equivalent cmu_mb bone and drive it in armature space with
    R_target(t) = K @ M_bone(t) @ K^T @ Q_target
where K converts CMU (Y-up, facing +Z) into Blender (Z-up, facing -Y) and Q_target is
the target bone's orientation when posed to match the ASF rest pose exactly.
"""
import math
import numpy as np

UNIT = (1.0 / 0.45) * 0.0254  # ASF length units -> metres

BONE_MAP = {
    "root": "Hips",
    "lhipjoint": "LHipJoint", "lfemur": "LeftUpLeg", "ltibia": "LeftLeg", "lfoot": "LeftFoot", "ltoes": "LeftToeBase",
    "rhipjoint": "RHipJoint", "rfemur": "RightUpLeg", "rtibia": "RightLeg", "rfoot": "RightFoot", "rtoes": "RightToeBase",
    "lowerback": "LowerBack", "upperback": "Spine", "thorax": "Spine1",
    "lowerneck": "Neck", "upperneck": "Neck1", "head": "Head",
    "lclavicle": "LeftShoulder", "lhumerus": "LeftArm", "lradius": "LeftForeArm", "lwrist": "LeftHand",
    "lhand": "LeftFingerBase", "lfingers": "LeftHandFinger1", "lthumb": "LThumb",
    "rclavicle": "RightShoulder", "rhumerus": "RightArm", "rradius": "RightForeArm", "rwrist": "RightHand",
    "rhand": "RightFingerBase", "rfingers": "RightHandFinger1", "rthumb": "RThumb",
}

K = np.array([[1.0, 0, 0], [0, 0, -1.0], [0, 1.0, 0]])


def _rx(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def _ry(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def _rz(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def euler_xyz(x, y, z):
    """Rotation applying X first, then Y, then Z (ASF 'XYZ')."""
    return _rz(z) @ _ry(y) @ _rx(x)


def parse_asf(path):
    lines = [l.strip() for l in open(path, encoding="latin-1")]
    bones = {"root": {"name": "root", "dir": np.zeros(3), "len": 0.0, "C": np.eye(3), "dof": ["rx", "ry", "rz"]}}
    hierarchy = {}
    i = 0
    section = None
    while i < len(lines):
        l = lines[i]
        if l.startswith(":"):
            section = l.split()[0]
            i += 1
            continue
        if section == ":root":
            if l.startswith("axis"):
                pass
        if section == ":bonedata" and l == "begin":
            b = {"dof": []}
            i += 1
            while lines[i] != "end":
                t = lines[i].split()
                if t[0] == "name":
                    b["name"] = t[1]
                elif t[0] == "direction":
                    b["dir"] = np.array([float(v) for v in t[1:4]])
                elif t[0] == "length":
                    b["len"] = float(t[1])
                elif t[0] == "axis":
                    ax = [math.radians(float(v)) for v in t[1:4]]
                    b["C"] = euler_xyz(*ax)
                elif t[0] == "dof":
                    b["dof"] = t[1:]
                i += 1
            bones[b["name"]] = b
        elif section == ":hierarchy" and l not in ("begin", "end") and l:
            t = l.split()
            hierarchy[t[0]] = t[1:]
        i += 1
    parent = {}
    for p, ch in hierarchy.items():
        for c in ch:
            parent[c] = p
    order = []

    def walk(n):
        order.append(n)
        for c in hierarchy.get(n, []):
            walk(c)
    walk("root")
    return {"bones": bones, "parent": parent, "order": order, "children": hierarchy}


def parse_amc(path):
    frames = []
    cur = None
    for l in open(path, encoding="latin-1"):
        l = l.strip()
        if not l or l.startswith("#") or l.startswith(":"):
            continue
        t = l.split()
        if len(t) == 1 and t[0].isdigit():
            cur = {}
            frames.append(cur)
        else:
            cur[t[0]] = [float(v) for v in t[1:]]
    return frames


def frame_globals(skel, fr):
    """Return {bone: (R3x3 global, end_position)} in ASF coordinates (metres)."""
    out = {}
    bones = skel["bones"]
    for name in skel["order"]:
        b = bones[name]
        if name == "root":
            v = fr["root"]
            R = euler_xyz(*[math.radians(a) for a in v[3:6]])
            out[name] = (R, np.array(v[0:3]) * UNIT)
            continue
        vals = fr.get(name, [])
        ang = [0.0, 0.0, 0.0]
        for k, d in enumerate(b["dof"]):
            if d in ("rx", "ry", "rz") and k < len(vals):
                ang["xyz".index(d[1])] = math.radians(vals[k])
        Rp, pp = out[skel["parent"][name]]
        C = b["C"]
        R = Rp @ C @ euler_xyz(*ang) @ C.T
        pos = pp + b["len"] * UNIT * (R @ b["dir"])
        out[name] = (R, pos)
    return out


def rest_positions(skel):
    """End positions of every bone in the ASF rest pose (root at origin)."""
    zero = {"root": [0, 0, 0, 0, 0, 0]}
    return {k: v[1] for k, v in frame_globals(skel, zero).items()}


def _quat_from_matrix(m):
    from mathutils import Matrix
    return Matrix(m.tolist()).to_quaternion()


DEFAULT_DAMP = {"Neck": 0.45, "Neck1": 0.45, "Head": 0.45}


def retarget(rig, asf_path, amc_path, action_name, *, start=0, end=None, step=4, speed=1.0,
             in_place=False, keep_height=True, yaw_deg=0.0, trim_to_ground=True, damp=None, face=True):
    """Bake an Action onto `rig` (cmu_mb). Source is 120 fps; step=4 -> 30 fps.
    speed>1 plays faster (samples further apart). Returns the Action (frames start at 1)."""
    import bpy
    from mathutils import Matrix, Vector, Quaternion

    skel = parse_asf(asf_path)
    frames = parse_amc(amc_path)
    if end is None:
        end = len(frames)
    frames = frames[start:end]

    arm = rig.data
    rest = {b.name: b.matrix_local.copy() for b in arm.bones}

    # ---- T-pose reference orientation for each target bone (armature space)
    Q = {}
    for a, t in BONE_MAP.items():
        if t not in rest:
            continue
        B = rest[t].to_3x3()
        if a == "root":
            Q[t] = B
            continue
        d_rest = (B @ Vector((0, 1, 0))).normalized()
        d_T = Vector((K @ skel["bones"][a]["dir"]).tolist()).normalized()
        Q[t] = d_rest.rotation_difference(d_T).to_matrix() @ B

    # ---- scale: hip height ratio
    rp = rest_positions(skel)
    asf_hip_h = -min(rp["lfoot"][1], rp["rfoot"][1]) + 0.04  # foot bone end ~ ankle->toe
    tgt_hip_h = rest["Hips"].translation.z
    s = tgt_hip_h / max(asf_hip_h, 1e-3)

    if face:
        # cancel the clip's initial heading so frame 1 faces -Y (MakeHuman forward)
        R0 = frame_globals(skel, frames[0])["root"][0]
        f = K @ (R0 @ np.array([0.0, 0.0, 1.0]))
        yaw_deg = yaw_deg - math.degrees(math.atan2(f[0], -f[1]))
    yaw = Matrix.Rotation(math.radians(yaw_deg), 3, "Z")
    yaw_np = np.array([list(r) for r in yaw])

    # order target bones parent-first
    tgt_order = [b.name for b in arm.bones if b.name in Q]
    tgt_order.sort(key=lambda n: len(arm.bones[n].parent_recursive))
    inv_map = {v: k for k, v in BONE_MAP.items()}

    idxs = []
    f = 0.0
    while int(round(f)) < len(frames):
        idxs.append(int(round(f)))
        f += step * speed
    n = len(idxs)

    quats = {t: np.zeros((n, 4)) for t in tgt_order}
    hips_loc = np.zeros((n, 3))
    root0 = None
    for fi, src_i in enumerate(idxs):
        G = frame_globals(skel, frames[src_i])
        Rw = {}
        for t in tgt_order:
            a = inv_map[t]
            Rg = yaw_np @ K @ G[a][0] @ K.T
            Rw[t] = Matrix(Rg.tolist()) @ Q[t]
        for t in tgt_order:
            bone = arm.bones[t]
            Bb = rest[t].to_3x3()
            if bone.parent is None:
                L = Bb.inverted() @ Rw[t]
            else:
                Bp = rest[bone.parent.name].to_3x3()
                L = Bb.inverted() @ Bp @ Rw[bone.parent.name].inverted() @ Rw[t]
            q = L.to_quaternion()
            dmp = (DEFAULT_DAMP if damp is None else damp).get(t)
            if dmp:
                q = Quaternion((1, 0, 0, 0)).slerp(q, 1.0 - dmp)
                # keep the parent-relative chain consistent for children
                Rw[t] = (Bp @ Rw[bone.parent.name].inverted()).inverted() @ Bb @ q.to_matrix() if bone.parent else Rw[t]
            if fi > 0:
                prev = quats[t][fi - 1]
                if q.w * prev[0] + q.x * prev[1] + q.y * prev[2] + q.z * prev[3] < 0:
                    q = -q
            quats[t][fi] = (q.w, q.x, q.y, q.z)
        p = yaw_np @ K @ G["root"][1] * s
        if root0 is None:
            root0 = p.copy()
        rel = p - np.array([root0[0], root0[1], 0.0])
        if in_place:
            rel[0] = 0.0
            rel[1] = 0.0
        hips_loc[fi] = rel

    # ground: lowest foot over the clip should touch z=0 -> computed later by caller if needed
    # Convert hips world-ish location into bone local translation
    hb = rest["Hips"]
    Bh = hb.to_3x3()
    head0 = hb.translation.copy()

    act = bpy.data.actions.new(action_name)
    act.use_fake_user = True

    def fcurves(path, count, values):
        for c in range(count):
            fc = act.fcurves.new(path, index=c, action_group=path.split('"')[1] if '"' in path else "")
            fc.keyframe_points.add(n)
            co = np.empty(2 * n)
            co[0::2] = np.arange(1, n + 1)
            co[1::2] = values[:, c]
            fc.keyframe_points.foreach_set("co", co)
            fc.keyframe_points.foreach_set("interpolation", [2] * n)  # LINEAR
            fc.update()

    for t in tgt_order:
        fcurves(f'pose.bones["{t}"].rotation_quaternion', 4, quats[t])
    # hips location in bone space: Bh^T @ (desired_head - rest_head)
    locs = np.zeros((n, 3))
    for i in range(n):
        target_head = Vector((hips_loc[i][0], hips_loc[i][1], hips_loc[i][2]))
        if not keep_height:
            target_head.z = head0.z
        d = target_head - head0
        locs[i] = (Bh.transposed() @ d)[:]
    fcurves('pose.bones["Hips"].location', 3, locs)
    act["frames"] = n
    act["scale"] = s
    return act


def ensure_quaternion(rig):
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
