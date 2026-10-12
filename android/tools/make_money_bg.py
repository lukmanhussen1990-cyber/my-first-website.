# fill the masked parts of the reference (LaMa), one 512 x 512 window per hole, at full resolution
import sys, numpy as np, cv2, onnxruntime as ort
from PIL import Image
D, MODEL = sys.argv[1], sys.argv[2]
img = np.asarray(Image.open(D + "/ref.png").convert("RGB")).astype(np.float32)
mask = np.asarray(Image.open(D + "/bgmask.png")) > 0
H, W = mask.shape
sess = ort.InferenceSession(MODEL, providers=["CPUExecutionProvider"])
n, lab, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
order = sorted(range(1, n), key=lambda i: -stats[i, cv2.CC_STAT_AREA])
done = np.zeros(n, bool)
for i in order:
    if done[i]: continue
    x, y, w, h = stats[i, :4]
    side = max(512, int(max(w, h) * 1.35))                         # a window round the hole (bigger holes: a bigger window, scaled to 512)
    cx, cy = x + w / 2, y + h / 2
    x0 = int(np.clip(cx - side / 2, 0, max(0, W - side))); y0 = int(np.clip(cy - side / 2, 0, max(0, H - side)))
    side_w = min(side, W); side_h = min(side, H)
    win = img[y0:y0 + side_h, x0:x0 + side_w]; wm = mask[y0:y0 + side_h, x0:x0 + side_w]
    a = cv2.resize(win, (512, 512), interpolation=cv2.INTER_AREA) / 255.0
    b = (cv2.resize(wm.astype(np.float32), (512, 512), interpolation=cv2.INTER_NEAREST) > 0).astype(np.float32)
    out = sess.run(None, {"image": a.transpose(2, 0, 1)[None].astype(np.float32), "mask": b[None, None]})[0][0].transpose(1, 2, 0)
    if out.max() <= 1.5: out = out * 255.0
    out = cv2.resize(np.clip(out, 0, 255), (side_w, side_h), interpolation=cv2.INTER_CUBIC)
    # paste back every hole that lies wholly inside this window
    sub = lab[y0:y0 + side_h, x0:x0 + side_w]
    for j in np.unique(sub):
        if j == 0 or done[j]: continue
        jx, jy, jw, jh = stats[j, :4]
        if jx >= x0 and jy >= y0 and jx + jw <= x0 + side_w and jy + jh <= y0 + side_h:
            sel = sub == j
            win[sel] = out[sel]; done[j] = True
            mask[y0:y0 + side_h, x0:x0 + side_w][sel] = False         # filled: from now on it is picture, not hole
    img[y0:y0 + side_h, x0:x0 + side_w] = win
    print("hole", i, "at", x, y, w, h, "window", x0, y0, side_w, flush=True)
Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(D + "/bg_clean.png")
print("left unfilled:", int(mask.sum()))
