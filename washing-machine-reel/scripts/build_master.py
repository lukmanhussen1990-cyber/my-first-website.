import bpy, sys, math, time
sys.path.insert(0, "/opt/work/scripts")
import importlib
import lib, build_set, build_props, build_fx, build_pit
from mathutils import Vector

t0 = time.time()
bpy.ops.wm.open_mainfile(filepath="/opt/work/blend/char_you.blend")
sc = bpy.context.scene
# remove default leftovers
for o in list(bpy.data.objects):
    if o.type in ('CAMERA', 'LIGHT') or o.name in ("Cube",):
        bpy.data.objects.remove(o, do_unlink=True)

C_set = lib.coll("SET")
C_props = lib.coll("PROPS")
C_drum = lib.coll("DRUM", C_props)
C_blobs = lib.coll("BLOBS", C_props)
C_fx = lib.coll("FX")

floor = build_set.build_room(C_set)
C_pit = lib.coll("PIT")
build_pit.build(C_pit, floor, total_frames=1700)
build_set.build_lamps(C_set)
table, top = build_set.build_tables(C_set)
sun, fill = build_set.build_lights_world(sc)
build_set.render_settings(sc, res=(1080, 1920), samples=4)

tub, tub_water = build_props.build_tub(C_props, (0.0, -0.52, top), "Tub")
bottle, spout = build_props.build_bottle(C_props, (0.62, -0.42, top))
undies = build_props.build_undies(C_props)
undies.location = (0.0, -0.3, 1.25)
meshes, mats = build_props.build_blob_library(C_props)
parts = build_props.build_drum_rig(C_drum)
build_props.build_motor(C_drum, parts)
build_props.build_outer_tub(C_drum, parts)
build_props.build_pump(C_drum, parts)
build_props.build_cabinet(C_drum, parts)
a_cw = build_props.arrow(C_drum, "Arrow_CW", ccw=False)
a_ccw = build_props.arrow(C_drum, "Arrow_CCW", ccw=True)
for a in (a_cw, a_ccw):
    a.parent = parts["root"]
    a.visible_shadow = False
sc["table_top"] = top
bpy.ops.wm.save_as_mainfile(filepath="/opt/work/blend/master.blend")
print("MASTER saved", time.time() - t0)
