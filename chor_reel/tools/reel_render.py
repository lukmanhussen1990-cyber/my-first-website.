"""Vertical (1080x1920) recreation renderer: removal of the original Chor, environment extension,
upgraded house, new Chor compositing.  render_frame(n) -> uint8 BGR 1920x1080."""
import os, sys, json, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reel_common import (S, SRC, N_FRAMES, OW, OH, SHOTS, shot_of, band_rows, chor_instances, pushpull_fill,
                         soft_hole, Reader, track, flash_ext)
import reel_char

E = 640                       # extra source rows synthesised above and below the 720-row frame
_yv = np.arange(OH, dtype=np.float32)
VIGNETTE = (1 - 0.30 * np.clip(1 - _yv / 380.0, 0, 1) ** 2 - 0.30 * np.clip(1 - (OH - 1 - _yv) / 380.0, 0, 1) ** 2)[:, None].astype(np.float32)

# ------------------------------------------------------------------ framing (cx, W, Yc) keyframes per shot
FRAMING = {
    'S1': [(0, 800, 760, 1000), (71, 800, 760, 1000)],
    'S2': [(72, 840, 880, 1000), (110, 840, 880, 1000), (150, 585, 880, 1000), (200, 515, 880, 1000), (281, 540, 880, 1000)],
    'S3': [(282, 540, 880, 1000), (300, 490, 880, 1000), (341, 440, 880, 1000)],
    'T1': [(342, 440, 880, 1000), (348, 440, 880, 1000), (349, 860, 760, 960), (355, 860, 760, 960)],
    'S4': [(356, 870, 760, 960), (407, 860, 760, 960)],
    'S5': [(408, 765, 760, 960), (464, 765, 760, 960)],
    'S6': [(465, 520, 760, 960), (547, 520, 760, 960)],
    'S7': [(548, 440, 880, 960), (600, 460, 880, 960), (690, 760, 880, 960)],
    'S8': [(691, 800, 920, 960), (785, 800, 920, 960)],
    'S9': [(786, 820, 880, 960), (845, 820, 880, 960), (880, 710, 900, 960), (894, 720, 900, 960)],
    'S10': [(895, 770, 900, 960), (965, 770, 900, 960)],
    'S11': [(966, 730, 900, 960), (1024, 730, 900, 960)],
    'S12': [(1025, 830, 900, 960), (1085, 830, 900, 960)],
    'S13': [(1086, 830, 900, 960), (1144, 830, 900, 960)],
    'S14': [(1145, 820, 900, 960), (1204, 820, 900, 960)],
    'S15': [(1205, 745, 940, 960), (1300, 700, 960, 960), (1400, 660, 900, 960), (1430, 660, 900, 960)],
    'S16': [(1431, 660, 900, 960), (1469, 660, 900, 960)],
    'S17': [(1470, 640, 1000, 960), (1571, 640, 1000, 960)],
    'S18': [(1572, 640, 1000, 960), (1590, 640, 1000, 960)],
}


def framing(n):
    sid, _ = shot_of(n)
    keys = FRAMING[sid]
    if n <= keys[0][0]:
        return keys[0][1:]
    for (a, *pa), (b, *pb) in zip(keys, keys[1:]):
        if a <= n <= b:
            if b == a:
                return tuple(pb)
            t = (n - a) / (b - a)
            t = t * t * (3 - 2 * t)
            return tuple(pa[i] * (1 - t) + pb[i] * t for i in range(3))
    return keys[-1][1:]


def out_affine(n):
    """Affine mapping frame coords (x, y) -> output coords."""
    cx, W, Yc = framing(n)
    z = OW / W
    return np.array([[z, 0, -z * (cx - W / 2)], [0, z, Yc - z * 360]], np.float64), z


# ------------------------------------------------------------------ camera for synthetic star layers
_TE = None


def _te():
    global _TE
    if _TE is None:
        _TE = {r['i']: r for r in json.load(open(S + '/frames/track_ext.json'))}
    return _TE


_HT = None


def house_T(n):
    global _HT
    if _HT is None:
        _HT = {int(k): v for k, v in json.load(open(S + '/assets/track/house_T.json')).items()}
    if n in _HT:
        t = _HT[n]
        return t['s'], t['ox'], t['oy']
    return None


def sky_cam(n):
    """(s, ox, oy): sky-layer motion relative to an arbitrary reference (frame-space)."""
    sid, kind = shot_of(n)
    if kind == 'ext' or sid == 'T1':
        te = _te()
        def moon(k):
            m = te.get(k, {}).get('moon') if k in te else None
            return m
        # moon centre is the sky anchor; extrapolate outside the detected span (20..262)
        k = min(max(n, 20), 262)
        m = moon(k)
        if m is None:
            m = moon(60)
        x, y = m[0], m[1]
        if n < 20:
            m2 = moon(26)
            x += (m[0] - m2[0]) / 6 * (20 - n); y += (m[1] - m2[1]) / 6 * (20 - n)
        if n > 262:
            h0, h1 = house_T(262), house_T(min(n, 356))
            if h0 and h1:
                x += 0.77 * (h1[1] - h0[1]); y += 0.5 * (h1[2] - h0[2])
        return 1.0, x - 800.0, y - 200.0
    trk = {'S10': 's10', 'S11': 's11', 'S12': 's12', 'S13': 's13', 'S14': 's14', 'S15': 's15'}.get(sid)
    if trk:
        tr = track(trk)
        ks = sorted(tr)
        k = min(max(n, ks[0]), ks[-1])
        t = tr[k]
        return t['s'], t['ox'], t['oy']
    if sid in ('S16', 'S17', 'S18'):
        t = track('s15')[1415]
        return t['s'], t['ox'], t['oy']
    if sid == 'S9' and n > 845:
        t = track('s9')[min(n, 899)]
        return t['s'], t['ox'], t['oy']
    return 1.0, 0.0, 0.0


class StarSet:
    def __init__(self, seed, density, amp_med, amp_spread, area=(-1800, -1600, 3100, 2400)):
        rng = np.random.default_rng(seed)
        x0, y0, x1, y1 = area
        n = int((x1 - x0) * (y1 - y0) * density / 1e4)
        self.x = rng.uniform(x0, x1, n).astype(np.float32)
        self.y = rng.uniform(y0, y1, n).astype(np.float32)
        self.a = np.clip(rng.lognormal(math.log(amp_med), amp_spread, n), 6, 230).astype(np.float32) / 255
        self.tint = rng.uniform(0, 1, n).astype(np.float32)
        self.ph = rng.uniform(0, 2 * np.pi, n).astype(np.float32)


_STARS = {}


def stars_for(kind):
    if kind not in _STARS:
        if kind == 'ext':
            _STARS[kind] = (StarSet(11, 16, 45, 0.55), StarSet(12, 90, 11, 0.45))
        else:
            _STARS[kind] = (StarSet(21, 26, 55, 0.5), StarSet(22, 70, 13, 0.4))
    return _STARS[kind]


def render_stars(es_shape, kind, cam, n, scale_es=1.0):
    """Stars in ES coordinates (rows offset by E)."""
    H, W = es_shape[:2]
    img = np.zeros((H, W), np.float32)
    s, ox, oy = cam
    for k, st in enumerate(stars_for(kind)):
        x = ox + s * st.x
        y = oy + s * st.y + E
        ok = (x >= 1) & (x < W - 2) & (y >= 1) & (y < H - 2)
        xi, yi, a = x[ok], y[ok], st.a[ok]
        tw = 0.85 + 0.15 * np.sin(st.ph[ok] + n * 0.11)
        # bilinear splat
        x0 = np.floor(xi).astype(np.int32); y0 = np.floor(yi).astype(np.int32)
        fx, fy = xi - x0, yi - y0
        v = a * tw
        for dx, dy, w in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
            np.add.at(img, (y0 + dy, x0 + dx), v * w)
    img = cv2.GaussianBlur(img, (0, 0), 0.6) * 2.2
    glow = cv2.GaussianBlur(img, (0, 0), 2.0) * 0.35
    out = np.dstack([img * 1.0 + glow * 0.9, img * 0.86 + glow * 0.7, img * 0.84 + glow * 0.75])
    return out


# ------------------------------------------------------------------ fades (opening fade-in / closing fade-out)
_MET = None


def scene_gain(n):
    """Brightness of synthetic additions (stars, moon halo) relative to the shot's steady level."""
    global _MET
    if _MET is None:
        _MET = [(r['b'] + r['g'] + r['r']) / 3.0 for r in json.load(open(S + '/frames/A_metrics.json'))]
    if n < 60:
        return float(np.clip(_MET[n] / _MET[60], 0, 1))
    if n > 1560:
        return float(np.clip(_MET[n] / _MET[1560], 0, 1))
    return 1.0


# ------------------------------------------------------------------ extension
def _hblur(row, sigma):
    return cv2.GaussianBlur(row[None], (0, 0), sigmaX=sigma, sigmaY=0.1)[0]


def _ripples(shape, n):
    H, W = shape
    rng = np.random.default_rng(5)
    img = np.zeros((H, W), np.float32)
    k = 900
    ys = rng.uniform(0, H, k); xs = rng.uniform(-200, W + 200, k); ln = rng.uniform(14, 70, k); a = rng.uniform(0.25, 1.0, k)
    sp = rng.uniform(-0.25, 0.25, k)
    for x, y, l, aa, v in zip(xs, ys, ln, a, sp):
        xx = x + v * n
        cv2.line(img, (int(xx - l / 2), int(y)), (int(xx + l / 2), int(y)), float(aa), 1, cv2.LINE_AA)
    return cv2.GaussianBlur(img, (0, 0), 0.7)


_RIP = {}


def moon_pos(n):
    s_, ox, oy = sky_cam(n)
    return 800.0 + ox, 200.0 + oy


def moon_halo(n, X, Y):
    """Additive moon halo (BGR) at frame coords X (cols) / Y (rows) - measured profile."""
    mx, my = moon_pos(n)
    r = np.sqrt((X[None, :] - mx) ** 2 + (Y[:, None] - my) ** 2)
    h = (230.0 * np.exp(-r / 24.0) + 30.0 * np.exp(-r / 90.0)) / 255.0
    return h[..., None] * np.array([1.0, 0.96, 0.95], np.float32)[None, None]


def star_points(img, region_mask=None):
    """Point-like bright features (stars) of an image region, as an additive BGR layer."""
    med = cv2.medianBlur((np.clip(img, 0, 1) * 255).astype(np.uint8), 7).astype(np.float32) / 255
    st = np.clip(img - med - 0.015, 0, 1)
    if region_mask is not None:
        st = st * region_mask[..., None]
    return st


def _band_lowpass(fc, r0, r1, sigma=28):
    """Low-pass of the real band only (normalised so letterbox rows do not leak in)."""
    valid = np.zeros((720, 1), np.float32)
    valid[r0:r1] = 1
    num = cv2.GaussianBlur(fc * valid[..., None], (0, 0), sigma)
    den = cv2.GaussianBlur(np.repeat(valid, 1280, 1), (0, 0), sigma)
    return num / np.maximum(den[..., None], 1e-4)


def build_es(fc, n, kind):
    """Extended source image (720+2E rows): real band with its edge vignette lifted, plus a synthetic
    continuation of the environment (sky / water / walls / starfield) above and below."""
    r0, r1 = band_rows(n)
    opened = (92 - r0) / 92.0                              # 0 letterboxed .. 1 full frame
    VT = int(round(30 + 120 * opened))
    VB = int(round(30 + 120 * opened))
    r0e, r1e = r0 + 4, r1 - 4                              # trusted real rows
    r0s, r1s = r0e + VT, r1e - VB                          # rows beyond the vignette
    H = 720 + 2 * E
    es = np.zeros((H, 1280, 3), np.float32)
    xs = np.arange(1280, dtype=np.float32)
    lp = _band_lowpass(fc, r0e, r1e, sigma=12)
    # ---- smooth target colour per column at the sampling rows (vignette-free level)
    def colour_at(rows, blur, sky_only=False, halo=False):
        Yr = np.arange(rows[0], rows[1], dtype=np.float32)
        h = moon_halo(n, xs, Yr) * scene_gain(n) if halo else 0.0
        c = np.median(lp[rows[0]:rows[1]] - h, axis=0)
        if sky_only:
            sky = (c[:, 0] > 0.13) & (c[:, 0] > c[:, 2] + 0.06)
            mx, my = moon_pos(n)
            if abs(my - rows[0]) < 160:
                sky &= np.abs(xs - mx) > 80
            if sky.sum() > 50:
                c = np.stack([np.interp(xs, xs[sky], c[sky, k]) for k in range(3)], 1)
        return _hblur(c, blur)
    is_sky = kind in ('ext', 'star')
    ct = colour_at((r0s, r0s + 8), 160 if is_sky else 120, sky_only=(kind == 'ext'), halo=(kind == 'ext'))
    cb = colour_at((r1s - 8, r1s), 150 if kind != 'ext' else 45)
    # ---- the real band, with the low-frequency vignette replaced near the edges
    yr = np.arange(720, dtype=np.float32)
    wt = np.clip((yr - r0e) / max(1, (r0s + 6 - r0e)), 0, 1); wt = wt * wt * (3 - 2 * wt)
    wb = np.clip((r1e - 1 - yr) / max(1, (r1e - 1 - (r1s - 6))), 0, 1); wb = wb * wb * (3 - 2 * wb)
    w_band = np.minimum(wt, wb)[:, None, None]
    halo_band = moon_halo(n, xs, yr) * scene_gain(n) if kind == 'ext' else 0.0
    target_top = ct[None] + (halo_band if kind == 'ext' else 0.0)
    target = np.where((yr < 360)[:, None, None], target_top, cb[None])
    M = lp * w_band + target * (1 - w_band)
    gain = np.clip(M / np.maximum(lp, 1e-3), 0.6, 2.6)
    gain = cv2.GaussianBlur(gain, (0, 0), 6)
    band = fc * gain + (M - lp * gain)                    # exact low-frequency match, bounded detail gain
    es[E + r0e:E + r1e] = band[r0e:r1e]
    # ---- synthetic regions
    ytop, ybot = E + r0e, E + r1e                          # first real row / first synthetic row below
    d_top = (ytop - np.arange(0, ytop, dtype=np.float32))[:, None, None]
    d_bot = (np.arange(ybot, H, dtype=np.float32) - ybot + 1)[:, None, None]
    Ytop_f = np.arange(0, ytop, dtype=np.float32) - E      # frame-row coordinates of synthetic rows
    if kind == 'ext':
        top = ct[None] * (0.72 + 0.28 * np.exp(-d_top / 520.0)) + moon_halo(n, xs, Ytop_f) * scene_gain(n)
        bot = cb[None] * (0.74 + 0.26 * np.exp(-d_bot / 520.0))
        rip = _ripples((len(d_bot), 1280), n)
        bot = bot * (1 + 0.30 * rip[..., None] * (0.4 + 0.6 * np.exp(-d_bot / 600.0)))
    elif kind == 'star':
        top = ct[None] * (0.70 + 0.30 * np.exp(-d_top / 480.0))
        far = ct * 0.80                                    # bottom fades into the same starry night as above
        bot = far[None] + (cb[None] - far[None]) * np.exp(-d_bot / 150.0)
    else:
        top = ct[None] * (0.22 + 0.78 * np.exp(-d_top / 220.0))
        bot = cb[None] * (0.18 + 0.82 * np.exp(-d_bot / 160.0))
    # stars: mirrored point features of the (un-vignetted) band rows next to the edge + procedural field
    MR = 110
    if is_sky:
        bt = band[r0e:r0e + MR]
        rm = None
        if kind == 'ext':
            rm = ((bt[..., 0] > 0.13) & (bt[..., 0] > bt[..., 2] + 0.06)).astype(np.float32)
            rm = cv2.erode(rm, np.ones((5, 5), np.uint8))
        st_b = star_points(bt, rm)
        k = min(MR, ytop)
        j = np.arange(k)
        top[(ytop - 1 - j).astype(int)] += st_b[j] * np.exp(-j / 70.0)[:, None, None]
        stf = render_stars((H, 1280), kind, sky_cam(n), n) * scene_gain(n)
        st_mean = stf[:ytop].reshape(-1, 3).mean(axis=0)
        top += (stf[:ytop] - st_mean[None, None]) * np.clip(d_top / 70.0, 0, 1)
        top -= st_b[:k].reshape(-1, 3).mean(axis=0)[None, None] * 0.5 * np.exp(-d_top / 70.0)
    if kind == 'star':
        g = band[r1e - 60:r1e].mean(axis=2)
        bgm = cv2.medianBlur((np.clip(g, 0, 1) * 255).astype(np.uint8), 7).astype(np.float32) / 255
        starry = float(np.clip(((g - bgm) > 0.05).mean() / 0.008, 0, 1))
        if starry > 0:
            bb = band[r1e - MR:r1e]
            st_bb = star_points(bb)
            j = np.arange(min(MR, H - ybot))
            bot[j] += st_bb[MR - 1 - j] * np.exp(-j / 70.0)[:, None, None] * starry
            pass
        bot += (stf[ybot:] - stf[ybot:].reshape(-1, 3).mean(axis=0)[None, None]) * np.maximum(np.clip(d_bot / 70.0, 0, 1) * starry, 1 - np.exp(-d_bot / 150.0))
    es[:ytop] = top
    es[ybot:] = bot
    # short seam blend (2 rows) to avoid a hard step
    for k_ in (0, 1):
        es[ytop + k_] = es[ytop + k_] * (0.5 + 0.25 * k_) + top[-1] * (0.5 - 0.25 * k_)
        es[ybot - 1 - k_] = es[ybot - 1 - k_] * (0.5 + 0.25 * k_) + bot[0] * (0.5 - 0.25 * k_)
    rng = np.random.default_rng(n * 7 + 1)
    gr = rng.normal(0, 0.006, (H, 1280, 1)).astype(np.float32)
    syn = np.ones((H, 1, 1), np.float32)
    syn[ytop:ybot] = 0
    es += gr * syn
    return es


# ------------------------------------------------------------------ house
_HOUSE = None


def house_layers():
    global _HOUSE
    if _HOUSE is None:
        L = np.load(S + '/assets/house/house.npz')
        _HOUSE = {k: (L[k].astype(np.float32) / 255 if k != 'meta' else L[k]) for k in L.files}
    return _HOUSE


# original-house parts that the new roof may not hide (reference coords) -> erased before compositing
ORIG_HOUSE_TOP = [
    [(-14, 121), (446, 121), (446, 145), (-14, 145)],          # flat roof slab
    [(300, 40), (404, 40), (404, 130), (300, 130)],            # rooftop railing
    [(96, 40), (262, 40), (262, 106), (96, 106)],              # dark canopy arc behind the roof
]


def door_open_amount(f, T):
    """0 = original door closed (dark), 1 = fully lit, measured inside the original door."""
    s, ox, oy = T
    x0, x1 = int(ox + s * 306), int(ox + s * 368)
    y0, y1 = int(oy + s * 300), int(oy + s * 410)
    x0, x1 = max(0, x0), min(1280, x1); y0, y1 = max(0, y0), min(720, y1)
    if x1 <= x0 or y1 <= y0:
        return 0.0
    L = f[y0:y1, x0:x1].mean()
    return float(np.clip((L - 0.09) / (0.55 - 0.09), 0, 1))


def composite_house(out, n, A_frame2out, f_src, opacity=1.0):
    T = house_T(n)
    if T is None:
        return out
    s, ox, oy = T
    L = house_layers()
    SC, X0, Y0 = float(L['meta'][0]), float(L['meta'][1]), float(L['meta'][2])
    # house canvas -> ref -> frame -> out
    Mh = np.array([[s / SC, 0, ox + s * X0], [0, s / SC, oy + s * Y0], [0, 0, 1]], np.float64)
    A = (np.vstack([A_frame2out, [0, 0, 1]]) @ Mh)[:2].astype(np.float32)
    def warp(k, ch=3):
        return cv2.warpAffine(L[k], A, (OW, OH), flags=cv2.INTER_LINEAR, borderValue=0)
    dopen = door_open_amount(f_src, T)
    pa = warp('plat_a')[..., None] * opacity
    out = out * (1 - pa * 0.5) + warp('plat_rgb') * pa * 0.5
    ba = warp('base_a')[..., None] * opacity
    out = out * (1 - ba) + warp('base_rgb') * opacity
    da = warp('door_a')[..., None] * (1 - dopen) * opacity
    out = out * (1 - da) + warp('door_rgb') * (1 - dopen) * opacity
    out = out + warp('glow') * opacity + warp('glow_door') * dopen * 0.6 * opacity
    return out


def house_erase_mask(n):
    T = house_T(n)
    if T is None:
        return None
    s, ox, oy = T
    m = np.zeros((720, 1280), np.uint8)
    for poly in ORIG_HOUSE_TOP:
        p = np.array([[ox + s * x, oy + s * y] for x, y in poly], np.int32)
        cv2.fillPoly(m, [p], 1)
    return m


# ------------------------------------------------------------------ main
def render_frame(reader, n, debug=None):
    f8 = reader.read(n)
    f = f8.astype(np.float32) / 255
    sid, kind = shot_of(n)
    r0, r1 = band_rows(n)
    # 1) remove the original Chor (+ his water reflection) and stray original-house parts
    hole = np.zeros((720, 1280), np.float32)
    insts = chor_instances(n, f8)
    for it in insts:
        m = it['mask']
        hole = np.maximum(hole, soft_hole(m, 9 if it['kind'] == 'rigid' else 7, 8) * it.get('hole_w', 1.0))
        if it['kind'] == 'ext' and n <= 286:
            refl = reel_char.reflection_mask(m)
            if refl is not None:
                hole = np.maximum(hole, soft_hole(refl, 6, 8))
    if kind == 'ext' or sid == 'T1':
        hm = house_erase_mask(n)
        if hm is not None:
            hole = np.maximum(hole, hm.astype(np.float32))
    fc = pushpull_fill(f, hole, valid_rows=(r0 + 2, r1 - 2)) if hole.max() > 0 else f
    # 2) extended canvas and vertical crop
    k_ext = 'ext' if kind in ('ext',) or (sid == 'T1' and n <= 348) else ('star' if kind == 'star' else 'int')
    if sid == 'S9' and n >= 880:
        # room dissolves into the starfield: blend extension styles
        es_i = build_es(fc, n, 'int'); es_s = build_es(fc, n, 'star')
        w = np.clip((n - 880) / 20.0, 0, 1)
        es = es_i * (1 - w) + es_s * w
    else:
        es = build_es(fc, n, k_ext)
    A, z = out_affine(n)
    A_es = A.copy(); A_es[1, 2] -= A[1, 1] * E          # ES rows are offset by E
    out = cv2.warpAffine(es, A_es.astype(np.float32), (OW, OH), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
    # 3) house
    if (kind == 'ext' or (sid == 'T1' and n <= 349)) and n >= 96:
        out = composite_house(out, n, A, f, flash_ext(n))
    # 4) new Chor
    out = reel_char.composite_characters(out, n, A, z, f, insts)
    out = out * VIGNETTE[..., None]
    out = np.clip(out, 0, 1)
    return (out * 255 + 0.5).astype(np.uint8)


if __name__ == '__main__':
    frames = [int(v) for v in sys.argv[1].split(',')]
    od = sys.argv[2]
    os.makedirs(od, exist_ok=True)
    rd = Reader(frames[0])
    for n in frames:
        img = render_frame(rd, n)
        cv2.imwrite(f'{od}/v_{n:04d}.png', img)
        print('rendered', n, flush=True)
