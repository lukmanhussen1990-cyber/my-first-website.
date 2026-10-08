"""Prototype of stricter flower-head labelling (scratch only)."""
import numpy as np, cv2, scipy.ndimage as ndi
from PIL import Image
import sys; P = sys.argv[1]; OUT = P + "/work/"
Lz = np.load(P + "/work/layers.npz"); Mz = np.load(P + "/work/masks.npz")
img = Lz["clean"].astype(np.float32); H, W = img.shape[:2]
R_, G_, B_ = img[..., 0], img[..., 1], img[..., 2]
L2 = 0.299 * R_ + 0.587 * G_ + 0.114 * B_
mx_, mn_ = img.max(-1), img.min(-1); sat = (mx_ - mn_) / np.maximum(mx_, 1)
def tophat(x, r):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)); return x - cv2.morphologyEx(x, cv2.MORPH_OPEN, k)
th = np.maximum.reduce([tophat(L2, 6), tophat(L2, 16), tophat(L2, 34)])
white = (th > 18) & (sat < 0.24) & (L2 > 150) & (B_ > 0.72 * R_)
# yellow petals: strongly saturated, almost no blue; sunlit grass has B ~ 0.3-0.45 G and R/G closer to 1
ycore = (R_ > 200) & (B_ < 0.20 * G_) & (G_ > 0.60 * R_) & (G_ < 0.92 * R_)
ygrow = (R_ > 165) & (B_ < 0.35 * G_) & (G_ > 0.55 * R_) & (G_ < 0.95 * R_)
yel = ycore.copy()
for _ in range(3): yel = (cv2.dilate(yel.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & (ygrow | ycore)
ycen = (R_ > 150) & (B_ < 0.5 * G_) & (G_ > 0.55 * R_) & (G_ < 0.95 * R_)   # daisy eyes: only kept when inside a white ring
wd = cv2.dilate(white.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
yel = yel | (ycen & ndi.binary_fill_holes(wd) & ~wd) | (ycen & cv2.erode(cv2.morphologyEx(white.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))), np.ones((1, 1), np.uint8)) > 0)
occ = cv2.dilate((Lz["alpha_m"] > 0.05).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
fm = (white | yel) & (Mz["A_grass"] > 0.02) & ~occ
fm = cv2.morphologyEx(fm.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
fm = ndi.binary_fill_holes(fm).astype(np.uint8)
lab0, n = ndi.label(fm, structure=np.ones((3, 3)))
keep = np.zeros(n + 1, bool); objs = ndi.find_objects(lab0)
for i, sl in enumerate(objs, start=1):
    if sl is None: continue
    m = (lab0[sl] == i).astype(np.uint8); ar = int(m.sum()); h, w = m.shape
    cy = (sl[0].start + sl[0].stop) / 2; persp = max((cy - 480) / (H - 480), 0)
    if ar < max(4, 12 * persp ** 2): continue
    if max(w, h) > 14 + 70 * persp ** 1.5: continue
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    hull = cv2.contourArea(cv2.convexHull(max(cs, key=cv2.contourArea)))
    wf = float(white[sl][m > 0].mean())
    if hull > 0 and ar / hull < (0.55 if wf > 0.5 else 0.70): continue
    mo = cv2.moments(m, True)
    c = np.array([[mo["mu20"], mo["mu11"]], [mo["mu11"], mo["mu02"]]]) / mo["m00"]
    ev = np.linalg.eigvalsh(c)
    if np.sqrt(max(ev[1], 1e-6) / max(ev[0], 1e-6)) > 2.4: continue
    # drop partial labels: a head whose surrounding ring is still bright/white is only part of a bigger
    # (usually defocused) daisy -> moving it alone slides the eye off its petals
    pad = 14; ys0, ys1 = max(0, sl[0].start - pad), min(H, sl[0].stop + pad); xs0, xs1 = max(0, sl[1].start - pad), min(W, sl[1].stop + pad)
    mm = (lab0[ys0:ys1, xs0:xs1] == i).astype(np.uint8)
    ring = (cv2.dilate(mm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))) > 0) & ~(cv2.dilate(mm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0)
    brightw = (L2[ys0:ys1, xs0:xs1] > 165) & (sat[ys0:ys1, xs0:xs1] < 0.30) & (lab0[ys0:ys1, xs0:xs1] != i)
    if (wf < 0.5 or cy > 1080) and ring.any() and brightw[ring].mean() > 0.20: continue
    if cy > 1100 and wf > 0.3: continue      # defocused daisies in the bokeh band: grass field only
    # defocused foreground: soft edges -> part of a bokeh daisy; leave it to the grass field
    if cy > 1080:
        lap = cv2.Laplacian(L2[ys0:ys1, xs0:xs1], cv2.CV_32F)
        if np.abs(lap)[cv2.dilate(mm, np.ones((5, 5), np.uint8)) > 0].mean() < 6.0: continue
    keep[i] = True
lab = np.where(keep[lab0], lab0, 0).astype(np.int32)
print("old heads:", len(np.unique(np.load(P + "/work/flowers.npz")["lab"])) - 1, " new heads:", int(keep.sum()))
np.savez_compressed(OUT + "flowers_v3.npz", lab=lab)
src = np.array(Image.open(P + "/src/source.png").convert("RGB")).astype(np.float32)
def show(lab_, x0, y0, x1, y1, name, sc=3):
    a = src[y0:y1, x0:x1]; l = lab_[y0:y1, x0:x1]
    edge = (cv2.dilate((l > 0).astype(np.uint8), np.ones((3, 3))) > 0) & ~(l > 0)
    b = a.copy(); b[edge] = [255, 0, 255]; return b
old = np.load(P + "/work/flowers.npz")["lab"]
for (x0, y0, x1, y1, nm) in [(180, 880, 370, 1040, "L"), (720, 900, 880, 1020, "R"), (0, 1100, 400, 1374, "FG")]:
    sc = 3 if nm != "FG" else 2
    a = show(old, x0, y0, x1, y1, nm); b = show(lab, x0, y0, x1, y1, nm)
    im = np.concatenate([a, np.full((a.shape[0], 4, 3), 255.), b], 1)
    Image.fromarray(im.astype(np.uint8)).resize((im.shape[1] * sc, im.shape[0] * sc), Image.Resampling.NEAREST).save(OUT + f"labels_old_vs_v3_{nm}.png")
vis = src * 0.55; e = (cv2.dilate((lab > 0).astype(np.uint8), np.ones((3, 3))) > 0) & ~(lab > 0); vis[e] = [255, 0, 255]
Image.fromarray(vis.astype(np.uint8)).crop((0, 600, 1145, 1374)).save(OUT + "labels_v3_full.png")
