"""Episode 13 in-world graphics (Pillow). Usage: python3 make_decals.py <out_dir>"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
FB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"


def font(p, s):
    return ImageFont.truetype(p, s)


def plate(name, text, size, w=1400, h=360, bg=(22, 22, 26), fg=(232, 196, 104)):
    """Desk nameplate: dark plate, brass border and lettering."""
    im = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(im)
    d.rectangle((14, 14, w - 15, h - 15), outline=fg, width=10)
    d.text((w // 2, h // 2), text, font=font(FK, size), fill=fg, anchor="mm")
    im.save(f"{OUT}/{name}.png")


plate("plate_hol", "HEAD OF LAUGHING", 150)
plate("plate_boss", "THE BOSS", 190, w=1100)

# Performance review folder (lies on the desk)
im = Image.new("RGB", (900, 1200), (196, 52, 46))
d = ImageDraw.Draw(im)
d.rectangle((60, 300, 840, 620), fill=(250, 250, 248))
d.text((450, 400), "PERFORMANCE", font=font(FK, 104), fill=(30, 30, 34), anchor="mm")
d.text((450, 525), "REVIEW", font=font(FK, 120), fill=(30, 30, 34), anchor="mm")
im.save(f"{OUT}/folder_review.png")

# Toilet door sign
im = Image.new("RGB", (700, 300), (24, 70, 150))
d = ImageDraw.Draw(im)
d.rectangle((10, 10, 689, 289), outline=(255, 255, 255), width=8)
d.text((350, 150), "TOILET", font=font(FK, 150), fill=(255, 255, 255), anchor="mm")
im.save(f"{OUT}/sign_toilet.png")

# Meeting slide
im = Image.new("RGB", (1600, 900), (250, 250, 252))
d = ImageDraw.Draw(im)
d.rectangle((0, 0, 1600, 150), fill=(24, 64, 140))
d.text((800, 75), "Q4 PLAN", font=font(FK, 96), fill=(255, 255, 255), anchor="mm")
for k, line in enumerate(("1. More synergy", "2. Fewer meetings", "3. Pizza Friday?")):
    d.text((180, 280 + k * 170), line, font=font(FB, 92), fill=(40, 40, 50), anchor="lm")
im.save(f"{OUT}/slide_q4.png")

# The memo the boss reads out
im = Image.new("RGB", (850, 1100), (250, 250, 247))
d = ImageDraw.Draw(im)
d.text((425, 120), "MEMO", font=font(FK, 110), fill=(30, 30, 34), anchor="mm")
for k in range(9):
    d.rectangle((90, 260 + k * 85, 760 - (k % 3) * 90, 290 + k * 85), fill=(150, 150, 160))
im.save(f"{OUT}/memo.png")
print("ep13 decals ->", OUT)
