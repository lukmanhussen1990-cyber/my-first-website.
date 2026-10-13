"""S09 plates: reference frames with the chat column (bubble, reply text, input) and the sidebar
icons removed by harmonic fill; rectangles are defined in canonical window coordinates and mapped
with the tracked window homography, grown by the frame's motion so blurred text is covered."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from bgplate import fill_fast
a, b = int(sys.argv[1]), int(sys.argv[2])
Hw = {int(k): np.array(v) for k, v in json.load(open(f'{S}/rd/data/s09_Hwin.json'))['Hwin'].items()}
RECTS = [(549, 219, 1031, 829), (467, 238, 541, 848)]
od = f'{S}/rd/plates/S09_anatomy_reply'; os.makedirs(od, exist_ok=True)
def quad(H, r):
    x0, y0, x1, y1 = r
    return cv2.perspectiveTransform(np.float32([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]).reshape(-1, 1, 2), H).reshape(-1, 2)
for f in range(a, b + 1):
    im = load(f)
    m = np.zeros(im.shape[:2], np.uint8)
    for r in RECTS:
        q = quad(Hw[f], r)
        # motion: corner displacement to the neighbouring frames (same shot)
        mv = 0
        for g in (f - 1, f + 1):
            if g in Hw and (g <= 897) == (f <= 897): mv = max(mv, np.abs(quad(Hw[g], r) - q).max())
        mm = np.zeros_like(m); cv2.fillPoly(mm, [np.round(q).astype(np.int32)], 255)
        k = int(2 + 0.5 * mv)
        mm = cv2.dilate(mm, np.ones((2 * k + 1, 2 * k + 1), np.uint8))
        m |= mm
    out = fill_fast(im, m > 0) if m.any() else im
    cv2.imwrite(f'{od}/bg_{f:04d}.jpg', cv2.cvtColor(np.clip(out + 0.5, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 95])
print('plates', a, b)
