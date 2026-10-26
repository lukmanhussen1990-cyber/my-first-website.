#!/usr/bin/env python3
"""QA contact sheets: one frame every 3 s, with the text layer on top.

  python3 tools/qa_sheet.py --scene 10 [--scale 0.75]   -> frames/qa/scene_10.png  (3D segment + overlay PNGs)
  python3 tools/qa_sheet.py --video final/man_in_the_ice.mp4   -> frames/qa/final_1.png, final_2.png ...
"""
import argparse, json, os, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'src', 'timeline.json')))
FPS = 30
QA = os.path.join(ROOT, 'frames', 'qa')
FONT = ImageFont.truetype(os.path.join(ROOT, 'assets', 'fonts', 'Montserrat-ExtraBold.ttf'), 26)
TW, TH, COLS = 300, 533, 6


def grab(video, t, out):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{t:.4f}', '-i', video, '-frames:v', '1', out], check=True)
    return Image.open(out).convert('RGB')


def thumb(img, label):
    im = img.resize((TW, TH), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, TW, 34), fill=(0, 0, 0))
    d.text((8, 4), label, font=FONT, fill=(255, 210, 90))
    return im


def sheet(thumbs, path):
    rows = (len(thumbs) + COLS - 1) // COLS
    out = Image.new('RGB', (COLS * (TW + 6), rows * (TH + 6)), (20, 20, 20))
    for i, im in enumerate(thumbs):
        out.paste(im, ((i % COLS) * (TW + 6), (i // COLS) * (TH + 6)))
    out.save(path)
    print('->', os.path.relpath(path, ROOT))


def scene_times(sc):
    ts = [t for t in [i * 3.0 for i in range(int(TL['duration'] / 3) + 1)] if sc['start'] <= t < sc['end'] - 0.05]
    if len(ts) < 3:   # short scenes: always look at the start, middle and end
        ts = sorted(set(ts + [sc['start'] + 0.3, (sc['start'] + sc['end']) / 2, sc['end'] - 0.2]))
    return ts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scene', type=int)
    ap.add_argument('--scale', default='0.75')
    ap.add_argument('--video')
    a = ap.parse_args()
    os.makedirs(QA, exist_ok=True)
    tmp = tempfile.mkdtemp()
    if a.scene:
        sc = next(s for s in TL['scenes'] if s['id'] == a.scene)
        suffix = '' if float(a.scale) == 1 else f'_s{a.scale}'
        video = os.path.join(ROOT, 'frames', f"scene_{sc['id']:02d}{suffix}.mp4")
        f0 = round(sc['start'] * FPS)
        thumbs = []
        for t in scene_times(sc):
            f = round(t * FPS)
            bg = grab(video, (f - f0) / FPS, os.path.join(tmp, 'f.png')).resize((1080, 1920), Image.LANCZOS)
            ov = Image.open(os.path.join(ROOT, 'frames', 'overlay', f'{f:06d}.png')).convert('RGBA')
            img = Image.alpha_composite(bg.convert('RGBA'), ov).convert('RGB')
            thumbs.append(thumb(img, f'S{sc["id"]}  {t:.1f}s'))
        sheet(thumbs, os.path.join(QA, f"scene_{sc['id']:02d}.png"))
    else:
        times = [i * 3.0 for i in range(int(TL['duration'] / 3) + 1) if i * 3.0 < TL['duration'] - 0.05]
        thumbs = [thumb(grab(a.video, t, os.path.join(tmp, 'f.png')), f'{t:.0f}s') for t in times]
        per = COLS * 3
        for k in range(0, len(thumbs), per):
            sheet(thumbs[k:k + per], os.path.join(QA, f'final_{k // per + 1}.png'))


if __name__ == '__main__':
    main()
