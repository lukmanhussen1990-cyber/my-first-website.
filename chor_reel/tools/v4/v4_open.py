"""v4 opening (frames 0-281), 16:9 like the original, cut on the lyric words so it never drags:
  A  0-94    "रात आया"    wide: moon, far shore, the lake; the boat with the cosmic thief glides in from the right
  B  95-183  "मेरे घर"    the house on the river with its ghat steps; its windows light up on "घर"
  C  184-252 "एक चोर"     close on the boat: the thief's starry cloak flares on "चोर"
  D  253-281 "आके"        the boat touches the steps and he glides up toward the door
World px = screen px at zoom 1."""
import os, sys, math, json
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
for _d in ("v3", "v2"):  # shared helpers
    sys.path.insert(1, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), _d))
import v2lib as L
import v3_beats as B
import v4_thief as TH

S = L.S
W, H = 1920, 1080
Y_H = 470                                    # far-shore waterline (world y)
HSC = 1.7
PX0, PX1, PY1 = 60, 600, 282
X_H, Y_V = 40, 660                           # house layer left, verandah edge (plate bottom)
DOOR_X = X_H + (325 - PX0) * HSC             # 490.5
STEP_X0, STEP_X1 = DOOR_X - 90, DOOR_X + 90
DOCK_X, DOCK_Y = DOOR_X + 260, 812          # boat centre x / waterline when docked
MOON = (1700.0, 250.0, 46.0)
TS = 0.24                                    # thief units -> world px
ease, ramp = B.ease, B.ramp


def boat_x(n):
    t = float(np.clip(n / float(B.W_AAKE), 0, 1))
    return 2700 - (2700 - DOCK_X) * (1 - (1 - t) ** 1.6)


SHOTS = [(0, 94, 'A'), (95, 183, 'B'), (184, 252, 'C'), (253, 281, 'D')]


def cam(n):
    if n <= 94:
        t = ease(n / 94.0)
        return (1.0, 1650 - 90 * t, 520)
    if n <= 183:
        t = ease((n - 95) / 88.0)
        return (1.30 + 0.06 * t, 700 - 20 * t, 470)
    if n <= 252:
        t = ease((n - 184) / 68.0)
        return (2.0 + 0.10 * t, boat_x(n) + 60, 640)
    t = ease((n - 253) / 28.0)
    return (1.20 + 0.05 * t, 760 - 40 * t, 560)


def cam_matrix(c):
    z, cx, cy = c
    return np.array([[z, 0, W / 2 - z * cx], [0, z, H / 2 - z * cy]], np.float64)


# ------------------------------------------------------------------ static layers
_ST = None


def static():
    global _ST
    if _ST is not None:
        return _ST
    p = cv2.imread(S + '/v2/plates_raw/p_0.0.png')
    crop = p[0:PY1, PX0:PX1]
    sm = L.sky_mask(p)[0:PY1, PX0:PX1].astype(np.float32)
    up = 2.0                                                  # build at 2x so close framings stay sharp
    hs = HSC * up
    U = L.f32(L.up(crop, hs))
    N = L.night(U, exposure=1.08, sat=0.55)
    lum = U.mean(axis=2, keepdims=True)
    N = N + np.clip((lum - 0.62) / 0.25, 0, 1) * np.array([0.10, 0.07, 0.06], np.float32)[None, None]
    A = 1 - cv2.resize(sm, (U.shape[1], U.shape[0]), interpolation=cv2.INTER_LINEAR)
    A = cv2.GaussianBlur(A, (0, 0), 2.0)
    Hh, Ww = N.shape[:2]
    # feather the painting's edges (its framing trees) into the night so it never reads as a box
    rng_ = np.random.default_rng(4)
    wob = cv2.resize(rng_.random((12, 40)).astype(np.float32), (Ww, Hh), interpolation=cv2.INTER_CUBIC)
    xx_ = np.arange(Ww, dtype=np.float32)[None, :] / up
    yy_ = np.arange(Hh, dtype=np.float32)[:, None] / up
    fx_ = np.clip((Ww / up - xx_ - 20 * wob) / 170.0, 0, 1) * np.clip((xx_ - 10 * wob) / 70.0, 0, 1)
    fy_ = np.clip((yy_ - 25 * wob) / 120.0, 0, 1)
    vig = fx_ * fy_
    A = A * (vig * vig * (3 - 2 * vig))
    win = np.zeros((Hh, Ww), np.float32)
    for (sx, sy, sw, sh) in ((117, 248, 22, 10), (205, 248, 22, 10), (443, 248, 22, 10), (333, 105, 22, 9)):
        cx, cy = (sx - PX0) * hs, sy * hs
        cv2.rectangle(win, (int(cx - sw * hs / 2), int(cy - sh * hs / 2)), (int(cx + sw * hs / 2), int(cy + sh * hs / 2)), 1.0, -1)
    bars = (U.mean(axis=2) < 0.35).astype(np.float32)
    reg = win * (1 - 0.8 * bars)
    lit = N * (1 - reg[..., None]) + reg[..., None] * np.array([0.25, 0.62, 1.0], np.float32)
    dx = (325 - PX0) * hs
    cv2.line(lit, (int(dx), int(214 * hs)), (int(dx), int(270 * hs)), (0.25, 0.62, 1.0), 3)
    cv2.line(lit, (int((301 - PX0) * hs), int(270 * hs)), (int((349 - PX0) * hs), int(270 * hs)), (0.25, 0.62, 1.0), 3)
    glowm = win.copy()
    cv2.line(glowm, (int(dx), int(214 * hs)), (int(dx), int(270 * hs)), 1.0, 3)
    lit = lit + (L.blur(glowm, 12 * up) * 1.2 + L.blur(glowm, 50 * up))[..., None] * np.array([0.05, 0.22, 0.60], np.float32)
    dark = N * (1 - reg[..., None] * 0.7)
    # stone ledge + ghat steps down to the water (in the 2x layer)
    ext = int(130 * up)
    def canvas(img):
        c = np.zeros((Hh + ext, Ww + int(40 * up), 3), np.float32)
        c[:Hh, :Ww] = img
        return c
    layers = [canvas(lit), canvas(dark)]
    la = np.zeros((Hh + ext, Ww + int(40 * up)), np.float32)
    la[:Hh, :Ww] = A
    stone = np.array([0.27, 0.22, 0.22], np.float32)
    edge = (0.09, 0.06, 0.06)
    ly = Hh
    lh = int(20 * up)
    rng = np.random.default_rng(2)
    xs_ = [0]
    while xs_[-1] < Ww:
        xs_.append(xs_[-1] + int(rng.integers(40, 70) * up))
    for layer in layers:
        cv2.rectangle(layer, (0, ly - 3), (Ww, ly + lh), tuple(float(v) for v in stone * 0.85), -1)
        for x0, x1 in zip(xs_, xs_[1:]):
            cv2.rectangle(layer, (x0, ly - 3), (x1, ly + lh), edge, 2, cv2.LINE_AA)
        cv2.line(layer, (0, ly - 3), (Ww, ly - 3), (0.40, 0.35, 0.34), 2, cv2.LINE_AA)
        sx0, sx1 = (STEP_X0 - X_H) * up, (STEP_X1 - X_H) * up
        for k in range(5):
            y0 = ly + lh + k * int(16 * up)
            xa, xb = int(sx0 - k * 14 * up), int(sx1 + k * 8 * up)
            cv2.rectangle(layer, (xa, y0), (xb, y0 + int(16 * up)), tuple(float(v) for v in stone * (0.95 - 0.08 * k)), -1)
            cv2.line(layer, (xa, y0), (xb, y0), (0.42, 0.37, 0.36), 2, cv2.LINE_AA)
            cv2.rectangle(layer, (xa, y0), (xb, y0 + int(16 * up)), edge, 2, cv2.LINE_AA)
    cv2.rectangle(la, (0, ly - 3), (Ww, ly + lh), 1.0, -1)
    for k in range(5):
        y0 = ly + lh + k * int(16 * up)
        cv2.rectangle(la, (int((STEP_X0 - X_H) * up - k * 14 * up), y0), (int((STEP_X1 - X_H) * up + k * 8 * up), y0 + int(16 * up)), 1.0, -1)
    _ST = dict(lit=layers[0], dark=layers[1], a=np.clip(la, 0, 1), up=up, origin=(X_H, Y_V - PY1 * HSC))
    # distant skyline silhouette strip (temples, palms, houses, lamp towers)
    sk = np.zeros((220, 5200), np.float32)
    rng = np.random.default_rng(5)
    x = 0
    while x < 5200:
        kind = rng.random()
        if kind < 0.35:
            L.palm_tree(sk, x, 214, rng.uniform(70, 120), rng.uniform(-0.15, 0.15), 1.0, seed=int(rng.integers(0, 999)))
            x += int(rng.uniform(25, 60))
        elif kind < 0.5:
            bw, bh = rng.uniform(80, 130), rng.uniform(30, 48)
            pts = np.array([(x, 214), (x, 214 - bh), (x + bw * 0.15, 214 - bh - 26), (x + bw * 0.85, 214 - bh - 26), (x + bw, 214 - bh), (x + bw, 214)])
            cv2.fillPoly(sk, [pts.astype(np.int32)], 1.0, cv2.LINE_AA)
            cv2.fillPoly(sk, [np.array([(x + bw * 0.35, 214 - bh - 26), (x + bw * 0.5, 214 - bh - 52), (x + bw * 0.65, 214 - bh - 26)]).astype(np.int32)], 1.0, cv2.LINE_AA)
            x += int(bw + rng.uniform(20, 60))
        elif kind < 0.58:
            cv2.rectangle(sk, (int(x), 214 - int(rng.uniform(70, 110))), (int(x + 8), 214), 1.0, -1)
            x += int(rng.uniform(30, 60))
        else:
            bw, bh = rng.uniform(40, 90), rng.uniform(16, 34)
            cv2.rectangle(sk, (int(x), int(214 - bh)), (int(x + bw), 214), 1.0, -1)
            cv2.fillPoly(sk, [np.array([(x - 6, 214 - bh), (x + bw / 2, 214 - bh - 16), (x + bw + 6, 214 - bh)]).astype(np.int32)], 1.0, cv2.LINE_AA)
            x += int(bw + rng.uniform(10, 50))
    _ST['skyline'] = cv2.GaussianBlur(sk, (0, 0), 0.8)
    b, deck, wl, lan, _ = L.boat_sprite(Lb=430)
    _ST['boat'] = (b, deck, wl, lan)
    return _ST


STARS = L.Stars(W, H, 1500, seed=11)
DIYAS = [(1500, 700, 0.9, 0), (1850, 760, 1.1, 1), (2200, 650, 0.8, 2), (1200, 840, 1.15, 3), (2500, 820, 1.2, 4),
         (950, 900, 1.2, 5), (2850, 700, 0.9, 6), (1650, 900, 1.25, 7), (700, 1000, 1.3, 8)]


def water_rows(Hs, Wd, x0, n, z, base=(0.25, 0.10, 0.06), line=(0.48, 0.29, 0.21), moon_x=None):
    """seigaiha water rows for a strip of height Hs (top = far), drifting with the camera x (screen px)"""
    img = np.zeros((Hs, Wd, 3), np.float32) + np.array(base, np.float32)
    y = -4.0
    row = 0
    base_c = tuple(float(v) for v in base)
    while y < Hs + 10:
        t = np.clip(y / max(1.0, 560.0 * z), 0, 1)
        r = (8 + 70 * t ** 1.25) * z
        ry = r * 0.42
        step = 2 * r
        par = 0.18 + 0.82 * t
        drift = (-x0 * z * par + n * 0.35 * (0.5 + t) * (1 if row % 2 else -1)) % step
        x = -step + (row % 2) * r + drift
        th = max(1, int(round(0.8 + 2.0 * t * min(z, 1.6))))
        lc = np.array(line, np.float32) * (0.82 + 0.18 * t)
        while x < Wd + step:
            cx, cy = int(round(x)), int(round(y + ry))
            cv2.ellipse(img, (cx, cy), (int(r), max(1, int(ry))), 0, 180, 360, base_c, -1, cv2.LINE_AA)
            for k, fr in enumerate((1.0, 0.72, 0.44)):
                g = 1.0 - 0.18 * k
                if moon_x is not None:
                    g += 1.0 * math.exp(-((x - moon_x) / (50 + 90 * t)) ** 2)
                cv2.ellipse(img, (cx, cy), (max(1, int(r * fr)), max(1, int(ry * fr))), 0, 180, 360, tuple(float(v) for v in lc * g), th, cv2.LINE_AA)
            x += step
        y += ry * 0.62
        row += 1
    return img


def thief_world(n):
    """thief hem position (world), sway, ripple and stars flare"""
    bx = boat_x(n)
    flare = 1.6 * math.exp(-max(0, n - B.W_CHOR) / 14.0) if n >= B.W_CHOR - 1 else 0.0
    if n < B.W_AAKE + 6:
        return bx - 30, DOCK_Y - 28 + 3.0 * math.sin(n * 0.11), 3 * math.sin(n * 0.05), 0.4, flare
    k = n - B.W_AAKE - 6
    pts = [(bx - 30, DOCK_Y - 28), (STEP_X1 - 10, Y_V + 20 + 4 * 16), (DOOR_X + 30, Y_V + 6)]
    if k < 12:
        t = ease(k / 12.0)
        (xa, ya), (xb, yb) = pts[0], pts[1]
    else:
        t = ease(min(1.0, (k - 12) / 40.0))
        (xa, ya), (xb, yb) = pts[1], pts[2]
    return xa + (xb - xa) * t, ya + (yb - ya) * t, -10.0, 1.6, flare


def render(n):
    st = static()
    c = cam(n)
    z, cxw, cyw = c
    Mc = cam_matrix(c)
    x0 = cxw - W / 2 / z                                       # world x at the left edge
    img = np.zeros((H, W, 3), np.float32)
    hz = int(round(Mc[1, 1] * Y_H + Mc[1, 2]))                 # horizon on screen
    sky = L.night_sky(H, W, max(10, hz), top=(0.11, 0.03, 0.025), mid=(0.24, 0.08, 0.065), hor=(0.36, 0.17, 0.16))
    img[:] = sky
    img += STARS.render(H, W, n, dx=-x0 * 0.05, dy=0) * np.clip((hz - np.arange(H, dtype=np.float32))[:, None, None] / 160.0, 0, 1)
    mx = (MOON[0] - x0 * 0.0) * z + Mc[0, 2] - (MOON[0] * (z - 1)) * 0.0
    mx, my = Mc @ np.array([MOON[0] + (x0 - 690) * 0.85, MOON[1], 1.0])     # the moon barely moves (very far)
    L.moon(img, mx, my, MOON[2] * (0.6 + 0.4 * z), glow=0.95)
    # far skyline (parallax 0.15, scaled with the zoom)
    sk = st['skyline']
    skz = cv2.resize(sk, None, fx=z, fy=z, interpolation=cv2.INTER_LINEAR) if abs(z - 1) > 0.01 else sk
    xo = int(x0 * 0.15 * z) % max(1, skz.shape[1] - W - 2)
    strip = skz[:, xo:xo + W]
    ys = int(hz - 214 * z)
    y_a, y_b = max(0, ys), min(H, ys + strip.shape[0])
    if y_b > y_a and strip.shape[1] == W:
        a = strip[y_a - ys:y_b - ys, :, None]
        img[y_a:y_b] = img[y_a:y_b] * (1 - a) + a * np.array([0.10, 0.035, 0.035], np.float32)
    # lake
    if hz < H:
        wat = water_rows(H - max(0, hz), W, x0, n, z, moon_x=mx)
        img[max(0, hz):] = wat[max(0, -hz):]
        col = np.zeros((H, W), np.float32)
        cv2.line(col, (int(mx), max(0, hz)), (int(mx), H), 1.0, int(22 * z))
        img += (L.blur(col, 16 * z) * np.clip((np.arange(H, dtype=np.float32)[:, None] - hz) / 300.0, 0, 1) * 0.10)[..., None] * np.array([0.9, 0.8, 0.7], np.float32)
    # the house (windows light up on "घर")
    on = ease((n - (B.f(4.86) - 4)) / 10.0)
    up = st['up']
    hl = st['lit'] * on + st['dark'] * (1 - on)
    pm = np.dstack([hl * st['a'][..., None], st['a']])
    ox, oy = st['origin']
    Mh = (np.vstack([Mc, [0, 0, 1]]) @ np.array([[1 / up, 0, ox], [0, 1 / up, oy], [0, 0, 1]]))[:2]
    wpm, box = L.place_roi(img, pm, Mh)
    if wpm is not None:
        X0, Y0, X1, Y1 = box
        img[Y0:Y1, X0:X1] = img[Y0:Y1, X0:X1] * (1 - np.clip(wpm[..., 3:4], 0, 1)) + wpm[..., :3]
    # diyas drifting on the water
    for (wx, wy, s_, sd) in DIYAS:
        p = Mc @ np.array([wx - n * 0.3 * s_, wy + 2 * math.sin(n * 0.08 + sd), 1.0])
        if p[1] > hz + 6:
            L.diya(img, p[0], p[1], s_ * 1.1 * z, n, sd)
    # boat + thief (+ their reflection)
    b, deck, wl, lan = st['boat']
    bx = boat_x(n)
    bob = 3.0 * math.sin(n * 0.11) + 1.5 * math.sin(n * 0.23 + 1)
    ang = 0.7 * math.sin(n * 0.09 + 0.5)
    pb = Mc @ np.array([bx, DOCK_Y + bob, 1.0])
    Mb = cv2.getRotationMatrix2D((b.shape[1] / 2, wl), ang, z)
    Mb[0, 2] += pb[0] - b.shape[1] / 2
    Mb[1, 2] += pb[1] - wl
    lan_s = Mb @ np.array([lan[0], lan[1] + 10, 1.0])
    tx, ty, sway, ripple, flare = thief_world(n)
    ppu = round(TS * z, 3)
    tpm, tglow, A, an = TH.render(n, dict(arm=TH.POSES['down'], sway=sway, ripple=ripple, flare=flare), ppu)
    U2S = np.array([[TS, 0, tx], [0, TS, ty], [0, 0, 1]], np.float64)
    Mt = (np.vstack([Mc, [0, 0, 1]]) @ U2S @ np.vstack([A, [0, 0, 1]]))[:2]
    on_boat = n < B.W_AAKE + 10
    lay = np.zeros_like(img)
    lay_a = np.zeros((H, W, 1), np.float32)
    TH.place(lay, tpm, np.zeros_like(tglow), Mt)
    wt, boxt = L.place_roi(img, tpm, Mt)
    if wt is not None:
        X0, Y0, X1, Y1 = boxt
        lay_a[Y0:Y1, X0:X1] = np.maximum(lay_a[Y0:Y1, X0:X1], np.clip(wt[..., 3:4], 0, 1))
    wb = cv2.warpAffine(b, Mb.astype(np.float32), (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
    if on_boat:
        lay = lay * (1 - wb[..., 3:4]) + wb[..., :3] * wb[..., 3:4]
        lay_a = np.clip(lay_a + wb[..., 3:4], 0, 1)
    else:
        lay = wb[..., :3] * wb[..., 3:4]
        lay_a = wb[..., 3:4].copy()
    yw = int(round(pb[1]))
    hgt = min(yw, H - yw, int(300 * z))
    if hgt > 10:
        src = lay[yw - hgt:yw][::-1]
        sra = lay_a[yw - hgt:yw][::-1, :, 0]
        rr = np.arange(hgt, dtype=np.float32)
        shift = (3.0 * z * np.sin(rr * 0.18 / z + n * 0.3)).astype(np.float32)
        mapx = (np.arange(W, dtype=np.float32)[None, :] + shift[:, None]).astype(np.float32)
        mapy = np.repeat(rr[:, None], W, axis=1).astype(np.float32)
        rs = cv2.remap(np.ascontiguousarray(src), mapx, mapy, cv2.INTER_LINEAR)
        ra = cv2.remap(np.ascontiguousarray(sra), mapx, mapy, cv2.INTER_LINEAR)[..., None]
        fadep = np.exp(-rr / (hgt * 0.35))[:, None, None] * 0.38
        img[yw:yw + hgt] = img[yw:yw + hgt] * (1 - ra * fadep) + rs * np.array([0.9, 0.7, 0.6], np.float32) * fadep * ra
    img[:] = img * (1 - lay_a) + lay
    TH.place(img, np.zeros_like(tpm), tglow * (1 + 0.6 * flare), Mt)
    if not on_boat:
        TH.place(img, tpm, np.zeros_like(tglow), Mt)
    fl = 1.0 + 1.2 * flare
    L.flame(img, lan_s[0], lan_s[1] + 6 * z, 15 * z * min(1.6, fl), n, seed=9, gain=min(1.6, fl))
    m = np.zeros((H, W), np.float32)
    cv2.circle(m, (int(lan_s[0]), int(lan_s[1])), max(2, int(6 * z)), 1.0, -1)
    L.add_glow(img, m, (0.05, 0.25, 0.65), 60 * z, 0.6 * fl)
    img *= L.paper(H, W, seed=13)
    return img


def render_frame(n):
    return render(n) * ease(n / 14.0)


if __name__ == '__main__':
    od = S + '/v4/look'
    os.makedirs(od, exist_ok=True)
    for n in [int(v) for v in sys.argv[1].split(',')]:
        cv2.imwrite(f'{od}/open_{n:04d}.jpg', L.u8(render_frame(n)), [cv2.IMWRITE_JPEG_QUALITY, 90])
        print('ok', n, flush=True)
