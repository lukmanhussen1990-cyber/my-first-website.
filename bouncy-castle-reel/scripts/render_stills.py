"""Render one still per shot in a single Blender session (reloads master.blend for each shot).

blender -b --python render_stills.py -- OUTDIR RES SAMPLES SHOT:FRAME [SHOT:FRAME ...]
"""
import bpy, sys, os, time, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

args = sys.argv[sys.argv.index("--") + 1:]
OUTDIR, RES, SAMPLES = args[0], int(args[1]), int(args[2])
jobs = [a.split(":") for a in args[3:]]
os.makedirs(OUTDIR, exist_ok=True)
for shot, frame in jobs:
    t0 = time.time()
    bpy.ops.wm.open_mainfile(filepath="/opt/work/bc/master.blend")
    import rigtools, poses, shotlib, fx, shots
    for m in (rigtools, poses, shotlib, fx, shots):
        importlib.reload(m)
    sc = shots.setup(shot)
    sc.render.resolution_x = RES
    sc.render.resolution_y = int(RES * 16 / 9)
    sc.eevee.taa_render_samples = SAMPLES
    sc.frame_set(int(frame))
    sc.render.filepath = os.path.join(OUTDIR, f"{shot}_{int(frame):04d}.png")
    bpy.ops.render.render(write_still=True)
    print("STILL", shot, frame, round(time.time() - t0, 1), flush=True)
