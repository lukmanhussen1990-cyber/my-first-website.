"""3D Clawd: the pixel mascot rebuilt as a soft toy-like figure.

The 2D reference is a 12 x 8 pixel grid (1 px = U metres):
  body   8 x 6 px            eyes  1 x 1 px at body columns 1 and 6, row 1
  arms   2 x 2 px each side  legs  1 x 2 px at columns 0, 2, 5 and 7
Everything below is measured off that grid so the front silhouette matches.
"""
import math

import bmesh
import bpy
from mathutils import Vector

from .common import (add_round, add_subd, bm_box, ease_out_back, hexcol,
                     link, new_empty, new_material, new_mesh_obj, node,
                     principled, rot_y, rot_z, smoothstep)

U = 0.1
BODY_W, BODY_H, BODY_D = 8 * U, 6 * U, 5 * U
LEG_H = 2 * U
LEG_D = 2 * U
ARM_D = 2 * U
EYE_X = 2.5 * U          # eye centres at body columns 1-2 and 6-7
EYE_Z = 4.5 * U          # body-local height of the eye row (row 1 from the top)
ARM_Z = 3.0 * U          # arm rows 2-3 from the top
ARM_PIVOT_X = 3.7 * U    # pivot sits just inside the body side
LEG_XS = (-3.5 * U, -1.5 * U, 1.5 * U, 3.5 * U)

CORAL = "#E8694E"        # between the two reference swatches (#DA7757 / #F15B45)


def make_materials():
    mats = {}
    mats["body"] = principled(
        "Clawd Body", hexcol(CORAL), 0.42,
        Subsurface_Weight=0.12, Subsurface_Radius=(1.0, 0.35, 0.2), Subsurface_Scale=0.05,
        Coat_Weight=0.22, Coat_Roughness=0.2, Sheen_Weight=0.12, Sheen_Roughness=0.4)
    mats["eye"] = principled("Clawd Eye", hexcol("#0B0A0C"), 0.12,
                             Coat_Weight=1.0, Coat_Roughness=0.03)
    mats["bow"] = principled("Bow Satin", hexcol("#FF4F9C"), 0.3,
                             Sheen_Weight=0.6, Sheen_Tint=(1.0, 0.85, 0.92, 1.0),
                             Coat_Weight=0.35, Coat_Roughness=0.15,
                             Subsurface_Weight=0.08, Subsurface_Scale=0.02)
    mats["bow_knot"] = principled("Bow Knot", hexcol("#FF77B4"), 0.3,
                                  Sheen_Weight=0.6, Coat_Weight=0.35, Coat_Roughness=0.15)
    mats["exclaim"] = principled("Exclaim", hexcol("#FFD23F"), 0.35,
                                 Emission_Color=hexcol("#FFD23F"), Emission_Strength=0.6,
                                 Coat_Weight=0.4)
    mats["blush"] = blush_material()
    return mats


def blush_material():
    """Soft airbrushed cheek: pink with a radial alpha falloff."""
    mat = new_material("Blush")
    nt = mat.node_tree
    nt.nodes.clear()
    out = node(nt, "ShaderNodeOutputMaterial", (600, 0))
    tc = node(nt, "ShaderNodeTexCoord", (-800, 0))
    mp = node(nt, "ShaderNodeMapping", (-600, 0))
    mp.inputs["Scale"].default_value = (2.0, 2.0, 2.0)
    grad = node(nt, "ShaderNodeTexGradient", (-400, 0), gradient_type="SPHERICAL")
    ramp = node(nt, "ShaderNodeValToRGB", (-200, 0))
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (0.55, 0.55, 0.55, 1)
    pink = node(nt, "ShaderNodeBsdfPrincipled", (100, -200))
    pink.inputs["Base Color"].default_value = hexcol("#FF7A9A")
    pink.inputs["Roughness"].default_value = 0.6
    transp = node(nt, "ShaderNodeBsdfTransparent", (100, 100))
    mix = node(nt, "ShaderNodeMixShader", (400, 0))
    link(nt, tc.outputs["Object"], mp.inputs["Vector"])
    link(nt, mp.outputs["Vector"], grad.inputs["Vector"])
    link(nt, grad.outputs["Fac"], ramp.inputs["Fac"])
    link(nt, ramp.outputs["Color"], mix.inputs["Fac"])
    link(nt, transp.outputs["BSDF"], mix.inputs[1])
    link(nt, pink.outputs["BSDF"], mix.inputs[2])
    link(nt, mix.outputs["Shader"], out.inputs["Surface"])
    mat.diffuse_color = hexcol("#FF7A9A")
    return mat


def bm_chevron(bm, apex_dir, a=0.05, b=0.047, t=0.034, d=0.024, yoff=-0.004):
    """'>' (apex_dir=+1) or '<' (apex_dir=-1) built from two rounded bars."""
    for sgn in (1, -1):
        p0 = Vector((-a * apex_dir, 0.0, sgn * b))
        p1 = Vector((a * apex_dir, 0.0, 0.0))
        v = p1 - p0
        ang = math.atan2(v.z, v.x)
        bm_box(bm, (v.length + t * 0.85, d, t), center=(p0 + p1) / 2 + Vector((0, yoff, 0)),
               matrix=rot_y(-ang))


def build_bow(name, parent, mats, coll):
    """Satin bow: two pillow lobes and a knot, sitting on the top of the head."""
    root = new_empty(name, parent=parent, coll=coll, loc=(0.2, -0.05, BODY_H + 0.035))
    for sx in (-1, 1):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12,
                              radius1=0.072, radius2=0.018, depth=0.13,
                              matrix=rot_y(-sx * math.pi / 2))
        for v in bm.verts:
            v.co.y *= 0.5
            v.co.x += sx * 0.075
            v.co.z += 0.012 * (abs(v.co.x) / 0.14)  # lobes lift slightly outward
        lobe = new_mesh_obj(f"{name}_lobe{sx:+d}", bm, coll, root, mat=mats["bow"])
        add_subd(lobe, 2)
        lobe.rotation_euler = (0.0, sx * 0.18, 0.0)
    bm = bmesh.new()
    bm_box(bm, (0.06, 0.05, 0.07))
    knot = new_mesh_obj(f"{name}_knot", bm, coll, root, mat=mats["bow_knot"])
    add_round(knot, 0.018, 2, 2)
    root.rotation_euler = (0.0, -0.32, 0.0)
    return root


class Character:
    """Builds the object hierarchy and turns per-frame pose dicts into transforms.

    root (ground pos, heading) -> hip (jump, lean, twist) -> squash (bob, squash/stretch)
      squash -> body, eyes, arms, bow, blush        hip -> four legs
    The character faces -Y when heading == 0.
    """

    def __init__(self, name, mats, coll, girl=False):
        self.name = name
        self.girl = girl
        self.root = new_empty(f"{name}_root", coll=coll, size=0.3)
        self.hip = new_empty(f"{name}_hip", parent=self.root, coll=coll, loc=(0, 0, LEG_H))
        self.squash = new_empty(f"{name}_squash", parent=self.hip, coll=coll)

        bm = bmesh.new()
        bm_box(bm, (BODY_W, BODY_D, BODY_H), center=(0, 0, BODY_H / 2))
        self.body = new_mesh_obj(f"{name}_body", bm, coll, self.squash, mat=mats["body"])
        add_round(self.body, 0.055, 3, 2)

        self.eye_pos, self.eye_sq, self.eye_chev = [], [], []
        for side, sx in (("L", -1), ("R", 1)):
            pos = new_empty(f"{name}_eye{side}", parent=self.squash, coll=coll,
                            loc=(sx * EYE_X, -BODY_D / 2, EYE_Z), size=0.05)
            bm = bmesh.new()
            bm_box(bm, (U, 0.024, U), center=(0, -0.004, 0))
            sq = new_mesh_obj(f"{name}_eye{side}_sq", bm, coll, pos, mat=mats["eye"])
            add_round(sq, 0.014, 2, 2)
            bm = bmesh.new()
            bm_chevron(bm, apex_dir=-sx)  # left eye '>', right eye '<'
            ch = new_mesh_obj(f"{name}_eye{side}_chev", bm, coll, pos, mat=mats["eye"])
            add_round(ch, 0.011, 2, 2)
            ch.scale = (0.001, 1, 0.001)
            self.eye_pos.append(pos)
            self.eye_sq.append(sq)
            self.eye_chev.append(ch)

        self.blush = []
        for side, sx in (("L", -1), ("R", 1)):
            bm = bmesh.new()
            bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5,
                                  matrix=rot_x_quarter())
            bl = new_mesh_obj(f"{name}_blush{side}", bm, coll, self.squash,
                              loc=(sx * 2.75 * U, -BODY_D / 2 - 0.004, 3.45 * U),
                              mat=mats["blush"], smooth=False)
            bl.scale = (0.0, 1.0, 0.0)
            bl.visible_shadow = False
            self.blush.append(bl)

        self.arms = []
        for side, sx in (("L", -1), ("R", 1)):
            piv = new_empty(f"{name}_arm{side}", parent=self.squash, coll=coll,
                            loc=(sx * ARM_PIVOT_X, 0, ARM_Z), size=0.08)
            bm = bmesh.new()
            bm_box(bm, (2.6 * U, ARM_D, 2 * U), center=(sx * 1.0 * U, 0, 0))
            arm = new_mesh_obj(f"{name}_arm{side}_mesh", bm, coll, piv, mat=mats["body"])
            add_round(arm, 0.045, 3, 2)
            self.arms.append(piv)

        self.legs = []
        for i, lx in enumerate(LEG_XS):
            piv = new_empty(f"{name}_leg{i}", parent=self.hip, coll=coll, loc=(lx, 0, 0), size=0.06)
            bm = bmesh.new()
            bm_box(bm, (U, LEG_D, LEG_H + 0.07), center=(0, 0, -LEG_H / 2 + 0.035))
            leg = new_mesh_obj(f"{name}_leg{i}_mesh", bm, coll, piv, mat=mats["body"])
            add_round(leg, 0.03, 3, 2)
            self.legs.append(piv)

        self.bow = build_bow(f"{name}_bow", self.squash, mats, coll) if girl else None

        # "!" surprise mark floating above the head
        self.exclaim = new_empty(f"{name}_exclaim", parent=self.hip, coll=coll,
                                 loc=(0.0, 0.0, BODY_H + 0.32), size=0.05)
        bm = bmesh.new()
        bm_box(bm, (0.07, 0.07, 0.19), center=(0, 0, 0.06))
        bm_box(bm, (0.07, 0.07, 0.07), center=(0, 0, -0.12))
        ex = new_mesh_obj(f"{name}_exclaim_mesh", bm, coll, self.exclaim, mat=mats["exclaim"])
        add_round(ex, 0.025, 2, 2)
        self.exclaim.scale = (0.0, 0.0, 0.0)

        self.tracks = {}

    # ---------------------------------------------------------------- pose --
    @staticmethod
    def rest_pose():
        return dict(
            x=0.0, y=0.0, heading=0.0,
            jump=0.0, lean_fwd=0.0, lean_side=0.0, twist=0.0,
            bob=0.0, squash=1.0, sway_x=0.0,
            arm_raise=[0.0, 0.0], arm_swing=[0.0, 0.0], arm_twist=[0.0, 0.0],
            leg_swing=[0.0] * 4, leg_lift=[0.0] * 4,
            eye_open=1.0, eye_big=1.0, happy=0.0, gaze=(0.0, 0.0),
            blush=0.0, bow_wiggle=0.0, exclaim=0.0, exclaim_tilt=0.0,
        )

    def record(self, frame, p):
        """Convert a pose dict into object transforms and store them for baking."""
        def put(obj, path, val):
            self.tracks.setdefault((obj.name, path), (obj, path, []))[2].append((frame, tuple(val)))

        put(self.root, "location", (p["x"], p["y"], 0.0))
        put(self.root, "rotation_euler", (0.0, 0.0, p["heading"]))
        put(self.hip, "location", (p["sway_x"], 0.0, LEG_H + p["jump"]))
        put(self.hip, "rotation_euler", (p["lean_fwd"], p["lean_side"], p["twist"]))
        s = max(0.3, p["squash"])
        w = 1.0 / math.sqrt(s)
        put(self.squash, "location", (0.0, 0.0, p["bob"]))
        put(self.squash, "scale", (w, w, s))

        for i, (pos, sq, ch) in enumerate(zip(self.eye_pos, self.eye_sq, self.eye_chev)):
            sx = -1 if i == 0 else 1
            gx, gz = p["gaze"]
            put(pos, "location", (sx * EYE_X + gx, -BODY_D / 2, EYE_Z + gz))
            happy = p["happy"]
            close = smoothstep(0.0, 0.5, happy)
            big = p["eye_big"]
            sz = max(0.001, big * p["eye_open"] * (1.0 - close))
            sxz = max(0.001, big * (1.0 - 0.3 * close))
            put(sq, "scale", (sxz, 1.0, sz))
            c = smoothstep(0.35, 1.0, happy)
            c = max(0.001, ease_out_back(c, 2.2) if c > 0 else 0.0)
            put(ch, "scale", (c, 1.0, c))

        for bl in self.blush:
            b = max(0.0, p["blush"])
            put(bl, "scale", (0.13 * b, 1.0, 0.075 * b))

        for i, piv in enumerate(self.arms):
            sx = -1 if i == 0 else 1
            put(piv, "rotation_euler",
                (p["arm_twist"][i], -sx * p["arm_raise"][i], -sx * p["arm_swing"][i]))

        for i, piv in enumerate(self.legs):
            put(piv, "location", (LEG_XS[i], 0.0, p["leg_lift"][i]))
            put(piv, "rotation_euler", (-p["leg_swing"][i], 0.0, 0.0))

        if self.bow is not None:
            put(self.bow, "rotation_euler", (0.0, -0.32 + p["bow_wiggle"], 0.12 * p["bow_wiggle"]))

        e = max(0.0, p["exclaim"])
        put(self.exclaim, "scale", (e, e, e))
        put(self.exclaim, "rotation_euler", (0.0, p["exclaim_tilt"], 0.0))


def rot_x_quarter():
    """Grid lies in XY; rotate it upright into the XZ plane facing -Y."""
    from .common import rot_x
    return rot_x(math.pi / 2)


def bake_tracks(tracks):
    """Write recorded per-frame values as linear fcurves (fast path)."""
    for obj, path, samples in tracks.values():
        if not samples:
            continue
        n = len(samples[0][1])
        frames = [f for f, _ in samples]
        for idx in range(n):
            vals = [v[idx] for _, v in samples]
            if max(vals) - min(vals) < 1e-9:
                # constant: just set the value, no animation needed
                getattr(obj, path)[idx] = vals[0]
                continue
            fc = ensure_fcurve(obj, path, idx)
            kps = fc.keyframe_points
            kps.clear()
            kps.add(len(frames))
            co = []
            for f, v in zip(frames, vals):
                co.extend((f, v))
            kps.foreach_set("co", co)
            kps.foreach_set("interpolation", [1] * len(frames))  # LINEAR
            fc.update()


def ensure_fcurve(obj, path, idx):
    if obj.animation_data is None:
        obj.animation_data_create()
    ad = obj.animation_data
    if ad.action is None:
        act = bpy.data.actions.new(f"{obj.name}_act")
        ad.action = act
    act = ad.action
    if hasattr(act, "fcurve_ensure_for_datablock"):
        return act.fcurve_ensure_for_datablock(obj, path, index=idx)
    fc = act.fcurves.find(path, index=idx)
    return fc or act.fcurves.new(path, index=idx)
