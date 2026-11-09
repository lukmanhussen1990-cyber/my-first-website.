import bpy, sys, math, os
sys.path.insert(0, "/home/user/my-first-website./reel/scripts")
import mh
S = "/tmp/claude-0/-home-user-my-first-website-/3c59c3fd-21fb-5fbc-8069-3de2349d9bdd/scratchpad/ph"
os.makedirs(S, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath="/tmp/claude-0/-home-user-my-first-website-/3c59c3fd-21fb-5fbc-8069-3de2349d9bdd/scratchpad/lineup.blend")
sc = bpy.context.scene
you = bpy.data.objects["You"]
for n in ("Mom", "Cop1", "Cop2", "Baby"):
    for o in mh.children(bpy.data.objects[n]) + [bpy.data.objects[n]]:
        o.hide_render = True
mh.apply_bvh_pose(you, "callharvey3d_salute")
base = {b.name: b.rotation_euler.copy() for b in you.pose.bones}
cam = sc.camera
hp = you.matrix_world @ you.pose.bones["head"].head
cam.location = (hp.x - 0.25, hp.y - 1.1, hp.z - 0.1); cam.rotation_euler = (math.radians(90), 0, math.radians(-12)); cam.data.lens = 35
sc.render.resolution_percentage = 25
V = {"a": {}, "b": {"upperarm01.R": (25, 0, 0)}, "c": {"upperarm01.R": (0, 0, -25)}, "d": {"upperarm01.R": (0, 0, 25)},
     "e": {"upperarm01.R": (0, 35, 0)}, "f": {"upperarm01.R": (0, -35, 0)}, "g": {"lowerarm01.R": (0, 0, 25)}, "h": {"wrist.R": (0, 0, 40)}}
for k, d in V.items():
    for b in you.pose.bones: b.rotation_euler = base[b.name]
    for bn, (x, y, z) in d.items():
        e = base[bn].copy(); e.x += math.radians(x); e.y += math.radians(y); e.z += math.radians(z); you.pose.bones[bn].rotation_euler = e
    sc.render.filepath = f"{S}/{k}.png"; bpy.ops.render.render(write_still=True)
