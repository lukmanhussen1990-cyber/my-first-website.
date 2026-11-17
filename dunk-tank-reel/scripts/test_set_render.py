"""Render look-dev views of the master scene."""
import bpy, sys, os, math, time
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
OUTDIR = args[0]
views = args[1].split(",")
RES = int(args[2]) if len(args) > 2 else 540
SAMPLES = int(args[3]) if len(args) > 3 else 8
os.makedirs(OUTDIR, exist_ok=True)

sc = bpy.context.scene
sc.render.resolution_x = RES
sc.render.resolution_y = int(RES * 16 / 9)
sc.eevee.taa_render_samples = SAMPLES

VIEWS = {
    # name: (cam location, look-at, lens)
    "ots": ((-3.9, -5.2, 1.35), (-1.0, 3.0, 1.1), 35),
    "wide": ((4.5, -9.5, 2.6), (-1.0, 4.0, 1.2), 26),
    "shed": ((-2.0, -2.0, 1.4), (-6.6, 5.5, 1.3), 32),
    "low": ((1.0, -1.2, 0.35), (1.0, 3.5, 1.8), 20),
    "bushfront": ((-3.0, -7.4, 1.0), (-3.3, -3.6, 0.8), 40),
}

cam_data = bpy.data.cameras.new("TestCam")
cam = bpy.data.objects.new("TestCam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
for v in views:
    loc, tgt, lens = VIEWS[v]
    cam.location = loc
    cam_data.lens = lens
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUTDIR, f"set_{v}.png")
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print("VIEW_DONE", v, round(time.time() - t, 1))
