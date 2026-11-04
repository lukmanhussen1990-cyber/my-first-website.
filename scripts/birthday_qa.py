"""QA for the Birthday video: contact sheets with frames from every scene (labelled with the scene, the time
and the caption word that SHOULD be on screen, same rule as src/birthday/Captions.tsx), plus checks that the
voice in the final file is the original voiceover, unchanged and in sync.
usage: python3 scripts/birthday_qa.py birthday/out/final.mp4 birthday/out/qa [samples_per_scene]
"""
import json, math, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FPS = 30
video, outdir = sys.argv[1], sys.argv[2]
per = int(sys.argv[3]) if len(sys.argv) > 3 else 2
os.makedirs(outdir, exist_ok=True)
W = json.load(open('birthday/words.json'))
FIRST = [0, 9, 21, 36, 47, 70, 85, 98, 112, 120, 138, 159, 167, 181, 195, 215, 237, 258, 278]
TOTAL = math.ceil((108.826063 + 1) * FPS)
wf = lambda i: round(W[i]['start'] * FPS)
scenes = []
for k, wi in enumerate(FIRST):
    a = 0 if k == 0 else wf(wi) - 4
    b = TOTAL if k == len(FIRST) - 1 else wf(FIRST[k + 1]) - 4
    scenes.append((k + 1, a, b))


def expected(frame):
    t = frame / FPS
    idx = -1
    for i, w in enumerate(W):
        if w['start'] <= t + 0.5 / FPS:
            idx = i
        else:
            break
    if idx < 0:
        return '-'
    w = W[idx]
    nxt = W[idx + 1]['start'] if idx + 1 < len(W) else 1e9
    return w['word'] if t <= min(nxt, w['end'] + 0.55) else '-'


# ---------------------------------------------------------------- frames
samples = []
for n, a, b in scenes:
    for j in range(per):
        samples.append((n, a + int((b - a) * (j + 0.5) / per)))
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
tiles = []
for n, f in samples:
    path = f'{outdir}/f{f:05d}.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-vf', f'select=eq(n\\,{f}),scale=270:480', '-vsync', 'vfr', '-frames:v', '1', path], check=True)
    im = Image.open(path).convert('RGB')
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 270, 30], fill=(0, 0, 0))
    d.text((4, 3), f'S{n} {f / FPS:.1f}s', fill=(255, 230, 80), font=font)
    d.rectangle([0, 450, 270, 480], fill=(0, 0, 0))
    d.text((4, 453), 'expect: ' + expected(f), fill=(120, 255, 120), font=font)
    tiles.append(im)
cols, rows = 8, 2
for s in range(0, len(tiles), cols * rows):
    chunk = tiles[s:s + cols * rows]
    sheet = Image.new('RGB', (cols * 270, rows * 480), (10, 10, 10))
    for i, im in enumerate(chunk):
        sheet.paste(im, ((i % cols) * 270, (i // cols) * 480))
    out = f'{outdir}/qa_{s // (cols * rows) + 1:02d}.jpg'
    sheet.save(out, quality=88)
    print(out)

# ---------------------------------------------------------------- the voice: unchanged and in sync
SR = 44100
dec = lambda src, ch: np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-'], capture_output=True, check=True).stdout, dtype=np.float32).astype(np.float64)
orig = dec('birthday/voiceover.mp3', 1)
fin = dec(video, 2).reshape(-1, 2)
bed = dec('birthday/out/tmp/audio_bed.wav', 2).reshape(-1, 2) if os.path.exists('birthday/out/tmp/audio_bed.wav') else None
mono = fin.mean(axis=1)
n = min(len(orig), len(mono))
# lag between original voice and the final mix (should be 0)
seg = slice(int(10 * SR), int(40 * SR))
a = orig[seg] - orig[seg].mean()
best = None
for lag in range(-2000, 2001, 1):
    b = mono[seg.start + lag: seg.stop + lag]
    if len(b) != len(a):
        continue
    c = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))
    if best is None or c > best[1]:
        best = (lag, c)
print(f'voice alignment: best lag {best[0]} samples ({best[0] / SR * 1000:.1f} ms), correlation {best[1]:.4f}')
# remove the known music/effects bed and compare what is left with the original voice
if bed is not None:
    m = min(n, len(bed))
    resid = mono[:m] - bed[:m].mean(axis=1)
    err = resid - orig[:m]
    snr = 10 * np.log10(np.sum(orig[:m] ** 2) / (np.sum(err ** 2) + 1e-12))
    gain = float(np.dot(resid, orig[:m]) / np.dot(orig[:m], orig[:m]))
    print(f'voice after removing the bed: gain {gain:.4f} (1.0 = unchanged level), match {snr:.1f} dB SNR (AAC coding noise only)')
dur_v = float(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', video], capture_output=True, text=True).stdout.strip())
print(f'video frames {int(dur_v)} (expected {TOTAL}); voice length {len(orig) / SR:.3f}s, final audio {len(mono) / SR:.3f}s')
