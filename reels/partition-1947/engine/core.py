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
        k = 0
        while k + 1 < len(pyr) and cam.s / (m['ppd'] / 2 ** (k + 1)) >= 0.7:
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
