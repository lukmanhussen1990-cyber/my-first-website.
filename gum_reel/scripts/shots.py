"""All shots of the reel. Times are global seconds (synced to voiceover word timings)."""
import math
import numpy as np
import bpy
from mathutils import Vector, Matrix, Euler, Quaternion
from anim import Perf, ease, FPS, smooth_noise
from geo import tube, merge
from propgeo import wilt_flower_geo, set_mesh, strand

class _ObjProxy:
    def __getitem__(self, k):
        return bpy.data.objects[k]


O = _ObjProxy()
MAIN = (0.0, 0.12, 0.0)


class Shot:
    def __init__(s, name, t0, t1, colls=(), char=MAIN, fur=1.0, fstop=2.8, sun=2.6, sky=0.7, nograss=False):
        s.name, s.t0, s.t1, s.colls, s.char, s.fur, s.fstop = name, t0, t1, set(colls), char, fur, fstop
        s.sun, s.sky, s.nograss = sun, sky, nograss
        s.p = Perf()
        s.camkeys = Perf()
        s.shakes = []
        s.props = s.ik = s.focus = s.points = s.track = None
        s.fx, s.sfx = [], []

    def cam(s, t, eye, tgt, lens, e='io', roll=0.0):
        s.camkeys.key(t, e, eye=eye, tgt=tgt, lens=lens, roll=roll)

    def shake(s, t, dur=0.35, amp=1.0, freq=18.0):
        s.shakes.append((t, dur, amp, freq))

    def add_fx(s, kind, t0, t1, **kw):
        s.fx.append(dict(kind=kind, t0=t0, t1=t1, **kw))

    def add_sfx(s, t, name, **kw):
        s.sfx.append(dict(t=t, name=name, **kw))


def focus(name, off=(0, 0, 0)):
    return lambda ctx, t: ctx.ch.anchor(name) + Vector(off)


def W(ctx, local, char=MAIN, rz=0.0):
    """character-local -> world for a character placed at char."""
    c, s_ = math.cos(math.radians(rz)), math.sin(math.radians(rz))
    x, y, z = local
    return Vector((char[0] + c * x - s_ * y, char[1] + s_ * x + c * y, z))


def lerp(a, b, u):
    return a + (b - a) * u


def u_(t, t0, t1, kind='io'):
    return ease(kind, (t - t0) / max(t1 - t0, 1e-6))


def mat_from(loc, fwd, up=(0, 0, 1)):
    f = Vector(fwd).normalized()
    u = Vector(up)
    x = f.cross(u)
    if x.length < 1e-6:
        x = f.cross(Vector((1, 0, 0)))
    x.normalize()
    z = x.cross(f)
    m = Matrix((x, f, z)).transposed().to_4x4()
    m.translation = Vector(loc)
    return m


# ---------------------------------------------------------------- props helpers
def bird_pose(k, pos, yaw=0.0, pitch=0.0, roll=0.0, flap=0.0, scale=1.0, show=True):
    names = ['body', 'belly', 'beak', 'eye0', 'eye1', 'pupil0', 'pupil1', 'tail', 'wing0', 'wing1']
    R = (Euler((math.radians(pitch), math.radians(roll), math.radians(yaw)), 'YXZ').to_matrix()).to_4x4()
    B = Matrix.Translation(Vector(pos)) @ R @ Matrix.Scale(scale, 4)
    for n in names:
        o = O[f'bird{k}_{n}']
        o.hide_render = not show
        if n.startswith('wing'):
            sx = -1 if n == 'wing0' else 1
            o.matrix_world = B @ Matrix.Rotation(math.radians(sx * flap), 4, 'Y')
        else:
            o.matrix_world = B


def wilt(ctx, bend, droop, color):
    specs = ctx.P['wilt']
    for sp in specs:
        i = sp['i']; base = np.array(sp['base'])
        b = np.clip(bend * (0.8 + 0.08 * i), 0, 1)
        (Vs, Fs), (Vf, Ff), (Vc, Fc) = wilt_flower_geo(sp['h'], b, i, droop, lean_dir=(np.cos(i * 1.7 + 2.5), np.sin(i * 1.7 + 2.5)))
        set_mesh(O[f'wilt{i}_stem'], Vs + base, Fs)
        set_mesh(O[f'wilt{i}_petals'], Vf + base, Ff)
        set_mesh(O[f'wilt{i}_center'], Vc + base, Fc)
        O[f'wilt{i}_petals'].color = (*color, 1)
        O[f'wilt{i}_center'].color = (*[0.6 + 0.4 * c for c in color], 1)
        O[f'wilt{i}_stem'].color = (*[0.7 + 0.3 * c for c in color], 1)


def flames(ctx, t):
    fx_, fy_ = ctx.L['fire']
    for k in range(5):
        o = O[f'flame{k}']
        a = 2 * np.pi * k / 5
        n1 = smooth_noise(t * 3, k * 2.1, 1.3)
        o.scale = (0.9 + 0.2 * n1, 0.9 + 0.2 * n1, 0.85 + 0.45 * (0.5 + 0.5 * smooth_noise(t * 4, k * 1.3, 1.7)))
        o.rotation_euler = (0.15 * smooth_noise(t, k, 2.0), 0.15 * smooth_noise(t, k + 9, 2.2), 0)
    O['firelight'].data.energy = 22 + 8 * smooth_noise(t * 3, 0.5, 2.0)


def pot_bubbles(ctx, t, rate=1.0):
    fx_, fy_ = ctx.L['fire']
    rng = np.random.default_rng(3)
    for k in range(6):
        o = O[f'bubble_s{k}']
        per = 0.55 + 0.2 * k / 6
        ph = (t * rate / per + k * 0.37) % 1.0
        r_ = 0.035 + 0.09 * ((k * 0.618) % 1)
        a = k * 2.4 + math.floor(t * rate / per + k * 0.37) * 1.7
        o.location = (fx_ + r_ * math.cos(a), fy_ + r_ * math.sin(a), 0.2 + 0.175)
        s = 0.4 + 0.9 * math.sin(ph * math.pi)
        o.scale = (s, s, s * 0.8)
        o.hide_render = False


def gum_ball_rest(ctx):
    pass


# ---------------------------------------------------------------- the shots
def build_all(ctx):
    S = {}

    def add(sh):
        S[sh.name] = sh
        return sh

    # ============================================================ SCENE 1  "Your mouth smells like SHIT!"
    s = add(Shot('s01a', 0.0, 1.05, colls=('wilt',), fur=1.0, fstop=2.0))
    p = s.p
    p.key(0.0, head=(2, 0, 0), smile=0.25, autoblink=0.0, look=(0, 2))
    p.key(0.14, 'io', head=(7, 0, 2), chest=(3, 0, 0), jaw=1.5, blink=0.35, smile=0.0)          # anticipation
    p.key(0.5, 'o', head=(-17, 0, -3), chest=(-7, 0, 0), jaw=27, wide=1.0, O=0.25, blink=1.0, brow=0.9)
    p.key(1.05, 'io', head=(-19, 0, -5), chest=(-8, 0, 0), jaw=29, wide=1.0, O=0.2, blink=1.0, brow=1.0)
    s.cam(0.0, (0.06, -0.50, 1.63), (0.0, 0.09, 1.69), 46)
    s.cam(1.05, (0.05, -0.43, 1.645), (0.0, 0.09, 1.70), 50)
    s.focus = focus('face')
    s.add_fx('stink', 0.3, 2.32, anchor='mouth', strength=1.0)
    s.add_sfx(0.42, 'tuba')

    def props(ctx, t):
        wilt(ctx, 0.0, 0.0, (1, 1, 1))
    s.props = props

    s = add(Shot('s01b', 1.05, 2.32, colls=('wilt', 'birds'), fur=0.7, fstop=2.8))
    p = s.p
    p.key(1.05, head=(-16, 0, -4), chest=(-7, 0, 0), jaw=27, wide=1.0, blink=1.0, brow=0.9, autoblink=0.0,
          armL=(0, -18, 10), armR=(0, 18, -10), elbowL=70, elbowR=70, clavL=(0, -8, 0), clavR=(0, 8, 0))
    p.key(1.5, 'io', head=(3, 0, 0), chest=(0, 0, 0), jaw=2, wide=0.0, blink=0.0, brow=0.2, smile=0.7, squint=0.6,
          armL=(0, 44, 5), armR=(0, -44, -5), elbowL=14, elbowR=14, clavL=(0, 0, 0), clavR=(0, 0, 0))
    p.key(1.55, chew=0.0, autoblink=1.0)
    p.key(1.7, chew=0.45, chew_rate=3.0, chew_open=4)
    p.key(2.05, chew=0.0)
    p.key(2.32, smile=0.8, head=(2, 0, 4))
    s.cam(1.05, (-0.5, -2.25, 1.25), (-0.18, 0.05, 1.3), 30)
    s.cam(1.25, (-0.5, -2.25, 1.25), (-0.18, 0.05, 1.3), 30)
    s.cam(1.42, (-0.36, -1.6, 1.4), (-0.1, 0.06, 1.48), 37, e='o')
    s.cam(2.32, (-0.35, -1.55, 1.41), (-0.09, 0.06, 1.49), 38)
    s.shake(1.27, 0.45, 1.6)
    s.focus = focus('head')
    s.add_fx('poop', 1.3, 2.32, anchor='head', dx=0.2, dy=-0.03)
    s.add_fx('dizzy', 1.95, 2.32, anchor='bird0')
    s.add_sfx(1.27, 'scratch')
    s.add_sfx(1.33, 'faint')
    s.add_sfx(1.93, 'thud')

    def props(ctx, t):
        u = u_(t, 1.15, 1.85)
        wilt(ctx, u, u, (lerp(1, 0.55, u), lerp(1, 0.4, u), lerp(1, 0.25, u)))
        # bird: flies in, faints in the cloud, drops
        if t < 1.33:
            v = (t - 1.05) / 0.28
            pos = Vector((lerp(1.3, 0.05, v), lerp(0.2, 0.1, v), lerp(2.12, 2.02, v) + 0.03 * math.sin(t * 20)))
            bird_pose(0, pos, yaw=-90, pitch=0, flap=55 * math.sin(t * 2 * math.pi * 7), scale=1.6)
            ctx.state['bird0'] = pos
        else:
            v = min((t - 1.33) / 0.6, 1.0)
            p0 = Vector((0.05, 0.1, 2.02)); p1 = Vector((-0.62, 0.15, 0.04))
            pos = p0.lerp(p1, v)
            pos.z = p0.z + (p1.z - p0.z) * v * v + 0.15 * math.sin(v * math.pi) * (1 - v)
            if t > 1.93:
                pos = p1 + Vector((0, 0, 0.06 * abs(math.sin((t - 1.93) * 18)) * math.exp(-(t - 1.93) * 8)))
            bird_pose(0, pos, yaw=-90 + 300 * v, pitch=180 * min(v * 1.5, 1), roll=40, flap=-20, scale=1.6)
            ctx.state['bird0'] = pos
    s.props = props
    s.points = lambda ctx, t: {'bird0': ctx.state.get('bird0', Vector((0, 0, 2)))}

    # ============================================================ SCENE 2  genius + mint
    s = add(Shot('s02a', 2.32, 3.75, fur=0.85, fstop=2.4))
    p = s.p
    p.key(2.32, smile=0.6, squint=0.3, head=(2, 0, 4))
    p.key(2.44, 'io', head=(6, 0, 0), chest=(3, 0, 0), smile=0.5)                                   # dip
    p.key(2.72, 'back', ikR=1.0, curlR=1.0, indexR=0.0, thumbR=0.6, head=(-4, -6, -6), chest=(-6, 0, 0),
          smile=1.0, squint=0.5, brow=0.7, look=(4, -2))
    p.key(3.3, head=(-5, -7, -8), smile=1.0, brow=0.8)
    p.key(3.42, winkL=0.0)
    p.key(3.5, winkL=1.0)
    p.key(3.62, winkL=0.0)
    p.key(3.75, head=(-4, -6, -6), ikR=1.0)
    p.key(2.32, ikR=0.0, curlR=0.25, indexR=0.25)
    s.cam(2.32, (-0.32, -1.40, 1.43), (-0.06, 0.1, 1.58), 36)
    s.cam(3.75, (-0.28, -1.30, 1.45), (-0.06, 0.1, 1.6), 40)
    s.focus = focus('head')

    def ik(ctx, side, t, pos):
        if side != 'R':
            return pos
        temple = ctx.ch.point('head', (-0.083, -0.045, 1.775))
        fwd = Vector((0.45, 0.12, 0.9)).normalized()
        tap = 0.0
        for tt in (2.86, 3.06):
            d = t - tt
            if -0.08 < d < 0.08:
                tap = max(tap, math.cos(d / 0.08 * math.pi / 2))
        return temple + Vector((-0.018, -0.01, 0.0)) - fwd * (0.118 - 0.012 * tap)
    s.ik = ik
    s.p.key(2.32, ikfwdR=(0.45, 0.12, 0.9), ikpalmR=(0.3, -0.9, -0.2), poleR=(-0.55, 0.2, 1.05))
    s.add_fx('sparkle', 2.86, 3.4, anchor='index_tipR', size=1.2)
    s.add_sfx(2.9, 'ding')

    s = add(Shot('s02b', 3.75, 4.75, colls=('mint',), fur=0.7, fstop=2.8))
    p = s.p
    p.key(3.75, head=(-2, 0, 0), smile=0.6, look=(0, 0))
    p.key(4.0, 'io', spine=(6, 0, 12), chest=(4, 0, 18), head=(14, 0, 24), look=(10, 14), smile=0.4,
          ikL=1.0, curlL=0.0, indexL=0.0, thumbL=0.0)
    p.key(4.18, curlL=0.05, indexL=0.05)
    p.key(4.3, 'o', curlL=0.95, indexL=0.95, thumbL=0.7)
    p.key(4.75, spine=(2, 0, 4), chest=(0, 0, 6), head=(0, 0, 8), look=(0, 0), smile=0.8, squint=0.4)
    p.key(3.75, ikL=0.0)
    p.key(3.75, ikposL=(0.35, -0.15, 0.95), ikfwdL=(0.2, -0.6, -0.75), ikpalmL=(0.3, -0.4, 0.6), poleL=(0.6, 0.3, 1.1))
    p.key(4.15, 'io', ikposL=(0.47, -0.27, 0.86), ikfwdL=(0.3, -0.5, -0.8), ikpalmL=(0.5, -0.3, 0.6))
    p.key(4.3, ikposL=(0.47, -0.27, 0.84))
    p.key(4.75, 'io', ikposL=(0.2, -0.32, 1.32), ikfwdL=(-0.3, -0.4, 0.85), ikpalmL=(-0.7, 0.3, 0.1), poleL=(0.55, 0.1, 1.0))
    s.cam(3.75, (1.25, -1.7, 1.38), (0.36, -0.1, 1.2), 29)
    s.cam(4.75, (1.2, -1.6, 1.42), (0.32, -0.08, 1.26), 31)
    s.focus = focus('palmL')
    s.add_sfx(4.25, 'rustle')

    def props(ctx, t):
        show = t >= 4.27
        ctx.show('mint_handful', show)
        ctx.show('mint_pinch', False)
        if show:
            ctx.attach('mint_handful', 'L', Matrix.Translation((0.0, -0.02, 0.0)))
        w = math.exp(-max(t - 4.27, 0) * 6) * (1 if t > 4.27 else 0)
        rot = (0.06 * w * math.sin(t * 40), 0.05 * w * math.sin(t * 33), 0)
        mx, my = ctx.L['mint']
        for n in ('mint_leaves', 'mint_core'):
            o = O[n]
            o.matrix_world = Matrix.Translation((mx, my, 0.3)) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Translation((-mx, -my, -0.3))
    s.props = props

    s = add(Shot('s02c', 4.75, 5.88, colls=('mint',), fur=1.0, fstop=2.0))
    p = s.p
    p.key(4.75, ikL=1.0, curlL=0.95, indexL=0.95, thumbL=0.7, smile=0.6, head=(0, 0, 8), jaw=0)
    p.key(4.88, 'o', jaw=16, O=0.5, lidwide=0.4, brow=0.6, smile=0.0, head=(-6, 0, 6))
    p.key(5.04, 'io', jaw=14)
    p.key(5.1, 'o', jaw=2, O=0.0, lidwide=0.0, brow=0.2, head=(0, 0, 4))
    p.key(5.4, 'io', ikL=0.0, curlL=0.3, indexL=0.3, thumbL=0.1)
    p.key(5.1, chew=0.0, puff=0.0)
    p.key(5.18, chew=1.0, chew_rate=3.2, chew_open=10, squint=0.7, smile=0.35, puff=0.4)
    p.key(5.88, chew=1.0, squint=0.8, smile=0.45, head=(2, 0, 2))

    def ik(ctx, side, t, pos):
        if side != 'L':
            return pos
        m = ctx.ch.anchor('mouth')
        u = u_(t, 4.88, 5.04)
        off = Vector((0.05, -0.085, -0.035)).lerp(Vector((0.02, -0.055, -0.012)), u)
        if t > 5.06:
            off = off.lerp(Vector((0.12, -0.12, -0.25)), u_(t, 5.06, 5.4))
        return m + off
    s.ik = ik
    p.key(4.75, ikfwdL=(-0.35, -0.2, 0.9), ikpalmL=(-0.3, 0.9, 0.1), poleL=(0.5, 0.0, 1.05))
    s.cam(4.75, (0.16, -0.50, 1.63), (0.0, 0.09, 1.66), 44)
    s.cam(5.88, (0.14, -0.46, 1.64), (0.0, 0.09, 1.67), 47)
    s.focus = focus('face')
    for tt in np.arange(5.2, 5.88, 1 / 3.2):
        s.add_sfx(float(tt), 'crunch')

    def props(ctx, t):
        ctx.show('mint_handful', t < 5.03)
        if t < 5.03:
            ctx.attach('mint_handful', 'L', Matrix.Translation((0.0, -0.02, 0.0)))
        sh = 5.03 <= t < 5.55
        ctx.show('mint_pinch', sh)
        if sh:
            ctx.on_bone('mint_pinch', 'jaw', (0.018, -0.118, 1.652), rot=(0, 30, -20), scale=1.0 - 0.8 * u_(t, 5.2, 5.55))
    s.props = props

    # ============================================================ SCENE 3  juice drips down the beard
    DROP_PATHS = []
    for k, (sx, t0, spd) in enumerate([(1, 6.02, 0.9), (-1, 6.12, 1.0), (1, 6.3, 0.8), (-1, 6.45, 0.95), (1, 6.62, 1.1), (-1, 6.8, 0.85), (1, 6.95, 1.0), (-1, 7.05, 0.9)]):
        x0 = sx * (0.018 + 0.006 * (k % 3))
        DROP_PATHS.append(dict(t0=t0, spd=spd, pts=[('jaw', (x0, -0.12, 1.648)), ('jaw', (x0 * 1.1, -0.132, 1.618)),
                                                   ('beard_tip', (x0 * 1.25, -0.152, 1.565)), ('beard_tip', (x0 * 1.3, -0.163, 1.51)),
                                                   ('beard_tip', (x0 * 1.2, -0.158, 1.46)), ('beard_tip', (x0 * 1.0, -0.14, 1.41))]))

    def drops(ctx, t):
        for k, d in enumerate(DROP_PATHS):
            o = O[f'drop{k}']
            if t < d['t0']:
                o.hide_render = True
                continue
            o.hide_render = False
            u = min(((t - d['t0']) * d['spd']) ** 1.6, 1.0) * (len(d['pts']) - 1)
            i = min(int(u), len(d['pts']) - 2)
            f = u - i
            a = ctx.ch.point(*d['pts'][i]); b = ctx.ch.point(*d['pts'][i + 1])
            pos = a.lerp(b, f)
            st = 1.0 + 0.6 * min(u, 1.5)
            o.matrix_world = Matrix.Translation(pos) @ Matrix.Diagonal((1, 1, st, 1))
        sm = 0.0
        o = O['juice_smear']
        o.hide_render = True
        if sm > 0.01:
            ctx.on_bone('juice_smear', 'beard_tip', (0.0, -0.163, 1.545), scale=(0.25 + 0.6 * sm, 0.6 + 2.6 * sm, 0.14))

    s = add(Shot('s03a', 5.88, 7.15, colls=('juice',), fur=1.0, fstop=2.0))
    p = s.p
    p.key(5.88, chew=1.0, chew_rate=2.8, chew_open=9, squint=0.7, smile=0.4, head=(2, 0, 2))
    p.key(6.6, chew=0.8, smile=0.3)
    p.key(6.95, 'io', chew=0.25, smile=0.0, squint=0.0, look=(0, 6), brow=0.2)
    p.key(7.15, chew=0.0, look=(0, 14), head=(6, 0, 0))
    s.cam(5.88, (0.10, -0.47, 1.6), (0.0, 0.10, 1.635), 37)
    s.cam(7.15, (0.09, -0.45, 1.6), (0.0, 0.10, 1.63), 40)
    s.focus = focus('chin')
    s.props = drops
    for tt in (6.05, 6.32, 6.6, 6.85):
        s.add_sfx(tt, 'drip')

    s = add(Shot('s03b', 7.15, 8.45, colls=('juice',), fur=1.0, fstop=2.2))
    p = s.p
    p.key(7.15, head=(8, 0, 0), look=(0, 16), chew=0.0)
    p.key(7.45, 'io', head=(22, 0, 0), neck=(10, 0, 0), look=(0, 26), grimace=0.9, angry=0.7, squint=0.5,
          ikL=1.0, curlL=0.6, indexL=0.5)
    p.key(7.95, beard_rot=(-14, 0, 0), grimace=1.0)
    p.key(8.0, head=(20, 0, -7))
    p.key(8.1, head=(20, 0, 7))
    p.key(8.2, head=(21, 0, -5))
    p.key(8.3, head=(21, 0, 3), frown=0.4)
    p.key(8.45, head=(20, 0, 0))
    p.key(7.15, ikL=0.0, beard_rot=(0, 0, 0))
    p.key(7.15, ikfwdL=(-0.6, -0.3, 0.6), ikpalmL=(0, 0.3, 1.0), poleL=(0.55, 0.0, 1.0))

    def ik(ctx, side, t, pos):
        if side != 'L':
            return pos
        return ctx.ch.anchor('beard_low') + Vector((0.035, -0.04, -0.035))
    s.ik = ik
    s.cam(7.15, (-0.12, -0.60, 1.40), (0.0, 0.08, 1.58), 32)
    s.cam(8.45, (-0.10, -0.56, 1.42), (0.0, 0.08, 1.58), 34)
    s.focus = focus('beard')
    s.props = drops
    s.add_sfx(7.6, 'squish')
    s.add_fx('stinklines', 7.9, 8.45, anchor='beard', strength=0.5, color='green')

    # ============================================================ SCENE 4  tree sap
    SAPC = (2.18, 2.30, 0.0)
    SAP = Vector((2.535, 2.134, 1.315))

    s = add(Shot('s04a', 8.45, 9.25, colls=('sap',), char=SAPC, fur=0.75, fstop=2.8))
    p = s.p
    p.key(8.45, spine=(4, 0, 14), chest=(2, 0, 18), head=(4, 0, 24), look=(14, 4), ikL=1.0, curlL=0.85, indexL=0.85,
          thumbL=0.6, angry=0.35, grimace=0.3, ikfwdL=(0.95, 0.1, 0.2), ikpalmL=(0, 0.2, -1), poleL=(0.55, 0.3, 0.95))

    def scrape_ik(ctx, side, t, pos):
        if side != 'L':
            return pos
        ph = (t - 8.45) / 0.27
        k = ph % 1.0
        dz = 0.07 - 0.13 * ease('o', min(k / 0.55, 1)) if k < 0.55 else -0.06 + 0.13 * ease('io', (k - 0.55) / 0.45)
        return SAP + Vector((-0.13, -0.07, 0.02 + dz))
    s.ik = scrape_ik
    s.cam(8.45, (2.98, 1.2, 1.62), (2.34, 2.26, 1.46), 28)
    s.cam(9.25, (2.95, 1.26, 1.62), (2.35, 2.26, 1.47), 30)
    s.focus = lambda ctx, t: SAP + Vector((-0.1, 0, 0.05))
    for tt in (8.55, 8.82, 9.09):
        s.add_sfx(tt, 'scrape')

    def flint_props(ctx, t, lump=False):
        ctx.show('flint', True)
        ctx.attach('flint', 'L', Matrix.Translation((0.02, 0.0, 0.0)) @ Euler((0, 0, math.radians(0))).to_matrix().to_4x4())
        on = t > 8.9
        ctx.show('flint_sap', on)
        if on:
            m = ctx.ch.hand_matrix('L') @ Matrix.Translation((0.06, 0.012, 0.0))
            O['flint_sap'].matrix_world = m @ Matrix.Scale(min((t - 8.9) * 3 + 0.4, 1.2), 4)
    s.props = flint_props

    s = add(Shot('s04b', 9.25, 9.9, colls=('sap',), char=SAPC, fur=0.6, fstop=1.8))
    p = s.p
    p.key(9.25, spine=(4, 0, 14), chest=(2, 0, 18), head=(4, 0, 24), look=(14, 4), ikL=1.0, curlL=0.85, indexL=0.85,
          thumbL=0.6, ikfwdL=(0.95, 0.1, 0.2), ikpalmL=(0, 0.2, -1), poleL=(0.55, 0.3, 0.95), smile=0.5)

    def ik(ctx, side, t, pos):
        if side != 'L':
            return pos
        base = SAP + Vector((-0.13, -0.07, 0.02))
        if t < 9.45:
            return base + Vector((0, 0, 0.06 - 0.12 * ease('o', (t - 9.25) / 0.2)))
        return base + Vector((-0.06, -0.12, -0.06)).lerp(Vector((-0.25, -0.2, 0.25)), u_(t, 9.5, 9.9)) * u_(t, 9.45, 9.55)
    s.ik = ik
    s.cam(9.25, (2.41, 1.72, 1.39), (2.47, 2.1, 1.32), 37)
    s.cam(9.9, (2.4, 1.74, 1.41), (2.46, 2.1, 1.34), 35)
    s.focus = lambda ctx, t: SAP
    s.add_sfx(9.3, 'scrape')
    s.add_sfx(9.45, 'squish', vol=0.5)
    s.props = flint_props

    s = add(Shot('s04c', 9.9, 11.41, colls=('sap',), char=SAPC, fur=0.9, fstop=2.4))
    p = s.p
    p.key(9.9, spine=(2, 0, 6), chest=(0, 0, 8), head=(-2, 0, 10), ikL=1.0, curlL=0.85, indexL=0.85, thumbL=0.6,
          jaw=0, smile=0.3, ikfwdL=(-0.4, -0.3, 0.85), ikpalmL=(-0.4, 0.9, 0.0), poleL=(0.5, 0.0, 1.0))
    p.key(10.0, 'o', jaw=13, O=0.4, lidwide=0.3)
    p.key(10.08, 'io', jaw=1, O=0.0, lidwide=0.0)
    p.key(10.1, chew=0.0)
    p.key(10.16, chew=1.0, chew_rate=3.0, squint=0.5, smile=0.4)
    p.key(10.3, 'io', spine=(0, 0, 0), chest=(0, 0, 0), head=(0, 0, 2), curlL=1.0, indexL=1.0, thumbL=0.4)
    p.key(10.36, 'io', head=(4, 0, 0), chew=0.3)                      # anticipation
    p.key(10.55, 'back', thumbL=-1.0, smile=1.0, squint=0.6, brow=0.8, head=(-5, 5, 4), ikfwdL=(-0.2, -1.0, 0.05), ikpalmL=(-1.0, 0.0, 0.0))
    p.key(10.62, winkR=0.0)
    p.key(10.7, winkR=1.0)
    p.key(10.86, winkR=0.0)
    p.key(11.41, smile=1.0, head=(-5, 6, 5), chew=0.4)

    def ik(ctx, side, t, pos):
        if side != 'L':
            return pos
        m = ctx.ch.anchor('mouth')
        a = Vector((0.06, -0.09, -0.06)).lerp(Vector((0.03, -0.06, -0.035)), u_(t, 9.9, 10.02))
        if t > 10.05:
            a = a.lerp(Vector((0.16, -0.1, -0.32)), u_(t, 10.05, 10.36))
        up = ctx.rig.ob.matrix_world @ Vector((0.17, -0.42, 1.45))
        return (m + a).lerp(up, ease('back', (t - 10.36) / 0.2)) if t > 10.36 else m + a
    s.ik = ik
    s.cam(9.9, (2.48, 1.5, 1.58), (2.24, 2.22, 1.5), 30)
    s.cam(11.41, (2.46, 1.55, 1.58), (2.24, 2.22, 1.51), 33)
    s.focus = focus('face')
    s.add_fx('sparkle', 10.55, 11.2, anchor='thumb_tipL', size=1.4)
    s.add_sfx(10.56, 'ding')
    for tt in np.arange(10.2, 10.45, 1 / 3.0):
        s.add_sfx(float(tt), 'chew')

    def props(ctx, t):
        show_f = t < 10.3
        ctx.show('flint', show_f)
        if show_f:
            ctx.attach('flint', 'L', Matrix.Translation((0.02, 0.0, 0.0)))
        ctx.show('flint_sap', t < 10.02)
        if t < 10.02:
            m = ctx.ch.hand_matrix('L') @ Matrix.Translation((0.06, 0.012, 0.0))
            O['flint_sap'].matrix_world = m @ Matrix.Scale(1.2, 4)
    s.props = props

    # ============================================================ SCENE 5  stuck in the beard
    def sap_strings(ctx, t, pull_t0, grip_side='R', thick=1.0, sag=0.02):
        hand = ctx.ch.anchor('index_tip' + grip_side) * 0.5 + ctx.ch.anchor('thumb_tip' + grip_side) * 0.5
        m = ctx.ch.anchor('mouth')
        parts = []
        k = 0
        srcs = [('mouth', m + Vector((0.008, -0.004, 0.0))), ('mouth', m + Vector((-0.01, -0.004, -0.004)))]
        for bp in [(0.03, -0.165, 1.56), (-0.035, -0.162, 1.54), (0.0, -0.17, 1.5), (0.05, -0.15, 1.6), (-0.055, -0.15, 1.6)]:
            srcs.append(('beard', ctx.ch.point('beard_tip', bp)))
        for i, (kind, a) in enumerate(srcs):
            r0 = 0.0045 if kind == 'mouth' else 0.004
            V, F = strand(a, hand + Vector((0.004 * math.sin(i * 2.1), 0, 0.004 * math.cos(i * 1.7))), r0 * thick * 0.75, 0.003 * thick,
                          sag=(sag + 0.1) * (1 + 0.2 * i), n=20, k=7, wobble=0.008, t=t, seed=i)
            parts.append((V, F))
        V, F = merge(parts)
        set_mesh(O['sap_strings'], V, F)
        ctx.show('sap_strings', True)
        # glob in the fingers
        ctx.show('sap_lump', True)
        O['sap_lump'].matrix_world = Matrix.Translation(hand) @ Matrix.Scale(1.1, 4)

    s = add(Shot('s05a', 11.41, 12.7, colls=('sap',), char=SAPC, fur=0.9, fstop=2.4))
    p = s.p
    p.key(11.41, ikR=0.0, curlR=0.3, smile=0.6, chew=0.4, head=(0, 0, 0))
    p.key(11.62, 'io', ikR=1.0, curlR=0.75, indexR=0.6, thumbR=0.6, chew=0.0, jaw=5, smile=0.0)
    p.key(11.75, jaw=9, O=0.4)
    p.key(12.2, 'io', head=(8, 0, -6), grimace=0.6, angry=0.3, look=(-15, 8), jaw=5, O=0.0)
    p.key(12.3, 'o', head=(13, 0, -10), beard_stretch=0.55, beard_rot=(-10, 0, -8))
    p.key(12.45, 'io', head=(9, 0, -6), beard_stretch=0.2, beard_rot=(-4, 0, -3))
    p.key(12.55, 'o', head=(14, 0, -10), beard_stretch=0.7, beard_rot=(-12, 0, -9), grimace=0.9, angry=0.6)
    p.key(12.7, head=(12, 0, -8), beard_stretch=0.5)
    p.key(11.41, ikfwdR=(0.3, -0.5, 0.8), ikpalmR=(0.6, 0.7, 0.0), poleR=(-0.55, 0.1, 1.0))
    p.key(12.2, ikfwdR=(0.5, -0.6, 0.5), ikpalmR=(0.5, 0.4, -0.6))

    def ik5(ctx, side, t, pos):
        if side != 'R':
            return pos
        m = ctx.ch.anchor('mouth')
        a = Vector((-0.05, -0.08, -0.07)).lerp(Vector((-0.02, -0.05, -0.03)), u_(t, 11.41, 11.62))
        far = Vector((-0.22, -0.38, -0.2))
        pull = u_(t, 11.75, 12.2)
        tug = 0.06 * (math.exp(-((t - 12.3) / 0.07) ** 2) + math.exp(-((t - 12.55) / 0.07) ** 2))
        return m + a.lerp(far, pull) + Vector((-0.02, -tug, -tug * 0.3))
    s.ik = ik5
    s.cam(11.41, (2.33, 1.52, 1.56), (2.14, 2.2, 1.52), 33)
    s.cam(12.7, (2.32, 1.55, 1.56), (2.12, 2.18, 1.5), 35)
    s.focus = focus('chin')
    s.add_sfx(11.8, 'stretch', dur=0.4)
    s.add_sfx(12.3, 'squeak')
    s.add_sfx(12.55, 'squeak')

    def props(ctx, t):
        if t > 11.68:
            sap_strings(ctx, t, 11.68, thick=min((t - 11.68) * 4, 1.0) + 0.2)
        else:
            ctx.show('sap_strings', False)
            ctx.show('sap_lump', False)
    s.props = props

    s = add(Shot('s05b', 12.7, 13.55, colls=('sap',), char=SAPC, fur=1.0, fstop=2.2))
    p = s.p
    p.key(12.7, ikR=1.0, curlR=0.75, indexR=0.6, thumbR=0.6, head=(12, 0, -8), grimace=0.9, angry=0.6, look=(-15, 8),
          beard_stretch=0.5, beard_rot=(-12, 0, -9), jaw=4, ikfwdR=(0.5, -0.6, 0.5), ikpalmR=(0.5, 0.4, -0.6), poleR=(-0.55, 0.1, 1.0))
    for tt in (12.85, 13.15, 13.42):
        p.key(tt - 0.08, 'io', head=(9, 0, -5), beard_stretch=0.3, beard_rot=(-6, 0, -5), chest=(-3, 0, 0))
        p.key(tt + 0.05, 'o', head=(16, 0, -12), beard_stretch=0.95, beard_rot=(-16, 0, -12), chest=(4, 0, -4), grimace=1.0)
        p.key(tt + 0.18, 'back', head=(11, 0, -7), beard_stretch=0.45, beard_rot=(-9, 0, -6), chest=(0, 0, 0))
        s.add_sfx(tt, 'squeak', pitch=1.0 + 0.1 * (tt - 12.85))
    p.key(13.55, head=(11, 0, -6), beard_stretch=0.45)

    def ik(ctx, side, t, pos):
        if side != 'R':
            return pos
        m = ctx.ch.anchor('mouth')
        tug = sum(0.07 * math.exp(-((t - tt) / 0.08) ** 2) for tt in (12.88, 13.18, 13.45))
        return m + Vector((-0.22, -0.38, -0.2)) + Vector((-0.03, -tug, -tug * 0.4))
    s.ik = ik
    s.cam(12.7, (1.98, 1.66, 1.5), (2.12, 2.18, 1.53), 40)
    s.cam(13.55, (1.97, 1.68, 1.5), (2.12, 2.18, 1.53), 44)
    s.focus = focus('beard')
    s.props = lambda ctx, t: sap_strings(ctx, t, 11.68)
    s.add_fx('sweat', 12.9, 13.55, anchor='head_top', dx=-0.06, dy=0.03)

    s = add(Shot('s05c', 13.55, 14.61, colls=('sap',), char=SAPC, fur=1.0, fstop=2.0))
    p = s.p
    p.key(13.55, ikR=1.0, curlR=0.75, indexR=0.6, thumbR=0.6, head=(11, 0, -6), grimace=0.8, angry=0.5, beard_stretch=0.45,
          beard_rot=(-9, 0, -6), jaw=3, look=(-15, 8), ikfwdR=(0.5, -0.6, 0.5), ikpalmR=(0.5, 0.4, -0.6), poleR=(-0.55, 0.1, 1.0))
    p.key(13.75, 'io', grimace=0.0, angry=0.0, sad=1.0, frown=0.9, sleepy=0.45, look=(0, 2), head=(6, 0, 0), beard_stretch=0.15,
          beard_rot=(-3, 0, -2), chest=(5, 0, 0))
    p.key(14.61, sad=1.0, frown=1.0, sleepy=0.55, head=(8, -4, 0), chest=(7, 0, 0))

    def ik(ctx, side, t, pos):
        if side != 'R':
            return pos
        m = ctx.ch.anchor('mouth')
        return m + Vector((-0.22, -0.38, -0.2)).lerp(Vector((-0.18, -0.25, -0.45)), u_(t, 13.6, 14.3))
    s.ik = ik
    s.cam(13.55, (2.18, 1.56, 1.64), (2.18, 2.2, 1.63), 38)
    s.cam(14.61, (2.18, 1.6, 1.65), (2.18, 2.2, 1.66), 58)
    s.focus = focus('face')
    s.props = lambda ctx, t: sap_strings(ctx, t, 11.68, sag=0.02 + 0.05 * u_(t, 13.6, 14.3))
    s.add_sfx(13.62, 'sadboing')

    # ============================================================ SCENE 6  the kitchen
    KC = (-2.6, 2.6, 0.0)
    POT = Vector((-2.33, 2.12, 0.375))

    def kitchen_base(ctx, t):
        flames(ctx, t)
        pot_bubbles(ctx, t)

    def stick_props(ctx, t):
        grip = ctx.ch.anchor('palmL')
        base = POT + Vector((0.03 * math.cos(t * 9), 0.03 * math.sin(t * 9), 0.0))
        d = grip - base
        O['stick'].matrix_world = mat_from(base, d, up=(0, 1, 0)) @ Matrix.Rotation(math.radians(-90), 4, 'X')
        ctx.show('stick', True)

    s = add(Shot('s06a', 14.61, 15.55, colls=('kitchen',), char=KC, fur=0.6, fstop=3.2))
    p = s.p
    p.key(14.61, spine=(12, 0, 8), chest=(6, 0, 6), head=(16, 0, 8), look=(6, 14), smile=0.55, squint=0.3, ikL=1.0,
          curlL=0.9, indexL=0.9, thumbL=0.6, ikfwdL=(0.0, -0.3, -0.95), ikpalmL=(-0.9, -0.2, 0.0), poleL=(0.6, 0.2, 1.0))
    p.key(15.55, head=(16, 0, 4), smile=0.7)

    def stir_ik(ctx, side, t, pos):
        if side != 'L':
            return pos
        w = 2 * math.pi * 1.4
        return POT + Vector((0.05 * math.cos(t * w), 0.05 * math.sin(t * w), 0.36))
    s.ik = stir_ik
    s.cam(14.61, (-2.02, 0.32, 1.16), (-2.36, 2.5, 1.06), 19)
    s.cam(15.55, (-2.04, 0.42, 1.16), (-2.36, 2.5, 1.06), 20)
    s.focus = focus('chest')

    def props(ctx, t):
        kitchen_base(ctx, t)
        stick_props(ctx, t)
    s.props = props
    s.add_fx('poof', 14.58, 15.15, x=0.5, y=0.55, size=1.4)
    s.add_sfx(14.6, 'poof')
    s.add_sfx(14.7, 'bubbling', dur=4.6)

    s = add(Shot('s06b', 15.55, 16.3, colls=('kitchen',), char=KC, fur=0.5, fstop=2.0))
    p = s.p
    p.key(15.55, spine=(12, 0, 8), chest=(6, 0, 6), head=(16, 0, 8), look=(6, 14), smile=0.6, ikL=1.0, curlL=0.9, indexL=0.9,
          ikfwdL=(0.0, -0.3, -0.95), ikpalmL=(-0.9, -0.2, 0.0), poleL=(0.6, 0.2, 1.0),
          ikR=1.0, curlR=0.5, indexR=0.5, thumbR=0.4, ikfwdR=(0.9, -0.3, -0.2), ikpalmR=(0.0, 0.2, -1.0), poleR=(-0.55, 0.0, 1.1))

    def ik(ctx, side, t, pos):
        if side == 'L':
            w = 2 * math.pi * 0.8
            return POT + Vector((-0.07 + 0.03 * math.cos(t * w), 0.03 * math.sin(t * w), 0.36))
        return POT + Vector((-0.05, -0.02, 0.27 + 0.01 * math.sin(t * 3)))
    s.ik = ik
    s.cam(15.55, (-2.03, 1.7, 0.9), (-2.33, 2.12, 0.58), 34)
    s.cam(16.3, (-2.04, 1.72, 0.89), (-2.33, 2.12, 0.58), 37)
    s.focus = lambda ctx, t: POT + Vector((0, 0, 0.1))

    def honey(ctx, t):
        m = ctx.ch.hand_matrix('R')
        O['honeycomb'].matrix_world = m @ Matrix.Translation((0.03, 0.035, 0.0)) @ Euler((0.3, 0, 0.5)).to_matrix().to_4x4()
        O['honey_fill'].matrix_world = O['honeycomb'].matrix_world @ Matrix.Translation((0.0, 0.0, -0.005))
        ctx.show('honeycomb', True); ctx.show('honey_fill', True)
        top = O['honeycomb'].matrix_world @ Vector((0, 0.03, -0.035))
        bot = Vector((top.x, top.y, POT.z + 0.002))
        u = u_(t, 15.6, 15.85)
        endz = top.z + (bot.z - top.z) * u
        n = 10
        P = [top.lerp(Vector((top.x, top.y, endz)), i / (n - 1)) + Vector((0.004 * math.sin(i + t * 6), 0, 0)) for i in range(n)]
        R = [0.006 * (1 - 0.6 * i / (n - 1)) + 0.0015 for i in range(n)]
        V, F = tube(P, R, 8)
        set_mesh(O['honey_drip'], V, F)
        ctx.show('honey_drip', True)
        ctx.show('stick', True)
        grip = ctx.ch.anchor('palmL')
        base = POT + Vector((-0.07, 0, 0))
        O['stick'].matrix_world = mat_from(base, grip - base, up=(0, 1, 0)) @ Matrix.Rotation(math.radians(-90), 4, 'X')

    def props(ctx, t):
        kitchen_base(ctx, t)
        honey(ctx, t)
    s.props = props
    s.add_sfx(15.65, 'drip', vol=0.6)
    s.add_sfx(15.95, 'drip', vol=0.6)

    s = add(Shot('s06c', 16.3, 17.15, colls=('kitchen',), char=KC, fur=0.5, fstop=2.0))
    p = s.p
    p.key(16.3, spine=(12, 0, 8), chest=(6, 0, 6), head=(16, 0, 8), look=(6, 14), smile=0.6, ikL=1.0, curlL=0.9, indexL=0.9,
          ikfwdL=(0.0, -0.3, -0.95), ikpalmL=(-0.9, -0.2, 0.0), poleL=(0.6, 0.2, 1.0),
          ikR=1.0, curlR=0.85, indexR=0.85, thumbR=0.7, ikfwdR=(0.6, -0.3, -0.75), ikpalmR=(0.2, 0.3, -0.9), poleR=(-0.55, 0.0, 1.1))
    p.key(16.5, curlR=0.85, indexR=0.85)
    p.key(16.62, 'o', curlR=0.0, indexR=0.0, thumbR=0.0)
    p.key(17.15, curlR=0.1, indexR=0.1)

    def ik(ctx, side, t, pos):
        if side == 'L':
            w = 2 * math.pi * 0.8
            return POT + Vector((-0.07 + 0.03 * math.cos(t * w), 0.03 * math.sin(t * w), 0.36))
        return POT + Vector((0.0, -0.02, 0.24)) + Vector((0, 0, 0.03)) * u_(t, 16.6, 16.9)
    s.ik = ik
    s.cam(16.3, (-2.5, 1.72, 0.9), (-2.33, 2.12, 0.42), 38)
    s.cam(17.15, (-2.49, 1.75, 0.88), (-2.33, 2.12, 0.42), 42)
    s.focus = lambda ctx, t: POT + Vector((0, 0, 0.08))

    def props(ctx, t):
        kitchen_base(ctx, t)
        ctx.show('stick', True)
        grip = ctx.ch.anchor('palmL')
        base = POT + Vector((-0.07, 0, 0))
        O['stick'].matrix_world = mat_from(base, grip - base, up=(0, 1, 0)) @ Matrix.Rotation(math.radians(-90), 4, 'X')
        ctx.show('mint_pinch', True)
        if t < 16.58:
            ctx.attach('mint_pinch', 'R', Matrix.Translation((0.01, -0.01, 0)))
            ctx.state['drop_from'] = O['mint_pinch'].matrix_world.translation.copy()
        else:
            p0 = ctx.state.get('drop_from', POT + Vector((0, 0, 0.25)))
            dt = t - 16.58
            z = max(p0.z - 4.9 * dt * dt * 1.5, POT.z + 0.005)
            spin = dt * 4
            O['mint_pinch'].matrix_world = Matrix.Translation((p0.x + 0.02 * dt, p0.y, z)) @ Euler((0.2, 0.1, spin)).to_matrix().to_4x4() @ Matrix.Diagonal((1.3, 1.3, 0.4, 1))
    s.props = props
    s.add_sfx(16.75, 'plop')

    s = add(Shot('s06d', 17.15, 18.3, colls=('kitchen',), char=KC, fur=0.6, fstop=2.6))
    BALL = Vector((-2.86, 2.16, 0.9))
    p = s.p
    p.key(17.15, spine=(10, 0, -14), chest=(5, 0, -14), head=(14, 0, -18), look=(-8, 14), smile=0.7, squint=0.4,
          ikL=1.0, ikR=1.0, curlL=0.25, indexL=0.25, curlR=0.25, indexR=0.25, thumbL=0.1, thumbR=0.1,
          ikfwdL=(-0.2, -0.95, 0.1), ikpalmL=(-1, 0, 0), poleL=(0.6, 0.3, 1.0),
          ikfwdR=(0.2, -0.95, 0.1), ikpalmR=(1, 0, 0), poleR=(-0.6, 0.3, 1.0))
    p.key(17.95, head=(14, 0, -16))
    p.key(18.3, smile=0.9, head=(8, 0, -10))

    def ik(ctx, side, t, pos):
        rub = 0.025 * math.sin(t * 2 * math.pi * 3.0)
        lift = 0.0
        if t > 17.92:
            lift = -0.05 * u_(t, 17.92, 18.1)
        sx = 1 if side == 'L' else -1
        return BALL + Vector((sx * 0.032, rub * sx, lift))
    s.ik = ik
    s.cam(17.15, (-3.42, 1.2, 1.58), (-2.82, 2.3, 1.24), 26)
    s.cam(18.3, (-3.38, 1.27, 1.57), (-2.82, 2.3, 1.25), 28)
    s.focus = lambda ctx, t: BALL

    def props(ctx, t):
        kitchen_base(ctx, t)
        o = O['gumball0']
        if t < 18.05:
            o.matrix_world = Matrix.Translation(BALL + Vector((0, 0, 0))) @ Euler((t * 12, t * 5, 0)).to_matrix().to_4x4()
        else:
            o.matrix_world = Matrix.Translation((BALL.x, BALL.y, 0.817))
    s.props = props
    s.add_sfx(17.3, 'squish', vol=0.35)
    s.add_sfx(17.7, 'squish', vol=0.35)

    s = add(Shot('s06e', 18.3, 19.52, colls=('kitchen',), char=KC, fur=0.9, fstop=2.2))
    p = s.p
    p.key(18.3, ikR=1.0, curlR=0.8, indexR=0.7, thumbR=0.7, smile=0.6, head=(2, 0, -4), ikfwdR=(0.4, -0.2, 0.9),
          ikpalmR=(0.3, 0.9, 0.0), poleR=(-0.55, 0.0, 1.0))
    p.key(18.42, 'o', jaw=12, O=0.4)
    p.key(18.5, 'io', jaw=1, O=0.0)
    p.key(18.5, chew=0.0)
    p.key(18.56, chew=1.0, chew_rate=3.0, squint=0.6, smile=0.6)
    p.key(18.7, 'io', ikR=0.0, curlR=0.3, indexR=0.3)
    p.key(18.82, chew=0.0, puff=0.0)
    p.key(18.95, 'io', chest=(-7, 0, 0), head=(-8, 0, 0), puff=0.6, brow=0.6, blink=0.0, smile=0.0)          # inhale
    p.key(19.05, 'o', chest=(3, 0, 0), head=(-2, 0, 0), pucker=1.0, puff=0.25, blink=1.0, brow=0.9)          # blow
    p.key(19.35, pucker=0.9)
    p.key(19.52, 'io', pucker=0.0, smile=1.0, squint=0.8, blink=0.0, puff=0.0, brow=0.8, head=(-3, 4, 0))
    p.key(18.3, autoblink=0.0)

    def ik(ctx, side, t, pos):
        if side != 'R':
            return pos
        m = ctx.ch.anchor('mouth')
        a = Vector((-0.04, -0.09, -0.05)).lerp(Vector((-0.015, -0.055, -0.02)), u_(t, 18.3, 18.42))
        if t > 18.45:
            a = a.lerp(Vector((-0.2, -0.15, -0.35)), u_(t, 18.45, 18.7))
        return m + a
    s.ik = ik
    s.cam(18.3, (-2.48, 1.86, 1.62), (-2.6, 2.55, 1.62), 34)
    s.cam(19.52, (-2.47, 1.9, 1.63), (-2.6, 2.55, 1.63), 37)
    s.focus = focus('face')

    def props(ctx, t):
        kitchen_base(ctx, t)
        o = O['gumball1']
        if t < 18.44:
            ctx.attach('gumball1', 'R', Matrix.Translation((0.04, 0.0, 0.0)))
        else:
            o.matrix_world = Matrix.Translation((0, 0, -5))
    s.props = props
    s.add_fx('breath', 19.02, 19.52, anchor='mouth')
    s.add_sfx(19.03, 'breath')
    s.add_sfx(19.08, 'ding')

    # ============================================================ SCENE 7  swallow
    s = add(Shot('s07a', 19.52, 20.95, colls=('kitchen',), char=KC, fur=1.0, fstop=2.0))
    p = s.p
    p.key(19.52, chew=1.0, chew_rate=2.3, blink=1.0, smile=0.9, brow=0.5, autoblink=0.0, squint=0.4)

    for i, tt in enumerate(np.arange(19.52, 20.96, 0.45)):
        p.key(float(tt), 'io', head=(0, 7 if i % 2 == 0 else -7, 3 if i % 2 == 0 else -3), chest=(0, 0, 3 if i % 2 == 0 else -3))
    p.key(20.95, chew=0.9)
    s.cam(19.52, (-2.52, 2.02, 1.71), (-2.6, 2.6, 1.715), 40)
    s.cam(20.95, (-2.52, 2.06, 1.71), (-2.6, 2.6, 1.715), 43)
    s.focus = focus('face')
    s.props = kitchen_base
    for tt in np.arange(19.6, 20.95, 1 / 2.3):
        s.add_sfx(float(tt), 'chew')

    s = add(Shot('s07b', 20.95, 21.7, colls=('kitchen',), char=KC, fur=1.0, fstop=2.2))
    p = s.p
    p.key(20.95, chew=0.8, chew_rate=2.3, blink=1.0, smile=0.9, autoblink=0.0, head=(0, 4, 2))
    p.key(20.99, chew=0.0, jaw=0)
    p.key(21.02, 'o', head=(9, 0, 0), neck=(4, 0, 0), smile=0.0)
    p.key(21.1, 'back', blink=0.0, lidwide=1.0, brow=1.0, O=0.55, head=(-4, 0, 0), neck=(-2, 0, 0))
    p.key(21.7, lidwide=1.0, O=0.5, brow=1.0, look=(0, 8))
    s.cam(20.95, (-2.5, 1.88, 1.5), (-2.6, 2.55, 1.58), 36)
    s.cam(21.7, (-2.5, 1.95, 1.5), (-2.6, 2.55, 1.58), 39)
    s.focus = focus('chin')
    s.props = kitchen_base
    s.lump = (21.06, 21.6)
    s.points = lambda ctx, t: {'lump': bpy.data.objects['lump_empty'].location.copy()}
    s.add_fx('lump', 21.06, 21.62, anchor='lump')
    s.add_sfx(20.98, 'gulp')
    s.add_sfx(21.04, 'slide_down')

    s = add(Shot('s07c', 21.7, 22.6, colls=('kitchen',), char=KC, fur=0.75, fstop=2.6))
    p = s.p
    p.key(21.7, lidwide=0.8, O=0.4, brow=0.8, ikR=0.0, autoblink=0.0)
    p.key(21.78, ikR=1.0, ikfwdR=(0.9, -0.2, 0.3), ikpalmR=(0, 1, 0), poleR=(-0.5, 0.0, 1.0), curlR=0.4, indexR=0.4)
    for tt in (21.82, 22.06, 22.32):
        p.key(tt - 0.07, 'io', chest=(-5, 0, 0), head=(-6, 0, 0), puff=0.7, blink=0.4, lidwide=0.0, O=0.0, jaw=0)
        p.key(tt + 0.03, 'o', chest=(14, 0, 0), spine=(6, 0, 0), head=(12, 0, 0), jaw=13, wide=0.7, blink=1.0, puff=0.0, angry=0.5)
        p.key(tt + 0.17, 'io', chest=(4, 0, 0), spine=(2, 0, 0), head=(3, 0, 0), jaw=3, wide=0.1, blink=0.6, angry=0.3)
        s.add_sfx(tt, 'cough')
        s.add_fx('cough', tt, tt + 0.35, anchor='mouth')
    p.key(22.6, chest=(3, 0, 0), head=(2, 0, 0), blink=0.3, sad=0.4)

    def ik(ctx, side, t, pos):
        if side != 'R':
            return pos
        return ctx.ch.anchor('chest') + Vector((-0.04, -0.05, -0.02)) + Vector((0, -0.02, 0)) * math.sin(t * 25)
    s.ik = ik
    s.cam(21.7, (-2.38, 1.5, 1.55), (-2.6, 2.6, 1.5), 29)
    s.cam(22.6, (-2.4, 1.55, 1.55), (-2.6, 2.6, 1.5), 31)
    s.shake(21.84, 0.2, 0.7)
    s.shake(22.08, 0.2, 0.7)
    s.shake(22.34, 0.2, 0.7)
    s.focus = focus('head')
    s.props = kitchen_base

    # ============================================================ SCENE 8  explainer + stretch
    SB = Vector((100.0, 0.0, 1.0))
    s = add(Shot('s08a', 22.6, 24.45, colls=('studio',), char=None, fstop=5.6, sun=1.5, sky=0.5))
    s.cam(22.6, (100.0, -2.2, 1.05), (100.0, 0.0, 1.02), 30)
    s.cam(24.45, (100.0, -2.1, 1.05), (100.0, 0.0, 1.02), 30)
    s.focus = lambda ctx, t: SB

    def explainer(ctx, t):
        ball = O['ex_ball']
        pop = ease('back', (t - 22.6) / 0.18)
        st = u_(t, 23.98, 24.42)
        R0 = 0.23 * pop
        from geo import uvsphere
        V, F = uvsphere(48, 24, 1.0)
        sz = 1 + 1.45 * st
        rxy = 1 - 0.32 * st
        waist = 0.35 * st * np.exp(-(V[:, 2] * sz / 0.9) ** 2)
        Vd = V.copy()
        Vd[:, 0] *= rxy * (1 - waist)
        Vd[:, 1] *= rxy * (1 - waist)
        Vd[:, 2] *= sz
        wob = 0.03 * math.sin(t * 20) * math.exp(-max(t - 22.7, 0) * 4)
        Vd *= R0 * (1 + wob)
        set_mesh(ball, Vd + np.array(SB), F)
        ball.matrix_world = Matrix.Identity(4)
        # fibres spiral in, then stretch with the ball
        for k in range(9):
            o = O[f'ex_fiber{k}']
            fin = u_(t, 22.72 + 0.07 * k, 23.5 + 0.06 * k, 'o')
            if fin <= 0.001:
                o.hide_render = True
                continue
            o.hide_render = False
            n = 40
            u = np.linspace(0, 1, n)
            ph0 = k * 2 * np.pi / 9 + t * 2.2
            rad = (0.12 + 0.22 * (1 - fin)) * (1 - 0.35 * u) * R0 / 0.17 * rxy * 0.85
            ang = ph0 + u * 4.5 * np.pi
            z = (u - 0.5) * 0.24 * sz * (R0 / 0.17)
            P = np.stack([np.cos(ang) * rad * 0.8, np.sin(ang) * rad * 0.8, z * (0.6 + 0.4 * fin)], 1)
            P[:, 0] += (1 - fin) * 0.22 * (1 if k % 2 else -1)
            P[:, 2] += (1 - fin) * 0.15 * math.sin(k * 2.3)
            V2, F2 = tube(P + np.array(SB), 0.0055, 6)
            set_mesh(o, V2, F2)
        for k in range(2):
            o = O[f'ex_arrow{k}']
            ap = ease('back', (t - 23.85 - 0.05 * k) / 0.2)
            if ap <= 0.001:
                o.hide_render = True
                continue
            o.hide_render = False
            sgn = 1 if k == 0 else -1
            zpos = SB.z + sgn * (0.27 + 0.36 * st) * 1.0
            pulse = 1 + 0.08 * math.sin(t * 12)
            m = Matrix.Translation((SB.x, SB.y - 0.02, zpos)) @ Matrix.Rotation(math.radians(90 * sgn), 4, 'Y').inverted() @ Matrix.Scale(ap * pulse * 0.9, 4)
            o.matrix_world = m
    s.props = explainer
    s.add_fx('check', 24.28, 24.45, x=0.72, y=0.30)
    s.add_sfx(22.62, 'pop', vol=0.5)
    s.add_sfx(22.75, 'swirl', dur=0.9)
    s.add_sfx(23.86, 'boing', vol=0.5)
    s.add_sfx(24.0, 'stretch', dur=0.42)
    s.add_sfx(24.3, 'ding', vol=0.6)

    s = add(Shot('s08b', 24.45, 25.59, colls=('gum',), fur=0.85, fstop=2.4))
    p = s.p
    p.key(24.45, ikR=1.0, curlR=0.7, indexR=0.6, thumbR=0.6, ikfwdR=(0.3, -0.6, 0.75), ikpalmR=(0.6, 0.6, -0.2), poleR=(-0.6, 0.2, 1.0),
          smile=0.5, look=(-10, 4), head=(0, 0, -6))
    p.key(24.95, 'io', ikfwdR=(-0.4, -0.85, 0.2), ikpalmR=(0.6, -0.2, -0.75), grimace=0.45, smile=0.8, squint=0.3, look=(-30, 4),
          head=(-2, 0, -14), brow=0.6)
    p.key(25.03, curlR=0.7, indexR=0.6, thumbR=0.6)
    p.key(25.07, 'o', curlR=0.0, indexR=0.0, thumbR=0.0)
    p.key(25.15, head=(-2, 0, -12))
    p.key(25.2, 'back', head=(-9, 0, -2), blink=1.0, grimace=0.0, smile=0.4, ikR=0.6)
    p.key(25.3, blink=0.0, smile=0.9, squint=0.6)
    p.key(25.32, chew=0.0)
    p.key(25.4, chew=0.8, chew_rate=3.0)
    p.key(25.59, 'io', ikR=0.0, curlR=0.3, indexR=0.3, head=(-3, 0, 0))

    def ik(ctx, side, t, pos):
        if side != 'R':
            return pos
        m = ctx.ch.anchor('mouth')
        a = Vector((-0.03, -0.05, -0.03))
        far = Vector((-0.55, -0.32, -0.08))
        return m + a.lerp(far, u_(t, 24.5, 24.95)) if t < 25.07 else m + far + Vector((0, 0, -0.3)) * u_(t, 25.07, 25.5)
    s.ik = ik
    s.cam(24.45, (-0.58, -1.28, 1.55), (-0.18, 0.05, 1.56), 30)
    s.cam(25.59, (-0.56, -1.22, 1.56), (-0.16, 0.05, 1.57), 32)
    s.focus = focus('face')

    def props(ctx, t):
        m = ctx.ch.anchor('mouth') + Vector((0, -0.01, -0.002))
        pinch = ctx.ch.anchor('index_tipR') * 0.5 + ctx.ch.anchor('thumb_tipR') * 0.5
        if t < 25.07:
            end = pinch
            ctx.state['rel'] = pinch.copy()
        else:
            end = ctx.state.get('rel', pinch).lerp(m, u_(t, 25.07, 25.17, 'i'))
        if t < 25.18:
            L_ = (end - m).length
            r = max(0.0035, 0.009 - 0.008 * L_)
            V, F = strand(m, end, 0.009, 0.011, sag=0.015 * L_, n=16, k=8)
            set_mesh(O['gum_strand'], V, F)
            ctx.show('gum_strand', True)
            ctx.show('gum_piece', True)
            O['gum_piece'].matrix_world = Matrix.Translation(end) @ Matrix.Scale(0.7, 4)
        else:
            ctx.show('gum_strand', False)
            ctx.show('gum_piece', False)
    s.props = props
    s.add_sfx(24.55, 'stretch', dur=0.4)
    s.add_sfx(25.15, 'snap')

    # ============================================================ SCENE 9  boring
    SEAT = (2.8, -1.72, 0.0)
    sit = dict(hips_loc=(0, 0.06, -0.335), footL=(0.04, -0.36, 0.0), footR=(-0.05, -0.34, 0.0),
               kneeL=(0.3, -1.4, 0.55), kneeR=(-0.3, -1.4, 0.55))
    s = add(Shot('s09a', 25.59, 26.55, colls=(), char=SEAT, fur=0.6, fstop=2.8))
    p = s.p
    p.key(25.59, spine=(16, 0, 0), chest=(12, 0, 0), neck=(4, 0, 0), head=(-6, 0, 10), sleepy=0.85, chew=0.7, chew_rate=0.75,
          chew_open=7, look=(0, 3), ikR=1.0, curlR=0.85, indexR=0.85, thumbR=0.6, ikfwdR=(0.1, -0.2, 1.0), ikpalmR=(0.3, -0.9, 0),
          poleR=(-0.35, -0.3, 0.6), armL=(-25, 30, 8), elbowL=55, curlL=0.4, indexL=0.4, frown=0.3, **sit)
    p.key(26.55, head=(-5, 0, 13), sleepy=0.95)

    def chin_ik(ctx, side, t, pos):
        if side != 'R':
            return pos
        return ctx.ch.anchor('chin') + Vector((0.0, -0.01, -0.07))
    s.ik = chin_ik
    s.cam(25.59, (2.4, -3.3, 1.0), (2.8, -1.72, 1.0), 27)
    s.cam(26.55, (2.43, -3.2, 1.0), (2.8, -1.72, 1.01), 29)
    s.focus = focus('head')
    s.add_sfx(25.6, 'crickets', dur=1.9)
    s.add_fx('zzz', 25.9, 26.55, anchor='head_top', dx=0.06, dy=-0.02)
    s.add_sfx(26.0, 'chew', vol=0.5)

    s = add(Shot('s09b', 26.55, 27.43, colls=('snail',), char=SEAT, fur=0.4, fstop=2.0))
    p = s.p
    p.key(26.55, spine=(16, 0, 0), chest=(12, 0, 0), neck=(4, 0, 0), head=(-5, 0, 13), sleepy=0.95, chew=0.7, chew_rate=0.75,
          chew_open=7, ikR=1.0, curlR=0.85, indexR=0.85, thumbR=0.6, ikfwdR=(0.1, -0.2, 1.0), ikpalmR=(0.3, -0.9, 0),
          poleR=(-0.35, -0.3, 0.6), armL=(-25, 30, 8), elbowL=55, curlL=0.4, indexL=0.4, frown=0.3, **sit)
    s.ik = chin_ik
    SN = Vector((3.18, -2.06, 0.0))
    s.cam(26.55, (3.5, -2.64, 0.52), (3.04, -1.88, 0.64), 30)
    s.cam(27.43, (3.5, -2.62, 0.52), (3.04, -1.88, 0.65), 32)
    s.focus = lambda ctx, t: ctx.state.get('snail', SN)

    def snail(ctx, t):
        x = SN.x - 0.035 * (t - 26.55)
        seat = O['seat']
        hit, loc, nrm, idx = seat.ray_cast(Vector((x, SN.y, 2.0)), Vector((0, 0, -1)))
        z = loc.z if hit else 0.45
        sq = 1 + 0.05 * math.sin(t * 5)
        tilt = math.atan2(-nrm.y, nrm.z) if hit else 0.0
        base = Matrix.Translation((x, SN.y, z + 0.022)) @ Matrix.Rotation(tilt, 4, 'X') @ Matrix.Rotation(math.radians(200), 4, 'Z') @ Matrix.Scale(1.25, 4)
        for o in bpy.data.collections['snail'].objects:
            if o.name.startswith('snail_body'):
                o.matrix_world = base @ Matrix.Diagonal((sq, 1, 1 / sq, 1))
            elif o.name.startswith(('snail_stalk', 'snail_eye', 'snail_pupil', 'snail_lid')):
                o.matrix_world = base @ Matrix.Translation((0.004 * math.sin(t * 2), 0, -0.004)) @ Matrix.Rotation(math.radians(-12), 4, 'Y')
            else:
                o.matrix_world = base @ Matrix.Translation((-0.01, 0, 0.0))
        ctx.state['snail'] = Vector((x, SN.y, z + 0.06))
    s.props = snail
    s.points = lambda ctx, t: {'snail': ctx.state.get('snail', SN) + Vector((0, 0, 0.05))}
    s.add_sfx(26.6, 'crickets', dur=0.85)
    s.add_fx('sigh', 26.95, 27.43, anchor='snail')

    # ============================================================ SCENE 10  bubble lift-off
    LIFT = (-0.45, -2.1, 78.0)

    def bubble_r(t):
        if t < 28.0:
            return 0.0
        if t < 28.85:
            return 0.015 + 0.21 * ease('io', (t - 28.0) / 0.85) + 0.006 * math.sin(t * 25)
        if t < 29.85:
            return 0.225 + 0.78 * ease('io', (t - 28.85) / 1.0) + 0.01 * math.sin(t * 17)
        return 1.0 + 0.01 * math.sin(t * 9)

    def bubble(ctx, t, r=None):
        r = bubble_r(t) if r is None else r
        o = O['bubble']
        if r <= 0:
            o.hide_render = True
            return
        o.hide_render = False
        m = ctx.ch.anchor('mouth')
        pb = ctx.rig.ob.pose.bones['head']
        Mh = ctx.rig.ob.matrix_world @ pb.matrix
        fwd = (Mh.to_3x3() @ Vector((0, 0, 1)))  # bone local +Z = character forward for an up-pointing bone
        fwd = Vector((fwd.x, fwd.y, fwd.z * 0.5)).normalized()
        c = m + fwd * (r * 0.97 + 0.004) + Vector((0, 0, -r * 0.08))
        sq = 1 + 0.03 * math.sin(t * 13)
        o.matrix_world = Matrix.Translation(c) @ Matrix.Diagonal((r * sq, r * sq, r / sq, 1))
        ctx.state['bubble'] = c

    s = add(Shot('s10a', 27.43, 28.85, colls=('gum',), char=LIFT, fur=1.0, fstop=2.4))
    p = s.p
    p.key(27.43, chew=0.6, chew_rate=2.5, smile=0.5, head=(0, 0, 0))
    p.key(27.7, chew=0.0)
    p.key(27.85, 'io', chest=(-6, 0, 0), head=(-5, 0, 0), puff=0.3, brow=0.5)
    p.key(28.0, 'o', chest=(2, 0, 0), head=(2, 0, 0), pucker=1.0, puff=1.0, brow=0.9, lookL=(-14, 18), lookR=(14, 18))
    p.key(28.85, pucker=1.0, puff=0.9, brow=1.0, lidwide=0.6, lookL=(-16, 22), lookR=(16, 22))
    s.cam(27.43, (0.3, -3.05, 1.64), (-0.2, -2.15, 1.62), 33)
    s.cam(28.85, (0.34, -3.2, 1.63), (-0.12, -2.15, 1.6), 30)
    s.focus = focus('face')
    s.props = bubble
    s.points = lambda ctx, t: {'bubble': ctx.state.get('bubble', Vector((0, 0, 0)))}
    s.add_sfx(28.0, 'inflate', dur=2.0)

    s = add(Shot('s10b', 28.85, 30.2, colls=('gum',), char=LIFT, fur=0.55, fstop=4.0))
    p = s.p
    p.key(28.85, pucker=1.0, puff=0.9, brow=1.0, lidwide=0.6, lookL=(-16, 22), lookR=(16, 22))
    p.key(29.5, 'io', armL=(0, -10, 10), armR=(0, 10, -10), elbowL=40, elbowR=40, curlL=0.0, curlR=0.0, indexL=0.0, indexR=0.0)
    p.key(29.8, root=(0, 0, 0), iklegs=1.0, lidwide=1.0)
    p.key(30.2, 'i', root=(0, 0, 0.42), iklegs=0.0, thighL=(-12, 0, 0), thighR=(8, 0, 0), shinL=25, shinR=15,
          armL=(0, -25, 10), armR=(0, 25, -10), elbowL=30, elbowR=30)
    s.cam(28.85, (0.7, -7.3, 1.45), (0.2, -2.1, 1.35), 27)
    s.cam(30.2, (0.68, -7.1, 1.5), (0.2, -2.1, 1.6), 27)
    s.focus = focus('chest')
    s.props = bubble
    s.points = lambda ctx, t: {'bubble': ctx.state.get('bubble', Vector((0, 0, 0)))}
    s.add_sfx(29.85, 'boing')

    s = add(Shot('s10c', 30.2, 31.4, colls=('gum',), char=LIFT, fur=0.45, fstop=5.6))
    p = s.p
    p.key(30.2, root=(0, 0, 0.42), iklegs=0.0, thighL=(-12, 0, 0), thighR=(8, 0, 0), shinL=25, shinR=15,
          armL=(0, -25, 10), armR=(0, 25, -10), elbowL=30, elbowR=30, pucker=1.0, puff=0.9, lidwide=1.0, brow=1.0, look=(0, 25))
    for i, tt in enumerate(np.arange(30.2, 31.41, 0.2)):
        a = 1 if i % 2 == 0 else -1
        p.key(float(tt), 'io', thighL=(-25 * a, 0, 0), thighR=(25 * a, 0, 0), shinL=30 + 20 * a, shinR=30 - 20 * a,
              armL=(0, -35 + 15 * a, 10), armR=(0, 35 + 15 * a, -10))
    p.key(31.4, 'i', root=(0, 0, 4.2), head=(14, 0, 0))
    s.cam(30.2, (-1.3, -6.5, 0.3), (-0.45, -2.1, 1.9), 24)
    s.cam(31.4, (-1.3, -6.5, 0.3), (-0.45, -2.1, 4.6), 22)
    s.track = (lambda ctx, t: ctx.ch.anchor('head') + Vector((0.4, 0, 0.3)), 0.7)
    s.focus = focus('chest')
    s.props = lambda ctx, t: bubble(ctx, t, 1.0)

    s = add(Shot('s10d', 31.4, 32.5, colls=('gum', 'birds'), char=LIFT, fur=0.4, fstop=8.0))
    p = s.p
    p.key(31.4, root=(0, 0, 3.0), iklegs=0.0, thighL=(-10, 0, 0), thighR=(10, 0, 0), shinL=20, shinR=20, armL=(0, -60, 10),
          armR=(0, 60, -10), elbowL=10, elbowR=10, pucker=1.0, puff=0.9, lidwide=1.0, brow=1.0)
    p.key(31.46, root=(0, 0, 3.4))
    p.key(32.0, 'i', root=(0, 0, 16.0))
    p.key(32.5, root=(0, 0, 20.0))
    s.cam(31.4, (1.4, -7.8, 8.2), (-0.45, -2.1, 10.8), 24)
    s.cam(32.5, (1.4, -7.8, 8.2), (-0.45, -2.1, 11.6), 24)
    s.focus = lambda ctx, t: Vector((-0.45, -2.1, 10.5))

    def props(ctx, t):
        bubble(ctx, t, 1.0)
        for k, (y0, z0, sp, ph) in enumerate([(-1.6, 10.2, 2.3, 0.0), (-2.9, 11.1, 2.0, 1.0), (-2.2, 9.6, 2.6, 2.0)]):
            x = -3.4 + sp * (t - 31.4) + k * 0.6
            look = u_(t, 31.6 + 0.1 * k, 31.9 + 0.1 * k)
            pos = Vector((x, y0, z0 + 0.1 * math.sin(t * 3 + ph)))
            bird_pose(k + 1, pos, yaw=90 - 60 * look, pitch=-25 * look, flap=55 * math.sin(t * 2 * math.pi * 6 + ph), scale=2.6)
            ctx.state[f'bird{k + 1}'] = pos
    s.props = props
    s.points = lambda ctx, t: {f'bird{k}': ctx.state.get(f'bird{k}', Vector((0, 0, 0))) + Vector((0, 0, 0.18)) for k in (1, 2, 3)}
    s.add_fx('speedlines', 31.44, 32.05, x=0.5, y=0.5)
    s.add_fx('question', 31.95, 32.5, anchors=['bird1', 'bird2', 'bird3'])
    s.add_sfx(31.44, 'whoosh')
    s.add_sfx(31.75, 'birds')

    # ============================================================ SCENE 11  pop, fall, congratulations
    SPLAT = [('head', (0.045, -0.088, 1.80), 0.016), ('head', (-0.062, -0.094, 1.705), 0.02), ('head', (0.064, -0.09, 1.69), 0.018),
             ('beard_tip', (0.055, -0.15, 1.6), 0.03), ('beard_tip', (-0.05, -0.155, 1.57), 0.032), ('beard_tip', (0.0, -0.17, 1.51), 0.03),
             ('beard_tip', (0.045, -0.158, 1.47), 0.024), ('head', (0.004, -0.136, 1.692), 0.013), ('head', (-0.036, -0.126, 1.674), 0.011),
             ('head', (-0.03, -0.065, 1.865), 0.02), ('jaw', (0.0, -0.14, 1.618), 0.017), ('head', (-0.046, -0.1, 1.786), 0.011),
             ('head', (0.088, -0.02, 1.74), 0.014), ('beard_tip', (-0.06, -0.13, 1.5), 0.022)]

    def splats(ctx, t, t_on):
        for k, (bone, pt, r) in enumerate(SPLAT):
            o = O[f'splat{k}']
            if t < t_on:
                o.hide_render = True
                continue
            o.hide_render = False
            g = ease('back', (t - t_on - 0.01 * k) / 0.12)
            sc = (r * g * 1.3, r * g * 0.5, r * g * 1.15) if bone == 'jaw' else (r * g * 1.3, r * g * 1.15, r * g * 0.5)
            ctx.on_bone(f'splat{k}', bone, pt, scale=sc)

    s = add(Shot('s11a', 32.5, 33.35, colls=('gum',), char=(-0.45, -2.1, 78.0), fur=0.9, fstop=4.0, nograss=True))
    p = s.p
    p.key(32.5, root=(0, 0, 15.0), iklegs=0.0, thighL=(-15, 0, 0), thighR=(5, 0, 0), shinL=30, shinR=20, armL=(0, -40, 10),
          armR=(0, 40, -10), elbowL=20, elbowR=20, pucker=1.0, puff=0.9, lidwide=0.5, brow=0.7, smile=0.0, autoblink=0.0)
    p.key(32.62, pucker=1.0, puff=0.9)
    p.key(32.68, 'o', pucker=0.0, puff=0.0, O=0.8, jaw=12, lidwide=1.0, brow=1.0, head=(-8, 0, 0))
    p.key(33.0, O=0.7, jaw=10)
    p.key(33.05, root=(0, 0, 15.0))
    p.key(33.35, 'i', root=(0, 0, 14.2), armL=(0, -75, 10), armR=(0, 75, -10), thighL=(-60, 0, 0), thighR=(-55, 0, 0), shinL=50, shinR=55)
    s.cam(32.5, (0.9, -3.9, 16.9), (-0.2, -2.1, 16.6), 30)
    s.cam(33.35, (0.9, -3.9, 16.6), (-0.2, -2.1, 16.0), 30)
    s.track = (lambda ctx, t: ctx.ch.anchor('face') + Vector((0.25, 0, -0.1)), 0.85)
    s.focus = focus('face')

    def props(ctx, t):
        if t < 32.62:
            bubble(ctx, t, 1.0 + 0.04 * (t - 32.5) / 0.12)
        else:
            O['bubble'].hide_render = True
        splats(ctx, t, 32.63)
    s.props = props
    s.points = lambda ctx, t: {'bubble': ctx.state.get('bubble', ctx.ch.anchor('face'))}
    s.add_fx('pop', 32.61, 32.95, anchor='bubble')
    s.add_sfx(32.62, 'pop')
    s.add_sfx(33.0, 'fallwhistle', dur=0.95)

    s = add(Shot('s11b', 33.35, 34.1, colls=('gum',), char=(-0.45, -2.1, 25.0), fur=0.5, fstop=5.6))
    p = s.p
    air = dict(armL=(0, -75, 10), armR=(0, 75, -10), thighL=(-70, 0, 0), thighR=(-65, 0, 0), shinL=35, shinR=40,
               hips_loc=(0, 0.02, -0.74), iklegs=0.0, O=0.7, jaw=10, lidwide=1.0, brow=1.0, autoblink=0.0)
    p.key(33.35, root=(0, 0, 6.5), **air)
    p.key(33.95, 'i', root=(0, 0, 0.0))
    p.key(34.02, 'o', root=(0, 0, 0.07), armL=(0, -20, 10), armR=(0, 20, -10), blink=1.0, O=0.0, jaw=2)
    p.key(34.1, 'i', root=(0, 0, 0.0), blink=0.5)
    s.track = (lambda ctx, t: ctx.ch.anchor('chest'), 0.9)
    s.cam(33.35, (0.9, -6.3, 0.45), (-0.45, -2.1, 3.4), 24)
    s.cam(33.95, (0.9, -6.3, 0.45), (-0.45, -2.1, 0.75), 24, e='io')
    s.cam(34.1, (0.9, -6.3, 0.45), (-0.45, -2.1, 0.7), 24)
    s.shake(33.95, 0.3, 1.8)
    s.focus = focus('chest')
    s.props = lambda ctx, t: splats(ctx, t, 0.0)
    s.add_fx('dust', 33.95, 34.4, anchor='hips')
    s.add_sfx(33.95, 'thud', vol=1.0)

    s = add(Shot('s11c', 34.1, 36.49, colls=('gum',), char=(-0.45, -2.1, 25.0), fur=0.8, fstop=3.2))
    p = s.p
    sitg = dict(thighL=(-80, 0, -4), thighR=(-78, 0, 4), shinL=12, shinR=15, hips_loc=(0, 0.02, -0.74), iklegs=0.0)
    p.key(34.1, armL=(0, 20, 10), armR=(0, -20, -10), elbowL=20, elbowR=20, blink=0.5, autoblink=0.0, head=(6, 8, 0), **sitg)
    p.key(34.3, blink=0.0, head=(0, -6, 0), smile=0.6, autoblink=1.0)
    p.key(34.42, 'io', chest=(6, 0, 0), armL=(0, 50, 10), armR=(0, -50, -10), elbowL=60, elbowR=60, head=(5, 0, 0))     # anticipation
    p.key(34.62, 'back', chest=(-8, 0, 0), spine=(-6, 0, 0), armL=(0, -78, 12), armR=(0, 78, -12), elbowL=18, elbowR=18,
          curlL=0.0, curlR=0.0, indexL=0.0, indexR=0.0, thumbL=0.0, thumbR=0.0, smile=1.0, squint=0.7, jaw=9, wide=0.3, brow=0.9,
          head=(-8, 0, 0))
    for i, tt in enumerate(np.arange(34.9, 36.5, 0.4)):
        a = 1 if i % 2 == 0 else -1
        p.key(float(tt), 'io', head=(-6, 6 * a, 4 * a), chest=(-8, 0, 3 * a), armL=(0, -78 + 6 * a, 12), armR=(0, 78 + 6 * a, -12))
    s.cam(34.1, (-0.05, -4.1, 0.72), (-0.45, -2.1, 0.78), 28)
    s.cam(36.49, (-0.15, -3.45, 0.78), (-0.45, -2.1, 0.85), 34)
    s.focus = focus('face')
    s.props = lambda ctx, t: splats(ctx, t, 0.0)
    s.add_fx('confetti', 34.6, 36.49)
    s.add_fx('sparkle', 34.62, 35.6, anchor='head_top', size=1.6, count=5)
    s.add_sfx(34.6, 'partyhorn')
    s.add_sfx(34.75, 'fanfare')

    # ============================================================ SCENE 12  under the rock
    UNDER = Vector((-0.2, -0.33, 0.772))
    s = add(Shot('s12a', 36.49, 37.45, colls=('gum', 'under_gum'), fur=0.8, fstop=2.6))
    p = s.p
    p.key(36.49, ikR=1.0, curlR=0.7, indexR=0.6, thumbR=0.6, ikfwdR=(0.3, -0.6, 0.75), ikpalmR=(0.6, 0.6, -0.2), poleR=(-0.6, 0.2, 1.0),
          pucker=0.3, brow=0.6, look=(0, 0), autoblink=0.0)
    p.key(36.7, look=(28, 6), head=(0, 0, 10))
    p.key(36.88, look=(-28, 6), head=(0, 0, -10))
    p.key(37.02, look=(0, 22), head=(10, 0, 0), spine=(8, 0, -4))
    p.key(37.3, ikfwdR=(0.35, -0.3, 0.1), ikpalmR=(0, 0, 1))
    p.key(37.45, look=(10, 8), head=(6, 0, 4), smile=0.4)

    def ik(ctx, side, t, pos):
        if side != 'R':
            return pos
        m = ctx.ch.anchor('mouth') + Vector((-0.03, -0.06, -0.04))
        if t < 37.0:
            return m
        return m.lerp(UNDER + Vector((0, 0, -0.03)), u_(t, 37.0, 37.32))
    s.ik = ik
    s.cam(36.49, (0.42, -1.25, 1.36), (0.0, -0.2, 1.27), 24)
    s.cam(37.45, (0.38, -1.2, 1.3), (0.0, -0.28, 1.18), 25)
    s.focus = focus('head')

    def gum12(ctx, t):
        o = O['gum_piece']
        o.hide_render = False
        if t < 37.33:
            ctx.attach('gum_piece', 'R', Matrix.Translation((0.06, 0.015, 0.0)), scale=0.9)
        else:
            o.matrix_world = Matrix.Translation(UNDER + Vector((0, 0, -0.004))) @ Matrix.Diagonal((1.2, 1.2, 0.5, 1))
    s.props = gum12
    s.add_sfx(37.34, 'squish')

    s = add(Shot('s12b', 37.45, 38.25, colls=('gum', 'under_gum'), fur=0.5, fstop=4.5))
    p = s.p
    p.key(37.45, ikR=1.0, curlR=0.3, indexR=0.2, thumbR=0.3, ikfwdR=(0.35, -0.3, 0.1), ikpalmR=(0, 0, 1), poleR=(-0.6, 0.2, 1.0),
          look=(10, 8), head=(6, 0, 4), spine=(8, 0, -4), smile=0.4)
    p.key(37.75, ikR=1.0)
    p.key(38.05, 'io', ikR=0.0, curlR=0.3)

    def ik(ctx, side, t, pos):
        if side != 'R':
            return pos
        return UNDER + Vector((0, 0, -0.03)) + Vector((-0.1, -0.15, -0.1)) * u_(t, 37.7, 38.0)
    s.ik = ik
    s.cam(37.45, (0.2, -1.25, 0.86), (0.0, -0.6, 0.82), 24)
    s.cam(37.95, (0.12, -1.13, 0.44), (-0.05, -0.55, 0.8), 20)
    s.cam(38.25, (0.11, -1.1, 0.43), (-0.05, -0.55, 0.8), 20)
    s.focus = lambda ctx, t: Vector((0.0, -0.62, 0.78))
    s.props = gum12

    s = add(Shot('s12c', 38.25, 38.97, colls=('gum', 'under_gum'), fur=1.0, fstop=2.0))
    p = s.p
    p.key(38.25, look=(0, -2), head=(0, 6, 4), grimace=0.5, smile=0.7, squint=0.3, brow=0.9, clavL=(0, -6, 0), clavR=(0, 6, 0))
    p.key(38.5, 'io', clavL=(0, -14, 0), clavR=(0, 14, 0), head=(-2, 8, 6))
    p.key(38.97, clavL=(0, -10, 0), clavR=(0, 10, 0), head=(-2, 9, 6), smile=0.8)
    s.cam(38.25, (0.05, -0.55, 1.67), (0.0, 0.09, 1.69), 44)
    s.cam(38.97, (0.05, -0.5, 1.675), (0.0, 0.09, 1.69), 48)
    s.focus = focus('face')
    s.add_sfx(38.3, 'ding')
    s.add_fx('sparkle', 38.3, 38.9, anchor='mouth', size=0.9, dx=0.07)
    s.props = lambda ctx, t: None
    return S
