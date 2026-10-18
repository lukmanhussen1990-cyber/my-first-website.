"""New Chor (the fat-guy character from Asset B) - natural colours kept as requested.
Pose timeline, placement from the original Chor's geometry, compositing with outline glow, rim light,
boat occlusion and water reflection."""
import os, json, math
import numpy as np, cv2
from reel_common import S, OW, OH, shot_of, track, RIGID, rigid_T, keymask, ramp, flash_ext, flash_int

LAV = np.array([230, 198, 207], np.float32) / 255       # original Chor outline colour (BGR)

# ------------------------------------------------------------------ sprites
_SPR = {}


def seq(name):
    if name not in _SPR:
        d = np.load(f'{S}/assets/char/{name}.npz')
        rgba = d['rgba'].astype(np.float32) / 255
        if name == 'idle':
            rgba = rgba[5:]                  # first frames carry bush remnants at the feet
        geo = []
        for r in rgba:
            a = r[..., 3] > 0.5
            ys, xs = np.where(a)
            top, bot = ys.min(), ys.max()
            h = bot - top
            hx = xs.min(); hy = float(np.median(ys[xs <= hx + 3]))
            low = ys > top + 0.7 * h
            bc = float(xs[low].mean())
            fb = float(np.median(xs[ys >= bot - 4]))
            geo.append(dict(top=float(top), bot=float(bot), h=float(h), hx=float(hx), hy=hy, bc=bc, foot_x=fb,
                            x0=float(xs.min()), x1=float(xs.max())))
        _SPR[name] = (rgba, geo)
    return _SPR[name]


def pingpong(i, n):
    if n <= 1:
        return 0
    p = 2 * (n - 1)
    i = i % p
    return i if i < n else p - i


# ------------------------------------------------------------------ original-Chor reference geometry (frame coords at keyframe)
# hand tip (x, y), body centre x of lower body (None if cut), height estimate
KEYGEO = {
    395: dict(hand=(887, 352), bc=1106.8, h=470),
    600: dict(hand=(969, 336), bc=1118.6, h=343),
    745: dict(hand=(916, 357), bc=1117.6, h=430),
    815: dict(hand=(1074, 359), bc=None, h=362),
    870: dict(hand=(894, 402), bc=1026.2, h=297),
    930: dict(hand=(949, 454), bc=1119.6, h=380),
    990: dict(hand=(1150, 388), bc=None, h=400),
    1110: dict(hand=(1099, 337), bc=None, h=420),
    1170: dict(hand=(1108, 428), bc=None, h=430),
    1330: dict(hand=(854, 355), bc=1003.4, h=335),
    1400: dict(hand=(814, 363), bc=944.3, h=278),
}
REACH_REF = 27          # reach-sequence frame used for placement (arm fully extended)


def placement_reach(key):
    """2x3 sprite->keyframe-frame transform for the reach pose."""
    rgba, geo = seq('reach')
    g = geo[REACH_REF]
    kg = KEYGEO[key]
    hx, hy = kg['hand']
    sc_h = kg['h'] / g['h']
    if kg['bc'] is not None:
        sc = (kg['bc'] - hx) / (g['bc'] - g['hx'])
        sc = float(np.clip(sc, 0.9 * sc_h, 1.12 * sc_h))
    else:
        sc = sc_h
    # hand tip of the sprite onto the original hand tip
    tx = hx - sc * g['hx'] - 6 * sc
    ty = hy - sc * g['hy']
    return np.array([[sc, 0, tx], [0, sc, ty]], np.float64)


def compose(A, B):
    """A o B for 2x3 affines."""
    return (np.vstack([A, [0, 0, 1]]) @ np.vstack([B, [0, 0, 1]]))[:2]


# ------------------------------------------------------------------ exterior (boat / walk / doorway) geometry from per-frame masks
_EXT = None


def ext_geometry():
    """Smoothed per-frame bottom-centre, top and bottom of the original Chor (frames 70..356)."""
    global _EXT
    if _EXT is not None:
        return _EXT
    from scipy.signal import savgol_filter
    ns = list(range(70, 357))
    bx, by, top = [], [], []
    for n in ns:
        p = f'{S}/assets/segm/extb_{n:04d}.png' if n <= 200 else f'{S}/assets/segm/extf_{n:04d}.png'
        m = cv2.imread(p, 0) if os.path.exists(p) else None
        if m is None:
            bx.append(np.nan); by.append(np.nan); top.append(np.nan); continue
        ys, xs = np.where(m > 127)
        b = ys.max()
        bx.append(float(xs[ys >= b - 10].mean())); by.append(float(b)); top.append(float(ys.min()))
    bx, by, top = map(np.array, (bx, by, top))
    for arr in (bx, by, top):
        bad = np.isnan(arr)
        if bad.any():
            arr[bad] = np.interp(np.where(bad)[0], np.where(~bad)[0], arr[~bad])
    # frames cut by the right frame edge (70..76): x from the mask centroid is biased -> extrapolate from 77..90
    k = [i for i, n in enumerate(ns) if 77 <= n <= 90]
    pf = np.polyfit([ns[i] for i in k], [bx[i] for i in k], 2)
    for i, n in enumerate(ns):
        if n < 77:
            bx[i] = np.polyval(pf, n)
    seg = lambda a, w: savgol_filter(a, w, 2)
    bxs, bys, tops = seg(bx, 9), seg(by, 9), seg(top, 7)
    # the rise (178..190) changes the height quickly: keep less smoothing there
    _EXT = {n: dict(bx=float(bxs[i]), by=float(bys[i]), top=float(tops[i]), bot_raw=float(by[i])) for i, n in enumerate(ns)}
    return _EXT


def reflection_mask(m):
    ys, xs = np.where(m > 0)
    if len(ys) == 0:
        return None
    b = ys.max()
    yw = b + 7
    out = np.zeros_like(m)
    h = b - ys.min()
    src = m[max(0, b - h):b + 1]
    flip = src[::-1]
    y0 = yw; y1 = min(720, yw + flip.shape[0])
    out[y0:y1] = flip[:y1 - y0]
    return out


# ------------------------------------------------------------------ rendering helpers
def warp_sprite(rgba, M, out_shape=(OH, OW)):
    """Warp a straight-alpha sprite with 2x3 M (sprite->out). Returns premultiplied rgb, alpha (out size)."""
    s = math.sqrt(abs(M[0, 0] * M[1, 1] - M[0, 1] * M[1, 0]))
    src = rgba
    M = M.copy()
    if s < 0.75:
        f = max(s * 1.25, 0.05)
        src = cv2.resize(rgba, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
        M = compose(M, np.array([[1 / f, 0, 0], [0, 1 / f, 0]]))
    pm = np.dstack([src[..., :3] * src[..., 3:4], src[..., 3:4]])
    w = cv2.warpAffine(pm, M.astype(np.float32), (out_shape[1], out_shape[0]), flags=cv2.INTER_LINEAR, borderValue=0)
    return w[..., :3], np.clip(w[..., 3], 0, 1)


def bbox_of(a, thr=0.01, pad=40):
    ys, xs = np.where(a > thr)
    if len(xs) == 0:
        return None
    return max(0, xs.min() - pad), max(0, ys.min() - pad), min(a.shape[1], xs.max() + pad + 1), min(a.shape[0], ys.max() + pad + 1)


def stylise_and_composite(out, prgb, a, style, opacity):
    """Natural-colour character over `out` with subtle integration (exposure, rim, glow outline)."""
    bb = bbox_of(a)
    if bb is None or opacity <= 0.001:
        return out
    x0, y0, x1, y1 = bb
    o = out[y0:y1, x0:x1]
    p = prgb[y0:y1, x0:x1] * style.get('exposure', 1.0)
    al = a[y0:y1, x0:x1]
    sc = style.get('px', 1.0)                                  # output px per sprite feature scale
    # rim light from a direction (inside the silhouette near the edge facing the light)
    rim = np.zeros_like(al)
    for (dx, dy, col, k) in style.get('rims', []):
        shift = np.roll(np.roll(al, int(round(dx * sc)), axis=1), int(round(dy * sc)), axis=0)
        r = np.clip(al - shift, 0, 1)
        r = cv2.GaussianBlur(r, (0, 0), max(0.8, 1.2 * sc))
        p = p + (r * k)[..., None] * np.array(col, np.float32)[None, None] * al[..., None]
    o = o * (1 - (al * opacity)[..., None]) + p * opacity
    # glow outline (outside the silhouette) in the original Chor's lavender
    g = style.get('glow', 0.0)
    if g > 0:
        ring = np.clip(cv2.GaussianBlur(al, (0, 0), max(1.0, 1.6 * sc)) - al, 0, 1)
        halo = cv2.GaussianBlur(al, (0, 0), max(3.0, 7.0 * sc)) * (1 - al)
        line = np.clip(ring * 3.0, 0, 1)
        o = o + (line * 0.55 + halo * 0.45)[..., None] * LAV[None, None] * g * opacity
    out[y0:y1, x0:x1] = o
    return out


def water_reflection(out, prgb, a, y_w, n, opacity, x_clip=None):
    """Mirror the composited character below the waterline y_w (output coords) with ripples."""
    bb = bbox_of(a, pad=6)
    if bb is None:
        return out
    x0, y0, x1, y1 = bb
    h = int(y_w) - y0
    if h <= 4:
        return out
    yy = np.arange(int(y_w), min(OH, int(y_w) + int(h * 0.95)))
    if len(yy) == 0:
        return out
    d = (yy - y_w) / 0.95
    src_y = np.clip((y_w - d).astype(np.float32), 0, OH - 1)
    xs = np.arange(x0, x1, dtype=np.float32)
    ripple = 2.2 * np.sin(yy[:, None] * 0.21 + n * 0.35) + 1.2 * np.sin(yy[:, None] * 0.07 - n * 0.2)
    mapx = (xs[None, :] + ripple).astype(np.float32)
    mapy = np.repeat(src_y[:, None], len(xs), axis=1).astype(np.float32)
    rp = cv2.remap(prgb, mapx, mapy, cv2.INTER_LINEAR, borderValue=0)
    ra = cv2.remap(a, mapx, mapy, cv2.INTER_LINEAR, borderValue=0)
    fade = (np.exp(-d / (h * 0.55)) * opacity)[:, None]
    tint = np.array([0.62, 0.42, 0.40], np.float32)
    rp = cv2.GaussianBlur(rp, (0, 0), 1.2) * tint
    ra = cv2.GaussianBlur(ra, (0, 0), 1.2) * fade
    if x_clip is not None:
        ra = ra * (xs[None, :] > x_clip)
    reg = out[yy[0]:yy[-1] + 1, x0:x1]
    out[yy[0]:yy[-1] + 1, x0:x1] = reg * (1 - ra[..., None] * 0.38) + rp * fade[..., None] * 0.38
    return out


# ------------------------------------------------------------------ per-frame instances
_HTZ = None


def cam_zoom(n):
    """Camera zoom of the exterior shots (house-track scale), constant outside the tracked span."""
    global _HTZ
    if _HTZ is None:
        _HTZ = {int(k): v['s'] for k, v in json.load(open(f'{S}/assets/track/house_T.json')).items()}
    k = min(max(n, min(_HTZ)), max(_HTZ))
    return _HTZ[k]


RISE0, RISE1 = 182, 186        # he stands up in the boat (the original cone rises over ~178..190)


def ext_instance(n):
    """[(sprite name, index, 2x3 sprite->frame transform, weight)] for the exterior Chor (frames 70..349).
    Each pose keeps a fixed size (only the camera zoom changes it); the kneel->stand switch is a short
    blend of one opaque layer."""
    G = ext_geometry()
    if n not in G:
        return []
    g = G[n]
    t = float(np.clip((n - RISE0) / (RISE1 - RISE0), 0, 1))
    out = []
    if t < 1:
        rgba, geo = seq('kneel')
        sg = geo[0]
        nk = min(n, 176)
        h_t = (G[nk]['by'] - G[nk]['top']) * 1.04 * cam_zoom(n) / cam_zoom(nk)
        sc = h_t / sg['h']
        tx = g['bx'] - sc * sg['foot_x'] + 4 * sc
        ty = g['by'] + 3 - sc * sg['bot']
        out.append(('kneel', 0, np.array([[sc, 0, tx], [0, sc, ty]]), 1 - t))
    if t > 0:
        rgba, geo = seq('idle')
        i = pingpong(max(0, n - 176) // 3, len(geo))
        sg = geo[i]
        ni = max(n, 192)
        h_t = (G[ni]['by'] - G[ni]['top']) * 0.98 * cam_zoom(n) / cam_zoom(ni)
        sc = h_t / sg['h']
        tx = g['bx'] - sc * sg['foot_x']
        on_boat = n <= 284
        ty = g['by'] + (4 if on_boat else 1) - sc * sg['bot']
        if 284 < n < 318:                                   # walking bob from the boat to the door
            ty -= abs(math.sin((n - 284) / 7.5 * math.pi)) * 0.02 * h_t
        out.append(('idle', i, np.array([[sc, 0, tx], [0, sc, ty]]), t))
    return out


_I2R = None


def idle_to_reach():
    """2x3 map from idle-sprite coords to reach-sprite coords (same feet, same height)."""
    global _I2R
    if _I2R is None:
        gr = seq('reach')[1][REACH_REF]
        gi = seq('idle')[1][0]
        sc = gr['h'] / gi['h']
        _I2R = np.array([[sc, 0, gr['bc'] - sc * gi['bc']], [0, sc, gr['bot'] - sc * gi['bot']]])
    return _I2R


def rigid_pose(name, n):
    """List of (sequence, index, weight) for the new Chor in a rigid-tracked shot (weights sum to 1)."""
    nr = len(seq('reach')[1])
    ni = len(seq('idle')[1])
    hold = [('reach', 24 + pingpong(n // 3, nr - 24), 1.0)]
    idle = lambda w: ('idle', pingpong(n // 3, ni), w)
    sm = lambda t: float(np.clip(t, 0, 1)) ** 2 * (3 - 2 * float(np.clip(t, 0, 1)))
    if name == 's4':                       # glides in with arms down, raises the arm at 375..382
        if n < 375:
            return [idle(1.0)]
        if n < 383:
            return [('reach', int(round(sm((n - 374) / 8.0) * REACH_REF)), 1.0)]
        return hold
    if name in ('s15', 's16') and n >= 1404:   # lowers the arm at 1404..1410, then stands until he dissolves
        if n < 1410:
            return [('reach', int(round(REACH_REF * (1 - sm((n - 1403) / 6.0)))), 1.0)]
        return [idle(1.0)]
    return hold


def composite_characters(out, n, A_frame2out, z, f_src, insts):
    sid, kind = shot_of(n)
    A = np.asarray(A_frame2out, np.float64)
    # ---------------- exterior
    if 70 <= n <= 349:
        flash = flash_ext(n)
        G = ext_geometry()
        prgb = a = None
        px = 1.0
        for name, idx, Mi, wt in ext_instance(n):
            rgba, geo = seq(name)
            M = compose(A, Mi)
            pr, al = warp_sprite(rgba[idx], M)
            prgb = pr * wt if prgb is None else prgb + pr * wt
            a = al * wt if a is None else a + al * wt
            px = float(np.sqrt(abs(np.linalg.det(M[:, :2])))) * 3.0
        if prgb is not None:
            style = dict(exposure=0.93, glow=0.38, px=px,
                         rims=[(3, -2, (0.45, 0.32, 0.30), 0.55),      # cool moonlight from the upper right
                               (-3, 0, (0.10, 0.28, 0.45), 0.35)])     # warm spill from the house side
            if n <= 286:
                # reflection in the lake (below the boat), then the boat hull in front of his feet
                y_w = (A @ np.array([0, G[n]['bot_raw'] + 7, 1.0]))[1]
                out = water_reflection(out, prgb * flash, a * flash, y_w, n, 1.0)
            out = stylise_and_composite(out, prgb, a, style, flash)
        if n <= 286:
            out = boat_occluder(out, n, A, f_src)
        return out
    # ---------------- rigid shots
    for name, key, a0, b0, fin, fout in RIGID:
        if not (a0 <= n <= b0):
            continue
        if name == 's5':
            out = hand_closeup(out, n, A, key)
            continue
        T = rigid_T(name, key, n)
        if T is None:
            continue
        s, ox, oy = T
        Tm = np.array([[s, 0, ox], [0, s, oy]], np.float64)
        w = 1.0
        if fin:
            w *= ramp(n, fin, True)
        if fout:
            w *= ramp(n, fout, False)
        if name == 's4' and n < 356:
            w *= flash_int(n)
        geo_key = 1400 if name == 's16' else key
        P = placement_reach(geo_key)
        prgb = a = None
        last = None
        for (sq, idx, wt) in rigid_pose(name, n):
            rgba, geo = seq(sq)
            Pq = P if sq == 'reach' else compose(P, idle_to_reach())
            M = compose(A, compose(Tm, Pq))
            pr, al = warp_sprite(rgba[idx], M)
            prgb = pr * wt if prgb is None else prgb + pr * wt
            a = al * wt if a is None else a + al * wt
            last = (rgba[idx], M)
        px = float(np.sqrt(abs(np.linalg.det(last[1][:, :2])))) * 3.0
        if kind == 'int':
            style = dict(exposure=0.9, glow=0.4, px=px,
                         rims=[(-3, 0, (0.55, 0.42, 0.38), 0.45),      # moon window on the left
                               (2, -2, (0.05, 0.18, 0.35), 0.30)])     # warm room light
        else:
            style = dict(exposure=0.97, glow=0.45, px=px,
                         rims=[(-3, 0, (0.55, 0.42, 0.40), 0.5), (3, -1, (0.35, 0.22, 0.25), 0.25)])
        if name == 's16' and n >= 1420:
            out = dissolve_character(out, n, last[0], last[1], style)
            continue
        out = stylise_and_composite(out, prgb, a, style, w)
    return out


# ------------------------------------------------------------------ boat hull in front of the feet
def boat_occluder(out, n, A, f_src):
    G = ext_geometry()
    if n not in G:
        return out
    g = G[n]
    yb = g['bot_raw']
    m = np.zeros((720, 1280), np.float32)
    x0, x1 = int(g['bx'] - 110), int(g['bx'] + 110)
    cv2.rectangle(m, (x0, int(yb) - 1), (x1, int(yb) + 7), 1.0, -1)
    m = cv2.GaussianBlur(m, (0, 0), 0.8)
    # only the boat's dark hull + bright gunwale (not open water): keep pixels darker than water or bright lines
    fs = f_src
    L = fs.mean(axis=2)
    wm = cv2.warpAffine(m * 1.0, A[:2].astype(np.float32), (OW, OH), flags=cv2.INTER_LINEAR)
    src = cv2.warpAffine(fs, A[:2].astype(np.float32), (OW, OH), flags=cv2.INTER_LANCZOS4)
    bb = bbox_of(wm, pad=2)
    if bb is None:
        return out
    X0, Y0, X1, Y1 = bb
    w = wm[Y0:Y1, X0:X1, None]
    out[Y0:Y1, X0:X1] = out[Y0:Y1, X0:X1] * (1 - w) + src[Y0:Y1, X0:X1] * w
    return out


# ------------------------------------------------------------------ hand close-up (shot 5)
def similarity2(p1, p2, q1, q2):
    p1, p2, q1, q2 = map(lambda v: np.array(v, np.float64), (p1, p2, q1, q2))
    dp, dq = p2 - p1, q2 - q1
    sc = np.linalg.norm(dq) / np.linalg.norm(dp)
    ang = math.atan2(dq[1], dq[0]) - math.atan2(dp[1], dp[0])
    c, s_ = math.cos(ang) * sc, math.sin(ang) * sc
    R = np.array([[c, -s_], [s_, c]])
    t = q1 - R @ p1
    return np.hstack([R, t[:, None]])


_HAND = None


def hand_closeup(out, n, A, key):
    """Shot 5: the thief's hand reaching for the moon - Asset B close-up hand (palm up, bangle, ring)."""
    global _HAND
    if _HAND is None:
        d = np.load(f'{S}/assets/char/hand_final.npz')
        _HAND = d['rgba'][0].astype(np.float32) / 255
    T = rigid_T('s5', key, n)
    if T is None:
        return out
    s_, ox, oy = T
    Tm = np.array([[s_, 0, ox], [0, s_, oy]], np.float64)
    P = similarity2((8, 111), (495, 249), (432, 405), (855, 367))
    M = compose(A, compose(Tm, P))
    prgb, a = warp_sprite(_HAND, M)
    px = float(np.sqrt(abs(np.linalg.det(M[:, :2])))) * 3.0
    style = dict(exposure=0.92, glow=0.4, px=px,
                 rims=[(2, 3, (0.50, 0.42, 0.40), 0.45),           # moonlight from the upper right
                       (3, -2, (0.05, 0.20, 0.42), 0.35)])         # warm amber from the room (left/below)
    return stylise_and_composite(out, prgb, a, style, 1.0)


# ------------------------------------------------------------------ dissolve (shot 16)
_DIS = {}


def _dissolve_setup(spr):
    """Per-pixel dissolve times (top first, noisy front) and particle seeds, in sprite coordinates."""
    key = spr.shape
    if key in _DIS:
        return _DIS[key]
    a = spr[..., 3]
    H, W = a.shape
    rng = np.random.default_rng(31)
    noise = cv2.GaussianBlur(rng.random((H, W)).astype(np.float32), (0, 0), 3.5)
    noise = (noise - noise.min()) / (noise.max() - noise.min() + 1e-6)
    ys, xs = np.where(a > 0.5)
    y0, y1 = ys.min(), ys.max()
    yn = np.clip((np.arange(H)[:, None] - y0) / max(1, y1 - y0), 0, 1)
    tmap = (D0 + DT * (0.5 * noise + 0.5 * yn)).astype(np.float32)          # frame at which each pixel dissolves
    k = min(2600, len(xs))
    sel = rng.choice(len(xs), k, replace=False)
    px, py = xs[sel].astype(np.float32), ys[sel].astype(np.float32)
    pt = tmap[py.astype(int), px.astype(int)] + rng.uniform(-1.5, 1.5, k)
    ang = rng.normal(0, 0.62, k)                                              # fan around vertical (radians)
    spd = rng.uniform(5.0, 15.0, k)
    col = spr[py.astype(int), px.astype(int), :3]
    br = rng.uniform(0.45, 1.0, k)
    _DIS[key] = dict(tmap=tmap, px=px, py=py, pt=pt, ang=ang, spd=spd, col=col, br=br)
    return _DIS[key]


D0, DT = 1424.0, 26.0


def dissolve_character(out, n, spr, M, style):
    """Shot 16: the new Chor dissolves into rising streaks of light, timed to the original."""
    d = _dissolve_setup(spr)
    k = np.clip((d['tmap'] - n) / 3.0, 0, 1)                                  # remaining body alpha
    edge = np.clip(1 - np.abs(d['tmap'] - n - 1.0) / 1.3, 0, 1) * (spr[..., 3] > 0.3)
    sp = spr.copy()
    sp[..., 3] = spr[..., 3] * k
    prgb, a = warp_sprite(sp, M)
    out = stylise_and_composite(out, prgb, a, style, 1.0)
    # glowing dissolve front
    e = np.dstack([edge, edge, edge, edge]).astype(np.float32)
    ep, ea = warp_sprite(e, M)
    glow = cv2.GaussianBlur(ea, (0, 0), 2.5)
    out = out + (ea * 0.45 + glow * 0.35)[..., None] * LAV[None, None]
    # particles: start where/when the body dissolves, fly up in a fan, leave short streaks
    age = n - d['pt']
    live = (age > 0) & (age < 40)
    if live.any():
        P = np.stack([d['px'][live], d['py'][live], np.ones(live.sum())], 0)
        start = (M @ P).T                                                    # output coords
        sc = float(np.sqrt(abs(np.linalg.det(M[:, :2]))))
        ag = age[live]
        vx = np.sin(d['ang'][live]) * d['spd'][live]
        vy = -np.cos(d['ang'][live]) * d['spd'][live]
        acc = 0.35
        pos = lambda t: (start[:, 0] + vx * t * (1 + acc * t / 10), start[:, 1] + vy * t * (1 + acc * t / 10))
        x1, y1 = pos(ag)
        x0, y0 = pos(np.maximum(ag - 1.6, 0))
        fade = np.exp(-ag / 16.0) * np.clip(ag / 2.0, 0, 1) * d['br'][live] * 0.8 * float(np.clip((1482 - n) / 12.0, 0, 1))
        warm = np.clip(1 - ag / 5.0, 0, 1)[:, None]
        col = d['col'][live] * warm + np.array([1.0, 0.92, 0.92])[None] * (1 - warm)
        layer = np.zeros((OH, OW, 3), np.float32)
        th = max(1, int(round(1.2 * sc * 1.6)))
        for i in range(len(x1)):
            c = tuple(float(v) for v in (col[i] * fade[i]))
            cv2.line(layer, (int(x0[i] * 4), int(y0[i] * 4)), (int(x1[i] * 4), int(y1[i] * 4)), c, th, cv2.LINE_AA, 2)
        layer = layer + cv2.GaussianBlur(layer, (0, 0), 3.0) * 0.8
        out = out + layer
    return out
