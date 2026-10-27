"""Build labelled contact sheets from 1 fps frames.

usage: python3 -I tools/contact_sheet.py <frames_dir> <prefix> <out_dir> [cols] [rows] [thumb_w]
"""
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont

frames_dir, prefix, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 6
rows = int(sys.argv[5]) if len(sys.argv) > 5 else 3
tw = int(sys.argv[6]) if len(sys.argv) > 6 else 240

files = sorted(glob.glob(os.path.join(frames_dir, prefix + "_*.png")))
os.makedirs(out_dir, exist_ok=True)
im0 = Image.open(files[0])
th = round(tw * im0.height / im0.width)
per = cols * rows
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
except OSError:
    font = ImageFont.load_default()

for s in range(0, len(files), per):
    chunk = files[s:s + per]
    sheet = Image.new("RGB", (cols * tw + (cols - 1) * 4, rows * th + (rows - 1) * 4), (255, 0, 255))
    for i, f in enumerate(chunk):
        im = Image.open(f).convert("RGB").resize((tw, th), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        # 1 fps extraction: frame N is centred near t = N - 0.5 s
        n = int(os.path.basename(f).split("_")[1].split(".")[0])
        label = f"{prefix} {n - 1:02d}s"
        d.rectangle([0, 0, 112, 24], fill=(0, 0, 0))
        d.text((4, 2), label, fill=(255, 255, 0), font=font)
        sheet.paste(im, ((i % cols) * (tw + 4), (i // cols) * (th + 4)))
    out = os.path.join(out_dir, f"{prefix}_sheet_{s // per + 1:02d}.jpg")
    sheet.save(out, quality=88)
    print(out, len(chunk))
