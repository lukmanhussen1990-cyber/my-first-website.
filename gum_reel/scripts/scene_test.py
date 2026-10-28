import sys, time, math
sys.path.insert(0, '/home/user/work/scripts')
import bpy
from common import *

out = sys.argv[1]
which = sys.argv[2].split(',') if len(sys.argv) > 2 else ['medium', 'wide', 'low', 'face']
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
with bpy.data.libraries.load('/home/user/work/assets/world_env.blend', link=False) as (src, dst):
    dst.collections = [c for c in src.collections]
for c in dst.collections:
    if c.name in ('env', 'grass', 'props', 'studio'):
        sc.collection.children.link(c)
rig = load_caveman(sc)
setup_render(sc, 540, 960, 8)
sky_world(sc)
add_sun(sc)
co = make_camera(sc)
rig.reset()
rig.rot('upperarm.L', (0, 40, 8)); rig.rot('upperarm.R', (0, -40, -8))
rig.rot('forearm.L', (12, 0, 0)); rig.rot('forearm.R', (12, 0, 0))
V = {
    'medium': ((0.15, -2.6, 1.45), (0, 0, 1.2), 32, 2.6),
    'wide': ((0.8, -5.5, 1.5), (0, 0, 1.0), 26, 5.5),
    'low': ((0.3, -1.6, 0.18), (0, 0, 0.9), 22, 1.6),
    'face': ((0.1, -0.75, 1.72), (0, -0.05, 1.68), 50, 0.7),
}
for v in which:
    eye, tgt, lens, fd = V[v]
    look_at(co, eye, tgt)
    co.data.lens = lens
    co.data.dof.use_dof = True
    co.data.dof.focus_distance = fd
    co.data.dof.aperture_fstop = 2.8
    sc.render.filepath = f'{out}_{v}.png'
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(v, 'render', round(time.time() - t, 1))
