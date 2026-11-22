"""Episode 9 in-world graphics (Pillow). Usage: python3 make_decals.py <out_dir>"""
import os, sys, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
FBO = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
FSERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"


def font(p, s):
    return ImageFont.truetype(p, s)


def ctext(d, xy, text, f, fill, anchor="mm", **kw):
    d.text(xy, text, font=f, fill=fill, anchor=anchor, **kw)


def heart(d, cx, cy, s, fill):
    d.ellipse((cx - s, cy - s * 0.75, cx, cy + s * 0.25), fill=fill)
    d.ellipse((cx, cy - s * 0.75, cx + s, cy + s * 0.25), fill=fill)
    d.polygon([(cx - s * 0.97, cy - 0.1 * s), (cx + s * 0.97, cy - 0.1 * s), (cx, cy + s * 1.05)], fill=fill)


# 1. Prison gate sign (replaces episode 7's STATE PRISON sign for the night shots)
im = Image.new("RGB", (2000, 420), (40, 44, 50))
d = ImageDraw.Draw(im)
d.rectangle((14, 14, 1986, 406), outline=(225, 225, 225), width=12)
ctext(d, (1000, 160), "MAXIMUM SECURITY", font(FK, 170), (240, 240, 240))
ctext(d, (1000, 320), "PRISON", font(FK, 150), (255, 196, 30))
im.save(f"{OUT}/sign_maxsec.png")

# 2. Garbage truck side panel
im = Image.new("RGB", (2400, 900), (22, 104, 48))
d = ImageDraw.Draw(im)
for k in range(9):                                   # diagonal hazard band along the bottom
    x = k * 300
    d.polygon([(x, 900), (x + 150, 900), (x + 300, 760), (x + 150, 760)], fill=(250, 200, 20))
d.rectangle((0, 740, 2400, 760), fill=(240, 240, 235))
ctext(d, (1200, 300), "CITY WASTE", font(FK, 330), (245, 245, 240))
ctext(d, (1200, 560), "WE TAKE ANYTHING", font(FB, 120), (200, 235, 205))
im.save(f"{OUT}/truck_side.png")

# 3. "5 YEARS" rubber stamp (alpha)
im = Image.new("RGBA", (1400, 560), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
red = (214, 28, 34, 255)
d.rounded_rectangle((20, 20, 1380, 540), radius=40, outline=red, width=34)
ctext(d, (700, 290), "5 YEARS", font(FK, 250), red)
rnd = random.Random(5)
px = im.load()
for _ in range(26000):                               # worn ink
    x, y = rnd.randrange(1400), rnd.randrange(560)
    if px[x, y][3]:
        px[x, y] = (214, 28, 34, rnd.choice((0, 0, 120)))
im = im.rotate(-8, resample=Image.BICUBIC, expand=True)
im.save(f"{OUT}/stamp_5years.png")

# 4. Court plaque over the judge's bench
im = Image.new("RGB", (1600, 420), (92, 56, 28))
d = ImageDraw.Draw(im)
d.rectangle((16, 16, 1584, 404), outline=(214, 172, 88), width=14)
d.rectangle((44, 44, 1556, 376), outline=(160, 120, 60), width=4)
ctext(d, (800, 160), "COURT OF LAW", font(FSERIF, 150), (236, 200, 120))
ctext(d, (800, 300), "JUSTICE  •  ORDER  •  NO HUGS", font(FSERIF, 64), (220, 186, 110))
im.save(f"{OUT}/sign_court.png")

# 5. WANTED poster for Dale (lamp posts on the street)
im = Image.new("RGB", (900, 1250), (236, 222, 186))
d = ImageDraw.Draw(im)
ctext(d, (450, 130), "WANTED", font(FSERIF, 180), (60, 30, 20))
d.rectangle((170, 260, 730, 820), outline=(60, 30, 20), width=10)
d.rectangle((180, 270, 720, 810), fill=(214, 120, 40))           # orange jumpsuit mugshot box
ctext(d, (450, 540), "DALE", font(FSERIF, 150), (40, 20, 10))
ctext(d, (450, 930), "ESCAPED", font(FSERIF, 120), (170, 20, 20))
ctext(d, (450, 1060), "IN A GARBAGE TRUCK", font(FSERIF, 52), (60, 30, 20))
ctext(d, (450, 1150), "DO NOT HUG", font(FSERIF, 44), (60, 30, 20))
im.save(f"{OUT}/poster_wanted_dale.png")

# 6. Doormat at mom's house
im = Image.new("RGB", (1400, 840), (120, 78, 44))
d = ImageDraw.Draw(im)
rnd = random.Random(2)
for _ in range(60000):                               # coir fibre speckle
    x, y = rnd.randrange(1400), rnd.randrange(840)
    c = rnd.randint(90, 150)
    d.point((x, y), fill=(c, int(c * 0.66), int(c * 0.38)))
d.rectangle((30, 30, 1370, 810), outline=(60, 34, 18), width=26)
ctext(d, (700, 330), "MOM'S", font(FK, 260), (50, 28, 14))
heart(d, 700, 600, 110, (150, 30, 30))
im = im.filter(ImageFilter.GaussianBlur(1.2))
im.save(f"{OUT}/mat_mom.png")

# 7. Washing machine control panel
im = Image.new("RGB", (1200, 300), (236, 238, 240))
d = ImageDraw.Draw(im)
d.rounded_rectangle((40, 60, 380, 240), radius=20, fill=(30, 36, 44))
ctext(d, (210, 150), "SPIN", font(FB, 90), (90, 220, 255))
d.ellipse((760, 50, 960, 250), fill=(205, 208, 212), outline=(150, 152, 156), width=10)
d.line((860, 150, 860, 70), fill=(60, 60, 64), width=16)
for k, lab in enumerate(("COTTON", "DELICATE", "LARRY")):
    ctext(d, (1080, 90 + k * 60), lab, font(FBO, 34), (90, 92, 96))
for k in range(4):
    d.ellipse((440 + k * 72, 120, 490 + k * 72, 170), fill=(170, 174, 180))
im.save(f"{OUT}/washer_panel.png")

# 8. DO NOT DISTURB door hanger (hotel)
im = Image.new("RGBA", (420, 1000), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((0, 0, 420, 1000), radius=40, fill=(160, 22, 40, 255))
d.ellipse((110, 60, 310, 260), fill=(0, 0, 0, 0))
ctext(d, (210, 470), "DO NOT", font(FK, 96), (255, 255, 255))
ctext(d, (210, 590), "DISTURB", font(FK, 86), (255, 255, 255))
ctext(d, (210, 760), "(SERIOUSLY)", font(FB, 44), (255, 210, 210))
im.save(f"{OUT}/hanger_dnd.png")

print("ep9 decals ->", OUT)
