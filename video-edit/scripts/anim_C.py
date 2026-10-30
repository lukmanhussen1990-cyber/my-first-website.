"""C - code lens (frames 762..908, 147 frames, 31.823-37.955 s).
Ball swings on a chain, settles and opens into a magnifier over a code minimap. 'code review': scan line
snaps messy rows neat + green review dots. 'performance work': flame graph collapses (412 ms -> 38 ms).
'features that cut across': green thread through three files. 'entire code base': lens opens, camera
pulls back over hundreds of files linked by green lines."""
import sys, os, math
import numpy as np, cv2, cairo
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

N = 147
A0 = 31.823
def wt(x): return x - A0
T_REVIEW, T_PERF, T_FEAT, T_CUT, T_ENTIRE, T_BASE = wt(32.40), wt(33.45), wt(34.84), wt(35.38), wt(36.02), wt(36.66)
LC = np.array([960.0, 545.0])            # lens centre (screen)
LR = 330.0                               # lens radius (screen)
FW, FH, GX, GY = 420.0, 560.0, 520.0, 690.0   # file card size and grid pitch (world)
ROWS, RH = 22, 22.0

rng = np.random.RandomState(5)
NAMES = ["auth.py", "router.ts", "cache.go", "db.rs", "api.py", "index.ts", "queue.go", "user.rs", "jobs.py",
         "parse.ts", "lock.go", "sched.py", "http.rs", "store.ts", "graph.py", "build.go"]

def make_file(seed):
    r = np.random.RandomState(seed); rows = []; ind = 0
    for k in range(ROWS):
        if r.rand() < 0.10: rows.append((ind, [])); continue
        ind = int(np.clip(ind + r.choice([-1, 0, 0, 1]), 0, 4))
        toks = []; x = 0
        for _ in range(r.randint(2, 8)):
            L = r.choice([18, 26, 34, 46, 60, 78, 96]) * r.uniform(0.8, 1.15)
            if x + L > FW - 70 - ind * 24: break
            toks.append((x, L, 0.42 if r.rand() < 0.22 else 1.0)); x += L + 9
        rows.append((ind, toks))
    return rows

GRID = {}
for gy in range(-11, 12):
    for gx in range(-17, 18):
        GRID[(gx, gy)] = make_file(100000 + gx * 97 + gy * 13)
MESS = [(rng.uniform(-46, 46), rng.uniform(-7, 7), rng.uniform(-4.5, 4.5)) for _ in range(ROWS)]
REVIEW_DOTS = set(rng.choice(range(2, ROWS - 2), 6, replace=False).tolist())

# network of links across the code base: wave from the centre outwards
LINKS = []
def dist(c): return math.hypot(c[0] * GX, c[1] * GY) / GX
linked = {(0, 0): T_ENTIRE + 0.10}
order = sorted([k for k in GRID if k != (0, 0)], key=lambda c: dist(c) + rng.uniform(0, 0.6))
for c in order:
    if dist(c) > 15 or rng.rand() > 0.80: continue
    par = [n for n in linked if 0 < abs(n[0] - c[0]) + abs(n[1] - c[1]) <= 2 and dist(n) < dist(c)]
    if not par: continue
    p = par[rng.randint(len(par))]
    t0 = max(linked[p] + 0.06, T_ENTIRE + 0.15 + dist(c) * 0.10 + rng.uniform(0, 0.08))
    linked[c] = t0 + 0.22
    LINKS.append((p, c, t0, rng.uniform(-0.12, 0.12)))
for c in rng.permutation(len(order))[:70]:          # a few cross links between branches
    a = order[c]
    if a in linked:
        b = (a[0] + rng.choice([-2, 2]), a[1] + rng.choice([-1, 1]))
        if b in linked: LINKS.append((a, b, max(linked[a], linked[b]) + 0.05, rng.uniform(-0.25, 0.25)))
DOTS_AT = {}
for a, b, t0, _ in LINKS: DOTS_AT[b] = min(DOTS_AT.get(b, 99), t0 + 0.32)

# ------------------------------------------------------------------ timeline helpers
def pendulum(t):
    return 0.36 * math.exp(-1.7 * t) * math.cos(2 * math.pi * 0.92 * t)

def lens_open(t): return seg(t, 0.52, 1.00, io_cubic)          # ball -> lens
def rim_open(t): return seg(t, T_ENTIRE - 0.05, T_ENTIRE + 0.75, in_cubic)  # lens opens to reveal the grid

def world_scale(t):
    s0, s1, s2 = 1.45, 0.60, 0.17
    a = seg(t, T_FEAT - 0.12, T_CUT - 0.05, io_cubic)
    b = seg(t, T_ENTIRE - 0.15, N / FPS, io_sine)
    return math.exp(math.log(s0) * (1 - a) + math.log(s1) * a) ** (1 - b) * s2 ** b if b > 0 else math.exp(math.log(s0) * (1 - a) + math.log(s1) * a)

def world_center(t):
    # in file-0 coords (card centred at 0,0); start looking at the upper part of the file
    u = seg(t, T_FEAT - 0.12, T_CUT, io_cubic)
    y = lerp(-55.0, 0.0, u); x = lerp(-12.0, 0.0, u)
    dx, dy = drift(t, 6, 4)
    return x + dx / world_scale(t), y + dy / world_scale(t)

# ------------------------------------------------------------------ drawing
def rrect(c, x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    c.new_sub_path(); c.arc(x + w - r, y + r, r, -math.pi / 2, 0); c.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    c.arc(x + r, y + h - r, r, math.pi / 2, math.pi); c.arc(x + r, y + r, r, math.pi, 1.5 * math.pi); c.close_path()

def row_state(t, k):
    """0 = messy, 1 = neat for file-0 row k (snaps as the scan line passes)"""
    ys = scan_y(t)
    ry = -FH / 2 + 56 + k * RH
    return out_back(seg(t, scan_time(ry), scan_time(ry) + 0.32, lambda v: v), 1.8)

SCAN0, SCAN1 = T_REVIEW + 0.22, T_REVIEW + 1.12
def scan_y(t):  return lerp(-FH / 2 + 30, FH / 2 - 40, seg(t, SCAN0, SCAN1, io_sine))
def scan_time(ry):
    u = clamp01((ry - (-FH / 2 + 30)) / (FH - 70))
    # invert io_sine
    return SCAN0 + (SCAN1 - SCAN0) * (math.acos(1 - 2 * u) / math.pi)

def draw_file(card, ink, faint, grn, gx, gy, t, sc):
    rows = GRID[(gx, gy)]
    x0, y0 = gx * GX - FW / 2, gy * GY - FH / 2
    rrect(card, x0, y0, FW, FH, 14); card.fill()
    px = sc  # screen px per world unit
    tab = 34
    if px * RH > 2.6:
        faint.rectangle(x0, y0 + tab, FW, 1.2); faint.fill()
        if px > 0.33:
            ink.select_font_face("JetBrains Mono", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL); ink.set_font_size(17)
            ink.move_to(x0 + 18, y0 + 24); ink.show_text(NAMES[(gx * 7 + gy * 3) % len(NAMES)])
        else:
            rrect(ink, x0 + 18, y0 + 12, 70, 10, 3); ink.fill()
        for k, (ind, toks) in enumerate(rows):
            ry = y0 + 56 + k * RH
            mess = (0, 0, 0)
            if (gx, gy) == (0, 0):
                s = row_state(t, k); m = MESS[k]; mess = (m[0] * (1 - s), m[1] * (1 - s), m[2] * (1 - s))
            if px * RH > 9:
                ink.save(); faint.save()
                for ctx_ in (ink, faint):
                    ctx_.translate(x0 + 40 + ind * 24 + mess[0], ry + mess[1]); ctx_.rotate(math.radians(mess[2]))
                for (tx, L, a) in toks:
                    tgt = ink if a > 0.5 else faint
                    rrect(tgt, tx, -4.5, L, 9, 4.5); tgt.fill()
                ink.restore(); faint.restore()
                if px > 0.5:
                    faint.rectangle(x0 + 12, ry - 3, 14, 6); faint.fill()     # gutter line numbers
            else:
                if toks:
                    L = toks[-1][0] + toks[-1][1]
                    faint.rectangle(x0 + 40 + ind * 24, ry - 4.5, L, 9); faint.fill()
    else:
        for k in range(0, ROWS, 2):
            ind, toks = rows[k]
            if toks:
                faint.rectangle(x0 + 40 + ind * 24, y0 + 56 + k * RH - 9, toks[-1][0] + toks[-1][1], 18); faint.fill()

def draw_chain(c, piv, end, t):
    d = end - piv; L = np.linalg.norm(d); u = d / L; n = np.array([-u[1], u[0]])
    k = 0; s = 0.0
    while s < L - 10:
        p = piv + u * (s + 11)
        c.save(); c.translate(*p); c.rotate(math.atan2(u[1], u[0]))
        if k % 2 == 0:
            c.scale(1, 0.48); c.arc(0, 0, 13, 0, 2 * math.pi); c.restore(); c.set_line_width(3.2); c.stroke()
        else:
            c.restore(); c.set_line_width(3.6); c.move_to(*(p - u * 12)); c.line_to(*(p + u * 12)); c.stroke()
        s += 19; k += 1

SCRIBBLE = []
_r = np.random.RandomState(3)
for k in range(130):
    a = _r.rand() * 2 * math.pi; r0 = math.sqrt(_r.rand())
    SCRIBBLE.append((a, r0, _r.uniform(0.6, 1.4), _r.uniform(-0.5, 0.5)))

def draw_ball(c, x, y, r, hole):
    """scribbled ink ball; hole (0..1) opens it from the centre into a ring"""
    c.save(); c.arc(x, y, r, 0, 2 * math.pi); c.clip()
    c.arc(x, y, r, 0, 2 * math.pi); c.set_source_rgba(0, 0, 0, 0.88); c.fill()
    c.set_source_rgba(0, 0, 0, 1)
    c.set_line_width(max(1.0, r * 0.035))
    for a, r0, L, cur in SCRIBBLE:
        px, py = x + math.cos(a) * r0 * r, y + math.sin(a) * r0 * r
        c.move_to(px - r * 0.5 * L, py - r * 0.2 * L * cur); c.curve_to(px, py + r * 0.3 * cur, px, py - r * 0.3 * cur, px + r * 0.5 * L, py + r * 0.2 * L * cur)
    c.stroke(); c.restore()

def scene(t, fi):
    s = world_scale(t); wc = world_center(t)
    cam = (s, wc[0], wc[1], 0.0)
    lo = lens_open(t); ro = rim_open(t)
    R = lerp(82, LR, lo) + ro * 1100
    # ball position follows the pendulum, then glides to the lens centre
    th = pendulum(t)
    piv = np.array([960.0, -60.0 - 900 * seg(t, 0.55, 1.05, in_cubic)])
    ballp = np.array([960 + math.sin(th) * 585, -60 + math.cos(th) * 585])
    cen = ballp * (1 - lo) + LC * lo
    ps = 1.0 + 0.02 * seg(t, 0, N / FPS, io_sine)
    bg, grain = paper.view(ps, *drift(t, 3, 9), 0)
    out = Layer(); oink = out.ctx
    sh = Layer()
    # ---- world (code base), seen through the lens; shifted so the lens centre is the camera centre
    card, ink, faint, grn, glow = Layer(), Layer(), Layer(), Layer(), Layer()
    for L in (card, ink, faint, grn, glow):
        set_cam(L.ctx, cam); L.ctx.translate(0, 0)
        L.ctx.identity_matrix(); L.ctx.translate(cen[0], cen[1]); L.ctx.scale(s, s); L.ctx.translate(-wc[0], -wc[1])
    show_world = lo > 0.02
    if show_world:
        hw, hh = (W / 2 + 200) / s, (H / 2 + 200) / s
        for (gx, gy) in GRID:
            if abs(gx * GX - wc[0]) > hw + FW or abs(gy * GY - wc[1]) > hh + FH: continue
            if ro == 0 and s > 0.5 and (abs(gx) > 1 or gy != 0): continue
            draw_file(card.ctx, ink.ctx, faint.ctx, grn.ctx, gx, gy, t, s)
        # review dots on file 0
        for k in REVIEW_DOTS:
            ry = -FH / 2 + 56 + k * RH
            p = out_back(seg(t, scan_time(ry) + 0.08, scan_time(ry) + 0.36, lambda v: v), 2.6)
            if p > 0:
                grn.ctx.arc(-FW / 2 + 19, ry, 6.5 * p, 0, 2 * math.pi); grn.ctx.fill()
        # scan line
        sv = seg(t, SCAN0 - 0.1, SCAN0, smooth) * (1 - seg(t, SCAN1, SCAN1 + 0.15, smooth))
        if sv > 0:
            y = scan_y(t)
            grn.ctx.save(); grn.ctx.set_source_rgba(0, 0, 0, sv); grn.ctx.rectangle(-FW / 2 - 40, y - 1.4, FW + 80, 2.8); grn.ctx.fill(); grn.ctx.restore()
            gr = cairo.LinearGradient(0, y - 60, 0, y)
            gr.add_color_stop_rgba(0, 0, 0, 0, 0); gr.add_color_stop_rgba(1, 0, 0, 0, 0.35 * sv)
            glow.ctx.set_source(gr); glow.ctx.rectangle(-FW / 2 - 40, y - 60, FW + 80, 60); glow.ctx.fill()
        # 'features that cut across': green thread through three files
        thr = seg(t, T_CUT - 0.10, T_CUT + 0.55, io_cubic) * (1 - seg(t, T_BASE + 0.4, T_BASE + 0.9, smooth) * 0.0)
        if thr > 0:
            pts = [(-GX - FW / 2 + 40, -FH / 2 + 56 + 5 * RH), (-GX + 60, -FH / 2 + 56 + 9 * RH), (-FW / 2 + 70, -FH / 2 + 56 + 7 * RH),
                   (40, -FH / 2 + 56 + 12 * RH), (GX - FW / 2 + 90, -FH / 2 + 56 + 10 * RH), (GX + 120, -FH / 2 + 56 + 15 * RH)]
            g = grn.ctx; g.set_line_width(3.2 / s ** 0.6); g.set_line_cap(cairo.LINE_CAP_ROUND); g.set_line_join(cairo.LINE_JOIN_ROUND)
            n = thr * (len(pts) - 1)
            g.move_to(*pts[0])
            for k in range(1, len(pts)):
                a, b = np.array(pts[k - 1]), np.array(pts[k])
                f = clamp01(n - (k - 1))
                if f <= 0: break
                m1 = a + (b - a) * np.array([0.5, 0]); m2 = b - (b - a) * np.array([0.5, 0])
                # draw partial cubic by sampling
                for j in range(1, 13):
                    u = j / 12 * f
                    p = (1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * m1 + 3 * (1 - u) * u * u * m2 + u ** 3 * b
                    g.line_to(*p)
            g.stroke()
            for k, p in enumerate(pts):
                q = out_back(seg(n, k - 0.05, k + 0.35, lambda v: v), 2.4)
                if q > 0: g.arc(p[0], p[1], 8 * q, 0, 2 * math.pi); g.fill()
        # code-base network
        for a, b, t0, bend in LINKS:
            gg = seg(t, t0, t0 + 0.45, out_cubic)
            if gg <= 0: continue
            pa = np.array([a[0] * GX, a[1] * GY]); pb = np.array([b[0] * GX, b[1] * GY])
            d = pb - pa; nrm = np.array([-d[1], d[0]]) * bend
            c1 = pa + d * 0.33 + nrm; c2 = pa + d * 0.66 + nrm
            g = grn.ctx; g.set_line_width(2.4 / s); g.set_line_cap(cairo.LINE_CAP_ROUND)
            g.move_to(*pa)
            for j in range(1, 17):
                u = j / 16 * gg
                g.line_to(*((1 - u) ** 3 * pa + 3 * (1 - u) ** 2 * u * c1 + 3 * (1 - u) * u * u * c2 + u ** 3 * pb))
            g.stroke()
        for (gx, gy), td in list(DOTS_AT.items()) + [((0, 0), T_ENTIRE + 0.1)]:
            q = out_back(seg(t, td, td + 0.3, lambda v: v), 2.4)
            if q > 0: grn.ctx.arc(gx * GX, gy * GY, 6.5 * q / s, 0, 2 * math.pi); grn.ctx.fill()
    # ---- performance panel (lens space)
    pv = seg(t, T_PERF - 0.15, T_PERF + 0.25, out_cubic) * (1 - seg(t, T_FEAT - 0.3, T_FEAT + 0.05, in_cubic))
    pcard, pink, pgrn = Layer(), Layer(), Layer()
    if pv > 0:
        for L in (pcard, pink, pgrn): L.ctx.translate(cen[0], cen[1] + 340 * (1 - pv))
        rrect(pcard.ctx, -LR, 6, 2 * LR, 360, 18); pcard.ctx.fill()
        opt = seg(t, T_PERF + 0.55, T_PERF + 1.15, io_cubic)
        r = np.random.RandomState(4)
        x0, full, bh = -200, 400, 22
        bars = []
        def part(a, w, lv):
            bars.append((lv, a, w))
            if lv >= 6 or w < 0.03: return
            cur = a + w * r.uniform(0.0, 0.08)
            for _ in range(r.randint(1, 4)):
                ww = w * r.uniform(0.22, 0.62)
                if cur + ww > a + w: break
                part(cur, ww, lv + 1); cur += ww + w * r.uniform(0.02, 0.10)
        part(0.0, 1.0, 0)
        hot = max((b for b in bars if b[0] == 2), key=lambda b: b[2])
        for (lv, a, w) in bars:
            keep = 1.0 if lv < 3 else 1 - opt
            if keep <= 0.01: continue
            shrink = lerp(1.0, 0.34, opt)
            bx = x0 + a * full * shrink; bw = max(2.0, w * full * shrink - 2.5)
            by = 262 - lv * (bh + 3)
            tgt = pgrn.ctx if ((lv, a, w) == hot and opt > 0.5) else pink.ctx
            tgt.save(); rrect(tgt, bx, by - bh * keep, bw, bh * keep, 3); tgt.set_source_rgba(0, 0, 0, keep * (0.88 if lv % 2 == 0 else 0.55)); tgt.fill(); tgt.restore()
        ms = int(round(lerp(412, 38, opt)))
        tc = pgrn.ctx if opt > 0.98 else pink.ctx
        tc.select_font_face("JetBrains Mono", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD); tc.set_font_size(30)
        txt = f"{ms} ms"; e = tc.text_extents(txt); tc.move_to(205 - e.x_advance, 62); tc.show_text(txt)
        pink.ctx.select_font_face("JetBrains Mono", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL); pink.ctx.set_font_size(18)
        pink.ctx.move_to(-205, 58); pink.ctx.show_text("profile: render()")
        pink.ctx.rectangle(-205, 76, 410, 1.5); pink.ctx.fill()
    # ---- composite the lens interior
    inner = bg.copy()
    if show_world:
        ca = card.alpha()
        if ro > 0:   # once the lens opens, cards sit on the paper with soft shadows
            inner = multiply(inner, cv2.GaussianBlur(ca, (0, 0), 6 + 6 * s), np.array([70, 55, 40], np.float32), 0.35 * ro)
        inner = over(inner, ca, CARD, 0.98 + 0.04 * grain)
        inner = over(inner, ink_alpha(faint.alpha() * lerp(0.32, 0.42, clamp01((0.6 - s) / 0.4)), grain, dry=0.1), INK)
        inner = over(inner, ink_alpha(ink.alpha() * 0.9, grain, dry=0.12), INK)
        ga = grn.alpha(); gl = glow.alpha()
        inner = over(inner, np.clip(cv2.GaussianBlur(ga, (0, 0), 5) * 0.5 + gl * 0.6, 0, 1), GREEN)
        inner = over(inner, ga, GREEN)
    if pv > 0:
        pa_ = pcard.alpha()
        inner = multiply(inner, cv2.GaussianBlur(pa_, (0, 0), 16), np.array([60, 45, 30], np.float32), 0.45)
        inner = over(inner, pa_, CARD)
        inner = over(inner, ink_alpha(pink.alpha(), grain, dry=0.1), INK)
        inner = over(inner, pgrn.alpha(), GREEN)
    # lens mask + barrel distortion (only while it is a lens)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dx, dy = xx - cen[0], yy - cen[1]
    rr = np.sqrt(dx * dx + dy * dy)
    if R < 1500 and lo > 0.02:
        k = 0.10 * (1 - ro)
        f = 1 - k * np.clip(rr / R, 0, 1) ** 2
        inner = cv2.remap(inner.astype(np.float32), (cen[0] + dx * f).astype(np.float32), (cen[1] + dy * f).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        # inner rim shading
        inner = inner * (1 - 0.18 * (1 - ro) * np.clip((rr / R - 0.82) / 0.18, 0, 1) ** 2)[..., None]
    mask = np.clip(R - rr + 0.5, 0, 1) * (lo if lo < 1 else 1.0)
    if ro > 0: mask = np.maximum(mask, seg(t, T_ENTIRE + 0.5, T_ENTIRE + 0.8, smooth))
    # ---- outside: paper, chain, ball, rim, handle, shadow
    hole = lo
    sha = Layer(); s_ = sha.ctx
    rim_a = 1 - seg(R, LR + 250, LR + 1000, smooth)
    hd = seg(t, 0.85, 1.20, out_cubic) * rim_a
    ang = math.radians(42)
    if lo < 1 or rim_a > 0:
        s_.arc(cen[0] + 10, cen[1] + 22, R + 6, 0, 2 * math.pi); s_.set_source_rgba(0, 0, 0, 0.5 * max(rim_a, 1 - lo)); s_.fill()
    if hd > 0:
        s_.save(); s_.translate(cen[0] + 14, cen[1] + 26); s_.rotate(ang); rrect(s_, R + 4, -18, 230 * hd, 36, 18); s_.set_source_rgba(0, 0, 0, 0.5); s_.fill(); s_.restore()
    img = multiply(bg, cv2.GaussianBlur(sha.alpha(), (0, 0), 20), np.array([60, 45, 30], np.float32), 0.6)
    img = img * (1 - mask[..., None]) + inner * mask[..., None]
    # rim ring + handle (ink)
    if lo < 1:
        th_ = pendulum(t)
        if piv[1] > -1100: draw_chain(oink, piv, cen - (cen - piv) / np.linalg.norm(cen - piv) * R * 0.9, t)
        if lo < 0.999:
            oink.save(); oink.arc(cen[0], cen[1], R, 0, 2 * math.pi)
            if hole > 0: oink.arc_negative(cen[0], cen[1], max(0.1, (R - 15) * hole), 2 * math.pi, 0)
            oink.clip()
            draw_ball(oink, cen[0], cen[1], R, hole); oink.restore()
    if rim_a > 0 and lo > 0.98:
        oink.save(); oink.set_source_rgba(0, 0, 0, rim_a)
        oink.set_line_width(15 * (1 + ro)); oink.arc(cen[0], cen[1], R - 7, 0, 2 * math.pi); oink.stroke()
        oink.set_line_width(1.6); oink.arc(cen[0], cen[1], R - 26, 0, 2 * math.pi); oink.stroke()
        for k in range(72):
            a = k / 72 * 2 * math.pi + t * 0.05
            l = 7 if k % 6 else 12
            oink.set_line_width(1.4); oink.move_to(cen[0] + math.cos(a) * (R - 15), cen[1] + math.sin(a) * (R - 15))
            oink.line_to(cen[0] + math.cos(a) * (R - 15 - l), cen[1] + math.sin(a) * (R - 15 - l)); oink.stroke()
        oink.restore()
    if hd > 0:
        oink.save(); oink.translate(cen[0], cen[1]); oink.rotate(ang)
        rrect(oink, R - 2, -15, 34 * min(1, hd * 3), 30, 6); oink.set_source_rgba(0, 0, 0, rim_a); oink.fill()
        rrect(oink, R + 26, -19, 205 * hd, 38, 19); oink.set_source_rgba(0, 0, 0, rim_a); oink.fill()
        oink.restore()
    ia = ink_alpha(out.alpha(), grain)
    img = over(img, ia, INK, 0.92 + 0.16 * grain)
    # glass highlight
    if lo > 0.9 and rim_a > 0:
        hl = Layer(); h = hl.ctx
        h.set_line_width(14); h.set_line_cap(cairo.LINE_CAP_ROUND)
        h.arc(cen[0], cen[1], R - 50, math.radians(200), math.radians(245)); h.stroke()
        h.set_line_width(6); h.arc(cen[0], cen[1], R - 50, math.radians(252), math.radians(262)); h.stroke()
        img = over(img, cv2.GaussianBlur(hl.alpha(), (0, 0), 3) * 0.45 * rim_a * lo, WHITE)
    img = img * vignette(0.15)
    return film_grain(img, fi * 13 + int(t * 1000) % 5, 1.6)

paper = Paper(seed=7)

if __name__ == "__main__":
    main(scene, N, "C")
