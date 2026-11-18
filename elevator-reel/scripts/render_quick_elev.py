"""Ultra-fast preview: EEVEE 1 sample, no shadows, tiny res. usage: -- a b step W H outdir"""
import bpy, sys, os, time
argv = sys.argv[sys.argv.index("--") + 1:]
a, b, step, W, H, out = int(argv[0]), int(argv[1]), int(argv[2]), int(argv[3]), int(argv[4]), argv[5]
os.makedirs(out, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath="/opt/work/blend/elev_anim.blend")
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.resolution_percentage = 100
sc.eevee.taa_render_samples = 1
sc.eevee.use_shadows = False
sc.eevee.use_fast_gi = False
sc.render.use_persistent_data = True
sc.world.use_sun_shadow = False
sc.render.image_settings.file_format = 'JPEG'
sc.render.image_settings.quality = 80
t0 = time.time(); n = 0
for f in range(a, b + 1, step):
    p = os.path.join(out, f"{f:04d}.jpg")
    if os.path.exists(p):
        continue
    sc.frame_set(f)
    sc.render.filepath = p
    bpy.ops.render.render(write_still=True)
    n += 1
    if n % 25 == 0:
        print(f"QUICK {f} avg {(time.time()-t0)/n:.2f}s", flush=True)
print("QUICK DONE", a, b, time.time() - t0, flush=True)
