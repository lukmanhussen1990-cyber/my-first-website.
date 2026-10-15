"""Builds the app icons and the intro picture from logo.png (run by build.sh)."""
import os, sys
from PIL import Image, ImageDraw, ImageFilter

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
out_res = os.path.join(root, 'res')
out_assets = sys.argv[1]
logo = Image.open(os.path.join(root, 'logo.png')).convert('RGB')
W = logo.size[0]

def rounded(img, radius_frac):
    s = img.size[0] * 4
    m = Image.new('L', (s, s), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * radius_frac), fill=255)
    out = img.convert('RGBA'); out.putalpha(m.resize(img.size, Image.LANCZOS)); return out

def circle(img):
    s = img.size[0] * 4
    m = Image.new('L', (s, s), 0); ImageDraw.Draw(m).ellipse((0, 0, s - 1, s - 1), fill=255)
    out = img.convert('RGBA'); out.putalpha(m.resize(img.size, Image.LANCZOS)); return out

dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for name, f in dens.items():
    d = os.path.join(out_res, 'mipmap-' + name); os.makedirs(d, exist_ok=True)
    px = int(48 * f)
    small = logo.resize((px, px), Image.LANCZOS)
    rounded(small, 0.18).save(os.path.join(d, 'ic_launcher.png'))
    circle(small).save(os.path.join(d, 'ic_launcher_round.png'))
    # adaptive foreground: the logo at 80/108 of the layer, its edges faded into the green background colour
    L = int(108 * f); inner = int(round(L * 80 / 108))
    fg = logo.resize((inner, inner), Image.LANCZOS).convert('RGBA')
    fade = int(inner * 0.07)
    a = Image.new('L', (inner, inner), 255); dr = ImageDraw.Draw(a)
    for i in range(fade):
        v = int(255 * (i + 1) / (fade + 1)); dr.rectangle((i, i, inner - 1 - i, inner - 1 - i), outline=v)
    fg.putalpha(a)
    layer = Image.new('RGBA', (L, L), (0, 0, 0, 0)); layer.paste(fg, ((L - inner) // 2, (L - inner) // 2), fg)
    layer.save(os.path.join(d, 'ic_launcher_foreground.png'))

# the intro picture: the logo with its sheet taken out (each row of the sheet filled between its two sides),
# so the app can roll its own sheet up out of the platen
plate = logo.copy(); p = plate.load(); src = logo.load()
x0, x1 = 283, 971
for y in range(118, 369):
    a, b = src[x0, y], src[x1, y]
    for x in range(x0 + 1, x1):
        t = (x - x0) / (x1 - x0)
        p[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
os.makedirs(out_assets, exist_ok=True)
plate.save(os.path.join(out_assets, 'intro.jpg'), quality=90, optimize=True, progressive=True)
print('icons and intro picture ready')
