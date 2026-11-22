# Build and render one Episode 9 shot (same modes as scripts/render_shot.py).
# Usage: blender -b --python ep9/render_shot.py -- <shot> <outdir> [preview|motion|full|blend] [samples] [f0] [f1]
import bpy, sys, os, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, "..", "scripts")]   # ep2 first: its cuts.py/shots.py win
import lib, shots

argv = sys.argv[sys.argv.index("--") + 1:]
NAME, OUTD = argv[0], argv[1]
MODE = argv[2] if len(argv) > 2 else "full"
SPP = int(argv[3]) if len(argv) > 3 else 6
F0 = int(argv[4]) if len(argv) > 4 else None   # optional sub-range (resume a partial render)
F1 = int(argv[5]) if len(argv) > 5 else None

lib.reset(samples=SPP)
n = shots.SHOTS[NAME]()
lib.set_frames(n)
sc = bpy.context.scene
os.makedirs(OUTD, exist_ok=True)
t0 = time.time()
if MODE == "preview":
    sc.render.resolution_percentage = 50
    sc.eevee.taa_render_samples = min(SPP, 4)
    for f in sorted({1, max(1, n // 2), n}):
        sc.frame_set(f)
        sc.render.filepath = os.path.join(OUTD, f"{NAME}_p{f:03d}.png")
        bpy.ops.render.render(write_still=True)
elif MODE == "motion":                      # motion check: every 3rd frame, small and fast (lag / pops / jitter)
    sc.render.resolution_percentage = 20
    sc.eevee.taa_render_samples = 1
    sc.frame_step = 3
    sc.render.filepath = os.path.join(OUTD, NAME, "m_")
    bpy.ops.render.render(animation=True)
elif MODE == "blend":
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUTD, NAME + ".blend"))
else:
    if MODE == "fast":                       # draft-final: 75% resolution, 2 samples (upscaled at assembly)
        sc.render.resolution_percentage = 75
        sc.eevee.taa_render_samples = 2
    sc.render.filepath = os.path.join(OUTD, NAME, "f_")
    if F0:
        sc.frame_start = F0
    if F1:
        sc.frame_end = F1
    bpy.ops.render.render(animation=True)
print(f"SHOT_DONE {NAME} frames={n} secs={time.time() - t0:.1f}")
