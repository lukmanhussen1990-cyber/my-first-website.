"""Render the reel's picture from the images / Kling clips: camera moves + cartoon effects, one shot at a time.

Usage:
  python3 render.py                 render every shot -> build/seg_XX.mp4 (parallel, JOBS=4)
  python3 render.py 5 6 7           only these shots
  python3 render.py --stills DIR    one still per shot (beginning / middle / end) for checking
  python3 render.py --preview 0.5   half-size render (faster checks)
Reads  shots.json (times), audio/word_onsets.json (word times for punch-ins / shakes), fx.py (per-shot camera
       and effects), images/shot_XX.png, clips/shot_XX.mp4 (used instead of the image when present).
Every frame is a pure function of (shot, time): shots can render in any order and in parallel.

Camera: the source is fitted to cover the 1080x1920 frame, then zoomed (push / punch), moved (pan focus point),
rotated and shaken with one affine warp from the original pixels (no double resampling). Effects are drawn in
screen space; effects anchored to something in the picture (stink lines over a door, sweat on a forehead) give
their anchor in source coordinates (u, v in 0..1) so they move with the camera.
"""
import json
import math
import os
import subprocess
import sys
from multiprocessing import Pool

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(HERE, *a)
W, H, FPS = 1080, 1920, 30
PLAN = json.load(open(P("shots.json")))
SHOTS = {s["id"]: s for s in PLAN["shots"]}
WORDS = json.load(open(P("audio", "word_onsets.json")))


def word(line, idx=0):
    """Onset (s) of word idx (0-based, negative from the end) of voice line `line` (1-based)."""
    ws = [w for w in WORDS if w["line"] == line]
    return ws[idx]["s"]


def word_end(line, idx=-1):
    ws = [w for w in WORDS if w["line"] == line]
    return ws[idx]["e"]


# ----------------------------------------------------------------------------------------------- helpers
def hash1(*a):
    """Deterministic pseudo-random 0..1 from numbers."""
    x = math.sin(sum((i + 1) * 12.9898 * v for i, v in enumerate(a)) + 78.233) * 43758.5453
    return x - math.floor(x)


def noise1(t, seed=0.0):
    """Smooth value noise, -1..1."""
    i = math.floor(t)
    f = t - i
    a, b = hash1(i, seed) * 2 - 1, hash1(i + 1, seed) * 2 - 1
    u = f * f * (3 - 2 * f)
    return a + (b - a) * u


def ease(x, kind="inout"):
    x = min(1.0, max(0.0, x))
    if kind == "in":
        return x * x
    if kind == "out":
        return 1 - (1 - x) * (1 - x)
    if kind == "lin":
        return x
    return 0.5 - 0.5 * math.cos(math.pi * x)


def lerp(a, b, x):
    return a + (b - a) * x


def smoothstep(e0, e1, x):
    if e1 == e0:
        return 1.0 if x >= e1 else 0.0
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ----------------------------------------------------------------------------------------------- sources
class ImageSource:
    def __init__(self, path):
        im = cv2.imread(path, cv2.IMREAD_COLOR)
        if im is None:
            raise SystemExit(f"cannot read {path}")
        self.img = im
        self.h, self.w = im.shape[:2]

    def frame(self, lt):
        return self.img


class ClipSource:
    """Kling clip, decoded on demand: frame at shot-local time lt = clip time start + lt * speed."""

    def __init__(self, path, start=0.0, speed=1.0, hold_end=True):
        self.path, self.start, self.speed = path, start, speed
        info = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                               "stream=width,height,r_frame_rate:format=duration", "-of", "json", path],
                              capture_output=True, text=True, check=True).stdout
        j = json.loads(info)
        st = j["streams"][0]
        self.w, self.h = int(st["width"]), int(st["height"])
        num, den = st["r_frame_rate"].split("/")
        self.fps = float(num) / float(den)
        self.dur = float(j["format"]["duration"])
        self.cache = {}
        self._load()

    def _load(self):
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", self.path, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                             capture_output=True, check=True).stdout
        n = len(raw) // (self.w * self.h * 3)
        self.frames = np.frombuffer(raw, np.uint8)[:n * self.w * self.h * 3].reshape(n, self.h, self.w, 3)
        self.n = n

    def frame(self, lt):
        ct = self.start + lt * self.speed
        k = int(round(ct * self.fps))
        k = min(max(k, 0), self.n - 1)
        return self.frames[k]


IMAGES = os.environ.get("IMAGES_DIR", P("images"))     # override for tests with placeholder pictures
CLIPS = os.environ.get("CLIPS_DIR", P("clips"))


def source_for(sid, fx):
    clip, img = os.path.join(CLIPS, f"shot_{sid:02d}.mp4"), os.path.join(IMAGES, f"shot_{sid:02d}.png")
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        cand = os.path.join(IMAGES, f"shot_{sid:02d}{ext}")
        if os.path.exists(cand):
            img = cand
            break
    if os.path.exists(clip) and not os.environ.get("NO_CLIPS"):
        c = fx.get("clip", {})
        return ClipSource(clip, c.get("start", 0.0), c.get("speed", 1.0)), "clip"
    return ImageSource(img), "image"


# ----------------------------------------------------------------------------------------------- camera
def camera(fx, t, t0, t1, src_w, src_h):
    """Affine 2x3 matrix (source px -> output px) for absolute time t."""
    lt, dur = t - t0, t1 - t0
    u = lt / dur
    z0, z1 = fx.get("push", (1.0, 1.06))
    z = lerp(z0, z1, ease(u, fx.get("push_ease", "inout")))
    for (tp, k, *rest) in fx.get("punch", []):        # stepped zoom on a beat (3-frame ease)
        ramp = rest[0] if rest else 0.07
        z *= lerp(1.0, k, smoothstep(tp - 0.02, tp - 0.02 + ramp, t))
    for (tp, k, pd) in fx.get("pulse", []):           # zoom in and back out (snore, sniff, drum)
        if tp <= t < tp + pd:
            z *= 1 + (k - 1) * math.sin(math.pi * (t - tp) / pd)
    (fx0, fy0), (fx1, fy1) = fx.get("pan", ((0.5, 0.5), (0.5, 0.5)))
    e = ease(u, fx.get("pan_ease", "inout"))
    fxp, fyp = lerp(fx0, fx1, e), lerp(fy0, fy1, e)
    # shake (decaying, deterministic), with extra zoom so the frame edge never shows
    sx = sy = rot = 0.0
    margin = 1.0
    for (ts, amp, sdur, *rest) in fx.get("shake", []):
        freq = rest[0] if rest else 18.0
        if ts <= t < ts + sdur:
            k = (1 - (t - ts) / sdur) ** 1.5
            sx += amp * k * noise1((t - ts) * freq, ts * 7.1)
            sy += amp * k * noise1((t - ts) * freq, ts * 3.3 + 50)
            rot += 0.06 * amp / 40 * k * noise1((t - ts) * freq * 0.7, ts + 99)
        margin = max(margin, 1.0 + 2.2 * amp / W)
    hh = fx.get("handheld", 0.0)                     # gentle drift (px)
    if hh:
        sx += hh * noise1(t * 0.6, 11.0)
        sy += hh * noise1(t * 0.5, 23.0)
    rot += math.radians(fx.get("roll", 0.0))
    if fx.get("sway"):                               # rocking camera (swinging chandelier), degrees / Hz
        amp, fq = fx["sway"]
        rot += math.radians(amp) * math.sin(2 * math.pi * fq * lt) * (1 - 0.4 * u)
        margin = max(margin, 1.0 + abs(math.sin(math.radians(amp))) * 1.2)
    z *= margin
    cover = max(W / src_w, H / src_h)
    s = cover * z
    # keep the picture covering the frame: clamp the focus point
    hw, hh_ = W / 2 / s, H / 2 / s
    cx = min(max(fxp * src_w, hw), src_w - hw) if src_w > 2 * hw else src_w / 2
    cy = min(max(fyp * src_h, hh_), src_h - hh_) if src_h > 2 * hh_ else src_h / 2
    c, sn = math.cos(rot), math.sin(rot)
    M = np.array([[s * c, -s * sn, 0.0], [s * sn, s * c, 0.0]])
    M[:, 2] = np.array([W / 2 + sx, H / 2 + sy]) - M[:, :2] @ np.array([cx, cy])
    return M


def to_screen(M, uv, src_w, src_h):
    p = M[:, :2] @ np.array([uv[0] * src_w, uv[1] * src_h]) + M[:, 2]
    return float(p[0]), float(p[1]), float(math.hypot(M[0, 0], M[1, 0]))


# ----------------------------------------------------------------------------------------------- effects
def blend(img, layer, alpha):
    """img uint8 BGR; layer float BGR 0..255; alpha float HxW 0..1."""
    a = alpha[..., None]
    out = img.astype(np.float32) * (1 - a) + layer * a
    return np.clip(out, 0, 255).astype(np.uint8)


def draw_wavy(canvas, alpha, x0, y0, height, amp, wl, phase, thick, color, a_max, sway=0.0):
    """One stink line: a wavy vertical stroke rising from (x0, y0), faded at both ends (anti-aliased)."""
    n = 40
    pts = []
    for i in range(n + 1):
        f = i / n
        y = y0 - f * height
        x = x0 + amp * math.sin(2 * math.pi * (f * height / wl) + phase) * (0.4 + 0.6 * f) + sway * f * f
        pts.append((x, y, f))
    for i in range(n):
        xa, ya, fa = pts[i]
        xb, yb, fb = pts[i + 1]
        fm = (fa + fb) / 2
        a = a_max * smoothstep(0.0, 0.18, fm) * (1 - smoothstep(0.65, 1.0, fm))
        if a <= 0.01:
            continue
        p1, p2 = (int(xa * 4), int(ya * 4)), (int(xb * 4), int(yb * 4))
        cv2.line(canvas, p1, p2, color, int(thick), cv2.LINE_AA, shift=2)
        cv2.line(alpha, p1, p2, float(a), int(thick), cv2.LINE_AA, shift=2)


def fx_stink(img, t, e, M, sw, sh):
    """Green wavy stink lines rising from an anchor (like the reference reel)."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    k = e.get("scale", 1.0) * (s / max(W / sw, H / sh)) ** 0.5
    amount = e.get("amount", 1.0)
    if "fade_in" in e:
        amount *= smoothstep(e["t0"], e["t0"] + e["fade_in"], t)
    n = e.get("n", 3)
    spread = e.get("spread", 70) * k
    canvas = np.zeros((H, W, 3), np.float32)
    alpha = np.zeros((H, W), np.float32)
    dark = np.zeros((H, W), np.float32)
    for i in range(n):
        off = (i - (n - 1) / 2) * spread
        cyc = (t * e.get("speed", 0.55) + hash1(i, 3.3)) % 1.0       # each line rises and fades in a loop
        rise = cyc * 70 * k
        a = amount * math.sin(math.pi * cyc) ** 0.7
        hgt = e.get("height", 260) * k * (0.85 + 0.3 * hash1(i, 9))
        ph = t * 4.2 + i * 2.1
        draw_wavy(dark, dark, x + off, y - rise, hgt, 16 * k, 120 * k, ph, 15 * k, 1.0, a * 0.55)
        draw_wavy(canvas, alpha, x + off, y - rise, hgt, 16 * k, 120 * k, ph, 9 * k,
                  (70, 215, 140), a)                                    # BGR lime green
    # dark soft edge first, then the bright green core
    img = blend(img, np.zeros((H, W, 3), np.float32) + np.array([20, 70, 30], np.float32), np.clip(dark, 0, 1) * 0.5)
    layer = canvas / np.maximum(alpha[..., None], 1e-3)
    return blend(img, np.clip(layer, 0, 255), np.clip(alpha, 0, 1))


def drop_shape(cx, cy, r):
    """Tear/sweat drop polygon: round bottom, pointed top."""
    pts = []
    for i in range(24):
        a = 2 * math.pi * i / 24
        px, py = math.sin(a), -math.cos(a)
        if py < 0:                                            # upper half -> pinch to a point
            px *= (1 + py) ** 1.3
            py = py * 1.9
        pts.append((cx + r * px, cy + r * py))
    return np.array(pts, np.int32)


def fx_drops(img, t, e, M, sw, sh, kind="sweat"):
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    out = img
    for j, at in enumerate(e["at"] if isinstance(e["at"][0], (list, tuple)) else [e["at"]]):
        x, y, s = to_screen(M, at, sw, sh)
        k = e.get("scale", 1.0) * (s / max(W / sw, H / sh)) ** 0.5
        if kind == "sweat":
            lt = t - e["t0"]
            pop = smoothstep(0, 0.12, lt)
            slide = ease(min(1, max(0, (lt - 0.25) / e.get("slide", 1.2))), "in") * e.get("dist", 60) * k
            drops = [(x, y + slide, 22 * k * (0.6 + 0.4 * pop), pop)]
        else:                                                  # tears: stream of drops falling from the eye
            drops = []
            rate = e.get("rate", 6.0)
            side = -1 if j % 2 == 0 else 1
            for q in range(10):
                age = (t - e["t0"]) * rate - q
                if age < 0:
                    continue
                age = (age % 10) / rate
                if age > 0.9:
                    continue
                vx = side * e.get("fly", 0.0) * 260 * k
                dx = vx * age
                dy = 520 * k * age * age + 40 * k * age
                drops.append((x + dx, y + dy, e.get("size", 19) * k, 1 - smoothstep(0.6, 0.9, age)))
        layer = out.copy()
        for (dx, dy, r, a) in drops:
            if a <= 0:
                continue
            poly = drop_shape(dx, dy, r)
            cv2.fillPoly(layer, [poly], (60, 40, 25), cv2.LINE_AA)
            inner = drop_shape(dx, dy, r * 0.8)
            cv2.fillPoly(layer, [inner], (255, 200, 120), cv2.LINE_AA)      # light blue (BGR)
            cv2.circle(layer, (int(dx - r * 0.28), int(dy - r * 0.05)), max(1, int(r * 0.22)), (255, 255, 255), -1,
                       cv2.LINE_AA)
            out = cv2.addWeighted(layer, a, out, 1 - a, 0)
            layer = out.copy()
    return out


def fx_rings(img, t, e, M, sw, sh):
    """Sound-wave arcs bursting out of a mouth (the yell)."""
    if not (e["t0"] <= t < e["t1"]):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    layer = img.copy()
    for q in range(e.get("n", 4)):
        age = (t - e["t0"]) * e.get("rate", 3.2) - q * 0.35
        if age < 0:
            continue
        age %= 1.4
        r = 80 + age * e.get("size", 520)
        a = (1 - age / 1.4) * 0.8
        cv2.ellipse(layer, (int(x), int(y)), (int(r), int(r * 0.92)), 0, e.get("a0", 200), e.get("a1", 340),
                    (255, 255, 255), int(14 * (1 - age / 1.6)) + 2, cv2.LINE_AA)
        img = cv2.addWeighted(layer, a, img, 1 - a, 0)
        layer = img.copy()
    return img


def star(cx, cy, r):
    pts = []
    for i in range(8):
        a = math.pi / 4 * i
        rr = r if i % 2 == 0 else r * 0.28
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return np.array(pts, np.int32)


def fx_sparkles(img, t, e, M, sw, sh):
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    rad = e.get("radius", 220)
    layer = img.copy()
    for i in range(e.get("n", 10)):
        ph = (t * e.get("rate", 1.6) + hash1(i, 1.7)) % 1.0
        a = math.sin(math.pi * ph)
        px = x + (hash1(i, 2.2) * 2 - 1) * rad
        py = y + (hash1(i, 4.4) * 2 - 1) * rad * 0.8
        r = (14 + 22 * hash1(i, 5.5)) * a
        if r < 2:
            continue
        cv2.fillPoly(layer, [star(px, py, r)], (200, 250, 255), cv2.LINE_AA)
    return cv2.addWeighted(layer, 0.9, img, 0.1, 0)


def fx_particles(img, t, e, kind):
    """Confetti / rose petals / dust falling over the whole frame (screen space, deterministic)."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    lt = t - e.get("t0", 0)
    layer = img.copy()
    cols = [(60, 60, 230), (60, 200, 255), (230, 160, 60), (120, 220, 90), (220, 120, 230), (255, 255, 255)]
    for i in range(e.get("n", 40)):
        sp = e.get("speed", 260) * (0.6 + 0.8 * hash1(i, 8))
        y = ((hash1(i, 1) * (H + 200)) + lt * sp) % (H + 200) - 100
        x = hash1(i, 2) * W + 40 * math.sin(lt * (1 + hash1(i, 3)) + i)
        ang = lt * 180 * (hash1(i, 4) - 0.5) + i * 37
        if kind == "confetti":
            box = cv2.boxPoints(((x, y), (22, 12), ang)).astype(np.int32)
            cv2.fillPoly(layer, [box], cols[i % len(cols)], cv2.LINE_AA)
        else:                                                   # rose petal
            cv2.ellipse(layer, (int(x), int(y)), (18, 10), ang, 0, 360, (40, 30, 190), -1, cv2.LINE_AA)
            cv2.ellipse(layer, (int(x - 3), int(y - 2)), (10, 5), ang, 0, 360, (70, 60, 225), -1, cv2.LINE_AA)
    return cv2.addWeighted(layer, e.get("alpha", 1.0), img, 1 - e.get("alpha", 1.0), 0)


def fx_zzz(img, t, e, M, sw, sh):
    """Floating "Z"s for the fake snore: thick white strokes with a dark outline, drifting up and growing."""
    if not (e["t0"] <= t < e["t1"]):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    out = img
    for i in range(3):
        ph = ((t - e["t0"]) * 0.7 + i / 3) % 1.0
        a = min(1.0, math.sin(math.pi * ph) * 1.6)
        if a < 0.08:
            continue
        r = e.get("size", 34) * (0.6 + 0.8 * ph)
        px, py = x + 170 * ph + 25 * math.sin(ph * 7), y - 320 * ph
        pts = np.array([(px - r, py - r), (px + r, py - r), (px - r, py + r), (px + r, py + r)]) * 4
        pts = pts.astype(np.int32).reshape(-1, 1, 2)
        layer = out.copy()
        th = max(4, int(r * 0.32))
        cv2.polylines(layer, [pts], False, (35, 25, 25), th + 8, cv2.LINE_AA, shift=2)
        cv2.polylines(layer, [pts], False, (255, 255, 255), th, cv2.LINE_AA, shift=2)
        out = cv2.addWeighted(layer, a, out, 1 - a, 0)
    return out


def grade(img, t, g, t0, t1):
    """Colour grade: desaturate (drain), tint (multiply towards a colour), haze (green fog), dim."""
    u = (t - t0) / (t1 - t0)
    out = img.astype(np.float32)

    def val(v):
        if isinstance(v, (list, tuple)) and len(v) == 2 and not isinstance(v[0], (list, tuple)):
            return lerp(v[0], v[1], ease(u))
        return v
    if "desat" in g:
        d = val(g["desat"])
        grey = out.mean(axis=2, keepdims=True)
        out = out * (1 - d) + grey * d
    if "tint" in g:
        col, amt = g["tint"]
        amt = val(amt)
        out = out * (1 - amt) + out * (np.array(col, np.float32) / 255.0) * amt
    if "haze" in g:
        amt = val(g["haze"])
        hz = np.array([95, 190, 150], np.float32)                     # pale green (BGR)
        out = out * (1 - amt) + hz * amt
    if "dim" in g:
        out *= 1 - val(g["dim"])
    return np.clip(out, 0, 255).astype(np.uint8)


_vig = None


def vignette(img, k=0.35):
    global _vig
    if _vig is None:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
        _vig = np.clip(1 - 0.55 * np.clip(r - 0.45, 0, None) ** 1.6, 0, 1)
    v = 1 - k * (1 - _vig)
    return (img.astype(np.float32) * v[..., None]).astype(np.uint8)


def flash(img, t, fl):
    a = 0.0
    for (tf, strength, *rest) in fl:
        d = rest[0] if rest else 0.18
        if tf <= t < tf + d:
            a = max(a, strength * (1 - (t - tf) / d))
    if a <= 0:
        return img
    return cv2.addWeighted(np.full_like(img, 255), a, img, 1 - a, 0)


# ----------------------------------------------------------------------------------------------- frame
def render_frame(sid, src, fx, t):
    s = SHOTS[sid]
    t0, t1 = s["t0"], s["t1"]
    fr = src.frame(t - t0)
    sh, sw = fr.shape[:2]
    M = camera(fx, t, t0, t1, sw, sh)
    img = cv2.warpAffine(fr, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    if fx.get("grade"):
        img = grade(img, t, fx["grade"], t0, t1)
    for e in fx.get("fx", []):
        k = e["type"]
        if k == "stink":
            img = fx_stink(img, t, e, M, sw, sh)
        elif k == "sweat":
            img = fx_drops(img, t, e, M, sw, sh, "sweat")
        elif k == "tears":
            img = fx_drops(img, t, e, M, sw, sh, "tears")
        elif k == "rings":
            img = fx_rings(img, t, e, M, sw, sh)
        elif k == "sparkles":
            img = fx_sparkles(img, t, e, M, sw, sh)
        elif k in ("confetti", "petals"):
            img = fx_particles(img, t, e, k)
        elif k == "zzz":
            img = fx_zzz(img, t, e, M, sw, sh)
    if fx.get("vignette", 0.25):
        img = vignette(img, fx.get("vignette", 0.25))
    if fx.get("flash"):
        img = flash(img, t, fx["flash"])
    return img


def shot_frames(sid):
    """Frame indices of shot sid (global frame k covers t = k / FPS)."""
    s = SHOTS[sid]
    k0, k1 = int(round(s["t0"] * FPS)), int(round(s["t1"] * FPS))
    return range(k0, k1)


def render_shot(sid, scale=1.0):
    import fx as FX
    fx = FX.shot_fx(sid)
    src, kind = source_for(sid, fx)
    os.makedirs(P("build"), exist_ok=True)
    out = P("build", f"seg_{sid:02d}.mp4")
    ow, oh = int(W * scale) // 2 * 2, int(H * scale) // 2 * 2
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-vf", f"scale={ow}:{oh}:flags=area", "-c:v", "libx264",
                          "-preset", "veryfast", "-crf", "10", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
    n = 0
    for k in shot_frames(sid):
        img = render_frame(sid, src, fx, k / FPS)
        p.stdin.write(img.tobytes())
        n += 1
    p.stdin.close()
    p.wait()
    return sid, kind, n


def stills(outdir, ids):
    import fx as FX
    os.makedirs(outdir, exist_ok=True)
    for sid in ids:
        fx = FX.shot_fx(sid)
        src, kind = source_for(sid, fx)
        s = SHOTS[sid]
        for tag, u in (("a", 0.03), ("b", 0.5), ("c", 0.97)):
            t = s["t0"] + u * (s["t1"] - s["t0"])
            img = render_frame(sid, src, fx, t)
            cv2.imwrite(os.path.join(outdir, f"s{sid:02d}{tag}.jpg"), cv2.resize(img, (W // 2, H // 2),
                                                                                  interpolation=cv2.INTER_AREA))
    print("stills ->", outdir)


def main():
    args = [a for a in sys.argv[1:]]
    scale = 1.0
    if "--preview" in args:
        i = args.index("--preview")
        scale = float(args[i + 1])
        del args[i:i + 2]
    if "--stills" in args:
        i = args.index("--stills")
        outdir = args[i + 1]
        del args[i:i + 2]
        ids = [int(a) for a in args] or sorted(SHOTS)
        return stills(outdir, ids)
    ids = [int(a) for a in args] or sorted(SHOTS)
    jobs = int(os.environ.get("JOBS", "4"))
    # longest shots first so the pool finishes together
    ids.sort(key=lambda i: -(SHOTS[i]["t1"] - SHOTS[i]["t0"]))
    with Pool(jobs) as pool:
        for sid, kind, n in pool.starmap(render_shot, [(i, scale) for i in ids]):
            print(f"shot {sid:02d}: {n} frames from {kind}")


if __name__ == "__main__":
    main()
