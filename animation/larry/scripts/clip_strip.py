# Render a contact strip of a mocap clip on a character (front view), to pick frames.
# Usage: blender -b --python clip_strip.py -- <char.blend> <clip> <out.png> <src_start> <src_end> <count>
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mocap
from mathutils import Vector
argv = sys.argv[sys.argv.index("--") + 1:]
CHAR, CLIP, OUT, A, Bf, N = argv[0], argv[1], argv[2], int(argv[3]), int(argv[4]), int(argv[5])
subj = CLIP.split("_")[0]
bpy.ops.wm.read_homefile(use_empty=True)
sc = bpy.context.scene
with bpy.data.libraries.load(CHAR, link=False) as (src, dst):
    dst.objects = src.objects
for o in dst.objects:
    sc.collection.objects.link(o)
rig = next(o for o in dst.objects if o.type == "ARMATURE")
mocap.ensure_quaternion(rig)
act = mocap.retarget(rig, f"/opt/cmu/amc/{subj}.asf", f"/opt/cmu/amc/{CLIP}.amc", "c", start=A, end=Bf, step=1, in_place=True)
rig.animation_data_create(); rig.animation_data.action = act
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.45, 0.5, 0.55, 1)
s = bpy.data.objects.new("s", bpy.data.lights.new("s", "SUN")); s.data.energy = 3; s.rotation_euler = (math.radians(40), 0, math.radians(20)); sc.collection.objects.link(s)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 35; cam.location = (0.6, -3.3, 1.1); cam.rotation_euler = (Vector((0, 0, 0.95)) - cam.location).to_track_quat("-Z", "Y").to_euler()
sc.render.engine = "BLENDER_EEVEE_NEXT"; sc.eevee.taa_render_samples = 2; sc.eevee.use_shadows = False
sc.render.resolution_x, sc.render.resolution_y = 200, 320
paths = []
total = Bf - A
for i in range(N):
    f = 1 + int(i * (total - 1) / max(1, N - 1))
    sc.frame_set(f)
    sc.render.filepath = f"/tmp/claude-0/strip_{i:02d}.png"; bpy.ops.render.render(write_still=True); paths.append((A + f - 1, sc.render.filepath))
import json
json.dump(paths, open(OUT + ".json", "w"))
