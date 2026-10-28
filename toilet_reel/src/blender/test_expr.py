"""Render an expression sheet + hand shapes. blender -b char.blend --python test_expr.py -- out [res]"""
import os
import sys
import math
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.dirname(HERE)]
import rig_core as RC  # noqa: E402
import poses as PO  # noqa: E402
import common as C  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]
RES = int(argv[1]) if len(argv) > 1 else 360
sc = bpy.context.scene
rig = bpy.data.objects['Rig']
q = RC.qeuler


def stance(sk):
    sk.loc['hips'] = Vector((0, -0.018, 0))
    sk.rot['spine'] = q(6, 0, 0)
    sk.rot['chest'] = q(12, 0, 0)
    sk.rot['neck'] = q(14, 0, 0)
    sk.rot['head'] = q(-22, 0, 0)
    for side, s in (('L', 1), ('R', -1)):
        ank = sk.rest['foot.' + side].to_translation()
        sk.two_bone('thigh.' + side, 'shin.' + side, ank, (s * 0.10, -0.8, 0.5), flip=True)
        sk.set_world_rot('foot.' + side, sk.rest['foot.' + side].to_3x3(), pos=ank)


w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.74, 0.90, 1)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(-25)); sun.data.energy = 3.0
sun.data.angle = math.radians(5)
sc.render.engine = 'BLENDER_EEVEE'
sc.eevee.taa_render_samples = 12
sc.eevee.use_soft_shadows = True
sc.eevee.use_gtao = True
sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x = RES
sc.render.resolution_y = RES
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
sc.camera = cam
cam.data.lens = 80

shots = ['neutral', 'smile', 'shock', 'gag', 'angry', 'wink', 'laugh', 'pain', 'smug', 'relaxed']
for e in shots:
    sk = RC.Skeleton(rig)
    stance(sk)
    for side, s in (('L', 1), ('R', -1)):
        wrist = Vector((s * 0.205, -0.045, 0.905))
        sk.two_bone('upperarm.' + side, 'forearm.' + side, wrist, (s * 0.35, 0.45, 1.05))
    PO.apply_face(sk, PO.mix_expr((e, 1.0)))
    sk.apply()
    bpy.context.view_layer.update()
    head = sk.world('head')
    hp = head @ Vector((0.0, 0.055, 0.07))
    cam.location = hp + Vector((0.10, -0.62, 0.02))
    C.look_at(cam, hp)
    sc.render.filepath = f'{OUT}_e_{e}.png'
    bpy.ops.render.render(write_still=True)

# hands
for shape in ('fist', 'point', 'thumbsup', 'grip', 'spread'):
    sk = RC.Skeleton(rig)
    stance(sk)
    sk.two_bone('upperarm.L', 'forearm.L', Vector((0.24, -0.30, 1.20)), (0.5, 0.3, 1.0))
    sk.aim('hand.L', (0.0, -0.3, 1.0), (-1, 0, 0))
    PO.apply_hand(sk, 'L', shape)
    sk.apply()
    bpy.context.view_layer.update()
    hp = sk.world('hand.L') @ Vector((0, 0.05, 0))
    cam.location = hp + Vector((0.05, -0.42, 0.03))
    C.look_at(cam, hp)
    sc.render.filepath = f'{OUT}_h_{shape}.png'
    bpy.ops.render.render(write_still=True)
