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
am = L["alpha_m"][..., None]
MAN4 = np.dstack([L["man_rgb"] * am, am * 255.0]).astype(np.float32)
GLOW = L["glow_m"].astype(np.float32)
_occ = to_out(L["alpha_m"])
_fz = cv2.dilate(((_occ > 0.05) & (Y > 1060)).astype(np.float32), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
CALM_HARD = np.clip(cv2.GaussianBlur(_fz, (0, 0), 4), 0, 1)[..., None]
CALM_SOFT = np.clip(cv2.GaussianBlur(cv2.dilate(_fz, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))), (0, 0), 22), 0, 1)

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
P_FEET, P_NECK = (650, 1155), (640, 368)
w_sway = sm((1060 - Ym) / 200)
w_upper = sm((700 - Ym) / 200)
g_breath = (220 * sm((640 - Ym) / 220)).astype(np.float32)
mh1 = osc_parts(2 * np.pi * (Xm - 580) / 160); mh2 = osc_parts(2 * np.pi * (Xm / 110 + Ym / 140))
mh1q = osc_parts(2 * np.pi * (Xm - 580) / 160 + np.pi / 2)
jk1 = osc_parts(2 * np.pi * (Ym - 540) / 150); jk2 = osc_parts(2 * np.pi * (Ym - 540) / 150 + 1.1)
tr1 = osc_parts(2 * np.pi * (Ym - 720) / 220 + 2 * np.pi * Xm / 300)
def man_map(t):
    G = gust_at(t, 650.0, 1150.0)
    sx, sy = rot_back(D2R * (1.3 * np.sin(W(3) * t) + 0.4 * np.sin(W(5) * t)), *P_FEET, Xm, Ym)    # sway
    bx, by = w_sway * sx, w_sway * sy
    br = (1 - np.cos(W(5) * t)) / 2                                                       # deep breaths (6 s)
    by += np.float32(0.022 * br) * g_breath
    lx, ly = rot_back(D2R * 1.2 * br, 630, 660, Xm, Ym)                                   # leans back on the inhale
    bx += w_upper * lx; by += w_upper * ly
    hx, hy = rot_back(D2R * (4.0 * br + 2.0 * np.sin(W(2) * t)), *P_NECK, Xm, Ym)        # head tilts back
    bx += mm["w_mhead"] * hx; by += mm["w_mhead"] * hy
    a6, a8, a10 = W(6) * t, W(8) * t, W(10) * t
    hair = 0.6 * osc(a6, *mh1) + 0.4 * osc(a10, *mh2)
    bx -= mm["w_mhair"] * (6.0 * hair + np.float32(5.0 * G))                              # hair in the wind
    by -= mm["w_mhair"] * (1.6 * osc(a6, *mh1q) - np.float32(2.0 * G))
    bx -= mm["w_jacket"] * (3.5 * osc(a6, *jk1) + np.float32(2.6 * G))                    # jacket flaps
    by -= mm["w_jacket"] * 0.8 * osc(a8, *jk2)
    bx -= mm["w_trouser"] * (1.8 * osc(a8, *tr1) + np.float32(1.2 * G))                   # trouser fabric
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
A_g = (m["A_grass"] * (1 - CALM_SOFT)).astype(np.float32)
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
LEAN_PX = 16.0
BPH = 2 * np.pi * gx / 0.6
cB, sB = np.cos(BPH).astype(np.float32), np.sin(BPH).astype(np.float32)
MEADOW = (m["A_grass"] > 0.02).astype(np.float32) * (1 - CALM_SOFT)
# individual flowers
FL = np.load(P + "/work/flowers.npz")
lab_out = cv2.remap(FL["lab"].astype(np.float32), X, Y, cv2.INTER_NEAREST).astype(np.int32)
_rows, _cols, _vals, FLW = [], [], [], []
for l, sl in enumerate(ndi.find_objects(lab_out), start=1):
    if sl is None: continue
    ys_, xs_ = sl; hh, ww = ys_.stop - ys_.start, xs_.stop - xs_.start
    area = float((lab_out[sl] == l).sum()); r = np.sqrt(area / np.pi); f = 1.5 + 0.35 * r; Ls = 2.2 * hh + 4
    pad = int(np.ceil(f + 2))
    y0, y1 = max(0, ys_.start - pad), min(OH, ys_.stop + int(np.ceil(Ls)) + pad)
    x0, x1 = max(0, xs_.start - pad), min(OW, xs_.stop + pad)
    loc = (lab_out[y0:y1, x0:x1] == l)
    d = cv2.distanceTransform((~loc).astype(np.uint8), cv2.DIST_L2, 3)
    yy_, xx_ = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    cyl, cxl = float(yy_[loc].mean()), float(xx_[loc].mean()); yb = float(yy_[loc].max())
    w = np.maximum(sm(1 - d / f), np.clip(1 - (yy_ - yb) / Ls, 0, 1) * (yy_ > yb) * np.clip(1 - np.abs(xx_ - cxl) / (0.3 * ww + 2.0), 0, 1))
    nz = w > 0.01
    if not nz.any(): continue
    fid = len(FLW)
    _rows.append(yy_[nz].astype(np.int64) * OW + xx_[nz].astype(np.int64)); _cols.append(np.full(int(nz.sum()), fid)); _vals.append(w[nz])
    srcy = cyl * S; persp = max(0.05, (srcy - 480) / (H0 - 480))
    FLW.append((cxl * S, srcy, min(14.0 * persp, 0.95 * (r + f) + 1.5)))
FLM = sps.csr_matrix((np.concatenate(_vals).astype(np.float32), (np.concatenate(_rows), np.concatenate(_cols))), shape=(OH * OW, len(FLW)))
FL_NRM = ((1.0 / np.maximum(1.0, np.asarray(FLM.sum(axis=1)).ravel())).astype(np.float32).reshape(OH, OW)) * (1 - CALM_SOFT)
FLW = np.array(FLW, np.float32); NF = len(FLW)
frng = np.random.default_rng(5)
FL_K1 = frng.choice([4, 5, 6], NF); FL_P1 = frng.uniform(0, 2 * np.pi, NF)
FL_K2 = frng.choice([8, 10], NF); FL_P2 = frng.uniform(0, 2 * np.pi, NF)
FL_K3 = frng.choice([5, 6], NF); FL_P3 = frng.uniform(0, 2 * np.pi, NF)
def flower_field(t):
    G = gust_at(t, FLW[:, 0], FLW[:, 1]).astype(np.float32); A = FLW[:, 2]
    dx = A * (0.55 * G + 0.45 * np.sin(2 * np.pi * FL_K1 * t / T + FL_P1) + 0.15 * np.sin(2 * np.pi * FL_K2 * t / T + FL_P2))
    dy = A * (0.22 * G + 0.10 * np.sin(2 * np.pi * FL_K3 * t / T + FL_P3))
    return (FLM @ dx.astype(np.float32)).reshape(OH, OW) * FL_NRM, (FLM @ dy.astype(np.float32)).reshape(OH, OW) * FL_NRM
TREES = []
for name, ph in (("t1", 0.0), ("t2", 1.7), ("t3", 3.1)):
    C, Sn = osc_parts(ph + 2 * np.pi * X / 400)
    TREES.append(((3.5 * m[name] * C).astype(np.float32), (3.5 * m[name] * Sn).astype(np.float32)))
SKY = m["w_sky"].astype(np.float32); SKY_ROWS = int(np.searchsorted(v, 325))
V_SKY, L_SKY = 3.2, 5.0
# ---------------- sun rays (zero-mean shimmer around the sun) ----------------
SUN = (15.0, 12.0)
rr_ = np.hypot(X - SUN[0], Y - SUN[1]); th_ = np.arctan2(Y - SUN[1], X - SUN[0])
RAY_S = (sm(rr_ / 90) * np.exp(-rr_ / 420) * (1 - sm((Y - 560) / 120))).astype(np.float32)
RAYS = [(13, 1, 0.50, 0.3), (21, -2, 0.35, 1.9), (34, 3, 0.25, 4.0), (8, 1, 0.30, 2.2)]
RAY_C = [(np.cos(n * th_ + ph).astype(np.float32), np.sin(n * th_ + ph).astype(np.float32), mk, a) for n, mk, a, ph in RAYS]
RAY_COL = np.array([255, 245, 215], np.float32) / 255.0
# ---------------- mist ----------------
FW, FH, CELL = 1152, 720, 4
NX, NY = FW // CELL, FH // CELL
fx = np.fft.fftfreq(NX, d=CELL)[None, :]; fy = np.fft.fftfreq(NY, d=CELL)[:, None]
rrf = np.sqrt((2.4 * fx) ** 2 + fy ** 2) + 1e-9; lam_ = 1 / rrf
amp = np.clip((lam_ - 60) / 40, 0, 1) * np.clip((900 - lam_) / 300, 0, 1) * rrf ** -1.15
Z = (rng.standard_normal((NY, NX)) + 1j * rng.standard_normal((NY, NX))) * amp
drift = (1 / (np.abs(fx) + 1e-9) * np.ones_like(fy)) <= 380
mq = np.round(fx * 16.0 * T * np.ones_like(fy)).astype(int)
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
FOG_COL = np.array([238, 241, 245], np.float32)
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
    ffx, ffy = flower_field(t); fxb += ffx; fyb += ffy
    D2 = np.dstack([fxb, fyb]).astype(np.float32); qx, qy = X - fxb, Y - fyb
    for _ in range(2):
        Dq = cv2.remap(D2, (qx + 0.5) / S - 0.5, (qy + 0.5) / S - 0.5, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        qx, qy = X - Dq[..., 0], Y - Dq[..., 1]
    ab = 2 * np.pi * t / 3.75
    band = np.float32(np.cos(ab)) * cB + np.float32(np.sin(ab)) * sB
    return qx, qy, 1 + 0.09 * G * band * MEADOW

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
    # sun rays shimmer
    pat = np.zeros_like(X)
    for C, Sn, mk, a in RAY_C:
        ph = 2 * np.pi * mk * t / T
        pat += a * (C * np.float32(np.cos(ph)) + Sn * np.float32(np.sin(ph)))
    pat *= np.float32(1 + 0.25 * np.sin(W(2) * t))
    out += (50.0 * RAY_S * pat)[..., None] * RAY_COL
    draw_petals(out, t, front=False)
    f = cv2.remap(fog_raw(t), FX, FY, cv2.INTER_CUBIC, borderMode=cv2.BORDER_WRAP) / FOG_STD
    al = (0.32 * FOG_BAND * sm((f + 0.3) / 2.2))[..., None]
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
        os.makedirs(P + "/test", exist_ok=True)
        for t in [float(x) for x in sys.argv[3].split(",")]:
            t0 = time.time(); Image.fromarray(render(t)).save(P + f"/test/f_{t:06.2f}.png"); print(f"t={t:6.2f} {time.time()-t0:.2f}s")
    elif MODE == "full":
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
               "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-", "-c:v", "ffv1", "-level", "3", "-pix_fmt", "gbrp", sys.argv[3]]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE); t0 = time.time()
        with Pool(4) as pool:
            for i, buf in enumerate(pool.imap(work, range(N), chunksize=4)):
                p.stdin.write(buf)
                if i % 150 == 0: print(f"frame {i}/{N} {time.time()-t0:.0f}s", flush=True)
        p.stdin.close(); p.wait(); print("done", time.time() - t0)
