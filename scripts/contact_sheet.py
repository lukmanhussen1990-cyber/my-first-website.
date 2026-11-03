"""Build labelled contact sheets from a folder of frames.
usage: python3 contact_sheet.py <in_dir> <out_prefix> <cols> <rows> <tile_w> [label_mode]
label_mode: 'ref2s' labels tiles with timestamps (frame i -> (i-1)*2 s); default labels with filename.
"""
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont

in_dir, out_prefix = sys.argv[1], sys.argv[2]
cols, rows, tile_w = int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
mode = sys.argv[6] if len(sys.argv) > 6 else 'name'
files = sorted(glob.glob(os.path.join(in_dir, '*.jpg')) + glob.glob(os.path.join(in_dir, '*.png')))
per = cols * rows
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
except Exception:
    font = ImageFont.load_default()
for s in range(0, len(files), per):
    chunk = files[s:s + per]
    im0 = Image.open(chunk[0])
    tile_h = int(im0.height * tile_w / im0.width)
    sheet = Image.new('RGB', (cols * tile_w, rows * tile_h), (20, 20, 20))
    for i, f in enumerate(chunk):
        im = Image.open(f).convert('RGB').resize((tile_w, tile_h), Image.LANCZOS)
        x, y = (i % cols) * tile_w, (i // cols) * tile_h
        sheet.paste(im, (x, y))
        d = ImageDraw.Draw(sheet)
        if mode == 'ref2s':
            idx = int(os.path.splitext(os.path.basename(f))[0].split('_')[-1])
            label = f"{(idx - 1) * 2}s"
        else:
            label = os.path.splitext(os.path.basename(f))[0]
        d.rectangle([x, y, x + 12 + 16 * len(label), y + 36], fill=(0, 0, 0))
        d.text((x + 6, y + 4), label, fill=(255, 255, 0), font=font)
    out = f"{out_prefix}_{s // per + 1:02d}.jpg"
    sheet.save(out, quality=88)
    print(out, sheet.size)
