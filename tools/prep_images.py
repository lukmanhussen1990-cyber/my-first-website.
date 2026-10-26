#!/usr/bin/env python3
"""Prepare the user's GPT images for the 3D scenes (input: any file, output: assets/gpt/<name>).

  python3 tools/prep_images.py <input.png> <output_name.png> [--dead-lamp]

--dead-lamp : GPT sometimes gives the frozen man a glowing headlamp. A lamp still burning
              after decades in the ice looks wrong, so the glowing lens is turned into a dark,
              frosted, dead lamp (keeps the frost texture, removes the glow + warm spill).
Also prints the alpha bounding box so the image can be placed at the right size in 3D.
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def find_lamp(rgb, alpha):
    """Centre/radius of the glowing lens: largest bright warm disc in the top part of the figure."""
    from scipy import ndimage
    ys, xs = np.where(alpha > 128)
    top = ys.min()
    band = int(top + (ys.max() - top) * 0.4)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
    glow = (lum > 0.55) & (r >= g) & (g >= b * 0.9) & (r - b > 40) & (alpha > 128)
    glow[band:] = False
    glow = ndimage.binary_opening(glow, iterations=2)
    lab, n = ndimage.label(glow)
    if n == 0:
        return None
    best, best_score = None, 0
    for i in range(1, n + 1):
        m = lab == i
        area = m.sum()
        if area < 300:
            continue
        cy, cx = ndimage.center_of_mass(m)
        bright = lum[m].mean()
        # compactness: area vs bounding circle
        yy, xx = np.where(m)
        rad = max(np.sqrt(((yy - cy) ** 2 + (xx - cx) ** 2).max()), 1)
        compact = area / (np.pi * rad * rad)
        score = area * bright * compact
        if score > best_score:
            best, best_score = (int(cx), int(cy), float(np.sqrt(area / np.pi))), score
    if not best:
        return None
    cx, cy, rad = best
    return cx, cy, rad * 1.08


def dead_lamp(im):
    a = np.array(im.convert('RGBA')).astype(float)
    rgb, alpha = a[..., :3], a[..., 3]
    found = find_lamp(rgb, alpha)
    if not found:
        print('  no glowing lamp found')
        return im
    cx, cy, rad = found
    print(f'  glowing lamp at ({cx},{cy}) r={rad}')
    h, w, _ = rgb.shape
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2)
    lum = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) / 255.0
    blur = np.array(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(float) / 255.0
    detail = lum - blur
    # dark frosted glass inside the lens
    glass = np.zeros_like(rgb)
    base = np.array([0.10, 0.12, 0.15])
    frost = np.clip(detail * 3.0 + 0.04, 0, 1)
    for c in range(3):
        glass[..., c] = (base[c] + frost * np.array([0.75, 0.85, 1.0])[c]) * 255
    # rim + spill: desaturate and darken warm tones near the lamp
    cool = np.zeros_like(rgb)
    for c, k in enumerate([0.62, 0.72, 0.9]):
        cool[..., c] = lum * 255 * k * 0.55
    w_lens = np.clip((rad * 1.02 - d) / (rad * 0.12), 0, 1)
    w_spill = np.clip((rad * 1.9 - d) / (rad * 0.9), 0, 1) * np.clip((rgb[..., 0] - rgb[..., 2]) / 120.0, 0, 1)
    out = rgb * (1 - w_spill[..., None]) + cool * w_spill[..., None]
    out = out * (1 - w_lens[..., None]) + glass * w_lens[..., None]
    a[..., :3] = np.clip(out, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def cool_box(im, box):
    """Darken + desaturate warm glow inside a box (lamp seen from the side/back)."""
    x0, y0, x1, y1 = box
    a = np.array(im).astype(float)
    reg = a[y0:y1, x0:x1, :3]
    lum = (0.299 * reg[..., 0] + 0.587 * reg[..., 1] + 0.114 * reg[..., 2])
    warm = np.clip((reg[..., 0] - reg[..., 2] - 30) / 90.0, 0, 1)
    h, w = lum.shape
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy)) / 8.0
    k = warm * np.clip(edge, 0, 1)
    cool = np.stack([lum * 0.36, lum * 0.42, lum * 0.52], -1)
    a[y0:y1, x0:x1, :3] = reg * (1 - k[..., None]) + cool * k[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def main():
    src, name = sys.argv[1], sys.argv[2]
    im = Image.open(src).convert('RGBA')
    if '--dead-lamp' in sys.argv:
        im = dead_lamp(im)
    if '--cool-box' in sys.argv:
        im = cool_box(im, [int(v) for v in sys.argv[sys.argv.index('--cool-box') + 1].split(',')])
    al = np.array(im)[..., 3]
    ys, xs = np.where(al > 128)
    print(f'  size {im.size}, alpha bbox x {xs.min()}-{xs.max()} y {ys.min()}-{ys.max()}')
    out = os.path.join(ROOT, 'assets', 'gpt', name)
    im.save(out, optimize=True)
    print('  ->', os.path.relpath(out, ROOT))


if __name__ == '__main__':
    main()
