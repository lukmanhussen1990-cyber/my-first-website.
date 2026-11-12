#!/usr/bin/env python3
"""Build the reel:  python3 make_reel.py            -> hold_hands_reel.mp4 + hold_hands_reel.srt

Options
  --voice FILE_OR_DIR   your voice-over. One file = played from 0:00. A folder = one clip per
                        script line, named 1.mp3 ... 9.mp3 (missing lines stay silent).
  --stills 0,3.5,7      only save still frames at those seconds (quick look, no video)
  --scale 0.667         size of the 3D render relative to 1080x1920 (text is always full size)
  --jobs 4              how many CPU cores to use
  --range 0 30          only render this part (seconds)
  --audio-only          keep the finished picture and only rebuild the sound (fast)
"""
import argparse
import os
import subprocess
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from reel import timeline as tl  # noqa: E402


def write_srt(path):
    def ts(x):
        ms = int(round(x * 1000))
        return "%02d:%02d:%02d,%03d" % (ms // 3600000, ms // 60000 % 60, ms // 1000 % 60, ms % 1000)

    with open(path, "w", encoding="utf-8") as f:
        for i, (a, b, text) in enumerate(tl.CUES, 1):
            f.write("%d\n%s --> %s\n%s\n\n" % (i, ts(a), ts(b), text))


_R = None


def _init(scale):
    """Each worker process builds its own renderer and uses one CPU core."""
    global _R
    import cv2
    import numba

    _R = tl.Renderer(scale)
    numba.set_num_threads(1)
    cv2.setNumThreads(1)


def _chunk(job):
    """Render frames f0..f1 and encode them to one small video file."""
    k, f0, f1, path, crf = job
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", "%dx%d" % (tl.W, tl.H), "-r", str(tl.FPS), "-i", "-",
        "-c:v", "libx264", "-preset", "medium", "-crf", str(crf), "-pix_fmt", "yuv420p",
        "-profile:v", "high", "-level", "4.2", "-threads", "1", "-g", str(tl.FPS), path,
    ]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for fi in range(f0, f1):
        ff.stdin.write(_R.frame(fi).tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError("ffmpeg failed on chunk %d" % k)
    return k


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default=os.path.join(HERE, "voice"))
    ap.add_argument("--stills", default=None)
    ap.add_argument("--scale", type=float, default=2.0 / 3.0)
    ap.add_argument("--range", type=float, nargs=2, default=None)
    ap.add_argument("--out", default=os.path.join(HERE, "hold_hands_reel.mp4"))
    ap.add_argument("--stills-dir", default=os.path.join(HERE, "stills"))
    ap.add_argument("--no-overlay", action="store_true")
    ap.add_argument("--audio-only", action="store_true")
    ap.add_argument("--crf", type=int, default=18)
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4)
    ap.add_argument("--keep-parts", action="store_true")
    args = ap.parse_args()

    if args.stills:
        R = tl.Renderer(args.scale)
        import cv2

        os.makedirs(args.stills_dir, exist_ok=True)
        for s in args.stills.split(","):
            t = float(s)
            t0 = time.time()
            fr = R.frame(int(round(t * tl.FPS)), overlay=not args.no_overlay)
            cv2.imwrite(os.path.join(args.stills_dir, "t%05.2f.png" % t), fr[..., ::-1])
            print("still %.2fs  (%.1fs)" % (t, time.time() - t0), flush=True)
        return

    srt = os.path.splitext(args.out)[0] + ".srt"
    write_srt(srt)
    wav = os.path.splitext(args.out)[0] + "_audio.wav"
    from reel import audio

    audio.build(args.voice, wav)
    f0, f1 = 0, tl.NFRAMES
    if args.range:
        f0, f1 = int(args.range[0] * tl.FPS), int(args.range[1] * tl.FPS)
    if args.audio_only:
        # keep the picture that is already rendered, only replace the sound
        tmp = os.path.splitext(args.out)[0] + "_tmp.mp4"
        subprocess.check_call([
            "ffmpeg", "-y", "-loglevel", "error", "-i", args.out, "-i", wav, "-map", "0:v", "-map", "1:a",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", tmp,
        ])
        os.replace(tmp, args.out)
        os.remove(wav)
        print("done (new sound, same picture):", args.out)
        return

    import multiprocessing as mp

    parts_dir = os.path.splitext(args.out)[0] + "_parts"
    os.makedirs(parts_dir, exist_ok=True)
    step = tl.FPS
    jobs = []
    for k, a in enumerate(range(f0, f1, step)):
        jobs.append((k, a, min(a + step, f1), os.path.join(parts_dir, "part_%03d.mp4" % k), args.crf))
    if not args.audio_only:
        t0 = time.time()
        ctx = mp.get_context("spawn")
        with ctx.Pool(args.jobs, initializer=_init, initargs=(args.scale,)) as pool:
            for n, k in enumerate(pool.imap_unordered(_chunk, jobs), 1):
                el = time.time() - t0
                print("second %d/%d rendered  (%.0fs elapsed, about %.0fs left)" % (n, len(jobs), el, el / n * (len(jobs) - n)), flush=True)
    lst = os.path.join(parts_dir, "list.txt")
    with open(lst, "w") as f:
        for j in jobs:
            f.write("file '%s'\n" % j[3])
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst]
    if args.range:
        cmd += ["-ss", str(args.range[0]), "-t", str(args.range[1] - args.range[0])]
    cmd += ["-i", wav, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest",
            "-movflags", "+faststart", args.out]
    subprocess.check_call(cmd)
    if not args.keep_parts:
        import shutil

        shutil.rmtree(parts_dir)
        os.remove(wav)
    print("done:", args.out)
    print("subtitles:", srt)


if __name__ == "__main__":
    main()
