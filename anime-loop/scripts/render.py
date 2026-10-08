"""v2: layered puppet animation (clean background + man + girl), clearly visible character motion.
Every motion is periodic with a period dividing 30 s -> seamless loop."""
import numpy as np, cv2, sys, os, subprocess, time
from PIL import Image
from multiprocessing import Pool

SP = sys.argv[1]; MODE = sys.argv[2]
T, FPS = 30.0, 30
N = int(round(T * FPS))
D2R = np.pi / 180
def W(k): return 2 * np.pi * k / T

L = np.load(SP + "/work/layers.npz"); Mz = np.load(SP + "/work/masks.npz")
H0, W0 = L["clean"].shape[:2]
OW, OH = 1150, 1380
S = W0 / OW
u = (np.arange(OW, dtype=np.float32) + 0.5) * S - 0.5
v = (np.arange(OH, dtype=np.float32) + 0.5) * S - 0.5
X, Y = np.meshgrid(u, v)
def to_out(a):
    return cv2.remap(a.astype(np.float32), X, Y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
m = {k: to_out(Mz[k]) for k in ("w_mhead", "w_mhair", "w_mhem", "w_gupper", "w_ghead", "w_ghair", "w_gdress",
                                 "w_sky", "A_grass", "fog_band", "tree_left", "tree_mid", "tree_right", "tree_small")}
CLEAN = L["clean"].astype(np.float32)
SRC_OUT = cv2.remap(np.array(Image.open(SP + "/src/source.png").convert("RGB")).astype(np.float32), X, Y,
                    cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT_101)
_occ = cv2.remap(np.maximum(L["alpha_m"], L["alpha_g"]).astype(np.float32), X, Y, cv2.INTER_LINEAR)
_fz = ((_occ > 0.05) & (Y > 1105)).astype(np.float32)
_fz = cv2.dilate(_fz, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
CALM_HARD = np.clip(cv2.GaussianBlur(_fz, (0, 0), 4), 0, 1)[..., None]
_fz2 = cv2.dilate(_fz, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
CALM_SOFT = np.clip(cv2.GaussianBlur(_fz2, (0, 0), 22), 0, 1)
am, ag = L["alpha_m"][..., None], L["alpha_g"][..., None]
MAN4 = np.dstack([L["man_rgb"] * am, am * 255.0]).astype(np.float32)        # premultiplied
GIRL4 = np.dstack([L["girl_rgb"] * ag, ag * 255.0]).astype(np.float32)
GLOW = L["glow_m"].astype(np.float32)

def roi(x0, x1, y0, y1):   # source-coordinate box -> output slices
    return (slice(int(np.searchsorted(v, y0)), int(np.searchsorted(v, y1))),
            slice(int(np.searchsorted(u, x0)), int(np.searchsorted(u, x1))))
RM = roi(500, 950, 370, 1195)
RG = roi(395, 830, 760, 1235)

def osc_parts(phi): return np.cos(phi).astype(np.float32), np.sin(phi).astype(np.float32)
def osc(wt, C, Sn):  # sin(wt - phi) + sin(phi): zero at t=0, periodic
    return np.float32(np.sin(wt)) * C + np.float32(1 - np.cos(wt)) * Sn
def rot_back(theta, px, py, x, y):
    """backward displacement for a forward rotation by theta about (px,py): sample at R(-theta)(p-P)+P"""
    c, s_ = np.cos(theta), np.sin(theta)
    dx, dy = x - px, y - py
    return np.float32(c - 1) * dx + np.float32(s_) * dy, -np.float32(s_) * dx + np.float32(c - 1) * dy
def sm(z): z = np.clip(z, 0, 1); return z * z * (3 - 2 * z)

# ---------------- man (ROI) ----------------
Xm, Ym = X[RM], Y[RM]
mm = {k: m[k][RM] for k in ("w_mhead", "w_mhair", "w_mhem")}
P_FEET, P_HIP, P_NECK = (795, 1150), (795, 800), (688, 532)
w_up = sm((840 - Ym) / 200)
w_sway = sm((1115 - Ym) / 150)                                      # feet stay planted
g_breath = (190 * sm((790 - Ym) / 190)).astype(np.float32)       # rigid above y=600 (head untouched)
mh1 = osc_parts(2 * np.pi * (Xm - 560) / 180); mh2 = osc_parts(2 * np.pi * (Xm / 120 + Ym / 150))
mh1q = osc_parts(2 * np.pi * (Xm - 560) / 180 + np.pi / 2)
hem1 = osc_parts(2 * np.pi * Xm / 200)
# ---------------- girl (ROI) ----------------
Xg, Yg = X[RG], Y[RG]
gm = {k: m[k][RG] for k in ("w_gupper", "w_ghead", "w_ghair", "w_gdress")}
gm["w_ghair"] = gm["w_ghair"] * sm((1112 - Yg) / 70)              # hair resting on the ground stays put
gm["w_gdress"] = gm["w_gdress"] * sm((1112 - Yg) / 40)
w_gup = np.maximum(gm["w_gupper"], gm["w_ghead"])
P_SEAT, P_GNECK = (630, 1165), (640, 940)
gh1 = osc_parts(2 * np.pi * (Yg - 880) / 260 + 2 * np.pi * Xg / 900)
gh2 = osc_parts(2 * np.pi * (Yg - 880) / 170 - 2 * np.pi * Xg / 500)
gh1q = osc_parts(2 * np.pi * (Yg - 880) / 260 + 2 * np.pi * Xg / 900 + np.pi / 2)
dr1 = osc_parts(2 * np.pi * (Xg / 160 + Yg / 220)); dr2 = osc_parts(2 * np.pi * (Xg / 90 - Yg / 140))
dr3 = osc_parts(2 * np.pi * (Xg / 160 + Yg / 220) + 1.3)
# ---------------- background ----------------
rng = np.random.default_rng(7)
dyh = np.maximum(Y - 480, 20)
gx, gz = (X - 572) / dyh, 1400 / dyh
def ground_noise(n=6):
    acc = np.zeros_like(X)
    for _ in range(n):
        lam = rng.uniform(0.45, 1.1); ang = rng.uniform(0, np.pi)
        acc += np.sin(2 * np.pi * (gx * np.cos(ang) + gz * 0.12 * np.sin(ang)) / lam + rng.uniform(0, 2 * np.pi))
    return acc * (1.5 / np.sqrt(n / 2))
A_g = (m["A_grass"] * (1 - CALM_SOFT)).astype(np.float32)
def fine_noise(n=6):
    acc = np.zeros_like(X)
    for _ in range(n):
        lam = rng.uniform(0.12, 0.3); ang = rng.uniform(0, np.pi)
        acc += np.sin(2 * np.pi * (gx * np.cos(ang) + gz * 0.08 * np.sin(ang)) / lam + rng.uniform(0, 2 * np.pi))
    return acc * (1.2 / np.sqrt(n / 2))
SWAY = []    # zero-mean oscillations (px at the bottom edge)
for k, a, lx, lz in ((5, 3.0, 1.6, 8.0), (8, 1.4, 0.9, -12.0), (12, 0.7, 0.55, 5.0)):
    C, Sn = osc_parts(2 * np.pi * (gx / lx + gz / lz) + ground_noise())
    SWAY.append((k, (A_g * a * C).astype(np.float32), (A_g * a * Sn).astype(np.float32)))
RUSTLE = []
for k, a in ((15, 1.2), (12, 0.8)):
    C, Sn = osc_parts(2 * np.pi * (gx / 0.16 + gz / 1.7) + fine_noise())
    RUSTLE.append((k, (A_g * a * C).astype(np.float32), (A_g * a * Sn).astype(np.float32)))
# gusts: smooth pulses travelling left -> right across the ground plane (periods 10 s and 15 s)
S_G1, P_G1, S_G2, P_G2 = 6.0, 10.0, 9.0, 15.0
TH1 = 2 * np.pi * gx * S_G1 / P_G1; TH2 = 2 * np.pi * (gx * S_G2 + gz * 0.35) / P_G2
cT1, sT1, cT2, sT2 = [a_.astype(np.float32) for a_ in (np.cos(TH1), np.sin(TH1), np.cos(TH2), np.sin(TH2))]
def gust_field(t):
    a1, a2 = 2 * np.pi * t / P_G1, 2 * np.pi * t / P_G2
    g1 = (1 - (np.float32(np.cos(a1)) * cT1 + np.float32(np.sin(a1)) * sT1)) / 2
    g2 = (1 - (np.float32(np.cos(a2)) * cT2 + np.float32(np.sin(a2)) * sT2)) / 2
    return 0.7 * g1 * g1 + 0.3 * g2 * g2
def gust_at(t, x, y):
    gxv, gzv = (x - 572) / (y - 480), 1400 / (y - 480)
    g1 = (1 - np.cos(2 * np.pi * (t - gxv * S_G1) / P_G1)) / 2
    g2 = (1 - np.cos(2 * np.pi * (t - gxv * S_G2 - gzv * 0.35) / P_G2)) / 2
    return 0.7 * g1 * g1 + 0.3 * g2 * g2
LEAN_PX = 10.0
import scipy.ndimage as ndi, scipy.sparse as sps
FL = np.load(SP + "/work/flowers.npz")
lab_out = cv2.remap(FL["lab"].astype(np.float32), X, Y, cv2.INTER_NEAREST).astype(np.int32)
_objs = ndi.find_objects(lab_out)
_rows, _cols, _vals, FLW = [], [], [], []
frng = np.random.default_rng(5)
for l, sl in enumerate(_objs, start=1):
    if sl is None: continue
    ys_, xs_ = sl
    hh, ww = ys_.stop - ys_.start, xs_.stop - xs_.start
    area = float((lab_out[sl] == l).sum())
    r = np.sqrt(area / np.pi); f = 1.5 + 0.35 * r; Ls = 2.2 * hh + 4
    pad = int(np.ceil(f + 2))
    y0, y1 = max(0, ys_.start - pad), min(OH, ys_.stop + int(np.ceil(Ls)) + pad)
    x0, x1 = max(0, xs_.start - pad), min(OW, xs_.stop + pad)
    loc = (lab_out[y0:y1, x0:x1] == l)
    d = cv2.distanceTransform((~loc).astype(np.uint8), cv2.DIST_L2, 3)
    w_h = sm(1 - d / f)
    yy_, xx_ = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    cyl, cxl = float(yy_[loc].mean()), float(xx_[loc].mean()); yb = float(yy_[loc].max())
    hw = 0.3 * ww + 2.0
    w_s = np.clip(1 - (yy_ - yb) / Ls, 0, 1) * (yy_ > yb) * np.clip(1 - np.abs(xx_ - cxl) / hw, 0, 1)
    w = np.maximum(w_h, w_s)
    nz = w > 0.01
    if not nz.any(): continue
    fid = len(FLW)
    _rows.append((yy_[nz].astype(np.int64) * OW + xx_[nz].astype(np.int64))); _cols.append(np.full(int(nz.sum()), fid)); _vals.append(w[nz])
    srcy = cyl * S
    persp = max(0.05, (srcy - 480) / (H0 - 480))
    amp = min(9.0 * persp, 0.9 * (r + f) + 1.0)
    FLW.append((cxl * S, srcy, amp))
FLM = sps.csr_matrix((np.concatenate(_vals).astype(np.float32), (np.concatenate(_rows), np.concatenate(_cols))),
                     shape=(OH * OW, len(FLW)))
FL_NRM = (1.0 / np.maximum(1.0, np.asarray(FLM.sum(axis=1)).ravel())).astype(np.float32).reshape(OH, OW)
FL_NRM *= (1 - CALM_SOFT)
FLW = np.array(FLW, np.float32)
NF = len(FLW)
FL_K1 = frng.choice([4, 5, 6], NF); FL_P1 = frng.uniform(0, 2 * np.pi, NF)
FL_K2 = frng.choice([8, 10], NF); FL_P2 = frng.uniform(0, 2 * np.pi, NF)
FL_K3 = frng.choice([5, 6], NF); FL_P3 = frng.uniform(0, 2 * np.pi, NF)
print("flowers animated:", NF, "nnz:", FLM.nnz, flush=True)
def flower_field(t):
    G = gust_at(t, FLW[:, 0], FLW[:, 1]).astype(np.float32)
    A = FLW[:, 2]
    dx = A * (0.55 * G + 0.45 * np.sin(2 * np.pi * FL_K1 * t / T + FL_P1) + 0.15 * np.sin(2 * np.pi * FL_K2 * t / T + FL_P2))
    dy = A * (0.22 * G + 0.10 * np.sin(2 * np.pi * FL_K3 * t / T + FL_P3))
    fx_ = (FLM @ dx.astype(np.float32)).reshape(OH, OW) * FL_NRM
    fy_ = (FLM @ dy.astype(np.float32)).reshape(OH, OW) * FL_NRM
    return fx_, fy_
# wind sheen: soft light bands moving with the wind, only while a gust passes (zero-mean, no global pulsing)
BPH = 2 * np.pi * gx / 0.6
cB, sB = np.cos(BPH).astype(np.float32), np.sin(BPH).astype(np.float32)
MEADOW = (sm((Y - 560) / 60) * (1 - CALM_SOFT)).astype(np.float32)
TREES = []
for name, ph in (("tree_left", 0.0), ("tree_mid", 1.7), ("tree_right", 3.1), ("tree_small", 4.4)):
    C, Sn = osc_parts(ph + 2 * np.pi * X / 400)
    TREES.append(((1.8 * m[name] * C).astype(np.float32), (1.8 * m[name] * Sn).astype(np.float32)))
SKY = m["w_sky"].astype(np.float32)
SKY_ROWS = int(np.searchsorted(v, 240))
V_SKY, L_SKY = 1.6, 10.0
# fog: periodic spectral noise
FW, FH, CELL = 1152, 640, 4
NX, NY = FW // CELL, FH // CELL
fx = np.fft.fftfreq(NX, d=CELL)[None, :]; fy = np.fft.fftfreq(NY, d=CELL)[:, None]
rr = np.sqrt((2.2 * fx) ** 2 + fy ** 2) + 1e-9
lam_ = 1 / rr
amp = np.clip((lam_ - 60) / 40, 0, 1) * np.clip((900 - lam_) / 300, 0, 1) * rr ** -1.15
Z = (rng.standard_normal((NY, NX)) + 1j * rng.standard_normal((NY, NX))) * amp
drift = (1 / (np.abs(fx) + 1e-9) * np.ones_like(fy)) <= 380
mq = np.round(fx * 10.0 * T * np.ones_like(fy)).astype(int)
mq = np.where(drift, mq + rng.choice([-1, 0, 0, 0, 1], size=mq.shape), 0)
qmod = rng.choice([1, 2], size=mq.shape); rho = rng.uniform(0, 2 * np.pi, size=mq.shape)
Zd = np.where(drift, Z, 0); Zs = np.where(drift, 0, Z)
def fog_raw(t):
    spec = Zd * np.exp(-2j * np.pi * mq * t / T) + Zs * (1 + 0.6 * np.cos(2 * np.pi * qmod * t / T + rho))
    return np.real(np.fft.ifft2(spec)).astype(np.float32)
FOG_STD = float(np.std(fog_raw(0.0)))
FOG_ROWS = int(np.searchsorted(v, FH - 8))
FX, FY = X[:FOG_ROWS] / CELL - 0.5, Y[:FOG_ROWS] / CELL - 0.5
FOG_BAND = m["fog_band"][:FOG_ROWS]
FOG_COL = np.array([156, 133, 129], np.float32)

def man_map(t):
    e4 = (1 - np.cos(W(4) * t)) / 2
    var = 0.85 + 0.15 * np.cos(W(1) * t)
    sx, sy = rot_back(0.9 * D2R * np.sin(W(3) * t), *P_FEET, Xm, Ym)                 # gentle sway on his feet
    bx, by = w_sway * sx, w_sway * sy
    lx, ly = rot_back(-5.0 * D2R * e4 * var, *P_HIP, Xm, Ym)                          # lean down toward her
    bx += w_up * lx; by += w_up * ly
    hx, hy = rot_back(-3.8 * D2R * (e4 ** 1.2) * var, *P_NECK, Xm, Ym)                # head tilts toward her
    bx += mm["w_mhead"] * hx; by += mm["w_mhead"] * hy
    beta = 0.014 * (1 - np.cos(W(6) * t)) / 2                                        # breathing
    by += np.float32(beta) * g_breath
    a8, a12, a10 = W(8) * t, W(12) * t, W(10) * t
    bx -= 3.2 * mm["w_mhair"] * (0.7 * osc(a8, *mh1) + 0.3 * osc(a12, *mh2))         # hair in the breeze
    by += 0.4 * 2.5 * mm["w_mhair"] * osc(a8, *mh1q)
    bx -= 1.5 * mm["w_mhem"] * osc(a10, *hem1)
    gm_ = gust_at(t, 700.0, 1150.0)
    bx -= mm["w_mhair"] * np.float32(2.0 * gm_) + mm["w_mhem"] * np.float32(1.5 * gm_)  # gust pushes hair / jacket
    return Xm + bx, Ym + by

def girl_map(t):
    e4 = (1 - np.cos(W(4) * t)) / 2
    env = 0.45 + 0.55 * e4                                                          # laughs a bit more as he leans in
    bob = env * (1 - np.cos(W(10) * t)) / 2                                          # slow laughing bob (3 s)
    rx, ry = rot_back(-1.5 * D2R * np.sin(W(3) * t), *P_SEAT, Xg, Yg)                # rocks gently (10 s)
    bx = w_gup * rx; by = w_gup * ry
    by += w_gup * np.float32(4.0 * bob + 1.4 * (1 - np.cos(W(6) * t)) / 2)          # bob + breathing (up)
    bx -= w_gup * np.float32(1.0 * bob)
    hx, hy = rot_back(D2R * (2.0 * env * np.sin(W(2) * t) + 1.5 * bob), *P_GNECK, Xg, Yg)    # head tilt
    bx += gm["w_ghead"] * hx; by += gm["w_ghead"] * hy
    a4, a6, a8 = W(4) * t, W(6) * t, W(8) * t
    bx -= 5.0 * gm["w_ghair"] * (0.65 * osc(a4, *gh1) + 0.35 * osc(a6, *gh2))       # flowing hair (slow)
    by -= 0.15 * 4.0 * gm["w_ghair"] * osc(a4, *gh1q)
    bx -= 1.5 * gm["w_gdress"] * (0.6 * osc(a6, *dr1) + 0.4 * osc(a8, *dr2))         # dress frills (slow)
    by -= 0.6 * gm["w_gdress"] * osc(a6, *dr3)
    gg_ = gust_at(t, 610.0, 1170.0)
    bx -= np.float32(2.5 * gg_) * gm["w_ghair"] + np.float32(1.2 * gg_) * gm["w_gdress"]   # gust pushes hair / frills
    return Xg + bx, Yg + by

def bg_maps(t):
    G = gust_field(t)
    sw_amp = 0.45 + 0.55 * G; ru_amp = 0.4 + 0.6 * G
    fxb = LEAN_PX * A_g * G; fyb = 0.22 * LEAN_PX * A_g * G                         # gust pushes grass over
    for k, ACx, ASx in SWAY:
        sw, cw = np.float32(np.sin(W(k) * t)), np.float32(np.cos(W(k) * t))
        fxb += sw_amp * (sw * ACx - cw * ASx)
        fyb += 0.18 * sw_amp * (cw * ACx + sw * ASx)
    for k, ACx, ASx in RUSTLE:
        sw, cw = np.float32(np.sin(W(k) * t)), np.float32(np.cos(W(k) * t))
        fxb += ru_amp * (sw * ACx - cw * ASx)
    a5 = W(5) * t
    for C, Sn in TREES:
        fxb += (np.float32(np.sin(a5)) * C + np.float32(1 - np.cos(a5)) * Sn) * (0.6 + 0.4 * G)
    ffx, ffy = flower_field(t)
    fxb += ffx; fyb += ffy
    D2 = np.dstack([fxb, fyb]).astype(np.float32)
    qx, qy = X - fxb, Y - fyb
    for _ in range(2):                       # solve q + D(q) = p
        Dq = cv2.remap(D2, (qx + 0.5) / S - 0.5, (qy + 0.5) / S - 0.5, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        qx, qy = X - Dq[..., 0], Y - Dq[..., 1]
    ab = 2 * np.pi * t / 3.75
    band = np.float32(np.cos(ab)) * cB + np.float32(np.sin(ab)) * sB                 # cos(BPH - ab), travels right
    shade = 1 + 0.06 * G * band * MEADOW
    return qx, qy, shade

# ---------- drifting petals (seamless: each wraps an integer number of times per loop) ----------
prng = np.random.default_rng(11)
MARGIN = 70
PETALS = []
def add_petal(front):
    if front:
        y0 = prng.uniform(1190, 1335); r = prng.uniform(4.5, 7.0); wraps = 2; a0 = prng.uniform(0.5, 0.7); soft = 0.95
    else:
        y0 = prng.uniform(560, 1080); r = prng.uniform(1.6, 3.0); wraps = 1; a0 = prng.uniform(0.5, 0.8); soft = 0.5
    PETALS.append(dict(front=front, x0=prng.uniform(0, OW + 2 * MARGIN), y0=y0, r=r, wraps=wraps, a0=a0, soft=soft,
                       ay=prng.uniform(8, 26), ky=int(prng.integers(2, 5)), py=prng.uniform(0, 2 * np.pi),
                       ax=prng.uniform(6, 18), kx=int(prng.integers(3, 6)), px=prng.uniform(0, 2 * np.pi),
                       th0=prng.uniform(0, np.pi), kr=int(prng.choice([-4, -3, -2, 2, 3, 4])),
                       col=np.array([255, prng.uniform(228, 242), prng.uniform(215, 232)], np.float32)))
for _ in range(13): add_petal(False)
for _ in range(5): add_petal(True)
def draw_petals(img, t, front):
    WT = OW + 2 * MARGIN
    for p in PETALS:
        if p["front"] != front: continue
        x = (p["x0"] + p["wraps"] * WT * t / T) % WT - MARGIN + p["ax"] * np.sin(2 * np.pi * p["kx"] * t / T + p["px"])
        y = p["y0"] + p["ay"] * np.sin(2 * np.pi * p["ky"] * t / T + p["py"])
        th = p["th0"] + 2 * np.pi * p["kr"] * t / T
        flat = 0.35 + 0.65 * abs(np.cos(th))              # petal turning in the air
        r = p["r"]; R = int(np.ceil(r * 3 + 3))
        xi, yi = int(np.floor(x)), int(np.floor(y))
        x0_, x1_ = max(0, xi - R), min(OW, xi + R + 1); y0_, y1_ = max(0, yi - R), min(OH, yi + R + 1)
        if x0_ >= x1_ or y0_ >= y1_: continue
        yy, xx = np.mgrid[y0_:y1_, x0_:x1_].astype(np.float32)
        dx, dy = xx - x, yy - y
        c, s_ = np.cos(th * 0.5), np.sin(th * 0.5)
        uu = (c * dx + s_ * dy) / r; vv = (-s_ * dx + c * dy) / (r * flat)
        d = np.sqrt(uu * uu + vv * vv)
        core = p["a0"] * sm((1.0 - d) / p["soft"])
        glow = 0.18 * p["a0"] * np.exp(-0.5 * (d / 2.2) ** 2)
        reg = img[y0_:y1_, x0_:x1_]
        reg[:] = reg * (1 - core[..., None]) + p["col"] * core[..., None]
        reg += np.array([60, 38, 22], np.float32) * glow[..., None]

def render(t):
    mx, my, shade = bg_maps(t)
    pa = (t / L_SKY) % 1.0; pb = (t / L_SKY + 0.5) % 1.0
    oa, wa = V_SKY * L_SKY * (pa - 0.5), np.sin(np.pi * pa) ** 2
    ob, wb = V_SKY * L_SKY * (pb - 0.5), np.sin(np.pi * pb) ** 2
    out = cv2.remap(CLEAN, mx - SKY * np.float32(ob), my, cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT_101)
    if wa > 1e-6:
        r = SKY_ROWS
        outa = cv2.remap(CLEAN, mx[:r] - SKY[:r] * np.float32(oa), my[:r], cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT_101)
        out[:r] = np.float32(wb) * out[:r] + np.float32(wa) * outa
    out *= shade[..., None]
    draw_petals(out, t, front=False)
    f = cv2.remap(fog_raw(t), FX, FY, cv2.INTER_CUBIC, borderMode=cv2.BORDER_WRAP) / FOG_STD
    dens = sm((f + 0.3) / 2.2)
    al = (0.17 * FOG_BAND * dens)[..., None]
    out[:FOG_ROWS] += (FOG_COL - out[:FOG_ROWS]) * al
    # man
    ax, ay = man_map(t)
    man = cv2.remap(MAN4, ax, ay, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    glow = cv2.remap(GLOW, ax, ay, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    a_ = np.clip(man[..., 3:] / 255.0, 0, 1)
    o = out[RM]
    out[RM] = (o + np.clip(glow, 0, None)) * (1 - a_) + np.clip(man[..., :3], 0, None)
    # girl
    gx_, gy_ = girl_map(t)
    girl = cv2.remap(GIRL4, gx_, gy_, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    a_ = np.clip(girl[..., 3:] / 255.0, 0, 1)
    out[RG] = out[RG] * (1 - a_) + np.clip(girl[..., :3], 0, None)
    out = out * (1 - CALM_HARD) + SRC_OUT * CALM_HARD
    draw_petals(out, t, front=True)
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)

def work(i): return render(i / FPS).tobytes()

if __name__ == "__main__":
    if MODE == "test":
        os.makedirs(SP + "/test", exist_ok=True)
        for t in [float(x) for x in sys.argv[3].split(",")]:
            t0 = time.time(); img = render(t)
            Image.fromarray(img).save(SP + f"/test/f_{t:06.2f}.png"); print(f"t={t:6.2f} {time.time()-t0:.2f}s")
    elif MODE == "full":
        out = sys.argv[3]
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
               "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-", "-c:v", "ffv1", "-level", "3", "-pix_fmt", "gbrp", out]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE); t0 = time.time()
        with Pool(4) as pool:
            for i, buf in enumerate(pool.imap(work, range(N), chunksize=4)):
                p.stdin.write(buf)
                if i % 150 == 0: print(f"frame {i}/{N} {time.time()-t0:.0f}s", flush=True)
        p.stdin.close(); p.wait(); print("done", time.time() - t0)
