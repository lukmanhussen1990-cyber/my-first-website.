# the mask of everything to remove from the reference: HUD, notes, the boy + bag (+ shadow), the arrow buttons
import sys, numpy as np, cv2
from PIL import Image
D = sys.argv[1]
ref = np.asarray(Image.open(D + "/ref.png").convert("RGB")).astype(np.int32)
H, W = ref.shape[:2]
m = np.zeros((H, W), np.uint8)
def rrect(x0, y0, x1, y1, r):
    cv2.rectangle(m, (x0 + r, y0), (x1 - r, y1), 255, -1); cv2.rectangle(m, (x0, y0 + r), (x1, y1 - r), 255, -1)
    for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)): cv2.circle(m, (cx, cy), r, 255, -1)
rrect(4, 5, 276, 124, 30)          # score panel
rrect(1020, 8, 1206, 95, 32)       # hearts panel
rrect(1214, 6, 1306, 97, 26)       # pause
cv2.circle(m, (178, 1017), 124, 255, -1); cv2.circle(m, (1138, 1017), 124, 255, -1)   # arrow buttons
# the notes: their four corners (from the straightening step) + the ones cut off by the top / left edge (bright paper on the dark sky)
Q = {"orange": ((205, 168), [[14, 43], [89, 15], [149, 170], [73, 198]]), "pink": ((690, 80), [[67, 17], [151, 38], [104, 221], [19, 200]]),
     "pink2": ((490, 188), [[39, 15], [108, 26], [85, 167], [16, 155]]), "green": ((1030, 318), [[17, 38], [84, 15], [135, 154], [67, 179]]),
     "green2": ((640, 362), [[49, 18], [127, 35], [94, 195], [14, 179]]), "green3": ((368, 558), [[16, 38], [84, 15], [132, 160], [63, 183]])}
for (ox, oy), q in Q.values():
    cv2.fillPoly(m, [np.int32([[x + ox, y + oy] for x, y in q])], 255)
lum = ref.mean(axis=2)
for x0, y0, x1, y1 in ((0, 110, 120, 250), (335, 0, 475, 158), (905, 0, 1000, 100), (610, 0, 670, 22)):
    sub = (lum[y0:y1, x0:x1] > 105).astype(np.uint8) * 255
    sub = cv2.morphologyEx(sub, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    m[y0:y1, x0:x1] |= sub
# the boy and the bag (+ his shadow on the road under the shoes)
boy = np.asarray(Image.open(D + "/boy_cut_full.png"))[..., 3]
bm = np.zeros((H, W), np.uint8); bm[680:680 + boy.shape[0], 420:420 + boy.shape[1]] = (boy > 20) * 255
m |= bm
cv2.ellipse(m, (560, 1088), (130, 22), 0, 0, 360, 255, -1)
m = cv2.dilate(m, np.ones((15, 15), np.uint8))                 # past the glow round each piece
Image.fromarray(m).save(D + "/bgmask.png")
prev = ref.copy(); prev[m > 0] = (prev[m > 0] * .3 + np.array([255, 0, 255]) * .7).astype(np.int32)
Image.fromarray(prev.astype(np.uint8)).resize((656, 600)).save(D + "/bgmask_prev.png")
print("masked", round((m > 0).mean() * 100, 1), "%")
