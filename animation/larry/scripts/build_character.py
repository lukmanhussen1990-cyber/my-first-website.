# Builds one MakeHuman character with MPFB (CC0/CC-BY community assets) and saves it as a .blend.
# Usage: blender -b --python build_character.py -- <name> <out.blend>
import bpy, sys, os, json

argv = sys.argv[sys.argv.index("--") + 1:]
NAME, OUT = argv[0], argv[1]

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.faceservice import FaceService
from bl_ext.user_default.mpfb.services.objectservice import ObjectService

CAU = {"caucasian": 1.0, "african": 0.0, "asian": 0.0}
AFR = {"caucasian": 0.05, "african": 0.95, "asian": 0.0}
MIX = {"caucasian": 0.5, "african": 0.3, "asian": 0.2}

BASE = dict(eyes="high-poly.mhclo", eyebrows="eyebrow001.mhclo", eyelashes="eyelashes01.mhclo",
            teeth="teeth_base.mhclo", tongue="tongue01.mhclo")

# tint: clothes asset name fragment -> RGB the garment should read as (keeps texture shading)
SPECS = {
    "you": dict(
        phenotype=dict(gender=1.0, age=0.5, muscle=0.55, weight=0.45, height=0.55, proportions=0.6, race=CAU),
        skin="young_caucasian_male.mhmat", hair="short02.mhclo",
        clothes=["elvs_male_shirt_tie_tucked1.mhclo", "toigo_wool_pants.mhclo", "shoes04.mhclo"],
        eye_mat="brownlight.mhmat",
        tint={"shirt_tie": (0.55, 0.72, 0.92), "wool_pants": (0.16, 0.17, 0.2)},
    ),
    "larry": dict(
        phenotype=dict(gender=1.0, age=0.78, muscle=0.3, weight=0.82, height=0.38, proportions=0.35, race=CAU),
        skin="middleage_caucasian_male.mhmat", hair="short04.mhclo",
        clothes=["namuhekam_male_polo_shirt.mhclo", "toigo_wool_pants.mhclo", "shoes01.mhclo",
                 "grinsegold_moustache.mhclo", "frankyaye_glasses_library_male.mhclo"],
        eye_mat="grey.mhmat",
        tint={"polo": (0.78, 0.52, 0.08), "wool_pants": (0.3, 0.22, 0.14), "moustache": (0.16, 0.12, 0.1)},
    ),
    "larry_b": dict(
        phenotype=dict(gender=1.0, age=0.78, muscle=0.3, weight=0.82, height=0.38, proportions=0.35, race=CAU),
        skin="middleage_caucasian_male.mhmat", hair="short04.mhclo",
        clothes=["namuhekam_male_polo_shirt.mhclo", "toigo_wool_pants.mhclo", "shoes01.mhclo",
                 "grinsegold_moustache.mhclo", "frankyaye_glasses_library_male.mhclo"],
        tint={"polo": (0.78, 0.52, 0.08), "wool_pants": (0.3, 0.22, 0.14), "moustache": (0.16, 0.12, 0.1)},
    ),
    "you_sun": dict(
        phenotype=dict(gender=1.0, age=0.5, muscle=0.55, weight=0.45, height=0.55, proportions=0.6, race=CAU),
        skin="young_caucasian_male.mhmat", hair="short02.mhclo",
        clothes=["elvs_crude_t-shirt_male.mhclo", "cortu_jeans_shorts.mhclo", "elvs_ladies_sunglass1.mhclo"],
        tint={"crude_t-shirt": (0.95, 0.95, 0.95)},
    ),
    "you_pj": dict(
        phenotype=dict(gender=1.0, age=0.5, muscle=0.55, weight=0.45, height=0.55, proportions=0.6, race=CAU),
        skin="young_caucasian_male.mhmat", hair="short02.mhclo",
        clothes=["elvs_crude_t-shirt_male.mhclo"],
        tint={"crude_t-shirt": (0.95, 0.95, 0.95)},
    ),
    "cop": dict(
        phenotype=dict(gender=1.0, age=0.55, muscle=0.65, weight=0.6, height=0.6, proportions=0.6, race=MIX),
        skin="middleage_caucasian_male.mhmat", hair="short04.mhclo",
        clothes=["elvs_male_shirt_untucked_bd1.mhclo", "toigo_wool_pants.mhclo", "shoes03.mhclo"],
        eye_mat="brown.mhmat",
        tint={"untucked": (0.1, 0.14, 0.3), "wool_pants": (0.07, 0.08, 0.15)},
    ),
    "bodyguard": dict(
        phenotype=dict(gender=1.0, age=0.55, muscle=1.0, weight=0.85, height=1.0, proportions=0.85, race=AFR),
        skin="middleage_african_male.mhmat", hair="",
        clothes=["male_elegantsuit01.mhclo", "shoes04.mhclo", "elvs_ladies_sunglass1.mhclo"],
        eye_mat="brown.mhmat",
        tint={},
    ),
    "soldier": dict(
        phenotype=dict(gender=1.0, age=0.45, muscle=0.75, weight=0.5, height=0.6, proportions=0.6, race=MIX),
        skin="young_caucasian_male2.mhmat", hair="short01.mhclo",
        clothes=["drednicolson_short-tail_camo_tee.mhclo", "cortu_cargo_pants.mhclo", "culturalibre_male_boots.mhclo",
                 "mrgreaterthan_m1_helmet.mhclo"],
        eye_mat="brown.mhmat",
        tint={"cargo": (0.28, 0.31, 0.2), "boots": (0.12, 0.1, 0.08)},
    ),
    "soldier2": dict(
        phenotype=dict(gender=1.0, age=0.4, muscle=0.8, weight=0.55, height=0.7, proportions=0.6, race=AFR),
        skin="young_african_male.mhmat", hair="short01.mhclo",
        clothes=["drednicolson_short-tail_camo_tee.mhclo", "cortu_cargo_pants.mhclo", "culturalibre_male_boots.mhclo",
                 "mrgreaterthan_m1_helmet.mhclo"],
        eye_mat="brown.mhmat",
        tint={"cargo": (0.28, 0.31, 0.2), "boots": (0.12, 0.1, 0.08)},
    ),
    "larry_soldier": dict(
        phenotype=dict(gender=1.0, age=0.78, muscle=0.3, weight=0.82, height=0.38, proportions=0.35, race=CAU),
        skin="middleage_caucasian_male.mhmat", hair="",
        clothes=["drednicolson_short-tail_camo_tee.mhclo", "cortu_cargo_pants.mhclo", "culturalibre_male_boots.mhclo",
                 "mrgreaterthan_m1_helmet.mhclo", "grinsegold_moustache.mhclo", "frankyaye_glasses_library_male.mhclo"],
        eye_mat="grey.mhmat",
        tint={"cargo": (0.28, 0.31, 0.2), "boots": (0.12, 0.1, 0.08), "moustache": (0.16, 0.12, 0.1)},
    ),
    # ---------------------------------------------------------------- episode 2
    # DALE FROM IT (episode 2). Assets pinned to what look-dev picked, so he never changes between episodes.
    # Reads opposite to Larry: tall (height 0.85), skinny, younger, long ginger hair + full beard, green tee,
    # khaki shorts, no glasses. (No hoodie exists in the installed packs.)
    "dale": dict(
        phenotype=dict(gender=1.0, age=0.56, muscle=0.22, weight=0.12, height=0.85, proportions=0.45, race=CAU),
        skin="young_caucasian_male.mhmat", hair="long01.mhclo",
        clothes=["elvs_crude_t-shirt_male.mhclo", "cortu_jeans_shorts.mhclo", "shoes03.mhclo",
                 "grinsegold_full_beard.mhclo"],
        tint={"long01": (0.66, 0.24, 0.05), "hoodie": (0.04, 0.26, 0.14), "crude_t-shirt": (0.04, 0.26, 0.14),
              "jeans_shorts": (0.52, 0.46, 0.3), "beard": (0.55, 0.2, 0.05), "goatee": (0.55, 0.2, 0.05)},
    ),
    # matching T-shirts (episode 2): plain white tees; the shot attaches the "your face" print to the chest
    "dale_tee": dict(
        phenotype=dict(gender=1.0, age=0.56, muscle=0.22, weight=0.12, height=0.85, proportions=0.45, race=CAU),
        skin="young_caucasian_male.mhmat", hair="long01.mhclo",
        clothes=["elvs_crude_t-shirt_male.mhclo", "cortu_jeans_shorts.mhclo", "shoes03.mhclo",
                 "grinsegold_full_beard.mhclo"],
        tint={"long01": (0.66, 0.24, 0.05), "crude_t-shirt": (0.95, 0.95, 0.95), "jeans_shorts": (0.52, 0.46, 0.3),
              "beard": (0.55, 0.2, 0.05), "goatee": (0.55, 0.2, 0.05)},
    ),
    "larry_tee": dict(
        phenotype=dict(gender=1.0, age=0.78, muscle=0.3, weight=0.82, height=0.38, proportions=0.35, race=CAU),
        skin="middleage_caucasian_male.mhmat", hair="short04.mhclo",
        clothes=["elvs_crude_t-shirt_male.mhclo", "toigo_wool_pants.mhclo", "shoes01.mhclo",
                 "grinsegold_moustache.mhclo", "frankyaye_glasses_library_male.mhclo"],
        eye_mat="grey.mhmat",
        tint={"crude_t-shirt": (0.95, 0.95, 0.95), "wool_pants": (0.3, 0.22, 0.14), "moustache": (0.16, 0.12, 0.1)},
    ),
    # you, seventy years later (hospital bed)
    "you_old": dict(
        phenotype=dict(gender=1.0, age=1.0, muscle=0.35, weight=0.4, height=0.5, proportions=0.6, race=CAU),
        skin="old_caucasian_male.mhmat", hair="short02.mhclo",
        clothes=["elvs_crude_t-shirt_male.mhclo"],
        tint={"crude_t-shirt": (0.78, 0.86, 0.95), "short02": (0.75, 0.75, 0.77)},
    ),
}


def _pick(entry):
    """An asset entry is a file name, or a tuple of candidates (names or glob patterns) tried in order against
    the MPFB data folder; the first that exists wins (episode-1 recipes only use plain names, so they are unaffected)."""
    if isinstance(entry, str):
        return entry
    import glob
    root = os.path.expanduser("~/.config/blender/4.5/extensions/.user/user_default/mpfb/data")
    for cand in entry:
        hits = sorted(glob.glob(os.path.join(root, "**", cand), recursive=True))
        if hits:
            print("PICKED", os.path.basename(hits[0]), "for", entry)
            return os.path.basename(hits[0])
    print("NO_MATCH", entry)
    return None


spec = dict(SPECS[NAME])
spec["skin"] = _pick(spec["skin"])
spec["clothes"] = [c for c in (_pick(e) for e in spec["clothes"]) if c]
bpy.ops.wm.read_homefile(use_empty=True)

human_info = HumanService._create_default_human_info_dict()
human_info.update(BASE)
human_info["name"] = NAME
human_info["phenotype"] = spec["phenotype"]
human_info["skin_mhmat"] = spec["skin"]
human_info["skin_material_type"] = "ENHANCED_SSS"
human_info["eyes_material_type"] = "PROCEDURAL_EYES"
BROWN = {"IrisMajorColor": [0.32, 0.17, 0.07, 1.0], "IrisMinorColor": [0.09, 0.045, 0.02, 1.0]}
GREYBLUE = {"IrisMajorColor": [0.36, 0.45, 0.5, 1.0], "IrisMinorColor": [0.1, 0.13, 0.16, 1.0]}
human_info["eyes_material_settings"] = GREYBLUE if NAME.startswith("larry") else BROWN
human_info["hair"] = spec["hair"]
human_info["clothes"] = spec["clothes"]
human_info["rig"] = "cmu_mb"

settings = HumanService.get_default_deserialization_settings()
settings["subdiv_levels"] = 1
basemesh = HumanService.deserialize_from_dict(human_info, settings)

# Facial animation targets: ARKit face units + visemes, transferred onto teeth/brows/lashes/moustache.
try:
    FaceService.load_targets(basemesh, load_microsoft_visemes=True, load_meta_visemes=False, load_arkit_faceunits=True)
    FaceService.interpolate_targets(basemesh)
except Exception as e:  # keep going even if face units fail
    print("FACE_TARGETS_FAILED", e)

rig = basemesh.parent
print("RIG", rig.name if rig else None)
for o in bpy.data.objects:
    print("OBJ", o.name, o.type, "parent=", o.parent.name if o.parent else None,
          "mats=", [m.name for m in getattr(o.data, "materials", [])] if o.type == "MESH" else "")
    if o.type == "MESH" and o.data.shape_keys:
        print("   shapekeys", len(o.data.shape_keys.key_blocks))

# --- tint clothes: flat colour x (texture luminance normalised by its mean) -> keeps folds/stitching
import numpy as np
def _mean_lum(img):
    try:
        px = np.empty(len(img.pixels), dtype=np.float32); img.pixels.foreach_get(px)
        px = px.reshape(-1, 4)
        px = px[px[:, 3] > 0.5] if (px[:, 3] > 0.5).any() else px
        lum = px[:, 0] * 0.2126 + px[:, 1] * 0.7152 + px[:, 2] * 0.0722
        return float(np.clip(lum.mean(), 0.02, 1.0))
    except Exception as e:
        print("LUM_FAIL", e); return 0.5

def tint_material(mat, rgb):
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        print("NO_BSDF", mat.name, [n.type for n in nt.nodes]); return
    inp = bsdf.inputs["Base Color"]
    src = inp.links[0].from_socket if inp.links else None
    img_node = src.node if (src is not None and src.node.type == "TEX_IMAGE") else next((n for n in nt.nodes if n.type == "TEX_IMAGE"), None)
    mean = _mean_lum(img_node.image) if (img_node and img_node.image) else 0.5
    bw = nt.nodes.new("ShaderNodeRGBToBW")
    gain = nt.nodes.new("ShaderNodeMath"); gain.operation = "MULTIPLY"; gain.inputs[1].default_value = 1.0 / mean
    soft = nt.nodes.new("ShaderNodeMapRange")  # compress contrast a little so tint reads as fabric, not noise
    soft.inputs["From Min"].default_value = 0.0; soft.inputs["From Max"].default_value = 2.0
    soft.inputs["To Min"].default_value = 0.35; soft.inputs["To Max"].default_value = 1.45
    mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    mul.inputs[7].default_value = (*rgb, 1.0)
    if src is not None:
        nt.links.new(src, bw.inputs[0])
    else:
        bw.inputs[0].default_value = (*inp.default_value[:3], 1.0)
    nt.links.new(bw.outputs[0], gain.inputs[0])
    nt.links.new(gain.outputs[0], soft.inputs["Value"])
    nt.links.new(soft.outputs[0], mul.inputs[6])
    nt.links.new(mul.outputs[2], inp)
    print("TINTED", mat.name, rgb, "mean", round(mean, 3))

for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    for frag, rgb in spec["tint"].items():
        if frag in o.name.lower() or any(frag in (m.name.lower() if m else "") for m in o.data.materials):
            for m in o.data.materials:
                if m and m.use_nodes:
                    tint_material(m, rgb)

# glasses: make lenses clear
for o in bpy.data.objects:
    if o.type == "MESH" and "glasses" in o.name.lower() and "sunglass" not in o.name.lower():
        for m in o.data.materials:
            if not m or not m.use_nodes: continue
            b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if b:
                m.blend_method = "HASHED" if hasattr(m, "blend_method") else None

# sunglasses: dark glossy lenses
for o in bpy.data.objects:
    if o.type == "MESH" and "sunglass" in o.name.lower():
        for m in o.data.materials:
            if not m or not m.use_nodes: continue
            b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if b:
                for l in list(b.inputs["Base Color"].links): m.node_tree.links.remove(l)
                for l in list(b.inputs["Alpha"].links): m.node_tree.links.remove(l)
                b.inputs["Base Color"].default_value = (0.01, 0.01, 0.012, 1); b.inputs["Alpha"].default_value = 1.0
                b.inputs["Roughness"].default_value = 0.08; b.inputs["Metallic"].default_value = 0.6
                print("DARK_LENS", m.name)

# Eye colour
eyes = ObjectService.find_object_of_type_amongst_nearest_relatives(basemesh, "Eyes")
print("EYES", eyes.name if eyes else None)

rig["char_name"] = NAME
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=False)
print("SAVED", OUT)
