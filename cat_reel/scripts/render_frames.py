"""Render frames of cat_laptop.blend.

    blender -b cat_laptop.blend --python render_frames.py -- <out_dir> <frames> [res%] [samples]

<frames> is a comma list of frames and/or ranges, e.g. "40,110,600-620".
Frames are written as out_dir/frame_0001.png; existing files are skipped (resumable).
"""
import bpy
import os
import sys
import time

argv = sys.argv[sys.argv.index('--') + 1:]
out_dir = argv[0]
spec = argv[1]
res = int(argv[2]) if len(argv) > 2 else 100
samples = int(argv[3]) if len(argv) > 3 else 12
os.makedirs(out_dir, exist_ok=True)
frames = []
for part in spec.split(','):
    if '-' in part:
        a, b = part.split('-')
        a, b = int(a), int(b)
        frames += list(range(a, b + 1)) if a <= b else list(range(a, b - 1, -1))
    elif part:
        frames.append(int(part))
sc = bpy.context.scene
sc.render.resolution_percentage = res
sc.eevee.taa_render_samples = samples
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'
sc.render.image_settings.compression = 15
for ob in bpy.data.objects:                     # full-quality subdivision for rendering
    for md in ob.modifiers:
        if md.type == 'SUBSURF':
            md.levels = md.render_levels
use_lock = '--lock' in argv
for f in frames:
    path = os.path.join(out_dir, f'frame_{f:04d}.png')
    if os.path.exists(path) and os.path.getsize(path) > 0:
        continue
    if use_lock:                       # several workers can share one frame list safely
        try:
            os.close(os.open(path + '.lock', os.O_CREAT | os.O_EXCL | os.O_WRONLY))
        except FileExistsError:
            continue
    t = time.time()
    sc.frame_set(f)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f'FRAME {f} done in {time.time() - t:.1f}s', flush=True)
    if use_lock and os.path.exists(path + '.lock'):
        os.remove(path + '.lock')
