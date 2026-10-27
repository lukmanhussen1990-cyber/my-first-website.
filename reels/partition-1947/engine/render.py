"""Render the reel (or a time range of it) to MP4.

Usage:
  python3 render.py --base DIR --geo geo.pkl --fonts DIR --out out.mp4
                    [--sprites DIR] [--timing timing.json] [--t0 S] [--t1 S]
                    [--workers 4] [--audio mix.wav] [--stills 1.0,5.2,...]
"""
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
import multiprocessing as mp

import cv2
import numpy as np

import core
from core import Cam
from story import Story

FPS = 30
SHUTTER = 1.0 / FPS


def load_story(args):
    dur, wt = None, None
    if args.timing and os.path.exists(args.timing):
        tm = json.load(open(args.timing))
        dur = tm['durations']
        wt = tm.get('word_times')
    return Story(dur, wt, core.Sprites(args.sprites))


def setup(args):
    core.FONT_DIR = args.fonts
    core.geo = core.Geo(args.geo)


def draw_captions(c, chunks, T):
    for start, end, words in chunks:
        if not (start <= T < end):
            continue
        f = core.font('ExtraBold', 54)
        space = f.measureText(' ')
        widths = [f.measureText(w) for w, _ in words]
        total = sum(widths) + space * (len(words) - 1)
        x = core.W / 2 - total / 2
        y = core.H * 0.775
        for (w, t), wd in zip(words, widths):
            if T >= t - 0.02:
                u = min(1.0, (T - t + 0.02) / 0.12)
                sc = 0.75 + 0.25 * core.ease_out_back(u, 2.0)
                c.save()
                c.translate(x + wd / 2, y)
                c.scale(sc, sc)
                core.shadow_text(c, w, 0, 0, f, alpha=min(1.0, u * 2), shadow=0.9, sigma=6, dy=3, outline=6)
                c.restore()
            x += wd + space
        break


def render_frame(story, bm, chunks, T):
    cam = Cam(*story.cam.at(T))
    bg = bm.render(cam)
    m = story.mood_at(T)
    if m > 0:
        bg = core.mood_grade(bg, m)
    surf, c = core.new_canvas(bg)
    core.vignette(c, 0.22 + 0.25 * m)
    for key in story.order:
        color, alpha, flash = story.regions[key].state(T)
        if alpha > 0.003 and color is not None:
            core.fill_region(c, core.geo.screen_path(key, cam), color, alpha=alpha, flash=flash,
                             glow=1.0 + 1.6 * flash)
    for t0, t1, fn in story.map_items:
        if t0 <= T <= t1:
            fn(c, T, cam)
    cams = [Cam(*story.cam.at(T - k * SHUTTER / 2)) for k in (0, 1, 2)]
    img = core.snapshot(surf)
    blurred = core.motion_blur(img, cams)
    if blurred is not img:
        surf, c = core.new_canvas_plain(blurred)
    for t0, t1, fn in story.screen_items:
        if t0 <= T <= t1:
            fn(c, T, cam)
    draw_captions(c, chunks, T)
    core.watermark(c)
    return core.snapshot(surf)


def worker(job):
    args, frames, seg_path = job
    setup(args)
    story = load_story(args)
    chunks = story.caption_chunks()
    bm = core.BaseMap(args.base)
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (core.W, core.H),
           '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
           '-pix_fmt', 'yuv420p', seg_path]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for fi in frames:
        img = render_frame(story, bm, chunks, fi / FPS)
        pr.stdin.write(np.ascontiguousarray(img).tobytes())
    pr.stdin.close()
    pr.wait()
    return seg_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', required=True)
    ap.add_argument('--geo', required=True)
    ap.add_argument('--fonts', required=True)
    ap.add_argument('--sprites', default=None)
    ap.add_argument('--timing', default=None)
    ap.add_argument('--out', required=True)
    ap.add_argument('--t0', type=float, default=0.0)
    ap.add_argument('--t1', type=float, default=None)
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--audio', default=None)
    ap.add_argument('--stills', default=None)
    args = ap.parse_args()

    setup(args)
    story = load_story(args)
    t1 = args.t1 if args.t1 is not None else story.total

    if args.stills:
        chunks = story.caption_chunks()
        bm = core.BaseMap(args.base)
        os.makedirs(args.out, exist_ok=True)
        for s in args.stills.split(','):
            T = float(s)
            img = render_frame(story, bm, chunks, T)
            cv2.imwrite(os.path.join(args.out, 'still_%06.2f.png' % T), cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
            print('still', T)
        return

    frames = list(range(int(round(args.t0 * FPS)), int(round(t1 * FPS))))
    n = max(1, min(args.workers, len(frames) // 15 or 1))
    size = math.ceil(len(frames) / n)
    tmp = tempfile.mkdtemp(prefix='seg_', dir=os.path.dirname(os.path.abspath(args.out)))
    jobs = [(args, frames[i * size:(i + 1) * size], os.path.join(tmp, 'seg%02d.mp4' % i)) for i in range(n)]
    jobs = [j for j in jobs if j[1]]
    with mp.get_context('fork').Pool(len(jobs)) as pool:
        segs = pool.map(worker, jobs)
    lst = os.path.join(tmp, 'list.txt')
    with open(lst, 'w') as f:
        for s in segs:
            f.write("file '%s'\n" % s)
    video_only = os.path.join(tmp, 'video.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', video_only],
                   check=True)
    if args.audio:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video_only, '-ss', str(args.t0), '-t', str(t1 - args.t0),
                        '-i', args.audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                        '-ar', '48000', '-shortest', '-movflags', '+faststart', args.out], check=True)
    else:
        os.replace(video_only, args.out)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
