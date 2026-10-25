"""Tile a list of frames into a labelled contact sheet: contact.py out.jpg cols w f1 [f2 ...]"""
import sys
from PIL import Image, ImageDraw
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
fs = sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in fs]
h = int(w * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * h), 'black')
d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im.resize((w, h), Image.LANCZOS), (x, y))
    lab = f.split('/')[-1].rsplit('.', 1)[0]
    d.rectangle([x, y, x + 8 * len(lab) + 8, y + 18], fill='black')
    d.text((x + 4, y + 3), lab, fill='yellow')
sheet.save(out, quality=88)
