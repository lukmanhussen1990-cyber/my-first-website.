"""Render shots.  python render_shots.py --shots all --mode eevee --res 720x1280 --samples 6 --step 1 --out DIR"""
import sys, json, time, math, argparse, os
sys.path.insert(0, '/home/user/work/scripts')
import numpy as np
import bpy
from mathutils import Vector, Matrix, Euler
from common import *
from anim import *
import shots as SH

ap = argparse.ArgumentParser()
ap.add_argument('--shots', default='all')
ap.add_argument('--mode', default='eevee')
ap.add_argument('--res', default='360x640')
ap.add_argument('--samples', type=int, default=4)
ap.add_argument('--step', type=int, default=1)
ap.add_argument('--frames', default='')        # explicit global frames, comma separated
ap.add_argument('--out', default='/home/user/work/frames/preview')
ap.add_argument('--skip_existing', action='store_true')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
W, H = map(int, args.res.split('x'))
os.makedirs(args.out, exist_ok=True)
os.makedirs(args.out + '/anchors', exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
with bpy.data.libraries.load('/home/user/work/assets/world.blend', link=False) as (src, dst):
    dst.collections = [c for c in src.collections]
for c in dst.collections:
    if c.name in ('env', 'grass', 'props', 'studio'):
        sc.collection.children.link(c)
rig = load_caveman(sc)
ch = Character(rig, LM)
setup_render(sc, W, H, args.samples)
if args.mode == 'wb':
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_shadows = True
sky = sky_world(sc)
sun = add_sun(sc)
co = make_camera(sc)
LAYOUT = json.load(open('/home/user/work/assets/layout.json'))
PROPS = json.load(open('/home/user/work/assets/props.json'))
O = bpy.data.objects
COLL = bpy.data.collections
for m in bpy.data.materials:   # bubble / glass / flame need blended or emissive paths
    pass

FUR = [o for o in rig.ob.children if o.particle_systems]
FUR_BASE = {o.name: o.particle_systems[0].settings.rendered_child_count for o in FUR}


class Ctx:
    def __init__(self):
        self.sc, self.ch, self.rig, self.co, self.O = sc, ch, rig, co, O
        self.L = LAYOUT
        self.P = PROPS
        self.state = {}

    def set_fur(self, level):
        for o in FUR:
            st = o.particle_systems[0].settings
            st.rendered_child_count = max(1, int(round(FUR_BASE[o.name] * level)))

    def show(self, name, vis=True):
        o = O[name]
        o.hide_render = not vis
        o.hide_viewport = not vis

    def place(self, name, loc=None, rot=None, scale=None, mat=None):
        o = O[name]
        if mat is not None:
            o.matrix_world = mat
        if loc is not None:
            o.location = loc
        if rot is not None:
            o.rotation_euler = rot
        if scale is not None:
            o.scale = (scale, scale, scale) if np.isscalar(scale) else scale

    def attach(self, name, side, offset=Matrix.Identity(4), scale=1.0):
        m = self.ch.hand_matrix(side) @ offset
        o = O[name]
        o.matrix_world = m @ Matrix.Scale(scale, 4)

    def on_bone(self, name, bone, rest_pt, rot=(0, 0, 0), scale=1.0):
        pb = rig.ob.pose.bones[bone]
        M = rig.ob.matrix_world @ pb.matrix @ pb.bone.matrix_local.inverted()
        loc = M @ Vector(rest_pt)
        R = M.to_3x3().normalized() @ Euler([math.radians(a) for a in rot]).to_matrix()
        m = R.to_4x4(); m.translation = loc
        O[name].matrix_world = m @ Matrix.Scale(scale, 4) if np.isscalar(scale) else m @ Matrix.Diagonal((*scale, 1))


ctx = Ctx()
# swallow lump: spherical displacement on the beard, driven by an empty that slides down the throat
lump_e = bpy.data.objects.new('lump_empty', None)
sc.collection.objects.link(lump_e)
lump_e.scale = (0.05, 0.05, 0.06)
tex = bpy.data.textures.new('lumptex', 'BLEND')
tex.progression = 'SPHERICAL'
beard_ob = O['beard']
dm = beard_ob.modifiers.new('lump', 'DISPLACE')
dm.texture = tex
dm.texture_coords = 'OBJECT'
dm.texture_coords_object = lump_e
dm.direction = 'NORMAL'
dm.mid_level = 0.0
dm.strength = 0.0
idx_ps = [i for i, m in enumerate(beard_ob.modifiers) if m.type == 'PARTICLE_SYSTEM'][0]
beard_ob.modifiers.move(len(beard_ob.modifiers) - 1, idx_ps)


def update_lump(shot, t):
    lp = getattr(shot, 'lump', None)
    if not lp or not (lp[0] <= t <= lp[1] + 0.05):
        dm.strength = 0.0
        return
    u = (t - lp[0]) / (lp[1] - lp[0])
    u = min(max(u, 0), 1)
    a = ch.point('jaw', (0, -0.12, 1.62)); b = ch.point('beard_tip', (0, -0.15, 1.44))
    lump_e.location = a.lerp(b, u * u * (3 - 2 * u))
    dm.strength = 0.06 * math.sin(min(u * 1.2, 1) * math.pi) + 0.02
ALL_SUB = [c.name for c in COLL['props'].children]
HIDDEN_DEFAULT = {'gum', 'juice', 'birds'}


def begin(shot):
    for n in ALL_SUB:
        COLL[n].hide_render = n not in shot.colls
    COLL['studio'].hide_render = 'studio' not in shot.colls
    COLL['env'].hide_render = 'studio' in shot.colls
    COLL['grass'].hide_render = 'studio' in shot.colls or shot.nograss
    COLL['caveman'].hide_render = shot.char is None
    for n in HIDDEN_DEFAULT:
        for o in COLL[n].objects:
            if o is not None:
                o.hide_render = True
    if shot.char is not None:
        x, y, rz = shot.char
        rig.ob.location = (x, y, 0)
        rig.ob.rotation_euler = (0, 0, math.radians(rz))
    ctx.set_fur(shot.fur)
    sun.data.energy = shot.sun
    sky.node_tree.nodes['Background'].inputs['Strength'].default_value = shot.sky
    ctx.state = {}


def anchors_for(shot, t):
    out = {}
    names = ['mouth', 'head', 'head_top', 'face', 'chin', 'eyeL', 'eyeR', 'nose', 'beard', 'beard_low', 'handL', 'handR',
             'palmL', 'palmR', 'index_tipR', 'index_tipL', 'thumb_tipR', 'thumb_tipL', 'chest', 'throat', 'hips', 'footL', 'footR']
    pts = {}
    if shot.char is not None:
        for n in names:
            pts[n] = ch.anchor(n)
    if shot.points:
        pts.update(shot.points(ctx, t))
    for n, p in pts.items():
        out[n] = project(sc, co, p)
    # face box
    if shot.char is not None:
        M = rig.ob.matrix_world
        hb = [ch.point('head', q) for q in [(0.11, -0.05, 1.74), (-0.11, -0.05, 1.74), (0, -0.05, 1.92), (0, -0.13, 1.70)]]
        hb += [ch.point('beard_tip', (0.09, -0.1, 1.5)), ch.point('beard_tip', (-0.09, -0.1, 1.5)), ch.point('beard_tip', (0, -0.12, 1.42))]
        pr = [project(sc, co, p) for p in hb]
        if all(p[2] > 0 for p in pr):
            xs = [p[0] for p in pr]; ys = [p[1] for p in pr]
            out['face_box'] = [min(xs), min(ys), max(xs), max(ys)]
    return out


shots = SH.build_all(ctx)
sel = list(shots.keys()) if args.shots == 'all' else args.shots.split(',')
only_frames = set(int(f) for f in args.frames.split(',') if f) if args.frames else None
total_t = time.time()
for name in sel:
    shot = shots[name]
    begin(shot)
    cam = Cam(co)
    cam.keys = shot.camkeys
    cam.shakes = shot.shakes
    cam.fstop = shot.fstop
    if shot.char is not None:
        ch.precompute_secondary(shot.p, shot.t0, shot.t1)
    f0, f1 = int(round(shot.t0 * FPS)), int(round(shot.t1 * FPS))
    anchors = {}
    frames = list(range(f0, f1))
    if only_frames is not None:
        frames = [f for f in frames if f in only_frames]
    else:
        frames = frames[::args.step]
    for f in frames:
        t = f / FPS
        fn = f'{args.out}/f_{f:05d}.png'
        if args.skip_existing and os.path.exists(fn):
            continue
        t1 = time.time()
        if shot.char is not None:
            ch.apply(shot.p, t, f, (lambda s, tt, pos: shot.ik(ctx, s, tt, pos)) if shot.ik else None)
        if shot.props:
            shot.props(ctx, t)
        if shot.char is not None:
            update_lump(shot, t)
        bpy.context.view_layer.update()
        fp = shot.focus(ctx, t) if shot.focus else None
        trk = (shot.track[0](ctx, t), shot.track[1]) if shot.track else None
        cam.apply(t, fp, trk)
        bpy.context.view_layer.update()
        anchors[f] = anchors_for(shot, t)
        sc.render.filepath = fn
        bpy.ops.render.render(write_still=True)
        print(f'{name} f{f} t={t:.2f} {time.time() - t1:.1f}s', flush=True)
    afn = f'{args.out}/anchors/{name}.json'
    if os.path.exists(afn):
        old = json.load(open(afn))
        old.update({str(k): v for k, v in anchors.items()})
        anchors = old
    json.dump(anchors, open(afn, 'w'))
print('ALL DONE', round(time.time() - total_t, 1))
