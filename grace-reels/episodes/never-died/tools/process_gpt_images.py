"""Cut the GPT Image sheets into clean, named sprites for the Remotion project.

For each sheet in assets/gpt/: tidy the alpha (the "opaque" pixels come in at 250-254 and there is a
near-invisible alpha≈3 haze around figures), bleed edge colors into transparent pixels so texture
filtering never pulls in the hidden dark glow, then save every piece to public/sprites/<char>/<name>.png
plus public/sprites/sprites.json (size, source box, foot point).

Run: python tools/process_gpt_images.py   (needs numpy, pillow, opencv-python-headless, scipy)
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

EP = Path(__file__).resolve().parent.parent
SRC = EP / 'assets' / 'gpt'
OUT = EP / 'public' / 'sprites'

# Piece name -> approximate center (x, y) on its sheet; each component is matched to the nearest center.
SHEETS = {
    'char_elijah_turnaround': ('elijah', {'side': (217, 508), 'threequarter': (739, 509), 'back': (1285, 504)}),
    'char_elijah_parts': ('elijah', {
        'head': (359, 168), 'hair': (638, 201), 'beard': (914, 231), 'torso': (235, 600),
        'arm_upper_a': (495, 489), 'arm_upper_b': (664, 493), 'forearm_a': (845, 475), 'forearm_b': (1012, 481),
        'cloak': (1284, 621), 'leg_a': (630, 806), 'leg_b': (894, 803)}),
    'char_elijah_poses': ('elijah', {
        'pose_walk': (190, 400), 'pose_point': (551, 407), 'pose_lookup': (867, 408),
        'pose_rise': (208, 1087), 'pose_kneel': (492, 1202), 'pose_bend': (840, 1231)}),
    'char_elisha_turnaround': ('elisha', {'side': (271, 510), 'threequarter': (751, 513), 'back': (1249, 510)}),
    'char_elisha_poses': ('elisha', {
        'pose_walk': (180, 379), 'pose_talk': (542, 382), 'pose_cry': (865, 382),
        'pose_reach': (200, 1105), 'pose_kneel': (470, 1198), 'pose_pickup': (823, 1246)}),
    'char_enoch_turnaround': ('enoch', {'side': (277, 507), 'threequarter': (734, 510), 'back': (1235, 506)}),
    'char_enoch_parts': ('enoch', {
        'head': (187, 204), 'torso': (667, 503), 'arm_upper_a': (930, 283), 'arm_upper_b': (1105, 286),
        'forearm_a': (1281, 295), 'forearm_b': (1439, 293), 'sash': (350, 626), 'beard': (423, 258),
        'leg_a': (1059, 733), 'leg_b': (1335, 732)}),
}
# Paired limbs: the darker piece of each pair is the far-side limb.
PAIRS = [('arm_upper_a', 'arm_upper_b', 'arm_upper'), ('forearm_a', 'forearm_b', 'forearm'), ('leg_a', 'leg_b', 'leg')]
PAD = 12


def clean_alpha(alpha):
    a = alpha.astype(np.float32)
    a = np.clip((a - 12.0) / (245.0 - 12.0), 0.0, 1.0)
    return (a * 255.0 + 0.5).astype(np.uint8)


def bleed(rgb, alpha):
    """Give transparent pixels the color of the nearest solid pixel (no dark fringes when filtered)."""
    solid = alpha >= 128
    _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
    out = rgb[iy, ix]
    out[solid] = rgb[solid]
    return out


def luminance(rgb, alpha):
    m = alpha >= 200
    return float((rgb[m] @ np.array([0.2126, 0.7152, 0.0722])).mean())


def main():
    meta = {}
    for sheet, (char, pieces) in SHEETS.items():
        rgba = np.asarray(Image.open(SRC / f'{sheet}.png').convert('RGBA'))
        rgb, alpha = rgba[..., :3].copy(), clean_alpha(rgba[..., 3])
        n, lab, stats, cent = cv2.connectedComponentsWithStats((alpha >= 16).astype(np.uint8), connectivity=8)
        comps = [i for i in range(1, n) if stats[i][4] > 300]
        assert len(comps) == len(pieces), f'{sheet}: {len(comps)} components, expected {len(pieces)}'
        names = {}
        for name, (cx, cy) in pieces.items():
            best = min(comps, key=lambda i: (cent[i][0] - cx) ** 2 + (cent[i][1] - cy) ** 2)
            assert best not in names.values(), f'{sheet}: two names matched component {best}'
            names[name] = best
        crops = {}
        for name, i in names.items():
            x, y, w, h, _ = stats[i]
            x0, y0 = max(0, x - PAD), max(0, y - PAD)
            x1, y1 = min(rgb.shape[1], x + w + PAD), min(rgb.shape[0], y + h + PAD)
            own = ndimage.binary_dilation(lab[y0:y1, x0:x1] == i, iterations=3)
            a = np.where(own, alpha[y0:y1, x0:x1], 0).astype(np.uint8)
            c = bleed(rgb[y0:y1, x0:x1], a)
            crops[name] = (c, a, (int(x0), int(y0), int(x1 - x0), int(y1 - y0)))
        for a_name, b_name, base in PAIRS:
            if a_name in crops:
                la, lb = luminance(crops[a_name][0], crops[a_name][1]), luminance(crops[b_name][0], crops[b_name][1])
                near, far = (a_name, b_name) if la >= lb else (b_name, a_name)
                crops[f'{base}_near'] = crops.pop(near)
                crops[f'{base}_far'] = crops.pop(far)
        for name, (c, a, box) in crops.items():
            d = OUT / char
            d.mkdir(parents=True, exist_ok=True)
            Image.fromarray(np.dstack([c, a])).save(d / f'{name}.png', optimize=True)
            ys, xs = np.nonzero(a >= 128)
            bottom = ys.max()
            foot_x = float(xs[ys >= bottom - 6].mean())
            meta[f'{char}/{name}'] = {
                'file': f'sprites/{char}/{name}.png', 'w': box[2], 'h': box[3], 'sheet': sheet,
                'sheetBox': list(box), 'foot': [round(foot_x, 1), int(bottom)], 'top': int(ys.min()),
            }
        print(sheet, '->', ', '.join(sorted(n for n in crops)))
    (OUT / 'sprites.json').write_text(json.dumps(meta, indent=1) + '\n')
    print(len(meta), 'sprites written to', OUT)


if __name__ == '__main__':
    main()
