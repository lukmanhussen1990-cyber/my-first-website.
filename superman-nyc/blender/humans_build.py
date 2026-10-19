"""Build rigged, animated, clothed human assets from CC0 sources.

Sources
  * Blender "Human Base Meshes" bundle (CC0): realistic male/female bodies.
  * three.js example "Xbot.glb" (Mixamo rig): walk / run / idle / pose clips.

The base meshes are rigged with a Mixamo-compatible skeleton.  Every Xbot bone
has the same rest orientation (local Y = world up), so retargeting reduces to
copying local rotations, plus a constant correction on the first bone of each
limb chain that accounts for the base mesh's A-pose (arms ~23 deg from the
body, legs slightly apart) versus Xbot's T-pose.

Output: a library .blend with rigs, LOD meshes, clothing shells and actions.

Run:  blender -b --factory-startup -P humans_build.py -- OUT.blend
"""
import bpy
import bmesh
import math
import sys
import numpy as np
from mathutils import Matrix, Vector, Quaternion, Euler

HBM = "/opt/assets/hbm/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend"
XBOT = "/opt/assets/threejs/Xbot.glb"

P = "mixamorig:"
BONES = [
    ("Hips", None), ("Spine", "Hips"), ("Spine1", "Spine"), ("Spine2", "Spine1"),
    ("Neck", "Spine2"), ("Head", "Neck"),
    ("LeftShoulder", "Spine2"), ("LeftArm", "LeftShoulder"), ("LeftForeArm", "LeftArm"), ("LeftHand", "LeftForeArm"),
    ("RightShoulder", "Spine2"), ("RightArm", "RightShoulder"), ("RightForeArm", "RightArm"), ("RightHand", "RightForeArm"),
    ("LeftUpLeg", "Hips"), ("LeftLeg", "LeftUpLeg"), ("LeftFoot", "LeftLeg"), ("LeftToeBase", "LeftFoot"),
    ("RightUpLeg", "Hips"), ("RightLeg", "RightUpLeg"), ("RightFoot", "RightLeg"), ("RightToeBase", "RightFoot"),
]
BONE_NAMES = [b for b, _ in BONES]
PARENT = dict(BONES)
CHILD = {"Hips": "Spine", "Spine": "Spine1", "Spine1": "Spine2", "Spine2": "Neck", "Neck": "Head",
         "LeftShoulder": "LeftArm", "LeftArm": "LeftForeArm", "LeftForeArm": "LeftHand",
         "RightShoulder": "RightArm", "RightArm": "RightForeArm", "RightForeArm": "RightHand",
         "LeftUpLeg": "LeftLeg", "LeftLeg": "LeftFoot", "LeftFoot": "LeftToeBase",
         "RightUpLeg": "RightLeg", "RightLeg": "RightFoot", "RightFoot": "RightToeBase"}
# Rest frame shared by every Xbot bone: local Y -> world +Z, local Z -> world -Y.
R0 = Euler((math.pi / 2, 0, 0)).to_matrix()
ARM_CHAINS = {"Left": ["LeftArm", "LeftForeArm", "LeftHand"], "Right": ["RightArm", "RightForeArm", "RightHand"]}
LEG_CHAINS = {"Left": ["LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase"],
              "Right": ["RightUpLeg", "RightLeg", "RightFoot", "RightToeBase"]}


# --------------------------------------------------------------------------- utils
def mesh_co(obj):
    n = len(obj.data.vertices)
    co = np.empty(n * 3)
    obj.data.vertices.foreach_get("co", co)
    return co.reshape(-1, 3)


def set_mesh_co(obj, co):
    obj.data.vertices.foreach_set("co", co.astype(np.float64).ravel())
    obj.data.update()


def activate(obj):
    for o in list(bpy.context.view_layer.objects):
        if o is not None:
            o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def slab_centroid(co, center, axis, half=0.012, radius=0.08):
    """Centroid of vertices in a thin slab perpendicular to `axis` around `center`."""
    axis = axis / np.linalg.norm(axis)
    d = co - center
    t = d @ axis
    perp = d - np.outer(t, axis)
    m = (np.abs(t) < half) & (np.linalg.norm(perp, axis=1) < radius)
    if m.sum() < 4:
        return center
    return co[m].mean(0)


# --------------------------------------------------------------------------- joints
def fit_joints(co):
    """Estimate Mixamo joint positions on an A-posed base mesh (faces -Y, left = +X)."""
    zmin, zmax = co[:, 2].min(), co[:, 2].max()
    H = zmax - zmin
    J = {}
    z = lambda f: zmin + f * H
    up = np.array([0, 0, 1.0])

    for side, sx in (("Left", 1.0), ("Right", -1.0)):
        legs = co[co[:, 0] * sx > 0.015]
        knee = slab_centroid(legs, np.array([sx * 0.11, -0.01, z(0.285)]), up, 0.01, 0.09)
        ankle = slab_centroid(legs, np.array([sx * 0.15, 0.03, z(0.052)]), up, 0.008, 0.07)
        ankle[1] += 0.012                      # ankle joint sits behind the slab centroid
        thigh = slab_centroid(legs, np.array([sx * 0.1, 0.0, z(0.42)]), up, 0.012, 0.11)
        hip = np.array([thigh[0] * 0.92, thigh[1] + 0.005, z(0.515)])
        foot = co[(co[:, 0] * sx > 0.03) & (co[:, 2] < zmin + 0.035)]
        toe_tip = foot[np.argmin(foot[:, 1])]
        heel = foot[np.argmax(foot[:, 1])]
        ball = heel + 0.72 * (toe_tip - heel)
        ball = np.array([foot[:, 0].mean() * 0.98, ball[1], zmin + 0.022])
        J[side + "UpLeg"] = hip
        J[side + "Leg"] = knee
        J[side + "Foot"] = ankle
        J[side + "ToeBase"] = ball
        J[side + "ToeBase_tail"] = np.array([ball[0], toe_tip[1], zmin + 0.015])

        # arms
        arm_pts = co[(co[:, 0] * sx > 0.22) & (co[:, 2] > zmin + 0.35 * H)]
        tip = arm_pts[np.argmin(arm_pts[:, 2])]
        sh_slab = co[(np.abs(co[:, 2] - z(0.79)) < 0.012) & (co[:, 0] * sx > 0)]
        sh_x = sx * (np.abs(sh_slab[:, 0]).max() - 0.048)
        shoulder = np.array([sh_x, 0.0, z(0.805)])
        near = co[np.linalg.norm(co - shoulder, axis=1) < 0.06]
        shoulder[1] = near[:, 1].mean() if len(near) else 0.0
        axis = tip - shoulder
        L = np.linalg.norm(axis)
        elbow = slab_centroid(co, shoulder + 0.425 * axis, axis, 0.012, 0.07)
        wrist = slab_centroid(co, shoulder + 0.755 * axis, axis, 0.010, 0.05)
        J[side + "Arm"] = shoulder
        J[side + "ForeArm"] = elbow
        J[side + "Hand"] = wrist
        J[side + "Hand_tail"] = tip

    # spine: points 40% of the way from the torso's back surface toward its front
    def spine_pt(zz, back=0.42):
        s = co[(np.abs(co[:, 2] - zz) < 0.01) & (np.abs(co[:, 0]) < 0.1)]
        y0, y1 = s[:, 1].min(), s[:, 1].max()
        return np.array([0.0, y1 - back * (y1 - y0), zz])

    hips_z, neck_z, head_z = z(0.555), z(0.852), z(0.905)
    J["Hips"] = spine_pt(hips_z)
    for name, r in (("Spine", 0.222), ("Spine1", 0.441), ("Spine2", 0.639)):
        J[name] = spine_pt(hips_z + r * (neck_z - hips_z))
    J["Neck"] = spine_pt(neck_z, 0.5)
    J["Head"] = spine_pt(head_z, 0.55)
    J["Head_tail"] = np.array([0.0, J["Head"][1], zmax])
    for side, sx in (("Left", 1.0), ("Right", -1.0)):
        J[side + "Shoulder"] = np.array([sx * 0.035, J["Spine2"][1] + 0.01, neck_z - 0.055])
    return J, H


# --------------------------------------------------------------------------- rigs
def build_heat_rig(name, J):
    """Rig whose bones run joint-to-joint along the limbs (used only for bone-heat weights)."""
    arm_data = bpy.data.armatures.new(name)
    rig = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(rig)
    activate(rig)
    bpy.ops.object.mode_set(mode='EDIT')
    ebs = {}
    for b, parent in BONES:
        eb = arm_data.edit_bones.new(P + b)
        eb.head = Vector(J[b])
        if b in CHILD:
            tail = J[CHILD[b]]
        else:
            tail = J[b + "_tail"]
        if b == "Hips":
            tail = J["Spine"]
        eb.tail = Vector(tail)
        if (eb.tail - eb.head).length < 0.01:
            eb.tail = eb.head + Vector((0, 0, 0.05))
        ebs[b] = eb
    for b, parent in BONES:
        if parent:
            ebs[b].parent = ebs[parent]
            ebs[b].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def chain_rotations(J):
    """Rotations taking Xbot's T-pose limb directions to this mesh's rest directions."""
    rots = {}
    for side, sx in (("Left", 1.0), ("Right", -1.0)):
        d = Vector(J[side + "Hand"] - J[side + "Arm"]).normalized()
        rots[side + "Arm"] = Vector((sx, 0, 0)).rotation_difference(d).to_matrix()
        d = Vector(J[side + "Foot"] - J[side + "UpLeg"]).normalized()
        rots[side + "UpLeg"] = Vector((0, 0, -1)).rotation_difference(d).to_matrix()
    return rots


def build_anim_rig(name, J, rots):
    arm_data = bpy.data.armatures.new(name)
    arm_data.display_type = 'STICK'
    rig = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(rig)
    activate(rig)
    bpy.ops.object.mode_set(mode='EDIT')
    ebs = {}
    for b, parent in BONES:
        eb = arm_data.edit_bones.new(P + b)
        R = R0
        for side in ("Left", "Right"):
            if b in ARM_CHAINS[side]:
                R = rots[side + "Arm"] @ R0
            if b in LEG_CHAINS[side]:
                R = rots[side + "UpLeg"] @ R0
        eb.head = Vector(J[b])
        eb.tail = eb.head + Vector((0, 0, 0.08))
        M = R.to_4x4()
        M.translation = Vector(J[b])
        eb.matrix = M
        eb.length = 0.08
        ebs[b] = eb
    for b, parent in BONES:
        if parent:
            ebs[b].parent = ebs[parent]
            ebs[b].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return rig


def heat_weights(body, heat_rig):
    """Bone-heat (automatic) weights; vertex groups are named after the bones."""
    activate(heat_rig)
    body.select_set(True)
    bpy.context.view_layer.objects.active = heat_rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    # detach from the heat rig but keep the vertex groups
    body.parent = None
    for m in list(body.modifiers):
        if m.type == 'ARMATURE':
            body.modifiers.remove(m)


def weights_array(obj):
    """(n_verts, n_bones) weight matrix in BONE_NAMES order."""
    idx = {vg.index: BONE_NAMES.index(vg.name[len(P):]) for vg in obj.vertex_groups
           if vg.name.startswith(P) and vg.name[len(P):] in BONE_NAMES}
    W = np.zeros((len(obj.data.vertices), len(BONE_NAMES)), np.float32)
    for v in obj.data.vertices:
        for g in v.groups:
            if g.group in idx:
                W[v.index, idx[g.group]] = g.weight
    return W


def set_weights(obj, W, verts=None):
    """Write a weight matrix back (optionally only for a subset of vertices)."""
    rng = np.arange(len(W)) if verts is None else np.asarray(verts)
    for i, b in enumerate(BONE_NAMES):
        vg = obj.vertex_groups.get(P + b) or obj.vertex_groups.new(name=P + b)
        vg.remove([int(v) for v in rng])
        w = W[rng, i]
        q = np.round(w * 1000).astype(int)
        for val in np.unique(q[q > 0]):
            vg.add([int(v) for v in rng[q == val]], val / 1000.0, 'REPLACE')


def load_base_body(kind, level):
    """Append a realistic base body ('male'/'female'), bake multires `level`, join the eyes.

    Returns the mesh object, centered on x=0 with feet at z=0, facing -Y."""
    name = f"GEO-body_{kind}_realistic"
    with bpy.data.libraries.load(HBM, link=False) as (df, dt):
        dt.objects = [n for n in df.objects if n.startswith(name)]
    objs = [o for o in dt.objects if o is not None]
    for o in objs:
        bpy.context.scene.collection.objects.link(o)
    body = bpy.data.objects[name]
    eyes = [o for o in objs if o is not body]
    activate(body)
    for m in body.modifiers:
        if m.type == 'MULTIRES':
            m.levels = level
            bpy.ops.object.modifier_apply(modifier=m.name)
    # world-space vertex positions -> mesh data, identity object transform
    for o in [body] + eyes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
    co = mesh_co(body)
    off = np.array([-(co[:, 0].max() + co[:, 0].min()) / 2, 0.0, -co[:, 2].min()])
    for o in [body] + eyes:
        o.data.transform(Matrix.Translation(Vector(off)))
    n_body = len(body.data.vertices)
    activate(body)
    for e in eyes:
        e.select_set(True)
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = f"Body_{kind}"
    body.data.name = f"Body_{kind}"
    for p in body.data.polygons:
        p.use_smooth = True
    return body, n_body


def bind(obj, rig):
    obj.parent = rig
    obj.matrix_parent_inverse = Matrix.Identity(4)
    m = obj.modifiers.new("Armature", 'ARMATURE')
    m.object = rig
    m.use_deform_preserve_volume = True
    return m


# --------------------------------------------------------------------------- actions
def new_action_fcurves(action, rig_name="Rig"):
    """Return a callable creating F-curves on `action` (works with 4.4+ slotted actions)."""
    try:
        action.fcurves.new('location', index=0)
        fc = action.fcurves.find('location', index=0)
        action.fcurves.remove(fc)
        return lambda path, i, group: action.fcurves.new(path, index=i, action_group=group)
    except Exception:
        layer = action.layers.new("Layer")
        strip = layer.strips.new(type='KEYFRAME')
        slot = action.slots.new(id_type='OBJECT', name=rig_name)
        bag = strip.channelbag(slot, ensure=True)
        def make(path, i, group):
            fc = bag.fcurves.new(path, index=i)
            return fc
        return make


def src_fcurves(action):
    try:
        return list(action.fcurves)
    except Exception:
        return [fc for layer in action.layers for strip in layer.strips
                for bag in strip.channelbags for fc in bag.fcurves]


def import_xbot():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=XBOT)
    new = [o for o in bpy.data.objects if o not in before]
    src = [o for o in new if o.type == 'ARMATURE'][0]
    for o in new:
        if o.type == 'MESH':
            o.hide_render = True
    return src, new


def measure_speed(src, action, foot="LeftFoot"):
    """Ground speed (m/s) implied by an in-place cycle: stance-foot sliding speed."""
    sc = bpy.context.scene
    src.animation_data.action = action
    f0, f1 = int(action.frame_range[0]), int(action.frame_range[1])
    pts = []
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        p = src.matrix_world @ src.pose.bones[P + foot].head
        pts.append((f, p.y, p.z))
    pts = np.array(pts)
    zlow = pts[:, 2] < pts[:, 2].min() + 0.02          # stance phase
    seg = pts[zlow]
    if len(seg) < 3:
        return 0.0, 0.0
    slope = np.polyfit(seg[:, 0], seg[:, 1], 1)[0]     # m per frame (positive = backwards)
    hip_h = (src.matrix_world @ src.data.bones[P + "LeftUpLeg"].head_local).z
    return abs(slope) * sc.render.fps, hip_h


def retarget(src, actions, rots, scale, prefix):
    """Copy Xbot clips onto our rig. `scale` = target hip height / source hip height."""
    Qc = {k: (R0.inverted() @ rots[k].inverted() @ R0).to_quaternion() for k in rots}
    out = {}
    for an in actions:
        sa = bpy.data.actions[an]
        fcs = {(fc.data_path, fc.array_index): fc for fc in src_fcurves(sa)}
        f0, f1 = int(round(sa.frame_range[0])), int(round(sa.frame_range[1]))
        frames = np.arange(f0, f1 + 1, dtype=np.float64)
        ta = bpy.data.actions.new(f"{prefix}_{an}")
        ta.use_fake_user = True
        make = new_action_fcurves(ta)
        for b in BONE_NAMES:
            path = f'pose.bones["{P}{b}"].rotation_quaternion'
            src_q = [fcs.get((path, i)) for i in range(4)]
            if src_q[0] is None:
                vals = np.tile([1.0, 0, 0, 0], (len(frames), 1))
            else:
                vals = np.array([[fc.evaluate(f) for fc in src_q] for f in frames])
            if b in Qc:
                q = Qc[b]
                vals = np.array([list(q @ Quaternion(v)) for v in vals])
            # keep quaternion sign continuity
            for i in range(1, len(vals)):
                if np.dot(vals[i], vals[i - 1]) < 0:
                    vals[i] = -vals[i]
            for i in range(4):
                fc = make(path, i, b)
                fc.keyframe_points.add(len(frames))
                fc.keyframe_points.foreach_set("co", np.column_stack([frames, vals[:, i]]).ravel())
                fc.keyframe_points.foreach_set("interpolation", [1] * len(frames))  # LINEAR
                fc.update()
        path = f'pose.bones["{P}Hips"].location'
        for i in range(3):
            sfc = fcs.get((path, i))
            vals = np.array([sfc.evaluate(f) if sfc else 0.0 for f in frames]) * src.scale[0] * scale
            fc = make(path, i, "Hips")
            fc.keyframe_points.add(len(frames))
            fc.keyframe_points.foreach_set("co", np.column_stack([frames, vals]).ravel())
            fc.keyframe_points.foreach_set("interpolation", [1] * len(frames))
            fc.update()
        ta["cycle_frames"] = float(f1 - f0)
        out[an] = ta
    return out


# --------------------------------------------------------------------------- regions & shells
def region_info(body, J, n_body):
    co = mesh_co(body)
    W = weights_array(body)
    dom = np.array(BONE_NAMES)[np.argmax(W, axis=1)]
    nrm = np.empty(len(co) * 3)
    body.data.vertices.foreach_get("normal", nrm)
    nrm = nrm.reshape(-1, 3)
    is_eye = np.arange(len(co)) >= n_body
    arm_bones = {"LeftArm", "LeftForeArm", "LeftHand", "RightArm", "RightForeArm", "RightHand"}
    is_arm = np.isin(dom, list(arm_bones)) | ((np.isin(dom, ["LeftShoulder", "RightShoulder"])) & (np.abs(co[:, 0]) > 0.16))
    # parametric position along each arm (0 shoulder .. 1 wrist)
    t_arm = np.zeros(len(co))
    for side, sx in (("Left", 1), ("Right", -1)):
        a, w = J[side + "Arm"], J[side + "Hand"]
        ax = w - a
        t = ((co - a) @ ax) / (ax @ ax)
        m = (co[:, 0] * sx > 0)
        t_arm[m] = t[m]
    head_c = J["Head"] + np.array([0, -0.01, 0.08])
    zmax = co[:, 2].max()
    return dict(co=co, W=W, dom=dom, nrm=nrm, is_eye=is_eye, is_arm=is_arm, t_arm=t_arm,
                head_c=head_c, zmax=zmax)


def hair_mask(R, J, style):
    co, dom = R["co"], R["dom"]
    hc = R["head_c"]
    rel = co - hc
    ang = np.arctan2(rel[:, 1], np.abs(rel[:, 0]) + 1e-6)   # -pi/2 front ... +pi/2 back
    f = (ang + np.pi / 2) / np.pi                              # 0 front .. 1 back
    drop = 0.068 + 0.05 * np.clip(f * 1.6, 0, 1) + 0.075 * np.clip((f - 0.55) / 0.45, 0, 1)
    if style == "long":
        drop = drop + 0.03 * np.clip((f - 0.3) / 0.7, 0, 1)
    m = (co[:, 2] > R["zmax"] - drop) & np.isin(dom, ["Head", "Neck"]) & ~R["is_eye"]
    # keep the face and the ears clear
    m &= ~((rel[:, 1] < -0.035) & (co[:, 2] < R["zmax"] - 0.07))
    m &= ~((np.abs(rel[:, 0]) > 0.062) & (co[:, 2] < R["zmax"] - 0.085) & (rel[:, 1] < 0.03))
    return m


def outfit_masks(R, J, top, bottom):
    """Boolean vertex masks for clothing regions.  top: 'tee'|'long'|'jacket'; bottom: 'pants'|'shorts'."""
    co, dom = R["co"], R["dom"]
    is_arm, t_arm, eye = R["is_arm"], R["t_arm"], R["is_eye"]
    waist_z = J["Hips"][2] + 0.035
    hem_z = J["Hips"][2] - (0.11 if top == "jacket" else 0.07)
    collar_z = J["Neck"][2] + (0.015 if top == "jacket" else -0.005)
    ankle_z = J["LeftFoot"][2] + 0.035
    knee_z = J["LeftLeg"][2] + 0.06
    sleeve = {"tee": 0.33, "long": 0.97, "jacket": 0.99}[top]
    torso = (~is_arm) & (co[:, 2] > hem_z) & (co[:, 2] < collar_z) & ~np.isin(dom, ["Head", "Neck"])
    torso |= (dom == "Neck") & (co[:, 2] < collar_z - 0.01)
    arms = is_arm & (t_arm < sleeve)
    m_top = (torso | arms) & ~eye
    low = 0.0 if bottom == "pants" else knee_z
    m_bot = (~is_arm) & (co[:, 2] < waist_z) & (co[:, 2] > max(ankle_z, low)) & ~eye
    m_shoe = (co[:, 2] < ankle_z + 0.012) & ~eye & ~is_arm
    return m_top, m_bot, m_shoe


def edges_array(obj):
    e = np.empty(len(obj.data.edges) * 2, np.int64)
    obj.data.edges.foreach_get("vertices", e)
    return e.reshape(-1, 2)


def taubin(co, edges, mask, iters, lam=0.5, mu=-0.53):
    """Volume-preserving smoothing restricted to `mask` vertices (removes anatomy under cloth)."""
    co = co.copy()
    e = edges[mask[edges[:, 0]] & mask[edges[:, 1]]]
    cnt = np.zeros(len(co))
    np.add.at(cnt, e[:, 0], 1)
    np.add.at(cnt, e[:, 1], 1)
    m = cnt > 0
    for k in range(iters * 2):
        acc = np.zeros_like(co)
        np.add.at(acc, e[:, 0], co[e[:, 1]])
        np.add.at(acc, e[:, 1], co[e[:, 0]])
        f = lam if k % 2 == 0 else mu
        co[m] += f * (acc[m] / cnt[m, None] - co[m])
    return co


PART_GROUP = {"Hips": 0, "Spine": 0, "Spine1": 0, "Spine2": 0, "Neck": 0, "Head": 5,
              "LeftShoulder": 0, "RightShoulder": 0,
              "LeftArm": 1, "LeftForeArm": 1, "LeftHand": 1, "RightArm": 2, "RightForeArm": 2, "RightHand": 2,
              "LeftUpLeg": 3, "LeftLeg": 3, "LeftFoot": 3, "LeftToeBase": 3,
              "RightUpLeg": 4, "RightLeg": 4, "RightFoot": 4, "RightToeBase": 4}


def drape(R, edges, mask, offset, iters):
    """Cloth-like shell: smooth each body part separately (no webbing at armpits/crotch),
    pin the region boundary, then push out so the original surface is covered by `offset`."""
    co, nrm = R["co"], R["nrm"]
    grp = np.array([PART_GROUP[d] for d in R["dom"]])
    inside = mask[edges[:, 0]] & mask[edges[:, 1]]
    same = grp[edges[:, 0]] == grp[edges[:, 1]]
    # region boundary vertices stay put
    border = np.zeros(len(co), bool)
    cross = mask[edges[:, 0]] ^ mask[edges[:, 1]]
    border[edges[cross].ravel()] = True
    e = edges[inside & same]
    cnt = np.zeros(len(co))
    np.add.at(cnt, e[:, 0], 1)
    np.add.at(cnt, e[:, 1], 1)
    free = (cnt > 0) & ~border

    def smooth(x, n, lam=0.5):
        x = x.copy()
        for _ in range(n):
            acc = np.zeros_like(x)
            np.add.at(acc, e[:, 0], x[e[:, 1]])
            np.add.at(acc, e[:, 1], x[e[:, 0]])
            avg = acc[free] / cnt[free].reshape((-1,) + (1,) * (x.ndim - 1))
            x[free] += lam * (avg - x[free])
        return x
    s = smooth(co, iters)
    ns = smooth(nrm, iters)
    ns /= np.linalg.norm(ns, axis=1, keepdims=True) + 1e-9
    d = ((s - co) * ns).sum(1)
    t = np.maximum(offset * 0.7, offset - d)
    t = smooth(t, max(2, iters // 3))
    t = np.maximum(t, offset * 0.6)
    return s + ns * t[:, None]


def make_shell(body, mask, R, offset, name, rig=None, jitter=0.0, seed=0, smooth=0):
    """Duplicate `body`, keep only `mask` vertices, smooth them and push them out along the normals."""
    me = body.data.copy()
    me.name = name
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for vg in body.vertex_groups:
        ob.vertex_groups.new(name=vg.name)
    # copy weights by duplicating the object data (vertex groups live on the mesh)
    co, nrm = R["co"], R["nrm"]
    if smooth:
        co = drape(R, edges_array(body), mask, offset, smooth)
    else:
        co = co + nrm * offset
    if jitter:
        rng = np.random.default_rng(seed)
        co = co + nrm * rng.normal(0, jitter, len(co))[:, None]
    set_mesh_co(ob, co)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    kill = [bm.verts[i] for i in np.where(~mask)[0]]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return ob


def make_body_variant(body, keep_mask, name):
    me = body.data.copy()
    me.name = name
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for vg in body.vertex_groups:
        ob.vertex_groups.new(name=vg.name)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    kill = [bm.verts[i] for i in np.where(~keep_mask)[0]]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(me)
    bm.free()
    return ob


def grow_mask(body, mask, rings=2):
    """Grow a vertex mask by edge rings (used to keep a margin of skin under clothes)."""
    me = body.data
    e = np.empty(len(me.edges) * 2, np.int64)
    me.edges.foreach_get("vertices", e)
    e = e.reshape(-1, 2)
    m = mask.copy()
    for _ in range(rings):
        hit = m[e[:, 0]] | m[e[:, 1]]
        m[e[hit, 0]] = True
        m[e[hit, 1]] = True
    return m


# --------------------------------------------------------------------------- materials
def _obj_color_node(nt):
    oi = nt.nodes.new("ShaderNodeObjectInfo")
    return oi.outputs["Color"]


def make_material(name, kind):
    """Materials take their base color from the object color, so instances can vary."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_fake_user = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    col = _obj_color_node(nt)
    tex = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 60.0
    noise.inputs["Detail"].default_value = 6.0
    nt.links.new(tex.outputs["Object"], noise.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs["Factor"].default_value = 0.25
    nt.links.new(col, mix.inputs[6])
    nt.links.new(noise.outputs["Color"], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    bump.inputs["Distance"].default_value = 0.002
    fine = nt.nodes.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 900.0
    nt.links.new(tex.outputs["Object"], fine.inputs["Vector"])
    nt.links.new(fine.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], bsdf.inputs["Normal"])
    I = bsdf.inputs
    if kind == "skin":
        mix.inputs["Factor"].default_value = 0.12
        I["Roughness"].default_value = 0.48
        I["Subsurface Weight"].default_value = 0.22
        I["Subsurface Radius"].default_value = (1.0, 0.35, 0.18)
        I["Subsurface Scale"].default_value = 0.006
        bump.inputs["Strength"].default_value = 0.05
    elif kind == "cloth":
        I["Roughness"].default_value = 0.88
        I["Sheen Weight"].default_value = 0.35
        I["Sheen Roughness"].default_value = 0.6
    elif kind == "denim":
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.wave_type = 'BANDS'
        wave.bands_direction = 'DIAGONAL'
        wave.inputs["Scale"].default_value = 260.0
        wave.inputs["Distortion"].default_value = 2.0
        nt.links.new(tex.outputs["Object"], wave.inputs["Vector"])
        nt.links.new(wave.outputs["Fac"], bump.inputs["Height"])
        bump.inputs["Strength"].default_value = 0.15
        mix.inputs["Factor"].default_value = 0.35
        I["Roughness"].default_value = 0.82
    elif kind == "leather":
        I["Roughness"].default_value = 0.38
        I["Coat Weight"].default_value = 0.15
        mix.inputs["Factor"].default_value = 0.15
    elif kind == "hair":
        noise.inputs["Scale"].default_value = 15.0
        I["Roughness"].default_value = 0.42
        I["Anisotropic"].default_value = 0.6
        I["Sheen Weight"].default_value = 0.4
        bump.inputs["Strength"].default_value = 0.35
        fine.inputs["Scale"].default_value = 400.0
        fine.inputs["Detail"].default_value = 2.0
        mapping = nt.nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (12.0, 12.0, 0.4)
        nt.links.new(tex.outputs["Object"], mapping.inputs["Vector"])
        nt.links.new(mapping.outputs[0], fine.inputs["Vector"])
    elif kind == "shoe":
        I["Roughness"].default_value = 0.5
        I["Coat Weight"].default_value = 0.1
    elif kind == "plastic":
        I["Roughness"].default_value = 0.4
    elif kind == "paper":
        I["Roughness"].default_value = 0.9
    elif kind == "eye":
        nt.nodes.remove(mix)
        I["Base Color"].default_value = (0.08, 0.05, 0.035, 1)
        I["Roughness"].default_value = 0.05
        I["Coat Weight"].default_value = 1.0
    elif kind == "glasses":
        nt.nodes.remove(mix)
        I["Base Color"].default_value = (0.01, 0.01, 0.012, 1)
        I["Roughness"].default_value = 0.08
        I["Metallic"].default_value = 0.6
    return mat


# --------------------------------------------------------------------------- accessories
def weighted_object(name, bm, bone_weights, rig=None):
    """Mesh from a bmesh, every vertex weighted to the given {bone: weight} (or per-vertex callable)."""
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    co = mesh_co(ob)
    for i, b in enumerate(BONE_NAMES):
        ob.vertex_groups.new(name=P + b)
    for vi in range(len(co)):
        wmap = bone_weights(co[vi]) if callable(bone_weights) else bone_weights
        for b, w in wmap.items():
            if w > 0:
                ob.vertex_groups[P + b].add([vi], w, 'REPLACE')
    for p in me.polygons:
        p.use_smooth = True
    return ob


def bm_box(size, center, bevel=0.0, segs=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segs, affect='EDGES', profile=0.5)
    bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
    return bm


def build_accessories(kind, J, R):
    acc = {}
    sp2 = J["Spine2"]
    back_y = R["co"][(np.abs(R["co"][:, 2] - sp2[2]) < 0.02) & (np.abs(R["co"][:, 0]) < 0.08)][:, 1].max()
    # backpack: sits on the upper back
    bm = bm_box((0.30, 0.15, 0.40), (0, back_y + 0.095, sp2[2] - 0.03), bevel=0.045, segs=3)
    acc["Backpack"] = weighted_object(f"Acc_{kind}_Backpack", bm, {"Spine2": 0.75, "Spine1": 0.25})
    # cross-body bag at the hip
    hz = J["Hips"][2]
    bm = bm_box((0.07, 0.24, 0.20), (J["RightUpLeg"][0] - 0.12, J["Hips"][1] + 0.0, hz - 0.03), bevel=0.02)
    acc["HipBag"] = weighted_object(f"Acc_{kind}_HipBag", bm, {"Hips": 1.0})
    # shopping bag hanging from the right hand
    w = J["RightHand"]
    tip = J["RightHand_tail"]
    bm = bm_box((0.11, 0.30, 0.34), (tip[0] - 0.015, tip[1] + 0.02, tip[2] - 0.17), bevel=0.01)
    acc["ShopBag"] = weighted_object(f"Acc_{kind}_ShopBag", bm, {"RightHand": 1.0})
    # coffee cup in the left hand
    lt = J["LeftHand_tail"]
    lw = J["LeftHand"]
    c = lw + 0.55 * (lt - lw)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.028, radius2=0.04, depth=0.14)
    bmesh.ops.translate(bm, vec=Vector((c[0] + 0.03, c[1] - 0.035, c[2] + 0.01)), verts=bm.verts)
    acc["Cup"] = weighted_object(f"Acc_{kind}_Cup", bm, {"LeftHand": 1.0})
    # baseball cap
    hc = R["head_c"]
    top = R["zmax"]
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10, radius=0.102)
    for v in list(bm.verts):
        if v.co.z < -0.005:
            v.co.z = -0.005
    bmesh.ops.scale(bm, vec=Vector((0.95, 1.08, 0.82)), verts=bm.verts)
    brim = bmesh.new()
    bmesh.ops.create_circle(brim, cap_ends=True, segments=20, radius=0.09)
    bmesh.ops.scale(brim, vec=Vector((0.95, 0.75, 1)), verts=brim.verts)
    bmesh.ops.translate(brim, vec=Vector((0, -0.10, -0.004)), verts=brim.verts)
    me_tmp = bpy.data.meshes.new("tmp")
    brim.to_mesh(me_tmp)
    brim.free()
    bm.from_mesh(me_tmp)
    bpy.data.meshes.remove(me_tmp)
    bmesh.ops.translate(bm, vec=Vector((hc[0], hc[1] + 0.005, top - 0.075)), verts=bm.verts)
    acc["Cap"] = weighted_object(f"Acc_{kind}_Cap", bm, {"Head": 1.0})
    # sunglasses: a thin curved slab in front of the eyes
    eye_z = R["co"][R["is_eye"]][:, 2].mean() if R["is_eye"].any() else hc[2]
    eye_y = R["co"][R["is_eye"]][:, 1].min() if R["is_eye"].any() else hc[1] - 0.08
    bm = bm_box((0.135, 0.012, 0.045), (0, eye_y - 0.012, eye_z), bevel=0.01)
    acc["Glasses"] = weighted_object(f"Acc_{kind}_Glasses", bm, {"Head": 1.0})
    return acc


def long_hair(kind, J, R):
    """Hair falling from the crown to the shoulder blades, following the back of the head."""
    co, dom = R["co"], R["dom"]
    hc = R["head_c"].copy()
    head = co[(dom == "Head") & ~R["is_eye"]]
    top = R["zmax"]
    z_chin = J["Head"][2] - 0.02
    z1 = J["Neck"][2] - 0.14
    rows, cols = 16, 22
    rel = head - hc
    hr = np.hypot(rel[:, 0], rel[:, 1])
    hth = np.arctan2(rel[:, 0], rel[:, 1])          # 0 = straight back (+Y)
    rmax = hr.max()

    def head_r(z, th):
        m = (np.abs(head[:, 2] - z) < 0.015) & (np.abs(np.angle(np.exp(1j * (hth - th)))) < 0.25)
        return hr[m].max() if m.any() else None
    bm = bmesh.new()
    grid = []
    for i in range(rows + 1):
        t = i / rows
        z = top - 0.035 + (z1 - (top - 0.035)) * t
        span = math.radians(112 - 30 * max(0.0, (t - 0.45) / 0.55))
        row = []
        for j in range(cols + 1):
            th = -span + 2 * span * j / cols
            if z > z_chin:
                r = head_r(z, th)
                r = (r if r is not None else rmax * 0.8) + 0.013
            else:
                r = rmax + 0.012 + 0.035 * (z_chin - z) / (z_chin - z1)
            yy = math.cos(th)
            r_eff = r if yy > -0.1 else r * 0.97
            row.append(bm.verts.new((hc[0] + r_eff * math.sin(th), hc[1] + r_eff * math.cos(th), z)))
        grid.append(row)
    for i in range(rows):
        for j in range(cols):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.014)
    zh, zs = J["Head"][2], J["Spine2"][2] + 0.08

    def w(p):
        t = float(np.clip((zh - p[2]) / (zh - zs), 0, 1))
        return {"Head": 1 - t, "Neck": 0.5 * t, "Spine2": 0.5 * t}
    return weighted_object(f"Hair_{kind}_long_back", bm, w)


# --------------------------------------------------------------------------- main
def build_kind(kind, level, src, W_from=None):
    body, n_body = load_base_body(kind, level)
    co = mesh_co(body)
    J, H = fit_joints(co[:n_body])
    if W_from is None:
        heat = build_heat_rig(f"HeatRig_{kind}", J)
        heat_weights(body, heat)
        bpy.data.objects.remove(heat, do_unlink=True)
        W = weights_array(body)
        if (W.sum(1) < 1e-3).mean() > 0.05:
            raise RuntimeError(f"bone heat failed for {kind}")
    else:
        W = W_from.copy()            # same vertex order on both base bodies
    eye_idx = np.arange(n_body, len(co))
    W[eye_idx] = 0
    W[eye_idx, BONE_NAMES.index("Head")] = 1
    W /= np.maximum(W.sum(1, keepdims=True), 1e-6)
    set_weights(body, W)
    body.data.materials.append(make_material("H_skin", "skin"))
    body.data.materials.append(make_material("H_eye", "eye"))
    for poly in body.data.polygons:
        if min(poly.vertices) >= n_body:
            poly.material_index = 1
    rots = chain_rotations(J)
    rig = build_anim_rig(f"Rig_{kind}", J, rots)
    rig.use_fake_user = True
    v_walk, hip_s = measure_speed(src, bpy.data.actions["walk"])
    v_run, _ = measure_speed(src, bpy.data.actions["run"])
    scale = J["LeftUpLeg"][2] / hip_s
    acts = retarget(src, ["walk", "run", "idle", "agree", "headShake", "sneak_pose", "sad_pose"], rots, scale, kind)
    rig["walk_speed"] = v_walk * scale
    rig["run_speed"] = v_run * scale
    rig["height"] = H
    rig["joints"] = {k: list(map(float, v)) for k, v in J.items()}

    mats = {k: make_material(f"H_{k}", k) for k in
            ("skin", "cloth", "denim", "leather", "hair", "shoe", "plastic", "paper", "eye", "glasses")}
    parts = dress(body, n_body, J, kind, "", mats, rig, accessories=True)
    # low-detail version (multires level 0) bound to the same rig, weights transferred by proximity
    lo, n_lo = load_base_body(kind, 0)
    co_hi = mesh_co(body)
    co_lo = mesh_co(lo)
    from mathutils.kdtree import KDTree
    kd = KDTree(n_body)
    for i in range(n_body):
        kd.insert(co_hi[i], i)
    kd.balance()
    Wl = np.zeros((len(co_lo), len(BONE_NAMES)), np.float32)
    for i in range(n_lo):
        ws = 0.0
        for (_, j, d) in kd.find_n(co_lo[i], 3):
            w = 1.0 / (d + 1e-4)
            Wl[i] += W[j] * w
            ws += w
        Wl[i] /= ws
    Wl[n_lo:] = 0
    Wl[n_lo:, BONE_NAMES.index("Head")] = 1
    set_weights(lo, Wl)
    lo.data.materials.append(make_material("H_skin", "skin"))
    lo.data.materials.append(make_material("H_eye", "eye"))
    for poly in lo.data.polygons:
        if min(poly.vertices) >= n_lo:
            poly.material_index = 1
    lo.name = f"Body_{kind}_L0src"
    parts_lo = dress(lo, n_lo, J, kind, "_L0", mats, rig, accessories=False)
    for k, ob in parts_lo.items():
        parts[k + "_L0"] = ob
    return rig, parts, acts, W


def dress(body, n_body, J, kind, sfx, mats, rig, accessories=True):
    """Clothing shells, hair, skin cut-aways (+ accessories) for one LOD of a body."""
    R = region_info(body, J, n_body)
    parts = {}
    tops = {"tee": (0.009, 18), "long": (0.012, 24), "jacket": (0.024, 40)}
    k_s = 0.5 if sfx else 1.0          # level 0 has ~4x fewer, ~2x longer edges
    for top, (off, sm) in tops.items():
        mt, mb, ms = outfit_masks(R, J, top, "pants")
        parts[f"Top_{top}"] = make_shell(body, mt, R, off, f"Top_{kind}_{top}{sfx}", smooth=max(2, int(sm * k_s)))
    _, m_pants, m_shoe = outfit_masks(R, J, "long", "pants")
    _, m_shorts, _ = outfit_masks(R, J, "long", "shorts")
    parts["Pants"] = make_shell(body, m_pants, R, 0.013, f"Pants_{kind}{sfx}", smooth=max(2, int(22 * k_s)))
    parts["Shorts"] = make_shell(body, m_shorts, R, 0.013, f"Shorts_{kind}{sfx}", smooth=max(2, int(18 * k_s)))
    parts["Shoes"] = make_shell(body, m_shoe, R, 0.010, f"Shoes_{kind}{sfx}", smooth=max(2, int(6 * k_s)))
    parts["Hair_short"] = make_shell(body, hair_mask(R, J, "short"), R, 0.011, f"Hair_{kind}_short{sfx}",
                                     jitter=0.0025, smooth=2)
    parts["Hair_cap"] = make_shell(body, hair_mask(R, J, "long"), R, 0.014, f"Hair_{kind}_cap{sfx}",
                                   jitter=0.002, smooth=2)
    m_tee, _, _ = outfit_masks(R, J, "tee", "pants")
    m_long, _, _ = outfit_masks(R, J, "long", "pants")
    variants = {"long": m_long | m_pants | m_shoe, "tee": m_tee | m_pants | m_shoe,
                "teeshorts": m_tee | m_shorts | m_shoe}
    for vn, cover in variants.items():
        keep = grow_mask(body, ~cover, 2) | R["is_eye"]
        parts[f"Body_{vn}"] = make_body_variant(body, keep, f"Body_{kind}_{vn}{sfx}")
    if accessories:
        parts["Hair_longback"] = long_hair(kind, J, R)
        parts["Body_full"] = body
        parts.update(build_accessories(kind, J, R))
    else:
        bpy.data.objects.remove(body, do_unlink=True)
    matmap = {"Top": "cloth", "Pants": "denim", "Shorts": "cloth", "Shoes": "shoe", "Hair": "hair",
              "Body": "skin", "Backpack": "plastic", "HipBag": "leather", "ShopBag": "paper",
              "Cup": "paper", "Cap": "cloth", "Glasses": "glasses"}
    for key, ob in parts.items():
        base = key.split("_")[0]
        if base != "Body":
            ob.data.materials.clear()
            ob.data.materials.append(mats[matmap[base]])
        bind(ob, rig)
        ob.use_fake_user = True
        ob["part"] = key + sfx
    return parts


def main(out_path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30
    src, src_objs = import_xbot()
    result = {}
    result["male"] = build_kind("male", 1, src)
    result["female"] = build_kind("female", 1, src, W_from=result["male"][3])
    # drop the Xbot import
    for o in src_objs:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions):
        if not a.use_fake_user:
            bpy.data.actions.remove(a)
    bpy.ops.wm.save_as_mainfile(filepath=out_path)
    for kind, (rig, parts, acts, _) in result.items():
        print("BUILT", kind, rig.name, dict(rig.items()).get("walk_speed"), len(parts), list(acts))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    main(argv[0] if argv else "/opt/work/assets/humans.blend")
