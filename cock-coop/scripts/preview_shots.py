"""Render one small frame per shot (at fraction `pos` of each shot) for a contact sheet.
python scripts/preview_shots.py chair_sniff.blend build/shots.json out_dir [pos] [width]"""
import json, os, sys
import bpy
blend, shots, out = sys.argv[1:4]
pos = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5
w = int(sys.argv[5]) if len(sys.argv) > 5 else 216
only = sys.argv[6].split(",") if len(sys.argv) > 6 else None
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(blend))
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = w, int(w * 16 / 9)
sc.eevee.taa_render_samples = 2
os.makedirs(out, exist_ok=True)
part = os.environ.get("PREV_PART")
for i, s in enumerate(json.load(open(shots))):
    if only and s["name"][:3] not in only:
        continue
    if part and i % int(part.split("/")[1]) != int(part.split("/")[0]):
        continue
    f = int(round(s["f0"] + (s["f1"] - s["f0"]) * pos))
    sc.frame_set(f)
    sc.render.filepath = os.path.join(out, f"{i:02d}_{s['name']}.png")
    bpy.ops.render.render(write_still=True)
