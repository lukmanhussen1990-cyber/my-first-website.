"""The reel: every shot's camera, character acting, props and effects, synced to the voice.

Word timings (s): AGAIN 2.78 | genius 4.46 | so you dig 5.76 | stinks 8.90 | flies 10.66 crying 11.14
leaves 12.68 | Clever 13.47 | wind 14.98 | almost fall in 16.44-17.36 | wooden seat 18.54 | Much better 20.16
smell 21.56 | pour water 23.66 | carrying 25.86 | back 28.02 | tank 29.44 | rope 30.96 | dumps 31.42
empty 33.98 | waterfall 36.22 | WHOOSH 37.31 | Congratulations 38.56 | toilet 41.54 | Now go wash 42.42-43.58
"""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler
import anim as A
from anim import Keys, CamShot, ease, smooth, clamp01, osc, Walk
import fx as FX
import env_nature as EN

FPS = 30
END_T = 43.58 + 0.80
N_FRAMES = int(math.ceil(END_T * FPS))
HOLE = Vector((0.0, 0.0, 0.0))
BUSH = Vector((-6.0, -1.0, 0.0))
SLAB = Vector((-0.95, 0.55, 0.0))
SPOT = (0.0, 0.62)             # standing spot behind the hole, facing the camera (-Y)
SEAT_TOP = 0.475
TANK_Z = 1.90
O = None
PARTS = {}


def ob(name):
    return bpy.data.objects[name]


def hide(o, h=True):
    o.hide_render = h


def hide_tree(o, h=True):
    o.hide_render = h
    for c in o.children_recursive:
        c.hide_render = h


# ------------------------------------------------------------------ shot container
class Shot:
    def __init__(self, name, t0, t1, cam, char=None, props=None, overlays=None, scene='Garden', reveal=False):
        self.name, self.t0, self.t1 = name, t0, t1
        self.cam, self.char, self.props, self.overlays = cam, char, props, overlays
        self.scene, self.reveal = scene, reveal


SHOTS = []


def shot_at(t):
    for s in SHOTS:
        if s.t0 <= t < s.t1:
            return s
    return SHOTS[-1]


# ------------------------------------------------------------------ common character specs
def base(x, y, h, **kw):
    P = dict(root=(x, y, h))
    P.update(kw)
    return P


def head_rel(p, aim=None):
    d = dict(space='head', p=p)
    if aim:
        d['aim'] = aim
    return d


def world_hand(p, aim=None):
    d = dict(space='world', p=tuple(p))
    if aim:
        d['aim'] = aim
    return d


def cam_pt(t):
    return Vector(bpy.data.scenes['Garden'].camera.location)


def lerpv(a, b, u):
    return Vector(a).lerp(Vector(b), u)


# ------------------------------------------------------------------ story state (persistent props)
def hole_progress(t):
    return smooth((t - 6.80) / 1.45)


def setup():
    global PARTS
    PARTS['planks'] = [o for o in ob('Seat').children]
    PARTS['plank_rest'] = {o.name: o.matrix_basis.copy() for o in PARTS['planks']}
    PARTS['pipe'] = sorted([o for o in bpy.data.objects if o.name.startswith('Pipe') and o.name[4:6].isdigit()
                            and len(o.name) == 6], key=lambda o: o.name)
    PARTS['leaves'] = [ob(f'Leaf{i}') for i in range(8)]
    rng = np.random.RandomState(5)
    PARTS['leaf_rest'] = []
    for i in range(8):
        a = i * 2.39996
        r = 0.04 + 0.13 * math.sqrt((i + 0.5) / 8)
        PARTS['leaf_rest'].append((Vector((math.cos(a) * r - 0.12 * math.sin(a), math.sin(a) * r, 0.025 + 0.006 * i)),
                                   a + rng.uniform(-0.6, 0.6)))
    PARTS['tank_parts'] = ['TankPole0', 'TankPole1', 'TankPole2', 'TankPole3',
                           'TankBeam0', 'TankBeam1', 'TankBeam2', 'TankBeam3']
    for nm in PARTS['tank_parts']:
        PARTS[nm] = ob(nm).matrix_basis.copy()
    PARTS['bowl_rest'] = ob('Bowl').matrix_world.copy()
    PARTS['fx'] = FX_OBJS


FX_OBJS = {}


def fxp(name):
    """particle helper objects wrapped lazily."""
    if name not in FX_OBJS:
        o = bpy.data.objects[{'tears': 'Tears', 'dirtbits': 'DirtBits', 'drops': 'Drops', 'sweat': 'Sweat',
                              'confetti': 'Confetti'}.get(name, name)]
        FX_OBJS[name] = WrapParticles(o)
    return FX_OBJS[name]


class WrapParticles:
    """re-wrap an existing particle mesh (template = first instance)."""

    def __init__(self, o):
        self.ob = o
        me = o.data
        n_v = len(me.vertices)
        # instances are equal-sized blocks (known instance counts from fx.build_all)
        cnt = {'Tears': 24, 'DirtBits': 40, 'Drops': 260, 'Sweat': 10, 'Confetti': 420}
        self.n = cnt.get(o.name, 14)
        nv = n_v // self.n
        self.nv = nv
        co = np.empty(n_v * 3, dtype=np.float32)
        me.vertices.foreach_get('co', co)
        co = co.reshape(self.n, nv, 3)
        c0 = co[0]
        cen = c0.mean(0)
        self.tV = (c0 - cen)
        s = np.abs(self.tV).max()
        self.tV = self.tV / max(s, 1e-9)

    def set(self, pos, scale, rotm=None):
        n = self.n
        pos = np.asarray(pos, dtype=np.float32).reshape(n, 3)
        sc = np.asarray(scale, dtype=np.float32)
        if sc.ndim == 1:
            sc = sc[:, None].repeat(3, 1)
        V = self.tV[None, :, :] * sc[:, None, :]
        if rotm is not None:
            V = np.einsum('nij,nvj->nvi', rotm.astype(np.float32), V)
        V = V + pos[:, None, :]
        self.ob.data.vertices.foreach_set('co', V.reshape(-1).astype(np.float32))
        self.ob.data.update()

    def show(self, on=True):
        self.ob.hide_render = not on


def set_flow(matname, value):
    m = bpy.data.materials.get(matname)
    if m and 'flow_offset' in m.node_tree.nodes:
        m.node_tree.nodes['flow_offset'].outputs[0].default_value = value


def tank_tip(t):
    """tank tilt (degrees) when the rope is pulled."""
    a = 0.0
    for (t0, amt, dur) in ((31.75, 34.0, 1.0), (33.05, 22.0, 0.75), (37.30, 38.0, 1.3)):
        if t0 <= t <= t0 + dur:
            u = (t - t0) / dur
            a = max(a, amt * (ease(u / 0.3, 'back') if u < 0.3 else 1.0 - ease((u - 0.65) / 0.35, 'io') * (u > 0.65)))
    return a


def rope_pull(t):
    """how far the rope end is pulled down (m)."""
    p = 0.0
    for (t0, amt, dur) in ((31.65, 0.22, 1.1), (32.95, 0.18, 0.85), (37.20, 0.25, 1.4)):
        if t0 <= t <= t0 + dur:
            u = (t - t0) / dur
            p = max(p, amt * (ease(u / 0.25, 'out') if u < 0.25 else 1 - ease((u - 0.7) / 0.3)))
    return p


def apply_story(t, sh):
    """persistent world state at story time t (reset everything each frame)."""
    # reveal objects
    for o in bpy.data.collections['Reveal'].objects:
        o.hide_render = not sh.reveal
    set_flow('waterfall', -t * 1.3)
    set_flow('river', t * 0.35)
    set_flow('pool', t * 0.2)
    # hole + pile
    hp = hole_progress(t)
    for nm in ('HoleDark', 'HoleRim'):
        hide(ob(nm), hp < 0.03)
    s = max(0.03, hp)
    ob('HoleDark').scale = (s, s, 0.4 + 0.6 * s)
    ob('HoleRim').scale = (0.55 + 0.45 * s, 0.55 + 0.45 * s, s)
    ob('DirtPile').scale = (max(0.02, hp ** 0.7),) * 2 + (max(0.02, hp),)
    hide(ob('DirtPile'), hp < 0.03)
    # seat (planks fly in 17.95-18.95)
    seat_on = t >= 17.92
    hide_tree(ob('Seat'), not seat_on)
    if seat_on:
        rng = np.random.RandomState(3)
        for i, p in enumerate(PARTS['planks']):
            rest = PARTS['plank_rest'][p.name]
            t_in = 17.95 + 0.055 * (i % 18)
            u = clamp01((t - t_in) / 0.32)
            if u >= 1:
                p.matrix_basis = rest
                p.hide_render = False
                continue
            p.hide_render = t < t_in
            d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0.3, 1.0))).normalized() * 1.6
            e = ease(u, 'snap')
            loc = rest.to_translation() + d * (1 - e)
            rq = rest.to_quaternion() @ Quaternion(Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 1)).normalized(),
                                                   (1 - e) * 4.0)
            p.matrix_basis = Matrix.Translation(loc) @ rq.to_matrix().to_4x4()
    # tank + poles (rise 28.75-29.9)
    tank_on = t >= 28.72
    for i, nm in enumerate(PARTS['tank_parts']):
        o = ob(nm)
        o.hide_render = not tank_on
        rest = PARTS[nm]
        if nm.startswith('TankPole'):
            u = ease(clamp01((t - (28.78 + 0.07 * i)) / 0.35), 'back')
            o.matrix_basis = Matrix.Translation((0, 0, -2.1 * (1 - u))) @ rest
            o.hide_render = not tank_on or u <= 0
        else:
            u = clamp01((t - 29.15) / 0.12)
            o.hide_render = u <= 0
    tk = ob('Tank')
    hide_tree(tk, t < 29.25)
    drop = ease(clamp01((t - 29.25) / 0.35), 'back')
    tip = tank_tip(t)
    tk.location = (0, 0, TANK_Z + 2.6 * (1 - drop))
    tk.rotation_euler = (math.radians(-tip), 0, 0)
    rope_u = clamp01((t - 29.62) / 0.3)
    for nm in ('FlushRope', 'RopeKnot'):
        o = ob(nm)
        o.hide_render = t < 29.62
    rp = ob('FlushRope')
    rp.scale = (1, 1, max(0.01, ease(rope_u, 'back')))
    pull = rope_pull(t)
    rp.scale = (1, 1, max(0.01, ease(rope_u, 'back')) * (1 + pull * 1.2))
    ob('RopeKnot').location = (0.13, -0.36, -0.80 * max(0.01, ease(rope_u, 'back')) - pull)
    # tank water level (empty after the first flush, refilled by the waterfall)
    lvl = 0.36
    if 32.4 < t < 37.2:
        lvl = 0.04
    ob('TankWater').hide_render = t < 29.25 or lvl < 0.05
    ob('TankWater').location = (0, 0, lvl)
    # bamboo pipe: hidden until it pops in (36.30 - 37.20), waterfall end first
    for k, seg in enumerate(PARTS['pipe']):
        t_in = 36.30 + (len(PARTS['pipe']) - 1 - k) * 0.062
        vis = t >= t_in
        hide_tree(seg, not vis)
        if vis:
            u = ease(clamp01((t - t_in) / 0.18), 'back')
            seg.scale = (max(0.01, u),) * 3
    # bowl on the slab by default
    b = ob('Bowl')
    b.matrix_world = PARTS['bowl_rest']
    # shovel: leaning on the pile after digging
    sv = ob('Shovel')
    hide_tree(sv, t < 5.5)
    sv.matrix_world = (Matrix.Translation((0.95, 0.55, 0.0)) @ Matrix.Rotation(math.radians(-25), 4, 'Y')
                       @ Matrix.Rotation(math.radians(20), 4, 'X'))
    # poop: in the hole from the stink scene until the seat covers it; beside the bush in scene 1
    hide(ob('Poop'), not (8.30 <= t < 17.92))
    hide(ob('PoopBush'), not (t < 6.75))
    # small props hidden by default
    for nm in ('HammerRock', 'PotL', 'PotR', 'Yoke', 'NeighbourArm', 'NeighbourCuff'):
        if nm in bpy.data.objects:
            hide(ob(nm))
    for l_ in PARTS['leaves']:
        hide(l_)
    # effects off
    for i in range(FX.STINK_N):
        hide(ob(f'Stink{i}'))
    for i in range(5):
        hide_tree(ob(f'Fly{i}'))
    for nm in ('Tears', 'DirtBits', 'Drops', 'Sweat', 'Confetti', 'Stream', 'Stream2', 'Jet') + tuple(f'Poof{k}' for k in range(5)):
        hide(ob(nm))
    ob('EyeLight').data.energy = 0.0
    ob('Rig').hide_render = sh.scene == 'Studio'


def apply_shot(t, sh, char):
    if sh.props:
        sh.props(t, char)


# ------------------------------------------------------------------ helpers for effects
def poof(k, t, t0, center, size=0.5, dur=0.7):
    p = fxp(f'Poof{k}')
    FX.poof_update(p, t, t0, center, size=size, seed=k * 7 + int(t0 * 10), dur=dur)


def stream(name, t, p0, p1, radius, sag=0.15, wobble=0.01, radii=None):
    o = ob(name)
    o.hide_render = False
    pts = []
    p0, p1 = Vector(p0), Vector(p1)
    for k in range(24):
        u = k / 23
        p = p0.lerp(p1, u)
        p.z -= sag * 4 * u * (1 - u) * 0.0 if sag == 0 else 0.0
        # gravity curve: horizontal ease-out
        h = p0.lerp(p1, 1 - (1 - u) ** 2)
        p = Vector((h.x, h.y, p0.z + (p1.z - p0.z) * u * u))
        p.x += math.sin(u * 9 + t * 25) * wobble * u
        p.y += math.cos(u * 7 + t * 21) * wobble * u
        pts.append(p)
    rr = radii if radii is not None else [radius * (0.8 + 0.35 * u) for u in np.linspace(0, 1, 24)]
    FX.set_curve(o, [tuple(p) for p in pts], radius=1.0, radii=rr)


def splash(t, t0, t1, center, n_active, speed=1.6, size=0.012, seed=0, spread=1.0, up=1.0):
    d = fxp('drops')
    rng = np.random.RandomState(seed)
    N = d.n
    P = np.zeros((N, 3)); S = np.zeros(N)
    births = rng.uniform(t0, t1, N)
    vel = np.stack([rng.normal(0, 0.55 * spread, N), rng.normal(0, 0.55 * spread, N),
                    rng.uniform(0.6, 1.4, N) * up], 1) * speed
    life = 0.55
    vis = False
    for i in range(min(N, n_active)):
        a = t - births[i]
        if 0 <= a <= life:
            P[i] = FX.ballistic(np.asarray(center), vel[i], a)
            S[i] = size * (1 - a / life * 0.5) * rng.uniform(0.6, 1.4)
            vis = True
    d.set(P, S)
    d.show(vis)


# ================================================================== SCENE 1: caught behind the bush
def s1_char(t):
    bx, by = BUSH.x, BUSH.y + 0.72
    P = base(bx, by, 0.0, hip=(0, 0.05, -0.43), hip_rot=(18, 0, 0), spine=(16, 0, 0), chest=(4, 0, 0),
             neck=(-2, 0, 0), head=(-6, 0, 0), footL=(0.05, -0.12, 0, -10), footR=(-0.05, 0.02, 0, 10),
             kneeL=(0.25, -0.9, 0.6), kneeR=(-0.25, -0.9, 0.6), blink_seed=3)
    P['handL'] = (0.20, -0.32, 0.55); P['handR'] = (-0.20, -0.32, 0.55)
    # nervous glances, then notices the pointing finger
    look = Keys((0.0, (0.6, -0.1)), (0.45, (0.6, -0.1)), (0.6, (-0.5, -0.05)), (0.95, (-0.5, -0.05)),
                (1.10, (-0.85, 0.05), 'out'))(t)
    P['look'] = look
    shock = smooth((t - 1.08) / 0.12)
    P['face'] = A._lerp(dict(squint=0.15, smile=0.2, browSad=0.2), dict(wide=1.15, browUp=1.1, open=0.25, oh=0.6), shock)
    P['head'] = Keys((0.0, (-4, 8, 2)), (0.6, (-4, -6, -2)), (1.10, (2, -10, 3)), (1.25, (-12, -4, 0), 'back'),
                     (2.6, (-8, -2, 0)), (3.0, (-14, 0, 0), 'back'))(t)
    P['spine'] = Keys((0.0, (16, 0, 0)), (1.1, (16, 0, 0)), (1.3, (6, 0, 0), 'back'))(t)
    # both hands come up to cover the mouth (1.30-1.62)
    cover = ease(clamp01((t - 1.28) / 0.34), 'back')
    if cover > 0:
        for side, s in (('L', 1), ('R', -1)):
            hold = head_rel((s * 0.072, -0.094 + 0.010 * (s < 0), 0.108 + 0.008 * (s < 0)),
                            aim=((-s * 0.85, 0.40, 0.18), (0, 0.1, -1)))
            start = (s * 0.20, -0.32, 0.55)
            P['hand' + side] = hold if cover > 0.98 else _blend_hand(start, hold, cover)
            P['shape' + side] = ('relaxed', 'cup', cover)
            P['elbow' + side] = (s * 0.35, -0.35, 0.55)
    if t > 2.78:   # AGAIN!: tiny jolt
        P['hip'] = (0, 0.05, -0.43 + 0.02 * math.exp(-(t - 2.78) * 8) * math.sin((t - 2.78) * 40))
    return P


def _blend_hand(start, hold, u):
    """crossfade from a root-space point to a bone-relative hold (approximate with the hold + offset)."""
    d = dict(hold)
    p = Vector(hold['p'])
    d['p'] = tuple(p + Vector((0, -0.30, -0.10)) * (1 - u))
    return d


def s1_props(t, char):
    # neighbour's big pointing hand slides in from the right edge (0.70 -> 1.05 s)
    arm = ob('NeighbourArm')
    cam = bpy.data.scenes['Garden'].camera
    u = ease(clamp01((t - 0.70) / 0.35), 'back')
    if t < 0.70:
        arm.hide_render = True
        ob('NeighbourCuff').hide_render = True
        return
    arm.hide_render = False
    ob('NeighbourCuff').hide_render = False
    M = cam.matrix_world
    right = M.to_3x3() @ Vector((1, 0, 0))
    up = M.to_3x3() @ Vector((0, 1, 0))
    fwd = M.to_3x3() @ Vector((0, 0, -1))
    head = char.sk.world('head').to_translation() + Vector((0, -0.05, 0.08))
    base_p = M.to_translation() + fwd * 0.78 + up * -0.03 + right * (0.13 + 0.45 * (1 - u))
    jab = 0.012 * math.sin(max(0, t - 1.2) * 18) * math.exp(-max(0, t - 1.2) * 2.0)
    base_p += (head - base_p).normalized() * jab
    d = (head - base_p).normalized()           # pointing direction (arm's -X)
    xa = -d
    za = (up - xa * up.dot(xa)).normalized()
    ya = za.cross(xa)
    R = Matrix((xa, ya, za)).transposed()
    arm.matrix_world = Matrix.Translation(base_p) @ R.to_4x4() @ Matrix.Scale(0.95, 4)


def s1_overlays(t):
    return []


bx, by = BUSH.x, BUSH.y
SHOTS.append(Shot('S1a', 0.0, 2.75,
                  CamShot(Keys((0.0, (bx + 0.30, by - 1.55, 1.02)), (2.75, (bx + 0.22, by - 1.25, 1.00))),
                          (bx, by + 0.70, 0.96), 40, fstop=2.2,
                          focus=(bx, by + 0.62, 0.98), shakes=((0.05, 0.02, 0.35, 6.0),)),
                  s1_char, s1_props, s1_overlays))
SHOTS.append(Shot('S1b', 2.75, 4.00,
                  CamShot(Keys((2.75, (bx + 0.22, by - 1.30, 1.00)), (2.97, (bx + 0.10, by - 0.52, 1.00), 'out'),
                               (4.0, (bx + 0.09, by - 0.44, 1.00))),
                          (bx, by + 0.70, 0.96), Keys((2.75, 40), (2.97, 46, 'out')), fstop=2.4,
                          focus=(bx, by + 0.62, 0.98), shakes=((2.86, 0.025, 0.45, 9.0),)),
                  s1_char, s1_props, None))


# ================================================================== SCENE 2: genius + dig
def s2a_char(t):
    bx, by = BUSH.x, BUSH.y + 0.72
    rise = ease(clamp01((t - 4.02) / 0.42), 'back')
    hip_z = -0.43 * (1 - rise)
    P = base(bx, by, 0.0, hip=(0, 0.05 * (1 - rise), hip_z), hip_rot=(18 * (1 - rise), 0, 0),
             spine=(16 * (1 - rise), 0, 0), blink_seed=5)
    # tap the temple with the right index finger (4.50 - 4.95), smug smile
    up = ease(clamp01((t - 4.30) / 0.25), 'back') * (1 - ease(clamp01((t - 5.25) / 0.35)))
    if up > 0:
        tap = 0.012 * max(0, math.sin((t - 4.55) * 2 * math.pi * 4.0)) if 4.55 < t < 4.95 else 0.0
        # index fingertip on the right temple: wrist below/outside, hand pointing up-in
        hold = head_rel((-0.165 + tap, -0.035, -0.020), aim=((0.53, 0.79, 0.30), (0.0, 0.0, 1.0)))
        P['handR'] = _blend_hand(None, hold, up) if up < 0.98 else hold
        P['elbowR'] = (-0.45, -0.10, 1.05)
        P['shapeR'] = ('relaxed', 'point', min(1, up * 1.3))
    smug = smooth((t - 4.45) / 0.3)
    P['face'] = A._lerp(dict(), dict(smileL=1.0, smile=0.35, cheek=0.5, squint=0.5, browL=-0.25, browR=0.6), smug)
    P['head'] = (-4 + 6 * smug, -8 * smug, -6 * smug)
    P['look'] = (0.15 * smug, 0.05)
    return P


def s2a_ov(t):
    out = []
    if 4.55 <= t <= 5.25:
        hp = Vector((BUSH.x - 0.11, BUSH.y + 0.66, 1.60))
        out.append(dict(type='sparkle', world=tuple(hp), age=t - 4.55, dur=0.7, size=0.11))
        out.append(dict(type='sparkle', world=tuple(hp + Vector((0.08, 0, 0.09))), age=t - 4.62, dur=0.6, size=0.07))
    return out


SHOTS.append(Shot('S2a', 4.00, 5.76,
                  CamShot(Keys((4.0, (bx + 0.30, by - 1.70, 1.32)), (5.76, (bx + 0.26, by - 1.45, 1.36))),
                          Keys((4.0, (bx, by + 0.7, 1.12)), (4.45, (bx, by + 0.7, 1.40))), 38, fstop=2.6,
                          focus=(bx, by + 0.62, 1.45)),
                  s2a_char, None, s2a_ov))

WALK2 = Walk([(-1.55, -0.95), (-0.55, -0.35)], 5.76, 6.62, step=0.40)


def shovel_matrix(tip, top):
    tip, top = Vector(tip), Vector(top)
    z = (top - tip).normalized()
    x = z.cross(Vector((0, 0, 1)))
    if x.length < 1e-3:
        x = Vector((1, 0, 0))
    x.normalize()
    y = z.cross(x)
    R = Matrix((x, y, z)).transposed().to_4x4()
    origin = tip + z * 0.22                     # shovel origin sits 0.22 above the blade tip
    return Matrix.Translation(origin) @ R, z


def dig_cycle(t):
    """shovel blade tip + handle top for the fast digging loop (period 0.34 s)."""
    ph = ((t - 6.70) / 0.34) % 1.0
    hole = Vector((0.0, -0.02, 0.0))
    pile = Vector((0.62, 0.38, 0.35))
    if ph < 0.35:        # stab down
        u = ease(ph / 0.35, 'in')
        tip = hole + Vector((0.05, -0.10, 0.25 - 0.40 * u))
        top = tip + Vector((-0.42, -0.52, 0.80)).normalized() * 1.25
    elif ph < 0.6:       # lever
        u = ease((ph - 0.35) / 0.25)
        tip = hole + Vector((0.05, -0.10, -0.15 + 0.25 * u))
        top = tip + Vector((-0.42 - 0.3 * u, -0.52, 0.80 - 0.25 * u)).normalized() * 1.25
    else:                # fling to the pile
        u = ease((ph - 0.6) / 0.4, 'out')
        tip = hole.lerp(pile, 0.45 * u) + Vector((0.05, -0.10, 0.10 + 0.25 * math.sin(math.pi * u)))
        top = tip + Vector((-0.72 + 0.30 * u, -0.52, 0.55 + 0.25 * u)).normalized() * 1.25
    return tip, top, ph


def s2b_char(t):
    p, h = WALK2.root(t)
    feet = WALK2.feet(t)
    bob, sway = WALK2.hip_bob(t)
    P = base(p[0], p[1], h, feetW=feet, hip=(sway, 0, bob), blink_seed=7, face=dict(smile=0.5, cheek=0.3),
             look=(0.0, -0.1))
    if t < 6.62:
        # carry shovel on the right shoulder
        P['handR'] = (-0.16, -0.12, 1.30); P['shapeR'] = 'grip'
        P['swingL'] = 0.12 * math.sin(math.pi * WALK2.phase(t))
    return P


def s2_shovel_props(t, char):
    sv = ob('Shovel')
    hide_tree(sv, False)
    if t < 6.62:
        # carried on the right shoulder: hand in front holds the handle end, blade up behind
        hR = char.sk.world('hand.R')
        grip = hR @ Vector((0, 0.06, 0.02))
        h = math.radians(char_heading(t))
        Rw = Matrix.Rotation(h, 3, 'Z')
        d = (Rw @ Vector((0.05, 0.80, 0.55))).normalized()
        top = grip - d * 0.06
        tip = top + d * 1.27
        M, z = shovel_matrix(tip, top)
        sv.matrix_world = M
    else:
        tip, top, ph = dig_cycle(t)
        M, z = shovel_matrix(tip, top)
        sv.matrix_world = M


def char_heading(t):
    return WALK2.root(t)[1] if t < 6.75 else -58.0


def s2c_char(t):
    P = base(-0.55, -0.40, -58.0, blink_seed=9, face=dict(squint=0.6, browAngry=0.4, grimace=0.5, open=0.2),
             hip=(0, 0.02, -0.10), hip_rot=(12, 0, 0), spine=(14, -10, 0), chest=(6, -8, 0),
             footL=(0.06, -0.08, 0, 0), footR=(-0.08, 0.10, 0, 15))
    tip, top, ph = dig_cycle(max(t, 6.70))
    axis = (top - tip).normalized()
    P['handR'] = world_hand(tip + axis * 1.00, aim=(tuple(-axis.cross(Vector((0, 0, 1))).normalized()), (0, 0, -1)))
    P['handL'] = world_hand(tip + axis * 0.62, aim=(tuple(axis.cross(Vector((0, 0, 1))).normalized()), (0, 0, 1)))
    P['shapeR'] = 'grip'; P['shapeL'] = 'grip'
    P['look'] = (0.3, -0.6)
    bounce = 0.02 * math.sin(ph * 2 * math.pi)
    P['hip'] = (0, 0.02, -0.10 + bounce)
    P['spine'] = (14 + 10 * math.sin(ph * 2 * math.pi), -10, 0)
    return P


def s2c_props(t, char):
    s2_shovel_props(t, char)
    # dirt chunks flying from the hole to the pile
    d = fxp('dirtbits')
    N = d.n
    rng = np.random.RandomState(4)
    P = np.zeros((N, 3)); S = np.zeros(N)
    vis = False
    for i in range(N):
        tb = 6.85 + (i // 4) * 0.34 + rng.uniform(0, 0.06)
        a = t - tb
        if 0 <= a <= 0.6 and tb < 8.25:
            v = np.array([0.9 + rng.normal(0, 0.25), 0.55 + rng.normal(0, 0.25), 2.4 + rng.normal(0, 0.4)])
            P[i] = FX.ballistic(np.array([0.05, 0.0, 0.12]), v, a)
            if P[i][2] < 0.02:
                P[i][2] = 0.02
            S[i] = rng.uniform(0.018, 0.04)
            vis = True
    rot = FX.rot_matrices(rng.normal(0, 1, (N, 3)), rng.uniform(0, 6, N) + t * 6)
    d.set(P, S, rot)
    d.show(vis)


SHOTS.append(Shot('S2b', 5.76, 6.75,
                  CamShot(Keys((5.76, (0.55, -3.30, 1.25)), (6.75, (0.45, -3.05, 1.20))),
                          Keys((5.76, (-1.0, -0.7, 0.95)), (6.75, (-0.5, -0.3, 0.90))), 30, fstop=4.0),
                  s2b_char, s2_shovel_props, None))
SHOTS.append(Shot('S2c', 6.75, 8.36,
                  CamShot(Keys((6.75, (0.70, -0.95, 0.40)), (8.36, (0.62, -0.85, 0.42))),
                          (-0.15, -0.05, 0.30), 24, fstop=2.8, focus=(0.0, -0.02, 0.12),
                          shakes=tuple((6.70 + 0.34 * k + 0.12, 0.008, 0.12, 14.0) for k in range(5))),
                  s2c_char, s2c_props, None))


# ================================================================== SCENE 3: it stinks + crying flies
def s3a_char(t):
    lean = Keys((8.36, 0.0), (8.75, 1.0), (9.05, 1.0), (9.35, -0.35, 'back'))(t)
    pinch = ease(clamp01((t - 9.10) / 0.25), 'back')
    gag = smooth((t - 9.30) / 0.15)
    P = base(SPOT[0], SPOT[1], 0.0, blink_seed=11)
    P['spine'] = (6 + 20 * max(lean, 0) - 8 * gag, 0, 0)
    P['chest'] = (8 * max(lean, 0) - 10 * gag, 0, 0)
    P['head'] = (14 * max(lean, 0) - 18 * gag + 4 * math.sin(t * 30) * gag * (t < 10.0), 0, 0)
    P['hip'] = (0, -0.04 * max(lean, 0) + 0.05 * gag, -0.02)
    P['look'] = (0.0, -0.9 * (1 - gag))
    P['face'] = A._lerp(dict(browUp=0.3), dict(blinkL=1, blinkR=1, squint=1, browAngry=0.6,
                                                                   grimace=1, open=0.35, sneer=0.9), gag)
    if pinch > 0:
        hold = head_rel((-0.012, -0.080, 0.175), aim=((0.1, 0.9, 0.4), (0.9, 0, -0.3)))
        P['handR'] = hold if pinch > 0.98 else _blend_hand(None, hold, pinch)
        P['shapeR'] = ('relaxed', 'pinch', pinch)
        P['elbowR'] = (-0.5, -0.25, 1.15)
    P['handL'] = (0.28, -0.10, 0.95) if gag > 0 else None
    P['shapeL'] = 'spread' if gag > 0.5 else 'relaxed'
    return P


def s3a_props(t, char):
    FX.stink_update(t, 8.45, 11.8, (0.0, 0.0, 0.0), height=0.9, strength=1.0)


SHOTS.append(Shot('S3a', 8.36, 10.20,
                  CamShot(Keys((8.36, (0.75, -2.05, 1.20)), (10.2, (0.60, -1.75, 1.22))),
                          Keys((8.36, (0.0, 0.25, 0.75)), (10.2, (0.0, 0.45, 1.05))), 30, fstop=3.2,
                          focus=(0.0, 0.5, 1.2), shakes=((9.32, 0.02, 0.35, 10.0),)),
                  s3a_char, s3a_props, None))


def s3b_props(t, char):
    FX.stink_update(t, 8.45, 11.8, (0.0, 0.0, 0.0), height=0.9)
    FX.flies_update(t, 10.15, 11.80, (0.0, 0.0, 0.10), radius=0.26, height=0.30, tears=fxp('tears'))


def s3b_char(t):
    P = s3a_char(min(t, 10.15))
    P['face'] = dict(blinkL=0.6, blinkR=0.6, squint=1, browAngry=0.6, grimace=1, open=0.25, sneer=0.9)
    return P


SHOTS.append(Shot('S3b', 10.20, 11.72,
                  CamShot(Keys((10.2, (0.35, -0.80, 0.42)), (11.72, (0.28, -0.68, 0.40))),
                          (0.0, 0.0, 0.25), 32, fstop=2.2, focus=(0.0, 0.0, 0.30)),
                  s3b_char, s3b_props, None))


# ================================================================== SCENE 4: cover with leaves, Clever!
def leaf_bundle_world(char, i):
    hc = char.sk.world('chest')
    c = hc @ Vector((0, 0.05, 0.22))          # in front of the chest
    a = i * 2.39996
    return c + Vector((math.cos(a) * 0.06, -0.02 * i, math.sin(a) * 0.05)), a


def s4a_char(t):
    P = base(SPOT[0], SPOT[1], 0.0, blink_seed=13)
    drop = ease(clamp01((t - 12.20) / 0.25), 'out')
    P['handL'] = (0.14 - 0.10 * drop, -0.30 - 0.05 * drop, 1.05 + 0.10 * drop)
    P['handR'] = (-0.14 + 0.10 * drop, -0.30 - 0.05 * drop, 1.05 + 0.10 * drop)
    P['aimL'] = ((-0.6, -0.6, 0.2), (0.0, 0.0, 1.0))
    P['aimR'] = ((0.6, -0.6, 0.2), (0.0, 0.0, 1.0))
    P['shapeL'] = 'cup'; P['shapeR'] = 'cup'
    P['spine'] = (8 + 6 * drop, 0, 0)
    P['look'] = (0.0, -0.7)
    P['face'] = dict(smile=0.4 + 0.4 * drop, cheek=0.3 * drop)
    return P


def leaf_fall(i, t, t_drop):
    rest_p, rest_a = PARTS['leaf_rest'][i]
    a = t - t_drop - i * 0.045
    if a < 0:
        return None
    dur = 0.85
    u = clamp01(a / dur)
    rng = np.random.RandomState(i)
    start = Vector((rng.uniform(-0.15, 0.15), 0.40 + rng.uniform(-0.05, 0.08), 1.05 + rng.uniform(-0.05, 0.1)))
    end = Vector((rest_p.x, rest_p.y, rest_p.z))
    p = start.lerp(end, ease(u, 'io'))
    p.x += math.sin(a * 9 + i) * 0.10 * (1 - u)
    p.y += math.cos(a * 7 + i) * 0.05 * (1 - u)
    rot = Euler((math.sin(a * 8 + i) * 0.9 * (1 - u), math.cos(a * 6 + i) * 0.7 * (1 - u), rest_a))
    return p, rot


def place_leaf(l_, p, rot):
    l_.hide_render = False
    l_.location = p
    l_.rotation_euler = rot


def s4_props(t, char):
    for i, l_ in enumerate(PARTS['leaves']):
        if t < 12.22:
            p, a = leaf_bundle_world(char, i)
            place_leaf(l_, p, Euler((1.2, 0.3 * i, a)))
        else:
            r = leaf_fall(i, t, 12.22)
            if r is None:
                p, a = leaf_bundle_world(char, i)
                place_leaf(l_, p, Euler((1.2, 0.3 * i, a)))
            else:
                place_leaf(l_, *r)


SHOTS.append(Shot('S4a', 11.72, 13.40,
                  CamShot(Keys((11.72, (0.55, -2.15, 1.30)), (13.4, (0.45, -1.95, 1.18))),
                          Keys((11.72, (0.0, 0.30, 0.95)), (13.4, (0.0, 0.10, 0.55))), 30, fstop=3.5,
                          focus=(0.0, 0.2, 0.6)),
                  s4a_char, s4_props, None))


def s4b_char(t):
    P = base(SPOT[0], SPOT[1], 0.0, blink_seed=15, autoblink=False)
    up = ease(clamp01((t - 13.42) / 0.20), 'back')
    P['handR'] = (-0.20 * up - 0.16 * (1 - up), -0.38 * up - 0.05 * (1 - up), 1.10 * up + 0.90 * (1 - up))
    P['aimR'] = ((0.0, -0.3, 0.25), (1.0, 0.0, 0.0)) if up > 0.3 else None
    P['shapeR'] = ('relaxed', 'thumbsup', up)
    P['elbowR'] = (-0.55, 0.0, 0.95)
    wink = smooth((t - 13.50) / 0.10) * (1 - smooth((t - 14.15) / 0.12))
    P['face'] = dict(smile=0.9, cheek=0.8, blinkL=wink, squint=0.3 * wink, browL=-0.4 * wink, browR=0.3)
    P['head'] = (-4, -6 * up, -7 * up)
    P['look_at'] = tuple(cam_pt(t))
    return P


def s4b_ov(t):
    out = []
    if 13.50 <= t <= 14.30:
        out.append(dict(type='sparkle', world=(0.16, 0.42, 1.62), age=t - 13.50, dur=0.75, size=0.12))
        out.append(dict(type='sparkle', world=(-0.30, 0.20, 1.20), age=t - 13.58, dur=0.65, size=0.08))
    return out


SHOTS.append(Shot('S4b', 13.40, 14.38,
                  CamShot(Keys((13.4, (0.10, -0.85, 1.45)), (14.38, (0.08, -0.72, 1.45))),
                          (0.0, 0.50, 1.38), 40, fstop=2.4, focus=(0.0, 0.48, 1.50),
                          shakes=((13.47, 0.012, 0.25, 9.0),)),
                  s4b_char, s4_props, s4b_ov))


# ================================================================== SCENE 5: wind + almost fall in
def s5a_char(t):
    P = base(SPOT[0], SPOT[1], 0.0, blink_seed=17)
    w = smooth((t - 14.55) / 0.3) * (1 - smooth((t - 16.05) / 0.3))
    P['wind'] = (14.0 * w, 2.0 * w, 1.0 * w)
    P['face'] = A._lerp(dict(smile=0.4), dict(squint=0.9, browAngry=0.3, grimace=0.6, blinkL=0.5, blinkR=0.5), w)
    P['head'] = (4 * w, 10 * w, -6 * w)
    P['spine'] = (0, 0, -6 * w)
    P['handL'] = (0.12, -0.26, 1.42) if w > 0.3 else None
    P['shapeL'] = 'open'
    P['look'] = (0.6 * w, 0.1)
    return P


def s5_props(t, char):
    for i, l_ in enumerate(PARTS['leaves']):
        rest_p, rest_a = PARTS['leaf_rest'][i]
        a = t - (14.75 + i * 0.07)
        if a < 0:
            place_leaf(l_, rest_p, Euler((0, 0, rest_a)))
            continue
        if a > 1.6:
            l_.hide_render = True
            continue
        rng = np.random.RandomState(20 + i)
        v = Vector((3.2 + rng.uniform(0, 1.2), rng.uniform(-0.6, 0.6), 1.2 + rng.uniform(0, 1.0)))
        p = rest_p + v * a + Vector((0, 0, -0.3 * a * a))
        place_leaf(l_, p, Euler((a * rng.uniform(6, 12), a * rng.uniform(4, 9), rest_a + a * 5)))


def s5a_ov(t):
    out = []
    for k in range(5):
        t0 = 14.55 + k * 0.22
        if t0 <= t <= t0 + 0.75:
            out.append(dict(type='wind', x=0.0, y=0.25 + 0.13 * k, age=t - t0, dur=0.75, seed=k))
    return out


SHOTS.append(Shot('S5a', 14.38, 16.10,
                  CamShot(Keys((14.38, (0.70, -2.45, 1.10)), (16.1, (0.55, -2.25, 1.05))),
                          (0.0, 0.25, 0.65), 28, fstop=4.0, shakes=((14.95, 0.015, 0.9, 6.0),)),
                  s5a_char, s5_props, s5a_ov))


def s5b_char(t):
    # steps forward toward the hole, foot slips at the edge, windmills, rocks, saves himself
    step = ease(clamp01((t - 16.15) / 0.35))
    slip = ease(clamp01((t - 16.45) / 0.18), 'in')
    rock = 0.0
    if t > 16.6:
        a = t - 16.6
        rock = math.exp(-a * 1.6) * math.sin(a * 2 * math.pi * 1.6)
    save = smooth((t - 17.30) / 0.3)
    lean = (0.75 * slip + 0.5 * rock) * (1 - save)
    P = base(SPOT[0], SPOT[1] - 0.28 * step, 0.0, blink_seed=19)
    P['footL'] = (0.0, -0.10 * step - 0.16 * slip, 0, 0)
    P['footR'] = (0.0, 0.05, 0, 0)
    P['foot_pitchL'] = -20 * slip * (1 - save)
    P['hip'] = (0, -0.02 - 0.05 * lean, -0.03 - 0.03 * slip)
    P['spine'] = (8 + 30 * lean, 0, 6 * rock)
    P['chest'] = (6 + 12 * lean, 0, 0)
    P['head'] = (-10 * lean, 0, 0)
    P['face'] = A._lerp(dict(smile=0.3), dict(wide=1.2, browUp=1.0, open=0.6, oh=0.9), smooth((t - 16.45) / 0.12))
    P['look'] = (0.0, -1.0 * smooth((t - 16.45) / 0.1))
    # windmilling arms (circles) 16.5-17.3
    wm = smooth((t - 16.48) / 0.08) * (1 - save)
    if wm > 0.01:
        for side, s in (('L', 1), ('R', -1)):
            ang = (t - 16.48) * 2 * math.pi * 3.0 * s + (0 if s > 0 else math.pi)
            c = Vector((s * 0.36, -0.10, 1.38))
            p = c + Vector((s * 0.10 * math.cos(ang), 0.30 * math.sin(ang), 0.30 * math.cos(ang)))
            P['hand' + side] = tuple(Vector(P.get('hand' + side) or c).lerp(p, wm)) if wm < 1 else tuple(p)
            P['shape' + side] = 'spread'
            P['elbow' + side] = (s * 0.8, 0.1, 1.3)
    return P


SHOTS.append(Shot('S5b', 16.10, 17.68,
                  CamShot(Keys((16.1, (1.30, -1.20, 0.75)), (17.68, (1.20, -1.05, 0.80))),
                          Keys((16.1, (0.0, 0.25, 0.75)), (16.6, (0.0, 0.25, 0.85))), 26, fstop=3.2,
                          shakes=((16.45, 0.02, 0.4, 8.0),)),
                  s5b_char, None, None))


# ================================================================== SCENE 6: wooden seat
def s6a_props(t, char):
    poof(0, t, 17.72, (0.0, 0.0, 0.25), size=0.85, dur=0.75)


def s6a_char(t):
    P = base(SPOT[0] + 0.55, SPOT[1] - 0.15, -25.0, blink_seed=21)
    P['face'] = dict(wide=0.6, browUp=0.7, open=0.2, oh=0.4)
    P['look_at'] = (0.0, 0.0, 0.4)
    return P


SHOTS.append(Shot('S6a', 17.68, 18.42,
                  CamShot(Keys((17.68, (0.55, -2.10, 1.05)), (18.42, (0.50, -1.95, 1.00))),
                          (0.05, 0.05, 0.40), 32, fstop=4.0),
                  s6a_char, s6a_props, None))


def s6b_char(t):
    P = base(-0.66, -0.10, 90.0, blink_seed=23, face=dict(squint=0.6, browAngry=0.6, grimace=0.6))
    P['hip'] = (0, 0.05, -0.33)
    P['hip_rot'] = (20, 0, 0)
    P['spine'] = (18, 0, 0)
    P['kneeL'] = (0.2, -0.8, 0.5); P['kneeR'] = (-0.2, -0.8, 0.5)
    ph = ((t - 18.42) / 0.16) % 1.0
    hz = 0.56 + 0.10 * (1 - abs(math.sin(math.pi * ph)))
    P['handR'] = world_hand((-0.26, -0.20, hz), aim=((0.3, 0, -1), (0, -1, 0)))
    P['shapeR'] = 'fist'
    P['handL'] = world_hand((-0.26, 0.12, 0.52), aim=((1, 0, -0.4), (0, 0, -1)))
    P['shapeL'] = 'open'
    P['look'] = (0.2, -0.7)
    return P


def s6b_props(t, char):
    r = ob('HammerRock')
    r.hide_render = False
    hR = char.sk.world('hand.R')
    r.matrix_world = hR @ Matrix.Translation((0.0, 0.07, 0.035))
    ph = ((t - 18.42) / 0.16) % 1.0
    if ph < 0.15:
        splash_dust = True


SHOTS.append(Shot('S6b', 18.42, 19.32,
                  CamShot(Keys((18.42, (-0.10, -0.80, 0.86)), (19.32, (-0.12, -0.74, 0.84))),
                          (-0.30, -0.05, 0.56), 30, fstop=2.2, focus=(-0.27, -0.06, 0.54),
                          shakes=tuple((18.42 + 0.16 * k, 0.006, 0.08, 18.0) for k in range(6))),
                  s6b_char, s6b_props, None))


def s6c_char(t):
    # turns, sits down on the seat (19.40-19.85), wiggles, thumbs up on "Much better!" (20.16)
    sit = ease(clamp01((t - 19.40) / 0.45), 'back')
    P = base(0.0, 0.08 * (1 - sit) + 0.02, 0.0, blink_seed=25)
    P['hip'] = (0.03 * math.sin((t - 19.85) * 25) * (19.85 < t < 20.15), 0.06 * sit, -0.43 * sit)
    P['hip_rot'] = (-6 * sit, 0, 0)
    P['footL'] = (0.07, -0.30 * sit, 0, -8); P['footR'] = (-0.07, -0.30 * sit, 0, 8)
    P['kneeL'] = (0.14, -1.0, 0.50); P['kneeR'] = (-0.14, -1.0, 0.50)
    P['spine'] = (4 * sit, 0, 0)
    happy = smooth((t - 19.9) / 0.25)
    P['face'] = A._lerp(dict(smile=0.3), dict(smile=1.0, cheek=1.0, squint=0.6, browUp=0.4, blinkL=0.45, blinkR=0.45), happy)
    P['head'] = (-4 * happy, 0, 4 * math.sin((t - 19.9) * 6) * happy)
    up = ease(clamp01((t - 20.14) / 0.2), 'back')
    if up > 0:
        P['handR'] = (-0.18, -0.36 * up - 0.1, 0.70 + 0.30 * up)
        P['aimR'] = ((0.0, -0.3, 0.25), (1.0, 0.0, 0.0))
        P['shapeR'] = ('relaxed', 'thumbsup', up)
        P['elbowR'] = (-0.55, 0.0, 0.70)
    P['handL'] = (0.22, -0.22, 0.58)
    P['shapeL'] = 'relaxed'
    P['look_at'] = tuple(cam_pt(t)) if t > 20.0 else None
    return P


def s6c_ov(t):
    out = []
    if 20.20 <= t <= 20.95:
        out.append(dict(type='sparkle', world=(-0.20, -0.45, 1.05), age=t - 20.20, dur=0.7, size=0.10))
    return out


SHOTS.append(Shot('S6c', 19.32, 21.26,
                  CamShot(Keys((19.32, (0.35, -2.30, 1.05)), (21.26, (0.30, -2.00, 1.02))),
                          (0.0, 0.0, 0.80), 34, fstop=3.2, focus=(0.0, 0.0, 1.05)),
                  s6c_char, None, s6c_ov))


# ================================================================== SCENE 7: smell again, pour water
def s7a_char(t):
    P = base(SPOT[0], SPOT[1], 0.0, blink_seed=27)
    pinch = ease(clamp01((t - 22.25) / 0.25), 'back')
    frown = smooth((t - 21.70) / 0.3)
    P['face'] = A._lerp(dict(smile=0.4), dict(browAngry=0.8, squint=0.6, grimace=0.7, sneer=0.8), frown)
    P['look'] = (0.0, -0.6)
    P['head'] = (6 * frown, 0, 0)
    if pinch > 0:
        hold = head_rel((-0.012, -0.080, 0.175), aim=((0.1, 0.9, 0.4), (0.9, 0, -0.3)))
        P['handR'] = hold if pinch > 0.98 else _blend_hand(None, hold, pinch)
        P['shapeR'] = ('relaxed', 'pinch', pinch)
        P['elbowR'] = (-0.5, -0.25, 1.15)
    return P


def s7a_props(t, char):
    FX.stink_update(t, 21.30, 23.3, (0.0, 0.0, SEAT_TOP), height=0.85)


SHOTS.append(Shot('S7a', 21.26, 23.20,
                  CamShot(Keys((21.26, (0.65, -2.0, 1.25)), (23.2, (0.55, -1.8, 1.25))),
                          (0.0, 0.3, 1.0), 30, fstop=3.2, focus=(0.0, 0.55, 1.35)),
                  s7a_char, s7a_props, None))


def bowl_path(t):
    """bowl world matrix: slab -> above the seat -> tilt to pour."""
    rest = PARTS['bowl_rest']
    p_rest = rest.to_translation()
    p_up = p_rest + Vector((0.1, -0.2, 0.45))
    p_pour = Vector((0.05, 0.28, 0.98))
    lift = ease(clamp01((t - 23.25) / 0.35), 'antic')
    move = ease(clamp01((t - 23.55) / 0.40))
    tilt = ease(clamp01((t - 23.85) / 0.35)) * 70
    p = p_rest.lerp(p_up, lift).lerp(p_pour, move)
    R = Matrix.Rotation(math.radians(tilt), 4, 'X')
    return Matrix.Translation(p) @ R, tilt


def s7b_char(t):
    turn = Keys((23.2, -35.0), (23.55, -35.0), (23.95, 0.0))(t)
    P = base(-0.25, 0.70, turn, blink_seed=29)
    M, tilt = bowl_path(t)
    c = M.to_translation()
    x_ax = M.to_3x3() @ Vector((1, 0, 0))
    P['handL'] = world_hand(c + x_ax * 0.21 + Vector((0, 0, 0.04)), aim=(tuple(-x_ax + Vector((0, 0, 0.4))), (0, 0, -1)))
    P['handR'] = world_hand(c - x_ax * 0.21 + Vector((0, 0, 0.04)), aim=(tuple(x_ax + Vector((0, 0, 0.4))), (0, 0, -1)))
    P['shapeL'] = 'cup'; P['shapeR'] = 'cup'
    P['spine'] = (10 + 10 * smooth((t - 23.8) / 0.3), 0, 0)
    P['face'] = dict(smile=0.5, squint=0.3, browUp=0.2, open=0.15)
    P['look_at'] = (0.0, 0.0, 0.5)
    return P


def pour_fx(t, M, tilt, t_on, t_off):
    if tilt > 25 and t_on <= t <= t_off:
        lip = M @ Vector((0, -0.18, 0.11))
        stream('Stream', t, lip, (0.0, 0.0, SEAT_TOP + 0.02), 0.022, wobble=0.012)
        splash(t, t_on + 0.1, t_off, (0.0, 0.0, SEAT_TOP + 0.03), 120, speed=1.1, size=0.011, seed=7, up=1.2)


def s7b_props(t, char):
    b = ob('Bowl')
    M, tilt = bowl_path(t)
    b.matrix_world = M
    ob('Bowl_water').hide_render = tilt > 30
    pour_fx(t, M, tilt, 23.95, 25.3)
    FX.stink_update(t, 21.30, 25.0, (0.0, 0.0, SEAT_TOP), height=0.85, fade_out=24.3)


SHOTS.append(Shot('S7b', 23.20, 24.50,
                  CamShot(Keys((23.2, (0.70, -1.75, 1.25)), (24.5, (0.55, -1.60, 1.20))),
                          (-0.25, 0.35, 0.90), 30, fstop=3.2, focus=(-0.1, 0.4, 1.0)),
                  s7b_char, s7b_props, None))


def s7c_props(t, char):
    s7b_props(t, char)


def s7c_ov(t):
    out = []
    for k, (dx, dy, dz, t0) in enumerate(((0.10, 0.0, 0.85, 24.35), (-0.12, 0.05, 0.95, 24.48), (0.02, -0.05, 1.10, 24.62),
                                          (0.16, 0.05, 1.05, 24.80), (-0.05, 0.0, 0.75, 24.95))):
        if t0 <= t <= t0 + 0.6:
            out.append(dict(type='sparkle', world=(dx, dy, dz), age=t - t0, dur=0.6, size=0.07 + 0.02 * (k % 2)))
    return out


SHOTS.append(Shot('S7c', 24.50, 25.79,
                  CamShot(Keys((24.5, (0.30, -0.80, 0.98)), (25.79, (0.25, -0.70, 0.95))),
                          (0.0, 0.05, 0.60), 32, fstop=2.2, focus=(0.0, 0.0, 0.55)),
                  s7b_char, s7c_props, s7c_ov))


# ================================================================== SCENE 8: river + old back
RIVER_X = 6.0
WALK8 = Walk([(RIVER_X, 9.1), (RIVER_X - 0.05, 7.45)], 25.79, 27.95, step=0.30, lift=0.045, bob=0.035)


def yoke_world(char):
    M = char.sk.world('chest')
    return M @ Matrix.Translation((0.0, 0.205, -0.02)) @ Matrix.Rotation(math.radians(90), 4, 'Y')


def s8_char(t):
    p, h = WALK8.root(min(t, 27.95))
    feet = WALK8.feet(min(t, 27.95))
    bob, sway = WALK8.hip_bob(min(t, 27.95))
    wob = math.sin(t * 7.0) * 1.0
    P = base(p[0], p[1], h + 180.0 * 0 + 0.0, feetW=feet, blink_seed=31)
    P['root'] = (p[0], p[1], 180.0 + h - 180.0)
    P['hip'] = (sway, 0.03, bob - 0.06)
    P['spine'] = (22, 0, 4 * wob)
    P['chest'] = (16, 0, 3 * wob)
    P['neck'] = (-8, 0, 0)
    P['head'] = (-16, 0, -3 * wob)
    P['face'] = dict(squint=0.8, browAngry=0.5, grimace=0.9, blinkL=0.45, blinkR=0.45, sneer=0.4)
    # hands hold the yoke pole near the shoulders
    for side, s in (('L', 1), ('R', -1)):
        P['hand' + side] = dict(space='chest', p=(s * 0.30, 0.24, 0.10), aim=((s * 0.2, 1.0, -0.2), (0, 0, -1)))
        P['shape' + side] = 'grip'
        P['elbow' + side] = (s * 0.55, -0.05, 0.9)
    if t >= 27.95:      # freeze, grab the lower back
        grab = ease(clamp01((t - 28.0) / 0.15), 'back')
        P['spine'] = (22 + 8 * grab, 0, 0)
        P['face'] = dict(blinkR=0.95, blinkL=0.5, squint=0.9, browSad=1.0, grimace=1.0, open=0.55)
        P['handR'] = dict(space='hips', p=(-0.13, 0.10, 0.10), aim=((0.2, 0.3, 1.0), (0, -1, 0)))
        P['shapeR'] = 'open'
        P['elbowR'] = (-0.6, 0.5, 1.0)
        P['head'] = (-30 * grab, 0, 0)
    return P


def s8_props(t, char):
    Y = yoke_world(char)
    y = ob('Yoke')
    y.hide_render = False
    y.matrix_world = Y @ Matrix.Translation((0, 0, -0.625))
    sway = math.sin(t * 7.0 + 0.6) * 0.12
    for nm, s in (('PotL', 1), ('PotR', -1)):
        pt = ob(nm)
        pt.hide_render = False
        end = Y @ Vector((0, 0, s * 0.56))
        pt.matrix_world = Matrix.Translation(end + Vector((0, 0, -0.42))) @ Matrix.Rotation(sway * s, 4, 'X')
    # sweat drops flying off the head
    sw = fxp('sweat')
    hp = char.sk.world('head') @ Vector((0, 0.10, 0.06))
    N = sw.n
    P = np.zeros((N, 3)); S = np.zeros(N)
    rng = np.random.RandomState(8)
    vis = False
    for i in range(N):
        tb = 25.9 + i * 0.22
        a = t - tb
        if 0 <= a < 0.5:
            v = np.array([rng.uniform(-0.8, 0.8), rng.uniform(-0.6, -0.1), rng.uniform(0.8, 1.4)])
            P[i] = FX.ballistic(np.array(hp), v, a)
            S[i] = 0.009
            vis = True
    sw.set(P, np.stack([S, S, S * 1.4], 1))
    sw.show(vis)


def s8_ov(t):
    out = []
    if 28.02 <= t <= 28.68:
        out.append(dict(type='pain', world=(RIVER_X + 0.05, 7.65, 0.98), age=t - 28.02, dur=0.66, size=0.22))
    return out


SHOTS.append(Shot('S8a', 25.79, 27.90,
                  CamShot(Keys((25.79, (RIVER_X + 0.9, 4.85, 1.10)), (27.9, (RIVER_X + 0.7, 5.25, 1.05))),
                          Keys((25.79, (RIVER_X, 8.6, 1.0)), (27.9, (RIVER_X, 7.6, 1.0))), 30, fstop=3.5,
                          focus=lambda t: (RIVER_X, WALK8.root(t)[0][1], 1.0)),
                  s8_char, s8_props, None))
SHOTS.append(Shot('S8b', 27.90, 28.68,
                  CamShot((RIVER_X + 0.55, 6.05, 1.05), (RIVER_X, 7.55, 1.0), 34, fstop=2.8,
                          focus=(RIVER_X, 7.5, 1.1), shakes=((28.02, 0.035, 0.5, 12.0),)),
                  s8_char, s8_props, s8_ov))


# ================================================================== SCENE 9: tank, explainer, pull
def s9a_props(t, char):
    poof(1, t, 28.70, (0.0, 0.0, 1.0), size=1.4, dur=0.8)


def s9a_char(t):
    P = base(SPOT[0] + 1.05, SPOT[1] - 0.6, -40.0, blink_seed=33)
    look_up = smooth((t - 29.2) / 0.3)
    P['face'] = dict(wide=0.8, browUp=0.9, open=0.3, oh=0.5)
    P['look'] = (0.0, 0.2 + 0.6 * look_up)
    P['head'] = (-12 * look_up, 0, 0)
    return P


SHOTS.append(Shot('S9a', 28.68, 30.00,
                  CamShot(Keys((28.68, (0.95, -3.4, 1.15)), (30.0, (0.85, -3.1, 1.25))),
                          (0.05, 0.0, 1.30), 26, fstop=5.6),
                  s9a_char, s9a_props, None))


def studio_props(t):
    O_ = bpy.data.objects
    tip = 0.0
    if t > 30.55:
        tip = 42 * ease(clamp01((t - 30.75) / 0.35), 'back')
    O_['S_Tank'].rotation_euler = (math.radians(-tip), 0, 0)
    pull = 0.20 * ease(clamp01((t - 30.45) / 0.3), 'out')
    O_['S_Rope'].location = (0, 0, -pull)
    # arrows: pull arrow points down beside the rope; flow arrow down along the stream; tip arrow
    a1 = O_['S_ArrowPull']
    a1.location = (0.30, -0.42, 1.55 - 0.1 * ease(clamp01((t - 30.45) / 0.3)))
    a1.rotation_euler = (math.radians(180), 0, 0)
    a1.scale = (1, 1, ease(clamp01((t - 30.35) / 0.2), 'back'))
    a2 = O_['S_ArrowFlow']
    a2.location = (-0.32, -0.30, 1.45)
    a2.rotation_euler = (math.radians(180), 0, 0)
    a2.scale = (1, 1, ease(clamp01((t - 31.05) / 0.2), 'back'))
    a3 = O_['S_ArrowTip']
    a3.location = (0.0, -0.58, 2.40)
    a3.rotation_euler = (math.radians(-110), 0, 0)
    a3.scale = (0.8, 0.8, ease(clamp01((t - 30.80) / 0.2), 'back') * 0.8)
    so = O_['S_Stream']
    if tip > 25:
        M = O_['S_Tank'].matrix_world
        lip = M @ Vector((0, -0.75, 0.42))
        pts = []
        for k in range(24):
            u = k / 23
            h = lip.lerp(Vector((0, 0, 0.46)), 1 - (1 - u) ** 2)
            pts.append((h.x, h.y, lip.z + (0.46 - lip.z) * u * u))
        so.hide_render = False
        FX.set_curve(so, pts, radius=1.0, radii=[0.03 + 0.03 * u for u in np.linspace(0, 1, 24)])
    else:
        so.hide_render = True
    O_['S_TankWater'].scale = (1, 1, max(0.05, 1 - 0.9 * clamp01((t - 31.0) / 0.6)))


def s9b_props(t, char):
    studio_props(t)
    cam = bpy.data.objects['S_Camera']


SHOTS.append(Shot('S9b', 30.00, 31.60,
                  CamShot(Keys((30.0, (0.95, -4.05, 1.60)), (31.6, (0.80, -3.55, 1.55))), (0.0, 0.0, 1.18), 50,
                          fstop=None),
                  None, s9b_props, None, scene='Studio'))


def s9c_char(t):
    pull = rope_pull(t)
    P = base(0.52, -0.74, -136.0, blink_seed=35)
    knot = Vector((0.13, -0.36, TANK_Z - 0.80 - pull))
    P['handL'] = world_hand(knot + Vector((0.0, 0.0, 0.17)), aim=((0, 0, 1), (0, 1, 0)))
    P['handR'] = world_hand(knot + Vector((0.0, 0.0, 0.03)), aim=((0, 0, 1), (0, 1, 0)))
    P['shapeL'] = 'grip'; P['shapeR'] = 'grip'
    P['elbowL'] = (0.5, 0.2, 0.9); P['elbowR'] = (-0.5, 0.2, 0.9)
    P['spine'] = (-6 + 14 * (pull / 0.22), 0, 0)
    P['hip'] = (0, -0.03 * pull / 0.22, -0.04 * pull / 0.22)
    P['face'] = dict(squint=0.5, browAngry=0.3, grimace=0.5)
    if t > 31.95:
        P['face'] = dict(smile=1.0, cheek=1.0, squint=0.6, browUp=0.5, open=0.4)
    P['look_at'] = (0.0, 0.0, 1.6)
    return P


def flush_fx(t, t_on, t_off, strength=1.0):
    if t_on <= t <= t_off:
        M = ob('Tank').matrix_world
        lip = M @ Vector((0, -0.40, 0.42))
        stream('Stream', t, lip, (0.0, -0.02, SEAT_TOP + 0.02), 0.035 * strength, wobble=0.02)
        splash(t, t_on + 0.15, t_off, (0.0, 0.0, SEAT_TOP + 0.03), int(160 * strength), speed=1.5 * strength,
               size=0.013, seed=11, up=1.3)


def s9c_props(t, char):
    flush_fx(t, 31.85, 32.65)


SHOTS.append(Shot('S9c', 31.60, 32.80,
                  CamShot(Keys((31.6, (1.75, -2.60, 1.45)), (32.8, (1.60, -2.40, 1.45))),
                          (0.15, -0.30, 1.25), 26, fstop=4.0),
                  s9c_char, s9c_props, None))


# ================================================================== SCENE 10: empty tank
def s10_char(t):
    P = s9c_char(t)
    look_up = smooth((t - 33.75) / 0.25)
    angry = smooth((t - 33.80) / 0.2)
    if t > 33.6:
        P['face'] = dict(browAngry=1.0, squint=0.55, grimace=0.7, sneer=0.5)
        P['head'] = (-30 * look_up, 0, 0)
        P['neck'] = (-10 * look_up, 0, 0)
        P['look'] = (0.0, 0.8 * look_up)
        P['look_at'] = None
        shake = 0.05 * math.sin((t - 33.85) * 2 * math.pi * 6) * angry
        P['handR'] = world_hand((0.50 + shake, -0.55, 1.62 + 0.1 * angry), aim=((0, 0.2, 1), (0, 1, 0)))
        P['shapeR'] = 'fist'
        P['handL'] = world_hand((0.13, -0.36, TANK_Z - 0.80 + 0.10), aim=((0, 0, 1), (0, 1, 0)))
    return P


def s10_props(t, char):
    # three sad drips from the tank lip
    d = fxp('drops')
    P = np.zeros((d.n, 3)); S = np.zeros(d.n)
    vis = False
    M = ob('Tank').matrix_world
    lip = M @ Vector((0, -0.40, 0.40))
    for k in range(3):
        tb = 33.10 + k * 0.22
        a = t - tb
        if 0 <= a <= 0.55:
            P[k] = (lip.x, lip.y, lip.z - 4.9 * a * a)
            S[k] = 0.014
            vis = True
    d.set(P, np.stack([S, S, S * 1.6], 1))
    d.show(vis)


SHOTS.append(Shot('S10a', 32.80, 33.70,
                  CamShot(Keys((32.8, (1.05, -1.55, 1.95)), (33.7, (0.98, -1.45, 1.95))),
                          (0.10, -0.40, 1.70), 30, fstop=3.2, focus=(0.05, -0.40, 1.95)),
                  s10_char, s10_props, None))
SHOTS.append(Shot('S10b', 33.70, 34.60,
                  CamShot(Keys((33.7, (1.30, -2.05, 1.05)), (34.6, (1.22, -1.92, 1.05))),
                          (0.42, -0.72, 1.55), 30, fstop=2.8, focus=(0.48, -0.78, 1.55),
                          shakes=((33.85, 0.01, 0.6, 9.0),)),
                  s10_char, None, None))


# ================================================================== SCENE 11: waterfall WHOOSH
def s11_char(t):
    P = base(0.52, -0.74, -136.0, blink_seed=37)
    pull = rope_pull(t)
    knot = Vector((0.13, -0.36, TANK_Z - 0.80 - pull))
    P['handL'] = world_hand(knot + Vector((0.0, 0.0, 0.17)), aim=((0, 0, 1), (0, 1, 0)))
    P['handR'] = world_hand(knot + Vector((0.0, 0.0, 0.03)), aim=((0, 0, 1), (0, 1, 0)))
    P['shapeL'] = 'grip'; P['shapeR'] = 'grip'
    P['elbowL'] = (0.5, 0.2, 0.9); P['elbowR'] = (-0.5, 0.2, 0.9)
    whoosh = smooth((t - 37.32) / 0.12) * (1 - smooth((t - 38.3) / 0.3))
    P['wind'] = (0.0, 26.0 * whoosh, 4.0 * whoosh)
    P['face'] = A._lerp(dict(smile=0.6, browUp=0.3), dict(smile=1.0, cheek=1.0, squint=0.9, browUp=0.6, open=0.85), whoosh)
    P['head'] = (-14 * whoosh, 0, 0)
    P['spine'] = (-8 * whoosh, 0, 0)
    P['hip'] = (0, 0.04 * whoosh, 0)
    P['look_at'] = (0.0, 0.0, 1.5)
    return P


def s11_props(t, char):
    # little poofs as pipe segments pop in
    segs = PARTS['pipe']
    k_poof = 0
    for k, seg in enumerate(segs):
        t_in = 36.30 + (len(segs) - 1 - k) * 0.062
        if t_in - 0.02 <= t <= t_in + 0.45 and k % 3 == 0:
            poof(k_poof % 5, t, t_in, tuple(seg.matrix_world.to_translation()), size=0.9, dur=0.45)
            k_poof += 1
    # huge blast of water
    if 37.30 <= t <= 38.55:
        flush_fx(t, 37.30, 38.55, strength=2.2)
        o = ob('Jet')
        o.hide_render = False
        a = segs[-1].matrix_world.to_translation() if segs else Vector((0, 0.45, 2.4))
        pts = [tuple(Vector(a).lerp(Vector((0.0, 0.0, TANK_Z + 0.4)), u)) for u in np.linspace(0, 1, 24)]
        FX.set_curve(o, pts, radius=1.0, radii=[0.06] * 24)
        splash(t, 37.30, 38.4, (0.0, -0.1, SEAT_TOP + 0.4), 260, speed=3.2, size=0.022, seed=19, spread=1.6, up=1.6)


def s11_ov(t):
    out = []
    if 37.30 <= t <= 38.1:
        out.append(dict(type='whoosh', x=0.5, y=0.45, age=t - 37.30, dur=0.8))
    return out


SHOTS.append(Shot('S11a', 34.60, 36.25,
                  CamShot(Keys((34.6, (0.9, -3.0, 1.55)), (36.25, (1.6, -14.5, 3.6), 'io')),
                          Keys((34.6, (0.0, 0.0, 1.3)), (36.25, (1.2, 14.0, 5.0), 'io')),
                          Keys((34.6, 28), (36.25, 24)), fstop=None),
                  s11_char, s11_props, None, reveal=True))
SHOTS.append(Shot('S11b', 36.25, 37.25,
                  CamShot(Keys((36.25, (10.5, 8.5, 2.6)), (37.25, (10.0, 8.0, 2.6))),
                          (0.6, 15.0, 4.6), 20, fstop=None),
                  s11_char, s11_props, None, reveal=True))
SHOTS.append(Shot('S11c', 37.25, 38.56,
                  CamShot(Keys((37.25, (1.85, -2.45, 1.35)), (38.56, (1.70, -2.25, 1.35))),
                          (0.25, -0.45, 1.45), 26, fstop=4.0,
                          shakes=((37.31, 0.07, 0.9, 11.0),)),
                  s11_char, s11_props, s11_ov, reveal=True))


# ================================================================== SCENE 12: congratulations
def s12_char(t):
    P = base(0.62, -0.95, 0.0, blink_seed=39)
    arms = ease(clamp01((t - 38.62) / 0.28), 'back')
    hop_t = t - 38.95
    hop = max(0.0, math.sin(hop_t * 2 * math.pi * 1.9)) * 0.07 if 38.95 < t < 41.9 else 0.0
    squash = -0.03 * max(0.0, -math.sin(hop_t * 2 * math.pi * 1.9)) if 38.95 < t < 41.9 else 0.0
    P['root_z'] = hop
    P['hip'] = (0, 0, squash)
    for side, s in (('L', 1), ('R', -1)):
        up = (s * 0.42, -0.08, 1.95 + 0.04 * math.sin(t * 12 + s))
        P['hand' + side] = tuple(Vector((s * 0.22, -0.05, 0.92)).lerp(Vector(up), arms))
        P['shape' + side] = ('relaxed', 'spread', arms)
        P['elbow' + side] = (s * 0.9, 0.2, 1.4)
        P['foot' + side] = (0, 0, hop * 0.3, 0)
    P['face'] = dict(smile=1.0, cheek=1.0, squint=0.8, browUp=0.6, open=0.8)
    P['head'] = (-12, 4 * math.sin(t * 7), 5 * math.sin(t * 5))
    P['spine'] = (-6, 0, 0)
    return P


def s12_props(t, char):
    c = fxp('confetti')
    N = c.n
    rng = np.random.RandomState(12)
    P = np.zeros((N, 3)); S = np.zeros((N, 3))
    vis = False
    t0 = 38.62
    for i in range(N):
        tb = t0 + (i % 3) * 0.25
        a = t - tb
        if a < 0:
            continue
        v = np.array([rng.normal(0, 1.1), rng.normal(-0.2, 0.6), rng.uniform(3.5, 6.0)])
        p = np.array([0.6, -0.6, 1.2]) + v * a + np.array([0, 0, -4.9]) * a * a
        if a > 0.6:      # flutter down slowly after the burst
            p = np.array([0.6, -0.6, 1.2]) + v * 0.6 + np.array([0, 0, -4.9]) * 0.36
            p[2] -= (a - 0.6) * 0.55
            p[0] += math.sin(a * 5 + i) * 0.1
            p += np.array([v[0], v[1], 0]) * (a - 0.6) * 0.15
        if p[2] < 0.01:
            p[2] = 0.01
        P[i] = p
        S[i] = (0.014, 0.014, 0.014)
        vis = True
    rot = FX.rot_matrices(rng.normal(0, 1, (N, 3)), rng.uniform(0, 6, N) + t * rng.uniform(4, 12, N))
    c.set(P, S, rot)
    c.show(vis)


def s12_ov(t):
    out = []
    for k in range(7):
        t0 = 38.65 + k * 0.33
        if t0 <= t <= t0 + 0.7:
            ang = k * 2.4
            out.append(dict(type='sparkle', world=(0.62 + 0.55 * math.cos(ang), -0.8, 1.3 + 0.45 * math.sin(ang)),
                            age=t - t0, dur=0.7, size=0.10))
    return out


SHOTS.append(Shot('S12a', 38.56, 42.39,
                  CamShot(Keys((38.56, (0.75, -4.3, 1.45)), (42.39, (0.70, -3.4, 1.42))),
                          (0.40, -0.4, 1.35), 28, fstop=4.5, focus=(0.62, -0.95, 1.4)),
                  s12_char, s12_props, s12_ov))


# ================================================================== SCENE 13: wink + thumbs up
def s13_char(t):
    P = base(0.62, -0.95, 0.0, blink_seed=41, autoblink=False)
    up = ease(clamp01((t - 42.50) / 0.25), 'back')
    P['handR'] = (-0.18, -0.40 * up - 0.05, 1.05 * up + 0.92 * (1 - up))
    P['aimR'] = ((0.0, -0.3, 0.25), (1.0, 0.0, 0.0)) if up > 0.3 else None
    P['shapeR'] = ('relaxed', 'thumbsup', up)
    P['elbowR'] = (-0.55, 0.0, 0.95)
    wink = smooth((t - 42.75) / 0.22) * (1 - smooth((t - 43.55) / 0.25))
    P['face'] = dict(smile=0.95, cheek=0.85, blinkL=wink, squint=0.3, browL=-0.5 * wink, browR=0.4)
    P['head'] = (-6, -4, -8 * wink)
    P['look_at'] = tuple(cam_pt(t))
    return P


def s13_ov(t):
    out = []
    if 42.78 <= t <= 43.5:
        out.append(dict(type='sparkle', world=(0.66, -0.98, 1.66), age=t - 42.78, dur=0.7, size=0.09))
    return out


def s13_props(t, char):
    ob('EyeLight').data.energy = 2.0
    ob('EyeLight').location = (0.75, -1.9, 1.75)


SHOTS.append(Shot('S13a', 42.39, END_T + 0.1,
                  CamShot(Keys((42.39, (0.70, -2.35, 1.52)), (END_T, (0.69, -2.12, 1.52))),
                          (0.60, -0.95, 1.42), 45, fstop=2.4, focus=(0.62, -1.02, 1.58)),
                  s13_char, s13_props, s13_ov))
