"""Make website/assets/frame-crown.webp (the gold crown, stars, orbits + clouds frame round the picture on Profile) and its soft glow
website/assets/frame-crown-glow.webp from the artwork, which has a grey / white checker pattern saved into it (fake transparency).

    pip install numpy scipy pillow
    python3 android/tools/make_frame_crown.py  crown-frame-artwork.png  website/assets  [/tmp/preview]

How: the checker has 12 px cells (dark ~152 / light ~212, neutral, drawn by an AI so its grid wobbles in places).
  1. alpha = the smallest alpha that explains a pixel as  art x a + grey x (1 - a)  for a grey level 140..226: gold glow over light
     and dark cells comes out with the same alpha and colour, so the checker disappears from the glow.
  2. solid art = everything that is not background (low-alpha regions holding plain checker, or big see-through pockets);
     the clouds (bluish / white / cream, grown into their own smooth shading) and the ring band always count as art.
  3. the glow outside the art keeps its alpha (smoothed over a pair of cells, sparkles kept); white smudges of the checker go.
  4. the middle is cut on the ring's inner edge, a circle measured on this artwork (1254 x 1254: centre 626.3 / 669.6,
     radius 323.9); only gold glow reaches a little way in. The page uses the same numbers in its CSS (and the orbit / star spots
     in the script). A different artwork needs its own numbers.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

src, outdir = sys.argv[1:3]
prev = sys.argv[3] if len(sys.argv) > 3 else None
C = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
H, W, _ = C.shape
lum = C.mean(2); chroma = C.max(2) - C.min(2)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
CX, CY, R_IN = 626.3, 669.6, 323.9          # measured: the ring's inner edge (black line) is this circle, +-1.4 px
R_BAND = 416.0                              # black line, gold rim, silver band, shadow, outer gold: solid out to here
r = np.hypot(xx - CX, yy - CY)

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

# ---- 1. minimal alpha over the grey levels of the checker ----
best_a = np.full((H, W), 9.0, np.float32); best_b = np.zeros((H, W), np.float32)
for b in range(140, 227):
    a = np.where(C > b, (C - b) / (255.0 - b), (b - C) / b).max(axis=2)
    m = a < best_a; best_a[m] = a[m]; best_b[m] = b
amin = np.clip(best_a, 0, 1)
dark = smooth(118, 62, lum)                  # dark outlines / the black line are art although they are neutral
a0 = np.maximum(amin, dark)

# ---- 2. what is art ----
m9 = ndi.uniform_filter(lum, 9); sd = np.sqrt(np.maximum(ndi.uniform_filter(lum * lum, 9) - m9 * m9, 0))
# clean or gold-tinted checker: cell-sized contrast in both diagonals (T), not too colourful
g = lum - ndi.gaussian_filter(lum, 8)
def demod(sign):
    z = g * np.exp(-2j * np.pi * (xx + sign * yy) / 24)
    return np.abs(ndi.gaussian_filter(z.real, 4) + 1j * ndi.gaussian_filter(z.imag, 4))
T = np.minimum(demod(1), demod(-1)); T /= np.median(T[0:200, 0:200])
seed = (sd >= 18) & (ndi.maximum_filter(chroma, 5) <= 12) & (T >= 0.7) & (lum >= 135) & (lum <= 232)
checker = ndi.binary_dilation(seed)
lab, n = ndi.label(checker)                                  # plain checker comes in big patches; a few look-alike pixels in a cloud do not count
big = np.zeros(n + 1, bool); big[1:] = ndi.sum(checker, lab, range(1, n + 1)) >= 150
checker = big[lab]

# clouds: bluish shading, or pale bright (white / cream) areas; never plain checker
blue = ((C[..., 2] - C[..., 0]) >= 6) & (lum >= 95)
pale = (lum >= 200) & (chroma <= 62)
raw = ndi.binary_opening((blue | pale) & ~checker, structure=np.ones((5, 5), bool))
raw = ndi.binary_closing(raw, structure=np.ones((9, 9), bool)) & ~checker
lab, n = ndi.label(raw)
area = ndi.sum(raw, lab, range(1, n + 1))
big = np.zeros(n + 1, bool); big[1:] = area >= 600
cloud = ndi.binary_fill_holes(big[lab]) & ~checker & (r > R_IN + 2)
# grow the clouds into their own smooth shading (lavender / grey undersides), never into textured checker
allowed = (sd < 13) & (lum >= 105) & (chroma <= 75) & ~checker & (r > R_IN + 2)
for _ in range(30):
    cloud = cloud | (ndi.binary_dilation(cloud) & allowed)
cloud = ndi.binary_fill_holes(cloud) & ~checker & (r > R_IN + 2)
band = (r >= R_IN - 0.5) & (r <= R_BAND)
cand = (a0 < 0.62) & ~cloud & ~band
lab, n = ndi.label(cand)
seeds = ndi.sum(seed, lab, range(1, n + 1))
areas = ndi.sum(cand, lab, range(1, n + 1))
is_bg = np.zeros(n + 1, bool); is_bg[1:] = (seeds >= 20) | (areas >= 400)    # big see-through pockets are haze; small ones are highlights in the art
is_bg[np.unique(np.r_[lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]])] = True
is_bg[0] = False
BG = is_bg[lab]
# the glow of an orbit line where it crosses a cloud is cloud underneath: bright pixels in the gaps of a cloud are art
yy0, xx0 = np.mgrid[-18:19, -18:19]
hull = ndi.binary_closing(np.pad(cloud, 20), structure=(xx0 ** 2 + yy0 ** 2) <= 324)[20:-20, 20:-20]
BG &= ~(hull & ~cloud & (lum >= 140) & ~checker)
E = ~BG

# ---- 3. alpha ----
d_in = ndi.distance_transform_edt(E)
ramp = np.clip((d_in - 1.0) / 3.0, 0, 1)
alpha = np.where(E, np.maximum(a0, ramp), a0)
# outside the art: neutral light bits (smudges of the checker) go; see-through dark smoke: blur over a cell pair
neutral = ndi.maximum_filter(chroma, 3) < 22
alpha = np.where(BG & neutral & (lum >= 140), 0, alpha)
smokey = BG & neutral & (lum < 140)
blurred = ndi.gaussian_filter(np.where(smokey, alpha, 0), 5) / np.maximum(ndi.gaussian_filter(smokey.astype(np.float32), 5), 1e-3)
alpha = np.where(smokey, blurred, alpha)
alpha = np.where(BG, alpha * smooth(0.03, 0.09, alpha), alpha)
wbg = BG.astype(np.float32); den = np.maximum(ndi.gaussian_filter(wbg, 6), 1e-3)
a_s = ndi.gaussian_filter(alpha * wbg, 6) / den
a3_ = np.maximum(alpha, 1e-4)[..., None]
Fu = np.clip((C - (1 - a3_) * best_b[..., None]) / a3_, 0, 255)
P_s = np.dstack([ndi.gaussian_filter(Fu[..., k] * alpha * wbg, 6) / den for k in range(3)])
speck = (alpha - a_s) > 0.22
HAZE = BG & ~speck

alpha = np.where(HAZE, a_s, alpha)

# ---- 4. the middle ----
inner_glow = np.where(chroma >= 28, a0, 0) * smooth(R_IN - 70, R_IN - 3, r)
alpha = np.where(r < R_IN - 0.5, inner_glow, alpha)
alpha = np.where((r >= R_IN - 0.5) & (r < R_IN + 0.5), np.maximum(alpha, (r - (R_IN - 0.5))), alpha)

# ---- 5. colour: un-mix the grey that was chosen for each pixel ----
a3 = np.maximum(alpha, 1e-4)[..., None]
F = (C - (1 - a3) * best_b[..., None]) / a3
F = np.where(alpha[..., None] > 0.999, C, F)
F = np.where((HAZE & (r >= R_IN))[..., None], P_s / np.maximum(a_s, 1e-4)[..., None], F)
F = np.clip(F, 0, 255)
rgba = np.dstack([F, alpha * 255]).round().clip(0, 255).astype(np.uint8)
rgba[alpha < 0.004] = 0
frame = Image.fromarray(rgba, "RGBA")

# ---- 6. the files: the frame at 1000 x 1000 (resized with premultiplied alpha: no dark fringes) and a soft gold glow copy ----
frame.convert("RGBa").resize((1000, 1000), Image.LANCZOS).convert("RGBA").save(outdir + "/frame-crown.webp", "WEBP", quality=90, alpha_quality=92, method=6)
G = 420
pm = np.asarray(frame.convert("RGBa").resize((G, G), Image.LANCZOS)).astype(np.float32)[..., :3] / 255
def blur(a, rad):
    return np.dstack([np.asarray(Image.fromarray((a[..., k] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(rad))).astype(np.float32) / 255 for k in range(3)])
gl = (0.9 * blur(pm, 3) + 0.75 * blur(pm, 10)) * np.array([1.0, 0.86, 0.55])                 # tight + wide, warmer: gold, not white
gy, gx = np.mgrid[0:G, 0:G]
gl = gl * np.clip((np.hypot(gx - CX * G / W, gy - CY * G / H) / (G / W) - 300) / 30, 0, 1)[..., None]   # no glow over the picture
ga = np.clip(gl.max(axis=2) * 1.25, 0, 1)
gc = np.clip(gl / np.maximum(ga, 1e-3)[..., None], 0, 1)
Image.fromarray((np.dstack([gc, ga]) * 255).round().astype(np.uint8), "RGBA").save(outdir + "/frame-crown-glow.webp", "WEBP", quality=88, alpha_quality=88, method=6)

if prev:                                                                                    # previews over a dark background
    bg = Image.new("RGBA", frame.size, (14, 6, 9, 255)); bg.alpha_composite(frame); bg.convert("RGB").save(prev + "/crown_over_dark.png")
    Image.fromarray((alpha * 255).astype(np.uint8)).save(prev + "/crown_alpha.png")
print("wrote", outdir + "/frame-crown.webp", "and", outdir + "/frame-crown-glow.webp")
