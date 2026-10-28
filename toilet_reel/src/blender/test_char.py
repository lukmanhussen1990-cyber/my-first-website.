"""Pose the character in a relaxed stance and render a turnaround.

blender -b char.blend --python test_char.py -- out_prefix [res] [views]
"""
import os
import sys
import math
import bpy
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.dirname(HERE)]
import rig_core as RC  # noqa: E402
import common as C  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]
RES = int(argv[1]) if len(argv) > 1 else 480
VIEWS = argv[2].split(',') if len(argv) > 2 else ['front', 'side', 'q34', 'back', 'face', 'faceF']

sc = bpy.context.scene
if os.environ.get('PRE'):
    import runpy
    runpy.run_path(os.environ['PRE'])
rig = bpy.data.objects['Rig']
sk = RC.Skeleton(rig)
q = RC.qeuler

# ---- relaxed old-man stance
sk.loc['hips'] = Vector((0, -0.018, 0))
sk.rot['spine'] = q(6, 0, 0)
sk.rot['chest'] = q(12, 0, 0)
sk.rot['neck'] = q(14, 0, 0)
sk.rot['head'] = q(-22, 0, 0)
for side, s in (('L', 1), ('R', -1)):
    # legs: planted feet, slight knee bend
    ank = sk.rest['foot.' + side].to_translation()
    sk.two_bone('thigh.' + side, 'shin.' + side, ank, (s * 0.10, -0.8, 0.5), flip=True)
    sk.set_world_rot('foot.' + side, sk.rest['foot.' + side].to_3x3(), pos=ank)
    # arms hanging
    sh = sk.head_pos('upperarm.' + side)
    wrist = Vector((s * 0.205, -0.045, 0.905))
    sk.two_bone('upperarm.' + side, 'forearm.' + side, wrist, (s * 0.35, 0.45, 1.05))
    sk.aim('hand.' + side, (s * 0.10, -0.12, -1.0), (-s * 1.0, -0.15, 0.0))
    for f, base in (('index', 14), ('middle', 18), ('ring', 22), ('pinky', 26)):
        sk.rot[f'{f}1.{side}'] = q(base, 0, 0)
        sk.rot[f'{f}2.{side}'] = q(base + 10, 0, 0)
        sk.rot[f'{f}3.{side}'] = q(base, 0, 0)
    sk.rot[f'thumb2.{side}'] = q(10, 0, 0)
if not os.environ.get('NOPOSE'):
    sk.apply()
bpy.context.view_layer.update()

# ---- lighting + ground like the reference
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.62, 0.74, 0.90, 1)
bg.inputs[1].default_value = 0.9
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(48), 0, math.radians(-30)); sun.data.energy = 3.2
sun.data.angle = math.radians(5)
bpy.ops.mesh.primitive_plane_add(size=12)
g = bpy.context.object
gm = C.new_mat('ground', (0.22, 0.42, 0.12), 0.9)
g.data.materials.append(gm)

sc.render.engine = 'BLENDER_EEVEE'
ee = sc.eevee
ee.taa_render_samples = 16
ee.use_soft_shadows = True
ee.use_gtao = True
ee.gtao_distance = 0.15
ee.shadow_cube_size = '1024'
ee.shadow_cascade_size = '2048'
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
sc.render.resolution_x = RES
sc.render.resolution_y = int(RES * 16 / 9)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
sc.camera = cam
VIEW = {
    'front': ((0, -4.4, 1.05), (0, 0, 0.86), 50),
    'side': ((4.4, -0.2, 1.05), (0, 0, 0.86), 50),
    'q34': ((2.8, -3.3, 1.25), (0, 0, 0.86), 50),
    'back': ((0.5, 4.4, 1.05), (0, 0, 0.86), 50),
    'face': ((0.32, -0.78, 1.60), (0, -0.04, 1.53), 75),
    'faceF': ((0.0, -0.85, 1.56), (0, -0.04, 1.53), 75),
    'hands': ((0.55, -0.8, 1.0), (0.18, -0.05, 0.92), 60),
    'upper': ((0.6, -1.6, 1.45), (0, -0.02, 1.32), 55),
}
import runpy
for v in VIEWS:
    pos, tgt, lens = VIEW[v]
    cam.location = pos
    C.look_at(cam, tgt)
    cam.data.lens = lens
    sc.render.filepath = f'{OUT}_{v}.png'
    bpy.ops.render.render(write_still=True)
    if os.environ.get('VT'):
        sys.argv = ['x', '--', f'{OUT}_{v}']
        runpy.run_path(os.environ['VT'])
