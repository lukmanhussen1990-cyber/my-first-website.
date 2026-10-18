"""Keyframe masks of the original Chor via outline-bounded flood fill.
usage: keymask.py S n seedx,seedy[;seedx,seedy...] x0 y0 x1 y1 [outline_thresh]"""
import cv2, numpy as np, sys
S = sys.argv[1]; n = int(sys.argv[2])
seeds = [tuple(map(int, p.split(','))) for p in sys.argv[3].split(';')]
x0, y0, x1, y1 = map(int, sys.argv[4:8])
th = int(sys.argv[8]) if len(sys.argv) > 8 else 110
blue_only = len(sys.argv) > 9 and sys.argv[9] == 'blue'
cap = cv2.VideoCapture(S + '/src/A_original.mp4'); cap.set(cv2.CAP_PROP_POS_FRAMES, n)
ok, f = cap.read()
roi = f[y0:y1, x0:x1].astype(np.int32)
b, g, r = roi[..., 0], roi[..., 1], roi[..., 2]
L = (b + g + r) / 3
outline = ((b > th) & (b >= r) & (L > 85)).astype(np.uint8)
wall = cv2.dilate(outline, np.ones((3, 3), np.uint8))
free = (1 - wall).astype(np.uint8)
if blue_only:
    bl = ((b > r + 10) & (b > 40)).astype(np.uint8)
    bl = cv2.morphologyEx(bl, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    free = free & bl
reg = np.zeros_like(free)
for sx, sy in seeds:
    ff = free.copy(); m = np.zeros((free.shape[0] + 2, free.shape[1] + 2), np.uint8)
    cv2.floodFill(ff, m, (sx - x0, sy - y0), 2)
    reg |= (ff == 2).astype(np.uint8)
sil = cv2.dilate(reg, np.ones((5, 5), np.uint8))
sil = cv2.morphologyEx(sil, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
# fill small holes
hh, ww = sil.shape; ff = sil.copy(); m = np.zeros((hh + 2, ww + 2), np.uint8)
cv2.floodFill(ff, m, (0, 0), 1); holes = (ff == 0); sil[holes] = 1
full = np.zeros(f.shape[:2], np.uint8); full[y0:y1, x0:x1] = sil
cv2.imwrite(S + f'/assets/keymask/km_{n}.png', full * 255)
vis = f.copy(); ov = vis.copy(); ov[full > 0] = (0, 255, 0)
vis = cv2.addWeighted(vis, 0.55, ov, 0.45, 0)
for sx, sy in seeds: cv2.circle(vis, (sx, sy), 4, (0, 0, 255), -1)
cv2.rectangle(vis, (x0, y0), (x1, y1), (255, 255, 0), 1)
ys, xs = np.where(full > 0)
print(n, 'area', int(full.sum()), 'bbox', xs.min(), ys.min(), xs.max(), ys.max())
cv2.imwrite(S + f'/assets/keymask/vis_{n}.jpg', cv2.resize(vis[max(0, ys.min() - 60):min(720, ys.max() + 30), max(0, xs.min() - 80):min(1280, xs.max() + 60)], None, fx=1.0, fy=1.0))
