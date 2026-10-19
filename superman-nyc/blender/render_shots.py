"""Render the film: phone shots and the CCTV shot as separate animation jobs.

blender -b scene.blend -P render_shots.py -- OUTDIR SCALE SPP STEP [first last]
Frames already on disk are skipped (resumable). Output: multilayer EXR (Combined + Depth).
"""
import bpy
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import timeline as TL  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
out, scale, spp, step = argv[0], float(argv[1]), int(argv[2]), int(argv[3])
first, last = (int(argv[4]), int(argv[5])) if len(argv) > 5 else (0, TL.BLACK_FROM - 1)
os.makedirs(out, exist_ok=True)
sc = bpy.context.scene
sc.cycles.samples = spp
sc.render.use_overwrite = False
sc.render.use_placeholder = True
st = sc.render.image_settings
st.file_format = 'OPEN_EXR_MULTILAYER'
st.color_depth = '16'
st.exr_codec = 'DWAA'
sc.view_layers[0].use_pass_z = True

T = {}


def pre(s, *a):
    T['t'] = time.time()


def post(s, *a):
    print("FRAME", s.frame_current, round(time.time() - T['t'], 1), flush=True)


bpy.app.handlers.render_pre.append(pre)
bpy.app.handlers.render_post.append(post)

jobs = []
for name, a, b, cam in TL.SHOTS:
    a, b = max(a, first), min(b, last)
    if a > b:
        continue
    if jobs and jobs[-1][2] == cam and jobs[-1][1] + 1 == a:
        jobs[-1] = (jobs[-1][0], b, cam)
    else:
        jobs.append((a, b, cam))
for a, b, cam in jobs:
    sc.camera = bpy.data.objects[cam]
    if cam == "CamCCTV":
        sc.render.resolution_x, sc.render.resolution_y = int(960 * scale), int(540 * scale)
        sc.frame_step = max(2, step)          # CCTV runs at 15 fps
    else:
        sc.render.resolution_x, sc.render.resolution_y = int(720 * scale), int(1280 * scale)
        sc.frame_step = step
    sc.frame_start, sc.frame_end = a, b
    sc.render.filepath = os.path.join(out, "f####")
    print("JOB", a, b, cam, sc.render.resolution_x, sc.render.resolution_y, flush=True)
    bpy.ops.render.render(animation=True)
print("ALL DONE", flush=True)
