import numpy as np, cv2, sys
from PIL import Image
P = sys.argv[1]
Lz = np.load(P + "/work/layers.npz"); Mz = np.load(P + "/work/masks.npz")
img = Lz["clean"]; H, W = img.shape[:2]
R, G, B = img[..., 0], img[..., 1], img[..., 2]
L2 = 0.299 * R + 0.587 * G + 0.114 * B
mx_, mn_ = img.max(-1), img.min(-1); sat = (mx_ - mn_) / np.maximum(mx_, 1)
def tophat(x, r):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)); return x - cv2.morphologyEx(x, cv2.MORPH_OPEN, k)
th = np.maximum.reduce([tophat(L2, 6), tophat(L2, 16), tophat(L2, 34)])
white = (th > 18) & (sat < 0.30) & (L2 > 135)
thr = np.maximum.reduce([tophat(R, 6), tophat(R, 14), tophat(R, 30)])
yel = (R > 160) & (G > 125) & (B < 0.6 * G) & (R > 0.92 * G) & (thr > 22)
occ = cv2.dilate((Lz["alpha_m"] > 0.05).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
fm = (white | yel) & (Mz["A_grass"] > 0.02) & ~occ
fm = cv2.morphologyEx(fm.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
import scipy.ndimage as ndi
core_ = cv2.erode(fm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
nc, clab = cv2.connectedComponents(core_, connectivity=8)
_, (iy, ix) = ndi.distance_transform_edt(core_ == 0, return_indices=True)
lab0 = np.where(fm > 0, clab[iy, ix], 0).astype(np.int32)
small = (fm > 0) & (lab0 == 0)                      # tiny flowers that vanished under the erosion
ns, slab = cv2.connectedComponents(small.astype(np.uint8), connectivity=8)
lab0 = np.where(slab > 0, slab + nc, lab0).astype(np.int32)
n = int(lab0.max()) + 1
st = np.zeros((n, 5), np.int64); cen = np.zeros((n, 2))
objs = ndi.find_objects(lab0)
for i, sl in enumerate(objs, start=1):
    if sl is None: continue
    mm = lab0[sl] == i
    st[i] = [sl[1].start, sl[0].start, sl[1].stop - sl[1].start, sl[0].stop - sl[0].start, int(mm.sum())]
    yy, xx = np.nonzero(mm); cen[i] = [xx.mean() + sl[1].start, yy.mean() + sl[0].start]
lab = lab0
keep = np.zeros(n, bool)
for i in range(1, n):
    ar = st[i, cv2.CC_STAT_AREA]; persp = (cen[i][1] - 480) / (H - 480)
    if ar < max(3, 10 * persp ** 2) or st[i, cv2.CC_STAT_WIDTH] > 160 or st[i, cv2.CC_STAT_HEIGHT] > 160: continue
    x, y, w, h = st[i, :4]
    m = (lab[y:y + h, x:x + w] == i).astype(np.uint8)
    mo = cv2.moments(m, True)
    if mo["m00"] > 0:
        c = np.array([[mo["mu20"], mo["mu11"]], [mo["mu11"], mo["mu02"]]]) / mo["m00"]
        ev = np.linalg.eigvalsh(c); el = np.sqrt(max(ev[1], 1e-6) / max(ev[0], 1e-6))
        if el > 3.2 and ar > 10: continue          # thin grass blades, not flower heads
    if max(w, h) > 20 + 90 * max(persp, 0) ** 2: continue          # too big for a single head at this depth
    if ar / float(w * h) < 0.3: continue
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cs:
        hull = cv2.contourArea(cv2.convexHull(max(cs, key=cv2.contourArea)))
        if hull > 0 and ar / hull < 0.55: continue                # lacy blobs (grass + flowers merged)
    keep[i] = True
lab2 = np.where(keep[lab], lab, 0).astype(np.int32)
print("flower heads:", int(keep.sum()))
np.savez_compressed(P + "/work/flowers.npz", lab=lab2)
vis = img * 0.45; vis[lab2 > 0] = [255, 40, 200]
Image.fromarray(np.clip(vis, 0, 255).astype(np.uint8)).crop((0, 480, 1145, 1374)).resize((860, 671), Image.Resampling.LANCZOS).save(P + "/work/flowers_vis_small.png")
