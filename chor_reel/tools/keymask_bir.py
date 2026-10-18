import cv2, numpy as np, sys
S = sys.argv[1]
cfg = {930: ((900, 250, 1280, 628), [(1120, 520), (1010, 448)]),
       1110: ((1000, 230, 1280, 628), [(1130, 338), (1240, 480)]),
       1170: ((1050, 280, 1280, 628), [(1190, 439)]),
       1330: ((780, 150, 1180, 628), [(880, 356), (1000, 400)])}
tiles = []
for n, ((x0, y0, x1, y1), seeds) in cfg.items():
    a = cv2.imread(S + f'/assets/keymask/bir/a_{n}.png', 0)
    f = cv2.imread(S + f'/assets/keymask/bir/f_{n}.png')
    wall = cv2.dilate((a > 90).astype(np.uint8), np.ones((3, 3), np.uint8))
    free = (1 - wall).astype(np.uint8)
    reg = np.zeros_like(free)
    for sx, sy in seeds:
        ff = free.copy(); m = np.zeros((free.shape[0] + 2, free.shape[1] + 2), np.uint8)
        cv2.floodFill(ff, m, (sx - x0, sy - y0), 2)
        reg |= (ff == 2).astype(np.uint8)
    sil = cv2.dilate(reg, np.ones((7, 7), np.uint8)) | ((a > 90) & (cv2.dilate(reg, np.ones((9, 9), np.uint8)) > 0)).astype(np.uint8)
    sil = cv2.morphologyEx(sil, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    full = np.zeros((720, 1280), np.uint8); full[y0:y1, x0:x1] = sil
    cv2.imwrite(S + f'/assets/keymask/km_{n}.png', full * 255)
    crop = f[y0:y1, x0:x1].copy(); ov = crop.copy(); ov[sil > 0] = (0, 255, 0)
    vis = cv2.addWeighted(crop, 0.55, ov, 0.45, 0)
    tiles.append(cv2.resize(vis, (300, int(300 * vis.shape[0] / vis.shape[1]))))
    ys, xs = np.where(full > 0); print(n, 'bbox', xs.min(), ys.min(), xs.max(), ys.max(), 'area', int(full.sum()))
h = max(t.shape[0] for t in tiles)
tiles = [cv2.copyMakeBorder(t, 0, h - t.shape[0], 3, 3, cv2.BORDER_CONSTANT, value=(50, 50, 50)) for t in tiles]
cv2.imwrite(S + '/frames/km_bir2.jpg', np.hstack(tiles))
