"""Cut the 3D anatomy model (back view) out of the S07 footage for the S08 'thinking' shot: remove the blue
selection dot, key the model off the violet window background by colour (blue minus red), decontaminate the edge
colours against an estimated clean background, and save an RGBA still plus a few landmark coordinates."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from bgplate import fill_fast
src = cv2.imread(f'{S}/rd/plates/S07_anatomy_viewer/bg_0692.jpg').astype(np.float32)
# window interior box (frame px) and the blue dot
X0, Y0, X1, Y1 = 230, 98, 1610, 990
im = src.copy()
b, g, r = im[..., 0], im[..., 1], im[..., 2]
dot = ((b - r) > 60) & ((g - r) > 25) & (np.arange(1080)[:, None] > 650) & (np.arange(1080)[:, None] < 820) & (np.arange(1920)[None, :] > 900) & (np.arange(1920)[None, :] < 1100)
ys, xs = np.nonzero(dot); print('dot', xs.mean(), ys.mean(), len(xs))
cy, cx = int(ys.mean()), int(xs.mean())
dm = np.zeros((1080, 1920), np.uint8); cv2.circle(dm, (cx, cy), 46, 255, -1)
halo = np.zeros((1080, 1920), np.uint8); cv2.circle(halo, (cx, cy), 46, 255, -1)
dm = ((dm > 0) & ((((b - r) > 14) & ((g - r) > -6)) | (np.hypot(*np.meshgrid(np.arange(1920) - cx, np.arange(1080) - cy)) < 30))).astype(np.uint8) * 255
dm = cv2.dilate(dm, np.ones((7, 7), np.uint8))
im = cv2.inpaint(np.clip(im, 0, 255).astype(np.uint8), dm, 9, cv2.INPAINT_TELEA).astype(np.float32)
im = cv2.GaussianBlur(im, (0, 0), 1.2) * (dm[..., None] > 0) + im * (dm[..., None] == 0)
# matte from blue-minus-red (violet glass high, red muscles / white tendons low)
br = im[..., 0] - im[..., 2]
lum = im.mean(2)
a = np.clip((44 - br) / 30, 0, 1)
a[:Y0] = 0; a[Y1:] = 0; a[:, :X0] = 0; a[:, X1:] = 0
a = cv2.GaussianBlur(a, (0, 0), 0.7)
# keep the largest component (the body); drop specks of glass reflections
m = (a > 0.5).astype(np.uint8); n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
keep = lab == (1 + np.argmax(st[1:, cv2.CC_STAT_AREA]))
keep = cv2.dilate(keep.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
a = a * keep
a[dm > 0] = 1.0                                              # the repaired patch is skin, not background
a[:, :600] = 0                                              # a sliver of the window edge at far left
# soft fades: above the shoulders (the window cut the head) and below the hips (the window bottom)
yy = np.arange(1080)[:, None].astype(np.float32)
a = a * np.clip((yy - 200) / 190, 0, 1) ** 1.5 * np.clip((975 - yy) / 120, 0, 1)
# clean background estimate inside the body (for edge decontamination): fill the body region from outside
bgm = cv2.dilate((a > 0.02).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
B = fill_fast(im, bgm)
A = np.clip(a, 1e-3, 1)[..., None]
F = np.clip((im - (1 - A) * B) / A, 0, 255)
F = np.where(a[..., None] > 0.995, im, F)
out = np.dstack([F, a * 255]).astype(np.float32)
x0, y0, x1, y1 = cv2.boundingRect((a > 0.02).astype(np.uint8)); x1 += x0; y1 += y0
x0, y0, x1, y1 = max(0, x0 - 8), max(0, y0 - 8), min(1920, x1 + 8), min(1080, y1 + 8)
os.makedirs(f'{S}/rd/plates/S08_processing', exist_ok=True)
cv2.imwrite(f'{S}/rd/plates/S08_processing/model.png', np.clip(out[y0:y1, x0:x1] + 0.5, 0, 255).astype(np.uint8))
json.dump({'crop': [int(x0), int(y0), int(x1), int(y1)], 'dot': [float(cx - x0), float(cy - y0)]}, open(f'{S}/rd/plates/S08_processing/model.json', 'w'))
print('crop', x0, y0, x1, y1, 'dot in crop', cx - x0, cy - y0)
# preview over the S08 gradient
bg = cv2.imread(f'{S}/rd/plates/S08_processing/bg_0760.jpg').astype(np.float32)
pv = bg.copy(); al = out[y0:y1, x0:x1, 3:] / 255
pv[y0:y1, x0:x1] = pv[y0:y1, x0:x1] * (1 - al) + out[y0:y1, x0:x1, :3] * al
cv2.imwrite(f'{S}/rd/review/s08_model_preview.jpg', pv.astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
