"""Build static masks / weight maps for the loop animation (source pixel space 1145x1374)."""
import numpy as np, cv2, sys
from PIL import Image
SP = sys.argv[1]
src = np.array(Image.open(SP + "/src/source.png").convert("RGB"))
H, W = src.shape[:2]
fg = cv2.imread(SP + "/work/mask_crop.png", cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255.0
fg[1205:] = 0  # crop pass hard edge at y=1200: nothing of the characters below their feet

def poly(pts):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1)
    return m.astype(np.float32)

def feather_out(m, grow, sigma):
    """1 on/inside the shape, smooth falloff only OUTSIDE it."""
    b = (m > 0.5).astype(np.uint8)
    if grow > 0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1))
        b = cv2.dilate(b, k)
    f = cv2.GaussianBlur(b.astype(np.float32), (0, 0), sigma)
    return np.maximum(f, (m > 0.5).astype(np.float32))

def soft(m, sigma):
    return cv2.GaussianBlur(m.astype(np.float32), (0, 0), sigma)

YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)

# ---------------- characters ----------------
GIRL_POLY = [(548,850),(575,822),(615,806),(660,806),(695,824),(712,860),(722,895),(738,945),
             (748,1000),(750,1060),(746,1120),(732,1160),(700,1186),(640,1200),(560,1204),(445,1204),
             (430,1172),(445,1128),(476,1094),(484,1040),(490,990),(518,960),(546,932),(540,890)]
girl_region = poly(GIRL_POLY)
fgb = (fg > 0.35).astype(np.float32)
girl_sil = fgb * girl_region
man_sil = fgb * (1 - girl_region)
# keep only the main connected component for the man (drop stray bits)
n, lab, stats, _ = cv2.connectedComponentsWithStats(man_sil.astype(np.uint8))
if n > 1:
    big = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA]); man_sil = (lab == big).astype(np.float32)

w_girl = feather_out(girl_sil, 4, 5)
w_man = feather_out(man_sil, 5, 6)
w_man = w_man * (1 - w_girl)          # girl sits in front of his legs
w_bg = np.clip(1 - w_girl - w_man, 0, 1)
char_alpha = np.clip(soft(fgb, 1.5), 0, 1)   # for keeping fog off the characters

# man sub-regions
MAN_HEAD = [(562,500),(568,470),(588,446),(615,430),(645,423),(670,426),(692,440),(707,462),
            (710,488),(700,512),(694,535),(686,556),(670,574),(648,580),(625,568),(604,552),
            (590,532),(574,520)]
w_mhead = feather_out(poly(MAN_HEAD), 9, 7)   # rigid head (+hair +rim glow)
# confine head weight's falloff into the collar/shoulder a little only
MAN_FACE = [(590,505),(640,492),(680,495),(692,520),(686,552),(668,574),(645,578),(620,562),(600,546),(590,525)]
face_m = feather_out(poly(MAN_FACE), 4, 3)
# man hair flutter weight: tips only (distance from scalp centre), never on the face
d_c = np.hypot(XX - 652, YY - 505)
w_mhair = poly(MAN_HEAD) * np.clip((d_c - 52) / 40, 0, 1)
w_mhair = soft(w_mhair, 3) * (1 - face_m)
# upper body (lean about hips), breathing chest
w_mupper = np.clip((815 - YY) / 110, 0, 1); w_mupper = w_mupper * w_mupper * (3 - 2 * w_mupper)
# jacket hem flutter band (bottom of the jacket), on the man only
w_mhem = np.exp(-((YY - 770) / 28) ** 2) * man_sil * (XX > 640)
w_mhem = soft(w_mhem, 4)

# girl sub-regions
GIRL_UPPER = [(552,832),(588,808),(650,804),(700,826),(716,880),(722,940),(704,1000),(662,1016),
              (612,1012),(586,992),(570,952),(553,900)]
w_gupper = soft(poly(GIRL_UPPER), 16)
w_gupper = np.maximum(w_gupper, poly(GIRL_UPPER) * 0)  # keep soft
GIRL_HEAD = [(560,842),(596,814),(650,808),(694,826),(706,868),(694,915),(652,934),(610,928),(578,906),(562,876)]
w_ghead = feather_out(poly(GIRL_HEAD), 3, 5)
GIRL_FACE = [(596,846),(640,834),(684,846),(694,876),(682,906),(650,922),(614,916),(597,890),(593,864)]
face_g = feather_out(poly(GIRL_FACE), 6, 4)
# long hair: right cascade (in front of his leg) + left side; amplitude grows downward
HAIR_R = [(678,868),(700,874),(722,920),(738,980),(744,1040),(742,1100),(728,1152),(700,1166),
          (688,1104),(684,1040),(678,980),(670,920)]
HAIR_L = [(556,850),(588,846),(602,900),(598,960),(582,996),(560,972),(548,910)]
hair_g = soft(np.maximum(poly(HAIR_R), poly(HAIR_L)), 4)
w_ghair = hair_g * np.clip((YY - 885) / 120, 0, 1) * (1 - face_g)
# dress / frills: pink-ish pixels inside girl region, lower part
r, g, b = [src[..., i].astype(np.float32) for i in range(3)]
pink = ((r > 70) & (r > g * 1.35) & (r > b * 1.3) & (YY > 990)).astype(np.float32) * girl_region
w_gdress = soft(pink, 3) * (1 - face_g)

# ---------------- background ----------------
lum = 0.299 * r + 0.587 * g + 0.114 * b
# trees: dark silhouettes against sky/mist
TREES = {  # name: (x0,x1,y_top,y_base, base_x)
    "left": (240, 390, 238, 425, 330), "mid": (455, 610, 200, 405, 535),
    "right": (695, 840, 280, 405, 770), "small": (630, 670, 350, 400, 652)}
tree_masks = {}
for k, (x0, x1, yt, yb, bx) in TREES.items():
    m = np.zeros((H, W), np.float32)
    sub = (lum[yt:yb, x0:x1] < 92).astype(np.float32)
    m[yt:yb, x0:x1] = sub
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    hgt = np.clip((yb - YY) / (yb - yt), 0, 1) ** 1.5
    tree_masks[k] = soft(m, 2.5) * hgt
# sky drift velocity weight (clouds): full at top, gone before trees / hills
fy = np.clip((205 - YY) / 105, 0, 1); fy = fy * fy * (3 - 2 * fy)
fy = fy * (0.65 + 0.35 * np.clip((140 - YY) / 140, 0, 1))
treeblock = soft((sum(tree_masks.values()) > 0.02).astype(np.float32), 8)
treeblock = np.clip(treeblock * 3, 0, 1)
w_sky = fy * (1 - treeblock)
# meadow sway amplitude (perspective, horizon ~480), fades in at the meadow edge (~548)
yh = 480.0
edge = np.clip((YY - 548) / 40, 0, 1); edge = edge * edge * (3 - 2 * edge)
A_grass = edge * (YY - yh) / (H - yh)
# fog band: hill/mist zone
fb = np.exp(-((YY - 455) / 95) ** 2) * 0.85 + np.exp(-((YY - 350) / 55) ** 2) * 0.5
fb = np.clip(fb, 0, 1) * (YY < 640)
np.savez_compressed(SP + "/work/masks.npz", w_girl=w_girl, w_man=w_man, w_bg=w_bg, char_alpha=char_alpha,
    w_mhead=w_mhead, w_mhair=w_mhair, w_mupper=w_mupper, w_mhem=w_mhem, w_gupper=w_gupper,
    w_ghead=w_ghead, w_ghair=w_ghair, w_gdress=w_gdress, w_sky=w_sky, A_grass=A_grass, fog_band=fb,
    tree_left=tree_masks["left"], tree_mid=tree_masks["mid"], tree_right=tree_masks["right"],
    tree_small=tree_masks["small"], face_m=face_m, face_g=face_g)
# visual check
def vis(name, m, color):
    o = src.astype(np.float32) * 0.45 + np.array(color, np.float32) * m[..., None] * 0.55 * 255
    Image.fromarray(np.clip(o, 0, 255).astype(np.uint8)).save(SP + f"/work/m_{name}.png")
vis("chars", np.stack([w_man, w_girl, np.zeros_like(w_man)], -1).max(-1) * 0 + w_man, (0, 1, 0))
o = src.astype(np.float32) * 0.4
o[..., 1] += w_man * 150; o[..., 0] += w_girl * 150; o[..., 2] += (w_mhead + w_ghead) * 120
Image.fromarray(np.clip(o, 0, 255).astype(np.uint8)).save(SP + "/work/m_split.png")
o = src.astype(np.float32) * 0.4
o[..., 0] += w_ghair * 200; o[..., 1] += w_gdress * 200 + w_mhair * 200; o[..., 2] += w_gupper * 120 + w_mhem * 200
Image.fromarray(np.clip(o, 0, 255).astype(np.uint8)).save(SP + "/work/m_sub.png")
o = src.astype(np.float32) * 0.4
o[..., 0] += w_sky * 200; o[..., 1] += A_grass * 200; o[..., 2] += fb * 150 + sum(tree_masks.values()) * 200
Image.fromarray(np.clip(o, 0, 255).astype(np.uint8)).save(SP + "/work/m_bg.png")
print("ok", w_man.max(), w_girl.max(), man_sil.sum(), girl_sil.sum())
