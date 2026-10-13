"""S06 plates: reference frames with the chat pill removed on the dark side of the footage wipe.
The pill is a rigid layer centred at x = 960 (scale s, centre y cy). Left of the wipe's blur zone
(xl) the pill is filled harmonically from a mirrored copy of the dark side, so the bright footage
never bleeds in; inside the blur zone (xl..xr) each row is rebuilt as the measured edge ramp between
the filled dark side and the footage."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from bgplate import fill_fast
a, b = int(sys.argv[1]), int(sys.argv[2])
G = json.load(open(f'{S}/rd/data/s06_geom.json'))
od = f'{S}/rd/plates/S06_typing_input'; os.makedirs(od, exist_ok=True)
for f in range(a, b + 1):
    im = load(f)
    g = G[str(f)]
    left, cy, s = g['left'], g['cy'], g['s']
    xl, xr = g.get('xl', g['xe']), g.get('xr', g['xe'])
    out = im
    if xr > left - 14:
        hh = 88.5 * s
        x0, x1 = int(left - 16), int(1920 - left + 16)
        y0, y1 = int(cy - hh - 18), int(cy + hh + 16)
        work = im.copy(); m = np.zeros(im.shape[:2], bool)
        cut = xl - 1
        if xl < 1920:
            w = max(1, cut - x0)
            for k in range(1, w + 1):
                if cut + k < 1920: work[:, cut + k] = im[:, cut - k]
            m[y0:y1, x0:min(1920, cut + w + 1)] = True
        else:
            m[y0:y1, x0:x1] = True
        fl = fill_fast(work, m)
        out = im.copy()
        lim = cut + 1 if xl < 1920 else 1920
        out[:, :lim] = fl[:, :lim]
        if xl < 1920 and xr >= xl:
            # blur zone: harmonic fill from all four sides (dark fill, footage, blurred rows above/below)
            ya, yb, xa, xb = y0 - 2, y1 + 2, xl - 2, min(1920, xr + 3)
            crop = out[ya:yb, xa:xb].copy(); mk = np.zeros(crop.shape[:2], bool); mk[2:-2, 2:-1] = True
            out[ya:yb, xa:xb] = harmonic_fill(crop, mk)
    cv2.imwrite(f'{od}/bg_{f:04d}.jpg', cv2.cvtColor(np.clip(out + 0.5, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 96])
print('plates', a, b, '->', od)
