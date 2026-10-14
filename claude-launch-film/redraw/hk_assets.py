"""Hello Kitty assets for the credit (client-supplied images; Hello Kitty is (c) Sanrio).
- hk_pattern.jpg: the client's pink Hello Kitty wallpaper (1080x1920 portrait) scaled to the film's width (Lanczos,
  light denoise of the JPEG blocking) as a tall canvas the scene scrolls through.
- hk_kitty.png: the winking peace-sign Hello Kitty cut out of her flat hot-pink background (colour key on the distance
  to the background colour, largest component only, soft edge from the key, pink spill removed from the edge pixels).
usage: hk_assets.py"""
import os, json
import cv2, numpy as np
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = f'{S}/rd/plates/S13_final_wordmark'; os.makedirs(OUT, exist_ok=True)
# ---- pattern
p = cv2.imread(f'{S}/rd/assets_user/hk_pattern_src.jpg')
p = cv2.fastNlMeansDenoisingColored(p, None, 3, 3, 5, 15)
k = 1920 / p.shape[1]
P = cv2.resize(p, (1920, int(round(p.shape[0] * k))), interpolation=cv2.INTER_LANCZOS4)
P = np.clip(P.astype(np.float32) + 0.25 * (P.astype(np.float32) - cv2.GaussianBlur(P.astype(np.float32), (0, 0), 1.6)), 0, 255).astype(np.uint8)
cv2.imwrite(f'{OUT}/hk_pattern.jpg', P, [cv2.IMWRITE_JPEG_QUALITY, 94])
# ---- character
c = cv2.imread(f'{S}/rd/assets_user/hk_character_src.jpg').astype(np.float32)
B = np.median(np.concatenate([c[:40, :40].reshape(-1, 3), c[:40, -40:].reshape(-1, 3), c[-40:, -40:].reshape(-1, 3)]), 0)
d = np.linalg.norm(c - B[None, None], axis=2)
fg = (d > 60).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(fg, 8)
big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
comp = (lab == big).astype(np.uint8)
comp = cv2.dilate(comp, np.ones((5, 5), np.uint8))
a = np.clip((d - 28) / 150, 0, 1) * comp
a = cv2.GaussianBlur(a, (0, 0), 0.6)
a[(cv2.erode((lab == big).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)] = 1.0
F = c.copy(); m = (a > 0.02) & (a < 0.98)
F[m] = np.clip((c[m] - (1 - a[m])[:, None] * B) / a[m][:, None], 0, 255)
ink = np.median(c[(a > 0.99) & (np.abs(c - c.mean(2, keepdims=True)).max(2) < 25) & (c.mean(2) < 90)], 0)  # the outline colour
F[m] = F[m] * 0.4 + ink * 0.6                                                    # edge pixels sit on the outline
ys, xs = np.where(a > 0.01); y0, y1, x0, x1 = ys.min() - 6, ys.max() + 7, xs.min() - 6, xs.max() + 7
y0, x0 = max(0, y0), max(0, x0)
rgba = np.dstack([F, a[..., None] * 255])[y0:y1, x0:x1].astype(np.uint8)
cv2.imwrite(f'{OUT}/hk_kitty.png', rgba)
json.dump({'pattern': [1920, P.shape[0]], 'kitty': [int(rgba.shape[1]), int(rgba.shape[0])], 'kitty_src_box': [int(x0), int(y0), int(x1), int(y1)], 'bg': B.tolist()},
          open(f'{OUT}/hk_assets.json', 'w'))
print('pattern', P.shape, 'kitty', rgba.shape, 'bg', B.round(1))
