#!/usr/bin/env python3
"""Build the reel end to end from the current voice timing (build/timing.json):

  cues -> audio (effects, music, mix) -> 3D plates (every frame) -> text overlay -> final MP4

  python3 tools/build_reel.py --size preview        # 540x960 check copy -> build/preview/reel_preview.mp4
  python3 tools/build_reel.py --size final          # 1080x1920 -> out/reel_haunted-house.mp4
Options: --jobs N (parallel plate renderers), --skip audio,plates,overlay (reuse what is already built).
"""
import argparse
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import REEL, LJ, BUILD, OUT  # noqa: E402

PAGE = 'haunted-house/scene/index.html'
OVERLAY = 'haunted-house/overlay/index.html'
SIZES = {'preview': (540, 960), 'final': (1080, 1920)}


def run(cmd, **kw):
    print('$', ' '.join(cmd), flush=True)
    subprocess.run(cmd, check=True, **kw)


def rel(p):
    return os.path.relpath(p, LJ)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--size', choices=SIZES, default='preview')
    ap.add_argument('--jobs', type=int, default=2)
    ap.add_argument('--skip', default='')
    ap.add_argument('--fps', type=int, default=30)
    a = ap.parse_args()
    skip = set(filter(None, a.skip.split(',')))
    w, h = SIZES[a.size]
    work = os.path.join(BUILD, a.size)
    os.makedirs(work, exist_ok=True)
    t0 = time.time()

    # 1) cues: shot list, effect cues, labels, music stop/sting (all derived from the voice timing)
    run(['node', 'engine/render.cjs', '--page', PAGE, '--mode', 'cues', '--w', '540', '--h', '960', '--out', rel(os.path.join(BUILD, 'cues.json'))], cwd=LJ)
    cues = json.load(open(os.path.join(BUILD, 'cues.json')))
    frames = round(cues['duration'] * a.fps)

    # 2) audio
    if 'audio' not in skip:
        run([sys.executable, os.path.join(HERE, 'make_audio.py')], cwd=REEL)

    # 3) plates: split into chunks rendered in parallel, then joined losslessly
    plates = os.path.join(work, 'plates.mkv')
    if 'plates' not in skip:
        n = max(1, a.jobs)
        bounds = [round(frames * i / n) for i in range(n + 1)]
        procs = []
        for i in range(n):
            part = os.path.join(work, f'plates_{i}.mkv')
            log = open(os.path.join(work, f'plates_{i}.log'), 'w')
            cmd = ['node', 'engine/render.cjs', '--page', PAGE, '--mode', 'plates', '--w', str(w), '--h', str(h), '--fps', str(a.fps),
                   '--from', str(bounds[i]), '--to', str(bounds[i + 1]), '--out', rel(part)]
            print('$', ' '.join(cmd), flush=True)
            procs.append((subprocess.Popen(cmd, cwd=LJ, stdout=log, stderr=subprocess.STDOUT), part))
        for p, part in procs:
            if p.wait() != 0:
                sys.exit(f'plate render failed: {part}')
        lst = os.path.join(work, 'plates.txt')
        with open(lst, 'w') as f:
            for _, part in procs:
                f.write(f"file '{os.path.basename(part)}'\n")
        run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', plates])

    # 4) text overlay (subtitles + labels) with alpha
    overlay = os.path.join(work, 'overlay.mov')
    if 'overlay' not in skip:
        run(['node', 'engine/render.cjs', '--page', OVERLAY, '--mode', 'overlay', '--w', str(w), '--h', str(h), '--fps', str(a.fps),
             '--out', rel(overlay)], cwd=LJ)

    # 5) compose: plates + overlay + mix -> H.264 (CRF 18, yuv420p) + AAC 48 kHz
    mix = os.path.join(BUILD, 'audio', 'mix.wav')
    out = os.path.join(OUT, 'reel_haunted-house.mp4') if a.size == 'final' else os.path.join(BUILD, 'preview', 'reel_preview.mp4')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    run(['ffmpeg', '-v', 'error', '-y', '-i', plates, '-i', overlay, '-i', mix,
         '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]',
         '-map', '[v]', '-map', '2:a', '-r', str(a.fps), '-frames:v', str(frames),
         '-c:v', 'libx264', '-crf', '18', '-preset', 'slow' if a.size == 'final' else 'medium', '-pix_fmt', 'yuv420p',
         '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', '-shortest', out])
    print(f'done: {out}  ({(time.time() - t0) / 60:.1f} min)')


if __name__ == '__main__':
    main()
