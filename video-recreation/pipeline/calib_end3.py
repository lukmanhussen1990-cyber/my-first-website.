import cv2, numpy as np, glob, os, json
from PIL import Image, ImageDraw, ImageFont

S = os.environ.get("WORKDIR", os.path.abspath("./work"))
files = sorted(glob.glob(S + "/allframes/*.png"))
FDIR = S + "/fonts/inter/extras/ttf"
FONTS = [FDIR + "/Inter-Regular.ttf", FDIR + "/Inter-Medium.ttf", FDIR + "/Inter-SemiBold.ttf",
         FDIR + "/InterDisplay-Regular.ttf", FDIR + "/InterDisplay-Medium.ttf",
         "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
         "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
SS = 3

def ink(text, fp, size):
    """Render tightly and return (mask, ink bbox w, h, origin offset)."""
    f = ImageFont.truetype(fp, int(round(size * SS)))
    tmp = Image.new("L", (1400, 300), 0)
    ImageDraw.Draw(tmp).text((60, 60), text, font=f, fill=255)
    a = np.asarray(tmp)
    ys, xs = np.where(a > 8)
    return (xs.min() - 60) / SS, (ys.min() - 60) / SS, (xs.max() - xs.min() + 1) / SS, (ys.max() - ys.min() + 1) / SS

def render(text, fp, size, w, h, dx, dy):
    f = ImageFont.truetype(fp, int(round(size * SS)))
    img = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(img).text((dx * SS, dy * SS), text, font=f, fill=255)
    return cv2.resize(np.asarray(img, np.float32) / 255.0, (w, h), interpolation=cv2.INTER_AREA)

def est_bg(p):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))
    bg = np.zeros_like(p)
    for c in range(3):
        bg[:, :, c] = cv2.GaussianBlur(cv2.morphologyEx(p[:, :, c], cv2.MORPH_OPEN, k), (0, 0), 9.0)
    return bg

TEXT = "Aevnt_fx"
RX0, RY0, RX1, RY1 = 250, 320, 490, 400
img = cv2.imread(files[240]).astype(np.float32)
patch = img[RY0:RY1, RX0:RX1].copy()
ph, pw = patch.shape[:2]
bg = est_bg(patch)

# observed ink bbox (tight, high threshold to avoid glow)
gg = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
core = gg > (gg.max() * 0.72)
ys, xs = np.where(core)
ow, oh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
ox, oy = xs.min(), ys.min()
print("observed ink bbox w,h =", ow, oh, "at", ox, oy)

best = None
for fp in FONTS:
    if not os.path.exists(fp):
        continue
    # pick size so rendered ink width matches observed
    lo, hi = 10.0, 80.0
    for _ in range(40):
        mid = (lo + hi) / 2
        _, _, iw, _ = ink(TEXT, fp, mid)
        if iw < ow: lo = mid
        else: hi = mid
    base = (lo + hi) / 2
    for size in [base - 1.5, base - 0.75, base, base + 0.75, base + 1.5]:
        ix, iy, iw, ih = ink(TEXT, fp, size)
        for s1 in [0.6, 0.9, 1.2, 1.6]:
            for s2 in [3.0, 5.0, 8.0]:
                for ddx in np.arange(-3, 3.5, 1.0):
                    for ddy in np.arange(-3, 3.5, 1.0):
                        dx, dy = ox - ix + ddx, oy - iy + ddy
                        M = render(TEXT, fp, size, pw, ph, dx, dy)
                        A = cv2.GaussianBlur(M, (0, 0), s1)
                        B = cv2.GaussianBlur(M, (0, 0), s2)
                        # fit a,b per channel with saturation, 3 IRLS-ish passes
                        err = 0.0; params = []
                        for c in range(3):
                            y = patch[:, :, c] - bg[:, :, c]
                            X = np.stack([A.ravel(), B.ravel()], 1)
                            wgt = np.ones(len(y.ravel()))
                            ab = np.array([200.0, 30.0])
                            for _ in range(3):
                                Xw = X * wgt[:, None]
                                ab, *_ = np.linalg.lstsq(Xw, y.ravel() * wgt, rcond=None)
                                pred = bg[:, :, c].ravel() + X @ ab
                                wgt = np.where(pred > 252, 0.15, 1.0)
                            pred = np.clip(bg[:, :, c].ravel() + X @ ab, 0, 255)
                            err += float(((patch[:, :, c].ravel() - pred) ** 2).sum())
                            params.append(ab.tolist())
                        rmse = (err / (pw * ph * 3)) ** 0.5
                        if best is None or rmse < best[0]:
                            best = (rmse, fp, float(size), float(s1), float(s2),
                                    float(dx), float(dy), params)

rmse, fp, size, s1, s2, dx, dy, params = best
print("BEST rmse=%.2f font=%s size=%.2f s1=%.2f s2=%.2f dx=%.1f dy=%.1f" % (rmse, os.path.basename(fp), size, s1, s2, dx, dy))
print("params", params)
json.dump({"rmse": rmse, "font": fp, "size": size, "s1": s1, "s2": s2, "dx": dx, "dy": dy,
           "params": params, "region": [RX0, RY0, RX1, RY1]}, open(S + "/calib_end.json", "w"), indent=1)

M = render(TEXT, fp, size, pw, ph, dx, dy)
A = cv2.GaussianBlur(M, (0, 0), s1); B = cv2.GaussianBlur(M, (0, 0), s2)
synth = bg.copy()
for c in range(3):
    synth[:, :, c] = np.clip(bg[:, :, c] + params[c][0] * A + params[c][1] * B, 0, 255)
cv2.imwrite(S + "/calib_end_cmp.png",
            np.clip(np.hstack([patch, synth, np.abs(patch - synth) * 2]), 0, 255).astype(np.uint8))
