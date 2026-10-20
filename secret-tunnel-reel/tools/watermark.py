#!/usr/bin/env python3
"""Channel watermark: a small see-through badge in the top-right corner, a pill of
dark leafy glass with a sprout icon and "Garden_reels", clear of the captions,
the action and Instagram's buttons. Drawn at 4x and downsampled, written as a
full-frame transparent PNG (build/watermark.png) that make_reel.sh overlays."""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT = "Garden_reels"
FW, FH = 1080, 1920
RIGHT, TOP = 34, 168  # badge margin from the right edge, top edge (below Instagram's top bar)
H = 56  # badge height, px
OPACITY = 0.82
SS = 4  # supersampling

font = ImageFont.truetype(os.path.join(ROOT, "assets", "Fredoka-Bold.ttf"), 30 * SS)
pad_l, icon, gap, pad_r = 10, 36, 8, 20
tw = font.getlength(TEXT) / SS
W = round(pad_l + icon + gap + tw + pad_r)

img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
r = H * SS / 2
d.rounded_rectangle([0, 0, W * SS - 1, H * SS - 1], radius=r, fill=(16, 34, 20, 112), outline=(255, 255, 255, 84), width=2 * SS)


def leaf(base, length, width, ang, fill, vein):
    """a leaf from its base along `ang` (radians, 0 = up), pointed at both ends"""
    ux, uy = math.sin(ang), -math.cos(ang)
    nx, ny = -uy, ux
    left, right = [], []
    for i in range(25):
        s = i / 24
        h = width / 2 * math.sin(math.pi * s) ** 0.8
        cx, cy = base[0] + ux * length * s, base[1] + uy * length * s
        left.append((cx + nx * h, cy + ny * h))
        right.append((cx - nx * h, cy - ny * h))
    d.polygon(left + right[::-1], fill=fill)
    d.line([base, (base[0] + ux * length * 0.82, base[1] + uy * length * 0.82)], fill=vein, width=max(1, round(1.4 * SS)))


# sprout: a little stem with two leaves, on a soft light disc
cx, cy = (pad_l + icon / 2) * SS, H * SS / 2
rr = icon / 2 * SS
d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(255, 255, 255, 46))
stem_top = (cx, cy - 2 * SS)
d.line([(cx + 1 * SS, cy + 11 * SS), (cx, cy + 4 * SS), stem_top], fill=(96, 170, 70, 255), width=round(2.6 * SS), joint="curve")
leaf(stem_top, 14 * SS, 9 * SS, -0.95, (98, 178, 72, 255), (60, 120, 46, 255))
leaf(stem_top, 16 * SS, 10 * SS, 0.85, (140, 214, 92, 255), (78, 146, 56, 255))

# the name, with a faint shadow so it holds on the bright sky
tx, ty = (pad_l + icon + gap) * SS, H * SS / 2
shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
ImageDraw.Draw(shadow).text((tx, ty + 1.5 * SS), TEXT, font=font, fill=(0, 0, 0, 120), anchor="lm")
img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(2 * SS)))
ImageDraw.Draw(img).text((tx, ty), TEXT, font=font, fill=(255, 255, 255, 240), anchor="lm")

badge = img.resize((W, H), Image.LANCZOS)
badge.putalpha(badge.getchannel("A").point(lambda a: round(a * OPACITY)))
frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
frame.alpha_composite(badge, (FW - RIGHT - W, TOP))
out = os.path.join(ROOT, "build", "watermark.png")
frame.save(out)
print(f"wrote {out} ({W}x{H} badge at {FW - RIGHT - W},{TOP})")
