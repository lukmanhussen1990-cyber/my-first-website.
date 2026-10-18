"""The man of the house as a slim, serene Buddha (after the original film's seated narrator): cross-legged on a low
wooden seat, side view facing right, snail-curl hair with the ushnisha, long earlobes, downcast closed eyes, a saffron
robe over the far shoulder leaving the near shoulder and arm bare. Painted in the Kerala-video style (soft volume
shading, thin warm outlines). Cut-out rig: seat, lap, body, robe, head (jaw levels) are pre-painted; both arms are
painted per frame as smooth tubes, so the joints never show seams.
Units: ~1 mm; origin on the floor under his hips, y down."""
import os, sys, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def bgr(r, g, b):
    return np.array([b, g, r], np.float32) / 255.0


SKIN, SKIN_D, SKIN_L, SKIN_O = bgr(222, 170, 112), bgr(166, 108, 62), bgr(252, 218, 168), bgr(122, 70, 36)
LIP = bgr(196, 112, 92)
HAIR, HAIR_D, HAIR_L = bgr(34, 34, 54), bgr(14, 14, 26), bgr(86, 90, 128)
ROBE, ROBE_D, ROBE_L, ROBE_O = bgr(228, 122, 36), bgr(156, 62, 16), bgr(252, 172, 76), bgr(112, 42, 12)
BORDER = bgr(168, 46, 22)
GOLD, GOLD_D = bgr(230, 178, 70), bgr(150, 98, 26)
WOOD, WOOD_D, WOOD_L = bgr(112, 56, 32), bgr(58, 28, 16), bgr(168, 98, 58)
MOUTH = bgr(96, 34, 26)
LIGHT = (0.72, -0.48)

NECK_PIVOT = (12.0, -742.0)
HIP = (0.0, -190.0)
SHOULDER_N = (6.0, -644.0)          # near (bare) shoulder joint, torso coords
SHOULDER_F = (-8.0, -652.0)         # far (robed) shoulder
HEAD_DY = -22.0                     # the head part sits this much higher (a longer neck)
JAW_HINGE = (4.0, -820.0)
L_UP, L_FORE, L_HAND = 290.0, 232.0, 134.0


# ---------------------------------------------------------------- geometry helpers
def catmull(pts, closed=True, n=10):
    P = np.asarray(pts, np.float64)
    P = np.vstack([P[-1], P, P[0], P[1]]) if closed else np.vstack([P[0], P, P[-1]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not closed:
        out.append(P[-2])
    return np.array(out)


def rot_pts(pts, c, deg):
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    P = np.asarray(pts, np.float64) - c
    return np.stack([c[0] + P[:, 0] * ca - P[:, 1] * sa, c[1] + P[:, 0] * sa + P[:, 1] * ca], 1)


def rigid(c_from, deg, c_to=None):
    """3x3: rotate by deg (clockwise on screen, y down) about c_from, then move c_from to c_to"""
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    if c_to is None:
        c_to = c_from
    return np.array([[ca, -sa, c_to[0] - ca * c_from[0] + sa * c_from[1]],
                     [sa, ca, c_to[1] - sa * c_from[0] - ca * c_from[1]], [0, 0, 1]], np.float64)


def apply(M, p):
    return (M @ np.array([p[0], p[1], 1.0]))[:2]


# ---------------------------------------------------------------- painting
class Part:
    """A painted part: BGR + alpha float32 canvases covering unit box (x0, y0, x1, y1) at ppu px/unit."""
    def __init__(self, box, ppu):
        self.x0, self.y0, self.x1, self.y1 = box
        self.ppu = ppu
        self.W = int(math.ceil((box[2] - box[0]) * ppu)) + 2
        self.H = int(math.ceil((box[3] - box[1]) * ppu)) + 2
        self.rgb = np.zeros((self.H, self.W, 3), np.float32)
        self.a = np.zeros((self.H, self.W), np.float32)

    def px(self, pts):
        return (np.asarray(pts, np.float64) - [self.x0, self.y0]) * self.ppu

    def mask(self, pts):
        m = np.zeros((self.H, self.W), np.float32)
        cv2.fillPoly(m, [(self.px(pts) * 16).astype(np.int32)], 1.0, cv2.LINE_AA, 4)
        return m

    def stroke(self, pts, w, closed=False):
        m = np.zeros((self.H, self.W), np.float32)
        cv2.polylines(m, [(self.px(pts) * 16).astype(np.int32)], closed, 1.0, max(1, int(round(w * self.ppu))), cv2.LINE_AA, 4)
        return m

    def ellipse(self, c, ax, ang=0.0):
        m = np.zeros((self.H, self.W), np.float32)
        cc = self.px([c])[0]
        cv2.ellipse(m, (int(cc[0] * 16), int(cc[1] * 16)), (max(1, int(ax[0] * self.ppu * 16)), max(1, int(ax[1] * self.ppu * 16))),
                    ang, 0, 360, 1.0, -1, cv2.LINE_AA, 4)
        return m

    def over(self, m, col, alpha=True):
        m = np.clip(m, 0, 1)
        col = np.asarray(col, np.float32)
        if col.ndim == 1:
            col = col[None, None]
        self.rgb = self.rgb * (1 - m[..., None]) + col * m[..., None]
        if alpha:
            self.a = self.a + m * (1 - self.a)

    def tint(self, m, col, k):
        w = (np.clip(m, 0, 1) * k)[..., None]
        self.rgb = self.rgb * (1 - w) + np.asarray(col, np.float32)[None, None] * w

    def mul(self, m, f):
        self.rgb *= (1 - np.clip(m, 0, 1) * (1 - f))[..., None]

    def premul(self):
        return np.dstack([self.rgb * self.a[..., None], self.a]).astype(np.float32)


def _shift(img, dx, dy):
    M = np.float32([[1, 0, -dx], [0, 1, -dy]])
    return cv2.warpAffine(img, M, (img.shape[1], img.shape[0]), flags=cv2.INTER_LINEAR, borderValue=0)


def volume(part, m, base, dark, light, size, ldir=LIGHT, soft=0.10, rim=0.85, edge=0.20, outline=None, ow=2.0,
           outline_mask=None, lit_k=0.55):
    """Paint a shape with soft painterly volume: lit towards ldir, shaded on the far side, darker rim, thin outline."""
    sig = max(1.0, soft * size * part.ppu)
    ms = cv2.GaussianBlur(m, (0, 0), sig)
    emb = _shift(ms, ldir[0] * sig, ldir[1] * sig) - ms
    shd = np.clip(emb * 2.4, 0, 1)
    lit = np.clip(-emb * 2.4, 0, 1)
    col = base[None, None] * (1 - shd[..., None] * rim) + dark[None, None] * (shd[..., None] * rim)
    col = col * (1 - lit[..., None] * lit_k) + light[None, None] * (lit[..., None] * lit_k)
    inner = np.clip((ms - 0.5) / 0.5, 0, 1)
    col = col * (1 - edge * (1 - inner))[..., None]
    part.over(m, col)
    if outline is not None:
        it = max(1, int(round(ow * part.ppu / 2)))
        o = np.clip(m - cv2.erode(m, np.ones((3, 3), np.uint8), iterations=it), 0, 1)
        o = cv2.GaussianBlur(o, (0, 0), 0.6)
        if outline_mask is not None:
            o = o * outline_mask
        part.tint(o * m, outline, 0.85)


def fold(part, pts, w, col, k, blur=1.5, clip=None):
    s = part.stroke(catmull(pts, closed=False, n=8), w)
    s = cv2.GaussianBlur(s, (0, 0), max(0.6, blur * part.ppu))
    if clip is not None:
        s = s * clip
    part.tint(s, col, k)


def border(part, pts, w, clip, n=8):
    """robe border: a red-ochre band with a thin gold line along a curve, clipped to a mask"""
    c = catmull(pts, closed=False, n=n)
    s = part.stroke(c, w) * clip
    part.tint(s, BORDER, 0.9)
    g = part.stroke(c, max(1.2, w * 0.22)) * clip
    part.tint(cv2.GaussianBlur(g, (0, 0), 0.6), GOLD, 0.9)


# ---------------------------------------------------------------- static parts
def p_seat(ppu):
    P = Part((-400, -90, 400, 4), ppu)
    for xs in (-336, 300):
        leg = [(xs, -54), (xs + 38, -54), (xs + 34, 0), (xs + 4, 0)]
        volume(P, P.mask(leg), WOOD, WOOD_D, WOOD_L, 40, outline=WOOD_D, ow=2)
    apron = catmull([(-300, -54), (300, -54), (300, -40), (200, -34), (0, -30), (-200, -34), (-300, -40)], n=6)
    volume(P, P.mask(apron), WOOD * 0.85, WOOD_D, WOOD, 30, outline=WOOD_D, ow=1.5)
    top = catmull([(-382, -80), (382, -80), (390, -66), (382, -52), (-382, -52), (-390, -66)], n=6)
    m = P.mask(top)
    volume(P, m, WOOD, WOOD_D, WOOD_L, 60, ldir=(0.2, -1.0), outline=WOOD_D, ow=2)
    P.tint(P.stroke([(-376, -78), (376, -78)], 3) * m, WOOD_L, 0.7)
    return P


LAP = [(-318, -80), (-350, -116), (-336, -160), (-266, -198), (-140, -220), (0, -228), (140, -232), (250, -228), (320, -208),
       (360, -170), (366, -124), (344, -90), (290, -78), (0, -76)]


def p_lap(ppu):
    P = Part((-370, -250, 380, -70), ppu)
    m = P.mask(catmull(LAP, n=10))
    volume(P, m, ROBE, ROBE_D, ROBE_L, 150, ldir=(0.55, -0.8), soft=0.12, outline=ROBE_O, ow=2.2)
    fold(P, [(-240, -118), (-60, -150), (140, -188), (300, -198)], 6, ROBE_D, 0.55, clip=m)        # near shin
    fold(P, [(-150, -204), (60, -168), (240, -128), (340, -110)], 5, ROBE_D, 0.45, clip=m)         # far shin
    fold(P, [(-310, -150), (-230, -138), (-140, -150)], 4, ROBE_D, 0.35, clip=m)
    fold(P, [(120, -110), (200, -100), (300, -96)], 4, ROBE_D, 0.30, clip=m)
    border(P, [(-326, -94), (-200, -88), (0, -86), (200, -87), (330, -92), (352, -104)], 12, m)
    return P


BODY = [(40, -726), (66, -708), (92, -680), (106, -642), (112, -602), (106, -560), (98, -516), (96, -470), (102, -420),
        (112, -362), (128, -300), (150, -240), (172, -190), (100, -150), (-100, -150), (-206, -198), (-150, -282), (-110, -362),
        (-96, -440), (-92, -520), (-96, -600), (-84, -660), (-56, -706), (-22, -738), (10, -746)]


def p_body(ppu):
    """bare chest/shoulder skin (the robe part covers the back and the lower torso)"""
    P = Part((-220, -760, 190, -140), ppu)
    m = P.mask(catmull(BODY, n=8))
    yy, xx = np.mgrid[0:P.H, 0:P.W].astype(np.float32)
    yy, xx = yy / ppu + P.y0, xx / ppu + P.x0
    omask = 1 - np.clip((-700 - yy) / 10.0, 0, 1) * np.clip((60 - np.abs(xx - 10)) / 10.0, 0, 1)   # no line under the neck
    volume(P, m, SKIN, SKIN_D, SKIN_L, 200, soft=0.09, outline=SKIN_O, ow=1.8, outline_mask=omask)
    fold(P, [(44, -712), (70, -700), (94, -684)], 2.5, SKIN_D, 0.40, clip=m)        # collarbone
    fold(P, [(60, -606), (86, -596), (106, -598)], 3.0, SKIN_D, 0.35, clip=m)       # under the chest
    return P


ROBE_EDGE = [(-62, -712), (-60, -668), (-36, -628), (-4, -598), (40, -566), (78, -532), (100, -500)]


def p_robe(ppu):
    P = Part((-230, -760, 200, -130), ppu)
    pts = [(-24, -746), (-48, -736)] + ROBE_EDGE + [(104, -470), (106, -420), (116, -362), (132, -300), (156, -240), (178, -186),
                                                    (100, -144), (-110, -144), (-214, -194), (-158, -282), (-116, -362),
                                                    (-100, -440), (-96, -520), (-100, -600), (-90, -662), (-66, -712)]
    m = P.mask(catmull(pts, n=8))
    volume(P, m, ROBE, ROBE_D, ROBE_L, 260, soft=0.10, outline=ROBE_O, ow=2.2)
    fold(P, [(-70, -650), (-84, -560), (-86, -460), (-104, -360), (-150, -270)], 5, ROBE_D, 0.50, clip=m)    # back fold
    fold(P, [(-20, -560), (20, -470), (40, -380), (90, -260)], 5, ROBE_D, 0.40, clip=m)
    fold(P, [(-60, -500), (-30, -400), (0, -300), (60, -200)], 4, ROBE_D, 0.30, clip=m)
    fold(P, [(30, -520), (70, -440), (110, -330)], 3.5, ROBE_L, 0.35, clip=m)
    border(P, ROBE_EDGE + [(104, -470), (108, -420), (118, -362), (134, -300), (158, -240), (178, -190)], 13, m)
    border(P, [(-206, -186), (-100, -156), (60, -158), (176, -186)], 11, m)
    return P


def head_contour(j=0.0):
    front = [(88, -930), (100, -912), (108, -892), (110, -878), (109, -866), (118, -846), (128, -826), (122, -818), (113, -815),
             (114, -806), (118, -800), (111, -795)]
    jaw = [(116, -790), (110, -782), (106, -776), (112, -764), (106, -750), (84, -744), (52, -738)]
    wts = [1, 1, 1, 1, 1, 0.6, 0.2]
    th = 6.0 * j
    jw = [tuple(rot_pts([(x, y)], JAW_HINGE, th * w_)[0]) for (x, y), w_ in zip(jaw, wts)]
    neck = [(46, -716), (44, -680), (-20, -680), (-22, -738)]
    back = [(-40, -768), (-56, -806), (-66, -852), (-62, -898), (-44, -934), (-10, -958), (30, -962), (64, -952)]
    return front, jw, neck, back


HAIR_CAP = [(90, -934), (70, -924), (46, -916), (26, -904), (14, -886), (4, -876), (-8, -880), (-20, -872), (-30, -858),
            (-42, -850), (-56, -848), (-66, -856), (-71, -878), (-69, -910), (-52, -946), (-16, -968), (30, -972), (68, -958)]
USHNISHA = ((6.0, -968.0), (46.0, 28.0))


def p_head(ppu, j=0.0):
    """Buddha head + neck; j: jaw open 0..1"""
    P = Part((-120, -1030, 150, -670), ppu)
    front, jw, neck, back = head_contour(j)
    m = P.mask(catmull(front + jw + neck + back, n=8))
    yy = (np.arange(P.H, dtype=np.float32)[:, None] / ppu + P.y0)
    omask = np.clip((-714 - yy) / 12.0, 0, 1) * np.ones((1, P.W), np.float32)
    volume(P, m, SKIN, SKIN_D, SKIN_L, 120, soft=0.09, outline=SKIN_O, ow=1.8, outline_mask=omask)
    sh = P.mask(catmull([(-10, -750), (50, -742), (92, -746), (60, -724), (10, -714)], n=6))
    P.mul(cv2.GaussianBlur(sh, (0, 0), 4 * ppu) * m, 0.75)
    for k, yv in enumerate((-731, -716, -701)):                                   # the three neck folds
        fold(P, [(-12, yv + 2), (16, yv - 1), (44, yv + 3 - k)], 2.2, SKIN_D, 0.45, blur=0.8, clip=m)
    # mouth: a gentle smile, opening with the jaw
    if j > 0.02:
        lo = jw[0]
        mouth = [(118, -800), (111, -795), lo, (lo[0] - 5, lo[1] + 1), (101, -795)]
        mm = P.mask(catmull(mouth, n=5)) * m
        P.over(mm, MOUTH, alpha=False)
        if j > 0.5:
            P.over(P.mask([(113, -799), (103, -797), (104, -794), (112, -795)]) * mm, bgr(240, 232, 222), alpha=False)
    up = P.mask(catmull([(114, -806), (118, -800), (111, -795), (104, -799), (107, -806)], n=5)) * m
    P.tint(cv2.GaussianBlur(up, (0, 0), 0.8), LIP, 0.35)
    lw = P.mask(catmull([jw[0], jw[1], (103, -781), (104, -789)], n=5)) * m
    P.tint(cv2.GaussianBlur(lw, (0, 0), 0.8), LIP, 0.3)
    fold(P, [(2, -778), (24, -764), (60, -755), (98, -753)], 3, SKIN_D, 0.28, blur=2.0, clip=m)              # jawline
    P.tint(P.stroke(catmull([(111, -795), (104, -796), (98, -799)], closed=False, n=5), 1.8) * m, SKIN_O, 0.75)   # smiling corner
    P.tint(P.stroke(catmull([(117, -822), (112, -818), (114, -814)], closed=False, n=5), 2.0) * m, SKIN_O, 0.7)   # nostril
    # downcast closed eye, long brow arc flowing into the nose, urna
    lid = catmull([(64, -872), (78, -866), (92, -865), (101, -868)], closed=False, n=6)
    P.tint(P.stroke(lid, 2.4) * m, SKIN_O, 0.95)
    P.tint(cv2.GaussianBlur(P.stroke(catmull([(66, -880), (82, -877), (98, -877)], closed=False, n=5), 2), (0, 0), ppu) * m,
           SKIN_D, 0.5)
    brow = catmull([(52, -886), (72, -893), (94, -892), (108, -884)], closed=False, n=6)
    P.over(cv2.GaussianBlur(P.stroke(brow, 2.4), (0, 0), 0.6) * m, bgr(74, 46, 32), alpha=False)
    urna = P.ellipse((109.0, -883), (2.6, 2.6))
    P.over(urna, SKIN_L)
    P.tint(np.clip(urna - cv2.erode(urna, np.ones((3, 3), np.uint8)), 0, 1), SKIN_O, 0.7)
    P.tint(cv2.GaussianBlur(P.stroke(catmull([(96, -846), (88, -832), (92, -812)], closed=False, n=6), 3), (0, 0), 2 * ppu) * m,
           SKIN_D, 0.22)
    # the long earlobe (with its slit)
    ear_pts = [(-2, -874), (12, -866), (16, -846), (12, -822), (10, -800), (8, -782), (0, -776), (-8, -786), (-10, -812),
               (-12, -840), (-12, -864)]
    ear = P.mask(catmull(ear_pts, n=6))
    volume(P, ear, SKIN, SKIN_D, SKIN_L, 34, outline=SKIN_O, ow=1.6)
    P.tint(P.stroke(catmull([(6, -862), (0, -848), (4, -830)], closed=False, n=5), 2.0) * ear, SKIN_O, 0.7)
    P.tint(P.stroke([(2, -804), (2, -790)], 2.4) * ear, SKIN_O, 0.8)
    # snail-curl hair and the ushnisha
    cap = P.mask(catmull(HAIR_CAP, n=8))
    ush = P.ellipse(*USHNISHA)
    hm = np.clip(cap + ush, 0, 1)
    volume(P, hm, HAIR, HAIR_D, HAIR_L, 100, ldir=(0.5, -0.85), soft=0.08, outline=HAIR_D, ow=1.2, lit_k=0.35)
    rng = np.random.default_rng(7)
    sp = 9.4
    curls = []
    for iy, y in enumerate(np.arange(-1012, -780, sp * 0.87)):
        for x in np.arange(-84 + (iy % 2) * sp / 2, 100, sp):
            curls.append((x + rng.uniform(-1, 1), y + rng.uniform(-1, 1)))
    hm_s = cv2.GaussianBlur(hm, (0, 0), 1.0)
    layer = np.zeros_like(P.rgb)
    la = np.zeros_like(P.a)
    for (x, y) in curls:
        q = P.px([(x, y)])[0]
        if not (0 <= q[0] < P.W and 0 <= q[1] < P.H) or hm_s[int(q[1]), int(q[0])] < 0.5:
            continue
        r = 4.7
        base = P.rgb[int(q[1]), int(q[0])].copy()
        cv2.circle(la, (int(q[0] * 16), int(q[1] * 16)), int(r * ppu * 16), 1.0, -1, cv2.LINE_AA, 4)
        cv2.circle(layer, (int(q[0] * 16), int(q[1] * 16)), int(r * ppu * 16), tuple(float(v) for v in base), -1, cv2.LINE_AA, 4)
        cv2.circle(layer, (int(q[0] * 16), int(q[1] * 16)), int(r * ppu * 16), tuple(float(v) for v in base * 0.55),
                   max(1, int(round(1.1 * ppu))), cv2.LINE_AA, 4)
        h = q + np.array([-1.2, -1.4]) * ppu
        cv2.circle(layer, (int(h[0] * 16), int(h[1] * 16)), int(1.5 * ppu * 16), tuple(float(v) for v in base * 0.6 + HAIR_L * 0.4),
                   -1, cv2.LINE_AA, 4)
    layer = cv2.GaussianBlur(layer, (0, 0), 0.4 * ppu)
    P.over(la, layer / np.maximum(la[..., None], 1e-4))
    # the neck melts into the shoulders (no seam where it meets the body)
    fade = np.clip((-682 - yy) / 26.0, 0, 1)
    P.a *= fade
    return P


def p_hand(ppu, shade=1.0):
    """open palm-up hand: wrist at the origin, fingers along +x, thumb on top"""
    P = Part((-14, -62, 146, 34), ppu)
    pts = [(-10, -24), (24, -28), (44, -26), (58, -42), (74, -52), (84, -48), (76, -32), (100, -18), (122, -18), (136, -24),
           (142, -16), (138, -2), (122, 8), (92, 18), (56, 22), (24, 24), (-10, 24)]
    m = P.mask(catmull(pts, n=8))
    xx = (np.arange(P.W, dtype=np.float32)[None, :] / ppu + P.x0)
    omask = np.clip((xx - 4) / 10.0, 0, 1) * np.ones((P.H, 1), np.float32)
    volume(P, m, SKIN * shade, SKIN_D * shade, SKIN_L * shade, 44, ldir=(0.2, -1.0), soft=0.16, outline=SKIN_O, ow=1.6,
           outline_mask=omask)
    P.tint(P.stroke(catmull([(52, -26), (78, -20), (106, -12), (128, -10)], closed=False, n=6), 1.8) * m, SKIN_O, 0.5)
    P.tint(P.stroke(catmull([(100, 8), (122, 2), (136, -6)], closed=False, n=5), 1.4) * m, SKIN_O, 0.45)
    P.over(P.ellipse((70, -46), (3.4, 2.4), -40) * m, bgr(246, 206, 176), alpha=False)
    return P


_PARTS = {}
JAW_LEVELS = 6


def parts(ppu):
    key = round(ppu, 3)
    if key not in _PARTS:
        d = dict(seat=p_seat(ppu), lap=p_lap(ppu), body=p_body(ppu), robe=p_robe(ppu), hand=p_hand(ppu), hand_f=p_hand(ppu, 0.74))
        for i in range(JAW_LEVELS):
            d['head%d' % i] = p_head(ppu, i / (JAW_LEVELS - 1))
        _PARTS[key] = {k: (v, v.premul()) for k, v in d.items()}
    return _PARTS[key]


# ---------------------------------------------------------------- arms (painted per frame)
def tube(P, joints, radii, n=12):
    """smooth limb outline through joints with radii (round caps)"""
    c = catmull(joints, closed=False, n=n)
    seg = np.r_[0, np.cumsum(np.linalg.norm(np.diff(c, axis=0), axis=1))]
    knots = np.r_[0, np.cumsum(np.linalg.norm(np.diff(np.asarray(joints, np.float64), axis=0), axis=1))]
    r = np.interp(seg * knots[-1] / max(seg[-1], 1e-6), knots, radii)
    d = np.gradient(c, axis=0)
    d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-6)
    nrm = np.stack([-d[:, 1], d[:, 0]], 1)
    left, right = c + nrm * r[:, None], c - nrm * r[:, None]
    a0 = math.atan2(nrm[0, 1], nrm[0, 0])
    cap0 = [(c[0, 0] + r[0] * math.cos(a0 + t), c[0, 1] + r[0] * math.sin(a0 + t)) for t in np.linspace(0, math.pi, 12)]
    a1 = math.atan2(-nrm[-1, 1], -nrm[-1, 0])
    cap1 = [(c[-1, 0] + r[-1] * math.cos(a1 + t), c[-1, 1] + r[-1] * math.sin(a1 + t)) for t in np.linspace(0, math.pi, 8)]
    return np.vstack([left, cap1, right[::-1], cap0])


POSES = {
    #          upper arm, forearm, hand  (absolute screen angles in degrees; 0 = pointing right, + = down)
    'rest': (80.0, 30.0, 4.0),            # hand resting on the knee
    'lap': (84.0, 14.0, 0.0),
    'offer': (60.0, -2.0, -10.0),         # palm up, held out
    'give': (36.0, -26.0, -36.0),         # stretched out and up, releasing
    'raise': (12.0, -72.0, -84.0),        # hand raised high
    'abhaya': (66.0, -60.0, -88.0),       # 'fear not': forearm up, palm out
    'talk': (72.0, 6.0, -6.0),
    'low': (66.0, 26.0, 10.0),
}


def mix_pose(a, b, t):
    pa = POSES[a] if isinstance(a, str) else a
    pb = POSES[b] if isinstance(b, str) else b
    return tuple(pa[i] * (1 - t) + pb[i] * t for i in range(3))


def arm_points(shoulder, pose, torso_M):
    a1, a2, a3 = (math.radians(v) for v in pose)
    S = apply(torso_M, shoulder)
    E = S + L_UP * np.array([math.cos(a1), math.sin(a1)])
    Wr = E + L_FORE * np.array([math.cos(a2), math.sin(a2)])
    return S, E, Wr, math.degrees(a3)


def paint_arm(can, C, ppu, S, E, Wr, far=False):
    """paint one arm straight into the composition canvas (premultiplied), C: units -> canvas px (3x3)"""
    pts_all = np.array([S, E, Wr])
    x0, y0 = pts_all.min(0) - 70
    x1, y1 = pts_all.max(0) + 70
    P = Part((x0, y0, x1, y1), ppu)
    sh = 0.74 if far else 1.0
    mid = (S + E) / 2
    if far:
        fm = P.mask(tube(P, [E - (E - S) * 0.05, (E + Wr) / 2, Wr], [24, 22, 17]))
        volume(P, fm, SKIN * sh, SKIN_D * sh, SKIN_L * sh, 50, soft=0.16, outline=SKIN_O, ow=1.6)
        sm = P.mask(tube(P, [S, mid, E + (E - S) * 0.08], [44, 40, 34]))
        volume(P, sm, ROBE * sh, ROBE_D * sh, ROBE_L * sh, 90, soft=0.14, outline=ROBE_O, ow=1.8)
        border(P, [tuple(E + (E - S) * 0.02 + np.array([0, 0])), tuple(E + (E - S) * 0.08)], 10, sm)
    else:
        m = P.mask(tube(P, [S, S + (E - S) * 0.35, E, E + (Wr - E) * 0.3, Wr], [35, 31, 25, 23, 17]))
        volume(P, m, SKIN, SKIN_D, SKIN_L, 56, soft=0.15, outline=SKIN_O, ow=1.7)
        fold(P, [tuple(E + (S - E) * 0.18 + np.array([0, -6])), tuple(E + np.array([4, -4])), tuple(E + (Wr - E) * 0.12)], 2.2,
             SKIN_D, 0.35, clip=m)                                                            # elbow crease
        for t in (0.86, 0.92):                                                                # gold bangles
            c = E + (Wr - E) * t
            d = (Wr - E) / max(1e-6, np.linalg.norm(Wr - E))
            nn = np.array([-d[1], d[0]])
            r = 20.0
            band = [tuple(c + nn * r), tuple(c - nn * r)]
            bm = P.stroke(band, 6.5) * m
            P.over(bm, GOLD, alpha=False)
            P.tint(P.stroke(band, 1.6) * m, bgr(255, 238, 170), 0.6)
        # armband on the upper arm
        c = S + (E - S) * 0.38
        d = (E - S) / max(1e-6, np.linalg.norm(E - S))
        nn = np.array([-d[1], d[0]])
        bm = P.stroke([tuple(c + nn * 33), tuple(c - nn * 33)], 6) * m
        P.over(bm, GOLD, alpha=False)
    Ml = (C @ np.array([[1 / ppu, 0, P.x0], [0, 1 / ppu, P.y0], [0, 0, 1]], np.float64))[:2]
    _put(can, P.premul(), Ml)


def _put(can, pm, M):
    Hc, Wc = can.shape[:2]
    h, w = pm.shape[:2]
    pts = M @ np.array([[0, 0, 1], [w, 0, 1], [0, h, 1], [w, h, 1]], np.float64).T
    x0, y0 = int(max(0, np.floor(pts[0].min()) - 2)), int(max(0, np.floor(pts[1].min()) - 2))
    x1, y1 = int(min(Wc, np.ceil(pts[0].max()) + 2)), int(min(Hc, np.ceil(pts[1].max()) + 2))
    if x1 <= x0 or y1 <= y0:
        return
    Ml = M.copy()
    Ml[0, 2] -= x0
    Ml[1, 2] -= y0
    wpm = cv2.warpAffine(pm, Ml.astype(np.float32), (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderValue=0)
    sub = can[y0:y1, x0:x1]
    can[y0:y1, x0:x1] = wpm + sub * (1 - wpm[..., 3:4])


def compose(state, ppu, box=(-420, -1040, 660, 12)):
    """Render the owner into a premultiplied canvas covering `box` (units).
    state: lean, head (deg), jaw (0..1), arm_n / arm_f (pose tuples).
    Returns (canvas BGRA premultiplied, A: 2x3 canvas px -> units, anchors in units)."""
    P = parts(ppu)
    X0, Y0, X1, Y1 = box
    Wc, Hc = int(math.ceil((X1 - X0) * ppu)), int(math.ceil((Y1 - Y0) * ppu))
    can = np.zeros((Hc, Wc, 4), np.float32)
    C = np.array([[ppu, 0, -X0 * ppu], [0, ppu, -Y0 * ppu], [0, 0, 1]], np.float64)

    def put(name, T):
        part, pm = P[name]
        A = np.array([[1 / ppu, 0, part.x0], [0, 1 / ppu, part.y0], [0, 0, 1]], np.float64)
        _put(can, pm, (C @ T @ A)[:2])

    I = np.eye(3)
    Tt = rigid(HIP, state.get('lean', 0.0))
    Th = Tt @ rigid(NECK_PIVOT, state.get('head', 0.0)) @ np.array([[1, 0, 0], [0, 1, HEAD_DY], [0, 0, 1]], np.float64)
    put('seat', I)
    Sf, Ef, Wf, hf = arm_points(SHOULDER_F, state['arm_f'], Tt)
    put('hand_f', rigid((0, 0), hf, Wf))
    paint_arm(can, C, ppu, Sf, Ef, Wf, far=True)
    put('lap', I)
    put('body', Tt)
    j = float(np.clip(state.get('jaw', 0.0), 0, 1))
    put('head%d' % int(round(j * (JAW_LEVELS - 1))), Th)
    put('robe', Tt)
    Sn, En, Wn, hn = arm_points(SHOULDER_N, state['arm_n'], Tt)
    paint_arm(can, C, ppu, Sn, En, Wn)
    Hn = rigid((0, 0), hn, Wn)
    put('hand', Hn)
    anchors = dict(palm=apply(Hn, (84, -30)), palm_f=apply(rigid((0, 0), hf, Wf), (84, -30)), mouth=apply(Th, (118, -797)),
                   eye=apply(Th, (84, -868)), chest=apply(Tt, (40, -600)), head_top=apply(Th, (10, -1000)),
                   belly=apply(Tt, (-10, -420)), lap=(60.0, -210.0), wrist=tuple(Wn), fingertip=apply(Hn, (140, -14)))
    A = np.array([[1 / ppu, 0, X0], [0, 1 / ppu, Y0]], np.float64)
    return can, A, anchors


def silhouette_pts():
    """rough outline (units) for wall shadows / FX that need his body region"""
    return catmull(LAP, n=4), catmull(BODY, n=4)


if __name__ == '__main__':
    import v2lib as L
    S = L.S
    od = S + '/v3/look'
    os.makedirs(od, exist_ok=True)
    tiles = []
    for st in [dict(arm_n='rest', arm_f='rest'), dict(arm_n='offer', arm_f='offer', lean=3),
               dict(arm_n='give', arm_f='give', lean=6, jaw=0.6), dict(arm_n='raise', arm_f='lap', head=-8),
               dict(arm_n='abhaya', arm_f='lap', jaw=1.0)]:
        st = dict(st)
        st['arm_n'] = POSES[st['arm_n']]
        st['arm_f'] = POSES[st['arm_f']]
        can, A, an = compose(st, 0.6)
        bg = np.ones(can.shape[:2] + (3,), np.float32) * np.array([0.30, 0.42, 0.55], np.float32)
        tiles.append(L.u8(bg * (1 - can[..., 3:4]) + can[..., :3]))
    cv2.imwrite(od + '/owner_poses.jpg', np.hstack(tiles))
    can, A, an = compose(dict(arm_n=POSES['talk'], arm_f=POSES['lap'], jaw=0.4), 2.4, box=(-160, -1040, 220, -600))
    bg = np.ones(can.shape[:2] + (3,), np.float32) * np.array([0.30, 0.42, 0.55], np.float32)
    cv2.imwrite(od + '/owner_head.jpg', L.u8(bg * (1 - can[..., 3:4]) + can[..., :3]))
    print('ok')
