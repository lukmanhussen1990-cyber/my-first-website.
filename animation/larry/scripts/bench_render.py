# Quick render-backend benchmark: builds a small lit scene and renders one 720x1280 frame.
import bpy, sys, time
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
engine = argv[0] if argv else "CYCLES"
out = argv[1] if len(argv) > 1 else "/tmp/bench.png"
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.mesh.primitive_plane_add(size=20)
bpy.ops.mesh.primitive_monkey_add(location=(0, 0, 1)); m = bpy.context.object
m.modifiers.new("s", "SUBSURF").levels = 2
bpy.ops.object.shade_smooth()
mat = bpy.data.materials.new("skin"); mat.use_nodes = True
b = mat.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (0.8, 0.55, 0.45, 1)
b.inputs["Subsurface Weight"].default_value = 0.3
m.data.materials.append(mat)
bpy.ops.object.light_add(type="SUN", location=(3, -3, 6)); bpy.context.object.data.energy = 3
bpy.context.object.rotation_euler = (0.7, 0.2, 0.6)
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.65, 0.9, 1)
bpy.ops.object.camera_add(location=(0, -4, 1.4), rotation=(1.48, 0, 0)); sc.camera = bpy.context.object
sc.render.resolution_x, sc.render.resolution_y = 720, 1280
sc.render.filepath = out
if engine == "CYCLES":
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 32
    sc.cycles.use_denoising = True
else:
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.eevee.taa_render_samples = 32
t = time.time(); bpy.ops.render.render(write_still=True)
print("RENDER_TIME", engine, round(time.time() - t, 2))
