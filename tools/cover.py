#!/usr/bin/env python3
"""Cover image 1080x1920: a clean 3D still of the frozen face in the ice + big title text.

  node tools/render.js --stills 53.8 --names cover_bg --noov --out frames/cover --scale 1   (render the background first)
  python3 tools/cover.py                                                          -> final/cover.png
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = os.path.join(ROOT, 'frames', 'cover', 'cover_bg.png')
OUT = os.path.join(ROOT, 'final', 'cover.png')
BLACK = os.path.join(ROOT, 'assets', 'fonts', 'Montserrat-Black.ttf')
XB = os.path.join(ROOT, 'assets', 'fonts', 'Montserrat-ExtraBold.ttf')
RED = (229, 56, 59)
GOLD = (242, 181, 68)


def text_layer(size, lines):
    """lines: [(text, font_px, colour, y_centre)] -> RGBA layer with soft dark shadow"""
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    shadow = Image.new('RGBA', size, (0, 0, 0, 0))
    d, ds = ImageDraw.Draw(layer), ImageDraw.Draw(shadow)
    for text, px, col, yc in lines:
        f = ImageFont.truetype(BLACK, px)
        sp = max(2, px // 30)                     # letter spacing
        widths = [f.getlength(ch) for ch in text]
        total = sum(widths) + sp * (len(text) - 1)
        x = 520 - total / 2                        # same column as the video captions (safe right margin)
        for ch, w in zip(text, widths):
            ds.text((x, yc + 8), ch, font=f, fill=(0, 0, 0, 230), anchor='lm')
            d.text((x, yc), ch, font=f, fill=col + (255,), anchor='lm', stroke_width=max(2, px // 28), stroke_fill=(10, 6, 0, 150))
            x += w + sp
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    return Image.alpha_composite(shadow, layer)


def main():
    bg = Image.open(BG).convert('RGBA').resize((1080, 1920), Image.LANCZOS)
    # darken the forehead and the beard so the title reads; the eyes (y ~600-820) stay clear
    grad = Image.new('L', (1, 1920))
    for y in range(1920):
        v = 0
        if y < 640:
            v = int(185 * (1 - y / 640) ** 1.1)
        if y > 1150:
            v = int(200 * min(1, (y - 1150) / 420) ** 1.3)
        grad.putpixel((0, y), v)
    shade = Image.new('RGBA', (1080, 1920), (0, 4, 12, 255))
    shade.putalpha(grad.resize((1080, 1920)))
    img = Image.alpha_composite(bg, shade)
    title = text_layer((1080, 1920), [
        ("HE WASN'T", 104, (255, 255, 255), 330),
        ('ALONE', 190, RED, 470),
        ('DOWN THERE', 104, (255, 255, 255), 1350),
    ])
    img = Image.alpha_composite(img, title)
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(XB, 30)
    d.text((60, 1440), '@garden_reels', font=f, fill=(255, 255, 255, 170), anchor='lm')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.convert('RGB').save(OUT, quality=95)
    print('->', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
