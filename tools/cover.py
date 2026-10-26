#!/usr/bin/env python3
"""Cover image 1080x1920: a clean 3D still of the frozen face in the ice + big title text.

  node tools/render.js --stills 54.0 --names cover_bg --noov --out frames/cover   (render the background first)
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
    # darken the top and bottom so the title reads
    grad = Image.new('L', (1, 1920))
    for y in range(1920):
        v = 0
        if y < 700:
            v = int(170 * (1 - y / 700) ** 1.4)
        if y > 1500:
            v = int(150 * ((y - 1500) / 420) ** 1.5)
        grad.putpixel((0, y), v)
    shade = Image.new('RGBA', (1080, 1920), (0, 4, 12, 255))
    shade.putalpha(grad.resize((1080, 1920)))
    img = Image.alpha_composite(bg, shade)
    title = text_layer((1080, 1920), [
        ("HE WASN'T", 108, (255, 255, 255), 400),
        ('ALONE', 196, RED, 545),
        ('DOWN THERE', 108, (255, 255, 255), 690),
    ])
    img = Image.alpha_composite(img, title)
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(XB, 30)
    d.text((60, 1385), '@garden_reels', font=f, fill=(255, 255, 255, 170), anchor='lm')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.convert('RGB').save(OUT, quality=95)
    print('->', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
