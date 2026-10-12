# the falling notes: cut each fully visible note out of the reference, find its four corners, straighten it into an upright note
import sys, numpy as np, cv2
from PIL import Image
from rembg import new_session, remove
D = sys.argv[1]
ref = Image.open(D + "/ref.png").convert("RGB")
NOTES = {"orange": (205, 168, 372, 368), "pink": (690, 80, 860, 318), "pink2": (490, 188, 616, 372),
         "green": (1030, 318, 1182, 512), "green2": (640, 362, 784, 572), "green3": (368, 558, 514, 758)}
s = new_session("birefnet-general-lite")
ONLY = sys.argv[2:]
for k, box in NOTES.items():
    if ONLY and k not in ONLY: continue
    im = ref.crop(box)
    m = np.asarray(remove(im, session=s, only_mask=True))
    _, b = cv2.threshold(m, 128, 255, cv2.THRESH_BINARY)
    cs, _ = cv2.findContours(b, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(cs, key=cv2.contourArea)
    hull = cv2.convexHull(c)
    q = None
    for eps in np.linspace(.01, .08, 30):                       # the hull simplified to four corners
        ap = cv2.approxPolyDP(hull, eps * cv2.arcLength(hull, True), True)
        if len(ap) == 4: q = ap.reshape(4, 2).astype(np.float32); break
    if q is None: q = cv2.boxPoints(cv2.minAreaRect(c)).astype(np.float32)
    # order: top-left, top-right, bottom-right, bottom-left (by the note's long side being vertical)
    ctr = q.mean(0); ang = np.arctan2(q[:, 1] - ctr[1], q[:, 0] - ctr[0]); q = q[np.argsort(ang)]   # clockwise from left
    sides = [np.linalg.norm(q[i] - q[(i + 1) % 4]) for i in range(4)]
    # make q[0]→q[1] a short side (the note's top)
    if sides[0] + sides[2] > sides[1] + sides[3]: q = np.roll(q, -1, axis=0); sides = sides[1:] + sides[:1]
    W = int(round((sides[0] + sides[2]) / 2)); H = int(round((sides[1] + sides[3]) / 2))
    SC = 3                                                      # straighten at 3x (smooth edges), then scale down
    dst = np.float32([[0, 0], [W * SC, 0], [W * SC, H * SC], [0, H * SC]])
    M = cv2.getPerspectiveTransform(q, dst)
    rgb = cv2.warpPerspective(np.asarray(im), M, (W * SC, H * SC), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    out = Image.fromarray(rgb).resize((W, H), Image.LANCZOS)
    out.save(D + "/note_" + k + ".png")
    print(k, "corners", q.round(1).tolist(), "size", W, "x", H, "aspect", round(H / W, 2))
