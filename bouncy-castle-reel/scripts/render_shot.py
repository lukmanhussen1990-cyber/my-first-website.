"""Set up one shot in master.blend and render it.

blender -b /opt/work/master.blend --python render_shot.py -- SHOT MODE [START END] [OUTROOT]
MODE: wb (workbench preview), preview (EEVEE small), final (EEVEE 1080x1920), still (single frame START)
"""
import bpy, sys, os, time, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rigtools, poses, shotlib, fx, shots
for m in (rigtools, poses, shotlib, fx, shots):
    importlib.reload(m)

args = sys.argv[sys.argv.index("--") + 1:]
SHOT = args[0]
MODE = args[1]
START = int(args[2]) if len(args) > 2 and args[2] != "-" else None
END = int(args[3]) if len(args) > 3 and args[3] != "-" else None
OUTROOT = args[4] if len(args) > 4 else "/opt/work/bc/renders"
STEP = int(args[5]) if len(args) > 5 else 1

sc = bpy.context.scene
t0 = time.time()
shots.setup(SHOT)
print("SETUP_SECONDS", round(time.time() - t0, 1), flush=True)

if MODE == "wb":
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'TEXTURE'
    sc.display.shading.show_shadows = True
    sc.render.resolution_x, sc.render.resolution_y = 270, 480
elif MODE in ("preview", "still"):
    sc.render.resolution_x, sc.render.resolution_y = 540, 960
    sc.eevee.taa_render_samples = 6
elif MODE == "pv":
    sc.render.resolution_x, sc.render.resolution_y = 216, 384
    sc.eevee.taa_render_samples = 4
elif MODE == "final":
    sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
    sc.eevee.taa_render_samples = 8
elif MODE == "stillhi":
    sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
    sc.eevee.taa_render_samples = 8

outdir = os.path.join(OUTROOT, MODE if MODE not in ("still", "stillhi") else "stills", SHOT)
os.makedirs(outdir, exist_ok=True)
sc.render.image_settings.file_format = 'PNG'

first = START or sc.frame_start
last = END or sc.frame_end
if MODE in ("still", "stillhi"):
    last = first
frames = list(range(first, last + 1, STEP))
for f in frames:
    sc.frame_set(f)
    sc.render.filepath = os.path.join(outdir, f"{f:04d}.png")
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print("FRAME", SHOT, f, round(time.time() - t, 1), flush=True)
print("SHOT_DONE", SHOT, MODE, len(frames), round(time.time() - t0, 1))
