"""Render stills at given times into a contact sheet for QA.

usage: python preview.py out.png 0.5 2.6 4.4 ...   (or --range a b n)
"""
import sys
import time

import numpy as np
import skia
from PIL import Image

from engine import W, H
from scenes import draw_frame


def render(t):
    s = skia.Surface(W, H)
    draw_frame(s.getCanvas(), t, int(t * 60))
    return s.makeImageSnapshot().toarray(colorType=skia.kRGBA_8888_ColorType)


def main():
    out = sys.argv[1]
    args = sys.argv[2:]
    if args and args[0] == "--range":
        a, b, n = float(args[1]), float(args[2]), int(args[3])
        times = list(np.linspace(a, b, n))
    else:
        times = [float(x) for x in args]
    cols = min(4, len(times))
    rows = (len(times) + cols - 1) // cols
    tw, th = int(sys.argv[0] and 360), 640
    sheet = Image.new("RGB", (tw * cols, th * rows), (20, 20, 20))
    for i, t in enumerate(times):
        t0 = time.time()
        arr = render(t)
        dt = time.time() - t0
        im = Image.fromarray(arr[:, :, :3]).resize((tw, th), Image.LANCZOS)
        sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
        print(f"t={t:.2f} {dt * 1000:.0f}ms", flush=True)
        if len(times) == 1:
            Image.fromarray(arr[:, :, :3]).save(out.replace(".png", "_full.png"))
    sheet.save(out)


if __name__ == "__main__":
    main()
