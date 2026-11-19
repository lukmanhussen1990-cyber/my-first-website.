# Render the cast side by side in an idle mocap pose (full body + face close-ups).
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import mocap
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
CHARDIR, OUT = argv[0], argv[1]
names = argv[2].split(",") if len(argv) > 2 else ["you", "larry", "cop", "bodyguard", "soldier", "soldier2", "larry_soldier"]

bpy.ops.wm.read_homefile(use_empty=True)
sc = bpy.context.scene
rigs = []
for i, n in enumerate(names):
    with bpy.data.libraries.load(f"{CHARDIR}/{n}.blend", link=False) as (src, dst):
        dst.objects = src.objects
    for o in dst.objects:
        sc.collection.objects.link(o)
    rig = next(o for o in dst.objects if o.type == "ARMATURE")
    mocap.ensure_quaternion(rig)
    act = mocap.retarget(rig, "/opt/cmu/amc/137.asf", "/opt/cmu/amc/137_28.amc", f"idle_{n}", start=200, end=320, in_place=True)
    rig.animation_data_create(); rig.animation_data.action = act
    rig.location = Vector(((i - (len(names) - 1) / 2) * 0.85, 0, 0))
    if n == "bodyguard":
        rig.scale = (1.12, 1.12, 1.12)
    rigs.append(rig)
sc.frame_set(10)

w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.55, 0.62, 0.72, 1); bg.inputs[1].default_value = 0.9
def light(name, typ, loc, rot, energy, color=(1, 1, 1), size=1.0):
    d = bpy.data.lights.new(name, typ); d.energy = energy; d.color = color
    if typ == "AREA": d.size = size
    o = bpy.data.objects.new(name, d); o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
    sc.collection.objects.link(o); return o
light("sun", "SUN", (0, 0, 10), (45, 0, -30), 3.2, (1.0, 0.95, 0.88))
light("fill", "AREA", (0, -6, 3), (65, 0, 0), 900, (0.85, 0.9, 1.0), 6)
bpy.ops.mesh.primitive_plane_add(size=40)
fm = bpy.data.materials.new("floor"); fm.use_nodes = True
fm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.3, 0.32, 0.3, 1); bpy.context.object.data.materials.append(fm)

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
sc.render.engine = "BLENDER_EEVEE_NEXT"; sc.eevee.taa_render_samples = 16
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
W = 0.85 * len(names)
cam.data.lens = 50
cam.location = Vector((0, -W * 1.55, 1.0)); cam.rotation_euler = (math.radians(88), 0, 0)
sc.render.resolution_x, sc.render.resolution_y = 1600, 900
sc.render.filepath = OUT + "_full.png"
bpy.ops.render.render(write_still=True)
# face close-ups
cam.data.lens = 85
sc.render.resolution_x, sc.render.resolution_y = 400, 500
for rig, n in zip(rigs, names):
    bpy.context.view_layer.update()
    h = rig.matrix_world @ rig.pose.bones["Head"].head
    tgt = h + Vector((0, 0, 0.08 * rig.scale.z))
    cam.location = tgt + Vector((0.15, -1.1, 0.02))
    cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = f"{OUT}_face_{n}.png"
    bpy.ops.render.render(write_still=True)
print("DONE")
