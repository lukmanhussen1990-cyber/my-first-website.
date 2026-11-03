"""2D overlays drawn on every frame (render.py calls draw(img, t)): the red LIVE badge + view counter in the top
corner, the comic pop-up sound words, and the phone-notification flood on "One billion views."
Fonts: Inter Display Black (heavy comic pop-ups, the counter)."""
import math
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from events import T, shot, DUR

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "fonts", "InterDisplay-Black.otf")
_fonts = {}


def font(size):
    if size not in _fonts:
        _fonts[size] = ImageFont.truetype(FONT, size)
    return _fonts[size]


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


# ------------------------------------------------------------------ the view counter
KEYS = [(T["live"], 0, 0), (T["views_1k"] - 0.05, 12, 1000), (T["views_1m"] - 0.05, 1000, 1_000_000),
        (T["views_50m"] - 0.05, 1_000_000, 50_000_000), (T["views_1b"] - 0.05, 50_000_000, 1_000_000_000)]
ROLL = 0.5


def views(t):
    v = 0
    for (tk, a, b) in KEYS[1:]:
        if t >= tk:
            k = smooth((t - tk) / ROLL)
            v = b if k >= 1 else a * (b / max(a, 1)) ** k
    if v == 0 and t > T["live"]:
        v = min(12, int((t - T["live"]) * 9))
    return int(round(v))


def pop_k(t):
    """Counter pop (scale) right after each jump."""
    for (tk, a, b) in KEYS[1:]:
        d = t - tk - ROLL
        if -ROLL < d < 0.35:
            return 1.0 + (0.45 if b >= 1e9 else 0.25) * math.exp(-max(0, d) / 0.12) * (1 if d >= 0 else 0.6)
    return 1.0


def counter_layer(t):
    v = views(t)
    big = v >= 1_000_000_000 and t > T["views_1b"]
    k = pop_k(t)
    txt = f"{v:,}"
    W_, H_ = 900, 200
    im = Image.new("RGBA", (W_, H_), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((10, 30, 190, 120), 18, fill=(232, 32, 42, 255))
    d.ellipse((30, 63, 54, 87), fill=(255, 255, 255, 255))
    d.text((64, 44), "LIVE", font=font(52), fill=(255, 255, 255, 255))
    f = font(int(56 * k))
    tw = d.textlength(txt, font=f)
    d.rounded_rectangle((205, 30, 205 + 110 + tw, 120), 18, fill=(0, 0, 0, 150))
    d.ellipse((222, 58, 272, 92), outline=(255, 255, 255, 255), width=6)
    d.ellipse((238, 66, 256, 84), fill=(255, 255, 255, 255))
    col = (255, 214, 40, 255) if (k > 1.02 or big) else (255, 255, 255, 255)
    d.text((290, 75 - f.size * 0.62), txt, font=f, fill=col, stroke_width=3, stroke_fill=(0, 0, 0, 255))
    return im


# ------------------------------------------------------------------ pop-up words
POPS = [  # text, time, (x, y), angle, fill, size
    ("PLOP", T["plop"], (760, 1460), -10, (255, 255, 255), 170),
    ("DING!", T["ding"], (720, 640), 8, (255, 214, 40), 160),
    ("SQUISH", T["squish"], (330, 640), -8, (140, 230, 90), 150),
    ("FWOOSH!", T["fwoosh"], (540, 600), -6, (120, 220, 255), 175),
    ("SPLAT!", T["splat_u"][0], (330, 1460), 9, (255, 150, 40), 180),
    ("THWAP!", T["thwaps"][0], (760, 1460), -9, (255, 255, 255), 160),
    ("THWAP!", T["thwaps"][1], (330, 640), 8, (255, 214, 40), 160),
    ("SPLAT!", T["splat_n"], (740, 640), -8, (255, 150, 40), 190),
    ("KA-CHING!", T["kaching"], (540, 1470), -5, (255, 214, 40), 140),
]
HOLD = 0.75
_pop_cache = {}


def pop_image(text, fill, size):
    key = (text, fill, size)
    if key not in _pop_cache:
        f = font(size)
        d0 = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
        w = int(d0.textlength(text, font=f)) + 80
        h = int(size * 1.5)
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.text((44, 22), text, font=f, fill=(0, 0, 0, 200), stroke_width=14, stroke_fill=(0, 0, 0, 200))     # shadow
        d.text((36, 12), text, font=f, fill=fill + (255,), stroke_width=12, stroke_fill=(20, 16, 14, 255))
        _pop_cache[key] = im
    return _pop_cache[key]


def pop_scale(dt):
    if dt < 0:
        return 0
    if dt < 0.09:
        return 1.3 * dt / 0.09
    if dt < 0.18:
        return 1.3 - 0.3 * (dt - 0.09) / 0.09
    if dt < HOLD:
        return 1.0
    if dt < HOLD + 0.12:
        return 1.0 - (dt - HOLD) / 0.12
    return 0


# ------------------------------------------------------------------ notifications (one billion views)
NOTES = [("+1,000,000 followers", (255, 60, 90)), ("Your video is #1 trending", (40, 160, 255)),
         ("New brand deal offer!", (60, 200, 110)), ("348,201 new comments", (255, 170, 30)),
         ("You got a verified badge", (40, 160, 255)), ("+9,999,999 likes", (255, 60, 90)),
         ("Mom: call me", (150, 90, 230)), ("News: city covered in", (90, 90, 90))]
N_T0 = T["views_1b"] + 0.25
N_T1 = shot(25)[1]
_note_cache = {}


def note_image(i):
    if i not in _note_cache:
        txt, col = NOTES[i]
        im = Image.new("RGBA", (820, 128), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((6, 10, 814, 124), 28, fill=(0, 0, 0, 70))
        d.rounded_rectangle((0, 0, 808, 114), 28, fill=(250, 250, 252, 245))
        d.ellipse((22, 20, 96, 94), fill=col + (255,))
        d.text((44, 30), "♥" if i % 2 == 0 else "★", font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 40), fill=(255, 255, 255, 255))
        d.text((118, 30), txt, font=font(44), fill=(20, 20, 26, 255))
        _note_cache[i] = im
    return _note_cache[i]


# ------------------------------------------------------------------ compose
def paste(base, im, cx, cy, scale=1.0, angle=0.0, alpha=1.0):
    if scale <= 0.01 or alpha <= 0.01:
        return
    w, h = im.size
    im2 = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    if angle:
        im2 = im2.rotate(angle, resample=Image.BICUBIC, expand=True)
    if alpha < 1:
        a = im2.getchannel("A").point(lambda p: int(p * alpha))
        im2.putalpha(a)
    base.alpha_composite(im2, (int(cx - im2.size[0] / 2), int(cy - im2.size[1] / 2)))


def draw(img, t):
    """img: BGR uint8 1080x1920 -> with overlays."""
    layer = Image.new("RGBA", (img.shape[1], img.shape[0]), (0, 0, 0, 0))
    used = False
    if t >= T["live"]:
        c = counter_layer(t)
        sh = 0
        if T["views_1b"] - 0.05 <= t < T["views_1b"] + 0.9:
            sh = 6 * math.sin(t * 60)
        layer.alpha_composite(c, (50 + int(sh), 110))
        used = True
    for (text, tp, (x, y), ang, fill, size) in POPS:
        dt = t - tp
        s = pop_scale(dt)
        if s > 0:
            jx, jy = (7 * math.sin(dt * 70), 7 * math.cos(dt * 83)) if dt < 0.5 else (0, 0)
            paste(layer, pop_image(text, fill, size), x + jx, y + jy, s, ang + 3 * math.sin(dt * 40) * (dt < 0.5))
            used = True
    if N_T0 <= t < N_T1 + 0.1:
        for i in range(len(NOTES)):
            ts = N_T0 + i * 0.13
            if t < ts:
                continue
            k = smooth((t - ts) / 0.18)
            y = 300 + (i % 5) * 122 + (40 if i >= 5 else 0) + (1 - k) * -160
            x = 540 + (i % 2) * 18 - 9 + (30 if i >= 6 else 0)
            fade = 1 - smooth((t - (N_T1 - 0.12)) / 0.12)
            paste(layer, note_image(i), x, y, 1.0, (i % 3 - 1) * 2.5, k * fade)
            used = True
    if not used:
        return img
    rgba = np.array(layer)
    a = rgba[..., 3:4].astype(np.float32) / 255.0
    rgb = rgba[..., [2, 1, 0]].astype(np.float32)
    return np.clip(img.astype(np.float32) * (1 - a) + rgb * a, 0, 255).astype(np.uint8)
