"""Generate in-world graphics (signs, documents, labels) with Pillow. Run with system python."""
import os, sys, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = sys.argv[1]
FACE = sys.argv[2] if len(sys.argv) > 2 else None  # portrait render for the ID card
os.makedirs(OUT, exist_ok=True)
FB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FBO = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FSERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"


def font(p, s):
    return ImageFont.truetype(p, s)


def ctext(d, xy, text, f, fill, anchor="mm", **kw):
    d.text(xy, text, font=f, fill=fill, anchor=anchor, **kw)


# 1. Welcome banner (pennant style)
im = Image.new("RGBA", (2400, 420), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
cols = [(230, 57, 70), (255, 183, 3), (42, 157, 143), (69, 123, 157), (244, 132, 95)]
d.rounded_rectangle((20, 40, 2380, 380), 30, fill=(255, 250, 240, 255), outline=(40, 40, 40, 255), width=6)
letters = "WELCOME NEW GUY!"
size = 210
while True:
    f = font(FB, size)
    total = sum((d.textlength(c, font=f) + 8) if c != " " else 90 for c in letters)
    if total <= 2160 or size < 60:
        break
    size -= 6
x = (2400 - total) / 2
for i, ch in enumerate(letters):
    if ch == " ":
        x += 90
        continue
    w = d.textlength(ch, font=f)
    ctext(d, (x + w / 2, 215), ch, f, cols[i % len(cols)] + (255,))
    x += w + 8
im.save(f"{OUT}/banner_welcome.png")

# 2. Larry nameplate
im = Image.new("RGB", (1200, 300), (52, 52, 58))
d = ImageDraw.Draw(im)
d.rectangle((12, 12, 1188, 288), outline=(200, 170, 90), width=10)
ctext(d, (600, 115), "LARRY", font(FB, 120), (235, 215, 160))
ctext(d, (600, 225), "ACCOUNTING", font(FBO, 70), (235, 215, 160))
im.save(f"{OUT}/nameplate_larry.png")

# 3. POLICE wall sign
im = Image.new("RGB", (1800, 360), (22, 38, 84))
d = ImageDraw.Draw(im)
d.rectangle((14, 14, 1786, 346), outline=(230, 190, 60), width=14)
ctext(d, (900, 180), "POLICE DEPARTMENT", font(FB, 150), (255, 255, 255))
im.save(f"{OUT}/sign_police.png")

# 4. WANTED poster
im = Image.new("RGB", (900, 1200), (236, 222, 186))
d = ImageDraw.Draw(im)
for _ in range(2500):
    x, y = random.randint(0, 899), random.randint(0, 1199)
    d.point((x, y), fill=(200, 185, 150))
ctext(d, (450, 140), "WANTED", font(FSERIF, 170), (60, 30, 20))
d.rectangle((150, 270, 750, 820), outline=(60, 30, 20), width=8)
ctext(d, (450, 545), "LARRY", font(FSERIF, 140), (60, 30, 20))
ctext(d, (450, 920), "FOR EXCESSIVE", font(FSERIF, 70), (60, 30, 20))
ctext(d, (450, 1010), "TOUCHING", font(FSERIF, 90), (150, 30, 20))
ctext(d, (450, 1110), "DO NOT APPROACH", font(FSERIF, 50), (60, 30, 20))
im.save(f"{OUT}/poster_wanted.png")

# 5. Restraining order document + stamp
im = Image.new("RGB", (1240, 1754), (250, 250, 246))
d = ImageDraw.Draw(im)
ctext(d, (620, 120), "SUPERIOR COURT", font(FSERIF, 46), (30, 30, 30))
ctext(d, (620, 250), "RESTRAINING", font(FB, 130), (20, 20, 20))
ctext(d, (620, 390), "ORDER", font(FB, 150), (20, 20, 20))
d.line((140, 480, 1100, 480), fill=(30, 30, 30), width=6)
ctext(d, (140, 560), "DEFENDANT:  LARRY (ACCOUNTING)", font(FBO, 46), (30, 30, 30), anchor="lm")
ctext(d, (140, 640), "MUST STAY AT LEAST", font(FBO, 46), (30, 30, 30), anchor="lm")
ctext(d, (620, 790), "500 FEET", font(FB, 170), (180, 20, 20))
ctext(d, (140, 930), "AWAY FROM THE PLAINTIFF AT ALL TIMES.", font(FBO, 42), (30, 30, 30), anchor="lm")
for i in range(9):
    y = 1030 + i * 60
    d.line((140, y, 140 + random.randint(700, 960), y), fill=(150, 150, 150), width=10)
d.line((700, 1600, 1100, 1600), fill=(30, 30, 30), width=4)
ctext(d, (900, 1640), "JUDGE", font(FR, 34), (60, 60, 60))
im.save(f"{OUT}/doc_restraining.png")
st = Image.new("RGBA", (900, 420), (0, 0, 0, 0))
d = ImageDraw.Draw(st)
d.rounded_rectangle((20, 20, 880, 400), 40, outline=(205, 25, 30, 235), width=26)
sz = 190
while d.textlength("APPROVED", font=font(FB, sz)) > 760:
    sz -= 5
ctext(d, (450, 215), "APPROVED", font(FB, sz), (205, 25, 30, 235))
st = st.rotate(-12, expand=True, resample=Image.BICUBIC)
st.save(f"{OUT}/stamp_approved.png")

# 6. ID card with face photo
im = Image.new("RGB", (1012, 638), (214, 230, 245))
d = ImageDraw.Draw(im)
d.rectangle((0, 0, 1012, 120), fill=(30, 70, 140))
ctext(d, (506, 62), "DRIVER LICENSE", font(FB, 70), (255, 255, 255))
if FACE and os.path.exists(FACE):
    fa = Image.open(FACE).convert("RGB")
    w, h = fa.size
    side = min(w, h)
    fa = fa.crop(((w - side) // 2, int(h * 0.12), (w + side) // 2, int(h * 0.12) + side)).resize((330, 400))
    im.paste(fa, (50, 170))
else:
    d.rectangle((50, 170, 380, 570), fill=(160, 160, 170))
ctext(d, (430, 220), "NAME", font(FR, 36), (60, 60, 80), anchor="lm")
ctext(d, (430, 280), "YOU", font(FB, 80), (10, 10, 30), anchor="lm")
ctext(d, (430, 380), "DOB  01-01-1999", font(FBO, 42), (10, 10, 30), anchor="lm")
ctext(d, (430, 450), "ORGAN DONOR", font(FBO, 42), (10, 10, 30), anchor="lm")
ctext(d, (430, 530), "NOT LARRY", font(FB, 50), (190, 20, 20), anchor="lm")
im.save(f"{OUT}/id_card.png")

# 7. Cash bill
im = Image.new("RGB", (1560, 660), (190, 215, 180))
d = ImageDraw.Draw(im)
d.rectangle((20, 20, 1540, 640), outline=(60, 100, 60), width=16)
d.ellipse((600, 120, 960, 540), outline=(60, 100, 60), width=12)
ctext(d, (780, 330), "100", font(FB, 200), (50, 90, 50))
ctext(d, (180, 130), "100", font(FB, 110), (50, 90, 50))
ctext(d, (1380, 530), "100", font(FB, 110), (50, 90, 50))
im.save(f"{OUT}/cash.png")

# 8. 500 FT road paint (white, transparent bg)
im = Image.new("RGBA", (2000, 700), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
ctext(d, (1000, 350), "500 FT", font(FB, 520), (245, 245, 240, 255))
im = im.filter(ImageFilter.GaussianBlur(1.2))
im.save(f"{OUT}/paint_500ft.png")

# 9. Shipping labels for Larry's box
im = Image.new("RGB", (1200, 800), (252, 252, 252))
d = ImageDraw.Draw(im)
d.rectangle((10, 10, 1190, 790), outline=(20, 20, 20), width=8)
ctext(d, (40, 70), "FROM:", font(FBO, 54), (40, 40, 40), anchor="lm")
ctext(d, (40, 160), "LARRY", font(FB, 110), (20, 20, 20), anchor="lm")
d.line((30, 240, 1170, 240), fill=(20, 20, 20), width=6)
ctext(d, (40, 310), "TO:", font(FBO, 54), (40, 40, 40), anchor="lm")
ctext(d, (40, 410), "YOUR NEW HOUSE", font(FB, 96), (20, 20, 20), anchor="lm")
ctext(d, (40, 510), "EGYPT", font(FB, 96), (20, 20, 20), anchor="lm")
for i in range(40):
    x = 60 + i * 27
    d.rectangle((x, 620, x + random.choice([6, 10, 14]), 760), fill=(20, 20, 20))
im.save(f"{OUT}/label_ship.png")
im = Image.new("RGB", (1400, 420), (220, 30, 35))
d = ImageDraw.Draw(im)
ctext(d, (700, 210), "FRAGILE", font(FB, 260), (255, 255, 255))
im.save(f"{OUT}/label_fragile.png")
im = Image.new("RGBA", (900, 600), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.polygon([(450, 40), (250, 300), (380, 300), (380, 560), (520, 560), (520, 300), (650, 300)], fill=(25, 25, 25, 255))
im.save(f"{OUT}/label_arrow.png")

# 10. NO LARRYS sign
im = Image.new("RGB", (1400, 900), (250, 250, 245))
d = ImageDraw.Draw(im)
d.rectangle((14, 14, 1386, 886), outline=(200, 20, 20), width=30)
ctext(d, (700, 330), "NO", font(FB, 300), (200, 20, 20))
ctext(d, (700, 640), "LARRYS", font(FB, 260), (20, 20, 20))
im.save(f"{OUT}/sign_nolarrys.png")
print("decals ->", OUT)
