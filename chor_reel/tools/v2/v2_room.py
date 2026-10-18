"""The room (shots 4-9) and the starfield it dissolves into (shots 10-16), Kerala-painting style.
Set space = the 1080x1920 wide master frame; static layers are built at R x set resolution so the
camera can push in. A camera is (z, cx, cy): set point (cx, cy) maps to the output centre, zoom z."""
import os, sys, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import v2lib as L

S = L.S
W, H = 1080, 1920
R = 1.5
SW, SH = int(W * R), int(H * R)

# ---- layout (set coordinates)
WALL_TOP, FLOOR_Y = 330, 1420
WIN = (330, 760, 750, 1200)            # window opening x0, y0, x1, y1
MOON = (540.0, 930.0, 78.0)
SCALE_HOOK = (225, 440)
LAMP = (540.0, 1840.0)                 # foreground nilavilakku dish centre
LAMP_LIGHT = (540.0, 1770.0)           # light position used for shading and shadows
NARR = dict(x=215.0, y=1730.0, h=800.0)
THIEF = dict(x=885.0, y=1700.0, h=690.0)


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


def _ell(img, c, ax, ang, a0, a1, col, th=-1):
    cv2.ellipse(img, (int(c[0] * R * 16), int(c[1] * R * 16)), (int(ax[0] * R * 16), int(ax[1] * R * 16)), ang, a0, a1, col,
                th if th < 0 else max(1, int(round(th * R))), cv2.LINE_AA, 4)


def _noise(h, w, cell, seed):
    rng = np.random.default_rng(seed)
    n = rng.standard_normal((h // cell + 2, w // cell + 2)).astype(np.float32)
    return cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC)


def palm_silhouettes(width_px, seed=0):
    """Coconut-palm silhouettes cut from the Kerala video (p_72.0), as an alpha mask of the given width."""
    p = cv2.imread(S + '/v2/plates_raw/p_72.0.png')
    sky = L.sky_mask(p)[:205]
    m = (1 - sky).astype(np.float32)
    m[:, :] = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    f = width_px / m.shape[1]
    return np.clip(cv2.resize(m, None, fx=f, fy=f, interpolation=cv2.INTER_AREA), 0, 1)


_SET = None


def build_sets():
    """Static layers: room (lit), lamp-light falloff map, starfield, window-frame overlay (+alpha)."""
    global _SET
    if _SET is not None:
        return _SET
    yy, xx = np.mgrid[0:SH, 0:SW].astype(np.float32)
    X, Y = xx / R, yy / R
    lx, ly = LAMP_LIGHT
    dist = np.sqrt((X - lx) ** 2 + ((Y - ly) * 0.85) ** 2)
    lamp = np.exp(-dist / 820.0) * 1.0 + np.exp(-dist / 260.0) * 0.45         # lamp falloff (set space)
    warm = np.array([0.30, 0.62, 1.0], np.float32)
    amb = np.array([0.16, 0.12, 0.11], np.float32)
    light = amb[None, None] + lamp[..., None] * warm[None, None] * 0.95
    room = np.zeros((SH, SW, 3), np.float32)
    # ---- wall (warm plaster)
    wall_alb = np.array([0.70, 0.84, 0.92], np.float32)
    tex = 1 + 0.018 * _noise(SH, SW, int(120 * R), 1) + 0.010 * _noise(SH, SW, int(14 * R), 2)
    room[:] = wall_alb * tex[..., None]
    # ---- ceiling: tile underside between converging rafters, wall-plate beam
    top = int(WALL_TOP * R)
    room[:top] = np.array([0.10, 0.16, 0.34], np.float32) * (1 + 0.06 * _noise(top, SW, int(14 * R), 3))[..., None]
    for k in range(-1, 11):
        xb = 30 + k * 105
        xt = 540 + (xb - 540) * 0.55
        _poly(room, [(xb - 16, WALL_TOP - 30), (xb + 16, WALL_TOP - 30), (xt + 9, -10), (xt - 9, -10)], (0.035, 0.07, 0.12))
        _line(room, (xb - 16, WALL_TOP - 30), (xt - 9, -10), (0.07, 0.13, 0.22), 2)
    for yv in (60, 140, 215):
        t = 1 - yv / (WALL_TOP - 30)
        _poly(room, [(-20, yv), (1100, yv), (1100, yv + 9 + 6 * (1 - t)), (-20, yv + 9 + 6 * (1 - t))], (0.045, 0.085, 0.15))
    _poly(room, [(-20, WALL_TOP - 34), (1100, WALL_TOP - 34), (1100, WALL_TOP + 6), (-20, WALL_TOP + 6)], (0.04, 0.085, 0.15))
    _line(room, (-20, WALL_TOP + 6), (1100, WALL_TOP + 6), (0.10, 0.20, 0.32), 3)
    # ---- floor (red oxide)
    fy = int(FLOOR_Y * R)
    t = np.linspace(0, 1, SH - fy, dtype=np.float32)[:, None, None]
    room[fy:] = np.array([0.10, 0.11, 0.40], np.float32) * (0.80 + 0.30 * t) * (1 + 0.012 * _noise(SH - fy, SW, int(60 * R), 4))[..., None]
    _poly(room, [(-20, FLOOR_Y - 16), (1100, FLOOR_Y - 16), (1100, FLOOR_Y + 2), (-20, FLOOR_Y + 2)], (0.05, 0.06, 0.12))
    # ---- window: sky, moon, palms (behind the frame)
    x0, y0, x1, y1 = WIN
    sky = L.night_sky(int((y1 - y0) * R), int((x1 - x0) * R), int((y1 - y0) * R) * 1.25,
                      top=(0.14, 0.05, 0.04), mid=(0.26, 0.10, 0.08), hor=(0.36, 0.20, 0.18))
    st = L.Stars(sky.shape[1], sky.shape[0], 70, seed=5)
    sky += st.render(sky.shape[0], sky.shape[1], 0, gain=0.8)
    mx, my, mr = MOON
    L.moon(sky, (mx - x0) * R, (my - y0) * R, mr * R, glow=0.9)
    # distant backwater strip and coconut palms against the moonlit sky
    sh_, sw_ = sky.shape[:2]
    wy = int(sh_ * 0.86)
    sky[wy:] = np.array([0.20, 0.08, 0.06], np.float32)
    for k_ in range(6):
        yk = wy + 4 + k_ * (sh_ - wy) // 6
        sky[yk:yk + 2, :] += np.array([0.10, 0.07, 0.06], np.float32) * (1 - k_ / 6)
    silh = (0.045, 0.022, 0.018)
    for (bx_, h_, lean_, sd_) in ((0.03, 0.56, 0.10, 1), (0.16, 0.40, -0.06, 2), (0.88, 0.58, -0.12, 3), (0.99, 0.42, 0.05, 4)):
        L.palm_tree(sky, bx_ * sw_, wy + 6, h_ * sh_, lean_, silh, seed=sd_)
    cv2.rectangle(sky, (0, wy + 5), (sw_, wy + 9), silh, -1)
    win_region = (slice(int(y0 * R), int(y0 * R) + sky.shape[0]), slice(int(x0 * R), int(x0 * R) + sky.shape[1]))
    # ---- brass scales on the wall (before lighting so they get lamp light)
    hx, hy = SCALE_HOOK
    brass = (0.22, 0.62, 0.95)
    brass_hi = (0.60, 0.95, 1.0)
    dark = (0.03, 0.06, 0.10)
    _line(room, (hx, hy), (hx, hy + 75), dark, 3)
    _ell(room, (hx, hy), (7, 7), 0, 0, 360, brass, 3)
    _poly(room, [(hx - 112, hy + 78), (hx + 112, hy + 78), (hx + 112, hy + 86), (hx - 112, hy + 86)], brass)
    _line(room, (hx - 112, hy + 78), (hx + 112, hy + 78), brass_hi, 2)
    _ell(room, (hx, hy + 82), (10, 10), 0, 0, 360, brass, -1)
    for sx in (hx - 106, hx + 106):
        _ell(room, (sx, hy + 82), (6, 6), 0, 0, 360, brass_hi, -1)
        for dxp in (-48, 0, 48):
            _line(room, (sx, hy + 86), (sx + dxp, hy + 236), (0.10, 0.22, 0.35), 2)
        _ell(room, (sx, hy + 236), (52, 16), 0, 0, 180, brass, -1)
        _ell(room, (sx, hy + 236), (52, 6), 0, 0, 360, brass_hi, -1)
        _ell(room, (sx, hy + 236), (52, 16), 0, 0, 180, dark, 2)
    room = room * light                                                           # light the static set
    room[win_region] = sky                                                        # the window shows the night (unlit by the lamp)
    # ---- moonlight on the floor and sill
    mp = np.zeros((SH, SW), np.float32)
    _poly(mp, [(x0 + 40, FLOOR_Y + 40), (x1 + 20, FLOOR_Y + 40), (x1 + 130, FLOOR_Y + 300), (x0 + 120, FLOOR_Y + 300)], 1.0)
    mp = L.blur(mp, 10 * R) * np.clip(1 - (Y - FLOOR_Y - 40) / 420.0, 0, 1)
    room += mp[..., None] * np.array([0.16, 0.10, 0.07], np.float32)
    # ---- window frame, shutters and sill (overlay layer, also kept for the starfield)
    fr = np.zeros((SH, SW, 3), np.float32)
    fa = np.zeros((SH, SW), np.float32)
    teak = (0.05, 0.10, 0.18)
    teak_lit = (0.09, 0.18, 0.32)
    def both(pts, col):
        _poly(fr, pts, col)
        _poly(fa, pts, 1.0)
    T = 34
    both([(x0 - T, y0 - T), (x1 + T, y0 - T), (x1 + T, y0), (x0 - T, y0)], teak)
    both([(x0 - T, y0 - T), (x0, y0 - T), (x0, y1), (x0 - T, y1)], teak)
    both([(x1, y0 - T), (x1 + T, y0 - T), (x1 + T, y1), (x1, y1)], teak)
    both([(x0 - 52, y1), (x1 + 52, y1), (x1 + 60, y1 + 22), (x0 - 60, y1 + 22)], teak_lit)       # sill top
    both([(x0 - 60, y1 + 22), (x1 + 60, y1 + 22), (x1 + 60, y1 + 40), (x0 - 60, y1 + 40)], teak)   # sill front
    both([(x0 - T, y0 - T), (x0 - T - 72, y0 - T - 40), (x0 - T - 72, y1 + 52), (x0 - T, y1 + 18)], (0.045, 0.09, 0.16))
    both([(x1 + T, y0 - T), (x1 + T + 72, y0 - T - 40), (x1 + T + 72, y1 + 52), (x1 + T, y1 + 18)], (0.045, 0.09, 0.16))
    for sgn, xe in ((-1, x0 - T), (1, x1 + T)):                                  # recessed shutter panels
        for (ya, yb) in ((y0 + 10, y0 + 200), (y0 + 240, y1 - 10)):
            xi, xo = xe + sgn * 12, xe + sgn * 60
            _poly(fr, [(xi, ya), (xo, ya - 24), (xo, yb + 24), (xi, yb)], (0.03, 0.065, 0.12))
    _line(fr, (x0 - T, y0 - T), (x1 + T, y0 - T), (0.12, 0.22, 0.36), 2)
    _line(fr, (x0 - 60, y1 + 2), (x1 + 60, y1 + 2), (0.40, 0.42, 0.45), 2)                  # moonlit sill edge
    for (xa, xb) in ((x0 - T, x0), (x1, x1 + T)):
        _line(fr, (xa, y0 - T), (xa, y1), (0.02, 0.04, 0.07), 2)
        _line(fr, (xb, y0 - T), (xb, y1), (0.02, 0.04, 0.07), 2)
    fr = fr * light * 1.15
    fa = np.clip(fa, 0, 1)
    room = room * (1 - fa[..., None]) + fr * fa[..., None]
    room *= L.paper(SH, SW)
    # ---- the starfield the room dissolves into (same moon, the window frame floats in it)
    sf = L.night_sky(SH, SW, int(1500 * R), top=(0.10, 0.025, 0.02), mid=(0.24, 0.07, 0.055), hor=(0.36, 0.15, 0.13))
    sf *= L.paper(SH, SW, seed=9)
    big = L.Stars(SW, SH, 2600, seed=21)
    sf += big.render(SH, SW, 0, gain=0.9)
    # a soft milky band
    band = np.exp(-(((Y - (1.25 * X + 150)) / 260.0) ** 2)) * (1 + 0.5 * _noise(SH, SW, int(80 * R), 7))
    sf += np.clip(band, 0, 2)[..., None] * np.array([0.06, 0.04, 0.035], np.float32)
    L.moon(sf, mx * R, my * R, mr * R, glow=1.0)
    floor_m = np.clip((Y - (FLOOR_Y + 40)) / 260.0, 0, 1)[..., None]
    sf = sf * (1 - 0.45 * floor_m) + floor_m * np.array([0.06, 0.02, 0.02], np.float32) * 0.0
    frame_star = fr / np.maximum(light * 1.15, 1e-4) * np.array([0.42, 0.40, 0.42], np.float32) + np.array([0.02, 0.03, 0.05], np.float32)
    _SET = dict(room=room.astype(np.float32), lamp=lamp.astype(np.float32), star=sf.astype(np.float32),
                frame=frame_star.astype(np.float32), frame_a=fa.astype(np.float32))
    return _SET


def view(layer, cam, interp=cv2.INTER_LINEAR):
    """Render a static set layer through the camera."""
    M = compose(cam_matrix(cam), np.array([[1 / R, 0, 0], [0, 1 / R, 0]]))
    return cv2.warpAffine(layer, M.astype(np.float32), (W, H), flags=interp, borderMode=cv2.BORDER_REFLECT)


if __name__ == '__main__':
    st = build_sets()
    for nm in ('room', 'star'):
        cv2.imwrite(f'{S}/v2/look/set_{nm}.jpg', L.u8(cv2.resize(st[nm], (540, 960), interpolation=cv2.INTER_AREA)))
    print('ok')


# ====================================================================== characters, shadows, lamp
_SPR = {}


def spr(name):
    """(rgba uint8 frames, geometry) for a v2 sprite sequence."""
    if name not in _SPR:
        if name == 'hand':
            arr = np.load(S + '/assets/char/hand_final.npz')['rgba']
        else:
            arr = np.load(f'{S}/assets/v2char/{name}.npz')['rgba']
        al = arr[..., 3].max(axis=0) > 60
        ys, xs = np.where(al)
        bot = ys.max()
        geo = dict(top=float(ys.min()), bot=float(bot), h=float(bot - ys.min()),
                   cx=float(np.median(xs[ys > bot - 40])), x0=float(xs.min()), x1=float(xs.max()))
        _SPR[name] = (arr, geo)
    return _SPR[name]


def feet_matrix(name, x, y, h):
    """sprite -> set: feet (bottom-centre) at (x, y), height h"""
    arr, g = spr(name)
    s = h / g['h']
    return np.array([[s, 0, x - s * g['cx']], [0, s, y - s * g['bot']]], np.float64)


def room_lit(rgba, warm_side, cool_side, star=0.0, exposure=1.0, n=0, seed=0):
    """Lamp-lit interior grade for a natural-colour sprite (premultiplied float RGBA out).
    warm_side/cool_side: (dx, dy) direction of the warm lamp / cool moon light. star: 0..1 starry-body blend."""
    s = rgba.astype(np.float32) / 255.0
    rgb, a = s[..., :3], s[..., 3]
    hh = rgb.shape[0]
    grad = np.linspace(0.90, 1.06, hh, dtype=np.float32)[:, None, None]          # lamp is low: lower body brighter
    out = rgb * np.array([0.90, 0.94, 1.0], np.float32) * exposure * grad
    def rim(d, col, k, width):
        dx, dy = d
        sh = np.roll(np.roll(a, -int(round(dy)), axis=0), -int(round(dx)), axis=1)
        r = cv2.GaussianBlur(np.clip(a - sh, 0, 1), (0, 0), width)
        return (r * k)[..., None] * np.array(col, np.float32)[None, None]
    out = out + rim(warm_side, (0.25, 0.60, 1.0), 0.9, 2.0) * a[..., None]
    out = out + rim(cool_side, (0.60, 0.48, 0.42), 0.55, 2.0) * a[..., None]
    if star > 0:
        rng = np.random.default_rng(seed)
        body = np.zeros_like(a)
        ys, xs = np.where(a > 0.5)
        m = max(1, len(xs) // 900)
        sel = rng.choice(len(xs), m, replace=False)
        tw = (0.55 + 0.45 * np.sin(rng.uniform(0, 6.28, m) + n * 0.17)) * rng.uniform(0.4, 1.0, m)
        body[ys[sel], xs[sel]] = tw
        big = sel[: max(1, m // 12)]
        body = cv2.GaussianBlur(body, (0, 0), 1.6) * 14
        sp = np.zeros_like(a)
        sp[ys[big], xs[big]] = 1.0
        sp = cv2.GaussianBlur(sp, (0, 0), 3.0) * 40
        night = np.array([0.34, 0.13, 0.10], np.float32)[None, None] * (0.75 + 0.25 * grad)
        starry = night + (body + sp)[..., None] * np.array([1.0, 0.94, 0.90], np.float32)
        edge = np.clip(a - cv2.erode(a, np.ones((7, 7), np.uint8)), 0, 1)
        starry = starry + cv2.GaussianBlur(edge, (0, 0), 1.4)[..., None] * np.array([1.0, 0.86, 0.86], np.float32) * 1.6
        out = out * (1 - star) + starry * star
    return np.dstack([out * a[..., None], a])


def place(img, pm, M):
    wpm, box = L.place_roi(img, pm, M)
    if wpm is None:
        return None
    x0, y0, x1, y1 = box
    al = np.clip(wpm[..., 3:4], 0, 1)
    img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - al) + wpm[..., :3]
    return wpm, box


def shadow_on_wall(img, cam, alpha_spr, M_spr, k=1.55, strength=0.55, extra=None):
    """Cast the sprite's silhouette from the lamp onto the wall (set space projection), darken the wall."""
    lx, ly = LAMP_LIGHT
    P = np.array([[k, 0, lx - k * lx], [0, k, ly - k * ly]], np.float64)
    Ms = compose(P, M_spr)
    if extra is not None:
        Ms = compose(extra, Ms)
    M = compose(cam_matrix(cam), Ms)
    sh = cv2.warpAffine(alpha_spr, M.astype(np.float32), (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
    sh = L.blur(sh, 7 * cam[0])
    # only on the wall (not on the window's sky, not on the floor)
    Mc = cam_matrix(cam)
    wall = np.zeros((H, W), np.float32)
    def tp(x, y):
        return Mc @ np.array([x, y, 1.0])
    p0, p1 = tp(-200, WALL_TOP), tp(1300, FLOOR_Y)
    cv2.rectangle(wall, (int(p0[0]), int(p0[1])), (int(p1[0]), int(p1[1])), 1.0, -1)
    q0, q1 = tp(WIN[0], WIN[1]), tp(WIN[2], WIN[3])
    cv2.rectangle(wall, (int(q0[0]), int(q0[1])), (int(q1[0]), int(q1[1])), 0.0, -1)
    img *= (1 - strength * (sh * wall))[..., None]
    return sh * wall


def contact_shadow(img, cam, x, y, w, k=1.0):
    M = cam_matrix(cam)
    p = M @ np.array([x, y, 1.0])
    z = cam[0]
    m = np.zeros((H, W), np.float32)
    cv2.ellipse(m, (int(p[0]), int(p[1])), (max(1, int(w * z)), max(1, int(w * 0.16 * z))), 0, 0, 360, 1.0, -1, cv2.LINE_AA)
    m = L.blur(m, 10 * z)
    img *= (1 - 0.55 * k * m)[..., None]


def draw_lamp(img, cam, n, flame_k=1.0):
    """Foreground brass nilavilakku (top dish with three wicks), slightly out of focus."""
    M = cam_matrix(cam)
    z = cam[0]
    cx, cy = M @ np.array([LAMP[0], LAMP[1], 1.0])
    if cy - 200 * z > H or cx + 260 * z < 0 or cx - 260 * z > W:
        return img
    R0 = int(300 * z)
    X0, Y0 = int(max(0, cx - R0)), int(max(0, cy - 260 * z))
    X1, Y1 = int(min(W, cx + R0)), H
    if X1 <= X0 or Y1 <= Y0:
        return img
    sub = img[Y0:Y1, X0:X1].copy()
    lay = np.zeros_like(sub)
    la = np.zeros(sub.shape[:2], np.float32)
    ox, oy = cx - X0, cy - Y0
    brass = (0.10, 0.36, 0.66)
    brass_d = (0.04, 0.14, 0.30)
    brass_h = (0.45, 0.82, 1.0)
    def E(c, ax, a0, a1, col, th=-1, alpha=True):
        cv2.ellipse(lay, (int(c[0] * 8), int(c[1] * 8)), (int(ax[0] * 8), int(ax[1] * 8)), 0, a0, a1, col, th, cv2.LINE_AA, 3)
        if alpha and th < 0:
            cv2.ellipse(la, (int(c[0] * 8), int(c[1] * 8)), (int(ax[0] * 8), int(ax[1] * 8)), 0, a0, a1, 1.0, th, cv2.LINE_AA, 3)
    # stem down to the bottom of the frame
    sw = 26 * z
    cv2.rectangle(lay, (int(ox - sw), int(oy)), (int(ox + sw), Y1 - Y0), brass_d, -1)
    cv2.rectangle(la, (int(ox - sw), int(oy)), (int(ox + sw), Y1 - Y0), 1.0, -1)
    cv2.rectangle(lay, (int(ox - sw * 0.4), int(oy)), (int(ox - sw * 0.1), Y1 - Y0), brass, -1)
    E((ox, oy + 70 * z), (44 * z, 15 * z), 0, 360, brass)
    E((ox, oy + 66 * z), (44 * z, 9 * z), 180, 360, brass_h, max(1, int(3 * z)), alpha=False)
    E((ox, oy + 10 * z), (172 * z, 50 * z), 0, 180, brass_d)          # dish body
    E((ox, oy), (172 * z, 30 * z), 0, 360, brass)                      # dish top face
    E((ox, oy), (150 * z, 22 * z), 0, 360, (0.05, 0.16, 0.30))         # oil inside
    E((ox, oy), (172 * z, 30 * z), 180, 360, brass_h, max(1, int(4 * z)), alpha=False)
    E((ox, oy), (172 * z, 30 * z), 0, 180, (0.25, 0.60, 0.95), max(1, int(3 * z)), alpha=False)
    # central finial
    pts = np.array([(ox - 18 * z, oy - 4 * z), (ox + 18 * z, oy - 4 * z), (ox + 6 * z, oy - 70 * z), (ox, oy - 96 * z), (ox - 6 * z, oy - 70 * z)])
    cv2.fillPoly(lay, [(pts * 8).astype(np.int32)], brass, cv2.LINE_AA, 3)
    cv2.fillPoly(la, [(pts * 8).astype(np.int32)], 1.0, cv2.LINE_AA, 3)
    al = la[..., None]
    sub = sub * (1 - al) + lay * al
    sub = cv2.GaussianBlur(sub, (0, 0), 1.2 * z) * al + sub * (1 - al)
    img[Y0:Y1, X0:X1] = sub
    if flame_k > 0.01:
        for (dx, dy, sd) in ((-150, -6, 1), (0, -26, 2), (150, -6, 3)):
            L.flame(img, cx + dx * z, cy + dy * z, 62 * z * flame_k, n, seed=sd, gain=1.0 * min(1.0, flame_k * 1.5))
    return img
