"""Quick clay turnaround of raw npz meshes. usage: python viewer.py out_prefix mesh1.npz [mesh2.npz ...]"""
import sys, math
import numpy as np
import bpy, bmesh
from mathutils import Vector

args = sys.argv[1:]
out = args[0]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.eevee.taa_render_samples = 8
sc.render.resolution_x, sc.render.resolution_y = 540, 960

mat = bpy.data.materials.new('clay')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.75, 0.55, 0.45, 1)
bsdf.inputs['Roughness'].default_value = 0.6

for i, path in enumerate(args[1:]):
    d = np.load(path)
    V, F = d['V'], d['F']
    me = bpy.data.meshes.new('m%d' % i)
    me.from_pydata(V.tolist(), [], F.tolist())
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    me.shade_smooth()
    ob = bpy.data.objects.new('m%d' % i, me)
    sc.collection.objects.link(ob)
    ob.data.materials.append(mat)

w = bpy.data.worlds.new('w'); sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.6, 0.7, 0.85, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.5; sun.angle = 0.2
so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
so.rotation_euler = (math.radians(50), math.radians(10), math.radians(-30))

cam = bpy.data.cameras.new('cam'); co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co)
sc.camera = co


def look(cam_obj, eye, target):
    eye, target = Vector(eye), Vector(target)
    cam_obj.location = eye
    cam_obj.rotation_euler = (target - eye).to_track_quat('-Z', 'Y').to_euler()


views = {
    'front': ((0, -4.2, 1.0), (0, 0, 0.95), 50),
    'side': ((4.2, 0, 1.0), (0, 0, 0.95), 50),
    'q34': ((2.6, -3.3, 1.2), (0, 0, 0.95), 50),
    'face': ((0.25, -0.75, 1.76), (0, -0.05, 1.72), 85),
    'faceside': ((0.75, -0.25, 1.74), (0, -0.03, 1.72), 85),
    'hand': ((0.9, -0.55, 1.05), (0.65, -0.05, 1.0), 85),
}
sel = [v for v in views if len(sys.argv) < 0 or True]
for name, (eye, tgt, lens) in views.items():
    look(co, eye, tgt)
    cam.lens = lens
    sc.render.filepath = f'{out}_{name}.png'
    bpy.ops.render.render(write_still=True)
