"""Reproject NASA Blue Marble (topo + bathy) imagery to Mercator layers.

Usage: python3 basemap.py <bmng-dir> <out-dir> [month, default 200409]

September 2004 is used by default: green after the monsoon, little snow.

Writes two layers plus a small JSON with their extents:
  detail.png  240 px/deg, South Asia close-ups (500 m imagery)
  wide.png     60 px/deg, wide shots and the opening zoom (2 km imagery)
"""
import json
import math
import os
import sys

import cv2
import numpy as np

cv2.setNumThreads(4)
os.environ.setdefault('OPENCV_IO_MAX_IMAGE_PIXELS', str(2 ** 31))

SRC = sys.argv[1].rstrip('/') + '/'
OUT = sys.argv[2].rstrip('/') + '/'
MONTH = sys.argv[3] if len(sys.argv) > 3 else '200409'


def merc_y(lat):
    return math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))


def inv_merc(y):
    return math.degrees(2 * math.atan(math.exp(math.radians(y))) - math.pi / 2)


def to_mercator(eq, lon0, lat_top, ppd, lat_min, lat_max):
    """eq: equirectangular crop whose row 0 is lat_top, ppd px per degree."""
    y_top, y_bot = merc_y(lat_max), merc_y(lat_min)
    h = int(round((y_top - y_bot) * ppd))
    ys = y_top - (np.arange(h) + 0.5) / ppd
    lats = np.degrees(2 * np.arctan(np.exp(np.radians(ys))) - np.pi / 2)
    src_rows = (lat_top - lats) * ppd - 0.5
    map_y = np.repeat(src_rows.astype(np.float32)[:, None], eq.shape[1], axis=1)
    map_x = np.repeat(np.arange(eq.shape[1], dtype=np.float32)[None, :], h, axis=0)
    out = np.empty((h, eq.shape[1], 3), np.uint8)
    step = 2048
    for r0 in range(0, h, step):
        r1 = min(h, r0 + step)
        out[r0:r1] = cv2.remap(eq, map_x[r0:r1], map_y[r0:r1], cv2.INTER_LINEAR,
                               borderMode=cv2.BORDER_REPLICATE)
    return out, y_top, y_bot


def grade(img):
    """Push the imagery toward the reference look: deeper teal ocean,
    slightly richer land, a touch more contrast."""
    f = img.astype(np.float32) / 255.0
    b, g, r = f[..., 0], f[..., 1], f[..., 2]
    water = np.clip((b - np.maximum(r, g * 0.85)) * 6.0, 0, 1)
    water = cv2.GaussianBlur(water, (0, 0), 1.5)
    # Ocean: teal tint with the bathymetry relief kept.
    lum = 0.3 * r + 0.5 * g + 0.2 * b
    teal = np.stack([0.42 + lum * 0.9, 0.36 + lum * 0.85, 0.12 + lum * 0.55], -1)
    teal = np.clip(teal * 0.78, 0, 1)
    f = f * (1 - water[..., None] * 0.75) + teal * (water[..., None] * 0.75)
    # Gentle S-curve and saturation.
    f = np.clip((f - 0.5) * 1.12 + 0.5 - 0.02, 0, 1)
    gray = f.mean(-1, keepdims=True)
    f = np.clip(gray + (f - gray) * 1.15, 0, 1)
    return (f * 255 + 0.5).astype(np.uint8)


def grade_big(img, step=1024, pad=8):
    out = np.empty_like(img)
    for r0 in range(0, img.shape[0], step):
        a, b = max(0, r0 - pad), min(img.shape[0], r0 + step + pad)
        g = grade(img[a:b])
        out[r0:min(img.shape[0], r0 + step)] = g[r0 - a:r0 - a + min(step, img.shape[0] - r0)]
    return out


meta = {}

# Wide layer from the 2 km global mosaic.
glob = cv2.imread(SRC + 'world.topo.bathy.%s.3x21600x10800.jpg' % MONTH, cv2.IMREAD_COLOR)
ppd = 60
lon0, lon1, lat_min, lat_max = 25.0, 135.0, -35.0, 62.0
crop = glob[int((90 - lat_max) * ppd) - 4:int((90 - lat_min) * ppd) + 4,
            int((lon0 + 180) * ppd):int((lon1 + 180) * ppd)]
del glob
merc, y_top, y_bot = to_mercator(crop, lon0, lat_max + 4 / ppd, ppd, lat_min, lat_max)
cv2.imwrite(OUT + 'wide.png', grade_big(merc), [cv2.IMWRITE_PNG_COMPRESSION, 1])
meta['wide'] = {'x0': lon0, 'y_top': y_top, 'ppd': ppd, 'w': merc.shape[1], 'h': merc.shape[0]}
del crop, merc

# Detail layer from the 500 m tiles C1 (0-90E) and D1 (90-180E), north half.
ppd = 240
lon0, lon1, lat_min, lat_max = 58.0, 100.0, 2.0, 40.0
r0, r1 = int((90 - lat_max) * ppd) - 4, int((90 - lat_min) * ppd) + 4
c1 = cv2.imread(SRC + 'world.topo.bathy.%s.3x21600x21600.C1.jpg' % MONTH, cv2.IMREAD_COLOR)
left = c1[r0:r1, int(lon0 * ppd):].copy()
del c1
d1 = cv2.imread(SRC + 'world.topo.bathy.%s.3x21600x21600.D1.jpg' % MONTH, cv2.IMREAD_COLOR)
right = d1[r0:r1, :int((lon1 - 90) * ppd)].copy()
del d1
crop = np.concatenate([left, right], axis=1)
del left, right
merc, y_top, y_bot = to_mercator(crop, lon0, lat_max + 4 / ppd, ppd, lat_min, lat_max)
del crop
cv2.imwrite(OUT + 'detail.png', grade_big(merc), [cv2.IMWRITE_PNG_COMPRESSION, 1])
meta['detail'] = {'x0': lon0, 'y_top': y_top, 'ppd': ppd, 'w': merc.shape[1], 'h': merc.shape[0]}

with open(OUT + 'basemap.json', 'w') as f:
    json.dump(meta, f, indent=1)
print(json.dumps(meta, indent=1))
