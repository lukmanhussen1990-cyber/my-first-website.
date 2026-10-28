"""Cut the GPT Image sheets for "Friend" into clean, named sprites for the Remotion project.

For each sheet in assets/gpt/ that is listed in SHEETS and present:
- if it has no real transparency (the magenta fallback), key out the #FF00FF background and remove the
  magenta spill from the edges;
- tidy the alpha (opaque pixels arrive at 250-254 and there is a near-invisible alpha~3 haze);
- split it into its separate figures (connected components), match each to a piece name by position;
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

# sheet -> (group, {piece: approximate center (x, y) on the sheet})
SHEETS = {
    'char_jesus_turnaround': ('jesus', {'side': (252, 538), 'threequarter': (736, 531), 'back': (1264, 518)}),
    'char_judas_turnaround': ('judas', {'side': (290, 535), 'threequarter': (750, 532), 'back': (1250, 525)}),
    'key_kiss_closeup': ('kiss', {'judas': (500, 625), 'jesus': (1208, 577)}),
    'char_jesus_poses_a': ('jesus', {'stand': (252, 389), 'robe_off': (742, 402), 'towel_tie': (255, 1120), 'pour': (715, 1135)}),
    'char_jesus_poses_b': ('jesus', {'kneel_wash': (293, 375), 'kneel_lookup': (743, 382), 'kiss_stand': (236, 1060), 'laugh_sit': (688, 1180)}),
    'char_judas_poses': ('judas', {'sit_stiff': (168, 484), 'sit_away': (535, 489), 'palm': (832, 385), 'walk': (257, 1127), 'lean': (719, 1104)}),
    'char_disciples_seated': ('disciples', {
        'd1': (152, 298), 'd2': (474, 304), 'd3': (778, 312), 'd4': (1086, 304), 'd5': (1386, 303),
        'd6': (197, 793), 'd7': (566, 800), 'd8': (951, 805), 'd9': (1329, 792)}),
    'prop_washing_kit': ('props', {'basin_top': (408, 216), 'basin_side': (1138, 243), 'jug': (226, 668), 'jug_tilt': (634, 642),
                                   'towel_hang': (1010, 687), 'towel_fold': (1331, 641)}),
    'prop_coins': ('props', {'coin_face': (209, 233), 'coin_edge': (511, 233), 'coin_tilt': (795, 235), 'coin_stack': (1256, 253),
                             'coin_pile': (331, 750), 'pouch': (841, 721), 'pouch_open': (1275, 750)}),
    'prop_table_set': ('props', {'table': (760, 344), 'wine_jug': (813, 746), 'bread': (211, 807), 'cushion': (1236, 800), 'cup': (537, 799)}),
    'char_jesus_parts': ('jesus/rig', {
        'head': (155, 162), 'hair': (416, 167), 'beard': (671, 260), 'torso': (922, 392), 'mantle': (1277, 312), 'hem': (899, 811),
        'arm_upper_a': (225, 504), 'arm_upper_b': (548, 504), 'forearm_a': (212, 796), 'forearm_b': (563, 799),
        'leg_a': (1203, 805), 'leg_b': (1398, 796)}),
    'char_judas_parts': ('judas/rig', {
        'head': (165, 173), 'hair': (451, 132), 'beard': (556, 278), 'torso': (810, 365), 'hem': (817, 796),
        'arm_upper_a': (1150, 160), 'arm_upper_b': (1384, 160), 'forearm_a': (1149, 429), 'forearm_b': (1400, 429),
        'leg_a': (1158, 792), 'leg_b': (1396, 794)}),
    'char_crowd_torches': ('crowd', {'torch1': (280, 271), 'staff1': (784, 293), 'sword1': (1254, 290), 'staff2': (304, 783),
                                     'torch2': (812, 769), 'sword2': (1267, 779)}),
    'char_feast_guests': ('guests', {'g1': (280, 308), 'g2': (796, 300), 'g3': (1290, 303), 'g4': (266, 823), 'g5': (786, 775), 'g6': (1328, 835)}),
    'prop_scale_chain': ('props', {'scale': (396, 491), 'beam': (1147, 363), 'chain': (917, 774), 'tag': (1381, 807)}),
    'prop_hands_coins': ('props', {'hand_ring': (341, 399), 'hand_judas': (1252, 673)}),
    'prop_lamps': ('props', {'lamp1': (254, 578), 'lamp2': (643, 581), 'lamp3': (1010, 581), 'lamp_stand': (1336, 506)}),
    'prop_torches_weapons': ('props', {'torch_a': (324, 392), 'torch_b': (651, 472), 'staff': (954, 495), 'sword': (1264, 596)}),
    'bg_room_near': ('room', {'pillar': (210, 514), 'hanging_lamp': (786, 384), 'jar': (1246, 390), 'cushions': (589, 817),
                              'stool': (1005, 809), 'basket': (1365, 838)}),
    'bg_feast_near': ('feast', {'pitcher': (759, 251), 'fruit_bowl': (300, 250), 'sapling': (250, 760), 'bread_basket': (1233, 286),
                                'vine': (1195, 659), 'cushions': (722, 832)}),
}
# Paired limbs: the darker piece of each pair is the far-side limb.
PAIRS = [('arm_upper_a', 'arm_upper_b', 'arm_upper'), ('forearm_a', 'forearm_b', 'forearm'), ('leg_a', 'leg_b', 'leg')]
# Whole-image layers (copied as they are; transparent ones get the same alpha clean-up and edge bleed).
BACKGROUNDS = {'bg_garden_sky': 'garden_sky', 'bg_garden_sky_b': 'garden_sky_b', 'bg_garden_mid': 'garden_mid', 'bg_garden_far': 'garden_far',
               'bg_garden_near': 'garden_near', 'bg_room_back': 'room_back', 'bg_dealroom': 'dealroom', 'bg_feast_back': 'feast_back'}


def split_bowl(lab, stats, cent, alpha, rgb):
    """On the feast foreground sheet the fruit bowl touches the olive sapling below it: cut along the
    bowl's rounded bottom (fitted from the columns where a gap shows), green leaf pixels go to the sapling."""
    big = max(range(1, lab.max() + 1), key=lambda i: stats[i][4] if stats[i][0] < 100 else 0)
    ys, xs = np.nonzero(lab == big)
    cut = 449 - 0.0016 * (xs - 330.0) ** 2 + 2
    f = rgb[ys, xs].astype(np.int32)
    green = f[:, 1] > f[:, 0] + 8
    lower = (ys > cut) | (green & (ys > cut - 60))
    new = lab.max() + 1
    lab[ys[lower], xs[lower]] = new
    return lab


SPLIT = {'bg_feast_near': split_bowl}


def remove_water(rgb, alpha):
    """The pouring pose came with a drawn stream; the stream is made in code, so cut the drawn one out."""
    f = rgb.astype(np.int32)
    water = (f[..., 2] - f[..., 0] > 10) & (f.sum(axis=2) > 330) & (alpha > 0)
    water = ndimage.binary_dilation(water, iterations=2) & (f[..., 2] - f[..., 0] > -6)
    a = alpha.copy()
    a[water] = 0
    # drop any island left behind (keep the biggest part: the figure)
    lab, n = ndimage.label(a >= 16)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
        keep = 1 + int(np.argmax(sizes))
        a[(lab != keep) & (lab > 0)] = 0
    return a


FIX = {'jesus/pour': remove_water}
PAD = 12


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


def main():
    meta = {}
    for sheet, (group, pieces) in SHEETS.items():
        if not (SRC / f'{sheet}.png').exists():
            print(sheet, ': not uploaded yet')
            continue
        rgb, alpha, how = load(sheet)
        n, lab, stats, cent = cv2.connectedComponentsWithStats((alpha >= 16).astype(np.uint8), connectivity=8)
        if sheet in SPLIT:
            lab = SPLIT[sheet](lab, stats, cent, alpha, rgb)
            n = int(lab.max()) + 1
            stats = np.zeros((n, 5), np.int64)
            cent = np.zeros((n, 2))
            for i in range(1, n):
                yy, xx = np.nonzero(lab == i)
                if len(yy):
                    stats[i] = [xx.min(), yy.min(), xx.max() - xx.min() + 1, yy.max() - yy.min() + 1, len(yy)]
                    cent[i] = [xx.mean(), yy.mean()]
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
            if f'{group}/{name}' in FIX:
                a = FIX[f'{group}/{name}'](rgb[y0:y1, x0:x1], a)
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
    for sheet, name in BACKGROUNDS.items():
        if not (SRC / f'{sheet}.png').exists():
            print(sheet, ': not uploaded yet')
            continue
        rgb, alpha, how = load(sheet)
        d = OUT / 'bg'
        d.mkdir(parents=True, exist_ok=True)
        if alpha.min() >= 250:
            Image.fromarray(rgb).save(d / f'{name}.png', optimize=True)
        else:
            Image.fromarray(np.dstack([bleed(rgb, alpha), alpha])).save(d / f'{name}.png', optimize=True)
        meta[f'bg/{name}'] = {'file': f'sprites/bg/{name}.png', 'w': int(rgb.shape[1]), 'h': int(rgb.shape[0]), 'sheet': sheet}
        print(f'{sheet} ({how}) -> bg/{name}')
    (OUT / 'sprites.json').write_text(json.dumps(meta, indent=1) + '\n')
    print(len(meta), 'sprites written to', OUT)


if __name__ == '__main__':
    main()
