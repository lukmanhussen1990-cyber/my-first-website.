import bpy, sys, math, os
sys.path.insert(0, "/home/user/my-first-website./reel/scripts")
import mh
S = "/tmp/claude-0/-home-user-my-first-website-/3c59c3fd-21fb-5fbc-8069-3de2349d9bdd/scratchpad/ax"
os.makedirs(S, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath="/tmp/claude-0/-home-user-my-first-website-/3c59c3fd-21fb-5fbc-8069-3de2349d9bdd/scratchpad/lineup.blend")
sc = bpy.context.scene
you = bpy.data.objects["You"]
for n in ("Mom", "Cop1", "Cop2"):
    for o in mh.children(bpy.data.objects[n]) + [bpy.data.objects[n]]:
        o.hide_render = True
print("ROTMODE", you.pose.bones["upperarm01.R"].rotation_mode, you.pose.bones["head"].rotation_mode)
base = {b.name: b.rotation_euler.copy() for b in you.pose.bones}
cam = sc.camera
sc.render.resolution_percentage = 25
tests = [("none", None, 0, 0), ("uaR_X+", "upperarm01.R", 0, 60), ("uaR_Z+", "upperarm01.R", 2, 60), ("uaR_Z-", "upperarm01.R", 2, -60),
         ("laR_X+", "lowerarm01.R", 0, 60), ("laR_Z+", "lowerarm01.R", 2, 60), ("head_Y+", "head", 1, 50), ("head_X+", "head", 0, 30),
         ("spine_X+", "spine03", 0, 30), ("ulegR_X+", "upperleg01.R", 0, 40), ("uaL_X+", "upperarm01.L", 0, 60), ("uaL_Z+", "upperarm01.L", 2, 60)]
cam.location = (-1.5, -3.2, 1.2); cam.rotation_euler = (math.radians(85), 0, 0); cam.data.lens = 35
for name, bone, ax, deg in tests:
    for b in you.pose.bones:
        b.rotation_euler = base[b.name]
    if bone:
        e = base[bone].copy(); e[ax] += math.radians(deg); you.pose.bones[bone].rotation_euler = e
    sc.render.filepath = f"{S}/{name}.png"
    bpy.ops.render.render(write_still=True)
# faces
for o in bpy.data.objects:
    o.hide_render = False
baby = bpy.data.objects["Baby"]
mom = bpy.data.objects["Mom"]
def look(obj, head_bone="head", dist=0.6, z=0.05, lens=50):
    from mathutils import Vector
    hp = obj.matrix_world @ obj.pose.bones[head_bone].head
    cam.location = (hp.x, hp.y - dist, hp.z + z); cam.rotation_euler = (math.radians(90), 0, 0); cam.data.lens = lens
look(baby, dist=0.45); sc.render.filepath = f"{S}/face_baby.png"; bpy.ops.render.render(write_still=True)
look(mom, dist=0.6, z=0.08); sc.render.filepath = f"{S}/face_mom.png"; bpy.ops.render.render(write_still=True)
