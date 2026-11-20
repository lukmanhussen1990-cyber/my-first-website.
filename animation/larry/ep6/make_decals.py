"""Episode 6 in-world graphics (Pillow). Usage: python3 make_decals.py <out_dir>"""
import os, sys, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
FBO = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
FM = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"


def font(p, s):
    return ImageFont.truetype(p, s)


def ctext(d, xy, text, f, fill, anchor="mm", **kw):
    d.text(xy, text, font=f, fill=fill, anchor=anchor, **kw)


def heart(d, cx, cy, s, fill):
    d.ellipse((cx - s, cy - s * 0.75, cx, cy + s * 0.25), fill=fill)
    d.ellipse((cx, cy - s * 0.75, cx + s, cy + s * 0.25), fill=fill)
    d.polygon([(cx - s * 0.97, cy - 0.1 * s), (cx + s * 0.97, cy - 0.1 * s), (cx, cy + s * 1.05)], fill=fill)


# 1. Number plates
for name, txt, col in (("plate_family", "BEACH 4", (20, 40, 110)), ("plate_larry", "SNIFF 2", (170, 20, 30)),
                       ("plate_black", "VIP 001", (20, 20, 20))):
    im = Image.new("RGB", (1040, 220), (250, 250, 245))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((6, 6, 1034, 214), 24, outline=(30, 30, 30), width=10)
    ctext(d, (520, 115), txt, font(FK, 150), col)
    im.save(f"{OUT}/{name}.png")

# 2. "LARRY & DALE ON BOARD" yellow diamond sticker
im = Image.new("RGBA", (600, 600), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.polygon([(300, 10), (590, 300), (300, 590), (10, 300)], fill=(250, 210, 20, 255), outline=(20, 20, 20, 255))
d.polygon([(300, 40), (560, 300), (300, 560), (40, 300)], outline=(20, 20, 20, 255), width=8)
for i, t in enumerate(("LARRY", "& DALE", "ON BOARD")):
    ctext(d, (300, 215 + i * 85), t, font(FK, 62), (20, 20, 20, 255))
heart(d, 300, 470, 26, (200, 20, 40, 255))
im.save(f"{OUT}/sticker_onboard.png")

# 3. Highway signs
im = Image.new("RGB", (1400, 700), (20, 110, 60))
d = ImageDraw.Draw(im)
d.rounded_rectangle((14, 14, 1386, 686), 40, outline=(250, 250, 250), width=14)
ctext(d, (520, 250), "BEACH", font(FK, 210), (250, 250, 250))
ctext(d, (520, 470), "5 km", font(FB, 160), (250, 250, 250))
d.polygon([(1050, 210), (1250, 350), (1050, 490), (1050, 410), (930, 410), (930, 290), (1050, 290)], fill=(250, 250, 250))
im.save(f"{OUT}/sign_beach.png")
im = Image.new("RGB", (1400, 500), (110, 70, 35))
d = ImageDraw.Draw(im)
for y in range(0, 500, 10):
    d.line((0, y, 1400, y + 6), fill=(100, 63, 31), width=3)
d.rounded_rectangle((12, 12, 1388, 488), 30, outline=(240, 220, 180), width=12)
ctext(d, (620, 180), "SECRET", font(FK, 150), (245, 230, 195))
ctext(d, (620, 350), "SHORTCUT", font(FK, 150), (245, 230, 195))
d.polygon([(1150, 170), (1330, 260), (1150, 350)], fill=(245, 230, 195))
im.save(f"{OUT}/sign_shortcut.png")

# 4. Picnic blanket (red/white gingham, tileable)
im = Image.new("RGB", (512, 512), (250, 250, 250))
d = ImageDraw.Draw(im)
for k in range(0, 512, 64):
    d.rectangle((k, 0, k + 31, 511), fill=(230, 140, 140))
    d.rectangle((0, k, 511, k + 31), fill=(230, 140, 140))
for i in range(0, 512, 64):
    for j in range(0, 512, 64):
        d.rectangle((i, j, i + 31, j + 31), fill=(200, 30, 40))
im.save(f"{OUT}/gingham.png")

# 5. Gas station sign + price board
im = Image.new("RGB", (900, 1300), (230, 40, 30))
d = ImageDraw.Draw(im)
d.rectangle((16, 16, 884, 1284), outline=(255, 255, 255), width=16)
ctext(d, (450, 220), "GAS", font(FK, 300), (255, 255, 255))
d.rectangle((60, 420, 840, 1240), fill=(20, 20, 22))
for i, (k, v) in enumerate((("REGULAR", "3.99"), ("PREMIUM", "4.49"), ("DIESEL", "4.19"), ("SNACKS", "YES"))):
    y = 520 + i * 190
    d.text((100, y), k, font=font(FB, 64), fill=(240, 240, 240), anchor="lm")
    d.text((800, y), v, font=font(FM, 96), fill=(255, 180, 40), anchor="rm")
im.save(f"{OUT}/sign_gas.png")
im = Image.new("RGB", (400, 260), (15, 25, 20))
d = ImageDraw.Draw(im)
ctext(d, (200, 80), "$ 42.00", font(FM, 64), (90, 255, 140))
ctext(d, (200, 180), "10.5 GAL", font(FM, 48), (90, 255, 140))
im.save(f"{OUT}/pump_screen.png")

# 6. Airline: fuselage window strip, livery titles, seatbelt sign (off/on), CREW ONLY, cockpit panel
im = Image.new("RGBA", (3000, 120), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
for i in range(40):
    x = 40 + i * 73
    d.rounded_rectangle((x, 20, x + 40, 100), 20, fill=(25, 35, 50, 255))
im.save(f"{OUT}/plane_windows.png")
im = Image.new("RGBA", (2400, 360), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
ctext(d, (1200, 180), "SKYLINE AIR", font(FK, 280), (25, 60, 150, 255))
im.save(f"{OUT}/plane_title.png")
for name, lit in (("seatbelt_off", False), ("seatbelt_on", True)):
    im = Image.new("RGB", (600, 260), (30, 30, 34))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((10, 10, 590, 250), 26, outline=(90, 90, 96), width=8)
    c = (255, 200, 60) if lit else (80, 80, 84)
    cx = 300
    d.ellipse((cx - 30, 40, cx + 30, 100), fill=c)                          # pictogram: person + belt
    d.rounded_rectangle((cx - 50, 105, cx + 50, 215), 26, fill=c)
    d.rectangle((cx - 80, 150, cx + 80, 170), fill=(30, 30, 34))
    d.rectangle((cx - 80, 150, cx + 80, 168), outline=c, width=6)
    d.rectangle((cx - 12, 145, cx + 12, 175), fill=c)
    ctext(d, (110, 130), "FASTEN", font(FK, 40), c)
    ctext(d, (490, 130), "BELT", font(FK, 40), c)
    if lit:
        glow = im.filter(ImageFilter.GaussianBlur(10))
        im = Image.blend(im, glow, 0.3)
    im.save(f"{OUT}/{name}.png")
im = Image.new("RGB", (700, 220), (200, 30, 30))
d = ImageDraw.Draw(im)
ctext(d, (350, 110), "CREW ONLY", font(FK, 110), (255, 255, 255))
im.save(f"{OUT}/crew_only.png")
im = Image.new("RGB", (2000, 600), (28, 30, 34))
d = ImageDraw.Draw(im)
rnd = random.Random(4)
for i in range(10):                                           # round gauges + two screens
    cx, cy = 120 + (i % 5) * 180 + (900 if i >= 5 else 0) * 0, 160 + (i // 5) * 260
    if i >= 5:
        cx = 120 + (i - 5) * 180 + 1060
        cy = 160
    d.ellipse((cx - 70, cy - 70, cx + 70, cy + 70), fill=(10, 10, 12), outline=(150, 150, 155), width=6)
    a = rnd.uniform(0, 2 * math.pi)
    d.line((cx, cy, cx + 55 * math.cos(a), cy + 55 * math.sin(a)), fill=(255, 255, 255), width=6)
    for k in range(12):
        b = k * math.pi / 6
        d.line((cx + 58 * math.cos(b), cy + 58 * math.sin(b), cx + 68 * math.cos(b), cy + 68 * math.sin(b)), fill=(200, 200, 200), width=3)
for x0, col in ((60, (40, 110, 200)), (1060, (30, 160, 90))):
    d.rectangle((x0, 300, x0 + 860, 560), fill=(8, 12, 18), outline=(120, 120, 125), width=6)
    d.rectangle((x0 + 20, 320, x0 + 840, 430), fill=col)
    d.rectangle((x0 + 20, 430, x0 + 840, 540), fill=(140, 90, 50) if col[2] > 150 else (20, 60, 30))
    d.line((x0 + 330, 430, x0 + 530, 430), fill=(255, 220, 0), width=8)
for i in range(30):                                           # little lit buttons
    x = 980 + (i % 3) * 25; y = 40 + (i // 3) * 26
    d.rectangle((x, y, x + 16, y + 14), fill=rnd.choice(((60, 220, 90), (255, 190, 40), (90, 90, 95))))
im.save(f"{OUT}/cockpit_panel.png")
print("ep6 decals ->", OUT)
