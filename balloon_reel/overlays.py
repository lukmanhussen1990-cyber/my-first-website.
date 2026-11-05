"""2D overlays in the reference's style, drawn on the final 1080x1920 frame (render.py):
  - labels: small dark navy boxes with white uppercase text (Lilita One), a thin gold border and a thin gold
    pointer line to the thing they name ("MELON SIZE", "1.3 TONS", "HIM", "EARTH", "8 BILLION PEOPLE"...);
    big headline labels without a pointer ("DAMAGE: 0%"). They pop in with a little bounce.
  - news: red "BALL-POCALYPSE" header, red LIVE tag with a blinking dot, yellow ticker "EVACUATE NOW".
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_L = os.path.join(HERE, "fonts", "LilitaOne-Regular.ttf")
NAVY = (29, 33, 51)
GOLD = (226, 198, 106)
_fonts = {}


def font(size, path=FONT_L):
    key = (size, path)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(path, size)
    return _fonts[key]


def composite(img, layer):
    """img: HxWx3 uint8 BGR; layer: PIL RGBA the same size -> blended BGR."""
    a = np.asarray(layer, dtype=np.float32)
    al = a[..., 3:4] / 255.0
    if al.max() <= 0:
        return img
    rgb = a[..., :3][..., ::-1]
    return (img.astype(np.float32) * (1 - al) + rgb * al).astype(np.uint8)


def back_out(x, s=1.9):
    x = min(max(x, 0.0), 1.0) - 1
    return x * x * ((s + 1) * x + s) + 1


def label_box(draw_layer, text, cx, cy, size, k, border=True, fill=NAVY, text_col=(255, 255, 255), alpha=1.0, sub=None):
    """Draws one label centred at (cx, cy), scaled by k (pop). Returns the box (x0, y0, x1, y1)."""
    f = font(max(8, int(size * k)))
    lines = text.split("\n")
    sizes = [f.getbbox(l) for l in lines]
    tw = max(b[2] - b[0] for b in sizes)
    lh = int(size * k * 1.02)
    pad_x, pad_y = int(0.42 * size * k), int(0.2 * size * k)
    sub_f = font(max(8, int(size * 0.5 * k))) if sub else None
    sub_h = int(size * 0.56 * k) if sub else 0
    sub_w = (sub_f.getbbox(sub)[2] - sub_f.getbbox(sub)[0]) if sub else 0
    bw, bh = max(tw, sub_w) + 2 * pad_x, lh * len(lines) + 2 * pad_y + sub_h
    x0, y0 = cx - bw / 2, cy - bh / 2
    d = ImageDraw.Draw(draw_layer)
    r = int(0.24 * size * k)
    a = int(255 * alpha)
    d.rounded_rectangle((x0, y0, x0 + bw, y0 + bh), r, fill=fill + (int(240 * alpha),),
                        outline=(GOLD + (a,)) if border else None, width=max(2, int(3 * k)) if border else 0)
    for i, l in enumerate(lines):
        b = f.getbbox(l)
        d.text((cx - (b[2] - b[0]) / 2 - b[0], y0 + pad_y + i * lh - b[1] + (lh - (b[3] - b[1])) / 2), l, font=f, fill=text_col + (a,))
    if sub:
        b = sub_f.getbbox(sub)
        d.text((cx - (b[2] - b[0]) / 2 - b[0], y0 + pad_y + len(lines) * lh - b[1] + 2), sub, font=sub_f, fill=(242, 214, 90, a))
    return (x0, y0, x0 + bw, y0 + bh)


def draw_label(img, e, t, anchor_xy):
    """e: dict(text, t0, [t1], pos=(fx, fy) box centre as frame fractions, or off=(dx, dy) px from the anchor,
    size=px, border, pointer, sub). anchor_xy: the named point on screen (output px) or None."""
    lt = t - e["t0"]
    if lt < 0 or t >= e.get("t1", 1e9):
        return img
    H, W = img.shape[:2]
    k = back_out(lt / 0.22) if lt < 0.22 else 1.0
    alpha = min(1.0, lt / 0.08)
    if "t1" in e and e["t1"] - t < 0.12:
        alpha *= max(0.0, (e["t1"] - t) / 0.12)
    size = e.get("size", 52)
    if "off" in e and anchor_xy is not None:
        cx, cy = anchor_xy[0] + e["off"][0], anchor_xy[1] + e["off"][1]
    else:
        cx, cy = e["pos"][0] * W, e["pos"][1] * H
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # soft shadow under the box
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    box = label_box(sh, e["text"], cx + 5, cy + 7, size, k, border=False, fill=(0, 0, 0), text_col=(0, 0, 0), alpha=0.35 * alpha, sub=e.get("sub"))
    sh = sh.filter(ImageFilter.GaussianBlur(9))
    layer.alpha_composite(sh)
    d = ImageDraw.Draw(layer)
    if e.get("pointer", True) and anchor_xy is not None:
        pk = min(1.0, max(0.0, (lt - 0.06) / 0.16))
        ax, ay = anchor_xy
        bx = min(max(ax, box[0] + 10), box[2] - 10)
        by = box[3] if ay > box[3] else (box[1] if ay < box[1] else cy)
        ex, ey = bx + (ax - bx) * pk, by + (ay - by) * pk
        d.line((bx, by, ex, ey), fill=GOLD + (int(255 * alpha),), width=5)
        if pk >= 1:
            d.ellipse((ax - 7, ay - 7, ax + 7, ay + 7), fill=GOLD + (int(255 * alpha),))
    label_box(layer, e["text"], cx, cy, size, k, border=e.get("border", True), alpha=alpha, sub=e.get("sub"),
              fill=tuple(e.get("fill", NAVY)), text_col=tuple(e.get("text_col", (255, 255, 255))))
    return composite(img, layer)


TICKER = "EVACUATE NOW  •  EVACUATE NOW  •  "


def draw_news(img, t, e):
    """The TV news frame: red header + LIVE tag (top), yellow ticker (bottom). t = seconds since the shot start."""
    H, W = img.shape[:2]
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    k = back_out(t / 0.25) if t < 0.25 else 1.0
    # header band (slides in from the left)
    y0, hh = int(0.072 * H), int(0.066 * H)
    xr = int(W * (0.06 + 0.88 * min(1.0, k)))
    d.rounded_rectangle((int(0.05 * W), y0, xr, y0 + hh), 14, fill=(214, 30, 40, 245))
    d.rectangle((int(0.05 * W), y0 + hh - 10, xr, y0 + hh), fill=(160, 18, 28, 245))
    f = font(int(hh * 0.74))
    title = e.get("title", "BALL-POCALYPSE")
    b = f.getbbox(title)
    tx = (int(0.05 * W) + xr) / 2 - (b[2] - b[0]) / 2 - b[0]
    if k > 0.6:
        d.text((tx, y0 + (hh - (b[3] - b[1])) / 2 - b[1] - 3), title, font=f, fill=(255, 255, 255, 255))
    # LIVE tag + blinking dot
    ly = y0 + hh + 14
    d.rounded_rectangle((int(0.05 * W), ly, int(0.05 * W) + 168, ly + 62), 10, fill=(214, 30, 40, 250))
    fl = font(44)
    d.text((int(0.05 * W) + 58, ly + 6), "LIVE", font=fl, fill=(255, 255, 255, 255))
    if (t % 0.8) < 0.5:
        d.ellipse((int(0.05 * W) + 18, ly + 19, int(0.05 * W) + 42, ly + 43), fill=(255, 255, 255, 255))
    # ticker band + BREAKING tab
    ty, th = int(0.86 * H), int(0.046 * H)
    d.rectangle((0, ty, W, ty + th), fill=(246, 208, 42, 250))
    TK = e.get("ticker", TICKER)
    ft = font(int(th * 0.7))
    tw = ft.getbbox(TK)[2]
    off = -((t * 330) % tw)
    x = off
    while x < W:
        d.text((x + 250, ty + (th - (ft.getbbox(TK)[3] - ft.getbbox(TK)[1])) / 2 - ft.getbbox(TK)[1]), TK, font=ft, fill=(20, 20, 24, 255))
        x += tw
    d.rectangle((0, ty, 236, ty + th), fill=(20, 22, 34, 255))
    fb = font(int(th * 0.58))
    d.text((22, ty + (th - (fb.getbbox("BREAKING")[3] - fb.getbbox("BREAKING")[1])) / 2 - fb.getbbox("BREAKING")[1]), "BREAKING", font=fb, fill=(255, 255, 255, 255))
    return composite(img, layer)


def whiteout(img, t, ta, tb):
    """Fades the frame to pure white between absolute times ta and tb (the collapse)."""
    if t < ta:
        return img
    a = min(1.0, (t - ta) / max(1e-6, tb - ta)) ** 1.6
    return (img.astype(np.float32) * (1 - a) + 255 * a).astype(np.uint8)


def draw_word(img, e, t, anchor_xy=None):
    """A comic sound word (SHAKE, BANG!, CLANK, BOOM!...): chunky Lilita One with a thick black outline, popping in
    with a bounce, a little wobble, optional rotation. e: text, t0, t1, pos=(fx, fy) or anchor + off, size, color, angle."""
    lt = t - e["t0"]
    t1 = e.get("t1", e["t0"] + 0.9)
    if lt < 0 or t >= t1:
        return img
    H, W = img.shape[:2]
    k = back_out(lt / 0.16, 2.6) if lt < 0.16 else 1.0 + 0.04 * math.sin(lt * 30) * math.exp(-lt * 4)
    alpha = 1.0 if t < t1 - 0.12 else max(0.0, (t1 - t) / 0.12)
    size = max(8, int(e.get("size", 90) * k))
    f = font(size)
    txt = e["text"]
    b = f.getbbox(txt)
    tw, th = b[2] - b[0], b[3] - b[1]
    pad = int(size * 0.3)
    lay = Image.new("RGBA", (tw + 2 * pad, th + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    col = tuple(e.get("color", (255, 255, 255)))
    d.text((pad - b[0], pad - b[1]), txt, font=f, fill=col + (int(255 * alpha),), stroke_width=max(3, int(size * 0.09)), stroke_fill=(0, 0, 0, int(255 * alpha)))
    ang = e.get("angle", 0) + 3 * math.sin(lt * 9)
    lay = lay.rotate(ang, resample=Image.BICUBIC, expand=True)
    if anchor_xy is not None and "off" in e:
        cx, cy = anchor_xy[0] + e["off"][0], anchor_xy[1] + e["off"][1]
    else:
        cx, cy = e["pos"][0] * W, e["pos"][1] * H
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer.alpha_composite(lay, (int(cx - lay.width / 2), int(cy - lay.height / 2)))
    return composite(img, layer)


def draw_seismo(img, t, e):
    """A seismograph box (white, red trace scrolling, going wild)."""
    H, W = img.shape[:2]
    x0, y0, w, h = int(e.get("x", 0.56) * W), int(e.get("y", 0.2) * H), int(0.38 * W), int(0.12 * H)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((x0, y0, x0 + w, y0 + h), 18, fill=(250, 250, 246, 240), outline=(30, 30, 40, 255), width=4)
    for gy in range(1, 4):
        d.line((x0 + 10, y0 + gy * h / 4, x0 + w - 10, y0 + gy * h / 4), fill=(200, 210, 220, 255), width=2)
    pts = []
    for i in range(0, w - 20, 4):
        tt_ = t * 2.2 - (w - 20 - i) / (w - 20) * 1.2
        amp = min(1.0, max(0.05, tt_ * 1.3)) * (0.45 * h)
        y = y0 + h / 2 + amp * (math.sin(i * 0.31 + t * 40) * 0.6 + math.sin(i * 0.17 - t * 23) * 0.4) * (0.5 + 0.5 * math.sin(i * 0.05 + t * 3))
        pts.append((x0 + 10 + i, y))
    d.line(pts, fill=(220, 30, 40, 255), width=4)
    fl = font(int(h * 0.2))
    d.text((x0 + 16, y0 + 8), "SEISMOGRAPH", font=fl, fill=(30, 30, 40, 255))
    return composite(img, layer)
