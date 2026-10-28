"""Quick environment look-dev renders. blender -b scene.blend --python test_scene.py -- out [res]"""
import os
import sys
import math
import bpy
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.dirname(HERE)]
import rig_core as RC  # noqa: E402
import poses as PO  # noqa: E402
import common as C  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]
RES = int(argv[1]) if len(argv) > 1 else 540
VIEWS = argv[2].split(',') if len(argv) > 2 else ['wide', 'med', 'bush', 'reveal']
sc = bpy.data.scenes['Garden']
bpy.context.window_manager  # noqa
rig = bpy.data.objects['Rig']
q = RC.qeuler


def place(sk, x, y, heading):
    M = Matrix.Translation((x, y, 0)) @ Matrix.Rotation(math.radians(heading), 4, 'Z') @ sk.rest['root']
    sk.target['root'] = M


sk = RC.Skeleton(rig)
place(sk, 0.0, -0.75, 0.0)
sk.loc['hips'] = Vector((0, -0.018, 0))
sk.rot['spine'] = q(6, 0, 0); sk.rot['chest'] = q(12, 0, 0); sk.rot['neck'] = q(14, 0, 0); sk.rot['head'] = q(-22, 0, 0)
root = sk.world('root')
for side, s in (('L', 1), ('R', -1)):
    ank = root @ (sk.rest['root'].inverted() @ sk.rest['foot.' + side]).to_translation()
    sk.two_bone('thigh.' + side, 'shin.' + side, ank, root @ Vector((s * 0.1, 0.8, 0.5)), flip=True)
    sk.set_world_rot('foot.' + side, root.to_3x3() @ sk.rest['root'].to_3x3().inverted() @ sk.rest['foot.' + side].to_3x3(), pos=ank)
    sk.two_bone('upperarm.' + side, 'forearm.' + side, Vector((s * 0.205, -0.795, 0.905)), (s * 0.35, -0.3, 1.05))
PO.apply_face(sk, PO.mix_expr(('smile', 0.6)))
for side in ('L', 'R'):
    PO.apply_hand(sk, side, 'relaxed')
sk.apply()
bpy.context.view_layer.update()

sc.render.resolution_x = RES
sc.render.resolution_y = int(RES * 16 / 9)
sc.eevee.taa_render_samples = 8
cam = bpy.data.objects['Camera']
V = {
    'wide': ((0.6, -5.2, 1.5), (0, 0.5, 0.85), 30, 5.0, 8.0),
    'med': ((0.25, -2.4, 1.45), (0, -0.75, 1.25), 45, 2.6, 2.8),
    'bush': ((-5.2, -3.4, 1.0), (-6.0, -1.0, 0.7), 50, 4.0, 2.6),
    'reveal': ((0.5, -9.0, 2.2), (0.8, 6.0, 4.0), 22, 8.0, 15.0),
}
for v in VIEWS:
    pos, tgt, lens, fstop, fd = V[v]
    cam.location = pos
    C.look_at(cam, tgt)
    cam.data.lens = lens
    cam.data.dof.aperture_fstop = fstop
    cam.data.dof.focus_distance = fd
    reveal = bpy.data.collections['Reveal']
    for o in reveal.objects:
        o.hide_render = (v != 'reveal')
    sc.render.filepath = f'{OUT}_{v}.png'
    bpy.ops.render.render(write_still=True, scene='Garden')
