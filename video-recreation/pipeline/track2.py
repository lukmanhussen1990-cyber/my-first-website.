import cv2, numpy as np, os, glob, json
S = os.environ.get("WORKDIR", os.path.abspath("./work"))
files = sorted(glob.glob(os.path.join(S, "allframes", "*.png")))
gray = [cv2.cvtColor(cv2.imread(f), cv2.COLOR_BGR2GRAY).astype(np.float32) for f in files]
N = len(gray)

# Anchor template: box bottom-left corner + "+" icon, taken from frame 61 (scale 1.0 reference)
AX0, AX1 = 104, 190
AY0, AY1 = 418, 480
tmpl = gray[61][AY0:AY1, AX0:AX1].copy()
cv2.imwrite(os.path.join(S, "tmpl_anchor.png"), tmpl.astype(np.uint8))
print("anchor tmpl", tmpl.shape)

scales = np.arange(0.55, 2.85, 0.025)
out = {}
for i in range(N):
    best = (-2, None)
    G = gray[i]
    for sc in scales:
        tw, th_ = int(round(tmpl.shape[1] * sc)), int(round(tmpl.shape[0] * sc))
        if tw < 10 or th_ < 8 or tw >= 720 or th_ >= 720:
            continue
        T = cv2.resize(tmpl, (tw, th_), interpolation=cv2.INTER_AREA if sc < 1 else cv2.INTER_CUBIC)
        res = cv2.matchTemplate(G, T, cv2.TM_CCOEFF_NORMED)
        mn, mx, mnl, mxl = cv2.minMaxLoc(res)
        if mx > best[0]:
            best = (mx, (mxl[0], mxl[1], float(sc), tw, th_))
    out[i] = {"score": float(best[0]), "x": best[1][0], "y": best[1][1],
              "scale": best[1][2], "w": best[1][3], "h": best[1][4]}

json.dump(out, open(os.path.join(S, "track_anchor.json"), "w"))
for i in range(40, 185):
    d = out[i]
    print(i, round(d["score"], 3), d["x"], d["y"], round(d["scale"], 3))
