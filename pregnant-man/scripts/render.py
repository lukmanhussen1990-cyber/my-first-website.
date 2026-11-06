"""Step 4: render the animation frames with EEVEE.

    python scripts/render.py chair_sniff.blend build/frames [samples] [first] [last]

Uses placeholders + no-overwrite, so you can start 2 copies in parallel (or resume after a stop)
and they will share the frame range automatically.
"""
import os
import sys

import bpy

blend, out = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
samples = int(sys.argv[3]) if len(sys.argv) > 3 else 4
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
if len(sys.argv) > 5:
    sc.frame_start, sc.frame_end = int(sys.argv[4]), int(sys.argv[5])
sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
sc.render.resolution_percentage = 100
sc.eevee.taa_render_samples = samples
sc.render.filter_size = 1.8
sc.render.image_settings.file_format = "JPEG"
sc.render.image_settings.quality = 94
sc.render.use_overwrite = False
sc.render.use_placeholder = True
os.makedirs(out, exist_ok=True)
sc.render.filepath = os.path.join(out, "f_")
bpy.ops.render.render(animation=True)
