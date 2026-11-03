"""Quick look-dev renders of the set (no animation)."""
import bpy, os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
import catlib as C
import build_set as BS

argv = sys.argv[sys.argv.index('--') + 1:]
out = argv[0]; res = int(argv[1]) if len(argv) > 1 else 50
views = argv[2].split(',') if len(argv) > 2 else None
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
S = BS.build(sc)
BS.render_settings(sc, res, 8)
cat = S['cat']
cat.location = (-0.85, 0.55, 0.0); cat.rotation_euler = (0, 0, math.radians(-120))
st = C.stand_state(); C.walk_state(st, 0.3); C.apply_state(cat, st)
o = S['owner']; ctrl = S['ctrl']
# typing pose: lean forward a little, hands to the keyboard
o.pose.bones['spine'].rotation_euler = (0.16, 0, 0)
ctrl['ik.L'].location = (0.075, -0.33, 0.205); ctrl['ik.R'].location = (-0.075, -0.33, 0.205)
o.pose.bones['head'].rotation_euler = (0.25, 0, 0)
import owner as OW
OW.set_face(o, 'neutral')

def cam(name, loc, tgt, lens):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.clip_start = 0.02
    ob = bpy.data.objects.new(name, cd); sc.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return ob
V = {
 'wide':  ((-1.75, -1.55, 1.05), (-0.2, 1.2, 0.55), 18),
 'front': ((0.05, -1.3, 1.0), (-0.1, 1.4, 0.75), 28),
 'cat':   ((-0.55, 0.0, 0.32), (-0.85, 0.55, 0.22), 50),
 'right': ((1.9, -1.2, 1.4), (-0.5, 1.2, 0.8), 18),
 'face':  ((0.25, 0.75, 1.25), (-0.12, 1.57, 1.22), 55),
 'owner': ((-0.12, 0.35, 0.95), (-0.12, 1.5, 0.85), 40),
}
for k, (l, t, lens) in V.items():
    if views and k not in views: continue
    sc.camera = cam('Cam_' + k, l, t, lens)
    sc.render.filepath = os.path.join(out, k + '.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', k)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, 'test_set.blend'))
