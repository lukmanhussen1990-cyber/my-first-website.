import sys, math, time
sys.path.insert(0, '/home/user/work/scripts')
import bpy
from common import *

out = sys.argv[1] if len(sys.argv) > 1 else '/home/user/work/test/turn'
views = sys.argv[2].split(',') if len(sys.argv) > 2 else ['front', 'q34', 'side', 'back', 'face', 'face34', 'faceside']
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
rig = load_caveman(sc)
setup_render(sc, 540, 960, 8)
sky_world(sc)
add_sun(sc)
bpy.ops.mesh.primitive_plane_add(size=20)
g = bpy.context.active_object
gm = bpy.data.materials.new('g'); gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.2, 0.45, 0.08, 1)
g.data.materials.append(gm)
co = make_camera(sc)

rig.reset()
rig.rot('upperarm.L', (0, 42, 8)); rig.rot('upperarm.R', (0, -42, -8))
rig.rot('forearm.L', (12, 0, 0)); rig.rot('forearm.R', (12, 0, 0))
rig.rot('fingers1.L', (0, 0, 0))
rig.rot('lidU.L', (0, 0, 0))
bpy.context.view_layer.update()

V = {
    'front': ((0, -3.6, 1.1), (0, 0, 1.0), 40),
    'q34': ((2.2, -2.9, 1.3), (0, 0, 1.0), 40),
    'side': ((3.6, 0, 1.1), (0, 0, 1.0), 40),
    'back': ((-1.5, 3.3, 1.2), (0, 0, 1.0), 40),
    'face': ((0.0, -0.8, 1.73), (0, -0.05, 1.68), 70),
    'face34': ((0.45, -0.68, 1.75), (0, -0.04, 1.68), 70),
    'faceside': ((0.8, -0.1, 1.72), (0, -0.02, 1.68), 70),
    'hands': ((0.5, -0.9, 1.0), (0.3, -0.05, 0.85), 60),
}
for v in views:
    eye, tgt, lens = V[v]
    look_at(co, eye, tgt)
    co.data.lens = lens
    sc.render.filepath = f'{out}_{v}.png'
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(v, 'render', round(time.time() - t, 1))
