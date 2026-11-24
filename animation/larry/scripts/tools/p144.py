# Scratchpad review helper: render every frame of one shot at 144p (1 sample) for a quick motion preview.
# Usage: blender -b --python p144.py -- <episode_dir> <shot> <outdir>
import bpy, sys, os
argv = sys.argv[sys.argv.index("--") + 1:]
EPD, NAME, OUTD = argv[0], argv[1], argv[2]
sys.path[:0] = [EPD, os.path.join(EPD, "..", "scripts")]
import lib, shots
lib.reset(samples=1)
n = shots.SHOTS[NAME]()
lib.set_frames(n)
sc = bpy.context.scene
sc.render.resolution_percentage = 100
sc.render.resolution_x, sc.render.resolution_y = 144, 256
sc.eevee.taa_render_samples = 1
sc.render.filepath = os.path.join(OUTD, NAME, "f_")
bpy.ops.render.render(animation=True)
print("P144_DONE", NAME, n)
os._exit(0)
