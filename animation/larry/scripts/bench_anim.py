import bpy, sys, time
argv = sys.argv[sys.argv.index("--") + 1:]
ENG, samples, outdir = argv[0], int(argv[1]), argv[2]
exec(open("/home/user/my-sec-wsb/animation/larry/scripts/bench_render.py").read().split("t = time.time()")[0].replace("sys.argv.index(\"--\") + 1:]", "len(sys.argv):]"))
sc = bpy.context.scene
if ENG == "CYCLES":
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = samples; sc.cycles.use_denoising = True
else:
    sc.render.engine = "BLENDER_EEVEE_NEXT"; sc.eevee.taa_render_samples = samples
m = [o for o in sc.objects if o.type == "MESH"][1]
m.keyframe_insert("location", frame=1); m.location.x = 1; m.keyframe_insert("location", frame=5)
sc.frame_start, sc.frame_end = 1, 4
sc.render.filepath = outdir + "/f_"
times = []
def pre(s, *a): times.append(time.time())
bpy.app.handlers.render_pre.append(pre)
t0 = time.time(); bpy.ops.render.render(animation=True)
times.append(time.time())
print("FRAME_TIMES", ENG, samples, [round(times[i+1]-times[i], 1) for i in range(len(times)-1)], "total", round(time.time()-t0, 1))
