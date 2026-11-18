import bpy, sys, os, time
sys.path.insert(0, "/opt/work/scripts")
import mh_common as mc

t0 = time.time()
mc.clear_scene()
pheno = {"gender": 1.0, "age": 0.5, "muscle": 0.5, "weight": 0.42, "proportions": 0.6, "height": 0.55,
         "cupsize": 0.5, "firmness": 0.5, "race": {"asian": 0.0, "caucasian": 1.0, "african": 0.0}}
body, rig = mc.build_human("You", pheno)
print("built in", time.time() - t0, "body", body.name, "rig", rig.name if rig else None)
for o in mc.children_meshes(rig):
    sk = o.data.shape_keys
    print(" child:", o.name, len(o.data.vertices), "verts", len(sk.key_blocks) if sk else 0, "keys",
          [m.type for m in o.modifiers], [m.name for m in o.material_slots])
print("bones:", [b.name for b in rig.data.bones][:80])
mc.add_ik(rig)
os.makedirs("/opt/work/blend", exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath="/opt/work/blend/char_you.blend")
print("saved", time.time() - t0)
