"""S07 plates: reference frames with the sidebar icons, zoom buttons, Done button (and the pointer
while it crosses the button) removed by harmonic fill; canonical rectangles mapped with the
tracked window homography."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from bgplate import fill_fast
a, b = int(sys.argv[1]), int(sys.argv[2])
Hw = {int(k): np.array(v) for k, v in json.load(open(f'{S}/rd/data/s07_Hwin.json'))['Hwin'].items()}
CUR = {int(k): v for k, v in json.load(open(f'{S}/rd/data/s07_cursor_draw.json')).items()}
RECTS = [(305, 130, 396, 950), (1500, 178, 1598, 384), (1384, 860, 1620, 978)]
od = f'{S}/rd/plates/S07_anatomy_viewer'; os.makedirs(od, exist_ok=True)
def quad(H, r):
    x0, y0, x1, y1 = r
    return cv2.perspectiveTransform(np.float32([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]).reshape(-1, 1, 2), H).reshape(-1, 2)
for f in range(a, b + 1):
    im = load(f)
    if f >= 718:
        out = im
    else:
        m = np.zeros(im.shape[:2], np.uint8)
        rects = list(RECTS)
        if f in CUR: x, y, _ = CUR[f]; rects.append((x - 6, y - 6, x + 42, y + 50))
        for r in rects:
            q = quad(Hw[f], r); mv = 0
            for g in (f - 1, f + 1):
                if g in Hw: mv = max(mv, np.abs(quad(Hw[g], r) - q).max())
            mm = np.zeros_like(m); cv2.fillPoly(mm, [np.round(q).astype(np.int32)], 255)
            k = int(2 + 0.4 * mv); m |= cv2.dilate(mm, np.ones((2 * k + 1, 2 * k + 1), np.uint8))
        out = fill_fast(im, m > 0)
    cv2.imwrite(f'{od}/bg_{f:04d}.jpg', cv2.cvtColor(np.clip(out + 0.5, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 95])
print('plates', a, b)
