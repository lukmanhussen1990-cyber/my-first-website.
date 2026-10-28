"""Quick turnaround renders of a raw SDF mesh (npz).

blender -b --python preview_mesh.py -- mesh.npz out_prefix [res]
"""
import sys
import math
import bpy
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
npz, out = argv[0], argv[1]
res = int(argv[2]) if len(argv) > 2 else 480

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def load_npz(path, name, color):
    d = np.load(path)
    V, F = d['V'], d['F']
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(V)); me.vertices.foreach_set('co', V.ravel())
    me.loops.add(F.size); me.loops.foreach_set('vertex_index', F.ravel())
    me.polygons.add(len(F))
    me.polygons.foreach_set('loop_start', np.arange(0, F.size, 3))
    me.polygons.foreach_set('loop_total', np.full(len(F), 3))
    me.update(); me.validate()
    me.shade_smooth()
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = color
    b.inputs['Roughness'].default_value = 0.55
    me.materials.append(m)
    return ob, m


paths = npz.split(',')
colors = [(0.78, 0.52, 0.40, 1), (0.55, 0.33, 0.15, 1), (0.9, 0.9, 0.9, 1)]
objs = [load_npz(p, f'm{i}', colors[i % 3]) for i, p in enumerate(paths)]
mat = objs[0][1]
mat.node_tree.nodes['Principled BSDF'].inputs['Subsurface Weight'].default_value = 0.15
mat.node_tree.nodes['Principled BSDF'].inputs['Subsurface Radius'].default_value = (0.02, 0.008, 0.005)

# eyes
sys.path.insert(0, __file__.rsplit('/', 1)[0])
sys.path.insert(0, __file__.rsplit('/', 2)[0])
import char_eyes  # noqa
import body_def as BD  # noqa
emat = char_eyes.eye_material()
for side, s in (('L', 1), ('R', -1)):
    c = BD.EYE_C * np.array([s, 1, 1])
    char_eyes.make_eyeball('eye.' + side, tuple(c), BD.EYE_R, emat)
    char_eyes.make_lids('eye.' + side, tuple(c), BD.EYE_R, mat)

w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.65, 0.8, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 0.8
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(-35)); sun.data.energy = 3.5
sun.data.angle = math.radians(6)
fill = bpy.data.objects.new('fill', bpy.data.lights.new('fill', 'SUN')); sc.collection.objects.link(fill)
fill.rotation_euler = (math.radians(70), 0, math.radians(140)); fill.data.energy = 0.8
bpy.ops.mesh.primitive_plane_add(size=10)
pm = bpy.data.materials.new('ground'); pm.use_nodes = True
pm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.3, 0.45, 0.2, 1)
bpy.context.object.data.materials.append(pm)

sc.render.engine = 'BLENDER_EEVEE'
sc.eevee.taa_render_samples = 16
sc.eevee.use_soft_shadows = True
sc.eevee.use_gtao = True
sc.render.resolution_x = res; sc.render.resolution_y = int(res * 16 / 9)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
sc.camera = cam


def look(cam, pos, target, lens):
    from mathutils import Vector
    cam.location = pos
    dvec = Vector(target) - Vector(pos)
    cam.rotation_euler = dvec.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens


views = {
    'front': ((0, -4.2, 1.0), (0, 0, 0.88), 50),
    'back': ((0, 4.2, 1.0), (0, 0, 0.88), 50),
    'torso': ((0.9, -2.2, 1.3), (0, 0, 1.05), 60),
    'hand': ((0.75, -0.55, 1.05), (0.56, 0.0, 0.94), 70),
    'side': ((4.2, 0, 1.0), (0, 0, 0.88), 50),
    'q34': ((2.6, -3.0, 1.2), (0, 0, 0.88), 50),
    'face': ((0.35, -0.75, 1.62), (0, -0.02, 1.56), 85),
    'faceF': ((0.0, -0.8, 1.58), (0, -0.02, 1.565), 85),
    'faceS': ((0.8, -0.05, 1.58), (0, -0.02, 1.565), 85),
    'eyeS': ((0.35, -0.12, 1.575), (0.032, -0.07, 1.571), 120),
    'eyeQ': ((0.25, -0.30, 1.59), (0.032, -0.07, 1.571), 120),
    'eyeF': ((0.032, -0.45, 1.575), (0.032, -0.07, 1.571), 120),
}
sel = argv[3].split(',') if len(argv) > 3 else list(views.keys())
for name in sel:
    pos, tgt, lens = views[name]
    look(cam, pos, tgt, lens)
    sc.render.filepath = f'{out}_{name}.png'
    bpy.ops.render.render(write_still=True)
