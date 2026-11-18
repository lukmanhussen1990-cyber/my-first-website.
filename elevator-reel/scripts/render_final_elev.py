"""Final-quality frames of elev_anim.blend -> /opt/work/elev/frames (skips existing). usage: -- a b [step] [outdir] [W H]"""
import bpy, sys, os, time
argv = sys.argv[sys.argv.index("--") + 1:]
a, b = int(argv[0]), int(argv[1])
step = int(argv[2]) if len(argv) > 2 else 1
OUT = argv[3] if len(argv) > 3 else "/opt/work/elev/frames"
W, H = (int(argv[4]), int(argv[5])) if len(argv) > 5 else (1080, 1920)
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath="/opt/work/blend/elev_anim.blend")
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.resolution_percentage = 100
sc.eevee.taa_render_samples = 8
sc.eevee.use_shadows = True
sc.render.use_persistent_data = True
sc.world.use_sun_shadow = False
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'
sc.render.image_settings.color_depth = '8'
sc.render.image_settings.compression = 15
t0 = time.time(); n = 0
for f in range(a, b + 1, step):
    path = os.path.join(OUT, f"{f:04d}.png")
    if os.path.exists(path) and os.path.getsize(path) > 10000:
        continue
    sc.frame_set(f)
    sc.render.filepath = path
    t1 = time.time()
    bpy.ops.render.render(write_still=True)
    n += 1
    print(f"FRAME {f} {time.time()-t1:.1f}s avg {(time.time()-t0)/n:.1f}s", flush=True)
print("RENDER DONE", a, b, time.time() - t0, flush=True)
