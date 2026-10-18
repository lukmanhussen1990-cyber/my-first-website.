"""v3 shots 1-2 (frames 0-281), laid out like the original: moon -> tilt down to the lake and the distant skyline
-> the boat glides in from the right with the thief standing -> dolly left, the riverside house slides in ->
the lantern flares on "चोर" -> the boat touches the steps on "आके" -> he steps off and walks up the steps."""
import os, sys, math, json
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(1, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "v2"))  # v2 helpers
import v2lib as L
import v3_beats as B

S = L.S
W, H = 1080, 1920
HSC = 3.6                                    # house plate scale (source px -> world px)
PX0, PX1, PY1 = 60, 600, 282                 # plate crop (source frame 0 of the Kerala video)
HOUSE_W = int((PX1 - PX0) * HSC)            # 1944
VER_Y = 1660                                 # world y of the verandah edge (plate bottom)
HOUSE_TOP = VER_Y - int(PY1 * HSC)
HORIZON = 1500
DOOR_X = (325 - PX0) * HSC                   # 954: world x of the front door
STEP_X0, STEP_X1 = int(DOOR_X - 150), int(DOOR_X + 150)   # ghat steps down to the water, in front of the door
WATER_Y = 1700                               # near bank water line
DOCK = (DOOR_X + 370, 1880)                  # boat centre / waterline when docked


def P(sx, sy):
    """Kerala-plate source px -> world px"""
    return (sx - PX0) * HSC, VER_Y - (PY1 - sy) * HSC


def screen_boat(n):
    """where the boat sits on screen (x): enters from the right, then the camera follows it"""
    return 1330 - 600 * B.ease((n - 60) / 85.0) + 20 * B.ease((n - 150) / 100.0)


def cam(n):
    """camera top-left (x0, y0) in world px: tilt down from the moon, then follow the boat to the steps"""
    t_tilt = B.ease((n - 6) / 66.0)
    y0 = 640 * t_tilt + 30 * B.ease((n - 72) / 200.0)
    nn = max(n, 60)
    x0 = boat_x(nn) - screen_boat(nn)
    if n > B.W_AAKE:
        x0 -= 90 * B.ease((n - B.W_AAKE) / 30.0)      # settle on the door as he walks up
    return x0, y0


# ------------------------------------------------------------------ static layers
_ST = None


def static():
    global _ST
    if _ST is not None:
        return _ST
    p = cv2.imread(S + '/v2/plates_raw/p_0.0.png')
    crop = p[0:PY1, PX0:PX1]
    sm = L.sky_mask(p)[0:PY1, PX0:PX1].astype(np.float32)
    U = L.f32(L.up(crop, HSC))
    N = L.night(U, exposure=1.08, sat=0.55)
    lum = U.mean(axis=2, keepdims=True)
    N = N + np.clip((lum - 0.62) / 0.25, 0, 1) * np.array([0.10, 0.07, 0.06], np.float32)[None, None]
    A = 1 - cv2.resize(sm, (U.shape[1], U.shape[0]), interpolation=cv2.INTER_LINEAR)
    A = cv2.GaussianBlur(A, (0, 0), 2.0)
    edge = np.clip((U.shape[1] - np.arange(U.shape[1], dtype=np.float32)) / 260.0, 0, 1) ** 1.5
    A = A * edge[None, :]
    # warm windows + door light
    Hh, Ww = N.shape[:2]
    win = np.zeros((Hh, Ww), np.float32)
    for (sx, sy, sw, sh) in ((117, 248, 22, 10), (205, 248, 22, 10), (443, 248, 22, 10), (333, 105, 22, 9)):
        cx, cy = (sx - PX0) * HSC, sy * HSC
        cv2.rectangle(win, (int(cx - sw * HSC / 2), int(cy - sh * HSC / 2)), (int(cx + sw * HSC / 2), int(cy + sh * HSC / 2)), 1.0, -1)
    bars = (U.mean(axis=2) < 0.35).astype(np.float32)
    reg = win * (1 - 0.8 * bars)
    N = N * (1 - reg[..., None]) + reg[..., None] * np.array([0.25, 0.62, 1.0], np.float32)
    dx = (325 - PX0) * HSC
    cv2.line(N, (int(dx), int(214 * HSC)), (int(dx), int(270 * HSC)), (0.25, 0.62, 1.0), 3)
    cv2.line(N, (int((301 - PX0) * HSC), int(270 * HSC)), (int((349 - PX0) * HSC), int(270 * HSC)), (0.25, 0.62, 1.0), 3)
    glowm = win.copy()
    cv2.line(glowm, (int(dx), int(214 * HSC)), (int(dx), int(270 * HSC)), 1.0, 3)
    glow = L.blur(glowm, 14) * 1.2 + L.blur(glowm, 60) * 1.0
    N = N + glow[..., None] * np.array([0.05, 0.22, 0.60], np.float32)
    # stone ledge + steps (world coords relative to the house layer origin)
    ext = 200
    layer = np.zeros((Hh + ext, Ww + 40, 3), np.float32)
    la = np.zeros((Hh + ext, Ww + 40), np.float32)
    layer[:Hh, :Ww] = N
    la[:Hh, :Ww] = A
    stone = np.array([0.27, 0.22, 0.22], np.float32)
    edge = (0.09, 0.06, 0.06)
    ly = Hh
    cv2.rectangle(layer, (0, ly - 6), (Ww, ly + 40), tuple(float(v) for v in stone * 0.85), -1)
    cv2.rectangle(la, (0, ly - 6), (Ww, ly + 40), 1.0, -1)
    rng = np.random.default_rng(2)
    x = 0
    while x < Ww:
        w_ = int(rng.integers(80, 130))
        cv2.rectangle(layer, (x, ly - 6), (x + w_, ly + 40), edge, 2, cv2.LINE_AA)
        x += w_
    cv2.line(layer, (0, ly - 6), (Ww, ly - 6), (0.40, 0.35, 0.34), 2, cv2.LINE_AA)
    for k in range(5):
        y0 = ly + 40 + k * 28
        xa = STEP_X0 - k * 26
        cv2.rectangle(layer, (xa, y0), (STEP_X1 + k * 14, y0 + 28), tuple(float(v) for v in stone * (0.95 - 0.08 * k)), -1)
        cv2.rectangle(la, (xa, y0), (STEP_X1 + k * 14, y0 + 28), 1.0, -1)
        cv2.line(layer, (xa, y0), (STEP_X1 + k * 14, y0), (0.42, 0.37, 0.36), 2, cv2.LINE_AA)
        cv2.rectangle(layer, (xa, y0), (STEP_X1 + k * 14, y0 + 28), edge, 2, cv2.LINE_AA)
    fade = np.clip(1 - (np.arange(Hh + ext, dtype=np.float32) - (ly + 40 + 3 * 28)) / 70.0, 0.3, 1)[:, None]
    la *= fade
    _ST = dict(house=layer, house_a=np.clip(la, 0, 1), origin=(0, HOUSE_TOP))
    # distant skyline (temples, palms, houses) as a silhouette strip
    sk = np.zeros((220, 4200), np.float32)
    rng = np.random.default_rng(5)
    x = 0
    while x < 4200:
        kind = rng.random()
        if kind < 0.35:
            L.palm_tree(sk, x, 214, rng.uniform(70, 120), rng.uniform(-0.15, 0.15), 1.0, seed=int(rng.integers(0, 999)))
            x += int(rng.uniform(25, 60))
        elif kind < 0.5:
            bw, bh = rng.uniform(80, 130), rng.uniform(30, 48)
            pts = np.array([(x, 214), (x, 214 - bh), (x + bw * 0.15, 214 - bh - 26), (x + bw * 0.85, 214 - bh - 26), (x + bw, 214 - bh), (x + bw, 214)])
            cv2.fillPoly(sk, [pts.astype(np.int32)], 1.0, cv2.LINE_AA)                 # Kerala temple with tiled roof
            cv2.fillPoly(sk, [np.array([(x + bw * 0.35, 214 - bh - 26), (x + bw * 0.5, 214 - bh - 52), (x + bw * 0.65, 214 - bh - 26)]).astype(np.int32)], 1.0, cv2.LINE_AA)
            x += int(bw + rng.uniform(20, 60))
        elif kind < 0.58:
            cv2.rectangle(sk, (int(x), 214 - int(rng.uniform(70, 110))), (int(x + 8), 214), 1.0, -1)    # lamp tower
            x += int(rng.uniform(30, 60))
        else:
            bw, bh = rng.uniform(40, 90), rng.uniform(16, 34)
            cv2.rectangle(sk, (int(x), int(214 - bh)), (int(x + bw), 214), 1.0, -1)
            cv2.fillPoly(sk, [np.array([(x - 6, 214 - bh), (x + bw / 2, 214 - bh - 16), (x + bw + 6, 214 - bh)]).astype(np.int32)], 1.0, cv2.LINE_AA)
            x += int(bw + rng.uniform(10, 50))
    _ST['skyline'] = cv2.GaussianBlur(sk, (0, 0), 0.8)
    b, deck, wl, lan, _ = L.boat_sprite(Lb=430)
    _ST['boat'] = (b, deck, wl, lan)
    idle = np.load(S + '/assets/v2char/idle.npz')['rgba']
    al = idle[..., 3].max(axis=0) > 60
    ys, xs = np.where(al)
    _ST['idle'] = (idle, dict(bot=float(ys.max()), h=float(ys.max() - ys.min()), cx=float(np.median(xs[ys > ys.max() - 40]))))
    return _ST


STARS = L.Stars(W, H, 1300, seed=11)
DIYAS = [(2050, 1990, 1.0, 0), (2350, 2150, 1.3, 1), (2700, 1880, 0.8, 2), (1500, 2120, 1.25, 3), (900, 2050, 1.15, 4),
         (2950, 2080, 1.2, 5), (300, 1990, 1.0, 6), (1200, 1900, 0.85, 7)]


def boat_x(n):
    t = float(np.clip((n - 60) / (B.W_AAKE - 60), 0, 1))
    k = 1 - (1 - t) ** 2.0
    return 3400 + (DOCK[0] - 3400) * k


def water_rows(Hs, x0, n, base=(0.25, 0.10, 0.06), line=(0.48, 0.29, 0.21), moon_x=None, scale=1.0):
    """Seigaiha water rows for a strip of height Hs (top = far), drifting with the camera x (near rows full parallax)."""
    img = np.zeros((Hs, W, 3), np.float32) + np.array(base, np.float32)
    y = -4.0
    row = 0
    base_c = tuple(float(v) for v in base)
    while y < Hs + 10:
        t = np.clip(y / max(1.0, Hs), 0, 1)
        r = (10 + 92 * t ** 1.25) * scale
        ry = r * 0.42
        step = 2 * r
        par = 0.18 + 0.82 * t
        drift = (-x0 * par + n * 0.35 * (0.5 + t) * (1 if row % 2 else -1)) % step
        x = -step + (row % 2) * r + drift
        th = max(1, int(round(0.8 + 2.0 * t)))
        lc = np.array(line, np.float32) * (0.82 + 0.18 * t)
        while x < W + step:
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


def thief_layer(img, n, x0, y0, bx, by):
    """The thief standing in the boat (or stepping off and walking up the steps); returns lantern screen pos."""
    st = static()
    idle, g = st['idle']
    reveal = B.ease((n - B.W_CHOR + 2) / 6.0)
    hgt = 205.0
    i = (n // 3) % (2 * len(idle) - 2)
    i = i if i < len(idle) else 2 * len(idle) - 2 - i
    s = hgt / g['h']
    # position: in the boat until docked, then a small step onto the stair and a waddle up-left
    if n < B.W_AAKE + 8:
        fx, fy = bx + 20, by - 26
        bob = 0.0
        rot = 0.0
    else:
        # walk along the boat to its bow at the bottom step, then up the ghat steps toward the door
        k = n - B.W_AAKE - 8
        pts = [(bx + 20, by - 26), (STEP_X1 + 10, by - 34), (DOOR_X + 90, VER_Y + 120)]
        segs = [12.0, 60.0]
        if k < segs[0]:
            t = k / segs[0]
            (xa, ya), (xb, yb) = pts[0], pts[1]
        else:
            t = min(1.0, (k - segs[0]) / segs[1])
            (xa, ya), (xb, yb) = pts[1], pts[2]
        fx, fy = xa + (xb - xa) * t, ya + (yb - ya) * t
        moving = k < sum(segs)
        step = math.sin(k / 4.5 * math.pi)
        bob = abs(step) * 8 * moving
        rot = 3.0 * step * moving
    sx, sy = fx - x0, fy - y0 - bob
    M = cv2.getRotationMatrix2D((g['cx'], g['bot']), rot, s)
    M[0, 2] += sx - g['cx']
    M[1, 2] += sy - g['bot']
    dim = 1 - reveal
    pm = L.lit_sprite(idle[i], exposure=1.05 + 0.45 * reveal, sat=0.75 + 0.25 * reveal,
                      warm=((0.02, 0.10, 0.22), 0.25 + 1.1 * reveal),
                      rims=[(4, -3, (0.55, 0.45, 0.42), 0.7), (3, 0, (0.10, 0.40, 0.90), 0.9 * reveal)])
    wpm, box = L.place_roi(img, pm, M)
    if wpm is not None:
        X0, Y0, X1, Y1 = box
        a = np.clip(wpm[..., 3:4], 0, 1)
        img[Y0:Y1, X0:X1] = img[Y0:Y1, X0:X1] * (1 - a) + wpm[..., :3]
    return wpm, box


def render(n):
    st = static()
    x0, y0 = cam(n)
    img = np.zeros((H, W, 3), np.float32)
    # sky (fixed horizontally: very far), tilts with the camera
    hz = int(round(HORIZON - y0))
    sky = L.night_sky(H, W, max(10, hz), top=(0.11, 0.03, 0.025), mid=(0.24, 0.08, 0.065), hor=(0.36, 0.17, 0.16))
    img[:] = sky
    img += STARS.render(H, W, n, dy=-y0 * 0.5) * np.clip((hz - np.arange(H, dtype=np.float32))[:, None, None] / 200.0, 0, 1)
    mx, my = 790.0, 760.0 - y0
    L.moon(img, mx, my, 50, glow=0.95)
    # skyline (slight parallax)
    sk = st['skyline']
    xo = int(x0 * 0.15) % 3000
    strip = sk[:, xo:xo + W]
    ys = int(hz - 214)
    y_a, y_b = max(0, ys), min(H, ys + sk.shape[0])
    if y_b > y_a:
        a = strip[y_a - ys:y_b - ys, :, None]
        img[y_a:y_b] = img[y_a:y_b] * (1 - a) + a * np.array([0.10, 0.035, 0.035], np.float32)
    # lake
    if hz < H:
        wat = water_rows(H - max(0, hz), x0, n, moon_x=mx)
        img[max(0, hz):] = wat[max(0, -hz):]
        # moon reflection column
        col = np.zeros((H, W), np.float32)
        cv2.line(col, (int(mx), max(0, hz)), (int(mx), H), 1.0, 26)
        img += (L.blur(col, 18) * np.clip((np.arange(H, dtype=np.float32)[:, None] - hz) / 400.0, 0, 1) * 0.10)[..., None] * np.array([0.9, 0.8, 0.7], np.float32)
    # house layer (full parallax)
    hx, hy = int(round(st['origin'][0] - x0)), int(round(st['origin'][1] - y0))
    hl, ha = st['house'], st['house_a']
    X0, Y0 = int(max(0, hx)), int(max(0, hy))
    X1, Y1 = int(min(W, hx + hl.shape[1])), int(min(H, hy + hl.shape[0]))
    if X1 > X0 and Y1 > Y0:
        sl = (slice(Y0 - int(hy), Y1 - int(hy)), slice(X0 - int(hx), X1 - int(hx)))
        a = ha[sl][..., None]
        img[Y0:Y1, X0:X1] = img[Y0:Y1, X0:X1] * (1 - a) + hl[sl] * a
        # tulsi lamp at the house front
    # diyas drifting on the water
    for (wx, wy, s_, sd) in DIYAS:
        x = wx - x0 - n * 0.3 * s_
        y = wy - y0 + 2 * math.sin(n * 0.08 + sd)
        if y > hz + 10:
            L.diya(img, x, y, s_ * 1.1, n, sd)
    # boat + thief
    bx = boat_x(n)
    if bx - x0 < W + 400:
        b, deck, wl, lan = st['boat']
        bob = 3.0 * math.sin(n * 0.11) + 1.5 * math.sin(n * 0.23 + 1)
        by = DOCK[1] + (0 if n > B.W_AAKE else 0) + bob
        ang = 0.7 * math.sin(n * 0.09 + 0.5)
        sxb, syb = bx - x0, by - y0
        Mb = cv2.getRotationMatrix2D((b.shape[1] / 2, wl), ang, 1.0)
        Mb[0, 2] += sxb - b.shape[1] / 2
        Mb[1, 2] += syb - wl
        lan_s = Mb @ np.array([lan[0], lan[1] + 10, 1.0])
        # reflection of the boat + man (simple: mirrored, rippled, dim)
        tmp = np.zeros_like(img)
        tma = np.zeros((H, W, 1), np.float32)
        thief_layer(tmp, n, x0, y0, bx, DOCK[1])
        wb = cv2.warpAffine(b, Mb.astype(np.float32), (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
        tma = np.clip(np.max(tmp, axis=2, keepdims=True) * 4, 0, 1)
        lay = tmp * (1 - wb[..., 3:4]) + wb[..., :3] * wb[..., 3:4]
        lay_a = np.clip(tma + wb[..., 3:4], 0, 1)
        yw = int(round(syb))
        hgt = min(yw, H - yw, 420)
        if hgt > 10 and n < B.W_AAKE + 14:
            src = lay[yw - hgt:yw][::-1]
            sra = lay_a[yw - hgt:yw][::-1, :, 0]
            rr = np.arange(hgt, dtype=np.float32)
            shift = (3.0 * np.sin(rr * 0.18 + n * 0.3)).astype(np.float32)
            mapx = (np.arange(W, dtype=np.float32)[None, :] + shift[:, None]).astype(np.float32)
            mapy = np.repeat(rr[:, None], W, axis=1).astype(np.float32)
            rs = cv2.remap(np.ascontiguousarray(src), mapx, mapy, cv2.INTER_LINEAR)
            ra = cv2.remap(np.ascontiguousarray(sra), mapx, mapy, cv2.INTER_LINEAR)[..., None]
            fadep = np.exp(-rr / (hgt * 0.35))[:, None, None] * 0.35
            img[yw:yw + hgt] = img[yw:yw + hgt] * (1 - ra * fadep) + rs * np.array([0.9, 0.7, 0.6], np.float32) * fadep * ra
        if n < B.W_AAKE + 10:
            img[:] = img * (1 - lay_a) + lay
        else:
            img[:] = img * (1 - wb[..., 3:4]) + wb[..., :3] * wb[..., 3:4]
            thief_layer(img, n, x0, y0, bx, DOCK[1])
        # lantern: flares on "चोर"
        flare = 1.0 + 1.6 * math.exp(-max(0, n - B.W_CHOR) / 10.0) * (1 if n >= B.W_CHOR - 1 else 0) + 0.5 * B.ease((n - B.W_CHOR) / 8.0)
        L.flame(img, lan_s[0], lan_s[1] + 6, 15 * min(1.6, flare), n, seed=9, gain=min(1.6, flare))
        m = np.zeros((H, W), np.float32)
        cv2.circle(m, (int(lan_s[0]), int(lan_s[1])), 6, 1.0, -1)
        L.add_glow(img, m, (0.05, 0.25, 0.65), 60, 0.6 * flare)
    img *= L.paper(H, W, seed=13)
    return img


_MET = None


def fade_gain(n):
    global _MET
    if _MET is None:
        _MET = [(r['b'] + r['g'] + r['r']) / 3.0 for r in json.load(open(S + '/frames/A_metrics.json'))]
    return float(np.clip(_MET[n] / _MET[60], 0, 1)) if n < 60 else 1.0


def render_frame(n):
    return render(n) * fade_gain(n)


if __name__ == '__main__':
    od = S + '/v3/look'
    os.makedirs(od, exist_ok=True)
    for n in [int(v) for v in sys.argv[1].split(',')]:
        cv2.imwrite(f'{od}/open_{n:04d}.jpg', L.u8(render_frame(n)), [cv2.IMWRITE_JPEG_QUALITY, 90])
        print('ok', n, flush=True)
