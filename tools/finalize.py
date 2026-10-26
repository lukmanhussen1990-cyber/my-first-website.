#!/usr/bin/env python3
"""Assemble deliverables.

  python3 tools/finalize.py preview   -> final/preview_lowres.mp4 (frames/preview.mp4 + audio/mix.wav)
  python3 tools/finalize.py final     -> final/man_in_the_ice.mp4 (+ _nomusic.mp4)
        scene segments frames/scene_XX.mp4 are concatenated, the text layer (frames/overlay/*.png)
        is composited on top, audio is AAC 192k; H.264 yuv420p CRF 18, +faststart.
  python3 tools/finalize.py audio     -> re-encode only the audio of those MP4s (video copied; for mix changes)
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'src', 'timeline.json')))
FR = os.path.join(ROOT, 'frames')
FIN = os.path.join(ROOT, 'final')
OUTPUTS = [('man_in_the_ice.mp4', 'mix.wav'), ('man_in_the_ice_nomusic.mp4', 'mix_nomusic.wav')]
# AAC adds about 0.6 dB of true peak; limit a little lower so the encoded file stays under -1.5 dBTP
AAC_GUARD = 'aresample=192000,alimiter=limit=0.759:attack=2:release=60:level=false,aresample=48000'


def run(cmd):
    print('$', ' '.join(cmd[:6]), '...')
    subprocess.run(cmd, check=True)


def preview():
    out = os.path.join(FIN, 'preview_lowres.mp4')
    run(['ffmpeg', '-y', '-v', 'error', '-i', os.path.join(FR, 'preview.mp4'), '-i', os.path.join(ROOT, 'audio', 'mix.wav'),
         '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out])
    print('->', os.path.relpath(out, ROOT))


def final(scale='1'):
    suffix = '' if float(scale) == 1 else f'_s{scale}'
    lst = os.path.join(FR, 'scenes.txt')
    with open(lst, 'w') as f:
        for sc in TL['scenes']:
            p = os.path.join(FR, f"scene_{sc['id']:02d}{suffix}.mp4")
            if not os.path.exists(p):
                sys.exit(f'missing {p}')
            f.write(f"file '{p}'\n")
    for name, mix in OUTPUTS:
        out = os.path.join(FIN, name)
        run(['ffmpeg', '-y', '-v', 'error',
             '-f', 'concat', '-safe', '0', '-i', lst,
             '-framerate', '30', '-i', os.path.join(FR, 'overlay', '%06d.png'),
             '-i', os.path.join(ROOT, 'audio', mix),
             '-filter_complex', '[0:v]scale=1080:1920:flags=lanczos[bg];[bg][1:v]overlay=0:0:format=auto,format=yuv420p[v];'
             f'[2:a]{AAC_GUARD}[a]',
             '-map', '[v]', '-map', '[a]',
             '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
             '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
             '-t', f"{TL['duration']:.3f}", '-movflags', '+faststart', out])
        print('->', os.path.relpath(out, ROOT))


def audio_only():
    for name, mix in OUTPUTS:
        out = os.path.join(FIN, name)
        tmp = out + '.tmp.mp4'
        run(['ffmpeg', '-y', '-v', 'error', '-i', out, '-i', os.path.join(ROOT, 'audio', mix),
             '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', AAC_GUARD, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
             '-t', f"{TL['duration']:.3f}", '-movflags', '+faststart', tmp])
        os.replace(tmp, out)
        print('->', os.path.relpath(out, ROOT))


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    if mode == 'final':
        final(sys.argv[2] if len(sys.argv) > 2 else '1')
    elif mode == 'audio':
        audio_only()
    else:
        preview()
