"""Animation engine: tracks with easing, character driver, camera driver, anchors."""
import math, json
import numpy as np
import bpy
from mathutils import Matrix, Vector, Euler, Quaternion
from bpy_extras.object_utils import world_to_camera_view

FPS = 30



# ------------------------------------------------------------------ easing
def ease(kind, u):
    u = min(max(u, 0.0), 1.0)
    if kind == 'lin':
        return u
    if kind == 'i':
        return u * u * u
    if kind == 'o':
        return 1 - (1 - u) ** 3
    if kind == 'io':
        return u * u * (3 - 2 * u) if u < 1 else 1.0
    if kind == 'io2':
        return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2
    if kind == 'back':   # overshoot then settle
        c1 = 1.9; c3 = c1 + 1
        return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2
    if kind == 'elastic':
        if u in (0, 1):
            return u
        return 2 ** (-9 * u) * math.sin((u * 10 - 0.75) * (2 * math.pi) / 3) + 1
    if kind == 'step':
        return 1.0 if u >= 1 else 0.0
    if kind == 'bounce':
        n1, d1 = 7.5625, 2.75
        if u < 1 / d1:
            return n1 * u * u
        if u < 2 / d1:
            u -= 1.5 / d1; return n1 * u * u + 0.75
        if u < 2.5 / d1:
            u -= 2.25 / d1; return n1 * u * u + 0.9375
        u -= 2.625 / d1; return n1 * u * u + 0.984375
    return u * u * (3 - 2 * u)


class Track:
    def __init__(self):
        self.keys = []

    def add(self, t, v, e='io'):
        self.keys.append((t, np.atleast_1d(np.asarray(v, float)) if not isinstance(v, str) else v, e))
        self.keys.sort(key=lambda k: k[0])

    def at(self, t):
        K = self.keys
        if not K:
            return None
        if isinstance(K[0][1], str):
            val = K[0][1]
            for kt, kv, _ in K:
                if kt <= t:
                    val = kv
            return val
        if t <= K[0][0]:
            return K[0][1]
        for i in range(len(K) - 1):
            t0, v0, _ = K[i]
            t1, v1, e = K[i + 1]
            if t <= t1:
                u = (t - t0) / max(t1 - t0, 1e-6)
                return v0 + (v1 - v0) * ease(e, u)
        return K[-1][1]


class Perf:
    """A bag of channel tracks. key(t, ease, chan=value, ...)."""

    def __init__(self):
        self.tr = {}

    def key(self, t, e='io', **ch):
        for k, v in ch.items():
            self.tr.setdefault(k, Track()).add(t, v, e)
        return self

    def hold(self, t, *names):
        """re-key current values at t (so the next key starts from here)."""
        for n in names:
            v = self.tr[n].at(t)
            self.tr[n].add(t, v, 'io')
        return self

    def get(self, t, name, default=None):
        tr = self.tr.get(name)
        if tr is None or not tr.keys:
            return default
        v = tr.at(t)
        if isinstance(v, np.ndarray) and v.size == 1:
            return float(v[0])
        return v


# ------------------------------------------------------------------ character
DEF = dict(
    root=(0, 0, 0), root_rot=(0, 0, 0), hips_loc=(0, 0, 0), hips=(0, 0, 0), spine=(0, 0, 0), chest=(0, 0, 0),
    neck=(0, 0, 0), head=(0, 0, 0), jaw=0.0,
    smile=0.0, frown=0.0, O=0.0, pucker=0.0, grimace=0.0, wide=0.0, puff=0.0,
    brow=0.0, browL=0.0, browR=0.0, angry=0.0, sad=0.0,
    blink=0.0, lidwide=0.0, squint=0.0, sleepy=0.0, look=(0, 0),
    armL=(0, 44, 5), armR=(0, -44, -5), elbowL=14.0, elbowR=14.0, handL=(0, 0, 0), handR=(0, 0, 0),
    clavL=(0, 0, 0), clavR=(0, 0, 0),
    ikL=0.0, ikR=0.0, ikposL=(0.25, -0.25, 1.1), ikposR=(-0.25, -0.25, 1.1),
    ikfwdL=(0, -1, 0), ikfwdR=(0, -1, 0), ikpalmL=(-1, 0, 0), ikpalmR=(1, 0, 0),
    poleL=(0.55, 0.45, 1.15), poleR=(-0.55, 0.45, 1.15),
    curlL=0.25, curlR=0.25, indexL=0.25, indexR=0.25, thumbL=0.1, thumbR=0.1,
    iklegs=1.0, footL=(0, 0, 0), footR=(0, 0, 0), footrotL=(0, 0, 0), footrotR=(0, 0, 0),
    kneeL=(0.11, -0.6, 0.5), kneeR=(-0.11, -0.6, 0.5),
    thighL=(0, 0, 0), thighR=(0, 0, 0), shinL=0.0, shinR=0.0,
    chew=0.0, chew_rate=2.2, chew_open=9.0, breathe=1.0, autoblink=1.0, idle=1.0, beard_stretch=0.0,
    winkL=0.0, winkR=0.0, lookL=(0, 0), lookR=(0, 0), beard_rot=(0, 0, 0), hair_rot=(0, 0, 0), chew_nod=2.0,
)


def smooth_noise(t, seed, freq=0.5):
    return (math.sin(t * freq * 6.283 + seed) * 0.6 + math.sin(t * freq * 2.71 * 6.283 + seed * 2.3) * 0.3 +
            math.sin(t * freq * 5.13 * 6.283 + seed * 4.1) * 0.1)


class Spring:
    def __init__(self, k=60.0, d=7.0):
        self.k, self.d = k, d
        self.x = None
        self.v = 0.0

    def step(self, target, dt):
        if self.x is None:
            self.x = np.array(target, float); self.v = np.zeros_like(self.x)
        a = self.k * (np.asarray(target) - self.x) - self.d * self.v
        self.v = self.v + a * dt
        self.x = self.x + self.v * dt
        return self.x


class Character:
    def __init__(self, rig, lm):
        self.rig = rig
        self.ob = rig.ob
        self.L = lm
        self.blinks = self._blink_times()
        # finger curl axes (armature space, rest)
        a, n = np.array(lm['hand_a']), np.array(lm['hand_n'])
        M = np.diag([-1, 1, 1])
        self.curl_axis = {'L': Vector(np.cross(a, n)), 'R': Vector(np.cross(M @ a, M @ n))}
        ua = np.array(lm['ua_dir'])
        self.elbow_axis = {'L': Vector(np.cross(ua, [0, -1, 0])).normalized(),
                           'R': Vector(np.cross(M @ ua, [0, -1, 0])).normalized()}
        self.palm = {'L': n, 'R': M @ n}
        self.fing = {'L': a, 'R': M @ a}
        self.sec = None

    def _blink_times(self):
        rr = np.random.default_rng(4)
        t, out = 0.4, []
        while t < 60:
            out.append(t)
            t += rr.uniform(2.2, 4.2)
        return out

    def autoblink(self, t):
        for b in self.blinks:
            d = t - b
            if 0 <= d < 0.16:
                return math.sin(d / 0.16 * math.pi)
        return 0.0

    # ---------------- secondary motion precompute over a shot
    def precompute_secondary(self, perf, t0, t1):
        dt = 1.0 / FPS
        sb = Spring(70, 8); sh = Spring(55, 6.5); ss = Spring(80, 9)
        out = {}
        prev = None
        t = t0 - 0.6
        while t <= t1 + 1e-6:
            head = np.array(self.val(perf, t, 'head')) + np.array(self.val(perf, t, 'neck')) + np.array(self.val(perf, t, 'chest')) * 0.7 + np.array(self.val(perf, t, 'spine')) * 0.5
            root = np.array(self.val(perf, t, 'root')) + np.array(self.val(perf, t, 'hips_loc'))
            hips = np.array(self.val(perf, t, 'hips'))
            jaw = self.val(perf, t, 'jaw')
            # targets: what the hanging part would do if it moved rigidly (in degrees) + inertia from root motion
            if prev is None:
                prev = root.copy(); vel = np.zeros(3)
            vel_new = (root - prev) / dt
            prev = root.copy()
            vb = sb.step(np.concatenate([head[:2], [jaw * 0.3], vel_new]), dt)
            vh = sh.step(np.concatenate([head[:3], vel_new]), dt)
            vs = ss.step(np.concatenate([hips, vel_new]), dt)
            if t >= t0 - 1e-6:
                beard = (vb[:2] - head[:2]) * 0.9
                beard_lift = -vb[5] * 18 - (vb[4]) * 6       # vertical / forward motion -> swing
                hair = (vh[:3] - head[:3]) * 0.8
                hair_lift = -vh[5] * 14
                skirt = (vs[:3] - hips) * 0.8
                skirt_lift = -vs[5] * 25 - vs[4] * 10
                out[round(t * FPS)] = dict(beard=(beard[0] + beard_lift, beard[1], 0), hair=(hair[0] + hair_lift, hair[1], hair[2] * 0.5),
                                           skirt=(skirt[0] + skirt_lift, skirt[1], 0))
            t += dt
        self.sec = out

    def val(self, perf, t, name):
        v = perf.get(t, name)
        return DEF[name] if v is None else v

    # ---------------- apply
    def apply(self, perf, t, frame, anchors_cb=None):
        r = self.rig
        V = lambda n: self.val(perf, t, n)
        r.reset()
        idle = V('idle'); br = V('breathe')
        breath = math.sin(t * 2 * math.pi / 3.4) * br
        sway = smooth_noise(t, 1.3, 0.25) * idle
        # torso
        r.loc('root', V('root'))
        rr_ = V('root_rot')
        r.rot('root', rr_)
        hl = np.array(V('hips_loc')) + np.array([0.004 * sway, 0, 0.003 * breath])
        r.loc('hips', hl)
        r.rot('hips', np.array(V('hips')) + np.array([0, 0.8 * sway, 0]))
        r.rot('spine', np.array(V('spine')) + np.array([0.6 * breath, -0.5 * sway, 0]))
        r.rot('chest', np.array(V('chest')) + np.array([-1.0 * breath, -0.4 * sway, 0]))
        hd = np.array(V('head')) + np.array([1.2 * smooth_noise(t, 3.1, 0.3) * idle, 0.8 * smooth_noise(t, 5.7, 0.22) * idle, 1.5 * smooth_noise(t, 7.9, 0.2) * idle])
        nk = np.array(V('neck'))
        r.rot('neck', nk + hd * 0.35)
        r.rot('head', hd * 0.65)
        # jaw / chew
        jaw = V('jaw')
        ch = V('chew')
        puff = V('puff')
        if ch > 0:
            ph = t * V('chew_rate') * 2 * math.pi
            c = 0.5 - 0.5 * math.cos(ph)
            jaw += ch * V('chew_open') * c
            puff = max(puff, ch * (0.55 + 0.25 * math.sin(ph + 1.2)))
            hd = hd + np.array([ch * V('chew_nod') * c, 0, 0])
            r.rot('neck', nk + hd * 0.35)
            r.rot('head', hd * 0.65)
        r.rot('jaw', (jaw, 0, 0))
        for nm in ('smile', 'frown', 'O', 'pucker', 'grimace', 'wide'):
            r.shape(nm, max(0.0, min(1.2, V(nm))))
        for s, sx in (('L', 1), ('R', -1)):
            sm = V('smile')
            r.loc('cheek.' + s, (0.007 * puff * sx + 0.002 * sm * sx, -0.006 * puff - 0.002 * sm, -0.001 * puff + 0.004 * sm))
            r.scale('cheek.' + s, 1 + 0.45 * puff)
        # brows
        for s, sx in (('L', 1), ('R', -1)):
            up = V('brow') + V('brow' + s)
            ang = V('angry'); sad = V('sad')
            r.loc('brow.' + s, (0, 0, 0.0065 * up - 0.0035 * ang + 0.002 * sad))
            r.rot('brow.' + s, (0, sx * (-20 * ang + 18 * sad), 0))
        # eyes / lids
        look = V('look')
        lk = np.array(look, float)
        blink = max(V('blink'), self.autoblink(t) * V('autoblink'))
        wide = V('lidwide'); sq = V('squint'); sl = V('sleepy')
        for s in ('L', 'R'):
            lks = lk + np.array(V('look' + s), float)
            r.rot('eye.' + s, (lks[1], 0, lks[0]))
            up_open = -16 * wide + 22 * sl + 6 * sq + 0.45 * max(lks[1], 0) - 0.2 * max(-lks[1], 0)
            lo_open = 5 * wide - 9 * sq - 3 * sl
            bl = max(blink, V('wink' + s))
            up = up_open + (40 - up_open) * bl
            lo = lo_open + (-15 - lo_open) * bl
            r.rot('lidU.' + s, (up, 0, 0))
            r.rot('lidL.' + s, (lo, 0, 0))
        # arms (FK base)
        for s in ('L', 'R'):
            r.rot('clavicle.' + s, V('clav' + s))
            r.rot('upperarm.' + s, V('arm' + s))
            r.rot_q('forearm.' + s, Matrix.Rotation(math.radians(V('elbow' + s)), 3, self.elbow_axis[s]))
            r.rot('hand.' + s, V('hand' + s))
            ax = self.curl_axis[s]
            cu = V('curl' + s); ix = V('index' + s); th = V('thumb' + s)
            r.rot_q('fingers1.' + s, Matrix.Rotation(math.radians(75 * cu), 3, ax))
            r.rot_q('fingers2.' + s, Matrix.Rotation(math.radians(85 * cu), 3, ax))
            r.rot_q('index1.' + s, Matrix.Rotation(math.radians(75 * ix), 3, ax))
            r.rot_q('index2.' + s, Matrix.Rotation(math.radians(85 * ix), 3, ax))
            tax = Vector(self.palm[s]).cross(Vector(self.fing[s])) * (1 if s == 'L' else -1)
            r.rot_q('thumb1.' + s, Matrix.Rotation(math.radians(-35 * th), 3, Vector(self.fing[s])) @ Matrix.Rotation(math.radians(20 * th), 3, ax))
            r.rot_q('thumb2.' + s, Matrix.Rotation(math.radians(50 * th), 3, ax))
        # legs
        il = V('iklegs')
        for s in ('L', 'R'):
            r.ik('shin.' + s, il)
            rest_ankle = Vector(self.ob.data.bones['foot_ik.' + s].head_local)
            r.loc('foot_ik.' + s, Vector(V('foot' + s)))
            r.rot('foot_ik.' + s, V('footrot' + s))
            kp = Vector(V('knee' + s)) - Vector(self.ob.data.bones['knee_pole.' + s].head_local)
            r.loc('knee_pole.' + s, kp)
            r.rot('thigh.' + s, V('thigh' + s))
            r.rot_q('shin.' + s, Matrix.Rotation(math.radians(V('shin' + s)), 3, Vector((1, 0, 0))))
        # secondary
        if self.sec is not None and frame in self.sec:
            sc = self.sec[frame]
            bs = V('beard_stretch')
            r.rot('beard_tip', np.array(sc['beard']) + np.array([-bs * 25, 0, 0]) + np.array(V('beard_rot')))
            r.scale('beard_tip', (1, 1 + bs * 0.9, 1))
            r.rot('hair_back', np.array(sc['hair']) + np.array(V('hair_rot')))
            r.rot('skirt_F', np.array(sc['skirt']) * 0.8)
            r.rot('skirt_B', np.array(sc['skirt']) * 0.8)
        bpy.context.view_layer.update()
        # arm IK (targets may depend on the posed body)
        need = False
        for s in ('L', 'R'):
            ik = V('ik' + s)
            if ik > 0.001:
                Rw = self.ob.matrix_world.to_3x3()
                Ri = Rw.inverted()
                pos = self.ob.matrix_world @ Vector(V('ikpos' + s))      # character-local -> world
                if anchors_cb is not None:
                    pos = anchors_cb(s, t, pos)
                fwd_w = (Rw @ Vector(V('ikfwd' + s))).normalized()
                palm_w = Rw @ Vector(V('ikpalm' + s))
                palm_w = (palm_w - fwd_w * palm_w.dot(fwd_w)).normalized()
                # pos is the grip point (palm centre) in world space -> wrist
                wrist_w = Vector(pos) - fwd_w * 0.078 - palm_w * 0.03
                wrist = self.ob.matrix_world.inverted() @ wrist_w
                fwd = (Ri @ fwd_w).normalized(); palm = (Ri @ palm_w).normalized()
                a0 = Vector(self.fing[s]); n0 = Vector(self.palm[s])
                n0 = (n0 - a0 * n0.dot(a0)).normalized()
                Rd = Matrix((fwd, palm, fwd.cross(palm))).transposed()
                R0 = Matrix((a0, n0, a0.cross(n0))).transposed()
                Rm = Rd @ R0.transposed()
                b = self.ob.data.bones['hand_ik.' + s]
                r.loc('hand_ik.' + s, wrist - b.head_local)
                r.rot_q('hand_ik.' + s, Rm)
                pl = Vector(V('pole' + s)) - self.ob.data.bones['elbow_pole.' + s].head_local
                r.loc('elbow_pole.' + s, pl)
                r.ik('forearm.' + s, ik)
                need = True
        if need:
            bpy.context.view_layer.update()

    # ---------------- anchors
    def point(self, bone, rest_pt):
        pb = self.ob.pose.bones[bone]
        m = self.ob.matrix_world @ pb.matrix @ pb.bone.matrix_local.inverted()
        return m @ Vector(rest_pt)

    def anchor(self, name):
        L = self.L
        if name == 'mouth':
            return (self.point('head', L['mouth'] + np.array([0, -0.012, 0.004])) + self.point('jaw', L['mouth'] + np.array([0, -0.012, -0.006]))) / 2
        if name == 'mouth_lo':
            return self.point('jaw', L['mouth'] + np.array([0, -0.01, -0.012]))
        if name == 'head_top':
            return self.point('head', (0, -0.01, 1.92))
        if name == 'head':
            return self.point('head', (0, -0.04, 1.74))
        if name == 'face':
            return self.point('head', (0, -0.09, 1.71))
        if name == 'nose':
            return self.point('head', (0, -0.13, 1.69))
        if name == 'eyeL':
            return self.point('head', L['eye'])
        if name == 'eyeR':
            return self.point('head', L['eye'] * np.array([-1, 1, 1]))
        if name == 'chin':
            return self.point('jaw', (0, -0.11, 1.61))
        if name == 'beard':
            return self.point('beard_tip', (0, -0.15, 1.52))
        if name == 'beard_low':
            return self.point('beard_tip', (0, -0.13, 1.44))
        if name == 'throat':
            return self.point('neck', (0, -0.07, 1.58))
        if name == 'chest':
            return self.point('chest', (0, -0.15, 1.38))
        if name.startswith('hand'):
            s = name[-1]
            pb = self.ob.pose.bones['hand.' + s]
            return self.ob.matrix_world @ (pb.matrix @ Vector((0, pb.length * 1.05, 0)))
        if name.startswith('palm'):
            s = name[-1]
            pb = self.ob.pose.bones['hand.' + s]
            n = Vector(self.palm[s]); a = Vector(self.fing[s])
            m = self.ob.matrix_world @ pb.matrix @ pb.bone.matrix_local.inverted()
            p = Vector(L['wrist']) * (Vector((1, 1, 1)) if s == 'L' else Vector((-1, 1, 1)))
            return m @ (p + a * 0.075 + n * 0.035)
        if name.startswith('index_tip'):
            s = name[-1]
            pb = self.ob.pose.bones['index2.' + s]
            return self.ob.matrix_world @ (pb.matrix @ Vector((0, pb.length + 0.008, 0)))
        if name.startswith('thumb_tip'):
            s = name[-1]
            pb = self.ob.pose.bones['thumb2.' + s]
            return self.ob.matrix_world @ (pb.matrix @ Vector((0, pb.length + 0.008, 0)))
        if name == 'hips':
            return self.point('hips', (0, 0, 0.98))
        if name.startswith('foot'):
            s = name[-1]
            return self.point('foot.' + s, (0.11 * (1 if s == 'L' else -1), -0.05, 0.03))
        raise KeyError(name)

    def hand_matrix(self, s):
        """world matrix of the hand in the 'grip' frame: x=finger dir, y=palm normal, origin in the palm."""
        pb = self.ob.pose.bones['hand.' + s]
        m = self.ob.matrix_world @ pb.matrix @ pb.bone.matrix_local.inverted()
        a = Vector(self.fing[s]); n = Vector(self.palm[s])
        R = Matrix((a, n, a.cross(n))).transposed().to_4x4()
        p = Vector(self.L['wrist']) * (Vector((1, 1, 1)) if s == 'L' else Vector((-1, 1, 1)))
        R.translation = p + a * 0.08 + n * 0.03
        return m @ R


# ------------------------------------------------------------------ camera
class Cam:
    def __init__(self, co):
        self.co = co
        self.keys = Perf()
        self.shakes = []
        self.focus = None
        self.fstop = 2.8

    def key(self, t, eye=None, tgt=None, lens=None, roll=None, e='io'):
        kw = {}
        if eye is not None: kw['eye'] = eye
        if tgt is not None: kw['tgt'] = tgt
        if lens is not None: kw['lens'] = lens
        if roll is not None: kw['roll'] = roll
        self.keys.key(t, e, **kw)
        return self

    def shake(self, t, dur=0.35, amp=1.0, freq=18.0):
        self.shakes.append((t, dur, amp, freq))
        return self

    def apply(self, t, focus_point=None, track=None):
        eye = Vector(self.keys.get(t, 'eye'))
        tgt = Vector(self.keys.get(t, 'tgt'))
        if track is not None:
            tgt = tgt.lerp(Vector(track[0]), track[1])
        lens = self.keys.get(t, 'lens', 35.0)
        roll = self.keys.get(t, 'roll', 0.0) or 0.0
        sx = sy = 0.0
        for (ts, d, a, f) in self.shakes:
            if ts <= t < ts + d:
                env = (1 - (t - ts) / d) ** 2 * a
                sx += env * math.sin((t - ts) * f * 6.28) * 0.9
                sy += env * math.sin((t - ts) * f * 1.37 * 6.28 + 1.0) * 0.7
        # gentle handheld drift
        sx += 0.12 * smooth_noise(t, 11.0, 0.35)
        sy += 0.10 * smooth_noise(t, 13.0, 0.3)
        q = (tgt - eye).to_track_quat('-Z', 'Y')
        q = q @ Quaternion((0, 0, 1), math.radians(roll)) @ Quaternion((1, 0, 0), math.radians(sy)) @ Quaternion((0, 1, 0), math.radians(sx))
        self.co.location = eye
        self.co.rotation_euler = q.to_euler()
        self.co.data.lens = lens
        d = self.co.data.dof
        if focus_point is not None:
            d.use_dof = True
            d.focus_distance = max((Vector(focus_point) - eye).length, 0.05)
            d.aperture_fstop = self.fstop
        else:
            d.use_dof = False


def project(scene, cam, p):
    v = world_to_camera_view(scene, cam, Vector(p))
    return (v.x, 1 - v.y, v.z)
