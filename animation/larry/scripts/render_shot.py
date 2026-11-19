# Build and render one shot.
# Usage: blender -b --python render_shot.py -- <shot> <outdir> [preview|full] [samples]
import bpy, sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
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
elif MODE == "blend":
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUTD, NAME + ".blend"))
else:
    sc.render.filepath = os.path.join(OUTD, NAME, "f_")
    if F0:
        sc.frame_start = F0
    if F1:
        sc.frame_end = F1
    bpy.ops.render.render(animation=True)
print(f"SHOT_DONE {NAME} frames={n} secs={time.time() - t0:.1f}")
