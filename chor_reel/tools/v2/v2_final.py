"""Frames 1470-1590: star pictures of everything taken, the original title (चोर / JUSTH), fade to black."""
import os, sys, math, json
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import v2lib as L
import v2_fx as FX
import v2_story as ST
from v2_room import W, H

S = L.S
_TITLE = None


def title_alpha():
    """Title mask cut from the original film (frame 1560): चोर (bright core) + rule + J U S T H, clean edges."""
    global _TITLE
    if _TITLE is None:
        cap = cv2.VideoCapture(S + '/src/A_original.mp4')
        cap.set(cv2.CAP_PROP_POS_FRAMES, 1560)
        f = cap.read()[1][395:560, 830:1040].astype(np.float32)
        mx = f.max(axis=2)
        a = np.zeros_like(mx)
        a[:125] = np.clip((mx[:125] - 175) / (240 - 175), 0, 1)
        a[125:] = np.clip((mx[125:] - 95) / (185 - 95), 0, 1)
        n, lab, st, _ = cv2.connectedComponentsWithStats((a > 0.3).astype(np.uint8), 8)
        keep = np.zeros_like(a)
        for k in range(1, n):
            area, top = st[k, cv2.CC_STAT_AREA], st[k, cv2.CC_STAT_TOP]
            if (top < 120 and area >= 40) or (top >= 120 and area >= 6):
                keep[lab == k] = 1
        a = a * cv2.dilate(keep, np.ones((3, 3), np.uint8))
        up = cv2.resize(a, None, fx=2.4, fy=2.4, interpolation=cv2.INTER_CUBIC)
        up = cv2.GaussianBlur(up, (0, 0), 0.8)
        up = np.clip((up - 0.25) / 0.40, 0, 1)
        _TITLE = (up * up * (3 - 2 * up)).astype(np.float32)
    return _TITLE


def title_k(n):
    """Fade-in measured from the original title (frames 1500-1524)."""
    pts = [(1500, 0.0), (1504, 0.05), (1508, 0.17), (1512, 0.44), (1516, 0.72), (1520, 0.92), (1524, 0.98), (1528, 1.0)]
    if n <= 1500:
        return 0.0
    if n >= 1528:
        return 1.0
    for (a, va), (b, vb) in zip(pts, pts[1:]):
        if a <= n <= b:
            return va + (vb - va) * (n - a) / (b - a)
    return 1.0


_MET = None


def end_fade(n):
    global _MET
    if _MET is None:
        _MET = [(r['b'] + r['g'] + r['r']) / 3.0 for r in json.load(open(S + '/frames/A_metrics.json'))]
    if n < 1566:
        return 1.0
    return float(np.clip(_MET[n] / _MET[1564], 0, 1))


# star pictures (set-space centre, size, icon, stagger)
def _scales():
    s = [[(-0.7, -0.35), (0.7, -0.35)], [(0, -0.6), (0, -0.35)],
         [(-0.7, -0.35), (-0.95, 0.25), (-0.45, 0.25), (-0.7, -0.35)], [(0.7, -0.35), (0.45, 0.25), (0.95, 0.25), (0.7, -0.35)]]
    return s


def _spiral():
    pts = []
    for i in range(26):
        t = i / 25 * 3.0 * math.pi
        r = 0.08 + 0.42 * t / (3.0 * math.pi)
        pts.append((r * math.cos(t), r * 0.8 * math.sin(t)))
    return [pts]


def _birds():
    out = []
    for dx, dy, s in ((-0.5, 0.1, 0.8), (0.0, -0.15, 1.0), (0.45, 0.12, 0.7)):
        for st in FX.bird_strokes(1.0):
            out.append([(dx + s * x, dy + s * y) for x, y in st])
    return out


PICTURES = [
    (_scales, (290, 330), 190, 1468),
    (FX.icon_house, (790, 250), 200, 1474),
    (FX.icon_kite, (120, 590), 150, 1480),
    (lambda: FX.icon_chest(0.0), (930, 560), 140, 1486),
    (_spiral, (540, 140), 230, 1492),
    (_birds, (620, 520), 150, 1498),
]


def constellations(img, n, cam):
    lay = FX.Layer(cam)
    rng = np.random.default_rng(7)
    for fn, (cx, cy), size, t0 in PICTURES:
        k = FX.ease(FX.ramp(n, t0, t0 + 16))
        if k <= 0:
            continue
        strokes = FX.xf(fn(), cx, cy, size)
        for st in strokes:
            lay.poly(st, np.array([0.85, 0.80, 0.78], np.float32), 0.33 * k, 1.1)
            xs = [p[0] for p in st]
            ys = [p[1] for p in st]
            tw = [k * (0.75 + 0.25 * math.sin(n * 0.2 + i + cx)) for i in range(len(st))]
            lay.dots(xs, ys, tw, FX.WHITE, r=3.2)
    lay.apply(img, glow=5.0, gain=0.9)


def render(n):
    cam = ST.cam_of('S17', n)
    img = ST.render_shot(n, 'S17')
    constellations(img, n, cam)
    k = title_k(n)
    if k > 0:
        a = title_alpha()
        th, tw = a.shape
        cx, cy = 720, 1440
        x0, y0 = int(cx - tw / 2), int(cy - th / 2)
        glow = L.blur(a, 10) * 0.75
        reg = img[y0:y0 + th, x0:x0 + tw]
        col = np.array([0.74, 0.92, 0.99], np.float32)
        reg[:] = reg * (1 - a[..., None] * k) + col * a[..., None] * k + glow[..., None] * np.array([0.30, 0.55, 0.75], np.float32) * k
    return img * end_fade(n)
