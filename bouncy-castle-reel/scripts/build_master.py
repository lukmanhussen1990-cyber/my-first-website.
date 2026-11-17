"""Assemble master.blend = MPFB characters + backyard set + props.

blender -b /opt/work/chars.blend --python build_master.py -- /opt/work/master.blend
"""
import bpy, sys, os, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import setbuild
importlib.reload(setbuild)

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "/opt/work/bc/master.blend"

# characters go into their own collection
chars = setbuild.coll("CHARS")
for ob in list(bpy.context.scene.collection.objects):
    if ob.name.startswith(("YOU", "CRUSH")):
        setbuild.link(ob, chars)

setbuild.build_all()

try:
    import propbuild
    importlib.reload(propbuild)
    propbuild.build_all()
except ImportError as e:
    print("NO_PROPS_YET", e)

bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("MASTER_SAVED", OUT)
