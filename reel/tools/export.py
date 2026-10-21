"""Final export: clean 3D plate + mix + burned-in subtitles -> out/great_wall_subway_reel.mp4

    python3 tools/export.py [--plate out/plate.mp4] [--out out/great_wall_subway_reel.mp4]

H.264 High / yuv420p / 1080x1920 / 30 fps CFR, AAC 192 kb/s 48 kHz stereo, +faststart.
"""
import argparse
import json
import os
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def esc(path):
    # escape a path for use inside an ffmpeg filter argument
    return path.replace('\\', '/').replace(':', r'\:').replace("'", r"\'")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--plate', default=os.path.join(ROOT, 'out', 'plate.mp4'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'out', 'great_wall_subway_reel.mp4'))
    ap.add_argument('--crf', default='19')
    a = ap.parse_args()
    tl = json.load(open(os.path.join(ROOT, 'timeline.json')))
    if not os.path.exists(a.plate):
        raise SystemExit(f'[export] missing {a.plate} - render the 3D plate first (see README)')
    subs = os.path.join(ROOT, 'out', 'subtitles.ass')
    fonts = os.path.join(ROOT, 'assets', 'fonts')
    vf = f"subtitles=filename='{esc(subs)}':fontsdir='{esc(fonts)}',fps={tl['fps']},format=yuv420p"
    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', a.plate, '-i', os.path.join(ROOT, 'out', 'mix.wav'),
           '-map', '0:v:0', '-map', '1:a:0', '-vf', vf,
           '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', a.crf, '-pix_fmt', 'yuv420p', '-r', str(tl['fps']),
           '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
           '-t', f"{tl['duration']:.3f}", '-movflags', '+faststart', a.out]
    subprocess.run(cmd, check=True)
    print(f'[export] wrote {os.path.relpath(a.out, ROOT)}')


if __name__ == '__main__':
    main()
