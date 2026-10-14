"""Closing-sky plate: the client's sunset photograph (rd/assets_user/sunset_src.png, 1672x940) prepared as a camera
canvas for S12/S13 (rd/shared/sky.js). Lanczos upscale x1.2 (the camera only needs a slow push and a tilt), a light
unsharp mask to keep the cloud detail crisp, and a fine baked grain to match the film's footage.
usage: sky_plate.py  ->  rd/plates/S12_closing_lines/sunset.jpg (+ sunset.json with the sun position on the canvas)"""
import os, json
import cv2, numpy as np
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = cv2.imread(f'{S}/rd/assets_user/sunset_src.png', cv2.IMREAD_COLOR).astype(np.float32)
h, w = src.shape[:2]
K = 1.2
W, H = int(round(w * K)), int(round(h * K))
up = cv2.resize(src, (W, H), interpolation=cv2.INTER_LANCZOS4)
up = up + 0.35 * (up - cv2.GaussianBlur(up, (0, 0), 1.2))
rng = np.random.default_rng(11)
g = rng.normal(0, 1.0, (H, W, 1)).astype(np.float32) + rng.normal(0, 0.35, (H, W, 3)).astype(np.float32)
up = np.clip(up + g, 0, 255).astype(np.uint8)
# the sun: centre of the saturated core near the bottom of the frame
lum = cv2.GaussianBlur(cv2.cvtColor(src.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 3)
band = lum[int(0.85 * h):, :]
yy, xx = np.unravel_index(np.argmax(band), band.shape)
sun = [float((xx) * K), float((yy + int(0.85 * h)) * K)]
out = f'{S}/rd/plates/S12_closing_lines/sunset.jpg'
cv2.imwrite(out, up, [cv2.IMWRITE_JPEG_QUALITY, 96])
json.dump({'w': W, 'h': H, 'scale': K, 'sun': sun}, open(out.replace('.jpg', '.json'), 'w'))
print(out, W, H, 'sun', [round(v, 1) for v in sun])

# ---- dusk grade of the same canvas (crossfaded in by sky.js as the sun sets): about 1.8 stops darker, cooler sky,
# the cloud tops turning rose/mauve, the warm glow held a little longer along the horizon, the zenith darkest.
def s2l(x): return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)
def l2s(x): x = np.clip(x, 0, 1); return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)
rgb = up[:, :, ::-1].astype(np.float32) / 255.0
lin = s2l(rgb)
L = (0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2])[..., None]
yv = (np.arange(H, dtype=np.float32) / H)[:, None, None]
sm = lambda a, b, x: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))
d = lin * 0.28 * np.array([0.74, 0.84, 1.10], np.float32)                      # exposure + cooler white balance
hl = sm(0.18, 0.75, L)                                                        # cloud tops -> rose/mauve
d = d * (1 - 0.55 * hl) + 0.55 * hl * (L * 0.30) * np.array([1.0, 0.56, 0.74], np.float32)
hz = sm(0.70, 1.0, yv)                                                        # warm horizon lingers
d = d * (1 - 0.6 * hz) + 0.6 * hz * lin * 0.5 * np.array([1.10, 0.66, 0.50], np.float32)
d *= (0.55 + 0.45 * sm(0.0, 0.85, yv))                                        # zenith darkest
dusk = (l2s(d) * 255 + 0.5).astype(np.uint8)[:, :, ::-1]
cv2.imwrite(out.replace('.jpg', '_dusk.jpg'), dusk, [cv2.IMWRITE_JPEG_QUALITY, 96])
print(out.replace('.jpg', '_dusk.jpg'))
