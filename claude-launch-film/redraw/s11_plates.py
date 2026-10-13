"""S11 plates: the name-change frames (reference footage with the Claude sidebar label) with the
'Right outcome' title removed: its ink (darker / more saturated than the lavender field) above the
window's top edge is grown and filled harmonically."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from bgplate import fill_fast
a, b = int(sys.argv[1]), int(sys.argv[2])
TOP = {int(k): v for k, v in json.load(open(f'{S}/rd/data/s11_wintop.json')).items()}
od = f'{S}/rd/plates/S11_profile_outcome'; os.makedirs(od, exist_ok=True)
for f in range(a, b + 1):
    im = cv2.cvtColor(cv2.imread(f'{S}/final_edit/f{f:04d}.png'), cv2.COLOR_BGR2RGB).astype(np.float32)
    out = im
    if f >= 1126:
        ref = load(f)
        bg = cv2.GaussianBlur(ref, (0, 0), 30); d = (bg - ref).mean(2)
        mx, mn = ref.max(2), ref.min(2)
        ink = (d > 10) | ((mx - mn) > 120)
        lim = TOP[f] - 1
        m = np.zeros(ink.shape, np.uint8)
        m[100:lim, 300:1680] = ink[100:lim, 300:1680]
        m = cv2.dilate(m, np.ones((25, 25), np.uint8))
        if f <= 1137: m[100:lim, 480:1050] = 255      # faint, blurred 'Right' while it drops in
        if 1134 <= f <= 1140: m[100:lim, 480:1470] = 255   # 'outcome' blurring in
        m[lim:] = 0
        if m.any(): out = fill_fast(im, m > 0)
    cv2.imwrite(f'{od}/bg_{f:04d}.jpg', cv2.cvtColor(np.clip(out + 0.5, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 95])
print('plates', a, b)
