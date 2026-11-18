"""QA contact sheet: python qa_sheet.py f0 f1 step out.jpg [cols] (captions composited)."""
import sys, json
sys.path.insert(0, "/opt/work/post")
from PIL import Image, ImageDraw
import compose

f0, f1, step, out = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
cols = int(sys.argv[5]) if len(sys.argv) > 5 else 8
shots = json.load(open("/opt/work/post/shots.json"))
def shot_of(f):
    for n, (a, b) in shots.items():
        if a <= f < b:
            return n
    return "?"
frames = list(range(f0, f1 + 1, step))
tw, th = 216, 384
rows = (len(frames) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th), "black")
d = ImageDraw.Draw(sheet)
for i, f in enumerate(frames):
    try:
        im = compose.compose_frame(f).resize((tw, th))
    except FileNotFoundError:
        continue
    x, y = (i % cols) * tw, (i // cols) * th
    sheet.paste(im, (x, y))
    d.rectangle([x, y, x + 80, y + 13], fill="black")
    d.text((x + 2, y + 1), f"{f} {shot_of(f)}", fill="yellow")
sheet.save(out, quality=85)
print(out, sheet.size)
