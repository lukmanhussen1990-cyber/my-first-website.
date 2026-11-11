"""Render all frames in parallel (skia) -> lossless chunks -> final H.264 + AAC.

usage: python render.py [--start S --end E] [--out path.mp4] [--workers 4]
"""
import argparse
import os
import subprocess
import sys
import time
from multiprocessing import Pool

import numpy as np

from engine import W, H, FPS, ROOT
from timing import DURATION

N_FRAMES = int(round(DURATION * FPS))
# (start, end, subsamples): motion blur on fast camera moves (shutter = half a frame)
MB = [(12.60, 13.40, 5), (17.95, 18.45, 3), (18.97, 21.22, 3), (25.98, 26.45, 4), (29.33, 29.45, 3)]
SHUTTER = 0.5


def subsamples(t):
    for a, b, n in MB:
        if a <= t < b:
            return n
    return 1


def render_chunk(args):
    i0, i1, path = args
    import skia
    from scenes import draw_frame
    surf = skia.Surface(W, H)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-c:v", "libx264rgb", "-qp", "0", "-preset", "ultrafast", path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t_start = time.time()
    for f in range(i0, i1):
        t = f / FPS
        n = subsamples(t)
        if n == 1:
            draw_frame(surf.getCanvas(), t, f)
            arr = surf.makeImageSnapshot().toarray(colorType=skia.kRGBA_8888_ColorType)
        else:
            acc = np.zeros((H, W, 4), np.float32)
            for k in range(n):
                ts = t + (k / n - 0.5) * SHUTTER / FPS
                draw_frame(surf.getCanvas(), ts, f)
                acc += surf.makeImageSnapshot().toarray(colorType=skia.kRGBA_8888_ColorType)
            arr = (acc / n + 0.5).astype(np.uint8)
        p.stdin.write(arr.tobytes())
    p.stdin.close()
    p.wait()
    return path, i1 - i0, time.time() - t_start


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=DURATION)
    ap.add_argument("--out", default=str(ROOT / "out" / "grace_gym_spotter_1080p.mp4"))
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 4)
    ap.add_argument("--chunks", type=int, default=24)
    ap.add_argument("--audio", default=str(ROOT / "out" / "mix.wav"))
    a = ap.parse_args()
    f0 = int(round(a.start * FPS))
    f1 = min(N_FRAMES, int(round(a.end * FPS)))
    tmp = ROOT / "out" / "chunks"
    tmp.mkdir(parents=True, exist_ok=True)
    for old in tmp.glob("*.mkv"):
        old.unlink()
    edges = np.linspace(f0, f1, a.chunks + 1).astype(int)
    jobs = [(int(edges[i]), int(edges[i + 1]), str(tmp / f"c{i:03d}.mkv")) for i in range(a.chunks) if edges[i + 1] > edges[i]]
    t0 = time.time()
    done = 0
    with Pool(a.workers) as pool:
        for path, n, dt in pool.imap_unordered(render_chunk, jobs):
            done += n
            print(f"  {os.path.basename(path)}: {n} frames in {dt:.0f}s  ({done}/{f1 - f0}, {time.time() - t0:.0f}s)",
                  flush=True)
    lst = tmp / "list.txt"
    lst.write_text("".join(f"file '{j[2]}'\n" for j in jobs))
    dur = (f1 - f0) / FPS
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
           "-ss", f"{f0 / FPS:.4f}", "-t", f"{dur:.4f}", "-i", a.audio,
           "-map", "0:v", "-map", "1:a",
           "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
           "-c:v", "libx264", "-profile:v", "high", "-level", "4.2", "-preset", "slow", "-tune", "animation",
           "-crf", "13", "-maxrate", "40M", "-bufsize", "80M", "-g", "60", "-bf", "2",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
           "-r", str(FPS),
           "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-af", "apad", "-t", f"{dur:.4f}",
           "-movflags", "+faststart", a.out]
    subprocess.run(cmd, check=True)
    print(f"wrote {a.out} ({f1 - f0} frames, {dur:.3f}s) total {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
