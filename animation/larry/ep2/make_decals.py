"""Episode 2 in-world graphics (signs, badges, screens, prints) with Pillow. Run with system python.
Usage: python3 make_decals.py <out_dir> [you_face.png]
you_face.png is a close-up render of "you" (scripts/lookdev.py you.blend ... closeup); without it a placeholder
silhouette is used, so render the portrait first for the final episode (T-shirt print, shrine photos, passport)."""
import os, sys, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

OUT = sys.argv[1]
FACE = sys.argv[2] if len(sys.argv) > 2 else None
os.makedirs(OUT, exist_ok=True)
FB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
FBO = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FSERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
FMONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
rnd = random.Random(2)


def font(p, s):
    return ImageFont.truetype(p, s)


def ctext(d, xy, text, f, fill, anchor="mm", **kw):
    d.text(xy, text, font=f, fill=fill, anchor=anchor, **kw)


def heart(d, cx, cy, s, fill):
    """filled heart of width ~2s centred on (cx, cy)"""
    d.ellipse((cx - s, cy - s * 0.75, cx, cy + s * 0.25), fill=fill)
    d.ellipse((cx, cy - s * 0.75, cx + s, cy + s * 0.25), fill=fill)
    d.polygon([(cx - s * 0.97, cy - 0.1 * s), (cx + s * 0.97, cy - 0.1 * s), (cx, cy + s * 1.05)], fill=fill)


def face_img(size, zoom=0.8, cy_frac=0.5):
    """Square portrait of 'you' (render if given, else a neutral placeholder head)."""
    if FACE and os.path.exists(FACE):
        im = Image.open(FACE).convert("RGB")
        W, H = im.size                       # lookdev close-up: head roughly in y 0.34..0.6 of a tall frame
        side = int(W * zoom); cy = int(H * cy_frac)
        box = (W // 2 - side // 2, cy - side // 2, W // 2 + side // 2, cy + side // 2)
        return im.crop(box).resize((size, size), Image.LANCZOS)
    im = Image.new("RGB", (size, size), (150, 185, 225))
    d = ImageDraw.Draw(im)
    s = size
    d.ellipse((s * 0.3, s * 0.12, s * 0.7, s * 0.62), fill=(236, 200, 172))        # head
    d.pieslice((s * 0.28, s * 0.08, s * 0.72, s * 0.5), 180, 360, fill=(95, 62, 35))  # hair
    d.rounded_rectangle((s * 0.12, s * 0.66, s * 0.88, s * 1.2), int(s * 0.18), fill=(140, 183, 235))  # shirt
    d.ellipse((s * 0.4, s * 0.33, s * 0.45, s * 0.38), fill=(40, 30, 25))
    d.ellipse((s * 0.55, s * 0.33, s * 0.6, s * 0.38), fill=(40, 30, 25))
    d.arc((s * 0.42, s * 0.42, s * 0.58, s * 0.52), 20, 160, fill=(150, 70, 60), width=max(2, s // 80))
    return im


# 1. Dale nameplate (IT department)
im = Image.new("RGB", (1200, 300), (24, 30, 40))
d = ImageDraw.Draw(im)
d.rectangle((12, 12, 1188, 288), outline=(90, 200, 255), width=10)
ctext(d, (600, 115), "DALE", font(FB, 120), (150, 225, 255))
ctext(d, (600, 225), "IT DEPARTMENT", font(FBO, 66), (150, 225, 255))
im.save(f"{OUT}/nameplate_dale.png")

# 2. Dale's lanyard ID badge
im = Image.new("RGB", (400, 600), (245, 247, 250))
d = ImageDraw.Draw(im)
d.rectangle((0, 0, 400, 130), fill=(20, 110, 200))
ctext(d, (200, 68), "IT", font(FK, 90), (255, 255, 255))
d.rounded_rectangle((90, 160, 310, 400), 16, fill=(205, 215, 228))
d.ellipse((150, 190, 250, 300), fill=(232, 190, 160)); d.pieslice((140, 175, 260, 285), 180, 360, fill=(200, 95, 35))
d.rounded_rectangle((125, 315, 275, 420), 30, fill=(70, 75, 85))
ctext(d, (200, 460), "DALE", font(FB, 72), (20, 25, 35))
ctext(d, (200, 525), "HELP DESK  ·  EXT 404", font(FBO, 26), (90, 95, 110))
d.rectangle((160, 10, 240, 30), fill=(230, 230, 235))
im.save(f"{OUT}/badge_dale.png")

# 3. Shrine polaroids of you (Larry's cubicle) + red string pins
for k in range(4):
    im = Image.new("RGB", (500, 600), (250, 249, 244))
    f = face_img(440)
    if k % 2:
        f = ImageOps.mirror(f)
    im.paste(f, (30, 30))
    d = ImageDraw.Draw(im)
    heart(d, 420, 520, 34, (220, 30, 50))
    ctext(d, (200, 535), ["mine", "soon", "my boy", "♥ you"][k], font(FSERIF, 46), (60, 50, 50))
    im = im.convert("RGBA").rotate(rnd.uniform(-7, 7), resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
    im.save(f"{OUT}/polaroid_{k}.png")

# 4. Bus: route LED sign, bus-stop sign, side livery
im = Image.new("RGB", (1600, 260), (12, 12, 12))
d = ImageDraw.Draw(im)
for x in range(0, 1600, 10):
    for y in range(0, 260, 10):
        d.point((x, y), fill=(40, 30, 10))
ctext(d, (800, 130), "42  NOT YOUR USUAL BUS", font(FMONO, 120), (255, 170, 20))
im = im.filter(ImageFilter.GaussianBlur(1.2))
im.save(f"{OUT}/bus_route.png")
im = Image.new("RGB", (600, 600), (255, 255, 255))
d = ImageDraw.Draw(im)
d.ellipse((20, 20, 580, 580), fill=(0, 120, 70))
ctext(d, (300, 230), "BUS", font(FK, 170), (255, 255, 255))
ctext(d, (300, 400), "STOP", font(FK, 120), (255, 255, 255))
im.save(f"{OUT}/sign_busstop.png")
im = Image.new("RGBA", (2400, 300), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rectangle((0, 110, 2400, 190), fill=(255, 196, 0, 255))
ctext(d, (1200, 150), "CITY TRANSIT", font(FK, 70), (20, 40, 90, 255))
im.save(f"{OUT}/bus_livery.png")

# 5. Boss nameplate (new job) + new company sign
im = Image.new("RGB", (1200, 300), (40, 26, 16))
d = ImageDraw.Draw(im)
d.rectangle((12, 12, 1188, 288), outline=(220, 180, 90), width=10)
ctext(d, (600, 115), "LARRY", font(FB, 120), (240, 210, 140))
ctext(d, (600, 225), "CEO  ·  YOUR NEW BOSS", font(FBO, 60), (240, 210, 140))
im.save(f"{OUT}/nameplate_ceo.png")
im = Image.new("RGBA", (2000, 400), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((10, 10, 1990, 390), 40, fill=(250, 250, 252, 255), outline=(30, 30, 40, 255), width=8)
ctext(d, (1000, 160), "TOTALLY NEW CORP", font(FK, 150), (25, 70, 160, 255))
ctext(d, (1000, 300), "a fresh start  ·  no larrys", font(FBO, 70), (120, 120, 135, 255))
im.save(f"{OUT}/sign_newcorp.png")

# 6. Vending machine front panel (snack grid) + side logo
W, H = 900, 1500
im = Image.new("RGB", (W, H), (18, 20, 26))
d = ImageDraw.Draw(im)
packs = [(230, 57, 70), (255, 183, 3), (42, 157, 143), (69, 123, 157), (244, 132, 95), (120, 80, 200), (60, 180, 75)]
names = ["CHIPS", "CHOCO", "NUTS", "MINTS", "COOKIE", "GUMMY", "CRISPS"]
for r in range(5):
    y0 = 40 + r * 250
    d.rectangle((30, y0 + 200, W - 30, y0 + 214), fill=(150, 155, 165))  # shelf rail
    for c in range(5):
        x0 = 40 + c * 168
        k = (r * 5 + c) % len(packs)
        for depth in range(3):
            o = depth * 10
            d.rounded_rectangle((x0 + o, y0 + 30 + o, x0 + 130 + o, y0 + 195), 12, fill=tuple(int(v * (1 - 0.18 * depth)) for v in packs[k]))
        ctext(d, (x0 + 65, y0 + 110), names[k], font(FB, 26), (255, 255, 255))
        ctext(d, (x0 + 65, y0 + 232), f"{'ABCDE'[r]}{c + 1}", font(FMONO, 28), (220, 220, 220))
        # spiral coil
        for s in range(5):
            d.arc((x0 + 10 + s * 22, y0 + 175, x0 + 40 + s * 22, y0 + 205), 0, 180, fill=(190, 190, 200), width=3)
im.save(f"{OUT}/vending_front.png")
im = Image.new("RGB", (500, 1700), (200, 20, 35))
d = ImageDraw.Draw(im)
for i, ch in enumerate("SNACKS"):
    ctext(d, (250, 170 + i * 250), ch, font(FK, 220), (255, 255, 255))
im.save(f"{OUT}/vending_side.png")
im = Image.new("RGB", (300, 400), (40, 42, 48))
d = ImageDraw.Draw(im)
d.rectangle((25, 25, 275, 95), fill=(10, 30, 15)); ctext(d, (150, 60), "B3  $1.50", font(FMONO, 34), (80, 255, 120))
for i in range(9):
    x, y = 45 + (i % 3) * 75, 130 + (i // 3) * 75
    d.rounded_rectangle((x, y, x + 60, y + 60), 8, fill=(210, 210, 215)); ctext(d, (x + 30, y + 30), str(i + 1), font(FB, 32), (30, 30, 30))
im.save(f"{OUT}/vending_keypad.png")

# 7. Airport: ARRIVALS sign, PASSPORT CONTROL booth sign, open passport, heart entry stamp
im = Image.new("RGB", (1800, 360), (20, 24, 32))
d = ImageDraw.Draw(im)
d.rectangle((0, 0, 360, 360), fill=(255, 205, 0)); ctext(d, (180, 180), "✈", font(FR, 220), (20, 24, 32))
ctext(d, (1080, 180), "ARRIVALS  ·  WELCOME", font(FK, 120), (255, 205, 0))
im.save(f"{OUT}/sign_arrivals.png")
im = Image.new("RGB", (1600, 300), (0, 70, 140))
d = ImageDraw.Draw(im)
ctext(d, (800, 150), "PASSPORT CONTROL", font(FK, 140), (255, 255, 255))
im.save(f"{OUT}/sign_passport.png")
im = Image.new("RGB", (1400, 1000), (232, 226, 210))
d = ImageDraw.Draw(im)
for y in range(0, 1000, 14):
    d.line((0, y, 1400, y + 30), fill=(222, 214, 196), width=2)
d.line((700, 0, 700, 1000), fill=(170, 160, 140), width=6)
d.rectangle((60, 90, 380, 510), fill=(200, 200, 200)); im.paste(face_img(310), (65, 95))
ctext(d, (400, 600), "PASSPORT · PASSEPORT", font(FBO, 46), (60, 60, 80), anchor="lm")
for i, (k, v) in enumerate((("Surname", "YOU"), ("Given names", "JUST YOU"), ("Nationality", "NEW COUNTRY"),
                             ("Notes", "fleeing larry"))):
    d.text((420, 120 + i * 95), k, font=font(FR, 30), fill=(110, 110, 120))
    d.text((420, 152 + i * 95), v, font=font(FBO, 44), fill=(30, 30, 45))
d.text((60, 720), "P<YOU<<<<JUST<<<<<<<<<<<<<<<<<<<<<<<<<", font=font(FMONO, 40), fill=(40, 40, 50))
d.text((60, 790), "0000000LARRY<<WAS<<HERE<<<<<<<<<<<<<<<", font=font(FMONO, 40), fill=(40, 40, 50))
im.save(f"{OUT}/passport_open.png")
st = Image.new("RGBA", (700, 700), (0, 0, 0, 0))
d = ImageDraw.Draw(st)
red = (205, 25, 45, 235)
d.ellipse((30, 30, 670, 670), outline=red, width=26)
heart(d, 350, 250, 120, red)
ctext(d, (350, 460), "WELCOME", font(FK, 70), red)
ctext(d, (350, 530), "HOME", font(FK, 70), red)
ctext(d, (350, 600), "— LARRY", font(FK, 40), red)
mask = Image.effect_noise((700, 700), 60).point(lambda v: 255 if v > 50 else 0)
st.putalpha(Image.composite(st.getchannel("A"), Image.new("L", (700, 700), 0), mask))
st.save(f"{OUT}/stamp_heart.png")

# 8. K-9 vest patch
im = Image.new("RGB", (800, 360), (20, 20, 22))
d = ImageDraw.Draw(im)
d.rounded_rectangle((10, 10, 790, 350), 30, outline=(230, 230, 230), width=10)
ctext(d, (400, 140), "K-9", font(FK, 170), (255, 255, 255))
ctext(d, (400, 285), "GOOD BOY DALE", font(FBO, 58), (255, 205, 0))
im.save(f"{OUT}/patch_k9.png")

# 9. Boxing ring: fight banner + apron
im = Image.new("RGB", (2400, 600), (12, 12, 16))
d = ImageDraw.Draw(im)
d.rectangle((0, 0, 2400, 600), outline=(255, 200, 0), width=18)
ctext(d, (1200, 150), "FIGHT NIGHT", font(FK, 170), (255, 200, 0))
ctext(d, (560, 410), "LARRY", font(FK, 200), (240, 175, 40))
ctext(d, (1200, 410), "VS", font(FK, 140), (255, 255, 255))
ctext(d, (1840, 410), "DALE", font(FK, 200), (90, 190, 255))
im.save(f"{OUT}/banner_fight.png")
im = Image.new("RGB", (2400, 400), (175, 20, 30))
d = ImageDraw.Draw(im)
ctext(d, (1200, 200), "WINNER GETS YOU", font(FK, 200), (255, 255, 255))
im.save(f"{OUT}/ring_apron.png")

# 10. T-shirt print: your face in a heart, "OUR BOY"
S = 1200
im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
mask = Image.new("L", (S, S), 0)
heart(ImageDraw.Draw(mask), S / 2, S * 0.4, S * 0.4, 255)
red = Image.new("RGBA", (S, S), (215, 25, 55, 255))
im.paste(red, (0, 0), mask)
inner = mask.resize((int(S * 0.84), int(S * 0.84)), Image.LANCZOS)
f = face_img(int(S * 0.84), zoom=0.92, cy_frac=0.6).convert("RGBA")
im.paste(f, (int(S * 0.08), int(S * 0.064)), inner)
d = ImageDraw.Draw(im)
ctext(d, (S / 2, S * 0.965), "OUR BOY", font(FK, 120), (215, 25, 55, 255))
im.save(f"{OUT}/tshirt_print.png")

# 11. Heart monitor screens (beating / flatline)
def ecg(flat):
    im = Image.new("RGB", (1000, 640), (4, 10, 6))
    d = ImageDraw.Draw(im)
    for x in range(0, 1000, 50):
        d.line((x, 0, x, 640), fill=(10, 35, 18))
    for y in range(0, 640, 50):
        d.line((0, y, 1000, y), fill=(10, 35, 18))
    pts, base = [], 330
    for x in range(0, 1000, 4):
        ph = (x % 250) / 250
        y = base
        if not flat or x < 520:
            if 0.40 < ph < 0.44: y = base + 30
            elif 0.44 < ph < 0.49: y = base - 210 + (ph - 0.44) * 2000
            elif 0.49 < ph < 0.53: y = base + 60
            elif 0.62 < ph < 0.72: y = base - 40
        pts.append((x, y))
    d.line(pts, fill=(60, 255, 120), width=7)
    ctext(d, (880, 80), "0" if flat else "72", font(FK, 110), (60, 255, 120))
    ctext(d, (880, 150), "BPM", font(FBO, 40), (60, 255, 120))
    return im.filter(ImageFilter.GaussianBlur(0.8))
ecg(False).save(f"{OUT}/monitor_beat.png")
ecg(True).save(f"{OUT}/monitor_flat.png")

# 12. Heaven gate sign
im = Image.new("RGBA", (2000, 500), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((10, 10, 1990, 490), 60, fill=(255, 248, 225, 255), outline=(225, 180, 60, 255), width=16)
ctext(d, (1000, 200), "HEAVEN", font(FSERIF, 200), (205, 150, 30, 255))
ctext(d, (1000, 390), "finally, peace", font(FSERIF, 80), (150, 120, 70, 255))
im.save(f"{OUT}/sign_heaven.png")

print("ep2 decals ->", OUT, "(face:", FACE or "placeholder", ")")
