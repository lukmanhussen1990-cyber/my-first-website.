"""Episode 18 in-world graphics (Pillow). Usage: python3 make_decals.py <out_dir>"""
import os, sys, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
FB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FI = "/usr/share/fonts/opentype/inter/Inter-BlackItalic.otf"
FS = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
FD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
rnd = random.Random(18)


def font(p, s):
    return ImageFont.truetype(p, s)


def ctext(d, xy, text, f, fill):
    d.text(xy, text, font=f, fill=fill, anchor="mm")


def hand(im, xy, text, f, fill, jitter=6, tilt=4.0, seed=1):
    """Hand-lettered look: every letter drawn on its own with a small random lift and tilt."""
    r = random.Random(seed)
    d = ImageDraw.Draw(im)
    w = sum(d.textlength(c, font=f) for c in text)
    x = xy[0] - w / 2
    for c in text:
        cw = d.textlength(c, font=f)
        if c != " ":
            g = Image.new("RGBA", (int(cw * 2 + 40), int(f.size * 2)), (0, 0, 0, 0))
            ImageDraw.Draw(g).text((g.width / 2, g.height / 2), c, font=f, fill=fill, anchor="mm")
            g = g.rotate(r.uniform(-tilt, tilt), resample=Image.BICUBIC)
            im.alpha_composite(g, (int(x + cw / 2 - g.width / 2), int(xy[1] - g.height / 2 + r.uniform(-jitter, jitter))))
        x += cw


def heart_shape(d, cx, cy, s, fill):
    """Two circles and a triangle."""
    r = s * 0.3
    d.ellipse((cx - 2 * r, cy - r * 1.6, cx, cy + r * 0.4), fill=fill)
    d.ellipse((cx, cy - r * 1.6, cx + 2 * r, cy + r * 0.4), fill=fill)
    d.polygon([(cx - 1.95 * r, cy - 0.35 * r), (cx + 1.95 * r, cy - 0.35 * r), (cx, cy + 2.0 * r)], fill=fill)


# 1. The love letter: pink stationery, hearts round the edge, hand-lettered
W, H = 900, 1200
im = Image.new("RGBA", (W, H), (255, 214, 226, 255))
d = ImageDraw.Draw(im)
d.rectangle((18, 18, W - 19, H - 19), outline=(232, 70, 120), width=10)
for k in range(26):
    t = k / 26.0
    per = 2 * (W + H) - 160
    p = t * per
    if p < W - 80:
        x, y = 40 + p, 52
    elif p < W - 80 + H - 80:
        x, y = W - 52, 40 + (p - (W - 80))
    elif p < 2 * (W - 80) + H - 80:
        x, y = W - 40 - (p - (W - 80) - (H - 80)), H - 52
    else:
        x, y = 52, H - 40 - (p - 2 * (W - 80) - (H - 80))
    heart_shape(d, x, y, 34, (232, 50, 100))
INK = (150, 20, 60, 255)
hand(im, (W / 2, 210), "Dear Baby,", font(FI, 92), INK, seed=2)
hand(im, (W / 2, 400), "I LOVE YOU", font(FK, 118), (215, 25, 70, 255), seed=3)
hand(im, (W / 2, 540), "SO MUCH!!!", font(FK, 104), (215, 25, 70, 255), seed=4)
for k, x in enumerate((300, 450, 600)):
    heart_shape(d, x, 690, 90, (225, 30, 80))
hand(im, (W / 2, 860), "Forever yours,", font(FI, 76), INK, seed=5)
hand(im, (W / 2, 990), "DALE", font(FK, 130), INK, seed=6)
im.save(f"{OUT}/letter.png")

# 2. Lipstick kiss (alpha)
im = Image.new("RGBA", (600, 400), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
red = (205, 15, 45, 235)
d.ellipse((60, 90, 310, 230), fill=red)          # upper lip, two lobes
d.ellipse((290, 90, 540, 230), fill=red)
d.ellipse((90, 170, 510, 340), fill=red)         # lower lip
d.polygon([(250, 95), (300, 140), (350, 95), (300, 70)], fill=(0, 0, 0, 0))   # cupid's bow notch
d.line((110, 205, 490, 205), fill=(140, 0, 25, 255), width=7)
d.ellipse((150, 120, 250, 160), fill=(240, 90, 110, 150))       # gloss
d.ellipse((260, 250, 420, 300), fill=(240, 90, 110, 150))
im = im.rotate(-12, expand=True, resample=Image.BICUBIC)
im.save(f"{OUT}/kiss.png")

# 3. Spray paint on the car: I <3 U BABY with drips (alpha)
im = Image.new("RGBA", (1800, 600), (0, 0, 0, 0))
pink = (255, 40, 150, 255)
hand(im, (230, 250), "I", font(FK, 250), pink, jitter=14, tilt=7, seed=7)
d = ImageDraw.Draw(im)
heart_shape(d, 470, 235, 240, pink)
hand(im, (1150, 250), "U BABY", font(FK, 250), pink, jitter=14, tilt=7, seed=8)
a = im.split()[3]
for k in range(40):                              # drips below the strokes
    x = rnd.randint(150, 1650)
    ys = [y for y in range(200, 420) if a.getpixel((x, y)) > 128]
    if ys:
        y0 = max(ys)
        d.line((x, y0, x, y0 + rnd.randint(30, 140)), fill=pink, width=rnd.randint(6, 12))
        d.ellipse((x - 8, y0 + 120 - 8, x + 8, y0 + 120 + 8), fill=pink) if rnd.random() < 0.3 else None
im = im.filter(ImageFilter.GaussianBlur(1.5))
im.save(f"{OUT}/car_paint.png")

# 4. Cereal O's spelling I <3 U (alpha): letter mask filled with little rings
mask = Image.new("L", (900, 420), 0)
md = ImageDraw.Draw(mask)
md.text((140, 210), "I", font=font(FK, 300), fill=255, anchor="mm")
heart_shape(md, 440, 200, 300, 255)
md.text((760, 210), "U", font=font(FK, 300), fill=255, anchor="mm")
im = Image.new("RGBA", mask.size, (0, 0, 0, 0))
d = ImageDraw.Draw(im)
pts = [(x + rnd.uniform(-5, 5), y + rnd.uniform(-5, 5)) for y in range(10, 420, 30) for x in range(10, 900, 30)
       if mask.getpixel((x, y)) > 128]
for (x, y) in pts:
    c = rnd.choice(((235, 150, 40), (230, 120, 30), (240, 175, 60), (220, 60, 50), (250, 210, 80)))
    d.ellipse((x - 17, y - 17, x + 17, y + 17), fill=c + (255,), outline=(150, 80, 20, 255), width=2)
    d.ellipse((x - 6, y - 6, x + 6, y + 6), fill=(0, 0, 0, 0))
im.save(f"{OUT}/cereal_text.png")

# 5. Sky writing: I <3 U BABY in puffy white smoke (alpha)
mask = Image.new("L", (2600, 800), 0)
md = ImageDraw.Draw(mask)
hand_im = Image.new("RGBA", mask.size, (0, 0, 0, 0))
hand(hand_im, (300, 400), "I", font(FB, 360), (255, 255, 255, 255), jitter=30, tilt=10, seed=9)
heart_shape(ImageDraw.Draw(hand_im), 640, 380, 330, (255, 255, 255, 255))
hand(hand_im, (1650, 400), "U  BABY", font(FB, 360), (255, 255, 255, 255), jitter=30, tilt=10, seed=10)
mask = hand_im.split()[3]
im = Image.new("RGBA", mask.size, (0, 0, 0, 0))
d = ImageDraw.Draw(im)
pts = [(x, y) for y in range(0, 800, 14) for x in range(0, 2600, 14) if mask.getpixel((x, y)) > 128]
for (x, y) in pts:
    r = rnd.uniform(12, 30)
    v = rnd.randint(235, 255)
    d.ellipse((x - r, y - r, x + r, y + r), fill=(v, v, v, rnd.randint(150, 230)))
im = im.filter(ImageFilter.GaussianBlur(9))
im.save(f"{OUT}/sky_text.png")

# 6. His reply: lined notebook paper, angry black marker
W, H = 900, 1150
im = Image.new("RGBA", (W, H), (252, 252, 248, 255))
d = ImageDraw.Draw(im)
for y in range(150, H, 62):
    d.line((0, y, W, y), fill=(150, 185, 230), width=3)
d.line((120, 0, 120, H), fill=(230, 120, 120), width=4)
for y in (200, 560, 920):                       # torn-out holes
    d.ellipse((30, y - 24, 78, y + 24), fill=(205, 205, 205))
BLK = (18, 18, 20, 255)
hand(im, (W / 2 + 40, 330), "LEAVE", font(FK, 210), BLK, jitter=10, tilt=6, seed=11)
hand(im, (W / 2 + 40, 560), "ME", font(FK, 210), BLK, jitter=10, tilt=6, seed=12)
hand(im, (W / 2 + 40, 790), "ALONE.", font(FK, 200), BLK, jitter=10, tilt=6, seed=13)
d.line((260, 905, 840, 890), fill=BLK, width=16)
d.line((280, 940, 820, 930), fill=BLK, width=12)
im = im.rotate(2.5, expand=False, resample=Image.BICUBIC, fillcolor=(252, 252, 248, 255))
im.save(f"{OUT}/note_leave.png")

# 7. Floating hearts (alpha): red and pink
for nm, col in (("heart_red", (230, 25, 70, 255)), ("heart_pink", (255, 105, 170, 255))):
    im = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    heart_shape(d, 150, 140, 250, (255, 255, 255, 255))      # white rim
    heart_shape(d, 150, 140, 215, col)
    d.ellipse((92, 70, 128, 104), fill=(255, 255, 255, 170))  # shine
    im.save(f"{OUT}/{nm}.png")

# 8. Music notes (alpha)
im = Image.new("RGBA", (300, 360), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.text((150, 180), "♪", font=font(FD, 300), fill=(255, 255, 255, 255), anchor="mm", stroke_width=8,
       stroke_fill=(230, 40, 120, 255))
im.save(f"{OUT}/note_music.png")
im = Image.new("RGBA", (360, 360), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.text((180, 180), "♫", font=font(FD, 300), fill=(255, 255, 255, 255), anchor="mm", stroke_width=8,
       stroke_fill=(230, 40, 120, 255))
im.save(f"{OUT}/note_music2.png")

# 9. Apron bib (alpha): KISS THE COOK (same cut as episode 11's apron)
im = Image.new("RGBA", (800, 1000), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
shape = [(150, 0), (650, 0), (700, 260), (800, 1000), (0, 1000), (100, 260)]
d.polygon(shape, fill=(220, 30, 60, 255))
d.polygon(shape, outline=(255, 255, 255, 255), width=14)
ctext(d, (400, 400), "KISS", font(FK, 170), (255, 255, 255))
ctext(d, (400, 560), "THE", font(FK, 110), (255, 255, 255))
ctext(d, (400, 700), "COOK", font(FK, 170), (255, 255, 255))
heart_shape(d, 400, 840, 110, (255, 255, 255))
im.save(f"{OUT}/apron_kiss.png")

# 10. The headstone, Dale's edit: FINALLY. crossed out, FOREVER <3 in pink marker
im = Image.new("RGB", (640, 760), (128, 128, 132))
px = im.load()
r2 = random.Random(3)
for y in range(760):
    for x in range(640):
        v = r2.randint(-10, 10)
        a_, b_, c_ = px[x, y]
        px[x, y] = (a_ + v, b_ + v, c_ + v)
im = im.filter(ImageFilter.GaussianBlur(0.8)).convert("RGBA")
d = ImageDraw.Draw(im)
d.rectangle((26, 26, 613, 733), outline=(88, 88, 92), width=8)
for (yy, text, size) in ((150, "HERE LIES", 92), (330, "DALE", 190), (520, "FINALLY.", 104)):
    ctext(d, (322, yy + 4), text, font(FS, size), (178, 178, 182))
    ctext(d, (320, yy), text, font(FS, size), (52, 52, 56))
PINK = (255, 60, 160, 255)
d.line((70, 540, 575, 495), fill=PINK, width=18)          # scribbled out
d.line((80, 505, 565, 535), fill=PINK, width=14)
hand(im, (320, 640), "FOREVER", font(FK, 104), PINK, jitter=8, tilt=6, seed=21)
heart_shape(d, 320, 712, 40, PINK)
im.convert("RGB").save(f"{OUT}/stone_forever.png")

# 11. Zzz (alpha)
im = Image.new("RGBA", (420, 360), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
for (x, y, s) in ((90, 270, 110), (210, 170, 150), (330, 70, 120)):
    d.text((x, y), "Z", font=font(FK, s), fill=(235, 240, 255, 255), anchor="mm", stroke_width=6,
           stroke_fill=(60, 80, 160, 255))
im.save(f"{OUT}/zzz.png")

print("ep18 decals ->", OUT)
