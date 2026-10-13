"""Rose scene: man + girl layers, clean plate (LaMa), motion weights, flower heads."""
import numpy as np, cv2, sys
import onnxruntime as ort, scipy.ndimage as ndi
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
def feather_out(m, grow, sigma): return np.maximum(soft(dil(m, grow), sigma), (m > 0.5).astype(np.float32))
def sm(z): z = np.clip(z, 0, 1); return z * z * (3 - 2 * z)
a = np.clip((fg - 0.2) / 0.4, 0, 1)
a = cv2.dilate(a, np.ones((3, 3), np.uint8)); a = np.clip(cv2.GaussianBlur(a, (0, 0), 0.7), 0, 1)
GIRL = [(598, 445), (650, 428), (760, 432), (860, 452), (925, 515), (975, 600), (1030, 700), (1060, 800), (1090, 900),
        (1120, 1000), (1150, 1100), (1160, 1199), (418, 1199), (438, 1120), (468, 1060), (488, 1000), (503, 940),
        (513, 870), (528, 800), (548, 740), (572, 700), (583, 640), (578, 560), (588, 490)]
girl_region = np.clip(soft(poly(GIRL), 1.5), 0, 1)
n, lab, st, _ = cv2.connectedComponentsWithStats(((a > 0.5) * (girl_region < 0.5)).astype(np.uint8))
man_core = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.float32)
alpha_g = a * girl_region
alpha_m = a * (1 - girl_region) * dil(man_core, 4)
# his suit continues behind her hair / dress: fill with smooth suit colour
HID = [(560, 430), (692, 300), (705, 760), (610, 1080), (425, 1080), (425, 760), (555, 700)]
hidden = poly(HID) * (girl_region > 0.5)
vis_suit = poly(HID) * (girl_region < 0.5) * (alpha_m > 0.5) * (YY > 250)
num = cv2.GaussianBlur(src * vis_suit[..., None], (0, 0), 22); den = cv2.GaussianBlur(vis_suit, (0, 0), 22)[..., None]
suit_fill = num / np.maximum(den, 1e-4)
man_rgb = src.copy(); man_rgb[hidden > 0] = suit_fill[hidden > 0]
alpha_m = np.maximum(alpha_m, soft(hidden, 1.0) * poly(HID))
occ = np.maximum(alpha_m, alpha_g)
# ---- clean plate (LaMa, sequential 512 crops) ----
hole = dil(occ > 0.02, 3)
head_glow = dil((occ > 0.05) * (YY < 280), 14) * (YY < 300)              # backlit hair glow around his head
girl_glow = dil(alpha_g > 0.05, 16) * (alpha_g < 0.5) * (YY > 440) * (XX > 560)    # backlit flyaway strands around her hair
hole = np.maximum(np.maximum(hole, head_glow), girl_glow)
sess = ort.InferenceSession(P + "/models/lama_fp32.onnx", providers=["CPUExecutionProvider"])
def lama(img, msk):
    o = sess.run(None, {"image": (img / 255.0).transpose(2, 0, 1)[None].astype(np.float32),
                        "mask": (msk > 0.5)[None, None].astype(np.float32)})[0][0].transpose(1, 2, 0)
    return np.clip(o, 0, 255)
# pass 1: whole image at 512 -> coherent sky / mountains / meadow behind the characters
small = cv2.resize(src, (512, 512), interpolation=cv2.INTER_AREA)
hs = (cv2.resize(hole, (512, 512), interpolation=cv2.INTER_LINEAR) > 0.15).astype(np.float32)
fill = cv2.resize(lama(small, hs), (W, H), interpolation=cv2.INTER_CUBIC)
work = src * (1 - hole[..., None]) + fill * hole[..., None]
# pass 2: native resolution, only the band within 70 px of the hole edge (that is what gets revealed);
# the global fill deeper inside serves as context so both passes agree
din = cv2.distanceTransform((hole > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
band = ((hole > 0.5) & (din < 70)).astype(np.float32)
todo = band.copy()
for y0 in range(0, H, 400):
    for x0 in range(0, W, 400):
        xa = min(max(0, x0), W - 512); ya = min(max(0, y0), H - 512)
        msk = todo[ya:ya + 512, xa:xa + 512]
        if msk.sum() < 50: continue
        o = lama(work[ya:ya + 512, xa:xa + 512], msk)
        sel = msk > 0.5
        work[ya:ya + 512, xa:xa + 512][sel] = o[sel]; todo[ya:ya + 512, xa:xa + 512][sel] = 0
# soften the seam between the band and the global interior
wband = np.clip(1 - (din - 55) / 15, 0, 1)[..., None] * (hole[..., None] > 0.5)
print("unfilled band px:", int(todo.sum()))
use = np.maximum(np.maximum(dil(occ > 0.02, 1), head_glow), girl_glow); use = np.maximum(use, soft(use, 1.0))
clean = work * use[..., None] + src * (1 - use[..., None])
diff = cv2.GaussianBlur(np.clip(src - clean, 0, 255), (0, 0), 2.0)
glow_m = diff * (soft(head_glow, 3) * (1 - alpha_m))[..., None]
glow_g = diff * (soft(girl_glow, 3) * (1 - alpha_g) * (1 - alpha_m))[..., None]
np.savez_compressed(P + "/work/layers.npz", clean=clean.astype(np.float32), man_rgb=man_rgb.astype(np.float32),
                    alpha_m=alpha_m.astype(np.float32), girl_rgb=src.astype(np.float32), alpha_g=alpha_g.astype(np.float32),
                    glow_m=glow_m.astype(np.float32), glow_g=glow_g.astype(np.float32))
Image.fromarray(np.clip(clean, 0, 255).astype(np.uint8)).save(P + "/work/clean_plate.png")
rec = clean * (1 - alpha_m[..., None]) + man_rgb * alpha_m[..., None] + glow_m
rec = (rec + glow_g) * (1 - alpha_g[..., None]) + src * alpha_g[..., None]
print("rest reconstruction MAE:", round(float(np.abs(rec - src).mean()), 4))
# ---- motion weights ----
M_HEAD = [(438, 70), (468, 25), (520, 6), (590, 2), (650, 18), (692, 60), (702, 120), (692, 190), (652, 232), (622, 262),
          (575, 272), (530, 252), (498, 218), (462, 190), (440, 140)]
M_FACE = [(500, 120), (600, 108), (642, 150), (636, 216), (602, 256), (560, 268), (520, 242), (500, 190)]
w_mhead = feather_out(poly(M_HEAD), 8, 6)
face_m = feather_out(poly(M_FACE), 5, 3)
d_c = np.hypot(XX - 568, YY - 170)
w_mhair = soft(poly(M_HEAD) * np.clip((d_c - 70) / 50, 0, 1), 3) * (1 - face_m)
w_mhair = np.maximum(w_mhair, soft((alpha_m > 0.1) * dil(poly(M_HEAD), 14) * (1 - dil(poly(M_HEAD), 0)), 2)) * (1 - face_m)
BOUQ = [(205, 412), (565, 412), (565, 650), (455, 700), (445, 905), (285, 905), (295, 705), (205, 605)]
HANDS = [(285, 655), (445, 655), (445, 770), (285, 770)]
w_bouq = soft(poly(BOUQ), 6) * (1 - soft(poly(HANDS), 10))
RIB = [(392, 700), (450, 700), (456, 895), (390, 895)]
w_rib = soft(poly(RIB), 3) * np.clip((YY - 715) / 160, 0, 1)
w_mhem = soft(man_core * np.exp(-((YY - 860) / 45) ** 2) * (XX < 320), 4)
# girl
G_HEAD = [(600, 445), (650, 428), (760, 432), (860, 452), (900, 520), (880, 640), (800, 690), (700, 690), (620, 640), (595, 540)]
w_ghead = feather_out(poly(G_HEAD), 6, 6)
R_, Gc, B_ = src[..., 0], src[..., 1], src[..., 2]
pinkish = ((R_ > 120) & (R_ > Gc * 1.12) & (B_ > Gc * 0.85) & (Gc > 60)).astype(np.float32)
dress = soft(cv2.morphologyEx(pinkish * (girl_region > 0.5) * (YY > 690), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)), 3)
hair_g = (alpha_g > 0.3) * (1 - (dress > 0.4)) * (YY > 470)
w_ghair = np.maximum(soft(hair_g, 3), soft(dil(hair_g, 14), 6) * (girl_glow > 0)) * np.clip((YY - 500) / 420, 0, 1) ** 0.9 * (1 - soft(poly(G_HEAD), 12) * 0.85)
w_gdress = dress * (0.35 + 0.65 * np.clip((YY - 700) / 450, 0, 1))
# background
SKY_Y = sm((235 - YY) / 60)
MEADOW = [(0, 585), (200, 590), (420, 620), (560, 650), (900, 700), (1050, 690), (1312, 760), (1312, 1199), (0, 1199)]
meadow = soft(poly(MEADOW), 14)
A_grass = meadow * np.clip((YY - 520) / (H - 520), 0.04, 1)
fog_band = np.clip(np.exp(-((YY - 330) / 55) ** 2) + 0.8 * np.exp(-((YY - 480) / 45) ** 2) * sm((XX - 700) / 150), 0, 1)
lum = 0.299 * R_ + 0.587 * Gc + 0.114 * B_
trees = {}
for k, (x0, x1, yt, yb) in {"t1": (0, 230, 330, 640), "t2": (930, 1312, 470, 760), "t3": (840, 940, 520, 700)}.items():
    m = np.zeros((H, W), np.float32); m[yt:yb, x0:x1] = (lum[yt:yb, x0:x1] < 70)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    trees[k] = soft(m, 2.5) * np.clip((yb - YY) / (yb - yt), 0, 1) ** 1.3 * (1 - occ)
np.savez_compressed(P + "/work/masks.npz", w_mhead=w_mhead, w_mhair=w_mhair, w_bouq=w_bouq, w_rib=w_rib, w_mhem=w_mhem,
                    face_m=face_m, w_ghead=w_ghead, w_ghair=w_ghair, w_gdress=w_gdress, w_sky=SKY_Y, A_grass=A_grass,
                    fog_band=fog_band, **trees)
# ---- flower heads (daisies / orange) on the clean plate, compact blobs only ----
img = clean; R, G, B = img[..., 0], img[..., 1], img[..., 2]
L2 = 0.299 * R + 0.587 * G + 0.114 * B
mx_, mn_ = img.max(-1), img.min(-1); sat = (mx_ - mn_) / np.maximum(mx_, 1)
def tophat(x, r):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)); return x - cv2.morphologyEx(x, cv2.MORPH_OPEN, k)
th = np.maximum.reduce([tophat(L2, 6), tophat(L2, 16), tophat(L2, 34)])
white = (th > 22) & (sat < 0.32) & (L2 > 120)
orange = (R > 150) & (R > G * 1.25) & (G > B * 1.1) & (np.maximum(tophat(R, 8), tophat(R, 20)) > 30)
fm = (white | orange) & (meadow > 0.5) & ~(dil(occ > 0.05, 4) > 0) & (YY > 600)
fm = cv2.morphologyEx(fm.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
fm = ndi.binary_fill_holes(fm).astype(np.uint8)
core_ = cv2.erode(fm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
nc, clab = cv2.connectedComponents(core_, connectivity=8)
_, (iy, ix) = ndi.distance_transform_edt(core_ == 0, return_indices=True)
lab0 = np.where(fm > 0, clab[iy, ix], 0).astype(np.int32)
small = (fm > 0) & (lab0 == 0); ns, slab = cv2.connectedComponents(small.astype(np.uint8), connectivity=8)
lab0 = np.where(slab > 0, slab + nc, lab0).astype(np.int32)
keep = np.zeros(int(lab0.max()) + 1, bool)
for i, sl in enumerate(ndi.find_objects(lab0), start=1):
    if sl is None: continue
    mm = (lab0[sl] == i).astype(np.uint8); ar = int(mm.sum()); h, w = mm.shape
    cy = sl[0].start + h / 2; persp = max(0.0, (cy - 520) / (H - 520))
    if ar < max(4, 10 * persp ** 2) or max(w, h) > 16 + 110 * persp ** 1.5: continue
    cs, _ = cv2.findContours(mm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cs:
        hull = cv2.contourArea(cv2.convexHull(max(cs, key=cv2.contourArea)))
        if hull > 0 and ar / hull < 0.55: continue
    mo = cv2.moments(mm, True)
    if mo["m00"] > 0:
        c = np.array([[mo["mu20"], mo["mu11"]], [mo["mu11"], mo["mu02"]]]) / mo["m00"]; ev = np.linalg.eigvalsh(c)
        if np.sqrt(max(ev[1], 1e-6) / max(ev[0], 1e-6)) > 2.6 and ar > 10: continue
    keep[i] = True
labf = np.where(keep[lab0], lab0, 0).astype(np.int32)
print("flower heads:", int(keep.sum()))
np.savez_compressed(P + "/work/flowers.npz", lab=labf)
vis = src * 0.45; vis[labf > 0] = [60, 255, 120]; vis[..., 0] += w_ghair * 160; vis[..., 2] += w_gdress * 200 + w_bouq * 120 + w_rib * 255
vis[..., 1] += w_mhair * 150
Image.fromarray(np.clip(vis, 0, 255).astype(np.uint8)).resize((656, 600), Image.Resampling.LANCZOS).save(P + "/work/weights_vis.png")
