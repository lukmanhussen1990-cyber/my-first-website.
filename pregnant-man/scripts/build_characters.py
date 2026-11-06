"""Step 2: build the MakeHuman characters with MPFB2 (CC0 output) -> build/characters.blend

Run with the bpy module (Blender 5.2 as a Python module) after MPFB2 is installed as the
user extension 'bl_ext.user_default.mpfb':
    python scripts/build_characters.py <makehuman_system_assets_dir> build/characters.blend
Each character goes into its own collection CHR_<name> with a Mixamo-named skeleton.
"""
import importlib
import os
import sys

import bpy

ASSETS, OUT = sys.argv[1], sys.argv[2]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module="bl_ext.user_default.mpfb")
HumanService = importlib.import_module("bl_ext.user_default.mpfb.services.humanservice").HumanService
TargetService = importlib.import_module("bl_ext.user_default.mpfb.services.targetservice").TargetService

# name: (macro overrides, race, skin, hair, eyebrows, clothes...)
CHARACTERS = {
    "main": dict(macro=dict(gender=1.0, age=0.5, weight=1.0, muscle=0.3, height=0.45, proportions=0.5),
                 race=(0, 1, 0), skin="young_caucasian_male", hair="short02", brows="eyebrow001", lashes="eyelashes01",
                 clothes=["male_casualsuit06", "shoes04"]),
    "crush": dict(macro=dict(gender=0.0, age=0.5, weight=0.45, muscle=0.45, height=0.6, proportions=0.7, cupsize=0.5),
                  race=(0, 1, 0), skin="young_caucasian_female", hair="long01", brows="eyebrow006", lashes="eyelashes02",
                  clothes=["female_elegantsuit01", "shoes04"]),
    "boss": dict(macro=dict(gender=1.0, age=0.85, weight=1.0, muscle=0.45, height=0.55, proportions=0.4),
                 race=(0, 1, 0), skin="old_caucasian_male", hair="short04", brows="eyebrow003", lashes="eyelashes01",
                 clothes=["male_elegantsuit01", "shoes04"]),
    "cw1": dict(macro=dict(gender=1.0, age=0.45, weight=0.55, muscle=0.5, height=0.6),
                race=(0, 0, 1), skin="young_african_male", hair="short01", brows="eyebrow002", lashes="eyelashes01",
                clothes=["male_casualsuit03", "shoes01"]),
    "cw2": dict(macro=dict(gender=0.0, age=0.6, weight=0.6, muscle=0.4, height=0.45, proportions=0.6),
                race=(1, 0, 0), skin="young_asian_female", hair="ponytail01", brows="eyebrow007", lashes="eyelashes03",
                clothes=["female_casualsuit01", "shoes05"]),
    "cousin": dict(macro=dict(gender=1.0, age=0.12, weight=0.5, muscle=0.5, height=0.5, proportions=0.5),
                   race=(0, 1, 0), skin="young_caucasian_male", hair="short02", brows="eyebrow001", lashes="eyelashes01",
                   clothes=["female_casualsuit02", "shoes05"]),
    "main_preg": dict(macro=dict(gender=1.0, age=0.5, weight=1.0, muscle=0.3, height=0.45, proportions=0.5),
                      race=(0, 1, 0), skin="young_caucasian_male", hair="short02", brows="eyebrow001", lashes="eyelashes01",
                      clothes=["male_casualsuit06", "shoes04"], targets={"stomach-pregnant-incr": 1.0}),
    "doctor": dict(macro=dict(gender=1.0, age=0.72, weight=0.55, muscle=0.5, height=0.55, proportions=0.6),
                   race=(0, 1, 0), skin="middleage_caucasian_male", hair="short04", brows="eyebrow003", lashes="eyelashes01",
                   clothes=["male_elegantsuit01", "shoes04"]),
    "baby": dict(macro=dict(gender=0.5, age=0.0, weight=0.6, muscle=0.5, height=0.5, proportions=0.5),
                 race=(0, 1, 0), skin="young_caucasian_female", hair="short01", brows="eyebrow006", lashes="eyelashes02",
                 clothes=["female_casualsuit02"]),
    "cw3": dict(macro=dict(gender=1.0, age=0.7, weight=0.75, muscle=0.4, height=0.5),
                race=(0, 1, 0), skin="middleage_caucasian_male", hair="short03", brows="eyebrow004", lashes="eyelashes01",
                clothes=["male_casualsuit05", "shoes02"]),
}

only = sys.argv[3].split(",") if len(sys.argv) > 3 else list(CHARACTERS)
for name in only:
    spec = CHARACTERS[name]
    before = set(bpy.data.objects)
    macro = TargetService.get_default_macro_info_dict()
    macro.update(spec["macro"])
    a, c, f = spec["race"]
    macro["race"] = {"asian": float(a), "caucasian": float(c), "african": float(f)}
    bm = HumanService.create_human(macro_detail_dict=macro)
    for tname, tval in spec.get("targets", {}).items():    # built-in MakeHuman shape targets (e.g. pregnant belly)
        TargetService.load_target(bm, TargetService.target_full_path(tname), weight=tval)
    rig = HumanService.add_builtin_rig(bm, "mixamo")
    HumanService.set_character_skin(os.path.join(ASSETS, f"skins/{spec['skin']}/{spec['skin']}.mhmat"), bm,
                                    skin_type="ENHANCED_SSS")
    parts = [("eyes/high-poly/high-poly.mhclo", "Eyes"),
             (f"eyebrows/{spec['brows']}/{spec['brows']}.mhclo", "Eyebrows"),
             (f"eyelashes/{spec['lashes']}/{spec['lashes']}.mhclo", "Eyelashes"),
             (f"hair/{spec['hair']}/{spec['hair']}.mhclo", "Hair")]
    parts += [(f"clothes/{cl}/{cl}.mhclo", "Clothes") for cl in spec["clothes"]]
    for rel, typ in parts:
        HumanService.add_mhclo_asset(os.path.join(ASSETS, rel), bm, asset_type=typ, subdiv_levels=0)
    new = [o for o in bpy.data.objects if o not in before]
    coll = bpy.data.collections.new(f"CHR_{name}")
    bpy.context.scene.collection.children.link(coll)
    for o in new:
        for uc in list(o.users_collection):
            uc.objects.unlink(o)
        coll.objects.link(o)
        if o == rig:
            o.name = f"{name}_rig"
        elif o == bm:
            o.name = f"{name}_body"
        else:
            o.name = f"{name}_" + o.name.split(".", 1)[-1]
        # keep render cost low: no subdivision on characters
        for m in o.modifiers:
            if m.type == "SUBSURF":
                m.levels = 0
                m.render_levels = 0
    rig.data.name = f"{name}_arm"
    print("built", name, len(new), "objects")

bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT))
