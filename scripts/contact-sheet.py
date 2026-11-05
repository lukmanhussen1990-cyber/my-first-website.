"""Contact sheet from a jobs.json. Usage: python3 -I scripts/contact-sheet.py <jobs.json> <out.png> [cols=6] [w=300]"""
import json
import sys

from PIL import Image, ImageDraw, ImageFont

jobs = json.load(open(sys.argv[1]))
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
W = int(sys.argv[4]) if len(sys.argv) > 4 else 300
H = W * 16 // 9
rows = (len(jobs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * (H + 26)), (20, 20, 24))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
except Exception:
    font = ImageFont.load_default()
for i, j in enumerate(jobs):
    try:
        im = Image.open(j['out']).convert('RGB').resize((W, H))
    except Exception:
        continue
    x, y = (i % cols) * W, (i // cols) * (H + 26)
    sheet.paste(im, (x, y + 26))
    d.text((x + 6, y + 3), j.get('label', ''), fill=(255, 230, 120), font=font)
sheet.save(sys.argv[2])
