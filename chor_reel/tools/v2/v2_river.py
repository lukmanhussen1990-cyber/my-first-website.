"""Shots 1-2 (frames 0-281): moon over the backwater, the house on the bank, the thief arriving by boat."""
import os, sys, math, json
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import v2lib as L

S = L.S
W, HC = 1080, 2600                      # tall canvas; the camera tilts down it
SC = 3.6                                # plate scale
PX0, PY0, PY1 = 175, 50, 330            # plate crop (source px)
PLATE_Y = 1100                          # canvas row of plate row PY0
BANK_Y = PLATE_Y + int((PY1 - PY0) * SC)   # 2108
WATER_Y = BANK_Y + 20
MOON = (800.0, 830.0, 52.0)
CAM_END = 680


def P(x, y):
    return (x - PX0) * SC, PLATE_Y + (y - PY0) * SC


TULSI = P(330, 279)
_ST = None


def static_layers():
    global _ST
    if _ST is not None:
        return _ST
    p = cv2.imread(S + '/v2/plates_raw/p_0.0.png')
    crop = p[PY0 - 30:PY1, PX0:PX0 + 300]
    U = L.f32(L.up(crop, SC))
    N = L.night(U, exposure=1.05, sat=0.55)
    lum = U.mean(axis=2, keepdims=True)
    N = N + np.clip((lum - 0.62) / 0.25, 0, 1) * np.array([0.10, 0.07, 0.06], np.float32)[None, None]
    y_top = PLATE_Y - int(30 * SC)
    sky = L.night_sky(HC, W, BANK_Y - 300) * L.paper(HC, W)
    canvas = sky.copy()
    h = N.shape[0]
    a = np.ones((h, 1, 1), np.float32)
    ramp = int(60 * SC)
    a[:ramp, 0, 0] = np.linspace(0, 1, ramp) ** 1.3
    canvas[y_top:y_top + h] = canvas[y_top:y_top + h] * (1 - a) + N * a
    plate_alpha = np.zeros((HC, 1, 1), np.float32)
    plate_alpha[y_top:y_top + h] = a
    # house lights
    win = np.zeros((HC, W), np.float32)
    for (sx, sy, sw, sh) in ((117, 248, 22, 10), (205, 248, 22, 10), (443, 248, 22, 10), (333, 105, 22, 9)):
        cx, cy = P(sx, sy)
        if 0 <= cx < W:
            cv2.rectangle(win, (int(cx - sw * SC / 2), int(cy - sh * SC / 2)), (int(cx + sw * SC / 2), int(cy + sh * SC / 2)), 1.0, -1)
    bars = np.zeros((HC, W), np.float32)
    bars[y_top:y_top + h] = (U.mean(axis=2) < 0.35).astype(np.float32)
    region = win * (1 - 0.8 * bars)
    canvas = canvas * (1 - region[..., None]) + region[..., None] * np.array([0.25, 0.62, 1.0], np.float32)
    seam = np.zeros((HC, W), np.float32)
    dx, dy0 = P(325, 214)
    _, dy1 = P(325, 270)
    cv2.line(seam, (int(dx), int(dy0)), (int(dx), int(dy1)), 0.9, 3)
    cv2.line(seam, (int(P(301, 0)[0]), int(dy1)), (int(P(349, 0)[0]), int(dy1)), 0.7, 3)   # light under the door
    canvas += seam[..., None] * np.array([0.25, 0.62, 1.0], np.float32)
    L.add_glow(canvas, win + seam, (0.06, 0.25, 0.65), 14, 1.2)
    L.add_glow(canvas, win + seam, (0.03, 0.12, 0.35), 60, 1.0)
    # stone bank
    stone = np.array([0.30, 0.25, 0.25], np.float32)
    edge = np.array([0.10, 0.07, 0.07], np.float32)
    rng = np.random.default_rng(2)
    yb = BANK_Y - 16
    cv2.rectangle(canvas, (0, yb), (W, WATER_Y + 4), tuple(float(v) for v in stone * 0.85), -1)
    x = -int(rng.integers(0, 60))
    while x < W:
        w_ = int(rng.integers(70, 120))
        cv2.rectangle(canvas, (int(x), yb), (int(x + w_), WATER_Y + 4), tuple(float(v) for v in edge), 2, cv2.LINE_AA)
        x += w_
    cv2.line(canvas, (0, yb), (W, yb), (0.42, 0.37, 0.36), 2, cv2.LINE_AA)
    L.moon(canvas, *MOON)
    # ghat steps as a separate layer (drawn over the water)
    steps = np.zeros((HC, W, 4), np.float32)
    sx0, _ = P(325, 0)
    for k in range(5):
        w_ = 300 + k * 44
        y0 = BANK_Y - 30 + k * 26
        col = tuple(float(v) for v in stone * (1.0 - 0.07 * k)) + (1.0,)
        cv2.rectangle(steps, (int(sx0 - w_ / 2), y0), (int(sx0 + w_ / 2), y0 + 26), col, -1)
        cv2.line(steps, (int(sx0 - w_ / 2), y0), (int(sx0 + w_ / 2), y0), (0.45, 0.40, 0.40, 1.0), 2, cv2.LINE_AA)
        cv2.rectangle(steps, (int(sx0 - w_ / 2), y0), (int(sx0 + w_ / 2), y0 + 26), tuple(float(v) for v in edge) + (1.0,), 2, cv2.LINE_AA)
    # lower steps fade under the water surface
    fade = np.clip(1 - (np.arange(HC, dtype=np.float32) - (WATER_Y + 30)) / 60.0, 0.25, 1)[:, None]
    steps[..., 3] *= fade
    steps[..., :3] *= steps[..., 3:4]
    _ST = dict(canvas=canvas, steps=steps, steps_x=sx0, plate_alpha=plate_alpha)
    return _ST


STARS = L.Stars(W, HC, 1100, seed=11)
DIYAS = [(150, 2290, 0.95, 0), (330, 2480, 1.25, 1), (760, 2250, 0.85, 2), (930, 2420, 1.15, 3), (60, 2530, 1.3, 4), (610, 2560, 1.35, 5)]
_SPR = {}


def sprites():
    if not _SPR:
        for nm in ('kneel', 'idle'):
            _SPR[nm] = np.load(f'{S}/assets/v2char/{nm}.npz')['rgba']
        b, deck, wl, lan, lbox = L.boat_sprite()
        _SPR['boat'] = (b, deck, wl, lan)
        geo = {}
        for nm in ('kneel', 'idle'):
            al = _SPR[nm][..., 3].max(axis=0) > 60
            ys, xs = np.where(al)
            geo[nm] = dict(top=ys.min(), bot=ys.max(), h=ys.max() - ys.min(), cx=float(np.median(xs[ys > ys.max() - 40])))
        _SPR['geo'] = geo
    return _SPR


def ease(t):
    t = float(np.clip(t, 0, 1))
    return t * t * (3 - 2 * t)


def boat_state(n):
    """boat centre x, waterline y (canvas), bob angle"""
    if n < 72:
        return None
    t = np.clip((n - 72) / (182 - 72), 0, 1)
    k = 1 - (1 - t) ** 2.2                       # decelerating glide
    x = 1500 + (520 - 1500) * k
    y = 2420 + (2335 - 2420) * k
    bob = 3.0 * math.sin(n * 0.11) + 1.5 * math.sin(n * 0.23 + 1)
    ang = 0.8 * math.sin(n * 0.09 + 0.5)
    return x, y + bob, ang


H_STAND = 360.0


def man_layer(n, lantern_canvas_xy):
    """Premultiplied RGBA of the man in the boat (canvas size crop region handled by caller)."""
    sp = sprites()
    t = np.clip((n - 182) / 4.0, 0, 1)
    parts = []
    if t < 1:
        parts.append(('kneel', 0, 1 - t))
    if t > 0:
        idx = (max(0, n - 186) // 3)
        m = len(sp['idle'])
        p = 2 * (m - 1)
        idx = idx % p
        idx = idx if idx < m else p - idx
        parts.append(('idle', idx, t))
    return parts


def render(n):
    st = static_layers()
    sp = sprites()
    tcam = ease((n - 4) / 72.0)
    Y0 = int(round(CAM_END * tcam))                 # camera window top (canvas rows Y0 .. Y0+1920)
    FH = 1920
    f = st['canvas'][Y0:Y0 + FH].copy()
    rows = np.arange(Y0, Y0 + FH, dtype=np.float32)
    sky_w = np.clip((BANK_Y - 760 - rows) / 300.0, 0, 1)[:, None, None] * (1 - st['plate_alpha'][Y0:Y0 + FH])
    f += STARS.render(FH, W, n, dy=-Y0) * sky_w
    tx, ty = TULSI
    L.flame(f, tx, ty - 4 - Y0, 26, n, seed=3, gain=1.0)
    # water (only the visible part)
    wy = WATER_Y - Y0
    if wy < FH:
        wat = L.water(HC - WATER_Y, W, n, moon_x=MOON[0])
        f[max(0, wy):] = wat[max(0, -wy):max(0, -wy) + FH - max(0, wy)]
        stp = st['steps'][Y0:Y0 + FH]
        f = f * (1 - stp[..., 3:4]) + stp[..., :3]
    for (x0, y0, s_, sd) in DIYAS:
        x = (x0 - n * 0.35 * s_) % (W + 80) - 40
        y = y0 + 2 * math.sin(n * 0.08 + sd) - Y0
        L.diya(f, x, y, s_, n, sd)
    bs = boat_state(n)
    if bs is not None:
        bx, by, ang = bs
        by -= Y0
        b, deck, wl, lan = sp['boat']
        Mb = cv2.getRotationMatrix2D((b.shape[1] / 2, wl), ang, 1.0)
        Mb[0, 2] += bx - b.shape[1] / 2
        Mb[1, 2] += by - wl
        lan_c = Mb @ np.array([lan[0], lan[1] + 10, 1.0])
        # local working box around boat + man
        BX0, BY0 = int(max(0, bx - 420)), int(max(0, by - 520))
        BX1, BY1 = int(min(W, bx + 420)), int(min(FH, by + 420))
        if BX1 > BX0 and BY1 > BY0:
            bw, bh = BX1 - BX0, BY1 - BY0
            T = np.array([[1, 0, -BX0], [0, 1, -BY0]], np.float64)
            def loc(M):
                return (np.vstack([T, [0, 0, 1]]) @ np.vstack([M, [0, 0, 1]]))[:2]
            acc = None
            man_x = bx + 30
            deck_c = by - (wl - deck)
            for nm, idx, wgt in man_layer(n, lan_c):
                g = sp['geo'][nm]
                spr = sp[nm][idx]
                hh = H_STAND * (0.62 if nm == 'kneel' else 1.0)
                s_ = hh / g['h']
                drop = 34 if nm == 'kneel' else 18
                M = np.array([[s_, 0, man_x - s_ * g['cx']], [0, s_, deck_c + drop - s_ * g['bot']]])
                pm = L.lit_sprite(spr, exposure=1.3, sat=1.0, warm=((0.02, 0.10, 0.22), 0.6),
                                  rims=[(4, -3, (0.55, 0.45, 0.42), 0.65), (3, 0, (0.10, 0.40, 0.90), 0.55)])
                w_ = cv2.warpAffine(pm, loc(M).astype(np.float32), (bw, bh), flags=cv2.INTER_LINEAR, borderValue=0)
                acc = w_ * wgt if acc is None else acc + w_ * wgt
            lf = L.radial(bh, bw, lan_c[0] - BX0, lan_c[1] - BY0, 260, 300)
            acc[..., :3] *= (1 + lf[..., None] * np.array([0.05, 0.25, 0.55], np.float32))
            wb = cv2.warpAffine(b, loc(Mb).astype(np.float32), (bw, bh), flags=cv2.INTER_LINEAR, borderValue=0)
            ba = wb[..., 3:4]
            layer = acc[..., :3] * (1 - ba) + wb[..., :3] * ba
            lay_a = acc[..., 3:4] + ba * (1 - acc[..., 3:4])
            # reflection below the waterline (inside the box)
            yw = int(round(by)) - BY0
            hgt = min(yw, bh - yw)
            roi = f[BY0:BY1, BX0:BX1]
            if hgt > 10:
                src = layer[yw - hgt:yw][::-1]
                srca = lay_a[yw - hgt:yw][::-1, :, 0]
                rr = np.arange(hgt, dtype=np.float32)
                shift = (3.0 * np.sin(rr * 0.18 + n * 0.3)).astype(np.float32)
                mapx = (np.arange(bw, dtype=np.float32)[None, :] + shift[:, None]).astype(np.float32)
                mapy = np.repeat(rr[:, None], bw, axis=1).astype(np.float32)
                rs = cv2.remap(np.ascontiguousarray(src), mapx, mapy, cv2.INTER_LINEAR)
                ra = cv2.remap(np.ascontiguousarray(srca), mapx, mapy, cv2.INTER_LINEAR)[..., None]
                fadep = np.exp(-rr / (hgt * 0.35))[:, None, None] * 0.38
                roi[yw:yw + hgt] = roi[yw:yw + hgt] * (1 - ra * fadep) + rs * np.array([0.9, 0.7, 0.6], np.float32) * fadep * ra
            roi[:] = roi * (1 - lay_a) + layer
            L.flame(f, lan_c[0], lan_c[1] + 6, 18, n, seed=9, gain=1.0)
    return f


_MET = None


def fade_gain(n):
    global _MET
    if _MET is None:
        _MET = [(r['b'] + r['g'] + r['r']) / 3.0 for r in json.load(open(S + '/frames/A_metrics.json'))]
    return float(np.clip(_MET[n] / _MET[60], 0, 1)) if n < 60 else 1.0


def render_frame(n):
    return render(n) * fade_gain(n)


if __name__ == '__main__':
    od = S + '/v2/look'
    for n in [int(v) for v in sys.argv[1].split(',')]:
        cv2.imwrite(f'{od}/river_{n:04d}.jpg', L.u8(render_frame(n)), [cv2.IMWRITE_JPEG_QUALITY, 92])
        print('ok', n, flush=True)
