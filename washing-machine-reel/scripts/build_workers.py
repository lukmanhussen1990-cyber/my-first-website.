"""Build 6 MPFB worker variants (male_worksuit01), each with its own work table + tub, scrub IK animation.
Saved into workers.blend (collections WorkerVar_0..5) to be appended into master."""
import bpy, sys, math, random, importlib, time
sys.path.insert(0, "/opt/work/scripts")
import lib, mh_common as mc
from mathutils import Vector

t0 = time.time()
mc.clear_scene()
HumanService, FaceService = mc.ensure_mpfb()
TargetService = importlib.import_module(mc.MPFB + ".services.targetservice").TargetService

VARIANTS = [
    dict(gender=1.0, race=(0.0, 1.0, 0.0), skin="young_caucasian_male.mhmat", hair="short02.mhclo", shoes="shoes02.mhclo", w=0.55, h=0.5),
    dict(gender=1.0, race=(0.0, 0.0, 1.0), skin="young_african_male.mhmat", hair="short03.mhclo", shoes="shoes04.mhclo", w=0.6, h=0.6),
    dict(gender=0.0, race=(0.0, 1.0, 0.0), skin="young_caucasian_female.mhmat", hair="ponytail01.mhclo", shoes="shoes06.mhclo", w=0.5, h=0.4),
    dict(gender=1.0, race=(1.0, 0.0, 0.0), skin="young_asian_male.mhmat", hair="short04.mhclo", shoes="shoes03.mhclo", w=0.5, h=0.45),
    dict(gender=1.0, race=(0.0, 1.0, 0.0), skin="middleage_caucasian_male.mhmat", hair="short01.mhclo", shoes="shoes01.mhclo", w=0.7, h=0.55),
    dict(gender=0.0, race=(0.0, 0.0, 1.0), skin="young_african_female.mhmat", hair="afro01.mhclo", shoes="shoes05.mhclo", w=0.55, h=0.45),
]

TABLE_H = 0.78


def build_variant(i, v):
    pheno = {"gender": v["gender"], "age": 0.5, "muscle": 0.5, "weight": v["w"], "proportions": 0.5, "height": v["h"],
             "cupsize": 0.5, "firmness": 0.5,
             "race": {"asian": v["race"][0], "caucasian": v["race"][1], "african": v["race"][2]}}
    body, rig = mc.build_human(f"W{i}", pheno, skin=v["skin"], hair=v["hair"],
                               clothes=("male_worksuit01.mhclo", v["shoes"]), teeth="", tongue="",
                               faceunits=False, skin_type="MAKESKIN")
    # bake modelling targets -> no shape keys
    try:
        TargetService.bake_targets(body)
    except Exception as e:
        print("bake failed", e)
    for o in mc.children_meshes(rig):
        if o.data.shape_keys:
            o.shape_key_clear()
    mc.add_ik(rig, prefix="IK")
    return body, rig


def scrub_anim(rig, tub_center_rel, phase, f0=1, f1=600, period=14):
    """IK hands scrub back/forth inside tub (rig-space positions)."""
    pb = rig.pose.bones
    # lean forward + look down
    for bn, ang in (("spine_01", 6), ("spine_02", 8), ("spine_03", 6), ("neck_01", 8), ("head", 14)):
        b = pb[bn]
        b.rotation_mode = 'XYZ'
        b.rotation_euler = (math.radians(ang), 0, 0)
        b.keyframe_insert("rotation_euler", frame=f0)
    bpy.context.view_layer.update()
    for side, sx in (("l", 1), ("r", -1)):
        t = pb[f"IK_hand_{side}"]
        rest = rig.data.bones[f"IK_hand_{side}"].head_local
        c = Vector(tub_center_rel) + Vector((sx * 0.09, 0, 0))
        f = f0
        k = 0
        while f <= f1:
            ph = (k % 2)
            off = Vector((0, (0.07 if ph else -0.07) * (1 if side == "l" else -1), 0.0 if ph else 0.02))
            t.location = (c + off) - rest
            t.keyframe_insert("location", frame=f + phase)
            f += period // 2
            k += 1
        # hand orientation: palms down
        t.rotation_mode = 'XYZ'
        t.rotation_euler = (math.radians(-60), 0, math.radians(sx * -20))
        t.keyframe_insert("rotation_euler", frame=f0)


def main():
    from build_set import append_ph
    from build_props import build_tub
    random.seed(4)
    for i, v in enumerate(VARIANTS):
        C = lib.coll(f"WorkerVar_{i}")
        body, rig = build_variant(i, v)
        for o in [rig] + rig.children_recursive:
            lib.link(o, C)
        # table + tub in front of worker (worker faces -Y)
        objs = append_ph("WoodenTable_01", C)
        t = objs[0]; t.name = f"WTable_{i}"
        t.scale = (0.5, 0.95, TABLE_H / 0.55)
        bpy.context.view_layer.update()
        zmin = min((t.matrix_world @ Vector(c)).z for c in t.bound_box)
        t.location = (0, -0.48, t.location.z - zmin)
        bpy.context.view_layer.update()
        top = max((t.matrix_world @ Vector(c)).z for c in t.bound_box)
        tub, water = build_tub(C, (0, -0.48, top), f"WTub_{i}", scale=0.8)
        water.data.materials[0].node_tree.nodes["Foam"].outputs[0].default_value = 0.85
        water.data.materials[0].node_tree.nodes["Dirt"].outputs[0].default_value = 0.25
        for o in (tub, water) + tuple(tub.children):
            lib.link(o, C)
        # rig space == world here (rig at origin)
        tub_c = (0, -0.42, top + 0.13)
        scrub_anim(rig, tub_c, phase=random.randint(0, 12))
        rig["variant"] = i
        print("variant", i, "done", time.time() - t0)
    bpy.ops.wm.save_as_mainfile(filepath="/opt/work/blend/workers.blend")
    print("WORKERS saved", time.time() - t0)


main()
