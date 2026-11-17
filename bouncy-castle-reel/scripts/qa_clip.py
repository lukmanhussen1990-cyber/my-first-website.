"""QA: count character vertices that sit inside castle walls / towers / fence / mattress (penetration check)."""
import bpy, sys, os, importlib
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
shots_to_check = sys.argv[sys.argv.index("--") + 1].split(",")
STEP = int(sys.argv[sys.argv.index("--") + 2]) if len(sys.argv) > sys.argv.index("--") + 2 else 3
SOLIDS = ["WallBack", "WallLeft", "WallRight", "WallFront-1", "WallFront1", "Tower0", "Tower1", "Tower2", "Tower3",
          "FenceBack_boards", "Mattress", "Blower", "BlowerBody"]
MARGIN = 0.05   # ignore grazing contact


def verts_world(ob, dg):
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    n = len(me.vertices)
    co = np.empty(n * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    ev.to_mesh_clear()
    co = co.reshape(-1, 3)
    M = np.array(ev.matrix_world)
    return co @ M[:3, :3].T + M[:3, 3]


for shot in shots_to_check:
    bpy.ops.wm.open_mainfile(filepath="/opt/work/bc/master.blend")
    import rigtools, poses, shotlib, fx, shots
    for m in (rigtools, poses, shotlib, fx, shots):
        importlib.reload(m)
    sc = shots.setup(shot)
    n = sc.frame_end
    worst = []
    for f in range(1, n + 1, STEP):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        for who in ("YOU", "CRUSH"):
            rig = bpy.data.objects[who]
            if rig.hide_render or rig.matrix_world.translation.z < -10:
                continue
            parts = [c for c in rig.children if c.type == 'MESH' and not c.hide_render
                     and any(k in c.name for k in ("body", "casualsuit", "shoes"))]
            V = np.concatenate([verts_world(p, dg) for p in parts])
            for sname in SOLIDS:
                s = bpy.data.objects.get(sname)
                if s is None or s.hide_render or s.type != 'MESH':
                    continue
                ev = s.evaluated_get(dg)
                Mi = np.array(ev.matrix_world.inverted())
                L = V @ Mi[:3, :3].T + Mi[:3, 3]
                bb = np.array([list(c) for c in ev.bound_box])
                lo, hi = bb.min(0), bb.max(0)
                sc_ = np.array(ev.matrix_world.to_scale())
                m = MARGIN / np.maximum(sc_, 1e-4)
                inside = np.all((L > lo + m) & (L < hi - m), axis=1)
                k = int(inside.sum())
                if k > 20:
                    worst.append((f, who, sname, k))
    if worst:
        agg = {}
        for f, who, sname, k in worst:
            key = (who, sname)
            agg.setdefault(key, []).append((f, k))
        print("CLIP", shot, "; ".join(f"{w}/{s}: frames {[x[0] for x in v][:8]} max {max(x[1] for x in v)}"
                                       for (w, s), v in agg.items()), flush=True)
    else:
        print("CLIP", shot, "OK", flush=True)
