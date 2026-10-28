"""Cut the GPT Image sheets for "The Face of God" into clean, named sprites for the Remotion project.

For each sheet in assets/gpt/ that is listed in SHEETS and present:
- if it has no real transparency (the magenta fallback), key out the #FF00FF background and remove the
  magenta spill from the edges;
- tidy the alpha (opaque pixels arrive at 250-254 and there is a near-invisible alpha~3 haze);
- split it into its figures: each piece takes the biggest connected part at its spot on the sheet, and
  every smaller part (a loose strand of hair, a staff lying on the ground) joins the nearest piece;
- bleed edge colors into transparent pixels so texture filtering never pulls in a dark or pink fringe;
- save public/sprites/<group>/<name>.png and public/sprites/sprites.json (size, source box, foot point).
Sheets that are not there yet are skipped, so this can be re-run as images arrive.

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

# sheet -> (group, {piece: (x, y) on the sheet, inside the piece})
SHEETS = {
    'char_moses_turnaround': ('moses', {'side': (256, 512), 'threequarter': (768, 512), 'back': (1280, 512)}),
    'char_moses_poses_a': ('moses', {'raise': (263, 421), 'shield': (781, 458), 'kneel_ask': (256, 1166), 'bow': (770, 1234)}),
    'char_moses_poses_b': ('moses', {'press': (282, 374), 'peek': (762, 378), 'tablets_walk': (280, 1125), 'veil': (760, 1096)}),
    'char_moses_parts': ('moses/rig', {
        'head': (144, 249), 'hair': (373, 271), 'beard': (639, 346), 'torso': (891, 350), 'hem': (236, 728), 'sash': (547, 705),
        'arm_upper_a': (1105, 245), 'arm_upper_b': (1292, 244), 'forearm_a': (1136, 498), 'forearm_b': (1304, 498),
        'leg_a': (801, 772), 'leg_b': (1010, 774), 'staff': (1453, 481)}),
    'char_moses_glowing': ('moses', {'bust_glow': (300, 500), 'bust': (850, 500), 'walk_glow': (1329, 593)}),
    'char_aaron': ('aaron', {'side': (160, 530), 'threequarter': (529, 525), 'step_back': (927, 541), 'turn_away': (1350, 538)}),
    'char_israelites_group1': ('people', {'man': (180, 505), 'woman': (468, 531), 'old_man': (769, 536), 'mother_girl': (1143, 573),
                                          'boy': (1430, 577)}),
    'char_israelites_group2': ('people', {'man_walk': (128, 512), 'woman_walk': (384, 512), 'old_man_walk': (640, 512),
                                          'mother_walk': (896, 512), 'girl_skip': (1152, 512), 'boy_walk': (1408, 512)}),
    'char_jesus_poses_c': ('jesus', {'sit_chest': (256, 384), 'front_welcome': (768, 384), 'kneel_open': (256, 1152),
                                     'kneel_hug': (768, 1152)}),
    'char_philip': ('philip', {'ask': (384, 512), 'listen': (1152, 512)}),
}
# Paired limbs: the darker piece of each pair is the far-side limb.
PAIRS = [('arm_upper_a', 'arm_upper_b', 'arm_upper'), ('forearm_a', 'forearm_b', 'forearm'), ('leg_a', 'leg_b', 'leg')]
PAD = 12
SPECK = 200  # parts smaller than this, far from every piece, are dropped as specks


def split_busts(lab, rgb, alpha):
    """The two close-ups of the shining face touch: the glowing bust's beard lies over the hair and robe
    of the plain one. Cut each row just right of the beard's outline (or in the gap where they don't
    touch), so the outline stays with the beard."""
    big = 1 + int(np.argmax(ndimage.sum(np.ones_like(lab), lab, range(1, lab.max() + 1))))
    f = rgb.astype(np.int32)
    lum = f @ np.array([299, 587, 114]) // 1000
    # the plain bust's hair has warm highlights too, so keep only the bright warm area joined to the beard
    warm, _ = ndimage.label((lum > 170) & (f[..., 0] - f[..., 2] > 35) & (lab == big), structure=np.ones((3, 3)))
    beard = warm == warm[650, 480]
    # the outline is a dark, nearly grey brown; the robe's shadow is as dark but much redder
    line = (lum < 75) & (f[..., 0] - f[..., 1] < 40)
    rows = np.nonzero((lab == big).any(axis=1))[0]
    cut = {}
    for y in rows:
        xs = np.nonzero(lab[y] == big)[0]
        xs = xs[(xs >= 400) & (xs <= 760)]
        gaps = np.nonzero(np.diff(xs) > 1)[0] if len(xs) else []
        if len(xs) == 0:
            cut[y] = 580
        elif len(gaps):
            g = max(gaps, key=lambda i: xs[i + 1] - xs[i])
            cut[y] = (xs[g] + xs[g + 1]) // 2
        else:
            bx = np.nonzero(beard[y, 400:700])[0]
            if not len(bx):
                cut[y] = cut.get(y - 1, 580)
                continue
            x = x0 = 400 + bx.max()
            while x < x0 + 10 and not line[y, x]:
                x += 1
            x1 = x
            while x < x1 + 12 and line[y, x]:
                x += 1
            cut[y] = x
    ys = np.array(sorted(cut))
    cs = ndimage.median_filter(np.array([cut[y] for y in ys]), size=5, mode='nearest')
    edge = np.full(lab.shape[0], 580)
    edge[ys] = cs
    xx = np.arange(lab.shape[1])[None, :]
    right = (lab == big) & (xx > edge[:, None])
    lab = lab.copy()
    lab[right] = lab.max() + 1
    # bits the cut left loose become parts of their own, so they join the nearest piece or drop as specks
    for side in (big, lab.max()):
        bits, n = ndimage.label(lab == side, structure=np.ones((3, 3)))
        if n > 1:
            sizes = ndimage.sum(np.ones_like(bits), bits, range(1, n + 1))
            for i in range(1, n + 1):
                if i != 1 + int(np.argmax(sizes)):
                    lab[bits == i] = lab.max() + 1
    return lab


SPLIT = {'char_moses_glowing': split_busts}


def key_magenta(rgb):
    """Alpha from distance to #FF00FF, then pull the magenta tint out of the edge pixels."""
    f = rgb.astype(np.float32) / 255.0
    mag = np.array([1.0, 0.0, 1.0], np.float32)
    # magenta-ness: high red and blue, low green
    m = np.clip((np.minimum(f[..., 0], f[..., 2]) - f[..., 1] - 0.25) / 0.45, 0, 1)
    alpha = 1.0 - m
    # despill: where the pixel is partly magenta, remove that share of magenta from its colour
    k = (1.0 - alpha)[..., None]
    clean = np.clip((f - mag * k) / np.maximum(alpha[..., None], 1e-3), 0, 1)
    clean = np.where(alpha[..., None] > 0.02, clean, f)
    return (clean * 255 + 0.5).astype(np.uint8), (alpha * 255 + 0.5).astype(np.uint8)


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


def load(sheet):
    rgba = np.asarray(Image.open(SRC / f'{sheet}.png').convert('RGBA'))
    rgb, alpha = rgba[..., :3].copy(), rgba[..., 3]
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]).astype(int)
    magenta_border = np.mean((border[:, 0] > 200) & (border[:, 2] > 200) & (border[:, 1] < 80)) > 0.6
    if alpha.min() > 250 and magenta_border:
        rgb, alpha = key_magenta(rgb)
        return rgb, alpha, 'magenta key'
    return rgb, clean_alpha(alpha), 'alpha'


def assign(lab, pieces):
    """piece name -> mask. Each piece takes the biggest part under its spot (or the nearest part), every
    other part joins the piece it is closest to, and far-away specks are dropped."""
    n = int(lab.max()) + 1
    area = ndimage.sum(np.ones_like(lab), lab, range(n))
    boxes = ndimage.find_objects(lab)
    cent = ndimage.center_of_mass(np.ones_like(lab), lab, range(1, n))
    main = {}
    for name, (px, py) in pieces.items():
        inside = [i for i in range(1, n) if boxes[i - 1] is not None and area[i] > SPECK
                  and boxes[i - 1][0].start <= py < boxes[i - 1][0].stop and boxes[i - 1][1].start <= px < boxes[i - 1][1].stop]
        if inside:
            best = max(inside, key=lambda i: area[i])
        else:
            best = min((i for i in range(1, n) if area[i] > SPECK),
                       key=lambda i: (cent[i - 1][1] - px) ** 2 + (cent[i - 1][0] - py) ** 2)
        assert best not in main.values(), f'two pieces share part {best}: check the spots in SHEETS'
        main[name] = best
    dist = {name: ndimage.distance_transform_edt(lab != i) for name, i in main.items()}
    masks = {name: lab == i for name, i in main.items()}
    for i in range(1, n):
        if i in main.values() or area[i] == 0:
            continue
        part = lab == i
        d = {name: float(dm[part].min()) for name, dm in dist.items()}
        near = min(d, key=d.get)
        if area[i] < SPECK and d[near] > 40:
            continue
        masks[near] |= part
    return masks


def main():
    meta = {}
    for sheet, (group, pieces) in SHEETS.items():
        if not (SRC / f'{sheet}.png').exists():
            print(sheet, ': not uploaded yet')
            continue
        rgb, alpha, how = load(sheet)
        lab, _ = ndimage.label(alpha >= 16, structure=np.ones((3, 3)))
        if sheet in SPLIT:
            lab = SPLIT[sheet](lab, rgb, alpha)
        masks = assign(lab, pieces)
        crops = {}
        for name, m in masks.items():
            ys, xs = np.nonzero(m)
            x0, y0 = max(0, xs.min() - PAD), max(0, ys.min() - PAD)
            x1, y1 = min(rgb.shape[1], xs.max() + 1 + PAD), min(rgb.shape[0], ys.max() + 1 + PAD)
            others = np.zeros_like(m)
            for other, om in masks.items():
                if other != name:
                    others |= om
            own = ndimage.binary_dilation(m[y0:y1, x0:x1], iterations=3) & ~others[y0:y1, x0:x1]
            a = np.where(own, alpha[y0:y1, x0:x1], 0).astype(np.uint8)
            c = bleed(rgb[y0:y1, x0:x1], a)
            crops[name] = (c, a, (int(x0), int(y0), int(x1 - x0), int(y1 - y0)))
        for a_name, b_name, base in PAIRS:
            if a_name in crops:
                la, lb = luminance(*crops[a_name][:2]), luminance(*crops[b_name][:2])
                near, far = (a_name, b_name) if la >= lb else (b_name, a_name)
                crops[f'{base}_near'] = crops.pop(near)
                crops[f'{base}_far'] = crops.pop(far)
        for name, (c, a, box) in crops.items():
            d = OUT / group
            d.mkdir(parents=True, exist_ok=True)
            Image.fromarray(np.dstack([c, a])).save(d / f'{name}.png', optimize=True)
            ys, xs = np.nonzero(a >= 128)
            bottom = ys.max()
            meta[f'{group}/{name}'] = {
                'file': f'sprites/{group}/{name}.png', 'w': box[2], 'h': box[3], 'sheet': sheet, 'sheetBox': list(box),
                'foot': [round(float(xs[ys >= bottom - 6].mean()), 1), int(bottom)], 'top': int(ys.min()),
            }
        print(f'{sheet} ({how}) ->', ', '.join(sorted(crops)))
    (OUT / 'sprites.json').write_text(json.dumps(meta, indent=1) + '\n')
    print(len(meta), 'sprites written to', OUT)


if __name__ == '__main__':
    main()
