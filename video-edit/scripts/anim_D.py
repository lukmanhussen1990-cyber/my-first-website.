"""D - documents (frames 1227..1401, 175 frames, 51.218-58.517 s).
Ball rolls along a line and unrolls into a research paper; spreadsheet / memo / deck cards flip in on
their words, each gets a green check; 'numbers and sources': key numbers highlighted and linked to source
tags; 'laid out ... check them': cards settle into a perfect grid that fills outwards, checks ripple."""
import sys, os, math
import numpy as np, cv2, cairo
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

N = 175
A0 = 51.218
def wt(x): return x - A0
T_RES, T_SHEET, T_MEMO, T_DECK = wt(51.91), wt(52.64), wt(53.29), wt(53.83)
T_NUM, T_SRC, T_LAID, T_CHECK = wt(54.88), wt(55.37), wt(55.79), wt(56.84)
CW_, CH_ = 340, 440
PX, PY = 390, 490                     # grid pitch (world)
SLOTS = [(-585, 0), (-195, 0), (195, 0), (585, 0)]
ROT = [0.0, 1.6, -1.2, 2.0]
LAND = [T_RES + 0.25, T_SHEET + 0.36, T_MEMO + 0.36, T_DECK + 0.36]

# ------------------------------------------------------------------ card textures
def mk_surface(scale):
    w, h = int(CW_ * scale), int(CH_ * scale)
    s = cairo.ImageSurface(cairo.FORMAT_ARGB32, w, h); c = cairo.Context(s); c.scale(scale, scale)
    return s, c

def txt(c, x, y, s, size, fam="Inter", wgt=0, slant=0):
    c.select_font_face(fam, cairo.FONT_SLANT_ITALIC if slant else cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD if wgt else cairo.FONT_WEIGHT_NORMAL)
    c.set_font_size(size); c.move_to(x, y); c.show_text(s)

def lines(c, x, y, w, n, gap=11, r=None, lw=3.2, last=0.6):
    r = r or np.random.RandomState(int(x * 7 + y))
    c.set_line_width(lw); c.set_line_cap(cairo.LINE_CAP_ROUND)
    for k in range(n):
        L = w * (last if k == n - 1 else r.uniform(0.86, 1.0))
        c.move_to(x, y + k * gap); c.line_to(x + L, y + k * gap); c.stroke()

INKC = tuple(INK / 255); GRC = tuple(GREEN / 255)

def card_research(c):
    c.set_source_rgb(*INKC)
    txt(c, 26, 42, "Scaling laws for", 21, "Caladea", 1); txt(c, 26, 66, "multi-step reasoning", 21, "Caladea", 1)
    c.set_source_rgba(*INKC, 0.55); lines(c, 26, 84, 160, 1, lw=2.4, last=1)
    c.set_source_rgb(*INKC); txt(c, 26, 112, "Abstract", 12, "Caladea", 0, 1)
    c.set_source_rgba(*INKC, 0.75); lines(c, 26, 124, 288, 4, gap=10, lw=2.2)
    lines(c, 26, 178, 136, 15, gap=10, lw=2.2, last=0.5)
    c.set_source_rgb(*INKC); c.set_line_width(1.4); c.rectangle(178, 172, 136, 92); c.stroke()
    r = np.random.RandomState(2)
    for k in range(26):
        x = 186 + r.rand() * 120; y = 254 - (x - 186) * 0.62 + r.randn() * 9
        c.arc(x, y, 2.0, 0, 2 * math.pi); c.fill()
    c.set_line_width(1.8); c.move_to(184, 258); c.line_to(310, 180); c.stroke()
    txt(c, 178, 282, "Fig. 2   r = 0.87", 11.5, "Inter", 0)
    e1 = c.text_extents("Fig. 2   r = "); e2 = c.text_extents("0.87")
    c.set_source_rgba(*INKC, 0.75); lines(c, 178, 300, 136, 9, gap=10, lw=2.2, last=0.4)
    lines(c, 26, 336, 136, 7, gap=10, lw=2.2, last=0.7)
    return (178 + e1.x_advance - 4, 269, e2.x_advance + 8, 17)   # highlight box (x, y, w, h) around "0.87"

def card_sheet(c):
    c.set_source_rgb(*INKC)
    txt(c, 22, 40, "Q3 model", 19, "Inter", 1)
    c.set_source_rgba(*INKC, 0.10); c.rectangle(18, 56, 304, 24); c.fill()
    c.set_source_rgba(*INKC, 0.45); c.set_line_width(1)
    cols = [18, 58, 140, 206, 268, 322]
    for k in range(15): c.move_to(18, 56 + k * 24); c.line_to(322, 56 + k * 24); c.stroke()
    for x in cols: c.move_to(x, 56); c.line_to(x, 56 + 14 * 24); c.stroke()
    c.set_source_rgb(*INKC)
    for k, h in enumerate("ABCD"): txt(c, cols[k + 1] + 8, 73, h, 12, "Inter", 1)
    r = np.random.RandomState(4)
    for k in range(1, 13):
        txt(c, 26, 73 + k * 24, str(k), 11, "JetBrains Mono")
        for j in range(4):
            v = r.randint(80, 999)
            txt(c, cols[j + 1] + 6, 73 + k * 24, f"{v:,}" if j < 3 else f"{r.uniform(1, 30):.1f}%", 11, "JetBrains Mono")
    c.set_source_rgba(*INKC, 0.12); c.rectangle(18, 56 + 13 * 24, 304, 24); c.fill()
    c.set_source_rgb(*INKC); txt(c, 26, 73 + 13 * 24, "Σ", 12, "DejaVu Sans", 1)
    txt(c, cols[3] + 6, 73 + 13 * 24, "4,812", 12, "JetBrains Mono", 1)
    e = c.text_extents("4,812")
    c.set_source_rgba(*INKC, 0.7); lines(c, 22, 424 - 14, 180, 1, lw=2.2, last=1)
    return (cols[3] + 2, 56 + 13 * 24 + 3, e.x_advance + 8, 19)

def card_memo(c):
    c.set_source_rgb(*INKC)
    txt(c, 24, 48, "MEMO", 30, "Caladea", 1)
    c.set_line_width(2.4); c.move_to(24, 62); c.line_to(316, 62); c.stroke()
    for k, lab in enumerate(["To:", "From:", "Date:", "Re:"]):
        txt(c, 24, 88 + k * 20, lab, 12, "Inter", 1)
        c.set_source_rgba(*INKC, 0.7); lines(c, 74, 84 + k * 20, [130, 110, 80, 170][k], 1, lw=2.2, last=1); c.set_source_rgb(*INKC)
    c.set_line_width(1.2); c.move_to(24, 170); c.line_to(316, 170); c.stroke()
    c.set_source_rgba(*INKC, 0.75); lines(c, 24, 190, 292, 5, gap=11, lw=2.2, last=0.4)
    c.set_source_rgb(*INKC); txt(c, 24, 262, "Margin up", 13, "Inter", 1); txt(c, 98, 262, "+12%", 13, "Inter", 1)
    c.set_source_rgba(*INKC, 0.75); lines(c, 142, 258, 174, 1, lw=2.2, last=1); lines(c, 24, 280, 292, 3, gap=11, lw=2.2, last=0.7)
    for k in range(3):
        c.set_source_rgb(*INKC); c.arc(30, 334 + k * 20, 3, 0, 2 * math.pi); c.fill()
        c.set_source_rgba(*INKC, 0.75); lines(c, 42, 334 + k * 20, [220, 180, 240][k], 1, lw=2.2, last=1)
    return (95, 248, 42, 18)

def card_deck(c):
    c.set_source_rgba(*INKC, 0.18); c.rectangle(34, 36, 288, 168); c.fill()
    c.set_source_rgb(*tuple(CARD / 255)); c.rectangle(24, 26, 288, 168); c.fill()
    c.set_source_rgb(*INKC); c.set_line_width(1.6); c.rectangle(24, 26, 288, 168); c.stroke()
    txt(c, 40, 58, "Revenue by region", 15, "Inter", 1)
    hs = [0.42, 0.66, 0.54, 0.9]
    for k, h in enumerate(hs):
        c.rectangle(52 + k * 56, 176 - 96 * h, 34, 96 * h); c.fill()
    txt(c, 222, 82, "$2.4M", 13, "Inter", 1)
    for k in range(3):
        x = 24 + k * 100
        c.set_line_width(1.2); c.rectangle(x, 216, 88, 52); c.stroke()
        c.set_source_rgba(*INKC, 0.6); lines(c, x + 8, 230, 60, 2, gap=9, lw=2, last=0.6); c.set_source_rgb(*INKC)
    txt(c, 24, 296, "Speaker notes", 11, "Inter", 1)
    c.set_source_rgba(*INKC, 0.7); lines(c, 24, 312, 292, 8, gap=11, lw=2.2, last=0.5)
    return (218, 68, 52, 19)

BUILDERS = [card_research, card_sheet, card_memo, card_deck]
TEX = {}; HL = {}
_pg = Paper(seed=7).tex
def build_textures():
    for kind, fn in enumerate(BUILDERS):
        for sc in (1.0, 0.5):
            s, c = mk_surface(2 * sc)
            # paper with grain
            g = _pg[300:300 + int(CH_ * 2 * sc), 400:400 + int(CW_ * 2 * sc), 3]
            base = np.ones((s.get_height(), s.get_width(), 3), np.float32) * CARD * (0.97 + 0.06 * g[..., None])
            c.set_source_rgba(0, 0, 0, 0); c.paint()
            hl = fn(c)
            s.flush()
            a = np.ndarray((s.get_height(), s.get_stride() // 4, 4), np.uint8, s.get_data())[:, :s.get_width()].astype(np.float32) / 255
            ink_a = a[..., 3]
            rgb = base * (1 - ink_a[..., None]) + a[..., [2, 1, 0]] * 255          # premultiplied BGRA -> RGB over paper
            rgb[..., :] = np.where(ink_a[..., None] > 0, base * (1 - ink_a[..., None]) + a[..., [2, 1, 0]] * 255, base)
            TEX[(kind, sc)] = np.dstack([rgb, np.ones(rgb.shape[:2], np.float32)]).astype(np.float32)
            HL[kind] = hl
build_textures()

# ------------------------------------------------------------------ grid of extra cards
rng = np.random.RandomState(8)
GRIDC = []
for gy in range(-4, 5):
    for gx in range(-8, 8):
        if gy == 0 and -2 <= gx <= 1: continue
        d = math.hypot(gx + 0.5, gy * 1.25)
        GRIDC.append((gx, gy, (gx * 3 + gy * 5) % 4, T_LAID + 0.12 + d * 0.075 + rng.uniform(0, 0.07), rng.rand() < 0.62, d))
def slot_xy(gx, gy): return (gx + 0.5) * PX, gy * PY

# ------------------------------------------------------------------ projection helpers
def card_quad(cx, cy, rot_deg, yaw_deg, scale, cam, lift=0.0):
    """4 screen-space corners of a card centred at world (cx,cy), rotated in-plane, yawed in 3D."""
    hw, hh = CW_ / 2 * scale, CH_ / 2 * scale
    yaw = math.radians(yaw_deg); f = 1800.0
    pts = []
    for (x, y) in [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]:
        X = x * math.cos(yaw); Z = x * math.sin(yaw) - lift
        k = f / (f + Z)
        x2, y2 = X * k, y * k
        a = math.radians(rot_deg)
        xr, yr = x2 * math.cos(a) - y2 * math.sin(a), x2 * math.sin(a) + y2 * math.cos(a)
        pts.append(cam_point(cam, cx + xr, cy + yr))
    return np.float32(pts)

def place(img, alpha_acc, tex, quad, shade=1.0, clip_y=None):
    x0, y0 = np.floor(quad.min(0)).astype(int) - 2; x1, y1 = np.ceil(quad.max(0)).astype(int) + 2
    x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, W), min(y1, H)
    if x1 <= x0 or y1 <= y0: return
    th, tw = tex.shape[:2]
    src = np.float32([[0, 0], [tw, 0], [tw, th], [0, th]])
    M = cv2.getPerspectiveTransform(src, quad - np.float32([x0, y0]))
    warped = cv2.warpPerspective(tex, M, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    a = warped[..., 3:4]
    if clip_y is not None:
        yy = np.arange(y0, y1, dtype=np.float32)[:, None, None]
        a = a * np.clip(clip_y - yy + 0.5, 0, 1)
    img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - a) + warped[..., :3] * shade * a
    alpha_acc[y0:y1, x0:x1] = np.maximum(alpha_acc[y0:y1, x0:x1], a[..., 0])

def camera(t):
    f = seg(t, 0.45, T_DECK + 0.45, io_sine)               # follow the row as it builds
    z = seg(t, T_LAID - 0.1, N / FPS + 0.3, io_sine)
    s = math.exp(math.log(1.16) * (1 - f) * (1 - z) + math.log(0.40) * z)
    dx, dy = drift(t, 5, 21)
    return (s, lerp(-400.0, 0.0, f) + dx / s, lerp(-20.0, 0.0, f) + dy / s, -0.25 + 0.5 * seg(t, 0, N / FPS, io_sine))

paper = Paper(seed=7)
SCRIB = [(np.random.RandomState(k).rand() * 6.28, math.sqrt(np.random.RandomState(k + 99).rand()), np.random.RandomState(k + 7).uniform(-0.6, 0.6)) for k in range(90)]
TAGS = [("[1] Nature, 2024", (-390, 292)), ("[2] 10-K, p.43", (0, 292)), ("[3] Q3 board memo", (390, 292)), ("[4] Survey, n=1,204", (780, -292))]
def partial_path(c, pts, prog, rad=12):
    """draw a polyline with rounded corners up to fraction prog of its length"""
    pts = [np.array(p, float) for p in pts]
    segs = [np.linalg.norm(pts[k + 1] - pts[k]) for k in range(len(pts) - 1)]
    tot = sum(segs) * prog
    c.move_to(*pts[0])
    for k in range(len(segs)):
        if tot <= 0: break
        f = min(1.0, tot / segs[k]); q = pts[k] + (pts[k + 1] - pts[k]) * f
        c.line_to(*q); tot -= segs[k]
    c.stroke()

def scene(t, fi):
    cam = camera(t); s = cam[0]
    bg, grain = paper.view(1.0 + 0.04 * (1 - s), *drift(t, 3, 5), 0)
    img = bg.copy()
    cards = np.zeros((H, W), np.float32)
    ink = Layer(); c = ink.ctx; set_cam(c, cam)
    grn = Layer(); g = grn.ctx; set_cam(g, cam)
    wht = Layer(); wc = wht.ctx; set_cam(wc, cam)
    sh_list = []
    # ---- ball rolls along a line, then unrolls into card 0
    sx, sy = SLOTS[0]; top = sy - CH_ / 2
    roll_p = seg(t, 0.0, 0.50, out_cubic)
    unr = seg(t, 0.50, 0.95, io_cubic)
    R0 = 46
    line_a = 1 - seg(t, 0.9, 1.3, smooth)
    if line_a > 0:
        c.save(); c.set_source_rgba(0, 0, 0, 0.85 * line_a); c.set_line_width(2.2)
        c.move_to(-1400, top - R0 + R0); c.line_to(sx - CW_ / 2 + (CW_) * min(1, roll_p * 1.0 + unr), top); c.stroke(); c.restore()
    if unr < 1:
        bx = lerp(-1250, sx, roll_p)
        r = R0 * (1 - 0.35 * unr)
        if unr <= 0:
            ang = (bx + 1250) / R0
            c.save(); c.arc(bx, top - R0, R0, 0, 2 * math.pi); c.clip()
            c.arc(bx, top - R0, R0, 0, 2 * math.pi); c.set_source_rgba(0, 0, 0, 0.85); c.fill()
            c.set_source_rgba(0, 0, 0, 1); c.set_line_width(2.2)
            for a, rr, cu in SCRIB:
                a2 = a + ang; px, py = bx + math.cos(a2) * rr * R0, top - R0 + math.sin(a2) * rr * R0
                c.move_to(px - 20 * math.cos(a2 + cu), py - 20 * math.sin(a2 + cu)); c.line_to(px + 20 * math.cos(a2 + cu), py + 20 * math.sin(a2 + cu))
            c.stroke(); c.restore()
        else:
            # ball squashes into a paper roll the width of the card, rolling down as it unrolls
            wroll = lerp(2 * R0, CW_, seg(unr, 0, 0.25, out_cubic))
            yroll = top + CH_ * seg(unr, 0.12, 1.0, io_cubic)
            rr_ = R0 * lerp(1, 0.25, seg(unr, 0.1, 1.0))
            c.save(); c.translate(sx, yroll)
            c.new_sub_path(); c.arc(-wroll / 2 + rr_, 0, rr_, math.pi / 2, 3 * math.pi / 2); c.arc(wroll / 2 - rr_, 0, rr_, -math.pi / 2, math.pi / 2); c.close_path()
            c.set_source_rgba(0, 0, 0, 0.9); c.fill(); c.restore()
            sh_list.append(("roll", sx, yroll, wroll, rr_))
    # ---- the four hero cards
    straight = seg(t, T_LAID - 0.05, T_LAID + 0.45, io_cubic)
    tag_a = seg(t, T_SRC - 0.05, T_SRC + 0.25, out_cubic) * (1 - seg(t, T_LAID + 0.05, T_LAID + 0.40, smooth))
    for k in range(4):
        cx, cy = SLOTS[k]; rot = ROT[k] * (1 - straight)
        if k == 0:
            if unr <= 0: continue
            yaw = 0.0; lift = 0.0; sc = 1.0
            clipy = cam_point(cam, cx, top + CH_ * seg(unr, 0.12, 1.0, io_cubic))[1] if unr < 1 else None
        else:
            p = seg(t, LAND[k] - 0.48, LAND[k], lambda v: v)
            if p <= 0: continue
            yaw = 92 * (1 - spring(p * 0.62, 1.3, 0.55)) if p < 1 else 92 * (1 - spring(0.62 + (t - LAND[k]) * 0.62, 1.3, 0.55))
            lift = 260 * (1 - out_cubic(p)); clipy = None; sc = 1.0
            cy = cy + 40 * (1 - out_cubic(p))
        tex = TEX[(k, 1.0 if s > 0.6 else 0.5)]
        quad = card_quad(cx, cy, rot, yaw, sc, cam, lift)
        shade = 1.0 - 0.25 * abs(math.sin(math.radians(yaw)))
        if k == 0 and unr < 1:       # shadow only under the unrolled part
            rev = CH_ * seg(unr, 0.12, 1.0, io_cubic)
            sq = np.float32([cam_point(cam, cx - CW_ / 2, top), cam_point(cam, cx + CW_ / 2, top), cam_point(cam, cx + CW_ / 2, top + rev), cam_point(cam, cx - CW_ / 2, top + rev)])
            if rev > 2: sh_list.append(("card", sq, 0.0))
        else:
            sh_list.append(("card", quad, lift))
        place(img, cards, tex, quad, shade, clipy)
        # green check
        cp = out_back(seg(t, LAND[k] + 0.12, LAND[k] + 0.42, lambda v: v), 2.4)
        if cp > 0:
            a = math.radians(rot); ox, oy = CW_ / 2 - 8, -CH_ / 2 + 8
            px, py = cx + ox * math.cos(a) - oy * math.sin(a), cy + ox * math.sin(a) + oy * math.cos(a)
            g.arc(px, py, 21 * cp, 0, 2 * math.pi); g.fill()
            wc.save(); wc.translate(px, py); wc.scale(cp, cp); wc.set_line_width(4); wc.set_line_cap(cairo.LINE_CAP_ROUND); wc.set_line_join(cairo.LINE_JOIN_ROUND)
            wc.move_to(-9, 0); wc.line_to(-3, 7); wc.line_to(10, -7); wc.stroke(); wc.restore()
        # numbers highlighted, linked to source tags
        hx, hy, hw, hh = HL[k]
        hp = seg(t, T_NUM + k * 0.08, T_NUM + k * 0.08 + 0.35, io_cubic) * (1 - seg(t, T_LAID + 0.6, T_LAID + 1.0, smooth))
        if hp > 0:
            a = math.radians(rot)
            def tw(x, y):
                X, Y = x - CW_ / 2, y - CH_ / 2
                return cx + X * math.cos(a) - Y * math.sin(a), cy + X * math.sin(a) + Y * math.cos(a)
            g.save(); g.translate(*tw(hx, hy)); g.rotate(a); g.set_line_width(2.6)
            per = 2 * (hw + hh) * hp
            g.move_to(0, hh); seglen = [hw, hh, hw, hh]; pts = [(hw, hh), (hw, 0), (0, 0), (0, hh)]
            cur = (0, hh)
            for L, p2 in zip(seglen, pts):
                if per <= 0: break
                f = min(1, per / L); g.line_to(cur[0] + (p2[0] - cur[0]) * f, cur[1] + (p2[1] - cur[1]) * f); cur = p2; per -= L
            g.stroke(); g.restore()
            # elbow connector through the gap between cards to the tag
            lp = seg(t, T_SRC - 0.25 + k * 0.08, T_SRC + 0.15 + k * 0.08, io_cubic) * (1 - seg(t, T_LAID + 0.05, T_LAID + 0.40, smooth))
            tx, ty = TAGS[k][1]
            p0 = np.array(tw(hx + hw + 2, hy + hh / 2))
            ty_edge = ty + (22 if ty < 0 else -22)
            if lp > 0:
                c.save(); c.set_line_width(1.6); c.set_source_rgba(0, 0, 0, 0.9); c.set_line_join(cairo.LINE_JOIN_ROUND)
                partial_path(c, [p0, (tx, p0[1]), (tx, ty_edge)], lp)
                c.arc(*p0, 3.5, 0, 2 * math.pi); c.fill(); c.restore()
    # ---- grid fills outward
    for gx, gy, kind, ta, chk, d in GRIDC:
        p = seg(t, ta, ta + 0.42, lambda v: v)
        if p <= 0: continue
        cx, cy = slot_xy(gx, gy)
        if abs(cam_point(cam, cx, cy)[0] - W / 2) > W / 2 + 300 or abs(cam_point(cam, cx, cy)[1] - H / 2) > H / 2 + 300: continue
        yaw = 90 * (1 - spring(p * 0.75, 1.3, 0.6)); lift = 200 * (1 - out_cubic(p))
        quad = card_quad(cx, cy, 0, yaw, 1.0, cam, lift)
        sh_list.append(("card", quad, lift))
        place(img, cards, TEX[(kind, 1.0 if s > 0.6 else 0.5)], quad, 1.0 - 0.25 * abs(math.sin(math.radians(yaw))))
        if chk:
            cp = out_back(seg(t, T_CHECK - 0.25 + d * 0.06, T_CHECK + 0.05 + d * 0.06, lambda v: v), 2.4)
            if cp > 0:
                px, py = cx + CW_ / 2 - 8, cy - CH_ / 2 + 8
                g.arc(px, py, 21 * cp, 0, 2 * math.pi); g.fill()
                wc.save(); wc.translate(px, py); wc.scale(cp, cp); wc.set_line_width(4); wc.set_line_cap(cairo.LINE_CAP_ROUND); wc.set_line_join(cairo.LINE_JOIN_ROUND)
                wc.move_to(-9, 0); wc.line_to(-3, 7); wc.line_to(10, -7); wc.stroke(); wc.restore()
    # ---- source tags
    tagL = Layer(); tc = tagL.ctx; set_cam(tc, cam); tagI = Layer(); ti = tagI.ctx; set_cam(ti, cam)
    if tag_a > 0:
        for k, (label, (tx, ty)) in enumerate(TAGS):
            q = out_back(seg(t, T_SRC + k * 0.08, T_SRC + k * 0.08 + 0.32, lambda v: v), 1.8) * (1 - seg(t, T_LAID + 0.05, T_LAID + 0.4, smooth))
            if q <= 0: continue
            ti.select_font_face("JetBrains Mono", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL); ti.set_font_size(17)
            e = ti.text_extents(label); w_ = e.x_advance + 30
            for ctx in (tc, ti): ctx.save(); ctx.translate(tx, ty); ctx.scale(q, q)
            from_ = -w_ / 2
            tc.new_sub_path(); tc.arc(from_ + 22 + w_ - 44, 0, 22, -math.pi / 2, math.pi / 2); tc.arc(from_ + 22, 0, 22, math.pi / 2, 3 * math.pi / 2); tc.close_path(); tc.fill()
            ti.set_line_width(1.6)
            ti.new_sub_path(); ti.arc(from_ + 22 + w_ - 44, 0, 22, -math.pi / 2, math.pi / 2); ti.arc(from_ + 22, 0, 22, math.pi / 2, 3 * math.pi / 2); ti.close_path(); ti.stroke()
            ti.move_to(-e.x_advance / 2, 6); ti.show_text(label)
            for ctx in (tc, ti): ctx.restore()
    # ---- shadows (under everything placed): blurred union of card quads, offset by lift
    shL = Layer(); sc_ = shL.ctx
    for item in sh_list:
        if item[0] == "card":
            _, quad, lift = item; off = 8 + lift * 0.10
            sc_.move_to(quad[0][0] + off * 0.4, quad[0][1] + off)
            for q in quad[1:]: sc_.line_to(q[0] + off * 0.4, q[1] + off)
            sc_.close_path(); sc_.set_source_rgba(0, 0, 0, max(0.25, 0.7 - lift / 600)); sc_.fill()
        else:
            _, x, y, w_, r_ = item
            p = cam_point(cam, x, y + r_ + 6)
            sc_.save(); sc_.translate(*p); sc_.scale(1, 0.25); sc_.arc(0, 0, w_ / 2 * s, 0, 2 * math.pi); sc_.set_source_rgba(0, 0, 0, 0.5); sc_.fill(); sc_.restore()
    sha = cv2.GaussianBlur(shL.alpha(), (0, 0), 10 + 8 * s)
    base = multiply(bg, sha * (1 - cards), np.array([60, 45, 30], np.float32), 0.55)
    img = base * (1 - cards[..., None]) + img * cards[..., None]
    img = over(img, ink_alpha(ink.alpha(), grain), INK, 0.92 + 0.16 * grain)
    ta_ = tagL.alpha()
    if ta_.max() > 0:
        img = multiply(img, cv2.GaussianBlur(ta_, (0, 0), 8), np.array([60, 45, 30], np.float32), 0.35)
        img = over(img, ta_, CARD)
        img = over(img, tagI.alpha(), INK)
    ga = grn.alpha()
    img = over(img, cv2.GaussianBlur(ga, (0, 0), 4) * 0.35, GREEN)
    img = over(img, ga, GREEN)
    img = over(img, wht.alpha(), WHITE)
    img = img * vignette(0.15)
    return film_grain(img, fi * 17 + int(t * 1000) % 5, 1.6)

if __name__ == "__main__":
    main(scene, N, "D")
