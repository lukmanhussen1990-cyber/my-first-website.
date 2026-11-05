"""Check out/final.mp4: size/fps/length, that the voiceover is in sync and unchanged,
and make a contact sheet with one frame from every shot.
Usage: python3 -I scripts/verify.py <sheet.png>"""
import glob
import json
import re
import subprocess
import sys

import numpy as np

FINAL = 'out/final.mp4'
SR = 16000


def pcm(path, start=0, dur=None):
    cmd = ['ffmpeg', '-nostdin', '-loglevel', 'error', '-ss', str(start), '-i', path]
    if dur:
        cmd += ['-t', str(dur)]
    cmd += ['-f', 's16le', '-ac', '1', '-ar', str(SR), '-']
    return np.frombuffer(subprocess.run(cmd, check=True, capture_output=True).stdout, np.int16).astype(np.float32) / 32768


info = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', FINAL], capture_output=True, check=True).stdout)
for s in info['streams']:
    if s['codec_type'] == 'video':
        print(f"video: {s['codec_name']} {s['width']}x{s['height']} {s['r_frame_rate']} fps, {s.get('nb_frames')} frames")
    else:
        print(f"audio: {s['codec_name']} {s['sample_rate']} Hz, {s['channels']} ch")
words = json.load(open('words.json'))
print(f"length: {float(info['format']['duration']):.3f} s (voiceover {words['duration']:.3f} s + 1 s = {words['duration'] + 1:.3f} s)")

# Voice sync: cross-correlate the final audio with the original voiceover in a few windows.
voice = pcm('public/voiceover.mp3')
final = pcm(FINAL)
for t0 in [1.0, 30.0, 60.0, 90.0, 104.0]:
    a = voice[int(t0 * SR): int((t0 + 3) * SR)]
    b = final[int((t0 - 0.1) * SR): int((t0 + 3.1) * SR)]
    c = np.correlate(b, a, 'valid')
    lag = (np.argmax(c) - int(0.1 * SR)) / SR
    # how much of the final audio in this window is explained by the voice
    seg = final[int(t0 * SR): int((t0 + 3) * SR)]
    k = float(np.dot(seg, a) / max(1e-9, np.dot(a, a)))
    resid = seg - k * a
    snr = 10 * np.log10(np.dot(a, a) / max(1e-9, np.dot(resid, resid)))
    print(f"  voice @ {t0:5.1f}s: offset {lag * 1000:+.1f} ms, voice gain x{k:.3f}, voice-to-(music+sfx) {snr:.1f} dB")

# One frame from the middle of each shot.
shots = []
for f in sorted(glob.glob('src/shots/act*.tsx')):
    for m in re.finditer(r"\{id: '([^']+)', start: ([\d.]+), end: ([\d.]+)", open(f).read()):
        shots.append((m.group(1), float(m.group(2)), min(float(m.group(3)), words['duration'] + 1)))
shots.sort(key=lambda s: s[1])
from PIL import Image, ImageDraw

W, H = 160, 284
cols = 11
rows = (len(shots) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * (H + 18)), (16, 16, 20))
d = ImageDraw.Draw(sheet)
for i, (sid, a, b) in enumerate(shots):
    t = a + (b - a) * 0.55
    raw = subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-ss', f'{t:.3f}', '-i', FINAL, '-frames:v', '1', '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    im = Image.frombytes('RGB', (W, H), raw)
    x, y = (i % cols) * W, (i // cols) * (H + 18)
    sheet.paste(im, (x, y + 18))
    d.text((x + 4, y + 3), f'{sid} {t:.1f}s', fill=(255, 225, 120))
sheet.save(sys.argv[1])
print('sheet:', sys.argv[1], len(shots), 'shots')
