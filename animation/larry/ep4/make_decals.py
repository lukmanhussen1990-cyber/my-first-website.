"""Episode 4 in-world graphics (Pillow). Usage: python3 make_decals.py <out_dir>"""
import os, sys, math
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


# 1. Digital alarm clock faces: 2:59 and 3:00 AM (seven-segment look, red glow)
SEG = {"0": "abcfed", "1": "bc", "2": "abged", "3": "abgcd", "5": "afgcd", "9": "abfgcd", ":": ""}
def seven(d, x, y, ch, w=150, h=260, t=26, col=(255, 40, 30)):
    if ch == ":":
        for yy in (y + h * 0.3, y + h * 0.7):
            d.ellipse((x + 20, yy - 16, x + 52, yy + 16), fill=col)
        return 72
    segs = {"a": (x + t, y, x + w - t, y + t), "g": (x + t, y + h / 2 - t / 2, x + w - t, y + h / 2 + t / 2),
            "d": (x + t, y + h - t, x + w - t, y + h), "f": (x, y + t, x + t, y + h / 2 - t / 2),
            "b": (x + w - t, y + t, x + w, y + h / 2 - t / 2), "e": (x, y + h / 2 + t / 2, x + t, y + h - t),
            "c": (x + w - t, y + h / 2 + t / 2, x + w, y + h - t)}
    for s in "abcdefg":
        d.rounded_rectangle(segs[s], 6, fill=col if s in SEG[ch] else (40, 8, 6))
    return w + 34

for name, txt in (("clock_259", "2:59"), ("clock_300", "3:00")):
    im = Image.new("RGB", (900, 420), (6, 6, 8))
    d = ImageDraw.Draw(im)
    x = 120
    for ch in txt:
        x += seven(d, x, 70, ch)
    ctext(d, (820, 330), "AM", font(FK, 60), (255, 40, 30))
    glow = im.filter(ImageFilter.GaussianBlur(10))
    im = Image.blend(im, glow, 0.35)
    im.save(f"{OUT}/{name}.png")

# 2. Boxers fabric: white with red hearts (tileable-ish)
im = Image.new("RGB", (512, 512), (248, 246, 250))
d = ImageDraw.Draw(im)
for row in range(6):
    for col in range(6):
        cx = 45 + col * 85 + (42 if row % 2 else 0); cy = 45 + row * 85
        heart(d, cx % 512, cy, 18, (220, 30, 60))
im.save(f"{OUT}/boxers_hearts.png")

# 3. BEWARE OF DOG sign and the kennel nameplate
im = Image.new("RGB", (1400, 700), (250, 210, 30))
d = ImageDraw.Draw(im)
d.rectangle((14, 14, 1386, 686), outline=(20, 20, 20), width=22)
ctext(d, (700, 200), "BEWARE", font(FK, 200), (20, 20, 20))
ctext(d, (700, 420), "OF DOG", font(FK, 200), (20, 20, 20))
ctext(d, (700, 600), "(he sniffs)", font(FBO, 70), (60, 50, 20))
im.save(f"{OUT}/sign_beware.png")
im = Image.new("RGB", (900, 260), (110, 64, 30))
d = ImageDraw.Draw(im)
for y in range(0, 260, 8):
    d.line((0, y, 900, y + 5), fill=(100, 58, 27), width=3)
d.rectangle((8, 8, 892, 252), outline=(70, 40, 18), width=12)
ctext(d, (450, 130), "DALE", font(FK, 170), (250, 235, 200))
im.save(f"{OUT}/kennel_dale.png")
im = Image.new("RGB", (600, 160), (200, 30, 40))
d = ImageDraw.Draw(im)
ctext(d, (300, 80), "GOOD BOY", font(FK, 90), (255, 255, 255))
im.save(f"{OUT}/bowl_label.png")

# 4. Sticky note on the safe
im = Image.new("RGB", (500, 500), (255, 236, 90))
d = ImageDraw.Draw(im)
d.polygon([(500, 420), (420, 500), (500, 500)], fill=(225, 205, 70))
for i, line in enumerate(("CODE:", "your", "birthday", "- Larry ♥")):
    ctext(d, (250, 95 + i * 100), line, font(FHAND, 78 if i else 70), (40, 40, 120))
im = im.rotate(4, resample=Image.BICUBIC, fillcolor=(255, 236, 90))
im.save(f"{OUT}/note_code.png")

# 5. Safe door brand plate
im = Image.new("RGB", (900, 220), (30, 30, 34))
d = ImageDraw.Draw(im)
d.rectangle((8, 8, 892, 212), outline=(200, 170, 80), width=10)
ctext(d, (450, 110), "UNDERWEAR VAULT", font(FK, 70), (220, 190, 100))
im.save(f"{OUT}/safe_plate.png")

# 6. The no-window house: door sign
im = Image.new("RGB", (1300, 700), (240, 240, 236))
d = ImageDraw.Draw(im)
d.rectangle((12, 12, 1288, 688), outline=(200, 30, 30), width=20)
for i, (t, c) in enumerate((("NO WINDOWS", (30, 30, 30)), ("NO CHIMNEY", (30, 30, 30)), ("NO UNDERWEAR", (200, 30, 30)))):
    ctext(d, (650, 150 + i * 200), t, font(FK, 140), c)
im.save(f"{OUT}/sign_bunker.png")

# 7. Laundry basket tag
im = Image.new("RGB", (700, 200), (245, 245, 245))
d = ImageDraw.Draw(im)
ctext(d, (350, 100), "LAUNDRY", font(FK, 120), (60, 90, 160))
im.save(f"{OUT}/tag_laundry.png")
print("ep4 decals ->", OUT)
