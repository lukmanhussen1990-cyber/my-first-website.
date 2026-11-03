"""QA contact sheets for a rendered video: frames from every scene, each labelled with the scene
number and the caption word that SHOULD be on screen at that time (same rule as src/Captions.tsx).
usage: python3 scripts/qa_sheet.py out/final.mp4 out/qa [samples_per_scene]
"""
import json, math, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

FPS = 30
video, outdir = sys.argv[1], sys.argv[2]
per = int(sys.argv[3]) if len(sys.argv) > 3 else 1
os.makedirs(outdir, exist_ok=True)
W = json.load(open('words.json'))
first = [0, 5, 12, 24, 26, 33, 42, 53, 65, 73, 80, 88, 98, 104, 120, 131, 142, 145, 154, 168, 182, 193, 197, 212, 221, 232, 239, 248, 258, 269, 279, 293]
total = math.ceil((123.01 + 1) * FPS)
wf = lambda i: round(W[i]['start'] * FPS)
scenes = []
for k, wi in enumerate(first):
    a = 0 if k == 0 else wf(wi) - 4
    b = total if k == len(first) - 1 else wf(first[k + 1]) - 4
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


samples = []
for n, a, b in scenes:
    for j in range(per):
        f = a + int((b - a) * (j + 0.5) / per)
        samples.append((n, f))

font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
tiles = []
for n, f in samples:
    path = f'{outdir}/f{f:05d}.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{f / FPS + 0.001:.3f}', '-i', video, '-frames:v', '1', '-vf', 'scale=270:480', path], check=True)
    im = Image.open(path).convert('RGB')
    d = ImageDraw.Draw(im)
    lab = f'S{n} {f / FPS:.1f}s'
    d.rectangle([0, 0, 270, 30], fill=(0, 0, 0))
    d.text((4, 3), lab, fill=(255, 230, 80), font=font)
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
