#!/usr/bin/env python3
"""Render test stills of named shots.

  python3 tools/shot_stills.py 15b 16c@0.8 18d@0.3,0.7 --outdir build/test/x [--cues] [--w 540 --h 960] [--grid]

A shot id renders at the middle of the shot; "@f" picks a fraction (or several, comma separated).
--cues refreshes build/cues.json first (needed after shot start times change).
--grid also saves a contact sheet of the stills (grid.jpg in the outdir).
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import common

LJ, BUILD = Path(common.LJ), Path(common.BUILD)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('shots', nargs='+')
    ap.add_argument('--outdir', default=str(BUILD / 'test' / 'stills'))
    ap.add_argument('--w', type=int, default=540)
    ap.add_argument('--h', type=int, default=960)
    ap.add_argument('--cues', action='store_true')
    ap.add_argument('--grid', action='store_true')
    a = ap.parse_args()
    page = 'haunted-house/scene/index.html'
    cues_path = BUILD / 'cues.json'
    if a.cues or not cues_path.exists():
        subprocess.run(['node', 'engine/render.cjs', '--page', page, '--mode', 'cues', '--w', '540', '--h', '960',
                        '--out', str(cues_path.relative_to(LJ))], cwd=LJ, check=True)
    shots = {s['id']: s for s in json.loads(cues_path.read_text())['shots']}
    times, names = [], []
    for spec in a.shots:
        sid, _, fr = spec.partition('@')
        if sid not in shots:
            sys.exit(f'unknown shot {sid}')
        s = shots[sid]
        for f in (fr.split(',') if fr else ['0.5']):
            f = float(f)
            times.append(s['at'] + (s['end'] - s['at']) * f)
            names.append(sid if not fr else f'{sid}_{int(round(f * 100)):02d}')
    out = Path(a.outdir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    subprocess.run(['node', 'engine/render.cjs', '--page', page, '--mode', 'stills', '--w', str(a.w), '--h', str(a.h),
                    '--times', ','.join(f'{t:.3f}' for t in times), '--names', ','.join(names),
                    '--outdir', str(out.relative_to(LJ))], cwd=LJ, check=True)
    if a.grid:
        from PIL import Image
        ims = [Image.open(out / f'{n}.png') for n in names]
        cols = min(len(ims), 6)
        rows = (len(ims) + cols - 1) // cols
        w, h = ims[0].size
        sheet = Image.new('RGB', (cols * w, rows * h), 'white')
        for i, im in enumerate(ims):
            sheet.paste(im.convert('RGB'), ((i % cols) * w, (i // cols) * h))
        sheet.save(out / 'grid.jpg', quality=88)
        print('grid', out / 'grid.jpg')


if __name__ == '__main__':
    main()
