"""v4 room + starfield in 16:9, laid out like the original film: the Buddha seated at the left with a small clay lamp
before him (his big shadow on the wall), brass scales in an arched niche, the arched moon window (palms and the
river outside), the thief at the right in front of a dark arched doorway. Set space = the 1920x1080 frame at zoom 1."""
import os, sys, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
for _d in ("v3", "v2"):  # shared helpers
    sys.path.insert(1, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), _d))
import v2lib as L
import v2_room as R2

S = L.S
W, H = 1920, 1080
R = 1.5
SW, SH = int(W * R), int(H * R)
WALL_TOP, FLOOR_Y = 168, 800
WX0, WX1, WSPRING, WY1 = 1060, 1250, 400, 640        # arched moon window
WR = (WX1 - WX0) / 2.0
MOON = (1155.0, 420.0, 50.0)
NICHE = (810.0, 410.0, 110.0, 640.0)                 # centre x, arch spring y, radius, bottom y
HOOK = (810.0, 318.0)
DOORWAY = (1800.0, 2010.0, 520.0, 800.0)             # x0, x1, spring, bottom (partly off-frame)
DIYA = (700.0, 868.0)
DIYA_LIGHT = (731.0, 840.0)
place = R2.place
_noise = R2._noise


def cam_matrix(cam):
    z, cx, cy = cam
    return np.array([[z, 0, W / 2 - z * cx], [0, z, H / 2 - z * cy]], np.float64)


def compose(A, B):
    return (np.vstack([A, [0, 0, 1]]) @ np.vstack([B, [0, 0, 1]]))[:2]


def _P(pts):
    return (np.array(pts, np.float64) * R * 16).astype(np.int32)


def _poly(img, pts, col):
    cv2.fillPoly(img, [_P(pts)], col, cv2.LINE_AA, 4)


def _line(img, p0, p1, col, w):
    cv2.line(img, tuple(int(v * R * 16) for v in p0), tuple(int(v * R * 16) for v in p1), col, max(1, int(round(w * R))), cv2.LINE_AA, 4)


def _ell(img, c, ax, a0, a1, col, th=-1):
    cv2.ellipse(img, (int(c[0] * R * 16), int(c[1] * R * 16)), (int(ax[0] * R * 16), int(ax[1] * R * 16)), 0, a0, a1, col,
                th if th < 0 else max(1, int(round(th * R))), cv2.LINE_AA, 4)


def arch(x0, x1, ys, y1, grow=0.0, n=48):
    cx, r = (x0 + x1) / 2, (x1 - x0) / 2 + grow
    pts = [(x0 - grow, y1 + grow)]
    for k in range(n + 1):
        t = math.pi - math.pi * k / n
        pts.append((cx + r * math.cos(t), ys - r * math.sin(t)))
    pts.append((x1 + grow, y1 + grow))
    return pts


def _mask(pts):
    m = np.zeros((SH, SW), np.float32)
    _poly(m, pts, 1.0)
    return m


def _draw_scales(img, alpha):
    hx, hy = HOOK
    brass, brass_hi, dark = (0.22, 0.62, 0.95), (0.60, 0.95, 1.0), (0.03, 0.06, 0.10)
    C = (lambda c: 1.0) if alpha else (lambda c: c)
    _line(img, (hx, hy), (hx, hy + 48), C(dark), 3)
    _poly(img, [(hx - 78, hy + 50), (hx + 78, hy + 50), (hx + 78, hy + 57), (hx - 78, hy + 57)], C(brass))
    _line(img, (hx - 78, hy + 50), (hx + 78, hy + 50), C(brass_hi), 2)
    _ell(img, (hx, hy + 53), (8, 8), 0, 360, C(brass))
    for sx in (hx - 72, hx + 72):
        for dxp in (-30, 0, 30):
            _line(img, (sx, hy + 57), (sx + dxp, hy + 200), C((0.10, 0.22, 0.35)), 2)
        _ell(img, (sx, hy + 200), (36, 12), 0, 180, C(brass))
        _ell(img, (sx, hy + 200), (36, 5), 0, 360, C(brass_hi))
        _ell(img, (sx, hy + 200), (36, 12), 0, 180, C(dark), 2)


PANS = ((HOOK[0] - 72, HOOK[1] + 200), (HOOK[0] + 72, HOOK[1] + 200))
_SET = None


def build_sets():
    global _SET
    if _SET is not None:
        return _SET
    yy, xx = np.mgrid[0:SH, 0:SW].astype(np.float32)
    X, Y = xx / R, yy / R
    lx, ly = DIYA_LIGHT
    dist = np.sqrt((X - lx) ** 2 + ((Y - ly) * 1.1) ** 2)
    lamp = np.exp(-dist / 700.0) * 1.0 + np.exp(-dist / 200.0) * 0.55
    warm = np.array([0.30, 0.62, 1.0], np.float32)
    amb = np.array([0.13, 0.10, 0.09], np.float32)
    mx, my, mr = MOON
    moonlight = np.exp(-np.sqrt((X - mx) ** 2 + (Y - my) ** 2) / 480.0)
    light = amb[None, None] + lamp[..., None] * warm[None, None] * 0.95 + moonlight[..., None] * np.array([0.10, 0.06, 0.05], np.float32)
    room = np.zeros((SH, SW, 3), np.float32)
    wall_alb = np.array([0.70, 0.84, 0.92], np.float32)
    tex = 1 + 0.018 * _noise(SH, SW, int(120 * R), 1) + 0.010 * _noise(SH, SW, int(14 * R), 2)
    room[:] = wall_alb * tex[..., None]
    top = int(WALL_TOP * R)
    room[:top] = np.array([0.08, 0.13, 0.26], np.float32) * (1 + 0.06 * _noise(top, SW, int(14 * R), 3))[..., None]
    for k in range(-1, 21):                                                      # rafter ends above the wall plate
        xb = 40 + k * 100
        _poly(room, [(xb - 14, WALL_TOP - 40), (xb + 14, WALL_TOP - 40), (xb + 10, -10), (xb - 10, -10)], (0.035, 0.07, 0.12))
    _poly(room, [(-20, WALL_TOP - 40), (1940, WALL_TOP - 40), (1940, WALL_TOP + 4), (-20, WALL_TOP + 4)], (0.04, 0.085, 0.15))
    _line(room, (-20, WALL_TOP + 4), (1940, WALL_TOP + 4), (0.10, 0.20, 0.32), 3)
    fy = int(FLOOR_Y * R)
    t = np.linspace(0, 1, SH - fy, dtype=np.float32)[:, None, None]
    room[fy:] = np.array([0.10, 0.11, 0.40], np.float32) * (0.80 + 0.30 * t) * (1 + 0.012 * _noise(SH - fy, SW, int(60 * R), 4))[..., None]
    _poly(room, [(-20, FLOOR_Y - 14), (1940, FLOOR_Y - 14), (1940, FLOOR_Y + 2), (-20, FLOOR_Y + 2)], (0.05, 0.06, 0.12))
    # ---- arched niche for the brass scales
    ncx, nys, nr, nyb = NICHE
    niche = arch(ncx - nr, ncx + nr, nys, nyb)
    nm = _mask(niche)
    shade = cv2.GaussianBlur(nm, (0, 0), 14 * R)
    room = room * (1 - nm[..., None] * (0.42 - 0.22 * shade[..., None]))
    _poly(room, [(ncx - nr - 10, nyb), (ncx + nr + 10, nyb), (ncx + nr + 14, nyb + 12), (ncx - nr - 14, nyb + 12)], (0.35, 0.50, 0.60))
    sc = np.zeros((SH, SW, 3), np.float32)
    sa = np.zeros((SH, SW), np.float32)
    for img_, al_ in ((sc, False), (sa, True)):
        _draw_scales(img_, al_)
    # ---- dark arched doorway at the right (where the thief comes in)
    dx0, dx1, dsp, dyb = DOORWAY
    door = arch(dx0, dx1, dsp, dyb)
    dm = _mask(door)
    room = room * light
    sc = sc * light
    night = L.night_sky(SH, SW, int(dyb * R), top=(0.10, 0.03, 0.03), mid=(0.16, 0.06, 0.05), hor=(0.22, 0.10, 0.09))
    night += L.Stars(SW, SH, 300, seed=8).render(SH, SW, 0, gain=0.5)
    room = room * (1 - dm[..., None]) + night * dm[..., None]
    # ---- arched window: sky, moon, palms and the river
    win = arch(WX0, WX1, WSPRING, WY1)
    wm = _mask(win)
    top_y = WSPRING - WR
    sh_, sw_ = int((WY1 - top_y) * R), int((WX1 - WX0) * R)
    sky = L.night_sky(sh_, sw_, int(sh_ * 1.2), top=(0.14, 0.05, 0.04), mid=(0.26, 0.10, 0.08), hor=(0.36, 0.20, 0.18))
    sky += L.Stars(sw_, sh_, 60, seed=5).render(sh_, sw_, 0, gain=0.8)
    L.moon(sky, (mx - WX0) * R, (my - top_y) * R, mr * R, glow=0.9)
    wy = int(sh_ * 0.80)
    sky[wy:] = np.array([0.20, 0.08, 0.06], np.float32)
    for k_ in range(6):
        yk = wy + 4 + k_ * (sh_ - wy) // 6
        for xk in range(-20, sw_, 30 + 6 * k_):
            cv2.ellipse(sky, (xk + (k_ % 2) * 14, yk + 5 + k_), (12 + 3 * k_, 4 + k_), 0, 180, 360, (0.40, 0.25, 0.18), 1, cv2.LINE_AA)
    cv2.line(sky, (int((mx - WX0) * R), wy), (int((mx - WX0) * R), sh_), (0.55, 0.50, 0.45), 5)
    silh = (0.045, 0.022, 0.018)
    for (bx_, h_, lean_, sd_) in ((0.04, 0.46, 0.10, 1), (0.18, 0.32, -0.06, 2), (0.86, 0.48, -0.12, 3), (0.99, 0.34, 0.05, 4)):
        L.palm_tree(sky, bx_ * sw_, wy + 4, h_ * sh_, lean_, silh, seed=sd_)
    cv2.rectangle(sky, (0, wy + 2), (sw_, wy + 6), silh, -1)
    oy, ox = int(top_y * R), int(WX0 * R)
    region = (slice(oy, oy + sh_), slice(ox, ox + sw_))
    wmc = wm[region][..., None]
    room[region] = room[region] * (1 - wmc) + sky * wmc
    # window frame (teak band + gold trim) and sill; gold outline on the niche too, as in the original
    fr = np.zeros((SH, SW, 3), np.float32)
    fa = np.zeros((SH, SW), np.float32)
    outer = arch(WX0, WX1, WSPRING, WY1, grow=24)
    _poly(fr, outer, (0.05, 0.10, 0.18))
    _poly(fa, outer, 1.0)
    fa = fa * (1 - wm)
    fr = fr * light * 1.15
    gold = np.zeros((SH, SW), np.float32)
    cv2.polylines(gold, [_P(arch(WX0, WX1, WSPRING, WY1, grow=3))], False, 1.0, max(1, int(3 * R)), cv2.LINE_AA, 4)
    cv2.polylines(gold, [_P(arch(WX0, WX1, WSPRING, WY1, grow=21))], False, 0.8, max(1, int(2 * R)), cv2.LINE_AA, 4)
    ngold = np.zeros((SH, SW), np.float32)
    cv2.polylines(ngold, [_P(arch(ncx - nr, ncx + nr, nys, nyb, grow=3))], False, 0.9, max(1, int(2.5 * R)), cv2.LINE_AA, 4)
    room = room * (1 - fa[..., None]) + fr * fa[..., None]
    gcol = np.array([0.30, 0.70, 0.95], np.float32)
    room += (gold + ngold)[..., None] * gcol + L.blur(gold + ngold, 4 * R)[..., None] * np.array([0.10, 0.30, 0.50], np.float32)
    _poly(room, [(WX0 - 44, WY1 + 2), (WX1 + 44, WY1 + 2), (WX1 + 50, WY1 + 20), (WX0 - 50, WY1 + 20)], (0.09, 0.20, 0.34))
    _line(room, (WX0 - 44, WY1 + 3), (WX1 + 44, WY1 + 3), (0.40, 0.42, 0.45), 2)
    mp = np.zeros((SH, SW), np.float32)
    _poly(mp, [(WX0 + 20, FLOOR_Y + 30), (WX1 + 10, FLOOR_Y + 30), (WX1 + 110, FLOOR_Y + 260), (WX0 + 90, FLOOR_Y + 260)], 1.0)
    mp = L.blur(mp, 10 * R) * np.clip(1 - (Y - FLOOR_Y - 30) / 300.0, 0, 1)
    room += mp[..., None] * np.array([0.16, 0.10, 0.07], np.float32)
    room *= L.paper(SH, SW)
    # ---- starfield: the golden arch of the window floats in the night with the moon; a dark ground below
    sf = L.night_sky(SH, SW, int(FLOOR_Y * R), top=(0.10, 0.025, 0.02), mid=(0.24, 0.07, 0.055), hor=(0.36, 0.15, 0.13))
    sf *= L.paper(SH, SW, seed=9)
    sf += L.Stars(SW, SH, 2400, seed=21).render(SH, SW, 0, gain=0.9)
    band = np.exp(-(((Y - (-0.45 * X + 1100)) / 200.0) ** 2)) * (1 + 0.5 * _noise(SH, SW, int(80 * R), 7))
    sf += np.clip(band, 0, 2)[..., None] * np.array([0.06, 0.04, 0.035], np.float32)
    L.moon(sf, mx * R, my * R, mr * R, glow=1.0)
    ground = np.clip((Y - FLOOR_Y) / 40.0, 0, 1)[..., None]
    sf = sf * (1 - 0.65 * ground)
    hl = np.zeros((SH, SW), np.float32)
    _line(hl, (-20, FLOOR_Y), (1940, FLOOR_Y), 1.0, 1.5)
    sf += L.blur(hl, 2)[..., None] * np.array([0.30, 0.22, 0.20], np.float32)
    sf += gold[..., None] * gcol + L.blur(gold, 5 * R)[..., None] * np.array([0.12, 0.35, 0.60], np.float32)
    y0, y1, x0, x1 = int((HOOK[1] - 20) * R), int((HOOK[1] + 330) * R), int((HOOK[0] - 130) * R), int((HOOK[0] + 130) * R)
    scales = np.dstack([sc[y0:y1, x0:x1] * L.paper(SH, SW)[y0:y1, x0:x1], np.clip(sa[y0:y1, x0:x1], 0, 1)])
    _SET = dict(room=room.astype(np.float32), lamp=lamp.astype(np.float32), star=sf.astype(np.float32),
                scales=scales.astype(np.float32), scales_xy=(x0 / R, y0 / R))
    return _SET


def view(layer, cam):
    M = compose(cam_matrix(cam), np.array([[1 / R, 0, 0], [0, 1 / R, 0]]))
    return cv2.warpAffine(layer, M.astype(np.float32), (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def place_scales(img, cam, k):
    if k <= 0.003:
        return
    st = build_sets()
    x0, y0 = st['scales_xy']
    M = compose(cam_matrix(cam), np.array([[1 / R, 0, x0], [0, 1 / R, y0]]))
    place(img, st['scales'] * k, M)


def shadow_on_wall(cam, alpha_spr, M_spr, k=1.7, extra=None, blur=6.0):
    """the sprite's silhouette projected from the little lamp onto the wall (output-space mask, 0..1)"""
    lx, ly = DIYA_LIGHT
    Pm = np.array([[k, 0, lx - k * lx], [0, k, ly - k * ly]], np.float64)
    Ms = compose(Pm, M_spr)
    if extra is not None:
        Ms = compose(extra, Ms)
    M = compose(cam_matrix(cam), Ms)
    sh = cv2.warpAffine(alpha_spr, M.astype(np.float32), (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
    sh = L.blur(sh, blur * cam[0])
    Mc = cam_matrix(cam)
    wall = np.zeros((H, W), np.float32)
    p0, p1 = Mc @ np.array([-400, WALL_TOP, 1.0]), Mc @ np.array([2400, FLOOR_Y, 1.0])
    cv2.rectangle(wall, (int(p0[0]), int(p0[1])), (int(p1[0]), int(p1[1])), 1.0, -1)
    for pts in (arch(WX0, WX1, WSPRING, WY1), arch(*DOORWAY[:2], DOORWAY[2], DOORWAY[3])):
        q = np.array([Mc @ np.array([x, y, 1.0]) for x, y in pts], np.float64)
        cv2.fillPoly(wall, [q[:, :2].astype(np.int32)], 0.0)
    return sh * wall


def contact_shadow(img, cam, x, y, w, k=1.0):
    M = cam_matrix(cam)
    p = M @ np.array([x, y, 1.0])
    z = cam[0]
    m = np.zeros((H, W), np.float32)
    cv2.ellipse(m, (int(p[0]), int(p[1])), (max(1, int(w * z)), max(1, int(w * 0.16 * z))), 0, 0, 360, 1.0, -1, cv2.LINE_AA)
    m = L.blur(m, 10 * z)
    img *= (1 - 0.55 * k * m)[..., None]


def draw_diya(img, cam, n, flame_k=1.0):
    """small clay lamp on the floor with a living flame"""
    M = cam_matrix(cam)
    z = cam[0]
    cx, cy = M @ np.array([DIYA[0], DIYA[1], 1.0])
    s = 2.0 * z
    if not (-200 < cx < W + 200 and -200 < cy < H + 200):
        return img
    cv2.ellipse(img, (int(cx), int(cy + 6 * s)), (int(26 * s), int(6 * s)), 0, 0, 360, (0.02, 0.03, 0.06), -1, cv2.LINE_AA)
    cv2.ellipse(img, (int(cx), int(cy)), (int(17 * s), int(9 * s)), 0, 0, 180, (0.05, 0.12, 0.28), -1, cv2.LINE_AA)
    cv2.ellipse(img, (int(cx), int(cy)), (int(17 * s), int(4 * s)), 0, 0, 360, (0.12, 0.34, 0.66), -1, cv2.LINE_AA)
    cv2.ellipse(img, (int(cx), int(cy)), (int(17 * s), int(4 * s)), 0, 0, 360, (0.03, 0.06, 0.14), 1, cv2.LINE_AA)
    cv2.ellipse(img, (int(cx + 13 * s), int(cy - 1 * s)), (int(5 * s), int(3 * s)), 0, 0, 360, (0.10, 0.30, 0.60), -1, cv2.LINE_AA)
    if flame_k > 0.01:
        L.flame(img, cx + 14 * s, cy - 2 * s, 17 * s * flame_k, n, seed=2, gain=min(1.3, flame_k * 1.4), width=0.45)
        m = np.zeros((H, W), np.float32)
        cv2.circle(m, (int(cx + 14 * s), int(cy - 10 * s)), max(2, int(5 * s)), 1.0, -1)
        L.add_glow(img, m, (0.05, 0.28, 0.70), 90 * z, 0.55 * flame_k)
    return img


if __name__ == '__main__':
    st = build_sets()
    for nm in ('room', 'star'):
        cv2.imwrite(f'{S}/v4/set_{nm}.jpg', L.u8(cv2.resize(st[nm], (960, 540), interpolation=cv2.INTER_AREA)))
    print('ok')
