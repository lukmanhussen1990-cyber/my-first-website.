"""Render a pose test sheet with Workbench for quick iteration."""
import bpy, sys, os, math, importlib
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rigtools, poses
importlib.reload(rigtools); importlib.reload(poses)

args = sys.argv[sys.argv.index("--") + 1:]
OUTDIR = args[0]
WHO = args[1] if len(args) > 1 else "YOU"
VIEW = args[2] if len(args) > 2 else "front"
names = args[3].split(",") if len(args) > 3 else None
os.makedirs(OUTDIR, exist_ok=True)

sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'TEXTURE'
sc.display.shading.show_shadows = True
sc.render.resolution_x = 360
sc.render.resolution_y = 640

other = "FRIEND" if WHO == "YOU" else "YOU"
for ob in bpy.data.objects:
    if ob.name == other or ob.name.startswith(other + "."):
        ob.hide_render = True

rig_obj = bpy.data.objects[WHO]
rig_obj.location = (0, 0, 0)
rig = rigtools.Rig(rig_obj)

cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 35
cam = bpy.data.objects.new("Cam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
pos = {"front": (1.6, -3.6, 1.2), "side": (3.8, -0.2, 1.1), "back": (-1.4, 3.6, 1.3),
       "face": (0.25, -0.9, 1.62)}[VIEW]
cam.location = pos
tgt = Vector((0, 0, 0.9)) if VIEW != "face" else Vector((0, 0, 1.6))
if VIEW == "face":
    cam_data.lens = 60
cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()

for name, pose in poses.TEST:
    if names and name not in names:
        continue
    rigtools.apply_pose(rig, pose)
    bpy.context.view_layer.update()
    sc.render.filepath = os.path.join(OUTDIR, f"{WHO}_{VIEW}_{name}.png")
    bpy.ops.render.render(write_still=True)
    print("POSE_DONE", name)
