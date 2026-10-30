"""A - name title over shot 1. Old title removed (clean_title.py); new animated title composited on top.
Output covers frames 21..136 (cleaning ramps); the title itself lives in frames 27..130 (same window as the original)."""
import sys, os, math
import numpy as np, cv2, cairo
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

F0, F1 = 21, 136            # frames written
T0 = 27                     # title local t=0 at frame 27
TDUR = (130 - 27 + 1) / FPS # 4.338 s
NAME, ROLE = "Alex Albert", "Research Product Management"
X, LINE_Y = 100, 922        # left margin, divider line
CX0, CY0, CW, CH = 40, 790, 900, 240   # overlay crop (screen coords)

shot = np.memmap(os.path.join(SCR, "work/shot1.rgb"), np.uint8, "r").reshape(-1, H, W, 3)
clean = np.memmap(os.path.join(SCR, "work/shot1_clean.rgb"), np.uint8, "r").reshape(-1, H, W, 3)   # frames 22..137

def glyph_layout(ctx, text, family, size, weight=cairo.FONT_WEIGHT_NORMAL):
    ctx.select_font_face(family, cairo.FONT_SLANT_NORMAL, weight); ctx.set_font_size(size)
    xs, x = [], 0.0
    for i, ch in enumerate(text):
        xs.append(x); x = ctx.text_extents(text[:i + 1]).x_advance
    return xs, x

_m = cairo.Context(cairo.ImageSurface(cairo.FORMAT_A8, 8, 8))
NAME_SIZE, ROLE_SIZE = 66, 33
NAME_X, NAME_W = glyph_layout(_m, NAME, "Caladea", NAME_SIZE)
ROLE_X, ROLE_W = glyph_layout(_m, ROLE, "Inter Medium", ROLE_SIZE)
ROLE_TRACK = 0.6
ROLE_W += ROLE_TRACK * len(ROLE)
LINE_LEN = max(NAME_W, ROLE_W) + 34
NAME_BASE = LINE_Y - 20
ROLE_BASE = LINE_Y + 46

def draw_char(L, ch, x, y, family, size, weight=cairo.FONT_WEIGHT_NORMAL):
    c = L.ctx; c.select_font_face(family, cairo.FONT_SLANT_NORMAL, weight); c.set_font_size(size)
    c.move_to(x - CX0, y - CY0); c.show_text(ch)

def overlay(t):
    """returns (text_alpha, green_alpha) in the crop, for title-local time t"""
    txt = np.zeros((CH, CW), np.float32); grn = np.zeros((CH, CW), np.float32)
    if t < -0.01 or t > TDUR + 0.01: return txt, grn
    ex = t - 3.60                                        # exit clock
    # --- green dot + ripple
    pop = out_back(seg(t, 0.0, 0.32, lambda v: v), 2.2) if t < 4.0 else 1 - seg(t, 4.08, 4.30, in_cubic)
    L = Layer(CW, CH); c = L.ctx
    if pop > 0:
        c.arc(X - CX0, LINE_Y - CY0, 7.5 * pop, 0, 2 * math.pi); c.fill()
    rp = seg(t, 0.05, 0.75, out_cubic)
    if 0 < rp < 1:
        c.set_line_width(2.0); c.arc(X - CX0, LINE_Y - CY0, 7.5 + 30 * rp, 0, 2 * math.pi)
        c.set_source_rgba(0, 0, 0, 0.8 * (1 - rp)); c.stroke()
    grn = L.alpha()
    # --- hairline (draws out, retracts into the dot)
    a = seg(t, 0.10, 0.80, io_quint); b = seg(t, 3.86, 4.20, io_cubic)
    L = Layer(CW, CH); c = L.ctx
    x0 = X + 11; x1 = X + 11 + (LINE_LEN - 11) * a * (1 - b)
    if x1 > x0 + 0.5:
        c.set_line_width(2.0); c.set_line_cap(cairo.LINE_CAP_ROUND)
        c.move_to(x0 - CX0, LINE_Y - CY0); c.line_to(x1 - CX0, LINE_Y - CY0)
        c.set_source_rgba(0, 0, 0, 0.88); c.stroke()
    txt = np.maximum(txt, L.alpha())
    # --- name: letters rise from behind the line, blur->sharp, tracking tightens
    track = 9.0 * (1 - seg(t, 0.25, 1.55, out_cubic))
    nmid = (len(NAME) - 1) / 2
    for i, ch in enumerate(NAME):
        if ch == " ": continue
        p = seg(t, 0.26 + i * 0.042, 0.26 + i * 0.042 + 0.62, out_quint)
        q = seg(ex, i * 0.022, i * 0.022 + 0.34, in_cubic)
        y_off = 78 * (1 - p) + 78 * q
        vis = p * (1 - q)
        if vis <= 0.001: continue
        blur = 4.5 * (1 - p) + 3.0 * q
        L = Layer(CW, CH); c = L.ctx
        c.rectangle(0, 0, CW, LINE_Y - 6 - CY0); c.clip()            # hidden below the line
        draw_char(L, ch, X + NAME_X[i] + (i - nmid) * track, NAME_BASE + y_off, "Caladea", NAME_SIZE)
        al = L.alpha()
        if blur > 0.25: al = cv2.GaussianBlur(al, (0, 0), blur)
        txt = np.maximum(txt, al * min(1.0, vis * 1.6))
    # --- role: types on letter by letter with a green caret
    TS, TE = 0.95, 1.95
    per = (TE - TS) / len(ROLE)
    caret_i = (t - TS) / per
    for i, ch in enumerate(ROLE):
        if ch == " ": continue
        p = seg(t, TS + i * per, TS + i * per + 0.13, out_cubic)
        q = seg(ex, 0.10 + (len(ROLE) - i) * 0.006, 0.10 + (len(ROLE) - i) * 0.006 + 0.30, in_cubic)
        vis = p * (1 - q)
        if vis <= 0.001: continue
        L = Layer(CW, CH); c = L.ctx
        c.rectangle(0, LINE_Y + 6 - CY0, CW, CH); c.clip()             # hidden above the line
        draw_char(L, ch, X + ROLE_X[i] + i * ROLE_TRACK, ROLE_BASE + 7 * (1 - p) - 60 * q, "Inter Medium", ROLE_SIZE)
        al = L.alpha()
        bl = 2.6 * (1 - p) + 2.0 * q
        if bl > 0.25: al = cv2.GaussianBlur(al, (0, 0), bl)
        txt = np.maximum(txt, al * vis)
    # caret
    if TS - 0.08 < t < 2.75:
        ci = min(max(caret_i, 0), len(ROLE))
        k = int(min(ci, len(ROLE) - 1)); fr = ci - k
        cx = X + (ROLE_X[k] + k * ROLE_TRACK) * (1 - fr) + (ROLE_X[min(k + 1, len(ROLE) - 1)] + (k + 1) * ROLE_TRACK if k + 1 < len(ROLE) else ROLE_W) * fr + 3
        if ci >= len(ROLE): cx = X + ROLE_W + 4
        on = 1.0
        if t > TE: on = 1.0 if ((t - TE) % 0.36) < 0.2 else 0.0
        on *= seg(t, TS - 0.08, TS + 0.02, smooth) * (1 - seg(t, 2.6, 2.75, smooth))
        if on > 0:
            L = Layer(CW, CH); c = L.ctx
            c.rectangle(cx - CX0, ROLE_BASE - 26 - CY0, 3, 32); c.fill()
            grn = np.maximum(grn, L.alpha() * on)
    return txt, grn

_cache = {}
def footage(fi):
    if fi not in _cache:
        _cache.clear()
        _cache[fi] = (clean[fi - F0] if F0 <= fi <= F1 else shot[fi]).astype(np.float32)
    return _cache[fi]

def scene(t, i):
    fi = F0 + i
    img = footage(fi).copy()
    tl = t - (T0 - F0) / FPS                     # title-local time
    txt, grn = overlay(tl)
    if txt.max() > 0 or grn.max() > 0:
        crop = img[CY0:CY0 + CH, CX0:CX0 + CW]
        al = np.maximum(txt, grn)
        crop = multiply(crop, shadow(al, 7, 0, 3, 0.55), np.zeros(3, np.float32))
        glow = cv2.GaussianBlur(grn, (0, 0), 6) * 0.55
        crop = over(crop, glow, GREEN)
        crop = over(crop, txt, WHITE)
        crop = over(crop, grn, GREEN)
        img[CY0:CY0 + CH, CX0:CX0 + CW] = crop
    return img

if __name__ == "__main__":
    main(scene, F1 - F0 + 1, "A")
