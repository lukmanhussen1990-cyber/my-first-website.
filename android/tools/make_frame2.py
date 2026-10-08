"""Make website/assets/frame2.png (the wings + crown frame on the Settings card) from its artwork: removes the grey / white
checker pattern and the white haze that were saved into the picture, keeps the wings, crown, ring, swirls and their soft glow,
and cuts out the middle where the profile picture goes.

    pip install numpy scipy pillow
    python3 android/tools/make_frame2.py  frame2-artwork.png  website/assets/frame2.png  /tmp/preview

How: the checker is neutral (grey ~175 / white ~250, drawn by an AI so its grid wobbles) and the artwork is red, gold or dark.
For every pixel the script finds the smallest alpha that explains it as  art x a + neutral background x (1 - a)  for ANY
neutral level from 150 to 255, so the checker disappears without knowing where its squares are, and the pink halo over white
turns into a real red glow. Solid parts (inside the outlines) are then made fully opaque.
The middle is an ellipse measured on the current artwork (1254 x 1254: centre 626.88 / 704.49, half-axes 336.47 x 332.11);
the page uses the same numbers in its CSS. A different artwork needs its own numbers.
"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out, prev = sys.argv[1:4]
C = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
H, W, _ = C.shape
lum = C.mean(axis=2)

# ---- 1. minimal alpha over every neutral background level ----
best_a = np.full((H, W), 9.0, np.float32)
best_b = np.zeros((H, W), np.float32)
for b in range(150, 256):
    up = (C - b) / max(255.0 - b, 1e-6)               # channel brighter than the background
    dn = (b - C) / b                                 # channel darker than the background
    if b == 255:
        up = np.where(C >= 254.5, 0.0, up)
    a = np.where(C > b, up, dn).max(axis=2)
    m = a < best_a
    best_a[m] = a[m]; best_b[m] = b
amin = np.clip(best_a, 0, 1)

# dark pixels (black ring, black feathers, dark outlines) are art even though they are neutral
def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)
dark = smooth(150, 95, lum)
a0 = np.maximum(amin, dark)

# ---- 2. solid art = everything that is not background ----
# background = low-alpha areas that touch the picture's edge, or that show the checker's grey squares
# (closed pockets between the swirls and the ring); white glints inside the art have no grey squares, so they stay
grey_sq = (lum < 215) & (amin < 0.3) & (lum > 140)
cand = a0 < 0.3
lab, n = ndi.label(cand)
edge_ids = np.unique(np.r_[lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]])
greys = ndi.sum(grey_sq, lab, range(1, n + 1))
areas = ndi.sum(cand, lab, range(1, n + 1))
is_bg = np.zeros(n + 1, bool)
is_bg[1:] = (greys >= 25) | (areas > 2500)
is_bg[edge_ids] = True
is_bg[0] = False
BG = is_bg[lab]
E = ~BG
# the ring's inner edge is an ellipse (measured: centre 626.88 / 704.49, half-axes 336.47 x 332.11). The inner gold rim and
# the black band are solid all the way round (under the crown the rim is lit almost white, so it must not count as background)
ECX, ECY, EAX, EAY = 626.88, 704.49, 336.47, 332.11
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
rho = np.sqrt(((xx - ECX) / EAX) ** 2 + ((yy - ECY) / EAY) ** 2)
E |= (rho >= 1.0) & (rho <= 1.0 + 48.0 / 334)
d_in = ndi.distance_transform_edt(E)                   # distance from the background, inside the art
ramp = np.clip((d_in - 1.0) / 3.0, 0, 1)                 # 1 px of edge, then 3 px blend to fully opaque
alpha = np.where(E, np.maximum(a0, ramp), a0)

# faint noise (compression specks, the last trace of the checker) → 0, keep the soft glow
alpha = np.where(E, alpha, alpha * smooth(0.025, 0.09, alpha))

# ---- 3. the empty middle: a clean anti-aliased cut on the measured ellipse ----
alpha = alpha * smooth(1.0 - 1.2 / 334, 1.0 + 0.6 / 334, rho)

# ---- 4. colour: un-mix the background that was chosen for each pixel ----
a3 = np.maximum(alpha, 1e-4)[..., None]
F = (C - (1 - a3) * best_b[..., None]) / a3
F = np.where(alpha[..., None] > 0.999, C, F)
F = np.clip(F, 0, 255)

rgba = np.dstack([F, alpha * 255]).round().clip(0, 255).astype(np.uint8)
rgba[alpha < 0.004] = 0
Image.fromarray(rgba, "RGBA").save(out, optimize=True)

info = {"size": [W, H], "ellipse": {"cx": ECX, "cy": ECY, "ax": EAX, "ay": EAY}}
ys, xs = np.nonzero(alpha > 0.03)
info["bbox"] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
print(json.dumps(info))
json.dump(info, open(prev + "/info.json", "w"), indent=1)

# ---- previews over dark, red-noir and white backgrounds ----
im = Image.open(out).convert("RGBA")
for name, col in (("dark", (14, 6, 9, 255)), ("white", (255, 255, 255, 255)), ("mid", (90, 90, 96, 255))):
    bg = Image.new("RGBA", im.size, col); bg.alpha_composite(im); bg.convert("RGB").save(f"{prev}/over_{name}.png")
Image.fromarray((alpha * 255).astype(np.uint8)).save(f"{prev}/alpha.png")
