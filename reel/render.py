"""Render the reel: every frame with Pillow + numpy, joined with ffmpeg.

    python3 render.py                       # full video -> out/reel.mp4
    python3 render.py --handle @me          # watermark text
    python3 render.py --sheet 4.0 6.5 9     # contact sheet of single frames (seconds)
"""
import argparse
import multiprocessing as mp
import os
import subprocess
import sys
import time

from PIL import Image

import audio
import scenes
from gfx import FPS, H, W
from timeline import VO_PATH, Timeline

HERE = os.path.dirname(os.path.abspath(__file__))
SS = 2
HANDLE = "@Garden_reel"

_tl = None
_handle = HANDLE


def _init(handle):
    global _tl, _handle
    _tl, _handle = Timeline(), handle


def frame(i):
    img = scenes.compose(_tl, i / FPS, SS, _handle)
    return img.reduce(SS).tobytes()


def render_video(tl, out, handle, workers):
    tmp = os.path.join(HERE, "out", "tmp")
    os.makedirs(tmp, exist_ok=True)
    music, mix = os.path.join(tmp, "music.wav"), os.path.join(tmp, "mix.wav")
    print(f"audio: music + mix ({tl.duration:.2f}s)", flush=True)
    audio.make_music(tl.duration, music)
    audio.mix(VO_PATH, music, tl.duration, mix)

    cmd = ["ffmpeg", "-v", "error", "-y",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", mix, "-map", "0:v", "-map", "1:a",
           "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-level", "4.1", "-g", "60", "-colorspace", "bt709",
           "-color_primaries", "bt709", "-color_trc", "bt709",
           "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
           "-movflags", "+faststart", "-shortest", out]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    with mp.Pool(workers, initializer=_init, initargs=(handle,)) as pool:
        for n, buf in enumerate(pool.imap(frame, range(tl.n_frames), chunksize=2)):
            enc.stdin.write(buf)
            if n % 150 == 0:
                print(f"frame {n}/{tl.n_frames}  {time.time() - t0:.0f}s", flush=True)
    enc.stdin.close()
    if enc.wait() != 0:
        sys.exit("ffmpeg failed")
    print(f"done in {time.time() - t0:.0f}s -> {out}")


def sheet(times, path, handle, cols=4, scale=0.3):
    _init(handle)
    tw, th = int(W * scale), int(H * scale)
    rows = (len(times) + cols - 1) // cols
    out = Image.new("RGB", (cols * tw, rows * th), "black")
    for k, t in enumerate(times):
        img = scenes.compose(_tl, t, SS, handle).reduce(SS)
        out.paste(img.resize((tw, th), Image.LANCZOS), ((k % cols) * tw, (k // cols) * th))
    out.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "out", "reel.mp4"))
    ap.add_argument("--handle", default=HANDLE)
    ap.add_argument("--workers", type=int, default=os.cpu_count())
    ap.add_argument("--sheet", nargs="+", type=float, help="seconds to put on a contact sheet")
    ap.add_argument("--sheet-out", default=os.path.join(HERE, "out", "sheet.png"))
    ap.add_argument("--frame", type=float, help="save one full-size frame at this time")
    args = ap.parse_args()
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    if args.sheet:
        sheet(args.sheet, args.sheet_out, args.handle)
        return
    if args.frame is not None:
        _init(args.handle)
        scenes.compose(_tl, args.frame, SS, args.handle).reduce(SS).save(args.sheet_out)
        return
    render_video(Timeline(), args.out, args.handle, args.workers)


if __name__ == "__main__":
    main()
