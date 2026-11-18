"""Render frames [a,b] of anim.blend to /opt/work/render/frames, skipping existing. usage: -- a b"""
import bpy, sys, os, time
argv = sys.argv[sys.argv.index("--") + 1:]
a, b = int(argv[0]), int(argv[1])
OUT = "/opt/work/render/frames"
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath="/opt/work/blend/anim.blend")
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
sc.render.resolution_percentage = 100
sc.eevee.taa_render_samples = 4
sc.render.use_persistent_data = True
sc.world.use_sun_shadow = False
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'
sc.render.image_settings.color_depth = '8'
sc.render.image_settings.compression = 15
t0 = time.time(); n = 0
for f in range(a, b + 1):
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
