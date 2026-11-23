"""Episode 12 in-world graphics (Pillow). Usage: python3 make_decals.py <out_dir>"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
FB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FO = "/usr/share/fonts/opentype/inter/Inter-BlackItalic.otf"


def font(p, s):
    return ImageFont.truetype(p, s)


# 1. Sticky note left on the windscreen: "YOU DROPPED THIS" in black marker, with an arrow
im = Image.new("RGBA", (800, 800), (255, 226, 70, 255))
d = ImageDraw.Draw(im)
d.rectangle((0, 0, 799, 60), fill=(240, 205, 50, 255))                       # sticky strip
for i, line in enumerate(("YOU", "DROPPED", "THIS")):
    d.text((400, 230 + i * 150), line, font=font(FO, 150 if i != 1 else 128), fill=(20, 20, 24, 255), anchor="mm")
d.line((560, 690, 700, 760), fill=(20, 20, 24, 255), width=18)              # arrow pointing at the bogey
d.polygon([(700, 760), (640, 770), (690, 715)], fill=(20, 20, 24, 255))
im.save(f"{OUT}/note.png")

# 2. Meeting-room screen: Q3 RESULTS slide with a bar chart going up
im = Image.new("RGB", (1600, 900), (250, 250, 252))
d = ImageDraw.Draw(im)
d.rectangle((0, 0, 1600, 150), fill=(24, 64, 140))
d.text((800, 75), "Q3 RESULTS", font=font(FK, 96), fill=(255, 255, 255), anchor="mm")
base = 820
for k, h in enumerate((180, 260, 330, 450, 560)):
    x = 260 + k * 230
    d.rectangle((x, base - h, x + 150, base), fill=(40, 120, 230))
d.line((200, base, 1420, base), fill=(40, 40, 50), width=8)
d.line((200, 220, 200, base), fill=(40, 40, 50), width=8)
im.save(f"{OUT}/slide_q3.png")

print("ep12 decals ->", OUT)
