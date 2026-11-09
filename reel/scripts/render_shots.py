"""Render shots from reel.blend, one shot at a time.

For each shot the saved scene is reopened and every character that is not in that shot is deleted, which
makes each frame much cheaper on a machine without a GPU. Frames that already exist are skipped, so
several of these processes can share the work and a stopped render can simply be started again.

    blender -b reel.blend -P scripts/render_shots.py -- --out render/frames --scale 67 --samples 4 \
        [--frames 1-150] [--worker 0 --workers 2]
"""
import json
import os
import sys
import time

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]


def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from timeline import SHOTS  # noqa: E402

OUT = arg("--out", os.path.join(ROOT, "render", "frames"))
SCALE = int(arg("--scale", "67"))
SAMPLES = int(arg("--samples", "4"))
LO, HI = map(int, arg("--frames", "1-99999").split("-"))
WORKER, WORKERS = int(arg("--worker", "0")), int(arg("--workers", "1"))
BLEND = bpy.data.filepath
FPS = 30
CHARS = ("You", "Mom", "Baby", "Cop1", "Cop2")


def F(t):
    return 1 + int(round(t * FPS))


os.makedirs(OUT, exist_ok=True)
jobs = []
for i, (name, t0, t1) in enumerate(SHOTS):
    f0, f1 = F(t0), F(t1) - 1
    if name == SHOTS[-1][0]:
        f1 = F(t1)
    lo, hi = max(f0, LO), min(f1, HI)
    if lo <= hi:
        jobs.append((name, lo, hi))
# share shots between workers (round robin) - each worker still skips frames another one finished
jobs = jobs[WORKER::WORKERS] + [j for k, j in enumerate(jobs) if k % WORKERS != WORKER]

T0 = time.time()
for name, lo, hi in jobs:
    todo = [f for f in range(lo, hi + 1) if not os.path.exists(os.path.join(OUT, f"f_{f:04d}.png"))]
    if not todo:
        continue
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    sc = bpy.context.scene
    present = set(json.loads(sc["cast_json"]).get(name, CHARS))
    for n in CHARS:
        if n not in present and n in bpy.data.objects:
            r = bpy.data.objects[n]
            for o in list(r.children_recursive) + [r]:
                bpy.data.objects.remove(o, do_unlink=True)
    sc.render.resolution_percentage = SCALE
    sc.eevee.taa_render_samples = SAMPLES
    sc.frame_start, sc.frame_end = lo, hi
    sc.render.filepath = os.path.join(OUT, "f_####")
    sc.render.use_overwrite = False
    sc.render.use_placeholder = True
    t = time.time()
    bpy.ops.render.render(animation=True)
    n = hi - lo + 1
    print(f"[shots w{WORKER}] {name} frames {lo}-{hi} done in {time.time() - t:.0f}s "
          f"({(time.time() - t) / n:.1f}s/frame), total {time.time() - T0:.0f}s", flush=True)
