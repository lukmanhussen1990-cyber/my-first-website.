"""Scale+translate tracker using a variance-floored normalised matched filter.

Plain TM_CCOEFF_NORMED returns ~1.0 on flat regions (denominator -> 0), which is
why naive multi-scale search locks onto black background. Here the local image
energy is clamped from below, so a featureless patch can never outscore real
structure.
"""
import cv2, numpy as np

def hp(img, sig=3.0):
    f = img.astype(np.float32) / 255.
    return f - cv2.GaussianBlur(f, (0, 0), sig)

def ncc_floored(img, tpl, floor_frac=0.15):
    """Correlate tpl over img. Returns response map."""
    th, tw = tpl.shape
    if th >= img.shape[0] or tw >= img.shape[1]:
        return None
    t0 = tpl - tpl.mean()
    tnorm = np.sqrt((t0 ** 2).sum())
    if tnorm < 1e-6:
        return None
    num = cv2.matchTemplate(img, t0, cv2.TM_CCORR)
    # local sum of img^2 over the template window
    ii = cv2.boxFilter(img ** 2, -1, (tw, th), normalize=False,
                       anchor=(0, 0), borderType=cv2.BORDER_ISOLATED)
    energy = ii[:num.shape[0], :num.shape[1]]
    # floor: a window must carry at least floor_frac of the template's own energy
    floor = floor_frac * (tnorm ** 2)
    denom = tnorm * np.sqrt(np.maximum(energy, floor))
    return num / np.maximum(denom, 1e-9)


class Tracker:
    def __init__(self, ref_gray, box):
        self.x0, self.y0, self.x1, self.y1 = box
        self.tpl = hp(ref_gray)[self.y0:self.y1, self.x0:self.x1]

    def _tpl_at(self, s, half):
        h, w = self.tpl.shape
        nw, nh = int(round(w * s * half)), int(round(h * s * half))
        if nw < 30 or nh < 8:
            return None
        interp = cv2.INTER_AREA if s * half < 1 else cv2.INTER_CUBIC
        return cv2.resize(self.tpl, (nw, nh), interpolation=interp)

    def search(self, img_hp, scales, half=1.0):
        best = None
        for s in scales:
            t = self._tpl_at(s, half)
            if t is None:
                continue
            r = ncc_floored(img_hp, t)
            if r is None:
                continue
            _, mx, _, ml = cv2.minMaxLoc(r)
            if best is None or mx > best[0]:
                best = (float(mx), ml[0] / half - self.x0 * s,
                        ml[1] / half - self.y0 * s, float(s))
        return best


if __name__ == '__main__':
    ref = cv2.imread('all/0144.png', cv2.IMREAD_GRAYSCALE)
    tr = Tracker(ref, (0, 170, 500, 250))
    # unit test: matching the reference against itself must give s=1, tx=ty=0
    b = tr.search(hp(ref), np.arange(0.20, 1.30, 0.01))
    print("self-match ->", f"score={b[0]:.3f} s={b[3]:.3f} tx={b[1]:.1f} ty={b[2]:.1f}")
    for fn in ['0078', '0100', '0120', '0160']:
        g = cv2.imread(f'all/{fn}.png', cv2.IMREAD_GRAYSCALE)
        b = tr.search(hp(g), np.arange(0.20, 1.30, 0.01))
        print(fn, f"score={b[0]:.3f} s={b[3]:.3f} tx={b[1]:.1f} ty={b[2]:.1f}")
