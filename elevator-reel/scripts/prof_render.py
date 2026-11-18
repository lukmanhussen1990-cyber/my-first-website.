"""Time one frame under several EEVEE settings. usage: -- frame W H"""
import bpy, sys, time
argv = sys.argv[sys.argv.index("--") + 1:]
f, W, H = int(argv[0]), int(argv[1]), int(argv[2])
bpy.ops.wm.open_mainfile(filepath="/opt/work/blend/elev_anim.blend")
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.use_persistent_data = True
sc.world.use_sun_shadow = False
sc.render.image_settings.file_format = 'JPEG'
sc.frame_set(f)
cfgs = [("base8", dict(s=8, sh=True, gi=True, mb=False)), ("s8_noGI", dict(s=8, sh=True, gi=False, mb=False)),
        ("s4", dict(s=4, sh=True, gi=True, mb=False)), ("s8_noShadow", dict(s=8, sh=False, gi=True, mb=False)),
        ("s8_mblur", dict(s=8, sh=True, gi=True, mb=True)), ("base8_again", dict(s=8, sh=True, gi=True, mb=False))]
for name, c in cfgs:
    sc.eevee.taa_render_samples = c["s"]; sc.eevee.use_shadows = c["sh"]; sc.eevee.use_fast_gi = c["gi"]
    sc.render.use_motion_blur = c["mb"]
    sc.render.filepath = f"/opt/work/elev/tst/prof_{name}.jpg"
    t = time.time(); bpy.ops.render.render(write_still=True)
    print("PROF", name, round(time.time() - t, 1), flush=True)
