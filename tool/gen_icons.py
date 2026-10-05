#!/usr/bin/env python3
"""Generates the launcher icons and launch-screen images.

The icon is drawn from scratch: a rounded indigo square holding red, yellow,
green and blue beveled blocks (same block style as the game).

Usage: python3 tool/gen_icons.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

# face, top, left, right, bottom, outline
COLORS = {
    'red': ('#C82E34', '#F08484', '#D3413F', '#AA2323', '#871D26', '#600E08'),
    'yellow': ('#E9B335', '#F7E374', '#F3C63D', '#C9941A', '#B17316', '#583000'),
    'green': ('#34B53B', '#83EE9B', '#34C845', '#149130', '#106F21', '#0B4E17'),
    'blue': ('#3B5BDF', '#8CB2FE', '#4265EF', '#254AC1', '#263690', '#14205E'),
}

BG_TOP = (43, 44, 147)
BG_BOTTOM = (27, 26, 99)


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def block(draw, x, y, s, name):
    face, top, left, right, bottom, outline = [hex2rgb(c) for c in COLORS[name]]
    o = max(1, s * 0.025)
    draw.rectangle([x, y, x + s, y + s], fill=outline)
    l, t, r, b = x + o, y + o, x + s - o, y + s - o
    bev = s * 0.13
    draw.polygon([(l, t), (r, t), (r - bev, t + bev), (l + bev, t + bev)], fill=top)
    draw.polygon([(l, b), (r, b), (r - bev, b - bev), (l + bev, b - bev)], fill=bottom)
    draw.polygon([(l, t), (l + bev, t + bev), (l + bev, b - bev), (l, b)], fill=left)
    draw.polygon([(r, t), (r - bev, t + bev), (r - bev, b - bev), (r, b)], fill=right)
    fl, ft, fr, fb = l + bev, t + bev, r - bev, b - bev
    h = int(fb - ft)
    top_c = lerp(face, top, 0.28)
    for i in range(max(1, h)):
        k = i / max(1, h - 1)
        c = lerp(top_c, face, min(1, k / 0.45)) if k < 0.45 else lerp(face, lerp(face, bottom, 0.1), (k - 0.45) / 0.55)
        draw.line([(fl, ft + i), (fr, ft + i)], fill=c)
    # Gloss.
    draw.line([(l + bev * 0.6, t + s * 0.03), (r - bev * 0.6, t + s * 0.03)], fill=lerp(top, (255, 255, 255), 0.5),
              width=max(1, int(s * 0.03)))
    fw = fr - fl
    draw.rounded_rectangle([fl + fw * 0.08, ft + fw * 0.08, fl + fw * 0.30, ft + fw * 0.20], radius=s * 0.05,
                           fill=lerp(face, (255, 255, 255), 0.33))


def icon_art(size, rounded=True, grid_frac=1.0, background=True):
    """Draws the icon art on a size x size RGBA canvas (4x supersampled)."""
    ss = 4
    S = size * ss
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gsize = S * grid_frac
    off = (S - gsize) / 2
    if background:
        bg = Image.new('RGBA', (S, S))
        bd = ImageDraw.Draw(bg)
        for i in range(S):
            bd.line([(0, i), (S, i)], fill=lerp(BG_TOP, BG_BOTTOM, i / S) + (255,))
        img = bg
    cell = gsize / 4
    # faint grid (composited so it darkens the background)
    grid = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for i in range(1, 4):
        gd.line([(off + i * cell, off), (off + i * cell, off + gsize)], fill=(0, 0, 0, 60), width=max(1, int(S * 0.008)))
        gd.line([(off, off + i * cell), (off + gsize, off + i * cell)], fill=(0, 0, 0, 60), width=max(1, int(S * 0.008)))
    img = Image.alpha_composite(img, grid)
    d = ImageDraw.Draw(img)

    def at(r, c):
        return off + c * cell, off + r * cell

    for r, c in [(0, 0), (0, 1), (1, 0)]:
        block(d, *at(r, c), cell, 'red')
    for r, c in [(2, 0), (2, 1), (3, 0), (3, 1)]:
        block(d, *at(r, c), cell, 'green')
    for r, c in [(2, 3), (3, 2), (3, 3)]:
        block(d, *at(r, c), cell, 'blue')
    # Floating yellow piece with shadow.
    fr, fc = 0.6, 1.55
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for r, c in [(0, 0), (0, 1), (1, 1)]:
        x, y = at(fr + r, fc + c)
        sd.rectangle([x + cell * 0.08, y + cell * 0.12, x + cell * 1.08, y + cell * 1.12], fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(cell * 0.1))
    img = Image.alpha_composite(img, shadow)
    d = ImageDraw.Draw(img)
    for r, c in [(0, 0), (0, 1), (1, 1)]:
        block(d, *at(fr + r, fc + c), cell, 'yellow')

    if rounded:
        mask = Image.new('L', (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill=255)
        img.putalpha(Image.composite(img.getchannel('A'), mask, mask))
    return img.resize((size, size), Image.LANCZOS)


def circle(img):
    S = img.width
    mask = Image.new('L', (S * 4, S * 4), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, S * 4 - 1, S * 4 - 1], fill=255)
    mask = mask.resize((S, S), Image.LANCZOS)
    out = img.copy()
    out.putalpha(mask)
    return out


DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def main():
    master = icon_art(1024, rounded=False)
    for name, k in DENSITIES.items():
        folder = os.path.join(RES, f'mipmap-{name}')
        os.makedirs(folder, exist_ok=True)
        px = int(48 * k)
        legacy = icon_art(px * 2, rounded=True).resize((px, px), Image.LANCZOS)
        legacy.save(os.path.join(folder, 'ic_launcher.png'))
        circle(master.resize((px, px), Image.LANCZOS)).save(os.path.join(folder, 'ic_launcher_round.png'))
        # Adaptive foreground: 108dp canvas, blocks fill the 72dp viewport.
        fpx = int(108 * k)
        fg = icon_art(fpx, rounded=False, grid_frac=72 / 108, background=False)
        fg.save(os.path.join(folder, 'ic_launcher_foreground.png'))

    anydpi = os.path.join(RES, 'mipmap-anydpi-v26')
    os.makedirs(anydpi, exist_ok=True)
    adaptive = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
"""
    for n in ('ic_launcher.xml', 'ic_launcher_round.xml'):
        with open(os.path.join(anydpi, n), 'w') as f:
            f.write(adaptive)

    drawable = os.path.join(RES, 'drawable')
    with open(os.path.join(drawable, 'ic_launcher_background.xml'), 'w') as f:
        f.write("""<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient android:angle="270" android:startColor="#2B2C93" android:endColor="#1B1A63" />
</shape>
""")

    # Launch screen image (pre-Android 12): rounded icon, ~120dp.
    xx = os.path.join(RES, 'drawable-xxhdpi')
    os.makedirs(xx, exist_ok=True)
    icon_art(360, rounded=True).save(os.path.join(xx, 'splash_icon.png'))
    # Android 12+ splash icon: 288dp canvas, rounded square inside the 192dp circle.
    canvas = Image.new('RGBA', (864, 864), (0, 0, 0, 0))
    art = icon_art(372, rounded=True)
    canvas.paste(art, ((864 - 372) // 2, (864 - 372) // 2), art)
    canvas.save(os.path.join(xx, 'splash_icon_v31.png'))

    # README / store image.
    os.makedirs(os.path.join(ROOT, 'docs'), exist_ok=True)
    icon_art(512, rounded=True).save(os.path.join(ROOT, 'docs', 'icon.png'))
    print('icons written')


if __name__ == '__main__':
    main()
