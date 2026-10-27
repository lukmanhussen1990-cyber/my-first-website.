#!/usr/bin/env python3
"""Pull frames from a rendered reel (default 2 per second) into labelled contact sheets for review.

  python3 tools/frame_check.py VIDEO [--fps 2] [--out build/check] [--cols 8 --rows 4]
"""
import argparse
import os
import subprocess
import glob

from PIL import Image, ImageDraw, ImageFont


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video')
    ap.add_argument('--fps', type=float, default=2)
    ap.add_argument('--out', default=None)
    ap.add_argument('--cols', type=int, default=8)
    ap.add_argument('--rows', type=int, default=4)
    ap.add_argument('--width', type=int, default=240)
    a = ap.parse_args()
    out = a.out or os.path.join(os.path.dirname(os.path.abspath(a.video)), 'check')
    frames = os.path.join(out, 'frames')
    os.makedirs(frames, exist_ok=True)
    for f in glob.glob(os.path.join(frames, '*.jpg')):
        os.remove(f)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.video, '-vf', f'fps={a.fps},scale={a.width}:-2', '-q:v', '3',
                    os.path.join(frames, 'f_%05d.jpg')], check=True)
    files = sorted(glob.glob(os.path.join(frames, '*.jpg')))
    font = ImageFont.truetype('/root/.fonts/Fredoka-Bold.ttf', 18)
    per = a.cols * a.rows
    w, h = Image.open(files[0]).size
    for k in range(0, len(files), per):
        sheet = Image.new('RGB', (a.cols * w, a.rows * h), 'black')
        d = ImageDraw.Draw(sheet)
        for i, f in enumerate(files[k:k + per]):
            im = Image.open(f)
            x, y = (i % a.cols) * w, (i // a.cols) * h
            sheet.paste(im, (x, y))
            t = (k + i + 0.5) / a.fps
            d.rectangle([x, y, x + 64, y + 22], fill='black')
            d.text((x + 4, y + 1), f'{t:5.1f}s', fill='yellow', font=font)
        p = os.path.join(out, f'sheet_{k // per:02d}.jpg')
        sheet.save(p, quality=85)
        print(p)


if __name__ == '__main__':
    main()
