"""Episode 3 in-world graphics (Pillow). Usage: python3 make_decals.py <out_dir> [you_face.png]"""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

OUT = sys.argv[1]
FACE = sys.argv[2] if len(sys.argv) > 2 else None
os.makedirs(OUT, exist_ok=True)
FB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
FBO = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
FSERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
FSERIFR = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"


def font(p, s):
    return ImageFont.truetype(p, s)


def ctext(d, xy, text, f, fill, anchor="mm", **kw):
    d.text(xy, text, font=f, fill=fill, anchor=anchor, **kw)


# 1. HUMAN RESOURCES wall sign + desk plaque
im = Image.new("RGB", (2000, 380), (245, 246, 248))
d = ImageDraw.Draw(im)
d.rectangle((0, 0, 2000, 380), outline=(30, 60, 120), width=16)
ctext(d, (1000, 150), "HUMAN RESOURCES", font(FK, 150), (30, 60, 120))
ctext(d, (1000, 290), "we listen. we don't care.", font(FBO, 64), (120, 125, 140))
im.save(f"{OUT}/sign_hr.png")
im = Image.new("RGB", (1200, 300), (30, 34, 44))
d = ImageDraw.Draw(im)
d.rectangle((12, 12, 1188, 288), outline=(200, 200, 210), width=8)
ctext(d, (600, 115), "BRENDA", font(FB, 120), (235, 235, 240))
ctext(d, (600, 225), "HUMAN RESOURCES", font(FBO, 64), (190, 190, 200))
im.save(f"{OUT}/nameplate_hr.png")

# 2. Complaint form on the HR desk
im = Image.new("RGB", (850, 1100), (250, 250, 247))
d = ImageDraw.Draw(im)
ctext(d, (425, 90), "COMPLAINT FORM", font(FK, 70), (30, 30, 40))
for i, (k, v) in enumerate((("Name", "You"), ("About", "Larry (Accounting)"), ("Issue", "keeps begging me to"),
                             ("", "beat his meat"), ("Action", "CASE CLOSED: it's a steak"))):
    y = 220 + i * 120
    d.text((70, y), k, font=font(FBO, 38), fill=(110, 110, 120))
    d.text((260, y), v, font=font(FBO, 44), fill=(20, 30, 90) if i < 4 else (190, 20, 30))
    d.line((260, y + 58, 790, y + 58), fill=(200, 200, 205), width=3)
im.save(f"{OUT}/form_complaint.png")

# 3. Vegan cafe sign + salad bar label
im = Image.new("RGB", (2000, 460), (36, 120, 60))
d = ImageDraw.Draw(im)
d.rounded_rectangle((14, 14, 1986, 446), 60, outline=(230, 245, 220), width=14)
ctext(d, (1000, 190), "GREEN LEAF", font(FK, 190), (240, 250, 230))
ctext(d, (1000, 360), "100% VEGAN · NO MEAT ALLOWED", font(FB, 80), (200, 235, 160))
im.save(f"{OUT}/sign_vegan.png")
im = Image.new("RGB", (1400, 240), (250, 248, 240))
d = ImageDraw.Draw(im)
ctext(d, (700, 120), "SALAD BAR", font(FK, 150), (36, 120, 60))
im.save(f"{OUT}/label_saladbar.png")
im = Image.new("RGBA", (800, 800), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.ellipse((30, 30, 770, 770), outline=(200, 20, 30, 255), width=70)
d.line((150, 650, 650, 150), fill=(200, 20, 30, 255), width=70)
ctext(d, (400, 400), "MEAT", font(FK, 170), (30, 30, 30, 255))
im.save(f"{OUT}/sign_nomeat.png")

# 4. Monastery: carved wooden plaque
im = Image.new("RGB", (1600, 500), (96, 62, 34))
d = ImageDraw.Draw(im)
for y in range(0, 500, 9):
    d.line((0, y, 1600, y + 6), fill=(88, 56, 30), width=3)
d.rectangle((10, 10, 1590, 490), outline=(60, 38, 20), width=18)
ctext(d, (800, 200), "MONASTERY OF SILENCE", font(FSERIF, 90), (238, 205, 140))
ctext(d, (800, 360), "no meat · no larry · no talking", font(FSERIFR, 64), (220, 190, 130))
im = im.filter(ImageFilter.GaussianBlur(0.6))
im.save(f"{OUT}/sign_monastery.png")

# 5. Butcher shop sign + price board
im = Image.new("RGB", (2000, 460), (150, 18, 24))
d = ImageDraw.Draw(im)
d.rectangle((14, 14, 1986, 446), outline=(250, 235, 210), width=14)
ctext(d, (1000, 180), "BIG TONY'S", font(FK, 180), (250, 240, 220))
ctext(d, (1000, 360), "PROFESSIONAL MEAT BEATING", font(FB, 86), (250, 220, 170))
im.save(f"{OUT}/sign_butcher.png")
im = Image.new("RGB", (1000, 1300), (22, 24, 22))
d = ImageDraw.Draw(im)
ctext(d, (500, 110), "TODAY", font(FK, 110), (245, 245, 240))
for i, (k, v) in enumerate((("RIBEYE", "$18"), ("T-BONE", "$22"), ("SIRLOIN", "$15"), ("BEAT IT FOR YOU", "$40"),
                             ("LARRY'S MEAT", "PRICELESS"))):
    y = 280 + i * 190
    d.text((60, y), k, font=font(FB, 62), fill=(240, 240, 235))
    d.text((940, y), v, font=font(FB, 62), fill=(250, 210, 90), anchor="ra")
im = im.filter(ImageFilter.GaussianBlur(0.8))
im.save(f"{OUT}/board_prices.png")

# 6. Funeral: memorial banner with your portrait, and an easel portrait
def face_img(size, zoom=0.8, cy_frac=0.5):
    if FACE and os.path.exists(FACE):
        im = Image.open(FACE).convert("RGB")
        W, H = im.size
        side = int(W * zoom); cy = int(H * cy_frac)
        return im.crop((W // 2 - side // 2, cy - side // 2, W // 2 + side // 2, cy + side // 2)).resize((size, size), Image.LANCZOS)
    im = Image.new("RGB", (size, size), (150, 185, 225))
    d = ImageDraw.Draw(im)
    d.ellipse((size * 0.3, size * 0.15, size * 0.7, size * 0.65), fill=(236, 200, 172))
    return im

im = Image.new("RGB", (900, 1200), (24, 22, 20))
d = ImageDraw.Draw(im)
d.rectangle((30, 30, 870, 1170), outline=(205, 170, 90), width=26)
im.paste(ImageOps.grayscale(face_img(700)).convert("RGB"), (100, 100))
ctext(d, (450, 920), "IN LOVING MEMORY", font(FSERIF, 56), (230, 205, 150))
ctext(d, (450, 1040), "finally at peace", font(FSERIFR, 52), (200, 185, 150))
im.save(f"{OUT}/portrait_memorial.png")
im = Image.new("RGBA", (2200, 360), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((10, 10, 2190, 350), 40, fill=(32, 28, 26, 255), outline=(205, 170, 90, 255), width=12)
ctext(d, (1100, 180), "REST IN PEACE", font(FSERIF, 170), (230, 205, 150, 255))
im.save(f"{OUT}/banner_rip.png")

print("ep3 decals ->", OUT)
