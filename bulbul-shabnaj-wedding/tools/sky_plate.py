"""Procedural night sky for the wedding film (no photographs): a deep indigo gradient that warms to a violet glow
at the horizon, a faint band of milky light, soft clouds of noise and a dusting of thousands of tiny stars.
The bright, twinkling stars are drawn live in the scene; this plate is the still, faint part.
usage: sky_plate.py  ->  plates/sky.png (2600 x 1500, the scene's sky canvas)"""
import os
import numpy as np, cv2
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 2600, 1500
rng = np.random.default_rng(1207)
y = np.linspace(0, 1, H)[:, None]; x = np.linspace(0, 1, W)[None, :]

def fbm(w, h, octaves=6, base=4, seed=0):
    r = np.random.default_rng(seed); out = np.zeros((h, w), np.float32); amp, tot = 1.0, 0.0
    for o in range(octaves):
        n = base * 2 ** o
        g = r.standard_normal((n + 1, int(n * w / h) + 1)).astype(np.float32)
        out += amp * cv2.resize(g, (w, h), interpolation=cv2.INTER_CUBIC); tot += amp; amp *= 0.55
    out /= tot; return (out - out.mean()) / (out.std() + 1e-6)

# gradient: zenith ink-blue -> indigo -> violet haze -> warm glow at the horizon (y ~ 0.78 of the plate)
stops = [(0.00, (4, 6, 20)), (0.30, (8, 14, 42)), (0.55, (16, 22, 64)), (0.70, (40, 30, 84)), (0.80, (78, 46, 92)),
         (0.86, (110, 62, 88)), (1.00, (40, 22, 46))]
def ramp(t):
    t = np.clip(t, 0, 1); out = np.zeros(t.shape + (3,), np.float32)
    for (a, ca), (b, cb) in zip(stops[:-1], stops[1:]):
        m = (t >= a) & (t <= b); u = ((t - a) / (b - a))[m]; u = u * u * (3 - 2 * u)
        out[m] = np.array(ca, np.float32) * (1 - u[:, None]) + np.array(cb, np.float32) * u[:, None]
    return out
img = ramp(np.broadcast_to(y, (H, W)).copy())
# the horizon glow is a little stronger in the middle
img *= (1 + 0.18 * np.exp(-((x - 0.5) / 0.35) ** 2) * np.exp(-((y - 0.84) / 0.10) ** 2))[..., None]
# milky band: a soft diagonal ribbon of light with noisy structure
n1 = fbm(W, H, 6, 3, seed=11); n2 = fbm(W, H, 5, 6, seed=12)
band = np.exp(-(((y - 0.15) - 0.55 * (x - 0.2)) / 0.16) ** 2) * (0.55 + 0.45 * np.tanh(0.9 * n1))
band *= (1 - np.clip((y - 0.62) / 0.2, 0, 1))
img += band[..., None] * np.array([26, 24, 46], np.float32) * (0.75 + 0.25 * n2[..., None])
# faint clouds of nebula near the horizon
cl = np.clip(fbm(W, H, 6, 2, seed=21) * 0.6 + 0.1, 0, None) * np.exp(-((y - 0.74) / 0.14) ** 2)
img += cl[..., None] * np.array([30, 16, 40], np.float32)
# star dust: many faint stars (sub-pixel, a soft PSF), colour temperature varied
N = 26000
sx = rng.uniform(0, W, N); sy = (rng.uniform(0, 1, N) ** 1.25) * H * 0.92
mag = rng.pareto(2.6, N) * 0.18 + 0.05
mag *= (1 - np.clip((sy / H - 0.62) / 0.25, 0, 1))                 # fewer near the horizon haze
mag *= 1 + 1.6 * np.exp(-(((sy / H - 0.15) - 0.55 * (sx / W - 0.2)) / 0.16) ** 2)   # more in the milky band
temp = rng.uniform(0, 1, N)
cols = np.where(temp[:, None] < 0.25, [255, 214, 180], np.where(temp[:, None] < 0.75, [240, 240, 255], [190, 210, 255])).astype(np.float32)
acc = np.zeros((H, W, 3), np.float32)
ix = np.clip(sx.astype(int), 0, W - 1); iy = np.clip(sy.astype(int), 0, H - 1)
np.add.at(acc, (iy, ix), cols * np.clip(mag, 0, 1.2)[:, None])
acc = cv2.GaussianBlur(acc, (0, 0), 0.6) * 1.8
img += acc
# dither so the gradient never bands
img += rng.normal(0, 0.9, img.shape).astype(np.float32)
out = np.clip(img, 0, 255).astype(np.uint8)[:, :, ::-1]
os.makedirs(f'{D}/plates', exist_ok=True)
cv2.imwrite(f'{D}/plates/sky.png', out)
print('plates/sky.png', out.shape)
