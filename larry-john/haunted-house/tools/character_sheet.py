#!/usr/bin/env python3
"""Render the character sheet: Larry, Larry in his bedsheet, John and the ghost, each from the front and
the side plus 6 faces (happy, shocked, scared, screaming, bored, annoyed) -> build/qc/character_sheet.png
"""
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import LJ, BUILD  # noqa: E402

ROWS = ['Larry', 'Larry (bedsheet)', 'John', 'The real ghost']
COLS = ['front', 'side', 'happy', 'shocked', 'scared', 'screaming', 'bored', 'annoyed']
out_dir = os.path.join(BUILD, 'qc', 'sheet_panels')
os.makedirs(out_dir, exist_ok=True)
names = [f'p{i:02d}' for i in range(32)]
if '--skip-render' not in sys.argv:
    subprocess.run(['node', 'engine/render.cjs', '--page', 'characters/sheet.html', '--mode', 'stills', '--w', '540', '--h', '540',
                    '--times', ','.join(str(i) for i in range(32)), '--names', ','.join(names),
                    '--outdir', os.path.relpath(out_dir, LJ)], cwd=LJ, check=True)
cell, head, side = 300, 60, 230
font = ImageFont.truetype('/root/.fonts/Fredoka-Bold.ttf', 28)
small = ImageFont.truetype('/root/.fonts/Fredoka-Bold.ttf', 22)
sheet = Image.new('RGB', (side + cell * 8, head + cell * 4 + 70), (246, 243, 236))
d = ImageDraw.Draw(sheet)
d.text((20, sheet.height - 55), 'Larry & John: character sheet (front, side, 6 faces). Built once in code, reused in every shot.', fill=(60, 50, 70), font=small)
for c, name in enumerate(COLS):
    d.text((side + c * cell + cell // 2, head // 2), name, fill=(60, 50, 70), font=font, anchor='mm')
for r, name in enumerate(ROWS):
    d.text((20, head + r * cell + cell // 2), name, fill=(40, 30, 50), font=font, anchor='lm')
    for c in range(8):
        im = Image.open(os.path.join(out_dir, f'p{r * 8 + c:02d}.png')).convert('RGB').resize((cell - 8, cell - 8), Image.LANCZOS)
        sheet.paste(im, (side + c * cell + 4, head + r * cell + 4))
out = os.path.join(BUILD, 'qc', 'character_sheet.png')
sheet.save(out)
print(out)
