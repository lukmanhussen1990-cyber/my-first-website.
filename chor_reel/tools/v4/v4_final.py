"""v4 frames 1470-1590 (16:9, full frame - the original's letterbox has opened): star pictures of everything
taken, the original title (चोर / JUSTH) at its original place, and the original's fade to black."""
import os, sys, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
for _d in ("v3", "v2"):  # shared helpers
    sys.path.insert(1, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), _d))
import v2lib as L
import v2_fx as F2
import v2_final as V2F
import v4_fx as FX
import v4_story as ST

S = L.S
_TITLE = None


def title_alpha():
    """the title cut from the original film (frame 1560), at 1.5x for 1080p"""
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
        up = cv2.resize(a, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)
        up = cv2.GaussianBlur(up, (0, 0), 0.6)
        up = np.clip((up - 0.25) / 0.40, 0, 1)
        _TITLE = (up * up * (3 - 2 * up)).astype(np.float32)
    return _TITLE


PICTURES = [
    (V2F._scales, (400, 300), 150, 1468),
    (F2.icon_house, (760, 230), 150, 1474),
    (F2.icon_kite, (190, 520), 110, 1480),
    (lambda: F2.icon_chest(0.0), (1640, 300), 110, 1486),
    (V2F._spiral, (1440, 175), 170, 1492),
    (V2F._birds, (980, 160), 120, 1498),
]


def constellations(img, n, cam):
    lay = FX.Layer(cam)
    for fn, (cx, cy), size, t0 in PICTURES:
        k = F2.ease(F2.ramp(n, t0, t0 + 16))
        if k <= 0:
            continue
        for stk in F2.xf(fn(), cx, cy, size):
            lay.poly(stk, np.array([0.85, 0.80, 0.78], np.float32), 0.33 * k, 1.0)
            tw = [k * (0.75 + 0.25 * math.sin(n * 0.2 + i + cx)) for i in range(len(stk))]
            lay.dots([p[0] for p in stk], [p[1] for p in stk], tw, F2.WHITE, r=3.0)
    lay.apply(img, glow=5.0, gain=0.9)


def render(n):
    cam = ST.cam_at(n)
    img = ST.render_frame(n)
    constellations(img, n, cam)
    k = V2F.title_k(n)
    if k > 0:
        a = title_alpha()
        th, tw = a.shape
        x0, y0 = int(830 * 1.5), int(395 * 1.5)
        glow = L.blur(a, 8) * 0.75
        reg = img[y0:y0 + th, x0:x0 + tw]
        col = np.array([0.74, 0.92, 0.99], np.float32)
        reg[:] = reg * (1 - a[..., None] * k) + col * a[..., None] * k + glow[..., None] * np.array([0.30, 0.55, 0.75], np.float32) * k
    return img * V2F.end_fade(n)
