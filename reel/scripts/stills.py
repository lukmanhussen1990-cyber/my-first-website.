"""Render a few still frames from reel.blend:  blender -b reel.blend -P scripts/stills.py -- OUTDIR SCALE F1 F2 ..."""
import bpy, os, sys
a = sys.argv[sys.argv.index("--") + 1:]
out, scale, frames = a[0], int(a[1]), [int(x) for x in a[2:]]
os.makedirs(out, exist_ok=True)
sc = bpy.context.scene
sc.render.resolution_percentage = scale
sc.eevee.taa_render_samples = 6
for f in frames:
    sc.frame_set(f)
    sc.render.filepath = os.path.join(out, f"still_{f:04d}.png")
    bpy.ops.render.render(write_still=True)
    print("STILL", f, flush=True)
