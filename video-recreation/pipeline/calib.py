import cv2, numpy as np, glob, os, itertools, json
from PIL import Image, ImageDraw, ImageFont

S = os.environ.get("WORKDIR", os.path.abspath("./work"))
files = sorted(glob.glob(S + "/allframes/*.png"))
FDIR = S + "/fonts/inter/extras/ttf"
CAND_FONTS = [
    FDIR + "/Inter-Regular.ttf",
    FDIR + "/Inter-Medium.ttf",
    FDIR + "/Inter-Light.ttf",
    FDIR + "/InterDisplay-Regular.ttf",
    FDIR + "/InterDisplay-Medium.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
SS = 4  # supersample

def render_mask(text, font_path, size_px, out_w, out_h, dx, dy):
    """Render text left-baseline-ish at (dx,dy) into out_w x out_h coverage mask [0..1]."""
    f = ImageFont.truetype(font_path, int(round(size_px * SS)))
    img = Image.new("L", (out_w * SS, out_h * SS), 0)
    d = ImageDraw.Draw(img)
    d.text((dx * SS, dy * SS), text, font=f, fill=255)
    m = np.asarray(img, dtype=np.float32) / 255.0
    m = cv2.resize(m, (out_w, out_h), interpolation=cv2.INTER_AREA)
    return m

def est_bg(patch_bgr):
    """Estimate the background under bright text via grayscale morphological opening."""
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    bg = np.zeros_like(patch_bgr)
    for c in range(3):
        op = cv2.morphologyEx(patch_bgr[:, :, c], cv2.MORPH_OPEN, k)
        bg[:, :, c] = cv2.GaussianBlur(op, (0, 0), 3.0)
    return bg

TEXT = "sonnet 4.5+"
# reference frame 61 label box from tracking
X0, Y0, W, H = 471, 427, 92, 22
PAD = 8
img = cv2.imread(files[61]).astype(np.float32)
patch = img[Y0 - PAD:Y0 + H + PAD, X0 - PAD:X0 + W + PAD].copy()
ph, pw = patch.shape[:2]
bg = est_bg(patch)
resid = patch - bg

best = None
for fp in CAND_FONTS:
    if not os.path.exists(fp):
        continue
    for size in np.arange(10.0, 18.5, 0.5):
        for sigma in [0.5, 0.7, 0.9, 1.1, 1.3, 1.6]:
            for dx in np.arange(2, 14, 1.0):
                for dy in np.arange(2, 16, 1.0):
                    m = render_mask(TEXT, fp, size, pw, ph, dx, dy)
                    mb = cv2.GaussianBlur(m, (0, 0), sigma)
                    denom = float((mb * mb).sum())
                    if denom < 1e-3:
                        continue
                    err = 0.0
                    gains = []
                    for c in range(3):
                        g = float((mb * resid[:, :, c]).sum() / denom)
                        gains.append(g)
                        err += float(((resid[:, :, c] - g * mb) ** 2).sum())
                    rmse = (err / (pw * ph * 3)) ** 0.5
                    if best is None or rmse < best[0]:
                        best = (rmse, fp, float(size), float(sigma), float(dx), float(dy), gains)

print("BEST", best)
json.dump({"rmse": best[0], "font": best[1], "size": best[2], "sigma": best[3],
           "dx": best[4], "dy": best[5], "gains": best[6]},
          open(S + "/calib_label.json", "w"), indent=1)

# visual check
rmse, fp, size, sigma, dx, dy, gains = best
m = cv2.GaussianBlur(render_mask(TEXT, fp, size, pw, ph, dx, dy), (0, 0), sigma)
synth = bg.copy()
for c in range(3):
    synth[:, :, c] += gains[c] * m
cmp_img = np.hstack([patch, synth, np.abs(patch - synth)])
cv2.imwrite(S + "/calib_cmp.png", cv2.resize(np.clip(cmp_img, 0, 255).astype(np.uint8),
                                             None, fx=5, fy=5, interpolation=cv2.INTER_NEAREST))
