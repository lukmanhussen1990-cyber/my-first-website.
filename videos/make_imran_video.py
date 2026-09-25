"""Render the IMRAN name-reveal video with an animated butterfly finale.

Recreates the original clip's style (glowing letters written in one by one on
black, then a character sweeps across and wipes the name) with the text
changed to "IMRAN" and the closing character replaced by a flapping butterfly.

Usage: python3 make_imran_video.py <original.mp4> <output.mp4>
The original clip is only used as the audio source.
"""
import math
import subprocess
import sys

import cv2
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W = H = 1080
FPS = 60
NFRAMES = 279  # 4.65 s, same length as the original
rng = np.random.default_rng(7)

SERIF = "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf"
SERIF_IT = "/usr/share/fonts/truetype/freefont/FreeSerifBoldItalic.ttf"
BUBBLE = "/mnt/skills/examples/canvas-design/canvas-fonts/NationalPark-Bold.ttf"


# ---------------------------------------------------------------- helpers
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out_back(u, k=1.9):
    u = clamp(u) - 1
    return 1 + (k + 1) * u ** 3 + k * u ** 2


def ease_in_out(u):
    u = clamp(u)
    return u * u * (3 - 2 * u)


def ease_out(u):
    u = clamp(u)
    return 1 - (1 - u) ** 3


def blit(canvas, rgb, a, cx, cy, scale=1.0, rot=0.0, opacity=1.0, sx=1.0):
    """Alpha-composite a straight-alpha sprite onto canvas centred at (cx, cy)."""
    if opacity <= 0.002 or scale <= 0.002:
        return
    h, w = a.shape
    M = cv2.getRotationMatrix2D((w / 2, h / 2), rot, scale)
    M[:, 0] *= sx
    M[0, 2] = cx - (M[0, 0] * w / 2 + M[0, 1] * h / 2)
    M[1, 2] = cy - (M[1, 0] * w / 2 + M[1, 1] * h / 2)
    corners = np.array([[0, 0, 1], [w, 0, 1], [0, h, 1], [w, h, 1]], np.float32) @ M.T
    x0 = int(max(0, math.floor(corners[:, 0].min()) - 2))
    y0 = int(max(0, math.floor(corners[:, 1].min()) - 2))
    x1 = int(min(W, math.ceil(corners[:, 0].max()) + 2))
    y1 = int(min(H, math.ceil(corners[:, 1].max()) + 2))
    if x1 <= x0 or y1 <= y0:
        return
    M2 = M.copy()
    M2[0, 2] -= x0
    M2[1, 2] -= y0
    size = (x1 - x0, y1 - y0)
    wa = cv2.warpAffine(a, M2, size, flags=cv2.INTER_LINEAR) * opacity
    wp = cv2.warpAffine(rgb * a[..., None], M2, size, flags=cv2.INTER_LINEAR) * opacity
    roi = canvas[y0:y1, x0:x1]
    roi *= 1 - wa[..., None]
    roi += wp


def shade_glyph(alpha, color, bevel=5.0):
    """Give a flat glyph mask a soft rounded/bevelled 3D look."""
    m = (alpha > 0.35).astype(np.uint8)
    d = cv2.distanceTransform(m, cv2.DIST_L2, 3)
    rounded = np.clip(d / bevel, 0, 1) ** 0.6
    h = alpha.shape[0]
    grad = np.linspace(1.12, 0.78, h, dtype=np.float32)[:, None]
    # top-left rim light
    hl = np.clip(alpha - np.roll(np.roll(alpha, 2, 0), 2, 1), 0, 1)
    rgb = np.array(color, np.float32)[None, None, :] * (0.55 + 0.5 * rounded)[..., None] * grad[..., None]
    rgb += 0.55 * hl[..., None]
    return np.clip(rgb, 0, 1.6).astype(np.float32)


def render_glyph(ch, font_path, cap_px, ss=4):
    font = ImageFont.truetype(font_path, 100 * ss)
    l, t, r, b = font.getbbox(ch)
    pad = 12 * ss
    img = Image.new("L", (r - l + 2 * pad, b - t + 2 * pad), 0)
    ImageDraw.Draw(img).text((pad - l, pad - t), ch, font=font, fill=255)
    a = np.asarray(img, np.float32) / 255.0
    k = cap_px / ((b - t) / ss) / ss  # scale so ink height == cap_px
    a = cv2.resize(a, (max(1, round(a.shape[1] * k)), max(1, round(a.shape[0] * k))),
                   interpolation=cv2.INTER_AREA)
    return a


# ---------------------------------------------------------------- letters
CAP = 46
TEXT_CX, TEXT_CY = 578, 918
GAP = 16
LETTERS = [
    # char, font, colour, reveal start frame
    dict(ch="I", font=SERIF, color=(1.0, 0.97, 0.92), start=0),
    dict(ch="M", font=SERIF, color=(1.0, 0.9, 0.08), start=26),
    dict(ch="R", font=SERIF, color=(1.0, 0.97, 0.92), start=54),
    dict(ch="A", font=BUBBLE, color=(0.22, 1.0, 0.28), start=82),
    dict(ch="N", font=SERIF_IT, color=(0.3, 1.0, 0.35), start=108, box=True),
]
for L in LETTERS:
    L["a"] = render_glyph(L["ch"], L["font"], CAP)
    L["rgb"] = shade_glyph(L["a"], L["color"])
    cols = np.nonzero(L["a"].max(0) > 0.05)[0]
    L["ink_w"] = float(cols.max() - cols.min())

widths = [L["ink_w"] + (14 if L.get("box") else 0) for L in LETTERS]
total = sum(widths) + GAP * (len(LETTERS) - 1)
x = TEXT_CX - total / 2
for L, w in zip(LETTERS, widths):
    L["x"] = x + w / 2
    L["y"] = TEXT_CY
    x += w + GAP

POP_DELAY = 15  # frames from swoosh start until the letter pops in
SWOOSH_LEN = 17


def swoosh_path(L, n=60):
    """Spiral-in path that ends on the letter centre."""
    t = np.linspace(0, 1, n)
    rad = 48 * (1 - t) ** 1.2
    th0 = -2.4 + 0.9 * (ord(L["ch"]) % 3)
    th = th0 + 1.7 * math.pi * t
    xs = L["x"] + rad * np.cos(th) * 1.25
    ys = L["y"] + rad * np.sin(th) * 0.75
    return np.stack([xs, ys], 1)


for L in LETTERS:
    L["path"] = swoosh_path(L)


def draw_swoosh(layer, L, f):
    u = (f - L["start"]) / SWOOSH_LEN
    if u < 0 or u > 1.6:
        return
    path = L["path"]
    n = len(path)
    head = int(clamp(u) * (n - 1))
    fade = 1.0 if u <= 1 else clamp(1 - (u - 1) / 0.6)
    tail = max(0, head - 26)
    col = np.array(L["color"], np.float32)
    for i in range(tail, head):
        k = (i - tail + 1) / max(1, head - tail)
        th = 1 + 5 * k
        c = tuple(float(v) for v in (col * (0.35 + 0.9 * k) * fade))
        p0 = tuple(int(v * 4) for v in path[i])
        p1 = tuple(int(v * 4) for v in path[i + 1])
        cv2.line(layer, p0, p1, c, max(1, int(round(th))), cv2.LINE_AA, shift=2)
    if u <= 1:
        hx, hy = path[head]
        cv2.circle(layer, (int(hx * 4), int(hy * 4)), 4 * 5, (1.4, 1.4, 1.3), -1, cv2.LINE_AA, shift=2)


def draw_box(layer, L, f, opacity):
    """Skewed box outline around the last letter, drawn progressively."""
    t0 = L["start"] + POP_DELAY + 2
    u = clamp((f - t0) / 14)
    if u <= 0 or opacity <= 0:
        return
    w = L["ink_w"] + 20
    h = CAP + 16
    cx, cy = L["x"], L["y"]
    sk = 9
    pts = np.array([[cx - w / 2 + sk, cy - h / 2], [cx + w / 2 + sk, cy - h / 2 - 3],
                    [cx + w / 2 - sk, cy + h / 2], [cx - w / 2 - sk, cy + h / 2 + 3]], np.float32)
    segs = [(pts[i], pts[(i + 1) % 4]) for i in range(4)]
    lens = [np.linalg.norm(b - a) for a, b in segs]
    remain = u * sum(lens)
    col = tuple(float(v) * opacity for v in (0.25, 1.0, 0.3))
    for (a, b), ln in zip(segs, lens):
        if remain <= 0:
            break
        k = min(1.0, remain / ln)
        e = a + (b - a) * k
        cv2.line(layer, tuple(int(v * 4) for v in a), tuple(int(v * 4) for v in e), col, 2,
                 cv2.LINE_AA, shift=2)
        remain -= ln


# ---------------------------------------------------------------- butterfly art
BS = 640          # art resolution (supersampled)
BU = 290.0        # pixels per wing unit at art resolution
BC = BS / 2       # body centre column/row


def catmull(points, per=24):
    p = np.array(points, np.float64)
    p = np.vstack([p[-1], p, p[0], p[1]])
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for t in np.linspace(0, 1, per, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    return np.array(out)


def to_px(pts):
    return np.stack([BC + pts[:, 0] * BU, BC + pts[:, 1] * BU], 1)


def palette(t, stops):
    t = np.clip(t, 0, 1)
    pos = np.array([s[0] for s in stops])
    cols = np.array([s[1] for s in stops], np.float32)
    out = np.zeros(t.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = np.interp(t, pos, cols[:, c])
    return out


def build_wing(outline, root, stops, eye=None, dots=14):
    poly = to_px(catmull(outline))
    mask_img = Image.new("L", (BS, BS), 0)
    ImageDraw.Draw(mask_img).polygon([tuple(p) for p in poly], fill=255)
    mask = np.asarray(mask_img, np.float32) / 255
    yy, xx = np.mgrid[0:BS, 0:BS].astype(np.float32)
    rx, ry = BC + root[0] * BU, BC + root[1] * BU
    r = np.hypot(xx - rx, yy - ry) / BU
    rgb = palette(r / 1.05, stops)
    # iridescent sheen band
    sheen = np.exp(-((r - 0.45) / 0.12) ** 2) * 0.25
    rgb += sheen[..., None] * np.array([0.6, 0.8, 1.0], np.float32)
    # veins
    vein = Image.new("L", (BS, BS), 0)
    dv = ImageDraw.Draw(vein)
    edge = poly[:: max(1, len(poly) // 9)]
    for p in edge:
        dv.line([(rx, ry), tuple(p)], fill=150, width=5)
    vein = cv2.GaussianBlur(np.asarray(vein, np.float32) / 255, (0, 0), 1.2)
    rgb *= (1 - 0.55 * vein)[..., None]
    # dark glossy border with white spots
    dist = cv2.distanceTransform((mask > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
    border = np.clip(1 - (dist - 16) / 5, 0, 1)
    border_col = np.array([0.16, 0.04, 0.32], np.float32)
    rgb = rgb * (1 - border[..., None]) + border_col * border[..., None]
    spots = Image.new("L", (BS, BS), 0)
    ds = ImageDraw.Draw(spots)
    idx = np.linspace(0, len(poly) - 1, dots + 2)[1:-1].astype(int)
    for i in idx:
        px, py = poly[i]
        vx, vy = rx - px, ry - py
        n = math.hypot(vx, vy) + 1e-6
        cx, cy = px + vx / n * 9, py + vy / n * 9
        rr = 4.5 if i % 2 else 3.2
        ds.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=255)
    spots = np.asarray(spots, np.float32) / 255
    rgb = rgb * (1 - spots[..., None]) + np.array([1.0, 0.98, 0.9]) * spots[..., None]
    if eye is not None:
        ex, ey, er = BC + eye[0] * BU, BC + eye[1] * BU, eye[2] * BU
        d = np.hypot(xx - ex, yy - ey)
        ring = np.clip(1 - np.abs(d - er * 0.75) / (er * 0.28), 0, 1)
        core = np.clip(1 - d / (er * 0.5), 0, 1) ** 0.5
        glint = np.clip(1 - np.hypot(xx - ex + er * 0.18, yy - ey + er * 0.18) / (er * 0.16), 0, 1)
        rgb = rgb * (1 - ring[..., None]) + np.array([1.0, 0.85, 0.2]) * ring[..., None]
        rgb = rgb * (1 - core[..., None]) + np.array([0.08, 0.02, 0.2]) * core[..., None]
        rgb = rgb * (1 - glint[..., None]) + np.array([1.0, 1.0, 1.0]) * glint[..., None]
    return rgb.astype(np.float32), mask


UPPER = [(0.04, -0.06), (0.18, -0.52), (0.5, -0.86), (0.86, -0.92), (1.04, -0.72),
         (0.98, -0.38), (0.72, -0.1), (0.3, 0.0)]
LOWER = [(0.05, 0.02), (0.42, 0.04), (0.74, 0.26), (0.8, 0.52), (0.62, 0.78),
         (0.34, 0.86), (0.14, 0.62), (0.04, 0.28)]
UP_STOPS = [(0.0, (0.42, 0.08, 0.78)), (0.3, (0.95, 0.18, 0.62)), (0.62, (1.0, 0.5, 0.12)),
            (0.9, (1.0, 0.86, 0.25)), (1.0, (1.0, 0.95, 0.5))]
LO_STOPS = [(0.0, (0.3, 0.06, 0.62)), (0.35, (0.2, 0.35, 1.0)), (0.7, (0.1, 0.85, 1.0)),
            (1.0, (0.55, 1.0, 0.95))]

up_rgb, up_a = build_wing(UPPER, (0.03, -0.03), UP_STOPS, dots=16)
lo_rgb, lo_a = build_wing(LOWER, (0.03, 0.04), LO_STOPS, eye=(0.46, 0.5, 0.13), dots=12)


def build_body():
    img = Image.new("RGBA", (BS, BS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # antennae
    for sgn in (-1, 1):
        pts = [(BC + sgn * (6 + 60 * t ** 1.3), BC - 70 - 150 * t + 25 * t * t) for t in np.linspace(0, 1, 30)]
        d.line(pts, fill=(40, 25, 50, 255), width=6)
        ex, ey = pts[-1]
        d.ellipse([ex - 11, ey - 11, ex + 11, ey + 11], fill=(255, 205, 60, 255))
    # abdomen, thorax, head
    d.ellipse([BC - 16, BC - 30, BC + 16, BC + 150], fill=(45, 22, 60, 255))
    d.ellipse([BC - 22, BC - 62, BC + 22, BC + 10], fill=(60, 30, 80, 255))
    d.ellipse([BC - 18, BC - 94, BC + 18, BC - 56], fill=(50, 25, 70, 255))
    for i in range(6):
        y = BC + 20 + i * 20
        d.line([(BC - 13, y), (BC + 13, y)], fill=(120, 80, 160, 255), width=3)
    arr = np.asarray(img, np.float32) / 255
    rgb, a = arr[..., :3].copy(), arr[..., 3].copy()
    # glossy highlight stripe
    yy, xx = np.mgrid[0:BS, 0:BS].astype(np.float32)
    hl = np.clip(1 - np.abs(xx - (BC - 6)) / 5, 0, 1) * (a > 0.5)
    rgb += 0.35 * hl[..., None]
    return rgb, a


body_rgb, body_a = build_body()


def butterfly_sprite(flap_up, flap_lo, bright=1.0):
    """Compose a butterfly RGBA at half the art resolution for a given flap state."""
    out_rgb = np.zeros((BS, BS, 3), np.float32)
    out_a = np.zeros((BS, BS), np.float32)

    def over(rgb, a):
        nonlocal out_rgb, out_a
        out_rgb = out_rgb * (1 - a[..., None]) + rgb * a[..., None]
        out_a = out_a + a * (1 - out_a)

    for wrgb, wa, s in ((lo_rgb, lo_a, flap_lo), (up_rgb, up_a, flap_up)):
        M = np.float32([[s, 0, BC * (1 - s)], [0, 1, 0]])
        shade = (0.55 + 0.45 * s) * bright
        r_rgb = cv2.warpAffine(wrgb * shade, M, (BS, BS))
        r_a = cv2.warpAffine(wa, M, (BS, BS))
        over(r_rgb, r_a)
        over(r_rgb[:, ::-1], r_a[:, ::-1])
    over(body_rgb, body_a)
    # premultiplied -> straight alpha, downsample for anti-aliasing
    half = BS // 2
    a = cv2.resize(out_a, (half, half), interpolation=cv2.INTER_AREA)
    prem = cv2.resize(out_rgb * out_a[..., None], (half, half), interpolation=cv2.INTER_AREA)
    rgb = prem / np.maximum(a[..., None], 1e-4)
    return rgb, a


# ---------------------------------------------------------------- butterfly motion
T_APPEAR, T_HOVER, T_DASH, T_REST, T_LEAVE, T_GONE = 138, 152, 186, 210, 232, 252
START = np.array([338.0, 910.0])
END = np.array([772.0, 904.0])
BSCALE = 0.5  # sprite scale -> ~150 px wingspan

# flap phase integrated from a per-frame flap frequency
freq = np.full(NFRAMES + 2, 2 * math.pi / 12)
freq[T_DASH:T_REST] = 2 * math.pi / 7
freq[T_LEAVE:] = 2 * math.pi / 8
phase_tab = np.concatenate([[0], np.cumsum(freq)])


def phase_at(f):
    i = int(math.floor(f))
    return phase_tab[i] + (f - i) * freq[min(i, len(freq) - 1)]


def butterfly_state(f):
    """(x, y, scale, rot_deg, opacity) at (possibly fractional) frame f."""
    if f < T_APPEAR or f >= T_GONE:
        return None
    if f < T_HOVER:
        u = (f - T_APPEAR) / (T_HOVER - T_APPEAR)
        s = BSCALE * ease_out_back(u, 1.6)
        x, y = START + [0, 10 * (1 - ease_out(u))]
        return x, y, max(0.0, s), 25 * (1 - ease_out(u)) * math.sin(u * 9), clamp(u * 3)
    if f < T_DASH:
        u = f - T_HOVER
        x = START[0] - 5 * math.sin(u / 11)
        y = START[1] + 7 * math.sin(2 * math.pi * u / 40)
        return x, y, BSCALE, 6 * math.sin(2 * math.pi * u / 55), 1.0
    if f < T_REST:
        u = ease_in_out((f - T_DASH) / (T_REST - T_DASH))
        x = START[0] + (END[0] - START[0]) * u
        y = START[1] + (END[1] - START[1]) * u - 26 * math.sin(math.pi * u)
        return x, y, BSCALE, -16 * math.sin(math.pi * u), 1.0
    if f < T_LEAVE:
        u = f - T_REST
        x = END[0] + 4 * math.sin(u / 7)
        y = END[1] + 6 * math.sin(2 * math.pi * u / 36)
        return x, y, BSCALE, 5 * math.sin(2 * math.pi * u / 44), 1.0
    u = (f - T_LEAVE) / (T_GONE - T_LEAVE)
    x = END[0] + 30 * u
    y = END[1] - 45 * u ** 1.4
    s = BSCALE * (1 - ease_in_out(u))
    return x, y, s, 10 * u, clamp((1 - u) * 3)


def flaps(f):
    ph = phase_at(f)
    up = 0.14 + 0.86 * (0.5 + 0.5 * math.cos(ph)) ** 0.85
    lo = 0.2 + 0.8 * (0.5 + 0.5 * math.cos(ph - 0.45)) ** 0.85
    return up, lo


# letters get wiped when the butterfly passes them during the dash
for L in LETTERS:
    L["erase"] = None
    for fi in range(T_DASH, T_REST + 1):
        st = butterfly_state(fi)
        if st and st[0] >= L["x"] - 18:
            L["erase"] = fi
            break
ERASE_LEN = 8


def letter_state(L, f):
    t0 = L["start"] + POP_DELAY
    if f < t0:
        return 0.0, 1.0, 1.0
    u = (f - t0) / 11
    scale = 1.4 - 0.4 * ease_out_back(u, 2.4)
    alpha = clamp((f - t0) / 4)
    flash = 1 + 0.9 * math.exp(-(f - t0) / 5)
    if L["erase"] is not None and f >= L["erase"]:
        v = clamp((f - L["erase"]) / ERASE_LEN)
        alpha *= 1 - v
        scale *= 1 + 0.35 * v
        flash *= 1 + 0.6 * (1 - v)
    return alpha, scale, flash


# ---------------------------------------------------------------- particles
particles = []  # [x, y, vx, vy, age, life, r, g, b, size, star]


def emit(x, y, n, colors, speed=(1.0, 4.0), life=(18, 34), size=(1.2, 2.8), spread=None, vy_bias=0.0):
    for _ in range(n):
        ang = rng.uniform(0, 2 * math.pi) if spread is None else rng.normal(spread[0], spread[1])
        sp = rng.uniform(*speed)
        c = colors[rng.integers(len(colors))]
        particles.append([x + rng.normal(0, 4), y + rng.normal(0, 4), math.cos(ang) * sp,
                          math.sin(ang) * sp + vy_bias, 0, rng.uniform(*life), *c,
                          rng.uniform(*size), rng.random() < 0.3])


def step_and_draw_particles(layer):
    alive = []
    for p in particles:
        p[4] += 1
        if p[4] >= p[5]:
            continue
        p[0] += p[2]
        p[1] += p[3]
        p[2] *= 0.94
        p[3] = p[3] * 0.94 + 0.04
        k = 1 - p[4] / p[5]
        tw = 0.75 + 0.25 * math.sin(p[4] * 0.9 + p[0])
        col = tuple(float(v) * k * tw * 1.3 for v in p[6:9])
        cx, cy = int(p[0] * 4), int(p[1] * 4)
        cv2.circle(layer, (cx, cy), int(p[9] * 4 * (0.5 + 0.5 * k)), col, -1, cv2.LINE_AA, shift=2)
        if p[10]:
            arm = int(p[9] * 4 * 3 * k)
            cv2.line(layer, (cx - arm, cy), (cx + arm, cy), col, 1, cv2.LINE_AA, shift=2)
            cv2.line(layer, (cx, cy - arm), (cx, cy + arm), col, 1, cv2.LINE_AA, shift=2)
        alive.append(p)
    particles[:] = alive


PASTEL = [(1.0, 0.55, 0.85), (0.6, 0.85, 1.0), (1.0, 0.9, 0.45), (0.75, 0.6, 1.0), (1.0, 1.0, 1.0)]


# ---------------------------------------------------------------- main render
def glow(img):
    small = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    big = cv2.GaussianBlur(small, (0, 0), 14)
    mid = cv2.GaussianBlur(small, (0, 0), 3.5)
    big = cv2.resize(big, (W, H), interpolation=cv2.INTER_LINEAR)
    mid = cv2.resize(mid, (W, H), interpolation=cv2.INTER_LINEAR)
    near = cv2.GaussianBlur(img, (0, 0), 2.2)
    return img + 0.35 * near + 0.9 * mid + 1.3 * big


def render_frame(f):
    canvas = np.zeros((H, W, 3), np.float32)
    light = np.zeros((H, W, 3), np.float32)  # additive strokes / sparks

    # letters
    for L in LETTERS:
        draw_swoosh(light, L, f)
        alpha, scale, flash = letter_state(L, f)
        if L.get("box"):
            box_op = alpha if L["erase"] is not None and f >= L["erase"] else 1.0
            draw_box(light, L, f, box_op if f >= L["start"] + POP_DELAY else 0)
        if alpha > 0:
            blit(canvas, np.clip(L["rgb"] * flash, 0, 3), L["a"], L["x"], L["y"], scale, 0, alpha)
        if L["erase"] == f:
            emit(L["x"], L["y"], 26, [L["color"], (1, 1, 1)], speed=(1.5, 5.5), life=(20, 40))
        if f == L["start"] + POP_DELAY:
            emit(L["x"], L["y"], 10, [L["color"]], speed=(0.8, 3.0), life=(12, 24), size=(1, 2))

    # butterfly (with motion blur while dashing)
    if f == T_APPEAR:
        emit(START[0], START[1], 40, PASTEL, speed=(1.5, 6.0), life=(20, 42))
    if f == T_GONE - 3:
        st = butterfly_state(f)
        emit(st[0], st[1], 34, PASTEL, speed=(1.0, 4.5), life=(24, 46))
    if T_DASH <= f < T_REST:
        st = butterfly_state(f)
        emit(st[0] - 20, st[1] + 10, 4, PASTEL, speed=(0.3, 1.6), life=(22, 40), size=(1, 2.4))
    elif T_HOVER <= f < T_LEAVE and f % 3 == 0:
        st = butterfly_state(f)
        emit(st[0], st[1] + 20, 1, PASTEL, speed=(0.2, 0.8), life=(20, 36), size=(0.8, 1.8), vy_bias=0.4)

    subs = [f - 0.8, f - 0.53, f - 0.27, f] if T_DASH <= f < T_REST else [f]
    acc = None
    for sf in subs:
        st = butterfly_state(sf)
        if st is None:
            continue
        layer = np.zeros((H, W, 3), np.float32) if len(subs) > 1 else canvas
        up, lo = flaps(sf)
        rgb, a = butterfly_sprite(up, lo, 0.82)
        x, y, s, rot, op = st
        if len(subs) > 1:
            base = canvas.copy()
            blit(base, rgb, a, x, y, s, rot, op)
            acc = base if acc is None else acc + base
        else:
            blit(canvas, rgb, a, x, y, s, rot, op)
    if acc is not None:
        canvas = acc / len(subs)

    step_and_draw_particles(light)
    img = canvas + light
    img = glow(img)
    img = img / (1 + np.maximum(img - 0.85, 0))  # soft highlight roll-off
    return np.clip(img * 255 + 0.5, 0, 255).astype(np.uint8)


def main(src, dst, preview_frames=None):
    if preview_frames:
        for f in range(NFRAMES):
            fr = render_frame(f)
            if f in preview_frames:
                cv2.imwrite(f"{dst}_{f:03d}.png", cv2.cvtColor(fr, cv2.COLOR_RGB2BGR))
        return
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ff, "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", src, "-map", "0:v", "-map", "1:a?",
           "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
           "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
           "-c:a", "copy", "-shortest", "-movflags", "+faststart", dst]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(NFRAMES):
        proc.stdin.write(render_frame(f).tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit("ffmpeg failed")


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[3] == "--preview":
        main(sys.argv[1], sys.argv[2], set(int(v) for v in sys.argv[4].split(",")))
    else:
        main(sys.argv[1], sys.argv[2])
