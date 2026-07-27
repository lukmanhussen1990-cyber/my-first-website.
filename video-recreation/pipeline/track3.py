import cv2, numpy as np, glob, os, json
S = os.environ.get("WORKDIR", os.path.abspath("./work"))
files = sorted(glob.glob(S + "/allframes/*.png"))
gray = [cv2.cvtColor(cv2.imread(f), cv2.COLOR_BGR2GRAY).astype(np.float32) for f in files]

# "sonnet" word only (fully visible even when the label is clipped by the right frame edge)
TX0, TX1, TY0, TY1 = 469, 526, 425, 450
tmpl = gray[61][TY0:TY1, TX0:TX1].copy()
cv2.imwrite(S + "/tmpl_sonnet.png", tmpl.astype(np.uint8))
print("tmpl", tmpl.shape)

scales = np.arange(0.55, 3.0, 0.025)
out = {}
for i in range(40, 70):
    best = (-2, None)
    G = gray[i]
    for sc in scales:
        tw, th = int(round(tmpl.shape[1] * sc)), int(round(tmpl.shape[0] * sc))
        if tw < 8 or th < 6 or tw >= 720 or th >= 720:
            continue
        T = cv2.resize(tmpl, (tw, th), interpolation=cv2.INTER_AREA if sc < 1 else cv2.INTER_CUBIC)
        res = cv2.matchTemplate(G, T, cv2.TM_CCOEFF_NORMED)
        _, mx, _, mxl = cv2.minMaxLoc(res)
        if mx > best[0]:
            best = (mx, (mxl[0], mxl[1], float(sc)))
    out[i] = {"score": float(best[0]), "x": best[1][0], "y": best[1][1], "scale": best[1][2]}
    print(i, round(best[0], 3), best[1][0], best[1][1], round(best[1][2], 3), flush=True)

json.dump(out, open(S + "/track_sonnet.json", "w"))
