"""Composite overlays on rendered frames and encode the reel with the audio mix.

usage: python3 assemble.py <frames_dir> <work_dir> <audio.wav> <out.mp4> <W> <H> [step]
step: frame step of the rendered sequence (1 = every frame, 3 = draft at 10 fps).
"""
import os
import sys
import glob
import json
import subprocess
from concurrent.futures import ProcessPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import overlay as OV  # noqa: E402

FPS = 30


def job(args):
    fp, out, size, chunks = args
    meta = json.load(open(fp[:-4] + '.json'))
    OV.composite(fp, meta, chunks, out, size)
    return out


def main():
    fdir, wdir, wav, out_mp4, W, H = sys.argv[1:7]
    W, H = int(W), int(H)
    step = int(sys.argv[7]) if len(sys.argv) > 7 else 1
    maxrate = sys.argv[8] if len(sys.argv) > 8 else None      # e.g. '3.2M' keeps a 44 s reel < 20 MB
    os.makedirs(wdir, exist_ok=True)
    words = json.load(open(os.path.join(os.path.dirname(HERE), 'data', 'words.json')))
    chunks = OV.build_chunks(words)
    files = sorted(glob.glob(os.path.join(fdir, 'f_*.png')))
    files = [f for f in files if int(os.path.basename(f)[2:7]) % step == 0]
    jobs = []
    for i, fp in enumerate(files):
        out = os.path.join(wdir, f'seq_{i:05d}.png')
        jobs.append((fp, out, (W, H), chunks))
    with ProcessPoolExecutor(4) as ex:
        list(ex.map(job, jobs, chunksize=8))
    in_fps = FPS / step
    cmd = ['ffmpeg', '-v', 'error', '-y', '-framerate', f'{in_fps}', '-i', os.path.join(wdir, 'seq_%05d.png'),
           '-i', wav, '-map', '0:v', '-map', '1:a',
           '-vf', f'fps={FPS},format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18']
    if maxrate:
        cmd += ['-maxrate', maxrate, '-bufsize', str(float(maxrate.rstrip('M')) * 2) + 'M']
    cmd += ['-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out_mp4]
    subprocess.run(cmd, check=True)
    print('wrote', out_mp4, len(files), 'frames')


if __name__ == '__main__':
    main()
