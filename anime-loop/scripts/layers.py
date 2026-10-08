"""Split the illustration into: clean background plate (LaMa inpaint), man layer, girl layer, man glow layer."""
import numpy as np, cv2, sys
import onnxruntime as ort
from PIL import Image
SP = sys.argv[1]
src = np.array(Image.open(SP + "/src/source.png").convert("RGB")).astype(np.float32)
H, W = src.shape[:2]
YY = np.mgrid[0:H, 0:W][0]
fg = cv2.imread(SP + "/work/mask_crop.png", cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255.0
fg[1205:] = 0
def poly(pts):
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.array(pts, np.int32)], 1); return m.astype(np.float32)
def dil(m, r):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)); return cv2.dilate((m > 0.5).astype(np.uint8), k).astype(np.float32)

GAP = [(756,876),(768,878),(777,940),(779,1000),(773,1062),(766,1112),(757,1112),(751,1050),(749,990),(751,930)]
fg = fg * (1 - poly(GAP))
GIRL_POLY = [(548,850),(575,822),(615,806),(660,804),(686,822),(692,852),(700,885),(712,925),(722,960),
             (732,1000),(741,1045),(747,1090),(747,1125),(738,1155),(705,1185),(640,1200),(560,1204),(445,1204),
             (430,1172),(445,1128),(476,1094),(484,1040),(490,990),(518,960),(546,932),(540,890)]
girl_region = np.clip(cv2.GaussianBlur(poly(GIRL_POLY), (0, 0), 2.0), 0, 1)
# hardened matte (anime line art has crisp edges) + 1px grow so the outline travels with the character
a = np.clip((fg - 0.2) / 0.4, 0, 1)
a = cv2.dilate(a, np.ones((3, 3), np.uint8))
a = np.clip(cv2.GaussianBlur(a, (0, 0), 0.7), 0, 1)
n, lab, st, _ = cv2.connectedComponentsWithStats(((a > 0.5) * (girl_region < 0.5)).astype(np.uint8))
man_core = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.float32)
alpha_g = a * girl_region
alpha_m = a * (1 - girl_region) * dil(man_core, 4)
# his left leg continues behind her hair: complete it with smooth trouser colour
LEG = [(692,800),(762,800),(760,1100),(752,1140),(702,1146),(698,1000)]
leg = poly(LEG) * (1 - poly(GAP))
hidden_leg = leg * (girl_region > 0.5)
vis_tr = leg * (girl_region < 0.5) * (fg > 0.5)
num = cv2.GaussianBlur(src * vis_tr[..., None], (0, 0), 14); den = cv2.GaussianBlur(vis_tr, (0, 0), 14)[..., None]
leg_fill = num / np.maximum(den, 1e-4)
man_rgb = src.copy(); man_rgb[hidden_leg > 0] = leg_fill[hidden_leg > 0]
alpha_m = np.maximum(alpha_m, cv2.GaussianBlur(hidden_leg, (0, 0), 1.0) * leg)
girl_rgb = src.copy()
occ = np.maximum(alpha_m, alpha_g)
# ---- LaMa clean plate ----
lama_hole = dil(occ > 0.02, 3)
head_glow = dil((occ > 0.02) * (girl_region < 0.5) * (YY < 575), 24) * (YY < 590)   # rim glow around his head
lama_hole = np.maximum(lama_hole, head_glow)
sess = ort.InferenceSession(SP + "/models/lama_fp32.onnx", providers=["CPUExecutionProvider"])
work = src.copy(); todo = lama_hole.copy()
for (x0, y0) in ((420, 372), (398, 760), (630, 760)):
    x0 = min(max(0, x0), W - 512); y0 = min(max(0, y0), H - 512)
    msk = todo[y0:y0 + 512, x0:x0 + 512]
    if msk.sum() == 0: continue
    img = work[y0:y0 + 512, x0:x0 + 512] / 255.0
    out = sess.run(None, {"image": img.transpose(2, 0, 1)[None].astype(np.float32),
                          "mask": (msk > 0.5)[None, None].astype(np.float32)})[0][0].transpose(1, 2, 0)
    sel = msk > 0.5
    work[y0:y0 + 512, x0:x0 + 512][sel] = np.clip(out[sel], 0, 255)
    todo[y0:y0 + 512, x0:x0 + 512][sel] = 0
print("unfilled px:", int(todo.sum()))
# final plate: LaMa only under the characters (+1px) and in the head-glow zone; original pixels everywhere else
use = np.maximum(dil(occ > 0.02, 1), head_glow)
use = np.maximum(use, cv2.GaussianBlur(use, (0, 0), 1.0))
clean = work * use[..., None] + src * (1 - use[..., None])
# glow around his head travels with him (additive, low-frequency)
diff = cv2.GaussianBlur(np.clip(src - clean, 0, 255), (0, 0), 2.0)
glow_m = diff * (cv2.GaussianBlur(head_glow, (0, 0), 3) * (1 - alpha_m))[..., None]
np.savez_compressed(SP + "/work/layers.npz", clean=clean.astype(np.float32), man_rgb=man_rgb.astype(np.float32),
                    alpha_m=alpha_m.astype(np.float32), girl_rgb=girl_rgb.astype(np.float32), alpha_g=alpha_g.astype(np.float32),
                    glow_m=glow_m.astype(np.float32))
Image.fromarray(np.clip(clean, 0, 255).astype(np.uint8)).save(SP + "/work/clean_plate.png")
rec = clean * (1 - alpha_m[..., None]) + man_rgb * alpha_m[..., None] + glow_m
rec = rec * (1 - alpha_g[..., None]) + girl_rgb * alpha_g[..., None]
err = np.abs(rec - src).mean(-1)
print("rest reconstruction MAE:", round(float(err.mean()), 4), "px>10:", int((err > 10).sum()), "px>25:", int((err > 25).sum()))
n, lab, st, cen = cv2.connectedComponentsWithStats((err > 25).astype(np.uint8))
for i in (np.argsort(st[1:, cv2.CC_STAT_AREA])[::-1][:6] + 1 if n > 1 else []):
    print("  err blob", st[i, cv2.CC_STAT_AREA], "at", int(cen[i][0]), int(cen[i][1]))
Image.fromarray(np.clip(rec, 0, 255).astype(np.uint8)).save(SP + "/work/rest_rec.png")
