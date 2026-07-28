"""Global camera (scale, tx, ty) per frame, in reference-frame-0144 scene space.

Several small templates are matched independently each frame. Each one implies
the same global transform, so we take the highest-scoring consistent group
rather than trusting any single patch -- that keeps "Elon" from being confused
with "morning" when it drifts off the edge of the screen.
"""
import cv2, numpy as np, json, glob, sys
from match import hp, ncc_floored

files = sorted(glob.glob('all/*.png'))
REF = 144
refh = hp(cv2.imread(files[REF - 1], cv2.IMREAD_GRAYSCALE))

TEMPLATES = {
    'morning': (95, 173, 345, 250),
    'elon':    (351, 173, 500, 247),
    'chip':    (238, 426, 575, 474),
    'send':    (650, 405, 742, 492),
}
LO, HI = 58, 178

def pad(img, p):
    return cv2.copyMakeBorder(img, p, p, p, p, cv2.BORDER_CONSTANT, value=0)

def best_at(img_hp, tpl, scales, half, p):
    out = []
    for s in scales:
        h, w = tpl.shape
        nw, nh = int(round(w * s * half)), int(round(h * s * half))
        if nw < 18 or nh < 8:
            continue
        t = cv2.resize(tpl, (nw, nh),
                       interpolation=cv2.INTER_AREA if s * half < 1 else cv2.INTER_CUBIC)
        r = ncc_floored(img_hp, t)
        if r is None:
            continue
        _, mx, _, ml = cv2.minMaxLoc(r)
        out.append((float(mx), (ml[0] - p) / half, (ml[1] - p) / half, float(s)))
    return max(out, key=lambda a: a[0]) if out else None

results = {}
for i in range(LO, HI):
    g = cv2.imread(files[i - 1], cv2.IMREAD_GRAYSCALE)
    sm = cv2.resize(g, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
    smh, fuh = hp(sm, 1.5), hp(g)
    cands = []
    for name, box in TEMPLATES.items():
        ox, oy, x1, y1 = box
        tpl = refh[oy:y1, ox:x1]
        ph = int(max(tpl.shape) * 0.6)
        b = best_at(pad(smh, ph // 2), tpl, np.arange(0.30, 1.45, 0.02), 0.5, ph // 2)
        if b is None:
            continue
        b = best_at(pad(fuh, ph), tpl,
                    np.arange(max(0.2, b[3] - 0.03), b[3] + 0.031, 0.005), 1.0, ph)
        if b is None:
            continue
        sc, fx, fy, s = b
        cands.append(dict(t=name, score=sc, s=s, tx=fx - ox * s, ty=fy - oy * s))
    # consensus: score each candidate by its own score plus agreement from others
    best = None
    for c in cands:
        tot = 0.0
        for d in cands:
            if (abs(d['s'] - c['s']) < 0.05 and abs(d['tx'] - c['tx']) < 25
                    and abs(d['ty'] - c['ty']) < 25):
                tot += d['score']
        if best is None or tot > best[0]:
            best = (tot, c)
    results[i] = dict(cands=cands, pick=best[1] if best else None,
                      consensus=best[0] if best else 0.0)
    if best:
        c = best[1]
        sys.stderr.write(f"{i} pick={c['t']:8s} sc={c['score']:.2f} cons={best[0]:.2f} "
                         f"s={c['s']:.3f} tx={c['tx']:7.1f} ty={c['ty']:7.1f}\n")
    sys.stderr.flush()

json.dump(results, open('global.json', 'w'))
sys.stderr.write("DONE\n")
