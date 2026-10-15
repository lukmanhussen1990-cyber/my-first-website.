"""Cuts the logo (android/logo.png) into the layers the opening animation moves on their own.

   i_bg       the green background as a smooth fitted surface (it shows wherever the carriage slides away)
   i_carriage platen, rods, roller ends, end brackets and knobs, with the sheet taken out
   i_lever    the carriage return lever (it swings on its pivot when the carriage is returned)
   i_front    the paper bail rod and its two rubber rollers, which sit in front of the sheet
   i_body     everything fixed: front strip, type guide, segment, type bars, shell, keys and the shadow
   i_guide    the gold type guide and segment again, drawn over a type bar on its way to the paper
   i_knobs    both platen knobs at 8 turning phases (the ridges roll round the cylinder)

Usage: make_intro_layers.py OUT_DIR   (prints the layer boxes as JSON)
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'build', 'assets')
os.makedirs(out, exist_ok=True)
im = np.asarray(Image.open(os.path.join(root, 'logo.png')).convert('RGB')).astype(np.float64)
H, W, _ = im.shape
yy, xx = np.mgrid[0:H, 0:W]
r, g, b = im[..., 0], im[..., 1], im[..., 2]

# ---- background: a cubic surface fitted to clearly-background pixels
def basis(X, Y): return np.stack([np.ones_like(X), X, Y, X * X, X * Y, Y * Y, X ** 3, X * X * Y, X * Y * Y, Y ** 3], -1)
m = np.zeros((H, W), bool)
m[:110, :] = True; m[:, :60] = True; m[:, 1195:] = True; m[1110:, :] = True
m[110:300, :280] = True; m[110:300, 975:] = True
m &= (g > r + 60) & (g > b + 15)
A = basis(xx[m] / W - 0.5, yy[m] / H - 0.5)
coef = []
for c in range(3):
    v = im[..., c][m]
    co, *_ = np.linalg.lstsq(A, v, rcond=None)
    res = v - A @ co; keep = np.abs(res) < 3 * np.sqrt((res ** 2).mean())
    co, *_ = np.linalg.lstsq(A[keep], v[keep], rcond=None)
    coef.append(co)
bg = np.einsum('hwk,ck->hwc', basis(xx / W - 0.5, yy / H - 0.5), np.array(coef))
dist = np.sqrt(((im - bg) ** 2).sum(-1))
bgs = np.asarray(Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8)).resize((128, 128), Image.LANCZOS))
pa = np.zeros((384, 384, 3), np.uint8); pa[128:256, 128:256] = bgs     # padded: edges carry on for a logo's width
pa[:128, 128:256] = pa[128, 128:256]; pa[256:, 128:256] = pa[255, 128:256]
pa[:, :128] = pa[:, 128:129]; pa[:, 256:] = pa[:, 255:256]
Image.fromarray(pa).save(os.path.join(out, 'i_bg.png'))

def matte(d, lo, hi): return np.clip((d - lo) / (hi - lo), 0, 1)
def unpremul(rgb, a, under):
    a3 = np.maximum(a, 1e-3)[..., None]
    return np.clip((rgb - (1 - a3) * under) / a3, 0, 255)
geo = {}
def save(rgb, a, box, name, q=None):
    x0, y0, x1, y1 = box
    arr = np.dstack([np.clip(rgb[y0:y1, x0:x1], 0, 255), np.clip(a[y0:y1, x0:x1] * 255, 0, 255)]).astype(np.uint8)
    img = Image.fromarray(arr, 'RGBA')
    if q: img.save(os.path.join(out, name), quality=q, method=6, alpha_quality=100)
    else: img.save(os.path.join(out, name), lossless=True, method=6)
    geo[name.split('.')[0][2:]] = [x0, y0, x1 - x0, y1 - y0]

# ---- the platen with no sheet in it: each row filled between the roller ends either side of the paper
plate = im.copy()
L0, L1 = 276, 978
t = ((np.arange(L0 + 1, L1) - L0) / (L1 - L0))[:, None]
for y in range(100, 448):
    plate[y, L0 + 1:L1] = im[y, L0][None, :] * (1 - t) + im[y, L1][None, :] * t

# ---- carriage / body split: everything above this line rides on the carriage
pts = [(0, 506), (198, 506), (205, 497), (215, 486), (230, 471), (245, 466), (261, 464), (262, 445),
       (992, 445), (993, 464), (1010, 466), (1025, 472), (1036, 482), (1041, 492), (1042, 513), (1254, 513)]
px, py = zip(*pts)
cut = np.interp(np.arange(W), px, py)
car = yy < cut[None, :]
a_car = matte(np.sqrt(((plate - bg) ** 2).sum(-1)), 10, 26) * car
rgb_car = unpremul(plate, a_car, bg)

# the return lever as its own sprite (left of the knob, above it)
lever = car & (((xx < 197) & (yy < 378)) | (xx < 162))
a_lev = a_car * lever
save(rgb_car, a_lev, (50, 290, 205, 462), 'i_lever.webp')
geo['leverPivot'] = [203, 338]

# knobs: ridges roll round the cylinder (detail resampled along the cylinder angle, shading kept)
knobs = {'L': (158, 374, 218, 506), 'R': (1094, 372, 1160, 508)}
F = 8
sheet_w = sum(k[2] - k[0] for k in knobs.values()); sheet_h = max(k[3] - k[1] for k in knobs.values())
sheet = np.zeros((sheet_h * F, sheet_w, 4))
ox = 0; kgeo = {}
for key, (x0, y0, x1, y1) in knobs.items():
    rgb = rgb_car[y0:y1, x0:x1]; a = a_car[y0:y1, x0:x1]
    h, w = a.shape
    rows = np.where(a.max(1) > 0.5)[0]; ky0, ky1 = rows[0], rows[-1]
    yc, R = (ky0 + ky1) / 2, (ky1 - ky0) / 2 + 0.5
    lum = rgb.mean(-1)
    prof = lum[int(yc - R * 0.6):int(yc + R * 0.6), w // 2 - 4:w // 2 + 4].mean(1)
    prof = prof - ndimage.uniform_filter1d(prof, 15)
    ac = [np.dot(prof[:-lag], prof[lag:]) / (len(prof) - lag) for lag in range(5, 30)]
    period = 5 + int(np.argmax(ac))
    shade = ndimage.uniform_filter(rgb, size=(period, 1, 1), mode='nearest')
    detail = rgb - shade
    N = 2 * np.pi * R / period               # ridges round the knob
    ys = np.arange(h)
    th = np.arcsin(np.clip((ys - yc) / R, -1, 1))
    for f in range(F):
        dth = 2 * np.pi / N * f / F
        src = yc + R * np.sin(np.clip(th - dth, -np.pi / 2, np.pi / 2))
        det = np.stack([np.stack([np.interp(src, ys, detail[:, xi, c]) for xi in range(w)], 1) for c in range(3)], -1)
        fr = np.clip(shade + det, 0, 255)
        sheet[f * sheet_h:f * sheet_h + h, ox:ox + w, :3] = fr
        sheet[f * sheet_h:f * sheet_h + h, ox:ox + w, 3] = a * 255
    kgeo[key] = [x0, y0, w, h, ox, round(float(N), 2)]
    ox += w
Image.fromarray(sheet.astype(np.uint8), 'RGBA').save(os.path.join(out, 'i_knobs.webp'), lossless=True, method=6)
geo['knobs'] = kgeo; geo['knobFrames'] = F; geo['knobSheetH'] = sheet_h

a_car2 = np.where(lever, 0, a_car)
save(rgb_car, a_car2, (150, 100, 1170, 520), 'i_carriage.webp', q=90)

# ---- front: bail rod + rollers. Paper (and its shading) is keyed out; it is redrawn under them.
cream = np.array([249, 237, 216.0])
d_cream = np.sqrt(((im - cream) ** 2).sum(-1))
paperish = (r > 120) & (r - b > 12) & (r - b < 78) & (r - g > 4) & (r - g < 32) & (g - b < 50)
a_f = np.zeros((H, W))
fy0, fy1, fx0, fx1 = 366, 428, 270, 986
a_f[fy0:fy1, fx0:fx1] = matte(d_cream[fy0:fy1, fx0:fx1], 14, 60) * ~paperish[fy0:fy1, fx0:fx1]
a_f[fy0:fy1, fx0:fx1] = np.maximum(a_f[fy0:fy1, fx0:fx1], (r[fy0:fy1, fx0:fx1] - b[fy0:fy1, fx0:fx1] > 90) * 1.0)
a_f = ndimage.median_filter(a_f, 3)
a_f[:, :283] = 0; a_f[:, 972:] = 0
rgb_f = unpremul(im, a_f, np.broadcast_to(cream, im.shape))
save(rgb_f, a_f, (fx0, fy0, fx1, fy1), 'i_front.webp', q=92)

# ---- body: below the split. Solid inside the machine's silhouette, keyed at its outline (keeps its shadow)
sil = ndimage.binary_closing(dist > 22, iterations=3)
filled = ndimage.binary_fill_holes(sil)
a_body = np.where(filled, 1.0, matte(dist, 6, 18))
a_body = np.where(car, 0.0, a_body)
rgb_b = im.copy()
# the right end bracket hangs over the shell's corner: patch the corner from the shell beside it
for y in range(484, 514):
    edge = 1036 + (y - 482) * 0.45
    for x in range(1036, 1052):
        if x <= edge:
            rgb_b[y, x] = im[y, 1034]; a_body[y, x] = 1.0
rgb_b = unpremul(rgb_b, a_body, bg)
save(rgb_b, a_body, (0, 440, W, H), 'i_body.webp', q=88)

# ---- guide + segment, to draw over a type bar
gold = matte(r - b, 50, 85) * matte(r, 100, 150) * matte((r - b) / np.maximum(r, 1), 0.26, 0.4)
gx0, gy0, gx1, gy1 = 522, 418, 734, 556
gg = np.zeros((H, W)); gg[gy0:gy1, gx0:gx1] = gold[gy0:gy1, gx0:gx1]
gg = ndimage.grey_closing(gg, size=(5, 5))
gg[552:] = 0
save(im, gg, (gx0, gy0, gx1, gy1), 'i_guide.webp')
print(json.dumps(geo))
