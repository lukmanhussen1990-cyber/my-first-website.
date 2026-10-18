"""Shared painting/lighting library for the all-new Kerala-style 'Chor' film (1080x1920)."""
import os, math
import numpy as np, cv2

S = os.environ.get('CHOR_S', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OW, OH = 1080, 1920
BSRC = S + '/src/B_character.mp4'


# ------------------------------------------------------------------ io / scaling
def bframe(t=None, n=None):
    """Frame of the Kerala video by time (s) or index (25 fps)."""
    cap = cv2.VideoCapture(BSRC)
    if n is None:
        n = int(round(t * 25))
    cap.set(cv2.CAP_PROP_POS_FRAMES, n)
    ok, f = cap.read()
    return f


def up(img, f):
    """Painterly upscale: Lanczos + gentle unsharp (keeps the hand-painted texture)."""
    u = cv2.resize(img, None, fx=f, fy=f, interpolation=cv2.INTER_LANCZOS4)
    bl = cv2.GaussianBlur(u, (0, 0), 0.55 * f)
    return cv2.addWeighted(u, 1.55, bl, -0.55, 0)


def f32(img):
    return img.astype(np.float32) / 255.0


def u8(img):
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


# ------------------------------------------------------------------ night grade
def sky_mask(img_u8):
    """Teal painted sky (Kerala video) connected to the top edge."""
    hsv = cv2.cvtColor(img_u8, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0].astype(np.int32), hsv[..., 1].astype(np.int32), hsv[..., 2].astype(np.int32)
    cand = ((h >= 30) & (h <= 75) & (s < 115) & (v > 105)).astype(np.uint8)
    cand = cv2.morphologyEx(cand, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(cand, 4)
    keep = np.zeros_like(cand)
    for k in range(1, n):
        if st[k, cv2.CC_STAT_TOP] <= 2 and st[k, cv2.CC_STAT_AREA] > 200:
            keep[lab == k] = 1
    return keep


def night(img, exposure=1.0, sat=0.5, lift=1.0):
    """Moonlit day-for-night grade of painted art (float BGR in/out)."""
    L = img.mean(axis=2, keepdims=True)
    x = L + (img - L) * sat
    x = np.power(np.clip(x, 0, 1), 1.18) * 0.58 * exposure
    x = x * np.array([1.0, 0.70, 0.56], np.float32)[None, None]          # cool moonlight cast (BGR)
    x = x + np.array([0.040, 0.018, 0.010], np.float32)[None, None] * lift  # navy ambient in the shadows
    return x


def night_sky(H, W, y_horizon, top=(0.115, 0.035, 0.030), mid=(0.230, 0.085, 0.070), hor=(0.330, 0.170, 0.160)):
    """Vertical night-sky gradient (BGR) reaching `hor` at y_horizon."""
    y = np.arange(H, dtype=np.float32)[:, None, None]
    t = np.clip(y / max(1.0, y_horizon), 0, 1)
    top, mid, hor = (np.array(c, np.float32)[None, None] for c in (top, mid, hor))
    a = np.clip(t * 2, 0, 1)
    b = np.clip(t * 2 - 1, 0, 1)
    g = top * (1 - a) + mid * a
    g = g * (1 - b) + hor * b
    return np.repeat(g, W, axis=1)


_PAPER = {}


def paper(H, W, seed=3):
    """Subtle paper/canvas grain like the Kerala video's painted skies (multiplicative, ~1.0)."""
    key = (H, W, seed)
    if key not in _PAPER:
        rng = np.random.default_rng(seed)
        n1 = cv2.resize(rng.standard_normal((H // 24 + 2, W // 24 + 2)).astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
        n2 = cv2.resize(rng.standard_normal((H // 5 + 2, W // 5 + 2)).astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
        n3 = rng.standard_normal((H, W)).astype(np.float32)
        _PAPER[key] = (1 + 0.035 * n1 + 0.025 * n2 + 0.012 * cv2.GaussianBlur(n3, (0, 0), 0.7))[..., None]
    return _PAPER[key]


# ------------------------------------------------------------------ sky elements
class Stars:
    def __init__(self, W, H, n, seed=1):
        rng = np.random.default_rng(seed)
        self.x = rng.uniform(0, W, n).astype(np.float32)
        self.y = rng.uniform(0, H, n).astype(np.float32)
        self.a = np.clip(rng.lognormal(math.log(0.30), 0.6, n), 0.05, 1.3).astype(np.float32)
        self.ph = rng.uniform(0, 6.283, n).astype(np.float32)
        self.sp = rng.uniform(0.04, 0.12, n).astype(np.float32)
        self.big = rng.random(n) < 0.035

    def render(self, H, W, n_frame, dx=0.0, dy=0.0, gain=1.0):
        img = np.zeros((H, W), np.float32)
        x = self.x + dx
        y = self.y + dy
        ok = (x >= 1) & (x < W - 2) & (y >= 1) & (y < H - 2)
        tw = 0.78 + 0.22 * np.sin(self.ph + n_frame * self.sp)
        v = (self.a * tw * gain)[ok]
        xi, yi = x[ok].astype(np.int32), y[ok].astype(np.int32)
        np.add.at(img, (yi, xi), v)
        img = cv2.GaussianBlur(img, (0, 0), 0.9) * 4.0
        big = self.big & ok
        if big.any():
            sp = np.zeros_like(img)
            np.add.at(sp, (y[big].astype(np.int32), x[big].astype(np.int32)), (self.a * tw * gain)[big] * 3)
            sp = cv2.GaussianBlur(sp, (0, 0), 1.6) * 6
            # four-point twinkle cross, like the painted stars
            k = np.zeros((21, 21), np.float32)
            k[10, :] = np.exp(-np.abs(np.arange(21) - 10) / 3.0)
            k[:, 10] = np.maximum(k[:, 10], np.exp(-np.abs(np.arange(21) - 10) / 3.0))
            img += cv2.filter2D(sp, -1, k / k.sum() * 3)
        return np.dstack([img, img * 0.94, img * 0.90])


def moon(canvas, cx, cy, r, glow=1.0):
    """Painted full moon with soft maria and a wide halo (additive / over)."""
    H, W = canvas.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    halo = (0.55 * np.exp(-np.maximum(d - r, 0) / (0.35 * r)) + 0.22 * np.exp(-np.maximum(d - r, 0) / (1.6 * r))
            + 0.08 * np.exp(-np.maximum(d - r, 0) / (5 * r))) * glow
    canvas += halo[..., None] * np.array([0.95, 0.88, 0.80], np.float32)[None, None]
    disk = np.clip((r - d) / 1.5, 0, 1)
    rng = np.random.default_rng(7)
    tex = np.zeros((H, W), np.float32)
    for _ in range(9):
        a, rr = rng.uniform(0, 6.28), rng.uniform(0.1, 0.7) * r
        mx, my = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        tex += np.exp(-(((xx - mx) ** 2 + (yy - my) ** 2) / (2 * (rng.uniform(0.12, 0.3) * r) ** 2))) * rng.uniform(0.05, 0.12)
    col = np.array([0.93, 0.97, 1.0], np.float32)[None, None] * (1 - np.clip(tex, 0, 0.25))[..., None]
    col = col * np.array([1.0, 0.98, 0.95], np.float32)
    canvas[:] = canvas * (1 - disk[..., None]) + col * disk[..., None]
    return canvas


# ------------------------------------------------------------------ light helpers
def radial(H, W, cx, cy, sx, sy=None):
    sy = sx if sy is None else sy
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    return np.exp(-(((xx - cx) / sx) ** 2 + ((yy - cy) / sy) ** 2))


def blur(img, sigma):
    """Gaussian blur; large sigmas are computed at reduced resolution (same look, far faster)."""
    img = img.astype(np.float32)
    if sigma <= 6:
        return cv2.GaussianBlur(img, (0, 0), sigma)
    f = min(16.0, sigma / 3.0)
    h, w = img.shape[:2]
    sm = cv2.resize(img, (max(1, int(w / f)), max(1, int(h / f))), interpolation=cv2.INTER_AREA)
    sm = cv2.GaussianBlur(sm, (0, 0), sigma / f)
    return cv2.resize(sm, (w, h), interpolation=cv2.INTER_LINEAR)


def add_glow(canvas, mask, color, sigma, gain=1.0):
    g = blur(mask, sigma) * gain
    canvas += g[..., None] * np.array(color, np.float32)[None, None]
    return canvas


def warm_light(canvas, falloff, color=(0.35, 0.62, 1.0), strength=1.0):
    """Multiply-and-add warm lamp light (lights surfaces, BGR colour)."""
    c = np.array(color, np.float32)[None, None]
    canvas[:] = canvas * (1 + falloff[..., None] * c * 1.6 * strength) + falloff[..., None] * c * 0.05 * strength
    return canvas


def flame(canvas, cx, cy, h, n_frame, seed=0, gain=1.0, width=0.28):
    """Small oil-lamp flame with flicker and glow."""
    H, W = canvas.shape[:2]
    rng = np.random.default_rng(seed)
    fl = 1 + 0.12 * math.sin(n_frame * 0.9 + seed) + 0.06 * math.sin(n_frame * 2.3 + 2 * seed)
    hh = h * fl
    pts = []
    for k in range(25):
        t = k / 24
        w = math.sin(t * math.pi) ** 0.55 * (1 - t) ** 0.6 * h * width
        pts.append((cx - w, cy - t * hh))
    for k in range(24, -1, -1):
        t = k / 24
        w = math.sin(t * math.pi) ** 0.55 * (1 - t) ** 0.6 * h * width
        pts.append((cx + w, cy - t * hh))
    R = int(h * 4) + 4
    X0, Y0 = max(0, int(cx) - R), max(0, int(cy - hh) - R)
    X1, Y1 = min(W, int(cx) + R), min(H, int(cy) + R)
    if X1 <= X0 or Y1 <= Y0:
        return canvas
    sub = canvas[Y0:Y1, X0:X1]
    m = np.zeros(sub.shape[:2], np.float32)
    cv2.fillPoly(m, [(np.array(pts) - np.array([X0, Y0])).astype(np.int32)], 1.0, cv2.LINE_AA)
    core = cv2.GaussianBlur(m, (0, 0), max(0.8, h * 0.06))
    sub[:] = sub * (1 - core[..., None]) + core[..., None] * np.array([0.55, 0.88, 1.0], np.float32) * gain
    add_glow(sub, m, (0.10, 0.45, 1.0), h * 0.9, 0.9 * gain * fl)
    add_glow(sub, m, (0.05, 0.25, 0.75), h * 2.6, 0.5 * gain * fl)
    return canvas


# ------------------------------------------------------------------ painted water (Kerala-video seigaiha waves)
def water(H, W, n_frame, base=(0.27, 0.105, 0.065), line=(0.50, 0.30, 0.22), moon_x=None, seed=4, speed=0.35):
    """Overlapping rows of seigaiha wave scales (3 nested arcs each) like the Kerala video's sea, in night
    colours, with perspective (small rows far, big rows near) and a moon glint band."""
    img = np.zeros((H, W, 3), np.float32) + np.array(base, np.float32)
    rng = np.random.default_rng(seed)
    y = -6.0
    row = 0
    base_c = tuple(float(v) for v in base)
    while y < H + 10:
        t = np.clip(y / max(1.0, H), 0, 1)
        r = 14 + 95 * t ** 1.2                               # scale radius grows toward the viewer
        step = 2 * r
        drift = (n_frame * speed * (0.5 + t) * (1 if row % 2 else -1)) % step
        x = -step + (row % 2) * r + drift
        th = max(1, int(round(0.8 + 2.0 * t)))
        shade = 0.82 + 0.18 * t
        lc = np.array(line, np.float32) * shade
        while x < W + step:
            ry = r * 0.42
            cx, cy = int(round(x)), int(round(y + ry))
            cv2.ellipse(img, (cx, cy), (int(r), int(ry)), 0, 180, 360, base_c, -1, cv2.LINE_AA)
            for k, fr in enumerate((1.0, 0.72, 0.44)):
                g = 1.0 - 0.18 * k
                if moon_x is not None:
                    g += 1.1 * math.exp(-((x - moon_x) / (55 + 90 * t)) ** 2) * (0.6 + 0.4 * rng.random())
                cv2.ellipse(img, (cx, cy), (max(1, int(r * fr)), max(1, int(ry * fr))), 0, 180, 360,
                            tuple(float(v) for v in lc * g), th, cv2.LINE_AA)
            x += step
        y += r * 0.42 * 0.62
        row += 1
    return img


# ------------------------------------------------------------------ props
def boat_sprite(Lb=540, seed=0):
    """Kerala country boat (vallam), side view, prow to the LEFT. Returns (rgba float, deck_y, waterline_y,
    lantern_xy) in sprite coords. Painted flat with outlines like the Kerala video."""
    pad = 40
    Wb, Hb = Lb + 2 * pad, 260
    img = np.zeros((Hb, Wb, 3), np.float32)
    a = np.zeros((Hb, Wb), np.float32)
    cx, base = Wb / 2, 170.0
    us = np.linspace(-1, 1, 160)
    def top(u):    # gunwale: rises at both ends, more at the prow (u<0)
        rise = (100 if u < 0 else 70) * max(0.0, abs(u) - 0.55) ** 2 / 0.45 ** 2
        return base - 22 - rise
    def bot(u):
        w = max(0.0, (abs(u) - 0.55) / 0.45) ** 1.5
        return (base + 34 * max(0.0, 1 - u * u) ** 0.65) * (1 - w) + (top(u) + 3) * w
    T = [(cx + u * Lb / 2, top(u)) for u in us]
    B = [(cx + u * Lb / 2, bot(u)) for u in us[::-1]]
    poly = np.array(T + B, np.float32)
    SH = 4
    P = (poly * (1 << SH)).astype(np.int32)
    hull = np.zeros((Hb, Wb), np.float32)
    cv2.fillPoly(hull, [P], 1.0, cv2.LINE_AA, SH)
    wood = np.array([0.070, 0.095, 0.135], np.float32)
    img += hull[..., None] * wood
    rng = np.random.default_rng(seed)
    grain = cv2.GaussianBlur(rng.standard_normal((Hb, Wb)).astype(np.float32), (0, 0), 1.2)
    img *= (1 + 0.10 * grain[..., None])
    # inner (visible) side of the far gunwale: darker band along the top
    inner = [(cx + u * Lb / 2, top(u) + 1) for u in us] + [(cx + u * Lb / 2, top(u) + 12 * (1 - abs(u))) for u in us[::-1]]
    cv2.fillPoly(img, [(np.array(inner) * (1 << SH)).astype(np.int32)], (0.035, 0.035, 0.05), cv2.LINE_AA, SH)
    # plank lines
    for k, off in enumerate((12, 22)):
        pts = [(cx + u * Lb / 2, top(u) + off + 6 * (1 - abs(u))) for u in np.linspace(-0.93, 0.93, 120)]
        cv2.polylines(img, [(np.array(pts) * (1 << SH)).astype(np.int32)], False, (0.045, 0.05, 0.07), 2, cv2.LINE_AA, SH)
    # gunwale stripe (moonlit) and outline
    g = [(cx + u * Lb / 2, top(u)) for u in us]
    cv2.polylines(img, [(np.array(g) * (1 << SH)).astype(np.int32)], False, (0.30, 0.26, 0.27), 4, cv2.LINE_AA, SH)
    cv2.polylines(img, [P], True, (0.02, 0.02, 0.03), 3, cv2.LINE_AA, SH)
    a = np.maximum(hull, cv2.dilate(hull, np.ones((3, 3), np.uint8)) * 0.98)
    # lantern pole at the stern (right end)
    px = cx + 0.80 * Lb / 2
    cv2.line(img, (int(px), int(top(0.8)) + 4), (int(px - 6), 12), (0.10, 0.10, 0.12), 4, cv2.LINE_AA)
    cv2.line(a, (int(px), int(top(0.8)) + 4), (int(px - 6), 12), 1.0, 4, cv2.LINE_AA)
    lantern = (px - 6, 30)
    cv2.line(img, (int(px - 6), 12), (int(px - 6), 22), (0.12, 0.12, 0.14), 2, cv2.LINE_AA)
    cv2.line(a, (int(px - 6), 12), (int(px - 6), 22), 1.0, 2, cv2.LINE_AA)
    cv2.rectangle(img, (int(px - 15), 22), (int(px + 3), 44), (0.10, 0.10, 0.12), 2, cv2.LINE_AA)
    cv2.rectangle(a, (int(px - 15), 22), (int(px + 3), 44), 1.0, -1)
    cv2.rectangle(img, (int(px - 13), 24), (int(px + 1), 42), (0.30, 0.75, 1.0), -1)
    deck_y = base - 6
    waterline = base + 14
    return np.dstack([img, np.clip(a, 0, 1)]), deck_y, waterline, lantern, (int(px - 15), 22, int(px + 3), 44)


def diya(canvas, x, y, s, n_frame, seed):
    """Floating clay lamp (diya) with a teardrop flame, glow and a short reflection - drawn locally."""
    H, W = canvas.shape[:2]
    R = int(90 * s)
    x0, y0, x1, y1 = int(x) - R, int(y) - R, int(x) + R, int(y) + R
    if x1 <= 0 or y1 <= 0 or x0 >= W or y0 >= H:
        return canvas
    cx0, cy0, cx1, cy1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    roi = canvas[cy0:cy1, cx0:cx1]
    lx, ly = x - cx0, y - cy0
    # reflection streak
    refl = np.zeros(roi.shape[:2], np.float32)
    cv2.line(refl, (int(lx), int(ly + 8 * s)), (int(lx), int(ly + 55 * s)), 1.0, max(1, int(5 * s)))
    roi += cv2.GaussianBlur(refl, (0, 0), 2.5 * s)[..., None] * np.array([0.04, 0.22, 0.55], np.float32) * 0.7
    # clay bowl: dark body, lit rim
    cv2.ellipse(roi, (int(lx), int(ly)), (int(17 * s), int(9 * s)), 0, 0, 180, (0.04, 0.09, 0.22), -1, cv2.LINE_AA)
    cv2.ellipse(roi, (int(lx), int(ly)), (int(17 * s), int(4 * s)), 0, 0, 360, (0.10, 0.30, 0.62), -1, cv2.LINE_AA)
    cv2.ellipse(roi, (int(lx), int(ly)), (int(17 * s), int(4 * s)), 0, 0, 360, (0.03, 0.06, 0.14), 1, cv2.LINE_AA)
    flame(roi, lx, ly - 1 * s, 15 * s, n_frame, seed=seed, gain=1.0, width=0.5)
    return canvas


def lit_sprite(rgba, exposure=1.3, sat=0.75, rims=(), lift=0.6, warm=None):
    """Night-grade a natural-colour character sprite (uint8 or float RGBA) and add rim lights.
    rims: (dx, dy, BGR colour, strength) - light arriving from direction (dx, dy).
    warm: optional (BGR colour, strength) uniform warm fill (lamp light)."""
    s = rgba.astype(np.float32) / (255.0 if rgba.dtype == np.uint8 else 1.0)
    rgb, a = s[..., :3], s[..., 3]
    out = night(rgb, exposure=exposure, sat=sat, lift=lift)
    if warm is not None:
        col, k = warm
        out = out * (1 + np.array(col, np.float32)[None, None] * k) + rgb * np.array(col, np.float32)[None, None] * 0.12 * k
    for dx, dy, col, k in rims:
        sh = np.roll(np.roll(a, -int(round(dy)), axis=0), -int(round(dx)), axis=1)
        r = np.clip(a - sh, 0, 1)
        r = cv2.GaussianBlur(r, (0, 0), 1.5)
        out = out + (r * k)[..., None] * np.array(col, np.float32)[None, None] * a[..., None]
    return np.dstack([out * a[..., None], a])           # premultiplied


def place(canvas, pm, M, flags=cv2.INTER_LINEAR):
    """Composite a premultiplied RGBA layer onto canvas with 2x3 affine M."""
    H, W = canvas.shape[:2]
    w = cv2.warpAffine(pm, np.asarray(M, np.float32), (W, H), flags=flags, borderValue=0)
    a = np.clip(w[..., 3:4], 0, 1)
    canvas[:] = canvas * (1 - a) + w[..., :3]
    return w


def place_roi(frame, pm, M, pad=4):
    """Composite premultiplied RGBA `pm` (sprite space) onto `frame` with 2x3 M, warping only the covered box.
    Returns (alpha in the ROI, (x0, y0, x1, y1))."""
    H, W = frame.shape[:2]
    h, w = pm.shape[:2]
    M = np.asarray(M, np.float64)
    pts = M @ np.array([[0, 0, 1], [w, 0, 1], [0, h, 1], [w, h, 1]], np.float64).T
    x0, y0 = int(max(0, np.floor(pts[0].min()) - pad)), int(max(0, np.floor(pts[1].min()) - pad))
    x1, y1 = int(min(W, np.ceil(pts[0].max()) + pad)), int(min(H, np.ceil(pts[1].max()) + pad))
    if x1 <= x0 or y1 <= y0:
        return None, None
    Ml = M.copy()
    Ml[0, 2] -= x0
    Ml[1, 2] -= y0
    wpm = cv2.warpAffine(pm, Ml.astype(np.float32), (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderValue=0)
    return wpm, (x0, y0, x1, y1)


def palm_tree(img, base_x, base_y, height, lean, col, seed=0, alpha=None):
    """Silhouette coconut palm: tapered curved trunk + drooping feathery fronds (drawn in place)."""
    rng = np.random.default_rng(seed)
    SH_ = 4
    k = 1 << SH_
    pts_l, pts_r = [], []
    n = 30
    top = None
    for i in range(n + 1):
        t = i / n
        x = base_x + lean * height * (t ** 1.6)
        y = base_y - height * t
        w = height * (0.030 * (1 - t) + 0.012)
        pts_l.append((x - w, y))
        pts_r.append((x + w, y))
        top = (x, y)
    trunk = np.array(pts_l + pts_r[::-1])
    cv2.fillPoly(img, [(trunk * k).astype(np.int32)], col, cv2.LINE_AA, SH_)
    if alpha is not None:
        cv2.fillPoly(alpha, [(trunk * k).astype(np.int32)], 1.0, cv2.LINE_AA, SH_)
    tx, ty = top
    nf = 9
    for j in range(nf):
        ang = -math.pi / 2 + (j - (nf - 1) / 2) * (math.pi / (nf - 1)) * 1.05 + rng.normal(0, 0.08)
        L_ = height * rng.uniform(0.32, 0.42)
        droop = rng.uniform(0.6, 1.0)
        spine = []
        for i in range(16):
            t = i / 15
            a = ang + droop * t * t * (1.2 if math.cos(ang) > 0 else -1.2)
            x = tx + math.cos(ang) * L_ * t
            y = ty + math.sin(ang) * L_ * t + droop * L_ * 0.55 * t * t
            spine.append((x, y))
        spine = np.array(spine)
        for i in range(1, len(spine)):
            p0, p1 = spine[i - 1], spine[i]
            d = p1 - p0
            nrm = np.array([-d[1], d[0]]) / (np.linalg.norm(d) + 1e-6)
            t = i / len(spine)
            ll = height * 0.07 * math.sin(math.pi * min(1.0, t * 1.15)) + 1
            for sgn in (-1, 1):
                q = p1 + nrm * sgn * ll + d * 0.6 + np.array([0, ll * 0.55])
                cv2.line(img, (int(p1[0] * k), int(p1[1] * k)), (int(q[0] * k), int(q[1] * k)), col, max(1, int(height * 0.006)), cv2.LINE_AA, SH_)
                if alpha is not None:
                    cv2.line(alpha, (int(p1[0] * k), int(p1[1] * k)), (int(q[0] * k), int(q[1] * k)), 1.0, max(1, int(height * 0.006)), cv2.LINE_AA, SH_)
        cv2.polylines(img, [(spine * k).astype(np.int32)], False, col, max(1, int(height * 0.010)), cv2.LINE_AA, SH_)
        if alpha is not None:
            cv2.polylines(alpha, [(spine * k).astype(np.int32)], False, 1.0, max(1, int(height * 0.010)), cv2.LINE_AA, SH_)
    return img
