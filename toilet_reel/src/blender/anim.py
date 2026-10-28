"""Animation framework: easing keys, procedural walk, character pose builder, camera rig."""
import math
import random
import bpy
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler, noise
import rig_core as RC
import poses as PO

FPS = 30
q = RC.qeuler
BASE_SPINE = dict(spine=(6, 0, 0), chest=(12, 0, 0), neck=(14, 0, 0), head=(-22, 0, 0))


# ------------------------------------------------------------------ easing
def clamp01(x):
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def smooth(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def ease(x, kind='io'):
    x = clamp01(x)
    if kind == 'lin':
        return x
    if kind == 'in':
        return x * x * x
    if kind == 'out':
        return 1 - (1 - x) ** 3
    if kind == 'back':      # overshoot then settle (follow-through)
        c1 = 1.70158 * 1.3
        c3 = c1 + 1
        return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
    if kind == 'antic':     # small wind-up before moving
        c1 = 1.4
        return (c1 + 1) * x ** 3 - c1 * x ** 2
    if kind == 'snap':      # quick out with a tiny bounce
        if x < 0.6:
            return 1 - (1 - x / 0.6) ** 3
        return 1 + 0.06 * math.sin((x - 0.6) / 0.4 * math.pi) * (1 - (x - 0.6) / 0.4)
    if kind == 'hold':
        return 0.0
    # in-out (smootherstep)
    return x * x * x * (x * (x * 6 - 15) + 10)


def _lerp(a, b, u):
    if a is None:
        return b
    if b is None:
        return a
    if isinstance(a, (int, float)):
        return a + (b - a) * u
    if isinstance(a, str):
        return a if u < 0.5 else b
    if isinstance(a, dict):
        keys = set(a) | set(b)
        return {k: _lerp(a.get(k, 0.0), b.get(k, 0.0), u) for k in keys}
    return tuple(x + (y - x) * u for x, y in zip(a, b))


class Keys:
    """Keys((t, value[, ease]), ...) -> value(t). ease applies to the segment ending at that key."""

    def __init__(self, *keys):
        self.k = [(k[0], k[1], k[2] if len(k) > 2 else 'io') for k in keys]
        self.k.sort(key=lambda x: x[0])

    def __call__(self, t):
        k = self.k
        if t <= k[0][0]:
            return k[0][1]
        if t >= k[-1][0]:
            return k[-1][1]
        for i in range(len(k) - 1):
            if k[i][0] <= t <= k[i + 1][0]:
                t0, v0, _ = k[i]
                t1, v1, e = k[i + 1]
                u = ease((t - t0) / max(1e-6, t1 - t0), e)
                return _lerp(v0, v1, u)


def osc(t, freq, amp, phase=0.0):
    return amp * math.sin(2 * math.pi * freq * t + phase)


def nz(t, speed=1.0, seed=0.0):
    return noise.noise(Vector((t * speed, seed, seed * 0.37)))


def blink_value(t, seed=1, times=None):
    """procedural blinks: ~every 2.6-4 s, 0.16 s long (fast close, slower open)."""
    rng = random.Random(seed)
    if times is None:
        times = []
        x = rng.uniform(0.3, 1.4)
        while x < 60:
            times.append(x)
            x += rng.uniform(2.3, 3.9)
    v = 0.0
    for b in times:
        d = t - b
        if 0 <= d < 0.07:
            v = max(v, d / 0.07)
        elif 0.07 <= d < 0.19:
            v = max(v, 1 - (d - 0.07) / 0.12)
    return v


# ------------------------------------------------------------------ walking
class Walk:
    """Procedural walk along waypoints between t0 and t1 with planted feet.

    pts: list of (x, y); heading follows the path. Returns per-time: root (x,y,heading), feet world
    positions/headings, hip bob and arm swing phase."""

    def __init__(self, pts, t0, t1, step=0.42, lift=0.07, bob=0.02, stance_w=0.10, heading_override=None):
        self.pts = [np.array(p, float) for p in pts]
        self.t0, self.t1 = t0, t1
        seg = [np.linalg.norm(self.pts[i + 1] - self.pts[i]) for i in range(len(self.pts) - 1)]
        self.L = sum(seg)
        self.cum = np.concatenate([[0], np.cumsum(seg)])
        self.nsteps = max(2, int(math.ceil(self.L / step)) + 1)
        self.step = self.L / (self.nsteps - 1)
        self.lift, self.bob, self.w = lift, bob, stance_w
        self.hover = heading_override
        # footfall arc-length positions: alternating feet
        self.falls = []
        for i in range(self.nsteps + 1):
            s = min(self.L, i * self.step)
            self.falls.append(s)

    def s_at(self, t):
        u = clamp01((t - self.t0) / (self.t1 - self.t0))
        # ease-in/out of the walking speed
        return self.L * ease(u, 'io')

    def point(self, s):
        s = max(0.0, min(self.L, s))
        i = int(np.searchsorted(self.cum, s, side='right') - 1)
        i = min(i, len(self.pts) - 2)
        a, b = self.pts[i], self.pts[i + 1]
        seg = max(1e-6, self.cum[i + 1] - self.cum[i])
        u = (s - self.cum[i]) / seg
        p = a + (b - a) * u
        d = (b - a) / seg
        heading = math.degrees(math.atan2(d[0], -d[1]))     # facing -Y at 0
        return p, heading

    def root(self, t):
        s = self.s_at(t)
        p, h = self.point(s)
        if self.hover is not None:
            h = self.hover
        return p, h

    def phase(self, t):
        """continuous step phase: 0..nsteps (integer = a footfall)."""
        return self.s_at(t) / self.step

    def feet(self, t):
        """world (x, y, lift) + heading for L and R feet."""
        ph = self.phase(t)
        out = {}
        for side, sgn, off in (('L', 1, 0), ('R', -1, 1)):
            # foot k (even for L, odd for R) lands at falls[k]
            k_prev = (int((ph - off) // 2)) * 2 + off
            k_next = k_prev + 2
            k_prev = max(off - 2, k_prev)
            fa = self.falls[max(0, min(len(self.falls) - 1, k_prev))] if k_prev >= 0 else 0.0
            fb = self.falls[max(0, min(len(self.falls) - 1, k_next))]
            # swing happens during the phase window [k_prev+1, k_next]
            sw = clamp01((ph - (k_prev + 1)) / 1.0)
            u = ease(sw, 'io')
            s = fa + (fb - fa) * u
            p, h = self.point(s)
            nrm = np.array([math.cos(math.radians(h)), math.sin(math.radians(h))])
            p = p + nrm * self.w * sgn
            lift = self.lift * math.sin(math.pi * sw) if 0 < sw < 1 else 0.0
            out[side] = (p[0], p[1], lift, h)
        return out

    def hip_bob(self, t):
        ph = self.phase(t)
        moving = smooth((t - self.t0) / 0.3) * smooth((self.t1 - t) / 0.3)
        return -self.bob * abs(math.sin(math.pi * ph)) * moving, 0.012 * math.sin(math.pi * ph) * moving


# ------------------------------------------------------------------ character posing
class Char:
    def __init__(self, rig):
        self.rig = rig
        self.sk = RC.Skeleton(rig)
        self.springs = PO.Springs(self.sk)
        self.last_t = None
        sk = self.sk
        self.R_root_rest = sk.rest['root'].to_3x3()

    def root_matrix(self, x, y, heading, z=0.0):
        return (Matrix.Translation((x, y, z)) @ Matrix.Rotation(math.radians(heading), 4, 'Z')
                @ self.sk.rest['root'])

    def pose(self, t, P, sim=True, dt=1.0 / FPS):
        """P: dict spec (see shots.py)."""
        sk = self.sk
        sk.reset()
        x, y, hd = P.get('root', (0.0, 0.0, 0.0))
        rz = P.get('root_z', 0.0)
        Mroot = self.root_matrix(x, y, hd, rz)
        sk.target['root'] = Mroot
        Rw = Matrix.Rotation(math.radians(hd), 3, 'Z')         # root-space -> world rotation
        Tw = Vector((x, y, rz))
        W = lambda p: Rw @ Vector(p) + Tw                      # root-space point -> world

        # breathing + idle
        br = P.get('breath', 1.0)
        b = math.sin(2 * math.pi * t / 3.6)
        hip = Vector(P.get('hip', (0, 0, 0)))
        sk.loc['hips'] = Vector((hip.x, hip.z - 0.018 + 0.002 * b * br, -hip.y))   # hips local: y=up, z=fwd(-Y)
        hr = P.get('hip_rot', (0, 0, 0))
        sk.rot['hips'] = q(*hr)
        for bn in ('spine', 'chest', 'neck', 'head'):
            base = BASE_SPINE[bn]
            v = P.get(bn, (0, 0, 0))
            extra = (0, 0, 0)
            if bn == 'chest':
                extra = (-1.4 * b * br, 0, 0)
            if bn == 'head':
                extra = (0.8 * nz(t, 0.6, 3.1) * br + 0.6 * b * br, 1.2 * nz(t, 0.4, 7.7) * br,
                         0.8 * nz(t, 0.5, 5.3) * br)
            sk.rot[bn] = q(base[0] + v[0] + extra[0], base[1] + v[1] + extra[1], base[2] + v[2] + extra[2])

        # legs (IK). feet in world if 'feetW' else root space
        for side, s in (('L', 1), ('R', -1)):
            rest_foot = sk.rest['foot.' + side]
            rest_ank_rs = rest_foot.to_translation()      # world-aligned root space (rest root = origin)
            if 'feetW' in P and P['feetW'] is not None:
                fx, fy, fl, fh = P['feetW'][side]
                ank = Vector((fx, fy, 0.0)) + Vector((0, 0, rest_ank_rs.z + fl))
                Rf = Matrix.Rotation(math.radians(fh), 3, 'Z')
                fp = P.get('foot_pitch' + side, 0.0)
            else:
                f = P.get('foot' + side, (0, 0, 0, 0))     # offset in root space (dx, dy, lift, dheading)
                ank = W((rest_ank_rs.x + f[0], rest_ank_rs.y + f[1], rest_ank_rs.z + f[2]))
                Rf = Rw @ Matrix.Rotation(math.radians(f[3] if len(f) > 3 else 0.0), 3, 'Z')
                fp = P.get('foot_pitch' + side, 0.0)
            pole = P.get('knee' + side)
            if pole is None:
                hipw = sk.head_pos('thigh.' + side)
                fwd = Rw @ Vector((0, -1, 0))
                pole = (hipw + ank) * 0.5 + fwd * 0.8 + (Rw @ Vector((s * 0.12, 0, 0)))
            else:
                pole = W(pole)
            sk.two_bone('thigh.' + side, 'shin.' + side, ank, pole, flip=True)
            Rrest = self.R_root_rest.inverted() @ rest_foot.to_3x3()     # foot rest relative to root rest
            Rfoot = Rf @ (sk.rest['root'].to_3x3() @ Rrest)
            if fp:
                ax = (Rf @ Vector((1, 0, 0)))
                Rfoot = Matrix.Rotation(math.radians(fp), 3, ax) @ Rfoot
            sk.set_world_rot('foot.' + side, Rfoot, pos=ank)
            tp = P.get('toe' + side, 0.0)
            if tp:
                sk.rot['toe.' + side] = q(tp, 0, 0)

        # arms
        for side, s in (('L', 1), ('R', -1)):
            h = P.get('hand' + side)
            sh = sk.head_pos('upperarm.' + side)
            conv = lambda d: Rw @ Vector(d)
            aim = P.get('aim' + side)
            if h is None:
                swing = P.get('swing' + side, 0.0)
                tgt = sh + Rw @ Vector((s * 0.035, -0.05 - swing, -0.505))
                pole = sh + Rw @ Vector((s * 0.25, 0.45, -0.25))
            else:
                if isinstance(h, dict):
                    space = h.get('space', 'root')
                    if space == 'world':
                        tgt = Vector(h['p']); conv = lambda d: Vector(d)
                    elif space == 'root':
                        tgt = W(h['p'])
                    else:
                        Mb = sk.world(space)
                        Rb = Mb.to_3x3()
                        tgt = Mb @ Vector(h['p']); conv = lambda d, Rb=Rb: Rb @ Vector(d)
                    if 'aim' in h:
                        aim = h['aim']
                elif P.get('handW' + side):
                    tgt = Vector(h)
                else:
                    tgt = W(h)
                pp = P.get('elbow' + side)
                pole = W(pp) if pp is not None else sh + Rw @ Vector((s * 0.45, 0.30, -0.35))
            sk.two_bone('upperarm.' + side, 'forearm.' + side, tgt, pole)
            if aim is not None:
                d, up = aim
                sk.aim('hand.' + side, conv(d), conv(up))
            elif h is None:
                # relaxed hanging hand: continue the forearm with the palm towards the thigh
                fw = sk.target['forearm.' + side]
                d = fw.to_3x3() @ Vector((0, 1, 0))
                sk.aim('hand.' + side, d + Rw @ Vector((0, -0.12, 0)), Rw @ Vector((-s, -0.1, 0)))
            shape = P.get('shape' + side, 'relaxed')
            if isinstance(shape, tuple):
                PO.apply_hand(sk, side, shape[0], blend_to=shape[1], t=shape[2])
            else:
                PO.apply_hand(sk, side, shape)

        # face
        face = dict(PO.NEUTRAL)
        fx = P.get('face', {})
        if isinstance(fx, str):
            fx = PO.EXPR[fx]
        face.update({k: v for k, v in fx.items()})
        lk = P.get('look', (0.0, 0.0))
        if P.get('look_at') is not None:
            Mh = sk.world('head')
            v = Mh.inverted() @ Vector(P['look_at'])
            v = v - Vector((0.0, 0.066, 0.080))          # from between the eyes (head-local)
            yaw = math.degrees(math.atan2(v.x, max(1e-4, v.z)))
            pitch = math.degrees(math.atan2(v.y, max(1e-4, math.hypot(v.x, v.z))))
            lk = (lk[0] + yaw / 28.0, lk[1] + pitch / 22.0)
        face['lookX'] += max(-1.2, min(1.2, lk[0])); face['lookY'] += max(-1.0, min(1.0, lk[1]))
        bl = blink_value(t, P.get('blink_seed', 1)) if P.get('autoblink', True) else 0.0
        PO.apply_face(sk, face, blink=bl)

        # secondary motion springs
        if sim:
            self.springs.wind = Vector(P.get('wind', (0, 0, 0)))
            self.springs.step(dt)
        return sk


# ------------------------------------------------------------------ camera
class CamShot:
    def __init__(self, pos, target, lens, fstop=2.8, focus=None, shakes=(), roll=0.0):
        self.pos, self.target, self.lens = pos, target, lens
        self.fstop, self.focus, self.shakes, self.roll = fstop, focus, shakes, roll

    def at(self, t):
        f = lambda v: v(t) if callable(v) else v
        p = Vector(f(self.pos)); tg = Vector(f(self.target))
        sh = Vector((0, 0, 0)); rl = 0.0
        for (ts, amp, dur, freq) in self.shakes:
            if ts <= t <= ts + dur:
                u = (t - ts) / dur
                a = amp * (1 - u) ** 2
                sh += Vector((nz(t, freq, 1.3), nz(t, freq, 4.1) * 0.5, nz(t, freq, 9.7))) * a
                rl += nz(t, freq, 2.2) * a * 3.0
        return p + sh, tg + sh * 0.3, f(self.lens), f(self.fstop), f(self.focus) if self.focus is not None else None, rl + f(self.roll)


def set_camera(cam, t, cs):
    p, tg, lens, fstop, focus, roll = cs.at(t)
    cam.location = p
    d = tg - p
    rq = d.to_track_quat('-Z', 'Y')
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = rq @ Quaternion((0, 0, 1), roll)
    cam.data.lens = lens
    cam.data.dof.use_dof = fstop is not None and fstop < 60
    if fstop is not None:
        cam.data.dof.aperture_fstop = fstop
    fd = (Vector(focus) - p).length if focus is not None else d.length
    cam.data.dof.focus_distance = fd
    return p, tg
