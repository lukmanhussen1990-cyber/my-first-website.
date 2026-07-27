import cv2, numpy as np, os, glob, json
S = os.environ.get("WORKDIR", os.path.abspath("./work"))
files = sorted(glob.glob(os.path.join(S, "allframes", "*.png")))
imgs = [cv2.imread(f) for f in files]
N = len(imgs)
gray = [cv2.cvtColor(i, cv2.COLOR_BGR2GRAY).astype(np.float32) for i in imgs]

# rows of the label text restricted to its x-range
g = gray[61]
sub = g[425:470, 473:562]
th = (sub > sub.mean() + 1.0 * sub.std()).astype(np.float32)
rs = th.sum(axis=1)
rows = [425 + i for i, v in enumerate(rs) if v > 0]
print("label rows:", rows[0], rows[-1])

# Template: label text with a little padding
TX0, TX1 = 471, 563
TY0, TY1 = rows[0] - 4, rows[-1] + 5
tmpl = gray[61][TY0:TY1, TX0:TX1].copy()
print("template", tmpl.shape)
cv2.imwrite(os.path.join(S, "tmpl.png"), tmpl.astype(np.uint8))

# normalize template for robustness to brightness changes
def norm(a):
    a = a - a.mean()
    s = a.std()
    return a / (s + 1e-6)

scales = np.arange(0.55, 2.85, 0.025)
track = {}
for i in range(N):
    best = (-2, None)
    G = gray[i]
    for sc in scales:
        tw, th_ = int(round(tmpl.shape[1] * sc)), int(round(tmpl.shape[0] * sc))
        if tw < 8 or th_ < 5 or tw > 700 or th_ > 700:
            continue
        T = cv2.resize(tmpl, (tw, th_), interpolation=cv2.INTER_AREA if sc < 1 else cv2.INTER_CUBIC)
        res = cv2.matchTemplate(G, T, cv2.TM_CCOEFF_NORMED)
        mn, mx, mnl, mxl = cv2.minMaxLoc(res)
        if mx > best[0]:
            best = (mx, (mxl[0], mxl[1], sc, tw, th_))
    track[i] = {"score": float(best[0]), "x": best[1][0], "y": best[1][1],
                "scale": float(best[1][2]), "w": best[1][3], "h": best[1][4]}

for i in range(N):
    t = track[i]
    print(i, round(t["score"], 3), t["x"], t["y"], round(t["scale"], 3), t["w"], t["h"])

json.dump(track, open(os.path.join(S, "track_raw.json"), "w"))
