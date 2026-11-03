"""Render a contact sheet of the CuteCat in several poses for QA.

    blender -b cute_cat.blend --python preview_cat.py -- <out_dir> [res_scale]
"""
import bpy
import math
import os
import sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catlib as C  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
out_dir = argv[0]
scale = float(argv[1]) if len(argv) > 1 else 0.6
os.makedirs(out_dir, exist_ok=True)
sc = bpy.context.scene
rig = bpy.data.objects['CatRig']
cam = bpy.data.objects['PreviewCam']
tgt = bpy.data.objects['PreviewTarget']
sc.render.resolution_percentage = int(scale * 100)
sc.eevee.taa_render_samples = 16
for ob in bpy.data.objects:
    for md in ob.modifiers:
        if md.type == 'SUBSURF':
            md.levels = md.render_levels


def shot(name, st, cam_loc, tgt_loc, lens, spiral=0.0, frame=1):
    sc.frame_set(frame)
    rig['spiral_eyes'] = spiral
    C.apply_state(rig, st)
    cam.location = cam_loc
    tgt.location = tgt_loc
    cam.data.lens = lens
    bpy.context.view_layer.update()
    sc.render.filepath = os.path.join(out_dir, name + '.png')
    bpy.ops.render.render(write_still=True)


st = C.stand_state()
shot('a_front34', st, (-0.55, -1.25, 0.42), (0, -0.03, 0.2), 60)
shot('b_face', C.stand_state(), (-0.08, -0.75, 0.29), (0, -0.15, 0.245), 85)
w = C.stand_state()
C.walk_state(w, 0.2)
shot('c_side_walk', w, (-1.3, -0.15, 0.25), (0, 0.0, 0.18), 55)
s = C.stand_state()
C.sit_state(s, 1.0)
shot('d_sit', s, (-0.6, -1.1, 0.35), (0, 0.0, 0.2), 55)
h = C.stand_state()
C.hiss_state(h, 1.0)
shot('e_hiss', h, (-0.12, -0.75, 0.28), (0, -0.15, 0.235), 80)
shot('f_spiral', C.stand_state(), (-0.08, -0.75, 0.29), (0, -0.15, 0.245), 85, spiral=1.0, frame=10)
b = C.stand_state()
C.sit_state(b, 1.0)
b.blink = 1.0
b.head_pitch = -0.1
shot('g_happy', b, (0.5, -0.9, 0.38), (0, -0.05, 0.24), 70)
shot('h_back', C.stand_state(), (0.7, 1.0, 0.5), (0, 0.0, 0.2), 55)
print('PREVIEW DONE')
