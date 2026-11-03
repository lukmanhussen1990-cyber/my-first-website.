"""Join rendered frames + captions + comic words + labels + effects + soundtrack.
usage: python3 compose.py            -> almost_home_reel.mp4 (1080x1920, full quality)
       python3 compose.py --preview  -> preview_low.mp4 (540x960, fast)
"""
import json, os, subprocess, sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PREVIEW = "--preview" in sys.argv
K = 0.5 if PREVIEW else 1.0
OW, OH, FPS = int(1080 * K), int(1920 * K), 30
FR = os.path.join(HERE, "out", "frames_preview" if PREVIEW else "frames")
OUT = os.environ.get("OUT") or os.path.join(HERE, "preview_low.mp4" if PREVIEW else "almost_home_reel.mp4")
D = json.load(open(os.path.join(HERE, "shots.json")))
W = D["words"]; DUR = D["duration"]; NF = int(round(DUR * FPS))
w = lambda i: W[i]["s"]
SHOT = {s["id"]: s for s in D["shots"]}
clamp = lambda v, a=0.0, b=1.0: max(a, min(b, v))
sstep = lambda a, b, x: (lambda q: q * q * (3 - 2 * q))(clamp((x - a) / (b - a)))
eout = lambda u: 1 - (1 - clamp(u)) ** 3
def back(u):  # ease-out-back pop (overshoot)
    u = clamp(u); c = 2.2; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2
FEAT = ["-liga", "-clig", "-dlig", "-calt"]
def mont(sz, var=b"Black"):
    f = ImageFont.truetype(os.path.join(HERE, "fonts", "Montserrat.ttf"), max(8, int(sz))); f.set_variation_by_name(var); return f
def bang(sz): return ImageFont.truetype(os.path.join(HERE, "fonts", "Bangers.ttf"), max(8, int(sz)))

# ------------------------------------------------------------------ captions (yellow, thick black outline, words pop in as spoken)
CAP_F = mont(94 * K); CAP_SW = int(12 * K); CAP_Y = 0.715
wcache = {}
def word_img(text):
    if text in wcache: return wcache[text]
    f = CAP_F; bb = f.getbbox(text, stroke_width=CAP_SW, features=FEAT)
    im = Image.new("RGBA", (bb[2] - bb[0] + 8, bb[3] - bb[1] + int(16 * K)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.text((4 - bb[0], 4 - bb[1] + int(8 * K)), text, font=f, fill=(0, 0, 0, 150), stroke_width=CAP_SW, stroke_fill=(0, 0, 0, 150), features=FEAT)  # drop shadow
    im = im.filter(ImageFilter.GaussianBlur(4 * K))
    d = ImageDraw.Draw(im); d.text((4 - bb[0], 4 - bb[1]), text, font=f, fill=(255, 228, 0), stroke_width=CAP_SW, stroke_fill=(0, 0, 0), features=FEAT)
    wcache[text] = im; return im
layouts = {}
def cap_layout(ci):
    if ci in layouts: return layouts[ci]
    c = D["captions"][ci]; sp = CAP_F.getlength(" ", features=FEAT) * 0.9
    imgs = [word_img(x["text"]) for x in c["words"]]
    lines, cur, cw = [], [], 0
    for k, im in enumerate(imgs):
        add = im.width + (sp if cur else 0)
        if cur and cw + add > OW * 0.9: lines.append(cur); cur, cw = [], 0; add = im.width
        cur.append(k); cw += add
    lines.append(cur)
    lh = int(CAP_F.size * 1.12); pos = {}
    y0 = OH * CAP_Y - lh * len(lines) / 2
    for li, ln in enumerate(lines):
        tw = sum(imgs[k].width for k in ln) + sp * (len(ln) - 1); x = (OW - tw) / 2
        for k in ln: pos[k] = (x, y0 + li * lh); x += imgs[k].width + sp
    layouts[ci] = (imgs, pos); return layouts[ci]
def draw_caption(im, t):
    for ci, c in enumerate(D["captions"]):
        if c["t0"] <= t < c["t1"]:
            imgs, pos = cap_layout(ci)
            for k, x in enumerate(c["words"]):
                dt = t - (x["s"] - 0.03)
                if dt < 0: continue
                s = 1 + 0.22 * math.exp(-dt * 16) if dt > 0.06 else 0.7 + 0.5 * dt / 0.06
                wi = imgs[k]
                if abs(s - 1) > 0.01: wi = wi.resize((max(1, int(wi.width * s)), max(1, int(wi.height * s))), Image.BILINEAR)
                cx, cy = pos[k][0] + imgs[k].width / 2, pos[k][1] + imgs[k].height / 2
                im.paste(wi, (int(cx - wi.width / 2), int(cy - wi.height / 2)), wi)
            return

# ------------------------------------------------------------------ comic sound words (Bangers, red/yellow with outlines, bounce)
ccache = {}
def comic_img(text, size, scheme):
    key = (text, size, scheme)
    if key in ccache: return ccache[key]
    f = bang(size * K); s1, s2 = int(size * K * 0.07), int(size * K * 0.13)
    bb = f.getbbox(text, stroke_width=s2); im = Image.new("RGBA", (bb[2] - bb[0] + 20, bb[3] - bb[1] + 20), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    o = (10 - bb[0], 10 - bb[1])
    fill, mid = ((230, 30, 40), (255, 222, 0)) if scheme == 0 else ((255, 222, 0), (230, 30, 40))
    d.text((o[0] + int(5 * K), o[1] + int(7 * K)), text, font=f, fill=(0, 0, 0), stroke_width=s2, stroke_fill=(0, 0, 0))
    d.text(o, text, font=f, fill=mid, stroke_width=s2, stroke_fill=(0, 0, 0))
    d.text(o, text, font=f, fill=fill, stroke_width=s1, stroke_fill=mid)
    ccache[key] = im; return im
COMIC = [  # (start, text, x, y, size, scheme, rot)
    (w(3) - 0.02, "RUMBLE!", 0.5, 0.2, 220, 0, -7),
    (w(14) - 0.05, "RUMBLE!", 0.55, 0.31, 180, 1, 6),
    (w(49) - 0.05, "NOOO!", 0.5, 0.18, 260, 0, -6),
    (w(58) - 0.02, "JINGLE!", 0.5, 0.2, 230, 1, 7),
    (w(63) - 0.02, "CLICK!", 0.6, 0.22, 220, 0, -8),
    (w(69) + 0.05, "THUD!", 0.5, 0.2, 250, 1, -5),
]
def draw_comics(im, t):
    for t0, text, x, y, size, sc, rot in COMIC:
        dt = t - t0
        if not (0 <= dt < 0.8): continue
        ci = comic_img(text, size, sc)
        s = back(dt / 0.16) if dt < 0.16 else 1 + (0.12 * max(0.0, math.sin(dt * 2 * math.pi * 1.6)) if text == 'BA-DUM!' else 0.05 * math.sin(dt * 14) * math.exp(-dt * 3))
        end = 0.65
        if dt > end: s *= 1 - (dt - end) / 0.15 * 0.4
        r = ci.rotate(rot + 3 * math.sin(dt * 9), expand=True, resample=Image.BICUBIC)
        r = r.resize((max(1, int(r.width * s)), max(1, int(r.height * s))), Image.BILINEAR)
        if dt > end: a = r.split()[3].point(lambda v: int(v * clamp(1 - (dt - end) / 0.15))); r.putalpha(a)
        im.paste(r, (int(x * OW - r.width / 2), int(y * OH - r.height / 2)), r)

# ------------------------------------------------------------------ labels (stickers) with arrows
lcache = {}
def label_img(text, size=64, check=False, col=(255, 255, 255)):
    key = (text, size, check, col)
    if key in lcache: return lcache[key]
    f = mont(size * K); bb = f.getbbox(text); pw, ph = int(26 * K), int(16 * K)
    cw = int((bb[3] - bb[1]) * 1.15) if check else 0
    tw, th = bb[2] - bb[0] + cw + (int(14 * K) if check else 0), bb[3] - bb[1]
    im = Image.new("RGBA", (tw + 2 * pw + 12, th + 2 * ph + 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([6, 8, tw + 2 * pw + 6, th + 2 * ph + 12], radius=int(18 * K), fill=(0, 0, 0, 120))
    d.rounded_rectangle([4, 4, tw + 2 * pw + 4, th + 2 * ph + 4], radius=int(18 * K), fill=col, outline=(0, 0, 0), width=max(2, int(6 * K)))
    d.text((pw + 4 - bb[0], ph + 4 - bb[1]), text, font=f, fill=(20, 20, 24))
    if check:  # green check box, drawn (no emoji font needed)
        x0 = pw + 4 + bb[2] - bb[0] + int(14 * K); y0 = ph + 4; s = cw
        d.rounded_rectangle([x0, y0 - 2, x0 + s, y0 + s - 2], radius=int(8 * K), fill=(46, 190, 80))
        d.line([(x0 + s * 0.2, y0 + s * 0.5), (x0 + s * 0.42, y0 + s * 0.72), (x0 + s * 0.82, y0 + s * 0.22)], fill=(255, 255, 255), width=max(3, int(s * 0.16)), joint="curve")
    lcache[key] = im; return im
def arrow(d, a, b, wdt):
    ang = math.atan2(b[1] - a[1], b[0] - a[0]); L = math.hypot(b[0] - a[0], b[1] - a[1])
    if L < 10: return
    tip = b; base = (b[0] - math.cos(ang) * wdt * 3, b[1] - math.sin(ang) * wdt * 3)
    for col, ww in (((0, 0, 0), wdt + int(8 * K)), ((255, 255, 255), wdt)):
        d.line([a, base], fill=col, width=ww)
        l = (base[0] + math.cos(ang + 1.57) * (ww * 1.4), base[1] + math.sin(ang + 1.57) * (ww * 1.4))
        r = (base[0] + math.cos(ang - 1.57) * (ww * 1.4), base[1] + math.sin(ang - 1.57) * (ww * 1.4))
        tp = (tip[0] + math.cos(ang) * (ww - wdt), tip[1] + math.sin(ang) * (ww - wdt))
        d.polygon([l, tp, r], fill=col)
LABELS = [  # (t0, t1, text, x, y, anchor-name or None, rot, opts)
    (w(5), SHOT["03"]["t0"], "5 MIN AWAY", 0.36, 0.18, "house", -5, dict(size=84)),
    (w(19) + 0.2, SHOT["08"]["t0"], "FASTER THAN YOU", 0.5, 0.2, "snail", 4, dict(size=70)),
    (w(32) + 0.6 if False else SHOT["11"]["t0"] + 0.4, SHOT["12"]["t0"], "STILL 5 MIN AWAY", 0.42, 0.17, "house", -4, dict(size=70)),
    (w(77) - 0.05, None, "5 MORE MIN", 0.5, 0.2, None, -5, dict(size=104, col=(255, 228, 0))),
]
def arrival(k): return -1 if k == 0 else (w(109) - 0.05 if k == 1 else w(111) - 0.15 + (k - 2) * 0.15)
def draw_counter(im, t):
    if not (SHOT["29"]["t0"] + 0.2 <= t < SHOT["32"]["t0"]): return
    n = sum(1 for k in range(11) if t >= arrival(k) + 0.25)
    last = max([arrival(k) + 0.25 for k in range(11) if t >= arrival(k) + 0.25] + [0])
    s = 1 + 0.35 * math.exp(-(t - last) * 12) if last else 1
    li = label_img(f"DOCTORS: {n}", 78, False, (255, 228, 0) if n == 11 else (255, 255, 255))
    li = li.resize((max(1, int(li.width * s)), max(1, int(li.height * s))), Image.BILINEAR)
    im.paste(li, (int(OW / 2 - li.width / 2), int(OH * 0.16 - li.height / 2)), li)
def draw_labels(im, t, meta):
    anc = (meta or {}).get("anchors") or {}
    for t0, t1, text, x, y, an, rot, op in LABELS:
        if not (t0 <= t < (t1 if t1 is not None else 1e9)): continue
        dt = t - t0; li = label_img(text, op.get("size", 70), op.get("check", False), op.get("col", (255, 255, 255)))
        s = back(dt / 0.18) if dt < 0.18 else 1 + 0.03 * math.sin(dt * 8)
        cx, cy = x * OW, y * OH
        a = anc.get(an)
        if a:
            d = ImageDraw.Draw(im); ax, ay = a[0] * OW, a[1] * OH
            start = (cx + (ax - cx) * 0.18, cy + (ay - cy) * 0.18 + li.height * 0.4)
            end = (ax - (ax - cx) * 0.12, ay - (ay - cy) * 0.12)
            if s > 0.6: arrow(d, start, end, max(3, int(11 * K)))
        r_ = li.rotate(rot, expand=True, resample=Image.BICUBIC)
        r_ = r_.resize((max(1, int(r_.width * s)), max(1, int(r_.height * s))), Image.BILINEAR)
        im.paste(r_, (int(cx - r_.width / 2), int(cy - r_.height / 2)), r_)
        xm = op.get("xmark")
        if xm is not None and t >= xm:   # big red X stamped over the label
            k = clamp((t - xm) / 0.12); d = ImageDraw.Draw(im); hw = r_.width * 0.62 * (1.4 - 0.4 * k); hh = r_.height * 0.9 * (1.4 - 0.4 * k)
            for col, ww in (((0, 0, 0), int(34 * K)), ((235, 30, 30), int(22 * K))):
                d.line([(cx - hw, cy - hh), (cx + hw, cy + hh)], fill=col, width=ww); d.line([(cx - hw, cy + hh), (cx + hw, cy - hh)], fill=col, width=ww)

# ------------------------------------------------------------------ effects
def zoom(im, z, cx, cy, dx=0, dy=0):
    if abs(z - 1) < 1e-3 and dx == 0 and dy == 0: return im
    ww, hh = OW / z, OH / z
    x0 = min(max(cx - ww / 2 + dx * K, 0), OW - ww); y0 = min(max(cy - hh / 2 + dy * K, 0), OH - hh)
    return im.transform((OW, OH), Image.EXTENT, (x0, y0, x0 + ww, y0 + hh), Image.BICUBIC)
def shake(a, u, f=45): return a * math.sin(u * f) * math.cos(u * f * 0.7), a * math.sin(u * f * 1.13 + 1)
def star(d, x, y, r, col, rot=0.0):
    pts = []
    for k in range(8):
        rr = r if k % 2 == 0 else r * 0.28; a = rot + k * math.pi / 4
        pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
    d.polygon(pts, fill=col)
def sparkles(im, t, ax, ay, spread, n=9, seed=1):
    lay = Image.new("RGBA", (OW, OH), (0, 0, 0, 0)); d = ImageDraw.Draw(lay); rnd = random.Random(seed)
    for k in range(n):
        ox, oy = (rnd.random() - 0.5) * spread, (rnd.random() - 0.5) * spread; ph = rnd.random() * 6.28; sp = 5 + rnd.random() * 5
        tw = max(0.0, math.sin(t * sp + ph)); r = (10 + rnd.random() * 22) * K * tw
        if r < 2: continue
        x, y = ax + ox, ay + oy
        star(d, x, y, r * 1.6, (255, 236, 140, 110), t * 2 + ph); star(d, x, y, r, (255, 215, 60, 255), t * 2 + ph); star(d, x, y, r * 0.45, (255, 255, 230, 255), t * 2 + ph)
    im.paste(lay, (0, 0), lay)
def flames(im, t):
    lay = Image.new("RGBA", (OW, OH), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for side in range(3):  # bottom, left, right
        n = 13 if side == 0 else 16
        for k in range(n):
            rnd = random.Random(k * 7 + side * 101)
            h = (70 + 90 * rnd.random()) * K * (0.75 + 0.35 * math.sin(t * (9 + 4 * rnd.random()) + k))
            wd = (OW / n if side == 0 else OH / n) * 1.25
            for col, f in (((230, 40, 20, 235), 1.0), ((255, 140, 20, 240), 0.68), ((255, 230, 80, 245), 0.38)):
                hh = h * f; sway = 14 * K * math.sin(t * 7 + k * 1.7)
                if side == 0:
                    x0 = k * OW / n + OW / n / 2; pts = [(x0 - wd / 2 * f, OH), (x0 + sway, OH - hh), (x0 + wd / 2 * f, OH)]
                else:
                    y0 = k * OH / n + OH / n / 2; ex = 0 if side == 1 else OW; s = 1 if side == 1 else -1
                    pts = [(ex, y0 - wd / 2 * f * 0.6), (ex + s * hh * 0.8, y0 + sway), (ex, y0 + wd / 2 * f * 0.6)]
                d.polygon(pts, fill=col)
    glow = lay.filter(ImageFilter.GaussianBlur(10 * K))
    im.paste(glow, (0, 0), glow); im.paste(lay, (0, 0), lay)
    tint = Image.new("RGB", (OW, OH), (255, 70, 20)); return Image.blend(im, tint, 0.08)
def speed_lines(im, t, radial=True, n=26):
    lay = Image.new("RGBA", (OW, OH), (0, 0, 0, 0)); d = ImageDraw.Draw(lay); rnd = random.Random(int(t * 30) * 13 + 5)
    cx, cy = OW / 2, OH * 0.55
    for k in range(n):
        if radial:
            a = rnd.random() * 6.283; r0 = OH * (0.28 + rnd.random() * 0.15); r1 = r0 + OH * (0.15 + rnd.random() * 0.3)
            d.line([(cx + math.cos(a) * r0, cy + math.sin(a) * r0), (cx + math.cos(a) * r1, cy + math.sin(a) * r1)], fill=(255, 255, 255, 150), width=max(2, int((3 + rnd.random() * 5) * K)))
        else:
            y = rnd.random() * OH; x0 = rnd.random() * OW; ln = OW * (0.2 + rnd.random() * 0.4)
            d.line([(x0, y), (x0 + ln, y)], fill=(255, 255, 255, 140), width=max(2, int((3 + rnd.random() * 4) * K)))
    im.paste(lay, (0, 0), lay)
def vignette_mask():
    y, x = np.mgrid[0:OH, 0:OW]; r = np.sqrt(((x - OW / 2) / (OW / 2)) ** 2 + ((y - OH / 2) / (OH / 2)) ** 2)
    return np.clip((r - 0.65) / 0.6, 0, 1)[..., None]
VIG = vignette_mask()
def freeze(im, k):
    a = np.asarray(im).astype(np.float32); g = a.mean(2, keepdims=True)
    a = a * (1 - 0.6 * k) + (g * np.array([0.85, 0.95, 1.12])) * 0.6 * k
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def flash(im, k): return Image.blend(im, Image.new("RGB", (OW, OH), (255, 255, 250)), clamp(k))
def danger_level(t):
    pts = [(SHOT["04"]["t0"], 0.35), (w(14), 0.62), (w(15) - 0.05, 0.72), (w(15) + 0.12, 1.0), (SHOT["06"]["t0"] + 0.25, 1.0), (w(18) + 0.2, 0.82), (SHOT["07"]["t0"], 0.8)]
    for (a, va), (b, vb) in zip(pts, pts[1:]):
        if a <= t < b: return va + (vb - va) * sstep(a, b, t)
    return pts[-1][1]
def draw_meter(im, t):
    if not (SHOT["04"]["t0"] <= t < SHOT["07"]["t0"]): return
    lv = danger_level(t); red = lv > 0.92; d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = OW * 0.12, OH * 0.12, OW * 0.88, OH * 0.155
    sx, sy = (shake(6 * K, t, 70) if red else (0, 0))
    x0 += sx; x1 += sx; y0 += sy; y1 += sy
    d.rounded_rectangle([x0 - 6 * K, y0 - 6 * K, x1 + 6 * K, y1 + 6 * K], radius=int(16 * K), fill=(255, 255, 255), outline=(0, 0, 0), width=max(2, int(6 * K)))
    n = 24
    for i in range(n):
        if i / n > lv: break
        f = i / (n - 1); col = (int(80 + 175 * min(1, f * 2)), int(200 - 170 * max(0, f * 2 - 1)), 60)
        d.rectangle([x0 + (x1 - x0) * i / n + 2 * K, y0 + 4 * K, x0 + (x1 - x0) * (i + 1) / n - 2 * K, y1 - 4 * K], fill=col)
    li = label_img("DANGER LEVEL", 60, False, (255, 80, 80) if red and int(t * 8) % 2 else (255, 255, 255))
    im.paste(li, (int(OW / 2 - li.width / 2 + sx), int(y0 - li.height - 4 * K + sy)), li)
def draw_bubble(im, t, meta):
    if t < w(76) - 0.12 or SHOT["26"]["t0"] <= t: return
    anc = ((meta or {}).get("anchors") or {}).get("gap"); ax, ay = (anc[0] * OW, anc[1] * OH) if anc else (OW / 2, OH * 0.7)
    k = clamp((t - (w(76) - 0.12)) / 0.18); s_ = back(k)
    words = [x for x in W[76:81]]; shown = " ".join(x["w"] for x in words if t >= x["s"] - 0.05)
    f = mont(72 * K); lines = ["JUST FIVE MORE", "MINUTES, SWEETIE! ♥"] if t >= W[79]["s"] - 0.05 else [shown.upper()]
    bw = int(OW * 0.86 * s_); bh = int((2 * 92 + 70) * K * s_); cx, cy = OW / 2, OH * 0.4
    d = ImageDraw.Draw(im)
    d.polygon([(ax - 30 * K, cy + bh / 2 - 6), (ax + 30 * K, cy + bh / 2 - 6), (ax, ay - 10 * K)], fill=(255, 255, 255), outline=(0, 0, 0))
    d.rounded_rectangle([cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2], radius=int(40 * K), fill=(255, 255, 255), outline=(0, 0, 0), width=max(2, int(7 * K)))
    d.polygon([(ax - 26 * K, cy + bh / 2 - 8), (ax + 26 * K, cy + bh / 2 - 8), (ax, ay - 16 * K)], fill=(255, 255, 255))
    if s_ > 0.8:
        for i, ln in enumerate(lines):
            tw = f.getlength(ln); d.text((cx - tw / 2, cy - bh / 2 + 36 * K + i * 92 * K + (46 * K if len(lines) == 1 else 0)), ln, font=f, fill=(235, 60, 120))
def god_rays(im, t, cx, cy):
    lay = Image.new("RGBA", (OW, OH), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for k in range(14):
        a = k / 14 * 2 * math.pi + t * 0.4; a2 = a + 0.12; R = OH
        d.polygon([(cx, cy), (cx + math.cos(a) * R, cy + math.sin(a) * R), (cx + math.cos(a2) * R, cy + math.sin(a2) * R)], fill=(255, 226, 120, 70))
    im.paste(lay, (0, 0), lay)
def beat(t, t0):  # heartbeat pulse 0..1 (double thump, 1.6 beats per second) after t0
    if t < t0: return 0.0
    ph = ((t - t0) * 1.6) % 1; return math.exp(-((ph - 0.05) / 0.06) ** 2) + 0.6 * math.exp(-((ph - 0.3) / 0.06) ** 2)
def effects(im, sid, u, t, meta):
    anc = (meta or {}).get("anchors") or {}
    P = lambda name, dflt: (anc[name][0] * OW, anc[name][1] * OH) if anc.get(name) else dflt
    if sid == "01":
        k = t - w(3)
        if k > 0: dx, dy = shake(12 * math.exp(-k * 2.5), k, 60); im = zoom(im, 1.03, OW / 2, OH / 2, dx, dy)
    elif sid == "05":
        dx, dy = shake(10, t, 55); im = zoom(im, 1.05 + 0.04 * eout((t - SHOT["05"]["t0"]) / 0.15), OW / 2, OH * 0.45, dx, dy)
    elif sid == "08": im = zoom(im, 1 + 0.08 * u, OW / 2, OH * 0.42)
    elif sid == "11": im = zoom(im, 1 + 0.05 * u, OW / 2, OH * 0.5)
    elif sid == "12": god_rays(im, t, OW * 0.5, OH * 0.35); sparkles(im, t, OW * 0.5, OH * 0.38, 700 * K, 14, 3)
    elif sid == "14":
        k = t - w(49) + 0.05
        if k > 0: dx, dy = shake(14 * math.exp(-k * 3), k, 60); im = zoom(im, 1 + 0.1 * eout(k / 0.12), OW / 2, OH * 0.38, dx, dy)
    elif sid == "19": sparkles(im, t, *P("keys", (OW * 0.5, OH * 0.5)), 520 * K, 14, 5)
    elif sid == "21":
        k = t - w(63)
        if 0 < k < 0.3: im = zoom(im, 1 + 0.05 * (1 - k / 0.3), OW / 2, OH / 2)
    elif sid == "23":
        k = t - w(69) - 0.05
        if k > 0: dx, dy = shake(22 * math.exp(-k * 5), k, 60); im = zoom(im, 1.05, OW / 2, OH / 2, dx, dy)
    elif sid == "24": im = zoom(im, 1 + 0.08 * u, OW / 2, OH * 0.6)
    elif sid == "26":
        im = zoom(im, 1 + 0.1 * u, OW / 2, OH * 0.42)
    if sid in ("03", "22"): speed_lines(im, t, radial=sid == "22", n=20)
    if t > DUR - 0.6: im = Image.blend(im, Image.new("RGB", (OW, OH)), clamp((t - (DUR - 0.6)) / 0.6))
    return im

# ------------------------------------------------------------------ mosaic blur box (from the 3D body of YOU, every frame)
def mosaic(im, rect):
    x0, y0, x1, y1 = rect
    X0, Y0, X1, Y1 = int(math.floor(x0 * OW)), int(math.floor(y0 * OH)), int(math.ceil(x1 * OW)), int(math.ceil(y1 * OH))
    X0, Y0, X1, Y1 = max(0, X0), max(0, Y0), min(OW, X1), min(OH, Y1)
    bw, bh = X1 - X0, Y1 - Y0
    if bw < 2 or bh < 2: return im
    blk = max(int(16 * K), int(round(max(bw, bh) / 10)))
    reg = im.crop((X0, Y0, X1, Y1))
    small = reg.resize((max(1, math.ceil(bw / blk)), max(1, math.ceil(bh / blk))), Image.BOX)
    big = small.resize((math.ceil(bw / blk) * blk, math.ceil(bh / blk) * blk), Image.NEAREST).crop((0, 0, bw, bh))
    im.paste(big, (X0, Y0)); return im

def shot_at(t):
    for s in D["shots"]:
        if s["t0"] <= t < s["t1"]: return s
    return D["shots"][-1]

cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-",
       "-i", os.path.join(HERE, "audio", "mix.wav"), "-t", f"{(int(os.environ['FRANGE'].split(':')[1]) - int(os.environ['FRANGE'].split(':')[0])) / FPS if 'FRANGE' in os.environ else DUR:.3f}", "-map", "0:v", "-map", "1:a",
       "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
cmd += (["-preset", "veryfast", "-crf", "28", "-c:a", "aac", "-b:a", "128k"] if PREVIEW else
        ["-preset", "slow", "-crf", "21", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k"])
cmd += [OUT]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
missing = 0
FR0, FR1 = (int(v) for v in os.environ.get("FRANGE", "0:%d" % NF).split(":"))
for f in range(FR0, FR1):
    t = f / FPS; s = shot_at(t)
    path = os.path.join(FR, f"{f:05d}.jpg"); meta = None
    if os.path.exists(path):
        im = Image.open(path).convert("RGB")
        mp = path[:-4] + ".json"; meta = json.load(open(mp)) if os.path.exists(mp) else None
    else: missing += 1; im = Image.new("RGB", (OW, OH))
    if im.size != (OW, OH): im = im.resize((OW, OH), Image.BICUBIC)
    im = effects(im, s["id"], (t - s["t0"]) / s["dur"], t, meta)
    draw_labels(im, t, meta); draw_meter(im, t); draw_bubble(im, t, meta); draw_comics(im, t); draw_caption(im, t)
    p.stdin.write(im.tobytes())
p.stdin.close(); p.wait()
print("wrote", OUT, "frames", NF, "missing", missing)
