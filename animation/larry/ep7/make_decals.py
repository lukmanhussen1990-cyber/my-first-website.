"""Episode 7 in-world graphics (Pillow). Usage: python3 make_decals.py <out_dir>"""
import os, sys, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
FBO = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
FHAND = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
FM = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"


def font(p, s):
    return ImageFont.truetype(p, s)


def ctext(d, xy, text, f, fill, anchor="mm", **kw):
    d.text(xy, text, font=f, fill=fill, anchor=anchor, **kw)


def heart(d, cx, cy, s, fill):
    d.ellipse((cx - s, cy - s * 0.75, cx, cy + s * 0.25), fill=fill)
    d.ellipse((cx, cy - s * 0.75, cx + s, cy + s * 0.25), fill=fill)
    d.polygon([(cx - s * 0.97, cy - 0.1 * s), (cx + s * 0.97, cy - 0.1 * s), (cx, cy + s * 1.05)], fill=fill)


# 1. Prison gate sign
im = Image.new("RGB", (2000, 420), (40, 44, 50))
d = ImageDraw.Draw(im)
d.rectangle((14, 14, 1986, 406), outline=(220, 220, 220), width=14)
ctext(d, (1000, 160), "STATE PRISON", font(FK, 190), (235, 235, 235))
ctext(d, (1000, 330), "NO HUGS BEYOND THIS POINT", font(FB, 80), (240, 180, 40))
im.save(f"{OUT}/sign_prison.png")

# 2. Inmate number on the jumpsuit back/chest, and the cell number plate
im = Image.new("RGBA", (700, 260), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
ctext(d, (350, 130), "DALE 0001", font(FK, 130), (25, 25, 25, 255))
im.save(f"{OUT}/inmate_no.png")
for name, t in (("cell_7", "CELL 7"), ("cell_8", "CELL 8")):
    im = Image.new("RGB", (600, 200), (240, 240, 230))
    d = ImageDraw.Draw(im)
    d.rectangle((6, 6, 594, 194), outline=(30, 30, 30), width=8)
    ctext(d, (300, 100), t, font(FK, 110), (30, 30, 30))
    im.save(f"{OUT}/{name}.png")

# 3. Tally marks scratched on the cell wall (transparent): Dale's many, Larry's three
def tally(n_groups, extra, w=900, h=420, seed=1):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    x = 30
    for g in range(n_groups + (1 if extra else 0)):
        k = 4 if g < n_groups else extra
        y0 = 40 + (g % 2) * 200 if n_groups > 4 else 60
        if n_groups > 4 and g % 2 == 0 and g:
            x += 0
        for i in range(k):
            xx = x + i * 26 + rnd.randint(-3, 3)
            d.line((xx, y0 + rnd.randint(-4, 4), xx + rnd.randint(-6, 6), y0 + 140 + rnd.randint(-4, 4)), fill=(40, 40, 40, 230), width=9)
        if g < n_groups:
            d.line((x - 15, y0 + 110, x + 4 * 26 + 5, y0 + 30), fill=(40, 40, 40, 230), width=9)
        x += 150 if n_groups <= 4 or g % 2 else 0
    return im.filter(ImageFilter.GaussianBlur(0.8))

tally(10, 3, seed=2).save(f"{OUT}/tally_dale.png")
im = Image.new("RGBA", (420, 260), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
for i in range(3):
    xx = 80 + i * 70
    d.line((xx, 40, xx + 5, 220), fill=(40, 40, 40, 230), width=14)
im.filter(ImageFilter.GaussianBlur(0.8)).save(f"{OUT}/tally_larry.png")

# 4. FREE DALE protest sign (hand-painted)
im = Image.new("RGB", (1000, 700), (248, 246, 238))
d = ImageDraw.Draw(im)
ctext(d, (500, 230), "FREE", font(FK, 250), (200, 30, 40))
ctext(d, (500, 470), "DALE", font(FK, 250), (200, 30, 40))
heart(d, 500, 625, 45, (200, 30, 40))
im = im.rotate(2, resample=Image.BICUBIC, fillcolor=(248, 246, 238))
im.save(f"{OUT}/sign_freedale.png")

# 5. Warden's desk nameplate + VISITING sign
im = Image.new("RGB", (1000, 240), (30, 34, 44))
d = ImageDraw.Draw(im)
d.rectangle((10, 10, 990, 230), outline=(200, 170, 80), width=8)
ctext(d, (500, 120), "WARDEN", font(FK, 140), (225, 195, 110))
im.save(f"{OUT}/nameplate_warden.png")
im = Image.new("RGB", (1400, 360), (25, 70, 140))
d = ImageDraw.Draw(im)
d.rectangle((10, 10, 1390, 350), outline=(255, 255, 255), width=12)
ctext(d, (700, 180), "VISITING ROOM", font(FK, 150), (255, 255, 255))
im.save(f"{OUT}/sign_visiting.png")

# 6. Framed photo of Dale (Larry's keepsake) - drawn simply: heart frame with "DALE"
im = Image.new("RGB", (500, 640), (190, 150, 70))
d = ImageDraw.Draw(im)
d.rectangle((40, 40, 460, 600), fill=(160, 205, 235))
d.ellipse((160, 130, 340, 330), fill=(70, 45, 30))                      # face
d.rectangle((150, 330, 350, 600), fill=(240, 110, 30))                  # orange jumpsuit
d.ellipse((200, 200, 225, 225), fill=(250, 250, 250)); d.ellipse((275, 200, 300, 225), fill=(250, 250, 250))
d.arc((205, 230, 295, 300), 20, 160, fill=(250, 250, 250), width=8)
heart(d, 400, 110, 40, (220, 30, 60))
ctext(d, (250, 560), "DALE", font(FK, 70), (30, 30, 30))
im.save(f"{OUT}/photo_dale.png")

# 7. Bear fur (tileable noise, warm brown)
S = 512
rnd = random.Random(7)
im = Image.new("RGB", (S, S), (120, 78, 42))
d = ImageDraw.Draw(im)
for _ in range(9000):
    x, y = rnd.randrange(S), rnd.randrange(S)
    a = rnd.uniform(-0.6, 0.6) + math.pi / 2
    L = rnd.randint(5, 12)
    c = rnd.choice(((140, 94, 52), (98, 62, 32), (150, 104, 60), (110, 70, 38)))
    d.line((x, y, x + L * math.cos(a), y + L * math.sin(a)), fill=c, width=2)
im.filter(ImageFilter.GaussianBlur(0.6)).save(f"{OUT}/fur.png")
print("ep7 decals ->", OUT)
