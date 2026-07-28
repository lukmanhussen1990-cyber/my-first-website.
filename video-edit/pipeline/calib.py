"""Calibrate replacement fonts against the original letterforms in frame 0144."""
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont

SERIF = '/usr/local/lib/python3.11/dist-packages/font_source_serif_pro/files/SourceSerifPro-Regular.ttf'
SANS  = '/usr/local/lib/python3.11/dist-packages/font_source_sans_pro/files/SourceSansPro-Regular.ttf'

g = cv2.imread('all/0144.png', cv2.IMREAD_GRAYSCALE)

def ink_box(y0, y1, x0, x1, thr):
    m = g[y0:y1, x0:x1] > thr
    ys, xs = np.nonzero(m)
    return (x0 + xs.min(), y0 + ys.min(), x0 + xs.max(), y0 + ys.max())

# original metrics
E   = ink_box(170, 250, 363, 401, 110)   # 'E' of Elon  -> cap height
lon = ink_box(170, 250, 401, 490, 110)
S   = ink_box(425, 475, 246, 268, 95)    # 'S' of Sonnet -> cap height
onn = ink_box(425, 475, 268, 300, 95)    # x-height letters
print("orig E   box", E,   "capH =", E[3] - E[1] + 1)
print("orig lon box", lon)
print("orig Elon width =", 488 - 363 + 1)
print("orig S   box", S,   "capH =", S[3] - S[1] + 1)
print("orig onn box", onn, "xH   =", onn[3] - onn[1] + 1)

def render_metrics(path, size, text):
    f = ImageFont.truetype(path, size)
    img = Image.new('L', (900, 300), 0)
    ImageDraw.Draw(img).text((40, 60), text, font=f, fill=255)
    a = np.array(img)
    ys, xs = np.nonzero(a > 110)
    return xs.min(), ys.min(), xs.max(), ys.max()

def fit_cap(path, letter, target_cap):
    best = None
    for size in range(10, 160):
        x0, y0, x1, y1 = render_metrics(path, size, letter)
        cap = y1 - y0 + 1
        d = abs(cap - target_cap)
        if best is None or d < best[0]:
            best = (d, size, cap)
    return best

d, size, cap = fit_cap(SERIF, 'E', E[3] - E[1] + 1)
print(f"\nSourceSerifPro: size={size} gives capH={cap} (target {E[3]-E[1]+1}, err {d})")
for t in ('Elon', 'Imran'):
    x0, y0, x1, y1 = render_metrics(SERIF, size, t)
    print(f"   '{t}' ink width = {x1-x0+1}")

d2, size2, cap2 = fit_cap(SANS, 'S', S[3] - S[1] + 1)
print(f"\nSourceSansPro: size={size2} gives capH={cap2} (target {S[3]-S[1]+1}, err {d2})")
for t in ('Sonnet 4.6', 'Fable 5.1', 'Adapative', 'Adaptive'):
    x0, y0, x1, y1 = render_metrics(SANS, size2, t)
    print(f"   '{t}' ink width = {x1-x0+1}")
print("\norig 'Sonnet 4.6' ink width =", 405 - 246 + 1)
print("orig 'Adapative'  ink width =", 565 - 422 + 1)
