"""The cosmic thief, after the original film: a tall hooded cloak whose body is a starry night sky (deep indigo,
twinkling stars), a dark face opening in the hood and a glowing white-blue outline. Facing left. His arm swings
out of the cloak to reach, receive and beckon; he glides (no legs), the hem rippling.
Units: the figure is 1000 tall; origin at the centre of the hem, y up negative."""
import os, sys, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
for _d in ("v3", "v2"):  # shared helpers
    sys.path.insert(1, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), _d))
import v3_owner as OW

catmull, rigid, apply = OW.catmull, OW.rigid, OW.apply

LEFT = [(-20, -1000), (-58, -966), (-80, -900), (-92, -820), (-102, -720), (-116, -580), (-136, -420), (-160, -260),
        (-184, -120), (-204, -24)]
RIGHT = [(214, -20), (206, -130), (188, -300), (164, -490), (146, -640), (130, -760), (110, -862), (80, -940), (36, -986)]
FACE = ((-57.0, -817.0), (40.0, 86.0), -6.0)        # dark opening in the hood: centre, half-axes, angle
SHOULDER = (-40.0, -640.0)
L_UP, L_FORE = 175.0, 165.0
OUTLINE = np.array([1.0, 0.93, 0.86], np.float32)     # BGR, white with a blue cast
GLOW = np.array([1.0, 0.72, 0.52], np.float32)

POSES = {
    #          upper arm, forearm, hand (absolute screen angles in degrees; 180 = pointing left, + = clockwise/down)
    'down': (95.0, 95.0, 95.0),          # hanging inside the cloak (invisible)
    'reach': (190.0, 182.0, 176.0),      # stretched out to the left, open hand
    'beckon': (196.0, 222.0, 240.0),     # forearm and hand lifted: "come"
    'high': (205.0, 200.0, 194.0),       # reaching up toward the moon
}


def mix(a, b, t):
    pa = POSES[a] if isinstance(a, str) else a
    pb = POSES[b] if isinstance(b, str) else b
    return tuple(pa[i] * (1 - t) + pb[i] * t for i in range(3))


def cloak_pts(n, ripple=1.0, sway=0.0):
    hem = []
    for x in np.linspace(-204, 214, 24):
        hem.append((x, 6 + ripple * (7 * math.sin(x / 38.0 + n * 0.32) + 4 * math.sin(x / 17.0 - n * 0.21))))
    pts = LEFT + hem[1:-1] + RIGHT
    out = []
    for x, y in pts:
        k = max(0.0, -y / 1000.0) ** 1.5         # sway bends the top more than the hem
        out.append((x + sway * k, y))
    return catmull(out, n=6)


def hand_shapes(W_, ang):
    """open hand at wrist W_, fingers along `ang` (deg). Returns list of (polyline, radius) capsules + palm polygon."""
    a = math.radians(ang)
    d = np.array([math.cos(a), math.sin(a)])
    nrm = np.array([-d[1], d[0]])
    W_ = np.asarray(W_, np.float64)
    palm_c = W_ + d * 42
    palm = [W_ + nrm * 22, W_ - nrm * 22, W_ + d * 74 - nrm * 30, W_ + d * 80 + nrm * 30]
    caps = []
    for off, spread, ln in ((-22, -16, 62), (-8, -5, 74), (7, 5, 70), (21, 15, 56)):
        base = W_ + d * 74 + nrm * off
        b = math.radians(ang + spread)
        db = np.array([math.cos(b), math.sin(b)])
        caps.append(([tuple(base), tuple(base + db * ln * 0.55), tuple(base + db * ln)], 7.5))
    tb = math.radians(ang - 62)
    dt = np.array([math.cos(tb), math.sin(tb)])
    tbase = W_ + d * 30 - nrm * 20
    caps.append(([tuple(tbase), tuple(tbase + dt * 30), tuple(tbase + dt * 54 + d * 8)], 9.0))
    return palm, caps, palm_c


class Canvas:
    def __init__(self, box, ppu):
        self.x0, self.y0 = box[0], box[1]
        self.ppu = ppu
        self.W = int(math.ceil((box[2] - box[0]) * ppu)) + 2
        self.H = int(math.ceil((box[3] - box[1]) * ppu)) + 2

    def px(self, pts):
        return (np.asarray(pts, np.float64) - [self.x0, self.y0]) * self.ppu

    def fill(self, m, pts):
        cv2.fillPoly(m, [(self.px(pts) * 16).astype(np.int32)], 1.0, cv2.LINE_AA, 4)

    def capsule(self, m, pts, r):
        q = (self.px(pts) * 16).astype(np.int32)
        cv2.polylines(m, [q], False, 1.0, max(1, int(round(2 * r * self.ppu))), cv2.LINE_AA, 4)
        for p in (q[0], q[-1]):
            cv2.circle(m, tuple(int(v) for v in p), int(r * self.ppu * 16), 1.0, -1, cv2.LINE_AA, 4)


_TEX = {}
FULL = (-700.0, -1100.0, 300.0, 60.0)          # stars and nebula are generated once over this unit box
_RNG = None


def _field():
    global _RNG
    if _RNG is None:
        rng = np.random.default_rng(17)
        bw, bh = FULL[2] - FULL[0], FULL[3] - FULL[1]
        g1 = rng.random((int(bh / 60) + 3, int(bw / 60) + 3)).astype(np.float32)
        g2 = rng.random((int(bh / 160) + 3, int(bw / 160) + 3)).astype(np.float32)
        m = int(bw * bh / 1500)
        ux, uy = rng.uniform(FULL[0], FULL[2], m), rng.uniform(FULL[1], FULL[3], m)
        size = rng.choice([0.6, 0.9, 1.3, 2.0], m, p=[0.55, 0.28, 0.12, 0.05])
        br = rng.uniform(0.45, 1.0, m)
        ph, fr = rng.uniform(0, 6.3, m), rng.uniform(0.08, 0.30, m)
        _RNG = (g1, g2, ux, uy, size, br, ph, fr)
    return _RNG


def star_tex(C, box):
    """indigo night with stars fixed to the figure (in units, so they stay put at any zoom or crop)"""
    key = (C.H, C.W, round(C.ppu, 4), tuple(box))
    if key not in _TEX:
        if len(_TEX) > 6:
            _TEX.clear()
        g1, g2, ux, uy, size, br, ph, fr = _field()
        xs = (np.arange(C.W, dtype=np.float32) / C.ppu + box[0] - FULL[0])
        ys = (np.arange(C.H, dtype=np.float32) / C.ppu + box[1] - FULL[1])
        def sample(g, cell):
            mx = np.repeat((xs / cell)[None, :], C.H, axis=0).astype(np.float32)
            my = np.repeat((ys / cell)[:, None], C.W, axis=1).astype(np.float32)
            return cv2.remap(g, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        neb, neb2 = sample(g1, 60.0), sample(g2, 160.0)
        yy = np.clip((ys[:, None] + FULL[1] + 1000) / 1000.0, 0, 1).astype(np.float32)
        base = np.array([0.30, 0.10, 0.08], np.float32)[None, None] * (0.85 + 0.35 * yy[..., None])
        base = base * (0.80 + 0.30 * neb[..., None]) + np.array([0.10, 0.03, 0.05], np.float32) * np.clip(neb2 - 0.4, 0, 1)[..., None]
        sx, sy = (ux - box[0]) * C.ppu, (uy - box[1]) * C.ppu
        _TEX[key] = (base.astype(np.float32), sx, sy, size, br, ph, fr)
    return _TEX[key]


def render(n, state, ppu, box=(-660, -1060, 260, 40)):
    """-> (premultiplied BGRA canvas, additive glow canvas (BGR), A: canvas px -> units, anchors in units)
    state: arm (pose tuple), sway, ripple, reveal (0..1 dissolve-in), flare (0..2 stars brighter)"""
    C = Canvas(box, ppu)
    m = np.zeros((C.H, C.W), np.float32)
    C.fill(m, cloak_pts(n, state.get('ripple', 1.0), state.get('sway', 0.0)))
    a1, a2, a3 = state.get('arm', POSES['down'])
    S = np.array(SHOULDER)
    E = S + L_UP * np.array([math.cos(math.radians(a1)), math.sin(math.radians(a1))])
    Wr = E + L_FORE * np.array([math.cos(math.radians(a2)), math.sin(math.radians(a2))])
    arm = np.zeros_like(m)
    c = catmull([tuple(S), tuple(S + (E - S) * 0.5), tuple(E), tuple(E + (Wr - E) * 0.5), tuple(Wr)], closed=False, n=6)
    for i in range(len(c) - 1):
        t = i / (len(c) - 1)
        r = 50 * (1 - t) + 30 * t                       # loose sleeve narrowing to the wrist
        C.capsule(arm, [tuple(c[i]), tuple(c[i + 1])], r)
    palm, caps, palm_c = hand_shapes(Wr, a3)
    C.fill(arm, palm)
    for pl, r in caps:
        C.capsule(arm, pl, r)
    m = np.clip(m + arm, 0, 1)
    base, sx, sy, size, br, ph, fr = star_tex(C, box)
    img = base.copy()
    # stars (twinkling); bigger ones get a soft halo
    tw = br * (0.6 + 0.4 * np.sin(ph + n * fr * 2.0)) * (1 + state.get('flare', 0.0))
    dots = np.zeros((C.H, C.W), np.float32)
    big = np.zeros((C.H, C.W), np.float32)
    xi, yi = np.clip(sx.astype(int), 0, C.W - 1), np.clip(sy.astype(int), 0, C.H - 1)
    sel = m[yi, xi] > 0.5
    for x, y, s, v in zip(xi[sel], yi[sel], size[sel], tw[sel]):
        r = max(1, int(round(s * ppu * 2.2)))
        if s >= 1.3:
            cv2.circle(big, (int(x), int(y)), r * 2, float(v), -1, cv2.LINE_AA)
        cv2.circle(dots, (int(x), int(y)), r, float(v), -1, cv2.LINE_AA)
    dots = cv2.GaussianBlur(dots, (0, 0), max(0.5, 0.5 * ppu))
    big = cv2.GaussianBlur(big, (0, 0), max(1.0, 3.0 * ppu))
    img += (dots * 1.25 + big * 0.55)[..., None] * np.array([1.0, 0.95, 0.92], np.float32)
    # dark face opening in the hood (moves with the cloak's sway)
    (fx, fy), (ax, ay), fa = FACE
    fx += state.get('sway', 0.0) * ((-fy / 1000.0) ** 1.5)
    face = np.zeros_like(m)
    q = C.px([(fx, fy)])[0]
    cv2.ellipse(face, (int(q[0] * 16), int(q[1] * 16)), (int(ax * ppu * 16), int(ay * ppu * 16)), fa, 0, 360, 1.0, -1, cv2.LINE_AA, 4)
    face = cv2.GaussianBlur(face, (0, 0), max(0.8, 6 * ppu))
    img *= (1 - 0.92 * face)[..., None]
    # inner fold lines (faint glow), the outline and its glow
    fold = np.zeros_like(m)
    for pts in ([(40, -900), (60, -700), (70, -480), (96, -260), (120, -60)], [(-20, -560), (-36, -380), (-60, -200), (-90, -40)]):
        cv2.polylines(fold, [(C.px(catmull(pts, closed=False, n=6)) * 16).astype(np.int32)], False, 1.0,
                      max(1, int(round(2.2 * ppu))), cv2.LINE_AA, 4)
    fold = cv2.GaussianBlur(fold, (0, 0), max(0.6, 1.2 * ppu)) * m
    img += fold[..., None] * GLOW * 0.25
    w = max(1, int(round(4.2 * ppu)))
    edge = np.clip(m - cv2.erode(m, np.ones((3, 3), np.uint8), iterations=w), 0, 1)
    edge = cv2.GaussianBlur(edge, (0, 0), max(0.5, 0.6 * ppu))
    img = img * (1 - edge[..., None]) + OUTLINE[None, None] * edge[..., None]
    rv = state.get('reveal', 1.0)
    alpha = m * rv
    pm = np.dstack([img * alpha[..., None], alpha]).astype(np.float32)
    glow = (cv2.GaussianBlur(edge, (0, 0), max(1.0, 7 * ppu)) * 0.9 + cv2.GaussianBlur(edge, (0, 0), max(2.0, 22 * ppu)) * 0.5)
    glow = glow[..., None] * GLOW * rv
    A = np.array([[1 / ppu, 0, box[0]], [0, 1 / ppu, box[1]]], np.float64)
    anchors = dict(palm=tuple(palm_c), wrist=tuple(Wr), head=(-20.0, -880.0), chest=(0.0, -600.0))
    return pm, glow.astype(np.float32), A, anchors


def place(img, pm, glow, M):
    """composite the thief (premultiplied) and add his outline glow; M: canvas px -> output 2x3"""
    import v2lib as L
    wpm, box = L.place_roi(img, pm, M)
    if wpm is not None:
        x0, y0, x1, y1 = box
        img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - np.clip(wpm[..., 3:4], 0, 1)) + wpm[..., :3]
    wg, box = L.place_roi(img, np.dstack([glow, np.zeros(glow.shape[:2], np.float32)]), M)
    if wg is not None:
        x0, y0, x1, y1 = box
        img[y0:y1, x0:x1] += wg[..., :3]


if __name__ == '__main__':
    import v2lib as L
    tiles = []
    for nm in ('down', 'reach', 'beckon', 'high'):
        pm, glow, A, an = render(10, dict(arm=POSES[nm]), 0.5)
        bg = np.ones(pm.shape[:2] + (3,), np.float32) * np.array([0.10, 0.20, 0.30], np.float32)
        img = bg * (1 - pm[..., 3:4]) + pm[..., :3] + glow
        tiles.append(L.u8(img))
    cv2.imwrite(L.S + '/v4/thief_poses.jpg', np.hstack(tiles))
    print('ok', tiles[0].shape)
