"""MPFB2 (MakeHuman) character helpers used by build.py. Runs inside Blender."""
import importlib, os, sys, math
import bpy


def _imp(pkg, key):
    for m in list(sys.modules):
        if m.endswith(pkg):
            return getattr(importlib.import_module(m), key)
    raise ImportError(pkg)


def svc():
    return dict(
        HumanService=_imp("mpfb.services.humanservice", "HumanService"),
        AssetService=_imp("mpfb.services.assetservice", "AssetService"),
        AnimationService=_imp("mpfb.services.animationservice", "AnimationService"),
        FaceService=_imp("mpfb.services.faceservice", "FaceService"),
        RigService=_imp("mpfb.services.rigservice", "RigService"),
    )


# age macro: 0 -> 1 year, 0.1875 -> 11, 0.5 -> 25, 1 -> 90
def age_value(years):
    if years <= 11:
        return (years - 1) / 10 * 0.1875
    if years <= 25:
        return 0.1875 + (years - 11) / 14 * (0.5 - 0.1875)
    return 0.5 + (years - 25) / 65 * 0.5


def make_human(name, *, gender, age, weight=0.5, muscle=0.5, height=0.5, proportions=0.5,
               race=("caucasian",), skin, hair="", eyebrows="eyebrow001.mhclo",
               clothes=(), subdiv=1, cupsize=0.5):
    S = svc()
    HS = S["HumanService"]
    info = HS._create_default_human_info_dict() if hasattr(HS, "_create_default_human_info_dict") else {}
    r = {"asian": 0.0, "caucasian": 0.0, "african": 0.0}
    for k in race:
        r[k] = 1.0 / len(race)
    info["phenotype"] = {"gender": gender, "age": age_value(age), "muscle": muscle, "weight": weight,
                         "proportions": proportions, "height": height, "cupsize": cupsize,
                         "firmness": 0.5, "race": r}
    info["name"] = name
    info["rig"] = "default"
    info["eyes"] = "high-poly.mhclo"
    info["eyebrows"] = eyebrows
    info["eyelashes"] = "eyelashes01.mhclo"
    info["teeth"] = "teeth_base.mhclo"
    info["tongue"] = "tongue01.mhclo"
    info["hair"] = hair
    info["clothes"] = list(clothes)
    info["skin_mhmat"] = skin
    info["skin_material_type"] = "ENHANCED_SSS"
    info["eyes_material_type"] = "PROCEDURAL_EYES"
    settings = HS.get_default_deserialization_settings()
    settings["subdiv_levels"] = subdiv
    body = HS.deserialize_from_dict(info, settings)
    rig = body.parent if body.parent and body.parent.type == "ARMATURE" else None
    return rig, body


def children(rig):
    return [o for o in bpy.data.objects if o.parent == rig or (o.parent and o.parent.parent == rig)]


def find_part(rig, needle):
    for o in children(rig):
        if needle.lower() in o.name.lower():
            return o
    return None


def body_of(rig):
    for o in children(rig):
        if o.name.endswith(".body"):
            return o
    return None


def apply_bvh_pose(rig, pose_name):
    S = svc()
    p = S["AssetService"].find_asset_absolute_path(pose_name + ".bvh", asset_subdir="poses")
    if p is None:
        raise FileNotFoundError(pose_name)
    before = set(bpy.data.objects)
    S["AnimationService"].import_bvh_file_as_pose(rig, p)
    bpy.ops.object.mode_set(mode="OBJECT")
    for o in set(bpy.data.objects) - before:  # remove the temporary imported bvh armature
        bpy.data.objects.remove(o, do_unlink=True)


def set_face(body, **units):
    svc()["FaceService"].set_expression(body, units)


def tint(obj, rgb, keep_detail=0.35, rough=None):
    """Recolor an MPFB clothes material: color * texture luminance (keeps folds/seams)."""
    for slot in obj.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf is None:
            continue
        inp = bsdf.inputs["Base Color"]
        src = inp.links[0].from_socket if inp.links else None
        rgbn = nt.nodes.new("ShaderNodeRGB"); rgbn.outputs[0].default_value = (*rgb, 1)
        if src is not None:
            bw = nt.nodes.new("ShaderNodeRGBToBW"); nt.links.new(src, bw.inputs[0])
            mr = nt.nodes.new("ShaderNodeMapRange")
            mr.inputs["From Min"].default_value = 0.0; mr.inputs["From Max"].default_value = 1.0
            mr.inputs["To Min"].default_value = 1 - keep_detail; mr.inputs["To Max"].default_value = 1 + keep_detail
            nt.links.new(bw.outputs[0], mr.inputs[0])
            mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"
            mul.inputs[0].default_value = 1.0
            nt.links.new(rgbn.outputs[0], mul.inputs[6])
            nt.links.new(mr.outputs[0], mul.inputs[7])
            nt.links.new(mul.outputs[2], inp)
        else:
            nt.links.new(rgbn.outputs[0], inp)
        if rough is not None:
            ri = bsdf.inputs["Roughness"]
            for l in list(ri.links):
                nt.links.remove(l)
            ri.default_value = rough
