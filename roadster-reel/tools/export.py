#!/usr/bin/env python3
"""Final export: rendered 3D video (no subtitles) + burned-in word subtitles + mixed audio
-> out/john_roadster_reel.mp4  (H.264 High, yuv420p, 1080x1920, 30 fps, AAC 48 kHz).
Does NOT re-render the 3D: it reuses build/clean.mkv (concatenated render chunks)."""
import glob, json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import subs  # noqa

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('REEL_OUT') or os.path.join(ROOT, 'out', 'john_roadster_reel.mp4')


def ensure_clean_video():
    clean = os.path.join(ROOT, 'build', 'clean.mkv')
    chunks = sorted(glob.glob(os.path.join(ROOT, 'build', 'chunks', 'chunk_*_*.mkv')))
    chunks = [c for c in chunks if not c.endswith('.part.mkv')]
    if chunks and (not os.path.exists(clean) or os.path.getmtime(clean) < max(os.path.getmtime(c) for c in chunks)):
        lst = os.path.join(ROOT, 'build', 'chunks', 'list.txt')
        open(lst, 'w').write(''.join(f"file '{c}'\n" for c in chunks))
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', clean], check=True)
    if not os.path.exists(clean):
        shipped = os.path.join(ROOT, 'out', 'clean_video_no_subtitles.mp4')
        if os.path.exists(shipped):
            return shipped
        sys.exit('No rendered 3D video found (build/clean.mkv or out/clean_video_no_subtitles.mp4). Render it: node render/render.mjs frames')
    return clean


def write_master(clean):
    """Keep a copy of the rendered 3D (no subtitles, no audio) in out/, so a fresh checkout can
    re-export with new voices without re-rendering."""
    master = os.path.join(ROOT, 'out', 'clean_video_no_subtitles.mp4')
    if clean == master or (os.path.exists(master) and os.path.getmtime(master) >= os.path.getmtime(clean)):
        return
    os.makedirs(os.path.dirname(master), exist_ok=True)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', clean, '-an',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
                    '-maxrate', '12M', '-bufsize', '24M', '-g', '60', '-movflags', '+faststart', master], check=True)
    print('[export]', os.path.relpath(master, ROOT))


def main():
    tl = json.load(open(os.path.join(ROOT, 'timeline.json')))
    fps = tl['fps']; nframes = round(tl['duration'] * fps)
    clean = ensure_clean_video()
    write_master(clean)
    mix = os.path.join(ROOT, 'build', 'mix.wav')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    items = subs.load_words()
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
           '-i', clean,
           '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{subs.W}x{subs.BAND_H}', '-r', str(fps), '-i', 'pipe:0',
           '-i', mix,
           '-filter_complex', f'[0:v][1:v]overlay=0:{subs.BAND_Y0}:format=auto,format=yuv420p,setsar=1[v]',
           '-map', '[v]', '-map', '2:a',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
           '-maxrate', '10M', '-bufsize', '20M', '-r', str(fps), '-g', str(fps * 2),
           '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
           '-movflags', '+faststart', '-frames:v', str(nframes), '-shortest', OUT]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(nframes):
        p.stdin.write(subs.frame_overlay(items, i / fps))
    p.stdin.close()
    if p.wait() != 0:
        sys.exit('ffmpeg failed')
    print('[export]', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
