"""B - paper tree (frames 326..496, 171 frames, 13.639-20.771 s).
Ink drop splashes into a root, pen-drawn branches grow; the three main limbs bloom on the spoken words
(bar chart / sum-integral proof / contract page); then a wave of hundreds of cross-reference hairlines."""
import sys, os, math
import numpy as np, cv2, cairo
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

N = 171
A0 = 13.639                                   # audio time of local t=0
def wt(x): return x - A0                      # audio time -> local time
T_FIN, T_MODEL = wt(14.65), wt(15.10)
T_MATH, T_PROOF = wt(16.42), wt(17.01)
T_CONTRACT = wt(18.18)
T_HUNDREDS, T_XREF, T_XEND = wt(18.95), wt(19.40), wt(20.49)
T_IMPACT = 0.42

rng = np.random.RandomState(11)

# ------------------------------------------------------------------ tree model
class Br:
    def __init__(s, p0, p1, c1, c2, w0, w1, t0, dur, depth, limb):
        s.P = [np.array(p0), np.array(c1), np.array(c2), np.array(p1)]
        s.w0, s.w1, s.t0, s.dur, s.depth, s.limb = w0, w1, t0, dur, depth, limb
        s.seed = rng.randint(1 << 30)
        u = np.linspace(0, 1, 28)[:, None]
        P = s.P
        s.pts = ((1 - u) ** 3) * P[0] + 3 * ((1 - u) ** 2) * u * P[1] + 3 * (1 - u) * u * u * P[2] + u ** 3 * P[3]
        d = np.gradient(s.pts, axis=0); s.nrm = np.stack([-d[:, 1], d[:, 0]], 1) / (np.linalg.norm(d, axis=1)[:, None] + 1e-9)
        r = np.random.RandomState(s.seed)
        s.press = 1 + 0.16 * np.sin(np.linspace(0, 1, 28) * (3 + r.rand() * 4) + r.rand() * 6) + 0.05 * r.randn(28)
        s.wob = 0.45 * np.convolve(r.randn(32), np.ones(5) / 5, "same")[2:30]
    def growth(s, t): return out_cubic((t - s.t0) / s.dur) if s.dur > 0 else float(t >= s.t0)

branches, nodes, leaves = [], [], []   # nodes: (x, y, r, t_appear, limb); leaves: (x, y, r, t, limb, family)
P0 = np.array([960.0, 968.0])
TRUNK_TOP = np.array([960.0, 805.0])
DOME_R = 700.0

def bez(p0, ang, length, bend):
    p1 = p0 + length * np.array([math.cos(ang), math.sin(ang)])
    n = np.array([-math.sin(ang), math.cos(ang)])
    c1 = p0 + (p1 - p0) * 0.33 + n * bend * length
    c2 = p0 + (p1 - p0) * 0.66 + n * bend * length * 0.6
    return p1, c1, c2

def inside(p): return np.linalg.norm(p - TRUNK_TOP) < DOME_R and 70 < p[1] < TRUNK_TOP[1] - 30 and 110 < p[0] < 1810

def grow(p0, ang, length, w, depth, t0, limb, fam, speed=900.0):
    bend = rng.uniform(-0.12, 0.12)
    p1, c1, c2 = bez(p0, ang, length, bend)
    if not inside(p1):
        length *= 0.6; p1, c1, c2 = bez(p0, ang, length, bend)
        if not inside(p1): return False
    dur = max(0.16, length / speed)
    branches.append(Br(p0, p1, c1, c2, w, w * 0.62, t0, dur, depth, limb))
    tend = t0 + dur * 0.8
    if depth >= 6 or length < 24:
        leaves.append((p1[0], p1[1], rng.uniform(2.6, 4.0), tend, limb, fam)); return True
    k = 2 if depth < 3 else rng.choice([2, 2, 3])
    spread = rng.uniform(0.40, 0.60)
    radial = math.atan2(p1[1] - TRUNK_TOP[1], p1[0] - TRUNK_TOP[0])
    made = 0
    for j in range(k):
        a = ang + (j - (k - 1) / 2) * spread * (1.0 if k == 2 else 0.8) + rng.uniform(-0.12, 0.12)
        da = (radial - a + math.pi) % (2 * math.pi) - math.pi
        a = a + 0.30 * da                                   # fan out along the dome
        made += grow(p1, a, length * rng.uniform(0.68, 0.80), w * 0.72, depth + 1, tend + rng.uniform(0.0, 0.10), limb, fam, speed * 0.95)
    if made: nodes.append((p1[0], p1[1], max(2.8, w * 1.1), tend, limb))
    else: leaves.append((p1[0], p1[1], rng.uniform(2.6, 4.0), tend, limb, fam))
    return True

# trunk + thin horizontal roots
trunk = Br(P0, TRUNK_TOP, P0 + [5, -60], TRUNK_TOP + [-7, 50], 11.0, 8.5, 0.52, 0.40, 0, -1); branches.append(trunk)
for ang, L, t0, bend in [(2.80, 105, 0.50, -0.18), (3.02, 70, 0.58, -0.10), (0.34, 112, 0.53, 0.18), (0.12, 66, 0.62, 0.10), (1.75, 40, 0.56, 0.0)]:
    p1, c1, c2 = bez(P0, ang, L, bend)
    branches.append(Br(P0, p1, c1, c2, 4.2, 0.6, t0, 0.42, 3, -1))
nodes.append((TRUNK_TOP[0], TRUNK_TOP[1], 9.0, 0.92, -1))

LIMBS = [  # (tip, grow start, grow dur, bloom start)
    (np.array([505.0, 585.0]), 0.78, 0.42, T_FIN + 0.02),
    (np.array([960.0, 395.0]), T_FIN + 0.55, 0.55, T_MATH - 0.02),
    (np.array([1415.0, 585.0]), T_PROOF + 0.45, 0.55, T_CONTRACT - 0.06),
]
fam_id = 0
for li, (tip, t0, dur, tb) in enumerate(LIMBS):
    d = tip - TRUNK_TOP; L = np.linalg.norm(d)
    c1 = TRUNK_TOP + np.array([0, -L * (0.25 if li == 1 else 0.45)])
    c2 = tip - d * 0.30 + (np.array([0, 25]) if li != 1 else 0)
    b = Br(TRUNK_TOP, tip, c1, c2, 8.5, 4.2, t0, dur, 1, li); branches.append(b)
    for k, u in enumerate([0.30, 0.52, 0.72, 0.90]):
        P = b.P
        p = ((1 - u) ** 3) * P[0] + 3 * ((1 - u) ** 2) * u * P[1] + 3 * (1 - u) * u * u * P[2] + u ** 3 * P[3]
        tan = 3 * (1 - u) ** 2 * (P[1] - P[0]) + 6 * (1 - u) * u * (P[2] - P[1]) + 3 * u * u * (P[3] - P[2])
        ta = math.atan2(tan[1], tan[0])
        ts = t0 + dur * out_cubic(u) * 0.9
        radial = math.atan2(p[1] - TRUNK_TOP[1], p[0] - TRUNK_TOP[0])
        for side in (-1, 1):
            a = ta + side * rng.uniform(0.50, 0.80)
            da = (radial - a + math.pi) % (2 * math.pi) - math.pi; a += 0.35 * da
            grow(p, a, rng.uniform(150, 205) * (1.1 - u * 0.35), 4.8 - u * 1.4, 2, ts + rng.uniform(0.03, 0.16), li, fam_id, 820)
            fam_id += 1
        nodes.append((p[0], p[1], 5.0, ts, li))
# fill shoots between the limbs, straight from the fork
for li, a, ts in [(0, -2.25, T_MATH - 0.3), (2, -0.89, T_CONTRACT + 0.1)]:
    grow(TRUNK_TOP + [0, -6], a, 210, 5.0, 2, ts, li, fam_id, 820); fam_id += 1
LEAVES = np.array([(x, y) for x, y, *_ in leaves])
print("branches", len(branches), "nodes", len(nodes), "leaves", len(leaves), file=sys.stderr)

# cross references: short links between neighbouring families + long arcs between limbs; all bow outward
xrefs = []
Lnp = np.array([(x, y, lim, fam) for x, y, r, t, lim, fam in leaves])
seen = set()
for i, (x, y, lim, fam) in enumerate(Lnp):
    d = np.hypot(Lnp[:, 0] - x, Lnp[:, 1] - y)
    picks = []
    c = np.where((d > 45) & (d < 240) & (Lnp[:, 3] != fam))[0]
    if len(c): picks.append(rng.choice(c[np.argsort(d[c])][:6]))
    if rng.rand() < 0.28:
        c = np.where((d > 330) & (d < 900) & (Lnp[:, 2] != lim))[0]
        if len(c): picks.append(rng.choice(c))
    for j in picks:
        key = (min(i, j), max(i, j))
        if key in seen: continue
        seen.add(key)
        (x1, y1) = Lnp[j, :2]; mx, my = (x + x1) / 2, (y + y1) / 2
        nx, ny = -(y1 - y), (x1 - x)
        outward = (mx + nx * .1 - TRUNK_TOP[0]) ** 2 + (my + ny * .1 - TRUNK_TOP[1]) ** 2 > (mx - TRUNK_TOP[0]) ** 2 + (my - TRUNK_TOP[1]) ** 2
        long_ = d[j] >= 300
        if outward == long_: nx, ny = -nx, -ny          # short links bow out, long chords bow in
        bow = 0.10 if long_ else 0.15
        ang = math.atan2(my - TRUNK_TOP[1], mx - TRUNK_TOP[0])        # -pi (left) .. 0 (right)
        sweep = clamp01((ang + math.pi) / math.pi)
        t0 = T_HUNDREDS + 0.08 + 1.05 * sweep + rng.uniform(-0.05, 0.05)
        xrefs.append((i, j, t0, nx * bow, ny * bow, long_))
print("xrefs", len(xrefs), file=sys.stderr)
ARRIVE = {}
for i, j, t0, *_ in xrefs: ARRIVE.setdefault(j, []).append(t0)

# ------------------------------------------------------------------ drawing helpers
def draw_branch(c, b, t):
    g = b.growth(t)
    if g <= 0: return
    n = max(2, int(math.ceil(g * 27)) + 1)
    u = np.linspace(0, g, n)
    idx = u * 27
    i0 = np.floor(idx).astype(int).clip(0, 27); i1 = (i0 + 1).clip(0, 27); f = (idx - i0)[:, None]
    pts = b.pts[i0] * (1 - f) + b.pts[i1] * f
    nrm = b.nrm[i0] * (1 - f) + b.nrm[i1] * f
    press = b.press[i0] * (1 - f[:, 0]) + b.press[i1] * f[:, 0]
    wob = b.wob[i0] * (1 - f[:, 0]) + b.wob[i1] * f[:, 0]
    w = (b.w0 + (b.w1 - b.w0) * u) * press
    w = w * (0.55 + 0.45 * np.clip((g - u) / 0.08 + 0.3, 0, 1))       # tapered growing tip
    pts = pts + nrm * wob[:, None]
    L = pts + nrm * (w / 2)[:, None]; R = pts - nrm * (w / 2)[:, None]
    c.move_to(*L[0])
    for p in L[1:]: c.line_to(*p)
    for p in R[::-1]: c.line_to(*p)
    c.close_path(); c.fill()
    c.arc(pts[0][0], pts[0][1], w[0] / 2, 0, 2 * math.pi); c.fill()
    c.arc(pts[-1][0], pts[-1][1], w[-1] / 2, 0, 2 * math.pi); c.fill()

def blob(c, x, y, r, seed, spikes=0.0, n=48):
    rr = np.random.RandomState(seed); ph = rr.rand(4) * 6.28
    for k in range(n + 1):
        a = k / n * 2 * math.pi
        d = r * (1 + 0.07 * math.sin(3 * a + ph[0]) + 0.05 * math.sin(5 * a + ph[1]) + 0.03 * math.sin(9 * a + ph[2]))
        if spikes: d *= 1 + spikes * max(0, math.sin(7 * a + ph[3])) ** 6
        (c.move_to if k == 0 else c.line_to)(x + d * math.cos(a), y + d * math.sin(a))
    c.close_path(); c.fill()

SPLASH = [(rng.uniform(-math.pi * 0.95, -math.pi * 0.05) if k % 3 else rng.uniform(0, math.pi),
           rng.uniform(34, 120), rng.uniform(1.4, 4.2)) for k in range(14)]

def draw_drop(c, t):
    if t < T_IMPACT:                       # falling teardrop, stretched by speed
        u = t / T_IMPACT
        y = -120 + (P0[1] + 120) * in_quad(u)
        st = 1 + 0.9 * u
        c.save(); c.translate(P0[0], y); c.scale(1 / math.sqrt(st), st)
        c.move_to(0, -26); c.curve_to(6, -14, 15, -2, 15, 6); c.arc(0, 6, 15, 0, math.pi); c.curve_to(-15, -2, -6, -14, 0, -26)
        c.fill(); c.restore()
        return
    st = t - T_IMPACT
    r = 30 * out_expo(st / 0.35)
    blob(c, P0[0], P0[1], r, 3, spikes=0.5 * (1 - seg(st, 0.0, 0.6)))
    for k, (a, dist, sz) in enumerate(SPLASH):
        p = out_cubic(st / 0.32)
        x = P0[0] + math.cos(a) * dist * p * (0.4 + 0.6 * (r / 30))
        y = P0[1] + math.sin(a) * dist * p * 0.7
        stretch = 1 + 2.5 * (1 - p)
        c.save(); c.translate(x, y); c.rotate(a); c.scale(stretch, 1 / math.sqrt(stretch))
        c.arc(0, 0, sz * (0.6 + 0.4 * p), 0, 2 * math.pi); c.fill(); c.restore()

def dot(c, x, y, r):
    c.arc(x, y, r, 0, 2 * math.pi); c.fill()

# ---- bloom contents (drawn in a local frame centred on the tip, radius RB)
RB = 112
def bloom_prog(t, tb): return t - tb

def draw_chart(ink, grn, t):
    hs = [0.34, 0.52, 0.44, 0.70, 0.92]
    ax = seg(t, 0.15, 0.45, io_cubic)
    ink.set_line_width(2.6); ink.set_line_cap(cairo.LINE_CAP_ROUND)
    if ax > 0:
        ink.move_to(-52, -52 + 104 * 0); ink.line_to(-52, -52 + 104 * min(1, ax * 2))
        if ax > 0.5: ink.line_to(-52 + 108 * (ax - 0.5) * 2, 52)
        ink.stroke()
    pts = []
    for k, h in enumerate(hs):
        g = out_back(seg(t, 0.35 + k * 0.08, 0.35 + k * 0.08 + 0.35, lambda v: v), 1.4)
        x = -40 + k * 19; hh = 92 * h * g
        if hh > 0.5:
            cx = grn if k == 4 else ink
            cx.rectangle(x, 50 - hh, 13, hh); cx.fill()
        pts.append((x + 6.5, 50 - 92 * h - 12))
    tl = seg(t, 0.95, 1.45, io_cubic)
    if tl > 0:
        ink.set_line_width(1.8); n = tl * (len(pts) - 1)
        ink.move_to(*pts[0])
        for k in range(1, len(pts)):
            if k <= n: ink.line_to(*pts[k])
            else:
                f = n - (k - 1); ink.line_to(pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f); break
        ink.stroke()
        for k in range(len(pts)):
            if k <= n: dot(ink, pts[k][0], pts[k][1], 3.2)

def wipe_text(ctx, txt, x, y, family, size, prog, slant=cairo.FONT_SLANT_NORMAL):
    if prog <= 0: return
    ctx.save()
    ctx.select_font_face(family, slant, cairo.FONT_WEIGHT_NORMAL); ctx.set_font_size(size)
    e = ctx.text_extents(txt)
    ctx.rectangle(x + e.x_bearing - 4, y + e.y_bearing - 6, (e.width + 8) * prog, e.height + 12); ctx.clip()
    ctx.move_to(x, y); ctx.show_text(txt); ctx.restore()

def draw_math(ink, grn, t):
    wipe_text(ink, "∑", -66, 22, "DejaVu Serif", 74, seg(t, 0.15, 0.55, io_cubic))
    wipe_text(ink, "∫", 4, 30, "DejaVu Serif", 92, seg(t, 0.42, 0.80, io_cubic))
    wipe_text(ink, "n", -54, 50, "DejaVu Serif", 20, seg(t, 0.5, 0.65, io_cubic), cairo.FONT_SLANT_ITALIC)
    wipe_text(ink, "dx", 34, 14, "DejaVu Serif", 26, seg(t, 0.75, 0.95, io_cubic), cairo.FONT_SLANT_ITALIC)
    u = seg(t, 0.95, 1.25, io_cubic)
    if u > 0:
        ink.set_line_width(2); ink.move_to(-60, 66); ink.line_to(-60 + 92 * u, 66); ink.stroke()
    q = out_back(seg(t, 1.15, 1.45, lambda v: v), 2.0)
    if q > 0:
        grn.rectangle(44 - 9 * q, 66 - 9 * q, 18 * q, 18 * q); grn.fill()

def draw_contract(ink, grn, t):
    pw, ph, fold = 92, 118, 20
    x0, y0 = -pw / 2, -ph / 2 - 4
    o = seg(t, 0.10, 0.50, io_cubic)
    if o > 0:
        path = [(x0, y0), (x0 + pw - fold, y0), (x0 + pw, y0 + fold), (x0 + pw, y0 + ph), (x0, y0 + ph), (x0, y0)]
        segl = [math.dist(path[k], path[k + 1]) for k in range(5)]; tot = sum(segl) * o
        ink.set_line_width(2.2); ink.set_line_join(cairo.LINE_JOIN_ROUND); ink.move_to(*path[0])
        for k in range(5):
            if tot >= segl[k]: ink.line_to(*path[k + 1]); tot -= segl[k]
            else:
                f = tot / segl[k]; ink.line_to(path[k][0] + (path[k + 1][0] - path[k][0]) * f, path[k][1] + (path[k + 1][1] - path[k][1]) * f); break
        ink.stroke()
        if o > 0.6:
            ink.set_line_width(1.6); ink.move_to(x0 + pw - fold, y0); ink.line_to(x0 + pw - fold, y0 + fold); ink.line_to(x0 + pw, y0 + fold); ink.stroke()
    wipe_text(ink, "§", x0 + 9, y0 + 26, "DejaVu Serif", 20, seg(t, 0.40, 0.55, io_cubic))
    lens = [52, 64, 70, 58, 66, 40]
    for k, ln in enumerate(lens):
        u = seg(t, 0.45 + k * 0.07, 0.45 + k * 0.07 + 0.18, out_cubic)
        if u > 0:
            ink.set_line_width(2.2); ink.set_line_cap(cairo.LINE_CAP_ROUND)
            xs = x0 + (24 if k == 0 else 10); ink.move_to(xs, y0 + 22 + k * 12); ink.line_to(xs + (ln - (14 if k == 0 else 0)) * u, y0 + 22 + k * 12); ink.stroke()
    s = seg(t, 0.95, 1.35, io_cubic)
    if s > 0:
        ink.set_line_width(1.8); n = int(40 * s) + 1
        for k in range(n):
            u = k / 40; x = x0 + 12 + 50 * u; y = y0 + ph - 18 + 7 * math.sin(u * 14) * (1 - u * 0.5) - 6 * u
            (ink.move_to if k == 0 else ink.line_to)(x, y)
        ink.stroke()
    q = out_back(seg(t, 1.25, 1.55, lambda v: v), 2.2)
    if q > 0: dot(grn, x0 + pw - 16, y0 + ph - 16, 10 * q)

BLOOMS = [draw_chart, draw_math, draw_contract]

# ------------------------------------------------------------------ camera + scene
paper = Paper(seed=7)

def camera(t):
    u = io_sine(t / (N / FPS))
    s = 1.0 + 0.10 * u
    cx = 960 + drift(t, 5, 1)[0]; cy = 655 - 80 * io_sine(t / 5.0) + drift(t, 4, 2)[1]
    return (s, cx, cy, -0.35 + 0.6 * u)

def paper_view(cam):
    s, cx, cy, rot = cam
    a = math.radians(rot); R = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
    d = R @ (s * np.array([W / 2 - cx, H / 2 - cy]))
    return paper.view(s, d[0], d[1], -rot)

def scene(t, fi):
    cam = camera(t)
    bg, grain = paper_view(cam)
    back, card, front, gback, gfront, shad = Layer(), Layer(), Layer(), Layer(), Layer(), Layer()
    for L in (back, card, front, gback, gfront, shad): set_cam(L.ctx, cam)
    c = back.ctx
    # drop shadow as it falls
    if t < T_IMPACT:
        u = t / T_IMPACT
        shad.ctx.save(); shad.ctx.translate(P0[0], P0[1] + 4); shad.ctx.scale(1, 0.35)
        shad.ctx.arc(0, 0, 10 + 18 * (1 - u), 0, 2 * math.pi); shad.ctx.set_source_rgba(0, 0, 0, 0.6 * u ** 2); shad.ctx.fill(); shad.ctx.restore()
    draw_drop(c, t)
    for b in branches: draw_branch(c, b, t)
    for x, y, r, ta, lim in nodes:
        p = out_back(seg(t, ta, ta + 0.28, lambda v: v), 2.4)
        if p > 0: dot(c, x, y, r * p)
    # cross references (wave): hairline grows, starts green, cools to ink
    if t > T_HUNDREDS - 0.1:
        for i, j, t0, bx_, by_, long_ in xrefs:
            g = seg(t, t0, t0 + 0.40, out_cubic)
            if g <= 0: continue
            (x0, y0), (x1, y1) = LEAVES[i], LEAVES[j]
            cxp, cyp = (x0 + x1) / 2 + bx_, (y0 + y1) / 2 + by_
            cool = seg(t, t0 + 0.15, t0 + 0.50, io_sine)
            for ctx, al, lw in ((back.ctx, (0.30 if long_ else 0.52) * cool, 0.85 if long_ else 1.05), (gback.ctx, (0.75 if long_ else 1.0) * (1 - cool), 1.3)):
                if al <= 0.01: continue
                ctx.set_line_width(lw); ctx.set_source_rgba(0, 0, 0, al)
                ctx.move_to(x0, y0)
                steps = 16; k1 = max(1, int(math.ceil(steps * g)))
                for k in range(1, k1 + 1):
                    u = min(g, k / steps)
                    ctx.line_to((1 - u) ** 2 * x0 + 2 * (1 - u) * u * cxp + u * u * x1, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cyp + u * u * y1)
                ctx.stroke()
    for k, (x, y, r, ta, lim, fam) in enumerate(leaves):
        p = out_back(seg(t, ta, ta + 0.25, lambda v: v), 2.0)
        if p <= 0: continue
        hit = max([seg(t, t0 + 0.38, t0 + 0.48, smooth) * (1 - seg(t, t0 + 0.48, t0 + 0.75, smooth)) for t0 in ARRIVE.get(k, ())] + [0])
        dot(c, x, y, r * p * (1 + 0.6 * hit))
        if hit > 0.05: dot(gback.ctx, x, y, r * p * (1 + 0.6 * hit) * hit)
    # blooms on the limb tips
    for li, (tip, t0, dur, tb) in enumerate(LIMBS):
        bt = t - tb
        if bt <= 0: continue
        s = out_back(seg(bt, 0.0, 0.42, lambda v: v), 1.6)
        bob = math.sin((t - tb) * 1.6 + li) * 2.0
        for ctx in (card.ctx, front.ctx, gfront.ctx, shad.ctx):
            ctx.save(); ctx.translate(tip[0], tip[1] - 6 * s + bob); ctx.scale(s, s)
        card.ctx.arc(0, 0, RB, 0, 2 * math.pi); card.ctx.fill()
        shad.ctx.arc(4, 10, RB, 0, 2 * math.pi); shad.ctx.set_source_rgba(0, 0, 0, 0.55); shad.ctx.fill()
        ring = seg(bt, 0.05, 0.50, io_cubic)
        f = front.ctx
        f.set_line_width(3.2); f.arc(0, 0, RB, -math.pi / 2, -math.pi / 2 + 2 * math.pi * ring); f.stroke()
        f.set_line_width(1.0)
        if ring > 0.3:
            f.arc(0, 0, RB - 7, -math.pi / 2, -math.pi / 2 + 2 * math.pi * seg(ring, 0.3, 1.0)); f.stroke()
        f.save(); gfront.ctx.save(); f.scale(RB / 96, RB / 96); gfront.ctx.scale(RB / 96, RB / 96)
        BLOOMS[li](f, gfront.ctx, bt)
        f.restore(); gfront.ctx.restore()
        for ctx in (card.ctx, front.ctx, gfront.ctx, shad.ctx): ctx.restore()
    # ---------------- composite
    img = bg
    ia = ink_alpha(back.alpha(), grain)
    img = over(img, ia, INK, 0.92 + 0.16 * grain)
    img = over(img, ink_alpha(gback.alpha(), grain, dry=0.1, bleed=0.2), GREEN)
    sa = shad.alpha()
    if sa.max() > 0: img = multiply(img, cv2.GaussianBlur(sa, (0, 0), 14), np.array([60, 45, 30], np.float32), 0.55)
    ca = card.alpha()
    if ca.max() > 0: img = over(img, ca, CARD, 0.97 + 0.06 * grain)
    img = over(img, ink_alpha(front.alpha(), grain), INK, 0.92 + 0.16 * grain)
    img = over(img, ink_alpha(gfront.alpha(), grain, dry=0.1, bleed=0.2), GREEN)
    img = img * vignette(0.16)
    return film_grain(img, fi * 7 + int(t * 1000) % 7, 1.6)

if __name__ == "__main__":
    main(scene, N, "B")
