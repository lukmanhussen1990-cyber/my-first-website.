"""v3 frames 349-1590: the room and the starfield with the Buddha (the man of the house) and the thief.
Hard cuts on the lyric lines (no cross-dissolves, so nothing ghosts); the room is taken by a starry dome on
"घर भी ले जा", as in the original film."""
import os, sys, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(1, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "v2"))  # v2 helpers
import v2lib as L
import v2_room as R2
import v2_fx as F2
import v3_beats as B
import v3_room as RM
import v3_owner as OW
import v3_fx as FX

W, H = RM.W, RM.H
ease, ramp = B.ease, B.ramp
OWN = (230.0, 1722.0)
OS = 0.56
OWN_M = np.array([[OS, 0, OWN[0]], [0, OS, OWN[1]], [0, 0, 1]], np.float64)
THIEF = dict(x=880.0, y=1700.0, h=690.0)
THIEF_HAND = (THIEF['x'] + (THIEF['h'] / 1014.0) * (40 - 465), THIEF['y'] - (THIEF['h'] / 1014.0) * (1024 - 263))
WIDE0, WIDE1 = (1.00, 540, 960), (1.04, 540, 975)

SHOTS = [
    ('S4', 349, 407, WIDE0, (1.04, 555, 960)),
    ('S5', 408, 464, None, None),                                   # the thief's hand (own composition)
    ('S6', 465, 547, (5.00, 282, 1268), (5.30, 284, 1266)),         # the Buddha's face: "मैंने बोला"
    ('S7', 548, 641, WIDE0, (1.05, 530, 975)),
    ('jeet', 642, 712, (1.22, 440, 930), (1.28, 440, 930)),
    ('haar', 713, 772, (1.02, 540, 975), (1.07, 530, 995)),
    ('dar', 773, 832, (1.18, 460, 1080), (1.24, 450, 1075)),
    ('ghar', 833, 893, (1.05, 540, 975), WIDE0),
    ('khwab', 894, 952, WIDE0, (1.05, 525, 945)),
    ('raaz', 953, 1012, (1.85, 360, 1390), (1.95, 360, 1385)),
    ('gham', 1013, 1072, (1.55, 390, 1110), (1.62, 385, 1105)),
    ('zakhm', 1073, 1132, (1.45, 380, 1255), (1.52, 380, 1250)),
    ('zaat', 1133, 1193, (1.30, 430, 1180), (1.36, 430, 1175)),
    ('auqaat', 1194, 1252, WIDE0, (1.05, 530, 980)),
    ('baat', 1253, 1311, (1.25, 440, 1150), (1.31, 440, 1145)),
    ('haalaat', 1312, 1469, (1.10, 540, 960), WIDE0),
    ('end', 1470, 1590, WIDE0, WIDE0),
]


def shot_at(n):
    cur = SHOTS[0]
    for s in SHOTS:
        if s[1] <= n:
            cur = s
    return cur


def cam_at(n, shot=None):
    s = shot or shot_at(n)
    nm, a, b, c0, c1 = s
    t = ease((n - a) / max(1, b - a))
    return tuple(c0[i] * (1 - t) + c1[i] * t for i in range(3))


# ---------------------------------------------------------------- the Buddha's performance
KEYS = [(0, 'rest'), (466, 'rest'), (474, 'talk'), (494, 'talk'), (508, 'rest'), (642, 'rest'),
        (660, 'offer'), (692, 'offer'), (700, 'give'), (708, 'give'),                       # जीत
        (720, 'offer'), (752, 'offer'), (760, 'give'), (768, 'give'),                       # हार
        (780, 'offer'), (788, 'abhaya'), (812, 'abhaya'), (820, 'give'), (828, 'give'),     # डर (fear-not mudra)
        (842, 'offer'), (872, 'offer'), (880, 'give'), (890, 'give'),                       # घर
        (900, 'raise'), (930, 'raise'), (938, 'give'), (946, 'give'),                       # ख़्वाब (kite string)
        (960, 'offer'), (992, 'offer'), (1000, 'give'), (1008, 'give'),                     # राज़ (casket)
        (1020, 'lap'), (1052, 'lap'), (1060, 'offer'), (1068, 'offer'),                     # ग़म
        (1078, 'lap'), (1110, 'lap'), (1119, 'give'), (1128, 'give'),                       # ज़ख़्म
        (1140, 'raise'), (1170, 'raise'), (1178, 'give'), (1188, 'give'),                   # ज़ात (whorl)
        (1200, 'offer'), (1230, 'offer'), (1238, 'give'), (1248, 'give'),                   # औक़ात
        (1258, 'offer'), (1290, 'offer'), (1298, 'give'), (1306, 'give'),                   # बात (letters)
        (1318, 'low'), (1350, 'low'), (1358, 'give'), (1368, 'give'), (1396, 'rest'), (1440, 'lap'), (1600, 'lap')]
FAR = {'raise': 'lap', 'abhaya': 'lap', 'talk': 'lap'}
FAR_OFF = (4.0, 6.0, 5.0)


def _pose(n, far=False):
    m = n - (3 if far else 0)
    for (f0, p0), (f1, p1) in zip(KEYS, KEYS[1:]):
        if f0 <= m < f1:
            if far:
                p0, p1 = FAR.get(p0, p0), FAR.get(p1, p1)
            t = ease((m - f0) / max(1, f1 - f0))
            p = OW.mix_pose(p0, p1, t)
            break
    else:
        p = OW.POSES['rest']
    if far:
        p = tuple(p[i] + FAR_OFF[i] for i in range(3))
    sway = 1.2 * math.sin(n * 0.07)                                  # never perfectly still
    return (p[0] + sway, p[1] + 0.8 * sway, p[2])


def _bump(n, a, b, c, d):
    return min(ramp(n, a, b), 1 - ramp(n, c, d))


def owner_state(n):
    lean = 0.6 * math.sin(2 * math.pi * n / 96.0)
    for nm, a, k, l in B.LINES:
        lean += 4.0 * _bump(n, l - 5, l + 1, l + 9, l + 20)          # bows as he gives it away
    head = -1.2 * float(np.clip(B.voice(n) - 0.3, 0, 1))
    looks = {'gham': (-12, 6, 12), 'khwab': (-7, 0, 10), 'zaat': (-6, 0, 10), 'baat': (-5, 0, 20), 'jeet': (-3, 0, 4)}
    for nm, (deg, pre, post) in looks.items():
        a, k, l = B.LINE[nm]
        head += deg * _bump(n, k - pre - 8, k - pre, l + post, l + post + 10)
    jaw = 0.0
    if 462 <= n <= 1372:
        jaw = 0.85 * float(np.clip((B.voice(n) - 0.15) / 0.5, 0, 1))
    return dict(lean=lean, head=head, jaw=jaw, arm_n=_pose(n), arm_f=_pose(n, far=True))


def torso_M(n):
    return OW.rigid(OW.HIP, owner_state(n)['lean'])


def u2s(p, T=None):
    q = np.array([p[0], p[1], 1.0])
    if T is not None:
        q = T @ q
    q = OWN_M @ q
    return (float(q[0]), float(q[1]))


# ---------------------------------------------------------------- the thief
def thief_state(n):
    """(sprite, frame index, feet x, feet y, bob)"""
    if n < 372:
        t = ramp(n, 349, 372)
        x = 1240 + (THIEF['x'] - 1240) * (1 - (1 - t) ** 1.6)
        nw = len(RM.spr('walk')[0])
        return 'walk', (n // 2) % nw, x, THIEF['y'], abs(math.sin(n / 4.0 * math.pi)) * 8
    if n < 374:
        return 'reach', 0, THIEF['x'], THIEF['y'], 0.0
    if n < 384:
        return 'reach', int(round(ease((n - 374) / 10.0) * 27)), THIEF['x'], THIEF['y'], 0.0
    if n >= 1404:
        return 'reach', int(round(27 * (1 - ease((n - 1403) / 8.0)))), THIEF['x'], THIEF['y'], 0.0
    idx = None
    for nm, a, k, l in B.LINES:
        if l + 12 <= n <= l + 30:                                    # beckons as it reaches him
            idx = int(round(27 - 8 * math.sin(math.pi * (n - l - 12) / 18.0)))
    if idx is None:
        p = (n // 6) % 6
        idx = 24 + (p if p < 4 else 6 - p)
    return 'reach', min(27, idx), THIEF['x'], THIEF['y'], 0.0


def thief_height(name):
    return THIEF['h'] * {'reach': 1.0, 'walk': 1.0, 'idle': 0.985}.get(name, 1.0)


# ---------------------------------------------------------------- grading (lamp + moon), starry body
def _rim(a, d, width):
    dx, dy = int(round(d[0] * width)), int(round(d[1] * width))
    sh = np.roll(np.roll(a, dy, axis=0), dx, axis=1)
    return cv2.GaussianBlur(np.clip(a - sh, 0, 1), (0, 0), max(0.8, width * 0.6))


_STARTEX = {}


def star_texture(shape, seed):
    key = (shape, seed)
    if key not in _STARTEX:
        rng = np.random.default_rng(seed)
        hh, ww = shape
        dots = np.zeros(shape, np.float32)
        m = max(40, hh * ww // 500)
        ys, xs = rng.integers(0, hh, m), rng.integers(0, ww, m)
        dots[ys, xs] = rng.uniform(0.3, 1.0, m)
        big = np.zeros(shape, np.float32)
        mb = m // 14
        big[rng.integers(0, hh, mb), rng.integers(0, ww, mb)] = 1.0
        neb = cv2.resize(rng.random((hh // 40 + 2, ww // 40 + 2)).astype(np.float32), (ww, hh), interpolation=cv2.INTER_CUBIC)
        _STARTEX[key] = (cv2.GaussianBlur(dots, (0, 0), 0.9) * 6, cv2.GaussianBlur(big, (0, 0), 2.2) * 30, neb,
                         rng.uniform(0, 6.3, 1)[0])
    return _STARTEX[key]


def grade(pm, warm_dir, cool_dir, width, exposure=1.0, warm_k=0.9, cool_k=0.55, star=0.0, n=0, seed=0, lamp=1.0):
    a = np.clip(pm[..., 3], 0, 1)
    rgb = pm[..., :3] / np.maximum(a[..., None], 1e-4)
    hh = rgb.shape[0]
    grad = np.linspace(0.90, 1.06, hh, dtype=np.float32)[:, None, None]
    expo = exposure * (0.55 + 0.45 * lamp)
    out = rgb * np.array([0.90, 0.94, 1.0], np.float32) * expo * grad
    out = out + _rim(a, warm_dir, width)[..., None] * np.array([0.25, 0.60, 1.0], np.float32) * warm_k * lamp
    out = out + _rim(a, cool_dir, width)[..., None] * np.array([0.62, 0.50, 0.44], np.float32) * cool_k
    if star > 0:
        dots, big, neb, ph = star_texture(a.shape, seed)
        tw = 0.75 + 0.25 * math.sin(n * 0.21 + ph)
        sky = np.array([0.36, 0.13, 0.10], np.float32)[None, None] * (0.7 + 0.5 * neb[..., None])
        starry = sky + (dots * tw + big)[..., None] * np.array([1.0, 0.94, 0.90], np.float32)
        edge = np.clip(a - cv2.erode(a, np.ones((5, 5), np.uint8)), 0, 1)
        starry = starry + cv2.GaussianBlur(edge, (0, 0), 1.2)[..., None] * np.array([1.0, 0.86, 0.86], np.float32) * 1.4
        yy = np.linspace(1, 0, hh, dtype=np.float32)[:, None]
        wipe = np.clip((star * 1.25 - yy) * 5, 0, 1)                       # from the seat upwards
        out = out * (1 - wipe[..., None]) + starry * wipe[..., None]
    return np.dstack([out * a[..., None], a]).astype(np.float32)


# ---------------------------------------------------------------- the owner's canvas for a shot
LEVELS = (0.6, 0.8, 1.1, 1.6, 3.0)


def owner_render(n, cam):
    z = cam[0]
    want = OS * z
    ppu = next((v for v in LEVELS if v >= want * 0.92), LEVELS[-1])
    # only the part of him the camera sees
    Mc = RM.cam_matrix(cam)
    inv = np.linalg.inv(np.vstack([Mc, [0, 0, 1]]))
    c = np.array([[0, 0, 1], [W, 0, 1], [0, H, 1], [W, H, 1]], np.float64).T
    sx, sy = (inv @ c)[:2]
    ux0, ux1 = (sx.min() - OWN[0]) / OS, (sx.max() - OWN[0]) / OS
    uy0, uy1 = (sy.min() - OWN[1]) / OS, (sy.max() - OWN[1]) / OS
    box = (max(-420, ux0 - 20), max(-1040, uy0 - 20), min(660, ux1 + 20), min(12, uy1 + 20))
    if box[2] <= box[0] or box[3] <= box[1]:
        return None
    st = owner_state(n)
    can, A, an = OW.compose(st, ppu, box)
    return can, A, an, st, ppu


# ---------------------------------------------------------------- frame
def base_room(n, cam, star_m):
    st = RM.build_sets()
    flick = 1 + 0.035 * math.sin(n * 0.9) + 0.02 * math.sin(n * 2.3 + 1)
    img = None
    if star_m is None or star_m.min() < 1:
        room = RM.view(st['room'], cam)
        lm = RM.view(st['lamp'], cam)
        room = room * (1 + (flick - 1) * 0.8 * lm[..., None])
        RM.place_scales(room, cam, FX.scales_k(n))
        img = room
    if star_m is not None and star_m.max() > 0:
        star = RM.view(st['star'], cam)
        img = star if img is None else img * (1 - star_m[..., None]) + star * star_m[..., None]
    return img


def star_mask(n, cam):
    """1 where the starry dome has taken the room (output space)"""
    r = FX.dome(n)
    if r <= 0:
        return None
    if r >= 2600:
        return np.ones((H, W), np.float32)
    Mc = RM.cam_matrix(cam)
    cx, cy = Mc @ np.array([FX.MOONC[0], FX.MOONC[1], 1.0])
    yy, xx = np.ogrid[0:H, 0:W]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2).astype(np.float32)
    return np.clip((r * cam[0] - d) / 24.0 + 0.5, 0, 1)


def fear_alpha(a, A, an, grow):
    """the owner's silhouette with horns and claws (for the fear shadow)"""
    if grow <= 0:
        return a
    a = a.copy()
    Ainv = np.linalg.inv(np.vstack([A, [0, 0, 1]]))
    def P(pts):
        q = np.array([[x, y, 1.0] for x, y in pts]).T
        return ((Ainv @ q)[:2].T * 16).astype(np.int32)
    hx, hy = an['head_top']
    for sgn in (-1, 1):
        base = [(hx + sgn * 24 - 16, hy + 40), (hx + sgn * 24 + 16, hy + 40)]
        tip = (hx + sgn * (60 + 50 * grow), hy - 140 * grow)
        mid = (hx + sgn * (30 + 10 * grow), hy - 70 * grow)
        pts = [base[0], (mid[0] - 10, mid[1]), tip, (mid[0] + 10, mid[1]), base[1]]
        cv2.fillPoly(a, [P(pts)], 1.0, cv2.LINE_AA, 4)
    px, py = an['palm']
    for i, ang in enumerate((-40, -15, 10)):
        r = math.radians(ang)
        ln = 130 * grow
        tip = (px + 60 + ln * math.cos(r), py + ln * math.sin(r))
        pts = [(px + 30, py - 14 + 10 * i), tip, (px + 30, py - 2 + 10 * i)]
        cv2.fillPoly(a, [P(pts)], 1.0, cv2.LINE_AA, 4)
    return a


def render_frame(n):
    shot = shot_at(n)
    if shot[0] == 'S5':
        return hand_closeup(n)
    cam = cam_at(n, shot)
    sm = star_mask(n, cam)
    img = base_room(n, cam, sm)
    room_k = 1.0 if sm is None else 1 - sm                           # per-pixel 'still the room'
    lamp = FX.lamp_k(n)
    Mc3 = np.vstack([RM.cam_matrix(cam), [0, 0, 1]])
    # ---- the Buddha
    ow = owner_render(n, cam)
    pm_o = M_o = None
    ctx = dict(thief_hand=THIEF_HAND, flame=RM.DIYA_LIGHT)
    if ow is not None:
        can, A, an, st, ppu = ow
        width = 3.0 * ppu / 0.6
        pm_o = grade(can, (1.0, 0.35), (0.35, -1.0), width, exposure=1.0, star=FX.star_body(n), n=n, seed=int(ppu * 100), lamp=lamp)
        M_set = OWN_M @ np.vstack([A, [0, 0, 1]])
        M_o = (Mc3 @ M_set)[:2]
        Tt = OW.rigid(OW.HIP, st['lean'])
        ctx.update(palm=u2s(an['palm']), chest=u2s(an['chest']), belly=u2s(an['belly']), mouth=u2s(an['mouth']),
                   torso_to_set=lambda p, T=Tt: u2s(p, T))
    else:
        st = owner_state(n)
        Tt = OW.rigid(OW.HIP, st['lean'])
        ctx.update(palm=u2s((519, -448)), chest=u2s((40, -600), Tt), belly=u2s((-10, -420), Tt), mouth=u2s((118, -819), Tt),
                   torso_to_set=lambda p, T=Tt: u2s(p, T))
    # ---- the thief
    name, idx, tx, ty, bob = thief_state(n)
    arr, g = RM.spr(name)
    Mt_set = R2.feet_matrix(name, tx, ty - bob, thief_height(name)) if name != 'walk' else R2.feet_matrix('walk', tx, ty - bob, THIEF['h'])
    sp = arr[idx].astype(np.float32) / 255.0
    pm_t = grade(np.dstack([sp[..., :3] * sp[..., 3:4], sp[..., 3]]), (-1.0, 0.35), (-0.35, -1.0), 3.0, exposure=1.0, lamp=lamp)
    Mt = RM.compose(RM.cam_matrix(cam), Mt_set)
    # ---- wall shadows from the little lamp (room only)
    if room_k is not None and (np.isscalar(room_k) or room_k.max() > 0):
        grow, lift, keep = FX.fear_shadow(n)
        if pm_o is not None and keep > 0:
            a_s = fear_alpha(can[..., 3], A, an, grow)
            k_s = 1.7 + 0.25 * grow
            extra = None
            if lift > 0:
                sx, sy = 120.0, 1050.0
                s_ = 1 - 0.9 * lift
                tx_, ty_ = sx + (FX.MOONC[0] - sx) * lift, sy + (FX.MOONC[1] - sy) * lift - 120 * math.sin(math.pi * lift)
                extra = np.array([[s_, 0, tx_ - s_ * sx], [0, s_, ty_ - s_ * sy]], np.float64)
            tremble = np.array([[1, 0, 3 * grow * math.sin(n * 1.7)], [0, 1, 2 * grow * math.cos(n * 1.3)]], np.float64)
            sh = RM.shadow_on_wall(img, cam, a_s, (OWN_M @ np.vstack([A, [0, 0, 1]]))[:2], k=k_s,
                                   strength=0.0, extra=RM.compose(tremble, extra) if extra is not None else tremble)
            rk = room_k if np.isscalar(room_k) else room_k
            img *= (1 - 0.55 * keep * sh * rk * lamp)[..., None]
            ys, xs = np.nonzero(sh > 0.3)
            if len(xs):
                inv = np.linalg.inv(Mc3)
                c = inv @ np.array([xs.mean(), ys.mean(), 1.0])
                ctx['shadow_c'] = (float(c[0]), float(c[1]))
        sh = RM.shadow_on_wall(img, cam, pm_t[..., 3], Mt_set, k=1.7, strength=0.0)
        rk = room_k if np.isscalar(room_k) else room_k
        img *= (1 - 0.42 * sh * rk * lamp)[..., None]
    RM.contact_shadow(img, cam, OWN[0] + 10, OWN[1] - 2, 190)
    RM.contact_shadow(img, cam, tx, ty - 4, 150, k=1 - ease((n - 1426) / 20.0))
    FX.behind(img, n, cam, ctx)
    if pm_o is not None:
        RM.place(img, pm_o, M_o)
    RM.draw_diya(img, cam, n, flame_k=lamp)
    if n >= F2.D0:
        F2.dissolve_thief(img, n, pm_t, Mt)
    else:
        RM.place(img, pm_t, Mt)
    FX.front(img, n, cam, ctx)
    return img


# ---------------------------------------------------------------- S5: the thief's open hand reaching for the moon
def hand_closeup(n):
    cam = (2.25 - 0.06 * ease(ramp(n, 408, 464)), 600, 1040)
    img = base_room(n, cam, None)
    arr, g = RM.spr('hand')
    s = 0.92
    drift = 30 * ease(ramp(n, 408, 464))
    tip_x, tip_y = 230 - drift, 1330 + 2.0 * math.sin(n * 0.7)
    M = np.array([[s, 0, tip_x - s * 8], [0, s, tip_y - s * 111]], np.float64)
    pm = R2.room_lit(arr[0], (-5, 4), (-3, -5), exposure=1.0)
    RM.place(img, pm, M)
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    img *= (0.92 + 0.14 * yy)
    return img


if __name__ == '__main__':
    od = RM.S + '/v3/look'
    os.makedirs(od, exist_ok=True)
    for n in [int(v) for v in sys.argv[1].split(',')]:
        cv2.imwrite(f'{od}/st_{n:04d}.jpg', L.u8(render_frame(n)), [cv2.IMWRITE_JPEG_QUALITY, 90])
        print('ok', n, flush=True)
