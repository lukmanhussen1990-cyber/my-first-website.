"""Shared helpers: MPFB human creation + IK + face units (run inside bpy)."""
import bpy, importlib, math, os, sys
from mathutils import Vector

MPFB = "bl_ext.user_default.mpfb"


def ensure_mpfb():
    import addon_utils
    if MPFB not in [a.module for a in bpy.context.preferences.addons]:
        addon_utils.enable(MPFB, default_set=True)
    hs = importlib.import_module(MPFB + ".services.humanservice").HumanService
    fs = importlib.import_module(MPFB + ".services.faceservice").FaceService
    return hs, fs


def clear_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.cameras, bpy.data.lights):
        for b in list(coll):
            if b.users == 0:
                coll.remove(b)


def build_human(name, phenotype, *, rig="game_engine", skin="young_caucasian_male.mhmat",
                skin_type="ENHANCED", hair="short04.mhclo", clothes=("male_casualsuit01.mhclo", "shoes01.mhclo"),
                eyebrows="eyebrow001.mhclo", eyelashes="eyelashes01.mhclo", teeth="teeth_base.mhclo",
                tongue="tongue01.mhclo", eyes="high-poly.mhclo", proxy="", faceunits=True, subdiv=0):
    HumanService, FaceService = ensure_mpfb()
    info = HumanService._create_default_human_info_dict()
    info["name"] = name
    info["phenotype"] = phenotype
    info["rig"] = rig
    info["eyes"] = eyes
    info["eyebrows"] = eyebrows
    info["eyelashes"] = eyelashes
    info["teeth"] = teeth
    info["tongue"] = tongue
    info["hair"] = hair
    info["proxy"] = proxy
    info["clothes"] = list(clothes)
    info["skin_mhmat"] = skin
    info["skin_material_type"] = skin_type
    info["eyes_material_type"] = "MAKESKIN"
    settings = HumanService.get_default_deserialization_settings()
    settings["subdiv_levels"] = subdiv
    basemesh = HumanService.deserialize_from_dict(info, settings)
    if faceunits:
        FaceService.load_targets(basemesh, load_microsoft_visemes=False, load_meta_visemes=False,
                                 load_arkit_faceunits=True)
        FaceService.interpolate_targets(basemesh)
    rig_obj = basemesh.parent if basemesh.parent and basemesh.parent.type == 'ARMATURE' else None
    return basemesh, rig_obj


def children_meshes(rig_obj):
    return [o for o in rig_obj.children_recursive if o.type == 'MESH']


# ---------------------------------------------------------------- IK on the game_engine rig
def add_ik(rig_obj, prefix="IK"):
    """Adds hand/foot IK targets + elbow/knee poles to an MPFB game_engine rig.

    Bones: upperarm_l/lowerarm_l/hand_l, thigh_l/calf_l/foot_l (UE naming)."""
    bpy.context.view_layer.objects.active = rig_obj
    for o in bpy.context.selected_objects:
        o.select_set(False)
    rig_obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig_obj.data.edit_bones
    root = eb.get("root")
    made = {}
    for side in ("l", "r"):
        hand = eb["hand_" + side]
        lower = eb["lowerarm_" + side]
        upper = eb["upperarm_" + side]
        t = eb.new(f"{prefix}_hand_{side}")
        t.head = hand.head.copy(); t.tail = hand.tail.copy(); t.roll = hand.roll
        t.parent = root; t.use_deform = False
        # elbow pole behind the elbow
        p = eb.new(f"{prefix}_elbow_{side}")
        p.head = lower.head + Vector((0, 0.35, 0)); p.tail = p.head + Vector((0, 0.08, 0))
        p.parent = root; p.use_deform = False
        foot = eb["foot_" + side]
        calf = eb["calf_" + side]
        f = eb.new(f"{prefix}_foot_{side}")
        f.head = foot.head.copy(); f.tail = foot.tail.copy(); f.roll = foot.roll
        f.parent = root; f.use_deform = False
        k = eb.new(f"{prefix}_knee_{side}")
        k.head = calf.head + Vector((0, -0.4, 0)); k.tail = k.head + Vector((0, -0.08, 0))
        k.parent = root; k.use_deform = False
        made[side] = True
    bpy.ops.object.mode_set(mode='POSE')
    pb = rig_obj.pose.bones
    for side in ("l", "r"):
        c = pb["lowerarm_" + side].constraints.new('IK')
        c.target = rig_obj; c.subtarget = f"{prefix}_hand_{side}"
        c.pole_target = rig_obj; c.pole_subtarget = f"{prefix}_elbow_{side}"
        c.pole_angle = math.radians(-90 if side == "l" else -90)
        c.chain_count = 2; c.name = "IK_arm"
        h = pb["hand_" + side].constraints.new('COPY_ROTATION')
        h.target = rig_obj; h.subtarget = f"{prefix}_hand_{side}"; h.name = "IK_hand_rot"
        c2 = pb["calf_" + side].constraints.new('IK')
        c2.target = rig_obj; c2.subtarget = f"{prefix}_foot_{side}"
        c2.pole_target = rig_obj; c2.pole_subtarget = f"{prefix}_knee_{side}"
        c2.pole_angle = math.radians(-90)
        c2.chain_count = 2; c2.name = "IK_leg"
        f2 = pb["foot_" + side].constraints.new('COPY_ROTATION')
        f2.target = rig_obj; f2.subtarget = f"{prefix}_foot_{side}"; f2.name = "IK_foot_rot"
    bpy.ops.object.mode_set(mode='OBJECT')


ARKIT_EXPRESSIONS = {
    "neutral": {},
    "serious": {"browDownLeft": 0.35, "browDownRight": 0.35, "mouthPressLeft": 0.4, "mouthPressRight": 0.4,
                "eyeSquintLeft": 0.2, "eyeSquintRight": 0.2, "mouthRollLower": 0.15},
    "disgusted": {"noseSneerLeft": 1.0, "noseSneerRight": 1.0, "browDownLeft": 0.8, "browDownRight": 0.8,
                  "mouthUpperUpLeft": 0.8, "mouthUpperUpRight": 0.8, "mouthFrownLeft": 0.7, "mouthFrownRight": 0.7,
                  "eyeSquintLeft": 0.9, "eyeSquintRight": 0.9, "cheekSquintLeft": 0.6, "cheekSquintRight": 0.6,
                  "mouthStretchLeft": 0.3, "mouthStretchRight": 0.3, "jawOpen": 0.12},
    "proud": {"mouthSmileLeft": 0.8, "mouthSmileRight": 0.8, "browOuterUpLeft": 0.45, "browOuterUpRight": 0.45,
              "browInnerUp": 0.25, "cheekSquintLeft": 0.35, "cheekSquintRight": 0.35, "eyeWideLeft": 0.15,
              "eyeWideRight": 0.15},
    "smug": {"mouthSmileLeft": 0.85, "mouthSmileRight": 0.15, "mouthDimpleLeft": 0.4, "browOuterUpRight": 0.7,
             "browDownLeft": 0.35, "eyeSquintLeft": 0.45, "eyeSquintRight": 0.2, "mouthPressRight": 0.2,
             "eyeBlinkLeft": 0.15, "eyeBlinkRight": 0.15},
    "tired": {"eyeBlinkLeft": 0.55, "eyeBlinkRight": 0.55, "browInnerUp": 0.6, "browDownLeft": 0.15,
              "browDownRight": 0.15, "mouthFrownLeft": 0.5, "mouthFrownRight": 0.5, "jawOpen": 0.08,
              "mouthLowerDownLeft": 0.2, "mouthLowerDownRight": 0.2, "eyeLookDownLeft": 0.3, "eyeLookDownRight": 0.3},
    "shocked": {"eyeWideLeft": 0.9, "eyeWideRight": 0.9, "browInnerUp": 0.9, "browOuterUpLeft": 0.8,
                "browOuterUpRight": 0.8, "jawOpen": 0.45, "mouthFunnel": 0.3},
    "grin": {"mouthSmileLeft": 1.0, "mouthSmileRight": 1.0, "jawOpen": 0.18, "mouthUpperUpLeft": 0.35,
             "mouthUpperUpRight": 0.35, "cheekSquintLeft": 0.6, "cheekSquintRight": 0.6, "browOuterUpLeft": 0.5,
             "browOuterUpRight": 0.5, "eyeSquintLeft": 0.25, "eyeSquintRight": 0.25},
    "blink": {"eyeBlinkLeft": 1.0, "eyeBlinkRight": 1.0},
}


def face_key_owners(rig_obj, unit):
    """All (object, keyblock) pairs carrying the ARKit unit (basemesh + interpolated children)."""
    res = []
    for o in children_meshes(rig_obj):
        sk = o.data.shape_keys
        if sk and unit in sk.key_blocks:
            res.append((o, sk.key_blocks[unit]))
    return res
