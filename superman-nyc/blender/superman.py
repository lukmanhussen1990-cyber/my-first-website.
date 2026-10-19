"""The hero: realistic male base mesh, bulked up, rigged, costumed and animated along the
timeline trajectory.  Exports the per-frame cape attachment frames for the cloth sim.

Run:  blender -b --factory-startup -P superman.py -- /opt/work/assets/superman.blend
"""
import bpy
import bmesh
import math
import os
import sys
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))
import humans_build as hb  # noqa: E402
import timeline as TL  # noqa: E402
from city import NT, simple_material, _img  # noqa: E402

P = hb.P
HEIGHT = 1.91
GEN = "/opt/work/assets/gen"
CACHE = "/opt/work/cache"


# ------------------------------------------------------------------------------ materials
def suit_materials():
    M = {}
    m = bpy.data.materials.new("SM_Suit")
    T = NT(m)
    tc = T.node("ShaderNodeTexCoord")
    # fine scale-like texture of the modern suit
    vor = T.node("ShaderNodeTexVoronoi", Vector=tc.outputs["Object"], Scale=260.0)
    bump = T.node("ShaderNodeBump", Strength=0.25, Distance=0.0015, Height=vor.outputs["Distance"])
    nz = T.node("ShaderNodeTexNoise", Vector=tc.outputs["Object"], Scale=6.0, Detail=4.0)
    col = T.mixc(T.math('MULTIPLY', nz.outputs["Fac"], 0.25), (0.012, 0.045, 0.20, 1), (0.02, 0.07, 0.30, 1))
    b = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": col, "Roughness": 0.58, "Sheen Weight": 0.7,
                                              "Sheen Tint": (0.4, 0.55, 1.0, 1), "Normal": bump.outputs[0],
                                              "Coat Weight": 0.05, "Coat Roughness": 0.4})
    T.out(b.outputs[0])
    M["suit"] = m
    M["red"] = simple_material("SM_Red", (0.36, 0.012, 0.012), 0.5, coat=0.1)
    M["belt"] = simple_material("SM_Belt", (0.75, 0.48, 0.03), 0.35, 0.3, coat=0.3)
    sk = bpy.data.materials.new("SM_Skin")
    T = NT(sk)
    tc = T.node("ShaderNodeTexCoord")
    nz = T.node("ShaderNodeTexNoise", Vector=tc.outputs["Object"], Scale=80.0, Detail=8.0)
    bump = T.node("ShaderNodeBump", Strength=0.08, Distance=0.001, Height=nz.outputs["Fac"])
    b = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": (0.42, 0.25, 0.17, 1), "Roughness": 0.45,
                                              "Subsurface Weight": 0.25, "Subsurface Radius": (1.0, 0.35, 0.2),
                                              "Subsurface Scale": 0.008, "Normal": bump.outputs[0]})
    T.out(b.outputs[0])
    M["skin"] = sk
    hair = bpy.data.materials.new("SM_Hair")
    T = NT(hair)
    tc = T.node("ShaderNodeTexCoord")
    mp = T.node("ShaderNodeMapping", Vector=tc.outputs["Object"])
    mp.inputs["Scale"].default_value = (60.0, 2.0, 60.0)
    nz = T.node("ShaderNodeTexNoise", Vector=mp.outputs[0], Scale=12.0, Detail=2.0)
    bump = T.node("ShaderNodeBump", Strength=0.12, Distance=0.001, Height=nz.outputs["Fac"])
    b = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": (0.008, 0.008, 0.01, 1), "Roughness": 0.3,
                                              "Anisotropic": 0.7, "Coat Weight": 0.4, "Normal": bump.outputs[0]})
    T.out(b.outputs[0])
    M["hair"] = hair
    # eyes: dark blue normally; 'eye_glow' (object prop) drives a red-hot emission
    ey = bpy.data.materials.new("SM_Eyes")
    T = NT(ey)
    g = T.attr("eye_glow").outputs["Fac"]
    col = T.mixc(T.math('MINIMUM', g, 1.0), (0.02, 0.05, 0.12, 1), (1.0, 0.08, 0.02, 1))
    b = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": col, "Roughness": 0.05, "Coat Weight": 1.0,
                                              "Emission Color": (1.0, 0.12, 0.03, 1),
                                              "Emission Strength": T.math('MULTIPLY', g, 60.0)})
    T.out(b.outputs[0])
    M["eyes"] = ey
    em = bpy.data.materials.new("SM_Emblem")
    T = NT(em)
    uv = T.node("ShaderNodeUVMap")
    tex = T.node("ShaderNodeTexImage", Vector=uv.outputs[0])
    tex.image = _img(f"{GEN}/emblem.png")
    tex.extension = 'CLIP'
    b = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": tex.outputs[0], "Roughness": 0.35, "Coat Weight": 0.4,
                                              "Alpha": tex.outputs["Alpha"]})
    T.out(b.outputs[0])
    M["emblem"] = em
    cape = bpy.data.materials.new("SM_Cape")
    T = NT(cape)
    tc = T.node("ShaderNodeTexCoord")
    nz = T.node("ShaderNodeTexNoise", Vector=tc.outputs["UV"], Scale=60.0, Detail=6.0)
    bump = T.node("ShaderNodeBump", Strength=0.12, Distance=0.002, Height=nz.outputs["Fac"])
    b = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": (0.30, 0.008, 0.01, 1), "Roughness": 0.55,
                                              "Sheen Weight": 0.8, "Sheen Tint": (1.0, 0.3, 0.3, 1),
                                              "Subsurface Weight": 0.0, "Normal": bump.outputs[0]})
    tr = T.node("ShaderNodeBsdfTranslucent", Color=(0.5, 0.01, 0.01, 1))
    T.out(T.mixs(0.12, b.outputs[0], tr.outputs[0]))
    M["cape"] = cape
    for m in M.values():
        m.cycles.emission_sampling = 'NONE'
        m.use_fake_user = True
    return M


# ------------------------------------------------------------------------------ body
def bulk_up(body, n_body, J, W):
    """Superhero proportions: push chest/shoulders/arms/back/thighs out along the normals."""
    co = hb.mesh_co(body)
    nrm = np.empty(len(co) * 3)
    body.data.vertices.foreach_get("normal", nrm)
    nrm = nrm.reshape(-1, 3)
    gain = {"Spine2": 0.016, "LeftShoulder": 0.016, "RightShoulder": 0.016, "Spine1": 0.009, "Spine": 0.004,
            "LeftArm": 0.012, "RightArm": 0.012, "LeftForeArm": 0.006, "RightForeArm": 0.006,
            "LeftUpLeg": 0.007, "RightUpLeg": 0.007, "LeftLeg": 0.004, "RightLeg": 0.004, "Neck": 0.008}
    g = np.zeros(len(co))
    for b, a in gain.items():
        g += W[:, hb.BONE_NAMES.index(b)] * a
    g[n_body:] = 0.0
    # smooth the displacement field so region borders stay invisible
    E = hb.edges_array(body)
    for _ in range(25):
        acc = np.zeros(len(co))
        cnt = np.zeros(len(co))
        np.add.at(acc, E[:, 0], g[E[:, 1]])
        np.add.at(acc, E[:, 1], g[E[:, 0]])
        np.add.at(cnt, E[:, 0], 1)
        np.add.at(cnt, E[:, 1], 1)
        g = 0.5 * g + 0.5 * acc / np.maximum(cnt, 1)
    hb.set_mesh_co(body, co + nrm * g[:, None])


def costume_regions(body, n_body, J, W):
    """Assign material indices: 0 suit, 1 red (boots/trunks), 2 belt, 3 skin, 4 eyes."""
    co = hb.mesh_co(body)
    dom = np.array(hb.BONE_NAMES)[np.argmax(W, axis=1)]
    polys = body.data.polygons
    pv = [tuple(p.vertices) for p in polys]
    hips_z = J["Hips"][2]
    crotch = J["LeftUpLeg"][2] - 0.10
    knee = J["LeftLeg"][2]
    neck = J["Neck"][2]
    idx = np.zeros(len(polys), np.int32)
    for i, vs in enumerate(pv):
        c = co[list(vs)].mean(0)
        d = dom[vs[0]]
        if min(vs) >= n_body:
            idx[i] = 4
            continue
        if d in ("Head",) or (d == "Neck" and c[2] > neck + 0.02):
            idx[i] = 3
            continue
        if d in ("LeftHand", "RightHand"):
            idx[i] = 3
            continue
        if c[2] < knee - 0.10:                        # boots
            idx[i] = 1
            continue
        if hips_z + 0.035 < c[2] < hips_z + 0.085 and d not in ("LeftForeArm", "RightForeArm"):
            idx[i] = 2                                  # belt
            continue
        ax = abs(c[0])
        leg_line = crotch - 0.03 + 0.11 * min(1.0, max(0.0, (ax - 0.05) / 0.14))
        if leg_line < c[2] <= hips_z + 0.035 and d not in ("LeftForeArm", "RightForeArm", "LeftArm", "RightArm"):
            idx[i] = 1                                  # trunks
            continue
    body.data.polygons.foreach_set("material_index", idx.tolist())


def make_emblem(body, n_body, J, M):
    """Decal: the chest region projected flat from the front, slightly offset from the suit."""
    co = hb.mesh_co(body)
    sp2 = J["Spine2"]
    cx, cz = 0.0, sp2[2] + 0.06
    half = 0.12
    mask = (np.abs(co[:, 0] - cx) < half + 0.02) & (np.abs(co[:, 2] - cz) < half + 0.02) & (co[:, 1] < sp2[1] - 0.04)
    mask[n_body:] = False
    me = body.data.copy()
    ob = bpy.data.objects.new("SM_EmblemDecal", me)
    bpy.context.scene.collection.objects.link(ob)
    for vg in body.vertex_groups:
        ob.vertex_groups.new(name=vg.name)
    nrm = np.empty(len(co) * 3)
    body.data.vertices.foreach_get("normal", nrm)
    hb.set_mesh_co(ob, co + nrm.reshape(-1, 3) * 0.0025)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.where(~mask)[0]], context='VERTS')
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops:
            p = l.vert.co
            l[uvl].uv = ((p.x - cx) / (2 * half) + 0.5, (p.z - cz) / (2 * half) + 0.5)
    bm.to_mesh(me)
    bm.free()
    me.materials.clear()
    me.materials.append(M["emblem"])
    return ob


def make_curl(J, R, M):
    """The forehead curl: a small tapered spiral tube weighted to the head."""
    hc = R["head_c"]
    top = R["zmax"]
    face_y = R["co"][(np.abs(R["co"][:, 0]) < 0.02) & (R["co"][:, 2] > top - 0.08)][:, 1].min()
    pts = []
    for k in range(18):
        t = k / 17
        a = 1.9 * math.pi * t
        r = 0.022 * (1 - 0.55 * t)
        pts.append((0.012 + r * math.sin(a), face_y - 0.004 - 0.004 * t, top - 0.055 - 0.03 * t - r * (1 - math.cos(a)) * 0.6))
    bm = bmesh.new()
    rings = []
    for k, p in enumerate(pts):
        rad = 0.0055 * (1 - 0.7 * k / len(pts))
        ring = [bm.verts.new((p[0] + rad * math.cos(a), p[1] + rad * math.sin(a) * 0.6, p[2] + rad * math.sin(a)))
                for a in np.linspace(0, 2 * math.pi, 6, endpoint=False)]
        rings.append(ring)
    for a, b in zip(rings[:-1], rings[1:]):
        for i in range(6):
            bm.faces.new((a[i], a[(i + 1) % 6], b[(i + 1) % 6], b[i]))
    ob = hb.weighted_object("SM_Curl", bm, {"Head": 1.0})
    ob.data.materials.append(M["hair"])
    return ob


# ------------------------------------------------------------------------------ posing
def world_delta_pose(rig, deltas):
    """deltas: bone -> world-space (armature-space) rotation relative to rest.
    Returns local quaternions for every bone (parents first)."""
    out = {}
    rest = {b.name: b.matrix_local.to_3x3() for b in rig.data.bones}
    for name, parent in hb.BONES:
        Qb = deltas.get(name, None)
        Qp = None
        # inherited delta: a bone without its own delta follows its parent
        p = parent
        Qp = out.get("_W_" + parent) if parent else Quaternion()
        if Qb is None:
            Qb = Qp
        Rr = rest[P + name]
        rel = Qp.inverted() @ Qb
        local = (Rr.inverted() @ rel.to_matrix() @ Rr).to_quaternion()
        out[name] = local
        out["_W_" + name] = Qb
    return {k: v for k, v in out.items() if not k.startswith("_W_")}


def aim(src_dir, dst_dir):
    return Vector(src_dir).normalized().rotation_difference(Vector(dst_dir).normalized())


def poses(J):
    """Key poses as world-space deltas (character frame: faces -Y, up +Z, left +X)."""
    L_arm = Vector(J["LeftHand"] - J["LeftArm"]).normalized()
    R_arm = Vector(J["RightHand"] - J["RightArm"]).normalized()
    X = Vector((1, 0, 0))
    out = {}
    # --- flying: right fist forward over the head, left arm along the side, legs together
    fly = {}
    fly["RightArm"] = aim(R_arm, (-0.08, -0.22, 1.0))
    fly["RightForeArm"] = fly["RightArm"]
    fly["LeftArm"] = aim(L_arm, (0.10, 0.10, -1.0))
    fly["LeftForeArm"] = Quaternion(X, math.radians(-18)) @ fly["LeftArm"]
    fly["LeftUpLeg"] = Quaternion((0, 1, 0), math.radians(-3))
    fly["RightUpLeg"] = Quaternion((0, 1, 0), math.radians(3)) @ Quaternion(X, math.radians(-6))
    fly["RightLeg"] = Quaternion(X, math.radians(22)) @ fly["RightUpLeg"]
    fly["LeftFoot"] = Quaternion(X, math.radians(30))
    fly["RightFoot"] = Quaternion(X, math.radians(30)) @ fly["RightLeg"]
    fly["Neck"] = Quaternion(X, math.radians(-25))
    fly["Head"] = Quaternion(X, math.radians(-62))
    out["fly"] = fly
    # --- hover: arms slightly out, fists, toes pointing down, slight knee bend
    hov = {}
    hov["LeftArm"] = aim(L_arm, (0.26, -0.02, -1.0))
    hov["RightArm"] = aim(R_arm, (-0.26, -0.02, -1.0))
    hov["LeftForeArm"] = Quaternion(X, math.radians(-12)) @ hov["LeftArm"]
    hov["RightForeArm"] = Quaternion(X, math.radians(-12)) @ hov["RightArm"]
    hov["LeftUpLeg"] = Quaternion(X, math.radians(-4))
    hov["RightUpLeg"] = Quaternion(X, math.radians(6))
    hov["LeftLeg"] = Quaternion(X, math.radians(10)) @ hov["LeftUpLeg"]
    hov["RightLeg"] = Quaternion(X, math.radians(18)) @ hov["RightUpLeg"]
    hov["LeftFoot"] = Quaternion(X, math.radians(42)) @ hov["LeftLeg"]
    hov["RightFoot"] = Quaternion(X, math.radians(48)) @ hov["RightLeg"]
    hov["Spine2"] = Quaternion(X, math.radians(3))
    out["hover"] = hov
    # --- menace: chin down, shoulders forward, fists tight (heat vision, the stare)
    men = dict(hov)
    men["Spine2"] = Quaternion(X, math.radians(7))
    men["Neck"] = Quaternion(X, math.radians(10)) @ men["Spine2"]
    men["Head"] = Quaternion(X, math.radians(12)) @ men["Spine2"]
    men["LeftArm"] = aim(L_arm, (0.30, -0.06, -1.0))
    men["RightArm"] = aim(R_arm, (-0.30, -0.06, -1.0))
    men["LeftForeArm"] = Quaternion(X, math.radians(-28)) @ men["LeftArm"]
    men["RightForeArm"] = Quaternion(X, math.radians(-28)) @ men["RightArm"]
    out["menace"] = men
    # --- coil: legs drawn up before the launch
    coil = dict(men)
    coil["LeftUpLeg"] = Quaternion(X, math.radians(-55))
    coil["RightUpLeg"] = Quaternion(X, math.radians(-40))
    coil["LeftLeg"] = Quaternion(X, math.radians(70)) @ coil["LeftUpLeg"]
    coil["RightLeg"] = Quaternion(X, math.radians(60)) @ coil["RightUpLeg"]
    coil["Spine2"] = Quaternion(X, math.radians(18))
    coil["Head"] = Quaternion(X, math.radians(-8)) @ coil["Spine2"]
    out["coil"] = coil
    return out


# (time, pose) keys; consecutive keys are interpolated
POSE_KEYS = [
    (5.0, "fly"), (11.4, "fly"), (12.0, "hover"), (13.2, "menace"), (19.0, "menace"),
    (19.45, "fly"), (28.9, "fly"), (29.9, "hover"), (31.0, "menace"), (34.55, "menace"), (34.85, "coil"),
    (35.12, "fly"), (40.0, "fly"),
]

# orientation mode: 'fly' (body axis along the velocity) or 'upright' facing a target
HOVER_SPANS = [(11.9, 19.35, "tower"), (29.95, 34.95, "camera")]


def root_orientation(t, prev=None):
    """Rotation matrix for the root (local +Z = head direction, local -Y = chest/front)."""
    t_path0 = TL.SUPERMAN_PATH[0][0] + 0.05
    v = Vector(TL.superman_vel(max(t, t_path0)))
    speed = v.length
    mode = None
    for a, b, tgt in HOVER_SPANS:
        if a <= t <= b:
            mode = tgt
    # flight frame
    fwd = v.normalized() if speed > 0.5 else Vector((0, 0, 1))
    down = Vector((0, 0, -1))
    ref = (prev.col[1] * -1) if prev is not None else down
    front = (0.75 * down + 0.25 * ref)
    front = (front - fwd * front.dot(fwd))
    if front.length < 1e-3:
        front = ref - fwd * ref.dot(fwd)
    if front.length < 1e-3:
        front = Vector((0, 1, 0)) - fwd * fwd.y
    front.normalize()
    z = fwd
    y = -front
    x = y.cross(z).normalized()
    y = z.cross(x)
    Rfly = Matrix((x, y, z)).transposed()
    # upright frame toward the target
    p = Vector(TL.superman_pos(t))
    if mode == "camera":
        target = Vector((-16.4, -33.6, 1.5))
    else:
        target = Vector(TL.beam_target(min(max(t, TL.T_BEAM_ON), TL.T_BEAM_OFF)))
    d = target - p
    d.z = 0
    d.normalize()
    front_u = d
    zu = Vector((0, 0, 1))
    yu = -front_u
    xu = yu.cross(zu).normalized()
    Rup = Matrix((xu, yu, zu)).transposed()
    # blend weight: 1 inside hover spans with 0.45 s ramps
    w = 0.0
    for a, b, tgt in HOVER_SPANS:
        if a - 0.45 <= t <= b + 0.3:
            w = max(w, min(1.0, (t - (a - 0.45)) / 0.45, (b + 0.3 - t) / 0.3))
    w = w * w * (3 - 2 * w)
    q = Rfly.to_quaternion().slerp(Rup.to_quaternion(), w)
    return q.to_matrix()


def build(out_path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = TL.FPS
    sc.frame_start, sc.frame_end = 0, TL.N_FRAMES - 1
    src, src_objs = hb.import_xbot()
    # bone heat is solved on the level-1 mesh (it fails at level 2) and transferred by proximity
    lo, n_lo = hb.load_base_body("male", 1)
    lo.name = "SM_TMP_L1"
    co_lo = hb.mesh_co(lo)
    s = HEIGHT / (co_lo[:, 2].max() - co_lo[:, 2].min())
    hb.set_mesh_co(lo, co_lo * s)
    co_lo = hb.mesh_co(lo)
    J, H = hb.fit_joints(co_lo[:n_lo])
    heat = hb.build_heat_rig("SM_HeatRig", J)
    hb.heat_weights(lo, heat)
    bpy.data.objects.remove(heat, do_unlink=True)
    W_lo = hb.weights_array(lo)
    if (W_lo.sum(1) < 1e-3).mean() > 0.05:
        raise RuntimeError("bone heat failed for the hero body")
    body, n_body = hb.load_base_body("male", 2)
    co = hb.mesh_co(body)
    hb.set_mesh_co(body, co * s)
    co = hb.mesh_co(body)
    from mathutils.kdtree import KDTree
    kd = KDTree(n_lo)
    for i in range(n_lo):
        kd.insert(co_lo[i], i)
    kd.balance()
    W = np.zeros((len(co), len(hb.BONE_NAMES)), np.float32)
    for i in range(n_body):
        hits = kd.find_n(co[i], 3)
        wsum = 0.0
        for (_, j, d) in hits:
            w = 1.0 / (d + 1e-4)
            W[i] += W_lo[j] * w
            wsum += w
        W[i] /= wsum
    bpy.data.objects.remove(lo, do_unlink=True)
    eye = np.arange(n_body, len(co))
    W[eye] = 0
    W[eye, hb.BONE_NAMES.index("Head")] = 1
    W /= np.maximum(W.sum(1, keepdims=True), 1e-6)
    hb.set_weights(body, W)
    bulk_up(body, n_body, J, W)
    rots = hb.chain_rotations(J)
    rig = hb.build_anim_rig("SM_Rig", J, rots)
    for o in src_objs:
        bpy.data.objects.remove(o, do_unlink=True)
    M = suit_materials()
    body.name = "SM_Body"
    me = body.data
    me.materials.clear()
    for k in ("suit", "red", "belt", "skin", "eyes"):
        me.materials.append(M[k])
    costume_regions(body, n_body, J, W)
    R = hb.region_info(body, J, n_body)
    hair = hb.make_shell(body, hb.hair_mask(R, J, "short"), R, 0.008, "SM_Hair", jitter=0.0, smooth=5)
    hair.data.materials.clear()
    hair.data.materials.append(M["hair"])
    curl = make_curl(J, R, M)
    emblem = make_emblem(body, n_body, J, M)
    for ob in (body, hair, curl, emblem):
        hb.bind(ob, rig)
    body["eye_glow"] = 0.0
    body["n_body"] = int(n_body)
    # boots slightly thicker: a red shell over the lower legs
    boot_mask = (R["co"][:, 2] < J["LeftLeg"][2] - 0.10) & ~R["is_eye"]
    boots = hb.make_shell(body, boot_mask, R, 0.006, "SM_Boots", smooth=4)
    boots.data.materials.clear()
    boots.data.materials.append(M["red"])
    hb.bind(boots, rig)

    # root empty: rig hangs from it with the pelvis at the root origin
    root = bpy.data.objects.new("SM_Root", None)
    sc.collection.objects.link(root)
    pelvis = Vector(J["Hips"])
    rig.parent = root
    rig.location = -pelvis
    rig["joints"] = {k: list(map(float, v)) for k, v in J.items()}

    # root animation, keyed every frame
    root.rotation_mode = 'QUATERNION'
    prev = None
    for f in range(TL.N_FRAMES):
        t = f / TL.FPS
        R3 = root_orientation(t, prev)
        prev = R3
        root.location = TL.superman_pos(t)
        root.rotation_quaternion = R3.to_quaternion()
        root.keyframe_insert("location", frame=f)
        root.keyframe_insert("rotation_quaternion", frame=f)

    # bone poses
    P_ = poses(J)
    rig.animation_data_create()
    for t, name in POSE_KEYS:
        f = t * TL.FPS
        local = world_delta_pose(rig, P_[name])
        for b in hb.BONE_NAMES:
            pb = rig.pose.bones[P + b]
            pb.rotation_quaternion = local.get(b, Quaternion())
            pb.keyframe_insert("rotation_quaternion", frame=f)
    # head tracking: look at the beam target / the camera during the hover spans
    look = bpy.data.objects.new("SM_LookTarget", None)
    sc.collection.objects.link(look)
    for f in range(TL.N_FRAMES):
        t = f / TL.FPS
        if t < 25:
            p = TL.beam_target(min(max(t, TL.T_BEAM_ON), TL.T_BEAM_OFF))
        else:
            p = (-16.4, -33.6, 1.6)
        look.location = p
        look.keyframe_insert("location", frame=f)
    pbh = rig.pose.bones[P + "Head"]
    con = pbh.constraints.new('DAMPED_TRACK')
    con.target = look
    con.track_axis = 'TRACK_Z'          # bone local +Z is the face direction
    con.influence = 0.0
    con.keyframe_insert("influence", frame=0)
    for (a, b) in ((12.6, 19.0), (TL.T_LOOK, 34.8)):
        con.influence = 0.0
        con.keyframe_insert("influence", frame=int(a * TL.FPS) - 6)
        con.influence = 0.85
        con.keyframe_insert("influence", frame=int(a * TL.FPS) + 6)
        con.keyframe_insert("influence", frame=int(b * TL.FPS) - 4)
        con.influence = 0.0
        con.keyframe_insert("influence", frame=int(b * TL.FPS) + 4)
    # eye glow
    keys = [(0, 0.0), (TL.T_EYES, 0.0), (TL.T_BEAM_ON - 0.1, 0.6), (TL.T_BEAM_ON, 1.0), (TL.T_BEAM_OFF, 1.0),
            (TL.T_BEAM_OFF + 0.6, 0.15), (TL.T_TAKEOFF, 0.0), (TL.T_LOOK - 0.2, 0.0), (TL.T_LOOK + 0.8, 0.22),
            (34.4, 0.3), (TL.T_LAUNCH, 0.55), (36.0, 0.2)]
    for t, v in keys:
        body["eye_glow"] = v
        body.keyframe_insert('["eye_glow"]', frame=t * TL.FPS)
    col = bpy.data.collections.new("Superman")
    sc.collection.children.link(col)
    for ob in (root, rig, body, hair, curl, emblem, boots, look):
        for c in ob.users_collection:
            c.objects.unlink(ob)
        col.objects.link(ob)
    export_cape_frames(rig, root, J)
    bpy.ops.wm.save_as_mainfile(filepath=out_path)
    print("SUPERMAN saved", out_path, "verts", len(body.data.vertices))


def export_cape_frames(rig, root, J):
    """Per frame: world matrix of the Spine2 bone (cape anchor), plus leg/torso capsule points."""
    sc = bpy.context.scene
    os.makedirs(CACHE, exist_ok=True)
    mats, caps, eyes = [], [], []
    names = ["Hips", "Spine2", "Neck", "LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot"]
    body = bpy.data.objects["SM_Body"]
    eco = hb.mesh_co(body)
    n_eye = int(body.get("n_body", 0))
    ev = eco[n_eye:]
    eye_rest = [Vector(ev[ev[:, 0] > 0].mean(0)), Vector(ev[ev[:, 0] < 0].mean(0))]
    head_rest_inv = rig.data.bones[P + "Head"].matrix_local.inverted()
    for f in range(TL.N_FRAMES):
        sc.frame_set(f)
        pb = rig.pose.bones[P + "Spine2"]
        Mw = rig.matrix_world @ pb.matrix
        mats.append(np.array(Mw))
        caps.append([np.array(rig.matrix_world @ rig.pose.bones[P + n].head) for n in names])
        Mh = rig.matrix_world @ rig.pose.bones[P + "Head"].matrix @ head_rest_inv
        eyes.append([np.array(Mh @ e) for e in eye_rest])
    np.save(f"{CACHE}/cape_anchor.npy", np.array(mats))
    np.save(f"{CACHE}/eyes.npy", np.array(eyes))
    np.save(f"{CACHE}/body_points.npy", np.array(caps))
    # cape attachment line in Spine2-local coordinates (rest pose)
    rest = rig.data.bones[P + "Spine2"].matrix_local
    pts = []
    for k in range(9):
        a = -1 + 2 * k / 8
        x = 0.19 * a
        y = J["Spine2"][1] + 0.10 - 0.02 * (1 - a * a)
        z = J["Neck"][2] - 0.035 - 0.03 * a * a
        pts.append(np.array(rest.inverted() @ Vector((x, y, z))))
    np.save(f"{CACHE}/cape_attach_local.npy", np.array(pts))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    build(argv[0] if argv else "/opt/work/assets/superman.blend")


def attach_cape(cache=CACHE, collection=None):
    """Cape mesh driven by the PC2 cache (Spine2-local), following the Spine2 bone."""
    import numpy as _np
    rest = _np.load(f"{cache}/cape_rest.npy")
    NR, NC = 20, 13
    verts = [tuple(v) for v in rest]
    faces = []
    for r in range(NR - 1):
        for c in range(NC - 1):
            i = r * NC + c
            faces.append((i, i + 1, i + NC + 1, i + NC))
    me = bpy.data.meshes.new("SM_Cape")
    me.from_pydata(verts, [], faces)
    uvl = me.uv_layers.new(name="UVMap")
    uvs = []
    for p in me.polygons:
        for vi in p.vertices:
            r, c = divmod(vi, NC)
            uvs += [c / (NC - 1), 1 - r / (NR - 1)]
    uvl.data.foreach_set("uv", uvs)
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    ob = bpy.data.objects.new("SM_Cape", me)
    (collection or bpy.context.scene.collection).objects.link(ob)
    mat = bpy.data.materials.get("SM_Cape")
    me.materials.append(mat)
    mc = ob.modifiers.new("Cache", 'MESH_CACHE')
    mc.cache_format = 'PC2'
    mc.filepath = f"{cache}/cape.pc2"
    mc.time_mode = 'FRAME'
    mc.play_mode = 'SCENE'
    mc.frame_start = 0.0
    mc.interpolation = 'LINEAR'
    mc.deform_mode = 'OVERWRITE'
    mc.forward_axis = 'POS_Y'
    mc.up_axis = 'POS_Z'
    sol = ob.modifiers.new("Thick", 'SOLIDIFY')
    sol.thickness = 0.008
    sub = ob.modifiers.new("Smooth", 'SUBSURF')
    sub.levels = 1
    sub.render_levels = 2
    con = ob.constraints.new('CHILD_OF')
    con.target = bpy.data.objects["SM_Rig"]
    con.subtarget = P + "Spine2"
    con.inverse_matrix = Matrix.Identity(4)
    return ob
