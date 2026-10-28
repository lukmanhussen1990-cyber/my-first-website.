"""Find the eye (white of the eye) in each face sprite and the skin colour around it, for the blinks
painted in code (public/sprites/eyes.json: sprite -> eye centre, eye size, skin colour)."""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

EP = Path(__file__).resolve().parent.parent
SP = EP / 'public' / 'sprites'
# sprite -> (threshold for "white", fraction of the height to search from the top)
FACES = {
    'kiss/jesus': (210, 0.5), 'kiss/judas': (210, 0.5),
    'jesus/side': (238, 0.45), 'jesus/stand': (238, 0.45), 'jesus/kiss_stand': (238, 0.45), 'jesus/robe_off': (238, 0.45),
    'jesus/towel_tie': (238, 0.45), 'jesus/pour': (238, 0.3), 'jesus/kneel_wash': (238, 0.45), 'jesus/kneel_lookup': (238, 0.45),
    'judas/side': (238, 0.45), 'judas/sit_stiff': (238, 0.45), 'judas/sit_away': (238, 0.45), 'judas/walk': (238, 0.45),
    'judas/lean': (238, 0.45), 'judas/palm': (238, 0.45), 'jesus/rig/head': (238, 0.8), 'judas/rig/head': (238, 0.8),
}


def main():
    out = {}
    for name, (thr, frac) in FACES.items():
        a = np.asarray(Image.open(SP / f'{name}.png').convert('RGBA')).astype(int)
        h, w = a.shape[:2]
        r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
        white = (r > thr) & (g > thr) & (b > thr - 15) & (al > 200) & (np.abs(r - g) < 18)
        white[int(h * frac):] = False
        n, lab, st, ce = cv2.connectedComponentsWithStats(white.astype(np.uint8), connectivity=8)
        cands = [i for i in range(1, n) if 15 < st[i][4] < 8000]
        i = max(cands, key=lambda k: st[k][4])
        x, y, ww, hh, _ = st[i]
        # the eye is the white plus the dark pupil beside it: grow the box a little
        cx, cy = x + ww / 2, y + hh / 2
        ew, eh = max(ww, hh) * 1.45, max(ww, hh) * 1.3
        # skin: the most common warm, mid-bright colour in a ring around the eye
        yy, xx = np.mgrid[0:h, 0:w]
        d = np.hypot((xx - cx) / ew, (yy - cy) / eh)
        ring = (d > 0.9) & (d < 1.8) & (al > 230) & (r > g + 20) & (r > 110) & (r + g + b > 280)
        skin = np.median(a[ring][:, :3], axis=0) if ring.sum() > 20 else np.array([170, 110, 70])
        out[name] = {'eye': [round(float(cx), 1), round(float(cy), 1)], 'size': [round(float(ew), 1), round(float(eh), 1)],
                     'skin': '#%02x%02x%02x' % tuple(int(v) for v in skin)}
        print(name, out[name])
    (SP / 'eyes.json').write_text(json.dumps(out, indent=1) + '\n')


if __name__ == '__main__':
    main()
