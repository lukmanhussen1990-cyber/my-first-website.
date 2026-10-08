"""Scene 2: man in a sunny meadow. Layered loop animation, 30 s, every motion periodic -> seamless."""
import numpy as np, cv2, sys, os, subprocess, time
from PIL import Image
from multiprocessing import Pool
import scipy.ndimage as ndi, scipy.sparse as sps

P = sys.argv[1]; MODE = sys.argv[2]
T, FPS = 30.0, 30
N = int(round(T * FPS)); D2R = np.pi / 180
def W(k): return 2 * np.pi * k / T
def sm(z): z = np.clip(z, 0, 1); return z * z * (3 - 2 * z)

L = np.load(P + "/work/layers.npz"); Mz = np.load(P + "/work/masks.npz")
SRC = np.array(Image.open(P + "/src/source.png").convert("RGB")).astype(np.float32)
H0, W0 = SRC.shape[:2]
OW, OH = 1150, 1380
S = W0 / OW
u = (np.arange(OW, dtype=np.float32) + 0.5) * S - 0.5
v = (np.arange(OH, dtype=np.float32) + 0.5) * S - 0.5
X, Y = np.meshgrid(u, v)
def to_out(a, interp=cv2.INTER_LINEAR):
    return cv2.remap(a.astype(np.float32), X, Y, interp, borderMode=cv2.BORDER_REPLICATE)
m = {k: to_out(Mz[k]) for k in Mz.files}
CLEAN = L["clean"].astype(np.float32)
SRC_OUT = cv2.remap(SRC, X, Y, cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT_101)
def unmix_layer(a0, rgb, clean, inner_d=3.0, sig=3.0):
    """Replace the 1-3 px silhouette rim (which still holds the source background) by an
    alpha estimated against the clean plate, so no sky/mist outline travels with the man."""
    core = (a0 > 0.5).astype(np.uint8)
    dist = cv2.distanceTransform(core, cv2.DIST_L2, 3)
    inner = (dist > inner_d).astype(np.float32)
    den = cv2.GaussianBlur(inner, (0, 0), sig)
    Fb = cv2.GaussianBlur(rgb * inner[..., None], (0, 0), sig) / np.maximum(den, 1e-4)[..., None]
    dFB, dIB = Fb - clean, rgb - clean
    a_est = np.clip((dIB * dFB).sum(-1) / np.maximum((dFB * dFB).sum(-1), 1.0), 0, 1)
    use = ((dist <= inner_d) & (a0 > 0.003) & (den > 0.05) & (np.linalg.norm(dFB, axis=-1) > 30)).astype(np.float32)
    use = use * (cv2.dilate((Mz["w_mhair"] > 0.02).astype(np.uint8), np.ones((13, 13), np.uint8)) == 0)   # skip hair: strands too thin to unmix
    use = cv2.GaussianBlur(use, (0, 0), 0.7) * (dist <= inner_d + 1)
    a_new = a0 * (1 - use) + np.minimum(a0, a_est) * use
    prem = np.clip(rgb - (1 - a_new[..., None]) * clean, 0, None)
    prem = np.minimum(prem, rgb * np.maximum(a_new, 1e-3)[..., None] + 255 * (1 - use[..., None]))
    P_ = rgb * a0[..., None] * (1 - use[..., None]) + prem * use[..., None]
    return np.dstack([P_, a_new * 255.0]).astype(np.float32)
MAN4 = unmix_layer(L["alpha_m"].astype(np.float32), L["man_rgb"].astype(np.float32), L["clean"].astype(np.float32))
GLOW = L["glow_m"].astype(np.float32)
_occ = to_out(L["alpha_m"])
_fz = cv2.dilate(((_occ > 0.05) & (Y > 1060)).astype(np.float32), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
CALM_HARD = np.clip(cv2.GaussianBlur(_fz, (0, 0), 4), 0, 1)[..., None]
CALM_SOFT = np.clip(cv2.GaussianBlur(cv2.dilate(_fz, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))), (0, 0), 12), 0, 1)
CALM_SOFT = np.maximum(CALM_SOFT, np.clip(3 * cv2.dilate(CALM_HARD[..., 0], np.ones((9, 9), np.uint8)), 0, 1))

def roi(x0, x1, y0, y1):
    return (slice(int(np.searchsorted(v, y0)), int(np.searchsorted(v, y1))),
            slice(int(np.searchsorted(u, x0)), int(np.searchsorted(u, x1))))
RM = roi(440, 830, 200, 1245)
def osc_parts(phi): return np.cos(phi).astype(np.float32), np.sin(phi).astype(np.float32)
def osc(wt, C, Sn): return np.float32(np.sin(wt)) * C + np.float32(1 - np.cos(wt)) * Sn
def rot_back(theta, px, py, x, y):
    c, s_ = np.cos(theta), np.sin(theta); dx, dy = x - px, y - py
    return np.float32(c - 1) * dx + np.float32(s_) * dy, -np.float32(s_) * dx + np.float32(c - 1) * dy

# ---------------- wind (shared) ----------------
S_G1, P_G1, S_G2, P_G2 = 5.0, 7.5, 9.0, 15.0
def gust_at(t, x, y):
    gxv, gzv = (x - 572) / (y - 480), 1400 / (y - 480)
    g1 = (1 - np.cos(2 * np.pi * (t - gxv * S_G1) / P_G1)) / 2
    g2 = (1 - np.cos(2 * np.pi * (t - gxv * S_G2 - gzv * 0.35) / P_G2)) / 2
    return 0.7 * g1 * g1 + 0.3 * g2 * g2

# ---------------- man ----------------
Xm, Ym = X[RM], Y[RM]
mm = {k: m[k][RM] for k in ("w_mhead", "w_mhair", "w_jacket", "w_trouser")}
def _ell(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
_dc = np.hypot(X - 645, Y - 318)
_grow = cv2.dilate((m["w_mhair"] > 0.25).astype(np.float32), _ell(20))
_wh = np.clip(cv2.GaussianBlur(np.maximum(m["w_mhair"], 0.9 * _grow), (0, 0), 8), 0, 1)
_guard = cv2.GaussianBlur(cv2.dilate((m["face"] > 0.5).astype(np.float32), _ell(4)), (0, 0), 3)
mm["w_mhair"] = (_wh * (1 - _guard) * np.clip((_dc - 40) / 30, 0, 1) * sm((382 - Y) / 18))[RM].astype(np.float32)
_vert = np.where(X < 600, sm((648 - Y) / 30), sm((728 - Y) / 22))      # left: jacket panel only (not hand/trousers)
mm["w_jacket"] = np.clip(cv2.GaussianBlur(cv2.dilate(m["w_jacket"] * _vert, _ell(6)), (0, 0), 6), 0, 1)[RM].astype(np.float32)
mm["w_trouser"] = np.clip(cv2.GaussianBlur(cv2.dilate(m["w_trouser"], _ell(6)), (0, 0), 5), 0, 1)[RM].astype(np.float32)
P_FEET, P_NECK = (650, 1155), (640, 368)
w_sway = sm((1060 - Ym) / 200)
w_upper = sm((700 - Ym) / 200)
g_breath = (220 * sm((640 - Ym) / 220)).astype(np.float32)
mh1 = osc_parts(2 * np.pi * (Xm - 580) / 160); mh2 = osc_parts(2 * np.pi * (Xm / 110 + Ym / 140))
mh1q = osc_parts(2 * np.pi * (Xm - 580) / 160 + np.pi / 2)
jk1 = osc_parts(2 * np.pi * (Ym - 540) / 150); jk2 = osc_parts(2 * np.pi * (Ym - 540) / 150 + 1.1)
tr1 = osc_parts(2 * np.pi * (Ym - 720) / 220 + 2 * np.pi * Xm / 300)
def sway_ang(t): return D2R * (1.3 * np.sin(W(3) * t) + 0.4 * np.sin(W(5) * t))
LAG_HAIR = 0.45
def man_map(t):
    G = gust_at(t, 650.0, 1150.0)
    sx, sy = rot_back(sway_ang(t), *P_FEET, Xm, Ym)    # sway
    bx, by = w_sway * sx, w_sway * sy
    br = (1 - np.cos(W(5) * t)) / 2                                                       # deep breaths (6 s)
    by += np.float32(0.022 * br) * g_breath
    lx, ly = rot_back(D2R * 1.2 * br, 630, 660, Xm, Ym)                                   # leans back on the inhale
    bx += w_upper * lx; by += w_upper * ly
    hx, hy = rot_back(D2R * (4.0 * br + 2.0 * np.sin(W(2) * t)), *P_NECK, Xm, Ym)        # head tilts back
    bx += mm["w_mhead"] * hx; by += mm["w_mhead"] * hy
    a6, a8, a10 = W(6) * t, W(8) * t, W(10) * t
    hair = 0.6 * osc(a6, *mh1) + 0.4 * osc(a10, *mh2)
    bx -= mm["w_mhair"] * (4.5 * hair + np.float32(5.0 * G))                              # hair in the wind
    by -= mm["w_mhair"] * (1.6 * osc(a6, *mh1q) - np.float32(2.0 * G))
    bx -= mm["w_jacket"] * (3.5 * osc(a6, *jk1) + np.float32(2.6 * G))                    # jacket flaps
    by -= mm["w_jacket"] * 0.8 * osc(a8, *jk2)
    bx -= mm["w_trouser"] * (1.8 * osc(a8, *tr1) + np.float32(1.2 * G))                   # trouser fabric
    fx, fy = rot_back(sway_ang(t - LAG_HAIR) - sway_ang(t), *P_FEET, Xm, Ym)   # hair / hem trail the sway
    k_ = mm["w_mhair"] + 0.6 * mm["w_jacket"]; bx += k_ * fx; by += k_ * fy
    return Xm + bx, Ym + by

# ---------------- meadow ----------------
rng = np.random.default_rng(7)
dyh = np.maximum(Y - 480, 20)
gx, gz = (X - 572) / dyh, 1400 / dyh
def ground_noise(n=6, lo=0.45, hi=1.1, amp=1.5, zf=0.12):
    acc = np.zeros_like(X)
    for _ in range(n):
        lam = rng.uniform(lo, hi); ang = rng.uniform(0, np.pi)
        acc += np.sin(2 * np.pi * (gx * np.cos(ang) + gz * zf * np.sin(ang)) / lam + rng.uniform(0, 2 * np.pi))
    return acc * (amp / np.sqrt(n / 2))
A_g = ((m["A_grass"] ** 0.8) * (1 - CALM_SOFT)).astype(np.float32)
SWAY = []
for k, a, lx, lz in ((5, 4.5, 1.6, 8.0), (8, 2.2, 0.9, -12.0), (12, 1.0, 0.55, 5.0)):
    C, Sn = osc_parts(2 * np.pi * (gx / lx + gz / lz) + ground_noise(amp=1.25))
    SWAY.append((k, (A_g * a * C).astype(np.float32), (A_g * a * Sn).astype(np.float32)))
RUSTLE = []
for k, a in ((15, 1.8), (12, 1.2)):
    C, Sn = osc_parts(2 * np.pi * (gx / 0.16 + gz / 1.7) + ground_noise(6, 0.12, 0.3, 1.2, 0.08))
    RUSTLE.append((k, (A_g * a * C).astype(np.float32), (A_g * a * Sn).astype(np.float32)))
TH1 = 2 * np.pi * gx * S_G1 / P_G1; TH2 = 2 * np.pi * (gx * S_G2 + gz * 0.35) / P_G2
cT1, sT1, cT2, sT2 = [a_.astype(np.float32) for a_ in (np.cos(TH1), np.sin(TH1), np.cos(TH2), np.sin(TH2))]
def gust_field(t):
    a1, a2 = 2 * np.pi * t / P_G1, 2 * np.pi * t / P_G2
    g1 = (1 - (np.float32(np.cos(a1)) * cT1 + np.float32(np.sin(a1)) * sT1)) / 2
    g2 = (1 - (np.float32(np.cos(a2)) * cT2 + np.float32(np.sin(a2)) * sT2)) / 2
    return 0.7 * g1 * g1 + 0.3 * g2 * g2
LEAN_PX = 18.0
BPH = 2 * np.pi * gx / 0.6 + ground_noise(5, 0.5, 1.2, 2.2, 0.15)
cB, sB = np.cos(BPH).astype(np.float32), np.sin(BPH).astype(np.float32)
MEADOW = ((m["A_grass"] * (1 - CALM_SOFT)) ** 0.7).astype(np.float32)
# individual flowers: occluding sprites over a flower-free plate (no rubbery warping of the grass)
lab_src = np.load(P + "/work/flowers_v3.npz")["lab"]
lab_o = cv2.remap(lab_src.astype(np.float32), X, Y, cv2.INTER_NEAREST).astype(np.int32)
_dman = cv2.distanceTransform((_occ < 0.05).astype(np.uint8), cv2.DIST_L2, 5)
heads = []; FLA = np.zeros((OH, OW), np.float32); kept = set()
for l, sl in enumerate(ndi.find_objects(lab_o), start=1):
    if sl is None: continue
    mk_ = (lab_o[sl] == l)
    if mk_.sum() < 3: continue
    ys, xs = np.nonzero(mk_); cy, cx = ys.mean() + sl[0].start, xs.mean() + sl[1].start
    if _dman[int(cy), int(cx)] < 18: continue                  # leave heads hugging the trousers alone
    h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    persp = max(0.05, (cy * S - 480) / (H0 - 480))
    A = min(14.0 * persp, 0.6 * min(w, h) + 1.5)
    pad = 2 + int(np.ceil(1.3 * A)) + 2
    y0, y1, x0, x1 = max(0, sl[0].start - pad), min(OH, sl[0].stop + pad), max(0, sl[1].start - pad), min(OW, sl[1].stop + pad)
    mm_ = (lab_o[y0:y1, x0:x1] == l).astype(np.float32)
    a_ = np.clip(cv2.GaussianBlur(cv2.dilate(mm_, np.ones((3, 3), np.uint8)), (0, 0), 0.8) * 1.15, 0, 1)
    FLA[y0:y1, x0:x1] = np.maximum(FLA[y0:y1, x0:x1], a_)
    heads.append((cy, cx, A, y0, y1, x0, x1, a_ > 0.01)); kept.add(l)
heads.sort(key=lambda h_: h_[0])                               # far first, near drawn last
_keep_src = np.isin(lab_src, np.array(sorted(kept), np.int32)) if kept else np.zeros_like(lab_src, bool)
_hole = cv2.dilate(_keep_src.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
NOFL = cv2.inpaint(np.clip(CLEAN, 0, 255).astype(np.uint8), _hole, 6, cv2.INPAINT_TELEA).astype(np.float32)
NOFL = CLEAN * (1 - _hole[..., None]) + NOFL * _hole[..., None]
CLEAN_O = cv2.remap(CLEAN, X, Y, cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT_101)
NH = len(heads)
HC = np.array([[h_[0], h_[1], h_[2]] for h_ in heads], np.float32)
FL4 = np.dstack([CLEAN_O * FLA[..., None], FLA * 255.0]).astype(np.float32)
calm_c = CALM_SOFT[HC[:, 0].astype(int), HC[:, 1].astype(int)]
frng = np.random.default_rng(5)
_gxc, _gzc = gx[HC[:, 0].astype(int), HC[:, 1].astype(int)], gz[HC[:, 0].astype(int), HC[:, 1].astype(int)]
K1 = np.full(NH, 5); P1 = -2 * np.pi * (_gxc / 1.6 + _gzc / 8.0) + frng.uniform(-0.7, 0.7, NH)   # nod with the grass wave
K2 = frng.choice([8, 10], NH); P2 = frng.uniform(0, 2 * np.pi, NH)
K3 = frng.choice([5, 6], NH); P3 = frng.uniform(0, 2 * np.pi, NH)
print("flower sprites:", NH, flush=True)
def flower_layer(t, fxb, fyb):
    cy, cx, A = HC[:, 0], HC[:, 1], HC[:, 2]
    G = gust_at(t, cx * S, cy * S).astype(np.float32)
    dx = A * (0.55 * G + 0.40 * np.sin(2 * np.pi * K1 * t / T + P1) + 0.08 * np.sin(2 * np.pi * K2 * t / T + P2))
    dy = A * (0.20 * G + 0.10 * np.sin(2 * np.pi * K3 * t / T + P3))
    iy, ix = cy.astype(int), cx.astype(int)
    tx = (fxb[iy, ix] + dx * (1 - calm_c)) / S; ty = (fyb[iy, ix] + dy * (1 - calm_c)) / S
    offx = np.zeros((OH, OW), np.float32); offy = np.zeros((OH, OW), np.float32); has = np.zeros((OH, OW), bool)
    for i, (_, _, _, y0, y1, x0, x1, fp) in enumerate(heads):
        sx, sy = int(round(tx[i])), int(round(ty[i]))
        Y0, Y1, X0, X1 = y0 + sy, y1 + sy, x0 + sx, x1 + sx
        a0, b0 = max(0, -Y0), max(0, -X0); Y0c, X0c = max(Y0, 0), max(X0, 0); Y1c, X1c = min(Y1, OH), min(X1, OW)
        if Y1c <= Y0c or X1c <= X0c: continue
        f = fp[a0:a0 + (Y1c - Y0c), b0:b0 + (X1c - X0c)]
        offx[Y0c:Y1c, X0c:X1c][f] = tx[i]; offy[Y0c:Y1c, X0c:X1c][f] = ty[i]; has[Y0c:Y1c, X0c:X1c] |= f
    ox = np.arange(OW, dtype=np.float32)[None, :] - offx; oy = np.arange(OH, dtype=np.float32)[:, None] - offy
    fl = cv2.remap(FL4, ox, oy, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    fl[~has] = 0
    return fl
# frame-edge taper so the background never samples outside the plate (no mirrored strips)
EX, EXR, EYB = sm(X / 90.0), sm((W0 - 1 - X) / 45.0), sm((H0 - 1 - Y) / 30.0)
TREES = []
for name, ph in (("t1", 0.0), ("t2", 1.7), ("t3", 3.1)):
    C, Sn = osc_parts(ph + 2 * np.pi * X / 400)
    TREES.append(((3.5 * m[name] * C).astype(np.float32), (3.5 * m[name] * Sn).astype(np.float32)))
SKY = m["w_sky"].astype(np.float32)
SKY_ROWS = int(np.searchsorted(v, 325)); Xs, Ys = X[:SKY_ROWS], Y[:SKY_ROWS]
_rr_s = np.hypot(Xs - 15.0, Ys - 12.0)
SKY_W = (SKY[:SKY_ROWS] * sm((_rr_s - 70) / 230) * sm(np.minimum(Xs, W0 - 1 - Xs) / 150)).astype(np.float32)
TOPF = sm(Ys / 40).astype(np.float32)
_rg = np.random.default_rng(9); SKY_DX = []
for a, lam, k in ((8.0, 560.0, 1), (4.0, 320.0, 2), (1.6, 180.0, 3)):
    ang = _rg.uniform(-0.35, 0.35); p0, p1 = _rg.uniform(0, 2 * np.pi, 2)
    ph = 2 * np.pi * (Xs * np.cos(ang) + 2.2 * Ys * np.sin(ang)) / lam
    SKY_DX.append((k, a, (ph + p0).astype(np.float32), (0.8 * ph + p1).astype(np.float32)))
def sky_disp(t):
    dx = np.zeros_like(Xs); dy = np.zeros_like(Xs)
    for k, a, P0, P1_ in SKY_DX:
        w = np.float32(2 * np.pi * k * t / T); dx += a * np.sin(P0 - w); dy += 0.3 * a * np.sin(P1_ - w)
    return SKY_W * dx, SKY_W * dy * TOPF
# ---------------- sun rays (zero-mean shimmer around the sun) ----------------
SUN = (15.0, 12.0)
rr_ = np.hypot(X - SUN[0], Y - SUN[1]); th_ = np.arctan2(Y - SUN[1], X - SUN[0])
RAY_S = (sm(rr_ / 70) * np.exp(-rr_ / 420) * (1 - sm((Y - 270) / 110))).astype(np.float32)
RAYS = [(13, 0.3, 0.50, 1, 0.0), (21, 1.9, 0.35, 2, 1.3), (34, 4.0, 0.25, 3, 2.6), (8, 2.2, 0.30, 1, 4.1)]
RAY_C = [(np.cos(n * th_ + ph).astype(np.float32), np.sin(n * th_ + ph).astype(np.float32), n, a, mk, ps) for n, ph, a, mk, ps in RAYS]
RAY_COL = np.array([255, 245, 215], np.float32) / 255.0
# ---------------- mist ----------------
FW, FH, CELL = 1152, 720, 4
NX, NY = FW // CELL, FH // CELL
fx = np.fft.fftfreq(NX, d=CELL)[None, :]; fy = np.fft.fftfreq(NY, d=CELL)[:, None]
rrf = np.sqrt((2.4 * fx) ** 2 + fy ** 2) + 1e-9; lam_ = 1 / rrf
amp = np.clip((lam_ - 60) / 40, 0, 1) * np.clip((560 - lam_) / 200, 0, 1) * rrf ** -1.15
Z = (rng.standard_normal((NY, NX)) + 1j * rng.standard_normal((NY, NX))) * amp
FXF = fx * np.ones_like(fy); drift = np.abs(FXF) >= 1 / 520
mq = np.where(drift, np.sign(FXF) * np.maximum(1, np.round(np.abs(FXF) * 9.0 * T)), 0).astype(int)
mq = np.where(drift, mq + rng.choice([-1, 0, 0, 0, 1], size=mq.shape) * (np.abs(mq) > 1), 0)
qmod = rng.choice([1, 2], size=mq.shape); rho = rng.uniform(0, 2 * np.pi, size=mq.shape)
Zd = np.where(drift, Z, 0); Zs = np.where(drift, 0, Z)
def fog_raw(t):
    spec = Zd * np.exp(-2j * np.pi * mq * t / T) + Zs * (1 + 0.6 * np.cos(2 * np.pi * qmod * t / T + rho))
    return np.real(np.fft.ifft2(spec)).astype(np.float32)
FOG_STD = float(np.std(fog_raw(0.0)))
FOG_ROWS = int(np.searchsorted(v, FH - 8))
FX, FY = X[:FOG_ROWS] / CELL - 0.5, Y[:FOG_ROWS] / CELL - 0.5
_lum_s = 0.299 * SRC_OUT[:FOG_ROWS, :, 0] + 0.587 * SRC_OUT[:FOG_ROWS, :, 1] + 0.114 * SRC_OUT[:FOG_ROWS, :, 2]
FOG_BAND = m["fog_band"][:FOG_ROWS] * cv2.GaussianBlur(sm((_lum_s - 95) / 70).astype(np.float32), (0, 0), 1.5)
FOG_COL = np.array([228, 214, 206], np.float32)
# ---------------- petals ----------------
prng = np.random.default_rng(11); MARGIN = 70; PETALS = []
def add_petal(front):
    if front: y0 = prng.uniform(1185, 1340); r = prng.uniform(4.5, 7.5); wraps = 2; a0 = prng.uniform(0.6, 0.85); soft = 0.95
    else: y0 = prng.uniform(600, 1060); r = prng.uniform(1.8, 3.2); wraps = 1; a0 = prng.uniform(0.6, 0.9); soft = 0.5
    col = np.array([255, 251, 240], np.float32) if prng.uniform() < 0.72 else np.array([255, 222, 80], np.float32)
    PETALS.append(dict(front=front, x0=prng.uniform(0, OW + 2 * MARGIN), y0=y0, r=r, wraps=wraps, a0=a0, soft=soft,
                       ay=prng.uniform(10, 30), ky=int(prng.integers(2, 5)), py=prng.uniform(0, 2 * np.pi),
                       ax=prng.uniform(6, 18), kx=int(prng.integers(3, 6)), px=prng.uniform(0, 2 * np.pi),
                       th0=prng.uniform(0, np.pi), kr=int(prng.choice([-4, -3, -2, 2, 3, 4])), col=col))
for _ in range(24): add_petal(False)
for _ in range(9): add_petal(True)
def draw_petals(img, t, front):
    WT = OW + 2 * MARGIN
    for p in PETALS:
        if p["front"] != front: continue
        x = (p["x0"] + p["wraps"] * WT * t / T) % WT - MARGIN + p["ax"] * np.sin(2 * np.pi * p["kx"] * t / T + p["px"])
        y = p["y0"] + p["ay"] * np.sin(2 * np.pi * p["ky"] * t / T + p["py"])
        th = p["th0"] + 2 * np.pi * p["kr"] * t / T; flat = 0.35 + 0.65 * abs(np.cos(th))
        r = p["r"]; R = int(np.ceil(r * 3 + 3)); xi, yi = int(np.floor(x)), int(np.floor(y))
        x0_, x1_ = max(0, xi - R), min(OW, xi + R + 1); y0_, y1_ = max(0, yi - R), min(OH, yi + R + 1)
        if x0_ >= x1_ or y0_ >= y1_: continue
        yy, xx = np.mgrid[y0_:y1_, x0_:x1_].astype(np.float32); dx, dy = xx - x, yy - y
        c, s_ = np.cos(th * 0.5), np.sin(th * 0.5)
        d = np.sqrt(((c * dx + s_ * dy) / r) ** 2 + ((-s_ * dx + c * dy) / (r * flat)) ** 2)
        core = p["a0"] * sm((1.0 - d) / p["soft"]); glow = 0.15 * p["a0"] * np.exp(-0.5 * (d / 2.2) ** 2)
        reg = img[y0_:y1_, x0_:x1_]
        reg[:] = reg * (1 - core[..., None]) + p["col"] * core[..., None]
        reg += np.array([40, 34, 18], np.float32) * glow[..., None]

def bg_maps(t):
    G = gust_field(t); sw_amp = 0.45 + 0.55 * G; ru_amp = 0.4 + 0.6 * G
    fxb = LEAN_PX * A_g * G; fyb = 0.22 * LEAN_PX * A_g * G
    for k, ACx, ASx in SWAY:
        sw, cw = np.float32(np.sin(W(k) * t)), np.float32(np.cos(W(k) * t))
        fxb += sw_amp * (sw * ACx - cw * ASx); fyb += 0.18 * sw_amp * (cw * ACx + sw * ASx)
    for k, ACx, ASx in RUSTLE:
        sw, cw = np.float32(np.sin(W(k) * t)), np.float32(np.cos(W(k) * t))
        fxb += ru_amp * (sw * ACx - cw * ASx)
    a5 = W(5) * t
    for C, Sn in TREES:
        fxb += (np.float32(np.sin(a5)) * C + np.float32(1 - np.cos(a5)) * Sn) * (0.6 + 0.4 * G)
    fxb = np.where(fxb > 0, fxb * EX, fxb * EXR).astype(np.float32); fyb = np.where(fyb < 0, fyb * EYB, fyb).astype(np.float32)
    D2 = np.dstack([fxb, fyb]).astype(np.float32); qx, qy = X - fxb, Y - fyb
    for _ in range(3):
        Dq = cv2.remap(D2, (qx + 0.5) / S - 0.5, (qy + 0.5) / S - 0.5, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        qx, qy = X - Dq[..., 0], Y - Dq[..., 1]
    ab = 2 * np.pi * t / 3.75
    band = np.float32(np.cos(ab)) * cB + np.float32(np.sin(ab)) * sB
    return qx, qy, 1 + 0.07 * G * band * MEADOW, fxb, fyb

def render(t):
    mx, my, shade, fxb, fyb = bg_maps(t)
    out = cv2.remap(NOFL, mx, my, cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT_101)
    r = SKY_ROWS; sdx, sdy = sky_disp(t)
    out[:r] = cv2.remap(NOFL, mx[:r] - sdx, my[:r] - sdy, cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT_101)
    fl = flower_layer(t, fxb, fyb); a_f = np.clip(fl[..., 3:] / 255.0, 0, 1)
    out = out * (1 - a_f) + np.clip(fl[..., :3], 0, None)
    out *= shade[..., None]
    d_ = 0.018 * np.sin(2 * np.pi * t / T); pat = np.zeros_like(X)
    for C, Sn, n, a, mk, ps in RAY_C:
        prof = (0.5 + 0.5 * (C * np.float32(np.cos(n * d_)) - Sn * np.float32(np.sin(n * d_)))) ** 2
        pat += a * prof * np.float32(0.5 + 0.5 * np.cos(2 * np.pi * mk * t / T + ps))
    out += (75.0 * RAY_S * pat)[..., None] * RAY_COL
    draw_petals(out, t, front=False)
    f = cv2.remap(fog_raw(t), FX, FY, cv2.INTER_CUBIC, borderMode=cv2.BORDER_WRAP) / FOG_STD
    al = (0.42 * FOG_BAND * sm((f + 0.6) / 2.2))[..., None]
    out[:FOG_ROWS] += (FOG_COL - out[:FOG_ROWS]) * al
    ax, ay = man_map(t)
    man = cv2.remap(MAN4, ax, ay, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    glow = cv2.remap(GLOW, ax, ay, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    a_ = np.clip(man[..., 3:] / 255.0, 0, 1)
    out[RM] = (out[RM] + np.clip(glow, 0, None)) * (1 - a_) + np.clip(man[..., :3], 0, None)
    out = out * (1 - CALM_HARD) + SRC_OUT * CALM_HARD
    draw_petals(out, t, front=True)
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)

def work(i): return render(i / FPS).tobytes()

if __name__ == "__main__":
    if MODE == "test":
        TD = os.environ.get("TESTDIR", P + "/test_polish"); os.makedirs(TD, exist_ok=True)
        for t in [float(x) for x in sys.argv[3].split(",")]:
            t0 = time.time(); Image.fromarray(render(t)).save(TD + f"/f_{t:06.2f}.png"); print(f"t={t:6.2f} {time.time()-t0:.2f}s")
    elif MODE == "full":
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
               "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-", "-c:v", "ffv1", "-level", "3", "-pix_fmt", "gbrp", sys.argv[3]]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE); t0 = time.time()
        with Pool(4) as pool:
            for i, buf in enumerate(pool.imap(work, range(N), chunksize=4)):
                p.stdin.write(buf)
                if i % 150 == 0: print(f"frame {i}/{N} {time.time()-t0:.0f}s", flush=True)
        p.stdin.close(); p.wait(); print("done", time.time() - t0)
