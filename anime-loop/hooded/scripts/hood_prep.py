"""Hooded character: matte, clean background plate (LaMa), motion weight maps."""
import numpy as np, cv2, sys
import onnxruntime as ort
from PIL import Image
P = sys.argv[1]
src = np.array(Image.open(P + "/src/source.png").convert("RGB")).astype(np.float32)
H, W = src.shape[:2]
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
fg = cv2.imread(P + "/work/mask_crop.png", cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255.0
def poly(pts):
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.array(pts, np.int32)], 1); return m.astype(np.float32)
def dil(m, r):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)); return cv2.dilate((m > 0.5).astype(np.uint8), k).astype(np.float32)
def soft(m, s): return cv2.GaussianBlur(m.astype(np.float32), (0, 0), s)
def sm(z): z = np.clip(z, 0, 1); return z * z * (3 - 2 * z)
a = np.clip((fg - 0.2) / 0.4, 0, 1)
a = cv2.dilate(a, np.ones((3, 3), np.uint8)); alpha = np.clip(cv2.GaussianBlur(a, (0, 0), 0.7), 0, 1)
# ---- clean plate: global LaMa pass at 512, then a native-resolution pass on the top-left sky ----
sess = ort.InferenceSession(P + "/models/lama_fp32.onnx", providers=["CPUExecutionProvider"])
def lama(img, msk):
    o = sess.run(None, {"image": (img / 255.0).transpose(2, 0, 1)[None].astype(np.float32),
                        "mask": (msk > 0.5)[None, None].astype(np.float32)})[0][0].transpose(1, 2, 0)
    return np.clip(o, 0, 255)
hole = dil(alpha > 0.02, 6)
small = cv2.resize(src, (512, 512), interpolation=cv2.INTER_AREA)
hs = (cv2.resize(hole, (512, 512), interpolation=cv2.INTER_LINEAR) > 0.2).astype(np.float32)
fill = cv2.resize(lama(small, hs), (W, H), interpolation=cv2.INTER_CUBIC)
clean = src * (1 - hole[..., None]) + fill * hole[..., None]
for (x0, y0) in ((0, 0), (0, 300), (742, 0), (742, 512)):
    x0 = min(max(0, x0), W - 512); y0 = min(max(0, y0), H - 512)
    msk = hole[y0:y0 + 512, x0:x0 + 512]
    if msk.sum() == 0: continue
    o = lama(clean[y0:y0 + 512, x0:x0 + 512], msk)
    sel = msk > 0.5
    # keep the native pass only near the silhouette (that is what gets revealed); deep inside keep the global fill
    near = (cv2.distanceTransform((1 - (alpha[y0:y0 + 512, x0:x0 + 512] > 0.02)).astype(np.uint8), cv2.DIST_L2, 3) == 0)
    dist_in = cv2.distanceTransform((alpha[y0:y0 + 512, x0:x0 + 512] > 0.02).astype(np.uint8), cv2.DIST_L2, 3)
    wgt = np.clip(1 - dist_in / 60, 0, 1)[..., None] * sel[..., None]
    clean[y0:y0 + 512, x0:x0 + 512] = clean[y0:y0 + 512, x0:x0 + 512] * (1 - wgt) + o * wgt
Image.fromarray(np.clip(clean, 0, 255).astype(np.uint8)).save(P + "/work/clean_plate.png")
# ---- motion weights ----
HEAD_UNIT = [(150, 0), (1254, 0), (1254, 700), (1165, 1000), (1175, 1190), (960, 1215), (770, 1010), (640, 965),
             (420, 830), (260, 610), (60, 470), (0, 330), (0, 0)]
CORE = [(420, 300), (1010, 280), (1065, 600), (1150, 760), (1165, 1120), (1000, 1185), (820, 1055), (720, 820), (560, 760), (420, 640)]
w_head = np.maximum(soft(poly(HEAD_UNIT), 45), soft(dil(poly(CORE), 30), 12))
w_head = np.maximum(w_head, poly(CORE))
STRANDS = [(30, 40), (300, 25), (430, 150), (430, 330), (340, 480), (110, 480), (30, 330)]
w_strands = soft(poly(STRANDS), 10) * np.clip((440 - XX) / 260, 0, 1) ** 1.2
guard = soft(dil(poly(CORE), 25), 10)
w_strands = w_strands * (1 - guard)
# hood rim: band just inside the right / top silhouette of the hood
inside = (alpha > 0.5).astype(np.uint8)
dist_in = cv2.distanceTransform(inside, cv2.DIST_L2, 5)
w_rim = np.clip(1 - dist_in / 45, 0, 1) * inside * ((XX > 930) & (YY < 720)).astype(np.float32)
w_rim = soft(w_rim, 4) * (1 - guard)
CORD = [(594, 958), (652, 958), (652, 1190), (604, 1190)]
w_cord = soft(poly(CORD), 3)
np.savez_compressed(P + "/work/layers.npz", clean=clean.astype(np.float32), rgb=src.astype(np.float32), alpha=alpha.astype(np.float32))
np.savez_compressed(P + "/work/masks.npz", w_head=w_head.astype(np.float32), w_strands=w_strands.astype(np.float32),
                    w_rim=w_rim.astype(np.float32), w_cord=w_cord.astype(np.float32), guard=guard.astype(np.float32))
vis = src * 0.5; vis[..., 0] += w_strands * 200 + w_rim * 200; vis[..., 1] += w_head * 90; vis[..., 2] += w_cord * 255
Image.fromarray(np.clip(vis, 0, 255).astype(np.uint8)).resize((627, 627), Image.Resampling.LANCZOS).save(P + "/work/weights_vis.png")
print("ok")
