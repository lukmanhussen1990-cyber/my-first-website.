# Preview all mesh objects of a .blend (or a collection inside it). Usage: blender -b -P preview_blend.py -- <file.blend> <out.png> [name_filter]
import bpy, sys, math
from mathutils import Vector
argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
FILT = argv[2] if len(argv) > 2 else ""
bpy.ops.wm.read_homefile(use_empty=True)
sc = bpy.context.scene
with bpy.data.libraries.load(SRC, link=False) as (src, dst):
    dst.objects = [n for n in src.objects if FILT.lower() in n.lower()]
objs = [o for o in dst.objects if o is not None]
for o in objs:
    sc.collection.objects.link(o)
print("OBJECTS", [(o.name, o.type) for o in objs][:40])
meshes = [o for o in objs if o.type == "MESH"]
bpy.context.view_layer.update()
mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
ctr = (mn + mx) / 2; size = (mx - mn).length
print("BOUNDS", tuple(round(v, 2) for v in mn), tuple(round(v, 2) for v in mx))
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.6, 0.68, 1)
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3
sun.rotation_euler = (math.radians(45), 0, math.radians(35)); sc.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 35
cam.location = ctr + Vector((0.8, -1.2, 0.6)).normalized() * size * 1.1
cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.clip_end = size * 10
sc.render.engine = "BLENDER_EEVEE_NEXT"; sc.eevee.taa_render_samples = 4
sc.render.resolution_x, sc.render.resolution_y = 640, 480
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
