"""Clean close-up hand sprite (Asset B frame 1854, mirrored) with the cut forearm completed.
Output: assets/char/hand_final.npz (rgba uint8, 1 frame) + preview."""
import sys, numpy as np, cv2

S = sys.argv[1]
d = np.load(f'{S}/assets/char/handcu.npz')
r = d['rgba'][2].copy()                         # frame 1854
rgb = r[..., :3].copy()
a0 = r[..., 3].astype(np.float32) / 255
H, W = a0.shape

# 1) GrabCut refinement: skin/gold vs. leaf background
mask = np.full((H, W), cv2.GC_PR_BGD, np.uint8)
mask[a0 > 0.5] = cv2.GC_PR_FGD
mask[cv2.erode((a0 > 0.9).astype(np.uint8), np.ones((15, 15), np.uint8)) > 0] = cv2.GC_FGD
mask[cv2.dilate((a0 > 0.1).astype(np.uint8), np.ones((25, 25), np.uint8)) == 0] = cv2.GC_BGD
# skin heuristic: high red, moderate green, low-ish blue -> probable FG; olive/brown leaves -> probable BG
f = rgb.astype(np.int32)
b, g, rr = f[..., 0], f[..., 1], f[..., 2]
skin = (rr > 170) & (g > 100) & (rr > b + 50) & (rr - g < 95) & (g - b > 15)
leaf = (rr < 170) | ((g > rr - 15) & (rr < 200))
mask[(mask == cv2.GC_PR_FGD) & leaf & ~skin] = cv2.GC_PR_BGD
bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
cv2.grabCut(rgb, mask, None, bgd, fgd, 4, cv2.GC_INIT_WITH_MASK)
fg = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(fg, 8)
k = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
fg = (lab == k).astype(np.uint8)
fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))

# 2) forearm edges per column; columns whose lower edge reaches the canvas bottom are "cut"
PADB = 220
H2 = H + PADB
A = np.zeros((H2, W), np.float32)
A[:H] = fg
C = np.zeros((H2, W, 3), np.uint8)
C[:H] = rgb
tops, bots, cut = {}, {}, {}
for x in range(W):
    col = np.where(fg[:, x] > 0)[0]
    if len(col) == 0:
        continue
    tops[x], bots[x] = col.min(), col.max()
    cut[x] = col.max() >= H - 4
cut_cols = sorted(x for x in cut if cut[x] and x > W * 0.4)
print('cut columns', (cut_cols[0], cut_cols[-1]) if cut_cols else None)
if cut_cols:
    x0c = cut_cols[0]
    ycut = H - 1
    for x in cut_cols:
        ext = 18 + 0.07 * (x - x0c)                      # true lower edge lies a little below the frame bottom
        # blend in smoothly from the first cut column
        ext *= min(1.0, (x - x0c + 1) / 40.0)
        y_new = ycut + ext
        src_row = C[ycut - 8, x].astype(np.float32)
        ys = np.arange(ycut - 6, int(np.ceil(y_new)) + 1)
        u = np.clip((ys - (ycut - 6)) / max(1.0, y_new - (ycut - 6)), 0, 1)
        shade = 1.0 - 0.20 * u ** 1.5                   # underside in shadow
        cols = src_row[None] * shade[:, None]
        keep_real = ys < ycut - 6
        C[ys[~keep_real], x] = np.clip(cols[~keep_real], 0, 255).astype(np.uint8)
        A[ys, x] = 1.0
        yl = int(np.ceil(y_new))
        A[yl, x] = y_new - np.floor(y_new) if y_new > np.floor(y_new) else 1.0
# 3) soften alpha edge slightly, decontaminate colours near the edge with inward push
A = cv2.GaussianBlur(A, (0, 0), 0.9)
solid = (A > 0.95).astype(np.uint8)
inner = cv2.erode(solid, np.ones((5, 5), np.uint8))
Cf = C.astype(np.float32)
num = cv2.GaussianBlur(Cf * inner[..., None], (0, 0), 3)
den = cv2.GaussianBlur(inner.astype(np.float32), (0, 0), 3)[..., None]
fill = num / np.maximum(den, 1e-4)
edge = ((A > 0.02) & (inner == 0))[..., None]
Cf = np.where(edge, fill, Cf)
out = np.dstack([np.clip(Cf, 0, 255).astype(np.uint8), (np.clip(A, 0, 1) * 255).astype(np.uint8)])
ys, xs = np.where(out[..., 3] > 8)
out = out[max(0, ys.min() - 6):ys.max() + 7, max(0, xs.min() - 6):]
np.savez_compressed(f'{S}/assets/char/hand_final.npz', rgba=out[None], frames=np.array([1854]))
al = out[..., 3:4].astype(np.float32) / 255
prev = (out[..., :3].astype(np.float32) * al + np.array([60, 30, 25]) * (1 - al)).astype(np.uint8)
cv2.imwrite(f'{S}/frames/hand_final.jpg', cv2.resize(prev, None, fx=0.6, fy=0.6))
print('hand sprite', out.shape)
