"""Episode 10 in-world graphics (Pillow). Usage: python3 make_decals.py <out_dir>"""
import os, sys, random
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


# 1. Ticket: ADMIT ONE / THE TOILET SHOW / FRONT ROW $10
im = Image.new("RGB", (1200, 560), (244, 196, 48))
d = ImageDraw.Draw(im)
d.rectangle((24, 24, 1176, 536), outline=(150, 30, 30), width=10)
d.line((900, 24, 900, 536), fill=(150, 30, 30), width=6)
for y in range(40, 530, 34):                         # perforation
    d.ellipse((893, y, 907, y + 14), fill=(244, 196, 48), outline=(150, 30, 30), width=3)
ctext(d, (460, 120), "ADMIT ONE", font(FK, 110), (150, 30, 30))
ctext(d, (460, 270), "THE TOILET SHOW", font(FK, 92), (30, 30, 30))
ctext(d, (460, 420), "FRONT ROW  •  $10", font(FB, 84), (150, 30, 30))
ctext(d, (1040, 280), "No 1", font(FB, 90), (30, 30, 30))
im.save(f"{OUT}/ticket.png")

# 2. Marquee sign over the bathroom door
im = Image.new("RGB", (1800, 480), (30, 10, 10))
d = ImageDraw.Draw(im)
d.rectangle((10, 10, 1790, 470), outline=(255, 210, 90), width=16)
for x in range(40, 1780, 70):                        # bulbs
    for y in (40, 440):
        d.ellipse((x - 14, y - 14, x + 14, y + 14), fill=(255, 236, 160))
ctext(d, (900, 190), "LIVE TONIGHT", font(FK, 170), (255, 220, 110))
ctext(d, (900, 345), "THE THRONE", font(FSERIF, 110), (255, 255, 255))
im.save(f"{OUT}/sign_show.png")

# 3. Popcorn bucket stripes (wraps round the bucket)
im = Image.new("RGB", (1024, 512), (250, 250, 248))
d = ImageDraw.Draw(im)
for k in range(0, 1024, 128):
    d.rectangle((k, 0, k + 64, 512), fill=(206, 30, 36))
ctext(d, (512, 256), "POPCORN", font(FK, 120), (255, 214, 70))
im.save(f"{OUT}/popcorn.png")

print("ep10 decals ->", OUT)
