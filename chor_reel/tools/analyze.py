import cv2, numpy as np, sys, json
path = sys.argv[1]; out = sys.argv[2]
cap = cv2.VideoCapture(path)
fps = cap.get(cv2.CAP_PROP_FPS)
prev = None; rows = []
i = 0
while True:
    ok, f = cap.read()
    if not ok: break
    act = f[92:628]  # active letterbox area
    small = cv2.resize(act, (160, 67), interpolation=cv2.INTER_AREA).astype(np.float32)
    b, g, r = [float(small[..., k].mean()) for k in range(3)]
    full_mean = f.mean()
    top_bar = f[0:92].mean()
    d = float(np.abs(small - prev).mean()) if prev is not None else 0.0
    rows.append(dict(i=i, t=round(i / fps, 3), diff=round(d, 2), b=round(b, 1), g=round(g, 1), r=round(r, 1), bar=round(float(top_bar), 1)))
    prev = small; i += 1
json.dump(rows, open(out, 'w'))
print('frames', i, 'fps', fps)
