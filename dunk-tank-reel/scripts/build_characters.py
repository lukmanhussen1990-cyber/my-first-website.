"""Build the two MakeHuman characters with MPFB and save them to chars.blend.

Run:  blender -b --python build_characters.py -- /opt/work/chars.blend
"""
import bpy
import sys
import os

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.locationservice import LocationService

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "/opt/work/chars.blend"
DATA = LocationService.get_user_data()


def clear_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for item in list(coll):
            if item.users == 0:
                coll.remove(item)


def human_info(name, phenotype, hair, clothes, eyebrows="eyebrow001", alt_materials=None, targets=None):
    return {
        "name": name,
        "phenotype": phenotype,
        "rig": "default",
        "eyes": "high-poly/high-poly.mhclo",
        "eyebrows": f"{eyebrows}/{eyebrows}.mhclo",
        "eyelashes": "eyelashes01/eyelashes01.mhclo",
        "teeth": "teeth_base/teeth_base.mhclo",
        "tongue": "tongue01/tongue01.mhclo",
        "hair": f"{hair}/{hair}.mhclo",
        "proxy": "",
        "targets": targets or [],
        "clothes": [f"{c}/{c}.mhclo" for c in clothes],
        "skin_mhmat": "young_caucasian_male/young_caucasian_male.mhmat",
        "skin_material_type": "ENHANCED_SSS",
        "eyes_material_type": "MAKESKIN",
        "skin_material_settings": {},
        "eyes_material_settings": {},
        "expressions": [],
        "alternative_materials": alt_materials or {},
    }


def set_eye_color(rig, eye_png):
    for ob in rig.children_recursive:
        if ob.type == 'MESH' and "high-poly" in ob.name.lower():
            for slot in ob.material_slots:
                mat = slot.material
                if not mat or not mat.use_nodes:
                    continue
                for node in mat.node_tree.nodes:
                    if node.type == 'TEX_IMAGE' and node.image and "eye" in node.image.name.lower() \
                            and "normal" not in node.image.name.lower():
                        node.image = bpy.data.images.load(eye_png, check_existing=True)


def build(info, offset_x):
    settings = HumanService.get_default_deserialization_settings()
    settings["subdiv_levels"] = 1
    basemesh = HumanService.deserialize_from_dict(info, settings)
    rig = basemesh.parent if basemesh.parent else None
    if rig is None:
        for ob in bpy.data.objects:
            if ob.type == 'ARMATURE' and ob.name.startswith(info["name"]):
                rig = ob
    rig.location.x = offset_x
    return basemesh, rig


clear_scene()

YOU = human_info(
    "YOU",
    {"gender": 1.0, "age": 0.5, "muscle": 0.5, "weight": 0.40, "proportions": 0.65,
     "height": 0.55, "cupsize": 0.5, "firmness": 0.5,
     "race": {"asian": 0.8, "caucasian": 0.2, "african": 0.0}},
    hair="short04",
    clothes=["male_casualsuit01", "shoes04"],
    eyebrows="eyebrow001",
)

FRIEND = human_info(
    "FRIEND",
    {"gender": 1.0, "age": 0.55, "muscle": 0.25, "weight": 1.0, "proportions": 0.25,
     "height": 0.5, "cupsize": 0.5, "firmness": 0.5,
     "race": {"asian": 0.0, "caucasian": 1.0, "african": 0.0}},
    hair="short02",
    clothes=["male_casualsuit06", "shoes04"],
    eyebrows="eyebrow002",
    alt_materials={"c104cd4a-1edc-43f9-8b94-f63345a44638":
                   "short02/bogdan666_short_02_brown/bogdan666_short_02_brown.mhmat"},
    targets=[{"target": "stomach-pregnant-incr", "value": 0.45},
             {"target": "buttocks-volume-incr", "value": 0.3}],
)

you_body, you_rig = build(YOU, -0.6)
friend_body, friend_rig = build(FRIEND, 0.6)

set_eye_color(you_rig, os.path.join(DATA, "eyes/materials/lightblue_eye.png"))
set_eye_color(friend_rig, os.path.join(DATA, "eyes/materials/brownlight_eye.png"))

FACE_UNITS = ["jawOpen", "mouthSmileLeft", "mouthSmileRight", "browInnerUp", "browOuterUpLeft",
              "browOuterUpRight", "browDownLeft", "browDownRight", "eyeWideLeft", "eyeWideRight",
              "eyeBlinkLeft", "eyeBlinkRight", "eyeSquintLeft", "eyeSquintRight", "mouthFrownLeft",
              "mouthFrownRight", "mouthPucker", "mouthFunnel", "cheekPuff", "mouthStretchLeft",
              "mouthStretchRight", "mouthPressLeft", "mouthPressRight", "noseSneerLeft", "noseSneerRight",
              "mouthRollLower", "mouthShrugUpper"]
from bl_ext.user_default.mpfb.services.targetservice import TargetService
for body in (you_body, friend_body):
    for fu in FACE_UNITS:
        path = os.path.join(DATA, "targets/faceunits", fu + ".target")
        if os.path.exists(path):
            TargetService.load_target(body, path, weight=0.0, name="fu_" + fu)


def add_wet(mat, wet_tint=(0.45, 0.48, 0.55), wet_rough=0.12):
    """Insert a 'wet' control (object custom property) that darkens and glosses the material."""
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        return
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_type = 'OBJECT'
    attr.attribute_name = "wet"
    attr.name = "WET_ATTR"
    base_in = bsdf.inputs["Base Color"]
    if base_in.is_linked:
        src = base_in.links[0].from_socket
        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.blend_type = 'MULTIPLY'
        mix.inputs[2].default_value = (*wet_tint, 1)
        nt.links.new(attr.outputs["Fac"], mix.inputs[0])
        nt.links.new(src, mix.inputs[1])
        nt.links.new(mix.outputs[0], base_in)
    rough_in = bsdf.inputs["Roughness"]
    if not rough_in.is_linked:
        r0 = rough_in.default_value
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = r0
        mr.inputs["To Max"].default_value = wet_rough
        nt.links.new(attr.outputs["Fac"], mr.inputs["Value"])
        nt.links.new(mr.outputs["Result"], rough_in)
    spec = bsdf.inputs.get("Specular IOR Level")
    if spec is not None and not spec.is_linked:
        s0 = spec.default_value
        ms = nt.nodes.new("ShaderNodeMapRange")
        ms.inputs["To Min"].default_value = s0
        ms.inputs["To Max"].default_value = max(s0, 0.8)
        nt.links.new(attr.outputs["Fac"], ms.inputs["Value"])
        nt.links.new(ms.outputs["Result"], spec)


for rig in (you_rig, friend_rig):
    for ob in rig.children:
        if ob.type != 'MESH':
            continue
        ob["wet"] = 0.0
        low = ob.name.lower()
        if any(k in low for k in ("casualsuit", "shoes", "short0")):
            for slot in ob.material_slots:
                if slot.material:
                    tint = (0.42, 0.45, 0.52) if "short0" in low else (0.55, 0.58, 0.66)
                    add_wet(slot.material, wet_tint=tint)

for ob in bpy.data.objects:
    print("OBJ", ob.name, ob.type, ob.parent.name if ob.parent else "-")

bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("SAVED", OUT)
