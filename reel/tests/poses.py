import bpy, sys, math, os
sys.path.insert(0, "/home/user/my-first-website./reel/scripts")
import mh
S = "/tmp/claude-0/-home-user-my-first-website-/3c59c3fd-21fb-5fbc-8069-3de2349d9bdd/scratchpad/po"
os.makedirs(S, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath="/tmp/claude-0/-home-user-my-first-website-/3c59c3fd-21fb-5fbc-8069-3de2349d9bdd/scratchpad/lineup.blend")
sc = bpy.context.scene
you = bpy.data.objects["You"]
for n in ("Mom", "Cop1", "Cop2", "Baby"):
    for o in mh.children(bpy.data.objects[n]) + [bpy.data.objects[n]]:
        o.hide_render = True
cam = sc.camera
cam.location = (-1.5 + 2.2, -3.0, 1.0); cam.rotation_euler = (math.radians(87), 0, math.radians(35)); cam.data.lens = 35
sc.render.resolution_percentage = 25
for p in sys.argv[sys.argv.index("--") + 1:]:
    try:
        mh.apply_bvh_pose(you, p)
    except Exception as e:
        print("ERR", p, e); continue
    sc.render.filepath = f"{S}/{p}.png"
    bpy.ops.render.render(write_still=True)
