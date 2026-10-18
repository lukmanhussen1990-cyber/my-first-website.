"""Track the house layer (similarity: scale + translation) relative to frame 200 for exterior frames."""
import cv2, numpy as np, json, sys
S = sys.argv[1]
cap = cv2.VideoCapture(S + '/src/A_original.mp4')
frames = []
for i in range(0, 345):
    ok, f = cap.read(); frames.append(f)
ref = cv2.cvtColor(frames[200], cv2.COLOR_BGR2GRAY).astype(np.float32)
# template: door + right facade edge + platform corner (ref coords)
tx0, ty0, tx1, ty1 = 280, 240, 470, 445
tmpl = ref[ty0:ty1, tx0:tx1]
trk = json.load(open(S + '/frames/track_ext.json'))
out = []
for i in range(100, 345):
    g = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY).astype(np.float32)
    best = None
    w = trk[i]['win']
    scales = np.arange(0.94, 2.6, 0.01) if i >= 200 else np.arange(0.96, 1.06, 0.005)
    if w and w[0] > 2 and w[2] > 60:
        s0 = w[2] / 100.0
        scales = np.arange(s0 - 0.04, s0 + 0.04, 0.0025)
    for s in scales:
        t = cv2.resize(tmpl, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        if t.shape[0] >= g.shape[0] - 10 or t.shape[1] >= g.shape[1]: continue
        r = cv2.matchTemplate(g[92:628], t, cv2.TM_CCOEFF_NORMED)
        _, mv, _, ml = cv2.minMaxLoc(r)
        if best is None or mv > best[0]:
            best = (mv, s, ml[0], ml[1] + 92)
    mv, s, x, y = best
    # house transform: X = ox + s*Xref ; Y = oy + s*Yref
    ox, oy = x - s * tx0, y - s * ty0
    out.append(dict(i=i, score=round(float(mv), 3), s=round(float(s), 4), ox=round(float(ox), 2), oy=round(float(oy), 2), win=w))
json.dump(out, open(S + '/frames/track_house.json', 'w'))
for r in out[::8]:
    print(r)
