"""Turn a painted character cutout into glowing line art (storybook style).

XDoG edge extraction on the painting + the silhouette edge, then a soft
glow. Output is an RGBA PNG the same size as the input, so it lines up
1:1 with the painted image for cross-fades.

Usage: python lineart.py in.png out.png [gold|white] [detail=1.0]
"""
import sys

import numpy as np
from PIL import Image

COLORS = {
    'gold': ((255, 236, 190), (226, 178, 90)),   # core, glow
    'white': ((240, 236, 252), (174, 169, 192)),
}


def blur(x, sigma):
    r = max(1, int(sigma * 3))
    k = np.exp(-(np.arange(-r, r + 1) ** 2) / (2 * sigma * sigma))
    k /= k.sum()
    pad = np.pad(x, ((0, 0), (r, r)), mode='edge')
    x = sum(k[i] * pad[:, i:i + x.shape[1]] for i in range(2 * r + 1))
    pad = np.pad(x, ((r, r), (0, 0)), mode='edge')
    return sum(k[i] * pad[i:i + x.shape[0], :] for i in range(2 * r + 1))


def lineart(path_in, path_out, mode='gold', detail=1.0):
    im = np.asarray(Image.open(path_in).convert('RGBA')).astype(np.float32) / 255
    a = im[:, :, 3]
    lum = (0.299 * im[:, :, 0] + 0.587 * im[:, :, 1] + 0.114 * im[:, :, 2]) * a + (1 - a)
    s = 1.1 / detail
    g1, g2 = blur(lum, s), blur(lum, s * 1.6)
    d = g1 - 0.985 * g2
    ink = np.clip(-d * 60 * detail, 0, 1) ** 0.8          # dark-side edges = ink lines
    ink *= blur((a > 0.5).astype(np.float32), 1.5)
    gy, gx = np.gradient(blur(a, 1.2))
    sil = np.clip(np.hypot(gx, gy) * 3.5, 0, 1)
    line = np.clip(np.maximum(ink, sil), 0, 1)
    line[line < 0.12] = 0
    glow = np.clip(blur(line, 3.0) * 1.6 + blur(line, 9.0) * 0.9, 0, 1)
    core_c, glow_c = (np.array(c, np.float32) / 255 for c in COLORS[mode])
    # composite core over glow (both straight alpha)
    ga = glow * 0.75
    ca = line
    out_a = ca + ga * (1 - ca)
    rgb = (core_c * ca[..., None] + glow_c * (ga * (1 - ca))[..., None]) / np.maximum(out_a[..., None], 1e-6)
    out = np.dstack([rgb, out_a])
    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(path_out)


if __name__ == '__main__':
    lineart(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'gold',
            float(sys.argv[4]) if len(sys.argv) > 4 else 1.0)
