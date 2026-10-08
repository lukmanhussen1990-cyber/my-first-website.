"""Make website/assets/frame.png from the wings + crown artwork: removes the picture's red / black background
(keeps the wings, crown, ring, swirls, feathers and sparkles with a soft glow, no box) and cuts out the circle
where the profile clip goes.

    pip install numpy scipy pillow
    python3 android/tools/make_frame.py  frame-artwork.png  website/assets/frame.png  /tmp/preview

The circle position (CX, CY, R_IN below) was measured on the current artwork (1536 x 1024).
A different artwork needs its own numbers; the page reads them from the same values in its CSS (762.8 / 655.6 / 254).
"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out, prev = sys.argv[1:4]
I = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
H, W = I.shape[:2]
R, G, B = I[..., 0], I[..., 1], I[..., 2]
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

# measured ring geometry (see the fit): centre, avatar radius (inner edge of the ring), ring outer edge
CX, CY = 762.8, 655.6
R_IN = 254.0          # the avatar fills r < R_IN
R_RING_OUT = 322.0    # the ring (red line + gold core + red outer line) ends about here
r = np.hypot(xx - CX, yy - CY)

def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

# ---------- 1. element mask ----------
gold_or_white = smoothstep(92, 135, G)                                  # feathers, crown, swirls, sparkles, ring core
pink_feather = smoothstep(150, 200, R) * smoothstep(96, 124, B) * smoothstep(96, 122, G)   # pinkish feather shading (the haze never has this much green + blue)
ring_zone = smoothstep(R_IN - 1.5, R_IN + 0.5, r) * (1 - smoothstep(R_RING_OUT - 6, R_RING_OUT + 10, r))
ring_light = np.clip(np.maximum(R - 60, 0) / 160, 0, 1)                  # the red neon is bright in red
ring = ring_zone * ring_light
m = np.maximum(np.maximum(gold_or_white, pink_feather * 0.9), ring)

# fill small holes / red shading between feathers inside the wings (closing on a binary version, then soften)
mb = m > 0.5
mb = ndi.binary_closing(mb, structure=np.ones((5, 5)), iterations=2)
mb = ndi.binary_fill_holes(mb)
# drop dust: tiny isolated specks that are not bright enough to be sparkles
lab, n = ndi.label(mb)
sizes = ndi.sum(np.ones_like(m), lab, index=np.arange(1, n + 1))
peak = ndi.maximum(G, lab, index=np.arange(1, n + 1))
keep = np.zeros(n + 1, bool)
keep[1:] = (sizes >= 30) | (peak >= 200)          # keep real elements and bright sparkles
mb = keep[lab]
core = np.maximum(m, ndi.gaussian_filter(mb.astype(np.float32), 0.8))  # anti-aliased, keeps soft gradients of the art
core = np.clip(core, 0, 1)

# ---------- 2. colours ----------
# background estimate (smooth haze) from the pixels that are clearly background, for edge unblending
bgmask = (ndi.gaussian_filter(mb.astype(np.float32), 3) < 0.02)
w = ndi.gaussian_filter(bgmask.astype(np.float32), 40) + 1e-4
BG = np.stack([ndi.gaussian_filter(I[..., c] * bgmask, 40) / w for c in range(3)], -1)
a = core[..., None]
# where the mask is partial, remove the background share: F = (I - (1-a) * BG) / a
F = np.where(a > 0.02, (I - (1 - a) * BG) / np.maximum(a, 0.02), I)
F = np.clip(F, 0, 255)
# fully inside the elements keep the exact original colours
F = np.where(a >= 0.98, I, F)

# ---------- 3. soft glow around everything (rebuilt, red/pink), and the ring's own glow ----------
soft = ndi.gaussian_filter(core, 14)
glow_a = np.clip(soft * 1.25, 0, 1) * 0.55
ring_glow = np.exp(-((r - (R_RING_OUT - 8)) / 22.0) ** 2) * (r > R_IN) * 0.6      # warm halo just outside the ring
glow_a = np.maximum(glow_a, ring_glow)
glow_rgb = np.array([255, 62, 54], np.float32)

# composite: glow (under) + elements (over), premultiplied
out_a = core + glow_a * (1 - core)
out_rgb = (F * core[..., None] + glow_rgb * (glow_a * (1 - core))[..., None]) / np.maximum(out_a, 1e-4)[..., None]

# ---------- 4. the avatar hole and the image border ----------
hole = smoothstep(R_IN - 1.0, R_IN + 1.0, r)                   # 0 inside the circle, 1 on the ring
border = np.minimum.reduce([smoothstep(0, 24, xx), smoothstep(0, 24, W - 1 - xx), smoothstep(0, 24, yy), smoothstep(0, 24, H - 1 - yy)])
out_a = out_a * hole * border
out_a[out_a < 0.012] = 0

rgba = np.dstack([np.clip(out_rgb, 0, 255), np.clip(out_a * 255, 0, 255)]).astype(np.uint8)
Image.fromarray(rgba, "RGBA").save(out, optimize=True)

# ---------- previews ----------
def over(bg_rgb):
    al = out_a[..., None]
    return (out_rgb * al + bg_rgb * (1 - al)).clip(0, 255).astype(np.uint8)
check = ((xx // 24 + yy // 24) % 2)[..., None] * 60 + 120
Image.fromarray(over(np.broadcast_to(check, I.shape).astype(np.float32))).save(f"{prev}/on-checker.png")
Image.fromarray(over(np.full(I.shape, 236, np.float32) * [1, .93, .88])).save(f"{prev}/on-paper.png")
Image.fromarray(over(np.zeros(I.shape, np.float32) + 8)).save(f"{prev}/on-black.png")
Image.fromarray((out_a * 255).astype(np.uint8)).save(f"{prev}/alpha.png")
print(json.dumps({"size": [W, H], "centre": [CX, CY], "r_in": R_IN, "ring_out": R_RING_OUT,
                  "opaque_px": int((out_a > 0.5).sum()), "any_alpha_on_border": float(max(out_a[0].max(), out_a[-1].max(), out_a[:, 0].max(), out_a[:, -1].max()))}))
