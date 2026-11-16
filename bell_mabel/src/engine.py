"""Core paper-cutout rendering engine (skia-python).

Everything is drawn as vector shapes at 1080x1920. Each "paper" shape gets a
fibre texture that moves with the object, a thin cream cut-edge outline and an
optional soft drop shadow, so stacked layers read like cut paper.
"""
import math
import os
import re
import functools

import numpy as np
import skia

W, H = 1080, 1920
FPS = 30
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, "assets")
CACHE = os.environ.get("BM_CACHE", os.path.join(ROOT, ".cache"))
os.makedirs(CACHE, exist_ok=True)

# --------------------------------------------------------------------------
# math / easing
# --------------------------------------------------------------------------

def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lerp(a, b, t):
    return a + (b - a) * t


def seg(t, t0, t1):
    if t1 == t0:
        return 1.0 if t >= t1 else 0.0
    return clamp((t - t0) / (t1 - t0))


def eio(t):
    """cubic ease-in-out"""
    t = clamp(t)
    return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def eout(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ein(t):
    t = clamp(t)
    return t * t * t


def eback(t, s=1.70158):
    t = clamp(t)
    return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2


def sm(t, t0, t1):
    return eio(seg(t, t0, t1))


def smo(t, t0, t1):
    return eout(seg(t, t0, t1))


def wave(t, period, phase=0.0):
    return math.sin(2 * math.pi * (t / period + phase))


def hash01(*args):
    """deterministic pseudo random in [0,1) from ints/floats"""
    h = 2166136261
    for a in args:
        v = int(a * 1000003) if isinstance(a, float) else int(a)
        h ^= (v & 0xFFFFFFFF)
        h = (h * 16777619) & 0xFFFFFFFF
        h ^= h >> 13
        h = (h * 1274126177) & 0xFFFFFFFF
    return (h & 0xFFFFFF) / float(0x1000000)


def noise1(t, seed=0):
    """smooth 1-D value noise in [-1,1]"""
    i = math.floor(t)
    f = t - i
    a = hash01(i, seed) * 2 - 1
    b = hash01(i + 1, seed) * 2 - 1
    u = f * f * (3 - 2 * f)
    return a + (b - a) * u


def blink_amount(t, seed=0, every=(2.0, 4.0), dur=0.13):
    """returns 0..1 eyelid closure. Blinks every 2-4 s (deterministic)."""
    # walk through a deterministic schedule of blink times
    k = 0
    tt = hash01(seed, 99) * 1.5
    while tt < t + dur and k < 200:
        if tt <= t < tt + dur:
            x = (t - tt) / dur
            return math.sin(math.pi * x)
        tt += every[0] + (every[1] - every[0]) * hash01(seed, k)
        k += 1
    return 0.0


# --------------------------------------------------------------------------
# colours
# --------------------------------------------------------------------------

def C(hexv, a=1.0):
    """hex int (0xRRGGBB) or '#RRGGBB' -> skia ARGB int"""
    if isinstance(hexv, str):
        hexv = int(hexv.lstrip('#'), 16)
    return (int(clamp(a) * 255) << 24) | (hexv & 0xFFFFFF)


def mix(c1, c2, t):
    """mix two 0xRRGGBB ints"""
    r = int(lerp((c1 >> 16) & 255, (c2 >> 16) & 255, t))
    g = int(lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t))
    b = int(lerp(c1 & 255, c2 & 255, t))
    return (r << 16) | (g << 8) | b


def shade(c, f):
    """darken (f<1) or lighten (f>1) an 0xRRGGBB colour"""
    if f >= 1:
        return mix(c, 0xFFFFFF, clamp(f - 1))
    return mix(0x000000, c, clamp(f))


PAL = dict(
    teal=0x3E7C86, teal_dk=0x2D5E68, teal_lt=0x5E9AA1,
    mustard=0xD9A23C, mustard_dk=0xB98426,
    brick=0xB4513A, brick_dk=0x8E3B2A, red=0xC0392B,
    cream=0xF4E8D0, cream_dk=0xE2D2B2, paper=0xF6EEDC,
    navy=0x263A63, navy_dk=0x1A2846, navy_lt=0x34507F,
    wood=0x8B5A33, wood_dk=0x6A4024, wood_lt=0xA87244, wood_xdk=0x4B2C18,
    skin=0xF3C9A4, skin_dk=0xE2AC85, cheek=0xEC8F7C,
    hair_dk=0x3A2A21, hair_md=0x5A4031, grey=0xB9B6AE, white=0xF7F3EA,
    lilac=0x9C8DC4, lilac_dk=0x7D6EA8, blue_dress=0x7FA3CF, blue_dress_dk=0x5F84B3,
    green=0x6E9B5A, green_dk=0x4E7A44, sky=0x9CC8D6, night=0x1E2A4A, night_dk=0x141C33,
    gold=0xD8B04A, brass=0xC9A043, ink=0x1F2A44, kred=0xC0392B,
)
OUTLINE = C(0xF8F2E4)

# --------------------------------------------------------------------------
# textures (generated once, cached)
# --------------------------------------------------------------------------

def _fft_noise(h, w, beta, rng, lo=0.0, hi=None):
    """tileable noise with 1/f^beta spectrum, normalised to [-1,1]"""
    wn = rng.standard_normal((h, w))
    F = np.fft.fft2(wn)
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    filt = 1.0 / (f ** beta)
    if hi is not None:
        filt *= np.exp(-(f / hi) ** 2)
    if lo:
        filt *= 1 - np.exp(-(f / lo) ** 2)
    filt[0, 0] = 0
    n = np.real(np.fft.ifft2(F * filt))
    n -= n.mean()
    n /= (np.abs(n).max() + 1e-9)
    return n


def _fibres(size, count, rng, length=(8, 40), width=(0.4, 1.2)):
    """draw random fibres into a float alpha map (tileable by wrapping)"""
    info = skia.ImageInfo.Make(size, size, skia.kRGBA_8888_ColorType, skia.kPremul_AlphaType)
    surf = skia.Surface.MakeRaster(info)
    c = surf.getCanvas()
    c.clear(0x00000000)
    for i in range(count):
        x, y = rng.random() * size, rng.random() * size
        ang = rng.random() * math.pi
        L = rng.uniform(*length)
        bend = rng.uniform(-0.4, 0.4)
        a = int(rng.uniform(60, 200))
        p = skia.Path()
        dx, dy = math.cos(ang) * L / 2, math.sin(ang) * L / 2
        mx, my = -dy * bend, dx * bend
        p.moveTo(x - dx, y - dy)
        p.quadTo(x + mx, y + my, x + dx, y + dy)
        paint = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style,
                           StrokeWidth=rng.uniform(*width), Color=(a << 24) | 0xFFFFFF)
        for ox in (-size, 0, size):
            for oy in (-size, 0, size):
                if (x + ox < -L or x + ox > size + L or y + oy < -L or y + oy > size + L):
                    continue
                c.save()
                c.translate(ox, oy)
                c.drawPath(p, paint)
                c.restore()
    arr = surf.toarray()[:, :, 3].astype(np.float32) / 255.0
    return arr


def _to_image(gray01, alpha=None):
    g = (np.clip(gray01, 0, 1) * 255).astype(np.uint8)
    a = np.full_like(g, 255) if alpha is None else (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    rgba = np.ascontiguousarray(np.dstack([g, g, g, a]))
    return skia.Image.fromarray(rgba, colorType=skia.kRGBA_8888_ColorType)


def _to_image_rgb(rgb01):
    rgb = (np.clip(rgb01, 0, 1) * 255).astype(np.uint8)
    a = np.full(rgb.shape[:2], 255, np.uint8)
    rgba = np.ascontiguousarray(np.dstack([rgb, a]))
    return skia.Image.fromarray(rgba, colorType=skia.kRGBA_8888_ColorType)


def _cached(name, fn):
    path = os.path.join(CACHE, name + ".npy")
    if os.path.exists(path):
        return np.load(path)
    arr = fn()
    np.save(path, arr)
    return arr


def _make_paper_tile():
    rng = np.random.default_rng(11)
    S = 512
    mott = _fft_noise(S, S, 1.6, rng, hi=0.08)
    mid = _fft_noise(S, S, 1.0, rng, lo=0.02, hi=0.25)
    fine = _fft_noise(S, S, 0.2, rng, lo=0.2)
    fib_l = _fibres(S, 900, rng)
    fib_d = _fibres(S, 500, rng, length=(5, 25))
    v = 0.95 + 0.05 * mott + 0.025 * mid + 0.025 * fine + 0.035 * fib_l - 0.05 * fib_d
    return np.clip(v, 0.80, 1.0).astype(np.float32)


def _make_grain_full():
    """soft-light overlay: embossed cold-press watercolour paper + fibres (0.5 = neutral)"""
    rng = np.random.default_rng(5)
    h, w = H, W
    bumps = _fft_noise(h, w, 0.6, rng, lo=0.045, hi=0.22)      # 4-20 px tooth
    mid = _fft_noise(h, w, 1.2, rng, lo=0.01, hi=0.06)         # gentle undulation
    fine = _fft_noise(h, w, 0.0, rng, lo=0.3)                  # pixel grit
    hgt = 1.0 * bumps + 0.8 * mid
    gy, gx = np.gradient(hgt)
    bump = (gx * -0.75 + gy * -0.65)
    bump /= (np.percentile(np.abs(bump), 99.5) + 1e-6)
    fib = _fibres(1024, 4000, rng, length=(6, 30), width=(0.5, 1.1))
    fib = np.tile(fib, (2, 2))[:h, :w]
    v = 0.5 + 0.13 * bump + 0.035 * fine + 0.045 * fib - 0.015 + 0.02 * mid
    return np.clip(v, 0, 1).astype(np.float32)


def _make_stain_full():
    """multiply overlay: soft watercolour blotches with darker rims"""
    rng = np.random.default_rng(23)
    h, w = H, W
    n1 = _fft_noise(h, w, 2.0, rng, hi=0.012)
    n2 = _fft_noise(h, w, 1.6, rng, hi=0.03)
    m = 0.6 * n1 + 0.4 * n2
    blot = np.clip((m - 0.05) * 3.0, 0, 1)
    rim = np.exp(-((m - 0.05) / 0.035) ** 2)
    v = 1.0 - 0.045 * blot - 0.04 * rim
    return np.clip(v, 0.8, 1).astype(np.float32)


class _Tex:
    _inst = None

    def __init__(self):
        self.paper = _to_image(_cached("paper_tile_v3", _make_paper_tile))
        self.grain = _to_image(_cached("grain_full_v3", _make_grain_full))
        self.stain = _to_image(_cached("stain_full_v2", _make_stain_full))
        self.samp = skia.SamplingOptions(skia.FilterMode.kLinear)
        # vignette image (multiply) – precomputed radial falloff
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        d = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H * 0.47) / (H * 0.60)) ** 2)
        vig = 1.0 - 0.55 * np.clip(d - 0.55, 0, 1) ** 1.6
        self.vignette = _to_image(np.clip(vig, 0, 1))
        self._shader_cache = {}

    @classmethod
    def get(cls):
        if cls._inst is None:
            cls._inst = _Tex()
        return cls._inst

    def paper_shader(self, ox=0.0, oy=0.0, scale=1.0, rot=0.0):
        key = (round(ox, 1), round(oy, 1), round(scale, 3), round(rot, 1))
        sh = self._shader_cache.get(key)
        if sh is None:
            m = skia.Matrix()
            m.setScale(scale, scale)
            m.postRotate(rot)
            m.postTranslate(ox, oy)
            sh = self.paper.makeShader(skia.TileMode.kRepeat, skia.TileMode.kRepeat, self.samp, m)
            if len(self._shader_cache) < 4096:
                self._shader_cache[key] = sh
        return sh


def TEX():
    return _Tex.get()


# --------------------------------------------------------------------------
# paths
# --------------------------------------------------------------------------

_num = r'-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?'
_tok = re.compile(r'[MmLlHhVvCcSsQqTtZz]|' + _num)


@functools.lru_cache(maxsize=4096)
def _svg_cached(d):
    return _svg_parse(d)


def svg(d):
    """mini SVG path parser (M L H V C S Q T Z, abs+rel). Returns skia.Path."""
    return _svg_cached(d)


def _svg_parse(d):
    toks = _tok.findall(d)
    p = skia.Path()
    i = 0
    cmd = None
    x = y = 0.0
    sx = sy = 0.0
    lcx = lcy = None  # last control point
    lcmd = None

    def num():
        nonlocal i
        v = float(toks[i])
        i += 1
        return v

    while i < len(toks):
        t = toks[i]
        if re.match(r'[A-Za-z]', t):
            cmd = t
            i += 1
            if cmd in 'Zz':
                p.close()
                x, y = sx, sy
                lcmd = cmd
                continue
        rel = cmd.islower()
        C_ = cmd.upper()
        ox, oy = (x, y) if rel else (0.0, 0.0)
        if C_ == 'M':
            x, y = ox + num(), oy + num()
            p.moveTo(x, y)
            sx, sy = x, y
            cmd = 'l' if rel else 'L'
        elif C_ == 'L':
            x, y = ox + num(), oy + num()
            p.lineTo(x, y)
        elif C_ == 'H':
            x = (x if rel else 0) + num()
            p.lineTo(x, y)
        elif C_ == 'V':
            y = (y if rel else 0) + num()
            p.lineTo(x, y)
        elif C_ == 'C':
            x1, y1 = ox + num(), oy + num()
            x2, y2 = ox + num(), oy + num()
            x, y = ox + num(), oy + num()
            p.cubicTo(x1, y1, x2, y2, x, y)
            lcx, lcy = x2, y2
        elif C_ == 'S':
            if lcmd and lcmd.upper() in 'CS':
                x1, y1 = 2 * x - lcx, 2 * y - lcy
            else:
                x1, y1 = x, y
            x2, y2 = ox + num(), oy + num()
            x, y = ox + num(), oy + num()
            p.cubicTo(x1, y1, x2, y2, x, y)
            lcx, lcy = x2, y2
        elif C_ == 'Q':
            x1, y1 = ox + num(), oy + num()
            x, y = ox + num(), oy + num()
            p.quadTo(x1, y1, x, y)
            lcx, lcy = x1, y1
        elif C_ == 'T':
            if lcmd and lcmd.upper() in 'QT':
                x1, y1 = 2 * x - lcx, 2 * y - lcy
            else:
                x1, y1 = x, y
            x, y = ox + num(), oy + num()
            p.quadTo(x1, y1, x, y)
            lcx, lcy = x1, y1
        else:
            raise ValueError("bad svg cmd " + cmd)
        lcmd = cmd
    return p


def rect(x, y, w, h):
    p = skia.Path()
    p.addRect(skia.Rect.MakeXYWH(x, y, w, h))
    return p


def rrect(x, y, w, h, r):
    p = skia.Path()
    p.addRRect(skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(x, y, w, h), r, r))
    return p


def circle(x, y, r):
    p = skia.Path()
    p.addCircle(x, y, r)
    return p


def oval(cx, cy, rx, ry):
    p = skia.Path()
    p.addOval(skia.Rect.MakeLTRB(cx - rx, cy - ry, cx + rx, cy + ry))
    return p


def poly(pts, closed=True):
    p = skia.Path()
    p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    if closed:
        p.close()
    return p


def blob(pts, closed=True, k=1.0):
    """Catmull-Rom spline through points -> smooth path"""
    p = skia.Path()
    n = len(pts)
    if n < 3:
        return poly(pts, closed)
    if closed:
        p.moveTo(*pts[0])
        for i in range(n):
            p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
            c1 = (p1[0] + (p2[0] - p0[0]) / 6 * k, p1[1] + (p2[1] - p0[1]) / 6 * k)
            c2 = (p2[0] - (p3[0] - p1[0]) / 6 * k, p2[1] - (p3[1] - p1[1]) / 6 * k)
            p.cubicTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
        p.close()
    else:
        ext = [pts[0]] + list(pts) + [pts[-1]]
        p.moveTo(*pts[0])
        for i in range(1, n):
            p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
            c1 = (p1[0] + (p2[0] - p0[0]) / 6 * k, p1[1] + (p2[1] - p0[1]) / 6 * k)
            c2 = (p2[0] - (p3[0] - p1[0]) / 6 * k, p2[1] - (p3[1] - p1[1]) / 6 * k)
            p.cubicTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
    return p


def wobbly_poly(pts, amp=2.0, seed=0, closed=True, k=0.6):
    """hand-cut looking polygon: points jittered then lightly smoothed"""
    q = [(x + (hash01(seed, i, 1) - 0.5) * 2 * amp, y + (hash01(seed, i, 2) - 0.5) * 2 * amp)
         for i, (x, y) in enumerate(pts)]
    return blob(q, closed, k)


def torn_rect(x, y, w, h, seed=0, rough=5.0, step=9.0):
    """rectangle with ripped paper edges (fractal jitter)"""
    pts = []
    def edge(x0, y0, x1, y1, side):
        L = math.hypot(x1 - x0, y1 - y0)
        n = max(2, int(L / step))
        nx, ny = (y1 - y0) / L, -(x1 - x0) / L  # outward normal (clockwise path)
        for i in range(n):
            t = i / n
            j = (noise1(t * L / 30.0, seed + side * 17) * 0.6 +
                 noise1(t * L / 9.0, seed + side * 31) * 0.3 +
                 (hash01(seed, side, i) - 0.5) * 0.5) * rough
            pts.append((x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j))
    edge(x, y, x + w, y, 0)
    edge(x + w, y, x + w, y + h, 1)
    edge(x + w, y + h, x, y + h, 2)
    edge(x, y + h, x, y, 3)
    return poly(pts)


def path_xform(path, m):
    q = skia.Path(path)
    q.transform(m)
    return q


def translated(path, dx, dy):
    return path_xform(path, skia.Matrix.Translate(dx, dy))


# --------------------------------------------------------------------------
# paper drawing
# --------------------------------------------------------------------------

_blur_cache = {}
_mod_cache = {}


def _modulate(col):
    f = _mod_cache.get(col)
    if f is None:
        f = skia.ColorFilters.Blend(col, skia.BlendMode.kModulate)
        if len(_mod_cache) < 2048:
            _mod_cache[col] = f
    return f

# when SHADOW[0] is True, paper() draws only a blurred dark silhouette (used for
# group drop-shadows of characters / props drawn twice)
SHADOW = [False, 7.0]


def _blur(sigma):
    k = round(sigma, 1)
    mf = _blur_cache.get(k)
    if mf is None:
        mf = skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, max(0.1, k))
        _blur_cache[k] = mf
    return mf


def shadow(c, path, dx=5, dy=9, blur=7, a=0.33, color=0x1A0F08):
    c.save()
    c.translate(dx, dy)
    c.drawPath(path, skia.Paint(AntiAlias=True, Color=C(color, a), MaskFilter=_blur(blur)))
    c.restore()


def paper(c, path, color, ol=3.0, olc=OUTLINE, tex=True, seed=0, sh=None, alpha=1.0, texs=1.0):
    """draw a cut-paper shape.
    sh: None or (dx, dy, blur, alpha) for a soft drop shadow."""
    if SHADOW[0]:
        c.drawPath(path, skia.Paint(AntiAlias=True, Color=0xFF000000, MaskFilter=_blur(SHADOW[1])))
        return
    if sh:
        shadow(c, path, *sh)
    if ol and ol > 0:
        c.drawPath(path, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style,
                                    StrokeWidth=ol * 2, StrokeJoin=skia.Paint.kRound_Join,
                                    Color=(olc & 0xFFFFFF) | (int(((olc >> 24) & 255) * alpha) << 24)))
    col = C(color, alpha)
    if tex:
        ox = hash01(seed, 7) * 512
        oy = hash01(seed, 8) * 512
        paint = skia.Paint(AntiAlias=True, Shader=TEX().paper_shader(ox, oy, texs),
                           ColorFilter=_modulate(col | 0xFF000000), Alphaf=clamp(alpha))
    else:
        paint = skia.Paint(AntiAlias=True, Color=col)
    c.drawPath(path, paint)


def flat(c, path, color, alpha=1.0):
    if SHADOW[0]:
        return
    c.drawPath(path, skia.Paint(AntiAlias=True, Color=C(color, alpha)))


def stroke(c, path, color, w=3.0, alpha=1.0, cap='round'):
    if SHADOW[0]:
        return
    paint = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=w,
                       Color=C(color, alpha),
                       StrokeCap=skia.Paint.kRound_Cap if cap == 'round' else skia.Paint.kButt_Cap,
                       StrokeJoin=skia.Paint.kRound_Join)
    c.drawPath(path, paint)


def line(c, x0, y0, x1, y1, color, w=3.0, alpha=1.0):
    p = skia.Path()
    p.moveTo(x0, y0)
    p.lineTo(x1, y1)
    stroke(c, p, color, w, alpha)


def glow(c, x, y, r, color, a=0.6, mode=skia.BlendMode.kScreen):
    if SHADOW[0]:
        return
    sh = skia.GradientShader.MakeRadial((x, y), max(1.0, r), [C(color, a), C(color, a * 0.35), C(color, 0)],
                                        [0.0, 0.45, 1.0])
    c.drawCircle(x, y, r, skia.Paint(Shader=sh, BlendMode=mode))


def lin_grad(x0, y0, x1, y1, cols, pos=None):
    return skia.GradientShader.MakeLinear([(x0, y0), (x1, y1)], cols, pos)


def grad_rect(c, x, y, w, h, c0, c1, horizontal=False, alpha=1.0):
    sh = lin_grad(x, y, x + (w if horizontal else 0), y + (0 if horizontal else h), [C(c0, alpha), C(c1, alpha)])
    c.drawRect(skia.Rect.MakeXYWH(x, y, w, h), skia.Paint(Shader=sh))


def rivet(c, x, y, r=5.0):
    """brass split-pin fastener"""
    if SHADOW[0]:
        return
    c.drawCircle(x + 0.8, y + 1.2, r + 0.6, skia.Paint(AntiAlias=True, Color=C(0x2A1A0A, 0.35)))
    c.drawCircle(x, y, r, skia.Paint(AntiAlias=True, Color=C(0xB88E34)))
    c.drawCircle(x - r * 0.3, y - r * 0.3, r * 0.45, skia.Paint(AntiAlias=True, Color=C(0xF1D88A, 0.9)))


# --------------------------------------------------------------------------
# fonts / text
# --------------------------------------------------------------------------

@functools.lru_cache(maxsize=16)
def typeface(name):
    return skia.Typeface.MakeFromFile(os.path.join(ASSETS, name))


@functools.lru_cache(maxsize=64)
def font(name, size):
    f = skia.Font(typeface(name), size)
    f.setEdging(skia.Font.Edging.kAntiAlias)
    f.setSubpixel(True)
    return f


def text_width(s, f):
    return f.measureText(s)


def draw_text(c, s, x, y, f, color, alpha=1.0, align='left'):
    w = f.measureText(s)
    if align == 'center':
        x -= w / 2
    elif align == 'right':
        x -= w
    c.drawString(s, x, y, f, skia.Paint(AntiAlias=True, Color=C(color, alpha)))
    return w


def text_path(s, f, x, y, align='left', spacing=0.0):
    glyphs = f.textToGlyphs(s)
    widths = f.getWidths(glyphs)
    total = sum(widths) + spacing * (len(widths) - 1)
    if align == 'center':
        x -= total / 2
    elif align == 'right':
        x -= total
    p = skia.Path()
    cx = x
    for g, w in zip(glyphs, widths):
        gp = f.getPath(g)
        if gp is not None:
            gp.offset(cx, y)
            p.addPath(gp)
        cx += w + spacing
    return p


# --------------------------------------------------------------------------
# camera
# --------------------------------------------------------------------------

class Cam:
    def __init__(self, zoom=1.0, cx=W / 2, cy=H / 2, rot=0.0):
        self.zoom, self.cx, self.cy, self.rot = zoom, cx, cy, rot

    @staticmethod
    def lerp(a, b, t):
        return Cam(lerp(a.zoom, b.zoom, t), lerp(a.cx, b.cx, t), lerp(a.cy, b.cy, t), lerp(a.rot, b.rot, t))

    def matrix(self, par=1.0):
        z = 1 + (self.zoom - 1) * par
        cx = W / 2 + (self.cx - W / 2) * par
        cy = H / 2 + (self.cy - H / 2) * par
        m = skia.Matrix.Translate(W / 2, H / 2)
        m.preScale(z, z)
        m.preRotate(self.rot * par)
        m.preTranslate(-cx, -cy)
        return m


class layer:
    """context manager: apply camera with parallax factor"""

    def __init__(self, c, cam, par=1.0):
        self.c, self.cam, self.par = c, cam, par

    def __enter__(self):
        self.c.save()
        self.c.concat(self.cam.matrix(self.par))
        return self.c

    def __exit__(self, *a):
        self.c.restore()


def cam_move(t, T, z0, z1, x0=W / 2, y0=H / 2, x1=None, y1=None, ease=eio, rot0=0.0, rot1=0.0):
    x1 = x0 if x1 is None else x1
    y1 = y0 if y1 is None else y1
    u = ease(seg(t, 0, T)) if T > 0 else 1.0
    return Cam(lerp(z0, z1, u), lerp(x0, x1, u), lerp(y0, y1, u), lerp(rot0, rot1, u))


class alpha_layer:
    def __init__(self, c, a, bounds=None):
        self.c, self.a, self.b = c, a, bounds

    def __enter__(self):
        if self.a < 0.999:
            if self.b is not None:
                self.c.saveLayerAlpha(self.b, int(clamp(self.a) * 255))
            else:
                self.c.saveLayerAlpha(None, int(clamp(self.a) * 255))
        else:
            self.c.save()
        return self.c

    def __exit__(self, *a):
        self.c.restore()


class xf:
    """transform context: translate / rotate(deg) / scale about origin"""

    def __init__(self, c, x=0.0, y=0.0, rot=0.0, s=1.0, sy=None):
        self.c, self.x, self.y, self.rot, self.s, self.sy = c, x, y, rot, s, sy

    def __enter__(self):
        self.c.save()
        self.c.translate(self.x, self.y)
        if self.rot:
            self.c.rotate(self.rot)
        if self.s != 1.0 or (self.sy is not None and self.sy != 1.0):
            self.c.scale(self.s, self.s if self.sy is None else self.sy)
        return self.c

    def __exit__(self, *a):
        self.c.restore()


# --------------------------------------------------------------------------
# grading / post
# --------------------------------------------------------------------------

def color_matrix(sat=1.0, bright=1.0, contrast=1.0, tint=(1.0, 1.0, 1.0), lift=(0.0, 0.0, 0.0)):
    """build a 4x5 colour matrix (row-major, rgb in 0..1, offsets in 0..1)"""
    lr, lg, lb = 0.2126, 0.7152, 0.0722
    s = sat
    m = np.array([
        [lr * (1 - s) + s, lg * (1 - s), lb * (1 - s)],
        [lr * (1 - s), lg * (1 - s) + s, lb * (1 - s)],
        [lr * (1 - s), lg * (1 - s), lb * (1 - s) + s],
    ], dtype=np.float64)
    m = m * bright * contrast
    off = (0.5 - 0.5 * contrast) * bright
    tint = np.array(tint)
    m = m * tint[:, None]
    offs = off * tint + np.array(lift)
    out = []
    for r in range(3):
        out += [m[r, 0], m[r, 1], m[r, 2], 0.0, offs[r]]
    out += [0, 0, 0, 1, 0]
    return out


def grade_filter(**kw):
    return skia.ColorFilters.Matrix(color_matrix(**kw))


GRADES = {
    'warm': dict(sat=0.92, bright=1.0, contrast=1.02, tint=(1.04, 1.0, 0.92)),
    'neutral': dict(sat=0.95, bright=1.0, contrast=1.0, tint=(1.02, 1.0, 0.96)),
    'night': dict(sat=0.85, bright=0.92, contrast=1.04, tint=(0.92, 0.95, 1.08)),
    'sepia': dict(sat=0.25, bright=1.02, contrast=0.95, tint=(1.12, 0.98, 0.78), lift=(0.03, 0.02, 0.0)),
    'sad': dict(sat=0.45, bright=0.93, contrast=0.96, tint=(0.95, 1.01, 0.98), lift=(0.01, 0.015, 0.015)),
    'grey': dict(sat=0.3, bright=0.9, contrast=0.95, tint=(0.97, 1.0, 1.02), lift=(0.01, 0.012, 0.015)),
    'candle': dict(sat=0.9, bright=0.97, contrast=1.05, tint=(1.08, 0.98, 0.84)),
    'modern': dict(sat=0.98, bright=1.0, contrast=1.02, tint=(1.0, 1.0, 0.98)),
}


def post_overlays(c, vignette=1.0, grain=1.0, stain=1.0):
    T = TEX()
    s = T.samp
    if stain > 0:
        c.drawImage(T.stain, 0, 0, s, skia.Paint(BlendMode=skia.BlendMode.kMultiply, Alphaf=clamp(stain)))
    if vignette > 0:
        c.drawImage(T.vignette, 0, 0, s, skia.Paint(BlendMode=skia.BlendMode.kMultiply, Alphaf=clamp(vignette)))
    if grain > 0:
        c.drawImage(T.grain, 0, 0, s, skia.Paint(BlendMode=skia.BlendMode.kSoftLight, Alphaf=clamp(grain)))


def new_surface():
    info = skia.ImageInfo.Make(W, H, skia.kRGBA_8888_ColorType, skia.kPremul_AlphaType)
    return skia.Surface.MakeRaster(info)


def with_shadow(c, draw_fn, dx=6.0, dy=11.0, blur=8.0, a=0.34, bounds=None):
    """draw draw_fn() twice: once as a blurred offset silhouette, then normally"""
    if a > 0:
        c.saveLayerAlpha(bounds, int(clamp(a) * 255))
        c.translate(dx, dy)
        SHADOW[0] = True
        SHADOW[1] = blur
        try:
            draw_fn()
        finally:
            SHADOW[0] = False
        c.restore()
    draw_fn()
