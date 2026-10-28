import sys, math, time
sys.path.insert(0, '/home/user/work/scripts')
import bpy
import numpy as np
from mathutils import Vector
from common import *
from anim import *

out = sys.argv[1]
only = sys.argv[2].split(',') if len(sys.argv) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
with bpy.data.libraries.load('/home/user/work/assets/world.blend', link=False) as (src, dst):
    dst.collections = [c for c in src.collections]
for c in dst.collections:
    if c.name in ('grass',):
        sc.collection.children.link(c)
rig = load_caveman(sc)
ch = Character(rig, LM)
setup_render(sc, 540, 960, 4)
sky_world(sc); add_sun(sc)
co = make_camera(sc)
cam = Cam(co)

FACE = ((0.12, -0.72, 1.72), (0, -0.05, 1.67), 55)
BODY = ((0.3, -3.4, 1.15), (0, 0, 0.95), 32)
POSES = {
    'neutral': (BODY, dict()),
    'smile': (FACE, dict(smile=1.0, squint=1.0, brow=0.6, look=(0, 0))),
    'yawn': (FACE, dict(jaw=24, wide=1.0, blink=1.0, head=(-14, 0, 0), brow=0.8)),
    'chew': (FACE, dict(puff=1.0, jaw=4, smile=0.3, blink=0.0)),
    'angry': (FACE, dict(grimace=1.0, angry=1.0, jaw=3, look=(10, 6))),
    'O': (FACE, dict(O=1.0, lidwide=1.0, brow=1.0, jaw=10)),
    'sad': (FACE, dict(frown=1.0, sad=1.0, sleepy=0.5, look=(0, 10), head=(8, 0, 0))),
    'thumbs': (((0.4, -1.9, 1.45), (0, 0, 1.35), 40), dict(smile=1.0, squint=0.6, armR=(-60, -20, -20), elbowR=95, handR=(0, 0, 0),
                                                            curlR=1.0, indexR=1.0, thumbR=-1.0)),
    'mouth': (((0.5, -1.4, 1.6), (0, 0, 1.5), 40), dict(ikR=1.0, ikposR='mouth', ikfwdR=(0.3, 0.2, 1), ikpalmR=(0, 1, 0), poleR=(-0.5, 0.3, 1.0),
                                                        curlR=0.6, puff=0.5, O=0.6)),
    'cheer': (BODY, dict(armL=(0, -70, 10), armR=(0, 70, -10), elbowL=25, elbowR=25, curlL=0.0, curlR=0.0, smile=1.0, jaw=12, wide=0.5)),
    'sit': (((1.4, -2.6, 0.9), (0, 0, 0.7), 32), dict(hips_loc=(0, 0.12, -0.42), spine=(12, 0, 0), chest=(6, 0, 0), head=(-10, 0, 0),
                                                       footL=(0.03, -0.38, 0.0), footR=(-0.03, -0.38, 0.0), kneeL=(0.25, -1.2, 0.6), kneeR=(-0.25, -1.2, 0.6),
                                                       armL=(-20, 38, 5), armR=(-20, -38, -5), elbowL=40, elbowR=40)),
}
for name, (view, chans) in POSES.items():
    if only and name not in only:
        continue
    p = Perf()
    anchor_name = chans.pop('ikposR', None) if isinstance(chans.get('ikposR'), str) else None
    p.key(0.0, **chans)

    def cb(s, t, pos):
        if anchor_name and s == 'R':
            return ch.anchor(anchor_name) + Vector((-0.02, -0.07, -0.03))
        return pos
    ch.apply(p, 0.0, 0, cb)
    eye, tgt, lens = view
    cam = Cam(co)
    cam.key(0.0, eye=eye, tgt=tgt, lens=lens)
    cam.apply(0.0, ch.anchor('head'))
    sc.render.filepath = f'{out}_{name}.png'
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(name, 'render', round(time.time() - t, 1))
