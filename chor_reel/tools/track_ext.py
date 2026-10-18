import cv2, numpy as np, json, sys
S = sys.argv[1]
cap = cv2.VideoCapture(S + '/src/A_original.mp4')
res = []
for i in range(0, 345):
    ok, f = cap.read()
    if not ok: break
    b, g, r = [f[..., k].astype(np.int32) for k in range(3)]
    amber = ((r > 170) & (g > 110) & (b < 140) & (r > b + 60)).astype(np.uint8)
    amber[:, 700:] = 0
    n, lab, st, cen = cv2.connectedComponentsWithStats(amber, 8)
    win = None
    if n > 1:
        k = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
        if st[k, cv2.CC_STAT_AREA] > 150:
            x, y, w, h, a = st[k]
            win = [int(x), int(y), int(w), int(h), int(a)]
    white = ((r > 235) & (g > 235) & (b > 235)).astype(np.uint8)
    n2, lab2, st2, cen2 = cv2.connectedComponentsWithStats(white, 8)
    moon = None
    if n2 > 1:
        k = 1 + np.argmax(st2[1:, cv2.CC_STAT_AREA])
        if st2[k, cv2.CC_STAT_AREA] > 300:
            moon = [round(float(cen2[k][0]), 1), round(float(cen2[k][1]), 1), int(st2[k, cv2.CC_STAT_WIDTH])]
    res.append(dict(i=i, win=win, moon=moon))
json.dump(res, open(S + '/frames/track_ext.json', 'w'))
for r in res[::10]:
    print(r)
