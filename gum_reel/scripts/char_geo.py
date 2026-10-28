"""Caveman body / head / beard / hair / tunic shapes as SDF primitives.

Coordinates: meters, Z up, character faces -Y, his left side is +X.
Every primitive carries a `bone` tag used later for skin weights.
"""
import numpy as np
from sdf import Prim, frame_from_axes, rot_matrix

V = lambda *a: np.array(a, float)


def nrm(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


def mirror_x(p):
    p = np.array(p, float).copy()
    p[..., 0] *= -1
    return p


# ---------------------------------------------------------------- skeleton landmarks
def landmarks():
    L = {}
    L['hip'] = V(0.095, 0.0, 0.935)
    L['knee'] = V(0.105, -0.018, 0.505)
    L['ankle'] = V(0.11, 0.028, 0.088)
    L['ball'] = V(0.117, -0.135, 0.03)
    L['toe'] = V(0.118, -0.205, 0.02)
    L['shoulder'] = V(0.205, 0.0, 1.452)
    ua = nrm((np.sin(np.radians(47)), 0, -np.cos(np.radians(47))))
    L['elbow'] = L['shoulder'] + 0.29 * ua
    fa = nrm((0.715, -0.21, -0.667))
    L['wrist'] = L['elbow'] + 0.262 * fa
    L['ua_dir'], L['fa_dir'] = ua, fa
    # hand frame
    a = fa
    n = nrm(V(0, 0, -1) - (V(0, 0, -1) @ a) * a)   # palm normal (down/in)
    w = nrm(np.cross(n, a))                        # towards thumb (front)
    L['hand_a'], L['hand_n'], L['hand_w'] = a, n, w
    L['knuckle'] = L['wrist'] + 0.098 * a
    L['neck_base'] = V(0, 0.012, 1.475)
    L['neck_top'] = V(0, 0.0, 1.645)
    L['head_top'] = V(0, 0.0, 1.875)
    L['jaw_pivot'] = V(0, 0.005, 1.69)
    L['eye'] = V(0.0335, -0.0785, 1.743)
    L['mouth'] = V(0, -0.103, 1.654)
    L['eye_r'] = 0.0142
    return L


def finger_chain(L, off, length, r, curl1=8.0, curl2=28.0):
    a, n, w = L['hand_a'], L['hand_n'], L['hand_w']
    B = L['knuckle'] + off * w + 0.002 * n
    d1 = nrm(np.cos(np.radians(curl1)) * a + np.sin(np.radians(curl1)) * n)
    M = B + 0.55 * length * d1
    d2 = nrm(np.cos(np.radians(curl1 + curl2)) * a + np.sin(np.radians(curl1 + curl2)) * n)
    T = M + (0.45 * length - r * 0.85) * d2
    return B, M, T


def thumb_chain(L):
    a, n, w = L['hand_a'], L['hand_n'], L['hand_w']
    B = L['wrist'] + 0.028 * a + 0.030 * w + 0.010 * n
    d1 = nrm(0.55 * a + 0.70 * w + 0.40 * n)
    M = B + 0.046 * d1
    d2 = nrm(0.85 * a + 0.35 * w + 0.45 * n)
    T = M + 0.036 * d2
    return B, M, T


FINGERS = [  # offset along w (thumb side +), length, radius
    (0.029, 0.090, 0.0108),
    (0.0095, 0.098, 0.0112),
    (-0.0105, 0.092, 0.0106),
    (-0.029, 0.074, 0.0096),
]


def side_prims(L, side):
    """Limb primitives for one side. side = 'L' (+x) or 'R' (-x)."""
    S = (lambda p: np.asarray(p, float)) if side == 'L' else mirror_x
    s = '.' + side
    P = []
    add = P.append
    sh, el, wr = L['shoulder'], L['elbow'], L['wrist']
    ua, fa = L['ua_dir'], L['fa_dir']
    # shoulders / arms
    add(Prim('ellipsoid', k=0.045, bone={'upperarm' + s: 0.6, 'clavicle' + s: 0.4},
             c=S(V(0.212, 0.006, 1.442)), r=V(0.07, 0.078, 0.07)))
    add(Prim('roundcone', k=0.03, bone='upperarm' + s, a=S(sh), b=S(el), ra=0.074, rb=0.054))
    R_ua = frame_from_axes(S(ua) if side == 'L' else mirror_x(ua), up_hint=(0, -1, 0))
    add(Prim('ellipsoid', k=0.03, bone='upperarm' + s, c=S(sh + 0.48 * 0.29 * ua + V(0, -0.012, 0)),
             r=V(0.058, 0.12, 0.056), rot=R_ua))
    add(Prim('roundcone', k=0.025, bone='forearm' + s, a=S(el), b=S(wr), ra=0.055, rb=0.036))
    R_fa = frame_from_axes(S(fa) if side == 'L' else mirror_x(fa), up_hint=(0, -1, 0))
    add(Prim('ellipsoid', k=0.03, bone='forearm' + s, c=S(el + 0.3 * 0.262 * fa), r=V(0.052, 0.09, 0.046), rot=R_fa))
    add(Prim('sphere', k=0.02, bone={'upperarm' + s: 0.5, 'forearm' + s: 0.5}, c=S(el + V(0, 0.01, 0)), r=0.042))
    # hand
    a, n, w = L['hand_a'], L['hand_n'], L['hand_w']
    Rh = np.stack([w, a, n], axis=1)
    if side == 'R':
        M = np.diag([-1, 1, 1])
        Rh = M @ Rh @ np.diag([-1, 1, 1])  # mirror keeps right-handed frame
    add(Prim('roundcone', k=0.012, bone={'hand' + s: 0.5, 'forearm' + s: 0.5}, a=S(wr - 0.012 * a), b=S(wr + 0.025 * a),
             ra=0.034, rb=0.033))
    add(Prim('box', k=0.016, bone='hand' + s, c=S(wr + 0.055 * a), h=V(0.044, 0.049, 0.0165), round=0.015, rot=Rh))
    add(Prim('ellipsoid', k=0.01, bone={'thumb1' + s: 0.5, 'hand' + s: 0.5},
             c=S(wr + 0.038 * a + 0.024 * w + 0.010 * n), r=V(0.022, 0.032, 0.016), rot=Rh))
    for fi, (off, ln, r) in enumerate(FINGERS):
        B, Mi, T = finger_chain(L, off, ln, r)
        b1, b2 = ('index1', 'index2') if fi == 0 else ('fingers1', 'fingers2')
        add(Prim('roundcone', k=0.006, bone=b1 + s, a=S(B - 0.012 * a), b=S(Mi), ra=r * 1.02, rb=r * 0.96))
        add(Prim('roundcone', k=0.004, bone=b2 + s, a=S(Mi), b=S(T), ra=r * 0.96, rb=r * 0.86))
    B, Mi, T = thumb_chain(L)
    add(Prim('roundcone', k=0.008, bone='thumb1' + s, a=S(B), b=S(Mi), ra=0.016, rb=0.0128))
    add(Prim('roundcone', k=0.004, bone='thumb2' + s, a=S(Mi), b=S(T), ra=0.0128, rb=0.0112))
    # legs
    hp, kn, an = L['hip'], L['knee'], L['ankle']
    add(Prim('roundcone', k=0.05, bone='thigh' + s, a=S(hp + V(0.0, 0.0, 0.02)), b=S(kn), ra=0.108, rb=0.062))
    add(Prim('ellipsoid', k=0.04, bone='thigh' + s, c=S(V(0.102, -0.03, 0.73)), r=V(0.077, 0.07, 0.17)))
    add(Prim('sphere', k=0.03, bone={'thigh' + s: 0.5, 'shin' + s: 0.5}, c=S(kn + V(0, 0.0, 0)), r=0.05))
    add(Prim('roundcone', k=0.03, bone='shin' + s, a=S(kn), b=S(an), ra=0.055, rb=0.037))
    add(Prim('ellipsoid', k=0.035, bone='shin' + s, c=S(V(0.108, 0.035, 0.365)), r=V(0.056, 0.056, 0.115)))
    # foot
    add(Prim('sphere', k=0.03, bone='foot' + s, c=S(V(0.11, 0.035, 0.046)), r=0.046))
    add(Prim('roundcone', k=0.02, bone={'foot' + s: 0.6, 'shin' + s: 0.4}, a=S(an + V(0, 0, 0.02)), b=S(an - V(0, 0, 0.03)), ra=0.04, rb=0.043))
    add(Prim('ellipsoid', k=0.03, bone='foot' + s, c=S(V(0.114, -0.055, 0.036)), r=V(0.05, 0.11, 0.036)))
    add(Prim('ellipsoid', k=0.025, bone={'foot' + s: 0.5, 'toes' + s: 0.5}, c=S(V(0.118, -0.14, 0.026)), r=V(0.055, 0.035, 0.026)))
    toes = [(0.091, -0.198, 0.0175), (0.111, -0.19, 0.0128), (0.126, -0.182, 0.0118), (0.139, -0.172, 0.011), (0.150, -0.159, 0.0098)]
    for x, y, r in toes:
        add(Prim('roundcone', k=0.006, bone='toes' + s, a=S(V(x - 0.002, y + 0.03, r + 0.002)), b=S(V(x, y, r)), ra=r * 1.05, rb=r))
    return P


def body_prims():
    L = landmarks()
    P = []
    add = P.append
    # torso
    add(Prim('ellipsoid', bone='hips', c=V(0, 0.012, 0.99), r=V(0.172, 0.128, 0.125)))
    for sx in (1, -1):
        add(Prim('sphere', k=0.05, bone='hips', c=V(0.075 * sx, 0.058, 0.925), r=0.094))
    add(Prim('ellipsoid', k=0.07, bone={'spine': 0.8, 'hips': 0.2}, c=V(0, -0.028, 1.12), r=V(0.178, 0.152, 0.172)))
    for sx in (1, -1):
        add(Prim('ellipsoid', k=0.05, bone={'hips': 0.5, 'spine': 0.5}, c=V(0.125 * sx, 0.005, 1.06), r=V(0.07, 0.10, 0.08)))
    add(Prim('ellipsoid', k=0.07, bone='chest', c=V(0, 0.0, 1.335), r=V(0.205, 0.138, 0.17)))
    for sx in (1, -1):
        add(Prim('ellipsoid', k=0.04, bone='chest', c=V(0.082 * sx, -0.088, 1.37), r=V(0.085, 0.05, 0.062)))
    add(Prim('ellipsoid', k=0.05, bone='chest', c=V(0, 0.045, 1.40), r=V(0.21, 0.095, 0.11)))
    for sx in (1, -1):
        add(Prim('roundcone', k=0.045, bone={'chest': 0.5, 'clavicle' + ('.L' if sx > 0 else '.R'): 0.5},
                 a=V(0, 0.03, 1.545), b=V(0.165 * sx, 0.02, 1.475), ra=0.058, rb=0.045))
    add(Prim('roundcone', k=0.035, bone={'neck': 0.85, 'chest': 0.15}, a=V(0, 0.018, 1.47), b=V(0, 0.002, 1.665), ra=0.074, rb=0.063))
    for side in ('L', 'R'):
        P += side_prims(L, side)
    P += head_prims(L)
    # flat soles
    P.append(Prim('plane', op='inter', k=0.012, bone='foot.L', n=V(0, 0, -1), h=0.0))
    return P, L


def head_prims(L):
    P = []
    add = P.append
    add(Prim('ellipsoid', k=0.03, bone='head', c=V(0, 0.012, 1.778), r=V(0.083, 0.099, 0.096)))
    add(Prim('ellipsoid', k=0.035, bone='head', c=V(0, -0.03, 1.716), r=V(0.071, 0.075, 0.088)))
    add(Prim('ellipsoid', k=0.03, bone='jaw', c=V(0, -0.035, 1.648), r=V(0.066, 0.066, 0.046)))
    for sx in (1, -1):
        s = '.L' if sx > 0 else '.R'
        add(Prim('roundcone', k=0.025, bone={'jaw': 0.7, 'head': 0.3}, a=V(0.056 * sx, 0.002, 1.685), b=V(0.036 * sx, -0.062, 1.628), ra=0.021, rb=0.02))
        add(Prim('ellipsoid', k=0.022, bone='cheek' + s, c=V(0.045 * sx, -0.07, 1.703), r=V(0.031, 0.026, 0.028)))
        add(Prim('roundcone', k=0.022, bone={'brow' + s: 0.7, 'head': 0.3}, a=V(0.012 * sx, -0.088, 1.772), b=V(0.056 * sx, -0.076, 1.768), ra=0.0155, rb=0.012))
        # ears
        add(Prim('ellipsoid', k=0.008, bone='head', c=V(0.084 * sx, 0.012, 1.737), r=V(0.011, 0.024, 0.034), rot=(0, 0, -12 * sx)))
    # eye sockets
    for sx in (1, -1):
        e = L['eye'] * V(sx, 1, 1)
        add(Prim('sphere', op='sub', k=0.007, bone='head', c=e + V(0, -0.003, 0.0), r=0.0168))
    # nose (big)
    add(Prim('roundcone', k=0.012, bone='head', a=V(0, -0.091, 1.752), b=V(0, -0.113, 1.702), ra=0.0105, rb=0.0145))
    add(Prim('sphere', k=0.010, bone='head', c=V(0, -0.117, 1.693), r=0.0195))
    for sx in (1, -1):
        add(Prim('ellipsoid', k=0.008, bone='head', c=V(0.018 * sx, -0.101, 1.688), r=V(0.0135, 0.013, 0.0115)))
        add(Prim('ellipsoid', op='sub', k=0.003, bone='head', c=V(0.0095 * sx, -0.113, 1.6775), r=V(0.0058, 0.006, 0.0038)))
    # muzzle + mouth recess
    add(Prim('ellipsoid', k=0.02, bone='head', c=V(0, -0.074, 1.669), r=V(0.044, 0.035, 0.021)))
    add(Prim('ellipsoid', k=0.02, bone='jaw', c=V(0, -0.072, 1.638), r=V(0.04, 0.032, 0.021)))
    add(Prim('ellipsoid', op='sub', k=0.006, bone='jaw', c=V(0, -0.1, 1.655), r=V(0.031, 0.02, 0.015)))
    return P


# ---------------------------------------------------------------- noise
_rng = np.random.default_rng(7)
_NDIR = _rng.normal(size=(24, 3)); _NDIR /= np.linalg.norm(_NDIR, axis=1, keepdims=True)
_NPH = _rng.uniform(0, 2 * np.pi, 24)
_NF = np.geomspace(1.0, 3.2, 24)


def snoise(p, freq):
    """cheap smooth pseudo-noise in [-1,1] (sum of plane waves)."""
    acc = np.zeros(p.shape[:-1])
    for d, ph, f in zip(_NDIR, _NPH, _NF):
        acc += np.sin((p @ d) * freq * f + ph) / f
    return acc / 2.2


def lumpy(base, amp, freq):
    return lambda p: base(p) + amp * snoise(p, freq)


# ---------------------------------------------------------------- beard / hair / brows
def beard_prims():
    P = []
    add = P.append
    add(Prim('ellipsoid', c=V(0, -0.074, 1.565), r=V(0.103, 0.072, 0.112)))
    add(Prim('ellipsoid', k=0.05, c=V(0, -0.088, 1.485), r=V(0.092, 0.066, 0.082)))
    for sx in (1, -1):
        add(Prim('roundcone', k=0.04, a=V(0.077 * sx, -0.004, 1.745), b=V(0.072 * sx, -0.05, 1.63), ra=0.02, rb=0.036))
        add(Prim('ellipsoid', k=0.035, c=V(0.058 * sx, -0.056, 1.664), r=V(0.034, 0.036, 0.042)))
        add(Prim('ellipsoid', k=0.04, c=V(0.07 * sx, -0.07, 1.56), r=V(0.05, 0.06, 0.08)))
    # mouth opening
    add(Prim('ellipsoid', op='sub', k=0.012, c=V(0, -0.118, 1.652), r=V(0.036, 0.05, 0.022)))
    # keep below the cheek line (sideburns may go higher)
    add(Prim('func', op='inter', k=0.02, f=lambda p: p[..., 2] - (1.69 + 0.075 * np.clip(np.abs(p[..., 0]) / 0.08, 0, 1.4) ** 2)))
    return P


def mustache_prims():
    P = []
    for sx in (1, -1):
        P.append(Prim('roundcone', k=0.012, a=V(0.004 * sx, -0.114, 1.675), b=V(0.03 * sx, -0.107, 1.667), ra=0.0095, rb=0.0088))
        P.append(Prim('roundcone', k=0.012, a=V(0.03 * sx, -0.107, 1.667), b=V(0.044 * sx, -0.096, 1.643), ra=0.0088, rb=0.0068))
    return P


def hair_prims():
    P = []
    add = P.append
    add(Prim('ellipsoid', c=V(0, 0.014, 1.79), r=V(0.098, 0.114, 0.106)))
    add(Prim('ellipsoid', k=0.05, c=V(0, 0.072, 1.655), r=V(0.112, 0.072, 0.15)))
    for sx in (1, -1):
        add(Prim('ellipsoid', k=0.04, c=V(0.09 * sx, 0.03, 1.69), r=V(0.042, 0.07, 0.11)))
        add(Prim('roundcone', k=0.03, a=V(0.08 * sx, 0.06, 1.62), b=V(0.12 * sx, 0.06, 1.52), ra=0.035, rb=0.03))
    add(Prim('roundcone', k=0.04, a=V(0, 0.09, 1.6), b=V(0, 0.1, 1.47), ra=0.06, rb=0.045))
    # messy tufts on top
    for c, r in [((0.03, -0.04, 1.885), 0.03), ((-0.04, -0.02, 1.88), 0.032), ((0.0, 0.05, 1.895), 0.03),
                 ((-0.06, -0.06, 1.84), 0.024), ((0.065, -0.055, 1.845), 0.025)]:
        add(Prim('sphere', k=0.03, c=V(*c), r=r))
    # hairline: keep only hair behind a line that climbs over the forehead; sides may come further forward
    def hairline(p):
        x, y, z = np.abs(p[..., 0]), p[..., 1], p[..., 2]
        yc = np.minimum(-0.052 - (z - 1.80) * 1.15, 0.02)
        t = np.clip((x - 0.05) / 0.035, 0, 1); t = t * t * (3 - 2 * t)
        yl = yc * (1 - t) + (-0.03) * t
        return (yl - y)
    add(Prim('func', op='inter', k=0.02, f=hairline))
    return P


def brow_prims():
    P = []
    for sx in (1, -1):
        P.append(Prim('roundcone', k=0.006, a=V(0.011 * sx, -0.1, 1.773), b=V(0.034 * sx, -0.098, 1.783), ra=0.0078, rb=0.0072))
        P.append(Prim('roundcone', k=0.006, a=V(0.034 * sx, -0.098, 1.783), b=V(0.058 * sx, -0.083, 1.774), ra=0.0072, rb=0.005))
    return P


# ---------------------------------------------------------------- tunic
def tunic_prims(body):
    """Offset torso + flared skirt. body = list of body prims (tags used to pick torso pieces)."""
    torso_bones = {'hips', 'spine', 'chest'}
    P = []
    for pr in body:
        if pr.op != 'union':
            continue
        b = pr.bone
        names = set(b.keys()) if isinstance(b, dict) else {b}
        keep = bool(names & torso_bones) or ('clavicle.L' in names) or (isinstance(b, dict) and 'upperarm.L' in b and 'clavicle.L' in b)
        if 'neck' in names:
            keep = False
        if keep:
            P.append(Prim('func', k=pr.k, f=(lambda pp, pr=pr: pr.dist(pp) - 0.014)))

    def skirt(p):
        q = p.copy()
        q[..., 1] = q[..., 1] * 1.28 - 0.005
        return Prim('roundcone', a=V(0, 0, 1.04), b=V(0, 0, 0.64), ra=0.205, rb=0.255).dist(q) / 1.1
    P.append(Prim('func', k=0.06, f=skirt))
    return P


def tunic_keep(c, L):
    """Which tunic faces (centroids c) to keep: torn diagonal top, strap, zig-zag hem."""
    x, y, z = c[:, 0], c[:, 1], c[:, 2]
    th = np.arctan2(y, x)
    t = np.clip((x + 0.20) / 0.32, 0, 1); t = t * t * (3 - 2 * t)
    ztop = 1.30 + 0.33 * t + 0.012 * np.abs(((x * 38 + 0.5 * np.sin(z * 50)) % 2) - 1)
    keep = z < ztop
    keep &= ~((x < 0.07) & (z > 1.47) & (np.abs(y) < 0.09))          # neck hole
    keep &= ~((x < 0.035) & (z > 1.50))
    sh = L['shoulder']; ua = L['ua_dir']
    keep &= ~((x > 0.16) & (z > 1.2) & (((c - sh) @ ua) > 0.035))                    # left arm stays bare below the cap
    zig = np.abs(((th * 9 / np.pi) % 2) - 1)                            # 0..1 triangle wave
    zhem = 0.665 + 0.045 * zig + 0.012 * np.sin(th * 23 + 1.3) + 0.008 * np.sin(th * 41)
    keep &= z > zhem
    return keep
