import cv2, numpy as np, glob, os, json
from PIL import Image, ImageDraw, ImageFont
from fillutil import pushpull_fill

S = os.environ.get("WORKDIR", os.path.abspath("./work"))
files = sorted(glob.glob(S + "/allframes/*.png"))
OUT = S + "/out"
os.makedirs(OUT, exist_ok=True)

CAL = json.load(open(S + "/calib_label.json"))
FP = CAL["font"]
BASE_SIZE = CAL["size"]
BASE_SIGMA = CAL["sigma"]
track = json.load(open(S + "/label_track.json"))

OLD, NEW = "sonnet 4.5+", "Opus 5+"
SS = 4

def inkbox(text, size):
    f = ImageFont.truetype(FP, max(4, int(round(size * SS))))
    tmp = Image.new("L", (2400, 400), 0)
    ImageDraw.Draw(tmp).text((100, 100), text, font=f, fill=255)
    a = np.asarray(tmp); ys, xs = np.where(a > 8)
    return ((xs.min() - 100) / SS, (ys.min() - 100) / SS,
            (xs.max() - xs.min() + 1) / SS, (ys.max() - ys.min() + 1) / SS)

def render(text, size, dx, dy, w, h):
    f = ImageFont.truetype(FP, max(4, int(round(size * SS))))
    img = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(img).text((dx * SS, dy * SS), text, font=f, fill=255)
    return cv2.resize(np.asarray(img, np.float32) / 255.0, (w, h), interpolation=cv2.INTER_AREA)

def poly_bg(patch, keep):
    """Robust quadratic surface fit per channel over pixels where keep=True."""
    h, w = patch.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    xn = (xx / max(w - 1, 1)) * 2 - 1
    yn = (yy / max(h - 1, 1)) * 2 - 1
    B = np.stack([np.ones_like(xn), xn, yn, xn * xn, xn * yn, yn * yn], -1).reshape(-1, 6)
    out = np.zeros_like(patch)
    kf = keep.reshape(-1)
    for c in range(3):
        y = patch[:, :, c].reshape(-1)
        wts = kf.astype(np.float32)
        if wts.sum() < 20:
            out[:, :, c] = float(np.median(patch[:, :, c])); continue
        for _ in range(3):
            Bw = B * wts[:, None]
            coef, *_ = np.linalg.lstsq(Bw, y * wts, rcond=None)
            pred = B @ coef
            r = y - pred
            sd = np.std(r[kf]) + 1e-3
            # background must not exceed the data; reject bright (text) outliers hard
            wts = kf.astype(np.float32) * np.clip(1.0 - np.maximum(r, 0) / (2.5 * sd), 0.05, 1.0)
        out[:, :, c] = (B @ coef).reshape(h, w)
    return out

report = {}
for fi in range(len(files)):
    img = cv2.imread(files[fi])
    key = str(fi)
    if key not in track:
        cv2.imwrite(OUT + "/%04d.png" % (fi + 1), img)
        continue

    t = track[key]
    s = t["scale"]
    size = BASE_SIZE * s
    sig1 = max(0.4, BASE_SIGMA * s)
    sig2 = max(1.5, 4.0 * s)
    ox, oy = t["x"] + 1.0 * s, t["y"] + 2.0 * s

    m = 16 * s
    cx0, cy0 = max(0, int(np.floor(ox - m))), max(0, int(np.floor(oy - m)))
    cx1, cy1 = min(720, int(np.ceil(ox + 96 * s + m))), min(720, int(np.ceil(oy + 22 * s + m)))
    if cx1 - cx0 < 6 or cy1 - cy0 < 6:
        cv2.imwrite(OUT + "/%04d.png" % (fi + 1), img)
        continue

    patch = img[cy0:cy1, cx0:cx1].astype(np.float32)
    ph, pw = patch.shape[:2]
    dx0, dy0 = ox - cx0, oy - cy0

    best = None
    for ddx in (-1.0, 0.0, 1.0):
        for ddy in (-1.0, 0.0, 1.0):
            M = render(OLD, size, dx0 + ddx, dy0 + ddy, pw, ph)
            if M.max() < 0.02:
                continue
            A = cv2.GaussianBlur(M, (0, 0), sig1)
            Bl = cv2.GaussianBlur(M, (0, 0), sig2)
            unk = cv2.GaussianBlur(M, (0, 0), sig2 * 1.3) > 0.004
            bg = pushpull_fill(patch, unk)
            X = np.stack([A.ravel(), Bl.ravel()], 1)
            err = 0.0; prm = []
            for c in range(3):
                y = (patch[:, :, c] - bg[:, :, c]).ravel()
                wt = np.ones(len(y))
                for _ in range(2):
                    ab, *_ = np.linalg.lstsq(X * wt[:, None], y * wt, rcond=None)
                    wt = np.where(bg[:, :, c].ravel() + X @ ab > 251, 0.15, 1.0)
                pr = np.clip(bg[:, :, c].ravel() + X @ ab, 0, 255)
                err += float(((patch[:, :, c].ravel() - pr) ** 2).sum())
                prm.append(ab)
            rmse = (err / (pw * ph * 3)) ** 0.5
            if best is None or rmse < best[0]:
                best = (rmse, ddx, ddy, prm, A, Bl, bg)

    if best is None:
        cv2.imwrite(OUT + "/%04d.png" % (fi + 1), img)
        continue
    rmse, ddx, ddy, prm, A_old, B_old, bg = best

    ix_o, iy_o, iw_o, ih_o = inkbox(OLD, size)
    ix_n, iy_n, iw_n, ih_n = inkbox(NEW, size)
    ndx = dx0 + ddx + (ix_o + iw_o) - (ix_n + iw_n)
    Mn = render(NEW, size, ndx, dy0 + ddy, pw, ph)
    An = cv2.GaussianBlur(Mn, (0, 0), sig1)
    Bn = cv2.GaussianBlur(Mn, (0, 0), sig2)

    # bg equals the original outside the removed-text mask, so there is no seam
    outp = bg.copy()
    for c in range(3):
        outp[:, :, c] = bg[:, :, c] + prm[c][0] * An + prm[c][1] * Bn

    res = img.copy()
    res[cy0:cy1, cx0:cx1] = np.clip(outp, 0, 255).astype(np.uint8)
    cv2.imwrite(OUT + "/%04d.png" % (fi + 1), res)
    report[fi] = {"rmse": rmse, "scale": s, "a": float(prm[0][0]), "b": float(prm[0][1])}
    print(fi, "rmse=%.1f s=%.3f a=%.0f b=%.0f" % (rmse, s, prm[0][0], prm[0][1]), flush=True)

json.dump(report, open(S + "/label_fit.json", "w"), indent=1)
print("done")
