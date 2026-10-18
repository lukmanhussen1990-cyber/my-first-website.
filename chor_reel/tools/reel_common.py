"""Shared infrastructure for the vertical Chor recreation: shot table, original-Chor masks, fills, camera."""
import os, json
import numpy as np, cv2

S = os.environ.get('CHOR_S', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = S + '/src/A_original.mp4'
N_FRAMES = 1591
OW, OH = 1080, 1920

# ---------------------------------------------------------------- shots
# kind: ext (night exterior), int (amber interior), star (starfield), flash
SHOTS = [
    ('S1', 0, 71, 'ext'), ('S2', 72, 281, 'ext'), ('S3', 282, 341, 'ext'), ('T1', 342, 355, 'flash'),
    ('S4', 356, 407, 'int'), ('S5', 408, 464, 'int'), ('S6', 465, 547, 'int'), ('S7', 548, 690, 'int'),
    ('S8', 691, 785, 'int'), ('S9', 786, 894, 'int'), ('S10', 895, 965, 'star'), ('S11', 966, 1024, 'star'),
    ('S12', 1025, 1085, 'star'), ('S13', 1086, 1144, 'star'), ('S14', 1145, 1204, 'star'),
    ('S15', 1205, 1430, 'star'), ('S16', 1431, 1469, 'star'), ('S17', 1470, 1571, 'star'), ('S18', 1572, 1590, 'star'),
]


def shot_of(n):
    for sid, a, b, kind in SHOTS:
        if a <= n <= b:
            return sid, kind
    return SHOTS[-1][0], SHOTS[-1][3]


def band_rows(n):
    """Active (non-letterbox) source rows for frame n: bars slide open 45.15 s .. 46.05 s."""
    if n <= 1354:
        return 92, 628
    if n >= 1381:
        return 0, 720
    t = (n - 1354) / (1381 - 1354)
    t = t * t * (3 - 2 * t)
    return int(round(92 * (1 - t))), int(round(628 + 92 * t))


# ---------------------------------------------------------------- original Chor instances
def _load_track(name):
    d = json.load(open(f'{S}/assets/track/t_{name}.json'))
    return {int(k): v for k, v in d.items()}


_TR = {}


def track(name):
    if name not in _TR:
        _TR[name] = _load_track(name)
    return _TR[name]


_KM = {}


def keymask(k):
    if k not in _KM:
        _KM[k] = (cv2.imread(f'{S}/assets/keymask/km_{k}.png', 0) > 127).astype(np.uint8)
    return _KM[k]


# rigid-tracked shots: (name, key, first, last, fade_in(a,b) or None, fade_out(a,b) or None)
RIGID = [
    ('s4', 395, 350, 407, None, None),
    ('s5', 430, 408, 464, None, None),
    ('s7', 600, 548, 690, None, None),
    ('s8', 745, 691, 790, None, (781, 790)),
    ('s9a', 815, 781, 845, (781, 790), None),
    ('s9', 870, 846, 899, None, None),
    ('s10', 930, 900, 972, None, (962, 971)),
    ('s11', 990, 962, 1027, (962, 971), (1021, 1028)),
    ('s13', 1110, 1082, 1148, (1082, 1090), (1141, 1149)),
    ('s14', 1170, 1141, 1209, (1141, 1149), (1200, 1209)),
    ('s15', 1330, 1200, 1415, (1200, 1209), None),
    ('s16', 1400, 1416, 1482, None, None),
]
# frames where a track is extrapolated/held (track missing or unreliable)
HOLD = {'s10': (961, None), 's4': (356, 'back'), 's9a': (791, 'back'), 's16': (1400, 'static')}


def rigid_T(name, key, n):
    """Similarity (s, ox, oy) mapping keyframe coords -> frame n coords, or None."""
    if name == 's16':
        return (1.0, 0.0, 0.0)
    tr = track(name)
    if name == 's9a' and n < 791:
        n = 791                                   # s9 Chor static during the s8->s9 dissolve
    if name == 's10' and n > 961:
        n = 961
    if name == 's4' and n < 356:
        t0, t1 = tr[356], tr[358]
        k = 356 - n
        return (t0['s'] - (t1['s'] - t0['s']) / 2 * k, t0['ox'] - (t1['ox'] - t0['ox']) / 2 * k, t0['oy'] - (t1['oy'] - t0['oy']) / 2 * k)
    t = tr.get(n)
    if t is None:
        return None
    return (t['s'], t['ox'], t['oy'])


def ramp(n, ab, rising=True):
    a, b = ab
    t = np.clip((n - a + 0.5) / (b - a + 1), 0, 1)
    return float(t if rising else 1 - t)


COLOR_REFINE = {'s4': 34, 's5': 100, 's7': 30}       # amber-background shots: add blue-dominant pixels near the mask


def chor_instances(n, f=None):
    """List of dicts describing original-Chor instances in frame n: mask (720x1280 uint8), weight.
    f (uint8/float BGR frame) enables colour refinement on amber backgrounds."""
    out = []
    # exterior: per-frame masks
    if 70 <= n <= 356:
        p = f'{S}/assets/segm/extb_{n:04d}.png' if n <= 200 else f'{S}/assets/segm/extf_{n:04d}.png'
        if os.path.exists(p):
            m = (cv2.imread(p, 0) > 127).astype(np.uint8)
            out.append(dict(kind='ext', mask=m, w=1.0, name='ext'))
    for name, key, a, b, fin, fout in RIGID:
        if not (a <= n <= b):
            continue
        T = rigid_T(name, key, n)
        if T is None:
            continue
        s, ox, oy = T
        M = np.array([[s, 0, ox], [0, s, oy]], np.float32)
        m = cv2.warpAffine(keymask(key), M, (1280, 720), flags=cv2.INTER_NEAREST)
        if f is not None and name in COLOR_REFINE:
            fi = f.astype(np.int32) if f.dtype == np.uint8 else (f * 255).astype(np.int32)
            blue = (fi[..., 0] > fi[..., 2] + 8).astype(np.uint8)
            r_ = COLOR_REFINE[name]
            near = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r_ + 1, 2 * r_ + 1)))
            if name == 's4':
                # amber room: the thief is the only blue object -> colour mask (arm only where it really is)
                cm = cv2.morphologyEx(blue & near, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
                hh, ww = cm.shape
                ff = cv2.copyMakeBorder(cm, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
                cv2.floodFill(ff, np.zeros((hh + 4, ww + 4), np.uint8), (0, 0), 2)
                m = (ff[1:-1, 1:-1] != 2).astype(np.uint8)
            else:
                m = np.maximum(m, blue & near)
        w = 1.0
        if fin:
            w *= ramp(n, fin, True)
        if fout:
            w *= ramp(n, fout, False)
        hw = 1.0 - ramp(n, (1446, 1458), True) if name == 's16' else 1.0
        out.append(dict(kind='rigid', mask=m, w=w, hole_w=hw, name=name, key=key, T=T))
    return out


# ---------------------------------------------------------------- fills
def pushpull_fill(img, hole, valid_rows=None):
    """Fill hole (float HxW, 1 = fill) in img (float HxWx3) by normalised-convolution push-pull."""
    H, W = hole.shape
    ys, xs = np.where(hole > 0.01)
    if len(xs) == 0:
        return img
    pad = 72
    x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + pad + 1)
    roi = img[y0:y1, x0:x1]
    h = hole[y0:y1, x0:x1]
    valid = (h < 0.02).astype(np.float32)
    if valid_rows is not None:
        r0, r1 = valid_rows
        rr = np.arange(y0, y1)
        valid[(rr < r0) | (rr >= r1)] = 0
    levels = []
    c, w = roi * valid[..., None], valid
    while min(c.shape[:2]) > 6:
        levels.append((c, w))
        c, w = cv2.pyrDown(c), cv2.pyrDown(w)
    fill = c / np.maximum(w[..., None], 1e-6)
    for c_l, w_l in reversed(levels):
        up = cv2.resize(fill, (c_l.shape[1], c_l.shape[0]), interpolation=cv2.INTER_LINEAR)
        own = c_l / np.maximum(w_l[..., None], 1e-6)
        k = np.clip(w_l * 2.0, 0, 1)[..., None]
        fill = own * k + up * (1 - k)
    out = img.copy()
    hh = h[..., None]
    out[y0:y1, x0:x1] = roi * (1 - hh) + fill * hh
    return out


def soft_hole(mask, grow, feather):
    """Solid hole = mask dilated by `grow`; soft falloff of width ~feather outside it."""
    k = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    core = cv2.dilate(mask.astype(np.uint8), k(grow)).astype(np.float32)
    if feather <= 0:
        return core
    outer = cv2.dilate(mask.astype(np.uint8), k(grow + feather)).astype(np.float32)
    soft = cv2.GaussianBlur(outer, (0, 0), feather * 0.5)
    return np.maximum(core, soft)


# ---------------------------------------------------------------- frame reader
class Reader:
    def __init__(self, start=0):
        self.cap = cv2.VideoCapture(SRC)
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, start)
        self.n = start

    def read(self, n):
        if n != self.n:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, n)
            self.n = n
        ok, f = self.cap.read()
        self.n += 1
        return f


# ---------------------------------------------------------------- white flash 11.40-11.87 s (measured frame means)
_FLASH_MEAN = {341: 61.4, 342: 79.0, 343: 104.7, 344: 129.4, 345: 153.9, 346: 177.0, 347: 193.0, 348: 202.0,
               349: 201.3, 350: 191.9, 351: 172.2, 352: 146.2, 353: 116.5, 354: 85.9, 355: 62.0}


def flash_ext(n):
    """Opacity of composited exterior layers through the flash (1 before, 0 at the white peak)."""
    if n <= 340:
        return 1.0
    if n >= 348:
        return 0.0
    return float(np.clip(1 - (_FLASH_MEAN[n] - 56.8) / (202.0 - 56.8), 0, 1))


def flash_int(n):
    """Opacity of composited interior layers emerging from the flash."""
    if n >= 356:
        return 1.0
    if n <= 349:
        return 0.0
    return float(np.clip(1 - (_FLASH_MEAN[n] - 51.5) / (202.0 - 51.5), 0, 1))
