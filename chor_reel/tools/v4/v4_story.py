"""v4 frames 349-1590 (16:9): the room and the starfield with the Buddha and the cosmic thief, laid out like the
original film. Hard cuts on the lyric lines; the room is taken by a starry dome on "घर भी ले जा"."""
import os, sys, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
for _d in ("v3", "v2"):  # shared helpers
    sys.path.insert(1, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), _d))
import v2lib as L
import v3_beats as B
import v3_owner as OW
import v4_room as RM
import v4_fx as FX
import v4_thief as TH

W, H = RM.W, RM.H
ease, ramp = B.ease, B.ramp
OWN = (430.0, 832.0)
OS = 0.38
OWN_M = np.array([[OS, 0, OWN[0]], [0, OS, OWN[1]], [0, 0, 1]], np.float64)
THX, THY, TS = 1640.0, 935.0, 0.69                 # thief hem centre (set px) and units -> set px
WIDE = (1.0, 960, 540)

SHOTS = [
    ('S4', 349, 407, WIDE, (1.03, 975, 540)),
    ('S5', 408, 464, None, None),                                 # the thief's starry hand
    ('S6', 465, 547, (4.4, 482, 520), (4.6, 482, 518)),           # the Buddha's face
    ('S7', 548, 641, WIDE, (1.04, 950, 540)),
    ('jeet', 642, 712, (1.5, 990, 470), (1.56, 990, 468)),
    ('haar', 713, 772, (1.03, 960, 540), (1.07, 960, 535)),
    ('dar', 773, 832, (1.25, 768, 520), (1.30, 760, 515)),
    ('ghar', 833, 893, (1.05, 960, 540), WIDE),
    ('khwab', 894, 952, WIDE, (1.05, 940, 520)),
    ('raaz', 953, 1012, (1.8, 700, 600), (1.9, 700, 595)),
    ('gham', 1013, 1072, (1.4, 800, 520), (1.46, 800, 515)),
    ('zakhm', 1073, 1132, (1.6, 620, 610), (1.66, 620, 605)),
    ('zaat', 1133, 1193, (1.3, 860, 520), (1.36, 860, 515)),
    ('auqaat', 1194, 1252, WIDE, (1.05, 950, 540)),
    ('baat', 1253, 1311, (1.3, 860, 520), (1.36, 860, 515)),
    ('haalaat', 1312, 1469, (1.12, 960, 540), WIDE),
    ('end', 1470, 1590, WIDE, WIDE),
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


# ---------------------------------------------------------------- the Buddha (no lip movement, as in the original)
KEYS = [(0, 'rest'), (466, 'rest'), (474, 'talk'), (494, 'talk'), (508, 'rest'), (642, 'rest'),
        (660, 'offer'), (692, 'offer'), (700, 'give'), (708, 'give'),
        (720, 'offer'), (752, 'offer'), (760, 'give'), (768, 'give'),
        (780, 'offer'), (788, 'abhaya'), (812, 'abhaya'), (820, 'give'), (828, 'give'),
        (842, 'offer'), (872, 'offer'), (880, 'give'), (890, 'give'),
        (900, 'raise'), (930, 'raise'), (938, 'give'), (946, 'give'),
        (960, 'offer'), (992, 'offer'), (1000, 'give'), (1008, 'give'),
        (1020, 'lap'), (1052, 'lap'), (1060, 'offer'), (1068, 'offer'),
        (1078, 'lap'), (1110, 'lap'), (1119, 'give'), (1128, 'give'),
        (1140, 'raise'), (1170, 'raise'), (1178, 'give'), (1188, 'give'),
        (1200, 'offer'), (1230, 'offer'), (1238, 'give'), (1248, 'give'),
        (1258, 'offer'), (1290, 'offer'), (1298, 'give'), (1306, 'give'),
        (1318, 'low'), (1350, 'low'), (1358, 'give'), (1368, 'give'), (1396, 'rest'), (1440, 'lap'), (1600, 'lap')]
FAR = {'raise': 'lap', 'abhaya': 'lap', 'talk': 'lap'}
FAR_OFF = (4.0, 6.0, 5.0)


def _pose(n, far=False):
    m = n - (3 if far else 0)
    p = OW.POSES['rest']
    for (f0, p0), (f1, p1) in zip(KEYS, KEYS[1:]):
        if f0 <= m < f1:
            if far:
                p0, p1 = FAR.get(p0, p0), FAR.get(p1, p1)
            p = OW.mix_pose(p0, p1, ease((m - f0) / max(1, f1 - f0)))
            break
    if far:
        p = tuple(p[i] + FAR_OFF[i] for i in range(3))
    sway = 1.2 * math.sin(n * 0.07)
    return (p[0] + sway, p[1] + 0.8 * sway, p[2])


def _bump(n, a, b, c, d):
    return min(ramp(n, a, b), 1 - ramp(n, c, d))


def owner_state(n):
    lean = 0.6 * math.sin(2 * math.pi * n / 96.0)
    for nm, a, k, l in B.LINES:
        lean += 4.0 * _bump(n, l - 5, l + 1, l + 9, l + 20)
    head = 0.0
    looks = {'gham': (-12, 6, 12), 'khwab': (-7, 0, 10), 'zaat': (-6, 0, 10), 'baat': (-5, 0, 20)}
    for nm, (deg, pre, post) in looks.items():
        a, k, l = B.LINE[nm]
        head += deg * _bump(n, k - pre - 8, k - pre, l + post, l + post + 10)
    return dict(lean=lean, head=head, jaw=0.0, arm_n=_pose(n), arm_f=_pose(n, far=True))


def u2s(p, T=None):
    q = np.array([p[0], p[1], 1.0])
    if T is not None:
        q = T @ q
    q = OWN_M @ q
    return (float(q[0]), float(q[1]))


# ---------------------------------------------------------------- the cosmic thief
def thief_state(n):
    st = dict(sway=0.0, ripple=1.0, reveal=1.0)
    x = THX
    if n < 374:
        t = ramp(n, 349, 374)
        x = 2080 + (THX - 2080) * (1 - (1 - t) ** 2.2)
        mv = 1 - t
        st['sway'] = -16 * mv
        st['ripple'] = 1 + 1.5 * mv
        arm = TH.POSES['down']
    elif n < 388:
        arm = TH.mix('down', 'reach', ease((n - 374) / 14.0))
    elif n >= 1403:
        arm = TH.mix('reach', 'down', ease((n - 1403) / 10.0))
    else:
        arm = TH.POSES['reach']
        for nm, a, k, l in B.LINES:
            if l + 12 <= n <= l + 32:                      # beckons as the gift reaches him
                arm = TH.mix('reach', 'beckon', math.sin(math.pi * (n - l - 12) / 20.0))
        sw = 3 * math.sin(n * 0.05)
        arm = (arm[0] + sw, arm[1] + sw, arm[2] + 1.5 * sw)
    st['arm'] = arm
    st['sway'] += 5 * math.sin(n * 0.045)
    y = THY + 4 * math.sin(2 * math.pi * n / 50.0)
    return st, x, y


def thief_render(n, cam, scale=TS, box=(-660, -1060, 260, 40)):
    st, x, y = thief_state(n)
    ppu = round(scale * cam[0], 2)
    pm, glow, A, an = TH.render(n, st, ppu, box)
    U2S = np.array([[scale, 0, x], [0, scale, y], [0, 0, 1]], np.float64)
    M_set = (U2S @ np.vstack([A, [0, 0, 1]]))[:2]
    hand = U2S @ np.array([an['palm'][0], an['palm'][1], 1.0])
    return pm, glow, M_set, (float(hand[0]), float(hand[1])), x, y


# ---------------------------------------------------------------- grading (lamp + moon), starry body
def _rim(a, d, width):
    dx, dy = int(round(d[0] * width)), int(round(d[1] * width))
    sh = np.roll(np.roll(a, dy, axis=0), dx, axis=1)
    return cv2.GaussianBlur(np.clip(a - sh, 0, 1), (0, 0), max(0.8, width * 0.6))


_STARTEX = {}


def star_texture(shape, seed):
    key = (shape, seed)
    if key not in _STARTEX:
        if len(_STARTEX) > 8:
            _STARTEX.clear()
        rng = np.random.default_rng(seed)
        hh, ww = shape
        dots = np.zeros(shape, np.float32)
        m = max(40, hh * ww // 500)
        dots[rng.integers(0, hh, m), rng.integers(0, ww, m)] = rng.uniform(0.3, 1.0, m)
        big = np.zeros(shape, np.float32)
        mb = m // 14
        big[rng.integers(0, hh, mb), rng.integers(0, ww, mb)] = 1.0
        neb = cv2.resize(rng.random((hh // 40 + 2, ww // 40 + 2)).astype(np.float32), (ww, hh), interpolation=cv2.INTER_CUBIC)
        _STARTEX[key] = (cv2.GaussianBlur(dots, (0, 0), 0.9) * 6, cv2.GaussianBlur(big, (0, 0), 2.2) * 30, neb, rng.uniform(0, 6.3))
    return _STARTEX[key]


def grade(pm, warm_dir, cool_dir, width, exposure=1.0, warm_k=0.9, cool_k=0.55, star=0.0, n=0, seed=0, lamp=1.0):
    a = np.clip(pm[..., 3], 0, 1)
    rgb = pm[..., :3] / np.maximum(a[..., None], 1e-4)
    hh = rgb.shape[0]
    grad = np.linspace(0.90, 1.06, hh, dtype=np.float32)[:, None, None]
    out = rgb * np.array([0.90, 0.94, 1.0], np.float32) * exposure * (0.55 + 0.45 * lamp) * grad
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
        wipe = np.clip((star * 1.25 - yy) * 5, 0, 1)
        out = out * (1 - wipe[..., None]) + starry * wipe[..., None]
    return np.dstack([out * a[..., None], a]).astype(np.float32)


LEVELS = (0.4, 0.6, 0.8, 1.1, 1.6, 2.2)


def owner_render(n, cam):
    z = cam[0]
    want = OS * z
    ppu = next((v for v in LEVELS if v >= want * 0.92), LEVELS[-1])
    Mc = RM.cam_matrix(cam)
    inv = np.linalg.inv(np.vstack([Mc, [0, 0, 1]]))
    c = np.array([[0, 0, 1], [W, 0, 1], [0, H, 1], [W, H, 1]], np.float64).T
    sx, sy = (inv @ c)[:2]
    box = (max(-420, (sx.min() - OWN[0]) / OS - 20), max(-1040, (sy.min() - OWN[1]) / OS - 20),
           min(660, (sx.max() - OWN[0]) / OS + 20), min(12, (sy.max() - OWN[1]) / OS + 20))
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
    r = FX.dome(n)
    if r <= 0:
        return None
    if r >= 1750:
        return np.ones((H, W), np.float32)
    cx, cy = RM.cam_matrix(cam) @ np.array([FX.MOONC[0], FX.MOONC[1], 1.0])
    yy, xx = np.ogrid[0:H, 0:W]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2).astype(np.float32)
    return np.clip((r * cam[0] - d) / 20.0 + 0.5, 0, 1)


def fear_alpha(a, A, an, grow):
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
        cv2.fillPoly(a, [P([base[0], (mid[0] - 10, mid[1]), tip, (mid[0] + 10, mid[1]), base[1]])], 1.0, cv2.LINE_AA, 4)
    px, py = an['palm']
    for i, ang in enumerate((-40, -15, 10)):
        r = math.radians(ang)
        ln = 130 * grow
        tip = (px + 60 + ln * math.cos(r), py + ln * math.sin(r))
        cv2.fillPoly(a, [P([(px + 30, py - 14 + 10 * i), tip, (px + 30, py - 2 + 10 * i)])], 1.0, cv2.LINE_AA, 4)
    return a


def render_frame(n):
    shot = shot_at(n)
    if shot[0] == 'S5':
        return hand_closeup(n)
    cam = cam_at(n, shot)
    sm = star_mask(n, cam)
    img = base_room(n, cam, sm)
    room_k = 1.0 if sm is None else 1 - sm
    lamp = FX.lamp_k(n)
    Mc3 = np.vstack([RM.cam_matrix(cam), [0, 0, 1]])
    ctx = dict(flame=RM.DIYA_LIGHT)
    # ---- the cosmic thief
    pm_t, glow_t, Mt_set, hand, tx, ty = thief_render(n, cam)
    Mt = RM.compose(RM.cam_matrix(cam), Mt_set)
    ctx['thief_hand'] = hand
    # ---- the Buddha
    ow = owner_render(n, cam)
    st = owner_state(n)
    Tt = OW.rigid(OW.HIP, st['lean'])
    pm_o = None
    if ow is not None:
        can, A, an, st, ppu = ow
        pm_o = grade(can, (1.0, 0.35), (0.35, -1.0), 3.0 * ppu / 0.6, star=FX.star_body(n), n=n, seed=int(ppu * 100), lamp=lamp)
        M_set = OWN_M @ np.vstack([A, [0, 0, 1]])
        M_o = (Mc3 @ M_set)[:2]
        ctx.update(palm=u2s(an['palm']), chest=u2s(an['chest']), belly=u2s(an['belly']))
    else:
        ctx.update(palm=u2s((519, -448)), chest=u2s((40, -600), Tt), belly=u2s((-10, -420), Tt))
    ctx['torso_to_set'] = lambda p, T=Tt: u2s(p, T)
    # ---- his big shadow on the wall from the little lamp (room only); it turns into a monster on "डर"
    if pm_o is not None and (np.isscalar(room_k) or room_k.max() > 0):
        grow, lift, keep = FX.fear_shadow(n)
        if keep > 0:
            a_s = fear_alpha(can[..., 3], A, an, grow)
            extra = np.array([[1, 0, 3 * grow * math.sin(n * 1.7)], [0, 1, 2 * grow * math.cos(n * 1.3)]], np.float64)
            if lift > 0:
                sx, sy = 260.0, 520.0
                s_ = 1 - 0.9 * lift
                tx_ = sx + (FX.MOONC[0] - sx) * lift
                ty_ = sy + (FX.MOONC[1] - sy) * lift - 90 * math.sin(math.pi * lift)
                extra = RM.compose(np.array([[s_, 0, tx_ - s_ * sx], [0, s_, ty_ - s_ * sy]], np.float64), extra)
            sh = RM.shadow_on_wall(cam, a_s, (OWN_M @ np.vstack([A, [0, 0, 1]]))[:2], k=1.7 + 0.25 * grow, extra=extra)
            img *= (1 - 0.55 * keep * lamp * sh * room_k)[..., None]
            ys, xs = np.nonzero(sh > 0.3)
            if len(xs):
                c = np.linalg.inv(Mc3) @ np.array([xs.mean(), ys.mean(), 1.0])
                ctx['shadow_c'] = (float(c[0]), float(c[1]))
    RM.contact_shadow(img, cam, OWN[0] + 8, OWN[1] - 2, 150)
    FX.behind(img, n, cam, ctx)
    if pm_o is not None:
        RM.place(img, pm_o, M_o)
    RM.draw_diya(img, cam, n, flame_k=lamp)
    if n >= FX.D0:
        FX.dissolve_thief(img, n, pm_t, Mt)
        g = 1 - ramp(n, FX.D0, FX.D0 + FX.DT)
        if g > 0:
            TH.place(img, np.zeros_like(pm_t), glow_t * g, Mt)
    else:
        TH.place(img, pm_t, glow_t, Mt)
    FX.front(img, n, cam, ctx)
    return img


# ---------------------------------------------------------------- S5: the thief's starry hand reaching for the moon
def hand_closeup(n):
    z = 2.6 - 0.08 * ease(ramp(n, 408, 464))
    cam = (z, 1160, 440)
    img = base_room(n, cam, None)
    img = cv2.GaussianBlur(img, (0, 0), 2.5)
    st, _, _ = thief_state(n)
    st['arm'] = (186.0 + 2 * math.sin(n * 0.08), 180.0, 176.0 + 3 * math.sin(n * 0.11))
    k = TS * 2.6 * 1.25
    box = (-640, -820, 120, -420)
    pm, glow, A, an = TH.render(n, st, round(k, 2), box)
    px, py = an['palm']
    sx, sy = 760 - 40 * ease(ramp(n, 408, 464)), 520 + 3 * math.sin(n * 0.7)
    ppu = round(k, 2)
    M = np.array([[1, 0, sx - (px - box[0]) * ppu], [0, 1, sy - (py - box[1]) * ppu]], np.float64)
    TH.place(img, pm, glow, M)
    return img


if __name__ == '__main__':
    od = L.S + '/v4/look'
    os.makedirs(od, exist_ok=True)
    for n in [int(v) for v in sys.argv[1].split(',')]:
        cv2.imwrite(f'{od}/st_{n:04d}.jpg', L.u8(render_frame(n)), [cv2.IMWRITE_JPEG_QUALITY, 90])
        print('ok', n, flush=True)
