#!/usr/bin/env python3
"""Assemble deliverables.

  python3 tools/finalize.py preview   -> final/preview_lowres.mp4 (frames/preview.mp4 + audio/mix.wav)
  python3 tools/finalize.py final     -> final/man_in_the_ice.mp4 (+ _nomusic.mp4)
        scene segments frames/scene_XX.mp4 are concatenated, the text layer (frames/overlay/*.png)
        is composited on top, audio is AAC 192k; H.264 yuv420p CRF 18, +faststart.
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'src', 'timeline.json')))
FR = os.path.join(ROOT, 'frames')
FIN = os.path.join(ROOT, 'final')


def run(cmd):
    print('$', ' '.join(cmd[:6]), '...')
    subprocess.run(cmd, check=True)


def preview():
    out = os.path.join(FIN, 'preview_lowres.mp4')
    run(['ffmpeg', '-y', '-v', 'error', '-i', os.path.join(FR, 'preview.mp4'), '-i', os.path.join(ROOT, 'audio', 'mix.wav'),
         '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out])
    print('->', os.path.relpath(out, ROOT))


def final():
    lst = os.path.join(FR, 'scenes.txt')
    with open(lst, 'w') as f:
        for sc in TL['scenes']:
            p = os.path.join(FR, f"scene_{sc['id']:02d}.mp4")
            if not os.path.exists(p):
                sys.exit(f'missing {p}')
            f.write(f"file '{p}'\n")
    for name, mix in [('man_in_the_ice.mp4', 'mix.wav'), ('man_in_the_ice_nomusic.mp4', 'mix_nomusic.wav')]:
        out = os.path.join(FIN, name)
        run(['ffmpeg', '-y', '-v', 'error',
             '-f', 'concat', '-safe', '0', '-i', lst,
             '-framerate', '30', '-i', os.path.join(FR, 'overlay', '%06d.png'),
             '-i', os.path.join(ROOT, 'audio', mix),
             '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]',
             '-map', '[v]', '-map', '2:a',
             '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
             '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
             '-t', f"{TL['duration']:.3f}", '-movflags', '+faststart', out])
        print('->', os.path.relpath(out, ROOT))


if __name__ == '__main__':
    {'preview': preview, 'final': final}[sys.argv[1] if len(sys.argv) > 1 else 'preview']()
