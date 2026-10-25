#!/usr/bin/env python3
"""Tile labelled frames into a contact sheet: tile.py index.json out.jpg [cols] [thumb_w]"""
import json, sys
from PIL import Image, ImageDraw, ImageFont

items = json.load(open(sys.argv[1]))
out = sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 300
th = tw * 16 // 9
rows = (len(items) + cols - 1) // cols
pad, lab = 8, 30
sheet = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + lab + pad) + pad), (24, 18, 14))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 17)
except Exception:
    font = ImageFont.load_default()
for i, it in enumerate(items):
    im = Image.open(it["f"]).convert("RGB").resize((tw, th), Image.LANCZOS)
    x = pad + (i % cols) * (tw + pad); y = pad + (i // cols) * (th + lab + pad)
    sheet.paste(im, (x, y + lab))
    d.text((x + 4, y + 6), it["label"], fill=(240, 228, 205), font=font)
sheet.save(out, quality=88)
