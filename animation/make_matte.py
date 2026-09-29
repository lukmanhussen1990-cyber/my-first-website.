"""One-off: build character_matte.png (the two characters) from source.png.

Uses the isnet-anime segmentation model (same one rembg ships):
  mkdir -p ~/.u2net && curl -L -o ~/.u2net/isnet-anime.onnx \
    https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-anime.onnx
  pip install onnxruntime opencv-python-headless numpy
  python3 make_matte.py source.png character_matte.png
"""
import os
import sys

import cv2
import numpy as np
import onnxruntime as ort

CROP = (140, 770, 780, 1450)  # both characters, run at model resolution for finer hair


def segment(bgr, sess):
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    x = cv2.resize(rgb, (1024, 1024), interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
    x /= x.max()
    x -= np.array([0.485, 0.456, 0.406], np.float32)
    out = sess.run(None, {sess.get_inputs()[0].name: x.transpose(2, 0, 1)[None]})[0][0, 0]
    out = (out - out.min()) / (out.max() - out.min())
    return cv2.resize(out, (bgr.shape[1], bgr.shape[0]), interpolation=cv2.INTER_LINEAR)


def main(src, dst):
    img = cv2.imread(src)
    sess = ort.InferenceSession(os.path.expanduser('~/.u2net/isnet-anime.onnx'),
                                providers=['CPUExecutionProvider'])
    x0, y0, x1, y1 = CROP
    seg = np.zeros(img.shape[:2], np.float32)
    seg[y0:y1, x0:x1] = segment(img[y0:y1, x0:x1], sess)

    m = (seg > 0.22).astype(np.uint8)
    # thin dark tufts the model misses: the boy's crown curl and side tufts against the sky
    lum = img.astype(np.float32).mean(axis=2)
    sky = cv2.medianBlur(img, 15).astype(np.float32).mean(axis=2)
    for bx0, by0, bx1, by1 in [(512, 768, 545, 795), (596, 806, 630, 852), (470, 830, 492, 872)]:
        tuft = (lum[by0:by1, bx0:bx1] < sky[by0:by1, bx0:bx1] - 9).astype(np.uint8)
        m[by0:by1, bx0:bx1] |= cv2.dilate(tuft, np.ones((2, 2), np.uint8))

    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] > 2000:
            keep[lab == i] = 1
    # re-attach tuft pixels that touch the kept silhouettes
    near = cv2.dilate(keep, np.ones((5, 5), np.uint8))
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] <= 2000 and (near[lab == i] > 0).any():
            keep[lab == i] = 1
    inv = (1 - keep).astype(np.uint8)
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv)
    for i in range(1, n2):
        if st2[i, cv2.CC_STAT_AREA] < 1500:
            keep[lab2 == i] = 1
    cv2.imwrite(dst, keep * 255)


if __name__ == '__main__':
    main(*sys.argv[1:3])
