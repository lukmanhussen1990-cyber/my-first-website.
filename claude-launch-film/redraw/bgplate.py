"""Clean background plates: remove the reference's foreground graphics from smooth light fields
with a harmonic (Laplace) fill. Fill is solved at 1/4 resolution (backgrounds are smooth) and the
full-resolution boundary is matched with a small correction solve.
usage: bgplate.py SCENE first last x0,y0,x1,y1[;x0,y0,x1,y1...] [--frames-rects JSON]"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

def fill_fast(im, mask, k=4):
    H, W = mask.shape
    small = cv2.resize(im, (W // k, H // k), interpolation=cv2.INTER_AREA)
    ms = cv2.resize(mask.astype(np.uint8), (W // k, H // k), interpolation=cv2.INTER_NEAREST).astype(bool)
    ms = cv2.dilate(ms.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    fs = harmonic_fill(small, ms)
    up = cv2.resize(fs, (W, H), interpolation=cv2.INTER_CUBIC)
    # correction: harmonic fill of the boundary mismatch (full res, cheap since it is smooth)
    resid = im - up
    resid[mask] = 0
    band = cv2.dilate(mask.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & ~mask
    r = np.zeros_like(im); r[band] = resid[band]
    corr = harmonic_fill(r * 0 + np.where(band[..., None], resid, 0), mask) if False else None
    out = im.copy()
    # blend: inside the mask use the upsampled fill plus a smoothly decaying boundary correction
    dist = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5)
    rb = cv2.GaussianBlur(np.where(band[..., None], resid, 0).astype(np.float32), (0, 0), 6)
    wb = cv2.GaussianBlur(band.astype(np.float32), (0, 0), 6)[..., None] + 1e-6
    rc = rb / wb
    fade = np.exp(-dist / 18.0)[..., None]
    out[mask] = (up + rc * fade)[mask]
    return out

if __name__ == '__main__':
    scene, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    rects = [tuple(map(int, r.split(','))) for r in sys.argv[4].split(';')]
    od = f'{S}/rd/plates/{scene}'; os.makedirs(od, exist_ok=True)
    for f in range(a, b + 1):
        im = load(f)
        m = np.zeros(im.shape[:2], bool)
        for x0, y0, x1, y1 in rects:
            m[y0:y1, x0:x1] = True
        out = fill_fast(im, m)
        cv2.imwrite(f'{od}/bg_{f:04d}.jpg', cv2.cvtColor(np.clip(out + 0.5, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 96])
    print('plates', a, b, '->', od)
