"""Episode 5 in-world graphics (Pillow). Usage: python3 make_decals.py <out_dir>"""
import os, sys, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
FBO = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
FM = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
FHAND = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"


def font(p, s):
    return ImageFont.truetype(p, s)


def ctext(d, xy, text, f, fill, anchor="mm", **kw):
    d.text(xy, text, font=f, fill=fill, anchor=anchor, **kw)


def heart(d, cx, cy, s, fill):
    d.ellipse((cx - s, cy - s * 0.75, cx, cy + s * 0.25), fill=fill)
    d.ellipse((cx, cy - s * 0.75, cx + s, cy + s * 0.25), fill=fill)
    d.polygon([(cx - s * 0.97, cy - 0.1 * s), (cx + s * 0.97, cy - 0.1 * s), (cx, cy + s * 1.05)], fill=fill)


# 1. Workshop wall calendar: every day crossed off, "6 MONTHS!" scrawled with a heart
im = Image.new("RGB", (900, 1100), (250, 248, 240))
d = ImageDraw.Draw(im)
d.rectangle((0, 0, 900, 230), fill=(200, 40, 50))
ctext(d, (450, 80), "LARRY'S PROJECT", font(FK, 78), (255, 255, 255))
ctext(d, (450, 175), "DAY 183", font(FB, 64), (255, 220, 220))
for r in range(5):
    for c in range(7):
        x0, y0 = 40 + c * 117, 270 + r * 150
        d.rectangle((x0, y0, x0 + 110, y0 + 140), outline=(170, 170, 170), width=3)
        d.text((x0 + 8, y0 + 6), str(r * 7 + c + 1), font=font(FBO, 30), fill=(80, 80, 80))
        d.line((x0 + 14, y0 + 30, x0 + 98, y0 + 128), fill=(210, 30, 40), width=9)
        d.line((x0 + 98, y0 + 30, x0 + 14, y0 + 128), fill=(210, 30, 40), width=9)
im.save(f"{OUT}/calendar.png")

# 2. Carved heart + "FOR YOU" for the chair's backrest (dark burnt-in wood, transparent)
im = Image.new("RGBA", (800, 700), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
heart(d, 400, 290, 230, (70, 36, 16, 235))
heart(d, 400, 290, 190, (0, 0, 0, 0))
ctext(d, (400, 600), "FOR YOU", font(FHAND, 110), (70, 36, 16, 235))
im = im.filter(ImageFilter.GaussianBlur(1.2))
im.save(f"{OUT}/chair_heart.png")

# 3. Wood-chip sack label
im = Image.new("RGB", (900, 700), (196, 160, 110))
d = ImageDraw.Draw(im)
rnd = random.Random(2)
for _ in range(2500):                                         # burlap speckle
    x, y = rnd.randrange(900), rnd.randrange(700)
    d.point((x, y), fill=(170, 135, 90))
d.rectangle((30, 30, 870, 670), outline=(90, 55, 25), width=12)
ctext(d, (450, 160), "LARRY'S", font(FK, 150), (90, 45, 20))
ctext(d, (450, 330), "WOOD CHIPS", font(FK, 120), (90, 45, 20))
ctext(d, (450, 470), "100% LARRY", font(FB, 70), (150, 30, 35))
heart(d, 450, 590, 45, (180, 30, 40))
im.save(f"{OUT}/sack_label.png")

# 4. Bus destination LED sign + bus stop sign
im = Image.new("RGB", (1200, 220), (10, 10, 12))
d = ImageDraw.Draw(im)
ctext(d, (600, 112), "42  HOME", font(FM, 150), (255, 160, 20))
glow = im.filter(ImageFilter.GaussianBlur(8))
Image.blend(im, glow, 0.35).save(f"{OUT}/bus_dest.png")
im = Image.new("RGB", (600, 800), (25, 90, 170))
d = ImageDraw.Draw(im)
d.rectangle((10, 10, 590, 790), outline=(255, 255, 255), width=14)
ctext(d, (300, 160), "BUS", font(FK, 170), (255, 255, 255))
ctext(d, (300, 330), "STOP", font(FK, 170), (255, 255, 255))
d.rounded_rectangle((120, 470, 480, 680), 30, fill=(255, 255, 255))
d.rectangle((150, 500, 450, 590), fill=(25, 90, 170))
for x in (190, 410):
    d.ellipse((x - 35, 650, x + 35, 720), fill=(255, 255, 255))
im.save(f"{OUT}/bus_stop.png")

# 5. Rocket side lettering (vertical) and mission patch
im = Image.new("RGBA", (300, 1400), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
for i, ch in enumerate("NO SEATS"):
    ctext(d, (150, 100 + i * 165), ch, font(FK, 150), (20, 40, 110, 255))
im.save(f"{OUT}/rocket_text.png")

# 6. Space station: NO SITTING ZONE sign, airlock stencil, mission patch
im = Image.new("RGB", (1000, 700), (250, 200, 20))
d = ImageDraw.Draw(im)
for k in range(-700, 1000, 80):                               # hazard stripes border
    d.polygon([(k, 0), (k + 40, 0), (k + 40 + 60, 60), (k + 60, 60)], fill=(20, 20, 20))
    d.polygon([(k, 640), (k + 40, 640), (k + 100, 700), (k + 60, 700)], fill=(20, 20, 20))
ctext(d, (500, 170), "NO SITTING", font(FK, 130), (20, 20, 20))
ctext(d, (500, 300), "ZONE", font(FK, 130), (20, 20, 20))
cx, cy = 500, 480                                             # crossed-out chair icon
d.rectangle((cx - 60, cy - 90, cx - 40, cy + 20), fill=(20, 20, 20))
d.rectangle((cx - 60, cy, cx + 60, cy + 20), fill=(20, 20, 20))
d.rectangle((cx - 60, cy + 20, cx - 45, cy + 90), fill=(20, 20, 20))
d.rectangle((cx + 45, cy + 20, cx + 60, cy + 90), fill=(20, 20, 20))
d.ellipse((cx - 120, cy - 120, cx + 120, cy + 120), outline=(200, 20, 20), width=22)
d.line((cx - 85, cy + 85, cx + 85, cy - 85), fill=(200, 20, 20), width=22)
im.save(f"{OUT}/sign_nosit.png")
im = Image.new("RGBA", (1000, 260), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
ctext(d, (500, 130), "AIRLOCK", font(FK, 190), (200, 30, 30, 255))
im.save(f"{OUT}/airlock.png")

# 7. Standing-desk brass plaque
im = Image.new("RGB", (900, 200), (180, 140, 60))
d = ImageDraw.Draw(im)
d.rectangle((8, 8, 892, 192), outline=(110, 80, 30), width=10)
ctext(d, (450, 100), "HANDMADE BY LARRY", font(FHAND, 56), (70, 45, 15))
im.save(f"{OUT}/plaque.png")
print("ep5 decals ->", OUT)
