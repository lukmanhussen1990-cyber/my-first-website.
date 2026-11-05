"""Quality checklist for out/final.mp4.
- exactly 1080x1920, 30 fps, plays start to end, length = narration + tail
- no black frames except the final fade
- every shot looks different from the one before it
- audio in sync with the narration (cross-correlation)
- contact sheet with one frame per shot -> out/contact_sheet.png
Usage: python3 render/verify.py"""
import json
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FINAL = os.path.join(ROOT, 'out', 'final.mp4')
tl = json.load(open(os.path.join(ROOT, 'story', 'timeline.json')))
ok = True


def check(cond, msg):
    global ok
    ok &= bool(cond)
    print(('PASS ' if cond else 'FAIL ') + msg)


info = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', FINAL], capture_output=True, check=True).stdout)
v = [s for s in info['streams'] if s['codec_type'] == 'video'][0]
a = [s for s in info['streams'] if s['codec_type'] == 'audio']
dur = float(info['format']['duration'])
check(v['width'] == 1080 and v['height'] == 1920, f"size {v['width']}x{v['height']}")
check(v['r_frame_rate'] == '30/1', f"fps {v['r_frame_rate']}")
check(abs(dur - tl['duration']) < 0.1, f"length {dur:.2f} s (timeline {tl['duration']:.2f} s), {v.get('nb_read_frames')} frames decoded")
check(len(a) == 1 and a[0]['codec_name'] == 'aac', 'AAC audio track')

# black frames
bd = subprocess.run(['ffmpeg', '-nostdin', '-i', FINAL, '-vf', 'blackdetect=d=0.05:pic_th=0.95', '-an', '-f', 'null', '-'], capture_output=True, text=True).stderr
blacks = [line for line in bd.splitlines() if 'black_start' in line]
starts = [float(x.split('black_start:')[1].split()[0]) for x in blacks]
check(all(s > tl['duration'] - 2.0 for s in starts), f"black frames only in the final fade ({len(starts)} black segments: {starts})")


def frame_at(t, w=270, h=480):
    raw = subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-ss', f'{t:.3f}', '-i', FINAL, '-frames:v', '1', '-vf', f'scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3)


frames = [frame_at(s['start'] + (s['end'] - s['start']) * 0.5) for s in tl['shots']]
diffs = [float(np.mean(np.abs(frames[i].astype(int) - frames[i - 1].astype(int)))) for i in range(1, len(frames))]
low = [(tl['shots'][i + 1]['id'], round(d, 1)) for i, d in enumerate(diffs) if d < 12]
check(not low, f"consecutive shots differ (min mean pixel diff {min(diffs):.1f}); similar pairs: {low}")

# audio sync against the narration
def pcm(path):
    raw = subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


voice = pcm(os.path.join(ROOT, 'audio', 'voice.wav'))
fin = pcm(FINAL)
SR = 16000
lags = []
for t0 in [2, 30, 60, 90, 104]:
    x = voice[t0 * SR:(t0 + 3) * SR]
    y = fin[int((t0 - 0.1) * SR):int((t0 + 3.1) * SR)]
    c = np.correlate(y, x, 'valid')
    lags.append((np.argmax(c) - int(0.1 * SR)) / SR * 1000)
check(all(abs(l) <= 25 for l in lags), f"narration in sync (offsets ms: {[round(l, 1) for l in lags]})")

W, H = 180, 320
cols = 12
rows = (len(frames) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * (H + 16)), (16, 16, 20))
d = ImageDraw.Draw(sheet)
for i, (f, s) in enumerate(zip(frames, tl['shots'])):
    x, y = (i % cols) * W, (i // cols) * (H + 16)
    sheet.paste(Image.fromarray(f).resize((W, H)), (x, y + 16))
    d.text((x + 3, y + 2), f"{s['id']} {s['start']:.1f}s", fill=(255, 225, 120))
sheet.save(os.path.join(ROOT, 'out', 'contact_sheet.png'))
print('contact sheet: out/contact_sheet.png')
print('ALL CHECKS PASSED' if ok else 'SOME CHECKS FAILED')
