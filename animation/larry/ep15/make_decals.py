"""Episode 15 in-world graphics (Pillow). Usage: python3 make_decals.py <out_dir>"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
FB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FI = "/usr/share/fonts/opentype/inter/Inter-BlackItalic.otf"


def font(p, s):
    return ImageFont.truetype(p, s)


def ctext(d, xy, text, f, fill):
    d.text(xy, text, font=f, fill=fill, anchor="mm")


# 1. MISSING poster on the lamp post (Larry made it: a broken heart and a phone number)
im = Image.new("RGB", (900, 1250), (250, 248, 240))
d = ImageDraw.Draw(im)
d.rectangle((14, 14, 885, 1235), outline=(30, 30, 30), width=8)
ctext(d, (450, 150), "MISSING", font(FK, 190), (200, 20, 25))
d.rectangle((150, 270, 750, 760), fill=(225, 222, 214), outline=(30, 30, 30), width=6)
d.ellipse((350, 330, 550, 530), fill=(70, 55, 50))                     # a head-and-shoulders silhouette
d.rounded_rectangle((260, 540, 640, 760), radius=90, fill=(70, 55, 50))
ctext(d, (450, 850), "DALE", font(FK, 170), (30, 30, 30))
ctext(d, (450, 990), "LAST SEEN 2 DAYS AGO", font(FB, 62), (30, 30, 30))
ctext(d, (450, 1110), "IF FOUND CALL LARRY", font(FI, 66), (200, 20, 25))
im.save(f"{OUT}/poster_missing.png")

# 2. The pay-raise offer Larry holds up
im = Image.new("RGB", (900, 1150), (252, 252, 250))
d = ImageDraw.Draw(im)
d.rectangle((0, 0, 900, 190), fill=(40, 120, 60))
ctext(d, (450, 95), "PAY RAISE", font(FK, 130), (255, 255, 255))
ctext(d, (450, 470), "+$1", font(FK, 330), (40, 120, 60))
ctext(d, (450, 720), "PER YEAR", font(FB, 90), (40, 40, 45))
d.line((180, 960, 720, 960), fill=(40, 40, 45), width=6)
ctext(d, (450, 905), "Larry", font(FI, 110), (30, 60, 160))
im.save(f"{OUT}/raise.png")

# 3. YES / NO vote cards
for name, text, bg in (("card_yes", "YES", (40, 160, 70)), ("card_no", "NO", (205, 35, 35))):
    im = Image.new("RGB", (800, 560), bg)
    d = ImageDraw.Draw(im)
    d.rectangle((20, 20, 779, 539), outline=(255, 255, 255), width=18)
    ctext(d, (400, 285), text, font(FK, 300), (255, 255, 255))
    im.save(f"{OUT}/{name}.png")

print("ep15 decals ->", OUT)
