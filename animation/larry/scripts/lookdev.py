# Look-dev render of a character .blend: appends the character, lights it, renders a portrait.
# Usage: blender -b --python lookdev.py -- <char.blend> <out.png> [closeup|full] [expression-json]
import bpy, sys, json, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
CHAR, OUT = argv[0], argv[1]
MODE = argv[2] if len(argv) > 2 else "closeup"
EXPR = json.loads(argv[3]) if len(argv) > 3 else {}

bpy.ops.wm.read_homefile(use_empty=True)
with bpy.data.libraries.load(CHAR, link=False) as (src, dst):
    dst.objects = src.objects
sc = bpy.context.scene
for o in dst.objects:
    sc.collection.objects.link(o)
rig = next(o for o in dst.objects if o.type == "ARMATURE")
body = next(o for o in dst.objects if o.name.endswith(".body"))

# relaxed arms-down pose
pb = rig.pose.bones
for side, s in (("Left", 1), ("Right", -1)):
    b = pb.get(side + "Arm")
    if b:
        b.rotation_mode = "XYZ"
for b in pb:
    b.rotation_mode = "QUATERNION"

def rot_world(bone_name, axis, deg):
    """rotate a pose bone around an armature-space axis"""
    from mathutils import Matrix, Quaternion
    b = pb[bone_name]
    bpy.context.view_layer.update()
    M = b.matrix.copy()
    R = Quaternion(axis, math.radians(deg)).to_matrix().to_4x4()
    loc = M.translation.copy()
    M2 = R @ M
    M2.translation = loc
    b.matrix = M2
    bpy.context.view_layer.update()

# bring arms down from T-pose if needed: measure arm direction
bpy.context.view_layer.update()
la = pb["LeftArm"]; v = (la.tail - la.head).normalized()
print("LEFT_ARM_DIR", tuple(round(x, 3) for x in v))
ang = math.degrees(math.asin(max(-1, min(1, -v.z))))  # current downward angle
need = 72 - ang
rot_world("LeftArm", Vector((0, 1, 0)), need * (1 if v.x > 0 else -1))
ra = pb["RightArm"]; v2 = (ra.tail - ra.head).normalized()
rot_world("RightArm", Vector((0, 1, 0)), -need * (1 if v2.x > 0 else -1))
for side in ("LeftForeArm", "RightForeArm"):
    pass

# expression
if EXPR and body.data.shape_keys:
    kb = body.data.shape_keys.key_blocks
    for k, v in EXPR.items():
        for key in kb:
            if key.name.lower().endswith(k.lower()):
                key.value = v
    # children share same names
    for o in dst.objects:
        if o.type == "MESH" and o.data.shape_keys and o is not body:
            for k, v in EXPR.items():
                for key in o.data.shape_keys.key_blocks:
                    if key.name.lower().endswith(k.lower()):
                        key.value = v

# world + lights
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.42, 0.5, 0.62, 1); bg.inputs[1].default_value = 0.8
def light(name, typ, loc, rot, energy, color=(1, 1, 1), size=1.0):
    d = bpy.data.lights.new(name, typ); d.energy = energy; d.color = color
    if typ == "AREA": d.size = size
    o = bpy.data.objects.new(name, d); o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
    sc.collection.objects.link(o); return o
light("key", "AREA", (-1.2, -1.6, 2.2), (55, 0, -35), 260, (1.0, 0.95, 0.88), 1.5)
light("fill", "AREA", (1.6, -1.4, 1.5), (70, 0, 45), 80, (0.85, 0.9, 1.0), 2.0)
light("rim", "AREA", (0.4, 1.6, 2.0), (-60, 0, 170), 160, (1, 1, 1), 1.0)

# camera
head = pb["Head"]
bpy.context.view_layer.update()
hpos = rig.matrix_world @ head.head
cam_d = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
if MODE == "closeup":
    cam_d.lens = 70
    tgt = hpos + Vector((0, 0, 0.06))
    cam.location = tgt + Vector((0.25, -1.25, 0.02))
else:
    cam_d.lens = 35
    tgt = Vector((0, 0, hpos.z * 0.55))
    cam.location = tgt + Vector((0.4, -3.6, 0.15))
d = tgt - cam.location
cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
# floor
bpy.ops.mesh.primitive_plane_add(size=30); fl = bpy.context.object
fm = bpy.data.materials.new("floor"); fm.use_nodes = True
fm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.35, 0.35, 0.37, 1); fl.data.materials.append(fm)

sc.render.engine = "BLENDER_EEVEE_NEXT"
sc.eevee.taa_render_samples = 24
sc.eevee.use_shadows = True
sc.render.resolution_x, sc.render.resolution_y = 720, 1280
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast"
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("DONE", OUT)
