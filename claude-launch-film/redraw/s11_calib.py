"""Fit Inter size/weight/position of the original S11 strings in the canonical frame (1110)."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from textr import render
O = cv2.cvtColor(cv2.imread(f'{S}/png/f1110.png'), cv2.COLOR_BGR2GRAY).astype(np.float32)
U = 4
EL = {  # name: (text, region x0,y0,x1,y1, weights, sizes)
 'crumb': ('Home > Doctors > Dr Abhishek Shukla', (700, 280, 1000, 306), (400, 500), np.arange(12.0, 16.01, 0.25)),
 'name': ('Dr Abhishek Shukla', (890, 452, 1032, 480), (600, 700), np.arange(12.5, 15.51, 0.25)),
 'mail': ('abhishekshukla4@gmail.com', (918, 556, 1106, 582), (400, 500), np.arange(10.5, 13.51, 0.25)),
 'about': ('Dr Abhishek Shukla is a leading', (700, 672, 920, 694), (400, 500), np.arange(9.0, 12.01, 0.25)),
}
res = {}
for k, (txt, (x0, y0, x1, y1), ws, ss) in EL.items():
    crop = O[y0 - 4:y1 + 4, x0 - 4:x1 + 4]
    cu = cv2.resize(crop, None, fx=U, fy=U, interpolation=cv2.INTER_CUBIC)
    items = [dict(text=txt, weight=w, size=float(s), W=x1 - x0 + 40, H=y1 - y0 + 10, x=3, base=(y1 - y0) * 0.75) for w in ws for s in ss]
    rs = render(items, U)
    best = None
    for it, (a, adv) in zip(items, rs):
        for sg in (0.5, 0.8, 1.1):
            ys, xs = np.nonzero(a > 0.02); m0 = 2 * U
            ty0, tx0 = max(0, ys.min() - m0), max(0, xs.min() - m0)
            t = cv2.GaussianBlur(a, (0, 0), sg * U)[ty0:ys.max() + m0, tx0:xs.max() + m0]
            if t.shape[0] > cu.shape[0] or t.shape[1] > cu.shape[1]: continue
            m = cv2.matchTemplate(cu, -t, cv2.TM_CCOEFF_NORMED)
            _, v, _, loc = cv2.minMaxLoc(m)
            if best is None or v > best[0]:
                # canonical position of the text origin
                ox = x0 - 4 + (loc[0] - tx0 + 3 * U) / U; ob = y0 - 4 + (loc[1] - ty0 + it['base'] * U) / U
                best = (v, it['weight'], it['size'], sg, round(ox, 2), round(ob, 2), adv)
    res[k] = best; print(k, best, flush=True)
json.dump(res, open(f'{S}/rd/data/s11_calib.json', 'w'))
