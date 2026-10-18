"""Per-frame segmentation of the original Chor from his bright closed outline.
usage: seg_outline.py S n_start n_end step seedbox(x0,y0,x1,y1) out_prefix [blue|any]"""
import cv2, numpy as np, sys, json
S = sys.argv[1]; n0, n1, d = int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
box = list(map(int, sys.argv[5].split(','))); outp = sys.argv[6]
floor_y = int(sys.argv[7]) if len(sys.argv) > 7 else None
last_bb = None
cap = cv2.VideoCapture(S + '/src/A_original.mp4')
res = {}
prev = None
for n in range(n0, n1 + d, d):
    cap.set(cv2.CAP_PROP_POS_FRAMES, n); f = cap.read()[1]
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0), max(92, y0); x1, y1 = min(1280, x1), min(628, y1)
    roi = f[y0:y1, x0:x1].astype(np.int32)
    b, g, r = roi[..., 0], roi[..., 1], roi[..., 2]
    L = (b + g + r) / 3
    base_outline = ((b > 105) & (b >= r - 5) & (L > 80)).astype(np.uint8)
    # seal the cone's base (it has no own bottom stroke, only the boat's gunwale line): find that row
    fy = floor_y
    if last_bb is not None:
        xa, xb = max(0, last_bb[0] + 4 - x0), min(x1 - x0, last_bb[2] - 4 - x0)
        rows = list(range(max(0, last_bb[3] - 16 - y0), min(y1 - y0, last_bb[3] + 12 - y0)))
        if rows and xb > xa:
            cnt = [base_outline[yy, xa:xb].sum() for yy in rows]
            fy = rows[int(np.argmax(cnt))] + y0
    if fy is not None and y0 <= fy < y1:
        xa = (last_bb[0] - 12 - x0) if last_bb is not None else 0
        xb = (last_bb[2] + 12 - x0) if last_bb is not None else (x1 - x0)
        cv2.line(base_outline, (max(0, xa), fy - y0), (min(x1 - x0 - 1, xb), fy - y0), 1, 2)
    if x1 >= 1280:
        base_outline[:, -2:] = 1
    blue = ((b > 38) & (b > r + 12))
    prev_area = res[max(res.keys(), key=lambda q: -abs(q - n))]['area'] if res else None
    best = None
    for ksz in (3, 5, 7, 9):
        outline = cv2.morphologyEx(base_outline, cv2.MORPH_CLOSE, np.ones((ksz, ksz), np.uint8))
        pad = cv2.copyMakeBorder(outline, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
        m = np.zeros((pad.shape[0] + 2, pad.shape[1] + 2), np.uint8)
        cv2.floodFill(pad, m, (0, 0), 2)
        inside = (pad[1:-1, 1:-1] == 0).astype(np.uint8)
        n_c, lab, st, cen = cv2.connectedComponentsWithStats(inside, 4)
        cand, bscore = None, 0
        for k in range(1, n_c):
            x, y, w, h, area = st[k]
            if area < 150 or h < 20: continue
            comp = lab == k
            fb = blue[comp].mean()
            if fb < 0.5: continue
            ov = 1.0
            if prev is not None:
                ov = (comp & (prev[y0:y1, x0:x1] > 0)).sum() / max(1, comp.sum())
            sc = area * (0.15 + ov) * fb
            if sc > bscore:
                cand, bscore = k, sc
        if cand is None: continue
        area = st[cand][4] + (ksz - 1) * 30
        if prev_area is None or 0.55 * prev_area < area * 1.0 + 400 and area < 1.6 * prev_area + 400:
            best = cand
            break
    full = np.zeros((720, 1280), np.uint8)
    if best is None:
        print(n, 'LOST'); break
    comp = (lab == best).astype(np.uint8)
    # fill star specks inside and include the outline stroke
    hh, ww = comp.shape
    c2 = cv2.copyMakeBorder(comp, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0); m = np.zeros((hh + 4, ww + 4), np.uint8)
    cv2.floodFill(c2, m, (0, 0), 2); comp = (c2[1:-1, 1:-1] != 2).astype(np.uint8)
    comp = cv2.dilate(comp, np.ones((5, 5), np.uint8))
    full[y0:y1, x0:x1] = comp
    ys, xs = np.where(full > 0)
    bb = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
    res[n] = dict(bbox=bb, area=int(full.sum()))
    last_bb = bb
    cv2.imwrite(f'{outp}_{n:04d}.png', full * 255)
    prev = cv2.dilate(full, np.ones((15, 15), np.uint8))
    pd = 40
    box = [bb[0] - pd, bb[1] - pd, bb[2] + pd, bb[3] + pd]
json.dump({str(k): v for k, v in res.items()}, open(outp + '.json', 'w'))
ks = sorted(res)
for k in (ks[::10] + [ks[-1]] if ks else []):
    print(k, res[k])
