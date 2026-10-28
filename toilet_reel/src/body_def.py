"""The old caveman grandpa, sculpted as a signed distance field.

Rest pose: upright A-pose, facing -Y, character's left = +X, metres.
Every primitive belongs to a named part; the parts map to skeleton bones and
are reused for skin weights.  Joint positions are defined here too so the
skeleton matches the sculpt exactly.
"""
import numpy as np
from sdf import (Sphere, Ellipsoid, RoundCone, RoundBox, Torus, Union, Subtract,
                 Intersect, HalfSpace, Func, rot_from_axes, rot_euler, smin, smax)

ARM_ANGLE = np.radians(42.0)       # A-pose angle from vertical
SIDES = {'L': 1.0, 'R': -1.0}

# ----------------------------------------------------------------- key landmarks
EYE_R = 0.0125
EYE_C = np.array([0.0318, -0.0675, 1.571])   # left eye centre (mirror for right)
HEAD_TOP = 1.688
LID_SKIN = 0.0025              # eyelid skin thickness over the eyeball
# almond aperture in eye-centred angles (radians), az>0 = outer corner
APERTURE = dict(e_u=0.50, c_u=0.36, e_l=-0.56, c_l=0.40, tilt=-0.04)


def aperture_sdf(P, s):
    """Cone-shaped cutter through the eyelid skin (approx signed distance)."""
    v = P - mx(EYE_C, s)
    rho = np.linalg.norm(v, axis=1) + 1e-9
    az = np.arctan2(s * v[:, 0], -v[:, 1])
    el = np.arctan2(v[:, 2], np.sqrt(v[:, 0] ** 2 + v[:, 1] ** 2))
    A = APERTURE
    el_u = A['e_u'] - A['c_u'] * az * az + A['tilt'] * az
    el_l = A['e_l'] + A['c_l'] * az * az + A['tilt'] * az
    d_ang = np.maximum(el - el_u, el_l - el) * rho
    d_in = (EYE_R - 0.0025) - rho
    d_out = rho - (EYE_R + 0.0065)
    d = np.maximum(np.maximum(d_ang, d_in), d_out)
    return np.where(np.abs(az) < 2.2, d, 0.01)


def mx(p, s):
    """mirror a left-side point to side s."""
    p = np.array(p, dtype=float)
    p[0] *= s
    return p


def arm_frame(s):
    d = np.array([s * np.sin(ARM_ANGLE), 0.0, -np.cos(ARM_ANGLE)])
    n = np.array([-s * np.cos(ARM_ANGLE), 0.0, -np.sin(ARM_ANGLE)])  # palm normal (towards body)
    t = np.array([0.0, -1.0, 0.0])                                   # thumb side (forward)
    return d, t, n


def joints():
    J = {}
    J['root'] = np.array([0, 0.0, 0.0])
    J['hips'] = np.array([0, 0.012, 0.95])
    J['spine'] = np.array([0, 0.012, 1.06])
    J['chest'] = np.array([0, 0.018, 1.21])
    J['neck'] = np.array([0, 0.022, 1.405])
    J['head'] = np.array([0, 0.014, 1.505])
    J['head_tail'] = np.array([0, 0.014, HEAD_TOP])
    J['jaw'] = np.array([0, 0.004, 1.536])
    J['jaw_tail'] = np.array([0, -0.082, 1.462])
    for side, s in SIDES.items():
        J['clav.' + side] = mx([0.022, -0.012, 1.405], s)
        J['shoulder.' + side] = mx([0.168, 0.014, 1.372], s)
        d, t, n = arm_frame(s)
        J['elbow.' + side] = J['shoulder.' + side] + d * 0.285
        J['wrist.' + side] = J['elbow.' + side] + d * 0.250
        J['hand_tip.' + side] = J['wrist.' + side] + d * 0.085
        J['hip.' + side] = mx([0.086, 0.008, 0.905], s)
        J['knee.' + side] = mx([0.092, -0.006, 0.485], s)
        J['ankle.' + side] = mx([0.096, 0.020, 0.078], s)
        J['ball.' + side] = mx([0.102, -0.102, 0.022], s)
        J['toe_tip.' + side] = mx([0.104, -0.168, 0.016], s)
        J['eye.' + side] = mx(EYE_C, s)
    return J


J = joints()


def finger_chains(side):
    s = SIDES[side]
    d, t, n = arm_frame(s)
    W = J['wrist.' + side]

    def L(dd, tt, nn):
        return W + d * dd + t * tt + n * nn

    chains = {}
    # (knuckle d, t, segment lengths, spread angle)
    spec = {
        'index': (0.086, 0.026, (0.040, 0.025, 0.020), 0.16),
        'middle': (0.090, 0.008, (0.044, 0.028, 0.021), 0.03),
        'ring': (0.087, -0.010, (0.041, 0.026, 0.020), -0.10),
        'pinky': (0.080, -0.026, (0.032, 0.020, 0.018), -0.23),
    }
    for name, (kd, kt, segs, spread) in spec.items():
        p = L(kd, kt, 0.0)
        dirv = d * np.cos(spread) + t * np.sin(spread)
        # slight natural curl towards the palm
        pts = [p]
        curl = 0.0
        for i, sl in enumerate(segs):
            curl += 0.10
            dv = dirv * np.cos(curl) + n * np.sin(curl)
            p = p + dv * sl
            pts.append(p)
        chains[name] = pts
    # thumb: CMC near the wrist on the thumb side
    p0 = L(0.016, 0.020, 0.006)
    tdir = d * 0.55 + t * 0.75 + n * 0.35
    tdir /= np.linalg.norm(tdir)
    p1 = p0 + tdir * 0.042
    tdir2 = d * 0.75 + t * 0.55 + n * 0.30
    tdir2 /= np.linalg.norm(tdir2)
    p2 = p1 + tdir2 * 0.031
    tdir3 = d * 0.85 + t * 0.40 + n * 0.30
    tdir3 /= np.linalg.norm(tdir3)
    p3 = p2 + tdir3 * 0.026
    chains['thumb'] = [p0, p1, p2, p3]
    return chains


# ----------------------------------------------------------------- parts
def head_parts():
    P = {}
    E = Ellipsoid
    S = Sphere
    RC = RoundCone

    # --- base masses (big soft blends)
    skull = Union([
        E([0, 0.012, 1.600], [0.0730, 0.0940, 0.0885]),          # cranium
        E([0, -0.025, 1.612], [0.0560, 0.0560, 0.0640]),         # forehead dome
        E([0, 0.046, 1.575], [0.0640, 0.0600, 0.0680]),          # occiput
    ], k=0.05)
    face = Union([
        E([0, -0.033, 1.548], [0.0605, 0.0525, 0.0640]),         # midface
        E([0, -0.040, 1.502], [0.0420, 0.0450, 0.0380]),         # mouth mound
    ], k=0.025)
    cheeks = Union([E(mx([0.039, -0.050, 1.538], s), [0.0285, 0.0300, 0.0265]) for s in (1, -1)]
                   + [E(mx([0.051, -0.047, 1.557], s), [0.0180, 0.0210, 0.0125],
                        rot_euler(0, 0, -s * 0.4)) for s in (1, -1)], k=0.012)
    brow = Union([RC(mx([0.047, -0.0650, 1.5960], s), mx([0.012, -0.0760, 1.5975], s), 0.0095, 0.0105)
                  for s in (1, -1)] + [S([0, -0.0740, 1.5935], 0.0110)], k=0.012)
    bags = Union([E(mx([0.0315, -0.0765, 1.5545], s), [0.0130, 0.0060, 0.0050],
                    rot_euler(0, 0, -s * 0.25)) for s in (1, -1)], k=0.0)
    head = Union([skull, face], k=0.02)
    head = Union([head, cheeks], k=0.02)
    head = Union([head, brow], k=0.016)
    head = Union([head, bags], k=0.005)
    temples = [E(mx([0.0725, -0.030, 1.603], s), [0.0085, 0.0180, 0.0180]) for s in (1, -1)]
    head = Subtract(head, temples, k=0.015)

    # --- big friendly nose
    tip = Union([
        S([0, -0.1130, 1.5335], 0.0148),                                   # bulb
        E(mx([0.0150, -0.1035, 1.5262], 1), [0.0085, 0.0105, 0.0085]),     # alae
        E(mx([0.0150, -0.1035, 1.5262], -1), [0.0085, 0.0105, 0.0085]),
    ], k=0.014)
    nose = Union([
        RC([0, -0.0790, 1.5810], [0, -0.1080, 1.5445], 0.0076, 0.0108),   # bridge
        tip,
        RC([0, -0.1110, 1.5210], [0, -0.1000, 1.5155], 0.0048, 0.0044),    # columella
    ], k=0.010)
    nostrils = [E(mx([0.0092, -0.1095, 1.5168], s), [0.0042, 0.0064, 0.0026],
                  rot_euler(0.25, 0, -s * 0.35)) for s in (1, -1)]
    nose = Subtract(nose, nostrils, k=0.002)
    upper_lip = E([0, -0.0905, 1.5045], [0.0245, 0.0105, 0.0085])
    head = Union([head, nose], k=0.012)
    head = Union([head, upper_lip], k=0.008)

    # --- big old-man ears
    ears = []
    for s in (1, -1):
        R = rot_euler(-0.26, 0, 0)
        c = mx([0.0738, 0.016, 1.5585], s)
        shell = E(c, [0.0100, 0.0215, 0.0350], R)
        lobe = E(c + R @ np.array([s * 0.0010, -0.0060, -0.0320]), [0.0072, 0.0110, 0.0120])
        ear = Union([shell, lobe], k=0.007)
        bowl = E(c + R @ np.array([s * 0.0088, 0.0022, 0.0028]), [0.0060, 0.0152, 0.0262], R)
        concha = E(c + R @ np.array([s * 0.0064, -0.0032, -0.0080]), [0.0062, 0.0090, 0.0112], R)
        ear = Subtract(ear, [bowl, concha], k=0.003)
        ears.append(ear)
    P['ears'] = Union(ears, k=0.0)

    # --- eyelid skin wrapped around the eyeball, almond aperture cut through it.
    # (eyeballs + the animated tarsal lid shells are separate objects)
    hollows = [E(mx(EYE_C, s) + np.array([s * 0.0020, -0.0150, 0.0010]), [0.0175, 0.0105, 0.0120])
               for s in (1, -1)]
    head = Subtract(head, hollows, k=0.008)                      # soft orbital hollow
    lid_skin = [S(mx(EYE_C, s), EYE_R + LID_SKIN) for s in (1, -1)]
    head = Union([head] + lid_skin, k=0.0055)
    sockets = [Func(lambda P, s=s: aperture_sdf(P, s), (mx(EYE_C, s) - 0.035, mx(EYE_C, s) + 0.035))
               for s in (1, -1)]
    P['head'] = head
    P['sockets'] = sockets

    # --- jaw (lower lip, chin, mandible)
    jaw = Union([RC(mx([0.0480, 0.002, 1.499], s), mx([0.0230, -0.068, 1.462], s), 0.0150, 0.0155)
                 for s in (1, -1)]
                + [E([0, -0.0745, 1.4670], [0.0250, 0.0185, 0.0185]),
                   E([0, -0.0500, 1.4850], [0.0400, 0.0350, 0.0220])], k=0.02)
    lower_lip = E([0, -0.0885, 1.4895], [0.0220, 0.0100, 0.0075])
    P['jaw'] = Union([jaw, lower_lip], k=0.008)
    P['mouth_slit'] = E([0, -0.0965, 1.4970], [0.0258, 0.022, 0.0012])

    # --- neck (skinny, cords, adam's apple)
    P['neck'] = Union([
        RC([0, 0.018, 1.385], [0, 0.012, 1.505], 0.0520, 0.0470),
        RC(mx([0.050, 0.022, 1.512], 1), mx([0.016, -0.040, 1.402], 1), 0.0105, 0.0115),
        RC(mx([0.050, 0.022, 1.512], -1), mx([0.016, -0.040, 1.402], -1), 0.0105, 0.0115),
        E([0, -0.0455, 1.452], [0.0085, 0.0085, 0.0115]),
    ], k=0.014)
    return P


def torso_parts():
    P = {}
    E = Ellipsoid
    RC = RoundCone
    P['hips'] = Union([
        E([0, 0.012, 0.935], [0.142, 0.098, 0.105]),
        E([0.058, 0.055, 0.905], [0.068, 0.058, 0.075]),   # buttocks
        E([-0.058, 0.055, 0.905], [0.068, 0.058, 0.075]),
    ], k=0.03)
    P['spine'] = Union([
        E([0, 0.004, 1.055], [0.135, 0.094, 0.105]),
        E([0, -0.035, 1.025], [0.105, 0.070, 0.085]),       # small old-man belly
    ], k=0.03)
    P['chest'] = Union([
        E([0, 0.010, 1.245], [0.142, 0.100, 0.150]),          # ribcage
        E([0, 0.058, 1.322], [0.110, 0.062, 0.088]),          # rounded upper back (hunch)
        E([0.056, -0.062, 1.282], [0.054, 0.022, 0.042]),     # flat old pecs
        E([-0.056, -0.062, 1.282], [0.054, 0.022, 0.042]),
        RC([0.026, -0.050, 1.400], [0.150, -0.018, 1.400], 0.0080, 0.0070),   # clavicles
        RC([-0.026, -0.050, 1.400], [-0.150, -0.018, 1.400], 0.0080, 0.0070),
        RC([0.040, 0.030, 1.425], [0.160, 0.020, 1.392], 0.034, 0.030),      # trapezius
        RC([-0.040, 0.030, 1.425], [-0.160, 0.020, 1.392], 0.034, 0.030),
    ], k=0.026)
    return P


def arm_parts(side):
    s = SIDES[side]
    P = {}
    d, t, n = arm_frame(s)
    S_, E_, W_ = J['shoulder.' + side], J['elbow.' + side], J['wrist.' + side]
    back = np.array([0, 1.0, 0])
    Rd = rot_from_axes([0, 1, 0], d)                   # local y along the arm
    P['upperarm.' + side] = Union([
        Ellipsoid(S_ + d * 0.050 + np.array([s * 0.005, 0, 0]), [0.040, 0.072, 0.042], Rd),  # deltoid
        RoundCone(S_ + d * 0.01, E_, 0.041, 0.0305),
        Ellipsoid(S_ + d * 0.15 - back * 0.006, [0.029, 0.075, 0.028], Rd),                  # thin biceps
    ], k=0.03)
    P['forearm.' + side] = Union([
        RoundCone(E_, W_, 0.0305, 0.0215),
        Ellipsoid(E_ + d * 0.085 - back * 0.003, [0.028, 0.080, 0.026], Rd),
        Sphere(E_ + back * 0.022, 0.0115),                # bony elbow
        Sphere(W_ + n * -0.004 - t * 0.016, 0.008),       # wrist bone
    ], k=0.02)
    # hand
    R_hand = np.stack([d, t, n], axis=1)
    palm = Union([
        RoundBox(W_ + d * 0.047 + t * 0.001, [0.036, 0.033, 0.0075], R_hand, 0.0085),
        Ellipsoid(W_ + d * 0.030 + t * 0.022 + n * 0.006, [0.026, 0.014, 0.013], R_hand),   # thenar
        Ellipsoid(W_ + d * 0.040 - t * 0.026 + n * 0.004, [0.030, 0.010, 0.011], R_hand),   # hypothenar
        RoundCone(W_ - d * 0.01, W_ + d * 0.02, 0.022, 0.024),
    ], k=0.012)
    P['hand.' + side] = palm
    chains = finger_chains(side)
    for fname, pts in chains.items():
        radii = {'thumb': (0.0104, 0.0094, 0.0087, 0.0078),
                 'index': (0.0080, 0.0073, 0.0067, 0.0060),
                 'middle': (0.0082, 0.0075, 0.0068, 0.0061),
                 'ring': (0.0078, 0.0071, 0.0065, 0.0058),
                 'pinky': (0.0070, 0.0064, 0.0058, 0.0052)}[fname]
        for i in range(3):
            a, b = pts[i], pts[i + 1]
            parts = [RoundCone(a, b, radii[i], radii[i + 1])]
            if i > 0 or fname == 'thumb':
                parts.append(Sphere(a, radii[i] * 1.08))    # knobby knuckles
            P[f'{fname}{i + 1}.{side}'] = Union(parts, k=0.004)
    return P


def leg_parts(side):
    s = SIDES[side]
    P = {}
    H, K, A = J['hip.' + side], J['knee.' + side], J['ankle.' + side]
    B, T = J['ball.' + side], J['toe_tip.' + side]
    P['thigh.' + side] = Union([
        RoundCone(H + np.array([s * 0.005, 0, 0.02]), K, 0.076, 0.049),
        Ellipsoid(H + (K - H) * 0.35 + np.array([0, -0.012, 0]), [0.058, 0.058, 0.14]),
    ], k=0.03)
    P['shin.' + side] = Union([
        RoundCone(K, A, 0.044, 0.029),
        Ellipsoid(K + (A - K) * 0.27 + np.array([s * 0.004, 0.024, 0]), [0.040, 0.041, 0.090]),  # calf
        Sphere(K + np.array([0, -0.032, 0.004]), 0.024),    # knobby knee cap
        Sphere(A + np.array([s * 0.024, 0.0, 0.0]), 0.0145),   # outer ankle bone
        Sphere(A + np.array([-s * 0.020, -0.004, 0.006]), 0.0140),
    ], k=0.016)
    foot = Union([
        Sphere(A + np.array([0, 0.022, -0.042]), 0.034),                  # heel
        RoundCone(A + np.array([0, 0.012, -0.040]), B + np.array([0, 0.0, 0.004]), 0.034, 0.028),
        Ellipsoid((A + B) / 2 + np.array([s * 0.006, 0, -0.012]), [0.040, 0.060, 0.028]),
    ], k=0.02)
    sole = HalfSpace([0, 0, 0.0], [0, 0, -1.0], foot.bbox)
    P['foot.' + side] = Intersect(foot, sole, k=0.006)
    toes = []
    xs = [0.012, -0.006, -0.018, -0.028, -0.037]  # medial->lateral offsets (relative, for left)
    lens = [0.050, 0.043, 0.038, 0.033, 0.028]
    rads = [0.0130, 0.0095, 0.0090, 0.0085, 0.0080]
    for i in range(5):
        base = B + np.array([-s * xs[i], 0.010 + 0.004 * i, 0.002])
        tip = base + np.array([0, -lens[i], -0.004])
        toes.append(RoundCone(base, tip, rads[i], rads[i] * 0.92))
    P['toe.' + side] = Intersect(Union(toes, k=0.004), HalfSpace([0, 0, 0.0], [0, 0, -1.0],
                                                                 Union(toes).bbox), k=0.003)
    return P


def all_parts():
    P = {}
    hp = head_parts()
    P.update({k: v for k, v in hp.items() if k not in ('sockets', 'mouth_slit')})
    P.update(torso_parts())
    for side in ('L', 'R'):
        P.update(arm_parts(side))
        P.update(leg_parts(side))
    return P, hp['sockets'], hp['mouth_slit']


# blend radius between neighbouring parts
def build_skin():
    P, sockets, slit = all_parts()
    head_grp = Union([P['head'], P['ears']], k=0.006)
    face = Union([head_grp, P['jaw']], k=0.010)
    face = Subtract(face, sockets, k=0.0016)
    face = Subtract(face, [slit], k=0.0015)
    neck_head = Union([face, P['neck']], k=0.018)
    torso = Union([P['hips'], P['spine'], P['chest']], k=0.04)
    body = Union([torso, neck_head], k=0.03)
    limbs = []
    for side in ('L', 'R'):
        arm = Union([P['upperarm.' + side], P['forearm.' + side]], k=0.006)
        hand = P['hand.' + side]
        fingers = [P[f'{f}{i}.{side}'] for f in ('thumb', 'index', 'middle', 'ring', 'pinky')
                   for i in (1, 2, 3)]
        hand = Union([hand] + fingers, k=0.006)
        arm = Union([arm, hand], k=0.006)
        leg = Union([P['thigh.' + side], P['shin.' + side]], k=0.008)
        foot = Union([P['foot.' + side], P['toe.' + side]], k=0.005)
        leg = Union([leg, foot], k=0.02)
        limbs += [arm, leg]
    skin = Union([body, limbs[0], limbs[2]], k=0.016)  # arms blend into shoulders
    skin = Union([skin, limbs[1], limbs[3]], k=0.035)  # legs into hips
    return skin, P


PART_BONE = {
    'head': 'head', 'ears': 'head', 'jaw': 'jaw', 'neck': 'neck',
    'hips': 'hips', 'spine': 'spine', 'chest': 'chest',
}
for _s in ('L', 'R'):
    for _p in ('upperarm', 'forearm', 'hand', 'thigh', 'shin', 'foot', 'toe'):
        PART_BONE[f'{_p}.{_s}'] = f'{_p}.{_s}'
    for _f in ('thumb', 'index', 'middle', 'ring', 'pinky'):
        for _i in (1, 2, 3):
            PART_BONE[f'{_f}{_i}.{_s}'] = f'{_f}{_i}.{_s}'


# ----------------------------------------------------------------- tunic (one-shoulder, torn hem)
def _jag(u, teeth, amp, seed):
    """sawtooth-ish torn edge offset for a parameter u in [0,1)."""
    rng = np.random.RandomState(seed)
    ph = rng.uniform(0, 1, teeth + 1)
    a = rng.uniform(0.4, 1.0, teeth + 1)
    x = u * teeth
    i = np.floor(x).astype(int) % teeth
    f = x - np.floor(x)
    tri = 1.0 - np.abs(2.0 * f - 1.0)          # 0..1..0 per tooth
    return amp * tri * a[i] + 0.25 * amp * np.sin(6.283 * (u * 3 + ph[0]))


def tunic_shape(thick=0.0065):
    E = Ellipsoid

    def skirt_cone(P):
        z = np.clip(P[:, 2], 0.55, 1.20)
        t = np.clip((z - 0.60) / 0.45, 0, 1)
        t = t * t * (3 - 2 * t)
        rx = 0.192 + (0.150 - 0.192) * t
        ry = 0.150 + (0.118 - 0.150) * t
        q = np.sqrt((P[:, 0] / rx) ** 2 + ((P[:, 1] - 0.016) / ry) ** 2)
        d = (q - 1.0) * np.minimum(rx, ry)
        return np.maximum(d, np.maximum(0.58 - P[:, 2], P[:, 2] - 1.20))

    env = Union([
        E([0, 0.010, 1.245], [0.160, 0.124, 0.166]),            # ribcage
        E([0, 0.064, 1.322], [0.124, 0.078, 0.102]),            # hunch
        E([0, -0.006, 1.045], [0.150, 0.114, 0.122]),           # belly
        E([0, 0.018, 0.935], [0.160, 0.118, 0.120]),            # hips
        Func(skirt_cone, (np.array([-0.21, -0.15, 0.55]), np.array([0.21, 0.19, 1.21]))),
        RoundCone([0.040, 0.030, 1.425], [0.160, 0.018, 1.392], 0.042, 0.039),   # strap over L shoulder
    ], k=0.035)

    def shell_and_cuts(P):
        d = env(P)
        d = np.maximum(d, -(d + thick))                        # thin shell
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        # torn hem
        th = np.arctan2(x, -(y - 0.02)) / (2 * np.pi) % 1.0
        hem = 0.655 + _jag(th, 13, 0.030, 3)
        d = smax(d, hem - z, 0.003)
        # diagonal top edge: under the right arm, over the left shoulder
        u = np.clip((x + 0.20) / 0.40, 0, 1)
        top = 1.262 + np.maximum(x + 0.05, 0) * 1.05 + _jag(u, 7, 0.016, 7) + 0.010 * (y > 0.03)
        d = smax(d, z - top, 0.003)
        # neck hole
        dn = 0.074 - np.sqrt(x ** 2 + ((y - 0.012) * 1.15) ** 2)
        d = smax(d, np.where(z > 1.36, dn, -1.0), 0.004)
        return d

    global _TUNIC_ENV
    _TUNIC_ENV = env
    arm_cuts = []
    for side in ('L', 'R'):
        s = SIDES[side]
        d_, t_, n_ = arm_frame(s)
        S_ = J['shoulder.' + side]
        arm_cuts.append(RoundCone(S_ + d_ * 0.045, J['elbow.' + side], 0.052, 0.045))
    shell = Func(shell_and_cuts, (np.array([-0.24, -0.16, 0.55]), np.array([0.24, 0.20, 1.50])))
    return Subtract(shell, arm_cuts, k=0.004)


_TUNIC_ENV = None


def tunic_inner_depth(X):
    """>0 when a point is safely covered by the tunic: inside its envelope and at least
    3 cm away from the top edge and 11 cm from the shoulder joints (arm holes)."""
    if _TUNIC_ENV is None:
        tunic_shape()
    x, z = X[:, 0], X[:, 2]
    inside = -_TUNIC_ENV(X) - 0.004
    u = np.clip((x + 0.20) / 0.40, 0, 1)
    top = 1.262 + np.maximum(x + 0.05, 0) * 1.05 + _jag(u, 7, 0.016, 7)
    away = (top - 0.03) - z
    for side in ('L', 'R'):
        away = np.minimum(away, np.linalg.norm(X - J['shoulder.' + side], axis=1) - 0.11)
    return np.minimum(inside * 10.0, away)


# ----------------------------------------------------------------- the neighbour's pointing hand
def neighbour_arm_shape(S=1.18):
    """forearm along +X (elbow side), hand at the origin pointing to -X, palm down, thumb towards -Y."""
    v = lambda *a: np.array(a, dtype=float) * S
    hand = Union([
        RoundCone(v(0.36, 0, 0.01), v(0.0, 0, 0), 0.046 * S, 0.031 * S),          # forearm
        Ellipsoid(v(0.21, 0, 0.012), [0.11 * S, 0.040 * S, 0.037 * S]),            # muscle
        RoundBox(v(-0.048, 0, 0), [0.040 * S, 0.036 * S, 0.008 * S], None, 0.010 * S),
        Ellipsoid(v(-0.030, -0.024, -0.006), [0.028 * S, 0.016 * S, 0.012 * S]),   # thenar
    ], k=0.02)
    fingers = []
    k = v(-0.090, -0.026, 0.002)
    pts = [k, k + v(-0.045, -0.003, 0.003), k + v(-0.073, -0.004, 0.003), k + v(-0.094, -0.004, 0.0)]
    rad = (0.0098, 0.0090, 0.0084, 0.0074)
    for i in range(3):
        fingers.append(RoundCone(pts[i], pts[i + 1], rad[i] * S, rad[i + 1] * S))
        fingers.append(Sphere(pts[i + 1], rad[i + 1] * S * 1.05))
    for (ky, L) in ((-0.008, (0.044, 0.028, 0.022)), (0.010, (0.042, 0.027, 0.021)), (0.026, (0.034, 0.021, 0.019))):
        k = v(-0.088, ky, 0.0)
        d1 = np.array([-0.55, 0, -0.83]); d2 = np.array([0.35, 0, -0.94]); d3 = np.array([0.95, 0, -0.30])
        p1 = k + d1 / np.linalg.norm(d1) * L[0] * S
        p2 = p1 + d2 / np.linalg.norm(d2) * L[1] * S
        p3 = p2 + d3 / np.linalg.norm(d3) * L[2] * S
        r = 0.0094 * S
        fingers += [RoundCone(k, p1, r, r * 0.96), RoundCone(p1, p2, r * 0.96, r * 0.9),
                    RoundCone(p2, p3, r * 0.9, r * 0.82)]
    t0, t1, t2, t3 = v(-0.012, -0.030, -0.004), v(-0.052, -0.050, -0.014), v(-0.082, -0.044, -0.024), v(-0.098, -0.030, -0.032)
    fingers += [RoundCone(t0, t1, 0.0135 * S, 0.0115 * S), RoundCone(t1, t2, 0.0115 * S, 0.0100 * S),
                RoundCone(t2, t3, 0.0100 * S, 0.0088 * S)]
    return Union([hand, Union(fingers, k=0.004)], k=0.008)
