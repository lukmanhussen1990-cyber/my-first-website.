"""S11 f1091-1092: the S10 mini card is still faintly visible in the white mist. Swap its name to
Dr. Imran Hussain (font fitted per frame, verified badge slides to follow the shorter name) and neutralise
the old doctor's faint purple tie behind the text. Writes bgi_1091/1092."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from textr import render
OLD, NEW = 'Dr Abhishek Shukla', 'Dr. Imran Hussain'
U = 4
for f in (1091, 1092):
    im = cv2.imread(f'{S}/rd/plates/S11_profile_outcome/bg_{f:04d}.jpg').astype(np.float32)
    g = im.mean(2)
    x0, y0, x1, y1 = 800, 612, 1035, 672
    crop = g[y0:y1, x0:x1]; cu = cv2.resize(crop, None, fx=U, fy=U, interpolation=cv2.INTER_CUBIC)
    best = None
    for w in (500, 600, 700):
        items = [dict(text=OLD, weight=w, size=float(s), W=260, H=50, x=3, base=36) for s in np.arange(15, 21.01, 0.25)]
        for it, (a, adv) in zip(items, render(items, U)):
            ys, xs = np.nonzero(a > 0.02); m0 = 3 * U
            ty0, tx0 = max(0, ys.min() - m0), max(0, xs.min() - m0)
            for sg in (0.8, 1.4, 2.2, 3.2):
                t = cv2.GaussianBlur(a, (0, 0), sg * U)[ty0:ys.max() + m0, tx0:xs.max() + m0]
                if t.shape[0] > cu.shape[0] or t.shape[1] > cu.shape[1]: continue
                mm = cv2.matchTemplate(cu, -t, cv2.TM_CCOEFF_NORMED); _, v, _, loc = cv2.minMaxLoc(mm)
                if best is None or v > best[0]:
                    best = (v, w, it['size'], sg, x0 + (loc[0] - tx0 + 3 * U) / U, y0 + (loc[1] - ty0 + 36 * U) / U, adv)
    v, w, size, sg, ox, ob, adv_old = best
    print(f, 'fit', round(v, 3), w, size, sg, round(ox, 2), round(ob, 2))
    # render old/new at frame resolution (K=1 canvas over the whole frame region)
    def ta(text, x):
        a, adv = render([dict(text=text, weight=w, size=size, W=1920, H=1080, x=x, base=ob)], 1)[0]
        return cv2.GaussianBlur(a, (0, 0), sg), adv
    ao, _ = ta(OLD, ox); an, adv_new = ta(NEW, ox)
    d = adv_new - adv_old
    # badge right after the old name: a small square region
    bx0 = ox + adv_old + 2; badge = np.zeros(g.shape, bool); badge[int(ob - size * 0.95):int(ob + 6), int(bx0):int(bx0 + size * 2.1)] = True
    kill = cv2.dilate((ao > 0.02).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) | badge
    F = harmonic_fill(im.copy(), kill)
    m = ao > 0.01; aa = ao[m][:, None]
    ink = np.median(F[m], 0) + (aa * (im[m] - F[m])).sum(0) / (aa * aa).sum()
    D = (im - F) * badge[..., None]
    out = F + cv2.warpAffine(D, np.float32([[1, 0, d], [0, 1, 0]]), (1920, 1080), flags=cv2.INTER_LINEAR)
    out = out * (1 - an[..., None]) + ink[None, None, :] * an[..., None]
    # the old doctor's tie shows faintly through the card: pull saturated pink/purple toward the local grey
    reg = np.zeros(g.shape, bool); reg[540:700, 865:1070] = True
    hsv = cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    tie = reg & (hsv[..., 1] > 10) & ((hsv[..., 0] > 128) | (hsv[..., 0] < 12))
    tie = cv2.GaussianBlur(cv2.dilate(tie.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(np.float32), (0, 0), 3)
    grey = cv2.GaussianBlur(out, (0, 0), 9).mean(2, keepdims=True) * np.ones((1, 1, 3), np.float32)
    lum = out.mean(2, keepdims=True)
    out = out * (1 - tie[..., None]) + (0.5 * lum + 0.5 * grey + 6) * tie[..., None]
    cv2.imwrite(f'{S}/rd/plates/S11_profile_outcome/bgi_{f:04d}.jpg', np.clip(out + 0.5, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 97])
    print(f, 'ink', np.round(ink).tolist(), 'badge shift', round(d, 2), 'tie px', int((tie > 0.5).sum()))
