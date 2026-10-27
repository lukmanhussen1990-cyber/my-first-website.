"""Cut the balance scale into parts that can move (run after process_gpt_images.py):
the stand (post and base, from the full scale), the beam bar (with its top ring and knobs) and the two
hanging pans (chains + pan) from the separate beam piece. Writes public/sprites/props/scale_*.png and
public/sprites/props/scale_parts.json (pivot and hanging points, in each part's pixels)."""
import json
from pathlib import Path

import numpy as np
from PIL import Image

EP = Path(__file__).resolve().parent.parent
P = EP / 'public' / 'sprites' / 'props'


def load(name):
    return np.asarray(Image.open(P / f'{name}.png').convert('RGBA')).copy()


def save_crop(name, a, pad=4):
    ys, xs = np.nonzero(a[..., 3] > 0)
    x0, y0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
    x1, y1 = min(a.shape[1], xs.max() + pad + 1), min(a.shape[0], ys.max() + pad + 1)
    Image.fromarray(np.ascontiguousarray(a[y0:y1, x0:x1])).save(P / f'{name}.png', optimize=True)
    return int(x0), int(y0)


def main():
    out = {}
    # ---- beam piece: bar on top, two pans hanging from the knobs ----
    beam = load('beam')
    h, w = beam.shape[:2]
    al = beam[..., 3]
    ys, xs = np.nonzero(al > 128)
    cx = float(xs.mean())
    # the bar row: the widest opaque run near the top
    widths = [(np.count_nonzero(al[y] > 128), y) for y in range(0, h // 3)]
    bar_y = max(widths)[1]
    cut = bar_y + 26
    yy, xx = np.mgrid[0:h, 0:w]
    bar = beam.copy()
    bar[yy >= cut, 3] = 0
    left = beam.copy()
    left[(yy < cut) | (xx >= cx), 3] = 0
    right = beam.copy()
    right[(yy < cut) | (xx < cx), 3] = 0
    # knobs: the lowest-left and lowest-right opaque points of the bar band
    band = (al > 128) & (yy >= bar_y - 30) & (yy < cut)
    bx = np.nonzero(band.any(axis=0))[0]
    knob_l = [int(bx.min()) + 14, bar_y]
    knob_r = [int(bx.max()) - 14, bar_y]
    ox, oy = save_crop('scale_bar', bar)
    out['scale_bar'] = {'pivot': [round(cx - ox, 1), bar_y - oy], 'knobL': [knob_l[0] - ox, knob_l[1] - oy], 'knobR': [knob_r[0] - ox, knob_r[1] - oy]}
    for name, part, knob in (('scale_pan_l', left, knob_l), ('scale_pan_r', right, knob_r)):
        ox, oy = save_crop(name, part)
        out[name] = {'hang': [knob[0] - ox, knob[1] - oy]}
    # ---- stand: keep the post column and the base of the full scale ----
    sc = load('scale')
    h2, w2 = sc.shape[:2]
    a2 = sc[..., 3]
    ys2, xs2 = np.nonzero(a2 > 128)
    # the post: the columns that stay opaque from the base up to the middle
    mid_rows = (ys2 > h2 * 0.35) & (ys2 < h2 * 0.75)
    post_x = float(np.median(xs2[mid_rows]))
    yy2, xx2 = np.mgrid[0:h2, 0:w2]
    base_top = int(h2 * 0.78)
    keep = (np.abs(xx2 - post_x) < 34) | (yy2 >= base_top)
    stand = sc.copy()
    stand[~keep, 3] = 0
    ox, oy = save_crop('scale_stand', stand)
    # where the bar's pivot sits on the stand: the post top area at the bar's height in the full scale
    rows = [(np.count_nonzero(a2[y] > 128), y) for y in range(0, h2 // 2)]
    bar_y2 = max(rows)[1]
    out['scale_stand'] = {'pivot': [round(post_x - ox, 1), bar_y2 - oy]}
    (P / 'scale_parts.json').write_text(json.dumps(out, indent=1) + '\n')
    print(json.dumps(out))


if __name__ == '__main__':
    main()
