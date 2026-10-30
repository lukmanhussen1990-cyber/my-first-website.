"""E - infinite zoom (frames 1796..1925, 130 frames, 74.950-80.372 s) + moon match-cut into F.
One lens; each pattern hides the next in its core: contours -> circuit -> fern -> ice crystal -> moon.
The bezel ticks forward on stressed words. The lens then shrinks onto the real moon's position/size in the
first sky frame; F's first 8 frames get a radial dissolve from the moon outwards (logo pixels untouched after)."""
import sys, os, math
import numpy as np, cv2, cairo
from scipy.interpolate import PchipInterpolator
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

N = 130
NT = 8                                   # frames of F blended
A0 = 74.950
def wt(x): return x - A0
BEATS = [wt(x) for x in (75.59, 76.00, 76.29, 76.71, 77.09, 77.58, 78.42, 78.76)]
R = 5.0                                  # zoom factor between nested patterns
STAGE_T = [0.0, wt(76.00), wt(76.85), wt(77.62), wt(78.72)]   # pattern k fills the lens (zeta_k = 1)
LC = np.array([960.0, 540.0]); LRI = 380.0
MOON_C = np.array([958.0, 543.0]); MOON_R = 156.0
T_SHRINK0, T_SHRINK1 = wt(78.90), wt(80.05)

_zt = STAGE_T + [STAGE_T[-1] + 0.45, 99.0]
_zv = [k * math.log(R) for k in range(5)] + [4 * math.log(R) + 0.05, 4 * math.log(R) + 0.06]
_logz = PchipInterpolator(_zt, _zv)
def logz(t): return float(_logz(max(t, 0.0))) if t >= 0 else float(_logz(0) + t * (_zv[1] / _zt[1]))

rng = np.random.RandomState(21)

# ------------------------------------------------------------------ pattern 0: topographic contours
def build_contours():
    n = 1600; ext = 1.05
    y, x = (np.mgrid[0:n, 0:n].astype(np.float32) / (n - 1) * 2 - 1) * ext
    r2 = x * x + y * y
    h = 1.2 * np.exp(-r2 / 0.30) + 0.35 * np.exp(-((x + 0.55) ** 2 + (y - 0.35) ** 2) / 0.05) + 0.28 * np.exp(-((x - 0.5) ** 2 + (y + 0.45) ** 2) / 0.07)
    h += fbm(n, n, (520, 260), 3) * 0.07 + fbm(n, n, (130,), 4) * 0.012
    h = cv2.GaussianBlur(h.astype(np.float32), (0, 0), 3.0)
    lines = []
    lv = np.linspace(h.min() + 0.02, h.max() - 0.01, 30)
    for i, L in enumerate(lv):
        m = (h > L).astype(np.uint8)
        cs, _ = cv2.findContours(m, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
        for c in cs:
            if len(c) < 12: continue
            p = c[:, 0, :].astype(np.float32)
            k = 9; pad = np.concatenate([p[-k:], p, p[:k]])
            p = np.stack([np.convolve(pad[:, j], np.ones(2 * k + 1) / (2 * k + 1), "valid") for j in range(2)], 1)
            p = (p / (n - 1) * 2 - 1) * ext
            p = p[::2]
            lines.append((p, i % 5 == 0))
    return lines
CONTOURS = build_contours()
TRAIL = np.array([(0.95 * math.cos(-2.4 + s * 1.3) * (1 - s * 0.78), 0.95 * math.sin(-2.4 + s * 1.3) * (1 - s * 0.78)) for s in np.linspace(0, 1, 60)])

# ------------------------------------------------------------------ pattern 1: circuit traces
def build_circuit():
    traces, pads, vias = [], [], []
    groups = 16
    for g in range(groups):
        base = g / groups * 2 * math.pi
        bend = rng.choice([-1, 1]) * math.pi / 4
        r1 = rng.uniform(0.30, 0.42); seg2 = rng.uniform(0.10, 0.20)
        for j in range(6):
            th = base + (j - 2.5) * 0.045
            p = [np.array([math.cos(th), math.sin(th)]) * 0.215]
            a = np.array([math.cos(th), math.sin(th)])
            p1 = a * (r1 + j * 0.012 * np.sign(bend)); p.append(p1)
            d = np.array([math.cos(th + bend), math.sin(th + bend)]); p2 = p1 + d * seg2; p.append(p2)
            rend = rng.uniform(0.55, 1.02)
            th2 = math.atan2(p2[1], p2[0]); p3 = np.array([math.cos(th2), math.sin(th2)]) * rend; p.append(p3)
            traces.append((np.array(p), g % 5 == 2 and j in (1, 4)))
            pads.append((p3, rng.uniform(0.010, 0.016)))
            if rng.rand() < 0.4: vias.append((p1 + (p2 - p1) * 0.5, 0.008))
    return traces, pads, vias
TRACES, PADS, VIAS = build_circuit()

# ------------------------------------------------------------------ pattern 2: fern rosette
def build_fern():
    strokes = []
    for f in range(7):
        th0 = f / 7 * 2 * math.pi + 0.2
        def rach(s): r = 0.215 + 0.76 * s; th = th0 + 0.55 * s + 0.35 * s ** 3; return np.array([r * math.cos(th), r * math.sin(th)])
        ss = np.linspace(0, 1, 60); P = np.array([rach(s) for s in ss])
        strokes.append((P, 0.010, f == 3))
        for k in range(1, 24):
            s = k / 24; p = rach(s); d = rach(min(1, s + 0.01)) - p; d /= np.linalg.norm(d) + 1e-9
            side = 1 if k % 2 else -1
            ang = math.atan2(d[1], d[0]) + side * math.radians(58)
            L = 0.14 * (1 - s) ** 0.9 + 0.012
            pts = [p + L * u * np.array([math.cos(ang + side * 0.25 * u), math.sin(ang + side * 0.25 * u)]) for u in np.linspace(0, 1, 10)]
            strokes.append((np.array(pts), 0.005, f == 3))
            for q in range(1, 8):
                u = q / 8; b = p + L * u * np.array([math.cos(ang + side * 0.25 * u), math.sin(ang + side * 0.25 * u)])
                for sd in (-1, 1):
                    a2 = ang + side * 0.25 * u + sd * math.radians(50)
                    l2 = L * 0.28 * (1 - u) + 0.003
                    strokes.append((np.array([b, b + l2 * np.array([math.cos(a2), math.sin(a2)])]), 0.0032, f == 3))
    return strokes
FERN = build_fern()

# ------------------------------------------------------------------ pattern 3: ice crystal
def build_crystal():
    segs, hexes = [], []
    def arm(p, ang, L, w, depth):
        q = p + L * np.array([math.cos(ang), math.sin(ang)])
        segs.append((p, q, w))
        if depth >= 2: return
        for u, Lf in [(0.18, 0.34), (0.34, 0.30), (0.50, 0.25), (0.64, 0.19), (0.77, 0.13), (0.88, 0.08)][: 6 if depth == 0 else 3]:
            b = p + (q - p) * u
            for sd in (-1, 1): arm(b, ang + sd * math.pi / 3, L * Lf, w * 0.6, depth + 1)
        if depth == 0:
            for u in (0.42, 0.70): hexes.append((p + (q - p) * u, 0.035 * (1.2 - u)))
    for k in range(6):
        a = k * math.pi / 3 - math.pi / 2
        arm(np.array([math.cos(a), math.sin(a)]) * 0.215, a, 0.76, 0.016, 0)
    return segs, hexes
CRYS, CHEX = build_crystal()

# ------------------------------------------------------------------ pattern 4: moon
CRATERS = []
for k in range(70):
    rho = math.sqrt(rng.rand()) * 0.95; th = rng.rand() * 2 * math.pi
    CRATERS.append((rho * math.cos(th), rho * math.sin(th), 0.015 + 0.10 * rng.rand() ** 2.5))
MARIA = [(-0.35, -0.25, 0.28), (-0.55, 0.20, 0.22), (-0.10, 0.35, 0.20), (0.15, -0.30, 0.25), (-0.30, 0.55, 0.15)]
TERM_K = 0.12
def build_moon(n=1024):
    y, x = (np.mgrid[0:n, 0:n].astype(np.float32) / (n - 1) * 2 - 1)
    r = np.sqrt(x * x + y * y); z = np.sqrt(np.clip(1 - r * r, 0, 1))
    mar = fbm(n, n, (380, 190, 95), 41)
    mar = np.clip((mar - 0.2) / 1.2, 0, 1) ** 1.3 * 0.20
    alb = 0.93 - mar + fbm(n, n, (24, 12, 6), 43) * 0.018
    cr = np.zeros((n, n), np.float32)
    rr_ = np.random.RandomState(44)
    for k in range(260):
        rho = math.sqrt(rr_.rand()) * 0.97; th = rr_.rand() * 2 * math.pi
        cx, cy = rho * math.cos(th), rho * math.sin(th); rad = 0.008 + 0.075 * rr_.rand() ** 3.0
        sq = math.sqrt(max(0.08, 1 - rho * rho))
        dx, dy = x - cx, y - cy
        ca, sa = math.cos(th), math.sin(th)
        u = (dx * ca + dy * sa) / sq; v = -dx * sa + dy * ca
        d = np.sqrt(u * u + v * v) / rad
        cr += np.where(d < 1, -0.07 * (1 - d ** 2), 0) + 0.05 * np.exp(-((d - 1.0) / 0.12) ** 2) * (1 - 0.5 * np.sign(u))
    alb = alb + cr
    xt = TERM_K * np.sqrt(np.clip(1 - y * y, 0, 1))
    lit = np.clip((xt - x) / 0.07 + 0.5, 0, 1); lit = lit * lit * (3 - 2 * lit)
    shade = (0.80 + 0.20 * z) * alb
    edge = np.clip((1 - r) * n / 2 + 0.5, 0, 1)
    col = np.stack([shade * 236, shade * 237, shade * 240], -1)
    return np.dstack([col, (lit * edge)[..., None]]).astype(np.float32)
MOON_TEX = build_moon()

# ------------------------------------------------------------------ drawing per pattern
def poly(c, P):
    c.move_to(*P[0])
    for q in P[1:]: c.line_to(*q)

def draw_contours(c, g, zeta, px):
    vis = 1.0 / zeta * 1.05
    for P, idx in CONTOURS:
        if np.abs(P).min(0).max() > vis: continue
        c.set_line_width((1.9 if idx else 1.0) / px)
        poly(c, P); c.close_path(); c.stroke()
    g.set_line_width(3.0 / px); g.set_dash([7 / px, 7 / px]); poly(g, TRAIL); g.stroke(); g.set_dash([])

def draw_circuit(c, g, zeta, px):
    for P, hot in TRACES:
        tgt = g if hot else c
        tgt.set_line_width(2.4 / px); tgt.set_line_join(cairo.LINE_JOIN_ROUND); poly(tgt, P); tgt.stroke()
    for p, r in PADS:
        c.set_line_width(1.8 / px); c.arc(p[0], p[1], r, 0, 2 * math.pi); c.stroke()
        c.arc(p[0], p[1], r * 0.35, 0, 2 * math.pi); c.fill()
    for p, r in VIAS:
        c.arc(p[0], p[1], r, 0, 2 * math.pi); c.fill()
    for k in range(64):                       # pin ring around the core
        a = k / 64 * 2 * math.pi
        c.set_line_width(3.0 / px); c.move_to(math.cos(a) * 0.205, math.sin(a) * 0.205); c.line_to(math.cos(a) * 0.235, math.sin(a) * 0.235); c.stroke()

def draw_fern(c, g, zeta, px):
    for P, w, hot in FERN:
        tgt = g if hot else c
        tgt.set_line_width(max(w, 1.0 / px)); tgt.set_line_cap(cairo.LINE_CAP_ROUND); poly(tgt, P); tgt.stroke()

def draw_crystal(c, g, zeta, px):
    for p, q, w in CRYS:
        c.set_line_width(max(w, 1.0 / px)); c.set_line_cap(cairo.LINE_CAP_ROUND); c.move_to(*p); c.line_to(*q); c.stroke()
    for p, r in CHEX:
        g.set_line_width(2.2 / px)
        for k in range(7):
            a = k * math.pi / 3; (g.move_to if k == 0 else g.line_to)(p[0] + r * math.cos(a), p[1] + r * math.sin(a))
        g.stroke()
    c.set_line_width(2.4 / px)
    for k in range(7):
        a = k * math.pi / 3 - math.pi / 2; (c.move_to if k == 0 else c.line_to)(0.215 * math.cos(a), 0.215 * math.sin(a))
    c.stroke()

def lit_path(c):
    """lit part of the moon (left of the terminator ellipse)"""
    n = 60
    c.move_to(0, -1)
    for k in range(n + 1):
        a = -math.pi / 2 - k / n * math.pi; c.line_to(math.cos(a), math.sin(a))
    for k in range(n + 1):
        y = 1 - 2 * k / n; c.line_to(TERM_K * math.sqrt(max(0, 1 - y * y)), y)
    c.close_path()

def draw_moon(c, moonl, g, zeta, px, detail=1.0):
    if detail > 0.01:
        c.save(); lit_path(c); c.clip()
        for x, y, r in CRATERS:
            if r < 0.04: continue
            rho = math.hypot(x, y); sq = math.sqrt(max(0.05, 1 - rho * rho)); ang = math.atan2(y, x)
            c.save(); c.translate(x, y); c.rotate(ang); c.scale(sq, 1)
            c.set_source_rgba(0, 0, 0, 0.22 * detail); c.set_line_width(1.1 / px); c.arc(0, 0, r, 0, 2 * math.pi); c.stroke()
            c.restore()
        c.restore()
        c.save(); c.arc(0, 0, 1, 0, 2 * math.pi); c.clip()
        c.set_source_rgba(0, 0, 0, 0.13 * detail); c.set_line_width(1.0 / px)
        for k in range(-24, 25):
            y = k / 24.0; xt = TERM_K * math.sqrt(max(0, 1 - y * y))
            c.move_to(xt - 0.02, y); c.line_to(xt + 0.10, y + 0.02); c.stroke()
        c.restore()
    c.set_source_rgba(0, 0, 0, 0.30 * detail); c.set_line_width(1.2 / px); c.arc(0, 0, 1, 0, 2 * math.pi); c.stroke()

DRAW = [draw_contours, draw_circuit, draw_fern, draw_crystal]

# ------------------------------------------------------------------ scene
paper = Paper(seed=7)
SKY = np.array([124, 137, 158], np.float32)

def lens_geom(t):
    u = seg(t, T_SHRINK0, T_SHRINK1, io_quint)
    c = LC * (1 - u) + MOON_C * u
    r = lerp(LRI, MOON_R, u)
    return c, r, u

def tick_angle(t):
    a = 0.0
    for b in BEATS: a += 6.0 * out_back(seg(t, b - 0.04, b + 0.22, lambda v: v), 2.2)
    return a + 1.5 * t

def scene(t, fi):
    cen, r_in, u = lens_geom(t)
    lz = logz(t); z = math.exp(lz)
    bg, grain = paper.view(1.0 + 0.01 * t, *drift(t, 3, 31), 0)
    cool = seg(t, wt(79.2), N / FPS + NT / FPS, io_sine)
    bg = bg * (1 - 0.32 * cool) + (bg * SKY / PAPER) * 0.32 * cool
    lens_bg = bg * (CARD / PAPER) * (1 - 0.6 * u) + bg * 0.6 * u
    ink, grn, moonl, ring = Layer(), Layer(), Layer(), Layer()
    for L in (ink, grn, moonl):
        L.ctx.translate(*cen); L.ctx.arc(0, 0, r_in, 0, 2 * math.pi); L.ctx.clip()
    moon_px = 0
    for k in range(5):
        zeta = z / R ** k
        if zeta < 0.10 or zeta > R * 1.02: continue
        px = zeta * r_in
        fade = 1 - seg(zeta, 2.6, R, smooth) if k < 4 else 1.0
        if fade <= 0.01: continue
        for L in (ink, grn, moonl):
            c = L.ctx; c.save(); c.scale(px, px)
            c.arc(0, 0, 1.0, 0, 2 * math.pi)
            if k < 4: c.arc_negative(0, 0, 1 / R, 2 * math.pi, 0)
            c.clip()
            c.push_group()
        if k < 4: DRAW[k](ink.ctx, grn.ctx, zeta, px)
        else:
            draw_moon(ink.ctx, moonl.ctx, grn.ctx, zeta, px, 1 - u)
            moon_px = px
        # core ring that frames the next pattern
        if k < 4:
            ink.ctx.set_line_width(2.0 / px); ink.ctx.arc(0, 0, 1 / R, 0, 2 * math.pi); ink.ctx.stroke()
        for L in (ink, grn, moonl):
            c = L.ctx; c.pop_group_to_source(); c.paint_with_alpha(fade); c.restore()
    # bezel (fades as the lens shrinks onto the moon)
    rim_a = 1 - seg(t, T_SHRINK0 + 0.35, T_SHRINK1 - 0.05, smooth)
    sh = Layer()
    if rim_a > 0:
        c = ring.ctx; c.translate(*cen)
        w = lerp(30, 12, u)
        c.set_line_width(w); c.arc(0, 0, r_in + w / 2, 0, 2 * math.pi); c.stroke()
        c.set_line_width(1.4); c.arc(0, 0, r_in + w + 9, 0, 2 * math.pi); c.stroke()
        ta = math.radians(tick_angle(t))
        for k in range(120):
            a = ta + k / 120 * 2 * math.pi; L = 14 if k % 10 == 0 else 7
            c.set_line_width(1.6 if k % 10 == 0 else 1.0)
            c.move_to(math.cos(a) * (r_in + w + 11), math.sin(a) * (r_in + w + 11))
            c.line_to(math.cos(a) * (r_in + w + 11 + L * (1 - 0.5 * u)), math.sin(a) * (r_in + w + 11 + L * (1 - 0.5 * u))); c.stroke()
        s = sh.ctx; s.arc(cen[0] + 8, cen[1] + 18, r_in + 30, 0, 2 * math.pi); s.fill()
    # composite
    yy, xx = np.ogrid[0:H, 0:W]
    rr = np.sqrt((xx - cen[0]) ** 2 + (yy - cen[1]) ** 2).astype(np.float32)
    lens_m = np.clip(r_in - rr + 0.5, 0, 1)
    img = multiply(bg, cv2.GaussianBlur(sh.alpha(), (0, 0), 22) * rim_a, np.array([60, 45, 30], np.float32), 0.5)
    lb = lens_bg * (1 - 0.14 * np.clip((rr / r_in - 0.80) / 0.2, 0, 1) ** 2 * rim_a)[..., None]
    img = img * (1 - lens_m[..., None]) + lb * lens_m[..., None]
    if moon_px > 2:
        n = MOON_TEX.shape[0]; sc = 2 * moon_px / n
        M = np.float32([[sc, 0, cen[0] - moon_px], [0, sc, cen[1] - moon_px]])
        mt = cv2.warpAffine(MOON_TEX, M, (W, H), flags=cv2.INTER_AREA if sc < 1 else cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
        ma = mt[..., 3] * lens_m
        img = img * (1 - ma[..., None]) + mt[..., :3] * ma[..., None]
    img = over(img, ink_alpha(ink.alpha(), grain, dry=0.15), INK, 0.92 + 0.16 * grain)
    ga = grn.alpha()
    img = over(img, cv2.GaussianBlur(ga, (0, 0), 3) * 0.3, GREEN)
    img = over(img, ga, GREEN)
    img = over(img, ink_alpha(ring.alpha() * rim_a, grain), INK, 0.92 + 0.16 * grain)
    img = img * vignette(0.15)
    return film_grain(img, fi * 19 + int(t * 1000) % 5, 1.6)

# ------------------------------------------------------------------ F hand-off frames
def transition(outdir, sub=6):
    """first NT frames of F: radial dissolve from the moon outwards (E look -> real footage)"""
    V = os.environ["SRC"]
    os.makedirs(outdir, exist_ok=True)
    import subprocess
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", V, "-vf", f"select='between(n\\,1926\\,{1925 + NT})',scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24",
                          "-fps_mode", "passthrough", "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    F = np.frombuffer(raw, np.uint8).reshape(NT, H, W, 3).astype(np.float32)
    yy, xx = np.ogrid[0:H, 0:W]
    rr = np.sqrt((xx - MOON_C[0]) ** 2 + (yy - MOON_C[1]) ** 2).astype(np.float32)
    for j in range(NT):
        acc = None
        for k in range(sub):
            tt = (N + j + (k / (sub - 1) - 0.5) * 0.5 if sub > 1 else N + j) / FPS
            im = scene(tt, N + j); acc = im if acc is None else acc + im
        e = acc / sub
        Rj = lerp(110, 1450, io_cubic((j + 1) / NT))
        a = np.clip((Rj - rr) / 170 + 0.5, 0, 1)
        a = a * a * (3 - 2 * a)
        a = np.maximum(a, 0.35 * io_sine((j + 1) / NT))     # gentle overall crossfade under the radial reveal
        if j == NT - 1: a[:] = 1.0
        out = e * (1 - a[..., None]) + F[j] * a[..., None]
        cv2.imwrite(os.path.join(outdir, f"{j:04d}.png"), cv2.cvtColor(to8(out), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_PNG_COMPRESSION, 1])

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1].startswith("trans"):
        transition(os.path.join(SCR, "renders", "F_" + sys.argv[1]), sub=2 if sys.argv[1] == "trans_preview" else 6)
    else:
        main(scene, N, "E")
