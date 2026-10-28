"""Render frames of the reel.

blender -b scene.blend --python render_shots.py -- <outdir> <res_x> <samples> <frames spec> [nosim]
frames spec: 'all' | 'a-b' | 'a,b,c' | 'shots:S1a,S3b' | 'pick2' (2 frames per shot)
Writes <outdir>/f_%05d.png and <outdir>/f_%05d.json (overlay anchors in pixels).
"""
import os
import sys
import json
import time
import math
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.dirname(HERE)]
import anim as A  # noqa: E402
import shots as S  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]
RESX = int(argv[1])
SAMPLES = int(argv[2])
SPEC = argv[3] if len(argv) > 3 else 'pick2'
NOSIM = len(argv) > 4 and argv[4] == 'nosim'
os.makedirs(OUT, exist_ok=True)

garden = bpy.data.scenes['Garden']
studio = bpy.data.scenes['Studio']
for scn in (garden, studio):
    scn.render.resolution_x = RESX
    scn.render.resolution_y = int(round(RESX * 16 / 9))
    scn.render.resolution_percentage = 100
    scn.eevee.taa_render_samples = SAMPLES
    scn.render.image_settings.file_format = 'PNG'
    scn.render.image_settings.color_mode = 'RGB'
    scn.render.film_transparent = False

S.setup()
if os.environ.get('QUICK'):
    import runpy
    runpy.run_path(os.environ['QUICK'])
NF = S.N_FRAMES


def frames_from_spec(spec):
    if spec == 'all':
        return list(range(NF))
    if spec.startswith('shots:'):
        names = spec[6:].split(',')
        out = []
        for sh in S.SHOTS:
            if sh.name in names:
                out += list(range(int(round(sh.t0 * A.FPS)), int(round(sh.t1 * A.FPS))))
        return out
    if spec.startswith('pick'):
        k = int(spec[4:] or 2)
        out = []
        for sh in S.SHOTS:
            f0, f1 = int(round(sh.t0 * A.FPS)), int(round(sh.t1 * A.FPS)) - 1
            for i in range(k):
                out.append(int(f0 + (f1 - f0) * (i + 0.5) / k))
        return out
    if '-' in spec and ',' not in spec:
        a, b = spec.split('-')
        return list(range(int(a), int(b) + 1))
    return [int(x) for x in spec.split(',')]


frames = sorted(set(f for f in frames_from_spec(SPEC) if 0 <= f < NF))
if os.environ.get('SKIP_EXISTING'):
    frames = [f for f in frames if not (os.path.exists(os.path.join(OUT, f'f_{f:05d}.png'))
                                       and os.path.exists(os.path.join(OUT, f'f_{f:05d}.json')))]
print('frames to render:', len(frames))
char = A.Char(bpy.data.objects['Rig'])
cur_shot = None
last_f = None
t_start = time.time()
for n, f in enumerate(frames):
    t = f / A.FPS
    sh = S.shot_at(t)
    # spring pre-roll when entering a shot or jumping
    if sh is cur_shot and last_f is not None and last_f < f <= last_f + 8 and not NOSIM:
        # small skip inside the same shot: just advance the springs through the skipped frames
        for ff in range(last_f + 1, f):
            tt = ff / A.FPS
            Pp = sh.char(tt) if sh.char else None
            if Pp is not None:
                char.pose(tt, Pp, sim=True)
    elif sh is not cur_shot or last_f is None or f != last_f + 1:
        char.springs.reset()
        if not NOSIM:
            t_pre = max(sh.t0 - 0.5, t - 1.2)
            tt = t_pre
            while tt < t - 1e-6:
                P = sh.char(tt) if sh.char else None
                if P is not None:
                    char.pose(tt, P, sim=True)
                tt += 1.0 / A.FPS
        cur_shot = sh
    scn = studio if sh.scene == 'Studio' else garden
    S.apply_story(t, sh)
    cam = scn.camera
    A.set_camera(cam, t, sh.cam(t) if callable(sh.cam) else sh.cam)
    P = sh.char(t) if sh.char else None
    if P is not None:
        sk = char.pose(t, P, sim=not NOSIM)
        sk.apply()
    S.apply_shot(t, sh, char)
    if os.environ.get('FULL_UPDATE'):
        bpy.context.view_layer.update()
    # overlay anchors
    ov = []
    fpx = cam.data.lens / cam.data.sensor_height * scn.render.resolution_y
    items = list(sh.overlays(t)) if sh.overlays else []
    if P is not None and scn is garden:
        hm = char.sk.world('head')
        fc = hm @ Vector((0.0, 0.05, 0.07))
        items.append(dict(type='face', world=tuple(fc), radius=0.13))
    for o in items:
        d = dict(o)
        if 'world' in d:
            # project with the camera's own basis (no depsgraph update needed)
            Mc = cam.matrix_basis
            v = Mc.inverted() @ Vector(d['world'])
            zc = -v.z
            Hr, Wr = scn.render.resolution_y, scn.render.resolution_x
            fz = fpx / max(1e-4, zc)
            d['x'] = Wr / 2 + v.x * fz
            d['y'] = Hr / 2 - v.y * fz
            d['behind'] = zc < 0
            d['depth'] = zc
            d['fpx'] = fpx
            if d.get('type') == 'face':
                d['r'] = d['radius'] * fpx / max(0.05, zc)
            del d['world']
        ov.append(d)
    with open(os.path.join(OUT, f'f_{f:05d}.json'), 'w') as fh:
        json.dump({'t': t, 'shot': sh.name, 'overlays': ov, 'res': [scn.render.resolution_x,
                                                                   scn.render.resolution_y]}, fh)
    scn.render.filepath = os.path.join(OUT, f'f_{f:05d}.png')
    bpy.ops.render.render(write_still=True, scene=scn.name)
    last_f = f
    el = time.time() - t_start
    print(f'RENDERED {f} ({n + 1}/{len(frames)}) shot {sh.name}  avg {el / (n + 1):.1f}s', flush=True)
