"""Render the 'baby poster' image from the MakeHuman baby (CC0) -> build/baby_poster.png
python scripts/render_poster.py build/characters.blend build/baby_poster.png"""
import math, os, sys
import bpy
from mathutils import Vector
blend, out = [os.path.abspath(a) for a in sys.argv[1:3]]
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
for c in bpy.data.collections:
    if c.name != "CHR_baby":
        for o in list(c.objects):
            bpy.data.objects.remove(o)
rig = bpy.data.objects["baby_rig"]
head = rig.matrix_world @ rig.data.bones["mixamorig:Head"].head_local
sc.render.engine = "BLENDER_EEVEE"; sc.eevee.taa_render_samples = 16
sc.render.resolution_x, sc.render.resolution_y = 750, 500
sc.view_settings.view_transform = "AgX"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (1.0, 0.82, 0.88, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 1.6
for rot, e in [((math.radians(55), 0, math.radians(20)), 3.0), ((math.radians(60), 0, math.radians(-140)), 1.2)]:
    l = bpy.data.objects.new("L", bpy.data.lights.new("L", "SUN")); sc.collection.objects.link(l); l.rotation_euler = rot; l.data.energy = e
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 85
tgt = head + Vector((0, 0, 0.045))
cam.location = tgt + Vector((0.0, -0.95, 0.0))
d = tgt - cam.location
cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
sc.render.film_transparent = False
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
