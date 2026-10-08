"""Detect individual flower heads (white + orange) in the meadow of the clean plate."""
import numpy as np, cv2, sys
from PIL import Image
SP = sys.argv[1]
L = np.load(SP + "/work/layers.npz")
img = L["clean"].astype(np.float32)
H, W = img.shape[:2]
YY = np.mgrid[0:H, 0:W][0]
R, G, B = img[..., 0], img[..., 1], img[..., 2]
lum = 0.299 * R + 0.587 * G + 0.114 * B
mx = img.max(-1); mn = img.min(-1); sat = (mx - mn) / np.maximum(mx, 1)
def tophat(a, r):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    return a - cv2.morphologyEx(a, cv2.MORPH_OPEN, k)
th = np.maximum(tophat(lum, 5), tophat(lum, 13))
white = (th > 16) & (sat < 0.38) & (lum > 62)
thr = np.maximum(tophat(R, 5), tophat(R, 11))
orange = (R > 75) & (R - B > 40) & (G > 0.32 * R) & (G < 0.9 * R) & (thr > 14)
occ = np.maximum(L["alpha_m"], L["alpha_g"]) > 0.05
occ = cv2.dilate(occ.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
m = (white | orange) & (YY > 565) & ~occ
m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
n, lab, st, cen = cv2.connectedComponentsWithStats(m, connectivity=8)
keep = np.zeros(n, bool)
for i in range(1, n):
    a = st[i, cv2.CC_STAT_AREA]; cy = cen[i][1]
    persp = (cy - 480) / (H - 480)
    if a >= max(3, 10 * persp ** 2) and st[i, cv2.CC_STAT_WIDTH] < 90 and st[i, cv2.CC_STAT_HEIGHT] < 90:
        keep[i] = True
idx = np.where(keep)[0]
lab2 = np.where(keep[lab], lab, 0).astype(np.int32)
print("flower heads:", len(idx), " area stats:", np.percentile(st[idx, cv2.CC_STAT_AREA], [10, 50, 90, 99]))
np.savez_compressed(SP + "/work/flowers.npz", lab=lab2, stats=st, cen=cen, idx=idx)
vis = img * 0.45
vis[lab2 > 0] = [60, 255, 120]
Image.fromarray(np.clip(vis, 0, 255).astype(np.uint8)).save(SP + "/work/flowers_vis.png")
