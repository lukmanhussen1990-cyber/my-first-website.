"""v3 room + starfield, closer to the original: arched moon window (showing the backwater), brass scales in an arched
wall niche, a small clay lamp on the floor in front of the narrator throwing his big shadow up the wall."""
import os, sys, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(1, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "v2"))  # v2 helpers
import v2lib as L
import v2_room as R2
import v3_beats as B

S = L.S
W, H = 1080, 1920
R = 1.5
SW, SH = int(W * R), int(H * R)
WALL_TOP, FLOOR_Y = 330, 1420
WX0, WX1, WSPRING, WY1 = 330, 750, 900, 1200        # arched window opening
WR = (WX1 - WX0) / 2.0
MOON = (540.0, 905.0, 76.0)
NICHE = (205.0, 520.0, 95.0, 760.0)                  # centre x, arch spring y, radius, bottom y
HOOK = (205.0, 452.0)
DIYA = (330.0, 1748.0)
DIYA_LIGHT = (361.0, 1718.0)
NARR = dict(x=215.0, y=1730.0, h=800.0)
THIEF = dict(x=885.0, y=1700.0, h=690.0)
cam_matrix, compose = R2.cam_matrix, R2.compose
spr, place = R2.spr, R2.place


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


_SET = None


def build_sets():
    global _SET
    if _SET is not None:
        return _SET
    yy, xx = np.mgrid[0:SH, 0:SW].astype(np.float32)
    X, Y = xx / R, yy / R
    lx, ly = DIYA_LIGHT
    dist = np.sqrt((X - lx) ** 2 + ((Y - ly) * 0.9) ** 2)
    lamp = np.exp(-dist / 760.0) * 1.0 + np.exp(-dist / 210.0) * 0.55
    warm = np.array([0.30, 0.62, 1.0], np.float32)
    amb = np.array([0.15, 0.11, 0.10], np.float32)
    mx, my, mr = MOON
    moonlight = np.exp(-np.sqrt((X - mx) ** 2 + (Y - my) ** 2) / 520.0)
    light = amb[None, None] + lamp[..., None] * warm[None, None] * 0.95 + moonlight[..., None] * np.array([0.10, 0.06, 0.05], np.float32)
    room = np.zeros((SH, SW, 3), np.float32)
    wall_alb = np.array([0.70, 0.84, 0.92], np.float32)
    tex = 1 + 0.018 * R2._noise(SH, SW, int(120 * R), 1) + 0.010 * R2._noise(SH, SW, int(14 * R), 2)
    room[:] = wall_alb * tex[..., None]
    top = int(WALL_TOP * R)
    room[:top] = np.array([0.10, 0.16, 0.34], np.float32) * (1 + 0.06 * R2._noise(top, SW, int(14 * R), 3))[..., None]
    for k in range(-1, 11):
        xb = 30 + k * 105
        xt = 540 + (xb - 540) * 0.55
        _poly(room, [(xb - 16, WALL_TOP - 30), (xb + 16, WALL_TOP - 30), (xt + 9, -10), (xt - 9, -10)], (0.035, 0.07, 0.12))
    for yv in (60, 140, 215):
        _poly(room, [(-20, yv), (1100, yv), (1100, yv + 11), (-20, yv + 11)], (0.045, 0.085, 0.15))
    _poly(room, [(-20, WALL_TOP - 34), (1100, WALL_TOP - 34), (1100, WALL_TOP + 6), (-20, WALL_TOP + 6)], (0.04, 0.085, 0.15))
    _line(room, (-20, WALL_TOP + 6), (1100, WALL_TOP + 6), (0.10, 0.20, 0.32), 3)
    fy = int(FLOOR_Y * R)
    t = np.linspace(0, 1, SH - fy, dtype=np.float32)[:, None, None]
    room[fy:] = np.array([0.10, 0.11, 0.40], np.float32) * (0.80 + 0.30 * t) * (1 + 0.012 * R2._noise(SH - fy, SW, int(60 * R), 4))[..., None]
    _poly(room, [(-20, FLOOR_Y - 16), (1100, FLOOR_Y - 16), (1100, FLOOR_Y + 2), (-20, FLOOR_Y + 2)], (0.05, 0.06, 0.12))
    # ---- arched niche with the brass scales
    ncx, nys, nr, nyb = NICHE
    niche = arch(ncx - nr, ncx + nr, nys, nyb)
    nm = _mask(niche)
    shade = cv2.GaussianBlur(nm, (0, 0), 14 * R)
    room = room * (1 - nm[..., None] * (0.45 - 0.25 * shade[..., None]))
    cv2.polylines(room, [_P(niche)], True, (0.30, 0.50, 0.62), max(1, int(3 * R)), cv2.LINE_AA, 4)
    _poly(room, [(ncx - nr - 10, nyb), (ncx + nr + 10, nyb), (ncx + nr + 14, nyb + 12), (ncx - nr - 14, nyb + 12)], (0.35, 0.50, 0.60))
    sc = np.zeros((SH, SW, 3), np.float32)
    sa = np.zeros((SH, SW), np.float32)
    for img_, al_ in ((sc, False), (sa, True)):
        _draw_scales(img_, al_)
    room = room * light
    sc = sc * light
    # ---- arched window: sky, moon, palms and the backwater (the river is still there)
    win = arch(WX0, WX1, WSPRING, WY1)
    wm = _mask(win)
    sh_, sw_ = int((WY1 - (WSPRING - WR)) * R), int((WX1 - WX0) * R)
    sky = L.night_sky(sh_, sw_, int(sh_ * 1.2), top=(0.14, 0.05, 0.04), mid=(0.26, 0.10, 0.08), hor=(0.36, 0.20, 0.18))
    sky += L.Stars(sw_, sh_, 80, seed=5).render(sh_, sw_, 0, gain=0.8)
    L.moon(sky, (mx - WX0) * R, (my - (WSPRING - WR)) * R, mr * R, glow=0.9)
    wy = int(sh_ * 0.80)
    sky[wy:] = np.array([0.20, 0.08, 0.06], np.float32)
    for k_ in range(7):
        yk = wy + 6 + k_ * (sh_ - wy) // 7
        for xk in range(-20, sw_, 34 + 6 * k_):
            cv2.ellipse(sky, (xk + (k_ % 2) * 15, yk + 6 + k_), (14 + 3 * k_, 5 + k_), 0, 180, 360, (0.40, 0.25, 0.18), 1, cv2.LINE_AA)
    cv2.line(sky, (int((mx - WX0) * R), wy), (int((mx - WX0) * R), sh_), (0.55, 0.50, 0.45), 6)
    silh = (0.045, 0.022, 0.018)
    for (bx_, h_, lean_, sd_) in ((0.04, 0.50, 0.10, 1), (0.16, 0.36, -0.06, 2), (0.88, 0.52, -0.12, 3), (0.99, 0.38, 0.05, 4)):
        L.palm_tree(sky, bx_ * sw_, wy + 4, h_ * sh_, lean_, silh, seed=sd_)
    cv2.rectangle(sky, (0, wy + 2), (sw_, wy + 7), silh, -1)
    oy, ox = int((WSPRING - WR) * R), int(WX0 * R)
    region = (slice(oy, oy + sh_), slice(ox, ox + sw_))
    wmc = wm[region][..., None]
    room[region] = room[region] * (1 - wmc) + sky * wmc
    # window frame (teak band + gold trim) and sill
    fr = np.zeros((SH, SW, 3), np.float32)
    fa = np.zeros((SH, SW), np.float32)
    outer = arch(WX0, WX1, WSPRING, WY1, grow=30)
    _poly(fr, outer, (0.05, 0.10, 0.18))
    _poly(fa, outer, 1.0)
    fa = fa * (1 - wm)
    fr = fr * light * 1.15
    gold = np.zeros((SH, SW), np.float32)
    cv2.polylines(gold, [_P(arch(WX0, WX1, WSPRING, WY1, grow=4))], False, 1.0, max(1, int(3 * R)), cv2.LINE_AA, 4)
    cv2.polylines(gold, [_P(arch(WX0, WX1, WSPRING, WY1, grow=26))], False, 0.8, max(1, int(2 * R)), cv2.LINE_AA, 4)
    room = room * (1 - fa[..., None]) + fr * fa[..., None]
    room += gold[..., None] * np.array([0.30, 0.70, 0.95], np.float32) + L.blur(gold, 4 * R)[..., None] * np.array([0.10, 0.30, 0.50], np.float32)
    _poly(room, [(WX0 - 50, WY1 + 2), (WX1 + 50, WY1 + 2), (WX1 + 58, WY1 + 24), (WX0 - 58, WY1 + 24)], (0.09, 0.20, 0.34))
    _line(room, (WX0 - 50, WY1 + 3), (WX1 + 50, WY1 + 3), (0.40, 0.42, 0.45), 2)
    # moonlight patch on the floor
    mp = np.zeros((SH, SW), np.float32)
    _poly(mp, [(WX0 + 40, FLOOR_Y + 40), (WX1 + 20, FLOOR_Y + 40), (WX1 + 130, FLOOR_Y + 300), (WX0 + 120, FLOOR_Y + 300)], 1.0)
    mp = L.blur(mp, 10 * R) * np.clip(1 - (Y - FLOOR_Y - 40) / 420.0, 0, 1)
    room += mp[..., None] * np.array([0.16, 0.10, 0.07], np.float32)
    room *= L.paper(SH, SW)
    # ---- starfield: the golden arch of the window floats in the night with the moon
    sf = L.night_sky(SH, SW, int(1500 * R), top=(0.10, 0.025, 0.02), mid=(0.24, 0.07, 0.055), hor=(0.36, 0.15, 0.13))
    sf *= L.paper(SH, SW, seed=9)
    sf += L.Stars(SW, SH, 2600, seed=21).render(SH, SW, 0, gain=0.9)
    band = np.exp(-(((Y - (1.25 * X + 150)) / 260.0) ** 2)) * (1 + 0.5 * R2._noise(SH, SW, int(80 * R), 7))
    sf += np.clip(band, 0, 2)[..., None] * np.array([0.06, 0.04, 0.035], np.float32)
    L.moon(sf, mx * R, my * R, mr * R, glow=1.0)
    floor_m = np.clip((Y - (FLOOR_Y + 40)) / 260.0, 0, 1)[..., None]
    sf = sf * (1 - 0.45 * floor_m)
    sf += gold[..., None] * np.array([0.30, 0.70, 0.95], np.float32) + L.blur(gold, 5 * R)[..., None] * np.array([0.12, 0.35, 0.60], np.float32)
    y0, y1, x0, x1 = int(400 * R), int(680 * R), int(90 * R), int(320 * R)
    scales = np.dstack([sc[y0:y1, x0:x1] * L.paper(SH, SW)[y0:y1, x0:x1, None] if L.paper(SH, SW).ndim == 2
                        else sc[y0:y1, x0:x1] * L.paper(SH, SW)[y0:y1, x0:x1], np.clip(sa[y0:y1, x0:x1], 0, 1)])
    _SET = dict(room=room.astype(np.float32), lamp=lamp.astype(np.float32), star=sf.astype(np.float32),
                scales=scales.astype(np.float32), scales_xy=(x0 / R, y0 / R))
    return _SET


def _draw_scales(img, alpha):
    hx, hy = HOOK
    brass, brass_hi, dark = (0.22, 0.62, 0.95), (0.60, 0.95, 1.0), (0.03, 0.06, 0.10)
    C = (lambda c: 1.0) if alpha else (lambda c: c)
    _line(img, (hx, hy), (hx, hy + 58), C(dark), 3)
    _poly(img, [(hx - 82, hy + 60), (hx + 82, hy + 60), (hx + 82, hy + 67), (hx - 82, hy + 67)], C(brass))
    _line(img, (hx - 82, hy + 60), (hx + 82, hy + 60), C(brass_hi), 2)
    _ell(img, (hx, hy + 63), (8, 8), 0, 360, C(brass))
    for sx in (hx - 76, hx + 76):
        for dxp in (-34, 0, 34):
            _line(img, (sx, hy + 67), (sx + dxp, hy + 190), C((0.10, 0.22, 0.35)), 2)
        _ell(img, (sx, hy + 190), (40, 13), 0, 180, C(brass))
        _ell(img, (sx, hy + 190), (40, 5), 0, 360, C(brass_hi))
        _ell(img, (sx, hy + 190), (40, 13), 0, 180, C(dark), 2)


def place_scales(img, cam, k):
    """composite the (removable) brass scales through the camera with opacity k"""
    if k <= 0.003:
        return
    st = build_sets()
    x0, y0 = st['scales_xy']
    pm = st['scales'] * k
    M = compose(cam_matrix(cam), np.array([[1 / R, 0, x0], [0, 1 / R, y0]]))
    place(img, pm, M)


def view(layer, cam):
    M = compose(cam_matrix(cam), np.array([[1 / R, 0, 0], [0, 1 / R, 0]]))
    return cv2.warpAffine(layer, M.astype(np.float32), (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


# ---------------------------------------------------------------- characters
NARR_FULL = [1, 3, 4, 6, 7, 9]           # frames with the feet visible


def narrator_index(n, bow):
    if bow > 0.05:
        return 9 if bow > 0.6 else 7
    v = B.voice(n)
    if v < 0.12:
        return 6
    if v < 0.45:
        return 1 if (n // 4) % 2 else 7
    return 4 if (n // 3) % 2 else 3


def narrator_bow(n):
    """bow forward (offering) on each 'ले जा'"""
    b = 0.0
    for nm, a, k, l in B.LINES:
        if l - 3 <= n <= l + 14:
            b = max(b, min(B.ramp(n, l - 3, l + 2), 1 - B.ramp(n, l + 7, l + 14)))
    return b


def thief_reach_index(n):
    """arms down -> raise on 'दे दे मुझे' -> held out, beckoning on each 'ले जा' -> lowered at the end"""
    if n < 374:
        return int((n // 4) % 3)
    if n < 384:
        return int(round(B.ease((n - 374) / 10.0) * 27))
    if n >= 1404:
        return int(round(27 * (1 - B.ease((n - 1403) / 8.0))))
    idx = 27
    for nm, a, k, l in B.LINES:
        if l <= n <= l + 14:
            u = (n - l) / 14.0
            idx = int(round(27 - 9 * math.sin(math.pi * u)))
    if idx == 27:
        idx = 24 + int((n // 5) % 4)
    return idx


def breathe(n, period=75.0, amp=0.006, phase=0.0):
    return 1 + amp * math.sin(2 * math.pi * n / period + phase)


def feet_M(name, x, y, h, sy=1.0, rot=0.0):
    arr, g = spr(name)
    s = h / g['h']
    M = cv2.getRotationMatrix2D((float(g['cx']), float(g['bot'])), float(rot), 1.0)
    M = np.vstack([M, [0, 0, 1]])
    Sm = np.array([[s, 0, x - s * g['cx']], [0, s * sy, y - s * sy * g['bot']], [0, 0, 1]])
    return (Sm @ M)[:2]


def shadow_on_wall(img, cam, alpha_spr, M_spr, k=1.7, strength=0.5, extra=None):
    lx, ly = DIYA_LIGHT
    Pm = np.array([[k, 0, lx - k * lx], [0, k, ly - k * ly]], np.float64)
    Ms = compose(Pm, M_spr)
    if extra is not None:
        Ms = compose(extra, Ms)
    M = compose(cam_matrix(cam), Ms)
    sh = cv2.warpAffine(alpha_spr, M.astype(np.float32), (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
    sh = L.blur(sh, 6 * cam[0])
    Mc = cam_matrix(cam)
    wall = np.zeros((H, W), np.float32)
    p0, p1 = Mc @ np.array([-200, WALL_TOP, 1.0]), Mc @ np.array([1300, FLOOR_Y, 1.0])
    cv2.rectangle(wall, (int(p0[0]), int(p0[1])), (int(p1[0]), int(p1[1])), 1.0, -1)
    win = np.array([Mc @ np.array([x, y, 1.0]) for x, y in arch(WX0, WX1, WSPRING, WY1)], np.float64)
    cv2.fillPoly(wall, [win[:, :2].astype(np.int32)], 0.0)
    img *= (1 - strength * (sh * wall))[..., None]
    return sh * wall


def contact_shadow(img, cam, x, y, w, k=1.0):
    R2.contact_shadow(img, cam, x, y, w, k)


def draw_diya(img, cam, n, flame_k=1.0, grow=1.0):
    """small clay lamp on the floor with a living flame"""
    M = cam_matrix(cam)
    z = cam[0]
    cx, cy = M @ np.array([DIYA[0], DIYA[1], 1.0])
    s = 2.2 * z
    if not (-200 < cx < W + 200 and -200 < cy < H + 200):
        return img
    cv2.ellipse(img, (int(cx), int(cy + 6 * s)), (int(26 * s), int(6 * s)), 0, 0, 360, (0.02, 0.03, 0.06), -1, cv2.LINE_AA)
    cv2.ellipse(img, (int(cx), int(cy)), (int(17 * s), int(9 * s)), 0, 0, 180, (0.05, 0.12, 0.28), -1, cv2.LINE_AA)
    cv2.ellipse(img, (int(cx), int(cy)), (int(17 * s), int(4 * s)), 0, 0, 360, (0.12, 0.34, 0.66), -1, cv2.LINE_AA)
    cv2.ellipse(img, (int(cx), int(cy)), (int(17 * s), int(4 * s)), 0, 0, 360, (0.03, 0.06, 0.14), 1, cv2.LINE_AA)
    cv2.ellipse(img, (int(cx + 13 * s), int(cy - 1 * s)), (int(5 * s), int(3 * s)), 0, 0, 360, (0.10, 0.30, 0.60), -1, cv2.LINE_AA)
    if flame_k > 0.01:
        L.flame(img, cx + 14 * s, cy - 2 * s, 17 * s * flame_k * grow, n, seed=2, gain=min(1.3, flame_k * 1.4 * grow), width=0.45)
        m = np.zeros((H, W), np.float32)
        cv2.circle(m, (int(cx + 14 * s), int(cy - 10 * s)), max(2, int(5 * s)), 1.0, -1)
        L.add_glow(img, m, (0.05, 0.28, 0.70), 90 * z, 0.55 * flame_k * grow)
    return img
