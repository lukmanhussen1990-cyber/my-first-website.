"""Generate 2D textures with PIL: shop signs, shop interiors, street-name signs,
pedestrian-signal icons and the hero's chest emblem.

Run with any Python 3 that has Pillow:  python3 gen_textures.py /opt/work/assets/gen
"""
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT_BOLD = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
FONT_BLACK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
FONT_SANS = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

SHOPS = ["DELI & GROCERY", "PHARMACY", "PIZZA", "BAGELS & COFFEE", "NAIL SPA", "OPTICAL", "NEWS & LOTTO",
         "HALAL GRILL", "DRY CLEANERS", "SUSHI BAR", "CAFE", "FLORIST", "WINE & LIQUORS", "DINER", "GIFTS",
         "BARBER SHOP", "THAI KITCHEN", "SHOE REPAIR", "WIRELESS", "BANK"]
SCHEMES = [((178, 24, 24), (255, 255, 255)), ((250, 250, 245), (20, 20, 20)), ((18, 70, 40), (255, 236, 160)),
           ((20, 35, 90), (255, 255, 255)), ((10, 10, 10), (230, 190, 90)), ((235, 200, 40), (25, 25, 25)),
           ((120, 20, 60), (255, 240, 240)), ((35, 110, 160), (255, 255, 255))]


def fit_font(draw, text, path, box_w, box_h, start=200):
    size = start
    while size > 8:
        f = ImageFont.truetype(path, size)
        l, t, r, b = draw.textbbox((0, 0), text, font=f)
        if r - l <= box_w and b - t <= box_h:
            return f, (r - l, b - t, l, t)
        size -= 4
    f = ImageFont.truetype(path, 8)
    l, t, r, b = draw.textbbox((0, 0), text, font=f)
    return f, (r - l, b - t, l, t)


def make_sign(text, scheme, path, rng):
    W, H = 1600, 220
    bg, fg = scheme
    im = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(im)
    # subtle panel border + grime
    d.rectangle([6, 6, W - 7, H - 7], outline=tuple(int(c * 0.7) for c in bg), width=6)
    font_path = rng.choice([FONT_BOLD, FONT_SANS, FONT_BLACK, FONT_SERIF if rng.random() < 0.2 else FONT_SANS])
    f, (tw, th, l, t) = fit_font(d, text, font_path, W * 0.86, H * 0.62)
    d.text(((W - tw) / 2 - l, (H - th) / 2 - t), text, font=f, fill=fg)
    noise = Image.effect_noise((W, H), 18).convert("L")
    im = Image.composite(im, Image.blend(im, Image.new("RGB", (W, H), (60, 55, 50)), 0.25),
                         noise.point(lambda v: 255 if v > 110 else 200))
    im.save(path, quality=92)


def make_interior(path, rng, kind):
    """A shop / lobby back wall as seen through the window: shelves, products, lights."""
    W, H = 1024, 512
    wall = rng.choice([(205, 200, 190), (230, 225, 215), (180, 170, 160), (120, 110, 100), (240, 238, 230)])
    im = Image.new("RGB", (W, H), wall)
    d = ImageDraw.Draw(im)
    if kind == "shop":
        shelf_c = rng.choice([(90, 70, 50), (200, 200, 205), (60, 60, 65)])
        for row in range(5):
            y = 120 + row * 70
            d.rectangle([20, y + 52, W - 20, y + 60], fill=shelf_c)
            x = 24
            while x < W - 40:
                w = rng.randint(10, 26)
                h = rng.randint(24, 50)
                c = tuple(rng.randint(30, 240) for _ in range(3))
                d.rectangle([x, y + 52 - h, x + w, y + 52], fill=c)
                x += w + rng.randint(1, 4)
        # counter
        d.rectangle([rng.randint(50, 500), 400, rng.randint(600, 980), 512], fill=(70, 55, 45))
    else:
        # lobby: marble wall + reception desk + elevator doors
        for i in range(0, W, 128):
            d.rectangle([i, 0, i + 124, H], fill=tuple(min(255, c + rng.randint(-10, 10)) for c in wall))
        for i in range(3):
            x = 150 + i * 260
            d.rectangle([x, 160, x + 140, 470], fill=(150, 150, 155))
            d.line([x + 70, 160, x + 70, 470], fill=(90, 90, 95), width=3)
        d.rectangle([300, 380, 720, 512], fill=(40, 35, 30))
    # ceiling light strip
    for x in range(40, W, 180):
        d.rectangle([x, 8, x + 110, 22], fill=(255, 250, 235))
    im = im.filter(ImageFilter.GaussianBlur(1.6))
    im.save(path, quality=90)


def make_street_sign(text, path):
    W, H = 900, 180
    im = Image.new("RGB", (W, H), (18, 92, 52))
    d = ImageDraw.Draw(im)
    d.rectangle([8, 8, W - 9, H - 9], outline=(240, 240, 240), width=7)
    f, (tw, th, l, t) = fit_font(d, text, FONT_SANS, W * 0.86, H * 0.6)
    d.text(((W - tw) / 2 - l, (H - th) / 2 - t), text, font=f, fill=(245, 245, 245))
    im.save(path, quality=95)


def make_ped_icons(dirpath):
    # orange raised hand and white walking person on black
    for name, color in (("ped_hand", (255, 120, 20)), ("ped_walk", (240, 245, 255))):
        im = Image.new("RGB", (256, 256), (5, 5, 5))
        d = ImageDraw.Draw(im)
        if name == "ped_hand":
            d.rounded_rectangle([80, 110, 176, 220], 20, fill=color)
            for i, x in enumerate((84, 106, 128, 150)):
                d.rounded_rectangle([x, 40 + (i in (0, 3)) * 18, x + 20, 130], 10, fill=color)
            d.rounded_rectangle([160, 120, 200, 150], 12, fill=color)
        else:
            d.ellipse([112, 30, 148, 66], fill=color)
            d.line([130, 70, 120, 150], fill=color, width=22)
            d.line([120, 150, 90, 230], fill=color, width=18)
            d.line([120, 150, 160, 225], fill=color, width=18)
            d.line([126, 90, 90, 135], fill=color, width=14)
            d.line([126, 90, 168, 125], fill=color, width=14)
        im.save(os.path.join(dirpath, name + ".png"))


def make_emblem(path):
    """Diamond 'S' shield (fan-art style): yellow field, red border and serpentine S."""
    S = 1024
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    red = (180, 14, 18, 255)
    yel = (250, 205, 30, 255)
    # pentagon-diamond shield, wide top, point at the bottom
    outer = [(80, 300), (250, 120), (774, 120), (944, 300), (512, 930)]
    inner = [(140, 305), (282, 165), (742, 165), (884, 305), (512, 850)]
    d.polygon(outer, fill=red)
    d.polygon(inner, fill=yel)
    # serpentine S built from thick strokes
    w = 92
    pts_top = [(700, 255), (560, 225), (380, 230), (300, 300), (340, 390), (520, 450), (690, 520),
               (700, 620), (600, 700), (460, 710)]
    d.line(pts_top, fill=red, width=w, joint="curve")
    for p in pts_top:
        d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=red)
    # flare at the top right and bottom left
    d.polygon([(640, 210), (790, 230), (720, 330)], fill=red)
    d.polygon([(520, 690), (330, 640), (420, 760)], fill=red)
    # keep everything inside the inner shield edge
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).polygon(outer, fill=255)
    im.putalpha(Image.composite(im.split()[3], Image.new("L", (S, S), 0), mask))
    im.save(path)


def make_taxi_sign(path):
    im = Image.new("RGB", (512, 128), (250, 245, 230))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT_BLACK, 92)
    l, t, r, b = d.textbbox((0, 0), "TAXI", font=f)
    d.text(((512 - (r - l)) / 2 - l, (128 - (b - t)) / 2 - t), "TAXI", font=f, fill=(20, 20, 20))
    im.save(path)


def main(out):
    os.makedirs(out, exist_ok=True)
    rng = random.Random(11)
    for i, s in enumerate(SHOPS):
        make_sign(s, SCHEMES[i % len(SCHEMES)], os.path.join(out, f"sign_{i:02d}.jpg"), rng)
    for i in range(8):
        make_interior(os.path.join(out, f"interior_{i}.jpg"), rng, "shop" if i < 6 else "lobby")
    for name, txt in (("st_w41", "W 41 St"), ("st_6av", "6 Av"), ("st_oneway", "ONE WAY  →")):
        make_street_sign(txt, os.path.join(out, name + ".jpg"))
    make_ped_icons(out)
    make_emblem(os.path.join(out, "emblem.png"))
    make_taxi_sign(os.path.join(out, "taxi_sign.png"))
    print("textures written to", out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/opt/work/assets/gen")
