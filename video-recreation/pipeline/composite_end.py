import cv2, numpy as np, glob, os, json
from PIL import Image, ImageDraw, ImageFont
from fillutil import pushpull_fill

S = os.environ.get("WORKDIR", os.path.abspath("./work"))
files = sorted(glob.glob(S + "/allframes/*.png"))
OUT = S + "/out"
CAL = json.load(open(S + "/calib_end.json"))
FP, BASE_SIZE, S1, S2 = CAL["font"], CAL["size"], CAL["s1"], CAL["s2"]
SS = 3

OLD_WORD, NEW_WORD = "Aevnt_fx", "Imran"
shift = lambda t, k: "".join(chr(ord(c) + k) for c in t)

SCHED = {}
for f in (221, 222): SCHED[f] = 4
for f in range(223, 227): SCHED[f] = 3
for f in range(227, 231): SCHED[f] = 2
for f in range(231, 234): SCHED[f] = 1
for f in range(234, 254): SCHED[f] = 0

X0, Y0, X1, Y1 = 200, 300, 530, 420

_ink = {}
def inkbox(text, size):
    key = (text, round(size, 2))
    if key in _ink:
        return _ink[key]
    f = ImageFont.truetype(FP, max(4, int(round(size * SS))))
    tmp = Image.new("L", (3000, 500), 0)
    ImageDraw.Draw(tmp).text((120, 120), text, font=f, fill=255)
    a = np.asarray(tmp); ys, xs = np.where(a > 8)
    _ink[key] = ((xs.min() - 120) / SS, (ys.min() - 120) / SS,
                 (xs.max() - xs.min() + 1) / SS, (ys.max() - ys.min() + 1) / SS)
    return _ink[key]

def render_centred(text, size, cx, cy, w, h):
    ix, iy, iw, ih = inkbox(text, size)
    dx, dy = cx - iw / 2.0 - ix, cy - ih / 2.0 - iy
    f = ImageFont.truetype(FP, max(4, int(round(size * SS))))
    img = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(img).text((dx * SS, dy * SS), text, font=f, fill=255)
    return cv2.resize(np.asarray(img, np.float32) / 255.0, (w, h), interpolation=cv2.INTER_AREA)

report = {}
for fi in sorted(SCHED):
    img = cv2.imread(files[fi])                     # read from the ORIGINAL frames
    patch = img[Y0:Y1, X0:X1].astype(np.float32)
    ph, pw = patch.shape[:2]
    k = SCHED[fi]
    cur_old, prv_old = shift(OLD_WORD, k), shift(OLD_WORD, k + 1)

    # background: one push-pull fill per frame, over everything brighter than the
    # local background (catches the text plus its crossfade ghost)
    g = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
    unk = (g - cv2.GaussianBlur(g, (0, 0), 25)) > 2.5
    unk = cv2.dilate(unk.astype(np.uint8), np.ones((13, 13), np.uint8)).astype(bool)
    bg = pushpull_fill(patch, unk)
    resid = patch - bg

    best = None
    for sc in np.arange(0.86, 1.30, 0.02):
        size = BASE_SIZE * sc
        for cx in np.arange(158, 172, 2.0):
            for cy in np.arange(54, 66, 2.0):
                Mc = render_centred(cur_old, size, cx, cy, pw, ph)
                Mp = render_centred(prv_old, size, cx, cy, pw, ph)
                if Mc.max() < 0.05:
                    continue
                cols = [cv2.GaussianBlur(Mc, (0, 0), S1 * sc), cv2.GaussianBlur(Mc, (0, 0), S2 * sc),
                        cv2.GaussianBlur(Mp, (0, 0), S1 * sc), cv2.GaussianBlur(Mp, (0, 0), S2 * sc)]
                X = np.stack([c.ravel() for c in cols], 1)
                err = 0.0; prm = []
                for c in range(3):
                    y = resid[:, :, c].ravel()
                    wt = np.ones(len(y))
                    for _ in range(2):
                        ab, *_ = np.linalg.lstsq(X * wt[:, None], y * wt, rcond=None)
                        wt = np.where(bg[:, :, c].ravel() + X @ ab > 251, 0.15, 1.0)
                    pr = np.clip(bg[:, :, c].ravel() + X @ ab, 0, 255)
                    err += float(((patch[:, :, c].ravel() - pr) ** 2).sum())
                    prm.append(ab)
                rmse = (err / (pw * ph * 3)) ** 0.5
                if best is None or rmse < best[0]:
                    best = (rmse, float(sc), float(cx), float(cy), prm)

    rmse, sc, cx, cy, prm = best
    size = BASE_SIZE * sc
    Nc = render_centred(shift(NEW_WORD, k), size, cx, cy, pw, ph)
    Np = render_centred(shift(NEW_WORD, k + 1), size, cx, cy, pw, ph)
    ncols = [cv2.GaussianBlur(Nc, (0, 0), S1 * sc), cv2.GaussianBlur(Nc, (0, 0), S2 * sc),
             cv2.GaussianBlur(Np, (0, 0), S1 * sc), cv2.GaussianBlur(Np, (0, 0), S2 * sc)]
    outp = bg.copy()
    for c in range(3):
        outp[:, :, c] = bg[:, :, c] + sum(prm[c][j] * ncols[j] for j in range(4))

    res = img.copy()
    res[Y0:Y1, X0:X1] = np.clip(outp, 0, 255).astype(np.uint8)
    cv2.imwrite(OUT + "/%04d.png" % (fi + 1), res)
    report[fi] = {"rmse": rmse, "scale": sc, "cx": cx + X0, "cy": cy + Y0, "k": k,
                  "a": float(prm[0][0]), "b": float(prm[0][1])}
    print(fi, "k=%d sc=%.2f c=(%.0f,%.0f) rmse=%.1f a=%.0f b=%.0f ap=%.0f" %
          (k, sc, cx + X0, cy + Y0, rmse, prm[0][0], prm[0][1], prm[0][2]), flush=True)

json.dump(report, open(S + "/end_fit.json", "w"), indent=1)
print("done")
