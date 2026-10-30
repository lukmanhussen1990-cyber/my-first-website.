"""Lengthen a leaf garment down to the knees by adding a second tier of leaves.

Usage: python extend_hem.py in.png out.png FIG [FIG ...]
  FIG = x0:x1:d  -> columns x0..x1 belong to one figure; push its hem down d px.
The lower leaf band of the garment is copied, moved down d px and slid in
BEHIND the original leaves (but in front of the legs), like a layered skirt.
Hands and arms that sat in front of the garment are painted back on top.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter


def closed(mask, size):
    m = Image.fromarray((mask * 255).astype(np.uint8))
    m = m.filter(ImageFilter.MaxFilter(size)).filter(ImageFilter.MinFilter(size))
    return np.array(m) > 0


def opened(mask, size):
    m = Image.fromarray((mask * 255).astype(np.uint8))
    m = m.filter(ImageFilter.MinFilter(size)).filter(ImageFilter.MaxFilter(size))
    return np.array(m) > 0


def garment_mask(rgba):
    r, g, b, a = [rgba[:, :, i].astype(int) for i in range(4)]
    leaf = (a > 128) & (g > r + 4) & (g > b + 12)
    leaf = opened(leaf, 5)  # drop green crumbs
    return closed(leaf, 9) & (a > 0)


def over(top, base):
    ta, ba = top[:, :, 3:4] / 255.0, base[:, :, 3:4] / 255.0
    na = ta + ba * (1 - ta)
    out = np.empty_like(base)
    out[:, :, :3] = np.where(na > 0, (top[:, :, :3] * ta + base[:, :, :3] * ba * (1 - ta)) / np.maximum(na, 1e-6), 0)
    out[:, :, 3:4] = na * 255
    return out


def extend(path_in, path_out, figs, band_frac=0.5):
    im = np.array(Image.open(path_in).convert('RGBA')).astype(np.float32)
    H, W = im.shape[:2]
    gm = garment_mask(im.astype(np.uint8))
    silhouette = closed(gm, 41)
    garment = im.copy()
    garment[:, :, 3] *= gm
    tier = np.zeros_like(im)
    for x0, x1, d in figs:
        cols = [x for x in range(x0, x1) if gm[:, x].any()]
        hems = np.array([np.where(gm[:, x])[0].max() for x in cols])
        tops = np.array([np.where(gm[:, x])[0].min() for x in cols])
        hem, gtop = int(np.percentile(hems, 75)), int(np.median(tops))
        band_top = hem - int((hem - gtop) * band_frac)
        xs = np.array(cols)
        src = garment[band_top:H - d][:, xs]
        # feather the top of the copied band so its cut edge never shows
        fade = np.clip((np.arange(src.shape[0]) / 40.0), 0, 1)[:, None]
        src = src.copy()
        src[:, :, 3] *= fade
        tier[band_top + d:, xs] = src
    out = over(tier, im)            # second tier over the legs
    out = over(garment, out)        # original leaves back in front
    yy = np.arange(H)[:, None]
    hem_col = np.array([np.where(gm[:, x])[0].max() if gm[:, x].any() else H for x in range(W)])
    keep = (~gm) & (~silhouette) & (im[:, :, 3] > 0) & (yy < hem_col[None, :] - 12)
    out[keep] = im[keep]
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(path_out)


if __name__ == '__main__':
    figs = [tuple(int(v) for v in f.split(':')) for f in sys.argv[3:]]
    extend(sys.argv[1], sys.argv[2], figs)
