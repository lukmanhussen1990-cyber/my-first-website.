"""Supersampled text rasterisation with explicit tracking, for typeset overlays."""
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

def load_font(path, px, wght=None, ss=4):
    f = ImageFont.truetype(path, size=max(int(round(px * ss)), 1))
    if wght is not None:
        try:
            axes = f.get_variation_axes()
            vals = []
            for a in axes:
                nm = a.get('name', b'')
                nm = nm.decode() if isinstance(nm, bytes) else str(nm)
                vals.append(wght if nm.lower().startswith('weight') or a.get('tag') == 'wght' else a.get('default', a['minimum']))
            f.set_variation_by_axes(vals)
        except Exception as e:  # static font
            pass
    return f

def text_alpha(text, path, px, wght=None, tracking_em=0.0, ss=4, pad=None):
    """Return (alpha float32 0..1 at 1x, origin_x, baseline_y) where (origin_x, baseline_y)
    is the pen start / baseline in alpha pixel coordinates (sub-pixel exact)."""
    f = load_font(path, px, wght, ss)
    asc, desc = f.getmetrics()
    pad = pad or int(px * ss * 0.6)
    # advance widths with pair kerning from the layout engine
    xs = []; x = 0.0
    for j, ch in enumerate(text):
        xs.append(x)
        adv = f.getlength(ch)
        if j + 1 < len(text):
            kern = f.getlength(text[j:j + 2]) - f.getlength(text[j]) - f.getlength(text[j + 1])
        else:
            kern = 0.0
        x += adv + kern + tracking_em * px * ss
    W = int(x + 2 * pad); H = int(asc + desc + 2 * pad)
    img = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(img)
    for ch, cx in zip(text, xs):
        d.text((pad + cx, pad), ch, font=f, fill=255)
    a = np.asarray(img, np.float32) / 255.0
    # downsample by area to 1x; keep exact origin mapping
    a1 = cv2.resize(a, (W // ss, H // ss), interpolation=cv2.INTER_AREA) if ss > 1 else a
    ox = pad / ss; by = (pad + asc) / ss
    return a1, ox, by

def place(alpha, ox, by, x, y, shape=(1080, 1920)):
    """Translate an alpha raster so its (ox, by) lands at canvas (x, y) with sub-pixel accuracy."""
    M = np.float32([[1, 0, x - ox], [0, 1, y - by]])
    return cv2.warpAffine(alpha, M, (shape[1], shape[0]), flags=cv2.INTER_LINEAR, borderValue=0)

def place_scaled(alpha, ox, by, x, y, scale, shape=(1080, 1920)):
    M = np.float32([[scale, 0, x - ox * scale], [0, scale, y - by * scale]])
    return cv2.warpAffine(alpha, M, (shape[1], shape[0]), flags=cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR, borderValue=0)

def logo_alpha(text, path, px, wght, cap_scale=1.0, cap_wght=None, tracking_em=0.0, ss=4):
    """Brand-logo setting: the initial capital at cap_scale x the body size (own weight), the rest
    at body size, all on one baseline. Returns (alpha, origin_x, baseline_y) like text_alpha."""
    cap, rest = text[0], text[1:]
    fc = load_font(path, px * cap_scale, cap_wght if cap_wght is not None else wght, ss)
    fb = load_font(path, px, wght, ss)
    asc = max(fc.getmetrics()[0], fb.getmetrics()[0]); desc = max(fc.getmetrics()[1], fb.getmetrics()[1])
    pad = int(px * ss * 0.6)
    xs = [0.0]; x = fc.getlength(cap) + tracking_em * px * ss
    for j, ch in enumerate(rest):
        xs.append(x)
        kern = (fb.getlength(rest[j:j + 2]) - fb.getlength(rest[j]) - fb.getlength(rest[j + 1])) if j + 1 < len(rest) else 0.0
        x += fb.getlength(ch) + kern + tracking_em * px * ss
    W = int(x + 2 * pad); H = int(asc + desc + 2 * pad)
    img = Image.new('L', (W, H), 0); d = ImageDraw.Draw(img)
    base = pad + asc
    d.text((pad + xs[0], base), cap, font=fc, fill=255, anchor='ls')
    for ch, cx in zip(rest, xs[1:]):
        d.text((pad + cx, base), ch, font=fb, fill=255, anchor='ls')
    a = np.asarray(img, np.float32) / 255.0
    a1 = cv2.resize(a, (W // ss, H // ss), interpolation=cv2.INTER_AREA) if ss > 1 else a
    return a1, pad / ss, base / ss
