"""Everything drawn on top of the picture: measuring line, labels, hook, subtitles, end card."""
import math

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT_DIR = "/usr/share/fonts/opentype/inter/"
F_XBOLD = FONT_DIR + "Inter-ExtraBold.otf"
F_BOLD = FONT_DIR + "Inter-Bold.otf"
F_SEMI = FONT_DIR + "Inter-SemiBold.otf"

WHITE = (255, 255, 255)
PEACH = (255, 188, 132)
PINKBLUE = (226, 178, 255)

_fonts = {}
_cache = {}


def font(path, size):
    key = (path, size)
    if key not in _fonts:
        try:
            _fonts[key] = ImageFont.truetype(path, size)
        except OSError:  # Inter missing -> fall back to DejaVu
            _fonts[key] = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
    return _fonts[key]


def _finish(alpha, color_img, shadow, pad):
    """alpha: HxW 0..1, color_img: HxWx3 0..1 -> premultiplied RGBA float32 with a soft shadow."""
    a = alpha.astype(np.float32)
    rgb = color_img.astype(np.float32) * a[..., None]
    if shadow:
        dx, dy, blur, strength = shadow
        sh = cv2.GaussianBlur(a, (0, 0), blur)
        M = np.float32([[1, 0, dx], [0, 1, dy]])
        sh = cv2.warpAffine(sh, M, (a.shape[1], a.shape[0]))
        sh = np.clip(sh * strength, 0, 1)
        out_a = a + sh * (1 - a)
        return np.dstack([rgb, out_a])
    return np.dstack([rgb, a])


def text_layer(text, path, size, fill=WHITE, stroke=0, stroke_fill=(0, 0, 0), shadow=(0, 4, 9, 0.85), tri=None):
    """Render one line of text to a premultiplied RGBA layer. tri='up'/'down' draws a small
    triangle marker before the text. Returns (layer, pad)."""
    key = (text, path, size, fill, stroke, stroke_fill, shadow, tri)
    if key in _cache:
        return _cache[key]
    f = font(path, size)
    pad = int(stroke + (shadow[2] * 3 + abs(shadow[1]) if shadow else 0) + 6)
    x0, y0, x1, y1 = f.getbbox(text, stroke_width=stroke)
    asc, desc = f.getmetrics()
    tw = int(size * 0.92) if tri else 0
    w = (x1 - x0) + tw + 2 * pad
    h = asc + desc + 2 * pad
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if tri:
        s = size * 0.50
        cx = pad + s * 0.62
        cy = pad + asc * 0.62
        if tri == "up":
            pts = [(cx - s / 2, cy + s * 0.42), (cx + s / 2, cy + s * 0.42), (cx, cy - s * 0.44)]
        else:
            pts = [(cx - s / 2, cy - s * 0.42), (cx + s / 2, cy - s * 0.42), (cx, cy + s * 0.44)]
        d.polygon(pts, fill=fill + (255,))
    d.text((pad + tw - x0, pad), text, font=f, fill=fill + (255,), stroke_width=stroke, stroke_fill=stroke_fill + (255,))
    arr = np.asarray(img).astype(np.float32) / 255.0
    layer = _finish(arr[..., 3], arr[..., :3], shadow, pad)
    _cache[key] = (layer, pad)
    return layer, pad


def blit(frame, layer, x, y, opacity=1.0):
    """Alpha-composite a premultiplied RGBA layer onto frame (float32 RGB 0..1) at integer x, y."""
    if opacity <= 0.003:
        return
    H, W = frame.shape[:2]
    h, w = layer.shape[:2]
    x = int(round(x))
    y = int(round(y))
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return
    L = layer[y0 - y : y1 - y, x0 - x : x1 - x]
    a = L[..., 3:4] * opacity
    frame[y0:y1, x0:x1] = frame[y0:y1, x0:x1] * (1 - a) + L[..., :3] * opacity


def put_text(frame, text, path, size, x, y, anchor="l", opacity=1.0, **kw):
    """x, y = left (or centre if anchor='c') and top of the text's line box."""
    layer, pad = text_layer(text, path, size, **kw)
    w = layer.shape[1] - 2 * pad
    if anchor == "c":
        x = x - w / 2
    elif anchor == "r":
        x = x - w
    blit(frame, layer, x - pad, y - pad, opacity)
    return w


def measure_line(frame, x, y0, y1, opacity=1.0, grow=1.0):
    """Thin white vertical line with small caps and a soft dark halo so it reads on any backdrop."""
    if opacity <= 0.003 or y1 - y0 < 4:
        return
    mid = 0.5 * (y0 + y1)
    half = 0.5 * (y1 - y0) * grow
    y0 = mid - half
    y1 = mid + half
    pad = 22
    h = int(math.ceil(y1 - y0)) + 2 * pad
    w = 2 * pad + 30
    ss = 3
    img = Image.new("L", (w * ss, h * ss), 0)
    d = ImageDraw.Draw(img)
    cx = w * ss / 2
    lw = 3.2 * ss
    cap = 13 * ss
    d.rectangle([cx - lw / 2, pad * ss, cx + lw / 2, (h - pad) * ss], fill=255)
    d.rectangle([cx - cap, pad * ss, cx + cap, pad * ss + lw], fill=255)
    d.rectangle([cx - cap, (h - pad) * ss - lw, cx + cap, (h - pad) * ss], fill=255)
    a = np.asarray(img.resize((w, h), Image.LANCZOS)).astype(np.float32) / 255.0
    layer = _finish(a, np.ones((h, w, 3), np.float32), (0, 2, 5, 0.75), pad)
    blit(frame, layer, x - w / 2, y0 - pad, opacity)


def heart_layer(size, color=(255, 72, 96)):
    key = ("heart", size, color)
    if key in _cache:
        return _cache[key]
    ss = 4
    pad = int(size * 0.5)
    n = (size + 2 * pad) * ss
    t = np.linspace(0, 2 * np.pi, 400)
    hx = 16 * np.sin(t) ** 3
    hy = -(13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t))
    sc = size * ss / 34.0
    pts = [(n / 2 + a * sc, n / 2 + b * sc - 1.5 * sc) for a, b in zip(hx, hy)]
    img = Image.new("L", (n, n), 0)
    ImageDraw.Draw(img).polygon(pts, fill=255)
    a = np.asarray(img.resize((n // ss, n // ss), Image.LANCZOS)).astype(np.float32) / 255.0
    yy, xx = np.mgrid[0 : a.shape[0], 0 : a.shape[1]].astype(np.float32)
    c = np.array(color, np.float32) / 255.0
    # a little shading: lighter top-left
    shade = 1.0 + 0.28 * np.clip(1.0 - np.hypot(xx - a.shape[1] * 0.40, yy - a.shape[0] * 0.38) / (size * 0.45), 0, 1)
    col = np.clip(c[None, None, :] * shade[..., None], 0, 1)
    glow = cv2.GaussianBlur(a, (0, 0), size * 0.16)
    layer = _finish(a, col, (0, 3, 7, 0.6), pad)
    # warm red glow behind
    g = np.clip(glow * 0.55, 0, 1) * (1 - layer[..., 3])
    layer[..., 0] += g * 1.0
    layer[..., 1] += g * 0.25
    layer[..., 2] += g * 0.32
    layer[..., 3] = np.clip(layer[..., 3] + g * 0.4, 0, 1)
    _cache[key] = (layer, pad)
    return layer, pad


def wrap_lines(text, path, size, max_w):
    """One line if it fits, otherwise two lines of similar width."""
    f = font(path, size)
    if f.getlength(text) <= max_w:
        return [text]
    words = text.split()
    best = None
    for k in range(1, len(words)):
        a_, b_ = " ".join(words[:k]), " ".join(words[k:])
        wa, wb = f.getlength(a_), f.getlength(b_)
        if max(wa, wb) > max_w:
            continue
        # prefer breaking after punctuation, then the most even split
        score = abs(wa - wb) - (140 if words[k - 1][-1] in ".,…!?" else 0)
        if best is None or score < best[0]:
            best = (score, [a_, b_])
    if best:
        return best[1]
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if f.getlength(trial) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    return lines + [cur]


def subtitle(frame, text, opacity=1.0, bottom=1556, size=54, max_w=880):
    """White text, black outline, bottom-centre, kept clear of Instagram's caption area."""
    lines = wrap_lines(text, F_BOLD, size, max_w)
    lh = int(size * 1.28)
    y = bottom - lh * len(lines)
    for ln in lines:
        put_text(frame, ln, F_BOLD, size, frame.shape[1] / 2, y, anchor="c", opacity=opacity,
                 stroke=6, stroke_fill=(0, 0, 0), shadow=(0, 3, 6, 0.7))
        y += lh
