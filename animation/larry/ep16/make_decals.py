"""Episode 16 in-world graphics (Pillow). Usage: python3 make_decals.py <out_dir>"""
import os, sys, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
FB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FI = "/usr/share/fonts/opentype/inter/Inter-BlackItalic.otf"
FS = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"


def font(p, s):
    return ImageFont.truetype(p, s)


def ctext(d, xy, text, f, fill):
    d.text(xy, text, font=f, fill=fill, anchor="mm")


# 1. Gravestone face: grey stone, engraved lettering
rnd = random.Random(3)
im = Image.new("RGB", (640, 760), (128, 128, 132))
px = im.load()
for y in range(760):
    for x in range(640):
        v = rnd.randint(-10, 10)
        r, g, b = px[x, y]
        px[x, y] = (r + v, g + v, b + v)
im = im.filter(ImageFilter.GaussianBlur(0.8))
d = ImageDraw.Draw(im)
d.rectangle((26, 26, 613, 733), outline=(88, 88, 92), width=8)
for (yy, text, size) in ((150, "HERE LIES", 92), (330, "DALE", 190), (560, "FINALLY.", 104)):
    ctext(d, (322, yy + 4), text, font(FS, size), (178, 178, 182))      # light bevel edge
    ctext(d, (320, yy), text, font(FS, size), (52, 52, 56))             # engraved
im.save(f"{OUT}/stone_face.png")

# 2. FAKE rubber stamp (transparent, tilted)
im = Image.new("RGBA", (900, 420), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
red = (215, 25, 30, 255)
d.rectangle((20, 20, 879, 399), outline=red, width=26)
ctext(d, (450, 215), "FAKE", font(FK, 270), red)
mask = Image.new("L", im.size, 255)                                     # worn ink
md = ImageDraw.Draw(mask)
for k in range(260):
    x, y = rnd.randint(0, 899), rnd.randint(0, 419)
    rr = rnd.randint(2, 9)
    md.ellipse((x - rr, y - rr, x + rr, y + rr), fill=0)
a = im.split()[3]
from PIL import ImageChops
im.putalpha(ImageChops.multiply(a, mask))
im = im.rotate(-14, expand=True, resample=Image.BICUBIC)
im.save(f"{OUT}/stamp_fake.png")

# 3. The plan board: cork, pinned notes, photos of you, red string
W, H = 1600, 1100
im = Image.new("RGB", (W, H), (176, 128, 80))
d = ImageDraw.Draw(im)
for k in range(5000):                                                   # cork speckle
    x, y = rnd.randint(0, W - 1), rnd.randint(0, H - 1)
    c = rnd.choice(((150, 104, 62), (198, 150, 98), (130, 90, 52)))
    d.point((x, y), fill=c)
d.rectangle((0, 0, W - 1, H - 1), outline=(92, 60, 32), width=30)
ctext(d, (W // 2, 105), "THE PLAN", font(FK, 120), (180, 20, 25))
notes = [((90, 230), "1. DALE GOES\nMISSING"), ((830, 230), "2. LARRY\nCRIES"),
         ((90, 640), "3. HE LETS\nLARRY IN"), ((830, 640), "4. CUDDLE")]
centers = []
for (x, y), text in notes:
    d.rectangle((x, y, x + 680, y + 330), fill=(250, 240, 150))
    d.multiline_text((x + 340, y + 165), text, font=font(FB, 76), fill=(30, 30, 30), anchor="mm", align="center",
                     spacing=10)
    pin = (x + 340, y + 16)
    d.ellipse((pin[0] - 16, pin[1] - 16, pin[0] + 16, pin[1] + 16), fill=(200, 30, 30))
    centers.append(pin)
# hearts round step 4
for k in range(5):
    hx, hy = 1180 + rnd.randint(-300, 300), 900 + rnd.randint(-40, 60)
    d.text((hx, hy), "♥", font=font(FS, 70), fill=(220, 30, 60), anchor="mm")
# red string zig-zag 1 -> 2 -> 3 -> 4
for a_, b_ in zip(centers, centers[1:]):
    d.line((a_, b_), fill=(200, 25, 25), width=7)
im.save(f"{OUT}/plan_board.png")

print("ep16 decals ->", OUT)
