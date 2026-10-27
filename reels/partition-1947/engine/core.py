"""Drawing engine for the reel: satellite map camera, country fills,
pins, labels, flags, badges, 3D titles, captions and watermark.

Everything is drawn with skia on a 1080x1920 canvas.
"""
import json
import math
import os
import pickle

import cv2
import numpy as np
import skia

W, H = 1080, 1920

HERE = os.path.dirname(os.path.abspath(__file__))

COL = {
    'india': (236, 120, 28),     # bold saffron-orange
    'pakistan': (30, 140, 66),   # bold green
    'gold': (222, 166, 28),      # undivided land
    'kashmir': (150, 154, 160),  # neutral grey: not decided in 1947
    'bangladesh': (0, 116, 78),
    'red': (204, 24, 30),
    'tag': (163, 22, 28),
    'white': (255, 255, 255),
    'line': (230, 30, 36),
}


def merc_y(lat):
    return math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))


def rgba(c, a=1.0):
    return skia.Color(int(c[0]), int(c[1]), int(c[2]), int(round(255 * max(0.0, min(1.0, a)))))


# ---------------------------------------------------------------- camera

class Cam:
    """Map camera. (cx, cy) in Mercator degrees, s = screen px per degree,
    rot = rotation in radians (positive = counter-clockwise)."""

    def __init__(self, cx, cy, s, rot=0.0):
        self.cx, self.cy, self.s, self.rot = cx, cy, s, rot

    def A(self):
        c, sn = math.cos(self.rot), math.sin(self.rot)
        s = self.s
        return np.array([[s * c, s * sn], [s * sn, -s * c]])

    def t(self):
        return np.array([W / 2, H / 2]) - self.A() @ np.array([self.cx, self.cy])

    def to_screen(self, X, Y):
        p = self.A() @ np.array([X, Y]) + self.t()
        return float(p[0]), float(p[1])

    def lonlat(self, lon, lat):
        return self.to_screen(lon, merc_y(lat))

    def skmatrix(self):
        A, t = self.A(), self.t()
        return skia.Matrix.MakeAll(A[0, 0], A[0, 1], t[0], A[1, 0], A[1, 1], t[1], 0, 0, 1)

    def interp(self, o, f):
        return Cam(self.cx + (o.cx - self.cx) * f, self.cy + (o.cy - self.cy) * f,
                   math.exp(math.log(self.s) + (math.log(o.s) - math.log(self.s)) * f),
                   self.rot + (o.rot - self.rot) * f)


# --------------------------------------------------------------- basemap

class BaseMap:
    def __init__(self, base_dir):
        meta = json.load(open(os.path.join(base_dir, 'basemap.json')))
        self.layers = {}
        for name in ('wide', 'detail'):
            img = cv2.imread(os.path.join(base_dir, name + '.png'), cv2.IMREAD_COLOR)
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            pyr = [img]
            while min(pyr[-1].shape[:2]) > 800:
                pyr.append(cv2.pyrDown(pyr[-1]))
            m = meta[name]
            self.layers[name] = (m, pyr)

    def _footprint(self, cam):
        A, t = cam.A(), cam.t()
        Ai = np.linalg.inv(A)
        pts = [Ai @ (np.array(p) - t) for p in ((0, 0), (W, 0), (0, H), (W, H))]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        return min(xs), max(xs), min(ys), max(ys)

    def render(self, cam):
        x0, x1, y0, y1 = self._footprint(cam)
        m, pyr = self.layers['detail']
        dx1 = m['x0'] + m['w'] / m['ppd']
        dy0 = m['y_top'] - m['h'] / m['ppd']
        name = 'detail'
        if not (x0 >= m['x0'] and x1 <= dx1 and y1 <= m['y_top'] and y0 >= dy0) or cam.s < 40:
            name = 'wide'
        m, pyr = self.layers[name]
        # Coarsest pyramid level that still has at least ~0.9 source px per screen px.
        k = 0
        while k + 1 < len(pyr) and m['ppd'] / 2 ** (k + 1) >= cam.s * 0.9:
            k += 1
        ppd = m['ppd'] / 2 ** k
        img = pyr[k]
        A, t = cam.A(), cam.t()
        D = np.diag([1 / ppd, -1 / ppd])
        X0 = np.array([m['x0'] + 0.5 / ppd, m['y_top'] - 0.5 / ppd])
        M = np.hstack([A @ D, (A @ X0 + t - 0.5)[:, None]])
        return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


# ------------------------------------------------------------------ geo

class Geo:
    def __init__(self, pkl):
        d = pickle.load(open(pkl, 'rb'))
        self.anchors = d['anchors']
        self.cities = d['cities']
        self.lines = d['lines']
        self.paths = {}
        for k, polys in d['shapes'].items():
            p = skia.Path()
            p.setFillType(skia.PathFillType.kEvenOdd)
            for rings in polys:
                for r in rings:
                    p.moveTo(*r[0])
                    for x, y in r[1:]:
                        p.lineTo(x, y)
                    p.close()
            self.paths[k] = p

    def screen_path(self, key, cam):
        p = skia.Path(self.paths[key])
        p.transform(cam.skmatrix())
        return p

    def line_path(self, key, cam, frac=1.0):
        """Screen path of a border line, drawn north->south up to `frac`."""
        parts = self.lines[key]
        total = sum(np.sum(np.hypot(*np.diff(a, axis=0).T)) for a in parts)
        budget = total * max(0.0, min(1.0, frac))
        A, t = cam.A(), cam.t()
        p = skia.Path()
        tip = None
        for a in parts:
            if budget <= 0:
                break
            seg = np.hypot(*np.diff(a, axis=0).T)
            cum = np.concatenate([[0], np.cumsum(seg)])
            n = np.searchsorted(cum, budget)
            pts = a[:min(n, len(a))]
            if n < len(a):
                f = (budget - cum[n - 1]) / max(seg[n - 1], 1e-9)
                pts = np.vstack([pts, a[n - 1] + f * (a[n] - a[n - 1])])
            sp = (A @ pts.T).T + t
            p.moveTo(*sp[0])
            for x, y in sp[1:]:
                p.lineTo(x, y)
            tip = tuple(sp[-1])
            budget -= cum[-1]
        return p, tip


# --------------------------------------------------------------- assets

FONT_DIR = None
_tf = {}


def font(weight, size):
    if weight not in _tf:
        _tf[weight] = skia.Typeface.MakeFromFile(os.path.join(FONT_DIR, 'Montserrat-%s.ttf' % weight))
    f = skia.Font(_tf[weight], size)
    f.setEdging(skia.Font.Edging.kAntiAlias)
    f.setSubpixel(True)
    return f


_stripes = None


def stripe_shader():
    global _stripes
    if _stripes is None:
        n = 18
        a = np.zeros((n, n, 4), np.uint8)
        for i in range(n):
            for w in range(3):
                a[i, (i + w) % n] = (255, 255, 255, 255)
        _stripes = skia.Image.fromarray(a, colorType=skia.kRGBA_8888_ColorType)
    return _stripes.makeShader(skia.TileMode.kRepeat, skia.TileMode.kRepeat,
                               skia.SamplingOptions(skia.FilterMode.kLinear))


def blur(sigma):
    return skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, max(0.01, sigma))


# ---------------------------------------------------------- primitives

_bg_img = None  # current frame's satellite image, set by new_canvas()


def fill_region(c, path, color, alpha=1.0, flash=0.0, glow=1.0, stripes=0.10, relief=0.6):
    """Country fill in the reference style: bold colour with the terrain
    relief showing through, faint diagonal texture, white edge with a soft
    glow. `flash` 0..1 mixes toward white."""
    if alpha <= 0:
        return
    col = [color[i] + (255 - color[i]) * flash for i in range(3)]
    p = skia.Paint(AntiAlias=True, Color=rgba(col, 0.9 * alpha))
    c.drawPath(path, p)
    if relief > 0 and _bg_img is not None:
        c.save()
        c.clipPath(path, doAntiAlias=True)
        rp = skia.Paint()
        rp.setBlendMode(skia.BlendMode.kSoftLight)
        rp.setAlphaf(max(0.0, min(1.0, relief * alpha * (1 - flash))))
        c.drawImage(_bg_img, 0, 0, skia.SamplingOptions(), rp)
        c.restore()
    if stripes > 0:
        c.save()
        c.clipPath(path, doAntiAlias=True)
        sp = skia.Paint(AntiAlias=True, Shader=stripe_shader(), Alpha=int(255 * stripes * alpha))
        sp.setBlendMode(skia.BlendMode.kOverlay)
        c.drawPaint(sp)
        c.restore()
    if glow > 0:
        g = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=10,
                       Color=rgba((255, 255, 255), 0.45 * glow * alpha), MaskFilter=blur(7))
        c.drawPath(path, g)
        e = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=2.6,
                       Color=rgba((255, 255, 255), 0.92 * glow * alpha))
        e.setStrokeJoin(skia.Paint.kRound_Join)
        c.drawPath(path, e)


def draw_line(c, path, color=COL['line'], width=7, alpha=1.0, dash=None):
    g = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=width * 3.2,
                   Color=rgba((255, 255, 255), 0.55 * alpha), MaskFilter=blur(width * 1.1))
    g.setStrokeCap(skia.Paint.kRound_Cap)
    c.drawPath(path, g)
    casing = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=width + 5,
                        Color=rgba((255, 255, 255), 0.95 * alpha))
    casing.setStrokeCap(skia.Paint.kRound_Cap)
    casing.setStrokeJoin(skia.Paint.kRound_Join)
    c.drawPath(path, casing)
    p = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=width,
                   Color=rgba(color, alpha))
    p.setStrokeCap(skia.Paint.kRound_Cap)
    p.setStrokeJoin(skia.Paint.kRound_Join)
    if dash:
        p.setPathEffect(skia.DashPathEffect.Make(dash, 0))
    c.drawPath(path, p)


def text_width(f, s):
    return f.measureText(s)


def shadow_text(c, s, x, y, f, color=(255, 255, 255), alpha=1.0, shadow=0.7, sigma=5, dy=4,
                align='center', outline=0):
    w = f.measureText(s)
    if align == 'center':
        x -= w / 2
    elif align == 'right':
        x -= w
    blob = skia.TextBlob.MakeFromString(s, f)
    if shadow > 0:
        c.drawTextBlob(blob, x, y + dy, skia.Paint(AntiAlias=True, Color=rgba((0, 0, 0), shadow * alpha),
                                                   MaskFilter=blur(sigma)))
    if outline > 0:
        o = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=outline,
                       Color=rgba((20, 20, 20), 0.85 * alpha))
        o.setStrokeJoin(skia.Paint.kRound_Join)
        c.drawTextBlob(blob, x, y, o)
    c.drawTextBlob(blob, x, y, skia.Paint(AntiAlias=True, Color=rgba(color, alpha)))
    return w


def map_pin(c, x, y, scale=1.0, alpha=1.0):
    """Red teardrop pin whose tip sits at (x, y)."""
    R = 34 * scale
    h = 92 * scale
    c.drawOval(skia.Rect(x - R * 0.8, y - R * 0.22, x + R * 0.8, y + R * 0.22),
               skia.Paint(AntiAlias=True, Color=rgba((0, 0, 0), 0.45 * alpha), MaskFilter=blur(5 * scale)))
    head = skia.Path()
    head.addCircle(x, y - h + R, R)
    tip = skia.Path()
    ang = math.asin(min(0.99, R / (h - R)))
    cy = y - h + R
    tip.moveTo(x, y)
    tip.lineTo(x - R * math.cos(ang), cy + R * math.sin(ang))
    tip.lineTo(x + R * math.cos(ang), cy + R * math.sin(ang))
    tip.close()
    pin = skia.Op(head, tip, skia.PathOp.kUnion_PathOp)
    sh = skia.Paint(AntiAlias=True, Color=rgba((0, 0, 0), 0.35 * alpha), MaskFilter=blur(6 * scale))
    c.save()
    c.translate(4 * scale, 5 * scale)
    c.drawPath(pin, sh)
    c.restore()
    grad = skia.GradientShader.MakeLinear([(x - R, cy - R), (x + R, y)],
                                          [rgba((240, 50, 50), alpha), rgba((170, 10, 18), alpha)])
    c.drawPath(pin, skia.Paint(AntiAlias=True, Shader=grad))
    c.drawCircle(x, cy, R * 0.55, skia.Paint(AntiAlias=True, Color=rgba((255, 255, 255), alpha)))
    c.drawCircle(x, cy, R * 0.40, skia.Paint(AntiAlias=True, Color=rgba((190, 190, 196), alpha)))


def tag_label(c, s, x, y, size=46, alpha=1.0, bg=COL['tag']):
    """Red box with a white border, white bold text (reference style)."""
    f = font('ExtraBold', size)
    w = f.measureText(s)
    padx, pady = size * 0.45, size * 0.32
    r = skia.Rect(x - w / 2 - padx, y - size * 0.5 - pady, x + w / 2 + padx, y + size * 0.5 + pady)
    c.drawRect(r.makeOffset(5, 7), skia.Paint(AntiAlias=True, Color=rgba((0, 0, 0), 0.45 * alpha),
                                              MaskFilter=blur(7)))
    c.drawRect(r, skia.Paint(AntiAlias=True, Color=rgba(bg, alpha)))
    c.drawRect(r, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=4,
                             Color=rgba((255, 255, 255), alpha)))
    shadow_text(c, s, x, y + size * 0.36, f, alpha=alpha, shadow=0.35, sigma=2, dy=2)


# ----------------------------------------------------------------- flags

def flag_india(c, r):
    x, y, w, h = r.left(), r.top(), r.width(), r.height()
    for i, col in enumerate([(255, 153, 51), (255, 255, 255), (19, 136, 8)]):
        c.drawRect(skia.Rect(x, y + h * i / 3, x + w, y + h * (i + 1) / 3), skia.Paint(AntiAlias=True, Color=rgba(col)))
    cx, cy, R = x + w / 2, y + h / 2, h / 6 * 0.92
    navy = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=max(1, R * 0.12), Color=rgba((0, 0, 128)))
    c.drawCircle(cx, cy, R, navy)
    sp = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=max(0.6, R * 0.05), Color=rgba((0, 0, 128)))
    for k in range(24):
        a = 2 * math.pi * k / 24
        c.drawLine(cx, cy, cx + R * math.cos(a), cy + R * math.sin(a), sp)
    c.drawCircle(cx, cy, R * 0.18, skia.Paint(AntiAlias=True, Color=rgba((0, 0, 128))))


def flag_pakistan(c, r):
    x, y, w, h = r.left(), r.top(), r.width(), r.height()
    c.drawRect(r, skia.Paint(AntiAlias=True, Color=rgba((1, 65, 28))))
    c.drawRect(skia.Rect(x, y, x + w * 0.25, y + h), skia.Paint(AntiAlias=True, Color=rgba((255, 255, 255))))
    gx, gy = x + w * 0.625, y + h * 0.5
    white = skia.Paint(AntiAlias=True, Color=rgba((255, 255, 255)))
    green = skia.Paint(AntiAlias=True, Color=rgba((1, 65, 28)))
    c.drawCircle(gx, gy, h * 0.30, white)
    # The cut-out circle sits up and to the right of the white one (the crescent opens toward the fly).
    ax, ay = gx + h * 0.0735, gy - h * 0.0595
    c.drawCircle(ax, ay, h * 0.275, green)
    # Five-pointed star, pointing up-right.
    sx, sy = gx + h * 0.115, gy - h * 0.095
    R1, R2 = h * 0.1, h * 0.04
    ang0 = math.radians(-40)
    star = skia.Path()
    for k in range(10):
        a = ang0 + math.pi * k / 5
        rr = R1 if k % 2 == 0 else R2
        px, py = sx + rr * math.cos(a), sy + rr * math.sin(a)
        (star.moveTo if k == 0 else star.lineTo)(px, py)
    star.close()
    c.drawPath(star, white)


def flag_uk(c, r):
    x, y, w, h = r.left(), r.top(), r.width(), r.height()
    blue, red, white = (1, 33, 105), (200, 16, 46), (255, 255, 255)
    c.save()
    c.clipRect(r, doAntiAlias=True)
    c.drawRect(r, skia.Paint(AntiAlias=True, Color=rgba(blue)))
    wp = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=h * 0.2, Color=rgba(white))
    c.drawLine(x, y, x + w, y + h, wp)
    c.drawLine(x + w, y, x, y + h, wp)
    rp = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=h * 0.067, Color=rgba(red))
    c.drawLine(x, y, x + w, y + h, rp)
    c.drawLine(x + w, y, x, y + h, rp)
    c.drawRect(skia.Rect(x + w / 2 - h * 0.167, y, x + w / 2 + h * 0.167, y + h), skia.Paint(AntiAlias=True, Color=rgba(white)))
    c.drawRect(skia.Rect(x, y + h / 2 - h * 0.167, x + w, y + h / 2 + h * 0.167), skia.Paint(AntiAlias=True, Color=rgba(white)))
    c.drawRect(skia.Rect(x + w / 2 - h * 0.1, y, x + w / 2 + h * 0.1, y + h), skia.Paint(AntiAlias=True, Color=rgba(red)))
    c.drawRect(skia.Rect(x, y + h / 2 - h * 0.1, x + w, y + h / 2 + h * 0.1), skia.Paint(AntiAlias=True, Color=rgba(red)))
    c.restore()


def flag_bangladesh(c, r):
    x, y, w, h = r.left(), r.top(), r.width(), r.height()
    c.drawRect(r, skia.Paint(AntiAlias=True, Color=rgba((0, 106, 78))))
    c.drawCircle(x + w * 0.45, y + h / 2, h * 0.4, skia.Paint(AntiAlias=True, Color=rgba((244, 42, 65))))


FLAGS = {'india': flag_india, 'pakistan': flag_pakistan, 'uk': flag_uk, 'bangladesh': flag_bangladesh}


def flag_badge(c, kind, x, y, R, alpha=1.0, scale=1.0):
    """Round flag badge with white rim and drop shadow (pops in via scale)."""
    if scale <= 0.01 or alpha <= 0:
        return
    R *= scale
    c.drawCircle(x + R * 0.08, y + R * 0.14, R * 1.06, skia.Paint(AntiAlias=True, Color=rgba((0, 0, 0), 0.45 * alpha),
                                                               MaskFilter=blur(R * 0.12)))
    c.saveLayerAlpha(None, int(255 * alpha))
    c.drawCircle(x, y, R * 1.08, skia.Paint(AntiAlias=True, Color=rgba((255, 255, 255))))
    c.save()
    clip = skia.Path()
    clip.addCircle(x, y, R)
    c.clipPath(clip, doAntiAlias=True)
    fw = R * 2 * 1.5
    FLAGS[kind](c, skia.Rect(x - fw / 2 + (R * 0.35 if kind == 'pakistan' else 0), y - R, x + fw / 2 + (R * 0.35 if kind == 'pakistan' else 0), y + R))
    shine = skia.GradientShader.MakeLinear([(x, y - R), (x, y + R)],
                                           [rgba((255, 255, 255), 0.28), rgba((255, 255, 255), 0.0), rgba((0, 0, 0), 0.18)],
                                           [0.0, 0.5, 1.0])
    c.drawCircle(x, y, R, skia.Paint(AntiAlias=True, Shader=shine))
    c.restore()
    c.drawCircle(x, y, R, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=max(1.5, R * 0.05),
                                     Color=rgba((210, 210, 215))))
    c.restore()


def flag_on_pole(c, kind, x, y, h=170, wave=0.0, alpha=1.0):
    """Flag on a pole planted at (x, y) (pole base)."""
    pole = skia.Paint(AntiAlias=True, Color=rgba((235, 235, 240), alpha))
    c.drawRect(skia.Rect(x - 4, y - h, x + 4, y), pole)
    c.drawCircle(x, y - h, 8, skia.Paint(AntiAlias=True, Color=rgba((215, 190, 90), alpha)))
    fw, fh = h * 0.78, h * 0.52
    surf = skia.Surface(int(fw) + 4, int(fh) + 4)
    sc = surf.getCanvas()
    sc.clear(skia.ColorTRANSPARENT)
    FLAGS[kind](sc, skia.Rect(2, 2, 2 + fw, 2 + fh))
    img = surf.makeImageSnapshot()
    # Wave: draw the flag in vertical slices offset by a sine.
    n = 24
    sw = fw / n
    c.save()
    for i in range(n):
        u = i / n
        off = math.sin(u * 5.5 - wave) * 7 * u
        shade = 1.0 - 0.18 * (0.5 + 0.5 * math.cos(u * 5.5 - wave)) * u
        src = skia.Rect(2 + i * sw, 2, 2 + (i + 1) * sw + 0.8, 2 + fh)
        dst = skia.Rect(x + 4 + i * sw, y - h + 4 + off, x + 4 + (i + 1) * sw + 0.8, y - h + 4 + fh + off)
        p = skia.Paint(AntiAlias=True)
        p.setAlphaf(alpha)
        p.setColorFilter(skia.ColorFilters.Matrix([shade, 0, 0, 0, 0, 0, shade, 0, 0, 0, 0, 0, shade, 0, 0, 0, 0, 0, 1, 0]))
        c.drawImageRect(img, src, dst, skia.SamplingOptions(skia.FilterMode.kLinear), p)
    c.restore()


# ------------------------------------------------------------ 3D titles

def title_3d(c, s, x, y, size, face=(255, 255, 255), side=(150, 150, 158), depth=14, alpha=1.0,
             weight='Black', align='center', skew=0.0, letter_t=None):
    """Extruded 3D text with a long soft shadow. letter_t: optional list of
    per-letter progress 0..1 for fly-in (scale/rotate/blur from above)."""
    f = font(weight, size)
    total = f.measureText(s)
    x0 = x - total / 2 if align == 'center' else x
    glyphs = f.textToGlyphs(s)
    widths = f.getWidths(glyphs)
    cursor = x0
    for i, ch in enumerate(s):
        w = widths[i]
        t = 1.0 if letter_t is None else max(0.0, min(1.0, letter_t[i]))
        if t <= 0 or ch == ' ':
            cursor += w
            continue
        e = 1 - (1 - t) ** 3
        dy = -(1 - e) * size * 1.6
        sc = 0.4 + 0.6 * e + 0.12 * math.sin(e * math.pi)
        rot = (1 - e) * -35
        a = alpha * min(1.0, t * 2.2)
        cx = cursor + w / 2
        c.save()
        c.translate(cx, y + dy)
        c.rotate(rot)
        c.scale(sc, sc)
        c.skew(skew, 0)
        blob = skia.TextBlob.MakeFromString(ch, f)
        lx = -w / 2
        c.drawTextBlob(blob, lx + depth * 0.9, depth * 1.6, skia.Paint(AntiAlias=True, Color=rgba((0, 0, 0), 0.5 * a),
                                                                      MaskFilter=blur(size * 0.07)))
        for k in range(depth, 0, -1):
            sh = 0.75 + 0.25 * (1 - k / depth)
            col = (side[0] * sh, side[1] * sh, side[2] * sh)
            c.drawTextBlob(blob, lx + k * 0.35, k * 0.75, skia.Paint(AntiAlias=True, Color=rgba(col, a)))
        c.drawTextBlob(blob, lx, 0, skia.Paint(AntiAlias=True, Color=rgba(face, a)))
        c.restore()
        cursor += w


# --------------------------------------------------- caption / watermark

def caption(c, s, alpha=1.0, y=None, size=52):
    f = font('ExtraBold', size)
    shadow_text(c, s, W / 2, (y or H * 0.775), f, alpha=alpha, shadow=0.85, sigma=6, dy=3, outline=0)


def watermark(c, s='@Bundy in Motion'):
    f = font('Bold', 40)
    shadow_text(c, s, 30, H - 42, f, alpha=0.78, shadow=0.6, sigma=4, dy=2, align='left')


def vignette(c, strength=0.35):
    g = skia.GradientShader.MakeRadial((W / 2, H * 0.45), H * 0.75,
                                       [rgba((0, 0, 0), 0), rgba((0, 0, 0), strength)], [0.55, 1.0])
    c.drawRect(skia.Rect(0, 0, W, H), skia.Paint(Shader=g))


def new_canvas(bg_rgb):
    global _bg_img
    surf = skia.Surface(W, H)
    c = surf.getCanvas()
    rgba_bg = np.dstack([bg_rgb, np.full(bg_rgb.shape[:2], 255, np.uint8)])
    _bg_img = skia.Image.fromarray(np.ascontiguousarray(rgba_bg), colorType=skia.kRGBA_8888_ColorType)
    c.drawImage(_bg_img, 0, 0)
    return surf, c


def snapshot(surf):
    return surf.makeImageSnapshot().toarray(colorType=skia.kRGBA_8888_ColorType)[..., :3]


# ================================================================ animation
# Animated primitives used by the timeline (story.py).

from anim import clamp, ease_out_back, ease_in, ease_out, ease_out_bounce, ease_in_back, pop, squash


def pop_label(c, s, x, y, size, T, t_in, t_out=None, weight='ExtraBold', color=(255, 255, 255),
              stagger=0.035, zoom=1.0):
    """Country name in bold white; letters pop in one by one and pop out one by one."""
    f = font(weight, size * zoom)
    glyphs = f.textToGlyphs(s)
    widths = f.getWidths(glyphs)
    total = sum(widths)
    cursor = x - total / 2
    n = len(s)
    for i, ch in enumerate(s):
        w = widths[i]
        ti = t_in + i * stagger
        sc = ease_out_back((T - ti) / 0.28, 2.2) if T >= ti else 0.0
        if t_out is not None:
            to = t_out + i * 0.028
            if T > to:
                sc *= 1 - ease_in((T - to) / 0.16)
        if sc > 0.01 and ch != ' ':
            cx = cursor + w / 2
            c.save()
            c.translate(cx, y)
            c.scale(sc, sc)
            blob = skia.TextBlob.MakeFromString(ch, f)
            c.drawTextBlob(blob, -w / 2, 4 * zoom, skia.Paint(AntiAlias=True, Color=rgba((0, 0, 0), 0.75),
                                                              MaskFilter=blur(6 * zoom)))
            o = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=5 * zoom,
                           Color=rgba((25, 25, 25), 0.55))
            o.setStrokeJoin(skia.Paint.kRound_Join)
            c.drawTextBlob(blob, -w / 2, 0, o)
            c.drawTextBlob(blob, -w / 2, 0, skia.Paint(AntiAlias=True, Color=rgba(color)))
            c.restore()
        cursor += w


def pin_drop(c, x, y, T, t_in, t_out=None, scale=1.0):
    if T < t_in:
        return
    u = (T - t_in) / 0.42
    dy = -(1 - ease_out_bounce(u)) * 220 * scale
    sc = scale
    if t_out is not None and T > t_out:
        sc *= 1 - ease_in_back((T - t_out) / 0.22, 1.6)
        if sc <= 0.01:
            return
    a = clamp(u * 4)
    map_pin(c, x, y + dy, sc, a)


def badge_pop(c, kind, x, y, R, T, t_in, t_out=None):
    sc = pop(T, t_in, t_out)
    if sc <= 0.01:
        return
    sx, sy = squash(T, t_in)
    c.save()
    c.translate(x, y)
    c.scale(sx, sy)
    flag_badge(c, kind, 0, 0, R, scale=sc)
    c.restore()


def tag_pop(c, s, x, y, T, t_in, t_out=None, size=46, bg=COL['tag'], split=0.0, rot=0.0):
    sc = pop(T, t_in, t_out)
    if sc <= 0.01:
        return
    sx, sy = squash(T, t_in)
    c.save()
    c.translate(x, y)
    c.rotate(rot)
    c.scale(sc * sx, sc * sy)
    if split <= 0:
        tag_label(c, s, 0, 0, size=size, bg=bg)
    else:
        for side in (-1, 1):
            c.save()
            c.clipRect(skia.Rect(-2000 if side < 0 else 0, -500, 0 if side < 0 else 2000, 500))
            c.translate(side * split * 42, side * split * 6)
            c.rotate(side * split * 8)
            tag_label(c, s, 0, 0, size=size, bg=bg)
            c.restore()
    c.restore()


def pole_flag_anim(c, kind, x, y, T, t_in, t_out=None, h=190):
    """Flag on a pole that slams into the map, waves, and flies away."""
    if T < t_in:
        return
    u = (T - t_in) / 0.26
    dy = -(1 - ease_in(u)) * 520 if u < 1 else 0.0
    a = clamp(u * 3)
    sq = 1.0
    if 1 <= u < 2.6:
        sq = 1 - 0.12 * math.exp(-3 * (u - 1)) * math.cos((u - 1) * 7)
    rot = 0.0
    if t_out is not None and T > t_out:
        v = (T - t_out) / 0.45
        if v >= 1:
            return
        dy = -ease_in(v) * 900
        rot = ease_in(v) * 35
        a *= 1 - clamp(v * 1.2 - 0.2)
    c.save()
    c.translate(x, y + dy)
    c.rotate(rot)
    c.scale(1.0, sq)
    flag_on_pole(c, kind, 0, 0, h=h, wave=T * 6.0, alpha=a)
    c.restore()


def calendar(c, x, y, w, month, day, year, alpha=1.0, flip=0.0, rot=-5.0):
    """Tear-off calendar page (reference style). flip 0..1 squashes the page
    vertically for a page-turn."""
    h = w * 1.12
    c.save()
    c.translate(x, y)
    c.rotate(rot)
    c.scale(1.0, max(0.02, 1 - flip))
    r = skia.RRect.MakeRectXY(skia.Rect(-w / 2, -h / 2, w / 2, h / 2), w * 0.07, w * 0.07)
    c.drawRRect(r.makeOffset(w * 0.04, w * 0.06) if hasattr(r, 'makeOffset') else r,
                skia.Paint(AntiAlias=True, Color=rgba((0, 0, 0), 0.4 * alpha), MaskFilter=blur(w * 0.05)))
    c.drawRRect(r, skia.Paint(AntiAlias=True, Color=rgba((250, 250, 248), alpha)))
    c.save()
    c.clipRRect(r, doAntiAlias=True)
    c.drawRect(skia.Rect(-w / 2, -h / 2, w / 2, -h / 2 + h * 0.27), skia.Paint(AntiAlias=True, Color=rgba((214, 32, 38), alpha)))
    c.restore()
    shadow_text(c, month, 0, -h / 2 + h * 0.2, font('Black', w * 0.17), alpha=alpha, shadow=0.25, sigma=2, dy=2)
    f = font('Black', w * 0.46)
    shadow_text(c, day, 0, h * 0.2, f, color=(214, 32, 38), alpha=alpha, shadow=0.0)
    shadow_text(c, year, 0, h * 0.41, font('ExtraBold', w * 0.13), color=(60, 60, 66), alpha=alpha, shadow=0.0)
    for sx in (-0.27, 0.27):
        c.drawRRect(skia.RRect.MakeRectXY(skia.Rect(sx * w - w * 0.035, -h / 2 - w * 0.09, sx * w + w * 0.035, -h / 2 + w * 0.07),
                                          w * 0.035, w * 0.035), skia.Paint(AntiAlias=True, Color=rgba((25, 25, 28), alpha)))
    c.restore()


def bubble(c, x, y, text, size=40, kind='speech', tail=(0, 1), alpha=1.0, scale=1.0):
    """White speech/thought bubble with a bold word, centred at (x, y)."""
    if scale <= 0.01:
        return
    f = font('Black', size)
    lines = text.split('\n')
    tw = max(f.measureText(l) for l in lines)
    w, h = tw + size * 1.4, size * (1.05 * len(lines) + 0.9)
    c.save()
    c.translate(x, y)
    c.scale(scale, scale)
    outline = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=5, Color=rgba((30, 30, 34), alpha))
    fill = skia.Paint(AntiAlias=True, Color=rgba((255, 255, 255), alpha))
    sh = skia.Paint(AntiAlias=True, Color=rgba((0, 0, 0), 0.35 * alpha), MaskFilter=blur(8))
    oval = skia.Rect(-w / 2, -h / 2, w / 2, h / 2)
    tx, ty = tail
    if kind == 'thought':
        for k, rr in enumerate((size * 0.32, size * 0.22, size * 0.14)):
            px, py = tx * (w * 0.32 + k * size * 0.55), h / 2 + size * 0.35 + k * size * 0.5
            c.drawCircle(px + 4, py + 6, rr, sh)
            c.drawCircle(px, py, rr, fill)
            c.drawCircle(px, py, rr, outline)
    path = skia.Path()
    path.addOval(oval)
    if kind == 'speech':
        tri = skia.Path()
        bx = tx * w * 0.18
        tri.moveTo(bx - size * 0.35, h * 0.3)
        tri.lineTo(bx + tx * size * 1.2, h / 2 + size * 0.9)
        tri.lineTo(bx + size * 0.35, h * 0.3)
        tri.close()
        path = skia.Op(path, tri, skia.PathOp.kUnion_PathOp)
    c.save()
    c.translate(4, 6)
    c.drawPath(path, sh)
    c.restore()
    c.drawPath(path, fill)
    c.drawPath(path, outline)
    for i, l in enumerate(lines):
        yy = (i - (len(lines) - 1) / 2) * size * 1.05 + size * 0.36
        shadow_text(c, l, 0, yy, f, color=(30, 30, 34), alpha=alpha, shadow=0)
    c.restore()


def arrow(c, pts, frac=1.0, color=(255, 255, 255), width=12, alpha=1.0, head=34, outline=(30, 30, 34)):
    """Arrow along a polyline (screen points), drawn up to `frac`."""
    pts = np.asarray(pts, dtype=float)
    if len(pts) < 2 or frac <= 0:
        return
    seg = np.hypot(*np.diff(pts, axis=0).T)
    cum = np.concatenate([[0], np.cumsum(seg)])
    L = cum[-1] * clamp(frac)
    n = int(np.searchsorted(cum, L))
    n = max(1, min(n, len(pts) - 1))
    f = (L - cum[n - 1]) / max(seg[n - 1], 1e-9)
    end = pts[n - 1] + f * (pts[n] - pts[n - 1])
    body = np.vstack([pts[:n], end])
    d = body[-1] - body[-2] if len(body) > 1 else pts[1] - pts[0]
    d = d / (np.hypot(*d) + 1e-9)
    nrm = np.array([-d[1], d[0]])
    tip = body[-1] + d * head * 0.35
    base = body[-1] - d * head * 0.65
    p = skia.Path()
    p.moveTo(*body[0])
    for q in body[1:-1]:
        p.lineTo(*q)
    p.lineTo(*base)
    hp = skia.Path()
    hp.moveTo(*tip)
    hp.lineTo(*(base + nrm * head * 0.55))
    hp.lineTo(*(base - nrm * head * 0.55))
    hp.close()
    for wdt, col, a in ((width + 7, outline, 0.55), (width, color, 1.0)):
        st = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=wdt, Color=rgba(col, a * alpha))
        st.setStrokeCap(skia.Paint.kRound_Cap)
        st.setStrokeJoin(skia.Paint.kRound_Join)
        c.drawPath(p, st)
    c.drawPath(hp, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=7,
                              Color=rgba(outline, 0.55 * alpha), StrokeJoin=skia.Paint.kRound_Join))
    c.drawPath(hp, skia.Paint(AntiAlias=True, Color=rgba(color, alpha)))


def bezier(p0, p1, bend=0.25, n=40):
    p0, p1 = np.array(p0, float), np.array(p1, float)
    d = p1 - p0
    m = (p0 + p1) / 2 + np.array([-d[1], d[0]]) * bend
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * m + t ** 2 * p1


# ------------------------------------------------------------- 3D titles

_glyph_cache = {}


def _glyph_path(f, weight, size, ch):
    key = (weight, round(size, 1), ch)
    if key not in _glyph_cache:
        g = f.textToGlyphs(ch)
        p = f.getPath(g[0]) if len(g) else None
        _glyph_cache[key] = (p if p is not None else skia.Path(), f.getWidths(g)[0] if len(g) else 0)
    return _glyph_cache[key]


def title(c, lines, cx, y, size, T, t_in, t_out=None, depth=None, stagger=0.045, weight='Black',
          line_gap=0.95, from_side=False):
    """Big extruded 3D title. lines: [segments, ...] or [(segments, size), ...]
    where segments = [(text, face_rgb, side_rgb), ...]. Letters fly in one by
    one with spin and trails, hold, then fly out."""
    if T < t_in:
        return
    idx = 0
    yy = y
    for li, line in enumerate(lines):
        if isinstance(line, tuple):
            segs, lsize = line
        else:
            segs, lsize = line, size
        if li > 0:
            yy += lsize * line_gap
        f = font(weight, lsize)
        dep = depth or max(6, int(lsize * 0.085))
        chars = []
        for text, face, side in segs:
            for ch in text:
                chars.append((ch, face, side))
        widths = [_glyph_path(f, weight, lsize, ch)[1] for ch, _, _ in chars]
        x = cx - sum(widths) / 2
        for (ch, face, side), w in zip(chars, widths):
            ti = t_in + idx * stagger
            idx += 1
            if ch == ' ' or T < ti:
                x += w
                continue
            for trail, ta in ((0.034, 0.16), (0.017, 0.28), (0.0, 1.0)):
                tt = T - trail
                u = (tt - ti) / 0.42
                if u < 0:
                    continue
                e = ease_out(u)
                s = 0.25 + 0.75 * ease_out_back(u, 1.7)
                dx = (1 - e) * lsize * (1.8 if from_side else 0.0)
                dy = -(1 - e) * lsize * (0.0 if from_side else 1.5)
                rot = (1 - e) * (-50 if from_side else -38)
                a = clamp(u * 3.5) * ta
                if t_out is not None and tt > t_out + idx * 0.012:
                    v = (tt - t_out - idx * 0.012) / 0.32
                    if v >= 1:
                        continue
                    ev = ease_in(v)
                    dy -= ev * lsize * 1.6
                    dx += ev * lsize * 0.4
                    s *= 1 + ev * 0.6
                    rot += ev * 25
                    a *= 1 - v
                if a <= 0.01:
                    continue
                path, gw = _glyph_path(f, weight, lsize, ch)
                c.save()
                c.translate(x + w / 2 + dx, yy + dy)
                c.rotate(rot)
                c.scale(s, s)
                c.translate(-w / 2, 0)
                if trail == 0.0:
                    c.save()
                    c.translate(dep * 0.9, dep * 1.9)
                    c.drawPath(path, skia.Paint(AntiAlias=True, Color=rgba((0, 0, 0), 0.45 * a), MaskFilter=blur(lsize * 0.06)))
                    c.restore()
                    for k in range(dep, 0, -1):
                        sh = 0.72 + 0.28 * (1 - k / dep)
                        col = (side[0] * sh, side[1] * sh, side[2] * sh)
                        c.save()
                        c.translate(k * 0.32, k * 0.78)
                        c.drawPath(path, skia.Paint(AntiAlias=True, Color=rgba(col, a)))
                        c.restore()
                c.drawPath(path, skia.Paint(AntiAlias=True, Color=rgba(face, a)))
                if trail == 0.0:
                    hl = skia.GradientShader.MakeLinear([(0, -lsize * 0.75), (0, 0)],
                                                        [rgba((255, 255, 255), 0.22 * a), rgba((255, 255, 255), 0.0)])
                    c.drawPath(path, skia.Paint(AntiAlias=True, Shader=hl))
                c.restore()
            x += w


WHITE3D = ((255, 255, 255), (150, 152, 162))
RED3D = ((222, 32, 40), (120, 12, 18))
GOLD3D = ((246, 190, 40), (150, 100, 10))


# ---------------------------------------------------------------- sprites

class Sprites:
    """GPT-image stickers. Missing files draw a labelled placeholder."""

    def __init__(self, folder):
        self.folder = folder
        self.cache = {}

    def get(self, name):
        if name in self.cache:
            return self.cache[name]
        img = None
        path = os.path.join(self.folder, name) if self.folder else None
        if path and os.path.exists(path):
            a = cv2.imread(path, cv2.IMREAD_UNCHANGED)
            if a is not None:
                img = _prep_sprite(a)
        self.cache[name] = img
        return img


def _prep_sprite(a):
    if a.ndim == 2:
        a = cv2.cvtColor(a, cv2.COLOR_GRAY2BGRA)
    if a.shape[2] == 3:
        a = cv2.cvtColor(a, cv2.COLOR_BGR2BGRA)
    alpha = a[..., 3]
    if alpha.min() > 250:
        # Plain white background: flood-fill it away from the borders.
        bgr = a[..., :3]
        near_white = (bgr.min(axis=2) > 236).astype(np.uint8)
        h, w = near_white.shape
        mask = np.zeros((h + 2, w + 2), np.uint8)
        fill = near_white.copy()
        for (x, y) in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
            if fill[y, x]:
                cv2.floodFill(fill, mask, (x, y), 2)
        bgmask = (fill == 2).astype(np.float32)
        bgmask = cv2.GaussianBlur(bgmask, (0, 0), 1.0)
        a[..., 3] = (255 * (1 - bgmask)).clip(0, 255).astype(np.uint8)
    ys, xs = np.where(a[..., 3] > 8)
    if len(xs):
        a = a[max(0, ys.min() - 4):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5]
    rgba_ = cv2.cvtColor(a, cv2.COLOR_BGRA2RGBA)
    return skia.Image.fromarray(np.ascontiguousarray(rgba_), colorType=skia.kRGBA_8888_ColorType,
                                alphaType=skia.kUnpremul_AlphaType)


def sprite(c, bank, name, x, y, height, scale=1.0, alpha=1.0, flip=False, rot=0.0, anchor='bottom', shadow=True):
    """Draw a sticker with its bottom-centre (or centre) at (x, y)."""
    if scale <= 0.01 or alpha <= 0.01:
        return
    img = bank.get(name) if bank else None
    h = height
    w = h * (img.width() / img.height() if img is not None else 0.75)
    c.save()
    c.translate(x, y)
    c.rotate(rot)
    c.scale(scale * (-1 if flip else 1), scale)
    top = -h if anchor == 'bottom' else -h / 2
    r = skia.Rect(-w / 2, top, w / 2, top + h)
    if img is not None:
        if shadow:
            sp = skia.Paint(AntiAlias=True)
            sp.setImageFilter(skia.ImageFilters.DropShadowOnly(6, 10, 9, 9, rgba((0, 0, 0), 0.45 * alpha)))
            c.saveLayer(None, sp)
            c.drawImageRect(img, r, skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear))
            c.restore()
        p = skia.Paint(AntiAlias=True)
        p.setAlphaf(alpha)
        c.drawImageRect(img, r, skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear), p)
    else:
        rr = skia.RRect.MakeRectXY(r, w * 0.12, w * 0.12)
        c.drawRRect(rr, skia.Paint(AntiAlias=True, Color=rgba((235, 238, 242), 0.92 * alpha)))
        dash = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=5, Color=rgba((90, 96, 108), alpha))
        dash.setPathEffect(skia.DashPathEffect.Make([18, 12], 0))
        c.drawRRect(rr, dash)
        sil = skia.Paint(AntiAlias=True, Color=rgba((150, 156, 168), alpha))
        c.drawCircle(0, top + h * 0.3, w * 0.2, sil)
        c.drawRRect(skia.RRect.MakeRectXY(skia.Rect(-w * 0.28, top + h * 0.5, w * 0.28, top + h * 0.9), w * 0.12, w * 0.12), sil)
        if flip:
            c.scale(-1, 1)
        shadow_text(c, name, 0, top + h * 0.47, font('Bold', max(14, w * 0.075)), color=(60, 64, 74), alpha=alpha, shadow=0)
    c.restore()


# ----------------------------------------------------------------- clouds

def make_clouds(n=5, seed=7):
    rng = np.random.default_rng(seed)
    out = []
    for k in range(n):
        Wc, Hc = 900, 560
        acc = np.zeros((Hc, Wc), np.float32)
        amp = 1.0
        for octave in range(6):
            gw, gh = 4 * 2 ** octave, 3 * 2 ** octave
            g = rng.random((gh, gw)).astype(np.float32)
            acc += amp * cv2.resize(g, (Wc, Hc), interpolation=cv2.INTER_CUBIC)
            amp *= 0.5
        acc /= acc.max()
        yy, xx = np.mgrid[0:Hc, 0:Wc].astype(np.float32)
        r = ((xx - Wc / 2) / (Wc * 0.42)) ** 2 + ((yy - Hc / 2) / (Hc * 0.38)) ** 2
        blob = np.clip(1.15 - r, 0, 1)
        dens = np.clip((acc * blob - 0.28) * 3.2, 0, 1)
        dens = cv2.GaussianBlur(dens, (0, 0), 3)
        shade = 0.82 + 0.18 * np.clip(1 - yy / Hc * 1.1 + (acc - 0.5) * 0.6, 0, 1)
        img = np.zeros((Hc, Wc, 4), np.uint8)
        img[..., 0] = (shade * 248).clip(0, 255)
        img[..., 1] = (shade * 250).clip(0, 255)
        img[..., 2] = (shade * 255).clip(0, 255)
        img[..., 3] = (dens * 255).clip(0, 255)
        out.append(skia.Image.fromarray(img, colorType=skia.kRGBA_8888_ColorType, alphaType=skia.kUnpremul_AlphaType))
    return out


# --------------------------------------------------------------- effects

def cam_matrix3(cam):
    A, t = cam.A(), cam.t()
    return np.array([[A[0, 0], A[0, 1], t[0]], [A[1, 0], A[1, 1], t[1]], [0, 0, 1.0]])


def motion_blur(img, cams, max_samples=12):
    """Average the frame warped along the camera path (cams[0] = now,
    cams[-1] = start of the shutter)."""
    Mc = cam_matrix3(cams[0])
    corners = np.array([[0, 0, 1], [W, 0, 1], [0, H, 1], [W, H, 1], [W / 2, H / 2, 1]], float).T
    Mp = cam_matrix3(cams[-1])
    Hm = Mc @ np.linalg.inv(Mp)
    disp = np.max(np.hypot(*((Hm @ corners)[:2] - corners[:2])))
    if disp < 2.5:
        return img
    n = int(min(max_samples, max(3, disp / 4)))
    acc = img.astype(np.float32)
    for i in range(1, n):
        f = i / (n - 1)
        k = f * (len(cams) - 1)
        j = min(int(k), len(cams) - 2)
        cf = cams[j].interp(cams[j + 1], k - j)
        Hf = Mc @ np.linalg.inv(cam_matrix3(cf))
        acc += cv2.warpAffine(img, Hf[:2], (W, H), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
                              borderMode=cv2.BORDER_REFLECT)
    return (acc / n).astype(np.uint8)


def mood_grade(bg, amount, dark=0.45):
    """Desaturate and darken the satellite image for sad/tense moments."""
    if amount <= 0:
        return bg
    f = bg.astype(np.float32)
    lum = f @ np.array([0.3, 0.55, 0.15], np.float32)
    grey = np.repeat(lum[..., None], 3, axis=2) * (1 - dark)
    out = f * (1 - amount) + grey * amount
    return out.clip(0, 255).astype(np.uint8)


def draw_rgb(c, rgb):
    a = np.dstack([rgb, np.full(rgb.shape[:2], 255, np.uint8)])
    c.drawImage(skia.Image.fromarray(np.ascontiguousarray(a), colorType=skia.kRGBA_8888_ColorType), 0, 0)


def new_canvas_plain(rgb):
    surf = skia.Surface(W, H)
    c = surf.getCanvas()
    draw_rgb(c, rgb)
    return surf, c


# ------------------------------------------------------------ more pieces

FALLBACK = {'radcliffe_thinking.png': 'radcliffe_pen.png'}


def _sprite_get_with_fallback(self, name):
    img = Sprites._get_raw(self, name)
    if img is None and name in FALLBACK:
        img = Sprites._get_raw(self, FALLBACK[name])
    return img


Sprites._get_raw = Sprites.get
Sprites.get = _sprite_get_with_fallback


def calendar_anim(c, x, y, w, pages, T, t_in, t_out=None, rot=-5.0):
    """pages: [(t, month, day, year), ...]; flips to each page at its time."""
    sc = pop(T, t_in, t_out)
    if sc <= 0.01:
        return
    cur = pages[0]
    flip = 0.0
    for i, pg in enumerate(pages):
        if T >= pg[0]:
            cur = pg
        if i > 0 and abs(T - pg[0]) < 0.11:
            flip = 1 - abs(T - pg[0]) / 0.11
            if T < pg[0]:
                cur = pages[i - 1]
    c.save()
    c.translate(x, y)
    c.scale(sc, sc)
    calendar(c, 0, 0, w, cur[1], cur[2], cur[3], flip=flip, rot=rot)
    c.restore()


def dashed_double_arrow(c, p0, p1, frac=1.0, color=(255, 255, 255), width=8, alpha=1.0):
    p0, p1 = np.array(p0, float), np.array(p1, float)
    m = (p0 + p1) / 2
    for a, b in ((m, p0), (m, p1)):
        q = a + (b - a) * clamp(frac)
        d = (q - a)
        L = np.hypot(*d)
        if L < 4:
            continue
        d /= L
        nrm = np.array([-d[1], d[0]])
        path = skia.Path()
        path.moveTo(*a)
        path.lineTo(*(q - d * 26))
        for wdt, col, aa in ((width + 6, (30, 30, 34), 0.5), (width, color, 1.0)):
            st = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=wdt, Color=rgba(col, aa * alpha))
            st.setPathEffect(skia.DashPathEffect.Make([26, 16], 0))
            st.setStrokeCap(skia.Paint.kRound_Cap)
            c.drawPath(path, st)
        hp = skia.Path()
        hp.moveTo(*(q + d * 8))
        hp.lineTo(*(q - d * 30 + nrm * 20))
        hp.lineTo(*(q - d * 30 - nrm * 20))
        hp.close()
        c.drawPath(hp, skia.Paint(AntiAlias=True, Color=rgba(color, alpha)))


def confetti(c, x, y, T, t0, colors, n=40, seed=1, spread=260):
    u = T - t0
    if u < 0 or u > 2.2:
        return
    r = np.random.default_rng(seed)
    for i in range(n):
        ang = r.uniform(-math.pi, 0)
        sp = r.uniform(0.5, 1.0) * spread * 2.2
        vx, vy = math.cos(ang) * sp, math.sin(ang) * sp
        px = x + vx * u
        py = y + vy * u + 520 * u * u
        a = clamp(1.6 - u)
        col = colors[i % len(colors)]
        c.save()
        c.translate(px, py)
        c.rotate(r.uniform(0, 360) + u * r.uniform(200, 600))
        c.drawRect(skia.Rect(-7, -4, 7, 4), skia.Paint(AntiAlias=True, Color=rgba(col, a)))
        c.restore()


def embers(c, x, y, T, t0, t1, w=200, n=26, seed=2):
    if T < t0 or T > t1 + 1.0:
        return
    r = np.random.default_rng(seed)
    for i in range(n):
        period = r.uniform(0.8, 1.6)
        ph = (T - t0 + r.uniform(0, period)) % period / period
        if T > t1 and ph < (T - t1):
            continue
        px = x + r.uniform(-w / 2, w / 2) + math.sin(ph * 6 + i) * 14
        py = y - ph * r.uniform(160, 300)
        a = (1 - ph) * 0.9
        c.drawCircle(px, py, r.uniform(2.5, 5.5) * (1 - ph * 0.5),
                     skia.Paint(AntiAlias=True, Color=rgba((255, 170 + int(60 * (1 - ph)), 60), a), MaskFilter=blur(1.5)))


def stamp_x(c, x, y, T, t0, size=160):
    """Big red cross that slams down onto something."""
    if T < t0:
        return
    u = (T - t0) / 0.22
    sc = 2.4 - 1.4 * ease_in(min(u, 1.0))
    if u > 1:
        sc = 1 + 0.08 * math.exp(-4 * (u - 1)) * math.cos((u - 1) * 9)
    a = clamp(u * 3)
    c.save()
    c.translate(x, y)
    c.rotate(-8)
    c.scale(sc, sc)
    for wdt, col, aa in ((size * 0.30, (255, 255, 255), 1.0), (size * 0.19, (214, 30, 36), 1.0)):
        p = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=wdt, Color=rgba(col, a * aa))
        p.setStrokeCap(skia.Paint.kRound_Cap)
        c.drawLine(-size / 2, -size / 2, size / 2, size / 2, p)
        c.drawLine(size / 2, -size / 2, -size / 2, size / 2, p)
    c.restore()


def sound_waves(c, x, y, T, t0, t1, color=(255, 255, 255)):
    if T < t0 or T > t1:
        return
    for k in range(3):
        ph = ((T - t0) * 1.6 + k / 3) % 1.0
        r = 40 + ph * 120
        a = (1 - ph) * clamp((t1 - T) * 3)
        p = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=9, Color=rgba(color, a))
        p.setStrokeCap(skia.Paint.kRound_Cap)
        c.drawArc(skia.Rect(x - r, y - r, x + r, y + r), -50, 100, False, p)
        c.drawArc(skia.Rect(x - r, y - r, x + r, y + r), 130, 100, False, p)


def dust(c, T, n=60, seed=9, alpha=0.5):
    """Slow drifting dust motes for sad/tense moments."""
    if alpha <= 0.01:
        return
    r = np.random.default_rng(seed)
    for i in range(n):
        x0, y0 = r.uniform(0, W), r.uniform(0, H)
        vx, vy = r.uniform(-12, 12), r.uniform(-30, -8)
        x = (x0 + vx * T) % W
        y = (y0 + vy * T) % H
        tw = 0.5 + 0.5 * math.sin(T * r.uniform(1, 3) + i)
        c.drawCircle(x, y, r.uniform(1.5, 4.0), skia.Paint(AntiAlias=True, Color=rgba((235, 235, 230), alpha * tw * 0.7),
                                                         MaskFilter=blur(1.2)))
