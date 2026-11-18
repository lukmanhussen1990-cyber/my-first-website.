"""Render selected frames at low res. usage: python render_preview.py -- out_dir W H samples f1 f2 ... | shots:<n>"""
import bpy, sys, os, time
argv = sys.argv[sys.argv.index("--") + 1:]
out, W, H, spp = argv[0], int(argv[1]), int(argv[2]), int(argv[3])
frames_arg = argv[4:]
bpy.ops.wm.open_mainfile(filepath=os.environ.get("BLEND", "/opt/work/blend/anim.blend"))
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.eevee.taa_render_samples = spp
sc.render.use_persistent_data = True
sc.world.use_sun_shadow = False
os.makedirs(out, exist_ok=True)
frames = []
if frames_arg and frames_arg[0].startswith("shots"):
    per = int(frames_arg[0].split(":")[1])
    shots = sc["shots"]
    for name, (f0, f1) in sorted(shots.items(), key=lambda kv: kv[1][0]):
        for k in range(per):
            frames.append((f"{name}", int(f0 + (f1 - f0) * (k + 0.5) / per)))
else:
    frames = [("f", int(x)) for x in frames_arg]
t0 = time.time()
for tag, f in frames:
    sc.frame_set(f)
    sc.render.filepath = os.path.join(out, f"{f:04d}_{tag}.png")
    bpy.ops.render.render(write_still=True)
print("PREVIEW done", len(frames), time.time() - t0)
