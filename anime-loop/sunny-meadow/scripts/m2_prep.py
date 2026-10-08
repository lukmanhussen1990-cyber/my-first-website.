"""Scene 2 (man in sunny meadow): masks, clean plate (LaMa), man layer, flower heads."""
import numpy as np, cv2, sys
import onnxruntime as ort
from PIL import Image
P = sys.argv[1]
src = np.array(Image.open(P + "/src/source.png").convert("RGB")).astype(np.float32)
H, W = src.shape[:2]
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
fg = cv2.imread(P + "/work/mask_crop.png", cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255.0
def poly(pts):
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.array(pts, np.int32)], 1); return m.astype(np.float32)
def dil(m, r):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)); return cv2.dilate((m > 0.5).astype(np.uint8), k).astype(np.float32)
def soft(m, s): return cv2.GaussianBlur(m.astype(np.float32), (0, 0), s)
def feather_out(m, grow, sigma):
    return np.maximum(soft(dil(m, grow), sigma), (m > 0.5).astype(np.float32))
def sm(z): z = np.clip(z, 0, 1); return z * z * (3 - 2 * z)

# ---- man layer ----
a = np.clip((fg - 0.2) / 0.4, 0, 1)
a = cv2.dilate(a, np.ones((3, 3), np.uint8)); a = np.clip(cv2.GaussianBlur(a, (0, 0), 0.7), 0, 1)
n, lab, st, _ = cv2.connectedComponentsWithStats((a > 0.5).astype(np.uint8))
core = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.float32)
alpha_m = a * dil(core, 4)
HEAD = [(578,300),(584,278),(596,258),(615,246),(645,239),(675,244),(700,261),(712,290),(716,330),(709,362),
        (690,373),(668,360),(655,347),(625,353),(592,351),(582,330)]
head = poly(HEAD)
head_glow = dil((alpha_m > 0.05) * dil(head, 6), 12) * (YY < 390)
occ = alpha_m
lama_hole = np.maximum(dil(occ > 0.02, 3), head_glow)
sess = ort.InferenceSession(P + "/models/lama_fp32.onnx", providers=["CPUExecutionProvider"])
work = src.copy(); todo = lama_hole.copy()
for (x0, y0) in ((380, 140), (380, 600), (380, 862)):
    x0 = min(max(0, x0), W - 512); y0 = min(max(0, y0), H - 512)
    msk = todo[y0:y0 + 512, x0:x0 + 512]
    if msk.sum() == 0: continue
    out = sess.run(None, {"image": (work[y0:y0 + 512, x0:x0 + 512] / 255.0).transpose(2, 0, 1)[None].astype(np.float32),
                          "mask": (msk > 0.5)[None, None].astype(np.float32)})[0][0].transpose(1, 2, 0)
    sel = msk > 0.5
    work[y0:y0 + 512, x0:x0 + 512][sel] = np.clip(out[sel], 0, 255); todo[y0:y0 + 512, x0:x0 + 512][sel] = 0
print("unfilled:", int(todo.sum()))
use = np.maximum(dil(occ > 0.02, 1), head_glow); use = np.maximum(use, soft(use, 1.0))
clean = work * use[..., None] + src * (1 - use[..., None])
diff = cv2.GaussianBlur(np.clip(src - clean, 0, 255), (0, 0), 2.0)
glow_m = diff * (soft(head_glow, 3) * (1 - alpha_m))[..., None]
rec = clean * (1 - alpha_m[..., None]) + src * alpha_m[..., None] + glow_m
print("rest reconstruction MAE:", round(float(np.abs(rec - src).mean()), 4))
np.savez_compressed(P + "/work/layers.npz", clean=clean.astype(np.float32), man_rgb=src.astype(np.float32),
                    alpha_m=alpha_m.astype(np.float32), glow_m=glow_m.astype(np.float32))
Image.fromarray(np.clip(clean, 0, 255).astype(np.uint8)).save(P + "/work/clean_plate.png")

# ---- motion weights ----
w_mhead = feather_out(head, 8, 6)
FACE = [(582,300),(600,282),(625,277),(650,290),(663,320),(661,345),(626,353),(592,351),(583,326)]
face = feather_out(poly(FACE), 4, 3)
d_c = np.hypot(XX - 645, YY - 318)
w_mhair = head * np.clip((d_c - 42) / 38, 0, 1)
w_mhair = soft(w_mhair, 3) * (1 - face)
w_mhair = np.maximum(w_mhair, soft((alpha_m > 0.1) * (YY < 262) * dil(head, 14), 2))   # flyaway strands on top
# jacket flaps: lower jacket near its outer edges
jac = core * (YY > 540) * (YY < 730)
edge_l = np.clip(1 - np.abs(XX - 515) / 40, 0, 1); edge_r = np.clip(1 - np.abs(XX - 742) / 45, 0, 1)
w_jacket = soft(jac * np.maximum(edge_l, edge_r) * sm((YY - 540) / 120), 3)
w_trouser = soft(core * sm((YY - 720) / 60) * sm((1050 - YY) / 80), 4)
# sky (cloud drift), meadow, fog bands, trees
fy = sm((305 - YY) / 75)
MEADOW_POLY = [(0,500),(150,525),(300,560),(430,595),(500,618),(560,640),(760,680),(900,692),(1145,705),(1145,1374),(0,1374)]
meadow = soft(poly(MEADOW_POLY), 12)
A_grass = meadow * np.clip((YY - 480) / (H - 480), 0.04, 1)
fog_band = (np.exp(-((YY - 437) / 26) ** 2) * 0.9 + np.exp(-((YY - 628) / 30) ** 2) * sm((XX - 760) / 120) * 0.9)
fog_band = np.clip(fog_band, 0, 1)
lum = 0.299 * src[..., 0] + 0.587 * src[..., 1] + 0.114 * src[..., 2]
trees = {}
for k, (x0, x1, yt, yb) in {"t1": (90, 200, 395, 540), "t2": (290, 400, 450, 585), "t3": (745, 850, 555, 660)}.items():
    m = np.zeros((H, W), np.float32); m[yt:yb, x0:x1] = (lum[yt:yb, x0:x1] < 95)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    trees[k] = soft(m, 2.5) * np.clip((yb - YY) / (yb - yt), 0, 1) ** 1.5 * (1 - alpha_m)
np.savez_compressed(P + "/work/masks.npz", w_mhead=w_mhead, w_mhair=w_mhair, w_jacket=w_jacket, w_trouser=w_trouser,
                    face=face, w_sky=fy, A_grass=A_grass, fog_band=fog_band, **trees)

# ---- flower heads (white daisies + yellow) on the clean plate ----
img = clean; R, G, B = img[..., 0], img[..., 1], img[..., 2]
L2 = 0.299 * R + 0.587 * G + 0.114 * B
mx_, mn_ = img.max(-1), img.min(-1); sat = (mx_ - mn_) / np.maximum(mx_, 1)
def tophat(x, r):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)); return x - cv2.morphologyEx(x, cv2.MORPH_OPEN, k)
th = np.maximum(tophat(L2, 6), tophat(L2, 16))
white = (th > 22) & (sat < 0.28) & (L2 > 150)
yel = (R > 160) & (G > 125) & (B < 0.6 * G) & (R > 0.92 * G) & (np.maximum(tophat(R, 6), tophat(R, 14)) > 22)
fm = (white | yel) & (meadow > 0.5) & ~(dil(alpha_m > 0.05, 3) > 0)
fm = cv2.morphologyEx(fm.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
n, lab, st, cen = cv2.connectedComponentsWithStats(fm, connectivity=8)
keep = np.zeros(n, bool)
for i in range(1, n):
    ar = st[i, cv2.CC_STAT_AREA]; persp = (cen[i][1] - 480) / (H - 480)
    keep[i] = ar >= max(3, 10 * persp ** 2) and st[i, cv2.CC_STAT_WIDTH] < 110 and st[i, cv2.CC_STAT_HEIGHT] < 110
lab2 = np.where(keep[lab], lab, 0).astype(np.int32)
print("flower heads:", int(keep.sum()))
np.savez_compressed(P + "/work/flowers.npz", lab=lab2)
vis = img * 0.45; vis[lab2 > 0] = [255, 40, 200]
Image.fromarray(np.clip(vis, 0, 255).astype(np.uint8)).save(P + "/work/flowers_vis.png")
