"""Find the eye in each face sprite and the skin colour around it, for the blinks painted in code
(public/sprites/eyes.json: sprite -> eye centre, eye size, skin colour).

Moses has white hair, a white beard and white eyebrows, so white alone is not enough. The white of the
eye is an off-white patch that is mostly ringed by skin and has the near-black pupil inside or right
beside it; hair and beard touch the background and the outline instead, and the eyebrow has no pupil.
Writes a check sheet with the boxes to the folder given as the first argument (optional).

Run: python tools/find_eyes.py [check_dir]   (needs numpy, pillow, opencv-python-headless)
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

EP = Path(__file__).resolve().parent.parent
SP = EP / 'public' / 'sprites'
# sprite -> part of the sprite to search: (x0, y0, x1, y1) as fractions of the width and height
FACES = {
    'moses/raise': (0.3, 0.0, 0.8, 0.3), 'moses/shield': (0.4, 0.0, 0.9, 0.3), 'moses/kneel_ask': (0.3, 0.0, 0.8, 0.35),
    'moses/press': (0.3, 0.0, 0.8, 0.3), 'moses/peek': (0.5, 0.0, 1.0, 0.3), 'moses/tablets_walk': (0.3, 0.0, 0.9, 0.3),
    'moses/walk_glow': (0.4, 0.0, 1.0, 0.3), 'moses/bust': (0.3, 0.05, 0.9, 0.45), 'moses/bust_glow': (0.3, 0.05, 0.9, 0.45),
    'aaron/side': (0.3, 0.0, 1.0, 0.3), 'aaron/threequarter': (0.3, 0.0, 1.0, 0.3), 'aaron/step_back': (0.3, 0.0, 1.0, 0.35),
    'jesus/closeup': (0.0, 0.1, 0.6, 0.45), 'jesus/threequarter': (0.2, 0.0, 0.9, 0.25),
}


def find(a, box):
    h, w = a.shape[:2]
    r, g, b, al = (a[..., k].astype(int) for k in range(4))
    x0, y0, x1, y1 = int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)
    roi = np.zeros((h, w), bool)
    roi[y0:y1, x0:x1] = True
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    offwhite = ((mn > 200) & (mx - mn < 40) & (al > 200) & roi).astype(np.uint8)
    skin = (r > g + 18) & (r > 100) & (r + g + b > 230) & (r + g + b < 640) & (al > 200)
    pupil = (mx < 36) & (al > 200)
    n, lab, st, _ = cv2.connectedComponentsWithStats(offwhite, connectivity=8)
    best, score = None, 0.0
    for i in range(1, n):
        x, y, bw, bh, area = st[i]
        if area < 10 or area > 4000:
            continue
        comp = (lab == i).astype(np.uint8)
        ring = (cv2.dilate(comp, np.ones((5, 5), np.uint8)) > 0) & (comp == 0)
        sk = skin[ring].mean()
        dark = pupil[max(0, y - 3):y + bh + 3, max(0, x - 3):x + bw + 3].sum()
        s = sk * min(dark, 40)
        if dark >= 4 and sk > 0.15 and s > score:
            best, score = (x, y, bw, bh), s
    if best is None:
        return None
    x, y, bw, bh = best
    ecx, ecy = x + bw / 2, y + bh / 2
    ew, eh = bw * 1.35 + 4, bh * 1.3 + 4
    yy, xx = np.ogrid[:h, :w]
    dd = np.hypot((xx - ecx) / ew, (yy - ecy) / eh)
    ring = (dd > 0.9) & (dd < 2.0) & (al > 230) & (r > g + 20) & (r > 110) & (r + g + b > 280)
    skin_c = np.median(a[ring][:, :3], axis=0) if ring.sum() > 20 else np.array([170, 110, 70])
    return {'eye': [round(float(ecx), 1), round(float(ecy), 1)], 'size': [round(float(ew), 1), round(float(eh), 1)],
            'skin': '#%02x%02x%02x' % tuple(int(v) for v in skin_c)}


def main():
    check = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    out, crops = {}, []
    for name, box in FACES.items():
        a = np.asarray(Image.open(SP / f'{name}.png').convert('RGBA'))
        e = find(a, box)
        if not e:
            print(name, ': no eye found')
            continue
        out[name] = e
        print(name, e)
        if check:
            bg = Image.new('RGBA', (a.shape[1], a.shape[0]), (90, 140, 200, 255))
            bg.alpha_composite(Image.fromarray(a))
            dr = ImageDraw.Draw(bg)
            (cx, cy), (ew, eh) = e['eye'], e['size']
            dr.rectangle([cx - ew / 2, cy - eh / 2, cx + ew / 2, cy + eh / 2], outline=(255, 0, 0, 255), width=2)
            s = 3
            crops.append(bg.crop((int(cx - ew * s), int(cy - eh * s), int(cx + ew * s), int(cy + eh * s))).resize((180, 180)))
    (SP / 'eyes.json').write_text(json.dumps(out, indent=1) + '\n')
    if check and crops:
        sheet = Image.new('RGB', (190 * len(crops), 190), (20, 20, 20))
        for k, c in enumerate(crops):
            sheet.paste(c.convert('RGB'), (k * 190, 5))
        check.mkdir(parents=True, exist_ok=True)
        sheet.save(check / 'eyes_check.png')


if __name__ == '__main__':
    main()
