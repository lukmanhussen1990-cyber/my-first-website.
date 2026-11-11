"""Core 2D low-poly rendering engine (skia-python).

Everything is vector: polygons are triangulated once (Delaunay) into facets, each
vertex gets a fake height from a dome profile, and each facet is shaded from its
true 3D normal. That gives the faceted "gem" low-poly look while staying 100% 2D.
"""
import math
import contextlib
from pathlib import Path

import numpy as np
import skia
from scipy.spatial import Delaunay

W, H, FPS = 1080, 1920, 60
ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "assets" / "fonts"

# ----------------------------------------------------------------------------
# math / easing
# ----------------------------------------------------------------------------

def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lerp(a, b, t):
    return a + (b - a) * t


def seg(t, a, b):
    if b == a:
        return 1.0 if t >= b else 0.0
    return clamp((t - a) / (b - a))


def smooth(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def smoother(t):
    t = clamp(t)
    return t * t * t * (t * (t * 6 - 15) + 10)


def ease_in(t, p=2.0):
    return clamp(t) ** p


def ease_out(t, p=2.0):
    return 1 - (1 - clamp(t)) ** p


def ease_io(t, p=3.0):
    t = clamp(t)
    if t < 0.5:
        return 0.5 * (2 * t) ** p
    return 1 - 0.5 * (2 - 2 * t) ** p


def ease_out_back(t, s=1.70158):
    t = clamp(t) - 1
    return 1 + (s + 1) * t ** 3 + s * t ** 2


def ease_in_back(t, s=1.70158):
    t = clamp(t)
    return (s + 1) * t ** 3 - s * t ** 2


def ease_out_elastic(t, period=0.3):
    t = clamp(t)
    if t in (0.0, 1.0):
        return t
    return 2 ** (-10 * t) * math.sin((t - period / 4) * (2 * math.pi) / period) + 1


def pop(t):
    """Caption pop: 0.8 -> 1.1 -> 1.0."""
    if t <= 0:
        return 0.8
    if t < 0.42:
        return lerp(0.8, 1.12, ease_out(t / 0.42, 2.2))
    if t < 1:
        return lerp(1.12, 1.0, ease_io((t - 0.42) / 0.58))
    return 1.0


def spring(t, freq=3.0, decay=6.0):
    """Damped overshoot wobble, 1 at t=0 decaying to 0."""
    if t < 0:
        return 0.0
    return math.exp(-decay * t) * math.cos(2 * math.pi * freq * t)


def _hash(i, seed):
    x = (i * 374761393 + seed * 668265263) & 0xFFFFFFFF
    x = ((x ^ (x >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((x ^ (x >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


def noise1(x, seed=0):
    """Smooth 1D value noise in [-1, 1]."""
    i = math.floor(x)
    f = x - i
    a = _hash(i, seed) * 2 - 1
    b = _hash(i + 1, seed) * 2 - 1
    u = f * f * (3 - 2 * f)
    return a + (b - a) * u


def fbm(x, seed=0, octaves=3):
    v, amp, tot = 0.0, 1.0, 0.0
    for o in range(octaves):
        v += noise1(x * (2 ** o), seed + o * 17) * amp
        tot += amp
        amp *= 0.5
    return v / tot


def rnd(i, seed=0):
    return _hash(int(i), seed)


# ----------------------------------------------------------------------------
# colors
# ----------------------------------------------------------------------------

def hexc(s):
    s = s.lstrip("#")
    return (int(s[0:2], 16) / 255.0, int(s[2:4], 16) / 255.0, int(s[4:6], 16) / 255.0)


def mix(c1, c2, t):
    return tuple(lerp(a, b, t) for a, b in zip(c1, c2))


def mul(c, k):
    if isinstance(k, (tuple, list)):
        return tuple(a * b for a, b in zip(c, k))
    return tuple(a * k for a in c)


def argb(c, a=1.0):
    r, g, b = (int(clamp(v) * 255 + 0.5) for v in c[:3])
    return skia.ColorSetARGB(int(clamp(a) * 255 + 0.5), r, g, b)


def paint(c=(1, 1, 1), a=1.0, style="fill", width=1.0, blend=None, blur=0.0, cap="round", join="round"):
    p = skia.Paint(AntiAlias=True)
    p.setColor(argb(c, a))
    if style == "fill":
        p.setStyle(skia.Paint.kFill_Style)
    elif style == "stroke":
        p.setStyle(skia.Paint.kStroke_Style)
        p.setStrokeWidth(width)
    else:
        p.setStyle(skia.Paint.kStrokeAndFill_Style)
        p.setStrokeWidth(width)
    p.setStrokeCap({"round": skia.Paint.kRound_Cap, "butt": skia.Paint.kButt_Cap, "square": skia.Paint.kSquare_Cap}[cap])
    p.setStrokeJoin({"round": skia.Paint.kRound_Join, "miter": skia.Paint.kMiter_Join, "bevel": skia.Paint.kBevel_Join}[join])
    if blend is not None:
        p.setBlendMode(blend)
    if blur > 0:
        p.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, blur))
    return p


def poly_path(pts, close=True):
    path = skia.Path()
    if len(pts) == 0:
        return path
    path.moveTo(float(pts[0][0]), float(pts[0][1]))
    for x, y in pts[1:]:
        path.lineTo(float(x), float(y))
    if close:
        path.close()
    return path


def smooth_path(pts, close=True, tension=0.5):
    """Catmull-Rom through points -> cubic path."""
    n = len(pts)
    path = skia.Path()
    if n < 3:
        return poly_path(pts, close)
    P = [np.array(p, float) for p in pts]
    path.moveTo(*P[0])
    rng_ = range(n) if close else range(n - 1)
    for i in rng_:
        p0 = P[(i - 1) % n] if (close or i > 0) else P[i]
        p1 = P[i]
        p2 = P[(i + 1) % n]
        p3 = P[(i + 2) % n] if (close or i + 2 < n) else P[(i + 1) % n]
        c1 = p1 + (p2 - p0) * tension / 3
        c2 = p2 - (p3 - p1) * tension / 3
        path.cubicTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
    if close:
        path.close()
    return path


# ----------------------------------------------------------------------------
# lighting
# ----------------------------------------------------------------------------

class Light:
    def __init__(self, direction=(-0.42, -0.7, 0.72), ambient=0.6, diffuse=0.5, tint=(1, 1, 1),
                 rim=(0.85, -0.35), rim_color=(1.0, 0.85, 0.7), rim_amt=0.0, spec_color=(1, 1, 1),
                 spec_dir=None, amb_tint=None):
        d = np.array(direction, float)
        self.dir = d / np.linalg.norm(d)
        self.ambient = ambient
        self.diffuse = diffuse
        self.tint = np.array(tint, float)
        self.amb_tint = np.array(tint if amb_tint is None else amb_tint, float)
        r = np.array(rim, float)
        self.rim = r / (np.linalg.norm(r) + 1e-9)
        self.rim_color = np.array(rim_color, float)
        self.rim_amt = rim_amt
        self.spec_color = np.array(spec_color, float)

    def copy(self, **kw):
        l = Light()
        l.__dict__.update({k: (v.copy() if isinstance(v, np.ndarray) else v) for k, v in self.__dict__.items()})
        for k, v in kw.items():
            if k in ("tint", "amb_tint", "rim_color", "dir"):
                v = np.array(v, float)
            setattr(l, k, v)
        return l


def lerp_light(a, b, t):
    l = a.copy()
    d = a.dir * (1 - t) + b.dir * t
    l.dir = d / np.linalg.norm(d)
    l.ambient = lerp(a.ambient, b.ambient, t)
    l.diffuse = lerp(a.diffuse, b.diffuse, t)
    l.tint = a.tint * (1 - t) + b.tint * t
    l.amb_tint = a.amb_tint * (1 - t) + b.amb_tint * t
    l.rim_amt = lerp(a.rim_amt, b.rim_amt, t)
    l.rim_color = a.rim_color * (1 - t) + b.rim_color * t
    r = a.rim * (1 - t) + b.rim * t
    l.rim = r / (np.linalg.norm(r) + 1e-9)
    return l


# ----------------------------------------------------------------------------
# context with transform tracking (so facets are lit in world space)
# ----------------------------------------------------------------------------

class Ctx:
    def __init__(self, canvas, light, t=0.0, frame=0):
        self.c = canvas
        self.light = light
        self.rot = 0.0  # world rotation in degrees
        self.flip = 1
        self.t = t
        self.frame = frame
        self._stack = []
        self.tint_extra = None  # optional (color, amount) blended over all facets

    def push(self):
        self.c.save()
        self._stack.append((self.rot, self.flip, self.light, self.tint_extra))

    def pop(self):
        self.c.restore()
        self.rot, self.flip, self.light, self.tint_extra = self._stack.pop()

    @contextlib.contextmanager
    def at(self, x=0.0, y=0.0, rot=0.0, sx=1.0, sy=None):
        self.push()
        try:
            self.translate(x, y)
            if rot:
                self.rotate(rot)
            if sx != 1.0 or (sy is not None and sy != 1.0):
                self.scale(sx, sx if sy is None else sy)
            yield self
        finally:
            self.pop()

    def translate(self, x, y):
        self.c.translate(float(x), float(y))

    def rotate(self, deg):
        self.c.rotate(float(deg))
        self.rot += deg * self.flip

    def scale(self, sx, sy=None):
        sy = sx if sy is None else sy
        self.c.scale(float(sx), float(sy))
        if sx * sy < 0:
            self.flip *= -1

    def local_light(self):
        """Light direction expressed in the current local frame."""
        L = self.light.dir.copy()
        a = math.radians(-self.rot)
        ca, sa = math.cos(a), math.sin(a)
        x, y = L[0] * ca - L[1] * sa, L[0] * sa + L[1] * ca
        r = self.light.rim
        rx, ry = r[0] * ca - r[1] * sa, r[0] * sa + r[1] * ca
        if self.flip < 0:
            x, rx = -x, -rx
        return np.array([x, y, L[2]]), np.array([rx, ry])


def lit_col(ctx, col, k=0.72):
    """Approximate a colour as lit by the current scene light (for flat overlay details)."""
    L = ctx.light
    c = np.array(col[:3], float) * (L.ambient * L.amb_tint + L.diffuse * k * L.tint)
    return tuple(np.clip(c, 0, 1))


def lit_mix(ctx, col, amt=0.5, k=0.9):
    return mix(col, lit_col(ctx, col, k), amt)


# ----------------------------------------------------------------------------
# facet meshes
# ----------------------------------------------------------------------------

def _pip(px, py, poly):
    """Vectorised point-in-polygon (ray casting)."""
    inside = np.zeros(px.shape, bool)
    n = len(poly)
    xs, ys = poly[:, 0], poly[:, 1]
    j = n - 1
    for i in range(n):
        xi, yi, xj, yj = xs[i], ys[i], xs[j], ys[j]
        cond = ((yi > py) != (yj > py)) & (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi)
        inside ^= cond
        j = i
    return inside


def _seg_dist(px, py, poly):
    d = np.full(px.shape, 1e9)
    n = len(poly)
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy + 1e-12
        t = np.clip(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1)
        qx, qy = ax + t * dx - px, ay + t * dy - py
        d = np.minimum(d, np.sqrt(qx * qx + qy * qy))
    return d


class Facets:
    """A polygon pre-triangulated into lit facets."""

    def __init__(self, outline, color, seed=0, n=16, dome=0.75, jitter=0.09, spec=0.0, shine=24.0,
                 center=None, radii=None, extra=None, rim=1.0, edge_dark=0.0, sub_outline=1):
        pts = np.array(outline, float)
        if sub_outline > 1:
            res = []
            m = len(pts)
            for i in range(m):
                a, b = pts[i], pts[(i + 1) % m]
                for k in range(sub_outline):
                    res.append(a + (b - a) * k / sub_outline)
            pts = np.array(res)
        self.outline = pts
        self.color = np.array(color, float)
        self.spec = spec
        self.shine = shine
        self.rim_k = rim
        mn, mx = pts.min(0), pts.max(0)
        c = (mn + mx) / 2 if center is None else np.array(center, float)
        r = (mx - mn) / 2 if radii is None else np.array(radii, float)
        r = np.maximum(r, 1e-3)
        rng = np.random.default_rng(seed)
        # interior points
        area = 0.5 * abs(np.dot(pts[:, 0], np.roll(pts[:, 1], 1)) - np.dot(pts[:, 1], np.roll(pts[:, 0], 1)))
        step = math.sqrt(max(area, 1.0) / max(n, 1))
        gx = np.arange(mn[0] + step * 0.5, mx[0], step)
        gy = np.arange(mn[1] + step * 0.5, mx[1], step * 0.87)
        X, Y = np.meshgrid(gx, gy)
        X = X + (np.arange(len(gy))[:, None] % 2) * step * 0.5
        X = X.ravel() + rng.uniform(-0.3, 0.3, X.size) * step
        Y = Y.ravel() + rng.uniform(-0.3, 0.3, Y.size) * step
        ins = _pip(X, Y, pts)
        if ins.any():
            dd = _seg_dist(X, Y, pts)
            ins &= dd > step * 0.32
        inner = np.stack([X[ins], Y[ins]], 1) if ins.any() else np.zeros((0, 2))
        if extra is not None:
            inner = np.concatenate([inner, np.array(extra, float)], 0)
        allp = np.concatenate([pts, inner], 0)
        if len(allp) >= 3:
            try:
                tri = Delaunay(allp).simplices
            except Exception:
                tri = np.array([[0, i, i + 1] for i in range(1, len(pts) - 1)])
        else:
            tri = np.zeros((0, 3), int)
        cen = allp[tri].mean(1) if len(tri) else np.zeros((0, 2))
        keep = _pip(cen[:, 0], cen[:, 1], pts) if len(tri) else np.zeros(0, bool)
        tri = tri[keep]
        # vertex heights from dome profile + jitter
        d = (allp - c) / r
        rr = np.clip((d ** 2).sum(1), 0, 1)
        z = dome * np.sqrt(1 - rr) * r.min() + rng.uniform(-1, 1, len(allp)) * jitter * r.min()
        z[: len(pts)] = rng.uniform(-0.04, 0.06, len(pts)) * r.min()  # silhouette verts sit low
        V = np.concatenate([allp, z[:, None]], 1)
        a, b, cc = V[tri[:, 0]], V[tri[:, 1]], V[tri[:, 2]]
        nrm = np.cross(b - a, cc - a)
        nrm *= np.sign(nrm[:, 2:3] + 1e-12)
        nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
        self.normals = nrm
        self.jit = rng.uniform(-1, 1, len(tri)) * 0.022
        self.tris = allp[tri]
        self.paths = [poly_path(t) for t in self.tris]
        self.base = poly_path(pts)
        self.edge_dark = edge_dark

    def shade(self, ctx, color=None, tint=None):
        L, R = ctx.local_light()
        lt = ctx.light
        base = self.color if color is None else np.array(color, float)
        n = self.normals
        lam = np.clip(n @ L, 0, 1)
        k = lt.diffuse * lam + self.jit
        col = base[None, :] * (lt.ambient * lt.amb_tint[None, :] + k[:, None] * lt.tint[None, :])
        if lt.rim_amt > 0 and self.rim_k > 0:
            rim = np.clip(n[:, 0] * R[0] + n[:, 1] * R[1], 0, 1) ** 1.2 * (1 - n[:, 2]) ** 2 * 4.0
            col += rim[:, None] * lt.rim_color[None, :] * lt.rim_amt * self.rim_k
        if self.spec > 0:
            Hh = L + np.array([0, 0, 1.0])
            Hh /= np.linalg.norm(Hh)
            s = np.clip(n @ Hh, 0, 1) ** self.shine * self.spec
            col += s[:, None] * lt.spec_color[None, :] * lt.tint[None, :]
        if tint is not None:
            tc, ta = tint
            col = col * (1 - ta) + np.array(tc, float)[None, :] * ta
        if ctx.tint_extra is not None:
            tc, ta = ctx.tint_extra
            col = col * (1 - ta) + np.array(tc, float)[None, :] * ta
        return np.clip(col, 0, 1)

    def draw(self, ctx, color=None, alpha=1.0, tint=None, outline=None):
        cols = self.shade(ctx, color, tint)
        c = ctx.c
        avg = cols.mean(0) if len(cols) else (self.color * ctx.light.tint)
        p = paint(avg, alpha)
        c.drawPath(self.base, p)
        p.setStyle(skia.Paint.kStrokeAndFill_Style)
        p.setStrokeWidth(1.1)
        a8 = int(clamp(alpha) * 255)
        for path, col in zip(self.paths, cols):
            p.setColor(skia.ColorSetARGB(a8, int(col[0] * 255), int(col[1] * 255), int(col[2] * 255)))
            c.drawPath(path, p)
        if outline is not None:
            oc, ow, oa = outline
            c.drawPath(self.base, paint(oc, oa * alpha, "stroke", ow))


_UNIT_CIRCLES = {}


def circle_pts(r=1.0, n=14, seed=0, wob=0.0, cx=0.0, cy=0.0, sx=1.0, sy=1.0, phase=0.0):
    out = []
    for i in range(n):
        a = phase + 2 * math.pi * i / n
        rr = r * (1 + wob * (rnd(i, seed) * 2 - 1))
        out.append((cx + math.cos(a) * rr * sx, cy + math.sin(a) * rr * sy))
    return out


def unit_blob(seed=0, n=13, wob=0.12, dens=10, dome=0.85, jitter=0.2, spec=0.0):
    key = (seed, n, wob, dens, dome, jitter, spec)
    if key not in _UNIT_CIRCLES:
        _UNIT_CIRCLES[key] = Facets(circle_pts(100, n, seed, wob), (1, 1, 1), seed=seed, n=dens, dome=dome,
                                    jitter=jitter, spec=spec)
    return _UNIT_CIRCLES[key]


def capsule_pts(length, r0, r1, n_cap=6, bulge=0.0, bulge_pos=0.5, bulge_side=0, n_side=4):
    """Outline of a tapered capsule along +y from (0,0) to (0,length)."""
    right, left = [], []
    for i in range(n_side + 1):
        t = i / n_side
        y = t * length
        r = lerp(r0, r1, t)
        b = bulge * math.exp(-((t - bulge_pos) / 0.28) ** 2)
        rr_ = r * (1 + b * (1.0 if bulge_side >= 0 else 0.35))
        rl_ = r * (1 + b * (1.0 if bulge_side <= 0 else 0.35))
        right.append((rr_, y))
        left.append((-rl_, y))
    pts = []
    # top cap
    for i in range(n_cap + 1):
        a = math.pi + math.pi * i / n_cap
        pts.append((math.cos(a) * r0, math.sin(a) * r0 * 0.9))
    pts += right[1:-1]
    for i in range(n_cap + 1):
        a = math.pi * i / n_cap
        pts.append((math.cos(a) * r1, length + math.sin(a) * r1 * 0.9))
    pts += left[1:-1][::-1]
    return pts


def strip_facets(ctx, center_pts, widths, color, seed=0, alpha=1.0, spec=0.0, shine=20.0, twist=0.0):
    """Ribbon along a polyline (bars, ropes, bent barbell). Dynamic: built per frame."""
    pts = np.array(center_pts, float)
    widths = np.broadcast_to(np.array(widths, float), (len(pts),))
    tang = np.gradient(pts, axis=0)
    tang /= np.linalg.norm(tang, axis=1, keepdims=True) + 1e-9
    nrm = np.stack([-tang[:, 1], tang[:, 0]], 1)
    L, _ = ctx.local_light()
    lt = ctx.light
    base = np.array(color, float)
    c = ctx.c
    p = paint(base, alpha, "both", 1.0)
    rows = 4
    for i in range(len(pts) - 1):
        for j in range(rows):
            v0 = -1 + 2 * j / rows
            v1 = -1 + 2 * (j + 1) / rows
            a0 = pts[i] + nrm[i] * widths[i] * v0 / 2
            a1 = pts[i] + nrm[i] * widths[i] * v1 / 2
            b0 = pts[i + 1] + nrm[i + 1] * widths[i + 1] * v0 / 2
            b1 = pts[i + 1] + nrm[i + 1] * widths[i + 1] * v1 / 2
            vm = (v0 + v1) / 2
            # cylinder normal across strip
            nn = np.array([nrm[i][0] * vm, nrm[i][1] * vm, math.sqrt(max(0.0, 1 - vm * vm))])
            lam = max(0.0, float(nn @ L))
            k = lt.diffuse * lam + (rnd(i * 7 + j, seed) - 0.5) * 0.06 + twist * (j % 2) * 0.04
            col = base * (lt.ambient * lt.amb_tint + k * lt.tint)
            if spec > 0:
                hh = L + np.array([0, 0, 1.0])
                hh /= np.linalg.norm(hh)
                col = col + spec * max(0.0, float(nn @ hh)) ** shine * lt.tint
            col = np.clip(col, 0, 1)
            p.setColor(argb(col, alpha))
            c.drawPath(poly_path([a0, b0, b1]), p)
            c.drawPath(poly_path([a0, b1, a1]), p)


# ----------------------------------------------------------------------------
# effects
# ----------------------------------------------------------------------------

def glow_circle(canvas, x, y, r, color, alpha=0.6, blend=skia.BlendMode.kScreen):
    sh = skia.GradientShader.MakeRadial(skia.Point(float(x), float(y)), float(max(r, 1)),
                                        [argb(color, alpha), argb(color, alpha * 0.35), argb(color, 0)],
                                        [0.0, 0.45, 1.0])
    p = skia.Paint(AntiAlias=True)
    p.setShader(sh)
    p.setBlendMode(blend)
    canvas.drawCircle(float(x), float(y), float(r), p)


def light_cone(canvas, apex, angle_deg, length, spread_deg, color, alpha=0.25, blur=18):
    ax, ay = apex
    a = math.radians(angle_deg)
    s = math.radians(spread_deg) / 2
    p1 = (ax + math.cos(a - s) * length, ay + math.sin(a - s) * length)
    p2 = (ax + math.cos(a + s) * length, ay + math.sin(a + s) * length)
    end = (ax + math.cos(a) * length, ay + math.sin(a) * length)
    sh = skia.GradientShader.MakeLinear([skia.Point(ax, ay), skia.Point(*end)],
                                        [argb(color, alpha), argb(color, alpha * 0.4), argb(color, 0)],
                                        [0.0, 0.55, 1.0])
    p = skia.Paint(AntiAlias=True)
    p.setShader(sh)
    p.setBlendMode(skia.BlendMode.kScreen)
    if blur:
        p.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, blur))
    canvas.drawPath(poly_path([(ax - 6, ay), p1, p2, (ax + 6, ay)]), p)


def vignette(canvas, strength=0.55, color=(0, 0, 0), inner=0.45):
    sh = skia.GradientShader.MakeRadial(skia.Point(W / 2, H * 0.48), H * 0.62,
                                        [argb(color, 0), argb(color, 0), argb(color, strength)],
                                        [0.0, inner, 1.0])
    p = skia.Paint()
    p.setShader(sh)
    canvas.drawRect(skia.Rect.MakeWH(W, H), p)


def lin_grad_rect(canvas, rect, p0, p1, colors, pos=None, blend=None):
    sh = skia.GradientShader.MakeLinear([skia.Point(*p0), skia.Point(*p1)], [argb(c, a) for c, a in colors], pos)
    p = skia.Paint(AntiAlias=True)
    p.setShader(sh)
    if blend is not None:
        p.setBlendMode(blend)
    canvas.drawRect(skia.Rect.MakeLTRB(*rect), p)


def radial_fill(canvas, cx, cy, r, colors, pos=None, rect=None, blend=None):
    sh = skia.GradientShader.MakeRadial(skia.Point(float(cx), float(cy)), float(r), [argb(c, a) for c, a in colors], pos)
    p = skia.Paint(AntiAlias=True)
    p.setShader(sh)
    if blend is not None:
        p.setBlendMode(blend)
    canvas.drawRect(skia.Rect.MakeLTRB(*(rect or (-4000, -4000, 6000, 6000))), p)


_GRAIN = []


def grain(canvas, frame, amount=0.09):
    if not _GRAIN:
        rng = np.random.default_rng(7)
        for i in range(6):
            n = rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32)
            g = np.clip(128 + n * 52, 0, 255).astype(np.uint8)
            rgba = np.stack([g, g, g, np.full_like(g, 255)], -1)
            _GRAIN.append(skia.Image.fromarray(rgba, colorType=skia.kRGBA_8888_ColorType))
    img = _GRAIN[(frame // 2) % len(_GRAIN)]
    p = skia.Paint()
    p.setAlphaf(amount)
    p.setBlendMode(skia.BlendMode.kOverlay)
    canvas.drawImageRect(img, skia.Rect.MakeWH(W, H), skia.SamplingOptions(skia.FilterMode.kLinear), p)


@contextlib.contextmanager
def drop_shadow_layer(ctx, dx=0, dy=18, sigma=16, alpha=0.45, color=(0, 0, 0)):
    p = skia.Paint()
    p.setImageFilter(skia.ImageFilters.DropShadow(dx, dy, sigma, sigma, argb(color, alpha)))
    ctx.c.saveLayer(None, p)
    try:
        yield
    finally:
        ctx.c.restore()


@contextlib.contextmanager
def layer(ctx, alpha=1.0, blend=None, blur=0.0):
    p = skia.Paint()
    p.setAlphaf(clamp(alpha))
    if blend is not None:
        p.setBlendMode(blend)
    if blur > 0:
        p.setImageFilter(skia.ImageFilters.Blur(blur, blur))
    ctx.c.saveLayer(None, p)
    try:
        yield
    finally:
        ctx.c.restore()


# ----------------------------------------------------------------------------
# text
# ----------------------------------------------------------------------------

_TF = {}


def typeface(name="LuckiestGuy-Regular.ttf"):
    if name not in _TF:
        _TF[name] = skia.Typeface.MakeFromFile(str(FONTS / name))
    return _TF[name]


def text_width(text, size, face="LuckiestGuy-Regular.ttf"):
    f = skia.Font(typeface(face), size)
    return f.measureText(text)


def draw_words(canvas, words, cx, cy, size, scale=1.0, rot=0.0, outline=0.16, shadow=True,
               face="LuckiestGuy-Regular.ttf", alpha=1.0, spacing=0.22, gradient=False, max_w=980):
    """words: list of (text, color). Centered single line; auto-shrinks to max_w."""
    font = skia.Font(typeface(face), size)
    font.setEdging(skia.Font.Edging.kAntiAlias)
    sp = size * spacing
    widths = [font.measureText(w) for w, _ in words]
    total = sum(widths) + sp * (len(words) - 1)
    k = min(1.0, max_w / max(total, 1))
    canvas.save()
    canvas.translate(cx, cy)
    canvas.rotate(rot)
    canvas.scale(scale * k, scale * k)
    x = -total / 2
    base = size * 0.36  # visual centering (cap height ~0.72em)
    blobs = []
    for (w, col), ww in zip(words, widths):
        blobs.append((skia.TextBlob.MakeFromString(w, font), x, col))
        x += ww + sp
    ow = size * outline
    if shadow:
        ps = paint((0, 0, 0), 0.55 * alpha, "both", ow, blur=size * 0.05)
        for b, bx, _ in blobs:
            canvas.drawTextBlob(b, bx + size * 0.02, base + size * 0.09, ps)
    po = paint((0.02, 0.02, 0.03), alpha, "both", ow)
    for b, bx, _ in blobs:
        canvas.drawTextBlob(b, bx, base, po)
    for b, bx, col in blobs:
        pf = skia.Paint(AntiAlias=True)
        if gradient:
            c2 = mix(col, (1, 1, 1), 0.35)
            c3 = mul(col, 0.8)
            pf.setShader(skia.GradientShader.MakeLinear([skia.Point(0, base - size * 0.75), skia.Point(0, base)],
                                                         [argb(c2, alpha), argb(col, alpha), argb(c3, alpha)],
                                                         [0, 0.55, 1]))
        else:
            pf.setColor(argb(col, alpha))
        canvas.drawTextBlob(b, bx, base, pf)
    canvas.restore()
    return total * k * scale
