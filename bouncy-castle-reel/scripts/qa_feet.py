"""QA: lowest shoe point per character for sampled frames of each shot (should be ~0 when standing)."""
import bpy, sys, os, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
shots_to_check = sys.argv[sys.argv.index("--") + 1].split(",")
for shot in shots_to_check:
    bpy.ops.wm.open_mainfile(filepath="/opt/work/bc/master.blend")
    import rigtools, poses, shotlib, fx, shots
    for m in (rigtools, poses, shotlib, fx, shots):
        importlib.reload(m)
    sc = shots.setup(shot)
    n = sc.frame_end
    res = []
    for f in sorted(set([1, n // 4, n // 2, 3 * n // 4, n])):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        row = []
        for who in ("YOU", "CRUSH"):
            rig = bpy.data.objects[who]
            if rig.hide_render or rig.matrix_world.translation.z < -10:
                row.append(f"{who}:-")
                continue
            shoe = next(c for c in rig.children if "shoes" in c.name)
            ev = shoe.evaluated_get(dg)
            me = ev.to_mesh()
            zmin = min((ev.matrix_world @ v.co).z for v in me.vertices)
            ev.to_mesh_clear()
            row.append(f"{who}:{zmin:+.3f}")
        res.append(f"f{f}:" + " ".join(row))
    print("FEET", shot, " | ".join(res), flush=True)
