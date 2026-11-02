#!/usr/bin/env python3
"""Image / clip -> video renderer for the handkerchief reel (1080x1920, 30 fps).

Every shot is one still image (images/shot_XX.png, from ChatGPT) or one Kling clip (clips/shot_XX.mp4). The
camera moves over it (slow push-in / pan / tilt, punch-ins on the beat, shake, sway, bob), then cartoon effects
are drawn on top (stink lines, sweat drops, hearts, sparkles, glow, tears, petals, a fly, date labels, the
"0.1 SEC" display, flashes), all in the style of the last reels. The camera and effects of each shot are set in
edit.py (positions are in image coordinates, so effects stay glued to the picture while the camera moves).
A shot without an image yet gets a placeholder card (so timing can be checked before the images exist).

Usage:
  python3 render.py frames [from] [to]       render JPEG frames to build/frames/ (4 processes)
  python3 render.py stills <t1> <t2> ...     single frames at these times -> build/stills/
  python3 render.py sheet                    one frame per shot (middle) -> build/sheet.jpg (contact sheet)
  python3 render.py encode [out.mp4]         frames + audio/mix_final.wav + captions -> final.mp4
  env SCALE=0.5 renders half-size frames (fast previews; encode scales them back up)
"""
import json
import math
import os
import subprocess
import sys
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(HERE, *a)
FPS = 30
SCALE = float(os.environ.get("SCALE", "1"))
W, H = int(round(1080 * SCALE)), int(round(1920 * SCALE))
PLAN = json.load(open(P("shots.json")))
SHOTS = PLAN["shots"]
DUR = PLAN["duration"]
NFRAMES = int(round(DUR * FPS))
FONT = P("fonts", "PixelifySans-Bold.ttf")
BUILD = P(os.environ.get("BUILD", "build"))

sys.path.insert(0, HERE)
import edit  # noqa: E402  (per-shot camera + effects)

SPEC = edit.SPEC


# ------------------------------------------------------------------------------------------ helpers
def clamp(x, a, b):
    return a if x < a else b if x > b else x


def lerp(a, b, k):
    return a + (b - a) * k


def ease(x, kind="inout"):
    x = clamp(x, 0.0, 1.0)
    if kind == "linear":
        return x
    if kind == "out":
        return 1 - (1 - x) ** 3
    if kind == "in":
        return x ** 3
    if kind == "back":                      # overshoot then settle (pop-ins)
        c = 1.9
        return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2
    return x * x * (3 - 2 * x)


def hsh(*a):
    """Deterministic pseudo-random 0..1 from numbers."""
    v = math.sin(sum((i + 1) * 12.9898 * float(x) for i, x in enumerate(a)) + 78.233) * 43758.5453
    return v - math.floor(v)


def shot_at(t):
    for s in SHOTS:
        if s["t0"] - 1e-6 <= t < s["t1"] - 1e-6:
            return s
    return SHOTS[-1]


# ------------------------------------------------------------------------------------------ sources
def placeholder(s):
    """A card with the shot number and description (used until the real image exists)."""
    colors = {"city": (38, 48, 72), "blue": (20, 30, 80), "restaurant": (90, 60, 20), "paris": (60, 110, 160),
              "wedding": (90, 140, 90), "porch": (150, 90, 70), "house_in": (110, 80, 90)}
    c = colors.get(s["place"], (60, 60, 60))
    im = Image.new("RGB", (1024, 1536), c)
    a = np.linspace(0, 1, 1536)[:, None, None]
    arr = np.asarray(im).astype(float) * (0.65 + 0.6 * a)
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    f1, f2 = ImageFont.truetype(FONT, 150), ImageFont.truetype(FONT, 40)
    d.text((512, 330), f"{s['id']:02d}", font=f1, fill=(255, 255, 255), anchor="mm")
    d.text((512, 450), s["size"], font=f2, fill=(255, 230, 150), anchor="mm")
    words, line, y = s["scene"].split(), "", 560
    for w in words:
        if d.textlength(line + " " + w, font=f2) > 900:
            d.text((62, y), line.strip(), font=f2, fill=(230, 230, 230)); y += 52; line = ""
        line += " " + w
        if y > 1450:
            break
    d.text((62, y), line.strip(), font=f2, fill=(230, 230, 230))
    for gx in range(0, 1024, 128):      # grid so camera moves are visible
        d.line([(gx, 0), (gx, 1536)], fill=(255, 255, 255), width=1)
    for gy in range(0, 1536, 128):
        d.line([(0, gy), (1024, gy)], fill=(255, 255, 255), width=1)
    return im


@lru_cache(maxsize=6)
def image_for(sid):
    s = SHOTS[sid - 1]
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        p = P("images", f"shot_{sid:02d}{ext}")
        if os.path.exists(p):
            return Image.open(p).convert("RGB")
    return placeholder(s)


def clip_dir(sid):
    return os.path.join(BUILD, "clipframes", f"shot_{sid:02d}")


def extract_clip(sid):
    """Kling clip -> JPEG frames at 30 fps (once)."""
    src = None
    for ext in (".mp4", ".mov", ".webm"):
        p = P("clips", f"shot_{sid:02d}{ext}")
        if os.path.exists(p):
            src = p
    if src is None:
        return None
    d = clip_dir(sid)
    if not os.path.exists(os.path.join(d, "done")):
        os.makedirs(d, exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "fps=30", "-q:v", "2",
                        os.path.join(d, "%04d.jpg")], check=True)
        open(os.path.join(d, "done"), "w").close()
    return sorted(f for f in os.listdir(d) if f.endswith(".jpg"))


@lru_cache(maxsize=8)
def clip_frame(sid, k):
    files = extract_clip(sid)
    k = clamp(k, 0, len(files) - 1)
    return Image.open(os.path.join(clip_dir(sid), files[k])).convert("RGB")


def source(s, t):
    """The picture of shot s at time t: a clip frame (if a clip exists and edit.py uses it) or the image."""
    sp = SPEC.get(s["id"], {})
    use_clip = sp.get("clip", True)
    if use_clip and any(os.path.exists(P("clips", f"shot_{s['id']:02d}{e}")) for e in (".mp4", ".mov", ".webm")):
        files = extract_clip(s["id"])
        speed, cin = sp.get("clip_speed", 1.0), sp.get("clip_in", 0.0)
        k = int(round((cin + (t - s["t0"]) * speed) * FPS))
        return clip_frame(s["id"], clamp(k, 0, len(files) - 1))
    return image_for(s["id"])


# ------------------------------------------------------------------------------------------ camera
def camera(s, t):
    """(cx, cy, z, rot_deg, dx, dy): view centre in image units (0..1), zoom (1 = image just covers the
    frame), roll, and a screen offset in output pixels (shake)."""
    sp = SPEC.get(s["id"], {})
    a = (t - s["t0"]) / max(1e-6, s["t1"] - s["t0"])
    if "keys" in sp:                        # [(t, cx, cy, z, ease_to_this_key), ...] piecewise path
        ks = sp["keys"]
        if t <= ks[0][0]:
            cx, cy, z = ks[0][1:4]
        elif t >= ks[-1][0]:
            cx, cy, z = ks[-1][1:4]
        else:
            j = max(i for i in range(len(ks)) if ks[i][0] <= t)
            k0, k1 = ks[j], ks[j + 1]
            e = ease((t - k0[0]) / max(1e-6, k1[0] - k0[0]), k1[4] if len(k1) > 4 else "inout")
            cx, cy, z = (lerp(k0[i], k1[i], e) for i in (1, 2, 3))
    else:
        c0 = sp.get("cam0", (0.5, 0.5, 1.0))
        c1 = sp.get("cam1", (c0[0], c0[1], c0[2] * 1.05))
        e = ease(a, sp.get("ease", "linear"))
        cx, cy, z = lerp(c0[0], c1[0], e), lerp(c0[1], c1[1], e), lerp(c0[2], c1[2], e)
    for p in sp.get("punch", []):          # (t, factor, (fx, fy), dur, pull)
        tp, f = p[0], p[1]
        if t >= tp:
            k = ease((t - tp) / (p[3] if len(p) > 3 else 0.12), "out")
            z *= 1 + (f - 1) * k
            if len(p) > 2 and p[2] is not None:
                w = (p[4] if len(p) > 4 else 0.6) * k
                cx, cy = lerp(cx, p[2][0], w), lerp(cy, p[2][1], w)
    rot = 0.0
    if "sway" in sp:                        # (amp_deg, period_s): porch swing
        amp, per = sp["sway"]
        rot += amp * math.sin(2 * math.pi * (t - s["t0"]) / per)
        cx += 0.004 * math.sin(2 * math.pi * (t - s["t0"]) / per)
    if "bob" in sp:                         # (amp in image units, period_s): floating brain
        amp, per = sp["bob"]
        cy += amp * math.sin(2 * math.pi * (t - s["t0"]) / per)
    dx = dy = 0.0
    for sh in sp.get("shake", []):          # (t, amp_px, dur)
        ts, amp, dur = sh
        if ts <= t < ts + dur:
            u = (t - ts) / dur
            env = amp * (1 - u) ** 1.5
            ph = 7.3 * ts
            dx += env * (math.sin(2 * math.pi * 19 * t + ph) + 0.5 * math.sin(2 * math.pi * 31 * t + 2 * ph))
            dy += env * (math.sin(2 * math.pi * 23 * t + 3 * ph) + 0.5 * math.sin(2 * math.pi * 37 * t + ph))
            rot += env * 0.012 * math.sin(2 * math.pi * 13 * t + ph)
    return cx, cy, z, rot, dx * SCALE, dy * SCALE


class View:
    """Maps image coordinates <-> screen pixels for one frame."""

    def __init__(self, src, cam):
        self.sw, self.sh = src.size
        cx, cy, z, rot, dx, dy = cam
        s = max(W / self.sw, H / self.sh) * z
        th = math.radians(rot)
        # overscan so shake/roll never shows the image border
        need = 1.0 + (2 * (abs(dx) + abs(dy)) + abs(math.sin(th)) * (W + H)) / min(W, H)
        s *= max(1.0, need * 0.5 + 0.5) if (dx or dy or rot) else 1.0
        hw, hh = W / (2 * s), H / (2 * s)
        X = clamp(cx * self.sw, hw, self.sw - hw) if self.sw > 2 * hw else self.sw / 2
        Y = clamp(cy * self.sh, hh, self.sh - hh) if self.sh > 2 * hh else self.sh / 2
        self.s, self.th, self.X, self.Y = s, th, X, Y
        self.Ox, self.Oy = W / 2 + dx, H / 2 + dy
        self.c, self.si = math.cos(th), math.sin(th)

    def to_screen(self, u, v):
        x, y = u * self.sw - self.X, v * self.sh - self.Y
        return (self.Ox + self.s * (self.c * x - self.si * y), self.Oy + self.s * (self.si * x + self.c * y))

    def px(self, n_img):
        """A length in image units (fraction of the image width) -> screen pixels."""
        return n_img * self.sw * self.s

    def render(self, src):
        a, b = self.c / self.s, self.si / self.s
        d, e = -self.si / self.s, self.c / self.s
        c0 = self.X - (a * self.Ox + b * self.Oy)
        f0 = self.Y - (d * self.Ox + e * self.Oy)
        return src.transform((W, H), Image.AFFINE, data=(a, b, c0, d, e, f0), resample=Image.BICUBIC)


# ------------------------------------------------------------------------------------------ sprites
HEART = ["..aa.aa..", ".abbabba.", "abwbbbbba", "abbbbbbba", ".abbbbba.", "..abbba..", "...aba...", "....a...."]
DROP = ["...a...", "..aba..", "..aba..", ".abwba.", "abwbbba", "abbbbba", "abbbbba", ".abbba.", "..aaa.."]
STAR = ["....a....", "....a....", "...aba...", "aaabwbaaa", "...aba...", "....a....", "....a...."]
STAR = ["....a....", "....a....", "...awa...", "..awwwa..", "aawwwwwaa", "..awwwa..", "...awa...", "....a....",
        "....a...."]
PETAL = [".aa.", "abba", "abba", ".aa."]
FLY = ["w.w", ".a.", "aaa", ".a."]
PAL = {
    "heart": {"a": (150, 20, 70, 255), "b": (255, 95, 160, 255), "w": (255, 225, 240, 255)},
    "drop": {"a": (40, 110, 190, 255), "b": (150, 215, 255, 235), "w": (255, 255, 255, 255)},
    "tear": {"a": (30, 90, 180, 255), "b": (120, 190, 255, 235), "w": (255, 255, 255, 255)},
    "star": {"a": (255, 236, 150, 230), "w": (255, 255, 255, 255)},
    "pinkstar": {"a": (255, 160, 210, 230), "w": (255, 255, 255, 255)},
    "petal": {"a": (230, 120, 160, 255), "b": (255, 200, 220, 255)},
    "petalw": {"a": (220, 200, 210, 255), "b": (255, 255, 255, 255)},
    "fly": {"a": (20, 20, 20, 255), "w": (210, 225, 240, 200)},
}
BITMAPS = {"heart": HEART, "drop": DROP, "tear": DROP, "star": STAR, "pinkstar": STAR, "petal": PETAL,
           "petalw": PETAL, "fly": FLY}


@lru_cache(maxsize=512)
def sprite(name, px):
    """Pixel-art sprite, each art pixel = px screen pixels (nearest-neighbour, chunky PS1 look)."""
    rows, pal = BITMAPS[name], PAL[name]
    h, w = len(rows), max(len(r) for r in rows)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in pal:
                im.putpixel((x, y), pal[ch])
    px = max(1, int(round(px)))
    return im.resize((w * px, h * px), Image.NEAREST)


def paste(layer, im, x, y, alpha=1.0, rot=0.0):
    """Alpha-composite im centred at (x, y) onto the RGBA layer."""
    if alpha <= 0.01:
        return
    if rot:
        im = im.rotate(rot, resample=Image.NEAREST, expand=True)
    if alpha < 0.999:
        a = im.getchannel("A").point(lambda v: int(v * alpha))
        im = im.copy()
        im.putalpha(a)
    x0, y0 = int(round(x - im.width / 2)), int(round(y - im.height / 2))
    if x0 > layer.width or y0 > layer.height or x0 + im.width < 0 or y0 + im.height < 0:
        return
    layer.alpha_composite(im, (max(0, x0), max(0, y0)), (max(0, -x0), max(0, -y0)))


@lru_cache(maxsize=64)
def text_sprite(text, size, fill=(255, 255, 255), outline=8, box=None):
    f = ImageFont.truetype(FONT, int(size))
    l, t_, r, b = f.getbbox(text)
    pad = outline + 6 + (int(size * 0.35) if box else 0)
    im = Image.new("RGBA", (r - l + 2 * pad, b - t_ + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if box:
        d.rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=int(size * 0.3), fill=box)
    d.text((pad - l, pad - t_), text, font=f, fill=fill, stroke_width=outline, stroke_fill=(10, 12, 16))
    return im


@lru_cache(maxsize=8)
def glow_sprite(n=256):
    y, x = np.mgrid[-1:1:n * 1j, -1:1:n * 1j]
    g = np.exp(-(x * x + y * y) * 3.2)
    return g.astype(np.float32)


# ------------------------------------------------------------------------------------------ effects
def fx_stink(layer, v, t, f):
    """Green wavy stink lines rising from (u, v): short wavy segments that rise and fade, staggered."""
    t0, t1 = f.get("t0", -1e9), f.get("t1", 1e9)
    if not (t0 <= t < t1):
        return
    n, spread, rise = f.get("n", 3), f.get("w", 0.22), f.get("h", 0.22)
    sc = f.get("scale", 1.0) * SCALE
    fade_in = clamp((t - t0) / 0.25, 0, 1) if t0 > -1e8 else 1.0
    col_in, col_out = f.get("color", (150, 230, 90)), (40, 95, 30)
    period = f.get("period", 1.6)
    d = ImageDraw.Draw(layer)
    for i in range(n):
        for rep in range(2):
            ph = (t / period + i / n + rep * 0.5 + hsh(i, 3.1) * 0.3) % 1.0
            u0 = f["u"] + spread * ((i + 0.5) / n - 0.5) + 0.02 * (hsh(i, 7) - 0.5)
            pts = []
            for k in range(16):
                q = k / 15
                vv = f["v"] - rise * (ph * 0.85 + q * 0.45)
                uu = u0 + 0.018 * f.get("amp", 1.0) * math.sin(2 * math.pi * (q * 1.6 - t * 1.1) + i * 1.7)
                pts.append(v.to_screen(uu, vv))
            a = fade_in * math.sin(math.pi * ph) ** 0.8 * f.get("alpha", 0.95)
            if a < 0.03:
                continue
            for k in range(len(pts) - 1):
                q = k / 15
                aa = a * math.sin(math.pi * q) ** 0.6
                d.line([pts[k], pts[k + 1]], fill=col_out + (int(220 * aa),), width=max(2, int(17 * sc)))
            for k in range(len(pts) - 1):
                q = k / 15
                aa = a * math.sin(math.pi * q) ** 0.6
                d.line([pts[k], pts[k + 1]], fill=tuple(col_in) + (int(255 * aa),), width=max(1, int(9 * sc)))


def fx_sweat(layer, v, t, f):
    """One sweat drop pops at (u, v) at time t and slides down."""
    ts, dur = f["t"], f.get("dur", 0.9)
    if not (ts <= t < ts + dur):
        return
    k = (t - ts) / dur
    pop = ease(k * dur / 0.12, "back")
    x, y = v.to_screen(f["u"], f["v"] + f.get("slide", 0.035) * ease(k, "in"))
    alpha = 1.0 if k < 0.75 else (1 - k) / 0.25
    paste(layer, sprite("drop", 5 * SCALE * f.get("size", 1.0) * max(0.05, pop)), x, y, alpha)


def fx_sweat_burst(layer, v, t, f):
    """Drops fly off a head in arcs (panic)."""
    ts, n = f["t"], f.get("n", 6)
    for i in range(n):
        st = ts + i * f.get("gap", 0.06)
        k = t - st
        if not (0 <= k < 0.7):
            continue
        ang = math.radians(-160 + 140 * (i + 0.5) / n + 20 * (hsh(i, ts) - 0.5))
        sp = f.get("speed", 0.55) * (0.8 + 0.4 * hsh(i, 2.2))
        uu = f["u"] + math.cos(ang) * sp * k * 0.6
        vv = f["v"] + math.sin(ang) * sp * k + 0.9 * k * k
        x, y = v.to_screen(uu, vv)
        paste(layer, sprite("drop", 4 * SCALE * f.get("size", 1.0)), x, y, 1.0 - k / 0.7,
              rot=-math.degrees(ang) - 90)


def fx_hearts(layer, v, t, f):
    """Small pink hearts float up from an area."""
    t0, t1 = f.get("t0", -1e9), f.get("t1", 1e9)
    rate, life = f.get("rate", 3.0), f.get("life", 1.6)
    k0 = int(math.floor((t - life - max(t0, -1e3)) * rate)) if t0 > -1e8 else int((t - life) * rate) - 1
    start = max(t0, t - life) if t0 > -1e8 else t - life
    for j in range(int(math.floor(start * rate)), int(math.floor(min(t, t1) * rate)) + 1):
        st = j / rate
        if st < t0 or st >= t1 or st > t:
            continue
        a = (t - st) / life
        if a >= 1:
            continue
        uu = f["u"] + f.get("w", 0.3) * (hsh(j, 1.3) - 0.5) + 0.015 * math.sin(2 * math.pi * (a * 1.3 + hsh(j, 5)))
        vv = f["v"] - f.get("rise", 0.18) * a
        x, y = v.to_screen(uu, vv)
        size = f.get("size", 1.0) * (0.7 + 0.6 * hsh(j, 9)) * SCALE
        pop = ease(a / 0.15, "back")
        paste(layer, sprite("heart", 5 * size * max(0.05, pop)), x, y, min(1.0, (1 - a) / 0.35) * f.get("alpha", 1.0))


def fx_heart_pop(layer, v, t, f):
    """A big heart pops up at (u, v), then beats gently; a ring of sparkles bursts out."""
    ts = f["t"]
    if t < ts or t >= f.get("t1", 1e9):
        return
    k = t - ts
    sc = ease(k / 0.28, "back") * (1 + 0.06 * math.sin(2 * math.pi * 1.6 * max(0, k - 0.3)))
    x, y = v.to_screen(f["u"], f["v"])
    paste(layer, sprite("heart", 16 * SCALE * f.get("size", 1.0) * max(0.05, sc)), x, y, 1.0)
    for i in range(8):
        if k > 0.55:
            break
        ang = 2 * math.pi * i / 8 + 0.3
        r = (60 + 380 * ease(k / 0.55, "out")) * SCALE * f.get("size", 1.0)
        paste(layer, sprite("pinkstar", 4 * SCALE), x + r * math.cos(ang), y + r * math.sin(ang), 1 - k / 0.55)


def fx_sparkle(layer, v, t, f):
    """Twinkling 4-point stars at fixed points (staggered)."""
    t0, t1 = f.get("t0", -1e9), f.get("t1", 1e9)
    if not (t0 <= t < t1):
        return
    per = f.get("period", 0.7)
    for i, (uu, vv) in enumerate(f["pts"]):
        ph = ((t - (t0 if t0 > -1e8 else 0)) / per + hsh(i, 4.4)) % 1.0
        if f.get("once") and (t - t0) > per * (1 + hsh(i, 4.4)):
            continue
        sc = math.sin(math.pi * ph) ** 2
        if sc < 0.05:
            continue
        x, y = v.to_screen(uu, vv)
        paste(layer, sprite(f.get("kind", "star"), 4.5 * SCALE * f.get("size", 1.0) * sc), x, y, 1.0)


def fx_glow(arr, v, t, f):
    """Soft additive glow (heavenly light) at (u, v); arr is float RGB 0..255."""
    t0, t1 = f.get("t0", -1e9), f.get("t1", 1e9)
    if not (t0 <= t < t1):
        return
    a = f.get("strength", 0.5) * clamp((t - t0) / 0.3, 0, 1) if t0 > -1e8 else f.get("strength", 0.5)
    a *= 1 + f.get("pulse", 0.0) * math.sin(2 * math.pi * t * 1.2)
    x, y = v.to_screen(f["u"], f["v"])
    r = int(v.px(f.get("r", 0.3)))
    if r < 8:
        return
    g = Image.fromarray((glow_sprite() * 255).astype(np.uint8)).resize((2 * r, 2 * r), Image.BILINEAR)
    g = np.asarray(g).astype(np.float32) / 255.0
    x0, y0 = int(x) - r, int(y) - r
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + 2 * r), min(H, y0 + 2 * r)
    if xa >= xb or ya >= yb:
        return
    sub = g[ya - y0:yb - y0, xa - x0:xb - x0, None] * a
    col = np.array(f.get("color", (255, 225, 150)), np.float32)
    arr[ya:yb, xa:xb] += sub * col * (1 - arr[ya:yb, xa:xb] / 300.0)


def fx_tears(layer, v, t, f):
    """Cartoon crying: drops shoot sideways out of the eyes in arcs, non-stop."""
    t0, t1 = f.get("t0", -1e9), f.get("t1", 1e9)
    rate = f.get("rate", 14)
    for side, (uu, vv) in enumerate(f["pts"]):
        dirn = -1 if side == 0 else 1
        for j in range(int(math.floor((t - 0.8) * rate)), int(math.floor(t * rate)) + 1):
            st = j / rate
            if st < t0 or st >= t1 or st > t:
                continue
            k = t - st
            if k >= 0.8:
                continue
            spd = f.get("speed", 0.35) * (0.8 + 0.4 * hsh(j, side))
            x_, y_ = uu + dirn * spd * k, vv - 0.12 * k * spd * 3 + 0.8 * k * k
            x, y = v.to_screen(x_, y_)
            paste(layer, sprite("tear", 4 * SCALE * f.get("size", 1.0)), x, y, 1 - k / 0.8)


def fx_petals(layer, v, t, f):
    """Flower petals drift down across the screen (screen space)."""
    t0, t1 = f.get("t0", -1e9), f.get("t1", 1e9)
    if not (t0 <= t < t1):
        return
    for i in range(f.get("n", 26)):
        sp = 0.12 + 0.1 * hsh(i, 1)
        y = ((hsh(i, 2) + (t - t0) * sp) % 1.15 - 0.08) * H
        x = (hsh(i, 3) + 0.04 * math.sin(2 * math.pi * (t * 0.5 + hsh(i, 4)))) * W
        flip = abs(math.cos(2 * math.pi * (t * 0.8 + hsh(i, 5))))
        im = sprite("petal" if i % 3 else "petalw", 5 * SCALE)
        im = im.resize((max(1, int(im.width * (0.3 + 0.7 * flip))), im.height), Image.NEAREST)
        paste(layer, im, x, y, 0.95, rot=360 * hsh(i, 6))


def fx_fly(layer, v, t, f):
    """A tiny fly buzzing around a point."""
    t0, t1 = f.get("t0", -1e9), f.get("t1", 1e9)
    if not (t0 <= t < t1):
        return
    tt = t - (t0 if t0 > -1e8 else 0)
    uu = f["u"] + f.get("r", 0.05) * math.sin(2 * math.pi * 0.9 * tt) + 0.012 * math.sin(2 * math.pi * 7 * tt)
    vv = f["v"] + f.get("r", 0.05) * 0.6 * math.sin(2 * math.pi * 1.37 * tt + 1) + 0.01 * math.sin(2 * math.pi * 9 * tt)
    x, y = v.to_screen(uu, vv)
    paste(layer, sprite("fly", 4 * SCALE), x, y, 1.0)


def fx_label(layer, v, t, f):
    """Timeline date label (top-left, screen space), pops in."""
    t0 = f.get("t0", -1e9)
    k = (t - t0) / 0.18 if t0 > -1e8 else 1.0
    im = text_sprite(f["text"], 64 * SCALE, outline=int(6 * SCALE), box=(10, 12, 16, 150))
    sc = ease(k, "back")
    if sc < 0.05:
        return
    im2 = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.BILINEAR)
    x, y = f.get("x", 60) * SCALE, f.get("y", 230) * SCALE
    paste(layer, im2, x + im.width / 2, y + im.height / 2, 1.0)


def fx_bigtext(layer, v, t, f):
    """Big pixel text glued to the image (e.g. "0.1 SEC" on the stopwatch), pops in at f["t"]."""
    ts = f["t"]
    if t < ts:
        return
    sc = ease((t - ts) / 0.2, "back")
    im = text_sprite(f["text"], f.get("size", 130) * SCALE, fill=tuple(f.get("fill", (255, 255, 255))),
                     outline=int(10 * SCALE))
    im = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.BILINEAR)
    x, y = v.to_screen(f["u"], f["v"])
    paste(layer, im, x, y, 1.0)


def fx_speedlines(layer, v, t, f):
    """Anime zoom lines from the frame edges toward the centre (surprise beats)."""
    t0, t1 = f["t0"], f.get("t1", f["t0"] + 0.5)
    if not (t0 <= t < t1):
        return
    a = 1.0 - (t - t0) / (t1 - t0)
    d = ImageDraw.Draw(layer)
    fr = int((t - t0) * FPS)
    cx, cy = W / 2, H * f.get("cy", 0.42)
    for i in range(48):
        ang = 2 * math.pi * (i + hsh(i, fr) * 0.6) / 48
        r0 = (0.55 + 0.25 * hsh(i, fr, 2)) * H * 0.5
        r1 = H
        wdt = 0.012 + 0.012 * hsh(i, 3)
        p = [(cx + r0 * math.cos(ang), cy + r0 * math.sin(ang)),
             (cx + r1 * math.cos(ang - wdt), cy + r1 * math.sin(ang - wdt)),
             (cx + r1 * math.cos(ang + wdt), cy + r1 * math.sin(ang + wdt))]
        d.polygon(p, fill=(255, 255, 255, int(150 * a)))


LAYER_FX = {"stink": fx_stink, "sweat": fx_sweat, "sweat_burst": fx_sweat_burst, "hearts": fx_hearts,
            "heart_pop": fx_heart_pop, "sparkle": fx_sparkle, "tears": fx_tears, "petals": fx_petals,
            "fly": fx_fly, "label": fx_label, "bigtext": fx_bigtext, "speedlines": fx_speedlines}


# ------------------------------------------------------------------------------------------ frame
@lru_cache(maxsize=4)
def vignette(strength):
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2) / math.sqrt(2)
    return (1 - strength * np.clip((r - 0.45) / 0.55, 0, 1) ** 1.6)[..., None].astype(np.float32)


def render_frame(k):
    t = k / FPS
    s = shot_at(t)
    sp = SPEC.get(s["id"], {})
    src = source(s, t)
    v = View(src, camera(s, t))
    base = v.render(src)
    arr = np.asarray(base).astype(np.float32)
    for f in sp.get("fx", []):
        if f["type"] == "glow":
            fx_glow(arr, v, t, f)
    if sp.get("grade"):                          # (saturation, brightness) colour grade
        sat, bri = sp["grade"]
        g = arr.mean(2, keepdims=True)
        arr = (g + (arr - g) * sat) * bri
    arr *= vignette(sp.get("vignette", 0.28))
    for f in sp.get("fx", []):                   # flashes
        if f["type"] == "flash" and f["t"] <= t < f["t"] + f.get("dur", 0.15):
            a = f.get("strength", 0.6) * (1 - (t - f["t"]) / f.get("dur", 0.15)) ** 2
            arr = arr * (1 - a) + 255 * a
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for f in sp.get("fx", []):
        fn = LAYER_FX.get(f["type"])
        if fn:
            fn(layer, v, t, f)
    img.alpha_composite(layer)
    return img.convert("RGB")


def _render_to(args):
    k, out = args
    p = os.path.join(out, f"f_{k:05d}.jpg")
    if os.environ.get("SKIP_EXISTING") and os.path.exists(p):
        return
    render_frame(k).save(p, quality=93)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "sheet"
    if mode == "frames":
        out = os.path.join(BUILD, "frames")
        os.makedirs(out, exist_ok=True)
        a = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        b = int(sys.argv[3]) if len(sys.argv) > 3 else NFRAMES - 1
        for s in SHOTS:                           # extract clips once, before the workers start
            extract_clip(s["id"])
        with Pool(int(os.environ.get("JOBS", "4"))) as pool:
            for i, _ in enumerate(pool.imap_unordered(_render_to, [(k, out) for k in range(a, b + 1)], chunksize=8)):
                if i % 150 == 0:
                    print(f"  {i}/{b - a + 1} frames", flush=True)
        print(f"frames {a}..{b} -> {out}")
    elif mode == "stills":
        out = os.path.join(BUILD, "stills")
        os.makedirs(out, exist_ok=True)
        for x in sys.argv[2:]:
            k = int(round(float(x) * FPS))
            render_frame(k).save(os.path.join(out, f"t{float(x):06.2f}.jpg"), quality=90)
        print(f"stills -> {out}")
    elif mode == "sheet":
        frac = float(os.environ.get("FRAC", "0.6"))
        ims = []
        for s in SHOTS:
            k = int((s["t0"] + frac * (s["t1"] - s["t0"])) * FPS)
            im = render_frame(k).resize((216, 384), Image.BILINEAR)
            d = ImageDraw.Draw(im)
            d.text((6, 4), f"{s['id']:02d}", font=ImageFont.truetype(FONT, 28), fill=(255, 255, 0),
                   stroke_width=3, stroke_fill=(0, 0, 0))
            ims.append(im)
        cols = 9
        rows = (len(ims) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * 216, rows * 384), (0, 0, 0))
        for i, im in enumerate(ims):
            sheet.paste(im, ((i % cols) * 216, (i // cols) * 384))
        os.makedirs(BUILD, exist_ok=True)
        sheet.save(os.path.join(BUILD, "sheet.jpg"), quality=88)
        print(f"sheet -> {os.path.join(BUILD, 'sheet.jpg')}")
    elif mode == "encode":
        out = sys.argv[2] if len(sys.argv) > 2 else P("final.mp4")
        vf = "scale=1080:1920:flags=lanczos," if SCALE != 1 else ""
        vf += "subtitles=audio/captions.ass:fontsdir=fonts"
        cmd = ["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(BUILD, "frames", "f_%05d.jpg"),
               "-i", P("audio", "mix_final.wav"), "-t", f"{NFRAMES / FPS:.3f}", "-vf", vf,
               "-c:v", "libx264", "-preset", os.environ.get("PRESET", "slow"), "-crf", os.environ.get("CRF", "20"),
               "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.2", "-r", str(FPS),
               "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", out]
        subprocess.run(cmd, check=True, cwd=HERE)
        print(f"wrote {out}")


if __name__ == "__main__":
    main()
