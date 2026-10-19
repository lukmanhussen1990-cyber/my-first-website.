"""Render all frames in parallel to PNGs and log every text bounding box (safe-zone QC)."""
import json
import os
import sys
import time
from multiprocessing import Process

import numpy as np
from PIL import Image

OUT = sys.argv[1]
N_WORK = int(sys.argv[2]) if len(sys.argv) > 2 else 4
ONLY = sys.argv[3] if len(sys.argv) > 3 else None   # optional "a-b" frame range
FPS, TOTAL = 30, 1350


def work(wid, frames):
    import overlay as ov
    import scenes
    t0 = time.time()
    for n, fi in enumerate(frames):
        img, _ = scenes.frame(fi / FPS, fi)
        Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).save(
            os.path.join(OUT, f"f{fi:04d}.png"), compress_level=1)
        if n % 25 == 0:
            print(f"[w{wid}] {n + 1}/{len(frames)} frame {fi}  {time.time() - t0:.0f}s", flush=True)
    tag = "" if not ONLY else "_" + ONLY
    json.dump(ov.LOG, open(os.path.join(OUT, f"textlog_w{wid}{tag}.json"), "w"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    lo, hi = (0, TOTAL) if not ONLY else map(int, ONLY.split("-"))
    allf = list(range(lo, hi))
    ps = [Process(target=work, args=(w, allf[w::N_WORK])) for w in range(N_WORK)]
    [p.start() for p in ps]
    [p.join() for p in ps]
    print("DONE", len(allf), "frames")
