"""Cut GPT sticker images out of their plain white background, keeping the
white sticker border (it is closed off by the thin grey edge around it).

Usage: python3 cutout.py <in-dir> <out-dir> [--preview preview.png]
"""
import argparse
import glob
import os

import cv2
import numpy as np


def cut(img):
    b = img[..., :3].astype(np.int16)
    mx, mn = b.max(axis=2), b.min(axis=2)
    nonwhite = ((mn < 240) | (mx - mn > 25)).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    closed = cv2.morphologyEx(nonwhite, cv2.MORPH_CLOSE, k)
    # Fill everything the outer background cannot reach.
    h, w = closed.shape
    flood = closed.copy()
    mask = np.zeros((h + 2, w + 2), np.uint8)
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if flood[y, x] == 0:
            cv2.floodFill(flood, mask, (x, y), 2)
    fg = (flood != 2).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)
    keep = np.zeros_like(fg)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 0.004 * h * w:
            keep[lab == i] = 1
    alpha = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 0.8)
    out = np.dstack([img[..., :3], (alpha * 255).astype(np.uint8)])
    ys, xs = np.where(alpha > 0.05)
    y0, y1 = max(0, ys.min() - 2), min(h, ys.max() + 3)
    x0, x1 = max(0, xs.min() - 2), min(w, xs.max() + 3)
    out = out[y0:y1, x0:x1]
    # Keep files light: longest side at most 1200 px.
    s = 1200 / max(out.shape[:2])
    if s < 1:
        out = cv2.resize(out, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--preview', default=None)
    args = ap.parse_args()
    os.makedirs(args.dst, exist_ok=True)
    tiles = []
    for f in sorted(glob.glob(os.path.join(args.src, '*.png'))):
        img = cv2.imread(f, cv2.IMREAD_COLOR)
        out = cut(img)
        cv2.imwrite(os.path.join(args.dst, os.path.basename(f)), out)
        print('%-24s %s' % (os.path.basename(f), out.shape))
        if args.preview:
            t = np.zeros((300, 300, 3), np.uint8)
            t[:] = (40, 110, 200)
            s = 280 / max(out.shape[:2])
            o = cv2.resize(out, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
            y0, x0 = (300 - o.shape[0]) // 2, (300 - o.shape[1]) // 2
            a = o[..., 3:4] / 255.0
            t[y0:y0 + o.shape[0], x0:x0 + o.shape[1]] = (o[..., :3] * a + t[y0:y0 + o.shape[0], x0:x0 + o.shape[1]] * (1 - a)).astype(np.uint8)
            tiles.append(t)
    if args.preview and tiles:
        while len(tiles) % 4:
            tiles.append(np.zeros_like(tiles[0]))
        rows = [np.hstack(tiles[i:i + 4]) for i in range(0, len(tiles), 4)]
        cv2.imwrite(args.preview, np.vstack(rows))


if __name__ == '__main__':
    main()
