"""Quick look-dev render of the characters (front + back)."""
import bpy, sys, time, math
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
OUT = args[0]
VIEW = args[1] if len(args) > 1 else "front"
RES = int(args[2]) if len(args) > 2 else 540

sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.eevee.taa_render_samples = 16
sc.render.resolution_x = RES
sc.render.resolution_y = int(RES * 16 / 9)
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'

world = bpy.data.worlds.new("W") if not sc.world else sc.world
sc.world = world
world.use_nodes = True
nt = world.node_tree
nt.nodes.clear()
sky = nt.nodes.new("ShaderNodeTexSky")
sky.sky_type = 'NISHITA'
sky.sun_elevation = math.radians(50)
sky.sun_rotation = math.radians(150)
sky.altitude = 0
sky.air_density = 1.0
sky.dust_density = 0.6
bg = nt.nodes.new("ShaderNodeBackground")
bg.inputs[1].default_value = 0.35
out = nt.nodes.new("ShaderNodeOutputWorld")
nt.links.new(sky.outputs[0], bg.inputs[0])
nt.links.new(bg.outputs[0], out.inputs[0])

sun_data = bpy.data.lights.new("Sun", 'SUN')
sun_data.energy = 4.0
sun_data.angle = math.radians(3)
sun = bpy.data.objects.new("Sun", sun_data)
sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(40), 0, math.radians(150))

bpy.ops.mesh.primitive_plane_add(size=30)
ground = bpy.context.active_object
mat = bpy.data.materials.new("Asphalt")
mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.13, 0.13, 0.14, 1)
mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
ground.data.materials.append(mat)

cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 35
cam = bpy.data.objects.new("Cam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
if VIEW == "front":
    cam.location = (0, -5.2, 1.1)
elif VIEW == "back":
    cam.location = (0, 5.2, 1.1)
elif VIEW == "face_you":
    cam.location = (-0.6, -1.0, 1.65)
    cam_data.lens = 50
elif VIEW == "face_friend":
    cam.location = (0.6, -1.0, 1.62)
    cam_data.lens = 50
target = Vector((0, 0, 0.95))
if VIEW == "face_you":
    target = Vector((-0.6, 0, 1.62))
if VIEW == "face_friend":
    target = Vector((0.6, 0, 1.58))
d = target - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

sc.render.filepath = OUT
t = time.time()
bpy.ops.render.render(write_still=True)
print("RENDER_SECONDS", time.time() - t)
