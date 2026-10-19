"""Render preview stills: blender -b scene.blend -P render_stills.py -- OUTDIR SCALE SPP frame [frame ...]"""
import bpy
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import timeline as TL  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
out, scale, spp = argv[0], float(argv[1]), int(argv[2])
frames = [int(a) for a in argv[3:]]
os.makedirs(out, exist_ok=True)
sc = bpy.context.scene
sc.cycles.samples = spp
sc.render.image_settings.file_format = 'PNG'
for f in frames:
    shot = next(s for s in TL.SHOTS if s[1] <= f <= s[2]) if f < TL.BLACK_FROM else TL.SHOTS[-1]
    cam = bpy.data.objects[shot[3]]
    sc.camera = cam
    if shot[3] == "CamCCTV":
        sc.render.resolution_x, sc.render.resolution_y = int(960 * scale), int(540 * scale)
    else:
        sc.render.resolution_x, sc.render.resolution_y = int(720 * scale), int(1280 * scale)
    sc.frame_set(f)
    sc.render.filepath = os.path.join(out, f"f{f:04d}.png")
    bpy.ops.render.render(write_still=True)
    print("STILL", f, shot[0], flush=True)
