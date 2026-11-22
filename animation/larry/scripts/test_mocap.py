# Retarget a CMU clip onto a character and render a strip of frames for checking.
# Usage: blender -b --python test_mocap.py -- <char.blend> <clip_id> <outdir> [nframes]
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import mocap
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
CHAR, CLIP, OUTD = argv[0], argv[1], argv[2]
NF = int(argv[3]) if len(argv) > 3 else 6
subj = CLIP.split("_")[0]

bpy.ops.wm.read_homefile(use_empty=True)
with bpy.data.libraries.load(CHAR, link=False) as (src, dst):
    dst.objects = src.objects
sc = bpy.context.scene
for o in dst.objects:
    sc.collection.objects.link(o)
rig = next(o for o in dst.objects if o.type == "ARMATURE")
mocap.ensure_quaternion(rig)
act = mocap.retarget(rig, f"/opt/cmu/amc/{subj}.asf", f"/opt/cmu/amc/{CLIP}.amc", CLIP)
rig.animation_data_create(); rig.animation_data.action = act
n = act["frames"]
print("FRAMES", n, "SCALE", act["scale"])

w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.58, 0.7, 1)
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
bpy.ops.mesh.primitive_plane_add(size=60)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 30
sc.render.engine = "BLENDER_EEVEE_NEXT"; sc.eevee.taa_render_samples = 8
sc.render.resolution_x, sc.render.resolution_y = 360, 640
os.makedirs(OUTD, exist_ok=True)
picks = [1 + int(i * (n - 1) / max(1, NF - 1)) for i in range(NF)]
for i, f in enumerate(picks):
    sc.frame_set(f)
    hips = rig.matrix_world @ rig.pose.bones["Hips"].head
    cam.location = hips + Vector((2.2, -3.6, 0.3))
    d = (hips + Vector((0, 0, -0.1))) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(OUTD, f"{CLIP}_{i:02d}.png")
    bpy.ops.render.render(write_still=True)
    # report feet height
    lt = rig.matrix_world @ rig.pose.bones["LeftToeBase"].head
    rt = rig.matrix_world @ rig.pose.bones["RightToeBase"].head
    print("F", f, "hips", tuple(round(v, 2) for v in hips), "toesZ", round(lt.z, 3), round(rt.z, 3))
print("DONE")
