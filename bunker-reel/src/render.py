"""Render frames [start, end] of bunker.blend to frames/NNNN.png, skipping
frames that already exist so an interrupted render can resume."""
import bpy, sys, os, time
args = sys.argv[sys.argv.index('--') + 1:]
blend, outdir, start, end = args[0], args[1], int(args[2]), int(args[3])
step = int(args[4]) if len(args) > 4 else 1
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
sc.render.use_overwrite = True
sc.render.use_placeholder = False
sc.render.use_persistent_data = False   # persistent data turned some surfaces black in long runs
if os.environ.get('THREADS'):
    sc.render.threads_mode = 'FIXED'
    sc.render.threads = int(os.environ['THREADS'])
os.makedirs(outdir, exist_ok=True)
for f in range(start, end + 1, step):
    out = os.path.join(outdir, f'{f:04d}.png')
    if os.path.exists(out) and os.path.getsize(out) > 0:
        continue
    t = time.time()
    sc.frame_set(f)
    sc.render.filepath = out + '.tmp.png'
    bpy.ops.render.render(write_still=True)
    os.replace(out + '.tmp.png', out)
    print(f'FRAME {f} {time.time() - t:.1f}s', flush=True)
