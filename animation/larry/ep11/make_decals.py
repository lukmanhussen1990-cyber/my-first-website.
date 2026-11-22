"""Episode 11 in-world graphics (Pillow). Usage: python3 make_decals.py <out_dir>"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
FB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FSERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"


def font(p, s):
    return ImageFont.truetype(p, s)


def ctext(d, xy, text, f, fill, anchor="mm"):
    d.text(xy, text, font=f, fill=fill, anchor=anchor)


# 1. Apron bib (alpha): WORLD'S BEST STEPDAD
im = Image.new("RGBA", (800, 1000), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.polygon([(150, 0), (650, 0), (700, 260), (800, 1000), (0, 1000), (100, 260)], fill=(245, 120, 150, 255))
d.polygon([(150, 0), (650, 0), (700, 260), (800, 1000), (0, 1000), (100, 260)], outline=(255, 255, 255, 255), width=14)
ctext(d, (400, 380), "WORLD'S", font(FK, 110), (255, 255, 255))
ctext(d, (400, 510), "BEST", font(FK, 140), (255, 255, 255))
ctext(d, (400, 660), "STEPDAD", font(FK, 128), (255, 255, 255))
d.ellipse((340, 760, 460, 880), fill=(220, 40, 70))       # a little heart-ish dot
im.save(f"{OUT}/apron_stepdad.png")

# 2. NORTH POLE sign
im = Image.new("RGB", (1400, 420), (250, 250, 250))
d = ImageDraw.Draw(im)
d.rectangle((12, 12, 1388, 408), outline=(200, 20, 30), width=18)
ctext(d, (700, 210), "NORTH POLE", font(FK, 210), (200, 20, 30))
im.save(f"{OUT}/sign_northpole.png")

# 3. WELCOME TO HELL sign (scorched wood)
im = Image.new("RGB", (1600, 560), (60, 22, 10))
d = ImageDraw.Draw(im)
d.rectangle((16, 16, 1584, 544), outline=(255, 120, 30), width=16)
ctext(d, (800, 190), "WELCOME TO", font(FSERIF, 150), (255, 170, 60))
ctext(d, (800, 380), "HELL", font(FSERIF, 230), (255, 80, 30))
im.save(f"{OUT}/sign_hell.png")

print("ep11 decals ->", OUT)
