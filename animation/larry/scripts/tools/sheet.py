"""Detail sheet: the 3 preview stills of 1-2 shots side by side (270x480 each) to review them.
Usage: python3 sheet.py <episode number> out.png sh01 [sh02]"""
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
ep, out, shots = sys.argv[1], sys.argv[2], sys.argv[3:]
W = os.environ.get("LARRY_WORK", os.path.expanduser("~/larry_work"))
F = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf", 18)
tiles = []
for sh in shots:
    for f in sorted(glob.glob(f"{W}/ep{ep}/preview/{sh}_p*.png")):
        im = Image.open(f).convert("RGB").resize((270, 480))
        ImageDraw.Draw(im).text((6, 6), os.path.basename(f)[:-4], fill=(255, 255, 0), font=F)
        tiles.append(im)
s = Image.new("RGB", (270 * len(tiles), 480))
for i, t in enumerate(tiles):
    s.paste(t, (270 * i, 0))
s.save(out); print(out, s.size)
