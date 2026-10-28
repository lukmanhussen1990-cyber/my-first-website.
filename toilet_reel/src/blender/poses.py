"""Face expressions, hand shapes and secondary-motion springs for the caveman rig.

Bone axis facts (from build_character roll setup):
  lid/eye/mouth/lip bones : local X = world -X, Y = world -Y (forward), Z = world +Z
      -> +X rot raises the lid edge / tilts gaze up, +Z rot turns gaze to the character's left
  brow/cheek bones         : local Y = world up, Z = forward, X = world +X
  jaw                      : -X rot opens the mouth
  fingers                  : +X rot curls into the palm
"""
import math
from mathutils import Vector, Quaternion, Euler, Matrix
from rig_core import qeuler

R = math.radians

# ------------------------------------------------------------------ face
NEUTRAL = dict(blinkL=0.0, blinkR=0.0, wide=0.0, squint=0.0, browUp=0.0, browAngry=0.0, browSad=0.0,
               browL=0.0, browR=0.0, smile=0.0, smileL=0.0, smileR=0.0, open=0.0, oh=0.0, grimace=0.0,
               lookX=0.0, lookY=0.0, cheek=0.0, sneer=0.0)

EXPR = {
    'neutral': {},
    'smile': dict(smile=0.8, cheek=0.6, squint=0.25, browUp=0.15),
    'smug': dict(smileL=0.9, smile=0.3, cheek=0.4, squint=0.45, browL=-0.3, browR=0.5, lookX=0.15),
    'shock': dict(wide=1.0, browUp=1.0, open=0.55, oh=0.8),
    'gag': dict(blinkL=1.0, blinkR=1.0, squint=1.0, browAngry=0.6, grimace=1.0, open=0.35, sneer=0.8),
    'angry': dict(browAngry=1.0, squint=0.55, grimace=0.6, open=0.15, sneer=0.4),
    'happy': dict(smile=1.0, cheek=1.0, squint=0.65, browUp=0.4, open=0.45),
    'laugh': dict(smile=1.0, cheek=1.0, squint=0.9, browUp=0.5, open=0.85),
    'relaxed': dict(smile=0.55, cheek=0.4, blinkL=0.42, blinkR=0.42, browUp=0.2),
    'wink': dict(smile=0.9, cheek=0.8, blinkL=1.0, squint=0.3, browL=-0.4, browR=0.3),
    'pain': dict(blinkR=0.9, blinkL=0.35, squint=0.8, browSad=0.9, grimace=1.0, open=0.3),
    'worried': dict(browSad=0.9, wide=0.3, grimace=0.25),
    'effort': dict(squint=0.8, browAngry=0.5, grimace=0.8, blinkL=0.5, blinkR=0.5, sneer=0.5),
    'surprised': dict(wide=0.7, browUp=0.9, open=0.3, oh=0.5),
    'disgust': dict(browAngry=0.5, squint=0.7, sneer=1.0, grimace=0.5, blinkL=0.3, blinkR=0.3),
}


def mix_expr(*weighted):
    """mix_expr(('smile', 0.7), ('shock', 0.3)) or dicts."""
    out = dict(NEUTRAL)
    for e, w in weighted:
        d = EXPR[e] if isinstance(e, str) else e
        for k, v in d.items():
            out[k] = out.get(k, 0.0) + v * w
    return out


def apply_face(sk, f, blink=0.0, talk=0.0):
    """write face controls into skeleton sk (rot/loc dicts)."""
    g = lambda k: f.get(k, 0.0)
    # ---- eyes look
    lx, ly = g('lookX'), g('lookY')
    for side in ('L', 'R'):
        sk.rot['eye.' + side] = qeuler(ly * 22, 0, lx * 28)
    # ---- lids: upper lid close c (1 = closed), lower lid raise
    for side in ('L', 'R'):
        c = max(g('blink' + side), blink) + 0.25 * g('squint') - 0.45 * g('wide')
        c = min(c, 1.05)
        up = -0.66 * c + 0.55 * R(ly * 22)         # radians; lid follows gaze pitch
        lo = 0.20 * g('squint') + 0.22 * max(g('blink' + side), blink) * 0.3 + 0.18 * g('cheek') \
            - 0.10 * g('wide') + 0.25 * R(ly * 22)
        sk.rot['lidU.' + side] = Quaternion((1, 0, 0), up)
        sk.rot['lidD.' + side] = Quaternion((1, 0, 0), lo)
    # ---- brows (L brow outer end at +X)
    for side, s in (('L', 1), ('R', -1)):
        lift = 0.0065 * (g('browUp') + g('brow' + side)) - 0.0035 * g('browAngry') + 0.002 * g('browSad')
        tilt = 16 * g('browAngry') - 14 * g('browSad')     # +: outer end up / inner down
        sk.loc['brow.' + side] = Vector((0, lift, 0.001 * g('browAngry')))
        sk.rot['brow.' + side] = qeuler(0, 0, s * tilt)
    # ---- cheeks
    for side in ('L', 'R'):
        ch = g('cheek') + 0.5 * g('smile' + side) + 0.6 * g('sneer')
        sk.loc['cheek.' + side] = Vector((0, 0.0042 * ch, 0.0018 * ch))
    # ---- mouth corners (local X = world -X; outward for L = -X local)
    for side, s in (('L', 1), ('R', -1)):
        sm = g('smile') + g('smile' + side)
        out = 0.0030 * sm + 0.0030 * g('grimace') - 0.0045 * g('oh')
        up = 0.0042 * sm - 0.0030 * g('grimace') - 0.0015 * g('oh')
        back = 0.0025 * sm + 0.0010 * g('grimace')
        sk.loc['mouth.' + side] = Vector((-s * out, -back, up))
    # ---- jaw & lips
    op = g('open') + 0.25 * talk
    sk.rot['jaw'] = qeuler(-17 * op, 0, 0)
    sk.loc['lipU'] = Vector((0, 0, 0.0022 * g('grimace') + 0.0015 * g('sneer') + 0.001 * g('oh')))
    sk.loc['lipD'] = Vector((0, -0.001 * g('oh'), -0.0022 * g('grimace') - 0.0006 * g('oh')))


# ------------------------------------------------------------------ hands
FINGERS = ('index', 'middle', 'ring', 'pinky')
HAND = {
    #           index        middle       ring         pinky        thumb [x1, x2, x3, z1]
    'relaxed': ([14, 20, 14], [18, 24, 16], [22, 26, 18], [26, 28, 18], [4, 8, 8, -8]),
    'open': ([2, 4, 2], [2, 4, 2], [2, 4, 2], [2, 4, 2], [-6, 0, 0, 10]),
    'spread': ([-4, 2, 2], [-2, 2, 2], [-2, 2, 2], [-4, 2, 2], [-10, -4, 0, 25]),
    'fist': ([82, 95, 70], [85, 98, 70], [88, 98, 70], [90, 95, 70], [-10, -5, -5, -35]),
    'point': ([2, 4, 4], [85, 98, 70], [88, 98, 70], [90, 95, 70], [-10, -5, -5, -35]),
    'thumbsup': ([82, 95, 70], [85, 98, 70], [88, 98, 70], [90, 95, 70], [-10, -5, -5, 35]),
    'grip': ([55, 62, 40], [58, 65, 42], [60, 66, 42], [62, 66, 40], [12, 18, 14, -28]),
    'pinch': ([40, 45, 30], [55, 62, 40], [65, 70, 45], [70, 72, 45], [10, 15, 12, -20]),
    'cup': ([25, 30, 20], [25, 30, 20], [25, 30, 20], [25, 30, 20], [4, 6, 6, -10]),
    'claw': ([30, 40, 30], [30, 40, 30], [32, 42, 30], [34, 42, 30], [-6, 10, 10, 15]),
}


def apply_hand(sk, side, shape, amount=1.0, blend_to=None, t=0.0):
    a = HAND[shape]
    b = HAND[blend_to] if blend_to else None
    for i, f in enumerate(FINGERS):
        for j in range(3):
            v = a[i][j] if b is None else a[i][j] * (1 - t) + b[i][j] * t
            spread = 0.0
            sk.rot[f'{f}{j + 1}.{side}'] = qeuler(v * amount, 0, spread)
    th = a[4] if b is None else [a[4][k] * (1 - t) + b[4][k] * t for k in range(4)]
    s = 1 if side == 'L' else -1
    sk.rot[f'thumb1.{side}'] = qeuler(th[0] * amount, 0, s * th[3] * amount)
    sk.rot[f'thumb2.{side}'] = qeuler(th[1] * amount, 0, 0)
    sk.rot[f'thumb3.{side}'] = qeuler(th[2] * amount, 0, 0)


# ------------------------------------------------------------------ springs (follow-through)
SPRING_CHAINS = {
    'beard': ['beard1', 'beard2', 'beard3'],
    'hairL': ['hair.L1', 'hair.L2'],
    'hairR': ['hair.R1', 'hair.R2'],
    'hairB': ['hair.B1', 'hair.B2'],
    'skirtF': ['skirt.F'], 'skirtB': ['skirt.B'], 'skirtL': ['skirt.L'], 'skirtR': ['skirt.R'],
}
SPRING_K = {'beard': (90.0, 9.0), 'hairL': (70.0, 7.0), 'hairR': (70.0, 7.0), 'hairB': (70.0, 7.0),
            'skirtF': (140.0, 12.0), 'skirtB': (140.0, 12.0), 'skirtL': (140.0, 12.0),
            'skirtR': (140.0, 12.0)}


class Springs:
    """jiggle-bone simulation: each bone's tail is a damped point mass chasing its rest tail."""

    def __init__(self, sk):
        self.sk = sk
        self.state = {}
        self.wind = Vector((0, 0, 0))

    def reset(self):
        self.state = {}

    def step(self, dt, extra_force=None):
        sk = self.sk
        for chain, bones in SPRING_CHAINS.items():
            k, c = SPRING_K[chain]
            for bn in bones:
                base = sk.base_of(bn)              # parent solved (incl. simulated parent)
                head = base.to_translation()
                L = sk.length[bn]
                rest_dir = (base.to_3x3() @ Vector((0, 1, 0))).normalized()
                target = head + rest_dir * L
                st = self.state.get(bn)
                if st is None:
                    st = [target.copy(), Vector((0, 0, 0))]
                pos, vel = st
                f = (target - pos) * k - vel * c
                if extra_force is not None:
                    f += extra_force(chain, bn)
                f += self.wind * (1.0 if chain.startswith(('beard', 'hair')) else 0.4)
                vel = vel + f * dt
                pos = pos + vel * dt
                # keep length
                d = pos - head
                if d.length < 1e-6:
                    d = rest_dir.copy()
                pos = head + d.normalized() * L
                self.state[bn] = [pos, vel]
                # rotation taking rest_dir to d (in world), expressed as local basis rotation
                rot_w = rest_dir.rotation_difference(d.normalized())
                Rb = base.to_3x3()
                local = Rb.inverted() @ rot_w.to_matrix() @ Rb
                sk.rot[bn] = local.to_quaternion()
                sk.M.pop(bn, None)
                # children depend on this bone: invalidate them
                for other in sk.order:
                    if other in sk.M and _is_descendant(sk, other, bn):
                        sk.M.pop(other, None)
                sk.solve(upto=bn)


def _is_descendant(sk, n, anc):
    p = sk.parent[n]
    while p:
        if p == anc:
            return True
        p = sk.parent[p]
    return False
