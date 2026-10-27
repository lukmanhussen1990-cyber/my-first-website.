#!/usr/bin/env python3
"""Quality-check sheets:
  - one full-size still per beat (3D + subtitles/labels) -> build/qc/beats/beat_XX.png
  - side-by-side sheets: each beat next to the reference frame that plays the same role in the formula
    (style/pace comparison only) -> build/qc/compare_N.jpg
  - the character sheet -> build/qc/character_sheet.png

  python3 tools/qc_sheets.py [--skip-render]
"""
import argparse
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import LJ, BUILD, load_script  # noqa: E402

QC = os.path.join(BUILD, 'qc')
REF_VIDEO = os.path.join(LJ, 'reference', 'reference_tent-to-hotel.mp4')
FONT = '/root/.fonts/Fredoka-Bold.ttf'

# beat -> (our shot, fraction into the shot), and the reference moment with the same job in the formula
PICKS = {
    1: ('1a', 0.5, 1.5, 'hook'), 2: ('2', 0.5, 4.2, 'first "Congratulations!"'), 3: ('3a', 0.65, 6.2, 'first joke + red label'),
    4: ('4b', 0.5, 9.8, 'problem gag'), 5: ('5a', 0.5, 17.8, '"So you..." upgrade'), 6: ('6b', 0.4, 14.8, 'character screams'),
    7: ('7b', 0.65, 25.3, 'upgrade + yellow label'), 8: ('8b', 0.5, 23.8, 'gag'), 9: ('9b', 0.6, 31.0, 'upgrade'),
    10: ('10b', 0.5, 51.4, 'roast line'), 11: ('11e', 0.7, 43.5, 'count-up from the same camera'), 12: ('12c', 0.6, 45.8, '"Now you need..."'),
    13: ('13c', 0.6, 47.6, 'hero ruins it'), 14: ('14a', 0.6, 52.8, '"So you hire..."'), 15: ('15a', 0.7, 62.6, 'hero ruins it'),
    16: ('16b', 0.7, 56.3, 'upgrade'), 17: ('17b', 0.6, 63.8, 'punchline + red label'), 18: ('18d', 0.6, 70.5, 'list of upgrades'),
    19: ('19', 0.6, 74.5, 'second "Congratulations!" (green)'), 20: ('20a', 0.6, 76.5, 'success'), 21: ('21c', 0.6, 82.3, 'the turn'),
    22: ('22b', 0.5, 86.4, 'panic'), 23: ('23b', 0.5, 88.8, 'escalation'), 24: ('24c', 0.7, 91.2, 'reveal'),
    25: ('25a', 0.8, 93.5, 'twist payoff'), 26: ('26c', 0.5, 106.0, 'loop back to the first shot'),
}


def run(cmd, **kw):
    print('$', ' '.join(cmd), flush=True)
    subprocess.run(cmd, check=True, **kw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skip-render', action='store_true')
    a = ap.parse_args()
    os.makedirs(os.path.join(QC, 'beats'), exist_ok=True)
    os.makedirs(os.path.join(QC, 'ref'), exist_ok=True)
    cues = json.load(open(os.path.join(BUILD, 'cues.json')))
    shots = {s['id']: s for s in cues['shots']}
    times = {b: shots[sid]['at'] + (shots[sid]['end'] - shots[sid]['at']) * f for b, (sid, f, _, _) in PICKS.items()}
    tl = ','.join(f'{times[b]:.3f}' for b in sorted(times))
    names = ','.join(f'beat_{b:02d}' for b in sorted(times))
    if not a.skip_render:
        run(['node', 'engine/render.cjs', '--page', 'haunted-house/scene/index.html', '--mode', 'stills', '--w', '1080', '--h', '1920',
             '--times', tl, '--names', names, '--outdir', os.path.relpath(os.path.join(QC, 'plates'), LJ)], cwd=LJ)
        run(['node', 'engine/render.cjs', '--page', 'haunted-house/overlay/index.html', '--mode', 'stills', '--w', '1080', '--h', '1920',
             '--times', tl, '--names', names, '--outdir', os.path.relpath(os.path.join(QC, 'overlay'), LJ)], cwd=LJ)
        for b, (_, _, rt, _) in PICKS.items():
            run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{rt:.2f}', '-i', REF_VIDEO, '-frames:v', '1', os.path.join(QC, 'ref', f'ref_{b:02d}.png')])
    font = ImageFont.truetype(FONT, 26)
    small = ImageFont.truetype(FONT, 20)
    script = {x['n']: x['text'] for x in load_script()['beats']}
    pairs = []
    for b in sorted(PICKS):
        bg = Image.open(os.path.join(QC, 'plates', f'beat_{b:02d}.png')).convert('RGBA')
        ov = Image.open(os.path.join(QC, 'overlay', f'beat_{b:02d}.png')).convert('RGBA')
        ours = Image.alpha_composite(bg, ov).convert('RGB')
        ours.save(os.path.join(QC, 'beats', f'beat_{b:02d}.png'))
        ref = Image.open(os.path.join(QC, 'ref', f'ref_{b:02d}.png')).convert('RGB')
        cw, ch = 360, 640
        cell = Image.new('RGB', (cw * 2 + 12, ch + 92), (24, 22, 32))
        cell.paste(ours.resize((cw, ch), Image.LANCZOS), (0, 92))
        cell.paste(ref.resize((cw, ch), Image.LANCZOS), (cw + 12, 92))
        d = ImageDraw.Draw(cell)
        words = script[b]
        d.text((8, 6), f'Beat {b}: ours', fill=(255, 216, 74), font=font)
        d.text((cw + 20, 6), f'reference ({PICKS[b][3]})', fill=(200, 200, 220), font=small)
        d.text((8, 40), (words[:52] + '...') if len(words) > 55 else words, fill=(230, 230, 240), font=small)
        pairs.append(cell)
    per = 6
    for k in range(0, len(pairs), per):
        chunk = pairs[k:k + per]
        cols = 3
        rows = (len(chunk) + cols - 1) // cols
        w, h = chunk[0].size
        sheet = Image.new('RGB', (cols * (w + 16) + 16, rows * (h + 16) + 16), (12, 10, 18))
        for i, c in enumerate(chunk):
            sheet.paste(c, (16 + (i % cols) * (w + 16), 16 + (i // cols) * (h + 16)))
        out = os.path.join(QC, f'compare_{k // per + 1}.jpg')
        sheet.save(out, quality=88)
        print(out)


if __name__ == '__main__':
    main()
